/* BEAT MACHINE — kit.js
   The whole orchestra, synthesized. Pure Web Audio, zero samples, zero deps.
   v0.2.0: curated 10-piece percussion (Q9) + 10 melodic instruments.
   Percussion follows classic analog drum-voice topologies ("808-style" —
   original code, no manufacturer affiliation); instruments add FM (bell,
   e-piano), Karplus-Strong plucked string, formant synthesis, and friends.
   Pitch: every trigger takes a semitone offset; frequencies scale by
   2^(semi/12). Hats carry choke handles (Q2): closed and open are mutually
   exclusive per track. */
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
      try { nodes[i].stop(t); } catch (e) { /* already stopped / not a source */ }
    }
  }

  function send(ctx, node, verb, amount, vel) {
    if (!verb || amount <= 0) return;
    var g = ctx.createGain();
    g.gain.value = amount * vel;
    node.connect(g); g.connect(verb);
  }

  // Karplus-Strong buffers, rendered per pitch and cached (bounded)
  var ksCache = {};
  var ksCount = 0;
  function ksBuffer(ctx, freq) {
    var sr = ctx.sampleRate;
    var key = sr + '_' + Math.round(freq * 10);
    if (ksCache[key]) return ksCache[key];
    if (ksCount > 64) { ksCache = {}; ksCount = 0; }   // simple cap
    var len = Math.floor(sr * 1.1);
    var buf = ctx.createBuffer(1, len, sr);
    var d = buf.getChannelData(0);
    var N = Math.max(2, Math.round(sr / freq));
    for (var i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
    for (var j = N; j < len; j++) d[j] = 0.497 * (d[j - N] + d[j - N + 1]);
    ksCache[key] = buf; ksCount++;
    return buf;
  }

  // Each recipe: function(ctx, out, verb, t, rate, vel)
  //   out = row gain (dry) · verb = reverb send bus · rate = 2^(semi/12)
  // A recipe MAY return { choke: fn(t) } — used by the choke registry.

  var RECIPES = {
    // ================= PERCUSSION (10) =================
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

    chat: function (ctx, out, verb, t, rate, vel) { return hat(ctx, out, verb, t, rate, vel, 0.055, 0.32); },
    ohat: function (ctx, out, verb, t, rate, vel) { return hat(ctx, out, verb, t, rate, vel, 0.45, 0.28); },

    // merged TOM (Q9): one drum, the Tone Selector supplies hi/lo
    tom: function (ctx, out, verb, t, rate, vel) {
      var o = osc(ctx, 'sine', 150 * rate, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, 80 * rate), t + 0.22);
      var g = env(ctx, t, 0.8 * vel, 0.38);
      o.connect(g); g.connect(out);
      var n = noise(ctx);
      var bpf = ctx.createBiquadFilter(); bpf.type = 'bandpass';
      bpf.frequency.value = 300 * rate; bpf.Q.value = 0.7;
      var ng = env(ctx, t, 0.1 * vel, 0.05);
      n.connect(bpf); bpf.connect(ng); ng.connect(out);
      send(ctx, g, verb, 0.12, vel);
      o.start(t); n.start(t); kill([o, n], t + 0.45);
    },

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

    crash: function (ctx, out, verb, t, rate, vel) {
      var freqs = [263, 400, 421, 474, 587, 845];
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5200;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 9000; bp.Q.value = 0.5;
      var g = env(ctx, t, 0.5 * vel, 1.8);
      hp.connect(bp); bp.connect(g); g.connect(out);
      send(ctx, g, verb, 0.15, vel);
      var oscs = [];
      for (var i = 0; i < freqs.length; i++) {
        var o = osc(ctx, 'square', freqs[i] * 1.48 * rate, t);
        o.connect(hp); o.start(t); oscs.push(o);
      }
      kill(oscs, t + 1.9);
    },

    laser: function (ctx, out, verb, t, rate, vel) {
      var o = osc(ctx, 'square', 1800 * rate, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, 80 * rate), t + 0.18);
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000;
      var g = env(ctx, t, 0.32 * vel, 0.22);
      o.connect(lp); lp.connect(g); g.connect(out);
      send(ctx, g, verb, 0.08, vel);
      o.start(t); kill([o], t + 0.26);
    },

    // ================= INSTRUMENTS (10) =================
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
      var o = osc(ctx, 'square', 440 * rate, t);     // A4
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
      var g = env(ctx, t, 0.3 * vel, 0.15, 0.003);
      o.connect(lp); lp.connect(g); g.connect(out);
      send(ctx, g, verb, 0.12, vel);
      o.start(t); kill([o], t + 0.2);
    },

    sqlead: function (ctx, out, verb, t, rate, vel) {
      var o = osc(ctx, 'square', 440 * rate, t);     // A4, vibrato eases in
      var vib = osc(ctx, 'sine', 5.5, t);
      var vg = ctx.createGain();
      vg.gain.setValueAtTime(0, t);
      vg.gain.linearRampToValueAtTime(440 * rate * 0.012, t + 0.25);
      vib.connect(vg); vg.connect(o.frequency);
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
      var g = env(ctx, t, 0.3 * vel, 0.5, 0.008);
      o.connect(lp); lp.connect(g); g.connect(out);
      send(ctx, g, verb, 0.1, vel);
      o.start(t); vib.start(t); kill([o, vib], t + 0.55);
    },

    stab: function (ctx, out, verb, t, rate, vel) {
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
      lp.frequency.setValueAtTime(4200, t);
      lp.frequency.exponentialRampToValueAtTime(700, t + 0.18);
      var g = env(ctx, t, 0.24 * vel, 0.32, 0.004);
      lp.connect(g); g.connect(out);
      send(ctx, g, verb, 0.12, vel);
      var oscs = [];
      [0.996, 1, 1.004].forEach(function (d) {
        var o = osc(ctx, 'sawtooth', 220 * rate * d, t);   // A3 cluster
        o.connect(lp); o.start(t); oscs.push(o);
      });
      kill(oscs, t + 0.36);
    },

    pluck: function (ctx, out, verb, t, rate, vel) {
      var src = ctx.createBufferSource();
      src.buffer = ksBuffer(ctx, 220 * rate);        // A3 string
      var g = ctx.createGain(); g.gain.value = 0.55 * vel;
      src.connect(g); g.connect(out);
      send(ctx, g, verb, 0.12, vel);
      src.start(t); kill([src], t + 1.15);
    },

    bell: function (ctx, out, verb, t, rate, vel) {
      var car = osc(ctx, 'sine', 880 * rate, t);     // A5 shimmer
      var mod = osc(ctx, 'sine', 880 * rate * 3.53, t);
      var mg = ctx.createGain();
      mg.gain.setValueAtTime(600 * rate, t);
      mg.gain.exponentialRampToValueAtTime(1, t + 0.9);
      mod.connect(mg); mg.connect(car.frequency);
      var g = env(ctx, t, 0.28 * vel, 1.4, 0.003);
      car.connect(g); g.connect(out);
      send(ctx, g, verb, 0.2, vel);
      car.start(t); mod.start(t); kill([car, mod], t + 1.5);
    },

    epiano: function (ctx, out, verb, t, rate, vel) {
      var car = osc(ctx, 'sine', 440 * rate, t);
      var mod = osc(ctx, 'sine', 440 * rate, t);     // 1:1 FM = warm tine
      var mg = ctx.createGain();
      mg.gain.setValueAtTime(180 * rate, t);
      mg.gain.exponentialRampToValueAtTime(1, t + 0.5);
      mod.connect(mg); mg.connect(car.frequency);
      var g = env(ctx, t, 0.34 * vel, 0.95, 0.004);
      car.connect(g); g.connect(out);
      var tine = osc(ctx, 'sine', 440 * rate * 7, t);
      var tg = env(ctx, t, 0.06 * vel, 0.08);
      tine.connect(tg); tg.connect(out);
      send(ctx, g, verb, 0.16, vel);
      car.start(t); mod.start(t); tine.start(t); kill([car, mod, tine], t + 1.0);
    },

    organ: function (ctx, out, verb, t, rate, vel) {
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.3 * vel, t + 0.012);
      g.gain.setValueAtTime(0.3 * vel, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      g.connect(out);
      send(ctx, g, verb, 0.14, vel);
      var oscs = [];
      [[1, 0.55], [2, 0.3], [3, 0.18], [4, 0.1]].forEach(function (p) {
        var o = osc(ctx, 'sine', 220 * rate * p[0], t);   // A3 drawbars
        var og = ctx.createGain(); og.gain.value = p[1];
        o.connect(og); og.connect(g); o.start(t); oscs.push(o);
      });
      kill(oscs, t + 0.55);
    },

    acid: function (ctx, out, verb, t, rate, vel) {
      var o = osc(ctx, 'sawtooth', 110 * rate, t);   // A2 squelch ("acid-style")
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 14;
      lp.frequency.setValueAtTime(2600, t);
      lp.frequency.exponentialRampToValueAtTime(240, t + 0.24);
      var g = env(ctx, t, 0.32 * vel, 0.34, 0.004);
      o.connect(lp); lp.connect(g); g.connect(out);
      send(ctx, g, verb, 0.07, vel);
      o.start(t); kill([o], t + 0.38);
    },

    choir: function (ctx, out, verb, t, rate, vel) {
      // formant-filtered saws: fixed vocal-tract formants, scaled carrier
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(1.1 * vel, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
      g.connect(out);
      send(ctx, g, verb, 0.25, vel);
      var saws = [
        osc(ctx, 'sawtooth', 220 * rate * 0.997, t),
        osc(ctx, 'sawtooth', 220 * rate * 1.003, t)
      ];
      [[660, 9, 0.5], [1120, 10, 0.35], [2400, 11, 0.18]].forEach(function (f) {
        var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.value = f[0]; bp.Q.value = f[1];
        var fg = ctx.createGain(); fg.gain.value = f[2];
        saws[0].connect(bp); saws[1].connect(bp);
        bp.connect(fg); fg.connect(g);
      });
      saws[0].start(t); saws[1].start(t); kill(saws, t + 0.8);
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
    return {
      choke: function (when) {           // Q2: fast fade, no click
        try {
          // cancelScheduledValues would snap the gain back to the attack
          // peak (or the node default) — hold the current value instead
          if (typeof g.gain.cancelAndHoldAtTime === 'function') {
            g.gain.cancelAndHoldAtTime(when);
          } else {
            g.gain.cancelScheduledValues(when);
            g.gain.setValueAtTime(0.0001, when);
          }
          g.gain.setTargetAtTime(0.0001, when, 0.008);
          kill(oscs, when + 0.06);
        } catch (e) { /* already gone */ }
      }
    };
  }

  BM.kit = {
    // voices that silence their group-mates (Q2)
    CHOKE: { chat: 'hats', ohat: 'hats' },
    trigger: function (ctx, voiceId, out, verb, when, semi, vel) {
      var recipe = RECIPES[voiceId];
      if (!recipe) return null;
      var rate = Math.pow(2, (semi || 0) / 12);
      return recipe(ctx, out, verb, when, rate, vel == null ? 1 : vel) || null;
    }
  };
})();
