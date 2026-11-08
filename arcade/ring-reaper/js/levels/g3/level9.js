// GALAXY 3 (THE UNMADE), LEVEL 9: THE VAULT, boss THE HIGH ROLLER. The Treasury: a hall of sealed drums, marquee bulbs,
// warm white light, and the High Roller's wheel lit on the horizon the whole level (Yori's look sheet g3-level-09). CLU,
// branch g3-c; the plan is projects/starwake-galaxies.md 4.9.
// THE HEADLINE (rule 20): vaults open only to a ship running hot on GREED. A vault's door reads your meter (its eight
// lights fill as it does) and swings open while your GREED is lit: fly through it hot for its rings (VAULT!). Before
// every vault the level lays a graze-rich stretch (curtains of bolts with gaps, riveter strings to skim), and GREED still
// fires on its own after a moment, as it always has. GREED becomes a key: you learn to time the cash-in, and the price
// is the speed jump and no healing from rings while it runs. The vault rings count toward the ring total (the MCP's
// default 4): stars one to three never need them; four and five do.
//
// THE BEAT SHEET (rule 1) is `beats`, the four acts (rule 19) `acts`. Everything big sits on a bar line of the level's
// track (audio/g3/level9/music: peak-time techno with an arcade shimmer, 150 bpm, the boss's key; still to come, so the
// grid is its planned tempo, level7/grid.js). Bars count from 0.
//   ACT 1  THE STRONGROOM    bars  0-24   94 m/s  intro + groove: a vault with your meter already full; then topped up
//   ACT 2  THE SKIM          bars 24-48  116 m/s  build one + drop one: fill the meter on a graze curtain, then a vault
//   ACT 3  THE DOUBLE DOWN   bars 48-64  132 m/s  breakdown + build two: two vaults inside one GREED (cash in late)
//   ACT 4  THE TREASURY      bars 64-82  152 m/s  drop two, the SET PIECE: a hall of six vaults; a Ring Magnet inside it
//          THE MARQUEE       bars 82-88  162 m/s  the drive, a step lighter: a fractal and a string to roll
//          LIGHTS UP         bars 88-94  170 m/s  calm; a Shield Cell; the wheel lights up. THE HIGH ROLLER (bar 94)
// Re-uses: riveters (graze strings and curtains) and fractals, this branch's. Forgeries racing you to the vaults,
// plotters and a vault behind a lockgate belong to g3-a and g3-b and have not landed on `galaxies` (marked RE-USE).
import { defineLevel } from '../../api.js?v=0.5.0';
import ring from '../../pickups/ring/index.js?v=0.5.0';
import { shieldCell, ringMagnet } from '../../pickups/powerups/index.js?v=0.5.0';
import riveter from '../../enemies/g3-riveter/index.js?v=0.5.0';
import fractal from '../../enemies/g3-fractal/index.js?v=0.5.0';
import vault, { RD } from '../../obstacles/g3-vault/index.js?v=0.5.0';
import vaultRing from '../../pickups/g3-vault-ring/index.js?v=0.5.0';
import highRoller from '../../bosses/g3-high-roller/index.js?v=0.5.0';
import { musicGrid, ringRun } from './level7/grid.js?v=0.5.0';
import { primer } from './level9/primer.js?v=0.5.0';
import { column, columns, treasury, treasuryHall, wheel } from './level9/scenery.js?v=0.5.0';

const { BAR, speed, BAR_S } = musicGrid({ bpm: 150, steps: [[0, 94], [24, 116], [48, 132], [62, 152], [82, 162], [88, 170]] });
const A1 = BAR(24), A2 = BAR(48), A3 = BAR(64), DRIVE = BAR(82), STILL = BAR(88), BOSS_D = BAR(94), LEVEL_END = BOSS_D + 600;
const RIV_IN = 3.0 / BAR_S, FRAC_IN = 2.8 / BAR_S;
const VAULT_RINGS = 12, VAULT_STEP = 2.2;   // 12 a vault: 37% of the rings, so a run that opens none tops out at 63%, under ★4

// Yori's palette (g3-palettes.js, level 9): sky 0a0806, gas 4a3a20 / ffe0a0 / 2a1a30, fog 1a1410, key fff0d0, fill 4a3020.
// One change for rule 9: her first gas, 4a3a20, is a saturated bronze 8 degrees from the amber of collect (check-levels
// fails it as sky); here it is 4a3c28, the same dark bronze a little greyer. Her warm white ffe0a0 is not amber.
const look = (seed, gas, band, a, b, c) => ({ sky: ['#0a0806', a, b, c], fog: 0x1a1410, hemiSky: 0xfff0d0, hemiGround: 0x4a3020, sun: 0xfff0d0,
  band, gas, cloud: 0x2a1a30, clouds: 0.14, seed, sunDir: [0.3, 0.9, 0.5], starGlow: 0.5, starTint: 0xfff0d0 });
const BRONZE = 'rgba(74,60,40,A)', WARM = 'rgba(255,224,160,A)', PLUM = 'rgba(42,26,48,A)';

export default defineLevel({
  g: 3, n: 9, id: 'vault', name: 'THE VAULT',
  idea: 'Vaults open only to a ship running hot on GREED.',
  length: LEVEL_END,
  speed,
  music: { track: 'g3/level9/music' },
  bossMusic: 'g3/bosses/high-roller',      // same tempo and key (150, F# minor); cuts in on a bar line
  sfx: [{ id: 'g3-vault-open', gain: 0.7 }, { id: 'g3-vault', gain: 0.8 }, { id: 'g3-rivet', gain: 0.55 }, { id: 'g3-split', gain: 0.6 }, { id: 'g3-fractal-clear', gain: 0.8 },
    { id: 'g3-wheel-spin', gain: 0.7 }, { id: 'g3-jackpot', gain: 0.9 }],
  sections: [
    { id: 'strongroom', name: 'THE STRONGROOM', sub: 'SECTOR 1', d0: 0, d1: A1, look: 'strongroom',
      scenery: { 'g3-l9-columns': 1, 'g3-l9-treasury-hall': 0.6, 'g3-l9-wheel': 1 } },
    { id: 'skim', name: 'THE SKIM', sub: 'SECTOR 2', d0: A1, d1: A2, look: 'skim',
      scenery: { 'g3-l9-columns': 1, 'g3-l9-treasury-hall': 1, 'g3-l9-wheel': 1 } },
    { id: 'double', name: 'THE DOUBLE DOWN', sub: 'SECTOR 3', d0: A2, d1: A3, look: 'double',
      scenery: { 'g3-l9-columns': 1, 'g3-l9-treasury-hall': 0.8, 'g3-l9-wheel': 1 } },
    { id: 'treasury', name: 'THE TREASURY', sub: 'SECTOR 4', d0: A3, d1: DRIVE, look: 'treasury',
      scenery: { 'g3-l9-columns': 1, 'g3-l9-treasury-hall': 1, 'g3-l9-wheel': 1 } },
    { id: 'marquee', name: 'THE MARQUEE', sub: 'SECTOR 5', d0: DRIVE, d1: STILL, look: 'marquee',
      scenery: { 'g3-l9-columns': 1, 'g3-l9-treasury-hall': 0.7, 'g3-l9-wheel': 1 } },
    { id: 'lights', name: 'LIGHTS UP', sub: 'THE HIGH ROLLER AHEAD', d0: STILL, d1: LEVEL_END, look: 'lights',
      scenery: { 'g3-l9-columns': 1, 'g3-l9-treasury-hall': 0.4, 'g3-l9-wheel': 1 } },
  ],
  looks: {
    strongroom: look(901, 0.55, 0.5, BRONZE, PLUM, WARM),
    skim: look(902, 0.65, 0.52, WARM, BRONZE, PLUM),
    double: look(903, 0.6, 0.48, PLUM, BRONZE, WARM),
    treasury: look(904, 0.8, 0.56, WARM, PLUM, BRONZE),
    marquee: look(905, 0.6, 0.5, BRONZE, WARM, PLUM),
    lights: look(906, 0.45, 0.5, PLUM, WARM, BRONZE),
  },
  kinds: [ring, vault, vaultRing, riveter, fractal, ringMagnet, shieldCell, primer, column, treasury],
  scenery: [columns, treasuryHall, wheel],
  boss: { at: BOSS_D, def: highRoller, then: 'finish' },
  beats: [
    { d: 0, tag: 'calm', what: 'intro: the strongroom, rings between the bulb columns, the wheel on the horizon' },
    { d: BAR(7.6), tag: 'rising', what: 'groove: your meter full; cash in and the first vault opens: fly through for its rings' },
    { d: BAR(16.8), tag: 'rising', what: 'the meter most of the way; skim a riveter string to top it up, then a vault' },
    { d: A1, tag: 'calm', what: 'build one, speed step: the Skim' },
    { d: BAR(25.6), tag: 'rising', what: 'thread a curtain of six to fill the meter, then a vault: time the cash-in' },
    { d: BAR(36.2), tag: 'peak', what: 'drop one: a curtain down the lane, a vault, a fractal' },
    { d: BAR(46), tag: 'calm', what: 'rings only' },
    { d: A2, tag: 'calm', what: 'breakdown, speed step' },
    { d: BAR(51.2), tag: 'rising', what: 'TWIST, THE DOUBLE DOWN: fill the meter, then two vaults inside one GREED (cash in late)' },
    { d: BAR(60.6), tag: 'calm', what: 'a Shield Cell behind the second vault: the one heal GREED allows' },
    { d: BAR(61.6), tag: 'rising', what: 'a curtain to fill the meter for the Treasury' },
    { d: A3, tag: 'peak', what: 'drop two, SET PIECE THE TREASURY: the first hot run, three vaults; a Ring Magnet sweeps their drums' },
    { d: BAR(71), tag: 'rising', what: 'GREED out: refill it on a curtain down the lane' },
    { d: BAR(78), tag: 'peak', what: 'the second hot run, three vaults' },
    { d: DRIVE, tag: 'rising', what: 'the drive, speed step: a fractal and a string that seams, a step lighter' },
    { d: STILL, tag: 'calm', what: 'lights up: rings, a Shield Cell before the fight, the wheel lights on the horizon' },
    { d: BOSS_D, tag: 'peak', what: 'THE HIGH ROLLER' },
  ],
  acts: { introduce: [0, A1], develop: [A1, A2], twist: [A2, A3], master: [A3, BOSS_D] },
  build(R, L) {
    const { add, line } = L;
    const riv = (bar, o) => add(BAR(bar - RIV_IN), 'g3-riveter', o);
    const frac = (bar, o) => add(BAR(bar - FRAC_IN), 'g3-fractal', o);
    const rings = (b0, b1, style) => ringRun(L, R, BAR, b0, b1, style, { speed, breath: [150, 220] });
    const pu = (bar, type, nx, ny) => { line(BAR(bar) - 75, nx * 0.4, ny * 0.4, nx, ny, 3, 25); add(BAR(bar), type, { nx, ny }); };
    const CURTAIN = (axis) => ({ curtain: { axis } });                                  // the riveter's: gap 2.6, bolts 1.0 apart
    // a vault on `bar`, its door at (nx, ny), and its jackpot: VAULT_RINGS rings in a line through its drum
    let vid = 0; const vaults = [];
    const vlt = (bar, nx, ny, o = {}) => {
      const d = BAR(bar), id = 'l9-v' + (++vid);
      add(d, 'g3-vault', Object.assign({ id, nx, ny }, o)); vaults.push({ d, nx, ny });
      for (let i = 0; i < VAULT_RINGS; i++) add(d - 1 + i * VAULT_STEP, 'g3-vault-ring', { vault: id, nx, ny });
      return d;
    };

    // ======== ACT 1, THE STRONGROOM: the vault alone, your meter given (rules 4, 17, 18). Bars 0-7.5: rings only.
    rings(0.6, 9.6, 'mixed');
    add(BAR(7.6), 'g3-l9-primer', { to: 100, say: 'CASH IN AND THE DOOR OPENS' });
    line(BAR(9.9), 0, 0.1, 0, 0.1, 3, 26);                                             // the way in
    vlt(11.5, 0, 0.1);
    // the first GREED runs until about bar 16; the meter is topped up only once it is out (a primer never adds while lit)
    rings(12.4, 16.6, 'mixed');
    add(BAR(16.8), 'g3-l9-primer', { to: 85, say: 'GRAZE THE BOLTS TO TOP IT UP', cls: 'c-cyan' });
    riv(16.9, { nx: -0.3, ny: 1.32, skim: 1.2, n: 5, every: 3 });
    rings(17, 22.4, 'mixed');
    vlt(23.4, 0.45, 0.2);

    // ======== ACT 2, THE SKIM: fill the meter on a graze curtain, then a vault. Time it (develop). Every vault from here
    // has a whole graze stretch before it: a string of six (a roller fills it too: a roll that sends bolts home pays 8
    // each, and 10 more for three in one roll), and GREED out before it starts, so none of it is wasted.
    add(BAR(25.2), 'call', { text: 'THREAD THE GAPS TO FILL IT', cls: 'c-cyan' });
    riv(25.6, Object.assign({ nx: 0, ny: 1.36, n: 6, every: 3 }, CURTAIN('x')));
    rings(24.4, 31.6, 'centre');
    vlt(32.6, -0.45, 0.15);
    riv(33.4, { nx: 1.25, ny: 0.35, n: 3, every: 3, seam: true });                  // between doors, something to roll: off a vault, never on its approach
    rings(33.2, 35.6, 'mixed');
    riv(36.2, Object.assign({ nx: -1.25, ny: 0.2, n: 6, every: 3 }, CURTAIN('y')));       // RE-USE: a forgery racing you here
    rings(36, 42.2, 'centre');
    vlt(43.2, 0.4, -0.15);
    frac(44.6, { nx: -0.3, ny: 0.5, depth: 2, kidShots: 1 });
    rings(44, 47.6, 'mixed');

    // ======== ACT 3, THE DOUBLE DOWN: two vaults inside one GREED, so you can't cash in early (twist)
    riv(48.4, { nx: -1.25, ny: 0.3, n: 3, every: 3, seam: true });                  // the breakdown's string, before the fill
    // the fill comes late on purpose: full about 2.6 s before the cash-in, so GREED cannot fire itself (4 s after full) too
    // early for the second door. Cash in on the first door's approach and both open; cash in as soon as it fills and the
    // second door stays shut: the Double Down's whole lesson
    riv(51.2, Object.assign({ nx: 0, ny: 1.36, n: 4, every: 3 }, CURTAIN('x')));
    rings(48.4, 55.4, 'centre');
    add(BAR(54.6), 'call', { text: 'TWO DOORS ON ONE GREED: CASH IN LATE', cls: 'c-mag' });
    vlt(56.6, -0.45, 0.2, { ask: 2.0 });
    vlt(60.6, 0.45, 0.1);
    add(BAR(60.6) + 34, 'shield-cell', { nx: 0.45, ny: 0.1 });                          // behind the vault: hot and hurting
    rings(57.2, 60, 'centre');
    riv(61.6, Object.assign({ nx: 0, ny: 1.36, n: 5, every: 3 }, CURTAIN('x')));          // fill it for the Treasury
    rings(61.4, 65.6, 'centre');

    // ======== ACT 4, THE TREASURY (master; the set piece, drop two): a hall of vaults on the drop, two hot runs of three
    vlt(66.8, -0.45, 0.25, { ask: 2.4 });
    pu(67.2, 'ring-magnet', 0.1, 0.05);                                                 // it sweeps a vault's drum clean
    vlt(68.3, 0.45, -0.1);
    vlt(69.8, 0, 0.35);
    riv(72, Object.assign({ nx: 1.25, ny: 0.2, n: 6, every: 3 }, CURTAIN('y')));
    rings(70.4, 77.4, 'centre');
    vlt(78.4, 0.45, 0.3, { ask: 2.4 });
    vlt(79.7, -0.45, -0.1);
    vlt(81, 0, 0.3);
    // the drive (speed step at 82): a step lighter, and something to roll: a fractal and a string that seams
    rings(81.6, 87.6, 'mixed');
    frac(83, { nx: 0.35, ny: 0.45, depth: 1, kidShots: 1 });
    riv(85, { nx: -0.35, ny: 1.32, n: 4, every: 3, seam: true });
    // lights up: rings, a Shield Cell at the High Roller's entrance, the wheel lit on the horizon
    rings(88.2, 93.2, 'corkscrew');
    add(BAR(91.5), 'shield-cell', { nx: 0, ny: 0 });

    // no plain ring is left inside a vault's drum (it could only be caught by flying into a shut door)
    const inDrum = (e, v) => [[7.5, 4.3], [4.1, 5.6]].some(([bx, by]) => Math.hypot((e.nx - v.nx) * bx, (e.ny - v.ny) * by) < RD + 1.6);
    for (let i = L.events.length - 1; i >= 0; i--) { const e = L.events[i]; if (e.type === 'ring' && !e.cache && vaults.some((v) => Math.abs(e.d - v.d) < 50 && inDrum(e, v))) L.events.splice(i, 1); }
  },
});
