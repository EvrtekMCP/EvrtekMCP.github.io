// THE LANTERN POD (level 1 on): Yori's turret pod. An octahedral node, a truss ring that spins, one barrel that
// tracks you, a red core that charges white-hot for 0.75 s before each burst. Fires at 3.4 s and 2.2 s out.
import { THREE, defineEnemy, buildModel, clamp, SHIP_R, LEGACY_LINE, NET_T } from '../../api.js?v=0.6.2';

function make(api) {
  // Her barrel points down -Z; the inner group turns it to +Z so lookAt() aims it at the ship.
  const g = new THREE.Group(), inner = new THREE.Group(); inner.rotation.y = Math.PI; g.add(inner);
  const m = buildModel('pod', { own: ['#ff3355*'] }); inner.add(m.group);
  const charge = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  charge.position.z = 1.2; g.add(charge);
  g.userData = { core: m.mats['#ff3355*'], charge, ring: m.parts.ring };
  return g;
}
export default defineEnemy({
  name: 'pod',
  // net: its volley as a net on a level that asks (levels.js FIRE): the flight and tell check-levels' rule 12 times
  hazard: { cls: 'shot', introduced: 1, shotT: 1.25, tel: 0.75, net: { T: NET_T, tel: 0.75 } },
  spawn(e, ev, api) {
    e.obj = api.course.get('pod', () => make(api));
    e.sx = e.sy = e.sz = 1.1;
    e.r = 1.1; e.hp = 1; e.fired = 0; e.tel = -1; e.drift = ev.drift || 0; e.bursts = ev.bursts || 1; e.shotsPer = ev.shots || 1; e.queue = [];
    e.obj.userData.charge.material.opacity = 0;
  },
  update(e, dt, api) {
    const ud = e.obj.userData, v = api.v, ship = api.ship, box = api.box;
    // its sideways drift runs from 0.1.0's spawn line, so it is where it always was when it fires
    if (e.z > -LEGACY_LINE) e.x = clamp(e.x + e.drift * dt, -box.x * 1.1, box.x * 1.1);
    api.pose(e);
    e.obj.lookAt(ship.x, ship.y, 8); // the barrel is always on you
    ud.ring.rotation.y += dt * 1.6;
    const arrive = -e.z / Math.max(1, v);
    // two firing windows, at 3.4 s and 2.2 s out; each one telegraphs for 0.75 s first
    const at = [3.4, 2.2].slice(0, e.bursts);
    const next = at[e.fired];
    if (next !== undefined && arrive < next + 0.75 && e.tel < 0) { e.tel = 0; api.game.telegraph(e); }
    if (e.tel >= 0) {
      e.tel += dt;
      const k = Math.min(1, e.tel / 0.75);
      ud.core.color.setRGB(1, 0.2 + 0.7 * k, 0.33 + 0.6 * k); // red to white-hot
      ud.charge.material.opacity = k * (0.6 + 0.4 * Math.sin(e.tel * 40));
      ud.charge.scale.setScalar(1 + k * 4); // 0.3.0: a bigger charge before it fires (it swelled to 3.6)
      if (e.tel >= 0.75) {
        e.tel = -1; e.fired++;
        for (let s = 0; s < e.shotsPer; s++) e.queue.push(s * 0.16);
        ud.charge.material.opacity = 0;
      }
    } else { ud.core.color.setHex(0xff3355); }
    for (let q = e.queue.length - 1; q >= 0; q--) {
      e.queue[q] -= dt;
      if (e.queue[q] <= 0) {
        e.queue.splice(q, 1);
        // aimed where the ship is heading, a third of a second ahead
        api.fire(e, clamp(ship.x + ship.vx * 0.35, -box.x, box.x), clamp(ship.y + ship.vy * 0.35, -box.y, box.y), { net: true }); // 0.3.1: may come as a net (levels.js FIRE)
      }
    }
    if (Math.abs(e.z) < 1.4 && Math.hypot(ship.x - e.x, ship.y - e.y) < e.r + SHIP_R && !e.rammed) { e.rammed = true; api.game.crash(e, 20); api.kill(e, false); }
    if (e.z > 12) e.alive = false;
  },
});
