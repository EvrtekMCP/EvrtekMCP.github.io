// DRIFTLINE: the car. A light bicycle model, no physics engine: two axles, weight that shifts between them under
// throttle and brake, a front tire whose grip peaks and falls away into a slide, rear wheels whose own speed is a
// state (so throttle spins them and spends side grip, which is what holds a drift), a handbrake that locks them, and
// three assists: the counter-steer (front wheels follow the slide), the drift hold (keeps the angle where the player
// asks for it) and the spin guard. Every number comes from the tune (config.js TUNING with the garage's parts and the
// car's damage applied: garage.js deriveTune). Pure JS: the browser and the Node simulator share it.
import { TUNING } from './config.js?v=0.1.23';

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
    this.vRoad = 0; this.shiftT = 9; this.lastUp = true; this.overT = 0; this.slipping = true; this.launchT = 0; this.held = false; // the gearbox (gearbox() below; slipping, launchT: the launch clutch)
    this.intent = 0; this.liftT = 9; this.turnT = 0; this.bigT = 0; this.flickT = 9; this.flickSide = 0; this.calmT = 0; this.grip = 0; // launch grip (step)
    this.aid = 0; this.gm = 0; // 11-25: the straight aid and the steering's grip mode (step)
    this.spin = 0; this.slipF = 0; this.slipR = 0; this.alphaF = 0; this.alphaR = 0;
    this.loadF = 0.5; this.wheelRot = 0; this.boost = 0; this.nosOn = false;
    this.hint = -1; this.contact = 0; this.scrape = 0; this.noContact = 1; this.touchFired = false;
    this.grazeFired = false; this.wallPeak = 0; // 11-19: this contact forgiven so far; its hardest step (walls())
    this.kissFired = false; this.kisses = 0; // 11-25: this contact a wall kiss already; the kisses so far (the score pays from it)
    this.touch = { closing: 0, into: 0, angle: 0, part: 'side', side: 0, rel: 0, x: 0, z: 0, hit: false };
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
    // 11-25 (Evrtek: "when you are driving straight aways, it seems that even the slightest tap of the steering wheel
    // can cause you to start a drift/skid"): the steering's grip mode. At speed, while no drift is asked for (last
    // step's ask, below), the keys ramp slower (steer.keyGripShare of their rate) and the first part of the wheel
    // gives less (steer.centreGain near the middle, rising to all of it at full lock: full lock is unchanged), so a tap
    // is a nudge. Any ask (the handbrake, the kick, the flick, a big steer) puts the steering back as it was, smoothly
    // (steer.modeLag), so every drift steers exactly as before. straightAid 0 is the steering before 11-25.
    const SA = A.straightAid || 0;
    const gmWant = SA > 0 ? Math.min(1, SA) * sstep(S.gripFromKmh, S.gripFullKmh, kmh) * (1 - (this.intent || 0)) : 0;
    this.gm = (this.gm ?? gmWant) + (gmWant - (this.gm ?? gmWant)) * Math.min(1, dt / Math.max(dt, S.modeLag || 0.15));
    if (inp.analog) this.steerIn += (target - this.steerIn) * Math.min(1, dt * 18);
    else {
      const toward = target !== 0 && (Math.sign(target) === Math.sign(this.steerIn) || this.steerIn === 0);
      const rate = (toward ? S.rate * (1 - this.gm * (1 - (S.keyGripShare ?? 1))) : S.returnRate) * dt;
      this.steerIn += clamp(target - this.steerIn, -rate, rate);
    }
    const range = (S.highSpeedDeg + (S.maxDeg - S.highSpeedDeg) / (1 + (kmh / S.highSpeedKmh) ** 2)) * DEG;
    // the response curve: x (c + (1 - c) x^2), c = 1 straight, c = centreGain in full grip mode; 1 at full lock. It is
    // for thumbs (like the stick's dead zone): the test driver and the rival (inp.ai) steer straight, as before; with it
    // their fixed-gain line-following lost a ninth of their sweet-spot time, which measures them, not a player
    const cg = inp.ai ? 1 : 1 - this.gm * (1 - (S.centreGain ?? 1)), wheel = this.steerIn * (cg + (1 - cg) * this.steerIn * this.steerIn);
    const beta = speed > 0.5 ? Math.atan2(w, Math.abs(u)) : 0;   // the slide angle: + when travel is left of the nose
    this.beta = u >= 0 ? beta : 0;
    const assistFade = sstep(A.lowSpeedKmh, A.lowSpeedKmh + 15, kmh) * (u > 0 ? 1 : 0);
    const assist = S.counterAssist * clamp(beta, -S.counterMaxDeg * DEG, S.counterMaxDeg * DEG) * assistFade;
    // a bent front corner pulls the wheel a little toward it (garage.js; capped at damage.steerPullDeg)
    const pull = (S.pullDeg || 0) * DEG * clamp(speed / 10, 0, 1);
    const delta = clamp(wheel * range + assist + pull, -S.lockDeg * DEG, S.lockDeg * DEG);
    this.delta = delta;

    // ---- pedals, with reverse when stopped and holding brake
    // 11-19 (2) inp.hold: held on the line for the countdown (main.js). The brakes and the lever hold the car, in first
    // with the clutch down; the gas only revs the engine (gearbox(): the launch clutch). Before, the countdown braked the
    // car into reverse (R on the HUD) and pulled its revs toward idle + 5,200 x the pedal against the reverse's idle.
    const held = !!inp.hold, pedal = clamp(inp.throttle || 0, 0, 1);
    let throttle = held ? 0 : pedal, brake = held ? 1 : clamp(inp.brake || 0, 0, 1);
    const hand = held ? 1 : clamp(inp.handbrake || 0, 0, 1);
    if (held) { this.reverse = false; if (this.gear < 1) this.gear = 1; }
    if (this.reverse) { if (throttle > 0.05 || brake < 0.05) { if (u > -0.5) this.reverse = false; } }
    if (!held && !this.reverse && brake > 0.3 && throttle < 0.05 && u < 0.6 && u > -0.5) this.reverse = true;
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

    // ---- 11-17 (2) launch grip (Evrtek on test v11: "too loose off the starting line, a small touch even at slow
    // speeds seems to want to spin you out"). The cause: the gas on a phone (and a key) is all or nothing, and flat out
    // below about 100 km/h every car but ORBIT has more drive than its rear tyres can hold, so the rear wheels spun
    // at up to six times the road speed (KESTREL's at 122 km/h with the car at 20), the rears had almost no side grip
    // left, and any touch of the wheel swung the tail; past 9 degrees the drift hold took the slide to its full-throttle
    // angle. Now a drift is a choice, as in an arcade drift game: below drift speed a traction control holds the
    // rear wheels' spin under their peak and the drift hold waits, unless the player has asked for a slide: the
    // handbrake, a stab of the gas with the wheel held turned (the clutch kick), a flick of the wheel one way and the
    // other, or a big steer at speed. The ask lasts while the car slides, and fades soon after it
    // straightens. Both the help and the ask fade out with speed (gripFullKmh .. gripOffKmh), so at drift speed and
    // in every chosen drift the car is exactly what it was. launchGrip 0 (the tuning panel's switch) is the old feel.
    // 11-25: the straight aid (sa), the launch grip's help carried to every speed, but only while the player is not
    // asking for a drift: no ask (the same asks), the wheel under assist.aidSteer (all the player's by aidSteerOff), and
    // the car near straight (it lets go from aidSlipDeg of slide, gone by aidSlipOffDeg: past that the slide is the
    // player's). The cause it answers: flat out (a phone's GAS, a key's W) the HALBERD, SPECTRE and ZENITH, and any car
    // with its engine built, spin their rear wheels at 3 to 9 times the tyre's peak slip from 80 to 140 km/h, where the
    // launch grip has faded, so the rears have almost no side grip left, and the smallest steer swings the tail; past
    // 9 degrees the drift hold takes it to a full drift. Its traction control bites only once the rear tyres begin to
    // slip sideways (assist.aidBiteDeg of rear slip angle), so a dead-straight run accelerates exactly as before (to
    // hold the wheels on a straight too cost 0.4-0.7 s of 0-100 and up to 1.3 s of 60-140).
    const LG = A.launchGrip || 0, ab0 = Math.abs(this.beta);
    let grip = 0, sa = 0;
    if (LG > 0 || SA > 0) {
      const st = Math.abs(this.steerIn), cart = A.lowSpeedKmh;
      this.liftT = throttle < 0.25 ? 0 : (this.liftT ?? 9) + dt;      // time since the gas was last off
      this.turnT = st >= A.kickSteer ? (this.turnT ?? 0) + dt : 0;        // time the wheel has been held turned
      if (hand > 0.05 && kmh > cart) this.intent = 1;                     // the handbrake (not the line's hold)
      // the stab: the gas from off to flat quickly, with the wheel held turned (a key tap or a small touch never is)
      if (throttle > 0.75 && this.liftT < A.kickRise && this.turnT >= A.kickHold && kmh >= A.kickKmh) this.intent = 1;
      // the flick: the wheel past flickSteer one way, then the other, within flickGap s
      if (st >= A.flickSteer) {
        const side = Math.sign(this.steerIn);
        if (this.flickSide && side !== this.flickSide && this.flickT < A.flickGap && kmh >= A.kickKmh) this.intent = 1;
        this.flickSide = side; this.flickT = 0;
      } else this.flickT = (this.flickT ?? 9) + dt;
      // a big steer held at speed (on the gas a power-over, off it a lift-off): asked for once the tail is out under it
      this.bigT = st >= A.powerSteer ? (this.bigT ?? 0) + dt : 0;
      const power = this.bigT >= A.kickHold ? sstep(A.powerSteer, 0.95, st) * sstep(A.kickKmh, A.kickKmh + 20, kmh) : 0;
      if (power > 0.5 && ab0 > A.holdMinDeg * DEG) this.intent = 1;
      // the ask lasts while the car slides (or the lever is pulled) and fades intentFade s after it straightens
      this.calmT = ab0 > A.intentDeg * DEG || hand > 0.05 ? 0 : (this.calmT ?? 0) + dt;
      if (this.calmT > A.intentKeep || kmh < cart) this.intent = Math.max(0, (this.intent || 0) - dt / A.intentFade);
      grip = LG * (1 - sstep(A.gripFullKmh, Math.max(A.gripOffKmh, A.gripFullKmh + 1), kmh)) * (1 - (this.intent || 0)) * (1 - power);
      if (SA > 0) sa = Math.min(1, SA) * (1 - (this.intent || 0)) * (1 - power)
        * (1 - sstep(A.aidSteer, Math.max(A.aidSteerOff, A.aidSteer + 0.01), st))
        * (1 - sstep(A.aidSlipDeg * DEG, Math.max(A.aidSlipOffDeg, A.aidSlipDeg + 0.1) * DEG, ab0));
    }
    this.grip = grip; this.aid = sa;

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
      // 11-17 (2) the traction control (launch grip above): the wheels' spin held under tcSlip of the peak slip ratio,
      // so the rears keep their side grip; the engine's torque is what gives way
      // 11-25 and the straight aid's, the same hold, biting as the rear tyres begin to slip sideways (sa above)
      const tc = sa > 0 ? Math.max(grip, sa * sstep(0, A.aidBiteDeg * DEG, Math.abs(alphaR))) : grip;
      if (tc > 0) { const wsMax = rvx + vden * kP * A.tcSlip; if (this.ws > wsMax) this.ws -= (this.ws - wsMax) * tc; }
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
        // 11-17 (2): a slide nobody asked for, below drift speed, is held toward straight, not toward a drift's angle
        // (launch grip above: grip is 0 in any chosen drift and at drift speed, so there the target is as it was)
        // (11-25: and the straight aid's, which has let go by aidSlipOffDeg, so in practice only a slide it has not yet released)
        const tgt = clamp(A.holdBaseDeg + A.holdThrottleDeg * throttle + A.holdSteerDeg * into, 0, A.guardDeg) * DEG * (1 - Math.max(grip, sa));
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
    if (held) this.throttle = pedal; // what the sound and the HUD read: the pedal revving the held engine
    this.held = held; // 11-21: the launch clutch's bite counts from the moment the car is let go
    this.gearbox(dt, held ? pedal : throttle);
  }

  // The automatic. 11-17 (Evrtek: "the gears keep jumping up and down gears while the gas is down"): it used to choose
  // from the rear wheels' own speed, which swings with every slide, and with no pause between shifts: a standing start
  // spun the wheels past the change-up, the shift's cut slowed them, it changed down, and again, five times a second;
  // every handbrake pull stopped the wheels and dropped it to first, and letting go climbed back. Now it chooses from
  // the road speed (smoothed), as a good automatic does; the revs you see and hear still follow the wheels in a slide.
  //   up:   at shiftUpRpm of road speed. Not mid-slide (a drifting car holds its gear), unless the engine has sat on
  //         the redline a moment and the road speed would carry the next gear (so no kickdown follows).
  //   down: off the gas, under shiftDownRpm, straight to the gear that fits the speed. On the gas, in a slide or off
  //         it, only once the speed has dragged the revs under bogShare of the redline (a kickdown), to a gear a little
  //         over that line.
  //   never under the handbrake (the engine is clutched out), never two shifts within minGap s, never the other way
  //   within reverseGap s. A car's shiftUp and shiftDown sit far enough apart that a change lands well inside them.
  gearbox(dt, throttle) {
    const C = this.T.car, B = this.T.gearbox, k = 60 / (2 * Math.PI) * C.finalDrive / C.wheelRadius;
    const toRpm = (g) => this.wheelSpin * C.gears[g - 1] * k;   // the engine, turned by the rear wheels (flares in a slide)
    this.vRoad += (this.speed - this.vRoad) * Math.min(1, dt / B.smooth);
    const road = (g) => this.vRoad * C.gears[g - 1] * k;        // the same gear at the road's speed: what the box reads
    this.shiftT += dt;
    if (this.reverse) { this.gear = -1; this.rpm += (Math.max(C.idleRpm, toRpm(1)) - this.rpm) * Math.min(1, dt * 8); return; }
    if (this.gear < 1) this.gear = 1;
    const g = this.gear, bog = C.redline * B.bogShare, sliding = Math.abs(this.beta) > B.slideDeg * DEG;
    this.overT = toRpm(g) >= C.redline * B.overRev ? this.overT + dt : 0;
    const way = (up) => this.lastUp === up || this.shiftT >= B.reverseGap;
    // off the redline only while the car is not slowing (a slide scrubbing speed would kick it straight back down),
    // and only into a gear the road speed carries well clear of the kickdown line
    const overRev = this.overT > 0.25 && this.speed > this.vRoad - 0.25 && g < C.gears.length && road(g + 1) >= bog * 1.15;
    let to = g;
    if (this.handbrake < 0.05 && this.shiftT >= B.minGap) {
      if (g < C.gears.length && way(true) && ((!sliding && road(g) >= C.shiftUpRpm) || overRev)) to = g + 1;
      else if (g > 1 && way(false)) {
        // off the gas it lands at shiftDownRpm or more; a kickdown in the next gear that clears the bog line (the
        // wheels will spin it up anyway), so neither lands near the change-up, nor a kickdown under an over-rev change
        const gas = throttle > B.onThrottle || sliding, land = gas ? bog * 1.1 : C.shiftDownRpm;
        if (road(g) < (gas ? bog : C.shiftDownRpm)) { to = 1; for (let h = g - 1; h > 1; h--) if (road(h) >= land) { to = h; break; } }
      }
    }
    if (to !== g) {
      const up = to > g; this.gear = to; this.shiftT = 0; this.lastUp = up; this.overT = 0;
      if (up) { this.cut = B.shiftCut; this.events.push({ type: 'shift', gear: to, up: true, cut: B.shiftCut }); }
      else this.events.push({ type: 'shift', gear: to, up: false });
    }
    // 11-19 (2) the launch clutch (Evrtek on test v16: "the weird sound on the car launch after the countdown is still
    // there"). Before, the revs flared with the pedal under 6 m/s (about 5,300 just after GO) and were blended down to
    // the wheels' revs by 22 km/h (2,330 at full throttle): a flare, then a long sag, that the tach, every engine sound
    // and the turbo followed. Now the clutch slips as a driver's does on a launch. From near a standstill (the road
    // turning the engine under its idle in this gear) the revs go with the pedal to the car's launch rpm (car.launchRpm,
    // about its torque peak) and hold there, leaning up a little (launchLean) as the car gathers speed, while the
    // wheels' revs climb to meet them; where they meet the clutch is home (a soft knee, no step) and the revs pull with
    // the wheels. Off the gas they idle. Held on the line (the countdown) the clutch is down: the same launch revs.
    // 11-21 (Evrtek on test v17: "we need to deal with the audio on the car launch, it's still doing that thing"): the
    // revs no longer HOLD on the slipping clutch. 11-19's held them near the launch rpm for 2.2-3.0 s (the KESTREL 3,400
    // to 3,790 in 2.4 s, under a semitone a second): a steady note, a drone. Now, as a launch goes: held on the line at
    // the launch rpm; let go, the clutch takes up at once and BITES at launchBite s, the revs dipping steadily by
    // launchDip on the way, then climbing with the road speed (launchLean of the wheels' revs) until the
    // wheels meet them where 11-19's met (launchRpm x (1 - dip) / (1 - lean), 1.11 x the launch rpm, so the clutch is
    // home about when it was), and pulling with the wheels. From GO the note always moves: down into the bite, then up.
    const wheel = toRpm(this.gear), K = 140;
    if (this.speed * C.gears[Math.max(0, this.gear - 1)] * k < C.idleRpm) this.slipping = true;
    if (!this.slipping || this.held) this.launchT = 0; else if (throttle > 0.05 || this.launchT > 0) this.launchT += dt;
    let target = wheel;
    if (this.slipping) {
      const dip = (C.launchDip || 0) * Math.min(1, this.launchT / (C.launchBite || 0.6)); // the revs' follower below rounds its corners
      const slipTo = C.idleRpm + throttle * ((C.launchRpm || C.redline * 0.5) * (1 - dip) - C.idleRpm + (C.launchLean || 0) * wheel), x = (wheel - slipTo) / K;
      target = slipTo + K * (x > 30 ? x : Math.log1p(Math.exp(x))); // the larger of the two, rounded at the meeting
      if (x > 3) this.slipping = false;
    }
    target = Math.max(target, C.idleRpm);
    // 11-17: past the change-up the revs ease toward a ceiling halfway to the redline rather than pin on it. With the
    // gear held in a slide the spinning wheels would put the engine on the redline for much of a lap, and the sound
    // module plays its rev-limiter stutter there. The power band and the boost are full up here either way.
    const knee = C.shiftUpRpm, room = (C.redline - knee) / 2;
    if (target > knee) target = knee + room * (1 - Math.exp(-(target - knee) / room));
    this.rpm += (target - this.rpm) * Math.min(1, dt * 14);
  }

  // Walls stand at the road's edge plus a shoulder. The car's footprint across the road comes from its heading
  // relative to the road. A knock bounces and scrubs. Events: 'impact' (damage: where on the car, how hard) for every
  // real knock, and once per contact either 'wall' (a hit: the score's wipe) or 'graze' (a touch that is forgiven).
  // 11-19 (Evrtek: "if you graze the wall gently, then I don't want that to be a punishment"): every step of a contact
  // is measured (contactAt) and judged (judge). A HIT: the corner meeting the wall closes on it faster than
  // wall.grazeSpeed, or it is a front corner with the nose turned in past wall.noseDeg (a nose-in is an oops at any
  // speed). Anything softer is a GRAZE. A contact lasts until the car has been off the wall 0.35 s, and it stays a graze
  // only while every step of it does: a brush that turns into a slap is a hit. A long scrape is a run of grazes, never
  // a hit by its length (it pays nothing while it lasts: scoring.js). wall.grazes 0 is the rule before 11-19: any knock
  // past wipeSpeed, or scrapeTime of scraping, wipes.
  walls(dt) {
    const W = this.T.wall, C = this.T.car, tr = this.track;
    const q = this.locate(), qi = q.i, qf = q.f, qlat = q.lat; // copied: contactAt's look-ups reuse the track's q
    const lim = tr.halfAt(qi, qf) + 0.55;
    const rel = this.psi - tr.psi[qi];
    const ext = Math.abs(C.halfLength * Math.sin(rel)) + Math.abs(C.halfWidth * Math.cos(rel));
    const lx = tr.tz[qi], lz = -tr.tx[qi];
    const sp = Math.sin(this.psi), cp = Math.cos(this.psi);
    const judging = W.grazes > 0;
    let touched = false;
    for (const side of [1, -1]) {
      const over = side * qlat + ext - lim;
      if (over <= 0) continue;
      touched = true;
      // where the wall is, seen from the car (radians from the nose, + to the left)
      const dx = lx * side, dz = lz * side, wallRel = Math.atan2(dx * cp - dz * sp, dx * sp + dz * cp);
      const c = this.contactAt(side, rel, wallRel);           // measured before the bounce changes anything
      if (judging) this.judge(c);
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
        // a knock in a contact still forgiven is a graze's (main.js: no damage, the light scrape)
        if (vn > 1.0) this.events.push({ type: 'impact', speed: vn, rel: wallRel, side, graze: judging && !this.touchFired, x: c.x, z: c.z });
        if (!judging && vn > W.wipeSpeed && !this.touchFired) { this.events.push({ type: 'wall', speed: vn, side, rel: wallRel }); this.touchFired = true; }
      }
    }
    if (touched) {
      this.noContact = 0; this.scrape += dt;
      if (!judging && this.scrape > W.scrapeTime && !this.touchFired) { this.events.push({ type: 'wall', speed: 0.5, side: 0, rel: 0 }); this.touchFired = true; }
      this.contact = 1;
    } else {
      this.noContact += dt; this.contact = 0;
      if (this.noContact > 0.35) { this.scrape = 0; this.touchFired = false; this.grazeFired = false; this.kissFired = false; this.wallPeak = 0; }
    }
    this.locate();
  }

  // 11-19: one step of a wall contact, measured (this.touch, reused). The corner of the footprint deepest into this
  // wall (the end of the car and the side of it turned toward the wall), the wall's normal where that corner is, and
  // how fast the corner is closing on it: the body's velocity plus its spin at that corner (v + omega x r), so a tail
  // swinging in counts as much as a slide. In a steady drift round a bend every point of the car moves along the wall,
  // which is why the normal is taken at the corner's own place on the road, not at the car's middle. Also: the body's
  // own speed into the wall (no spin), its angle to the wall (0 = parallel) and the part that meets it: 'side' within
  // wall.noseDeg of parallel (the flank lies along the wall), otherwise the 'front' or the 'rear' corner.
  contactAt(side, rel, wallRel) {
    const C = this.T.car, tr = this.track, t = this.touch;
    const sr = Math.sin(rel), cr = Math.cos(rel), sp = Math.sin(this.psi), cp = Math.cos(this.psi);
    const fx = side * sr >= 0 ? C.halfLength : -C.halfLength, ly = side * cr >= 0 ? C.halfWidth : -C.halfWidth;
    // the corner's offset from the middle (forward (sp, cp), left (cp, -sp)), and its velocity
    const ox = fx * sp + ly * cp, oz = fx * cp - ly * sp;
    const vx = this.vx + this.r * (fx * cp - ly * sp), vz = this.vz - this.r * (fx * sp + ly * cp);
    const k = tr.closest(this.x + ox, this.z + oz, this.hint).i;
    const nx = tr.tz[k] * side, nz = -tr.tx[k] * side;          // into this wall, where the corner is
    t.closing = Math.max(0, vx * nx + vz * nz);
    t.into = Math.max(0, this.vx * nx + this.vz * nz);
    t.angle = Math.atan2(Math.abs(sr), Math.abs(cr)) / DEG;
    // 11-25 the wall kiss: the flank is the side within noseDeg of parallel, or with the tail end in, within kissDeg (a
    // nose turned in past noseDeg is still the front corner); and the flank's own closing speed, its middle's (the body's
    // velocity there plus the spin's, which along a flat flank is small), with the wall's normal where the middle is
    const W = this.T.wall, flankDeg = fx < 0 && W.kisses > 0 ? Math.max(W.noseDeg, W.kissDeg) : W.noseDeg;
    t.part = t.angle <= flankDeg ? 'side' : fx > 0 ? 'front' : 'rear';
    if (W.kisses > 0) {
      const mvx = this.vx - this.r * ly * sp, mvz = this.vz - this.r * ly * cp;
      const km = tr.closest(this.x + ly * cp, this.z - ly * sp, this.hint).i;
      t.flank = Math.max(0, (mvx * tr.tz[km] - mvz * tr.tx[km]) * side);
    } else t.flank = t.closing;
    t.side = side; t.rel = wallRel; t.x = this.x + ox; t.z = this.z + oz; t.hit = false; t.kiss = false;
    return t;
  }
  // 11-19: graze or hit, once per contact (walls() above). A hit fires 'wall' (as every touch did before); the first
  // forgiven step fires 'graze'. After a hit the contact stays one (touchFired) until the car is off the wall.
  // 11-25 (Evrtek: "If you manage to get your car to touch a wall close to perfectly sideways so the impact is very
  // light, that should not reset your drift, it should count as a wall kiss"): with wall.kisses on, the flank (contactAt:
  // the side lying along the wall) is judged on its own middle's closing speed against wall.kissSpeed, a looser line than
  // the corners' grazeSpeed. The cause: a flank meeting the wall flat was judged at its far corner, 2.2 m from the
  // middle, where the car's own turning added 2-3 m/s (median) to a body coming in at 0.2-1.1 m/s, so 302 of the 437
  // flank contacts that came in at 3 m/s or less wiped the chain (tools/walls.mjs, 11-25). Under the line it is a WALL
  // KISS: the chain and its multiplier kept, once per contact a 'kiss' event, and this.kisses counted, which the score
  // pays from (scoring.js, wall.kissPoints). The corners keep 11-19's rule; a nose in past noseDeg is a hit at any speed.
  judge(c) {
    const W = this.T.wall, flank = W.kisses > 0 && c.part === 'side';
    const speed = flank ? c.flank : c.closing;
    c.hit = flank ? speed > W.kissSpeed : speed > W.grazeSpeed || c.part === 'front';
    c.kiss = flank && !c.hit;
    this.wallPeak = Math.max(this.wallPeak, speed);
    if (this.touchFired) return;
    const e = { type: c.hit ? 'wall' : 'graze', speed, side: c.side, rel: c.rel, part: c.part, angle: c.angle, x: c.x, z: c.z };
    if (c.hit) { e.grazed = this.grazeFired || this.kissFired; this.events.push(e); this.touchFired = true; }
    else if (c.kiss) { if (!this.kissFired) { e.type = 'kiss'; this.events.push(e); this.kissFired = true; this.kisses = (this.kisses || 0) + 1; } }
    else if (!this.grazeFired) { this.events.push(e); this.grazeFired = true; }
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
