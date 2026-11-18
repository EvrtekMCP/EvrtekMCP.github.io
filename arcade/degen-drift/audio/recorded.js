// DRIFTLINE: recorded engines and tyres (Evrtek 11-17, after test v10: "Engines need to sound amazing. Wheel squeal
// needs to be awesome."). Whole ElevenLabs takes, played the way a racing game plays a recorded engine:
//   - the engine is steady-rev loops in bands (idle, low, mid, high), each ON the throttle (load) and OFF it (overrun);
//     neighbouring bands crossfade at equal power as the revs move, ON and OFF crossfade by the throttle, and every
//     loop's playbackRate follows the revs, so all of them sound the engine's firing rate at once (rate = rpm / the
//     take's own revs, measured from its pitch by tools/sound/master-rec.mjs);
//   - lifting closes a low-pass on the loaded loops (and the top band's overrun IS its loaded loop, low-passed);
//   - a gear change and the rev limiter are brief cuts (the level dips, the load drops), as an ignition cut is;
//   - the turbo's blow-off and the exhaust's pops are their own takes, played on a lift, with a small random pitch
//     and level each time;
//   - the tyres: a light and a heavy squeal loop crossfaded by the slide, their level and pitch following the slip
//     angle and the speed, a chirp on turn-in and on regrip, road roar, gravel and kerb loops by the surface.
// Nothing is synthesised and no two unrelated takes are layered into one sound: the runtime only crossfades, pitches
// and filters (Evrtek's sound rules, 11-17). The set loads after the first tap, like the effects (about 330 KB Opus).
// Used by audio/driftaudio.js: setEngineSound('recorded' | 'classic'); 'recorded' plays this for a preset in SETS.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const dbg = (db) => Math.pow(10, db / 20);
const HALF_PI = Math.PI / 2;

// engine preset -> recorded set. The other five cars stay synthesised until Evrtek approves this one (11-17).
export const SETS = { turbo4: 'kestrel' };

// How each set is played. File facts (loop points, loudness, measured pitch) come from <set>.json, written by
// tools/sound/master-rec.mjs; the choices are here.
export const DESIGN = {
  kestrel: {
    engine: {
      // rpm: where the band plays alone. off: its overrun loop; offLp: the overrun is the loaded loop low-passed here
      bands: [
        { rpm: 950, on: 'idle', off: 'idle' },
        { rpm: 2500, on: 'low-on', off: 'low-off' },
        { rpm: 4300, on: 'mid-on', off: 'mid-off' },
        { rpm: 6600, on: 'high-on', off: 'high-on', offLp: 1100, offDb: -6 },
      ],
      // the crossfade between each pair of neighbouring bands, in rpm (equal power, on a log scale of the revs)
      xf: [[1300, 2300], [2900, 3900], [4500, 5500]],
      // takes with no steady pitch (a lumpy idle, a burble): the revs they stand for
      native: { idle: 950, 'low-off': 2400 },
      // the RMS level each loop plays at, dB (the masters are all at -1 dBFS peak; the manifest has their RMS), set by
      // tools/sound/calibrate-rec.mjs so the recorded engine is as loud as the synthesised one on the same runs
      level: { idle: -24.5, 'low-on': -21.5, 'low-off': -27.5, 'mid-on': -20.5, 'mid-off': -26.5, 'high-on': -19.5 },
      rate: [0.3, 2.4],
    },
    oneshots: { bov: -24, bang: -24, boom: -24 },
    interior: { lpHz: 1900, shelfDb: 4, db: -2.2 }, // inside: the exhaust through the body, a little cabin boom, a little quieter
    tyres: {
      // calibrated as the engine: the squeal sits 1.5 dB above the synthesised one's on the same drift
      level: { 'squeal-light': -19.7, 'squeal-heavy': -16.7, roar: -26.7, gravel: -20.7, kerb: -20.7, 'chirp-1': -19.7, 'chirp-2': -19.7 },
      onsetDeg: 5, fullDeg: 30, // the street compound's slide window (audio/car-sounds.js)
    },
  },
};

// fetch and decode a set (once per audio context; `get(path)` is driftaudio's stamped fetch-and-decode)
export async function loadSet(id, json, get) {
  const meta = await json('rec/' + id + '/' + id + '.json');
  const buf = new Map();
  await Promise.all(Object.keys(meta.files).map(async (name) => { buf.set(name, await get('rec/' + id + '/' + name)); }));
  return { id, meta, buf, design: DESIGN[id] };
}

class Rng { constructor(s) { this.s = (s >>> 0) || 0x2545f491; } u() { let x = this.s; x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; this.s = x; return x / 4294967296; } }

// One car's recorded engine and tyres: engine out to `eng`, tyres to `tyr` (driftaudio's buses, or a rival voice's).
export class RecordedCar {
  constructor(ctx, set, eng, tyr, opts = {}) {
    this.ctx = ctx; this.set = set; this.D = set.design; this.files = set.meta.files; this.rng = new Rng(opts.seed || 1117);
    this.out = { eng, tyr }; this.on = false; this.redline = opts.redline || 7600;
    this.c = { rpm: 950, throttle: 0, boost: -1, slip: 0, slipN: -1, spin: 0, lock: 0, front: 0, speed: 0, surface: 'asphalt', view: 0 };
    this.st = { t: -1, L: 0, I: 0, Ipeak: 0, Ilow: 0, boost: 0, thrHi: false, liftT: -9, holdTo: 0, limNext: 0, chirpT: -9, lastChirp: '', kerb: 0, gravel: 0, view: -1 };
  }
  gainOf(name, db) { return dbg(db - this.files[name].rmsDb); }
  native(name) { const f = this.files[name]; return f.f0 ? f.f0 * 30 : this.D.engine.native[name] || 1000; }

  start() {
    if (this.on) return; this.on = true;
    const ctx = this.ctx, E = this.D.engine, g = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    const N = (this.nodes = {});
    // the engine: loaded loops through the lift-off low-pass; overrun loops straight; then the cut, then the view
    N.busOn = g(1); N.busOff = g(1); N.cut = g(1); N.post = g(1);
    N.liftLp = ctx.createBiquadFilter(); N.liftLp.type = 'lowpass'; N.liftLp.frequency.value = 18000; N.liftLp.Q.value = -3; // Web Audio reads a low-pass Q in dB: -3 is a flat (Butterworth) one
    N.viewLp = ctx.createBiquadFilter(); N.viewLp.type = 'lowpass'; N.viewLp.frequency.value = 20000; N.viewLp.Q.value = -3;
    N.viewShelf = ctx.createBiquadFilter(); N.viewShelf.type = 'lowshelf'; N.viewShelf.frequency.value = 160; N.viewShelf.gain.value = 0;
    N.busOn.connect(N.liftLp).connect(N.cut); N.busOff.connect(N.cut);
    N.cut.connect(N.post); N.post.connect(N.viewLp).connect(N.viewShelf).connect(this.out.eng);
    // one looping source per take; a band's ON and OFF paths are gains off those sources
    this.src = new Map();
    const loop = (name) => {
      if (this.src.has(name)) return this.src.get(name);
      const f = this.files[name], s = ctx.createBufferSource(); s.buffer = this.set.buf.get(name); s.loop = true; s.loopStart = f.loopStart; s.loopEnd = f.loopEnd;
      s.start(ctx.currentTime, f.loopStart + this.rng.u() * (f.loopEnd - f.loopStart)); // each car from its own place in the loop
      this.src.set(name, s); return s;
    };
    this.bands = E.bands.map((b) => {
      const B = { b, on: loop(b.on), gOn: g(0) };
      B.on.connect(B.gOn).connect(N.busOn);
      if (b.off !== b.on) { B.off = loop(b.off); B.gOff = g(0); B.off.connect(B.gOff).connect(N.busOff); }
      else if (b.offLp) { B.lp = ctx.createBiquadFilter(); B.lp.type = 'lowpass'; B.lp.frequency.value = b.offLp; B.lp.Q.value = -3; B.gOff = g(0); B.on.connect(B.lp).connect(B.gOff).connect(N.busOff); }
      return B;
    });
    // the tyres
    N.tyr = g(1); N.tyrLp = ctx.createBiquadFilter(); N.tyrLp.type = 'lowpass'; N.tyrLp.frequency.value = 20000; N.tyrLp.Q.value = -3;
    N.tyr.connect(N.tyrLp).connect(this.out.tyr);
    this.ty = {};
    for (const name of ['squeal-light', 'squeal-heavy', 'roar', 'gravel', 'kerb']) { const s = loop(name), gn = g(0); s.connect(gn).connect(N.tyr); this.ty[name] = { s, g: gn }; }
    this.st.t = -1; this.st.view = -1;
    this.apply(true);
  }
  stop() {
    if (!this.on) return; this.on = false;
    for (const s of this.src.values()) { try { s.stop(); s.disconnect(); } catch (e) { /* gone */ } }
    try { this.nodes.viewShelf.disconnect(); this.nodes.tyrLp.disconnect(); } catch (e) { /* gone */ }
    this.src.clear(); this.nodes = null;
  }
  setActive(a) { if (a) this.start(); else this.stop(); }
  setRedline(r) { if (r) this.redline = r; }

  // controls, the same names as the synthesised car's: rpm, throttle, boost, slip (degrees) or slipN (share 0..1),
  // spin, lock, front, speed (m/s), surface, view (0 chase, 1 interior)
  update(c) { Object.assign(this.c, c); if (this.on) this.apply(false); }

  shift(up = true, cut = 0.15) {
    if (!this.on) return;
    const t = this.ctx.currentTime, k = this.nodes.cut.gain;
    cut = up ? clamp(+cut || 0.15, 0.04, 0.4) : Math.min(clamp(+cut || 0.06, 0.03, 0.4), 0.06); // a downshift is a short blip, not a cut
    k.cancelScheduledValues(t); k.setTargetAtTime(up ? 0.18 : 0.55, t, 0.006); k.setTargetAtTime(1, t + cut, 0.035);
    this.st.holdTo = t + cut; // the load drops for the cut: the overrun loops come up under it
    if (up && this.c.rpm > 4200 && this.st.boost > 0.5) { this.oneshot('bov', 0.45 * this.st.boost, 0.02); this.st.boost *= 0.4; }
    if (up && this.c.rpm > 5200 && this.rng.u() < 0.3) this.oneshot(this.rng.u() < 0.5 ? 'bang' : 'boom', 0.5, cut * 0.5);
    this.apply(false);
  }

  oneshot(name, gain = 1, delay = 0, bus) {
    const ctx = this.ctx, f = this.files[name]; if (!f || !this.on) return;
    const db = (this.D.oneshots[name] ?? this.D.tyres.level[name] ?? -18);
    const s = ctx.createBufferSource(), gn = ctx.createGain();
    s.buffer = this.set.buf.get(name);
    s.playbackRate.value = 1 + (this.rng.u() - 0.5) * 0.08;              // a little pitch, a little level, each time
    gn.gain.value = gain * this.gainOf(name, db) * dbg((this.rng.u() - 0.5) * 3);
    s.connect(gn).connect(bus || this.nodes.post);
    s.start(ctx.currentTime + delay);
    s.onended = () => { try { gn.disconnect(); } catch (e) { /* gone */ } };
  }

  apply(first) {
    const ctx = this.ctx, now = ctx.currentTime, c = this.c, st = this.st, E = this.D.engine, N = this.nodes;
    const dt = st.t < 0 ? 0 : clamp(now - st.t, 0, 0.1); st.t = now;
    const set = (p, v, tau) => { if (first) p.setValueAtTime(v, now); else p.setTargetAtTime(v, now, tau); };
    const rpm = clamp(+c.rpm || 0, 300, 12000), thr = clamp(+c.throttle || 0, 0, 1);

    // ---- load: the throttle, held off through a shift cut, eased (quick on, a little slower off)
    const Lw = now < st.holdTo ? 0 : sstep(0.02, 0.5, thr);
    st.L += (Lw - st.L) * (dt ? Math.min(1, dt / (Lw > st.L ? 0.05 : 0.12)) : 1);
    const L = st.L;
    // ---- the rev limiter: an ignition cut, chopping at about 12 a second while the throttle holds it there
    if (rpm >= this.redline - 60 && thr > 0.5 && now >= st.limNext) {
      const k = N.cut.gain; k.cancelScheduledValues(now); k.setTargetAtTime(0.3, now, 0.004); k.setTargetAtTime(1, now + 0.04, 0.01);
      st.limNext = now + 0.075 + this.rng.u() * 0.03;
      if (this.rng.u() < 0.12) this.oneshot(this.rng.u() < 0.5 ? 'bang' : 'boom', 0.35, 0.02);
    }
    // ---- the turbo (an estimate: the game does not pass boost), the blow-off and the overrun pops on a lift
    const want = thr > 0.5 ? sstep(2600, 4600, rpm) : 0, bst = c.boost >= 0 ? c.boost : null;
    st.boost = bst != null ? bst : st.boost + (want - st.boost) * Math.min(1, dt / (want > st.boost ? 0.7 : 0.3));
    if (thr > 0.6) st.thrHi = true;
    else if (st.thrHi && thr < 0.15) {
      st.thrHi = false; st.liftT = now;
      if (st.boost > 0.35) this.oneshot('bov', 0.5 + 0.5 * st.boost, 0.01);
      if (rpm > 3800) { const n = 1 + Math.floor(this.rng.u() * 2 + sstep(3800, 7000, rpm) * 2); for (let i = 0; i < n; i++) this.oneshot(this.rng.u() < 0.6 ? 'bang' : 'boom', 0.7 - i * 0.12, 0.06 + i * (0.12 + this.rng.u() * 0.25)); }
    }
    if (thr < 0.1 && rpm > 4200 && now - st.liftT < 2.5 && this.rng.u() < dt * 1.6 * (1 - (now - st.liftT) / 2.5)) this.oneshot(this.rng.u() < 0.5 ? 'bang' : 'boom', 0.3 + 0.3 * this.rng.u(), 0);

    // ---- the bands: which play (equal power across each crossfade), ON against OFF, and every loop's rate
    const w = new Array(this.bands.length).fill(0), lr = Math.log(rpm);
    let done = false;
    for (let i = 0; i < E.xf.length && !done; i++) {
      const [a, b] = E.xf[i];
      if (rpm < a) { w[i] = 1; done = true; }
      else if (rpm <= b) { const x = (lr - Math.log(a)) / (Math.log(b) - Math.log(a)); w[i] = Math.cos(x * HALF_PI); w[i + 1] = Math.sin(x * HALF_PI); done = true; }
    }
    if (!done) w[w.length - 1] = 1;
    const onG = Math.sin(L * HALF_PI), offG = Math.cos(L * HALF_PI);
    const rate = (name) => clamp(rpm / this.native(name), E.rate[0], E.rate[1]);
    for (let i = 0; i < this.bands.length; i++) {
      const B = this.bands[i], b = B.b, lvOn = this.gainOf(b.on, E.level[b.on]);
      set(B.on.playbackRate, rate(b.on), 0.025);
      if (b.off === b.on && !b.offLp) set(B.gOn.gain, w[i] * lvOn * (0.8 + 0.2 * L), 0.03);            // one sound both ways (the idle)
      else if (b.offLp) { set(B.gOn.gain, w[i] * lvOn * L, 0.03); set(B.gOff.gain, w[i] * lvOn * dbg(b.offDb || 0) * (1 - L), 0.03); } // one take, two paths: linear
      else { set(B.gOn.gain, w[i] * lvOn * onG, 0.03); set(B.gOff.gain, w[i] * this.gainOf(b.off, E.level[b.off]) * offG, 0.03); set(B.off.playbackRate, rate(b.off), 0.025); }
    }
    set(N.liftLp.frequency, 900 + 17000 * Math.pow(L, 1.6), 0.04);

    // ---- the view: inside, the exhaust comes through the body (low-passed) with a little cabin boom
    const view = c.view ? 1 : 0;
    if (view !== st.view) {
      st.view = view;
      const V = this.D.interior;
      set(N.viewLp.frequency, view ? V.lpHz : 20000, 0.12); set(N.viewShelf.gain, view ? V.shelfDb : 0, 0.12); set(N.post.gain, view ? dbg(V.db) : 1, 0.12); set(N.tyrLp.frequency, view ? 2200 : 20000, 0.12);
    }

    // ---- the tyres: the slide (the game's share, read as 45 degrees, or degrees), wheelspin, a locked rear
    const T = this.D.tyres, sp = Math.max(0, +c.speed || 0), useN = c.slipN != null && c.slipN >= 0;
    const ang = useN ? c.slipN * 45 : Math.abs(+c.slip || 0), spin = clamp(+c.spin || 0, 0, 1), lock = clamp(+c.lock || 0, 0, 1);
    const spdF = sstep(1.5, 9, sp), slide = sstep(T.onsetDeg, T.fullDeg, ang);
    const Iw = Math.max(slide * (useN ? 1 : spdF), spin * 0.85 * sstep(0.02, 0.15, spin), lock * 0.9 * spdF, clamp(+c.front || 0, 0, 1) * 0.4 * spdF);
    const Iprev = st.I;
    st.I += (Iw - st.I) * (dt ? Math.min(1, dt / (Iw > st.I ? 0.03 : 0.08)) : 1);
    const I = st.I;
    // chirps: a turn-in bark as a slide starts, a regrip as one lets go (never two within 0.25 s, never the same twice)
    if (I < 0.12) st.Ilow = now;
    if (I > st.Ipeak) st.Ipeak = I;
    const chirp = (gain) => { if (now - st.chirpT < 0.25) return; st.chirpT = now; const n = st.lastChirp === 'chirp-1' ? 'chirp-2' : st.lastChirp === 'chirp-2' ? 'chirp-1' : this.rng.u() < 0.5 ? 'chirp-1' : 'chirp-2'; st.lastChirp = n; this.oneshot(n, gain, 0, N.tyr); };
    if (Iprev < 0.3 && I >= 0.3 && now - st.Ilow < 0.3 && sp > 6) chirp(0.55);
    if (st.Ipeak > 0.5 && I < 0.2 && sp > 5) { chirp(0.5 + 0.4 * Math.min(1, st.Ipeak)); st.Ipeak = 0; }
    if (I < 0.05) st.Ipeak = Math.min(st.Ipeak, 0.3);
    // surfaces, eased in over a few frames
    st.kerb += ((c.surface === 'kerb' ? 1 : 0) - st.kerb) * (dt ? Math.min(1, dt / 0.06) : 1);
    st.gravel += ((c.surface === 'gravel' ? 1 : 0) - st.gravel) * (dt ? Math.min(1, dt / 0.06) : 1);
    const lv = T.level, ty = this.ty;
    // the heavy loop never fully replaces the light one (at most 80% of the way), so its short loop never repeats alone
    const loud = Math.pow(I, 0.7) * (0.55 + 0.45 * Math.min(1, sp / 30)) * (1 - st.gravel), heavy = 0.8 * sstep(0.35, 0.8, I);
    const sqRate = (0.93 + 0.12 * I) * (0.96 + 0.08 * Math.min(1, sp / 40)) * (1 - 0.15 * lock);
    set(ty['squeal-light'].g.gain, loud * Math.cos(heavy * HALF_PI) * this.gainOf('squeal-light', lv['squeal-light']), 0.03);
    set(ty['squeal-heavy'].g.gain, loud * Math.sin(heavy * HALF_PI) * this.gainOf('squeal-heavy', lv['squeal-heavy']), 0.03);
    set(ty['squeal-light'].s.playbackRate, sqRate, 0.04); set(ty['squeal-heavy'].s.playbackRate, sqRate, 0.04);
    set(ty.roar.g.gain, Math.pow(Math.min(sp, 70) / 40, 1.25) * (1 - 0.5 * st.gravel) * this.gainOf('roar', lv.roar), 0.08);
    set(ty.roar.s.playbackRate, 0.8 + 0.4 * Math.min(1, sp / 50), 0.1);
    set(ty.gravel.g.gain, st.gravel * (0.35 + 0.65 * I) * Math.min(1, sp / 8) * this.gainOf('gravel', lv.gravel), 0.05);
    set(ty.gravel.s.playbackRate, 0.85 + 0.3 * Math.min(1, sp / 30), 0.1);
    set(ty.kerb.g.gain, st.kerb * Math.min(1, sp / 12) * this.gainOf('kerb', lv.kerb), 0.04);
    set(ty.kerb.s.playbackRate, clamp(0.6 + sp / 40, 0.6, 1.6), 0.1);
  }

  dispose() { this.stop(); }
}
