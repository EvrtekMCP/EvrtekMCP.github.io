// GALAXY 3, LEVEL 2, THE LOOM FLOOR: the scenery (ruling 5). All of it Yori's (art-incoming/yori/g3/g3-scenery.js
// loomPlain, spoolPost; the rails from her g3-lib bars, without the parked shuttle, so nothing on the course that
// looks like an enemy is not one; look sheet g3-level-02-the-loom-floor): "a woven plain kilometres wide below the
// lane, its threads glowing ultraviolet, shuttles running rails beside you, tall spool posts. The most violet level".
//  - g3-l2-floor   a set piece: the woven plain, tiled under the lane to the horizon and sliding by
//  - g3-l2-spool   a spool post standing on the plain beside the lane, its thread running down to the weave
//  - g3-l2-rail    a section of shuttle rail on its legs, along the lane's edge (where the shuttlers ride)
import { THREE, defineScenery, defineDecor, Instanced, material } from '../../../api.js?v=0.6.4';
import { MESH } from './mesh.js?v=0.6.4';
import { MESH as RAIL } from './rail.js?v=0.6.4';

export const FLOOR_Y = -16;              // the plain, metres under the lane's middle
const tmpQ = new THREE.Quaternion(), eul = new THREE.Euler(), IDQ = new THREE.Quaternion();
const geoOf = (g) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.computeVertexNormals(); geo.computeBoundingSphere(); return geo; };
const layers = (api, groups, cap) => groups.map((g) => new Instanced(api.scene, geoOf(g), material(g.color, g.glow), cap));
const putAll = (Ls, x, y, z, q, sx, sy, sz) => { for (const l of Ls) l.put(x, y, z, q, sx, sy, sz); };

// ---------------------------------------------------------------- the woven plain
export const loomFloor = defineScenery({
  name: 'g3-l2-floor',
  ease: 0.5,
  init(api) {
    const Ls = MESH.loom.map((g) => {
      const m = new THREE.MeshBasicMaterial({ color: g.color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      return new Instanced(api.scene, geoOf(g), m, 30);
    });
    return { Ls, odo: 0 };
  },
  update(S, w, dt, api) {
    S.odo += (api.v || 0) * dt;
    for (const l of S.Ls) { l.mesh.material.opacity = 0.85 * w; l.begin(); }
    if (w > 0.003) {
      const off = S.odo % 200;
      for (let k = 0; k < 6; k++) for (const x of [-120, 0, 120]) for (const l of S.Ls) l.put(x, FLOOR_Y, -k * 200 + 60 + off, IDQ, 1, 1, 1);
    }
    for (const l of S.Ls) { l.end(); l.mesh.visible = w > 0.003; }
  },
});

// ---------------------------------------------------------------- a spool post on the plain
let SP = null;
export const spool = defineDecor({
  name: 'g3-l2-spool',
  init(api) { SP = layers(api, MESH.spool, 80); },
  begin() { for (const l of SP) l.begin(); },
  end() { for (const l of SP) l.end(); },
  sample: { x: 40, y: 0 },
  spawn(e, ev) { e.s = ev.s || 1; e.yaw = ev.yaw || 0; e.y = FLOOR_Y + 15 * e.s; },
  update(e, dt) {
    const a = e.appear, s = e.s * a;
    tmpQ.setFromEuler(eul.set(0, e.yaw, 0));
    putAll(SP, e.x, FLOOR_Y + (e.y - FLOOR_Y) * a, e.z, tmpQ, s, s, s);
    if (e.z > 40) e.alive = false;
  },
});
export const spools = defineScenery({
  name: 'g3-l2-spools',
  stream: { every: [36, 70], place: (R, api) => ({ type: 'g3-l2-spool', x: R.sign() * (api.box.x * R.range(1.9, 5) + 4), y: 0, s: R.range(0.8, 1.4), yaw: R.range(0, 6) }) },
});

// ---------------------------------------------------------------- the shuttle rails along the lane's edges
let RB = null, RL = null;
export const rail = defineDecor({
  name: 'g3-l2-rail',
  init(api) { RB = layers(api, RAIL.railBar, 70); RL = layers(api, RAIL.railLeg, 300); },
  begin() { for (const l of RB.concat(RL)) l.begin(); },
  end() { for (const l of RB.concat(RL)) l.end(); },
  sample: { x: 12, y: -1 },
  spawn(e, ev, api) { const B = api.box; e.side = ev.side || 1; e.under = !!ev.under; },
  update(e, dt, api) {
    const B = api.box, a = e.appear;
    // beside the lane at the shuttlers' line, a little under their bodies; or under the lane, across from side to side
    const x = e.under ? 0 : e.side * B.x * 1.3, y = e.under ? -B.y * 1.32 - 0.75 : -0.75;
    putAll(RB, x * a, y * a, e.z, IDQ, a, a, a);
    for (const dz of [-16, -8, 0, 8, 16]) putAll(RL, x * a, y * a - 0.2, e.z + dz, IDQ, a, (e.under ? 1 : 2.4) * a, a);
    if (e.z > 40) e.alive = false;
  },
});
// one continuous rail each side (and under the lane where its section asks): a 40 m section every 40 m
export const rails = defineScenery({
  name: 'g3-l2-rails',
  stream: { every: [40, 40], place: () => [{ type: 'g3-l2-rail', side: -1 }, { type: 'g3-l2-rail', side: 1 }] },
});
export const railsUnder = defineScenery({
  name: 'g3-l2-rails-under',
  stream: { every: [40, 40], place: () => ({ type: 'g3-l2-rail', under: true }) },
});
