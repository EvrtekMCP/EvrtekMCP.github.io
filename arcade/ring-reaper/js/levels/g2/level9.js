// GALAXY 2, LEVEL 9: THE MURMURATION, boss THE MURMUR (the plan, projects/starwake-galaxies.md 3.9; Yori's look sheet
// level-g2-09). THE HEADLINE (rule 20): a flock of light-moths flies as one shape, so read the shape. Hundreds of pearl
// moths make a wall with a hole, a rolling wave, a funnel, a spiral; the dense parts are solid, the thin ones sparkle.
// Each shape change is warned (the flock inhales: it slows, brightens, and the next shape's outline shows). A CONDUCTOR,
// the one moth with a red core, fires aimed pairs: roll them home and the flock scatters into snow. The twist: the flock
// flies WITH you as a tube and squeezes. The master: THE GREAT WHEEL, wheels of moths turning as they come; the Murmur
// rises out of it. Out of the dark (Angler's Deep) into light: the one pale level.
//
// THE MUSIC (rule 30): g2/level9/music, melodic techno with swirling arpeggios, 145 bpm, C minor, 94 bars planned; the
// boss track g2/bosses/murmur is in the same key (145.03 bpm, mastered). Stand-ins play until the switch; then set BPM
// and FIRST_BEAT from the level take's .json. Bars count from 0.
//   ACT 1  THE PEARL SKY       bars  0-24   88 m/s  a far flock makes a slow wave (harmless); walls with big holes
//   ACT 2  THE SHAPESHIFTERS   bars 24-48  112 m/s  shapes change as you come; conductors; PHASE into the flock's eye
//   ACT 3  THE TUBE            bars 48-64  130 m/s  the flock flies with you as a tube and squeezes; OVERCLOCK; clusters
//   ACT 4  THE GREAT WHEEL     bars 64-88  150 m/s  SET PIECE: wheels turning as they come, conductors among the spokes
//          THE STILL SKY       bars 88-93  164 m/s  calm; a SHIELD CELL at the Murmur's door; THE MURMUR on bar 93
import { defineLevel, clamp } from '../../api.js?v=0.6.2';
import ring from '../../pickups/ring/index.js?v=0.6.2';
import { phase, overclock, shieldCell } from '../../pickups/powerups/index.js?v=0.6.2';
import bloomer from '../../enemies/g2-bloomer/index.js?v=0.6.2';
import flock from '../../enemies/g2-flock/index.js?v=0.6.2';
import conductor from '../../enemies/g2-conductor/index.js?v=0.6.2';
import murmur from '../../bosses/g2-murmur/index.js?v=0.6.2';
import { driftLights, lights, greatWheel } from './level9/scenery.js?v=0.6.2';

const BPM = 145, FIRST_BEAT = 0, BAR_S = 240 / BPM;
const STEPS = [[0, 88], [24, 112], [48, 130], [64, 150], [80, 164]];
const BOSS_BAR = 93;
const BAR_D = (() => {
  const vAtT = (tt) => { const b = (tt - FIRST_BEAT) / BAR_S; let v = STEPS[0][1]; for (let i = 1; i < STEPS.length; i++) { const k = clamp((b - STEPS[i][0]) / 0.5, 0, 1); v += (STEPS[i][1] - STEPS[i - 1][1]) * k * k * (3 - 2 * k); } return v; };
  let d = FIRST_BEAT * STEPS[0][1], t = FIRST_BEAT; const out = [d];
  for (let bar = 1; bar <= BOSS_BAR + 10; bar++) { const t1 = FIRST_BEAT + bar * BAR_S; while (t < t1) { const h = Math.min(0.005, t1 - t); d += vAtT(t + h / 2) * h; t += h; } out.push(d); }
  return out;
})();
export const BAR = (b) => { const i = clamp(Math.floor(b), 0, BAR_D.length - 2), f = b - i; return BAR_D[i] + (BAR_D[i + 1] - BAR_D[i]) * f; };
const stepD = STEPS.map(([b, v]) => [BAR(b), BAR(b + 0.5), v]);
function speed(d) { let v = STEPS[0][1]; for (let i = 1; i < stepD.length; i++) { const k = clamp((d - stepD[i][0]) / (stepD[i][1] - stepD[i][0]), 0, 1); v += (stepD[i][2] - stepD[i - 1][2]) * k * k * (3 - 2 * k); } return v; }

const A1 = BAR(24), A2 = BAR(48), A3 = BAR(64), A4 = BAR(88), BOSS_D = BAR(BOSS_BAR), LEVEL_END = BOSS_D + 600;
const FIRE_D = 290;

// Yori's palette for the Murmuration: sky 0a0c1a, gas f0f0ff / 8a7ab0 / 2a3a6a, fog 1e2038, key ffffff, fill 6a6a9a,
// accent f4f0ff. Pearl and lavender, the one pale level.
const look = (sky, a, b, c, fog, o = {}) => Object.assign({ sky: [sky, 'rgba(' + a + ',A)', 'rgba(' + b + ',A)', 'rgba(' + c + ',A)'], fog, hemiSky: 0xf4f0ff, hemiGround: 0x2a2a4a, sun: 0xffffff, band: 0.5, gas: 0.7, cloud: 0xd8d4ff, clouds: 0.22, starGlow: 0.6, starTint: 0xf0ecff }, o);

export default defineLevel({
  g: 2, n: 9, id: 'murmuration', name: 'THE MURMURATION',
  idea: 'A flock of light-moths flies as one shape, so read the shape.',
  seed: 209009,
  length: LEVEL_END,
  speed,
  music: { track: 'g2/level9/music' },
  bossMusic: 'g2/bosses/murmur',
  // style minimums [grazes + close calls, deflects], from the decent human bot (11-07, seeds 1-3: close 6, 18 and 21,
  // deflects 51, 51 and 40): A about a quarter, S 40%, DEGENERATE 60%
  style: { A: [4, 12], S: [6, 19], DEGENERATE: [9, 28] },
  sfx: [{ id: 'g2-flock-shift', gain: 0.6 }, { id: 'g2-flock-scatter', gain: 0.7 }, { id: 'g2-graft-crack', gain: 0.6 }, { id: 'g2-bloom', gain: 0.6 }, { id: 'g2-boss-freed', gain: 0.9 }],
  sections: [
    { id: 'pearl', name: 'THE PEARL SKY', sub: 'SECTOR 1', d0: 0, d1: A1, look: 'pearl', scenery: { 'g2-l9-lights': 1, 'g2-l9-wheel': 0.25 } },
    { id: 'shapes', name: 'THE SHAPESHIFTERS', sub: 'SECTOR 2', d0: A1, d1: A2, look: 'shapes', scenery: { 'g2-l9-lights': 1, 'g2-l9-wheel': 0.35 } },
    { id: 'tube', name: 'THE TUBE', sub: 'SECTOR 3', d0: A2, d1: A3, look: 'tube', scenery: { 'g2-l9-lights': 0.8, 'g2-l9-wheel': 0.4 } },
    { id: 'wheel', name: 'THE GREAT WHEEL', sub: 'SECTOR 4', d0: A3, d1: A4, look: 'wheel', scenery: { 'g2-l9-lights': 1, 'g2-l9-wheel': 1 } },
    { id: 'still', name: 'THE STILL SKY', sub: 'THE MURMUR AHEAD', d0: A4, d1: LEVEL_END, look: 'still', scenery: { 'g2-l9-lights': 1, 'g2-l9-wheel': 1 } },
  ],
  looks: {
    pearl: look('#0a0c1a', '240,240,255', '138,122,176', '42,58,106', 0x1e2038, { seed: 2901, gas: 0.6 }),
    shapes: look('#0b0c1c', '138,122,176', '240,240,255', '42,58,106', 0x20223c, { seed: 2902, gas: 0.7 }),
    tube: look('#0c0e20', '240,240,255', '42,58,106', '138,122,176', 0x222440, { seed: 2903, gas: 0.75, clouds: 0.26 }),
    wheel: look('#0e1024', '240,240,255', '138,122,176', '240,240,255', 0x262848, { seed: 2904, gas: 0.85, clouds: 0.3, band: 0.58 }),
    still: look('#0a0c1a', '240,240,255', '106,106,154', '42,58,106', 0x1e2038, { seed: 2905, gas: 0.6, clouds: 0.16 }),
  },
  kinds: [ring, phase, overclock, shieldCell, bloomer, flock, conductor, driftLights],
  scenery: [lights, greatWheel],
  boss: { at: BOSS_D, def: murmur, then: 'finish' },
  beats: [
    { d: 0, tag: 'calm', what: 'intro: the Pearl Sky, rings in the open, the Great Wheel faint and far' },
    { d: BAR(6.5), tag: 'calm', what: 'the lesson, harmless: a small flock off to the side makes a slow wave' },
    { d: BAR(10.5), tag: 'rising', what: 'a wall with a big hole, rings through it: read the shape' },
    { d: BAR(18), tag: 'rising', what: 'a rolling wave across the lane: over it or under it' },
    { d: BAR(22.5), tag: 'calm', what: 'rings only' },
    { d: A1, tag: 'calm', what: 'build one, speed step: the Shapeshifters; a flock inhales and changes as you come' },
    { d: BAR(30), tag: 'rising', what: 'the first conductor: roll its pair home and its wall becomes snow' },
    { d: BAR(32.5), tag: 'peak', what: 'drop one: a second conductor wall, a funnel, a spiral with a conductor on its far coil' },
    { d: BAR(39.4), tag: 'calm', what: 'PHASE on the ring line; a cracked patch in a flock: its eye holds a cache' },
    { d: BAR(44.6), tag: 'calm', what: 'rings only' },
    { d: A2, tag: 'calm', what: 'breakdown, speed step: the Tube' },
    { d: BAR(50), tag: 'peak', what: 'TWIST: the flock flies with you as a tube and squeezes; kill its conductor to burst it' },
    { d: BAR(57), tag: 'calm', what: 'out of the tube' },
    { d: BAR(59.8), tag: 'rising', what: 'OVERCLOCK, then the conductor clusters: pair after pair' },
    { d: A3, tag: 'peak', what: 'drop two, SET PIECE THE GREAT WHEEL: wheels turning as they come, one or two conductors among the spokes' },
    { d: BAR(73.5), tag: 'calm', what: 'the wheels fall behind' },
    { d: BAR(76), tag: 'rising', what: 'the drive: every shape once more, a step less dense, each with its red one' },
    { d: A4, tag: 'calm', what: 'the Still Sky: a Shield Cell at the door; the flock gathers into one' },
    { d: BOSS_D, tag: 'peak', what: 'THE MURMUR' },
  ],
  acts: { introduce: [0, A1], develop: [A1, A2], twist: [A2, A3], master: [A3, BOSS_D] },
  build(R, L) {
    const { add, ring: one, line, sine } = L;
    let keyN = 0;
    const reserved = [];
    // a flock whose middle crosses your plane on `bar` (for a tube: the moment it starts flying with you)
    const flockAt = (bar, shape, o = {}) => { const key = 'f' + (++keyN), d = BAR(bar) + (o.hold ? -o.hold.z : 0); add(d, 'g2-flock', Object.assign({ key, shape }, o)); const len = o.len || (shape === 'spiral' ? 220 : shape === 'funnel' ? 60 : shape === 'pocket' ? 70 : shape === 'tube' ? 64 : 2); if (!o.decor) reserved.push([d - len / 2 - 140, d + len / 2 + 30]); return { key, d }; };
    // a ring line to a point given in METRES (a wheel's gaps are measured in metres, so they hold in portrait too)
    const threadM = (f, x, y, x0 = 0, y0 = 0) => { const st = Math.max(22, speed(f.d) * 0.19); for (let i = 0; i < 4; i++) { const k = (i + 1) / 5; add(f.d - st * (4 - i), 'ring', { x: x0 + (x - x0) * k, y: y0 + (y - y0) * k }); } add(f.d, 'ring', { x, y }); add(f.d + st, 'ring', { x, y }); };
    const condAt = (f, at, o = {}) => add(f.d, 'g2-conductor', Object.assign({ flock: f.key, at }, o));
    const bloom = (bar, nx, ny, o = {}) => add(BAR(bar) + (o.fireAt ?? FIRE_D), 'g2-bloomer', Object.assign({ nx, ny }, o));
    // rings between two bars at a spacing that follows the speed, keeping clear of the flocks (they lay their own)
    const free = (d0, d1) => !reserved.some(([a, b]) => d1 > a && d0 < b);
    const rings = (b0, b1, style) => {
      let d = BAR(b0); const end = BAR(b1); let k = 0;
      while (d < end - 60) {
        const v = speed(d), st = Math.max(22, v * 0.19), a = v > 130 ? 0.8 : 1;
        if (!free(d, d + st * 6)) { d += st; continue; }
        const pick = style === 'swirl' ? 3 : (k + R.int(0, 3)) % 5; k++;
        let next;
        if (pick === 0) next = line(d, R.range(-0.6, 0.6) * a, R.range(-0.5, 0.5) * a, R.range(-0.6, 0.6) * a, R.range(-0.5, 0.5) * a, 5, st);
        else if (pick === 1) next = line(d, -0.6 * a, R.range(-0.3, 0.4), 0.6 * a, R.range(-0.3, 0.4), 6, st);
        else if (pick === 2) next = line(d, R.range(-0.3, 0.3), 0.6 * a, R.range(-0.3, 0.3), -0.55 * a, 5, st);
        else if (pick === 3) next = sine(d, v > 130 ? 10 : 8, st, R.range(0.4, 0.55) * a, R.range(0.34, 0.46) * a, R() * 6);
        else next = line(d, R.sign() * 0.6 * a, R.sign() * 0.5 * a, 0, 0, 5, st);
        d = Math.min(end, next) + v * R.range(0.75, 1.1);
      }
    };
    // a ring line that threads a point at a flock's crossing: rings leading in, one in the hole, one after
    const thread = (f, nx, ny, from = [0, 0]) => { const st = Math.max(22, speed(f.d) * 0.19); line(f.d - st * 4, from[0], from[1], nx, ny, 4, st); one(f.d, nx, ny); one(f.d + st, nx, ny); };

    // ======== ACT 1, THE PEARL SKY (introduce): the flock seen harmlessly, then big holes (rules 4, 17, 18)
    rings(0.6, 6, 'mixed');
    add(BAR(6.4), 'call', { text: 'READ THE SHAPE', cls: 'c-mag' });
    flockAt(9.5, 'wave', { decor: true, nx: 2.4, ny: 0.5, n: 200, amp: 0.6 });         // off to the side: a slow wave
    rings(6.6, 9.4, 'mixed');
    const w1 = flockAt(11.5, 'wall', { hole: { nx: 0.2, ny: 0.05, r: 0.85 } }); thread(w1, 0.2, 0.05);
    rings(12, 14.2, 'mixed');
    const w2 = flockAt(15.4, 'wall', { hole: { nx: -0.4, ny: -0.2, r: 0.8 } }); thread(w2, -0.4, -0.2, [0.1, 0]);
    rings(15.9, 17.4, 'mixed');
    // a rolling wave across the lane: its band at the crossing is y = 0.55 sin(k x) (ph 0): the rings go over its trough
    const v1 = flockAt(18.8, 'wave', { amp: 0.5, ph: Math.PI / 2 }); thread(v1, -0.05, -0.62, [0, -0.3]);
    rings(19.3, 21.2, 'mixed');
    const w3 = flockAt(21.8, 'wall', { hole: { nx: 0.45, ny: 0.3, r: 0.75 } }); thread(w3, 0.45, 0.3, [0, 0.1]);
    rings(22.3, 24, 'swirl');
    // the bloomers (known from Bloomfall) drift through the pearl sky: the roll's work while the flock teaches
    // (g2-roll, 11-07: the two middle ones throw two seeds, and one more drifts by while the far flock makes its harmless
    // wave, so the pearl sky asks a roll about every bar and a half)
    bloom(8.0, -0.7, 0.6, { seeds: 2, gap: 1.2 });
    bloom(13.2, -0.7, 0.6); bloom(16.8, 0.7, -0.55, { seeds: 2, gap: 1.2 }); bloom(19.8, -0.6, 0.65, { seeds: 2, gap: 1.2 }); bloom(23.0, 0.65, 0.6, { seeds: 2, gap: 1.2 });

    // ======== ACT 2, THE SHAPESHIFTERS (develop). Build one 24-32, drop one 32-48
    rings(24.2, 26.6, 'mixed');
    // a wave that becomes a wall as you come (the inhale, then the flow)
    const s1 = flockAt(27.5, 'wave', { amp: 0.4, script: [{ t: 3.4, to: { shape: 'wall', hole: { nx: -0.3, ny: 0.2, r: 0.72 } } }] }); thread(s1, -0.3, 0.2);
    rings(28, 29.4, 'mixed');
    bloom(25.2, 0.7, 0.6); bloom(26.4, -0.7, -0.5); bloom(28.6, -0.7, -0.55); bloom(32.6, 0.7, 0.6, { seeds: 2, gap: 1.2 }); bloom(35.6, -0.7, 0.6); bloom(43.0, 0.7, -0.6);
    // the first conductor: in a wall (with a hole, so it is never a full block); roll its pair and the wall becomes snow
    add(BAR(29.6), 'call', { text: 'THE RED ONE LEADS', cls: 'c-cyan' });
    const c1 = flockAt(31, 'wall', { hole: { nx: 0.35, ny: -0.25, r: 0.7 } }); condAt(c1, [-0.3, 0.35], { first: 3.0 }); thread(c1, 0.35, -0.25);
    // (g2-roll, 11-07: a second red one straight after the lesson, in a wall of its own, before the funnel; its pair lands
    // a bar and a third before the funnel's and the bloomer's, so never more than three in any 3 s)
    const c1b = flockAt(32.5, 'wall', { hole: { nx: -0.35, ny: -0.3, r: 0.75 } }); condAt(c1b, [0.5, 0.45], { first: 2.8 }); thread(c1b, -0.35, -0.3, [0.35, -0.25]);
    rings(31.5, 32.4, 'mixed');
    // drop one: a funnel narrowing to its mouth, a conductor at the mouth
    const fn = flockAt(34, 'funnel', { hole: { nx: 0.15, ny: -0.1, r: 0.7 }, r1: 2.9, len: 60 }); condAt(fn, [0.15 + 0.32, -0.1], { dz: -20, first: 2.6, pairs: 1 });
    line(fn.d - 30 - 4 * 24, 0, 0, 0.02, -0.02, 4, 24); line(fn.d - 30, 0.02, -0.02, 0.15, -0.1, 4, 20); one(fn.d + 54, 0.15, -0.1);
    // a spiral coiling down the lane: keep to its middle (its arm circles 0.55 of the box out)
    const sp = flockAt(37.6, 'spiral', { r: 0.6, turns: 1.25, len: 220 });
    line(sp.d - 110 - 60, 0, 0, 0, 0, 3, 30); line(sp.d - 110, 0, 0.05, 0, 0.05, 10, 22);
    // (g2-roll, 11-07: a conductor rides the spiral's far coil and fires down its middle, where the rings keep you)
    condAt(sp, [0.6, 0.55], { dz: -90, first: 2.8 });
    bloom(37.0, 0.75, 0.55);
    // PHASE on the ring line; 2.3 s on, a cracked patch in the flock: its eye holds a cache (three clues: the violet
    // crack, the amber sparks round it, and a short trail of rings running into it)
    add(BAR(39.6), 'phase', { nx: 0.2, ny: 0.25 }); line(BAR(39.2), 0, 0.1, 0.2, 0.25, 3, 24);
    const pk = flockAt(41.0, 'pocket', { hole: { nx: 0.55, ny: 0.35, r: 0.6 }, crack: { nx: 0.55, ny: 0.35 }, r: 2.6, len: 70, n: 260 });
    // the trail (extras) runs in; the cache (extras) sits in the eye; the counted rings stay out in the open
    line(pk.d - 35 - 3 * 22, 0.35, 0.3, 0.55, 0.35, 3, 22, 'ring', { cache: true, noMagnet: true });
    line(pk.d - 35 + 12, 0.55, 0.35, 0.55, 0.35, 5, 14, 'ring', { cache: true, noMagnet: true });
    line(pk.d - 35 - 3 * 24, -0.35, -0.2, -0.35, -0.25, 6, 24);
    rings(42.4, 44.4, 'mixed');
    // (g2-roll, 11-07: two conductors in this wall; it scatters only when both are down)
    const c2 = flockAt(43.6, 'wall', { hole: { nx: -0.4, ny: 0.25, r: 0.7 } }); condAt(c2, [0.4, 0.3], { first: 3.0 }); condAt(c2, [0.45, -0.5], { first: 2.0 }); thread(c2, -0.4, 0.25);
    rings(44.6, 48, 'swirl');

    // ======== ACT 3, THE TUBE (twist): the flock wraps round the lane and flies with you, squeezing; its conductor at
    // the far end. Kill it to burst the tube; if you don't, it lets go on its own (8.5 s).
    rings(48.2, 49.4, 'mixed');
    add(BAR(49.2), 'call', { text: 'IT FLIES WITH YOU', cls: 'c-mag' });
    const hold1 = { z: -30, secs: 8.5 };
    const t1 = flockAt(50, 'tube', { hold: hold1, len: 64, r: 7, n: 420 }); condAt(t1, [0.05, 0.1], { hold: hold1, dz: -30, pairs: 4, gap: 1.9 });
    for (let d = BAR(50) + 20; d < BAR(55.6); d += 28) one(d, R.range(-0.08, 0.08), R.range(-0.08, 0.1));
    rings(56.4, 57.2, 'mixed');
    const hold2 = { z: -30, secs: 5 };
    const t2 = flockAt(57.4, 'tube', { hold: hold2, len: 64, r: 7, n: 380 }); condAt(t2, [-0.05, 0.08], { hold: hold2, dz: -30, pairs: 2, gap: 1.8 });
    for (let d = BAR(57.4) + 20; d < BAR(59.2); d += 30) one(d, 0, 0.05);
    // OVERCLOCK on the ring line, then the conductor clusters: one flock, three conductors firing pair after pair
    add(BAR(59.8), 'overclock', { nx: 0, ny: 0.1 }); line(BAR(59.95), 0, 0.1, 0.1, 0.1, 3, 24);
    const k1 = flockAt(62.0, 'wall', { hole: { nx: 0.1, ny: -0.3, r: 0.75 } });
    condAt(k1, [-0.55, 0.4], { first: 3.4 }); condAt(k1, [0.55, 0.4], { first: 2.9 }); condAt(k1, [0, 0.62], { first: 2.4 });
    thread(k1, 0.1, -0.3);
    const k2 = flockAt(63.6, 'wall', { hole: { nx: -0.2, ny: 0.2, r: 0.75 } });
    condAt(k2, [0.5, -0.4], { first: 3.0 }); condAt(k2, [-0.55, -0.35], { first: 2.5 });
    thread(k2, -0.2, 0.2, [0.1, -0.3]);

    // ======== ACT 4, THE GREAT WHEEL (master): the set piece on drop two. A wheel a bar, turning as it comes; the rings
    // through a gap between its spokes (its angle at your plane is a0: the gap's middle is a0 + 30 degrees)
    rings(64.2, 64.6, 'mixed');
    // Five spokes; a gap's middle 3.2 m out, about 2.4 m of clear air across it, in a landscape box or a portrait one.
    // Each wheel is turned so its gap sits 15 degrees on from the last: the rings circle the hub in a slow spiral and never
    // cut across it, and a pilot a beat late (still on the last gap) is 21 degrees, over a metre, clear of the next spoke.
    const GAP_M = 3.2, GAP = (a0, k) => a0 + Math.PI / 5 + k * Math.PI * 2 / 5, STEP = Math.PI / 12;
    let g = 0.5, px = Math.cos(g - STEP) * GAP_M, py = Math.sin(g - STEP) * GAP_M;
    // (g2-roll, 11-07: every other wheel carries a second conductor on the spoke across the hub from the gap, firing
    // 0.8 s after the first; the conductors' pairs land about a second apart, never more than three in any 3 s)
    [65, 66.2, 67.4, 68.6, 69.8, 71.0, 72.2].forEach((b, k) => {
      const a0 = g - Math.PI / 5, wh = flockAt(b, 'wheel', { a0, spokes: 5, n: 360 });
      const gx = Math.cos(g) * GAP_M, gy = Math.sin(g) * GAP_M;
      threadM(wh, gx, gy, px, py); px = gx; py = gy; g += STEP;
      condAt(wh, [Math.cos(a0) * 0.75, Math.sin(a0) * 0.75], { first: 2.8 });
      if (k % 2 === 0) { const a3 = a0 + 3 * Math.PI * 2 / 5; condAt(wh, [Math.cos(a3) * 0.75, Math.sin(a3) * 0.75], { first: 2.0 }); }
    });
    rings(73.4, 87.6, 'mixed');
    // the drive: a step less dense, every shape once more
    // (g2-roll, 11-07: the drive is every shape once more, and now every one of them has its red one: a conductor in the
    // shifting wall, the wave and the last wheel too)
    const d1 = flockAt(76.5, 'wall', { hole: { nx: 0.4, ny: -0.2, r: 0.75 }, script: [{ t: 3.4, to: { shape: 'wall', hole: { nx: -0.35, ny: 0.25, r: 0.75 } } }] }); thread(d1, -0.35, 0.25);
    condAt(d1, [-0.55, -0.5], { first: 2.2 });
    bloom(78.6, -0.7, 0.6); bloom(78.6, 0.7, 0.6);
    bloom(75.0, 0.0, 0.7, { seeds: 2, gap: 1.2 }); bloom(82.4, -0.7, -0.6); bloom(84.8, 0.7, 0.6); bloom(87.0, -0.6, 0.65);
    // (g2-roll, 11-07: one more wall in the drive, its conductor low and left of the hole)
    const d5 = flockAt(79.6, 'wall', { hole: { nx: 0.3, ny: 0.3, r: 0.8 } }); condAt(d5, [-0.5, -0.45], { first: 2.8 }); thread(d5, 0.3, 0.3);
    const d2 = flockAt(81, 'wave', { amp: 0.45, ph: -Math.PI / 2 }); thread(d2, 0.05, 0.62, [0, 0.3]); condAt(d2, [-0.6, -0.55], { first: 2.8 });
    const d3 = flockAt(83.4, 'wall', { hole: { nx: 0.0, ny: 0.1, r: 0.8 } }); condAt(d3, [0.5, -0.45], { first: 2.8 }); thread(d3, 0, 0.1);
    const d4 = flockAt(86, 'wheel', { a0: 1.0, spokes: 5 }); { const ga = GAP(1.0, 0); threadM(d4, Math.cos(ga) * GAP_M, Math.sin(ga) * GAP_M, Math.cos(ga - STEP) * GAP_M, Math.sin(ga - STEP) * GAP_M); }
    condAt(d4, [Math.cos(1.0 + 3 * Math.PI * 2 / 5) * 0.75, Math.sin(1.0 + 3 * Math.PI * 2 / 5) * 0.75], { first: 2.8 });
    // ======== THE STILL SKY: nothing fires; a Shield Cell at the Murmur's door (on the ring line), rings to the fight
    rings(88.2, 89.6, 'swirl');
    line(BAR(89.8), 0.3, 0.1, 0, 0, 3, 24); add(BAR(89.8) + 3 * 24 + 6, 'shield-cell', { nx: 0, ny: 0 }); line(BAR(89.8) + 4 * 24, 0, 0, -0.2, 0.1, 3, 24);
    rings(91.0, BOSS_BAR - 1.4, 'swirl');
  },
});
