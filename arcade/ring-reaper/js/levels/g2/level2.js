// GALAXY 2, LEVEL 2: THE SHOALS (branch g2-a). The plan's 3.2.
// Headline (rule 20): the rings swim in shoals, so chase them. A shoal is a school of ring-fish (pickups/g2-shoal) that
// swims a set path as one, the same every run; the leader's tail flicks white a second before every turn. New: the
// SHOAL and the GULPER (enemies/g2-gulper), which cuts across the lane through a shoal and splits it in two.
// PHASE is taught here (alone, named, a ring line through it), then used within two seconds: a ring trail runs into a
// coral wall's violet crack, and a cache shoal swims behind it (extras: never part of a star).
// Re-uses currents (a shoal in a current drifts with it), drifters, pods, shrikes and galaxy 2's first seekers.
// Written in BARS of its take (g2/level2/music, 133.97 bpm, 1.791 s a bar; level1/clock.js).
// Evrtek 11-08, after playing it: the gulpers glow red over the last second before they cross you (enemies/g2-gulper,
// ev.glow), and THE BAIT BALL ("just mayhem and doesn't feel good") gives way to THE SPAWNING RUN, one great shoal ridden
// home with one thing moving at a time. #g2l2-old (or ?g2l2=old; params.js) brings back the Bait Ball and no glow.
import { defineLevel, defineScenery } from '../../api.js?v=0.6.1';
import { param } from '../../params.js?v=0.6.1';
import ring from '../../pickups/ring/index.js?v=0.6.1';
import pod from '../../enemies/pod/index.js?v=0.6.1';
import shrike from '../../enemies/shrike/index.js?v=0.6.1';
import seeker from '../../enemies/seeker-drone/index.js?v=0.6.1';
import { shieldCell, phase } from '../../pickups/powerups/index.js?v=0.6.1';
import current, { simulateDrift } from '../../obstacles/g2-current/index.js?v=0.6.1';
import drifter from '../../enemies/g2-drifter/index.js?v=0.6.1';
import shoalFish from '../../pickups/g2-shoal/index.js?v=0.6.1';
import gulper from '../../enemies/g2-gulper/index.js?v=0.6.1';
import { coral, kelp, motes, reef, kelpBanks, plankton } from './level1/scenery.js?v=0.6.1';
import { shafts, wall, tree } from './level2/scenery.js?v=0.6.1';
import { musicTime, GRID } from './level1/clock.js?v=0.6.1';

const CLK = musicTime(Object.assign({ speeds: [[1, 70], [9, 78], [25, 88], [33, 100], [49, 94], [57, 108], [65, 124], [69, 136], [73, 148]] }, GRID[2]));
const B = CLK.barD;
const S1 = 0, S2 = Math.round(B(25)), S3 = Math.round(B(49)), S4 = Math.round(B(65)), END = Math.round(B(80.5));
const clock = defineScenery({ name: 'g2-l2-clock', update(s, w, dt, api) { CLK.bind(api); } });
const SCN = { 'g2-l1-reef': 1, 'g2-l1-kelp-banks': 0.8, 'g2-l1-plankton': 1, 'g2-l2-shafts': 1, 'g2-l2-tree': 1 };
const OLD = param('g2l2') === 'old';   // Evrtek's compare switch: the 11-07 level as it was (the Bait Ball, no glow)

export default defineLevel({
  g: 2, n: 2, id: 'shoals', name: 'THE SHOALS',
  idea: 'The rings swim in shoals, so chase them.',
  seed: 20202,
  length: END,
  speed: CLK.speed,
  music: { track: GRID[2].track },
  sfx: [{ id: 'g2-shoal', gain: 0.6 }, { id: 'g2-gulper-pass', gain: 0.55 }, { id: 'g2-current-in', gain: 0.5 }, { id: 'g2-sting', gain: 0.55 }, { id: 'g2-graft-crack', gain: 0.7 }],
  sections: [
    { id: 'shelf', name: 'THE SUNLIT SHELF', sub: 'SECTOR 1', d0: S1, d1: S2, scenery: SCN },
    { id: 'grounds', name: 'THE SCHOOLING GROUNDS', sub: 'SECTOR 2', d0: S2, d1: S3, scenery: Object.assign({}, SCN, { 'g2-l2-shafts': 0.7 }) },
    { id: 'split', name: 'THE SPLIT', sub: 'SECTOR 3', d0: S3, d1: S4, scenery: Object.assign({}, SCN, { 'g2-l2-shafts': 0.4, 'g2-l1-kelp-banks': 1.1, 'g2-l2-tree': 0.6 }) },
    { id: 'bait', name: OLD ? 'THE BAIT BALL' : 'THE SPAWNING RUN', sub: 'FINAL STRETCH', d0: S4, d1: END, scenery: Object.assign({}, SCN, { 'g2-l2-tree': 1, 'g2-l1-reef': 0.7 }) },
  ],
  // Yori's palette (g2/palettes.js 2): the brightest teal level, orchid light in the coral, sunlit shafts
  looks: {
    shelf: { seed: 2021, sky: ['#061626', 'rgba(31,154,128,A)', 'rgba(138,74,192,A)', 'rgba(10,74,58,A)'], fog: 0x0a2a2e, hemiSky: 0xf0fff4, hemiGround: 0x2a4a7a, sun: 0xf0fff4, sunDir: [0.2, 1, 0.3], sunPower: 2.8, hemiPower: 1.4, band: 0.5, gas: 0.85, cloud: 0x1f9a80, clouds: 0.2, starGlow: 0.6, starTint: 0xe0fff0 },
    grounds: { seed: 2022, sky: ['#08142a', 'rgba(138,74,192,A)', 'rgba(31,154,128,A)', 'rgba(10,74,58,A)'], fog: 0x0c2632, hemiSky: 0xf0fff4, hemiGround: 0x2a3a7a, sun: 0xf8f0ff, sunDir: [0.3, 1, 0.2], sunPower: 2.6, hemiPower: 1.4, band: 0.48, gas: 0.9, cloud: 0x8a4ac0, clouds: 0.24, starGlow: 0.6, starTint: 0xf0e0ff },
    split: { seed: 2023, sky: ['#05101e', 'rgba(10,74,58,A)', 'rgba(31,154,128,A)', 'rgba(90,40,130,A)'], fog: 0x08202a, hemiSky: 0xd8f0e8, hemiGround: 0x1a2a4a, sun: 0xe0f8ec, sunDir: [-0.2, 1, 0.3], sunPower: 2.1, hemiPower: 1.2, band: 0.54, gas: 0.7, cloud: 0x0a4a3a, clouds: 0.14, starGlow: 0.5, starTint: 0xe0fff0 },
    bait: { seed: 2024, sky: ['#071a2c', 'rgba(50,190,150,A)', 'rgba(138,74,192,A)', 'rgba(31,154,128,A)'], fog: 0x0c3034, hemiSky: 0xf8fff8, hemiGround: 0x2a4a7a, sun: 0xffffff, sunDir: [0.1, 1, 0.4], sunPower: 3.0, hemiPower: 1.5, band: 0.5, gas: 1.0, cloud: 0x1f9a80, clouds: 0.28, starGlow: 0.7, starTint: 0xf0fff0 },
  },
  kinds: [ring, pod, shrike, seeker, shieldCell, phase, current, drifter, shoalFish, gulper, wall, coral, kelp, motes],
  scenery: [reef, kelpBanks, plankton, shafts, tree, clock],
  beats: [
    { d: 0, tag: 'calm', what: 'rings over the sunlit shelf; the Spawning Tree far off' },
    { d: B(4), tag: 'calm', what: 'the first shoal swims straight at you down the middle, slow; nothing can hurt (the headline, taught safe)' },
    { d: B(8), tag: 'calm', what: 'a shoal that curves; then one that dives: watch the leader flick before it turns' },
    { d: B(19), tag: 'rising', what: 'PHASE, alone, a ring line through it; two seconds on, the coral wall: a ring trail runs into its violet crack' },
    { d: S2, tag: 'rising', what: 'shoals crossing currents, drifting with them; pods firing across' },
    { d: B(33), tag: 'rising', what: 'drop one: the first seeker (its curving bolt is roll-or-hit); a spiral shoal' },
    { d: B(41), tag: 'peak', what: 'a long S-shoal under pods and a seeker; a current shoal and a shrike' },
    { d: S3, tag: 'calm', what: 'the breakdown: the first gulper, alone, splits a slow shoal: pick a half' },
    { d: B(53), tag: 'rising', what: 'a gulper crosses and a Shield Cell sits in its wake: take it as the tail goes by' },
    { d: B(57), tag: 'peak', what: 'build two: gulpers through shoals, seekers and pods: the hardest stretch' },
    ...(OLD ? [
      { d: B(63), tag: 'calm', what: 'a breath before the bait ball' },
      { d: S4, tag: 'rising', what: 'THE BAIT BALL: through the middle of the swirl as gulpers strike from the sides; the shoal streams home in a corkscrew' },
    ] : [
      { d: B(63), tag: 'calm', what: 'a breath before the run home: the great shoal waits up ahead' },
      { d: S4, tag: 'rising', what: 'THE SPAWNING RUN: one great shoal, a ring-fish a beat; three times its leaders flick, it darts aside and a gulper snaps where it was (follow it), then its pair comes back (roll it)' },
      { d: B(78), tag: 'rising', what: 'the shoal glides home to the Spawning Tree' },
    ]),
  ],
  acts: { introduce: [S1, S2], develop: [S2, S3], twist: [S3, S4], master: [S4, END] },

  build(R, L) {
    const { add, ring: one, line } = L;
    const CUR = [];
    let P = [0, -0.1], shoalN = 0;
    const at = (b, x, y, o = {}) => { one(B(b), x, y, 'ring', o); P = [x, y]; };
    const go = (b, to, n = 4, step = 0.25) => { const p0 = P.slice(); for (let i = 1; i <= n; i++) { const k = i / n; at(b - (n - i) * step, p0[0] + (to[0] - p0[0]) * k, p0[1] + (to[1] - p0[1]) * k); } };
    const cur = (b0, bars, o) => { const d = B(b0); const ev = add(d, 'g2-current', Object.assign({ len: B(b0 + bars) - d, seed: Math.round(d) }, o)); CUR.push(ev); return ev; };
    // A SHOAL of n fish: its leader meets the ship on bar b, the rest follow `gap` metres apart. `keys`: where the school's
    // middle is when the ship is at each bar ([bar, nx, ny]; before b it is the swim you watch, after b the line of rings
    // you meet). o.drift: the fish carry the current's drift (laid on the carried path from P); o.split: { bar, dx, dy }:
    // a gulper crosses on that bar and the school parts round it. A small wiggle keeps it a school, not a file.
    const shoal = (b, n, gap, keys, o = {}) => {
      const id = 'S' + (++shoalN), d0 = B(b);
      const K = keys.map(([kb, x, y]) => [800 + B(kb) - d0, x, y]);
      const path = o.drift ? simulateDrift(CUR, CLK.baseSpeed, d0 - 1, d0 + n * gap + 1, P) : null;
      const base = path ? path(d0) : null;
      const split = o.split ? { p: 800 + B(o.split.bar) - d0 - 50, len: 90, dx: o.split.dx || 0, dy: o.split.dy || 0 } : undefined;
      for (let i = 0; i < n; i++) {
        let ox = 0.05 * Math.sin(i * 1.7), oy = 0.04 * Math.cos(i * 1.3);
        if (path) { const q = path(d0 + i * gap); ox += q[0] - base[0]; oy += q[1] - base[1]; }
        // the fish that meet you while the school is parted are extras: whichever half you pick, no star is lost
        const parted = o.split && Math.abs(d0 + i * gap - B(o.split.bar)) < 60;
        const extra = o.cache || parted || undefined;
        add(d0 + i * gap, 'g2-shoal', { shoal: id, idx: i, of: n, gap, keys: K, off: [ox, oy], split, cache: extra, noMagnet: extra });
      }
      const last = keys[keys.length - 1]; P = [last[1], last[2]];
      return id;
    };
    const drift = (b, nx, ny, s = 1, o = {}) => add(B(b), 'g2-drifter', Object.assign({ nx, ny, s }, o));
    const podAt = (b, nx, ny, o = {}) => add(B(b), 'pod', Object.assign({ nx, ny, drift: 0, bursts: 1, shots: 1 }, o));
    const shrikeAt = (b, side, ny, shots = 3) => add(B(b), 'shrike', { side, ny, shots });
    const seekerAt = (b, o) => add(B(b - 3.9 / CLK.barSec), 'seeker-drone', o);
    // a gulper whose body crosses the ship's plane on bar b at (cross, ny)
    // (11-08: every one glows red over its last second, swelling on the beat; not under the old switch)
    const gulp = (b, from, cross, ny, o = {}) => add(B(b), 'g2-gulper', Object.assign({ from, cross, ny, span: 220, shots: 2 }, OLD ? { glow: false } : { glow: CLK.beatSec }, o));
    const wiggle = (b0, b1, x, y, ax, ay, turns) => { const k = []; for (let b = b0, i = 0; b <= b1 + 1e-6; b += (b1 - b0) / 8, i++) k.push([b, x + Math.sin(i / 8 * Math.PI * 2 * turns) * ax, y + Math.cos(i / 8 * Math.PI * 2 * turns) * ay]); return k; };

    // ================= ACT 1, INTRODUCE: THE SUNLIT SHELF (bars 1-24) =================
    line(B(2), -0.45, -0.15, 0.45, -0.15, 5, 24); P = [0.45, -0.15];
    go(3.25, [0, 0.05], 2);
    add(B(3.5), 'call', { text: 'THE RINGS SWIM: CHASE THE SHOAL', cls: 'c-cyan' });
    shoal(4.25, 10, 26, [[1, 0, 0.1], [4.25, 0, 0.1], [6, 0, 0.12]]);                       // straight at you, slow
    shoal(8, 10, 28, [[3.5, -0.75, 0.35], [6, -0.55, 0.15], [8, -0.35, 0], [10.25, 0.45, 0.2]]); // it curves
    shoal(12, 12, 26, [[8, 0.6, 0.75], [10.5, 0.35, 0.65], [12, 0.25, 0.5], [14.25, -0.05, -0.5]]); // it dives
    go(15.5, [0.1, -0.3], 4);
    drift(16, -1.2, 0.5, 1, { drift: 0.15 });
    go(17.25, [-0.2, 0.1], 4);
    // PHASE: alone in the open, the ring line through it (the engine names it); the counted line then bends to the open
    // left; the ring trail (extras) runs on into the wall's violet crack on bar 20.1, the cache shoal behind it
    line(B(18.25), -0.2, 0.05, 0, 0, 4, (B(19) - B(18.25)) / 3); P = [0, 0];
    add(B(19), 'phase', { nx: 0, ny: 0 });
    for (let i = 0; i < 3; i++) one(B(19.35 + i * 0.25), 0.18 + i * 0.13, 0.04 + i * 0.03, 'ring', { cache: true, noMagnet: true });   // the ring trail
    add(B(20.1), 'g2-l2-wall', { side: 1, edge: -0.08, crack: [0.48, 0.1] });
    shoal(20.4, 6, 22, [[17, 0.48, 0.1], [20.4, 0.48, 0.1], [21.2, 0.4, 0.2]], { cache: true });   // behind the wall: extras
    at(19.5, -0.3, 0); at(19.75, -0.5, 0);                                                         // the open way, counted
    go(21.75, [0, -0.05], 3);
    cur(22.25, 2.5, { fx: 0.42 });
    P = [-0.45, 0.05];
    shoal(22.5, 10, 26, [[19, -0.45, 0.25], [22.5, -0.45, 0.05], [24.5, -0.4, 0.05]], { drift: true });

    // ================= ACT 2, DEVELOP: THE SCHOOLING GROUNDS (bars 25-48) =================
    // bar 25: the speed steps; nothing new for a bar (rule 6)
    go(26, [0.4, 0.1], 3);
    cur(26.25, 3, { fx: -0.45 });
    P = [0.45, 0.05];
    shoal(26.5, 12, 28, [[23, 0.6, 0.4], [26.5, 0.45, 0.05], [29, 0.4, -0.1]], { drift: true });
    podAt(27.5, -0.72, 0.6);
    shoal(30, 12, 28, wiggle(27, 32.5, 0, 0.05, 0.45, 0.25, 1.5));                               // an S
    podAt(31, 0.72, 0.62, { bursts: 2 });
    // drop one (bar 33): the speed steps; galaxy 2's first seeker, alone, its first bolt only grazing
    go(33.75, [0, 0.3], 3);
    seekerAt(35, { nx: 0.35, ny: 0.65, first: true, shots: 2 });
    shoal(35.5, 14, 26, wiggle(32, 38.25, 0, 0, 0.4, 0.35, 2));                                   // a spiral
    cur(38.75, 3, { fy: 0.38 });
    P = [0.1, -0.5];
    shoal(39, 12, 28, [[35.5, 0.2, -0.6], [39, 0.1, -0.5], [41.5, 0.05, -0.45]], { drift: true });
    drift(39.5, -1.2, 0.5, 1.1); drift(40.3, 1.25, -0.4, 0.9);
    shoal(42.5, 16, 28, wiggle(39, 46, 0, 0.1, 0.5, 0.3, 2));                                     // a long S under fire
    podAt(43, -0.72, 0.62, { bursts: 2, shots: 2 }); podAt(44.5, 0.72, 0.6, { bursts: 1, shots: 2 });
    seekerAt(45, { nx: -0.4, ny: 0.66, shots: 2 });
    shrikeAt(46.5, 1, 0.5);
    go(48.25, [0, 0], 4);

    // ================= ACT 3, TWIST: THE SPLIT (bars 49-64) =================
    add(B(49.5), 'call', { text: 'A GULPER: PICK A SIDE', cls: 'c-cyan' });
    shoal(50, 14, 26, [[46, 0, 0.05], [50, 0, 0.05], [53, 0, 0.05]], { split: { bar: 51, dy: 0.55 } });
    gulp(51, 1, 0, 0.05);                                                                          // alone, through the middle
    go(52.5, [0.3, -0.2], 3);
    // a gulper crosses at (0.3, -0.2) on bar 53, and the Shield Cell sits in its wake: take it as the tail goes by
    gulp(53, -1, 0.3, -0.2);
    add(B(53) + 45, 'shield-cell', { nx: 0.3, ny: -0.2 });
    at(53.5, 0.2, -0.1); go(55.5, [0, 0.1], 4);
    // build two: gulpers through shoals, seekers and pods: the hardest stretch
    shoal(57.5, 14, 26, wiggle(54, 61, 0, 0, 0.35, 0.2, 1), { split: { bar: 58.5, dx: 0.5 } });
    gulp(58.5, 1, 0.05, 0.0, { shots: 2 });
    seekerAt(59, { nx: 0.5, ny: 0.62, shots: 2 });
    podAt(60, -0.72, 0.62, { bursts: 2, shots: 1 });
    shoal(61, 12, 26, [[57, 0.4, 0.4], [61, 0.2, 0.3], [63, -0.2, -0.1]], { split: { bar: 62, dy: 0.55 } });
    gulp(62, -1, -0.05, 0.1);
    seekerAt(62.5, { nx: -0.5, ny: 0.66, shots: 2 });
    go(64.25, [0, -0.05], 4);

    if (OLD) {
      // ================= ACT 4, MASTER: THE BAIT BALL (bars 65-80), as it was to 11-07 (#g2l2-old) =================
      // hundreds of ring-fish swirl round the lane (decor: they do not count and never collide); a counted line runs
      // through the middle as gulpers strike from the sides; then the shoal streams home in a corkscrew to the finish
      for (let i = 0; i < 160; i++) {
        const b = 66.5 + R() * 5.5;
        add(B(b), 'g2-shoal', { decor: true, idx: 0, of: 0, orbit: { r: R.range(1.45, 2.4), w: R.range(0.6, 1.3) * R.sign(), a0: R() * Math.PI * 2 } });
      }
      go(66.5, [0, 0], 4);
      for (let b = 66.75; b <= 72; b += 0.25) { const a = (b - 66.75) * Math.PI * 0.8; at(b, Math.sin(a) * 0.18, Math.cos(a) * 0.14); }
      gulp(68.5, 1, 0.6, 0.5); gulp(70.25, -1, -0.6, -0.5); gulp(71.5, 1, 0.62, -0.45);
      // the corkscrew home: one long shoal, one turn every three bars
      const ck = []; for (let b = 69; b <= 80.25; b += 0.25) { const a = (b - 72.5) * Math.PI * 2 / 3; ck.push([b, Math.sin(a) * 0.32, Math.cos(a) * 0.26]); }
      shoal(72.5, 30, (B(80) - B(72.5)) / 29, ck);
      return;
    }
    // ================= ACT 4, MASTER: THE SPAWNING RUN (bars 65-80) =================
    // One great shoal ridden home to the Spawning Tree, a ring-fish on every beat, and one thing moving at a time. It
    // wheels in to meet you; then, three times, it holds its line, its leaders' tails flick white, and it DARTS aside
    // (half a bar), and a gulper, glowing red, snaps through the spot it just left a quarter bar later: follow the
    // shoal and the gulper misses you. It holds its new line while that gulper's pair comes back at you (roll it home),
    // and about a second after the pair the next flick comes. Then it glides home to the finish. Every fish counts.
    // Every dart is UP or DOWN, 0.58 of the box: the gulper's body lies across the lane, 6 m long, so a sideways dart
    // would leave a phone's narrow box (4.1 m) no room; 0.58 clears its reach by 0.9 m on a wide screen, 1.6 m on a phone.
    // It is five schools in a row on ONE path: each takes the same keys, so at any moment they all sit where the path
    // says and swim as one column, and a fresh leader is always just ahead to flick before each dart (a SHOAL! each).
    go(66.5, [0, 0], 4);
    add(B(65.5), 'call', { text: 'ONE BIG SHOAL: RIDE IT HOME', cls: 'c-cyan' });
    // [bar, nx, ny]: it waits up and to the right; wheels in to meet you; sweeps up-left; darts DOWN (strike 1 on bar 69.5
    // where it was); darts UP and right (strike 2 on 72.75); darts DOWN (strike 3 on 76); then glides home to the tree
    const P1 = [-0.4, 0.3], P2 = [-0.4, -0.28], P3 = [0.35, 0.3], P4 = [0.35, -0.28];
    const RUN = [[61, 0.5, 0.35], [65.5, 0.5, 0.35], [67, 0, 0.05], [68.25, ...P1], [68.75, ...P1], [69.25, ...P2], [72, ...P2], [72.5, ...P3],
      [75.25, ...P3], [75.75, ...P4], [78, ...P4], [80.25, 0, 0.15]];
    // a school of fish on the beats from bar b0 to b1 (a quarter bar apart)
    const school = (b0, b1) => { const n = Math.round((b1 - b0) * 4) + 1; shoal(b0, n, (B(b1) - B(b0)) / (n - 1), RUN); };
    school(67, 68.5);                                 // the wheel in and the sweep
    school(68.75, 71.75); gulp(69.5, 1, ...P1);       // dart down; strike 1 from the right, where it was (its pair ~71.4)
    school(72, 75); gulp(72.75, -1, ...P2);           // dart up-right; strike 2 from the left (pair ~74.7)
    school(75.25, 77.75); gulp(76, 1, ...P3);         // dart down; strike 3 from the right (pair ~78)
    school(78, 80);                                   // home
  },
});
