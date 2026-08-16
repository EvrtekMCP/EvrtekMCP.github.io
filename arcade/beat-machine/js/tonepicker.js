/* BEAT MACHINE — tonepicker.js
   The pop-up Tone Selector: line-and-dot pitch editor (Evrtek's sketch).
   Dots ARE beats — two-way sync with the grid. Centerline = voice unmodified.
   Click to add, drag to bend (live audition), double-click to remove.
   Up to 4 stacked tones per beat (chords). Harmony renders as hollow shadows,
   derived live, not draggable. No music theory on screen. */
(function () {
  'use strict';
  window.BM = window.BM || {};

  var overlay, win, titleEl, stripEl, canvas, g2d, harmBtn, chooserEl;
  var cur = null;            // {c, r} while open
  var drag = null;           // {col, idx} while dragging a user dot
  var playCol = -1;
  var stripCells = [];

  var PAD_X = 14, PAD_Y = 10;
  var CW = 640, CH = 340;    // css pixels
  var colW, rungH;
  var RUNGS = BM.RUNG_MAX - BM.RUNG_MIN + 1;

  BM.tonePicker = {
    build: function () {
      overlay = document.getElementById('tone-overlay');
      win = document.getElementById('tone-window');
      titleEl = document.getElementById('tone-title');
      stripEl = document.getElementById('tone-strip');
      canvas = document.getElementById('tone-canvas');
      harmBtn = document.getElementById('harm-btn');
      chooserEl = document.getElementById('harm-chooser');
      g2d = canvas.getContext('2d');

      var dpr = window.devicePixelRatio || 1;
      canvas.width = CW * dpr; canvas.height = CH * dpr;
      canvas.style.width = CW + 'px'; canvas.style.height = CH + 'px';
      g2d.scale(dpr, dpr);
      colW = (CW - PAD_X * 2) / BM.STEPS;
      rungH = (CH - PAD_Y * 2) / RUNGS;

      for (var s = 0; s < BM.STEPS; s++) {
        (function (s) {
          var cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'strip-cell';
          cell.addEventListener('click', function () {
            if (!cur) return;
            BM.toggleStep(cur.c, cur.r, s);
          });
          stripEl.appendChild(cell);
          stripCells.push(cell);
        })(s);
      }

      document.getElementById('tone-close').addEventListener('click', BM.tonePicker.close);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') BM.tonePicker.close();
      });

      harmBtn.addEventListener('click', function () {
        if (!cur) return;
        var row = BM.state.choirs[cur.c].rows[cur.r];
        if (row.harmony) { BM.setHarmony(cur.c, cur.r, null); renderHarmUI(); }
        else chooserEl.classList.toggle('open');
      });
      BM.HARMONY_TYPES.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'harm-type';
        b.innerHTML = t.label + '<small>' + t.hint + '</small>';
        b.addEventListener('click', function () {
          BM.setHarmony(cur.c, cur.r, t.id);
          chooserEl.classList.remove('open');
          renderHarmUI();
        });
        chooserEl.appendChild(b);
      });

      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
      canvas.addEventListener('dblclick', onDbl);

      BM.on('pattern', function () { if (cur) render(); });
      BM.on('skin', function () { if (cur) render(); });
    },

    open: function (c, r) {
      cur = { c: c, r: r };
      var row = BM.state.choirs[c].rows[r];
      titleEl.textContent = 'TONE SELECTOR — ' + BM.VOICE_LABELS[row.voice] +
                            ' · TRACK ' + (c + 1);
      chooserEl.classList.remove('open');
      renderHarmUI();
      overlay.classList.add('open');
      document.getElementById('tone-close').focus();  // C9: keyboard lands inside
      render();
    },

    close: function () {
      cur = null; drag = null;
      overlay.classList.remove('open');
    },

    get isOpen() { return !!cur; },

    setPlayhead: function (s) {
      if (!cur) return;
      if (s !== playCol) { playCol = s; render(); }
    }
  };

  function row() { return BM.state.choirs[cur.c].rows[cur.r]; }

  function xOf(col) { return PAD_X + col * colW + colW / 2; }
  function yOf(rung) { return PAD_Y + (BM.RUNG_MAX - rung) * rungH + rungH / 2; }
  function colAt(x) {
    return Math.max(0, Math.min(BM.STEPS - 1, Math.floor((x - PAD_X) / colW)));
  }
  function rungAt(y) {
    var r = BM.RUNG_MAX - Math.floor((y - PAD_Y) / rungH);
    return Math.max(BM.RUNG_MIN, Math.min(BM.RUNG_MAX, r));
  }

  function findDot(x, y) {
    var steps = row().steps;
    for (var s = 0; s < BM.STEPS; s++) {
      var st = steps[s];
      if (!st) continue;
      for (var i = 0; i < st.rungs.length; i++) {
        var dx = x - xOf(s), dy = y - yOf(st.rungs[i]);
        if (dx * dx + dy * dy <= 100) return { col: s, idx: i };
      }
    }
    return null;
  }

  function pt(e) {
    var b = canvas.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  }

  function onDown(e) {
    if (!cur) return;
    canvas.setPointerCapture(e.pointerId);
    var p = pt(e);
    var hit = findDot(p.x, p.y);
    if (hit) {
      drag = hit;
    } else {
      var col = colAt(p.x), rung = rungAt(p.y);
      var idx = BM.addTone(cur.c, cur.r, col, rung);
      if (idx >= 0) {
        drag = { col: col, idx: idx };
        BM.audio.auditionRung(cur.c, cur.r, rung, 0.9);
      }
    }
  }

  function onMove(e) {
    if (!cur || !drag) return;
    var p = pt(e);
    var rung = rungAt(p.y);
    if (BM.moveTone(cur.c, cur.r, drag.col, drag.idx, rung)) {
      BM.audio.auditionRung(cur.c, cur.r, rung, 0.8);
    }
  }

  function onUp() { drag = null; }

  function onDbl(e) {
    if (!cur) return;
    var p = pt(e);
    var hit = findDot(p.x, p.y);
    if (hit) BM.removeTone(cur.c, cur.r, hit.col, hit.idx);
  }

  function renderHarmUI() {
    var h = row().harmony;
    if (h) {
      var t = null;
      BM.HARMONY_TYPES.forEach(function (x) { if (x.id === h) t = x; });
      harmBtn.textContent = 'REMOVE HARMONY (' + (t ? t.label : h) + ')';
      harmBtn.classList.add('active');
    } else {
      harmBtn.textContent = '+ HARMONY';
      harmBtn.classList.remove('active');
    }
  }

  // ---- drawing ----------------------------------------------------------
  function theme() { return (BM.theme && BM.theme.c) || {}; }
  function rgba(rgb, a) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
  }

  function render() {
    if (!cur) return;
    var t = theme();
    var accent = t.accent || '#53E6FF';
    var accRGB = t.accentRGB || [83, 230, 255];
    var harmCol = t.harm ? rgba(t.harmRGB, 0.8) : 'rgba(177,138,255,0.8)';
    var steps = row().steps;
    var harmony = row().harmony;
    var hasBeats = false;
    for (var hb = 0; hb < BM.STEPS; hb++) if (steps[hb]) { hasBeats = true; break; }

    g2d.clearRect(0, 0, CW, CH);

    // playhead column
    if (playCol >= 0 && BM.state.playing) {
      g2d.fillStyle = 'rgba(255,255,255,0.05)';
      g2d.fillRect(PAD_X + playCol * colW, PAD_Y, colW, CH - PAD_Y * 2);
    }

    // rung guides — C7: octave rungs stand out and label themselves
    for (var rg = BM.RUNG_MIN; rg <= BM.RUNG_MAX; rg++) {
      var y = yOf(rg);
      var isOct = rg === BM.RUNG_MIN || rg === BM.RUNG_MAX;
      g2d.strokeStyle = rg === 0 ? rgba(accRGB, 0.4)
                       : isOct ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)';
      g2d.lineWidth = rg === 0 ? 2 : 1;
      g2d.beginPath(); g2d.moveTo(PAD_X, y); g2d.lineTo(CW - PAD_X, y); g2d.stroke();
    }
    // column separators
    for (var s = 0; s <= BM.STEPS; s++) {
      var x = PAD_X + s * colW;
      g2d.strokeStyle = s % 4 === 0 ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.05)';
      g2d.lineWidth = 1;
      g2d.beginPath(); g2d.moveTo(x, PAD_Y); g2d.lineTo(x, CH - PAD_Y); g2d.stroke();
    }
    // rung labels (C7): the space teaches itself, no staff required
    g2d.font = '10px monospace';
    g2d.fillStyle = rgba(accRGB, 0.55);
    g2d.fillText('NATURAL', PAD_X + 4, yOf(0) - 5);
    g2d.fillStyle = 'rgba(255,255,255,0.3)';
    g2d.fillText('+OCT', PAD_X + 4, yOf(BM.RUNG_MAX) + 13);
    g2d.fillText('−OCT', PAD_X + 4, yOf(BM.RUNG_MIN) - 5);

    // C7: empty canvas gets a ghost hint instead of a void
    if (!hasBeats) {
      g2d.font = 'bold 13px Tahoma, Verdana, sans-serif';
      g2d.textAlign = 'center';
      g2d.fillStyle = 'rgba(255,255,255,0.22)';
      g2d.fillText('CLICK TO PLACE YOUR FIRST TONE', CW / 2, CH / 2 - 6);
      g2d.font = '10px Tahoma, Verdana, sans-serif';
      g2d.fillText('higher is higher · the bright line is the sound unchanged', CW / 2, CH / 2 + 12);
      g2d.textAlign = 'left';
    }

    // harmony layer first (under user dots)
    if (harmony) {
      drawChains(steps, harmony, true, harmCol);
    }
    drawChains(steps, null, false, accent);

    // strip mirror (C9: labeled)
    for (var s2 = 0; s2 < BM.STEPS; s2++) {
      stripCells[s2].classList.toggle('on', !!steps[s2]);
      stripCells[s2].classList.toggle('play', s2 === playCol && BM.state.playing);
      stripCells[s2].setAttribute('aria-label',
        'Step ' + (s2 + 1) + ' · ' + (steps[s2] ? 'on' : 'off'));
    }
  }

  function dotsFor(st, harmonyType, wantHarmony) {
    if (!st) return null;
    return wantHarmony ? BM.harmonyForRungs(st.rungs, harmonyType) : st.rungs;
  }

  function drawChains(steps, harmonyType, isHarmony, color) {
    var s, i;
    // lines between dots in ADJACENT active columns (nearest-rung pairing);
    // gaps break the chain — separate phrases, per the sketch
    g2d.strokeStyle = color;
    g2d.lineWidth = isHarmony ? 1 : 2;
    for (s = 0; s < BM.STEPS - 1; s++) {
      var a = dotsFor(steps[s], harmonyType, isHarmony);
      var b = dotsFor(steps[s + 1], harmonyType, isHarmony);
      if (!a || !b || !a.length || !b.length) continue;
      for (i = 0; i < a.length; i++) {
        var best = 0, bestD = Infinity;
        for (var j = 0; j < b.length; j++) {
          var d = Math.abs(a[i] - b[j]);
          if (d < bestD) { bestD = d; best = j; }
        }
        g2d.beginPath();
        g2d.moveTo(xOf(s), yOf(a[i]));
        g2d.lineTo(xOf(s + 1), yOf(b[best]));
        g2d.stroke();
      }
    }
    // dots
    for (s = 0; s < BM.STEPS; s++) {
      var rungs = dotsFor(steps[s], harmonyType, isHarmony);
      if (!rungs) continue;
      for (i = 0; i < rungs.length; i++) {
        g2d.beginPath();
        g2d.arc(xOf(s), yOf(rungs[i]), isHarmony ? 4.5 : 6.5, 0, Math.PI * 2);
        if (isHarmony) {
          g2d.strokeStyle = color; g2d.lineWidth = 1.5; g2d.stroke();
        } else {
          g2d.fillStyle = color;
          g2d.shadowColor = color; g2d.shadowBlur = 8;
          g2d.fill();
          g2d.shadowBlur = 0;
        }
      }
    }
  }
})();
