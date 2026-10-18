'use strict';
// ---------------------------------------------------------------------------
// Sound, synthesised. Nothing is fetched and nothing is a sample.
//
// That is a standing rule rather than a flourish (Evrtek, again on 2026-10-17:
// "let's keep the synthesized approach"): the game has to run off a file:// URL
// in an Arcade cabinet with no server behind it, and a cabinet that waits on a
// 300 KB .ogg is a cabinet that starts silent and then shouts three seconds
// later. Everything in here is an oscillator and a filter, so the whole
// soundtrack costs about the size of this file.
//
// Three rules shape the code more than taste does:
//
//   1. Nothing may make a noise before the player has touched something.
//      Every browser suspends a fresh AudioContext, and a game that ignores
//      that ends up permanently mute with no error anywhere. audioInit() is
//      therefore safe to call on every single input event, forever.
//
//   2. Music is scheduled against the AUDIO clock, never the frame clock.
//      requestAnimationFrame jitters by whole milliseconds and drops out
//      entirely in a background tab; a bass line driven from it audibly
//      staggers within about four bars. audioTick() only looks a fraction of a
//      second ahead and hands notes to WebAudio with exact start times, so the
//      groove is sample-accurate even while the renderer is having a bad time.
//
//   3. A sound from the world is heard from WHERE IT IS (0.10.0). Pass sfx() a
//      world position and it is panned toward its side of the screen, fades
//      out over a little more than half a screen past the edge, and from
//      further than that it is not played at all. An enemy that can be heard
//      from anywhere is not a tell; it is a din.
//
// The frame path allocates no JS objects, arrays or closures. It does create
// the WebAudio nodes a note needs, because a WebAudio source is single-use and
// there is no way around that; the voice budget below keeps that bounded.
// ---------------------------------------------------------------------------

var AUD = {
  ctx: null,
  master: null,        // limiter -> destination
  musicBus: null,      // both track buses and the sting bus feed this
  sfxBus: null,
  busA: null, busB: null,   // two music buses, so a switch can cross-fade
  kitA: null, kitB: null,   // what hangs off each: the echo, the drive, two pans
  stingBus: null, kitS: null,   // the victory sting, which outlives musicStop()
  noise: null,         // one second of white noise, built once
  pulse: null,         // a 25% pulse wave, built once (the arpeggio's voice)
  curve: null,         // the boss bass's drive, built once
  vMusic: 0.55,
  vSfx: 0.80,
  last: null,          // per-sound last-played time, for the retrigger guard
  slots: null,         // Float64Array of voice release times
  slotFoe: null,       // Uint8Array: 1 where that voice is an enemy's
  motors: null,        // the drones' engine notes: fixed, always running
  motorLive: false, motorMuted: true, motorStep: 0,
  px: 0,               // the pan audHear() worked out for the sound being placed
  pan: false,          // does this browser have a StereoPanner
  started: false
};

// THE VOICE BUDGET. Twenty one-shot sounds at once, each charged for its REAL
// length (it used to be a flat 0.35 s for everything, so a 1.5 s boss death
// was released at 0.35 and a 40 ms tally tick held a voice nine times longer
// than it sounded). Of the twenty, the enemies may never take the last six:
// a crowd can be loud, but it can never be the reason a throw, a jump or a
// hurt goes missing. And no more than five enemy voices at once, whoever is
// asking. The drones' engine notes are a separate, fixed pool of two.
var AUD_VOICES = 20;
var AUD_RESERVE = 6;
var AUD_FOE_MAX = 5;
var AUD_MOTORS = 2;
var AUD_EAR = 0.6;           // half-screens past the edge a sound still reaches
var AUD_LOOKAHEAD = 0.14;    // seconds of music scheduled ahead of the clock
var AUD_XFADE = 0.45;        // track cross-fade

// --- Init ------------------------------------------------------------------

// Idempotent on purpose. Call it from pointerdown, keydown, touchstart, the
// menu, anywhere — the cost of a repeat call is one string compare.
function audioInit() {
  if (typeof window === 'undefined') return false;
  var Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return false;
  if (!AUD.ctx) audioBuild(new Ctor());

  // Suspended is the normal state on a first load, and again after iOS takes
  // a phone call. resume() is a promise nobody needs to wait on.
  if (AUD.ctx.state !== 'running' && AUD.ctx.resume) AUD.ctx.resume();
  return true;
}

// The whole graph, on whichever context it is given. Split out of audioInit
// so tools/soundcheck.html can build it on an OfflineAudioContext and measure
// every sound as numbers, which is the only way anyone on the grid hears them.
function audioBuild(c) {
  AUD.ctx = c;
  AUD.pan = typeof c.createStereoPanner === 'function';

  // A compressor on the master, not for loudness but because a blast, a
  // death and four letters landing in the same frame will otherwise clip
  // into a click that sounds like a bug in the game.
  AUD.master = c.createDynamicsCompressor();
  AUD.master.threshold.value = -12;
  AUD.master.knee.value = 24;
  AUD.master.ratio.value = 6;
  AUD.master.attack.value = 0.004;
  AUD.master.release.value = 0.18;
  // And after it a safety clipper, because a compressor with a 4 ms attack
  // lets the front of a transient through: measured on 0.10.0's first pass
  // (tools/soundcheck.html, the boss track under eleven loud sounds at once)
  // the output peaked at +2.4 dBFS. The curve is a straight line to -2 dBFS,
  // so everything the game normally makes passes untouched, then bends toward
  // -0.1 dBFS and never reaches full scale. Driven at half level so it has
  // 6 dB of over to bend before it can flatten.
  var guardIn = c.createGain(), guard = c.createWaveShaper(), gc = new Float32Array(2048);
  for (var gi = 0; gi < 2048; gi++) {
    var ga = (gi / 1023.5 - 1) * 2, gm = Math.abs(ga);
    gc[gi] = (ga < 0 ? -1 : 1) * (gm <= 0.8 ? gm : 0.8 + 0.19 * Math.tanh((gm - 0.8) / 0.19));
  }
  guardIn.gain.value = 0.5;
  guard.curve = gc;
  AUD.master.connect(guardIn); guardIn.connect(guard); guard.connect(c.destination);

  AUD.musicBus = c.createGain();
  AUD.musicBus.gain.value = AUD.vMusic;
  AUD.musicBus.connect(AUD.master);

  AUD.sfxBus = c.createGain();
  AUD.sfxBus.gain.value = AUD.vSfx;
  AUD.sfxBus.connect(AUD.master);

  AUD.busA = c.createGain(); AUD.busA.gain.value = 0;
  AUD.busB = c.createGain(); AUD.busB.gain.value = 0;
  AUD.stingBus = c.createGain(); AUD.stingBus.gain.value = 1;
  AUD.busA.connect(AUD.musicBus);
  AUD.busB.connect(AUD.musicBus);
  AUD.stingBus.connect(AUD.musicBus);

  // One shared second of white noise. Every drum, every impact and every
  // hiss in the game is a window onto this buffer through a filter, which
  // is why the file has no per-sound noise generators in it.
  var n = c.sampleRate | 0;
  AUD.noise = c.createBuffer(1, n, c.sampleRate);
  var d = AUD.noise.getChannelData(0);
  for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

  // A quarter-duty pulse: the NES's thinnest voice, and thin is the point —
  // the arpeggio has to sit between the bass and the hook without being
  // either of them.
  var H = 24, re = new Float32Array(H), im = new Float32Array(H);
  for (var h = 1; h < H; h++) {
    re[h] = (2 / (h * Math.PI)) * Math.sin(2 * Math.PI * h * 0.25);
    im[h] = (2 / (h * Math.PI)) * (1 - Math.cos(2 * Math.PI * h * 0.25));
  }
  AUD.pulse = c.createPeriodicWave ? c.createPeriodicWave(re, im) : null;

  // The drive: a soft clip, so the boss bass growls rather than buzzes.
  AUD.curve = new Float32Array(1024);
  for (var s = 0; s < 1024; s++) {
    var x = s / 511.5 - 1;
    AUD.curve[s] = Math.tanh(3 * x) / Math.tanh(3);
  }

  AUD.kitA = audKit(c, AUD.busA);
  AUD.kitB = audKit(c, AUD.busB);
  AUD.kitS = audKit(c, AUD.stingBus);
  Mus.bus = AUD.busA; Mus.kit = AUD.kitA;
  Mus.on = false; Mus.name = ''; Mus.track = null;

  AUD.slots = new Float64Array(AUD_VOICES);
  AUD.slotFoe = new Uint8Array(AUD_VOICES);
  AUD.last = {};
  for (var k in SFX) if (SFX.hasOwnProperty(k)) AUD.last[k] = -10;

  audMotorsBuild(c);
  AUD.motorLive = false; AUD.motorMuted = true;
}

function audioReady() { return !!(AUD.ctx && AUD.ctx.state === 'running'); }

function audioSetVolume(music, sfxVol) {
  if (typeof music === 'number') AUD.vMusic = Math.max(0, Math.min(1, music));
  if (typeof sfxVol === 'number') AUD.vSfx = Math.max(0, Math.min(1, sfxVol));
  if (!AUD.ctx) return;
  var t = AUD.ctx.currentTime;
  AUD.musicBus.gain.setTargetAtTime(AUD.vMusic, t, 0.02);
  AUD.sfxBus.gain.setTargetAtTime(AUD.vSfx, t, 0.02);
}

function audPanNode(c, pan, out) {
  if (!AUD.pan) return out;
  var p = c.createStereoPanner();
  p.pan.value = pan;
  p.connect(out);
  return p;
}

// What hangs off one music bus, built once per bus: a tape echo (delay ->
// lowpass -> feedback), the drive for the boss bass, and a fixed pan either
// side, so the arpeggio and the hook stand a little apart instead of being
// stacked in the middle of a phone speaker.
function audKit(c, out) {
  var k = { out: out, send: null, delay: null, drive: null, left: null, right: null };
  k.delay = c.createDelay(1.0);
  k.delay.delayTime.value = 0.3;
  var fb = c.createGain(), lp = c.createBiquadFilter(), wet = c.createGain();
  fb.gain.value = 0.30;
  lp.type = 'lowpass'; lp.frequency.value = 2600;
  wet.gain.value = 0.55;
  k.send = c.createGain(); k.send.gain.value = 0.32;
  k.send.connect(k.delay); k.delay.connect(lp); lp.connect(fb); fb.connect(k.delay);
  lp.connect(wet); wet.connect(out);

  k.drive = c.createWaveShaper();
  k.drive.curve = AUD.curve;
  k.drive.oversample = '2x';
  var dg = c.createGain(); dg.gain.value = 0.55;
  k.drive.connect(dg); dg.connect(out);

  k.left = audPanNode(c, -0.35, out);
  k.right = audPanNode(c, 0.35, out);
  return k;
}

// --- Voice budget ----------------------------------------------------------
// A fixed table of release times. No array is built, nothing is pushed, and a
// sound that arrives with every slot busy is simply dropped — which is right:
// the twenty-first simultaneous noise was never going to be audible anyway.

function audClaim(t, dur, foe) {
  var free = -1, nFree = 0, nFoe = 0;
  for (var i = 0; i < AUD_VOICES; i++) {
    if (AUD.slots[i] <= t) { nFree++; if (free < 0) free = i; }
    else if (AUD.slotFoe[i]) nFoe++;
  }
  if (free < 0) return false;
  if (foe && (nFree <= AUD_RESERVE || nFoe >= AUD_FOE_MAX)) return false;
  AUD.slots[free] = t + dur;
  AUD.slotFoe[free] = foe ? 1 : 0;
  return true;
}

// --- Where a sound is ------------------------------------------------------
// The camera is the listener. 1 on screen, falling to nothing AUD_EAR
// half-screens past the edge, and the pan follows the side it is on. Read off
// render.js's Cam and view at the moment of the call; without them (the
// headless tools, the sound check) everything is in the middle at full level.

function audHear(x, y) {
  AUD.px = 0;
  if (typeof Cam === 'undefined' || typeof view === 'undefined') return 1;
  var hw = view.w * 0.5, hh = view.h * 0.5;
  var dx = (x - (Cam.x + hw)) / hw, dy = (y - (Cam.y + hh)) / hh;
  var off = Math.max(Math.abs(dx) - 1, Math.abs(dy) - 1, 0);
  if (off >= AUD_EAR) return 0;
  AUD.px = Math.max(-1, Math.min(1, dx)) * 0.7;
  var g = 1 - off / AUD_EAR;
  return g * g;
}

// A sound's own little output: its level for the distance and its pan. Built
// per sound, because the pan is per sound, and released with it.
function audPlace(g) {
  var c = AUD.ctx, gn = c.createGain();
  gn.gain.value = g;
  if (AUD.pan && AUD.px !== 0) {
    var p = c.createStereoPanner();
    p.pan.value = AUD.px;
    gn.connect(p); p.connect(AUD.sfxBus);
  } else gn.connect(AUD.sfxBus);
  return gn;
}

// --- The two primitives ----------------------------------------------------
// Everything below is built from exactly these. An exponential ramp cannot
// reach zero, hence 0.0001 everywhere a sound ends.

function tone(type, f0, f1, dur, vel, t, dest, detune) {
  var c = AUD.ctx;
  var o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0 > 0 ? f0 : 20, t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1 > 0 ? f1 : 20, t + dur);
  if (detune) o.detune.setValueAtTime(detune, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
  return o;
}

function hiss(type, f0, f1, q, dur, vel, t, dest) {
  var c = AUD.ctx;
  var s = c.createBufferSource(), b = c.createBiquadFilter(), g = c.createGain();
  s.buffer = AUD.noise;
  // Start at a random offset or every impact in the game shares one waveform
  // and the repetition becomes audible within a minute of play.
  var off = Math.random() * 0.9;
  b.type = type;
  b.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) b.frequency.exponentialRampToValueAtTime(f1, t + dur);
  b.Q.value = q;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(b); b.connect(g); g.connect(dest);
  s.start(t, off, dur + 0.05); s.stop(t + dur + 0.05);
}

// Equal temperament from a root. Kept as a function rather than a table
// because the tracks transpose and a table would have to be per key.
function hz(root, semi) { return root * Math.pow(2, semi / 12); }

// --- Three voices that are more than a tone ---------------------------------

// A yap: a sawtooth dropping in pitch through a formant, with a breath of
// noise on the front. Two of them a beat apart is a bark.
function audBark(t, f, vel, B) {
  var c = AUD.ctx;
  var o = c.createOscillator(), bp = c.createBiquadFilter(), g = c.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.62, t + 0.075);
  bp.type = 'bandpass'; bp.frequency.setValueAtTime(f * 2.3, t); bp.Q.value = 2.4;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.095);
  o.connect(bp); bp.connect(g); g.connect(B);
  o.start(t); o.stop(t + 0.12);
  hiss('bandpass', f * 3.2, f * 1.6, 2, 0.05, vel * 0.55, t, B);
}

// A pea whistle: a sine with a fast warble in it, which is the pea rattling.
function audWhistle(t, f, dur, vel, B) {
  var c = AUD.ctx;
  var o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f, t);
  lfo.type = 'square'; lfo.frequency.setValueAtTime(34, t);
  lg.gain.setValueAtTime(f * 0.035, t);
  lfo.connect(lg); lg.connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.012);
  g.gain.setValueAtTime(vel, t + dur * 0.75);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(B);
  o.start(t); o.stop(t + dur + 0.02);
  lfo.start(t); lfo.stop(t + dur + 0.02);
}

// A diesel: two saws a hair apart through a low filter, gliding from f0 to f1,
// swelling in and dying away over dur.
function audEngine(t, f0, f1, dur, vel, B) {
  var c = AUD.ctx;
  var a = c.createOscillator(), b = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
  a.type = 'sawtooth'; b.type = 'sawtooth';
  a.frequency.setValueAtTime(f0, t); a.frequency.exponentialRampToValueAtTime(f1, t + dur);
  b.frequency.setValueAtTime(f0 * 1.013, t); b.frequency.exponentialRampToValueAtTime(f1 * 1.013, t + dur);
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(520, t); lp.Q.value = 1.5;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + dur * 0.3);
  g.gain.setValueAtTime(vel, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  a.connect(lp); b.connect(lp); lp.connect(g); g.connect(B);
  a.start(t); a.stop(t + dur + 0.02);
  b.start(t); b.stop(t + dur + 0.02);
}

// --- Sound effects ---------------------------------------------------------
//
// [ retrigger floor, length, enemy ]
//
// The FLOOR is the difference between a game that sounds fast and a game that
// sounds like a fax machine. THROW fires up to five a second with EXPRESS; its
// floor is set under that so a held button still speaks on every shot. For an
// enemy the floor is shared by every one of that kind, which is what stops
// five dogs being five barks.
//
// The LENGTH is what the voice budget charges: the real length, to the 20 ms
// tail every tone() carries.
//
// ENEMY marks an enemy's own voice — its tells. Those obey the reserve and the
// five-at-once limit; everything the player causes does not.

var SFX = {
  // The carrier.
  jump: [0.05, 0.13, 0], doubleJump: [0.05, 0.14, 0], land: [0.07, 0.15, 0],
  wallKick: [0.05, 0.13, 0], step: [0.16, 0.09, 0],
  'throw': [0.05, 0.17, 0], throw2: [0.05, 0.17, 0], throw3: [0.05, 0.17, 0],
  nade: [0.08, 0.18, 0], blast: [0.05, 0.48, 0], mailHit: [0.04, 0.11, 0],
  hurt: [0.12, 0.19, 0], die: [0.30, 0.75, 0],
  // What he picks up.
  itemGet: [0.06, 0.25, 0], oneUp: [0.30, 0.54, 0], checkpoint: [0.30, 0.60, 0],
  getThick: [0.06, 0.41, 0], getExpress: [0.06, 0.34, 0], getRye: [0.06, 0.52, 0],
  getGummy: [0.06, 0.30, 0], getPackage: [0.06, 0.32, 0],
  // What he hits.
  foeHit: [0.04, 0.12, 0], foeDie: [0.05, 0.26, 0], bossHit: [0.06, 0.13, 0],
  lidBlock: [0.06, 0.21, 0], boxEat: [0.08, 0.15, 0],
  blockHit: [0.04, 0.11, 0], blockBreak: [0.05, 0.28, 0],
  // The enemies' own voices.
  dogBark: [0.35, 0.26, 1], dogSnap: [0.30, 0.24, 1],
  droneLock: [0.15, 0.22, 1], droneDive: [0.20, 0.58, 1],
  gnomeWake: [0.15, 0.42, 1], gnomeGo: [0.10, 0.11, 1], gnomeHop: [0.25, 0.11, 1],
  pandaLid: [0.20, 0.33, 1], pandaChitter: [0.40, 0.24, 1],
  boxChomp: [0.12, 0.11, 1], boxWindup: [0.20, 0.36, 1], boxSpit: [0.08, 0.17, 1],
  boxRise: [0.20, 0.27, 1],
  bossThrow: [0.30, 0.24, 1], bossWhistle: [0.50, 0.52, 1],
  bossBomb: [0.18, 0.23, 1], bombLand: [0.12, 0.22, 1],
  // The Postmaster's big moments, the truck, the clock, the menus.
  gateSlam: [0.50, 0.85, 0], bossPhase: [0.40, 0.83, 0], bossDie: [0.50, 1.53, 0],
  truckIn: [0.50, 1.24, 0], truckDoor: [0.20, 0.48, 0], truckOut: [0.50, 1.61, 0],
  clockLow: [0.40, 0.23, 0], menu: [0.05, 0.08, 0], start: [0.30, 0.35, 0],
  tallyTick: [0.02, 0.04, 0], tallyRow: [0.10, 0.09, 0], tallyGrade: [0.40, 0.55, 0]
};

// x, y: where in the WORLD it happened, for anything that happens somewhere
// (rule 3 at the top). Leave them off for the carrier's own sounds and the
// menus, which are always in the middle at full level. Returns whether it
// played, for the tools; the game never needs to know.
function sfx(name, x, y) {
  if (!audioReady()) return false;
  var spec = SFX[name];
  if (spec === undefined) return false;
  var t = AUD.ctx.currentTime + 0.001;
  if (t - AUD.last[name] < spec[0]) return false;
  var placed = x !== undefined && x !== null, vol = 1;
  AUD.px = 0;
  // Too far away to hear: nothing is built, and the floor is not spent, so
  // the dog that IS on screen still gets to bark.
  if (placed) { vol = audHear(x, y); if (vol <= 0.001) return false; }
  if (!audClaim(t, spec[1], spec[2])) return false;
  AUD.last[name] = t;

  var B = placed ? audPlace(vol) : AUD.sfxBus;
  var r, i;   // scratch for the per-sound random and the odd loop, declared once

  switch (name) {

    // --- Movement. Short, soft, and pitched high enough to sit above the
    // music without ever being the loudest thing on screen.
    case 'jump':
      tone('square', 330, 620, 0.10, 0.20, t, B);
      tone('sine', 660, 1240, 0.08, 0.10, t, B);
      break;
    case 'doubleJump':
      // Deliberately the same shape a fifth up, so it reads as "again, higher"
      // rather than as a different action.
      tone('square', 495, 950, 0.11, 0.20, t, B);
      tone('triangle', 990, 1900, 0.09, 0.11, t, B);
      break;
    case 'land':
      hiss('lowpass', 900, 280, 1, 0.09, 0.26, t, B);
      tone('sine', 150, 70, 0.07, 0.16, t, B);
      break;
    case 'wallKick':
      // A scrape then a shove: the scrape is what tells you the wall was there.
      hiss('bandpass', 2600, 900, 3, 0.07, 0.20, t, B);
      tone('square', 260, 520, 0.09, 0.17, t, B);
      break;
    case 'step':
      hiss('bandpass', 1500 + Math.random() * 400, 700, 2, 0.035, 0.085, t, B);
      break;

    // --- The envelope weapon, one sound per tier (Evrtek, 2026-10-17: "There's
    // no throw sound"). The most-heard sound in the game, so it is short and
    // it never lands on the same pitch twice — but it has to be HEARD, and
    // the 0.8.0 one was a 45 ms hiss under a 50 ms blip, sitting in the same
    // band as the hook. This is a swish of air swept downward, which is the
    // shape of a thing leaving your hand, with a pitched flick on its front so
    // the ear gets an onset. The second and third tiers add a second and third
    // envelope a few milliseconds apart, so a fan SOUNDS like more paper.
    // EXPRESS lifts all of it a step.
    case 'throw':
    case 'throw2':
    case 'throw3':
      r = (0.95 + Math.random() * 0.10) * ((typeof P !== 'undefined' && P.pwExpress) ? 1.12 : 1);
      hiss('bandpass', 4200 * r, 1300 * r, 1.3, 0.11, 0.46, t, B);
      tone('triangle', 1250 * r, 620 * r, 0.07, 0.30, t, B);
      if (name !== 'throw') {
        hiss('bandpass', 5200 * r, 1800 * r, 1.8, 0.10, 0.20, t + 0.016, B);
        tone('triangle', 1580 * r, 820 * r, 0.06, 0.14, t + 0.016, B);
      }
      if (name === 'throw3') {
        hiss('highpass', 5600, 7600, 1, 0.06, 0.12, t + 0.032, B);
        tone('square', 2350 * r, 1250 * r, 0.05, 0.06, t + 0.032, B);
      }
      break;
    case 'nade':
      tone('sawtooth', 200, 440, 0.13, 0.16, t, B);
      hiss('bandpass', 700, 1800, 2, 0.12, 0.12, t, B);
      break;
    case 'blast':
      hiss('lowpass', 1800, 90, 1, 0.42, 0.62, t, B);
      tone('sine', 120, 34, 0.34, 0.50, t, B);
      tone('sawtooth', 80, 30, 0.20, 0.18, t, B);
      break;
    case 'mailHit':
      // A letter against a wall: dull paper, never metal — metal is the lid.
      hiss('bandpass', 1800, 900, 2.5, 0.05, 0.34, t, B);
      break;

    // --- Damage.
    case 'hurt':
      tone('sawtooth', 420, 150, 0.16, 0.34, t, B);
      hiss('bandpass', 1200, 400, 1, 0.10, 0.18, t, B);
      break;
    case 'die':
      // Four falling steps rather than one slide: a slide reads as a machine
      // winding down, steps read as a character losing.
      tone('square', 520, 500, 0.10, 0.28, t, B);
      tone('square', 390, 380, 0.10, 0.28, t + 0.10, B);
      tone('square', 300, 290, 0.10, 0.28, t + 0.20, B);
      tone('square', 200, 60, 0.42, 0.30, t + 0.30, B);
      break;

    // --- Pickups. All of them are arpeggios UP, because up is "good"; each
    // kind has its own colour on top so the ear knows which one it was before
    // the eye reads the HUD.
    case 'itemGet':
      tone('triangle', 880, 880, 0.06, 0.24, t, B);
      tone('triangle', 1175, 1175, 0.06, 0.24, t + 0.055, B);
      tone('triangle', 1568, 1568, 0.11, 0.24, t + 0.110, B);
      break;
    case 'getThick':
      // Thick mail: the riffle of a fat envelope, then a climb whose top note
      // is an octave higher once the third tier is reached.
      i = (typeof P !== 'undefined' && P.mailTier >= 3) ? 1760 : 1319;
      hiss('bandpass', 2400, 5200, 2, 0.14, 0.14, t, B);
      tone('square', 659, 659, 0.07, 0.17, t, B);
      tone('square', 880, 880, 0.07, 0.17, t + 0.06, B);
      tone('square', 1109, 1109, 0.07, 0.17, t + 0.12, B);
      tone('square', i, i, 0.20, 0.18, t + 0.18, B);
      break;
    case 'oneUp':
      // The mail bag, which is a life.
      tone('square', 784, 784, 0.09, 0.22, t, B);
      tone('square', 988, 988, 0.09, 0.22, t + 0.09, B);
      tone('square', 1175, 1175, 0.09, 0.22, t + 0.18, B);
      tone('square', 1568, 1568, 0.24, 0.24, t + 0.27, B);
      break;
    case 'getExpress':
      // Express: a zip straight up and a bell at the top. Speed.
      tone('square', 500, 2600, 0.16, 0.15, t, B);
      tone('triangle', 1000, 5200, 0.16, 0.07, t, B);
      hiss('highpass', 4000, 8000, 1, 0.12, 0.07, t, B);
      tone('triangle', 2093, 2093, 0.16, 0.20, t + 0.15, B);
      break;
    case 'getRye':
      // Rye & ginger: the fizz of a poured drink, then a warm major chord
      // swelling under it — the five seconds nothing can touch you.
      hiss('highpass', 5500, 7000, 1, 0.34, 0.05, t, B);
      for (i = 0; i < 6; i++)
        tone('sine', 1400 + Math.random() * 1800, 0, 0.03, 0.09, t + i * 0.045, B);
      tone('triangle', 440, 440, 0.44, 0.13, t + 0.05, B);
      tone('triangle', 554, 554, 0.44, 0.12, t + 0.05, B);
      tone('triangle', 659, 659, 0.44, 0.12, t + 0.05, B);
      break;
    case 'getGummy':
      // Gummy worms: a boing. Health should sound soft.
      tone('sine', 260, 620, 0.09, 0.30, t, B);
      tone('sine', 620, 420, 0.18, 0.24, t + 0.09, B);
      tone('triangle', 1240, 1240, 0.10, 0.10, t + 0.09, B);
      break;
    case 'getPackage':
      // A package: cardboard landing in the bag, then a two-note chime.
      hiss('lowpass', 600, 150, 1, 0.10, 0.34, t, B);
      tone('sine', 140, 80, 0.10, 0.30, t, B);
      tone('triangle', 784, 784, 0.08, 0.20, t + 0.06, B);
      tone('triangle', 1175, 1175, 0.16, 0.20, t + 0.13, B);
      break;
    case 'checkpoint':
      // The mailbox flag going up. A two-note fanfare and a metallic ring, so
      // it is heard over whatever the player was doing at the time.
      tone('triangle', 587, 587, 0.12, 0.26, t, B);
      tone('triangle', 880, 880, 0.30, 0.26, t + 0.12, B);
      tone('sine', 1760, 1740, 0.45, 0.09, t + 0.12, B);
      hiss('highpass', 3000, 5000, 1, 0.08, 0.10, t, B);
      break;

    // --- Things being hit.
    case 'foeHit':
      r = 0.94 + Math.random() * 0.12;
      tone('square', 300 * r, 180 * r, 0.07, 0.24, t, B);
      hiss('bandpass', 1600, 700, 2, 0.06, 0.18, t, B);
      break;
    case 'foeDie':
      tone('sawtooth', 340, 90, 0.20, 0.28, t, B);
      hiss('lowpass', 1400, 260, 1, 0.20, 0.26, t, B);
      break;
    case 'bossHit':
      // The Postmaster takes a letter: a grunt an octave under a dog's yelp,
      // so a hit on him never sounds like a hit on what he summoned.
      r = 0.94 + Math.random() * 0.12;
      tone('square', 180 * r, 110 * r, 0.09, 0.26, t, B);
      tone('sawtooth', 90 * r, 60 * r, 0.10, 0.20, t, B);
      hiss('bandpass', 1200, 500, 2, 0.06, 0.16, t, B);
      break;
    case 'lidBlock':
      // A letter off the trash panda's lid: a bright metal TINK. It is the
      // whole lesson of the enemy — that hit did nothing, get behind it.
      tone('triangle', 1870, 1840, 0.18, 0.18, t, B);
      tone('sine', 2960, 2900, 0.12, 0.08, t, B);
      hiss('bandpass', 4200, 2500, 5, 0.04, 0.18, t, B);
      break;

    // --- Breakable blocks. Three hits then a break, so the hit must be dry
    // and the break must plainly be the end of it.
    case 'blockHit':
      r = 0.92 + Math.random() * 0.16;
      tone('square', 220 * r, 160 * r, 0.05, 0.22, t, B);
      hiss('bandpass', 1100 * r, 600, 3, 0.05, 0.20, t, B);
      break;
    case 'blockBreak':
      hiss('bandpass', 2400, 500, 1, 0.22, 0.34, t, B);
      hiss('lowpass', 800, 160, 1, 0.16, 0.26, t, B);
      tone('square', 180, 70, 0.14, 0.20, t, B);
      break;

    // --- The dog. A bark when it NOTICES you (and again every few seconds
    // while it chases), a snarl and a snap when it leaps from close enough to
    // land on you. The snap is the tell: hear it and jump.
    case 'dogBark':
      r = 0.92 + Math.random() * 0.16;
      audBark(t, 520 * r, 0.30, B);
      audBark(t + 0.13, 470 * r, 0.26, B);
      break;
    case 'dogSnap':
      r = 0.94 + Math.random() * 0.12;
      tone('sawtooth', 140 * r, 120 * r, 0.15, 0.13, t, B);
      tone('sawtooth', 147 * r, 126 * r, 0.15, 0.13, t, B);     // the two beat: rrrr
      hiss('highpass', 2500, 4000, 1, 0.03, 0.18, t + 0.15, B);
      tone('square', 900 * r, 400 * r, 0.03, 0.14, t + 0.15, B);
      break;

    // --- The drone. Its engine note is continuous (the motors, below); these
    // are its two moments. LOCK is a targeting chirp, two beeps rising, on
    // the beat it holds still before it commits — that beat exists so the
    // player can move, and now it can be heard as well as seen. DIVE is a
    // falling whine.
    case 'droneLock':
      tone('square', 1320, 1760, 0.06, 0.12, t, B);
      tone('square', 1760, 2350, 0.08, 0.14, t + 0.11, B);
      break;
    case 'droneDive':
      tone('sawtooth', 1500, 420, 0.55, 0.11, t, B);
      hiss('bandpass', 3000, 900, 3, 0.50, 0.10, t, B);
      break;

    // --- The gnome. The statue waking is stone grinding on stone with a crack
    // on the front of it; then, when it sets off, a cheeky "hup!".
    case 'gnomeWake':
      hiss('highpass', 2200, 3000, 1, 0.04, 0.22, t, B);
      hiss('lowpass', 500, 220, 3, 0.36, 0.30, t, B);
      tone('sawtooth', 70, 95, 0.34, 0.16, t, B);
      tone('square', 47, 52, 0.30, 0.10, t, B);
      break;
    case 'gnomeGo':
      tone('triangle', 520, 880, 0.08, 0.22, t, B);
      tone('square', 1040, 1760, 0.05, 0.06, t, B);
      break;
    case 'gnomeHop':
      tone('sine', 400, 760, 0.08, 0.16, t, B);
      break;

    // --- The trash panda. The lid coming off the bin is a clank of metal with
    // no pitch it agrees with (three partials that are not a chord); the bash
    // is a chitter, five squeaks, on the moment it lunges.
    case 'pandaLid':
      tone('triangle', 620, 600, 0.30, 0.16, t, B);
      tone('triangle', 1533, 1500, 0.22, 0.10, t, B);
      tone('sine', 2210, 2180, 0.18, 0.07, t, B);
      hiss('bandpass', 3500, 2000, 4, 0.08, 0.20, t, B);
      break;
    case 'pandaChitter':
      for (i = 0; i < 5; i++) {
        r = 1700 + Math.random() * 600;
        tone('square', r, r * 1.15, 0.03, 0.10, t + i * 0.045, B);
      }
      break;

    // --- The mailbox bot, whose whole design is a window you open yourself.
    // EAT (it swallowed your letter, the mouth is open), CHOMP while it chews
    // (keep hitting it), WINDUP a third of a second before the spit (get out
    // of the way), SPIT. Read in order, the four are its whole timing.
    case 'boxEat':
      tone('sine', 300, 120, 0.11, 0.26, t, B);
      hiss('lowpass', 700, 200, 1, 0.09, 0.14, t, B);
      break;
    case 'boxChomp':
      hiss('lowpass', 900, 300, 2, 0.05, 0.20, t, B);
      tone('square', 180, 120, 0.05, 0.10, t, B);
      break;
    case 'boxWindup':
      tone('sawtooth', 110, 380, 0.30, 0.18, t, B);
      hiss('bandpass', 600, 1800, 3, 0.30, 0.12, t, B);
      break;
    case 'boxSpit':
      tone('sawtooth', 160, 520, 0.14, 0.28, t, B);
      hiss('highpass', 900, 2600, 1, 0.10, 0.16, t, B);
      break;
    case 'boxRise':
      // One of the Postmaster's bombs standing up as a bot.
      tone('square', 140, 300, 0.12, 0.18, t, B);
      hiss('bandpass', 1500, 900, 2, 0.10, 0.20, t, B);
      tone('triangle', 600, 600, 0.12, 0.12, t + 0.12, B);
      break;

    // --- The Postmaster.
    case 'gateSlam':
      // The arena door coming down behind you. It has been "the loudest sound
      // in the level" in a comment since 0.8.0 and silent in the game.
      hiss('lowpass', 2200, 80, 1, 0.70, 0.62, t, B);
      tone('sine', 70, 34, 0.60, 0.60, t, B);
      tone('square', 110, 55, 0.18, 0.26, t, B);
      hiss('bandpass', 3000, 1200, 3, 0.10, 0.30, t, B);
      tone('triangle', 233, 230, 0.80, 0.10, t + 0.02, B);
      break;
    case 'bossThrow':
      // His fan of three: a heavy whoomp of arm, then three flicks.
      hiss('bandpass', 2200, 700, 1.2, 0.18, 0.30, t, B);
      tone('sawtooth', 240, 120, 0.14, 0.18, t, B);
      for (i = 0; i < 3; i++)
        tone('triangle', 1000 - i * 120, 600 - i * 80, 0.05, 0.12, t + 0.03 + i * 0.035, B);
      break;
    case 'bossWhistle':
      // Phase two calls a dog. A postman's whistle: two blasts, the second
      // higher — and the dog it calls comes in already barking at you.
      audWhistle(t, 2100, 0.16, 0.09, B);
      audWhistle(t + 0.19, 2650, 0.30, 0.10, B);
      break;
    case 'bossBomb':
      // Phase three drops two a second, so this is short and it sits low in
      // the mix: a little falling whistle that says "from above".
      tone('sine', 1800, 900, 0.20, 0.08, t, B);
      hiss('highpass', 3000, 2000, 1, 0.05, 0.08, t, B);
      break;
    case 'bombLand':
      hiss('lowpass', 900, 120, 1, 0.16, 0.30, t, B);
      tone('sine', 110, 45, 0.16, 0.30, t, B);
      break;
    case 'bossPhase':
      // Two low fifths a beat apart. It has to be heard through the boss track
      // without being a sound effect version of it.
      tone('sawtooth', 110, 110, 0.36, 0.30, t, B);
      tone('sawtooth', 165, 165, 0.36, 0.22, t, B);
      tone('sawtooth', 87, 87, 0.50, 0.30, t + 0.30, B);
      tone('sawtooth', 131, 131, 0.50, 0.22, t + 0.30, B);
      hiss('lowpass', 2000, 300, 1, 0.30, 0.20, t, B);
      break;
    case 'bossDie':
      hiss('lowpass', 2400, 70, 1, 1.10, 0.60, t, B);
      tone('sawtooth', 220, 28, 1.00, 0.34, t, B);
      tone('sawtooth', 110, 26, 1.20, 0.30, t + 0.10, B);
      tone('sine', 55, 22, 1.30, 0.40, t + 0.20, B);
      break;

    // --- The mail truck: it arrives (an engine winding down to idle, and the
    // air brake), the door slides, and at the end it pulls away. Timed off
    // the same TUNE numbers stage.js drives it with.
    case 'truckIn':
      r = (typeof TUNE !== 'undefined' && TUNE.truckDrive > 0) ? TUNE.truckDrive : 1.15;
      audEngine(t, 110, 52, r, 0.14, B);
      hiss('highpass', 3200, 2400, 1, 0.24, 0.10, t + r * 0.82, B);   // the air brake
      tone('sine', 2600, 2480, 0.22, 0.025, t + r * 0.80, B);
      break;
    case 'truckDoor':
      hiss('bandpass', 1200, 600, 2, 0.32, 0.12, t, B);
      tone('square', 160, 120, 0.06, 0.18, t + 0.34, B);
      hiss('lowpass', 800, 200, 1, 0.08, 0.22, t + 0.34, B);
      break;
    case 'truckOut':
      tone('square', 160, 120, 0.06, 0.18, t, B);                      // the door shuts
      hiss('lowpass', 800, 200, 1, 0.08, 0.22, t, B);
      audEngine(t + 0.08, 55, 140, 1.50, 0.14, B);
      break;

    // --- The clock, the menus, the title.
    case 'clockLow':
      // Deliberately unmusical against both tracks: it is a warning, and a
      // warning that harmonises gets ignored.
      tone('square', 1320, 1320, 0.07, 0.20, t, B);
      tone('square', 1320, 1320, 0.07, 0.20, t + 0.13, B);
      break;
    case 'menu':
      tone('triangle', 620, 760, 0.05, 0.16, t, B);
      break;
    case 'start':
      // PLAYER 1 - START, pressed: three notes up, the coin-in chirp.
      tone('square', 523, 523, 0.06, 0.16, t, B);
      tone('square', 784, 784, 0.06, 0.16, t + 0.07, B);
      tone('square', 1047, 1047, 0.18, 0.18, t + 0.14, B);
      hiss('highpass', 4000, 6000, 1, 0.10, 0.05, t + 0.14, B);
      break;

    // --- The tally. The ticker runs for about twenty frames a row and has to
    // survive being heard a hundred times in five seconds, so it is as short
    // and as quiet as a sound can be and still be there. Tiny pitch jitter so
    // a run of them reads as a counter rather than as a buzz.
    case 'tallyTick':
      r = 0.94 + Math.random() * 0.12;
      tone('square', 1500 * r, 1500 * r, 0.018, 0.045, t, B);
      break;
    case 'tallyRow':
      // A row finishing. One step up from the ticker, so the ear gets a full
      // stop at the end of each line.
      tone('triangle', 880, 1320, 0.06, 0.16, t, B);
      break;
    case 'tallyGrade':
      // The grade landing: the only fanfare on the screen.
      tone('triangle', 587, 587, 0.10, 0.22, t, B);
      tone('triangle', 784, 784, 0.10, 0.22, t + 0.09, B);
      tone('triangle', 1175, 1175, 0.34, 0.24, t + 0.18, B);
      hiss('highpass', 3200, 5200, 1, 0.09, 0.09, t + 0.18, B);
      break;
  }
  return true;
}

// --- The drones' engines ----------------------------------------------------
//
// A drone is the one enemy that is a THREAT while it is off screen — it hovers
// above you, out of the frame, and then it is on you. So it is the one enemy
// with a continuous voice: a buzzing engine note, panned to where it is,
// fading out past the edge of hearing like everything else. It revs up on the
// lock and screams on the dive, so you can hear it commit.
//
// Continuous voices cannot be one-shots, so these are a fixed pool, built once
// with the graph and running for ever at zero volume until a drone is near.
// Nothing is allocated to drive them; the frame path only moves their dials.

function audMotorsBuild(c) {
  AUD.motors = [];
  for (var i = 0; i < AUD_MOTORS; i++) {
    var m = { a: c.createOscillator(), b: c.createOscillator(), lp: c.createBiquadFilter(),
              am: c.createGain(), lfo: c.createOscillator(), lfoG: c.createGain(),
              vol: c.createGain(), pan: null };
    m.a.type = 'sawtooth'; m.b.type = 'square';
    m.a.frequency.value = 150; m.b.frequency.value = 226;
    m.lp.type = 'lowpass'; m.lp.frequency.value = 1900; m.lp.Q.value = 2;
    // The rotor flutter: an LFO on a gain that sits at 0.7 and swings 0.3
    // either side of it. On its own gain, never the volume's, so a silent
    // motor is truly silent rather than fluttering at plus or minus 0.3.
    m.am.gain.value = 0.7;
    m.lfo.type = 'sine'; m.lfo.frequency.value = 23;
    m.lfoG.gain.value = 0.3;
    m.vol.gain.value = 0;
    m.a.connect(m.lp); m.b.connect(m.lp); m.lp.connect(m.am); m.am.connect(m.vol);
    m.lfo.connect(m.lfoG); m.lfoG.connect(m.am.gain);
    if (AUD.pan) { m.pan = c.createStereoPanner(); m.vol.connect(m.pan); m.pan.connect(AUD.sfxBus); }
    else m.vol.connect(AUD.sfxBus);
    m.a.start(); m.b.start(); m.lfo.start();
    AUD.motors.push(m);
  }
}

function audMotorSet(m, f, g, t) {
  var f0 = 150, lvl = 0;
  if (f) {
    // s0: 0 hovering, 3 locked on, 1 diving, 2 climbing back (enemy.js).
    f0 = f.s0 === 3 ? 270 : f.s0 === 1 ? 340 : f.s0 === 2 ? 205 : 150 + Math.sin(f.t1 * 2.1) * 8;
    lvl = (f.s0 === 0 ? 0.030 : 0.050) * g;
    if (m.pan) m.pan.pan.setTargetAtTime(AUD.px, t, 0.05);
  }
  m.a.frequency.setTargetAtTime(f0, t, 0.05);
  m.b.frequency.setTargetAtTime(f0 * 1.505, t, 0.05);
  m.vol.gain.setTargetAtTime(lvl, t, 0.06);
}

// Once per simulation step, after the enemies have moved. The first two drones
// that can be heard, in pool order — which is stable, so an engine note does
// not hop from one drone to another while both are in view.
function audioFromWorld() {
  AUD.motorLive = true;
  if (!audioReady() || !AUD.motors || typeof Foes === 'undefined') return;
  if ((++AUD.motorStep & 1) !== 0) return;      // 30 Hz is plenty for an engine
  var t = AUD.ctx.currentTime, used = 0;
  for (var i = 0; i < Foes.n && used < AUD_MOTORS; i++) {
    var f = Foes.a[i];
    if (!f.alive || f.kind !== FOE_DRONE) continue;
    var g = audHear(f.x + f.w * 0.5, f.y + f.h * 0.5);
    if (g <= 0) continue;
    audMotorSet(AUD.motors[used++], f, g, t);
  }
  for (; used < AUD_MOTORS; used++) audMotorSet(AUD.motors[used], null, 0, t);
}

// --- Music -----------------------------------------------------------------
//
// Every track is DATA: SECTIONS of patterns, played in order, with a bar to
// loop back to. A pattern is an array of semitone offsets from the track's
// root, read modulo its own length from the start of its section, with
// MUS_REST for a rest — so parts of different lengths still drift against
// each other for free, and a section can reuse another's arrays without
// writing a note twice.
//
// 0.10.0 (Evrtek, 2026-10-17: "we should revisit the music and see if we can
// spruce it up. There should also be boss music when you get to the boss
// fight"). The level track kept its hook and its bass line, which were his,
// and grew round them: a chord pad, a pulse arpeggio, a tape echo, a second
// half with its own melody over its own chords, a breakdown and drum fills.
// It loops every 18 bars, about 28 seconds, where it used to loop every 4.
// The title screen got a track of its own; the boss's was always there and
// always started at the gate, and now opens with a hit.
//
// Nothing here knows a note name. Change a root and the whole track moves.

var MUS_REST = -99;

// The tables are built inside one function so that their names, and the R
// that spells a rest in them, are not globals every other script can trip on.
var MUSIC = (function () {
var R = MUS_REST;

// --- Haines Avenue (the level). A Dorian, 152 bpm, straight sixteenths. ---

// "Groovy but certainly a higher level of urgency since the game is fast
// paced." A Dorian: minor enough to have somewhere to go, with the major sixth
// that stops it sounding like a funeral. The bass never rests for a whole beat
// and the hook walks rather than jumps, so it can actually be hummed.
var LV_BASS = [
  0, R, 0, R, 0, R, 12, R,   7, R, 7, R, 10, R, 7, 5,
  3, R, 3, R, 3, R, 15, R,   5, R, 5, R, 7, R, 10, 12
];
var LV_LEAD = [
  0, R, R, 3, R, 5, R, R,   7, R, 5, R, 3, R, R, R,
  2, R, R, 5, R, 7, R, R,   9, R, 7, R, 5, R, R, R,
  12, R, R, 10, R, 9, R, R, 7, R, 5, R, 3, R, R, R,
  5, R, 7, R, 9, R, 10, R,  12, R, R, R, R, R, R, R
];
// Offbeat stabs, three notes wide. This is the "groovy" instruction: the chord
// never lands on the beat the kick is on.
var LV_STAB = [R, R, R, R, 12, R, R, R, R, R, 15, R, R, R, R, R];
// The chords the bass line was always implying, now played: Am, Em, C, D, half
// a bar each. Three semitones per chord, from the pad's root (A3).
var LV_CH_A = [0, 3, 7, 7, 10, 14, 3, 7, 10, 5, 9, 12];
var LV_CH_I = [0, 3, 7];
// The second half: G, D, Am, Am — the seventh and the fourth of the mode,
// a bar each, the lift before the hook comes home.
var LV_CH_B = [-2, 2, 5, 5, 9, 12, 0, 3, 7, 0, 3, 7];
var LV_BASS_B = [
  -2, R, -2, R, 10, R, -2, R,  -2, R, 10, R, 9, R, 10, R,
  5, R, 5, R, 17, R, 5, R,     5, R, 17, R, 12, R, 17, R,
  0, R, 0, R, 12, R, 0, R,     0, R, 12, R, 10, R, 12, R,
  0, R, 0, R, 12, R, 0, R,     3, R, 5, R, 7, R, 10, R
];
var LV_LEAD_B = [
  14, R, 12, R, 10, R, R, 7,   R, 10, R, 12, 14, R, R, R,
  17, R, 14, R, 12, R, R, 9,   R, 12, R, 14, 12, R, R, R,
  12, R, R, 10, R, 12, R, 15,  R, 14, R, 12, R, 10, R, 7,
  9, R, R, R, 7, R, R, R,      5, R, 7, R, 9, R, 10, R
];
// The arpeggio, as chord-tone numbers: 0 1 2 the chord, 3 4 5 the same an
// octave up, -1 a rest. Root, fifth, octave, fifth, tenth, fifth, octave, third.
var LV_ARP = [0, 2, 3, 2, 4, 2, 3, 1];
var LV_KICK = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0];
var LV_KICK4 = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
var LV_SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1];
var LV_SNARE_B = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
var LV_HAT = [0.50, 0.22, 0.34, 0.22, 0.46, 0.22, 0.34, 0.46,
              0.50, 0.22, 0.34, 0.22, 0.46, 0.34, 0.50, 0.26];
var LV_HAT2 = [0.50, 0.26, 0.40, 0.26, 0.46, 0.26, 0.40, 0.30,
               0.50, 0.26, 0.40, 0.26, 0.46, 0.30, 0.50, 0.34];
var LV_HATQ = [0.40, 0, 0, 0, 0.30, 0, 0, 0, 0.40, 0, 0, 0, 0.30, 0, 0.20, 0];
var LV_OHAT = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0];
// Fills: the last bar of a section, in place of its drums.
var LV_FILL = { kick: LV_KICK, hat: LV_HAT,
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0.6, 0, 0.7, 0.8, 0.9, 1],
  tom:   [0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 2, 0, 0, 1, 0] };
var LV_FILL_IN = { kick: LV_KICK4, hat: LV_HAT,
  snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.6, 0.8, 1] };
var LV_FILL_BRK = { kick: LV_KICK4, hat: LV_HATQ,
  snare: [0, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 0, 0.6, 0, 0.7, 0.8, 0.9, 1],
  tom:   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 2, 1] };

var LV_INTRO = { bars: 2, bass: LV_BASS, chords: LV_CH_I, chordSteps: 32, pad: true,
                 hat: LV_HATQ, fill: LV_FILL_IN };
var LV_A = { bars: 4, bass: LV_BASS, lead: LV_LEAD, stab: LV_STAB, chords: LV_CH_A, chordSteps: 8,
             pad: true, kick: LV_KICK, snare: LV_SNARE, hat: LV_HAT, crash: 1 };
var LV_A2 = { bars: 4, bass: LV_BASS, lead: LV_LEAD, stab: LV_STAB, chords: LV_CH_A, chordSteps: 8,
              pad: true, arp: LV_ARP, kick: LV_KICK, snare: LV_SNARE, hat: LV_HAT2, ohat: LV_OHAT,
              crash: 1, fill: LV_FILL };
var LV_B = { bars: 4, bass: LV_BASS_B, lead: LV_LEAD_B, chords: LV_CH_B, chordSteps: 16,
             pad: true, arp: LV_ARP, kick: LV_KICK4, snare: LV_SNARE_B, hat: LV_HAT2, ohat: LV_OHAT,
             crash: 1, fill: LV_FILL };
var LV_BRK = { bars: 2, bass: LV_BASS, chords: LV_CH_A, chordSteps: 8, pad: true, arp: LV_ARP,
               hat: LV_HATQ, fill: LV_FILL_BRK };

// --- The title: dusk on the avenue. The same hook, slower, on a softer voice.

var TT_CH = [0, 3, 7, 5, 9, 12, 3, 7, 10, 5, 9, 12];     // Am, D, C, D — a bar each
var TT_BASS = [
  0, R, R, R, R, R, R, R,  0, R, R, R, 7, R, R, R,
  5, R, R, R, R, R, R, R,  5, R, R, R, 12, R, R, R,
  3, R, R, R, R, R, R, R,  3, R, R, R, 10, R, R, R,
  5, R, R, R, R, R, R, R,  5, R, R, R, 9, R, 7, R
];
var TT_KICK = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
var TT_SNARE = [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
var TT_HAT = [0.30, 0, 0.14, 0, 0.26, 0, 0.14, 0.08, 0.30, 0, 0.14, 0, 0.26, 0, 0.14, 0.10];
var TT_A = { bars: 4, bass: TT_BASS, lead: LV_LEAD, chords: TT_CH, chordSteps: 16, pad: true,
             hat: TT_HAT };
var TT_B = { bars: 4, bass: TT_BASS, lead: LV_LEAD, up: 12, chords: TT_CH, chordSteps: 16,
             pad: true, arp: LV_ARP, kick: TT_KICK, snare: TT_SNARE, hat: TT_HAT, crash: 1 };

// --- The Postmaster. ---------------------------------------------------------
// "Distinct and boss like." Everything changes at once so the switch is
// unmistakable in the first half second: the key drops to E flat Phrygian (the
// flat second is the single darkest interval available without leaving a
// scale), the grid goes from straight sixteenths to eighth-note TRIPLETS, the
// tempo drops while the sound gets heavier — the bass through a drive, the
// hook on a sawtooth — and it OPENS with a hit, a bar of impact and cluster
// on the same frame the gate slams. Then two halves, the second higher and
// four-on-the-floor.

var BS_BASS = [
  0, R, 0, 0, R, R, 1, R, R, 0, R, R,
  0, R, 0, 0, R, R, -2, R, R, 1, R, 0
];
var BS_LEAD = [
  12, R, R, 13, R, R, 12, R, R, R, R, R,
  10, R, R, 12, R, R, 8, R, R, 7, R, R,
  12, R, R, 13, R, R, 15, R, R, 13, R, R,
  12, R, R, 11, R, R, 12, R, R, R, R, R
];
var BS_STAB = [R, R, R, R, R, R, 1, R, R, R, R, R];
var BS_CH_HIT = [0, 1, 6];                                // Eb, E, A: not a chord, a threat
var BS_CH_A = [0, 3, 7, 0, 3, 7, 1, 5, 8, 0, 3, 7];       // Ebm Ebm E Ebm, a bar each
var BS_CH_B = [0, 3, 7, 0, 3, 7, -2, 2, 5, 1, 5, 8];      // Ebm Ebm Db E
var BS_BASS_B = [
  0, 0, 12, 0, 0, 12, 0, 0, 13, 0, 0, 12,
  1, 1, 13, 1, 1, 13, 0, 0, 12, -2, -2, 10
];
var BS_LEAD_B = [
  15, R, 13, 12, R, R, 13, R, 12, 10, R, R,
  8, R, 10, 12, R, R, 10, R, 8, 7, R, R,
  15, R, 13, 12, R, 13, 15, R, R, 13, R, R,
  12, R, R, 13, R, R, 12, R, 10, 12, R, R
];
var BS_KICK = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0];
var BS_KICK_B = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0];
var BS_SNARE = [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
var BS_SNARE_B = [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0.5];
var BS_HAT = [0.34, 0.14, 0.14, 0.30, 0.14, 0.14, 0.34, 0.14, 0.14, 0.30, 0.14, 0.20];
var BS_HAT_B = [0.34, 0.20, 0.26, 0.30, 0.20, 0.26, 0.34, 0.20, 0.26, 0.30, 0.20, 0.26];
var BS_FILL = { kick: BS_KICK, hat: BS_HAT, snare: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0.6, 0.8, 1],
                tom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 2, 1] };
var BS_HIT = { bars: 1, hit: 1, chords: BS_CH_HIT, chordSteps: 12, pad: true,
               tom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3] };
var BS_A = { bars: 4, bass: BS_BASS, lead: BS_LEAD, stab: BS_STAB, chords: BS_CH_A, chordSteps: 12,
             pad: true, kick: BS_KICK, snare: BS_SNARE, hat: BS_HAT, crash: 1, fill: BS_FILL };
var BS_B = { bars: 4, bass: BS_BASS_B, lead: BS_LEAD_B, chords: BS_CH_B, chordSteps: 12,
             pad: true, kick: BS_KICK_B, snare: BS_SNARE_B, hat: BS_HAT_B, ohat: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
             crash: 1, fill: BS_FILL };

return {
  level: {
    bpm: 152, div: 4, bassRoot: 55.00, leadRoot: 440.00, padRoot: 220.00,
    echo: 3, leadWave: 'square', leadLen: 1.9, bassLen: 0.92,
    vBass: 0.30, vLead: 0.12, vStab: 0.10, vPad: 0.040, vArp: 0.045,
    song: [LV_INTRO, LV_A, LV_A2, LV_B, LV_A2, LV_BRK], loop: 2
  },
  title: {
    bpm: 96, div: 4, bassRoot: 55.00, leadRoot: 440.00, padRoot: 220.00,
    echo: 3, leadWave: 'triangle', leadLen: 2.6, bassLen: 6,
    vBass: 0.26, vLead: 0.16, vStab: 0.10, vPad: 0.050, vArp: 0.035,
    song: [TT_A, TT_B], loop: 0
  },
  boss: {
    bpm: 126, div: 3, bassRoot: 38.89, leadRoot: 311.13, padRoot: 155.56,
    echo: 2, leadWave: 'sawtooth', leadLen: 1.9, bassLen: 0.92, drive: true,
    vBass: 0.34, vLead: 0.10, vStab: 0.10, vPad: 0.045, vArp: 0.04,
    song: [BS_HIT, BS_A, BS_B], loop: 1
  }
};
})();

// Where each bar is in its song, worked out once at load so the sequencer
// only ever indexes.
(function () {
  for (var name in MUSIC) {
    if (!MUSIC.hasOwnProperty(name)) continue;
    var tr = MUSIC[name], b = 0;
    tr.bar = 4 * tr.div;
    tr.secOf = []; tr.secAt = [];
    for (var i = 0; i < tr.song.length; i++) {
      for (var j = 0; j < tr.song[i].bars; j++) { tr.secOf.push(i); tr.secAt.push(b); }
      b += tr.song[i].bars;
    }
    tr.bars = b;
    tr.loopStep = tr.loop * tr.bar;
    tr.endStep = b * tr.bar;
  }
})();

var Mus = {
  name: '',            // what is playing
  want: '',            // what was asked for, once the context is awake
  track: null,
  bus: null,           // the gain node the current track is scheduled onto
  kit: null,           // and what hangs off it
  step: 0,
  nextT: 0,
  spb: 0,              // seconds per step
  on: false
};

// --- The instruments -------------------------------------------------------
// Each one is deliberately a different SHAPE, not a different pitch of the
// same shape, because a track made of one timbre turns to mush the moment a
// sound effect lands on top of it. Every one takes the kit it plays into.

function musBass(k, t, f, dur, vel, drive) {
  var c = AUD.ctx;
  var o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f, t);
  lp.type = 'lowpass';
  // The filter sweep IS the groove. A flat-filtered saw at this pitch is a
  // drone; the same note with the cutoff falling through it plucks.
  lp.frequency.setValueAtTime(f * 9, t);
  lp.frequency.exponentialRampToValueAtTime(f * 2.4, t + dur * 0.8);
  lp.Q.value = 6;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp); lp.connect(g); g.connect(drive ? k.drive : k.out);
  o.start(t); o.stop(t + dur + 0.02);

  // A sine an octave up over it, so the line survives a phone speaker that
  // cannot reproduce 55 Hz by turning it into something it can.
  var s = c.createOscillator(), sg = c.createGain();
  s.type = 'sine';
  s.frequency.setValueAtTime(f * 2, t);
  sg.gain.setValueAtTime(0.0001, t);
  sg.gain.exponentialRampToValueAtTime(vel * 0.5, t + 0.008);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.8);
  s.connect(sg); sg.connect(k.out);
  s.start(t); s.stop(t + dur + 0.02);
}

// The hook. Into the echo as well as the room: the tape echo is the entire
// reason it sounds like a record rather than a beep (it used to be a second
// oscillator a step and a half behind; the echo does that for every voice).
function musLead(k, t, f, dur, vel, wave) {
  var c = AUD.ctx;
  var o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
  o.type = wave || 'square';
  o.frequency.setValueAtTime(f, t);
  o.detune.setValueAtTime(6, t);
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(wave === 'sawtooth' ? 2400 : 3600, t); lp.Q.value = 0.7;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.010);
  g.gain.setValueAtTime(vel, t + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp); lp.connect(g); g.connect(k.right); g.connect(k.send);
  o.start(t); o.stop(t + dur + 0.02);
}

// The arpeggio: a short pluck on the quarter-duty pulse, to the left of the
// hook, into the echo.
function musArp(k, t, f, dur, vel) {
  var c = AUD.ctx;
  var o = c.createOscillator(), g = c.createGain();
  if (AUD.pulse) o.setPeriodicWave(AUD.pulse); else o.type = 'square';
  o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(k.left); g.connect(k.send);
  o.start(t); o.stop(t + dur + 0.02);
}

// The pad: each chord tone two sawtooths a few cents apart, under one low
// filter, swelling in and holding for the length of the chord. It is what the
// track was missing most — the bass line always implied the chords and
// nothing ever played them.
function musPad(k, t, root, a, b, cc, dur, vel) {
  var c = AUD.ctx;
  var lp = c.createBiquadFilter(), g = c.createGain();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(1300, t); lp.Q.value = 0.6;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + Math.min(0.12, dur * 0.25));
  g.gain.setValueAtTime(vel, t + dur * 0.8);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  lp.connect(g); g.connect(k.out);
  for (var i = 0; i < 6; i++) {
    var semi = (i >> 1) === 0 ? a : (i >> 1) === 1 ? b : cc;
    var o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(hz(root, semi), t);
    o.detune.setValueAtTime((i & 1) ? 8 : -8, t);
    o.connect(lp);
    o.start(t); o.stop(t + dur + 0.02);
  }
}

function musStab(k, t, f, dur, vel) {
  // A minor triad, played as one gesture. Three thin triangles read as a chord
  // where one fat saw reads as a mistake.
  var c = AUD.ctx;
  var g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(k.out);
  for (var i = 0; i < 3; i++) {
    var o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(hz(f, i === 0 ? 0 : i === 1 ? 3 : 7), t);
    o.connect(g);
    o.start(t); o.stop(t + dur + 0.02);
  }
}

function musKick(k, t, vel) {
  var c = AUD.ctx;
  var o = c.createOscillator(), g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.09);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
  o.connect(g); g.connect(k.out);
  o.start(t); o.stop(t + 0.22);
}

function musSnare(k, t, vel) {
  var c = AUD.ctx;
  var s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
  s.buffer = AUD.noise;
  bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
  s.connect(bp); bp.connect(g); g.connect(k.out);
  s.start(t, Math.random() * 0.9, 0.18); s.stop(t + 0.18);
  // A body tone under the noise, or it is a hi-hat with ambitions.
  var o = c.createOscillator(), og = c.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(150, t + 0.06);
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(vel * 0.5, t + 0.003);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  o.connect(og); og.connect(k.out);
  o.start(t); o.stop(t + 0.10);
}

function musHat(k, t, vel, open) {
  var c = AUD.ctx;
  var s = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
  var len = open ? 0.17 : 0.035;
  s.buffer = AUD.noise;
  hp.type = 'highpass'; hp.frequency.value = open ? 6400 : 7200;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  s.connect(hp); hp.connect(g); g.connect(k.right);
  s.start(t, Math.random() * 0.9, len + 0.03); s.stop(t + len + 0.03);
}

function musCrash(k, t, vel) {
  var c = AUD.ctx;
  var s = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
  s.buffer = AUD.noise;
  hp.type = 'highpass'; hp.frequency.value = 4200;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
  s.connect(hp); hp.connect(g); g.connect(k.left);
  s.start(t, 0, 0.98); s.stop(t + 1.32);
}

// Toms: 1 low, 2 mid, 3 high.
function musTom(k, t, which, vel) {
  var f = which === 3 ? 196 : which === 2 ? 147 : 110;
  var c = AUD.ctx;
  var o = c.createOscillator(), g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.22);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
  o.connect(g); g.connect(k.out);
  o.start(t); o.stop(t + 0.28);
}

// The Postmaster's entrance: a kick, a crash, and a low cluster through the
// drive that rings for a bar and a half.
function musHit(k, t) {
  var c = AUD.ctx;
  musKick(k, t, 0.70);
  musCrash(k, t, 0.24);
  var g = c.createGain(), lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t);
  lp.frequency.exponentialRampToValueAtTime(160, t + 1.8);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
  lp.connect(g); g.connect(k.drive);
  for (var i = 0; i < 3; i++) {
    var o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(i === 0 ? 38.89 : i === 1 ? 41.20 : 55.00, t);
    o.connect(lp);
    o.start(t); o.stop(t + 2.42);
  }
}

// --- The sequencer ---------------------------------------------------------

function musStep(tr, step, t) {
  var k = Mus.kit, spb = Mus.spb, v, arr;
  var bar = (step / tr.bar) | 0;
  var s = tr.song[tr.secOf[bar]];
  var ls = step - tr.secAt[bar] * tr.bar;        // the step within its section
  var inBar = step - bar * tr.bar;               // and within its bar
  var D = (s.fill && bar - tr.secAt[bar] === s.bars - 1) ? s.fill : s;   // a fill takes the section's last bar

  if (s.hit && ls === 0) musHit(k, t);
  if (s.crash && ls === 0) musCrash(k, t, 0.16);

  arr = s.bass;
  if (arr) { v = arr[ls % arr.length]; if (v !== MUS_REST) musBass(k, t, hz(tr.bassRoot, v), spb * tr.bassLen, tr.vBass, tr.drive); }

  arr = s.lead;
  if (arr) { v = arr[ls % arr.length]; if (v !== MUS_REST) musLead(k, t, hz(tr.leadRoot, v + (s.up || 0)), spb * tr.leadLen, tr.vLead, tr.leadWave); }

  arr = s.stab;
  if (arr) { v = arr[ls % arr.length]; if (v !== MUS_REST) musStab(k, t, hz(tr.leadRoot * 0.5, v), spb * 1.4, tr.vStab); }

  if (s.chords) {
    var cs = s.chordSteps, ci = (((ls / cs) | 0) % (s.chords.length / 3)) * 3;
    if (s.pad && ls % cs === 0) musPad(k, t, tr.padRoot, s.chords[ci], s.chords[ci + 1], s.chords[ci + 2], spb * cs, tr.vPad);
    arr = s.arp;
    if (arr) {
      v = arr[ls % arr.length];
      if (v >= 0) musArp(k, t, hz(tr.padRoot, s.chords[ci + (v % 3)] + (v >= 3 ? 12 : 0)), spb * 0.85, tr.vArp);
    }
  }

  // Drums read by the step in the BAR, so a one-bar pattern and a fill line up.
  arr = D.kick;  if (arr && arr[inBar % arr.length]) musKick(k, t, 0.50 * arr[inBar % arr.length]);
  arr = D.snare; if (arr && arr[inBar % arr.length]) musSnare(k, t, 0.26 * arr[inBar % arr.length]);
  arr = D.tom;   if (arr && arr[inBar % arr.length]) musTom(k, t, arr[inBar % arr.length], 0.34);
  arr = D.hat;   if (arr) { v = arr[inBar % arr.length]; if (v > 0) musHat(k, t, v * 0.22, false); }
  arr = D.ohat;  if (arr && arr[inBar % arr.length]) musHat(k, t, 0.07, true);
}

// Hand the new track the idle bus and fade the old one out on the bus it is
// already scheduled onto. Notes that were queued before the switch keep
// playing and fade with it — that tail is the cross-fade, and it is why a
// boss door does not sound like a tape being yanked out.
function musStart(name) {
  var tr = MUSIC[name];
  if (!tr) return;
  var c = AUD.ctx, t = c.currentTime;

  var old = Mus.bus;
  var fresh = (old === AUD.busA) ? AUD.busB : AUD.busA;
  if (Mus.on && old) {
    old.gain.cancelScheduledValues(t);
    old.gain.setValueAtTime(old.gain.value, t);
    old.gain.linearRampToValueAtTime(0, t + AUD_XFADE);
  }
  fresh.gain.cancelScheduledValues(t);
  fresh.gain.setValueAtTime(0.0001, t);
  fresh.gain.linearRampToValueAtTime(1, t + (Mus.on ? AUD_XFADE : 0.25));

  Mus.bus = fresh;
  Mus.kit = fresh === AUD.busA ? AUD.kitA : AUD.kitB;
  Mus.track = tr;
  Mus.name = name;
  Mus.want = name;
  Mus.spb = 60 / tr.bpm / tr.div;
  Mus.kit.delay.delayTime.setValueAtTime(Mus.spb * tr.echo, t);
  Mus.step = 0;
  Mus.nextT = t + 0.06;
  Mus.on = true;
}

function musicPlay(trackName) {
  if (!MUSIC[trackName]) return;
  Mus.want = trackName;
  audioInit();
  // If the context is still asleep the tick picks this up the moment it wakes,
  // which is what makes "start the music on the title screen" work on iOS.
  if (audioReady() && Mus.name !== trackName) musStart(trackName);
}

function musicStop() {
  Mus.want = '';
  if (!Mus.on || !AUD.ctx) { Mus.on = false; Mus.name = ''; return; }
  var t = AUD.ctx.currentTime;
  Mus.bus.gain.cancelScheduledValues(t);
  Mus.bus.gain.setValueAtTime(Mus.bus.gain.value, t);
  Mus.bus.gain.linearRampToValueAtTime(0, t + 0.35);
  Mus.on = false;
  Mus.name = '';
}

// --- The victory sting -------------------------------------------------------
// A level is won: the Postmaster is down, or the truck has come to the pickup.
// Two bars of A major fanfare on the music side (so the music volume governs
// it) on a bus of its own, because musicStop() has just faded the track's.
// 0.9 s late, so it lands after the Postmaster's fall rather than on top of
// it, and after the pickup's chime has rung.

function musicSting(name) {
  if (name !== 'victory' || !audioReady()) return;
  musVictory(AUD.kitS, AUD.ctx.currentTime + 0.9);
}

function musVictory(k, t) {
  var q = 60 / 140 / 4, i;                       // a sixteenth at 140 bpm
  for (i = 0; i < 3; i++) musSnare(k, t + i * q, 0.10 + i * 0.05);
  // Da-da-da...
  for (i = 0; i < 3; i++) musLead(k, t + i * q, hz(440, 7), q * 0.9, 0.15, 'square');
  // ...DAAA.
  musLead(k, t + 3 * q, hz(440, 12), q * 5.5, 0.17, 'square');
  musPad(k, t + 3 * q, 220, 0, 4, 7, q * 6, 0.06);
  musBass(k, t + 3 * q, 55, q * 5, 0.30, false);
  musKick(k, t + 3 * q, 0.5); musCrash(k, t + 3 * q, 0.16);
  // The turn, and home.
  musLead(k, t + 9 * q, hz(440, 9), q * 0.9, 0.15, 'square');
  musLead(k, t + 10 * q, hz(440, 11), q * 0.9, 0.15, 'square');
  musLead(k, t + 11 * q, hz(440, 12), q * 10, 0.17, 'square');
  musLead(k, t + 11 * q, hz(440, 16), q * 10, 0.09, 'triangle');
  musPad(k, t + 11 * q, 220, 0, 4, 7, q * 11, 0.07);
  musBass(k, t + 11 * q, 55, q * 9, 0.30, false);
  musKick(k, t + 11 * q, 0.5); musCrash(k, t + 11 * q, 0.20);
}

// Called once per simulation step. dt is accepted and ignored on purpose: the
// frame clock says WHEN to look, and the audio clock says what time it is.
// Everything scheduled here is stamped with a WebAudio time, so a dropped
// frame costs nothing and a 120 Hz screen changes nothing.
function audioTick(dt) {
  if (!audioReady()) return;

  // The drones' engines go quiet the step nobody is driving them — the title,
  // the tally, anything that stops the world stepping.
  if (AUD.motors) {
    if (AUD.motorLive) { AUD.motorLive = false; AUD.motorMuted = false; }
    else if (!AUD.motorMuted) {
      for (var m = 0; m < AUD_MOTORS; m++) AUD.motors[m].vol.gain.setTargetAtTime(0, AUD.ctx.currentTime, 0.05);
      AUD.motorMuted = true;
    }
  }

  if (Mus.want && Mus.want !== Mus.name) { musStart(Mus.want); return; }
  if (!Mus.on || !Mus.track) return;

  var now = AUD.ctx.currentTime;
  // A backgrounded tab suspends the clock. Without this the sequencer would
  // come back to a cursor minutes in the past and dump ten thousand notes into
  // the graph in one frame.
  if (Mus.nextT < now - 0.20) { Mus.nextT = now + 0.05; }

  var guard = 0;
  while (Mus.nextT < now + AUD_LOOKAHEAD && guard++ < 64) {
    musStep(Mus.track, Mus.step, Mus.nextT);
    Mus.step++;
    if (Mus.step >= Mus.track.endStep) Mus.step = Mus.track.loopStep;
    Mus.nextT += Mus.spb;
  }
}

// --- The player's own feedback flags -----------------------------------------
//
// player.js sets fxJump / fxLand / fxWall / fxHurt / fxToss for the particle
// system, and those are exactly the carrier's sounds. Calling this is one line
// in simulate() instead of a dozen edits in player.js.
//
// It MUST run AFTER the world has stepped and BEFORE drainFx(), which clears
// the flags. From 0.8.0 to 0.9.3 it ran at the TOP of simulate(), where every
// flag it looked for had already been set and cleared again by the previous
// step — so the jump, the double jump, the landing, the wall kick, the hurt
// and the throw were all defined, all tuned, and never once heard. That is
// the whole of why "there's no throw sound". It does not clear the flags
// itself: the particles still have them next.
function audioFromPlayer() {
  if (typeof P === 'undefined' || !audioReady()) return;
  // In the truck he is not drawn and not his own: stage.js puts him at the
  // door every step, and the "landings" that makes are the truck's business.
  if (typeof Stage !== 'undefined' && !Stage.shown) return;
  if (P.fxJump) sfx(P.fxJump === 2 ? 'doubleJump' : 'jump');
  if (P.fxLand) sfx('land');
  if (P.fxWall) sfx('wallKick');
  // A death plays its own four falling steps (playerDie); the hurt that caused
  // it, in the same step, would only muddy them.
  if (P.fxHurt && AUD.ctx.currentTime - AUD.last.die > 0.1) sfx('hurt');
  // 1 is mail, at whatever tier he has; 2 is a package, which says its own
  // 'nade' from the line that threw it.
  if (P.fxToss === 1) sfx(P.mailTier >= 3 ? 'throw3' : P.mailTier === 2 ? 'throw2' : 'throw');
}

// --- The gesture unlock ----------------------------------------------------
//
// Self-installing, because this file is not allowed to touch any other one and
// because every route into the game goes through one of these events anyway.
// They are passive and they never stopPropagation, so the controller, the menu
// and the keyboard handler all still see the same event.

(function () {
  if (typeof window === 'undefined' || !window.addEventListener) return;
  function wake() {
    audioInit();
    if (audioReady()) {
      // Drop the listeners only once the context actually came up. A first tap
      // that is refused (it happens on iOS during a page transition) must not
      // be the only chance the game gets.
      window.removeEventListener('pointerdown', wake, true);
      window.removeEventListener('touchstart', wake, true);
      window.removeEventListener('mousedown', wake, true);
      window.removeEventListener('keydown', wake, true);
      AUD.started = true;
    }
  }
  window.addEventListener('pointerdown', wake, true);
  window.addEventListener('touchstart', wake, true);
  window.addEventListener('mousedown', wake, true);
  window.addEventListener('keydown', wake, true);

  // iOS suspends the context when the phone is locked or the app is switched
  // away from, and never resumes it by itself.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && AUD.ctx && AUD.ctx.state !== 'running' && AUD.ctx.resume) {
      AUD.ctx.resume();
    }
  });
})();
