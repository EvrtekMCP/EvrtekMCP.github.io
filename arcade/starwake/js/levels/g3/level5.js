// GALAXY 3, LEVEL 5: THE DRAFTING HALL. An endless plane of blueprints standing on edge (Yori's look sheet
// g3-level-05, the only blue level in the game). THE HEADLINE (rule 20): plotters draw a line of mines wherever they
// fly. Its new enemy is the PLOTTER (js/enemies/g3-plotter): a pen machine that flies across a sheet the course carries
// toward you and prints a dotted line of mines behind its nib, its path ruled first as a white guide-line 1.25 s ahead.
// A mine lands white-hot and hardens red in 0.35 s; only red hurts. Cross where the line is not drawn yet, or go round
// its end; roll an escort's shot into a plotter and it breaks mid-line, so the gap grows. Walls drawn live in front of
// you, where the order matters.
//
// THE SCHEDULE (rule 30): the plan's track, g3/level5/music, 146 bpm, electro-techno with a scribbling lead that rises as
// the plotters draw; the bar map every level track shares. A galaxy 1 stand-in plays until the take lands (ElevenLabs
// credits); the course is laid on the plan's grid and check-levels reports real bars once its .json is in.
//   ACT 1 INTRODUCE  THE TRACING ROOM    bars  1-24  86-94 m/s   one short line far ahead, rings above it; a line to go
//                                                                 round; a line to cross ahead of its nib; an escort
//   ACT 2 DEVELOP    THE RULING DESKS    bars 25-48  106-120     plotters in pairs draw an X, pods escorting; mine
//                                                                 clusters; an augur; lines that pop when you pass close
//   ACT 3 TWIST      THE SIGNATURE       bars 49-64  120-128     a plotter writes a looping curve across the sheet: the
//                                                                 only way through is where it has not drawn yet. Then
//                                                                 PHASE before a finished patch of mines with a Shield
//                                                                 Cell and a cache behind it (a green glow bleeds round
//                                                                 it, sparks drift out). The Signature again, the other way
//   ACT 4 MASTER     THE DRAFTING TABLE  bars 65-72  140         the set piece: four plotters draft a maze in sequence, at
//                                                                 speed, and the rings are the solution. SLIPSTREAM just
//                                                                 before it (its textbook place, the plan's 4.5)
//                    THE FAIR COPY       bars 73-88  140-160     a calm for the snap-back, then the last exam at full
//                                                                 speed (never slipstreamed: rule 3 of the plan's 6.3)
// The difficulty is the engine's (EASE_G[3][5]: dmg 1.0, heal 1.0, shot 0.98, ring 1.0; pressure 1.02).
// My call where the plan is silent: the plan puts the Slipstream right before the Drafting Table AND says never before
// the level's final mastery test. Both hold here: the table is the set piece, and the final test is the Fair Copy
// after it, flown at full speed.
import { defineLevel } from '../../api.js?v=0.4.1';
import ring from '../../pickups/ring/index.js?v=0.4.1';
import pod from '../../enemies/pod/index.js?v=0.4.1';
import mines from '../../obstacles/mines/index.js?v=0.4.1';
import { shieldCell, phase, slipstream } from '../../pickups/powerups/index.js?v=0.4.1';
import plotter from '../../enemies/g3-plotter/index.js?v=0.4.1';
import augur from '../../enemies/g3-augur/index.js?v=0.4.1';
import { musicClock } from './level4/clock.js?v=0.4.1';
import { sheet, hall, floor, endless, clue } from './level5/scenery.js?v=0.4.1';

const C = musicClock(146, 0.16, [[1, 86], [9, 94], [25, 106], [33, 120], [57, 128], [65, 140], [81, 152], [85, 160]], 91);
export const B = C.B, BAR = C.BAR;
const LENGTH = B(91);
const A1 = B(25), A2 = B(49), A3 = B(65), A4 = B(73);

// paths for the plotters, in the normalised box (ends just outside it, where the pen comes in from)
const H = (y, x0 = -1.25, x1 = 1.25) => [[x0, y], [x1, y]];
const V = (x, y0 = 1.25, y1 = -1.25) => [[x, y0], [x, y1]];
// a looping curve (the Signature): loops the full height of the sheet, advancing from x0 to x1
function signature(x0, x1, loops, amp = 1.05) {
  const out = [], N = loops * 24, dir = Math.sign(x1 - x0);
  for (let i = 0; i <= N; i++) { const t = i / N, a = t * loops * Math.PI * 2; out.push([x0 + (x1 - x0) * t - dir * 0.16 * Math.sin(a), amp * Math.cos(a)]); }
  return out;
}
// a hatched patch (a finished line folded back on itself until nothing passes): w x h, centred
function hatch(cx, cy, w, h, rows) { const out = []; for (let i = 0; i <= rows; i++) { const y = cy - h / 2 + h * i / rows; out.push(i % 2 ? [cx + w / 2, y] : [cx - w / 2, y], i % 2 ? [cx - w / 2, y] : [cx + w / 2, y]); } return out; }
// a BAND: strokes up and down (or across) close enough that nothing passes between them, filling x0..x1 (or y0..y1) the
// full height (width) of the sheet. On a sheet a single line is a thin stripe you only have to be off; a band is a wall.
function bandV(x0, x1, p = 0.17) { const out = []; let i = 0; for (let x = x0; x <= x1 + 1e-6; x += p, i++) out.push(i % 2 ? [x, 1.15] : [x, -1.15], i % 2 ? [x, -1.15] : [x, 1.15]); return out; }
function bandH(y0, y1, p = 0.27) { const out = []; let i = 0; for (let y = y0; y <= y1 + 1e-6; y += p, i++) out.push(i % 2 ? [1.15, y] : [-1.15, y], i % 2 ? [-1.15, y] : [1.15, y]); return out; }

export default defineLevel({
  g: 3, n: 5, id: 'drafting', name: 'THE DRAFTING HALL',
  idea: 'Plotters draw a line of mines wherever they fly.',
  seed: 300005,
  length: LENGTH,
  speed: C.speed,
  music: { track: 'g3/level5/music' },
  bossMusic: null,
  sfx: [{ id: 'g3-plot', gain: 0.4 }, { id: 'g3-augur-charge', gain: 0.6 }],
  sections: [
    { id: 'tracing', name: 'THE TRACING ROOM', sub: 'SECTOR 1', d0: 0, d1: A1, look: 'tracing',
      scenery: { 'g3-l5-hall': 0.8, 'g3-l5-floor': 1, 'g3-l5-endless': 0.5 } },
    { id: 'desks', name: 'THE RULING DESKS', sub: 'SECTOR 2', d0: A1, d1: A2, look: 'desks',
      scenery: { 'g3-l5-hall': 1, 'g3-l5-floor': 1, 'g3-l5-endless': 0.55 } },
    { id: 'signature', name: 'THE SIGNATURE', sub: 'SECTOR 3', d0: A2, d1: A3, look: 'signature',
      scenery: { 'g3-l5-hall': 1, 'g3-l5-floor': 0.7, 'g3-l5-endless': 0.6 } },
    { id: 'table', name: 'THE DRAFTING TABLE', sub: 'FINAL STRETCH', d0: A3, d1: A4, look: 'table',
      scenery: { 'g3-l5-hall': 0.7, 'g3-l5-floor': 1, 'g3-l5-endless': 1 } },
    { id: 'fair', name: 'THE FAIR COPY', sub: 'THE LAST SHEET', d0: A4, d1: LENGTH, look: 'fair',
      scenery: { 'g3-l5-hall': 1, 'g3-l5-floor': 1, 'g3-l5-endless': 1 } },
  ],
  // Yori's palette (g3-palettes.js, level 5): sky 06091a, gas 2a58c8 / 1a3a8a / e8eeff, fog 0e1a3a, key ffffff, fill
  // 2a4aa0, accent cyanotype 4a80f0 (hue 221-223: blue, well off the reserved cyan at 190). Rule 9 holds.
  looks: {
    tracing: { sky: ['#06091a', 'rgba(42,88,200,A)', 'rgba(26,58,138,A)', 'rgba(232,238,255,A)'], fog: 0x0e1a3a, hemiSky: 0xffffff, hemiGround: 0x2a4aa0, sun: 0xffffff, band: 0.5, gas: 0.55, cloud: 0x2a58c8, clouds: 0.14, seed: 3501 },
    desks: { sky: ['#070b1e', 'rgba(26,58,138,A)', 'rgba(42,88,200,A)', 'rgba(232,238,255,A)'], fog: 0x101c40, hemiSky: 0xf0f4ff, hemiGround: 0x2a4aa0, sun: 0xffffff, band: 0.46, gas: 0.62, cloud: 0x1a3a8a, clouds: 0.16, seed: 3502 },
    signature: { sky: ['#05081a', 'rgba(232,238,255,A)', 'rgba(42,88,200,A)', 'rgba(26,58,138,A)'], fog: 0x0c1836, hemiSky: 0xffffff, hemiGround: 0x22408a, sun: 0xf4f8ff, band: 0.54, gas: 0.5, cloud: 0x2a58c8, clouds: 0.12, seed: 3503 },
    table: { sky: ['#081026', 'rgba(74,128,240,A)', 'rgba(232,238,255,A)', 'rgba(26,58,138,A)'], fog: 0x122046, hemiSky: 0xffffff, hemiGround: 0x2a4aa0, sun: 0xffffff, band: 0.5, gas: 0.78, cloud: 0x4a80f0, clouds: 0.2, seed: 3504 },
    fair: { sky: ['#0a1430', 'rgba(232,238,255,A)', 'rgba(74,128,240,A)', 'rgba(42,88,200,A)'], fog: 0x14244e, hemiSky: 0xffffff, hemiGround: 0x2a4aa0, sun: 0xffffff, band: 0.48, gas: 0.85, cloud: 0xe8eeff, clouds: 0.22, seed: 3505 },
  },
  kinds: [ring, pod, mines, plotter, augur, shieldCell, phase, slipstream, sheet, clue],
  scenery: [hall, floor, endless],
  beats: [
    { d: 0, tag: 'calm', what: 'intro: the tracing room, rings in the open, the endless sheet far ahead' },
    { d: B(5), tag: 'rising', what: 'the first plotter, alone: one short line drawn low and far ahead, the rings above it' },
    { d: B(8.5), tag: 'rising', what: 'a line across the middle: go round its end where the rings go' },
    { d: B(11.5), tag: 'rising', what: 'a line still being drawn as you reach it: cross ahead of the nib' },
    { d: B(15), tag: 'rising', what: 'an escort pod beside a plotter: roll its shot home and the plotter breaks, the line ends early' },
    { d: B(21), tag: 'calm', what: 'rings only' },
    { d: A1, tag: 'rising', what: 'build one, faster: plotters in pairs draw an X; mine clusters between' },
    { d: B(34), tag: 'rising', what: 'drop one (speed at bar 33, density from 34): X pairs with escorts, an augur, lines that pop when you pass close' },
    { d: B(38), tag: 'peak', what: 'two sheets close together, an augur over them, a mine cluster' },
    { d: B(45), tag: 'calm', what: 'rings only' },
    { d: A2, tag: 'calm', what: 'breakdown: the sheets stand taller; rings only' },
    { d: B(51), tag: 'rising', what: 'THE SIGNATURE: a looping curve written across the sheet; get ahead of the pen' },
    { d: B(54), tag: 'calm', what: 'rings; PHASE on the line' },
    { d: B(56), tag: 'rising', what: 'a finished patch of mines, a green glow bleeding round it: phase through for the Shield Cell and the cache' },
    { d: B(59), tag: 'peak', what: 'build two: the Signature again, written the other way, with an escort' },
    { d: B(62.5), tag: 'calm', what: 'lead-in: SLIPSTREAM on the line, two bars of rings' },
    { d: A3, tag: 'peak', what: 'drop two, faster: THE DRAFTING TABLE, four plotters drafting a maze in sequence; the rings are the solution' },
    { d: A4, tag: 'calm', what: 'the snap-back lands on rings only' },
    { d: B(77), tag: 'rising', what: 'THE FAIR COPY: the last exam at full speed, an X, a live line, an augur, a step less than the table' },
    { d: B(87), tag: 'calm', what: 'outro: rings to the line' },
  ],
  acts: { introduce: [0, A1], develop: [A1, A2], twist: [A2, A3], master: [A3, LENGTH] },
  build(R, L) {
    const { add, ring: one, line, sine, clearOfRings } = L;
    // a plotter whose sheet reaches you at bar `bar`
    const plot = (bar, path, o = {}) => { const d = B(bar); return add(d, 'g3-plotter', Object.assign({ path, spd: C.speed(d), from: 2.6, to: 0.5 }, o)); };
    const aug = (bar, nx, ny, o = {}) => { const at = o.at ?? 3.2, d0 = B(bar); return add(d0 + C.speed(d0) * at, 'g3-augur', Object.assign({ nx, ny, at }, o)); };
    const podAt = (bar, nx, ny, o = {}) => { const d = B(bar); for (const [x, y] of [[nx, ny], [nx, ny + 0.3], [-nx, ny], [nx * 0.5, -ny]]) if (clearOfRings(d, x, y, 0.5)) return add(d, 'pod', Object.assign({ nx: x, ny: y }, o)); return null; };
    const mineAt = (bar, nx, ny, n = 5) => { const d = B(bar); if (clearOfRings(d, nx, ny, 0.7)) add(d, 'mines', { nx, ny, n }); };
    // rings through a sheet: a short line that passes the sheet at (nx, ny), from 70 m before to 30 m after it
    const through = (bar, nx, ny, x0 = nx, y0 = ny) => { const d = B(bar); line(d - 72, x0, y0, nx, ny, 4, 24); line(d + 4, nx, ny, nx, ny, 2, 22); };
    const fill = (b0, b1) => {
      let d = B(b0); const end = B(b1); let k = 0;
      while (d < end - 70) {
        const pick = (k + R.int(0, 3)) % 4; k++;
        if (pick === 0) d = line(d, R.range(-0.55, 0.55), R.range(-0.45, 0.45), R.range(-0.55, 0.55), R.range(-0.45, 0.45), 5, 24);
        else if (pick === 1) d = line(d, -0.6, R.range(-0.3, 0.3), 0.6, R.range(-0.3, 0.3), 6, 22);
        else if (pick === 2) d = line(d, R.range(-0.3, 0.3), 0.55, R.range(-0.3, 0.3), -0.5, 5, 24);
        else d = sine(d, 8, 24, R.range(0.45, 0.6), R.range(0.38, 0.5), R() * 6);
        d += 30;
      }
    };

    // ================= ACT 1: INTRODUCE (bars 1-24): THE TRACING ROOM =================
    line(B(1.5), 0, 0.2, 0, 0, 5, 26);
    sine(B(3), 6, 24, 0.4, 0.3, 1);
    // bar 7: the first plotter, alone: a short line low on the sheet, drawn early (it is finished well before you)
    plot(7, H(-0.45, -0.95, 0.45), { from: 3.4, to: 1.6 });
    through(7, 0, 0.4, 0, 0.2);
    L.add(B(5.2), 'call', { text: 'RED IS A MINE. WHITE IS STILL WET', cls: 'c-cyan' });
    sine(B(8), 6, 24, 0.35, 0.3, 2);
    // bar 10: a line across the middle of the sheet, from the left, stopping short: go round its end (top right)
    plot(10, [[-1.25, 0.1], [0.4, -0.1]], { from: 3.0, to: 1.0 });
    through(10, 0.75, 0.5, 0.2, 0.2);
    // bar 12.5: a line still being drawn as you reach it: the rings cross ahead of the nib
    plot(12.5, H(0.0), { from: 2.4, to: -1.6 });
    through(12.5, 0.82, -0.05, 0.3, 0.3);
    L.add(B(10.9), 'call', { text: 'CROSS WHERE IT HAS NOT DRAWN YET', cls: 'c-cyan' });
    fill(13.5, 15);
    // bar 16.5: an escort: roll its shot home and the plotter breaks mid-line (the rings go round the line's end anyway)
    plot(16.5, [[1.25, 0.3], [-0.5, -0.2]], { from: 3.0, to: 0.6, escort: { at: 2.8, side: -1 } });
    through(16.5, -0.8, -0.5, -0.2, -0.1);
    L.add(B(14.4), 'call', { text: 'ROLL ITS ESCORT HOME TO BREAK THE PEN', cls: 'c-cyan' });
    // bars 18-21: two lines one after another at different angles
    plot(19, V(-0.2), { from: 2.8, to: 0.8 }); through(19, 0.5, 0.2, 0.2, 0.2);
    plot(21, [[-1.25, -0.8], [0.6, 0.5]], { from: 2.8, to: 0.6 }); through(21, 0.6, -0.4, 0.5, 0);
    fill(22, 25);

    // ================= ACT 2: DEVELOP (bars 25-48): THE RULING DESKS =================
    // build one: an X (two plotters on one sheet), the rings through one of its four open triangles
    const X = (bar, o1 = {}, o2 = {}) => { plot(bar, [[-1.25, 1.25], [1.25, -1.25]], Object.assign({ from: 2.8, to: 0.6 }, o1)); plot(bar, [[-1.25, -1.25], [1.25, 1.25]], Object.assign({ from: 2.6, to: 0.4 }, o2)); };
    X(27); through(27, 0.75, 0, 0.3, 0);
    mineAt(29.5, -0.4, 0.3); line(B(29), 0.3, -0.3, 0.3, -0.3, 5, 24);
    X(31, {}, { escort: { at: 2.8, side: 1 } }); through(31, 0, 0.65, 0.2, 0.3);
    fill(32, 34);
    // drop one (speed at bar 33; density from 34): X pairs, an augur, lines that pop when you pass close
    plot(35, H(0.2), { from: 2.6, to: 0.4, pop: 2 }); through(35, 0.1, -0.5, 0.4, -0.3);
    aug(35.5, 1.35, 0.6); line(B(36) + 20, 0, -0.4, -0.5, 0.2, 5, 24);
    X(38.5, { escort: { at: 2.8, side: 1 } }); through(38.5, -0.75, 0, -0.3, 0.2);
    // the peak: two sheets close together, an augur over them, a mine cluster
    plot(40.5, V(0.15), { from: 2.6, to: 0.4, pop: 2 }); through(40.5, -0.45, 0.3, -0.6, 0.3);
    plot(41.5, H(-0.1, -1.25, 0.35), { from: 2.4, to: 0.4, pop: 1 }); through(41.5, 0.4, 0.45, -0.2, 0.2);
    aug(41, -1.35, 0.5);
    mineAt(43.2, 0.2, 0.45); podAt(43.8, -0.4, -0.2, { shots: 2 }); line(B(43), -0.4, -0.4, 0.4, -0.4, 5, 24);
    fill(45, 49);

    // ================= ACT 3: TWIST (bars 49-64): THE SIGNATURE =================
    line(B(49.5), 0, 0.2, -0.5, 0, 6, 26); line(B(50.5) + 20, -0.5, 0, -0.5, 0, 3, 26);
    // bar 53: a looping curve written across the sheet, left to right; the pen is still writing as the sheet reaches you,
    // so its loops close off everything behind it. The rings lead you ahead of the pen.
    plot(53, signature(-1.25, 1.2, 9), { from: 3.4, to: -1.6, spacing: 1.45 });
    line(B(53) - 160, -0.5, 0, 0.84, 0.1, 6, 26); line(B(53) + 4, 0.86, 0.1, 0.86, 0.1, 2, 22);
    L.add(B(50.8), 'call', { text: 'GET AHEAD OF THE PEN', cls: 'c-cyan' });
    fill(54.2, 55.6);
    // PHASE on the ring line, then a finished patch of mines with the Shield Cell and a cache just behind it. The clues: a
    // green glow bleeding round the patch, green and amber sparks drifting out (the plan's 6.4). The counting rings go
    // round it; the cache is never in the ring total (12.4), and Phase never opens a way to rings that count.
    const pd = B(57.6);
    line(pd - 360, 0.4, 0.3, 0, 0, 4, 22);
    add(pd - 360 + 4 * 22 + 10, 'phase', { nx: 0, ny: 0 }); line(pd - 360 + 4 * 22 + 34, 0, 0, 0, 0, 3, 22); // about 2 s before the patch: Phase runs 4 s
    plot(57.6, hatch(0, 0, 0.62, 0.5, 4), { from: 3.4, to: 1.7, spacing: 1.2 });
    add(pd, 'g3-l5-clue', { nx: 0, ny: 0, w: 6, h: 4.5, decor: true });
    add(pd + 3, 'shield-cell', { nx: 0, ny: 0, noMagnet: true });
    line(pd + 8, 0, 0, 0, 0, 3, 7, 'ring', { cache: true });
    line(pd - 70, 0.6, 0.55, 0.7, 0.6, 3, 24); line(pd + 4, 0.7, 0.6, 0.4, 0.3, 3, 24);
    // build two: the Signature again, written right to left, with an escort; the rings lead you ahead of the pen (left)
    plot(61, signature(1.25, -1.2, 9), { from: 3.4, to: -1.6, spacing: 1.45, escort: { at: 2.9, side: 1 } });
    line(B(61) - 160, 0.3, 0.2, -0.84, -0.1, 6, 26); line(B(61) + 4, -0.86, -0.1, -0.86, -0.1, 2, 22);
    // the lead-in: SLIPSTREAM on the line, 3 s before the table (nothing within 10 s of it is an Overclock or a Mirror Shell)
    line(B(62.9), -0.5, 0, 0, 0, 4, 24);
    add(B(64.2), 'slipstream', { nx: 0, ny: 0 }); // 3 s before the first sheet
    line(B(64.2) + 24, 0, 0, 0, 0.1, 3, 24);

    // ================= ACT 4: MASTER (bars 65-88): THE DRAFTING TABLE, THE FAIR COPY =================
    // THE DRAFTING TABLE: four sheets, a bar and a half apart; on each one pen hatches a band over half the sheet at speed,
    // leaving a window, and the windows move round; the rings are the solution. Each pen finishes 0.35 s before its sheet
    // reaches you (its last strokes still wet), so every window is there as drawn.
    plot(66, bandV(-1.15, 0.12), { from: 2.6, to: 0.35, spacing: 1.45 }); through(66, 0.62, 0, 0.1, 0.1);
    plot(67.5, bandV(-0.12, 1.15).reverse(), { from: 2.6, to: 0.35, spacing: 1.45 }); through(67.5, -0.62, 0.2, 0.4, 0);
    plot(69, bandH(-1.15, 0.1), { from: 2.6, to: 0.35, spacing: 1.45 }); through(69, -0.1, 0.62, -0.5, 0.3);
    plot(70.5, bandH(-0.1, 1.15).reverse(), { from: 2.6, to: 0.35, spacing: 1.45 }); through(70.5, 0.3, -0.62, 0, 0.5);
    // the snap-back lands on rings only
    line(B(72), -0.3, -0.2, 0, 0, 5, 26); sine(B(73.5), 8, 24, 0.45, 0.35, 1);
    // THE FAIR COPY: the last exam at full speed, a step less than the table
    X(77.5, { escort: { at: 2.8, side: 1 } }); through(77.5, 0, -0.65, 0, -0.3);
    aug(79, -1.35, 0.55); line(B(79) + 30, 0, -0.5, 0.5, 0.1, 5, 24);
    plot(81.5, V(-0.1), { from: 2.4, to: -0.6, pop: 2 }); through(81.5, -0.75, 0, -0.4, 0.2);
    mineAt(83.5, 0.4, -0.3); podAt(84, -0.3, 0.4); line(B(83), -0.2, 0.3, 0.4, 0.3, 5, 24);
    plot(85.5, H(-0.25), { from: 2.6, to: 0.5 }); through(85.5, 0.2, 0.45, 0.2, 0.2);
    // outro: rings to the line
    sine(B(87.2), 12, 24, 0.5, 0.4, 0);
  },
});
