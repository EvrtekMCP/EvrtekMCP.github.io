// STARWAKE 0.4.0: three galaxies of levels: the catalogues, loading a level module, laying out its course, and the
// player's progress (unlocks, stars, best score and rank per level). All progress is in localStorage on the
// device; dev runs never write any of it.
import { V, rng, store, fmt } from './util.js?v=0.6.1';
import { getKind } from './registry.js?v=0.6.1';
import { layout } from './layout.js?v=0.6.1';
import { SPAWN_D, LEGACY_LINE, RING_R } from './space.js?v=0.6.1';
import { POWERUP_KINDS, shieldCell } from './pickups/powerups/index.js?v=0.6.1'; // 0.4.0: a level's `powerups` field (the galaxy 1 retrofit)
import { PICK_R } from './powerups.js?v=0.6.1';
import checkpointKind from './pickups/checkpoint/index.js?v=0.6.1'; // 0.6.0: the engine lays one on every level
import { DEMO, inDemo } from './demo.js?v=0.6.1';                    // 0.6.0: the demo switch (off unless a demo build or ?demo)

// The PLAY ORDER (n is the number a player sees). `file` is the module, js/levels/level<file>.js, when it differs;
// `art` is Yori's name lettering (art/ui/name-<art>.png) when it differs. Evrtek, 11-05: "let's swap level one and
// two" (Shattered Moon is the gentler opener; Nebula Run's lightgates are the step up). Each level's module carries
// its own `n` = its place here, so progress, unlocks, CONTINUE and the dev menu all follow this order.
// Evrtek, 11-08: "Level 5 and 7 should be swapped": Neon Orbital is played fifth, Ion Storm seventh (files level7.js
// and level5.js, as before). What each level is moves with it (its course, kinds, music, roll-or-hit fire, style
// minimums, records); what each PLACE is stays with the place (EASE, the curve by position). See the tables below.
export const CATALOGUE = [
  { n: 1, name: 'SHATTERED MOON', file: 2, art: '02' },
  { n: 2, name: 'NEBULA RUN', file: 1, art: '01' },
  { n: 3, name: 'THE GATEFIELD', boss: 'THE WARDEN' },
  { n: 4, name: 'SOLAR SKIM' },
  { n: 5, name: 'NEON ORBITAL', file: 7, art: '07' },
  { n: 6, name: 'FROZEN RIFT', boss: 'THE LEVIATHAN' },
  { n: 7, name: 'ION STORM', file: 5, art: '05' },
  { n: 8, name: 'GRAVEYARD OF GIANTS' },
  { n: 9, name: 'THE MIRROR FIELD', boss: 'THE TWINS' },
  { n: 10, name: 'THE LATTICE HEART', boss: 'THE LATTICE HEART' },
];
// ---- 0.4.0: THE GALAXIES (the plan, projects/starwake-galaxies.md). Galaxy 1 is CATALOGUE above, untouched. Galaxies
// 2 and 3 keep their level modules in js/levels/g<G>/level<N>.js (n is the place in the galaxy, 1-10, and the module
// says g: 2 or g: 3). The names are working names (Evrtek may rename; Yori letters them). `boss` names its boss.
export const CATALOGUE_G2 = [
  { n: 1, name: 'TIDEWAY' },
  { n: 2, name: 'THE SHOALS' },
  { n: 3, name: 'THE DRUMREEF', boss: 'THE WHIRLMAW' },
  { n: 4, name: 'THE MIGRATION' },
  { n: 5, name: 'GRAVITY GARDEN' },
  { n: 6, name: 'THE TANGLE', boss: 'THE SNARE' },
  { n: 7, name: 'BLOOMFALL' },
  { n: 8, name: "ANGLER'S DEEP" },
  { n: 9, name: 'THE MURMURATION', boss: 'THE MURMUR' },
  { n: 10, name: 'THE ROOTMIND', boss: 'THE ROOTMIND' },
];
export const CATALOGUE_G3 = [
  { n: 1, name: 'THE SCAFFOLD' },
  { n: 2, name: 'THE LOOM FLOOR' },
  { n: 3, name: 'THE LOCKWORKS', boss: 'THE FOREMAN' },
  { n: 4, name: 'THE AUGURY' },
  { n: 5, name: 'THE DRAFTING HALL' },
  { n: 6, name: 'THE FORGERY', boss: 'THE COUNTERFEIT' },
  { n: 7, name: 'THE RIVET LINE' },
  { n: 8, name: 'THE FRACTAL YARD' },
  { n: 9, name: 'THE VAULT', boss: 'THE HIGH ROLLER' },
  { n: 10, name: 'THE WEFTWORK', boss: 'THE WEFTWORK' },
];
// One entry per galaxy that exists (the MCP's default 3: the chart shows only galaxies that exist; tonight, all three).
// `tint`: its colour on the placeholder chart (none of the three reserved hues, rule 9). `has`: which of Yori's pieces for it
// are in (her art branch turns each on as it lands; until then the menus draw a placeholder and ask for no file):
//   emblem  art/ui/chart/emblem-g<G>-open.png and -locked.png (the GALAXY SELECT chart, its nodes in galaxy-nodes.json)
//   label   art/ui/chart/name-g<G>.png, lock-g<G>.png, title-<name>.png (her lettering of its name)
//   map     art/ui/g<G>/levelselect-bg-*.png, levelselect-route-*.png, and its nodes in art/ui/map-nodes.json under 'g<G>'
//   names   art/ui/g<G>/name-NN.png (the level names; her numbers num-NN.png are shared)
//   music   the sound branch's tracks under audio/g<G>/: true when all are in, else the list of those that are (each one
//           missing plays a galaxy 1 stand-in: audio.js standIn)
export const GALAXIES = [
  { g: 1, id: 'reach', name: 'THE LATTICE REACH', finale: 'THE LATTICE HEART', levels: CATALOGUE, tint: '#8a7cff', has: { emblem: true, label: true, map: true, names: true, music: true } },
  { g: 2, id: 'deep', name: 'THE VERDANT DEEP', finale: 'THE ROOTMIND', levels: CATALOGUE_G2, tint: '#3fd08a', has: { emblem: true, label: true, map: true, names: true,
    music: ['g2/level1/music', 'g2/level2/music', 'g2/level3/music', 'g2/level4/music', 'g2/level5/music', 'g2/bosses/whirlmaw', 'g2/bosses/snare', 'g2/bosses/murmur'] } },
  { g: 3, id: 'unmade', name: 'THE UNMADE', finale: 'THE WEFTWORK', levels: CATALOGUE_G3, tint: '#c2b2ff', has: { emblem: true, label: true, map: true, names: true,
    music: ['g3/level1/music', 'g3/level2/music', 'g3/level3/music', 'g3/bosses/foreman', 'g3/bosses/counterfeit', 'g3/bosses/high-roller'] } },
];
export const galaxy = (g) => GALAXIES.find((x) => x.g === g) || null;
export const catalogueOf = (g) => (galaxy(g) || GALAXIES[0]).levels;
export const entryOf = (g, n) => catalogueOf(g).find((c) => c.n === n) || null;
// Every place that names a level takes (g, n), or (n) alone for galaxy 1, so every 0.3 call keeps working.
export const gn = (a, b) => (typeof b === 'number' || typeof b === 'string' ? [a, b] : [1, a]);
// how a level is said to a person: "LEVEL 4" in galaxy 1 (as before), "THE VERDANT DEEP · 04" in the others
export const levelLabel = (g, n) => (g === 1 ? 'LEVEL ' + n : galaxy(g).name + ' · ' + String(n).padStart(2, '0'));

// '' is a clear with no letter (one star) or a run that did not finish
export const RANK_ORDER = ['', 'C', 'B', 'A', 'S', 'DEGENERATE'];

// ---- THE DIFFICULTY DIALS: one row a level, by galaxy and by PLACE in the play order (a level that moves, as 5 and 7 of
// galaxy 1 did on 11-08, takes the dials of the place it moves to).
//   dmg   every hit to the shield is scaled by this
//   heal  the shield a ring gives back is scaled by this
//   shot  enemy shots take this much longer to reach you: more warning, more time to roll (never under 0.92: check-levels
//         holds every warning floor)
//   ring  how far from a ring's middle still counts as through it (a boost ring's too), scaled (never under 0.95)
//   boss  (0.6.0) every hit taken while the level's boss holds the course is scaled by this, on top of dmg
// History: 0.3.0 (the human pass) softened galaxy 1's first six levels by hand; 0.4.0 set galaxies 2 and 3 to a plan
// (pressure = dmg / heal / shot rising through each galaxy); neither was measured level against level.
// 0.6.0, THE PLAYER PASS (Evrtek 11-10: "one constant ramp ... boss fights as a temporary spike"): dmg and boss are now
// MEASURED. tools/test/sweep.js flies the human bots over all thirty levels, and tools/test/tune.js sets each level's dmg
// so the shield its pilots lose a minute follows one straight ramp a galaxy (6 -> 28, 12 -> 38, 18 -> 48 for the decent
// bot), and each boss dial so the shield its whole fight costs climbs boss by boss (35 for the Warden to 80 for the Weftwork). heal, shot and ring are as they were.
// tune.js --write rewrites the table below; do not edit dmg or boss by hand without flying the sweep again.
// (Three boss dials had a second step after the tuned sweep, each by its own figures there, and those three levels were
// flown again: the Lattice Heart cost 86 against an aim of 60 (0.76 -> 0.53), the Counterfeit 75 against 65 (0.61 -> 0.53),
// the Weftwork 93 against 80 (1.03 -> 0.89). No boss retreats any more, so their fights run longer than 0.5.0 ever measured.)
export const EASE_G = {
  1: {
    1: { dmg: 0.55, heal: 1.5, shot: 1.3, ring: 1.3 },
    2: { dmg: 0.6, heal: 1.5, shot: 1.25, ring: 1.3 },
    3: { dmg: 0.45, heal: 1.25, shot: 1, ring: 1.15, boss: 1.6 },
    4: { dmg: 0.45, heal: 1.1, shot: 1, ring: 1.05 },
    5: { dmg: 1.15, heal: 1, shot: 1, ring: 1 },
    6: { dmg: 1, heal: 1, shot: 1.1, ring: 1 },
    7: { dmg: 0.5, heal: 1, shot: 1, ring: 1 },
    8: { dmg: 1.25, heal: 1, shot: 1, ring: 1 },
    9: { dmg: 0.99, heal: 1, shot: 1, ring: 1.45, boss: 0.65 },
    10: { dmg: 1, heal: 1, shot: 1, ring: 1, boss: 0.53 },
  },
  2: {
    1: { dmg: 0.45, heal: 1.4, shot: 1.2, ring: 1.25 },
    2: { dmg: 0.45, heal: 1.35, shot: 1.15, ring: 1.2 },
    3: { dmg: 0.45, heal: 1.2, shot: 1.05, ring: 1.12, boss: 1.08 },
    4: { dmg: 0.61, heal: 1.1, shot: 1, ring: 1.05 },
    5: { dmg: 0.48, heal: 1, shot: 1, ring: 1 },
    6: { dmg: 0.52, heal: 1, shot: 1.05, ring: 1, boss: 1.6 },
    7: { dmg: 1.27, heal: 0.98, shot: 0.98, ring: 1.15 },
    8: { dmg: 1.3, heal: 0.97, shot: 0.98, ring: 1.4 },
    9: { dmg: 1.3, heal: 0.95, shot: 0.97, ring: 1.5, boss: 1.02 },
    10: { dmg: 1.11, heal: 0.95, shot: 0.96, ring: 0.98, boss: 0.73 },
  },
  3: {
    1: { dmg: 0.45, heal: 1.3, shot: 1.1, ring: 1.2 },
    2: { dmg: 0.45, heal: 1.25, shot: 1.35, ring: 1.15 },
    3: { dmg: 0.45, heal: 1.15, shot: 1.02, ring: 1.08, boss: 1.6 },
    4: { dmg: 1.19, heal: 1.05, shot: 1, ring: 1.5 },
    5: { dmg: 1.25, heal: 1, shot: 0.98, ring: 1.2 },
    6: { dmg: 1.22, heal: 1, shot: 1.02, ring: 1, boss: 0.53 },
    7: { dmg: 0.54, heal: 0.97, shot: 0.97, ring: 1.18 },
    8: { dmg: 0.57, heal: 0.95, shot: 0.95, ring: 1.5 },
    9: { dmg: 1.3, heal: 0.93, shot: 0.94, ring: 0.96, boss: 0.82 },
    10: { dmg: 1.23, heal: 0.92, shot: 0.92, ring: 0.95, boss: 0.89 },
  },
};
export const EASE = EASE_G[1]; // galaxy 1's rows, as 0.3.0 named them
// 0.6.0: 'boss' scales every hit taken while a boss holds the course (on top of dmg). The course heals as you fly it (a ring
// gives shield back) and a boss fight does not, so the fight is where a level's spike lives, and it gets its own dial.
export const easeOf = (n, g = 1) => Object.assign({ dmg: 1, heal: 1, shot: 1, ring: 1, boss: 1 }, (EASE_G[g] || EASE)[n] || {});
export const pressureOf = (e) => e.dmg / e.heal / e.shot;
// ---- ROLL-OR-HIT FIRE (0.3.1, Evrtek 11-06: "levels seem to get easier as the game goes on ... less need for doing the
// barrel rolls"). On 0.3.0 a player who never rolled was shot almost never after level 4 (the human bot's 'dodger': 0
// shot hits a minute on levels 6, 7, 8 and 9): every shot could be steered round. From level 3 on, some of the
// volleys aimed at you come as a NET instead: a tight spray of bolts (centre and a ring 1.3 m out, or two rings), fast
// (0.4 s to your plane; one beat where shots land on the beat), too wide to steer out of in time. A roll sends every
// bolt of it home. Only the shots a kind marks as plain aimed fire can become one (course.fire, opts.net): pods,
// shrikes, gate turrets, searchlight bolts (0.75 s), an emitter's true bolt; a swarm chain spreads its own volley
// (one bolt a kite). Never a boss's, a sniper's, a seeker's (it must be rolled already), a teaching shot or one
// meant to miss. A burst is one volley: it becomes one net.
//   every  one aimed volley in this many is a net (the level's own count: with 2 or more, the first ones never are;
//          Neon Orbital's chains teach the roll first with a volley that only grazes, and that one never counts)
//   rings  1 (7 bolts) or 2 (19 bolts)
// A level with no entry has none (levels 1 and 2 stay forgiving; 4's seekers, 6's Leviathan and Ion Storm's snipers
// keep their own fire). Set an entry's every to 0 to switch it off.
// Keyed by place, but each entry is its LEVEL's (the 5/7 swap, 11-08): Neon Orbital's nets moved with it from 7 to 5.
// By place they would have done harm twice: Neon Orbital without nets is the no-roll level Evrtek's 11-06 note was
// about, and Ion Storm has no kind that fires nets (its snipers never do), so an entry at 7 would change nothing.
export const FIRE = {
  3: { every: 3, rings: 1 },
  5: { every: 1, rings: 1 }, // NEON ORBITAL (was 7's until the swap)
  8: { every: 3, rings: 2 },
  9: { every: 2, rings: 2 },
  10: { every: 1, rings: 2 },
};
// 0.4.0: roll-or-hit fire a galaxy at a time (FIRE_G). Only kinds that opt in fire nets (galaxy 1's pods, shrikes, gate
// turrets, searchlights, emitters and swarm chains, wherever they fly); galaxies 2 and 3's own kinds bring their own
// roll moments. Their entries are set from the curve (tools/test/curve.js), as galaxy 1's were.
// An entry may also name galaxy 2 or 3 kinds whose plain aimed fire can come as a net: kinds: { 'g2-conductor': {} }
// (netT: a longer net flight where the kind's tell is short). The engine opts them in (course.fire); their files never change.
// Set from the curve (CLU-I2, 11-07: the MCP's rules, roll demand rising through each galaxy, counted in ROLLS a minute, the
// plan's 5.3 roll moments: a net sent home is up to 19 deflects from one roll, so deflects are not the measure). G2-1 and G3-1 stay without
// (the on-ramps); the levels that dipped get nets from galaxy 1's pods and shrikes and the kinds named here.
export const FIRE_G = {
  1: FIRE,
  2: {
    // the gulper's shot is not a declared hazard (its hazard is its body, a mover), so check-levels cannot time its net: netT
    // 0.65 with its 0.6 s tell gives 1.35 s on the Shoals (0.65 x 1.15 + 0.6; it is new there, floor 1.2 s) and 1.22 s on the
    // Rootmind (shot ease 0.96; floor 0.8 s)
    2: { every: 3, rings: 1, kinds: { 'g2-gulper': { netT: 0.65 } } },
    4: { every: 2, rings: 1, kinds: { 'g2-hound': { netT: 0.55 } } },   // its bolts at YOU only: one at the calf is an at-shot, never a net
    5: { every: 2, rings: 1 },
    6: { every: 2, rings: 1, kinds: { 'g2-hound': { netT: 0.55 } } },
    8: { every: 1, rings: 2 },
    9: { every: 2, rings: 1, kinds: { 'g2-conductor': {} } },
    10: { every: 2, rings: 1, kinds: { 'g2-sap-knot': {}, 'g2-hound': { netT: 0.55 }, 'g2-gulper': { netT: 0.65 } } },
  },
  3: {
    3: { every: 1, rings: 1 },
    // 4 THE AUGURY and 5 THE DRAFTING HALL: their headlines are not rolling (augurs, plotters): allowed dips, no nets (the MCP)
  },
};
export const fireOf = (n, g = 1) => { const F = (FIRE_G[g] || {})[n]; return F && F.every ? F : null; };

// ---- stars and ranks (0.6.0, the player pass; Evrtek 11-10: "Stars come from SCORE ... This promotes the build up to max
// multipliers and holding that multiplier"). FIVE stars a level, won by the run's TOTAL (its score and its end bonuses)
// and by nothing else. The ring share, the grazes and close calls and the roll-backs gate nothing any more (0.3.0's GATES,
// STYLE and RING_SHARES are gone): they still score, so they still matter, but no star hides behind a count the player
// cannot see. The rank letters follow the stars, and DEGENERATE sits above all five: the brag rank, no sixth star.
//   ★ clear the level   ★★ C   ★★★ B   ★★★★ A   ★★★★★ S   DEGENERATE     each a score, per level: STAR_SCORES
export const MAX_STARS = 5;
export const TIERS = [
  { stars: 1, rank: '' }, { stars: 2, rank: 'C' }, { stars: 3, rank: 'B' }, { stars: 4, rank: 'A' }, { stars: 5, rank: 'S' }, { stars: 5, rank: 'DEGENERATE' },
];
// The score each tier asks, per level in play order: [★★, ★★★, ★★★★, ★★★★★, DEGENERATE]; one star is the clear itself.
// MEASURED, never guessed (Evrtek: "Re-measure what each level can achieve at a human level ... and realign every level's
// star gates"): tools/test/sweep.js flies the human bots (newcomer, decent, good) over every level, and tools/test/
// star-gates.js sizes each level's row from their totals by one rule, the same on all thirty:
//   ★★     half of what the newcomer bot's runs score (a first clear that took its rings)
//   ★★★    nine tenths of the newcomer's
//   ★★★★   nine tenths of the decent bot's
//   ★★★★★  just under the good bot's weaker runs (0.96 of their lower quartile): a skilled, clean run that built its
//          multiplier and held it
//   DEGENERATE  above the good bot's best (1.12 of it): better than the bot that plays well
// Galaxy 1's levels 1 and 2 are a rung gentler, the on-ramp (Evrtek 11-06, still standing: "levels 1 and 2 must feel rewarding
// and encouraging"): ★★ 0.35, ★★★ 0.70 and ★★★★ 0.90 of the newcomer's median, ★★★★★ 0.90 of the decent bot's.
// Rounded to the nearest thousand. A level with no row yet uses FALLBACK (the proving levels).
// 0.6.1: G3-6 THE FORGERY re-flown on its new boss fight (the Counterfeit's opening; tools/test/_results/p061a,p061b: the
// newcomer bot's two runs, the decent and good bots' four), its row sized by the same rule; the newcomer clears it now, so
// its ★★ and ★★★ are its own, no longer borrowed from the decent bot's.
export const STAR_SCORES = {
  1: { 1: [66000, 132000, 169000, 273000, 389000], 2: [39000, 79000, 101000, 127000, 313000], 3: [238000, 428000, 626000, 772000, 1035000], 4: [117000, 211000, 355000, 436000, 577000], 5: [141000, 253000, 529000, 571000, 831000], 6: [111000, 199000, 285000, 388000, 497000], 7: [66000, 118000, 320000, 433000, 619000], 8: [155000, 279000, 523000, 609000, 956000], 9: [340000, 613000, 720000, 883000, 1351000], 10: [349000, 628000, 678000, 758000, 1331000] },
  2: { 1: [130000, 234000, 325000, 453000, 603000], 2: [115000, 207000, 386000, 702000, 968000], 3: [136000, 245000, 526000, 786000, 1008000], 4: [75000, 135000, 362000, 480000, 677000], 5: [114000, 206000, 396000, 485000, 666000], 6: [152000, 273000, 638000, 700000, 970000], 7: [231000, 415000, 749000, 1051000, 1382000], 8: [356000, 641000, 1183000, 1451000, 2012000], 9: [403000, 725000, 1243000, 1499000, 2096000], 10: [312000, 562000, 772000, 968000, 1168000] },
  3: { 1: [220000, 397000, 429000, 830000, 1005000], 2: [88000, 159000, 555000, 894000, 1189000], 3: [136000, 244000, 426000, 602000, 839000], 4: [174000, 313000, 361000, 423000, 570000], 5: [101000, 181000, 245000, 320000, 483000], 6: [113000, 203000, 427000, 642000, 863000], 7: [58000, 105000, 301000, 564000, 820000], 8: [135000, 244000, 390000, 768000, 1072000], 9: [203000, 366000, 626000, 817000, 1079000], 10: [314000, 566000, 970000, 1131000, 1438000] },
};
const FALLBACK = [40000, 90000, 150000, 220000, 320000];
export const starScores = (n, g = 1) => (STAR_SCORES[g] || {})[n] || FALLBACK;
export const rankAtLeast = (r, want) => RANK_ORDER.indexOf(r || '') >= RANK_ORDER.indexOf(want || '');
export const rankForStars = (s) => ['', '', 'C', 'B', 'A', 'S'][Math.max(0, Math.min(5, s))];
const starText = (n) => '★'.repeat(n);
// Where a score stands on level n: the tier it has reached (as if the level were cleared), the score the next tier asks,
// and how far along the stretch between the two it is (0..1). The HUD's star meter and the end card both read this.
export function starProgress(total, n, g = 1) {
  const S = starScores(n, g), t = Math.floor(total || 0);
  let i = 0; while (i < S.length && t >= S[i]) i++;
  const from = i ? S[i - 1] : 0, to = i < S.length ? S[i] : null;
  return { tier: TIERS[i], stars: TIERS[i].stars, next: i < S.length ? TIERS[i + 1] : null, from, to, more: to === null ? 0 : to - t, k: to === null ? 1 : Math.max(0, Math.min(1, (t - from) / Math.max(1, to - from))) };
}
// The line under a DEGENERATE rank: one per level, supportive with a jab (Evrtek 11-07: "glued to your phone ... go touch
// some grass ... what are you doing with your life"). His own words close the game, on the last level of galaxy 3.
export const DEGENERATE_LINES = {
  1: [
    'BLINK. GO ON, BLINK. YOUR EYES ARE ASKING.',
    'THE GRASS OUTSIDE MISSES YOU. IT TOLD US.',
    'YOUR THUMBS HAVE TRAINED HARDER THAN MOST ATHLETES.',
    'SOMEWHERE A HOUSEPLANT IS DYING OF THIRST. WORTH IT.',
    'PROUD OF YOU. ALSO, WHEN DID YOU LAST EAT?',
    'YOUR SCREEN TIME REPORT IS GOING TO READ LIKE A CONFESSION.',
    'FLAWLESS. GO TELL A REAL PERSON. ANY PERSON.',
    'THE GRAVEYARD IS CLEARED. YOUR INBOX IS NOT.',
    'YOUR MOTHER WOULD BE PROUD. CONFUSED, BUT PROUD.',
    'GALAXY ONE, CONQUERED. THE SUN IS STILL OUT THERE, BY THE WAY.',
  ],
  2: [
    'THE OCEAN IS REAL TOO, YOU KNOW. IT HAS FISH.',
    'TOUCH GRASS. THE REAL KIND, NOT THE SPACE KIND.',
    'YOUR CHARGER CABLE IS YOUR CLOSEST FRIEND NOW.',
    'YOU HAVE MIGRATED FURTHER THAN MOST BIRDS. FROM THE COUCH.',
    'GRAVITY IS ALSO AVAILABLE OUTSIDE. FREE OF CHARGE.',
    'YOU UNTANGLED THE TANGLE. NOW UNTANGLE YOUR SLEEP SCHEDULE.',
    'THE FLOWERS BLOOMED. HAVE YOU SEEN A REAL ONE THIS WEEK?',
    'THE ANGLER LURED YOU IN. SO DID THIS GAME, CLEARLY.',
    'REAL BIRDS FLOCK OUTSIDE. THEY WOULD LIKE TO MEET YOU.',
    'YOU BEAT THE ROOTMIND. WATER A PLANT TO CELEBRATE.',
  ],
  3: [
    'YOU BUILT A HABIT. WE ARE NOT SAYING IT IS A GOOD ONE.',
    'YOUR PHONE IS WARM. YOUR DINNER IS COLD. PERFECT.',
    'YOU PICKED EVERY LOCK. NOW TRY THE FRONT DOOR.',
    'THE AUGURS SAW THIS COMING. SO DID YOUR BATTERY.',
    'A MASTERPIECE. FRAME IT. THEN STAND UP AND STRETCH.',
    'EVEN THE FORGERIES ARE IMPRESSED. THE REAL YOU NEEDS A NAP.',
    'RIVETING. HONESTLY, WE ARE A LITTLE WORRIED ABOUT YOU.',
    'INFINITE FRACTALS, ONLY ONE OF YOU. CALL A FRIEND.',
    'YOU CRACKED THE VAULT. THE FRIDGE IS EASIER, AND IT HAS SNACKS.',
    'YOU BEAUTIFUL DEGENERATE HUMAN, YOU. NOW GO OUTSIDE.',
  ],
};
export function degenerateLine(n, g = 1) { return (DEGENERATE_LINES[g] || DEGENERATE_LINES[1])[(n - 1) % 10] || 'YOU BEAUTIFUL DEGENERATE HUMAN, YOU.'; }
// A finished run, cleared or not -> its stars (0..5), its rank letter, and the next thing to aim for in plain words.
// run: { cleared, total }; n = the level, in play order; g = its galaxy. A run that did not finish earns no star,
// whatever it scored.
export function grade(run, n, g = 1) {
  const total = Math.floor(run.total || 0), p = starProgress(total, n, g);
  const stars = run.cleared ? p.stars : 0, rank = run.cleared ? p.tier.rank : '';
  let hint;
  if (!run.cleared) hint = 'MAKE IT TO THE END FOR YOUR FIRST ★';
  else if (!p.next) hint = degenerateLine(n, g);
  else if (p.next.rank === 'DEGENERATE') hint = 'ALL FIVE STARS. ' + fmt(p.more) + ' MORE FOR DEGENERATE';
  else hint = fmt(p.more) + ' MORE FOR ' + starText(p.next.stars) + '. BUILD YOUR MULTIPLIER AND HOLD IT';
  return { stars, rank, have: Array.from({ length: MAX_STARS }, (_, i) => i < stars), next: hint, nextGate: run.cleared ? p.next : TIERS[0], need: p.to, more: p.more, total };
}

// ---- 0.6.0, the player pass: what the engine lays on every level's course after the level's own build (levels never
// place these themselves, so all thirty follow one rule and check-levels can hold it).
const ringEvent = (e) => { const k = getKind(e.type); return !!(k && k.countsAsRing && !e.cache && !e.decor); };
// the flight box on a wide screen and on a tall phone (main.js resize): course positions are normalised (nx, ny), so a
// distance in metres has to hold in both
export const BOXES = [{ name: 'wide', x: 7.5, y: 4.3 }, { name: 'phone', x: 4.1, y: 5.6 }];

// CHECKPOINTS (Evrtek 11-10: "Checkpoints on ALL levels ... a symbolic checkpoint you grab ... You restart from it if you
// fail the level"; "at about 50% of most levels and about 80% of boss levels"). One a level, ON the ring line (so it is
// in the flight path): beside the ring nearest the mark, a calm stretch of the beat sheet first. On a boss level the mark
// is a few seconds before the boss arrives, which is about four fifths of the level by the clock (the fight is the rest).
// A level may say where itself (checkpoint: { d, nx, ny }) or opt out (checkpoint: false: the proving levels).
export const CHECKPOINT = { half: 0.5, span: 0.06, bossLead: 2.6, bossSpan: [4.2, 1.8] };
function layCheckpoint(L, lay) {
  if (L.checkpoint === false || lay.events.some((e) => e.type === 'checkpoint')) return null;
  if (L.checkpoint && L.checkpoint.d) return lay.add(L.checkpoint.d, 'checkpoint', { nx: L.checkpoint.nx || 0, ny: L.checkpoint.ny || 0 });
  const end = L.boss ? L.boss.at : L.length, v = L.speed(end);
  let want = L.boss ? end - CHECKPOINT.bossLead * v : CHECKPOINT.half * end;
  let lo = L.boss ? end - CHECKPOINT.bossSpan[0] * v : (CHECKPOINT.half - CHECKPOINT.span) * end; const hi = L.boss ? end - CHECKPOINT.bossSpan[1] * v : (CHECKPOINT.half + CHECKPOINT.span) * end;
  // a Shield Cell at the boss's door comes BEFORE the checkpoint (a restart there has a full shield, so a cell after it would
  // be wasted): the checkpoint waits until the cell is behind, where the door leaves room (else the cell moves: below)
  if (L.boss) for (const c of lay.events) if (c.type === 'shield-cell' && c.d < end && c.d + CELL.beforeCheckpoint * v <= hi) lo = Math.max(lo, c.d + CELL.beforeCheckpoint * v);
  want = Math.max(want, lo);
  const beats = (L.beats || []).slice().sort((a, b) => a.d - b.d), heat = { calm: 0, rising: 1, peak: 2 };
  const tagAt = (d) => { let t = 'calm'; for (const b of beats) { if (b.d <= d) t = b.tag; else break; } return heat[t] ?? 1; };
  let best = null, score = 1e18;
  for (const r of lay.events) {
    if (!ringEvent(r) || r.d < lo || r.d > hi || r.nx === undefined) continue;
    const s = tagAt(r.d) * (hi - lo) + Math.abs(r.d - want); // a calmer beat beats a nearer ring
    if (s < score) { score = s; best = r; }
  }
  if (best) return lay.add(best.d + 8, 'checkpoint', { nx: best.nx, ny: best.ny });
  // no ring in the window (a bare approach to a boss): on the line the last ring before it left
  let last = null; for (const r of lay.events) if (ringEvent(r) && r.nx !== undefined && r.d <= want && r.d > want - 6 * v && (!last || r.d > last.d)) last = r;
  return lay.add(want, 'checkpoint', { nx: last ? last.nx : 0, ny: last ? last.ny : 0 });
}

// SHIELD CELLS sit OFF the ring line (Evrtek 11-10: "useful right before or during a boss fight, but never in the normal
// ring path. Place them off-line, so taking one means breaking the ring run: a real choice between health and
// multiplier"). Wherever a level put a cell, the engine slides it sideways until the ship cannot take it and the rings
// passing at that moment together: at least CELL_OFF past the two catch radii, on a wide screen and a phone alike, and
// clear of whatever else is on the course there. It moves as little as it can, so it stays where the level meant it
// (the same stretch, the same side when that side is free). ev.onLine keeps one where it is (none does).
// Two more things, so the choice is always a real one: a cell with no ring passing in its moment is slid along the course
// to the nearest ring run within CELL.reach seconds (a cell beside nothing costs nothing); and on a boss level a cell at
// the boss's door sits before the checkpoint, never after it (a restart there comes back with a full shield: main.js).
export const CELL = { off: 0.6, window: 0.35, clear: 3.2, reach: 1.6, beforeCheckpoint: 0.9 };
function moveCellsOffLine(L, events) {
  const rings = events.filter((e) => ringEvent(e) && e.nx !== undefined), ease = easeOf(L.n, L.g || 1);
  const need = PICK_R + RING_R * ease.ring + CELL.off;
  for (const c of events) {
    if (c.type !== 'shield-cell' || c.onLine) continue;
    const v = L.speed(c.d), W = Math.max(40, CELL.window * v), cp = events.find((e) => e.type === 'checkpoint');
    const doorMax = L.boss && cp && c.d > cp.d - 6 * v && c.d < L.boss.at ? cp.d - CELL.beforeCheckpoint * v : Infinity; // the last place a door cell may sit
    if (c.d > doorMax) { c.wasD = c.d; c.d = doorMax; }
    let near = rings.filter((r) => Math.abs(r.d - c.d) <= W);
    if (!near.length && !(L.boss && c.d > L.boss.at)) {
      // beside nothing: slide to the nearest ring run within reach (still before the checkpoint if it is a door cell)
      let to = null; for (const r of rings) if (Math.abs(r.d - c.d) <= CELL.reach * v && r.d <= doorMax && (!to || Math.abs(r.d - c.d) < Math.abs(to.d - c.d))) to = r;
      if (to) { c.wasD = c.wasD ?? c.d; c.d = to.d; near = rings.filter((r) => Math.abs(r.d - c.d) <= W); }
    }
    const things = events.filter((e) => e !== c && Math.abs(e.d - c.d) <= 60 && e.nx !== undefined && !e.decor && !ringEvent(e) && ['obstacle', 'enemy'].includes((getKind(e.type) || {}).role));
    c.cost = near.length; // the rings its moment holds: what taking it puts at risk (check-levels reports it)
    if (!near.length) { c.off = Infinity; continue; }
    const far = (nx, ny, list) => { let m = 1e9; for (const B of BOXES) for (const r of list) m = Math.min(m, Math.hypot((nx - r.nx) * B.x, (ny - r.ny) * B.y)); return m; };
    let best = null, widest = null;
    for (let j = -15; j <= 15; j++) for (let i = -17; i <= 17; i++) {
      const nx = i * 0.05, ny = j * 0.05;
      if (things.length && far(nx, ny, things) < CELL.clear) continue;
      const off = far(nx, ny, near), move = Math.hypot((nx - (c.nx || 0)) * 7.5, (ny - (c.ny || 0)) * 4.3);
      if (!widest || off > widest.off) widest = { nx, ny, off, move };
      if (off >= need && (!best || move < best.move - 1e-9)) best = { nx, ny, off, move };
    }
    const to = best || widest; if (!to) { c.off = far(c.nx || 0, c.ny || 0, near); continue; }
    c.was = [c.nx || 0, c.ny || 0]; c.nx = +to.nx.toFixed(2); c.ny = +to.ny.toFixed(2); c.off = to.off; c.need = need;
  }
}

// ---- loading. loadLevel(n) is galaxy 1's level n (as before); loadLevel(g, n) any galaxy's. A level module's path:
// galaxy 1 js/levels/level<file>.js, galaxies 2 and 3 js/levels/g<G>/level<N>.js.
const cache = {};
export const levelPath = (g, n) => { if (g === 1) { const c = CATALOGUE.find((q) => q.n === n), file = (c && c.file) || n; return './levels/level' + file + '.js'; } return './levels/g' + g + '/level' + n + '.js'; };
export async function loadLevel(a, b) {
  const [g, n] = gn(a, b), k = g + ':' + n;
  if (cache[k]) return cache[k];
  const mod = await import(levelPath(g, n) + V);
  const L = mod.default;
  if (typeof n === 'number' && ((L.g || 1) !== g || L.n !== n)) throw new Error('level module ' + levelPath(g, n) + ' says g ' + (L.g || 1) + ' n ' + L.n + ', not g ' + g + ' n ' + n);
  cache[k] = prepareLevel(L);
  return cache[k];
}
export const loaded = (a, b) => { const [g, n] = gn(a, b); return cache[g + ':' + n] || null; };

// Lay a level's course out from its seed: the section banners first (0.1.0 did, and the order of ties matters
// for the same course), then the level's own build(R, L), then the boss or the finish line.
export function prepareLevel(L) {
  const R = rng(L.seed), lay = layout();
  for (const s of L.sections) if (s.banner !== false) lay.add(s.d0 + (s.d0 === 0 ? 40 : 10), 'banner', { section: s.id });
  L.build(R, lay, L);
  // 0.4.0: power-ups given as data ([d, kind, nx, ny], the galaxy 1 retrofit) are laid after the level's own course, so
  // nothing it lays moves; their kinds join the level's (warmed on the loading screen like every other)
  if (L.powerups && !L._puLaid) {
    for (const [d, type, nx, ny] of L.powerups) lay.add(d, type, { nx, ny });
    for (const k of POWERUP_KINDS) if (L.powerups.some((p) => p[1] === k.name) && !L.kinds.includes(k)) L.kinds.push(k);
  }
  // 0.6.0, the player pass: the level's checkpoint, on its ring line; every Shield Cell off it; and a boss level can always
  // show a Shield Cell (one drifts in mid-fight: boss.js), so its kind is warmed with the rest
  if (layCheckpoint(L, lay) && !L.kinds.includes(checkpointKind)) L.kinds.push(checkpointKind);
  if (L.boss && !L.kinds.includes(shieldCell)) L.kinds.push(shieldCell);
  moveCellsOffLine(L, lay.events);
  if (L.boss) lay.add(L.boss.at, 'boss', {});
  else if (!lay.events.some((e) => e.type === 'end')) lay.add(L.length, 'end', {});
  const events = lay.events.sort((a, b) => a.d - b.d);
  // Where 0.1.0's spawn queue would have spawned each event. Its queue spawned in order and a banner, a
  // strafer or the finish (0 m lead) held up everything behind it, which then appeared at once, in plain view:
  // the pop-in Evrtek saw. 0.2.0 spawns everything at the line; level 1's pods still start drifting where they
  // were born before (legacyAt: metres ahead of the ship), so it plays as it did.
  let q = -1e9;
  for (const e of events) { const nowish = isNow(e.type); q = Math.max(q, e.d - (nowish ? 0 : LEGACY_LINE)); e.legacyAt = L.legacy ? Math.max(0, e.d - q) : LEGACY_LINE; }
  // a fly-in kind with a lead (seconds) is born that much earlier, so its approach is seen and its main act (a strafe)
  // still starts where its event is; the now-queue runs in birth order
  for (const e of events) { const k = getKind(e.type); if (k && k.spawnAt === 'now' && k.lead) e.at = e.d - k.lead * L.speed(e.d); }
  const line = events.filter((e) => !isNow(e.type)), now = events.filter((e) => isNow(e.type)).sort((a, b) => (a.at ?? a.d) - (b.at ?? b.d));
  const ringTotals = {}; let ringTotal = 0, cacheTotal = 0;
  const sectionAt = (d) => { for (const s of L.sections) if (d < s.d1) return s; return L.sections[L.sections.length - 1]; };
  // 0.4.0: a CACHE ring (ev.cache: hidden behind a Phase wall, a lure, an extra) is outside the ring-share base: it pays
  // score, combo and shield and shows on its own tally line, and never counts toward any star (the plan's 6.4)
  for (const e of events) { const k = getKind(e.type); if (k && k.countsAsRing && !e.decor) { if (e.cache) { cacheTotal++; continue; } ringTotal++; const s = sectionAt(e.d).id; ringTotals[s] = (ringTotals[s] || 0) + 1; } }
  const powerups = events.filter((e) => { const k = getKind(e.type); return k && k.powerup; }).length;
  // the human pass (0.3.0): how gentle this level is (EASE, by its place in the play order; 0.4.0: and its galaxy); 0.3.1: its roll-or-hit fire
  const cp = events.find((e) => e.type === 'checkpoint');
  return Object.assign(L, { events, line, now, ringTotal, ringTotals, cacheTotal, powerups, sectionAt, spawnD: SPAWN_D, ease: easeOf(L.n, L.g || 1), fire: fireOf(L.n, L.g || 1),
    checkpointAt: cp ? cp.d : null, gates: starScores(L.n, L.g || 1) });
}
const MARKERS = new Set(['banner', 'end', 'boss', 'music', 'call']);
export function isNow(type) { if (MARKERS.has(type)) return true; const k = getKind(type); return !!(k && k.spawnAt === 'now'); }
export const isMarker = (type) => MARKERS.has(type);

// ---- progress. Key per level: 0.1.0's 'ringreaper.best.level1' ({score, rank}) is read as it was and extended.
// 0.4.0: galaxy 1 keeps its keys EXACTLY (nothing an existing player has moves or can be lost); galaxies 2 and 3 save
// under 'ringreaper.best.g2.level4' and so on.
const key = (a, b) => { const [g, n] = gn(a, b); return g === 1 ? 'ringreaper.best.level' + n : 'ringreaper.best.g' + g + '.level' + n; };
// the swaps: records are kept by place; move them so each follows its level, once per device. 'ringreaper.order' says
// which swaps a device has had: none (a 0.1.0 save, or nothing yet), '2' = levels 1 and 2 (11-05), '3' = and levels 5
// and 7 (11-08). A device catching up takes every swap it missed, in order.
export const ORDER = '3';
const swapKeys = (a, b) => {
  const x = localStorage.getItem(key(a)), y = localStorage.getItem(key(b));
  if (y !== null) localStorage.setItem(key(a), y); else localStorage.removeItem(key(a));
  if (x !== null) localStorage.setItem(key(b), x); else localStorage.removeItem(key(b));
};
(function migrateOrder() {
  try {
    const was = localStorage.getItem('ringreaper.order');
    if (was === ORDER) return;
    if (was !== '2') swapKeys(1, 2); // 11-05: Shattered Moon first, Nebula Run second
    swapKeys(5, 7);                  // 11-08: Neon Orbital fifth, Ion Storm seventh
    localStorage.setItem('ringreaper.order', ORDER);
  } catch (e) { /* storage blocked: nothing to move */ }
})();
// five stars (Evrtek 11-06): a record from the three-star game is moved over once per device. Its ring share was
// never kept, so the stars cannot be re-derived; they are mapped up so nobody sees fewer than they earned
// (1 -> 1, 2 -> 3, 3 -> 4), and the rank letter follows the new star count, as it does from now on.
export const STAR_MAP = { 0: 0, 1: 1, 2: 3, 3: 4 };
(function migrateStars() {
  try {
    if (localStorage.getItem('ringreaper.stars') === '5') return;
    for (const c of CATALOGUE) {
      const r = store(key(c.n)); if (!r) continue;
      const stars = STAR_MAP[r.stars | 0] ?? Math.min(MAX_STARS, r.stars | 0);
      store(key(c.n), Object.assign(r, { stars, rank: rankForStars(stars) }));
    }
    localStorage.setItem('ringreaper.stars', '5');
  } catch (e) { /* storage blocked: nothing to move */ }
})();
// the galaxies (0.4.0): a flag only. Galaxy 1's records are read where they always were and never rewritten; a player
// who already finished the Lattice Heart finds galaxy 2 open the moment they update (it is worked out, not stored).
(function migrateGalaxies() {
  try { if (localStorage.getItem('ringreaper.galaxies') !== '1') localStorage.setItem('ringreaper.galaxies', '1'); } catch (e) { /* storage blocked */ }
})();
const EMPTY = { score: 0, rank: '', stars: 0, cleared: false };
export const Progress = {
  // every call takes (g, n), or (n) alone for galaxy 1
  get(a, b) { return Object.assign({}, EMPTY, store(key(a, b)) || {}); },
  cleared(a, b) { return this.get(a, b).cleared; },
  // A galaxy opens when the one before it has its level 10 finished, and an opened galaxy stays open: any record in it
  // keeps it open. (0.6.0: no boss retreats on a clock any more, so a finale is finished by beating it; its checkpoint sits
  // at the boss's door, so nobody has to fly the whole level again to try.)
  galaxyOpen(g) {
    if (g === 1) return true;
    if (!galaxy(g) || (DEMO && g > 1)) return false; // (0.6.0: a demo is galaxy 1's first three levels, whatever the save holds)
    return this.cleared(g - 1, catalogueOf(g - 1).length) || catalogueOf(g).some((c) => { const r = this.get(g, c.n); return r.cleared || r.score > 0; });
  },
  // clearing N puts N on the select for replay and opens N+1; anything past that stays locked
  // a cleared level always stays replayable, even if the one before it is not cleared (the swap moved records)
  unlocked(a, b) { const [g, n] = gn(a, b); if (!this.galaxyOpen(g) || !inDemo(g, n)) return false; return n === 1 || this.cleared(g, n) || this.cleared(g, n - 1); },
  // the furthest level open in one galaxy (furthestIn), and in the whole game: the furthest galaxy open, its furthest
  // level. furthest() is galaxy 1's level number (as 0.3); furthestAt() is [g, n] (CONTINUE).
  furthestIn(g) { let f = 1; for (const c of catalogueOf(g)) if (this.unlocked(g, c.n)) f = c.n; return f; },
  // CONTINUE (Evrtek 11-08): the first open level not yet cleared in the furthest open galaxy, so a reorder can never jump
  // a player past a level they have not played; with every open level cleared, the furthest one, as before
  furthestAt() {
    let g = 1; for (const x of GALAXIES) if (this.galaxyOpen(x.g)) g = x.g;
    for (const c of catalogueOf(g)) if (this.unlocked(g, c.n) && !this.cleared(g, c.n)) return [g, c.n];
    return [g, this.furthestIn(g)];
  },
  furthest() { return this.furthestIn(1); },
  any() { return GALAXIES.some((x) => x.levels.some((c) => { const r = this.get(x.g, c.n); return r.cleared || r.score > 0; })); },
  // stars and score: one galaxy's (out of 50) with g, the whole game's (out of 150) without
  totalStars(g) { if (g === undefined) return GALAXIES.reduce((s, x) => s + this.totalStars(x.g), 0); return catalogueOf(g).reduce((s, c) => s + this.get(g, c.n).stars, 0); },
  totalScore(g) { if (g === undefined) return GALAXIES.reduce((s, x) => s + this.totalScore(x.g), 0); return catalogueOf(g).reduce((s, c) => s + this.get(g, c.n).score, 0); },
  maxStars(g) { return (g === undefined ? GALAXIES.reduce((s, x) => s + x.levels.length, 0) : catalogueOf(g).length) * MAX_STARS; },
  clearedCount(g) { return catalogueOf(g).filter((c) => this.cleared(g, c.n)).length; },
  // a finished run: keep the best of everything (score, stars, rank, each on its own); returns what changed. Stars
  // and rank never go down. save(n, run, stars) is galaxy 1's (as 0.3); save(g, n, run, stars) any galaxy's.
  save(...args) {
    const [g, n, run, stars] = typeof args[1] === 'number' ? args : [1, ...args];
    const b = this.get(g, n), isNew = run.total > b.score;
    const rec = { score: Math.max(b.score, run.total), rank: rankAtLeast(run.rank, b.rank) ? run.rank : b.rank, stars: Math.max(b.stars, stars), cleared: b.cleared || run.cleared };
    store(key(g, n), rec);
    return { isNew, before: b, after: rec, newStars: rec.stars > b.stars };
  },
  // one-time lessons (0.3.0: 'roll', the barrel-roll lesson on level 1), kept beside the records
  tip(name) { return !!(store('ringreaper.tips') || {})[name]; },
  setTip(name, on = true) { const t = store('ringreaper.tips') || {}; if (on) t[name] = 1; else delete t[name]; store('ringreaper.tips', t); },
  // 0.4.0: the first-time tips (js/tutorials.js): every card this player has seen, by its id, kept beside the records
  seen(id) { return !!(store('ringreaper.seen') || {})[id]; },
  see(id) { const t = store('ringreaper.seen') || {}; t[id] = 1; store('ringreaper.seen', t); },
  // NEW GAME's erase: every record in all three galaxies, and the lessons and the tips come back too
  wipe() {
    const keys = GALAXIES.flatMap((x) => x.levels.map((c) => key(x.g, c.n))).concat(['ringreaper.tips', 'ringreaper.seen']);
    for (const k of keys) { try { localStorage.removeItem(k); } catch (e) { /* storage blocked */ } }
  },
};
