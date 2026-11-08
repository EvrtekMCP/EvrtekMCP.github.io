// GALAXY 2, LEVEL 10: THE ROOTMIND. The finale of the Verdant Deep: three acts, a boss and a release, each on its own
// part of the music (DESIGN.md beside this file has the beat sheet in full). The course is laid out in BARS of the part
// that is playing (rule 30): `at(t)` turns a time into the course distance the speed curve reaches then, and each part's
// bar grid is the GRID table below.
//  ACT 1  THE CANOPY    canopy bars 1-56     the Rootmind from outside; root-whips; the roll call of the whole Deep
//  ACT 2  THE TAPROOT   taproot bars 1-48    the dive down the main root at 205 m/s: whips, sap knots, the crossfire
//  ACT 3  THE ROOTMIND  rootmind bars 5-36   the boss, looping its fight (it turns beside the lane: you orbit it)
//  OUT    THE RELEASE   rootmind bars 37-90  its first breath; the flare carries you out; the Deep swims home with you
import { defineLevel, clamp } from '../../api.js?v=0.4.1';
import ring from '../../pickups/ring/index.js?v=0.4.1';
import { shieldCell, overclock, mirrorShell, phase } from '../../pickups/powerups/index.js?v=0.4.1';
import whip from '../../obstacles/g2-root-whip/index.js?v=0.4.1';
import knot from '../../enemies/g2-sap-knot/index.js?v=0.4.1';
import rootmind from '../../bosses/g2-rootmind/index.js?v=0.4.1';
import { starfire, sap } from '../../bosses/g2-rootmind/kinds.js?v=0.4.1';
import { rootWall } from './level10/kinds.js?v=0.4.1';
import { far, arch, canopy, archFree, opening, mote, plankton, current, seg, tunnel, chamber, freed, herd } from './level10/scenery.js?v=0.4.1';
import { ROLL, rollKinds } from './level10/rollcall.js?v=0.4.1';

// ---------------------------------------------------------------------------------------------------------------------
// THE SCHEDULE. Each part's bar grid: { bpm, firstBeat }. The three parts (audio/g2/level10/canopy, taproot, rootmind)
// wait on ElevenLabs credits; until they land the engine plays galaxy 1's finale parts in their places (canopy:
// approach, taproot: dive, rootmind: core), whose bar maps are the same bar for bar (the sound branch's plan), so these
// are the stand-ins' measured grids (audio/levels/level10/*.json). WHEN THE TAKES LAND: copy each one's bpm and
// firstBeat from its .json into this table (the plan's 140, 146 and 150 bpm); nothing else moves.
const GRID = {
  canopy: { bpm: 139.985, firstBeat: 0.1474 },     // stand-in: levels/level10/approach
  taproot: { bpm: 145.004, firstBeat: 0.2037 },    // stand-in: levels/level10/dive
  rootmind: { bpm: 149.996, firstBeat: 0.2652 },   // stand-in: levels/level10/core
};
const barsOf = (g) => (n) => g.firstBeat + (n - 1) * 240 / g.bpm;
const cB = barsOf(GRID.canopy), tB = barsOf(GRID.taproot), rB = barsOf(GRID.rootmind);
const TAP0 = cB(57);                         // the taproot cuts in on the canopy's bar 57 line, from its top
const tb = (n) => TAP0 + tB(n);              // taproot bar n, in seconds of the run
const BOSS_T = tb(49) - 0.8;                 // the boss marker: the rootmind part cuts in on the taproot's next bar line
const OUT = (s) => s - rB(37);               // seconds after the course resumes (the rootmind part from its Breath)
const ROOT = 'g2/level10/rootmind';

// speed: [time, m/s] knots for the run in, then for the run out; linear between knots. Speed steps land just after a
// section line, and the density steps come after them (rule 6).
const KNOTS_IN = [
  [0, 100], [cB(9), 100], [cB(9) + 1, 118], [cB(25), 118], [cB(25) + 1, 132], [cB(33), 132], [cB(33) + 1, 150],
  [TAP0 - 0.8, 150], [TAP0 + 0.3, 180], [tb(5), 180], [tb(5) + 1, 188], [tb(21), 188], [tb(21) + 1, 196], [tb(29), 196], [tb(29) + 1, 205],
  [tb(45), 205], [tb(45) + 5.2, 72], [BOSS_T + 30, 72],
];
const KNOTS_OUT = [
  [0, 72], [OUT(rB(45)), 118], [OUT(rB(53)) - 1.2, 170], [OUT(rB(53)), 210], [OUT(rB(69)), 210], [OUT(rB(69)) + 4, 140],
  [OUT(rB(85)), 100], [OUT(rB(91)) + 30, 80],
];
// integrate a knot list into a distance table (every 0.05 s)
function table(knots) {
  const ts = [], ds = [], vs = [];
  let d = 0;
  const vAt = (t) => { for (let i = 1; i < knots.length; i++) if (t <= knots[i][0]) { const [t0, v0] = knots[i - 1], [t1, v1] = knots[i]; return v0 + (v1 - v0) * clamp((t - t0) / (t1 - t0 || 1), 0, 1); } return knots[knots.length - 1][1]; };
  for (let t = 0; t <= knots[knots.length - 1][0]; t += 0.05) { ts.push(t); ds.push(d); vs.push(vAt(t)); d += vAt(t + 0.025) * 0.05; }
  const at = (t) => { const i = clamp(Math.floor(t / 0.05), 0, ts.length - 2), k = (t - ts[i]) / 0.05; return ds[i] + (ds[i + 1] - ds[i]) * k; };
  const speedAt = (dd) => { let lo = 0, hi = ds.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ds[m] <= dd) lo = m; else hi = m; } return vs[lo]; };
  return { at, speedAt };
}
const IN = table(KNOTS_IN), OUTT = table(KNOTS_OUT);
const at = IN.at;
const BOSS_AT = Math.round(at(BOSS_T));
const atOut = (s) => BOSS_AT + OUTT.at(s);
const END_AT = Math.round(atOut(OUT(rB(91)) - 0.6));
const D = (t) => Math.round(at(t));
const Do = (s) => Math.round(atOut(OUT(s)));

// the looks: Yori's level 10 palette (sky #060a08, gas jade-dark #1a3a2a, starlight #e8ffe0, bark #3a2a1a, fog #0a1a10,
// key #f0fff0), darkening down the taproot, white-green in the cage, and the whole Deep lit green at the end
const LOOK = {
  canopy: { sky: ['#060a08', 'rgba(26,58,42,A)', 'rgba(220,250,212,A)', 'rgba(58,42,26,A)'], fog: 0x0a1a10, hemiSky: 0xf0fff0, hemiGround: 0x2a3a1a, sun: 0xf0fff0, band: 0.5, gas: 0.75, cloud: 0x2a4a34, clouds: 0.16, seed: 2101 },
  crown: { sky: ['#070c09', 'rgba(34,74,52,A)', 'rgba(232,255,224,A)', 'rgba(70,50,28,A)'], fog: 0x0c1e12, hemiSky: 0xf0fff0, hemiGround: 0x2a3a1a, sun: 0xf4fff0, band: 0.5, gas: 0.9, cloud: 0x34583e, clouds: 0.2, seed: 2102 },
  mouth: { sky: ['#050806', 'rgba(30,60,40,A)', 'rgba(200,240,190,A)', 'rgba(60,44,26,A)'], fog: 0x08140c, hemiSky: 0xe8f8e0, hemiGround: 0x2a2a14, sun: 0xf0fff0, band: 0.5, gas: 0.7, cloud: 0x2a4030, clouds: 0.12, seed: 2103 },
  taproot: { sky: ['#030503', 'rgba(42,30,18,A)', 'rgba(0,0,0,A)', 'rgba(24,48,30,A)'], fog: 0x080a06, hemiSky: 0xd8f0c8, hemiGround: 0x2a1a10, sun: 0xe0ffd8, band: 0.5, gas: 0.4, cloud: 0x1a2a1a, clouds: 0, seed: 2104, stars: 160 },
  heartwood: { sky: ['#040503', 'rgba(52,34,20,A)', 'rgba(10,20,10,A)', 'rgba(30,60,36,A)'], fog: 0x0c0c06, hemiSky: 0xe0f4d0, hemiGround: 0x30200e, sun: 0xe8ffe0, band: 0.5, gas: 0.5, cloud: 0x1a2a1a, clouds: 0, seed: 2105, stars: 120 },
  chamber: { sky: ['#0a120c', 'rgba(60,110,70,A)', 'rgba(240,255,236,A)', 'rgba(52,40,24,A)'], fog: 0x10201a, hemiSky: 0xf4fff0, hemiGround: 0x2a3a1a, sun: 0xffffff, band: 0.5, gas: 0.7, cloud: 0x4a7a54, clouds: 0.12, seed: 2106, stars: 220 },
  breath: { sky: ['#10241a', 'rgba(110,200,140,A)', 'rgba(244,255,240,A)', 'rgba(70,56,120,A)'], fog: 0x163020, hemiSky: 0xffffff, hemiGround: 0x2a4a34, sun: 0xffffff, band: 0.5, gas: 0.9, cloud: 0x6aa07a, clouds: 0.15, seed: 2107, stars: 160 },
  flare: { sky: ['#14362a', 'rgba(140,240,170,A)', 'rgba(250,255,246,A)', 'rgba(90,60,160,A)'], fog: 0x1e4a32, hemiSky: 0xffffff, hemiGround: 0x2a5a3a, sun: 0xffffff, band: 0.5, gas: 1.0, cloud: 0x9ad8aa, clouds: 0.15, seed: 2108, stars: 80, starGlow: 0.5 },
  home: { sky: ['#081420', 'rgba(42,154,106,A)', 'rgba(224,255,232,A)', 'rgba(90,58,160,A)'], fog: 0x0c2420, hemiSky: 0xe0ffe8, hemiGround: 0x1e3a4a, sun: 0xe0ffe8, band: 0.5, gas: 0.85, cloud: 0x3a8a6a, clouds: 0.14, seed: 2109, stars: 300 },
};

export default defineLevel({
  g: 2, n: 10, id: 'rootmind', name: 'THE ROOTMIND',
  idea: 'The finale cuts a living star free of the machine strangling it.',
  seed: 210010,
  length: END_AT,
  speed: (d) => (d <= BOSS_AT ? IN.speedAt(d) : OUTT.speedAt(d - BOSS_AT)),
  music: { track: 'g2/level10/canopy' },
  // the fight loops the Grip and the Starfire (bars 5-36); after it, each section of the release jumps the part to its
  // own section on the next bar line, once, to the end: the music re-syncs at the breath, the flare and the swim home
  bossMusic: { track: ROOT, loop: [rB(5), rB(37)] },
  boss: { at: BOSS_AT, def: rootmind, then: 'continue' },
  // style minimums [grazes + close calls, deflects] for A, S and DEGENERATE: the decent human bot's runs (2026-11-07,
  // four seeds) averaged about 23 close calls and 80 deflects; these are galaxy 1's finale's proportions of its own
  style: { A: [4, 10], S: [6, 17], DEGENERATE: [10, 27] },
  sfx: [{ id: 'boss-warning', gain: 0.61 }, { id: 'boss-hit', gain: 1 }, { id: 'boss-phase', gain: 0.65 }, { id: 'g2-root-lash', gain: 0.8 }, { id: 'g2-sap-burst', gain: 0.7 },
    { id: 'g2-starfire', gain: 0.9 }, { id: 'g2-graft-crack', gain: 0.8 }, { id: 'g2-boss-freed', gain: 1 }, { id: 'g2-star-breath', gain: 0.9 },
    // the roll call's own (g2-a's kinds)
    { id: 'g2-current-in', gain: 0.5 }, { id: 'g2-sting', gain: 0.55 }, { id: 'g2-shoal', gain: 0.6 }, { id: 'g2-gulper-pass', gain: 0.55 }, { id: 'g2-thrum', gain: 0.55 }, { id: 'g2-pulse', gain: 0.6 }, { id: 'g2-parry', gain: 0.7 }],
  // a section's sub is also its PERFECT line on the tally, so they stay short
  sections: [
    { id: 'canopy', name: 'THE CANOPY', sub: 'ACT 1', d0: 0, d1: D(cB(33)), look: 'canopy', scenery: { 'g2-l10-far': 1, 'g2-l10-canopy': 1, 'g2-l10-plankton': 1 } },
    { id: 'crown', name: 'THE CROWN', sub: 'THE CROWN', banner: false, d0: D(cB(33)), d1: D(cB(49)), look: 'crown', scenery: { 'g2-l10-far': 1, 'g2-l10-canopy': 1.3, 'g2-l10-plankton': 1.2 } },
    { id: 'mouth', name: "THE TAPROOT'S MOUTH", sub: 'THE MOUTH', banner: false, d0: D(cB(49)), d1: D(TAP0 - 0.6), look: 'mouth', scenery: { 'g2-l10-far': 1, 'g2-l10-canopy': 0.6, 'g2-l10-plankton': 1 } },
    { id: 'taproot', name: 'THE TAPROOT', sub: 'ACT 2', music: 'g2/level10/taproot', d0: D(TAP0 - 0.6), d1: D(tb(29)), look: 'taproot', scenery: { 'g2-l10-tunnel': 1, 'g2-l10-plankton': 0.5 } },
    { id: 'heartwood', name: 'THE HEARTWOOD', sub: 'THE HEARTWOOD', banner: false, d0: D(tb(29)), d1: D(tb(45)), look: 'heartwood', scenery: { 'g2-l10-tunnel': 1, 'g2-l10-plankton': 0.5 } },
    { id: 'core', name: 'THE CAGE', sub: 'ACT 3', d0: D(tb(45)), d1: BOSS_AT + 1, look: 'chamber', scenery: { 'g2-l10-chamber': (t) => clamp((t - 0.3) / 0.5, 0, 1), 'g2-l10-plankton': 1 } },
    { id: 'breath', name: 'THE FIRST BREATH', sub: 'THE RELEASE', music: { track: ROOT, from: rB(37), loop: false }, d0: BOSS_AT + 1, d1: Do(rB(45)), look: 'breath', scenery: { 'g2-l10-chamber': (t) => 1 - t, 'g2-l10-freed': 1, 'g2-l10-plankton': 1 } },
    { id: 'flare', name: 'THE FLARE', sub: 'THE FLARE', banner: false, music: { track: ROOT, from: rB(45), loop: false }, d0: Do(rB(45)), d1: Do(rB(69)), look: 'flare', scenery: { 'g2-l10-freed': (t) => (t < 0.12 ? 1 : 0), 'g2-l10-opening': 1, 'g2-l10-current': 1 } },
    { id: 'home', name: 'THE DEEP, SET FREE', sub: 'HOME', music: { track: ROOT, from: rB(69), loop: false }, d0: Do(rB(69)), d1: END_AT, look: 'home', scenery: { 'g2-l10-herd': 1, 'g2-l10-plankton': 1, 'g2-l10-opening': (t) => (t < 0.1 ? 1 - t / 0.1 : 0) } },
  ],
  looks: LOOK,
  kinds: [ring, shieldCell, overclock, mirrorShell, phase, whip, knot, starfire, sap, rootWall, ...rollKinds(), arch, archFree, mote, seg],
  scenery: [far, canopy, opening, plankton, current, tunnel, chamber, freed, herd],
  // rule 1: the beat sheet (calm / rising / peak), in metres
  beats: [
    { d: 0, tag: 'calm', what: 'the Rootmind ahead, a star in a cage of roots; rings in the open; the first root-whip, alone, a long tell' },
    { d: D(cB(9)), tag: 'rising', what: 'the roll call: a current, a shoal, a thrummer, hounds and the calf; whips between' },
    { d: D(cB(25)), tag: 'rising', what: 'the speed step first; then wells and leeches' },
    { d: D(cB(33)), tag: 'peak', what: 'THE CROWN: Overclock, then the bloomers\' barrage, the anglers, the flock, whips in pairs' },
    { d: D(cB(49)), tag: 'calm', what: 'the mouth: nothing hurts; a Shield Cell; the rings lead into the taproot' },
    { d: D(TAP0), tag: 'rising', what: 'the dive: the root closes round you at 180 m/s' },
    { d: D(tb(5)), tag: 'rising', what: 'sap knots: the first alone with a long swell; then a knot every two bars, whips between' },
    { d: D(tb(21)), tag: 'rising', what: 'Phase, the root wall and its cache; then the Mirror Shell' },
    { d: D(tb(29)), tag: 'peak', what: 'THE KNOT CROSSFIRE at 205 m/s: knots on both walls every bar; two bars of rings to breathe' },
    { d: D(tb(45)), tag: 'calm', what: 'out into the cage: a Shield Cell; the star turning beside you' },
    { d: BOSS_AT, tag: 'peak', what: 'THE ROOTMIND: knot volleys and whips, then starfire, then the last root' },
    { d: BOSS_AT + 1, tag: 'calm', what: 'its first breath: the roots go silver and open; nothing hurts' },
    { d: Do(rB(45)), tag: 'rising', what: 'the flare carries you out: the current builds' },
    { d: Do(rB(53)), tag: 'peak', what: 'ride the flare at 210 m/s through opening roots; known whips only, long tells' },
    { d: Do(rB(69)), tag: 'calm', what: 'the Deep set free swims home with you: whales, the Whirlmaw, the Snare, the moths; nothing hurts' },
  ],
  // rule 19: the four acts
  acts: { introduce: [0, D(TAP0 - 0.6)], develop: [D(TAP0 - 0.6), D(tb(45))], twist: [D(tb(45)), BOSS_AT + 1], master: [BOSS_AT + 1, END_AT] },
  // the herd swims on ahead for a moment after the finish line, before the tally (and GALAXY CLEAR)
  outro: { time: 6, update() { } },
  build(R, L) {
    const { add, ring: rg, line, sine } = L;
    const call = (t, text, cls) => add(at(t), 'call', { text, cls: cls || '' });
    const cb = (b) => cB(b);
    // a root-whip whose lash ends `lead` before it reaches you at time t, with rings on the far side of it
    const lash = (t, o, ringAt) => { add(at(t), 'g2-root-whip', o); if (ringAt) line(at(t) - 80, ringAt[0], ringAt[1], ringAt[2], ringAt[3], 4, 24); };
    // a sap knot whose spit reaches you at time t (on the wall at angle a)
    const kn = (t, a, o) => add(at(t), 'g2-sap-knot', Object.assign({ a }, o || {}));
    // one roll-call wave (rollcall.js) from time t, told the speed there so its stand-ins are spaced in seconds
    const rc = (k, t) => { const bar = 240 / GRID.canopy.bpm, S = (s) => at(t + s); S.bar = bar; return ROLL[k](L, at(t), IN.speedAt(at(t)), (n) => at(t + n * bar), S); };
    // ===================================================================================================== ACT 1
    // INTRO (bars 1-8, 100 m/s): rings in the open; the first root-whip alone, a long tell, the way past lit with rings
    line(at(1.4), 0, -0.2, 0, 0.2, 5, 24);
    sine(at(4.4), 8, 22, 0.45, 0.35);
    call(cb(5.2), 'WHEN THE BARK SPLITS, GET CLEAR', 'c-red');
    lash(cb(7), { dir: 'h', ny: 0.35, piv: 1, tel: 1.6 }, [0, -0.35, 0, -0.55]);
    line(at(cb(8.2)), -0.3, -0.2, 0.3, 0.1, 4, 24);
    // GROOVE (bars 9-24, 118 m/s): the roll call, in the order you met them, whips between
    call(cb(9) + 1.2, 'EVERYTHING YOU MET IS BACK. GRAFTED.', 'c-red');
    rc('l1', cb(10.5));
    lash(cb(13), { dir: 'v', nx: -0.3, piv: -1 }, [0.25, 0, 0.5, 0.1]);
    rc('l2', cb(14.5));
    rc('l3', cb(17));                                        // its drums beat on bar lines 17 and 19
    lash(cb(19.5), { dir: 'h', ny: -0.3, piv: -1 }, [0, 0.3, 0, 0.5]);
    rc('l4', cb(21));
    sine(at(cb(23.2)), 6, 24, 0.5, 0.4, 1.2);
    // BUILD ONE (bars 25-32, 132 m/s): the speed step first; then wells and leeches
    line(at(cb(25.6)), 0, 0.4, 0, -0.3, 5, 26);
    rc('l5', cb(27));
    lash(cb(29), { dir: 'v', nx: 0.35, piv: 1, tilt: 0.15 }, [-0.2, 0, -0.5, -0.1]);
    rc('l6', cb(30));
    // DROP ONE (bars 33-48, 150 m/s): THE CROWN, the canopy's peak. The Overclock, then the barrage it pays off in.
    line(at(cb(33.6)), 0, -0.3, 0.1, -0.05, 4, 24); add(at(cb(33.6)) + 4 * 24, 'overclock', { nx: 0.12, ny: 0 });
    rc('l7', cb(35.4));
    lash(cb(39), { dir: 'h', ny: 0.4, piv: 1 }, [0.2, -0.3, 0, -0.5]);
    rc('l8', cb(40.6));
    lash(cb(42.6), { dir: 'v', nx: -0.35, piv: 1 }, [0.2, 0.1, 0.5, 0]);
    rc('l9', cb(44));
    // a pair from both sides: the way through is the middle, and the rings say so
    add(at(cb(46.5)), 'g2-root-whip', { dir: 'h', ny: 0.58, piv: 1 }); add(at(cb(46.5)), 'g2-root-whip', { dir: 'h', ny: -0.58, piv: -1 });
    line(at(cb(46.5)) - 100, 0, 0.2, 0, 0, 5, 24);
    sine(at(cb(47.6)), 6, 22, 0.4, 0.3);
    // BREAKDOWN (bars 49-56): THE MOUTH. Nothing hurts. A Shield Cell at the canopy's end; the rings lead into the root.
    line(at(cb(49.3)), 0.4, 0.3, 0.1, 0.05, 4, 24); add(at(cb(49.3)) + 4 * 24, 'shield-cell', { nx: 0.05, ny: 0 });
    call(cb(50.6), 'DOWN THE TAPROOT. THE STAR IS AT THE BOTTOM', 'c-cyan');
    line(at(cb(52)), 0, 0.3, 0, 0, 6, 26);
    sine(at(cb(54.2)), 8, 26, 0.22, 0.2);
    // ===================================================================================================== ACT 2
    // INTRO (bars 1-4, 180 m/s): into the root. Rings straight down the middle.
    line(at(tb(1.2)), 0, 0, 0, 0, 6, 30);
    sine(at(tb(3.2)), 6, 30, 0.35, 0.3);
    // GROOVE (bars 5-20, 188 m/s): sap knots. The first alone with a long swell and one bolt; the next two two bars
    // apart, round the wall; then one a bar, whips on bars of their own between (a roll moment a bar at most: rule 12's
    // cap of three in any 3 s holds)
    call(tb(5.4), 'A KNOT SWELLS, THEN SPITS. ROLL IT BACK', 'c-red');
    kn(tb(7), 0.15, { n: 1, tel: 1.7 }); line(at(tb(7)) - 120, -0.2, 0, 0, 0, 4, 28);
    kn(tb(9), Math.PI - 0.15, { n: 2 }); line(at(tb(9)) - 90, 0, 0.2, 0.2, 0.3, 4, 26);
    kn(tb(11), Math.PI / 2, { n: 2 }); sine(at(tb(11)) + 30, 5, 28, 0.4, 0.3, 0.5);
    kn(tb(12), -0.2, { n: 2 });
    lash(tb(13), { dir: 'v', nx: 0.3, piv: -1 }, [-0.2, 0, -0.5, 0]);
    // (g2-roll, 11-07: the root answers a whip with a knot half a bar later, so the groove asks a roll every bar or
    // less from here; still never more than three in any 3 s)
    kn(tb(13.5), Math.PI * 0.6, { n: 2 });
    kn(tb(14), Math.PI * 0.8, { n: 2 });
    kn(tb(15), -Math.PI / 2, { n: 2 }); line(at(tb(15)) - 90, 0, -0.2, 0, 0.2, 4, 26);
    kn(tb(16), 0.3, { n: 2 });
    lash(tb(17), { dir: 'h', ny: -0.35, piv: 1 }, [0, 0.2, 0, 0.45]);
    kn(tb(17.5), -Math.PI * 0.4, { n: 2 });
    kn(tb(18), Math.PI * 0.85, { n: 3 });
    kn(tb(19), 0.25, { n: 3 }); line(at(tb(19)) - 90, -0.3, 0.2, 0, 0.1, 4, 26);
    lash(tb(20.3), { dir: 'v', nx: -0.3, piv: 1 }, [0.2, 0, 0.45, 0]);
    // BUILD ONE (bars 21-28, 196 m/s): PHASE, then the root wall with its cache behind the crack; the open way is left
    line(at(tb(21)), 0, 0, 0.2, 0.05, 3, 26); add(at(tb(21)) + 3 * 26 + 6, 'phase', { nx: 0.25, ny: 0.08 });
    line(at(tb(21)) + 3 * 26 + 70, 0.3, 0.08, 0.48, 0.1, 3, 46, 'ring', { cache: true, noMagnet: true });   // the trail: it runs in
    add(at(tb(23)), 'g2-l10-root-wall', { side: 1, edge: -0.05, cx: 0.5, cy: 0.1 });
    line(at(tb(22)), -0.15, 0, -0.55, 0, 5, 30);                                                            // the open way round
    line(at(tb(23)) - 110, -0.6, 0, -0.6, 0, 6, 26);                                                        // ... right past the wall
    line(at(tb(23)) + 26, 0.5, 0.1, 0.5, 0.1, 5, 22, 'ring', { cache: true, noMagnet: true });              // the cache behind it
    add(at(tb(23)) + 16, 'g2-rootmind-sap', { nx: 0.5, ny: 0.1, cache: true });
    sine(at(tb(24.6)), 6, 28, 0.4, 0.3);
    kn(tb(24.5), Math.PI * 0.35, { n: 2 });                 // (g2-roll: the root's answer to the wall, a bar and a half on)
    kn(tb(25), Math.PI * 0.9, { n: 2 });
    lash(tb(26), { dir: 'h', ny: 0.4, piv: -1 }, [0, -0.2, 0, -0.45]);
    kn(tb(27), 0.1, { n: 2 }); line(at(tb(27)) - 90, -0.2, -0.1, 0, 0, 4, 26);
    // the Mirror Shell, before the crossfire (a roll's reach half as far again: the fans' outer bolts come home too)
    line(at(tb(28)) - 30, 0, 0.2, 0, 0, 3, 26); add(at(tb(28)) + 52, 'mirror-shell', { nx: 0, ny: 0 });
    // DROP ONE (bars 29-44, 205 m/s): THE KNOT CROSSFIRE. Knots on both walls on the same bar, fans of three.
    const cross = (b, a, o) => { kn(tb(b), a, o); kn(tb(b), a + Math.PI, o); };
    // (g2-roll, 11-07: the drop's own first bar spits one knot before the crossfire opens, and after each whip in the
    // crossfire a lone knot spits half a bar on; bars 37-38 still breathe)
    kn(tb(29), Math.PI / 2, { n: 2 });
    cross(30, 0, { n: 3, spread: 2.8 }); line(at(tb(30)) - 60, 0, 0, 0, 0, 3, 24);
    cross(31, 0.25, { n: 3, spread: 2.8 }); rg(at(tb(31)) + 30, 0, 0.1);
    cross(32, -0.25, { n: 3, spread: 2.8 }); rg(at(tb(32)) + 30, 0, -0.1);
    cross(33, Math.PI / 2, { n: 3, spread: 2.8 }); line(at(tb(33)) + 20, 0, 0, 0.3, 0, 3, 24);
    cross(34, Math.PI * 0.25, { n: 2 });
    lash(tb(35), { dir: 'v', nx: 0.35, piv: 1 }, [-0.2, 0, -0.45, 0]);
    kn(tb(35.5), Math.PI * 1.25, { n: 2 });
    cross(36, 0, { n: 2 });
    sine(at(tb(37)), 8, 30, 0.4, 0.35);                     // breathe: two bars of rings only (rule 2)
    kn(tb(39), 0.3, { n: 2 }); line(at(tb(39)) - 80, -0.2, 0, 0, 0.1, 3, 26);
    lash(tb(40), { dir: 'h', ny: -0.4, piv: -1 }, [0, 0.15, 0, 0.4]);
    kn(tb(40.5), Math.PI * 0.75, { n: 2 });
    cross(41, Math.PI * 0.25, { n: 3, spread: 2.4 });
    lash(tb(42), { dir: 'v', nx: -0.35, piv: -1 }, [0.2, 0, 0.45, 0]);
    kn(tb(42.5), -Math.PI * 0.25, { n: 2 });
    cross(43, 0, { n: 2 });
    kn(tb(44), Math.PI / 2, { n: 2 }); line(at(tb(44)) + 30, 0, -0.1, 0, 0, 4, 28);
    // PAUSE (bars 45-48): out of the root into the cage, slowing. A Shield Cell before the boss; the star beside you.
    line(at(tb(45.2)), 0, 0, 0, 0.2, 5, 30); add(at(tb(45.2)) + 5 * 30 + 10, 'shield-cell', { nx: 0, ny: 0.2 });
    call(tb(46.6), 'THE STAR IS IN THERE. CUT IT LOOSE', 'c-cyan');
    line(at(tb(47.4)), -0.2, 0.1, 0.2, 0.1, 4, 26);
    // ===================================================================================================== ACT 3
    // The boss marker is the engine's, at BOSS_AT. The release's music rides on its sections (see `sections`).
    // THE FIRST BREATH (rootmind bars 37-44): the first 800 m are empty (the engine's rule); then rings into the light
    const o = (s) => atOut(OUT(s));
    add(o(rB(39.5)), 'call', { text: 'THE STAR IS BREATHING', cls: 'c-cyan' });
    line(o(rB(43)), 0, -0.3, 0, 0, 5, 26);                  // 850 m and more after the boss: past the engine's empty 800 m
    sine(o(rB(44.6)), 6, 26, 0.3, 0.25);
    // THE FLARE (bars 45-52 build, 53-68 release at 210 m/s): through opening roots; known whips only, long tells
    line(o(rB(45.4)), 0, 0, 0, 0.2, 5, 28);
    add(o(rB(48)), 'g2-root-whip', { dir: 'h', ny: 0.5, piv: 1, tel: 1.4 }); line(o(rB(48)) - 90, 0, -0.1, 0, -0.35, 4, 26);
    sine(o(rB(49.5)), 6, 28, 0.45, 0.35);
    add(o(rB(51.5)), 'g2-root-whip', { dir: 'v', nx: -0.5, piv: -1, tel: 1.4 }); line(o(rB(51.5)) - 90, 0.1, 0, 0.35, 0, 4, 26);
    add(o(rB(53)), 'call', { text: 'RIDE THE FLARE OUT!', cls: 'c-cyan' });
    for (let b = 54; b <= 67; b += 1) {
      const k = b % 4;
      if (b === 61 || b === 62) { if (b === 61) sine(o(rB(b)), 8, 34, 0.45, 0.35); continue; }   // a breath
      if (k === 2) add(o(rB(b)), 'g2-root-whip', { dir: 'h', ny: b % 8 < 4 ? 0.45 : -0.45, piv: b % 8 < 4 ? 1 : -1, tel: 1.4 });
      else if (k === 0) add(o(rB(b)), 'g2-root-whip', { dir: 'v', nx: b % 8 < 4 ? -0.45 : 0.45, piv: b % 8 < 4 ? 1 : -1, tel: 1.4 });
      const side = k === 2 ? (b % 8 < 4 ? -0.4 : 0.4) : k === 0 ? (b % 8 < 4 ? 0.4 : -0.4) : 0;
      if (k === 2) line(o(rB(b)) - 100, 0, side * 0.6, 0, side, 4, 28); else if (k === 0) line(o(rB(b)) - 100, side * 0.6, 0, side, 0, 4, 28);
      else line(o(rB(b)) - 40, 0, 0, 0.15 * (b % 3 - 1), 0.1, 3, 30);
    }
    // THE DEEP, SET FREE (bars 69-84 and the outro): the Deep swims home with you. Nothing can hurt you.
    sine(o(rB(70)), 10, 34, 0.5, 0.4);
    add(o(rB(71.5)), 'call', { text: 'LOOK WHO CAME WITH YOU', cls: 'c-cyan' });
    sine(o(rB(74.5)), 10, 34, 0.35, 0.28, Math.PI);
    add(o(rB(78.5)), 'call', { text: 'THE DEEP IS FREE', cls: 'c-cyan' });
    line(o(rB(80)), 0, 0.1, 0, 0.3, 8, 34);
    add(o(rB(84)), 'call', { text: 'THE SEED CAME FROM THE EDGE OF EVERYTHING', cls: '' });
    // the finish line, as the part's last bar dies away (with a mid-level boss the engine adds no 'end' of its own)
    add(END_AT, 'end', {});
  },
});
