// LEVEL 3: THE GATEFIELD. Ancient ring-gates in a grid, and the music's beat moves them. Its one idea: the gates'
// fields open and close on the beat, then stop where you will pass. Everything is written in BARS of the level's
// track (level3/time.js turns bars into metres), so the gates, the speed steps, the arches and the Warden's entrance
// all land on bar lines (rule 30). The beat sheet and the four acts are below; the boss is THE WARDEN.
// 0.4.0, the ramp (Evrtek 11-07, the first outside playtester: level three "was deemed to be easy"; it must be harder
// than levels 1 and 2 and still a beginner level): five turrets in acts 2 and 3 (bars 26, 30, 44, 62, 69) fire a second
// volley three beats after the first, as bar 21's already did. Act 1's lessons, the gates, the Cascade and the Warden
// are as they were.
import { defineLevel } from '../api.js?v=0.6.4';
import ring from '../pickups/ring/index.js?v=0.6.4';
import gate from './level3/gate.js?v=0.6.4';
import gateTurret from '../enemies/gate-turret/index.js?v=0.6.4';
import { ringDecor, shard, gateRows, shards, horizon } from './level3/scenery.js?v=0.6.4';
import { barD as B, speed } from './level3/time.js?v=0.6.4';
import warden from '../bosses/warden/index.js?v=0.6.4';

const BOSS_AT = B(84.75);          // a beat before bar 85: the Warden's track cuts in on bar 85's line
const LENGTH = Math.round(BOSS_AT + 900);
const TAU = Math.PI * 2;

// Gate shapes. rot is in sectors; a sector's index runs anticlockwise from the boundary at rot.
const V2 = { n: 2, rot: 0.5 };     // 0 left, 1 right
const H2 = { n: 2, rot: 0 };       // 0 top, 1 bottom
const X4 = { n: 4, rot: 0.5 };     // the box's diagonals: 0 top, 1 left, 2 bottom, 3 right
const Q4 = { n: 4, rot: 0 };       // quadrants: 0 top-right, 1 top-left, 2 bottom-left, 3 bottom-right
const T3 = { n: 3, rot: 0.25 };    // 0 top, 1 lower left, 2 lower right
const S6 = { n: 6, rot: 0 };       // six wedges; 1 is the top one
// the middle of sector i, at normalised radius rho
const mid = (g, i, rho = 0.55) => { const a = (g.rot + i + 0.5) * TAU / g.n; return [Math.cos(a) * rho, Math.sin(a) * rho]; };

export default defineLevel({
  n: 3, id: 'gatefield', name: 'THE GATEFIELD',
  idea: 'The gates open on the beat: be where they stop.',
  // the ramp (11-07; the MCP's ruling (a), extended to this level by its word): the engine's STYLE[3] (A [3, 4], S [5, 6],
  // DEGENERATE [8, 10]) let the decent bot reach DEGENERATE on one seed of three at 96% of the rings. Sized from this level's own
  // bots (g1-ramp's final runs), the other builders' rule (A about a quarter of the decent bot's grazes and close calls and of
  // its deflects, S 40%): its runs had 17/19/22 and 46/48/48, so A asks 5 and 12, S 8 and 19. DEGENERATE asks 12 and 50:
  // past the decent bot's best deflects (48), so its 96% seed stays an S; the good bot with power-ups off had 15/16/17 and
  // 51/53/56, so all three of its seeds made it. (Its deflects count each bolt of a net sent home: FIRE[3] is one volley in
  // three as a seven-bolt net.) The ring gates are Evrtek's 30/60/80/90/95, untouched.
  style: { A: [5, 12], S: [8, 19], DEGENERATE: [12, 50] },
  seed: 303,
  length: LENGTH,
  speed,                            // 72 m/s, stepping on bar lines to 114 (level3/time.js)
  music: { track: 'levels/level3/music' },
  bossMusic: 'bosses/warden',
  sfx: [{ id: 'boss-warning', gain: 0.61 }, { id: 'boss-hit', gain: 1 }, { id: 'boss-phase', gain: 0.65 }, { id: 'boss-defeat', gain: 1 }],
  sections: [
    { id: 'outer', name: 'THE OUTER RINGS', sub: 'SECTOR 1', d0: 0, d1: B(25), scenery: { 'l3-gate-rows': 1, 'l3-shards': 0.6, 'l3-horizon': 1 } },
    { id: 'metronome', name: 'THE METRONOME', sub: 'SECTOR 2', d0: B(25), d1: B(49), scenery: { 'l3-gate-rows': 1, 'l3-shards': 1, 'l3-horizon': 1 } },
    { id: 'sleeping', name: 'THE SLEEPING GATE', sub: 'SECTOR 3', d0: B(49), d1: B(57), scenery: { 'l3-gate-rows': 0.5, 'l3-shards': 0.4, 'l3-horizon': 0.6 } },
    { id: 'turning', name: 'THE TURNING WAY', sub: 'SECTOR 4', d0: B(57), d1: B(73), scenery: { 'l3-gate-rows': 1, 'l3-shards': 1, 'l3-horizon': 1 } },
    { id: 'cascade', name: 'THE CASCADE', sub: 'SECTOR 5', d0: B(73), d1: B(81), scenery: { 'l3-gate-rows': 0.8, 'l3-shards': 0.5, 'l3-horizon': 1 } },
    { id: 'door', name: "THE WARDEN'S DOOR", sub: 'FINAL APPROACH', d0: B(81), d1: LENGTH, scenery: { 'l3-gate-rows': 0.7, 'l3-shards': 0.8, 'l3-horizon': 0.5 } },
  ],
  // Yori's palette (art-incoming/yori/levels/palettes.js, level 3): sky 061a22, gas 0f4a4a / 5a4a20 / 1a8a7a,
  // fog 0a2a30, key c8fff0, fill 3a5a2a, accent 9fffe0. Her teals are turned a touch greener (hue 170-175, away from
  // the cyan of your bolt) and her old gold a touch greyer (away from the rings' amber), so rule 9 holds by the numbers.
  looks: {
    outer: { sky: ['#061c1a', 'rgba(15,74,66,A)', 'rgba(90,78,52,A)', 'rgba(26,138,122,A)'], fog: 0x0a2a2c, hemiSky: 0xc8fff0, hemiGround: 0x3a5a2a, sun: 0xc8fff0, band: 0.5, gas: 0.7, cloud: 0x1a8a7a, clouds: 0.16, seed: 31 },
    metronome: { sky: ['#071d1a', 'rgba(26,138,122,A)', 'rgba(110,96,64,A)', 'rgba(15,74,66,A)'], fog: 0x0b2c2a, hemiSky: 0xd8fff2, hemiGround: 0x4a5a2a, sun: 0xe8fff4, band: 0.48, gas: 0.8, cloud: 0x2a7a64, clouds: 0.22, seed: 32 },
    sleeping: { sky: ['#041512', 'rgba(12,52,46,A)', 'rgba(60,54,38,A)', 'rgba(16,80,70,A)'], fog: 0x061c22, hemiSky: 0x90c8c0, hemiGround: 0x1a2a20, sun: 0xa8d8d0, band: 0.54, gas: 0.5, cloud: 0x10402e, clouds: 0.08, seed: 33 },
    turning: { sky: ['#061f1b', 'rgba(26,138,122,A)', 'rgba(15,74,66,A)', 'rgba(110,96,64,A)'], fog: 0x0a302c, hemiSky: 0xc8fff0, hemiGround: 0x3a5a2a, sun: 0xd0fff0, band: 0.46, gas: 0.85, cloud: 0x1a8a7a, clouds: 0.24, seed: 34 },
    cascade: { sky: ['#08221c', 'rgba(60,170,130,A)', 'rgba(26,138,122,A)', 'rgba(120,106,70,A)'], fog: 0x0c342e, hemiSky: 0xe0fff4, hemiGround: 0x4a6a30, sun: 0xffffff, band: 0.5, gas: 0.95, cloud: 0x3aa080, clouds: 0.26, seed: 35 },
    door: { sky: ['#051210', 'rgba(90,80,54,A)', 'rgba(15,60,52,A)', 'rgba(40,50,40,A)'], fog: 0x081a1c, hemiSky: 0xa0c8c0, hemiGround: 0x2a2a1a, sun: 0xc8e8e0, band: 0.52, gas: 0.6, cloud: 0x4a4434, clouds: 0.12, seed: 36 },
  },
  kinds: [ring, gate, gateTurret, ringDecor, shard],
  scenery: [gateRows, shards, horizon],
  boss: { at: BOSS_AT, def: warden, then: 'finish' },
  // rule 1: the beat sheet, in metres (written in bars: B(bar))
  beats: [
    { d: 0, tag: 'calm', what: 'rings in the open; sleeping gates beat their keystones with the kick' },
    { d: B(7), tag: 'rising', what: 'the first beat gate, alone: a half closed, flipping on the beat; rings show the open side' },
    { d: B(17), tag: 'rising', what: 'the first gate turret, alone, on a sleeping gate; its bolt only grazes if you do nothing' },
    { d: B(26), tag: 'rising', what: 'turrets ride the beat gates; quarters and thirds; the first double' },
    { d: B(33), tag: 'peak', what: 'drop one: doors, a six-way gate with two turrets (MULTI-DEFLECT), the first train' },
    { d: B(41), tag: 'calm', what: 'an arch on the downbeat; two bars of rings' },
    { d: B(43), tag: 'peak', what: 'the spiral train: four gates on the beat, the open pair turning' },
    { d: B(49), tag: 'calm', what: 'THE SLEEPING GATE: the kick stops, the gates sleep, the Great Gate on bar 53' },
    { d: B(57), tag: 'rising', what: 'the twist: turning gates that never lock; ride the gap (the Warden\'s sweep, taught)' },
    { d: B(66), tag: 'peak', what: 'turning and stepping gates together, turrets firing twice: the hardest stretch' },
    { d: B(71), tag: 'calm', what: 'two bars of open space before the set piece' },
    { d: B(73), tag: 'peak', what: 'THE CASCADE: sixteen gates on every other beat, a ring through each, round and back' },
    { d: B(81), tag: 'calm', what: "THE WARDEN'S DOOR: an arch on the downbeat; the Warden rises out of the haze" },
  ],
  // rule 19: the four acts
  acts: { introduce: [0, B(25)], develop: [B(25), B(57)], twist: [B(57), B(73)], master: [B(73), BOSS_AT] },

  // 0.4.0, the galaxy 1 retrofit (the plan's 6.5; nothing else in the level moves, no ring is added or moved):
  // THE GATEFIELD: Overclock 2 s before drop one's six-way gate with its two turrets; the Shield Cell in the calm before the Warden.
  powerups: [[4678, 'overclock', -0.51, -0.095], [12874, 'shield-cell', 0, 0.055]],
  build(R, L) {
    const { add, ring: one, line } = L;
    let P = [0, -0.3];                                  // where the guiding rings last left the ship
    // n rings from P to `to`, the last one at d (step metres apart)
    const go = (d, to, n = 4, step = 26) => { line(d - (n - 1) * step, P[0], P[1], to[0], to[1], n, step); P = to; };
    const g = (bar, shape, o, ringTo, n = 4) => {
      const d = B(bar);
      add(d, 'l3-gate', Object.assign({ n: shape.n, rot: shape.rot }, o));
      if (ringTo) go(d, ringTo, n);
      return d;
    };
    const turret = (bar, mount, volleys, shots = 1, o = {}) => add(B(bar), 'gate-turret', Object.assign({ gx: 0, gy: 0, mount, volleys, shots }, o));
    const sleep = (bar, o = {}) => add(B(bar), 'l3-gate', Object.assign({ n: 4, rot: 0.5, mode: 'sleep' }, o));
    const arch = (bar, s = 1.7) => add(B(bar), 'l3-ring', { x: 0, y: 0, s, arch: true, lit: 1, spin: 0 });

    // ================= ACT 1, INTRODUCE (bars 1-24): one gate at a time, every two bars =================
    line(B(1.25), 0, -0.3, 0, 0.15, 6, 24); P = [0, 0.15];
    sleep(3); go(B(3), [0.3, 0.1], 4, 30);
    sleep(5); go(B(5), [0.1, -0.1], 5, 30);
    add(B(5.75), 'call', { text: 'THROUGH THE OPEN SIDE', cls: 'c-cyan' });
    g(7, V2, { closed: [0], pattern: 'flip', hold: 4 }, mid(V2, 1, 0.5));        // the first: flips L/R, stops open right
    g(9, V2, { closed: [1], pattern: 'flip', hold: 4 }, mid(V2, 0, 0.5));
    g(11, H2, { closed: [1], hold: 4 }, mid(H2, 0, 0.5));                         // spins (a half-turn a beat), stops open top
    g(13, H2, { closed: [0], hold: 4 }, mid(H2, 1, 0.5));
    g(15, X4, { closed: [0, 1], hold: 4 }, mid(X4, 3));                           // quarters: bottom and right open
    sleep(17, { mount: -90 }); turret(17, -90, [8], 1, { miss: 1.3 });            // the first turret, alone; it grazes
    go(B(17) - 60, [0, -0.1], 5, 26);
    g(19, X4, { closed: [0, 1, 2], hold: 4 }, mid(X4, 3));                        // one quarter open
    sleep(21, { mount: 90 }); turret(21, 90, [9, 6], 2);
    go(B(21), [-0.2, 0.2], 4, 28);
    g(23, Q4, { closed: [0, 2], pattern: 'flip', hold: 4 }, mid(Q4, 1));          // diagonal quadrants

    // ================= ACT 2, DEVELOP (bars 25-48): turrets on the gates, doubles, trains =================
    // bar 25: the speed steps up; nothing new for a bar (rule 6)
    g(26, V2, { closed: [0], pattern: 'flip', hold: 3, mount: -90 }, mid(V2, 1, 0.5)); turret(26, -90, [8, 5], 1);
    g(28, X4, { closed: [1, 2, 3], hold: 3 }, mid(X4, 0));
    g(30, T3, { closed: [0, 2], hold: 3, mount: 90 }, mid(T3, 1)); turret(30, 90, [9, 6], 2);
    g(31, Q4, { closed: [1, 2, 3], hold: 3 }, mid(Q4, 0), 3);                     // the first double: a bar later
    g(32, H2, { closed: [1], hold: 3 }, mid(H2, 0, 0.5), 3);
    // drop one (bar 33): the speed steps; an arch on the downbeat, the gates a bar later
    arch(33);
    g(34, X4, { closed: [0, 2], pattern: 'flip', hold: 3 }, mid(X4, 1));          // doors: left and right, or top and bottom
    g(35, Q4, { closed: [1, 3], pattern: 'flip', hold: 3 }, mid(Q4, 2), 3);
    g(36, S6, { closed: [0, 2, 4], hold: 3, mount: 0 }, mid(S6, 1), 3); turret(36, 0, [9], 1); turret(36, 180, [9], 1); // two at once: MULTI-DEFLECT
    g(37, X4, { closed: [0, 1, 2], hold: 3 }, mid(X4, 3), 3);
    // the first train: three gates a half-bar apart, left-right-left on the beat
    g(38, V2, { closed: [0], pattern: 'flip', hold: 3 }, mid(V2, 1, 0.5), 3);
    g(38.5, V2, { closed: [1], pattern: 'flip', hold: 3 }); one(B(38.5), -0.5, 0); P = [-0.5, 0];
    g(39, V2, { closed: [0], pattern: 'flip', hold: 3 }); one(B(39), 0.5, 0); P = [0.5, 0];
    g(40, X4, { closed: [0, 2, 3], hold: 3, mount: -90 }, mid(X4, 1), 3); turret(40, -90, [9, 6], 2);
    // a breath: an arch and rings (rule 2)
    arch(41); go(B(42.5), [0, 0.2], 6, 30);
    g(43, T3, { closed: [1], hold: 3 }, mid(T3, 0), 3);
    g(44, Q4, { closed: [0, 2], pattern: 'flip', hold: 3, mount: 90 }, mid(Q4, 3), 3); turret(44, 90, [9, 6], 3);
    // the spiral train: the open pair turns a quarter every half-bar (right+top, top+left, left+bottom, bottom+right)
    [[1, 2], [2, 3], [3, 0], [0, 1]].forEach((cl, j) => { const bar = 45 + j * 0.5; g(bar, X4, { closed: cl, hold: 3 }); const m = mid(X4, j); one(B(bar), m[0], m[1]); P = m; });
    g(47, H2, { closed: [0], hold: 3, mount: 0 }, mid(H2, 1, 0.5), 3); turret(47, 0, [9], 1); turret(47, 180, [9], 1);
    go(B(48.75), [0, 0], 5, 30);

    // ================= THE SLEEPING GATE (bars 49-56): the kick stops and so do the gates =================
    sleep(50); for (let k = 0; k < 3; k++) L.sine(B(50 + k * 2) + 40, 8, 26, 0.5, 0.42, k);
    sleep(52); add(B(53), 'l3-ring', { x: 0, y: 0, s: 5, arch: true, lit: 1, spin: 1 });           // the Great Gate
    sleep(54); sleep(56);
    P = [0, 0.42];

    // ================= ACT 3, TWIST (bars 57-72): gates that turn and never lock =================
    g(58, X4, { closed: [0], mode: 'turn', step: 0.25, dir: 1 }, mid(X4, 2));     // the clock hand: one field sweeping round
    g(60, X4, { closed: [0, 2], mode: 'turn', step: 0.25, dir: -1 }, mid(X4, 3));  // the propeller
    g(62, T3, { closed: [0], mode: 'turn', step: 0.25, dir: 1, mount: -90 }, mid(T3, 1)); turret(62, -90, [9, 6], 2);
    g(63, Q4, { closed: [0, 1, 2], hold: 3 }, mid(Q4, 3), 3);                      // a locking gate between, for contrast
    g(64, V2, { closed: [1], mode: 'turn', step: 0.125, dir: 1 }, mid(V2, 0, 0.5), 3);
    // drop two (bar 65): the speed steps; an arch, then the hardest stretch
    arch(65);
    g(66, X4, { closed: [1, 3], mode: 'turn', step: 0.25, dir: 1, mount: 0 }, mid(X4, 0)); turret(66, 0, [10], 1); turret(66, 180, [10], 1);
    g(67, X4, { closed: [0, 1, 3], hold: 3 }, mid(X4, 2), 3);
    g(68, S6, { closed: [0, 2, 4], mode: 'turn', step: 0.25, dir: -1 }, mid(S6, 3), 3);
    g(69, V2, { closed: [0], pattern: 'flip', hold: 3, mount: 90 }, mid(V2, 1, 0.5), 3); turret(69, 90, [9, 6], 3);
    g(70, X4, { closed: [0, 1], mode: 'turn', step: 0.25, dir: 1 }, mid(X4, 2), 3);
    go(B(72.5), [0, 0.5], 6, 30);                                                  // two bars of open space (rule 3)

    // ================= ACT 4, MASTER (bars 73-80): THE CASCADE =================
    // sixteen gates a half-bar apart, two quarters open each; the open pair walks round the box a quarter a gate,
    // anticlockwise for two laps' worth, then back. A ring sits in the quarter the next gate shares.
    const path = []; for (let j = 0; j < 17; j++) path.push(j < 8 ? j % 4 : ((8 - (j - 8)) % 4 + 4) % 4);
    for (let j = 0; j < 16; j++) {
      const bar = 73 + j * 0.5, open = [path[j], path[j + 1]];
      const closed = [0, 1, 2, 3].filter((i) => !open.includes(i));
      g(bar, X4, { closed, hold: 3, set: 'cascade', setN: 16, setI: j });
      const m = mid(X4, path[j + 1], 0.55); one(B(bar), m[0], m[1]); P = m;
    }
    // ================= THE WARDEN'S DOOR (bar 81): an arch, rings, and the boss =================
    arch(81, 2.1);
    go(B(82.5), [0, 0], 6, 30);
    line(B(83), 0, 0, 0, 0.1, 5, 30);
  },
});
