// GALAXY 2, LEVEL 1, TIDEWAY: its pieces, from Yori's look sheet (art-incoming/yori/g2/looks/level-g2-01-tideway.png):
// jade coral heads (in the lane they are the rocks: a hit, and they shatter; beside it they are the reef), kelp on the
// banks that leans with the water (it asks the current module: the tide's tell), plankton motes drifting past all the
// time, soft light-shafts from above like sun through water, and the landmark, the REEF ARCH: a kilometre ring of
// living jade coral the Tide Race runs through (her reefArch, built from its band and her own placement loop).
// Galaxy 2 levels 2 and 3 share the coral, the kelp, the motes and the shafts (they are this branch's).
import { THREE, defineObstacle, defineDecor, defineScenery, Instanced, modelGroups, GlowPoints, rng, clamp, smoothstep, SHIP_R, READ_D } from '../../../api.js?v=0.6.3';
import { MESH } from './mesh.js?v=0.6.3';
import { flowAt } from '../../../obstacles/g2-current/index.js?v=0.6.3';

const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), ax = new THREE.Vector3();
const side = (R, lo, hi) => R.sign() * R.range(lo, hi);
const lambert = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
const basic = (c) => new THREE.MeshBasicMaterial({ color: c });
const layersOf = (api, model, cap) => modelGroups(model).map((g) => new Instanced(api.scene, g.geo, g.glow ? basic(g.color) : lambert(g.color), cap));

// ---- CORAL HEADS (her coralHead: a jade rock with lit nubs). In the lane: a hit, and it shatters (galaxy 1's rocks, the
// plan's "rocks as coral heads"); with decor: true it is the reef beside the lane and never collides.
//   add(d, 'g2-l1-coral', { nx, ny, r: 1.6..3.2 })
let coralL;
export const coral = defineObstacle({
  name: 'g2-l1-coral',
  breaks: true,
  hazard: { cls: 'static', introduced: [2, 1] },
  sample: { r: 1, v: 0 },
  avoid: (e) => (e.decor ? [] : [{ x: e.x, y: e.y, r: e.r * 0.9 + 1.7 }]),
  // the 0.3.1 check (no fully blocked moment): where it is solid as it crosses the ship's plane
  solid: (ev, box) => (ev.decor ? [] : [{ dist: (x, y) => Math.hypot(x - (ev.nx || 0) * box.x, y - (ev.ny || 0) * box.y) - (ev.r || 2) * 0.82 }]),
  init(api) { coralL = ['coralA', 'coralB', 'coralC'].map((k) => layersOf(api, MESH[k], 220)); },
  begin() { for (const v of coralL) for (const L of v) L.begin(); },
  end() { for (const v of coralL) for (const L of v) L.end(); },
  spawn(e, ev) {
    e.r = ev.r || 2; e.decor = !!ev.decor; e.v = (ev.v ?? Math.abs(Math.round((ev.d || 0) * 7.31))) % 3;
    e.q = new THREE.Quaternion().setFromEuler(tmpE.set((ev.d || 0) % 6, ((ev.d || 0) * 1.7) % 6, 0));
    e.spin = new THREE.Quaternion().setFromAxisAngle(ax.set(0.3, 1, 0.2).normalize(), (e.decor ? 0.002 : 0.01) * (e.v - 1));
  },
  update(e, dt, api) {
    e.q.multiply(e.spin);
    const s = e.r / 5 * e.appear;                       // her heads are 5 across the middle
    for (const L of coralL[e.v]) L.put(e.x, e.y, e.z, e.q, s, s, s);
    if (!e.decor && !e.hit && Math.abs(e.z) < e.r + 1.2) {
      const reach = e.r * 0.82 + SHIP_R;
      if (Math.hypot(api.ship.x - e.x, api.ship.y - e.y) < reach && Math.abs(e.z) < e.r * 0.8 + 0.6) { e.hit = true; e.alive = api.game.crash(e, 22) !== 'gone'; }
    }
    if (e.z > 40) e.alive = false;
  },
});

// ---- KELP (her kelpStrand in five leans): a strand on the bank, leaning the way the water runs where it stands
const LEANS = ['kelpL2', 'kelpL1', 'kelp0', 'kelpR1', 'kelpR2'];
let kelpL;
export const kelp = defineDecor({
  name: 'g2-l1-kelp',
  sample: { s: 1 },
  init(api) { kelpL = LEANS.map((k) => layersOf(api, MESH[k], 260)); },
  begin() { for (const v of kelpL) for (const L of v) L.begin(); },
  end() { for (const v of kelpL) for (const L of v) L.end(); },
  spawn(e, ev) { e.s = ev.s || 1; e.ph = ev.ph || 0; e.lean = 0; e.q = new THREE.Quaternion(); e.flip = ev.flipY ? -1 : 1; },
  update(e, dt, api) {
    // the water here: a cross current leans it (her lean +-0.6 at a current of half a box a second and more)
    const w = flowAt(api, e.z);
    e.lean += (clamp(w.fx * 1.3, -0.6, 0.6) - e.lean) * Math.min(1, dt * 3);
    const i = clamp(Math.round((e.lean + 0.6) / 0.3), 0, 4);
    tmpE.set(0, Math.sin(e.t * 0.7 + e.ph) * 0.15, Math.sin(e.t * 1.1 + e.ph) * 0.05 + (e.flip < 0 ? Math.PI : 0)); e.q.setFromEuler(tmpE);
    const s = e.s * e.appear;
    for (const L of kelpL[e.flip < 0 ? 4 - i : i]) L.put(e.x, e.y, e.z, e.q, s, s, s);
    if (e.z > 40) e.alive = false;
  },
});

// ---- PLANKTON: motes drifting past the ship all the time, outside the box (ruling 5: the view never goes blank)
let moteL;
export const motes = defineDecor({
  name: 'g2-l1-mote',
  sample: { n: 4, w: 10 },
  init(api) { moteL = new GlowPoints(api.scene, 3000, api.glowTex).setFar(500, 780); },
  begin() { moteL.begin(); },
  end() { moteL.end(); },
  spawn(e, ev) { e.n = ev.n || 10; e.w = ev.w || 14; e.ph = ev.ph || 0; e.col = ev.col || [0.62, 1, 0.76]; },
  update(e, dt, api) {
    const a = e.appear * 0.55 * smoothstep(-5, -60, e.z), c = e.col;   // gone before it can reach the lens
    for (let i = 0; i < e.n; i++) {
      const u = i / e.n, x = e.x + Math.sin(u * 37.1 + e.ph) * e.w, y = e.y + Math.cos(u * 23.7 + e.ph) * e.w * 0.6 + Math.sin(e.t * 0.6 + i) * 0.4;
      moteL.push(x, y, e.z + Math.sin(u * 13.3) * 18, (0.35 + 0.3 * Math.abs(Math.sin(i * 7.7))) * e.appear * 2.2, c[0], c[1], c[2], a * (0.6 + 0.4 * Math.sin(e.t * 2 + i)));
    }
    if (e.z > -2) e.alive = false;
  },
});

// ---- streams (each section names the ones it wants)
const outside = (R, api, pad = 0) => (R() < 0.7 ? { x: side(R, api.box.x * 1.55 + pad, api.box.x * 1.55 + pad + 26), y: R.range(-api.box.y * 2.2, api.box.y * 1.6) } : { x: R.range(-api.box.x * 2.4, api.box.x * 2.4), y: -(api.box.y * 1.7 + pad + R.range(6, 20)) });
export const reef = defineScenery({
  name: 'g2-l1-reef',
  stream: { every: [18, 40], place: (R, api) => { const r = R.range(3, 7), o = outside(R, api, r + 3); return { type: 'g2-l1-coral', decor: true, x: o.x, y: o.y, r, v: R.int(0, 2) }; } },
});
export const kelpBanks = defineScenery({
  name: 'g2-l1-kelp-banks',
  stream: { every: [10, 22], place: (R, api) => { const s = R.range(0.8, 1.7), sd = R.sign(); return { type: 'g2-l1-kelp', x: sd * (api.box.x * 1.5 + R.range(2, 22)), y: -api.box.y * 1.25 - R.range(0, 6) + s * 7, s, ph: R() * 6 }; } },
});
export const plankton = defineScenery({
  name: 'g2-l1-plankton',
  stream: { every: [30, 60], place: (R, api) => ({ type: 'g2-l1-mote', x: side(R, api.box.x * 1.6, api.box.x * 3.2), y: R.range(-api.box.y * 2, api.box.y * 2), n: 14, w: R.range(8, 18), ph: R() * 9 }) },
});

// ---- set pieces
// soft light-shafts from above, like sun through water: long faint planes of the key light, far off and slanting
export function makeShafts(name, color, seed = 11) {
  return defineScenery({
    name, ease: 0.5,
    init(api) {
      const g = new THREE.Group(), R = rng(seed);
      const mat = new THREE.MeshBasicMaterial({ map: api.glowTex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
      const geo = new THREE.PlaneGeometry(1, 1);
      for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(geo, mat); m.scale.set(R.range(60, 140), R.range(900, 1500), 1); m.position.set(R.range(-700, 700), R.range(250, 500), -R.range(900, 1400)); m.rotation.z = R.range(-0.35, 0.35); g.add(m); }
      g.renderOrder = -4; g.visible = false; api.scene.add(g);
      return { g, mat };
    },
    update(s, w) { s.g.visible = w > 0.003; s.mat.opacity = 0.09 * w; },
  });
}
export const shafts = makeShafts('g2-l1-shafts', 0xe0ffe8, 11);

// THE REEF ARCH: her reefArch(60) at x7 (a ring 840 m across): the band, 20 coral heads round it, 12 kelp strands. It
// stands across the lane at course distance ARCH.d (the level sets it) and is flown through; it fades in from far out.
export const ARCH = { d: 0, scale: 7 };
export const reefArch = defineScenery({
  name: 'g2-l1-arch', ease: 0.4,
  init(api) {
    const g = new THREE.Group(), mats = [], S = ARCH.scale;
    const mk = (c, glow) => { const m = glow ? new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, fog: false }) : new THREE.MeshLambertMaterial({ color: c, flatShading: true, transparent: true, opacity: 0, fog: false }); mats.push(m); return m; };
    for (const gr of modelGroups(MESH.archBand)) { const m = new THREE.Mesh(gr.geo, mk(gr.color, gr.glow)); m.scale.setScalar(S); g.add(m); }
    const place = (model, list, mat4) => {
      for (const gr of modelGroups(model)) {
        const im = new THREE.InstancedMesh(gr.geo, mk(gr.color, gr.glow), list.length); im.frustumCulled = false;
        list.forEach((p, i) => im.setMatrixAt(i, mat4(p))); g.add(im);
      }
    };
    const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), Sc = new THREE.Vector3();
    ['coralA', 'coralB', 'coralC'].forEach((k, v) => place(MESH[k], MESH.archHeads.filter((h) => h[0] === v), (h) => M.compose(P.set(h[1] * S, h[2] * S, h[3] * S), Q.identity(), Sc.setScalar(h[4] * S))));
    place(MESH.kelpR1, MESH.archKelp, (k) => M.compose(P.set(k[0] * S, k[1] * S, k[2] * S), Q.setFromAxisAngle(ax.set(0, 0, 1), k[3]), Sc.setScalar(k[4] * S)));
    g.visible = false; g.renderOrder = -3; api.scene.add(g);
    return { g, mats };
  },
  update(s, w, dt, api) {
    const z = -(ARCH.d - (api.G.courseD || 0));
    const far = smoothstep(-2600, -1500, z) * smoothstep(400, 60, z);  // it condenses out of the deep, and is gone once passed
    const o = w * far;
    s.g.visible = o > 0.003;
    s.g.position.set(0, 0, z); s.g.rotation.z = (api.G.courseD || 0) * 0.00005;
    for (const m of s.mats) m.opacity = o;
  },
});
export { READ_D };
