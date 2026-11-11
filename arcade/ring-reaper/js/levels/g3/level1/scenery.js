// GALAXY 3, LEVEL 1, THE SCAFFOLD: the scenery (ruling 5: the view never goes blank). All of it is Yori's
// (art-incoming/yori/g3/g3-scenery.js scaffoldTower, halfStar; g3-lib.js wireRect, ibeam, bar; look sheet
// g3-level-01-the-scaffold): "black with white lines; the plan drawn before the thing".
//  - g3-l1-tower      a scaffold tower beside, above or under the lane, part built and part plan; a short one is a perch
//  - g3-l1-floor      THE FRAMEWORK: one floor of a tower built round the lane. Far off it is its plan (white); as it
//                     nears, steel I-beams swing into the plan, so you fly up the core of a tower that builds round you
//  - streams          towers either side, floors in the Framework
//  - g3-l1-grid       a set piece: the faint blueprint grid on the dark below the lane, sliding by
//  - g3-l1-halfstar   the landmark: a half-built star hanging in its scaffold, its finished half burning lilac-white
import { THREE, defineScenery, defineDecor, Instanced, material, clamp, smoothstep } from '../../../api.js?v=0.6.1';
import { MESH } from './mesh.js?v=0.6.1';
import { MESH as F } from './frame.js?v=0.6.1';

const tmpQ = new THREE.Quaternion(), eul = new THREE.Euler(), IDQ = new THREE.Quaternion();
const geoOf = (g) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.computeVertexNormals(); geo.computeBoundingSphere(); return geo; };
const layers = (api, groups, cap, mat) => groups.map((g) => new Instanced(api.scene, geoOf(g), mat ? mat(g) : material(g.color, g.glow), cap));
const putAll = (Ls, x, y, z, q, sx, sy, sz) => { for (const l of Ls) l.put(x, y, z, q, sx, sy, sz); };

// ---------------------------------------------------------------- a scaffold tower, as decor
let TW = null;
export const tower = defineDecor({
  name: 'g3-l1-tower',
  init(api) { TW = [layers(api, MESH.towerA, 70), layers(api, MESH.towerB, 70)]; },
  begin() { for (const t of TW) for (const l of t) l.begin(); },
  end() { for (const t of TW) for (const l of t) l.end(); },
  sample: { x: 40, y: -10, s: 1 },
  // dy: metres to drop it below its event's point (a perch: its top under a sniper)
  spawn(e, ev) { e.v = ev.v || 0; e.s = ev.s || 1; e.yaw = ev.yaw || 0; e.lie = !!ev.lie; if (ev.dy) e.y -= ev.dy; },
  update(e, dt, api) {
    const a = e.appear, s = e.s * a;
    tmpQ.setFromEuler(eul.set(0, e.yaw, e.lie ? Math.PI / 2 : 0));
    putAll(TW[e.v], e.x, e.y, e.z, tmpQ, s, s, s);
    if (e.z > 40 * e.s + 20) e.alive = false;
  },
});
export const towers = defineScenery({
  name: 'g3-l1-towers',
  stream: {
    every: [46, 84],
    place: (R, api, w) => {
      const B = api.box, side = R.sign(), v = R() < 0.55 ? 0 : 1, s = R.range(0.9, 1.5);
      if (R() < 0.3) return { type: 'g3-l1-tower', x: R.range(-2.6, 2.6) * B.x, y: -B.y * 1.4 - 20 * s - R.range(9, 20), v, s, yaw: R.range(0, 6) }; // rising from below, its top well under the lane
      if (R() < 0.15) return { type: 'g3-l1-tower', x: R.range(-1.2, 1.2) * B.x, y: B.y * 1.5 + 6.5 * s + R.range(2, 6), v, s, yaw: R.range(0, 6), lie: true }; // a span lying over the lane
      return { type: 'g3-l1-tower', x: side * (B.x * R.range(1.75, 4) + 7 * s), y: R.range(-1.2, 1.8) * B.y, v, s, yaw: R.range(0, 6) };
    },
  },
});

// ---------------------------------------------------------------- THE FRAMEWORK: a floor of a tower round the lane
let FL = null;
export const floor = defineDecor({
  name: 'g3-l1-floor',
  init(api) { FL = { plan: layers(api, F.floorPlan, 60), h: layers(api, F.beamH, 120), v: layers(api, F.beamV, 120) }; },
  begin() { for (const k in FL) for (const l of FL[k]) l.begin(); },
  end() { for (const k in FL) for (const l of FL[k]) l.end(); },
  sample: { x: 0, y: 0 },
  spawn(e, ev, api) { e.x = 0; e.y = 0; e.rot = ev.rot || 0; e.k = ev.k ?? 1; },
  update(e, dt, api) {
    const B = api.box, a = e.appear, W = B.x * 1.62, H = B.y * 1.66;
    tmpQ.setFromEuler(eul.set(0, 0, e.rot));
    // the plan: its white outline at the floor's size
    putAll(FL.plan, 0, 0, e.z, tmpQ, W * 2 / 24 * a, H * 2 / 18 * a, a);
    // the build: from 320 m out to 70 m, four beams swing in from beyond the plan, one after another
    const b = clamp((-e.z - 70) / 250, 0, 1), p = (i) => smoothstep(0, 1, clamp(((1 - b) - i * 0.18) / 0.4, 0, 1));
    const cr = Math.cos(e.rot), sr = Math.sin(e.rot);
    const put = (Ls, x, y, sx, sy, k) => { if (k <= 0) return; const out = (1 - k) * 14, dx = x === 0 ? 0 : Math.sign(x) * out, dy = y === 0 ? 0 : Math.sign(y) * out;
      const X = (x + dx) * a, Y = (y + dy) * a; putAll(Ls, X * cr - Y * sr, X * sr + Y * cr, e.z - (1 - k) * 18, tmpQ, sx * a, sy * a, a); };
    put(FL.h, 0, -H, W * 2 / 24, 1, p(0)); put(FL.v, -W, 0, 1, H * 2 / 18, p(1)); put(FL.v, W, 0, 1, H * 2 / 18, p(2)); put(FL.h, 0, H, W * 2 / 24, 1, p(3));
    if (e.z > 30) e.alive = false;
  },
});
export const floors = defineScenery({
  name: 'g3-l1-floors',
  stream: { every: [34, 40], place: (R) => ({ type: 'g3-l1-floor', rot: 0 }) },
});

// ---------------------------------------------------------------- the faint blueprint grid on the dark below
export const grid = defineScenery({
  name: 'g3-l1-grid',
  ease: 0.5,
  init(api) {
    const geo = geoOf(F.gridLine[0]);
    const mat = new THREE.MeshBasicMaterial({ color: 0x3a4466, transparent: true, opacity: 0, depthWrite: false, fog: true });
    const along = new Instanced(api.scene, geo, mat, 24), across = new Instanced(api.scene, geo, mat, 24);
    return { along, across, mat, odo: 0 };
  },
  update(S, w, dt, api) {
    S.odo += (api.v || 0) * dt;
    S.mat.opacity = 0.55 * w;
    const y = -38, len = 1400, q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    S.along.begin(); S.across.begin();
    if (w > 0.003) {
      for (let i = -9; i <= 9; i++) S.along.put(i * 24, y, -len / 2 + 20, q, len, 1, 1);
      const off = S.odo % 48;
      for (let j = 0; j < 18; j++) S.across.put(0, y, 10 - j * 48 + off, IDQ, 440, 1, 1);
    }
    S.along.end(); S.across.end();
    S.along.mesh.visible = S.across.mesh.visible = w > 0.003;
  },
});

// ---------------------------------------------------------------- the landmark: the half-built star
export const halfStar = defineScenery({
  name: 'g3-l1-halfstar',
  ease: 0.35,
  init(api) {
    const g = new THREE.Group(), mats = [];
    for (const grp of MESH.halfStar) {
      const m = material(grp.color, grp.glow, true); m.transparent = true; m.opacity = 0; m.fog = false; m.depthWrite = false; mats.push(m);
      g.add(new THREE.Mesh(geoOf(grp), m));
    }
    g.position.set(-300, 150, -880); g.scale.setScalar(4.2); g.rotation.set(0.2, 0.9, 0.1);
    g.renderOrder = -1; api.scene.add(g); g.visible = false;
    return { g, mats, t: 0 };
  },
  update(S, w, dt) {
    S.t += dt;
    S.g.rotation.y = 0.9 + S.t * 0.012;
    for (const m of S.mats) m.opacity = w;
    S.g.visible = w > 0.003;
  },
});
