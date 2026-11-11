// GALAXY 3, LEVEL 3, THE LOCKWORKS: the scenery (ruling 5). All of it Yori's (art-incoming/yori/g3/g3-scenery.js
// bulkheadFrame, craneLandmark; the pipework is her bypass duct, g3-enemies.js bypassDuct; look sheet
// g3-level-03-the-lockworks): "industrial bulkheads: square corridor frames, hot copper studs, sealed gates with red
// keystones, ducts, and the Foreman's crane over everything from the start. The warmest level in a cold galaxy."
//  - g3-l3-frame   a square bulkhead frame round the lane (the lane runs down a corridor of them)
//  - g3-l3-pipe    a run of her duct beside, above or under the lane: the works' pipework
//  - g3-l3-crane   a set piece: the Foreman's crane on the horizon, the landmark, there from the first second
import { THREE, defineScenery, defineDecor, Instanced, material } from '../../../api.js?v=0.6.0';
import { MESH } from './mesh.js?v=0.6.0';
import { MESH as DUCT } from '../../../obstacles/g3-lockgate/duct.js?v=0.6.0';

const tmpQ = new THREE.Quaternion(), eul = new THREE.Euler();
const geoOf = (g) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.computeVertexNormals(); geo.computeBoundingSphere(); return geo; };
const layers = (api, groups, cap) => groups.map((g) => new Instanced(api.scene, geoOf(g), material(g.color, g.glow), cap));
const putAll = (Ls, x, y, z, q, sx, sy, sz) => { for (const l of Ls) l.put(x, y, z, q, sx, sy, sz); };

// ---------------------------------------------------------------- a bulkhead frame round the lane
let FR = null;
export const frame = defineDecor({
  name: 'g3-l3-frame',
  init(api) { FR = layers(api, MESH.bulkhead, 40); },
  begin() { for (const l of FR) l.begin(); },
  end() { for (const l of FR) l.end(); },
  sample: { x: 0, y: 0 },
  spawn(e, ev) { e.x = 0; e.y = 0; e.roll = ev.roll || 0; },
  update(e, dt, api) {
    // its inside (27 of her 30) clears the lane by half a box on every side
    const B = api.box, a = e.appear, sx = B.x * 2 * 1.55 / 27, sy = B.y * 2 * 1.6 / 27;
    tmpQ.setFromEuler(eul.set(0, Math.PI, e.roll)); // her frame faces -Z: turned half round, its studs to you
    putAll(FR, 0, 0, e.z, tmpQ, sx * a, sy * a, Math.min(sx, sy) * a);
    if (e.z > 30) e.alive = false;
  },
});
export const frames = defineScenery({
  name: 'g3-l3-frames',
  stream: { every: [70, 140], place: () => ({ type: 'g3-l3-frame' }) },
});

// ---------------------------------------------------------------- pipework: her duct, in runs beside the lane
let PI_ = null;
export const pipe = defineDecor({
  name: 'g3-l3-pipe',
  init(api) { PI_ = layers(api, DUCT.duct, 140); },
  begin() { for (const l of PI_) l.begin(); },
  end() { for (const l of PI_) l.end(); },
  sample: { x: 20, y: 0 },
  spawn(e, ev) { e.k = ev.k || 1; e.n = ev.n || 3; e.roll = ev.roll || 0; },
  update(e, dt, api) {
    const a = e.appear, k = e.k * a;
    tmpQ.setFromEuler(eul.set(0, 0, e.roll));
    for (let i = 0; i < e.n; i++) putAll(PI_, e.x, e.y, e.z - i * 12 * e.k, tmpQ, k, k, k);
    if (e.z - e.n * 12 * e.k > 30) e.alive = false;
  },
});
export const pipes = defineScenery({
  name: 'g3-l3-pipes',
  stream: {
    every: [40, 90],
    place: (R, api) => {
      const B = api.box, k = R.range(0.9, 1.6), n = R.int(2, 5);
      if (R() < 0.35) return { type: 'g3-l3-pipe', x: R.range(-1.3, 1.3) * B.x, y: (R() < 0.5 ? -1 : 1) * (B.y * 1.6 + 3 * k), k, n };
      return { type: 'g3-l3-pipe', x: R.sign() * (B.x * R.range(1.75, 3.2) + 3 * k), y: R.range(-1.4, 1.4) * B.y, k, n, roll: R() < 0.5 ? 0 : Math.PI / 4 };
    },
  },
});

// ---------------------------------------------------------------- the Foreman's crane on the horizon
export const crane = defineScenery({
  name: 'g3-l3-crane',
  ease: 0.35,
  init(api) {
    const g = new THREE.Group(), mats = [];
    for (const grp of MESH.crane) {
      const m = material(grp.color, grp.glow, true); m.transparent = true; m.opacity = 0; m.fog = false; mats.push(m);
      g.add(new THREE.Mesh(geoOf(grp), m));
    }
    g.position.set(150, 40, -900); g.scale.setScalar(4.4); g.rotation.set(0, -0.5, 0);
    api.scene.add(g); g.visible = false;
    return { g, mats, t: 0 };
  },
  update(S, w, dt) {
    S.t += dt;
    S.g.rotation.y = -0.5 + Math.sin(S.t * 0.07) * 0.25; // the jib swings, slowly, the whole level
    for (const m of S.mats) m.opacity = w;
    S.g.visible = w > 0.003;
  },
});
