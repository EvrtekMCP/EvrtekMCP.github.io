// GALAXY 3, LEVEL 10: THE WEFTWORK. The finale of the whole game (the plan's 4.10; DESIGN.md beside this file has the
// beat sheet in full). Three acts, a boss, the unravel and the run home, each on its own part of the music, the course
// laid out in BARS of that music (rule 30). `grid.js` holds the takes' grids: the stand-ins' today, the real takes'
// when they land (a three-line refresh), and every bar below moves with them.
//  ACT 1  THE WARP     warp take, bars 1-56     the loom from outside: warp threads that ring when a shuttle passes,
//                                               then the roll call, every galaxy 3 idea in order
//  ACT 2  THE SHED     shed take, bars 1-48     the dive between the loom's layers at 190-215 m/s: heddles
//  ACT 3  THE WEFTWORK weftwork take, Call and Beat looping   the boss: call and response; THE SHEAR
//  MASTER THE UNRAVEL  weftwork take from bar 37 to its end  the loom comes apart, the unmade stars light again, and
//                                               the run home under all three galaxies' landmarks
import { defineLevel, clamp } from '../../api.js?v=0.6.3';
import ring from '../../pickups/ring/index.js?v=0.6.3';
import pod from '../../enemies/pod/index.js?v=0.6.3';
import shrike from '../../enemies/shrike/index.js?v=0.6.3';
import mines from '../../obstacles/mines/index.js?v=0.6.3';
import crystal from '../../obstacles/crystal/index.js?v=0.6.3';
import rock from '../../obstacles/rock/index.js?v=0.6.3';
import { shieldCell, overclock, mirrorShell, phase, ringMagnet, slipstream } from '../../pickups/powerups/index.js?v=0.6.3';
import warpThread from '../../obstacles/g3-warp-thread/index.js?v=0.6.3';
import heddle from '../../obstacles/g3-heddle/index.js?v=0.6.3';
import { threadWall } from './level10/kinds.js?v=0.6.3';
import { loom, warpSeg, warp, spool, spools, beam, beams, shedSeg, shed, frame, frames, shuttle, shuttles, snapSeg, snap, suns, star } from './level10/scenery.js?v=0.6.3';
import { sunrise, wisp, wisps } from '../level10/scenery.js?v=0.6.3';   // galaxy 1's sunrise over the quiet blue planet
import { CAMEOS, cameoKinds } from './level10/cameos.js?v=0.6.3';
import weftwork, { kinds as weftKinds } from '../../bosses/g3-weftwork/index.js?v=0.6.3';
import { TRACK, barT } from './level10/grid.js?v=0.6.3';

// ---------------------------------------------------------------------------------------------------------------------
// THE SCHEDULE, in seconds of the run, from bars of each take
const WB = (b) => barT('warp', b);                     // act 1: the warp take plays from the run's start
const NEXT = WB(57);                                    // the shed cuts in on the warp's bar 57 line
const SB = (b) => NEXT + barT('shed', b);               // act 2
const BOSS_T = SB(49) - 0.8;                            // the boss marker: the weftwork take cuts in on the shed's bar 49 line
const XB = (b) => barT('weftwork', b);                  // the weftwork take, in its own seconds
const OUT = (s) => s - XB(37);                          // seconds after the course resumes (the take plays on from the Snap)

// speed: [time, m/s] knots, linear between; each step on a section's bar line (rule 6: the speed step first, the
// density a bar after). The plan's: warp 104 to 155, shed 190 to 215, the unravel 220.
const KNOTS_IN = [
  [0, 104], [WB(9), 104], [WB(9) + 1, 118], [WB(25), 118], [WB(25) + 1, 132], [WB(33), 132], [WB(33) + 1, 148], [WB(49), 148], [WB(49) + 1, 155],
  [NEXT - 0.8, 155], [NEXT + 0.2, 190], [SB(5), 190], [SB(5) + 1, 198], [SB(21), 198], [SB(21) + 1, 206], [SB(29), 206], [SB(29) + 1, 215],
  [SB(45), 215], [SB(45) + 5.4, 70], [BOSS_T + 30, 70],
];
const KNOTS_OUT = [
  [0, 70], [OUT(XB(45)), 70], [OUT(XB(45)) + 1, 150], [OUT(XB(53)) - 1, 150], [OUT(XB(53)), 220], [OUT(XB(69)), 220],
  [OUT(XB(69)) + 5, 190], [OUT(XB(85)), 160], [OUT(XB(91)) + 30, 120],
];
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
const at = IN.at;                                       // course distance at time t of the run in
const BOSS_AT = Math.round(at(BOSS_T));
const atOut = (s) => BOSS_AT + OUTT.at(s);              // course distance s seconds after the course resumes
const END_AT = Math.round(atOut(OUT(XB(90.5))));
// distances at a bar of each take
const wb = (b) => at(WB(b)), sb = (b) => at(SB(b)), ob = (b) => atOut(OUT(XB(b)));

// Yori's palette for level 10 (g3-palettes.js): sky #050508, gas wine (kept at 322 deg, clear of the hurts hue, as galaxy
// 1's finale did), ultraviolet #6a3aff and white; fog #140a14. Black and red threads, then violet layers, then white: the
// only level that ends brighter than it starts.
const LOOK = {
  warp: { sky: ['#050508', 'rgba(58,10,40,A)', 'rgba(106,58,255,A)', 'rgba(20,16,40,A)'], fog: 0x140a14, hemiSky: 0xffffff, hemiGround: 0x5a1030, sun: 0xffffff, band: 0.5, gas: 0.7, cloud: 0x3a0a2c, clouds: 0.1, seed: 31001 },
  drop: { sky: ['#06050a', 'rgba(74,14,52,A)', 'rgba(106,58,255,A)', 'rgba(30,20,60,A)'], fog: 0x180c18, hemiSky: 0xffffff, hemiGround: 0x5a1030, sun: 0xffffff, band: 0.5, gas: 0.85, cloud: 0x4a1238, clouds: 0.14, seed: 31002 },
  parting: { sky: ['#07060e', 'rgba(60,30,140,A)', 'rgba(140,110,255,A)', 'rgba(40,20,70,A)'], fog: 0x17102a, hemiSky: 0xf0e8ff, hemiGround: 0x4a2aa0, sun: 0xffffff, band: 0.5, gas: 0.9, cloud: 0x5a3ab0, clouds: 0.12, seed: 31003 },
  shed: { sky: ['#06040c', 'rgba(70,30,180,A)', 'rgba(20,10,50,A)', 'rgba(106,58,255,A)'], fog: 0x17102a, hemiSky: 0xe0d8ff, hemiGround: 0x2a1a6a, sun: 0xffffff, band: 0.5, gas: 0.6, cloud: 0x2a1a6a, clouds: 0, seed: 31004, stars: 200 },
  heart: { sky: ['#08060c', 'rgba(90,30,120,A)', 'rgba(232,238,255,A)', 'rgba(58,10,40,A)'], fog: 0x1a1020, hemiSky: 0xffffff, hemiGround: 0x5a1030, sun: 0xffffff, band: 0.5, gas: 0.6, cloud: 0x4a2a6a, clouds: 0.08, seed: 31005, stars: 300 },
  snap: { sky: ['#100c18', 'rgba(140,100,255,A)', 'rgba(255,255,255,A)', 'rgba(90,40,120,A)'], fog: 0x2a2040, hemiSky: 0xffffff, hemiGround: 0x4a2a80, sun: 0xffffff, band: 0.5, gas: 0.9, cloud: 0x8a70d0, clouds: 0.12, seed: 31006, stars: 300 },
  unravel: { sky: ['#1a1428', 'rgba(200,180,255,A)', 'rgba(255,250,255,A)', 'rgba(120,80,200,A)'], fog: 0x3a3050, hemiSky: 0xffffff, hemiGround: 0x6a4aa0, sun: 0xffffff, band: 0.5, gas: 1.0, cloud: 0xc0b0ff, clouds: 0.14, seed: 31007, stars: 400 },
  // the run home: galaxy 1's sunrise sky (the quiet blue planet), the same numbers as its finale's last look
  home: { sky: ['#4a7ac8', 'rgba(255,176,96,A)', 'rgba(140,190,255,A)', 'rgba(255,210,170,A)'], fog: 0xd8a888, hemiSky: 0xffe8c8, hemiGround: 0x3a5aa0, sun: 0xffd8a0, band: 0.56, gas: 0.6, cloud: 0xffd0b0, clouds: 0.14, seed: 31008, stars: 0 },
};
const W = TRACK.weftwork;
let gcAt = -1; // the outro's GALAXY CLEAR, once per finish

export default defineLevel({
  g: 3, n: 10, id: 'weftwork', name: 'THE WEFTWORK',
  idea: 'The finale cuts the last thread of the engine that weaves the Lattice.',
  seed: 3010,
  length: END_AT,
  speed: (d) => (d <= BOSS_AT ? IN.speedAt(d) : OUTT.speedAt(d - BOSS_AT)),
  music: { track: TRACK.warp },
  // the fight loops the Call and the Beat (bars 5-36); after it each section of the run out jumps the take on to its own
  // section on the next bar line, so the music re-syncs at the snap, at the unravel and at the run home
  bossMusic: { track: W, loop: [XB(5), XB(37)] },
  boss: { at: BOSS_AT, def: weftwork, then: 'continue' },
  // style minimums, [grazes + close calls, deflects] (the plan's rule: A about a quarter of the decent human bot's, S 40%,
  // DEGENERATE 60%). Re-sized (g3-roll, 11-07) for the fight's chords (a weft sent home on one roll) and the thicker roll
  // call and shed: from the decent bot's two runs after them, 61/108 and 30/109 (rings 90%, 88%). Before: 42/37, 37/30,
  // 45/29 gave 10/8, 16/13, 25/19.
  style: { A: [11, 27], S: [18, 43], DEGENERATE: [27, 65] },
  sfx: [{ id: 'boss-warning', gain: 0.61 }, { id: 'boss-hit', gain: 1 }, { id: 'boss-phase', gain: 0.65 }, { id: 'boss-defeat', gain: 1 }, { id: 'crystal-chime', gain: 0.6 },
    { id: 'g3-thread-hum', gain: 0.5 }, { id: 'g3-pluck', gain: 0.6 }, { id: 'g3-heddle', gain: 0.5 }, { id: 'g3-shuttle', gain: 0.5 }, { id: 'g3-beater', gain: 0.8 }, { id: 'g3-shear', gain: 0.9 }, { id: 'g3-unravel', gain: 1 }],
  // a section's sub is also its PERFECT line on the tally, so they stay short
  sections: [
    { id: 'warp', name: 'THE WARP', sub: 'ACT 1', d0: 0, d1: Math.round(wb(33)), look: 'warp', scenery: { 'g3-l10-loom': 1, 'g3-l10-warp': 1, 'g3-l10-spools': 1, 'g3-l10-beams': 1, 'g3-l10-snap': (t) => (t > 0.6 && t < 0.78 ? 0.5 : 0) } },
    { id: 'callback', name: 'THE ROLL CALL', sub: 'THE ROLL CALL', banner: false, d0: Math.round(wb(33)), d1: Math.round(wb(49)), look: 'drop', scenery: { 'g3-l10-loom': 1, 'g3-l10-warp': 1, 'g3-l10-spools': 1.3, 'g3-l10-beams': 1 } },
    { id: 'parting', name: 'THE WEAVE PARTS', sub: 'THE PARTING', banner: false, d0: Math.round(wb(49)), d1: Math.round(at(NEXT - 0.6)), look: 'parting', scenery: { 'g3-l10-loom': (t) => 1 - t, 'g3-l10-warp': 1, 'g3-l10-spools': 0.6, 'g3-l10-shed': (t) => t * 0.5 } },
    { id: 'shed', name: 'THE SHED', sub: 'ACT 2', music: TRACK.shed, d0: Math.round(at(NEXT - 0.6)), d1: Math.round(sb(29)), look: 'shed', scenery: { 'g3-l10-shed': 1, 'g3-l10-frames': 1, 'g3-l10-shuttles': (t) => (t > 0.3 ? 1 : 0) } },
    { id: 'deep', name: 'THE DEEP SHED', sub: 'THE DEEP SHED', banner: false, d0: Math.round(sb(29)), d1: Math.round(sb(45)), look: 'shed', scenery: { 'g3-l10-shed': 1, 'g3-l10-frames': 1.2, 'g3-l10-shuttles': 1.3 } },
    { id: 'heart', name: 'THE WEFTWORK', sub: 'ACT 3', d0: Math.round(sb(45)), d1: BOSS_AT + 1, look: 'heart', scenery: { 'g3-l10-shed': (t) => 1 - 0.75 * t, 'g3-l10-warp': (t) => t, 'g3-l10-frames': (t) => 1 - t } },
    { id: 'snap', name: 'THE UNRAVEL', sub: 'THE SNAP', music: { track: W, from: XB(37), loop: false }, d0: BOSS_AT + 1, d1: Math.round(ob(45)), look: 'snap', scenery: { 'g3-l10-snap': 1, 'g3-l10-warp': (t) => 1 - t * 0.6, 'g3-l10-suns': 1 } },
    { id: 'unravel', name: 'OUTRUN THE UNRAVEL', sub: 'THE UNRAVEL', banner: false, music: { track: W, from: XB(45), loop: false }, d0: Math.round(ob(45)), d1: Math.round(ob(69)), look: 'unravel', scenery: { 'g3-l10-snap': 1.4, 'g3-l10-warp': 0.4, 'g3-l10-suns': 1 } },
    { id: 'home', name: 'THE RUN HOME', sub: 'HOME', music: { track: W, from: XB(69), loop: false }, d0: Math.round(ob(69)), d1: END_AT, look: 'home', scenery: { 'l10-sunrise': 1, 'l10-wisps': 1, 'g3-l10-suns': 1, 'g3-l10-star': 1, 'g3-l10-snap': (t) => (t < 0.1 ? 1 - t * 10 : 0) } },
  ],
  looks: LOOK,
  kinds: [ring, pod, shrike, mines, crystal, rock, shieldCell, overclock, mirrorShell, phase, ringMagnet, slipstream, warpThread, heddle, threadWall, ...weftKinds,
    warpSeg, spool, beam, shedSeg, frame, shuttle, snapSeg, wisp, ...cameoKinds()],
  scenery: [loom, warp, spools, beams, shed, frames, shuttles, snap, suns, star, sunrise, wisps],
  // rule 1: the beat sheet (calm / rising / peak), in metres
  beats: [
    { d: 0, tag: 'calm', what: 'the Weftwork on the horizon; rings in the open; the first warp thread alone, humming, its lens planned white' },
    { d: Math.round(wb(9)), tag: 'rising', what: 'the roll call: blueprint walls, shuttlers, a lockgate, augurs; warp threads between; the cut-thread ring field (Ring Magnet)' },
    { d: Math.round(wb(25)), tag: 'rising', what: 'the speed step first; then plotters and forgeries; crossed threads' },
    { d: Math.round(wb(33)), tag: 'peak', what: 'Overclock into the riveters; fractals; a breather; Mirror Shell into the shuttle crossfire; the vault' },
    { d: Math.round(wb(49)), tag: 'calm', what: 'the weave parts: nothing shoots; Phase through a thread wall to a cache; the shed opens ahead' },
    { d: Math.round(at(NEXT)), tag: 'rising', what: 'the dive into the shed at 190 m/s: the layers of warp close round you' },
    { d: Math.round(sb(5)), tag: 'rising', what: 'heddles: one alone with a long plan, then in turn, up and down; the shuttles throw their weave' },
    { d: Math.round(sb(21)), tag: 'peak', what: 'Slipstream, then the gauntlet: a heddle every half bar; then a calm for the snap-back' },
    { d: Math.round(sb(25)), tag: 'calm', what: 'rings only while the course catches the music' },
    { d: Math.round(sb(29)), tag: 'peak', what: 'the deep shed at 215 m/s: heddles every bar, plucked threads, giant shuttles racing past and throwing at you; a two-bar breather' },
    { d: Math.round(sb(45)), tag: 'calm', what: 'the shed opens on the Weftwork; two Shield Cells; the loom ahead' },
    { d: BOSS_AT, tag: 'peak', what: 'THE WEFTWORK: call and response (a chord in every loop, opening a beat before its note), then the beater\'s combs, then the shear' },
    { d: BOSS_AT + 1, tag: 'calm', what: 'the snap: the loom comes apart, threads whipping outward; the first unmade stars light' },
    { d: Math.round(ob(45)), tag: 'rising', what: 'the build: speed back up to 150; loose threads ringing slow, known and wide' },
    { d: Math.round(ob(53)), tag: 'peak', what: 'outrun the unravel at 220 m/s: threads and falling heddles, all known, big and slow to read' },
    { d: Math.round(ob(69)), tag: 'calm', what: 'the run home: every unmade star lit again, galaxy 2\'s freed star, galaxy 1\'s quiet blue planet; nothing can hurt you' },
  ],
  // rule 19: the four acts
  acts: { introduce: [0, Math.round(at(NEXT - 0.6))], develop: [Math.round(at(NEXT - 0.6)), Math.round(sb(45))], twist: [Math.round(sb(45)), BOSS_AT + 1], master: [BOSS_AT + 1, END_AT] },
  // after the finish line: LEVEL CLEAR over the sunrise, then Yori's GALAXY CLEAR, then the tally
  outro: {
    time: 7,
    update(dt, api, t) {
      if (t < gcAt) gcAt = -1;
      if (gcAt < 0 && t > 1.3) { gcAt = t; api.game.callArt(['galaxy-clear']); api.game.sfx('crystal-chime', { rate: 0.7, vol: 0.7 }); }
    },
  },
  build(R, L) {
    const { add, ring: rg, line, sine } = L;
    const call = (d, text, cls) => add(d, 'call', { text, cls: cls || '' });
    // a warp thread, and the rings on its safe side
    const thr = (d, o) => add(d, 'g3-warp-thread', o);
    // a heddle, and the rings through its shed where it will be (a = 0: the shed's middle is at ny = gy)
    const hed = (d, gy, from, o) => {
      const a = (o && o.a) || 0, half = Math.abs(Math.sin(a)) * 7.5 + Math.abs(Math.cos(a)) * 4.3, c = gy * half;
      const px = clamp(-Math.sin(a) * c / 7.5, -0.9, 0.9), py = clamp(Math.cos(a) * c / 4.3, -0.85, 0.85);
      add(d, 'g3-heddle', Object.assign({ gy, from }, o || {}));
      line(d - 96, px * 0.6, py * 0.6, px, py, 4, 22); rg(d + 10, px, py);
    };
    // =============================================================================================== ACT 1, THE WARP
    // INTRO (bars 1-8, 104 m/s): the loom on the horizon; rings in the open; the first thread alone (rule 4, rule 18)
    line(wb(1.5), 0, -0.2, 0, 0.2, 5, 24);
    sine(wb(3), 8, 22, 0.45, 0.4);
    call(wb(4.4), 'WHEN A THREAD HUMS, KEEP OUT OF THE WHITE', 'c-cyan');
    thr(wb(6), { nx: 0, ny: -0.15, a: 0, B: 2.0, tel: 1.6, lead: 0.7, side: -1 }); line(wb(6) - 110, 0, 0.45, 0, 0.66, 4, 24); rg(wb(6) + 14, 0, 0.66);
    thr(wb(7.6), { nx: 0.2, ny: 0.2, a: 0.5, B: 2.2, tel: 1.4 }); line(wb(7.6) - 110, 0.3, -0.3, 0.6, -0.62, 4, 24); rg(wb(7.6) + 14, 0.62, -0.66);
    // GROOVE (bars 9-24, 118 m/s): the roll call, part one, in the order you met them, warp threads between
    call(wb(9.3), "EVERYTHING YOU'VE BEATEN IS HERE. ONE LAST TIME.", 'c-red');
    sine(wb(9.6), 6, 24, 0.5, 0.35);
    CAMEOS.l1(L, wb(11), R);                                            // 1 the Scaffold: blueprint walls
    thr(wb(12.6), { nx: 0, ny: 0.35, a: 0, B: 2.0 }); line(wb(12.6) - 100, -0.2, -0.3, -0.3, -0.55, 4, 24);
    CAMEOS.l2(L, wb(14), R);                                            // 2 the Loom Floor: shuttlers
    line(wb(14.2), 0.3, -0.4, 0.5, -0.2, 5, 24);
    CAMEOS.shuttle(L, wb(12.2), { rail: 'R', shots: 2 });                // (g3-roll) a shuttle passes on its rail between waves
    CAMEOS.l3(L, wb(16.4), R);                                          // 3 the Lockworks: a lockgate
    CAMEOS.shuttle(L, wb(17.6), { rail: 'L', shots: 2 });
    thr(wb(18), { nx: -0.2, ny: 0, a: Math.PI / 2, B: 2.4, side: 1 }); line(wb(18) - 100, 0.4, 0.2, 0.62, 0, 4, 24);
    CAMEOS.l4(L, wb(19.2), R);                                          // 4 the Augury: augurs
    // the Warp's field of cut-thread rings: a Ring Magnet on the line into it, the rings scattered as the cut threads
    // fell (each one in reach without it: never more than a quarter of the box from the last)
    rg(wb(20.2) - 60, 0, 0.1); add(wb(20.2), 'ring-magnet', { nx: 0, ny: 0.1 });
    { let nx = 0, ny = 0.1; for (let i = 0; i < 14; i++) { nx = clamp(nx + R.range(-0.25, 0.25) + (i % 2 ? 0.12 : -0.12), -0.75, 0.75); ny = clamp(ny + R.range(-0.25, 0.25), -0.65, 0.65); rg(wb(21.2) + i * 30, nx, ny); } }
    // BUILD ONE (bars 25-32, 132 m/s): the speed step on the bar line; plotters and forgeries a bar later
    line(wb(25.3), 0, 0.3, 0, -0.3, 5, 26);
    CAMEOS.l5(L, wb(26.4), R, IN.speedAt(wb(26.4)));                                          // 5 the Drafting Hall: plotters
    thr(wb(28), { nx: 0, ny: 0.05, a: 0.42, B: 1.6 }); thr(wb(28) + 6, { nx: 0, ny: 0.05, a: -0.42, B: 1.6, side: -1 });
    line(wb(28) - 110, 0, 0.5, 0, 0.72, 4, 24); rg(wb(28) + 20, 0, 0.72);
    CAMEOS.shuttle(L, wb(23), { rail: 'R', shots: 3 });                  // through the cut-thread ring field
    CAMEOS.shuttle(L, wb(27.6), { rail: 'L', shots: 2 });
    CAMEOS.l6(L, wb(29.6), R);                                          // 6 the Forgery: forgeries
    CAMEOS.shuttle(L, wb(31.4), { rail: 'R', shots: 2 });
    sine(wb(31.2), 6, 26, 0.5, 0.4, 1.4);
    // DROP ONE (bars 33-48, 148 m/s): the peak of act 1. Overclock into the riveters' strings
    rg(wb(33.6) - 50, 0.2, 0.3); add(wb(33.6), 'overclock', { nx: 0.25, ny: 0.3 }); line(wb(33.6) + 30, 0.3, 0.3, 0.4, 0.2, 3, 24);
    CAMEOS.l7(L, wb(35), R);                                            // 7 the Rivet Line: riveters
    thr(wb(37.4), { nx: 0, ny: -0.3, a: 0.15, B: 2.2 }); line(wb(37.4) - 100, 0.2, 0.4, 0.3, 0.6, 4, 24);
    CAMEOS.l8(L, wb(38.6), R);                                          // 8 the Fractal Yard: fractals
    // a breather: two bars of rings only (rule 2)
    sine(wb(41), 8, 28, 0.42, 0.36);
    // Mirror Shell into the shuttle crossfire: shuttles on both rails firing together (one roll takes both sides)
    line(wb(42.6) - 80, 0, 0, 0, 0, 3, 26); add(wb(42.6), 'mirror-shell', { nx: 0, ny: 0 });
    CAMEOS.crossfire(L, wb(44), R);
    line(wb(44) - 40, 0, -0.1, 0, -0.1, 5, 26);
    thr(wb(45.6), { nx: 0, ny: 0.3, a: -0.2, B: 2.0, side: -1 }); line(wb(45.6) - 100, -0.1, -0.35, 0, -0.6, 4, 24);
    CAMEOS.l9(L, wb(46.8), R);                                          // 9 the Vault: a vault for a ship running hot
    line(wb(48.2), 0, 0.1, 0, 0, 4, 26);
    // BREAKDOWN (bars 49-56, 155 m/s): THE WEAVE PARTS. Nothing shoots. Phase through a thread wall to a cache.
    line(wb(49.4), -0.4, 0.2, -0.45, 0, 4, 26);
    rg(wb(50.2) - 50, -0.2, 0); add(wb(50.2), 'phase', { nx: 0, ny: 0 });                  // taught here, alone (rule 18)
    // the wall stands to the right, its crack, glow and sparks saying what is behind it; the main line runs left
    add(wb(51.4), 'g3-l10-thread-wall', { nx: 0.55, ny: 0, w: 5.2, h: 6.4 });
    for (let i = 0; i < 3; i++) rg(wb(51.4) - 70 + i * 22, 0.2 + i * 0.12, 0, 'ring', { cache: true, noMagnet: true }); // a trail running in
    for (let i = 0; i < 6; i++) rg(wb(51.4) + 18 + i * 20, 0.55, -0.3 + i * 0.12, 'ring', { cache: true, noMagnet: true }); // the cache behind it
    line(wb(51.4) - 60, -0.55, 0, -0.55, 0.1, 6, 26);
    call(wb(53), 'THE WEAVE IS PARTING. DIVE INTO THE SHED!', 'c-cyan');
    line(wb(54), 0.3, 0.2, 0.1, 0.05, 6, 26);
    line(wb(55.6), 0.05, 0, 0, 0, 5, 28);
    // =============================================================================================== ACT 2, THE SHED
    // INTRO (bars 1-4, 190 m/s): the layers close round you. Rings straight down the middle.
    line(sb(1.3), 0, 0, 0, 0, 6, 30);
    sine(sb(3), 6, 30, 0.35, 0.3);
    // GROOVE (bars 5-20, 198 m/s): heddles. The first alone with a long plan, then in turn.
    call(sb(5.6), 'THE WHITE LINES SHOW WHERE THE GAP WILL BE', 'c-cyan');
    hed(sb(7), -0.25, 0.55, { tel: 1.6 });
    hed(sb(9), 0.35, -0.3, { tel: 1.5 });
    hed(sb(11), -0.4, 0.2);
    hed(sb(13), 0.3, -0.35, { a: 0.3 });
    [0.45, -0.35, 0.2, -0.5, 0.3, -0.1].forEach((gy, i) => hed(sb(15 + i), gy, -gy * 0.8 + (i % 2 ? 0.2 : -0.2)));
    // (g3-roll, 11-07: roll demand rises to the end of the game.) The loom's shuttles run its rails beside you through
    // the shed and throw their weave at you between the heddles: roll where it crosses you (the Loom Floor's idea)
    CAMEOS.shuttle(L, sb(8), { rail: 'R', shots: 3 });
    CAMEOS.shuttle(L, sb(12), { rail: 'L', shots: 3 });
    CAMEOS.shuttle(L, sb(16), { rail: 'R', shots: 3 });
    // BUILD ONE (bars 21-28, 206 m/s): Slipstream on the line, then the gauntlet: a heddle every half bar, up, down
    rg(sb(20.6) - 60, -0.05, 0); add(sb(20.6), 'slipstream', { nx: 0, ny: -0.05 });
    // (two bars of it: the slow motion covers about a bar and a half of course, so the snap-back lands in the calm after)
    const GAUNT = [0.42, -0.42, 0.3, -0.45, 0.4];
    GAUNT.forEach((gy, i) => add(sb(21.6 + i * 0.5), 'g3-heddle', { gy, from: -gy, gh: 3.4, tel: 1.3 }));
    GAUNT.forEach((gy, i) => rg(sb(21.6 + i * 0.5) + 8, 0, gy * 0.92));
    // the calm the snap-back needs: rings only (bars 24-28)
    sine(sb(24.6), 6, 30, 0.3, 0.25);
    sine(sb(25.2), 8, 30, 0.35, 0.3);
    line(sb(27.2), 0, 0, 0, 0.2, 5, 30);
    // DROP ONE (bars 29-44, 215 m/s): the deep shed. Speed first, density a bar later.
    line(sb(29.2), 0, 0.2, 0, 0, 4, 30);
    hed(sb(30), 0.4, -0.2);
    hed(sb(31), -0.45, 0.35);
    // the shuttles again, harder, from both rails at once (every throw a pair, one roll takes both): three throws, three
    // more, two after the breather (both rails at once: one roll
    // takes both), and one last pair before the shed opens (none in the breather, none in the pause)
    for (const b of [30, 33]) { CAMEOS.shuttle(L, sb(b), { rail: 'L', shots: 3 }); CAMEOS.shuttle(L, sb(b), { rail: 'R', shots: 3 }); }
    CAMEOS.shuttle(L, sb(39.2), { rail: 'L', shots: 2 }); CAMEOS.shuttle(L, sb(39.2), { rail: 'R', shots: 2 });
    CAMEOS.shuttle(L, sb(41.8), { rail: 'L', shots: 2 }); CAMEOS.shuttle(L, sb(41.8), { rail: 'R', shots: 2 });
    thr(sb(32.2), { nx: 0, ny: 0.4, a: 0, B: 2.0 }); line(sb(32.2) - 110, 0, -0.3, 0, -0.55, 4, 26);
    hed(sb(33), 0.3, -0.4, { a: -0.25 });
    hed(sb(34), -0.3, 0.45);
    hed(sb(35), 0.5, -0.1);
    thr(sb(36.2), { nx: 0, ny: -0.3, a: 0.25, B: 2.2, side: -1 }); line(sb(36.2) - 110, 0.1, 0.3, 0.2, 0.62, 4, 26);
    sine(sb(37.4), 8, 32, 0.4, 0.35);                                   // a breather: two bars of rings (rule 2)
    hed(sb(39), -0.35, 0.3);
    hed(sb(40), 0.4, -0.4);
    hed(sb(41), -0.5, 0.1, { a: 0.3 });
    thr(sb(42.2), { nx: 0, ny: 0.45, a: -0.1, B: 1.9 }); line(sb(42.2) - 110, -0.1, -0.2, -0.1, -0.5, 4, 26);
    hed(sb(43), 0.25, -0.45, { a: -0.3 });
    hed(sb(44), -0.15, 0.4);
    // PAUSE (bars 45-48): out of the shed onto the Weftwork. A Shield Cell at the shed's end, one more before it flies in.
    rg(sb(45.2) - 50, 0, 0.1); add(sb(45.2), 'shield-cell', { nx: 0, ny: 0.1 }); line(sb(45.2) + 40, 0, 0.1, 0, 0, 4, 30);
    call(sb(46.2), 'THE WEFTWORK. CUT THE LAST THREAD.', 'c-red');
    rg(sb(47.6) - 40, 0, 0); add(sb(47.6), 'shield-cell', { nx: 0, ny: 0 });
    // =============================================================================================== ACT 3, THE WEFTWORK
    // The boss marker is added by the engine at BOSS_AT. Nothing is laid in the 800 m after it (the engine's rule).
    // =============================================================================================== THE UNRAVEL
    // THE SNAP (bars 37-44): the loom comes apart round you; the first unmade stars light. Nothing to fly yet.
    // THE BUILD (bars 45-52, back up to 150 m/s): rings, and loose threads ringing slow, wide and known
    line(ob(44.8), 0, -0.3, 0, 0, 5, 26);
    sine(ob(45.8), 6, 26, 0.4, 0.3);
    thr(ob(47.4), { nx: 0, ny: -0.1, a: 0.1, B: 2.0, tel: 1.5 }); line(ob(47.4) - 100, 0.1, 0.4, 0.1, 0.66, 4, 24);
    thr(ob(50), { nx: 0.1, ny: 0, a: Math.PI / 2 - 0.2, B: 2.2, tel: 1.5, side: -1 }); line(ob(50) - 100, -0.3, 0, -0.62, 0.1, 4, 24);
    // THE UNRAVEL (bars 53-68, 220 m/s): outrun it. Threads and falling heddles, every one known, big and slow to read
    // (rule 5: spectacle, not a spike; the hardest stretch was the deep shed and the fight)
    call(ob(53.2), "IT'S ALL COMING APART. GO!", 'c-cyan');
    const unr = [
      ['h', 0.35, -0.2], ['t', 0, 0.3, 0.15], ['h', -0.4, 0.3], ['t', 0, -0.3, -0.2], ['h', 0.3, -0.35],
      ['b'], ['h', -0.3, 0.4], ['t', 0.1, 0.35, 0.05], ['h', 0.45, -0.1], ['t', 0, -0.25, 0.3],
    ];
    unr.forEach((u, i) => {
      const d = ob(54 + i * 1.5);
      if (u[0] === 'h') hed(d, u[1], u[2], { gh: 4.0, tel: 1.6 });
      else if (u[0] === 't') { thr(d, { nx: u[1], ny: u[2], a: u[3], B: 2.0, tel: 1.5 }); const up = u[2] < 0; line(d - 100, 0, up ? 0.45 : -0.45, 0, up ? 0.66 : -0.66, 4, 26); }
      else sine(d - 40, 8, 32, 0.42, 0.35);                             // a breath
    });
    // THE RUN HOME (bars 69-84): out into the light. A slow corkscrew of rings; nothing can hurt you (rule 29's release)
    sine(ob(69.6), 10, 36, 0.5, 0.4);
    call(ob(71), 'EVERY STAR IT TOOK IS SHINING AGAIN', 'c-cyan');
    sine(ob(73.6), 10, 36, 0.32, 0.26, Math.PI);
    call(ob(77.5), 'THREE GALAXIES. ONE SKY.', 'c-cyan');
    line(ob(79), 0, 0.1, 0, 0.3, 8, 36);
    call(ob(82.5), "THAT WAS THE LAST THREAD. LET'S GO HOME.", 'c-cyan');
    sine(ob(84), 8, 36, 0.25, 0.2);
    // the finish line, as the take's last bar dies away (a mid-level boss: the engine adds no 'end' of its own)
    add(END_AT, 'end', {});
  },
});
