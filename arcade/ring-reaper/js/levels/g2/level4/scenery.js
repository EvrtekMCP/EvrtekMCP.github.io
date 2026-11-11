// THE MIGRATION's scenery (ruling 5: the view never goes blank; rule 22: its own palette, landmark and silhouette).
// Yori's look (looks/level-g2-04-the-migration.png): the one blue level of the Deep, pale whales against deep blue,
// nursery clouds glowing. Hopeful and huge. Everything here is outside the flight box and never solid.
//  - g2-l4-plankton: the Deep's motes drifting past all the time (the galaxy's ambient stream; levels 5 and 6 use it
//    in their own colours)
//  - g2-l4-clouds:   her nursery clouds, soft glowing blobs, around the lane
//  - g2-l4-herd:     the herd swimming the same way you are, far out on both sides (you overtake them slowly)
//  - g2-l4-mothers:  the landmark, the Mother Herd: twelve whales a kilometre long crossing the sky
//  - g2-l4-crosser:  THE STAMPEDE (course decor): whales sweeping across your lane ahead of you, harmless
//  - g2-l4-cloud:    one nursery cloud placed by the level (the Nursery's ring)
import { THREE, defineScenery, defineDecor, Instanced, modelGroups, material, buildModel, clamp, rng } from '../../../api.js?v=0.6.3';
import { MESH } from './mesh.js?v=0.6.3';
import { MESH as WHALE } from '../../../allies/g2-whale/mesh.js?v=0.6.3';

const q = new THREE.Quaternion(), eul = new THREE.Euler();

// ---- the motes: a loose cluster of tiny glowing specks (her motes are little boxes), tinted per level
let moteL = null;
export const motes = defineDecor({
  name: 'g2-l4-motes', hazard: null, sample: { n: 12, c: 0x9affc0 },
  init(api) {
    if (moteL) return;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false });
    moteL = new Instanced(api.scene, new THREE.BoxGeometry(0.22, 0.22, 0.22), mat, 2400);
  },
  begin() { moteL.begin(); }, end() { moteL.end(); },
  spawn(e, ev) {
    const R = rng((e.id * 2654435761) >>> 0), n = ev.n || 22;
    e.pts = []; for (let i = 0; i < n; i++) e.pts.push(R.range(-9, 9), R.range(-6, 6), R.range(-14, 14), R.range(0, 6.28));
    e.c = ev.c ?? 0x9affc0; e.c2 = ev.c2 ?? e.c;
  },
  update(e, dt) {
    const P = e.pts, s = e.appear;
    for (let i = 0; i < P.length; i += 4) moteL.put(e.x + P[i] + Math.sin(e.t * 0.5 + P[i + 3]) * 0.6, e.y + P[i + 1] + Math.sin(e.t * 0.37 + P[i + 3]) * 0.5, e.z + P[i + 2], q.identity(), s, s, s, (i >> 2) % 3 ? e.c : e.c2);
    if (e.z > 30) e.alive = false;
  },
});
// place a mote cluster around the lane, never inside the box (|nx| > 1.4 or |ny| > 1.3)
export const moteStream = (name, c, c2, every = [36, 70]) => defineScenery({
  name, stream: { every, place: (R, api) => { const B = api.box, up = R() < 0.35; return up ? { type: 'g2-l4-motes', x: R.range(-B.x * 2.5, B.x * 2.5), y: R.sign() * R.range(B.y * 1.9, B.y * 4), c, c2 } : { type: 'g2-l4-motes', x: R.sign() * R.range(B.x * 1.9, B.x * 4.5), y: R.range(-B.y * 2.5, B.y * 2.5), c, c2 }; } },
});
export const plankton = moteStream('g2-l4-plankton', 0xbaffd0, 0xe8f6ff);

// ---- nursery clouds (her nurseryCloud(12), two seeds): soft pale blue-white blobs with a halo of motes
let cloudL = null;
export const cloud = defineDecor({
  name: 'g2-l4-cloud', hazard: null, sample: { r: 1, v: 0 },
  init(api) { if (cloudL) return; cloudL = [MESH.cloudA, MESH.cloudB].map((m) => modelGroups(m).map((g) => { const mt = material(g.color, true, true); mt.transparent = true; mt.opacity = 0.2; mt.depthWrite = false; return new Instanced(api.scene, g.geo, mt, 70); })); },
  begin() { for (const v of cloudL) for (const L of v) L.begin(); },
  end() { for (const v of cloudL) for (const L of v) L.end(); },
  spawn(e, ev) { e.r = ev.r || 1; e.v = ev.v ?? (e.id % 2); e.q = new THREE.Quaternion().setFromEuler(eul.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)); e.spin = (Math.random() - 0.5) * 0.15; },
  update(e, dt) {
    e.q.multiply(q.setFromEuler(eul.set(0, e.spin * dt, 0)));
    const s = e.r * e.appear * (1 + 0.04 * Math.sin(e.t * 1.1 + e.id));
    for (const L of cloudL[e.v]) L.put(e.x, e.y, e.z, e.q, s, s, s);
    if (e.z > 60) e.alive = false;
  },
});
export const clouds = defineScenery({
  name: 'g2-l4-clouds',
  stream: { every: [70, 150], place: (R, api) => { const B = api.box, a = R.range(0, Math.PI * 2), rr = R.range(4.2, 9); return { type: 'g2-l4-cloud', x: Math.cos(a) * B.x * rr, y: Math.sin(a) * B.y * rr * 1.3, r: R.range(0.5, 1.3) }; } },
});

// ---- the herd: star-whales 30-90 m long swimming your way far out on both sides; you overtake them slowly
let herdL = null;
const whaleLayers = (api, cap) => modelGroups(WHALE.whale).map((g) => new Instanced(api.scene, g.geo, material(g.color, g.glow), cap));
export const swimmer = defineDecor({
  name: 'g2-l4-swimmer', hazard: null, sample: { len: 40 },
  init(api) { if (!herdL) herdL = whaleLayers(api, 40); },
  begin() { for (const L of herdL) L.begin(); }, end() { for (const L of herdL) L.end(); },
  spawn(e, ev) { e.k = (ev.len || 50) / 14; e.swim = ev.swim ?? 0.45; e.ph = Math.random() * 6; },
  update(e, dt, api) {
    e.z -= api.v * e.swim * dt;                              // it swims ahead too, so it streams past slower
    e.q = e.q || new THREE.Quaternion();
    e.q.setFromEuler(eul.set(Math.sin(e.t * 0.5 + e.ph) * 0.05, 0, Math.sin(e.t * 0.7 + e.ph) * 0.08));
    const s = e.k * e.appear;
    for (const L of herdL) L.put(e.x, e.y + Math.sin(e.t * 0.6 + e.ph) * e.k * 0.4, e.z, e.q, s, s, s);
    if (e.z > 160) e.alive = false;
  },
});
export const herd = defineScenery({
  name: 'g2-l4-herd',
  stream: { every: [260, 480], place: (R, api) => { const B = api.box, len = R.range(30, 80); return { type: 'g2-l4-swimmer', x: R.sign() * R.range(B.x * 6 + len * 0.5, B.x * 14 + len), y: R.range(-B.y * 4, B.y * 8), len }; } },
});

// ---- the landmark: the Mother Herd, twelve whales a kilometre long crossing the sky in a slow procession
export const mothers = defineScenery({
  name: 'g2-l4-mothers',
  ease: 0.35,
  init(api) {
    const g = new THREE.Group(), mats = [];
    const groups = modelGroups(WHALE.whale);
    const R = rng(404);
    for (let i = 0; i < 12; i++) {
      const w = new THREE.Group();
      for (const grp of groups) { const m = material(grp.color, grp.glow, true); m.transparent = true; m.opacity = 0; m.fog = false; m.depthWrite = false; mats.push(m); w.add(new THREE.Mesh(grp.geo, m)); }
      const k = R.range(15, 21);                             // 210-300 m long, over a kilometre away and high
      w.scale.setScalar(k);
      w.position.set(-2300 + i * 420 + R.range(-80, 80), R.range(430, 640), -1020 - R.range(0, 120));
      w.rotation.set(R.range(-0.05, 0.05), -Math.PI / 2 + R.range(-0.15, 0.15), R.range(-0.05, 0.05));  // nose to +X: crossing the sky
      w.userData.ph = R() * 6;
      g.add(w);
    }
    g.renderOrder = -4; g.visible = false;
    api.scene.add(g);
    return { g, mats };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003;
    for (const m of s.mats) m.opacity = 0.26 * w;
    const t = api.time || 0;
    // the procession crosses the sky over the level, left to right, and the whole group bobs slowly
    s.g.position.x = -200 + (api.G.dist || 0) * 0.05;      // noses to +X: they swim the way they drift
    for (const c of s.g.children) c.position.y += Math.sin(t * 0.15 + c.userData.ph) * 0.05;
  },
});

// ---- THE STAMPEDE: a whale (40-60 m) sweeping across your lane ahead of you, at a gallop. It crosses the middle of
// the lane when it is `mid` metres ahead and is long gone from the box before you get there. Never solid; it turns
// see-through as it comes close, so it never hides what is behind it for long.
//   add(d, 'g2-l4-crosser', { dir: 1, ny: 0.4, len: 50, mid: 140 })   d is where it crosses (its z = -mid then)
export const crosser = defineDecor({
  name: 'g2-l4-crosser', hazard: null, sample: { dir: 1, ny: 0, len: 40 },
  spawn(e, ev, api) {
    e.obj = api.course.get('g2-l4-crosser', () => {
      const m = buildModel(WHALE.whale, { own: WHALE.whale.map((g) => g.color + (g.glow ? '*' : '')) });
      for (const mt of Object.values(m.mats)) { mt.transparent = true; mt.depthWrite = true; }
      m.group.userData.mats = Object.values(m.mats);
      return m.group;
    });
    e.dir = ev.dir || 1; e.len = ev.len || 50; e.mid = ev.mid ?? 140;
    e.sx = e.sy = e.sz = e.len / 14;
    e.baseY = (ev.ny || 0) * api.box.y;
    e.obj.rotation.set(0, -e.dir * Math.PI / 2, 0);
    e.ph = Math.random() * 6;
  },
  update(e, dt, api) {
    // it crosses at about half your speed: its middle is at the lane's middle when it is `mid` metres ahead
    e.x = e.dir * (e.z + e.mid) * 0.55;
    e.y = e.baseY + Math.sin(e.t * 1.6 + e.ph) * 0.6;
    api.pose(e);
    e.obj.rotation.z = Math.sin(e.t * 2.2 + e.ph) * 0.12;
    const op = clamp((-e.z - 25) / 60, 0, 1);
    for (const m of e.obj.userData.mats) m.opacity = 0.25 + 0.7 * op;
    if (e.z > 40) e.alive = false;
  },
});

export const SCENERY = [plankton, clouds, herd, mothers];
export const DECOR = [motes, cloud, swimmer, crosser];
