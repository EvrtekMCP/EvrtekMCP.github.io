// THE AUGUR (galaxy 3, level 4, The Augury, on): Yori's tall prism-eyed sentry, perched outside the flight box. It
// does not aim at you. It aims where you WILL be:
//   SIGHT   a hollow red crosshair ring hangs in the air where you will be in 1.2 s if you keep going (your own
//           momentum is its aim, so the ring moves as you move and you watch the future it predicted). Its prism
//           charges, lilac going white (1.2 s).
//   FIRE    one bolt to the crosshair, which locks white where it was. The bolt takes 1.2 s, exactly the time the
//           prediction looked ahead, so if you kept going it meets you there.
// Three answers: keep going and you are hit; change direction or stop and it misses; or fly INTO the crosshair and
// roll, and the bolt goes home and breaks the augur (the scoring answer; dodging is the safe one).
// Beside the sniper (who aims at you) it is the lesson of level 4: one shot where you are, one where you are going.
//
// Event: { nx, ny (or x, y): its perch, OUTSIDE the box (|nx| > 1.15 or |ny| > 1.15),
//          at: 3.2 (seconds out when the crosshair first appears), charge: 1.2 (how long it tracks before firing),
//          shots: 1, gap: 0.5 (s between a bolt landing and the next crosshair), r: 0.95 (the crosshair's radius, m),
//          orbit: { r, w, a0, ky } (it rides an orrery arm: its perch turns round the lane at r metres, w rad/s) }
// Warning (rule 12): from the crosshair to the bolt's arrival is charge + 1.2 s = 2.4 s; from the white lock, 1.2 s.
import { THREE, defineEnemy, buildModel, clamp, SHIP_R } from '../../api.js?v=0.4.1';
import { MESH } from './mesh.js?v=0.4.1';
import { SightLines } from '../sniper/sight.js?v=0.4.1';

export const CHARGE = 1.2, FLIGHT = 1.2;
const SCALE = 2.0, EYE = [0, 1.35, 0];
let lines = null;
const tmpV = new THREE.Vector3();

function make() {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const m = buildModel(MESH.augur, { own: ['#c8b0ff', '#ff3355*'] }); inner.add(m.group);
  const eye = m.mats['#c8b0ff'];
  eye.emissive = new THREE.Color(0x000000);
  g.userData = { inner, eye, core: m.mats['#ff3355*'] };
  return g;
}
// a hollow ring of n segments on the ship's plane, with four ticks (Yori's crosshair), drawn with sight-line ribbons
function crosshair(x, y, z, r, w, c, a) {
  const n = 22;
  for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; lines.line(x + Math.cos(a0) * r, y + Math.sin(a0) * r, z, x + Math.cos(a1) * r, y + Math.sin(a1) * r, z, w, c[0], c[1], c[2], a, x, y, z + 10); }
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) lines.line(x + dx * r * 0.55, y + dy * r * 0.55, z, x + dx * r * 1.35, y + dy * r * 1.35, z, w * 0.9, c[0], c[1], c[2], a, x, y, z + 10);
}
export default defineEnemy({
  name: 'g3-augur',
  hazard: { cls: 'shot', introduced: [3, 4], shotT: FLIGHT, tel: CHARGE },
  killPts: 1600,
  sample: { nx: 0, ny: 0, shots: 0 },
  init(api) { lines = new SightLines(api.scene, 420); },
  begin(api) { lines.begin(api.focalPx); },
  end() { lines.end(); },
  spawn(e, ev, api) {
    e.obj = api.course.get('g3-augur', () => make());
    e.sx = e.sy = e.sz = SCALE;
    e.r = 1.7; e.hitR = 2.0; e.hp = 1;
    e.shotsLeft = ev.shots ?? 1; e.at = ev.at ?? 3.2; e.charge = ev.charge ?? CHARGE; e.gap = ev.gap ?? 0.5; e.rr = ev.r || 0.95;
    e.phase = 0; e.pt = 0; e.px = api.ship.x; e.py = api.ship.y; e.flash = 0; e.shot = null; e.n = 0;
    e.lx = api.ship.x; e.ly = api.ship.y; e.vx = 0; e.vy = 0; // its own read of your motion, in world time
    if (ev.orbit) { e.orb = Object.assign({ r: 14, w: 0.3, a0: 0, ky: 1 }, ev.orbit); }
    const ud = e.obj.userData; ud.eye.color.setHex(0xc8b0ff); ud.eye.emissive.setHex(0); ud.core.color.setHex(0xff3355);
  },
  update(e, dt, api) {
    const ship = api.ship, v = Math.max(1, api.v), box = api.box, ud = e.obj.userData;
    // riding an orrery arm: the perch turns round the lane (world time, so a slipstream slows it too)
    if (e.orb) { const o = e.orb, a = o.a0 + o.w * e.t; e.x = Math.cos(a) * o.r; e.y = Math.sin(a) * o.r * o.ky; }
    api.pose(e);
    // it faces the ship (a yaw only: it stands upright on its tripod)
    ud.inner.rotation.y = Math.PI + Math.atan2(ship.x - e.x, -e.z) * 0.6; // Yori's sentry faces -Z: turned round to face you
    // its read of your motion: smoothed, in WORLD time, so in a slipstream it predicts for the world's clock
    if (dt > 0) { const k = 1 - Math.exp(-dt * 7); e.vx += ((ship.x - e.lx) / dt - e.vx) * k; e.vy += ((ship.y - e.ly) / dt - e.vy) * k; }
    e.lx = ship.x; e.ly = ship.y;
    const arrive = -e.z / v, lead = FLIGHT * (api.ease ? api.ease.shot : 1);
    // the prism and the muzzle (the eye), in world space
    tmpV.set(EYE[0], EYE[1], EYE[2]).multiplyScalar(SCALE * e.appear);
    const mx = e.x + tmpV.x, my = e.y + tmpV.y, mz = e.z + tmpV.z;
    e.pt += dt;
    if (e.phase === 0) {
      if (e.shotsLeft > 0 && !e.dead && arrive <= e.at && arrive - (e.charge + lead) > 0.35 && e.pt >= 0) {
        e.phase = 1; e.pt = 0; api.game.sfx('g3-augur-charge', { vol: 0.6, pan: clamp(e.x / box.x * 0.5, -1, 1) }); api.game.telegraph(e);
      }
    } else if (e.phase === 1) { // SIGHT: the crosshair at where you will be, following your motion
      e.px = clamp(ship.x + e.vx * lead, -box.x, box.x); e.py = clamp(ship.y + e.vy * lead, -box.y, box.y);
      if (e.pt >= e.charge) {
        e.phase = 2; e.pt = 0; e.flash = 1; e.n++;
        e.shot = api.fire({ x: mx, y: my, z: mz }, e.px, e.py, { T: FLIGHT, owner: e, tag: 'augur' }); e.askFar = undefined;
        e.shotsLeft--;
      }
    } else if (e.phase === 2) { // the bolt is on its way to the locked crosshair
      const s = e.shot, gone = !s || !s.alive || s.reflected || !api.course.shots.includes(s);
      if (gone && e.pt > 0.2) { e.phase = 3; e.pt = 0; e.shot = null; }
    } else if (e.phase === 3) { if (e.pt >= e.gap) { e.phase = 0; e.pt = 0; } }
    e.flash = Math.max(0, e.flash - dt * 4);
    // the prism: lilac at rest, going white as it charges (Yori: "the prism goes from lilac to white")
    const k = e.phase === 1 ? Math.min(1, e.pt / e.charge) : e.phase === 2 ? Math.max(0, 1 - e.pt * 3) : 0;
    ud.eye.color.setRGB(0.78 + 0.22 * k, 0.69 + 0.31 * k, 1); ud.eye.emissive.setRGB(k * 0.9, k * 0.9, k * 0.95);
    // the crosshair, on the ship's plane just in front of it (it ends there, never through the ship)
    const cz = -1.2;
    if (e.ev.warm) crosshair(0, 0, -40, 1, 0.04, [1, 0.2, 0.33], 0.01);
    if (e.phase === 1) {
      const a = Math.min(1, e.pt / 0.15), pulse = 0.8 + 0.2 * Math.sin(e.pt * (10 + 30 * e.pt / e.charge));
      const r = e.rr * (1.35 - 0.35 * Math.min(1, e.pt / e.charge));
      crosshair(e.px, e.py, cz, r, 0.045, [1, 0.2, 0.33], 0.95 * a * pulse);
      lines.line(mx, my, mz, e.px, e.py, cz, 0.025, 1, 0.25, 0.4, 0.5 * a);
    } else if (e.phase === 2 && e.shot) {
      const strobe = (Math.floor(e.pt * 20) % 2) ? 1 : 0.75;
      crosshair(e.px, e.py, cz, e.rr, 0.05, [1, 0.92, 0.94], strobe);
      crosshair(e.px, e.py, cz, e.rr * 1.06, 0.13, [1, 0.25, 0.35], 0.28);
    }
    // an augur inside the box (the Orrery's arms may swing one through it) can be flown into
    if (Math.abs(e.z) < 1.6 && Math.hypot(ship.x - e.x, ship.y - e.y) < e.r + SHIP_R && !e.rammed) { e.rammed = true; api.game.crash(e, 20); api.kill(e, false); }
    if (e.z > 12) e.alive = false;
  },
  // the autopilot's safe answer: keep off the locked crosshair while its bolt is in the air
  avoid(e) { return e.phase === 2 && e.shot ? [{ x: e.px, y: e.py, r: 2.0 }] : null; },
  // the scoring answer, for the bots: when the crosshair is close by (a person would take it then, not cross the
  // sheet for it), be in it as the bolt arrives, and roll
  rollAsk(e, api) {
    const s = e.shot; if (e.phase !== 2 || !s || !s.alive || s.reflected) return [];
    const t = -s.z / Math.max(1, s.vz); if (!(t > -0.1)) return [];
    if (e.askFar === undefined) e.askFar = Math.hypot(e.px - api.ship.x, e.py - api.ship.y) > 3.2;
    return e.askFar ? [] : [{ t, x: e.px, y: e.py, r: 1.9, go: true, key: e.n }];
  },
});
