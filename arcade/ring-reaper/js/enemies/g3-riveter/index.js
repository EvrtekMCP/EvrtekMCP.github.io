// THE RIVETER (galaxy 3, level 7 on: the Rivet Line's headline). Yori's heavy gun on a gantry yoke (g3-enemies.js
// riveter), 3.6 long. It rides in out of the haze onto a station above or beside the lane, keeps pace with you, and
// STITCHES: it fires a STRING of 3 to 6 bolts, each aimed at you, on the music. The plan (4.7): "Riveters stitch strings
// of bolts at you, so roll on every stitch."
//   THE COUNTER  six red lights round its muzzle, one for every bolt still to come, so you see how many are coming.
//   THE STITCH   each bolt arrives on a beat of the track that is playing, at least 1.0 s after the one before: a hair
//                over one whole roll and its recharge (0.95 s), so a player who rolls on each note always makes the next.
//   ITS TELL     the bore glows white for 0.5 s before every bolt, and a flash as it fires.
//   STITCHED!    send the whole string home and the last bolt splits the gun (xN, a bonus). Part of a string sent
//                home only scars it: it rides away with the rest.
// Two riveters given the same `sync` key start their strings on the same beat (the Cross-Stitch: notes from left and
// right that alternate singles and pairs; a pair lands together, so one roll takes both).
//
// Event: { nx, ny        its station, normalised: keep it OUTSIDE the box (|nx| > 1.1 or ny > 1.15)
//          notes [0,3,6] the string, in beats from its first note (or n: 4 and every: 3)
//          hold 110       metres ahead it rides
//          wide 0         metres beside you it aims on purpose (the harmless first string: it passes by)
//          skim 0         metres beside you, toward the box's middle: the bolts graze at worst (a skim string)
//          curtain null   { gap: 2.6, step: 1.0, off: 0.5, axis: 'x'|'y' }: every note a CURTAIN, a line of bolts across the lane
//                         at your height with a gap near you (the Vault's graze stretches)
//          seam           its bolts bend after you (the later strings: a roll is the answer, not a drift)
//          sync           a key shared by riveters that start together
//          first          the level's first string: a longer tell }
import { THREE, defineEnemy, buildModel, clamp, damp, SPAWN_D } from '../../api.js?v=0.6.4';
import { MESH } from './mesh.js?v=0.6.4';
import { MIN_GAP, beatNow, bookNote } from './clock.js?v=0.6.4';

export const BOLT_T = 1.0, TEL = 0.5, CURTAIN_T = 1.15;
const IN = 3.0, SCALE = 2.7, RED = new THREE.Color(0xff3355), HOT = new THREE.Color(0xfff2f2), DIM = new THREE.Color(0x2a2730);
const SYNC = new Map();
let glowMat = null, lastRun = -1;

function make(api) {
  // her barrel points down -Z; the inner group turns it to +Z so lookAt() aims it at the ship (the sniper's way)
  const g = new THREE.Group(), inner = new THREE.Group(); inner.rotation.y = Math.PI; g.add(inner);
  const m = buildModel(MESH.rest, { own: ['#ff3355*'] }); inner.add(m.group);
  // the counter: six lights in her counter's places (round the muzzle at -1.7), drawn as glows so they read at range
  const lights = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + Math.PI / 2, s = new THREE.Sprite(glowMat.clone());
    s.position.set(Math.cos(a) * 0.95, Math.sin(a) * 0.95, -1.75); s.scale.setScalar(0.85); inner.add(s); lights.push(s);
  }
  const bore = new THREE.Sprite(glowMat.clone()); bore.position.set(0, 0, -2.1); bore.scale.setScalar(1.2); inner.add(bore);
  g.userData = { core: m.mats['#ff3355*'], inner, lights, bore };
  return g;
}

export default defineEnemy({
  name: 'g3-riveter',
  motion: 'own', spawnAt: 'now',
  // check-levels (rule 12): the bolt's flight (x the level's ease.shot) plus the bore's tell; galaxy 3, level 7
  hazard: { cls: 'shot', introduced: [3, 7], shotT: BOLT_T, tel: TEL },
  killPts: 1200,
  sample: { nx: 0, ny: 0.6, n: 0 },
  init(api) {
    glowMat = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 });
  },
  targetable: (e) => e.phase === 1,
  spawn(e, ev, api) {
    if (api.time < lastRun) SYNC.clear(); lastRun = api.time;
    const B = api.box;
    e.obj = api.course.get('g3-riveter', () => make(api));
    e.hold = ev.hold || 110;
    e.hx = (ev.nx ?? 0) * B.x; e.hy = (ev.ny ?? 1.25) * B.y;
    e.x0 = e.hx * 1.4; e.y0 = e.hy + 10; e.x = e.x0; e.y = e.y0; e.z = -SPAWN_D;
    const notes = ev.notes || Array.from({ length: ev.n ?? 3 }, (_, i) => i * (ev.every || 3));
    e.notes = notes; e.n = notes.length; e.plan = null; e.next = 0; e.home = 0; e.fired = 0;
    e.tel = ev.first ? 0.8 : TEL; e.T = ev.curtain ? CURTAIN_T : BOLT_T;
    e.phase = 0; e.t = 0; e.flash = 0; e.r = 2.4; e.hitR = 2.6; e.scar = 0;
    e.sx = e.sy = e.sz = SCALE;
    const ud = e.obj.userData; ud.core.color.copy(RED);
    ud.inner.rotation.z = e.hy > B.y ? Math.PI : 0;  // hung from a gantry above the lane: yoke up
    for (const l of ud.lights) { l.material.opacity = 0; l.material.color.setHex(0xff3355); }
    ud.bore.material.opacity = 0;
  },
  update(e, dt, api) {
    const ud = e.obj.userData, B = api.box, ship = api.ship, ev = e.ev;
    if (e.phase === 0) {
      // in out of the haze, braking onto its station
      const k = Math.min(1, e.t / IN), ease = 1 - (1 - k) * (1 - k);
      e.z = -SPAWN_D + (SPAWN_D - e.hold) * ease;
      e.x = e.x0 + (e.hx - e.x0) * ease; e.y = e.y0 + (e.hy - e.y0) * ease;
      if (k >= 1) { e.phase = 1; e.t = 0; schedule(e, api); }
    } else if (e.phase === 1) {
      // it keeps pace on its station, riding a little toward your side of the lane
      e.x = damp(e.x, e.hx + clamp(ship.x - e.hx, -2, 2) * 0.3, 1.2, dt);
      e.y = e.hy + Math.sin(e.t * 2.1) * 0.25;
      e.z = -e.hold;
      const P = e.plan;
      while (e.next < P.length && e.t >= P[e.next] - e.T) { fire(e, api); e.next++; }
      // the leave: the last bolt has landed (or come home)
      if (e.next >= P.length && e.t > P[P.length - 1] + 0.6) { e.phase = 2; e.t = 0; e.vz = 0; }
    } else {
      // gone: it rides off ahead along its line, back out past the fog (never vanishing in plain view)
      e.vz = Math.min(330, e.vz + dt * 240);
      e.z -= e.vz * dt; e.y += 5 * dt * Math.sign(e.hy || 1);
      if (e.z < -SPAWN_D) e.alive = false;
    }
    // the tell: the bore heats for `tel` seconds before each bolt; the counter shows the bolts still to come
    let heat = 0;
    if (e.phase === 1 && e.next < e.plan.length) { const into = e.t - (e.plan[e.next] - e.T - e.tel); heat = clamp(into / e.tel, 0, 1); }
    e.flash = Math.max(0, e.flash - dt * 7);
    const left = e.n - e.fired;
    ud.lights.forEach((l, i) => { const on = e.phase === 1 && i < left; l.material.opacity = on ? (i === left - 1 ? 0.7 + 0.3 * heat : 0.75) : e.phase === 0 && i < e.n ? 0.35 : 0; });
    ud.bore.material.color.copy(RED).lerp(HOT, Math.max(heat, e.flash));
    ud.bore.material.opacity = Math.max(heat * 0.95, e.flash);
    ud.bore.scale.setScalar(1.0 + 2.6 * Math.max(heat, e.flash));
    ud.core.color.copy(e.scar > 0 ? DIM : RED).lerp(HOT, heat * 0.6);
    e.scar = Math.max(0, e.scar - dt * 2);
    e.appear = api.appear(e.z);
    api.pose(e);
    e.obj.lookAt(ship.x, ship.y, 6);
  },
  // a bolt of its own sent home: it rivets the gun. The whole string home and the gun splits: STITCHED!
  onShot(e, s, api) {
    e.home++; e.scar = 1;
    api.game.burst(e.x, e.y, e.z, 18, { speed: 9, life: 0.35, s0: 1, r: 0.6, g: 0.9, b: 1, carry: 0 });
    // a curtain rig is not stitched (each note is a whole line of bolts): enough of them home and it goes, as any gun
    if (e.ev.curtain) { if (e.home >= 2 * e.n) api.kill(e, true); return; }
    if (e.home >= e.n && e.n >= 2) {
      api.game.call('STITCHED! x' + e.n, 'c-cyan');
      api.game.sfx('g3-stitched', { vol: 0.9 });
      api.game.score(500 * e.n * e.n, e.x, e.y + 3, e.z, 'big', 'STITCHED');
      api.kill(e, true);
    } else if (e.home >= e.n) api.kill(e, true);
    else api.game.pop(e.home + '/' + e.n, e.x, e.y + 2.5, e.z, 'cyan');
  },
});

// When it reaches its station: the string, as arrival moments (seconds from now). The first lands on a beat of the music
// at least a tell and a flight from now; each next on its beat. Every note is booked on the shared ledger (clock.js), so
// it lands at least MIN_GAP after any other gun's note, unless it is this string's sync partner landing with it.
function schedule(e, api) {
  const ev = e.ev, { beat, toBeat } = beatNow(api), now = api.time;
  let first = toBeat; while (first < e.tel + e.T * api.ease.shot + 0.15) first += beat;
  if (ev.sync) {
    const s = SYNC.get(ev.sync);
    if (s && Math.abs(s.at - now) < 0.6) first = s.first - (now - s.at); else SYNC.set(ev.sync, { at: now, first });
  }
  const grid0 = now + toBeat, snap = (a) => grid0 + Math.ceil((a - grid0) / beat - 1e-6) * beat;
  const P = []; let prev = -1e9;
  for (const b of e.notes) {
    let a = now + first + b * beat; if (a < prev + MIN_GAP) a = snap(prev + MIN_GAP);
    a = bookNote(api, a, ev.sync ? ev.sync + ':' + b : null, snap);
    P.push(a - now); prev = a;
  }
  e.plan = P; e.next = 0;
}

const tmpV = new THREE.Vector3();
function fire(e, api) {
  const ev = e.ev, B = api.box, ship = api.ship;
  // the muzzle: down the barrel toward you
  tmpV.set(ship.x - e.x, ship.y - e.y, -e.z).normalize();
  const k = 2.1 * SCALE * e.appear, from = { x: e.x + tmpV.x * k, y: e.y + tmpV.y * k, z: e.z + tmpV.z * k };
  // aim where the ship is going (a quarter second of lead), held inside the box
  const lead = 0.22, ax = clamp(ship.x + ship.vx * lead, -B.x, B.x), ay = clamp(ship.y + ship.vy * lead, -B.y, B.y);
  e.fired++; e.flash = 1;
  api.game.sfx('g3-rivet', { vol: 0.7, pan: clamp(e.x / B.x * 0.5, -0.8, 0.8), gap: 0.03 });
  if (ev.curtain) { curtain(e, api, from, ax, ay); return; }
  let tx = ax, ty = ay;
  if (ev.wide) { const s = ship.x > 0 ? -1 : 1; tx = clamp(ship.x + s * ev.wide, -B.x * 1.2, B.x * 1.2); }
  else if (ev.skim) { const s = ship.x > 0 ? -1 : 1; tx = clamp(ax + s * ev.skim, -B.x, B.x); }
  api.fire(from, tx, ty, { T: e.T, owner: e, tag: 'rivet', steer: ev.seam && !ev.wide && !ev.skim ? seam : undefined });
}

// SEAM (the later strings, the plan's "the only answer is a roll on each note"): the bolt bends after you with a limited
// pull (SEAM_A m/s2, its red trail shows the curve) until its last SEAM_STOP seconds, then flies straight. Drifting out
// of its way no longer works; a late juke still can, and a roll always does.
const SEAM_A = 30, SEAM_STOP = 0.3;
function seam(s, dt, api) {
  const vz = s.vz + (s.carry ? api.v : 0), tr = -s.z / Math.max(1, vz);
  if (tr <= SEAM_STOP || dt <= 0) return;
  const ship = api.ship, A = SEAM_A * dt;
  s.vx += clamp((ship.x - s.x) / tr - s.vx, -A, A);
  s.vy += clamp((ship.y - s.y) / tr - s.vy, -A, A);
}

// a CURTAIN: a line of bolts across the lane at your height (or down it at your side), 1.0 m apart, with one gap of
// exactly `gap` near you. Thread the gap and the four bolts nearest graze you (about 48 GREED); roll through it and they
// go home (32, and 10 more for three or more in one roll). Either way a curtain is worth half a meter: graze-rich.
export const lineOfBolts = (span, g, gap, step) => { const out = []; for (let k = 0; ; k++) { const a = g - gap / 2 - k * step, b2 = g + gap / 2 + k * step; if (a < -span - 0.01 && b2 > span + 0.01) break; if (a >= -span - 0.01) out.push(a); if (b2 <= span + 0.01) out.push(b2); } return out; };
function curtain(e, api, from, ax, ay) {
  const c = e.ev.curtain, B = api.box, gap = c.gap || 2.6, step = c.step || 1.0, alongY = c.axis === 'y';
  const span = alongY ? B.y : B.x, at = alongY ? ay : ax;
  // the gap sits half a metre off where you are going, so threading it is a small move, not a wait
  const off = (c.off ?? 0.5) * (((e.fired * 7 + e.id) % 2) ? 1 : -1), g = clamp(at + off, -span + gap / 2, span - gap / 2);
  for (const p of lineOfBolts(span, g, gap, step)) api.fire(from, alongY ? ax : p, alongY ? p : ay, { T: e.T, owner: e, tag: 'curtain' });
}
