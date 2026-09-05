// PORTAGE — AUDIO
// ---------------------------------------------------------------------------
// Everything synthesised in WebAudio — no sample files, same law as the art.
// The soundtrack of Algonquin is mostly silence with a loon in it, so that is
// what this is: loon wails on the water, paddle strokes, fire crackle at
// camp, a mosquito at dusk, a fish hitting the line, a wolf somewhere off
// in the dark, and a small chime when something goes right.
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

  /**
   * The one place that knows "the output just came alive". iOS opens the
   * context asynchronously, so the blip AND anything else waiting on a live
   * context (the loading tune) hang off this, not off unlock() returning.
   */
  function opened() { ping(); songResume(); }

  function unlock() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      try {
        ctx.onstatechange = function () { opened(); };
      } catch (e) {}
    }
    if (ctx.state === 'suspended') {
      var pr = ctx.resume();
      if (pr && pr.then) pr.then(opened, function () {});
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
    opened();
  }

  function on() {
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      // heal quietly: this call cannot play, but the next one may
      var pr2 = ctx.resume();
      if (pr2 && pr2.then) pr2.then(opened, function () {});
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

  // dest defaults to the master bus; the tune passes its own so a fade takes
  // the tick down with the notes instead of leaving it ringing at full level.
  function noise(dur, vol, cutoff, delay, dest) {
    if (!on()) return;
    var t = ctx.currentTime + (delay || 0);
    var n = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0), i;
    for (i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    var g = ctx.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(dest || master);
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

  // The strike (note 5): a fish hits the line — a short splash and a blip
  // that RISES, so it is not the beaver's flat tail-slap. Quick, so the
  // strike window it announces is still open when the sound is over.
  function strike() {
    noise(0.08, 0.4, 900);
    tone('sine', 300, 720, 0.14, 0.12, 0.04);
  }

  // The Eastern Wolf (note 8): one howl from somewhere in the deep woods —
  // rises to its note, holds with a slow vibrato, sinks away, and comes
  // back once off the far ridge. Quiet; the wolf never approaches.
  function howl() {
    if (!on()) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator(), g = ctx.createGain();
    var vib = ctx.createOscillator(), vibG = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(310, t);
    o.frequency.linearRampToValueAtTime(380, t + 0.3);
    o.frequency.setValueAtTime(380, t + 0.7);
    o.frequency.linearRampToValueAtTime(260, t + 1.6);
    vib.type = 'sine'; vib.frequency.value = 3.2;
    vibG.gain.value = 9;
    vib.connect(vibG).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.35);
    g.gain.setValueAtTime(0.07, t + 1.0);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 1.8);
    vib.start(t); vib.stop(t + 1.8);
    // the echo off the far ridge, softer still
    tone('sine', 340, 255, 0.9, 0.015, 2.0);
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

  // ---------------------------------------------------------------------------
  // THE LOADING TUNE — "Land of the Silver Birch"
  //
  // A Canadian camp song from the 1920s, origin unknown, no composer of
  // record: the bare melody and the words are public domain. Nothing here is
  // taken from a recording or from anybody's published arrangement — the TUNE
  // is transcribed from two open ABC sources, cross-checked note for note, and
  // the bass, the tick and the envelopes below are ours. It ships INSTRUMENTAL:
  // no lyrics anywhere in the game. They sit in the comments so a reviewer can
  // sing along and check the transcription against the tune he knows.
  //
  // Sources, both plain ABC and melody line only, read 2026-09-04:
  //   abcnotation.com/tunePage?a=trillian.mit.edu/~jc/music/abc/song/Land_of_the_Silver_Birch_Dm/0000
  //     X:1 O:trad Canada M:C L:1/8 K:Dm, Z:2009 John Chambers, "Origin unknown."
  //   abcnotation.com/tunePage?a=www.joe-offer.com/folkinfo/songs/abc/593/0000
  //     X:1 M:4/4 L:1/8 K:G (E aeolian), folkinfo.org, from Singing Together,
  //     Autumn 1971 — the same tune written in half the note values.
  //
  // Transpose the second E->D (E->D, B->A, G->F, e->d, d->c) and the two agree
  // on every pitch: tonic x3 then fifth x3 for the opening phrase, the stepwise
  // d-c-d-c-A-F fall for the third, D-D-D-D-F for the boom. We follow Chambers'
  // note VALUES — 16 bars of 4/4, a quarter note is one beat — in D aeolian,
  // MIDI 62 (D4) to 74 (D5), which is where a square wave sounds like a camp.
  // ---------------------------------------------------------------------------

  var SONG_BPM = 126;            // quarter = 126 (108 dragged, per Evrtek): 64 beats of tune + a bar of air
  var SONG_LOOK = 0.6;           // seconds of notes queued in front of the clock
  var SONG_REFRAIN = 32;         // the beat "Blue lake and rocky shore" starts on
  var SONG_REFRAIN_END = 64;     // ... and the beat the last "boom" is done by

  // [midi, beats], 0 = rest. The lyric each phrase carries is over its notes.
  var SONG_LEAD = [
    // "Land of the sil-ver birch"      D . D  D  | A  A  A .
    [62, 2], [62, 1], [62, 1],
    [69, 1], [69, 1], [69, 2],
    // "Home of the bea-ver"            D . D  D  | A . A .
    [62, 2], [62, 1], [62, 1],
    [69, 2], [69, 2],
    // "Where still the migh-ty moose"  d . c  d  | c  A  F .
    [74, 2], [72, 1], [74, 1],
    [72, 1], [69, 1], [65, 2],
    // "wan-ders at will"               G  F . G  | A . . .
    [67, 1], [65, 2], [67, 1],
    [69, 4],
    // ---- refrain, beat 32 ----
    // "Blue lake and roc-ky shore"     d . c  d  | c  A  F .
    [74, 2], [72, 1], [74, 1],
    [72, 1], [69, 1], [65, 2],
    // "I will re-turn once more"       G  F . G  | A  F  D .
    [67, 1], [65, 2], [67, 1],
    [69, 1], [65, 1], [62, 2],
    // "Boom-did-dy-ah-da" x3           D  DD  D  F
    [62, 1], [62, 0.5], [62, 0.5], [62, 1], [65, 1],
    [62, 1], [62, 0.5], [62, 0.5], [62, 1], [65, 1],
    [62, 1], [62, 0.5], [62, 0.5], [62, 1], [65, 1],
    // "boom"                           D held through the bar
    [62, 4],
    // one bar of air, so the loop breathes instead of butting into itself
    [0, 4]
  ];

  // Bass: the phrase's root and its fifth, two notes to the bar, on a triangle.
  var SONG_BASS = [
    [50, 2], [45, 2],     // Dm   "Land of the silver birch"
    [50, 2], [45, 2],     // Dm
    [50, 2], [45, 2],     // Dm   "Home of the beaver"
    [50, 2], [45, 2],     // Dm
    [53, 2], [48, 2],     // F    "Where still the mighty moose"
    [50, 2], [45, 2],     // Dm
    [55, 2], [53, 2],     // G-F  "wanders at will"
    [50, 4],              // Dm
    [53, 2], [48, 2],     // F    "Blue lake and rocky shore"
    [50, 2], [45, 2],     // Dm
    [55, 2], [53, 2],     // G-F  "I will return once more"
    [50, 2], [45, 2],     // Dm
    [50, 2], [45, 2],     // Dm   boom-diddy-ah-da x3
    [50, 2], [45, 2],
    [50, 2], [45, 2],
    [50, 4],              // Dm   "boom"
    [0, 4]
  ];

  var songGain = null;      // the tune's own fader: notes -> songGain -> master
  var songOn = false;       // is the scheduler running
  var songPending = false;  // asked for before the context opened (iOS)
  var songFading = false;   // a decrescendo is in flight (songOn stays true)
  var songFadeEnd = 0;      // ctx time that decrescendo reaches silence
  var songBase = 0;         // ctx time of beat 0 of the pass being scheduled
  var songFrom = 0;         // ctx time start() last opened the tune
  var songIdx = 0;          // next event within that pass
  var songData = null;      // the flattened event list, built once

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  /** Flatten lead + bass + tick into one list sorted by beat. Pure data. */
  function songBuild() {
    if (songData) return songData;
    var ev = [], t = 0, i, lead, bass;
    for (i = 0; i < SONG_LEAD.length; i++) {
      if (SONG_LEAD[i][0]) ev.push({ b: t, v: 0, n: SONG_LEAD[i][0], d: SONG_LEAD[i][1] });
      t += SONG_LEAD[i][1];
    }
    lead = t;
    for (t = 0, i = 0; i < SONG_BASS.length; i++) {
      if (SONG_BASS[i][0]) ev.push({ b: t, v: 1, n: SONG_BASS[i][0], d: SONG_BASS[i][1] });
      t += SONG_BASS[i][1];
    }
    bass = t;
    // the tick: beats 2 and 4 of the refrain's bars, and nowhere else
    for (t = SONG_REFRAIN; t < SONG_REFRAIN_END; t++) {
      if (t % 4 === 1 || t % 4 === 3) ev.push({ b: t, v: 2, n: 0, d: 1 });
    }
    ev.sort(function (a, b) { return (a.b - b.b) || (a.v - b.v); });
    songData = { ev: ev, beats: Math.max(lead, bass), lead: lead, bass: bass };
    return songData;
  }

  /** One scheduled note: at is absolute ctx time; never called without ctx. */
  function songVoice(e, at, dur) {
    if (e.v === 2) {                       // the tick, through the shared noise
      noise(0.03, 0.05, 3200, Math.max(0, at - ctx.currentTime), songGain);
      return;
    }
    var isLead = e.v === 0;
    var vol = isLead ? 0.18 : 0.14;
    var body = Math.max(0.07, dur * 0.86);        // a hair of air between notes
    var f = mtof(e.n);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = isLead ? 'square' : 'triangle';
    o.frequency.setValueAtTime(f, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.012);          // short attack
    g.gain.setValueAtTime(vol, at + body * 0.72);             // held sustain
    g.gain.exponentialRampToValueAtTime(0.0001, at + body);   // quick release
    o.connect(g).connect(songGain);
    o.start(at); o.stop(at + body + 0.02);
    if (isLead && dur >= 1.5) {                   // a hair of vibrato, held notes only
      var vib = ctx.createOscillator(), vibG = ctx.createGain();
      vib.type = 'sine'; vib.frequency.value = 5.2;
      vibG.gain.value = f * 0.006;
      vib.connect(vibG).connect(o.frequency);
      vib.start(at); vib.stop(at + body + 0.02);
    }
  }

  /**
   * The look-ahead scheduler. Called every frame from ambient() AND hush() —
   * between them one of the two runs in every mode, including the 250 ms
   * fallback ticker, which is the whole reason this is pull and not setInterval.
   */
  function songPump() {
    if (!songOn || !ctx || ctx.state !== 'running' || !songGain) return;
    var now = ctx.currentTime;
    // A FADE IS A DECRESCENDO, so the tune keeps being scheduled all the way
    // down the ramp — the pump is what makes the fade audible, and it is not
    // gated on the mode: ambient() (play) and hush() (everything else) both
    // pull it. Only the ramp reaching silence ends the tune.
    if (songFading && now >= songFadeEnd) { songFinish(); return; }
    var d = songBuild();
    if (!d.ev.length) return;
    var spb = 60 / SONG_BPM, loop = d.beats * spb;
    var ahead = now + SONG_LOOK, guard = 0, e, at;
    // nothing may START after the fader is already at zero
    if (songFading && songFadeEnd < ahead) ahead = songFadeEnd;
    while (guard++ < 512) {
      if (songIdx >= d.ev.length) { songBase += loop; songIdx = 0; }   // next pass
      e = d.ev[songIdx];
      at = songBase + e.b * spb;
      if (at > ahead) break;               // never more than the look-ahead queued
      songIdx++;
      if (at < now - 0.05) continue;       // a stalled tab: skip them, do not dump
      try { songVoice(e, at, e.d * spb); } catch (err) {}
    }
  }

  /**
   * Ramp the tune's own fader from WHERE IT IS NOW to silence over secs, and
   * report the ctx time it lands. Leaves the graph alone: every voice already
   * scheduled and every voice scheduled during the ramp runs through songGain,
   * so they all ride the same slope down.
   */
  function songRamp(secs) {
    var t = 0;
    if (!ctx || !songGain) return 0;
    try {
      t = ctx.currentTime;
      var v = songGain.gain.value;
      if (typeof v !== 'number' || !(v > 0)) v = 1;
      songGain.gain.cancelScheduledValues(t);
      songGain.gain.setValueAtTime(v, t);
      songGain.gain.linearRampToValueAtTime(0.001, t + secs);
    } catch (e) {}
    return t + secs;
  }

  /** The ramp has landed: the tune is over. Stops future scheduling only. */
  function songFinish() {
    songOn = false;
    songFading = false;
    if (!ctx || !songGain) return;
    try {
      var t = ctx.currentTime;
      songGain.gain.cancelScheduledValues(t);
      songGain.gain.setValueAtTime(0, t);
      songGain.gain.value = 0;
    } catch (e) {}
  }

  /**
   * Start the tune. Only ever after unlock() has actually opened the context —
   * if it has not, the ask is held and opened() redeems it. Idempotent.
   * Mute is not our business: muted, this plays into a master gain of zero.
   */
  function songStart() {
    if (!ctx) return false;
    if (ctx.state !== 'running') { songPending = true; return false; }
    songPending = false;
    if (songOn) {
      // already sounding — and if a decrescendo is in flight (back to the
      // shelf off an end card while the fade runs) pull the fader back up
      // instead of leaving the tune playing into a ramp that ends in silence.
      if (songFading) {
        songFading = false;
        try {
          songGain.gain.cancelScheduledValues(ctx.currentTime);
          songGain.gain.setValueAtTime(1, ctx.currentTime);
          songGain.gain.value = 1;
        } catch (e1) {}
      }
      return true;
    }
    try {
      // publish the fader only once it is WIRED: a throw between create and
      // connect would otherwise leave a live-looking gain that reaches nothing
      if (!songGain) { var g0 = ctx.createGain(); g0.connect(master); songGain = g0; }
      songGain.gain.cancelScheduledValues(ctx.currentTime);
      songGain.gain.setValueAtTime(1, ctx.currentTime);
      songGain.gain.value = 1;
    } catch (e) { return false; }
    songBase = ctx.currentTime + 0.08;     // head room to schedule the first beat in
    songFrom = ctx.currentTime;
    songIdx = 0;
    songOn = true;
    songPump();
    return true;
  }

  /**
   * Land in the overworld: a DECRESCENDO over secs, not a stop. The tune goes
   * on being scheduled and goes on sounding the whole way down — the pump
   * (pulled by ambient() in play just as by hush() on the title) keeps filling
   * the look-ahead until the ramp reaches zero, and only then is it over.
   * The old shape stopped the scheduler here, so the last queued 0.6 s ran out
   * and the remaining 4.4 s of ramp descended over silence: a cut, whatever
   * number was passed in.
   */
  function songFadeOut(secs) {
    var s = (typeof secs === 'number' && secs > 0) ? secs : 1.5;
    songPending = false;
    if (!songOn) return;
    // The same tap can start the tune AND pick a park (pointerdown asks for
    // the tune, the hit test lands on a card). Fading a tune that is a
    // heartbeat old just drags its first note across the trip start, so a
    // barely-begun tune is taken away cleanly instead.
    if (!songFading && ctx && (ctx.currentTime - songFrom) < 0.5) { songStop(); return; }
    if (!ctx || !songGain) { songOn = false; songFading = false; return; }
    songFadeEnd = songRamp(s);
    songFading = true;                 // songOn STAYS true: it is still playing
    songPump();                        // and the first notes of the fade go in now
  }

  function songStop() {
    songPending = false;
    songOn = false;
    songFading = false;
    songRamp(0.04);
  }

  function songResume() { if (songPending) songStart(); }

  /** For the Outfitter's status line and the scratch probes. */
  function songInfo() {
    var d = songBuild();
    return { bpm: SONG_BPM, beats: d.beats, bars: d.beats / 4, leadBeats: d.lead,
      bassBeats: d.bass, events: d.ev.length, seconds: d.beats * (60 / SONG_BPM),
      lead: SONG_LEAD.slice(), bass: SONG_BASS.slice(),
      refrainStart: SONG_REFRAIN, refrainEnd: SONG_REFRAIN_END };
  }

  // ambient pass, called each frame with the situation
  function ambient(dt, state) {
    songPump();
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
      (kick && !kick.paused ? ', session held' : '') +
      (songFading ? ', tune fading' : songOn ? ', tune' : '');
  }

  /**
   * Everything paused (cards, map, title): stop the drone, keep the peace.
   * The tune is the exception — the title and the shelf reach the frame loop
   * through here, so this is where its scheduler gets its heartbeat.
   */
  function hush() { setBuzz(0); songPump(); }

  return {
    unlock: unlock, ambient: ambient, paddle: paddle, chime: chime,
    loon: loon, tailSlap: tailSlap, morning: morning, hush: hush, clunk: clunk, chop: chop, feed: feed, hail: hail,
    strike: strike, howl: howl,
    toggleMute: toggleMute, isMuted: function () { return muted; },
    state: state,
    song: {
      start: songStart, stop: songStop, fadeOut: songFadeOut,
      playing: function () { return songOn; }, info: songInfo
    }
  };
})();
