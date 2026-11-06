// LEVEL 1: NEBULA RUN. 0.1.0's one level as the first module. The course is laid out by 0.1.0's own code from
// the same seed, so it is the same course, event for event (tools/check-levels.js compares it to 0.1.0's).
// 0.2.0 changes only what you see: nothing pops in, and every stretch has scenery (ruling 5).
import { defineLevel, clamp } from '../api.js?v=0.3.0';
import ring from '../pickups/ring/index.js?v=0.3.0';
import gate from '../pickups/gate/index.js?v=0.3.0';
import rock from '../obstacles/rock/index.js?v=0.3.0';
import crystal from '../obstacles/crystal/index.js?v=0.3.0';
import mines from '../obstacles/mines/index.js?v=0.3.0';
import { girder, pylon, rib } from '../obstacles/structure/index.js?v=0.3.0';
import pod from '../enemies/pod/index.js?v=0.3.0';
import shrike from '../enemies/shrike/index.js?v=0.3.0';
import { gasGiant, derelictFloor, derelictSkyline, crystalDrift, rockDrift, hullTowers, beaconField, hullTower, beacon } from './level1/scenery.js?v=0.3.0';

const LEVEL_END = 15000;
export default defineLevel({
  n: 2, id: 'nebula', name: 'NEBULA RUN', // played SECOND since Evrtek's swap (11-05); its file stays level1.js
  idea: 'Roll into enemy fire to send it home.',
  legacy: true, // 0.1.0's course, kept exactly (see levels.js, legacyAt)
  seed: 7,
  length: LEVEL_END,
  // The speed keeps building: 62 at the start, 142 at the end (~2.5 minutes at this curve).
  speed: (d) => 62 + 80 * Math.pow(clamp(d / LEVEL_END, 0, 1), 0.85),
  music: { track: 'music' },
  sections: [
    { id: 'nebula', name: 'THE HALCYON DRIFT', sub: 'SECTOR 1', d0: 0, d1: 3200, scenery: { 'gas-giant': 1, 'crystal-drift': 1 } },
    { id: 'rocks', name: 'THE SHATTER BELT', sub: 'SECTOR 2', d0: 3200, d1: 6800, scenery: { 'gas-giant': 1, 'crystal-drift': 0.25, 'rock-drift': 0.5, 'derelict-skyline': (t) => (t > 0.8 ? 1 : 0) } },
    { id: 'hull', name: 'THE QUIET COLOSSUS', sub: 'SECTOR 3', d0: 6800, d1: 10600, scenery: { 'derelict-floor': 1, 'derelict-skyline': 1, 'hull-towers': 1 } },
    { id: 'gates', name: 'THE LIGHTGATES', sub: 'SECTOR 4', d0: 10600, d1: 13600, scenery: { 'gas-giant': 1, 'beacon-field': 1, 'crystal-drift': 0.5 } },
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
  kinds: [ring, gate, rock, crystal, mines, girder, pylon, rib, pod, shrike, hullTower, beacon],
  scenery: [gasGiant, derelictFloor, derelictSkyline, crystalDrift, rockDrift, hullTowers, beaconField],
  // rule 1: the beat sheet (calm / rising / peak), in metres
  beats: [
    { d: 0, tag: 'calm', what: 'open nebula, rings in the open' },
    { d: 950, tag: 'rising', what: 'first lantern pod: the roll and the deflect' },
    { d: 3200, tag: 'rising', what: 'the Shatter Belt: rocks thicken, strafers' },
    { d: 6800, tag: 'calm', what: 'into the derelict: girders and pylons, the rings show the way' },
    { d: 9200, tag: 'peak', what: 'mines and pods in the hull' },
    { d: 10600, tag: 'rising', what: 'the Lightgates slalom' },
    { d: 11800, tag: 'peak', what: 'gates, mines and strafers together' },
    { d: 13600, tag: 'calm', what: 'the Long Wake: nothing shoots, a corkscrew of rings at full speed' },
  ],
  // rule 19: the four acts
  acts: { introduce: [0, 3200], develop: [3200, 6800], twist: [6800, 13600], master: [13600, 15000] },
  // 0.1.0's buildLevel(7), unchanged apart from where its helpers come from
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
      for (const pd of [950, 1500, 1950, 2350, 2700, 2950]) add(pd, 'pod', { nx: R.range(-0.7, 0.7), ny: R.range(0.1, 0.8), drift: R.range(-1.5, 1.5), bursts: pd > 2000 ? 2 : 1, shots: pd > 1800 ? 2 : 1 });
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
      for (let d2 = 3300; d2 < 6750; d2 += R.range(16, 30)) {
        const density = 0.4 + 0.6 * (d2 - 3300) / 3400;
        if (R() < density) {
          const nx = R.range(-1.1, 1.1), ny = R.range(-1.0, 1.0), r = R.range(1.0, 2.3);
          if (clearOfRings(d2, nx, ny, 0.55 + r * 0.12)) add(d2, 'rock', { nx, ny, r });
        }
        add(d2, 'rock', { nx: R.sign() * R.range(1.5, 4.5), ny: R.range(-2.5, 2.5), r: R.range(2.5, 8), decor: true });
      }
      let side = 1;
      for (const sd of [3900, 4500, 5100, 5650, 6200]) { add(sd, 'shrike', { side, ny: R.range(-0.4, 0.7), shots: 3 }); side = -side; }
      for (const pd of [4250, 4850, 5400, 5950, 6450]) add(pd, 'pod', { nx: R.range(-0.7, 0.7), ny: R.range(-0.2, 0.8), drift: R.range(-2, 2), bursts: 2, shots: 2 });
    }
    // ---- 3. THE QUIET COLOSSUS: girders across the lane (over or under), pylons (left or right), ribs to fly
    //         through, hull turrets, and the first mines
    {
      let d = 6950, flip = 1;
      while (d < 10450) {
        const k = R.int(0, 3);
        if (k === 0) {
          const gy = R.range(0.15, 0.55) * flip;
          add(d, 'girder', { ny: gy });
          const safe = -Math.sign(gy) * 0.65;
          line(d - 90, R.range(-0.5, 0.5), safe * 0.5, R.range(-0.5, 0.5), safe, 4, 22);
        } else if (k === 1) {
          const gx = R.range(0.1, 0.5) * flip;
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
        flip = -flip;
        d += R.range(200, 260);
      }
      for (const pd of [7300, 7850, 8400, 8950, 9500, 10050]) add(pd, 'pod', { nx: R.range(-0.8, 0.8), ny: R.range(-0.7, -0.2), drift: R.range(-2.5, 2.5), bursts: 2, shots: 3 });
      let side = -1;
      for (const sd of [7600, 8700, 9800]) { add(sd, 'shrike', { side, ny: R.range(0.2, 0.8), shots: 3 }); side = -side; }
      for (const md of [9200, 9700, 10300]) add(md, 'mines', { nx: R.range(-0.4, 0.4), ny: R.range(-0.3, 0.3), n: 5 });
    }
    // ---- 4. THE LIGHTGATES: a slalom of gates; through the middle pays, the frame hurts; mines between
    {
      let d = 10750, gx = 0, gy = 0;
      let i = 0;
      while (d < 13450) {
        gx = clamp(gx + R.range(-0.55, 0.55), -0.6, 0.6); gy = clamp(gy + R.range(-0.5, 0.5), -0.5, 0.5);
        add(d, 'gate', { nx: gx, ny: gy });
        if (i % 2 === 0) ring(d + 70, gx * 0.6, gy * 0.6);
        if (i % 3 === 1 && d > 11200) add(d + 75, 'mines', { nx: clamp(-gx, -0.6, 0.6), ny: clamp(-gy, -0.5, 0.5), n: 4 + (i % 2) });
        d += Math.max(115, 150 - i * 1.2); i++;
      }
      for (const pd of [11300, 12100, 12900]) add(pd, 'pod', { nx: R.range(-0.8, 0.8), ny: R.range(0.3, 0.9), drift: R.range(-2, 2), bursts: 2, shots: 3 });
      add(11800, 'shrike', { side: 1, ny: 0.6, shots: 4 }); add(12600, 'shrike', { side: -1, ny: -0.5, shots: 4 });
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
