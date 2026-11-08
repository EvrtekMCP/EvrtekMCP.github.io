// STARWAKE 0.4.0: three galaxies of levels: the catalogues, loading a level module, laying out its course, and the
// player's progress (unlocks, stars, best score and rank per level). All progress is in localStorage on the
// device; dev runs never write any of it.
import { V, rng, store } from './util.js?v=0.4.1';
import { getKind } from './registry.js?v=0.4.1';
import { layout } from './layout.js?v=0.4.1';
import { SPAWN_D, LEGACY_LINE } from './space.js?v=0.4.1';
import { POWERUP_KINDS } from './pickups/powerups/index.js?v=0.4.1'; // 0.4.0: a level's `powerups` field (the galaxy 1 retrofit)

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

// ---- the difficulty curve (0.3.0, the human pass; Evrtek 11-06: "Game is too hard in the early levels"). Per level,
// in play order; a level with no entry plays at full strength, so levels 7-10 keep their character (6 has softer hits).
//   dmg   every hit to the shield is scaled by this
//   heal  the shield a ring gives back is scaled by this
//   shot  enemy shots take this much longer to reach you: more warning, more time to roll (level 3 keeps 1: its gate
//         turrets land their shots on the beat)
//   ring  how far from a ring's middle still counts as through it (a boost ring's too), scaled
// Why (tools/test/human.js, the human bot, on 0.2.0): a newcomer finished Nebula Run on 2% shield, six of its thirteen
// hits on the lightgates' frames; and on levels 1 and 2 no skill caught 80% of the rings, where levels 3-8 gave 88-97%.
// By PLACE, not by level (the 5/7 swap, 11-08): place 5's 0.92 is now Neon Orbital's, and Ion Storm at 7 flies at full
// strength, as the 1/2 swap gave the opener's gentleness to whichever level opens.
export const EASE = {
  1: { dmg: 0.55, heal: 1.5, shot: 1.3, ring: 1.3 },
  2: { dmg: 0.6, heal: 1.5, shot: 1.25, ring: 1.3 },
  3: { dmg: 0.75, heal: 1.25, shot: 1, ring: 1.15 },
  4: { dmg: 0.85, heal: 1.1, shot: 1, ring: 1.05 },
  5: { dmg: 0.92, heal: 1, shot: 1, ring: 1 },
  // the one late step steeper than the rest: in the Leviathan's fight (it holds 52 m out, fans of five) the bot's decent
  // runs fell to 8% and 30% shield and a newcomer went down, below levels 9 and 10. Softer hits and 10% slower shots;
  // its patterns, its loop timing (so the fight is no longer), the rings and the speed are untouched.
  6: { dmg: 0.8, heal: 1, shot: 1.1, ring: 1 },
};
// 0.4.0: galaxies 2 and 3 go past full strength (the plan's §5.1): dmg above 1 hurts more, heal below 1 gives back less,
// shot below 1 arrives a little sooner, ring below 1 tightens the catch. Pressure (dmg / heal / shot) starts above the
// last galaxy's start and ends above its end: G1 0.28 -> 1.00, G2 0.39 -> 1.18, G3 0.52 -> 1.39. Two guard rails: shot
// never under 0.92 (check-levels holds every warning floor) and ring never under 0.95 (ring share is the star gate).
// RE-BASED when 0.3.1 lands (its galaxy 1 rise): galaxy 2's level 1 sits at or above galaxy 1's middle, its 10 above 1's 10.
export const EASE_G = {
  1: EASE,
  2: {
    1: { dmg: 0.65, heal: 1.4, shot: 1.2, ring: 1.25 },
    2: { dmg: 0.7, heal: 1.35, shot: 1.15, ring: 1.2 },
    3: { dmg: 0.8, heal: 1.2, shot: 1.05, ring: 1.12 },
    4: { dmg: 0.88, heal: 1.1, shot: 1.0, ring: 1.05 },
    5: { dmg: 0.95, heal: 1.0, shot: 1.0, ring: 1.0 },
    6: { dmg: 0.9, heal: 1.0, shot: 1.05, ring: 1.0 },
    7: { dmg: 1.02, heal: 0.98, shot: 0.98, ring: 1.0 },
    8: { dmg: 1.04, heal: 0.97, shot: 0.98, ring: 1.0 },
    9: { dmg: 1.06, heal: 0.95, shot: 0.97, ring: 0.98 },
    10: { dmg: 1.08, heal: 0.95, shot: 0.96, ring: 0.98 },
  },
  3: {
    1: { dmg: 0.75, heal: 1.3, shot: 1.1, ring: 1.2 },
    2: { dmg: 0.8, heal: 1.25, shot: 1.35, ring: 1.15 }, // the curve (11-07): shots slower, so the Loom Floor stays an early level (it asked 25.6 rolls a minute, above all but the Vault)
    3: { dmg: 0.88, heal: 1.15, shot: 1.02, ring: 1.08 },
    4: { dmg: 0.95, heal: 1.05, shot: 1.0, ring: 1.0 },
    5: { dmg: 1.0, heal: 1.0, shot: 0.98, ring: 1.0 },
    6: { dmg: 0.98, heal: 1.0, shot: 1.02, ring: 1.0 },
    7: { dmg: 1.08, heal: 0.97, shot: 0.97, ring: 0.98 },
    8: { dmg: 1.12, heal: 0.95, shot: 0.95, ring: 0.97 },
    9: { dmg: 1.15, heal: 0.93, shot: 0.94, ring: 0.96 },
    10: { dmg: 1.18, heal: 0.92, shot: 0.92, ring: 0.95 },
  },
};
export const easeOf = (n, g = 1) => Object.assign({ dmg: 1, heal: 1, shot: 1, ring: 1 }, (EASE_G[g] || EASE)[n] || {});
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

// ---- stars and ranks (Evrtek 11-06, the human pass): FIVE stars a level, won by the share of the level's rings
// caught; the top ones also want some style. Score never buys a star or a rank (it is the brag number). The rank
// letters follow the stars, and DEGENERATE sits above all five: the brag rank, no sixth star.
//   ★ clear the level   ★★ 30% of the rings (C)   ★★★ 60% (B)   ★★★★ 80% + style (A)   ★★★★★ 90% + style (S)
//   DEGENERATE 95% + more style   (levels 9 and 10 ask less: RING_SHARES, below)
// Style = grazes and close calls (counted together) and roll deflects (shots sent back), each with a small minimum per
// level (STYLE), sized from the human bot so a decent player who is trying gets them on the way.
export const MAX_STARS = 5;
export const GATES = [
  { stars: 1, rank: '', rings: 0 },
  { stars: 2, rank: 'C', rings: 0.30 },
  { stars: 3, rank: 'B', rings: 0.60 },
  { stars: 4, rank: 'A', rings: 0.80, style: true },
  { stars: 5, rank: 'S', rings: 0.90, style: true },
  { stars: 5, rank: 'DEGENERATE', rings: 0.95, style: true },
];
// [grazes + close calls, deflects] wanted for A, S and DEGENERATE, per level in play order. Sized from the human bot's
// decent runs on 0.3.0 (tools/test/human.js; what it showed per level, close / deflects: 1: 16/10, 2: 24/19, 3: 17/33,
// 4: 1/8, 5: 18/4, 6: 65/76, 7: 14/8, 8: 7/7, 9: 26/26, 10: 19/47): A asks about a quarter of that, S about 40%,
// DEGENERATE about 60%. Level 4 asks no close calls: nothing on it scrapes, and its seekers' grazing bolts only graze if
// you do not roll them (the autopilot, rolling everything, made none), so there its style is the roll alone. The rings
// are the real gate.
// The 5/7 swap (11-08): each LEVEL keeps its own minimums (they are sized from what it gives), so 5 and 7 traded rows:
// the "5: 18/4" above is Ion Storm's, now played 7th, and "7: 14/8" Neon Orbital's, now 5th. By place, Ion Storm's
// DEGENERATE would ask 5 roll-backs of a level where the decent bot makes about 4.
export const STYLE = {
  1: { A: [3, 2], S: [5, 3], DEGENERATE: [8, 5] },
  2: { A: [4, 3], S: [6, 5], DEGENERATE: [10, 8] },
  3: { A: [3, 4], S: [5, 6], DEGENERATE: [8, 10] },
  4: { A: [0, 2], S: [0, 3], DEGENERATE: [0, 6] },
  5: { A: [2, 2], S: [4, 3], DEGENERATE: [6, 5] }, // NEON ORBITAL
  6: { A: [8, 8], S: [14, 14], DEGENERATE: [24, 24] },
  7: { A: [3, 1], S: [5, 2], DEGENERATE: [8, 3] }, // ION STORM
  8: { A: [1, 2], S: [2, 3], DEGENERATE: [4, 5] },
  9: { A: [4, 4], S: [6, 6], DEGENERATE: [10, 10] },
  10: { A: [3, 6], S: [5, 10], DEGENERATE: [8, 16] },
};
// 0.4.0: galaxies 2 and 3. A level sets its own minimums in its module (`style: { A: [c, d], S: [...], DEGENERATE:
// [...] }`, sized from its human bot runs the way galaxy 1's were); a level that does not uses its galaxy's default
// here. As roll demand rises (the plan's §5.3), the deflect minimum rises with it.
export const STYLE_G = {
  1: STYLE,
  2: { A: [3, 4], S: [5, 7], DEGENERATE: [8, 11] },
  3: { A: [3, 5], S: [5, 8], DEGENERATE: [8, 13] },
};
const styleOf = (n, rank, g = 1) => {
  const L = cache[g + ':' + n];
  if (L && L.style && L.style[rank]) return L.style[rank];
  if (g === 1) return (STYLE[n] || STYLE[1])[rank] || [0, 0];
  return (STYLE_G[g] || STYLE_G[2])[rank] || [0, 0];
};
// A LEVEL'S OWN RING SHARES (0.3.0, Evrtek 11-06: "Make them easier"), where the global ones ask for rings nobody can
// catch: on levels 9 and 10 even the autopilot takes only 86% (its runs: 324 of 376 and 310 of 358). Levels 1-8 use
// GATES. Style is not touched. Each entry: the share for C, B, A, S and DEGENERATE. DEGENERATE sits just under the
// autopilot (320 and 305 rings needed). The good human bot caught 77% of level 9 on three seeds out of three and 84% of
// level 10, so five stars ask 75% and 80%: a good run clears them by about the same few rings.
export const RING_SHARES = {
  9: { C: 0.25, B: 0.5, A: 0.65, S: 0.75, DEGENERATE: 0.85 },
  10: { C: 0.25, B: 0.5, A: 0.7, S: 0.8, DEGENERATE: 0.85 },
};
// 0.4.0: galaxies 2 and 3 (the plan's §5.2), stepping down late where the human bot shows the global gates are out of
// reach. Starting points: before a galaxy ships the good human bot flies each level on three seeds and these are
// re-sized from that, as 0.3.0 did for levels 9 and 10. Caches and other extras never count (they are not in the total).
const SH = (C, B, A, S, DEGENERATE) => ({ C, B, A, S, DEGENERATE });
// Sized by shares.js (CLU-I2, 11-07, the MCP's rules): five stars just under the good bot's worse run with every power-up
// ignored, DEGENERATE above the decent bot's better run (two seeds each, on the final code). A level not listed takes the
// global gates; the Weftwork keeps them by the MCP's word (the good bot's worse run there was 91%).
export const RING_SHARES_G = {
  1: RING_SHARES,
  2: { 4: SH(0.28, 0.57, 0.76, 0.86, 0.95), 7: SH(0.28, 0.56, 0.75, 0.85, 0.9), 8: SH(0.28, 0.57, 0.77, 0.87, 0.92), 9: SH(0.27, 0.54, 0.73, 0.83, 0.88),
    10: SH(0.29, 0.59, 0.79, 0.89, 0.94) },
  3: { 3: SH(0.28, 0.57, 0.77, 0.87, 0.92), 4: SH(0.26, 0.53, 0.71, 0.81, 0.86), 5: SH(0.26, 0.53, 0.71, 0.81, 0.88), 6: SH(0.21, 0.42, 0.57, 0.67, 0.78),
    7: SH(0.27, 0.55, 0.74, 0.84, 0.89), 8: SH(0.26, 0.53, 0.71, 0.81, 0.86), 9: SH(0.29, 0.58, 0.78, 0.88, 0.93) },
};
export const shareOf = (gate, n, g = 1) => { const T = RING_SHARES_G[g] || RING_SHARES; return T[n] && T[n][gate.rank] !== undefined ? T[n][gate.rank] : gate.rings; };
export const rankAtLeast = (r, want) => RANK_ORDER.indexOf(r || '') >= RANK_ORDER.indexOf(want || '');
export const rankForStars = (s) => ['', '', 'C', 'B', 'A', 'S'][Math.max(0, Math.min(5, s))];
const starText = (n) => '★'.repeat(n);
const pctFloor = (f) => Math.floor(f * 100 + 1e-9);

// what a gate still wants from this run ([] when it is met), on level n of galaxy g (its own ring shares, if it has
// them). The ring share is a whole number of rings: 90% of 187 rings is 169 (168.3 rounded up).
export function missing(run, gate, n, g = 1) {
  const out = [];
  if (!run.cleared) out.push({ what: 'clear' });
  const share = shareOf(gate, n, g), total = run.ringTotal || 0, need = Math.ceil(total * share - 1e-9);
  if (run.rings < need) out.push({ what: 'rings', pct: Math.round(share * 100), got: total ? pctFloor(run.rings / total) : 0, more: need - run.rings });
  if (gate.style) {
    const [close, defl] = styleOf(n, gate.rank, g), haveClose = (run.grazes || 0) + (run.scrapes || 0);
    if (haveClose < close) out.push({ what: 'close', more: close - haveClose });
    if ((run.deflects || 0) < defl) out.push({ what: 'deflects', more: defl - (run.deflects || 0) });
  }
  return out;
}
// what is missing, the way a person would say it
function sayMissing(m) {
  const parts = [];
  for (const x of m) {
    if (x.what === 'rings') parts.push('CATCH ' + x.pct + '% OF THE RINGS (YOU GOT ' + x.got + '%)');
    else if (x.what === 'close') parts.push(x.more + ' MORE ' + (x.more === 1 ? 'GRAZE OR CLOSE CALL' : 'GRAZES OR CLOSE CALLS'));
    else if (x.what === 'deflects') parts.push('ROLL ' + x.more + ' MORE ' + (x.more === 1 ? 'SHOT' : 'SHOTS') + ' BACK');
  }
  return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' AND ' + parts[parts.length - 1] : parts[0] || '';
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
// run: { cleared, rings, ringTotal, grazes, scrapes, deflects }; n = the level, in play order; g = its galaxy.
export function grade(run, n, g = 1) {
  let top = null;
  for (const q of GATES) if (!missing(run, q, n, g).length) top = q;
  const stars = top ? top.stars : 0, rank = top ? top.rank : '';
  // the next gate up: the next star, or DEGENERATE once all five are won
  const next = GATES.find((q) => q.stars > stars) || (rank !== 'DEGENERATE' ? GATES[GATES.length - 1] : null);
  let hint;
  if (!run.cleared) hint = 'MAKE IT TO THE END FOR YOUR FIRST ★';
  else if (!next) hint = degenerateLine(n, g);
  else if (next.rank === 'DEGENERATE') hint = 'ALL FIVE STARS. FOR DEGENERATE: ' + sayMissing(missing(run, next, n, g));
  else hint = sayMissing(missing(run, next, n, g)) + ' FOR ' + starText(next.stars);
  return { stars, rank, have: Array.from({ length: MAX_STARS }, (_, i) => i < stars), next: hint, nextGate: next };
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
  return Object.assign(L, { events, line, now, ringTotal, ringTotals, cacheTotal, powerups, sectionAt, spawnD: SPAWN_D, ease: easeOf(L.n, L.g || 1), fire: fireOf(L.n, L.g || 1) });
}
const MARKERS = new Set(['banner', 'end', 'boss', 'music', 'call']);
export function isNow(type) { if (MARKERS.has(type)) return true; const k = getKind(type); return !!(k && k.spawnAt === 'now'); }
export const isMarker = (type) => MARKERS.has(type);

// ---- progress. Key per level: 0.1.0's 'starwake.best.level1' ({score, rank}) is read as it was and extended.
// 0.4.0: galaxy 1 keeps its keys EXACTLY (nothing an existing player has moves or can be lost); galaxies 2 and 3 save
// under 'starwake.best.g2.level4' and so on.
const key = (a, b) => { const [g, n] = gn(a, b); return g === 1 ? 'starwake.best.level' + n : 'starwake.best.g' + g + '.level' + n; };
// the swaps: records are kept by place; move them so each follows its level, once per device. 'starwake.order' says
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
    const was = localStorage.getItem('starwake.order');
    if (was === ORDER) return;
    if (was !== '2') swapKeys(1, 2); // 11-05: Shattered Moon first, Nebula Run second
    swapKeys(5, 7);                  // 11-08: Neon Orbital fifth, Ion Storm seventh
    localStorage.setItem('starwake.order', ORDER);
  } catch (e) { /* storage blocked: nothing to move */ }
})();
// five stars (Evrtek 11-06): a record from the three-star game is moved over once per device. Its ring share was
// never kept, so the stars cannot be re-derived; they are mapped up so nobody sees fewer than they earned
// (1 -> 1, 2 -> 3, 3 -> 4), and the rank letter follows the new star count, as it does from now on.
export const STAR_MAP = { 0: 0, 1: 1, 2: 3, 3: 4 };
(function migrateStars() {
  try {
    if (localStorage.getItem('starwake.stars') === '5') return;
    for (const c of CATALOGUE) {
      const r = store(key(c.n)); if (!r) continue;
      const stars = STAR_MAP[r.stars | 0] ?? Math.min(MAX_STARS, r.stars | 0);
      store(key(c.n), Object.assign(r, { stars, rank: rankForStars(stars) }));
    }
    localStorage.setItem('starwake.stars', '5');
  } catch (e) { /* storage blocked: nothing to move */ }
})();
// the galaxies (0.4.0): a flag only. Galaxy 1's records are read where they always were and never rewritten; a player
// who already finished the Lattice Heart finds galaxy 2 open the moment they update (it is worked out, not stored).
(function migrateGalaxies() {
  try { if (localStorage.getItem('starwake.galaxies') !== '1') localStorage.setItem('starwake.galaxies', '1'); } catch (e) { /* storage blocked */ }
})();
const EMPTY = { score: 0, rank: '', stars: 0, cleared: false };
export const Progress = {
  // every call takes (g, n), or (n) alone for galaxy 1
  get(a, b) { return Object.assign({}, EMPTY, store(key(a, b)) || {}); },
  cleared(a, b) { return this.get(a, b).cleared; },
  // A galaxy opens when the one before it has its level 10 finished (a timed-out finale still finishes the level, so
  // nobody is walled off by one boss), and an opened galaxy stays open: any record in it keeps it open.
  galaxyOpen(g) {
    if (g === 1) return true;
    if (!galaxy(g)) return false;
    return this.cleared(g - 1, catalogueOf(g - 1).length) || catalogueOf(g).some((c) => { const r = this.get(g, c.n); return r.cleared || r.score > 0; });
  },
  // clearing N puts N on the select for replay and opens N+1; anything past that stays locked
  // a cleared level always stays replayable, even if the one before it is not cleared (the swap moved records)
  unlocked(a, b) { const [g, n] = gn(a, b); if (!this.galaxyOpen(g)) return false; return n === 1 || this.cleared(g, n) || this.cleared(g, n - 1); },
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
  tip(name) { return !!(store('starwake.tips') || {})[name]; },
  setTip(name, on = true) { const t = store('starwake.tips') || {}; if (on) t[name] = 1; else delete t[name]; store('starwake.tips', t); },
  // 0.4.0: the first-time tips (js/tutorials.js): every card this player has seen, by its id, kept beside the records
  seen(id) { return !!(store('starwake.seen') || {})[id]; },
  see(id) { const t = store('starwake.seen') || {}; t[id] = 1; store('starwake.seen', t); },
  // NEW GAME's erase: every record in all three galaxies, and the lessons and the tips come back too
  wipe() {
    const keys = GALAXIES.flatMap((x) => x.levels.map((c) => key(x.g, c.n))).concat(['starwake.tips', 'starwake.seen']);
    for (const k of keys) { try { localStorage.removeItem(k); } catch (e) { /* storage blocked */ } }
  },
};
