// GALAXY 3, LEVEL 6: THE FORGERY, boss THE COUNTERFEIT. The Mint, where copies of the Wake are stamped out of light
// (Yori's look sheet g3-level-06). THE HEADLINE (rule 20): forged copies of the Wake race you for the rings. Its new
// enemy is the FORGERY (js/enemies/g3-forgery): a crude dark copy of a courier with no guns, just like you, that races
// down the ring line ahead of you and eats the rings. Stop it with keyed fire: the level's turrets
// (js/enemies/g3-forge-turret) are keyed to forgeries, so a turret's bolt rolled home homes on the nearest laden one,
// which bursts and drops what it stole as a shower of rings you can catch back. Later forgeries roll your first send
// straight back at you: roll it again while their slow roll recharges (the white ring above them) and it lands. That
// teaches the boss: THE COUNTERFEIT (js/bosses/g3-counterfeit) is the same duel, with your own rules, at full size.
//
// THE SCHEDULE (rule 30): the plan's track, g3/level6/music, 146 bpm, dark electro; the boss track g3/bosses/counterfeit
// is mastered (146.09 bpm, C minor, the same key), and cuts in on a bar line. A galaxy 1 stand-in plays for the level
// track until the take lands (ElevenLabs credits); the course is on the plan's grid.
//   ACT 1 INTRODUCE  THE STAMPING FLOOR  bars  1-24  88-96 m/s   one forgery far ahead eats a ring line slowly; a keyed
//                                                                 turret's bolt sent home bursts it, its rings rain back
//   ACT 2 DEVELOP    THE PROOF ROOM      bars 25-48  108-122     forgeries that roll back once: send it twice. Plotters,
//                                                                 augurs, pods and seekers between
//   ACT 3 TWIST      THE HEIST           bars 49-64  122-130     forgeries go for a boost chain: burst them before it
//                                                                 reaches them, or lose the burst. RING MAGNET before its
//                                                                 scattered rings (and the showers), so you beat them to it
//   ACT 4 MASTER     THE MINT            bars 65-88  142-162     the set piece: a whole pack races you through a ring maze
//                                                                 under turret pairs (OVERCLOCK just before); then the calm,
//                                                                 the SHIELD CELL at the boss's door, and the Counterfeit
//                                                                 rolls out of the press (bar 89)
// The difficulty is the engine's (EASE_G[3][6]: dmg 0.98, heal 1.0, shot 1.02, ring 1.0; softened for the boss level).
// Stars (the MCP's default 4): the forgeries' stolen rings count in the ring total, so ★4 and ★5 need you to stop the
// forgeries; ★1-★3 never do (about a fifth of the rings are ever in a forgery's reach).
import { defineLevel, clamp } from '../../api.js?v=0.6.4';
import ring from '../../pickups/ring/index.js?v=0.6.4';
import boostRing from '../../pickups/boost-ring/index.js?v=0.6.4';
import pod from '../../enemies/pod/index.js?v=0.6.4';
import seeker from '../../enemies/seeker-drone/index.js?v=0.6.4';
import { shieldCell, overclock, ringMagnet } from '../../pickups/powerups/index.js?v=0.6.4';
import forgery from '../../enemies/g3-forgery/index.js?v=0.6.4';
import forgeTurret from '../../enemies/g3-forge-turret/index.js?v=0.6.4';
import plotter from '../../enemies/g3-plotter/index.js?v=0.6.4';
import augur from '../../enemies/g3-augur/index.js?v=0.6.4';
import counterfeit, { raceRing } from '../../bosses/g3-counterfeit/index.js?v=0.6.4';
import { musicClock } from './level4/clock.js?v=0.6.4';
import { blank, spark, press, blanks, presses, mint } from './level6/scenery.js?v=0.6.4';

const C = musicClock(146, 0.16, [[1, 88], [9, 96], [25, 108], [33, 122], [57, 130], [65, 142], [81, 154], [85, 162]], 95);
export const B = C.B, BAR = C.BAR;
const BOSS_BAR = 89, BOSS_D = B(BOSS_BAR), LENGTH = BOSS_D + 600;
const A1 = B(25), A2 = B(49), A3 = B(65), A4 = B(85);

export default defineLevel({
  g: 3, n: 6, id: 'forgery', name: 'THE FORGERY',
  idea: 'Forged copies of the Wake race you for the rings.',
  // style of its own (MCP ruling 11-07): galaxy 3's default asks S [5, 8], and the good bot with power-ups off had 3 and 4 close
  // calls and stopped at four stars; a clean flyer can earn S here
  style: { A: [2, 5], S: [3, 8], DEGENERATE: [5, 13] },
  seed: 300006,
  length: LENGTH,
  speed: C.speed,
  music: { track: 'g3/level6/music' },
  bossMusic: 'g3/bosses/counterfeit',          // mastered: 146.09 bpm, C minor, the level's key; cuts in on a bar line
  sfx: [{ id: 'g3-forgery-burst', gain: 0.8 }, { id: 'g3-forgery-roll', gain: 0.8 }, { id: 'g3-plot', gain: 0.4 }, { id: 'g3-augur-charge', gain: 0.6 }, { id: 'g3-ratchet', gain: 0.5 }],
  sections: [
    { id: 'floor', name: 'THE STAMPING FLOOR', sub: 'SECTOR 1', d0: 0, d1: A1, look: 'floor',
      scenery: { 'g3-l6-blanks': 1, 'g3-l6-presses': 0.8, 'g3-l6-mint': 0.45 } },
    { id: 'proof', name: 'THE PROOF ROOM', sub: 'SECTOR 2', d0: A1, d1: A2, look: 'proof',
      scenery: { 'g3-l6-blanks': 0.8, 'g3-l6-presses': 1, 'g3-l6-mint': 0.5 } },
    { id: 'heist', name: 'THE HEIST', sub: 'SECTOR 3', d0: A2, d1: A3, look: 'heist',
      scenery: { 'g3-l6-blanks': 1, 'g3-l6-presses': 0.7, 'g3-l6-mint': 0.6 } },
    { id: 'mint', name: 'THE MINT', sub: 'FINAL STRETCH', d0: A3, d1: A4, look: 'mint',
      scenery: { 'g3-l6-blanks': 1, 'g3-l6-presses': 1, 'g3-l6-mint': 1 } },
    { id: 'press', name: 'THE PRESS', sub: 'THE COUNTERFEIT AHEAD', d0: A4, d1: LENGTH, look: 'press',
      scenery: { 'g3-l6-blanks': 0.7, 'g3-l6-presses': 0.6, 'g3-l6-mint': 1 } },
  ],
  // Yori's palette (g3-palettes.js, level 6): sky 0a080c, gas 3a2a40 / ff4ad8 / 1e1f27, fog 16121a, key ff9ae8, fill
  // 3a2440, accent weld magenta ff4ad8 (hue 312: 38 degrees off the reserved red). Rule 9 holds.
  looks: {
    floor: { sky: ['#0a080c', 'rgba(58,42,64,A)', 'rgba(255,74,216,A)', 'rgba(30,31,39,A)'], fog: 0x16121a, hemiSky: 0xff9ae8, hemiGround: 0x3a2440, sun: 0xffd8f4, band: 0.5, gas: 0.5, cloud: 0x3a2a40, clouds: 0.14, seed: 3601 },
    proof: { sky: ['#0b090e', 'rgba(255,74,216,A)', 'rgba(58,42,64,A)', 'rgba(30,31,39,A)'], fog: 0x18131c, hemiSky: 0xff9ae8, hemiGround: 0x3a2440, sun: 0xffe0f6, band: 0.46, gas: 0.6, cloud: 0x5a2a58, clouds: 0.16, seed: 3602 },
    heist: { sky: ['#09070b', 'rgba(30,31,39,A)', 'rgba(255,74,216,A)', 'rgba(58,42,64,A)'], fog: 0x141018, hemiSky: 0xffb0ee, hemiGround: 0x2a1a30, sun: 0xffd8f4, band: 0.54, gas: 0.55, cloud: 0x3a2a40, clouds: 0.12, seed: 3603 },
    mint: { sky: ['#0e0a12', 'rgba(255,74,216,A)', 'rgba(255,154,232,A)', 'rgba(58,42,64,A)'], fog: 0x1c1422, hemiSky: 0xffc0f0, hemiGround: 0x3a2440, sun: 0xffffff, band: 0.5, gas: 0.8, cloud: 0xff4ad8, clouds: 0.2, seed: 3604 },
    press: { sky: ['#0c090f', 'rgba(255,154,232,A)', 'rgba(255,74,216,A)', 'rgba(30,31,39,A)'], fog: 0x1a121e, hemiSky: 0xff9ae8, hemiGround: 0x3a2440, sun: 0xffe8f8, band: 0.5, gas: 0.65, cloud: 0x5a2a58, clouds: 0.14, seed: 3605 },
  },
  kinds: [ring, boostRing, pod, seeker, forgery, forgeTurret, plotter, augur, shieldCell, overclock, ringMagnet, raceRing, blank, spark, press],
  scenery: [blanks, presses, mint],
  boss: { at: BOSS_D, def: counterfeit, then: 'finish' },
  beats: [
    { d: 0, tag: 'calm', what: 'intro: the stamping floor, presses beating on the bar, rings in the open' },
    { d: B(5), tag: 'rising', what: 'the first forgery flies in far ahead and eats a ring line, slowly' },
    { d: B(8.5), tag: 'rising', what: 'a keyed turret: roll its bolt home and it bursts the forgery, the rings rain back' },
    { d: B(13), tag: 'rising', what: 'groove: a forgery and a turret at a time; then two forgeries, two turrets' },
    { d: B(21), tag: 'calm', what: 'rings only' },
    { d: A1, tag: 'rising', what: 'build one, faster: a forgery that rolls your bolt back: send it twice' },
    { d: B(34), tag: 'rising', what: 'drop one (speed at bar 33, density from 34): rolling forgeries, a plotter sheet, an augur, pods' },
    { d: B(38), tag: 'peak', what: 'two forgeries, a turret pair, seekers and a sheet' },
    { d: B(45), tag: 'calm', what: 'rings only' },
    { d: A2, tag: 'calm', what: 'breakdown: the Heist is set: a boost chain far ahead, and the forgeries go for it' },
    { d: B(51), tag: 'rising', what: 'THE HEIST: burst the forgery before the chain reaches it, or lose the burst' },
    { d: B(56), tag: 'rising', what: 'RING MAGNET on the line, then a field of scattered rings with forgeries racing for them' },
    { d: B(59), tag: 'peak', what: 'build two: a second heist, two forgeries for one chain' },
    { d: B(63), tag: 'calm', what: 'lead-in: OVERCLOCK on the line, two bars of rings' },
    { d: A3, tag: 'peak', what: 'drop two, faster: THE MINT, a pack races you through a ring maze under turret pairs' },
    { d: B(73), tag: 'calm', what: 'breather' },
    { d: B(75), tag: 'peak', what: 'the hardest stretch: the pack again, rollers among them, a sheet' },
    { d: B(81), tag: 'rising', what: 'the drive, faster: one forgery, one turret, the last rings' },
    { d: A4, tag: 'calm', what: 'the press: nothing shoots; the SHIELD CELL at the door' },
    { d: BOSS_D, tag: 'peak', what: 'THE COUNTERFEIT rolls out of the press' },
  ],
  acts: { introduce: [0, A1], develop: [A1, A2], twist: [A2, A3], master: [A3, BOSS_D] },
  build(R, L) {
    const { add, ring: one, line, sine, clearOfRings } = L;
    const forge = (bar, nx, ny, o = {}) => add(B(bar), 'g3-forgery', Object.assign({ nx, ny }, o));
    // a keyed turret whose first bolt leaves at bar `bar`
    const key = (bar, nx, ny, o = {}) => { const at = o.at ?? 3.0, d0 = B(bar); return add(d0 + C.speed(d0) * at, 'g3-forge-turret', Object.assign({ nx, ny, at }, o)); };
    const aug = (bar, nx, ny, o = {}) => { const at = o.at ?? 3.2, d0 = B(bar); return add(d0 + C.speed(d0) * at, 'g3-augur', Object.assign({ nx, ny, at }, o)); };
    const plot = (bar, path, o = {}) => { const d = B(bar); return add(d, 'g3-plotter', Object.assign({ path, spd: C.speed(d), from: 2.6, to: 0.5 }, o)); };
    const podAt = (bar, nx, ny, o = {}) => { const d = B(bar); for (const [x, y] of [[nx, ny], [nx, ny + 0.3], [-nx, ny], [nx * 0.5, -ny]]) if (clearOfRings(d, x, y, 0.5)) return add(d, 'pod', Object.assign({ nx: x, ny: y }, o)); return null; };
    const seek = (bar, nx, ny, o = {}) => add(B(bar), 'seeker-drone', Object.assign({ nx, ny, shots: 2 }, o));
    const fill = (b0, b1) => {
      let d = B(b0); const end = B(b1); let k = 0;
      while (d < end - 70) {
        const pick = (k + R.int(0, 3)) % 4; k++;
        // 0.6.0 (Evrtek 11-10: fix the Forgery): every filler is a line or a turn the ship can FOLLOW at this level's speed.
        // They were not: a corkscrew 4.5 m wide turning once in 192 m, a line across the whole lane in 110 m. Even the good
        // bot dropped a ring in five on them, so nobody could hold a multiplier here, forgeries or no forgeries.
        if (pick === 0) d = line(d, R.range(-0.4, 0.4), R.range(-0.36, 0.36), R.range(-0.4, 0.4), R.range(-0.36, 0.36), 5, 28);
        else if (pick === 1) d = line(d, -0.36, R.range(-0.26, 0.26), 0.36, R.range(-0.26, 0.26), 6, 30);
        else if (pick === 2) d = line(d, R.range(-0.26, 0.26), 0.4, R.range(-0.26, 0.26), -0.36, 5, 28);
        else d = sine(d, 8, 36, R.range(0.26, 0.32), R.range(0.22, 0.28), R() * 6);
        d += 30;
      }
    };
    // A RAID, the level's unit of play: a forgery flies in at bar `bar` (2.4 s out of the haze to hold 220 m ahead),
    // races down its ring line (which reaches its plane as it arrives) and fills its cradle (three rings); then it makes
    // off with them, slowly. Its keyed turret fires as it fills (two bolts, a bar apart): roll one home and the forgery
    // bursts and its three rings rain back to you. Ignore it and those three are gone (the stars that ask the skill).
    //   o: { line: [x0, y0, x1, y1, n], side (the turret's perch, -1 | 1), rolls, want, lat, life, keyAt (bars after bar) }
    const raid = (bar, nx, ny, o = {}) => {
      forge(bar, nx, ny, { rolls: o.rolls || 0, want: o.want, lat: o.lat ?? 5, life: o.life ?? 9 });
      const [x0, y0, x1, y1, n] = o.line || [nx, ny, nx, ny, 6];
      if (n) line(B(bar + 2.7), x0, y0, x1, y1, n, 26);
      if (o.side !== 0) key(bar + (o.keyAt ?? 2.4) - 1, (o.side || (nx > 0 ? -1 : 1)) * 1.3, o.ky ?? 0.55, { shots: 2, at: 4.6 });
    };
    // a boost chain
    let chainN = 0;
    const chain = (bar, x0, y0, x1, y1, n = 4) => { const id = 'l6c' + (++chainN); return line(B(bar), x0, y0, x1, y1, n, 30, 'boost-ring', (i) => ({ chain: id, idx: i, of: n })); };

    // ================= ACT 1: INTRODUCE (bars 1-24): THE STAMPING FLOOR =================
    line(B(1.5), 0, 0.2, 0, 0, 5, 26);
    sine(B(3), 6, 24, 0.4, 0.3, 1);
    // bar 5: the first forgery, alone: it flies in far ahead and eats a straight ring line, slowly (nothing can hurt yet)
    raid(5, 0, 0.1, { line: [-0.1, 0.1, 0.1, 0.1, 10], lat: 3.5, side: 1, keyAt: 3.6 });
    L.add(B(7.2), 'call', { text: "IT'S EATING YOUR RINGS", cls: 'c-cyan' });
    L.add(B(8.7), 'call', { text: 'ROLL THE TURRET SHOT HOME', cls: 'c-cyan' });
    fill(10.5, 12.5);
    // groove: a raid at a time, from either side; then two at once
    raid(12.5, -0.4, -0.2, { line: [-0.4, -0.2, 0.2, 0.2, 7] });
    fill(16, 17);
    // (0.6.0: the two race for ONE line. It was a line each, 6.8 m apart: nobody can fly both, and every ring of the line
    // you were not on was a miss against you)
    raid(17, 0.5, 0.3, { line: [0.3, 0.25, -0.3, -0.15, 9] });
    raid(17.4, -0.5, -0.3, { line: [0, 0, 0, 0, 0], keyAt: 3.6 });
    fill(21.5, 25);

    // ================= ACT 2: DEVELOP (bars 25-48): THE PROOF ROOM =================
    // build one: a forgery that rolls your bolt back (its white ring full): roll the bolt it sends again while it refills
    raid(25.5, 0, 0.3, { line: [0, 0.3, 0.3, -0.2, 8], rolls: 1 });
    L.add(B(28.4), 'call', { text: 'IT ROLLS IT BACK. ROLL IT AGAIN', cls: 'c-cyan' });
    fill(30.5, 34);
    // drop one (speed at bar 33; density from 34)
    raid(34, -0.4, 0, { line: [-0.4, 0, -0.2, 0.4, 7], rolls: 1, lat: 6 });
    plot(38, [[1.25, -0.6], [-0.3, -0.6]], { from: 2.6, to: 0.5 }); line(B(38) - 50, 0.4, 0.2, 0.5, 0.3, 3, 25);
    aug(38.5, 1.35, 0.6);
    // the peak: two raids, one turret each (or one roll for both bolts), seekers, a pod
    raid(39.5, 0.45, 0.2, { line: [0.3, 0.2, -0.3, -0.2, 9], lat: 6 });                      // (0.6.0: one line for the two, as in act 1)
    raid(39.8, -0.45, -0.1, { line: [0, 0, 0, 0, 0], rolls: 1, lat: 6 });
    seek(43.5, 0.5, 0.45); podAt(44, 0.2, -0.3, { shots: 2 }); line(B(43.5), -0.3, 0.3, 0.3, 0, 6, 24);
    fill(45.5, 49);

    // ================= ACT 3: TWIST (bars 49-64): THE HEIST =================
    // a boost chain far ahead, and a forgery that goes for it (want: boost). Burst it before the chain reaches its plane
    // (about a bar before it reaches you), or it takes the chain (CHAIN STOLEN) and the burst is lost.
    line(B(49.5), 0, 0.1, 0, 0.1, 5, 26);
    raid(50, -0.5, 0.2, { want: 'boost', line: [0, 0, 0, 0, 0], lat: 6, side: 1, keyAt: 1.8 });
    L.add(B(51.2), 'call', { text: "IT'S AFTER THE BOOST CHAIN", cls: 'c-cyan' });
    fill(51, 54.6);
    chain(55, 0.4, 0, 0.4, 0, 4);
    // the RING MAGNET, then a field of scattered rings with two forgeries racing for them (and their showers, once burst)
    line(B(55.4), 0.2, 0, 0, 0, 3, 24);
    add(B(56.2), 'ring-magnet', { nx: 0, ny: 0 }); // 2.6 s before the field: the magnet runs 8 s
    raid(55.6, 0.5, 0.4, { line: [0, 0, 0, 0, 0], lat: 7, side: -1, keyAt: 3.6 });
    raid(56, -0.5, -0.4, { line: [0, 0, 0, 0, 0], lat: 7, side: 1, keyAt: 4.2 });
    // (0.6.0: the field sits inside the magnet's reach of the middle of the lane, on a wide screen and a phone alike; it
    // was up to 5.2 m out, so even with the magnet a third of it went by)
    { let d = B(57.8); for (let i = 0; i < 18; i++) { one(d, R.range(-0.5, 0.5), R.range(-0.45, 0.45)); d += R.range(22, 30); } }
    // build two: a second heist, two forgeries for one chain, a turret each
    raid(59.4, 0.5, 0.3, { want: 'boost', line: [0, 0, 0, 0, 0], lat: 6, side: -1, keyAt: 1.6 });
    raid(59.8, -0.5, 0.3, { want: 'boost', line: [0, 0, 0, 0, 0], lat: 6, side: 1, keyAt: 1.8 });
    fill(60.5, 63.6);
    chain(64.2, -0.3, 0.2, 0.3, 0.2, 4);
    // the lead-in: OVERCLOCK on the line (roll every 0.55 s for 6 s: send everything home) just before the Mint
    line(B(65.2), -0.3, 0.2, -0.3, 0.2, 3, 24); add(B(65.9), 'overclock', { nx: -0.3, ny: 0.2 }); // 2.5 s before the first keyed bolts of the Mint

    // ================= ACT 4: MASTER (bars 65-88): THE MINT =================
    // the pack races you through a ring maze (a corridor that weaves), turret pairs on both walls
    raid(65, -0.4, 0.2, { line: [0, 0, 0, 0, 0], lat: 6, side: 1, keyAt: 3.0 });
    raid(65.3, 0.4, -0.2, { line: [0, 0, 0, 0, 0], lat: 6, side: -1, keyAt: 3.0 });
    raid(65.6, 0, 0.5, { line: [0, 0, 0, 0, 0], rolls: 1, lat: 6, side: 1, keyAt: 4.4, ky: -0.45 });
    // (0.6.0: the maze weaves 2.6 m either side over 290 m; it was 4.1 m over 190 m, a sideways 10 m/s the ship cannot do)
    { let d = B(67.2); for (let i = 0; i < 21; i++) { const t = i / 21; one(d, Math.sin(t * Math.PI * 2) * 0.35, Math.cos(t * Math.PI * 2) * 0.3); d += 28; } }
    plot(72.5, [[-1.25, 0.65], [1.25, 0.65]], { from: 2.6, to: 0.4 });
    line(B(73.2), -0.3, -0.2, 0.3, -0.2, 6, 26);
    // the hardest stretch: the pack again, rollers among them, a sheet and an augur
    raid(74.5, 0.45, 0.3, { line: [0, 0, 0, 0, 0], rolls: 1, lat: 6, side: -1, keyAt: 3.0 });
    raid(74.8, -0.45, 0.3, { line: [0, 0, 0, 0, 0], lat: 6, side: 1, keyAt: 3.0 });
    raid(75.1, 0, -0.4, { line: [0, 0, 0, 0, 0], rolls: 1, lat: 6, side: 1, keyAt: 4.3, ky: -0.45 });
    { let d = B(76.8); for (let i = 0; i < 16; i++) { const t = i / 16; one(d, Math.sin(t * Math.PI * 2 + 1) * 0.35, Math.sin(t * Math.PI * 3) * 0.24); d += 28; } }
    aug(78.5, 1.35, -0.6);
    plot(80.5, [[-0.2, 1.25], [-0.2, -1.25]], { from: 2.6, to: 0.4 }); line(B(80.5) - 70, 0.3, 0.2, 0.45, 0.1, 4, 24);
    // the drive, faster: one raid, the last rings
    raid(81.5, 0, 0.2, { line: [0, 0.2, 0.3, -0.2, 7], rolls: 1 });
    // the press: nothing shoots; the Shield Cell at the door (the one power-up a boss's entrance may have)
    line(B(85.4), 0, 0, 0, 0.2, 5, 26);
    add(B(87), 'shield-cell', { nx: 0, ny: 0.2 }); line(B(87) + 24, 0, 0.2, 0, 0.2, 3, 26);
  },
});
