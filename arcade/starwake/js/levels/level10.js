// LEVEL 10: THE LATTICE HEART. The finale, in three acts, a boss, an escape and an ending (DESIGN.md beside this file
// has the beat sheet in full). Each act has its own part of the music, and the course is laid out on that music's
// bar lines (rule 30): the plan below is in SECONDS of music, and `at(t)` turns a time into the course distance the
// speed curve reaches at that time. With GREED or a boost the course runs ahead of the music a little; the music
// itself only ever changes on a bar line (the engine's switchTrack), so it never stumbles.
//  ACT 1  THE APPROACH  approach track, bars 1-56   the defence rings, then every enemy in the game, in order
//  ACT 2  THE DIVE      dive track, bars 1-48       the living tunnel at the fastest speed in the game
//  ACT 3  THE CORE      core track, bars 1-36 loop  THE LATTICE HEART; its great beam is the one unreflectable thing
//  OUT    THE ESCAPE    core track from bar 37      outrun the shockwave down the breaking shaft
//  HOME   THE RUN HOME  core track, bars 69-90      a sunrise over a quiet blue planet; nothing can hurt you
import { defineLevel, clamp } from '../api.js?v=0.2.0';
import ring from '../pickups/ring/index.js?v=0.2.0';
import pod from '../enemies/pod/index.js?v=0.2.0';
import shrike from '../enemies/shrike/index.js?v=0.2.0';
import mines from '../obstacles/mines/index.js?v=0.2.0';
import crystal from '../obstacles/crystal/index.js?v=0.2.0';
import { defenceRing, ram, iris, wall, beam, debris, energy } from './level10/kinds.js?v=0.2.0';
import { sphere, strut, struts_, arc, arcs, segment, tunnel, tunnelGlow, chamber, mote, motes, breach, shaftRing, shaft, sunrise, wisp, wisps } from './level10/scenery.js?v=0.2.0';
import { CAMEOS, cameoKinds } from './level10/cameos.js?v=0.2.0';
import heart from '../bosses/lattice-heart/index.js?v=0.2.0';

// ---------------------------------------------------------------------------------------------------------------------
// THE SCHEDULE. Section starts are the tracks' own bar lines (audio/levels/level10/*.json).
const A1 = { groove: 13.863, build: 41.295, drop: 55.01, breakdown: 82.442, next: 96.158 };   // approach.json
const DIVE0 = A1.next;                                                                         // the dive cuts in here
const A2 = { groove: 6.824, build: 33.306, drop: 46.547, pause: 73.029, next: 79.65 };         // dive.json (from its top)
const T2 = (s) => DIVE0 + s;
const BOSS_T = T2(A2.next) - 0.8;     // the boss marker: the core track cuts in on the dive's next bar line
const CORE = { core1: 6.665, collapse: 57.867, build: 70.667, escape: 83.467, peak: 109.068, outro: 134.668, end: 144.01 };
const OUT = (s) => s - CORE.collapse; // seconds after the course resumes, as the core track runs from the Collapse
const CORE_TRACK = 'levels/level10/core';

// speed: [time, m/s] knots for the run up to the boss, then for the run out; linear between knots
const KNOTS_IN = [
  [0, 100], [A1.groove, 100], [A1.groove + 1, 115], [A1.build, 115], [A1.build + 1, 125], [A1.drop, 125], [A1.drop + 1, 140],
  [A1.next - 0.8, 140], [T2(0.2), 172], [T2(A2.groove), 172], [T2(A2.groove + 1), 181], [T2(A2.build), 181], [T2(A2.build + 1), 187],
  [T2(A2.drop), 187], [T2(A2.drop + 1), 197], [T2(A2.pause), 197], [T2(A2.pause + 5.4), 70], [BOSS_T + 30, 70],
];
const KNOTS_OUT = [
  [0, 70], [OUT(CORE.build), 125], [OUT(CORE.escape) - 1, 170], [OUT(CORE.escape), 200], [OUT(CORE.peak), 205],
  [OUT(CORE.peak) + 4, 150], [OUT(CORE.outro), 95], [OUT(CORE.end) + 30, 75],
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
const at = IN.at;                                     // course distance at time t (s) of the run in
const BOSS_AT = Math.round(at(BOSS_T));
const atOut = (s) => BOSS_AT + OUTT.at(s);            // course distance s seconds after the course resumes
const END_AT = Math.round(atOut(OUT(CORE.end) - 0.6));

const LOOK = {
  approach: { sky: ['#0a0208', 'rgba(74,10,48,A)', 'rgba(0,0,0,A)', 'rgba(58,10,42,A)'], fog: 0x1a0614, hemiSky: 0xfff4ff, hemiGround: 0x5a1020, sun: 0xffe8f4, band: 0.5, gas: 0.8, cloud: 0x4a0a30, clouds: 0.12, seed: 1001 },
  grid: { sky: ['#0c0208', 'rgba(90,12,56,A)', 'rgba(20,0,10,A)', 'rgba(70,14,60,A)'], fog: 0x200818, hemiSky: 0xfff4ff, hemiGround: 0x6a1428, sun: 0xfff0f8, band: 0.5, gas: 0.95, cloud: 0x5a0a3a, clouds: 0.18, seed: 1002 },
  split: { sky: ['#100208', 'rgba(110,16,64,A)', 'rgba(10,0,6,A)', 'rgba(80,20,70,A)'], fog: 0x240a1c, hemiSky: 0xffe0f0, hemiGround: 0x7a1a30, sun: 0xffffff, band: 0.5, gas: 1.0, cloud: 0x6a1040, clouds: 0.2, seed: 1003 },
  dive: { sky: ['#060104', 'rgba(60,8,40,A)', 'rgba(0,0,0,A)', 'rgba(40,6,30,A)'], fog: 0x120410, hemiSky: 0xffd8ec, hemiGround: 0x501020, sun: 0xffe0f0, band: 0.5, gas: 0.5, cloud: 0x3a0828, clouds: 0, seed: 1004, stars: 200 },
  core: { sky: ['#0c0410', 'rgba(110,30,90,A)', 'rgba(255,244,255,A)', 'rgba(60,10,50,A)'], fog: 0x1c0a1c, hemiSky: 0xfff4ff, hemiGround: 0x5a1020, sun: 0xffffff, band: 0.5, gas: 0.6, cloud: 0x6a2a6a, clouds: 0.1, seed: 1005, stars: 300 },
  collapse: { sky: ['#140612', 'rgba(140,40,110,A)', 'rgba(255,230,255,A)', 'rgba(90,20,70,A)'], fog: 0x2a1028, hemiSky: 0xffffff, hemiGround: 0x6a2030, sun: 0xffffff, band: 0.5, gas: 0.9, cloud: 0x8a4080, clouds: 0.12, seed: 1006, stars: 200 },
  escape: { sky: ['#1a0c1a', 'rgba(200,120,190,A)', 'rgba(255,240,255,A)', 'rgba(120,60,120,A)'], fog: 0x3a2038, hemiSky: 0xffffff, hemiGround: 0x7a3048, sun: 0xffffff, band: 0.5, gas: 1.0, cloud: 0xc080c0, clouds: 0.12, seed: 1007, stars: 100 },
  home: { sky: ['#4a7ac8', 'rgba(255,176,96,A)', 'rgba(140,190,255,A)', 'rgba(255,210,170,A)'], fog: 0xd8a888, hemiSky: 0xffe8c8, hemiGround: 0x3a5aa0, sun: 0xffd8a0, band: 0.56, gas: 0.6, cloud: 0xffd0b0, clouds: 0.14, seed: 1008, stars: 0 },
};

export default defineLevel({
  n: 10, id: 'heart', name: 'THE LATTICE HEART',
  idea: 'The finale dives into the machine itself to break its heart.',
  seed: 1010,
  length: END_AT,
  speed: (d) => (d <= BOSS_AT ? IN.speedAt(d) : OUTT.speedAt(d - BOSS_AT)),
  music: { track: 'levels/level10/approach' },
  // the fight loops Core one and Core two. After it, each section of the run out jumps the take to its own section on
  // the next bar line (from the Collapse on, once, to the end): the music re-syncs at the escape and at the sunrise.
  bossMusic: { track: CORE_TRACK, loop: [CORE.core1, CORE.collapse] },
  boss: { at: BOSS_AT, def: heart, then: 'continue' },
  sfx: [{ id: 'boss-warning', gain: 0.61 }, { id: 'boss-hit', gain: 1 }, { id: 'boss-phase', gain: 0.65 }, { id: 'boss-defeat', gain: 1 }],
  boostMul: 1.4,   // level 2's boost chain comes back in act 1, so the warning check runs at the boosted speed too
  // ranksFrom(414,047): a NON-god autopilot run of the whole level (NOGOD=1 run.js popin: 307 of 358 rings, 14 hits,
  // the Heart beaten, cleared), 2026-11-05
  ranks: [['DEGENERATE', 370000], ['S', 255000], ['A', 160000], ['B', 80000], ['C', 0]],
  sections: [
    { id: 'approach', name: 'THE APPROACH', sub: 'ACT 1', d0: 0, d1: Math.round(at(A1.drop)), look: 'approach', scenery: { 'l10-sphere': 1, 'l10-struts': 1, 'l10-arcs': 1 } },
    { id: 'grid', name: 'THE DEFENCE GRID', sub: 'THE GRID', banner: false, d0: Math.round(at(A1.drop)), d1: Math.round(at(A1.breakdown)), look: 'grid', scenery: { 'l10-sphere': 1, 'l10-struts': 1.4, 'l10-arcs': 1.2 } },
    { id: 'split', name: 'THE SPLIT', sub: 'THE SPLIT', banner: false, d0: Math.round(at(A1.breakdown)), d1: Math.round(at(A1.next - 0.6)), look: 'split', scenery: { 'l10-sphere': 1, 'l10-struts': 0.7, 'l10-arcs': 0.6 } },
    { id: 'dive', name: 'THE DIVE', sub: 'ACT 2', music: 'levels/level10/dive', d0: Math.round(at(A1.next - 0.6)), d1: Math.round(at(T2(A2.drop))), look: 'dive', scenery: { 'l10-tunnel': 1, 'l10-tunnel-glow': 1 } },
    { id: 'deep', name: 'THE DEEP MACHINE', sub: 'THE DEEP', banner: false, d0: Math.round(at(T2(A2.drop))), d1: Math.round(at(T2(A2.pause))), look: 'dive', scenery: { 'l10-tunnel': 1, 'l10-tunnel-glow': 1 } },
    { id: 'core', name: 'THE CORE', sub: 'ACT 3', d0: Math.round(at(T2(A2.pause))), d1: BOSS_AT + 1, look: 'core', scenery: { 'l10-tunnel': (t) => (t < 0.45 ? 1 - t / 0.45 : 0), 'l10-chamber': (t) => clamp((t - 0.3) / 0.5, 0, 1), 'l10-motes': (t) => clamp((t - 0.2) / 0.4, 0, 1) } },
    { id: 'collapse', name: 'GET OUT', sub: 'THE COLLAPSE', music: { track: CORE_TRACK, from: CORE.collapse, loop: false }, d0: BOSS_AT + 1, d1: Math.round(atOut(OUT(CORE.build))), look: 'collapse', scenery: { 'l10-chamber': (t) => 1 - t, 'l10-motes': 1, 'l10-breach': 1 } },
    { id: 'escape', name: 'THE ESCAPE', sub: 'THE ESCAPE', banner: false, music: { track: CORE_TRACK, from: CORE.build, loop: false }, d0: Math.round(atOut(OUT(CORE.build))), d1: Math.round(atOut(OUT(CORE.peak))), look: 'escape', scenery: { 'l10-shaft': 1, 'l10-breach': 1, 'l10-motes': 0.6 } },
    { id: 'home', name: 'THE RUN HOME', sub: 'SUNRISE', music: { track: CORE_TRACK, from: CORE.peak, loop: false }, d0: Math.round(atOut(OUT(CORE.peak))), d1: END_AT, look: 'home', scenery: { 'l10-sunrise': 1, 'l10-wisps': 1, 'l10-shaft': (t) => (t < 0.05 ? 1 - t / 0.05 : 0) } },
  ],
  looks: LOOK,
  kinds: [ring, pod, shrike, mines, crystal, defenceRing, ram, iris, wall, beam, debris, energy, strut, arc, segment, mote, shaftRing, wisp, ...cameoKinds()],
  scenery: [sphere, struts_, arcs, tunnel, tunnelGlow, chamber, motes, breach, shaft, sunrise, wisps],
  // a section's sub is also its PERFECT line on the tally, so they stay short
  // rule 1: the beat sheet (calm / rising / peak), in metres
  beats: [
    { d: 0, tag: 'calm', what: 'the Lattice ahead; rings in the open; the first defence ring, alone, half open, slow' },
    { d: Math.round(at(A1.groove)), tag: 'rising', what: 'the roll call: pods, the boost chain, gate turrets, seekers, defence rings between' },
    { d: Math.round(at(A1.build)), tag: 'rising', what: 'snipers and ice mines; counter-turning ring pairs (speed step first, density after)' },
    { d: Math.round(at(A1.drop)), tag: 'peak', what: 'the defence grid: swarms, searchlight sentries, crystal emitters, ring pairs' },
    { d: Math.round(at(A1.breakdown)), tag: 'calm', what: 'the split: nothing shoots; the shell opens ahead, the rings lead in' },
    { d: Math.round(at(T2(0))), tag: 'rising', what: 'the dive: the tunnel closes round you at 172 m/s' },
    { d: Math.round(at(T2(A2.groove))), tag: 'rising', what: 'pistons: one alone with a long tell, then a ram every bar' },
    { d: Math.round(at(T2(A2.build))), tag: 'rising', what: 'iris doors: one centred and wide, then off-centre holes' },
    { d: Math.round(at(T2(A2.drop))), tag: 'peak', what: 'the drop at 197 m/s: irises and ram pairs alternating; a two-bar breather in the middle' },
    { d: Math.round(at(T2(A2.pause))), tag: 'calm', what: 'the pause: the tunnel opens into the core chamber; the eye far ahead' },
    { d: BOSS_AT, tag: 'peak', what: 'THE LATTICE HEART: volleys, then the great beam, then the piston wall' },
    { d: BOSS_AT + 1, tag: 'calm', what: 'the collapse: the eye has gone; the breach opens where it was' },
    { d: Math.round(atOut(OUT(CORE.build))), tag: 'rising', what: 'into the shaft: the shockwave behind you, the first torn plates' },
    { d: Math.round(atOut(OUT(CORE.escape))), tag: 'peak', what: 'outrun it at 200 m/s: plates and dead rams, all known, big and slow to read' },
    { d: Math.round(atOut(OUT(CORE.peak))), tag: 'calm', what: 'the burst out: a sunrise over a quiet blue planet; a slow corkscrew of rings; nothing hurts' },
  ],
  // rule 19: the four acts
  acts: { introduce: [0, Math.round(at(A1.next - 0.6))], develop: [Math.round(at(A1.next - 0.6)), Math.round(at(T2(A2.pause)))], twist: [Math.round(at(T2(A2.pause))), BOSS_AT + 1], master: [BOSS_AT + 1, END_AT] },
  // the sunrise holds a moment after the finish line, before the tally
  outro: { time: 5, update(dt, api, t) { } },
  build(R, L) {
    const { add, ring: rg, line, sine } = L;
    const call = (t, text, cls) => add(at(t), 'call', { text, cls: cls || '' });
    // a defence ring at time t, with amber rings leading into the gap it wants you to take
    const dring = (t, o) => {
      const d = at(t), gnx = o.gnx ?? 1, gny = o.gny ?? 0, m = Math.hypot(gnx, gny) || 1, rx = gnx / m * 0.62, ry = gny / m * 0.6;
      add(d, 'l10-defence-ring', Object.assign({ blades: 3, width: 1.1, spin: 0.45 }, o));
      line(d - 72, rx * 0.4, ry * 0.4, rx, ry, 3, 22); rg(d + 14, rx, ry);
    };
    // ===================================================================================================== ACT 1
    // INTRO (bars 1-8): open, slow. Rings, and the first defence ring alone, half open, turning slowly.
    line(at(1.5), 0, -0.2, 0, 0.2, 5, 24);
    sine(at(5.0), 8, 22, 0.45, 0.4);
    dring(10.6, { blades: 2, width: 1.25, spin: 0.22, gnx: 0.85, gny: 0.25 });
    line(at(12.2), 0.6, 0.2, 0, 0, 4, 24);
    // GROOVE (bars 9-24): the roll call, part 1, in the order you met them
    call(A1.groove + 0.3, 'THE WHOLE LATTICE IS WAITING', 'c-red');
    CAMEOS.l1(L, at(15.2), R);                                 // level 1: lantern pods (roll into their fire)
    sine(at(16.5), 6, 24, 0.5, 0.35, 1.2);
    CAMEOS.l2(L, at(19.6), R);                                 // level 2: a boost-ring chain and a strafer pair
    dring(23.6, { blades: 3, width: 1.05, spin: 0.42, gnx: -0.7, gny: 0.6 });
    CAMEOS.l3(L, at(26.4), R);                                 // level 3: gate turrets
    line(at(28.6), -0.6, -0.4, 0.6, -0.4, 5, 24);
    CAMEOS.l4(L, at(32.2), R);                                 // level 4: seeker drones
    sine(at(33.6), 6, 24, 0.55, 0.45, 0.4);
    dring(37.6, { blades: 3, width: 1.1, spin: -0.5, gnx: 0.1, gny: -1 });
    add(at(39.6), 'mines', { nx: -0.45, ny: 0.35, n: 5 }); line(at(39.0), 0.5, -0.3, 0.6, -0.4, 3, 22);
    // BUILD ONE (bars 25-32): the speed steps first; then snipers and ice mines
    line(at(41.6), 0, 0.5, 0, -0.5, 5, 26);
    CAMEOS.l5(L, at(44.4), R);                                 // level 5: snipers
    dring(47.4, { blades: 3, width: 1.0, spin: 0.55, gnx: 1, gny: -0.2 });
    dring(48.2, { blades: 3, width: 1.0, spin: -0.55, gnx: 1, gny: -0.2 });
    CAMEOS.l6(L, at(50.8), R);                                 // level 6: ice mines
    sine(at(52.6), 6, 24, 0.5, 0.45, 2.2);
    // DROP ONE (bars 33-48): THE DEFENCE GRID. The peak of act 1.
    CAMEOS.l7(L, at(56.8), R);                                 // level 7: a swarm
    line(at(57.4), -0.6, 0.4, 0.6, -0.4, 5, 24);
    dring(60.6, { blades: 4, width: 0.8, spin: 0.7, gnx: -0.6, gny: -0.7 });
    add(at(61.4), 'pod', { nx: 0.5, ny: 0.7, drift: -1.5, bursts: 2, shots: 2 });
    CAMEOS.l8(L, at(64.0), R);                                 // level 8: searchlight sentries
    sine(at(65.0), 6, 24, 0.5, 0.4, 3.0);
    CAMEOS.l9(L, at(67.6), R);                                 // level 9: crystal emitters
    dring(71.0, { blades: 3, width: 1.0, spin: 0.62, gnx: -1, gny: 0.3 });
    dring(71.8, { blades: 3, width: 1.0, spin: -0.62, gnx: -1, gny: 0.3 });
    add(at(73.0), 'mines', { nx: 0.4, ny: -0.3, n: 5 });
    add(at(74.4), 'pod', { nx: -0.6, ny: 0.6, drift: 1.8, bursts: 2, shots: 3 });
    add(at(75.0), 'shrike', { side: 1, ny: 0.5, shots: 3 });
    line(at(75.6), 0.6, -0.5, -0.2, 0.2, 5, 24);
    dring(78.2, { blades: 3, width: 0.95, spin: 0.85, gnx: 0.3, gny: 1 });
    sine(at(79.6), 6, 24, 0.4, 0.35, 0.8);
    // BREAKDOWN (bars 49-56): THE SPLIT. Nothing shoots; the shell opens ahead; the rings lead in.
    call(A1.breakdown + 0.8, 'THE SHELL IS OPEN: DIVE!', 'c-cyan');
    line(at(83.4), 0.5, 0.4, 0.15, 0.1, 6, 26);
    line(at(87.4), 0.1, 0.05, 0, 0, 6, 28);
    sine(at(91.4), 8, 26, 0.22, 0.2);
    // ===================================================================================================== ACT 2
    // INTRO (bars 1-4): through the split. Rings straight down the middle.
    line(at(T2(0.6)), 0, 0, 0, 0, 6, 30);
    sine(at(T2(3.2)), 6, 30, 0.35, 0.3);
    // GROOVE (bars 5-20): pistons. The first alone, a long tell, a wide way past; then one ram a bar.
    const BAR2 = 1.65513, bar2 = (b) => T2(0.204 + (b - 1) * BAR2);
    const rm = (b, side, edge, o) => add(at(bar2(b)), 'l10-ram', Object.assign({ side, edge }, o || {}));
    rm(7, 'top', 0.15, { tel: 1.6 }); line(at(bar2(7)) - 110, 0, -0.3, 0, -0.55, 5, 22);
    rm(9, 'bottom', -0.15, { tel: 1.4 }); line(at(bar2(9)) - 110, 0, 0.3, 0, 0.55, 5, 22);
    rm(11, 'left', -0.1, { tel: 1.3 }); line(at(bar2(11)) - 110, 0.3, 0, 0.6, 0, 5, 22);
    rm(13, 'right', 0.1, { tel: 1.3 }); line(at(bar2(13)) - 110, -0.3, 0, -0.6, 0, 5, 22);
    rm(15, 'top', 0.35); rm(15, 'bottom', -0.35); line(at(bar2(15)) - 90, 0, 0, 0, 0, 4, 24);
    rm(16, 'left', -0.3); rm(16, 'right', 0.3); rg(at(bar2(16)) + 10, 0, 0);
    rm(17, 'top', -0.25); line(at(bar2(17)) - 80, 0.4, -0.6, -0.4, -0.6, 4, 22);
    rm(18, 'right', -0.2); line(at(bar2(18)) - 80, -0.6, 0.3, -0.6, -0.3, 4, 22);
    rm(19, 'bottom', 0.25); line(at(bar2(19)) - 80, -0.3, 0.6, 0.3, 0.6, 4, 22);
    rm(20, 'left', 0.2); line(at(bar2(20)) - 80, 0.6, -0.3, 0.6, 0.3, 4, 22);
    // BUILD ONE (bars 21-28): iris doors. The first centred and wide; then the hole moves.
    const ir = (b, cnx, cny, a, o) => { const d = at(bar2(b)); add(d, 'l10-iris', Object.assign({ cnx, cny, a }, o || {})); line(d - 96, cnx * 0.5, cny * 0.5, cnx, cny, 4, 24); rg(d + 4, cnx, cny); };
    ir(22, 0, 0, 3.8, { tel: 1.6 });
    ir(24, 0.45, 0.3, 3.4);
    ir(26, -0.5, -0.25, 3.3);
    ir(28, 0.3, -0.45, 3.2);
    // DROP ONE (bars 29-44): the deep machine at 197 m/s. Irises and ram pairs alternate; bars 37-38 breathe.
    ir(29, -0.4, 0.4, 3.2, { spin: 1 });
    rm(30, 'top', 0.3); rm(30, 'bottom', -0.3); rg(at(bar2(30)) + 10, 0, 0);
    ir(31, 0.5, 0.0, 3.1);
    rm(32, 'left', 0.05); rm(32, 'top', 0.4); rg(at(bar2(32)) + 10, 0.6, -0.4);
    ir(33, -0.2, -0.45, 3.1, { spin: -1 });
    rm(34, 'right', -0.05); rm(34, 'bottom', -0.4); rg(at(bar2(34)) + 10, -0.6, 0.45);
    ir(35, 0.35, 0.45, 3.0);
    rm(36, 'left', -0.3); rm(36, 'right', 0.3); rg(at(bar2(36)) + 10, 0, 0);
    sine(at(bar2(37)), 8, 30, 0.4, 0.35);                    // breathe: two bars of rings only (rule 2)
    ir(39, 0, 0, 3.0, { spin: 1 });
    rm(40, 'top', -0.1); rg(at(bar2(40)) + 10, 0, -0.6);
    ir(41, -0.5, -0.3, 3.0);
    rm(42, 'bottom', 0.1); rg(at(bar2(42)) + 10, 0, 0.6);
    ir(43, 0.45, 0.25, 3.0, { spin: -1 });
    rm(44, 'left', -0.3); rm(44, 'right', 0.3); rg(at(bar2(44)) + 10, 0, 0);
    // PAUSE (bars 45-48): out of the tunnel into the core chamber. Rings, slowing.
    line(at(T2(A2.pause + 0.6)), 0, 0, 0, 0.2, 5, 30);
    call(T2(A2.pause + 2.6), 'THE HEART OF THE LATTICE', 'c-red');
    // ===================================================================================================== ACT 3
    // The boss marker is added by the engine at BOSS_AT. The run out's music rides on its sections (see `sections`).
    // THE COLLAPSE (bars 37-44): the first 800 m are empty (the engine's rule); then rings into the breach
    const o = (s) => atOut(OUT(s));
    line(o(CORE.collapse + 9.2), 0, -0.3, 0, 0, 5, 26);
    // THE BUILD (bars 45-52): into the shaft; the first torn plates, slow and alone
    sine(o(CORE.build + 0.6), 6, 26, 0.4, 0.3);
    const plate = (s, nx, ny, drift, r) => add(o(s), 'l10-debris', { nx, ny, drift: drift || 0, r: r || 2.8, spin: R.range(0.5, 1.1), ph: R() * 6 });
    plate(CORE.build + 3.2, 0.5, 0.3, -0.6); line(o(CORE.build + 3.2) - 70, -0.2, -0.3, -0.5, -0.4, 3, 22);
    plate(CORE.build + 6.4, -0.5, -0.2, 0.8); line(o(CORE.build + 6.4) - 70, 0.2, 0.3, 0.5, 0.4, 3, 22);
    plate(CORE.build + 9.6, 0.1, 0.4, 0); line(o(CORE.build + 9.6) - 70, 0, -0.3, 0, -0.55, 3, 22);
    // THE ESCAPE (bars 53-68): outrun it. Plates and dead rams, every bar, the rings on the way past.
    for (let b = 0; b < 15; b++) {
      const s = CORE.escape + 0.8 + b * 1.6, k = b % 5;
      if (b === 7) { sine(o(s), 6, 30, 0.45, 0.35); continue; }  // a breath
      if (k === 0) { plate(s, -0.45, 0.3, 1.2, 3.0); plate(s, 0.5, -0.35, -1.0, 2.6); rg(o(s) + 8, 0.45, 0.35); }
      else if (k === 1) { add(o(s), 'l10-ram', { side: 'top', edge: 0.1, still: true }); line(o(s) - 70, 0.2, -0.4, 0, -0.55, 3, 22); }
      else if (k === 2) { plate(s, 0.3, 0.3, -1.4, 3.0); rg(o(s) + 8, -0.5, -0.4); }
      else if (k === 3) { add(o(s), 'l10-ram', { side: 'left', edge: -0.05, still: true }); line(o(s) - 70, 0.3, 0.1, 0.55, 0, 3, 22); }
      else { plate(s, -0.2, -0.45, 0.6, 2.8); plate(s, 0.55, 0.5, -0.6, 2.4); rg(o(s) + 8, 0.1, 0.3); }
    }
    add(o(CORE.escape), 'call', { text: 'OUTRUN THE SHOCKWAVE!', cls: 'c-cyan' });
    // THE PEAK (bars 69-84): out into the sunrise. A slow corkscrew of rings; nothing can hurt you.
    sine(o(CORE.peak + 1.2), 10, 34, 0.5, 0.4);
    add(o(CORE.peak + 6.4), 'call', { text: 'THE LATTICE IS BROKEN', cls: 'c-cyan' });
    add(o(CORE.outro - 3.2), 'call', { text: 'TAKE IT HOME, WAKE', cls: 'c-cyan' });
    sine(o(CORE.peak + 8.5), 10, 34, 0.32, 0.26, Math.PI);
    line(o(CORE.peak + 16), 0, 0.1, 0, 0.3, 8, 34);
    // the finish line, as the take's last bar dies away (with a mid-level boss the engine adds no 'end' of its own)
    add(END_AT, 'end', {});
  },
});
