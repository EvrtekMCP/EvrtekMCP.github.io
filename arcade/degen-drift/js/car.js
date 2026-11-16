// DRIFTLINE: the car. A light bicycle model, no physics engine: two axles, weight that shifts between them under
// throttle and brake, a front tire whose grip peaks and falls away into a slide, rear wheels whose own speed is a
// state (so throttle spins them and spends side grip, which is what holds a drift), a handbrake that locks them, and
// three assists: the counter-steer (front wheels follow the slide), the drift hold (keeps the angle where the player
// asks for it) and the spin guard. Every number comes from the tune (config.js TUNING with the garage's parts and the
// car's damage applied: garage.js deriveTune). Pure JS: the browser and the Node simulator share it.
import { TUNING } from './config.js?v=0.1.0';

const DEG = Math.PI / 180, G = 9.81;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// normalised tire curve: rises to 1 at the peak slip angle, then falls to `slide` over `fall` radians. Odd in alpha.
function tire(alpha, peak, slide, fall) {
  const x = Math.abs(alpha) / peak;
  const g = x < 1 ? x * (2 - x) : 1 - (1 - slide) * sstep(0, 1, (Math.abs(alpha) - peak) / fall);
  return alpha < 0 ? -g : g;
}

export class Car {
  constructor(track, tune) {
    this.track = track;
    this.T = tune || TUNING;
    this.events = [];
    this.nosCharge = 1;
    this.reset(0, 0);
  }
  setTune(T) { this.T = T; }
  reset(s, lat = 0) {
    const p = this.track.point(s, lat);
    this.x = p[0]; this.z = p[2]; this.y = p[1];
    this.psi = this.track.headingAt(s);
    this.vx = 0; this.vz = 0; this.r = 0;
    this.u = 0; this.w = 0; this.speed = 0; this.beta = 0;
    this.steerIn = 0; this.delta = 0;
    this.ax = 0; this.ay = 0;
    this.gear = 1; this.rpm = this.T.car.idleRpm; this.wheelSpin = 0; this.ws = 0; this.reverse = false; this.cut = 0;
    this.spin = 0; this.slipF = 0; this.slipR = 0; this.alphaF = 0; this.alphaR = 0;
    this.loadF = 0.5; this.wheelRot = 0; this.boost = 0; this.nosOn = false;
    this.hint = -1; this.contact = 0; this.scrape = 0; this.noContact = 1; this.touchFired = false;
    this.s = s; this.lat = lat; this.trackI = 0;
    this.throttle = 0; this.brake = 0; this.handbrake = 0;
    this.events.length = 0;
    this.locate();
  }
  locate() {
    const q = this.track.closest(this.x, this.z, this.hint);
    this.hint = q.i; this.trackI = q.i; this.s = q.s; this.lat = q.lat;
    this.y = this.track.heightAt(q.i, q.f);
    return q;
  }

  // inp: { throttle 0..1, brake 0..1, steer -1..1 (left +), handbrake 0..1, nos bool, analog: true for a stick }
  step(dt, inp) {
    const TT = this.T, C = TT.car, T = TT.tires, S = TT.steer, A = TT.assist;
    const m = C.mass, L = C.wheelbase, b = L * C.frontWeight, a = L - b;
    const I = m * a * b * C.yawInertiaScale;
    const sp = Math.sin(this.psi), cp = Math.cos(this.psi);
    let u = this.vx * sp + this.vz * cp;           // forward speed
    let w = this.vx * cp - this.vz * sp;           // sideways speed, + to the left
    let r = this.r;
    const speed = Math.hypot(u, w), kmh = speed * 3.6;

    // ---- steering: the stick's range narrows with speed; the assist adds lock toward the slide on top
    const target = clamp(inp.steer || 0, -1, 1);
    if (inp.analog) this.steerIn += (target - this.steerIn) * Math.min(1, dt * 18);
    else {
      const toward = target !== 0 && (Math.sign(target) === Math.sign(this.steerIn) || this.steerIn === 0);
      const rate = (toward ? S.rate : S.returnRate) * dt;
      this.steerIn += clamp(target - this.steerIn, -rate, rate);
    }
    const range = (S.highSpeedDeg + (S.maxDeg - S.highSpeedDeg) / (1 + (kmh / S.highSpeedKmh) ** 2)) * DEG;
    const beta = speed > 0.5 ? Math.atan2(w, Math.abs(u)) : 0;   // the slide angle: + when travel is left of the nose
    this.beta = u >= 0 ? beta : 0;
    const assistFade = sstep(A.lowSpeedKmh, A.lowSpeedKmh + 15, kmh) * (u > 0 ? 1 : 0);
    const assist = S.counterAssist * clamp(beta, -S.counterMaxDeg * DEG, S.counterMaxDeg * DEG) * assistFade;
    // a bent front corner pulls the wheel a little toward it (garage.js; capped at damage.steerPullDeg)
    const pull = (S.pullDeg || 0) * DEG * clamp(speed / 10, 0, 1);
    const delta = clamp(this.steerIn * range + assist + pull, -S.lockDeg * DEG, S.lockDeg * DEG);
    this.delta = delta;

    // ---- pedals, with reverse when stopped and holding brake
    let throttle = clamp(inp.throttle || 0, 0, 1), brake = clamp(inp.brake || 0, 0, 1);
    const hand = clamp(inp.handbrake || 0, 0, 1);
    if (this.reverse) { if (throttle > 0.05 || brake < 0.05) { if (u > -0.5) this.reverse = false; } }
    if (!this.reverse && brake > 0.3 && throttle < 0.05 && u < 0.6 && u > -0.5) this.reverse = true;
    // ---- power: the turbo's boost builds with throttle and revs; nitrous adds a surge while the bottle lasts
    let powerMul = 1;
    if (C.turbo) {
      const want = throttle * clamp((this.rpm - 2800) / 2500, 0, 1);
      this.boost += (want - this.boost) * Math.min(1, dt / Math.max(0.05, TT.turbo.spool) * (want > this.boost ? 1 : 3));
      powerMul *= 0.8 + 0.2 * this.boost;     // off boost a turbo car is a little flat
    } else this.boost = throttle;
    this.nosOn = !!(C.nos && inp.nos && this.nosCharge > 0 && throttle > 0.1 && !this.reverse);
    if (this.nosOn) { powerMul += TT.nos.power; this.nosCharge = Math.max(0, this.nosCharge - dt / TT.nos.seconds); }
    // the power band: a revvy engine (band > 0) gives little low down and all of it near the top
    if (C.band) powerMul *= 1 - C.band * (1 - sstep(C.bandLo ?? 0.3, C.bandHi ?? 0.75, this.rpm / C.redline));
    if (this.cut > 0) { this.cut -= dt; powerMul *= 0.3; }
    let drive = 0;
    const top = C.topSpeedKmh / 3.6 * (this.nosOn ? 1.06 : 1);
    if (this.reverse) {
      drive = -brake * C.maxDrive * C.reverseShare * (u < -8 ? 0 : 1);
      brake = throttle; throttle = 0;
    }
    this.throttle = throttle; this.brake = brake; this.handbrake = hand;

    // ---- weight transfer: the longitudinal acceleration of the last step loads one axle and unloads the other
    const shift = C.transferScale * m * this.ax * C.cgHeight / L;
    const Fzf = Math.max(m * G * 0.12, m * G * b / L - shift);
    const Fzr = Math.max(m * G * 0.12, m * G * a / L + shift);
    this.loadF = Fzf / (Fzf + Fzr);

    const vmin = 2.0;
    // ---- front tire (in the wheel's own frame, then back to the car's)
    const cd = Math.cos(delta), sd = Math.sin(delta);
    const fvx = u, fvy = w + a * r;
    const flon = fvx * cd + fvy * sd, flat = -fvx * sd + fvy * cd;
    const alphaF = Math.atan2(flat, Math.max(Math.abs(flon), vmin));
    const surf = this.surfGrip ?? 1; // the surface under the wheels (js/carsurface.js): aprons and shoulders grip less
    const capF = T.muFront * Fzf * surf;
    let fLat = -capF * tire(alphaF, T.peakFrontDeg * DEG, T.slideFront, T.falloffDeg * DEG);
    const fLon = -Math.sign(flon) * Math.min(brake * C.brakeForce * C.brakeFront, capF) * clamp(Math.abs(flon) * 2, 0, 1);
    const fRoom = Math.sqrt(Math.max(0, capF * capF - fLon * fLon));
    fLat = clamp(fLat, -fRoom, fRoom);
    const Fxf = fLon * cd - fLat * sd, Fyf = fLon * sd + fLat * cd;

    // ---- rear tires (one axle)
    const rvx = u, rvy = w - b * r;
    const alphaR = Math.atan2(rvy, Math.max(Math.abs(rvx), vmin));
    const capR = T.muRear * Fzr * surf;
    let Frx, Fry, spin = 0;
    if (hand > 0.05) {
      // locked: the rubber slides, and friction opposes the way the contact patch is sliding; the engine is clutched
      // out while the lever is pulled (a half pull blends toward a free-rolling rear)
      const v = Math.hypot(rvx, rvy) + 0.6, grip = capR * C.handbrakeGrip;
      const latFree = -capR * tire(alphaR, T.peakRearDeg * DEG, T.slideRear, T.falloffDeg * DEG);
      const hb = Math.min(1, hand * 1.2);
      Frx = (-rvx / v * grip) * hb; Fry = (-rvy / v * grip) * hb + latFree * (1 - hb);
      this.ws = 0;
    } else if (this.reverse || rvx < -0.5) {
      // reversing: a plain friction circle is plenty
      const brakeR = brake * C.brakeForce * (1 - C.brakeFront) * clamp(Math.abs(rvx) * 2, 0, 1);
      const latDemand = -capR * tire(alphaR, T.peakRearDeg * DEG, T.slideRear, T.falloffDeg * DEG);
      Frx = clamp(drive - Math.sign(rvx) * brakeR, -capR, capR);
      const room = Math.sqrt(Math.max(0, capR * capR - Frx * Frx));
      Fry = clamp(latDemand, -room, room);
      this.ws = rvx;
    } else {
      // Driving forward: the rear wheels' own speed is a state. The engine (or the brake) spins them up or down; the
      // tire's force follows the combined slip (wheelspin along, slide across), pointed against it. The harder they
      // spin, the less of the grip pushes sideways; the further the tail slides, the more of it swings back to
      // sideways. The engine's force falls as the wheels spin up (its power is spent at the wheel's speed).
      const brakeR = Math.min(brake * C.brakeForce * (1 - C.brakeFront), capR * 0.92); // no rear lock-up on the pedal
      const pw = C.powerKW * 1000 * powerMul, lim = u > top ? 0 : 1 - sstep(top * 0.94, top, u) * 0.85;
      const maxD = C.maxDrive * Math.min(powerMul, 1.6);
      const demandAt = (ws) => throttle * Math.min(maxD, pw / Math.max(ws, 1)) * lim - brakeR;
      const vden = Math.max(Math.abs(rvx), 3), kP = T.peakSlipRatio, aP = Math.tan(T.peakRearDeg * DEG);
      const fall = T.falloffDeg / T.peakRearDeg;
      let fy = 0;
      const force = (ws) => {
        const nx = (ws - rvx) / vden / kP, ny = rvy / vden / aP, n = Math.hypot(nx, ny);
        if (n < 1e-6) { fy = 0; return 0; }
        const g = n < 1 ? n * (2 - n) : 1 - (1 - T.slideRear) * sstep(0, 1, (n - 1) / fall);
        fy = -capR * g * ny / n;
        return capR * g * nx / n;
      };
      // implicit step for the wheel speed (stable at any stiffness): bisect ws so that ws - ws0 = dt/M (demand - Fx)
      const M = C.wheelInertia, ws0 = clamp(this.ws, 0, rvx + 80);
      let lo = 0, hi = Math.max(rvx, 0) + 80;
      for (let it = 0; it < 22; it++) {
        const mid = (lo + hi) / 2;
        if (mid - ws0 - dt / M * (demandAt(mid) - force(mid)) > 0) hi = mid; else lo = mid;
      }
      this.ws = (lo + hi) / 2;
      Frx = force(this.ws); Fry = fy;
      spin = clamp((this.ws - rvx) / Math.max(rvx, 4) / kP - 1, 0, 3) / 3;
    }
    this.spin = spin;

    // ---- sum the forces in the car's frame
    const drag = C.drag * u * Math.abs(u) + C.rolling * u;
    const Fx = Fxf + Frx - drag;
    const Fy = Fyf + Fry;
    let tq = a * Fyf - b * Fry - A.yawDamping * r * clamp(speed / 6, 0, 1);
    // the spin guard: past guardDeg of slide, a pull that turns the nose back toward the travel
    const ab = Math.abs(beta);
    const over = ab - A.guardDeg * DEG;
    if (over > 0 && hand < 0.05 && u > 0) tq += A.spinGuard * I * 40 * over * Math.sign(beta);
    // the drift hold (the "tuned for fun" half of the mixed stance): once the tail is out, a pull toward an angle the
    // player chooses: more throttle = more angle, steering into the bend = more, counter-steering = less (and out).
    // The tires still decide where the car goes; this only keeps the slide from running away or dying by accident.
    if (A.driftHold > 0 && u > 4 && hand < 0.05) {
      const on = sstep(A.holdMinDeg * DEG, (A.holdMinDeg + 7) * DEG, ab) * sstep(A.lowSpeedKmh / 3.6, A.lowSpeedKmh / 3.6 + 5, speed);
      if (on > 0) {
        const sg = Math.sign(beta), into = -sg * this.steerIn;
        const tgt = clamp(A.holdBaseDeg + A.holdThrottleDeg * throttle + A.holdSteerDeg * into, 0, A.guardDeg) * DEG;
        const bdot = (ab - (this.prevAb ?? ab)) / dt;
        tq += -sg * on * A.driftHold * I * (A.holdK * (tgt - ab) - A.holdD * bdot);
      }
    }
    this.prevAb = ab;

    // ---- integrate (world frame for the body, so no rotating-frame terms are needed)
    const fx = sp, fz = cp, lx = cp, lz = -sp;
    // the slope pulls along the road
    const gr = this.track.grade[this.trackI] || 0, ttx = this.track.tx[this.trackI], ttz = this.track.tz[this.trackI];
    this.vx += ((Fx * fx + Fy * lx) / m - G * gr * ttx * 0.9) * dt;
    this.vz += ((Fx * fz + Fy * lz) / m - G * gr * ttz * 0.9) * dt;
    r += tq / I * dt;
    // the car's own frame again, for the cart-like low-speed handling
    u = this.vx * sp + this.vz * cp; w = this.vx * cp - this.vz * sp;
    const low = 1 - sstep(0, A.lowSpeedKmh / 3.6, Math.hypot(u, w));
    if (low > 0) {
      const k = Math.min(1, low * dt * 12);
      r += (u * Math.tan(delta) / L - r) * k;
      w -= w * k;
      if (Math.abs(u) < 0.08 && throttle < 0.02 && drive === 0) { u *= 0.9; if (Math.abs(u) < 0.02) u = 0; }
      this.vx = u * sp + w * cp; this.vz = u * cp - w * sp;
    }
    this.r = r;
    this.psi += r * dt;
    this.x += this.vx * dt; this.z += this.vz * dt;
    this.ax += ((Fx / m) - this.ax) * Math.min(1, dt * 10);
    this.ay += ((Fy / m) - this.ay) * Math.min(1, dt * 8);
    this.u = u; this.w = w; this.speed = Math.hypot(this.vx, this.vz);
    this.alphaF = alphaF; this.alphaR = alphaR;

    // ---- the walls
    this.walls(dt);

    // ---- what the effects and the sound read
    const sideSlideR = Math.abs(rvy) > 1.2 ? clamp((Math.abs(alphaR) - T.peakRearDeg * DEG) / (25 * DEG), 0, 1) : 0;
    this.slipR = Math.max(sideSlideR * clamp(speed / 6, 0, 1), clamp(spin, 0, 1), hand > 0.05 ? clamp(speed / 10, 0, 1) : 0);
    this.slipF = Math.abs(alphaF) > T.peakFrontDeg * DEG * 1.6 ? clamp(speed / 12, 0, 1) * 0.6 : 0;
    // rear wheel surface speed (for the revs): spins up past the road speed when the rears break loose
    const targetWs = hand > 0.05 ? 0 : Math.abs(this.ws);
    this.wheelSpin += (targetWs - this.wheelSpin) * Math.min(1, dt * (hand > 0.05 ? 20 : 10));
    this.wheelRot += (this.reverse ? -1 : 1) * Math.max(this.wheelSpin, Math.abs(u) * 0.5) / C.wheelRadius * dt;
    this.gearbox(dt, throttle);
  }

  gearbox(dt, throttle) {
    const C = this.T.car;
    const toRpm = (g) => this.wheelSpin / C.wheelRadius * C.gears[g - 1] * C.finalDrive * 60 / (2 * Math.PI);
    if (this.reverse) { this.gear = -1; this.rpm += (Math.max(C.idleRpm, toRpm(1)) - this.rpm) * Math.min(1, dt * 8); return; }
    if (this.gear < 1) this.gear = 1;
    let rpm = toRpm(this.gear);
    // a drifting car holds its gear (no upshift mid-slide), as a driver would
    const sliding = Math.abs(this.beta) > 14 * DEG;
    if (rpm > C.shiftUpRpm && this.gear < C.gears.length && (!sliding || rpm > C.redline * 0.985)) { this.gear++; rpm = toRpm(this.gear); this.cut = this.T.gearbox.shiftCut; this.events.push({ type: 'shift', gear: this.gear, up: true, cut: this.T.gearbox.shiftCut }); }
    else if (rpm < C.shiftDownRpm && this.gear > 1) { const lower = toRpm(this.gear - 1); if (lower < C.shiftUpRpm * 0.92) { this.gear--; rpm = lower; this.events.push({ type: 'shift', gear: this.gear, up: false }); } }
    // revs flare with the pedal when the clutch would slip (standing starts, low speed)
    const free = C.idleRpm + throttle * (C.redline - C.idleRpm) * 0.75;
    const target = Math.max(rpm, this.speed < 6 ? free * (1 - this.speed / 6) + rpm * (this.speed / 6) : rpm, C.idleRpm);
    this.rpm += (Math.min(target, C.redline) - this.rpm) * Math.min(1, dt * 14);
  }

  // Walls stand at the road's edge plus a shoulder. The car's footprint across the road comes from its heading
  // relative to the road. A hit bounces and scrubs. Events: 'impact' (damage: where on the car, how hard) for every
  // real knock, and 'wall' (the score's wipe) once per contact: a knock past wipeSpeed, or scraping for scrapeTime.
  walls(dt) {
    const W = this.T.wall, C = this.T.car, tr = this.track;
    const q = this.locate();
    const lim = tr.halfAt(q.i, q.f) + 0.55;
    const rel = this.psi - tr.psi[q.i];
    const ext = Math.abs(C.halfLength * Math.sin(rel)) + Math.abs(C.halfWidth * Math.cos(rel));
    const lx = tr.tz[q.i], lz = -tr.tx[q.i];
    const sp = Math.sin(this.psi), cp = Math.cos(this.psi);
    let touched = false;
    for (const side of [1, -1]) {
      const over = side * q.lat + ext - lim;
      if (over <= 0) continue;
      touched = true;
      this.x -= lx * side * over; this.z -= lz * side * over;   // back onto the road
      const vn = (this.vx * lx + this.vz * lz) * side;          // speed into the wall
      if (vn > 0) {
        const tx = -lz, tz = lx; // along the wall
        let vt = this.vx * tx + this.vz * tz;
        vt *= Math.pow(W.scrub, clamp(vn / 4, 0.15, 1.5));
        const vnOut = -vn * W.restitution;
        this.vx = tx * vt + lx * side * vnOut; this.vz = tz * vt + lz * side * vnOut;
        // the nose glances off: some yaw toward running along the wall, and the spin is damped
        this.r *= 1 - clamp(vn / 10, 0, 0.6);
        this.r += -side * Math.sign(Math.sin(rel)) * clamp(vn, 0, 8) * 0.06 * (Math.abs(Math.sin(rel)) > 0.1 ? 1 : 0);
        // where the wall is, seen from the car (radians from the nose, + to the left)
        const dx = lx * side, dz = lz * side, wallRel = Math.atan2(dx * cp - dz * sp, dx * sp + dz * cp);
        if (vn > 1.0) this.events.push({ type: 'impact', speed: vn, rel: wallRel, side });
        if (vn > W.wipeSpeed && !this.touchFired) { this.events.push({ type: 'wall', speed: vn, side, rel: wallRel }); this.touchFired = true; }
      }
    }
    if (touched) {
      this.noContact = 0; this.scrape += dt;
      if (this.scrape > W.scrapeTime && !this.touchFired) { this.events.push({ type: 'wall', speed: 0.5, side: 0, rel: 0 }); this.touchFired = true; }
      this.contact = 1;
    } else {
      this.noContact += dt; this.contact = 0;
      if (this.noContact > 0.35) { this.scrape = 0; this.touchFired = false; }
    }
    this.locate();
  }

  // world position of a wheel: 0 front left, 1 front right, 2 rear left, 3 rear right
  wheelPos(k, out) {
    const C = this.T.car, L = C.wheelbase, b = L * C.frontWeight, a = L - b;
    const fwd = k < 2 ? a : -b, side = (k % 2 === 0 ? 1 : -1) * 0.8;
    const sp = Math.sin(this.psi), cp = Math.cos(this.psi);
    out[0] = this.x + sp * fwd + cp * side; out[2] = this.z + cp * fwd - sp * side; out[1] = this.y;
    return out;
  }
}
