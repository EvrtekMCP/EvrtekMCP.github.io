/* BEAT MACHINE — grid.js
   Sequencer grid, position lights, instruments panel (Q9: PERC | INST dual
   pickers + volume dial per row), morphs panel (NOTE = Tone Selector;
   CRUNCH + SPACE = live per-row dials via popover — Q7/Q8). Renders the
   choir currently being conducted; audio always runs both. */
(function () {
  'use strict';
  window.BM = window.BM || {};

  var lightsEl, rowsEl, instEl, morphEl;
  var lightNodes = [], cellNodes = [];   // cellNodes[r][s]
  var playCol = -1;
  var pop, popSlider, popLabel;          // shared morph popover
  var popCur = null;                     // {c, r, fx} while open

  var FX = [
    { id: 'crunch', label: 'CRUNCH', hint: 'clean → filthy (distortion)' },
    { id: 'space',  label: 'SPACE',  hint: 'dry → cavern (reverb)' }
  ];

  BM.grid = {
    build: function () {
      lightsEl = document.getElementById('lights');
      rowsEl = document.getElementById('gridrows');
      instEl = document.getElementById('inst-rows');
      morphEl = document.getElementById('morph-rows');

      for (var s = 0; s < BM.STEPS; s++) {
        var li = document.createElement('div');
        li.className = 'light' + (s % 4 === 0 ? ' beat1' : '');
        lightsEl.appendChild(li);
        lightNodes.push(li);
      }

      for (var r = 0; r < BM.ROWS; r++) {
        buildInstRow(r);
        buildGridRow(r);
        buildMorphRow(r);
      }
      buildMorphPop();

      BM.grid.renderAll();
      BM.on('pattern', BM.grid.renderCells);
      BM.on('choir', function () { closeMorphPop(); BM.grid.renderAll(); });
      BM.on('morph', BM.grid.renderCells);
    },

    renderAll: function () {
      var c = BM.state.activeChoir;
      document.getElementById('machine').setAttribute('data-choir', c);
      document.body.setAttribute('data-choir', c);  // popup + stage follow too
      for (var r = 0; r < BM.ROWS; r++) {
        var row = BM.state.choirs[c].rows[r];
        var pair = instEl.children[r].querySelectorAll('select');
        var isPerc = BM.PERC_ORDER.indexOf(row.voice) !== -1;
        pair[0].value = isPerc ? row.voice : '';
        pair[1].value = isPerc ? '' : row.voice;
        instEl.children[r].querySelector('input').value = row.vol;
      }
      BM.grid.renderCells();
    },

    renderCells: function () {
      var c = BM.state.activeChoir;
      for (var r = 0; r < BM.ROWS; r++) {
        var row = BM.state.choirs[c].rows[r];
        for (var s = 0; s < BM.STEPS; s++) {
          var st = row.steps[s];
          var cell = cellNodes[r][s];
          cell.classList.toggle('on', !!st);
          // C6 pip: chords, and every beat on a harmony row (stacked tones)
          cell.classList.toggle('chord',
            !!(st && (st.rungs.length > 1 || row.harmony.length)));
          cell.setAttribute('aria-label', 'Step ' + (s + 1) + ' · ' +
            BM.VOICE_LABELS[row.voice] + ' · ' + (st ? 'on' : 'off'));
        }
        var noteBtn = morphEl.children[r].querySelector('.morph-note');
        noteBtn.classList.toggle('lit', hasAnyBeat(row));
        noteBtn.classList.toggle('harm', !!row.harmony.length);
        var fxBtns = morphEl.children[r].querySelectorAll('.morph-fx');
        for (var f = 0; f < FX.length; f++) {
          var amt = row.morphs[FX[f].id];
          fxBtns[f].classList.toggle('lit', amt > 0);
          fxBtns[f].title = FX[f].label + ' — ' + FX[f].hint +
            (amt > 0 ? ' · ' + Math.round(amt * 100) + '%' : ' · off') +
            ' (double-click = off)';
        }
      }
    },

    setPlayhead: function (s) {
      if (playCol >= 0) {
        lightNodes[playCol].classList.remove('lit');
        for (var r = 0; r < BM.ROWS; r++) cellNodes[r][playCol].classList.remove('play');
      }
      playCol = s;
      if (s >= 0) {
        lightNodes[s].classList.add('lit');
        for (var r2 = 0; r2 < BM.ROWS; r2++) cellNodes[r2][s].classList.add('play');
      }
    }
  };

  function hasAnyBeat(row) {
    for (var s = 0; s < BM.STEPS; s++) if (row.steps[s]) return true;
    return false;
  }

  // ---- instruments: PERC | INST pair + volume (Q9, method a) -------------
  function buildPicker(r, list, name, sibling) {
    var sel = document.createElement('select');
    sel.title = name + ' voices';
    sel.setAttribute('aria-label', name + ' voice for line ' + (r + 1));
    var dash = document.createElement('option');
    dash.value = ''; dash.textContent = '—';
    // C11: the dash is visual; screen readers get a real name
    dash.setAttribute('aria-label', 'no ' + name.toLowerCase() + ' voice');
    sel.appendChild(dash);
    list.forEach(function (id) {
      var o = document.createElement('option');
      o.value = id; o.textContent = BM.VOICE_LABELS[id];
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      var c = BM.state.activeChoir;
      if (!sel.value) {                    // picked "—": revert, voice must live
        BM.grid.renderAll();
        return;
      }
      BM.setVoice(c, r, sel.value);
      BM.grid.renderAll();                 // sibling picker resets to "—"
      BM.audio.auditionRung(c, r, 0, 0.9);
    });
    return sel;
  }

  function buildInstRow(r) {
    var wrap = document.createElement('div');
    wrap.className = 'inst-row';
    var pair = document.createElement('div');
    pair.className = 'picker-pair';
    pair.appendChild(buildPicker(r, BM.PERC_ORDER, 'Percussion'));
    pair.appendChild(buildPicker(r, BM.INST_ORDER, 'Instrument'));
    var vol = document.createElement('input');
    vol.type = 'range'; vol.min = 0; vol.max = 1; vol.step = 0.01;
    vol.className = 'vol-dial';
    vol.title = 'Line volume (independent of master)';
    vol.setAttribute('aria-label', 'Volume for line ' + (r + 1));
    vol.addEventListener('input', function () {
      BM.audio.setRowVol(BM.state.activeChoir, r, parseFloat(vol.value));
      BM.emit('settings', {});
    });
    wrap.appendChild(pair); wrap.appendChild(vol);
    instEl.appendChild(wrap);
  }

  function buildGridRow(r) {
    var rowEl = document.createElement('div');
    rowEl.className = 'grid-row';
    cellNodes[r] = [];
    for (var s = 0; s < BM.STEPS; s++) {
      (function (s) {
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell' + (Math.floor(s / 4) % 2 === 0 ? ' bar-a' : ' bar-b');
        cell.addEventListener('click', function (e) {
          // mouse clicks release focus so Space stays the transport key;
          // keyboard activation (detail 0) keeps focus for cell-to-cell work
          if (e.detail) this.blur();
          var c = BM.state.activeChoir;
          var now = BM.toggleStep(c, r, s);
          if (now && BM.state.powered && !BM.state.playing) {
            BM.audio.auditionRung(c, r, 0, 0.9);
          }
        });
        rowEl.appendChild(cell);
        cellNodes[r].push(cell);
      })(s);
    }
    rowsEl.appendChild(rowEl);
  }

  // ---- morphs: NOTE + CRUNCH + SPACE ------------------------------------
  function buildMorphRow(r) {
    var wrap = document.createElement('div');
    wrap.className = 'morph-row';
    var note = document.createElement('button');
    note.type = 'button';
    note.className = 'morph-btn morph-note';
    note.textContent = 'NOTE';
    note.title = 'Tone Selector — pitch this line';
    note.addEventListener('click', function () {
      closeMorphPop();                    // no stale dial above the popup
      BM.tonePicker.open(BM.state.activeChoir, r);
    });
    wrap.appendChild(note);
    FX.forEach(function (fx) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'morph-btn morph-fx';
      b.textContent = fx.label;
      b.addEventListener('click', function () {
        openMorphPop(BM.state.activeChoir, r, fx.id, b);
      });
      b.addEventListener('dblclick', function () {
        BM.audio.setRowMorph(BM.state.activeChoir, r, fx.id, 0);
        if (popCur && popCur.fx === fx.id && popCur.r === r) closeMorphPop();
      });
      wrap.appendChild(b);
    });
    morphEl.appendChild(wrap);
  }

  function buildMorphPop() {
    pop = document.createElement('div');
    pop.id = 'morph-pop';
    popLabel = document.createElement('div');
    popLabel.id = 'morph-pop-label';
    popSlider = document.createElement('input');
    popSlider.type = 'range'; popSlider.min = 0; popSlider.max = 100;
    popSlider.setAttribute('aria-label', 'Morph amount');
    popSlider.addEventListener('input', function () {
      if (!popCur) return;
      BM.audio.setRowMorph(popCur.c, popCur.r, popCur.fx,
                           parseInt(popSlider.value, 10) / 100);
      renderPopLabel();
    });
    pop.appendChild(popLabel); pop.appendChild(popSlider);
    document.body.appendChild(pop);
    document.addEventListener('mousedown', function (e) {
      if (popCur && !pop.contains(e.target) && !e.target.classList.contains('morph-fx')) {
        closeMorphPop();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMorphPop();
    });
    // fixed-positioned popover detaches from its button on scroll/resize
    window.addEventListener('scroll', closeMorphPop, true);
    window.addEventListener('resize', closeMorphPop);
  }

  function renderPopLabel() {
    if (!popCur) return;
    var row = BM.state.choirs[popCur.c].rows[popCur.r];
    var fx = popCur.fx === 'crunch' ? FX[0] : FX[1];
    var amt = Math.round(row.morphs[popCur.fx] * 100);
    var text = fx.label + ' · ' + BM.VOICE_LABELS[row.voice] +
               ' · ' + (amt > 0 ? amt + '%' : 'OFF');
    popLabel.textContent = text;
    popSlider.setAttribute('aria-label', text);   // screen readers hear it too
  }

  function openMorphPop(c, r, fxId, btn) {
    if (popCur && popCur.c === c && popCur.r === r && popCur.fx === fxId) {
      closeMorphPop(); return;             // same button toggles it shut
    }
    popCur = { c: c, r: r, fx: fxId };
    popSlider.value = Math.round(BM.state.choirs[c].rows[r].morphs[fxId] * 100);
    renderPopLabel();
    var b = btn.getBoundingClientRect();
    pop.classList.add('open');
    var pw = pop.offsetWidth;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8,
                     b.left + b.width / 2 - pw / 2)) + 'px';
    pop.style.top = (b.bottom + 6) + 'px';
    popSlider.focus();
  }

  function closeMorphPop() {
    popCur = null;
    if (pop) pop.classList.remove('open');
  }
})();
