'use strict';
// ---------------------------------------------------------------------------
// Boot and the loop.
//
// Fixed 60 Hz simulation, interpolated render. This is not pedantry: a modern
// iPhone runs requestAnimationFrame at 120 Hz and a laptop on battery can drop
// to 30, and if the physics step floats with that then the same jump clears a
// gap on one machine and not on another. The sim never sees a variable dt.
// ---------------------------------------------------------------------------

var STEP = 1 / 60;
var MAX_CATCHUP = 5;

var game, ui, ux;
var Fit = { scale: 1, ox: 0, oy: 0, cssW: 0, cssH: 0, dpr: 1 };
var acc = 0, lastT = 0, fps = 60, fpsT = 0, fpsN = 0, frameMs = 0;

function hooks() {
  return {
    toggleMenu: menuToggle,
    respawn: function () {
      levelReset();
      playerSpawn();
      P.lives = TUNE.startLives | 0;
      P.score = 0;
      P.checkX = -1; P.checkY = -1;
      foesReset(); itemsReset(); checkReset(false);
      stageBegin();
      camSnap();
    }
  };
}

function layout() {
  var cssW = window.innerWidth, cssH = window.innerHeight;
  // A container can report zero during its own first layout pass. Sizing the
  // canvas to nothing there leaves a blank page that never recovers.
  if (cssW < 2 || cssH < 2) { requestAnimationFrame(layout); return; }
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  Fit.cssW = cssW; Fit.cssH = cssH; Fit.dpr = dpr;

  hudLayout(cssW, cssH);
  resizeView(cssW, cssH);

  // Contain rather than stretch: the backbuffer width already tracks the
  // screen's aspect, so bars only appear on a shape no phone actually has.
  var scale = Math.min(cssW / view.w, cssH / view.h);
  Fit.scale = scale;
  Fit.ox = (cssW - view.w * scale) * 0.5;
  Fit.oy = (cssH - view.h * scale) * 0.5;
  game.style.width = (view.w * scale) + 'px';
  game.style.height = (view.h * scale) + 'px';
  game.style.left = Fit.ox + 'px';
  game.style.top = Fit.oy + 'px';

  ui.width = Math.round(cssW * dpr);
  ui.height = Math.round(cssH * dpr);
  ui.style.width = cssW + 'px';
  ui.style.height = cssH + 'px';
  ux.setTransform(dpr, 0, 0, dpr, 0, 0);

  Touch.w = cssW; Touch.h = cssH;
  touchLayout(cssW, cssH);
  camSnap();
}

function simulate(dt) {
  var now = performance.now() / 1000;
  audioTick(dt);
  // THE TITLE OWNS THE SIMULATION WHILE IT IS UP. The level is already built
  // and the opening sequence is already armed behind it, but nothing in the
  // world moves and the clock does not start until the press. audioTick is
  // above this on purpose: the scheduler keeps running, because the press is
  // also the browser gesture that lets sound play at all.
  if (typeof titleActive === 'function' && titleActive()) { titleStep(); return; }
  // The tally freezes the world the same way. It opens AFTER the outro on a
  // win, so the truck has already finished driving off by the time this bites.
  if (typeof tallyActive === 'function' && tallyActive()) { tallyStep(); return; }
  levelTick(dt);
  stageStep(dt);
  playerStep(dt, now);
  foesStep(dt);
  itemsStep(dt, now);
  checkStep(dt);
  camStep(dt);
  // THE SOUND READS THE FX FLAGS HERE: after everything that sets them, before
  // drainFx() clears them. From 0.8.0 to 0.9.3 this call sat at the top of the
  // function, where the previous step's drainFx() had already cleared every
  // flag it was looking for — so the jump, the landing, the wall kick, the
  // hurt and every throw were silent (Evrtek, 2026-10-17: "There's no throw
  // sound"). After camStep, so a sound placed in the world is placed against
  // the camera this frame draws.
  audioFromPlayer();
  audioFromWorld();      // the drones' engines
  drainFx();
  partsStep(dt);
}

function drawOverlay(cam) {
  touchAudit();
  ux.clearRect(0, 0, Fit.cssW, Fit.cssH);

  if (TUNE.showLabels) {
    ux.font = '600 12px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ux.textAlign = 'left'; ux.textBaseline = 'alphabetic';
    for (var i = 0; i < World.labels.length; i++) {
      var L = World.labels[i];
      var sx = Fit.ox + (L.x - cam.cx) * Fit.scale;
      var sy = Fit.oy + (L.y - cam.cy) * Fit.scale;
      if (sx < -420 || sx > Fit.cssW + 60 || sy < -40 || sy > Fit.cssH + 40) continue;
      ux.globalAlpha = 0.34;
      ux.fillStyle = '#04070c';
      ux.fillText(L.text, sx + 1, sy + 1);
      ux.globalAlpha = 0.72;
      ux.fillStyle = '#b8d4f0';
      ux.fillText(L.text, sx, sy);
    }
    ux.globalAlpha = 1;
  }

  if (TUNE.showReadout) {
    var pad = Touch.safe.r + 10;
    ux.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ux.textAlign = 'right'; ux.textBaseline = 'top';
    ux.fillStyle = 'rgba(184,212,240,0.85)';
    var y = HUD.h + Touch.gear.r * 2 + 18;
    var lines = [
      Math.round(fps) + ' fps  ' + frameMs.toFixed(1) + ' ms',
      'vx ' + P.vx.toFixed(0) + '  vy ' + P.vy.toFixed(0),
      P.state + '  air jumps ' + P.airJumps,
      'aim ' + P.aimX + ',' + P.aimY + '  mail ' + Toss.n,
      'hp ' + P.hp + '/' + P.hpMax + '  deaths ' + P.deaths,
      'foes ' + Foes.n + '  shots ' + Shots.n + '  items ' + Items.n,
      'hits ' + P.hits + '  thrown ' + P.thrown,
      'touch ' + Object.keys(Touch.owners).length + '  stick ' +
        Touch.stick.dirX + ',' + Touch.stick.dirY
    ];
    for (var k = 0; k < lines.length; k++) ux.fillText(lines[k], Fit.cssW - pad, y + k * 14);
  }

  drawHudBar(ux);
  // The joypad would sit on top of the panel and under the finger going for
  // TRY AGAIN.
  if (!(typeof tallyActive === 'function' && tallyActive())) drawTouchUI(ux);
  Touch.dirty = false;
}

function frame(t) {
  requestAnimationFrame(frame);
  var t0 = performance.now();

  var dt = (t - lastT) / 1000;
  lastT = t;
  if (!(dt > 0)) dt = STEP;
  if (dt > 0.25) dt = 0.25;            // a backgrounded tab must not teleport

  acc += dt;
  var steps = 0;
  while (acc >= STEP && steps < MAX_CATCHUP) { simulate(STEP); acc -= STEP; steps++; }
  if (steps === MAX_CATCHUP) acc = 0;  // stop trying to catch up; drop the time

  if (typeof titleActive === 'function' && titleActive()) {
    titleDraw(bx);
    ux.clearRect(0, 0, Fit.cssW, Fit.cssH);   // no HUD, no touch pad, over the title
  } else {
    var cam = renderWorld(acc / STEP);
    drawOverlay(cam);
    // LAST, and after drawOverlay rather than inside it: the HUD bar and the
    // touch pad are drawn at the end of that function and would otherwise paint
    // straight over the panel.
    if (typeof tallyDraw === 'function') tallyDraw(ux);
  }

  frameMs = performance.now() - t0;
  fpsN++; fpsT += dt;
  if (fpsT >= 0.5) { fps = fpsN / fpsT; fpsN = 0; fpsT = 0; }
}

// The press that starts the game, from a key, a tap, a click or a cabinet
// button. Registered in the CAPTURE phase deliberately, so it is seen before
// the game's own handlers: Space is the jump key, and a press that reached
// installKeyboard would sit in the jump buffer and spend itself on the first
// frame of play. Stopping it here is the difference between starting the game
// and starting the game with a jump.
function titleInstall() {
  var press = function (e) {
    if (e.repeat) return;
    var onTitle = typeof titleActive === 'function' && titleActive();
    var onTally = typeof tallyActive === 'function' && tallyActive();
    if (!onTitle && !onTally) return;
    if (onTitle) titlePress();
    else {
      // A tap has to land ON the button; a key always counts. Fit.ox/oy are the
      // letterbox offsets, and the panel is drawn in CSS pixels, so a pointer
      // event's clientX/Y are already in the right space.
      if (e.type === 'pointerdown' && !tallyHit(e.clientX, e.clientY)) return;
      tallyPress();
    }
    e.preventDefault();
    // stopImmediatePropagation, NOT stopPropagation. Both this listener and
    // installKeyboard's are on the window object, and stopPropagation only stops
    // the event reaching OTHER nodes — listeners already on the same one still
    // run. Measured before the fix: the Space that started the game left
    // Input.jump.held true, so the carrier jumped the moment the truck put him
    // down. It is the same press; it must not be two.
    e.stopImmediatePropagation();
  };
  window.addEventListener('keydown', press, true);
  window.addEventListener('pointerdown', press, true);
}

// The query string, parsed once. Written out rather than handed to
// URLSearchParams because everything here has to work from a file:// URL on a
// phone browser as well as from the dev server, and a hand-rolled ten lines is
// the same ten lines everywhere.
function queryParams() {
  var q = Object.create(null);
  var s = (location.search || '').replace(/^\?/, '');
  if (!s) return q;
  var parts = s.split('&');
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    var eq = parts[i].indexOf('=');
    var k = eq < 0 ? parts[i] : parts[i].slice(0, eq);
    var v = eq < 0 ? '' : parts[i].slice(eq + 1);
    try { q[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); }
    catch (e) { q[k] = v; }
  }
  return q;
}

// WHICH WORLD THE GAME BOOTS INTO.
//
// THE DEMO (Evrtek, 2026-10-17: "only the one level. Just to let people test it
// out"): the game boots into his HAINES AVENUE, levels/level-1-1.js, made in the
// editor, and index.html loads no other level. levels/level1.js and the rest
// stay in the repo for the tools and the editor, out of the demo's path; any of
// them still plays by name, which is what the editor's Play button does.
//
//   (nothing)                 BOOT_LEVEL, from levels/level-1-1.js
//   ?level=<id>               any level file loaded by a script tag above
//   ?level=<id>&at=<tx>       ...starting at tile <tx> — the editor's Play button
//   ?level=<id>&at=<tx>&aty=<ty>  ...nearest tile <tx>,<ty> (0.9.0: somewhere to
//                             stand no longer has to be ground, so the row matters)
//   ?room=sandbox             the old control sandbox, which is code, not data
//
// A level named that is not loaded falls back to the demo's level rather than to
// a blank page, and says so in the console. A blank page is the one outcome that
// tells nobody anything.
var BOOT_LEVEL = 'level-1-1';     // index.html loads this file and no other level

function bootWorld() {
  var q = queryParams();
  // `?sandbox` on its own kept working here for a year and the WORKBENCH notes
  // use `?room=sandbox`; both open it.
  if (q.room === 'sandbox' || q.sandbox !== undefined) {
    buildSandbox(); LevelCur.id = null; LevelCur.at = null; return;
  }

  var id = q.level || BOOT_LEVEL;
  var at = (q.at === undefined || q.at === '') ? null : parseInt(q.at, 10);
  var aty = (q.aty === undefined || q.aty === '') ? null : parseInt(q.aty, 10);
  if (levelBuild(id, at, aty)) return;
  console.error('No level "' + id + '" is loaded (index.html loads: ' + levelIds().join(', ') +
                '). Booting ' + BOOT_LEVEL + ' instead.');
  if (levelBuild(BOOT_LEVEL, null)) return;
  console.error('levels/' + BOOT_LEVEL + '.js did not load either — opening the control sandbox.');
  buildSandbox(); LevelCur.id = null; LevelCur.at = null;
}

function boot() {
  game = document.getElementById('game');
  ui = document.getElementById('ui');
  ux = ui.getContext('2d');

  attachBackbuffer(game);
  sprProbe();          // one request decides whether any art exists
  if (typeof titleBegin === 'function') { titleBegin(); titleInstall(); }
  tuneLoad();
  bootWorld();
  levelReset();
  playerSpawn();
  P.lives = TUNE.startLives | 0;
  P.score = 0;
  foesReset();
  itemsReset();
  checkReset(false);
  stageBegin();

  Touch.on = touchShouldShow();
  menuBuild();
  installKeyboard(hooks());
  installTouch(ui, hooks());

  layout();
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 120); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { lastT = performance.now(); acc = 0; }
  });

  document.title = GAME_TITLE + ' — control sandbox';
  lastT = performance.now();
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
