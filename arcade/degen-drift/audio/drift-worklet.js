// DRIFTLINE: the car's own sound, synthesised in real time (in house, per car and per upgrade; Evrtek via Dirigent,
// 11-15). One AudioWorklet processor, 'drift-car', with two outputs: [0] the engine (mono), [1] tyres, road and
// wind (stereo). The same file loads in Node (tools/sound/render.mjs renders the demo WAVs with exactly this code)
// and on the page's main thread for the ScriptProcessor fallback; it only registers the processor inside a worklet.
//
// THE ENGINE is a small physical model, not an oscillator:
//   crank angle -> each cylinder fires at its own angle in the 720-degree cycle (firing order, per-cylinder weight,
//   cycle-to-cycle variation in strength and timing, the odd misfire at a lumpy idle)
//   -> an exhaust pressure pulse shaped in crank degrees (sharp and gritty on throttle, soft and breathy off it) plus
//   turbulence noise riding on it -> one waveguide per exhaust bank (the header: a delay line whose length is the
//   pipe's, reflecting at the collector) -> soft saturation (grit, by load) -> the mid pipe (another waveguide)
//   with afterfire pops injected -> the muffler (low-pass plus a straight-through share, a chamber resonance)
//   -> a rasp shelf and the tailpipe's radiation high-pass.
//   In parallel: the intake (suction pulses through an airbox and a runner resonance, induction hiss by airflow),
//   the valvetrain tick, and the turbo (boost and shaft speed with lag, whine by shaft speed, intake whoosh by
//   boost, a blow-off valve or compressor flutter on lift). The rev limiter and the shift cut are ignition cuts,
//   which is where the pops come from. Chase and interior are two mixes of the same parts: inside, the exhaust
//   comes through the body (low-passed) with a cabin boom, and the intake and the mechanicals are closer.
// THE TYRES: two squeal voices (the rear pair, a little detuned) of tone plus noise through narrow resonances at the
//   squeal pitch and an overtone, chirping in bursts at the edge of grip and filling in to a warbling screech;
//   a regrip chirp when a slide lets go; a front-tyre groan for understeer; rolling roar; kerb thumps at the
//   stripe rate; gravel as a spray of grains; wind by speed squared.
(function (G) {
  'use strict';
  const TAU = Math.PI * 2, DN = 1e-24, TN = 1024;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const dbg = (db) => Math.pow(10, db / 20);
  const softclip = (x) => (x > 3 ? 1 : x < -3 ? -1 : (x * (27 + x * x)) / (27 + 9 * x * x)); // tanh, Pade
  const C_HEADER = 520, C_PIPE = 480; // m/s in hot exhaust
  const PRE = 0.45; // scales the header pressure into the saturation, so drive 1 just reaches it at full load

  class Rng {
    constructor(seed) { this.s = (seed >>> 0) || 0x9e3779b9; }
    u() { let x = this.s; x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; this.s = x; return x / 4294967296; }
    b() { return this.u() * 2 - 1; }
    g() { return (this.u() + this.u() + this.u() - 1.5) * 2; } // about gaussian, sigma 1
  }

  // RBJ biquad, transposed direct form II
  class Biquad {
    constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.z1 = 0; this.z2 = 0; this.f = -1; this.q = -1; this.g = -99; }
    set(type, f, q, db, fs) {
      if (f === this.f && q === this.q && db === this.g) return;
      this.f = f; this.q = q; this.g = db;
      f = clamp(f, 10, fs * 0.45);
      const w = TAU * f / fs, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q), A = Math.pow(10, (db || 0) / 40);
      let b0, b1, b2, a0, a1, a2;
      if (type === 'lp') { b1 = 1 - cw; b0 = b2 = b1 / 2; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
      else if (type === 'hp') { b1 = -(1 + cw); b0 = b2 = (1 + cw) / 2; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
      else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
      else if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; }
      else { // high shelf
        const s2 = 2 * Math.sqrt(A) * al;
        b0 = A * ((A + 1) + (A - 1) * cw + s2); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - s2);
        a0 = (A + 1) - (A - 1) * cw + s2; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - s2;
      }
      this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    }
    run(x) { const y = this.b0 * x + this.z1; this.z1 = this.b1 * x - this.a1 * y + this.z2; this.z2 = this.b2 * x - this.a2 * y; return y; }
  }
  class OnePole { // low-pass, with the matching high-pass as x - lp
    constructor() { this.k = 1; this.y = 0; }
    set(f, fs) { this.k = 1 - Math.exp(-TAU * f / fs); }
    lp(x) { this.y += this.k * (x - this.y); return this.y; }
    hp(x) { this.y += this.k * (x - this.y); return x - this.y; }
  }
  class Delay {
    constructor(n) { let s = 2; while (s < n + 4) s <<= 1; this.b = new Float32Array(s); this.m = s - 1; this.w = 0; }
    write(x) { this.b[this.w] = x; this.w = (this.w + 1) & this.m; }
    read(d) { const i = d | 0, f = d - i, a = this.b[(this.w - i) & this.m], c = this.b[(this.w - i - 1) & this.m]; return a + (c - a) * f; }
  }

  // An exhaust pulse in crank degrees: a smooth fast rise, an exponential fall, tapered to zero by lengthDeg, minus a
  // broad rarefaction lobe so it carries no DC. Peak 1. env is the plain positive shape (turbulence rides on it).
  function pulseTable(attack, decay, length) {
    const raw = new Float64Array(TN + 2), bump = new Float64Array(TN + 2);
    let sum = 0, sumB = 0;
    for (let i = 0; i <= TN + 1; i++) {
      const x = Math.min(1, i / TN), phi = x * length;
      let g = Math.pow(1 - Math.exp(-phi / attack), 2) * Math.exp(-phi / decay);
      if (x > 0.7) g *= 0.5 + 0.5 * Math.cos(Math.PI * (x - 0.7) / 0.3);
      raw[i] = g; sum += g;
      const b = Math.pow(Math.sin(Math.PI * x), 2); bump[i] = b; sumB += b;
    }
    const m = sum / sumB, t = new Float32Array(TN + 2), env = new Float32Array(TN + 2);
    let pk = 0, pe = 0;
    for (let i = 0; i <= TN + 1; i++) { t[i] = raw[i] - m * bump[i]; pk = Math.max(pk, Math.abs(t[i])); pe = Math.max(pe, raw[i]); }
    for (let i = 0; i <= TN + 1; i++) { t[i] /= pk; env[i] = raw[i] / pe; }
    t[TN] = t[TN + 1] = 0; env[TN] = env[TN + 1] = 0;
    return { t, env };
  }

  const DEFAULT_ENGINE = {
    firing: { events: [0, 120, 240, 360, 480, 600], banks: [0, 1, 0, 1, 0, 1], weights: [1, 1, 1, 1, 1, 1] }, cylinders: 6, displacement: 3,
    idleRpm: 850, redlineRpm: 7600, limiterRpm: 7650, limiterCutMs: 55,
    pulse: { attackOn: 4.5, attackOff: 10, decayOn: 26, decayOff: 42, lengthDeg: 170, noiseOn: 0.22, noiseOff: 0.38 },
    ccv: { on: 0.04, off: 0.18, idle: 0.07 }, jitterDeg: 1, lump: 0.05, miss: 0.015, levels: { idle: 0.36, off: 0.16 },
    header: { lengthM: [0.86, 0.92], reflect: -0.55, lossHz: 3400 }, pipe: { lengthM: 1.85, reflect: -0.45, lossHz: 2300 },
    muffler: { hz: 900, q: 0.75, bypass: 0.22, chamberHz: 95, chamberDb: 3 }, raspDb: 1.5, radHz: 90, drive: 1.3,
    intake: { gain: 0.45, helmHz: 190, helmQ: 3, runnerHz: 560, runnerQ: 5, hiss: 0.22, offsetDeg: 380 },
    mech: { tick: 0.35, tickHz: 4000, whineOrder: 0, whine: 0 }, pops: { amount: 0.18, minRpm: 3000, gain: 0.9 },
    turbo: { on: false, spool: 0.6, spoolRpm: 2800, fullRpm: 5000, whineLo: 1300, whineHi: 5000, whine: 0.3, hiss: 0.28, bov: 'bov', bovGain: 0.6 },
    interior: { lpHz: 800, boomHz: 100, boomDb: 5, exhaust: 0.55, intake: 0.85, mech: 0.6, turbo: 0.8 },
    mix: { exhaust: 1, intake: 0.32, mech: 0.22, turbo: 0.9 }, gain: 1,
  };

  class Engine {
    constructor(fs, rng) {
      this.fs = fs; this.r = rng;
      this.ex = []; this.inp = [];
      for (let i = 0; i < 16; i++) { this.ex.push({ on: false, phi: 0, amp: 0, bank: 0, s: 0 }); this.inp.push({ on: false, phi: 0, amp: 0 }); }
      this.exI = 0; this.inI = 0;
      this.hd = [new Delay(fs * 0.012), new Delay(fs * 0.012)]; this.hl = [0, 0];
      this.pd = new Delay(fs * 0.02); this.pl = 0;
      this.muf = new Biquad(); this.chamber = new Biquad(); this.rasp = new Biquad(); this.rad = new OnePole();
      this.helm = new Biquad(); this.runner = new Biquad(); this.ihiss = new Biquad();
      this.tickBp = new Biquad(); this.tickEnv = 0;
      this.tw = new Biquad(); this.twPh = 0; this.twF = 1500; this.twAmp = 0; this.whAmp = 0; this.whoosh = new OnePole();
      this.bovBp = new Biquad(); this.bovEnv = 0; this.bovF = 3000; this.chPh = 0; this.chF = 20; this.bovKind = 0;
      this.body = new Biquad(); this.boom = new Biquad(); this.dc = new OnePole(); this.tn = new OnePole();
      this.popQ = new Float64Array(12); this.popA = new Float32Array(12); this.popN = 0;
      this.popEnv = 0; this.thEnv = 0; this.thPh = 0; this.pops = 0;
      this.psi = 0; this.next = 0; this.nextAbs = 0;
      this.rpm = 900; this.load = 0; this.ig = 1; this.igT = 1; this.thr = 0; this.armed = false; this.tLift = 9;
      this.boost = 0; this.shaft = 0; this.limOn = false; this.limRpm = 0; this.limCut = 0; this.shiftCut = 0;
      this.wob = 0; this.huntPh = 0; this.view = 0; this.nos = 0;
      this.tnL = new OnePole(); this.tnL.set(5500, fs);
      this.dc.set(18, fs); this.tn.set(300, fs); this.whoosh.set(2500, fs);
      this.kR = 1 - Math.exp(-1 / (0.018 * fs)); this.kL = 1 - Math.exp(-1 / (0.03 * fs)); this.kI = 1 - Math.exp(-1 / (0.004 * fs));
      this.meter = { boost: 0, limiter: 0, pops: 0, rpm: 0 };
      this.configure(DEFAULT_ENGINE);
    }

    configure(p) {
      const fs = this.fs;
      p = Object.assign({}, DEFAULT_ENGINE, p);
      for (const k of ['pulse', 'ccv', 'levels', 'header', 'pipe', 'muffler', 'intake', 'mech', 'pops', 'turbo', 'interior', 'mix', 'firing']) p[k] = Object.assign({}, DEFAULT_ENGINE[k], p[k]);
      this.p = p;
      // firing, sorted by angle
      const f = p.firing, ev = f.events.map((a, i) => ({ a: ((a % 720) + 720) % 720, bank: (f.banks && f.banks[i]) | 0, w: (f.weights && f.weights[i]) || 1 }));
      ev.sort((x, y) => x.a - y.a);
      this.evA = ev.map((e) => e.a); this.evB = ev.map((e) => e.bank); this.evW = ev.map((e) => e.w); this.nEv = ev.length;
      this.banks = Math.max(...this.evB) + 1;
      this.next = 0; while (this.next < this.nEv && this.evA[this.next] < this.psi) this.next++;
      if (this.next >= this.nEv) { this.next = 0; this.nextAbs = this.evA[0] + 720; } else this.nextAbs = this.evA[this.next];
      // pulses: bigger cylinders make fatter, longer pulses
      const per = (p.displacement || 2) / Math.max(1, p.cylinders || this.nEv), fat = clamp(0.85 + 0.3 * per, 0.8, 1.3);
      const L = p.pulse.lengthDeg * fat;
      const aMin = 3 * 6 * p.redlineRpm / fs;
      this.sharp = pulseTable(Math.max(aMin, p.pulse.attackOn), p.pulse.decayOn * fat, L);
      this.soft = pulseTable(p.pulse.attackOff, p.pulse.decayOff * fat, L);
      this.intakeT = pulseTable(p.pulse.attackOff * 1.6, p.pulse.decayOff * 1.4, L * 1.2);
      this.invL = TN / L; this.invLi = TN / (L * 1.2);
      this.weight = Math.sqrt(per / 0.5);
      // waveguides: round trip 2L/c
      const hl = Array.isArray(p.header.lengthM) ? p.header.lengthM : [p.header.lengthM, p.header.lengthM];
      this.Dh = [2 * hl[0] / C_HEADER * fs, 2 * (hl[1] || hl[0]) / C_HEADER * fs].map((d) => clamp(d, 8, this.hd[0].m - 4));
      this.Dp = clamp(2 * p.pipe.lengthM / C_PIPE * fs, 8, this.pd.m - 4);
      this.kH = 1 - Math.exp(-TAU * p.header.lossHz / fs); this.kP = 1 - Math.exp(-TAU * p.pipe.lossHz / fs);
      this.muf.set('lp', p.muffler.hz, p.muffler.q, 0, fs);
      this.chamber.set('peak', p.muffler.chamberHz, 1.4, p.muffler.chamberDb, fs);
      this.rasp.set('shelf', 2400, 0.7, p.raspDb, fs);
      this.rad.set(p.radHz, fs);
      this.helm.set('bp', p.intake.helmHz, p.intake.helmQ, 0, fs);
      this.runner.set('bp', p.intake.runnerHz, p.intake.runnerQ, 0, fs);
      this.ihiss.set('bp', 2600, 0.9, 0, fs);
      this.tickBp.set('bp', p.mech.tickHz, 2.2, 0, fs);
      this.tickDec = Math.exp(-1 / (0.0016 * fs));
      this.body.set('lp', p.interior.lpHz, 0.7, 0, fs);
      this.boom.set('peak', p.interior.boomHz, 1.2, p.interior.boomDb, fs);
      this.popDec = Math.exp(-1 / (0.0032 * fs)); this.thDec = Math.exp(-1 / (0.011 * fs));
      this.bovKind = p.turbo.bov === 'flutter' ? 2 : p.turbo.bov === 'none' ? 0 : 1;
    }

    shift(cut) { this.shiftCut = Math.max(this.shiftCut, clamp(cut == null ? 0.15 : cut, 0.02, 0.6)); }

    lift() {
      this.tLift = 0;
      const t = this.p.turbo;
      if (t.on && this.boost > 0.3 && this.bovKind) {
        this.bovEnv = Math.max(this.bovEnv, this.boost * t.bovGain);
        this.bovF = this.bovKind === 2 ? 1700 : 3200; this.chF = 22;
        this.boost *= this.bovKind === 2 ? 0.55 : 0.15;
      }
    }

    fire(k, over) {
      const r = this.r;
      let a = this.ampBase * this.evW[k] * Math.max(0, 1 + this.ccvNow * r.g());
      if (r.u() < this.missNow) a *= 0.08;
      const s = this.ex[this.exI]; this.exI = (this.exI + 1) & 15;
      s.on = true; s.phi = over - this.jitNow * Math.abs(r.g()); s.amp = a; s.bank = this.evB[k]; s.s = this.sharpNow;
      const q = this.inp[this.inI]; this.inI = (this.inI + 1) & 15;
      q.on = true; q.phi = over - this.p.intake.offsetDeg; q.amp = this.inAmp * this.evW[k] * (1 + 0.5 * this.ccvNow * r.g());
      if (this.tickLvl > this.tickEnv) this.tickEnv = this.tickLvl;
      if (this.popP > 0 && r.u() < this.popP && this.popN < 10) {
        const amp = this.p.pops.gain * (0.22 + 0.38 * r.u());
        this.queuePop(this.fs * (0.001 + 0.005 * r.u()), amp);
        const crackle = (r.u() * 4) | 0; // and a short crackle after it
        for (let c = 0; c < crackle && this.popN < 11; c++) this.queuePop(this.fs * (0.008 + 0.04 * r.u()), amp * (0.15 + 0.35 * r.u()));
      }
    }
    queuePop(delay, amp) {
      for (let j = 0; j < 12; j++) if (this.popQ[j] <= 0) { this.popQ[j] = Math.max(1, delay); this.popA[j] = amp; this.popN++; return; }
    }

    control(ctl, n) {
      const p = this.p, fs = this.fs, dt = n / fs, r = this.r;
      const thr = clamp(+ctl.throttle || 0, 0, 1);
      if (thr > 0.5) this.armed = true;
      if (this.armed && thr < 0.2) { this.armed = false; this.lift(); }
      this.tLift += dt; this.thr = thr;
      const rpmIn = clamp(+ctl.rpm || p.idleRpm, 300, 12000);
      // rev limiter: a hard ignition cut, the revs bouncing under the limit
      const lim = p.limiterRpm;
      if (rpmIn >= lim - 60 && thr > 0.35) { if (!this.limOn) { this.limOn = true; this.limRpm = Math.min(this.rpm, lim); this.limCut = 0; } }
      else if (rpmIn < lim - 200 || thr < 0.25) this.limOn = false;
      let rpmT, ig = 1;
      if (this.limOn) {
        if (this.limCut > 0) { this.limCut -= dt; this.limRpm -= 2600 * dt; ig = 0; }
        else { this.limRpm += 5200 * dt; if (this.limRpm >= lim) { this.limRpm = lim; this.limCut = p.limiterCutMs / 1000 * (0.85 + 0.3 * r.u()); } }
        rpmT = this.limRpm;
      } else {
        this.wob = this.wob * 0.995 + r.b() * 0.0006;
        const idleF = 1 - sstep(p.idleRpm + 100, p.idleRpm + 700, rpmIn);
        this.huntPh += dt * TAU * (0.7 + 0.2 * r.u());
        const hunt = idleF * (1 - thr) * (0.006 + 0.012 * p.lump) * Math.sin(this.huntPh);
        rpmT = rpmIn * (1 + this.wob + hunt);
      }
      if (this.shiftCut > 0) { this.shiftCut -= dt; ig = 0; }
      this.rpmT = rpmT; this.igT = ig;
      // load, and what it does to each combustion
      const L = this.load, idleF = 1 - sstep(p.idleRpm + 150, p.idleRpm + 1100, this.rpm), rn = this.rpm / p.redlineRpm;
      this.nos += ((ctl.nos ? 1 : 0) - this.nos) * Math.min(1, dt / 0.15);
      const rl = 0.3 + 0.7 * Math.pow(clamp(rn, 0, 1.1), 0.9);
      this.rl = rl;
      let amp = p.levels.off * (0.6 + 0.4 * rl) + (1 - p.levels.off) * Math.pow(L, 0.85) * rl;
      amp = Math.max(amp, p.levels.idle * idleF * (0.3 + 0.7 * this.ig));
      this.ampBase = amp * this.weight * (1 + 0.15 * this.nos);
      this.sharpNow = clamp(L * 1.15, 0, 1);
      this.ccvNow = p.ccv.on * L + p.ccv.off * (1 - L) + (p.ccv.idle + 0.3 * p.lump) * idleF;
      this.missNow = p.miss * (1 - L) * 0.5 + p.lump * idleF * 0.06 + (1 - this.ig) * 0.3;
      this.noiseNow = p.pulse.noiseOn * L + p.pulse.noiseOff * (1 - L);
      this.jitNow = p.jitterDeg * (1 + 2.5 * (1 - L));
      this.roarAmt = 0.05 * (0.25 + L) * rl * this.weight;
      this.mechNoise = 0.05 * p.mech.tick * rn * rn;
      this.driveNow = p.drive * (0.45 + 0.55 * L) * (1 + 0.25 * this.nos);
      this.inAmp = 0.6 * (0.15 + 0.85 * thr);
      this.hissNow = p.intake.hiss * clamp(rn, 0, 1.2) * (0.2 + 0.8 * thr) * (1 + 0.5 * this.nos);
      this.tickLvl = p.mech.tick * Math.sqrt(clamp(rn, 0.05, 1.2));
      // pops: per second, a burst right after a lift that settles to an occasional crackle on a long overrun
      const evPerSec = Math.max(1, this.nEv * this.rpm / 120);
      const rpmF = sstep(p.pops.minRpm, p.pops.minRpm + 1500, this.rpm);
      let popRate = 0;
      if (this.ig < 0.5 || (1 - this.igT) > 0.5) popRate = 9 * p.pops.amount * rpmF;
      else if (L < 0.3) popRate = p.pops.amount * rpmF * (0.4 + 9 * Math.exp(-this.tLift / 0.8)) * (1 - L / 0.3);
      this.popP = popRate / evPerSec;
      // turbo
      const t = p.turbo;
      if (t.on) {
        const want = ctl.boost >= 0 ? clamp(ctl.boost, 0, 1) : thr * this.ig * sstep(t.spoolRpm, t.fullRpm, this.rpm);
        this.boost += (want - this.boost) * (1 - Math.exp(-dt / (want > this.boost ? t.spool : 0.3)));
        this.shaft += (this.boost - this.shaft) * (1 - Math.exp(-dt / (this.boost > this.shaft ? 0.25 : 1.6)));
        const f = t.whineLo + (t.whineHi - t.whineLo) * this.shaft;
        this.twF = f; this.tw.set('bp', Math.round(f), 38, 0, fs);
        this.twAmp = t.whine * this.shaft * this.shaft * (0.3 + 0.7 * L);
        this.whAmp = t.hiss * this.boost * L;
      } else { this.boost = 0; this.shaft = 0; this.twAmp = 0; this.whAmp = 0; }
      if (this.bovEnv > 1e-4) {
        if (this.bovKind === 2) { this.bovF = Math.max(800, this.bovF * Math.exp(-dt / 0.9)); this.chF = Math.max(9, this.chF * Math.exp(-dt / 0.8)); this.bovDec = Math.exp(-1 / (0.28 * fs)); this.bovBp.set('bp', Math.round(this.bovF), 2.2, 0, fs); }
        else { this.bovF = Math.max(1100, this.bovF * Math.exp(-dt / 0.35)); this.bovDec = Math.exp(-1 / (0.16 * fs)); this.bovBp.set('bp', Math.round(this.bovF), 1.3, 0, fs); }
      }
      this.view += ((ctl.view ? 1 : 0) - this.view) * Math.min(1, dt / 0.25);
      const m = this.meter; m.boost = this.boost; m.limiter = this.limOn ? 1 : 0; m.rpm = this.rpm; m.pops = this.pops;
    }

    render(out, n, ctl) {
      this.control(ctl, n);
      const p = this.p, fs = this.fs, r = this.r, ex = this.ex, inp = this.inp;
      const sh = this.sharp.t, so = this.soft.t, en = this.sharp.env, it = this.intakeT.t, invL = this.invL, invLi = this.invLi;
      const rH = p.header.reflect, rP = p.pipe.reflect, kH = this.kH, kP = this.kP, Dh0 = this.Dh[0], Dh1 = this.Dh[1], Dp = this.Dp;
      const two = this.banks > 1, byp = p.muffler.bypass, drive = this.driveNow * PRE, invDrive = 1 / drive;
      const v = this.view, mx = p.mix, ii = p.interior;
      const gEx = mx.exhaust * (1 - v), gIn = mx.intake * (1 - v) + ii.intake * mx.intake * 2 * v, gMe = mx.mech * (1 - v) + ii.mech * mx.mech * 2 * v, gTu = mx.turbo * ((1 - v) + ii.turbo * v);
      const gBody = mx.exhaust * ii.exhaust * v, gain = p.gain, noiseNow = this.noiseNow, popG = p.pops.gain;
      const turbo = p.turbo.on || this.bovEnv > 1e-4, intakeG = p.intake.gain;
      for (let i = 0; i < n; i++) {
        this.rpm += (this.rpmT - this.rpm) * this.kR;
        this.load += (this.thr * this.ig - this.load) * this.kL;
        this.ig += (this.igT - this.ig) * this.kI;
        const dpsi = 6 * this.rpm / fs;
        this.psi += dpsi;
        while (this.psi >= this.nextAbs) {
          this.fire(this.next, this.psi - this.nextAbs);
          this.next++;
          if (this.next >= this.nEv) { this.next = 0; this.nextAbs = this.evA[0] + 720; } else this.nextAbs = this.evA[this.next] + (this.nextAbs >= 720 ? 720 : 0);
        }
        if (this.psi >= 720) { this.psi -= 720; this.nextAbs -= 720; }
        // pulses
        let e0 = 0, e1 = 0, n0 = 0, n1 = 0, iv = 0;
        for (let j = 0; j < 16; j++) {
          const s = ex[j];
          if (s.on) {
            if (s.phi >= 0) {
              const x = s.phi * invL;
              if (x >= TN) s.on = false;
              else {
                const k = x | 0, f = x - k, a = so[k] + (so[k + 1] - so[k]) * f, b = sh[k] + (sh[k + 1] - sh[k]) * f;
                const val = (a + (b - a) * s.s) * s.amp, ev = en[k] * s.amp;
                if (s.bank) { e1 += val; n1 += ev; } else { e0 += val; n0 += ev; }
              }
            }
            s.phi += dpsi;
          }
          const q = inp[j];
          if (q.on) {
            if (q.phi >= 0) {
              const x = q.phi * invLi;
              if (x >= TN) q.on = false;
              else { const k = x | 0; iv -= (it[k] + (it[k + 1] - it[k]) * (x - k)) * q.amp; }
            }
            q.phi += dpsi;
          }
        }
        const w1 = r.b(), w2 = r.b(), tn = this.tnL.lp(this.tn.hp(w1));
        // headers (one waveguide per bank) -> grit -> mid pipe (pops go in here) -> muffler -> rasp -> radiation
        const roar = tn * this.roarAmt;
        let h0 = e0 + noiseNow * n0 * tn + roar + DN;
        this.hl[0] += kH * (this.hd[0].read(Dh0) - this.hl[0]); h0 += rH * this.hl[0]; this.hd[0].write(h0);
        let s = h0;
        if (two) {
          let h1 = e1 + noiseNow * n1 * w2 + roar + DN;
          this.hl[1] += kH * (this.hd[1].read(Dh1) - this.hl[1]); h1 += rH * this.hl[1]; this.hd[1].write(h1);
          s = 0.7 * (h0 + h1);
        }
        s = softclip(s * drive) * invDrive;
        if (this.popN > 0) for (let j = 0; j < 12; j++) if (this.popQ[j] > 0 && --this.popQ[j] <= 0) { this.popN--; this.pops++; if (this.popA[j] > this.popEnv) this.popEnv = this.popA[j]; this.thEnv = Math.max(this.thEnv, this.popA[j]); this.thPh = 0; }
        let pop = 0;
        if (this.popEnv > 1e-5 || this.thEnv > 1e-5) {
          this.popEnv *= this.popDec; this.thEnv *= this.thDec; this.thPh += 130 / fs;
          pop = (this.popEnv * w2 * 1.05 + this.thEnv * Math.sin(TAU * this.thPh) * 0.7) * popG;
        }
        let m = s + pop;
        this.pl += kP * (this.pd.read(Dp) - this.pl); m += rP * this.pl; this.pd.write(m + DN);
        let mf = this.muf.run(m) * (1 - byp) + m * byp;
        mf = this.rasp.run(this.chamber.run(mf));
        const exOut = this.rad.hp(mf);
        // intake, mechanicals, turbo
        const iIn = iv + this.ihiss.run(w1) * this.hissNow;
        const inOut = (this.helm.run(iIn) + 0.6 * this.runner.run(iIn)) * intakeG;
        this.tickEnv *= this.tickDec;
        const meOut = this.tickBp.run(w2) * (this.tickEnv * 4 + this.mechNoise);
        let tuOut = 0;
        if (turbo) {
          this.twPh += this.twF / fs; if (this.twPh >= 1) this.twPh -= 1;
          tuOut = (Math.sin(TAU * this.twPh) * 0.35 + this.tw.run(w1) * 3.0) * this.twAmp + this.whoosh.hp(w2) * this.whAmp * 0.5;
          if (this.bovEnv > 1e-4) {
            this.bovEnv *= this.bovDec;
            let b = this.bovBp.run(w1) * this.bovEnv * 2.2;
            if (this.bovKind === 2) { this.chPh += this.chF / fs; if (this.chPh >= 1) this.chPh -= 1; const c = Math.max(0, Math.sin(TAU * this.chPh)); b *= 0.25 + 1.5 * c * c; }
            tuOut += b;
          }
        }
        let y = exOut * gEx + inOut * gIn + meOut * gMe + tuOut * gTu;
        y += this.body.run(exOut) * gBody;
        y = this.boom.run(y);
        y = this.dc.hp(y * gain);
        out[i] = y > 0.9 ? 0.9 + 0.1 * softclip((y - 0.9) * 10) : y < -0.9 ? -0.9 + 0.1 * softclip((y + 0.9) * 10) : y;
      }
    }
  }

  const DEFAULT_TYRES = {
    compound: { squealHz: 880, q: 26, tonal: 0.6, overtone: 2.03, overtoneGain: 0.35, noise: 0.25, warbleHz: [7, 12], warbleDepth: 0.35, wobble: 0.025, onsetDeg: 5, fullDeg: 30, chirp: 1, gain: 1, roar: 1 },
    surfaces: { asphalt: { pitch: 1, squeal: 1, q: 1, roar: 1, roarHz: 1, kerb: 0, gravel: 0 } },
    roar: 0.55, wind: 0.5, front: 0.5, kerb: 0.8, gravel: 0.8, squeal: 0.6, interiorLpHz: 2200,
  };

  class Voice { // one squealing tyre
    constructor(rng, detune) { this.r = rng; this.det = detune; this.ph = 0; this.wob = 0; this.amPh = rng.u(); this.amF = 9; this.amp = 0; this.bp1 = new Biquad(); this.bp2 = new Biquad(); this.f = 900; this.fl = 0; }
  }

  class Tyres {
    constructor(fs, rng) {
      this.fs = fs; this.r = rng;
      this.v = [new Voice(rng, 0.985), new Voice(rng, 1.017)];
      this.front = new Biquad(); this.frontPh = 0; this.frontAmp = 0;
      this.roarL = new Biquad(); this.roarR = new Biquad(); this.windL = new Biquad(); this.windR = new Biquad();
      this.kerbBp = new Biquad(); this.rattle = new Biquad(); this.kerbPh = 0; this.kerbEnv = 0;
      this.gr1 = new Biquad(); this.gr2 = new Biquad(); this.grLow = new Biquad(); this.grEnv1 = 0; this.grEnv2 = 0;
      this.inL = new OnePole(); this.inR = new OnePole();
      this.I = 0; this.Iprev = 0; this.Ipeak = 0; this.tDrop = 9;
      this.chirpEnv = 0; this.chirpT = 0; this.chirpLen = 0; this.chirpP = 1; this.cont = 0;
      this.gust = 0; this.gustT = 0; this.speed = 0; this.view = 0; this.lockPh = 0;
      this.sf = { pitch: 1, squeal: 1, q: 1, roar: 1, roarHz: 1, kerb: 0, gravel: 0, stripeM: 0.55 };
      this.kerbDec = Math.exp(-1 / (0.012 * fs)); this.grDec1 = Math.exp(-1 / (0.0015 * fs)); this.grDec2 = Math.exp(-1 / (0.004 * fs));
      this.kerbBp.set('bp', 85, 2.5, 0, fs); this.rattle.set('bp', 1400, 1.5, 0, fs);
      this.gr1.set('bp', 2600, 0.9, 0, fs); this.gr2.set('bp', 900, 1.1, 0, fs);
      this.configure(DEFAULT_TYRES);
    }
    configure(p) {
      p = Object.assign({}, DEFAULT_TYRES, p);
      p.compound = Object.assign({}, DEFAULT_TYRES.compound, p.compound);
      p.surfaces = Object.assign({}, DEFAULT_TYRES.surfaces, p.surfaces);
      this.p = p;
      this.inL.set(p.interiorLpHz, this.fs); this.inR.set(p.interiorLpHz, this.fs);
    }

    control(ctl, n) {
      const p = this.p, c = p.compound, fs = this.fs, dt = n / fs, r = this.r;
      const sp = Math.max(0, +ctl.speed || 0);
      this.speed = sp;
      // surface, eased so a kerb or a gravel trap fades in over a few frames
      const S = p.surfaces[ctl.surface] || p.surfaces.asphalt, sf = this.sf, ke = Math.min(1, dt / 0.06);
      for (const k of ['pitch', 'squeal', 'q', 'roar', 'roarHz', 'kerb', 'gravel']) sf[k] += ((S[k] == null ? (k === 'kerb' || k === 'gravel' ? 0 : 1) : S[k]) - sf[k]) * ke;
      if (S.stripeM) sf.stripeM = S.stripeM;
      // intensity: the slide angle, wheelspin or a locked rear, all faded out at walking pace
      // slipN: the game's own 0..1 slip share (js/car.js slipR, which already carries speed, wheelspin and the handbrake), read
      // on the same scale as 45 degrees of slide and not faded by speed a second time
      const useN = ctl.slipN != null && ctl.slipN >= 0;
      const ang = useN ? ctl.slipN * 45 : Math.abs(+ctl.slip || 0), spin = clamp(+ctl.spin || 0, 0, 1), lock = clamp(+ctl.lock || 0, 0, 1);
      const slide = sstep(c.onsetDeg, c.fullDeg, ang);
      const spdF = sstep(1.5, 9, sp);
      // wheelspin squeals at any car speed (the tread is moving); a slide or a locked wheel needs the car moving
      const Iw = Math.max(slide * (useN ? 1 : spdF), spin * 0.85 * sstep(0.02, 0.15, spin), lock * 0.9 * spdF);
      const up = Iw > this.I;
      this.I += (Iw - this.I) * Math.min(1, dt / (up ? 0.03 : 0.08));
      const I = this.I;
      // a slide letting go: a short regrip chirp
      if (I > this.Ipeak) this.Ipeak = I;
      if (this.Ipeak > 0.5 && I < 0.2) { this.startChirp(0.09, 1.08, Math.min(1, this.Ipeak) * 0.9); this.Ipeak = 0; }
      if (I < 0.05) this.Ipeak = Math.min(this.Ipeak, 0.3);
      this.cont = sstep(0.22, 0.55, I);
      this.chirpRate = I > 0.02 && I < 0.6 ? (3 + 26 * I) * c.chirp : 0;
      // pitch and colour
      const sv = 0.92 + 0.16 * I, spv = 0.94 + 0.1 * Math.min(1, sp / 40);
      let pitch = c.squealHz * sf.pitch * sv * spv;
      pitch *= 1 - 0.12 * spin * (1 - slide) - 0.22 * lock;
      const q = c.q * sf.q * (1 - 0.35 * I);
      const loud = Math.pow(I, 0.7) * (0.55 + 0.45 * Math.min(1, sp / 30)) * c.gain * sf.squeal * p.squeal;
      this.tonal = clamp(c.tonal * (1 - 0.45 * I) , 0.05, 1); this.noiseSh = c.noise + 0.35 * I;
      this.lockAM = lock * (1 - slide);
      for (const vo of this.v) {
        vo.wob = vo.wob * 0.97 + r.b() * c.wobble * 0.25;
        const f = pitch * vo.det * (1 + clamp(vo.wob, -2 * c.wobble, 2 * c.wobble));
        vo.f = f;
        vo.bp1.set('bp', Math.round(f), q, 0, fs); vo.bp2.set('bp', Math.round(f * c.overtone), q * 0.8, 0, fs);
        if (r.u() < dt * 3) vo.amF = c.warbleHz[0] + (c.warbleHz[1] - c.warbleHz[0]) * r.u();
        vo.ampT = loud;
      }
      this.warD = c.warbleDepth * (0.6 + 0.4 * I);
      this.ovG = c.overtoneGain;
      // understeer groan from the fronts
      const fr = clamp(+ctl.front || 0, 0, 1) * spdF;
      this.frontAmpT = fr * p.front * c.gain * (1 - sf.gravel);
      this.front.set('bp', Math.round(c.squealHz * 0.5 * sf.pitch), 7, 0, fs);
      // rolling roar, wind
      const rf = Math.round((140 + 26 * sp) * sf.roarHz);
      this.roarL.set('lp', rf, 0.6, 0, fs); this.roarR.set('lp', Math.round(rf * 1.07), 0.6, 0, fs);
      this.roarAmp = p.roar * c.roar * sf.roar * Math.pow(Math.min(sp, 70) / 40, 1.25);
      this.gustT -= dt; if (this.gustT <= 0) { this.gustT = 0.4 + 1.2 * r.u(); this.gustTo = r.b() * 0.3; }
      this.gust += ((this.gustTo || 0) - this.gust) * Math.min(1, dt / 0.6);
      const wf = Math.round(320 + 13 * sp);
      this.windL.set('bp', wf, 0.6, 0, fs); this.windR.set('bp', Math.round(wf * 1.11), 0.6, 0, fs);
      this.windAmp = p.wind * Math.pow(Math.min(sp, 80) / 55, 2) * (1 + this.gust);
      // kerb stripes and gravel grains
      this.kerbRate = sf.kerb > 0.01 ? sp / (sf.stripeM || 0.55) : 0;
      this.kerbAmp = p.kerb * sf.kerb * Math.min(1, sp / 12);
      this.grRate = sf.gravel > 0.01 ? (250 + 900 * I) * Math.min(1.5, sp / 18) : 0;
      this.grAmp = p.gravel * sf.gravel * (0.35 + 0.65 * I) * Math.min(1, sp / 8);
      this.grLow.set('lp', 260, 0.7, 0, fs);
      this.view += ((ctl.view ? 1 : 0) - this.view) * Math.min(1, dt / 0.25);
    }
    startChirp(len, pitch, amp) { if (this.chirpEnv > 0.5 * amp) return; this.chirpT = 0; this.chirpLen = len; this.chirpP = pitch; this.chirpA = amp; }

    render(L, R, n, ctl) {
      this.control(ctl, n);
      const fs = this.fs, r = this.r, v0 = this.v[0], v1 = this.v[1], tonal = this.tonal, nz = this.noiseSh * 3.2, warD = this.warD, ovG = this.ovG;
      const view = this.view, wInt = 1 - 0.55 * view, rInt = 1 + 0.25 * view;
      const kA = 1 - Math.exp(-1 / (0.02 * fs));
      for (let i = 0; i < n; i++) {
        // chirps at the edge of grip
        if (this.chirpRate > 0 && this.chirpLen === 0 && r.u() < this.chirpRate / fs) this.startChirp(0.025 + 0.065 * r.u(), 0.96 + 0.08 * r.u(), 0.6 + 0.4 * r.u());
        let ch = 0;
        if (this.chirpLen > 0) { this.chirpT += 1 / fs; const x = this.chirpT / this.chirpLen; if (x >= 1) { this.chirpLen = 0; this.chirpEnv = 0; } else { const s = Math.sin(Math.PI * x); ch = s * s * this.chirpA; this.chirpEnv = ch; } }
        const gate = Math.max(this.cont, ch), pm = this.chirpLen > 0 ? this.chirpP : 1;
        this.lockPh += 15 / fs; if (this.lockPh >= 1) this.lockPh -= 1;
        const lam = this.lockAM > 0.01 ? 1 - 0.4 * this.lockAM * (0.5 + 0.5 * Math.sin(TAU * this.lockPh)) : 1;
        let sq0 = 0, sq1 = 0;
        if (v0.ampT > 1e-4 || v0.amp > 1e-4 || ch > 0) {
          for (let k = 0; k < 2; k++) {
            const vo = k ? v1 : v0;
            vo.amp += (Math.max(vo.ampT, ch * 0.5) - vo.amp) * kA;
            vo.ph += vo.f * pm / fs * (1 + 0.012 * r.b()); if (vo.ph >= 1) vo.ph -= 1;
            vo.amPh += vo.amF / fs; if (vo.amPh >= 1) vo.amPh -= 1;
            const e = Math.sin(TAU * vo.ph) * tonal + r.b() * nz;
            const y = vo.bp1.run(e) + ovG * vo.bp2.run(e);
            const am = 1 - warD * (0.5 + 0.5 * Math.sin(TAU * vo.amPh));
            const o = y * vo.amp * am * gate * lam;
            if (k) sq1 = o; else sq0 = o;
          }
        }
        // the fronts
        let fr = 0;
        this.frontAmp += (this.frontAmpT - this.frontAmp) * kA;
        if (this.frontAmp > 1e-4) { this.frontPh += 2.5 / fs; fr = this.front.run(r.b() * 2.5) * this.frontAmp * (0.7 + 0.3 * Math.sin(TAU * this.frontPh)); }
        // road and wind
        const ro = this.roarAmp, wi = this.windAmp * wInt;
        const rl = this.roarL.run(r.b()) * ro * rInt, rr = this.roarR.run(r.b()) * ro * rInt;
        const wl = wi > 1e-5 ? this.windL.run(r.b()) * wi : 0, wr = wi > 1e-5 ? this.windR.run(r.b()) * wi : 0;
        // kerb
        let kb = 0;
        if (this.kerbRate > 0 || this.kerbEnv > 1e-4) {
          this.kerbPh += this.kerbRate / fs; if (this.kerbPh >= 1) { this.kerbPh -= 1; this.kerbEnv = this.kerbAmp * (0.8 + 0.4 * r.u()); }
          this.kerbEnv *= this.kerbDec;
          kb = this.kerbBp.run(this.kerbEnv * (1 + 0.3 * r.b())) * 6 + this.rattle.run(r.b()) * this.kerbEnv * 0.5;
        }
        // gravel
        let gv = 0;
        if (this.grRate > 0 || this.grEnv1 > 1e-4 || this.grEnv2 > 1e-4) {
          if (r.u() < this.grRate / fs) { const a = r.u(); if (a > 0.7) this.grEnv2 = Math.max(this.grEnv2, a * this.grAmp); else this.grEnv1 = Math.max(this.grEnv1, (0.3 + a) * this.grAmp); }
          this.grEnv1 *= this.grDec1; this.grEnv2 *= this.grDec2;
          const w = r.b();
          gv = this.gr1.run(w * this.grEnv1) * 3 + this.gr2.run(w * this.grEnv2) * 3 + this.grLow.run(r.b()) * this.grAmp * 0.25;
        }
        let l = sq0 * 0.8 + sq1 * 0.45 + fr + rl + wl + kb + gv;
        let rt = sq1 * 0.8 + sq0 * 0.45 + fr + rr + wr + kb + gv;
        if (view > 0.001) { l += (this.inL.lp(l) - l) * view; rt += (this.inR.lp(rt) - rt) * view; }
        L[i] = clamp(l, -1, 1); R[i] = clamp(rt, -1, 1);
      }
    }
  }

  class DriftCarDSP {
    constructor(fs, seed) {
      const s = seed || 20261115;
      this.fs = fs; this.engine = new Engine(fs, new Rng(s)); this.tyres = new Tyres(fs, new Rng(s * 7 + 1));
      this.ctl = { rpm: 900, throttle: 0, boost: -1, slip: 0, slipN: -1, spin: 0, lock: 0, front: 0, speed: 0, surface: 'asphalt', view: 0, nos: 0 };
    }
    message(m) {
      if (!m) return;
      if (m.type === 'ctl') Object.assign(this.ctl, m.v);
      else if (m.type === 'config') { if (m.engine) this.engine.configure(m.engine); if (m.tyres) this.tyres.configure(m.tyres); }
      else if (m.type === 'shift') this.engine.shift(m.cut);
    }
    render(eng, tl, tr, n) { this.engine.render(eng, n, this.ctl); this.tyres.render(tl, tr, n, this.ctl); }
  }

  if (typeof AudioWorkletProcessor !== 'undefined' && typeof registerProcessor === 'function') {
    class DriftCarProcessor extends AudioWorkletProcessor {
      constructor(o) {
        super();
        const po = (o && o.processorOptions) || {};
        this.dsp = new DriftCarDSP(sampleRate, po.seed);
        if (po.config) this.dsp.message(Object.assign({ type: 'config' }, po.config));
        if (po.ctl) Object.assign(this.dsp.ctl, po.ctl);
        this.blocks = 0; this.meter = !!po.meter; this.active = true;
        this.port.onmessage = (e) => { const m = e.data; if (m && m.type === 'meter') this.meter = !!m.on; else if (m && m.type === 'active') this.active = !!m.on; else this.dsp.message(m); };
      }
      process(inputs, outputs) {
        const o0 = outputs[0], o1 = outputs[1];
        if (!o0 || !o0[0]) return true;
        const n = o0[0].length;
        if (!this.active) return true; // outputs are already silent: a menu screen costs nothing
        this.dsp.render(o0[0], o1[0], o1[1] || o1[0], n);
        for (let c = 1; c < o0.length; c++) o0[c].set(o0[0]);
        if (this.meter && ++this.blocks % 12 === 0) this.port.postMessage(this.dsp.engine.meter);
        return true;
      }
    }
    registerProcessor('drift-car', DriftCarProcessor);
  }
  G.DriftDSP = { DriftCarDSP, Engine, Tyres, Rng, Biquad, version: 1 };
})(typeof globalThis !== 'undefined' ? globalThis : this);
