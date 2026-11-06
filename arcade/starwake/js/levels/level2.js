// LEVEL 2: SHATTERED MOON. The proof of the framework (CLU A), to the ten-level plan and Yori's look sheet.
// Headline (rule 20): chain the boost rings to fire a speed burst. Supporting: boulders that tumble across the
// lane (its new obstacle) and strafers in pairs (level 1's strafer, two at once). Set piece: the canyon dash
// through the moon's core, where the crack slabs close in to walls.
// Authored in MUSIC TIME (rule 30): the sections and the peak sit on bar lines of the level's track (138 bpm,
// 1.739 s a bar), converted to metres through the speed curve at base speed.
import { defineLevel, clamp, ranksFrom } from '../api.js?v=0.2.0';
import ring from '../pickups/ring/index.js?v=0.2.0';
import boostRing from '../pickups/boost-ring/index.js?v=0.2.0';
import boulder from '../obstacles/boulder/index.js?v=0.2.0';
import pod from '../enemies/pod/index.js?v=0.2.0';
import shrike from '../enemies/shrike/index.js?v=0.2.0';
import { chunk, slab, dust, chunks, slabs, canyon, dustRivers, brokenMoon, sunShafts } from './level2/scenery.js?v=0.2.0';

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
  seed: 2002,
  length: LEN,
  speed,
  boostMul: 1.4, // the worst case for the warning check: GREED and a boost together
  music: { track: 'levels/level2/music' },
  // as the OPENER (Evrtek's swap, 11-05: "keep level 1's thresholds forgiving"): 0.85 of a real run's total
  // (460k: 164 of 187 rings, 3 hits), so A and its second star come within a newcomer's reach
  ranks: ranksFrom(390000),
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
  kinds: [ring, boostRing, boulder, pod, shrike, chunk, slab, dust],
  scenery: [brokenMoon, chunks, slabs, canyon, dustRivers, sunShafts],
  beats: [
    { d: 0, tag: 'calm', what: 'the moon breaks open ahead; rings in the open' },
    { d: D(9), tag: 'calm', what: 'the first boost chain, alone, nothing near it (the headline, taught safe)' },
    { d: D(22), tag: 'rising', what: 'the first boulder, alone and slow, crossing wide of the rings' },
    { d: S2, tag: 'rising', what: 'the dust rivers: chains and boulders together; the first pod' },
    { d: bar(33), tag: 'rising', what: 'drop one: the first strafer PAIR, crossing from both sides' },
    { d: S3, tag: 'calm', what: 'the breakdown: the sunlit cracks, chains threading between slabs' },
    { d: bar(57), tag: 'rising', what: 'build two: a boost chain that ends in a boulder volley (the twist)' },
    { d: bar(61), tag: 'peak', what: 'boost into the boulder lanes, pairs and pods together' },
    { d: bar(70), tag: 'calm', what: 'a breather: rings only, the canyon ahead' },
    { d: S4 + 400, tag: 'rising', what: 'the core dash: the walls close in, a long boost chain at full speed' },
  ],
  acts: { introduce: [S1, S2], develop: [S2, S3], twist: [S3, S4], master: [S4, LEN] },
  build(R, L) {
    const { add, ring, line, sine } = L;
    let chainN = 0;
    // a boost chain of n rings from (x0, y0) to (x1, y1), step metres apart
    const chain = (d, x0, y0, x1, y1, n = 4, step = 34) => { const id = 'c' + (++chainN); return line(d, x0, y0, x1, y1, n, step, 'boost-ring', (i, k) => ({ chain: id, idx: i, of: k })); };
    const rock = (d, from, cross, ny, r = 2.6, span = 320) => add(d, 'boulder', { from, cross, ny, r, span, variant: R.int(0, 2) });
    const pair = (d, ny = 0.5) => { add(d, 'shrike', { side: 1, ny, shots: 3 }); add(d, 'shrike', { side: -1, ny: -ny * 0.8, shots: 3 }); };

    // ---- SECTOR 1, THE BREAKING (introduce): open slow; the headline alone; then the boulder alone
    {
      line(D(2.5), -0.5, 0, 0.5, 0);
      sine(D(5.5), 6, 24, 0.4, 0.35);
      add(D(7), 'call', { text: 'FLY THE AMBER CHAIN: BOOST!', cls: '' }); // the opener teaches (Evrtek's swap, 11-05)
      chain(D(9), 0, -0.2, 0, 0.3, 4, 34);                 // the first chain: straight down the middle, nothing else
      line(D(14), 0.6, 0.4, -0.6, 0.4);
      chain(D(18), -0.6, 0, 0.6, 0, 4, 34);
      rock(D(22), 1, 0.85, -0.3, 2.4, 380);                // alone and slow, crossing at the edge; rings sit opposite
      line(D(21.4), -0.6, 0.2, -0.5, -0.2, 4, 22);
      sine(D(26), 8, 24, 0.55, 0.45);
      chain(D(31), 0.5, 0.5, -0.5, -0.4, 5, 32);
      add(D(30.5), 'call', { text: 'ROLL INTO ITS FIRE TO SEND IT HOME', cls: 'c-cyan' });
      add(D(33), 'pod', { nx: -0.5, ny: 0.6, drift: 1, bursts: 1, shots: 1 });
      rock(D(37), -1, -0.2, 0.4, 2.8, 340);
      line(D(36.5), 0.6, -0.4, 0.4, 0.3, 4, 22);
    }
    // ---- SECTOR 2, THE DUST RIVERS (develop): chains and boulders together, pods, then strafers in pairs
    {
      let t = (S2 ? 43 : 43);
      while (t < 82) {
        const k = R.int(0, 2);
        if (k === 0) { const y = R.range(-0.5, 0.5); chain(D(t), R.range(-0.7, -0.2), y, R.range(0.2, 0.7), -y, 4, 34); rock(D(t + 5), R.sign(), R.range(-0.7, 0.7), R.range(-0.6, 0.6), R.range(2.2, 3.2)); }
        else if (k === 1) { sine(D(t), 6, 24, R.range(0.35, 0.6), R.range(0.3, 0.5), R() * 6); rock(D(t + 3), R.sign(), R.range(-0.5, 0.5), R.range(-0.5, 0.5), R.range(2.4, 3.4)); }
        else { line(D(t), R.range(-0.7, 0.7), R.range(-0.6, 0.6), R.range(-0.7, 0.7), R.range(-0.6, 0.6)); add(D(t + 2.5), 'pod', { nx: R.range(-0.7, 0.7), ny: R.range(0.2, 0.8), drift: R.range(-2, 2), bursts: 2, shots: 2 }); }
        t += R.range(5, 7);
      }
      // as the opener (the swap), the first strafers come one at a time; the pairs wait for the twist
      add(bar(33), 'shrike', { side: 1, ny: 0.5, shots: 3 });
      add(bar(41), 'shrike', { side: -1, ny: 0.3, shots: 3 });
      add(bar(37), 'pod', { nx: 0.6, ny: 0.7, drift: -1.5, bursts: 2, shots: 2 });
    }
    // ---- SECTOR 3, THE SUNLIT CRACKS (twist): a breather in the breakdown, then a chain's burst carries you into
    //      a boulder volley: speed is the reward and the risk. The peak sits on drop two, about two thirds in.
    {
      let t = 85;
      while (t < 97) { sine(D(t), 6, 26, 0.45, 0.4, R() * 6); t += 4.5; }
      t = 98;
      while (t < 120) {
        const y = R.range(-0.4, 0.4);
        chain(D(t), -0.6, y, 0.6, y, 4, 36);
        // the volley lands where the burst takes you: two boulders from opposite sides, a gap to aim for
        const gap = R.range(-0.5, 0.5);
        rock(D(t + 3.2), 1, gap + 0.55, R.range(-0.4, 0.4), R.range(2.4, 3.2), 300);
        rock(D(t + 3.9), -1, gap - 0.55, R.range(-0.4, 0.4), R.range(2.4, 3.2), 300);
        ring(D(t + 4.6), gap, 0); ring(D(t + 4.9), gap, 0.1);
        if (t > 104 && t < 116) add(D(t + 2), 'pod', { nx: R.range(-0.7, 0.7), ny: R.range(0.3, 0.8), drift: R.range(-2, 2), bursts: 2, shots: 3 });
        t += R.range(5.2, 6.4);
      }
      pair(bar(61), 0.6); pair(bar(66), -0.4);
      line(bar(70), -0.5, 0, 0.5, 0); line(bar(71), 0.5, 0.3, -0.5, 0.3);
    }
    // ---- SECTOR 4, THE CORE DASH (master, the set piece): a calm lead-in, then the walls close in and the
    //      longest chains at full speed, boulders rolling through; spectacle more than difficulty (rule 5)
    {
      let t = 128;
      sine(D(126), 8, 26, 0.4, 0.35);
      while (D(t) < LEN - 500) {
        chain(D(t), R.range(-0.6, 0.6), R.range(-0.4, 0.4), R.range(-0.6, 0.6), R.range(-0.4, 0.4), 6, 36);
        if (R() < 0.7) rock(D(t + 3.5), R.sign(), R.range(-0.6, 0.6), R.range(-0.5, 0.5), R.range(2.6, 3.6), 280);
        sine(D(t + 4.2), 6, 30, 0.5, 0.4, R() * 6);
        t += 7;
      }
    }
  },
});
