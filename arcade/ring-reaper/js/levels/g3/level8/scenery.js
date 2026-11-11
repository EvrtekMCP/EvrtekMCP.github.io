// THE FRACTAL YARD's scenery (Yori's look sheet g3-level-08): a scrapyard of half-built geometry. Her fractal frames
// (triangles of triangles, steel where built and white plan where not) stand either side of the lane at every angle,
// her loose scrap plates lie tilted below it, and far ahead a giant triangle of triangles is still being built: the
// landmark. Cold slate-teal light, everything three-sided. Nothing here collides; everything stays outside the box.
import { THREE, defineScenery, defineDecor, clamp } from '../../../api.js?v=0.6.0';
import { MESH } from './mesh.js?v=0.6.0';
import { layersOf, begin, end, farModel } from '../level7/layers.js?v=0.6.0';

const tmpQ = new THREE.Quaternion(), eul = new THREE.Euler();

// ---------------------------------------------------------------- a fractal frame standing in the yard
let frameL;
export const frame = defineDecor({
  name: 'g3-l8-frame', hazard: null,
  sample: { x: 40, y: 0, s: 1 },
  init(api) { frameL = [layersOf(api, MESH.frame, 40, { selfLit: 0.15, dead: ['#ff3355'] })]; },
  begin() { begin(frameL); }, end() { end(frameL); },
  spawn(e, ev) { e.s = ev.s || 1; e.rx = ev.rx || 0; e.ry = ev.ry || 0; e.rz = ev.rz || 0; e.spin = ev.spin || 0; },
  update(e, dt) {
    e.rz += e.spin * dt;
    tmpQ.setFromEuler(eul.set(e.rx, e.ry, e.rz));
    const s = e.s * e.appear;
    for (const L of frameL[0]) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
    if (e.z > 60) e.alive = false;
  },
});
// a frame 36 across stands with its near edge well outside the box: |x| > the box's 1.5 + its half width
export const frames = defineScenery({
  name: 'g3-l8-frames',
  stream: { every: [55, 100], place: (R, api) => { const b = api.box, s = R.range(0.7, 1.3); if (api.tier === 0 && R() < 0.35) return null; return { type: 'g3-l8-frame', x: R.sign() * (b.x * 1.5 + 18 * s + R.range(2, 30)), y: R.range(-8, 10), s, rx: R.range(-0.3, 0.3), ry: R.sign() * R.range(0.9, 1.4), rz: R.range(0, 6.3), spin: R.range(-0.08, 0.08) }; } },
});

// ---------------------------------------------------------------- scrap plates lying about below the lane
const SCRAP = ['scrapA', 'scrapB', 'scrapC'];
let scrapL;
export const scrap = defineDecor({
  name: 'g3-l8-scrap', hazard: null,
  sample: { x: 20, y: -16, v: 0 },
  init(api) { scrapL = SCRAP.map((m) => layersOf(api, MESH[m], 70, { selfLit: 0.1 })); },
  begin() { begin(scrapL); }, end() { end(scrapL); },
  spawn(e, ev) { e.v = ev.v || 0; e.ry = ev.ry || 0; e.s = ev.s || 1; },
  update(e) {
    tmpQ.setFromEuler(eul.set(0, e.ry, 0));
    const s = e.s * e.appear;
    for (const L of scrapL[e.v]) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
    if (e.z > 40) e.alive = false;
  },
});
export const scrapField = defineScenery({
  name: 'g3-l8-scrapfield',
  stream: { every: [14, 30], place: (R, api) => (api.tier === 0 && R() < 0.4 ? null : { type: 'g3-l8-scrap', x: R.sign() * R.range(9, 50), y: R.range(-32, -24), v: R.int(0, 2), ry: R.range(0, 6.3), s: R.range(0.9, 1.6) }) },
});

// ---------------------------------------------------------------- the landmark: the giant triangle, still being built
export const greatFrame = defineScenery({
  name: 'g3-l8-great-frame',
  ease: 0.4,
  init(api) {
    const g = farModel(MESH.frameBig, { selfLit: 0.3, dead: ['#ff3355'] });
    g.scale.setScalar(3.0); g.position.set(330, 170, -880); g.rotation.set(0.1, -0.55, 0);
    api.scene.add(g);
    return { g };
  },
  update(st, w, dt) { st.g.rotation.z += dt * 0.02; st.g.userData.fade(clamp(w, 0, 1) * 0.85); },
});
