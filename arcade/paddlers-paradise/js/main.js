// PORTAGE — WIRING
// ---------------------------------------------------------------------------
// Boot order, the input layer (keyboard + one-thumb touch), and the loop.
// Input rule for mobile: drag anywhere to move, tap a drawn button to act —
// nothing needs a second hand, nothing needs a keyboard.
// ---------------------------------------------------------------------------

'use strict';

(function () {

  var keys = {};
  var joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };

  // --- boot ------------------------------------------------------------------
  buildAllSprites();
  buildHDSprites();
  buildWorld();
  buildLandings();
  buildLakePolys();
  newTrip();
  buildObjectives();

  var canvas = document.getElementById('screen');
  initRender(canvas);

  // --- keyboard ---------------------------------------------------------------
  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    keys[e.code] = true;
    AUDIO.unlock();
    if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') { e.preventDefault(); doAction(); }
    if (e.code === 'KeyM') { if (S.mode === 'play' && !OUTFIT.isOpen()) S.mapOpen = !S.mapOpen; }
    if (e.code === 'KeyQ') eatSnack();
    if (e.code === 'KeyL') lookUpNow();
    if (e.code === 'KeyN') AUDIO.toggleMute();
    if (e.code === 'KeyO' && OUTFIT.enabled) OUTFIT.toggle();
    if (e.code === 'KeyF') addFireLog();
    if (e.code === 'KeyV') waveAtVisitor();
    if (S.mode === 'trips' && (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3')) {
      startTrip(+e.code.slice(5) - 1);
    }
    if (e.code === 'Escape') { if (S.mapOpen) S.mapOpen = false; }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    devKey(e.code);
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  window.addEventListener('blur', function () { keys = {}; joy.id = null; R.joyView = null; });

  // --- pointer / touch ----------------------------------------------------------

  function toArt(e) {
    var dpr = R.canvas.width / window.innerWidth;
    return { x: (e.clientX * dpr) / R.scale, y: (e.clientY * dpr) / R.scale };
  }

  function hitButton(p) {
    var k, b;
    for (k in R.buttons) {
      b = R.buttons[k];
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return k;
    }
    return null;
  }

  function fireAction() {
    var pm = S.mode, pcard = S.card;
    doAction();
    if (S.mode !== pm || S.card !== pcard) R.tapLock = performance.now() + 320;
  }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    AUDIO.unlock();
    if (performance.now() < (R.tapLock || 0)) return;
    if (OUTFIT.isOpen()) { OUTFIT.toggle(); return; }
    // capture the pointer so a release outside the window still reaches us —
    // without it a mouse-drag that ended off-canvas left the stick held
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    // never hit-test against a stale frame: if the throttled loop hasn't
    // drawn since the last state change, the buttons may belong to the
    // previous screen
    if (performance.now() - (R.lastDraw || 0) > 50) draw(S, performance.now());
    var p = toArt(e);
    var hit = hitButton(p);
    if (hit === 'action') { fireAction(); return; }
    if (hit === 'map')    { if (S.mapOpen) S.mapOpen = false; else if (S.mode === 'play') S.mapOpen = true; return; }
    if (hit === 'mute')   { AUDIO.toggleMute(); return; }
    if (hit === 'snack')  { eatSnack(); return; }
    if (hit === 'lookup') { lookUpNow(); return; }
    if (hit === 'outfit') { OUTFIT.toggle(); return; }
    if (hit === 'addwood') { addFireLog(); return; }
    if (hit === 'wave') { waveAtVisitor(); return; }
    if (hit && hit.indexOf('trip') === 0) { startTrip(+hit.slice(4)); return; }
    if (S.mode === 'trips') return;   // the shelf: cards or nothing, no stick
    if (S.mode === 'title' || S.mode === 'card' || S.mode === 'fish') { fireAction(); return; }
    if (S.mode === 'scene') return;   // scenes: only the pill acts, and no stick is born
    if (S.mapOpen) { S.mapOpen = false; return; }
    // anywhere else: the thumb-stick is born where the thumb lands
    if (joy.id === null) {
      joy.id = e.pointerId; joy.ox = p.x; joy.oy = p.y; joy.dx = 0; joy.dy = 0;
      R.joyView = { x: p.x, y: p.y, dx: 0, dy: 0 };
    }
  });

  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerId !== joy.id) return;
    e.preventDefault();
    var p = toArt(e);
    var dx = p.x - joy.ox, dy = p.y - joy.oy;
    var len = Math.hypot(dx, dy);
    var max = 16;
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    joy.dx = dx / max; joy.dy = dy / max;
    if (R.joyView) { R.joyView.dx = joy.dx; R.joyView.dy = joy.dy; }
  });

  function endPointer(e) {
    if (e.pointerId !== joy.id) return;
    joy.id = null; joy.dx = 0; joy.dy = 0; R.joyView = null;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // iOS gesture lockdown (#1): non-passive touch handlers on the canvas —
  // preventDefault here is what keeps an aggressive drag from becoming the
  // browser's back-swipe / tab-switch / refresh gesture. The Outfitter is
  // its own DOM and keeps its own scrolling.
  ['touchstart', 'touchmove', 'touchend'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (e.target === canvas) {
        e.preventDefault();
        if (ev !== 'touchmove') AUDIO.unlock();   // iOS unlocks best right here
      }
    }, { passive: false });
  });

  // a tab coming back from the background can return with a suspended
  // context; ask nicely as soon as we are visible again
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) AUDIO.unlock();
  });

  // --- the loop -------------------------------------------------------------------

  var last = performance.now();

  function step(now) {
    // clamp BOTH ends: rAF timestamps can precede a performance.now() taken
    // by the fallback ticker, and a negative dt runs the trip backwards
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    var ix = 0, iy = 0;
    if (keys.KeyW || keys.ArrowUp) iy -= 1;
    if (keys.KeyS || keys.ArrowDown) iy += 1;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1;
    if (keys.KeyD || keys.ArrowRight) ix += 1;
    ix += joy.dx; iy += joy.dy;

    tickGame(dt, { x: ix, y: iy });
    // while the game is paused, the world should also HOLD ITS BREATH: no
    // mosquito drone over the map or a card — but the campfire may crackle
    // through the night card, which is exactly when the fire is on screen
    if (S.mode !== 'play' || S.mapOpen || OUTFIT.isOpen()) {
      if (S.mode === 'card' && S.card && (S.card.kind === 'campNight' || S.card.kind === 'campMorning')) {
        AUDIO.ambient(dt, { onWater: false, dusk: true, campfire: !!S.campfire, mosquito: false });
      } else {
        AUDIO.hush();
      }
    }
    draw(S, now);
    if (DEV) window.__game = S;      // inspectable, dev only
  }

  function frame(now) {
    // schedule FIRST: no exception below may ever kill the loop
    requestAnimationFrame(frame);
    step(now);
  }
  requestAnimationFrame(frame);

  // Belt and braces: browsers throttle or suspend requestAnimationFrame in
  // low-power modes and embedded panes. If no frame has run for a quarter
  // second, this low-rate ticker keeps the trip moving — jankily, but moving,
  // which on a battery-saver phone is the difference between a game and a
  // freeze-frame.
  setInterval(function () {
    if (performance.now() - last > 250) step(performance.now());
  }, 125);

})();
