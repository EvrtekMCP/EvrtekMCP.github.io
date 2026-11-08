// THE SHRIKE (level 1 on): Yori's strafer, a flat blade fighter. It is born 1.5 s before its strafe (lead) far out in
// the haze and off to its side, and swoops in over 2.5 s, braking onto the start of its pass (0.2.0: it used to blink
// into being 150 m out, and Evrtek saw it); a side arrow warns 1 s before the pass, as before. It crosses the lane
// firing shots with a red nose flash before each, then climbs away ahead and back into the fog. Two make a pair.
import { THREE, defineEnemy, buildModel, clamp, SPAWN_D, NET_T } from '../../api.js?v=0.5.0';

const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), eul = new THREE.Euler();
// 0.3.0, the human pass (Evrtek 11-06: "more of a visual warning when incoming weapons fire is coming"): the red nose
// flash before each shot lasts 0.45 s (it was 0.3) and swells to three times the size
const TEL = 0.45;
function make(api) {
  const g = new THREE.Group();
  g.add(buildModel('strafer').group);
  const nose = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.3 }));
  nose.position.z = -1.45; nose.scale.set(1.5, 1.5, 1); g.add(nose);
  const burn = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff9a1a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.9 }));
  burn.position.z = 1.25; burn.scale.set(1.6, 1.6, 1); g.add(burn);
  g.userData = { nose, burn };
  return g;
}
export default defineEnemy({
  name: 'shrike',
  motion: 'own', spawnAt: 'now', lead: 1.5,
  hazard: { cls: 'shot', introduced: 1, shotT: 1.15, tel: TEL, net: { T: NET_T, tel: TEL } }, // net: levels.js FIRE
  targetable: (e) => e.phase === 1,
  spawn(e, ev, api) {
    e.obj = api.course.get('shrike', () => make(api));
    const B = api.box;
    e.r = 1.3; e.side = ev.side || 1; e.t = 0; e.phase = 0; e.fired = 0; e.shotsN = ev.shots || 3; e.tel = -1;
    // where the strafe starts (0.1.0's numbers) and where the swoop in starts: deep in the fog, off to its side
    e.x0 = e.side * B.x * 2.8; e.y0 = (ev.ny || 0) * B.y; e.z0 = -150;
    e.x = e.x0 * 3; e.y = e.y0 + 14; e.z = -SPAWN_D;
    e.obj.userData.nose.material.opacity = 0.3; e.obj.userData.nose.scale.setScalar(1.5);
    e.swoop = 1.0 + (ev.warm ? 0 : 1.5); e.warned = false;
  },
  update(e, dt, api) {
    const ud = e.obj.userData, box = api.box, ship = api.ship, s = e.side;
    if (e.phase === 0) {
      // the swoop: out of the haze into the strafe's start, braking, turning onto its pass; the arrow 1 s before
      if (!e.warned && e.t >= e.swoop - 1.0) { e.warned = true; api.game.warn(e.side, 1.0); }
      const k = Math.min(1, e.t / e.swoop), ease = 1 - (1 - k) * (1 - k);
      e.x = e.x0 * (3 - 2 * ease); e.y = e.y0 + 14 * (1 - ease); e.z = -SPAWN_D + (SPAWN_D + e.z0) * ease;
      qA.setFromEuler(eul.set(0.25, Math.PI + s * 0.5, -s * 0.5));
      qB.setFromEuler(eul.set(0, -s * Math.PI / 2 * 0.55, s * 0.6));
      e.obj.quaternion.copy(qA).slerp(qB, clamp((k - 0.55) / 0.45, 0, 1));
      e.appear = api.appear(e.z);
      api.pose(e);
      if (e.t >= e.swoop) { e.phase = 1; e.t = 0; }
      return;
    }
    if (e.phase === 1) {
      const T = 2.6, k = Math.min(1, e.t / T);
      const sx = s * box.x * 2.8, ex = -s * box.x * 2.8;
      e.x = sx + (ex - sx) * k;
      e.y = e.ev.ny * box.y + Math.sin(k * Math.PI) * -1.2;
      e.z = -150 + k * 40;
      e.appear = 1;
      api.pose(e);
      e.obj.rotation.set(0, -s * Math.PI / 2 * 0.55, s * 0.6);
      // shots across the middle of the pass, each with a red nose flash first
      const slots = Array.from({ length: e.shotsN }, (_, i) => 0.22 + 0.56 * (e.shotsN > 1 ? i / (e.shotsN - 1) : 0.5));
      const next = slots[e.fired];
      if (next !== undefined && k > next - 0.12 && e.tel < 0) { e.tel = 0; api.game.telegraph(e); }
      if (e.tel >= 0) {
        e.tel += dt; const kt = Math.min(1, e.tel / TEL); ud.nose.material.opacity = 0.3 + 0.7 * kt * (0.8 + 0.2 * Math.sin(e.tel * 50)); ud.nose.scale.setScalar(1.5 + 3.5 * kt);
        if (e.tel > TEL) { e.tel = -1; e.fired++; api.fire(e, clamp(ship.x + ship.vx * 0.3, -box.x, box.x), clamp(ship.y + ship.vy * 0.3, -box.y, box.y), { T: 1.15, net: true }); ud.nose.material.opacity = 0.3; ud.nose.scale.setScalar(1.5); }
      }
      if (k >= 1) { e.phase = 2; e.t = 0; }
      return;
    }
    // gone: it climbs away ahead, back out past the fog (0.2.0: it used to vanish 300 m out, in plain view)
    e.z -= 140 * dt; e.y += 6 * dt;
    e.appear = api.appear(e.z);
    api.pose(e);
    if (e.z < -SPAWN_D) e.alive = false;
  },
});
