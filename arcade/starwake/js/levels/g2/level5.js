// THE VERDANT DEEP, LEVEL 5: GRAVITY GARDEN. A collapsed star's garden: dark pearls with lensing rings, a violet-white
// accretion disc, stars warping behind the wells (Yori's look, looks/level-g2-05-gravity-garden.png).
// HEADLINE (rule 20): gravity wells bend every path that passes them, shots included. The well
// (js/obstacles/g2-gravity-well) pulls the ship, bends every shot (each bent shot draws its dotted path), costs a hit at
// its core and pays SLINGSHOT! on a rim skim. The slinger (js/enemies/g2-slinger) fires round a well on purpose, so
// its bolt comes at you from the side you weren't watching. The player learns to read arcs.
//
// One schedule with the music (rule 30): audio/g2/level5/music, 140.03 bpm, C# minor, first beat 0.2136 s, galaxy 1's
// bar map (intro 1-8, groove 9-24, build 25-32, DROP 33-48, breakdown 49-56, build 57-64, DROP 65-80, drive 81-88).
// Bars below count from 0 at the first beat. Speed steps on section lines; the set piece (THE DROP) on the drive.
// Wells are sized in box-width units (rn), so a ring at nx = well.nx -+ 1.3 rn skims its rim on every screen.
import { defineLevel } from '../../api.js?v=0.4.0';
import ring from '../../pickups/ring/index.js?v=0.4.0';
import boostRing from '../../pickups/boost-ring/index.js?v=0.4.0';
import pod from '../../enemies/pod/index.js?v=0.4.0';
import seeker from '../../enemies/seeker-drone/index.js?v=0.4.0';
import { shieldCell, mirrorShell, phase } from '../../pickups/powerups/index.js?v=0.4.0';
import well from '../../obstacles/g2-gravity-well/index.js?v=0.4.0';
import slinger from '../../enemies/g2-slinger/index.js?v=0.4.0';
import current from '../../obstacles/g2-current/index.js?v=0.4.0';
import drifter from '../../enemies/g2-drifter/index.js?v=0.4.0';
import { clock } from './level4/clock.js?v=0.4.0';
import { SCENERY, DECOR } from './level5/scenery.js?v=0.4.0';

// the track's kick grid (audio/g2/level5/music.json: bpm 140.03, firstBeat 0.2136 s); 80 to 156 m/s in four steps
const C = clock({ bpm: 140.03, firstBeat: 0.2136, v0: 80, steps: [[24, 19], [48, 19], [64, 19], [80, 19]] });
const B = C.B;
const END = B(88);

export default defineLevel({
  g: 2, n: 5, id: 'garden', name: 'GRAVITY GARDEN',
  idea: 'Gravity wells bend every path that passes them, shots included.',
  length: END,
  speed: C.speed,
  boostMul: 1.55,   // the worst speed for the warning check: a DEEP SLINGSHOT (x1.55; a boost chain is x1.4)
  music: { track: 'g2/level5/music' },
  bossMusic: null,
  // style minimums [grazes + close calls, deflects] for A, S, DEGENERATE, from the decent human bot (about 17 close,
  // most of them SLINGSHOTs, and 14 deflects a run): a quarter, 40% and 60%
  style: { A: [4, 3], S: [7, 5], DEGENERATE: [10, 8] },
  sfx: [{ id: 'g2-well-pull', gain: 0.5 }, { id: 'g2-slingshot', gain: 0.7 }, { id: 'g2-graft-crack', gain: 0.7 }, { id: 'boost-whoosh', gain: 0.53 }],
  sections: [
    { id: 'gate', name: 'THE GARDEN GATE', sub: 'SECTOR 1', d0: 0, d1: B(24), scenery: { 'g2-l5-motes': 1, 'g2-l5-pearls': 0.8, 'g2-l5-farwells': 1, 'g2-l5-disc': 1 } },
    { id: 'beds', name: 'THE PEARL BEDS', sub: 'SECTOR 2', d0: B(24), d1: B(48), scenery: { 'g2-l5-motes': 1, 'g2-l5-pearls': 1, 'g2-l5-farwells': 0.8, 'g2-l5-disc': 1 } },
    { id: 'binary', name: 'THE BINARY', sub: 'SECTOR 3', d0: B(48), d1: B(64), scenery: { 'g2-l5-motes': 1, 'g2-l5-pearls': 0.7, 'g2-l5-farwells': 1, 'g2-l5-disc': 1 } },
    { id: 'drop', name: 'THE DROP', sub: 'FINAL STRETCH', d0: B(64), d1: END, scenery: { 'g2-l5-motes': 1, 'g2-l5-pearls': 0.6, 'g2-l5-farwells': 1, 'g2-l5-disc': (t) => 1 + 0.6 * t } },
  ],
  // Yori's palette (palettes.js, level 5): sky #0a0614, gas #6a3aa0 #e0d0ff #2a1a3a, fog #1a1028, key #f0e8ff, fill #3a2a6a
  looks: {
    gate: { sky: ['#0a0614', 'rgba(106,58,160,A)', 'rgba(224,208,255,A)', 'rgba(42,26,58,A)'], fog: 0x1a1028, hemiSky: 0xf0e8ff, hemiGround: 0x3a2a6a, sun: 0xf0e8ff, band: 0.5, gas: 0.65, cloud: 0xc090ff, clouds: 0.18, seed: 2501 },
    beds: { sky: ['#090512', 'rgba(96,52,150,A)', 'rgba(210,190,250,A)', 'rgba(42,26,58,A)'], fog: 0x180e26, hemiSky: 0xece2ff, hemiGround: 0x382868, sun: 0xf0e8ff, band: 0.55, gas: 0.7, cloud: 0xc090ff, clouds: 0.2, seed: 2502 },
    binary: { sky: ['#08040f', 'rgba(116,62,176,A)', 'rgba(230,214,255,A)', 'rgba(36,22,52,A)'], fog: 0x160c22, hemiSky: 0xf4ecff, hemiGround: 0x3a2a6a, sun: 0xffffff, band: 0.6, gas: 0.7, cloud: 0xd0a8ff, clouds: 0.22, seed: 2503 },
    drop: { sky: ['#0c0618', 'rgba(126,70,190,A)', 'rgba(240,226,255,A)', 'rgba(48,30,66,A)'], fog: 0x1c1230, hemiSky: 0xf8f0ff, hemiGround: 0x403070, sun: 0xffffff, band: 0.65, gas: 0.8, cloud: 0xd8b8ff, clouds: 0.26, seed: 2504 },
  },
  kinds: [ring, boostRing, pod, seeker, well, slinger, current, drifter, shieldCell, mirrorShell, phase, ...DECOR],
  scenery: SCENERY,
  boss: null,
  beats: [
    { d: 0, tag: 'calm', what: 'bar 0, intro: rings in the open, the disc on the horizon' },
    { d: B(6), tag: 'calm', what: 'bar 6, groove: one well well off the lane, rings arcing round its rim: let it pull you through them (SLINGSHOT)' },
    { d: B(13.5), tag: 'rising', what: 'bars 13-21: wells beside the lane; a pod whose shots pass a well and bend (their dotted paths show it)' },
    { d: B(24), tag: 'calm', what: 'bar 24: speed step; rings' },
    { d: B(26), tag: 'rising', what: 'bars 26-31, build one: wells either side, pods whose shots bend' },
    { d: B(33), tag: 'peak', what: 'bar 33, DROP one: the first slinger, firing round a well at you from the side you are not watching' },
    { d: B(41), tag: 'rising', what: 'bars 41-43: PHASE on the ring line, then a well bleeding green: dive its core for DEEP SLINGSHOT and the Shield Cell behind it, or skim its rim' },
    { d: B(44), tag: 'calm', what: 'bars 44-48: breather, a corkscrew' },
    { d: B(48), tag: 'calm', what: 'bar 48, breakdown: speed step' },
    { d: B(50), tag: 'rising', what: 'bars 50-55: THE BINARY, two wells orbiting each other across the lane, their pull swapping sides; shots figure-eight between them' },
    { d: B(56.2), tag: 'peak', what: 'bars 56-61, build two: MIRROR SHELL, then the slingers crossfire round a binary from both sides: the hardest stretch' },
    { d: B(62), tag: 'calm', what: 'bars 62-64: calm' },
    { d: B(65), tag: 'rising', what: 'bars 65-79, DROP two: wells, slingers, a seeker, pods' },
    { d: B(80), tag: 'calm', what: 'bar 80, drive: speed step to the top speed' },
    { d: B(81.5), tag: 'peak', what: 'bars 81-86, SET PIECE: THE DROP, a boost chain round the rim of a giant well, slingers on its rim' },
    { d: B(86), tag: 'calm', what: 'bars 86-88: out, the disc filling the sky' },
  ],
  acts: { introduce: [0, B(24)], develop: [B(24), B(48)], twist: [B(48), B(64)], master: [B(64), END] },
  build(R, L) {
    const { add, line, sine } = L;
    const call = (bar, text, cls = 'c-cyan') => add(B(bar), 'call', { text, cls });
    const W = (bar, nx, ny, rn, o = {}) => add(B(bar), 'g2-gravity-well', Object.assign({ nx, ny, rn }, o));
    // rings running in to a well's rim and skimming it at its height (nx -+ 1.3 rn on the lane side), then out
    const rim = (bar, nx, ny, rn, n = 5) => { const side = nx > 0 ? -1 : 1, x = nx + side * 1.3 * rn; line(B(bar) - 26 * (n - 1), x + side * 0.35, ny * 0.6, x, ny, n, 26); line(B(bar) + 26, x, ny, x + side * 0.3, ny * 0.5, 3, 26); };
    const sl = (bar, nx, ny, swing, o = {}) => add(B(bar), 'g2-slinger', Object.assign({ nx, ny, swing }, o));

    // ================= ACT 1, INTRODUCE: THE GARDEN GATE (bars 0-24, 80 m/s) =================
    line(240, 0, -0.25, 0, 0.25);
    sine(520, 8, 26, 0.35, 0.3);
    // one well well off the lane, rings arcing round its rim: let it pull you through (rule 18: alone, nothing else)
    call(4.8, 'LET THE WELL PULL YOU ROUND ITS EDGE');
    W(7, 1.65, 0.1, 0.45); rim(7, 1.65, 0.1, 0.45);
    line(B(8.6), 0.2, -0.1, -0.3, 0, 4, 26);
    W(10.5, -1.6, -0.1, 0.45); rim(10.5, -1.6, -0.1, 0.45);
    line(B(12), -0.2, 0.2, 0.2, 0.3, 4, 26);
    add(B(12.6), 'pod', { nx: 0.35, ny: -0.5 });
    // a well beside the lane: its core is in reach now
    W(14, 1.05, 0.35, 0.4); rim(14, 1.05, 0.35, 0.4);
    // a pod whose shots pass a well on their way to you: they bend, and their dotted paths show where to
    call(16, 'ITS SHOTS BEND ROUND THE WELLS: WATCH THE DOTS');
    W(17, -0.75, 0.25, 0.32); add(B(18.4), 'pod', { nx: -0.25, ny: 0.55 });
    add(B(16.6), 'g2-drifter', { nx: -1.05, ny: -0.45, s: 0.9 });   // a drifter fallen in toward the well (Tideway's jelly)
    line(B(16.8), 0.3, -0.3, 0.45, -0.35, 5, 26);
    W(20, 0.9, -0.4, 0.38); rim(20, 0.9, -0.4, 0.38); add(B(21.4), 'pod', { nx: -0.3, ny: 0.5 });
    sine(B(21.6), 6, 28, 0.3, 0.25);

    // ================= ACT 2, DEVELOP: THE PEARL BEDS (bars 24-48, 99 m/s) =================
    line(B(24.3), -0.3, 0, 0.3, 0, 5, 26);
    // wells either side: a gate to thread, both pulling outward
    W(26.5, -1.2, 0, 0.38); W(26.5, 1.2, 0, 0.38); line(B(26.5) - 70, 0, 0.3, 0, -0.1, 4, 24);
    // pods whose shots bend round a well beside the lane
    W(28.5, 0.75, 0.15, 0.35); add(B(29.8), 'pod', { nx: 0.25, ny: 0.5, shots: 2 });
    line(B(28.2), -0.35, -0.1, -0.35, 0.3, 5, 26);
    W(31, -0.85, 0.3, 0.38); rim(31, -0.85, 0.3, 0.38); sl(32, -0.6, 0.55, 1, { shots: 2 });
    add(B(30.1), 'g2-current', { len: B(31) - B(30.1) + 20, fx: -0.22, fy: 0.04 });   // a current pouring into the well: it carries you to its rim
    // DROP one: the first slinger, alone, behind a well: its bolt swings round the well and comes in from the side
    call(32.2, 'THAT ONE FIRES ROUND THE WELL', 'c-red');
    W(34, 0.45, 0.25, 0.32); sl(35, 0.45, 0.4, -1, { shots: 3 });
    line(B(33.4), -0.3, -0.3, 0.2, -0.4, 5, 26);
    W(37, -0.5, -0.2, 0.32); sl(38, -0.5, -0.05, 1, { shots: 3 });
    line(B(36.4), 0.35, 0.3, 0.3, -0.1, 5, 26);
    add(B(38.8), 'pod', { nx: -0.3, ny: 0.55, shots: 2 });
    W(39.5, 0.95, 0.4, 0.36); add(B(40.6), 'pod', { nx: 0.45, ny: 0.6, shots: 2 });
    // PHASE, then a well with green bleeding round its core (the clue), a ring trail running into it (caches: rings
    // beyond the count, never part of a star) and a Shield Cell on its far side. Without Phase: skim its rim.
    line(B(40.4), 0, -0.3, 0, 0, 4, 24);
    add(B(41.2), 'phase', { nx: 0, ny: 0 });
    W(43, 0, 0, 0.42, { green: true });
    for (let i = 0; i < 4; i++) L.ring(B(43) - 20 - i * 22, 0, 0, 'ring', { cache: true, noMagnet: true });
    add(B(43) + 16, 'shield-cell', { nx: 0, ny: 0 });
    line(B(42.2), 0.35, 0.25, 0.55, 0.05, 3, 24); line(B(43) + 26, 0.55, 0.05, 0.3, 0.2, 3, 24);   // the rim skim round it
    // breather (rule 2)
    sine(B(44.6), 10, 26, 0.45, 0.35);

    // ================= ACT 3, TWIST: THE BINARY (bars 48-64, 118 m/s) =================
    line(B(48.4), 0, 0.3, 0, -0.3, 5, 26);
    call(49.2, 'TWO WELLS, ONE ORBIT', 'c-cyan');
    // two wells orbiting each other across the lane: their pull swaps sides as they turn
    const binary = (bar, rx, ry, w, rn = 0.3) => { W(bar, 0, 0, rn, { orbit: { cx: 0, cy: 0, rx, ry, w, ph: 0 } }); W(bar, 0, 0, rn, { orbit: { cx: 0, cy: 0, rx, ry, w, ph: Math.PI } }); };
    binary(50.5, 0.62, 0.3, 1.3);
    sine(B(50.5) - 80, 6, 26, 0.12, 0.6);                  // a narrow line down the middle, high and low
    sl(51.5, -0.4, 0.55, -1, { shots: 2 });                // its bolts swing round the pair
    add(B(52), 'pod', { nx: 0.1, ny: 0.6, shots: 2 }); add(B(55), 'pod', { nx: -0.45, ny: 0.5, shots: 2 });      // its shots figure-eight through the next pair
    binary(53.2, 0.4, 0.5, -1.6);
    sl(54.2, 0.4, 0.5, 1, { shots: 3 });
    line(B(53.6), -0.6, 0, -0.55, 0.4, 4, 26);
    // MIRROR SHELL, then the slingers' curved crossfire round a binary from both sides: one bolt at you, one landing wide
    // on its own side, at once. The shell's reach takes both in one roll. The hardest stretch (rule 5)
    line(B(55.6), 0, 0.2, 0, -0.2, 3, 24);
    add(B(56.2), 'mirror-shell', { nx: 0, ny: -0.2 });
    binary(57.6, 0.55, 0.32, 1.5);
    sl(58.6, -0.75, 0.3, -1, { shots: 2, wide: 2.8 }); sl(58.6, 0.75, 0.3, 1, { shots: 2 });
    line(B(57.8), 0, -0.4, 0, -0.1, 5, 26);
    binary(60.2, 0.45, 0.45, -1.4);
    add(B(60.8), 'seeker-drone', { nx: -0.3, ny: 0.55, shots: 2, hold: 120 });
    line(B(60.4), 0.5, 0.3, 0.5, -0.2, 4, 26);
    sine(B(62), 6, 28, 0.3, 0.3);

    // ================= ACT 4, MASTER: THE DROP (bars 64-88, 137 then 156 m/s) =================
    line(B(64.3), -0.3, 0, 0.3, 0, 5, 28);
    W(66.5, -1.0, 0.3, 0.38); sl(67.5, -0.6, 0.45, -1, { shots: 3 }); rim(66.5, -1.0, 0.3, 0.38);
    W(69, 0.9, -0.3, 0.38); add(B(70), 'pod', { nx: 0.4, ny: 0.5, shots: 2 }); sl(70.2, 0.6, -0.5, 1, { shots: 2 }); add(B(70.6), 'pod', { nx: -0.35, ny: -0.5, shots: 2 }); rim(69, 0.9, -0.3, 0.38);
    add(B(71.2), 'seeker-drone', { nx: 0.3, ny: 0.5, shots: 2, hold: 130 });
    add(B(68.6), 'g2-drifter', { nx: 1.05, ny: -0.5, s: 0.9 });
    binary(72.6, 0.5, 0.35, 1.5);
    sl(73.6, 0.5, -0.4, 1, { shots: 3 });
    line(B(72.8), 0, 0.5, 0, 0.1, 4, 26);
    W(75.5, -0.75, -0.2, 0.36); sl(76.5, -0.4, 0.2, -1, { shots: 3 }); add(B(77.8), 'seeker-drone', { nx: -0.3, ny: 0.55, shots: 2, hold: 130 }); rim(75.5, -0.75, -0.2, 0.36);
    sine(B(77.6), 8, 28, 0.35, 0.3);
    // THE DROP (the set piece, at the top speed): a giant well off the left of the lane, its rim sweeping most of the box;
    // a boost chain runs along the rim, and slingers on its rim fire round it. A slingshot off it is the level's finale.
    call(80.4, 'THE DROP', 'c-cyan');
    line(B(81), 0.3, 0, 0, 0, 3, 28);
    W(84, -2.1, -0.2, 1.15, { k: 0.8 });
    line(B(84) - 4 * 30, -0.3, 0.15, -0.62, -0.15, 5, 30, 'boost-ring', (i, n) => ({ chain: 'g2-l5-drop', idx: i, of: n }));
    sl(85.6, -1.0, 0.55, 1, { shots: 2, at: 360 }); sl(85.6, -0.9, -0.7, 1, { shots: 1, at: 320 });
    line(B(84) + 30, -0.55, -0.15, -0.2, 0, 4, 30);
    // out: the disc fills the sky
    line(B(86.2), 0, -0.2, 0, 0.2, 4, 32);
  },
  outro: null,
});
