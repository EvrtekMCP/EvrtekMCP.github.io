// LEVEL 7 (played 5th since 11-08): NEON ORBITAL. An orbital city at night; you join its traffic. One idea: weave through the freighter
// lanes. Freighters run in a lane of three columns and two decks, slower than you, so you overtake them through
// whichever cell is open (act 1); denser, faster, and some change lanes with a red strobe first (act 2); then the
// lanes CROSS your route, freighters sliding across it, pink going left and teal going right (act 3); and a last
// run of everything at speed, into the Spindle's tunnel, ring after ring, and out into the open (act 4).
// Its enemy is the SWARM (js/enemies/swarm-unit): chains of kites that copy your path and fire down it in turn.
//
// The course is laid on the level's music: 142 bpm (CLU (S)'s plan for this track, tools/sound/tracks.js `l7`), its
// arrangement Intro 8 bars, Groove 16, Build 8, Drop 16, Breakdown 8, Build 8, Drop 16, Drive 8. Speed steps and
// the set piece sit on bar lines (rule 30): the speed is a function of time stepped on bars, integrated once into
// distance, so B(bar) is where bar `bar` starts on the course at the nominal speed.
import { defineLevel, clamp, smooth } from '../api.js?v=0.4.1';
import ring from '../pickups/ring/index.js?v=0.4.1';
import swarm from '../enemies/swarm-unit/index.js?v=0.4.1';
import { freighter, COL_X, DECK_Y } from './level7/traffic.js?v=0.4.1';
import { tower, sign, tunnelRing, blast, towers, signs, traffic, trafficHigh, lanes, spindle, zones } from './level7/scenery.js?v=0.4.1';

// ---------------------------------------------------------------- the music's clock, and the speed on it
const BPM = 142.017, FIRST = 0.0996, BAR = 240 / BPM;   // l7 take 1's measured grid (audio-src/music-takes-levels.json)
const STEPS = [[1, 92], [9, 98], [33, 114], [57, 124], [65, 138], [81, 152], [85, 172]]; // [bar, m/s], reached ON the bar
const tOfBar = (b) => FIRST + (b - 1) * BAR;
function vAt(t) {
  let v = STEPS[0][1];
  for (let i = 1; i < STEPS.length; i++) { const t1 = tOfBar(STEPS[i][0]), t0 = t1 - BAR * 0.5; v += (STEPS[i][1] - v) * smooth(clamp((t - t0) / (t1 - t0), 0, 1)); }
  return v;
}
const DT = 0.02, TAB = [0];
for (let i = 0; i < 12000; i++) TAB.push(TAB[i] + vAt((i + 0.5) * DT) * DT);
const dOfT = (t) => { const i = clamp(Math.floor(t / DT), 0, TAB.length - 2), f = t / DT - i; return TAB[i] + (TAB[i + 1] - TAB[i]) * f; };
function tOfD(d) { let lo = 0, hi = TAB.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TAB[m] <= d) lo = m; else hi = m; } return (lo + (d - TAB[lo]) / Math.max(1e-6, TAB[lo + 1] - TAB[lo])) * DT; }
export const B = (bar) => Math.round(dOfT(tOfBar(bar)));
const LENGTH = B(89);

// ---------------------------------------------------------------- the lane grid
const R_FLOW = 0.12; // every flow freighter in the lane runs at 0.12 of your speed: none overtakes another, and a ring
                     // in its cell is only ever seen inside its hull if within 60 m of where it meets you
const SPAWN = 800;
// a cell: 'T0'..'T2' top deck left to right, 'B0'..'B2' bottom deck
const cellXY = (c) => [COL_X[+c[1]], DECK_Y[c[0] === 'T' ? 1 : 0]];

export default defineLevel({
  n: 5, id: 'orbital', name: 'NEON ORBITAL', // played FIFTH since Evrtek's swap (11-08); its file stays level7.js
  idea: 'Weave through the freighter traffic of an orbital city.',
  seed: 7007,
  length: LENGTH,
  speed: (d) => vAt(tOfD(d)),
  music: { track: 'levels/level7/music' }, // CLU (S)'s take l7-t1: 142.017 bpm, first beat 0.0996 s (its .json)
  sections: [
    { id: 'lanes', name: 'THE NIGHT LANES', sub: 'SECTOR 1', d0: 0, d1: B(33), look: 'night',
      scenery: { 'l7-towers': 1, 'l7-signs': 0.7, 'l7-traffic': 1, 'l7-lanes': 1, 'l7-spindle': 0.8 } },
    { id: 'rush', name: 'FREIGHT RUSH', sub: 'SECTOR 2', d0: B(33), d1: B(49), look: 'night',
      scenery: { 'l7-towers': 1, 'l7-signs': 1, 'l7-traffic': 1, 'l7-lanes': 1, 'l7-spindle': 0.9 } },
    { id: 'overlook', name: 'THE OVERLOOK', sub: 'SECTOR 3', d0: B(49), d1: B(57), look: 'overlook',
      scenery: { 'l7-towers': 0.6, 'l7-signs': 1, 'l7-traffic-high': 1, 'l7-lanes': 0.7, 'l7-spindle': 1 } },
    { id: 'interchange', name: 'THE INTERCHANGE', sub: 'SECTOR 4', d0: B(57), d1: B(73), look: 'interchange',
      scenery: { 'l7-towers': 1, 'l7-signs': 0.8, 'l7-traffic-high': 1, 'l7-lanes': 1, 'l7-spindle': 1 } },
    { id: 'spindle', name: 'THE SPINDLE', sub: 'FINAL STRETCH', d0: B(73), d1: B(81), look: 'spindle',
      scenery: { 'l7-towers': 1, 'l7-signs': 1, 'l7-traffic-high': 1, 'l7-lanes': 1, 'l7-spindle': 1 } },
    { id: 'tunnel', name: 'THE SPINDLE', sub: 'THE TUNNEL', banner: false, d0: B(81), d1: B(85), look: 'spindle',
      // towers through the ring gaps early on, none at the far end: what you see at the blast-out was born 800 m before it
      scenery: { 'l7-towers': (t) => (t < 0.2 ? 0.55 : 0), 'l7-lanes': 0, 'l7-spindle': 0 } },
    { id: 'open', name: 'THE SPINDLE', sub: 'BLAST OUT', banner: false, d0: B(85), d1: LENGTH, look: 'open',
      scenery: { 'l7-towers': 0.22, 'l7-traffic': 1, 'l7-lanes': 0.5, 'l7-spindle': 0 } },
  ],
  // Yori's palette for level 7: sky #0b0614, gas #ff2fa0 #7a2aff #1fe0d0, fog #1a0a2a, key #ff9ad0, fill #20c0b0.
  // Pink and teal, never cyan; no large flat red or amber anywhere (rule 9).
  looks: {
    night: { sky: ['#0b0614', 'rgba(255,47,160,A)', 'rgba(122,42,255,A)', 'rgba(31,224,208,A)'], fog: 0x1a0a2a, hemiSky: 0xff9ad0, hemiGround: 0x20c0b0, sun: 0xffd8ec, band: 0.5, gas: 0.55, cloud: 0x7a2aff, clouds: 0.12, seed: 701 },
    overlook: { sky: ['#100822', 'rgba(255,47,160,A)', 'rgba(122,42,255,A)', 'rgba(255,154,208,A)'], fog: 0x24103a, hemiSky: 0xffb0dc, hemiGround: 0x30a0b0, sun: 0xffe8f4, band: 0.42, gas: 0.6, cloud: 0xff2fa0, clouds: 0.14, seed: 702 },
    interchange: { sky: ['#070a14', 'rgba(31,224,208,A)', 'rgba(122,42,255,A)', 'rgba(255,47,160,A)'], fog: 0x0e1426, hemiSky: 0xffa0d8, hemiGround: 0x20c0b0, sun: 0xe0fff8, band: 0.55, gas: 0.6, cloud: 0x2a8070, clouds: 0.12, seed: 703 },
    spindle: { sky: ['#08030f', 'rgba(255,47,160,A)', 'rgba(90,30,200,A)', 'rgba(31,224,208,A)'], fog: 0x1c0822, hemiSky: 0xff8ac8, hemiGround: 0x188c84, sun: 0xffd0e8, band: 0.5, gas: 0.5, cloud: 0x5a1aa0, clouds: 0.08, seed: 704 },
    open: { sky: ['#160830', 'rgba(255,79,200,A)', 'rgba(122,42,255,A)', 'rgba(31,224,208,A)'], fog: 0x2a0e40, hemiSky: 0xffc0e4, hemiGround: 0x30c8b8, sun: 0xffffff, band: 0.46, gas: 0.95, cloud: 0xff4fc8, clouds: 0.3, seed: 705 },
  },
  kinds: [ring, freighter, swarm, tower, sign, tunnelRing, blast],
  scenery: [traffic, trafficHigh, towers, signs, lanes, spindle], // traffic first: it marks the cross streets the towers keep clear of
  // rule 1: the beat sheet (calm / rising / peak), in metres; the bars are the music's
  beats: [
    { d: 0, tag: 'calm', what: 'bars 1-4: the night lanes, rings in the open, traffic in the outer lanes only' },
    { d: B(5), tag: 'calm', what: 'bars 5-8: the first freighters in the lane, alone, the open cell marked by rings' },
    { d: B(9), tag: 'rising', what: 'bars 9-16: one freighter at a time in changing cells; a long one with a ring line along its roof' },
    { d: B(17.5), tag: 'rising', what: 'bars 17-24: walls of three, three cells open' },
    { d: B(24.5), tag: 'calm', what: 'bar 25: the first swarm, alone, its volley aimed wide (a graze; a roll sends it all back)' },
    { d: B(29), tag: 'rising', what: 'bar 29: a second swarm, aimed true' },
    { d: B(33), tag: 'rising', what: 'bar 33, the drop: faster; light traffic, then denser' },
    { d: B(37.5), tag: 'rising', what: 'bar 37: a lane change, alone: its side strobes red, it slides, and the rings are behind where it was' },
    { d: B(41), tag: 'peak', what: 'bars 41-48: walls with lane changes; a two-volley swarm in light traffic' },
    { d: B(49), tag: 'calm', what: 'bars 49-56, the breakdown: the Overlook, no hazards, a long corkscrew of rings' },
    { d: B(57), tag: 'rising', what: 'bar 57: faster; the lanes cross the route, one freighter at a time, safe if you hold still' },
    { d: B(63.5), tag: 'rising', what: 'bars 63-68: crossing streets with a gap, faster again at bar 65' },
    { d: B(69), tag: 'peak', what: 'bars 69-72: both decks crossing, flow walls and a swarm of seven: the hardest stretch' },
    { d: B(73), tag: 'rising', what: 'bars 73-78: the mastery run, one of everything per bar' },
    { d: B(79), tag: 'calm', what: 'bars 79-80: calm; the tunnel mouth lines up' },
    { d: B(81), tag: 'rising', what: 'bars 81-84: the set piece, the Spindle tunnel, ring after ring, faster, a few freighters to weave' },
    { d: B(85), tag: 'calm', what: 'bar 85: BLAST OUT into the open at top speed, a corkscrew of rings to the line' },
  ],
  // rule 19: introduce (traffic, the swarm), develop (denser, lane changes), twist (the lanes cross), master
  acts: { introduce: [0, B(33)], develop: [B(33), B(57)], twist: [B(57), B(73)], master: [B(73), LENGTH] },

  // 0.4.0, the galaxy 1 retrofit (the plan's 6.5; nothing else in the level moves, no ring is added or moved):
  // NEON ORBITAL: Overclock 1.8 s before Freight Rush's first long swarm volley; the Shield Cell behind a risk, in the gap between two crossing freighters.
  powerups: [[7298, 'overclock', -0.67, 0.5], [11186, 'shield-cell', 0, 0]],
  build(R, L) {
    const { add, ring: one, line, sine } = L;
    // ---- authoring helpers
    // A flow freighter whose tail meets you at bar `bar` in a cell. It closes at (1 - R_FLOW) of your speed, so it is
    // born earlier on the course than where it meets you.
    const flow = (bar, cell, o = {}) => {
      const dPass = B(bar), [nx, ny] = cellXY(cell);
      const ev = add(dPass - SPAWN / (1 - R_FLOW) + SPAWN, 'l7-freighter', Object.assign({ mode: 'flow', nx, ny, r: R_FLOW, tint: R.int(0, 6), pass: dPass, cell }, o));
      if (o.lc) { ev.lcTo = o.lc; ev.lc = cellXY(o.lc)[0]; }
      return ev;
    };
    // a wall: 'TTT/BBB', top deck then bottom, X a freighter: 'X.X/.X.'
    const wall = (bar, map, each) => { const [t, b] = map.split('/'); for (let i = 0; i < 3; i++) { if (t[i] === 'X') flow(bar, 'T' + i, each); if (b[i] === 'X') flow(bar, 'B' + i, each); } };
    // A crossing freighter: its near face meets you at bar `bar` with its middle at nx0 then, sliding dir (+1 right,
    // teal; -1 left, pink). It never moves in depth, so rings sit before and after it, never at it.
    const cross = (bar, ny, nx0, dir, o = {}) => add(B(bar), 'l7-freighter', Object.assign({ mode: 'cross', nx: nx0, ny, dir, k: 0.75, len: 1, tint: R.int(0, 6), pass: B(bar) }, o));
    const swarmAt = (bar, o) => add(B(bar), 'swarm-unit', o);
    // The ring trail: through each wall's open cell (20 m before its tails, at them, and 18 m into the pass, framed by
    // the freighters), with one ring halfway to the next. Slow traffic and rings never share a cell within 60 m
    // before a freighter meets you, so no ring is ever seen inside a hull (the course lint checks it).
    let last = null;
    const pos = (p) => (typeof p === 'string' ? cellXY(p) : p);
    const trail = (d, p, opts = {}) => {
      const [x, y] = pos(p), at = opts.at || [-20, 0, 18];
      if (last && opts.mid !== false && d + at[0] - last.d > 90) { const m = (last.d + d + at[0]) / 2; one(m, (last.x + x) / 2, (last.y + y) / 2); }
      for (const dd of at) one(d + dd, x, y + (opts.dy || 0));
      last = { d: d + at[at.length - 1], x, y };
    };
    const gate = (bar, map, cell, opts = {}) => { wall(bar, map, opts.each); trail(B(bar), cell, opts); };
    const free = (d, x, y) => { last = { d, x, y }; };

    // ================= ACT 1: INTRODUCE (bars 1-32): the lane, its cells, and the swarm =================
    line(B(1.6), 0, 0.25, 0, 0, 5, 26);
    sine(B(3), 7, 24, 0.4, 0.3);
    free(B(4.4), 0, 0);
    // bar 5: the first freighter, alone, low on the left. Holding still is safe; the rings pass right beside it.
    gate(5, '.../X..', 'B1');
    // bar 7: low in the centre: the rings show the open deck above it
    gate(7, '.../.X.', 'T1');
    // bars 8-16: one cell at a time, then two; then a long one with rings riding low over its roof (rule 31)
    gate(8.5, '..X/...', 'B0');
    gate(10, '.X./...', 'B1');
    gate(11.5, 'X../X..', 'T2');
    gate(13, '.../.XX', 'T1');
    gate(14.5, '..X/.XX', 'B0');
    gate(16, '.../.X.', 'T1', { each: { len: 1.8 }, at: [-20, 0, 16, 32, 48], dy: -0.16 });
    // bars 17.5-23: walls of three, three cells open
    gate(17.5, 'X.X/.X.', 'T1');
    gate(18.6, 'XX./..X', 'B0');
    gate(19.7, '.XX/X..', 'B1');
    gate(20.8, 'X../.XX', 'T1');
    gate(21.9, '.X./X.X', 'B1');
    gate(23, 'X.X/X.X', 'T1');
    // bars 25-28: the first swarm, alone, its volley aimed wide (do nothing: a graze; roll: it all comes back).
    // The rings hold you on one straight line so the chain lines up behind it.
    swarmAt(25, { n: 5, tel: 1.3, volleys: 1, aim: 'graze', side: 1, hold: 0.9 });
    line(B(24.2), 0, 0.5, 0, 0, 4, 30); line(B(25.4), 0, 0, 0, 0, 8, 32);
    // bars 29-32: a second swarm, aimed true; then the lane fills again, gently, before the drop
    swarmAt(29, { n: 5, tel: 1.15, volleys: 1, aim: 'ship', side: -1, hold: 0.7 });
    sine(B(29.2), 10, 28, 0.35, 0.3);
    free(B(31.2), 0, 0);
    gate(32, '.X./...', 'B0');

    // ================= ACT 2: DEVELOP (bars 33-56): denser, faster, and lane changes =================
    // bar 33 is the drop and the speed step: the next walls are light (rule 6), then they thicken
    gate(34, '..X/...', 'B1');
    gate(35, '.../X..', 'T1');
    gate(36, 'X../X..', 'B2', { at: [-20, 0, 18, 50, 80] });
    // bar 37.5: a lane change, alone. Low in the centre a freighter strobes red on its right for a second, then slides
    // into the right lane, the one you are in. The rings go on in the lane it left, behind it.
    flow(37.5, 'B1', { lc: 'B2' });
    for (const dd of [22, 42, 62]) one(B(37.5) + dd, 0, -0.5);
    free(B(37.5) + 62, 0, -0.5);
    gate(38.75, '.X./X..', 'B2');
    // bars 40-48: walls with lane changes in them
    gate(40, 'X../..X', 'B1'); flow(40, 'T1', { lc: 'T2' });
    gate(41.25, '.XX/X..', 'T0');
    gate(42.5, 'X../...', 'T2'); flow(42.5, 'B2', { lc: 'B1', lcAt: 2.6 });
    gate(43.75, '..X/XX.', 'T0');
    // bar 45: a swarm with two volleys over light traffic in the outer columns; the rings hold the middle
    swarmAt(44.8, { n: 6, tel: 0.95, volleys: 2, aim: 'ship', side: 1, hold: 0.6 });
    gate(45.75, 'X../..X', [0, 0.1], { at: [-40, -20, 0, 18, 36] });
    gate(47, '..X/X..', [0, 0], { at: [-30, -10, 10, 30] });
    gate(48.25, '.X./.X.', 'B2', { each: { len: 1.4 } });

    // ================= THE OVERLOOK (bars 49-56): the breather =================
    sine(B(49.6), 14, 30, 0.55, 0.42);
    sine(B(53.4), 12, 28, 0.3, 0.25, Math.PI);
    // a liner, close alongside in the outer lane: the biggest thing in the traffic
    add(B(50.5) - SPAWN / 0.8 + SPAWN, 'l7-freighter', { mode: 'flow', nx: 1.9, ny: 0.15, r: 0.2, len: 3.4, decor: true, tint: 2 });
    free(B(56), 0, 0);

    // ================= ACT 3: TWIST (bars 57-72): the lanes cross the route =================
    // One at a time first. High and going left (pink): safe if you hold the middle. Then low going right (teal).
    cross(58, 0.62, 0, -1); one(B(57.7), 0, -0.2); one(B(58) - 20, 0, -0.35); one(B(58) + 22, 0, -0.35);
    cross(59.75, -0.62, 0, 1); one(B(59.5), 0, 0.15); one(B(59.75) - 20, 0, 0.4); one(B(59.75) + 22, 0, 0.4);
    // through the middle of the box: over or under
    cross(61.5, 0, 0.1, -1); one(B(61.25), 0, 0.5); one(B(61.5) - 20, 0, 0.68); one(B(61.5) + 22, 0, 0.68);
    // a crossing street with a gap: two freighters going right, the gap in the middle when you get there
    cross(63.25, 0, -1.75, 1); cross(63.25, 0, 1.75, 1);
    one(B(63) - 10, 0, 0.3); one(B(63.25) - 20, 0, 0); one(B(63.25) + 22, 0, 0); one(B(63.25) + 44, 0, 0);
    // bar 65, faster: a crossing every bar, flow between them
    cross(65.5, 0.5, -0.95, -1); one(B(65.25), 0.3, 0.2); one(B(65.5) - 20, 0.62, 0.5); one(B(65.5) + 22, 0.62, 0.5);
    free(B(65.5) + 22, 0.62, 0.5);
    gate(66.5, '.../XX.', 'B2');
    cross(67.5, -0.5, 1.05, 1); one(B(67.5) - 20, -0.62, -0.5); one(B(67.5) + 22, -0.62, -0.5);
    // bars 69-72: the peak. A swarm of seven over two crossing decks, a flow wall between
    swarmAt(68.4, { n: 7, tel: 0.9, volleys: 2, aim: 'ship', side: -1, hold: 0.5 });
    cross(69.5, 0.5, -1.9, -1); cross(69.5, 0.5, 1.9, -1); cross(69.5, -0.5, -0.7, 1);
    one(B(69.25), 0.2, 0.1); one(B(69.5) - 20, 0.1, 0.45); one(B(69.5) + 22, 0.1, 0.45);
    free(B(69.5) + 22, 0.1, 0.45);
    gate(70.75, 'X.X/.X.', 'T1');
    cross(72, -0.55, 0.9, -1); cross(72, 0.62, -0.95, 1);
    one(B(71.75), 0.3, 0.2); one(B(72) - 20, 0.5, 0.1); one(B(72) + 22, 0.5, 0.1);
    free(B(72) + 22, 0.5, 0.1);

    // ================= ACT 4: MASTER (bars 73-88): one of everything, then the tunnel =================
    swarmAt(73, { n: 6, tel: 0.85, volleys: 1, aim: 'ship', side: 1, hold: 0.5 });
    gate(74.25, '..X/X..', 'T1', { at: [-40, -20, 0, 18] });
    gate(75.25, '.../..X', 'B1'); flow(75.25, 'T1', { lc: 'T0' });
    cross(76.25, 0.5, 0, 1); one(B(76.25) - 20, 0, -0.45); one(B(76.25) + 22, 0, -0.45);
    free(B(76.25) + 22, 0, -0.45);
    gate(77.25, 'XX./..X', 'T2');
    cross(78.25, -0.5, -1.75, 1); cross(78.25, -0.5, 1.75, 1);
    one(B(78.25) - 20, 0, -0.35); one(B(78.25) + 22, 0, -0.35);
    // bars 79-80: the calm before the tunnel; the rings line up on its mouth
    line(B(79), 0, -0.1, 0, 0, 8, 34);
    // bars 81-84: THE SPINDLE TUNNEL. A ring every 14 m, the mouth bigger; a few freighters to weave
    const t0 = B(81), t1 = B(85);
    add(t0 - 8, 'l7-ring', { s: 1.55, spin: 0, i: 0 });
    for (let d = t0, i = 1; d < t1; d += 14, i++) add(d, 'l7-ring', { s: 1, spin: (i % 2) * Math.PI / 12, i });
    sine(t0 + 20, 8, 22, 0.4, 0.3);
    free(t0 + 20 + 8 * 22, 0, 0.3);
    gate(82.4, '.X./X..', 'B2');
    gate(83.3, 'X../..X', 'B1');
    gate(84.1, '..X/.X.', 'T0', { at: [-20, 0, 18, 40] });
    // bar 85: BLAST OUT, into the open at top speed; a corkscrew of rings to the line
    add(t1, 'l7-blast', {});
    sine(t1 + 40, 16, 34, 0.55, 0.45);
    sine(t1 + 40 + 16 * 34 + 30, 8, 30, 0.3, 0.25, Math.PI);
    // where the crossing streets are, for the scenery streams
    const crossAt = [];
    for (const e of L.events) if (e.type === 'l7-freighter' && e.mode === 'cross' && !e.decor) crossAt.push(e.d);
    zones.setCourse(crossAt, [t0, t1]);
  },
});
