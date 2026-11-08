// THE LATTICE HEART (level 10, act 3): the core of the machine. Yori's vast eye of light (18 across) in a shell of
// eight armour plates (30 across), drawn at 2.2x. Each plate carries a red hinge core on its outer edge: the weak
// points. A plate slides open on its piston before its hinge fires, and only an open hinge can be hurt (rule 25).
// A shot sent back homes on the nearest open hinge (the framework's rule), and only the hinges that are firing are
// open, so a roll sends a burst back where it came from.
//  PHASE 1 THE EYE OPENS     seeker volleys: two plates open, their hinges bloom, each fires a pair on the beat, a bar apart
//  PHASE 2 THE GREAT BEAM    a volley, then the beam: the pupil shrinks, a magenta ring grows thickest on the side
//                            the beam will cover, and white fire fills most of the lane. It cannot be sent back.
//  PHASE 3 THE LAST PLATES   the piston wall (one gap, its edges red, white at the last moment), then a volley
// Each loop is four bars of the core track (150 bpm, 1.6 s a bar), so the rhythm is the music's (rule 28, 30).
// The beam's sides and the wall's gaps run in a fixed order, so the third time round you know what comes next.
// Rule 26: it gives up only on a ship that stops hurting it. escapeAfter is 105 s, and every hit buys 4.5 s more
// (24 hits, up to 108 s), so a never-roll bot sees it tear itself apart at 105 s while a slow fighter keeps going.
import { THREE, defineBoss, buildModel, clamp } from '../../api.js?v=0.5.0';
import { MESH } from './mesh.js?v=0.5.0';

const SCALE = 2.2, N = 8, PLATE_R = 11.5, EYE_R = 9;
const BAR = 1.6, BEAT = 0.4;
const DEAD = 0x2a2730, RED = 0xff3355;
const tmpV = new THREE.Vector3(), tmpC = new THREE.Color();

// her plate split in two: the hinge core (its own material, so it can go dark) and the rest
function split(groups, test) {
  const a = [], b = [];
  for (const g of groups) {
    const pa = [], pb = [];
    for (let i = 0; i < g.p.length; i += 9) {
      const cy = (g.p[i + 1] + g.p[i + 4] + g.p[i + 7]) / 3, dst = test(cy, g) ? pa : pb;
      for (let k = 0; k < 9; k++) dst.push(g.p[i + k]);
    }
    if (pa.length) a.push(Object.assign({}, g, { p: pa })); if (pb.length) b.push(Object.assign({}, g, { p: pb }));
  }
  return [a, b];
}
const [HINGE, PLATE] = split(MESH.plate, (cy, g) => g.glow && cy > 2.2);

// the beam's tell: a magenta annulus whose hole sits off-centre, so it is thin on the safe side
function tellRing() {
  const s = new THREE.Shape(); s.absarc(0, 0, 1, 0, Math.PI * 2, false);
  const h = new THREE.Path(); h.absarc(-0.22, 0, 0.72, 0, Math.PI * 2, true); s.holes.push(h);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 48), new THREE.MeshBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  return m;
}

// ---- the attacks. Each runs at its step's time and plays out its own tell and shots with b.later.
function liveHinges(b) { return b.weak.filter((w) => w.hp > 0).map((w) => w.i); }
// the next k live hinges, spread round the shell, in a fixed rotation
function pick(b, k) {
  const live = liveHinges(b); if (!live.length) return [];
  const out = [];
  b.turn = (b.turn ?? -3) + 3;
  for (let j = 0; j < Math.min(k, live.length); j++) out.push(live[(b.turn + Math.round(j * live.length / Math.min(k, live.length))) % live.length]);
  return [...new Set(out)];
}
function openPlate(b, i, secs) { b.openUntil[i] = Math.max(b.openUntil[i], b.clock + secs); }
function volley(o) {
  return (b, api) => {
    const hs = pick(b, o.k || 2), tel = o.tel ?? 1.2, gap = o.gap ?? BEAT / 2, n = o.shots || 2; // a pair on the eighth notes
    api.game.sfx('fire', { rate: 0.55, vol: 0.7 });
    hs.forEach((i, j) => {
      const w = b.weak[i];
      // each hinge's shots are one tight burst (one roll returns them all: MULTI-DEFLECT), the next hinge a bar later,
      // so the roll's cooldown is never what loses you a shot: one burst, one roll, a bar to breathe (rule 28)
      const first = tel + j * (o.stagger ?? BAR), last = first + (n - 1) * gap;
      openPlate(b, i, last + (o.T || 1.4) + 1.6);       // open through the tell, the shots, and their way back
      b.bloomAt[i] = b.clock; b.bloomFor[i] = first;    // the hinge blooms red-white until it fires
      for (let s = 0; s < n; s++) b.later(first + s * gap, () => {
        if (w.hp <= 0) return;
        const lead = 0.3, tx = clamp(api.ship.x + api.ship.vx * lead, -api.box.x, api.box.x), ty = clamp(api.ship.y + api.ship.vy * lead, -api.box.y, api.box.y);
        api.fire({ x: w.ent.x, y: w.ent.y, z: w.ent.z }, tx, ty, { T: o.T || 1.4, owner: b });
        b.kick[i] = 1;
      });
    });
  };
}
// the beam: the sides it covers, in order (left, right, top, bottom, ...)
const BEAM_DIRS = [Math.PI, 0, Math.PI / 2, -Math.PI / 2];
function greatBeam(o) {
  return (b, api) => {
    const dir = BEAM_DIRS[(b.beams = (b.beams || 0) + 1) % BEAM_DIRS.length === 0 ? 0 : (b.beams - 1) % BEAM_DIRS.length];
    const tel = o.tel ?? 1.3, on = o.on ?? 1.5;
    b.beam = { dir, t: 0, tel, on };
    // the pupil, in the world
    tmpV.set(0, 0, EYE_R + 0.2); b.root.localToWorld(tmpV);
    api.spawn({ type: 'l10-beam', dir, cover: o.cover ?? 1.2, tel, on, from: { x: tmpV.x, y: tmpV.y, z: tmpV.z } }, tmpV.z);
    if (!b.beamTaught) { b.beamTaught = true; api.game.call('THE BEAM CANNOT BE SENT BACK: MOVE!', 'c-red'); }
  };
}
// the piston wall: its gap goes round the lane in a fixed order
const GAPS = [[0.55, 0.45], [-0.55, -0.45], [-0.55, 0.45], [0.55, -0.45], [0, 0]];
function pistonWall(o) {
  return (b, api) => {
    const g = GAPS[(b.walls = (b.walls || 0) + 1) % GAPS.length];
    api.spawn({ type: 'l10-wall', gnx: g[0], gny: g[1], gw: o.gw || 4.6, gh: o.gh || 3.9, T: o.T || 1.9, z0: b.z - 45 }, b.z - 45); // out from behind the eye
    b.socketKick = 1;
    api.game.sfx('boom', { rate: 0.5, vol: 0.6 });
  };
}

// beacon-energy: what a struck hinge spills (shield and points; level 10's l10-energy). It streams at you from the Heart.
function spill(b, api, n, fromW) {
  for (let k = 0; k < n; k++) {
    const nx = clamp((fromW ? Math.sign(fromW.ent.x) * 0.45 : 0) + (Math.random() - 0.5) * 0.8, -0.75, 0.75), ny = clamp((fromW ? Math.sign(fromW.ent.y) * 0.35 : 0) + (Math.random() - 0.5) * 0.7, -0.7, 0.7);
    api.spawn({ type: 'l10-energy', nx, ny }, b.z - 40 - k * 18); // out of the Heart from behind its eye, beyond 150 m
  }
}
export default defineBoss({
  name: 'lattice-heart', title: 'THE LATTICE HEART',
  hold: 125, y: 0.4, scale: SCALE, enterTime: 7.4, escapeAfter: 105, defeatTime: 3.4,
  escapeCall: 'IT IS TEARING ITSELF APART: RUN!',
  bonus: 100000, hitPts: 3000, pointDown: 'HINGE DOWN!', downCall: 'THE HEART IS BREAKING!',
  build(api, b) {
    const root = new THREE.Group(), inner = new THREE.Group();
    inner.rotation.y = Math.PI; root.add(inner); // her front is -Z; the ship is at +Z of the boss
    inner.add(buildModel(MESH.socket).group);
    const eye = buildModel(MESH.eye, { own: ['#fff4ff*', '#140408*', '#ff4fd8*'] });
    inner.add(eye.group);
    const meshOf = (key) => eye.group.getObjectsByProperty('isMesh', true).find((m) => m.material === eye.mats[key]);
    const pupil = meshOf('#140408*'), pring = meshOf('#ff4fd8*');
    const plates = [], hinges = [];
    for (let i = 0; i < N; i++) {
      const piv = new THREE.Group(); piv.rotation.order = 'ZYX';
      piv.add(buildModel(PLATE).group);
      const h = buildModel(HINGE, { own: ['#ff3355*'] }); piv.add(h.group);
      inner.add(piv); plates.push(piv); hinges.push(h.mats['#ff3355*']);
    }
    const tell = tellRing(); tell.position.z = EYE_R + 0.6; root.add(tell);
    const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xfff0ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6, fog: false }));
    glare.scale.setScalar(34); glare.position.z = 2; root.add(glare);
    Object.assign(b, { inner, eyeMat: eye.mats['#fff4ff*'], pupil, pring, plates, hinges, tell, glare,
      open: new Array(N).fill(0), openUntil: new Array(N).fill(-1), bloomAt: new Array(N).fill(-9), bloomFor: new Array(N).fill(0),
      kick: new Array(N).fill(0), loose: new Array(N).fill(0), clock: 0, socketKick: 0, crack: 0 });
    placePlates(b);
    const weak = [];
    for (let i = 0; i < N; i++) weak.push({ at: hingeAt(b, i, [0, 0, 0]), r: 2.4, hp: 3 });
    return { root, weak, muzzles: weak.map((w) => w.at.slice()) };
  },
  // rule 25: a hinge glows and can be hurt only while its plate is open
  exposed(b, w) { return b.open[w.i] > 0.55; },
  phases: [
    { name: 'THE EYE OPENS', until: 0.67, loop: 4 * BAR,
      pattern: [{ at: 0, tel: 0, attack: volley({ k: 2, shots: 2 }) }, { at: 2 * BAR, tel: 0, attack: volley({ k: 2, shots: 2 }) }, { at: 3.5 * BAR, tel: 0, attack: (b, api) => spill(b, api, 1) }] },
    { name: 'THE GREAT BEAM', until: 0.25, loop: 4 * BAR, enter(b, api) { api.game.sfx('boss-phase', { vol: 0.8 }); },
      pattern: [{ at: 0, tel: 0, attack: volley({ k: 2, shots: 2 }) }, { at: 2 * BAR, tel: 0, attack: greatBeam({}) }, { at: 1.5 * BAR, tel: 0, attack: (b, api) => spill(b, api, 1) }] },
    { name: 'THE LAST PLATES', loop: 4 * BAR, enter(b, api) { api.game.sfx('boss-phase', { vol: 0.8 }); },
      pattern: [{ at: 0, tel: 0, attack: pistonWall({}) }, { at: BAR, tel: 0, attack: volley({ k: 2, shots: 3, gap: BEAT / 4 }) }, { at: 3.5 * BAR, tel: 0, attack: (b, api) => spill(b, api, 1) }] },
  ],
  update(b, dt, api) {
    b.clock += dt;
    // plates: open toward their target, quickly; a dead one hangs loose and droops
    for (let i = 0; i < N; i++) {
      const want = b.state === 'dying' ? 1.6 : b.clock < b.openUntil[i] ? 1 : 0.06 + 0.04 * Math.sin(b.clock * 1.3 + i);
      b.open[i] += (want - b.open[i]) * Math.min(1, dt * (want > b.open[i] ? 7 : 3));
      b.kick[i] = Math.max(0, b.kick[i] - dt * 5);
      if (b.weak[i] && b.weak[i].hp <= 0) b.loose[i] = Math.min(1, b.loose[i] + dt * 0.8);
      // the hinge: red, blooming white-hot through its tell, dark once dead
      const w = b.weak[i];
      if (w && w.hp <= 0) b.hinges[i].color.setHex(DEAD);
      else {
        const into = b.clock - b.bloomAt[i], k = into >= 0 && into < b.bloomFor[i] ? into / b.bloomFor[i] : 0;
        const pk = k > 0 ? k * (0.6 + 0.4 * Math.sin(into * 30)) : b.kick[i];
        b.hinges[i].color.setRGB(1, 0.2 + 0.75 * pk, 0.33 + 0.6 * pk);
      }
    }
    placePlates(b);
    for (const w of b.weak) { hingeAt(b, w.i, w.at); if (w.lastHp !== undefined && w.hp < w.lastHp && b.state === 'fight') { if (w.hp > 0) spill(b, api, 1, w); b.fightT = Math.max(0, b.fightT - 4.5); api.game.sfx('boss-hit', { vol: 0.9 }); } w.lastHp = w.hp; }
    // the eye: it watches you; the pupil shrinks for the beam; the white goes whiter as it breaks
    b.socketKick = Math.max(0, b.socketKick - dt * 3);
    const look = 0.06;
    b.pupil.position.set(-api.ship.x * look, api.ship.y * look, 0); b.pring.position.copy(b.pupil.position);
    let pupil = 1;
    if (b.beam) {
      const be = b.beam; be.t += dt;
      const k = clamp(be.t / be.tel, 0, 1);
      pupil = be.t < be.tel ? 1 - 0.85 * k : be.t < be.tel + be.on ? 0.15 : 0.15 + 0.85 * clamp((be.t - be.tel - be.on) / 0.6, 0, 1);
      // the magenta ring grows out of the pupil, thick on the covered side (its hole sits toward the safe side)
      b.tell.material.opacity = be.t < be.tel ? 0.35 + 0.65 * k : be.t < be.tel + be.on ? 0.9 : Math.max(0, 0.9 - (be.t - be.tel - be.on) * 2);
      b.tell.scale.setScalar(2 + 5.5 * k);
      b.tell.rotation.z = be.dir + Math.PI;    // the hole (offset to local -x) points away from the beam
      if (be.t > be.tel + be.on + 0.6) { b.beam = null; b.tell.material.opacity = 0; }
    }
    b.pupil.scale.set(pupil, pupil, 1); b.pring.scale.set(0.3 + 0.7 * pupil, 0.3 + 0.7 * pupil, 1);
    const heat = b.state === 'dying' ? 1 : 1 - b.hp();
    b.eyeMat.color.setRGB(1, 0.92 + 0.08 * heat, 0.97 + 0.03 * heat);
    b.glare.material.opacity = 0.45 + 0.25 * heat + (b.beam && b.beam.t > b.beam.tel && b.beam.t < b.beam.tel + b.beam.on ? 0.4 : 0) + 0.06 * Math.sin(b.clock * 4);
    b.inner.position.z = -b.socketKick * 1.2;
    // a slow turn and breath, so it is a living thing
    b.inner.rotation.z = Math.sin(b.clock * 0.21) * 0.08;
    if (b.state === 'dying') {
      b.crack += dt;
      b.inner.rotation.z += (Math.random() - 0.5) * 0.04;
      b.pupil.scale.setScalar(Math.max(0.01, 1 - b.crack));
      if (Math.random() < dt * 8) api.game.shake(0.5);
    }
  },
  onWeakDown(b, w, api) { spill(b, api, 3, w); api.game.shake(0.9); api.game.burst(w.ent.x, w.ent.y, w.ent.z, 60, { speed: 20, life: 0.8, s0: 2.2, r: 1, g: 0.7, b: 0.4, carry: 0, drag: 1.4 }); },
  enter(b, api) { api.game.sfx('boss-warning', { vol: 0.9 }); },
  defeat(b, api) { api.game.flash(); b.openUntil.fill(1e9); api.game.sfx('boss-defeat', { vol: 1 }); api.game.sfx('boom', { rate: 0.4, vol: 1 }); },
});

// her heartShell, live: each plate at its angle, slid out by how open it is, drooping once dead
function placePlates(b) {
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2 + Math.PI / 8, o = b.open[i], r = PLATE_R - 3.0 + o * 4.0, piv = b.plates[i];
    piv.position.set(Math.cos(a) * r, Math.sin(a) * r, -4.5 + o * 1.0 + b.kick[i] * 0.6);
    piv.rotation.set(0.55 + b.loose[i] * 0.7, 0, a - Math.PI / 2 + b.loose[i] * 0.25, 'ZYX');
    piv.updateMatrix();
  }
  b.inner.updateMatrix();
}
// a hinge's position in the boss's own space (the root's local frame), written into `out`
function hingeAt(b, i, out) {
  tmpV.set(0, 3.4, -0.9).applyMatrix4(b.plates[i].matrix).applyMatrix4(b.inner.matrix);
  out[0] = tmpV.x; out[1] = tmpV.y; out[2] = tmpV.z;
  return out;
}
