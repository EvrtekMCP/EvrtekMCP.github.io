// LEVEL 2: SHATTERED MOON. The proof of the framework (CLU A), to the ten-level plan and Yori's look sheet.
// Headline (rule 20): chain the boost rings to fire a speed burst. Supporting: boulders that tumble across the
// lane (its new obstacle). Set piece: the canyon dash through the moon's core, where the crack slabs close in to walls.
// 0.4.0, the ramp (Evrtek 11-07, the first outside playtester: "level one should really not have much in the way of
// enemies. It should be more about learning the flight control"): played FIRST, so it is FLIGHT SCHOOL. Steering, the
// rings, the chain and the roll, each taught alone with a short call; three enemies after the roll lesson (one pod, two
// lone strafers, two shots each at most); fewer, smaller, slower boulders and a wider gap in the twist's volleys.
// The sections, the bar lines, the speed, the Shield Cell and its ring line are where they were.
// Authored in MUSIC TIME (rule 30): the sections and the peak sit on bar lines of the level's track (138 bpm,
// 1.739 s a bar), converted to metres through the speed curve at base speed.
import { defineLevel, clamp } from '../api.js?v=0.4.1';
import ring from '../pickups/ring/index.js?v=0.4.1';
import boostRing from '../pickups/boost-ring/index.js?v=0.4.1';
import boulder from '../obstacles/boulder/index.js?v=0.4.1';
import pod from '../enemies/pod/index.js?v=0.4.1';
import shrike from '../enemies/shrike/index.js?v=0.4.1';
import { chunk, slab, dust, chunks, slabs, canyon, dustRivers, brokenMoon, sunShafts } from './level2/scenery.js?v=0.4.1';
import { tutorPod } from './level2/tutor.js?v=0.4.1';

const LEN = 16400, V0 = 64, V1 = 150;
const speed = (d) => V0 + (V1 - V0) * Math.pow(clamp(d / LEN, 0, 1), 0.85);
// music time to course distance at base speed (GREED and boosts arrive early; a fair trade for a faster run)
const BAR = 1.73916, FIRST = 0.2049;
const D = (() => { const tab = [0]; let d = 0; for (let t = 0; t < 400; t += 0.05) { d += speed(d) * 0.05; tab.push(d); } return (t) => tab[Math.min(tab.length - 1, Math.round(t / 0.05))]; })();
const bar = (n) => D(FIRST + (n - 1) * BAR); // the start of bar n (1-based)

const S1 = 0, S2 = Math.round(bar(25)), S3 = Math.round(bar(49)), S4 = Math.round(bar(73));
export default defineLevel({
  n: 1, id: 'moon', name: 'SHATTERED MOON', // played FIRST since Evrtek's swap (11-05); its file stays level2.js
  idea: 'Chain the boost rings to fire a speed burst.',
  // the ramp (11-07; the MCP's ruling (a)): flight school has almost nothing to graze or send back (three enemies, five
  // shots), so the engine's STYLE[1] (A [3, 2], S [5, 3], DEGENERATE [8, 5], sized on 0.3.0's busier level) left a decent
  // player on three stars at 96% of the rings. Sized from this level's own bots, the other builders' rule (A about a quarter
  // of the decent bot's grazes and close calls and of its deflects, S 40%, DEGENERATE 60%): its three runs had 3/3/3 and
  // 0/1/1, so A and S ask one close call and no deflect (a decent player reaches five stars on the rings alone; the MCP:
  // "a welcoming first level"). DEGENERATE asks 2 and 3: the ring share (96-97% for the decent bot) is past 95%, so style
  // is its only guard, and three deflects is two past the decent bot's best; the good bot with power-ups off reached
  // 2/2, 3/2 and 2/3, so one of its three seeds made it. The ring gates are Evrtek's 30/60/80/90/95, untouched.
  style: { A: [1, 0], S: [1, 0], DEGENERATE: [2, 3] },
  seed: 2002,
  length: LEN,
  speed,
  boostMul: 1.4, // the worst case for the warning check: GREED and a boost together
  music: { track: 'levels/level2/music' },
  sections: [
    { id: 'breaking', name: 'THE BREAKING', sub: 'SECTOR 1', d0: S1, d1: S2, scenery: { 'l2-moon': 1, 'l2-chunks': 1, 'l2-slabs': 0.3 } },
    { id: 'dust', name: 'THE DUST RIVERS', sub: 'SECTOR 2', d0: S2, d1: S3, scenery: { 'l2-moon': 1, 'l2-chunks': 0.8, 'l2-dust-rivers': 1, 'l2-slabs': 0.3 } },
    { id: 'cracks', name: 'THE SUNLIT CRACKS', sub: 'SECTOR 3', d0: S3, d1: S4, scenery: { 'l2-moon': 0.6, 'l2-chunks': 0.6, 'l2-slabs': 1, 'l2-shafts': 1, 'l2-dust-rivers': 0.5 } },
    { id: 'core', name: 'THE CORE DASH', sub: 'FINAL STRETCH', d0: S4, d1: LEN, scenery: { 'l2-canyon': 1, 'l2-shafts': (t) => 1 - t, 'l2-chunks': 0.3 } },
  ],
  // Yori's palette (levels/palettes.js, level 2): brown-grey rock, one warm sun edge, a cold blue fill
  looks: {
    breaking: { seed: 201, sky: ['#0e0c10', 'rgba(106,74,42,A)', 'rgba(58,30,22,A)', 'rgba(216,184,144,A)'], fog: 0x2a1e14, hemiSky: 0x2a3a6a, hemiGround: 0x1a1210, sun: 0xffd8a0, sunDir: [0.8, 0.9, 0.35], sunPower: 2.8, hemiPower: 1.2, band: 0.52, gas: 0.6, cloud: 0x6a4a2a, clouds: 0.1 },
    dust: { seed: 202, sky: ['#100c0c', 'rgba(130,96,60,A)', 'rgba(58,30,22,A)', 'rgba(216,184,144,A)'], fog: 0x30221a, hemiSky: 0x2a3a6a, hemiGround: 0x22160e, sun: 0xffd8a0, sunDir: [0.8, 0.9, 0.35], sunPower: 2.6, hemiPower: 1.2, band: 0.5, gas: 0.85, cloud: 0x8a6a48, clouds: 0.22 },
    cracks: { seed: 203, sky: ['#0a080c', 'rgba(90,62,40,A)', 'rgba(42,58,106,A)', 'rgba(216,184,144,A)'], fog: 0x1e140e, hemiSky: 0x2a3a6a, hemiGround: 0x120c08, sun: 0xffe0b0, sunDir: [0.9, 0.7, 0.2], sunPower: 3.2, hemiPower: 1.0, band: 0.55, gas: 0.5, cloud: 0x4a3a30, clouds: 0.08 },
    core: { seed: 204, sky: ['#08070c', 'rgba(42,58,106,A)', 'rgba(58,30,22,A)', 'rgba(216,160,112,A)'], fog: 0x14100e, hemiSky: 0x34488a, hemiGround: 0x0e0a08, sun: 0xffc890, sunDir: [0.5, 1, 0.1], sunPower: 2.4, hemiPower: 1.4, band: 0.5, gas: 0.55, cloud: 0x2a3a6a, clouds: 0.12 },
  },
  kinds: [ring, boostRing, boulder, pod, shrike, chunk, slab, dust, tutorPod],
  scenery: [brokenMoon, chunks, slabs, canyon, dustRivers, sunShafts],
  beats: [
    { d: 0, tag: 'calm', what: 'the moon breaks open ahead; rings in the open: FOLLOW THE RINGS (steering, alone)' },
    { d: D(9), tag: 'calm', what: 'the first boost chain, alone, nothing near it (the headline, taught safe)' },
    { d: D(15.2), tag: 'calm', what: 'the roll lesson (once, until the player has sent a shot back)' },
    { d: D(22), tag: 'rising', what: 'the first boulder, alone and slow, crossing wide of the rings: STEER AROUND THE ROCK' },
    { d: D(33), tag: 'rising', what: 'one pod, one slow shot: the roll, practised' },
    { d: S2, tag: 'rising', what: 'the dust rivers: chains, sines and the odd boulder; no shooting for a while' },
    { d: bar(41), tag: 'rising', what: 'the first strafer, alone, two shots' },
    { d: S3, tag: 'calm', what: 'the breakdown: the sunlit cracks, chains threading between slabs' },
    { d: bar(57), tag: 'rising', what: 'build two: a boost chain that ends in a boulder volley, a wide gap to aim for (the twist)' },
    { d: bar(61), tag: 'peak', what: 'boost into the boulder lanes; one strafer crosses' },
    { d: bar(70), tag: 'calm', what: 'a breather: rings only, the canyon ahead' },
    { d: S4 + 400, tag: 'rising', what: 'the core dash: the walls close in, long boost chains at full speed, a boulder now and then' },
  ],
  acts: { introduce: [S1, S2], develop: [S2, S3], twist: [S3, S4], master: [S4, LEN] },
  // 0.4.0, the galaxy 1 retrofit (the plan's 6.5; nothing else in the level moves, no ring is added or moved):
  // SHATTERED MOON: the Shield Cell lesson, alone and named, on the ring line out of the Sunlit Cracks into the Core Dash.
  powerups: [[11645, 'shield-cell', 0.125, 0.3]],
  build(R, L) {
    const { add, ring, line, sine } = L;
    let chainN = 0;
    // a boost chain of n rings from (x0, y0) to (x1, y1), step metres apart
    const chain = (d, x0, y0, x1, y1, n = 4, step = 34) => { const id = 'c' + (++chainN); return line(d, x0, y0, x1, y1, n, step, 'boost-ring', (i, k) => ({ chain: id, idx: i, of: k })); };
    const rock = (d, from, cross, ny, r = 2.6, span = 320) => add(d, 'boulder', { from, cross, ny, r, span, variant: R.int(0, 2) });
    // ---- SECTOR 1, THE BREAKING (introduce): open slow; steering alone; the headline alone; the roll lesson; then
    //      the boulder alone, and one slow shot to roll
    {
      line(D(2.5), -0.5, 0, 0.5, 0);
      add(D(4.2), 'call', { text: 'FOLLOW THE RINGS', cls: '' }); // the ramp (11-07): steering first, alone; after the banner
      sine(D(5.5), 6, 24, 0.4, 0.35);
      add(D(7), 'call', { text: 'FLY THE AMBER CHAIN: BOOST!', cls: '' }); // the opener teaches (Evrtek's swap, 11-05)
      chain(D(9), 0, -0.2, 0, 0.3, 4, 34);                 // the first chain: straight down the middle, nothing else
      line(D(14), 0.6, 0.4, -0.6, 0.4);
      // the roll lesson (0.3.0, Evrtek 11-06): its pod, low and left, clear of the rings; asks for the lesson about 12 s
      // in, after the first chain. Only there until the player has sent a shot back once (main.js, the roll lesson).
      add(D(15.2), 'l2-tutor-pod', { nx: -0.35, ny: -0.5 });
      chain(D(18), -0.6, 0, 0.6, 0, 4, 34);
      add(D(20.4), 'call', { text: 'STEER AROUND THE ROCK', cls: '' });
      rock(D(22), 1, 0.85, -0.3, 2.4, 380);                // alone and slow, crossing at the edge; rings sit opposite
      line(D(21.4), -0.6, 0.2, -0.5, -0.2, 4, 22);
      sine(D(26), 8, 28, 0.45, 0.38);                      // 0.3.0: a turn the ship can follow (was 24 m apart, 0.55 x 0.45)
      chain(D(31), 0.5, 0.5, -0.5, -0.4, 5, 32);
      add(D(30.5), 'call', { text: 'ROLL INTO ITS FIRE', cls: 'c-cyan' }); // short enough to read in the call's moment
      add(D(33), 'pod', { nx: -0.5, ny: 0.6, drift: 1, bursts: 1, shots: 1 });
      rock(D(37), -1, -0.2, 0.4, 2.4, 400);                // the ramp: smaller and slower (was 2.8, 340)
      line(D(36.5), 0.6, -0.4, 0.4, 0.3, 4, 22);
    }
    // ---- SECTOR 2, THE DUST RIVERS (develop): chains, sines and the odd boulder; one strafer, alone
    //      (the ramp: no pods here, a boulder only after a chain, smaller and slower; was a boulder after every chain
    //      and sine, a pod after every line, two strafers and a pod)
    {
      let t = 43;
      while (t < 82) {
        const k = R.int(0, 2);
        if (k === 0) { const y = R.range(-0.5, 0.5); chain(D(t), R.range(-0.7, -0.2), y, R.range(0.2, 0.7), -y, 4, 34); rock(D(t + 5), R.sign(), R.range(-0.6, 0.6), R.range(-0.5, 0.5), R.range(2.2, 2.8), 380); }
        else if (k === 1) sine(D(t), 6, 32, R.range(0.3, 0.45), R.range(0.25, 0.38), R() * 6);
        else line(D(t), R.range(-0.7, 0.7), R.range(-0.6, 0.6), R.range(-0.7, 0.7), R.range(-0.6, 0.6));
        t += R.range(5, 7);
      }
      add(bar(41), 'shrike', { side: -1, ny: 0.3, shots: 2 }); // the first strafer, alone (the side arrow warns it)
    }
    // ---- SECTOR 3, THE SUNLIT CRACKS (twist): a breather in the breakdown, then a chain's burst carries you into
    //      a boulder volley: speed is the reward and the risk. The peak sits on drop two, about two thirds in.
    //      (the ramp: the gap between a volley's boulders is wider, the boulders smaller, the volleys further apart;
    //      no pods, and one strafer where two pairs were)
    {
      let t = 85;
      while (t < 97) { sine(D(t), 6, 36, 0.32, 0.28, R() * 6); t += 4.5; } // 0.3.0: was 26 m apart, 0.45 x 0.4
      t = 98;
      add(D(97.2), 'call', { text: 'BOOST, THEN FIND THE GAP', cls: '' });
      while (t < 115.5) { // the last volley ends where 0.4.0's did (its rings by 11.4 km): bar 70's breather and the Shield Cell's ring line stay clear
        const y = R.range(-0.4, 0.4);
        chain(D(t), -0.6, y, 0.6, y, 4, 36);
        // the volley lands where the burst takes you: two boulders from opposite sides, a gap to aim for
        const gap = R.range(-0.4, 0.4);
        rock(D(t + 3.2), 1, gap + 0.75, R.range(-0.4, 0.4), R.range(2.2, 2.8), 340);
        rock(D(t + 3.9), -1, gap - 0.75, R.range(-0.4, 0.4), R.range(2.2, 2.8), 340);
        ring(D(t + 4.6), gap, 0); ring(D(t + 4.9), gap, 0.1);
        t += R.range(6.2, 7.2);
      }
      add(bar(61), 'shrike', { side: 1, ny: 0.6, shots: 2 });
      line(bar(70), -0.5, 0, 0.5, 0); line(bar(71), 0.5, 0.3, -0.5, 0.3);
    }
    // ---- SECTOR 4, THE CORE DASH (master, the set piece): a calm lead-in, then the walls close in and the
    //      longest chains at full speed, a boulder now and then; spectacle more than difficulty (rule 5)
    //      (the ramp: a boulder after one chain in three, smaller; was seven in ten)
    {
      let t = 128;
      sine(D(126), 8, 36, 0.3, 0.26);                     // 0.3.0: was 26 m apart, 0.4 x 0.35
      while (D(t) < LEN - 500) {
        chain(D(t), R.range(-0.6, 0.6), R.range(-0.4, 0.4), R.range(-0.6, 0.6), R.range(-0.4, 0.4), 6, 36);
        if (R() < 0.33) rock(D(t + 3.5), R.sign(), R.range(-0.6, 0.6), R.range(-0.5, 0.5), R.range(2.4, 3.0), 320);
        // 0.3.0: flown under a boost (x1.4), so eight rings 46 m apart (was six, 30 m apart, 0.5 x 0.4)
        sine(D(t + 4.2), 8, 46, 0.3, 0.24, R() * 6);
        t += 7;
      }
    }
  },
});
