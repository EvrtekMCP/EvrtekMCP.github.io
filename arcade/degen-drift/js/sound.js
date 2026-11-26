// DRIFTLINE: every game sound goes through this one object, by the names the sound builder's module uses (Dirigent
// 11-15): setRPM, setThrottle, setSlip, setSpeed, impact(kind, strength), nos(on), ui(name), music(track).
// When audio/driftaudio.js lands (config.js SOUND.driftaudio = true), it plays the real set (ElevenLabs takes). Until
// then a small placeholder is SYNTHESIZED here in WebAudio, for the test only: an engine (two oscillators through a
// waveshaper and a filter that opens with the throttle), a turbo whistle, a filtered-noise tire squeal, wind, knocks
// and short interface blips. There is no music in the placeholder (no code-made music: the soundtrack is Eleven's).
// Audio starts on the first tap or key (iPhone Safari unlocks it only inside a user gesture).
import { SOUND, VERSION } from './config.js?v=0.1.23';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// 11-19 (2): ?debug=sound prints the audio's life (made, state changes, resumes, hidden and shown, rebuilds) to the
// console; it is kept in sound.log either way (the release check opens plain ?debug and wants a silent console)
const LOUD = typeof location !== 'undefined' && new URLSearchParams(location.search).getAll('debug').includes('sound');
const IOS = typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

// 11-19 (2), Evrtek on test v16 (iPhone, the home-screen app): "The sounds often go mute after going from a course back
// to the menu or sometimes they don't trigger at all on load." What this adapter now does about every way it went quiet:
//   - every tap, click or key (main.js) wakes the context if it is not running: iOS suspends or interrupts a running one
//     on its own (a call, Siri, the app in the background, another app's audio) and a resume asked for outside a
//     gesture does nothing there, so the next touch is where it comes back;
//   - shown again (visibilitychange, pageshow, focus) it asks at once, and the next touch asks again inside a gesture;
//   - a context whose clock stands still while it says "running", or that two touches running could not resume, is
//     closed and a new one made inside the next touch, with the module rebuilt on it (car, mode, volumes, music, pause);
//   - the ring/silent switch: the page's audio session is set to "playback" (navigator.audioSession, Safari 16.4+), or
//     on an older iPhone a silent looping media element does the same (paused whenever the page is hidden);
//   - the pause is the game's state, followed every frame (main.js), so leaving a paused race by Quit or Restart can no
//     longer leave the car's sound off (before 11-19 (2) it stayed off until the next pause and resume).
export class Sound {
  constructor() { this.ctx = null; this.mod = null; this.muted = false; this.state = { rpm: 900, thr: 0, slip: 0, speed: 0, boost: 0 }; this.redline = 7600; this.hints = {}; this.engineSound = 'newplus'; this.gears = null; this.paused = false; this.track = null; this.view = null; this.log = []; this.rebuilds = 0; this.failedWakes = 0; this.stalled = false; this.plus = null; this.region = null; this.tier = null; this.det = { alphaR: -1, alphaF: -1, loadF: 0, latG: 0, spinV: 0, paint: 0 }; this.ac = { wl: 7, wr: 7, kind: 0 }; }
  note(what, extra) {
    const e = Object.assign({ t: Math.round(performance.now()), what, state: this.ctx ? this.ctx.state : 'none' }, extra);
    this.log.push(e); if (this.log.length > 120) this.log.shift();
    if (LOUD) console.info('[sound] ' + what + ' ' + JSON.stringify(e));
  }
  // call from inside a user gesture (main.js: every tap, click or key). The first makes the context; every later one
  // wakes it if it needs it
  unlock() {
    if (this.ctx) { this.wake('gesture', true); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.session();
    this.make();
  }
  make() {
    const AC = window.AudioContext || window.webkitAudioContext, ctx = this.ctx = new AC();
    // iOS: a silent buffer played inside the gesture opens the output
    try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) { /* fine */ }
    if (ctx.state !== 'running') this.resume('made', true);
    if (ctx.addEventListener) ctx.addEventListener('statechange', () => { if (ctx === this.ctx) { this.note('statechange'); if (ctx.state === 'running') this.failedWakes = this.rebuilds = 0; } });
    this.note('made', { rate: ctx.sampleRate });
    this.watch();
    if (!SOUND.driftaudio) { this.synth(); return; }
    import(SOUND.module + '?v=' + VERSION).then((m) => {
      if (ctx !== this.ctx) return; // a newer context took over while the module loaded
      this.mod = m;
      try {
        const o = { context: ctx, version: VERSION, log: (w, x) => this.note(w, x) };
        if (m.reinit && m.instance && m.instance()) m.reinit(o); else if (m.init) m.init(o); // a rebuild: a new instance on the new context
        if (m.unlock) m.unlock(); if (m.setMuted) m.setMuted(this.muted); this.setVolumes();
        if (m.setPaused) m.setPaused(this.paused);
        if (this.view && m.setView) m.setView(this.view);
        if (this.track && m.music) m.music(this.track);
      } catch (e) { this.note('module failed', { err: String(e && e.message) }); this.mod = null; this.synth(); }
      this.applyEngine();
    }).catch((e) => { this.note('module did not load', { err: String(e && e.message) }); this.synth(); });
  }
  // the context back to running: from a gesture (counted when it does not take), or on being shown again (iOS may refuse
  // that one; the next touch asks again)
  wake(why, gesture = false) {
    const c = this.ctx; if (!c) return;
    if (gesture) {
      this.session();
      if (this.silentEl && this.silentEl.paused && !document.hidden) this.silentEl.play().catch(() => {});
      if (this.stalled || (c.state !== 'running' && this.failedWakes >= 2)) { this.rebuild(this.stalled ? 'its clock stood still' : 'it would not resume'); return; }
    }
    if (c.state !== 'running' && c.state !== 'closed') { this.resume(why, gesture); if (gesture && this.mod && this.mod.unlock) this.mod.unlock(); }
  }
  resume(why, gesture) {
    const c = this.ctx; this.note('resume', { why });
    let p = null; try { p = c.resume(); } catch (e) { /* an old WebKit throws rather than rejects */ }
    if (p && p.catch) p.catch((e) => this.note('resume refused', { why, err: String(e && e.name) }));
    if (gesture) setTimeout(() => { if (c !== this.ctx || document.hidden) return; if (c.state === 'running') this.failedWakes = 0; else { this.failedWakes++; this.note('resume did not take', { why, n: this.failedWakes }); } }, 700);
  }
  // a new context, made inside the gesture, and the module rebuilt on it. Three at most before one of them runs (each
  // takes a touch and a fault, so it can never loop by itself)
  rebuild(why) {
    if (this.rebuilds >= 3) { this.resume(why, true); return; }
    this.rebuilds++; this.note('rebuild', { why, n: this.rebuilds });
    const old = this.ctx; this.stalled = false; this.failedWakes = 0; this.eng = null; this.master = null; this.surface = this.space = undefined; this.mod = null; // quiet until the new instance is made
    try { const p = old.close(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* already closed */ }
    this.make();
  }
  // shown again, the clock, and the ring/silent switch (set up once, with the first context)
  watch() {
    if (this.watching) return; this.watching = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.note('hidden'); if (this.silentEl) this.silentEl.pause(); this.clockAt = 0; }
      else { this.note('shown'); this.wake('shown'); }
    });
    addEventListener('pageshow', (e) => { this.note('pageshow', { persisted: !!e.persisted }); this.wake('pageshow'); });
    addEventListener('focus', () => this.wake('focus'));
    // a context that says "running" while its clock stands still makes no sound: checked twice a second while shown
    setInterval(() => {
      const c = this.ctx; if (!c || document.hidden || c.state !== 'running') { this.clockAt = 0; return; }
      const now = performance.now();
      if (!this.clockAt || c.currentTime !== this.clockT) { this.clockAt = now; this.clockT = c.currentTime; if (this.stalled) { this.stalled = false; this.note('clock moving'); } return; }
      if (now - this.clockAt > 1500 && !this.stalled) { this.stalled = true; this.note('clock stood still'); }
    }, 500);
  }
  // the ring/silent switch mutes Web Audio unless the page's audio session plays back: Safari 16.4+ says so directly;
  // an older iPhone takes a silent looping media element, started in a gesture (and never shown on the lock screen:
  // paused while the page is hidden)
  session() {
    try { const s = navigator.audioSession; if (s) { if (s.type !== 'playback') { s.type = 'playback'; this.note('audio session playback'); } return; } } catch (e) { /* not settable */ }
    if (!IOS || this.silentEl) return;
    const n = 4800, buf = new ArrayBuffer(44 + n * 2), d = new DataView(buf), w = (o, s) => { for (let i = 0; i < s.length; i++) d.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
    d.setUint32(24, 48000, true); d.setUint32(28, 96000, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); w(36, 'data'); d.setUint32(40, n * 2, true);
    const el = this.silentEl = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
    el.loop = true; el.preload = 'auto'; el.setAttribute('playsinline', ''); el.setAttribute('x-webkit-airplay', 'deny'); el.disableRemotePlayback = true;
    el.play().then(() => this.note('silent media element playing')).catch(() => {});
  }
  // tests and the curious: the context and every bus, with their levels (audio/driftaudio.js levels())
  levels() { const i = this.mod && this.mod.instance && this.mod.instance(); return i && i.levels ? i.levels() : { state: this.ctx ? this.ctx.state : 'none', module: false }; }
  // day 4: per-channel volume (master, music, sfx); the module keeps its own copy, set here at every unlock
  setVolume(ch, v) { this.vols = Object.assign({}, this.vols, { [ch]: v }); if (this.mod && this.mod.setVolume) this.mod.setVolume(ch, v); else if (ch === 'master' && this.master && !this.muted) this.master.gain.value = 0.8 * v; }
  setVolumes(vol) { for (const [ch, v] of Object.entries(vol || this.vols || {})) this.setVolume(ch, v); }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.8; if (this.mod && this.mod.setMuted) this.mod.setMuted(m); }
  // the car's engine preset and the fitted parts that change its voice (data/cars.js sound, data/upgrades.js sound)
  // 11-18 (sound builder): and the gearbox's ratios, so the engine lands each shift at rpm x next / current ratio
  setEngine(hints, redline, gears) { this.hints = hints || {}; this.redline = redline || 7600; if (gears) this.gears = gears; this.applyEngine(); }
  applyEngine() {
    const m = this.mod; if (!m) return;
    if (m.setPlus && this.plus) m.setPlus(this.plus); if (m.setRegion && this.region) m.setRegion(this.region); if (m.setTierLite && this.tier != null) m.setTierLite(this.tier === 0); // 11-26 (3), before the car is built
    if (m.setEngineSound) m.setEngineSound(this.engineSound); if (m.setEngine) m.setEngine(this.hints.preset, this.hints); if (m.setGears && this.gears) m.setGears(this.gears);
  }
  // 11-17 (sound builder): Settings > Engine sound. 11-18: 'new' the combustion engine, all six cars; 'recorded' a car's
  // recorded engine and tyres where it has a set (the KESTREL); 'classic' the first engine made in code. 11-26 (3):
  // 'newplus' (New+, the default) New with depth: more mics, the space round the car, the four-tyre screech
  setEngineSound(m) { this.engineSound = m === 'classic' || m === 'recorded' || m === 'new' ? m : 'newplus'; if (this.mod && this.mod.setEngineSound) this.mod.setEngineSound(this.engineSound); }
  // 11-26 (3): New+'s layer switches and levels (TUNING.sound, the five-tap panel), the course's region, the quality tier
  setPlus(o) { this.plus = Object.assign({}, o); if (this.mod && this.mod.setPlus) this.mod.setPlus(this.plus); }
  setRegion(r) { this.region = r; if (this.mod && this.mod.setRegion) this.mod.setRegion(r); }
  setTier(t) { if (t === this.tier) return; this.tier = t; if (this.mod && this.mod.setTierLite) this.mod.setTierLite(t === 0); }
  // 11-26 (3), every frame: what New+'s tyres and space read from the car and the road (js/carsurface.js), passed on only
  // when it moved enough to matter (the slip angles to a tenth of a degree, the walls to a quarter metre). The rears' sliding speed
  // counts only past their grip (car.spin): a tyre driving the car always turns a little faster than the road, silently
  setDetail(car, surface) {
    if (!this.mod || !this.mod.setTyreState || this.engineSound !== 'newplus') return;
    const D = 57.29578, d = this.det, q = (v, s) => Math.round(v / s) * s;
    const nd = { alphaR: q(Math.abs(car.alphaR || 0) * D, 0.1), alphaF: q(Math.abs(car.alphaF || 0) * D, 0.1), loadF: q(car.loadF || 0.5, 0.005), latG: q(car.ay || 0, 0.05), spinV: q(car.spin > 0 ? Math.max(0, (car.wheelSpin || 0) - Math.abs(car.u || 0)) : 0, 0.05), paint: surface.paint(car) };
    let ch = false; for (const k in nd) if (nd[k] !== d[k]) { d[k] = nd[k]; ch = true; }
    if (ch) this.mod.setTyreState(d);
    const a = surface.acoustics(car, this.acTmp || (this.acTmp = {})), wl = q(a.wl, 0.25), wr = q(a.wr, 0.25);
    if (wl !== this.ac.wl || wr !== this.ac.wr || a.kind !== this.ac.kind) { this.ac = { wl, wr, kind: a.kind }; this.mod.setAcoustics(this.ac); }
  }

  setRPM(rpm) { this.state.rpm = rpm; if (this.mod) return this.mod.setRPM && this.mod.setRPM(rpm, this.redline); }
  setThrottle(t, boost = 0) { this.state.thr = t; this.state.boost = boost; if (this.mod) return this.mod.setThrottle && this.mod.setThrottle(t); }
  setSlip(s) { this.state.slip = s; if (this.mod) return this.mod.setSlip && this.mod.setSlip(s); }
  setSpeed(v) { this.state.speed = v; if (this.mod) return this.mod.setSpeed && this.mod.setSpeed(v); }
  impact(kind, strength) { if (this.mod) return this.mod.impact && this.mod.impact(kind, strength); this.synthImpact(kind, strength); }
  nos(on) { if (this.mod) return this.mod.nos && this.mod.nos(on); this.synthNos(on); }
  ui(name) { if (this.mod) return this.mod.ui && this.mod.ui(name); this.blip(name); }
  music(track) { this.track = track; if (this.mod) return this.mod.music && this.mod.music(track); } // kept: a rebuild plays it again
  // day 2: the gearbox, the surface under the wheels, the camera view, and pausing
  shift(up, cut, gear) { if (this.mod) return this.mod.shift && this.mod.shift(up, cut, gear); if (up && this.eng) this.tone(90, 0.06, 0.05, 'square'); }
  setSurface(s) { if (s === this.surface) return; this.surface = s; if (this.mod) return this.mod.setSurface && this.mod.setSurface(s); }
  setView(v) { this.view = v; if (this.mod) return this.mod.setView && this.mod.setView(v); }
  setSpace(k) { if (k === this.space) return; this.space = k; if (this.mod) return this.mod.setSpace && this.mod.setSpace(k); }
  // 11-19 (2): main.js hands this the game's own pause every frame; only a change goes on (and is noted)
  setPaused(p) {
    p = !!p; if (p === this.paused) return; this.paused = p; this.note(p ? 'paused' : 'unpaused');
    if (this.mod) return this.mod.setPaused && this.mod.setPaused(p); if (this.master) this.master.gain.value = p || this.muted ? 0 : 0.8;
  }
  // per frame (the placeholder's mixer)
  tick() { if (!this.ctx || this.mod || !this.eng) return; this.mix(); }

  // ------------------------------------------------------------- the placeholder synth
  synth() {
    const c = this.ctx; if (!c || this.eng) return;
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 8;
    this.master.connect(comp); comp.connect(c.destination);
    // engine
    const o1 = c.createOscillator(), o2 = c.createOscillator(), o3 = c.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square'; o3.type = 'sawtooth';
    const shp = c.createWaveShaper(); const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 2.6); } shp.curve = curve;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
    const g1 = c.createGain(), g2 = c.createGain(), g3 = c.createGain(); g1.gain.value = 0.5; g2.gain.value = 0.35; g3.gain.value = 0.18;
    const eg = c.createGain(); eg.gain.value = 0;
    o1.connect(g1); o2.connect(g2); o3.connect(g3); g1.connect(shp); g2.connect(shp); g3.connect(shp); shp.connect(lp); lp.connect(eg); eg.connect(this.master);
    o1.start(); o2.start(); o3.start();
    // turbo whistle
    const wh = c.createOscillator(); wh.type = 'sine'; const wg = c.createGain(); wg.gain.value = 0; wh.connect(wg); wg.connect(this.master); wh.start();
    // noise bed for the squeal, the wind and the knocks
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = nb;
    const mkNoise = () => { const s = c.createBufferSource(); s.buffer = nb; s.loop = true; s.start(); return s; };
    const sq = mkNoise(), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 9; bp.frequency.value = 1100;
    const so = c.createOscillator(); so.type = 'triangle'; so.frequency.value = 760; const sog = c.createGain(); sog.gain.value = 0.25;
    const sg = c.createGain(); sg.gain.value = 0; sq.connect(bp); bp.connect(sg); so.connect(sog); sog.connect(sg); sg.connect(this.master); so.start();
    const wn = mkNoise(), wlp = c.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 500; const wng = c.createGain(); wng.gain.value = 0; wn.connect(wlp); wlp.connect(wng); wng.connect(this.master);
    this.eng = { o1, o2, o3, lp, eg, wh, wg, bp, so, sg, wng, wlp };
    this.lastThr = 0;
  }
  mix() {
    const c = this.ctx, e = this.eng, s = this.state, t = c.currentTime, k = 0.06;
    const f = clamp(s.rpm, 600, 9500) / 60 * 2;
    e.o1.frequency.setTargetAtTime(f, t, 0.02); e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.02); e.o3.frequency.setTargetAtTime(f * 1.5 + 0.7, t, 0.02);
    e.lp.frequency.setTargetAtTime(380 + s.thr * 2400 + s.rpm * 0.18, t, k);
    e.eg.gain.setTargetAtTime(0.1 + s.thr * 0.17 + clamp(s.rpm / this.redline, 0, 1) * 0.05, t, k);
    const turbo = this.hints.turbo || this.hints.preset === 'turbo4' || this.hints.preset === 'v6tt';
    e.wh.frequency.setTargetAtTime(1800 + s.rpm * 0.35, t, 0.05); e.wg.gain.setTargetAtTime(turbo ? s.boost * s.thr * 0.012 : 0, t, 0.08);
    const sl = clamp(s.slip, 0, 1) * clamp(s.speed / 8, 0, 1);
    e.sg.gain.setTargetAtTime(sl * 0.11, t, 0.05); e.bp.frequency.setTargetAtTime(900 + sl * 500 + Math.sin(t * 13) * 60, t, 0.03); e.so.frequency.setTargetAtTime(700 + sl * 160 + Math.sin(t * 9) * 25, t, 0.03);
    e.wng.gain.setTargetAtTime(clamp(s.speed / 60, 0, 1) ** 2 * 0.09, t, 0.1); e.wlp.frequency.setTargetAtTime(300 + s.speed * 18, t, 0.1);
    // a blow-off when the throttle snaps shut on boost
    if (turbo && this.lastThr > 0.7 && s.thr < 0.2 && s.boost > 0.5) this.burst(0.25, 2800, 0.05, 'highpass');
    this.lastThr = s.thr;
  }
  burst(dur, freq, gain, type = 'lowpass') {
    const c = this.ctx; if (!c || !this.noise) return;
    const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = c.createGain();
    const t = c.currentTime; g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  tone(freq, dur, gain, type = 'sine', at = 0, slide = 0) {
    const c = this.ctx; if (!c || !this.master) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at; o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  synthImpact(kind, s) { if (!this.eng) return; this.burst(0.25 + s * 0.2, 700, clamp(0.15 + s * 0.35, 0, 0.6)); this.tone(70, 0.25, clamp(0.2 + s * 0.4, 0, 0.6), 'sine', 0, 0.5); }
  synthNos(on) { if (!this.eng) return; if (on) this.burst(0.6, 5000, 0.08, 'highpass'); }
  blip(name) {
    if (!this.master) return;
    const T = {
      link: () => { this.tone(660, 0.12, 0.12, 'triangle'); this.tone(990, 0.16, 0.12, 'triangle', 0.07); },
      bank: () => { for (const [f, a] of [[523, 0], [659, 0.05], [784, 0.1], [1047, 0.16]]) this.tone(f, 0.25, 0.09, 'triangle', a); },
      wipe: () => { this.tone(330, 0.35, 0.14, 'sawtooth', 0, 0.45); },
      zone: () => { this.tone(1200, 0.05, 0.05, 'sine'); },
      click: () => { this.tone(1500, 0.04, 0.05, 'square'); },
      buy: () => { this.tone(880, 0.1, 0.1, 'triangle'); this.tone(1320, 0.2, 0.1, 'triangle', 0.08); },
      count: () => { this.tone(520, 0.14, 0.12, 'square'); },
      go: () => { this.tone(1040, 0.4, 0.14, 'square'); },
      star: () => { this.tone(1320, 0.18, 0.09, 'triangle'); },
      degenerate: () => { for (let i = 0; i < 6; i++) this.tone(440 * Math.pow(1.26, i), 0.18, 0.09, 'sawtooth', i * 0.06); },
    }[name];
    if (T) T();
  }
}
