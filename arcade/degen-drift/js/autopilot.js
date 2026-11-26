// DRIFTLINE: the test driver. Drives a lap through the same inputs a player has (steer, throttle, brake, handbrake),
// drifting each zone: a handbrake flick to turn in, then the nose held inside the travel by steering, the angle held
// by throttle, the line followed by trimming the angle. Used by the Node simulator to tune the car and set the star
// tiers, and by the capture tool for DRIFT-TEST.mp4. Never loaded for players (main.js imports it only in test mode).
import { TUNING } from './config.js?v=0.1.23';

const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export class Autopilot {
  constructor(track, opt = {}) {
    this.track = track;
    this.angle = opt.angle ?? 34;        // the drift angle it aims for, degrees
    this.pace = opt.pace ?? 1.0;         // corner speed scale
    this.skip = new Set(opt.skipZones || []); // zones it drives through on grip instead
    this.flick = 0; this.lastZone = -1; this.mode = 'grip';
    this.kSteer = opt.kSteer ?? 4; this.kRate = opt.kRate ?? 3; this.bias = opt.bias ?? 0.35; this.flickTime = opt.flick ?? 0.22;
    this.p = [0, 0, 0];
  }
  zoneAhead(s, within) {
    const tr = this.track;
    let best = null, bd = Infinity;
    for (const zn of tr.zones) { const d = tr.ds(s, zn.s0); if (d > 0 && d < within && d < bd) { bd = d; best = zn; } }
    return best ? { zn: best, d: bd } : null;
  }
  cornerSpeed(zn) {
    const R = 1 / Math.max(zn.peak, 1e-3);
    return clamp(Math.sqrt(0.92 * 9.81 * R) * (R < 40 ? 0.88 : 1.02) * this.pace, 11, 42);
  }
  drive(car, dt) {
    const tr = this.track, s = car.s, v = car.speed;
    const inp = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true, ai: true }; // 11-25 ai: no thumbs, so no response curve (car.js)
    // the line: in or near a zone follow its racing line, otherwise drift back to the middle
    const look = clamp(7 + v * 0.42, 9, 30);
    const sa = s + look;
    const za = tr.zoneAt(sa);
    let latT = 0;
    if (za) latT = tr.zoneLine(za, tr.zoneT(za, sa), tr.half[Math.floor(tr.wrapS(sa) / tr.step) % tr.n]);
    tr.point(sa, latT, this.p);
    const thDes = Math.atan2(this.p[0] - car.x, this.p[2] - car.z);
    const thV = v > 1 ? Math.atan2(car.vx, car.vz) : car.psi;
    // how fast the travel itself is turning (smoothed)
    const wv = this.thPrev === undefined ? 0 : wrap(thV - this.thPrev) / dt;
    this.wv = (this.wv ?? 0) + (wv - (this.wv ?? 0)) * Math.min(1, dt * 20); this.thPrev = thV;

    const here = tr.zoneAt(s);
    const ahead = this.zoneAhead(s, 140);
    const zn = here || (ahead && ahead.d < 18 ? ahead.zn : null);
    const drift = zn && !this.skip.has(zn.id) && v > 9;
    // speed: brake for the next corner in time
    let vTarget = TUNING.car.topSpeedKmh / 3.6;
    if (ahead) {
      const vc = this.cornerSpeed(ahead.zn);
      const dist = Math.max(0, ahead.d - 6);
      vTarget = Math.min(vTarget, Math.sqrt(vc * vc + 2 * 6.0 * dist));
    }
    if (here) vTarget = Math.min(vTarget, this.cornerSpeed(here)); // 11-18: was x1.15, too fast to hold a line by the wall

    if (drift) {
      this.mode = 'drift';
      const side = zn.side;
      // with the drift hold minding the angle, steering steers the travel: aim the slide at the line
      const e = wrap(thDes - thV);
      // the line's own bend ahead, as a turn rate, plus a correction toward the aim point; steering trims the
      // travel's turn rate toward it (the D term is what keeps it from weaving wall to wall)
      const ci = Math.floor(tr.wrapS(s + 8) / tr.step) % tr.n;
      const wDes = v * tr.curvSmooth[ci] + e * this.kSteer;
      inp.steer = clamp((wDes - this.wv) * this.kRate + side * this.bias, -1, 1);
      // throttle holds the corner's speed, never so low the slide dies
      inp.throttle = clamp(0.62 + (vTarget - v) * 0.1, 0.32, 1);
      // 11-18: eyes for the outside wall, now that the line rides it: a slide running wide of the line lifts, half the
      // throttle per metre (speed, not steering, is what tightens a slide's path)
      if (here) { const w = -side * (car.lat - tr.zoneLine(here, tr.zoneT(here, s), tr.half[car.trackI])); if (w > 0) inp.throttle = Math.max(0.15, inp.throttle - w * 0.5); }
      const beta = Math.abs(car.beta);
      // turn in: a short handbrake flick if the tail is not out yet
      if (this.lastZone !== zn.id) { this.lastZone = zn.id; if (beta < 12 * DEG) this.flick = this.flickTime; }
      if (this.flick > 0) { this.flick -= dt; inp.handbrake = 1; inp.throttle = 0.4; inp.steer = side * 0.65; }
    } else {
      this.mode = 'grip';
      const e = wrap(thDes - car.psi);
      inp.steer = clamp(e * 2.4 - car.r * 0.12, -1, 1);
      if (v > vTarget) { inp.brake = clamp((v - vTarget) * 0.5, 0.3, 1); inp.throttle = 0; }
      else inp.throttle = clamp((vTarget - v) * 0.3 + 0.2, 0, 1);
      if (Math.abs(car.beta) > 20 * DEG) inp.throttle = Math.min(inp.throttle, 0.35);
    }
    return inp;
  }
}
