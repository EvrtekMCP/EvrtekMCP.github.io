// GALAXY 3, LEVEL 1: THE SCAFFOLD (the plan's 4.1). The Unmade's front door: a yard of scaffolds where walls are
// built in the lane as you fly at them. Its one idea: a blueprint shows where each wall will stand, gap and all, and
// the plan never lies. The new obstacle is the BLUEPRINT WALL (js/obstacles/g3-blueprint-wall). Everything else is
// galaxy 1's cast, copied by the Unmade: rings, boost rings, pods, shrikes, seekers, snipers.
// Written in BARS of its track (g3/level1/music, 140 bpm, hardgroove; level1/time.js turns bars into metres), so walls,
// speed steps and the set piece land on bar lines (rule 30).
//   Act 1 INTRODUCE  bars 1-24   one wall at a time, built slowly, huge gaps with rings in them
//   Act 2 DEVELOP    bars 25-48  walls in sequence, the gaps moving, pods on the scaffolds; RING MAGNET, PHASE
//   Act 3 TWIST      bars 49-64  REVISIONS: a plan changes once, 1.2 s before its build, and the gap moves; SHIELD CELL
//   Act 4 MASTER     bars 65-88  THE FRAMEWORK: the plan of a whole tower builds round you, a ring corkscrew up its core
import { defineLevel, clamp } from '../../api.js?v=0.6.2';
import ring from '../../pickups/ring/index.js?v=0.6.2';
import boostRing from '../../pickups/boost-ring/index.js?v=0.6.2';
import { shieldCell, phase, ringMagnet } from '../../pickups/powerups/index.js?v=0.6.2';
import pod from '../../enemies/pod/index.js?v=0.6.2';
import shrike from '../../enemies/shrike/index.js?v=0.6.2';
import seeker from '../../enemies/seeker-drone/index.js?v=0.6.2';
import sniper from '../../enemies/sniper/index.js?v=0.6.2';
import wall from '../../obstacles/g3-blueprint-wall/index.js?v=0.6.2';
import { tower, towers, floor, floors, grid, halfStar } from './level1/scenery.js?v=0.6.2';
import { timeline } from './level1/time.js?v=0.6.2';

// audio/g3/level1/music.json (take g3l1-t1): the kick grid fitted to the take
const TL = timeline({ name: 'g3/level1/music', bpm: 140.004, firstBeat: 0.1542, barSec: 1.71424 },
  [[1, 72], [9, 82], [17, 90], [25, 98], [33, 110], [49, 102], [57, 114], [65, 126], [73, 136], [81, 150]]);
const B = TL.barD;
const END = Math.round(B(88.5));

export default defineLevel({
  g: 3, n: 1, id: 'scaffold', name: 'THE SCAFFOLD',
  idea: 'A blueprint shows where each wall will stand.',
  seed: 300101,
  length: END,
  speed: TL.speed,
  boostMul: 1.4,
  // style minimums [grazes + close calls, deflects] for A, S and DEGENERATE: from the decent human bot (3 seeds: about 15
  // and 24 a run), a quarter, 40% and 60% of that (LEVEL-API 12.6)
  // DEGENERATE (CLU-I2, the MCP 11-07): the decent bot ran 93-97% of the rings (the 95% gate is no guard here), so its deflects
  // must fall short: its best was 25; the good bot with power-ups off had 33 and 33
  style: { A: [4, 6], S: [6, 10], DEGENERATE: [9, 26] },
  music: { track: 'g3/level1/music' },
  bossMusic: null,
  sfx: [{ id: 'g3-blueprint', gain: 0.6 }, { id: 'g3-build', gain: 0.55 }],
  sections: [
    { id: 'yard', name: 'THE BLUEPRINT YARD', sub: 'SECTOR 1', d0: 0, d1: B(17), look: 'yard', scenery: { 'g3-l1-towers': 0.8, 'g3-l1-grid': 1, 'g3-l1-halfstar': 1 } },
    { id: 'gantries', name: 'THE GANTRIES', sub: 'SECTOR 2', d0: B(17), d1: B(33), look: 'gantries', scenery: { 'g3-l1-towers': 1, 'g3-l1-grid': 1, 'g3-l1-halfstar': 1 } },
    { id: 'rising', name: 'THE RISING FRAMES', sub: 'SECTOR 3', d0: B(33), d1: B(49), look: 'rising', scenery: { 'g3-l1-towers': 1, 'g3-l1-grid': 0.8, 'g3-l1-halfstar': 0.7 } },
    { id: 'revisions', name: 'REVISIONS', sub: 'SECTOR 4', d0: B(49), d1: B(65), look: 'revisions', scenery: { 'g3-l1-towers': 0.9, 'g3-l1-grid': 1, 'g3-l1-halfstar': 1 } },
    { id: 'framework', name: 'THE FRAMEWORK', sub: 'SECTOR 5', d0: B(65), d1: B(81), look: 'framework', scenery: { 'g3-l1-towers': 0.35, 'g3-l1-floors': 1, 'g3-l1-grid': 0.6, 'g3-l1-halfstar': 1 } },
    { id: 'crown', name: 'THE CROWN', sub: 'FINAL STRETCH', d0: B(81), d1: END, look: 'crown', scenery: { 'g3-l1-towers': 0.9, 'g3-l1-grid': 1, 'g3-l1-halfstar': 1 } },
  ],
  // Yori's palette (art-incoming/yori/g3/g3-palettes.js, level 1): sky 08080c, gas 6a3aff / 2a2438 / 8a94a8, fog 14121e,
  // key e8eeff, fill 3a2a6a. Ultraviolet is large, soft and dim; steel and blueprint white carry the light.
  looks: {
    yard: { sky: ['#08080c', 'rgba(106,58,255,A)', 'rgba(42,36,56,A)', 'rgba(138,148,168,A)'], fog: 0x14121e, hemiSky: 0xe8eeff, hemiGround: 0x3a2a6a, sun: 0xe8eeff, band: 0.5, gas: 0.55, cloud: 0x2a2438, clouds: 0.14, seed: 3101, starGlow: 0.85 },
    gantries: { sky: ['#08080d', 'rgba(106,58,255,A)', 'rgba(60,52,84,A)', 'rgba(138,148,168,A)'], fog: 0x15131f, hemiSky: 0xe8eeff, hemiGround: 0x3a2a6a, sun: 0xf0f4ff, band: 0.48, gas: 0.6, cloud: 0x3a3450, clouds: 0.16, seed: 3102 },
    rising: { sky: ['#09080f', 'rgba(120,70,255,A)', 'rgba(42,36,56,A)', 'rgba(160,168,190,A)'], fog: 0x171424, hemiSky: 0xf4f6ff, hemiGround: 0x40307a, sun: 0xffffff, band: 0.46, gas: 0.7, cloud: 0x4a3a80, clouds: 0.2, seed: 3103 },
    revisions: { sky: ['#07070b', 'rgba(90,50,220,A)', 'rgba(36,30,48,A)', 'rgba(120,128,150,A)'], fog: 0x12101b, hemiSky: 0xd8e0ff, hemiGround: 0x2a2050, sun: 0xe0e8ff, band: 0.52, gas: 0.5, cloud: 0x2a2438, clouds: 0.1, seed: 3104 },
    framework: { sky: ['#0a0912', 'rgba(130,80,255,A)', 'rgba(70,60,100,A)', 'rgba(216,200,255,A)'], fog: 0x191628, hemiSky: 0xffffff, hemiGround: 0x4a3a8a, sun: 0xffffff, band: 0.45, gas: 0.8, cloud: 0x5a4aa0, clouds: 0.22, seed: 3105 },
    crown: { sky: ['#08080c', 'rgba(106,58,255,A)', 'rgba(216,200,255,A)', 'rgba(138,148,168,A)'], fog: 0x14121e, hemiSky: 0xe8eeff, hemiGround: 0x3a2a6a, sun: 0xffffff, band: 0.5, gas: 0.65, cloud: 0x3a3450, clouds: 0.15, seed: 3106 },
  },
  kinds: [ring, boostRing, shieldCell, phase, ringMagnet, pod, shrike, seeker, sniper, wall, tower, floor],
  scenery: [towers, floors, grid, halfStar],
  boss: null,
  beats: [
    { d: 0, tag: 'calm', what: 'rings in the open over the yard; the half-built star on the horizon' },
    { d: B(7), tag: 'rising', what: 'the first blueprint wall, alone: its plan in white, built slowly, a huge gap with rings in it' },
    { d: B(11), tag: 'rising', what: 'walls one at a time, the gap a different side each time; the first pods' },
    { d: B(17), tag: 'rising', what: 'THE GANTRIES: snipers perched on the towers, a boost chain, shrikes' },
    { d: B(26), tag: 'calm', what: 'RING MAGNET alone in the open; then a scaffold blown apart, its rings scattered in the struts' },
    { d: B(33), tag: 'peak', what: 'drop one: walls in sequence, a bar apart, the gap walking across the lane; pods on the scaffolds' },
    { d: B(41), tag: 'calm', what: 'PHASE, and a wall with a violet-cracked panel and a ring trail running into it: a cache behind' },
    { d: B(43), tag: 'peak', what: 'walls and snipers together, seekers holding station' },
    { d: B(49), tag: 'calm', what: 'REVISIONS: the breakdown; one wall, its plan changes once, the gap moves' },
    { d: B(57), tag: 'peak', what: 'build two: revisions with pods on the scaffolds, the hardest stretch' },
    { d: B(63), tag: 'calm', what: 'SHIELD CELL on the ring line; two bars of open space before the set piece' },
    { d: B(65), tag: 'peak', what: 'THE FRAMEWORK: a tower builds round you, walls up its core, a ring corkscrew through them' },
    { d: B(81), tag: 'calm', what: 'THE CROWN: out of the top of the tower at full speed, the star lit ahead' },
  ],
  acts: { introduce: [0, B(25)], develop: [B(25), B(49)], twist: [B(49), B(65)], master: [B(65), END] },

  build(R, L) {
    const { add, line } = L;
    let P = [0, -0.3];                                   // where the guiding rings last left the ship
    // n rings from P to `to`, the last one on bar `bar` (step metres apart)
    const go = (bar, to, n = 4, step = 28, o = {}) => { line(B(bar) - (n - 1) * step, P[0], P[1], to[0], to[1], n, step, 'ring', o); P = to; };
    // a wall on bar `bar`; rings lead into its gap and one sits just through it (never pulled through a wall)
    const W = (bar, gap, o = {}, n = 4, step = 30) => {
      const g = o.revise || gap, to = [clamp(g[0], -0.85, 0.85), clamp(g[1], -0.8, 0.8)];
      if (o.revise) { go(bar - 1.0, [gap[0] * 0.5, gap[1] * 0.5], n, step); line(B(bar) + 8, to[0], to[1], to[0], to[1], 2, 26, 'ring', { noMagnet: true }); P = to; }
      else { go(bar, to, n, step, { noMagnet: true }); line(B(bar) + 10, to[0], to[1], to[0], to[1], 1, 26, 'ring', { noMagnet: true }); }
      add(B(bar), 'g3-blueprint-wall', Object.assign({ gap }, o));
    };
    const podAt = (bar, nx, ny, o = {}) => add(B(bar), 'pod', Object.assign({ nx, ny }, o));
    const perch = (bar, nx, ny, o = {}) => { add(B(bar), 'g3-l1-tower', { nx, ny, v: 1, s: 0.42, dy: 9.4, yaw: R.range(0, 6) }); add(B(bar), 'sniper', Object.assign({ nx, ny }, o)); };
    const seekerAt = (bar, o = {}) => add(B(bar - 2.6), 'seeker-drone', o);
    const shrikes = (bar, ny, side = 1) => { add(B(bar), 'shrike', { side, ny, shots: 3 }); };

    // ================= ACT 1, INTRODUCE (bars 1-24): one wall at a time =================
    line(B(1.25), 0, -0.3, 0, 0.1, 6, 26); P = [0, 0.1];
    go(4, [0.3, 0.2], 5, 30); go(5.5, [0, 0.1], 4, 30);
    add(B(5.25), 'call', { text: 'THE WHITE LINES ARE THE PLAN. FLY THE GAP', cls: 'c-cyan' });
    W(7, [0, 0.05, 0.6, 0.55], { lead: 2.0 }, 5, 30);                     // the first: built slowly, most of the lane open
    go(8.5, [-0.2, 0], 4, 30);
    W(9.5, [-0.5, 0, 0.36, 0.42], { lead: 2.0 });                         // the gap to the left
    podAt(11.5, 0.4, 0.55, { bursts: 1 });                                // the first pod, alone, high on the right
    go(11.5, [-0.1, -0.2], 4, 30);
    W(12.5, [0.45, 0.35, 0.34, 0.38], { lead: 1.8 });                     // up and right
    podAt(13.5, -0.55, -0.5, { bursts: 1 });
    go(14, [0.1, 0.1], 4, 30);
    podAt(14.5, -0.6, 0.5, { bursts: 2 }); podAt(14.6, 0.6, -0.4, { bursts: 2 });
    W(15.5, [-0.4, -0.42, 0.34, 0.34], { lead: 1.4 });                    // down and left: now it is known, it builds faster
    go(17, [0, 0], 4, 30);

    // ---- THE GANTRIES (bars 17-24): snipers on the towers, a boost chain, shrikes
    perch(18, 1.3, 0.35, { at: 2.8 }); go(18.5, [-0.3, 0.2], 4, 30);
    W(19.5, [-0.35, 0.3, 0.3, 0.34]);
    L.line(B(20.25), -0.35, 0.3, 0.35, -0.2, 5, 30, 'boost-ring', (i, n) => ({ chain: 'g3l1a', idx: i, of: n })); P = [0.35, -0.2];
    podAt(21, -0.7, -0.6, { bursts: 2 }); podAt(21.2, 0.7, 0.65, { bursts: 2 });
    shrikes(22, 0.55, 1); go(22.5, [0.2, -0.3], 4, 32);
    seekerAt(24.5, { nx: 0.45, ny: 0.55, shots: 2 });
    W(23.5, [0.5, -0.3, 0.3, 0.36]);
    perch(24, -1.3, 0.5, { at: 2.8 }); go(24.75, [0, 0], 4, 32);

    // ================= ACT 2, DEVELOP (bars 25-48) =================
    // bar 25: the speed steps; nothing new for a bar (rule 6). RING MAGNET alone in the open, a ring line through it,
    // then a scaffold blown apart, its rings scattered in the struts (every one in reach without it)
    go(26, [0, 0.1], 5, 30);
    add(B(26.3), 'ring-magnet', { nx: 0, ny: 0.1 });
    { let x = 0, y = 0.1; for (let i = 0; i < 16; i++) { x = clamp(x + R.range(-0.4, 0.4), -0.8, 0.8); y = clamp(y + R.range(-0.35, 0.35), -0.7, 0.75); L.ring(B(27) + i * 44, x, y); } P = [x, y]; }
    for (let i = 0; i < 7; i++) add(B(27) + i * 95, 'g3-l1-tower', { nx: R.sign() * R.range(1.5, 2.6), ny: R.range(-1.5, 1.5), v: R.int(0, 1), s: R.range(0.5, 0.8), yaw: R.range(0, 6), lie: R() < 0.5 });
    W(31.5, [P[0] * 0.6, P[1] * 0.6, 0.34, 0.36]);
    podAt(30, -0.8, 0.7, { bursts: 2 });
    podAt(31.4, 0.75, 0.72, { bursts: 2 }); podAt(31.4, -0.75, -0.7, { bursts: 2 });                    // pods on the scaffold, either side of the gap
    seekerAt(32.5, { nx: -0.4, ny: 0.5, shots: 3 });
    go(32.75, [0, 0], 4, 32);
    // drop one (bar 33): the speed steps; walls a bar apart, the gap walking across the lane, pods on the scaffolds
    const walk = [[-0.55, 0.3], [-0.1, -0.35], [0.4, 0.25], [0.55, -0.4], [0, 0.45]];
    walk.forEach(([x, y], j) => {
      const bar = 34 + j;
      W(bar, [x, y, 0.3, 0.32], {}, 3, 32);
      podAt(bar - 0.05, clamp(-x * 1.3, -0.8, 0.8), clamp(-y * 1.6, -0.8, 0.8), { bursts: j % 2 ? 1 : 2, shots: j === 4 ? 2 : 1 });
    });
    shrikes(37.5, 0.6, -1); shrikes(38.5, -0.4, 1);
    seekerAt(39.5, { nx: 0.3, ny: 0.6, shots: 2 });
    go(40, [0, 0], 5, 34);
    // a breath, then PHASE, and the cracked wall: a ring trail runs into the violet crack, the cache is behind it
    add(B(40.9), 'phase', { nx: 0, ny: 0 });
    line(B(41.2), 0, 0, -0.45, 0.1, 5, 30); P = [-0.45, 0.1];
    { const crack = [0.6, -0.5], d = B(42.6);
      line(d - 150, 0.2, -0.2, crack[0], crack[1], 3, 32, 'ring', { cache: true });   // the ring trail: the way goes in
      line(d + 4, crack[0], crack[1], crack[0], crack[1], 5, 9, 'ring', { cache: true }); // the cache, right behind the panel
      W(42.6, [-0.5, 0.15, 0.3, 0.36], { crack, lead: 1.4 }, 3, 32); }
    perch(44, 1.3, -0.3, { at: 2.8 }); perch(44.5, -1.3, 0.6, { at: 2.8 });
    go(44.25, [0.1, 0.3], 4, 34);
    W(45, [0.2, 0.3, 0.28, 0.3]); podAt(45, -0.75, -0.7, { bursts: 2, shots: 2 });
    seekerAt(46.5, { nx: 0.5, ny: 0.6, shots: 3 });
    W(46.5, [-0.4, -0.3, 0.28, 0.3]); podAt(47.6, -0.7, 0.72, { bursts: 2 });
    go(47.5, [0.4, 0.1], 3, 34);
    W(48, [0.45, 0.2, 0.28, 0.32]);

    // ================= ACT 3, TWIST (bars 49-64): REVISIONS =================
    go(49.5, [0, 0], 4, 34);
    add(B(49.6), 'call', { text: 'WATCH THE PLAN. IT CAN CHANGE', cls: 'c-cyan' });
    W(51.5, [-0.45, 0.1, 0.4, 0.45], { revise: [0.5, -0.1, 0.4, 0.45], lead: 2.0 });  // the first revision: big gaps, slow
    podAt(52.5, 0.7, 0.7, { bursts: 2 }); podAt(53, -0.7, -0.65, { bursts: 2 });
    go(53.5, [0, 0], 4, 34);
    seekerAt(55.5, { nx: 0, ny: 0.7, shots: 2 });
    W(55, [0.4, 0.4, 0.34, 0.36], { revise: [-0.4, -0.35, 0.34, 0.36], lead: 1.8 });
    go(56.75, [0, 0], 4, 34);
    // build two (bar 57): the speed steps; revisions with pods on the scaffolds, the hardest stretch
    W(58, [-0.5, -0.3, 0.28, 0.3], { revise: [0.45, 0.35, 0.28, 0.3] });
    podAt(58, -0.7, 0.7, { bursts: 2 }); podAt(58.2, 0.75, -0.7, { bursts: 2 });
    shrikes(59.5, -0.5, -1);
    W(60, [0.1, 0.4, 0.26, 0.28]); perch(60, 1.3, -0.2, { at: 2.8 });
    W(61, [0.4, -0.35, 0.28, 0.3], { revise: [-0.45, 0.2, 0.28, 0.3] });
    podAt(61, 0.75, 0.72, { bursts: 2, shots: 2 }); podAt(61, -0.2, -0.75, { bursts: 2 });
    seekerAt(62.5, { nx: 0, ny: 0.65, shots: 3 });
    W(62.5, [0, -0.4, 0.28, 0.3]);
    // SHIELD CELL after the revisions, on the ring line; then two bars of open space (rule 3)
    go(63.6, [0, 0], 4, 34);
    add(B(63.8), 'shield-cell', { nx: 0, ny: 0 });
    line(B(64.1), 0, 0, 0, 0.35, 5, 34); P = [0, 0.35];

    // ================= ACT 4, MASTER (bars 65-88): THE FRAMEWORK =================
    // the floors of a tower stream round you (scenery); a ring corkscrew climbs its core, and walls are built across
    // the core with their gaps on the corkscrew: read each plan, keep to the spiral
    const lap = 16, step = 30, d0 = B(65.5), rx = 0.55, ry = 0.5;
    const spiral = (d) => { const a = (d - d0) / (lap * step) * Math.PI * 2; return [Math.sin(a) * rx, Math.cos(a) * ry]; };
    for (let d = d0; d < B(80.5); d += step) { const [x, y] = spiral(d); L.ring(d, x, y, 'ring', { noMagnet: true }); }
    for (const bar of [67, 69, 71, 72.5, 74, 75.5, 77, 78.5]) {
      const d = B(bar), [x, y] = spiral(d);
      add(d, 'g3-blueprint-wall', { gap: [x, y, 0.26, 0.29] });
    }
    podAt(68, 0.8, -0.75, { bursts: 2 }); podAt(70, -0.8, 0.75, { bursts: 2 }); podAt(72, 0.8, 0.75, { bursts: 2 }); perch(73, 1.3, 0.4, { at: 2.8 });
    seekerAt(75, { nx: -0.3, ny: 0.65, shots: 3 }); podAt(76, 0.8, -0.75, { bursts: 2, shots: 2 }); podAt(78, -0.8, -0.75, { bursts: 2 }); perch(79, -1.3, -0.4, { at: 2.8 });
    P = spiral(B(80.5));
    // THE CROWN (bars 81-88): out of the top of the tower at full speed; one last wall, then the rings home
    go(82, [0, 0.2], 5, 36);
    L.line(B(82.5), 0, 0.2, 0, -0.3, 6, 34, 'boost-ring', (i, n) => ({ chain: 'g3l1b', idx: i, of: n })); P = [0, -0.3];
    podAt(83.5, -0.75, 0.7, { bursts: 2 }); podAt(83.7, 0.75, -0.7, { bursts: 2 });
    W(85, [0.35, 0.1, 0.32, 0.36], {}, 4, 36);
    shrikes(86, 0.5, -1);
    go(87, [-0.2, 0], 5, 36); go(88.2, [0, 0], 3, 36);
  },
});
