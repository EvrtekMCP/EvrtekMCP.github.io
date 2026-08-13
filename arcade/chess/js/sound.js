/* 8-BIT GAMBIT -- WebAudio chiptune sound effects. No audio files:
 * every sound is a square/triangle oscillator or a burst of noise,
 * like nature (Atari) intended.
 */
(function () {
  'use strict';

  var ctx = null;
  var master = null;
  var muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  /* one oscillator note */
  function note(freq, startIn, dur, type, vol, slideTo) {
    if (muted || !ensure()) return;
    var t0 = ctx.currentTime + (startIn || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol || 0.5, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  /* short white-noise burst (captures, crashes) */
  function crunch(startIn, dur, vol, low) {
    if (muted || !ensure()) return;
    var t0 = ctx.currentTime + (startIn || 0);
    var frames = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = low ? 700 : 2400;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.5, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur);
  }

  var SFX = {
    select:    function () { note(520, 0, 0.05, 'square', 0.25); },
    move:      function () { note(240, 0, 0.06, 'square', 0.4, 180); },
    capture:   function () { crunch(0, 0.11, 0.5); note(160, 0, 0.09, 'square', 0.35, 90); },
    castle:    function () { note(240, 0, 0.06, 'square', 0.4); note(320, 0.07, 0.06, 'square', 0.4); },
    check:     function () { note(660, 0, 0.07, 'square', 0.4); note(880, 0.08, 0.1, 'square', 0.4); },
    illegal:   function () { note(110, 0, 0.12, 'sawtooth', 0.4, 80); },
    promote:   function () { [440, 554, 659, 880].forEach(function (f, i) { note(f, i * 0.07, 0.08, 'square', 0.35); }); },
    type:      function () { note(880 + Math.random() * 220, 0, 0.015, 'square', 0.12); },
    blip:      function () { note(440, 0, 0.04, 'square', 0.25); },
    win:       function () {
      [262, 330, 392, 523, 659, 784].forEach(function (f, i) { note(f, i * 0.11, 0.14, 'square', 0.4); });
      note(1047, 0.66, 0.4, 'square', 0.4);
    },
    lose:      function () {
      [392, 370, 349, 330].forEach(function (f, i) { note(f, i * 0.16, 0.18, 'triangle', 0.5); });
      crunch(0.64, 0.3, 0.4, true);
    },
    draw:      function () { [330, 330, 330].forEach(function (f, i) { note(f, i * 0.15, 0.1, 'triangle', 0.4); }); },
    challenger:function () {
      [196, 262, 330, 392].forEach(function (f, i) { note(f, i * 0.09, 0.1, 'square', 0.45); });
      note(523, 0.36, 0.3, 'square', 0.45);
    },
    thinking:  function () { note(200 + Math.random() * 60, 0, 0.03, 'triangle', 0.08); }
  };

  window.Sound = {
    play: function (name) { if (SFX[name]) SFX[name](); },
    setMuted: function (m) { muted = !!m; },
    isMuted: function () { return muted; },
    /* call from a user gesture to unlock audio on first interaction */
    unlock: ensure
  };
})();
