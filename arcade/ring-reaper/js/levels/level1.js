// LEVEL 1: NEBULA RUN. 0.1.0's one level as the first module, laid out by 0.1.0's own code from the same seed.
// 0.2.0 changes only what you see: nothing pops in, and every stretch has scenery (ruling 5).
// 0.4.0, the ramp (Evrtek 11-07, the first outside playtester: level two was "ultra high", "so much of a difficulty
// upswing into that level that it's really difficult for players to stay with it"): played SECOND, after flight
// school, so it is gentler throughout and sits between levels 1 and 3. The Quiet Colossus's girders stay (he called them
// cool): they sit off the middle, so holding still is safe and the rings lead round the wide side, they come further
// apart, the four-way cross waits for the second half, and fewer pods, strafers and mines are layered on top. Fewer
// pods and strafers everywhere, single bursts, thinner rocks. One new thing (Evrtek 11-07, "staggered to introduce new
// complexity"): solid structures in the lane, so the lightgates (a second new thing) are gone and their sector is the
// structures' last act, THE BEACON FIELD. The roll is level 1's now, practised here. The speed, the music and both
// power-ups are where they were; check-levels now reports how far the course is from 0.1.0's.
import { defineLevel, clamp } from '../api.js?v=0.6.0';
import ring from '../pickups/ring/index.js?v=0.6.0';
import rock from '../obstacles/rock/index.js?v=0.6.0';
import crystal from '../obstacles/crystal/index.js?v=0.6.0';
import mines from '../obstacles/mines/index.js?v=0.6.0';
import { girder, pylon, rib } from '../obstacles/structure/index.js?v=0.6.0';
import pod from '../enemies/pod/index.js?v=0.6.0';
import shrike from '../enemies/shrike/index.js?v=0.6.0';
import { gasGiant, derelictFloor, derelictSkyline, crystalDrift, rockDrift, hullTowers, beaconField, hullTower, beacon } from './level1/scenery.js?v=0.6.0';

const LEVEL_END = 15000;
export default defineLevel({
  n: 2, id: 'nebula', name: 'NEBULA RUN', // played SECOND since Evrtek's swap (11-05); its file stays level1.js
  idea: 'Steer round the solid structures in the lane: the rings show the way.', // the ramp (11-07): was 'Roll into enemy fire to send it home.' (level 1 teaches the roll now)
  legacy: true, // 0.1.0's spawn-queue timing for its events (levels.js, legacyAt); the course itself is the ramp's (11-07)
  // the ramp (11-07; the MCP's ruling (a), extended to this level): with the lightgates and their mines gone there are
  // far fewer bolts to send back, and the engine's STYLE[2] (A [4, 3], S [6, 5], DEGENERATE [10, 8], sized on 0.3.0's busier
  // level) left a decent player on three stars at 92-93% of the rings. Sized from this level's own bots, the other
  // builders' rule (A about a quarter of the decent bot's grazes and close calls and of its deflects, S 40%, DEGENERATE
  // 60%): its runs had 5/9/7 and 2/2/2, so A asks 2 and 1, S 3 and 1 (a decent player reaches five stars), and DEGENERATE
  // 4 and 3, three deflects being past the decent bot's best; the good bot with power-ups off had 4/7/6 and 4/8/10. The
  // 95% ring gate guards DEGENERATE here as well (the decent bot's best was 93%). Ring gates: Evrtek's, untouched.
  style: { A: [2, 1], S: [3, 1], DEGENERATE: [4, 3] },
  seed: 7,
  length: LEVEL_END,
  // The speed keeps building: 62 at the start, 142 at the end (~2.5 minutes at this curve).
  speed: (d) => 62 + 80 * Math.pow(clamp(d / LEVEL_END, 0, 1), 0.85),
  music: { track: 'music' },
  sections: [
    { id: 'nebula', name: 'THE HALCYON DRIFT', sub: 'SECTOR 1', d0: 0, d1: 3200, scenery: { 'gas-giant': 1, 'crystal-drift': 1 } },
    { id: 'rocks', name: 'THE SHATTER BELT', sub: 'SECTOR 2', d0: 3200, d1: 6800, scenery: { 'gas-giant': 1, 'crystal-drift': 0.25, 'rock-drift': 0.5, 'derelict-skyline': (t) => (t > 0.8 ? 1 : 0) } },
    { id: 'hull', name: 'THE QUIET COLOSSUS', sub: 'SECTOR 3', d0: 6800, d1: 10600, scenery: { 'derelict-floor': 1, 'derelict-skyline': 1, 'hull-towers': 1 } },
    { id: 'gates', name: 'THE BEACON FIELD', sub: 'SECTOR 4', d0: 10600, d1: 13600, scenery: { 'gas-giant': 1, 'beacon-field': 1, 'crystal-drift': 0.5 } }, // the ramp (11-07): was THE LIGHTGATES; its look and scenery are as they were
    { id: 'final', name: 'THE LONG WAKE', sub: 'FINAL STRETCH', d0: 13600, d1: 15000, scenery: { 'gas-giant': 1, 'beacon-field': 0.6, 'crystal-drift': 1 } },
  ],
  // per-section palettes: sky [base, gas1, gas2, gas3], fog, light colours, cloud colour and thickness
  looks: {
    nebula: { sky: ['#0a0418', 'rgba(255,79,216,A)', 'rgba(120,60,255,A)', 'rgba(83,230,255,A)'], fog: 0x1a0830, hemiSky: 0xff8ae0, hemiGround: 0x1a0a40, sun: 0xffe2f4, band: 0.5, gas: 0.75, cloud: 0xff5fd0, clouds: 0.32 },
    rocks: { sky: ['#03060f', 'rgba(70,120,255,A)', 'rgba(255,140,80,A)', 'rgba(60,200,220,A)'], fog: 0x08101e, hemiSky: 0x9ab8ff, hemiGround: 0x2a1408, sun: 0xffd9b0, band: 0.46, gas: 0.7, cloud: 0x6080ff, clouds: 0.12 },
    hull: { sky: ['#020308', 'rgba(60,90,160,A)', 'rgba(255,70,120,A)', 'rgba(40,60,90,A)'], fog: 0x05070e, hemiSky: 0x8090c0, hemiGround: 0x101018, sun: 0xc8d6ff, band: 0.56, gas: 0.45, cloud: 0x405080, clouds: 0.05 },
    gates: { sky: ['#03020c', 'rgba(83,230,255,A)', 'rgba(255,79,216,A)', 'rgba(255,204,51,A)'], fog: 0x0c0620, hemiSky: 0x80f0ff, hemiGround: 0x200a30, sun: 0xffffff, band: 0.5, gas: 0.7, cloud: 0x53e6ff, clouds: 0.2 },
    final: { sky: ['#08020f', 'rgba(255,204,51,A)', 'rgba(255,79,216,A)', 'rgba(255,120,60,A)'], fog: 0x1a0612, hemiSky: 0xffd080, hemiGround: 0x300a20, sun: 0xfff0d0, band: 0.5, gas: 0.85, cloud: 0xffa040, clouds: 0.3 },
  },
  kinds: [ring, rock, crystal, mines, girder, pylon, rib, pod, shrike, hullTower, beacon],
  scenery: [gasGiant, derelictFloor, derelictSkyline, crystalDrift, rockDrift, hullTowers, beaconField],
  // rule 1: the beat sheet (calm / rising / peak), in metres
  beats: [
    { d: 0, tag: 'calm', what: 'open nebula, rings in the open' },
    { d: 600, tag: 'rising', what: 'the first crystals in the lane, still and wide apart: the new thing, solid things to steer round' },
    { d: 950, tag: 'rising', what: 'a lantern pod, one slow shot: the roll from level 1, practised' },
    { d: 3200, tag: 'rising', what: 'the Shatter Belt: rocks thicken a little; a strafer, then a pod, then another strafer' },
    { d: 6800, tag: 'calm', what: 'into the derelict: GIRDERS: FOLLOW THE RINGS. The first girder alone, off the middle; the rings show the way' },
    { d: 8600, tag: 'rising', what: 'the four-way cross: a girder and a pylon together, the rings into one quarter' },
    { d: 9200, tag: 'peak', what: 'the first mines, alone in the hull (the Overclock 3 s before); a pod low in the hull' },
    { d: 10600, tag: 'rising', what: 'the Beacon Field: the derelict\'s outer spars at speed, girders and pylons, the structures mastered' },
    { d: 11800, tag: 'peak', what: 'spars and the cross in turn; one strafer' },
    { d: 13600, tag: 'calm', what: 'the Long Wake: nothing shoots, a corkscrew of rings at full speed' },
  ],
  // rule 19: the four acts
  acts: { introduce: [0, 3200], develop: [3200, 6800], twist: [6800, 13600], master: [13600, 15000] },
  // 0.1.0's buildLevel(7), unchanged apart from where its helpers come from
  // 0.4.0, the galaxy 1 retrofit (the plan's 6.5; nothing else in the level moves, no ring is added or moved):
  // NEBULA RUN: Overclock taught here, alone, 3 s before the Quiet Colossus's first mine cluster (bar 9200 m); the Shield Cell after the Lightgates (the Beacon Field since the ramp), into the Long Wake.
  powerups: [[8884, 'overclock', 0.365, -0.14], [13715, 'shield-cell', 0.08, 0.54]],
  build(R, L) {
    const { add, ring, line, sine, clearOfRings } = L;
    // ---- 1. THE HALCYON DRIFT: learn to steer; crystals to slip round; pods that telegraph and fire slowly
    {
      let d = 260;
      const pats = [
        () => line(d, 0, 0, 0, 0),
        () => line(d, -0.6, 0, 0.6, 0),
        () => line(d, 0.5, 0.5, -0.5, -0.4),
        () => sine(d, 8, 22, 0.55, 0.45),
        () => line(d, -0.7, -0.5, 0.2, 0.6),
        () => line(d, 0.7, 0.2, -0.7, 0.2),
      ];
      let k = 0;
      while (d < 3000) {
        const end = pats[k % pats.length](); k++;
        const cx = R.range(-0.8, 0.8), cy = R.range(-0.6, 0.6);
        if (d > 600 && clearOfRings(end + 40, cx, cy, 0.7)) add(end + 40, 'crystal', { nx: cx, ny: cy, r: R.range(1.4, 2.2) });
        d = end + R.range(90, 140);
      }
      // the ramp (11-07): four pods, one burst each (was six, the last three with two bursts of two)
      for (const pd of [950, 1650, 2300, 2900]) add(pd, 'pod', { nx: R.range(-0.7, 0.7), ny: R.range(0.1, 0.8), drift: R.range(-1.5, 1.5), bursts: 1, shots: pd > 2600 ? 2 : 1 });
      for (let i = 0; i < 40; i++) add(R.range(400, 3200), 'crystal', { nx: R.sign() * R.range(1.5, 4), ny: R.range(-2, 2), r: R.range(2, 5), decor: true });
    }
    // ---- 2. THE SHATTER BELT: rocks everywhere, rings thread the lanes, interceptors strafe
    {
      let d = 3320;
      while (d < 6600) {
        const kind = R.int(0, 2);
        let end;
        if (kind === 0) end = line(d, R.range(-0.7, 0.7), R.range(-0.6, 0.6), R.range(-0.7, 0.7), R.range(-0.6, 0.6));
        else if (kind === 1) end = sine(d, 6, 24, R.range(0.3, 0.6), R.range(0.3, 0.5), R() * 6);
        else end = line(d, R.sign() * 0.8, 0, 0, R.sign() * 0.6, 5, 26);
        d = end + R.range(110, 170);
      }
      // the ramp (11-07): fewer rocks in the lane, smaller, thickening less (was 0.4 -> 1.0, 1.0-2.3 m)
      for (let d2 = 3300; d2 < 6750; d2 += R.range(16, 30)) {
        const density = 0.25 + 0.35 * (d2 - 3300) / 3400;
        if (R() < density) {
          const nx = R.range(-1.1, 1.1), ny = R.range(-1.0, 1.0), r = R.range(1.0, 1.9);
          if (clearOfRings(d2, nx, ny, 0.55 + r * 0.12)) add(d2, 'rock', { nx, ny, r });
        }
        add(d2, 'rock', { nx: R.sign() * R.range(1.5, 4.5), ny: R.range(-2.5, 2.5), r: R.range(2.5, 8), decor: true });
      }
      // two strafers of two shots and two pods of one burst (was five strafers of three, five pods of two bursts)
      let side = 1;
      for (const sd of [4000, 5800]) { add(sd, 'shrike', { side, ny: R.range(-0.4, 0.7), shots: 2 }); side = -side; }
      for (const pd of [4900, 6450]) add(pd, 'pod', { nx: R.range(-0.7, 0.7), ny: R.range(-0.2, 0.8), drift: R.range(-2, 2), bursts: 1, shots: 2 });
    }
    // ---- 3. THE QUIET COLOSSUS: girders across the lane (over or under), pylons (left or right), ribs to fly
    //         through, hull turrets, and the first mines
    //   the ramp (11-07; Evrtek: the girder section "is cool"): kept, gentler. A girder or pylon sits 0.35-0.6 off the
    //   middle (was 0.15-0.5), so a ship holding the middle passes and the rings lead round the wide side; they come
    //   300-370 m apart (was 200-260: about three seconds between them, not two); the first is a girder alone, with a
    //   call; the four-way cross (girder and pylon through the middle) waits for the second half. Two pods of one
    //   burst, one strafer and two mine clusters on top (was six pods of two bursts of three, three strafers, three
    //   clusters of five). The cluster at 9200 m stays: the Overclock (8884 m) pays off on it.
    {
      add(6880, 'call', { text: 'GIRDERS: FOLLOW THE RINGS', cls: '' });
      // the Overclock (8884 m, its retrofit place) keeps a ring line through it: no structure's rings near it, its own
      // four rings 24 m apart with it between the second and third
      const OC = 8884;
      line(OC - 36, 0.545, 0.01, 0.185, -0.29, 4, 24);
      let d = 7050, flip = 1, first = true;
      while (d < 10450) {
        if (d > OC - 95 && d < OC + 150) d = OC + 156;
        const k = first ? 0 : R.int(0, d > 8600 ? 3 : 2);
        if (k === 0) {
          const gy = R.range(0.35, 0.6) * flip;
          add(d, 'girder', { ny: gy });
          const safe = -Math.sign(gy) * 0.65;
          line(d - 90, R.range(-0.5, 0.5), safe * 0.5, R.range(-0.5, 0.5), safe, 4, 22);
        } else if (k === 1) {
          const gx = R.range(0.35, 0.55) * flip;
          add(d, 'pylon', { nx: gx });
          const safe = -Math.sign(gx) * 0.65;
          line(d - 90, safe * 0.4, R.range(-0.4, 0.4), safe, R.range(-0.4, 0.4), 4, 22);
        } else if (k === 2) {
          add(d, 'rib', {});
          sine(d - 60, 5, 24, 0.5, 0.4, R() * 6);
        } else {
          add(d, 'girder', { ny: 0 }); add(d, 'pylon', { nx: 0 });
          const cx = R.sign() * 0.65, cy = R.sign() * 0.6;
          line(d - 80, cx * 0.5, cy * 0.5, cx, cy, 4, 20);
        }
        flip = -flip; first = false;
        d += R.range(300, 370);
      }
      for (const pd of [7900, 9600]) add(pd, 'pod', { nx: R.range(-0.8, 0.8), ny: R.range(-0.7, -0.2), drift: R.range(-2, 2), bursts: 1, shots: 2 });
      add(8700, 'shrike', { side: -1, ny: R.range(0.2, 0.8), shots: 2 });
      for (const md of [9200, 10200]) add(md, 'mines', { nx: R.range(-0.4, 0.4), ny: R.range(-0.3, 0.3), n: 4 });
    }
    // ---- 4. THE BEACON FIELD (was THE LIGHTGATES): the structures, mastered
    //   the ramp, part two (Evrtek 11-07: "The levels need to be staggered to introduce new complexity and difficulty";
    //   one new thing a level): this level's one new thing is solid structures in the lane, steered round with the rings
    //   showing the way. The lightgates were a second new thing (a hoop to aim through, its frame hurting) and no other
    //   galaxy 1 level uses them, so they are gone; the beacon field is now the structures' last act, the derelict's outer
    //   spars at speed: a girder or a pylon every 290-340 m, 0.35-0.6 off the middle, the four-way cross one in four,
    //   ribs between. One pod, one strafer. Here the rings run THROUGH each structure, their last one at its plane: the
    //   field is flown faster and its spars come closer than the Colossus's, and rings that stopped 20 m short (as there)
    //   let a pilot turn for the next line early and cut back across the cross (the human bot did, every seed).
    {
      let d = 10800, flip = 1;
      while (d < 13350) {
        const k = R.int(0, 3);
        if (k === 0) {
          const gy = R.range(0.35, 0.6) * flip;
          add(d, 'girder', { ny: gy });
          line(d - 66, R.range(-0.5, 0.5), -Math.sign(gy) * 0.33, R.range(-0.5, 0.5), -Math.sign(gy) * 0.65, 4, 22);
        } else if (k === 1) {
          const gx = R.range(0.35, 0.55) * flip;
          add(d, 'pylon', { nx: gx });
          line(d - 66, -Math.sign(gx) * 0.26, R.range(-0.4, 0.4), -Math.sign(gx) * 0.65, R.range(-0.4, 0.4), 4, 22);
        } else if (k === 2) {
          add(d, 'rib', {});
          sine(d - 60, 5, 24, 0.5, 0.4, R() * 6);
        } else {
          add(d, 'girder', { ny: 0 }); add(d, 'pylon', { nx: 0 });
          const cx = R.sign() * 0.65, cy = R.sign() * 0.6;
          line(d - 60, cx * 0.5, cy * 0.5, cx, cy, 4, 20);
        }
        flip = -flip;
        d += R.range(290, 340);
      }
      add(11500, 'pod', { nx: R.range(-0.8, 0.8), ny: R.range(0.3, 0.9), drift: R.range(-2, 2), bursts: 1, shots: 2 });
      add(12400, 'shrike', { side: 1, ny: 0.6, shots: 3 });
    }
    // ---- 5. THE LONG WAKE: nothing shoots; a long corkscrew of rings at full speed, then the finish
    {
      let d = 13700;
      d = sine(d, 24, 30, 0.6, 0.55);
      sine(d + 60, 12, 30, 0.35, 0.3, Math.PI);
      add(LEVEL_END, 'end', {});
    }
  },
});
