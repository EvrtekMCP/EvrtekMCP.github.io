// GALAXY 2, LEVEL 3: THE DRUMREEF, boss THE WHIRLMAW (branch g2-a). The plan's 3.3.
// Headline (rule 20): roll through a pulse just as it meets you. The THRUMMER (enemies/g2-thrummer) beats on a bar line
// and its pulse, a red ring-wall, meets you on the next: fly through its hole, or roll as it meets you for PARRY!, and
// its echo runs home and frees the drum. The roll becomes a timed parry, not only a deflect.
// Re-uses currents, shoals, gulpers, pods, seekers and mines. The boss is THE WHIRLMAW (bosses/g2-whirlmaw): the arena
// pulls you, and its distance is its health.
// Written in BARS of its take (g2/level3/music, 136.02 bpm, 1.764 s a bar; level3/time.js): the take keeps its kick
// through every build and breakdown (the sound branch's beat-locked track), so every pulse sits on the grid. Holes open
// on the box's axes (right, up, left, down), so a ring in one is in it on a wide screen and a phone alike.
import { defineLevel, defineScenery } from '../../api.js?v=0.6.4';
import ring from '../../pickups/ring/index.js?v=0.6.4';
import pod from '../../enemies/pod/index.js?v=0.6.4';
import seeker from '../../enemies/seeker-drone/index.js?v=0.6.4';
import mines from '../../obstacles/mines/index.js?v=0.6.4';
import { shieldCell, overclock } from '../../pickups/powerups/index.js?v=0.6.4';
import current from '../../obstacles/g2-current/index.js?v=0.6.4';
import shoalFish from '../../pickups/g2-shoal/index.js?v=0.6.4';
import gulper from '../../enemies/g2-gulper/index.js?v=0.6.4';
import thrummer, { pulse } from '../../enemies/g2-thrummer/index.js?v=0.6.4';
import whirlmaw, { maw } from '../../bosses/g2-whirlmaw/index.js?v=0.6.4';
import { coral, motes, reef, plankton } from './level1/scenery.js?v=0.6.4';
import { shafts, drumCoral, cliff, drums, cliffs, heart } from './level3/scenery.js?v=0.6.4';
import { CLK } from './level3/time.js?v=0.6.4';
import { GRID } from './level1/clock.js?v=0.6.4';

const B = CLK.barD;
const BOSS_AT = Math.round(B(84.75));                // a beat before bar 85: the Whirlmaw's take cuts in on bar 85's line
const LENGTH = BOSS_AT + 900;
const S1 = 0, S2 = Math.round(B(25)), S3 = Math.round(B(49)), S4 = Math.round(B(65)), S5 = Math.round(B(79));
const clock = defineScenery({ name: 'g2-l3-clock', update(s, w, dt, api) { CLK.bind(api); } });
const SCN = { 'g2-l3-cliffs': 1, 'g2-l3-drums': 1, 'g2-l1-plankton': 0.8, 'g2-l3-shafts': 1, 'g2-l1-reef': 0.5 };
// the four holes: right, up, left, down (radians); w: one of Yori's three pulse rings (1.2, 1.7, 2.3)
const R_ = 0, U_ = Math.PI / 2, L_ = Math.PI, D_ = -Math.PI / 2;

export default defineLevel({
  g: 2, n: 3, id: 'drumreef', name: 'THE DRUMREEF',
  idea: 'Roll through a pulse just as it meets you.',
  seed: 20303,
  length: LENGTH,
  speed: CLK.speed,
  music: { track: GRID[3].track },
  bossMusic: GRID.whirlmaw.track,
  // style from its decent human bot (11-06: close calls and grazes 5-13, deflects 40-45 a run, the parries counting):
  // A about a quarter, S 40 %, DEGENERATE 60 %, as galaxy 1's were sized
  // DEGENERATE (MCP ruling 11-07): the decent bot ran 94-96% of the rings (the 95% gate is no guard here), so its deflects
  // must fall short: its best was 44; the good bot with power-ups off had 47 and 53
  style: { A: [2, 10], S: [3, 16], DEGENERATE: [5, 45] },
  sfx: [{ id: 'g2-thrum', gain: 0.55 }, { id: 'g2-pulse', gain: 0.6 }, { id: 'g2-parry', gain: 0.7 }, { id: 'g2-graft-crack', gain: 0.7 }, { id: 'g2-gulper-pass', gain: 0.5 },
    { id: 'g2-whirlmaw-inhale', gain: 0.7 }, { id: 'g2-boss-freed', gain: 1 }, { id: 'boss-warning', gain: 0.61 }, { id: 'boss-hit', gain: 1 }, { id: 'boss-phase', gain: 0.65 }],
  sections: [
    { id: 'outer', name: 'THE OUTER REEF', sub: 'SECTOR 1', d0: S1, d1: S2, scenery: Object.assign({}, SCN, { 'g2-l3-cliffs': 0.6, 'g2-l1-reef': 1 }) },
    { id: 'drumline', name: 'THE DRUMLINE', sub: 'SECTOR 2', d0: S2, d1: S3, scenery: SCN },
    { id: 'skin', name: 'THE SILENT SKIN', sub: 'SECTOR 3', d0: S3, d1: S4, scenery: Object.assign({}, SCN, { 'g2-l3-shafts': 0.5 }) },
    { id: 'heart', name: "THE REEF'S HEART", sub: 'SECTOR 4', d0: S4, d1: S5, scenery: Object.assign({}, SCN, { 'g2-l3-heart': 1, 'g2-l3-drums': 1.3 }) },
    { id: 'maw', name: 'THE DARKENING', sub: 'FINAL APPROACH', d0: S5, d1: LENGTH, scenery: Object.assign({}, SCN, { 'g2-l3-heart': (t) => 1 - t, 'g2-l3-shafts': 0.15, 'g2-l3-drums': 0.6, 'g2-l3-cliffs': 0.35 }) },
  ],
  // Yori's palette (g2/palettes.js 3): ochre and rust reef against dark water, a warm key; the red skins on the drums are the
  // only red. The water darkens before the Whirlmaw.
  looks: {
    outer: { seed: 2031, sky: ['#0a0a14', 'rgba(138,90,42,A)', 'rgba(31,106,90,A)', 'rgba(58,26,74,A)'], fog: 0x1a1410, hemiSky: 0xffe8c0, hemiGround: 0x1e4a3a, sun: 0xffe8c0, sunDir: [0.4, 1, 0.3], sunPower: 2.6, hemiPower: 1.2, band: 0.5, gas: 0.7, cloud: 0x8a5a2a, clouds: 0.16, starGlow: 0.5, starTint: 0xfff0d8 },
    drumline: { seed: 2032, sky: ['#0b0a12', 'rgba(150,96,46,A)', 'rgba(58,26,74,A)', 'rgba(31,106,90,A)'], fog: 0x1c1610, hemiSky: 0xffe8c0, hemiGround: 0x2a3a2a, sun: 0xfff0d0, sunDir: [0.5, 1, 0.2], sunPower: 2.8, hemiPower: 1.2, band: 0.48, gas: 0.8, cloud: 0x7a4e26, clouds: 0.2, starGlow: 0.5, starTint: 0xfff0d8 },
    skin: { seed: 2033, sky: ['#080810', 'rgba(58,26,74,A)', 'rgba(110,72,36,A)', 'rgba(31,106,90,A)'], fog: 0x140f0c, hemiSky: 0xe8d8b8, hemiGround: 0x1a2a22, sun: 0xf0dcb8, sunDir: [-0.3, 1, 0.3], sunPower: 2.2, hemiPower: 1.0, band: 0.54, gas: 0.6, cloud: 0x3a1a4a, clouds: 0.12, starGlow: 0.4, starTint: 0xfff0d8 },
    heart: { seed: 2034, sky: ['#0c0a12', 'rgba(170,110,52,A)', 'rgba(31,106,90,A)', 'rgba(58,26,74,A)'], fog: 0x201812, hemiSky: 0xfff0d0, hemiGround: 0x2a4a3a, sun: 0xfff4e0, sunDir: [0.2, 1, 0.4], sunPower: 3.0, hemiPower: 1.3, band: 0.5, gas: 0.9, cloud: 0x8a5a2a, clouds: 0.24, starGlow: 0.6, starTint: 0xfff0d8 },
    maw: { seed: 2035, sky: ['#04050a', 'rgba(20,50,44,A)', 'rgba(40,20,50,A)', 'rgba(70,46,24,A)'], fog: 0x070a0a, hemiSky: 0x9ab8a8, hemiGround: 0x0e1a16, sun: 0xb8d0c0, sunDir: [0, 1, 0.3], sunPower: 1.4, hemiPower: 0.8, band: 0.56, gas: 0.35, cloud: 0x14322c, clouds: 0.06, starGlow: 0.3, starTint: 0xd0ffe0 },
  },
  kinds: [ring, pod, seeker, mines, shieldCell, overclock, current, shoalFish, gulper, thrummer, pulse, maw, coral, motes, drumCoral, cliff],
  scenery: [reef, plankton, shafts, drums, cliffs, heart, clock],
  boss: { at: BOSS_AT, def: whirlmaw, then: 'finish' },
  beats: [
    { d: 0, tag: 'calm', what: 'rings over the outer reef; the drum corals beat in time, no red on them' },
    { d: B(6), tag: 'calm', what: 'the first thrummer, far off on the reef: its pulse has a huge hole with rings in it' },
    { d: B(11), tag: 'rising', what: 'a smaller hole, then one overhead; then the parry, taught on a pulse with a hole anyway' },
    { d: S2, tag: 'rising', what: 'the drumline: pulse pairs a bar apart, holes in turn, seekers between them' },
    { d: B(33), tag: 'rising', what: 'drop one: mines, a gulper through a shoal, a three-pulse run' },
    { d: B(45), tag: 'calm', what: 'a current and a shoal: a breath' },
    { d: S3, tag: 'calm', what: 'THE SILENT SKIN: the first pulse with no hole, slow; the roll is the only way, and its echo frees the drum' },
    { d: B(57), tag: 'peak', what: 'build two: no-hole and holed pulses in turn with seekers and a gulper: the hardest stretch' },
    { d: B(63.5), tag: 'calm', what: 'a breath; an Overclock on the ring line into the heart' },
    { d: S4, tag: 'peak', what: "THE REEF'S HEART: four thrummers beat a rhythm, holes and no-holes mixed; with Overclock parry them all" },
    { d: B(77.5), tag: 'calm', what: 'the rhythm stops; the water darkens; a Shield Cell in the calm; the Whirlmaw\'s eye opens' },
  ],
  acts: { introduce: [S1, S2], develop: [S2, S3], twist: [S3, S4], master: [S4, BOSS_AT] },

  build(R, L) {
    const { add, ring: one, line, sine } = L;
    let P = [0, -0.1], shoalN = 0;
    const at = (b, x, y) => { one(B(b), x, y); P = [x, y]; };
    const go = (b, to, n = 4, step = 0.25) => { const p0 = P.slice(); for (let i = 1; i <= n; i++) { const k = i / n; at(b - (n - i) * step, p0[0] + (to[0] - p0[0]) * k, p0[1] + (to[1] - p0[1]) * k); } };
    // a thrummer: it beats on bar `beat`, its front meets you on bar `meet`; it stands 150 m past the meet, off the lane
    const drum = (beat, meet, nx, ny, hole, o = {}) => add(B(meet) + (o.ahead ?? 150), 'g2-thrummer', { nx, ny, s: o.s || 3, pulses: [{ beat: B(beat), meet: B(meet), tell: B(beat) - B(beat - 1), hole: hole ? { a: hole[0], w: hole[1] } : null }] });
    // where to be for a hole (on its axis, clear of the wall's middle on a phone too)
    const holeAt = (a) => [Math.round(Math.cos(a) * 0.66 * 100) / 100, Math.round(Math.sin(a) * 0.68 * 100) / 100];
    // rings into the hole of the pulse meeting on bar m (n rings, the last on the meet)
    const into = (m, a, n = 3) => go(m, holeAt(a), n);
    const podAt = (b, nx, ny, o = {}) => add(B(b), 'pod', Object.assign({ nx, ny, drift: 0, bursts: 1, shots: 1 }, o));
    const seekerAt = (b, o) => add(B(b - 3.9 / CLK.barSec), 'seeker-drone', o);
    const gulp = (b, from, cross, ny) => add(B(b), 'g2-gulper', { from, cross, ny, span: 220, shots: 2 });
    const shoal = (b, n, gap, keys, o = {}) => {
      const id = 'D' + (++shoalN), d0 = B(b), K = keys.map(([kb, x, y]) => [800 + B(kb) - d0, x, y]);
      const split = o.split ? { p: 800 + B(o.split.bar) - d0 - 50, len: 90, dx: o.split.dx || 0, dy: o.split.dy || 0 } : undefined;
      for (let i = 0; i < n; i++) add(d0 + i * gap, 'g2-shoal', { shoal: id, idx: i, of: n, gap, keys: K, off: [0.05 * Math.sin(i * 1.7), 0.04 * Math.cos(i * 1.3)], split });
      const last = keys[keys.length - 1]; P = [last[1], last[2]];
    };

    // ================= ACT 1, INTRODUCE: THE OUTER REEF (bars 1-24). The pulse, its hole, then the parry =================
    line(B(2), -0.45, -0.1, 0.45, -0.1, 5, 24); P = [0.45, -0.1];
    sine(B(3.5), 6, 28, 0.3, 0.25); P = [0, 0.25];
    add(B(5.5), 'call', { text: 'A DRUM: FLY THROUGH THE GAP IN ITS PULSE', cls: 'c-cyan' });
    drum(7, 8, 1.8, -0.3, [R_, 2.3]); go(7.5, [0.3, 0], 3); into(8, R_, 2); at(8.25, 0.6, 0.05);
    go(10, [0, 0], 4);
    drum(11, 12, -1.8, 0.2, [L_, 1.7]); into(12, L_, 4); at(12.25, -0.6, 0.05);
    go(14, [0, 0.2], 4);
    drum(15, 16, 0.2, -1.7, [U_, 1.2]); into(16, U_, 4); at(16.25, 0, 0.6);
    go(18, [0, 0], 4);
    add(B(18.5), 'call', { text: 'OR ROLL AS IT HITS YOU: PARRY!', cls: 'c-cyan' });
    drum(20, 21, 1.8, 0.4, [D_, 2.3]); go(21, [0, -0.15], 4);                    // a gap below; a roll anywhere parries it
    go(22.25, [0, 0], 2);
    shoal(22.75, 8, 26, [[19, 0.4, 0.4], [22.75, 0.2, 0.1], [24.5, -0.2, 0]]);

    // ================= ACT 2, DEVELOP: THE DRUMLINE (bars 25-48). Pairs a bar apart, holes in turn =================
    // bar 25: the speed steps; nothing new for a bar (rule 6)
    go(26.25, [0.3, 0], 3);
    drum(26, 27, 1.8, -0.2, [R_, 1.7]); drum(27, 28, -1.8, 0.2, [L_, 1.7]);
    into(27, R_, 2); into(28, L_, 3);
    seekerAt(29.75, { nx: 0.35, ny: 0.66, shots: 2 });
    go(29.5, [0, 0.1], 3);
    drum(30, 31, -0.3, -1.7, [U_, 1.7]); drum(31, 32, 0.3, 1.6, [D_, 2.3]);
    into(31, U_, 3); into(32, D_, 3);
    // drop one (bar 33): the speed steps; mines, then a gulper through a shoal
    go(34, [-0.4, -0.1], 4);
    add(B(34.75), 'mines', { nx: 0.35, ny: 0.3, n: 5 });
    go(35.25, [-0.45, -0.2], 2);
    shoal(35.5, 12, 26, [[32, -0.3, 0.05], [35.5, -0.1, 0.05], [38, 0.1, 0.05]], { split: { bar: 36.75, dy: 0.55 } });
    gulp(36.75, 1, -0.2, 0.05);
    drum(38, 39, 1.8, 0.3, [R_, 1.2]); drum(39, 40, 0.2, -1.7, [U_, 1.7]);
    into(39, R_, 3); into(40, U_, 3);
    seekerAt(41, { nx: -0.4, ny: 0.62, shots: 2 });
    podAt(41.5, 0.72, 0.6, { bursts: 1, shots: 2 });
    drum(41, 42, -1.8, -0.2, [L_, 1.7]); drum(42, 43, 1.8, 0.2, [R_, 1.7]); drum(43, 44, 0, -1.7, [U_, 2.3]);
    into(42, L_, 3); into(43, R_, 3); into(44, U_, 3);
    // a breath: a current and a shoal
    go(45.25, [0, 0], 3);
    add(B(45.5), 'g2-current', { len: B(48) - B(45.5), fx: 0.35, seed: 345 });
    shoal(46, 10, 26, [[42.5, -0.5, -0.2], [46, -0.35, -0.15], [48, 0.25, -0.1]]);

    // ================= ACT 3, TWIST: THE SILENT SKIN (bars 49-64). No hole: the parry is the only way =================
    go(49.5, [0, 0], 3);
    add(B(49.75), 'call', { text: 'NO GAP: ROLL INTO IT', cls: 'c-red' });
    drum(50, 52, 1.8, 0, null, { s: 3.6 });                                      // the first, slow: two bars of flight
    go(52, [0, 0.05], 4);
    drum(53.5, 54.5, -1.8, 0.2, [R_, 2.3]); into(54.5, R_, 4);
    drum(55, 56, 1.8, -0.2, null); go(56, [0.2, 0], 3);
    // build two (bar 57): the speed steps; skins with and without holes in turn, seekers, a gulper: the hardest stretch
    drum(57.5, 58.5, -0.2, -1.7, null); go(58.5, [0, 0.05], 4);
    seekerAt(59.75, { nx: 0.45, ny: 0.62, shots: 2 });
    drum(58.5, 59.5, 1.8, 0.3, [U_, 1.7]); into(59.5, U_, 3);
    drum(60, 61, -1.8, 0, null); go(61, [0, 0.1], 3);
    gulp(61.5, -1, 0.35, -0.35);
    drum(61, 62, 0.3, 1.6, [L_, 1.7]); into(62, L_, 3);
    drum(62, 63, 1.8, -0.3, null); go(63, [-0.2, 0], 3);
    // a breath, and an OVERCLOCK on the ring line into the heart: with it you can parry the whole rhythm
    go(64.75, [0, 0], 4);
    add(B(65.5), 'overclock', { nx: 0, ny: 0 });                                 // 2.6 s before the first meet of the rhythm
    at(65.25, 0, 0); at(65.75, 0, 0.05); at(66, 0, 0.05);

    // ================= ACT 4, MASTER: THE REEF'S HEART (bars 65-78). Four thrummers beat a rhythm =================
    // each round, four meets half a bar apart: skins without holes a bar apart (a roll is ready for each) and holed ones
    // between (fly the hole, or with Overclock parry those too)
    const round = (b0, holes) => {
      const spots = [[-1.8, 0.2], [1.8, -0.2], [0.3, -1.7], [-0.3, 1.6]];
      holes.forEach((h, i) => { const m = b0 + 1 + i * 0.5; drum(b0 + i * 0.5, m, spots[i][0], spots[i][1], h, { ahead: 170 }); if (h) at(m, ...holeAt(h[0])); else at(m, P[0] * 0.3, P[1] * 0.3); });
    };
    go(66.5, [0, 0], 2);
    round(66, [null, [R_, 2.3], null, [L_, 2.3]]);
    go(70.5, [0, 0], 4);
    round(71, [[U_, 1.7], null, [D_, 1.7], null]);
    go(74.5, [0, 0], 3);
    round(75, [null, [R_, 1.7], null, [L_, 1.7]]);
    // the rhythm stops; the water darkens; a Shield Cell in the calm before the Whirlmaw (its entrance: the exception)
    go(79, [0, 0], 4);
    sine(B(79.25), 8, 30, 0.25, 0.2); P = [0, 0.2];
    add(B(80.5), 'call', { text: 'THE WATER DARKENS', cls: 'c-red' });
    go(81.25, [0, 0], 3);
    add(B(81.75), 'shield-cell', { nx: 0, ny: 0 });
    line(B(82.25), 0, 0, 0, 0.1, 5, 30);
  },
});
