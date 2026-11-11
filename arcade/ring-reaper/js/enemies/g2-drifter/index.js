// THE DRIFTER (galaxy 2, Tideway): Yori's house-sized translucent jelly. It rides the currents (it asks the water where
// it is: flowAt), so it shows you where a current will carry things, including you. Its red-tipped tendrils trail 8 m
// behind its bell: touching them costs a small hit; brushing past them pays STING (a graze). It never fires. A shot
// sent back at it (a stray deflect) cracks its graft: freed, it goes silver (Yori's colour map) and drifts on.
//   add(d, 'g2-drifter', { nx, ny, s: 0.8..1.2, drift: own sideways drift in half-boxes a second })
import { THREE, defineEnemy, buildModel, clamp, damp, HIT_R, GRAZE_R, SHIP_R, READ_D } from '../../api.js?v=0.6.1';
import { MESH } from './mesh.js?v=0.6.1';
import { flowAt } from '../../obstacles/g2-current/index.js?v=0.6.1';

const TAIL = 8;                                           // tendrils trail this far behind the bell (toward you)
const REACH = 2.3;                                        // the tendrils' ring, round its middle
// Yori's freed(): jelly -> silver, jellyLit -> silverLit, jellyDeep -> silverDeep; the graft dropped
const FREED = { '#6a4ac0': 0xc8d0dc, '#a890ff': 0xeef2ff, '#3a2a7a': 0x8a96a8 };
function make() {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const m = buildModel(MESH.rest, { own: Object.keys(FREED).map((k) => (k === '#a890ff' ? k + '*' : k)).concat(['#ff3355*', '#2a2e44']) });
  for (const [k, mat] of Object.entries(m.mats)) { mat.transparent = true; mat.opacity = k.startsWith('#ff3355') ? 1 : k.startsWith('#a890ff') ? 0.55 : 0.7; mat.depthWrite = !k.startsWith('#a890ff'); }
  inner.add(m.group);
  g.userData = { inner, mats: m.mats };
  return g;
}
export default defineEnemy({
  name: 'g2-drifter',
  hazard: { cls: 'mover', introduced: [2, 1], warn: (ev, v) => READ_D / v },
  sample: {},
  killPts: 800,
  targetable: (e) => !e.freed && e.z < -20,
  avoid: (e) => [{ x: e.x, y: e.y, r: (REACH + 0.6) * e.s + 1.4 }],
  spawn(e, ev, api) {
    e.obj = api.course.get('g2-drifter', make);
    e.s = ev.s || 1; e.sx = e.sy = e.sz = e.s; e.r = 2.6 * e.s; e.hitR = 2.2 * e.s;
    e.vx = 0; e.vy = 0; e.tilt = 0; e.stung = false; e.touched = false; e.freed = false; e.bob = (ev.d || 0) * 0.013;
    const u = e.obj.userData;
    for (const k of Object.keys(FREED)) { const m = u.mats[k] || u.mats[k + '*']; m.color.set(k); }
    u.mats['#ff3355*'].visible = true; u.mats['#2a2e44'].visible = true;
  },
  update(e, dt, api) {
    const ev = e.ev, B = api.box, ship = api.ship;
    // it rides the water where it is, plus its own slow drift; a little bob, as a jelly breathes
    const w = ev.warm ? { fx: 0, fy: 0 } : flowAt(api, e.z, e.x, e.y);
    e.vx = damp(e.vx, (w.fx + (ev.drift || 0)) * B.x, 1.5, dt); e.vy = damp(e.vy, w.fy * B.y, 1.5, dt);
    e.x += e.vx * dt; e.y += e.vy * dt + Math.sin(e.bob + e.t * 1.3) * 0.25 * dt;
    // the tendrils lean the way it is carried (the body tilts; her tendrils trail behind it)
    e.tilt = damp(e.tilt, clamp(-e.vx * 0.06, -0.5, 0.5), 3, dt);
    e.obj.userData.inner.rotation.set(Math.sin(e.t * 1.3 + e.bob) * 0.06, 0, e.tilt);
    // the bell crosses first, then 8 m of tendrils: while any of it is at the ship's plane, close is a sting
    if (!ev.warm && !e.freed && e.z > -0.5 && e.z < TAIL * e.s + 0.5) {
      const d = Math.hypot(ship.x - e.x, ship.y - e.y), reach = REACH * e.s;
      if (!e.touched && d < reach + SHIP_R * 0.6) { e.touched = true; api.game.crash(e, 9, true); }
      else if (!e.stung && !e.touched && d < reach + GRAZE_R) { e.stung = true; api.game.graze({ x: e.x, y: e.y }, Math.max(HIT_R, d - reach + HIT_R), HIT_R, GRAZE_R); api.game.call('STING!', 'c-cyan'); api.game.sfx('g2-sting', { pan: clamp(e.x / B.x, -1, 1) * 0.5 }); }
    }
    api.pose(e);
    if (e.z > TAIL * e.s + 30) e.alive = false;
  },
  onShot(e, s, api) {
    if (e.freed) return;
    e.freed = true;
    const u = e.obj.userData;
    for (const [k, hex] of Object.entries(FREED)) (u.mats[k] || u.mats[k + '*']).color.setHex(hex);
    u.mats['#ff3355*'].visible = false; u.mats['#2a2e44'].visible = false;
    api.game.kill(e, true);                // the engine frees it: pearl motes, the graft's crack, FREED!
  },
});
