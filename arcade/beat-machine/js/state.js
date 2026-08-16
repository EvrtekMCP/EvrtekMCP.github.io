/* BEAT MACHINE — state.js
   Data model, hidden scale ladder, harmony derivation, pub/sub.
   Two choirs x 4 rows x 16 steps. A step is null or { rungs:[...] }.
   Rungs are positions on a hidden natural-minor ladder; rung 0 = the voice
   unmodified (centerline). No music theory is ever shown to the user. */
(function () {
  'use strict';
  window.BM = window.BM || {};

  BM.STEPS = 16;
  BM.ROWS = 4;
  BM.SKINS = ['grid', 'putty', 'club'];
  BM.SKIN_NAMES = { grid: 'GRID EDITION', putty: 'STUDIO PUTTY', club: 'MIDNIGHT CLUB' };
  BM.MAX_TONES = 4;          // user tones per beat (harmony mirrors on top)
  BM.RUNG_MIN = -7;          // -12 semitones
  BM.RUNG_MAX = 7;           // +12 semitones

  // Natural minor intervals (A-minor flavored). rung -> semitone offset.
  var MINOR = [0, 2, 3, 5, 7, 8, 10];
  BM.rungToSemi = function (r) {
    return 12 * Math.floor(r / 7) + MINOR[((r % 7) + 7) % 7];
  };

  // ---- harmony ----------------------------------------------------------
  // Derived live, never stored per-dot. Types (friendly names only in UI):
  //   sweet  = +2 rungs  (diatonic third)
  //   power  = nearest ladder note at/above +7 semitones (fifth-ish)
  //   double = +7 rungs  (exact octave)
  BM.HARMONY_TYPES = [
    { id: 'sweet',  label: 'SWEET',  hint: 'close & warm' },
    { id: 'power',  label: 'POWER',  hint: 'big & open' },
    { id: 'double', label: 'DOUBLE', hint: 'octave shine' }
  ];

  function powerRung(base) {
    var target = BM.rungToSemi(base) + 7;
    var best = base + 1, bestD = Infinity;
    for (var r = base + 1; r <= base + 8; r++) {
      var s = BM.rungToSemi(r);
      var d = Math.abs(s - target);
      if (d < bestD || (d === bestD && s > target)) { best = r; bestD = d; }
    }
    return best;
  }

  BM.harmonyForRungs = function (rungs, type) {
    if (!type) return [];
    var taken = {}, out = [], i, h;
    for (i = 0; i < rungs.length; i++) taken[rungs[i]] = true;
    for (i = 0; i < rungs.length; i++) {
      var b = rungs[i];
      if (type === 'sweet') h = b + 2;
      else if (type === 'double') h = b + 7;
      else h = powerRung(b);
      if (h > BM.RUNG_MAX) h = BM.RUNG_MAX;   // clamp to canvas range
      if (!taken[h]) { taken[h] = true; out.push(h); }
    }
    return out;
  };

  // ---- voices (definitions live in kit.js; ids + labels here) -----------
  BM.VOICE_ORDER = ['kick', 'snare', 'clap', 'chat', 'ohat', 'ltom', 'htom',
                    'cowbell', 'rim', 'shaker', 'bass', 'blip'];
  BM.VOICE_LABELS = {
    kick: 'KICK', snare: 'SNARE', clap: 'CLAP', chat: 'HAT (CLOSED)',
    ohat: 'HAT (OPEN)', ltom: 'TOM (LOW)', htom: 'TOM (HIGH)',
    cowbell: 'COWBELL', rim: 'RIMSHOT', shaker: 'SHAKER',
    bass: 'BASS TONE', blip: 'ARCADE BLIP'
  };

  // ---- state ------------------------------------------------------------
  function makeRow(voice) {
    return { voice: voice, vol: 0.8, harmony: null, steps: emptySteps() };
  }
  function emptySteps() {
    var a = []; for (var i = 0; i < BM.STEPS; i++) a.push(null); return a;
  }
  function makeChoir(voices) {
    return { muted: false, rows: voices.map(makeRow) };
  }

  BM.state = {
    powered: false,
    playing: false,
    bpm: 120,
    swing: 0,          // 0..1
    masterVol: 0.85,
    activeChoir: 0,
    vizMode: 0,
    choirs: [
      makeChoir(['kick', 'snare', 'chat', 'ohat']),
      makeChoir(['bass', 'blip', 'clap', 'cowbell'])
    ]
  };

  // ---- pub/sub ----------------------------------------------------------
  var subs = {};
  BM.on = function (ev, fn) { (subs[ev] = subs[ev] || []).push(fn); };
  BM.emit = function (ev, data) {
    var list = subs[ev] || [];
    for (var i = 0; i < list.length; i++) list[i](data);
  };

  // ---- mutations (single source of truth; everything emits 'pattern') ---
  function step(c, r, s) { return BM.state.choirs[c].rows[r].steps[s]; }

  BM.toggleStep = function (c, r, s) {
    var row = BM.state.choirs[c].rows[r];
    var was = row.steps[s];
    row.steps[s] = was ? null : { rungs: [0] };
    BM.emit('pattern', { c: c, r: r, s: s });
    return row.steps[s];
  };

  BM.addTone = function (c, r, s, rung) {
    rung = clampRung(rung);
    var row = BM.state.choirs[c].rows[r];
    var st = row.steps[s];
    if (!st) { st = row.steps[s] = { rungs: [rung] }; BM.emit('pattern', { c: c, r: r, s: s }); return 0; }
    if (st.rungs.length >= BM.MAX_TONES) return -1;
    if (st.rungs.indexOf(rung) !== -1) return -1;
    st.rungs.push(rung);
    BM.emit('pattern', { c: c, r: r, s: s });
    return st.rungs.length - 1;
  };

  BM.moveTone = function (c, r, s, idx, rung) {
    rung = clampRung(rung);
    var st = step(c, r, s);
    if (!st || idx >= st.rungs.length) return false;
    if (st.rungs[idx] === rung) return false;
    if (st.rungs.indexOf(rung) !== -1) return false;  // occupied
    st.rungs[idx] = rung;
    BM.emit('pattern', { c: c, r: r, s: s });
    return true;
  };

  BM.removeTone = function (c, r, s, idx) {
    var row = BM.state.choirs[c].rows[r];
    var st = row.steps[s];
    if (!st || idx >= st.rungs.length) return;
    st.rungs.splice(idx, 1);
    if (st.rungs.length === 0) row.steps[s] = null;
    BM.emit('pattern', { c: c, r: r, s: s });
  };

  BM.setHarmony = function (c, r, type) {
    BM.state.choirs[c].rows[r].harmony = type; // string id or null
    BM.emit('pattern', { c: c, r: r });
  };

  BM.setVoice = function (c, r, voice) {
    BM.state.choirs[c].rows[r].voice = voice;
    BM.emit('pattern', { c: c, r: r });
  };

  BM.clearChoir = function (c) {
    var rows = BM.state.choirs[c].rows;
    for (var r = 0; r < rows.length; r++) {
      rows[r].steps = emptySteps();
      rows[r].harmony = null;
    }
    BM.emit('pattern', { c: c });
  };

  function clampRung(r) {
    return Math.max(BM.RUNG_MIN, Math.min(BM.RUNG_MAX, Math.round(r)));
  }

  // ---- starter groove (demo content, CLEAR wipes it) --------------------
  BM.loadDemo = function () {
    var s = BM.state, i;
    var d = s.choirs[0].rows, m = s.choirs[1].rows;
    // choir 1: drums
    [0, 4, 8, 12].forEach(function (i) { d[0].steps[i] = { rungs: [0] }; });
    d[0].steps[14] = { rungs: [0] };
    [4, 12].forEach(function (i) { d[1].steps[i] = { rungs: [0] }; });
    for (i = 0; i < 16; i += 2) d[2].steps[i] = { rungs: [0] };
    d[3].steps[10] = { rungs: [0] };
    // choir 2: melody (bass line + blips with a chord), Sweet harmony on blips
    m[0].steps[0] = { rungs: [0] };  m[0].steps[3] = { rungs: [0] };
    m[0].steps[6] = { rungs: [-2] }; m[0].steps[10] = { rungs: [-4] };
    m[0].steps[14] = { rungs: [1] };
    m[1].steps[2] = { rungs: [2] };  m[1].steps[7] = { rungs: [4] };
    m[1].steps[11] = { rungs: [2, 4] }; m[1].steps[15] = { rungs: [5] };
    m[1].harmony = 'sweet';
    m[2].steps[4] = { rungs: [0] };  m[2].steps[12] = { rungs: [0] };
    m[3].steps[8] = { rungs: [0] };
    BM.emit('pattern', {});
  };
})();
