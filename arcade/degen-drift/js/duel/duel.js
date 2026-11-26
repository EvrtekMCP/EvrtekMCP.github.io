// DEGEN DRIFT: the downhill duels (day 4), the rules as pure JS (the game and tools/duels.mjs share them).
// Evrtek: "opponent races like a downhill duel ... where your objective isn't to link drifts but to out drift the
// opponent for position and make it to the end of the course faster."
//   - Two legs on a duel course: in leg 1 you start in front, in leg 2 you chase. The two legs' totals decide.
//   - A leg's score is your drift against the rival's (zone points, the scoring's own rate, no chains) plus the gap at
//     the line (seconds, both ways) less the price of any contact you cause. No ramming wins.
//   - Outright: pull a clear lead (the course's margin, held a second) and the duel is yours there and then; let the
//     rival get a quarter more than that away and it is theirs.
//   - Sudden death (day 5): two legs that end within RULES.tie of each other go to a third leg, led by whoever is
//     behind on points; that leg alone decides.
//   - The rival is a car like yours (same physics, its own tune and parts) driven by rival.js: real lines, drifts in
//     the zones, and the odd mistake you can pounce on. It never gets help from the physics.
import { TUNING } from '../config.js?v=0.1.21';
import { Steps } from '../scoring.js?v=0.1.21';
import * as G from '../garage.js?v=0.1.21';
import { CATEGORIES } from '../data/upgrades.js?v=0.1.21';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEG = 180 / Math.PI;

// who you race on each duel course (cars from data/cars.js, matched to the course's band) and how they drive. Day 5
// balance (tools/duels.mjs, 48 duels a skill): every pace 1.0 (a rival's strength is its car and how often it gets a
// zone wrong; pace above 1 only overdrives, and since the hairpin floor was fixed it made TIMBER a second a leg
// quicker than anyone); won by a weak / decent / good / strong stand-in, out of 48: DUST DEVIL 9/18/36/47, CEDAR
// 2/8/19/26, CLOUDBREAK 7/11/15/20. 11-18: the drift lines moved to the outside and both drivers got eyes for the wall
// (rival.js), which made SIDEWINDER and HALO harder (out of 40: DUST DEVIL 8/22/25/39 -> 5/12/23/38, CLOUDBREAK
// 6/15/12/14 -> 3/7/10/8); a few more mistakes each (0.16 -> 0.22, 0.10 -> 0.15) give 10/14/25/35 and 7/12/15/18
export const DUELS = {
  'dust-devil': { rival: 'vanta', who: 'SIDEWINDER', paint: '#c03c7c', parts: 0.3, pace: 1.0, angle: 33, mistakes: 0.22, outright: 5.0,
    line: 'Smooth and a touch cautious. Pressure him into the cutbacks.' },
  'cedar-switchbacks': { rival: 'halberd', who: 'TIMBER', paint: '#2f8a6a', parts: 0.4, pace: 1.0, angle: 35, mistakes: 0.12, outright: 4.5,
    line: 'Big smoky slides in a heavy V8. Late on the brakes, slow out of the hairpins.' },
  'cloudbreak-crown': { rival: 'zenith', who: 'HALO', paint: '#e6e2f2', parts: 0.9, pace: 1.0, angle: 36, mistakes: 0.15, outright: 4.2,
    line: 'The fastest driver on the mountain. Rarely wrong; when she is, take it.' },
};
export const RULES = {
  gapPts: 1000,      // a second of gap at the line is worth this many drift points
  contactPts: 900,   // what a contact you cause costs
  lossMargin: 1.25,  // the rival needs this many times the course's margin to win outright
  warmup: 16,        // seconds before an outright lead can count (both cars up to speed, the first corners done)
  hold: 1.0,         // seconds a clear lead must be held
  giveUp: 20,        // seconds after the rival finishes before the leg ends anyway
  // day 5: a touch is one incident until the cars have been apart this long (or it has gone on rubMax seconds), and it
  // costs you only if you drove into the rival at hitSpeed or more; a slow lean side by side is a rub and costs nothing
  hitSpeed: 2.0, apart: 0.6, rubMax: 2.5,
  tie: 400,          // two legs closer than this (under half a second of gap) go to a sudden-death third leg
  // 11-18: a run's hold and switchback steps in the drift meter too (DriftMeter). Built and measured, OFF until Evrtek
  // rules: on, the weakest stand-in won DUST DEVIL 29 duels in 40 (the stand-in's KESTREL holds the sweet spot longer
  // than SIDEWINDER's VANTA at every skill, so the steps paid the car, not the driver; the rivals would want retuning
  // with it). Off, the meter is what it was: zone points at the scoring's rate, no chains, no multiplier.
  steps: false,
};

// your drift in the zones, by the scoring's own rate (no chains: this is drift quality). 11-18 (Evrtek's multiplier),
// with RULES.steps on (off until he rules): the same hold and switchback steps a run's chain takes (js/scoring.js
// Steps) raise each drift's own multiplier, which pays on the points scored after it; no links (a duel was never about
// linking zones). The drift ending, or a wall touch, puts it back to x1. Both cars are measured the same way, live, so
// the bars only ever grow. `base` is the points without it, for the tools.
export class DriftMeter {
  constructor(track) { this.track = track; this.steps = new Steps(); this.reset(); }
  reset() { this.pts = 0; this.base = 0; this.zoneTime = 0; this.sweetTime = 0; this.holds = 0; this.switches = 0; this.maxMult = 1; this.drift = false; this.dropT = 0; this.touch = false; this.end(); }
  end() { this.mult = 1; this.live = false; this.steps.reset(); }
  step(car, dt) {
    const Sc = TUNING.scoring, tr = this.track, ang = Math.abs(car.beta) * DEG, kmh = car.speed * 3.6;
    if (car.touchFired && !this.touch) this.end(); // the touch that wipes a run's chain (11-19: a hit; a graze never sets it)
    this.touch = car.touchFired;
    const sliding = ang >= Sc.minAngleDeg && kmh >= Sc.minSpeedKmh && car.u > 0;
    if (sliding) { this.dropT = 0; this.drift = true; } else if (this.drift && (this.dropT += dt) > Sc.dropGrace) { this.drift = false; this.end(); }
    let r = 0, sweet = false;
    const zn = sliding ? tr.zoneAt(car.s) : null;
    if (zn) {
      const t = tr.zoneT(zn, car.s), off = car.lat - tr.zoneLine(zn, t, tr.halfAt(car.trackI, 0));
      if (Math.abs(off) <= zn.zoneHalf) {
        sweet = Math.abs(off) <= zn.sweetHalf;
        const sf = clamp(Math.pow(kmh / Sc.speedRefKmh, Sc.speedExp), 0, Sc.speedFactorMax);
        const af = 1 - Sc.angleWeight + 2 * Sc.angleWeight * clamp((ang - Sc.minAngleDeg) / (Sc.angleIdealDeg - Sc.minAngleDeg), 0, 1);
        const base = Sc.zonePointsPerSec * sf * af * (sweet ? Sc.sweetMult : 1);
        r = base * this.mult;
        this.pts += r * dt; this.base += base * dt; this.zoneTime += dt; if (sweet) this.sweetTime += dt; this.live = true;
      }
    }
    const st = this.steps;
    st.tick(dt, car, sliding, sweet);
    if (RULES.steps && this.live && (st.hold || st.swap)) {
      if (st.hold) { this.holds++; this.mult += Sc.holdStep; }
      if (st.swap) { this.switches++; this.mult += Sc.switchStep; }
      this.mult = Math.min(Sc.multCap, this.mult); this.maxMult = Math.max(this.maxMult, this.mult);
    }
    return r;
  }
}

// two cars touching: each as two circles along its length; push apart, trade the closing speed (a soft knock), and
// say who drove into whom. Returns null or { fault: 'player' | 'rival', speed }.
const C = [1.25, -1.25], R = 1.02;
export function contact(a, b) {
  let best = null;
  for (const ca of C) for (const cb of C) {
    const ax = a.x + Math.sin(a.psi) * ca, az = a.z + Math.cos(a.psi) * ca, bx = b.x + Math.sin(b.psi) * cb, bz = b.z + Math.cos(b.psi) * cb;
    const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz);
    if (d < 2 * R && (!best || d < best.d)) best = { d, nx: dx / (d || 1), nz: dz / (d || 1) };
  }
  if (!best) return null;
  const { d, nx, nz } = best, push = (2 * R - d) / 2 + 0.01;
  a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
  // closing speeds along the normal: who was moving into whom
  const va = a.vx * nx + a.vz * nz, vb = -(b.vx * nx + b.vz * nz), closing = va + vb;
  if (closing > 0) {
    const j = closing * 0.6; // equal masses, restitution 0.2: each gives up most of its closing speed
    a.vx -= nx * j; a.vz -= nz * j; b.vx += nx * j; b.vz += nz * j;
    a.r *= 0.7; b.r *= 0.7;
  }
  return { fault: va >= vb ? 'a' : 'b', speed: Math.max(0, closing) };
}

// One leg. The game (or the simulator) steps the player's car itself; the leg steps the rival, watches both, and keeps
// the score. Distances are along the road from the duel's start line; the finish is one lap on from the front slot.
export class Leg {
  constructor(track, course, player, rival, driver, playerLeads) {
    const G = course.duel.grid, front = G[0][0], back = G[1][0];
    this.track = track; this.cfg = DUELS[course.id]; this.player = player; this.rival = rival; this.driver = driver;
    this.playerLeads = playerLeads;
    this.pStart = playerLeads ? front : back; this.rStart = playerLeads ? back : front;
    this.finishAt = front + track.length;
    this.pMeter = new DriftMeter(track); this.rMeter = new DriftMeter(track);
    this.pDist = this.pStart; this.rDist = this.rStart; this.pPrevS = null; this.rPrevS = null;
    this.t = 0; this.rFinishT = null; this.pFinishT = null; this.contacts = 0; this.bumps = 0; this.rubs = 0; this.touch = null;
    this.leadT = 0; this.outright = null; this.done = false; this.events = []; this.passes = 0; this.wasAhead = playerLeads;
  }
  // the grid slots: [s, lateral] for the player and the rival
  slots(course) { const G = course.duel.grid; return this.playerLeads ? { player: G[0], rival: G[1] } : { player: G[1], rival: G[0] }; }
  // metres the player is ahead (negative: behind)
  lead() { return this.pDist - this.rDist; }
  // the lead as time, measured at the trailing car's speed
  gapSec() { const L = this.lead(), v = Math.max(8, L >= 0 ? this.rival.speed : this.player.speed); return L / v; }
  // a fixed step of the race (1/120 s), after the player's car has stepped
  step(dt, racing = true) {
    if (this.done) return;
    const tr = this.track;
    if (racing) {
      const inp = this.driver.drive(this.rival, dt, this.player);
      this.rival.step(dt, inp);
      for (const e of this.rival.events) if (e.type === 'shift') this.events.push({ type: 'rshift', up: e.up, cut: e.cut }); // for its voice
      this.rival.events.length = 0;
      this.t += dt;
    }
    // distance along the road for both (the sum of small steps, so a lap counts)
    if (this.pPrevS !== null) this.pDist += tr.ds(this.pPrevS, this.player.s); this.pPrevS = this.player.s;
    if (this.rPrevS !== null) this.rDist += tr.ds(this.rPrevS, this.rival.s); this.rPrevS = this.rival.s;
    if (!racing) return;
    if (this.pFinishT === null) this.pMeter.step(this.player, dt);
    if (this.rFinishT === null) this.rMeter.step(this.rival, dt);
    if (this.rFinishT === null && this.rDist >= this.finishAt) { this.rFinishT = this.t; this.events.push({ type: 'rivalFinished' }); }
    // contact: the one who drove in pays (only the player can pay; the rival's knock just costs it speed). One incident
    // per touch, so leaning on each other through a corner is one rub, not a penalty every second
    const c = contact(this.player, this.rival);
    if (c) {
      if (this.touch && this.t - this.touch.t0 > RULES.rubMax) this.touch = null;
      if (!this.touch) { this.touch = { t0: this.t, hit: false, bump: false }; this.rubs++; this.events.push({ type: 'rub', speed: c.speed }); }
      this.touch.t = this.t;
      if (c.speed >= RULES.hitSpeed) {
        if (c.fault === 'a' && !this.touch.hit) { this.touch.hit = true; this.contacts++; this.events.push({ type: 'contact', fault: 'player', speed: c.speed }); }
        else if (c.fault === 'b' && !this.touch.bump) { this.touch.bump = true; this.bumps++; this.events.push({ type: 'contact', fault: 'rival', speed: c.speed }); }
      }
    } else if (this.touch && this.t - this.touch.t > RULES.apart) this.touch = null;
    // passes, and an outright lead held long enough
    const ahead = this.lead() > 0;
    if (ahead !== this.wasAhead) { this.passes++; this.events.push({ type: ahead ? 'pass' : 'passed' }); this.wasAhead = ahead; }
    const g = this.gapSec(), M = this.cfg.outright;
    if (this.t > RULES.warmup && this.pFinishT === null) {
      if (g >= M) this.leadT = Math.max(0, this.leadT) + dt; else if (g <= -M * RULES.lossMargin) this.leadT = Math.min(0, this.leadT) - dt; else this.leadT = 0;
      if (this.leadT >= RULES.hold) this.end('win');
      else if (this.leadT <= -RULES.hold) this.end('lose');
    }
    if (this.rFinishT !== null && this.pFinishT === null && this.t - this.rFinishT > RULES.giveUp) this.end('lose');
  }
  // the player's lap is done (main.js's finish, through the duel)
  playerFinished() { if (this.pFinishT === null) this.pFinishT = this.t; this.end(null); }
  end(outright) {
    if (this.done) return;
    this.done = true; this.outright = outright;
    // the gap: decided outright, the lead as it stands; at the line, the rival's time to the line (done, or reckoned
    // from where it is) less yours
    if (outright) { this.finalGap = this.gapSec(); } else {
      const pT = this.pFinishT ?? (this.t + Math.max(0, this.finishAt - this.pDist) / Math.max(8, this.player.speed));
      const rT = this.rFinishT ?? (this.t + Math.max(0, this.finishAt - this.rDist) / Math.max(8, this.rival.speed));
      this.finalGap = rT - pT;
    }
    this.events.push({ type: 'end', outright });
  }
  result() {
    const M = this.cfg.outright, gap = this.finalGap ?? this.gapSec();
    const edge = Math.round(this.pMeter.pts - this.rMeter.pts);
    const gapPts = Math.round(clamp(gap, -M * RULES.lossMargin, M) * RULES.gapPts);
    const pen = this.contacts * RULES.contactPts;
    return { edge, you: Math.round(this.pMeter.pts), rival: Math.round(this.rMeter.pts), gap: +gap.toFixed(2), gapPts, contacts: this.contacts, pen,
      score: edge + gapPts - pen, outright: this.outright, passes: this.passes, playerLeads: this.playerLeads };
  }
}

// the whole duel from its legs: an outright leg decides it; otherwise the two legs' scores add up, and a sudden-death
// third leg (when the two were within RULES.tie) decides it on its own
export function verdict(legs) {
  const o = legs.find((l) => l.outright);
  const total = legs.reduce((a, l) => a + l.score, 0);
  if (o) return { won: o.outright === 'win', outright: o.outright, total, suddenDeath: legs.length > 2 };
  if (legs.length > 2) return { won: legs[2].score !== 0 ? legs[2].score > 0 : total > 0, outright: null, total, suddenDeath: true };
  return { won: total > 0, outright: null, total, suddenDeath: false };
}
// after two legs: does it go to sudden death?
export const suddenDeath = (legs) => legs.length === 2 && !legs.some((l) => l.outright) && Math.abs(legs[0].score + legs[1].score) < RULES.tie;
// who leads a leg: you in leg 1, the rival in leg 2, and in sudden death whoever is behind on points
export const playerLeads = (legNo, legs) => (legNo === 1 ? true : legNo === 2 ? false : legs[0].score + legs[1].score < 0);

// what a duel pays: off a decent run on the same course (the cars builder's payout() on a copy of the player's
// progress with that course's first-time bonuses already taken), a bit more for a win, still something for a loss,
// and a first-win bonus per course
export const DUEL_PAY = { win: 1.6, lose: 0.8, outright: 0.2, firstWin: 1.0 };
export function duelPay(payout, progress, course, outcome, firstWin) {
  const p = JSON.parse(JSON.stringify(progress)); p.firsts[course.id] = { clear: true, stars: 3, top: true };
  const decent = Math.round((course.stars[0] + course.stars[1]) / 2);
  const base = payout(p, { score: decent, stars: 1, top: false }, course).total;
  const lines = [['Duel entry', base * (outcome.won ? DUEL_PAY.win : DUEL_PAY.lose)]];
  if (outcome.won && outcome.outright) lines.push(['Outright', base * DUEL_PAY.outright]);
  if (outcome.won && firstWin) lines.push(['First win here', base * DUEL_PAY.firstWin]);
  for (const l of lines) l[1] = Math.round(l[1]);
  return { lines, total: lines.reduce((a, l) => a + l[1], 0), base };
}

// a car's tune with a share of its parts fitted (the rival's own progress, never the player's): the cars builder's
// deriveTune() on a fresh progress for that car
export function carProgress(id, frac) {
  const p = G.newProgress(); p.car = id; p.garage = [id];
  const st = G.carState(p, id);
  for (const c of CATEGORIES) st.levels[c.id] = Math.round(G.maxLevel(id, c.id) * frac);
  return p;
}
export function carTune(id, frac) { return G.deriveTune(carProgress(id, frac)); }
carTune.rating = (id, frac) => G.rating(carProgress(id, frac), id);
