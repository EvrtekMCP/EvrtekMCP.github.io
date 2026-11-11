// THE FORGE TURRET (galaxy 3, level 6, The Forgery): a neutral turret on the Mint's course, KEYED to forgeries (the
// Lockworks' idea, keyed fire, turned on the copies). Yori's lantern pod on a steel bracket, ringed in blueprint white:
// white is the plan, and its plan is the forgery. It fires at you like any pod (a red charge, then the bolt); roll the
// bolt home and it does not go back to the turret: it homes on the nearest LADEN forgery (one carrying stolen rings),
// else the nearest forgery, and only with no forgery in the race does it come home to the turret.
// While it charges, a faint white line runs from it to the forgery it is keyed to: where your roll will send it.
// It waits for its mark: from `at` seconds out it fires the moment a forgery is carrying stolen rings (and anyway at
// its last chance, 1.9 s out), so its bolt is worth something when it reaches you.
// Event: { nx, ny (its perch, outside the box: |nx| > 1.15 or |ny| > 1.15), at: 3.0 (seconds out it may first fire),
//          shots: 1 (or 2, at least 1.2 s apart), T: 1.35 }
import { THREE, defineEnemy, buildModel, clamp } from '../../api.js?v=0.6.0';
import { SightLines } from '../sniper/sight.js?v=0.6.0';

const TEL = 0.75, SHOT_T = 1.35;
let lines = null, keyGeo = null, keyMat = null;
function make(api) {
  const g = new THREE.Group(), inner = new THREE.Group(); inner.rotation.y = Math.PI; g.add(inner);
  const m = buildModel('pod', { own: ['#ff3355*'] }); inner.add(m.group);
  const key = new THREE.Mesh(keyGeo, keyMat); g.add(key);
  const charge = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  charge.position.z = 1.2; g.add(charge);
  g.userData = { core: m.mats['#ff3355*'], charge, ring: m.parts.ring, key };
  return g;
}
// the forgery a bolt from this turret is keyed to right now
export function keyedTarget(api) {
  let best = null, bd = 1e9, laden = false;
  for (const q of api.course.list) {
    if (q.type !== 'g3-forgery' || !q.alive || !q.kind.targetable(q)) continue;
    const L = q.stolen && q.stolen.length > 0, d = -q.z;
    if ((L && !laden) || (L === laden && d < bd)) { best = q; bd = d; laden = L; }
  }
  return best;
}
export default defineEnemy({
  name: 'g3-forge-turret',
  hazard: { cls: 'shot', introduced: [3, 6], shotT: SHOT_T, tel: TEL },
  killPts: 1000,
  sample: { nx: 0, ny: 0 },
  init(api) {
    lines = new SightLines(api.scene, 120);
    keyGeo = new THREE.TorusGeometry(1.9, 0.07, 6, 40); keyMat = new THREE.MeshBasicMaterial({ color: 0xe8eeff });
  },
  begin(api) { lines.begin(api.focalPx); },
  end() { lines.end(); },
  spawn(e, ev, api) {
    e.obj = api.course.get('g3-forge-turret', () => make(api));
    e.sx = e.sy = e.sz = 1.3; e.r = 1.3; e.hp = 1;
    e.fired = 0; e.tel = -1; e.queue = []; e.shot = null; e.shots = ev.shots || 1; e.at = ev.at ?? 3.0; e.next = e.at; e.T = ev.T || SHOT_T;
    e.obj.userData.charge.material.opacity = 0;
  },
  update(e, dt, api) {
    const ud = e.obj.userData, v = Math.max(1, api.v), ship = api.ship, box = api.box;
    api.pose(e);
    e.obj.lookAt(ship.x, ship.y, 8);
    ud.key.rotation.z += dt * 0.8;
    // KEYED, so it waits for its mark: from `at` seconds out it fires the moment a forgery is carrying stolen rings, and
    // fires anyway at its last chance (1.9 s out); a second bolt at least 1.2 s after the first
    const arrive = -e.z / v, f0 = keyedTarget(api), laden = !!(f0 && f0.stolen && f0.stolen.length);
    if (e.fired < e.shots && e.tel < 0 && arrive < e.next + TEL && arrive > 0.8 + TEL && (laden || arrive < 1.9 + TEL)) { e.tel = 0; api.game.telegraph(e); }
    if (e.tel >= 0) {
      e.tel += dt; const k = Math.min(1, e.tel / TEL);
      ud.core.color.setRGB(1, 0.2 + 0.7 * k, 0.33 + 0.6 * k);
      ud.charge.material.opacity = k * (0.6 + 0.4 * Math.sin(e.tel * 40)); ud.charge.scale.setScalar(1 + k * 4);
      const f = keyedTarget(api);
      if (f) lines.line(e.x, e.y, e.z, f.x, f.y, f.z, 0.03, 0.91, 0.93, 1, 0.35 * k, (e.x + f.x) / 2, (e.y + f.y) / 2 + 3, (e.z + f.z) / 2 + 20);
      if (e.tel >= TEL) {
        e.tel = -1; e.fired++; e.next = arrive - 1.2; ud.charge.material.opacity = 0;
        e.shot = api.fire(e, clamp(ship.x + ship.vx * 0.15, -box.x, box.x), clamp(ship.y + ship.vy * 0.15, -box.y, box.y), { T: e.T });
      }
    } else ud.core.color.setHex(0xff3355);
    if (e.ev.warm) lines.line(0, 0, -40, 1, 0, -40, 0.03, 1, 1, 1, 0.01);
    if (e.z > 12) e.alive = false;
  },
  // KEYED: its bolt, sent home, goes to a forgery (undefined: no forgery racing, so it comes home to the turret)
  redirect(e, s, api) { return keyedTarget(api) || undefined; },
  // the bots: while a laden forgery is racing, its bolt is worth rolling when it reaches you
  rollAsk(e, api) {
    const s = e.shot; if (!s || !s.alive || s.reflected) return [];
    const f = keyedTarget(api); if (!f || !(f.stolen && f.stolen.length)) return [];
    const t = -s.z / Math.max(1, s.vz); if (!(t > -0.1)) return [];
    return [{ t, x: s.x + s.vx * Math.max(0, t), y: s.y + s.vy * Math.max(0, t), r: 2.3, key: e.fired }];
  },
});
