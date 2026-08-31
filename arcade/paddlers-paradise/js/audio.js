// PORTAGE — AUDIO
// ---------------------------------------------------------------------------
// Everything synthesised in WebAudio — no sample files, same law as the art.
// The soundtrack of Algonquin is mostly silence with a loon in it, so that is
// what this is: loon wails on the water, paddle strokes, fire crackle at
// camp, a mosquito at dusk, and a small chime when something goes right.
// ---------------------------------------------------------------------------

'use strict';

var AUDIO = (function () {
  var ctx = null;
  var muted = false;
  var master = null;
  var buzzOsc = null, buzzGain = null;
  var crackleTimer = 0, loonTimer = 20;
  var kick = null;                 // the silent <audio> loop (see below)
  var pinged = false;              // one soft blip when sound first lives

  /**
   * Mobile audio needs three things a desktop never asks for (Evrtek: total
   * silence on every phone), all of which must happen INSIDE a user gesture:
   *
   * 1. resume() immediately after creating the context — on iOS it can be
   *    born 'suspended' and stay that way forever if nobody asks.
   * 2. A silent warm-up buffer played through the graph — the classic iOS
   *    unlock, still the most reliable way to open the output path.
   * 3. A looping silent <audio> ELEMENT — playing any media element moves
   *    the page's audio session to the 'playback' category, which is what
   *    makes iOS stop muting WebAudio when the RINGER SWITCH is on silent.
   *    Most phones live on silent; without this, everything else is moot.
   */
  function silentWavURI() {
    var n = 4000, sr = 8000;                    // half a second of nothing
    var bytes = new Uint8Array(44 + n * 2);
    var dv = new DataView(bytes.buffer);
    function ws(o, s2) { for (var i = 0; i < s2.length; i++) bytes[o + i] = s2.charCodeAt(i); }
    ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE');
    ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
    dv.setUint16(22, 1, true); dv.setUint32(24, sr, true);
    dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    ws(36, 'data'); dv.setUint32(40, n * 2, true);
    var bin = '', j;
    for (j = 0; j < bytes.length; j++) bin += String.fromCharCode(bytes[j]);
    return 'data:audio/wav;base64,' + btoa(bin);
  }

  function startKick() {
    try {
      if (!kick) {
        kick = document.createElement('audio');
        kick.src = silentWavURI();
        kick.loop = true;
        kick.setAttribute('playsinline', '');
        kick.preload = 'auto';
        // in the DOM for the older iOS builds that insist on it
        (document.body || document.documentElement).appendChild(kick);
      }
      var p = kick.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  function ping() {
    if (pinged || muted || !ctx || ctx.state !== 'running') return;
    pinged = true;
    // one soft blip so a phone player KNOWS sound is alive
    tone('sine', 660, 660, 0.09, 0.05);
  }

  function unlock() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      try {
        ctx.onstatechange = function () { ping(); };
      } catch (e) {}
    }
    if (ctx.state === 'suspended') {
      var pr = ctx.resume();
      if (pr && pr.then) pr.then(ping, function () {});
    }
    // the warm-up: a real (silent) buffer through the real output, in-gesture
    try {
      var b = ctx.createBuffer(1, 1, 22050);
      var src = ctx.createBufferSource();
      src.buffer = b;
      src.connect(ctx.destination);
      src.start(0);
    } catch (e2) {}
    if (!muted) startKick();
    ping();
  }

  function on() {
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      // heal quietly: this call cannot play, but the next one may
      var pr2 = ctx.resume();
      if (pr2 && pr2.then) pr2.then(ping, function () {});
      return false;
    }
    return ctx.state === 'running' && !muted;
  }

  function tone(type, f0, f1, dur, vol, delay) {
    if (!on()) return;
    var t = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, vol, cutoff, delay) {
    if (!on()) return;
    var t = ctx.currentTime + (delay || 0);
    var n = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0), i;
    for (i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    var g = ctx.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }

  // The loon: a wail that rises, holds with vibrato, and falls away.
  function loon() {
    if (!on()) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator(), g = ctx.createGain();
    var vib = ctx.createOscillator(), vibG = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(540, t);
    o.frequency.linearRampToValueAtTime(880, t + 0.45);
    o.frequency.setValueAtTime(880, t + 0.9);
    o.frequency.linearRampToValueAtTime(560, t + 1.5);
    vib.type = 'sine'; vib.frequency.value = 5.5;
    vibG.gain.value = 14;
    vib.connect(vibG).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.25);
    g.gain.setValueAtTime(0.14, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 1.7);
    vib.start(t); vib.stop(t + 1.7);
    // the echo off the far shore
    tone('sine', 700, 560, 0.8, 0.03, 1.9);
  }

  function paddle()   { noise(0.16, 0.20, 900); }
  function clunk()    { tone('sine', 95, 55, 0.14, 0.35); noise(0.07, 0.3, 420); }
  function chop(d)    { noise(0.045, 0.5, 2600, d); tone('triangle', 210, 70, 0.09, 0.2, d); }
  function feed()     { noise(0.2, 0.22, 700); noise(0.06, 0.18, 1600, 0.12); }
  function hail()     { tone('sine', 520, 520, 0.12, 0.06); tone('sine', 660, 660, 0.18, 0.05, 0.16); }
  function chime()    { tone('triangle', 660, 660, 0.12, 0.12); tone('triangle', 990, 990, 0.2, 0.10, 0.10); }
  function tailSlap() { noise(0.10, 0.45, 700); }
  function morning()  { tone('triangle', 523, 523, 0.15, 0.09); tone('triangle', 784, 784, 0.28, 0.08, 0.14); }

  function setBuzz(level) {
    if (!ctx) return;
    if (level > 0 && !buzzOsc && on()) {
      buzzOsc = ctx.createOscillator(); buzzGain = ctx.createGain();
      buzzOsc.type = 'sawtooth'; buzzOsc.frequency.value = 380;
      var wob = ctx.createOscillator(), wobG = ctx.createGain();
      wob.type = 'sine'; wob.frequency.value = 8; wobG.gain.value = 30;
      wob.connect(wobG).connect(buzzOsc.frequency);
      buzzGain.gain.value = 0;
      buzzOsc.connect(buzzGain).connect(master);
      buzzOsc.start(); wob.start();
      buzzOsc._wob = wob;
    }
    if (buzzGain) buzzGain.gain.value = 0.02 * level;
    if (level <= 0 && buzzOsc) {
      buzzOsc.stop(); buzzOsc._wob.stop(); buzzOsc = null; buzzGain = null;
    }
  }

  // ambient pass, called each frame with the situation
  function ambient(dt, state) {
    if (!on()) return;
    // loons keep their own irregular clock, mostly on open water, more at dusk
    loonTimer -= dt * (state.onWater ? 1.6 : 0.5) * (state.dusk ? 2 : 1);
    if (loonTimer <= 0) { loon(); loonTimer = 18 + Math.random() * 30; }
    if (state.campfire) {
      crackleTimer -= dt;
      if (crackleTimer <= 0) { noise(0.05, 0.10, 1400); crackleTimer = 0.12 + Math.random() * 0.5; }
    }
    setBuzz(state.mosquito ? 1 : 0);
  }

  function toggleMute() {
    muted = !muted;
    if (muted) setBuzz(0);
    if (master) master.gain.value = muted ? 0 : 0.5;   // silences sounds in flight
    try {
      if (kick) { if (muted) kick.pause(); else startKick(); }
    } catch (e) {}
    return muted;
  }

  /** For the Outfitter's status line — remote debugging with Evrtek. */
  function state() {
    if (!(window.AudioContext || window.webkitAudioContext)) return 'unsupported';
    if (!ctx) return 'waiting for first tap';
    return ctx.state + (muted ? ', muted' : '') +
      (kick && !kick.paused ? ', session held' : '');
  }

  /** Everything paused (cards, map, title): stop the drone, keep the peace. */
  function hush() { setBuzz(0); }

  return {
    unlock: unlock, ambient: ambient, paddle: paddle, chime: chime,
    loon: loon, tailSlap: tailSlap, morning: morning, hush: hush, clunk: clunk, chop: chop, feed: feed, hail: hail,
    toggleMute: toggleMute, isMuted: function () { return muted; },
    state: state,
  };
})();
