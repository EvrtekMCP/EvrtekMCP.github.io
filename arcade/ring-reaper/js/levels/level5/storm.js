// LEVEL 5, ION STORM: the storm's pieces on the course. Everything here hangs off Yori's ion pylon (an 18 m
// floating truss tower with a lamp at its tip) and her lightning arc (white, jagged, redrawn every few frames).
//   l5-pylon  one pylon (a sniper's perch, the storm's scenery). Decor: it never hurts.
//   l5-pair   two scenery pylons far outside the lane with a harmless violet arc between them. Decor.
//   l5-arc    ONE arc across the lane between two lamps, switching on the beat. Hurts while live.
//   l5-sheet  two cables strung down the track on pylons, a curtain of arcs between them: the box split in
//             two for as long as it runs, live on the beat. Cross it in its dark beats. May carry a rail sniper:
//             send the sniper's bolt home and the sheet shorts out for good.
//   l5-wall   the lightning wall: arcs across the whole lane but for one gap. Always live. The finale.
// The tell, for every arc (Yori): an arc about to fire has both lamps lit, red going white-hot, for a whole bar.
import { THREE, defineDecor, defineObstacle, Instanced, appear, clamp, SHIP_R } from '../../api.js?v=0.6.3';
import { MESH } from './mesh.js?v=0.6.3';
import { ArcLayer, PATTERNS, CHARGE_BEATS, checkPattern, arcState } from './arcs.js?v=0.6.3';
import { TRACK, beatAt } from './track.js?v=0.6.3';
import { tAtD, speed } from './plan.js?v=0.6.3';

export const HIT_BAND = 0.9;    // metres from a live arc's line to the ship's centre that hurts (core 0.12 + SHIP_R, generous)
export const CLOSE_BAND = 2.4;  // a live arc this close pays CLOSE (the risk line, rule 31)
export const LAMP_Y = 9.8;      // the lamp's centre, up the pylon from its middle (her ionPylon(18))
const ARC_DMG = 18;

// ---------------------------------------------------------------- shared layers
let arcs = null, truss = null, trussLit = null, lamps = null, feet = null;
const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpC = new THREE.Color();
function layers(api) {
  if (arcs) return;
  arcs = new ArcLayer(api.scene, api.tier === 0 ? 3500 : 6500);
  // her pylon: two truss colours, and the glowing lamp at the tip split from the small glow at its foot
  const groups = MESH.pylon, geo = (p) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g; };
  const glow = groups.find((g) => g.glow), lampP = [], footP = [];
  for (let i = 0; i < glow.p.length; i += 9) (glow.p[i + 1] > 5 ? lampP : footP).push(...glow.p.slice(i, i + 9));
  const lit = (col) => new THREE.MeshStandardMaterial({ color: col, metalness: 0.55, roughness: 0.45, flatShading: true, side: THREE.DoubleSide });
  truss = new Instanced(api.scene, geo(groups.find((g) => g.color === '#3a4a6a').p), lit(0x3a4a6a), 320);
  trussLit = new Instanced(api.scene, geo(groups.find((g) => g.color === '#7a94c0').p), lit(0x7a94c0), 320);
  lamps = new Instanced(api.scene, geo(lampP), new THREE.MeshBasicMaterial({ color: 0xffffff }), 320);
  feet = new Instanced(api.scene, geo(footP), new THREE.MeshBasicMaterial({ color: 0x9a88d8 }), 320);
  lamps.mesh.setColorAt(0, tmpC.setHex(0xffffff));
}
const ALL = () => [truss, trussLit, lamps, feet];
function beginAll(api) { layers(api); arcs.begin(api.focalPx); for (const L of ALL()) L.begin(); }
function endAll() { arcs.end(); for (const L of ALL()) L.end(); }

// a pylon with its lamp at (lx, ly, lz). It stands below a lamp that is low in the lane and hangs above one that
// is high, leaning a little away from the lane, as in Yori's mood frame.
function pylonAt(lx, ly, lz, s, a, lampHex, yaw = 0) {
  a *= clamp((-10 - lz) / 18, 0, 1); // it folds away as it nears the ship, before it can fill the camera
  if (a <= 0.002) return;
  const ux = -Math.sign(lx) * 0.18, uy = ly > 0.01 ? -1 : 1, L = Math.hypot(ux, uy);
  const th = Math.atan2(-ux / L, uy / L);
  tmpQ.setFromEuler(tmpE.set(0, yaw, th, 'ZYX'));
  const k = s * a, ox = lx + Math.sin(th) * LAMP_Y * k, oy = ly - Math.cos(th) * LAMP_Y * k;
  truss.put(ox, oy, lz, tmpQ, k, k, k); trussLit.put(ox, oy, lz, tmpQ, k, k, k);
  lamps.put(ox, oy, lz, tmpQ, k, k, k, lampHex); feet.put(ox, oy, lz, tmpQ, k, k, k);
}
// the lamp's colour: idle violet; charging red going white-hot (and pulsing faster); live white; shorted dead
const IDLE = 0x8f7fd0;
function lampHex(st, t, dead) {
  if (dead) return 0x2a2730;
  if (st.live) return 0xffe8f2;
  if (st.charge > 0) {
    const c = st.charge, pulse = 0.55 + 0.45 * Math.sin(t * (10 + 26 * c));
    tmpC.setRGB(1, 0.2 + 0.75 * c * c, 0.33 + 0.62 * c * c).multiplyScalar(0.55 + 0.45 * pulse);
    return tmpC.getHex();
  }
  return IDLE;
}
const PILOT = [1, 0.25, 0.38, 0.35];
// near the camera everything thins out: an arc level with the ship is half there, one behind it gone (a bolt a
// metre from the lens would fill the screen)
export const nearK = (z) => clamp((4 - z) / 8, 0, 1);
// a live hazard arc: a white-hot core in a red fringe; two strands, or one (a sheet's rungs, a wall's rows)
function liveBolt(ax, ay, az, bx, by, bz, seed, a, segs = 9, o = {}) {
  a *= nearK(az); if (a < 0.01) return;
  arcs.bolt(ax, ay, az, bx, by, bz, seed, { segs, amp: o.amp ?? 0.11, core: [1, 0.97, 1, a], coreW: 0.13, halo: [1, 0.2, 0.33, (o.halo ?? 0.55) * a], haloW: o.haloW ?? 0.8, fork: o.fork ?? 0.5 });
  if (!o.single) arcs.bolt(ax, ay, az, bx, by, bz, seed * 7 + 3, { segs, amp: 0.16, core: [1, 0.85, 0.92, 0.55 * a], coreW: 0.06, halo: null });
}
const RUNG = { amp: 0.07, halo: 0.32, haloW: 0.5, fork: 0.25, single: true };
const ROW = { amp: 0.05, halo: 0.3, haloW: 0.45, fork: 0.15, single: true };
// the last beat and a bit of a charge: thin red pilot flickers, no fringe (it can't hurt yet)
function pilotBolt(ax, ay, az, bx, by, bz, seed, a) { a *= nearK(az); if (a < 0.01) return; arcs.bolt(ax, ay, az, bx, by, bz, seed, { segs: 7, amp: 0.2, core: [PILOT[0], PILOT[1], PILOT[2], PILOT[3] * a], coreW: 0.05, halo: null }); }
// distance from (px, py) to the segment a-b, and which side of its line the point is on
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}
const sideOf = (px, py, ax, ay, bx, by) => Math.sign((bx - ax) * (py - ay) - (by - ay) * (px - ax));
// rule 12, honestly: the charge is CHARGE_BEATS of the COURSE's beat, so at speed v (GREED, a boost) it is that
// much shorter in real time than at the plan's speed. An always-live arc is static: seen from 580 m.
const chargeWarn = (ev, v) => (/\./.test(pat(ev.pat)) ? CHARGE_BEATS * TRACK.beat * speed(ev.d || 0) / v : 580 / v);
const pat = (p) => checkPattern(PATTERNS[p] || p || PATTERNS.bar, 'level 5 arc');
const seedNow = (api, id, rate = 18) => id * 977 + Math.floor(api.time * rate);
// THE COURSE'S BEAT: the beat the music would be on at this point of the course at the plan's speed (plan.js).
// Played at that speed it IS the music's beat, to the frame. GREED and boosts carry the course ahead of the
// music, and the arcs go with the course, so the rings laid out against their dark beats always stay true; a
// clock read off the music would put the rings into live lightning after the first GREED.
const beatNow = (api) => beatAt(tAtD(api.G.courseD || 0));
// the music's own beat, for the storm's harmless flicker
const musicBeat = (api) => beatAt(api.time);
// the crack (rule 11: light AND sound): Eleven's lightning-crack as an arc in reach goes live, at most one a beat
let lastCrack = -9;
function crack(e, st, dist, x, api) {
  const was = e.wasLive; e.wasLive = st.live;
  if (!st.live || was || dist > 420 || e.ev.warm || api.time - lastCrack < 0.3) return;
  lastCrack = api.time;
  api.game.sfx('lightning-crack', { vol: clamp(1.1 - dist / 420, 0.25, 1), pan: clamp(x / api.box.x * 0.5, -0.8, 0.8), rate: 0.94 + Math.random() * 0.12 });
}
// shared scoring for passing a live arc close, or threading a charging one
function closeCall(e, d, api) { if (!e.closed) { e.closed = true; api.game.scrape(e, d); } }
function threaded(e, api) {
  if (e.threaded) return; e.threaded = true;
  api.game.score(300 * api.game.mult, api.ship.x, api.ship.y + 1.3, 0, 'cyan', 'THREADED');
  api.game.greed(6);
}

// A run's opening frame (a cut): the engine fades fresh things in over 0.5 s from dt/0.5, which for an 18 m
// pylon 30 m out is already several pixels on the first frame. The storm's big pieces start their fade a few
// frames later, from exactly nothing (the pop-in proof, run.js popin).
const fadeK = (e) => (e.fadeIn === undefined ? 1 : clamp((e.fadeIn - 0.04) / 0.46, 0, 1));

// ---------------------------------------------------------------- l5-pylon: one pylon (decor)
export const pylon = defineDecor({
  name: 'l5-pylon',
  hazard: null,
  init: layers,
  begin: beginAll, end: endAll,
  // dy: metres to add to y (a perch: the lamp sits under the sniper whatever the box's shape)
  spawn(e, ev) { e.s = ev.s || 1; e.yaw = ev.yaw || 0; e.lamp = ev.lamp ?? IDLE; if (ev.dy) e.y += ev.dy; },
  update(e, dt, api) {
    pylonAt(e.x, e.y, e.z, e.s, appear(e.z) * fadeK(e), e.lamp, e.yaw);
    if (e.z > 40) e.alive = false;
  },
});

// ---------------------------------------------------------------- l5-pair: scenery pylons with a violet arc
export const pair = defineDecor({
  name: 'l5-pair',
  hazard: null,
  init: layers,
  begin: beginAll, end: endAll,
  spawn(e, ev) { e.bx = ev.bx; e.by = ev.by; e.dz = ev.dz || 0; e.s = ev.s || 1; e.every = ev.every || 8; e.off = ev.off || 0; },
  update(e, dt, api) {
    const fin = fadeK(e), bz = e.z - e.dz, a = appear(e.z) * fin, b = appear(bz) * fin;
    pylonAt(e.x, e.y, e.z, e.s, a, IDLE, 0.4); pylonAt(e.bx, e.by, bz, e.s, b, IDLE, 1.1);
    // a soft violet arc, flashing on its beat for a beat (scenery: dim, violet, no red fringe, never in the lane)
    const mb = musicBeat(api) - e.off, on = ((Math.floor(mb) % e.every) + e.every) % e.every === 0;
    const ab = Math.min(a, b);
    if (on && ab > 0.05) arcs.bolt(e.x, e.y, e.z, e.bx, e.by, bz, seedNow(api, e.id), { segs: 9, amp: 0.13, core: [0.66, 0.56, 1, 0.55 * ab], coreW: 0.14, halo: [0.4, 0.26, 0.85, 0.25 * ab], haloW: 1.0, fork: 0.6 });
    if (e.z > 40 && bz > 40) e.alive = false;
  },
});

// ---------------------------------------------------------------- l5-arc: one arc across the lane
// ev: { ax, ay, bx, by } the two lamps (normalised box; keep them outside it, |n| ~ 1.25),
//     pat (a PATTERNS name or an X./ string), off (beats), s (pylon scale)
export const arc = defineObstacle({
  name: 'l5-arc',
  hazard: { cls: 'sweep', introduced: 7, warn: (ev, v) => chargeWarn(ev, v) },
  sample: { ax: -1.25, ay: 0.4, bx: 1.25, by: 0.4, pat: 'bar' },
  // 0.3.1, check-levels' "no fully blocked moment": its solid shape as it crosses the ship's plane, as the distance from
  // a ship centre (x, y) to its surface (the kind's own hit test is that distance under part of SHIP_R)
  // (it switches on the beat; the check takes it as live: the worst case)
  solid: (ev, B) => [{ live: 'beat', dist: (x, y) => segDist(x, y, ev.ax * B.x, ev.ay * B.y, ev.bx * B.x, ev.by * B.y) - 0.12 }],
  init: layers,
  begin: beginAll, end: endAll,
  spawn(e, ev, api) {
    const B = api.box;
    e.p = pat(ev.pat); e.off = ev.off || 0; e.s = ev.s || 1;
    e.ax = ev.ax * B.x; e.ay = ev.ay * B.y; e.bx = ev.bx * B.x; e.by = ev.by * B.y;
    e.st = {};
  },
  update(e, dt, api) {
    const st = arcState(e.p, beatNow(api), e.off, e.st), a = e.appear, t = api.time;
    const hex = lampHex(st, t, false);
    pylonAt(e.ax, e.ay, e.z, e.s, a, hex, 0.3); pylonAt(e.bx, e.by, e.z, e.s, a, hex, 1.2);
    crack(e, st, -e.z, (e.ax + e.bx) / 2, api);
    if (st.live || e.ev.warm) liveBolt(e.ax, e.ay, e.z, e.bx, e.by, e.z, seedNow(api, e.id), a);
    else if (st.charge > 0.66) pilotBolt(e.ax, e.ay, e.z, e.bx, e.by, e.z, seedNow(api, e.id, 30), a);
    if (e.crossed) {
      const d = segDist(api.ship.x, api.ship.y, e.ax, e.ay, e.bx, e.by);
      if (st.live && d < HIT_BAND) api.game.crash(e, ARC_DMG, true);
      else if (st.live && d < CLOSE_BAND) closeCall(e, d, api);
      else if (st.charge > 0 && d < HIT_BAND + 0.4) threaded(e, api);
    }
    if (e.z > 40) e.alive = false;
  },
  avoid(e) {
    const st = e.st; if (!st || !(st.live || st.charge > 0.3)) return null;
    const out = [], n = 9;
    for (let i = 0; i <= n; i++) out.push({ x: e.ax + (e.bx - e.ax) * i / n, y: e.ay + (e.by - e.ay) * i / n, r: 1.9 });
    return out;
  },
});

// ---------------------------------------------------------------- l5-sheet: a curtain of arcs down the track
// ev: { ax, ay, bx, by } the two cables (normalised), len (metres down the track), step (pylon spacing),
//     pat, off, sniper: { side: 'a'|'b', dz: metres behind the front (a multiple of step), at, shots, sight }
// It moves itself (motion 'own') because it is long: e.z is kept at the nearest bit of it still ahead, so the
// autopilot and the course see it for as long as it runs past the ship; e.f is its front and e.f - len its tail.
export const sheet = defineObstacle({
  name: 'l5-sheet',
  motion: 'own',
  hazard: { cls: 'sweep', introduced: 7, warn: (ev, v) => chargeWarn(ev, v) },
  sample: { ax: -1.25, ay: -0.4, bx: 1.25, by: -0.4, len: 60, pat: 'bar' },
  // 0.3.1, check-levels' "no fully blocked moment": its solid shape as it crosses the ship's plane, as the distance from
  // a ship centre (x, y) to its surface (the kind's own hit test is that distance under part of SHIP_R)
  // (it runs past the ship for `len` metres and switches on the beat; the check takes it as live all the way)
  solid(ev, B) { const out = [], len = ev.len || 200; for (let u = 0; u <= len; u += 20) out.push({ at: u, live: 'beat', dist: (x, y) => segDist(x, y, ev.ax * B.x, ev.ay * B.y, ev.bx * B.x, ev.by * B.y) - 0.12 }); return out; },
  init: layers,
  begin: beginAll, end: endAll,
  spawn(e, ev, api) {
    const B = api.box;
    e.p = pat(ev.pat); e.off = ev.off || 0; e.len = ev.len || 200; e.step = ev.step || 40;
    e.ax = ev.ax * B.x; e.ay = ev.ay * B.y; e.bx = ev.bx * B.x; e.by = ev.by * B.y;
    e.f = e.z; e.st = {}; e.side = 0; e.shorted = false; e.sn = null;
    if (ev.sniper && !ev.warm) {
      const s = ev.sniper, onA = (s.side || 'a') === 'a', lx = onA ? e.ax : e.bx, ly = onA ? e.ay : e.by;
      // it stands on the lamp (her sniper's legs reach 2.5 m below it), or hangs under one that hangs from above
      const hang = ly > 0.01;
      e.sn = api.spawn({ type: 'sniper', x: lx, y: ly + (hang ? -3.8 : 3.8), hang, shots: s.shots ?? 1, at: s.at ?? 2.8, sight: s.sight, gap: s.gap }, e.f - (s.dz || 0));
    }
  },
  update(e, dt, api) {
    e.f += api.v * dt;
    const tail = e.f - e.len, ship = api.ship;
    e.z = tail < -1.5 ? Math.min(e.f, -1.5) : e.f;
    const fin = fadeK(e);
    if (e.sn && e.sn.dead && !e.shorted) short(e, api);
    const st = e.shorted ? (e.st.live = false, e.st.charge = 0, e.st) : arcState(e.p, beatNow(api), e.off, e.st);
    const t = api.time, hex = lampHex(st, t, e.shorted);
    if (tail < 0) crack(e, st, Math.max(0, -e.f), (e.ax + e.bx) / 2, api);
    // the visible stretch of it
    const zNear = Math.min(e.f, 9), zFar = Math.max(tail, -800);
    if (zNear > zFar) {
      // pylons on both cables every `step` metres, from the front back
      const k0 = Math.max(0, Math.ceil((e.f - 9) / e.step)), k1 = Math.floor(Math.min(e.len, e.f + 800) / e.step);
      for (let k = k0; k <= k1; k++) {
        const z = e.f - k * e.step, a = appear(z) * fin;
        pylonAt(e.ax, e.ay, z, 1, a, hex, 0.3 + k); pylonAt(e.bx, e.by, z, 1, a, hex, 1.2 + k);
      }
      // the cables, pylon to pylon: violet idle, red pulsing on a charge, white-pink live
      const cab = e.shorted ? [0.15, 0.12, 0.2, 0.4] : st.live ? [1, 0.85, 0.95, 0.9] : st.charge > 0 ? [1, 0.25, 0.4, 0.5 + 0.4 * st.charge] : [0.5, 0.42, 0.85, 0.55];
      for (const [cx, cy] of [[e.ax, e.ay], [e.bx, e.by]]) {
        let px = -(2.5 - cy), py = -cx; const L = Math.hypot(px, py) || 1; px /= L; py /= L; // facing the camera's axis
        for (let z = Math.min(zNear, -6); z > zFar; z -= e.step) { // never through the camera
          const z2 = Math.max(zFar, z - e.step), a = appear(z2) * fin * nearK(z + 8);
          if (a > 0.002) arcs.seg(cx, cy, z, cx, cy, z2, 0.07, cab[0], cab[1], cab[2], cab[3] * a, px, py, 0);
        }
      }
      // the curtain: rungs of lightning between the cables, flickering; a faint red sheen across the plane
      if (st.live || st.charge > 0.66) {
        // rungs are fixed to the sheet (k counts back from its front), so they stream past with it
        const R = api.tier === 0 ? 13 : 9, live = st.live;
        for (let k = Math.max(0, Math.ceil((e.f - zNear) / R)); e.f - k * R > zFar; k++) {
          const z = e.f - k * R, a = appear(z) * fin; if (a < 0.01) continue;
          const seed = seedNow(api, e.id * 131 + k, 16);
          if (((seed * 2654435761) >>> 0) / 4294967296 > (live ? 0.78 : 0.3)) continue;
          if (live) liveBolt(e.ax, e.ay, z, e.bx, e.by, z, seed, a, z < -320 ? 5 : 8, RUNG);
          else pilotBolt(e.ax, e.ay, z, e.bx, e.by, z, seed, a);
        }
        if (live) for (let z = Math.min(zNear, -4); z > zFar; z -= 60) { const z2 = Math.max(zFar, z - 60), a = appear(z2) * fin; arcs.plane(e.ax, e.ay, e.bx, e.by, z, z2, 1, 0.2, 0.33, 0.045 * a); }
      }
    }
    // the ship, while the sheet runs past it
    if (e.f >= 0 && tail <= 0 && !e.shorted) {
      const d = segDist(ship.x, ship.y, e.ax, e.ay, e.bx, e.by), side = sideOf(ship.x, ship.y, e.ax, e.ay, e.bx, e.by);
      if (st.live && d < HIT_BAND) { if (!ship.invuln) api.game.crash(e, ARC_DMG, true); }
      else if (st.live && d < CLOSE_BAND) closeCall(e, d, api);
      if (e.side && side && side !== e.side && !st.live && st.charge > 0) threaded(e, api);
      if (side) e.side = side;
    }
    if (tail > 12) { e.alive = false; }
  },
  avoid(e) {
    const st = e.st; if (e.shorted || !st || !(st.live || st.charge > 0.3)) return null;
    const out = [], n = 9;
    for (let i = 0; i <= n; i++) out.push({ x: e.ax + (e.bx - e.ax) * i / n, y: e.ay + (e.by - e.ay) * i / n, r: 1.9 });
    return out;
  },
});
function short(e, api) {
  e.shorted = true;
  const ship = api.ship;
  api.game.score(2000 * api.game.mult, ship.x, ship.y + 1.6, 0, 'big', 'SHORT CIRCUIT');
  api.game.call('SHORT CIRCUIT!', 'c-cyan');
  api.game.greed(12);
  api.game.shake(0.35);
  // sparks along the cables where they are in view
  for (let k = 0; k < 6; k++) {
    const z = Math.max(e.f - e.len, -300) + k * 40; if (z > 0) break;
    api.game.burst(e.ax, e.ay, z, 10, { speed: 9, life: 0.5, s0: 1.1, r: 0.8, g: 0.75, b: 1, carry: 1 });
    api.game.burst(e.bx, e.by, z, 10, { speed: 9, life: 0.5, s0: 1.1, r: 0.8, g: 0.75, b: 1, carry: 1 });
  }
}

// ---------------------------------------------------------------- l5-wall: the lightning wall, one gap
// ev: { gx, gy } the gap's centre (normalised), gr (its radius, metres), w, h (the frame's half-size in metres,
//     default just outside the box), open: [r0, r1] the gap widens from r0 to r1 as it closes in (the finale)
export const wall = defineObstacle({
  name: 'l5-wall',
  hazard: { cls: 'static', introduced: 7 },
  sample: { gx: 0, gy: 0, gr: 2.4 },
  // 0.3.1, check-levels' "no fully blocked moment": its solid shape as it crosses the ship's plane, as the distance from
  // a ship centre (x, y) to its surface (the kind's own hit test is that distance under part of SHIP_R)
  solid: (ev, B) => [{ dist: (x, y) => (ev.open ? ev.open[1] : ev.gr || 3) - Math.hypot(x - (ev.gx || 0) * B.x, y - (ev.gy || 0) * B.y) }],
  init: layers,
  begin: beginAll, end: endAll,
  spawn(e, ev, api) {
    const B = api.box;
    e.gx = (ev.gx || 0) * B.x; e.gy = (ev.gy || 0) * B.y; e.gr = ev.gr || 3;
    e.w = ev.w || B.x + 3; e.h = ev.h || B.y + 3; e.s = ev.s || 1; e.open = ev.open || null;
  },
  update(e, dt, api) {
    const a = e.appear, z = e.z, v = Math.max(1, api.v);
    if (e.open) { const arrive = -z / v; e.gr = e.open[0] + (e.open[1] - e.open[0]) * clamp((2.6 - arrive) / 1.6, 0, 1); }
    const W = e.w, H = e.h, gx = e.gx, gy = e.gy, gr = e.gr;
    // the frame: a lamp at each corner and along the edges
    const cols = Math.max(2, Math.round(W / (8 * e.s))), rowsN = Math.max(2, Math.round(H / (8 * e.s)));
    for (let i = 0; i <= cols; i++) { const x = -W + 2 * W * i / cols; pylonAt(x, -H, z, e.s, a, 0xffe8f2, i); pylonAt(x, H, z, e.s, a, 0xffe8f2, i + 0.5); }
    for (let j = 1; j < rowsN; j++) { const y = -H + 2 * H * j / rowsN; pylonAt(-W, y, z, e.s, a, 0xffe8f2, j); pylonAt(W, y, z, e.s, a, 0xffe8f2, j + 0.5); }
    if (a > 0.01) {
      const far = z < -300, seg = far ? 4 : 8, step = (y) => (Math.abs(y) < api.box.y + 2 ? 1.6 : W > 40 ? 6.5 : 3.6), nk = nearK(z);
      // rows across, broken round the gap; a soft red band behind each makes the wall read as solid
      for (let y = -H; y <= H + 0.01; y += step(y)) {
        const dy = y - gy, cut = Math.abs(dy) < gr ? Math.sqrt(gr * gr - dy * dy) : -1;
        const pieces = cut < 0 ? [[-W, W]] : [[-W, gx - cut], [gx + cut, W]];
        for (const [x0, x1] of pieces) {
          if (x1 - x0 < 0.3) continue;
          arcs.seg(x0, y, z, x1, y, z, step(y) * 0.6, 1, 0.2, 0.33, 0.08 * a * nk, 0, 1, 0);
          liveBolt(x0, y, z, x1, y, z, seedNow(api, e.id * 53 + Math.round(y * 10)), a, clamp(Math.round(seg * (x1 - x0) / 12), 3, 14), ROW);
        }
      }
      // the gap's rim: a ring of violet-white sparks, the way through
      const n = 24, r = gr + 0.2;
      for (let i = 0; i < n; i++) {
        const t0 = i / n * Math.PI * 2, t1 = (i + 1) / n * Math.PI * 2;
        const x0 = gx + Math.cos(t0) * r, y0 = gy + Math.sin(t0) * r, x1 = gx + Math.cos(t1) * r, y1 = gy + Math.sin(t1) * r;
        arcs.seg(x0, y0, z, x1, y1, z, 1.1, 0.5, 0.36, 1, 0.5 * a * nk);
        arcs.seg(x0, y0, z, x1, y1, z, 0.16, 0.9, 0.85, 1, a * nk);
      }
    }
    if (e.crossed) {
      const d = Math.hypot(api.ship.x - gx, api.ship.y - gy);
      if (d > gr - SHIP_R * 0.5) api.game.crash(e, 24, true);
      else if (d > gr - 1.4) closeCall(e, gr - d, api);
    }
    if (z > 40) e.alive = false;
  },
});
