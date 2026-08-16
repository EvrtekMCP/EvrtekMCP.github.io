/* BEAT MACHINE — audio.js
   AudioContext, gain staging, synthesized-impulse reverb, and the lookahead
   scheduler ("two clocks" pattern). Zero dependencies.
   Graph: rowGain[choir][row] -> choirBus[choir] -> compressor -> master
          -> analyser -> destination.   Reverb: sends -> convolver -> comp. */
(function () {
  'use strict';
  window.BM = window.BM || {};

  var ctx = null;
  var master, analyser, comp, verbIn, choirBus = [], rowGains = [[], []];

  var LOOKAHEAD_MS = 25;
  var SCHEDULE_AHEAD = 0.12; // seconds
  var timer = null;
  var nextStepTime = 0;
  var stepIndex = 0;

  // queue of scheduled step events for UI/viz: {time, step, hits:[{c,r,n}]}
  var hitQueue = [];

  function makeImpulse(c) {
    // synthesized stereo room: exponentially decaying noise, ~1.4s
    var len = Math.floor(c.sampleRate * 1.4);
    var buf = c.createBuffer(2, len, c.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
      }
    }
    return buf;
  }

  BM.audio = {
    get ctx() { return ctx; },
    get analyser() { return analyser; },
    get playing() { return BM.state.playing; },
    makeImpulse: makeImpulse,   // shared with fileio's offline render

    init: function () {
      if (ctx) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();

      master = ctx.createGain();
      master.gain.value = BM.state.masterVol;
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 20;
      comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

      comp.connect(master); master.connect(analyser);
      analyser.connect(ctx.destination);

      var convolver = ctx.createConvolver();
      convolver.buffer = makeImpulse(ctx);
      var verbOut = ctx.createGain(); verbOut.gain.value = 0.9;
      verbIn = ctx.createGain(); verbIn.gain.value = 1;
      verbIn.connect(convolver); convolver.connect(verbOut); verbOut.connect(comp);

      for (var c = 0; c < 2; c++) {
        var bus = ctx.createGain();
        bus.gain.value = BM.state.choirs[c].muted ? 0 : 1;
        bus.connect(comp);
        choirBus[c] = bus;
        for (var r = 0; r < BM.ROWS; r++) {
          var g = ctx.createGain();
          g.gain.value = BM.state.choirs[c].rows[r].vol;
          g.connect(bus);
          rowGains[c][r] = g;
        }
      }
      if (ctx.state === 'suspended') ctx.resume();
    },

    setMasterVol: function (v) {
      BM.state.masterVol = v;
      if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
    },
    setRowVol: function (c, r, v) {
      BM.state.choirs[c].rows[r].vol = v;
      if (rowGains[c][r]) rowGains[c][r].gain.setTargetAtTime(v, ctx.currentTime, 0.02);
    },
    setChoirMute: function (c, muted) {
      BM.state.choirs[c].muted = muted;
      if (choirBus[c]) choirBus[c].gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.015);
      BM.emit('mute', { c: c, muted: muted });
    },

    // tiny UI click (skin switcher garnish — jsfxr-style blip, authorized)
    uiBlip: function () {
      if (!ctx) return;
      BM.kit.trigger(ctx, 'blip', comp, null, ctx.currentTime + 0.001, 19, 0.22);
    },

    // one-shot audition (tone picker drags, cell taps, voice changes)
    auditionRung: function (c, r, rung, vel) {
      if (!ctx) return;
      var row = BM.state.choirs[c].rows[r];
      BM.kit.trigger(ctx, row.voice, rowGains[c][r], verbIn,
                     ctx.currentTime + 0.001, BM.rungToSemi(rung), vel == null ? 0.9 : vel);
    },

    start: function () {
      if (!ctx || BM.state.playing) return;
      if (ctx.state === 'suspended') ctx.resume(); // never look alive but mute
      BM.state.playing = true;
      stepIndex = 0;
      nextStepTime = ctx.currentTime + 0.06;
      timer = setInterval(tick, LOOKAHEAD_MS);
      BM.emit('transport', { playing: true });
    },
    stop: function () {
      if (!BM.state.playing) return;
      BM.state.playing = false;
      clearInterval(timer); timer = null;
      hitQueue.length = 0;
      BM.emit('transport', { playing: false });
    },

    // UI thread consumes events whose time has arrived
    dueEvents: function () {
      if (!ctx) return [];
      var due = [];
      while (hitQueue.length && hitQueue[0].time <= ctx.currentTime + 0.005) {
        due.push(hitQueue.shift());
      }
      return due;
    }
  };

  function stepDur() { return 60 / BM.state.bpm / 4; }

  function tick() {
    while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
      scheduleStep(stepIndex, nextStepTime);
      nextStepTime += stepDur();
      stepIndex = (stepIndex + 1) % BM.STEPS;
    }
  }

  function scheduleStep(s, t) {
    // swing: odd 16ths land late
    var when = t + (s % 2 === 1 ? BM.state.swing * stepDur() * 0.5 : 0);
    var hits = [];
    for (var c = 0; c < 2; c++) {
      var choir = BM.state.choirs[c];
      // muted choirs still schedule (bus is silent) so unmute is instant
      for (var r = 0; r < BM.ROWS; r++) {
        var row = choir.rows[r];
        var st = row.steps[s];
        if (!st) continue;
        var i;
        for (i = 0; i < st.rungs.length; i++) {
          BM.kit.trigger(ctx, row.voice, rowGains[c][r], verbIn,
                         when, BM.rungToSemi(st.rungs[i]), 1);
        }
        var harm = BM.harmonyForRungs(st.rungs, row.harmony);
        for (i = 0; i < harm.length; i++) {
          BM.kit.trigger(ctx, row.voice, rowGains[c][r], verbIn,
                         when, BM.rungToSemi(harm[i]), 0.6); // shadows sing softer
        }
        if (!choir.muted) hits.push({ c: c, r: r, n: st.rungs.length + harm.length });
      }
    }
    hitQueue.push({ time: when, step: s, hits: hits });
    // rAF (the consumer) sleeps while the page is hidden — don't hoard history
    while (hitQueue.length > 64) hitQueue.shift();
  }
})();
