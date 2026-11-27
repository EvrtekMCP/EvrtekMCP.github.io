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
// game's stamp when it imports this module stamped (driftaudio.js?v=0.1.25), or opts.version.
//
// THE GAME'S ADAPTER (js/sound.js) uses the module-level functions at the bottom instead: init({ context }) once, then
// setEngine(preset, hints), setRPM(rpm, redline), setThrottle(t), setSlip(share 0..1), setSpeed(m/s), impact(kind,
// strength), nos(on), ui(name), music(track), setMuted(m). Its names are understood: presets i6/v6tt/flat6, hints
// { exhaust, harsh, turbo, squeal }, impact 'hard'/'scrape'/'graze', ui count/go/wipe/buy, music menu/race/results. With no
// shift() call it hears the gear changes in the revs; with no link step it counts the chain itself.
//
// 11-17 (Evrtek, after test v10): ENGINE SOUND 'recorded' (the default) plays a car's recorded engine and tyres
// (audio/recorded.js: whole Eleven takes, crossfaded and pitched by the revs) when its preset has a recorded set,
// for now the KESTREL's turbo4 only; the synthesised car keeps just its wind. 'classic' is the synthesised car, as
// before. setEngineSound(mode) switches at any time; the duel's rival follows the same rule (voice()).
//
// 11-18 (Evrtek on v12: "like a small toy ... no guts"; the launch "hum"): ENGINE SOUND 'new', the default, is synth 2,
// the combustion engine (audio/drift-worklet.js Combustion, presets in audio/car-sounds.js COMBUSTION) for all six cars,
// with the three-layer squeal. Its recorded layer (the squeal loops, the blow-off, the flutter, two big bangs: about
// 60 KB) is fetched after the first tap and handed to the worklet, which plays it sample-accurately; until it arrives the
// same sounds are synthesised. 'recorded' and 'classic' are as they were, for comparing. shift(up, cut, gear) and
// setGears(ratios) let the engine land the revs at rpm x next / current ratio. setLite(true) is the cheaper path (one
// exhaust bank, no muffler chamber or intake runner), taken by itself where there is no AudioWorklet.
//
// 11-19 (2) (Evrtek on test v16: the sound going mute): a worklet that will not load, whose node will not start, or that
// throws while it plays no longer leaves the car silent: the same DSP takes over on the main thread (lite). Shown again,
// the context is asked to run from 'interrupted' as from 'suspended'. levels() reads every bus (the lifecycle test,
// tools/sound/lifecycle.mjs); reinit() puts a new instance on a new context (js/sound.js rebuild()); opts.log hears
// what happened. The launch's revs are no longer masked here: the launch clutch is in js/car.js.
//
// 11-26 (3) (Evrtek: "lacking in that cinema quality depth"; the Eleven passes did not do it): ENGINE SOUND 'newplus', the
// default (New+), is New with depth, all synthesis (no recorded take of engine or tyres): the worklet's New+ layers
// (induction, mechanicals, irregularity, load tone and burble, crackle, phone bass, the clunk and the turbo's surge;
// audio/drift-worklet.js DEFAULT_PLUS, presets audio/car-sounds.js PLUS), the four-tyre stick-slip screech (TyresPlus),
// and here: THE SPACE ROUND THE CAR (setAcoustics: the walls' distances from the car, both sides, from the track; the
// region's facades, canyon walls or forest; the tunnel's boom and the bridge's parapets) and A MASTER BUS on the car
// (a gentle saturation, a glue compressor, a limiter). setPlus(TUNING.sound) switches and levels every layer (the
// five-tap panel, audio/bench.html); setTyreState() takes the game's slip angles, load, lateral g and painted lines.
// New is untouched (tools/sound/same-1126.mjs: sample-identical); New, Recorded and Classic stay for comparing.
const STAMP = new URL(import.meta.url).search;
let cfgLoad = null, recLoad = null;
const MODES = ['newplus', 'new', 'recorded', 'classic'];
const modeOf = (m) => (MODES.includes(m) ? m : 'newplus');
// 11-26 (3): the space, per region (js/courses/index.js REGIONS) and per kind of road (track.kind: 2 tunnel, 3 bridge).
// wall: what the barrier is at the road's edge (the scenery's wall() profiles: k its reflection, lp its top end); far:
// what stands back from it, both sides (d metres past the wall, k, lp, fb a flutter between the two sides); echo: far
// walls (canyon faces, d metres from the road); room: a diffuse tail (rt seconds, lp, level). Physically estimated
// numbers (image sources from the chase camera 6.3 m behind the car), tuned by ear on the bench.
const WALLS = { barrier: { k: 0.5, lp: 4500 }, block: { k: 0.55, lp: 5000 }, parapet: { k: 0.55, lp: 4500 }, curb: { k: 0.45, lp: 4000 }, rail: { k: 0.14, lp: 6500 } };
const SPACES = {
  harbour: { wall: ['barrier', 'rail'], far: { d: 12, k: 0.2, lp: 2800, fb: 0.12 }, farAlt: { d: 20, k: 0.07, lp: 2500, fb: 0 }, room: { rt: 0.6, lp: 3500, g: 0.05 } },
  canyon: { wall: ['block'], far: null, echo: { d: [38, 52], k: 0.3, lp: 1700, fb: 0.3 }, room: { rt: 1.4, lp: 2200, g: 0.06 } },
  mountain: { wall: ['rail', 'rail', 'curb', 'parapet'], far: null, room: { rt: 0.7, lp: 3200, g: 0.09 } }, // the pines: a soft diffuse return
  neon: { wall: ['barrier'], far: { d: 7.5, k: 0.36, lp: 3800, fb: 0.3 }, room: { rt: 0.9, lp: 4500, g: 0.06 } }, // the city canyon
  summit: { wall: ['rail'], far: null, room: { rt: 0.5, lp: 3000, g: 0.015 } }, // open air at the top
  tunnel: { k: 0.42 }, bridge: { echo: { d: [26, 26], k: 0.16, lp: 2200, fb: 0.15 } },
};
const LC = 6.3; // the chase camera's distance from the car, m (the reflected path's extra length is measured from it)
// New+'s bus: the makeup after the glue. Web Audio's compressors add their own makeup (0.6 x the full-range reduction: about
// +5.4 dB for the glue, +1.1 for the limiter), so this takes most of it back: New+ lands about 1.5 dB over New on the
// before-and-after pairs (tools/sound/depth-1126.mjs measures each pair, BS.1770), honest, not level-matched down
const PLUS_MAKEUP = 0.72;
// 11-18: synth 2's recorded layer: whole takes, played in the worklet. Loops carry their loop points (from the set's
// manifest), the squeals their centre pitch (measured: the light about 1,250 Hz, the heavy 1,450) and their level
const TAKES2 = {
  squealLight: { path: 'rec/kestrel/squeal-light', set: 'kestrel', name: 'squeal-light', hz: 1250, g: 0.97 },
  squealHeavy: { path: 'rec/kestrel/squeal-heavy', set: 'kestrel', name: 'squeal-heavy', hz: 1450, g: 0.8 },
  bang: { path: 'rec/kestrel/bang' }, boom: { path: 'rec/kestrel/boom' },
  bov: { path: 'rec/synth2/bov' }, flutter: { path: 'rec/synth2/flutter' },
};
const loadCfg = () => cfgLoad || (cfgLoad = import(new URL('./car-sounds.js' + STAMP, import.meta.url).href));
const loadRec = () => recLoad || (recLoad = import(new URL('./recorded.js' + STAMP, import.meta.url).href).catch((e) => { recLoad = null; throw e; }));

const UI = {
  click: ['ui-click-1', 'ui-click-2'], back: ['ui-click-2'], purchase: ['ui-purchase'], upgrade: ['ui-upgrade'],
  zone: ['ui-zone'], sweet: ['ui-sweet'], link: ['ui-link'], bank: ['ui-bank'], lost: ['ui-lost'],
  star: ['fanfare-star'], degenerate: ['fanfare-degenerate'], count: ['ui-count'], go: ['ui-go'],
};
const UI_ALIAS = { wipe: 'lost', buy: 'purchase', select: 'click', hover: 'click' };
// 11-27: 'menu', 'race' and 'boss' are pools (music.json pools, Evrtek's picks): each call picks one at random, and a
// pool deals every track once before any repeats. A manifest without pools falls back to the 0.1.0 loops.
const MUSIC_ALIAS = { title: 'menu' };
const OLD_POOLS = { menu: ['garage'], race: ['race1', 'race2'], boss: ['race1', 'race2'] };
const UI_GAIN = { click: 0.45, back: 0.4, purchase: 0.7, upgrade: 0.75, zone: 0.55, sweet: 0.6, link: 0.6, bank: 0.7, lost: 0.7, star: 0.85, degenerate: 0.9, count: 0.6, go: 0.6 };
// 11-21 (the launch hum, measured: tools/sound/launch-1121.mjs): the GO take is one held tone, 370 Hz with every
// harmonic, flat for 0.65 s, and it began exactly as the car could move: at 0.7 it was the loudest thing at the start,
// 8-14 dB over the car (12-23 dB through a phone's speaker), in the engine's own register. It now plays as long as a
// count beep (held UI_LEN.go s, then a UI_FADE s fade) at the count's level; the take itself is untouched (0: all of it)
const UI_LEN = { go: 0.24 }, UI_FADE = 0.06;
const IMPACT = { scrape: ['hit-scrape-1', 'hit-scrape-2', 'hit-scrape-3'], swipe: ['hit-swipe-1', 'hit-swipe-2', 'hit-swipe-3'], crunch: ['hit-crunch-1', 'hit-crunch-2', 'hit-crunch-3'] };
const IMPACT_ALIAS = { light: 'scrape', graze: 'scrape', side: 'swipe', hard: 'crunch', headon: 'crunch', 'head-on': 'crunch' }; // graze: 11-19, a touch forgiven (game builder)
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
  const ctl = { rpm: 900, throttle: 0, boost: -1, slip: 0, slipN: -1, spin: 0, lock: 0, front: 0, speed: 0, surface: 'asphalt', view: 0, nos: 0, alphaR: -1, alphaF: -1, loadF: 0, latG: 0, spinV: 0, paint: 0 };
  // 11-26 (3): New+'s switches and levels (js/config.js TUNING.sound's names), the region, the walls, the low tier
  let plusSet = Object.assign({}, opts.plus || {}), region = opts.region || 'harbour', acoustic = { wl: 7, wr: 7, kind: 0, given: false }, tierLite = false, spaceKind = 'open';
  let dirty = false, carSpec = { id: opts.engine || 'six', ups: opts.upgrades || [], over: opts.car || {} };
  let meterFn = null, duckHit = 0, duckFan = 0, duckLevel = 1, nosOn = false, nosSrc = null, nosGain = null;
  let player = null, wantTrack = null, cfg = null, chain = 0, decks = {}, lastDealt = {}, musicSeq = 0, metaP = null, shiftSeen = false, revLast = 0, revT = 0, autoShiftT = 0;
  let engineMode = modeOf(opts.engineSound), recCar = null, recGen = 0, recTimer = null, gears = null, takes2 = null, takes2Bufs = null;
  let lite = opts.lite != null ? !!opts.lite : null; // null: decided when the car starts (the main-thread fallback is lite)
  const recSets = new Map(), voices = new Set(); // voices: each rival's re-sync, run when the mode changes
  let taps = null; // 11-19 (2): analysers on the buses, made by levels()
  let healthBuf = null; // 11-26 (4): health()'s scratch

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
    // 11-26 (3): the car straight to sfx (dry) as before, or (New+) into its bus with the space's returns
    nodes.dry = g(engineMode === 'newplus' ? 0 : 1); nodes.car.connect(nodes.dry).connect(nodes.sfx); nodes.engine.connect(nodes.car); nodes.tyres.connect(nodes.car);
    nodes.master.connect(limiter).connect(ctx.destination);
    // 11-26 (4): what actually leaves for the speaker, read by health() (a NaN anywhere upstream ends here and stays: a
    // compressor or a filter that takes one in keeps it in its state for good; the game then rebuilds the sound)
    nodes.out = ctx.createAnalyser(); nodes.out.fftSize = 512; limiter.connect(nodes.out);
    // day 3 (Fundi): the space round the car. A tunnel is a long dense reverb, a bridge a short slap off the deck and the
    // parapets; both are sends from the car, faded in and out by setSpace()
    const conv = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 1.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < ctx.sampleRate * 0.012 ? 0 : 1); }
    conv.buffer = ir;
    const slap = ctx.createDelay(0.5); slap.delayTime.value = 0.11; const fb = g(0.22), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    nodes.tunnel = g(0); nodes.bridge = g(0);
    nodes.car.connect(nodes.tunnel).connect(conv).connect(nodes.sfx);
    nodes.car.connect(nodes.bridge).connect(slap).connect(lp).connect(nodes.sfx); lp.connect(fb).connect(slap);
    routePlus(true); // 11-26 (3): New+'s space and bus, built and joined only when it plays
    let probe = null; try { probe = new Audio(); } catch (e) { /* no media element: assume Opus */ }
    ext = opts.format || (!probe || probe.canPlayType('audio/ogg; codecs="opus"') ? 'ogg' : 'mp4');
    return true;
  }

  // ---- 11-26 (3): New+'s space and bus ----------------------------------------------------------------------------
  // the impulse responses' noise is seeded, so a render is repeatable
  function irNoise(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 * 2 - 1; }; }
  // a diffuse tail falling 60 dB in rt seconds (the band under 220 Hz in rtLow: a tunnel's boom), low-passed at lp, with
  // early taps [s, gain] (relative to the tail's first 10 ms); unit energy per channel, so its send level is its level
  function makeIR(rt, lp, { rtLow = rt, low = 1, early = [], len = Math.min(3, Math.max(rt, rtLow) * 1.25 + 0.1), seed = 7, pre = 0.008 } = {}) {
    const fs = ctx.sampleRate, n = Math.floor(len * fs), b = ctx.createBuffer(2, n, fs);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c), rnd = irNoise(seed + c * 101), k = 1 - Math.exp(-2 * Math.PI * lp / fs), kl = 1 - Math.exp(-2 * Math.PI * 220 / fs);
      let y = 0, yl = 0, e10 = 0;
      for (let i = 0; i < n; i++) {
        const t = i / fs, w = rnd(); y += k * (w - y); yl += kl * (w - yl);
        const on = t < pre ? 0 : Math.min(1, (t - pre) / 0.012);
        d[i] = ((y - yl) * Math.pow(10, -3 * t / rt) + yl * low * 2.5 * Math.pow(10, -3 * t / rtLow)) * on;
        if (t >= pre && t < pre + 0.01) e10 += d[i] * d[i];
      }
      const tapK = Math.sqrt(e10 || 1e-6);
      for (const [t, gn] of early) { const i = Math.floor((t + (c ? 0.0006 : 0)) * fs); if (i < n) d[i] += gn * tapK * (c ? 0.92 : 1); }
      let e = 0; for (let i = 0; i < n; i++) e += d[i] * d[i]; const s = 1 / Math.sqrt(e || 1); for (let i = 0; i < n; i++) d[i] *= s;
    }
    return b;
  }
  // a tunnel's first 0.4 s: the side walls and the roof, then the flutter between the walls dying away
  const tunnelEarly = () => { const out = [[0.024, 0.9], [0.026, -0.8], [0.029, 0.75]]; for (let k = 1; k <= 9; k++) out.push([0.026 + k * 0.041, (k % 2 ? -0.7 : 0.7) * Math.pow(0.74, k)]); return out; };
  const rooms = new Map();
  const roomIR = (r) => { if (!rooms.has(r)) { const R = (SPACES[r] || SPACES.harbour).room; rooms.set(r, makeIR(R.rt, R.lp, { seed: 3 + Object.keys(SPACES).indexOf(r) * 17 })); } return rooms.get(r); };
  let plus = null;
  const num = (k, d = 1) => (plusSet[k] == null || !isFinite(+plusSet[k]) ? d : +plusSet[k]);
  // Built the first time New+ plays, and connected only while it does: Chrome runs every node joined to the output, silent
  // or not (measured 11-26 (3): these, idle under New, cost New 1.8% of a core). Inside it, each part of the space is fed
  // only while it has something to do (link()): the facades in the harbour and the city, the far echo in the canyon and on
  // a bridge, the tunnel's convolver in a tunnel and for its tail after
  function buildPlus() {
    const P = plus = { links: {} }, g = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    P.busIn = g(1);
    // the space: a mono send of the car to taps (delay, the wall's top end, level, the side it is on) and two tails
    P.send = g(0); P.send.channelCount = 1; P.send.channelCountMode = 'explicit'; P.send.channelInterpretation = 'speakers';
    P.ret = g(1); P.ret.connect(P.busIn);
    const pan = (v) => { if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = v; return p; } return g(1); };
    const tap = (max, lpHz, pv) => { const d = ctx.createDelay(max), f = ctx.createBiquadFilter(), gn = g(0), pn = pan(pv); d.delayTime.value = 0.02; f.type = 'lowpass'; f.frequency.value = lpHz; f.Q.value = 0.5; d.connect(f).connect(gn).connect(pn); return { d, f, g: gn, out: pn }; };
    P.eL = tap(0.25, 4500, -0.75); P.eR = tap(0.25, 4500, 0.75);   // the walls at the road's edge
    P.fL = tap(0.6, 3800, -0.6); P.fR = tap(0.6, 3800, 0.6);       // the facades (the city) or the sheds (the harbour) behind them
    P.fbL = g(0); P.fbR = g(0); P.fL.f.connect(P.fbL).connect(P.fR.d); P.fR.f.connect(P.fbR).connect(P.fL.d); // the flutter between the two sides
    P.xL = tap(1.0, 1700, -0.4); P.xR = tap(1.0, 1700, 0.4);       // far walls: the canyon's faces, a bridge's valley
    P.xfL = g(0); P.xfR = g(0); P.xL.f.connect(P.xfL).connect(P.xR.d); P.xR.f.connect(P.xfR).connect(P.xL.d);
    P.tun = ctx.createConvolver(); P.tun.normalize = false; P.tun.buffer = makeIR(1.5, 4200, { rtLow: 2.8, low: 1.3, early: tunnelEarly(), seed: 11 }); P.tunG = g(0); P.tunG.connect(P.tun); P.late = Infinity;
    P.roomG = g(0); P.room = null; P.roomFor = null; setRoom();
    // the bus: a gentle saturation (unity for quiet signals, rounding the peaks), a glue compressor, the makeup, a limiter
    P.pre = g(0.375); P.shaper = ctx.createWaveShaper(); const N = 2048, cv = new Float32Array(N); for (let i = 0; i < N; i++) cv[i] = Math.tanh(4 * (i / (N - 1) * 2 - 1)); P.shaper.curve = cv; P.shaper.oversample = '2x';
    P.post = g(1 / 1.5);
    P.glue = ctx.createDynamicsCompressor(); P.glue.threshold.value = -18; P.glue.knee.value = 8; P.glue.ratio.value = 2; P.glue.attack.value = 0.02; P.glue.release.value = 0.25;
    P.makeup = g(PLUS_MAKEUP);
    P.lim = ctx.createDynamicsCompressor(); P.lim.threshold.value = -2; P.lim.knee.value = 0; P.lim.ratio.value = 20; P.lim.attack.value = 0.001; P.lim.release.value = 0.1;
    P.wet = g(1); P.byp = g(0);
    P.busIn.connect(P.wet).connect(P.pre).connect(P.shaper).connect(P.post).connect(P.glue).connect(P.makeup).connect(P.lim);
    P.busIn.connect(P.byp);
  }
  // join or part two nodes, once (a connection made twice is one; parting one not made throws)
  // a part of the space: fed while it works, joined to the mix while it works and for its tail after, then parted (an idle
  // node joined to the output is still run); true while it is joined
  function part(name, on, tail, ins, outs) {
    const P = plus, t = ctx.currentTime, k = 'off_' + name;
    if (on) P[k] = Infinity; else if (P[k] === Infinity) P[k] = t; else if (P[k] === undefined) P[k] = -99;
    const joined = on || t - P[k] < tail;
    ins.forEach(([a, b], i) => link(on, a, b, name + '>' + i)); outs.forEach(([a, b], i) => link(joined, a, b, name + '<' + i));
    if (!on && joined) P.late = Math.min(P.late, P[k] + tail);
    return joined;
  }
  function link(on, from, to, key) { const P = plus; if (!!P.links[key] === !!on) return; P.links[key] = !!on; try { if (on) from.connect(to); else from.disconnect(to); } catch (e) { /* already apart */ } }
  function setRoom() { // the region's diffuse tail: a new convolver (a buffer is set once), swapped in
    const P = plus; if (!P || P.roomFor === region) return;
    const c = ctx.createConvolver(); c.normalize = false; c.buffer = roomIR(region);
    if (P.room) { try { P.roomG.disconnect(); P.room.disconnect(); } catch (e) { /* gone */ } }
    P.room = c; P.roomFor = region; P.roomG.connect(c);
    if (P.links['room<0']) { P.links['room<0'] = false; link(true, c, P.ret, 'room<0'); }
  }
  // which way the car goes (New+: into its bus, else dry, as before), the bus on or bypassed, the space's send
  function routePlus(now) {
    const on = engineMode === 'newplus';
    if (on && !plus) { buildPlus(); now = true; }
    const t = ctx.currentTime, set = (prm, v) => { if (now) prm.value = v; else prm.setTargetAtTime(v, t, 0.04); };
    set(nodes.dry.gain, on ? 0 : 1);
    const P = plus; if (!P) { oldSends(now); return; }
    const bus = on && num('masterBus') > 0, space = on && num('reflections') > 0, d = Math.max(0.25, num('busDrive'));
    link(on, nodes.car, P.busIn, 'in'); link(on && bus, P.lim, nodes.sfx, 'wet'); link(on && !bus, P.byp, nodes.sfx, 'byp'); link(space, nodes.car, P.send, 'send');
    set(P.wet.gain, bus ? 1 : 0); set(P.byp.gain, bus ? 0 : 1); set(P.pre.gain, 0.375 * d); set(P.post.gain, 1 / (1.5 * d));
    P.shaper.oversample = tierLite || lite ? 'none' : '2x'; // the low tier: the saturation without its oversampling
    set(P.send.gain, space ? num('spaceLvl') : 0);
    spaceKey = ''; oldSends(now); updateSpace(now);
  }
  // New, Recorded and Classic keep day 3's tunnel and bridge sends; New+ has its own space
  function oldSends(now) {
    const on = engineMode !== 'newplus', t = ctx.currentTime, tv = on && spaceKind === 'tunnel' ? 0.5 : 0, bv = on && spaceKind === 'bridge' ? 0.32 : 0;
    if (now) { nodes.tunnel.gain.value = tv; nodes.bridge.gain.value = bv; } else { nodes.tunnel.gain.setTargetAtTime(tv, t, 0.25); nodes.bridge.gain.setTargetAtTime(bv, t, 0.25); }
  }
  // the space from where the car is: each wall's image source seen from the chase camera (its extra path sets the
  // delay, the spreading the level), the region's far reflectors, the tunnel or the bridge
  let spaceKey = '';
  function updateSpace(now) {
    const P = plus; if (!P || !nodes || engineMode !== 'newplus') return;
    const S = SPACES[region] || SPACES.harbour, kind = acoustic.given ? acoustic.kind : spaceKind === 'tunnel' ? 2 : spaceKind === 'bridge' ? 3 : 0, tun = kind === 2, bri = kind === 3;
    const dl = acoustic.given ? acoustic.wl : 7, dr = acoustic.given ? acoustic.wr : 7;
    const q = (d) => Math.round(d * 4) / 4, key = [region, kind, q(dl), q(dr), ctl.view, tierLite || lite].join(); // to a quarter metre: a wall a metre off moves its echo 0.4 ms
    if (key === spaceKey && !now && !(ctx.currentTime >= P.late)) return; spaceKey = key; // (late: a part's tail has rung out)
    const W = tun ? { k: 0.6, lp: 4000 } : WALLS[S.wall[kind] || S.wall[0]] || WALLS.barrier, lc = ctl.view ? 0.8 : LC;
    const path = (d) => Math.sqrt(lc * lc + 4 * d * d) - lc; // the reflection's extra path over the direct one, m
    // short linear ramps that end (a setTargetAtTime never does, and keeps every one of these computed per sample: measured
    // 11-26 (3), the space then cost as much as the whole car); only a value that moved is touched
    const t = ctx.currentTime, set = (prm, v, tc) => { if (now) { prm.value = v; return; } if (Math.abs(prm.value - v) < 1e-4 * Math.max(1, Math.abs(v))) return; prm.cancelScheduledValues(t); prm.setValueAtTime(prm.value, t); prm.linearRampToValueAtTime(v, t + Math.max(0.03, tc * 2)); };
    const wall = (tp, d) => { const e = path(Math.max(0.3, d + (tun ? 0.6 : 0))); set(tp.d.delayTime, Math.min(0.24, e / 343), 0.06); set(tp.g.gain, W.k * lc / (lc + e), 0.12); set(tp.f.frequency, W.lp, 0.1); };
    const sp = num('reflections') > 0; P.late = Infinity;
    part('walls', sp, 0.5, [[P.send, P.eL.d], [P.send, P.eR.d]], [[P.eL.out, P.ret], [P.eR.out, P.ret]]);
    wall(P.eL, dl); wall(P.eR, dr);
    const low = tierLite || lite; // the low tier keeps the walls beside the car and the tunnel; no facades, far echo or region tail
    const F = tun || bri || low ? null : kind === 1 && S.farAlt ? S.farAlt : S.far;
    part('far', sp && !!F, 2.5, [[P.send, P.fL.d], [P.send, P.fR.d]], [[P.fL.out, P.ret], [P.fR.out, P.ret]]);
    const far = (tp, d) => { if (!F) { set(tp.g.gain, 0, 0.2); return; } const e = path(d + F.d), e0 = path(7 + F.d); set(tp.d.delayTime, Math.min(0.58, e / 343), 0.06); set(tp.g.gain, F.k * Math.min(1.4, (lc + e0) / (lc + e)), 0.15); set(tp.f.frequency, F.lp, 0.1); };
    far(P.fL, dl); far(P.fR, dr); set(P.fbL.gain, F ? F.fb : 0, 0.15); set(P.fbR.gain, F ? F.fb : 0, 0.15);
    const E = low ? null : bri ? SPACES.bridge.echo : tun ? null : S.echo;
    part('echo', sp && !!E, 4, [[P.send, P.xL.d], [P.send, P.xR.d]], [[P.xL.out, P.ret], [P.xR.out, P.ret]]);
    const echo = (tp, d) => { if (!E) { set(tp.g.gain, 0, 0.25); return; } set(tp.d.delayTime, Math.min(0.98, path(d) / 343), 0.2); set(tp.g.gain, E.k, 0.25); set(tp.f.frequency, E.lp, 0.1); };
    echo(P.xL, E ? E.d[0] : 30); echo(P.xR, E ? E.d[1] : 30); set(P.xfL.gain, E ? E.fb : 0, 0.25); set(P.xfR.gain, E ? E.fb : 0, 0.25);
    // the tunnel's convolver fed in a tunnel and for 4 s after (its tail rings out on its own); the region's tail likewise
    part('tun', sp && tun, 4.5, [[P.send, P.tunG]], [[P.tun, P.ret]]);
    part('room', sp && !tun && !low && S.room.g > 0, 2.5, [[P.send, P.roomG]], [[P.room, P.ret]]);
    set(P.tunG.gain, tun ? SPACES.tunnel.k : 0, 0.22);
    set(P.roomG.gain, tun ? 0 : S.room.g * (bri ? 0.5 : 1), 0.3);
  }

  // one synthesised car: its engine out to `eng`, its tyres to `tyr`. The player's car and every voice() use this.
  // An AudioWorklet where there is one; on old Safari the same DSP in a ScriptProcessor on the main thread.
  // 11-19 (2): and wherever the worklet will not load or its node will not start (before, that was a silent car, and
  // the rival's with it): the main thread takes over, lite, for the rest of the session
  let workletAdded = null, noWorklet = !!opts.noWorklet;
  const log = opts.log || (() => {});
  const goLite = () => { noWorklet = true; workletAdded = null; if (opts.lite == null) lite = true; };
  async function makeCar(conf, eng, tyr, o = {}) {
    if (!noWorklet && ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
      try {
        await (workletAdded || (workletAdded = ctx.audioWorklet.addModule(url('drift-worklet.js')))); // once per context
        const node = new AudioWorkletNode(ctx, 'drift-car', { numberOfInputs: 0, numberOfOutputs: 2, outputChannelCount: [1, 2], processorOptions: { config: conf, meter: !!o.meter, seed: o.seed } });
        node.connect(eng, 0); node.connect(tyr, 1);
        return { node, port: node.port };
      } catch (e) { log('worklet failed: the main thread plays the car', { err: String(e && (e.name || e.message)) }); goLite(); }
    }
    await import(url('drift-worklet.js'));
    if (lite === null) lite = true; // on the main thread: the cheaper path
    if (lite && conf.engine && conf.engine.model === 'combustion') conf = Object.assign({}, conf, { engine: Object.assign({}, conf.engine, { lite: true }) });
    if (lite && conf.engine && conf.engine.plus) conf = Object.assign({}, conf, { engine: Object.assign({}, conf.engine, { plus: Object.assign({}, conf.engine.plus, { lite: true }) }), tyres: Object.assign({}, conf.tyres, { plus: Object.assign({}, conf.tyres.plus, { lite: true }) }) }); // 11-26 (3): New+'s low tier on the main thread
    const dsp = new globalThis.DriftDSP.DriftCarDSP(ctx.sampleRate, o.seed);
    dsp.message(conf);
    let on = true;
    const sp = ctx.createScriptProcessor(1024, 0, 3), split = ctx.createChannelSplitter(3), merge = ctx.createChannelMerger(2);
    sp.onaudioprocess = (e) => { const b = e.outputBuffer; if (!on) { for (let c = 0; c < 3; c++) b.getChannelData(c).fill(0); return; } dsp.render(b.getChannelData(0), b.getChannelData(1), b.getChannelData(2), b.length); };
    sp.connect(split); split.connect(eng, 0); split.connect(merge, 1, 0); split.connect(merge, 2, 1); merge.connect(tyr);
    return { node: sp, port: { postMessage: (m) => { if (m.type === 'active') on = m.on; else dsp.message(m); } } };
  }
  // 11-18: the config the worklet takes, for the mode: 'new' the combustion engine and the three-layer squeal
  const overOf = (o) => (lite ? Object.assign({}, o, { lite: true }) : o);
  // 11-26 (3): 'newplus' resolves New+ (model 'plus') with the panel's switches and levels; its low tier is lite too
  const confFor = (spec) => {
    if (engineMode === 'newplus') { const o = Object.assign({}, spec.over, { plus: cfg.plusFrom(plusSet) }); if (lite || tierLite) o.lite = true; return Object.assign({ type: 'config' }, cfg.resolveCarSound(spec.id, spec.ups, o, 'plus')); }
    return Object.assign({ type: 'config' }, cfg.resolveCarSound(spec.id, spec.ups, overOf(spec.over), engineMode === 'new' ? 'new' : undefined));
  };
  // New's recorded layer (its squeal loops, blow-off, flutter, bangs) is fetched for New, and for New+ only when its
  // screech is switched off (the shipped squeal loops are then New+'s fallback); New+ itself plays no recording
  const wantTakes = () => engineMode === 'new' || (engineMode === 'newplus' && num('screech') === 0);
  async function startCar() {
    cfg = await loadCfg();
    if (lite === null && !noWorklet && ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined') lite = false;
    const conf = confFor(carSpec);
    const c = await makeCar(conf, nodes.engine, nodes.tyres, { meter: !!meterFn });
    if (disposed) return;
    carNode = c.node; carPort = c.port;
    if (carNode.port) carPort.onmessage = (e) => { if (meterFn) meterFn(e.data); };
    // 11-19 (2): a worklet that throws while it plays goes quiet for good; the main thread takes the car over
    if (carNode.port) carNode.onprocessorerror = () => { log('worklet stopped: the main thread plays the car'); goLite(); try { carNode.disconnect(); } catch (e) { /* gone */ } carNode = carPort = null; startCar().then(() => syncRec()).catch(() => {}); };
    if (!active) carPort.postMessage({ type: 'active', on: false });
    if (gears) carPort.postMessage({ type: 'gears', ratios: gears });
    flush();
    sendTakes2(carPort);
  }
  // the recorded layer for synth 2, fetched once (after the first tap), then handed to every car's worklet
  function loadTakes2() {
    if (takes2 || !wantTakes() || !ctx) return takes2;
    takes2 = (async () => {
      let man = null; try { man = await (await fetch(url('rec/kestrel/kestrel.json'))).json(); } catch (e) { /* no loops then */ }
      const out = {};
      await Promise.all(Object.entries(TAKES2).map(async ([k, t]) => {
        try {
          const b = await fetchBuffer(t.path), d = new Float32Array(b.getChannelData(0));
          const e = { data: d, rate: b.sampleRate };
          if (t.set) { const f = man && man.files[t.name]; if (!f || !f.loop) return; Object.assign(e, { ls: Math.round(f.loopStart * b.sampleRate), le: Math.min(d.length - 2, Math.round(f.loopEnd * b.sampleRate)), rr: b.sampleRate / ctx.sampleRate, hz: t.hz, g: t.g }); }
          out[k] = e;
        } catch (err) { /* that take stays synthesised */ }
      }));
      takes2Bufs = out; return out;
    })();
    return takes2;
  }
  function sendTakes2(port) { if (!wantTakes() || !port) return; const t = loadTakes2(); if (t) t.then((b) => { if (b && wantTakes()) port.postMessage({ type: 'samples', bufs: b }); }); }

  // 11-17: the recorded engine and tyres. A set is fetched once (after the first tap, with the effects) and shared by
  // the player's car and the rival's; which car plays it is decided here whenever the car or the mode changes.
  const presetOf = (id) => (cfg && cfg.PRESET_ALIAS && cfg.PRESET_ALIAS[id]) || id;
  const redlineOf = (spec) => spec.over.redlineRpm || (cfg && cfg.ENGINES[presetOf(spec.id)] || {}).redlineRpm || 7600;
  function getSet(m, id) {
    // a set that fails to load (the network) is not remembered: the next car change or mode switch tries again
    if (!recSets.has(id)) recSets.set(id, m.loadSet(id, async (p) => (await fetch(url(p))).json(), (p) => fetchBuffer(p)).catch(() => { recSets.delete(id); return null; }));
    return recSets.get(id);
  }
  async function recSetFor(preset) { // the loaded set for a preset in 'recorded' mode, or null (play the synthesised car)
    if (engineMode !== 'recorded' || !nodes) return null;
    let m; try { m = await loadRec(); } catch (e) { return null; }
    const id = m.SETS[presetOf(preset)];
    if (!id) return null;
    const set = await getSet(m, id);
    return set ? { m, set } : null;
  }
  async function syncRec() {
    const gen = ++recGen, r = await recSetFor(carSpec.id);
    if (gen !== recGen || disposed) return;
    if (r && (!recCar || recCar.set !== r.set)) { if (recCar) recCar.dispose(); recCar = new r.m.RecordedCar(ctx, r.set, nodes.engine, nodes.tyres, { seed: 11171, redline: redlineOf(carSpec) }); }
    if (!r && recCar) { recCar.dispose(); recCar = null; }
    if (recCar) { recCar.setRedline(redlineOf(carSpec)); recCar.setActive(active); recCar.update(ctl); }
    if (carPort) carPort.postMessage({ type: 'parts', engine: !recCar, tyres: recCar ? 'wind' : 'all' });
    // the loops' easing (load, slide, surfaces) and the limiter run on time: keep them ticking between control changes
    if (recCar && !recTimer && !opts.offline) recTimer = setInterval(() => { if (recCar && recCar.on) recCar.update({}); }, 40);
    if (!recCar && recTimer) { clearInterval(recTimer); recTimer = null; }
  }
  function preloadRec() { // fetch the sets 'recorded' can play, in the background, so the first run does not wait
    if (engineMode !== 'recorded') return;
    loadRec().then((m) => { for (const id of new Set(Object.values(m.SETS))) getSet(m, id); }).catch(() => {});
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
    let car = null, rc = null, rgen = 0, gone = false, on = true, sp = { id: spec.preset || 'six', ups: [], over: {} };
    const conf = () => confFor(sp);
    const kill = () => { try { if (car) car.node.disconnect(); out.disconnect(); } catch (e) { /* gone */ } car = null; if (rc) { rc.dispose(); rc = null; } };
    // 11-17: a rival in a car with a recorded set, in 'recorded' mode, plays that set (its synthesised car is idle)
    const vsync = async () => {
      const g = ++rgen, r = await recSetFor(sp.id);
      if (g !== rgen || gone) return;
      if (car) { car.port.postMessage(conf()); sendTakes2(car.port); } // 11-18: the mode decides the engine model too
      if (r && (!rc || rc.set !== r.set)) { if (rc) rc.dispose(); rc = new r.m.RecordedCar(ctx, r.set, eng, tyr, { seed: (spec.seed || 77813) + 1, redline: redlineOf(sp) }); }
      if (!r && rc) { rc.dispose(); rc = null; }
      if (rc) { rc.setRedline(redlineOf(sp)); rc.setActive(on); rc.update(vc); }
      if (car) car.port.postMessage({ type: 'active', on: on && !rc });
    };
    voices.add(vsync);
    const vready = ready.then(async () => {
      if (gone) return;
      const c = await makeCar(conf(), eng, tyr, { seed: spec.seed || 77813 });
      if (gone) { car = c; kill(); return; }
      car = c; if (!on) car.port.postMessage({ type: 'active', on: false });
      car.port.postMessage({ type: 'ctl', v: vc });
      await vsync();
    });
    vready.catch((e) => console.warn('driftaudio: voice ' + e.message));
    return {
      ready: vready, out, bus: nodes.car,
      get recorded() { return rc ? rc.set.id : null; }, // 11-17: the recorded set this rival plays, or null
      async setHints(preset, hints = {}, redline) {
        const c = await loadCfg(); sp = { id: preset || hints.preset || sp.id, ups: c.hintsToUpgrades(hints), over: redline ? { redlineRpm: redline } : {} };
        if (car) car.port.postMessage(conf());
        await vsync();
      },
      update(s) {
        for (const k of ['rpm', 'throttle', 'boost', 'spin', 'lock', 'front', 'speed', 'surface']) if (s[k] !== undefined) vc[k] = s[k];
        if (s.share !== undefined) { const v = Math.max(0, Math.min(1, +s.share || 0)); vc.slipN = v; vc.slip = v * 45; }
        if (rc) { if (on) rc.update(vc); } else if (car && on) car.port.postMessage({ type: 'ctl', v: vc });
      },
      shift(cut, up = true, gear) { if (rc) rc.shift(up, cut == null ? 0.15 : cut); else if (car) car.port.postMessage({ type: 'shift', cut: cut == null ? 0.15 : cut, up, gear }); },
      setGears(r) { if (car) car.port.postMessage({ type: 'gears', ratios: r }); },
      setActive(a) { on = !!a; if (rc) rc.setActive(on); if (car) car.port.postMessage({ type: 'active', on: on && !rc }); },
      dispose() { gone = true; voices.delete(vsync); kill(); },
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
    // hidden: suspended (no sound and no battery in the background). Shown: asked to run again, from 'suspended' or iOS's
    // 'interrupted' alike (11-19 (2)); where that is refused outside a gesture, the next touch's unlock() asks again
    const vis = () => { if (document.hidden) { if (ctx.state === 'running') ctx.suspend().catch(() => {}); } else if (ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {}); };
    document.addEventListener('visibilitychange', vis); listeners.push([document, 'visibilitychange', vis, false]);
  }

  // ---- per-frame controls ------------------------------------------------------------------------------------
  function set(k, v) { if (ctl[k] !== v) { ctl[k] = v; if (!dirty) { dirty = true; queueMicrotask(flush); } } }
  function flush() {
    dirty = false;
    if (carPort) carPort.postMessage({ type: 'ctl', v: ctl });
    if (recCar) recCar.update(ctl);
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
    if (!b || !ctx || (ctx.state !== 'running' && !opts.offline)) return null; // offline: the demo renderer's context
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
  function shift(up = true, cut, gear) { shiftSeen = true; doShift(up, cut, gear); }
  function doShift(up, cut, gear) {
    if (carPort) carPort.postMessage({ type: 'shift', cut: cut == null ? 0.15 : cut, up: up !== false, gear });
    if (recCar) recCar.shift(up, cut == null ? 0.15 : cut);
    if (engineMode === 'newplus' && num('shiftFx') > 0) return; // 11-26 (3): New+ makes its own clunk, at the clutch's take-up (the worklet)
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
    const g = UI_GAIN[name] || 0.6, h = play(id, { bus: nodes.ui, gain: g, rate });
    if (h && UI_LEN[name]) { const t = ctx.currentTime + UI_LEN[name]; h.gain.gain.setValueAtTime(g, t); h.gain.gain.linearRampToValueAtTime(0, t + UI_FADE); h.src.stop(t + UI_FADE + 0.01); }
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
  function deal(name, pool) { // a shuffled deck per pool; a new deck never opens on the track that just played
    let d = decks[name];
    if (!d || !d.length) {
      d = pool.slice(); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
      if (d.length > 1 && d[0] === lastDealt[name]) d.push(d.shift());
      decks[name] = d;
    }
    return (lastDealt[name] = d.shift());
  }
  async function music(track) {
    track = MUSIC_ALIAS[track] || track;
    const seq = ++musicSeq;
    if (track && !musicMeta) {
      if (!metaP) metaP = fetch(url('music/music.json')).then((r) => r.json()).catch((e) => { metaP = null; throw e; });
      try { musicMeta = await metaP; } catch (e) { console.warn('driftaudio: music.json', e); return; }
      if (seq !== musicSeq) return; // a later call won
    }
    const pools = (musicMeta && musicMeta.pools) || OLD_POOLS, pool = pools[track];
    if (pool) {
      if (player && !player.stopped && pool.includes(player.id)) { wantTrack = player.id; return; } // same screen: keep it
      track = !player && pool.includes(wantTrack) ? wantTrack : deal(track, pool); // waiting for unlock: keep the pick
    }
    wantTrack = track || null;
    if (player && player.id === track && !player.stopped) return;
    if (player) { player.stop(); player = null; }
    if (!track || !ctx || !musicMeta) return;
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

  function pushCar() { if (carPort && cfg) carPort.postMessage(confFor(carSpec)); }
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
    preloadRec(); loadTakes2();
    await Promise.all([startCar(), loadSfx()]);
    await syncRec();
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
      pushCar(); if (nodes && carNode) syncRec();
    },
    configureCar(cfg) { if (carPort) carPort.postMessage(Object.assign({ type: 'config' }, cfg)); }, // a resolved {engine, tyres}, for tuning
    update(s) { for (const k of ['rpm', 'throttle', 'slip', 'spin', 'lock', 'front', 'speed', 'surface', 'boost']) if (s[k] !== undefined) set(k, s[k]); },
    setRPM(v, redline) {
      v = +v || 0; watchRevs(v); set('rpm', v);
      if (redline && redline !== carSpec.over.redlineRpm) { carSpec.over = Object.assign({}, carSpec.over, { redlineRpm: redline }); pushCar(); if (recCar) recCar.setRedline(redline); }
    },
    async setCarHints(preset, hints = {}) { const c = await loadCfg(); carSpec = { id: preset || hints.preset || carSpec.id, ups: c.hintsToUpgrades(hints), over: carSpec.over }; pushCar(); if (nodes && carNode) syncRec(); },
    // 11-17: 'recorded' or 'classic'; 11-18: 'new' (the default). The player's car and every rival switch at once
    setEngineSound(mode) {
      const m = modeOf(mode); if (m === engineMode) return; engineMode = m;
      preloadRec(); loadTakes2(); pushCar(); sendTakes2(carPort); if (nodes && carNode) syncRec(); for (const v of voices) v();
      if (nodes) { spaceKey = ''; routePlus(false); } // 11-26 (3): New+ into its bus and space, the others dry as before
    },
    // 11-26 (3): New+'s switches and levels (js/config.js TUNING.sound: induction, mechanical, irregular, loadTone,
    // overrun, phoneBass, shiftFx, turboFx, screech, fourTyres, transitions, reflections, masterBus and the *Lvl levels,
    // busDrive; solo: one part alone, a tyre part as 't:screech' and so on). Only a change reconfigures the car
    setPlus(o = {}) {
      const next = Object.assign({}, o), was = JSON.stringify(plusSet); if (JSON.stringify(next) === was) return;
      const takesWere = wantTakes(); plusSet = next;
      if (engineMode === 'newplus') { pushCar(); for (const v of voices) v(); if (!takesWere && wantTakes()) { loadTakes2(); sendTakes2(carPort); } }
      if (nodes) routePlus(false);
    },
    get plus() { return Object.assign({}, plusSet); },
    // 11-26 (3): the game's tyres as New+ hears them: slip angles (degrees), the front axle's share of the load, the lateral
    // acceleration (m/s2, + to the left), the rears' wheelspin (m/s faster than the road) and the share of the rears on paint
    setTyreState(o = {}) { for (const k of ['alphaR', 'alphaF', 'loadF', 'latG', 'spinV', 'paint']) if (o[k] !== undefined && isFinite(+o[k])) set(k, +o[k]); },
    // 11-26 (3): where the walls are (metres from the car to the wall on the left and on the right) and the road's kind
    // (track.kind: 0 or 1 the region's walls, 2 a tunnel, 3 a bridge); the region (js/courses/index.js REGIONS)
    setAcoustics(o = {}) { acoustic = { wl: +o.wl > 0 ? +o.wl : 7, wr: +o.wr > 0 ? +o.wr : 7, kind: o.kind | 0, given: true }; updateSpace(false); },
    setRegion(r) { if (!r || r === region) return; region = r; if (plus) { setRoom(); spaceKey = ''; updateSpace(false); } },
    get region() { return region; },
    // 11-26 (3): the game's lowest quality tier: New+ there is lite (New's one-bank engine, no mechanicals, induction or front
    // tyres) and its space keeps only the walls beside the car and the tunnel (no facades, far echo or region tail), the
    // bus's saturation without oversampling
    setTierLite(on) { const l = !!on; if (l === tierLite) return; tierLite = l; if (engineMode === 'newplus') { pushCar(); for (const v of voices) v(); } if (nodes) routePlus(false); },
    // 11-18: the gearbox's ratios (first gear first), so a shift lands the revs at rpm x next / current ratio
    setGears(r) { gears = Array.isArray(r) && r.length ? r.slice() : null; if (carPort && gears) carPort.postMessage({ type: 'gears', ratios: gears }); },
    // 11-18: the cheaper engine (one bank, no muffler chamber or intake runner), for weak devices
    setLite(on) { const l = !!on; if (l === lite) return; lite = l; pushCar(); for (const v of voices) v(); },
    get lite() { return !!lite; },
    get takes() { return takes2 || Promise.resolve(null); }, // 11-18: resolves when synth 2's recorded layer has arrived
    get engineSound() { return engineMode; },
    get recorded() { return recCar ? recCar.set.id : null; },
    setSlipShare(s, o = {}) { s = Math.max(0, Math.min(1, +s || 0)); set('slipN', s); set('slip', s * 45); set('spin', +o.spin || 0); set('lock', +o.lock || 0); set('front', +o.front || 0); },
    setThrottle: (v) => set('throttle', +v || 0),
    setSlip(deg, o = {}) { set('slipN', -1); set('slip', Math.abs(+deg || 0)); set('spin', +o.spin || 0); set('lock', +o.lock || 0); set('front', +o.front || 0); },
    setSpeed: (v) => set('speed', Math.abs(+v || 0)),
    setSurface: (s) => set('surface', s || 'asphalt'),
    setBoost: (v) => set('boost', v == null ? -1 : +v),
    setView: (v) => set('view', v === 'interior' || v === 1 ? 1 : 0),
    setSpace(k) { spaceKind = k || 'open'; if (!nodes) return; oldSends(false); updateSpace(false); }, // 11-26 (3): New+ reads it when no setAcoustics() came
    setActive(on) { active = !!on; if (carPort) carPort.postMessage({ type: 'active', on: active }); if (recCar) recCar.setActive(active); if (nodes) nodes.car.gain.setTargetAtTime(active && !paused ? 1 : 0, ctx.currentTime, 0.05); },
    setPaused(p) { paused = !!p; if (nodes) nodes.car.gain.setTargetAtTime(active && !paused ? 1 : 0, ctx.currentTime, 0.08); if (paused) nos(false); duck(); },
    shift, impact, nos, ui, music, voice,
    setVolume, getVolume: (ch) => vol[ch], setMuted, toggleMute() { setMuted(!muted); return muted; }, get muted() { return muted; },
    setMix(k, v) { if (k in mix) { mix[k] = +v; if (nodes && nodes[k]) nodes[k].gain.setTargetAtTime(mix[k], ctx.currentTime, 0.03); } },
    // 11-26 (4): the output's health, cheap enough for twice a second: bad (a NaN or an infinity reached the speaker's feed)
    // and its level (dB RMS of the last 512 samples; -120 for digital silence)
    health() {
      if (!nodes || !nodes.out) return null;
      const b = healthBuf || (healthBuf = new Float32Array(nodes.out.fftSize)); nodes.out.getFloatTimeDomainData(b);
      let e = 0, bad = false; for (let i = 0; i < b.length; i++) { const v = b[i]; if (!Number.isFinite(v)) { bad = true; break; } e += v * v; }
      return { bad, db: bad ? null : Math.max(-120, 10 * Math.log10(e / b.length || 1e-12)), state: ctx.state };
    },
    debug() { return { state: ctx && ctx.state, time: ctx && ctx.currentTime, format: ext, sfx: buffers.size, worklet: !!(carNode && carNode.port), engineSound: engineMode, lite: !!lite, takes2: takes2Bufs ? Object.keys(takes2Bufs).length : 0, recorded: recCar ? recCar.set.id : null, recPlaying: !!(recCar && recCar.on), track: player && player.id, nextChunk: player && player.next, scheduledTo: player && player.at, playing: player ? player.srcs.length : 0, region, tierLite, bus: engineMode === 'newplus' && num('masterBus') > 0, space: engineMode === 'newplus' && num('reflections') > 0 }; },
    onMeter(fn) { meterFn = fn; if (carPort && carPort.postMessage) carPort.postMessage({ type: 'meter', on: !!fn }); },
    // 11-19 (2): the context, the buses' gains and what each bus is putting out now (dB, RMS of the last 2,048 samples):
    // the lifecycle test reads it after every transition (tools/sound/lifecycle.mjs). Its taps are made on the first call
    levels() {
      if (!nodes) return { state: ctx && ctx.state, nodes: false };
      if (!taps) { taps = {}; for (const k of ['master', 'car', 'music', 'ui']) { const a = ctx.createAnalyser(); a.fftSize = 2048; nodes[k].connect(a); taps[k] = a; } }
      const out = { state: ctx.state, time: +ctx.currentTime.toFixed(3), paused, active, muted, worklet: !!(carNode && carNode.port), car: !!carNode, engineSound: engineMode, gain: { master: +nodes.master.gain.value.toFixed(3), car: +nodes.car.gain.value.toFixed(3), duck: +nodes.duck.gain.value.toFixed(3) }, db: {} };
      const buf = new Float32Array(2048);
      for (const k in taps) { taps[k].getFloatTimeDomainData(buf); let e = 0; for (let i = 0; i < buf.length; i++) e += buf[i] * buf[i]; out.db[k] = Math.max(-120, +(10 * Math.log10(e / buf.length || 1e-12)).toFixed(1)); }
      return out;
    },
    dispose() {
      disposed = true;
      for (const [el, t, fn, cap] of listeners) el.removeEventListener(t, fn, cap ? { capture: true } : false);
      try { if (player) player.stop(0); nos(false); } catch (e) { /* a closed context (a rebuild) */ }
      if (recTimer) clearInterval(recTimer); try { if (recCar) recCar.dispose(); } catch (e) { /* closed */ }
      try { if (carNode) carNode.disconnect(); } catch (e) { /* gone */ }
      if (!opts.context && ctx) ctx.close().catch(() => {});
    },
  };
}

// ---- the module-level API the game's adapter (js/sound.js) calls --------------------------------------------------
let inst = null;
export function init(o = {}) { if (!inst) inst = createDriftAudio(o); return inst; }
// 11-19 (2): a new instance on a new context (js/sound.js rebuild(): a context iOS would not bring back); the old one
// is let go first (its listeners, its music, its car)
export function reinit(o = {}) { if (inst) { try { inst.dispose(); } catch (e) { /* its context is already closed */ } inst = null; } return init(o); }
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
export function shift(up, cut, gear) { if (inst) inst.shift(up, cut, gear); }
export function impact(kind, strength) { if (inst) inst.impact(kind, strength); }
export function nos(on) { if (inst) inst.nos(on); }
export function ui(name, opt) { if (inst) inst.ui(name, opt); }
export function music(track) { if (inst) inst.music(track); }
export function setMuted(m) { if (inst) inst.setMuted(m); }
export function setVolume(ch, v) { if (inst) inst.setVolume(ch, v); }
export function setPaused(p) { if (inst) inst.setPaused(p); }
export function voice(spec) { return inst ? inst.voice(spec) : null; } // a second car, the duel's rival (day 5)
export function setEngineSound(mode) { if (inst) inst.setEngineSound(mode); } // 'newplus' | 'new' | 'recorded' | 'classic' (11-17, 11-18, 11-26 (3))
export function setPlus(o) { if (inst) inst.setPlus(o); } // 11-26 (3): New+'s switches and levels (TUNING.sound)
export function setTyreState(o) { if (inst) inst.setTyreState(o); } // 11-26 (3): slip angles, load, lateral g, wheelspin, paint
export function setAcoustics(o) { if (inst) inst.setAcoustics(o); } // 11-26 (3): { wl, wr, kind }: the walls and the road's kind
export function setRegion(r) { if (inst) inst.setRegion(r); } // 11-26 (3): the course's region
export function setTierLite(on) { if (inst) inst.setTierLite(on); } // 11-26 (3): the game's lowest quality tier
export function setGears(r) { if (inst) inst.setGears(r); } // 11-18: the gearbox's ratios
export function setLite(on) { if (inst) inst.setLite(on); } // 11-18: the cheaper engine for weak devices
