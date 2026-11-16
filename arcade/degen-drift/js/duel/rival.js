// DEGEN DRIFT: the duel rival's driving. The same hands a player has (steer, throttle, brake, handbrake), the same
// technique as the test driver (a handbrake flick to turn in, the slide aimed down the zone's line, the angle held on
// the throttle), plus what a rival needs: its own pace and angle (per course, duel.js DUELS), a line that goes round
// you rather than through you when you are in the way, and mistakes you can pounce on: running wide, lifting
// mid-corner, turning in late on grip. Mistakes come from a seeded draw at each zone, so a duel can be replayed.
// If it ends up stopped against a wall it resets onto the road, as a player would (R).
const DEG = Math.PI / 180;
const PASS_HALF = 5.9; // half the road's width it needs to go round you
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class Rival {
  constructor(track, cfg, seed = 1) {
    this.track = track; this.cfg = cfg; this.R = rng(seed);
    this.pace = cfg.pace ?? 1; this.angle = cfg.angle ?? 34; this.mistakes = cfg.mistakes ?? 0.2;
    this.kSteer = 4; this.kRate = 3; this.bias = 0.35; this.flickTime = 0.22;
    this.flick = 0; this.lastZone = -1; this.mistake = null; this.mt = 0; this.stuck = 0; this.off = 0;
    this.p = [0, 0, 0]; this.log = [];
  }
  zoneAhead(s, within) {
    const tr = this.track; let best = null, bd = Infinity;
    for (const zn of tr.zones) { const d = tr.ds(s, zn.s0); if (d > 0 && d < within && d < bd) { bd = d; best = zn; } }
    return best ? { zn: best, d: bd } : null;
  }
  cornerSpeed(zn) {
    const Rr = 1 / Math.max(zn.peak, 1e-3);
    // the pace after the floor (day 5): in the tightest hairpins the floor held every driver to the same 11 m/s
    return clamp(Math.sqrt(0.92 * 9.81 * Rr) * (Rr < 40 ? 0.88 : 1.02), 11, 44) * this.pace;
  }
  // car: the rival's car; dt: step; other: the player's car (to drive round, never at)
  drive(car, dt, other) {
    const tr = this.track, s = car.s, v = car.speed;
    const inp = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true };
    // stopped against something: back onto the road, as a player would
    this.stuck = v < 2 && car.contact ? this.stuck + dt : v < 1 ? this.stuck + dt * 0.5 : 0;
    if (this.stuck > 2.5) { car.reset(s + 2, 0); this.stuck = 0; this.log.push('reset'); return inp; }
    // the line: the zone's racing line near a zone, the middle otherwise, shifted round the other car if it is in the way
    const look = clamp(7 + v * 0.42, 9, 30), sa = s + look, za = tr.zoneAt(sa);
    const ia = Math.floor(tr.wrapS(sa) / tr.step) % tr.n;
    let latT = za ? tr.zoneLine(za, tr.zoneT(za, sa), tr.half[ia]) : tr.laneOff[ia];
    let want = 0;
    if (other) {
      const ahead = tr.ds(s, other.s), dl = other.lat - car.lat;
      // go round on the side with more road, but only where there is road to do it (not on a narrow touge, and not
      // mid-slide in a zone, where a wider line only finds the wall): otherwise follow and wait for a mistake. Day 5:
      // 12 m of road at least (CEDAR's 11 m had the two cars leaning on each other for whole straights)
      if (ahead > -2 && ahead < 16 && Math.abs(dl) < 2.6 && tr.half[ia] > PASS_HALF && !tr.zoneAt(s) && !za) {
        const room = Math.max(0, tr.half[ia] - 1.6);
        want = (other.lat > tr.laneOff[ia] ? -1 : 1) * Math.min(room, 2.4);
      }
    }
    this.off += (want - this.off) * Math.min(1, dt * 2.5);
    latT = clamp(latT + this.off, -tr.half[ia] + 1.4, tr.half[ia] - 1.4);
    tr.point(sa, latT, this.p);
    const thDes = Math.atan2(this.p[0] - car.x, this.p[2] - car.z);
    const thV = v > 1 ? Math.atan2(car.vx, car.vz) : car.psi;
    const wv = this.thPrev === undefined ? 0 : wrap(thV - this.thPrev) / dt;
    this.wv = (this.wv ?? 0) + (wv - (this.wv ?? 0)) * Math.min(1, dt * 20); this.thPrev = thV;

    const here = tr.zoneAt(s), ahead = this.zoneAhead(s, 140);
    const zn = here || (ahead && ahead.d < 18 ? ahead.zn : null);
    // a new zone: maybe a mistake in it
    if (zn && this.lastZone !== zn.id) {
      this.lastZone = zn.id; this.mistake = null;
      if (this.R() < this.mistakes) { const k = this.R(); this.mistake = k < 0.4 ? 'wide' : k < 0.75 ? 'lift' : 'late'; this.mt = 0; this.log.push(this.mistake + '@' + zn.id); }
      if (this.mistake !== 'late' && Math.abs(car.beta) < 12 * DEG) this.flick = this.flickTime;
    }
    let vTarget = car.T.car.topSpeedKmh / 3.6;
    if (ahead) { const vc = this.cornerSpeed(ahead.zn), dist = Math.max(0, ahead.d - 6); vTarget = Math.min(vTarget, Math.sqrt(vc * vc + 2 * 6.0 * dist)); }
    if (here) vTarget = Math.min(vTarget, this.cornerSpeed(here) * (this.mistake === 'late' ? 0.92 : 1.15));
    const drift = zn && v > 9 && this.mistake !== 'late';
    // don't drive into the back of you: ease off when closing and nowhere to go, a car's length and more back; mid-slide
    // only when about to touch, so its own drift does not fold up behind you (day 5)
    if (other) {
      const gap = tr.ds(s, other.s), near = drift ? 5 : 8;
      if (gap > 0 && gap < near && Math.abs(other.lat - car.lat) < 2.6 && v > other.speed - 0.5) vTarget = Math.min(vTarget, other.speed - 0.5 - (near - gap) * 0.3);
    }
    if (drift) {
      const side = zn.side, e = wrap(thDes - thV), ci = Math.floor(tr.wrapS(s + 8) / tr.step) % tr.n;
      const wDes = v * tr.curvSmooth[ci] + e * this.kSteer;
      let bias = this.bias, extra = 0;
      if (this.mistake === 'wide') { bias = -0.05; extra = 0.12; }
      inp.steer = clamp((wDes - this.wv) * this.kRate + side * bias, -1, 1);
      inp.throttle = clamp(0.62 + (vTarget - v) * 0.1 + extra + (this.angle - 34) * 0.01, 0.32, 1);
      if (this.mistake === 'lift') { this.mt += dt; if (this.mt > 0.5 && this.mt < 1.1) inp.throttle = 0.22; }
      if (this.flick > 0) { this.flick -= dt; inp.handbrake = 1; inp.throttle = 0.4; inp.steer = side * 0.65; }
    } else {
      const e = wrap(thDes - car.psi);
      inp.steer = clamp(e * 2.4 - car.r * 0.12, -1, 1);
      if (v > vTarget) { inp.brake = clamp((v - vTarget) * 0.5, 0.3, 1); inp.throttle = 0; }
      else inp.throttle = clamp((vTarget - v) * 0.3 + 0.2, 0, 1);
      // on the straights, a hand on the throttle like a good driver's: a big engine that steps the tail out gets eased
      // back before the slide grows (the test driver's version only lifts past 20 degrees)
      const b = Math.abs(car.beta) / DEG;
      if (b > 6) inp.throttle = Math.min(inp.throttle, clamp(1 - (b - 6) / 14, 0.15, 1));
      if (b > 20) inp.throttle = Math.min(inp.throttle, 0.35);
    }
    return inp;
  }
}
