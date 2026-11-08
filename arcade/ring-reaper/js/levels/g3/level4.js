// GALAXY 3, LEVEL 4: THE AUGURY. A clockwork model of a galaxy, turning round the lane (Yori's look sheet
// g3-level-04). THE HEADLINE (rule 20): augurs fire where you are going, so change your line. Its new enemy is the
// AUGUR (js/enemies/g3-augur): a prism-eyed sentry that hangs a hollow red crosshair where you will be in 1.2 s if you
// keep going, charges, and fires there. Your own momentum is its aim. Keep going and you are hit; change direction or
// stop and it misses; fly INTO the crosshair and roll, and it comes home (the scoring answer; dodging is the safe one).
// Beside it, galaxy 1's sniper (who aims AT you): one shot where you are, one where you are going. That is the lesson.
//
// THE SCHEDULE (rule 30): the plan's track, g3/level4/music, 145 bpm, hypnotic minimal techno with a clockwork tick,
// its bar map the one every level track shares (Intro 1-8, Groove 9-24, Build one 25-32, Drop one 33-48, Breakdown
// 49-56, Build two 57-64, Drop two 65-80, Drive 81-88, Outro 89-94). Until the take lands (ElevenLabs credits), a
// galaxy 1 stand-in plays; the course is laid on the plan's grid (B(bar) below) and check-levels reports the real bars
// once the .json is in.
//   ACT 1 INTRODUCE  THE OUTER DIAL       bars  1-24  82-90 m/s   one augur, slow and big: drift and watch it follow,
//                                                                  stop and see it miss; then one at a time, then the
//                                                                  first you can fly into and roll
//   ACT 2 DEVELOP    THE SEERS' GALLERY   bars 25-48  102-116     snipers (at you) beside augurs (ahead of you): any
//                                                                  move dodges one of them; pods between
//   ACT 3 TWIST      THE HALL OF AUGURS   bars 49-64  116-124     four predict in turn; the safe line is the zigzag the
//                                                                  rings show. SLIPSTREAM just before it; SHIELD CELL after
//   ACT 4 MASTER     THE ORRERY           bars 65-88  138-158     the set piece: the clockwork galaxy turning round you,
//                                                                  augurs riding its arms, the rings dancing through its
//                                                                  rings (RING MAGNET just before); the drive a step less
//   (outro 89-91: a last corkscrew to the line)
// The difficulty is the engine's (EASE_G[3][4]: dmg 0.95, heal 1.05, shot 1.0, ring 1.0; pressure 0.90).
import { defineLevel, clamp } from '../../api.js?v=0.5.0';
import ring from '../../pickups/ring/index.js?v=0.5.0';
import pod from '../../enemies/pod/index.js?v=0.5.0';
import sniper from '../../enemies/sniper/index.js?v=0.5.0';
import { shieldCell, ringMagnet, slipstream } from '../../pickups/powerups/index.js?v=0.5.0';
import augur from '../../enemies/g3-augur/index.js?v=0.5.0';
import { musicClock } from './level4/clock.js?v=0.5.0';
import { pylon, smallOrrery, pylons, orbits, orrery } from './level4/scenery.js?v=0.5.0';

// ---- the clock: the plan's 145 bpm (nominal first beat 0.16 s, as the galaxy's mastered takes have), speed on bars
const C = musicClock(145, 0.16, [[1, 82], [9, 90], [25, 102], [33, 116], [57, 124], [65, 138], [81, 150], [85, 158]], 91);
export const B = C.B, BAR = C.BAR;
const LENGTH = B(91);
const A1 = B(25), A2 = B(49), A3 = B(65);

export default defineLevel({
  g: 3, n: 4, id: 'augury', name: 'THE AUGURY',
  idea: 'Augurs fire where you are going, so change your line.',
  seed: 300004,
  length: LENGTH,
  speed: C.speed,
  music: { track: 'g3/level4/music' },      // the sound branch's name; a galaxy 1 stand-in plays until it lands
  bossMusic: null,
  sfx: [{ id: 'g3-augur-charge', gain: 0.6 }],
  // style minimums from its decent human bot (3 seeds: grazes 3-5, no scrapes (nothing here scrapes), deflects 3-11; the
  // safe answer to an augur is a dodge, so the roll is asked less here): A a quarter, S 40%, DEGENERATE 60%
  style: { A: [1, 2], S: [2, 3], DEGENERATE: [3, 4] },
  sections: [
    { id: 'dial', name: 'THE OUTER DIAL', sub: 'SECTOR 1', d0: 0, d1: A1, look: 'dial',
      scenery: { 'g3-l4-pylons': 0.8, 'g3-l4-orbits': 1, 'g3-l4-orrery': 0.45 } },
    { id: 'seers', name: "THE SEERS' GALLERY", sub: 'SECTOR 2', d0: A1, d1: A2, look: 'seers',
      scenery: { 'g3-l4-pylons': 1, 'g3-l4-orbits': 0.8, 'g3-l4-orrery': 0.5 } },
    { id: 'hall', name: 'THE HALL OF AUGURS', sub: 'SECTOR 3', d0: A2, d1: A3, look: 'hall',
      scenery: { 'g3-l4-pylons': 1, 'g3-l4-orbits': 0.5, 'g3-l4-orrery': 0.6 } },
    { id: 'orrery', name: 'THE ORRERY', sub: 'FINAL STRETCH', d0: A3, d1: LENGTH, look: 'orrery',
      scenery: { 'g3-l4-pylons': 0.6, 'g3-l4-orbits': 1, 'g3-l4-orrery': 1 } },
  ],
  // Yori's palette (g3-palettes.js, level 4): sky 07061a, gas 3a2a70 / d080ff / 1a1a3a, fog 120f2a, key f4f0ff, fill
  // 5a3a9a, accent orchid d080ff. Indigo and orchid; no red, amber or cyan (rule 9).
  looks: {
    dial: { sky: ['#07061a', 'rgba(58,42,112,A)', 'rgba(208,128,255,A)', 'rgba(26,26,58,A)'], fog: 0x120f2a, hemiSky: 0xf4f0ff, hemiGround: 0x5a3a9a, sun: 0xf4f0ff, band: 0.5, gas: 0.55, cloud: 0x3a2a70, clouds: 0.14, seed: 3401 },
    seers: { sky: ['#08071e', 'rgba(208,128,255,A)', 'rgba(58,42,112,A)', 'rgba(26,26,58,A)'], fog: 0x14102e, hemiSky: 0xf4f0ff, hemiGround: 0x5a3a9a, sun: 0xffffff, band: 0.46, gas: 0.65, cloud: 0x5a3a9a, clouds: 0.16, seed: 3402 },
    hall: { sky: ['#06051a', 'rgba(26,26,58,A)', 'rgba(208,128,255,A)', 'rgba(90,58,154,A)'], fog: 0x110d28, hemiSky: 0xe8e0ff, hemiGround: 0x4a2a8a, sun: 0xf4f0ff, band: 0.54, gas: 0.6, cloud: 0x3a2a70, clouds: 0.12, seed: 3403 },
    orrery: { sky: ['#0a0822', 'rgba(208,128,255,A)', 'rgba(90,58,154,A)', 'rgba(244,240,255,A)'], fog: 0x161234, hemiSky: 0xffffff, hemiGround: 0x5a3a9a, sun: 0xffffff, band: 0.5, gas: 0.8, cloud: 0xd080ff, clouds: 0.2, seed: 3404 },
  },
  kinds: [ring, pod, sniper, augur, shieldCell, ringMagnet, slipstream, pylon, smallOrrery],
  scenery: [pylons, orbits, orrery],
  beats: [
    { d: 0, tag: 'calm', what: 'intro: the outer dial, rings in the open, the Orrery far ahead' },
    { d: B(6), tag: 'rising', what: 'the first augur, alone, slow and big: drift with the rings and watch its crosshair lead you; the rings stop and its bolt goes past' },
    { d: B(10.5), tag: 'rising', what: 'groove: one augur at a time, each over a ring line that turns; then one over a straight line (move, or be hit)' },
    { d: B(17), tag: 'rising', what: 'the first to fly into: its crosshair on the ring line; roll in it and it comes home' },
    { d: B(21), tag: 'calm', what: 'rings only' },
    { d: A1, tag: 'rising', what: 'build one, faster: snipers alone on prism pylons (known), then a sniper and an augur together' },
    { d: B(34), tag: 'rising', what: 'drop one (speed at bar 33, density from 34): pairs, one at you and one ahead; pods between' },
    { d: B(38), tag: 'peak', what: 'pairs both sides, a pod volley in each' },
    { d: B(45), tag: 'calm', what: 'rings only' },
    { d: A2, tag: 'calm', what: 'breakdown: the hall opens, pylons in rows; SLIPSTREAM in the open on the ring line' },
    { d: B(53), tag: 'peak', what: 'THE HALL OF AUGURS: four predict in turn; the zigzag the rings show dodges every one' },
    { d: B(57.5), tag: 'calm', what: 'the snap-back lands on rings only; SHIELD CELL after the Hall' },
    { d: B(60), tag: 'rising', what: 'build two: the Hall again at full speed, with a sniper' },
    { d: B(63), tag: 'calm', what: 'lead-in: RING MAGNET on the line, two bars of rings' },
    { d: A3, tag: 'rising', what: 'drop two, faster: THE ORRERY draws in round you; augurs ride its arms' },
    { d: B(69), tag: 'peak', what: 'the hardest stretch: two augurs on the arms at once over dancing rings, a sniper and pods' },
    { d: B(77), tag: 'calm', what: 'rings only' },
    { d: B(81), tag: 'rising', what: 'the drive, faster: one of everything, a step less dense than the peak' },
    { d: B(87), tag: 'calm', what: 'outro: a last corkscrew through the Orrery to the line' },
  ],
  acts: { introduce: [0, A1], develop: [A1, A2], twist: [A2, A3], master: [A3, LENGTH] },
  build(R, L) {
    const { add, ring: one, line, sine, clearOfRings } = L;
    // an augur whose crosshair appears at bar `bar` (it passes you `at` seconds later)
    const aug = (bar, nx, ny, o = {}) => { const at = o.at ?? 3.2, d0 = B(bar); return add(d0 + C.speed(d0) * at, 'g3-augur', Object.assign({ nx, ny, at }, o)); };
    // a sniper that first sights at bar `bar`, standing on a prism pylon
    const snipe = (bar, nx, ny, o = {}) => {
      const at = o.at ?? 2.8, d0 = B(bar), d = d0 + C.speed(d0) * at;
      const ev = add(d, 'sniper', Object.assign({ nx, ny, at }, o));
      add(d, 'g3-l4-pylon', { nx, ny, dyM: -11.4, decor: true, s: 0.7 }); // its prism top just under the sniper's feet
      return ev;
    };
    // a pod in the lane, kept off the rings
    const podAt = (bar, nx, ny, o = {}) => { const d = B(bar); for (const [x, y] of [[nx, ny], [nx, ny + 0.3], [-nx, ny], [nx * 0.5, -ny]]) if (clearOfRings(d, x, y, 0.5)) return add(d, 'pod', Object.assign({ nx: x, ny: y }, o)); return null; };
    // rings end to end between two bars (rule 7: a ring is never far after a hit)
    const fill = (b0, b1, style) => {
      let d = B(b0); const end = B(b1); let k = 0;
      while (d < end - 70) {
        const pick = style === 'dance' ? 3 : (k + R.int(0, 3)) % 4; k++;
        if (pick === 0) d = line(d, R.range(-0.55, 0.55), R.range(-0.45, 0.45), R.range(-0.55, 0.55), R.range(-0.45, 0.45), 5, 24);
        else if (pick === 1) d = line(d, -0.6, R.range(-0.3, 0.3), 0.6, R.range(-0.3, 0.3), 6, 22);
        else if (pick === 2) d = line(d, R.range(-0.3, 0.3), 0.55, R.range(-0.3, 0.3), -0.5, 5, 24);
        else d = sine(d, 8, 24, R.range(0.45, 0.6), R.range(0.38, 0.5), R() * 6);
        d += 30;
      }
    };
    // a zigzag the rings draw: legs of `legBars` between x = +-amp, starting at bar b0 on side s0
    const zigzag = (b0, legs, legBars, amp, s0, ny = 0) => {
      for (let i = 0; i < legs; i++) {
        const d0 = B(b0 + i * legBars), d1 = B(b0 + (i + 1) * legBars), x0 = (i % 2 ? -s0 : s0) * amp, x1 = -x0, n = Math.max(4, Math.round((d1 - d0) / 26));
        for (let j = 0; j < n; j++) { const t = j / n; one(d0 + (d1 - d0) * t, x0 + (x1 - x0) * t, ny + Math.sin(t * Math.PI) * 0.15); }
      }
      return B(b0 + legs * legBars);
    };

    // ================= ACT 1: INTRODUCE (bars 1-24): THE OUTER DIAL =================
    line(B(1.5), 0, 0.2, 0, 0, 5, 26);
    sine(B(3), 8, 24, 0.4, 0.3, 1);
    // bar 6: the first augur. The rings drift you right while its big crosshair leads you; then they hold still, and its
    // bolt goes to where you would have been (the box's right edge). Nothing else can hurt yet (rule 4).
    aug(6, -1.35, 0.7, { r: 1.3, charge: 1.4, at: 3.4 });
    line(B(6), -0.55, 0, 0.25, 0.05, 6, 22);
    line(B(6) + 6 * 22 + 6, 0.25, 0.05, 0.25, 0.05, 6, 22);
    L.add(B(6.2), 'call', { text: 'IT SHOOTS WHERE YOU ARE GOING', cls: 'c-cyan' });
    sine(B(9.5), 8, 24, 0.45, 0.35, 2);
    // groove: one at a time. Each over a line that turns (follow it and the bolt misses), then over a straight one
    aug(11, 1.35, 0.5); line(B(11), 0.4, -0.2, -0.3, 0.1, 5, 24); line(B(11) + 130, -0.3, 0.1, 0.1, 0.4, 5, 24);
    aug(13.5, -1.35, -0.4); line(B(13.5), -0.3, 0.35, 0.45, 0.35, 5, 24); line(B(13.5) + 130, 0.45, 0.35, 0.45, -0.35, 5, 24);
    aug(16, 1.4, -0.6, { r: 1.15 }); line(B(16), -0.1, 0, -0.1, 0, 8, 24);   // a straight line: hold it and it hits you; step off
    // bar 18: the first to fly into: its crosshair leads you along a slanted line onto the next ring; roll in it
    aug(18.5, -1.35, 0.55, { r: 1.15 }); line(B(18.5), -0.5, -0.2, 0.3, 0.2, 8, 22);
    L.add(B(18.7), 'call', { text: 'FLY INTO THE RING AND ROLL', cls: 'c-cyan' });
    fill(21, 25);

    // ================= ACT 2: DEVELOP (bars 25-48): THE SEERS' GALLERY =================
    // build one: snipers alone (known from galaxy 1), then the pair: one at you, one ahead of you
    snipe(26, -1.3, 0.75); line(B(26), 0, 0, 0.4, 0.1, 6, 24);
    snipe(28, 1.3, -0.5); line(B(28), 0.2, 0.3, -0.3, 0, 6, 24);
    aug(30, -1.35, 0.4); snipe(30.3, 1.3, 0.7); line(B(30), -0.4, -0.2, 0.4, -0.2, 7, 24);
    fill(32, 34);
    // drop one (speed at bar 33; density from bar 34)
    aug(34, 1.35, 0.6); snipe(34.4, -1.3, -0.5); line(B(34), 0.3, 0.3, -0.3, -0.2, 7, 24);
    podAt(36, 0.3, 0.2, { shots: 2 }); line(B(36) + 40, -0.4, 0.2, 0.4, 0.2, 5, 22);
    // peak: pairs both sides, a pod in each
    aug(38, -1.35, -0.5); snipe(38.3, 1.3, 0.6); podAt(38.6, -0.2, 0.5); line(B(38), -0.5, 0, 0.5, 0.3, 8, 22);
    aug(40.5, 1.35, -0.4); aug(41, -1.35, 0.6, { at: 3.0 }); line(B(40.5), 0.4, -0.3, -0.4, 0.2, 5, 24); line(B(40.5) + 140, -0.4, 0.2, 0.3, 0.3, 5, 24);
    snipe(43, -1.3, 0.75); podAt(43.4, 0.4, -0.3, { shots: 2 }); line(B(43), -0.2, -0.3, 0.2, 0.3, 6, 24);
    fill(45, 49);

    // ================= ACT 3: TWIST (bars 49-64): THE HALL OF AUGURS =================
    // breakdown: the hall opens (rings only). SLIPSTREAM in the open, on the ring line, 2 s before the Hall: never within
    // 10 s of an Overclock or a Mirror Shell (there are none here), and a calm stretch after it for the snap-back
    line(B(49.5), 0, 0.2, 0, -0.1, 6, 26);
    line(B(51.2), -0.1, -0.1, -0.1, -0.1, 3, 22);
    add(B(51.2) + 3 * 22 + 12, 'slipstream', { nx: -0.1, ny: -0.1 });
    // THE HALL: legs of one bar, side to side; an augur sights at the start of each leg (from the side you fly toward),
    // fires as you cross the middle, and you turn before its bolt lands
    zigzag(53, 4, 1, 0.6, -1, 0.05);
    aug(53, 1.4, 0.55, { at: 3.0 }); aug(54, -1.4, 0.5, { at: 3.0 }); aug(55, 1.4, -0.5, { at: 3.0 }); aug(56, -1.4, -0.55, { at: 3.0 });
    // the snap-back lands on rings only; the Shield Cell after the Hall
    line(B(57.2), 0, 0, 0, 0.3, 5, 26);
    add(B(58.6), 'shield-cell', { nx: 0, ny: 0.3 }); line(B(58.6) + 24, 0, 0.3, 0.3, 0.3, 4, 24);
    // build two: the Hall at full speed, with a sniper (one at you, the rest ahead of you)
    zigzag(60, 3, 1, 0.55, 1, -0.1);
    aug(60, -1.4, 0.5, { at: 3.0 }); snipe(60.8, 1.3, 0.75); aug(61, 1.4, -0.5, { at: 3.0 }); aug(62, -1.4, -0.4, { at: 3.0 });
    // the lead-in: the RING MAGNET on the line, then the Orrery's dancing rings
    line(B(63.2), 0, 0, 0, 0, 3, 24);
    add(B(63.2) + 3 * 24 + 10, 'ring-magnet', { nx: 0, ny: 0 });

    // ================= ACT 4: MASTER (bars 65-88): THE ORRERY =================
    // the rings dance through its rings (wide corkscrews: every one reachable without the magnet); augurs ride its arms
    sine(B(65), 12, 22, 0.62, 0.5, 0);
    aug(66, 0, 0, { orbit: { r: 14, w: 0.35, a0: 0.4, ky: 0.62 } });
    sine(B(67.5), 12, 22, 0.55, 0.45, 2);
    aug(68.5, 0, 0, { orbit: { r: 15, w: -0.3, a0: 2.6, ky: 0.6 } });
    // the peak: two on the arms at once over the dancing rings, a sniper, pods
    sine(B(70), 16, 22, 0.6, 0.48, 1);
    aug(70.5, 0, 0, { orbit: { r: 14, w: 0.4, a0: 0, ky: 0.62 } }); aug(71, 0, 0, { orbit: { r: 15, w: 0.4, a0: Math.PI, ky: 0.62 } });
    snipe(73, 1.3, 0.75); podAt(73.5, -0.35, -0.3, { shots: 2 });
    aug(74.5, 0, 0, { orbit: { r: 14, w: -0.45, a0: 1.5, ky: 0.62 } }); sine(B(73.5), 14, 22, 0.5, 0.42, 3);
    fill(77, 81);
    // the drive: one of everything, a step less dense than the peak
    aug(81.5, -1.4, 0.55); line(B(81.5), -0.4, 0, 0.4, 0.2, 6, 26); line(B(81.5) + 170, 0.4, 0.2, 0.0, -0.3, 5, 26);
    snipe(83.5, 1.3, -0.5); podAt(84.5, 0.3, 0.4); sine(B(83.5), 10, 24, 0.5, 0.4, 4);
    aug(85.5, 0, 0, { orbit: { r: 14, w: 0.35, a0: 2, ky: 0.62 } }); line(B(85.5), 0.3, -0.2, -0.3, 0.3, 6, 26);
    // outro: a last corkscrew to the line
    sine(B(87.2), 12, 24, 0.5, 0.4, 0);
  },
});
