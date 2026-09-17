'use strict';
// CROSSWIRE — boot and loop.
//
// EVRTEK 2026-09-07: "can we make the game mobile friendly as well... the game
// would need to detect on load which version is to be used." So boot no longer
// assumes the desktop cabinet: it PICKS a layout, hands it to the renderer, and
// scales the canvas to whatever is holding it. Everything below is arithmetic
// on that one object.
(function () {

  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var kb = CW_INPUT.Keyboard();

  // ?mode=mobile forces the portrait layout on a desktop browser and
  // ?mode=desktop forces the cabinet onto a phone. It is the only way to see
  // either one on the wrong machine, which is the only way to check it.
  var forced = /[?&]mode=(mobile|desktop)/.exec(location.search);
  function pickMode() {
    return CW_LAYOUT.pick({
      coarse: !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches),
      w: window.innerWidth,
      h: window.innerHeight,
      force: forced && forced[1]
    });
  }

  var mode = pickMode();
  var L = CW_LAYOUT.forMode(mode);
  CW_RENDER.setLayout(L);

  var seed = (Date.now() ^ 0x5f3759df) >>> 0;
  var game = new CW_GAME.Game(seed);

  // Player one: keyboard, plus gamepad 0 if one ever shows up. Both feed the
  // same controller, so a pad and the keys are interchangeable mid-game.
  var p1 = new CW_INPUT.Controller(CW_INPUT.KEYS_P1, 0);

  // `s` is CSS pixels per logical pixel and `px` is backing-store pixels per
  // logical pixel. fit() owns both; the touch source needs `s` to turn a
  // client coordinate back into a logical one, and the loop needs `px` for the
  // one transform that keeps every draw call in logical coordinates.
  var s = 1, px = 1;

  // EVRTEK 2026-09-07: a finger is a THIRD command source, not a replacement.
  // Keyboard, pad and touch all stay live on every machine, because there is
  // no telling which one someone will reach for — a laptop with a touchscreen
  // is both.
  var touch = new CW_INPUT.Touch(canvas, {
    toLogical: function (cx, cy) {
      var r = canvas.getBoundingClientRect();
      return { x: (cx - r.left) / s, y: (cy - r.top) / s };
    },
    layout: function () { return L; },
    hits: function () { return CW_RENDER.hits(); },
    // EVRTEK 2026-09-07: a TAP has to tell ON THE PIECE from BESIDE IT, so the
    // touch layer is handed the footprint and the handle — a list of squares,
    // nothing else. It stays ignorant of pieces, rotations and rules, which is
    // what keeps it testable without a board.
    // Cells hanging off the edge are left out: they are not on the screen and
    // a finger cannot land on them.
    // His later ruling the same day added a THIRD list: where the junctions
    // are, so a tap on one can flip it instead of turning the piece. It is
    // supplied in the destructor too, where the touch layer ignores it: a
    // junction under the cross is something you are about to cut.
    // The DRAG uses only `handle`, and none of the rest — the whole screen is
    // a d-pad now, so where the piece IS has stopped mattering to a move. It is
    // still read here in one place for both gestures, because both need it to
    // be the piece as it stood when the finger landed.
    piece: function () {
      if (game.screen !== 'play' || game.over) return null;
      var cells = [], i, x, y;
      var junctions = game.junctionCells();
      if (game.snipMode) {
        var cross = game.destroyFootprint();
        for (i = 0; i < cross.length; i++) cells.push({ x: cross[i][0], y: cross[i][1] });
        return { cells: cells, handle: { x: game.cursor.x, y: game.cursor.y },
                 snip: true, junctions: junctions };
      }
      var o = game.origin(), shape = game.feed.shape();
      for (i = 0; i < shape.cells.length; i++) {
        x = o.x + shape.cells[i][0];
        y = o.y + shape.cells[i][1];
        if (game.board.inside(x, y)) cells.push({ x: x, y: y });
      }
      return { cells: cells, handle: { x: game.cursor.x, y: game.cursor.y },
               snip: false, junctions: junctions };
    }
  });

  // Deliberately reachable from the console. It is how the board gets driven
  // by tooling for verification, and how a bug report can carry a seed.
  window.CW = {
    game: game, seed: seed, kb: kb, p1: p1, touch: touch,
    layout: function () { return L; },
    scale: function () { return s; }
  };

  // The toggles live outside the command stream on purpose: they are
  // preferences, not moves, and must never end up in a replay.
  //   G  colourblind symbols     M  music
  // The first key or touch of any kind also UNLOCKS audio, because a browser
  // will not start a sound until the person has touched the page.
  // Matched by LETTER as well as by position, so M is music on a French or
  // Dvorak keyboard too (Tron's patrol). WASD stay positional on purpose.
  function isKey(e, letter, code) { return e.code === code || (e.key || '').toLowerCase() === letter; }
  window.addEventListener('keydown', function (e) {
    CW_AUDIO.unlock();
    if (isKey(e, 'g', 'KeyG')) CW_RENDER.toggleSymbols();
    if (isKey(e, 'm', 'KeyM')) CW_AUDIO.toggleMusic();
    // Escape is the keyboard's QUIT chip: press twice to leave a run.
    if (e.code === 'Escape' || e.key === 'Escape') {
      game.apply(Object.assign(CW_INPUT.blank(), { pick: 'play:quit' }));
    }
  });
  window.addEventListener('pointerdown', function () { CW_AUDIO.unlock(); });

  // iOS GESTURE LOCKDOWN, ported from Paddler's Paradise (Evrtek 2026-09-07).
  // The touch layer speaks pointer events, and cancelling those does NOT stop
  // Safari's own gestures — the back-swipe from the screen edge, the
  // pull-to-refresh, the tab switch. Only a NON-PASSIVE touch listener that
  // calls preventDefault does. Scoped to the canvas, so on the share page the
  // notes underneath still scroll. Audio unlocks here too: iOS grants it most
  // reliably from exactly this handler.
  ['touchstart', 'touchmove', 'touchend'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (e.target !== canvas) return;
      e.preventDefault();
      if (ev !== 'touchmove') CW_AUDIO.unlock();
    }, { passive: false });
  });

  // EVRTEK 2026-09-07: "should be locked in portrait on phones." A page can
  // only ASK: iOS Safari has no orientation lock at all, and Android grants
  // it only in fullscreen. So this is best effort, silent when refused, and
  // the real lock is the rotate card — sideways, the game draws "turn your
  // phone" and ignores every touch until it is upright again.
  function askPortrait() {
    try {
      if (L.mobile && screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('portrait').catch(function () {});
      }
    } catch (e) { /* not offered here; the rotate card covers it */ }
  }
  window.addEventListener('pointerdown', askPortrait, { once: true });
  // The canvas swallows its own pointer events (it has to, or the page scrolls
  // under a drag), so the window listener above never hears the one touch that
  // matters most on a phone: the first one.
  canvas.addEventListener('pointerdown', function () { CW_AUDIO.unlock(); });

  // The canvas is measured against its PARENT, not the window. The shareable
  // page that tools/build-playtest.js folds the cabinet into wraps it in a
  // sized frame, and measuring the window there draws the game far larger than
  // its box.
  function fit() {
    var host = canvas.parentElement;
    var pw = (host && host.clientWidth) || window.innerWidth;
    var ph = (host && host.clientHeight) || window.innerHeight;
    s = Math.min(pw / L.W, ph / L.H);
    s = Math.max(0.25, Math.min(2, s));

    // The backing store is the logical size times that scale times the device
    // pixel ratio, so a retina phone gets real pixels instead of a blur.
    // Capped at 3: past that the difference is invisible and it costs a phone
    // whole frames.
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.style.width = Math.round(L.W * s) + 'px';
    canvas.style.height = Math.round(L.H * s) + 'px';
    canvas.width = Math.round(L.W * s * dpr);
    canvas.height = Math.round(L.H * s * dpr);
    px = s * dpr;
  }

  // Turning the phone can change which layout applies, not just how big it is
  // drawn. If it does, the renderer is handed the new one and anything the
  // finger was halfway through is dropped — every rect it was aiming at moved.
  function onResize() {
    var m = pickMode();
    if (m !== mode) {
      mode = m;
      L = CW_LAYOUT.forMode(m);
      CW_RENDER.setLayout(L);
      touch.reset();
    }
    fit();
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  fit();

  // EVRTEK 2026-09-14: "yes, let's add a saved high score." The run boundary is
  // watched HERE and nowhere else, because the rules do not know what a device
  // is and the renderer only reads. Two edges are all it takes:
  //   over false -> true   the run ended: record it, once
  //   a live board arrives  a run started: forget the last card's verdict
  // Recording on the edge rather than in the rules is also what keeps a replay
  // or the harness from writing to somebody's browser.
  var wasOver = false, wasPlaying = false;
  function watchRun() {
    var playing = (game.screen === 'play' && !game.over);
    if (game.over && !wasOver) CW_BEST.record(game.diff().id, game.score);
    else if (playing && !wasPlaying) CW_BEST.clearLast();
    wasOver = game.over;
    wasPlaying = playing;
  }

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // PORTRAIT ONLY, EVRTEK'S RULING 2026-09-07. Held sideways, the renderer
    // puts up a card asking for the phone back the right way round and the
    // game stops taking input — but it keeps UPDATING, so the clocks run and
    // turning the phone to dodge a surge is not a strategy.
    var sideways = L.mobile && window.innerWidth > window.innerHeight;
    CW_RENDER.setRotatePrompt(sideways);

    // Both sources are read every frame whatever happens to the result, so a
    // gesture made while the card is up is discarded rather than queued up to
    // fire the moment it comes down.
    p1.update(dt, kb);
    var c = p1.command(), tc = touch.command();
    if (!sideways) game.apply(merge(c, tc));
    game.update(dt);
    watchRun();
    kb.endFrame();

    // One transform, here, and every coordinate the renderer works in stays
    // logical. It is also what makes the layout numbers mean anything.
    ctx.setTransform(px, 0, 0, px, 0, 0);
    CW_RENDER.draw(ctx, game, CW_INPUT.padReport());
    requestAnimationFrame(frame);
  }

  // One frame carries one of each field, so the two sources have to be folded
  // into one command. The finger wins every field it has an opinion about: it
  // cannot be held down by accident the way a key can, so anything it says is
  // deliberate. Everything it says nothing about falls through to the keys.
  function merge(a, b) {
    return {
      dx: b.dx || a.dx,
      dy: b.dy || a.dy,
      rot: b.rot || a.rot,
      commit: b.commit || a.commit,
      destroy: b.destroy || a.destroy,
      to: b.to || a.to || null,
      tap: b.tap || a.tap || null,
      pick: b.pick || a.pick || null,
      tune: b.tune || a.tune || null,
      // The strip (EVRTEK 2026-09-14). `bin` is folded by VALUE rather than by
      // truthiness, because BIN 1 is bin ZERO and `0 || x` throws it away —
      // which is exactly the bug that would leave the first bin unreachable
      // from a finger while the second one worked perfectly.
      shred: b.shred || a.shred,
      bin: (b.bin === 0 || b.bin === 1) ? b.bin
        : ((a.bin === 0 || a.bin === 1) ? a.bin : null)
    };
  }

  requestAnimationFrame(frame);
})();
