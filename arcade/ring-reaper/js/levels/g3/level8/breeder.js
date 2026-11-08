// THE BREEDER (the Fractal Yard's twist, the plan's 4.8): a mother fractal, Yori's fractal drawn four times its size,
// hanging high over the lane. She never fires. For every fractal you leave alive (one that drifts off with a piece of
// it still flying) she makes a new one: it grows out of her and flies down to the lane. So there is pressure to clear.
// She waits out the Slipstream's snap-back before her first release (`after` seconds into her watch), releases no more
// than `max`, at least `gap` seconds apart, then climbs away into the haze.
//   Event: { nx, ny (her station, above the box), hold 240, dur 17 (seconds she watches), after 4, gap 2.4, max 4,
//            kidShots 1 (bolts each piece of one she makes fires if it is left alone), pair (its pieces fire together) }
import { THREE, defineEnemy, buildModel, clamp, damp, SPAWN_D } from '../../../api.js?v=0.5.0';
import { MESH } from '../../../enemies/g3-fractal/mesh.js?v=0.5.0';

const SCALE = 9, IN = 3.2;
let glowMat = null;
function make() {
  const g = new THREE.Group(), inner = new THREE.Group(); inner.rotation.y = Math.PI; g.add(inner);
  inner.add(buildModel(MESH.gen0).group);
  const core = new THREE.Sprite(glowMat.clone()); core.scale.setScalar(1.4); inner.add(core);
  g.userData = { inner, core };
  return g;
}
export const breeder = defineEnemy({
  name: 'g3-l8-breeder',
  motion: 'own', spawnAt: 'now',
  hazard: null,          // she never fires: her children do (they are fractals, and say so)
  targetable: () => false,
  sample: { nx: 0, ny: 1.4 },
  init(api) { glowMat = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5 }); },
  spawn(e, ev, api) {
    const B = api.box;
    e.obj = api.course.get('g3-l8-breeder', make);
    e.hold = ev.hold || 205; e.hx = (ev.nx || 0) * B.x; e.hy = (ev.ny ?? 1.7) * B.y;
    e.x = e.hx; e.y = e.hy + 30; e.z = -SPAWN_D; e.phase = 0; e.t = 0;
    e.dur = ev.dur || 17; e.after = ev.after ?? 4; e.gap = ev.gap ?? 2.4; e.max = ev.max ?? 4; e.kidShots = ev.kidShots ?? 1; e.pair = !!ev.pair;
    e.queue = 0; e.made = 0; e.nextAt = 0; e.pulse = 0; e.sx = e.sy = e.sz = SCALE; e.r = 6;
  },
  update(e, dt, api) {
    const ud = e.obj.userData;
    if (e.phase === 0) {
      const k = Math.min(1, e.t / IN), ease = 1 - (1 - k) * (1 - k);
      e.z = -SPAWN_D + (SPAWN_D - e.hold) * ease; e.y = e.hy + 30 * (1 - ease);
      if (k >= 1) { e.phase = 1; e.t = 0; }
    } else if (e.phase === 1) {
      e.z = -e.hold + Math.sin(e.t * 0.8) * 3; e.x = e.hx + Math.sin(e.t * 0.5) * 2;
      // every fractal that drifts off alive is one more for her to make
      for (const q of api.course.list) if (q.type === 'g3-fractal' && q.escaped && !q.bred) { q.bred = true; if (e.made + e.queue < e.max) e.queue++; }
      if (e.queue > 0 && e.t >= e.after && e.t >= e.nextAt) release(e, api);
      if (e.t > e.dur) { e.phase = 2; e.t = 0; e.vz = 0; }
    } else {
      e.vz = Math.min(260, e.vz + dt * 150); e.z -= e.vz * dt; e.y += 6 * dt;
      if (e.z < -SPAWN_D) e.alive = false;
    }
    e.pulse = Math.max(0, e.pulse - dt * 1.5);
    ud.inner.rotation.z += dt * (0.25 + e.pulse * 3);
    ud.core.material.opacity = 0.45 + 0.5 * e.pulse + 0.1 * Math.sin(e.t * 3); ud.core.scale.setScalar(1.4 + 1.6 * e.pulse);
    e.appear = api.appear(e.z);
    api.pose(e);
  },
});
function release(e, api) {
  const B = api.box, R = (a, b) => a + Math.random() * (b - a);
  e.queue--; e.made++; e.nextAt = e.t + e.gap; e.pulse = 1;
  api.game.sfx('g3-split', { vol: 0.7, rate: 0.8 });
  api.spawn({ type: 'g3-fractal', depth: 1, shots: 2, kidShots: e.kidShots, pair: e.pair, nx: R(-0.6, 0.6), ny: R(0.05, 0.6), hold: 170, from: { x: e.x, y: e.y - 3, z: e.z } }, e.z);
}
