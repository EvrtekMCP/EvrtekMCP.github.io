'use strict';
// ---------------------------------------------------------------------------
// The on-screen controller.
//
// Drawn on its own overlay canvas at device resolution, so it stays smooth and
// crisp while the game underneath is a chunky upscaled pixel buffer. It only
// redraws when something about it changes, so a still thumb costs nothing.
//
// The left control is a JOYPAD, not a D-pad — his call, so that aiming works
// the way Contra's does. It locks to eight directions rather than reading a
// free angle: a 45 degree lock is something a thumb can actually hit, and a
// free 360 is something a thumb only ever misses. The base also follows the
// thumb: wherever a finger lands on the left half becomes the centre, which is
// how you keep a stick under a thumb that cannot see it.
//
// Right thumb, landscape:
//
//          (DRINK)          DRINK is set apart and higher up — it is the rare
//    (THROW)                button and an accidental one wastes the meter.
//               (JUMP)      JUMP sits nearest the thumb's rest and is biggest.
//                           THROW is one roll to the left of it, so jump-and-
//                           throw is a thumb roll rather than two fingers.
// ---------------------------------------------------------------------------

var Touch = {
  on: false,          // is the touch controller shown
  dirty: true,
  w: 0, h: 0, dpr: 1,
  safe: { l: 0, t: 0, r: 0, b: 0 },
  stick: {
    homeX: 0, homeY: 0,     // where it sits when nobody is holding it
    cx: 0, cy: 0,           // where it actually is right now
    r: 0, knobR: 0, dead: 0,
    active: false, dirX: 0, dirY: 0,
    pid: -1                 // which pointer is holding it, -1 for nobody
  },
  btn: [],            // {id, cx, cy, r, label, down}
  gear: { cx: 0, cy: 0, r: 0, down: false },
  reset: { cx: 0, cy: 0, r: 0, down: false },
  owners: Object.create(null)   // pointerId -> control key
};

function touchShouldShow() {
  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  return (navigator.maxTouchPoints > 0) && coarse;
}

function readSafeArea() {
  var p = document.getElementById('safe-probe');
  if (!p) return;
  var cs = getComputedStyle(p);
  Touch.safe.l = parseFloat(cs.paddingLeft) || 0;
  Touch.safe.t = parseFloat(cs.paddingTop) || 0;
  Touch.safe.r = parseFloat(cs.paddingRight) || 0;
  Touch.safe.b = parseFloat(cs.paddingBottom) || 0;
}

function touchLayout(w, h) {
  Touch.w = w; Touch.h = h;
  readSafeArea();
  var s = Touch.safe;
  // Everything is sized off the short edge, so portrait does not produce
  // buttons the size of dinner plates.
  var m = Math.min(w - s.l - s.r, h - s.t - s.b) * (TUNE.uiScale || 1);
  var bx = w - s.r, by = h - s.b;

  var k = Touch.stick;
  k.r = m * 0.150;
  k.knobR = k.r * 0.40;
  k.dead = k.r * 0.26;
  k.homeX = s.l + m * 0.235;
  k.homeY = by - m * 0.235;
  if (!k.active) { k.cx = k.homeX; k.cy = k.homeY; }

  Touch.btn.length = 0;
  // Measured against a 390 px-tall landscape phone: about 24 px of margin at the
  // corner, ~10 px between JUMP and THROW so a thumb roll cannot press both, and
  // DRINK set far enough away that reaching it has to be meant.
  Touch.btn.push({ id: 'jump', cx: bx - m * 0.175, cy: by - m * 0.175, r: m * 0.112, label: 'JUMP', down: false, pid: -1 });
  Touch.btn.push({ id: 'toss', cx: bx - m * 0.400, cy: by - m * 0.225, r: m * 0.096, label: 'THROW', down: false, pid: -1 });
  Touch.btn.push({ id: 'drink', cx: bx - m * 0.197, cy: by - m * 0.400, r: m * 0.086, label: 'SPECIAL', down: false, pid: -1 });

  var gr = Math.max(15, m * 0.052);
  // Top RIGHT: the health bar owns the top-left corner now.
  // Below the status bar, which owns the top of the screen now.
  Touch.gear.cx = bx - gr - m * 0.03; Touch.gear.cy = HUD.h + gr + m * 0.02; Touch.gear.r = gr;
  Touch.reset.cx = Touch.gear.cx - gr * 2.6; Touch.reset.cy = Touch.gear.cy; Touch.reset.r = gr;

  Touch.dirty = true;
}

function hitCircle(c, x, y, slop) {
  var dx = x - c.cx, dy = y - c.cy, rr = c.r + (slop || 0);
  return dx * dx + dy * dy <= rr * rr;
}

// Eight sectors of 45 degrees, each 22.5 either side of its centre. Round() of
// cos and sin at those angles gives exactly -1, 0 or 1, so the snap and the
// input axes are the same thing and nothing has to be re-quantised later.
function stickApply(x, y) {
  var k = Touch.stick;
  var dx = x - k.cx, dy = y - k.cy;
  var nx = 0, ny = 0;
  if (Math.sqrt(dx * dx + dy * dy) >= k.dead) {
    var q = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    nx = Math.round(Math.cos(q));
    ny = Math.round(Math.sin(q));
  }
  if (nx !== k.dirX || ny !== k.dirY) Touch.dirty = true;
  k.dirX = nx; k.dirY = ny;
  Input.tx = nx; Input.ty = ny;
}

function stickGrab(x, y, pid) {
  var k = Touch.stick;
  // Re-centre on the thumb, but keep the whole base on screen — and keep it
  // clear of the bottom edge. A stick sitting over the home indicator lets iOS
  // claim the drag as a system gesture, and the release never comes back.
  var lift = k.r * 0.55;
  k.cx = Math.max(Touch.safe.l + k.r, Math.min(Touch.w * 0.5 - k.r * 0.2, x));
  k.cy = Math.max(Touch.safe.t + k.r, Math.min(Touch.h - Touch.safe.b - k.r - lift, y));
  k.active = true;
  k.pid = pid;
  stickApply(x, y);
  Touch.dirty = true;
}

function stickRelease() {
  var k = Touch.stick;
  k.active = false;
  k.pid = -1;
  k.cx = k.homeX; k.cy = k.homeY;
  k.dirX = k.dirY = 0;
  Input.tx = Input.ty = 0;
  Touch.dirty = true;
}

// Let go of everything, whoever was holding it. A backgrounded page, a system
// gesture or a lost capture can all swallow the pointerup that would normally
// do this, and a controller that is still holding right when your thumb is not
// on it is the worst bug this file can have.
function touchReleaseAll() {
  var now = performance.now() / 1000;
  for (var k in Touch.owners) delete Touch.owners[k];
  if (Touch.stick.active) stickRelease();
  for (var i = 0; i < Touch.btn.length; i++) {
    var b = Touch.btn[i];
    if (b.down) { b.down = false; btnRelease(touchInputFor(b.id), now); }
    b.pid = -1;
  }
  Touch.gear.down = false; Touch.reset.down = false;
  Touch.dirty = true;
}

// Checked every frame: a control that is held by a pointer nobody is tracking
// any more has been stranded, so drop it. This catches the paths we have not
// thought of as well as the ones we have.
function touchAudit() {
  var k = Touch.stick;
  if (k.active && Touch.owners[k.pid] !== 'stick') stickRelease();
  var now = performance.now() / 1000;
  for (var i = 0; i < Touch.btn.length; i++) {
    var b = Touch.btn[i];
    if (b.down && Touch.owners[b.pid] !== b.id) {
      b.down = false; b.pid = -1;
      btnRelease(touchInputFor(b.id), now);
      Touch.dirty = true;
    }
  }
}

function btnByBtnId(id) {
  for (var i = 0; i < Touch.btn.length; i++) if (Touch.btn[i].id === id) return Touch.btn[i];
  return null;
}

function touchInputFor(id) {
  return id === 'jump' ? Input.jump : id === 'toss' ? Input.toss : Input.drink;
}

function installTouch(canvas, hooks) {
  function local(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  canvas.addEventListener('pointerdown', function (e) {
    var t = performance.now() / 1000;
    if (e.pointerType === 'touch' && !Touch.on) { Touch.on = true; touchLayout(Touch.w, Touch.h); }
    var p = local(e);

    if (hitCircle(Touch.gear, p.x, p.y, 8)) {
      Touch.owners[e.pointerId] = 'gear'; Touch.gear.down = true; Touch.dirty = true;
      e.preventDefault(); return;
    }
    if (hitCircle(Touch.reset, p.x, p.y, 8)) {
      Touch.owners[e.pointerId] = 'reset'; Touch.reset.down = true; Touch.dirty = true;
      e.preventDefault(); return;
    }
    if (!Touch.on) return;

    for (var i = 0; i < Touch.btn.length; i++) {
      var b = Touch.btn[i];
      if (hitCircle(b, p.x, p.y, b.r * 0.22)) {
        Touch.owners[e.pointerId] = b.id;
        b.down = true; b.pid = e.pointerId; Touch.dirty = true;
        btnPress(touchInputFor(b.id), t);
        e.preventDefault(); return;
      }
    }
    if (p.x < Touch.w * 0.5) {
      // A fresh thumb on the left half ALWAYS takes the stick. One thumb drives
      // it, so there is no case where stealing is wrong — and it means a stick
      // left stranded by a lost release heals the moment you touch it again,
      // instead of staying stuck until the page is reloaded.
      if (Touch.stick.active && Touch.stick.pid !== e.pointerId) {
        delete Touch.owners[Touch.stick.pid];
        stickRelease();
      }
      Touch.owners[e.pointerId] = 'stick';
      stickGrab(p.x, p.y, e.pointerId);
      e.preventDefault();
    }
  }, { passive: false });

  canvas.addEventListener('pointermove', function (e) {
    var who = Touch.owners[e.pointerId];
    if (!who) return;
    var p = local(e);
    if (who === 'stick') { stickApply(p.x, p.y); e.preventDefault(); return; }
    var b = btnByBtnId(who);
    if (b && b.down && !hitCircle(b, p.x, p.y, b.r * 0.85)) {
      b.down = false; Touch.dirty = true;
      btnRelease(touchInputFor(b.id), performance.now() / 1000);
    }
    e.preventDefault();
  }, { passive: false });

  function endPointer(e) {
    var who = Touch.owners[e.pointerId];
    if (!who) return;
    delete Touch.owners[e.pointerId];
    var t = performance.now() / 1000;
    if (who === 'stick') { stickRelease(); return; }
    if (who === 'gear') {
      Touch.gear.down = false; Touch.dirty = true;
      if (hitCircle(Touch.gear, local(e).x, local(e).y, 20)) hooks.toggleMenu();
      return;
    }
    if (who === 'reset') {
      Touch.reset.down = false; Touch.dirty = true;
      if (hitCircle(Touch.reset, local(e).x, local(e).y, 20)) hooks.respawn();
      return;
    }
    var b = btnByBtnId(who);
    if (b) { b.down = false; Touch.dirty = true; btnRelease(touchInputFor(b.id), t); }
  }

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  // Fires when the browser takes the pointer away for its own reasons — the
  // one case where neither pointerup nor pointercancel is guaranteed to arrive.
  canvas.addEventListener('lostpointercapture', endPointer);

  // A page that goes away mid-touch never delivers the release at all.
  window.addEventListener('blur', touchReleaseAll);
  window.addEventListener('pagehide', touchReleaseAll);
  document.addEventListener('visibilitychange', touchReleaseAll);
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
}

// --- Drawing ---------------------------------------------------------------

function drawStick(c) {
  var k = Touch.stick, a = TUNE.uiOpacity;
  c.save();
  c.translate(k.cx, k.cy);

  // Base.
  c.globalAlpha = a * 0.85;
  c.beginPath(); c.arc(0, 0, k.r, 0, Math.PI * 2);
  c.fillStyle = '#0d1420'; c.fill();
  c.lineWidth = Math.max(1.5, k.r * 0.055);
  c.strokeStyle = 'rgba(180,215,255,0.55)'; c.stroke();

  // Eight ticks, so the lock is visible rather than something you discover.
  c.globalAlpha = a * 0.75;
  for (var i = 0; i < 8; i++) {
    var ang = i * Math.PI / 4;
    var lit = (Math.round(Math.cos(ang)) === k.dirX && Math.round(Math.sin(ang)) === k.dirY) &&
              (k.dirX !== 0 || k.dirY !== 0);
    c.save(); c.rotate(ang);
    c.fillStyle = lit ? '#8fd0ff' : '#7d97b5';
    c.globalAlpha = lit ? Math.min(0.95, a + 0.45) : a * 0.7;
    var tl = lit ? k.r * 0.30 : k.r * 0.18;
    c.fillRect(k.r * 0.60, -k.r * 0.055, tl, k.r * 0.11);
    c.restore();
  }

  // Knob, sitting in the direction actually being read — not where the thumb
  // is. What it shows and what the game receives have to be the same thing.
  var off = (k.dirX || k.dirY) ? k.r * 0.46 : 0;
  var inv = (k.dirX && k.dirY) ? 0.7071 : 1;
  c.globalAlpha = Math.min(0.92, a + 0.30);
  c.beginPath();
  c.arc(k.dirX * inv * off, k.dirY * inv * off, k.knobR, 0, Math.PI * 2);
  c.fillStyle = (k.dirX || k.dirY) ? '#8fd0ff' : '#1a2434';
  c.fill();
  c.lineWidth = Math.max(1.4, k.knobR * 0.14);
  c.strokeStyle = 'rgba(220,236,255,0.8)'; c.stroke();
  c.restore();
}

function drawActionButton(c, b) {
  var a = TUNE.uiOpacity;
  c.save();
  c.globalAlpha = b.down ? Math.min(0.95, a + 0.4) : a;
  c.beginPath(); c.arc(b.cx, b.cy, b.r, 0, Math.PI * 2);
  c.fillStyle = b.down ? '#8fd0ff' : '#0d1420';
  c.fill();
  c.globalAlpha = b.down ? 0.95 : Math.min(0.8, a + 0.28);
  c.lineWidth = Math.max(1.5, b.r * 0.07);
  c.strokeStyle = b.down ? '#e8f6ff' : 'rgba(180,215,255,0.6)';
  c.stroke();
  c.globalAlpha = b.down ? 0.98 : Math.min(0.9, a + 0.42);
  c.fillStyle = b.down ? '#0a1018' : '#dcecff';
  c.font = '700 ' + Math.round(b.r * 0.40) + 'px ui-sans-serif, system-ui, -apple-system, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(b.label, b.cx, b.cy + b.r * 0.02);
  c.restore();
}

function drawSmallButton(c, s, glyph) {
  c.save();
  c.globalAlpha = s.down ? 0.85 : Math.max(0.22, TUNE.uiOpacity * 0.75);
  c.beginPath(); c.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
  c.fillStyle = '#0d1420'; c.fill();
  c.lineWidth = Math.max(1.2, s.r * 0.09);
  c.strokeStyle = 'rgba(180,215,255,0.6)'; c.stroke();
  c.fillStyle = '#dcecff';
  c.font = '600 ' + Math.round(s.r * 0.95) + 'px ui-sans-serif, system-ui, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(glyph, s.cx, s.cy + s.r * 0.04);
  c.restore();
}

function drawTouchUI(c) {
  drawSmallButton(c, Touch.gear, '⚙');
  drawSmallButton(c, Touch.reset, '↺');
  if (!Touch.on) return;
  drawStick(c);
  for (var i = 0; i < Touch.btn.length; i++) drawActionButton(c, Touch.btn[i]);
}
