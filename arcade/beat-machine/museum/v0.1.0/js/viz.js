/* BEAT MACHINE — viz.js
   Compelling visualizers, Winamp lineage worn openly. Four modes:
   SCOPE (oscilloscope), BARS (spectrum), SPARKS (hit particles),
   PLASMA (blocky sin-field). Canvas 2D, analyser-driven, zero deps.
   All colors come from the active skin's tokens via BM.theme (cached —
   never getComputedStyle per frame). C3: sparks are brave now. */
(function () {
  'use strict';
  window.BM = window.BM || {};

  var canvas, g;
  var W = 560, H = 132;
  var timeData, freqData;
  var particles = [];
  var peaks = [];
  var plasmaT = 0;
  var plasmaCanvas, plasmaG;
  var PW = 96, PH = 24;

  function T() { return (BM.theme && BM.theme.c) || {}; }
  function rgba(rgb, a) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
  }

  BM.viz = {
    MODES: ['SCOPE', 'BARS', 'SPARKS', 'PLASMA'],

    build: function () {
      canvas = document.getElementById('viz');
      g = canvas.getContext('2d');
      var dpr = window.devicePixelRatio || 1;
      var rect = canvas.getBoundingClientRect();
      W = Math.max(300, rect.width); H = Math.max(90, rect.height);
      canvas.width = W * dpr; canvas.height = H * dpr;
      g.scale(dpr, dpr);
      plasmaCanvas = document.createElement('canvas');
      plasmaCanvas.width = PW; plasmaCanvas.height = PH;
      plasmaG = plasmaCanvas.getContext('2d');
    },

    setMode: function (i) {
      BM.state.vizMode = i;
      BM.emit('viz', i);
    },

    onHits: function (ev) {
      // ev: {step, hits:[{c,r,n}]}
      if (BM.state.vizMode !== 2) return;
      var x = ((ev.step + 0.5) / BM.STEPS) * W;
      for (var i = 0; i < ev.hits.length; i++) {
        var h = ev.hits[i];
        var count = 8 + h.n * 3;                       // C3: more of them
        for (var p = 0; p < count; p++) {
          particles.push({
            x: x + (Math.random() - 0.5) * 18,
            y: H - 4,
            vx: (Math.random() - 0.5) * 2.2,
            vy: -(2.4 + Math.random() * 3.4) - h.n * 0.3,
            size: 2.5 + Math.random() * 2.5,           // C3: bigger
            life: 1,
            choir: h.c
          });
        }
      }
    },

    draw: function () {
      var an = BM.audio.analyser;
      var mode = BM.state.vizMode;
      if (!an) { idle(); return; }
      if (!timeData) {
        timeData = new Uint8Array(an.fftSize);
        freqData = new Uint8Array(an.frequencyBinCount);
      }
      if (mode === 0) scope(an);
      else if (mode === 1) bars(an);
      else if (mode === 2) sparks();
      else plasma(an);
      scanlines();
    }
  };

  function idle() {
    var t = T();
    g.fillStyle = t.vizFade || '#04080D';
    g.fillRect(0, 0, W, H);
    g.fillStyle = t.vizB || '#53E6FF';
    g.globalAlpha = 0.55;
    g.font = '12px monospace';
    g.textAlign = 'center';
    g.fillText('— STANDBY —', W / 2, H / 2 + 4);
    g.globalAlpha = 1;
    g.textAlign = 'left';
  }

  function fade(a) {
    var rgb = T().vizFadeRGB || [4, 8, 13];
    g.fillStyle = a >= 1 ? rgba(rgb, 1) : rgba(rgb, a);
    g.fillRect(0, 0, W, H);
  }

  function scanlines() {
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (var y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
  }

  function scope(an) {
    fade(1);
    var col = T().vizB || '#53E6FF';
    an.getByteTimeDomainData(timeData);
    g.strokeStyle = col;
    g.shadowColor = col; g.shadowBlur = 6;
    g.lineWidth = 1.6;
    g.beginPath();
    var n = timeData.length;
    for (var i = 0; i < n; i += 2) {
      var x = (i / n) * W;
      var y = (timeData[i] / 255) * (H - 10) + 5;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.shadowBlur = 0;
  }

  function bars(an) {
    fade(1);
    var t = T();
    an.getByteFrequencyData(freqData);
    var N = 28, gap = 2;
    var bw = (W - (N + 1) * gap) / N;
    if (peaks.length !== N) { peaks = []; for (var k = 0; k < N; k++) peaks.push(0); }
    for (var i = 0; i < N; i++) {
      // exponential bin sampling — musical spread
      var bin = Math.floor(Math.pow(i / N, 1.8) * (freqData.length * 0.7));
      var v = freqData[Math.min(bin, freqData.length - 1)] / 255;
      var h = v * (H - 14);
      var x = gap + i * (bw + gap);
      var grad = g.createLinearGradient(0, H, 0, H - Math.max(h, 1));
      grad.addColorStop(0, t.vizA || '#0F5468');
      grad.addColorStop(1, t.vizB || '#53E6FF');
      g.fillStyle = grad;
      g.fillRect(x, H - h - 4, bw, h);
      if (h > peaks[i]) peaks[i] = h; else peaks[i] = Math.max(0, peaks[i] - 1.4);
      g.fillStyle = t.vizCap || '#FFCC33';
      g.fillRect(x, H - peaks[i] - 6, bw, 2);
    }
  }

  function sparks() {
    fade(0.26);
    var t = T();
    var c0 = t.acc0RGB || [83, 230, 255];
    var c1 = t.acc1RGB || [255, 204, 51];
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.09; p.life -= 0.014;
      if (p.life <= 0 || p.y > H + 6) { particles.splice(i, 1); continue; }
      var rgb = p.choir === 0 ? c0 : c1;
      g.shadowColor = rgba(rgb, p.life);               // C3: they glow now
      g.shadowBlur = 5;
      g.fillStyle = rgba(rgb, Math.min(1, p.life * 1.3));
      g.fillRect(p.x, p.y, p.size, p.size);
    }
    g.shadowBlur = 0;
  }

  function plasma(an) {
    var t = T();
    var a = t.vizARGB || [15, 84, 104];
    var b = t.vizBRGB || [83, 230, 255];
    an.getByteFrequencyData(freqData);
    var amp = 0;
    for (var i = 0; i < 64; i++) amp += freqData[i];
    amp = amp / 64 / 255;
    plasmaT += 0.02 + amp * 0.09;
    var img = plasmaG.createImageData(PW, PH);
    var d = img.data, tt = plasmaT;
    var bright = 0.55 + amp * 0.7;
    for (var y = 0; y < PH; y++) {
      for (var x = 0; x < PW; x++) {
        var v = Math.sin(x * 0.16 + tt) + Math.sin(y * 0.32 + tt * 1.3) +
                Math.sin((x + y) * 0.12 + tt * 0.7) + Math.sin(Math.sqrt(x * x + y * y) * 0.18);
        var c = (v + 4) / 8;                    // 0..1 — lerp skin tokens A→B
        var idx = (y * PW + x) * 4;
        d[idx]     = Math.min(255, (a[0] + (b[0] - a[0]) * c) * bright);
        d[idx + 1] = Math.min(255, (a[1] + (b[1] - a[1]) * c) * bright);
        d[idx + 2] = Math.min(255, (a[2] + (b[2] - a[2]) * c) * bright);
        d[idx + 3] = 255;
      }
    }
    plasmaG.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(plasmaCanvas, 0, 0, PW, PH, 0, 0, W, H);
  }
})();
