// GALAXY 3 (THE UNMADE), LEVEL 8: THE FRACTAL YARD. A scrapyard of half-built geometry, everything three-sided (Yori's
// look sheet g3-level-08). CLU, branch g3-c; the plan is projects/starwake-galaxies.md 4.8.
// THE HEADLINE (rule 20): fractal drones split in two when their own fire comes home. One, then two, then four, each
// generation smaller, quicker and worth more; leave one alone and it drifts away. A clean chain (all seven pieces of
// one) pays FRACTAL CLEAR: the degenerate player's dream, and the careful player's skip. Greed multiplies danger.
//
// THE BEAT SHEET (rule 1) is `beats`, the four acts (rule 19) `acts`. Everything big sits on a bar line of the level's
// track (audio/g3/level8/music: glitchy techno, 150 bpm, patterns that halve and double; still to come, so the grid is
// its planned tempo, level7/grid.js). Bars count from 0.
//   ACT 1  THE SCRAP FIELD    bars  0-24   92 m/s  intro + groove: one slow fractal, its pieces drift off unfired
//   ACT 2  THE CUTTING FLOOR  bars 24-48  114 m/s  build one + drop one: the pieces fire and chains begin; a Phase, a
//                                                   frame wall and a cache behind it
//   ACT 3  THE BREEDER        bars 48-64  132 m/s  breakdown + build two: a mother fractal makes one for every one you
//                                                   leave alive. A Slipstream before her cloud of splitting drones
//   ACT 4  THE YARD           bars 64-80  150 m/s  drop two, the SET PIECE: one big fractal's pieces fire from every
//                                                   side, in pairs, through the whole yard. A Mirror Shell before it
//          THE LAST FRAME     bars 80-93  160/168  the drive, a step lighter; the outro, rings only
// Re-uses: riveters (this branch's), the seeker drones and pods of galaxy 1 (the plan names them). Plotters, forgeries
// and augurs belong to g3-a and g3-b and have not landed on `galaxies`; where they go is marked RE-USE.
import { defineLevel } from '../../api.js?v=0.4.1';
import ring from '../../pickups/ring/index.js?v=0.4.1';
import { phase, slipstream, mirrorShell } from '../../pickups/powerups/index.js?v=0.4.1';
import riveter from '../../enemies/g3-riveter/index.js?v=0.4.1';
import fractal from '../../enemies/g3-fractal/index.js?v=0.4.1';
import seeker from '../../enemies/seeker-drone/index.js?v=0.4.1';
import { musicGrid, ringRun } from './level7/grid.js?v=0.4.1';
import { breeder } from './level8/breeder.js?v=0.4.1';
import { frameWall } from './level8/wall.js?v=0.4.1';
import { frame, frames, scrap, scrapField, greatFrame } from './level8/scenery.js?v=0.4.1';

const { BAR, speed, BAR_S } = musicGrid({ bpm: 150, steps: [[0, 92], [24, 114], [48, 132], [62, 150], [80, 160], [88, 168]] });
const A1 = BAR(24), A2 = BAR(48), A3 = BAR(64), DRIVE = BAR(80), LEN = BAR(93);
const FRAC_IN = 2.8 / BAR_S, RIV_IN = 3.0 / BAR_S, SEEK_IN = 3.2 / BAR_S, MOTHER_IN = 3.2 / BAR_S;

// Yori's palette (g3-palettes.js, level 8): sky 070a0c, gas 1a4a50 / 5ab0c0 / 2a2a3a, fog 0e1c20, key c0f0f0, fill 1a4a50.
// One change for rule 9: her first gas, 1a4a50, is a saturated teal right on the cyan hue (check-levels fails it as sky);
// here it is 26484c, the same dark teal-grey a little greyer. Her teal 5ab0c0 is grey enough to pass as it is.
const look = (seed, gas, band, a, b, c) => ({ sky: ['#070a0c', a, b, c], fog: 0x0e1c20, hemiSky: 0xc0f0f0, hemiGround: 0x1a4a50, sun: 0xc0f0f0,
  band, gas, cloud: 0x2a2a3a, clouds: 0.14, seed, sunDir: [-0.4, 0.85, 0.35], starGlow: 0.55, starTint: 0xc0f0f0 });
const TEAL_D = 'rgba(38,72,76,A)', TEAL = 'rgba(90,176,192,A)', SLATE = 'rgba(42,42,58,A)';

export default defineLevel({
  g: 3, n: 8, id: 'fractal-yard', name: 'THE FRACTAL YARD',
  idea: 'Fractal drones split in two when their own fire comes home.',
  length: LEN,
  speed,
  music: { track: 'g3/level8/music' },
  bossMusic: null,
  sfx: [{ id: 'g3-split', gain: 0.6 }, { id: 'g3-fractal-clear', gain: 0.8 }, { id: 'g3-rivet', gain: 0.55 }, { id: 'g3-stitched', gain: 0.8 }],
  // style minimums [grazes + close calls, deflects], from the human bot's decent runs (3-9 grazes, 17-23 deflects: here you
  // roll the fractals' bolts home rather than skim them): A about a quarter, S 40%, DEGENERATE 60%. Re-sized (g3-roll, 11-07)
  // for the pairs and the three-sided cross-stitches, from the decent bot's two runs after them: 9/45 and 10/55 (before
  // 1/5, 2/8, 3/12)
  style: { A: [2, 13], S: [4, 20], DEGENERATE: [6, 30] },
  sections: [
    { id: 'scrap', name: 'THE SCRAP FIELD', sub: 'SECTOR 1', d0: 0, d1: A1, look: 'scrap',
      scenery: { 'g3-l8-frames': 1, 'g3-l8-scrapfield': 1, 'g3-l8-great-frame': 1 } },
    { id: 'floor', name: 'THE CUTTING FLOOR', sub: 'SECTOR 2', d0: A1, d1: A2, look: 'floor',
      scenery: { 'g3-l8-frames': 1, 'g3-l8-scrapfield': 1, 'g3-l8-great-frame': 1 } },
    { id: 'breeder', name: 'THE BREEDER', sub: 'SECTOR 3', d0: A2, d1: A3, look: 'breeder',
      scenery: { 'g3-l8-frames': 0.7, 'g3-l8-scrapfield': 1, 'g3-l8-great-frame': 0.8 } },
    { id: 'yard', name: 'THE YARD', sub: 'SECTOR 4', d0: A3, d1: DRIVE, look: 'yard',
      scenery: { 'g3-l8-frames': 1, 'g3-l8-scrapfield': 1, 'g3-l8-great-frame': 1 } },
    { id: 'last', name: 'THE LAST FRAME', sub: 'SECTOR 5', d0: DRIVE, d1: LEN, look: 'last',
      scenery: { 'g3-l8-frames': 1, 'g3-l8-scrapfield': 1, 'g3-l8-great-frame': 1 } },
  ],
  looks: {
    scrap: look(801, 0.55, 0.5, TEAL_D, SLATE, TEAL),
    floor: look(802, 0.65, 0.52, TEAL, TEAL_D, SLATE),
    breeder: look(803, 0.6, 0.46, SLATE, TEAL_D, TEAL),
    yard: look(804, 0.8, 0.55, TEAL, SLATE, TEAL_D),
    last: look(805, 0.5, 0.5, TEAL_D, TEAL, SLATE),
  },
  kinds: [ring, fractal, riveter, seeker, phase, slipstream, mirrorShell, breeder, frameWall, frame, scrap],
  scenery: [frames, scrapField, greatFrame],
  beats: [
    { d: 0, tag: 'calm', what: 'intro: the scrap field, rings in the open, the great frame ahead' },
    { d: BAR(8.5), tag: 'rising', what: 'groove: one slow fractal; send its shot home, watch it split, its pieces drift off unfired' },
    { d: BAR(14), tag: 'rising', what: 'seekers either side in the lull, then a riveter string, the last level\'s idea, slow' },
    { d: BAR(20), tag: 'rising', what: 'now the pieces fire back' },
    { d: BAR(22.8), tag: 'calm', what: 'rings only' },
    { d: A1, tag: 'calm', what: 'build one, speed step: the Cutting Floor' },
    { d: BAR(26), tag: 'rising', what: 'a whole chain of seven: FRACTAL CLEAR' },
    { d: BAR(31), tag: 'peak', what: 'drop one: seekers either side, two chains in pairs, then a cross-stitched string from three sides' },
    { d: BAR(43.2), tag: 'calm', what: 'a Phase, and the frame wall with a cache behind it (four clues)' },
    { d: BAR(45.6), tag: 'calm', what: 'rings only' },
    { d: A2, tag: 'calm', what: 'breakdown, speed step; a Slipstream' },
    { d: BAR(50.5), tag: 'peak', what: 'TWIST, THE BREEDER: her cloud of splitting drones in slow motion' },
    { d: BAR(53.5), tag: 'calm', what: 'the snap-back: rings only while the course catches the music' },
    { d: BAR(56), tag: 'rising', what: 'build two: she makes one for every one you left alive; a cross-stitch under her from three sides' },
    { d: BAR(61), tag: 'calm', what: 'she climbs away; a Mirror Shell' },
    { d: A3, tag: 'peak', what: 'drop two, SET PIECE THE YARD: one big fractal, fifteen pieces, pairs from every side' },
    { d: BAR(72.5), tag: 'rising', what: 'the yard keeps coming: a chain and a string' },
    { d: BAR(77.5), tag: 'calm', what: 'rings only' },
    { d: DRIVE, tag: 'rising', what: 'the drive, speed step: a chain in pairs and a seeker, a step lighter' },
    { d: BAR(88), tag: 'calm', what: 'outro: rings out of the yard' },
  ],
  acts: { introduce: [0, A1], develop: [A1, A2], twist: [A2, A3], master: [A3, LEN] },
  build(R, L) {
    const { add, line } = L;
    const frac = (bar, o) => add(BAR(bar - FRAC_IN), 'g3-fractal', o);
    const riv = (bar, o) => add(BAR(bar - RIV_IN), 'g3-riveter', Object.assign({ seam: true }, o));
    const seek = (bar, nx, ny) => add(BAR(bar - SEEK_IN), 'seeker-drone', { nx, ny, shots: 2 });
    // the Cross-Stitch (the Rivet Line's twist, re-used): riveters either side whose strings start on one beat, the
    // others' notes landing WITH the first's (one roll takes them all). Here every note lands from three sides at once:
    // a third riveter on the same beat (each gun aims its own bolt; one note on the shared ledger, one roll)
    const stitch = (bar, key, a, b, c) => { for (const o of [a, b, c]) if (o) riv(bar, Object.assign({ sync: key }, o)); };
    const rings = (b0, b1, style) => ringRun(L, R, BAR, b0, b1, style, { speed });
    const pu = (bar, type, nx, ny) => { line(BAR(bar) - 75, nx * 0.4, ny * 0.4, nx, ny, 3, 25); add(BAR(bar), type, { nx, ny }); };

    // ======== ACT 1, THE SCRAP FIELD: one slow fractal, alone (rules 4, 17, 18). Bars 0-8: rings only.
    rings(0.6, 22.6, 'mixed');
    add(BAR(7.4), 'call', { text: 'ROLL ITS SHOT HOME AND IT SPLITS', cls: 'c-cyan' });
    frac(8.5, { nx: 0.1, ny: 0.4, tame: true, depth: 1, shots: 2, first: true });     // its pieces drift off unfired
    frac(12.5, { nx: -0.35, ny: 0.45, tame: true, depth: 2, shots: 2 });               // one, two, four: still tame
    seek(14, -0.6, 0.45); seek(14.2, 0.6, 0.5);                                         // (g3-roll) seekers in the lull: nothing else fires here
    riv(16.5, { nx: 1.25, ny: 0.4, notes: [0, 4, 8], seam: false, sync: 'l8-x16' });   // the last level's idea, slow,
    riv(16.5, { nx: -1.25, ny: 0.45, notes: [4, 8], seam: false, sync: 'l8-x16' });    // its last two notes pairs (g3-roll)
    add(BAR(19.3), 'call', { text: 'NOW THE PIECES SHOOT BACK', cls: 'c-mag' });
    frac(20, { nx: 0.35, ny: 0.35, depth: 1, kidShots: 2, pair: true });

    // ======== ACT 2, THE CUTTING FLOOR: the pieces fire and chains begin (develop). Build one 24-32, drop one 32-48.
    rings(24.4, 42.6, 'mixed');
    add(BAR(25.3), 'call', { text: 'ALL SEVEN FOR A FRACTAL CLEAR', cls: 'c-cyan' });
    frac(26, { nx: 0, ny: 0.45, depth: 2, kidShots: 1 });                             // the lesson as g3-c built it: its
    // pieces firing twice in pairs ran into the seekers below, four roll moments in three seconds (g3-roll's probe)
    // (g3-roll, 11-07: roll demand rises through the game. Every piece fires twice if it is left alone, from here on
    // most of them in pairs, and the cross-stitches land from three sides at once. The seekers stay as g3-c placed them:
    // their bolts are not on the shared note ledger, and more of them packed four roll moments into three seconds.)
    seek(31, -0.6, 0.5); seek(31.2, 0.6, 0.45);                                         // RE-USE: an augur here
    frac(33, { nx: 0.45, ny: 0.35, depth: 2, kidShots: 2, pair: true });               // its pieces fire in pairs
    frac(35, { nx: -0.4, ny: 0.4, depth: 2, kidShots: 2, pair: true });
    const N38 = [0, 3, 6, 9, 12];                                                       // five notes, done before the Phase
    stitch(38, 'l8-x38', { nx: -0.35, ny: 1.32, notes: N38 }, { nx: 0.45, ny: 1.32, notes: N38 }, { nx: 1.25, ny: 0.4, notes: N38 }); // RE-USE: a plotter's mine line
    // the Phase and the frame wall: the wall fills the top right corner, four slabs 14 m apart, a cache ring in each gap;
    // three cache rings run into it (the ring trail). Nothing that counts is behind it, and the lane beside it is open.
    pu(43.2, 'phase', 0.25, 0.2);
    const W = BAR(44.6), WX = 0.62, WY = 0.55;
    for (let i = 0; i < 3; i++) add(W - 66 + i * 20, 'ring', { nx: WX * (0.55 + 0.15 * i), ny: WY * (0.55 + 0.15 * i), cache: true });
    for (let i = 0; i < 4; i++) { add(W + i * 14, 'g3-l8-wall', { nx: WX, ny: WY, crack: i === 0 }); add(W + i * 14 + 7, 'ring', { nx: WX, ny: WY, cache: true }); }
    line(W + 5, -0.45, -0.35, -0.2, -0.45, 4, 26);                                      // the open lane's own rings, low left
    rings(45.8, 47.6, 'corkscrew');

    // ======== ACT 3, THE BREEDER (twist). A Slipstream first; her cloud of splitting drones in slow motion; the
    // snap-back calm; then she makes one for every fractal left alive.
    pu(49.3, 'slipstream', 0, 0);
    add(BAR(50 - MOTHER_IN), 'g3-l8-breeder', { nx: 0, ny: 1.75, dur: 17, after: 5.5, max: 6, kidShots: 2, pair: true });
    add(BAR(49.8), 'call', { text: 'LEAVE ONE ALIVE AND SHE MAKES ANOTHER', cls: 'c-mag' });
    rings(50.2, 62.6, 'centre');
    frac(50.5, { nx: -0.55, ny: 0.35, depth: 1, shots: 1, kidShots: 2, pair: true });
    frac(50.5, { nx: 0.55, ny: 0.5, depth: 1, shots: 1, kidShots: 2, pair: true });
    frac(50.9, { nx: 0, ny: 0.15, depth: 1, shots: 1, kidShots: 2, pair: true });
    stitch(56, 'l8-x56', { nx: -1.25, ny: 0.4, notes: [0, 3, 6, 9, 12] }, { nx: 1.25, ny: 0.45, notes: [0, 3, 6, 9, 12] }, { nx: 0, ny: 1.36, notes: [0, 3, 6, 9, 12] });
    frac(57.5, { nx: 0.3, ny: 0.45, depth: 2, kidShots: 2, pair: true });
    pu(63.4, 'mirror-shell', 0, 0.1);                                                   // children firing from every side

    // ======== ACT 4, THE YARD (master; the set piece, drop two). One big fractal, three splits deep: its pieces fly
    // apart across the lane and fire in pairs that land together, from every side, fifteen pieces in all.
    frac(64, { nx: 0, ny: 0.55, big: 1.5, depth: 3, shots: 1, kidShots: 2, pair: true, wide: true, hold: 175 });
    rings(64.4, 77.4, 'centre');
    frac(72.5, { nx: -0.45, ny: 0.4, depth: 2, kidShots: 2, pair: true });
    stitch(74.5, 'l8-x74', { nx: 1.25, ny: 0.3, notes: [0, 3, 6, 9] }, { nx: -1.25, ny: 0.35, notes: [0, 3, 6, 9] }, { nx: 0, ny: 1.36, notes: [0, 3, 6, 9] });
    rings(77.6, 80, 'corkscrew');
    // the drive: a step lighter
    rings(80.4, 87.6, 'mixed');
    frac(81, { nx: 0.3, ny: 0.4, depth: 2, kidShots: 2, pair: true });
    seek(84.5, -0.55, 0.45);
    // the outro: rings out of the yard
    rings(88.2, 92.4, 'corkscrew');
  },
});
