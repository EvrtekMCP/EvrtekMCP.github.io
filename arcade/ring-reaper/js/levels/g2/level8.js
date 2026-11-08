// GALAXY 2, LEVEL 8: ANGLER'S DEEP (the plan, projects/starwake-galaxies.md 3.8; Yori's look sheet level-g2-08).
// THE HEADLINE (rule 20): take the lure if you dare: the jaws close behind it. Huge grafted ANGLERS lie along the lane in
// the dark; each dangles a real amber ring (an extra: LURE!, three rings' worth) in front of its open mouth. Take it and
// the jaws close, the angler lunges, and one cheek gap stays open, lit green, on the side toward the open lane: steer
// out through it. Or fly round its head and miss nothing. Lure rings never count toward a star.
// The galaxy's darkest level, and still readable (rule 16): every angler is lit by its lure, its eyes and its red seams.
//
// THE MUSIC (rule 30): g2/level8/music, dark deep techno, 144 bpm, G minor, 94 bars planned, energy 7 (9 on the drop).
// A galaxy 1 stand-in plays until the take lands; then set BPM and FIRST_BEAT from its .json. Bars count from 0.
//   ACT 1  THE DARK WATER      bars  0-24   86 m/s  a lure on a stalk alone; then one angler, jaws closing slowly
//   ACT 2  THE LURE LINE       bars 24-48  108 m/s  anglers in pairs (one each side, one after the other); pods, seekers
//   ACT 3  THE FALSE FLOOR     bars 48-64  126 m/s  the floor ahead is a jaw: the rings lead out of its cheek; PHASE and
//                                                   a deep angler with a SHIELD CELL between its teeth; OVERCLOCK
//   ACT 4  THE ABYSSAL GARDEN  bars 64-80  144 m/s  SET PIECE: a field of lures, each a choice, bloomers on both slopes
//          THE LANTERN LIGHT   bars 80-92  162 m/s  the last anglers, then calm, and out toward the Murmuration's light
import { defineLevel, clamp } from '../../api.js?v=0.5.0';
import ring from '../../pickups/ring/index.js?v=0.5.0';
import { phase, shieldCell, overclock } from '../../pickups/powerups/index.js?v=0.5.0';
import pod from '../../enemies/pod/index.js?v=0.5.0';
import seeker from '../../enemies/seeker-drone/index.js?v=0.5.0';
import bloomer from '../../enemies/g2-bloomer/index.js?v=0.5.0';
import angler, { LURE_LEAD, KZ, lurePoint } from '../../enemies/g2-angler/index.js?v=0.5.0';
import { abyssSlope, lureStalk, slopes, motes, greatLantern } from './level8/scenery.js?v=0.5.0';

const BPM = 144, FIRST_BEAT = 0, BAR_S = 240 / BPM;
const STEPS = [[0, 86], [24, 108], [48, 126], [64, 144], [80, 162]];
const END_BAR = 92;
const BAR_D = (() => {
  const vAtT = (tt) => { const b = (tt - FIRST_BEAT) / BAR_S; let v = STEPS[0][1]; for (let i = 1; i < STEPS.length; i++) { const k = clamp((b - STEPS[i][0]) / 0.5, 0, 1); v += (STEPS[i][1] - STEPS[i - 1][1]) * k * k * (3 - 2 * k); } return v; };
  let d = FIRST_BEAT * STEPS[0][1], t = FIRST_BEAT; const out = [d];
  for (let bar = 1; bar <= END_BAR + 8; bar++) { const t1 = FIRST_BEAT + bar * BAR_S; while (t < t1) { const h = Math.min(0.005, t1 - t); d += vAtT(t + h / 2) * h; t += h; } out.push(d); }
  return out;
})();
export const BAR = (b) => { const i = clamp(Math.floor(b), 0, BAR_D.length - 2), f = b - i; return BAR_D[i] + (BAR_D[i + 1] - BAR_D[i]) * f; };
const stepD = STEPS.map(([b, v]) => [BAR(b), BAR(b + 0.5), v]);
function speed(d) { let v = STEPS[0][1]; for (let i = 1; i < stepD.length; i++) { const k = clamp((d - stepD[i][0]) / (stepD[i][1] - stepD[i][0]), 0, 1); v += (stepD[i][2] - stepD[i - 1][2]) * k * k * (3 - 2 * k); } return v; }

const A1 = BAR(24), A2 = BAR(48), A3 = BAR(64), A4 = BAR(80), LEVEL_END = BAR(END_BAR);
const FIRE_D = 290;
// an angler's span along the lane, from its lure to past its throat (a bitten one lunges: its throat comes late)
const SPAN_IN = LURE_LEAD + 10, SPAN_OUT = 35 * KZ + 120;

// Yori's palette for Angler's Deep: sky 030408, gas 0a1a2a / 1a1030 / 061a14, fog 04080c, key a0c0b0, fill 0a1a1a,
// accent f0ffc0. The darkest level in the galaxy; it lightens toward the Murmuration's pearl at the end.
const look = (sky, a, b, c, fog, o = {}) => Object.assign({ sky: [sky, 'rgba(' + a + ',A)', 'rgba(' + b + ',A)', 'rgba(' + c + ',A)'], fog, hemiSky: 0xa0c0b0, hemiGround: 0x0a1a1a, sun: 0xa0c0b0, band: 0.42, gas: 0.55, cloud: 0x1a3040, clouds: 0.12, starGlow: 0.55, hemiPower: 0.9 }, o);

export default defineLevel({
  g: 2, n: 8, id: 'anglers', name: "ANGLER'S DEEP",
  idea: 'Take the lure if you dare: the jaws close behind it.',
  seed: 208008,
  length: LEVEL_END,
  speed,
  music: { track: 'g2/level8/music' },
  bossMusic: null,
  sfx: [{ id: 'g2-lure', gain: 0.7 }, { id: 'g2-jaws', gain: 0.7 }, { id: 'g2-bloom', gain: 0.6 }, { id: 'g2-graft-crack', gain: 0.6 }],
  // style minimums [grazes + close calls, deflects], from the decent human bot (11-07, seeds 1-3: close 3, 9 and 4,
  // deflects 30, 33 and 30): A about a quarter, S 40%, DEGENERATE 60%. The deep has few near misses; the roll is its style.
  style: { A: [1, 8], S: [2, 12], DEGENERATE: [3, 19] },
  sections: [
    { id: 'dark', name: 'THE DARK WATER', sub: 'SECTOR 1', d0: 0, d1: A1, look: 'dark', scenery: { 'g2-l8-slopes': 1, 'g2-l8-motes': 1, 'g2-l8-lantern': 1 } },
    { id: 'lures', name: 'THE LURE LINE', sub: 'SECTOR 2', d0: A1, d1: A2, look: 'lures', scenery: { 'g2-l8-slopes': 1, 'g2-l8-motes': 1, 'g2-l8-lantern': 1 } },
    { id: 'floor', name: 'THE FALSE FLOOR', sub: 'SECTOR 3', d0: A2, d1: A3, look: 'floor', scenery: { 'g2-l8-slopes': 0.7, 'g2-l8-motes': 1, 'g2-l8-lantern': 0.8 } },
    { id: 'garden', name: 'THE ABYSSAL GARDEN', sub: 'SECTOR 4', d0: A3, d1: A4, look: 'garden', scenery: { 'g2-l8-slopes': 1, 'g2-l8-motes': 1, 'g2-l8-lantern': 1 } },
    { id: 'lantern', name: 'THE LANTERN LIGHT', sub: 'SECTOR 5', d0: A4, d1: LEVEL_END, look: 'lantern', scenery: { 'g2-l8-slopes': 0.6, 'g2-l8-motes': 1, 'g2-l8-lantern': 1 } },
  ],
  looks: {
    dark: look('#030408', '10,26,42', '26,16,48', '6,26,20', 0x04080c, { seed: 2801 }),
    lures: look('#03050a', '26,16,48', '10,26,42', '6,26,20', 0x050a0e, { seed: 2802, gas: 0.6 }),
    floor: look('#020306', '6,26,20', '10,26,42', '26,16,48', 0x030608, { seed: 2803, gas: 0.45, band: 0.35 }),
    garden: look('#04060a', '10,26,42', '6,26,20', '26,16,48', 0x060c10, { seed: 2804, gas: 0.65 }),
    // the way out: the Murmuration's pearl and lavender (its palette) begin to show
    lantern: look('#0a0c1a', '42,58,106', '138,122,176', '10,26,42', 0x14182a, { seed: 2805, gas: 0.6, hemiSky: 0xc8d0e0, sun: 0xe0e8f0, cloud: 0x3a4a6a, clouds: 0.16, starGlow: 0.8 }),
  },
  kinds: [ring, phase, shieldCell, overclock, pod, seeker, bloomer, angler, abyssSlope, lureStalk],
  scenery: [slopes, motes, greatLantern],
  boss: null,
  beats: [
    { d: 0, tag: 'calm', what: 'intro: the Dark Water, rings in the dark, the Great Lantern far below' },
    { d: BAR(6), tag: 'calm', what: 'a lure alone: a ring on a stalk in the dark (take it: an extra)' },
    { d: BAR(11), tag: 'rising', what: 'the first angler, jaws closing slowly: take it or leave it' },
    { d: BAR(17), tag: 'rising', what: 'a second angler on the other side; a pod' },
    { d: BAR(22.5), tag: 'calm', what: 'rings only' },
    { d: A1, tag: 'calm', what: 'build one, speed step: the Lure Line' },
    { d: BAR(32), tag: 'peak', what: 'drop one: anglers in pairs, one each side; pods and seekers between' },
    { d: BAR(44.5), tag: 'calm', what: 'rings only' },
    { d: A2, tag: 'calm', what: 'breakdown, speed step: the deep goes quiet' },
    { d: BAR(51.5), tag: 'peak', what: 'TWIST, THE FALSE FLOOR: the floor ahead is a jaw; the rings lead out of its cheek' },
    { d: BAR(56), tag: 'calm', what: 'out of the jaw; PHASE on the ring line' },
    { d: BAR(58.5), tag: 'rising', what: 'the deep angler: no cheek gap, a Shield Cell glowing between its teeth (phase through to take it)' },
    { d: BAR(61.5), tag: 'calm', what: 'OVERCLOCK on the ring line' },
    { d: A3, tag: 'peak', what: 'drop two, SET PIECE THE ABYSSAL GARDEN: a field of lures, bloomers firing from both slopes' },
    { d: BAR(77), tag: 'calm', what: 'the garden falls behind' },
    { d: A4, tag: 'rising', what: 'the drive, speed step: the last anglers, a step less dense' },
    { d: BAR(86.5), tag: 'calm', what: 'calm, and out into the pale light ahead (the Murmuration)' },
  ],
  acts: { introduce: [0, A1], develop: [A1, A2], twist: [A2, A3], master: [A3, LEVEL_END] },
  build(R, L) {
    const { add, line, sine, clearOfRings } = L;
    // ---- the anglers: where each one's footprint lies, so the counted rings keep to the open side (no ring that
    // counts is ever inside a mouth)
    const spans = []; let keyN = 0;
    // an angler whose lure is reached on `bar`, lying on `side`; kind 'side' (the usual), 'deep' (no gap), 'floor'
    const anglerAt = (bar, side, o = {}) => {
      const kind = o.kind || 'side', key = 'a' + (++keyN), dl = BAR(bar), d = dl + LURE_LEAD, lp = lurePoint(kind, side);
      add(d, 'g2-angler', Object.assign({ key, kind, side }, o));
      if (kind !== 'deep' && !o.noLure) add(dl, 'ring', { nx: lp.nx, ny: lp.ny, cache: true, lureOf: key });
      spans.push({ d0: dl - 40, d1: d + SPAN_OUT, side, kind });
      return { d, dl, key };
    };
    const blockedAt = (d) => spans.filter((s) => d > s.d0 && d < s.d1);
    const bloom = (bar, nx, ny, o = {}) => {
      const d = BAR(bar) + (o.fireAt ?? FIRE_D);
      for (const [x, y] of [[nx, ny], [nx, ny + 0.3], [nx, ny - 0.3]]) if (clearOfRings(d, x, y, 0.42)) return add(d, 'g2-bloomer', Object.assign({ nx: x, ny: clamp(y, -0.82, 0.82) }, o));
      return add(d, 'g2-bloomer', Object.assign({ nx, ny }, o));
    };
    const seekerAt = (bar, nx, ny, o = {}) => add(BAR(bar) - 3.9 * speed(BAR(bar)), 'seeker-drone', Object.assign({ nx, ny, shots: 2 }, o));
    const podAt = (bar, nx, ny, o = {}) => add(BAR(bar) + 300, 'pod', Object.assign({ nx, ny }, o));
    // ring patterns between two bars, at a spacing that follows the speed; beside an angler they keep to the open side
    const rings = (b0, b1, style) => {
      let d = BAR(b0); const end = BAR(b1); let k = 0;
      while (d < end - 60) {
        const v = speed(d), st = Math.max(22, v * 0.19), a = v > 130 ? 0.8 : 1;
        const near = blockedAt(d).concat(blockedAt(d + st * 6));
        let next;
        if (near.some((s) => s.kind === 'floor')) { d += st * 2; continue; }        // the false floor lays its own
        if (near.length) {
          // keep to the side with no mouth: x on the open side (or the middle tenth if both sides have one)
          const sides = new Set(near.map((s) => s.side)), open = sides.size > 1 ? 0 : -[...sides][0];
          const x0 = open * R.range(0.4, 0.62), x1 = open * R.range(0.4, 0.62);
          next = (k++ % 2) ? line(d, x0, R.range(-0.5, 0.55), x1, R.range(-0.5, 0.55), 5, st) : sine(d, 8, st, 0.14, 0.42, R() * 6, x0, 0);
        } else {
          const pick = style === 'swirl' ? 3 : (k + R.int(0, 3)) % 5; k++;
          if (pick === 0) next = line(d, R.range(-0.6, 0.6) * a, R.range(-0.5, 0.5) * a, R.range(-0.6, 0.6) * a, R.range(-0.5, 0.5) * a, 5, st);
          else if (pick === 1) next = line(d, -0.6 * a, R.range(-0.3, 0.4), 0.6 * a, R.range(-0.3, 0.4), 6, st);
          else if (pick === 2) next = line(d, R.range(-0.3, 0.3), 0.6 * a, R.range(-0.3, 0.3), -0.55 * a, 5, st);
          else if (pick === 3) next = sine(d, v > 130 ? 10 : 8, st, R.range(0.4, 0.55) * a, R.range(0.34, 0.46) * a, R() * 6);
          else next = line(d, R.sign() * 0.6 * a, R.sign() * 0.5 * a, 0, 0, 5, st);
        }
        d = Math.min(end, next) + v * R.range(0.75, 1.1);
      }
    };

    // ======== the anglers first (the rings keep clear of them) ========
    // ACT 1: the first, jaws closing slowly (take it or leave it); then one on the other side
    anglerAt(11.5, 1, { slow: true });
    anglerAt(17.5, -1);
    // ACT 2: pairs, one each side, one after the other
    anglerAt(26.5, 1); anglerAt(28.0, -1);
    anglerAt(33.0, -1); anglerAt(34.5, 1);
    anglerAt(38.5, 1); anglerAt(40.0, -1);
    anglerAt(42.5, -1);
    // ACT 3: THE FALSE FLOOR (its lure on top, its cheek low on the left: the rings lead out through it)
    const floor = anglerAt(51.6, 1, { kind: 'floor' });
    // the deep angler: no gap, a SHIELD CELL between its teeth (glow and a violet crack are its clues)
    const deep = anglerAt(59.0, 1, { kind: 'deep' });
    // ACT 4: THE ABYSSAL GARDEN: a field of lures, each one a choice
    [[64.6, 1], [65.9, -1], [67.2, 1], [68.5, -1], [69.8, 1], [71.1, -1], [72.6, 1], [74.0, -1]].forEach(([b, s]) => anglerAt(b, s));
    // THE LANTERN LIGHT: the last two
    anglerAt(81.0, -1); anglerAt(83.6, 1);

    // ======== ACT 1, THE DARK WATER (introduce): a lure alone, harmless (rules 4, 17, 18)
    rings(0.6, 5.4, 'mixed');
    add(BAR(5.2), 'call', { text: 'A LURE. TAKE IT', cls: 'c-gold' });
    // the lone lure: her stalk rising out of the dark, the real ring (an extra) at its tip, on the ring line
    add(BAR(6.4), 'g2-l8-stalk', { nx: 0.2, ny: 0.1 });
    add(BAR(6.4), 'ring', { nx: 0.2, ny: 0.1, cache: true });
    line(BAR(5.9), -0.2, 0.0, 0.2, 0.1, 3, 22); line(BAR(6.4) + 22, 0.25, 0.1, 0.4, 0.2, 3, 22);
    rings(7.4, 11.0, 'mixed');
    add(BAR(10.0), 'call', { text: 'TAKE THE LURE IF YOU DARE', cls: 'c-gold' });
    rings(11.0, 22.4, 'mixed');
    // the slopes below the lane: bloomers (Bloomfall's seeds, known now) fire up out of the dark: the roll's work here
    const slopeBloom = (b, nx, o = {}) => add(BAR(b) + FIRE_D, 'g2-bloomer', Object.assign({ nx, ny: -1.3, s: 1.4 }, o));
    slopeBloom(8.6, 0.0); slopeBloom(13.6, -0.5); slopeBloom(16.0, 0.5);
    podAt(14.6, -0.5, 0.45, { bursts: 1 });
    slopeBloom(19.2, -0.4, { seeds: 2, gap: 1.3 });
    podAt(20.6, 0.5, 0.5, { bursts: 1 });
    rings(22.6, 24, 'swirl');

    // ======== ACT 2, THE LURE LINE (develop). Build one 24-32, drop one 32-48
    rings(24.2, 44.6, 'mixed');
    slopeBloom(25.4, 0.0); slopeBloom(27.2, -0.6); slopeBloom(27.2, 0.6);
    slopeBloom(29.4, 0.3, { seeds: 2, gap: 1.2 });
    slopeBloom(32.6, -0.6); slopeBloom(32.6, 0.6);
    slopeBloom(35.2, 0.0, { seeds: 2, gap: 1.2 });
    slopeBloom(39.4, -0.5); slopeBloom(39.4, 0.5);
    slopeBloom(42.0, 0.0, { seeds: 2, gap: 1.2 });
    seekerAt(30.4, -0.3, 0.5);
    podAt(31.4, 0.0, 0.6, { bursts: 1 });
    seekerAt(36.6, 0.0, 0.55);
    bloom(37.2, 0.0, -0.75);
    podAt(41.4, 0.2, 0.6, { bursts: 1 });
    seekerAt(44.0, -0.4, 0.5);
    rings(44.8, 48, 'swirl');

    // ======== ACT 3, THE FALSE FLOOR (twist). Breakdown 48-56: the deep goes quiet, then the floor opens its jaw
    rings(48.2, 50.4, 'mixed');
    add(BAR(50.2), 'call', { text: 'THE FLOOR IS A JAW', cls: 'c-red' });
    // the ring line: from under its lure (top middle) down and out to its cheek (low left), and along the cheek until
    // its throat has gone by (a bitten angler lunges, so the throat comes late)
    {
      const dl = floor.dl, lp = lurePoint('floor', 1);
      line(dl - 70, 0, 0.25, lp.nx, lp.ny - 0.2, 3, 26);
      line(dl + 10, -0.05, 0.68, -0.72, -0.56, 6, 22);                   // straight down from under its lure to the cheek
      line(dl + 10 + 6 * 22, -0.72, -0.56, -0.72, -0.56, 11, 26);     // and along the cheek until the throat has gone by
    }
    rings(53.8, 58.3, 'mixed');                                     // (the floor's own line ends about bar 53.6)
    slopeBloom(54.6, -0.5); slopeBloom(54.6, 0.5); slopeBloom(56.4, 0.0);
    // PHASE on the ring line, 2 s before the deep angler's mouth (rule: 1.5-3 s before its stretch)
    add(deep.d - 35 * KZ - 2.0 * speed(deep.d), 'phase', { nx: -0.3, ny: 0.2 });
    add(deep.d - 27 * KZ, 'shield-cell', lurePoint('deep', 1));
    rings(58.3, 61.4, 'mixed');
    // OVERCLOCK before the Abyssal Garden, where the bloomer slopes fire from both sides
    add(BAR(62.2), 'overclock', { nx: -0.2, ny: 0.1 });
    line(BAR(62.35), -0.2, 0.1, -0.1, 0.1, 3, 24);
    rings(63.0, 64, 'mixed');

    // ======== ACT 4, THE ABYSSAL GARDEN (master): the set piece on drop two. The lures above; the bloomers on the
    // slopes fire from both sides at once (one early roll takes both, or roll the fans)
    rings(64.2, 77, 'mixed');
    for (const b of [65.2, 67.8, 70.4, 73.0]) { slopeBloom(b, -0.7); slopeBloom(b, 0.7); }
    slopeBloom(66.5, 0.0, { seeds: 2, gap: 1.2 });
    slopeBloom(71.8, 0.0, { seeds: 2, gap: 1.2 });
    rings(77.2, 80, 'swirl');
    // ======== THE LANTERN LIGHT: the drive, a step less dense; then calm and the pale light ahead
    rings(80.2, 86.4, 'mixed');
    slopeBloom(80.8, 0.0, { seeds: 2, gap: 1.1 });
    seekerAt(82.2, 0.2, 0.5);
    slopeBloom(84.6, -0.6); slopeBloom(84.6, 0.6);
    slopeBloom(86.0, 0.0);
    rings(86.6, END_BAR - 0.5, 'swirl');
  },
});
