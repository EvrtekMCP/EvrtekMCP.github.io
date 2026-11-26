// DRIFTLINE: the car-sound config. Every engine and tyre sound in the game is synthesised from these numbers by
// audio/drift-worklet.js (in house, per car and per upgrade: Evrtek via Dirigent, 11-15), so a new car or a new part
// is a new entry here, not a new recording.
//
// Units: rpm, degrees of crankshaft (a four-stroke cycle is 720), metres, hertz, decibels, seconds. Levels are
// shares (0..1) unless the name says otherwise. Lengths of pipe set their resonances (a header's quarter-wave is
// c / 4L, with c about 520 m/s in hot exhaust), so a longer pipe sounds deeper.
//
//   resolveCarSound('six', ['engine-1', 'turbo', 'tires-sport'], { idleRpm: 950, redlineRpm: 7800 })
//     -> { engine: {...}, tyres: {...} }   the object the worklet takes (driftaudio.setCar does this for you)

// ---- engines -------------------------------------------------------------------------------------------------
// firing: the crank angle of each combustion in one 720-degree cycle, which exhaust bank it blows into, and a small
// per-cylinder weight (real cylinders are never identical; the imbalance gives the half-order rumble under the note).
export const ENGINES = {
  turbo4: {
    label: 'Buzzy turbo four', cylinders: 4, displacement: 2.0,
    firing: { events: [0, 180, 360, 540], banks: [0, 1, 0, 1], weights: [1.0, 0.95, 1.04, 0.97] },
    idleRpm: 900, redlineRpm: 7800, limiterRpm: 7850, limiterCutMs: 50,
    pulse: { attackOn: 3.2, attackOff: 8, decayOn: 20, decayOff: 34, lengthDeg: 170, noiseOn: 0.30, noiseOff: 0.45 },
    ccv: { on: 0.06, off: 0.22, idle: 0.10 }, jitterDeg: 1.4, lump: 0.10, miss: 0.03,
    levels: { idle: 0.40, off: 0.15 },
    header: { lengthM: [0.70, 0.78], reflect: -0.45, lossHz: 3800 },
    pipe: { lengthM: 1.45, reflect: -0.25, lossHz: 2600 },
    muffler: { hz: 1250, q: 0.8, bypass: 0.30, chamberHz: 120, chamberDb: 3 },
    raspDb: 3, radHz: 110, drive: 1.7,
    intake: { gain: 0.50, helmHz: 230, helmQ: 3, runnerHz: 680, runnerQ: 5, hiss: 0.28, offsetDeg: 380 },
    mech: { tick: 0.45, tickHz: 4300, whineOrder: 0, whine: 0 },
    pops: { amount: 0.25, minRpm: 3200, gain: 1.0 },
    turbo: { on: true, spool: 0.7, spoolRpm: 2600, fullRpm: 4800, whineLo: 1500, whineHi: 5600, whine: 0.30, hiss: 0.30, bov: 'bov', bovGain: 0.6 },
    interior: { lpHz: 850, boomHz: 115, boomDb: 5, exhaust: 1.0, intake: 0.85, mech: 0.7, turbo: 0.8 },
    mix: { exhaust: 1.0, intake: 0.35, mech: 0.25, turbo: 0.9 }, gain: 0.389,
  },
  six: {
    label: 'Smooth straight six', cylinders: 6, displacement: 3.0,
    // 1-5-3-6-2-4 into a front and a rear 3-into-1 header: the banks alternate, evenly, every 240 degrees
    firing: { events: [0, 120, 240, 360, 480, 600], banks: [0, 1, 0, 1, 0, 1], weights: [1.0, 0.98, 1.02, 0.99, 1.01, 0.98] },
    idleRpm: 850, redlineRpm: 7600, limiterRpm: 7650, limiterCutMs: 55,
    pulse: { attackOn: 4.5, attackOff: 10, decayOn: 26, decayOff: 42, lengthDeg: 170, noiseOn: 0.22, noiseOff: 0.38 },
    ccv: { on: 0.04, off: 0.18, idle: 0.07 }, jitterDeg: 1.0, lump: 0.05, miss: 0.015,
    levels: { idle: 0.36, off: 0.16 },
    header: { lengthM: [0.86, 0.92], reflect: -0.45, lossHz: 3400 },
    pipe: { lengthM: 1.85, reflect: -0.25, lossHz: 2300 },
    muffler: { hz: 900, q: 0.75, bypass: 0.22, chamberHz: 95, chamberDb: 3 },
    raspDb: 1.5, radHz: 90, drive: 1.3,
    intake: { gain: 0.45, helmHz: 190, helmQ: 3, runnerHz: 560, runnerQ: 5, hiss: 0.22, offsetDeg: 380 },
    mech: { tick: 0.35, tickHz: 4000, whineOrder: 0, whine: 0 },
    pops: { amount: 0.18, minRpm: 3000, gain: 0.9 },
    turbo: { on: false, spool: 0.6, spoolRpm: 2800, fullRpm: 5000, whineLo: 1300, whineHi: 5000, whine: 0.30, hiss: 0.28, bov: 'bov', bovGain: 0.6 },
    interior: { lpHz: 800, boomHz: 100, boomDb: 5, exhaust: 1.0, intake: 0.85, mech: 0.6, turbo: 0.8 },
    mix: { exhaust: 1.0, intake: 0.32, mech: 0.22, turbo: 0.9 }, gain: 0.471,
  },
  v8: {
    label: 'Lumpy V8', cylinders: 8, displacement: 5.0,
    // cross-plane, 1-8-4-3-6-5-7-2, odd cylinders on the left bank: each bank hears its own uneven beat (the burble)
    firing: { events: [0, 90, 180, 270, 360, 450, 540, 630], banks: [0, 1, 1, 0, 1, 0, 0, 1], weights: [1.0, 0.97, 1.03, 0.98, 1.02, 0.96, 1.01, 0.99] },
    idleRpm: 750, redlineRpm: 7000, limiterRpm: 7050, limiterCutMs: 70,
    pulse: { attackOn: 5.5, attackOff: 12, decayOn: 34, decayOff: 50, lengthDeg: 180, noiseOn: 0.20, noiseOff: 0.40 },
    ccv: { on: 0.06, off: 0.28, idle: 0.14 }, jitterDeg: 1.6, lump: 0.55, miss: 0.04,
    levels: { idle: 0.30, off: 0.17 },
    header: { lengthM: [0.78, 0.86], reflect: -0.45, lossHz: 3000 },
    pipe: { lengthM: 2.1, reflect: -0.25, lossHz: 2000 },
    muffler: { hz: 650, q: 0.8, bypass: 0.25, chamberHz: 70, chamberDb: 4 },
    raspDb: 1, radHz: 70, drive: 1.5,
    intake: { gain: 0.40, helmHz: 150, helmQ: 3, runnerHz: 430, runnerQ: 4, hiss: 0.20, offsetDeg: 380 },
    mech: { tick: 0.40, tickHz: 3600, whineOrder: 0, whine: 0 },
    pops: { amount: 0.40, minRpm: 2600, gain: 1.1 },
    turbo: { on: false, spool: 0.8, spoolRpm: 2400, fullRpm: 4400, whineLo: 1200, whineHi: 4600, whine: 0.30, hiss: 0.28, bov: 'bov', bovGain: 0.6 },
    interior: { lpHz: 700, boomHz: 80, boomDb: 6, exhaust: 1.0, intake: 0.8, mech: 0.6, turbo: 0.8 },
    mix: { exhaust: 1.0, intake: 0.30, mech: 0.22, turbo: 0.9 }, gain: 0.551,
  },
  rotary: {
    label: 'Screaming rotary', cylinders: 2, displacement: 1.3,
    // two rotors, each firing once per turn of the eccentric shaft: four events in 720 degrees of it. The
    // peripheral exhaust port opens fast and stays open long, so its pulses are sharp, long and full of noise.
    firing: { events: [0, 180, 360, 540], banks: [0, 1, 0, 1], weights: [1.0, 0.94, 1.03, 0.96] },
    idleRpm: 1000, redlineRpm: 9000, limiterRpm: 9050, limiterCutMs: 45,
    pulse: { attackOn: 2.2, attackOff: 6, decayOn: 46, decayOff: 60, lengthDeg: 290, noiseOn: 0.55, noiseOff: 0.65 },
    ccv: { on: 0.07, off: 0.30, idle: 0.20 }, jitterDeg: 2.2, lump: 0.65, miss: 0.08,
    levels: { idle: 0.45, off: 0.20 },
    header: { lengthM: [0.58, 0.58], reflect: -0.45, lossHz: 4500 },
    pipe: { lengthM: 1.2, reflect: -0.25, lossHz: 3200 },
    muffler: { hz: 1600, q: 0.8, bypass: 0.45, chamberHz: 140, chamberDb: 2 },
    raspDb: 4, radHz: 130, drive: 2.0,
    intake: { gain: 0.40, helmHz: 260, helmQ: 3, runnerHz: 760, runnerQ: 5, hiss: 0.30, offsetDeg: 250 },
    mech: { tick: 0.10, tickHz: 5000, whineOrder: 0, whine: 0 },
    pops: { amount: 0.55, minRpm: 3500, gain: 1.2 },
    turbo: { on: false, spool: 0.6, spoolRpm: 3200, fullRpm: 5600, whineLo: 1600, whineHi: 6000, whine: 0.30, hiss: 0.30, bov: 'bov', bovGain: 0.6 },
    interior: { lpHz: 900, boomHz: 120, boomDb: 4, exhaust: 1.0, intake: 0.8, mech: 0.5, turbo: 0.8 },
    mix: { exhaust: 1.0, intake: 0.30, mech: 0.15, turbo: 0.9 }, gain: 0.374,
  },
  v6tt: {
    label: 'Twin-turbo V6', cylinders: 6, displacement: 3.0,
    // 60-degree V6, 1-2-3-4-5-6, odd cylinders on the left: the banks alternate evenly, each into its own small
    // turbo. The turbines take the edge off the exhaust; the whistle and the blow-off are the voice.
    firing: { events: [0, 120, 240, 360, 480, 600], banks: [0, 1, 0, 1, 0, 1], weights: [1.0, 0.97, 1.02, 0.98, 1.03, 0.97] },
    idleRpm: 850, redlineRpm: 7400, limiterRpm: 7450, limiterCutMs: 55,
    pulse: { attackOn: 4.5, attackOff: 10, decayOn: 26, decayOff: 40, lengthDeg: 170, noiseOn: 0.26, noiseOff: 0.40 },
    ccv: { on: 0.05, off: 0.20, idle: 0.08 }, jitterDeg: 1.2, lump: 0.10, miss: 0.02,
    levels: { idle: 0.36, off: 0.16 },
    header: { lengthM: [0.62, 0.66], reflect: -0.45, lossHz: 2800 },
    pipe: { lengthM: 1.7, reflect: -0.25, lossHz: 2200 },
    muffler: { hz: 950, q: 0.75, bypass: 0.25, chamberHz: 100, chamberDb: 3 },
    raspDb: 2, radHz: 95, drive: 1.5,
    intake: { gain: 0.40, helmHz: 200, helmQ: 3, runnerHz: 600, runnerQ: 5, hiss: 0.30, offsetDeg: 380 },
    mech: { tick: 0.35, tickHz: 4200, whineOrder: 0, whine: 0 },
    pops: { amount: 0.20, minRpm: 3000, gain: 0.9 },
    turbo: { on: true, spool: 0.45, spoolRpm: 2400, fullRpm: 4200, whineLo: 1900, whineHi: 6400, whine: 0.36, hiss: 0.34, bov: 'bov', bovGain: 0.7 },
    interior: { lpHz: 800, boomHz: 105, boomDb: 5, exhaust: 1.0, intake: 0.85, mech: 0.6, turbo: 0.9 },
    mix: { exhaust: 1.0, intake: 0.34, mech: 0.22, turbo: 1.0 }, gain: 0.326,
  },
  flat6: {
    label: 'Howling flat six', cylinders: 6, displacement: 3.6,
    // a boxer six, 1-6-2-4-3-5, the two banks alternating: even and smooth, but the short equal headers, the
    // big intake plenum and the busy valvetrain give it the high wail and mechanical edge of a flat six at 9000
    firing: { events: [0, 120, 240, 360, 480, 600], banks: [0, 1, 0, 1, 0, 1], weights: [1.0, 0.99, 1.01, 0.99, 1.01, 0.98] },
    idleRpm: 900, redlineRpm: 8800, limiterRpm: 8850, limiterCutMs: 50,
    pulse: { attackOn: 3.8, attackOff: 9, decayOn: 24, decayOff: 38, lengthDeg: 165, noiseOn: 0.24, noiseOff: 0.36 },
    ccv: { on: 0.04, off: 0.18, idle: 0.07 }, jitterDeg: 1.0, lump: 0.08, miss: 0.015,
    levels: { idle: 0.36, off: 0.16 },
    header: { lengthM: [0.66, 0.66], reflect: -0.45, lossHz: 4200 },
    pipe: { lengthM: 1.5, reflect: -0.25, lossHz: 2800 },
    muffler: { hz: 1200, q: 0.75, bypass: 0.30, chamberHz: 115, chamberDb: 2 },
    raspDb: 2.5, radHz: 100, drive: 1.4,
    intake: { gain: 0.65, helmHz: 240, helmQ: 3.5, runnerHz: 720, runnerQ: 6, hiss: 0.30, offsetDeg: 380 },
    mech: { tick: 0.55, tickHz: 4600, whineOrder: 0, whine: 0 },
    pops: { amount: 0.20, minRpm: 3500, gain: 0.9 },
    turbo: { on: false, spool: 0.6, spoolRpm: 3000, fullRpm: 5200, whineLo: 1500, whineHi: 5600, whine: 0.30, hiss: 0.28, bov: 'bov', bovGain: 0.6 },
    interior: { lpHz: 850, boomHz: 110, boomDb: 4, exhaust: 1.0, intake: 0.9, mech: 0.7, turbo: 0.8 },
    mix: { exhaust: 1.0, intake: 0.45, mech: 0.30, turbo: 0.9 }, gain: 0.407,
  },
};
// the game's own names for them (js/data/cars.js `sound`)
export const PRESET_ALIAS = { i6: 'six', inline6: 'six', straight6: 'six', four: 'turbo4', i4: 'turbo4' };

// ---- 11-18, synth 2: the combustion engine (Engine sound: New) ------------------------------------------------------
// One model (audio/drift-worklet.js, Combustion), six presets. What makes them differ is what makes real engines differ:
// the firing order and spacing (and which exhaust bank each cylinder blows into), the pulse (its width in crank degrees,
// capped in time so an idle chugs; its sharpness, its turbulence), the cycle-to-cycle variation and the idle's lump, and
// the pipes: header lengths per bank (unequal ones rumble), one collector or true duals (two separate pipes), the pipe,
// the muffler chamber (its expansion `area` relative to the pipe, its absorption `atten` and `lossHz`: a big, lossy
// chamber is quiet and round, a small low-loss one is a straight-through race can), the tailpipe and its open end.
// Areas are relative (a header is 1). Lengths in metres (sound runs at 520 m/s in the hot exhaust: a header's
// quarter-wave is c / 4L). pops: afterfire per lift (amount), its rpm floor, the share of big bangs, the chance on a
// shift and a blip. shift.flat: a sequential box's ignition-cut shift (the throttle held, bangs on every change).
// gain: set by tools/sound/calibrate-synth2.mjs so New plays as loud as Classic on the same runs.
const I4 = { events: [0, 180, 360, 540], banks: [0, 1, 0, 1] };
const SIX = { events: [0, 120, 240, 360, 480, 600], banks: [0, 1, 0, 1, 0, 1] };
export const COMBUSTION = {
  // KESTREL: a 2.0 turbo four with a raw aftermarket turbo-back exhaust (a 3-inch pipe, one straight-through can):
  // short manifold into the turbine (which rounds the pulses), a big low-loss pipe, little muffling, crackle on a lift
  turbo4: {
    label: 'Turbo four, raw turbo-back exhaust', model: 'combustion', cylinders: 4, displacement: 2.0,
    firing: Object.assign({ weights: [1.0, 0.96, 1.03, 0.98] }, I4),
    idleRpm: 950, redlineRpm: 7600, limiterRpm: 7650, limiter: { cutMs: 55, dropRpmS: 2800, pops: 0.35 }, flywheel: 0.010,
    pulse: { maxMs: 6, deg: 150, rise: 0.06, fall: 0.28, riseOff: 0.2, fallOff: 0.4, noise: 0.55, noiseOff: 0.3, ccvOn: 0.05, ccvOff: 0.22, ccvIdle: 0.1, jitterDeg: 1.3, lump: 0.12, miss: 0.02, off: 0.16, idle: 0.55, bark: 0.4 },
    header: { lengthM: [0.42, 0.47], area: 1, lossHz: 5000, atten: 0.965 }, collector: { drive: 1.3 }, turbine: { lpHz: 4000 },
    pipe: { lengthM: 2.2, area: 1.8, lossHz: 4500, atten: 0.95 }, muffler: { lengthM: 0.5, area: 2.2, lossHz: 3000, atten: 0.93 }, tail: { lengthM: 0.35, area: 1.6, lossHz: 6000, atten: 0.97 },
    outlet: { reflect: -0.7, lossHz: 3000 }, radHz: 28,
    intake: { lengthM: 0.3, reflect: 0.7, open: -0.6, plenumHz: 230, plenumQ: 2.5, hiss: 0.15, gain: 0.2, offsetDeg: 400 },
    block: { hz: 150, q: 3, gain: 0.45, order1: 0.03 }, guts: { gain: 0.5, lpHz: 170 }, overrun: { air: 0.25, hollow: 0.6 },
    pops: { amount: 0.35, minRpm: 3000, gain: 1.0, bang: 0.12, shift: 0.3, blip: 0.35 }, shift: { dropS: 0.05, blip: 0.06 },
    turbo: { on: true, spool: 0.7, spoolRpm: 2600, fullRpm: 4800, whineLo: 1700, whineHi: 5200, whine: 0.11, hiss: 0.18, bov: 'both', bovGain: 0.7, flutterGain: 0.5 },
    interior: { lpHz: 850, boomHz: 110, boomDb: 5 }, mix: { exhaust: 1, intake: 0.35, block: 0.5, turbo: 0.75, shots: 0.7 }, gain: 0.69,
  },
  // VANTA: a smooth 3.0 straight six, a GT: 1-5-3-6-2-4 into two 3-into-1 headers, long overlapping pulses (the
  // chord-like six), a long lossy muffler, almost no crackle
  six: {
    label: 'Straight six, GT', model: 'combustion', cylinders: 6, displacement: 3.0,
    firing: Object.assign({ weights: [1.0, 0.99, 1.01, 0.99, 1.01, 0.99] }, SIX),
    idleRpm: 900, redlineRpm: 7400, limiterRpm: 7450, limiter: { cutMs: 70, dropRpmS: 2200, pops: 0.04 }, flywheel: 0.014,
    pulse: { maxMs: 7, deg: 170, rise: 0.1, fall: 0.32, riseOff: 0.22, fallOff: 0.42, noise: 0.22, noiseOff: 0.25, ccvOn: 0.03, ccvOff: 0.15, ccvIdle: 0.06, jitterDeg: 0.8, lump: 0.04, miss: 0.01, off: 0.15, idle: 0.5, bark: 0.25 },
    header: { lengthM: [0.85, 0.9], area: 1, lossHz: 4500, atten: 0.965 }, collector: { drive: 1.1 },
    pipe: { lengthM: 2.6, area: 1.6, lossHz: 3500, atten: 0.95 }, muffler: { lengthM: 0.7, area: 2.5, lossHz: 1500, atten: 0.75 }, tail: { lengthM: 0.5, area: 1.3, lossHz: 5000, atten: 0.97 },
    outlet: { reflect: -0.8, lossHz: 2200 }, radHz: 28,
    intake: { lengthM: 0.35, reflect: 0.75, open: -0.6, plenumHz: 190, plenumQ: 2.5, hiss: 0.2, gain: 0.45, offsetDeg: 400 },
    block: { hz: 120, q: 3, gain: 0.4, order1: 0.02 }, guts: { gain: 0.45, lpHz: 170 }, overrun: { air: 0.2, hollow: 0.5 },
    pops: { amount: 0.05, minRpm: 3500, gain: 0.6, bang: 0.02, shift: 0.03, blip: 0.05 }, shift: { dropS: 0.06, blip: 0.05 },
    turbo: { on: false }, interior: { lpHz: 800, boomHz: 100, boomDb: 5 }, mix: { exhaust: 1, intake: 0.5, block: 0.45, turbo: 0.7, shots: 0.6 }, gain: 1.091,
  },
  // HALBERD: a lazy cross-plane V8, muscle: 1-8-4-3-6-5-7-2, each bank into its own pipe (true duals), so each pipe
  // hears its bank's uneven beat (the burble); a heavy flywheel, a lumpy cam at idle, chambered mufflers, a burble on
  // the overrun with the odd deep boom
  v8: {
    label: 'Cross-plane V8, muscle, true duals', model: 'combustion', cylinders: 8, displacement: 5.7,
    firing: { events: [0, 90, 180, 270, 360, 450, 540, 630], banks: [0, 1, 1, 0, 1, 0, 0, 1], weights: [1.0, 0.96, 1.04, 0.97, 1.03, 0.95, 1.02, 0.98] },
    idleRpm: 800, redlineRpm: 6600, limiterRpm: 6650, limiter: { cutMs: 75, dropRpmS: 2200, pops: 0.2 }, flywheel: 0.022,
    pulse: { maxMs: 9, deg: 160, rise: 0.1, fall: 0.34, riseOff: 0.22, fallOff: 0.44, noise: 0.3, noiseOff: 0.3, ccvOn: 0.06, ccvOff: 0.3, ccvIdle: 0.16, jitterDeg: 1.8, lump: 0.6, miss: 0.04, off: 0.18, idle: 0.6, bark: 0.45 },
    dual: true, header: { lengthM: [0.75, 0.82], area: 1, lossHz: 4200, atten: 0.965 }, collector: { drive: 1.3 },
    pipe: { lengthM: 2.1, area: 1.5, lossHz: 3600, atten: 0.95 }, muffler: { lengthM: 0.4, area: 3, lossHz: 1800, atten: 0.9 }, tail: { lengthM: 0.55, area: 1.3, lossHz: 5000, atten: 0.97 },
    outlet: { reflect: -0.8, lossHz: 2000 }, radHz: 24,
    intake: { lengthM: 0.28, reflect: 0.75, open: -0.6, plenumHz: 150, plenumQ: 2.5, hiss: 0.2, gain: 0.4, offsetDeg: 400 },
    block: { hz: 95, q: 2.5, gain: 0.6, order1: 0.06 }, guts: { gain: 0.55, lpHz: 150 }, overrun: { air: 0.2, hollow: 0.7 },
    pops: { amount: 0.3, minRpm: 2300, gain: 1.1, bang: 0.25, shift: 0.15, blip: 0.3 }, shift: { dropS: 0.07, blip: 0.07 },
    turbo: { on: false }, interior: { lpHz: 700, boomHz: 80, boomDb: 6 }, mix: { exhaust: 1, intake: 0.4, block: 0.6, turbo: 0.7, shots: 0.7 }, gain: 0.648,
  },
  // ORBIT: the car's own twin-rotor rotary, small and high-revving (9,000). Two rotors fire as often as a four, but the
  // peripheral exhaust port snaps open and stays open long: sharp, long, noisy pulses, a raspy short system, the
  // "brap" of an uneven idle (port overlap), and lots of crackle
  rotary: {
    label: 'Twin-rotor rotary, high-revving', model: 'combustion', cylinders: 2, displacement: 1.3,
    firing: { events: [0, 180, 360, 540], banks: [0, 1, 0, 1], weights: [1.0, 0.93, 1.04, 0.95] },
    idleRpm: 1000, redlineRpm: 9000, limiterRpm: 9050, limiter: { cutMs: 45, dropRpmS: 3200, pops: 0.5 }, flywheel: 0.008,
    pulse: { maxMs: 5, deg: 250, rise: 0.05, fall: 0.4, riseOff: 0.15, fallOff: 0.45, noise: 0.6, noiseOff: 0.4, ccvOn: 0.07, ccvOff: 0.3, ccvIdle: 0.22, jitterDeg: 2.2, lump: 0.7, miss: 0.08, off: 0.2, idle: 0.6, bark: 0.4 },
    header: { lengthM: [0.5, 0.5], area: 1.1, lossHz: 5500, atten: 0.965 }, collector: { drive: 1.5 },
    pipe: { lengthM: 1.8, area: 1.7, lossHz: 5000, atten: 0.95 }, muffler: { lengthM: 0.35, area: 1.8, lossHz: 3500, atten: 0.95 }, tail: { lengthM: 0.3, area: 1.5, lossHz: 6000, atten: 0.97 },
    outlet: { reflect: -0.65, lossHz: 3500 }, radHz: 30,
    intake: { lengthM: 0.25, reflect: 0.7, open: -0.6, plenumHz: 260, plenumQ: 2.5, hiss: 0.35, gain: 0.5, offsetDeg: 300 },
    block: { hz: 170, q: 3, gain: 0.25, order1: 0.02 }, guts: { gain: 0.45, lpHz: 180 }, overrun: { air: 0.25, hollow: 0.6 },
    pops: { amount: 0.55, minRpm: 3500, gain: 1.15, bang: 0.15, shift: 0.3, blip: 0.4 }, shift: { dropS: 0.04, blip: 0.07 },
    turbo: { on: false }, interior: { lpHz: 900, boomHz: 120, boomDb: 4 }, mix: { exhaust: 1, intake: 0.45, block: 0.3, turbo: 0.7, shots: 0.7 }, gain: 0.581,
  },
  // SPECTRE: the snappy track car, the car's own twin-turbo V6 (60 degrees, even 120-degree firing), each bank into its
  // own small turbo and its own short race pipe; a sequential box: every upshift an ignition cut with the throttle
  // held (bangs), a hard bouncing limiter, a blow-off on a lift
  v6tt: {
    label: 'Twin-turbo V6, track car, flat-shift', model: 'combustion', cylinders: 6, displacement: 3.0,
    firing: Object.assign({ weights: [1.0, 0.97, 1.02, 0.98, 1.03, 0.97] }, SIX),
    idleRpm: 950, redlineRpm: 7600, limiterRpm: 7650, limiter: { cutMs: 40, dropRpmS: 3500, pops: 0.6 }, flywheel: 0.008,
    pulse: { maxMs: 6, deg: 150, rise: 0.07, fall: 0.28, riseOff: 0.2, fallOff: 0.4, noise: 0.45, noiseOff: 0.3, ccvOn: 0.04, ccvOff: 0.2, ccvIdle: 0.08, jitterDeg: 1.1, lump: 0.15, miss: 0.02, off: 0.16, idle: 0.5, bark: 0.5 },
    dual: true, header: { lengthM: [0.38, 0.4], area: 1, lossHz: 5500, atten: 0.965 }, collector: { drive: 1.4 }, turbine: { lpHz: 3200 },
    pipe: { lengthM: 1.6, area: 1.6, lossHz: 5000, atten: 0.95 }, muffler: { lengthM: 0.3, area: 1.6, lossHz: 4000, atten: 0.97 }, tail: { lengthM: 0.3, area: 1.5, lossHz: 6000, atten: 0.97 },
    outlet: { reflect: -0.65, lossHz: 3500 }, radHz: 30,
    intake: { lengthM: 0.3, reflect: 0.7, open: -0.6, plenumHz: 220, plenumQ: 2.5, hiss: 0.2, gain: 0.25, offsetDeg: 400 },
    block: { hz: 140, q: 3, gain: 0.45, order1: 0.03 }, guts: { gain: 0.45, lpHz: 170 }, overrun: { air: 0.25, hollow: 0.6 },
    pops: { amount: 0.45, minRpm: 3500, gain: 1.1, bang: 0.2, shift: 0.6, blip: 0.45 }, shift: { dropS: 0.03, blip: 0.06, flat: true },
    turbo: { on: true, spool: 0.45, spoolRpm: 2400, fullRpm: 4200, whineLo: 2400, whineHi: 8500, whine: 0.14, hiss: 0.3, bov: 'bov', bovGain: 0.5, flutterGain: 0.4, twin: true },
    interior: { lpHz: 850, boomHz: 105, boomDb: 5 }, mix: { exhaust: 1, intake: 0.3, block: 0.45, turbo: 0.75, shots: 0.7 }, gain: 0.527,
  },
  // ZENITH: a 4.0 flat six at 9,200: 1-6-2-4-3-5, the two 3-cylinder banks alternating into equal short headers (the
  // third-order wail), a loud intake, a valved sport exhaust, strong crackle on a lift
  flat6: {
    label: 'Flat six, high-revving', model: 'combustion', cylinders: 6, displacement: 4.0,
    firing: Object.assign({ weights: [1.0, 0.99, 1.01, 0.99, 1.01, 0.98] }, SIX),
    idleRpm: 950, redlineRpm: 9200, limiterRpm: 9250, limiter: { cutMs: 50, dropRpmS: 3000, pops: 0.45 }, flywheel: 0.009,
    pulse: { maxMs: 5.5, deg: 145, rise: 0.07, fall: 0.26, riseOff: 0.2, fallOff: 0.4, noise: 0.35, noiseOff: 0.28, ccvOn: 0.035, ccvOff: 0.18, ccvIdle: 0.07, jitterDeg: 0.9, lump: 0.08, miss: 0.015, off: 0.16, idle: 0.5, bark: 0.35 },
    header: { lengthM: [0.6, 0.6], area: 1, lossHz: 5500, atten: 0.965 }, collector: { drive: 1.25 },
    pipe: { lengthM: 1.6, area: 1.6, lossHz: 5000, atten: 0.95 }, muffler: { lengthM: 0.45, area: 2.5, lossHz: 2800, atten: 0.9 }, tail: { lengthM: 0.4, area: 1.4, lossHz: 6000, atten: 0.97 },
    outlet: { reflect: -0.75, lossHz: 3000 }, radHz: 30,
    intake: { lengthM: 0.25, reflect: 0.75, open: -0.6, plenumHz: 240, plenumQ: 3, hiss: 0.3, gain: 0.65, offsetDeg: 400 },
    block: { hz: 160, q: 3, gain: 0.4, order1: 0.03 }, guts: { gain: 0.4, lpHz: 180 }, overrun: { air: 0.22, hollow: 0.6 },
    pops: { amount: 0.55, minRpm: 3500, gain: 1.0, bang: 0.12, shift: 0.35, blip: 0.45 }, shift: { dropS: 0.035, blip: 0.07 },
    turbo: { on: false }, interior: { lpHz: 850, boomHz: 110, boomDb: 4 }, mix: { exhaust: 1, intake: 0.6, block: 0.4, turbo: 0.7, shots: 0.7 }, gain: 0.686,
  },
};
// the fitted parts, for the combustion engine: the same upgrades as MODS below, in this model's terms
const MODS2 = {
  catback: { mul: { 'mix.exhaust': 1.2, 'muffler.area': 0.75, 'muffler.lossHz': 1.25, 'outlet.lossHz': 1.15 }, add: { 'muffler.atten': 0.03, 'pops.amount': 0.12 } },
  sport: { mul: { 'mix.exhaust': 1.3, 'muffler.area': 0.6, 'muffler.lossHz': 1.4, 'outlet.lossHz': 1.25, 'intake.gain': 1.2 }, add: { 'muffler.atten': 0.05, 'pops.amount': 0.25 } },
  straight: { mul: { 'mix.exhaust': 1.35, 'muffler.lossHz': 1.6, 'outlet.lossHz': 1.3, 'intake.gain': 1.2 }, set: { 'muffler.area': 1.3 }, add: { 'muffler.atten': 0.08, 'pops.amount': 0.45, 'pops.bang': 0.1 } },
  stage2: { mul: { 'collector.drive': 1.3, 'pulse.rise': 0.75, 'intake.gain': 1.3, 'pulse.ccvIdle': 1.3 }, add: { 'pulse.lump': 0.25, 'pops.amount': 0.1 } },
  stage3: { mul: { 'collector.drive': 1.6, 'pulse.rise': 0.65, 'intake.gain': 1.45, 'pulse.ccvIdle': 1.5 }, add: { 'pulse.lump': 0.4, 'pops.amount': 0.15 } },
  turbo: { set: { 'turbo.on': true, 'turbo.bov': 'flutter' }, mul: { 'turbo.whine': 1.8, 'mix.exhaust': 0.92 } },
  strip: { mul: { 'interior.lpHz': 1.8, 'interior.block': 1.5, 'interior.exhaust': 1.25 }, add: { 'interior.boomDb': 2 } },
  super: { set: { 'turbo.on': true, 'turbo.spool': 0.04, 'turbo.spoolRpm': 900, 'turbo.fullRpm': 7400, 'turbo.bov': 'none' }, mul: { 'turbo.hiss': 0.2, 'mix.exhaust': 0.95 }, add: { 'turbo.whine': 0.12 } },
};
const UP2 = { 'exhaust:1': 'catback', 'engine-1': 'sport', 'exhaust:2': 'straight', 'engine-2': 'stage2', 'harsh:1': 'stage2', 'harsh:2': 'stage3', turbo: 'turbo', 'turbo:1': 'turbo', strip: 'strip', 'strip:1': 'strip', 'super:1': 'super' };
// a turbo kit on a car that had none needs the rest of a turbo's numbers
const TURBO_KIT = { spool: 0.7, spoolRpm: 2800, fullRpm: 5000, whineLo: 1600, whineHi: 6500, whine: 0.16, hiss: 0.28, bovGain: 0.5, flutterGain: 0.5 };

// ---- 11-26 (3), New+: the same six engines with depth ------------------------------------------------------------
// Evrtek, 11-26: "give the engines a better sound and give our tires squeal a little bit more fidelity ... that cinema
// quality depth". New+ is New (above) plus the layers in audio/drift-worklet.js (DEFAULT_PLUS: induction, mechanicals,
// irregularity, load tone and burble, crackle, phone bass, shift clunk and pop, the turbo's whistle and surge). What
// differs per car is the character: the KESTREL's intake is its compressor (a high, smooth roar), the VANTA a GT's quiet
// airbox and little crackle, the HALBERD a big airbox honk, a pushrod's low tick and the burble, the ORBIT no valves at
// all (its "mechanical" is the gear whine, its intake the port buzz), the SPECTRE flat-shift pops and two turbos, the
// ZENITH the howl (a long-ringing runner resonance) and a busy valvetrain. Everything not named takes DEFAULT_PLUS.
// trim: the car's level in New+ against New, in dB (tools/sound/depth-1126.mjs's pairs).
export const PLUS = {
  turbo4: { induction: { gain: 0.45, roarLo: 450, roarHi: 1800, roarQ: 1.4, honkHz: 210, honk: 0.3, runnerHz: 650, runner: 0.2 }, mech: { tick: 0.45, tickHz: 4400, chain: 0.25, teeth: 19 },
    overrun: { burble: 0.3, crackle: 1.1 }, shift: { pop: 0.55, clunk: 0.5 }, turbo: { whistle: 1, surge: 1, surgeHz: 13 }, load: { odd: 0.5 }, bass: { gain: 1 } },
  six: { induction: { gain: 0.5, roarLo: 300, roarHi: 1100, honkHz: 190, honk: 0.55, runnerHz: 560, runner: 0.35 }, mech: { tick: 0.35, tickHz: 4200, chain: 0.2, teeth: 21 },
    overrun: { burble: 0.12, crackle: 0.4 }, shift: { pop: 0.12, clunk: 0.45 }, load: { odd: 0.4 }, irregular: { wander: 0.025 }, bass: { gain: 0.9 } },
  v8: { trim: -1.2, induction: { gain: 0.35, roarLo: 220, roarHi: 800, honkHz: 120, honk: 0.8, runnerHz: 430, runner: 0.3 }, mech: { tick: 0.4, tickHz: 3200, tickQ: 2.5, chain: 0.15, teeth: 20 },
    overrun: { burble: 0.65, late: 55, crackle: 0.8 }, shift: { pop: 0.35, clunk: 0.6, clunkHz: 48 }, load: { odd: 0.6 }, irregular: { wander: 0.04 }, bass: { gain: 1.1, fc: 200 } },
  rotary: { induction: { gain: 0.5, roarLo: 400, roarHi: 1500, honkHz: 260, honk: 0.4, runnerHz: 760, runner: 0.45, buzz: 0.7, buzzHz: 2400 }, mech: { tick: 0, valves: 0, chain: 0.3, teeth: 33 },
    overrun: { burble: 0.45, crackle: 1.3 }, shift: { pop: 0.7, clunk: 0.45 }, load: { odd: 0.6 }, irregular: { ar: 0.3, wander: 0.045 }, bass: { gain: 0.9 } },
  v6tt: { induction: { gain: 0.45, roarLo: 450, roarHi: 1800, roarQ: 1.4, honkHz: 220, honk: 0.25, runnerHz: 620, runner: 0.2 }, mech: { tick: 0.4, tickHz: 4500, chain: 0.3, teeth: 19 },
    overrun: { burble: 0.25, crackle: 1.1 }, shift: { pop: 0.9, clunk: 0.4 }, turbo: { whistle: 1, surge: 0.6 }, load: { odd: 0.55 }, bass: { gain: 0.9 } },
  flat6: { induction: { gain: 0.5, roarLo: 350, roarHi: 1400, honkHz: 240, honk: 0.6, runnerHz: 720, runnerQ: 9, runner: 0.6 }, mech: { tick: 0.6, tickHz: 4800, chain: 0.35, teeth: 22 },
    overrun: { burble: 0.3, crackle: 1.2 }, shift: { pop: 0.6, clunk: 0.5 }, load: { odd: 0.5 }, bass: { gain: 0.9 } },
};
// The five-tap panel's and the bench's switches and levels (js/config.js TUNING.sound), into the worklet's terms:
// each layer on (1) or back to New's own (0), and a level (1 as built)
export function plusFrom(s = {}) {
  const n = (k, d = 1) => (s[k] == null || !isFinite(+s[k]) ? d : +s[k]);
  return {
    engine: { on: { induction: n('induction'), mech: n('mechanical'), irregular: n('irregular'), load: n('loadTone'), overrun: n('overrun'), bass: n('phoneBass'), shift: n('shiftFx'), turbo: n('turboFx') },
      lvl: { exhaust: 1, induction: n('inductionLvl'), mech: n('mechLvl'), overrun: n('overrunLvl'), bass: n('bassLvl'), shift: n('shiftLvl'), turbo: n('turboLvl') }, solo: s.solo && !String(s.solo).startsWith('t:') ? s.solo : '' },
    tyres: { on: { screech: n('screech'), four: n('fourTyres'), transitions: n('transitions') }, lvl: { screech: n('screechLvl'), front: n('frontLvl'), transitions: n('transLvl'), scrub: n('transLvl') }, solo: s.solo && String(s.solo).startsWith('t:') ? String(s.solo).slice(2) : '' },
  };
}
const merge = (a, b) => { const o = Object.assign({}, a); for (const [k, v] of Object.entries(b || {})) o[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a && a[k], v) : v; return o; };

// ---- tyres ---------------------------------------------------------------------------------------------------
// A squeal is a tread resonance excited by stick-slip: a tone (tonal share) plus noise through two narrow bands at
// the squeal pitch and an overtone. At the edge of grip it comes in chirps; past fullDeg of slide it is a steady,
// warbling screech. Semi-slicks squeal later and lower and rip more than they sing.
export const COMPOUNDS = {
  street: { label: 'Street', squealHz: 880, q: 26, tonal: 0.60, overtone: 2.03, overtoneGain: 0.35, noise: 0.25,
    warbleHz: [7, 12], warbleDepth: 0.35, wobble: 0.025, onsetDeg: 5, fullDeg: 30, chirp: 1.0, gain: 1.0, roar: 1.0 },
  sport: { label: 'Sport', squealHz: 1000, q: 20, tonal: 0.50, overtone: 2.06, overtoneGain: 0.30, noise: 0.35,
    warbleHz: [8, 13], warbleDepth: 0.30, wobble: 0.022, onsetDeg: 7, fullDeg: 36, chirp: 0.85, gain: 0.95, roar: 1.0 },
  semi: { label: 'Semi-slick (drift compound)', squealHz: 760, q: 12, tonal: 0.32, overtone: 2.15, overtoneGain: 0.25, noise: 0.60,
    warbleHz: [9, 15], warbleDepth: 0.25, wobble: 0.03, onsetDeg: 9, fullDeg: 42, chirp: 0.6, gain: 0.95, roar: 1.15 },
  drift: { label: 'Drift-spec (high, smoky squeal)', squealHz: 1120, q: 18, tonal: 0.45, overtone: 2.05, overtoneGain: 0.35, noise: 0.45,
    warbleHz: [8, 14], warbleDepth: 0.32, wobble: 0.028, onsetDeg: 6, fullDeg: 34, chirp: 0.9, gain: 1.15, roar: 1.05 },
};
// pitch and squeal multiply the compound; roar is the rolling noise; kerb and gravel switch their own layers on
export const SURFACES = {
  asphalt: { pitch: 1.0, squeal: 1.0, q: 1.0, roar: 1.0, roarHz: 1.0, kerb: 0, gravel: 0 },
  concrete: { pitch: 1.18, squeal: 1.15, q: 1.3, roar: 1.25, roarHz: 1.5, kerb: 0, gravel: 0 },
  kerb: { pitch: 1.05, squeal: 0.6, q: 0.8, roar: 1.2, roarHz: 1.2, kerb: 1, gravel: 0, stripeM: 0.55 },
  gravel: { pitch: 0.9, squeal: 0.04, q: 0.5, roar: 1.4, roarHz: 0.6, kerb: 0, gravel: 1 },
};
export const TYRES = { roar: 0.55, wind: 0.5, front: 0.5, kerb: 0.12, gravel: 0.5, squeal: 0.6, interiorLpHz: 2200 };

// ---- upgrades --------------------------------------------------------------------------------------------------
// mul multiplies, add adds, set replaces (dotted paths into the engine entry above). Two ways in: the upgrade ids of
// js/config.js (UPGRADES), and the sound hints of js/data/upgrades.js as the game's adapter passes them
// (setEngine(preset, { exhaust: 2, harsh: 1, turbo: 1, squeal: 'high' }) -> 'exhaust:2', 'harsh:1', ...).
// Applied in the order listed here, whatever order the car lists them.
const MODS = {
  catback: { mul: { 'mix.exhaust': 1.25, 'muffler.hz': 1.25, 'pipe.lengthM': 1.08, 'intake.gain': 1.1 }, add: { 'muffler.bypass': 0.12, 'muffler.chamberDb': 1.5, raspDb: 1.5, 'pops.amount': 0.2 } },
  sport: { mul: { 'mix.exhaust': 1.35, 'muffler.hz': 1.35, 'pipe.lengthM': 1.12, 'intake.gain': 1.2, 'pops.gain': 0.85 }, add: { 'muffler.bypass': 0.18, 'muffler.chamberDb': 2, raspDb: 2, 'pops.amount': 0.35 } },
  straight: { mul: { 'mix.exhaust': 1.35, 'muffler.hz': 1.6, 'pipe.lengthM': 1.15, 'intake.gain': 1.2, 'pops.gain': 0.7 }, add: { 'muffler.bypass': 0.35, 'muffler.chamberDb': 2.5, raspDb: 3, 'pops.amount': 0.6 } },
  stage2: { mul: { drive: 1.35, 'pulse.attackOn': 0.75, 'intake.gain': 1.3, 'mech.tick': 1.2, 'ccv.idle': 1.3 }, add: { lump: 0.25, 'pops.amount': 0.1 } },
  stage3: { mul: { drive: 1.6, 'pulse.attackOn': 0.65, 'intake.gain': 1.45, 'mech.tick': 1.35, 'ccv.idle': 1.5 }, add: { lump: 0.4, 'pops.amount': 0.15 } },
  turbo: { set: { 'turbo.on': true, 'turbo.bov': 'flutter' }, mul: { 'turbo.whine': 2.0, 'header.lossHz': 0.85, 'mix.exhaust': 0.92 } },
  strip: { mul: { 'interior.lpHz': 1.8, 'interior.mech': 1.5, 'interior.exhaust': 1.25 }, add: { 'interior.boomDb': 2 } },
  // day 3 (Fundi, game builder): a supercharger rides the turbo's machinery with no lag, its pitch following the revs
  // across the whole range, louder whine, little hiss and no blow-off
  super: { set: { 'turbo.on': true, 'turbo.spool': 0.04, 'turbo.spoolRpm': 900, 'turbo.fullRpm': 7400, 'turbo.bovGain': 0 }, mul: { 'turbo.hiss': 0.2, 'mix.exhaust': 0.95 }, add: { 'turbo.whine': 0.22 } },
};
export const UPGRADE_SOUND = {
  'exhaust:1': { label: 'Cat-back exhaust (more voice)', engine: MODS.catback },
  'engine-1': { label: 'Sport exhaust (stage 1: intake, exhaust, tune)', engine: MODS.sport },
  'exhaust:2': { label: 'Straight pipe (loud, crackles on the lift)', engine: MODS.straight },
  'engine-2': { label: 'Engine package (stage 2: cams, pistons, throttle body)', engine: MODS.stage2 },
  'harsh:1': { label: 'Stage 2 (harder edge)', engine: MODS.stage2 },
  'harsh:2': { label: 'Stage 3 (built, raw)', engine: MODS.stage3 },
  turbo: { label: 'Turbo kit (big single, no blow-off valve: it flutters)', engine: MODS.turbo },
  'turbo:1': { label: 'Big turbo (whistle and flutter)', engine: MODS.turbo },
  strip: { label: 'Stripped interior (no sound deadening)', engine: MODS.strip },
  'strip:1': { label: 'Stripped interior (no sound deadening)', engine: MODS.strip },
  'super:1': { label: 'Supercharger (a whine that follows the revs, no lag)', engine: MODS.super },
};
export const TYRE_UPGRADES = { 'tires-sport': 'sport', 'tires-drift': 'semi', 'squeal:high': 'drift' }; // the last one listed wins
// the game's hint object -> upgrade ids above
export function hintsToUpgrades(h = {}) { return Object.entries(h).filter(([k, v]) => k !== 'preset' && v != null && v !== 0 && v !== false).map(([k, v]) => k + ':' + v); }

// ---- resolve ---------------------------------------------------------------------------------------------------
const clone = (o) => JSON.parse(JSON.stringify(o));
function walk(obj, dotted, fn) {
  const ks = dotted.split('.'), last = ks.pop();
  const o = ks.reduce((a, k) => (a == null ? a : a[k]), obj);
  if (o == null || !(last in o)) return;
  o[last] = Array.isArray(o[last]) ? o[last].map(fn) : fn(o[last]);
}
export function applyMods(entry, mods) {
  if (!mods) return entry;
  for (const [k, v] of Object.entries(mods.mul || {})) walk(entry, k, (x) => x * v);
  for (const [k, v] of Object.entries(mods.add || {})) walk(entry, k, (x) => x + v);
  for (const [k, v] of Object.entries(mods.set || {})) walk(entry, k, () => v);
  return entry;
}

// model 'new' (11-18): the combustion engine's preset and the three-layer squeal; anything else: the classic synth
// model 'plus' (11-26 (3)): New's preset and parts, with New+'s layers (PLUS above, then over.plus: { engine, tyres } in
// the worklet's terms, as plusFrom() makes them) and the stick-slip tyres
export function resolveCarSound(engineId, upgrades = [], over = {}, model) {
  engineId = PRESET_ALIAS[engineId] || engineId;
  if (model === 'new') return resolveNew(engineId, upgrades, over);
  if (model === 'plus') {
    const r = resolveNew(engineId, upgrades, over), op = over.plus || {};
    r.engine.plus = merge(PLUS[r.engine.id] || {}, op.engine || {}); if (over.lite) r.engine.plus.lite = true;
    if (r.engine.plus.trim) r.engine.gain *= Math.pow(10, r.engine.plus.trim / 20); // a car's level in New+ (dB), measured against New
    r.tyres.model = 'plus'; r.tyres.plus = merge({}, op.tyres || {}); if (over.lite) r.tyres.plus.lite = true;
    return r;
  }
  const engine = clone(ENGINES[engineId] || ENGINES.six);
  engine.id = ENGINES[engineId] ? engineId : 'six';
  const ups = new Set(upgrades || []);
  for (const [id, u] of Object.entries(UPGRADE_SOUND)) if (ups.has(id)) applyMods(engine, u.engine);
  engine.muffler.bypass = Math.min(0.85, engine.muffler.bypass);
  if (over.idleRpm) engine.idleRpm = over.idleRpm;
  if (over.redlineRpm) { engine.redlineRpm = over.redlineRpm; engine.limiterRpm = over.redlineRpm + 50; }
  if (over.spool) engine.turbo.spool = over.spool;
  if (over.engine) applyMods(engine, over.engine);
  let compound = over.compound || 'street';
  for (const [id, c] of Object.entries(TYRE_UPGRADES)) if (ups.has(id)) compound = c;
  const tyres = Object.assign(clone(TYRES), { compound: clone(COMPOUNDS[compound] || COMPOUNDS.street), compoundId: compound, surfaces: clone(SURFACES) });
  if (over.tyres) applyMods(tyres, over.tyres);
  return { engine, tyres };
}

function resolveNew(engineId, upgrades, over) {
  const engine = clone(COMBUSTION[engineId] || COMBUSTION.six);
  engine.id = COMBUSTION[engineId] ? engineId : 'six';
  engine.interior = Object.assign({ exhaust: 1, intake: 0.9, block: 1.4, turbo: 0.8 }, engine.interior);
  const ups = new Set(upgrades || []), done = new Set();
  for (const [id, m] of Object.entries(UP2)) if (ups.has(id) && !done.has(m)) {
    done.add(m);
    if (MODS2[m].set && MODS2[m].set['turbo.on'] && !engine.turbo.whine) engine.turbo = Object.assign({}, TURBO_KIT, engine.turbo);
    applyMods(engine, MODS2[m]);
  }
  engine.muffler.atten = Math.min(0.99, engine.muffler.atten);
  if (over.idleRpm) engine.idleRpm = over.idleRpm;
  if (over.redlineRpm) { engine.redlineRpm = over.redlineRpm; engine.limiterRpm = over.redlineRpm + 50; }
  if (over.spool && engine.turbo.on) engine.turbo.spool = over.spool;
  if (over.lite) engine.lite = true;
  if (over.engine) applyMods(engine, over.engine);
  let compound = over.compound || 'street';
  for (const [id, c] of Object.entries(TYRE_UPGRADES)) if (ups.has(id)) compound = c;
  const tyres = Object.assign(clone(TYRES), { model: 'new', compound: clone(COMPOUNDS[compound] || COMPOUNDS.street), compoundId: compound, surfaces: clone(SURFACES) });
  if (over.tyres) applyMods(tyres, over.tyres);
  return { engine, tyres };
}
