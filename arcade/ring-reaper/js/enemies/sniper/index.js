// THE SNIPER (Ion Storm on, played 7th since 11-08): Yori's long barrel on three truss legs, perched on the storm's pylons. It never moves
// and it does one thing (her sheet: "the shot you read early or not at all"):
//   SIGHT  a thin red line from its muzzle finds you and follows you (0.8 s; 1.2 s the first time you meet one),
//   LOCK   the line goes white and stops following: that is where the shot will land (0.3 s),
//   FIRE   one fast bolt down the line (0.3 s to your plane).
// Step off the white line and it misses; roll on the white and the bolt goes home and kills it.
// Warning (rule 12): from the first sight to the bolt's arrival is 1.4 s (1.8 s the first time); from the white
// lock 0.6 s, the hard floor, and that window is the read: the line already told you where.
//
// Event: { nx, ny (or x, y) where it perches (keep it OUTSIDE the box: |nx| > 1.15 or |ny| > 1.15),
//          shots: 1, sight: 0.8, at: 2.8 (seconds out when it first sights), gap: 0.45 (between shots),
//          miss: 0 (metres off you on purpose: the teaching shot grazes), hang: false (legs up, under a lamp) }
// It brings no perch of its own: level 5 stands each one on an ion pylon's lamp (js/levels/level5/storm.js).
import { THREE, defineEnemy, buildModel, clamp, SHIP_R } from '../../api.js?v=0.6.2';
import { MESH } from './mesh.js?v=0.6.2';
import { SightLines } from './sight.js?v=0.6.2';

export const SIGHT = 0.8, SIGHT_FIRST = 1.2, LOCK = 0.3, BOLT_T = 0.3;
const SCALE = 1.7;
const tmpV = new THREE.Vector3();
let lines = null;

function make() {
  // Her barrel points down -Z; the inner group turns it to +Z so lookAt() aims it at the ship.
  const g = new THREE.Group(), inner = new THREE.Group(); inner.rotation.y = Math.PI; g.add(inner);
  const m = buildModel(MESH.sniper, { own: ['#ff3355*'] }); inner.add(m.group);
  g.userData = { core: m.mats['#ff3355*'], inner };
  return g;
}
export default defineEnemy({
  name: 'sniper',
  hazard: { cls: 'shot', introduced: 7, shotT: BOLT_T, tel: SIGHT + LOCK },
  killPts: 1500,
  sample: { nx: 0, ny: 0, shots: 0 },
  init(api) { lines = new SightLines(api.scene); },
  begin(api) { lines.begin(api.focalPx); },
  end() { lines.end(); },
  spawn(e, ev, api) {
    e.obj = api.course.get('sniper', () => make());
    e.sx = e.sy = e.sz = SCALE;
    e.r = 1.6; e.hitR = 1.8; e.hp = 1;
    e.shotsLeft = ev.shots ?? 1; e.sight = ev.sight ?? SIGHT; e.at = ev.at ?? 2.8; e.gap = ev.gap ?? 0.45; e.miss = ev.miss || 0;
    e.phase = 0; e.pt = 0; e.ax = api.ship.x; e.ay = api.ship.y; e.flash = 0;
    e.obj.userData.core.color.setHex(0xff3355);
    e.obj.userData.inner.rotation.z = ev.hang ? Math.PI : 0; // hang: legs up, under a lamp that hangs from above
  },
  update(e, dt, api) {
    const ship = api.ship, v = Math.max(1, api.v), box = api.box, ud = e.obj.userData;
    api.pose(e);
    // the barrel follows the line's aim point (or the ship, before it sights)
    const lx = e.phase ? e.ax : ship.x, ly = e.phase ? e.ay : ship.y;
    e.obj.lookAt(lx, ly, 6);
    const arrive = -e.z / v;
    // the muzzle, 2.85 m down the barrel toward the aim point
    tmpV.set(lx - e.x, ly - e.y, 0 - e.z).normalize();
    const mx = e.x + tmpV.x * 2.85 * SCALE * e.appear, my = e.y + tmpV.y * 2.85 * SCALE * e.appear, mz = e.z + tmpV.z * 2.85 * SCALE * e.appear;
    e.pt += dt;
    if (e.phase === 0) {
      // sight only while there is time for the whole cycle with the sniper still well ahead
      if (e.shotsLeft > 0 && arrive <= e.at && arrive - (e.sight + LOCK) > 0.45 && e.pt >= 0 && !e.dead) {
        e.phase = 1; e.pt = 0; e.ax = ship.x; e.ay = ship.y; api.game.telegraph && api.game.telegraph(e);
      }
    } else if (e.phase === 1) { // SIGHT: the line finds you and follows (a little behind, so moving shakes it)
      const k = 1 - Math.exp(-dt * 10);
      e.ax += (ship.x - e.ax) * k; e.ay += (ship.y - e.ay) * k;
      if (e.pt >= e.sight) {
        e.phase = 2; e.pt = 0;
        if (e.miss) { // the teaching shot: locked beside you, toward the box's middle, so it grazes
          const s = e.ax > 0 ? -1 : 1; e.ax = clamp(e.ax + s * e.miss, -box.x, box.x);
        }
        api.game.sfx('fire', { rate: 2.1, vol: 0.35, pan: clamp(e.x / box.x * 0.5, -1, 1) });
      }
    } else if (e.phase === 2) { // LOCK: white, still
      if (e.pt >= LOCK) {
        api.fire({ x: mx, y: my, z: mz }, e.ax, e.ay, { T: BOLT_T, owner: e });
        e.shotsLeft--; e.phase = 3; e.pt = 0; e.flash = 1;
      }
    } else if (e.phase === 3) { // after the shot: the line burns out, then the next one, if any
      if (e.pt >= e.gap) { e.phase = 0; e.pt = 0; }
    }
    e.flash = Math.max(0, e.flash - dt * 6);
    // the core: red, white-hot while locked
    if (e.phase === 2) ud.core.color.setRGB(1, 0.85, 0.85); else ud.core.color.setHex(0xff3355);
    // draw the line and the reticle (z = -1.2: it ends just in front of the ship, never through it)
    const ez = -1.2;
    if (e.ev.warm) lines.line(mx, my, mz, 0, 0, ez, 0.03, 1, 0.2, 0.33, 0.01); // the loading screen compiles its shader
    // the muzzle burns red while it sights and white while it is locked, so the line's source reads 300 m out
    if (e.phase === 1 || e.phase === 2) {
      const s = Math.max(0.6, (9.2 - mz) * 0.012), c = e.phase === 2 ? [1, 1, 1, 1] : [1, 0.3, 0.4, 0.9];
      lines.line(mx - s, my, mz, mx + s, my, mz, s * 0.35, c[0], c[1], c[2], c[3], mx, my, mz + 10);
      lines.line(mx, my - s, mz, mx, my + s, mz, s * 0.35, c[0], c[1], c[2], c[3], mx, my, mz + 10);
    }
    if (e.phase === 1) {
      const k = Math.min(1, e.pt / 0.15), pulse = 0.75 + 0.25 * Math.sin(e.pt * 38);
      lines.line(mx, my, mz, e.ax, e.ay, ez, 0.03, 1, 0.2, 0.33, 0.95 * k * pulse);
      lines.line(mx, my, mz, e.ax, e.ay, ez, 0.12, 1, 0.2, 0.33, 0.22 * k);
      lines.reticle(e.ax, e.ay, ez, 0.75 - 0.25 * Math.min(1, e.pt / e.sight), 0.04, 1, 0.25, 0.35, 0.9 * k);
    } else if (e.phase === 2) {
      const strobe = (Math.floor(e.pt * 24) % 2) ? 1 : 0.8;
      lines.line(mx, my, mz, e.ax, e.ay, ez, 0.05, 1, 0.95, 0.95, strobe);
      lines.line(mx, my, mz, e.ax, e.ay, ez, 0.2, 1, 0.35, 0.45, 0.35);
      lines.reticle(e.ax, e.ay, ez, 0.5, 0.06, 1, 1, 1, strobe);
    } else if (e.flash > 0) {
      lines.line(mx, my, mz, e.ax, e.ay, ez, 0.06, 1, 0.9, 0.9, e.flash * 0.8);
    }
    // a sniper inside the box can be flown into (level 5 keeps them out of it; level 10 may not)
    if (Math.abs(e.z) < 1.6 && Math.hypot(ship.x - e.x, ship.y - e.y) < e.r + SHIP_R && !e.rammed) { e.rammed = true; api.game.crash(e, 20); api.kill(e, false); }
    if (e.z > 12) e.alive = false;
  },
  // where the autopilot should not be: the locked point, until the bolt has gone
  avoid(e) { return e.phase === 2 ? [{ x: e.ax, y: e.ay, r: 1.9 }] : null; },
});
