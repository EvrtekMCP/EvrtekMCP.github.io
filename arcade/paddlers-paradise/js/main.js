// PORTAGE — WIRING
// ---------------------------------------------------------------------------
// Boot order, the input layer (keyboard + one-thumb touch), and the loop.
// Input rule for mobile: drag anywhere to move, tap a drawn button to act —
// nothing needs a second hand, nothing needs a keyboard.
// ---------------------------------------------------------------------------

'use strict';

/**
 * THE KEY MAP → ONE INPUT (note 22, Evrtek 2026-09-04): "when using WASD, W
 * should always be forward and S backward; A and D should rotate the character
 * or steer left and right. True on the overworld; at camp the current movement
 * makes sense because it is a side view."
 *
 * So under TUNE.steerKeys the KEYS stop being a compass and become a tiller:
 * {throttle, steer}, which tickMove turns into a vector along the tripper's
 * own heading. Off the dial — and always on the camp stage, and anywhere that
 * is not the overworld — they are the v0.9.2 compass, unchanged.
 *
 * The thumb-stick is a DIRECTION under both settings and is simply added to
 * x/y: a direction is a direction, and a thumb pointing north-east means it.
 *
 * Top level, and pure, so the headless probe can press keys the way the loop
 * does instead of testing a copy of this mapping.
 */
function readKeys(keys, joy) {
  var ix = 0, iy = 0, throttle = 0, steer = 0;
  if (TUNE.steerKeys && S.mode === 'play' && !S.campSession) {
    if (keys.KeyW || keys.ArrowUp) throttle += 1;
    if (keys.KeyS || keys.ArrowDown) throttle -= 1;
    if (keys.KeyA || keys.ArrowLeft) steer -= 1;
    if (keys.KeyD || keys.ArrowRight) steer += 1;
  } else {
    if (keys.KeyW || keys.ArrowUp) iy -= 1;
    if (keys.KeyS || keys.ArrowDown) iy += 1;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1;
    if (keys.KeyD || keys.ArrowRight) ix += 1;
  }
  ix += joy.dx; iy += joy.dy;
  return { x: ix, y: iy, throttle: throttle, steer: steer };
}

(function () {

  var keys = {};
  var joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
  var jdrag = null;   // a journal touch in flight: {id, x, y} from pointerdown until pointerup (note 12)

  // --- boot ------------------------------------------------------------------
  buildAllSprites();
  buildHDSprites();
  loadPark(0);           // the first park: world, landings, lake polygons, terrain, and a fresh S on the title
  buildObjectives();     // harmless here; proves the park's chain builds (headless --check catches a typo)

  var canvas = document.getElementById('screen');
  initRender(canvas);

  // The loading tune rides the first gesture: the same press that opens the
  // audio context asks for "Land of the Silver Birch". It is only ever asked
  // for over the title and the park shelf; startPark fades it out. audio.js
  // holds the ask until the context has really opened (iOS resumes async), so
  // this is safe on a gesture that has not unlocked anything yet, and it is
  // idempotent, so every later press is a no-op while the tune is running.
  function songOnGesture() {
    if (S.mode === 'title' || S.mode === 'trips') AUDIO.song.start();
  }

  // --- keyboard ---------------------------------------------------------------
  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    keys[e.code] = true;
    AUDIO.unlock();
    songOnGesture();
    if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') { e.preventDefault(); doAction(); }
    if (e.code === 'KeyM') { if (S.mode === 'play' && !OUTFIT.isOpen() && !S.gearOpen && !S.journalOpen) S.mapOpen = !S.mapOpen; }
    // the journal (note 12): J toggles it (openJournal refuses off the camp
    // stage); arrows and PageUp/Down turn its pages while it is open
    if (e.code === 'KeyJ') { if (S.journalOpen) closeJournal(); else openJournal(); }
    if (S.journalOpen) {
      if (e.code === 'ArrowLeft' || e.code === 'PageUp') { e.preventDefault(); journalTurn(-1); }
      if (e.code === 'ArrowRight' || e.code === 'PageDown') { e.preventDefault(); journalTurn(1); }
    }
    if (e.code === 'KeyQ') eatSnack();
    if (e.code === 'KeyL') lookUpNow();
    if (e.code === 'KeyN') AUDIO.toggleMute();
    if (e.code === 'KeyO' && OUTFIT.enabled) OUTFIT.toggle();
    if (e.code === 'KeyF') addFireLog();
    if (e.code === 'KeyV') waveAtVisitor();
    if (S.mode === 'trips' && (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3')) {
      var pk = +e.code.slice(5) - 1;
      if (PARKS[pk]) startPark(pk);
    }
    // Escape closes the map, else toggles the gear (note 13) — openGear
    // refuses outside open play, so on the shelf or a card it is inert
    if (e.code === 'Escape') { if (S.journalOpen) closeJournal(); else if (S.mapOpen) S.mapOpen = false; else if (S.gearOpen) closeGear(); else openGear(); }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    devKey(e.code);
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  // drop every held key and the stick: on blur, and when a trip is abandoned
  // (a W held through YES, GO HOME would walk the next trip's first frame)
  function resetInput() { keys = {}; joy.id = null; joy.dx = 0; joy.dy = 0; R.joyView = null; jdrag = null; }
  window.addEventListener('blur', resetInput);

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
    var pm = S.mode, pcard = S.card, ptravel = S.travel;
    doAction();
    // a new screen locks every tap for a beat; a travel change (CARRY,
    // LAUNCH, PUT IN, LAND — note 2) locks only the action pill, whose
    // label just changed under the thumb — a second tap on a different pill
    // (a snack) is still the player's to make
    if (S.mode !== pm || S.card !== pcard) R.tapLock = performance.now() + 320;
    else if (S.travel !== ptravel) R.actionLock = performance.now() + 320;
  }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    AUDIO.unlock();
    songOnGesture();
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
    // the journal (note 12): while it is open a touch only STARTS something —
    // a swipe or a tap — and pointerup decides which; no stick is born and
    // a stray tap on the paper must not close it the way it closes the map
    if (S.journalOpen) { jdrag = { id: e.pointerId, x: p.x, y: p.y }; return; }
    var hit = hitButton(p);
    if (hit === 'action') { if (performance.now() < (R.actionLock || 0)) return; fireAction(); return; }
    if (hit === 'map')    { if (S.mapOpen) S.mapOpen = false; else if (S.mode === 'play') S.mapOpen = true; return; }
    if (hit === 'journal') { openJournal(); return; }   // openJournal arms the tap lock itself
    // the gear (note 13): every pill inside it, and the cog that opens it.
    // Opening and closing arm the tap lock so the same touch cannot also
    // land on whatever the panel was covering (RESUME sits over the action
    // button on a phone) — the lock only when it OPENED: while a line is in
    // openGear refuses, and a locked cog tap would swallow the strike after it
    if (hit === 'gear')       { openGear(); if (S.gearOpen) R.tapLock = performance.now() + 320; return; }
    if (hit === 'gearSound')  { AUDIO.toggleMute(); return; }
    // note 22: the one tune dial a player can reach with the Outfitter hidden.
    // OUTFIT.set clamps it and autosaves it as an override, so the choice
    // survives a reload the same way every other dial does.
    if (hit === 'gearKeys')   { OUTFIT.set('steerKeys', TUNE.steerKeys ? 0 : 1); return; }
    if (hit === 'gearQuit')   { S.gearConfirm = true; return; }
    if (hit === 'gearYes')    { quitToMenu(); resetInput(); return; }
    if (hit === 'gearStay' || hit === 'gearResume') { closeGear(); R.tapLock = performance.now() + 320; return; }
    if (hit === 'snack')  { eatSnack(); return; }
    if (hit === 'lookup') { lookUpNow(); return; }
    if (hit === 'outfit') { OUTFIT.toggle(); return; }
    if (hit === 'addwood') { addFireLog(); return; }
    if (hit === 'wave') { waveAtVisitor(); return; }
    if (hit && hit.indexOf('park') === 0) { startPark(+hit.slice(4)); return; }
    if (S.mode === 'trips') return;   // the shelf: cards or nothing, no stick
    if (S.mode === 'title' || S.mode === 'card' || S.mode === 'fish') { fireAction(); return; }
    if (S.mode === 'scene') return;   // scenes: only the pill acts, and no stick is born
    if (S.mapOpen) { S.mapOpen = false; return; }
    if (S.gearOpen) { closeGear(); R.tapLock = performance.now() + 320; return; }   // any other tap = resume, no stick
    // anywhere else: the thumb-stick is born where the thumb lands
    if (joy.id === null) {
      joy.id = e.pointerId; joy.ox = p.x; joy.oy = p.y; joy.dx = 0; joy.dy = 0;
      R.joyView = { x: p.x, y: p.y, dx: 0, dy: 0 };
    }
  });

  canvas.addEventListener('pointermove', function (e) {
    if (jdrag && e.pointerId === jdrag.id) { e.preventDefault(); return; }
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
    if (jdrag && e.pointerId === jdrag.id) { jdrag = null; return; }
    if (e.pointerId !== joy.id) return;
    joy.id = null; joy.dx = 0; joy.dy = 0; R.joyView = null;
  }
  // the journal's release: a sideways drag of 24+ art units turns the page
  // (drag LEFT = next, like pulling the sheet over); a short one is a tap,
  // and only a tap ON a pill does anything at all
  canvas.addEventListener('pointerup', function (e) {
    if (!jdrag || e.pointerId !== jdrag.id) { endPointer(e); return; }
    var d = jdrag; jdrag = null;
    if (!S.journalOpen) return;
    var p = toArt(e);
    var dx = p.x - d.x, dy = p.y - d.y;
    if (Math.abs(dx) >= 24 && Math.abs(dx) > Math.abs(dy)) { journalTurn(dx < 0 ? 1 : -1); return; }
    var hit = hitButton(p);
    if (hit === 'journalClose') closeJournal();
    else if (hit === 'journalPrev') journalTurn(-1);
    else if (hit === 'journalNext') journalTurn(1);
  });
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // the wheel turns the journal's pages (note 12) and does nothing else:
  // trackpads fire dozens of events per flick, so one turn per 220 ms
  var wheelLock = 0;
  canvas.addEventListener('wheel', function (e) {
    if (!S.journalOpen) return;
    e.preventDefault();
    var now = performance.now();
    if (now < wheelLock || !e.deltaY) return;
    wheelLock = now + 220;
    journalTurn(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  // iOS gesture lockdown (#1): non-passive touch handlers on the canvas —
  // preventDefault here is what keeps an aggressive drag from becoming the
  // browser's back-swipe / tab-switch / refresh gesture. The Outfitter is
  // its own DOM and keeps its own scrolling.
  ['touchstart', 'touchmove', 'touchend'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (e.target === canvas) {
        e.preventDefault();
        // iOS unlocks best right here — and the tune is asked for in the same breath
        if (ev !== 'touchmove') { AUDIO.unlock(); songOnGesture(); }
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

    tickGame(dt, readKeys(keys, joy));
    // while the game is paused, the world should also HOLD ITS BREATH: no
    // mosquito drone over the map or a card — but the campfire may crackle
    // through the night card, which is exactly when the fire is on screen
    if (S.mode !== 'play' || S.mapOpen || S.gearOpen || S.journalOpen || OUTFIT.isOpen()) {
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
