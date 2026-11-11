// FREED (galaxy 2's lore, the plan's section 1): you never kill anything in the Deep. A sent-back shot cracks a
// creature's graft, the red falls away, and a silver creature darts off whole. This is that silver creature: Yori's
// freed() of the same body (her red seams, nodes and armour gone), born exactly where the grafted one was, at its
// size and heading, swimming away ahead and out into the haze.
// It is drawn by the kind that owns it (in that kind's begin), not as a course thing: it is the same creature
// changing, never something appearing, and it only ever leaves (it fades out by distance into the fog).
//   const FREE = new Freed(MESH.freed);   FREE.spawn(api, e, { s: 1, side: 1 });   in begin(api): FREE.tick(api)
import { buildModel, SPAWN_D } from '../../../api.js?v=0.6.3';

export class Freed {
  constructor(groups) { this.groups = groups; this.live = []; this.pool = []; }
  spawn(api, e, o = {}) {
    const obj = this.pool.pop() || buildModel(this.groups).group;
    if (!obj.parent) api.scene.add(obj);
    obj.visible = true;
    const src = e.obj;
    if (src) obj.rotation.copy(src.rotation); else obj.rotation.set(0, 0, 0);
    const side = o.side ?? (Math.sign(e.x) || 1);
    this.live.push({ obj, x: e.x, y: e.y, z: e.z, vx: side * (o.out ?? 6), vy: o.up ?? 2.5, vz: -(o.vz ?? 20), s: o.s ?? (e.sx || 1), t: 0, spin: o.spin ?? 0 });
  }
  tick(api, dt = api.dt || 0) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const f = this.live[i];
      f.t += dt;
      f.vz -= 160 * dt;                     // it bolts ahead, faster and faster
      f.vx *= Math.exp(-dt * 0.6);
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
      const o = f.obj;
      o.position.set(f.x, f.y, f.z);
      // turn to face where it is going: ahead and a little out
      o.rotation.y += ((Math.atan2(-f.vx, -f.vz) || 0) - o.rotation.y) * Math.min(1, dt * 4);
      o.rotation.z += (Math.sin(f.t * 9) * 0.25 - o.rotation.z) * Math.min(1, dt * 6) + f.spin * dt;
      o.scale.setScalar(f.s * api.appear(f.z));
      if (f.z < -SPAWN_D) { o.visible = false; this.pool.push(o); this.live.splice(i, 1); }
    }
  }
  clear() { for (const f of this.live) { f.obj.visible = false; this.pool.push(f.obj); } this.live.length = 0; }
}
