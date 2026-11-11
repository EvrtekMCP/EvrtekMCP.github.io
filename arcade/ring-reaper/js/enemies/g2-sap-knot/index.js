// THE SAP KNOT (galaxy 2, level 10, THE ROOTMIND: the Taproot's new enemy). A swollen graft on the taproot's wall. It
// SWELLS for 1.3 s (the plan's 3.10: its red seams whiten and it grows a third bigger), then BURSTS: a tight spray of sap
// bolts across the tunnel at you. One roll sends the whole spray home and cracks the graft open. Knots on opposite walls
// bursting on one beat are the knot crossfire; a fan (`spread`) puts bolts either side of you too, which only a roll
// with the Mirror Shell's longer reach brings home (they fly past you if you hold your line).
//   ev: a (its angle round the tunnel wall, radians: 0 is the right wall, PI/2 the roof), r (12.4 m out), n (bolts, 2),
//       spread (0, or metres either side of you for a fan of three), T (1.25 s of flight), tel (1.3 s of swell),
//       s (size, 1.6), lead (0: the bolts arrive as the knot passes you)
// Timed by its time to arrival (-z / speed), so its bolts land where the course was laid out to have them, at any speed.
import { THREE, defineEnemy, buildModel, clamp } from '../../api.js?v=0.6.0';
import { MESH } from './mesh.js?v=0.6.0';

const SEAM = new THREE.Color(0xff3355), HOT = new THREE.Color(0xfff0f2), GAP = 0.08;
function make(api) {
  const g = new THREE.Group();
  const m = buildModel(MESH.knot, { own: ['#ff3355*'] });
  m.group.rotation.y = Math.PI;                 // her front is -Z; ours faces the ship (+Z)
  g.add(m.group);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  glow.scale.setScalar(6); glow.position.z = 1.5; g.add(glow);
  g.userData = { body: m.group, seam: m.mats['#ff3355*'], glow };
  return g;
}
export default defineEnemy({
  name: 'g2-sap-knot',
  hazard: { cls: 'shot', introduced: [2, 10], shotT: 1.25, tel: 1.3 },
  killPts: 1200,
  sample: { a: 0, n: 2 },
  spawn(e, ev, api) {
    e.obj = api.course.get('g2-sap-knot', () => make(api));
    const a = ev.a ?? 0, r = ev.r ?? 12.4;
    e.x = Math.cos(a) * r; e.y = Math.sin(a) * r; e.a = a;
    e.sx = e.sy = e.sz = ev.s || 1.6; e.r = 2.2;
    e.n = ev.n ?? 2; e.spread = ev.spread || 0; e.T = ev.T ?? 1.25; e.tel = ev.tel ?? 1.3; e.lead = ev.lead || 0;
    e.fired = 0; e.swell = 0;
    const ud = e.obj.userData; ud.seam.color.copy(SEAM); ud.glow.material.opacity = 0; ud.body.scale.setScalar(1);
    // it sits on the wall facing the lane's middle
    e.obj.rotation.set(0, 0, a + Math.PI / 2);
  },
  update(e, dt, api) {
    const ud = e.obj.userData, arrive = -e.z / Math.max(1, api.v), fly = e.T * (api.ease ? api.ease.shot : 1), fireAt = fly + e.lead;
    // the swell: the tell, the full tel seconds before the burst
    if (arrive > fireAt + e.tel) e.swell = 0;
    else if (e.fired === 0) e.swell = clamp(1 - (arrive - fireAt) / e.tel, 0, 1);
    else e.swell = Math.max(0, e.swell - dt * 2.5);
    const pulse = e.swell >= 1 || e.fired ? e.swell : e.swell * (0.75 + 0.25 * Math.sin(e.t * 26));
    ud.body.scale.setScalar(1 + 0.35 * pulse);
    ud.seam.color.copy(SEAM).lerp(HOT, pulse * 0.85);
    ud.glow.material.opacity = 0.15 + 0.75 * pulse; ud.glow.scale.setScalar(4 + 5 * pulse);
    // the burst: n bolts a hair apart (one roll takes them all); with a spread, the 2nd and 3rd go either side of you
    while (e.fired < e.n && arrive <= fireAt - e.fired * GAP && e.z < -20) {
      const i = e.fired++, s = api.ship, lead = 0.25;
      let tx = clamp(s.x + s.vx * lead, -api.box.x, api.box.x), ty = clamp(s.y + s.vy * lead, -api.box.y, api.box.y);
      if (e.spread && i > 0) { const side = i % 2 ? 1 : -1, px = -Math.sin(e.a), py = Math.cos(e.a); tx += px * e.spread * side; ty += py * e.spread * side; }
      api.fire(e, tx, ty, { T: e.T, owner: e });
      if (i === 0) api.game.sfx('g2-sap-burst', { vol: 0.7, pan: clamp(e.x / 14, -0.8, 0.8) });
    }
    api.pose(e);
    if (e.z > 12) e.alive = false;
  },
  // its own bolt sent home cracks the graft: the knot bursts green and is gone
  onShot(e, s, api) {
    api.game.burst(e.x, e.y, e.z, 34, { speed: 12, life: 0.6, s0: 1.4, r: 0.8, g: 1, b: 0.7, carry: 1 });
    api.game.sfx('g2-graft-crack', { vol: 0.7 });
    api.kill(e, true);
  },
});
