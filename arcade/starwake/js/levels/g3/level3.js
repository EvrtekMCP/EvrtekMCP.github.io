// GALAXY 3, LEVEL 3: THE LOCKWORKS, boss THE FOREMAN (the plan's 4.3). Industrial bulkheads, hot copper, sealed gates
// with red keystones, and the Foreman's crane over everything from the start. Its one idea: send their fire into the
// locks to open the way. The new obstacle is the LOCKGATE and its BYPASS (js/obstacles/g3-lockgate): a turret on the
// gate fires at you; roll its bolt home and it flies to the KEYSTONE, the doors burst open (KEYED!) and the rings
// behind them are yours (they count, and they are what ★4 and ★5 ask for here: the MCP's default 4). Miss, and the way
// is the tight duct at the edge: CLOSE calls and a few cache rings, never a wall.
// Re-used: blueprint walls (level 1), shuttlers (level 2: keyed weaves), pods, seekers, swarms.
// Written in BARS of its track (g3/level3/music, 144 bpm, industrial techno, big metallic hits on the one).
//   Act 1 INTRODUCE  bars 1-16   one gate with a slow turret: its first volley goes wide (watch it miss), then it aims
//   Act 2 DEVELOP    bars 17-48  gates in a row, and keyed weaves (a shuttle's bolt, sent home, keys a gate)
//   Act 3 TWIST      bars 49-64  DOUBLE LOCKS: two keystones, two turrets, one roll sends both home; MIRROR SHELL first
//   Act 4 MASTER     bars 65-84  THE GREAT LOCK: a door the size of a moon's, a whole volley to send home; then the
//                                Foreman's yard, a SHIELD CELL at its entrance, and THE FOREMAN (bar 85, its own track)
import { defineLevel, clamp } from '../../api.js?v=0.4.0';
import ring from '../../pickups/ring/index.js?v=0.4.0';
import boostRing from '../../pickups/boost-ring/index.js?v=0.4.0';
import { mirrorShell, shieldCell } from '../../pickups/powerups/index.js?v=0.4.0';
import pod from '../../enemies/pod/index.js?v=0.4.0';
import seeker from '../../enemies/seeker-drone/index.js?v=0.4.0';
import swarm from '../../enemies/swarm-unit/index.js?v=0.4.0';
import wall from '../../obstacles/g3-blueprint-wall/index.js?v=0.4.0';
import shuttler from '../../enemies/g3-shuttler/index.js?v=0.4.0';
import lockgate, { ductExit } from '../../obstacles/g3-lockgate/index.js?v=0.4.0';
import foreman from '../../bosses/g3-foreman/index.js?v=0.4.0';
import girder from '../../bosses/g3-foreman/girder.js?v=0.4.0';
import { frame, frames, pipe, pipes, crane } from './level3/scenery.js?v=0.4.0';
import { timeline } from './level1/time.js?v=0.4.0';

// audio/g3/level3/music.json (take g3l3-t1): the kick grid fitted to the take
const TL = timeline({ name: 'g3/level3/music', bpm: 144.008, firstBeat: 0.1622, barSec: 1.66657 },
  [[1, 80], [9, 90], [17, 98], [25, 106], [33, 118], [49, 108], [57, 122], [65, 134], [73, 146], [81, 150]]);
const B = TL.barD;
const BOSS_AT = B(84.75);          // a beat before bar 85: the Foreman's track cuts in on bar 85's line
const LENGTH = Math.round(BOSS_AT + 900);
const SC = { 'g3-l3-frames': 1, 'g3-l3-pipes': 1, 'g3-l3-crane': 1 };

export default defineLevel({
  g: 3, n: 3, id: 'lockworks', name: 'THE LOCKWORKS',
  idea: 'Send their fire into the locks to open the way.',
  seed: 300303,
  length: LENGTH,
  speed: TL.speed,
  boostMul: 1.4,
  // style minimums [grazes + close calls, deflects]: from the decent human bot (about 13 and 40 a run, keyed fire and the
  // Foreman included), a quarter, 40% and 60% of that (LEVEL-API 12.6). The lock rings are this level's ★4-★5 gate.
  style: { A: [3, 10], S: [5, 16], DEGENERATE: [8, 24] },
  music: { track: 'g3/level3/music' },
  bossMusic: 'g3/bosses/foreman',
  sfx: [{ id: 'boss-warning', gain: 0.61 }, { id: 'boss-hit', gain: 1 }, { id: 'boss-phase', gain: 0.65 }, { id: 'boss-defeat', gain: 1 },
    { id: 'g3-keyed', gain: 0.7 }, { id: 'g3-scrape', gain: 0.5 }, { id: 'g3-ratchet', gain: 0.6 }, { id: 'g3-girder', gain: 0.6 },
    { id: 'g3-shuttle', gain: 0.5 }, { id: 'g3-weave', gain: 0.55 }, { id: 'g3-blueprint', gain: 0.6 }, { id: 'g3-build', gain: 0.55 }],
  sections: [
    { id: 'outer', name: 'THE OUTER LOCKS', sub: 'SECTOR 1', d0: 0, d1: B(17), look: 'outer', scenery: SC },
    { id: 'row', name: 'GATES IN A ROW', sub: 'SECTOR 2', d0: B(17), d1: B(33), look: 'row', scenery: SC },
    { id: 'keyed', name: 'KEYED WEAVES', sub: 'SECTOR 3', d0: B(33), d1: B(49), look: 'keyed', scenery: SC },
    { id: 'double', name: 'DOUBLE LOCKS', sub: 'SECTOR 4', d0: B(49), d1: B(65), look: 'double', scenery: SC },
    { id: 'great', name: 'THE GREAT LOCK', sub: 'SECTOR 5', d0: B(65), d1: B(81), look: 'great', scenery: SC },
    { id: 'yard', name: "THE FOREMAN'S YARD", sub: 'FINAL APPROACH', d0: B(81), d1: LENGTH, look: 'yard', scenery: { 'g3-l3-frames': 0.6, 'g3-l3-pipes': 0.8, 'g3-l3-crane': 1 } },
  ],
  // Yori's palette (art-incoming/yori/g3/g3-palettes.js, level 3): sky 0b0a0a, gas 4a3a30 / 2a2a3a / 6a3aff, fog 1a1614,
  // key ffd8b0, fill 3a3040, accent copper c87a50. The warmest level in a cold galaxy; her copper is greyed off the amber.
  looks: {
    outer: { sky: ['#0b0a0a', 'rgba(74,58,48,A)', 'rgba(42,42,58,A)', 'rgba(106,58,255,A)'], fog: 0x1a1614, hemiSky: 0xffd8b0, hemiGround: 0x3a3040, sun: 0xffe0c0, band: 0.5, gas: 0.55, cloud: 0x4a3a30, clouds: 0.14, seed: 3301, starGlow: 0.8 },
    row: { sky: ['#0c0a0a', 'rgba(90,70,56,A)', 'rgba(42,42,58,A)', 'rgba(90,50,220,A)'], fog: 0x1c1715, hemiSky: 0xffd8b0, hemiGround: 0x3a3040, sun: 0xffe4c8, band: 0.48, gas: 0.6, cloud: 0x5a4636, clouds: 0.16, seed: 3302 },
    keyed: { sky: ['#0d0b0c', 'rgba(74,58,48,A)', 'rgba(60,46,90,A)', 'rgba(106,58,255,A)'], fog: 0x1d1818, hemiSky: 0xffe0c0, hemiGround: 0x40324a, sun: 0xfff0e0, band: 0.46, gas: 0.66, cloud: 0x4a3a50, clouds: 0.18, seed: 3303 },
    double: { sky: ['#0a0909', 'rgba(64,50,42,A)', 'rgba(36,36,50,A)', 'rgba(80,44,200,A)'], fog: 0x171312, hemiSky: 0xf0c8a0, hemiGround: 0x30283a, sun: 0xffd8b0, band: 0.52, gas: 0.5, cloud: 0x3a2e28, clouds: 0.1, seed: 3304 },
    great: { sky: ['#0e0b0a', 'rgba(110,80,60,A)', 'rgba(50,44,70,A)', 'rgba(120,70,255,A)'], fog: 0x201a16, hemiSky: 0xffe8d0, hemiGround: 0x4a3a50, sun: 0xffffff, band: 0.45, gas: 0.75, cloud: 0x6a5040, clouds: 0.22, seed: 3305 },
    yard: { sky: ['#0b0a0a', 'rgba(74,58,48,A)', 'rgba(255,216,176,A)', 'rgba(106,58,255,A)'], fog: 0x1a1614, hemiSky: 0xffd8b0, hemiGround: 0x3a3040, sun: 0xffe8d0, band: 0.5, gas: 0.6, cloud: 0x4a3a30, clouds: 0.14, seed: 3306 },
  },
  kinds: [ring, boostRing, mirrorShell, shieldCell, pod, seeker, swarm, wall, shuttler, lockgate, ductExit, girder, frame, pipe],
  scenery: [frames, pipes, crane],
  boss: { at: BOSS_AT, def: foreman, then: 'finish' },
  beats: [
    { d: 0, tag: 'calm', what: 'rings down a corridor of bulkheads; the Foreman\'s crane on the horizon' },
    { d: B(6), tag: 'rising', what: 'the first lockgate, alone: its turret\'s first volley goes wide of you, then it aims' },
    { d: B(12), tag: 'rising', what: 'a second gate, the duct the other side; pods' },
    { d: B(17), tag: 'rising', what: 'GATES IN A ROW: three in six bars, sides changing' },
    { d: B(25), tag: 'rising', what: 'the first keyed weave: a shuttle\'s bolt, sent home, keys the gate' },
    { d: B(33), tag: 'peak', what: 'drop one: gates and keyed weaves together, a swarm chain' },
    { d: B(49), tag: 'calm', what: 'the breakdown; MIRROR SHELL on the ring line' },
    { d: B(51), tag: 'rising', what: 'DOUBLE LOCKS: two keystones, two turrets, one roll sends both home' },
    { d: B(57), tag: 'peak', what: 'build two: double locks with pods and walls, the hardest stretch' },
    { d: B(64), tag: 'calm', what: 'two bars of open corridor' },
    { d: B(66), tag: 'peak', what: 'the run to the Great Lock: gates, a wall, shuttles' },
    { d: B(76), tag: 'peak', what: 'THE GREAT LOCK: five keystones, five turrets, one volley to send home whole' },
    { d: B(81), tag: 'calm', what: 'THE FOREMAN\'S YARD: a SHIELD CELL at its entrance; the Foreman rises with its track on bar 85' },
  ],
  acts: { introduce: [0, B(17)], develop: [B(17), B(49)], twist: [B(49), B(65)], master: [B(65), BOSS_AT] },

  build(R, L) {
    const { add, line } = L;
    let P = [0, -0.3];
    const go = (bar, to, n = 4, step = 30, o = {}) => { line(B(bar) - (n - 1) * step, P[0], P[1], to[0], to[1], n, step, 'ring', o); P = to; };
    const W = (bar, gap, n = 4, step = 30) => {
      const to = [clamp(gap[0], -0.85, 0.85), clamp(gap[1], -0.8, 0.8)];
      go(bar, to, n, step, { noMagnet: true }); line(B(bar) + 10, to[0], to[1], to[0], to[1], 1, 26, 'ring', { noMagnet: true });
      add(B(bar), 'g3-blueprint-wall', { gap });
    };
    const podAt = (bar, nx, ny, o = {}) => add(B(bar), 'pod', Object.assign({ nx, ny }, o));
    const seekerAt = (bar, o = {}) => add(B(bar - 2.6), 'seeker-drone', o);
    // a lockgate on bar `bar`: rings lead to its doors, its lock rings wait behind them (they count), and two cache
    // rings run down its duct (extras: the hard way pays a little). The gate puts both sets in place for the screen.
    // Its turret fires twice, 4.4 s and 3.2 s out: miss the key with the first volley and the second is a second chance
    // (a keyed gate stops firing). The roll demand the plan asks of this level (4.3: 50%, about 20 a minute) lives here.
    let gid = 0;
    const gate = (bar, o = {}, nLock = 3) => {
      const id = 'L' + (++gid), d = B(bar), side = o.side ?? 1, main = [-side * 0.25, 0.12], dl = o.great ? 20 : 24;
      go(bar - 0.45, main, 7, 28);
      add(d, 'g3-lockgate', Object.assign({ id, keys: 1, fire: [4.4, 3.2], side }, o));
      for (let i = 0; i < nLock; i++) add(d + 14 + i * dl, 'ring', { lockOf: id, i, of: nLock, nx: main[0], ny: main[1], noMagnet: true });
      for (let i = 0; i < 2; i++) add(d + 22 + i * 44, 'ring', { ductOf: id, cache: true, nx: side * 0.9, ny: 0, noMagnet: true });
      add(d + (o.duct || 110) - 4, 'g3-lockgate-exit', { of: id });
      P = [0, 0.1];
      return id;
    };
    // a keyed weave: a shuttle on its rail whose bolts, sent home, key the gate `bars` later (the gate has no turret)
    const keyed = (shBar, rail, gateBar, o = {}) => { const id = gate(gateBar, Object.assign({ fire: [], turret: false }, o)); add(B(shBar), 'g3-shuttler', { rail, key: id, shots: 3, gap: 1.4, axis: rail === 'B' ? 'y' : 'x' }); return id; };

    // ================= ACT 1, INTRODUCE (bars 1-16) =================
    line(B(1.25), 0, -0.3, 0, 0.1, 6, 28); P = [0, 0.1];
    go(4, [0.2, 0.15], 5, 32);
    add(B(5), 'call', { text: 'THE RED OCTAGON IS A KEY. ROLL ITS FIRE BACK INTO IT', cls: 'c-cyan' });
    gate(9, { fire: [5.2, 3.6], wide: 1 }, 3);                              // the first: watch the wide one miss, then key the next
    add(B(10.2), 'call', { text: 'MISS THE KEY AND THE DUCT IS YOUR WAY THROUGH', cls: 'c-cyan' });
    go(12, [0.2, 0.2], 5, 32);
    podAt(12.5, 0.7, 0.65, { bursts: 2 }); podAt(12.7, -0.7, -0.6, { bursts: 1 });
    gate(14.5, { side: -1 }, 3);
    go(16.5, [-0.3, 0], 4, 32);
    add(B(16), 'g3-shuttler', { rail: 'R', shots: 2, gap: 1.5 });
    // ================= ACT 2, DEVELOP (bars 17-48): gates in a row, keyed weaves =================
    W(17.5, [-0.35, 0.1, 0.32, 0.36]);
    gate(19.5, { side: 1 }, 3); gate(21.5, { side: -1 }, 3); gate(23.5, { side: 1, dy: 0.5 }, 3);
    seekerAt(25.5, { nx: 0.3, ny: 0.6, shots: 1 });                       // one: the keyed weave's three follow it
    go(25.5, [0, 0.2], 4, 32);
    keyed(25.5, 'L', 28.5, { side: 1 });
    go(30.5, [0.3, -0.2], 4, 32);
    W(31, [0.35, -0.25, 0.3, 0.34]); podAt(31, -0.75, 0.7, { bursts: 2 });
    // drop one (bar 33): gates and keyed weaves together
    seekerAt(33.5, { nx: -0.35, ny: 0.6, shots: 2 });
    gate(34.5, { side: -1, dy: -0.4 }, 3);
    keyed(35, 'R', 37.5, { side: 1 });
    add(B(39.5), 'swarm-unit', { n: 6, volleys: 1, aim: 'ship', side: -1 });
    go(40.5, [0, 0.2], 5, 32);
    add(B(40.5), 'g3-shuttler', { rail: 'L', shots: 2, gap: 1.5 });
    gate(42, { side: 1 }, 3);
    keyed(42.5, 'B', 45, { side: -1 });
    podAt(44.2, 0.75, 0.7, { bursts: 1 }); podAt(44.4, -0.75, 0.7, { bursts: 1 });
    seekerAt(46.3, { nx: -0.3, ny: 0.6, shots: 2 });                      // two, early: the double locks' volleys follow (never 4 rolls in 3 s)
    W(47.5, [0.3, 0.25, 0.3, 0.34]);
    // ================= ACT 3, TWIST (bars 49-64): DOUBLE LOCKS =================
    go(49.5, [0, 0], 4, 32);
    add(B(50.3), 'mirror-shell', { nx: 0, ny: 0 });                         // the longer reach takes both bolts in one roll
    add(B(50.5), 'call', { text: 'TWO KEYS. ONE ROLL SENDS BOTH HOME', cls: 'c-cyan' });
    gate(52, { keys: 2, side: 1 }, 4);
    go(54.5, [0, 0.2], 5, 32);
    gate(56, { keys: 2, side: -1 }, 4);
    // build two (bar 57): double locks with pods and walls, the hardest stretch
    podAt(57.5, 0.75, 0.7, { bursts: 1 }); podAt(57.7, -0.75, -0.7, { bursts: 1 }); // one burst: the double lock's second volley may come first
    W(58, [0.3, 0.3, 0.28, 0.32]);
    gate(59.5, { keys: 2, side: 1, dy: -0.4 }, 4);
    seekerAt(61.5, { nx: 0.35, ny: 0.6, shots: 2 });
    gate(61.5, { keys: 2, side: -1, dy: 0.4 }, 4);
    go(64.5, [0, 0.1], 6, 34);                                              // two bars of open corridor (rule 3)
    // ================= ACT 4, MASTER (bars 65-84): THE GREAT LOCK =================
    gate(66.5, { side: -1 }, 3);
    add(B(67), 'g3-shuttler', { rail: 'R', shots: 3, gap: 1.3 });
    W(69.5, [-0.3, -0.2, 0.28, 0.32]);
    keyed(69.5, 'L', 72, { side: 1, dy: 0.4 });
    podAt(73.5, 0.75, 0.7, { bursts: 1 }); podAt(73.6, -0.75, 0.7, { bursts: 1 }); // one burst each: the keyed weave's bolts are between
    go(74.5, [0, 0.15], 4, 34);
    add(B(75), 'call', { text: 'THE GREAT LOCK. ITS WHOLE VOLLEY HAS TO GO HOME', cls: 'c-cyan' });
    gate(77, { great: true, keys: 5, fire: [3.8], side: 1, duct: 175 }, 8);
    // THE FOREMAN'S YARD (bars 81-84): calm, a SHIELD CELL at its entrance, then the boss on bar 85
    go(81.5, [0, 0.1], 5, 34);
    add(B(82.6), 'shield-cell', { nx: 0, ny: 0.1 });
    line(B(82.9), 0, 0.1, 0, 0, 6, 34); P = [0, 0];
  },
});
