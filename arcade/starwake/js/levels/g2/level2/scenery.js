// GALAXY 2, LEVEL 2, THE SHOALS: its pieces, from Yori's look sheet (art-incoming/yori/g2/looks/level-g2-02-the-shoals.png):
// sunlit shallows, the brightest teal level with orchid light in the coral. The landmark is the SPAWNING TREE, a giant
// luminous coral tree the shoals circle. And PHASE's wall: a coral wall across part of the lane with Phase's violet crack
// on it (her phaseCrack: the clue that never changes), sparks of amber drifting out of the crack and a glow bleeding
// round it (the reward's own colour: something is back there). The reef, the kelp, the motes and the shafts are
// Tideway's (level1/scenery.js).
import { THREE, defineObstacle, defineScenery, modelGroups, buildModel, rng, clamp, smoothstep, SHIP_R } from '../../../api.js?v=0.4.1';
import { MESH } from './mesh.js?v=0.4.1';
import { makeShafts } from '../level1/scenery.js?v=0.4.1';

export const shafts = makeShafts('g2-l2-shafts', 0xf0fff4, 23);

// ---- THE CORAL WALL (Phase's wall). It stands across one side of the lane from `edge` outward (side 1: the right, -1:
// the left), the other side always open (no fully blocked moment). Solid: flying into it is a big hit, unless you are
// phasing (PHASED!). Its violet crack sits at `crack` [nx, ny], where the ring trail runs in.
//   add(d, 'g2-l2-wall', { side: 1, edge: -0.05, crack: [0.45, 0.1] })
let crackSparks = null;
function makeWall(api) {
  const g = new THREE.Group();
  const w = buildModel(MESH.wall); g.add(w.group);
  const c = buildModel(MESH.crack, { own: ['#9b6bff*', '#5a3aa0*'] }); g.add(c.group);
  const bleed = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffb020, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5 }));
  g.add(bleed);
  g.userData = { wall: w.group, crack: c.group, crackMats: Object.values(c.mats), bleed };
  return g;
}
export const wall = defineObstacle({
  name: 'g2-l2-wall',
  hazard: { cls: 'static', introduced: [2, 2] },
  sample: { side: 1, edge: 0, crack: [0.4, 0] },
  avoid: (e) => { const B = e.B; if (!B) return []; const x = e.ev.side < 0 ? -1 : 1, ex = (e.ev.edge || 0) * B.x; return [{ x: ex + x * 40, y: 0, r: 40 + 1.4 }]; },
  solid: (ev, box) => { const s = ev.side < 0 ? -1 : 1, ex = (ev.edge || 0) * box.x; return [{ dist: (x) => (x - ex) * -s }]; },
  init(api) { crackSparks = api; },
  spawn(e, ev, api) {
    e.obj = api.course.get('g2-l2-wall', () => makeWall(api));
    const B = api.box, s = ev.side < 0 ? -1 : 1, ex = (ev.edge || 0) * B.x;
    e.B = { x: B.x, y: B.y };
    // her wall is 30 wide and 20 tall: scaled to cover the box's height and more, its edge on `edge`
    const k = Math.max(0.8, (B.y * 3.2) / 20);
    e.k = k; e.x = ex + s * 15 * k; e.y = 0; e.sx = e.sy = e.sz = k; e.hit = false;
    const u = e.obj.userData, cr = ev.crack || [0.45 * s, 0];
    u.crack.position.set((cr[0] * B.x - e.x) / k, (cr[1] * B.y) / k, 2.6);           // on the face toward you
    u.bleed.position.set(u.crack.position.x, u.crack.position.y, 3.2); u.bleed.scale.setScalar(16 / k);
    e.cx = cr[0] * B.x; e.cy = cr[1] * B.y;
  },
  update(e, dt, api) {
    const ev = e.ev, u = e.obj.userData, ship = api.ship;
    // the clues: the crack breathes violet, the amber bleed round it pulses, sparks drift out of it
    const p = 0.5 + 0.5 * Math.sin(e.t * 3.1);
    for (const m of u.crackMats) { m.transparent = true; m.opacity = (0.6 + 0.4 * p) * e.appear; }
    u.bleed.material.opacity = (0.3 + 0.25 * p) * e.appear;
    if (!ev.warm && e.z > -500 && e.z < -4 && Math.random() < dt * 14) api.game.emit(e.cx + (Math.random() - 0.5) * 2, e.cy + (Math.random() - 0.5) * 2, e.z + 2.5, { life: 1.1, s0: 0.45, s1: 0.1, r: 1, g: 0.75, b: 0.2, a: 0.8, carry: 1, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, vz: 6 });
    // solid as it crosses the ship's plane (5 m deep at her scale)
    if (!ev.warm && !e.hit && e.z > -2.5 * e.k && e.z < 2.5 * e.k + 0.5) {
      const s = ev.side < 0 ? -1 : 1, ex = (ev.edge || 0) * api.box.x;
      if ((ship.x - ex) * s > -SHIP_R * 0.6) { e.hit = true; api.game.crash(e, 24); }
    }
    api.pose(e);
    if (e.z > 40) e.alive = false;
  },
});

// ---- THE SPAWNING TREE (her spawningTree(60) at x8: 480 m tall), far off the lane's right, where the shoals are born
export const tree = defineScenery({
  name: 'g2-l2-tree', ease: 0.4,
  init(api) {
    const g = new THREE.Group(), mats = [];
    for (const gr of modelGroups(MESH.tree)) {
      const m = gr.glow ? new THREE.MeshBasicMaterial({ color: gr.color, transparent: true, opacity: 0, fog: false }) : new THREE.MeshLambertMaterial({ color: gr.color, flatShading: true, transparent: true, opacity: 0, fog: false });
      mats.push(m); g.add(new THREE.Mesh(gr.geo, m));
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xd070ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    glow.scale.set(90, 90, 1); glow.position.set(0, 20, 0); g.add(glow);
    g.scale.setScalar(8); g.position.set(620, 60, -1500); g.visible = false; g.renderOrder = -4;
    api.scene.add(g);
    return { g, mats, glow };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003; s.g.rotation.y += dt * 0.02;
    for (const m of s.mats) m.opacity = w * 0.85;
    s.glow.material.opacity = w * (0.35 + 0.1 * Math.sin((api.time || 0) * 0.8));
  },
});
export { rng, clamp, smoothstep };
