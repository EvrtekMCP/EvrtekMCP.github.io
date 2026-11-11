// THE FRAME WALL (the Fractal Yard, the plan's 4.8: "PHASE through a frame wall to a cache"). Yori's built blueprint wall
// (g3-enemies.js blueprintWall, graphite with red edges and its white plan frame) at a third of its size, filling one
// corner of the lane; a stack of four of them, 14 m apart, with a cache ring hidden in each gap. Solid: fly into one and
// it hits you. Under a Phase you pass straight through (PHASED!) and the cache is yours. The open lane beside it is
// always free, and nothing that counts toward a star is behind it.
// The clues (the plan's 6.4: every hidden reward shows at least two), on the front slab only:
//   CRACK       Yori's phase crack (g2 powerups.js phaseCrack), translucent violet on its face: "Phase gets you through"
//   GLOW BLEED  amber light leaking round its edges: "something is back there, and it is rings"
//   SPARKS      amber motes drifting out of its edges: "it's close"
//   RING TRAIL  laid by the level: three cache rings running into it
//   Event: { nx, ny (its middle), crack (the front slab) }
import { THREE, defineObstacle, buildModel, SHIP_R } from '../../../api.js?v=0.6.2';
import { MESH } from './wall-mesh.js?v=0.6.2';
import { MESH as CRACK } from './crack-mesh.js?v=0.6.2';

export const WSC = 0.42, HW = 24 * WSC / 2, HH = 14 * WSC / 2;   // 10.1 x 5.9 m
let glowMat = null;
function make() {
  const g = new THREE.Group(), inner = new THREE.Group(); inner.rotation.y = Math.PI; g.add(inner);
  inner.add(buildModel(MESH.wall).group);
  // her crack, laid on the face: the patch translucent, the cracks lit
  const crack = buildModel(CRACK.crack, { own: ['#5a3aa0*', '#9b6bff*'] });
  const patch = crack.mats['#5a3aa0*']; patch.transparent = true; patch.opacity = 0.5; patch.depthWrite = false;
  crack.group.scale.setScalar(2.4); crack.group.position.set(0, 0, -0.75); inner.add(crack.group);
  const bleed = [];
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1.05], [0, -1.05]]) { const s = new THREE.Sprite(glowMat.clone()); s.position.set(x * 12.2, y * 7.2, 1.2); s.scale.setScalar(15); inner.add(s); bleed.push(s); }
  g.userData = { crack: crack.group, bleed };
  return g;
}
export const frameWall = defineObstacle({
  name: 'g3-l8-wall',
  hazard: { cls: 'static', introduced: [3, 8] },
  sample: { nx: 0.5, ny: 0.5, crack: true },
  init(api) { glowMat = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffb020, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }); },
  spawn(e, ev, api) {
    e.obj = api.course.get('g3-l8-wall', make);
    e.sx = e.sy = e.sz = WSC; e.r = Math.hypot(HW, HH);
    const u = e.obj.userData; u.crack.visible = !!ev.crack; for (const b of u.bleed) b.visible = !!ev.crack;
  },
  update(e, dt, api) {
    const u = e.obj.userData;
    if (e.ev.crack) {
      const p = 0.5 + 0.5 * Math.sin(e.t * 4.2);
      for (const b of u.bleed) b.material.opacity = (0.35 + 0.3 * p) * e.appear;
      if (e.z < -20 && e.z > -320 && Math.random() < dt * 9) {
        const sx = Math.random() < 0.5 ? -1 : 1;
        api.game.emit(e.x + sx * HW * (0.6 + Math.random() * 0.45), e.y + (Math.random() - 0.5) * HH * 2.1, e.z + 1, { life: 0.9, s0: 0.5, s1: 0.1, r: 1, g: 0.78, b: 0.25, a: 0.9, vx: sx * 1.5, vy: 0.8, carry: 1 });
      }
    }
    api.pose(e);
    if (e.crossed && Math.abs(api.ship.x - e.x) < HW + SHIP_R * 0.6 && Math.abs(api.ship.y - e.y) < HH + SHIP_R * 0.6) api.game.crash(e, 18, false);
    if (e.z > 20) e.alive = false;
  },
  avoid(e) { return [{ x: e.x, y: e.y, r: Math.max(HW, HH) + 1.4 }]; },
  // the blocked-moment check (0.3.1's): a rectangle, solid as it crosses
  solid(ev, B) { const cx = (ev.nx || 0) * B.x, cy = (ev.ny || 0) * B.y; return [{ at: 0, dist: (x, y) => { const dx = Math.abs(x - cx) - HW, dy = Math.abs(y - cy) - HH; return dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy); } }]; },
});
