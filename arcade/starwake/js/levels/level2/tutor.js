// THE ROLL LESSON'S POD (0.3.0, the human pass; Evrtek 11-06: "The barrel roll needs a tutorial moment"). One lantern
// pod early on level 1 (SHATTERED MOON; this file sits with its level), there only until the player has sent a shot
// back once. The game runs the lesson (main.js, "the roll lesson"); this kind is just the pod. It is born at the spawn
// line and grows in like anything else (ruling 5); as it comes into range it asks for the lesson, then holds station
// while the lesson runs, shows the charge the lesson asks for, and never fires on its own. When the lesson is over
// without its shot coming home (missed twice, or skipped) it climbs away out of the lane, so it never rams anyone.
// Once the lesson is done it is never born at all (it dies at the spawn line, at zero size, before it is ever drawn).
import { defineEnemy } from '../../api.js?v=0.3.0';
import pod from '../../enemies/pod/index.js?v=0.3.0';

const ASK = 3.6; // seconds out when it asks for the lesson (a pod's first burst is at 3.4)
export const tutorPod = defineEnemy({
  name: 'l2-tutor-pod',
  // the lesson's shot: 0.9 s of charge and 1.1 s of flight, in slow motion, and it cannot hurt; declared for rule 12
  hazard: { cls: 'shot', introduced: 1, shotT: 1.1, tel: 0.9 },
  sample: { warm: true },
  spawn(e, ev, api) {
    if (!ev.warm && !api.game.tutorWants('roll')) { e.alive = false; return; }
    pod.spawn(e, Object.assign({}, ev, { bursts: 0, shots: 0, drift: 0 }), api);
    e.bursts = 0; e.shotsPer = 0; // set after: the pod reads 0 as "one"; this pod never fires on its own
    e.asked = false; e.hold = undefined; e.chargeK = 0; e.leave = false; e.leaveV = 0;
  },
  update(e, dt, api) {
    if (!e.obj) { e.alive = false; return; }
    if (e.hold !== undefined) e.z = e.hold; // holds station while the lesson runs
    if (e.leave) { e.leaveV = Math.min(16, (e.leaveV || 0) + dt * 24); e.y += e.leaveV * dt; } // done with: it climbs away, out of the lane
    if (!e.asked && !e.ev.warm && -e.z / Math.max(1, api.v) < ASK) { e.asked = true; api.game.tutorReady(e); }
    pod.update(e, dt, api); // the pod's own pose, aim, spin and ram check; with no bursts it never fires
    const ud = e.obj.userData, k = e.chargeK || 0;
    if (k > 0) {
      ud.core.color.setRGB(1, 0.2 + 0.7 * k, 0.33 + 0.6 * k); // red to white-hot, as a pod charges
      ud.charge.material.opacity = k * (0.6 + 0.4 * Math.sin(e.t * 40));
      ud.charge.scale.setScalar(1 + k * 4);
    } else ud.charge.material.opacity = 0;
  },
  remove(e, api) { if (e.obj) api.course.put('pod', e.obj); },
});
