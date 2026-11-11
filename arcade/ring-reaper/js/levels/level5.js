// LEVEL 5 (played 7th since 11-08): ION STORM. A violet storm of floating pylons, white lightning jumping between their lamps on the beat.
// The headline (rule 20): slip through the lightning when it goes dark. The new enemy is the sniper (its sight-
// line finds you, goes white, and one fast bolt flies down it). The twist puts snipers on the lightning's own
// cables: send a sniper's bolt home and its sheet of lightning shorts out. The finish is the lightning wall.
// The course is authored in BARS of the level's take (plan.js: B(bar) -> metres), so every set piece, speed step
// and pattern change sits on a bar line of the music (rule 30). Beat sheet and spawn tables: level5/DESIGN.md.
import { defineLevel } from '../api.js?v=0.6.0';
import ring from '../pickups/ring/index.js?v=0.6.0';
import sniper from '../enemies/sniper/index.js?v=0.6.0';
import { pylon, pair, arc, sheet, wall } from './level5/storm.js?v=0.6.0';
import { field, sky, crown } from './level5/scenery.js?v=0.6.0';
import { PATTERNS } from './level5/arcs.js?v=0.6.0';
import { B, LENGTH, speed, END_BAR } from './level5/plan.js?v=0.6.0';

// Yori's level-5 palette (art-incoming/yori/levels/palettes.js): sky 0a0a2a, gas 4a2aa0 / e8e0ff / 2a1a6a,
// fog 2a2060, key f0ecff, fill 4a30a0, accent c0a8ff. Violet and white only: the arcs are white, your bolt cyan.
const A = (hex, a = 'A') => { const n = parseInt(hex, 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; };
const look = (o) => Object.assign({ sky: ['#0a0a2a', A('4a2aa0'), A('e8e0ff'), A('2a1a6a')], fog: 0x2a2060, hemiSky: 0xf0ecff, hemiGround: 0x4a30a0, sun: 0xf0ecff, band: 0.5, gas: 0.72, cloud: 0x6a4ad0, clouds: 0.26 }, o);

// a pattern offset (in beats) that starts its live run on bar k
const startOn = (p, k) => { const s = PATTERNS[p] || p; return ((k - 1) * 4) % s.length; };

export default defineLevel({
  n: 7, id: 'storm', name: 'ION STORM', // played SEVENTH since Evrtek's swap (11-08); its file stays level5.js
  idea: 'Slip through the lightning when it goes dark.',
  seed: 505,
  length: LENGTH,
  speed,
  // its own take: l5-t1, 146 bpm breakbeat techno, C# minor (track.js has its beat grid)
  music: { track: 'levels/level5/music' },
  bossMusic: null,
  sfx: [{ id: 'lightning-crack', gain: 0.8 }],
  sections: [
    { id: 'edge', name: 'THE STORM EDGE', sub: 'SECTOR 1', d0: 0, d1: B(25), look: 'edge', scenery: { 'l5-field': 1, 'l5-sky': 1 } },
    { id: 'roost', name: 'THE ROOST', sub: 'SECTOR 2', d0: B(25), d1: B(49), look: 'roost', scenery: { 'l5-field': 1, 'l5-sky': 1 } },
    { id: 'cell', name: 'THE QUIET CELL', sub: 'SECTOR 3', d0: B(49), d1: B(57), look: 'cell', scenery: { 'l5-field': 0.6, 'l5-sky': 0.5, 'l5-crown': 1 } },
    { id: 'wire', name: 'THE LIVE WIRE', sub: 'SECTOR 4', d0: B(57), d1: B(77), look: 'wire', scenery: { 'l5-field': 1, 'l5-sky': 1, 'l5-crown': 0.8 } },
    { id: 'wall', name: 'THE LIGHTNING WALL', sub: 'FINAL STRETCH', d0: B(77), d1: LENGTH, look: 'wall', scenery: { 'l5-field': 0.8, 'l5-sky': 1, 'l5-crown': 1 } },
  ],
  looks: {
    edge: look({ seed: 501 }),
    roost: look({ seed: 502, sky: ['#08081f', A('3a2290'), A('c8b8ff'), A('241458')], fog: 0x221a52, gas: 0.62, clouds: 0.3 }),
    cell: look({ seed: 503, sky: ['#05051a', A('2a1a6a'), A('8a78d0'), A('1a1050')], fog: 0x18123e, gas: 0.45, cloud: 0x4a3a9a, clouds: 0.14, hemiSky: 0xb8a8f0 }),
    wire: look({ seed: 504, sky: ['#0c0a2e', A('5a32b8'), A('f0ecff'), A('2a1a6a')], fog: 0x2e2268, gas: 0.8, clouds: 0.3 }),
    wall: look({ seed: 506, sky: ['#100c34', A('6a3ac8'), A('ffffff'), A('3a2490')], fog: 0x34287a, gas: 0.9, cloud: 0x9a7aff, clouds: 0.34, sun: 0xffffff }),
  },
  kinds: [ring, sniper, pylon, pair, arc, sheet, wall],
  scenery: [field, sky, crown],
  // rule 1: the beat sheet, in bars of the take (B(bar) metres)
  beats: [
    { d: 0, tag: 'calm', what: 'the storm opens: rings in the open, pylons off the lane, lightning far off' },
    { d: B(5), tag: 'calm', what: 'the first arc, alone and high; then one low; then one dark across the middle, rings through it' },
    { d: B(10), tag: 'rising', what: 'arc gates on the beat: high and low in turn, the middle safe; the rings show the dark bar' },
    { d: B(15), tag: 'rising', what: 'the first sheet: lightning under you for four bars, the rings dip through it when it goes dark' },
    { d: B(19), tag: 'rising', what: 'a sheet down the middle, live every other bar: cross on the dark ones' },
    { d: B(22), tag: 'peak', what: 'the corridor: two sheets in turn, weave between three lanes' },
    { d: B(25), tag: 'calm', what: 'faster; open space' },
    { d: B(26.5), tag: 'rising', what: 'THE SNIPER, alone: its first shot locks beside you on purpose (a graze); then two more, true' },
    { d: B(33), tag: 'rising', what: 'Drop one: faster, nothing new for a bar' },
    { d: B(34), tag: 'peak', what: 'the crossfire: three columns of lightning in turn, snipers both sides' },
    { d: B(41), tag: 'peak', what: 'the strike: a sheet that fires on the ONE of every other bar after a bar of charge; cross between strikes; sniper pairs' },
    { d: B(47), tag: 'calm', what: 'the peak fades' },
    { d: B(49), tag: 'calm', what: 'the quiet cell: a long corkscrew of rings, the Stormcrown rises' },
    { d: B(57), tag: 'calm', what: 'faster' },
    { d: B(58), tag: 'rising', what: 'the rail sniper, taught safe: a live sheet holds rings under it; send its sniper home and it shorts out' },
    { d: B(62), tag: 'rising', what: 'a second rail sniper, the sheet above you this time' },
    { d: B(65), tag: 'peak', what: 'Drop two: corridors with rail snipers, strikes and pairs (the hardest stretch, about two thirds in)' },
    { d: B(75), tag: 'calm', what: 'the peak fades' },
    { d: B(77), tag: 'calm', what: 'faster: the Stormcrown fills the sky (the lead-in)' },
    { d: B(79), tag: 'rising', what: 'the lightning walls: one a bar, one gap each, the gap moving; rings in every gap' },
    { d: B(85), tag: 'calm', what: 'the last breath: the rings gather to the middle' },
    { d: B(87), tag: 'peak', what: 'THE LIGHTNING WALL: kilometres of it; its gap opens as you arrive; then home' },
  ],
  // rule 19: the four acts
  acts: { introduce: [0, B(25)], develop: [B(25), B(57)], twist: [B(57), B(77)], master: [B(77), LENGTH] },

  // 0.4.0, the galaxy 1 retrofit (the plan's 6.5; nothing else in the level moves, no ring is added or moved):
  // ION STORM: the Shield Cell in the quiet cell after the strike; Overclock 2.5 s before drop two's rail snipers.
  powerups: [[7110, 'shield-cell', 0.5, 0.155], [9777, 'overclock', -0.125, 0.82]],
  build(R, L) {
    const { add, ring } = L;
    // n rings from bar b0 to bar b1, at f(u) = [nx, ny] for u 0..1
    const path = (b0, b1, n, f) => { const d0 = B(b0), d1 = B(b1); for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) : 0, [x, y] = f(u, i); ring(d0 + (d1 - d0) * u, x, y); } };
    const lineP = (b0, b1, n, x0, y0, x1, y1) => path(b0, b1, n, (u) => [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u]);
    const hold = (b0, b1, n, x, y) => lineP(b0, b1, n, x, y, x, y);
    const arcAcross = (k, ny, p, off = 0) => add(B(k), 'l5-arc', { ax: -1.3, ay: ny, bx: 1.3, by: ny, pat: p, off });
    const arcDown = (k, nx, p, off = 0) => add(B(k), 'l5-arc', { ax: nx, ay: -1.35, bx: nx, by: 1.35, pat: p, off });
    const arcDiag = (k, s, p, off = 0) => add(B(k), 'l5-arc', { ax: -1.25, ay: -1.25 * s, bx: 1.25, by: 1.25 * s, pat: p, off });
    const sheetH = (b0, b1, ny, p, off = 0, o = {}) => add(B(b0), 'l5-sheet', Object.assign({ ax: -1.3, ay: ny, bx: 1.3, by: ny, len: B(b1) - B(b0), pat: p, off }, o));
    const sheetV = (b0, b1, nx, p, off = 0, o = {}) => add(B(b0), 'l5-sheet', Object.assign({ ax: nx, ay: -1.35, bx: nx, by: 1.35, len: B(b1) - B(b0), pat: p, off }, o));
    // a sniper perched on a pylon's lamp
    const perch = (k, nx, ny, o = {}) => { add(B(k), 'l5-pylon', { nx, ny, dy: -3.8, yaw: R.range(0, 6) }); add(B(k), 'sniper', Object.assign({ nx, ny }, o)); };
    const wallAt = (k, gx, gy, o = {}) => { add(B(k), 'l5-wall', Object.assign({ gx, gy, gr: 3 }, o)); ring(B(k), gx, gy); };

    // ================================================================ ACT 1, INTRODUCE (bars 1-24): THE STORM EDGE
    // bars 1-4: nothing that can hurt; rings in the open (rule 4)
    lineP(1.6, 2.6, 5, -0.5, -0.1, 0.5, -0.1);
    path(3, 4.6, 7, (u) => [Math.sin(u * Math.PI * 2) * 0.5, -0.1 + Math.cos(u * Math.PI * 2) * 0.35 - 0.35]);
    // bar 5: the first arc, alone and HIGH, live as you pass under it (you see what live looks like, at no cost)
    const slowA = startOn('slow', 5);
    arcAcross(5.5, 0.6, 'slow', slowA);
    hold(4.9, 6.0, 5, 0, -0.35);
    // bar 6.5: one LOW, live; rings above it
    arcAcross(6.5, -0.62, 'slow', slowA);
    lineP(6.1, 7.0, 4, 0, 0.2, 0, 0.25);
    // bar 7.5: one across the MIDDLE, dark when you reach it: the rings go straight through (dark is safe)
    arcAcross(7.5, 0, 'slow', slowA);
    lineP(7.1, 7.9, 4, 0, 0.25, 0, 0);
    // bar 9 (Groove): faster; bar 10 on, arc gates: high on odd bars, low on even ones, the middle always safe
    lineP(8.3, 9.6, 5, -0.4, 0, 0.4, 0);
    for (let k = 10; k <= 13; k++) {
      arcAcross(k + 0.5, 0.48, 'bar', 0); arcAcross(k + 0.5, -0.48, 'anti', 0);
      lineP(k + 0.05, k + 0.95, 4, (k % 2 ? 0.3 : -0.3), 0, (k % 2 ? -0.3 : 0.3), 0);
    }
    // bar 14: one across the middle, live on odd bars: early in bar 14 it is dark and the rings go through
    arcAcross(14.15, 0, 'bar', 0);
    lineP(13.95, 14.5, 4, 0, 0.1, 0, -0.25);
    // bars 15-19: THE FIRST SHEET, lightning under the lane (ny -0.35), live bars 15-16 and 19, dark 17-18
    const s1 = startOn('slow', 15);
    sheetH(15, 19.2, -0.35, 'slow', s1);
    lineP(15.05, 16.9, 7, -0.3, 0.3, 0.3, 0.3);
    path(17.05, 18.35, 6, (u) => [0.3 - 0.6 * u, 0.3 - 1.05 * Math.sin(u * Math.PI)]); // down through it in the dark, and up
    lineP(18.7, 19.4, 3, -0.3, 0.3, 0, 0.2);
    // bars 19.5-22.6: a sheet down the middle, live bars 20-21, dark 22-23: keep left, cross when it goes dark
    sheetV(19.5, 22.6, 0, 'slow', startOn('slow', 20));
    lineP(19.6, 21.9, 8, -0.55, 0, -0.55, 0.1);
    lineP(22.0, 22.5, 3, -0.3, 0.05, 0.5, 0);
    // bars 22.75-24.6: the corridor, two sheets two bars apart: bar 23 the top is dark (rise into it), bar 24
    // the top is charging and the bottom live (keep to the middle)
    sheetH(22.75, 24.6, 0.45, 'slow', startOn('slow', 21)); sheetH(22.75, 24.6, -0.45, 'slow', startOn('slow', 23));
    lineP(22.8, 22.95, 2, 0.5, 0, 0, 0);
    path(23.05, 23.85, 5, (u) => [0.4 - 0.8 * u, 0.85 * Math.sin(u * Math.PI)]);
    lineP(24.05, 24.55, 4, -0.4, 0, 0.4, 0);

    // ================================================================ ACT 2, DEVELOP (bars 25-56): THE ROOST
    lineP(25.2, 26.4, 6, 0.4, -0.3, -0.4, 0.2);
    // bar 27: THE SNIPER, alone. Its sight is long (1.2 s) and its one shot locks 1.6 m off you on purpose: a graze
    perch(28.7, 1.4, 0.55, { sight: 1.2, miss: 1.6, shots: 1, at: 3.0 });
    hold(26.8, 28.4, 6, -0.15, -0.1);
    // bar 29.5: a second one, the other side, true (1.0 s sight); bar 31: one with two shots
    perch(30.9, -1.4, 0.3, { sight: 1.0, shots: 1 });
    lineP(28.8, 30.4, 6, -0.3, 0.3, 0.3, -0.3);
    perch(32.6, 1.4, -0.2, { shots: 2 });
    path(30.8, 32.8, 8, (u) => [Math.sin(u * 5) * 0.45, Math.cos(u * 4) * 0.35]);
    // bar 33 (Drop one): faster, and nothing new for a bar (rule 6)
    lineP(33.1, 33.9, 4, 0, 0, 0, 0.3);
    // bars 34-41: THE CROSSFIRE: three columns. The two sheets take turns two bars at a time (left live 34-35 and
    // 38-39, right live 36-37 and 40-41); the rings ride out into whichever outer column is dark and back
    sheetV(34, 41.2, -0.42, 'slow', startOn('slow', 34)); sheetV(34, 41.2, 0.42, 'slow', startOn('slow', 36));
    for (let k = 34; k <= 40; k += 2) {
      const open = (k - 34) % 4 === 0 ? 1 : -1; // 34-35: right dark; 36-37: left dark; ...
      path(k + 0.15, k + 1.15, 7, (u) => [open * 0.72 * Math.sin(Math.min(1, u * 1.15) * Math.PI), 0.3 * Math.cos(u * 5)]);
      if (k + 1.6 < 41) ring(B(k + 1.6), 0, 0.1);
    }
    perch(36.4, -1.45, 0.65, { shots: 1 }); perch(38.4, 1.45, 0.6, { shots: 1 }); perch(40.5, -1.45, 0.2, { shots: 2 });
    // bars 41.5-46: THE STRIKE: a sheet across the middle that fires on the ONE of every other bar: cross between
    sheetH(41.5, 46.3, 0, 'strike', 0);
    ring(B(41.3), -0.3, -0.55); // onto bar 42's side before the sheet arrives
    for (let k = 42; k <= 45; k++) {
      const s = k % 2 ? 1 : -1; // hold your side through the one, cross between beats 2 and 4
      ring(B(k + 0.05), s * 0.3, s * 0.55);
      path(k + 0.3, k + 0.85, 4, (u) => [s * (0.3 - 0.6 * u), s * (0.55 - 1.1 * u)]);
    }
    perch(43.4, 1.45, 0.7, { shots: 1 }); perch(43.4, -1.45, -0.6, { shots: 1, at: 2.5 });
    perch(45.6, -1.45, 0.7, { shots: 1 }); perch(45.6, 1.45, -0.6, { shots: 1, at: 2.5 });
    // bars 47-48: the peak fades
    lineP(46.6, 48.6, 8, -0.5, -0.3, 0.5, -0.1); // the strike's last side, until it has gone by
    // ================================================================ THE QUIET CELL (bars 49-56): calm
    path(49.2, 56.6, 40, (u) => [Math.sin(u * Math.PI * 6) * 0.55, Math.cos(u * Math.PI * 6) * 0.45]);

    // ================================================================ ACT 3, TWIST (bars 57-76): THE LIVE WIRE
    lineP(57.1, 57.9, 4, 0, 0.3, 0, 0);
    // bar 58: the rail sniper, taught safe. An always-live sheet under the lane holds rings below it; its sniper
    // stands on the right-hand cable. Send the bolt home and the sheet shorts out: the rings are yours. Do
    // nothing and you keep to the safe side above it, missing only rings.
    sheetH(58.5, 61.6, -0.45, 'live', 0, { sniper: { side: 'b', dz: 80, at: 3.6, sight: 1.0, shots: 2, gap: 0.5 } });
    hold(57.95, 58.4, 3, 0, 0.3);
    path(59.4, 61.4, 9, (u) => [Math.sin(u * 5) * 0.5, -0.82]);
    // bar 62: a second, the live sheet ABOVE the lane, its sniper hanging under the left cable's lamp
    sheetH(62.2, 64.8, 0.45, 'live', 0, { sniper: { side: 'a', dz: 80, at: 3.4, shots: 2, gap: 0.5 } });
    lineP(62.3, 62.9, 3, -0.4, -0.2, 0, -0.1);
    path(63.3, 64.6, 6, (u) => [0.3 * Math.sin(u * 4), 0.82]);
    // bar 65 (Drop two): faster; bars 66-70 THE PEAK. A corridor: the top sheet live 66-67 and dark 68-69, the
    // bottom always live with a rail sniper. Middle, then the bottom lane (short it first), then the top lane in
    // its dark, then the middle.
    lineP(65.1, 65.9, 4, 0, 0, 0, 0);
    sheetH(66, 70.2, 0.5, 'slow', startOn('slow', 66)); sheetH(66, 70.2, -0.5, 'live', 0, { sniper: { side: 'a', dz: 120, at: 3.4, shots: 2, gap: 0.45 } });
    path(66.1, 67.0, 4, (u) => [0.4 * Math.sin(u * Math.PI * 2), 0]);
    lineP(67.25, 67.95, 4, -0.4, -0.85, 0.4, -0.85);   // the bottom lane, for the player who shorted it
    path(68.25, 69.1, 5, (u) => [0.4 - 0.8 * u, 0.82]); // the top lane, dark until 69.25
    lineP(69.4, 70.1, 3, -0.3, 0, 0.3, 0);
    perch(68.6, 1.45, 0.7, { shots: 1 });
    // bars 70.5-74: a strike down the middle and a live floor with a rail sniper; sniper pairs
    sheetV(70.5, 74.4, 0, 'strike', 0);
    sheetH(70.5, 74.4, -0.55, 'live', 0, { sniper: { side: 'b', dz: 80, at: 3.2, shots: 2, gap: 0.45 } });
    ring(B(70.45), 0.55, 0.1); // onto bar 71's side before the strike
    for (let k = 71; k <= 72; k++) {
      const s = k % 2 ? 1 : -1;
      ring(B(k + 0.05), s * 0.55, 0.1);
      path(k + 0.3, k + 0.85, 4, (u) => [s * (0.55 - 1.1 * u), 0.2 * Math.sin(u * Math.PI)]);
    }
    lineP(73.1, 74.2, 5, 0.55, -0.85, 0.6, -0.9); // the floor lane on the right, once its sniper is home
    perch(72.5, -1.45, 0.75, { shots: 1 }); perch(72.5, 1.45, 0.75, { shots: 1, at: 2.4 });
    // bars 75-76: the peak fades
    lineP(74.6, 76.8, 8, 0.5, 0.3, -0.5, -0.1);

    // ================================================================ ACT 4, MASTER (bars 77-88): THE LIGHTNING WALL
    // bars 77-78: the lead-in, calm (rule 3)
    path(77.1, 78.8, 8, (u) => [Math.sin(u * Math.PI * 2) * 0.3, Math.cos(u * Math.PI * 2) * 0.25]);
    // bars 79-84: a wall on each bar line, one gap each, the gap moving: middle, left, right, low right, low left, middle
    const gaps = [[0, 0], [-0.5, 0.35], [0.5, 0.35], [0.45, -0.4], [-0.45, -0.4], [0, 0]];
    gaps.forEach(([gx, gy], i) => {
      const k = 79 + i; wallAt(k, gx, gy);
      if (i + 1 < gaps.length) { const [nx2, ny2] = gaps[i + 1]; lineP(k + 0.3, k + 0.8, 3, gx + (nx2 - gx) * 0.25, gy + (ny2 - gy) * 0.25, gx + (nx2 - gx) * 0.8, gy + (ny2 - gy) * 0.8); }
    });
    // bars 85-86: the last breath; the rings gather to the middle
    path(84.4, 86.6, 9, (u) => [Math.sin(u * Math.PI * 3) * 0.4 * (1 - u), Math.cos(u * Math.PI * 3) * 0.3 * (1 - u)]);
    // bar 87: THE LIGHTNING WALL. Giant pylons far out, the gap opening wide as you arrive
    add(B(87), 'l5-wall', { gx: 0, gy: 0, gr: 3.5, open: [3.5, 6], w: 150, h: 90, s: 3.2 });
    ring(B(87), 0, 0);
    hold(86.75, 86.95, 2, 0, 0);
    // home: a corkscrew to the finish on the first beat after Drive
    path(87.3, END_BAR - 0.3, 10, (u) => [Math.sin(u * Math.PI * 4) * 0.5 * u, Math.cos(u * Math.PI * 4) * 0.4 * u]);
  },
});
