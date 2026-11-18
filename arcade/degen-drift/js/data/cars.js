// DRIFTLINE (DEGEN DRIFT): the cars, as data (Dirigent's plan, projects/driftline-design.md: six fictional cars, bought
// with race money and kept). Each overrides the base physics in config.js TUNING, names its body (carbodies.js), its
// engine-sound preset, and how many levels of each upgrade category it can take (better cars, more levels).
//   tune: partial TUNING (car / tires / steer / assist) merged over the base. car.band shapes the power with the revs
//         (0 = flat; higher = little below bandLo of the redline, all of it by bandHi: a revvy engine)
//   levels: category id -> how many levels this car can fit (data/upgrades.js); cosmetics: how many options
//   induction: what its forced-induction level is (a turbo spools; a supercharger is there at once and whines)
//   rating: [stock, fully built] ability rating; price: credits (about `runs` decent runs on the courses of the band
//   before it: day 3, set against the fifteen courses by tools/economy.mjs)
export const CARS = [
  {
    id: 'kestrel', name: 'KESTREL', cls: 'Street', engine: 'Turbo four', sound: 'turbo4', price: 0, runs: 0, playable: true,
    blurb: 'Light, forgiving and happy sideways. Everyone starts here.',
    feel: 'Forgiving: the slide holds itself, the tail asks before it goes.',
    rating: [20, 55], partScale: 1.0, paint: '#68147f', // deep metallic violet (Portero's key art and 002 sheet)
    induction: { kind: 'turbo', name: 'Big turbo' },
    tune: {
      car: { mass: 1180, powerKW: 182, maxDrive: 8600, topSpeedKmh: 200, redline: 7600, shiftUpRpm: 7100, shiftDownRpm: 3500, turbo: true, wheelbase: 2.56, frontWeight: 0.53 },
      tires: { muFront: 1.08, muRear: 1.0 },
      steer: { counterAssist: 0.66 },
      assist: { driftHold: 0.88, holdD: 6.0 },
    },
    levels: { tires: 3, brakes: 2, suspension: 2, diff: 1, angle: 1, weight: 2, exhaust: 2, transmission: 1, engine: 2, induction: 1, nos: 1, paint: 6, rims: 3, smoke: 4, glow: 3, decal: 3 },
  },
  {
    id: 'vanta', name: 'VANTA', cls: 'Street', engine: 'Straight six', sound: 'i6', price: 12000, runs: 10, playable: true,
    blurb: 'Smooth and balanced, with a six that sings to the redline.',
    feel: 'Balanced: steady in a long slide, honest when it lets go.',
    rating: [30, 65], partScale: 1.1, paint: '#1b2b57', // midnight navy (Portero's 002 sheet)
    induction: { kind: 'turbo', name: 'Turbo kit' },
    tune: {
      car: { mass: 1290, powerKW: 228, maxDrive: 9400, topSpeedKmh: 212, redline: 7400, shiftUpRpm: 7000, shiftDownRpm: 3600, wheelbase: 2.7, frontWeight: 0.52, band: 0.12 },
      tires: { muFront: 1.09, muRear: 1.02 },
      steer: { counterAssist: 0.6 },
      assist: { driftHold: 0.78, holdD: 6.5 },
    },
    levels: { tires: 3, brakes: 2, suspension: 2, diff: 2, angle: 2, weight: 2, exhaust: 2, transmission: 1, engine: 2, induction: 1, nos: 1, paint: 6, rims: 3, smoke: 4, glow: 3, decal: 3 },
  },
  {
    id: 'halberd', name: 'HALBERD', cls: 'Sport', engine: 'V8', sound: 'v8', price: 29000, runs: 22, playable: true,
    blurb: 'Heavy, torquey, and it makes clouds. Big smoky slides.',
    feel: 'Heavy and torquey: lazy to turn in, then a huge, smoky slide on the throttle.',
    rating: [42, 78], partScale: 1.25, paint: '#8c0c18', // candy red (Portero's 002 sheet)
    induction: { kind: 'super', name: 'Supercharger' },
    tune: {
      car: { mass: 1480, powerKW: 300, maxDrive: 12500, topSpeedKmh: 225, redline: 6600, shiftUpRpm: 6200, shiftDownRpm: 3000, wheelbase: 2.8, frontWeight: 0.55, yawInertiaScale: 1.18, cgHeight: 0.54, smokeMul: 1.5 },
      tires: { muFront: 1.1, muRear: 1.0, slideRear: 0.74 },
      steer: { counterAssist: 0.6 },
      assist: { driftHold: 0.8, holdBaseDeg: 16, holdThrottleDeg: 30, holdK: 22 },
    },
    levels: { tires: 4, brakes: 3, suspension: 2, diff: 2, angle: 2, weight: 3, exhaust: 2, transmission: 2, engine: 3, induction: 1, nos: 2, paint: 6, rims: 3, smoke: 4, glow: 3, decal: 3 },
  },
  {
    id: 'orbit', name: 'ORBIT', cls: 'Sport', engine: 'Rotary', sound: 'rotary', price: 42000, runs: 30, playable: true,
    blurb: 'Revs forever, weighs nothing, and bites if you are lazy.',
    feel: 'Revvy and twitchy: keep it high in the revs, and catch it early.',
    rating: [48, 82], partScale: 1.35, paint: '#aabc16', // acid lime (Portero's 002 sheet)
    induction: { kind: 'turbo', name: 'Turbo kit' },
    tune: {
      // shiftDownRpm 5200 -> 4700 (11-17): first to second is the box's biggest step (x1.55), and at 5200 a change
      // up landed only 7% over the change-down point, a change down 7% under the change-up; now 18% and 16%
      car: { mass: 1210, powerKW: 265, maxDrive: 8800, topSpeedKmh: 228, redline: 9000, shiftUpRpm: 8600, shiftDownRpm: 4700, wheelbase: 2.43, frontWeight: 0.5, yawInertiaScale: 0.86, band: 0.45, bandLo: 0.45, bandHi: 0.85 },
      tires: { muFront: 1.12, muRear: 1.02 },
      steer: { counterAssist: 0.55, rate: 5.2 },
      assist: { driftHold: 0.62, holdD: 3.8, holdK: 34 },
    },
    levels: { tires: 4, brakes: 3, suspension: 2, diff: 2, angle: 3, weight: 3, exhaust: 2, transmission: 2, engine: 3, induction: 1, nos: 2, paint: 6, rims: 3, smoke: 4, glow: 3, decal: 3 },
  },
  {
    id: 'spectre', name: 'SPECTRE', cls: 'Pro', engine: 'Twin-turbo V6', sound: 'v6tt', price: 77000, runs: 48, playable: true,
    blurb: 'Wide, fast and demanding. It rewards precision.',
    feel: 'Fast and demanding: huge grip, then it snaps; less help to catch it.',
    rating: [62, 92], partScale: 1.5, paint: '#e6e9ef', // white under the magenta and cyan livery (Portero's 002 sheet)
    induction: { kind: 'turbo', name: 'Hybrid turbos' },
    tune: {
      car: { mass: 1420, powerKW: 360, maxDrive: 12500, topSpeedKmh: 245, redline: 7600, shiftUpRpm: 7200, turbo: true, wheelbase: 2.72, frontWeight: 0.53 },
      tires: { muFront: 1.15, muRear: 1.07, peakSlipRatio: 0.1, slideRear: 0.78 },
      steer: { counterAssist: 0.5 },
      assist: { driftHold: 0.58, spinGuard: 0.4, holdD: 4.5 },
    },
    levels: { tires: 4, brakes: 3, suspension: 2, diff: 2, angle: 3, weight: 3, exhaust: 2, transmission: 2, engine: 3, induction: 1, nos: 2, paint: 6, rims: 3, smoke: 4, glow: 3, decal: 3 },
  },
  {
    id: 'zenith', name: 'ZENITH', cls: 'Pro', engine: 'Flat six', sound: 'flat6', price: 129000, runs: 75, playable: true,
    blurb: 'The end of the road: a screaming flat-six and a chassis that does anything you ask.',
    feel: 'The endgame: the engine behind you, enormous traction, any angle you ask for.',
    rating: [74, 100], partScale: 2.0, paint: '#303136', // gunmetal (Portero's 002 sheet)
    induction: { kind: 'super', name: 'Supercharger' },
    tune: {
      car: { mass: 1330, powerKW: 390, maxDrive: 12800, topSpeedKmh: 255, redline: 9200, shiftUpRpm: 8800, shiftDownRpm: 5000, wheelbase: 2.45, frontWeight: 0.42, yawInertiaScale: 0.95, band: 0.25 },
      tires: { muFront: 1.16, muRear: 1.1 },
      steer: { counterAssist: 0.6, lockDeg: 56 },
      assist: { driftHold: 0.72, holdD: 5.5 },
    },
    levels: { tires: 4, brakes: 3, suspension: 2, diff: 2, angle: 3, weight: 3, exhaust: 2, transmission: 2, engine: 3, induction: 1, nos: 2, paint: 6, rims: 3, smoke: 4, glow: 3, decal: 3 },
  },
];
export const carById = (id) => CARS.find((c) => c.id === id) || CARS[0];
