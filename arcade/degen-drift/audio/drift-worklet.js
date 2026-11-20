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
      // 11-18: model 'new' squeals in three layers (Squeal2); the rest (roar, wind, kerbs, gravel, the fronts) is as before
      this.model = p.model === 'new' ? 'new' : 'classic'; if (this.model === 'new' && !this.s2) this.s2 = new Squeal2(this.fs, this.r);
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
      this.chirpRate = I > 0.02 && I < 0.6 && this.model !== 'new' ? (3 + 26 * I) * c.chirp : 0; // new: the howl is the edge of grip, no chirping
      if (this.model === 'new') {
        const thr = clamp(+ctl.throttle || 0, 0, 1), load = clamp(0.55 * thr + 0.45 * Math.min(1, sp / 35), 0, 1);
        const f0 = c.squealHz * sf.pitch * (1.16 - 0.26 * I) * (1 - 0.1 * load) * (0.96 + 0.08 * Math.min(1, sp / 40)) * (1 - 0.18 * lock);
        this.s2.control(ctl, I, f0, Math.pow(I, 0.8) * (0.5 + 0.5 * Math.min(1, sp / 30)) * c.gain * sf.squeal * p.squeal * (1 - sf.gravel), fs);
      }
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
        if (this.s2 && this.model === 'new') { const s2 = this.s2; sq0 = s2.voice(0, r.b(), fs); sq1 = s2.voice(1, r.b(), fs); if (ch > 0) { sq0 += s2.chirp(0, ch, r.b()); sq1 += s2.chirp(1, ch, r.b()); } }
        else if (v0.ampT > 1e-4 || v0.amp > 1e-4 || ch > 0) {
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
        if (this.windOnly) { l = wl; rt = wr; } // 11-17: recorded tyres (audio/recorded.js) play all but the wind
        if (view > 0.001) { l += (this.inL.lp(l) - l) * view; rt += (this.inR.lp(rt) - rt) * view; }
        L[i] = clamp(l, -1, 1); R[i] = clamp(rt, -1, 1);
      }
    }
  }

  // ============================================================================================================
  // 11-18, SYNTH 2: THE COMBUSTION ENGINE (Engine sound: New). Evrtek on the first synth and the recorded loops: "a
  // small toy ... no guts", "engines will rev, valves will flutter, on shifts you'll get a sudden change in revs,
  // engines may backfire a bit". A physically informed model after Baldan et al. 2015 (the Sound Design Toolkit's
  // engine), built here from the method, no code taken:
  //   a crank angle, every combustion at its cylinder's angle in the engine's real firing order and spacing, each a
  //   pressure pulse with body (a time-bound blowdown, so idle chugs and the top end merges), per-cycle jitter in
  //   timing and strength, turbulence riding on it
  //   -> digital waveguides, each a pair of delay lines (pressure waves both ways) with losses, joined by scattering
  //   junctions at their area changes: an exhaust port (a closed valve), a header per bank, a collector (or two
  //   separate pipes, true duals), the pipe, a muffler chamber (expansion and absorption), the tailpipe, its open end
  //   -> the sound leaving the outlet. Pops and bangs are fired INTO the tailpipe's inlet, so the outlet shapes them.
  //   In parallel: an intake runner (suction pulses, a plenum, hiss by airflow), the block's thump per combustion, the
  //   turbo (spool whine by shaft speed, whoosh by boost, a blow-off valve and compressor flutter on a lift), and the
  //   "guts" for small speakers: the low band's harmonics regenerated an octave and a twelfth up (the missing
  //   fundamental), so a phone that cannot play 60 Hz still hears the engine's pitch and weight.
  //   Events by rule: the shift (firing stops for the cut, the revs fall to rpm x next/current ratio and land, the
  //   throttle comes back with a bark; a downshift blips, overshoots and settles), the limiter (whole firings dropped,
  //   the revs bouncing), overrun (weak pulses, airflow through the pipes: hollow), afterfire on a lift.
  const CX = 520, CI = 345; // speed of sound in the hot exhaust and in the intake, m/s
  class Tube { // one waveguide section: rightward (R) and leftward (L) pressure waves, a one-pole loss each way
    constructor(maxSamples) { let s = 4; while (s < maxSamples + 4) s <<= 1; this.R = new Float32Array(s); this.L = new Float32Array(s); this.m = s - 1; this.w = 0; this.D = 4; this.k = 1; this.g = 1; this.fr = 0; this.fl = 0; this.ar = 0; this.al = 0; }
    set(lengthM, c, lossHz, atten, fs) { this.D = clamp(Math.round(lengthM / c * fs), 2, this.m - 2); this.k = 1 - Math.exp(-TAU * lossHz / fs); this.g = atten; }
    read() { const i = (this.w - this.D) & this.m; this.fr += this.k * (this.R[i] - this.fr); this.fl += this.k * (this.L[i] - this.fl); this.ar = this.fr * this.g; this.al = this.fl * this.g; }
    write(inR, inL) { this.R[this.w] = clamp(inR, -8, 8) + DN; this.L[this.w] = clamp(inL, -8, 8) + DN; this.w = (this.w + 1) & this.m; }
  }
  // a blowdown pulse: smooth fast rise, longer fall, tapered to zero; positive (the gas leaves the cylinder), peak 1
  function blowdown(rise, fall) {
    const t = new Float32Array(TN + 2); let pk = 0;
    for (let i = 0; i <= TN; i++) { const x = i / TN; let g = Math.pow(1 - Math.exp(-x / rise), 2) * Math.exp(-x / fall); if (x > 0.72) g *= 0.5 + 0.5 * Math.cos(Math.PI * (x - 0.72) / 0.28); t[i] = g; pk = Math.max(pk, g); }
    for (let i = 0; i <= TN; i++) t[i] /= pk; t[TN] = t[TN + 1] = 0; return t;
  }
  class Shot { constructor() { this.b = null; this.p = 0; this.r = 1; this.g = 0; this.on = false; this.end = 0; this.fade = 0; this.fk = 1; } } // one sample one-shot
  const DEFAULT_COMB = {
    model: 'combustion', cylinders: 4, displacement: 2,
    firing: { events: [0, 180, 360, 540], banks: [0, 1, 0, 1], weights: [1, 1, 1, 1] },
    idleRpm: 900, redlineRpm: 7600, limiterRpm: 7650,
    limiter: { cutMs: 60, dropRpmS: 2600, pops: 0.3 },
    flywheel: 0.012, // s: how fast the heard revs follow (a heavy flywheel is slower)
    pulse: { maxMs: 7, deg: 150, rise: 0.09, fall: 0.3, riseOff: 0.2, fallOff: 0.4, noise: 0.35, noiseOff: 0.25, ccvOn: 0.05, ccvOff: 0.22, ccvIdle: 0.1, jitterDeg: 1.2, lump: 0.1, miss: 0.02, off: 0.16, idle: 0.55, bark: 0.35 },
    port: { reflect: 0.7, lossHz: 6000 },
    header: { lengthM: [0.7, 0.74], area: 1, lossHz: 5000, atten: 0.985 },
    collector: { drive: 1.2 }, dual: false, turbine: { lpHz: 0 },
    pipe: { lengthM: 1.6, area: 1.6, lossHz: 4200, atten: 0.98 },
    muffler: { lengthM: 0.45, area: 6, lossHz: 2200, atten: 0.85 },
    tail: { lengthM: 0.45, area: 1.4, lossHz: 6000, atten: 0.99 },
    outlet: { reflect: -0.75, lossHz: 2500 }, radHz: 28,
    intake: { lengthM: 0.32, reflect: 0.75, open: -0.6, plenumHz: 210, plenumQ: 2.5, hiss: 0.25, gain: 0.35, offsetDeg: 400 },
    block: { hz: 140, q: 3, gain: 0.5, order1: 0.04 },
    guts: { gain: 0.45, lpHz: 170 },
    overrun: { air: 0.22, hollow: 0.6 },
    pops: { amount: 0.3, minRpm: 2800, gain: 0.9, bang: 0.15, shift: 0.25, blip: 0.3 },
    shift: { dropS: 0.05, blip: 0.06, flat: false },
    turbo: { on: false, spool: 0.6, spoolRpm: 2600, fullRpm: 4800, whineLo: 1500, whineHi: 6000, whine: 0.18, hiss: 0.25, bov: 'bov', bovGain: 0.5, flutterGain: 0.5, twin: false },
    interior: { lpHz: 800, boomHz: 95, boomDb: 5, exhaust: 1, intake: 0.9, block: 1.4, turbo: 0.8 },
    mix: { exhaust: 1, intake: 0.5, block: 0.5, turbo: 0.7, shots: 0.6 }, gain: 1, lite: false,
  };
  const COMB_GROUPS = ['firing', 'limiter', 'pulse', 'port', 'header', 'collector', 'turbine', 'pipe', 'muffler', 'tail', 'outlet', 'intake', 'block', 'guts', 'overrun', 'pops', 'shift', 'turbo', 'interior', 'mix'];

  class Combustion {
    constructor(fs, rng) {
      this.fs = fs; this.r = rng;
      const mx = (m, c) => Math.ceil(m / c * fs) + 8;
      this.h = [new Tube(mx(2.5, CX)), new Tube(mx(2.5, CX))];
      this.pi = [new Tube(mx(4, CX)), new Tube(mx(4, CX))]; this.mu = [new Tube(mx(1.5, CX)), new Tube(mx(1.5, CX))]; this.ta = [new Tube(mx(1.5, CX)), new Tube(mx(1.5, CX))];
      this.inT = new Tube(mx(1, CI));
      this.openL = [0, 0]; this.portL = [0, 0]; this.inOpen = 0; this.turbL = [0, 0];
      this.pz = []; for (let i = 0; i < 12; i++) this.pz.push({ on: false, x: 0, inc: 0, a: 0, b: 0, s: 0, n: 0 });
      this.iz = []; for (let i = 0; i < 8; i++) this.iz.push({ on: false, x: 0, inc: 0, a: 0, wait: 0 });
      this.pzI = 0; this.izI = 0;
      this.plenum = new Biquad(); this.ihiss = new Biquad(); this.blk = new Biquad(); this.blkX = 0;
      this.gLp1 = new Biquad(); this.gLp2 = new Biquad(); this.gHp = new Biquad(); this.gOut = new Biquad(); this.gEnv = 0;
      this.rad = new OnePole(); this.dc = new OnePole(); this.tnL = new OnePole(); this.tnH = new OnePole(); this.airLp = new OnePole();
      this.tw = new Biquad(); this.twPh = 0; this.twF = 1500; this.twAmp = 0; this.whAmp = 0; this.whoosh = new OnePole(); this.tw2 = new Biquad();
      this.bovBp = new Biquad(); this.bovEnv = 0; this.bovF = 3000; this.flEnv = 0; this.flPh = 0; this.flF = 14; this.flBp = new Biquad(); this.flGrain = 0;
      this.body = new Biquad(); this.boom = new Biquad();
      this.popQ = new Float64Array(16); this.popA = new Float32Array(16); this.popN = 0; this.popE = 0; this.thE = 0; this.thPh = 0; this.thF = 110;
      this.shots = [new Shot(), new Shot(), new Shot(), new Shot()]; this.bufs = {};
      this.psi = 0; this.next = 0; this.nextAbs = 0; this.crank = 0;
      this.rpm = 900; this.rpmT = 900; this.load = 0; this.thr = 0; this.armed = false; this.tLift = 9; this.igOn = true;
      this.boost = 0; this.shaft = 0; this.limOn = false; this.limRpm = 0; this.limCut = 0; this.cutT = 0; this.land = 0; this.blipT = 0; this.barkN = 0;
      this.wob = 0; this.huntPh = 0; this.view = 0; this.nos = 0; this.gears = null; this.gear = 1; this.speed = 0;
      this.meter = { boost: 0, limiter: 0, pops: 0, rpm: 0, cut: 0 }; this.pops = 0;
      this.configure(DEFAULT_COMB);
    }
    configure(p) {
      const fs = this.fs;
      p = Object.assign({}, DEFAULT_COMB, p);
      for (const k of COMB_GROUPS) p[k] = Object.assign({}, DEFAULT_COMB[k], p[k]);
      this.p = p;
      const f = p.firing, ev = f.events.map((a, i) => ({ a: ((a % 720) + 720) % 720, bank: (f.banks && f.banks[i]) | 0, w: (f.weights && f.weights[i]) || 1 }));
      ev.sort((x, y) => x.a - y.a);
      this.evA = ev.map((e) => e.a); this.evB = ev.map((e) => e.bank); this.evW = ev.map((e) => e.w); this.nEv = ev.length;
      this.banks = Math.max(...this.evB) + 1;
      this.next = 0; while (this.next < this.nEv && this.evA[this.next] < this.psi) this.next++;
      if (this.next >= this.nEv) { this.next = 0; this.nextAbs = this.evA[0] + 720; } else this.nextAbs = this.evA[this.next];
      this.sharp = blowdown(p.pulse.rise, p.pulse.fall); this.soft = blowdown(p.pulse.riseOff, p.pulse.fallOff);
      const per = (p.displacement || 2) / Math.max(1, p.cylinders || this.nEv); this.weight = Math.sqrt(per / 0.5);
      // the pipes (a bank's header lengths may differ: unequal headers are the boxer's and the tuner's rumble)
      const hl = Array.isArray(p.header.lengthM) ? p.header.lengthM : [p.header.lengthM, p.header.lengthM];
      for (let b = 0; b < 2; b++) {
        this.h[b].set(hl[b] || hl[0], CX, p.header.lossHz, p.header.atten, fs);
        const d = p.dual && b === 1 ? 1.06 : 1; // the second of true duals runs a little longer
        this.pi[b].set(p.pipe.lengthM * d, CX, p.pipe.lossHz, p.pipe.atten, fs); this.mu[b].set(p.muffler.lengthM, CX, p.muffler.lossHz, p.muffler.atten, fs); this.ta[b].set(p.tail.lengthM * d, CX, p.tail.lossHz, p.tail.atten, fs);
      }
      this.inT.set(p.intake.lengthM, CI, 5000, 0.98, fs);
      // junction weights (pressure waves: P = sum of 2 A_i a_i / sum A_i; each outgoing = P - its incoming)
      const Ah = p.header.area, Ap = p.pipe.area, Am = p.muffler.area, At = p.tail.area;
      const nb = p.dual ? 1 : Math.min(2, this.banks), sc = nb * Ah + Ap;
      this.wcH = 2 * Ah / sc; this.wcP = 2 * Ap / sc; // the collector: every header and the pipe
      this.wdH = 2 * Ah / (Ah + Ap); this.wdP = 2 * Ap / (Ah + Ap); // a true dual's header-to-pipe joint
      this.wmP = 2 * Ap / (Ap + Am); this.wmM = 2 * Am / (Ap + Am); this.wtM = 2 * Am / (Am + At); this.wtT = 2 * At / (Am + At);
      this.kPort = 1 - Math.exp(-TAU * p.port.lossHz / fs); this.kOpen = 1 - Math.exp(-TAU * p.outlet.lossHz / fs); this.kInOpen = 1 - Math.exp(-TAU * 3000 / fs);
      this.kTurb = p.turbine.lpHz > 0 ? 1 - Math.exp(-TAU * p.turbine.lpHz / fs) : 1;
      this.rad.set(p.radHz, fs); this.dc.set(16, fs); this.tnL.set(6500, fs); this.tnH.set(250, fs); this.airLp.set(1800, fs); this.whoosh.set(2500, fs);
      this.plenum.set('bp', p.intake.plenumHz, p.intake.plenumQ, 0, fs); this.ihiss.set('bp', 2400, 0.8, 0, fs);
      this.blk.set('bp', p.block.hz, p.block.q, 0, fs);
      this.gLp1.set('lp', p.guts.lpHz, 0.707, 0, fs); this.gLp2.set('lp', p.guts.lpHz, 0.707, 0, fs); this.gHp.set('hp', p.guts.lpHz * 1.1, 0.707, 0, fs); this.gOut.set('lp', 1100, 0.707, 0, fs);
      this.body.set('lp', p.interior.lpHz, 0.7, 0, fs); this.boom.set('peak', p.interior.boomHz, 1.2, p.interior.boomDb, fs);
      this.popDec = Math.exp(-1 / (0.004 * fs)); this.thDec = Math.exp(-1 / (0.016 * fs));
      this.kR = 1 - Math.exp(-1 / (Math.max(0.002, p.flywheel) * fs)); this.kL = 1 - Math.exp(-1 / (0.025 * fs)); this.kLu = 1 - Math.exp(-1 / (0.012 * fs));
      this.bovKind = p.turbo.bov === 'flutter' ? 2 : p.turbo.bov === 'both' ? 3 : p.turbo.bov === 'none' ? 0 : 1;
      this.lite = !!p.lite;
    }
    setGears(r) { this.gears = Array.isArray(r) && r.length ? r.slice() : null; }
    setSamples(b) { for (const k in b) this.bufs[k] = b[k]; }
    // a recorded one-shot (the blow-off, the flutter, a big bang), if its take has arrived; true when it played
    shot(name, gain, rate) {
      const b = this.bufs[name]; if (!b || !b.data) return false;
      let s = this.shots[0]; for (const x of this.shots) if (!x.on) { s = x; break; }
      s.b = b.data; s.p = 0; s.r = (rate || 1) * (b.rate || 48000) / this.fs; s.g = gain; s.on = true; s.end = b.data.length - 2; s.fade = 0; return true;
    }
    fadeShot(name, sec) { const b = this.bufs[name]; if (!b) return; for (const x of this.shots) if (x.on && x.b === b.data && !x.fade) { x.fade = 1; x.fk = Math.exp(-1 / (Math.max(0.01, sec) * this.fs)); } }

    shift(up, cut, gear) {
      const p = this.p, r = this.gears;
      // the automatic changes up one gear at a time and down straight to the gear that fits (perhaps several)
      const from = up !== false ? gear - 1 : (this.gear > gear ? this.gear : gear + 1); if (gear) this.gear = gear;
      const ratio = r && gear && from && r[gear - 1] && r[from - 1] ? r[gear - 1] / r[from - 1] : 0;
      if (up !== false) {
        this.cutT = clamp(cut == null ? 0.15 : +cut, 0.04, 0.5);
        this.land = ratio ? this.rpm * ratio : 0; // where the revs land: rpm x next / current ratio
        if (p.turbo.on && this.boost > 0.35 && !p.shift.flat) this.lift(0.6);
        // a flat shift (the throttle held through the ignition cut) bangs; an H-pattern lift sometimes crackles
        if (this.rpm > p.pops.minRpm && this.r.u() < p.pops.shift * (p.shift.flat ? 2.2 : 1)) { const n = 1 + ((this.r.u() * (p.shift.flat ? 3 : 2)) | 0); for (let i = 0; i < n; i++) this.queuePop(this.fs * (0.01 + 0.03 * i + 0.02 * this.r.u()), p.pops.gain * (0.5 + 0.5 * this.r.u()), i === 0 && this.r.u() < p.pops.bang * 2); }
      } else { // a downshift: the blip
        this.blipT = 0.13; this.land = ratio ? this.rpm * ratio * (1 + p.shift.blip) : this.rpm * (1 + p.shift.blip);
        if (this.rpm > p.pops.minRpm * 0.8 && this.r.u() < p.pops.blip) this.queuePop(this.fs * (0.08 + 0.05 * this.r.u()), p.pops.gain * 0.6, false);
      }
    }
    lift(k = 1) {
      this.tLift = 0;
      const t = this.p.turbo;
      if (!t.on || this.boost < 0.3 || !this.bovKind) return;
      const b = this.boost * k;
      if (this.bovKind === 1 || this.bovKind === 3) { if (!this.shot('bov', t.bovGain * b * 1.4, 0.96 + 0.08 * this.r.u())) this.bovEnv = Math.max(this.bovEnv, t.bovGain * b); this.bovF = 4200; }
      if (this.bovKind >= 2) { if (!this.shot('flutter', t.flutterGain * b * 1.4, 0.95 + 0.1 * this.r.u())) { this.flEnv = Math.max(this.flEnv, t.flutterGain * b); this.flF = 16 + 4 * this.r.u(); } }
      this.boost *= this.bovKind === 2 ? 0.55 : 0.2;
    }
    queuePop(delay, amp, big) {
      for (let j = 0; j < 16; j++) if (this.popQ[j] <= 0) { this.popQ[j] = Math.max(1, delay); this.popA[j] = big ? -amp : amp; this.popN++; return; }
    }
    fire(k, over) {
      const p = this.p, P = p.pulse, r = this.r;
      let a = this.amp * this.evW[k] * Math.max(0.05, 1 + this.ccv * r.g());
      if (!this.igOn) a = this.pump * (0.7 + 0.6 * r.u());            // no spark: the cylinder only pumps air
      else if (r.u() < this.miss) a *= 0.12;
      if (this.igOn && this.barkN > 0) { a *= 1 + P.bark; this.barkN--; } // the first firings back after a cut
      const s = this.pz[this.pzI]; this.pzI = (this.pzI + 1) % (this.lite ? 6 : this.pz.length); // lite: six pulses in flight at most
      const w = Math.min(P.maxMs / 1000, P.deg / (6 * Math.max(300, this.rpm))) * (this.igOn ? 1 : 1.4), dps = 6 * Math.max(300, this.rpm) / this.fs;
      // where the pulse is now: the degrees since its event, less its timing jitter
      s.on = true; s.inc = TN / (w * this.fs); s.x = (over - this.jit * Math.abs(r.g())) / dps * s.inc; s.a = a; s.b = this.evB[k]; s.s = this.igOn ? this.sharpNow : 0; s.n = this.igOn ? this.noiseNow : P.noiseOff;
      const q = this.iz[this.izI]; this.izI = (this.izI + 1) % this.iz.length;
      q.on = true; q.x = 0; q.wait = p.intake.offsetDeg / (6 * Math.max(300, this.rpm)) * this.fs; q.inc = TN / (Math.min(0.012, 220 / (6 * Math.max(300, this.rpm))) * this.fs); q.a = this.inAmp * this.evW[k];
      if (this.igOn) this.blkX += a * p.block.gain; // the block's thump
      if (this.popP > 0 && r.u() < this.popP && this.popN < 12) {
        const amp = p.pops.gain * (0.3 + 0.6 * r.u());
        this.queuePop(this.fs * (0.002 + 0.006 * r.u()), amp, r.u() < p.pops.bang);
        const crackle = (r.u() * 4) | 0;
        for (let c = 0; c < crackle && this.popN < 14; c++) this.queuePop(this.fs * (0.01 + 0.05 * r.u()), amp * (0.15 + 0.4 * r.u()), false);
      }
    }

    control(ctl, n) {
      const p = this.p, P = p.pulse, fs = this.fs, dt = n / fs, r = this.r;
      const thr = clamp(+ctl.throttle || 0, 0, 1), sp = Math.max(0, +ctl.speed || 0); this.speed = sp;
      if (thr > 0.5) this.armed = true;
      if (this.armed && thr < 0.2) { this.armed = false; this.lift(1); }
      this.tLift += dt; this.thr = thr;
      // 11-19 (2): the revs as the game gives them. 11-18 held them here near half the redline on a standing start, to mask
      // the game's launch (a flare to about 5,300, then a sag to 2,330); the launch clutch is now in js/car.js itself, so
      // the tach, New, Recorded, Classic and the rival all hear the same revs, and this mask is gone
      const rpmIn = clamp(+ctl.rpm || p.idleRpm, 300, 12000);
      // the limiter: a hard ignition cut, whole firings dropped, the revs bouncing under it
      const lim = p.limiterRpm;
      if (rpmIn >= lim - 60 && thr > 0.35) { if (!this.limOn) { this.limOn = true; this.limRpm = Math.min(this.rpm, lim); this.limCut = 0; } }
      else if (rpmIn < lim - 220 || thr < 0.25) this.limOn = false;
      let rpmT, ig = true;
      if (this.limOn) {
        if (this.limCut > 0) { this.limCut -= dt; this.limRpm -= p.limiter.dropRpmS * dt; ig = false; if (this.limCut <= 0) this.barkN = 1; }
        else { this.limRpm += p.limiter.dropRpmS * 2.2 * dt; if (this.limRpm >= lim) { this.limRpm = lim; this.limCut = p.limiter.cutMs / 1000 * (0.8 + 0.4 * r.u()); if (r.u() < p.limiter.pops) this.queuePop(fs * (0.004 + 0.01 * r.u()), p.pops.gain * 0.7, r.u() < 0.3); } }
        rpmT = this.limRpm;
      } else {
        this.wob = this.wob * 0.995 + r.b() * 0.0005;
        const idleF = 1 - sstep(p.idleRpm + 100, p.idleRpm + 700, rpmIn);
        this.huntPh += dt * TAU * (0.6 + 0.3 * r.u());
        rpmT = rpmIn * (1 + this.wob + idleF * (1 - thr) * (0.005 + 0.02 * P.lump) * Math.sin(this.huntPh));
      }
      // the shift: no spark for the cut, the revs falling to where the next gear lands them, then a bark
      let rpmK = this.kR;
      if (this.cutT > 0) {
        this.cutT -= dt; ig = false; if (this.land) rpmT = this.land; rpmK = 1 - Math.exp(-1 / (p.shift.dropS * fs));
        if (this.cutT <= 0) { this.land = 0; this.barkN = Math.min(3, this.nEv); }
      } else if (this.blipT > 0) { this.blipT -= dt; if (this.land) rpmT = Math.max(rpmT, this.land * (this.blipT > 0.06 ? 1 : 0.985)); rpmK = 1 - Math.exp(-1 / (0.03 * fs)); if (this.blipT <= 0) this.land = 0; }
      this.rpmT = rpmT; this.rpmK = rpmK; this.igOn = ig;
      // load and what it does to each combustion
      const blip = this.blipT > 0.05 ? 0.7 : 0;
      this.loadT = ig ? Math.max(thr, blip) : 0;
      const L = this.load, rn = clamp(this.rpm / p.redlineRpm, 0, 1.1), idleF = 1 - sstep(p.idleRpm + 150, p.idleRpm + 1200, this.rpm);
      this.nos += ((ctl.nos ? 1 : 0) - this.nos) * Math.min(1, dt / 0.15);
      const rl = 0.35 + 0.65 * Math.pow(rn, 0.8);
      let amp = P.off * (0.6 + 0.4 * rl) + (1 - P.off) * Math.pow(L, 0.8) * rl;
      amp = Math.max(amp, P.idle * idleF * (0.4 + 0.6 * L) * (ig ? 1 : 0));
      this.amp = amp * this.weight * (1 + 0.15 * this.nos); this.pump = 0.06 * this.weight * (0.5 + rn);
      this.sharpNow = clamp(L * 1.2, 0, 1); this.noiseNow = P.noise * (0.3 + 0.7 * L) * (0.6 + 0.6 * rn);
      this.ccv = P.ccvOn * L + P.ccvOff * (1 - L) + (P.ccvIdle + 0.3 * P.lump) * idleF;
      this.miss = P.miss * (1 - L) * 0.5 + P.lump * idleF * 0.05;
      this.jit = P.jitterDeg * (1 + 2.5 * (1 - L)) + P.lump * idleF * 6;
      this.drive = p.collector.drive * (0.5 + 0.5 * L) * (1 + 0.25 * this.nos);
      this.inAmp = 0.5 * (0.12 + 0.88 * thr) * this.weight;
      this.hissNow = p.intake.hiss * clamp(rn, 0, 1.2) * (0.15 + 0.85 * thr) * (1 + 0.5 * this.nos);
      this.airNow = p.overrun.air * (1 - L) * sstep(p.idleRpm + 300, p.idleRpm + 2500, this.rpm) * (0.4 + 0.6 * rn) * this.weight;
      this.o1 = p.block.order1 * this.weight * (0.4 + 0.6 * L);
      // afterfire: a burst just after a lift that settles to an occasional crackle on a long overrun
      const evPerSec = Math.max(1, this.nEv * this.rpm / 120), rpmF = sstep(p.pops.minRpm, p.pops.minRpm + 1800, this.rpm);
      let popRate = 0;
      if (L < 0.3 && ig) popRate = p.pops.amount * rpmF * (0.5 + 10 * Math.exp(-this.tLift / 0.7)) * (1 - L / 0.3);
      this.popP = popRate / evPerSec;
      // the turbo
      const t = p.turbo;
      if (t.on) {
        const want = ctl.boost >= 0 ? clamp(ctl.boost, 0, 1) : (ig ? thr : 0) * sstep(t.spoolRpm, t.fullRpm, this.rpm);
        this.boost += (want - this.boost) * (1 - Math.exp(-dt / (want > this.boost ? t.spool : 0.35)));
        this.shaft += (this.boost - this.shaft) * (1 - Math.exp(-dt / (this.boost > this.shaft ? 0.25 : 1.4)));
        const f = t.whineLo + (t.whineHi - t.whineLo) * this.shaft;
        this.twF = f; this.tw.set('bp', Math.round(f), 30, 0, fs); if (t.twin) this.tw2.set('bp', Math.round(f * 1.06), 30, 0, fs);
        this.twAmp = t.whine * this.shaft * this.shaft * (0.35 + 0.65 * L);
        this.whAmp = t.hiss * this.boost * L;
      } else { this.boost = 0; this.shaft = 0; this.twAmp = 0; this.whAmp = 0; }
      if (this.bovEnv > 1e-4) { this.bovF = Math.max(1600, this.bovF * Math.exp(-dt / 0.3)); this.bovDec = Math.exp(-1 / (0.17 * fs)); this.bovBp.set('bp', Math.round(this.bovF), 0.9, 0, fs); }
      if (this.flEnv > 1e-4) { this.flF = Math.max(6, this.flF * Math.exp(-dt / 0.9)); this.flDec = Math.exp(-1 / (0.45 * fs)); this.flBp.set('bp', 900, 1.4, 0, fs); }
      // the recorded flutter fades with the boost it is letting go of
      if (this.boost < 0.1) this.fadeShot('flutter', 0.25);
      this.view += ((ctl.view ? 1 : 0) - this.view) * Math.min(1, dt / 0.25);
      const m = this.meter; m.boost = this.boost; m.limiter = this.limOn ? 1 : 0; m.rpm = this.rpm; m.pops = this.pops; m.cut = this.igOn ? 0 : 1;
    }

    render(out, n, ctl) {
      this.control(ctl, n);
      const p = this.p, fs = this.fs, r = this.r, pz = this.pz, iz = this.iz, sh = this.sharp, so = this.soft, NP = this.lite ? 6 : pz.length, NI = this.lite ? 0 : iz.length;
      const h0 = this.h[0], h1 = this.h[1], dual = p.dual && this.banks > 1 && !this.lite, two = this.banks > 1 && !this.lite;
      const rPort = p.port.reflect, kPort = this.kPort, rOpen = p.outlet.reflect, kOpen = this.kOpen, rInV = p.intake.reflect, rInO = p.intake.open, kInO = this.kInOpen;
      const wcH = this.wcH, wcP = this.wcP, wdH = this.wdH, wdP = this.wdP, wmP = this.wmP, wmM = this.wmM, wtM = this.wtM, wtT = this.wtT, kT = this.kTurb;
      const drive = this.drive * 0.5, invD = 1 / drive, popG = p.pops.gain, gutsG = p.guts.gain, hollow = p.overrun.hollow;
      const v = this.view, mx = p.mix, ii = p.interior;
      const gEx = mx.exhaust * (1 - v), gBody = mx.exhaust * ii.exhaust * v, gIn = mx.intake * ((1 - v) + ii.intake * v * 1.6), gBl = mx.block * ((1 - v) + ii.block * v), gTu = mx.turbo * ((1 - v) + ii.turbo * v), gSh = mx.shots;
      const intakeG = p.intake.gain, turbo = p.turbo.on || this.bovEnv > 1e-4 || this.flEnv > 1e-4, twin = p.turbo.twin;
      const nch = dual ? 2 : 1;
      for (let i = 0; i < n; i++) {
        this.rpm += (this.rpmT - this.rpm) * this.rpmK;
        this.load += (this.loadT - this.load) * (this.loadT > this.load ? this.kLu : this.kL);
        const dpsi = 6 * this.rpm / fs;
        this.psi += dpsi; this.crank += dpsi; if (this.crank >= 360) this.crank -= 360;
        while (this.psi >= this.nextAbs) {
          this.fire(this.next, this.psi - this.nextAbs);
          this.next++;
          if (this.next >= this.nEv) { this.next = 0; this.nextAbs = this.evA[0] + 720; } else this.nextAbs = this.evA[this.next] + (this.nextAbs >= 720 ? 720 : 0);
        }
        if (this.psi >= 720) { this.psi -= 720; this.nextAbs -= 720; }
        // the pulses, into each bank's exhaust port; the suction pulses into the intake valve
        const w1 = r.b(), w2 = r.b(), tn = this.tnL.lp(this.tnH.hp(w1));
        let e0 = 0, e1 = 0, iv = 0;
        for (let j = 0; j < NP; j++) {
          const s = pz[j]; if (!s.on) continue;
          const x = s.x; s.x += s.inc;
          if (x < 0) continue;
          if (x >= TN) { s.on = false; continue; }
          const k = x | 0, f = x - k, a = so[k] + (so[k + 1] - so[k]) * f, b = sh[k] + (sh[k + 1] - sh[k]) * f, env = a + (b - a) * s.s;
          const val = env * s.a * (1 + s.n * tn * 2.2);
          if (s.b && two) e1 += val; else e0 += val;
        }
        for (let j = 0; j < NI; j++) {
          const q = iz[j]; if (!q.on) continue;
          if (q.wait > 0) { q.wait--; continue; }
          const x = q.x; q.x += q.inc; if (x >= TN) { q.on = false; continue; }
          const k = x | 0; iv -= (so[k] + (so[k + 1] - so[k]) * (x - k)) * q.a;
        }
        // overrun: the engine pumping air through closed throttle plates, a hollow rush through the pipes
        const air = this.airNow > 1e-5 ? this.airLp.lp(w2) * this.airNow : 0;
        e0 += air; if (two) e1 += air * 0.9;
        // ---- the exhaust network
        h0.read(); if (two) h1.read();
        this.portL[0] += kPort * (h0.al - this.portL[0]);
        if (two) this.portL[1] += kPort * (h1.al - this.portL[1]);
        let y = 0;
        for (let c = 0; c < nch; c++) {
          const pi = this.pi[c], mu = this.mu[c], ta = this.ta[c];
          pi.read(); if (!this.lite) mu.read(); ta.read();
          // the collector (both headers and the pipe), or a true dual's joint (one header, its own pipe)
          let P, toPipe;
          if (dual) { const hh = c ? h1 : h0; P = wdH * hh.ar + wdP * pi.al; P = softclip(P * drive) * invD; hh.write((c ? e1 : e0) + rPort * this.portL[c], P - hh.ar); toPipe = P - pi.al; }
          else {
            P = wcH * h0.ar + (two ? wcH * h1.ar : 0) + wcP * pi.al; P = softclip(P * drive) * invD;
            h0.write(e0 + rPort * this.portL[0], P - h0.ar); if (two) h1.write(e1 + rPort * this.portL[1], P - h1.ar);
            toPipe = P - pi.al;
          }
          if (kT < 1) { this.turbL[c] += kT * (toPipe - this.turbL[c]); toPipe = this.turbL[c]; } // the turbine smooths the pulses
          // pipe -> muffler -> tailpipe (pops fired in at the tailpipe's inlet) -> the open end
          let pop = 0;
          if (c === 0 && (this.popN > 0 || this.popE > 1e-5 || this.thE > 1e-5)) {
            if (this.popN > 0) for (let j = 0; j < 16; j++) if (this.popQ[j] > 0 && --this.popQ[j] <= 0) {
              this.popN--; this.pops++; const A = this.popA[j], big = A < 0, a = Math.abs(A);
              if (big && this.shot(r.u() < 0.6 ? 'bang' : 'boom', a * 0.9, 0.92 + 0.16 * r.u())) continue;
              if (a > this.popE) this.popE = a * (big ? 1.6 : 1); this.thE = Math.max(this.thE, a * (big ? 1.8 : 0.8)); this.thPh = 0; this.thF = big ? 70 + 30 * r.u() : 110 + 60 * r.u();
            }
            this.popE *= this.popDec; this.thE *= this.thDec; this.thPh += this.thF / fs; if (this.thPh >= 1) this.thPh -= 1;
            pop = (this.popE * w2 * 1.6 + this.thE * Math.sin(TAU * this.thPh)) * popG * 0.3; // into the tailpipe, about as loud as the engine on full throttle
          }
          let toTail;
          if (this.lite) { const Pm = wmP * pi.ar + wmM * ta.al; pi.write(toPipe, Pm - pi.ar); toTail = Pm - ta.al; }
          else {
            const Pm = wmP * pi.ar + wmM * mu.al; pi.write(toPipe, Pm - pi.ar);
            const Pt = wtM * mu.ar + wtT * ta.al; mu.write(Pm - mu.al, Pt - mu.ar); toTail = Pt - ta.al;
          }
          this.openL[c] += kOpen * (ta.ar - this.openL[c]);
          ta.write(toTail + pop, rOpen * this.openL[c]);
          y += ta.ar * (1 - 0.35 * rOpen) * (1 + hollow * (1 - this.load) * 0.3);
        }
        if (dual) y *= 0.7;
        const ex = this.rad.hp(y);
        // the guts: the low band's harmonics, regenerated (a full-wave and a squared copy), for speakers without bass
        const lb = this.gLp2.run(this.gLp1.run(ex)); this.gEnv += 0.002 * (Math.abs(lb) - this.gEnv);
        const xn = lb / (this.gEnv + 1e-4), gh = this.gOut.run(this.gHp.run((0.55 * xn * Math.abs(xn) + 0.45 * Math.abs(xn)) * this.gEnv));
        // the intake: suction pulses up the runner, a closed valve at one end, the plenum at the other
        let inOut = 0;
        if (!this.lite) { this.inT.read(); this.inOpen += kInO * (this.inT.ar - this.inOpen); this.inT.write(iv + rInV * this.inT.al, rInO * this.inOpen); inOut = this.plenum.run(this.inT.ar + this.ihiss.run(w1) * this.hissNow) * intakeG; }
        else inOut = this.plenum.run(iv * 0.5 + this.ihiss.run(w1) * this.hissNow) * intakeG;
        // the block: a thump for every combustion, and the crank's own first order
        const bl = this.blk.run(this.blkX) * 3 + Math.sin(TAU * this.crank / 360) * this.o1; this.blkX = 0;
        // the turbo
        let tu = 0;
        if (turbo) {
          this.twPh += this.twF / fs; if (this.twPh >= 1) this.twPh -= 1;
          tu = (Math.sin(TAU * this.twPh) * 0.3 + this.tw.run(w1) * 3) * this.twAmp + this.whoosh.hp(w2) * this.whAmp * 0.45;
          if (twin) tu += this.tw2.run(w2) * 2 * this.twAmp;
          if (this.bovEnv > 1e-4) { this.bovEnv *= this.bovDec; tu += this.bovBp.run(w1) * this.bovEnv * 2.4; }
          if (this.flEnv > 1e-4) { this.flEnv *= this.flDec; this.flPh += this.flF / fs; if (this.flPh >= 1) this.flPh -= 1; const c = Math.max(0, Math.sin(TAU * this.flPh)); tu += this.flBp.run(w2) * this.flEnv * (0.15 + 2.2 * c * c * c * c); }
        }
        // the recorded one-shots that have arrived (blow-off, flutter, big bangs)
        let sv = 0;
        for (let j = 0; j < 4; j++) {
          const s = this.shots[j]; if (!s.on) continue;
          const k = s.p | 0; if (k >= s.end) { s.on = false; continue; }
          const d = s.b, f = s.p - k; sv += (d[k] + (d[k + 1] - d[k]) * f) * s.g; s.p += s.r;
          if (s.fade) { s.g *= s.fk; if (s.g < 1e-4) s.on = false; }
        }
        let o = (ex + gh * gutsG) * gEx + inOut * gIn + bl * gBl + tu * gTu + sv * gSh;
        if (v > 0.001) { o += this.body.run(ex + gh * gutsG) * gBody; o = this.boom.run(o); }
        o = this.dc.hp(o * p.gain);
        out[i] = o > 0.9 ? 0.9 + 0.1 * softclip((o - 0.9) * 10) : o < -0.9 ? -0.9 + 0.1 * softclip((o + 0.9) * 10) : o;
      }
    }
  }

  // 11-18, synth 2: the tyres' squeal in three layers (Sega's method, US8078300, as Indaga found it), crossfaded by
  // how far past grip the tyre is: a HOWL near the limit (almost a pure tone), a SQUEAL past it, a SCREECH deep in a
  // slide; louder with more slip; the pitch 500-1,500 Hz, falling as the load and the slip grow. The squeal and the
  // screech play the recorded squeal takes once they have arrived (squeal-light, squeal-heavy: steady loops, pitched by
  // the same rule); until then, and if they never do, they are synthesised.
  class Loop { constructor(rng) { this.p = rng.u() * 1000; } }
  class Squeal2 {
    constructor(fs, rng) {
      this.fs = fs; this.r = rng; this.v = [];
      for (let k = 0; k < 2; k++) this.v.push({ det: k ? 1.018 : 0.984, ph: rng.u(), wob: 0, amPh: rng.u(), amF: 10, ch: 0, chT: 0, h1: new Biquad(), s1: new Biquad(), s2: new Biquad(), a1: new Biquad(), a2: new Biquad(), lL: new Loop(rng), lH: new Loop(rng), gH: 0, gS: 0, gA: 0, f: 1000 });
      this.takes = {}; this.cb = [new Biquad(), new Biquad()];
    }
    control(c, I, f0, loud, fs) {
      // the three layers' weights: sine-shaped bumps on the slide (I, 0..1)
      const bump = (x, a, m, b) => (x <= a || x >= b ? 0 : x < m ? Math.sin(HALF * (x - a) / (m - a)) : Math.cos(HALF * (x - m) / (b - m)));
      const wH = bump(I, 0.02, 0.2, 0.5), wS = bump(I, 0.2, 0.5, 0.9), wA = sstep(0.5, 0.92, I);
      for (const vo of this.v) {
        vo.wob = vo.wob * 0.96 + this.r.b() * 0.006;
        const f = f0 * vo.det * (1 + clamp(vo.wob, -0.04, 0.04)); vo.f = f;
        vo.h1.set('bp', Math.round(f * 1.04), 42, 0, fs);
        vo.s1.set('bp', Math.round(f), 18, 0, fs); vo.s2.set('bp', Math.round(f * 2.03), 14, 0, fs);
        vo.a1.set('bp', Math.round(f * 0.9), 6, 0, fs); vo.a2.set('bp', Math.round(f * 2.3), 3.5, 0, fs);
        if (this.r.u() < 0.08) vo.amF = 8 + 7 * this.r.u();
        vo.gH = wH * loud * 1.1; vo.gS = wS * loud; vo.gA = wA * loud * 1.15;
      }
      this.cb[0].set('bp', Math.round(this.v[0].f * 1.08), 16, 0, fs); this.cb[1].set('bp', Math.round(this.v[1].f * 1.08), 16, 0, fs);
    }
    chirp(k, ch, w) { const vo = this.v[k]; return this.cb[k].run(Math.sin(TAU * vo.ph) * 0.5 + w * 0.6) * ch * 1.8; }
    voice(k, w, fs) {
      const vo = this.v[k], r = this.r;
      vo.ph += vo.f / fs; if (vo.ph >= 1) vo.ph -= 1; vo.amPh += vo.amF / fs; if (vo.amPh >= 1) vo.amPh -= 1;
      const tone = Math.sin(TAU * vo.ph);
      let y = 0;
      if (vo.gH > 1e-5) y += vo.h1.run(tone * 0.6 + w * 0.5) * vo.gH * 3.3;
      const tL = this.takes.light, tH = this.takes.heavy;
      if (vo.gS > 1e-5) {
        if (tL) y += this.loop(tL, vo.lL, vo.f / tL.hz) * vo.gS * tL.g;
        else { const am = 1 - 0.32 * (0.5 + 0.5 * Math.sin(TAU * vo.amPh)), e = tone * 0.45 + w * 0.7; y += (vo.s1.run(e) + 0.35 * vo.s2.run(e)) * vo.gS * am * 2.4; }
      }
      if (vo.gA > 1e-5) {
        if (tH) y += this.loop(tH, vo.lH, vo.f / tH.hz) * vo.gA * tH.g;
        else { const ch = 1 - 0.45 * (r.u() < 0.002 ? 1 : 0.5 + 0.5 * Math.sin(TAU * vo.amPh * 1.7)), e = w * 1.2 + tone * 0.2; y += (vo.a1.run(e) + 0.4 * vo.a2.run(e)) * vo.gA * ch * 2.1; }
      }
      return y;
    }
    loop(t, l, rate) {
      const d = t.data, a = t.ls, b = t.le;
      let p = l.p; if (p < a || p >= b) p = a + ((p - a) % (b - a) + (b - a)) % (b - a);
      const k = p | 0, f = p - k, y = d[k] + (d[k + 1] - d[k]) * f;
      p += rate * t.rr; if (p >= b) p -= b - a; l.p = p; return y;
    }
  }
  const HALF = Math.PI / 2;

  class DriftCarDSP {
    constructor(fs, seed) {
      const s = seed || 20261115;
      this.fs = fs; this.seed = s; this.engine = new Engine(fs, new Rng(s)); this.tyres = new Tyres(fs, new Rng(s * 7 + 1)); this.comb = null; this.model = 'classic';
      this.ctl = { rpm: 900, throttle: 0, boost: -1, slip: 0, slipN: -1, spin: 0, lock: 0, front: 0, speed: 0, surface: 'asphalt', view: 0, nos: 0 };
    }
    message(m) {
      if (!m) return;
      if (m.type === 'ctl') Object.assign(this.ctl, m.v);
      else if (m.type === 'config') {
        // 11-18: an engine with model 'combustion' is synth 2 (Engine sound: New); any other is the classic engine
        if (m.engine) { if (m.engine.model === 'combustion') { if (!this.comb) this.comb = new Combustion(this.fs, new Rng(this.seed * 3 + 5)); this.comb.configure(m.engine); this.model = 'combustion'; } else { this.engine.configure(m.engine); this.model = 'classic'; } }
        if (m.tyres) this.tyres.configure(m.tyres);
      }
      else if (m.type === 'shift') { if (this.model === 'combustion') this.comb.shift(m.up, m.cut, m.gear); else this.engine.shift(m.cut); }
      else if (m.type === 'gears') { if (!this.comb) this.comb = new Combustion(this.fs, new Rng(this.seed * 3 + 5)); this.comb.setGears(m.ratios); }
      else if (m.type === 'samples') { // 11-18: recorded one-shots and squeal loops for synth 2, as Float32Arrays
        if (!this.comb) this.comb = new Combustion(this.fs, new Rng(this.seed * 3 + 5));
        this.comb.setSamples(m.bufs || {});
        if (this.tyres.s2 || (m.bufs && m.bufs.squealLight)) { if (!this.tyres.s2) this.tyres.s2 = new Squeal2(this.fs, this.tyres.r); const b = m.bufs || {}; if (b.squealLight) this.tyres.s2.takes.light = b.squealLight; if (b.squealHeavy) this.tyres.s2.takes.heavy = b.squealHeavy; }
      }
      // 11-17: under a recorded engine and tyres this car keeps only its wind, and no engine is computed at all
      else if (m.type === 'parts') { this.engineOn = m.engine !== false; this.tyres.windOnly = m.tyres === 'wind'; }
    }
    get meter() { return this.model === 'combustion' ? this.comb.meter : this.engine.meter; }
    render(eng, tl, tr, n) { if (this.engineOn === false) eng.fill(0); else if (this.model === 'combustion') this.comb.render(eng, n, this.ctl); else this.engine.render(eng, n, this.ctl); this.tyres.render(tl, tr, n, this.ctl); }
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
        if (this.meter && ++this.blocks % 12 === 0) this.port.postMessage(this.dsp.meter);
        return true;
      }
    }
    registerProcessor('drift-car', DriftCarProcessor);
  }
  G.DriftDSP = { DriftCarDSP, Engine, Tyres, Combustion, Squeal2, Rng, Biquad, version: 2 };
})(typeof globalThis !== 'undefined' ? globalThis : this);
