// DRIFTLINE: drift scoring, built to Evrtek's ruling (2026-11-15, via Dirigent):
//   - every corner has a zone on the road (a band along the racing line) with a tighter sweet spot inside it;
//   - points come only while drifting inside a zone, per second, scaled by speed (the more the better) and, less, by
//     angle; the sweet spot pays more;
//   - leaving a zone still drifting opens a short link window; reaching a NEW zone still drifting links the chain and
//     raises the multiplier (to a cap);
//   - the drift ending, or the window running out, banks the chain: its points times the multiplier;
//   - touching a wall wipes the unbanked points and the multiplier.
// Pure JS; every number lives in TUNING.scoring.
import { TUNING } from './config.js?v=0.1.0';

const DEG = 180 / Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class DriftScore {
  constructor(track) { this.track = track; this.events = []; this.reset(); }
  reset() {
    this.total = 0;          // banked
    this.acc = 0;            // the live chain, before the multiplier
    this.mult = 1;
    this.drifting = false; this.dropT = 0; this.driftT = 0;
    this.zoneId = -1;        // the zone being scored in right now (-1 none)
    this.lastZoneId = -1;    // the zone the chain last scored in
    this.linkOpen = false; this.linkT = 0;
    this.inZone = false; this.sweet = false; this.zoneNear = null; this.offLine = 0;
    this.rate = 0; this.angle = 0;
    this.events.length = 0;
    this.stats = { chains: 0, bestChain: 0, links: 0, maxMult: 1, walls: 0, wiped: 0, zoneTime: 0, sweetTime: 0, driftTime: 0, maxAngle: 0 };
  }
  get chainValue() { return Math.round(this.acc * this.mult); }

  update(dt, car) {
    const Sc = TUNING.scoring, tr = this.track;
    const angle = Math.abs(car.beta) * DEG, kmh = car.speed * 3.6;
    this.angle = angle;
    const sliding = angle >= Sc.minAngleDeg && kmh >= Sc.minSpeedKmh && car.u > 0;
    if (sliding) { this.dropT = 0; this.drifting = true; this.driftT += dt; this.stats.driftTime += dt; this.stats.maxAngle = Math.max(this.stats.maxAngle, angle); }
    else if (this.drifting) { this.dropT += dt; if (this.dropT > Sc.dropGrace) { this.drifting = false; this.driftT = 0; this.bank('ended'); } }

    // where the car sits against the zone bands
    const zn = tr.zoneAt(car.s);
    let inZone = false, sweet = false, off = 0;
    if (zn) {
      const t = tr.zoneT(zn, car.s), half = tr.halfAt(car.trackI, 0);
      off = car.lat - tr.zoneLine(zn, t, half);
      inZone = Math.abs(off) <= zn.zoneHalf; sweet = Math.abs(off) <= zn.sweetHalf;
    }
    this.zoneNear = zn; this.inZone = inZone; this.sweet = sweet; this.offLine = off;

    this.rate = 0;
    if (inZone && this.drifting) {
      if (this.zoneId !== zn.id) {
        // into a zone: a new zone inside an open window links the chain
        if (this.acc > 0 && this.lastZoneId !== zn.id && (this.linkOpen || this.lastZoneId >= 0)) {
          this.mult = Math.min(Sc.multCap, this.mult + Sc.multStep);
          this.stats.links++; this.stats.maxMult = Math.max(this.stats.maxMult, this.mult);
          this.events.push({ type: 'link', mult: this.mult });
        } else if (this.acc === 0) this.events.push({ type: 'start' });
        this.zoneId = zn.id; this.lastZoneId = zn.id; this.linkOpen = false; this.linkT = 0;
      }
      const sf = clamp(Math.pow(kmh / Sc.speedRefKmh, Sc.speedExp), 0, Sc.speedFactorMax);
      const af = 1 - Sc.angleWeight + 2 * Sc.angleWeight * clamp((angle - Sc.minAngleDeg) / (Sc.angleIdealDeg - Sc.minAngleDeg), 0, 1);
      this.rate = Sc.zonePointsPerSec * sf * af * (sweet ? Sc.sweetMult : 1);
      this.acc += this.rate * dt;
      this.stats.zoneTime += dt; if (sweet) this.stats.sweetTime += dt;
    } else if (this.zoneId >= 0) {
      // out of the band (past the zone's end, or off its line): the link window opens and drains
      this.zoneId = -1;
      if (this.acc > 0 && this.drifting) { this.linkOpen = true; this.linkT = Sc.linkWindow; this.events.push({ type: 'window' }); }
    }
    if (this.linkOpen) {
      this.linkT -= dt;
      if (this.linkT <= 0) { this.linkT = 0; this.linkOpen = false; this.bank('window'); }
    }
  }

  bank(why) {
    if (this.acc > 0) {
      const v = this.chainValue;
      this.total += v; this.stats.chains++; this.stats.bestChain = Math.max(this.stats.bestChain, v);
      this.events.push({ type: 'bank', value: v, mult: this.mult, why });
    }
    this.acc = 0; this.mult = 1; this.linkOpen = false; this.linkT = 0; this.zoneId = -1; this.lastZoneId = -1;
  }

  // a wall (or a reset): the unbanked chain is lost
  wipe(why = 'wall') {
    const Sc = TUNING.scoring;
    if (why === 'wall') this.stats.walls++;
    const lost = Math.round(this.acc * this.mult * Sc.wallWipe);
    if (lost > 0) this.stats.wiped += lost;
    this.events.push({ type: 'wipe', lost, why });
    if (Sc.wallWipe >= 1) { this.acc = 0; this.mult = 1; this.linkOpen = false; this.linkT = 0; this.zoneId = -1; this.lastZoneId = -1; }
    else this.acc *= 1 - Sc.wallWipe;
  }

  // stars for a total on a course: 0-3, plus the top tier
  static rate(total, course) {
    let stars = 0; for (const t of course.stars) if (total >= t) stars++;
    const top = total >= course.degenerate;
    return { stars, top, name: top ? TUNING.scoring.topTierName : null };
  }
}
