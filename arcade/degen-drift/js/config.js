// DRIFTLINE: every tuning number in one place. The hidden debug panel (F9, or ?debug) edits these live and can copy
// the result back out as JSON; nothing else in the game hard-codes a feel number.
// Units: metres, seconds, kilograms, newtons, radians unless the name says otherwise (Deg, Kmh).
export const VERSION = '0.1.0';

export const TUNING = {
  car: {
    mass: 1250,              // kg
    wheelbase: 2.55,         // m
    frontWeight: 0.52,       // share of the weight on the front axle at rest
    cgHeight: 0.50,          // m; drives how much weight shifts under throttle and brake
    transferScale: 1.0,      // 0 = no weight transfer, 1 = physical
    halfWidth: 0.92,         // m, for the walls
    halfLength: 2.2,         // m, for the walls
    yawInertiaScale: 1.05,   // yaw inertia = mass * a * b * this
    // engine and gearbox (automatic). Drive force = power / speed, capped by maxDrive.
    powerKW: 235,
    maxDrive: 9800,          // N at the rear wheels, the low-speed cap
    topSpeedKmh: 215,        // a soft limiter
    reverseShare: 0.35,      // reverse power as a share of forward
    wheelInertia: 30,        // kg, the rear wheels' spin-up inertia as a mass at the tread (lower = they flare quicker)
    band: 0,                 // power band: 0 = flat; more = less power low in the revs (a revvy engine)
    bandLo: 0.3, bandHi: 0.75, // where the band starts and where it is all there (share of the redline)
    smokeMul: 1,             // how much smoke this car makes
    idleRpm: 950, redline: 7800, shiftUpRpm: 7200, shiftDownRpm: 3600,
    gears: [3.4, 2.2, 1.6, 1.25, 1.0, 0.82], finalDrive: 3.9, wheelRadius: 0.33,
    // brakes
    brakeForce: 13000,       // N, both axles
    brakeFront: 0.62,        // brake bias to the front
    handbrakeGrip: 0.5,     // the locked rears' sliding friction (share of their grip); it both slows and frees the tail
    // resistance
    drag: 0.42,              // N per (m/s)^2
    rolling: 14,             // N per m/s
  },
  tires: {
    muFront: 1.10, muRear: 1.02,       // peak friction
    peakFrontDeg: 7.5, peakRearDeg: 8.0, // slip angle at peak grip
    slideFront: 0.90, slideRear: 0.80,   // grip left once well past the peak (the slide)
    falloffDeg: 18,                      // how fast grip falls from peak to slide
    peakSlipRatio: 0.12,                 // rear wheelspin (share of road speed) at peak drive grip
  },
  steer: {
    maxDeg: 34,              // what the stick gives when parked
    highSpeedDeg: 7,         // what the stick gives at speed (the assist adds its own lock on top)
    highSpeedKmh: 45,        // the stick's range halves (toward highSpeedDeg) by this speed
    lockDeg: 52,             // the most the front wheels can turn, stick and assist together
    rate: 4.2,               // how fast keys move the wheel (share of full lock per s)
    returnRate: 6.0,         // how fast it centres when let go
    counterAssist: 0.62,     // 0 = none; 1 = front wheels follow the slide on their own
    counterMaxDeg: 44,       // the most lock the assist may add
  },
  assist: {
    driftHold: 0.8,          // 0 = raw tires only; 1 = the slide's angle follows the target below firmly
    holdMinDeg: 9,           // the hold wakes once the tail is this far out
    holdBaseDeg: 14,         // target angle off the throttle, steering neutral
    holdThrottleDeg: 24,     // added at full throttle
    holdSteerDeg: 14,        // added steering into the bend, taken away counter-steering
    holdK: 28,               // how hard it pulls toward the target (1/s^2)
    holdD: 5.5,              // how much it damps the swing (1/s)
    spinGuard: 0.6,          // 0 = off; the last line: pulls the nose back past guardDeg
    guardDeg: 62,
    yawDamping: 1400,        // N m per rad/s, steadies the tail
    lowSpeedKmh: 14,         // under this the car steers like a cart (no slides, no jitter)
  },
  wall: {
    restitution: 0.18,       // bounce off the wall
    scrub: 0.86,             // speed kept along the wall per hit
    wipeSpeed: 0.8,          // m/s into the wall that counts as a touch (wipes the chain)
    scrapeTime: 0.18,        // s of continuous scraping that also counts as a touch
  },
  scoring: {
    // Evrtek's ruling (11-15, via Dirigent): points only while drifting inside a corner's zone, per second, scaled
    // by speed (and angle, less); leaving a zone opens a link window; reaching the next zone still drifting links and
    // raises the multiplier; the drift ending or the window running out banks it; a wall wipes what is unbanked.
    minAngleDeg: 12,         // slide angle that counts as drifting
    minSpeedKmh: 28,
    dropGrace: 0.55,         // s a drift may fall under the angle (a flick through an S) and still be one drift
    zonePointsPerSec: 260,   // base points per second inside a zone
    sweetMult: 2.0,          // the sweet spot pays this many times the zone
    speedRefKmh: 80,         // speed where the speed factor is 1
    speedExp: 1.35,          // the more speed the better: factor = (v / ref) ^ exp
    speedFactorMax: 3.0,
    angleWeight: 0.35,       // angle is the lesser factor: 1 - weight .. 1 + weight across the range below
    angleIdealDeg: 42,
    linkWindow: 2.6,         // s to reach the next zone still drifting
    multStep: 1,             // each link adds this to the multiplier
    multCap: 6,
    wallWipe: 1.0,           // share of the unbanked points a wall takes (1 = all of it, and the multiplier)
    // the star lines live with each course (courses/*.js: stars and degenerate); the top tier's name is his word
    topTierName: 'DEGENERATE',
  },
  // Damage (Evrtek 11-15): where the car meets the wall decides what suffers. Each part's damage runs 0..1 and every
  // effect is capped small, so a battered car is a little slower, never undrivable.
  damage: {
    perHit: 0.05,            // damage per m/s of impact speed into the wall
    minHit: 1.5,             // m/s: softer touches only scuff the paint
    headOnDeg: 40,           // a wall within this angle of the nose is a head-on (engine)
    engPower: 0.15,          // most power lost at full engine damage
    engTop: 0.08,            // most top speed lost
    frontGrip: 0.12,         // front corners' damage: front grip lost (both corners averaged)
    steerPullDeg: 1.6,       // and the most the wheel pulls toward the worse corner
    rearGrip: 0.10,          // rear corners' damage: rear grip lost
    smokeAt: 0.55,           // engine damage that starts the bonnet smoking
  },
  // Economy (Evrtek 11-15): a few decent runs keep up with repairs and buy a small upgrade; the big parts take a
  // proper grind and are on show from the start. Credits are earned by play only; nothing is ever sold.
  economy: {
    entryPay: 420,           // every finished run pays this, however it went (times the course's pay factor)
    perPoint: 0.05,          // credits per point scored
    starPay: [0, 350, 770, 1260], // by stars earned (0..3)
    degeneratePay: 2200,     // on top, for a Degenerate run
    firstClearPay: 1000,     // the first time a course is finished
    firstStarPay: 400,       // per star, the first time each star is earned on a course
    firstDegeneratePay: 3000, // the first Degenerate on a course
    payPerDifficulty: 0.008, // harder courses pay more: factor = 1 + difficulty x this (day 3: set against the 15 courses)
    repair: { engine: 2200, front: 900, rear: 800, body: 500 }, // full repair of one part from 1.0 damage
    repairCap: 1800,         // a full repair never costs more than this
    patchShare: 0.3,         // a patch-up costs this share of the full repair...
    patchFix: 0.6,           // ...and takes this share off every part's damage
    startCredits: 500,
  },
  nos: {
    seconds: 3.5,            // a full bottle
    power: 0.45,             // extra power while it flows
    fillPerSec: 0.07,        // share of the bottle refilled per second of drifting inside a zone
    sweetBonus: 1.6,         // faster in the sweet spot
  },
  turbo: { spool: 0.6 },     // seconds for the boost to build
  // the automatic (car.js gearbox, 11-17): it reads the road speed, not the spinning wheels, and waits between shifts
  gearbox: {
    shiftCut: 0.22,          // seconds of no drive on an upshift (the short shifter trims it)
    smooth: 0.25,            // s: how quickly the road speed it reads follows the real one
    minGap: 0.8,             // s: never two shifts closer than this
    reverseGap: 1.5,         // s: never the other way this soon after a shift (no up-down-up)
    bogShare: 0.36,          // on the gas (or in a slide) it changes down only under this share of the redline
    onThrottle: 0.3,         // throttle past this counts as on the gas
    slideDeg: 14,            // a slide past this holds the gear
    overRev: 0.985,          // share of the redline the engine must sit on (a moment) before a slide changes up
  },
  camera: {
    distance: 6.4, height: 2.15, lookHeight: 0.95, lookAhead: 4.0,
    velocityBlend: 0.62,     // 0 = sits behind the nose, 1 = sits behind the direction of travel
    stiffness: 9.5,          // follow spring
    yawStiffness: 5.5,
    fov: 62, fovKick: 13,    // degrees added at top speed
    shake: 0.045,            // at full slide and speed
    hitShake: 0.35,
  },
  fx: {
    smokeSlip: 0.28,         // tire slip that starts smoke
    smokeRate: 70,           // puffs per second per wheel at full slip
    skidSlip: 0.22,          // tire slip that starts a skid mark
  },
};

// Where game sound goes (Dirigent 11-15): a second builder is making audio/driftaudio.js (ElevenLabs takes). Until it
// lands this stays false and the synthesized placeholder plays; flip it to true in the commit that adds the module.
export const SOUND = { driftaudio: true, module: '../audio/driftaudio.js' };

// Ranges for the debug panel: [min, max, step]. Anything not listed gets a range around its own value.
export const RANGES = {
  'car.mass': [800, 2000, 10], 'car.frontWeight': [0.4, 0.62, 0.01], 'car.cgHeight': [0.2, 0.9, 0.01],
  'car.transferScale': [0, 2, 0.05], 'car.powerKW': [80, 500, 5], 'car.maxDrive': [3000, 16000, 100],
  'car.handbrakeGrip': [0.1, 1, 0.01], 'car.topSpeedKmh': [100, 300, 5],
  'tires.muFront': [0.6, 1.6, 0.01], 'tires.muRear': [0.6, 1.6, 0.01], 'tires.slideFront': [0.4, 1, 0.01],
  'tires.slideRear': [0.4, 1, 0.01], 'tires.peakSlipRatio': [0.03, 0.4, 0.01], 'car.wheelInertia': [5, 200, 1],
  'steer.counterAssist': [0, 1, 0.01], 'steer.maxDeg': [15, 50, 1], 'steer.highSpeedDeg': [2, 20, 0.5], 'steer.highSpeedKmh': [10, 150, 1], 'steer.lockDeg': [25, 65, 1], 'steer.counterMaxDeg': [0, 60, 1],
  'assist.spinGuard': [0, 2, 0.01], 'assist.guardDeg': [30, 90, 1], 'assist.driftHold': [0, 1.5, 0.01],
  'assist.holdMinDeg': [3, 25, 0.5], 'assist.holdBaseDeg': [0, 40, 0.5], 'assist.holdThrottleDeg': [0, 50, 0.5], 'assist.holdSteerDeg': [0, 40, 0.5],
  'assist.holdK': [0, 80, 0.5], 'assist.holdD': [0, 20, 0.1], 'assist.yawDamping': [0, 4000, 50],
  'wall.restitution': [0, 0.8, 0.01], 'wall.scrub': [0.5, 1, 0.01],
  'scoring.sweetMult': [1, 4, 0.1], 'scoring.speedExp': [0, 3, 0.05], 'scoring.angleWeight': [0, 1, 0.01],
  'scoring.linkWindow': [0.5, 6, 0.1], 'scoring.multStep': [0.25, 2, 0.25], 'scoring.multCap': [1, 12, 1],
  'scoring.wallWipe': [0, 1, 0.05],
  'camera.velocityBlend': [0, 1, 0.01], 'camera.fov': [40, 90, 1], 'camera.fovKick': [0, 30, 1],
};

// A copy of the shipped numbers, so the panel can put them back.
export const DEFAULTS = JSON.parse(JSON.stringify(TUNING));

export function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
export function setPath(obj, path, v) { const ks = path.split('.'); const last = ks.pop(); const o = ks.reduce((a, k) => a[k], obj); o[last] = v; }
// Copy saved overrides onto TUNING, only for keys that exist and only numbers (or the tier name).
export function applyOverrides(over) {
  if (!over || typeof over !== 'object') return;
  for (const [path, v] of Object.entries(over)) {
    const cur = getPath(TUNING, path);
    if (typeof cur === 'number' && typeof v === 'number' && isFinite(v)) setPath(TUNING, path, v);
  }
}
export function diffFromDefaults() {
  const out = {};
  const walk = (a, b, pre) => { for (const k of Object.keys(a)) { const p = pre ? pre + '.' + k : k; if (typeof a[k] === 'object' && !Array.isArray(a[k])) walk(a[k], b[k], p); else if (typeof a[k] === 'number' && a[k] !== b[k]) out[p] = a[k]; } };
  walk(TUNING, DEFAULTS, '');
  return out;
}
