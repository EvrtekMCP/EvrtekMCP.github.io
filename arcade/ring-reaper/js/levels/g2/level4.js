// THE VERDANT DEEP, LEVEL 4: THE MIGRATION. Open blue water, a herd of star-whales a kilometre long crossing the sky,
// nursery clouds glowing (Yori's look, looks/level-g2-04-the-migration.png). The one blue level of the Deep.
// HEADLINE (rule 20): shield the calf by flying into the shots aimed at it. A young star-whale (js/allies/g2-calf)
// swims beside your lane; hounds (js/enemies/g2-hound) run at the lane's edge and fire slow bolts at it, across your
// lane. Fly into a bolt's path and roll: INTERCEPT!, and the bolt goes home. Shots you used to dodge become shots
// you chase. The calf cannot die; a fully bright calf pays CALF SAFE when it swims home.
//
// One schedule with the music (rule 30): the level's track (audio/g2/level4/music, 138.01 bpm, D major, first beat
// 0.172 s) is galaxy 1's bar map: intro 1-8, groove 9-24, build 25-32, DROP 33-48, breakdown 49-56, build 57-64,
// DROP 65-80, drive 81-88. Bars below count from 0 at the first beat (bar n here is the manifest's bar n + 1). The
// speed steps sit on section lines, every hound is timed so its bolt crosses your lane ON a bar, and the acts follow
// the track's sections.
import { defineLevel } from '../../api.js?v=0.6.2';
import ring from '../../pickups/ring/index.js?v=0.6.2';
import pod from '../../enemies/pod/index.js?v=0.6.2';
import seeker from '../../enemies/seeker-drone/index.js?v=0.6.2';
import { shieldCell, mirrorShell } from '../../pickups/powerups/index.js?v=0.6.2';
import calf from '../../allies/g2-calf/index.js?v=0.6.2';
import current from '../../obstacles/g2-current/index.js?v=0.6.2';
import thrummer, { pulse } from '../../enemies/g2-thrummer/index.js?v=0.6.2';
import shoalFish from '../../pickups/g2-shoal/index.js?v=0.6.2';
import hound, { crossAfter } from '../../enemies/g2-hound/index.js?v=0.6.2';
import { clock } from './level4/clock.js?v=0.6.2';
import { SCENERY, DECOR } from './level4/scenery.js?v=0.6.2';

// ---- the clock: the track's kick grid (audio/g2/level4/music.json: bpm 138.014, firstBeat 0.1718 s); speed 76 to 152
// m/s in four steps on section lines, each eased over 150 m in a calm bar (rule 6)
const C = clock({ bpm: 138.014, firstBeat: 0.1718, v0: 76, steps: [[24, 19], [48, 19], [64, 19], [80, 19]] });
const B = C.B;
const END = B(88);
const BAR = C.BAR;
// the calf's usual place: just outside the box on the left, a little low
const OUT = [-1.5, -0.1];

export default defineLevel({
  g: 2, n: 4, id: 'migration', name: 'THE MIGRATION',
  idea: 'Shield the calf by flying into the shots aimed at it.',
  length: END,
  speed: C.speed,
  music: { track: 'g2/level4/music' },
  bossMusic: null,
  // style minimums [grazes + close calls, deflects] for A, S, DEGENERATE, from the decent human bot (about 7 close and
  // 20 deflects a run): a quarter, 40% and 60%. Like galaxy 1's level 4 it asks almost no close calls: nothing here
  // scrapes, and a bolt you intercept is not a graze. Its style is the roll.
  style: { A: [0, 5], S: [1, 8], DEGENERATE: [2, 12] },
  sfx: [{ id: 'g2-hound-bolt', gain: 0.5 }, { id: 'g2-intercept', gain: 0.7 }, { id: 'g2-calf-call', gain: 0.6 }, { id: 'g2-calf-flinch', gain: 0.6 }, { id: 'g2-graft-crack', gain: 0.7 }],
  sections: [
    { id: 'herd', name: 'THE HERD', sub: 'SECTOR 1', d0: 0, d1: B(24), scenery: { 'g2-l4-plankton': 1, 'g2-l4-clouds': 0.7, 'g2-l4-herd': 1, 'g2-l4-mothers': 1 } },
    { id: 'pack', name: 'THE PACK', sub: 'SECTOR 2', d0: B(24), d1: B(48), scenery: { 'g2-l4-plankton': 1, 'g2-l4-clouds': 0.6, 'g2-l4-herd': 0.8, 'g2-l4-mothers': 1 } },
    { id: 'stampede', name: 'THE STAMPEDE', sub: 'SECTOR 3', d0: B(48), d1: B(64), scenery: { 'g2-l4-plankton': 1, 'g2-l4-clouds': 0.4, 'g2-l4-herd': 1, 'g2-l4-mothers': 0.6 } },
    { id: 'nursery', name: 'THE NURSERY', sub: 'FINAL STRETCH', d0: B(64), d1: END, scenery: { 'g2-l4-plankton': 1, 'g2-l4-clouds': (t) => 0.6 + 0.4 * t, 'g2-l4-herd': 0.7, 'g2-l4-mothers': 1 } },
  ],
  // Yori's palette (palettes.js, level 4): sky #0a1830, gas #2a5aa0 #8fd0ff #1e6a6a, fog #102a40, key #f4faff, fill
  // #2a4a8a. One change: her third gas, #1e6a6a, sits at hue 180, 11 degrees from the reserved cyan at 72% saturation
  // (rule 9 and her own galaxy note: "kept on the green side, never at cyan"), so it is nudged to #1e6a5a (hue 172).
  looks: {
    herd: { sky: ['#0a1830', 'rgba(42,90,160,A)', 'rgba(143,208,255,A)', 'rgba(30,106,90,A)'], fog: 0x102a40, hemiSky: 0xf4faff, hemiGround: 0x2a4a8a, sun: 0xf4faff, band: 0.55, gas: 0.7, cloud: 0x8fd0ff, clouds: 0.2, seed: 2401, sunDir: [0.3, 1, 0.4] },
    pack: { sky: ['#091628', 'rgba(42,90,160,A)', 'rgba(130,190,240,A)', 'rgba(30,106,90,A)'], fog: 0x0f2640, hemiSky: 0xeef6ff, hemiGround: 0x284688, sun: 0xf4faff, band: 0.5, gas: 0.65, cloud: 0x8fd0ff, clouds: 0.22, seed: 2402, sunDir: [0.3, 1, 0.4] },
    stampede: { sky: ['#081424', 'rgba(36,80,150,A)', 'rgba(150,210,255,A)', 'rgba(26,96,84,A)'], fog: 0x0e2438, hemiSky: 0xf4faff, hemiGround: 0x2a4a8a, sun: 0xffffff, band: 0.6, gas: 0.7, cloud: 0x9fd8ff, clouds: 0.26, seed: 2403, sunDir: [0.3, 1, 0.4] },
    nursery: { sky: ['#0a1a34', 'rgba(52,104,176,A)', 'rgba(170,220,255,A)', 'rgba(30,106,90,A)'], fog: 0x14304a, hemiSky: 0xf8fcff, hemiGround: 0x2e5094, sun: 0xffffff, band: 0.6, gas: 0.75, cloud: 0xa8dcff, clouds: 0.3, seed: 2404, sunDir: [0.3, 1, 0.4] },
  },
  kinds: [ring, pod, seeker, calf, hound, current, thrummer, pulse, shoalFish, shieldCell, mirrorShell, ...DECOR],
  scenery: SCENERY,
  boss: null,
  // rule 1: the beat sheet (calm / rising / peak), in metres; the bar and the track's section in the text
  beats: [
    { d: 0, tag: 'calm', what: 'bar 0, intro: rings in the open; the calf swims in beside you on the left (bar 4)' },
    { d: B(8), tag: 'calm', what: 'bar 8, groove: the first hound, alone, one slow bolt at the calf that can only graze you; rings show the spot' },
    { d: B(12), tag: 'rising', what: 'bars 12-22: single hounds, a lantern pod; every bolt has its ring line' },
    { d: B(24), tag: 'calm', what: 'bar 24: speed step; rings only' },
    { d: B(26), tag: 'rising', what: 'bar 26, build one: hounds in pairs, bolts crossing high then low' },
    { d: B(28.9), tag: 'rising', what: 'bar 29: MIRROR SHELL, taught alone on a ring line; the calf drifts into the box' },
    { d: B(30), tag: 'peak', what: 'bars 30-31: the first crossfire, hounds on both sides at the calf; the shell takes both' },
    { d: B(33), tag: 'rising', what: 'bar 33, DROP one: a pod and a hound; then hounds fire at you too, and you choose which to cover' },
    { d: B(40), tag: 'peak', what: 'bars 40-44: a seeker drone (roll only) and a mixed pair' },
    { d: B(45.5), tag: 'calm', what: 'bars 45-48: breather, a ring corkscrew' },
    { d: B(48), tag: 'calm', what: 'bar 48, breakdown: speed step; THE STAMPEDE begins, whales sweeping across ahead' },
    { d: B(50), tag: 'rising', what: 'bars 50-55: the calf ducks into the box and its glow marks the lane; hounds fire through the gaps' },
    { d: B(56.5), tag: 'peak', what: 'bars 56-61, build two: the hardest stretch, both sides at the calf plus a seeker' },
    { d: B(62), tag: 'calm', what: 'bars 62-64: the herd has passed; SHIELD CELL on the ring line after the Stampede' },
    { d: B(66), tag: 'rising', what: 'bar 66, DROP two: mixed hounds, a pod, a seeker' },
    { d: B(73), tag: 'rising', what: 'bar 73: the second MIRROR SHELL; the calf comes into the box for the Nursery' },
    { d: B(74.5), tag: 'peak', what: 'bars 74-79, SET PIECE: THE NURSERY, the whole pack fires everything at the calf, in pairs' },
    { d: B(80), tag: 'calm', what: 'bar 80, drive: speed step; calm at top speed as the calf swims home to its mother (bar 83)' },
  ],
  acts: { introduce: [0, B(24)], develop: [B(24), B(48)], twist: [B(48), B(64)], master: [B(64), END] },
  build(R, L) {
    const { add, line, sine } = L;
    // galaxy 2's kinds from the levels before (g2-a's): a current to ride or be carried by, a drum's pulse (fly its
    // hole or roll as it meets you: PARRY), a shoal of ring-fish, a drifter. Laid as their own levels lay them.
    const ribbon = (b0, bars, path, o = {}) => { const d = B(b0), len = B(b0 + bars) - d; return add(d, 'g2-current', Object.assign({ len, ride: true, w: 0.34, path: path.map(([bb, x, y]) => [B(b0 + bb) - d, x, y]), seed: Math.round(d) }, o)); };
    const drum = (beat, meet, nx, ny, hole) => add(B(meet) + 150, 'g2-thrummer', { nx, ny, s: 3, pulses: [{ beat: B(beat), meet: B(meet), tell: B(beat) - B(beat - 1), hole: hole ? { a: hole[0], w: hole[1] } : null }] });
    const holeAt = (a) => [Math.round(Math.cos(a) * 0.66 * 100) / 100, Math.round(Math.sin(a) * 0.68 * 100) / 100];
    let shoalN = 0;
    const shoal = (b, n, gap, keys) => { const id = 'L4S' + (++shoalN), d0 = B(b), K = keys.map(([kb, x, y]) => [800 + B(kb) - d0, x, y]); for (let i = 0; i < n; i++) add(d0 + i * gap, 'g2-shoal', { shoal: id, idx: i, of: n, gap, keys: K, off: [0.05 * Math.sin(i * 1.7), 0.04 * Math.cos(i * 1.3)] }); };
    const call = (bar, text, cls = 'c-cyan') => add(B(bar), 'call', { text, cls });
    // the calf's height at a bar, from its path (for laying the rings where the bolts will cross)
    const calfAt = (bar) => { const d = B(bar); let p = path[0]; for (const q of path) if (q[0] <= d) p = q; return p; };
    // a hound whose n-th bolt crosses the middle of the lane on `bar`: its arrival is placed so the timing holds
    const houndAt = (bar, side, ny, shots, o = {}) => { add(C.at(bar, -crossAfter(0, o)), 'g2-hound', Object.assign({ side, ny, shots }, o)); return shots.map((_, i) => bar + i * (o.gap ?? 2.2) / BAR); };
    // the intercept spot: three rings running in to where the bolt crosses (the middle of the lane, halfway between the
    // hound's height and the calf's)
    const spot = (bar, ny, from = 0.35) => line(B(bar) - 44, 0, ny + from, 0, ny, 3, 22);
    const crossY = (hny, bar) => (hny + calfAt(bar)[2]) / 2;
    // a hound at the calf with its spots laid
    const atCalf = (bar, side, ny, n = 1, o = {}) => { const bars = houndAt(bar, side, ny, Array(n).fill('calf'), o); bars.forEach((b, i) => spot(b, crossY(ny, b), i % 2 ? -0.3 : 0.3)); return bars; };

    // the calf's path (course distance, nx, ny). Outside on the left; it drifts in for the crossfires, weaves through the
    // Stampede (its glow is the lane to fly), and comes into the box for the Nursery
    const path = [
      [B(4), ...OUT], [B(28.4), ...OUT], [B(29.6), 0, -0.62], [B(31.6), 0, -0.62], [B(33), ...OUT],
      [B(48.5), ...OUT], [B(49.8), -0.45, -0.62], [B(52.8), -0.45, -0.62], [B(54.2), 0.45, -0.55], [B(56.6), 0.45, -0.55], [B(58), -0.15, -0.66], [B(61.4), -0.15, -0.66], [B(63), ...OUT],
      [B(72.4), ...OUT], [B(73.6), 0, -0.58], [B(79.6), 0, -0.58], [B(81), -1.5, 0.15],
    ];
    add(B(4), 'g2-calf', { side: -1, path, home: B(83) });

    // ================= ACT 1, INTRODUCE: THE HERD (bars 0-24, 76 m/s; intro, groove) =================
    // open slow (rule 4): rings while the calf joins; nothing can hurt for the first 15 s
    line(220, 0, -0.25, 0, 0.25);
    line(460, -0.4, 0, 0.4, 0);
    call(4.1, 'A CALF SWIMS WITH YOU');
    // the herd rides a current, and so do you (Tideway's ribbon: ride inside it, x1.15 and RIDE points)
    ribbon(4.6, 3.2, [[0, 0, -0.15], [1.6, -0.3, -0.25], [3.2, 0, -0.1]]);
    for (let b = 4.9; b < 7.7; b += 0.4) { const k = (b - 4.6) / 3.2; L.ring(B(b), -0.3 * Math.sin(k * Math.PI), -0.15 - 0.1 * Math.sin(k * Math.PI)); }
    // the first hound, alone (rule 18): a longer tell, one slow bolt that can only graze you, and the rings to its spot
    call(8.4, 'GET BETWEEN THE HOUND AND THE CALF');
    atCalf(10, 1, 0, 1, { first: true });
    line(B(10.8), 0, 0, -0.4, 0.2, 4, 24);
    call(12.4, 'ROLL AS ITS BOLT REACHES YOU');
    atCalf(13.5, 1, 0.35);
    line(B(14.3), 0.2, 0.2, 0.5, -0.1, 4, 24);
    add(B(15.4), 'pod', { nx: 0.35, ny: 0.45 });
    line(B(15.6), -0.3, -0.2, -0.3, 0.3, 4, 24);
    atCalf(17.2, 1, -0.4, 2, { gap: 2.4 });
    add(B(19.6), 'pod', { nx: -0.35, ny: -0.35 });
    line(B(19.8), 0.3, 0.3, 0.3, -0.2, 4, 24);
    atCalf(21.5, 1, 0.2);
    sine(B(22.2), 6, 26, 0.3, 0.3);

    // ================= ACT 2, DEVELOP: THE PACK (bars 24-48, 95 m/s; build one, DROP one) =================
    line(B(24.2), -0.3, 0, 0.3, 0, 5, 26);
    // hounds in pairs, the bolts crossing at different heights: high, then low
    atCalf(26.5, 1, 0.55);
    atCalf(27.1, 1, -0.6, 1, { nx: 1.15 });
    // MIRROR SHELL, taught alone (rule 18): in the open, a ring line through it, and its use within 2 s: the calf drifts
    // into the box and hounds on both sides fire at its two flanks at once. The shell's reach takes both in one roll.
    line(B(28.1), 0, 0.15, 0, -0.35, 4, 22);
    add(B(28.9), 'mirror-shell', { nx: 0, ny: -0.3 });
    houndAt(30, -1, -0.6, ['calf', 'calf'], { flank: 2.4, gap: 2.2 });
    houndAt(30, 1, -0.6, ['calf', 'calf'], { flank: 2.4, gap: 2.2 });
    line(B(29.3), 0, -0.35, 0, -0.45, 3, 24); line(B(31.0), 0, -0.45, 0, -0.45, 3, 22);
    // DROP one: a pod and a hound at the calf
    line(B(32.4), 0.3, 0.2, -0.3, 0.2, 4, 24);
    add(B(33.4), 'pod', { nx: 0.4, ny: 0.5, shots: 2 });
    atCalf(34.5, 1, 0.2, 2, { gap: 2.2 });
    // then hounds fire at you too, and you choose which to cover: one at you from the calf's side, one at the calf
    atCalf(36.2, 1, 0.5);
    houndAt(38, -1, 0.3, ['ship', 'ship'], { gap: 2.3 });
    atCalf(38.7, 1, -0.3);
    line(B(36.6), -0.4, -0.2, 0.2, -0.3, 4, 24);
    // a seeker drone: the bolt you cannot sidestep (galaxy 1's, known: roll it home)
    add(B(40.3), 'seeker-drone', { nx: 0.25, ny: 0.5, shots: 2, hold: 120 });
    line(B(40.6), 0.4, 0.1, -0.2, 0.4, 5, 24);
    // a mixed pair: the right hound's first bolt at the calf, its second at you; the left one at you between them
    houndAt(43, 1, 0.1, ['calf', 'ship'], { gap: 2.2 }); spot(43, crossY(0.1, 43));
    houndAt(43.6, -1, -0.2, ['ship']);
    atCalf(44.6, 1, -0.2);
    // breather (rule 2): a corkscrew
    sine(B(45.6), 10, 26, 0.45, 0.35);

    // ================= ACT 3, TWIST: THE STAMPEDE (bars 48-64, 114 m/s; breakdown, build two) =================
    // the herd crosses your lane ahead of you, whales at a gallop, both ways, at every height. They are never solid.
    for (let i = 0, bar = 48.6; bar < 62.5; i++, bar += 1.15 + 0.35 * (i % 3)) add(B(bar), 'g2-l4-crosser', { dir: i % 2 ? -1 : 1, ny: [0.5, -0.4, 0.1, 0.8, -0.7][i % 5], len: 40 + 20 * ((i * 7) % 3) / 2, mid: 130 + (i % 4) * 25 });
    call(49.4, 'STAY WITH THE CALF', 'c-cyan');
    // the calf ducks into the box; its glow marks the lane: rings ride just above it
    const above = (b0, b1, nx, ny) => { for (let b = b0; b < b1; b += 0.5) L.ring(B(b), nx, ny + 0.28); };
    above(50, 52.6, -0.45, -0.62);
    // (in the Stampede the bolts land on the calf's flanks: riding just above it intercepts them, so no spot rings here)
    houndAt(51, 1, -0.2, ['calf', 'calf'], { gap: 2.0 });
    houndAt(52, -1, -0.5, ['calf']);
    houndAt(53.3, 1, -0.45, ['calf']);
    above(54.4, 56.4, 0.45, -0.55);
    houndAt(55, -1, -0.2, ['calf']);
    houndAt(55.5, 1, -0.4, ['calf']);
    // build two, the hardest stretch (rule 5, about two thirds in): a seeker above, hounds on both sides at the calf
    add(B(56.6), 'seeker-drone', { nx: -0.3, ny: 0.6, shots: 2, hold: 115 });
    houndAt(57.1, -1, -0.5, ['calf']);
    above(58.2, 61.2, -0.15, -0.66);
    houndAt(58.5, 1, -0.3, ['calf', 'calf'], { gap: 2.0 });
    houndAt(59.1, -1, -0.5, ['calf', 'calf'], { gap: 2.0 });
    // the herd has passed: calm, then SHIELD CELL on the ring line after the Stampede
    sine(B(62), 6, 28, 0.35, 0.3);
    line(B(64.1), 0, 0.3, 0, -0.1, 4, 24);
    add(B(64.6), 'shield-cell', { nx: 0, ny: 0 });

    // ================= ACT 4, MASTER: THE NURSERY (bars 64-88, 133 then 152 m/s; DROP two, drive) =================
    // a drum on the reef beside the herd: its pulse meets you on bar 66; fly its hole (left) or roll as it meets you
    drum(65, 66, 1.8, 0.2, [Math.PI, 1.7]); { const h = holeAt(Math.PI); line(B(66) - 66, h[0] * 0.4, h[1], h[0], h[1], 3, 22); }
    houndAt(66.8, 1, 0.3, ['calf', 'ship', 'calf'], { gap: 2.0 }); spot(66.8, crossY(0.3, 66.8)); spot(66.8 + 4 / BAR, crossY(0.3, 69));
    add(B(67.6), 'pod', { nx: -0.4, ny: 0.4, shots: 2 });
    add(B(69.6), 'seeker-drone', { nx: 0.3, ny: -0.4, shots: 2, hold: 120 });
    houndAt(71, -1, -0.2, ['ship', 'ship'], { gap: 2.0 });
    atCalf(68.6, 1, -0.35); atCalf(70.3, 1, 0.45);
    // the Nursery: the second MIRROR SHELL on the ring line, the calf in the box, then the whole pack at it in pairs
    call(72.2, 'THE PACK IS GOING FOR THE CALF', 'c-red');
    line(B(72.4), 0, 0.2, 0, -0.3, 4, 24);
    add(B(73.2), 'mirror-shell', { nx: 0, ny: -0.3 });
    houndAt(74.6, -1, -0.55, ['calf', 'calf'], { flank: 2.4, gap: 2.6 });
    houndAt(74.6, 1, -0.55, ['calf', 'calf'], { flank: 2.4, gap: 2.6 });
    houndAt(75.9, -1, 0.15, ['calf', 'calf'], { flank: 2.4, gap: 2.6 });
    houndAt(75.9, 1, 0.15, ['calf', 'calf'], { flank: 2.4, gap: 2.6 });
    for (let b = 74; b < 80; b += 0.65) L.ring(B(b), 0, -0.35 + 0.25 * Math.sin(b * 1.7));
    // the ring of nursery clouds the herd swims into, round the lane, outside the box
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; add(B(76 + i * 0.35), 'g2-l4-cloud', { nx: Math.cos(a) * 4.6, ny: Math.sin(a) * 5, r: 0.75 + (i % 3) * 0.15 }); }
    // calm at top speed: the calf swims home to its mother (it leaves on bar 83)
    // the calf's last swim: a shoal of ring-fish runs home with the herd (the Shoals' kind: chase it)
    shoal(80.8, 10, 30, [[78.6, 0.45, 0.35], [80.8, 0.25, 0.15], [83.2, -0.2, 0.05]]);
    line(B(84.2), -0.3, 0, 0.3, 0, 5, 30);
    line(B(86.2), 0, -0.2, 0, 0.2, 4, 30);
  },
  outro: null,
});
