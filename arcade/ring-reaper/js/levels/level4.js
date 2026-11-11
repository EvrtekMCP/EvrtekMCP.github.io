// LEVEL 4: SOLAR SKIM. Skimming a star's surface. The headline (rule 20, one idea): when the surface glows,
// a flare is coming, and the only shade is behind a shield-plate. Supporting it: the SEEKER DRONE, whose
// curving bolt cannot be sidestepped, only rolled home (it dies to its own fire: the volley for level 6).
// The course is laid out on the music's bar lines (timeline.js; rule 30): 144 bpm, the club arrangement.
//   Act 1 INTRODUCE  bars 1-16   Intro + Groove      the glow means fire; then the shade
//   Act 2 DEVELOP    bars 17-40  Build one + Drop 1  the flares sweep; the seeker
//   Act 3 TWIST      bars 41-56  the Breakdown       fire rains from ABOVE: the shade flips under the plates
//   Act 4 MASTER     bars 57-88  Build two, Drop two, Drive: the Great Flare on the drop, the mix, the escape
// Ending: off the limb into night (Drive), the star falling away beneath you.
import { defineLevel, clamp } from '../api.js?v=0.6.0';
import ringKind from '../pickups/ring/index.js?v=0.6.0';
import seeker from '../enemies/seeker-drone/index.js?v=0.6.0';
import flareKind from './level4/flare.js?v=0.6.0';
import raftKind, { RAFT_LOW, RAFT_HIGH } from './level4/raft.js?v=0.6.0';
import { surface, prominence, prominences, plateDrift, plateDrifts, greatLoop } from './level4/scenery.js?v=0.6.0';
import { at, speed, LENGTH, BAR, BEAT } from './level4/timeline.js?v=0.6.0';

const LEAD1 = 3 * BEAT, LEAD = 2.5 * BEAT;   // eruption lead: 1.25 s while the idea is new (rule 12: 1.2 s+), 1.04 s after

export default defineLevel({
  n: 4, id: 'solar', name: 'SOLAR SKIM',
  idea: 'When the star glows a flare is coming: duck into a shield-plate\'s shadow.',
  seed: 404,
  length: LENGTH,
  speed,
  music: { track: 'levels/level4/music' }, // l4-t1: 144.002 bpm, first beat 0.2013 s, its sections on the bars above
  bossMusic: null,
  sfx: [{ id: 'flare-roar', gain: 0.48 }],
  // 0.2.0 ranked by score from a NON-god autopilot run (490,243) (NOGOD=1 tools/test/run.js popin - 4): 332 of 335 rings, 1 hit, 8 kills
  sections: [
    { id: 'shore', name: 'THE BRIGHT SHORE', sub: 'SECTOR 1', d0: 0, d1: at(17), look: 'shore',
      scenery: { 'l4-surface': 1, 'l4-prominences': 0.55, 'l4-plate-drifts': 0.7, 'l4-great-loop': 1 } },
    { id: 'alley', name: 'FLARE ALLEY', sub: 'SECTOR 2', d0: at(17), d1: at(41), look: 'alley',
      scenery: { 'l4-surface': 1, 'l4-prominences': 0.45, 'l4-plate-drifts': 1, 'l4-great-loop': 1 } },
    { id: 'arches', name: 'UNDER THE ARCHES', sub: 'SECTOR 3', d0: at(41), d1: at(57), look: 'arches',
      scenery: { 'l4-surface': 1, 'l4-prominences': 1, 'l4-plate-drifts': 0.5, 'l4-great-loop': 0.7 } },
    { id: 'great', name: 'THE GREAT FLARE', sub: 'SECTOR 4', d0: at(57), d1: at(81), look: 'great',
      scenery: { 'l4-surface': 1, 'l4-prominences': 0.7, 'l4-plate-drifts': 0.8, 'l4-great-loop': 1 } },
    { id: 'limb', name: 'OFF THE LIMB', sub: 'FINAL STRETCH', d0: at(81), d1: LENGTH, look: 'limb',
      scenery: { 'l4-surface': (t) => clamp(1 - t * 1.4, 0, 1), 'l4-prominences': (t) => 0.2 + 0.4 * (1 - t), 'l4-plate-drifts': 1, 'l4-great-loop': (t) => 1 - 0.5 * t } },   // the star falls away; the plates and the great loop stay (ruling 5)
  ],
  // Yori's palette for level 4 (levels/palettes.js): sky 2a0818, gas ff5a8a / ff7a3a / 6a1a5a, fog 8a2a4a,
  // key fff0d0 (from BELOW: the star lights everything from underneath), fill 4a1040. Never hazard red: her pink
  // gas (ff5a8a) and fog sat within 12 degrees of the hurts hue (rule 9, tools/check-levels.js), so both are pushed
  // to magenta here (ff5ab4, 8a2a5c), which is her own note: "magenta and deep orange, never red".
  looks: {
    shore: { sky: ['#2a0818', 'rgba(255,90,180,A)', 'rgba(255,122,58,A)', 'rgba(106,26,90,A)'], fog: 0x8a2a5c,
      hemiSky: 0x4a1040, hemiGround: 0xffb08a, sun: 0xfff0d0, band: 0.6, gas: 0.6, cloud: 0xff7a5a, clouds: 0.1, seed: 401 },
    alley: { sky: ['#260614', 'rgba(255,122,58,A)', 'rgba(255,90,180,A)', 'rgba(106,26,90,A)'], fog: 0x8a2a60,
      hemiSky: 0x4a1040, hemiGround: 0xffa070, sun: 0xfff0d0, band: 0.6, gas: 0.7, cloud: 0xff8a5a, clouds: 0.14, seed: 402 },
    arches: { sky: ['#1c0618', 'rgba(106,26,90,A)', 'rgba(255,90,180,A)', 'rgba(150,60,200,A)'], fog: 0x5e1a4c,
      hemiSky: 0x6a2a80, hemiGround: 0xff9a90, sun: 0xffe8f0, band: 0.58, gas: 0.6, cloud: 0xc060c0, clouds: 0.08, seed: 403 },
    great: { sky: ['#260a1c', 'rgba(255,122,58,A)', 'rgba(255,90,180,A)', 'rgba(255,170,90,A)'], fog: 0x8a4030,
      hemiSky: 0x4a1040, hemiGround: 0xffb070, sun: 0xfff4e0, band: 0.62, gas: 0.85, cloud: 0xff9a5a, clouds: 0.18, seed: 404 },
    limb: { sky: ['#04020a', 'rgba(70,30,110,A)', 'rgba(255,122,58,A)', 'rgba(40,20,80,A)'], fog: 0x120818,
      hemiSky: 0x302050, hemiGround: 0x8a3a6a, sun: 0xffe8d8, band: 0.7, gas: 0.25, cloud: 0x6040a0, clouds: 0, seed: 405, stars: 2600 },
  },
  kinds: [ringKind, flareKind, raftKind, seeker, prominence, plateDrift],
  scenery: [surface, prominences, plateDrifts, greatLoop],
  // rule 1: the beat sheet (bars: timeline.js puts each on the music's grid)
  beats: [
    { d: at(1), tag: 'calm', what: 'over the star: rings in the open, a prominence overhead' },
    { d: at(5), tag: 'rising', what: 'the first flare, alone and aside: a white-hot band, then fire' },
    { d: at(9.25), tag: 'calm', what: 'the first shield-plate raft, no fire yet: rings in its violet shade' },
    { d: at(11), tag: 'rising', what: 'fire beside the raft: take the shade or the open lane' },
    { d: at(13.25), tag: 'peak', what: 'the first full surge: only the shade is safe' },
    { d: at(15), tag: 'rising', what: 'left, then right: flares on the beat' },
    { d: at(17), tag: 'calm', what: 'speed step; the first seeker drone alone (its first bolt only grazes)' },
    { d: at(23), tag: 'rising', what: 'the flares start to sweep across the lanes' },
    { d: at(25), tag: 'peak', what: 'Drop one: sweeps both ways, then a full sweep over a raft' },
    { d: at(29.5), tag: 'peak', what: 'a seeker over the sweeps: roll while you dodge' },
    { d: at(35.5), tag: 'calm', what: 'breather: a corkscrew under an arch' },
    { d: at(38.5), tag: 'peak', what: 'the gauntlet: both sides burn, a seeker over the middle lane' },
    { d: at(41), tag: 'calm', what: 'the breakdown, under the arches: the plates now hang high' },
    { d: at(45.25), tag: 'rising', what: 'the twist: fire rains from above, alone and aside' },
    { d: at(50), tag: 'peak', what: 'a full rain over a high raft: the shade is under it' },
    { d: at(52.75), tag: 'peak', what: 'below, then above: read which way the shade falls' },
    { d: at(55.5), tag: 'rising', what: 'a seeker pair' },
    { d: at(57), tag: 'rising', what: 'speed step; sweeps from below and from above' },
    { d: at(63.5), tag: 'calm', what: 'the lead-in: rings climbing, nothing burns' },
    { d: at(65), tag: 'peak', what: 'THE GREAT FLARE: the whole star erupts on the drop; a snaking raft through it' },
    { d: at(70), tag: 'calm', what: 'release' },
    { d: at(71.5), tag: 'rising', what: 'the mastery mix: a sweep, a seeker pair, rain over a raft' },
    { d: at(79.75), tag: 'calm', what: 'the fire falls behind' },
    { d: at(81), tag: 'calm', what: 'OFF THE LIMB: the star falls away into night; rings to the finish' },
  ],
  acts: { introduce: [0, at(17)], develop: [at(17), at(41)], twist: [at(41), at(57)], master: [at(57), LENGTH] },
  // 0.4.0, the galaxy 1 retrofit (the plan's 6.5; nothing else in the level moves, no ring is added or moved):
  // SOLAR SKIM: Overclock in Flare Alley, 2 s before the seeker over the gauntlet (the first, alone, stays the lesson); the Shield Cell behind a risk, in a raft's shade under a burning flare.
  powerups: [[5293, 'overclock', 0.045, -0.23], [7862, 'shield-cell', 0.45, 0]],
  build(R, L) {
    const { add, ring } = L;
    // a flare that ERUPTS on bar b (on the grid) and burns `bars` bars at the ship; returns the bar it arrives
    const flare = (b, bars, o = {}) => {
      const lead = o.lead || LEAD, arr = b + lead / BAR, d = at(arr);
      add(d, 'l4-flare', Object.assign({ len: Math.round(at(arr + bars) - d), lead }, o));
      return arr;
    };
    const raft = (b0, b1, o = {}) => { const d = at(b0); return add(d, 'l4-raft', Object.assign({ len: Math.round(at(b1) - d) }, o)); };
    // the centre of a raft's corridor (normalised) where it is at course distance d: raft.js's line, settled
    const cxAt = (ev, d) => {
      const u = d - ev.d, k = clamp(u / ev.len, 0, 1), x0 = ev.nx || 0, x1 = ev.nx2 ?? x0;
      return x0 + (x1 - x0) * k + (ev.snake || 0) * Math.sin((ev.ph || 0) + (ev.waves || 1) * Math.PI * 2 * u / ev.len);
    };
    const yOf = (ev) => ev.ny ?? (ev.from === 'above' ? RAFT_HIGH : RAFT_LOW);
    // rings in a raft's shade: well above a low one; mid-box under a high one (it floats above the box)
    const shade = (ev, ny) => (b) => [cxAt(ev, at(b)), ny ?? (ev.from === 'above' ? 0.0 : yOf(ev) + 0.62)];
    // rings every `step` beats from bar b0 to b1 on path(b) -> [nx, ny]
    const chain = (b0, b1, path, step = 1) => { for (let b = b0; b <= b1 + 1e-6; b += step / 4) { const [nx, ny] = path(b); ring(at(b), nx, ny); } };
    // a seeker whose first tell starts on bar b (it flies in for 3.2 s and waits first)
    const seekerAt = (b, o = {}) => add(at(b - (3.2 + (o.first ? 1.0 : 0.7)) / BAR), 'seeker-drone', o);
    const arch = (b, k = 2, x = 0) => add(at(b), 'l4-prominence', { x, k, decor: true });

    // ================= ACT 1, INTRODUCE (bars 1-16): the glow means fire; then the shade =================
    chain(3.0, 4.75, (b) => [0.42 * Math.sin((b - 1.75) * 1.1), -0.15 + 0.1 * Math.sin(b * 2)], 1);   // from ~280 m, as level 1
    arch(3.25, 1.5);
    flare(5, 1, { x0: 0.3, x1: 1.3, lead: LEAD1 });                       // alone, aside: doing nothing is safe
    chain(5.25, 6.75, () => [-0.45, -0.1], 1);
    ring(at(6.5), 0.08, 0.15);                                            // the risk line: close to the fire pays
    flare(7.5, 1, { x0: -1.3, x1: -0.05, lead: LEAD1 });
    chain(8.0, 9.0, () => [0.45, 0.05], 1);
    const r1 = raft(9.25, 13.0, { nx: -0.35, nx2: -0.15, w: 0.38, slide: 0.6 });   // the shade, alone, before any fire
    chain(9.75, 11.0, shade(r1), 1);
    flare(11, 1.25, { x0: -1.3, x1: 0.2, lead: LEAD1 });                  // two answers: the shade or the open lane
    chain(11.5, 12.75, shade(r1), 0.5);
    const r2 = raft(13.25, 15.25, { nx: 0.25, nx2: 0.3, w: 0.4, slide: -0.7 });
    flare(13.25, 1.25, { x0: -1.3, x1: 1.3, lead: LEAD1 });               // the first surge: only the shade
    chain(13.5, 15.0, shade(r2), 0.5);
    flare(15, 0.5, { x0: -1.3, x1: 0.0 });                                // left burns, then right: on the beat
    flare(16, 0.5, { x0: 0.0, x1: 1.3 });                                  // (half a bar to cross between them)
    chain(15.625, 16.0, () => [0.5, 0.0], 0.5);
    chain(16.75, 17.0, () => [-0.5, 0.0], 0.5);

    // ================= ACT 2, DEVELOP (bars 17-40): the flares sweep; the seeker =================
    seekerAt(18.5, { nx: 0.35, ny: 0.62, first: true, shots: 2 });      // alone; its first bolt grazes you
    chain(17.25, 22.5, (b) => [-0.25 + 0.3 * Math.sin(b * 0.9), -0.35], 1);
    flare(23, 1.25, { x0: 0.25, x1: 1.3, x0b: -0.35, x1b: 0.7 });          // the first sweep, gentle
    chain(23.75, 24.75, (b) => [-0.62 - 0.12 * (b - 23.75), -0.1], 1);
    ring(at(25.0), -0.75, -0.1);                                          // hold: the sweep's tail still burns the middle
    flare(25, 1.5, { x0: -1.3, x1: -0.25, x0b: -0.7, x1b: 0.35 });        // Drop one: mirrored
    chain(25.75, 27.0, (b) => [0.62 + 0.12 * (b - 25.75), 0.05], 1);
    const r3 = raft(27.25, 29.75, { nx: 0, w: 0.38, slide: 0.5 });
    flare(27, 2, { x0: -1.3, x1: -0.6, x0b: 0.6, x1b: 1.3 });             // a full sweep: only the shade
    chain(27.75, 29.5, shade(r3), 0.5);
    seekerAt(29.5, { nx: -0.5, ny: 0.6, shots: 3 });
    flare(31, 1.25, { x0: 0.2, x1: 1.3, x0b: -0.5, x1b: 0.6 });
    chain(31.75, 32.75, (b) => [-0.7, -0.25 + 0.2 * Math.sin(b * 3)], 1);
    const r4 = raft(33.25, 35.75, { nx: -0.1, nx2: 0.15, w: 0.38, slide: -0.5 });
    flare(33, 1.75, { x0: 0.6, x1: 1.3, x0b: -1.3, x1b: -0.6 });          // a full sweep the other way
    chain(33.75, 35.5, shade(r4), 0.5);
    chain(36.0, 38.25, (b) => [0.5 * Math.sin((b - 36) * 2.2), 0.45 * Math.cos((b - 36) * 2.2)], 1);   // breather
    arch(36.75, 2.2);
    seekerAt(38.25, { nx: 0, ny: 0.72, shots: 2 });
    flare(38.5, 1, { x0: -1.3, x1: -0.35 }); flare(38.5, 1, { x0: 0.35, x1: 1.3 });   // the gauntlet: the middle lane
    chain(39.25, 40.0, () => [0, -0.1], 0.5);

    // ================= ACT 3, TWIST (bars 41-56, the breakdown): fire rains from above =================
    chain(41.0, 44.75, (b) => [0.6 * Math.sin((b - 41) * 1.4), 0.5 * Math.cos((b - 41) * 1.4) - 0.1], 1);
    arch(41.5, 2.3); arch(43.25, 1.8, -4);
    const r5 = raft(43.5, 46.0, { from: 'above', nx: 0.3, w: 0.4, slide: -0.5 });   // plates hang high now: shade under
    chain(44.75, 45.5, shade(r5), 1);
    flare(45.25, 1, { from: 'above', x0: -1.3, x1: -0.1, lead: LEAD1 });  // alone and aside: doing nothing is safe
    chain(46.0, 47.0, () => [0.5, -0.1], 1);
    const r6 = raft(47.75, 49.75, { from: 'above', nx: 0.45, w: 0.4, slide: 0.4 });
    flare(47.5, 1.25, { from: 'above', x0: -0.3, x1: 1.3, lead: LEAD1 }); // under the raft, or the open lane
    chain(48.25, 49.5, shade(r6), 0.5);
    const r7 = raft(50.25, 52.25, { from: 'above', nx: -0.3, nx2: -0.1, w: 0.4, slide: -0.6 });
    flare(50, 1.25, { from: 'above', x0: -1.3, x1: 1.3 });                // all of it: only under the raft
    chain(50.75, 52.0, shade(r7), 0.5);
    const r8 = raft(53.0, 54.5, { nx: 0.45, w: 0.4 });
    flare(52.75, 0.75, { x0: -1.3, x1: 1.3 });                            // from below: over the low raft ...
    chain(53.5, 54.0, shade(r8), 0.5);
    const r9 = raft(54.25, 55.75, { from: 'above', nx: -0.45, w: 0.4 });
    flare(54, 0.75, { from: 'above', x0: -1.3, x1: 1.3 });                // ... then from above: under the high one
    chain(54.75, 55.25, shade(r9), 0.5);
    seekerAt(55.5, { nx: -0.6, ny: 0.55, shots: 2 }); seekerAt(55.5, { nx: 0.6, ny: 0.5, shots: 2 });   // in step: one roll returns both
    chain(55.75, 58.0, (b) => [0.3 * Math.sin(b * 1.5), -0.45], 1);

    // ================= ACT 4, MASTER (bars 57-88) =================
    flare(58.5, 1.25, { x0: -1.3, x1: -0.2, x0b: -0.6, x1b: 0.5 });        // from below, sweeping right
    chain(59.25, 60.5, () => [0.7, 0.1], 1);                              // (to 60.5: hold until the sweep's tail passes)
    flare(60.5, 1.25, { from: 'above', x0: 0.2, x1: 1.3, x0b: -0.5, x1b: 0.6 });  // from above, sweeping left
    chain(61.25, 62.25, () => [-0.72, -0.2], 1);
    seekerAt(61.5, { nx: 0.4, ny: 0.65, shots: 2 });
    chain(63.5, 65.5, (b) => [0.4 * Math.sin((b - 63.5) * 3.1), -0.3 + 0.25 * (b - 63.5)], 0.5);   // the lead-in: climbing
    // THE GREAT FLARE: on the downbeat of Drop two the whole star erupts; a long snaking raft is the only way
    const rg = raft(65.25, 70.0, { nx: 0, w: 0.42, snake: 0.42, waves: 2, ph: 0.4 });
    flare(65, 4, { x0: -1.3, x1: 1.3, lead: LEAD1 });
    chain(66.0, 69.5, shade(rg), 0.5);
    arch(66.0, 2.4); arch(67.5, 2.6, 6); arch(69.0, 2.2, -5);
    chain(70.25, 71.25, (b) => [0.3 * Math.sin(b * 2), 0], 1);           // release
    flare(71.5, 1, { x0: 0.2, x1: 1.3, x0b: -0.6, x1b: 0.5 });
    chain(72.25, 73.25, () => [-0.72, -0.1], 1);                          // (to 73.25: hold)
    seekerAt(73, { nx: -0.55, ny: 0.62, shots: 2 }); seekerAt(73, { nx: 0.55, ny: 0.55, shots: 2 });
    chain(73.75, 75.25, (b) => [0.35 * Math.sin(b * 1.3), -0.5], 1);
    const r10 = raft(75.75, 77.5, { from: 'above', nx: 0.2, nx2: -0.2, w: 0.4, slide: 0.6 });
    flare(75.5, 1.25, { from: 'above', x0: -1.3, x1: 1.3 });
    chain(76.25, 77.5, shade(r10), 0.5);
    flare(77.75, 1.25, { x0: -1.3, x1: -0.2, x0b: -0.5, x1b: 0.6 });      // the last one: an easy sweep to close
    chain(78.5, 79.5, () => [0.72, 0.15], 1);
    // OFF THE LIMB (Drive): nothing burns; the star falls away; a corkscrew of rings to the finish
    chain(80.0, 80.75, () => [0.4, 0.2], 1);
    chain(81.25, 88.5, (b) => { const k = (b - 81.25) / 7.25, a = (b - 81.25) * 2.6; return [(0.65 - 0.3 * k) * Math.sin(a), (0.55 - 0.25 * k) * Math.cos(a)]; }, 1);
  },
});
