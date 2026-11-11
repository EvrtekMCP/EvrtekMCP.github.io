// THE FOREMAN'S GIRDER (galaxy 3, level 3's boss, phase 2, THE CRANE). Its crane swings a girder across the lane:
// first the girder's PLAN, a white wireframe band right across the lane in front of the cage (1.2 s: the plan never
// lies), then the solid girder (Yori's: art-incoming/yori/g3/g3-bosses.js foremanCrane, the panel it carries) swings
// into the plan from the side and comes down the lane at you. Fly over it or under it.
//   api.spawn({ type: 'g3-foreman-girder', ny, side, boss }, z)    (only the Foreman spawns it)
import { THREE, defineObstacle, buildModel, clamp, smoothstep } from '../../api.js?v=0.6.1';
import { MESH as P } from './parts.js?v=0.6.1';

export const PLAN_T = 1.2;              // seconds the plan shows before the girder is swung in
const SWING_T = 0.3;                     // the swing into the plan
const HALF = 0.95;                       // half the girder's height, metres (her 1.6 scaled)
const SHIP_IN = 0.5;                     // the ship's radius against it (rule 14)

function make() {
  const g = new THREE.Group(), plan = buildModel(P.carriedPlan).group, solid = buildModel(P.carried).group;
  g.add(plan, solid); g.rotation.y = Math.PI; g.userData = { plan, solid }; // her front faces -Z: turned to face you
  return g;
}
export default defineObstacle({
  name: 'g3-foreman-girder',
  motion: 'own',
  hazard: { cls: 'sweep', introduced: [3, 3], warn: () => PLAN_T + 0.6 },
  noWarm: false,
  sample: { ny: 0, side: 1 },
  spawn(e, ev, api) {
    const B = api.box;
    e.obj = api.course.get('g3-foreman-girder', make);
    e.y = clamp((ev.ny || 0) * B.y, -B.y * 0.8, B.y * 0.8); e.x = 0;
    e.side = ev.side || 1; e.boss = ev.boss || null; e.solidT = -1; e.hit = false; e.r = 1;
    e.W = B.x * 1.45 * 2 / 16; e.H = HALF * 2 / 1.6;
    e.sx = e.W; e.sy = e.H; e.sz = 1.2;
    e.obj.userData.plan.visible = true; e.obj.userData.solid.visible = false;
    e.shipSide = api.ship.y >= e.y ? 1 : -1;
    e.appear = 0; // it draws in from nothing (the course poses it once at spawn, before its first update)
    api.game.sfx('g3-blueprint', { vol: 0.6 });
  },
  update(e, dt, api) {
    const ud = e.obj.userData, v = Math.max(1, api.v);
    // the plan draws in over its first 0.5 s, held in front of the cage; then the swing, then down the lane at you
    const gk = clamp(e.t / 0.5, 0, 1), grow = gk * gk * gk * (gk * (gk * 6 - 15) + 10);
    if (e.t < PLAN_T) { e.z = e.boss && e.boss.alive ? e.boss.z + 8 : e.z; }
    else {
      if (e.solidT < 0) { e.solidT = 0; ud.solid.visible = true; api.game.sfx('g3-girder', { vol: 0.8 }); }
      e.solidT += dt;
      e.z += v * dt;
    }
    const sw = e.solidT < 0 ? 0 : smoothstep(0, SWING_T, e.solidT);
    ud.solid.position.x = -(1 - sw) * e.side * 18; // (the group is turned half round, so its x runs the other way)
    ud.plan.visible = sw < 1;
    e.appear = grow;
    api.pose(e);
    e.shipSide = api.ship.y >= e.y ? 1 : -1;
    e.pz2 = e.pz2 ?? e.z;
    if (e.solidT >= 0 && e.pz2 < 0 && e.z >= 0 && !e.hit) {
      const dy = Math.abs(api.ship.y - e.y);
      if (dy < HALF + SHIP_IN) { e.hit = true; api.game.crash({ x: api.ship.x, y: api.ship.y, z: 0, type: 'g3-foreman-girder', id: e.id }, 16, false); }
      else if (dy < HALF + SHIP_IN + 0.6) api.game.scrape(e, dy - HALF - SHIP_IN);
    }
    e.pz2 = e.z;
    if (e.z > 14) e.alive = false;
  },
  // the bots: keep to the side of it you are already on, with room
  avoid(e) { const R = 1000, m = HALF + SHIP_IN + 0.5; return [{ x: 0, y: e.y - e.shipSide * R, r: R + m }]; },
});
