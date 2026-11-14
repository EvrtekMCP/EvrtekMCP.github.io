// LEVEL 6: FROZEN RIFT. A comet's ice canyon, tight pale walls, a dense bright fog (Yori's look, level-06 sheet).
// HEADLINE (rule 20): the Leviathan hunts you down the canyon. Everything else supports it: the ice mine (this level's
// enemy, js/obstacles/ice-mine), the canyon's spurs, curtains and forks (js/levels/level6/kinds.js), and the boss
// that ends it (js/bosses/leviathan). The design, the beat sheet and the reasons are in level6/DESIGN.md.
//
// One schedule with the music (rule 30): the level's track (audio/levels/level6/music, 135 bpm, B minor, the
// Leviathan's key) is laid out in bars: intro 8, groove 16, build 8, DROP 16, breakdown 8, build 8, DROP 16, drive.
// Each pass is timed so its head reaches you ON a bar line; the speed steps, the forks, the set pieces and the boss
// sit on bar lines; the four acts follow the track's sections (bars below count from 0 at the first beat).
import { defineLevel, clamp, smoothstep } from '../api.js?v=0.6.4';
import ring from '../pickups/ring/index.js?v=0.6.4';
import iceMine from '../obstacles/ice-mine/index.js?v=0.6.4';
import { spur, curtain, fork, pass, icefall } from './level6/kinds.js?v=0.6.4';
import { RIFT, SCENERY, DECOR, mouthGap } from './level6/scenery.js?v=0.6.4';
import leviathan from '../bosses/leviathan/index.js?v=0.6.4';

// ---- the clock: the track's kick grid (music.json: bpm 134.999, firstBeat 0.0054 s)
const BAR = 1.77779, FIRST_BEAT = 0.0054;
const barT = (n) => FIRST_BEAT + n * BAR;
// ---- speed (rule 6): four clear steps on bar lines, each eased over 150 m in a calm stretch, never with a density step
const V0 = 84, STEP = 16, STEP_BARS = [21, 48, 64];
const STEPS = [];
let speed = (d) => V0 + STEP * STEPS.reduce((s, d0) => s + smoothstep(d0, d0 + 150, d), 0);
// distance <-> time at that speed, from a table (5 m steps), so set pieces can be placed by bar
let TAB = null;
const table = () => { const t = [0]; for (let d = 5; d <= 20000; d += 5) t.push(t[t.length - 1] + 5 / speed(d - 2.5)); TAB = t; };
const timeAt = (d) => { const i = clamp(Math.floor(d / 5), 0, TAB.length - 2), f = d / 5 - i; return TAB[i] + (TAB[i + 1] - TAB[i]) * f; };
const distAt = (t) => { let lo = 0, hi = TAB.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TAB[m] < t) lo = m; else hi = m; } return (lo + (t - TAB[lo]) / (TAB[hi] - TAB[lo])) * 5; };
for (const bar of STEP_BARS) { table(); STEPS.push(Math.round(distAt(barT(bar)))); } // each step where its bar falls at the speeds before it
table();
const B = (n) => Math.round(distAt(barT(n))); // course distance of bar line n
const barOf = (d) => Math.round((timeAt(d) - FIRST_BEAT) / BAR * 2) / 2; // the nearest half-bar line to distance d
const BOSS_BAR = 79;
const BOSS_AT = B(BOSS_BAR);

// ---- the canyon's width: wide at the mouth, closing in, tight all the way, and at the end it opens into the cavern
// where the Leviathan turns (the boss's arena: its body coils across it)
RIFT.gapAt = (d) => (d < 900 ? mouthGap(d) : 3 + 8 * smoothstep(BOSS_AT - 700, BOSS_AT - 100, d));

// where the rings go while a pass has a lane: the other half
const SAFE = { L: [0.58, 0], R: [-0.58, 0], T: [0, -0.55], B: [0, 0.55], EL: [0, 0], ER: [0, 0] };
const WARN_NEW = 1.5, WARN = 1.25; // rule 12: a new hazard 1.2 s or more; the checker holds every pass in its own level to 1.2

export default defineLevel({
  n: 6, id: 'rift', name: 'FROZEN RIFT',
  idea: 'The Leviathan hunts you down a tight ice canyon.',
  seed: 606,
  length: BOSS_AT + 900,
  speed,
  music: { track: 'levels/level6/music' },
  bossMusic: 'bosses/leviathan',
  sfx: [{ id: 'ice-crack', gain: 1 }],
  // the autopilot's total (god mode, every shot rolled, GREED taken): ~583k on 11-05 (score 512.8k + the boss 60k + shield 10k)
  sections: [
    { id: 'mouth', name: 'THE RIFT MOUTH', sub: 'SECTOR 1', d0: 0, d1: STEPS[0], scenery: { 'l6-walls': 1, 'l6-shards': 1, 'l6-spray': 1, 'l6-ribs': 1, 'l6-floor': 1 } },
    { id: 'narrows', name: 'THE NARROWS', sub: 'SECTOR 2', d0: STEPS[0], d1: STEPS[1], scenery: { 'l6-walls': 1, 'l6-shards': 1, 'l6-spray': 1, 'l6-ribs': 0.6, 'l6-floor': 1 } },
    { id: 'forks', name: 'THE FORKS', sub: 'SECTOR 3', d0: STEPS[1], d1: STEPS[2], scenery: { 'l6-walls': 1, 'l6-shards': 1, 'l6-spray': 1, 'l6-ribs': 1, 'l6-floor': 1 } },
    { id: 'throat', name: 'THE THROAT', sub: 'FINAL STRETCH', d0: STEPS[2], d1: BOSS_AT + 900, scenery: { 'l6-walls': 1, 'l6-shards': 1, 'l6-spray': 1, 'l6-ribs': 0.7, 'l6-floor': 1 } },
  ],
  // Yori's palette (palettes.js, level 6): sky #050a14, gas #7ab8e0 #c0ffe8 #0a2040, fog #9ccce8, key #eaf8ff, fill
  // #143060. The only bright-fog level: the distance is pale, not dark. The sections drift a little colder as you go.
  looks: {
    mouth: { sky: ['#050a14', 'rgba(122,184,224,A)', 'rgba(192,255,232,A)', 'rgba(10,32,64,A)'], fog: 0x9ccce8, hemiSky: 0xeaf8ff, hemiGround: 0x143060, sun: 0xeaf8ff, band: 0.55, gas: 0.6, cloud: 0xc0ffe8, clouds: 0.18, seed: 601 },
    narrows: { sky: ['#040812', 'rgba(122,184,224,A)', 'rgba(160,220,240,A)', 'rgba(10,32,64,A)'], fog: 0x90c4e4, hemiSky: 0xe0f4ff, hemiGround: 0x102a58, sun: 0xeaf8ff, band: 0.5, gas: 0.55, cloud: 0xb0e8f0, clouds: 0.22, seed: 602 },
    forks: { sky: ['#03060f', 'rgba(100,160,220,A)', 'rgba(192,255,232,A)', 'rgba(8,24,56,A)'], fog: 0x84bce0, hemiSky: 0xd8f0ff, hemiGround: 0x0e2650, sun: 0xe4f6ff, band: 0.5, gas: 0.5, cloud: 0xc0ffe8, clouds: 0.26, seed: 603 },
    throat: { sky: ['#02040a', 'rgba(140,200,235,A)', 'rgba(220,250,255,A)', 'rgba(10,32,64,A)'], fog: 0xa8d6ee, hemiSky: 0xf0faff, hemiGround: 0x143060, sun: 0xffffff, band: 0.6, gas: 0.65, cloud: 0xe0fff6, clouds: 0.3, seed: 604 },
  },
  kinds: [ring, iceMine, spur, curtain, fork, pass, icefall, ...DECOR],
  scenery: SCENERY,
  boss: { at: BOSS_AT, def: leviathan, then: 'finish' },
  // rule 1: the beat sheet (calm / rising / peak), in metres; the bar and the track's section in the text
  beats: [
    { d: 0, tag: 'calm', what: 'bar 0, intro: the rift mouth; the walls close in from wide to tight; rings in the open' },
    { d: B(8), tag: 'calm', what: 'bar 8, groove: the first ice mine, alone, on the ring line: the rings lead into its eye' },
    { d: B(10.5), tag: 'rising', what: 'bars 10-14: spurs from the walls, a curtain overhead, more mines' },
    { d: B(15), tag: 'rising', what: 'bar 15, SET PIECE: the first sighting. It surges past along the left wall, outside the box. Harmless' },
    { d: B(19), tag: 'calm', what: 'bar 19: a second harmless pass along the right wall; rings' },
    { d: STEPS[0], tag: 'calm', what: 'bar 21: speed step; rings only' },
    { d: B(24), tag: 'rising', what: 'bar 24, build one: the first real pass (the left half); rings on the safe side' },
    { d: B(32), tag: 'peak', what: 'bar 32, DROP one: from above, then below; mines in the safe half; spurs and curtains' },
    { d: B(40), tag: 'peak', what: 'bars 40-42: the double, two passes two bars apart, opposite sides' },
    { d: B(43.5), tag: 'calm', what: 'bars 43-48: breather, a ring corkscrew' },
    { d: STEPS[1], tag: 'calm', what: 'bar 48, breakdown: speed step; the first fork, nothing chasing: one channel greedy (a mine and more rings), one plain' },
    { d: B(56), tag: 'rising', what: 'bar 56, build two: the second fork; it lights ONE channel before the prow; take the other' },
    { d: B(59.5), tag: 'peak', what: 'bars 59-63: the third fork, lit, mines in the safe channel, a pass as you leave it: the hardest stretch' },
    { d: STEPS[2], tag: 'calm', what: 'bar 64, DROP two: speed step; two calm bars' },
    { d: B(66), tag: 'rising', what: 'bars 66-72: passes on a two-bar rhythm, all four sides, rings showing the safe half' },
    { d: B(74), tag: 'rising', what: 'bar 74, SET PIECE (spectacle, not difficulty): it comes up beside you and runs with you for three seconds, then surges ahead' },
    { d: B(77), tag: 'calm', what: 'bar 77: "IT TURNS." Quiet; the canyon opens into the cavern' },
    { d: BOSS_AT, tag: 'peak', what: 'bar 79: THE LEVIATHAN (its own track cuts in on the bar)' },
  ],
  acts: { introduce: [0, STEPS[0]], develop: [STEPS[0], STEPS[1]], twist: [STEPS[1], STEPS[2]], master: [STEPS[2], BOSS_AT] },
  // 0.4.0, the galaxy 1 retrofit (the plan's 6.5; nothing else in the level moves, no ring is added or moved):
  // FROZEN RIFT: Overclock before the ice-mine run in the Narrows (4 s out: the lane pass before the first mine has no ring line); the Shield Cell at the end of the Throat, before the Leviathan.
  powerups: [[3987, 'overclock', -0.075, -0.425], [14332, 'shield-cell', 0, 0]],
  build(R, L) {
    const { add, line, sine } = L;
    const passAt = (bar, lane, warn, o = {}) => { add(distAt(barT(bar) - warn), 'l6-pass', Object.assign({ lane, warn }, o)); return B(bar); };
    // a row of rings in the safe half around the moment a pass reaches you
    const safeRings = (dArr, lane, n = 5, step = 24, skew = 0.25) => {
      const [sx, sy] = SAFE[lane], d0 = dArr - (n - 1) * step * 0.55;
      if (sx) line(d0, sx, -skew, sx, skew, n, step); else line(d0, -skew * 2, sy, skew * 2, sy, n, step);
    };
    const mine = (d, nx, ny, o = {}) => add(d, 'ice-mine', Object.assign({ nx, ny }, o));
    // rings leading into a mine's eye: the last ring sits where the mine is
    const eyeLine = (d, nx, ny, n = 4, step = 22) => { line(d - (n - 1) * step, nx * 0.4, ny * 0.4, nx, ny, n, step); mine(d, nx, ny); };

    // ================= ACT 1, INTRODUCE: THE RIFT MOUTH (bars 0-21, 84 m/s; intro, then groove) =================
    // open slow (rule 4): rings in the open while the walls close in; nothing that can hurt for 14 s
    line(260, 0, -0.2, 0, 0.2);
    line(520, -0.5, 0, 0.5, 0);
    sine(780, 8, 24, 0.5, 0.4);
    // the first mine, alone, slow, on the ring line (rule 18: doing nothing is safe; the rings lead into the eye)
    eyeLine(B(8), 0, 0, 5, 22);
    line(B(9), -0.4, 0.3, 0.4, 0.3);
    // spurs, left then right, rings on the open side; a curtain overhead; a mine off the line
    add(B(10.5), 'l6-spur', { side: -1, to: -0.25 }); line(B(10.5) - 70, 0.2, 0, 0.55, 0, 5, 24);
    add(B(12), 'l6-spur', { side: 1, to: 0.25 }); line(B(12) - 70, -0.2, 0, -0.55, 0, 5, 24);
    add(B(13), 'l6-curtain', { from: 'top', to: 0.25 }); line(B(13) - 80, 0, -0.2, 0, -0.55, 5, 22);
    eyeLine(B(13.7), 0.4, -0.4, 3, 22);
    // SET PIECE (rule 3): the first sighting. A calm bar, the call, then it surges past along the left wall
    add(B(13.2), 'call', { text: 'SOMETHING IS IN THE ICE', cls: 'c-red' });
    passAt(15, 'EL', 1.6);
    add(B(15) + 40, 'call', { text: 'THE LEVIATHAN', cls: 'c-red' });
    line(B(15) - 50, 0.3, 0, 0.6, 0.1, 5, 24);
    line(B(16.5), 0.6, 0.3, -0.3, -0.2);
    eyeLine(B(17.4), -0.45, 0.2, 3, 22);
    passAt(19, 'ER', WARN_NEW);
    line(B(19) - 50, -0.3, 0, -0.6, -0.1, 5, 24);

    // ================= ACT 2, DEVELOP: THE NARROWS (bars 21-48, 100 m/s; build one, DROP one) =================
    sine(STEPS[0] + 60, 6, 26, 0.45, 0.35);
    // build one: the first real pass, the left half (a new hazard in the box: 1.5 s of warning, rule 12)
    safeRings(passAt(24, 'L', WARN_NEW), 'L', 6);
    add(B(26), 'l6-curtain', { from: 'top', to: 0.15 }); line(B(26) - 80, 0.3, -0.3, -0.3, -0.5, 5, 22);
    safeRings(passAt(28, 'R', WARN), 'R', 5);
    eyeLine(B(28) + 30, -0.55, 0.3, 2, 22);
    add(B(30), 'l6-spur', { side: 1, to: 0.15 }); add(B(30) + 60, 'l6-curtain', { from: 'bottom', to: -0.2 });
    line(B(30) - 60, -0.3, 0.2, -0.5, 0.5, 6, 24);
    // DROP one: from above, then below (each new: 1.5 s)
    safeRings(passAt(32, 'T', WARN_NEW), 'T', 5);
    eyeLine(B(33.2), 0.3, -0.5, 3, 22);
    safeRings(passAt(35, 'B', WARN_NEW), 'B', 5);
    add(B(36.5), 'l6-spur', { side: -1, to: -0.1 }); line(B(36.5) - 70, 0.2, 0.2, 0.6, -0.1, 5, 24);
    eyeLine(B(38), 0.55, -0.35, 2, 24);
    // the double (the act's peak): two passes two bars apart, opposite sides
    safeRings(passAt(40, 'L', WARN), 'L', 4);
    line(B(40) + 60, 0.5, 0, -0.5, 0, 4, 24);
    safeRings(passAt(42, 'R', WARN), 'R', 4);
    // breather (rule 2): a ring corkscrew, nothing else
    sine(B(43.6), 12, 26, 0.5, 0.4);

    // ================= ACT 3, TWIST: THE FORKS (bars 48-64, 116 m/s; breakdown, build two) =================
    // fork 1 (the breakdown), nothing chasing: the left channel is greedy (a mine's eye and more rings), the right plain
    {
      const d = B(50), len = 300;
      line(d - 120, 0, 0, -0.55, 0.1, 4, 26);
      add(d, 'l6-fork', { len, hw: 0.2 });
      line(d + 30, -0.6, 0.1, -0.6, -0.3, 6, 24); mine(d + 190, -0.6, -0.3); line(d + 212, -0.6, -0.3, -0.6, 0.3, 4, 22);
      line(d + 60, 0.6, 0, 0.6, 0, 3, 60);
    }
    // fork 2 (build two): it lights ONE channel before the prow; take the other
    {
      const d = B(56), len = 320;
      add(d, 'l6-fork', { len, hw: 0.2 });
      passAt(barOf(d + 110), 'L', WARN);
      line(d - 130, 0, 0, 0.6, 0, 5, 24); line(d + 30, 0.6, 0, 0.6, 0.3, 7, 26);
      line(d + len + 40, 0.3, 0, -0.3, 0, 4, 24);
    }
    // between the forks: from above, then the third fork, the hardest stretch (rule 5): lit right, the safe left channel
    // has mines in it, and a pass meets you as you leave it
    safeRings(passAt(58.5, 'T', WARN), 'T', 4);
    {
      const d = B(60), len = 340;
      add(d, 'l6-fork', { len, hw: 0.2 });
      passAt(barOf(d + 150), 'R', WARN);
      line(d - 130, 0, 0, -0.6, 0, 5, 24);
      line(d + 30, -0.6, 0, -0.6, 0.35, 4, 24); mine(d + 150, -0.6, 0.35); mine(d + 260, -0.6, -0.3);
      line(d + 172, -0.6, 0.35, -0.6, -0.3, 4, 22);
      safeRings(passAt(barOf(d + len + 90), 'B', WARN), 'B', 4);
    }

    // ================= ACT 4, MASTER: THE THROAT (bars 64-79, 132 m/s; DROP two) =================
    sine(STEPS[2] + 40, 6, 28, 0.35, 0.3);
    // the passes on a two-bar rhythm, all four sides, the rings showing the safe half
    safeRings(passAt(66, 'L', WARN), 'L', 4);
    safeRings(passAt(68, 'T', WARN), 'T', 4);
    safeRings(passAt(70, 'R', WARN), 'R', 4);
    eyeLine(B(71), 0, 0.5, 2, 24);
    safeRings(passAt(72, 'B', WARN), 'B', 4);
    // SET PIECE: it comes up beside you on the left and runs with you, then surges ahead; a ring corkscrew on the right
    passAt(74, 'L', WARN, { hold: 3.2 });
    sine(B(74) - 40, 12, 28, 0.25, 0.4, 0, 0.55, 0);
    add(B(77), 'call', { text: 'IT TURNS', cls: 'c-red' });
    line(B(77) + 20, 0, 0, 0, 0, 3, 40);
  },
});
