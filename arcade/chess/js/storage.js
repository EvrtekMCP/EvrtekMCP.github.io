/* 8-BIT GAMBIT -- profile persistence (localStorage). */
(function () {
  'use strict';

  var KEY = 'gambit8.profile.v1';

  var DEFAULTS = {
    initials: 'AAA',
    avatarId: 'kid',
    rating: 500,
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    rivalId: null,          // current rival on the ladder
    streakVsRival: 0,       // consecutive wins vs current rival
    lossStreakVsRival: 0,
    perChar: {},            // id -> {w,l,d}
    nextColor: 'w',         // player's color next game (alternates)
    muted: false,
    created: false
  };

  /* Values from localStorage are untrusted (partial saves, hand edits,
   * older versions): every field is type-checked and falls back to its
   * default, so corrupt data can never NaN-poison the rating math or
   * crash endGame mid-update. */
  function sanitize(k, v) {
    var d = DEFAULTS[k];
    if (typeof d === 'number') {
      var n = Number(v);
      return (typeof v !== 'boolean' && isFinite(n)) ? n : d;
    }
    if (typeof d === 'boolean') return typeof v === 'boolean' ? v : d;
    if (k === 'initials') {
      return (typeof v === 'string' && /^[A-Z]{1,3}$/.test(v)) ? v : d;
    }
    if (k === 'nextColor') return (v === 'w' || v === 'b') ? v : d;
    if (k === 'avatarId') return (typeof v === 'string' && v) ? v : d;
    if (k === 'rivalId') return (v === null || typeof v === 'string') ? v : d;
    if (k === 'perChar') {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
      var clean = {};
      Object.keys(v).forEach(function (id) {
        var rec = v[id];
        if (rec && typeof rec === 'object') {
          clean[id] = {
            w: isFinite(Number(rec.w)) ? Number(rec.w) : 0,
            l: isFinite(Number(rec.l)) ? Number(rec.l) : 0,
            d: isFinite(Number(rec.d)) ? Number(rec.d) : 0
          };
        }
      });
      return clean;
    }
    return v !== undefined ? v : d;
  }

  function load() {
    var p;
    try {
      p = JSON.parse(localStorage.getItem(KEY));
    } catch (e) { p = null; }
    if (!p || typeof p !== 'object') p = {};
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      out[k] = (p[k] !== undefined) ? sanitize(k, p[k]) : DEFAULTS[k];
    });
    return out;
  }

  function save(profile) {
    try {
      localStorage.setItem(KEY, JSON.stringify(profile));
    } catch (e) { /* private mode etc. -- play on without saving */ }
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    return load();
  }

  window.Storage8 = { load: load, save: save, reset: reset };
})();
