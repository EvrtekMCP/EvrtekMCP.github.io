// THE SNARE (galaxy 2, THE TANGLE's boss): a vast grafted hunter, an eel-wolf in red-seamed armour (Yori's snare:
// a head 7 long and eight segments on a 3.2 pitch, chained here along the path it swims), circling the MOTHER whale
// who swims beside your lane, big and slow. IT STRIKES AT HER, NOT AT YOU: you defend a third party, which no galaxy 1
// boss asks. Every point of damage is its own fire sent home into a graft node on its flank.
//  - It circles her: up the right of the lane, high across in front of her head, down her far side, low back across
//    and in again to its strike station beside your lane on the right, where it turns its flank to strike. Its flank
//    nodes are lit only while it is turned to strike (rule 25).
//  1. THE CIRCLE: from its station it fires slow volleys at her across your lane: intercept them (level 4's lesson) and
//     they go home into a lit node. Every third volley comes at you.
//  2. THE BINDING: tethers, two at a time, latch from its mouth onto her and cross your lane: fly through one and roll
//     to snap it (level 6's lesson); the whip-back hits the Snare. A tether left on 3 s lets it FEED: one node grows
//     back, so the fight runs a little longer. It is never a fail.
//  3. THE LUNGE (the shortest): it breaks off and comes for you: a fan, a tether at you, its whole flank lit.
// FREED: the graft burns out, armour and nodes gone, and a silver star-eel flees into the dark. The mother sings and the
// herd turns for home. MOTHER SAFE if no tether held her for long. (0.6.0, Evrtek 11-10: no level has a timer. It no longer leaves on a clock; the fight ends when it is beaten.)
// Music: audio/g2/bosses/snare, 140 bpm, B minor (the level's key); the circle is four bars, the binding six.
import { THREE, defineBoss, buildModel, clamp, damp, SPAWN_D } from '../../api.js?v=0.6.1';
import { MESH } from './mesh.js?v=0.6.1';

const BAR = 240 / 140.003;
export const SNARE = { hold: 40, segs: 8, nodes: 8, nose: 5.4, L1: 4 * BAR, D1: 3.4, L2: 6 * BAR, D2: 5.4, cycle3: 2 * BAR, safe: 4, grace: 0.9 };
// (the strike lasts long enough for its own volley to come home: bolts leave 0.9 s in and take 1.8 s; after it breaks
// off its nodes stay lit a moment longer (grace), so an intercept made late in the bolt's flight still lands)
const NOSE = new THREE.Vector3(0, 0, -1), RED = new THREE.Color(0xff3355), HOT = new THREE.Color(0xfff0f0);
const v3 = new THREE.Vector3(), q3 = new THREE.Quaternion();
// segment i's distance behind the head's middle along its body (her snare(): first segment at 5.9, then 3.2 apart)
const BACK = [...Array.from({ length: SNARE.segs }, (_, i) => 5.9 + i * 3.2), 4.3 + SNARE.segs * 3.2 + 0.6];

// its loop round the mother, in metres beside the lane (scaled to the box): a closed Catmull-Rom curve
function loopOf(B) {
  const X = B.x;
  return [[X + 7, 1, -4], [X + 9, 6, -34], [2, 12, -62], [-X - 14, 8, -52], [-X - 24, 0, -22], [-X - 12, -9, -46], [4, -11, -58], [X + 11, -4, -30]];
}
function cr(P, s) {
  const n = P.length, j = Math.floor(s), t = s - j, a = P[((j - 1) % n + n) % n], b = P[(j % n + n) % n], c = P[((j + 1) % n + n) % n], d = P[((j + 2) % n + n) % n], t2 = t * t, t3 = t2 * t;
  return [0, 1, 2].map((i) => 0.5 * (2 * b[i] + (-a[i] + c[i]) * t + (2 * a[i] - 5 * b[i] + 4 * c[i] - d[i]) * t2 + (-a[i] + 3 * b[i] - 3 * c[i] + d[i]) * t3));
}

function part(root, model, freedModel, own) {
  const g = new THREE.Group(), a = buildModel(model, { own: own || [] }), c = buildModel(freedModel).group;
  c.visible = false; g.add(a.group, c); g.userData = { a: a.group, c, mats: a.mats }; root.add(g);
  return g;
}
// the mother: the herd whale the level brought in, or (a jump straight to the fight) one called in now
function motherOf(api) {
  for (const q of api.course.list) if (q.type === 'g2-whale' && q.alive && q.mother) return q;
  return api.spawn({ type: 'g2-whale', mother: true, side: -1, len: 44, life: Infinity, nx: -1.7, ny: 0.05, z: -12 }, -SPAWN_D);
}

// ---- its attacks
function aimZ(B, m, a) {   // the landing depth that keeps a bolt on your plane over the in-box stretch of its path
  const xm = (B.x + clamp(a.x, -B.x, B.x)) / 2, f = clamp((m.x - xm) / ((m.x - a.x) || 1), 0.2, 1);
  return clamp(m.z + (-0.3 - m.z) / f, -6, 8);
}
function volleyAtHer(b, api) {
  const M = b.mother;
  if (!M || !M.alive) { volleyAtYou(b, api); return; }
  for (let i = 0; i < 2; i++) b.later(i * 0.35, () => {
    const m = Object.assign({}, b.mouth), a = M.kind.flank(M, m.x);
    a.y += i ? -1 : 1; a.z = aimZ(api.box, m, a);
    api.fire(m, 0, 0, { T: 1.8, at: a, owner: b, label: 'INTERCEPT!', tag: 'mother', dmg: 8,
      onArrive: (s) => { if (!s.reflected && M.alive) { M.ouch = 0.7; b.motherHits = (b.motherHits || 0) + 1; } } });
    api.game.sfx('g2-hound-bolt', { rate: 0.8, pan: 0.6 });
  });
}
function volleyAtYou(b, api) {
  const B = api.box, s = api.ship;
  for (let i = 0; i < 2; i++) b.later(i * 0.22, () => api.fire(Object.assign({}, b.mouth), clamp(s.x + s.vx * 0.3, -B.x, B.x), clamp(s.y + s.vy * 0.2, -B.y, B.y), { T: 1.4, owner: b }));
}
function tethersOnHer(b, api) {
  for (const dy of [1.4, -1.4]) b.tethers.push(api.spawn({ type: 'g2-snare-tether', boss: b, to: 'mother', dy, hold: 4.5 }, -5));
}
function release(b) { for (const t of b.tethers) t.released = true; b.tethers.length = 0; }
// the tell: its nose node and seams go white-hot and the muzzle glows, `secs` before the attack
function tell(b, secs) { b.tellAt = b.clock; b.tellLen = secs; }

function startDwell(b, api) {
  const pi = b.pi;
  if (pi === 0) {
    const atYou = b.vol % 3 === 2; b.vol++;
    b.later(0.1, () => tell(b, 0.8)); b.later(0.9, () => (atYou ? volleyAtYou : volleyAtHer)(b, api));
  } else if (pi === 1) {
    b.later(0.2, () => tell(b, 0.7)); b.later(0.9, () => tethersOnHer(b, api));
    b.later(1.9, () => tell(b, 0.7)); b.later(2.6, () => volleyAtHer(b, api));
  }
}
function lungeCycle(b, api) {
  const B = api.box;
  b.later(0.1, () => tell(b, 0.8));
  b.later(0.9, () => { const s = api.ship, n = 5; for (let i = 0; i < n; i++) { const k = i / (n - 1) - 0.5; api.fire(Object.assign({}, b.mouth), clamp(s.x + k * 7, -B.x, B.x), s.y, { T: 1.4, owner: b }); } });
  b.later(1.8, () => tell(b, 0.6));
  b.later(2.4, () => b.tethers.push(api.spawn({ type: 'g2-snare-tether', boss: b, to: 'ship', hold: 3 }, -5)));
}

export default defineBoss({
  name: 'g2-snare', title: 'THE SNARE',
  hold: SNARE.hold, enterTime: 5, scale: 1, y: 0,
  bonus: 60000, hitPts: 2500,
  pointDown: 'GRAFT CRACKED!',   // (FREED! is the engine's default call for a galaxy 2 boss now)
  build(api, b) {
    const root = new THREE.Group();
    const parts = [part(root, MESH.head, MESH.fhead, ['#ff3355*'])];
    for (let i = 0; i < SNARE.segs; i++) parts.push(part(root, MESH['seg' + i], MESH['fseg' + i]));
    parts.push(part(root, MESH.tail, MESH.ftail));
    b.parts = parts;
    // the weak points: the graft nodes on both flanks of the first six segments (the framework lights and hits them)
    const weak = [];
    for (let i = 0; i < SNARE.nodes; i++) for (const s of [-1, 1]) weak.push({ at: [0, 0, 0], r: 1.25, hp: 1, seg: i, side: s, k: 1 - i * 0.07 });   // 16 nodes: the mid-game's long fight
    b.nodeDef = weak;
    // the path state
    const B = api.box;
    b.P = loopOf(B); b.mode = 'travel'; b.pp = 5; b.dw = 0; b.clock = 0; b.vol = 0; b.tethers = []; b.tellAt = -9; b.tellLen = 1;
    const p0 = cr(b.P, b.pp);
    b.head = new THREE.Vector3(p0[0], p0[1], p0[2] + SNARE.hold);   // local to the anchor (0, 0, -hold)
    b.dir = new THREE.Vector3(0, 0, -1); b.hist = [b.head.clone()];
    b.L = SNARE.L1; b.D = SNARE.D1; b.lit = false; b.mouth = { x: 0, y: 0, z: -SNARE.hold };
    b.feed = (a) => { const hurt = (b.weak || []).find((w) => w.counts && w.hp <= 0) || (b.weak || []).find((w) => w.counts && w.hp < w.max); if (hurt) { b.restore(hurt, hurt.hp + 1); a.game.call('IT FEEDS ON HER', 'c-red'); } };
    return { root, weak, muzzles: [[0, 0, -SNARE.nose]] };
  },
  enter(b, api) { b.mother = motherOf(api); },
  exposed(b) { return b.lit; },
  phases: [
    { name: 'THE CIRCLE', until: 0.67, loop: 99, pattern: [], enter(b) { b.L = SNARE.L1; b.D = SNARE.D1; } },
    { name: 'THE BINDING', until: 0.26, loop: 99, pattern: [], enter(b, api) {
      b.L = SNARE.L2; b.D = SNARE.D2;
      // mid-strike when it changes: bind her now, and stay turned to strike a while longer
      if (b.mode === 'dwell') { b.dw = Math.min(b.dw, 0.3); b.later(0.3, () => tell(b, 0.6)); b.later(0.9, () => tethersOnHer(b, api)); b.later(1.9, () => tell(b, 0.6)); b.later(2.5, () => volleyAtHer(b, api)); }
    } },
    { name: 'THE LUNGE', loop: 99, pattern: [], enter(b) { b.mode = 'lunge'; b.lt = SNARE.cycle3 - 1.2; release(b); } },
  ],
  update(b, dt, api) {
    const B = api.box, ship = api.ship;
    b.clock += dt;
    const fight = b.state === 'fight', moving = fight || b.state === 'enter';
    // ---- where its head goes
    let want = null, face = null, rate = 5;
    if (moving && b.mode === 'travel') {
      const pp0 = b.pp;
      b.pp += dt * 8 / Math.max(1, b.L - b.D);
      if (fight && pp0 < 2.6 && b.pp >= 2.6 && (b.loops = (b.loops || 0) + 1) % 2) { tell(b, 0.7); b.later(0.7, () => { const B = api.box, s = api.ship; api.fire(Object.assign({}, b.mouth), clamp(s.x + s.vx * 0.3, -B.x, B.x), clamp(s.y, -B.y, B.y), { T: 1.5, owner: b }); }); }
      if (b.pp >= 8 && fight) { b.pp = 0; b.mode = 'dwell'; b.dw = 0; startDwell(b, api); }
      const p = cr(b.P, b.pp % 8), n = cr(b.P, (b.pp % 8) + 0.05);
      want = v3.set(p[0], p[1], p[2] + SNARE.hold).clone(); face = new THREE.Vector3(n[0] - p[0], n[1] - p[1], n[2] - p[2]);
    } else if (fight && b.mode === 'dwell') {
      b.dw += dt;
      const A = b.P[0];
      want = new THREE.Vector3(A[0], A[1] + Math.sin(b.clock * 2) * 0.4, A[2] + SNARE.hold);
      face = new THREE.Vector3(-1, 0, 0.12);                        // turned across the lane, at her
      if (b.dw >= b.D) { b.mode = 'travel'; b.pp = 0.001; b.offT = 0; release(b); }
    } else if (fight && b.mode === 'lunge') {
      b.lt += dt;
      if (b.lt >= SNARE.cycle3) { b.lt = 0; lungeCycle(b, api); }
      want = new THREE.Vector3(Math.sin(b.clock * 0.9) * B.x * 0.35, 1.5 + Math.sin(b.clock * 1.3) * 0.8, -26 + SNARE.hold);
      face = new THREE.Vector3(0, 0, 1); rate = 2.2;
    } else if (b.state === 'dying') {
      // freed: the silver eel bolts ahead and away into the dark
      want = b.head.clone().add(new THREE.Vector3(b.dir.x * 0.3, 0.5, -1).multiplyScalar(dt * 90)); face = new THREE.Vector3(0, 0.15, -1); rate = 20;
    }
    if (want) { b.head.x = damp(b.head.x, want.x, rate, dt); b.head.y = damp(b.head.y, want.y, rate, dt); b.head.z = damp(b.head.z, want.z, rate, dt); }
    if (face && face.lengthSq() > 1e-6) { face.normalize(); b.dir.lerp(face, Math.min(1, dt * 5)).normalize(); }
    // ---- the body follows the path its head swam (her segments chained along it)
    const last = b.hist[b.hist.length - 1];
    if (last.distanceTo(b.head) > 0.25) { b.hist.push(b.head.clone()); if (b.hist.length > 900) b.hist.shift(); }
    const P = b.parts;
    P[0].position.copy(b.head); P[0].quaternion.setFromUnitVectors(NOSE, b.dir);
    let idx = b.hist.length - 1, acc = 0, prev = b.head;
    for (let i = 0; i < BACK.length; i++) {
      const want2 = BACK[i];
      while (idx > 0 && acc + prev.distanceTo(b.hist[idx - 1]) < want2) { acc += prev.distanceTo(b.hist[idx - 1]); prev = b.hist[--idx]; }
      let pos;
      if (idx > 0) { const nx = b.hist[idx - 1], seg = prev.distanceTo(nx) || 1, f = (want2 - acc) / seg; pos = prev.clone().lerp(nx, clamp(f, 0, 1)); }
      else pos = b.head.clone().addScaledVector(b.dir, -want2);   // not enough path yet: straight behind
      const ahead = i === 0 ? b.head : P[i].position;
      P[i + 1].position.copy(pos);
      v3.copy(ahead).sub(pos); if (v3.lengthSq() > 1e-6) P[i + 1].quaternion.setFromUnitVectors(NOSE, v3.normalize());
      P[i + 1].rotation.z += Math.sin(b.clock * 3 - i * 0.6) * 0.06;
    }
    // ---- the weak points ride the flank nodes of their segments
    // (the framework keeps its own weak-point objects, in the order build() gave them: nodeDef says which node is which)
    b.weak.forEach((w, i) => { const n = b.nodeDef[i], s = P[n.seg + 1]; v3.set(n.side * 1.55 * n.k, 0.1, 0).applyQuaternion(s.quaternion).add(s.position); w.at[0] = v3.x; w.at[1] = v3.y; w.at[2] = v3.z; });
    // ---- its mouth (the muzzle: the tell glows there) and where its shots leave, in the world
    v3.copy(b.head).addScaledVector(b.dir, SNARE.nose);
    b.muzzles[0][0] = v3.x; b.muzzles[0][1] = v3.y; b.muzzles[0][2] = v3.z;
    const sc = b.root.scale.x || 1;
    b.mouth = { x: b.root.position.x + v3.x * sc, y: b.root.position.y + v3.y * sc, z: b.root.position.z + v3.z * sc };
    // ---- lit only while it is turned to strike (and through the whole lunge)
    b.offT = (b.offT ?? 9) + dt;
    b.lit = fight && ((b.mode === 'dwell' && b.dw > 0.35) || b.mode === 'lunge' || (b.mode === 'travel' && b.offT < SNARE.grace));
    // ---- the tell
    const tk = (b.clock - b.tellAt) / b.tellLen, telling = fight && tk >= 0 && tk <= 1;
    const red = P[0].userData.mats['#ff3355*'];
    if (red) red.color.copy(RED).lerp(HOT, telling ? tk : 0);
    if (telling && b.glows[0]) { b.glows[0].material.opacity = Math.max(b.glows[0].material.opacity, tk); b.glows[0].scale.setScalar(3 + 6 * tk); }
    // freed: the mother sings, a moment after the graft burns out
    if (b.state === 'dying' && !b.sang && b.t > 1.2) {
      b.sang = true;
      if ((b.tethered || 0) < SNARE.safe) { api.game.bonus('MOTHER SAFE', 25000); api.game.call('MOTHER SAFE', 'c-cyan'); }
      api.game.sfx('g2-mother-song', { vol: 1 });
      if (b.mother && b.mother.alive) b.mother.life = b.mother.t + 1.5;   // and the herd turns for home
    }
  },
  defeat(b, api) {
    release(b);
    for (const p of b.parts) { p.userData.a.visible = false; p.userData.c.visible = true; }
    // (the freed sound is the engine's now: galaxies 4d1e242)
  },
});
