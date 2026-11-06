// LEVEL 8: GRAVEYARD OF GIANTS. A dead fleet of colossal wrecks, rust and ash, and the searchlights still sweeping.
// The headline (rule 20): searchlights call the fleet's defence wave down on whatever they catch.
//   Act 1 (introduce) THE OUTER DEAD: one slow sweeping lamp at a time; the rings show the dark; caught costs one
//         strafer and one shot.
//   Act 2 (develop)   THE PICKET LINE: lamps every bar, in pairs whose beams cross, beside the broken spars;
//         a caught ship calls two strafers and a pod. A greedy ring line runs through the light (rule 31).
//         DEAD WATER: the breather. No lamps, ribs arching over the lane, the Mausoleum filling the sky.
//   Act 3 (twist)     THE WATCHTOWERS: the light hunts you. Lamps on towers ahead drive a pool of light at you,
//         slower than you fly: keep moving. A hunter that catches you fires one slow bolt down its beam; roll it
//         back up the beam and the light goes out.
//   Act 4 (master)    THE MAUSOLEUM: the set piece, a flight down the inside of the biggest wreck, its frames
//         flashing past, lamps on its walls rippling in sequence (sweepers and hunters, mastered); then out past
//         the bow into open space and the finish.
// Stealth pays a little (UNSEEN per lamp, GHOST per act on the tally); being caught pays more if you can take what
// it calls (deflects and kills). Pick one.
import { defineLevel, clamp } from '../api.js?v=0.3.0';
import ring from '../pickups/ring/index.js?v=0.3.0';
import pod from '../enemies/pod/index.js?v=0.3.0';
import shrike from '../enemies/shrike/index.js?v=0.3.0';
import sentry, { beamR, CATCH_K, SHIP_CORE, LAMP_IN, beamDir, reach } from '../enemies/searchlight-sentry/index.js?v=0.3.0';
import { spar, ghost } from './level8/kinds.js?v=0.3.0';
import { hull, rib, debris, tombPlate, hullDrift, ribDrift, ribArches, debrisField, tombRibs, tombPlating, ash, mausoleum } from './level8/scenery.js?v=0.3.0';

// ---- one schedule (rule 30). The track's bar grid (audio/levels/level8/music.json, take l8-t1: 137.982 bpm, first
// beat 0.154 s; intro 1-8, groove 9-24, build 25-32, drop 33-48, breakdown 49-56, build 57-64, drop 65-80, drive
// 81-88), and where each bar line falls on the course at the planned speeds. The run ends on bar 85, the take's
// loop end, so a run hears the take straight through and never its loop seam. Speed steps sit on bar lines and ramp
// over one bar (rule 6: density rises a bar or more after each step).
export const BPM = 137.982, FIRST = 0.154, BAR = 240 / BPM;
const tBar = (k) => FIRST + (k - 1) * BAR;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function vAt(t) {
  return 84 + 14 * ss(tBar(25), tBar(26), t) + 14 * ss(tBar(57), tBar(58), t) + 14 * ss(tBar(73), tBar(74), t)
    + 8 * clamp((t - tBar(74)) / (tBar(85) - tBar(74)), 0, 1);
}
const TD = [], TV = [];
{ let d = 0; for (let t = 0; t <= 200; t += 0.02) { TD.push(d); TV.push(vAt(t)); d += vAt(t) * 0.02; } }
const dAt = (t) => TD[clamp(Math.round(t / 0.02), 0, TD.length - 1)];
export const D = (k) => Math.round(dAt(tBar(k)));               // course metres where bar k starts
function speedAt(d) {                                            // m/s at course distance d
  let lo = 0, hi = TD.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TD[m] <= d) lo = m; else hi = m; }
  return TV[lo];
}
const END = D(85);

// ---- course helpers
// lamp mounts (normalised): left and right walls, floor and ceiling; aim = the centre of the swing, degrees
const MOUNT = { L: { nx: -1.36, aim: 0 }, R: { nx: 1.36, aim: 180 }, B: { ny: -1.42, aim: 90 }, T: { ny: 1.42, aim: -90 } };
const WAVES = { I: { shrikes: 1, shots: 1 }, Ib: { shrikes: 1, shots: 2 }, II: { shrikes: 2, shots: 3 }, IIp: { shrikes: 2, pods: 1, shots: 3 }, III: { shrikes: 1, shots: 3 }, IIIp: { shrikes: 2, pods: 1, shots: 3 }, IV: { shrikes: 1, shots: 3 } };
// both screen shapes the course must read on: landscape and the narrowest portrait (main.js resize)
const BOXES = [{ x: 7.5, y: 4.3 }, { x: 4.1, y: 5.6 }];
function sweeper(d, m, pos, arrive, o = {}) {
  const M = MOUNT[m];
  const nx = M.nx ?? pos, ny = M.ny ?? pos;
  return { type: 'searchlight-sentry', d, mode: 'sweep', nx, ny, tag: o.tag,
    sweep: { aim: M.aim, swing: o.swing ?? 30, wave: (o.bars ?? 2) * BAR * speedAt(d), arrive: M.aim + arrive, dir: o.dir ?? 1 },
    wave: o.wave || WAVES.II };
}
// metres of clear dark between the point (nx, ny) and a sweeper's catch zone where it reaches the ship, worst case
// over both screen shapes (negative: in the light)
function clearOf(ev, nx, ny) {
  let worst = 1e9;
  for (const B of BOXES) {
    const bx = ev.nx * B.x, by = ev.ny * B.y, ux = -Math.sign(Math.abs(ev.nx) > 1 ? ev.nx : 0), uy = -Math.sign(Math.abs(ev.nx) > 1 ? 0 : ev.ny);
    const lx = bx + ux * LAMP_IN, ly = by + uy * LAMP_IN, [dx, dy] = beamDir(ev.sweep, 0, B), len = reach(lx, ly, dx, dy, B);
    const px = nx * B.x - lx, py = ny * B.y - ly, along = px * dx + py * dy;
    if (along < 0) continue;
    const perp = Math.abs(-dy * px + dx * py), r = beamR(along, len) * CATCH_K + SHIP_CORE;
    worst = Math.min(worst, perp - r);
  }
  return worst;
}
function clearOfSpar(ev, nx, ny) {
  let worst = 1e9; const a = ev.a * Math.PI / 180;
  for (const B of BOXES) worst = Math.min(worst, Math.abs(-Math.sin(a) * (nx * B.x - ev.nx * B.x) + Math.cos(a) * (ny * B.y - ev.ny * B.y)) - (0.7 + 0.72 * 0.8));
  return worst;
}
// a point in the light of a sweeper where it reaches the ship (the greedy line ends there), nearest to `want`
function lightSpot(h, want) {
  let best = null, bd = 1e9;
  for (let ix = -8; ix <= 8; ix++) for (let iy = -8; iy <= 8; iy++) {
    const nx = ix / 10, ny = iy / 10;
    if (clearOf(h, nx, ny) > -0.9) continue;
    const dd = Math.hypot(nx - want[0], ny - want[1]);
    if (dd < bd) { bd = dd; best = [nx, ny]; }
  }
  return best;
}
// the dark point nearest to `want` that is clear of every hazard listed (by at least `margin` metres)
function darkSpot(hz, want, margin = 1.3) {
  let best = null, bd = 1e9;
  for (let ix = -8; ix <= 8; ix++) for (let iy = -8; iy <= 8; iy++) {
    const nx = ix / 10, ny = iy / 10;
    let ok = true;
    for (const h of hz) { const c = h.type === 'l8-spar' ? clearOfSpar(h, nx, ny) : clearOf(h, nx, ny); if (c < margin) { ok = false; break; } }
    if (!ok) continue;
    const dd = Math.hypot(nx - want[0], (ny - want[1]) * 1.4);
    if (dd < bd) { bd = dd; best = [nx, ny]; }
  }
  if (!best) throw new Error('level 8: no dark spot at ' + hz[0].d);
  return best;
}

const look = (sky, fog, hemiSky, hemiGround, sun, gas, cloud, clouds, seed) => ({ sky, fog, hemiSky, hemiGround, sun, band: 0.5, gas, cloud, clouds, seed });

export default defineLevel({
  n: 8, id: 'graveyard', name: 'GRAVEYARD OF GIANTS',
  idea: 'Searchlights call the dead fleet\'s defence wave down on whatever they catch.',
  seed: 808,
  length: END,
  speed: speedAt,
  music: { track: 'levels/level8/music' },
  sfx: [{ id: 'searchlight-alarm', gain: 0.25 }],   // the manifest's suggested gain
  mausoleumD: D(73),
  sections: [
    { id: 'dead', name: 'THE OUTER DEAD', sub: 'SECTOR 1', d0: 0, d1: D(25), look: 'dead',
      scenery: { 'l8-hull-drift': 1, 'l8-rib-drift': 0.6, 'l8-debris-field': 0.7, 'l8-ash': 1, 'l8-mausoleum': 1 } },
    { id: 'picket', name: 'THE PICKET LINE', sub: 'SECTOR 2', d0: D(25), d1: D(49), look: 'picket',
      scenery: { 'l8-hull-drift': 1, 'l8-rib-drift': 0.4, 'l8-debris-field': 1, 'l8-ash': 1, 'l8-mausoleum': 1 } },
    { id: 'water', name: 'DEAD WATER', sub: 'SECTOR 3', d0: D(49), d1: D(57), look: 'water',
      scenery: { 'l8-hull-drift': 0.7, 'l8-rib-arches': 1, 'l8-rib-drift': 0.5, 'l8-debris-field': 0.4, 'l8-ash': 1, 'l8-mausoleum': 1 } },
    { id: 'watch', name: 'THE WATCHTOWERS', sub: 'SECTOR 4', d0: D(57), d1: D(73), look: 'watch',
      scenery: { 'l8-hull-drift': (t) => (t < 0.62 ? 1 : 0), 'l8-rib-drift': (t) => (t < 0.62 ? 0.5 : 0), 'l8-debris-field': (t) => (t < 0.7 ? 1 : 0.2), 'l8-ash': 1, 'l8-mausoleum': (t) => 1 - Math.min(1, Math.max(0, (t - 0.72) / 0.2)),
        'l8-tomb-ribs': (t) => (t > 0.76 ? 1 : 0), 'l8-tomb-plating': (t) => (t > 0.76 ? 1 : 0) } },
    { id: 'tomb', name: 'THE MAUSOLEUM', sub: 'SECTOR 5', d0: D(73), d1: D(83), look: 'tomb',
      scenery: { 'l8-tomb-ribs': (t) => (t < 0.7 ? 1 : 0), 'l8-tomb-plating': (t) => (t < 0.7 ? 1 : 0), 'l8-ash': 1, 'l8-hull-drift': (t) => (t > 0.7 ? 1 : 0), 'l8-rib-drift': (t) => (t > 0.7 ? 1 : 0) } },
    { id: 'out', name: 'PAST THE BOW', sub: 'FINAL STRETCH', d0: D(83), d1: END, look: 'out',
      scenery: { 'l8-hull-drift': 0.8, 'l8-rib-drift': 1, 'l8-debris-field': 0.3, 'l8-ash': 0.6 } },
  ],
  // Yori's level 8 palette: sky 07080a, gas 3a3f48 / 4a2a1a / 5a5a30, fog 15171c, key 9aa0b0, fill 2a2420.
  // The searchlights are the only bright thing; no look uses red, amber or cyan. Cloud thickness stays at or under
  // 0.2 (0.15 at the top speed): the backdrop fades a passing cloud over 40 m, and thicker clouds at these speeds
  // step more than 5 % in a frame whenever a frame runs long (ruling 5's fade test).
  looks: {
    dead: look(['#07080a', 'rgba(58,63,72,A)', 'rgba(74,42,26,A)', 'rgba(90,90,48,A)'], 0x15171c, 0x9aa0b0, 0x2a2420, 0xa8aebc, 0.6, 0x3a3f48, 0.2, 801),
    picket: look(['#08080a', 'rgba(74,42,26,A)', 'rgba(58,63,72,A)', 'rgba(90,72,44,A)'], 0x17151a, 0xa09890, 0x2a1e18, 0xb0a898, 0.65, 0x4a2a1a, 0.2, 802),
    water: look(['#060708', 'rgba(90,90,48,A)', 'rgba(58,63,72,A)', 'rgba(44,44,32,A)'], 0x121410, 0x8a9080, 0x201e18, 0x9aa090, 0.5, 0x5a5a30, 0.18, 803),
    watch: look(['#050608', 'rgba(58,63,72,A)', 'rgba(32,36,46,A)', 'rgba(74,42,26,A)'], 0x101216, 0x8a92a8, 0x1a1814, 0x9aa0b0, 0.55, 0x2a2e38, 0.18, 804),
    tomb: look(['#040405', 'rgba(44,38,34,A)', 'rgba(30,30,36,A)', 'rgba(56,34,22,A)'], 0x0c0d10, 0x7a8090, 0x1e1a16, 0x8a90a0, 0.35, 0x22242a, 0.1, 805),
    out: look(['#090a0e', 'rgba(90,96,110,A)', 'rgba(74,42,26,A)', 'rgba(110,110,70,A)'], 0x1c1e24, 0xc0c6d4, 0x2a2420, 0xd8dce8, 0.75, 0x5a6070, 0.15, 806),
  },
  kinds: [ring, pod, shrike, sentry, spar, ghost, hull, rib, debris, tombPlate],
  scenery: [hullDrift, ribDrift, ribArches, debrisField, tombRibs, tombPlating, ash, mausoleum],
  // rule 1: the beat sheet, on the track's bar lines (metres)
  beats: [
    { d: 0, tag: 'calm', what: 'bars 1-8: the outer dead. Wrecks, ash, rings in the open; nothing that can hurt' },
    { d: D(9), tag: 'rising', what: 'bar 9 (groove): the first searchlight, alone and slow; the rings show the dark' },
    { d: D(14), tag: 'rising', what: 'bar 14: the first broken spar, alone' },
    { d: D(18), tag: 'rising', what: 'bars 18-22: a lamp every bar or two, from every side' },
    { d: D(25), tag: 'calm', what: 'bar 25: speed step. The picket line opens quietly' },
    { d: D(29), tag: 'rising', what: 'bar 29: lamps in pairs, beams crossing' },
    { d: D(33), tag: 'peak', what: 'bars 33-40 (drop one): a lamp every bar, spars between, the greedy ring line through the light' },
    { d: D(41), tag: 'calm', what: 'bars 41-43: rings only' },
    { d: D(44), tag: 'peak', what: 'bars 44-47: crossing pairs and spars' },
    { d: D(49), tag: 'calm', what: 'bars 49-56 (breakdown): dead water. Ribs over the lane, the Mausoleum fills the sky' },
    { d: D(57), tag: 'rising', what: 'bar 57: speed step. Bar 59: the first hunter, alone: keep moving' },
    { d: D(62), tag: 'rising', what: 'bars 62-64: a faster hunter and a sweeper together' },
    { d: D(65), tag: 'peak', what: 'bars 65-68 (drop two): two hunters from opposite corners, sweepers, spars. The hardest stretch' },
    { d: D(69), tag: 'calm', what: 'bars 69-72: the lead-in. Rings into the Mausoleum\'s torn stern' },
    { d: D(73), tag: 'rising', what: 'bar 73: speed step, inside the Mausoleum. Bars 74-76: the first ripple of lamps down its wall' },
    { d: D(77), tag: 'rising', what: 'bars 77-80: the mastery test, two hunters in the hull and a sweeper, gentler than act 3' },
    { d: D(81), tag: 'rising', what: 'bars 81-82: the second ripple, roof and floor in turn' },
    { d: D(83), tag: 'calm', what: "bars 83-84 (the drive): out past the bow, the lights behind you; rings home to the finish on bar 85, at the take's loop end" },
  ],
  acts: { introduce: [0, D(25)], develop: [D(25), D(57)], twist: [D(57), D(73)], master: [D(73), END] },
  build(R, L) {
    const { add, ring: oneRing, line, sine } = L;
    const H = [];                                          // every hazard the rings must thread, in course order
    const put = (ev) => { H.push(ev); return ev; };
    const sw = (bar, m, pos, arrive, o) => put(sweeper(D(bar), m, pos, arrive, o));
    const sp = (bar, nx, ny, a) => put({ type: 'l8-spar', d: D(bar), nx, ny, a });
    const hunt = (bar, nx, slew, from, o = {}) => {        // its pool appears on bar `bar` (520 m before the tower arrives)
      const ev = { type: 'searchlight-sentry', d: D(bar) + 520, mode: 'hunt', nx, ny: 1.5, hunt: { slew, from }, wave: o.wave || WAVES.III, tag: o.tag };
      add(ev.d, ev.type, ev); return ev;
    };

    // ===================== ACT 1: THE OUTER DEAD (bars 1-24) =====================
    // the first rings sit 330 m out: anything closer is born in plain view when the run starts (ruling 5)
    line(330, -0.5, -0.1, 0.5, 0.15, 5, 28);
    line(D(4), 0.6, 0.3, -0.3, -0.3, 5, 28);
    add(D(5), 'call', { text: 'STAY OUT OF THE LIGHT', cls: 'c-mag' });
    sw(9, 'L', 0.15, 18, { swing: 22, bars: 4, wave: WAVES.I, tag: 'I' });
    sw(12, 'B', -0.35, -20, { swing: 28, bars: 4, wave: WAVES.I, tag: 'I' });
    sp(14, 0, 0.45, 6);
    sw(16, 'R', -0.3, 12, { swing: 30, bars: 3, wave: WAVES.Ib, tag: 'I' });
    sw(18, 'T', 0.4, -15, { bars: 2, wave: WAVES.Ib, tag: 'I' });
    sp(19, 0.1, -0.35, -20);
    sw(20, 'L', -0.5, 25, { bars: 2, wave: WAVES.Ib, tag: 'I' });
    sw(21, 'R', 0.5, -20, { bars: 2, wave: WAVES.Ib, tag: 'I' });
    sp(23, -0.2, 0.2, 35);
    add(D(25) - 30, 'l8-ghost', { tag: 'I', sub: 'SECTOR 1' });

    // ===================== ACT 2: THE PICKET LINE (bars 25-48) =====================
    sw(27, 'B', 0.3, 15, { tag: 'II' });
    sw(29, 'L', 0.35, -18, { tag: 'II' }); sw(29, 'R', -0.35, 22, { tag: 'II' });
    sw(31, 'T', -0.4, 20, { tag: 'II' }); sw(31, 'B', 0.4, 25, { tag: 'II' });
    // drop one: a lamp every bar, spars between
    sw(33, 'L', -0.2, 10, { tag: 'II', wave: WAVES.IIp });
    // the greedy line (rule 31): bar 34's rings lead INTO its light. Follow them and it calls its wave (more to
    // deflect, more to score); skip them and the chain steps down
    Object.assign(sw(34, 'B', -0.5, -12, { tag: 'II' }), { greedy: true });
    sw(35, 'R', 0.25, -25, { tag: 'II', wave: WAVES.IIp }); sp(35.5, 0, -0.4, 12);
    sw(36, 'T', 0.5, 20, { tag: 'II' });
    sw(37, 'L', 0.4, -22, { tag: 'II' }); sw(37, 'R', 0.4, 22, { tag: 'II' });
    sp(38, 0.2, 0.3, -30);
    sw(39, 'T', -0.3, -18, { tag: 'II', wave: WAVES.IIp }); sw(39, 'B', 0.3, 18, { tag: 'II' });
    sw(40, 'L', 0, 0, { tag: 'II' });
    for (const b of [35, 38]) add(D(b) + 40, 'pod', { nx: R.range(-0.6, 0.6), ny: R.range(0.2, 0.7), drift: R.range(-1.5, 1.5), bursts: 2, shots: 2 });
    // bars 41-43: rings only (see below); then the second peak
    sw(44, 'L', -0.3, 20, { tag: 'II' }); sw(44, 'B', -0.4, -20, { tag: 'II' });
    sp(45, -0.1, 0.1, 50); sw(45.5, 'R', 0, 15, { tag: 'II', wave: WAVES.IIp });
    sw(46.5, 'T', 0.35, -10, { tag: 'II' }); sw(46.5, 'L', 0.3, -25, { tag: 'II' });
    add(D(47), 'shrike', { side: 1, ny: 0.5, shots: 3 }); add(D(47) + 1, 'shrike', { side: -1, ny: -0.4, shots: 3 });
    add(D(49) - 30, 'l8-ghost', { tag: 'II', sub: 'SECTOR 2' });

    // ===================== ACT 3: THE WATCHTOWERS (bars 57-72) =====================
    add(D(59) - 40, 'call', { text: 'THE LIGHT HUNTS: KEEP MOVING', cls: 'c-mag' });
    hunt(59, 0.0, 3.0, [0.9, 0.85], { tag: 'III', wave: { shrikes: 1, shots: 2 } });
    hunt(62, -0.4, 3.8, [-0.9, -0.85], { tag: 'III' });
    sw(63.5, 'R', -0.3, 18, { tag: 'III', wave: WAVES.III });
    hunt(65, 0.5, 4.2, [-0.9, 0.85], { tag: 'III', wave: WAVES.IIIp });
    hunt(66, -0.5, 4.2, [0.9, -0.85], { tag: 'III', wave: WAVES.IIIp });
    add(D(65) + 60, 'pod', { nx: 0.5, ny: 0.6, drift: -1.2, bursts: 2, shots: 2 });
    sp(67.5, 0, 0.3, -15);
    sw(68, 'L', -0.4, 15, { tag: 'III', wave: WAVES.III }); sw(68, 'B', 0.45, -15, { tag: 'III', wave: WAVES.III });
    add(D(73) - 30, 'l8-ghost', { tag: 'III', sub: 'SECTOR 4' });

    // ===================== ACT 4: THE MAUSOLEUM (bars 73-88) =====================
    // the first ripple: four lamps down the left wall, half a bar apart, their beams stepping down the lane
    [30, 12, -8, -26].forEach((a, i) => sw(74 + i * 0.5, 'L', -0.15, a, { tag: 'IV', wave: WAVES.IV, swing: 30 }));
    hunt(77, 0.3, 3.6, [-0.9, -0.85], { tag: 'IV', wave: WAVES.IV });
    sw(79, 'R', 0.2, 12, { tag: 'IV', wave: WAVES.IV });
    hunt(78.5, -0.3, 3.6, [0.9, 0.85], { tag: 'IV', wave: WAVES.IV });
    // the second ripple: roof and floor in turn, the dark slaloming
    [['T', 0.45, -20], ['B', -0.45, 20], ['T', -0.2, 25], ['B', 0.2, -25]].forEach(([m, p, a], i) => sw(80.5 + i * 0.5, m, p, a, { tag: 'IV', wave: WAVES.IV }));
    add(D(83) - 20, 'l8-ghost', { tag: 'IV', sub: 'SECTOR 5' });

    // ---- lay every hazard, and thread the rings through the dark: four rings into each hazard's dark spot
    H.sort((a, b) => a.d - b.d);
    const groups = [];
    for (const h of H) { const g = groups[groups.length - 1]; if (g && Math.abs(g[0].d - h.d) < 4) g.push(h); else groups.push([h]); }
    let cur = [0, -0.2], lastD = -1e9;
    for (const g of groups) {
      for (const h of g) { const ev = Object.assign({}, h); delete ev.type; add(h.d, h.type, ev); }
      const want = g[0].ring || [cur[0] + R.range(-0.35, 0.35), cur[1] + R.range(-0.3, 0.3)];
      const spot = (g[0].greedy && lightSpot(g[0], want)) || darkSpot(g, want);
      const step = 24, n = Math.max(1, Math.min(4, Math.floor((g[0].d - lastD - 30) / step)));
      line(g[0].d - (n - 1) * step, cur[0] + (spot[0] - cur[0]) / n, cur[1] + (spot[1] - cur[1]) / n, spot[0], spot[1], n, step);
      cur = spot; lastD = g[0].d;
    }
    // ---- rings in the quiet stretches
    sine(D(41) + 20, 10, 30, 0.55, 0.45);                  // the breather in the picket line
    // dead water: a long corkscrew under the arches
    sine(D(49) + 60, 22, 34, 0.6, 0.5);
    sine(D(54), 8, 34, 0.35, 0.3, Math.PI);
    // the hunts: keep moving. Wide, quick circles while each pool is out
    sine(D(59), 12, 38, 0.78, 0.7);
    sine(D(62), 12, 38, 0.78, 0.7, Math.PI / 2);
    sine(D(65), 14, 36, 0.8, 0.72, Math.PI);
    sine(D(69), 10, 32, 0.4, 0.3);                         // the lead-in to the stern
    sine(D(77), 14, 40, 0.8, 0.72, Math.PI / 3);
    // past the bow: the corkscrew home
    sine(D(83) + 30, 12, 34, 0.55, 0.5);

    // ---- one pass over every ring: none in the light or on a spar where it meets the ship (except the greedy
    // line's), none on top of another
    const isRing = (e) => e.type === 'ring';
    const ringsAt = L.events.filter(isRing).sort((a, b) => a.d - b.d);
    const drop = new Set();
    let prev = null;
    for (const r of ringsAt) {
      if (prev && r.d - prev.d < 9) { drop.add(r); continue; }
      for (const h of H) {
        if (Math.abs(h.d - r.d) > 7 || h.greedy) continue;
        const c = h.type === 'l8-spar' ? clearOfSpar(h, r.nx, r.ny) : clearOf(h, r.nx, r.ny);
        if (c < 0.4) { drop.add(r); break; }
      }
      if (!drop.has(r)) prev = r;
    }
    for (let i = L.events.length - 1; i >= 0; i--) if (drop.has(L.events[i])) L.events.splice(i, 1);
    L.dropped = drop.size;
  },
});
