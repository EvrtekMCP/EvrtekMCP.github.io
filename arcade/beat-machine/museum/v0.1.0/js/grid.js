/* BEAT MACHINE — grid.js
   Sequencer grid, position lights, instruments panel (voice picker + volume
   dial per row), morphs panel (slot 1 live = Tone Selector; slots 2-3 dormant
   by design — voice-specific effects to be decided later). Renders the choir
   currently being conducted; audio always runs both. */
(function () {
  'use strict';
  window.BM = window.BM || {};

  var lightsEl, rowsEl, instEl, morphEl;
  var lightNodes = [], cellNodes = [];   // cellNodes[r][s]
  var playCol = -1;

  BM.grid = {
    build: function () {
      lightsEl = document.getElementById('lights');
      rowsEl = document.getElementById('gridrows');
      instEl = document.getElementById('inst-rows');
      morphEl = document.getElementById('morph-rows');

      // position lights
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

      BM.grid.renderAll();
      BM.on('pattern', BM.grid.renderCells);
      BM.on('choir', BM.grid.renderAll);
    },

    renderAll: function () {
      var c = BM.state.activeChoir;
      document.getElementById('machine').setAttribute('data-choir', c);
      document.body.setAttribute('data-choir', c);  // popup + stage follow too
      for (var r = 0; r < BM.ROWS; r++) {
        var row = BM.state.choirs[c].rows[r];
        var sel = instEl.children[r].querySelector('select');
        var vol = instEl.children[r].querySelector('input');
        sel.value = row.voice;
        vol.value = row.vol;
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
          // C6: chord pip (corner triangle via CSS) instead of text glyphs.
          // Harmony rows keep it on every beat — those cells audibly sound
          // stacked tones too (same semantics the old ••+ tell carried).
          cell.classList.toggle('chord', !!(st && (st.rungs.length > 1 || row.harmony)));
          // C9: state-carrying labels for screen readers
          cell.setAttribute('aria-label', 'Step ' + (s + 1) + ' · ' +
            BM.VOICE_LABELS[row.voice] + ' · ' + (st ? 'on' : 'off'));
        }
        var noteBtn = morphEl.children[r].querySelector('.morph-note');
        noteBtn.classList.toggle('lit', hasAnyBeat(row));
        noteBtn.classList.toggle('harm', !!row.harmony);
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

  // NOTE button is always clickable; 'lit' glow just marks rows carrying beats
  function hasAnyBeat(row) {
    for (var s = 0; s < BM.STEPS; s++) if (row.steps[s]) return true;
    return false;
  }

  function buildInstRow(r) {
    var wrap = document.createElement('div');
    wrap.className = 'inst-row';
    var sel = document.createElement('select');
    sel.title = 'Voice for this line';
    BM.VOICE_ORDER.forEach(function (id) {
      var o = document.createElement('option');
      o.value = id; o.textContent = BM.VOICE_LABELS[id];
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      var c = BM.state.activeChoir;
      BM.setVoice(c, r, sel.value);
      BM.audio.auditionRung(c, r, 0, 0.9);
    });
    var vol = document.createElement('input');
    vol.type = 'range'; vol.min = 0; vol.max = 1; vol.step = 0.01;
    vol.className = 'vol-dial';
    vol.title = 'Line volume (independent of master)';
    vol.addEventListener('input', function () {
      BM.audio.setRowVol(BM.state.activeChoir, r, parseFloat(vol.value));
    });
    wrap.appendChild(sel); wrap.appendChild(vol);
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
        var tell = document.createElement('span');
        tell.className = 'tell';
        cell.appendChild(tell);
        cell.addEventListener('click', function () {
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

  function buildMorphRow(r) {
    var wrap = document.createElement('div');
    wrap.className = 'morph-row';
    var note = document.createElement('button');
    note.type = 'button';
    note.className = 'morph-btn morph-note';
    note.textContent = 'NOTE';
    note.title = 'Tone Selector — pitch this line';
    note.addEventListener('click', function () {
      BM.tonePicker.open(BM.state.activeChoir, r);
    });
    wrap.appendChild(note);
    for (var i = 2; i <= 3; i++) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'morph-btn dormant';
      d.textContent = '—';
      d.title = 'OFFLINE — future morph (voice-specific effect)';
      d.disabled = true;
      wrap.appendChild(d);
    }
    morphEl.appendChild(wrap);
  }
})();
