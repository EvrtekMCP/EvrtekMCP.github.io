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

export function resolveCarSound(engineId, upgrades = [], over = {}) {
  engineId = PRESET_ALIAS[engineId] || engineId;
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
