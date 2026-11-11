// GALAXY 2, LEVEL 7: BLOOMFALL (the plan, projects/starwake-galaxies.md 3.7; Yori's look sheet level-g2-07).
// THE HEADLINE (rule 20): seed-bolts blossom into a fan unless you roll them early. A grafted anemone, the BLOOMER,
// fires a fat slow seed; 60% of the way in it cracks white along five lines and bursts into a fan of five. Roll it as it
// cracks and it goes home whole (NIPPED IN THE BUD!); let it bloom and roll the fan's middle for MULTI-DEFLECT x5, or
// dodge wide. The level teaches the fan harmlessly first (rule 17), then the early roll, then takes dodging away in THE
// MEADOW (coral walls make a corridor: roll the fan in its middle), then THE FULL BLOOM: a field of bloomers opening
// on the drop, ten seeds in a rhythm, sent home in a chain.
//
// THE MUSIC (rule 30): g2/level7/music, melodic techno with a blossoming lead, 142 bpm, F# minor, 94 bars planned
// (Intro 1-8 | Groove 9-24 | Build one 25-32 | Drop one 33-48 | Breakdown 49-56 | Build two 57-64 | Drop two 65-80 |
// Drive 81-88 | Outro 89-94). The take is still to come (ElevenLabs credits): a galaxy 1 stand-in plays meanwhile. Bars
// here count from 0 (the music's bar n is bar n-1 here). When the take lands, set BPM and FIRST_BEAT from its .json.
//   ACT 1  THE ORCHID SHALLOWS  bars  0-24   84 m/s  intro + groove: the fan seen harmlessly; then roll it early
//   ACT 2  THE SEED GARDEN      bars 24-48  106 m/s  build one + drop one: seeds and fans, pairs, seekers
//   ACT 3  THE MEADOW           bars 48-64  124 m/s  breakdown + build two: coral walls, a corridor; MIRROR SHELL
//   ACT 4  THE FULL BLOOM       bars 64-80  142 m/s  drop two: SET PIECE, ten seeds in a rhythm; OVERCLOCK before it
//          THE FLOWER NEBULA    bars 80-92  160 m/s  the drive, a step less dense, then the outro to the finish
import { defineLevel, clamp } from '../../api.js?v=0.6.2';
import ring from '../../pickups/ring/index.js?v=0.6.2';
import { overclock, mirrorShell } from '../../pickups/powerups/index.js?v=0.6.2';
import seeker from '../../enemies/seeker-drone/index.js?v=0.6.2';
import bloomer from '../../enemies/g2-bloomer/index.js?v=0.6.2';
import { petalCluster, meadowBank, meadowWall, petals, banks, flowerNebula } from './level7/scenery.js?v=0.6.2';

// ---- the music grid and the speed curve, one schedule (rule 30). The plan's tempo until the take's .json lands.
const BPM = 142, FIRST_BEAT = 0, BAR_S = 240 / BPM;
// [bar, m/s]: the speed steps up at the start of each act, eased over half a bar (84 -> 160, the plan's 3.7)
const STEPS = [[0, 84], [24, 106], [48, 124], [64, 142], [80, 160]];
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
// how far out a bloomer fires its seed (metres): it is laid that far past the bar it fires on
const FIRE_D = 290;

// Yori's palette for Bloomfall: sky 140a1e, gas d070ff / ffd8f0 / 5a2a7a, fog 2a1a3a, key fff0ff, fill 6a2a8a, accent
// ff9ae0. Orchid and white; the Meadow leans jade (the galaxy's own gas, 2a9a6a) so its corridor reads as coral.
const look = (sky, a, b, c, fog, o = {}) => Object.assign({ sky: [sky, 'rgba(' + a + ',A)', 'rgba(' + b + ',A)', 'rgba(' + c + ',A)'], fog, hemiSky: 0xfff0ff, hemiGround: 0x2a1a3a, sun: 0xfff0ff, band: 0.5, gas: 0.7, cloud: 0xd070ff, clouds: 0.2, starGlow: 0.8 }, o);

export default defineLevel({
  g: 2, n: 7, id: 'bloomfall', name: 'BLOOMFALL',
  idea: 'Seed-bolts blossom into a fan unless you roll them early.',
  seed: 207007,
  length: LEVEL_END,
  speed,
  music: { track: 'g2/level7/music' },
  bossMusic: null,
  sfx: [{ id: 'g2-bloom', gain: 0.6 }, { id: 'g2-graft-crack', gain: 0.6 }],
  // style minimums [grazes + close calls, deflects], sized as galaxy 1's were: from the decent human bot (11-07, seeds
  // 1-2: close 21 and 15, deflects 39 and 42), A about a quarter of that, S 40%, DEGENERATE 60%
  // close calls lowered (MCP ruling 11-07): a clean flyer has to be able to earn S (the good bot with power-ups off grazed 1 and 3
  // times and stopped at three stars); deflects still carry the grade
  style: { A: [1, 10], S: [1, 16], DEGENERATE: [3, 24] },
  sections: [
    { id: 'shallows', name: 'THE ORCHID SHALLOWS', sub: 'SECTOR 1', d0: 0, d1: A1, look: 'shallows', scenery: { 'g2-l7-petals': 1, 'g2-l7-banks': 0.6, 'g2-l7-flower': 1 } },
    { id: 'garden', name: 'THE SEED GARDEN', sub: 'SECTOR 2', d0: A1, d1: A2, look: 'garden', scenery: { 'g2-l7-petals': 1, 'g2-l7-banks': 1, 'g2-l7-flower': 1 } },
    { id: 'meadow', name: 'THE MEADOW', sub: 'SECTOR 3', d0: A2, d1: A3, look: 'meadow', scenery: { 'g2-l7-petals': 0.7, 'g2-l7-banks': 1, 'g2-l7-flower': 0.7 } },
    { id: 'bloom', name: 'THE FULL BLOOM', sub: 'SECTOR 4', d0: A3, d1: A4, look: 'bloom', scenery: { 'g2-l7-petals': 1, 'g2-l7-banks': 0.8, 'g2-l7-flower': 1 } },
    { id: 'nebula', name: 'THE FLOWER NEBULA', sub: 'SECTOR 5', d0: A4, d1: LEVEL_END, look: 'nebula', scenery: { 'g2-l7-petals': 1, 'g2-l7-banks': 0.5, 'g2-l7-flower': 1 } },
  ],
  looks: {
    shallows: look('#140a1e', '208,112,255', '255,216,240', '90,42,122', 0x2a1a3a, { seed: 2701, gas: 0.6, clouds: 0.16 }),
    garden: look('#150a20', '255,216,240', '208,112,255', '90,42,122', 0x2c1a3c, { seed: 2702, gas: 0.75 }),
    meadow: look('#0e0c1a', '42,154,106', '208,112,255', '90,42,122', 0x1e2030, { seed: 2703, gas: 0.7, cloud: 0x9a70d0, hemiGround: 0x16302a }),
    bloom: look('#180a22', '208,112,255', '255,216,240', '106,42,138', 0x30183e, { seed: 2704, gas: 0.85, clouds: 0.28, band: 0.56 }),
    nebula: look('#120a1c', '255,216,240', '90,42,122', '208,112,255', 0x261836, { seed: 2705, gas: 0.7, clouds: 0.2 }),
  },
  kinds: [ring, overclock, mirrorShell, seeker, bloomer, petalCluster, meadowBank, meadowWall],
  scenery: [petals, banks, flowerNebula],
  boss: null,
  beats: [
    { d: 0, tag: 'calm', what: 'intro: the Orchid Shallows, rings in the open, the flower-nebula far ahead' },
    { d: BAR(6.5), tag: 'calm', what: 'the lesson, harmless: a bloomer far off fires wide; its seed cracks and blooms in front of you' },
    { d: BAR(9.5), tag: 'rising', what: 'groove: seeds at you. ROLL IT AS IT CRACKS' },
    { d: BAR(16.5), tag: 'rising', what: 'or let it bloom and dodge the fan' },
    { d: BAR(22.4), tag: 'calm', what: 'rings only' },
    { d: A1, tag: 'calm', what: 'build one, speed step: the Seed Garden; a seeker joins' },
    { d: BAR(32.5), tag: 'peak', what: 'drop one: bloomers in pairs (one early roll takes both), seekers' },
    { d: BAR(44.4), tag: 'calm', what: 'rings only' },
    { d: A2, tag: 'calm', what: 'breakdown, speed step: THE MEADOW, coral walls close in to a corridor; MIRROR SHELL' },
    { d: BAR(51), tag: 'peak', what: 'TWIST: nowhere to dodge, so roll the fan in its middle (MULTI-DEFLECT)' },
    { d: BAR(60.6), tag: 'calm', what: 'the walls open out; OVERCLOCK on the ring line' },
    { d: A3, tag: 'peak', what: 'drop two, SET PIECE THE FULL BLOOM: ten seeds in a rhythm, sent home in a chain' },
    { d: BAR(72), tag: 'calm', what: 'the field falls behind; rings' },
    { d: BAR(75), tag: 'rising', what: 'fans to dodge, a seeker' },
    { d: A4, tag: 'rising', what: 'the drive, speed step: the Flower Nebula, every seed a step less dense' },
    { d: BAR(87.5), tag: 'calm', what: 'outro: rings to the finish under the open flower' },
  ],
  acts: { introduce: [0, A1], develop: [A1, A2], twist: [A2, A3], master: [A3, LEVEL_END] },
  build(R, L) {
    const { add, line, sine, clearOfRings } = L;
    // a bloomer that fires its first seed on `bar`: laid FIRE_D past it, nudged off any ring line
    const bloom = (bar, nx, ny, o = {}) => {
      const d = BAR(bar) + (o.fireAt ?? FIRE_D);
      for (const [x, y] of [[nx, ny], [nx, ny + 0.3], [nx, ny - 0.3], [-nx, ny], [nx * 0.7, -ny]]) if (clearOfRings(d, x, y, 0.42)) return add(d, 'g2-bloomer', Object.assign({ nx: x, ny: clamp(y, -0.8, 0.8) }, o));
      return add(d, 'g2-bloomer', Object.assign({ nx, ny }, o));
    };
    // a seeker that attacks around `bar` (it flies in on its own: lead and hold are its kind's)
    const seekerAt = (bar, nx, ny, o = {}) => add(BAR(bar) - 3.9 * speed(BAR(bar)), 'seeker-drone', Object.assign({ nx, ny, shots: 2 }, o));
    // ring patterns end to end between two bars (rule 7: a ring is never far after a hit). 'corridor' keeps inside the
    // Meadow's walls (|x| under 1.6 m in landscape, a little more in portrait).
    // The spacing follows the speed (a ring every ~0.19 s of flight, never under 22 m) and the reach narrows above
    // 130 m/s, so the same patterns stay flyable from 84 to 160 m/s.
    const rings = (b0, b1, style) => {
      let d = BAR(b0); const end = BAR(b1); let k = 0;
      while (d < end - 60) {
        const v = speed(d), st = Math.max(22, v * 0.19), a = v > 130 ? 0.8 : 1;
        let next;
        if (style === 'corridor') { const p = k++ % 3; next = p === 0 ? line(d, 0, R.range(-0.5, 0.5), 0, R.range(-0.5, 0.5), 5, st) : p === 1 ? sine(d, 10, st, 0.16, 0.4, R() * 6) : line(d, R.range(-0.18, 0.18), 0.55, R.range(-0.18, 0.18), -0.5, 5, st); }
        else {
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

    // ======== ACT 1, THE ORCHID SHALLOWS (introduce). Intro bars 0-8: rings, then the fan seen harmlessly (rules 4, 17, 18)
    rings(0.6, 6.2, 'mixed');
    add(BAR(5.2), 'call', { text: 'WATCH THE SEED', cls: 'c-mag' });
    bloom(6.5, 0.55, 0.5, { mode: 'wide', fireAt: 340 });          // its seed goes wide, cracks and blooms in front of you
    rings(7.6, 9.2, 'mixed');
    // groove: now at you. Roll it as it cracks
    add(BAR(9.0), 'call', { text: 'ROLL IT AS IT CRACKS', cls: 'c-cyan' });
    bloom(10.4, 0.0, 0.55);
    rings(11, 12.6, 'mixed');
    bloom(13.2, -0.5, 0.45);
    rings(13.8, 15.4, 'mixed');
    bloom(15.8, 0.5, -0.35);
    add(BAR(16.6), 'call', { text: 'OR LET IT BLOOM AND DODGE', cls: 'c-mag' });
    rings(16.4, 22.4, 'mixed');
    bloom(17.8, -0.6, 0.4);
    bloom(19.8, 0.6, 0.45);
    bloom(21.4, -0.35, -0.45);
    rings(22.6, 24, 'swirl');                                          // 22.4-24: rings only

    // ======== ACT 2, THE SEED GARDEN (develop). Build one 24-32, drop one 32-48 (the first peak)
    rings(24.3, 44.4, 'mixed');
    bloom(25.6, 0.5, 0.5);
    seekerAt(27.4, -0.45, 0.4, { shots: 2 });
    bloom(28.6, -0.55, -0.4);
    bloom(30.2, 0.3, -0.45, { seeds: 2, gap: 1.3 });
    // drop one: pairs from both sides at once (one early roll takes both: MULTI-DEFLECT x2)
    bloom(32.6, -0.62, 0.45); bloom(32.6, 0.62, 0.45);
    bloom(34.6, 0.0, 0.6, { seeds: 2, gap: 1.25 });
    seekerAt(36.4, 0.5, 0.5, { shots: 2 });
    bloom(37.2, -0.5, -0.4); bloom(37.6, 0.5, -0.4);
    bloom(39.6, 0.6, 0.5, { seeds: 2, gap: 1.3 });
    bloom(41.6, -0.62, 0.5); bloom(41.6, 0.62, 0.5);
    bloom(43.2, 0.0, -0.5);
    rings(44.6, 48, 'swirl');                                          // 44.4-48: rings only

    // ======== ACT 3, THE MEADOW (twist): coral walls make a corridor; dodging wide is gone, so roll the fan's middle.
    // The walls from bar 48.4 to 62.2, a piece every 16 m both sides. The bloomers grow out of the walls.
    for (let d = BAR(48.4); d < BAR(62.2); d += 16) { add(d, 'g2-l7-wall', { side: 1 }); add(d, 'g2-l7-wall', { side: -1 }); }
    rings(48.8, 62.4, 'corridor');
    // MIRROR SHELL on the ring line at the corridor's mouth: its reach takes a whole fan, even from off-centre
    add(BAR(49.4), 'mirror-shell', { nx: 0, ny: 0 });
    add(BAR(49.9), 'call', { text: 'NOWHERE TO DODGE: ROLL THE MIDDLE', cls: 'c-cyan' });
    // the bloomers grow from the walls' upper and lower edges, in plain view at the corridor's corners
    const wallBloom = (bar, s, ny, o = {}) => add(BAR(bar) + FIRE_D, 'g2-bloomer', Object.assign({ nx: s * 0.38, ny, s: 1.2 }, o));
    wallBloom(51.0, 1, 0.8);
    wallBloom(52.6, -1, 0.8);
    wallBloom(54.2, 1, -0.8);
    wallBloom(55.8, -1, 0.8); wallBloom(55.8, 1, 0.8);
    wallBloom(57.6, 1, 0.8, { seeds: 2, gap: 1.1 });
    wallBloom(59.4, -1, -0.8, { seeds: 2, gap: 1.1 });
    // 60.6-64: the walls open out; OVERCLOCK on the ring line, 2.3 s before the Full Bloom (every seed, back to back)
    add(BAR(62.6), 'overclock', { nx: 0, ny: 0.1 });
    line(BAR(62.75), 0, 0.1, 0, 0.1, 3, 22);
    add(BAR(62.9), 'call', { text: 'SEND THEM ALL HOME', cls: 'c-cyan' });

    // ======== ACT 4, THE FULL BLOOM (master): the set piece on drop two. A field of bloomers opens; ten seeds in a
    // rhythm (0.75 to 1 bar apart: every one rollable on the roll's own recharge, and back to back under OVERCLOCK).
    const FIELD = [[-0.6, 0.5], [0.6, 0.5], [0.0, 0.62], [-0.62, -0.35], [0.62, -0.35], [-0.3, 0.55], [0.3, -0.5], [0.6, 0.2], [-0.6, 0.2], [0.0, -0.55]];
    const RHYTHM = [64, 64.75, 65.5, 66.5, 67.25, 68, 69, 69.75, 70.5, 71.5];
    RHYTHM.forEach((b, i) => add(BAR(b) + FIRE_D, 'g2-bloomer', { nx: FIELD[i][0], ny: FIELD[i][1], s: 1.3 }));
    // the rest of the field: bloomers that open but never fire (the meadow in flower around you), off the rings
    for (let i = 0; i < 8; i++) { const b = 64 + i, x = (i % 2 ? 1 : -1) * R.range(0.8, 0.95), y = R.range(-0.75, 0.75); add(BAR(b) + 320, 'g2-bloomer', { nx: x, ny: y, seeds: 0, s: R.range(1.0, 1.4) }); }
    sine(BAR(64.1), 30, 26, 0.32, 0.28, 0);                           // one slow swirl of rings through the field
    rings(72.2, 87.6, 'mixed');
    bloom(75.2, 0.55, 0.45);
    seekerAt(76.4, -0.5, 0.45, { shots: 2 });
    bloom(77.4, -0.6, -0.35);
    // ======== THE FLOWER NEBULA: the drive, a step less dense than the Full Bloom
    bloom(81.0, 0.0, 0.6, { seeds: 2, gap: 1.3 });
    bloom(83.0, -0.6, 0.45); bloom(83.0, 0.6, 0.45);
    seekerAt(84.6, 0.5, 0.4, { shots: 2 });
    bloom(86.0, -0.5, -0.4);
    rings(87.8, END_BAR - 0.5, 'swirl');                              // the outro: rings only to the finish
  },
});
