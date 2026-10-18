'use strict';
// ---------------------------------------------------------------------------
// The knobs-and-dials panel.
//
// Off screen until you ask for it — Evrtek's call, and the right one: a tuning
// HUD parked over the game is a tuning HUD you stop seeing past. It slides in
// from the LEFT so the action buttons stay under the right thumb and a change
// can be felt without closing anything.
//
// Generated entirely from TUNE_SPEC. Adding a knob is one line in tune.js.
// ---------------------------------------------------------------------------

var Menu = { open: false, el: null, rows: {}, saveT: 0 };

function menuBuild() {
  var el = document.getElementById('panel');
  Menu.el = el;

  var h = document.createElement('div');
  h.className = 'p-head';
  h.innerHTML = '<span class="p-title">CONTROLS</span>' +
    '<span class="p-ver">' + GAME_VERSION + '</span>' +
    '<button class="p-x" id="p-close" aria-label="Close">✕</button>';
  el.appendChild(h);

  var pre = document.createElement('div');
  pre.className = 'p-presets';
  var names = Object.keys(TUNE_PRESETS);
  for (var i = 0; i < names.length; i++) {
    (function (n) {
      var b = document.createElement('button');
      b.className = 'p-btn';
      b.textContent = n;
      b.onclick = function () { tuneReset(n); menuSync(); tuneSave(); };
      pre.appendChild(b);
    })(names[i]);
  }
  el.appendChild(pre);

  var body = document.createElement('div');
  body.className = 'p-body';
  el.appendChild(body);

  var lastGroup = null;
  for (var j = 0; j < TUNE_SPEC.length; j++) {
    var s = TUNE_SPEC[j];
    if (s.g !== lastGroup) {
      lastGroup = s.g;
      var gh = document.createElement('div');
      gh.className = 'p-group';
      gh.textContent = s.g;
      body.appendChild(gh);
    }
    body.appendChild(menuRow(s));
  }

  var foot = document.createElement('div');
  foot.className = 'p-foot';
  var reset = document.createElement('button');
  reset.className = 'p-btn';
  reset.textContent = 'Reset all';
  reset.onclick = function () { tuneReset(); menuSync(); tuneSave(); layout(); };
  var copy = document.createElement('button');
  copy.className = 'p-btn';
  copy.textContent = 'Copy numbers';
  copy.onclick = function () {
    var out = JSON.stringify(TUNE, null, 1);
    try {
      navigator.clipboard.writeText(out);
      copy.textContent = 'Copied ✓';
      setTimeout(function () { copy.textContent = 'Copy numbers'; }, 1400);
    } catch (e) {
      window.prompt('Copy these:', out);
    }
  };
  foot.appendChild(reset);
  foot.appendChild(copy);
  el.appendChild(foot);

  document.getElementById('p-close').onclick = menuClose;
  menuSync();
}

function menuRow(s) {
  var row = document.createElement('div');
  row.className = 'p-row';

  var lab = document.createElement('div');
  lab.className = 'p-lab';
  lab.innerHTML = '<span>' + s.l + '</span><b class="p-val"></b>';
  row.appendChild(lab);

  var input;
  if (s.t === 'bool') {
    input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'p-chk';
    input.onchange = function () { TUNE[s.k] = input.checked ? 1 : 0; menuAfterChange(s); };
  } else {
    input = document.createElement('input');
    input.type = 'range';
    input.min = s.min; input.max = s.max; input.step = s.s;
    input.className = 'p-rng';
    input.oninput = function () { TUNE[s.k] = parseFloat(input.value); menuAfterChange(s); };
  }
  row.appendChild(input);

  if (s.d) {
    var d = document.createElement('div');
    d.className = 'p-desc';
    d.textContent = s.d;
    row.appendChild(d);
  }

  Menu.rows[s.k] = { input: input, val: lab.querySelector('.p-val'), spec: s };
  return row;
}

function menuAfterChange(s) {
  var r = Menu.rows[s.k];
  r.val.textContent = menuFormat(s, TUNE[s.k]);
  // A few knobs change the furniture rather than the physics.
  if (s.k === 'uiScale' || s.k === 'uiOpacity') { touchLayout(Touch.w, Touch.h); Touch.dirty = true; }
  if (s.k === 'viewH') layout();   // the backbuffer itself changes size
  if (s.k === 'airJumps') P.airJumps = Math.min(P.airJumps, TUNE.airJumps | 0);
  clearTimeout(Menu.saveT);
  Menu.saveT = setTimeout(tuneSave, 250);
}

function menuFormat(s, v) {
  if (s.t === 'bool') return v ? 'on' : 'off';
  var txt = (s.s < 1) ? v.toFixed(s.s < 0.01 ? 3 : 2) : String(Math.round(v));
  return txt + (s.u ? ' ' + s.u : '');
}

function menuSync() {
  for (var k in Menu.rows) {
    var r = Menu.rows[k];
    if (r.spec.t === 'bool') r.input.checked = !!TUNE[k];
    else r.input.value = TUNE[k];
    r.val.textContent = menuFormat(r.spec, TUNE[k]);
  }
}

function menuOpen() {
  Menu.open = true;
  Menu.el.classList.add('open');
  menuSync();
}

function menuClose() {
  Menu.open = false;
  Menu.el.classList.remove('open');
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

function menuToggle() { if (Menu.open) menuClose(); else menuOpen(); }
