// GALAXY 3 (THE UNMADE), LEVEL 7: THE RIVET LINE. A dreadnought hull being riveted section by section as you fly its
// length (Yori's look sheet g3-level-07). CLU, branch g3-c; the plan is projects/starwake-galaxies.md 4.7.
// THE HEADLINE (rule 20): riveters stitch strings of bolts at you, so roll on every stitch. A riveter's six lights
// count its string down; each bolt lands on the music at least 1.0 s after the last (a hair over a roll and its
// recharge), so rolling on every note always makes the next. The most roll-heavy regular level in the game (the plan:
// 70%, about 28 roll moments a minute). Send a whole string home for STITCHED!.
//
// THE BEAT SHEET (rule 1) is `beats`, the four acts (rule 19) `acts`. Everything big sits on a bar line of the level's
// track (audio/g3/level7/music: hard techno, 148 bpm, the stabbing lead the riveters fire on; still to come, so the
// grid is its planned tempo, grid.js). Bars count from 0.
//   ACT 1  THE SLIPWAY        bars  0-24   90 m/s  intro + groove: one riveter, three bolts wide of you; then at you
//   ACT 2  THE GANTRY ROW     bars 24-48  112 m/s  build one + drop one: strings of four to six, on the music
//   ACT 3  CROSS-STITCH       bars 48-64  128 m/s  breakdown + build two: two riveters, left and right; singles, then
//                                                   pairs that land together (one roll takes both). Mirror Shell first
//   ACT 4  THE ASSEMBLY LINE  bars 64-80  148 m/s  drop two, the SET PIECE: five riveters stitch the hull in turn, a
//                                                   note every 2.5 beats for twelve bars. Overclock right before it
//          THE DRY DOCK       bars 80-93  158/166  the drive, a step lighter; the outro, rings only
// Re-uses the plan names (plotters, forgeries, augurs, shuttlers, blueprint walls) belong to g3-a and g3-b and have not
// landed on `galaxies`; the places they go are marked RE-USE below, and the level stands on its own headline without them.
import { defineLevel } from '../../api.js?v=0.6.3';
import ring from '../../pickups/ring/index.js?v=0.6.3';
import { shieldCell, overclock, mirrorShell } from '../../pickups/powerups/index.js?v=0.6.3';
import riveter from '../../enemies/g3-riveter/index.js?v=0.6.3';
import { musicGrid, ringRun } from './level7/grid.js?v=0.6.3';
import { gantry, gantries, hull, deck, deckWide, arcs, dreadnought } from './level7/scenery.js?v=0.6.3';

const { BAR, speed, BAR_S } = musicGrid({ bpm: 148, steps: [[0, 90], [24, 112], [48, 128], [62, 148], [80, 158], [88, 166]] });
const A1 = BAR(24), A2 = BAR(48), A3 = BAR(64), DRIVE = BAR(80), LEN = BAR(93);
const RIV_IN = 3.0 / BAR_S; // a riveter rides in for 3 s: born this many bars before it reaches its station

// Yori's palette (g3-palettes.js, level 7): sky 090a0e, gas 2a3a5a / b0d8ff / 3a3a3a, fog 121820, key d8ecff, fill 2a3a5a.
// Steel and pale arc blue: no red, amber or cyan in the sky (rule 9).
const look = (seed, gas, band, a, b, c) => ({ sky: ['#090a0e', a, b, c], fog: 0x121820, hemiSky: 0xd8ecff, hemiGround: 0x2a3a5a, sun: 0xd8ecff,
  band, gas, cloud: 0x2a3a5a, clouds: 0.16, seed, sunDir: [0.5, 0.9, 0.4], starGlow: 0.6, starTint: 0xd8ecff });
const STEEL = 'rgba(42,58,90,A)', ARC = 'rgba(176,216,255,A)', SMOKE = 'rgba(58,58,58,A)';

export default defineLevel({
  g: 3, n: 7, id: 'rivet-line', name: 'THE RIVET LINE',
  idea: 'Riveters stitch strings of bolts at you, so roll on every stitch.',
  length: LEN,
  speed,
  music: { track: 'g3/level7/music' },
  bossMusic: null,
  sfx: [{ id: 'g3-rivet', gain: 0.55 }, { id: 'g3-stitched', gain: 0.8 }],
  // style minimums [grazes + close calls, deflects], from the human bot's decent runs (14-22 grazes, 32-41 deflects; good
  // ones roll more and graze less: 6-13, 52-60): A about a quarter, S 40%, DEGENERATE 60% (the deflects; grazes held to what
  // a rolling player makes). Deflects re-sized (g3-roll, 11-07) for the Assembly Line's pairs, from
  // the decent bot's two runs after them (13-26 grazes, 46 and 39 deflects); before, 8/13/20.
  style: { A: [3, 11], S: [5, 17], DEGENERATE: [8, 26] },
  sections: [
    { id: 'slipway', name: 'THE SLIPWAY', sub: 'SECTOR 1', d0: 0, d1: A1, look: 'slipway',
      scenery: { 'g3-l7-deck': 1, 'g3-l7-gantries': 1, 'g3-l7-arcs': 0.5, 'g3-l7-dreadnought': 1 } },
    { id: 'gantry', name: 'THE GANTRY ROW', sub: 'SECTOR 2', d0: A1, d1: A2, look: 'gantry',
      scenery: { 'g3-l7-deck': 1, 'g3-l7-deck-wide': 1, 'g3-l7-gantries': 1, 'g3-l7-arcs': 1, 'g3-l7-dreadnought': 1 } },
    { id: 'cross', name: 'CROSS-STITCH', sub: 'SECTOR 3', d0: A2, d1: A3, look: 'cross',
      scenery: { 'g3-l7-deck': 1, 'g3-l7-deck-wide': 0.6, 'g3-l7-gantries': 0.7, 'g3-l7-arcs': 0.8, 'g3-l7-dreadnought': 0.8 } },
    { id: 'assembly', name: 'THE ASSEMBLY LINE', sub: 'SECTOR 4', d0: A3, d1: DRIVE, look: 'assembly',
      scenery: { 'g3-l7-deck': 1, 'g3-l7-deck-wide': 1, 'g3-l7-gantries': 1, 'g3-l7-arcs': 1, 'g3-l7-dreadnought': 1 } },
    { id: 'drydock', name: 'THE DRY DOCK', sub: 'SECTOR 5', d0: DRIVE, d1: LEN, look: 'drydock',
      scenery: { 'g3-l7-deck': 1, 'g3-l7-deck-wide': 1, 'g3-l7-gantries': 0.6, 'g3-l7-arcs': 0.4, 'g3-l7-dreadnought': 1 } },
  ],
  looks: {
    slipway: look(701, 0.55, 0.5, STEEL, SMOKE, ARC),
    gantry: look(702, 0.65, 0.52, STEEL, ARC, SMOKE),
    cross: look(703, 0.6, 0.48, SMOKE, STEEL, ARC),
    assembly: look(704, 0.8, 0.56, ARC, STEEL, SMOKE),
    drydock: look(705, 0.5, 0.5, STEEL, SMOKE, ARC),
  },
  kinds: [ring, riveter, shieldCell, overclock, mirrorShell, gantry, hull],
  scenery: [gantries, deck, deckWide, arcs, dreadnought],
  beats: [
    { d: 0, tag: 'calm', what: 'intro: along the hull under the gantries, rings in the open' },
    { d: BAR(8.5), tag: 'rising', what: 'groove: the first riveter, a string of three wide of you; its lights count down' },
    { d: BAR(13), tag: 'rising', what: 'strings at you, slow: roll on every stitch' },
    { d: BAR(22.5), tag: 'calm', what: 'rings only' },
    { d: A1, tag: 'calm', what: 'build one, speed step: the Gantry Row' },
    { d: BAR(26), tag: 'rising', what: 'strings of four on the music, from above and the sides' },
    { d: BAR(33), tag: 'peak', what: 'drop one: strings of five, then six' },
    { d: BAR(45.5), tag: 'calm', what: 'rings only' },
    { d: A2, tag: 'calm', what: 'breakdown, speed step; a Mirror Shell before the Cross-Stitch' },
    { d: BAR(51), tag: 'rising', what: 'TWIST, CROSS-STITCH: left, right, then a pair that one roll takes' },
    { d: BAR(57), tag: 'peak', what: 'build two: the second Cross-Stitch, its pairs closer together' },
    { d: BAR(60.5), tag: 'calm', what: 'a Shield Cell after the Cross-Stitch; speed step; an Overclock' },
    { d: A3, tag: 'peak', what: 'drop two, SET PIECE THE ASSEMBLY LINE: five riveters in turn, a note every 2.5 beats, every other one a pair from across the hull' },
    { d: BAR(77), tag: 'calm', what: 'rings only' },
    { d: DRIVE, tag: 'rising', what: 'the drive, speed step: one string and a short Cross-Stitch (two pairs), a step lighter' },
    { d: BAR(88), tag: 'calm', what: 'outro: rings to the end of the line' },
  ],
  acts: { introduce: [0, A1], develop: [A1, A2], twist: [A2, A3], master: [A3, LEN] },
  build(R, L) {
    const { add, line } = L;
    // a riveter that reaches its station on `bar` (its first bolt lands about a bar later, on a beat). From drop one on
    // its bolts SEAM after you: early strings can be sidestepped, later ones want a roll on every note (the plan's 4.7)
    const riv = (bar, o) => add(BAR(bar - RIV_IN), 'g3-riveter', Object.assign({ seam: bar >= 32 }, o));
    const rings = (b0, b1, style) => ringRun(L, R, BAR, b0, b1, style, { speed });
    // a power-up on its own short ring line, so following the rings finds it (the plan's 6.4)
    const pu = (bar, type, nx, ny) => { line(BAR(bar) - 75, nx * 0.4, ny * 0.4, nx, ny, 3, 25); add(BAR(bar), type, { nx, ny }); line(BAR(bar) + 25, nx, ny, nx * 0.5, ny * 0.5, 2, 25); };
    const UP = 1.32, SIDE = 1.25;

    // ======== ACT 1, THE SLIPWAY: the riveter alone, slow, wide of you first (rules 4, 17, 18). Bars 0-8: rings only.
    rings(0.6, 22.6, 'mixed');
    add(BAR(7.2), 'call', { text: 'ITS LIGHTS COUNT THE SHOTS', cls: 'c-mag' });
    riv(8.5, { nx: 0.35, ny: UP, n: 3, every: 4, wide: 3.4, first: true });   // three bolts that pass you by
    add(BAR(12.2), 'call', { text: 'ROLL ON EVERY STITCH', cls: 'c-cyan' });
    riv(13, { nx: -0.35, ny: UP, n: 3, every: 4 });
    riv(17.5, { nx: SIDE, ny: 0.35, n: 3, every: 3 });
    riv(21, { nx: -0.3, ny: UP, n: 4, every: 4 });

    // ======== ACT 2, THE GANTRY ROW: strings at you, on the music (develop). Build one 24-32, drop one 32-48.
    rings(24.4, 29, 'mixed');
    rings(29.2, 45.4, 'centre');                                               // under the strings: rings where you come back to after a roll
    riv(26, { nx: 0.4, ny: UP, n: 4, every: 3 });
    riv(29.5, { nx: -SIDE, ny: 0.3, n: 4, every: 3 });
    riv(33, { nx: 0, ny: 1.36, n: 5, every: 3 });
    riv(37, { nx: SIDE, ny: -0.2, n: 4, every: 3 });                          // RE-USE: a plotter's mine line between strings
    riv(40.5, { nx: -0.4, ny: UP, n: 6, every: 3 });
    rings(45.6, 47.6, 'corkscrew');

    // ======== ACT 3, CROSS-STITCH (twist). Two riveters, left and right, on one beat grid. Every 3 beats a note: from
    // the left, from the right, or a PAIR from both that lands together (one roll takes both).
    pu(49.6, 'mirror-shell', 0, 0.1);                                         // a crossfire is what it is for
    add(BAR(49.9), 'call', { text: 'ONE ROLL TAKES A PAIR', cls: 'c-cyan' });
    rings(50.3, 55.8, 'centre');
    riv(50, { nx: -SIDE, ny: 0.4, notes: [0, 6, 9, 15], sync: 'cs1' });      // L . P L . P
    riv(50, { nx: SIDE, ny: 0.4, notes: [3, 6, 12, 15], sync: 'cs1' });      // . R P . R P
    rings(56, 59.8, 'centre');
    riv(56, { nx: -SIDE, ny: 0.65, notes: [0, 3, 9, 12], sync: 'cs2' });     // L P . P P
    riv(56, { nx: SIDE, ny: 0.1, notes: [3, 6, 9, 12], sync: 'cs2' });       // . P R P P
    pu(61, 'shield-cell', -0.2, -0.2);                                        // after the Cross-Stitch
    rings(61.6, 62.8, 'mixed');
    pu(63.4, 'overclock', 0.15, -0.1);                                        // the textbook pairing: right before the line

    // ======== ACT 4, THE ASSEMBLY LINE (master; the set piece, drop two). Five riveters stitch the hull in turn, round
    // the lane, four notes each every 2.5 beats (1.01 s at 148 bpm, the hair over a roll), so the whole line is one
    // unbroken run of notes on the lead for twelve bars. Overclock turns it up; without it every note is still makeable.
    // (g3-roll, 11-07) Each station has a partner across the hull riveting with it: its second and fourth notes land as
    // PAIRS (the Cross-Stitch's lesson, one roll takes both), so the line rivets both sides at once. A pair never
    // lengthens the line: it is the same unbroken run of notes.
    rings(64.3, 76.6, 'centre');
    const STATIONS = [[-0.45, UP], [0.45, UP], [SIDE, 0.4], [-SIDE, 0.4], [0, 1.36]];
    const ACROSS = [[0.45, UP], [-0.45, UP], [-SIDE, 0.4], [SIDE, 0.4], [SIDE, 0.75]];
    STATIONS.forEach(([nx, ny], i) => {
      riv(64 + i * 2.5, { nx, ny, notes: [0, 2.5, 5, 7.5], sync: 'al' + i });
      riv(64 + i * 2.5, { nx: ACROSS[i][0], ny: ACROSS[i][1], notes: [2.5, 7.5], sync: 'al' + i });
    });
    rings(77, 80, 'corkscrew');
    // the drive: a step lighter than the line
    rings(80.4, 87.6, 'mixed');
    riv(81, { nx: SIDE, ny: 0.3, n: 4, every: 3 });
    riv(84.5, { nx: -SIDE, ny: 0.5, notes: [0, 6, 9], sync: 'cs3' });
    riv(84.5, { nx: SIDE, ny: 0.5, notes: [3, 6, 9], sync: 'cs3' });
    // the outro: rings to the end of the line
    rings(88.2, 92.4, 'corkscrew');
  },
});
