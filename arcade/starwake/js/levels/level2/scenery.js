// LEVEL 2 scenery: Yori's Shattered Moon (art-incoming/yori/levels/looks/level-02-shattered-moon.png).
// Brown-grey rock with one warm sun edge, a hard sun from the upper right, a cold blue fill, dust rivers as
// drifting bands, crack slabs that close in to canyon walls for the core dash, and the broken moon itself.
import { THREE, defineScenery, defineDecor, Instanced, modelGroups, GlowPoints, rng, clamp } from '../../api.js?v=0.4.1';
import { MESH as CHUNK } from '../../obstacles/boulder/mesh.js?v=0.4.1';
import { MESH as SLAB } from './mesh.js?v=0.4.1';

const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), ax = new THREE.Vector3();
const side = (R, lo, hi) => R.sign() * R.range(lo, hi);

// ---- moon chunks: tumbling rock with a sunlit crack (Yori's moonChunk), drifting beside the lane
let chunkLayers;
export const chunk = defineDecor({
  name: 'l2-chunk',
  sample: { v: 0, r: 4, a: 0, b: 0, c: 0, spin: 0 },
  init(api) {
    const rock = new THREE.MeshLambertMaterial({ color: 0x6a5a4e, flatShading: true }), edge = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    chunkLayers = ['a', 'b', 'c'].map((v) => modelGroups(CHUNK[v]).map((g) => new Instanced(api.scene, g.geo, g.glow ? edge : rock, 90)));
  },
  begin() { for (const v of chunkLayers) for (const L of v) L.begin(); },
  end() { for (const v of chunkLayers) for (const L of v) L.end(); },
  spawn(e, ev) {
    e.r = ev.r; e.v = ev.v; e.q = new THREE.Quaternion().setFromEuler(tmpE.set(ev.a, ev.b, ev.c));
    e.spin = new THREE.Quaternion().setFromAxisAngle(ax.set(ev.a - 3, ev.b - 3, 1).normalize(), ev.spin);
  },
  update(e, dt) {
    e.q.multiply(e.spin);
    const s = e.r * e.appear;
    for (const L of chunkLayers[e.v]) L.put(e.x, e.y, e.z, e.q, s, s, s);
    if (e.z > 40) e.alive = false;
  },
});
// ---- crack slabs: big flat crust with a crack of sun; above and below the lane, or stood up as canyon walls
let slabLayers;
export const slab = defineDecor({
  name: 'l2-slab',
  sample: { v: 0, s: 1 },
  init(api) {
    const rock = new THREE.MeshLambertMaterial({ color: 0x3a2e2a, flatShading: true }), edge = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    slabLayers = ['slabA', 'slabB'].map((v) => modelGroups(SLAB[v]).map((g) => new Instanced(api.scene, g.geo, g.glow ? edge : rock, 70)));
  },
  begin() { for (const v of slabLayers) for (const L of v) L.begin(); },
  end() { for (const v of slabLayers) for (const L of v) L.end(); },
  spawn(e, ev) { e.v = ev.v; e.s = ev.s; e.q = new THREE.Quaternion().setFromEuler(tmpE.set(ev.rx || 0, ev.ry || 0, ev.rz || 0)); },
  update(e) {
    const s = e.s * e.appear;
    for (const L of slabLayers[e.v]) L.put(e.x, e.y, e.z, e.q, s, s, s);
    if (e.z > 60) e.alive = false;
  },
});
// ---- dust rivers: a sinuous band of pale motes drifting across the view, far out (glow points, fading into the haze)
let dustLayer;
export const dust = defineDecor({
  name: 'l2-dust',
  sample: { ph: 0, amp: 3, n: 8, flow: 0.02, w: 60 },
  init(api) { dustLayer = new GlowPoints(api.scene, 2400, api.glowTex).setFar(420, 720); },
  begin() { dustLayer.begin(); },
  end() { dustLayer.end(); },
  spawn(e, ev) { e.ph = ev.ph; e.amp = ev.amp; e.n = ev.n; e.flow = ev.flow; e.w = ev.w; },
  update(e, dt, api) {
    e.ph += dt * e.flow;
    const a = e.appear * 0.2;
    for (let i = 0; i < e.n; i++) {
      const u = (i / e.n + e.ph) % 1, x = (u - 0.5) * e.w;
      const yy = e.y + Math.sin(u * 9 + e.ph * 2) * e.amp, zz = e.z + Math.sin(u * 5.3) * 12;
      dustLayer.push(e.x + x, yy, zz, (2.2 + Math.sin(i * 7.7) * 0.8) * e.appear * 3, 0.85, 0.72, 0.56, a);
    }
    if (e.z > 40) e.alive = false;
  },
});

// ---- streams
export const chunks = defineScenery({
  name: 'l2-chunks',
  // kept clear of the flight box by its own radius, so a big one never leans into the lane (rules 15, 16)
  stream: { every: [24, 50], place: (R, api) => { const r = R.range(3, 12); return { type: 'l2-chunk', x: side(R, api.box.x * 1.5 + r, api.box.x * 1.5 + r + 34), y: R.range(-24, 24), r, v: R.int(0, 2), a: R() * 6, b: R() * 6, c: R() * 6, spin: (R() - 0.5) * 0.01 }; } },
});
export const slabs = defineScenery({
  name: 'l2-slabs',
  stream: { every: [70, 130], place: (R, api) => { const up = R() < 0.5; return { type: 'l2-slab', x: R.range(-40, 40), y: (up ? 1 : -1) * (api.box.y * 1.7 + R.range(10, 26)), v: R.int(0, 1), s: R.range(0.8, 1.4), rx: (R() - 0.5) * 0.3, ry: R() * 6, rz: (R() - 0.5) * 0.4 }; } },
});
// the canyon of the core dash: slabs stood on edge either side; they close in across the section
export const canyon = defineScenery({
  name: 'l2-canyon',
  stream: { every: [14, 22], place: (R, api) => {
    const L = api.level, s = L && L.sections.find((q) => q.id === 'core'), k = s ? clamp((api.G.courseD - s.d0) / (s.d1 - s.d0), 0, 1) : 0;
    const gap = api.box.x * 1.7 + 6 + 26 * (1 - k);
    return [-1, 1].map((sd) => ({ type: 'l2-slab', x: sd * (gap + R.range(0, 6)), y: R.range(-6, 6), v: R.int(0, 1), s: R.range(0.9, 1.3), rx: (R() - 0.5) * 0.25, ry: Math.PI / 2 + (R() - 0.5) * 0.4, rz: Math.PI / 2 + (R() - 0.5) * 0.2, dz: R.range(-6, 6) }));
  } },
});
export const dustRivers = defineScenery({
  name: 'l2-dust-rivers',
  stream: { every: [110, 190], place: (R, api) => ({ type: 'l2-dust', x: R.range(-20, 20), y: side(R, api.box.y * 1.6 + 4, api.box.y * 1.6 + 30), ph: R(), amp: R.range(3, 9), n: 80, flow: R.range(0.02, 0.05) * R.sign(), w: R.range(160, 260) }) },
});

// ---- set pieces
// the broken moon: rock shards of a huge sphere hung far off to the upper right, the sun burning through the gaps
export const brokenMoon = defineScenery({
  name: 'l2-moon',
  ease: 0.5,
  init(api) {
    const g = new THREE.Group(), R = rng(2024);
    const mat = new THREE.MeshLambertMaterial({ color: 0x6a5a4e, flatShading: true, fog: false, transparent: true, opacity: 0 });
    const geo = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 9; i++) {
      // pieces of one sphere's shell, pulled apart along their own direction, the gaps open toward the sun
      const dir = new THREE.Vector3(R.range(-1, 1), R.range(-1, 1), R.range(-0.4, 1)).normalize();
      const m = new THREE.Mesh(geo, mat); const r = R.range(40, 85);
      m.scale.set(r, r * R.range(0.6, 0.9), r * R.range(0.5, 0.8));
      m.position.copy(dir).multiplyScalar(120 + R.range(10, 70));
      m.rotation.set(R() * 6, R() * 6, R() * 6); g.add(m);
    }
    const sunMat = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffd8a0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0 });
    const sun = new THREE.Sprite(sunMat); sun.scale.set(520, 520, 1); sun.position.set(0, 0, -160); g.add(sun);
    g.position.set(300, 210, -860); g.renderOrder = -5; g.visible = false;
    api.scene.add(g);
    return { g, mat, sunMat };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003;
    s.mat.opacity = w; s.sunMat.opacity = 0.55 * w;
    s.g.rotation.z += dt * 0.004;
    s.g.position.z = -860 + Math.min(api.G.dist * 0.01, 150);
  },
});
// shafts of sunlight through the cracks: long faint beams from the upper right, slowly sweeping
export const sunShafts = defineScenery({
  name: 'l2-shafts',
  ease: 0.4,
  init(api) {
    const g = new THREE.Group(), R = rng(77), mats = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.MeshBasicMaterial({ color: 0xffd8a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(R.range(8, 26), 900), m);
      p.position.set(R.range(-160, 260), R.range(40, 140), R.range(-650, -250));
      p.rotation.set(R.range(-0.3, 0.3), R.range(-0.4, 0.4), 0.55 + R.range(-0.15, 0.15));
      p.userData.base = R.range(0.025, 0.06); p.userData.ph = R() * 6;
      mats.push(m); g.add(p);
    }
    g.visible = false; api.scene.add(g);
    return { g, mats };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003;
    for (const p of s.g.children) { p.userData.ph += dt * 0.3; p.material.opacity = w * p.userData.base * (0.75 + 0.25 * Math.sin(p.userData.ph)); }
  },
});
