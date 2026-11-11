// THE WEFTWORK's scenery. Set pieces fade by weight; streams keep every stretch full (ruling 5). Everything stays outside
// the flight box (|nx| > 1.4 or |ny| > 1.3, worked out from the box itself, so a tall phone keeps it clear too), and red
// is only ever a thin thread (rule 9). Yori's pieces throughout, from her vertex lists (mesh.js beside this file, and
// the boss's own frame); the threads are her thread (a thin bar, #9a6aff lit) repeated.
//  ACT 1 THE WARP   g3-l10-loom (the whole Weftwork on the horizon, a loom across a galaxy), g3-l10-warp (the warp's
//                   threads running ahead above and below you, kilometres long), g3-l10-spools, g3-l10-beams
//  ACT 2 THE SHED   g3-l10-shed (the two layers of warp you dive between), g3-l10-frames (heddle frames going by),
//                   g3-l10-shuttles (giant shuttles racing past on their rails)
//  OUT  THE UNRAVEL g3-l10-snap (threads snapping outward), g3-l10-suns (the unmade stars lighting again, one by one)
//  HOME             galaxy 1's sunrise over the quiet blue planet (imported, never copied), galaxy 2's freed star
//                   (g3-l10-star), and the re-lit suns: all three galaxies' landmarks in one sky
import { THREE, defineScenery, defineDecor, Instanced, buildModel, modelGroups, clamp, smoothstep } from '../../../api.js?v=0.6.3';
import { MESH } from './mesh.js?v=0.6.3';
import { MESH as STAR } from './star-mesh.js?v=0.6.3';
import { MESH as LOOM } from '../../../bosses/g3-weftwork/mesh.js?v=0.6.3';
import { MESH as HEDDLE } from '../../../obstacles/g3-heddle/mesh.js?v=0.6.3';
import { MESH as SHUTTLE } from '../../../bosses/g3-weftwork/shuttle-mesh.js?v=0.6.3';

const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), I = new THREE.Quaternion();
// Yori's fronts face -Z; you meet a thing's +z side first, so her pieces are turned half round to face you
const FACE = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
// transparent far things: drawn after the course but before every other glow
const far = (mat, order) => { mat.transparent = true; mat.depthWrite = false; mat.fog = false; return order; };
// where the run is inside a section (0..1), by id; -1 before it, 2 after it
export function sectionK(api, id) {
  const s = api.level && api.level.sections.find((q) => q.id === id); if (!s) return -1;
  const d = api.G.courseD; if (d < s.d0) return -1; if (d > s.d1) return 2;
  return (d - s.d0) / (s.d1 - s.d0);
}
// a lane-clear offset: beyond the box by `k` box-heights (or widths)
const outY = (api, k) => api.box.y * k, outX = (api, k) => api.box.x * k;
// Instanced layers of each colour group of a mesh, unlit where she made it glow
const layersOf = (api, groups, n, lit) => modelGroups(groups).map((g) => new Instanced(api.scene, g.geo, g.glow ? new THREE.MeshBasicMaterial({ color: g.color }) : new THREE.MeshStandardMaterial({ color: g.color, metalness: 0.5, roughness: 0.45, flatShading: true, ...(lit || {}) }), n));

// =====================================================================================================================
// THE LOOM ON THE HORIZON. The whole Weftwork far ahead (her frame, the boss's own, 9x): a loom across a galaxy. It looms
// nearer through act 1 and is gone by the time you dive into it.
export const loom = defineScenery({
  name: 'g3-l10-loom',
  ease: 0.5,
  init(api) {
    const own = ['#1e1f27', '#8a94a8', '#e8eeff*', '#9a6aff*'];
    const m = buildModel(LOOM.frame, { own });
    for (const k of own) { const mat = m.mats[k]; if (mat) { far(mat, -6); mat.opacity = 0; } }
    m.group.rotation.y = Math.PI; m.group.visible = false; api.scene.add(m.group);
    m.group.traverse((o) => { if (o.isMesh) o.renderOrder = -6; });
    return { g: m.group, mats: own.map((k) => m.mats[k]).filter(Boolean) };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003; if (!s.g.visible) return;
    const k = clamp(api.G.courseD / 13000, 0, 1), sc = 8 + 4 * k;
    s.g.position.set(0, 14 - 6 * k, -1050 + 60 * k); s.g.scale.setScalar(sc);
    for (const m of s.mats) m.opacity = w * (m.color.r > 0.5 && m.color.b > 0.8 ? 0.8 : 0.9);
  },
});

// =====================================================================================================================
// THE WARP. Her thread, a thin lit bar, in long runs straight ahead of you above and below the lane (and out to the
// sides), kilometres of it; small steel beads on it every 30 m so you feel the speed. Mostly ultraviolet, one in four
// a dark red (a thin thread, never a flat field: rule 9).
let warpUV, warpRed, beads;
const WARP_LEN = 120;
export const warpSeg = defineDecor({
  name: 'g3-l10-warp-seg',
  sample: { lines: [[0, 8, false], [0, -8, true]] },
  init(api) {
    const g = new THREE.BoxGeometry(0.1, 0.1, WARP_LEN);
    warpUV = new Instanced(api.scene, g, new THREE.MeshBasicMaterial({ color: 0x5a3aa8 }), 900);
    warpRed = new Instanced(api.scene, g, new THREE.MeshBasicMaterial({ color: 0x6a1a34 }), 300);
    beads = new Instanced(api.scene, new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshStandardMaterial({ color: 0x8a94a8, metalness: 0.6, roughness: 0.4, flatShading: true }), 2400);
  },
  begin() { warpUV.begin(); warpRed.begin(); beads.begin(); },
  end() { warpUV.end(); warpRed.end(); beads.end(); },
  spawn(e, ev) { e.lines = ev.lines; },
  update(e) {
    const a = e.appear;
    // one bead a run per segment (at its near end): enough to feel the speed, a fraction of the matrices
    for (const [x, y, red] of e.lines) {
      (red ? warpRed : warpUV).put(e.x + x, e.y + y, e.z - WARP_LEN / 2, I, a, a, a);
      beads.put(e.x + x, e.y + y, e.z, I, a, a, a);
    }
    if (e.z > WARP_LEN + 20) e.alive = false;
  },
});
// one sheet of warp every 120 m, end to end, so the lines run on unbroken
function warpLines(api, R, dense) {
  const L = [], ox = outX(api, 1.45), oy = outY(api, 1.35);
  // above and below: well clear of the lane, the dark red only on the far runs (rule 9: red is what hurts, and the warp
  // threads that span the lane are red; the scenery's must never be mistaken for them)
  const n = dense ? 10 : 7;
  for (const s of [1, -1]) for (let i = 0; i < n; i++) { const x = -84 + i * (168 / (n - 1)), y = s * (oy + 14 + (i % 3) * 9); L.push([x, y, Math.abs(y) > oy + 28 && i % 3 === 2]); }
  for (const s of [1, -1]) for (let i = 0; i < 3; i++) L.push([s * (ox + 22 + i * 14), (i - 1) * 10, false]);
  return L;
}
export const warp = defineScenery({
  name: 'g3-l10-warp',
  stream: { every: [WARP_LEN, WARP_LEN], place: (R, api, w) => ({ type: 'g3-l10-warp-seg', x: 0, y: 0, lines: warpLines(api, R, w > 0.7) }) },
});

// spool posts beside the lane (hers: a graphite post, a spool of lit thread on top, its plan line)
let spoolLayers;
export const spool = defineDecor({
  name: 'g3-l10-spool',
  sample: { s: 1, flip: false },
  init(api) { spoolLayers = layersOf(api, MESH.spool, 40); },
  begin() { for (const L of spoolLayers) L.begin(); }, end() { for (const L of spoolLayers) L.end(); },
  spawn(e, ev) { e.s = ev.s; e.flip = ev.flip; },
  update(e) { const s = e.s * e.appear; tmpQ.setFromEuler(tmpE.set(e.flip ? Math.PI : 0, Math.PI, 0)); for (const L of spoolLayers) L.put(e.x, e.y, e.z, tmpQ, s, s, s); if (e.z > 60) e.alive = false; },
});
export const spools = defineScenery({
  name: 'g3-l10-spools',
  stream: { every: [70, 150], place: (R, api) => { const side = R.sign(); return { type: 'g3-l10-spool', x: side * (outX(api, 1.6) + R.range(4, 26)), y: R.range(-6, 6), s: R.range(0.7, 1.1), flip: R() < 0.3 }; } },
});
// loom beams far overhead: her I-beam across the sky. Its hanging red thread guides are left off: in this level red
// threads across your view are the thing that hurts, and the beams' read as more of them (rule 9, rule 16)
let beamLayers;
export const beam = defineDecor({
  name: 'g3-l10-beam',
  sample: { s: 1, yaw: 0 },
  init(api) { beamLayers = layersOf(api, MESH.beam.filter((g) => g.color !== '#ff3355'), 12); },
  begin() { for (const L of beamLayers) L.begin(); }, end() { for (const L of beamLayers) L.end(); },
  spawn(e, ev) { e.s = ev.s; e.yaw = ev.yaw; },
  update(e) { const s = e.s * e.appear; tmpQ.setFromEuler(tmpE.set(0, e.yaw + Math.PI, 0)); for (const L of beamLayers) L.put(e.x, e.y, e.z, tmpQ, s, s, s); if (e.z > 120) e.alive = false; },
});
export const beams = defineScenery({
  name: 'g3-l10-beams',
  stream: { every: [280, 460], place: (R, api) => ({ type: 'g3-l10-beam', x: R.range(-30, 30), y: outY(api, 1.4) + 40 + R.range(0, 20), s: R.range(1.6, 2.2), yaw: R.range(-0.25, 0.25) }) },
});

// =====================================================================================================================
// THE SHED. The two layers of warp you dive between: her threads, dense, close above and below the lane, with a heddle's
// white eye on every other thread twice a segment, so the speed reads at 215 m/s. Each LAYER (sixteen threads and their
// eyes) is one geometry, built once and instanced per layer: four matrices a segment instead of hundreds (the phone
// proxy found the per-thread version costly).
let shedLines, eyes;
const SHED_LEN = 60, SHED_N = 16;
// boxes [cx, cy, cz, sx, sy, sz] as one geometry (flat-shaded, unindexed)
function boxes(list) {
  const pos = [];
  for (const [cx, cy, cz, sx, sy, sz] of list) {
    const b = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed(), p = b.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) pos.push(p[i] + cx, p[i + 1] + cy, p[i + 2] + cz);
    b.dispose();
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
export const shedSeg = defineDecor({
  name: 'g3-l10-shed-seg',
  sample: { ys: [8, -8] },
  init(api) {
    const xs = [...Array(SHED_N).keys()].map((i) => -30 + i * 60 / (SHED_N - 1));
    shedLines = new Instanced(api.scene, boxes(xs.map((x) => [x, 0, -SHED_LEN / 2, 0.08, 0.08, SHED_LEN])), new THREE.MeshBasicMaterial({ color: 0x5a3ab8 }), 120);
    eyes = new Instanced(api.scene, boxes(xs.filter((x, i) => i % 2 === 0).flatMap((x) => [[x, 0, -15, 0.4, 0.14, 0.14], [x, 0, -45, 0.4, 0.14, 0.14]])), new THREE.MeshBasicMaterial({ color: 0x9a88d8 }), 120);
  },
  begin() { shedLines.begin(); eyes.begin(); }, end() { shedLines.end(); eyes.end(); },
  spawn(e, ev) { e.ys = ev.ys; },
  update(e) {
    const a = e.appear;
    for (const y of e.ys) { shedLines.put(0, y, e.z, I, a, a, a); eyes.put(0, y, e.z, I, a, a, a); }
    if (e.z > SHED_LEN + 20) e.alive = false;
  },
});
export const shed = defineScenery({
  name: 'g3-l10-shed',
  ease: 1.2,
  // the layers come in with the weight: far apart as you dive in, close round the lane in the shed
  stream: { every: [SHED_LEN, SHED_LEN], place: (R, api, w) => { const oy = outY(api, 1.32) + 1 + 14 * (1 - w); return { type: 'g3-l10-shed-seg', x: 0, y: 0, ys: [oy + 1, oy + 4.5, -oy - 1, -oy - 4.5] }; } },
});
// heddle frames going by outside the lane (her frame alone: graphite posts and beams)
let frameLayers;
export const frame = defineDecor({
  name: 'g3-l10-frame',
  sample: { s: 1.3 },
  init(api) { frameLayers = layersOf(api, HEDDLE.heddle.filter((g) => g.color === '#1e1f27'), 30); },
  begin() { for (const L of frameLayers) L.begin(); }, end() { for (const L of frameLayers) L.end(); },
  spawn(e, ev) { e.s = ev.s; },
  update(e) { const s = e.s * e.appear; for (const L of frameLayers) L.put(0, 0, e.z, I, s, s, s); if (e.z > 30) e.alive = false; },
});
export const frames = defineScenery({
  name: 'g3-l10-frames',
  stream: { every: [160, 260], place: (R, api) => ({ type: 'g3-l10-frame', s: Math.max(1.25, (outX(api, 1.5) + 1) / 13.5, (outY(api, 1.4) + 1) / 14) }) },
});
// giant shuttles racing past on their rails beside the lane: hers, 3x, a red streak behind each
let shutLayers, streak;
export const shuttle = defineDecor({
  name: 'g3-l10-shuttle',
  sample: { fast: 0, s: 3 },
  init(api) {
    shutLayers = layersOf(api, SHUTTLE.shuttle, 16);
    streak = new Instanced(api.scene, new THREE.BoxGeometry(0.2, 0.2, 1), new THREE.MeshBasicMaterial({ color: 0xc02848, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }), 16);
  },
  begin() { for (const L of shutLayers) L.begin(); streak.begin(); }, end() { for (const L of shutLayers) L.end(); streak.end(); },
  spawn(e, ev) { e.fast = ev.fast; e.s = ev.s; },
  update(e, dt, api) {
    e.z += e.fast * dt;                                     // it outruns the course: it races past you
    const s = e.s * e.appear;
    for (const L of shutLayers) L.put(e.x, e.y, e.z, FACE, s, s, s);   // nose first: it races toward you
    streak.put(e.x, e.y, e.z - 3 * s - 14, I, s, s, 26 * e.appear);
    if (!e.whoosh && e.z > -90) { e.whoosh = true; api.game.sfx('g3-shuttle', { vol: 0.35, pan: Math.sign(e.x) * 0.7 }); }
    if (e.z > 60) e.alive = false;
  },
});
export const shuttles = defineScenery({
  name: 'g3-l10-shuttles',
  stream: { every: [180, 340], place: (R, api) => { const side = R.sign(); return { type: 'g3-l10-shuttle', x: side * (outX(api, 1.5) + R.range(2, 7)), y: R.range(-0.6, 0.6) * api.box.y, fast: R.range(70, 120), s: 3 }; } },
});

// =====================================================================================================================
// THE UNRAVEL. Threads snapping outward: lit lengths of warp that whip away from the lane, spinning, whitening as they go,
// with weld-magenta sparks off the snapped ends (sparks only: Yori's rule for magenta).
let snapLines;
export const snapSeg = defineDecor({
  name: 'g3-l10-snap-seg',
  sample: { vx: 0, vy: 0, len: 10, spin: 0, ph: 0 },
  init(api) { snapLines = new Instanced(api.scene, new THREE.BoxGeometry(0.18, 0.18, 1), new THREE.MeshBasicMaterial({ color: 0xd8c8ff }), 400); },
  begin() { snapLines.begin(); }, end() { snapLines.end(); },
  spawn(e, ev) { e.vx = ev.vx; e.vy = ev.vy; e.len = ev.len; e.spin = ev.spin; e.ph = ev.ph; },
  update(e, dt, api) {
    // it whips outward once it is near enough to see it go
    if (e.z > -500) { e.x += e.vx * dt; e.y += e.vy * dt; }
    tmpQ.setFromEuler(tmpE.set(e.ph + e.t * e.spin, e.t * e.spin * 0.6, 0));
    const a = e.appear;
    snapLines.put(e.x, e.y, e.z, tmpQ, a, a, e.len * a);
    if (!e.sparked && e.z > -260) { e.sparked = true; api.game.burst(e.x, e.y, e.z, 10, { speed: 10, life: 0.6, s0: 0.8, r: 1, g: 0.29, b: 0.85, carry: 1 }); }
    if (e.z > 40) e.alive = false;
  },
});
export const snap = defineScenery({
  name: 'g3-l10-snap',
  stream: { every: [24, 60], place: (R, api) => { const ang = R() * Math.PI * 2, r = Math.max(outX(api, 1.5), outY(api, 1.5)) + R.range(2, 16), sp = R.range(8, 20); return { type: 'g3-l10-snap-seg', x: Math.cos(ang) * r, y: Math.sin(ang) * r * 0.75, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, len: R.range(18, 50), spin: R.range(-1.2, 1.2), ph: R() * 6 }; } },
});

// THE NEW SUNS. Stars the loom took apart, hanging dark round the horizon (her unbuilt half-star's dark), lighting again
// one by one as you go: her new sun, white with its lilac ring, flaring in. A set piece: they hang at the sky's depth.
const SUNS = [];
{ let a = 4242; const R = () => ((a = (a * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 16; i++) { const ang = -0.5 + R() * Math.PI + (i % 2 ? Math.PI : 0) * 0.35; SUNS.push({ x: Math.cos(ang) * (160 + R() * 440), y: 90 + Math.sin(ang) * 40 + R() * 280, z: -700 - R() * 380, s: 0.8 + R() * 1.6, at: i / 16 }); } } // up in the sky, above the run home's horizon glow
export const suns = defineScenery({
  name: 'g3-l10-suns',
  ease: 0.8,
  init(api) {
    const g = new THREE.Group(), list = [];
    for (const p of SUNS) {
      const m = buildModel(MESH.sun, { own: ['#fff6ff*', '#ece3ff*'] });
      for (const mat of Object.values(m.mats)) { far(mat, -6.5); mat.opacity = 0; }
      m.group.traverse((o) => { if (o.isMesh) o.renderOrder = -6.5; });
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xf0e8ff, blending: THREE.AdditiveBlending, opacity: 0 })); glow.renderOrder = far(glow.material, -6.6);
      m.group.position.set(p.x, p.y, p.z); m.group.scale.setScalar(p.s); m.group.lookAt(0, 0, 0);
      glow.position.set(p.x, p.y, p.z); glow.scale.setScalar(p.s * 70);
      g.add(m.group, glow); list.push({ p, mats: Object.values(m.mats), glow, lit: 0 });
    }
    g.visible = false; api.scene.add(g);
    return { g, list };
  },
  update(st, w, dt, api) {
    st.g.visible = w > 0.003; if (!st.g.visible) return;
    // how far through the unravel: snap, then the unravel, then home (every sun lit by the run home)
    const k = Math.max(0, Math.min(1, (sectionK(api, 'snap') > 1 ? 0.15 : 0.15 * clamp(sectionK(api, 'snap'), 0, 1)) + (sectionK(api, 'unravel') > 1 ? 0.75 : 0.75 * clamp(sectionK(api, 'unravel'), 0, 1)) + (sectionK(api, 'home') >= 0 ? 0.1 : 0)));
    for (const s of st.list) {
      const want = k >= s.p.at ? 1 : 0;
      if (want && s.lit < 1 && s.lit === 0 && st.g.visible && w > 0.5) api.game.sfx('crystal-chime', { rate: 0.6 + s.p.at * 0.9, vol: 0.4 });
      s.lit += (want - s.lit) * Math.min(1, dt * 1.6);
      const flare = s.lit > 0 && s.lit < 0.6 ? Math.sin(s.lit / 0.6 * Math.PI) : 0;
      for (const m of s.mats) m.opacity = w * (0.12 + 0.88 * s.lit);
      s.glow.material.opacity = w * (0.05 + 0.5 * s.lit + 0.8 * flare);
    }
    st.g.position.set(0, 0, 0);
  },
});
// GALAXY 2's freed star (her Rootmind's star, its roots gone): white-green, high in the sky ahead of the run home
export const star = defineScenery({
  name: 'g3-l10-star',
  ease: 0.5,
  init(api) {
    const m = buildModel(STAR.freedStar, { own: ['#f4fff0*', '#d0ffb0*'] });
    for (const mat of Object.values(m.mats)) { far(mat, -7.2); mat.opacity = 0; }
    m.group.traverse((o) => { if (o.isMesh) o.renderOrder = -7.2; });
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xb8ffc8, blending: THREE.AdditiveBlending, opacity: 0 })); glow.renderOrder = far(glow.material, -7.3);
    const g = new THREE.Group(); g.add(m.group, glow); g.position.set(260, 230, -900); m.group.scale.setScalar(1.4); glow.scale.setScalar(220);
    g.visible = false; api.scene.add(g);
    return { g, mats: Object.values(m.mats), glow, spin: m.group };
  },
  update(s, w, dt) {
    s.g.visible = w > 0.003; if (!s.g.visible) return;
    for (const m of s.mats) m.opacity = w * 0.95; s.glow.material.opacity = 0.55 * w;
    s.spin.rotation.y += dt * 0.05;
  },
});
