/* BEAT MACHINE — kit.js
   The whole kit, synthesized. Pure Web Audio, zero samples, zero deps.
   Recipes follow classic analog drum-voice topologies (oscillator + noise +
   envelope), io-808 studied as reference. "808-style" — original code, no
   manufacturer affiliation.
   Pitch: every trigger takes a semitone offset; frequencies scale by
   2^(semi/12) — the synth equivalent of classic coupled repitch. */
(function () {
  'use strict';
  window.BM = window.BM || {};

  var noiseBuf = null;
  function noise(ctx) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    return src;
  }

  function env(ctx, t, peak, decay, curveStart) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (curveStart || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    return g;
  }

  function osc(ctx, type, freq, t) {
    var o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    return o;
  }

  function kill(nodes, t) {
    for (var i = 0; i < nodes.length; i++) {
      try { nodes[i].stop(t); } catch (e) { /* gain nodes have no stop */ }
    }
  }

  // Each recipe: function(ctx, out, verb, t, rate, vel)
  //   out  = row gain node (dry), verb = reverb send input
  //   rate = 2^(semi/12), vel = 0..1 trigger gain
  // Returns nothing; sources self-terminate.

  function send(ctx, node, verb, amount, vel) {
    if (!verb || amount <= 0) return;
    var g = ctx.createGain();
    g.gain.value = amount * vel;
    node.connect(g); g.connect(verb);
  }

  var RECIPES = {
    kick: function (ctx, out, verb, t, rate, vel) {
      var o = osc(ctx, 'sine', 160 * rate, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(25, 42 * rate), t + 0.09);
      var g = env(ctx, t, 0.85 * vel, 0.48);
      o.connect(g); g.connect(out);
      var n = noise(ctx);
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
      var ng = env(ctx, t, 0.35 * vel, 0.025);
      n.connect(hp); hp.connect(ng); ng.connect(out);
      send(ctx, g, verb, 0.03, vel);
      o.start(t); n.start(t); kill([o, n], t + 0.55);
    },

    snare: function (ctx, out, verb, t, rate, vel) {
      var t1 = osc(ctx, 'triangle', 185 * rate, t);
      var g1 = env(ctx, t, 0.4 * vel, 0.12);
      t1.connect(g1); g1.connect(out);
      var t2 = osc(ctx, 'triangle', 330 * rate, t);
      var g2 = env(ctx, t, 0.28 * vel, 0.09);
      t2.connect(g2); g2.connect(out);
      var n = noise(ctx);
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 1800 * rate; bp.Q.value = 0.9;
      var ng = env(ctx, t, 0.55 * vel, 0.19);
      n.connect(bp); bp.connect(ng); ng.connect(out);
      send(ctx, ng, verb, 0.18, vel);
      t1.start(t); t2.start(t); n.start(t); kill([t1, t2, n], t + 0.25);
    },

    clap: function (ctx, out, verb, t, rate, vel) {
      var n = noise(ctx);
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 1150 * rate; bp.Q.value = 1.4;
      var g = ctx.createGain();
      var p = 1.25 * vel;
      g.gain.setValueAtTime(0.0001, t);
      // three quick spikes, then the tail
      [0, 0.011, 0.022].forEach(function (off, i) {
        g.gain.exponentialRampToValueAtTime(p * (1 - i * 0.18), t + off + 0.002);
        g.gain.exponentialRampToValueAtTime(0.15 * p, t + off + 0.010);
      });
      g.gain.exponentialRampToValueAtTime(p * 0.7, t + 0.035);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      n.connect(bp); bp.connect(g); g.connect(out);
      send(ctx, g, verb, 0.22, vel);
      n.start(t); kill([n], t + 0.32);
    },

    chat: function (ctx, out, verb, t, rate, vel) { hat(ctx, out, verb, t, rate, vel, 0.055, 0.32); },
    ohat: function (ctx, out, verb, t, rate, vel) { hat(ctx, out, verb, t, rate, vel, 0.45, 0.28); },

    ltom: function (ctx, out, verb, t, rate, vel) { tom(ctx, out, verb, t, 120 * rate, 62 * rate, vel); },
    htom: function (ctx, out, verb, t, rate, vel) { tom(ctx, out, verb, t, 210 * rate, 110 * rate, vel); },

    cowbell: function (ctx, out, verb, t, rate, vel) {
      var o1 = osc(ctx, 'square', 540 * rate, t);
      var o2 = osc(ctx, 'square', 810 * rate, t);
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 900 * rate; bp.Q.value = 1.2;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.45 * vel, t);
      g.gain.exponentialRampToValueAtTime(0.12 * vel, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o1.connect(bp); o2.connect(bp); bp.connect(g); g.connect(out);
      send(ctx, g, verb, 0.1, vel);
      o1.start(t); o2.start(t); kill([o1, o2], t + 0.35);
    },

    rim: function (ctx, out, verb, t, rate, vel) {
      var o = osc(ctx, 'square', 1750 * rate, t);
      var og = env(ctx, t, 0.25 * vel, 0.045);
      o.connect(og); og.connect(out);
      var n = noise(ctx);
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 3400 * rate; bp.Q.value = 2;
      var ng = env(ctx, t, 0.4 * vel, 0.05);
      n.connect(bp); bp.connect(ng); ng.connect(out);
      send(ctx, ng, verb, 0.07, vel);
      o.start(t); n.start(t); kill([o, n], t + 0.09);
    },

    shaker: function (ctx, out, verb, t, rate, vel) {
      var n = noise(ctx);
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass';
      hp.frequency.value = 5500 * rate;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.35 * vel, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      n.connect(hp); hp.connect(g); g.connect(out);
      send(ctx, g, verb, 0.05, vel);
      n.start(t); kill([n], t + 0.13);
    },

    bass: function (ctx, out, verb, t, rate, vel) {
      var o1 = osc(ctx, 'triangle', 55 * rate, t);   // A1 — agrees with the ladder
      var o2 = osc(ctx, 'sine', 55 * rate, t);
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1200, t);
      lp.frequency.exponentialRampToValueAtTime(500, t + 0.3);
      var g = env(ctx, t, 0.55 * vel, 0.4, 0.006);
      o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(out);
      send(ctx, g, verb, 0.04, vel);
      o1.start(t); o2.start(t); kill([o1, o2], t + 0.45);
    },

    blip: function (ctx, out, verb, t, rate, vel) {
      var o = osc(ctx, 'square', 440 * rate, t);     // A4 — agrees with the ladder
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
      var g = env(ctx, t, 0.3 * vel, 0.15, 0.003);
      o.connect(lp); lp.connect(g); g.connect(out);
      send(ctx, g, verb, 0.12, vel);
      o.start(t); kill([o], t + 0.2);
    }
  };

  function hat(ctx, out, verb, t, rate, vel, decay, peak) {
    // six squares at metallic ratios -> bandpass -> highpass
    var freqs = [263, 400, 421, 474, 587, 845];
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 10000; bp.Q.value = 0.8;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    var g = env(ctx, t, peak * vel, decay);
    bp.connect(hp); hp.connect(g); g.connect(out);
    send(ctx, g, verb, 0.06, vel);
    var oscs = [];
    for (var i = 0; i < freqs.length; i++) {
      var o = osc(ctx, 'square', freqs[i] * rate, t);
      o.connect(bp); o.start(t); oscs.push(o);
    }
    kill(oscs, t + decay + 0.1);
  }

  function tom(ctx, out, verb, t, f0, f1, vel) {
    var o = osc(ctx, 'sine', f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + 0.22);
    var g = env(ctx, t, 0.8 * vel, 0.38);
    o.connect(g); g.connect(out);
    var n = noise(ctx);
    var bpf = ctx.createBiquadFilter(); bpf.type = 'bandpass';
    bpf.frequency.value = f0 * 2; bpf.Q.value = 0.7;
    var ng = env(ctx, t, 0.1 * vel, 0.05);
    n.connect(bpf); bpf.connect(ng); ng.connect(out);
    send(ctx, g, verb, 0.12, vel);
    o.start(t); n.start(t); kill([o, n], t + 0.45);
  }

  BM.kit = {
    trigger: function (ctx, voiceId, out, verb, when, semi, vel) {
      var recipe = RECIPES[voiceId];
      if (!recipe) return;
      var rate = Math.pow(2, (semi || 0) / 12);
      recipe(ctx, out, verb, when, rate, vel == null ? 1 : vel);
    }
  };
})();
