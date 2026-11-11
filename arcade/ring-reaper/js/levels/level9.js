// LEVEL 9: THE MIRROR FIELD. A crystal field that reflects everything, you included (Yori's look sheet level-09).
// THE HEADLINE (rule 20): reflections lie, so read the real shot. Every crystal emitter's bolt splits into one real
// red bolt that glows and trails, and two flat pink ghosts that pass straight through you. The level teaches the lie
// harmlessly before it ever costs anything (rule 17), then makes you hold your roll while a ghost goes by, then
// turns it round: in the Hall of Mirrors the obvious shot is the ghost and the real one comes at you off a mirror
// (the volley the Twins use, taught here first: rule 27). The Twins wait at the end.
//
// THE BEAT SHEET (rule 1) is `beats` below, the four acts (rule 19) `acts`. Everything big sits on a bar line of
// the level's own track (audio/levels/level9/music, take 3, the one Evrtek approved: 135.99 bpm, first downbeat at
// 0.102 s, 1.7648 s a bar, its sections from its .json). BAR(b) turns a bar into course metres through this level's
// own speed curve, so the speed steps, the acts and the set piece land on the music (rule 30). Bars here count from
// 0; the music's bar numbers (1-based) are one more.
//   ACT 1  THE GLASS SHALLOWS  bars  0-24   92 m/s  intro + groove: a ghost goes through you; then the glow is real
//   ACT 2  THE PRISM WOOD      bars 24-48  108 m/s  build one + drop one: the ghosts come first, as bait; shards
//   ACT 3  THE HALL OF MIRRORS bars 48-80  122 m/s  breakdown, build two, drop two: the real bolt comes off a mirror;
//                                                   SET PIECE THE GALLERY on drop two's first four bars (64-68)
//   ACT 4  THE KALEIDOSCOPE    bars 80-92  136 m/s  the drive: every volley, a step less dense than the Hall's peak
//          THE STILL WATER     bars 92-95  142 m/s  the calm before THE TWINS (boss on bar 95)
import { defineLevel, clamp } from '../api.js?v=0.6.1';
import ring from '../pickups/ring/index.js?v=0.6.1';
import emitter from '../enemies/crystal-emitter/index.js?v=0.6.1';
import twins, { hull as twinsHull } from '../bosses/twins/index.js?v=0.6.1';
import { mirrorGate } from './level9/mirror.js?v=0.6.1';
import { mirrorCrystal, crystalArch, mirrorPane, mirrorShard, crystalBanks, crystalFloorField, archStream, hallPanes, glassFloor, thePrism, glints } from './level9/scenery.js?v=0.6.1';

// ---- the music grid and the speed curve, one schedule (rule 30). From audio/levels/level9/music.json (take 3).
const BAR_S = 1.76484, FIRST_BEAT = 0.1023;
// [bar, m/s]: the speed steps up at the start of each act, eased over half a bar
const STEPS = [[0, 92], [24, 108], [48, 122], [80, 136], [92, 142]];
const BOSS_BAR = 95;
// integrate the curve once: course metres at each bar line, the run's clock starting with the track
const BAR_D = (() => {
  const vAtT = (tt) => { const b = (tt - FIRST_BEAT) / BAR_S; let v = STEPS[0][1]; for (let i = 1; i < STEPS.length; i++) { const k = clamp((b - STEPS[i][0]) / 0.5, 0, 1); v += (STEPS[i][1] - STEPS[i - 1][1]) * k * k * (3 - 2 * k); } return v; };
  let d = FIRST_BEAT * STEPS[0][1], t = FIRST_BEAT; const out = [d];
  for (let bar = 1; bar <= BOSS_BAR + 8; bar++) { const t1 = FIRST_BEAT + bar * BAR_S; while (t < t1) { const h = Math.min(0.005, t1 - t); d += vAtT(t + h / 2) * h; t += h; } out.push(d); }
  return out;
})();
// a bar number (fractions allowed) to course metres
export const BAR = (b) => { const i = clamp(Math.floor(b), 0, BAR_D.length - 2), f = b - i; return BAR_D[i] + (BAR_D[i + 1] - BAR_D[i]) * f; };
// the speed as a function of distance, matching the integration above
const stepD = STEPS.map(([b, v]) => [BAR(b), BAR(b + 0.5), v]);
function speed(d) { let v = STEPS[0][1]; for (let i = 1; i < stepD.length; i++) { const k = clamp((d - stepD[i][0]) / (stepD[i][1] - stepD[i][0]), 0, 1); v += (stepD[i][2] - stepD[i - 1][2]) * k * k * (3 - 2 * k); } return v; }

const A1 = BAR(24), A2 = BAR(48), A3 = BAR(80), A4 = BAR(92), BOSS_D = BAR(BOSS_BAR), LEVEL_END = BOSS_D + 600;

export default defineLevel({
  n: 9, id: 'mirror', name: 'THE MIRROR FIELD',
  idea: 'Reflections lie, so read the real shot before you roll.',
  seed: 909,
  length: LEVEL_END,
  speed,
  music: { track: 'levels/level9/music' },  // take 3 (Evrtek: "Music is all great!!")
  bossMusic: 'bosses/twins',                // same tempo and key; cuts in on a bar line
  sfx: [],
  // 0.2.0 ranked by score from the autopilot's NON-god total (568,000) (325 of 376 rings, 0 hits, the Twins down, 3 stars), 11-05
  sections: [
    { id: 'shallows', name: 'THE GLASS SHALLOWS', sub: 'SECTOR 1', d0: 0, d1: A1, look: 'shallows',
      scenery: { 'l9-banks': 1, 'l9-floorfield': 0.8, 'l9-arches': 1, 'l9-floor': 1, 'l9-prism': 1, 'l9-glints': 1 } },
    { id: 'wood', name: 'THE PRISM WOOD', sub: 'SECTOR 2', d0: A1, d1: A2, look: 'wood',
      scenery: { 'l9-banks': 1, 'l9-floorfield': 1, 'l9-arches': 0.4, 'l9-floor': 1, 'l9-prism': 1, 'l9-glints': 1 } },
    { id: 'hall', name: 'THE HALL OF MIRRORS', sub: 'SECTOR 3', d0: A2, d1: A3, look: 'hall',
      scenery: { 'l9-hall': 1, 'l9-banks': 0.45, 'l9-floorfield': 0.6, 'l9-floor': 1, 'l9-prism': 0.8, 'l9-glints': 1 } },
    { id: 'kaleido', name: 'THE KALEIDOSCOPE', sub: 'SECTOR 4', d0: A3, d1: A4, look: 'kaleido',
      scenery: { 'l9-banks': 1, 'l9-floorfield': 1, 'l9-hall': 0.35, 'l9-arches': 0.6, 'l9-floor': 1, 'l9-prism': 1, 'l9-glints': 1 } },
    { id: 'still', name: 'THE STILL WATER', sub: 'THE TWINS AHEAD', d0: A4, d1: LEVEL_END, look: 'still',
      scenery: { 'l9-banks': 0.6, 'l9-floorfield': 0.7, 'l9-floor': 1, 'l9-prism': 1, 'l9-glints': 1 } },
  ],
  // Yori's palette (palettes.js, level 9): sky 0a0a1e, gas dfe6f2 / b09aff / 4a3a8a, fog 2a2a4a, key ffffff, fill
  // 7a60c0. Pearl and lilac only: no red, amber or cyan anywhere in the field (rule 9).
  looks: {
    shallows: { sky: ['#0a0a1e', 'rgba(223,230,242,A)', 'rgba(176,154,255,A)', 'rgba(74,58,138,A)'], fog: 0x2a2a4a, hemiSky: 0xe8e0ff, hemiGround: 0x2a1a50, sun: 0xffffff, band: 0.52, gas: 0.6, cloud: 0xdfe6f2, clouds: 0.18, seed: 901 },
    wood: { sky: ['#0b0a20', 'rgba(176,154,255,A)', 'rgba(74,58,138,A)', 'rgba(223,230,242,A)'], fog: 0x2a2648, hemiSky: 0xd0c0ff, hemiGround: 0x241650, sun: 0xf4f0ff, band: 0.48, gas: 0.75, cloud: 0xb09aff, clouds: 0.22, seed: 902 },
    hall: { sky: ['#0d0d24', 'rgba(223,230,242,A)', 'rgba(224,208,255,A)', 'rgba(122,96,192,A)'], fog: 0x32325a, hemiSky: 0xffffff, hemiGround: 0x3a2a6a, sun: 0xffffff, band: 0.56, gas: 0.7, cloud: 0xf4f8ff, clouds: 0.26, seed: 903 },
    kaleido: { sky: ['#0a0820', 'rgba(176,154,255,A)', 'rgba(223,230,242,A)', 'rgba(122,96,192,A)'], fog: 0x2a2450, hemiSky: 0xe0d0ff, hemiGround: 0x2a1a5a, sun: 0xffffff, band: 0.5, gas: 0.85, cloud: 0xe0d0ff, clouds: 0.3, seed: 904 },
    still: { sky: ['#08081a', 'rgba(223,230,242,A)', 'rgba(74,58,138,A)', 'rgba(176,154,255,A)'], fog: 0x24243f, hemiSky: 0xf0ecff, hemiGround: 0x1a1240, sun: 0xffffff, band: 0.5, gas: 0.5, cloud: 0xdfe6f2, clouds: 0.12, seed: 905 },
  },
  kinds: [ring, emitter, mirrorShard, mirrorCrystal, crystalArch, mirrorPane, mirrorGate, twinsHull],
  scenery: [crystalBanks, crystalFloorField, archStream, hallPanes, glassFloor, thePrism, glints],
  boss: { at: BOSS_D, def: twins, then: 'finish' },
  beats: [
    { d: 0, tag: 'calm', what: 'intro: the Glass Shallows, rings in the open under arches, the Prism far ahead' },
    { d: BAR(8.6), tag: 'rising', what: 'groove: the first emitter; its ghosts go through you, its real bolt goes wide (harmless)' },
    { d: BAR(13.5), tag: 'rising', what: 'now the glowing one comes at you and the ghosts go wide: roll it back' },
    { d: BAR(18.5), tag: 'rising', what: 'all three at you together: read it, roll once' },
    { d: BAR(22.5), tag: 'calm', what: 'rings only' },
    { d: A1, tag: 'calm', what: 'build one, speed step: the Prism Wood, first shards at the edges' },
    { d: BAR(27.5), tag: 'rising', what: 'BAIT: the ghosts arrive first; the first one aimed to graze at worst' },
    { d: BAR(32), tag: 'peak', what: 'drop one: emitters in pairs (MULTI-DEFLECT), bait among the shards' },
    { d: BAR(44.5), tag: 'calm', what: 'rings only' },
    { d: A2, tag: 'calm', what: 'breakdown, speed step: the Hall of Mirrors rises both sides' },
    { d: BAR(49), tag: 'calm', what: 'THE MIRROR GATE: a second Wake flies at you out of the glass, which shatters' },
    { d: BAR(51), tag: 'rising', what: 'TWIST: the real bolt comes off a mirror and the ghost comes straight (the first one grazes)' },
    { d: BAR(56), tag: 'rising', what: 'build two: bank shots and bait' },
    { d: BAR(62), tag: 'calm', what: 'lead-in: two bars of rings only' },
    { d: BAR(64), tag: 'peak', what: 'drop two, SET PIECE THE GALLERY: a bank shot on every bar, side to side, through a corkscrew' },
    { d: BAR(68), tag: 'calm', what: 'breather' },
    { d: BAR(70), tag: 'peak', what: 'the hardest stretch: bank and bait together, shards' },
    { d: BAR(77), tag: 'calm', what: 'rings only' },
    { d: A3, tag: 'rising', what: 'the drive, speed step: the Kaleidoscope, every volley type mixed' },
    { d: BAR(89), tag: 'calm', what: 'the long corkscrew' },
    { d: A4, tag: 'calm', what: 'the Still Water: nothing shoots' },
    { d: BOSS_D, tag: 'peak', what: 'THE TWINS' },
  ],
  acts: { introduce: [0, A1], develop: [A1, A2], twist: [A2, A3], master: [A3, BOSS_D] },
  // 0.4.0, the galaxy 1 retrofit (the plan's 6.5; nothing else in the level moves, no ring is added or moved):
  // THE MIRROR FIELD: Overclock at the end of the lead-in, right before the Gallery (bar 64); it runs out by bar 66, long before the bait (bar 70); the Shield Cell in the Still Water before the Twins.
  powerups: [[11761, 'overclock', 0.17, 0.43], [18341, 'shield-cell', 0.19, 0.38]],
  build(R, L) {
    const { add, ring: one, line, sine, clearOfRings } = L;
    // an emitter stands in the lane: never on a ring line (try its spot, then nudged up or down, then mirrored)
    const em = (bar, nx, ny, vols) => { const d = BAR(bar); for (const [x, y] of [[nx, ny], [nx, ny + 0.3], [nx, ny - 0.3], [-nx, ny], [nx * 0.6, -ny]]) if (clearOfRings(d, x, y, 0.5)) return add(d, 'crystal-emitter', { nx: x, ny: clamp(y, -0.75, 0.75), vols }); return add(d, 'crystal-emitter', { nx, ny, vols }); };
    const bank = (bar, side, ny, vols) => add(BAR(bar), 'crystal-emitter', { side, ny, vols: vols.map((v) => Object.assign({ mode: 'bank' }, v)) });
    const shard = (d, nx, ny, len, tilt) => { if (clearOfRings(d, nx, ny, 0.42)) add(d, 'l9-shard', { nx, ny, len, tilt }); };
    // ring patterns end-to-end between two bars, so a ring is never far after a hit (rule 7)
    const rings = (b0, b1, style) => {
      let d = BAR(b0); const end = BAR(b1); let k = 0;
      while (d < end - 60) {
        const pick = style === 'corkscrew' ? 3 : (k + R.int(0, 3)) % 5; k++;
        let next;
        if (pick === 0) next = line(d, R.range(-0.6, 0.6), R.range(-0.5, 0.5), R.range(-0.6, 0.6), R.range(-0.5, 0.5), 5, 24);
        else if (pick === 1) next = line(d, -0.65, R.range(-0.3, 0.4), 0.65, R.range(-0.3, 0.4), 6, 22);
        else if (pick === 2) next = line(d, R.range(-0.3, 0.3), 0.6, R.range(-0.3, 0.3), -0.55, 5, 24);
        else if (pick === 3) next = sine(d, 8, 24, R.range(0.45, 0.62), R.range(0.38, 0.5), R() * 6);
        else next = line(d, R.sign() * 0.6, R.sign() * 0.5, 0, 0, 5, 24);
        d = Math.min(end, next) + R.range(110, 170);   // a breath between patterns (and fewer rings alive: each is two draw calls)
      }
    };

    // ======== ACT 1, THE GLASS SHALLOWS: the lie, taught harmlessly (rules 4, 17, 18). Intro bars 0-8: rings only.
    rings(0.6, 8, 'mixed');
    // groove: the first emitter. Its two ghosts are aimed at you and pass through; the real bolt goes 4.6 m wide.
    line(BAR(8.2), 0, -0.1, 0, -0.1, 5, 22);                 // rings hold you in the middle, where the ghosts meet you
    add(BAR(8) - 120, 'call', { text: 'ONLY THE GLOW IS REAL', cls: 'c-mag' });
    em(9.2, 0.0, 0.62, [{ mode: 'lie' }]);
    rings(10, 11.4, 'mixed');
    em(11.8, -0.55, 0.35, [{ mode: 'lie' }]);
    rings(12.5, 13.6, 'mixed');
    // now the glowing one comes at you and the ghosts go wide: roll it home
    add(BAR(13.6) - 120, 'call', { text: 'ROLL THE ONE THAT GLOWS', cls: 'c-cyan' });
    em(14.6, 0.45, 0.5, [{ mode: 'truth' }]);
    rings(15.2, 16.4, 'mixed');
    em(17.0, -0.5, -0.4, [{ mode: 'truth' }]);
    rings(17.6, 18.8, 'mixed');
    em(19.3, 0.3, 0.55, [{ mode: 'mix' }]);
    rings(19.9, 21, 'mixed');
    em(21.3, -0.6, 0.45, [{ mode: 'late' }]);
    em(21.8, 0.6, -0.3, [{ mode: 'mix' }]);
    rings(22.4, 24, 'corkscrew');

    // ======== ACT 2, THE PRISM WOOD: the ghosts come first, as bait (develop). Build one 24-32, drop one 32-48.
    rings(24.2, 47.3, 'mixed');
    // shards: first at the box's edge, then into the lane; never stood on a ring line
    for (let b = 24.6; b < 27; b += 0.45) shard(BAR(b), R.sign() * R.range(0.72, 0.9), R.range(-0.5, 0.5), R.range(8, 11), R.range(-0.25, 0.25));
    for (let b = 27; b < 44; b += R.range(0.34, 0.5)) shard(BAR(b), R.range(-0.75, 0.75), R.range(-0.55, 0.55), R.range(7, 12), R.range(-0.65, 0.65));
    add(BAR(27.4) - 140, 'call', { text: 'WAIT FOR THE GLOW', cls: 'c-mag' });
    em(28.3, 0.5, 0.55, [{ mode: 'bait', aim: 'graze' }]);          // the first bait: bite and it only grazes
    em(30.3, -0.45, 0.5, [{ mode: 'bait' }]);
    // drop one
    em(32.6, -0.7, 0.4, [{ mode: 'mix' }]); em(32.6, 0.7, 0.4, [{ mode: 'mix', at: 2.15 }]);   // a pair: one roll, two kills
    em(34.6, 0.55, 0.5, [{ mode: 'bait' }]);
    em(36.4, -0.5, -0.45, [{ mode: 'bait', gap: 0.7 }]);
    em(38.4, -0.65, 0.5, [{ mode: 'mix' }]); em(38.4, 0.65, 0.5, [{ mode: 'bait', at: 2.45 }]);
    em(40.4, 0.0, 0.62, [{ mode: 'late' }, { mode: 'bait', at: 1.25, T: 1.2, gap: 0.5 }]);
    em(42.4, 0.6, -0.35, [{ mode: 'bait' }]); em(43.2, -0.6, 0.45, [{ mode: 'mix' }]);
    // 44.5-48: rings only

    // ======== ACT 3, THE HALL OF MIRRORS: the real bolt comes off a mirror; the obvious one is the ghost (twist)
    rings(49.3, 63.6, 'mixed');          // (none for the gate: the stage is clear while your reflection comes at you)
    // the breakdown: THE MIRROR GATE. A second Wake flies at you out of the glass, and the glass shatters (mirror.js)
    add(BAR(49.0), 'l9-mirror', { x: 0, y: 0, side: 1 });
    add(BAR(50.3) - 140, 'call', { text: 'IT COMES OFF THE MIRROR', cls: 'c-mag' });
    bank(51.5, 1, 0.3, [{ aim: 'graze' }]);                      // the first: it grazes at worst
    bank(53.8, -1, 0.1, [{}]);
    // build two
    em(56.4, 0.5, 0.55, [{ mode: 'bait' }]);
    bank(58.0, 1, -0.2, [{}]);
    em(59.6, -0.55, 0.45, [{ mode: 'mix' }]);
    bank(60.8, -1, 0.3, [{ gap: 0.45 }]);
    // 62-64 the lead-in. SET PIECE: THE GALLERY, drop two's first four bars. A bank shot every bar from alternating
    // sides, through a corkscrew of rings: each real bolt comes off its mirror close to the downbeat.
    sine(BAR(63.6), 16, 26, 0.5, 0.42, 0);
    for (let i = 0; i < 4; i++) bank(65.2 + i, i % 2 ? -1 : 1, [0.35, -0.1, 0.4, -0.25][i], [{ at: 2.4 }]);
    rings(68.6, 80, 'mixed');
    // 70-77: the hardest stretch
    for (let b = 69.8; b < 77; b += R.range(0.42, 0.58)) shard(BAR(b), R.range(-0.8, 0.8), R.range(-0.6, 0.6), R.range(7, 12), R.range(-0.7, 0.7));
    bank(70.6, -1, 0.3, [{ gap: 0.5 }]);
    em(71.6, 0.55, 0.5, [{ mode: 'bait' }]);
    bank(72.8, 1, -0.3, [{}]);
    em(74.0, -0.6, 0.45, [{ mode: 'mix' }]); em(74.0, 0.6, 0.45, [{ mode: 'late' }]);
    bank(75.6, -1, 0.0, [{ gap: 0.5 }]); em(76.4, 0.4, -0.45, [{ mode: 'bait' }]);
    // 77-80: rings only

    // ======== ACT 4, THE KALEIDOSCOPE: every volley type, a step less dense than the Hall's peak (master)
    rings(80.2, 89, 'mixed');
    for (let b = 81.5; b < 88.5; b += R.range(0.45, 0.65)) shard(BAR(b), R.range(-0.8, 0.8), R.range(-0.6, 0.6), R.range(7, 12), R.range(-0.7, 0.7));
    em(81.6, 0.5, 0.5, [{ mode: 'mix' }]);
    bank(83.0, -1, 0.2, [{}]);
    em(84.2, -0.55, 0.5, [{ mode: 'bait' }]); em(84.2, 0.55, -0.4, [{ mode: 'late', at: 2.2 }]);
    bank(85.6, 1, -0.2, [{ gap: 0.45 }]);
    em(87.0, 0.0, 0.62, [{ mode: 'bait' }, { mode: 'mix', at: 1.2, T: 1.15 }]);
    rings(89, 92, 'corkscrew');
    // ======== THE STILL WATER: nothing shoots; rings to the Twins
    rings(92.2, BOSS_BAR - 1.7, 'corkscrew');
    add(BAR(BOSS_BAR - 0.4), 'l9-mirror', { x: 0, y: 0, side: -1 });      // the second gate: the Twins come out of it
  },
});
