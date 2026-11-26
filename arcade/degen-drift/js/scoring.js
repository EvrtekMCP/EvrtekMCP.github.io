// DRIFTLINE: drift scoring, built to Evrtek's ruling (2026-11-15, via Dirigent):
//   - every corner has a zone on the road (a band along the drift line) with a tighter sweet spot inside it;
//   - points come only while drifting inside a zone, per second, scaled by speed (the more the better) and, less, by
//     angle; the sweet spot pays more;
//   - leaving a zone still drifting opens a short link window; reaching a NEW zone still drifting links the chain and
//     raises the multiplier (to a cap);
//   - the drift ending, or the window running out, banks the chain: its points times the multiplier;
//   - touching a wall wipes the unbanked points and the multiplier. 11-19 (Evrtek: "if you graze the wall gently, then
//     I don't want that to be a punishment"): only a HIT does (car.js judges every contact); a GRAZE keeps the chain,
//     its multiplier and its points, but the wall pays nothing while the car touches it (wall.grazePay) and touching
//     is no time on the sweet spot, so riding the wall is never a drift. 11-25: a WALL KISS (the flank meeting the
//     wall flat and light) keeps the chain too, and adds a little to it (wall.kissPoints).
// 11-18 (Evrtek's multiplier, after test v12): two more ways up for the same multiplier, while a chain is live:
//   - HOLD the sweet spot: every full second held in it (still sliding) is a step;
//   - a SWITCHBACK: a slide one way, then a flip to a slide the other way, each held at least half a second, is a
//     bigger step. A flick held less than that counts for nothing and breaks nothing. It works anywhere the chain is
//     live: inside one bend, through an S, between zones in the link window.
//   The link stays as it was (a step, and the window that carries the chain from zone to zone). The cap is higher.
// Pure JS; every number lives in TUNING.scoring.
import { TUNING } from './config.js?v=0.1.20';

const DEG = 180 / Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// 11-18: the hold and switchback count, shared with the duel's drift meter (js/duel/duel.js). tick() once a step:
// sliding = past the slide angle; sweet = in the sweet spot while drifting. Afterwards hold / swap say whether a hold
// step or a switchback came due this tick; holdT is the time toward the next hold step (the HUD's ring).
export class Steps {
  constructor() { this.reset(); }
  reset() { this.holdT = 0; this.outT = 0; this.dir = 0; this.dirT = 0; this.held = 0; this.hold = false; this.swap = false; }
  tick(dt, car, sliding, sweet) {
    const Sc = TUNING.scoring;
    this.hold = false; this.swap = false;
    // the sweet spot, held without a break (a moment past its edge is no break; the time out of it does not count)
    if (sweet) { this.outT = 0; this.holdT += dt; if (this.holdT >= Sc.holdSec) { this.holdT -= Sc.holdSec; this.hold = true; } }
    else if (this.holdT > 0 && (this.outT += dt) > Sc.holdGrace) { this.holdT = 0; this.outT = 0; }
    // the way the slide is held: a new way held switchHold seconds is a switchback from the last way held that long
    if (sliding) {
      const d = car.beta > 0 ? 1 : -1;
      if (d !== this.dir) { this.dir = d; this.dirT = 0; }
      this.dirT += dt;
      if (this.dirT >= Sc.switchHold && this.held !== d) { this.swap = this.held !== 0; this.held = d; }
    }
  }
}

export class DriftScore {
  constructor(track) { this.track = track; this.events = []; this.steps = new Steps(); this.reset(); }
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
    this.steps.reset(); this.holdFrac = 0;
    this.events.length = 0;
    this.kissSeen = null; this.kissT = 9; // 11-25: the car's kiss count last seen; s since a kiss was paid
    this.stats = { chains: 0, bestChain: 0, links: 0, holds: 0, switches: 0, maxMult: 1, walls: 0, wiped: 0, zoneTime: 0, sweetTime: 0, driftTime: 0, maxAngle: 0, kisses: 0, kissPaid: 0 };
  }
  get chainValue() { return Math.round(this.acc * this.mult); }
  // a step up the multiplier (to the cap); the event says what earned it and what it added (0 at the cap)
  raise(type, by) {
    const was = this.mult;
    this.mult = Math.min(TUNING.scoring.multCap, this.mult + by);
    this.stats.maxMult = Math.max(this.stats.maxMult, this.mult);
    this.events.push({ type, mult: this.mult, add: this.mult - was });
  }

  update(dt, car) {
    const Sc = TUNING.scoring, tr = this.track;
    const angle = Math.abs(car.beta) * DEG, kmh = car.speed * 3.6;
    this.angle = angle;
    const sliding = angle >= Sc.minAngleDeg && kmh >= Sc.minSpeedKmh && car.u > 0;
    if (sliding) { this.dropT = 0; this.drifting = true; this.driftT += dt; this.stats.driftTime += dt; this.stats.maxAngle = Math.max(this.stats.maxAngle, angle); }
    else if (this.drifting) { this.dropT += dt; if (this.dropT > Sc.dropGrace) { this.drifting = false; this.driftT = 0; this.bank('ended'); } }
    // 11-25 the wall kiss (car.js judge: the flank meeting the wall flat and light): the chain and its multiplier were
    // never at risk; each new kiss adds wall.kissPoints to a live chain (at most one in wall.kissGap s), which the
    // multiplier then pays on when it banks. The 'kiss' event carries what it paid (0 with no chain, or too soon)
    const kn = car.kisses || 0;
    this.kissT += dt;
    if (this.kissSeen === null || kn < this.kissSeen) this.kissSeen = kn;
    else if (kn > this.kissSeen) {
      this.kissSeen = kn; this.stats.kisses++;
      const W = TUNING.wall, paid = this.acc > 0 && this.kissT >= W.kissGap ? W.kissPoints : 0;
      if (paid > 0) { this.acc += paid; this.kissT = 0; this.stats.kissPaid += paid; }
      this.events.push({ type: 'kiss', points: paid, mult: this.mult });
    }

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
    const touching = TUNING.wall.grazes > 0 && car.contact > 0; // 11-19: on the wall this step (a graze, or a hit)
    if (inZone && this.drifting) {
      if (this.zoneId !== zn.id) {
        // into a zone: a new zone inside an open window links the chain
        if (this.acc > 0 && this.lastZoneId !== zn.id && (this.linkOpen || this.lastZoneId >= 0)) {
          this.stats.links++; this.raise('link', Sc.multStep);
        } else if (this.acc === 0) this.events.push({ type: 'start' });
        this.zoneId = zn.id; this.lastZoneId = zn.id; this.linkOpen = false; this.linkT = 0;
      }
      const sf = clamp(Math.pow(kmh / Sc.speedRefKmh, Sc.speedExp), 0, Sc.speedFactorMax);
      const af = 1 - Sc.angleWeight + 2 * Sc.angleWeight * clamp((angle - Sc.minAngleDeg) / (Sc.angleIdealDeg - Sc.minAngleDeg), 0, 1);
      this.rate = Sc.zonePointsPerSec * sf * af * (sweet ? Sc.sweetMult : 1) * (touching ? TUNING.wall.grazePay : 1);
      this.acc += this.rate * dt;
      this.stats.zoneTime += dt; if (sweet) this.stats.sweetTime += dt;
    } else if (this.zoneId >= 0) {
      // out of the band (past the zone's end, or off its line): the link window opens and drains
      this.zoneId = -1;
      if (this.acc > 0 && this.drifting) { this.linkOpen = true; this.linkT = Sc.linkWindow; this.events.push({ type: 'window' }); }
    }
    // 11-18: holds and switchbacks, counted while there is a chain for them to multiply
    const st = this.steps;
    st.tick(dt, car, sliding, inZone && this.drifting && sweet && !touching);
    if (this.acc > 0) {
      if (st.hold) { this.stats.holds++; this.raise('hold', Sc.holdStep); }
      if (st.swap) { this.stats.switches++; this.raise('switch', Sc.switchStep); }
    }
    this.holdFrac = this.acc > 0 ? clamp(st.holdT / Sc.holdSec, 0, 1) : 0;
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
    this.steps.reset(); this.holdFrac = 0; // a new chain counts its holds and switchbacks afresh
  }

  // a wall hit (or a reset): the unbanked chain is lost (a graze never calls this)
  wipe(why = 'wall') {
    const Sc = TUNING.scoring;
    if (why === 'wall') this.stats.walls++;
    const lost = Math.round(this.acc * this.mult * Sc.wallWipe);
    if (lost > 0) this.stats.wiped += lost;
    this.events.push({ type: 'wipe', lost, why });
    if (Sc.wallWipe >= 1) { this.acc = 0; this.mult = 1; this.linkOpen = false; this.linkT = 0; this.zoneId = -1; this.lastZoneId = -1; this.steps.reset(); this.holdFrac = 0; }
    else this.acc *= 1 - Sc.wallWipe;
  }

  // stars for a total on a course: 0-3, plus the top tier
  static rate(total, course) {
    let stars = 0; for (const t of course.stars) if (total >= t) stars++;
    const top = total >= course.degenerate;
    return { stars, top, name: top ? TUNING.scoring.topTierName : null };
  }
}
