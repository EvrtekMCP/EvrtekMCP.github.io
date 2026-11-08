// GALAXY 3, LEVEL 2: THE LOOM FLOOR (the plan's 4.2). A woven plain kilometres wide, its threads glowing ultraviolet,
// and loom shuttles running rails beside the lane. Its one idea: shuttle-bolts weave as they fly, so roll where the
// weave crosses you. The new enemy is the SHUTTLER (js/enemies/g3-shuttler). Re-used: blueprint walls (level 1),
// pods, seekers, swarm chains, mines.
// Written in BARS of its track (g3/level2/music, 142 bpm, EBM-techno, a sequenced bass that zigzags like the weave).
//   Act 1 INTRODUCE  bars 1-24   one weaving bolt wide of you (watch its thread), then aimed ones, one at a time
//   Act 2 DEVELOP    bars 25-48  aimed weaves from every rail, then pairs out of step
//   Act 3 TWIST      bars 49-64  THE CROSS-WEAVE: two shuttles, one across, one up and down, a mesh with one hole;
//                                SLIPSTREAM right before the first (taught alone); OVERCLOCK before the Loom Bed
//   Act 4 MASTER     bars 65-88  THE LOOM BED: ten shuttles in a running pattern while walls build; then out along one
//                                thread to the finish
import { defineLevel, clamp } from '../../api.js?v=0.4.1';
import ring from '../../pickups/ring/index.js?v=0.4.1';
import boostRing from '../../pickups/boost-ring/index.js?v=0.4.1';
import { overclock, slipstream } from '../../pickups/powerups/index.js?v=0.4.1';
import pod from '../../enemies/pod/index.js?v=0.4.1';
import seeker from '../../enemies/seeker-drone/index.js?v=0.4.1';
import swarm from '../../enemies/swarm-unit/index.js?v=0.4.1';
import mines from '../../obstacles/mines/index.js?v=0.4.1';
import wall from '../../obstacles/g3-blueprint-wall/index.js?v=0.4.1';
import shuttler from '../../enemies/g3-shuttler/index.js?v=0.4.1';
import { loomFloor, spool, spools, rail, rails, railsUnder } from './level2/scenery.js?v=0.4.1';
import { timeline } from './level1/time.js?v=0.4.1';

// audio/g3/level2/music.json (take g3l2-t3): the kick grid fitted to the take
const TL = timeline({ name: 'g3/level2/music', bpm: 142.011, firstBeat: 0.1614, barSec: 1.69001 },
  [[1, 76], [9, 86], [17, 94], [25, 102], [33, 114], [49, 104], [57, 118], [65, 130], [73, 140], [81, 152]]);
const B = TL.barD;
const END = Math.round(B(88.5));
// a shuttle's volley leaves 0.95 s after it is on station (0.35 s, then its 0.6 s tell); its bolts take 1.36 s x the
// level's ease.shot (1.08 here) to reach you: where the course is when they arrive
const VOLLEY = 0.95, ARRIVE = VOLLEY + 1.36 * 1.08;
const after = (bar, s) => TL.dOfT(TL.tOfD(B(bar)) + s);
const SC = { 'g3-l2-floor': 1, 'g3-l2-spools': 1, 'g3-l2-rails': 1, 'g3-l2-rails-under': 1 };

export default defineLevel({
  g: 3, n: 2, id: 'loom', name: 'THE LOOM FLOOR',
  idea: 'Shuttle-bolts weave as they fly, so roll where the weave crosses you.',
  seed: 300202,
  length: END,
  speed: TL.speed,
  boostMul: 1.4,
  // style minimums [grazes + close calls, deflects]: from the decent human bot (about 13 and 38 a run; the shuttles make
  // this the galaxy's first roll-heavy level), a quarter, 40% and 60% of that (LEVEL-API 12.6)
  // DEGENERATE (CLU-I2, the MCP 11-07): the decent bot ran 94-97% of the rings (the 95% gate is no guard here), so its deflects
  // must fall short: its best was 42; the good bot with power-ups off had 45 and 46
  style: { A: [3, 9], S: [5, 15], DEGENERATE: [11, 43] },
  music: { track: 'g3/level2/music' },
  bossMusic: null,
  sfx: [{ id: 'g3-shuttle', gain: 0.5 }, { id: 'g3-weave', gain: 0.55 }, { id: 'g3-blueprint', gain: 0.6 }, { id: 'g3-build', gain: 0.55 }],
  sections: [
    { id: 'floor', name: 'THE LOOM FLOOR', sub: 'SECTOR 1', d0: 0, d1: B(17), look: 'floor', scenery: SC },
    { id: 'warp', name: 'THE WARP RAILS', sub: 'SECTOR 2', d0: B(17), d1: B(33), look: 'warp', scenery: SC },
    { id: 'step', name: 'OUT OF STEP', sub: 'SECTOR 3', d0: B(33), d1: B(49), look: 'step', scenery: SC },
    { id: 'cross', name: 'THE CROSS-WEAVE', sub: 'SECTOR 4', d0: B(49), d1: B(65), look: 'cross', scenery: SC },
    { id: 'bed', name: 'THE LOOM BED', sub: 'SECTOR 5', d0: B(65), d1: B(81), look: 'bed', scenery: SC },
    { id: 'thread', name: 'THE LAST THREAD', sub: 'FINAL STRETCH', d0: B(81), d1: END, look: 'thread', scenery: { 'g3-l2-floor': 1, 'g3-l2-spools': 0.6, 'g3-l2-rails': 1, 'g3-l2-rails-under': 0 } },
  ],
  // Yori's palette (art-incoming/yori/g3/g3-palettes.js, level 2): sky 0a0714, gas 5a2ae0 / 2a1a6a / 1a0a30, fog 17102a,
  // key c8b0ff, fill 4a2aa0. The most violet level: the red threads are the shots, the violet ones the floor.
  looks: {
    floor: { sky: ['#0a0714', 'rgba(90,42,224,A)', 'rgba(42,26,106,A)', 'rgba(26,10,48,A)'], fog: 0x17102a, hemiSky: 0xc8b0ff, hemiGround: 0x4a2aa0, sun: 0xd8c8ff, band: 0.5, gas: 0.6, cloud: 0x2a1a6a, clouds: 0.14, seed: 3201, starGlow: 0.8 },
    warp: { sky: ['#0b0716', 'rgba(100,50,230,A)', 'rgba(50,30,120,A)', 'rgba(26,10,48,A)'], fog: 0x18112c, hemiSky: 0xc8b0ff, hemiGround: 0x4a2aa0, sun: 0xe0d4ff, band: 0.48, gas: 0.66, cloud: 0x3a2a80, clouds: 0.16, seed: 3202 },
    step: { sky: ['#0c0718', 'rgba(110,56,240,A)', 'rgba(42,26,106,A)', 'rgba(60,30,90,A)'], fog: 0x1a122e, hemiSky: 0xd8c8ff, hemiGround: 0x5a3ab0, sun: 0xf0e8ff, band: 0.46, gas: 0.72, cloud: 0x4a2aa0, clouds: 0.2, seed: 3203 },
    cross: { sky: ['#090612', 'rgba(80,36,200,A)', 'rgba(36,22,90,A)', 'rgba(26,10,48,A)'], fog: 0x150f26, hemiSky: 0xb8a0ff, hemiGround: 0x3a2290, sun: 0xd0c0ff, band: 0.52, gas: 0.55, cloud: 0x2a1a6a, clouds: 0.1, seed: 3204 },
    bed: { sky: ['#0d081a', 'rgba(120,64,255,A)', 'rgba(60,34,130,A)', 'rgba(200,176,255,A)'], fog: 0x1c1432, hemiSky: 0xe8dcff, hemiGround: 0x5a3ab0, sun: 0xffffff, band: 0.45, gas: 0.8, cloud: 0x5a3ab0, clouds: 0.22, seed: 3205 },
    thread: { sky: ['#0a0714', 'rgba(90,42,224,A)', 'rgba(200,176,255,A)', 'rgba(26,10,48,A)'], fog: 0x17102a, hemiSky: 0xd8c8ff, hemiGround: 0x4a2aa0, sun: 0xffffff, band: 0.5, gas: 0.62, cloud: 0x3a2a80, clouds: 0.14, seed: 3206 },
  },
  kinds: [ring, boostRing, overclock, slipstream, pod, seeker, swarm, mines, wall, shuttler, spool, rail],
  scenery: [loomFloor, spools, rails, railsUnder],
  boss: null,
  beats: [
    { d: 0, tag: 'calm', what: 'rings over the woven plain; rails along both edges of the lane' },
    { d: B(7), tag: 'rising', what: 'the first shuttle, alone: one bolt weaving wide of you, its red thread drawn behind it' },
    { d: B(10), tag: 'rising', what: 'aimed weaves, one shuttle at a time, left, right, then from under the lane' },
    { d: B(17), tag: 'rising', what: 'THE WARP RAILS: weaves with walls building between them, pods, a mine field' },
    { d: B(33), tag: 'peak', what: 'drop one: pairs out of step, a swarm chain, walls' },
    { d: B(49), tag: 'calm', what: 'the breakdown; SLIPSTREAM alone in the open on the ring line' },
    { d: B(51), tag: 'peak', what: 'THE CROSS-WEAVE: across and up-and-down at once, a mesh with one hole, in slow time' },
    { d: B(53), tag: 'calm', what: 'the snap-back: rings and open space' },
    { d: B(57), tag: 'peak', what: 'build two: cross-weaves at full speed, the hardest stretch' },
    { d: B(63), tag: 'calm', what: 'OVERCLOCK on the ring line; open space before the set piece' },
    { d: B(65), tag: 'peak', what: 'THE LOOM BED: ten shuttles in a running pattern, walls building between' },
    { d: B(81), tag: 'calm', what: 'THE LAST THREAD: out along one thread of rings to the finish' },
  ],
  acts: { introduce: [0, B(25)], develop: [B(25), B(49)], twist: [B(49), B(65)], master: [B(65), END] },

  build(R, L) {
    const { add, line } = L;
    let P = [0, -0.3];
    const go = (bar, to, n = 4, step = 30, o = {}) => { line(B(bar) - (n - 1) * step, P[0], P[1], to[0], to[1], n, step, 'ring', o); P = to; };
    const W = (bar, gap, o = {}, n = 4, step = 30) => {
      const to = [clamp(gap[0], -0.85, 0.85), clamp(gap[1], -0.8, 0.8)];
      go(bar, to, n, step, { noMagnet: true }); line(B(bar) + 10, to[0], to[1], to[0], to[1], 1, 26, 'ring', { noMagnet: true });
      add(B(bar), 'g3-blueprint-wall', Object.assign({ gap }, o));
    };
    const sh = (bar, rail, o = {}) => add(B(bar), 'g3-shuttler', Object.assign({ rail }, o));
    // a pair out of step: the second shuttle's bolts land between the first's
    const pair = (bar, a, b, shots = 3, gap = 1.5) => { sh(bar, a, { shots, gap }); sh(bar, b, { shots, gap, delay: 0.35 + gap / 2 }); };
    const podAt = (bar, nx, ny, o = {}) => add(B(bar), 'pod', Object.assign({ nx, ny }, o));
    const seekerAt = (bar, o = {}) => add(B(bar - 2.6), 'seeker-drone', o);
    // THE CROSS-WEAVE: the guide holds you still while the shuttles take aim, then one ring sits in the hole as the mesh
    // arrives (the lattice centres on you, about 0.24 of the box across and 0.36 up a cell)
    const cross = (bar, hole) => {
      sh(bar, 'L', { axis: 'x', mesh: { hole, parity: 0 } }); sh(bar, 'B', { axis: 'y', mesh: { hole, parity: 1 } });
      const dV = after(bar, VOLLEY), dA = after(bar, ARRIVE);
      line(B(bar) - 60, P[0], P[1], P[0], P[1], Math.max(2, Math.floor((dV - B(bar) + 60) / 30)), 30);
      const h = [clamp(P[0] + hole[0] * 0.24, -0.9, 0.9), clamp(P[1] + hole[1] * 0.36, -0.85, 0.85)];
      L.ring(dA, h[0], h[1], 'ring', { noMagnet: true }); P = h;
    };

    // ================= ACT 1, INTRODUCE (bars 1-24) =================
    line(B(1.25), 0, -0.3, 0, 0.1, 6, 28); P = [0, 0.1];
    go(4, [0.25, 0.15], 5, 32); go(6, [0, 0.1], 5, 32);
    add(B(6.4), 'call', { text: "A SHUTTLE. WATCH ITS RED THREAD", cls: 'c-cyan' });
    sh(7, 'L', { first: true, shots: 1 });                                  // the first: one bolt weaving wide of you
    go(9, [0.2, 0], 5, 32);
    add(B(9.6), 'call', { text: 'ROLL WHERE THE THREAD CROSSES YOU', cls: 'c-cyan' });
    sh(10, 'R', { shots: 2, gap: 2.2 });                                    // now it follows you
    go(12.5, [-0.2, 0.2], 6, 32);
    sh(13, 'L', { shots: 2, gap: 2.0 });
    W(15, [0.4, -0.2, 0.36, 0.4], { lead: 1.4 });                           // the Unmade's walls again, between the weaves
    go(16, [0, 0], 3, 32);
    sh(16.5, 'B', { axis: 'y', shots: 2, gap: 2.0 });                       // up and down, from the rail under the lane
    go(18, [0, 0.3], 4, 34);
    // ---- THE WARP RAILS (bars 17-24)
    podAt(18.5, 0.7, 0.6, { bursts: 2 });
    sh(19.5, 'R', { shots: 3, gap: 1.6 });
    go(20.5, [-0.4, 0.2], 4, 34);
    W(21, [-0.45, 0.25, 0.32, 0.36]);
    add(B(22.5), 'mines', { nx: 0.35, ny: -0.3, n: 5 }); add(B(23.2), 'mines', { nx: -0.3, ny: 0.35, n: 5 });
    go(23.5, [-0.4, -0.35], 4, 34);
    sh(23.5, 'L', { shots: 2, gap: 1.6 });
    seekerAt(25, { nx: 0.4, ny: 0.55, shots: 2 });
    go(24.9, [0, 0], 4, 34);

    // ================= ACT 2, DEVELOP (bars 25-48): aimed weaves, then pairs out of step =================
    go(26.5, [0.2, 0.2], 5, 34);
    sh(26.5, 'L', { shots: 3, gap: 1.5 });
    W(28.5, [0.45, -0.3, 0.32, 0.34]);
    sh(29.5, 'R', { shots: 3, gap: 1.5 }); podAt(30, -0.75, 0.7, { bursts: 2 });
    go(31, [0, 0.2], 4, 34);
    sh(31.5, 'B', { axis: 'y', shots: 3, gap: 1.4 });
    go(32.8, [0, 0], 4, 34);
    // drop one (bar 33): pairs out of step
    pair(34, 'L', 'R', 3, 1.5);
    go(35.5, [0.3, 0.2], 6, 34); go(37, [-0.3, -0.1], 5, 34);
    W(37.5, [-0.4, 0.2, 0.3, 0.34]); podAt(37.4, 0.75, -0.72, { bursts: 2 });
    pair(38.5, 'R', 'B', 3, 1.4);
    go(40, [0, 0.3], 5, 34);
    add(B(40.5), 'swarm-unit', { n: 6, volleys: 1, aim: 'ship', side: 1 });
    go(42, [0.4, 0], 5, 34);
    W(42.5, [0.45, 0.05, 0.3, 0.34]);
    pair(43.5, 'L', 'B', 3, 1.4);
    go(45, [-0.2, 0.3], 5, 34);
    seekerAt(46.5, { nx: -0.4, ny: 0.6, shots: 3 });
    W(47, [-0.3, 0.3, 0.3, 0.32]);
    go(48.5, [0, 0], 4, 34);

    // ================= ACT 3, TWIST (bars 49-64): THE CROSS-WEAVE =================
    // SLIPSTREAM taught alone: in the open on the ring line, the cross-weave right after it; then a calm for its snap-back
    line(B(49.3), 0, 0, 0, 0, 4, 30); P = [0, 0];
    add(B(50.0), 'slipstream', { nx: 0, ny: 0 });
    add(B(50.2), 'call', { text: 'ONE SHUTTLE ACROSS, ONE UP AND DOWN. FIND THE HOLE', cls: 'c-cyan' });
    cross(51.2, [1, 1]);
    go(53.5, [0, 0], 4, 34); go(56, [0.2, 0.1], 7, 36);                     // the snap-back's calm: rings, open space
    // build two (bar 57): cross-weaves at full speed, with pods and a wall between (the hardest stretch)
    cross(57.5, [-1, 0]);
    go(59, [0, 0.2], 4, 34);
    W(59.5, [0.1, 0.3, 0.3, 0.32]); podAt(59.4, -0.75, -0.72, { bursts: 2 });
    cross(60.8, [0, -1]);
    go(62, [-0.1, 0], 3, 34);
    cross(62.3, [1, -1]);
    // OVERCLOCK on the ring line before the Loom Bed's barrage
    go(63.6, [0, 0], 3, 34);
    add(B(63.8), 'overclock', { nx: 0, ny: 0 });
    line(B(64.1), 0, 0, 0, 0.25, 4, 34); P = [0, 0.25];

    // ================= ACT 4, MASTER (bars 65-80): THE LOOM BED =================
    // ten shuttles fire a running pattern across the loom (left, right, under, round again) while walls build
    const bed = [[65.5, 'L'], [66.5, 'R'], [67.5, 'B'], [69, 'L'], [70, 'R'], [71.5, 'B'], [73, 'L'], [74.5, 'R'], [76, 'B'], [77.5, 'R']];
    for (const [bar, r] of bed) sh(bar, r, r === 'B' ? { axis: 'y', shots: 2, gap: 1.2 } : { shots: 2, gap: 1.2 });
    const path = [[0, 0.25], [0.35, 0.1], [-0.2, -0.25], [0.3, 0.3], [-0.35, 0.1], [0.1, -0.3], [-0.3, 0.3], [0.35, -0.1], [0, 0.3], [-0.2, -0.2]];
    path.forEach((p, i) => go(66 + i * 1.45, p, 4, 34));
    for (const [bar, g] of [[68.2, [0.4, -0.1]], [71, [-0.35, 0.2]], [74, [0.3, 0.3]], [77, [-0.3, -0.2]], [79.5, [0.2, 0.1]]]) {
      add(B(bar), 'g3-blueprint-wall', { gap: [g[0], g[1], 0.3, 0.32] }); L.ring(B(bar) + 10, g[0], g[1], 'ring', { noMagnet: true });
    }
    go(80.5, [0, 0], 4, 34);
    // THE LAST THREAD (bars 81-88): out along a single thread to the finish
    L.line(B(81.5), 0, 0, 0, 0.1, 4, 34, 'boost-ring', (i, n) => ({ chain: 'g3l2a', idx: i, of: n }));
    line(B(83), 0, 0.1, 0, 0.1, 30, 36); P = [0, 0.1];
  },
});
