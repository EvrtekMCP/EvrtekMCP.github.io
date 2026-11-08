// GALAXY 2, LEVEL 1: TIDEWAY (THE VERDANT DEEP's opener; branch g2-a). The plan's 3.1.
// Headline (rule 20): space-currents carry the ship, so ride them. A current bends your path without your hands, and
// the rings are laid along the bent path (the current module's simulateDrift: the same sums the engine runs), so the
// first lesson is "let it carry you". New: the CURRENT (obstacles/g2-current) and the DRIFTER (enemies/g2-drifter).
// Re-uses rings, boost rings, pods, shrikes, a few seekers late, and coral heads as the rocks.
// Written in BARS of its take (g2/level1/music, 131.98 bpm, 1.818 s a bar; level1/clock.js), so the sections, the speed
// steps, the tide's turns and the Tide Race all sit on bar lines (rule 30): intro 1-8, groove 9-24, build one 25-32,
// drop one 33-48, breakdown 49-56, build two 57-64, drop two 65-80.
import { defineLevel, defineScenery } from '../../api.js?v=0.4.0';
import ring from '../../pickups/ring/index.js?v=0.4.0';
import boostRing from '../../pickups/boost-ring/index.js?v=0.4.0';
import pod from '../../enemies/pod/index.js?v=0.4.0';
import shrike from '../../enemies/shrike/index.js?v=0.4.0';
import seeker from '../../enemies/seeker-drone/index.js?v=0.4.0';
import { shieldCell } from '../../pickups/powerups/index.js?v=0.4.0';
import current, { simulateDrift } from '../../obstacles/g2-current/index.js?v=0.4.0';
import drifter from '../../enemies/g2-drifter/index.js?v=0.4.0';
import { coral, kelp, motes, reef, kelpBanks, plankton, shafts, reefArch, ARCH } from './level1/scenery.js?v=0.4.0';
import { musicTime, GRID } from './level1/clock.js?v=0.4.0';

// the speed steps on bar lines: 66 m/s on the opener, 146 in the Tide Race (the plan: 66 to 146)
const CLK = musicTime(Object.assign({ speeds: [[1, 66], [9, 74], [25, 84], [33, 96], [49, 90], [57, 104], [65, 122], [69, 134], [73, 146]] }, GRID[1]));
const B = CLK.barD;
const S1 = 0, S2 = Math.round(B(25)), S3 = Math.round(B(49)), S4 = Math.round(B(65)), END = Math.round(B(80.5));
ARCH.d = B(72);                                     // the Tide Race runs through the Reef Arch on bar 72
// the clock needs the api for its lean toward the music: a scenery def with no drawing binds it every frame
const clock = defineScenery({ name: 'g2-l1-clock', update(s, w, dt, api) { CLK.bind(api); } });

const SCN = { 'g2-l1-reef': 1, 'g2-l1-kelp-banks': 1, 'g2-l1-plankton': 1 };
export default defineLevel({
  g: 2, n: 1, id: 'tideway', name: 'TIDEWAY',
  idea: 'Space-currents carry the ship, so ride them.',
  seed: 20101,
  length: END,
  speed: CLK.speed,
  boostMul: 1.4,
  // style from its decent human bot (11-07: grazes and close calls 4-8, deflects 10-13 a run; little to scrape past in the
  // opener): A about a quarter, S 40 %, DEGENERATE 60 %, as galaxy 1's were sized
  // DEGENERATE (CLU-I2, the MCP 11-07): the decent bot ran 97-99% of the rings (the 95% gate is no guard here), so its deflects
  // must fall short: its best was 15; the good bot with power-ups off had 17 and 18
  style: { A: [1, 3], S: [2, 5], DEGENERATE: [2, 16] },                                    // the Tide Race's boost chains: the worst case for the warning check
  music: { track: GRID[1].track },
  sfx: [{ id: 'g2-current-in', gain: 0.5 }, { id: 'g2-tide-turn', gain: 0.6 }, { id: 'g2-sting', gain: 0.55 }, { id: 'g2-graft-crack', gain: 0.7 }],
  sections: [
    { id: 'shallows', name: 'THE SHALLOWS', sub: 'SECTOR 1', d0: S1, d1: S2, scenery: Object.assign({ 'g2-l1-shafts': 1 }, SCN) },
    { id: 'crossings', name: 'THE CROSSINGS', sub: 'SECTOR 2', d0: S2, d1: S3, scenery: Object.assign({}, SCN, { 'g2-l1-shafts': 0.7, 'g2-l1-plankton': 0.8 }) },
    { id: 'turn', name: 'THE TURN OF THE TIDE', sub: 'SECTOR 3', d0: S3, d1: S4, scenery: Object.assign({}, SCN, { 'g2-l1-kelp-banks': 1.3, 'g2-l1-reef': 0.7, 'g2-l1-shafts': 0.4 }) },
    { id: 'race', name: 'THE TIDE RACE', sub: 'FINAL STRETCH', d0: S4, d1: END, scenery: Object.assign({}, SCN, { 'g2-l1-kelp-banks': 0.6, 'g2-l1-reef': 0.8, 'g2-l1-shafts': 1, 'g2-l1-arch': 1 }) },
  ],
  // Yori's Tideway palette (g2/palettes.js 1): indigo sky, jade, kelp olive and bio-violet gas, sea-green fog, moon-green
  // key from above, a deep blue-green fill. Each sector leans one way: violet for the crossings, olive and dark for the
  // turn, bright jade for the race.
  looks: {
    shallows: { seed: 2011, sky: ['#070b18', 'rgba(42,154,106,A)', 'rgba(58,90,26,A)', 'rgba(90,58,160,A)'], fog: 0x0c2420, hemiSky: 0xe0ffe8, hemiGround: 0x1e3a4a, sun: 0xe0ffe8, sunDir: [0.2, 1, 0.3], sunPower: 2.4, hemiPower: 1.3, band: 0.5, gas: 0.75, cloud: 0x2a9a6a, clouds: 0.18, starGlow: 0.6, starTint: 0xd0ffe0 },
    crossings: { seed: 2012, sky: ['#080a1a', 'rgba(90,58,160,A)', 'rgba(42,154,106,A)', 'rgba(58,90,26,A)'], fog: 0x0e2026, hemiSky: 0xe0ffe8, hemiGround: 0x22304a, sun: 0xe0ffe8, sunDir: [0.3, 1, 0.2], sunPower: 2.2, hemiPower: 1.3, band: 0.48, gas: 0.85, cloud: 0x5a3aa0, clouds: 0.22, starGlow: 0.6, starTint: 0xd8e8ff },
    turn: { seed: 2013, sky: ['#060912', 'rgba(58,90,26,A)', 'rgba(30,58,74,A)', 'rgba(42,154,106,A)'], fog: 0x0a1c18, hemiSky: 0xc8e8d0, hemiGround: 0x1a2a2a, sun: 0xd0f0d8, sunDir: [-0.2, 1, 0.3], sunPower: 1.9, hemiPower: 1.1, band: 0.54, gas: 0.6, cloud: 0x3a5a1a, clouds: 0.12, starGlow: 0.45, starTint: 0xd0ffe0 },
    race: { seed: 2014, sky: ['#071020', 'rgba(60,190,130,A)', 'rgba(42,154,106,A)', 'rgba(90,58,160,A)'], fog: 0x0e2a22, hemiSky: 0xf0fff4, hemiGround: 0x1e3a4a, sun: 0xf0fff4, sunDir: [0.1, 1, 0.4], sunPower: 2.8, hemiPower: 1.4, band: 0.5, gas: 0.95, cloud: 0x2a9a6a, clouds: 0.26, starGlow: 0.7, starTint: 0xe0fff0 },
  },
  kinds: [ring, boostRing, pod, shrike, seeker, shieldCell, current, drifter, coral, kelp, motes],
  scenery: [reef, kelpBanks, plankton, shafts, reefArch, clock],
  beats: [
    { d: 0, tag: 'calm', what: 'rings in the open over the reef; the kelp stands straight' },
    { d: B(5), tag: 'calm', what: 'the first current, alone: do nothing and it carries you through its rings (the headline, taught safe)' },
    { d: B(10.5), tag: 'calm', what: 'a current across the top half, flowing back; the first drifter rides the bottom half, wide of the rings' },
    { d: B(17), tag: 'rising', what: 'the first lengthwise stream: ride it (speed, RIDE points); the first pod on the far bank' },
    { d: S2, tag: 'rising', what: 'the crossings: currents in turn, drifters riding them, pods on the far banks' },
    { d: B(33), tag: 'rising', what: 'drop one: a current up the box, the first shrike, coral heads in the stream' },
    { d: B(41), tag: 'peak', what: 'currents flipping left and right, shrikes and pods: the S of rings' },
    { d: S3, tag: 'calm', what: 'the breakdown: the turn of the tide. One current slows, stops and runs back; the kelp shows it first' },
    { d: B(57), tag: 'peak', what: 'build two: two turns back to back with drifters, pods and a seeker: the hardest stretch' },
    { d: B(63), tag: 'calm', what: 'slack water: a Shield Cell on the ring line into the race' },
    { d: S4, tag: 'rising', what: 'THE TIDE RACE: ride the stream, boost chains and a corkscrew through the Reef Arch, drifters in the eddies' },
  ],
  acts: { introduce: [S1, S2], develop: [S2, S3], twist: [S3, S4], master: [S4, END] },

  build(R, L) {
    const { add, ring: one, line, sine } = L;
    const CUR = [];
    let P = [0, -0.1];                               // where the last rings left the ship (normalised)
    const at = (b, x, y, type = 'ring', o = {}) => { one(B(b), x, y, type, o); P = [x, y]; };
    // n rings from P to `to`, the last on bar b, every `step` bars
    const go = (b, to, n = 4, step = 0.25) => { const p0 = P.slice(); for (let i = 1; i <= n; i++) { const k = i / n; at(b - (n - i) * step, p0[0] + (to[0] - p0[0]) * k, p0[1] + (to[1] - p0[1]) * k); } };
    // a cross current from bar b0 for `bars` bars; fx, fy in half-boxes a second
    const cur = (b0, bars, o) => { const d = B(b0); const ev = add(d, 'g2-current', Object.assign({ len: B(b0 + bars) - d, seed: Math.round(d) }, o)); CUR.push(ev); return ev; };
    // rings on the carried path from bar b0 to b1 (the ship's stick held where the last ring left it), every `step` bars
    const carried = (b0, b1, step = 0.25) => { const path = simulateDrift(CUR, CLK.baseSpeed, B(b0) - 1, B(b1) + 1, P); for (let b = b0; b <= b1 + 1e-6; b += step) { const [x, y] = path(B(b)); at(b, x, y); } };
    const ribbon = (b0, bars, path, o = {}) => { const d = B(b0); const len = B(b0 + bars) - d; return add(d, 'g2-current', Object.assign({ len, ride: true, w: 0.34, path: path.map(([bb, x, y]) => [B(b0 + bb) - d, x, y]), seed: Math.round(d) }, o)); };
    const drift = (b, nx, ny, s = 1, o = {}) => add(B(b), 'g2-drifter', Object.assign({ nx, ny, s }, o));
    const podAt = (b, nx, ny, o = {}) => add(B(b), 'pod', Object.assign({ nx, ny, drift: 0, bursts: 1, shots: 1 }, o));
    const shrikeAt = (b, side, ny, shots = 3) => add(B(b), 'shrike', { side, ny, shots });
    const seekerAt = (b, o) => add(B(b - 3.9 / CLK.barSec), 'seeker-drone', o);   // its first bolt lands near bar b
    const head = (b, nx, ny, r = 2.2) => add(B(b), 'g2-l1-coral', { nx, ny, r });
    let chainN = 0;
    const chain = (b, x0, y0, x1, y1, n = 4, step = 0.25) => { const id = 't' + (++chainN); for (let i = 0; i < n; i++) { const k = n > 1 ? i / (n - 1) : 0; one(B(b + i * step), x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, 'boost-ring', { chain: id, idx: i, of: n }); } P = [x1, y1]; };

    // ================= ACT 1, INTRODUCE: THE SHALLOWS (bars 1-24). The current alone, then a little more =================
    line(B(2), -0.5, -0.1, 0.5, -0.1, 5, 24); P = [0.5, -0.1];
    sine(B(3.4), 6, 26, 0.35, 0.28); P = [0, 0.28];
    go(4.75, [-0.45, -0.1], 2);
    add(B(4.5), 'call', { text: 'LET THE CURRENT CARRY YOU', cls: 'c-cyan' });
    cur(5, 3, { fx: 0.42 });                          // the first current: across the whole lane, to the right
    carried(5.25, 8.25);                              // ... and the rings it carries you through
    go(9.5, [0.35, 0.45], 4);
    cur(10.5, 3, { fx: -0.5, band: [0, 1.2] });       // the top half runs back
    cur(10.5, 3.5, { fx: 0.4, band: [-1.2, -0.02] }); // the bottom half runs on: the first drifter rides it
    drift(12.6, -1.15, -0.6, 1);
    carried(10.75, 13.5);
    go(15, [0, -0.2], 5);
    add(B(16.4), 'call', { text: 'RIDE THE STREAM: STAY INSIDE IT', cls: 'c-cyan' });
    ribbon(17, 3, [[0, 0, -0.2], [1.2, 0.3, 0.1], [2.2, -0.15, 0.3], [3, 0, 0.1]]);
    for (let b = 17.25; b <= 19.75; b += 0.25) { const u = (b - 17) / 3, x = u < 0.4 ? 0.3 * u / 0.4 : u < 0.73 ? 0.3 - 0.45 * (u - 0.4) / 0.33 : -0.15 + 0.15 * (u - 0.73) / 0.27, y = u < 0.4 ? -0.2 + 0.3 * u / 0.4 : u < 0.73 ? 0.1 + 0.2 * (u - 0.4) / 0.33 : 0.3 - 0.2 * (u - 0.73) / 0.27; at(b, x, y); }
    cur(20.5, 3, { fx: 0.45 });
    go(20.75, [-0.5, 0.2], 2);
    carried(21, 23.5);
    podAt(22.5, 0.75, 0.62);                          // the first pod: on the far bank, late in the act

    // ================= ACT 2, DEVELOP: THE CROSSINGS (bars 25-48). Currents in turn, drifters, pods =================
    // bar 25: the speed steps; nothing new for a bar (rule 6)
    go(26, [-0.55, 0], 4);
    cur(26.25, 3, { fx: 0.5 });
    drift(27.8, -1.2, 0.5, 1.1);                      // it rides the same water, above your rings
    carried(26.5, 29.25);
    podAt(29, -0.7, 0.6, { bursts: 2, shots: 2 });
    shrikeAt(31.25, -1, 0.45);
    cur(29.75, 3, { fx: -0.5, band: [-1.2, 0.05] });
    go(30.25, [0.45, -0.45], 2);
    carried(30.5, 32.75);
    // drop one (bar 33): the speed steps; the first current up the box, a shrike across it
    go(34, [-0.3, -0.6], 4);
    cur(34.25, 3, { fy: 0.42 });
    carried(34.5, 37);
    shrikeAt(35.5, 1, 0.55);
    cur(37.5, 3, { fx: 0.48 });
    go(37.75, [-0.55, 0.1], 2);
    drift(39, -1.3, -0.55, 0.9); drift(39.6, -1.35, 0.65, 0.8);
    head(39.2, 0.15, -0.6, 2.4);                      // a coral head in the stream, low; the rings stay above it
    carried(38, 40.5);
    podAt(40, 0.7, 0.65, { bursts: 2, shots: 2 }); podAt(37.5, -0.72, 0.62, { bursts: 2, shots: 1 });
    // the peak of the act: currents flipping either way, the rings an S between them, a shrike and pods
    cur(41.25, 1.75, { fx: -0.55 }); cur(43.25, 1.75, { fx: 0.55 }); cur(45.25, 1.75, { fx: -0.5 });
    go(41.25, [0.4, 0.15], 1);
    carried(41.5, 46.75);
    shrikeAt(42.5, -1, 0.5);
    podAt(44, -0.7, 0.7, { bursts: 2, shots: 2 }); podAt(46, 0.72, 0.62, { bursts: 2, shots: 2 });
    seekerAt(45.5, { nx: 0.45, ny: 0.66, shots: 2 });
    head(44.6, -0.55, -0.55, 2.2);
    go(48.5, [0, 0], 4);

    // ================= ACT 3, TWIST: THE TURN OF THE TIDE (bars 49-64) =================
    // the breakdown: one long current runs right, slows to slack water on bar 53, and runs back left; the kelp ahead
    // shows the turn long before you get there, and a sound marks it 1.5 s out
    go(49.75, [-0.6, -0.1], 3);
    const t1 = cur(50, 6.5, { fx: 0.5 }); t1.flip = { at: B(53) - t1.d, slack: 0.35 * (B(54) - B(53)), ramp: 0.8 * (B(54) - B(53)) };
    carried(50.25, 56.25);
    drift(52.5, -1.1, 0.55, 1.1);
    // build two: two turns back to back, faster, with drifters, pods and a seeker: the hardest stretch (rule 5)
    go(57.25, [0.55, 0.3], 2);
    const t2 = cur(57.5, 3.25, { fx: -0.55 }); t2.flip = { at: B(59) - t2.d, slack: 0.25 * (B(60) - B(59)), ramp: 0.6 * (B(60) - B(59)) };
    const t3 = cur(60.75, 2.5, { fx: 0.5, band: [-1.2, 0.1] }); t3.flip = { at: B(62) - t3.d, slack: 0.25 * (B(63) - B(62)), ramp: 0.5 * (B(63) - B(62)) };
    carried(57.75, 62.75);
    drift(58.4, 1.25, -0.55, 1); drift(60.2, -1.2, 0.6, 1.1);
    podAt(58.5, -0.72, 0.62, { bursts: 2, shots: 2 }); podAt(61.5, 0.72, 0.6, { bursts: 2, shots: 1 });
    seekerAt(61, { nx: 0.4, ny: 0.66, shots: 2 });
    shrikeAt(58.75, 1, 0.5);
    head(59.6, 0.6, 0.55, 2.2);
    // slack water: a Shield Cell on the ring line into the race (the plan: the calm after the tide turns)
    go(63.25, [0, -0.1], 2);
    add(B(63.75), 'shield-cell', { nx: 0, ny: -0.05 });
    at(64.25, 0, 0); at(64.5, 0, -0.05);

    // ================= ACT 4, MASTER: THE TIDE RACE (bars 65-80). Ride the stream through the Reef Arch =================
    // one long lengthwise stream; the rings ride it in boost chains and a corkscrew round its middle; drifters keep to the
    // eddies outside it; the arch on bar 72
    const RP = [[0, 0, -0.05], [2, 0.25, 0.1], [4, -0.2, 0.25], [6, 0, 0], [8, 0.3, -0.2], [10, -0.1, -0.1], [12, -0.3, 0.2], [14, 0, 0.1], [15.5, 0, 0]];
    ribbon(65, 15.5, RP, { w: 0.38, say: 'THE TIDE RACE: RIDE IT' });
    const rp = (b) => { const u = b - 65; for (let i = 1; i < RP.length; i++) if (u <= RP[i][0]) { const a = RP[i - 1], c = RP[i], t = (u - a[0]) / (c[0] - a[0]), s = t * t * (3 - 2 * t); return [a[1] + (c[1] - a[1]) * s, a[2] + (c[2] - a[2]) * s]; } return [0, 0]; };
    const along = (b0, b1, step = 0.25) => { for (let b = b0; b <= b1 + 1e-6; b += step) { const [x, y] = rp(b); at(b, x, y); } };
    along(65.25, 66.25);
    { const [x0, y0] = rp(66.75), [x1, y1] = rp(67.5); chain(66.75, x0, y0, x1, y1, 4); }   // boost into the race
    along(68.25, 69.5, 0.25);
    // the corkscrew through the arch (bar 72): round the stream's middle, a turn a bar
    for (let b = 70; b <= 73.75; b += 0.25) { const [x, y] = rp(b), a = (b - 70) * Math.PI * 2; at(b, x + Math.sin(a) * 0.22, y + Math.cos(a) * 0.18); }
    drift(70.5, -1.25, -0.55, 1.1, { drift: 0.06 }); drift(72.5, 1.25, 0.5, 1, { drift: -0.06 });
    seekerAt(73.5, { nx: 0.5, ny: 0.64, shots: 2 });
    { const [x0, y0] = rp(74.5), [x1, y1] = rp(75.25); chain(74.5, x0, y0, x1, y1, 4); }
    along(76, 77);
    seekerAt(77, { nx: -0.55, ny: 0.66, shots: 2 });
    drift(76.5, 1.3, -0.6, 1);
    { const [x0, y0] = rp(77.75), [x1, y1] = rp(78.5); chain(77.75, x0, y0, x1, y1, 4); }
    along(79, 80.25);
  },
});
