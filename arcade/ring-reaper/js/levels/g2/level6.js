// THE VERDANT DEEP, LEVEL 6: THE TANGLE, boss THE SNARE. A dead reef choked in red-seamed vine, arches of tangled coral,
// leeches hanging in them; hunted. The mother whale arrives at the end (Yori's look, looks/level-g2-06-the-tangle.png).
// HEADLINE (rule 20): leeches latch a tether onto you, so roll to snap it. The leech (js/enemies/g2-leech) aims a red
// line, shoots its tether and latches: you lose shield slowly and are dragged toward it until you roll (SNAPPED!, and
// the whip-back cracks its graft). A hit that isn't a moment but a state, and you have to end it.
// The boss (js/bosses/g2-snare) asks both of the act's lessons at once: intercept its volleys at the mother (level 4)
// and snap its tethers off her (this level).
//
// One schedule with the music (rule 30): audio/g2/level6/music is still to come from the sound branch (140 bpm planned,
// B minor, the Snare's key; galaxy 1's bar map). Until it lands a galaxy 1 take stands in. The bar grid here is the
// plan's 140 bpm with a first beat of 0.2 s: re-check FIRST_BEAT against the take's .json when it lands (check-levels
// reports the section starts in bars of the real grid).
import { defineLevel } from '../../api.js?v=0.6.2';
import ring from '../../pickups/ring/index.js?v=0.6.2';
import pod from '../../enemies/pod/index.js?v=0.6.2';
import seeker from '../../enemies/seeker-drone/index.js?v=0.6.2';
import { shieldCell, overclock, phase } from '../../pickups/powerups/index.js?v=0.6.2';
import leech, { LEECH } from '../../enemies/g2-leech/index.js?v=0.6.2';
import hound from '../../enemies/g2-hound/index.js?v=0.6.2';
import well from '../../obstacles/g2-gravity-well/index.js?v=0.6.2';
import whale from '../../allies/g2-whale/index.js?v=0.6.2';
import current from '../../obstacles/g2-current/index.js?v=0.6.2';
import thrummer, { pulse } from '../../enemies/g2-thrummer/index.js?v=0.6.2';
import snare from '../../bosses/g2-snare/index.js?v=0.6.2';
import tether from '../../bosses/g2-snare/tether.js?v=0.6.2';
import { clock } from './level4/clock.js?v=0.6.2';
import { SCENERY, DECOR, wall } from './level6/scenery.js?v=0.6.2';
import { herd, swimmer } from './level4/scenery.js?v=0.6.2';

const FIRST_BEAT = 0.2;
const C = clock({ bpm: 140, firstBeat: FIRST_BEAT, v0: 80, steps: [[24, 19], [48, 19], [64, 19], [70, 19]] });
const B = C.B;
const BOSS_AT = B(74);
// a leech latches (if nothing stops it) wait + tell + reach seconds after it has swum in beside you
const LATCH = LEECH.wait + LEECH.tel + LEECH.reach, LATCH_FIRST = LEECH.wait + LEECH.telFirst + LEECH.reachFirst;

export default defineLevel({
  g: 2, n: 6, id: 'tangle', name: 'THE TANGLE',
  idea: 'Leeches latch a tether onto you, so roll to snap it.',
  length: BOSS_AT + 900,
  speed: C.speed,
  music: { track: 'g2/level6/music' },
  bossMusic: 'g2/bosses/snare',
  // style minimums [grazes + close calls, deflects] for A, S, DEGENERATE, from the decent human bot (about 2 close and
  // 38 deflects a run, counting snapped tethers): the Tangle's style is the roll, so it asks next to no close calls
  style: { A: [0, 9], S: [1, 15], DEGENERATE: [1, 23] },
  sfx: [{ id: 'g2-leech-latch', gain: 0.6 }, { id: 'g2-tether-snap', gain: 0.7 }, { id: 'g2-graft-crack', gain: 0.7 }, { id: 'g2-hound-bolt', gain: 0.5 }, { id: 'g2-intercept', gain: 0.7 }, { id: 'g2-mother-song', gain: 0.8 }, { id: 'g2-boss-freed', gain: 0.9 }, { id: 'g2-well-pull', gain: 0.5 }, { id: 'g2-slingshot', gain: 0.7 }],
  sections: [
    { id: 'reef', name: 'THE DEAD REEF', sub: 'SECTOR 1', d0: 0, d1: B(24), scenery: { 'g2-l6-motes': 1, 'g2-l6-vines': 0.7, 'g2-l6-reefs': 1, 'g2-l6-arches': 0.3, 'g2-l6-deadreef': 1 } },
    { id: 'tangle', name: 'THE TANGLE', sub: 'SECTOR 2', d0: B(24), d1: B(48), scenery: { 'g2-l6-motes': 1, 'g2-l6-vines': 1, 'g2-l6-reefs': 0.8, 'g2-l6-arches': 0.4, 'g2-l6-deadreef': 1 } },
    { id: 'drag', name: 'THE DRAG', sub: 'SECTOR 3', d0: B(48), d1: B(64), scenery: { 'g2-l6-motes': 1, 'g2-l6-vines': 0.8, 'g2-l6-reefs': 0.8, 'g2-l6-arches': 0.3, 'g2-l6-deadreef': 0.7, 'g2-l4-herd': 0.6 } },
    { id: 'briar', name: 'THE BRIAR GATE', sub: 'FINAL STRETCH', d0: B(64), d1: BOSS_AT + 900, scenery: { 'g2-l6-motes': 1, 'g2-l6-vines': 1, 'g2-l6-reefs': 0.6, 'g2-l6-arches': (t) => (t < 0.55 ? 1 : 0.3), 'g2-l6-deadreef': 1, 'g2-l4-herd': 0.4 } },
  ],
  // Yori's palette (palettes.js, level 6): sky #0a0c08, gas #3a5a1a #6a2a1a #1a2a1a, fog #121a0c, key #c8e0b0, fill #2a3a1a
  looks: {
    reef: { sky: ['#0a0c08', 'rgba(58,90,26,A)', 'rgba(106,42,26,A)', 'rgba(26,42,26,A)'], fog: 0x121a0c, hemiSky: 0xc8e0b0, hemiGround: 0x2a3a1a, sun: 0xc8e0b0, band: 0.45, gas: 0.6, cloud: 0x3a5a1a, clouds: 0.2, seed: 2601 },
    tangle: { sky: ['#090b07', 'rgba(54,84,24,A)', 'rgba(100,40,24,A)', 'rgba(24,40,24,A)'], fog: 0x10180a, hemiSky: 0xc0d8a8, hemiGround: 0x283818, sun: 0xc8e0b0, band: 0.5, gas: 0.65, cloud: 0x3a5a1a, clouds: 0.22, seed: 2602 },
    drag: { sky: ['#0a0d09', 'rgba(62,96,30,A)', 'rgba(112,46,28,A)', 'rgba(28,46,30,A)'], fog: 0x131c0e, hemiSky: 0xd0e8b8, hemiGround: 0x2c3e1c, sun: 0xd8ecc0, band: 0.5, gas: 0.65, cloud: 0x4a6a2a, clouds: 0.24, seed: 2603 },
    briar: { sky: ['#080a06', 'rgba(50,80,22,A)', 'rgba(120,48,26,A)', 'rgba(22,36,20,A)'], fog: 0x0e1608, hemiSky: 0xc0d8a8, hemiGround: 0x283818, sun: 0xc8e0b0, band: 0.55, gas: 0.7, cloud: 0x3a5a1a, clouds: 0.26, seed: 2604 },
  },
  kinds: [ring, pod, seeker, leech, hound, well, whale, tether, wall, current, thrummer, pulse, shieldCell, overclock, phase, ...DECOR, swimmer],
  scenery: [...SCENERY, herd],
  boss: { at: BOSS_AT, def: snare, then: 'finish' },
  beats: [
    { d: 0, tag: 'calm', what: 'bar 0, intro: rings down the dead reef, thornvine walls closing in' },
    { d: B(6), tag: 'calm', what: 'bar 6, groove: the first leech, alone and far off; its tether reaches slowly and latches only if you do nothing' },
    { d: B(10), tag: 'rising', what: 'bars 10-22: single leeches either side, a pod, a hound firing at you from the edge, a well' },
    { d: B(24), tag: 'calm', what: 'bar 24: speed step; rings' },
    { d: B(26), tag: 'rising', what: 'bars 26-32, build one: leeches in pairs on both sides: snap one while the other aims' },
    { d: B(33.4), tag: 'peak', what: 'bar 33, DROP one: OVERCLOCK, then a leech pair with a seeker barrage behind it: snap, snap, send' },
    { d: B(38), tag: 'rising', what: 'bars 38-45: a leech beside a well, its drag and the well\'s pull together; pods and a hound' },
    { d: B(45.5), tag: 'calm', what: 'bars 45-48: breather' },
    { d: B(48), tag: 'calm', what: 'bar 48, breakdown: speed step; a whale of the herd swims up beside the lane' },
    { d: B(50), tag: 'rising', what: 'bars 50-54: TWIST, leeches latch onto the whales and drag them; their tethers cross your lane: fly through and roll' },
    { d: B(55.6), tag: 'rising', what: 'bars 55-58: PHASE, then a coral wall with a violet crack: through it, a cache' },
    { d: B(59), tag: 'peak', what: 'bars 59-62, build two: whales dragged on the other side, leeches on you as well: the hardest stretch' },
    { d: B(62.5), tag: 'calm', what: 'bars 62-64: calm' },
    { d: B(64.5), tag: 'peak', what: 'bars 64-69, SET PIECE: THE BRIAR GATE, a cathedral of tangled coral, leeches hanging in the arches' },
    { d: B(70), tag: 'calm', what: 'bar 70: speed step; a calm; the mother whale arrives, hunted; a SHIELD CELL at the Snare\'s entrance' },
    { d: BOSS_AT, tag: 'peak', what: 'bar 74: THE SNARE (its own track cuts in on the bar)' },
  ],
  acts: { introduce: [0, B(24)], develop: [B(24), B(48)], twist: [B(48), B(64)], master: [B(64), BOSS_AT] },
  build(R, L) {
    const { add, line, sine } = L;
    const call = (bar, text, cls = 'c-cyan') => add(B(bar), 'call', { text, cls });
    // a leech that latches on `bar` if nothing stops it
    // galaxy 2's kinds from the levels before (g2-a's): a current to ride or be carried by, a drum's pulse (fly its
    // hole or roll as it meets you: PARRY), a shoal of ring-fish, a drifter. Laid as their own levels lay them.
    const ribbon = (b0, bars, path, o = {}) => { const d = B(b0), len = B(b0 + bars) - d; return add(d, 'g2-current', Object.assign({ len, ride: true, w: 0.34, path: path.map(([bb, x, y]) => [B(b0 + bb) - d, x, y]), seed: Math.round(d) }, o)); };
    const drum = (beat, meet, nx, ny, hole) => add(B(meet) + 150, 'g2-thrummer', { nx, ny, s: 3, pulses: [{ beat: B(beat), meet: B(meet), tell: B(beat) - B(beat - 1), hole: hole ? { a: hole[0], w: hole[1] } : null }] });
    const holeAt = (a) => [Math.round(Math.cos(a) * 0.66 * 100) / 100, Math.round(Math.sin(a) * 0.68 * 100) / 100];
    const lee = (bar, side, ny, o = {}) => add(C.at(bar, -(o.first ? LATCH_FIRST : LATCH)), 'g2-leech', Object.assign({ side, ny }, o));

    // ================= ACT 1, INTRODUCE: THE DEAD REEF (bars 0-24, 80 m/s) =================
    line(240, 0, -0.25, 0, 0.25);
    sine(520, 8, 26, 0.35, 0.3);
    // the first leech, alone (rule 18): far off, a slower aim and reach; it latches only if you do nothing
    call(5.4, 'A LEECH. IF ITS TETHER CATCHES YOU, ROLL', 'c-red');
    lee(7.5, 1, 0.1, { first: true, z: -18, tries: 1 });
    line(B(6.6), -0.3, -0.1, -0.4, 0.2, 5, 26);
    lee(11, -1, -0.2);
    line(B(10.4), 0.3, 0.2, 0.4, -0.2, 5, 26);
    add(B(13.4), 'pod', { nx: 0.3, ny: 0.5 });
    line(B(13.6), -0.3, -0.3, 0.2, -0.3, 4, 26);
    lee(16, 1, 0.35);
    add(C.at(16.8, -2.0), 'g2-hound', { side: -1, ny: -0.3, shots: ['ship'] });
    line(B(15.6), -0.2, 0, 0.3, 0.1, 5, 26);
    lee(19.5, -1, 0);
    add(B(21.2), 'g2-gravity-well', { nx: 0.95, ny: 0.2, rn: 0.36 }); line(B(21.2) - 52, 0.2, 0, 0.48, 0.2, 3, 26);
    sine(B(22.2), 6, 28, 0.3, 0.25);

    // ================= ACT 2, DEVELOP: THE TANGLE (bars 24-48, 99 m/s) =================
    line(B(24.3), -0.3, 0, 0.3, 0, 5, 26);
    // leeches in pairs on both sides: one latches while the other aims
    lee(26.5, 1, 0.3); lee(27.2, -1, -0.3);
    line(B(25.8), 0, 0.3, 0, -0.3, 5, 26);
    lee(30, -1, 0.35); lee(30.7, 1, -0.25);
    line(B(29.4), 0.3, 0, -0.3, 0, 5, 26);
    // OVERCLOCK on the ring line, then a leech pair with a seeker barrage behind it: snap, snap, send
    line(B(32.2), 0, -0.3, 0, 0, 3, 24);
    add(B(32.9), 'overclock', { nx: 0, ny: 0 });
    lee(34.2, 1, 0.2); lee(34.5, -1, -0.2);
    add(C.at(34.8, -3.2), 'seeker-drone', { nx: 0.1, ny: 0.55, shots: 3, hold: 110 });
    line(B(33.6), -0.2, 0.3, 0.2, 0.3, 5, 26);
    // a leech beside a well: its drag and the well's pull together
    add(B(38.4), 'g2-gravity-well', { nx: 1.0, ny: -0.2, rn: 0.38 }); lee(38.4, 1, 0.3);
    // a drum on the dead reef: its pulse meets you on bar 37; fly its hole (left) or roll as it meets you
    drum(36, 37, 1.8, -0.3, [Math.PI, 1.7]); { const h = holeAt(Math.PI); line(B(37) - 66, h[0] * 0.5, h[1], h[0], h[1], 3, 22); }
    line(B(37.6), -0.35, 0, -0.3, 0.3, 5, 26);
    add(B(41), 'pod', { nx: -0.35, ny: 0.5, shots: 2 }); lee(41.6, 1, -0.3);
    add(B(40.9), 'g2-current', { len: B(42.4) - B(40.9), fx: 0.2, fy: 0 });   // a current the same way as the leech's drag
    line(B(40.6), 0.3, -0.2, 0.1, 0.3, 5, 26);
    add(C.at(43.6, -2.0), 'g2-hound', { side: 1, ny: 0.3, shots: ['ship', 'ship'], gap: 2.0 }); lee(44, -1, 0.1);
    sine(B(45.6), 8, 26, 0.4, 0.3);

    // ================= ACT 3, TWIST: THE DRAG (bars 48-64, 118 m/s) =================
    line(B(48.3), 0, 0.3, 0, -0.3, 5, 26);
    // a whale of the herd swims up beside the lane; leeches on the far side latch onto it and drag it out. Their tethers
    // cross your lane: fly through one and roll to snap it, and the whale swims free
    // (the whales swim level with you and the leeches close to your plane, so a tether crosses the middle of the lane;
    // the rings run in to where it crosses, about 0.55 of the way to the whale's side, and sit there while it holds)
    const crossing = (bar, side, ny) => { const nx = 0.55 * side, d = C.at(bar, LATCH - LEECH.wait); line(d - 66, nx * 0.3, ny + 0.3, nx, ny, 3, 22); line(d + 20, nx, ny, nx, ny, 3, 30); };
    add(B(49), 'g2-whale', { side: -1, len: 28, life: 14, z: -5 });
    call(50.2, 'THEY ARE ON THE WHALE: FLY THROUGH THE LINE AND ROLL', 'c-red');
    lee(51, 1, 0.1, { target: 'whale', z: -1.5 }); crossing(51, -1, 0.2);
    lee(53.5, 1, -0.35, { target: 'whale', z: -1.5 }); crossing(53.5, -1, -0.05);
    // PHASE, then a coral wall across most of the lane with the violet crack on it: through it, a cache (rings beyond
    // the count, never part of a star; two clues: the crack, and a ring trail running in). Round it on the right is free.
    line(B(55), 0, 0.3, -0.2, 0.1, 3, 24);
    add(B(55.6), 'phase', { nx: -0.25, ny: 0.05 });
    add(B(57), 'g2-l6-wall', { nx: -0.35, ny: 0, wn: 1.3, hn: 2.4, crack: [-0.45, 0] });
    for (const dz of [-54, -32]) L.ring(B(57) + dz, -0.45, 0, 'ring', { cache: true, noMagnet: true });
    for (const dz of [14, 36, 58]) L.ring(B(57) + dz, -0.45, 0, 'ring', { cache: true, noMagnet: true });
    line(B(57) - 70, 0.35, 0.1, 0.65, 0, 4, 24); line(B(57) + 30, 0.65, 0, 0.3, 0, 3, 24);
    // build two, the hardest stretch: whales dragged on the other side, and leeches on you at the same time
    add(B(58.2), 'g2-whale', { side: 1, len: 30, life: 12, z: -5 });
    lee(59.6, -1, 0.2, { target: 'whale', z: -1.5 }); crossing(59.6, 1, 0.3);
    lee(60.4, 1, -0.4, { nx: 1.15 });
    lee(61.2, -1, -0.3, { target: 'whale', z: -1.5 }); crossing(61.2, 1, 0);
    add(B(60), 'pod', { nx: 0.4, ny: 0.55 });
    line(B(58.6), 0.2, -0.3, 0.4, -0.2, 3, 26);
    sine(B(62.4), 6, 28, 0.3, 0.25);

    // ================= ACT 4, MASTER: THE BRIAR GATE (bars 64-74, 137 then 156 m/s) =================
    // a cathedral of tangled coral (the arches thicken), leeches hanging in the arches, dense
    call(64.3, 'THE BRIAR GATE', 'c-red');
    for (let b = 64.6; b < 69.4; b += 0.9) add(B(b), 'g2-l6-arch', { x: 0, y: 0, s: 1.15, rx: 0, ry: 0, rz: (b % 2) * 0.06 - 0.03 });
    lee(65.4, 1, 0.75, { nx: 1.15 });
    lee(66.2, -1, 0.7, { nx: 1.15 });
    lee(67, 1, -0.2); lee(67.5, -1, 0.3);
    lee(68.6, 1, 0.6, { nx: 1.15 });
    add(B(66), 'seeker-drone', { nx: -0.2, ny: 0.6, shots: 2, hold: 120 });
    line(B(64.6), 0, 0, 0, -0.3, 5, 28); line(B(66.4), 0.2, -0.3, -0.2, -0.2, 5, 28); line(B(68.2), -0.2, 0, 0.2, 0.1, 5, 28);
    // a calm; then the mother whale arrives, hunted. A Shield Cell at the Snare's entrance (the one boss exception).
    sine(B(70.2), 6, 30, 0.3, 0.25);
    call(71.6, 'THE MOTHER. SOMETHING IS HUNTING HER', 'c-red');
    add(B(72), 'g2-whale', { side: -1, len: 44, life: Infinity, nx: -1.7, ny: 0.05, z: -12, mother: true });
    line(B(72.3), 0, 0.2, 0, 0, 3, 30);
    add(B(73), 'shield-cell', { nx: 0, ny: 0 });
  },
  outro: null,
});
