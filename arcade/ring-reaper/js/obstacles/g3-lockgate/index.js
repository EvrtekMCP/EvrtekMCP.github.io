// THE LOCKGATE and its BYPASS (galaxy 3, level 3, THE LOCKWORKS; the plan's 4.3). Yori's sealed bulkhead
// (art-incoming/yori/g3/g3-enemies.js lockgate, rebuilt here from her exact primitives so the doors can move) across
// the main lane: two steel doors in a graphite frame with a red KEYSTONE octagon on the top beam and, on it, a turret
// (galaxy 1's lantern pod) that fires at you.
//  - KEYED FIRE: roll the turret's bolt home and it flies to the KEYSTONE, not the turret. Every keystone lit, and the
//    doors burst open (KEYED!): the rings behind them are yours (they count; they are what ★4 and ★5 ask for here).
//  - THE BYPASS: miss, and the way is her bypass duct (bypassDuct), a tight square tube at the lane's edge (at the
//    bottom on a tall screen), with sparks on its ribs, CLOSE points off its walls and a few cache rings. It is always
//    open: there is never a fully blocked moment.
//  - DOUBLE LOCKS: `keys: 2`, two keystones and two turrets firing together; one roll sends both home.
//  - THE GREAT LOCK: `great: true`, five keys and one volley that has to go home whole.
// A keyed WEAVE (a shuttler's bolt with key: this gate's id) goes to the keystones too. Rings the level lays with
// `lockOf: id` (behind the doors) or `ductOf: id` (through the duct) are put in place by the gate, for the screen it is on.
//   add(d, 'g3-lockgate', { id: 'g1', keys: 1, fire: [3.6], wide: 0, side: 1, dy: 0, duct: 110, great: false, turret: true })
//     turret: false for a gate keyed only by a shuttler's weave (no turret of its own)
//     fire: seconds out each volley leaves (each telegraphs 0.75 s first); wide: how many of the first volleys aim wide
import { THREE, defineObstacle, defineDecor, buildModel, clamp, smoothstep } from '../../api.js?v=0.6.0';
import { MESH } from './mesh.js?v=0.6.0';
import { MESH as DUCT } from './duct.js?v=0.6.0';

const D = 3.6;                 // the duct's inside, metres (her 5 across, scaled): tight, but a person's line fits it
const SHIP_IN = 0.5;           // the ship's radius against walls (rule 14: the walls favour you)
const SEG = 7.2;               // one of her duct sections, scaled (12 long at 0.6)
const TEL = 0.75, BOLT_T = 1.3;
const DEAD = 0x2a2730, RED = 0xff3355;
const tmpV = new THREE.Vector3();

// the keystone a sent-back shot flies to: a plain target the course's homing understands
const KEY = { name: 'g3-keystone', role: 'weakpoint', onShot(t, s, api) { keyHit(t.gate, t, api); } };

// the gate's layout for the box it is born in: the door opening (main), the duct, the frame's transform
function layout(ev, B) {
  const s = ev.side ?? 1, tall = B.y > B.x * 1.05;
  const L = { tall, s };
  if (!tall) {
    L.dcx = s * (B.x - D / 2 + 0.15); L.dcy = clamp((ev.dy || 0) * B.y, -B.y + D / 2, B.y - D / 2);
    const inner = s > 0 ? L.dcx - D / 2 : -(L.dcx + D / 2); // distance from the centre line to the duct's inner wall
    const Wm = (inner + 1.02 * B.x) / (1 + 1.6 / 26);
    L.sx = Wm / 26; L.sy = 2.06 * B.y / 16;
    const near = inner - 1.6 * L.sx; // the door opening's edge beside the duct's post
    L.mx0 = s > 0 ? -1.02 * B.x : -near; L.mx1 = s > 0 ? near : 1.02 * B.x; L.my0 = -1.03 * B.y; L.my1 = 1.03 * B.y;
  } else {
    L.dcx = s * Math.min(B.x - D / 2 + 0.15, B.x * 0.45); L.dcy = -B.y + D / 2 - 0.15;
    const Hm = (1.03 * B.y - (L.dcy + D / 2)) / (1 + 1.6 / 16);
    L.sx = 2.04 * B.x / 26; L.sy = Hm / 16;
    L.mx0 = -1.02 * B.x; L.mx1 = 1.02 * B.x; L.my1 = 1.03 * B.y; L.my0 = L.my1 - Hm;
  }
  L.sz = Math.min(L.sx, L.sy);
  L.cx = (L.mx0 + L.mx1) / 2; L.cy = (L.my0 + L.my1) / 2;
  return L;
}
const inRect = (x, y, x0, x1, y0, y1, m) => x > x0 + m && x < x1 - m && y > y0 + m && y < y1 - m;

function make(api) {
  // her lockgate faces -Z; the ship meets its +z side, so the frame and doors are turned half round to face you
  const root = new THREE.Group(), frame = new THREE.Group(); frame.rotation.y = Math.PI; root.add(frame);
  for (const k of ['postL', 'postR', 'beamT', 'beamB', 'outline']) frame.add(buildModel(MESH[k]).group);
  const door = (side) => { const g = new THREE.Group(), m = buildModel(MESH[side === 1 ? 'doorR' : 'doorL'], { own: ['#ff3355*'] }); g.add(m.group);
    for (const k of ['0', '1', '2']) g.add(buildModel(MESH[(side === 1 ? 'studR' : 'studL') + k]).group);
    g.add(buildModel(MESH[side === 1 ? 'braceR' : 'braceL']).group); g.userData.edge = m.mats['#ff3355*']; frame.add(g); return g; };
  const doors = [door(-1), door(1)];
  const keys = [];
  for (let i = 0; i < 5; i++) {
    const collar = buildModel(MESH.collar).group, ks = buildModel(MESH.keystone, { own: ['#ff3355*'] });
    collar.rotation.y = Math.PI; ks.group.rotation.y = Math.PI;
    const pod = new THREE.Group(), inner = new THREE.Group(); inner.rotation.y = Math.PI; pod.add(inner);
    const pm = buildModel('pod', { own: ['#ff3355*'] }); inner.add(pm.group);
    const charge = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: RED, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    charge.position.z = 1.2; pod.add(charge);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: RED, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5 }));
    root.add(collar, ks.group, pod, glow);
    keys.push({ collar, ks: ks.group, ksMat: ks.mats['#ff3355*'], pod, podCore: pm.mats['#ff3355*'], podRing: pm.parts.ring, charge, glow });
  }
  const fills = [0, 1, 2].map(() => { const g = buildModel(MESH.fill).group; root.add(g); return g; });
  const duct = [];
  for (let i = 0; i < 12; i++) { const g = buildModel(DUCT.duct).group; root.add(g); duct.push(g); }
  // the duct's mouth, outlined in her blueprint white: the way through, readable from the haze
  const mouth = buildModel(MESH.ductMouth).group; root.add(mouth);
  root.userData = { frame, doors, keys, fills, duct, mouth };
  return root;
}

export default defineObstacle({
  name: 'g3-lockgate',
  hazard: { cls: 'static', introduced: [3, 3] },
  sample: { id: 'warm', keys: 2, fire: [] },
  spawn(e, ev, api) {
    const B = api.box, Lg = layout(ev, B);
    e.obj = api.course.get('g3-lockgate', () => make(api));
    e.L = Lg; e.x = 0; e.y = 0; e.sx = e.sy = e.sz = 1;
    e.great = !!ev.great;
    const n = clamp(ev.keys || (e.great ? 5 : 1), 1, 5);
    e.fire = (ev.fire || [3.6]).slice().sort((a, b) => b - a); e.fi = 0; e.wide = ev.wide || 0;
    e.ductLen = ev.duct || 110; e.open = 0; e.keyed = false; e.region = null; e.scrapes = 0; e.scrapeT = 0; e.pending = 0;
    e.placed = new Set(); e.shots = []; e.tel = -1;
    e.pendingShots = () => e.shots.some((s) => s.alive && !s.reflected);
    const ud = e.obj.userData;
    // the frame, scaled to the door opening; the doors closed
    ud.frame.position.set(Lg.cx, Lg.cy, 0); ud.frame.scale.set(Lg.sx, Lg.sy, Lg.sz);
    ud.doors[0].position.set(-6.5, 0, 0); ud.doors[1].position.set(6.5, 0, 0);
    for (const d of ud.doors) d.userData.edge.color.setHex(RED);
    // keystones along the top beam, a turret on each
    const ks = Math.max(0.62, Math.min(Lg.sx, Lg.sy) * 1.5), span = Math.min(22, 5 * (n - 1));
    e.keys = [];
    ud.keys.forEach((k, i) => {
      const on = i < n; k.collar.visible = k.ks.visible = k.glow.visible = on; k.pod.visible = on && ev.turret !== false; if (!on) return;
      const fx = n > 1 ? -span / 2 + span * i / (n - 1) : 0, x = Lg.cx + fx * Lg.sx, y = Lg.my1 + 0.8 * Lg.sy;
      k.ks.position.set(x, y, 1.65 * Lg.sz + 0.05); k.ks.scale.setScalar(ks);
      k.collar.position.set(x, y - 8.8 * ks, 1.3 * Lg.sz - 1.3 * ks); k.collar.scale.setScalar(ks);
      k.pod.position.set(x, y - 0.25, 1.5); k.pod.scale.setScalar(1.05);
      k.glow.position.set(x, y, 1.2 * Lg.sz + 0.4); k.glow.scale.setScalar(ks * 3.2); k.glow.material.opacity = 0.5;
      k.ksMat.color.setHex(RED); k.podCore.color.setHex(RED); k.charge.material.opacity = 0;
      e.keys.push({ x, y, z: 0, lx: x, ly: y, alive: true, dead: false, r: 1.2, hitR: 1.5, kind: KEY, gate: e, i, done: false, tel: -1, pod: k });
    });
    // the duct column's fill (landscape: above and below the duct, and past it; tall: either side of it)
    const F = ud.fills, W = 1.45 * B.x, H = 1.45 * B.y;
    const put = (g, x0, x1, y0, y1) => { g.visible = x1 > x0 && y1 > y0; g.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); g.scale.set(Math.max(0.01, x1 - x0), Math.max(0.01, y1 - y0), Lg.sz * 1.4); };
    if (!Lg.tall) {
      const a = Lg.s > 0 ? Lg.dcx - D / 2 - 0.1 : Lg.dcx + D / 2 + 0.1, b = Lg.s > 0 ? W : -W;
      put(F[0], Math.min(a, b), Math.max(a, b), Lg.dcy + D / 2 + 0.25, H); put(F[1], Math.min(a, b), Math.max(a, b), -H, Lg.dcy - D / 2 - 0.25);
      const c = Lg.s > 0 ? Lg.dcx + D / 2 + 0.25 : -W, d2 = Lg.s > 0 ? W : Lg.dcx - D / 2 - 0.25; put(F[2], c, d2, Lg.dcy - D / 2 - 0.25, Lg.dcy + D / 2 + 0.25);
    } else {
      const top = Lg.dcy + D / 2 + 0.1;
      put(F[0], -W, Lg.dcx - D / 2 - 0.25, -H, top); put(F[1], Lg.dcx + D / 2 + 0.25, W, -H, top); put(F[2], Lg.dcx - D / 2 - 0.25, Lg.dcx + D / 2 + 0.25, -H, Lg.dcy - D / 2 - 0.25);
    }
    // her duct, section after section from just before the doors to the far end
    const nSeg = Math.min(ud.duct.length, Math.ceil((e.ductLen + 8) / SEG)), k = D / 5 + 0.02;
    ud.duct.forEach((g, i) => { g.visible = i < nSeg; g.position.set(Lg.dcx, Lg.dcy, 8 - SEG * (i + 0.5)); g.scale.set(k, k, SEG / 12); });
    ud.mouth.position.set(Lg.dcx, Lg.dcy, 8.05); ud.mouth.scale.set((D + 0.2) / 5.2, (D + 0.2) / 5.2, 1);
  },
  update(e, dt, api) {
    const ud = e.obj.userData, ship = api.ship, Lg = e.L, v = Math.max(1, api.v), tArr = -e.z / v, G = api.game;
    e.v = v;
    api.pose(e);
    // the turrets: each volley telegraphs, then every live key's turret fires at you together
    const due = e.fire[e.fi];
    if (due !== undefined && !e.keyed && tArr < due + TEL && e.z < -30) {
      if (e.tel === undefined || e.tel < 0) { e.tel = 0; G.telegraph(e); G.sfx('fire', { rate: 0.6, vol: 0.45 }); }
    }
    if (e.tel >= 0) {
      e.tel += dt; const q = Math.min(1, e.tel / TEL);
      for (const K of e.keys) if (!K.done) { K.pod.podCore.color.setRGB(1, 0.2 + 0.7 * q, 0.33 + 0.6 * q); K.pod.charge.material.opacity = q * (0.6 + 0.4 * Math.sin(e.tel * 40)); K.pod.charge.scale.setScalar(1 + q * 4); }
      if (e.tel >= TEL) { e.tel = -1; volley(e, api, e.fi < e.wide); e.fi++; for (const K of e.keys) { K.pod.podCore.color.setHex(K.done ? DEAD : RED); K.pod.charge.material.opacity = 0; } }
    }
    // keystones follow the gate; each glows while it is still to key
    for (const K of e.keys) {
      tmpV.set(K.lx, K.ly, 1.4).multiplyScalar(e.appear); K.x = tmpV.x; K.y = tmpV.y; K.z = e.z + tmpV.z;
      K.pod.pod.lookAt(ship.x, ship.y, 8 - e.z); K.pod.podRing.rotation.y += dt * 1.6;
      K.pod.glow.material.opacity = K.done ? 0 : 0.45 + 0.25 * Math.sin(api.time * 6 + K.i);
    }
    // weld sparks spit from the duct's mouth as it comes, while the doors are shut: this way, if the key is missed
    if (!e.keyed && e.z < -20 && e.z > -320 && api.tier > 0 && Math.random() < dt * 22) { const a = e.appear, m = Math.random() < 0.5 ? -1 : 1;
      G.emit((Lg.dcx + m * (D / 2) * (Math.random() < 0.5 ? 1 : Math.random() * 2 - 1)) * a, (Lg.dcy + (D / 2) * (Math.random() * 2 - 1)) * a, e.z + 8, { life: 0.5, s0: 0.6, s1: 0.1, r: 1, g: 0.29, b: 0.85, a: 0.95, vx: (Math.random() - 0.5) * 5, vy: Math.random() * 4 - 1, vz: 6, carry: 1 }); }
    // the doors burst apart once every key is home
    if (e.keyed && e.open < 1) {
      e.open = Math.min(1, e.open + dt / 0.35); const o = smoothstep(0, 1, e.open);
      ud.doors[0].position.x = -6.5 - o * 13; ud.doors[1].position.x = 6.5 + o * 13;
    }
    // ring placement: the gate puts its lock rings behind the doors and its duct rings through the duct
    if (e.z < 0) for (const r of api.course.list) {
      if (!r.ev || e.placed.has(r) || !r.kind.countsAsRing) continue;
      if (r.ev.lockOf === e.ev.id) { const n = r.ev.of || 6, i = r.ev.i || 0, t = n > 1 ? i / (n - 1) : 0.5; r.x = Lg.cx + (t - 0.5) * (Lg.mx1 - Lg.mx0) * 0.35; r.y = Lg.cy + Math.sin(t * Math.PI * 2) * (Lg.my1 - Lg.my0) * 0.18; e.placed.add(r); }
      else if (r.ev.ductOf === e.ev.id) { r.x = Lg.dcx; r.y = Lg.dcy; e.placed.add(r); }
    }
    // the moment the doors reach you: the duct, the open doors, or a crash into the bulkhead
    if (e.crossed && e.region === null) {
      const x = ship.x, y = ship.y;
      if (inRect(x, y, Lg.dcx - D / 2, Lg.dcx + D / 2, Lg.dcy - D / 2, Lg.dcy + D / 2, SHIP_IN)) { e.region = 'duct'; G.call('BYPASS', 'c-red'); }
      else if (e.keyed && inRect(x, y, Lg.mx0, Lg.mx1, Lg.my0, Lg.my1, SHIP_IN)) e.region = 'main';
      else { e.region = 'hit'; G.crash({ x, y, z: 0, type: 'g3-lockgate', id: e.id }, 18, false); }
    }
    // in the duct (the plan: "scrapes, sparks, CLOSE points"): brushing its walls is a CLOSE call with sparks, never a
    // hit; only flying out through a wall hurts (that is what keeps the lock rings behind the doors for the keyed)
    if (e.region && e.z >= 0 && e.z <= e.ductLen) {
      const ox = Math.abs(ship.x - Lg.dcx), oy = Math.abs(ship.y - Lg.dcy), wall = D / 2 - SHIP_IN, off = Math.max(ox, oy), inside = off < D / 2 - 0.3;
      e.scrapeT -= dt;
      if (e.region === 'duct') {
        const near = wall - off;
        if (off > D / 2 + 0.25 && e.scrapeT <= 0) { e.scrapeT = 0.6; G.crash({ x: ship.x, y: ship.y, z: 0, type: 'g3-duct', id: e.id + ':w' + Math.floor(e.z) }, 8, true); }
        else if (near < 0.45 && e.scrapeT <= 0 && e.scrapes < 4) { e.scrapeT = 0.35; e.scrapes++; G.scrape(e, Math.max(0, near)); G.sfx('g3-scrape', { vol: 0.6, gap: 0.2 }); }
        if (api.tier > 0 && Math.random() < dt * 14) G.emit(Lg.dcx + (Math.random() - 0.5) * D, Lg.dcy + (Math.random() < 0.5 ? -1 : 1) * D * 0.48, -2 - Math.random() * 6, { life: 0.35, s0: 0.45, s1: 0.05, r: 1, g: 0.3, b: 0.85, a: 0.9, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, carry: 1 });
      } else if (e.region === 'main' && inside && e.scrapeT <= 0) { e.scrapeT = 0.5; G.crash({ x: ship.x, y: ship.y, z: 0, type: 'g3-duct', id: e.id + ':o' + Math.floor(e.z) }, 8, true); }
    }
    if (e.z > e.ductLen + 14) e.alive = false;
  },
  // the blocked-moment check (0.3.1's), at its plane: the frame and the fill are solid everywhere but the door opening
  // and the duct; the doors are open or shut, so they are a live item (the check takes them shut, the worst case). The
  // duct, 3.6 m inside, is the way that is always there.
  solid(ev, B) {
    const Lg = layout(ev, B), main = [Lg.mx0, Lg.mx1, Lg.my0, Lg.my1], duct = [Lg.dcx - D / 2, Lg.dcx + D / 2, Lg.dcy - D / 2, Lg.dcy + D / 2];
    const inside = (r, x, y) => x > r[0] && x < r[1] && y > r[2] && y < r[3];
    const depth = (r, x, y) => Math.min(x - r[0], r[1] - x, y - r[2], r[3] - y);
    const away = (r, x, y) => Math.hypot(Math.max(r[0] - x, 0, x - r[1]), Math.max(r[2] - y, 0, y - r[3]));
    return [
      { at: 0, dist: (x, y) => (inside(main, x, y) ? depth(main, x, y) : inside(duct, x, y) ? depth(duct, x, y) : -Math.min(away(main, x, y), away(duct, x, y))) },
      { at: 0, live: true, dist: (x, y) => (inside(main, x, y) ? -depth(main, x, y) : away(main, x, y)) },
    ];
  },
  // gone past: its keystones stop being targets (a bolt still on its way home fizzles out), and the gate goes back in the pool
  remove(e, api) { for (const K of e.keys || []) { K.alive = false; K.dead = true; } if (e.obj) api.course.put('g3-lockgate', e.obj); },
  // a sent-back shot of this gate's (its turrets', or a keyed weave's) goes to a keystone still to key
  redirect(e, s, api) {
    let best = null, bd = 1e9;
    for (const K of e.keys) if (!K.done && !K.claimed) { const d = s ? Math.hypot(K.x - s.x, K.y - s.y) : 0; if (d < bd) { bd = d; best = K; } }
    if (best) { best.claimed = true; return best; }
    return null;
  },
  // the bots: once the keys are decided, the duct if it is shut, and keep out of the duct if it is open
  avoid(e) {
    // the keys are decided by ~1.6 s out (a volley leaves 3.6 s out and its bolts come home 2 s later); from 1.15 s out a
    // gate still shut means the duct
    if (e.region === 'duct' || (e.region === null && !e.keyed && e.fi >= e.fire.length && !e.pendingShots() && -e.z < (e.v || 100) * 1.15)) {
      const R = 1000, m = 0.2, Lg = e.L;
      return [{ x: Lg.dcx - m - R, y: Lg.dcy, r: R }, { x: Lg.dcx + m + R, y: Lg.dcy, r: R }, { x: Lg.dcx, y: Lg.dcy - m - R, r: R }, { x: Lg.dcx, y: Lg.dcy + m + R, r: R }];
    }
    if (e.keyed || e.region === 'main') return [{ x: e.L.dcx, y: e.L.dcy, r: D / 2 + 1.2 }];
    return [];
  },
});

// one volley: every turret whose key is still lit fires at you (wide: past you, so you watch it miss the key)
function volley(e, api, wide) {
  const ship = api.ship, B = api.box, live = e.keys.filter((K) => !K.done), n = live.length;
  const tx0 = clamp(ship.x + ship.vx * 0.3, -B.x, B.x), ty0 = clamp(ship.y + ship.vy * 0.3, -B.y, B.y);
  live.forEach((K, j) => {
    // a double lock's pair lands either side of you, inside one roll's reach; the great lock's volley rings you
    let ox = 0, oy = 0;
    if (n === 2) ox = (j ? 1 : -1) * 1.0;
    else if (n > 2) { const a = j / n * Math.PI * 2; ox = Math.cos(a) * 1.1; oy = Math.sin(a) * 0.9; }
    if (wide) { ox += tx0 > 0 ? -3.6 : 3.6; oy += 1.4; }
    const from = { x: K.x, y: K.y - 0.25, z: e.z + 1.5 };
    const s = api.fire(from, clamp(tx0 + ox, -B.x * 1.1, B.x * 1.1), clamp(ty0 + oy, -B.y * 1.1, B.y * 1.1), { T: BOLT_T + j * 0.04, owner: e });
    e.shots.push(s);
  });
}

function keyHit(e, K, api) {
  if (!e.alive || K.done) return;
  K.done = true; K.pod.ksMat.color.setHex(DEAD); K.pod.podCore.color.setHex(DEAD); K.pod.glow.material.opacity = 0;
  api.game.burst(K.x, K.y, K.z, 30, { speed: 12, life: 0.5, s0: 1.2, r: 0.4, g: 0.9, b: 1, carry: 1, drag: 2 });
  api.game.score(900, K.x, K.y + 1.4, K.z, 'cyan', 'KEY');
  if (e.keys.every((q) => q.done)) {
    e.keyed = true;
    for (const d of e.obj.userData.doors) d.userData.edge.color.setHex(DEAD);
    api.game.call('KEYED!', 'c-cyan');
    api.game.sfx('g3-keyed', { vol: 0.9 }); api.game.shake(0.35); api.game.greed(10);
    api.game.burst(e.L.cx, e.L.cy, e.z, 90, { speed: 26, life: 0.7, s0: 2, r: 1, g: 0.85, b: 0.5, carry: 1, drag: 1.6 });
  }
}

// THE DUCT'S FAR END: nothing to see (the duct is drawn by its gate); it carries the gate's advice to the test pilots
// while the ship is inside the duct, because a pilot only reads what is still ahead of it and the gate is behind by then.
//   add(gateD + duct - 4, 'g3-lockgate-exit', { of: id })    (the level's gate helper lays it with every gate)
export const ductExit = defineDecor({
  name: 'g3-lockgate-exit',
  hazard: null,
  noWarm: true,
  spawn(e, ev, api) { e.gate = null; e.of = ev.of; },
  update(e, dt, api) {
    if (!e.gate) e.gate = api.course.list.find((q) => q.alive && q.type === 'g3-lockgate' && q.ev.id === e.of) || null;
    if (e.z > 12) e.alive = false;
  },
  avoid(e) { const g = e.gate; return g && g.alive && g.region ? (g.kind.avoid(g) || []) : []; },
});
