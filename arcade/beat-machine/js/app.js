/* BEAT MACHINE — app.js
   Wiring: power gate, transport, BPM/swing/master, clear (two-click confirm),
   track ovals (body = conduct that choir, LED = mute), visualizer selector,
   and the UI clock (rAF) that consumes scheduled events for lights + sparks. */
(function () {
  'use strict';
  window.BM = window.BM || {};

  // ---- theme cache -------------------------------------------------------
  // Canvas drawing (viz, tone selector) reads skin tokens from here — cached
  // on skin/track change, never getComputedStyle per frame (Yori's order).
  function parseColor(v) {
    v = (v || '').trim();
    var m;
    if ((m = v.match(/^#([0-9a-f]{6})$/i))) {
      return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16),
              parseInt(m[1].slice(4, 6), 16)];
    }
    if ((m = v.match(/^#([0-9a-f]{3})$/i))) {
      return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16),
              parseInt(m[1][2] + m[1][2], 16)];
    }
    if ((m = v.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/))) {
      return [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3])];
    }
    return null;
  }

  BM.theme = {
    c: {},
    refresh: function () {
      var cs = getComputedStyle(document.getElementById('machine'));
      var c = {};
      [['accent', '--accent'], ['acc0', '--acc0'], ['acc1', '--acc1'],
       ['harm', '--harm'], ['vizA', '--viz-a'], ['vizB', '--viz-b'],
       ['vizCap', '--viz-cap'], ['vizFade', '--viz-fade']].forEach(function (p) {
        var raw = cs.getPropertyValue(p[1]).trim();
        c[p[0]] = raw;
        c[p[0] + 'RGB'] = parseColor(raw) || undefined;
      });
      BM.theme.c = c;
    }
  };

  // ---- skins (Part B/C — all three ship, nameplate cycles them) ----------
  BM.applySkin = function (id) {
    if (BM.SKINS.indexOf(id) === -1) return;
    document.body.setAttribute('data-skin', id);
    document.getElementById('machine').setAttribute('data-skin', id);
    try { localStorage.setItem('bm-skin', id); } catch (e) { /* private mode */ }
    BM.theme.refresh();
    var badge = document.getElementById('badge');
    if (badge) badge.title = 'Change skin — current: ' + BM.SKIN_NAMES[id];
    BM.emit('skin', id);
  };

  function initSkin() {
    var saved = null;
    try { saved = localStorage.getItem('bm-skin'); } catch (e) { /* fine */ }
    BM.applySkin(BM.SKINS.indexOf(saved) !== -1 ? saved : 'grid');
  }

  function wireSkin() {
    document.getElementById('badge').addEventListener('click', function () {
      var cur = document.body.getAttribute('data-skin') || 'grid';
      var next = BM.SKINS[(BM.SKINS.indexOf(cur) + 1) % BM.SKINS.length];
      BM.applySkin(next);
      BM.audio.uiBlip();
    });
    BM.on('choir', BM.theme.refresh);   // conducted accent changed
  }

  document.addEventListener('DOMContentLoaded', function () {
    initSkin();
    BM.grid.build();
    BM.tonePicker.build();
    BM.viz.build();
    wireTransport();
    wireTools();
    wireTracks();
    wireViz();
    wireFile();
    wireSkin();
    BM.loadDemo();
    requestAnimationFrame(frame);
  });

  // ---- power gate (autoplay policy; doubles as first play press) --------
  function wireTransport() {
    var overlay = document.getElementById('power-overlay');
    var playBtn = document.getElementById('play');

    document.getElementById('power').addEventListener('click', function () {
      BM.audio.init();
      BM.state.powered = true;
      overlay.classList.add('off');
      BM.audio.start();
    });

    playBtn.addEventListener('click', function () {
      if (!BM.state.powered) return;
      if (BM.state.playing) BM.audio.stop(); else BM.audio.start();
    });

    BM.on('transport', function (t) {
      playBtn.textContent = t.playing ? '■ STOP' : '▸ PLAY';
      if (!t.playing) {
        BM.grid.setPlayhead(-1);
        BM.tonePicker.setPlayhead(-1);
      }
    });
  }

  // ---- bottom tool bar --------------------------------------------------
  function wireTools() {
    var bpmS = document.getElementById('bpm-slider');
    var bpmL = document.getElementById('bpm-lcd');
    bpmS.addEventListener('input', function () {
      BM.state.bpm = parseInt(bpmS.value, 10);
      bpmL.textContent = bpmS.value;
    });

    var swS = document.getElementById('swing-slider');
    var swL = document.getElementById('swing-lcd');
    swS.addEventListener('input', function () {
      BM.state.swing = parseInt(swS.value, 10) / 100;
      swL.textContent = swS.value + '%';
    });

    var maS = document.getElementById('master-slider');
    var maL = document.getElementById('master-lcd');
    maS.addEventListener('input', function () {
      var v = parseInt(maS.value, 10);
      maL.textContent = v;
      if (BM.state.powered) BM.audio.setMasterVol(v / 100);
      else BM.state.masterVol = v / 100;
    });

    // CLEAR — two-click confirm, clears the conducted choir only
    var clear = document.getElementById('clear');
    var armed = null;
    clear.addEventListener('click', function () {
      if (armed) {
        clearTimeout(armed); armed = null;
        clear.classList.remove('arm'); clear.textContent = 'CLEAR';
        BM.clearChoir(BM.state.activeChoir);
      } else {
        clear.classList.add('arm'); clear.textContent = 'SURE?';
        armed = setTimeout(function () {
          armed = null;
          clear.classList.remove('arm'); clear.textContent = 'CLEAR';
        }, 2200);
      }
    });
  }

  // ---- file: save / load / wav export -----------------------------------
  function flash(btn, text, ok) {
    var old = btn.textContent;
    btn.textContent = text;
    btn.classList.add(ok ? 'ok' : 'bad');
    setTimeout(function () {
      btn.textContent = old;
      btn.classList.remove('ok', 'bad');
    }, 1600);
  }

  function wireFile() {
    var saveBtn = document.getElementById('save-btn');
    var loadBtn = document.getElementById('load-btn');
    var wavBtn = document.getElementById('wav-btn');
    var input = document.getElementById('load-input');

    saveBtn.addEventListener('click', function () {
      BM.fileio.saveProject();
      flash(saveBtn, 'SAVED ✓', true);
    });

    loadBtn.addEventListener('click', function () {
      input.value = '';       // same file can be re-picked
      input.click();          // native explorer window
    });

    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var ok = BM.fileio.loadFromText(reader.result);
        flash(loadBtn, ok ? 'LOADED ✓' : 'BAD FILE ✗', ok);
      };
      reader.onerror = function () { flash(loadBtn, 'BAD FILE ✗', false); };
      reader.readAsText(f);
    });

    wavBtn.addEventListener('click', function () {
      if (wavBtn.disabled) return;
      wavBtn.disabled = true;
      var old = wavBtn.textContent;
      wavBtn.textContent = 'RENDER…';
      BM.fileio.exportWav().then(function () {
        wavBtn.disabled = false;
        wavBtn.textContent = old;
        flash(wavBtn, 'SAVED ✓', true);
      }, function () {
        wavBtn.disabled = false;
        wavBtn.textContent = old;
        flash(wavBtn, 'FAILED ✗', false);
      });
    });

    // a loaded project must resync every knob and readout
    BM.on('project-loaded', function () {
      var s = BM.state;
      document.getElementById('bpm-slider').value = s.bpm;
      document.getElementById('bpm-lcd').textContent = s.bpm;
      document.getElementById('swing-slider').value = Math.round(s.swing * 100);
      document.getElementById('swing-lcd').textContent = Math.round(s.swing * 100) + '%';
      document.getElementById('master-slider').value = Math.round(s.masterVol * 100);
      document.getElementById('master-lcd').textContent = Math.round(s.masterVol * 100);
      renderOvals();
    });
  }

  // ---- track ovals ------------------------------------------------------
  function wireTracks() {
    [0, 1].forEach(function (c) {
      var oval = document.getElementById('track' + c);
      var led = document.getElementById('led' + c);
      oval.addEventListener('click', function () {
        if (BM.state.activeChoir !== c) {
          BM.state.activeChoir = c;
          BM.tonePicker.close();
          BM.emit('choir', c);
          renderOvals();
        }
      });
      led.addEventListener('click', function (e) {
        e.stopPropagation();
        var muted = !BM.state.choirs[c].muted;
        if (BM.state.powered) BM.audio.setChoirMute(c, muted);
        else { BM.state.choirs[c].muted = muted; BM.emit('mute', { c: c, muted: muted }); }
      });
    });
    BM.on('mute', renderOvals);
    BM.on('transport', renderOvals);
    renderOvals();
  }

  function renderOvals() {
    [0, 1].forEach(function (c) {
      var disc = document.getElementById('track' + c);
      var led = document.getElementById('led' + c);
      var muted = BM.state.choirs[c].muted;
      disc.classList.toggle('active', BM.state.activeChoir === c);
      disc.classList.toggle('spinning', BM.state.playing && !muted);
      disc.classList.toggle('muted', muted);           // C8: reads across the room
      disc.setAttribute('aria-pressed', BM.state.activeChoir === c);
      led.classList.toggle('on', !muted);
      led.title = muted
        ? 'TRACK ' + (c + 1) + ' muted — click to unmute'
        : 'TRACK ' + (c + 1) + ' singing — click to mute';
      led.setAttribute('aria-label', led.title);        // C9
    });
  }

  // ---- visualizer selector ---------------------------------------------
  function wireViz() {
    var box = document.getElementById('viz-buttons');
    BM.viz.MODES.forEach(function (name, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'viz-btn' + (i === BM.state.vizMode ? ' active' : '');
      b.textContent = name;
      b.title = 'Visualizer: ' + name;
      b.addEventListener('click', function () { BM.viz.setMode(i); });
      box.appendChild(b);
    });
    BM.on('viz', function (mode) {
      var btns = box.children;
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('active', i === mode);
      }
    });
  }

  // ---- UI clock ---------------------------------------------------------
  function frame() {
    var events = BM.audio.dueEvents();
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      BM.grid.setPlayhead(ev.step);
      BM.tonePicker.setPlayhead(ev.step);
      BM.viz.onHits(ev);
    }
    BM.viz.draw();
    requestAnimationFrame(frame);
  }
})();
