'use strict';
// ---------------------------------------------------------------------------
// Input, sampled at EVENT time rather than frame time.
//
// The whole point: a keydown at 16.2 ms into a frame is recorded as 16.2 ms,
// not as "this frame". Jump buffering and coyote time then measure against a
// real instant, which is the difference between a control that feels tight and
// one that eats your input. Touch and keyboard both feed the same buttons.
// ---------------------------------------------------------------------------

function Btn() { return { held: false, pressT: -1e9, relT: -1e9, used: true }; }

var Input = {
  x: 0,            // -1 / 0 / 1, horizontal intent
  y: 0,            // -1 up / 0 / 1 down, used to aim the throw later
  jump: Btn(),
  toss: Btn(),
  drink: Btn(),
  // Keyboard and touch write their own halves so neither can clear the other.
  kx: 0, ky: 0,
  tx: 0, ty: 0,
  anyInputYet: false
};

function btnPress(b, t) {
  if (b.held) return;
  b.held = true;
  b.pressT = t;
  b.used = false;
  Input.anyInputYet = true;
}

function btnRelease(b, t) {
  if (!b.held) return;
  b.held = false;
  b.relT = t;
}

// True if the button was pressed within `window` seconds and not consumed yet.
function btnBuffered(b, now, window) {
  return !b.used && (now - b.pressT) <= window;
}

function btnConsume(b) { b.used = true; }

// A press that must be fresh this frame, for one-shot actions with no buffer.
function btnTapped(b, now) {
  if (b.used || (now - b.pressT) > 0.2) return false;
  b.used = true;
  return true;
}

function inputMerge() {
  Input.x = Input.kx !== 0 ? Input.kx : Input.tx;
  Input.y = Input.ky !== 0 ? Input.ky : Input.ty;
}

// --- Keyboard --------------------------------------------------------------
// WASD and arrows are an eight-way stick: they move AND aim, the way Contra's
// d-pad does. Space jumps, J throws, K drinks, with Z and X as aliases so muscle
// memory from either camp works. Down crouches; down plus Space drops through a
// stand-through platform.

var KEY_LEFT = { KeyA: 1, ArrowLeft: 1 };
var KEY_RIGHT = { KeyD: 1, ArrowRight: 1 };
var KEY_UP = { KeyW: 1, ArrowUp: 1 };
var KEY_DOWN = { KeyS: 1, ArrowDown: 1 };
var KEY_JUMP = { Space: 1 };   // Space alone: W and Up aim now
var KEY_TOSS = { KeyJ: 1, KeyZ: 1 };
var KEY_DRINK = { KeyK: 1, KeyX: 1 };

var keyDown = Object.create(null);

function keyAxes() {
  Input.kx = (keyDown.right ? 1 : 0) - (keyDown.left ? 1 : 0);
  Input.ky = (keyDown.down ? 1 : 0) - (keyDown.up ? 1 : 0);
}

function installKeyboard(hooks) {
  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    // A focused slider or button owns the arrow keys and space; WASD and the
    // action keys keep driving the game so a change can be felt without closing.
    var ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'BUTTON') &&
        (e.code === 'Space' || e.code.indexOf('Arrow') === 0)) return;
    var t = performance.now() / 1000;
    var handled = true;
    if (KEY_LEFT[e.code]) keyDown.left = 1;
    else if (KEY_RIGHT[e.code]) keyDown.right = 1;
    else handled = false;
    if (KEY_UP[e.code]) { keyDown.up = 1; handled = true; }
    if (KEY_DOWN[e.code]) { keyDown.down = 1; handled = true; }
    if (KEY_JUMP[e.code]) { btnPress(Input.jump, t); handled = true; }
    if (KEY_TOSS[e.code]) { btnPress(Input.toss, t); handled = true; }
    if (KEY_DRINK[e.code]) { btnPress(Input.drink, t); handled = true; }
    if (e.code === 'KeyR') { hooks.respawn(); handled = true; }
    if (e.code === 'Tab' || e.code === 'Escape') { hooks.toggleMenu(); handled = true; }
    if (handled) { keyAxes(); e.preventDefault(); }
  }, { passive: false });

  window.addEventListener('keyup', function (e) {
    var t = performance.now() / 1000;
    if (KEY_LEFT[e.code]) keyDown.left = 0;
    if (KEY_RIGHT[e.code]) keyDown.right = 0;
    if (KEY_UP[e.code]) keyDown.up = 0;
    if (KEY_DOWN[e.code]) keyDown.down = 0;
    if (KEY_JUMP[e.code]) btnRelease(Input.jump, t);
    if (KEY_TOSS[e.code]) btnRelease(Input.toss, t);
    if (KEY_DRINK[e.code]) btnRelease(Input.drink, t);
    keyAxes();
  });

  // A lost window must not leave a key stuck down.
  window.addEventListener('blur', function () {
    var t = performance.now() / 1000;
    keyDown.left = keyDown.right = keyDown.up = keyDown.down = 0;
    btnRelease(Input.jump, t); btnRelease(Input.toss, t); btnRelease(Input.drink, t);
    keyAxes();
  });
}
