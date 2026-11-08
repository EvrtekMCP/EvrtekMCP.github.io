// THE ROOTMIND (galaxy 2, level 10, act 3): the first seed, grown into a mind of roots round a living star's core.
// Yori's star (40 across, white-green) in eight machine roots, bark with red seams, a graft KNOT on each root: the weak
// points. The plan's new kind of fight: YOU ORBIT IT. The star sits beside the lane and turns, so its knots swing into
// view from one side and out of the other; all of that is in the scenery, and the lane stays straight.
//  PHASE 1 THE GRIP       the star turns a knot round to you; it whitens and fires a fan (send it home into that knot);
//                         a root-whip lashes across the lane between volleys
//  PHASE 2 THE STARFIRE   the knots keep coming, and between them the strangled star flares through a gap in its roots:
//                         a white-hot band across the lane. It cannot be sent back. Its gap brightens 1.3 s first.
//  PHASE 3 THE LAST ROOT  the shortest: the taproot swings round at you; its huge knot opens white and fires a volley.
//                         Send one home and it recoils; three, and the root lets go.
// Each loop is four bars of the Rootmind's part of the music (150 bpm, 1.6 s a bar). The knots come round in one
// direction, three in every four bars (g2-roll, 11-07; it was one every two), the whips and the bands in a fixed
// order, so the third time round you know what is next (rules 24, 28). Every struck knot spills sap-light (shield) and every loop spills one more (rule 7).
// Rule 26: escapeAfter 135 s, and every hit buys 3 s more, so only a ship that stops hurting it sees the star tear itself
// free (sized from the decent human bot); then the release plays, with no boss bonus.
import { THREE, defineBoss, buildModel, clamp, smoothstep } from '../../api.js?v=0.5.0';
import { MESH } from './mesh.js?v=0.5.0';

const BAR = 1.6, BEAT = 0.4;
const X0 = 42, Y0 = -4.5, HOLD = 128, N = 8, STAR_R = 20, SCALE = 0.85;
const RED = 0xff3355, DEAD = 0x2a2730, SILVER = new THREE.Color(0xc8d0dc), BARK = new THREE.Color(0x4a3220);
const SEAM_DEAD = new THREE.Color(0x3a1a14), SAP = new THREE.Color(0xd0ffb0);
const tmpV = new THREE.Vector3(), tmpC = new THREE.Color();
// knot 0 in Yori's frame (her ROOTMIND.weak[0]); knot i is the same point turned i/8 of the way round her Z axis
const KT = 9 / 14, KLAT = Math.PI / 2 - KT * Math.PI * 0.95, KLON = KT * Math.PI * 0.8, KR = STAR_R * 1.08 * 1.12;
const K0 = [Math.cos(KLAT) * Math.cos(KLON) * KR, Math.cos(KLAT) * Math.sin(KLON) * KR, -Math.sin(KLAT) * KR];
// her root split in two: its knot (its own materials, so it can whiten, swell and go dark) and the rest of the root
function split(groups, test) {
  const a = [], b = [];
  for (const g of groups) {
    const pa = [], pb = [];
    for (let i = 0; i < g.p.length; i += 9) {
      const cx = (g.p[i] + g.p[i + 3] + g.p[i + 6]) / 3, cy = (g.p[i + 1] + g.p[i + 4] + g.p[i + 7]) / 3, cz = (g.p[i + 2] + g.p[i + 5] + g.p[i + 8]) / 3;
      const dst = test(cx, cy, cz) ? pa : pb; for (let k = 0; k < 9; k++) dst.push(g.p[i + k]);
    }
    if (pa.length) a.push(Object.assign({}, g, { p: pa })); if (pb.length) b.push(Object.assign({}, g, { p: pb }));
  }
  return [a, b];
}
const [KNOT, ROOT] = split(MESH.root, (x, y, z) => Math.hypot(x - K0[0], y - K0[1], z - K0[2]) < 2.8);
const keysOf = (groups) => [...new Set(groups.map((g) => g.color + (g.glow ? '*' : '')))];

// where the star turns its knots to: the side of it facing the lane, a little toward you (azimuth about its upright
// axis, in the frame that turns; three.js: turning by `spin` moves a point at azimuth a to a - spin)
const AZ_STRIKE = Math.atan2(0.55, -0.83);
const azOf = (v) => Math.atan2(v.z, v.x);
const TAU = Math.PI * 2, mod = (a) => ((a % TAU) + TAU) % TAU;

// a knot's position in the boss's own frame (the root's), from the turn, the body and its root's place round the star
function knotAt(b, i, out) {
  tmpV.set(K0[0], K0[1], K0[2]).applyMatrix4(b.roots[i].rg.matrix).applyMatrix4(b.body.matrix).applyMatrix4(b.turn.matrix);
  out[0] = tmpV.x; out[1] = tmpV.y; out[2] = tmpV.z; return out;
}
// the next live knot round, and the spin that brings it to the strike (the star only ever turns one way)
function nextKnot(b) {
  let best = -1, bd = 1e9;
  for (let i = 0; i < N; i++) {
    if (b.weak[i].hp <= 0) continue;
    let d = mod(b.az0[i] - AZ_STRIKE - b.spinTo);
    if (d > TAU - 0.3) d = 0;                       // already at the strike (a hair short of a full turn is no turn)
    if (d > 0.3 && d < bd) { bd = d; best = i; }
  }
  // the last knot left, already turned to you: it holds there (no wild full turn)
  if (best < 0) for (let i = 0; i < N; i++) if (b.weak[i].hp > 0) { best = i; bd = mod(b.az0[i] - AZ_STRIKE - b.spinTo); if (bd < 0.3 || bd > TAU - 0.3) bd = 0; break; }
  return best < 0 ? null : { i: best, to: b.spinTo + bd };
}
function swingTo(b, to, secs) { b.spinFrom = b.spin; b.spinTo = to; b.swingT0 = b.clock; b.swingFor = secs; }

// ---- the attacks (each plays out its own tell with b.later, so the music's bar is the rhythm)
// THE KNOT: turn the next knot round (0.75 bar), it whitens (from 0.25 bar: the 1.2 s tell), it fires a fan on the bar.
// One volley in two BURSTS instead (g2-roll, 11-07; the MCP's ruling for the two finale bosses, LEVEL-API 14): the sap
// bursts out of the knot as a net round you, as the taproot's knots do, the 7 bolts of api.course.netPoints() landing
// together NET_T after the bar. No gap fits a ship and it is too wide to steer out of in that time: roll on the bar, and
// the net goes home into that knot. Always one ring (7 bolts), whatever the level's own nets are.
const NET_T = 0.4;
function knotNet(b, api, w, i) {
  const sh = api.ship, tx = clamp(sh.x + sh.vx * 0.3, -api.box.x, api.box.x), ty = clamp(sh.y + sh.vy * 0.3, -api.box.y, api.box.y);
  const a = b.volleys * 0.7, ca = Math.cos(a), sa = Math.sin(a);   // turned a little each net, so no two look the same
  for (const [dx, dy] of api.course.netPoints().slice(0, 7)) api.fire({ x: w.ent.x, y: w.ent.y, z: w.ent.z }, tx + dx * ca - dy * sa, ty + dx * sa + dy * ca, { T: NET_T, noEase: true, owner: b });
  b.kick[i] = 1;
  api.game.sfx('g2-sap-burst', { vol: 0.9, rate: 0.8 });
}
function knotVolley(o = {}) {
  return (b, api) => {
    const nk = nextKnot(b); if (!nk) return;
    const i = nk.i, w = b.weak[i];
    swingTo(b, nk.to, 0.75 * BAR); b.current = i;
    // a knot still lit from its last volley stays lit (the same knot twice running: its last fan's shots are on their
    // way home, and a gap in its light would glance them off)
    // (g2-roll: it can be hurt from the bar it fires, not from its turn: the knots now come a bar apart, and a fan sent
    // home must find its own knot, not the next one already whitening beside it)
    if (!(b.clock >= b.litFrom[i] && b.clock <= b.litUntil[i])) { b.litFrom[i] = b.clock + 0.25 * BAR; b.hotFrom[i] = b.clock + BAR; }
    b.litUntil[i] = b.clock + 2.4 * BAR; b.fireAt[i] = b.clock + BAR;
    // every second volley of the fight is a net (counted over the Grip and the Starfire together)
    if ((b.volleys = (b.volleys || 0) + 1) % 2 === 0) {
      b.later(BAR, () => { if (w.hp <= 0 || b.current < 0 || b.clock > b.litUntil[i]) return; knotNet(b, api, w, i); });
      return;
    }
    const n = o.shots || 3, spread = o.spread ?? 1.4;
    for (let s = 0; s < n; s++) b.later(BAR + s * 0.09, () => {
      // only ever from a live knot still lit from its turn to you (g2-roll, 11-07: the knots now come a bar apart, so
      // the next knot's turn starts on the very bar this one fires; it fires as it begins to swing away)
      if (w.hp <= 0 || b.current < 0 || b.clock > b.litUntil[i]) return;
      const sh = api.ship, k = n > 1 ? (s % 2 ? 1 : -1) * Math.ceil(s / 2) * spread : 0;
      const tx = clamp(sh.x + sh.vx * 0.3 + k, -api.box.x, api.box.x), ty = clamp(sh.y + sh.vy * 0.3, -api.box.y, api.box.y);
      api.fire({ x: w.ent.x, y: w.ent.y, z: w.ent.z }, tx, ty, { T: o.T || 1.3, owner: b });
      b.kick[i] = 1;
      if (s === 0) api.game.sfx('fire', { rate: 0.6, vol: 0.7 });
    });
  };
}
// A ROOT-WHIP across the lane, its rest line through where you are now (so you have to move), anchored by turns from
// the four sides in a fixed order. It shoots out of its anchor and lashes 2.8 s later.
const WHIPS = [{ dir: 'h', piv: 1 }, { dir: 'v', piv: 1 }, { dir: 'h', piv: -1 }, { dir: 'v', piv: -1 }];
function lash() {
  return (b, api) => {
    const k = (b.whips = (b.whips || 0) + 1) - 1, o = WHIPS[k % WHIPS.length], s = api.ship;
    const ev = Object.assign({ type: 'g2-root-whip', grow: true, tel: 1.2, lead: 0.8, tilt: (k % 3 - 1) * 0.12 }, o,
      o.dir === 'h' ? { ny: clamp(s.y / api.box.y, -0.55, 0.55) } : { nx: clamp(s.x / api.box.x, -0.55, 0.55) });
    api.spawn(ev, -Math.max(60, api.v) * 2.9);
  };
}
// STARFIRE: the gap between two roots on the lane's side brightens white-green (1.3 s), then a white-hot band crosses
// the lane for 1 s. The bands come in a fixed order: high, low, both edges, the middle.
const BANDS = [[{ c: 1.9, w: 1.9, tilt: 0.1 }], [{ c: -1.9, w: 1.9, tilt: -0.1 }], [{ c: 3.0, w: 1.3, tilt: 0 }, { c: -3.0, w: 1.3, tilt: 0 }], [{ c: 0, w: 1.7, tilt: 0.12 }]];
function starfire(o = {}) {
  return (b, api) => {
    const set = BANDS[(b.fires = (b.fires || 0) + 1) % BANDS.length === 0 ? BANDS.length - 1 : (b.fires - 1) % BANDS.length];
    const tel = o.tel ?? 1.3, on = o.on ?? 1.0;
    // the gap: on the star's surface, between the root turning in and the one that has gone by
    const a = AZ_STRIKE + 0.35; tmpV.set(Math.cos(a) * STAR_R * 1.02, 2, Math.sin(a) * STAR_R * 1.02);
    b.gap.position.copy(tmpV); b.gapT = 0; b.gapTel = tel; b.gapOn = on;
    b.root.localToWorld(tmpV);
    for (const band of set) api.spawn(Object.assign({ type: 'g2-rootmind-starfire', tel, on, from: { x: tmpV.x, y: tmpV.y + band.c * 0.3, z: tmpV.z } }, band), -2);
    if (!b.fireTaught) { b.fireTaught = true; api.game.call('STARFIRE CAN\'T BE SENT BACK. GET OUT OF ITS WAY', 'c-red'); }
  };
}
// THE LAST ROOT: the taproot swings round the star at you (1.5 bars), its knot opens white (the tell, from 1 bar), and
// on bar 3 it fires a tight volley. One send-back makes it recoil (a swing takes one hit); it swings away on bar 4.
const ARM_REST = mod(AZ_STRIKE + Math.PI * 0.95), ARM_STRIKE = Math.atan2(0.85, -0.53), ARM_LEN = 60;   // its knot comes to about 15 m right of the lane, 85 m out
function taproot() {
  return (b, api) => {
    const w = b.weak[N]; if (w.hp <= 0) return;
    b.tap = { t0: b.clock, hit: false };
    // (g2-roll, 11-07: the fight's one volley in two is a net, and the Last Root's swings count in it: every second swing
    // the open knot bursts its net round you on bar 3, and a roll answers it as it answers the fan)
    if ((b.volleys = (b.volleys || 0) + 1) % 2 === 0) { b.later(2 * BAR, () => { if (w.hp <= 0) return; knotNet(b, api, w, N); }); return; }
    b.later(2 * BAR - 0.05, () => {
      if (w.hp <= 0) return;
      for (let s = 0; s < 3; s++) b.later(s * 0.09, () => { const sh = api.ship; api.fire({ x: w.ent.x, y: w.ent.y, z: w.ent.z }, clamp(sh.x + sh.vx * 0.3, -api.box.x, api.box.x), clamp(sh.y + sh.vy * 0.3, -api.box.y, api.box.y), { T: 1.35, owner: b }); });
      api.game.sfx('g2-sap-burst', { vol: 0.9, rate: 0.7 });
    });
  };
}
// SAP-LIGHT: it pours out of the star at a knot and drifts into the lane as it comes (shield and points; rule 7)
function spill(b, api, n, from) {
  for (let k = 0; k < n; k++) {
    const x0 = clamp(from ? from.x : 14, -16, 16), y0 = clamp(from ? from.y : 2, -8, 8);
    // it settles near where you are (a few metres off), so taking it never pulls you off the next volley's line
    const sx = api.ship.x / api.box.x, sy = api.ship.y / api.box.y;
    api.spawn({ type: 'g2-rootmind-sap', nx: clamp(sx + (Math.random() - 0.5) * 0.5, -0.7, 0.7), ny: clamp(sy + (Math.random() - 0.5) * 0.5, -0.7, 0.7), x0, y0 }, -210 - k * 22);
  }
}

export default defineBoss({
  name: 'g2-rootmind', title: 'THE ROOTMIND',
  hold: HOLD, y: Y0, scale: SCALE, enterTime: 6.4, escapeAfter: 135, defeatTime: 3.6,
  escapeCall: 'THE STAR TORE ITSELF FREE',
  bonus: 110000, hitPts: 3000, pointDown: 'KNOT DOWN!', downCall: 'THE STAR IS FREE!',
  build(api, b) {
    const root = new THREE.Group(); root.position.set(X0, Y0, -800);
    const turn = new THREE.Group(); root.add(turn);
    const body = new THREE.Group(); body.rotation.x = -Math.PI / 2; turn.add(body);   // her poles (+-Z) stand upright
    const star = buildModel(MESH.star, { own: ['#f4fff0*', '#d0ffb0*'] }); body.add(star.group);
    const roots = [];
    for (let i = 0; i < N; i++) {
      const rg = new THREE.Group(); rg.rotation.z = i * TAU / N; body.add(rg);
      const r = buildModel(ROOT, { own: keysOf(ROOT) }); rg.add(r.group);
      const kp = new THREE.Group(); kp.position.set(K0[0], K0[1], K0[2]); rg.add(kp);
      const k = buildModel(KNOT, { own: keysOf(KNOT) }); k.group.position.set(-K0[0], -K0[1], -K0[2]); kp.add(k.group);
      rg.updateMatrix();
      roots.push({ rg, kp, mats: r.mats, kmats: k.mats });
    }
    // the taproot (phase 3): Yori's root, longer, from the star's heart, with her huge open knot at its end
    const arm = new THREE.Group(); root.add(arm);
    const armBody = buildModel(MESH.arm, { own: keysOf(MESH.arm) }); armBody.group.scale.set(ARM_LEN / 30, 2.1, 2.1); armBody.group.position.x = ARM_LEN / 2; arm.add(armBody.group);
    const big = buildModel(MESH.bigKnot, { own: keysOf(MESH.bigKnot) }); big.group.scale.setScalar(2.4); big.group.position.x = ARM_LEN; big.group.rotation.y = -Math.PI / 2; arm.add(big.group);
    arm.rotation.y = -ARM_REST; arm.visible = false;
    // the starfire gap's glow, and the star's own light
    const glowSprite = (color, s, o) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: o, fog: false })); sp.scale.setScalar(s); return sp; };
    const gap = glowSprite(0xf4fff0, 10, 0); root.add(gap);
    const halo = glowSprite(0xd0ffb0, 70, 0.35); root.add(halo);
    Object.assign(b, { turn, body, star, roots, arm, armMats: armBody.mats, bigMats: big.mats, big, gap, halo,
      spin: 0, spinFrom: 0, spinTo: 0, swingT0: -9, swingFor: 1, clock: 0, gapT: 9, gapTel: 1.3, gapOn: 1,
      litFrom: new Array(N).fill(-9), hotFrom: new Array(N).fill(-9), litUntil: new Array(N).fill(-9), fireAt: new Array(N).fill(-9), kick: new Array(N + 1).fill(0),
      dead: new Array(N).fill(0), tap: null, armAz: ARM_REST, free: 0 });
    // each knot's azimuth before any turn; the star starts half a knot short of the strike, so the first swing is short
    turn.updateMatrix(); body.updateMatrix();
    b.az0 = roots.map((r, i) => { const p = knotAt(b, i, [0, 0, 0]); return azOf({ x: p[0], z: p[2] }); });
    b.spin = b.spinFrom = b.spinTo = mod(b.az0[0] - AZ_STRIKE) - Math.PI / N;
    turn.rotation.y = b.spin; turn.updateMatrix();
    const weak = [];
    for (let i = 0; i < N; i++) weak.push({ at: knotAt(b, i, [0, 0, 0]), r: 2.6, hp: 2 });
    weak.push({ at: [0, 0, 0], r: 4.2, hp: 3, call: 'THE ROOT LETS GO!' });   // the taproot's knot: inside the star until phase 3
    return { root, weak, muzzles: [[0, 0, 0]] };
  },
  // rule 25: a knot is lit only while it is turned to you, and can be hurt from the bar it fires until its light fades
  // (g2-roll); the taproot's knot only while it is open
  exposed(b, w) {
    if (w.i === N) return b.pi === 2 && !!b.tap && !b.tap.hit && b.clock - b.tap.t0 > BAR && b.clock - b.tap.t0 < 3.6 * BAR;
    return b.pi < 2 && b.clock >= b.hotFrom[w.i] && b.clock <= b.litUntil[w.i];
  },
  // a second bolt home into the taproot's knot in the same swing glances off as spilt sap, not a CLANG
  onClang(b, w, shot, api) { if (w.i === N && b.tap && b.tap.hit) { spill(b, api, 1, w.ent); return true; } return false; },
  // (g2-roll, 11-07, roll demand: the Grip turns a knot to you on bars 1, 2 and 3 and lashes a whip on bar 4, so its
  // fans land on three bars running and the whip crosses in the gap; the Starfire adds a third knot on bar 4, its fan
  // landing in the next loop's first bar. Every second volley is a net (knotVolley). Volleys still fire on bar lines;
  // never more than three roll moments in any 3 s.)
  phases: [
    { name: 'THE GRIP', until: 0.69, loop: 4 * BAR,
      pattern: [{ at: 0, tel: 0, attack: knotVolley() }, { at: 1.0 * BAR, tel: 0, attack: knotVolley() }, { at: 2 * BAR, tel: 0, attack: knotVolley() }, { at: 3 * BAR, tel: 0, attack: lash() }, { at: 3.5 * BAR, tel: 0, attack: (b, api) => spill(b, api, 1) }] },
    { name: 'THE STARFIRE', until: 0.16, loop: 4 * BAR, enter(b, api) { b.queue.length = 0; api.game.sfx('boss-phase', { vol: 0.8 }); },
      pattern: [{ at: 0, tel: 0, attack: knotVolley() }, { at: 1.5 * BAR, tel: 0, attack: starfire() }, { at: 2 * BAR, tel: 0, attack: knotVolley() }, { at: 3 * BAR, tel: 0, attack: knotVolley() }, { at: 3.5 * BAR, tel: 0, attack: (b, api) => spill(b, api, 1) }] },
    { name: 'THE LAST ROOT', loop: 4 * BAR, enter(b, api) { b.queue.length = 0; b.current = -1; api.game.sfx('boss-phase', { vol: 0.8 }); b.arm.visible = true; },
      pattern: [{ at: 0, tel: 0, attack: taproot() }, { at: 3.5 * BAR, tel: 0, attack: (b, api) => spill(b, api, 1) }] },
  ],
  update(b, dt, api) {
    b.clock += dt;
    b.x = X0;
    // the turn: it swings to each knot (eased at both ends), and breathes a little while it holds
    const k = smoothstep(0, 1, (b.clock - b.swingT0) / b.swingFor);
    b.spin = b.spinFrom + (b.spinTo - b.spinFrom) * k;
    b.turn.rotation.y = b.spin + 0.015 * Math.sin(b.clock * 0.9); b.turn.updateMatrix(); b.body.updateMatrix();
    const dying = b.state === 'dying' || b.state === 'escape';
    if (dying) b.free = Math.min(1, b.free + dt / 1.6);
    // the knots: red; whitening through their tell; white-hot and swollen while lit; dark and shrunk once burnt out.
    // A burnt-out knot's root loses its red seams and pales toward silver: you can see the graft dying root by root.
    for (let i = 0; i < N; i++) {
      const R = b.roots[i], w = b.weak[i], seam = R.kmats['#ff3355*'];
      b.kick[i] = Math.max(0, b.kick[i] - dt * 5);
      if (w.hp <= 0) b.dead[i] = Math.min(1, b.dead[i] + dt * 1.2);
      let pk = 0;
      if (w.hp > 0 && b.clock >= b.litFrom[i] && b.clock <= b.litUntil[i]) {
        const into = b.clock - b.litFrom[i], tel = b.fireAt[i] - b.litFrom[i];
        pk = into < tel ? (into / tel) * (0.6 + 0.4 * Math.sin(into * 30)) : Math.max(0.55, b.kick[i]);
      }
      if (w.hp <= 0) seam.color.setHex(DEAD); else seam.color.setRGB(1, 0.2 + 0.78 * pk, 0.33 + 0.62 * pk);
      R.kp.scale.setScalar((1 + 0.3 * pk + 0.15 * b.kick[i]) * (1 - 0.4 * b.dead[i]));
      const free = Math.max(b.dead[i] * 0.45, b.free);
      if (R.mats['#ff3355*']) R.mats['#ff3355*'].color.setHex(RED).lerp(free > 0.4 ? SAP : SEAM_DEAD, Math.min(1, b.dead[i] + b.free));
      if (R.mats['#4a3220']) R.mats['#4a3220'].color.copy(BARK).lerp(SILVER, free);
      // freed, the roots open outward from the star
      R.rg.scale.setScalar(1 + 0.22 * b.free);
    }
    for (let i = 0; i < N; i++) knotAt(b, i, b.weak[i].at);
    // the taproot: round from behind the star to strike at you, recoiling when hit, away again on bar 4
    const tw = b.weak[N];
    if (b.tap && tw.hp > 0) {
      const t = (b.clock - b.tap.t0) / BAR;
      const swing = t < 1.5 ? smoothstep(0, 1.5, t) : t < 3 ? 1 : 1 - smoothstep(3, 4, t);
      const recoil = b.tap.hit ? Math.max(0, 1 - (b.clock - b.tap.hitT) * 1.4) : 0;
      let d = mod(ARM_STRIKE - ARM_REST); b.armAz = ARM_REST + d * swing - 0.5 * recoil;
      const open = b.tap.hit ? 0.3 : t > 1 && t < 3.6 ? Math.min(1, (t - 1) * 1.6) : 0;
      if (b.bigMats['#ffffff*']) b.bigMats['#ffffff*'].color.setHex(RED).lerp(tmpC.setHex(0xffffff), open * (0.7 + 0.3 * Math.sin(b.clock * 26)));
      b.big.group.scale.setScalar(2.4 * (1 + 0.25 * open));
      if (b.tap.hit === false && tw.lastHp !== undefined && tw.hp < tw.lastHp) { b.tap.hit = true; b.tap.hitT = b.clock; }
    } else if (tw.hp <= 0) { b.armAz += dt * 0.6; }
    b.arm.rotation.set(0, -b.armAz, 0.14);
    tmpV.set(ARM_LEN, 0, 0).applyEuler(b.arm.rotation); tw.at[0] = tmpV.x; tw.at[1] = tmpV.y; tw.at[2] = tmpV.z;
    if (b.pi < 2 || !b.arm.visible) { tw.at[0] = 0; tw.at[1] = 0; tw.at[2] = 0; }
    // every hit: a spill of sap-light at that knot, and 2 s more on the clock before the star tears itself free
    for (const w of b.weak) {
      if (w.lastHp !== undefined && w.hp < w.lastHp && b.state === 'fight') { if (w.hp > 0) spill(b, api, 1, w.ent); b.fightT = Math.max(0, b.fightT - 3); api.game.sfx('boss-hit', { vol: 0.9 }); }
      w.lastHp = w.hp;
    }
    // the starfire gap brightens through its tell, flares while the band burns
    b.gapT += dt;
    const gk = b.gapT < b.gapTel ? b.gapT / b.gapTel : b.gapT < b.gapTel + b.gapOn ? 1 : Math.max(0, 1 - (b.gapT - b.gapTel - b.gapOn) * 3);
    b.gap.material.opacity = gk * (b.gapT < b.gapTel ? 0.6 + 0.4 * Math.sin(b.gapT * 28) : 1); b.gap.scale.setScalar(8 + 16 * gk);
    // the star: it breathes; it brightens as it is freed
    const breath = 0.5 + 0.5 * Math.sin(b.clock * 1.4);
    b.halo.material.opacity = 0.28 + 0.1 * breath + 0.5 * b.free; b.halo.scale.setScalar(64 + 6 * breath + 40 * b.free);
    b.star.group.scale.setScalar(1 + 0.012 * breath + 0.08 * b.free);
  },
  onWeakDown(b, w, api) {
    spill(b, api, w.i === N ? 2 : 3, w.ent); api.game.shake(0.9);
    api.game.burst(w.ent.x, w.ent.y, w.ent.z, 60, { speed: 20, life: 0.8, s0: 2.2, r: 0.8, g: 1, b: 0.7, carry: 0, drag: 1.4 });
    api.game.sfx('g2-graft-crack', { vol: 0.9 });
  },
  enter(b, api) { api.game.sfx('boss-warning', { vol: 0.9 }); },
  defeat(b, api) { api.game.flash(); api.game.sfx('g2-boss-freed', { vol: 1 }); api.game.sfx('g2-star-breath', { vol: 0.9 }); },
});
export const ROOTMIND_AT = { x: X0, y: Y0, z: -HOLD, scale: SCALE };
