// THE GATE TURRET (level 3): Yori's level-1 lantern pod, seated on the mount of a Gatefield ring-gate, outside the
// flight box. It keeps time: its core charges for two beats (red to white-hot) and it fires ON the beat, a short
// burst of bolts a sixteenth apart that reach you three beats later, so the roll that sends them home lands on the
// beat too. A bolt sent back kills it (rule 27: the Warden's cores die the same way, so this is the lesson).
// Event: { gx, gy (its gate's hub, normalised), mount (clock angle of the seat, degrees; -90 = six o'clock),
//          volleys: [beats before its gate reaches you, ...], shots (per volley), miss (metres it aims wide: the
//          first one only grazes if you do nothing, rule 18) }
import { THREE, defineEnemy, buildModel, clamp } from '../../api.js?v=0.6.4';
import { beatClock } from '../../levels/level3/beat.js?v=0.6.4';
import { MOUNT_R, GATE_S } from '../../levels/level3/gate.js?v=0.6.4';

const TEL = 2, FLIGHT = 3;                 // beats of telegraph, beats of flight
let bracketGeo, bracketMat;
function make(api) {
  const g = new THREE.Group(), inner = new THREE.Group(); inner.rotation.y = Math.PI; g.add(inner);
  const m = buildModel('pod', { own: ['#ff3355*'] }); inner.add(m.group);
  const charge = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  charge.position.z = 1.2; g.add(charge);
  const seat = new THREE.Group(); const bracket = new THREE.Mesh(bracketGeo, bracketMat); bracket.position.y = -2.0; seat.add(bracket);
  g.userData = { core: m.mats['#ff3355*'], charge, ring: m.parts.ring, seat };
  return { g, seat };
}
export default defineEnemy({
  name: 'gate-turret',
  // net (levels.js FIRE): a net lands on a beat too, one beat after it leaves
  hazard: { cls: 'shot', introduced: 3, shotT: FLIGHT * 60 / 140, tel: TEL * 60 / 140, net: { T: 60 / 140, tel: TEL * 60 / 140, beat: true } },
  killPts: 1200,
  sample: { gx: 0, gy: 0, mount: -90, volleys: [8] },
  init() {
    bracketGeo = new THREE.BoxGeometry(0.9, 3.4 * GATE_S / 0.7, 0.9);
    bracketMat = new THREE.MeshStandardMaterial({ color: 0x2a2e44, metalness: 0.55, roughness: 0.45, flatShading: true });
  },
  spawn(e, ev, api) {
    const made = api.course.get('gate-turret', () => { const { g, seat } = make(api); g.userData.seatObj = seat; return g; });
    e.obj = made;
    const seat = made.userData.seatObj;
    if (!seat.parent) api.scene.add(seat);
    seat.visible = true;
    const a = (ev.mount ?? -90) * Math.PI / 180;
    e.x = (ev.gx || 0) * api.box.x + Math.cos(a) * MOUNT_R;
    e.y = (ev.gy || 0) * api.box.y + Math.sin(a) * MOUNT_R;
    e.ang = a;
    e.sx = e.sy = e.sz = 1.15;
    e.r = 1.3; e.hp = 1;
    e.volleys = (ev.volleys || [8]).slice().sort((p, q) => q - p); e.vi = 0;
    e.shotsPer = ev.shots || 1; e.miss = ev.miss || 0;
    e.tel = -1; e.telBeats = 0; e.queue = []; e.lastBeat = null;
    made.userData.charge.material.opacity = 0;
    made.userData.core.color.setHex(0xff3355);
  },
  update(e, dt, api) {
    const ud = e.obj.userData, ship = api.ship, box = api.box, c = beatClock(api);
    api.pose(e);
    // the bracket that seats it on the ring, pointing out along the spoke
    const seat = ud.seatObj; seat.position.copy(e.obj.position); seat.rotation.z = e.ang + Math.PI / 2; seat.scale.copy(e.obj.scale);
    e.obj.lookAt(ship.x, ship.y, 8);
    ud.ring.rotation.y += dt * 1.6;
    const k = -e.z / Math.max(1, api.v) / c.beatSec;       // beats until it reaches the ship's plane
    const bi = Math.floor(c.beat + 1e-6);
    if (bi !== e.lastBeat) {
      e.lastBeat = bi;
      if (e.tel >= 0) {
        e.telBeats++;
        if (e.telBeats >= TEL) {
          e.tel = -1; e.vi++;
          for (let s = 0; s < e.shotsPer; s++) e.queue.push(s * c.beatSec / 4);
          ud.charge.material.opacity = 0;
        }
      } else if (e.vi < e.volleys.length && Math.floor(k - e.volleys[e.vi] - TEL + 1e-6) <= 0 && e.z < -40) {
        e.tel = 0; e.telBeats = 0; api.game.telegraph(e);
      }
    }
    if (e.tel >= 0) {
      e.tel += dt;
      const q = Math.min(1, e.tel / (TEL * c.beatSec));
      ud.core.color.setRGB(1, 0.2 + 0.7 * q, 0.33 + 0.6 * q);
      ud.charge.material.opacity = q * (0.6 + 0.4 * Math.sin(e.tel * 40));
      ud.charge.scale.setScalar(1 + q * 2.6);
    } else ud.core.color.setHex(0xff3355);
    for (let i = e.queue.length - 1; i >= 0; i--) {
      e.queue[i] -= dt;
      if (e.queue[i] <= 0) {
        e.queue.splice(i, 1);
        let tx = ship.x + ship.vx * 0.3, ty = ship.y + ship.vy * 0.3;
        if (e.miss) { const s = tx >= 0 ? -1 : 1; tx += s * e.miss; }
        // 0.3.1: aimed fire may come as a net (levels.js FIRE), landing on a beat like the rest; a teaching miss never does
        api.fire(e, clamp(tx, -box.x, box.x), clamp(ty, -box.y, box.y), { T: FLIGHT * c.beatSec, net: !e.miss, beat: c.beatSec });
      }
    }
    if (e.z > 12) e.alive = false;
  },
  remove(e, api) {
    const seat = e.obj && e.obj.userData.seatObj; if (seat) seat.visible = false;
    if (e.obj) api.course.put('gate-turret', e.obj);
  },
});
