'use strict';
// CROSSWIRE — the saved best score.
//
// EVRTEK 2026-09-14, asked whether he wanted one: "yes, let's add a saved high
// score." And, in the same pass, that there is to be no shared board of any
// kind — so NOTHING HERE LEAVES THE DEVICE. It is the browser's own
// localStorage, the same place js/audio.js keeps 'crosswire.audio', and the
// house rule the whole cabinet ships under is unbroken: zero network requests,
// and the game still runs from a double-clicked file.
//
// ONE BEST PER DIFFICULTY, because a CALM score and an EXTREME score are not
// the same number: CALM has no clock to run out and no slab in the way, so a
// single leaderboard across all four would only ever record how long somebody
// was willing to sit on the sandbox.
//
// Every single access is inside a try/catch. A private window, a file:// URL
// with storage disabled, a full quota and a browser with the setting switched
// off all THROW rather than returning nothing, and a game that cannot be
// started because it could not read a high score would be a ridiculous way to
// lose a player.
var CW_BEST = (function () {

  var KEY = 'crosswire.best';

  // The storage is INJECTED rather than reached for, so the harness can prove
  // the round trip, the refusals and a throwing store without a browser. The
  // default is the real one where there is a window and null where there is
  // not — which is the headless case, and there it simply never persists.
  function defaultStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    } catch (e) { /* touching localStorage itself can throw; treat as absent */ }
    return null;
  }

  var store = defaultStorage();

  // The last thing record() decided, kept in memory only. It is what the
  // result card reads to say NEW BEST, and it is deliberately NOT stored:
  // it is about this run, not about this device.
  var lastResult = null;

  function configure(s) { store = s || null; return store; }

  function read() {
    try {
      var raw = store && store.getItem(KEY);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return (o && typeof o === 'object') ? o : {};
    } catch (e) { return {}; }
  }

  function write(all) {
    try {
      if (!store) return false;
      store.setItem(KEY, JSON.stringify(all));
      return true;
    } catch (e) { return false; }
  }

  // Zero means "no best yet", which is the same answer for a device that has
  // never been played on, a browser that refuses to remember anything, and a
  // stored value that has been corrupted into something that is not a number.
  // The screen draws nothing in all three cases, which is the honest reading.
  function get(diffId) {
    var v = read()[diffId];
    return (typeof v === 'number' && isFinite(v) && v > 0) ? Math.floor(v) : 0;
  }

  // A score of zero NEVER records. Quitting on the title screen, or losing
  // before wiring a single line, is not a personal best and must not overwrite
  // a real one — and `isNew` is strictly greater, so equalling your best is
  // not beating it.
  function record(diffId, score) {
    var n = (typeof score === 'number' && isFinite(score)) ? Math.max(0, Math.floor(score)) : 0;
    var prev = get(diffId);
    var isNew = n > 0 && n > prev;
    if (isNew) {
      var all = read();
      all[diffId] = n;
      write(all);
    }
    lastResult = { diffId: diffId, best: isNew ? n : prev, isNew: isNew, score: n };
    return lastResult;
  }

  function last() { return lastResult; }
  function clearLast() { lastResult = null; }

  return {
    configure: configure, get: get, record: record,
    last: last, clearLast: clearLast, KEY: KEY
  };
})();
