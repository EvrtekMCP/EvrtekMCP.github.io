// DRIFTLINE: every game sound goes through this one object, by the names the sound builder's module uses (Dirigent
// 11-15): setRPM, setThrottle, setSlip, setSpeed, impact(kind, strength), nos(on), ui(name), music(track).
// When audio/driftaudio.js lands (config.js SOUND.driftaudio = true), it plays the real set (ElevenLabs takes). Until
// then a small placeholder is SYNTHESIZED here in WebAudio, for the test only: an engine (two oscillators through a
// waveshaper and a filter that opens with the throttle), a turbo whistle, a filtered-noise tire squeal, wind, knocks
// and short interface blips. There is no music in the placeholder (no code-made music: the soundtrack is Eleven's).
// Audio starts on the first tap or key (iPhone Safari unlocks it only inside a user gesture).
import { SOUND, VERSION } from './config.js?v=0.1.0';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Sound {
  constructor() { this.ctx = null; this.mod = null; this.muted = false; this.state = { rpm: 900, thr: 0, slip: 0, speed: 0, boost: 0 }; this.redline = 7600; this.hints = {}; this.engineSound = 'new'; this.gears = null; }
  // call from inside a user gesture (touchend / click / keydown)
  unlock() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); if (this.mod && this.mod.unlock) this.mod.unlock(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    // iOS: a silent buffer played inside the gesture opens the output
    const b = this.ctx.createBuffer(1, 1, 22050), s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.ctx.destination); s.start(0);
    if (this.ctx.state !== 'running') this.ctx.resume();
    if (SOUND.driftaudio) {
      import(SOUND.module + '?v=' + VERSION).then((m) => { this.mod = m; try { if (m.init) m.init({ context: this.ctx, version: VERSION }); if (m.unlock) m.unlock(); if (m.setMuted) m.setMuted(this.muted); this.setVolumes(); } catch (e) { this.mod = null; this.synth(); } this.applyEngine(); }).catch(() => this.synth());
    } else this.synth();
  }
  // day 4: per-channel volume (master, music, sfx); the module keeps its own copy, set here at every unlock
  setVolume(ch, v) { this.vols = Object.assign({}, this.vols, { [ch]: v }); if (this.mod && this.mod.setVolume) this.mod.setVolume(ch, v); else if (ch === 'master' && this.master && !this.muted) this.master.gain.value = 0.8 * v; }
  setVolumes(vol) { for (const [ch, v] of Object.entries(vol || this.vols || {})) this.setVolume(ch, v); }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.8; if (this.mod && this.mod.setMuted) this.mod.setMuted(m); }
  // the car's engine preset and the fitted parts that change its voice (data/cars.js sound, data/upgrades.js sound)
  // 11-18 (sound builder): and the gearbox's ratios, so the engine lands each shift at rpm x next / current ratio
  setEngine(hints, redline, gears) { this.hints = hints || {}; this.redline = redline || 7600; if (gears) this.gears = gears; this.applyEngine(); }
  applyEngine() { if (this.mod && this.mod.setEngineSound) this.mod.setEngineSound(this.engineSound); if (this.mod && this.mod.setEngine) this.mod.setEngine(this.hints.preset, this.hints); if (this.mod && this.mod.setGears && this.gears) this.mod.setGears(this.gears); }
  // 11-17 (sound builder): Settings > Engine sound. 11-18: 'new' (the default) the combustion engine, all six cars;
  // 'recorded' a car's recorded engine and tyres where it has a set (the KESTREL); 'classic' the first engine made in code
  setEngineSound(m) { this.engineSound = m === 'classic' || m === 'recorded' ? m : 'new'; if (this.mod && this.mod.setEngineSound) this.mod.setEngineSound(this.engineSound); }

  setRPM(rpm) { this.state.rpm = rpm; if (this.mod) return this.mod.setRPM && this.mod.setRPM(rpm, this.redline); }
  setThrottle(t, boost = 0) { this.state.thr = t; this.state.boost = boost; if (this.mod) return this.mod.setThrottle && this.mod.setThrottle(t); }
  setSlip(s) { this.state.slip = s; if (this.mod) return this.mod.setSlip && this.mod.setSlip(s); }
  setSpeed(v) { this.state.speed = v; if (this.mod) return this.mod.setSpeed && this.mod.setSpeed(v); }
  impact(kind, strength) { if (this.mod) return this.mod.impact && this.mod.impact(kind, strength); this.synthImpact(kind, strength); }
  nos(on) { if (this.mod) return this.mod.nos && this.mod.nos(on); this.synthNos(on); }
  ui(name) { if (this.mod) return this.mod.ui && this.mod.ui(name); this.blip(name); }
  music(track) { if (this.mod) return this.mod.music && this.mod.music(track); }
  // day 2: the gearbox, the surface under the wheels, the camera view, and pausing
  shift(up, cut, gear) { if (this.mod) return this.mod.shift && this.mod.shift(up, cut, gear); if (up && this.eng) this.tone(90, 0.06, 0.05, 'square'); }
  setSurface(s) { if (s === this.surface) return; this.surface = s; if (this.mod) return this.mod.setSurface && this.mod.setSurface(s); }
  setView(v) { if (this.mod) return this.mod.setView && this.mod.setView(v); }
  setSpace(k) { if (k === this.space) return; this.space = k; if (this.mod) return this.mod.setSpace && this.mod.setSpace(k); }
  setPaused(p) { if (this.mod) return this.mod.setPaused && this.mod.setPaused(p); if (this.master) this.master.gain.value = p || this.muted ? 0 : 0.8; }
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
