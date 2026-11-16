// DRIFTLINE: the game's sound, as one drop-in module.
//
//   import { createDriftAudio } from '../audio/driftaudio.js';
//   const audio = createDriftAudio({ version: VERSION });           // unlocks itself on the first tap or key
//   audio.setCar('six', ['engine-1', 'turbo'], { idleRpm: 950, redlineRpm: 7800 });
//   // every frame:
//   audio.setRPM(car.rpm); audio.setThrottle(car.throttle); audio.setSpeed(car.speed);     // speed in m/s
//   audio.setSlip(slideDeg, { spin, lock, front });                  // degrees of slide; the rest 0..1
//   // when things happen:
//   audio.shift(true, cutSec); audio.impact('crunch', 0.8); audio.nos(true); audio.ui('link', 3); audio.music('race1');
//
// The car (engine, turbo, pops, limiter, tyres, kerbs, gravel, wind) is synthesised in real time by
// audio/drift-worklet.js from audio/car-sounds.js, so every car and upgrade sounds different. Wall hits, NOS,
// the gearbox clunk, interface sounds and fanfares are ElevenLabs recordings (audio/sfx). The music is whole
// ElevenLabs takes, streamed in bar-line chunks after the game starts (audio/music), never at load.
// Formats: Ogg Opus where the browser plays it, AAC in .mp4 otherwise (Safari). Every URL carries ?v=<version>: the
// game's stamp when it imports this module stamped (driftaudio.js?v=0.1.0), or opts.version.
//
// THE GAME'S ADAPTER (js/sound.js) uses the module-level functions at the bottom instead: init({ context }) once, then
// setEngine(preset, hints), setRPM(rpm, redline), setThrottle(t), setSlip(share 0..1), setSpeed(m/s), impact(kind,
// strength), nos(on), ui(name), music(track), setMuted(m). Its names are understood: presets i6/v6tt/flat6, hints
// { exhaust, harsh, turbo, squeal }, impact 'hard'/'scrape', ui count/go/wipe/buy, music menu/race/results. With no
// shift() call it hears the gear changes in the revs; with no link step it counts the chain itself.
const STAMP = new URL(import.meta.url).search;
let cfgLoad = null;
const loadCfg = () => cfgLoad || (cfgLoad = import(new URL('./car-sounds.js' + STAMP, import.meta.url).href));

const UI = {
  click: ['ui-click-1', 'ui-click-2'], back: ['ui-click-2'], purchase: ['ui-purchase'], upgrade: ['ui-upgrade'],
  zone: ['ui-zone'], sweet: ['ui-sweet'], link: ['ui-link'], bank: ['ui-bank'], lost: ['ui-lost'],
  star: ['fanfare-star'], degenerate: ['fanfare-degenerate'], count: ['ui-count'], go: ['ui-go'],
};
const UI_ALIAS = { wipe: 'lost', buy: 'purchase', select: 'click', hover: 'click' };
const MUSIC_ALIAS = { menu: 'garage', title: 'garage' };
const UI_GAIN = { click: 0.45, back: 0.4, purchase: 0.7, upgrade: 0.75, zone: 0.55, sweet: 0.6, link: 0.6, bank: 0.7, lost: 0.7, star: 0.85, degenerate: 0.9, count: 0.6, go: 0.7 };
const IMPACT = { scrape: ['hit-scrape-1', 'hit-scrape-2', 'hit-scrape-3'], swipe: ['hit-swipe-1', 'hit-swipe-2', 'hit-swipe-3'], crunch: ['hit-crunch-1', 'hit-crunch-2', 'hit-crunch-3'] };
const IMPACT_ALIAS = { light: 'scrape', side: 'swipe', hard: 'crunch', headon: 'crunch', 'head-on': 'crunch' };
const LINK_STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // a major pentatonic climb, one step per link
const VOLUMES = { master: 0.9, music: 0.55, sfx: 0.9, ui: 0.8 };
const MIX = { engine: 0.85, tyres: 0.8, impacts: 0.9, nos: 0.6, shift: 0.35 };
const STORE = 'driftline.audio.v1';

export function createDriftAudio(opts = {}) {
  const base = opts.base || new URL('./', import.meta.url).href;
  const stamp = opts.version ? '?v=' + encodeURIComponent(opts.version) : STAMP;
  const url = (p) => base + p + stamp;
  const vol = Object.assign({}, VOLUMES, load().vol || {});
  let muted = !!load().muted;
  const mix = Object.assign({}, MIX, opts.mix || {});
  let ctx = opts.context || null, ext = null, nodes = null, carNode = null, carPort = null, active = true, paused = false;
  let sfxMeta = null, musicMeta = null, unlocked = false, disposed = false;
  const buffers = new Map(), lastPick = {}, lastHit = {}, listeners = [];
  const ctl = { rpm: 900, throttle: 0, boost: -1, slip: 0, slipN: -1, spin: 0, lock: 0, front: 0, speed: 0, surface: 'asphalt', view: 0, nos: 0 };
  let dirty = false, carSpec = { id: opts.engine || 'six', ups: opts.upgrades || [], over: opts.car || {} };
  let meterFn = null, duckHit = 0, duckFan = 0, duckLevel = 1, nosOn = false, nosSrc = null, nosGain = null;
  let player = null, wantTrack = null, cfg = null, chain = 0, raceTurn = 0, shiftSeen = false, revLast = 0, revT = 0, autoShiftT = 0;

  function load() { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(STORE, JSON.stringify({ vol, muted })); } catch (e) { /* private mode: fine */ } }

  // ---- the graph -------------------------------------------------------------------------------------------
  function build() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC({ latencyHint: 'interactive' });
    }
    const g = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 3; limiter.ratio.value = 12; limiter.attack.value = 0.002; limiter.release.value = 0.15;
    nodes = { master: g(muted ? 0 : vol.master), limiter, music: g(vol.music), duck: g(1), sfx: g(vol.sfx), ui: g(vol.ui), car: g(1), engine: g(mix.engine), tyres: g(mix.tyres) };
    nodes.music.connect(nodes.duck).connect(nodes.master);
    nodes.sfx.connect(nodes.master); nodes.ui.connect(nodes.master);
    nodes.car.connect(nodes.sfx); nodes.engine.connect(nodes.car); nodes.tyres.connect(nodes.car);
    nodes.master.connect(limiter).connect(ctx.destination);
    // day 3 (Fundi): the space round the car. A tunnel is a long dense reverb, a bridge a short slap off the deck and the
    // parapets; both are sends from the car, faded in and out by setSpace()
    const conv = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 1.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < ctx.sampleRate * 0.012 ? 0 : 1); }
    conv.buffer = ir;
    const slap = ctx.createDelay(0.5); slap.delayTime.value = 0.11; const fb = g(0.22), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    nodes.tunnel = g(0); nodes.bridge = g(0);
    nodes.car.connect(nodes.tunnel).connect(conv).connect(nodes.sfx);
    nodes.car.connect(nodes.bridge).connect(slap).connect(lp).connect(nodes.sfx); lp.connect(fb).connect(slap);
    let probe = null; try { probe = new Audio(); } catch (e) { /* no media element: assume Opus */ }
    ext = opts.format || (!probe || probe.canPlayType('audio/ogg; codecs="opus"') ? 'ogg' : 'mp4');
    return true;
  }

  // one synthesised car: its engine out to `eng`, its tyres to `tyr`. The player's car and every voice() use this.
  // An AudioWorklet where there is one; on old Safari the same DSP in a ScriptProcessor on the main thread.
  let workletAdded = null;
  async function makeCar(conf, eng, tyr, o = {}) {
    if (ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
      await (workletAdded || (workletAdded = ctx.audioWorklet.addModule(url('drift-worklet.js')))); // once per context
      const node = new AudioWorkletNode(ctx, 'drift-car', { numberOfInputs: 0, numberOfOutputs: 2, outputChannelCount: [1, 2], processorOptions: { config: conf, meter: !!o.meter, seed: o.seed } });
      node.connect(eng, 0); node.connect(tyr, 1);
      return { node, port: node.port };
    }
    await import(url('drift-worklet.js'));
    const dsp = new globalThis.DriftDSP.DriftCarDSP(ctx.sampleRate, o.seed);
    dsp.message(conf);
    let on = true;
    const sp = ctx.createScriptProcessor(1024, 0, 3), split = ctx.createChannelSplitter(3), merge = ctx.createChannelMerger(2);
    sp.onaudioprocess = (e) => { const b = e.outputBuffer; if (!on) { for (let c = 0; c < 3; c++) b.getChannelData(c).fill(0); return; } dsp.render(b.getChannelData(0), b.getChannelData(1), b.getChannelData(2), b.length); };
    sp.connect(split); split.connect(eng, 0); split.connect(merge, 1, 0); split.connect(merge, 2, 1); merge.connect(tyr);
    return { node: sp, port: { postMessage: (m) => { if (m.type === 'active') on = m.on; else dsp.message(m); } } };
  }
  async function startCar() {
    cfg = await loadCfg();
    const conf = Object.assign({ type: 'config' }, cfg.resolveCarSound(carSpec.id, carSpec.ups, carSpec.over));
    const c = await makeCar(conf, nodes.engine, nodes.tyres, { meter: !!meterFn });
    carNode = c.node; carPort = c.port;
    if (carNode.port) carPort.onmessage = (e) => { if (meterFn) meterFn(e.data); };
    if (!active) carPort.postMessage({ type: 'active', on: false });
    flush();
  }

  // day 5 (Fundi, the duels): a second car, the rival. Its own synthesised engine and tyres (no one-shots, no music,
  // no gesture listeners), out through `out` for the caller to place (distance, pan, Doppler) and connect to `bus`,
  // the car bus, so it pauses, mutes and takes the tunnel's echo with the player's car. update() takes the same
  // controls as the player's car: rpm, throttle, boost, share (the slip, 0..1, as the adapter's setSlip), spin, lock,
  // front, speed (m/s), surface.
  function voice(spec = {}) {
    if (!nodes) return null;
    const g = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    const out = g(1), eng = g(mix.engine), tyr = g(mix.tyres); eng.connect(out); tyr.connect(out);
    const vc = { rpm: 900, throttle: 0, boost: -1, slip: 0, slipN: -1, spin: 0, lock: 0, front: 0, speed: 0, surface: 'asphalt', view: 0, nos: 0 };
    let car = null, gone = false, on = true, sp = { id: spec.preset || 'six', ups: [], over: {} };
    const conf = () => Object.assign({ type: 'config' }, cfg.resolveCarSound(sp.id, sp.ups, sp.over));
    const kill = () => { try { if (car) car.node.disconnect(); out.disconnect(); } catch (e) { /* gone */ } car = null; };
    const vready = ready.then(async () => {
      if (gone) return;
      const c = await makeCar(conf(), eng, tyr, { seed: spec.seed || 77813 });
      if (gone) { car = c; kill(); return; }
      car = c; if (!on) car.port.postMessage({ type: 'active', on: false });
      car.port.postMessage({ type: 'ctl', v: vc });
    });
    vready.catch((e) => console.warn('driftaudio: voice ' + e.message));
    return {
      ready: vready, out, bus: nodes.car,
      async setHints(preset, hints = {}, redline) {
        const c = await loadCfg(); sp = { id: preset || hints.preset || sp.id, ups: c.hintsToUpgrades(hints), over: redline ? { redlineRpm: redline } : {} };
        if (car) car.port.postMessage(conf());
      },
      update(s) {
        for (const k of ['rpm', 'throttle', 'boost', 'spin', 'lock', 'front', 'speed', 'surface']) if (s[k] !== undefined) vc[k] = s[k];
        if (s.share !== undefined) { const v = Math.max(0, Math.min(1, +s.share || 0)); vc.slipN = v; vc.slip = v * 45; }
        if (car && on) car.port.postMessage({ type: 'ctl', v: vc });
      },
      shift(cut) { if (car) car.port.postMessage({ type: 'shift', cut: cut == null ? 0.15 : cut }); },
      setActive(a) { on = !!a; if (car) car.port.postMessage({ type: 'active', on }); },
      dispose() { gone = true; kill(); },
    };
  }

  async function fetchBuffer(path, expectDur) {
    const res = await fetch(url(path + '.' + ext));
    if (!res.ok) throw new Error(path + ': ' + res.status);
    const data = await res.arrayBuffer();
    try { return await decode(data); }
    catch (e) { // an Ogg the browser said it could play and could not: AAC from here on
      if (ext !== 'ogg') throw e;
      ext = 'mp4'; return fetchBuffer(path, expectDur);
    }
  }
  function decode(data) { return new Promise((ok, no) => { const p = ctx.decodeAudioData(data, ok, no); if (p && p.catch) p.catch(no); }); }

  async function loadSfx() {
    sfxMeta = await (await fetch(url('sfx/sfx.json'))).json();
    await Promise.all(Object.keys(sfxMeta.sounds).map(async (id) => {
      try { buffers.set(id, await fetchBuffer('sfx/' + id)); } catch (e) { console.warn('driftaudio: ' + id + ' did not load', e); }
    }));
  }

  // ---- unlock (mobile browsers start audio only from a tap) ------------------------------------------------
  function unlock() {
    if (!ctx || disposed) return;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    try { const b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) { /* fine */ }
  }
  const onGesture = () => unlock();
  function watchState() {
    const ev = ['pointerdown', 'touchend', 'keydown', 'click'];
    for (const t of ev) { window.addEventListener(t, onGesture, { capture: true, passive: true }); listeners.push([window, t, onGesture, true]); }
    ctx.onstatechange = () => {
      const was = unlocked;
      unlocked = ctx.state === 'running';
      if (unlocked && !was && wantTrack !== undefined && wantTrack !== null && !player) music(wantTrack);
    };
    const vis = () => { if (document.hidden) { if (ctx.state === 'running') ctx.suspend().catch(() => {}); } else if (unlocked || ctx.state === 'suspended') ctx.resume().catch(() => {}); };
    document.addEventListener('visibilitychange', vis); listeners.push([document, 'visibilitychange', vis, false]);
  }

  // ---- per-frame controls ------------------------------------------------------------------------------------
  function set(k, v) { if (ctl[k] !== v) { ctl[k] = v; if (!dirty) { dirty = true; queueMicrotask(flush); } } }
  function flush() {
    dirty = false;
    if (carPort) carPort.postMessage({ type: 'ctl', v: ctl });
    duck();
  }
  // the music ducks a little under a big slide at speed, the engine near the limiter, a crash; more under a fanfare
  function duck() {
    if (!nodes) return;
    const slide = Math.min(1, Math.max(0, (ctl.slip - 8) / 30)) * Math.min(1, ctl.speed / 25);
    const heavy = Math.max(slide, ctl.throttle * Math.pow(Math.min(1, ctl.rpm / ((carSpec.over.redlineRpm) || 7800)), 6), duckHit);
    let target = (1 - 0.3 * heavy) * (duckFan ? 0.4 : 1) * (paused ? 0.5 : 1);
    if (Math.abs(target - duckLevel) > 0.02) { duckLevel = target; nodes.duck.gain.setTargetAtTime(target, ctx.currentTime, 0.25); }
  }

  // ---- one-shots -----------------------------------------------------------------------------------------------
  function play(id, { bus = nodes.sfx, gain = 1, rate = 1, when = 0, loop = false } = {}) {
    const b = buffers.get(id);
    if (!b || !ctx || ctx.state !== 'running') return null;
    const s = ctx.createBufferSource(), gn = ctx.createGain();
    s.buffer = b; s.playbackRate.value = rate; gn.gain.value = gain;
    s.connect(gn).connect(bus);
    const m = sfxMeta.sounds[id];
    if (loop && m && m.loop) { s.loop = true; s.loopStart = m.loopStart; s.loopEnd = m.loopEnd; s.start(when || 0, m.loopStart); }
    else s.start(when || 0);
    s.onended = () => { try { gn.disconnect(); } catch (e) { /* gone */ } };
    return { src: s, gain: gn };
  }
  function pick(group, list) { // random, never the same one twice running
    if (list.length < 2) return list[0];
    let i; do { i = (Math.random() * list.length) | 0; } while (list[i] === lastPick[group]);
    lastPick[group] = list[i]; return list[i];
  }

  function impact(kind = 'swipe', strength = 1) {
    if (kind === 'hard') kind = strength >= 0.8 ? 'crunch' : 'swipe'; // the adapter's two kinds: a hard hit is a swipe until it is a big one
    kind = IMPACT_ALIAS[kind] || kind;
    const list = IMPACT[kind]; if (!list) return;
    const now = performance.now(); if (now - (lastHit[kind] || 0) < 90) return; lastHit[kind] = now;
    const s = Math.max(0, Math.min(1, strength));
    play(pick(kind, list), { gain: mix.impacts * (0.25 + 0.75 * s) * (ctl.view ? 0.8 : 1), rate: 1.08 - 0.16 * s + (Math.random() - 0.5) * 0.06 });
    duckHit = Math.max(duckHit, s * (kind === 'crunch' ? 1 : 0.6)); duck();
    setTimeout(() => { duckHit = 0; duck(); }, kind === 'crunch' ? 900 : 400);
  }
  function shift(up = true, cut) { shiftSeen = true; doShift(up, cut); }
  function doShift(up, cut) {
    if (carPort) carPort.postMessage({ type: 'shift', cut: cut == null ? 0.15 : cut });
    const quick = (carSpec.ups || []).includes('shifter');
    play(quick ? 'shift-2' : pick('shift', ['shift-1', 'shift-2']), { gain: mix.shift * (ctl.view ? 1.6 : 1) * (up ? 1 : 0.85), rate: up ? 1 : 0.94 });
  }
  function nos(on) {
    on = !!on; set('nos', on ? 1 : 0);
    if (on === nosOn || !ctx) return; nosOn = on;
    const t = ctx.currentTime;
    if (on) {
      play('nos-fire', { gain: mix.nos * 1.2 });
      const h = play('nos-hiss', { gain: 0, loop: true });
      if (h) { nosSrc = h.src; nosGain = h.gain; nosGain.gain.setValueAtTime(0, t); nosGain.gain.linearRampToValueAtTime(mix.nos, t + 0.18); }
    } else if (nosSrc) {
      const s = nosSrc, g = nosGain; nosSrc = nosGain = null;
      g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.1); s.stop(t + 0.6);
    }
  }
  function ui(name, opt) {
    name = UI_ALIAS[name] || name;
    const list = UI[name]; if (!list) return;
    let rate = 1;
    if (name === 'link') { // each link climbs a step; given a step, it uses that
      chain = opt == null ? chain + 1 : Math.round(opt);
      const n = Math.max(0, Math.min(LINK_STEPS.length - 1, chain)); rate = Math.pow(2, LINK_STEPS[n] / 12);
    }
    if (name === 'bank' || name === 'lost') chain = 0;
    const id = name === 'click' ? pick('click', list) : list[0];
    play(id, { bus: nodes.ui, gain: UI_GAIN[name] || 0.6, rate });
    if (name === 'star' || name === 'degenerate') { // the fanfare sits on top of the music for its length
      const len = (sfxMeta.sounds[id] || { dur: 2 }).dur;
      duckFan++; duck(); setTimeout(() => { duckFan = Math.max(0, duckFan - 1); duck(); }, len * 900);
    }
  }

  // ---- music: whole takes, streamed in bar-line chunks -------------------------------------------------------
  class Player {
    constructor(id, meta) {
      this.id = id; this.m = meta; this.out = ctx.createGain(); this.out.connect(nodes.music);
      this.cache = new Map(); this.srcs = []; this.next = 0; this.at = 0; this.stopped = false; this.started = false;
      this.timer = setInterval(() => this.pump(), 250);
    }
    get(i) {
      if (!this.cache.has(i)) {
        const c = this.m.chunks[i];
        this.cache.set(i, fetchBuffer('music/' + c.file).then((b) => {
          // AAC may come back with the encoder's priming still in front; Opus never does
          const fileDur = c.fileSamples / 48000, extra = b.duration - fileDur;
          return { b, fix: ext === 'mp4' && extra > 0.0005 ? Math.min(extra, 0.05) : 0 };
        }));
        while (this.cache.size > 3) { const k = this.cache.keys().next().value; if (k === i) break; this.cache.delete(k); }
      }
      return this.cache.get(i);
    }
    nextIndex(i) { const n = this.m.chunks.length; if (i + 1 < n) return i + 1; return this.m.once ? -1 : this.m.loopFrom; }
    async pump() {
      if (this.stopped || this.busy || ctx.state !== 'running') return;
      if (this.started && this.at - ctx.currentTime > 6) return;
      if (this.next < 0) { if (ctx.currentTime > this.at + 1) this.stop(0); return; }
      this.busy = true;
      try {
        const i = this.next, ch = this.m.chunks[i], { b, fix } = await this.get(i);
        if (this.stopped) return;
        const X = musicMeta.crossfade, P = musicMeta.pad, first = !this.started;
        if (first) this.at = ctx.currentTime + 0.08;
        const T = this.at, s = ctx.createBufferSource(), g = ctx.createGain();
        s.buffer = b; s.connect(g).connect(this.out);
        const t0 = first ? T : T - X;
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, first ? T + 0.005 : T + X);
        g.gain.setValueAtTime(1, T + ch.dur - X); g.gain.linearRampToValueAtTime(0, T + ch.dur + X);
        s.start(t0, P + fix - (first ? 0 : X), ch.dur + (first ? X : 2 * X));
        s.onended = () => { try { g.disconnect(); } catch (e) { /* gone */ } this.srcs = this.srcs.filter((x) => x !== s); };
        this.srcs.push(s);
        this.started = true; this.at = T + ch.dur; this.next = this.nextIndex(i);
        if (this.next >= 0) this.get(this.next); // fetch ahead
      } catch (e) { console.warn('driftaudio: music chunk failed', e); }
      finally { this.busy = false; }
      if (!this.stopped && this.next >= 0 && this.at - ctx.currentTime < 6) this.pump();
    }
    stop(fade = 1.2) {
      if (this.stopped) return; this.stopped = true; clearInterval(this.timer);
      const t = ctx.currentTime;
      this.out.gain.setTargetAtTime(0, t, Math.max(0.01, fade / 4));
      for (const s of this.srcs) try { s.stop(t + fade + 0.1); } catch (e) { /* not started */ }
      setTimeout(() => { try { this.out.disconnect(); } catch (e) { /* gone */ } }, (fade + 0.3) * 1000);
    }
  }
  async function music(track) {
    track = MUSIC_ALIAS[track] || track;
    if (track === 'race') { // the two race tracks take turns, one per race
      if (player && !player.stopped && /^race/.test(player.id)) return;
      track = raceTurn++ % 2 ? 'race2' : 'race1';
    }
    wantTrack = track || null;
    if (player && player.id === track && !player.stopped) return;
    if (player) { player.stop(); player = null; }
    if (!track || !ctx) return;
    if (!musicMeta) musicMeta = await (await fetch(url('music/music.json'))).json();
    if (wantTrack !== track || !musicMeta.tracks[track]) return;
    if (ctx.state !== 'running') return; // starts on unlock
    player = new Player(track, musicMeta.tracks[track]);
    player.pump();
  }

  // ---- volumes -----------------------------------------------------------------------------------------------
  function setVolume(ch, v) {
    if (!(ch in vol)) return; vol[ch] = Math.max(0, Math.min(1, +v)); save();
    if (!nodes) return;
    const n = nodes[ch], t = ctx.currentTime;
    if (ch === 'master') n.gain.setTargetAtTime(muted ? 0 : vol.master, t, 0.03); else n.gain.setTargetAtTime(vol[ch], t, 0.03);
  }
  function setMuted(m) { muted = !!m; save(); if (nodes) nodes.master.gain.setTargetAtTime(muted ? 0 : vol.master, ctx.currentTime, 0.03); }

  function pushCar() { if (carPort && cfg) carPort.postMessage(Object.assign({ type: 'config' }, cfg.resolveCarSound(carSpec.id, carSpec.ups, carSpec.over))); }
  // the revs tell a gear change when the game does not: a drop of 12% or more in one update on the throttle is an
  // upshift, a jump of 15% off it a downshift (a drifting car's revs never move that fast between two frames)
  function watchRevs(r) {
    const now = performance.now();
    if (!shiftSeen && revLast > 2500 && now - revT < 120 && now - autoShiftT > 300) {
      if (r < revLast * 0.88 && ctl.throttle > 0.4) { autoShiftT = now; doShift(true, 0.12); }
      else if (r > revLast * 1.15 && ctl.throttle < 0.3) { autoShiftT = now; doShift(false, 0.05); }
    }
    revLast = r; revT = now;
  }

  // ---- boot ----------------------------------------------------------------------------------------------------
  const ready = (async () => {
    if (!build()) throw new Error('no Web Audio');
    if (opts.autoUnlock !== false) watchState();
    unlocked = ctx.state === 'running';
    await Promise.all([startCar(), loadSfx()]);
  })();
  ready.catch((e) => console.warn('driftaudio: ' + e.message));

  return {
    ready,
    get context() { return ctx; },
    get unlocked() { return !!ctx && ctx.state === 'running'; },
    get format() { return ext; },
    unlock,
    setCar(id, ups = [], over = {}) {
      carSpec = { id, ups: ups || [], over: over || {} };
      pushCar();
    },
    configureCar(cfg) { if (carPort) carPort.postMessage(Object.assign({ type: 'config' }, cfg)); }, // a resolved {engine, tyres}, for tuning
    update(s) { for (const k of ['rpm', 'throttle', 'slip', 'spin', 'lock', 'front', 'speed', 'surface', 'boost']) if (s[k] !== undefined) set(k, s[k]); },
    setRPM(v, redline) {
      v = +v || 0; watchRevs(v); set('rpm', v);
      if (redline && redline !== carSpec.over.redlineRpm) { carSpec.over = Object.assign({}, carSpec.over, { redlineRpm: redline }); pushCar(); }
    },
    async setCarHints(preset, hints = {}) { const c = await loadCfg(); carSpec = { id: preset || hints.preset || carSpec.id, ups: c.hintsToUpgrades(hints), over: carSpec.over }; pushCar(); },
    setSlipShare(s, o = {}) { s = Math.max(0, Math.min(1, +s || 0)); set('slipN', s); set('slip', s * 45); set('spin', +o.spin || 0); set('lock', +o.lock || 0); set('front', +o.front || 0); },
    setThrottle: (v) => set('throttle', +v || 0),
    setSlip(deg, o = {}) { set('slipN', -1); set('slip', Math.abs(+deg || 0)); set('spin', +o.spin || 0); set('lock', +o.lock || 0); set('front', +o.front || 0); },
    setSpeed: (v) => set('speed', Math.abs(+v || 0)),
    setSurface: (s) => set('surface', s || 'asphalt'),
    setBoost: (v) => set('boost', v == null ? -1 : +v),
    setView: (v) => set('view', v === 'interior' || v === 1 ? 1 : 0),
    setSpace(k) { if (!nodes) return; const t = ctx.currentTime; nodes.tunnel.gain.setTargetAtTime(k === 'tunnel' ? 0.5 : 0, t, 0.25); nodes.bridge.gain.setTargetAtTime(k === 'bridge' ? 0.32 : 0, t, 0.25); },
    setActive(on) { active = !!on; if (carPort) carPort.postMessage({ type: 'active', on: active }); if (nodes) nodes.car.gain.setTargetAtTime(active && !paused ? 1 : 0, ctx.currentTime, 0.05); },
    setPaused(p) { paused = !!p; if (nodes) nodes.car.gain.setTargetAtTime(active && !paused ? 1 : 0, ctx.currentTime, 0.08); if (paused) nos(false); duck(); },
    shift, impact, nos, ui, music, voice,
    setVolume, getVolume: (ch) => vol[ch], setMuted, toggleMute() { setMuted(!muted); return muted; }, get muted() { return muted; },
    setMix(k, v) { if (k in mix) { mix[k] = +v; if (nodes && nodes[k]) nodes[k].gain.setTargetAtTime(mix[k], ctx.currentTime, 0.03); } },
    debug() { return { state: ctx && ctx.state, time: ctx && ctx.currentTime, format: ext, sfx: buffers.size, worklet: !!(carNode && carNode.port), track: player && player.id, nextChunk: player && player.next, scheduledTo: player && player.at, playing: player ? player.srcs.length : 0 }; },
    onMeter(fn) { meterFn = fn; if (carPort && carPort.postMessage) carPort.postMessage({ type: 'meter', on: !!fn }); },
    dispose() {
      disposed = true; if (player) player.stop(0); nos(false);
      for (const [el, t, fn, cap] of listeners) el.removeEventListener(t, fn, cap ? { capture: true } : false);
      try { if (carNode) carNode.disconnect(); } catch (e) { /* gone */ }
      if (!opts.context && ctx) ctx.close().catch(() => {});
    },
  };
}

// ---- the module-level API the game's adapter (js/sound.js) calls --------------------------------------------------
let inst = null;
export function init(o = {}) { if (!inst) inst = createDriftAudio(o); return inst; }
export const instance = () => inst;
export function unlock() { if (inst) inst.unlock(); }
export function setEngine(preset, hints) { if (inst) inst.setCarHints(preset, hints || {}); }
export function setRPM(rpm, redline) { if (inst) inst.setRPM(rpm, redline); }
export function setThrottle(t) { if (inst) inst.setThrottle(t); }
export function setSlip(share, o) { if (inst) inst.setSlipShare(share, o); }
export function setSpeed(v) { if (inst) inst.setSpeed(v); }
export function setSurface(s) { if (inst) inst.setSurface(s); }
export function setView(v) { if (inst) inst.setView(v); }
export function setSpace(k) { if (inst) inst.setSpace(k); } // 'open' | 'tunnel' | 'bridge' (day 3)
export function shift(up, cut) { if (inst) inst.shift(up, cut); }
export function impact(kind, strength) { if (inst) inst.impact(kind, strength); }
export function nos(on) { if (inst) inst.nos(on); }
export function ui(name, opt) { if (inst) inst.ui(name, opt); }
export function music(track) { if (inst) inst.music(track); }
export function setMuted(m) { if (inst) inst.setMuted(m); }
export function setVolume(ch, v) { if (inst) inst.setVolume(ch, v); }
export function setPaused(p) { if (inst) inst.setPaused(p); }
export function voice(spec) { return inst ? inst.voice(spec) : null; } // a second car, the duel's rival (day 5)
