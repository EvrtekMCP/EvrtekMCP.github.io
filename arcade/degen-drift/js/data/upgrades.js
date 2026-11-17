// DRIFTLINE: the upgrade tree, as data (Dirigent's plan, projects/driftline-design.md). Every level changes something
// you can feel, hear or see. A car fits as many levels of each category as its `levels` says (data/cars.js); prices
// are the KESTREL's and scale with the car's partScale. Prices are in credits; a decent run pays about 1,300.
//   fx keys (garage.js deriveTune): power (share), top (km/h), mass (kg), muFront, muRear, slideRear, brake (share),
//   handbrakeGrip, lockDeg, counterMaxDeg, cgHeight (m), transferScale, driftHold, holdThrottleDeg, peakSlipRatio,
//   shiftCut (s), nosSeconds (s), boost (share, arrives with the turbo's spool). sound: hints for the sound module.
//   band (per category, or per level where it differs): cheap 1-3 decent runs, mid 4-8, big 15-30 (the plan's bands).
export const CATEGORIES = [
  { id: 'tires', name: 'Tires', art: 'tire', band: 'cheap', levels: [
    { name: 'Sport tires', price: 1800, blurb: 'More bite at both ends.', fx: { muFront: 0.04, muRear: 0.03 } },
    { name: 'Semi-slicks', price: 3400, blurb: 'Grip to lean on; the slide comes later and cleaner.', fx: { muFront: 0.04, muRear: 0.02 } },
    { name: 'Drift-spec', price: 5200, blurb: 'Sticky fronts, a predictable, smoky rear.', fx: { muFront: 0.03, muRear: -0.02, slideRear: 0.04 }, sound: { squeal: 'high' } },
    { name: 'Competition', price: 9000, blurb: 'The best rubber money can buy (with race money).', fx: { muFront: 0.04, muRear: 0.03 } },
  ] },
  { id: 'brakes', name: 'Brakes', art: 'brake', band: 'cheap', levels: [
    { name: 'Sport pads', price: 1200, blurb: 'Stop later, steer in sooner.', fx: { brake: 0.12 } },
    { name: 'Big brake kit', price: 2800, blurb: 'Bigger discs, four-pot calipers.', fx: { brake: 0.12 } },
    { name: 'Hydraulic handbrake', price: 4200, blurb: 'A sharper pull: the tail comes round on cue.', fx: { handbrakeGrip: -0.08 } },
  ] },
  { id: 'suspension', name: 'Suspension', art: 'coilover', band: 'mid', levels: [
    { name: 'Coilovers', price: 4800, blurb: 'Lower and stiffer: less roll, sharper response.', fx: { cgHeight: -0.05, transferScale: -0.12, muFront: 0.02 } },
    { name: 'Adjustable coilovers', price: 8200, blurb: 'Lower again, and the setup sliders unlock: tune the car to your style.', fx: { cgHeight: -0.03, muFront: 0.01 } },
  ] },
  { id: 'diff', name: 'Differential', art: 'diff', band: 'mid', levels: [
    { name: '1.5-way LSD', price: 4200, blurb: 'Both rears push together: slides start readily and hold.', fx: { driftHold: 0.08, peakSlipRatio: -0.015 } },
    { name: '2-way LSD', price: 7600, blurb: 'Locked on and off the throttle: steady, deep angles.', fx: { driftHold: 0.08, holdThrottleDeg: 3 } },
  ] },
  { id: 'angle', name: 'Angle kit', art: 'knuckle', band: 'mid', levels: [
    { name: 'Angle kit', price: 4400, blurb: 'More lock: hold deeper angles, catch more slides.', fx: { lockDeg: 6, counterMaxDeg: 6 } },
    { name: 'Pro angle kit', price: 8800, blurb: 'Even more lock and a quicker catch.', fx: { lockDeg: 5, counterMaxDeg: 5 } },
    { name: 'Super lock', price: 15000, blurb: 'Lock like a competition car.', fx: { lockDeg: 5, counterMaxDeg: 5 } },
  ] },
  { id: 'weight', name: 'Weight', art: 'seat', band: 'mid', levels: [
    { name: 'Bucket seats', price: 1600, blurb: '35 kg lighter.', fx: { mass: -35 } },
    { name: 'Stripped interior', price: 4400, blurb: 'Carpet and trim gone: 50 kg more.', fx: { mass: -50 } },
    { name: 'Carbon panels', price: 11000, blurb: 'Bonnet, boot and doors in carbon: 60 kg more.', fx: { mass: -60 } },
  ] },
  { id: 'exhaust', name: 'Exhaust', art: 'exhaust', band: 'cheap', levels: [
    { name: 'Cat-back exhaust', price: 1500, blurb: 'A little power and a lot more voice.', fx: { power: 0.03 }, sound: { exhaust: 1 } },
    { name: 'Straight pipe', price: 4200, blurb: 'Crackles on the lift. Neighbours hate it.', fx: { power: 0.04 }, sound: { exhaust: 2 } },
  ] },
  { id: 'transmission', name: 'Transmission', art: 'shifter', band: 'mid', levels: [
    { name: 'Short shifter', price: 1400, blurb: 'Quicker changes: less of a lull between gears.', fx: { shiftCut: -0.12 } },
    { name: 'Close-ratio box', price: 6800, blurb: 'Stays in the power band through the corners.', fx: { shiftCut: -0.04, power: 0.03 } },
  ] },
  { id: 'engine', name: 'Engine', art: 'engine', band: 'big', levels: [
    { name: 'Stage 1', price: 9000, band: 'mid', blurb: 'Intake, exhaust manifold and a tune: +12% power.', fx: { power: 0.12 } },
    { name: 'Stage 2', price: 19000, blurb: 'Cams, pistons, a bigger throttle body: +14% more.', fx: { power: 0.14, top: 6 }, sound: { harsh: 1 } },
    { name: 'Stage 3', price: 30000, blurb: 'Built bottom end and a race tune: +16% more.', fx: { power: 0.16, top: 6 }, sound: { harsh: 2 } },
  ] },
  { id: 'induction', name: 'Forced induction', art: 'turbo', band: 'big', levels: [
    { name: 'Big turbo', price: 32000, blurb: '+25% once it spools. You will hear it breathe.', fx: { boost: 0.25, top: 10 }, sound: { turbo: 1 } },
  ] },
  { id: 'nos', name: 'Nitrous', art: 'nos', band: 'big', levels: [
    { name: 'Nitrous: small bottle', price: 24000, blurb: 'Drift in the zones to fill the gauge; hit it for a surge.', fx: { nosSeconds: 2.5 } },
    { name: 'Nitrous: twin bottles', price: 36000, blurb: 'Twice the bottle, twice the fun.', fx: { nosSeconds: 2.0 } },
  ] },
];

// Looks only: buy an option once, then pick it freely. The first option of each is the stock one (free).
export const COSMETICS = [
  { id: 'paint', name: 'Paint', art: 'paint', options: [
    { id: 'stock', name: 'Stock', price: 0, value: null },
    { id: 'coral', name: 'Sunset Coral', price: 700, value: '#ff6a5a' },
    { id: 'violet', name: 'Ultraviolet', price: 700, value: '#8a5cff' },
    { id: 'lime', name: 'Acid Lime', price: 700, value: '#b6ff3a' },
    { id: 'pearl', name: 'Pearl White', price: 900, value: '#eef2f6' },
    { id: 'midnight', name: 'Midnight', price: 900, value: '#1c2440' },
  ] },
  { id: 'rims', name: 'Rims', art: 'rim', options: [
    { id: 'spoke', name: 'Stock', price: 0, value: 'spoke' }, // each car's own rims (Portero 002: five, six, fifteen spokes or turbine)
    { id: 'mesh', name: 'Gold mesh', price: 1100, value: 'mesh' },
    { id: 'dish', name: 'Deep dish', price: 1300, value: 'dish' },
  ] },
  { id: 'smoke', name: 'Tire smoke', art: 'smoke', options: [
    { id: 'white', name: 'White', price: 0, value: '#e8e4ee' },
    { id: 'pink', name: 'Hot pink', price: 900, value: '#ff5fb4' },
    { id: 'cyan', name: 'Ice blue', price: 900, value: '#5fe8ff' },
    { id: 'violet', name: 'Violet', price: 900, value: '#a77bff' },
  ] },
  { id: 'decal', name: 'Decals', art: 'decal', options: [
    { id: 'none', name: 'None', price: 0, value: null },
    { id: 'stripes', name: 'Twin stripes', price: 1000, value: 'stripes' },
    { id: 'spear', name: 'Side spear', price: 800, value: 'spear' },
  ] },
  { id: 'glow', name: 'Underglow', art: 'glow', options: [
    { id: 'none', name: 'None', price: 0, value: null },
    { id: 'cyan', name: 'Cyan', price: 1200, value: '#36f2ff' },
    { id: 'pink', name: 'Pink', price: 1200, value: '#ff3fa4' },
  ] },
];
// The setup sheet (unlocked by adjustable coilovers): five sliders, each -1..1, kept per car. What each one does is in
// garage.js deriveTune.
export const SETUP = [
  { id: 'balance', name: 'Grip balance', lo: 'Grippy rear', hi: 'Loose rear', blurb: 'Moves grip between the axles: a looser rear slides sooner.' },
  { id: 'assist', name: 'Slide help', lo: 'Raw', hi: 'Held', blurb: 'How firmly the car holds the angle you ask for.' },
  { id: 'lock', name: 'Steering lock', lo: 'Less', hi: 'More', blurb: 'Front-wheel lock: more catches deeper slides.' },
  { id: 'bias', name: 'Brake bias', lo: 'Rear', hi: 'Front', blurb: 'Rear bias rotates the car on the brakes.' },
  { id: 'gearing', name: 'Gearing', lo: 'Long', hi: 'Short', blurb: 'Short gears pull harder and top out sooner.' },
];
export const category = (id) => CATEGORIES.find((c) => c.id === id);
export const cosmetic = (id) => COSMETICS.find((c) => c.id === id);
