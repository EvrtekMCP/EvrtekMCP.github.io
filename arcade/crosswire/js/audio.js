'use strict';
// CROSSWIRE — sound.
//
// EVRTEK 2026-09-07: "the vibe should be very electronic", and then, a minute
// later: "the audio needs to be good, not annoying. MIDI is out for sure."
//
// That second note is the design brief. The Arcade rule that a game ships NO
// AUDIO FILES still stands, so everything here is synthesised with WebAudio —
// but "synthesised" is not the same as "chiptune". What makes a bare
// oscillator sound like a 1990s soundcard is the absence of everything a
// record has around it, so this engine builds those things first:
//
//   a COMPRESSOR on the master, which glues the mix and stops it clipping;
//   a REVERB, made from a decaying noise impulse in a convolver, so nothing
//     lands dry;
//   a dotted-eighth DELAY with feedback for the arpeggio and the hits;
//   FILTERED sawtooths with real attack and release rather than square waves
//     that switch on and off;
//   DETUNED pairs, panned, for width;
//   and sixteen-bar loops with a fill, a drop and a lift, because a loop
//     that never changes is the fastest way to be muted — three of them now,
//     one a level, each a step up in tempo (EVRTEK 2026-09-08).
//
// Two halves. SFX are one-shot recipes keyed by name — the game says
// CW_AUDIO.play('place') and never knows a frequency. MUSIC is a sequencer
// keeping notes scheduled a tenth of a second ahead of the audio clock, in
// 16th-note steps. It tightens with the clock: setTension(0..1) opens the
// filters and thickens the hats when time is short.
//
// Headless (no AudioContext, as in the harness) every call records what it
// was asked for and does nothing else. The context is created on the first
// key press, because browsers refuse to start audio any other way.
var CW_AUDIO = (function () {

  var hasWindow = (typeof window !== 'undefined');
  var AC = hasWindow ? (window.AudioContext || window.webkitAudioContext) : null;

  var ctx = null;
  var master, comp, sfxBus, musicBus, duckGain, verbSend, delaySend, delayNode;
  var noiseBuf = null;
  var prefs = { music: true, sfx: true };
  var tension = 0;
  var history = [];

  // ---- preferences ---------------------------------------------------------
  function load() {
    try {
      var raw = hasWindow && window.localStorage && window.localStorage.getItem('crosswire.audio');
      if (raw) {
        var p = JSON.parse(raw);
        if (typeof p.music === 'boolean') prefs.music = p.music;
        if (typeof p.sfx === 'boolean') prefs.sfx = p.sfx;
      }
    } catch (e) { /* file:// and private windows may refuse; defaults stand */ }
  }
  function save() {
    try {
      if (hasWindow && window.localStorage) {
        window.localStorage.setItem('crosswire.audio', JSON.stringify(prefs));
      }
    } catch (e) { /* same */ }
  }
  load();

  // ---- the room ------------------------------------------------------------
  // A reverb impulse is just a noise burst that fades: 1.8 seconds, a little
  // darker as it decays, different in each ear so it has width.
  function makeImpulse(seconds, decay) {
    var rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    var buf = ctx.createBuffer(2, len, rate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch), lp = 0;
      for (var i = 0; i < len; i++) {
        var env = Math.pow(1 - i / len, decay);
        var w = (Math.random() * 2 - 1);
        lp += (w - lp) * (0.35 - 0.25 * (i / len));   // duller as it dies
        d[i] = lp * env;
      }
    }
    return buf;
  }

  // The whole signal chain, built on whatever context it is given: the live
  // one on the first key press, or an offline one when rendering samples.
  function buildGraph(c) {
      ctx = c;
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 4;
      comp.attack.value = 0.004; comp.release.value = 0.18;
      master = ctx.createGain(); master.gain.value = 0.85;
      comp.connect(master); master.connect(ctx.destination);

      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.6; sfxBus.connect(comp);
      duckGain = ctx.createGain(); duckGain.gain.value = 1; duckGain.connect(comp);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.3; musicBus.connect(duckGain);

      // The reverb return, shared by everything.
      var verb = ctx.createConvolver();
      verb.buffer = makeImpulse(1.8, 2.6);
      var verbReturn = ctx.createGain(); verbReturn.gain.value = 0.55;
      verbSend = ctx.createGain(); verbSend.gain.value = 1;
      verbSend.connect(verb); verb.connect(verbReturn); verbReturn.connect(comp);

      // The delay: dotted eighth, feeding back, into the reverb as well.
      var delay = ctx.createDelay(1.0);
      delay.delayTime.value = (60 / score.bpm) * 0.75;
      delayNode = delay;
      var fb = ctx.createGain(); fb.gain.value = 0.42;
      var fbFilter = ctx.createBiquadFilter(); fbFilter.type = 'lowpass'; fbFilter.frequency.value = 2400;
      var wet = ctx.createGain(); wet.gain.value = 0.32;
      delaySend = ctx.createGain(); delaySend.gain.value = 1;
      delaySend.connect(delay); delay.connect(fbFilter); fbFilter.connect(fb); fb.connect(delay);
      delay.connect(wet); wet.connect(duckGain); wet.connect(verbSend);

      // One second of white noise, reused by every hit, hat and crackle.
      var n = ctx.sampleRate, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      noiseBuf = buf;
  }

  function unlock() {
    if (!AC) return false;
    if (!ctx) {
      var c;
      try { c = new AC(); } catch (e) { return false; }
      buildGraph(c);
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    if (prefs.music && !musicOn) startMusic();
    return true;
  }

  function now() { return ctx ? ctx.currentTime : 0; }
  function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // Envelope event times that are ALWAYS in order, whatever the note length.
  // Tron's patrol found the arpeggio's plucks were shorter than their own
  // decay, so the release was being scheduled before the decay had finished
  // and the browser jumped the gain instead of fading it: a click in every
  // note of the loop. The times are computed first and clamped to each other,
  // so a short note gets a shorter envelope rather than a broken one.
  function envTimes(t, dur, a, d, r) {
    var end = t + dur;
    var atk = t + Math.min(a, dur * 0.4);
    var dec = d ? Math.min(atk + d, end - 0.004) : atk;
    if (dec < atk) dec = atk;
    var rel = Math.max(dec, end - r);
    if (rel >= end) rel = end - 0.002;
    return { atk: atk, dec: dec, rel: rel, end: end };
  }

  // ---- voices --------------------------------------------------------------
  // An oscillator with a real envelope (a / d / s / r), an optional filter with
  // its own envelope, a pan, and sends to the delay and the reverb.
  function tone(o) {
    if (!ctx) return;
    var t = o.t !== undefined ? o.t : now();
    var dur = o.dur;
    var env = envTimes(t, dur, o.a || 0.005, o.d || 0, o.r || Math.min(0.08, dur * 0.4));
    var peak = Math.max(0.0002, o.gain || 0.2);
    var sus = Math.max(0.0002, (o.s !== undefined ? o.s : 0.6) * peak);
    var osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(1, o.f0), t);
    if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + Math.min(o.glide || dur, dur));
    if (o.detune) osc.detune.value = o.detune;

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, env.atk);
    if (o.d) g.gain.exponentialRampToValueAtTime(sus, env.dec);
    g.gain.setValueAtTime(o.d ? sus : peak, env.rel);
    g.gain.exponentialRampToValueAtTime(0.0001, env.end);

    var head = osc, tail;
    if (o.filter) {
      var f = ctx.createBiquadFilter();
      f.type = o.filter.type || 'lowpass';
      f.frequency.setValueAtTime(o.filter.f0, t);
      if (o.filter.f1) f.frequency.exponentialRampToValueAtTime(o.filter.f1, t + (o.filter.time || dur));
      f.Q.value = o.filter.q || 0.8;
      osc.connect(f); head = f;
    }
    head.connect(g);
    tail = g;
    if (o.pan && ctx.createStereoPanner) {
      var p = ctx.createStereoPanner(); p.pan.value = o.pan;
      g.connect(p); tail = p;
    }
    tail.connect(o.bus || sfxBus);
    if (o.delay && delaySend) { var ds = ctx.createGain(); ds.gain.value = o.delay; tail.connect(ds); ds.connect(delaySend); }
    if (o.verb && verbSend) { var vs = ctx.createGain(); vs.gain.value = o.verb; tail.connect(vs); vs.connect(verbSend); }
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // A burst of noise through a sweeping filter. Same envelope and sends.
  function noise(o) {
    if (!ctx || !noiseBuf) return;
    var t = o.t !== undefined ? o.t : now();
    var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f0 || 2000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    f.Q.value = o.q || 0.7;
    // Same rule as tone(): the attack can never outlast the note.
    var a = Math.min(o.a || 0.003, o.dur * 0.5);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain || 0.2), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g);
    var tail = g;
    if (o.pan && ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = o.pan; g.connect(p); tail = p; }
    tail.connect(o.bus || sfxBus);
    if (o.verb && verbSend) { var vs = ctx.createGain(); vs.gain.value = o.verb; tail.connect(vs); vs.connect(verbSend); }
    src.start(t, Math.random() * 0.6);
    src.stop(t + o.dur + 0.05);
  }

  // A PLUCK: a filtered saw whose filter closes fast. The single most useful
  // synth voice there is, and nothing about it sounds like a soundcard.
  function pluck(t, m, o) {
    o = o || {};
    tone({ t: t, type: 'sawtooth', f0: midi(m), dur: o.dur || 0.3, a: 0.003, d: 0.08, s: 0.35, r: 0.12,
           gain: o.gain || 0.12, bus: o.bus, pan: o.pan,
           filter: { f0: o.open || 3200, f1: o.close || 380, time: o.ftime || 0.16, q: 1.4 },
           delay: o.delay, verb: o.verb !== undefined ? o.verb : 0.35 });
  }

  // A STAB: a detuned saw chord with a filter that opens and shuts.
  function stab(t, notes, o) {
    o = o || {};
    for (var i = 0; i < notes.length; i++) {
      tone({ t: t, type: 'sawtooth', f0: midi(notes[i]), detune: -7, dur: o.dur || 0.5, a: 0.01, d: 0.12, s: 0.4, r: 0.2,
             gain: o.gain || 0.06, pan: -0.25, bus: o.bus,
             filter: { f0: 600, f1: o.open || 4200, time: 0.05, q: 1.2 }, delay: o.delay || 0.35, verb: 0.45 });
      tone({ t: t, type: 'sawtooth', f0: midi(notes[i]), detune: 7, dur: o.dur || 0.5, a: 0.01, d: 0.12, s: 0.4, r: 0.2,
             gain: o.gain || 0.06, pan: 0.25, bus: o.bus,
             filter: { f0: 600, f1: o.open || 4200, time: 0.05, q: 1.2 }, delay: o.delay || 0.35, verb: 0.45 });
    }
  }

  // ---- the effects ---------------------------------------------------------
  var SFX = {
    // Set down: a soft mechanical click and a low pop, a touch of room.
    place: function (t) {
      noise({ t: t, type: 'bandpass', f0: 2600, q: 2.5, dur: 0.02, gain: 0.22, verb: 0.2 });
      tone({ t: t, type: 'sine', f0: 170, f1: 62, dur: 0.1, gain: 0.42, verb: 0.15 });
    },
    // Turned: a rotary tick, quiet, with a little lift in it.
    rotate: function (t) {
      noise({ t: t, type: 'bandpass', f0: 3600, q: 3, dur: 0.016, gain: 0.26 });
      tone({ t: t, type: 'sine', f0: 620, f1: 820, dur: 0.055, gain: 0.13, glide: 0.04, verb: 0.2 });
    },
    // Tuned: two smooth notes, up for S->M and down for M->S. The interval is
    // the information, so it is the same interval every time.
    tune: function (t, o) {
      var up = !o || o.to !== 'S';
      pluck(t, up ? 69 : 76, { gain: 0.11, open: 2600, close: 500, dur: 0.22, verb: 0.4 });
      pluck(t + 0.08, up ? 76 : 69, { gain: 0.13, open: 3000, close: 500, dur: 0.34, verb: 0.5, delay: 0.25 });
    },
    // The destructor: a zap with the filter sweeping down and a drop under it.
    cut: function (t) {
      noise({ t: t, type: 'bandpass', f0: 2800, f1: 200, q: 1.4, dur: 0.16, gain: 0.3, verb: 0.3 });
      tone({ t: t, type: 'sawtooth', f0: 210, f1: 46, dur: 0.2, gain: 0.2, filter: { f0: 1800, f1: 200 }, verb: 0.25 });
    },
    // No: a flat, muffled buzz.
    noroom: function (t) {
      tone({ t: t, type: 'sawtooth', f0: 98, f1: 88, dur: 0.11, gain: 0.1, filter: { f0: 420, q: 2 } });
    },
    // A short burning away: crackle over a buzz that sinks.
    short: function (t) {
      tone({ t: t, type: 'sawtooth', f0: 160, f1: 48, dur: 0.34, gain: 0.16, filter: { f0: 1400, f1: 180, q: 3 }, verb: 0.3 });
      for (var i = 0; i < 7; i++) {
        noise({ t: t + 0.02 + i * 0.042 + Math.random() * 0.015, type: 'bandpass',
                f0: 1800 + Math.random() * 2600, q: 4, dur: 0.018, gain: 0.16, pan: Math.random() * 0.8 - 0.4 });
      }
    },
    // A line lands: a chord stab with a pluck run on top, more of both per
    // tier, and a sub hit under the big ones. Through the delay so it rings.
    crosswire: function (t, o) {
      var tier = (o && o.tier) || 1;
      stab(t, tier >= 3 ? [57, 61, 64, 69] : (tier === 2 ? [57, 61, 64] : [57, 64]),
           { gain: 0.05 + tier * 0.012, dur: 0.45 + tier * 0.15, open: 3200 + tier * 900 });
      var run = [69, 73, 76, 81, 85].slice(0, 2 + tier);
      for (var i = 0; i < run.length; i++) {
        pluck(t + 0.04 + i * 0.06, run[i], { gain: 0.09, open: 4200, close: 600, dur: 0.28, delay: 0.3, verb: 0.4, pan: -0.2 + i * 0.1 });
      }
      tone({ t: t, type: 'sine', f0: 120, f1: 40, dur: 0.28 + tier * 0.08, gain: 0.3 + tier * 0.1 });
      if (tier >= 3) noise({ t: t, type: 'lowpass', f0: 700, f1: 90, dur: 0.4, gain: 0.25, verb: 0.3 });
    },
    // DOUBLE SOURCE / MEGA SOURCE: a sparkle under the call.
    source: function (t, o) {
      var n = (o && o.n) || 2;
      for (var i = 0; i < n + 1; i++) {
        pluck(t + 0.2 + i * 0.055, 88 + i * 4, { gain: 0.06, open: 5000, close: 900, dur: 0.2, delay: 0.3, verb: 0.5, pan: 0.3 });
      }
    },
    // The keystone: a wide major chord swelling open.
    keystone: function (t) {
      stab(t, [57, 61, 64, 69, 73], { gain: 0.05, dur: 1.1, open: 5000, delay: 0.4 });
      tone({ t: t, type: 'sine', f0: 80, f1: 34, dur: 0.6, gain: 0.45 });
    },
    // The surge is coming: a low pulse, once a second for three, rising.
    surgewarn: function (t, o) {
      var k = (o && o.k) || 0;
      tone({ t: t, type: 'sawtooth', f0: 55 + k * 4, dur: 0.18, gain: 0.26, filter: { f0: 240 + k * 90, q: 3 }, verb: 0.2 });
      tone({ t: t + 0.13, type: 'sawtooth', f0: 82 + k * 6, dur: 0.12, gain: 0.16, filter: { f0: 320 + k * 90, q: 3 }, verb: 0.2 });
    },
    // And here it is.
    surgehit: function (t) {
      tone({ t: t, type: 'sine', f0: 90, f1: 28, dur: 0.55, gain: 0.55 });
      noise({ t: t, type: 'lowpass', f0: 1600, f1: 110, dur: 0.4, gain: 0.32, verb: 0.4 });
      tone({ t: t, type: 'sawtooth', f0: 52, f1: 38, dur: 0.45, gain: 0.14, filter: { f0: 280, q: 2 } });
    },
    // A slab hitting the board: heavy, short, some grit.
    land: function (t) {
      tone({ t: t, type: 'sine', f0: 105, f1: 36, dur: 0.17, gain: 0.45, verb: 0.15 });
      noise({ t: t, type: 'lowpass', f0: 800, f1: 140, dur: 0.09, gain: 0.26 });
    },
    // Time: a soft tick a second under fifteen, a double tick under five.
    // Rounded envelopes on purpose; a piercing tick is the annoying version.
    timewarn: function (t, o) {
      var urgent = o && o.urgent;
      tone({ t: t, type: 'sine', f0: urgent ? 1180 : 880, dur: 0.06, a: 0.006, gain: urgent ? 0.13 : 0.08, verb: 0.3 });
      if (urgent) tone({ t: t + 0.1, type: 'sine', f0: 1180, dur: 0.06, a: 0.006, gain: 0.13, verb: 0.3 });
    },
    // A level: a pluck run up, ringing.
    levelup: function (t) {
      var seq = [64, 68, 71, 76, 80];
      for (var i = 0; i < seq.length; i++) {
        pluck(t + i * 0.085, seq[i], { gain: 0.1, open: 4000, close: 600, dur: 0.3, delay: 0.35, verb: 0.5, pan: -0.3 + i * 0.15 });
      }
      stab(t + 0.4, [64, 68, 71, 76], { gain: 0.04, dur: 0.9, open: 3600 });
    },
    // Over: a slow phrase down, and the room left ringing.
    gameover: function (t) {
      var seq = [69, 65, 62, 57];
      for (var i = 0; i < seq.length; i++) {
        tone({ t: t + i * 0.26, type: 'sawtooth', f0: midi(seq[i]), dur: 0.6, a: 0.02, gain: 0.09,
               filter: { f0: 1400, f1: 260 }, delay: 0.3, verb: 0.6 });
      }
      tone({ t: t + 0.78, type: 'sine', f0: 58, f1: 28, dur: 1.1, gain: 0.35, verb: 0.3 });
    },
    // The rig complete (EVRTEK 2026-09-08: three levels finish a difficulty):
    // the level-up's run, longer and in a major key, into two chords that
    // swell open one after the other, over a warm low note. A finish, not a
    // fanfare — it has to sit well next to a score being read.
    complete: function (t) {
      var seq = [60, 64, 67, 72, 76, 79, 84];
      for (var i = 0; i < seq.length; i++) {
        pluck(t + i * 0.07, seq[i], { gain: 0.1, open: 4200, close: 700, dur: 0.35, delay: 0.4, verb: 0.55, pan: -0.4 + i * 0.13 });
      }
      stab(t + 0.5, [60, 64, 67, 71, 74], { gain: 0.05, dur: 1.6, open: 4200, delay: 0.3 });
      stab(t + 1.15, [62, 65, 69, 72, 77], { gain: 0.045, dur: 1.9, open: 3600, delay: 0.3 });
      tone({ t: t + 0.5, type: 'sine', f0: 65, f1: 49, dur: 1.5, gain: 0.3, verb: 0.3 });
    },
    // A run starting: a filtered lift into a ringing note.
    start: function (t) {
      tone({ t: t, type: 'sawtooth', f0: 110, f1: 440, dur: 0.4, a: 0.02, gain: 0.1, glide: 0.34,
             filter: { f0: 300, f1: 5000, time: 0.38 }, verb: 0.4 });
      pluck(t + 0.36, 81, { gain: 0.12, open: 4500, close: 700, dur: 0.4, delay: 0.35, verb: 0.5 });
    },
    menumove: function (t) {
      noise({ t: t, type: 'bandpass', f0: 3000, q: 3, dur: 0.014, gain: 0.2 });
      tone({ t: t, type: 'sine', f0: 560, dur: 0.055, gain: 0.1, verb: 0.2 });
    },
    menupick: function (t) {
      pluck(t, 69, { gain: 0.08, open: 3000, close: 600, dur: 0.18, verb: 0.35 });
      pluck(t + 0.07, 76, { gain: 0.1, open: 3400, close: 600, dur: 0.3, delay: 0.25, verb: 0.45 });
    },
    // A bug landing (MAYHEM): a wobble.
    bug: function (t) {
      tone({ t: t, type: 'square', f0: 300, f1: 170, dur: 0.22, gain: 0.07, filter: { f0: 900 }, verb: 0.3 });
      tone({ t: t + 0.12, type: 'square', f0: 170, f1: 300, dur: 0.22, gain: 0.07, filter: { f0: 900 }, verb: 0.3 });
    }
  };

  function play(name, opt) {
    history.push(name);
    if (history.length > 64) history.shift();
    if (!ctx || !prefs.sfx || !SFX[name]) return false;
    try { SFX[name](now() + 0.004, opt || {}); } catch (e) { return false; }
    return true;
  }

  // The music dips under a spoken line and comes back.
  function duck(depth, secs) {
    if (!ctx || !duckGain) return;
    var t = now();
    duckGain.gain.cancelScheduledValues(t);
    duckGain.gain.setValueAtTime(duckGain.gain.value, t);
    duckGain.gain.linearRampToValueAtTime(1 - (depth || 0.5), t + 0.06);
    duckGain.gain.linearRampToValueAtTime(1, t + (secs || 1.3));
  }

  // ---- the music -----------------------------------------------------------
  //
  // THREE SCORES, one a level. EVRTEK 2026-09-08: "I want different music for
  // each of the three levels... they should be slightly increased tempos but
  // still remain a nice vibe and not annoying to hear on repeat." Same kit and
  // the same sixteen-bar shape in all three — a fill on the last beat of each
  // half, a drop on bar sixteen into a riser that lands on bar one, so the
  // loop breathes — and a different key, tempo, bass and top line in each, so
  // a level is heard as well as seen:
  //
  //   1  WIRE   116  A minor. Am7 Fmaj7 Cmaj7 G, the second pass turning on
  //                  Dm7 E7. A syncopated sub bass, an arpeggio of plucks
  //                  through the delay from bar five, claps from bar nine.
  //                  The original, as it was.
  //   2  SURGE  124  D minor. Dm7 Bbmaj7 Fmaj7 C, turning on Gm7 A7. The bass
  //                  pushes on the off-beats and chord stabs answer it, the
  //                  claps are there from bar one, and a bell line takes the
  //                  second half every other pass.
  //   3  BLEND  132  G major. Gmaj7 Em7 Cmaj7 D, turning on Am7 D7. A rolling
  //                  bass in octaves, a bell arpeggio that runs three steps
  //                  against the four, a shaker on the off-beat sixteenths and
  //                  a hook over the second half. Brighter, because a blend is.
  //
  // Every other pass the top line rests for the last two bars — or, in the
  // two newer scores, the arpeggio and the lead trade the second half — which
  // is most of what keeps a loop from wearing out its welcome.
  //
  // The switch is made on a bar line: setLevel(n) marks the next score and
  // the scheduler swaps at the first step of the next bar, retuning the delay
  // to the new tempo at that instant, so a level-up is a change of tune and
  // never a stumble.
  var BARS = 16, STEPS = BARS * 16;

  function score4(a, b, c, d, e, f) {
    // Three passes of the first four chords, then the turnaround.
    return [a, b, c, d, a, b, c, d, a, b, c, d, a, b, e, f];
  }

  var SCORES = [
    {
      name: 'WIRE', bpm: 116,
      chords: score4([57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 67],
                     [50, 53, 57, 60], [52, 56, 59, 62]),
      roots: score4(33, 29, 36, 31, 38, 40),
      bassHits: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      arpPat: [0, 2, 1, 3, 2, 3, 1, 2, 0, 2, 3, 1, 2, 3, 1, 3]
    },
    {
      name: 'SURGE', bpm: 124,
      chords: score4([50, 53, 57, 60], [46, 50, 53, 57], [53, 57, 60, 64], [48, 52, 55, 60],
                     [55, 58, 62, 65], [57, 61, 64, 67]),
      roots: score4(38, 34, 29, 36, 31, 33),
      bassHits: [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0],
      arpPat: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3],
      // [step in the bar, note, length in steps], bars eight to fifteen.
      lead: {
        8:  [[0, 74, 3], [4, 77, 3], [8, 81, 2], [12, 79, 4]],
        9:  [[0, 77, 6], [8, 74, 4], [12, 72, 4]],
        10: [[0, 69, 3], [4, 72, 3], [8, 76, 6]],
        11: [[0, 74, 4], [6, 72, 2], [8, 67, 8]],
        12: [[0, 74, 3], [4, 77, 3], [8, 81, 4]],
        13: [[0, 77, 4], [4, 74, 4], [8, 70, 8]],
        14: [[0, 74, 4], [4, 77, 4], [8, 79, 8]],
        15: [[0, 81, 12]]
      }
    },
    {
      name: 'BLEND', bpm: 132,
      chords: score4([55, 59, 62, 66], [52, 55, 59, 62], [48, 52, 55, 59], [50, 54, 57, 62],
                     [57, 60, 64, 67], [50, 54, 57, 60]),
      roots: score4(31, 28, 36, 38, 33, 38),
      bassHits: [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1],
      arpPat: [0, 1, 2, 3, 2, 1],
      lead: {
        8:  [[0, 71, 2], [2, 74, 2], [4, 79, 4], [8, 78, 2], [10, 74, 6]],
        9:  [[0, 76, 4], [4, 79, 2], [6, 83, 2], [8, 79, 8]],
        10: [[0, 76, 4], [4, 72, 4], [8, 79, 8]],
        11: [[0, 78, 4], [4, 81, 4], [8, 74, 8]],
        12: [[0, 71, 2], [2, 74, 2], [4, 79, 4], [8, 81, 2], [10, 83, 6]],
        13: [[0, 79, 4], [4, 76, 4], [8, 71, 8]],
        14: [[0, 72, 4], [4, 76, 4], [8, 81, 8]],
        15: [[0, 78, 12]]
      }
    }
  ];
  for (var si = 0; si < SCORES.length; si++) SCORES[si].step = (60 / SCORES[si].bpm) / 4;

  var score = SCORES[0], STEP = score.step;
  var wanted = score, pending = null;
  var musicOn = false, timer = null, nextT = 0, step = 0;

  function kick(t, hard) {
    tone({ t: t, type: 'sine', f0: 160, f1: 44, dur: 0.24, a: 0.002, gain: hard ? 0.62 : 0.55, glide: 0.06, bus: musicBus });
    noise({ t: t, type: 'lowpass', f0: 500, f1: 120, dur: 0.02, gain: 0.1, bus: musicBus });
  }
  function clap(t) {
    for (var i = 0; i < 3; i++) {
      noise({ t: t + i * 0.011, type: 'bandpass', f0: 1500, q: 1.2, dur: 0.05, gain: 0.09, bus: musicBus, verb: 0.5 });
    }
    noise({ t: t + 0.03, type: 'bandpass', f0: 1800, q: 0.9, dur: 0.16, gain: 0.08, bus: musicBus, verb: 0.6 });
  }
  function hat(t, open, soft) {
    noise({ t: t, type: 'highpass', f0: 8200, dur: open ? 0.14 : 0.035, a: 0.002,
            gain: (open ? 0.05 : 0.04) * (soft ? 0.6 : 1), bus: musicBus, pan: 0.15 });
  }
  // BLEND's off-beats: a shaker, softer and lower than a hat, panned away
  // from it so the two do not fight.
  function shaker(t) {
    noise({ t: t, type: 'bandpass', f0: 6200, q: 1.4, dur: 0.05, a: 0.012, gain: 0.022, bus: musicBus, pan: -0.3 });
  }
  function bassNote(t, m, len, base) {
    var cut = (base || 260) + tension * 1100;
    tone({ t: t, type: 'sawtooth', f0: midi(m), dur: len, a: 0.004, d: 0.1, s: 0.5, r: 0.05, gain: 0.15, bus: musicBus,
           filter: { f0: cut * 1.8, f1: cut * 0.5, time: 0.12, q: 3 } });
    tone({ t: t, type: 'sine', f0: midi(m), dur: len, a: 0.004, gain: 0.16, bus: musicBus });
  }
  function arpNote(t, m, soft) {
    pluck(t, m, { gain: (soft ? 0.03 : 0.045) + tension * 0.02, open: 2200 + tension * 1400, close: 420, dur: STEP * 1.5,
                  ftime: 0.11, bus: musicBus, delay: 0.55, verb: 0.35, pan: 0.2 });
  }
  // The bell: a triangle with a quiet sine an octave up, through the delay.
  // The lead voice of SURGE and BLEND, and BLEND's arpeggio too.
  function bellNote(t, m, len, soft) {
    tone({ t: t, type: 'triangle', f0: midi(m), dur: len, a: 0.01, d: 0.12, s: 0.55, r: 0.1,
           gain: (soft ? 0.03 : 0.05) + tension * 0.015, bus: musicBus, pan: 0.25, delay: 0.4, verb: 0.45,
           filter: { f0: 2600 + tension * 1200, q: 0.7 } });
    tone({ t: t, type: 'sine', f0: midi(m + 12), dur: len * 0.6, a: 0.01, gain: soft ? 0.012 : 0.02, bus: musicBus, pan: -0.2, verb: 0.5 });
  }
  // SURGE's stabs: the chord an octave up, short, answering the bass.
  function stabChord(t, chord, len) {
    var up = [];
    for (var i = 0; i < chord.length; i++) up.push(chord[i] + 12);
    stab(t, up, { gain: 0.028 + tension * 0.01, dur: len, open: 2400 + tension * 1600, delay: 0.3, bus: musicBus });
  }
  function padChord(t, chord, base) {
    var cut = (base || 520) + tension * 800;
    for (var i = 0; i < chord.length; i++) {
      tone({ t: t, type: 'sawtooth', f0: midi(chord[i] + 12), detune: -9, dur: STEP * 16 + 0.3, a: 0.7, r: 0.5,
             gain: 0.012, bus: musicBus, pan: -0.5, filter: { f0: cut, q: 0.6 }, verb: 0.5 });
      tone({ t: t, type: 'sawtooth', f0: midi(chord[i] + 12), detune: 9, dur: STEP * 16 + 0.3, a: 0.7, r: 0.5,
             gain: 0.012, bus: musicBus, pan: 0.5, filter: { f0: cut, q: 0.6 }, verb: 0.5 });
    }
  }
  function riser(t) {
    noise({ t: t, type: 'highpass', f0: 300, f1: 6000, dur: STEP * 16, a: STEP * 12, gain: 0.05, bus: musicBus, verb: 0.6 });
  }
  // The written top line of a score, if this bar has one.
  function leadNotes(t, S, bar, inBar) {
    var line = S.lead && S.lead[bar];
    if (!line) return;
    for (var i = 0; i < line.length; i++) {
      if (line[i][0] === inBar) bellNote(t, line[i][1], STEP * line[i][2] * 0.95);
    }
  }

  // `s` is the ABSOLUTE step since the music started, so a score can tell
  // one pass of its sixteen bars from the next; `bar` and `inBar` are where
  // it is inside the loop.
  function stepWire(t, s, bar, inBar, pass, S) {
    var chord = S.chords[bar], root = S.roots[bar];
    var drop = (bar === 15);                              // the breath before bar one
    var fill = (bar === 7 || bar === 15) && inBar >= 12;  // the last beat of a half

    if (!drop || inBar === 0) {
      if (inBar % 4 === 0) kick(t, inBar === 0);
      if (fill && inBar % 2 === 0 && inBar % 4 !== 0) kick(t, false);
    }
    if (bar >= 8 && !drop && (inBar === 4 || inBar === 12)) clap(t);
    if (!drop) {
      if (inBar % 2 === 0) hat(t, inBar === 14 && bar % 2 === 1, inBar % 4 !== 0);
      else if (tension > 0.6) hat(t, false, true);
    }
    if (!drop && S.bassHits[inBar]) {
      var oct = (inBar === 14) ? 12 : 0;
      bassNote(t, root + oct, STEP * (inBar === 14 ? 1.2 : 2.2));
    }
    if (bar >= 4 && !(bar >= 14 && pass % 2 === 1)) arpNote(t, chord[S.arpPat[inBar]]);
    if (inBar === 0) padChord(t, chord);
    if (drop && inBar === 0) riser(t);
  }

  function stepSurge(t, s, bar, inBar, pass, S) {
    var chord = S.chords[bar], root = S.roots[bar];
    var drop = (bar === 15);
    var fill = (bar === 7 || bar === 15) && inBar >= 12;
    var second = bar >= 8, leadPass = (pass % 2 === 0);

    if (!drop || inBar === 0) {
      if (inBar % 4 === 0) kick(t, inBar === 0);
      if (inBar === 14 && bar % 2 === 1) kick(t, false);       // the push into the next bar
      if (fill && inBar % 2 === 0 && inBar % 4 !== 0) kick(t, false);
    }
    if (!drop && (inBar === 4 || inBar === 12)) clap(t);
    if (!drop) {
      if (inBar % 2 === 0) hat(t, inBar === 14, inBar % 4 !== 0);
      else if (bar >= 4 || tension > 0.6) hat(t, false, true);  // sixteenths from bar five
    }
    if (!drop && S.bassHits[inBar]) {
      bassNote(t, root + (inBar === 14 ? 12 : 0), STEP * 1.6, 380);
    }
    // The stabs answer the bass on the off-beats of two and four, from bar three.
    if (!drop && bar >= 2 && (inBar === 6 || inBar === 14)) stabChord(t, chord, STEP * 1.5);
    // First half: the plucked arpeggio in eighths, an octave up, from bar
    // three. Second half: the bell line on even passes, the arpeggio (softer)
    // on odd ones, so no two passes in a row are the same.
    if (bar >= 2 && inBar % 2 === 0 && (!second || !leadPass)) {
      arpNote(t, chord[S.arpPat[inBar]] + 12, second);
    }
    if (second && leadPass) leadNotes(t, S, bar, inBar);
    if (inBar === 0) padChord(t, chord, 520);
    if (drop && inBar === 0) riser(t);
  }

  function stepBlend(t, s, bar, inBar, pass, S) {
    var chord = S.chords[bar], root = S.roots[bar];
    var drop = (bar === 15);
    var fill = (bar === 7 || bar === 15) && inBar >= 12;
    var second = bar >= 8, leadPass = (pass % 2 === 0);

    if (!drop || inBar === 0) {
      if (inBar % 4 === 0) kick(t, inBar === 0);
      if (fill && inBar % 2 === 0 && inBar % 4 !== 0) kick(t, false);
    }
    if (!drop && (inBar === 4 || inBar === 12)) clap(t);
    if (!drop) {
      if (inBar % 2 === 0) hat(t, inBar === 14, inBar % 4 !== 0);
      else shaker(t);
      if (tension > 0.6 && inBar % 2 === 1) hat(t, false, true);
    }
    if (!drop && S.bassHits[inBar]) {
      var up = (inBar % 4 === 3 || inBar === 13) ? 12 : 0;      // rolling octaves
      bassNote(t, root + up, STEP * 0.9, 300);
    }
    // The bell arpeggio runs every THREE steps against the four of the bar,
    // so it lands somewhere new each bar and comes round every three bars.
    // First half from bar three; second half only on the passes the hook
    // sits out, and softer there.
    if (bar >= 2 && s % 3 === 0 && (!second || !leadPass)) {
      var k = Math.floor(s / 3) % S.arpPat.length;
      bellNote(t, chord[S.arpPat[k]] + 12, STEP * 2.2, second);
    }
    if (second && leadPass) leadNotes(t, S, bar, inBar);
    if (inBar === 0) padChord(t, chord, 700);
    if (drop && inBar === 0) riser(t);
  }

  var PLAYERS = { WIRE: stepWire, SURGE: stepSurge, BLEND: stepBlend };

  function scheduleStep(t, s) {
    var bar = Math.floor(s / 16) % BARS, inBar = s % 16, pass = Math.floor(s / STEPS);
    PLAYERS[score.name](t, s, bar, inBar, pass, score);
  }

  // Make a score the one playing, from `at` — the delay has to follow the
  // tempo or its dotted eighth lands off the grid.
  function applyScore(sc, at) {
    score = sc; STEP = sc.step;
    if (delayNode) delayNode.delayTime.setValueAtTime((60 / sc.bpm) * 0.75, at || (ctx ? ctx.currentTime : 0));
  }

  // Which score. Playing: swapped at the next bar line. Not playing (music
  // off, or before the first key press unlocks audio): applied at once, so
  // the first bar heard is the right one. Headless, the same — the harness
  // can ask which level the music is on without a speaker.
  function setLevel(n) {
    var i = Math.max(0, Math.min(SCORES.length - 1, (n | 0) - 1));
    wanted = SCORES[i];
    if (musicOn) { pending = (wanted === score) ? null : wanted; }
    else { pending = null; applyScore(wanted); }
    return wanted.name;
  }
  function level() { return SCORES.indexOf(wanted) + 1; }
  function bpmOf(n) { return SCORES[Math.max(0, Math.min(SCORES.length - 1, (n | 0) - 1))].bpm; }
  function scoreNames() {
    var out = [];
    for (var i = 0; i < SCORES.length; i++) out.push(SCORES[i].name);
    return out;
  }

  // If the tab was throttled and the clock ran on without us, do not play
  // everything that was missed in one blurt — Tron's patrol reproduced exactly
  // that after a two-second stall. Skip to where the loop would have been.
  function catchUp(next, at, stp) {
    if (next >= at - 0.25) return { nextT: next, step: stp };
    var missed = Math.ceil((at - next) / STEP);
    return { nextT: next + missed * STEP, step: stp + missed };
  }

  function pump() {
    if (!ctx || !musicOn) return;
    var c = catchUp(nextT, ctx.currentTime, step);
    nextT = c.nextT; step = c.step;
    while (nextT < ctx.currentTime + 0.12) {
      // A new score starts on a bar line, from its own bar one.
      if (pending && step % 16 === 0) { applyScore(pending, nextT); pending = null; step = 0; }
      scheduleStep(nextT, step);
      nextT += STEP;
      step++;
    }
  }

  function startMusic() {
    if (!ctx || musicOn) return;
    if (score !== wanted) applyScore(wanted);
    pending = null;
    musicOn = true;
    nextT = ctx.currentTime + 0.06;
    step = 0;
    timer = setInterval(pump, 25);
  }
  function stopMusic() {
    musicOn = false;
    if (timer) { clearInterval(timer); timer = null; }
  }

  // ---- rendering to a file -------------------------------------------------
  // EVRTEK 2026-09-07: "generate wave files of each sound effect and the
  // background music so I can hear them all offline." They are rendered by
  // the SAME recipes on an OfflineAudioContext, so a sample is exactly what
  // the game plays and not a re-creation of it. The live graph is stashed,
  // the offline one built in its place for the duration of the scheduling —
  // which is synchronous — and then put back before the render runs.
  function renderOffline(seconds, schedule) {
    var Off = hasWindow && (window.OfflineAudioContext || window.webkitOfflineAudioContext);
    if (!Off) return null;
    var rate = 44100;
    var off = new Off(2, Math.ceil(seconds * rate), rate);
    var live = { ctx: ctx, comp: comp, master: master, sfxBus: sfxBus, musicBus: musicBus,
                 duckGain: duckGain, verbSend: verbSend, delaySend: delaySend, delayNode: delayNode,
                 noiseBuf: noiseBuf };
    buildGraph(off);
    try { schedule(0.05); } finally {
      ctx = live.ctx; comp = live.comp; master = live.master; sfxBus = live.sfxBus;
      musicBus = live.musicBus; duckGain = live.duckGain; verbSend = live.verbSend;
      delaySend = live.delaySend; delayNode = live.delayNode; noiseBuf = live.noiseBuf;
    }
    return off.startRendering();
  }
  function renderCue(name, opt, seconds) {
    if (!SFX[name]) return null;
    return renderOffline(seconds || 2.5, function (t0) { SFX[name](t0, opt || {}); });
  }
  // A sequence of cues at given offsets, for the ones that only make sense
  // in a row (the three surge pulses, the clock ticking down).
  function renderSequence(list, seconds) {
    return renderOffline(seconds, function (t0) {
      for (var i = 0; i < list.length; i++) SFX[list[i].name](t0 + list[i].at, list[i].opt || {});
    });
  }
  // `level` picks the score (1, 2 or 3); left out, whichever is current.
  function renderMusic(bars, tense, lvl) {
    var was = tension, wasScore = score, wasStep = STEP, p = null;
    tension = tense || 0;
    if (lvl) { score = SCORES[Math.max(0, Math.min(SCORES.length - 1, (lvl | 0) - 1))]; STEP = score.step; }
    var total = bars * 16;
    try {
      p = renderOffline(total * STEP + 2.5, function (t0) {
        for (var i = 0; i < total; i++) scheduleStep(t0 + i * STEP, i);
      });
    } finally { tension = was; score = wasScore; STEP = wasStep; }
    return p;
  }

  function debug() {
    return { live: !!ctx, state: ctx ? ctx.state : 'none', music: musicOn, step: step,
             score: score.name, level: level(), pending: pending ? pending.name : null,
             tension: tension, prefs: { music: prefs.music, sfx: prefs.sfx } };
  }

  function setMusic(on) {
    prefs.music = !!on; save();
    if (prefs.music) { if (ctx) startMusic(); } else stopMusic();
    return prefs.music;
  }
  function setSfx(on) { prefs.sfx = !!on; save(); return prefs.sfx; }
  function setTension(x) { tension = Math.max(0, Math.min(1, x || 0)); }

  return {
    unlock: unlock, play: play, duck: duck,
    setMusic: setMusic, toggleMusic: function () { return setMusic(!prefs.music); },
    setSfx: setSfx, setTension: setTension,
    setLevel: setLevel, level: level, bpmOf: bpmOf, scores: scoreNames,
    musicOn: function () { return prefs.music; },
    sfxOn: function () { return prefs.sfx; },
    isLive: function () { return !!ctx; },
    playing: function () { return musicOn; },
    history: function () { return history.slice(); },
    names: function () { return Object.keys(SFX); },
    renderCue: renderCue, renderSequence: renderSequence, renderMusic: renderMusic,
    debug: debug,
    // Pure, so the harness can prove them without a speaker.
    envTimes: envTimes, catchUp: catchUp,
    BPM: SCORES[0].bpm, BARS: BARS, STEP: SCORES[0].step
  };
})();
