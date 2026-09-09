'use strict';
// CROSSWIRE — input.
//
// EVRTEK'S RULING, 2026-09-06: there is no mouse. PC is WASD or a d-pad.
// (And 2026-09-08: the mouse that came free with the touch code STAYS — a
// click places, a drag anywhere moves — beside the keys, not instead of them.)
//
// So the architecture matters more than usual: every player is a COMMAND
// STREAM. Keyboard, gamepad, and later the bot and a recorded replay all emit
// the same short list of commands into the same simulation. That is what makes
// the bot just another player and replays free, and it is the one decision
// here that would be a rewrite to retrofit.
//
// Auto-repeat is the reason a cursor on two hundred cells is not miserable.
// Hold a direction and after DAS_DELAY it repeats every DAS_RATE, so crossing
// the whole grid takes well under a second. This is the same trick the falling
// -block games use and it is why they feel good.
var CW_INPUT = (function () {

  var DAS_DELAY = 0.17;   // seconds held before auto-repeat starts
  var DAS_RATE  = 0.035;  // seconds between repeats once it does
  var STICK_DEADZONE = 0.55;

  // One player's control surface. `keys` maps an action to a list of
  // KeyboardEvent.code values; `pad` is a gamepad index or null.
  function Controller(keys, padIndex) {
    this.keys = keys;
    this.padIndex = (padIndex === undefined) ? null : padIndex;
    this.down = {};       // action -> true while held
    this.timer = {};      // action -> seconds until next repeat
    this.fired = {};      // action -> true for exactly one frame
    this.padSeen = false;
  }

  var REPEATING = { left: 1, right: 1, up: 1, down: 1 };

  Controller.prototype._set = function (action, isDown, dt) {
    var was = !!this.down[action];
    this.down[action] = isDown;
    this.fired[action] = false;
    if (isDown && !was) {
      this.fired[action] = true;
      this.timer[action] = REPEATING[action] ? DAS_DELAY : Infinity;
    } else if (isDown && was && REPEATING[action]) {
      this.timer[action] -= dt;
      if (this.timer[action] <= 0) {
        this.fired[action] = true;
        this.timer[action] = DAS_RATE;
      }
    } else if (!isDown) {
      this.timer[action] = 0;
    }
  };

  // Gamepads are polled, never evented. Standard mapping:
  // 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 12-15 d-pad up/down/left/right.
  Controller.prototype._padState = function () {
    if (this.padIndex === null) return null;
    if (typeof navigator === 'undefined') return null;   // headless harness
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var p = pads && pads[this.padIndex];
    if (!p || !p.connected) return null;
    this.padSeen = true;
    var ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    var b = function (i) { return !!(p.buttons[i] && p.buttons[i].pressed); };
    return {
      left:    b(14) || ax < -STICK_DEADZONE,
      right:   b(15) || ax > STICK_DEADZONE,
      up:      b(12) || ay < -STICK_DEADZONE,
      down:    b(13) || ay > STICK_DEADZONE,
      commit:  b(0),
      rotCW:   b(1),
      rotCCW:  b(2),
      destroy: b(3)
    };
  };

  Controller.prototype.update = function (dt, kb) {
    var pad = this._padState();
    var self = this;
    var actions = ['left', 'right', 'up', 'down', 'commit', 'destroy',
                   'rotCW', 'rotCCW'];
    actions.forEach(function (a) {
      // `edge` catches a tap that went down and up inside one frame. Without
      // it a fast press is silently dropped, which is the kind of bug that
      // makes a game feel unreliable without ever looking like a bug.
      var byKey = (self.keys[a] || []).some(function (code) {
        return !!kb.held[code] || !!kb.edge[code];
      });
      var byPad = pad ? !!pad[a] : false;
      self._set(a, byKey || byPad, dt);
    });
  };

  Controller.prototype.pressed = function (a) { return !!this.fired[a]; };
  Controller.prototype.held = function (a) { return !!this.down[a]; };

  // The neutral command. EVRTEK 2026-09-07 asked for a phone build, and a
  // finger cannot say "left a bit" — it points. So the stream grew four
  // fields that name a PLACE rather than a direction, and every source fills
  // in the same shape whether it can produce them or not. A keyboard leaves
  // all four null for ever, which is exactly what a bot or a replay does with
  // the fields it has no opinion about.
  //   to    a drag put the handle on this cell
  //   tap   a finger tapped this cell
  //   pick  a finger tapped this named button on the front end
  //   tune  a finger tapped the junction on this cell (EVRTEK 2026-09-07)
  function blank() {
    return {
      dx: 0, dy: 0, rot: 0, commit: false, destroy: false,
      to: null, tap: null, pick: null, tune: null
    };
  }

  // Reads the whole controller into one frame's worth of intent. This object
  // is the only thing the game rules ever see, which is what lets a bot or a
  // replay stand in for a human without the rules noticing.
  Controller.prototype.command = function () {
    var c = blank();
    c.dx = (this.pressed('right') ? 1 : 0) - (this.pressed('left') ? 1 : 0);
    c.dy = (this.pressed('down') ? 1 : 0) - (this.pressed('up') ? 1 : 0);
    c.commit = this.pressed('commit');
    c.destroy = this.pressed('destroy');
    c.rot = (this.pressed('rotCW') ? 1 : 0) - (this.pressed('rotCCW') ? 1 : 0);
    return c;
  };

  // EVRTEK'S CONTROLS, 2026-09-06: WASD moves, Q and E rotate, space commits,
  // B arms the destructor. Four ideas and eight keys, nothing else, because
  // the piece is presented rather than chosen. (Destroy was on DELETE until he
  // moved it to B, which keeps both hands on the home row.)
  var KEYS_P1 = {
    left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
    rotCCW: ['KeyQ'], rotCW: ['KeyE'],
    commit: ['Space'], destroy: ['KeyB']
  };

  // Player two on the same keyboard, parked ready for the mirror match. His
  // layout: the numpad, 4/5/6/8 standing in for WASD, + commits, - destroys.
  // He listed 7 and 8 as the rotates, but 8 is also his "up", so the second
  // rotate is 9. Arrow keys are kept as an alias for a machine with no numpad.
  var KEYS_P2 = {
    left: ['Numpad4', 'ArrowLeft'], right: ['Numpad6', 'ArrowRight'],
    up: ['Numpad8', 'ArrowUp'], down: ['Numpad5', 'ArrowDown'],
    rotCCW: ['Numpad7'], rotCW: ['Numpad9'],
    commit: ['NumpadAdd'], destroy: ['NumpadSubtract']
  };

  // A key can be identified by its physical position (e.code) or by what it
  // produced (e.key). Both are registered so a non-US layout and a synthetic
  // event both land on the same action.
  function codesFor(e) {
    var out = [];
    if (e.code) out.push(e.code);
    var k = e.key;
    if (typeof k === 'string' && k.length === 1) {
      var ch = k.toUpperCase();
      if (ch >= 'A' && ch <= 'Z') out.push('Key' + ch);
      else if (ch >= '0' && ch <= '9') out.push('Digit' + ch);
    } else if (typeof k === 'string' && k.indexOf('Arrow') === 0) {
      out.push(k);
    }
    return out;
  }

  // One place owns the raw keyboard, so nothing else has to listen.
  // `held` is the physical state. `edge` remembers every key that went down
  // since the last frame was read, even if it was already released, so no tap
  // is ever lost between two animation frames.
  function Keyboard() {
    var kb = {
      held: {},
      edge: {},
      endFrame: function () { kb.edge = {}; }
    };
    var swallow = {
      ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, Space: 1,
      KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1, Delete: 1, Backspace: 1
    };
    window.addEventListener('keydown', function (e) {
      var cs = codesFor(e);
      for (var i = 0; i < cs.length; i++) { kb.held[cs[i]] = true; kb.edge[cs[i]] = true; }
      if (swallow[e.code]) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) {
      var cs = codesFor(e);
      for (var i = 0; i < cs.length; i++) kb.held[cs[i]] = false;
    });
    window.addEventListener('blur', function () { kb.held = {}; kb.edge = {}; });
    return kb;
  }

  // ---- the finger --------------------------------------------------------
  //
  // EVRTEK 2026-09-07: "can we make the game mobile friendly as well." His no-
  // mouse ruling of 09-06 was about a POINTER standing in for a cursor on a
  // desktop; a phone has nothing else, so touch is a third command source
  // rather than an exception to that rule. It emits into the same stream, so
  // the rules never learn what a finger is.
  //
  // EVRTEK'S SCHEME, 2026-09-07, in its third shape. The piece was a THING YOU
  // HOLD — press on one of its own squares and drag it about — until he played
  // it on a phone: "on the current model of press on the item and drag, you
  // can't see where you're going because your thumb is on it." So the piece is
  // no longer somewhere you have to put your finger.
  //   MOVE   press ANYWHERE that is not a button and drag. "It will move the
  //          piece around... I just want it to be like the entire screen is a
  //          directional pad, more or less." The piece travels BY what the
  //          finger travelled, one square per square, and it never goes TO the
  //          finger: "I don't want it to jump to where you've pressed."
  //          Empty board, the source strip, the HUD, the piece itself — the
  //          gesture is the same wherever it starts, so the thumb can sit in
  //          the corner and leave the board in plain sight.
  //   TURN   tap BESIDE the piece. Right of the handle is clockwise, left is
  //          anticlockwise, straight above or below is neither.
  //   PLACE  tap the piece, on any of its squares — or within TAP_PAD of one
  //          of them (EVRTEK 2026-09-08), because a one-cell piece is a very
  //          small thing to hit and the miss lands on TURN.
  //   TUNE   tap a JUNCTION already on the board and it flips S<->M, and the
  //          piece does not turn (EVRTEK 2026-09-07: "can we just make that a
  //          single tap... it would not turn the active piece"). A junction
  //          outranks the turn rule, so only bare board beside the piece
  //          turns it.
  // Which is why the two TURN buttons are gone: turning is a gesture now, and
  // the only button left is the destructor. It also means a fat finger can no
  // longer spend a piece by tapping a square the piece is not on, because that
  // tap is a turn, and a turn is free.
  //
  // DRAG_SLOP is now the ONLY thing separating a move from a turn — the two
  // gestures start identically, on the same square — so it stays exactly where
  // it is: eight logical pixels, under a third of a cell, far enough that a
  // tapping finger's wobble is still a tap and near enough that a deliberate
  // drag is moving the piece before it has crossed one square.
  //
  // The whole thing is a state machine over _down/_move/_up/_cancel taking
  // LOGICAL canvas coordinates and a time in seconds. The DOM listeners below
  // do nothing but convert and call it, which is what lets the harness drive
  // every gesture in this file without a browser.
  var DRAG_SLOP = 8;      // logical px before a press becomes a drag
  var TAP_TIME  = 0.35;   // seconds a tap may last before it is a hold

  // EVRTEK 2026-09-08, after playing the phone build: "on mobile the box that
  // needs to be hit to commit the single block pieces is too small. Some
  // commit taps register as turns. Let's change that tolerance a bit."
  //
  // A one-cell piece was a 26px target on the phone, and a thumb landing five
  // pixels outside it TURNED the piece instead of placing it — the two
  // gestures are neighbours, so missing is not a near miss, it is the other
  // move. So the footprint carries a pad: a tap counts as ON the piece when
  // the press lands within TAP_PAD of any of its squares.
  //
  // In CELLS rather than pixels, so it scales with the layout: 10.4px at the
  // phone's cell of 26, 12px at the desktop's 30. It is an EXPANDED RECTANGLE
  // and not a circle, because the piece is made of squares and a corner that
  // reads as a miss on the diagonal is the same complaint again.
  var TAP_PAD   = 0.4;    // cells of slack around the footprint, on a tap

  // Wall time in seconds. Read only from inside a listener, so this module
  // still loads in Node, and read from ONE clock so a hold is measured
  // honestly however the events were stamped.
  function stamp() {
    if (typeof performance !== 'undefined' && performance.now) return performance.now() / 1000;
    return Date.now() / 1000;
  }

  // The rect under a point. LAST match wins: the renderer draws in order, so
  // the rect drawn last is the one on top, and the one a finger is aiming at.
  function hitAt(list, lx, ly) {
    var found = null, i, r;
    for (i = 0; i < list.length; i++) {
      r = list[i];
      if (lx >= r.x && ly >= r.y && lx < r.x + r.w && ly < r.y + r.h) found = r;
    }
    return found;
  }

  // Is that cell in a list of cells? Both lists this file is handed — the
  // piece's footprint and the junctions on the board — are plain {x,y}, so it
  // never learns what a piece or a junction is. A missing list is simply no
  // match, which is what lets an older caller leave one out.
  function inCells(list, cell) {
    if (!list || !cell) return false;
    for (var i = 0; i < list.length; i++) {
      if (list[i].x === cell.x && list[i].y === cell.y) return true;
    }
    return false;
  }

  // Is that cell one of the piece's own squares?
  function onFootprint(grip, cell) {
    return !!grip && inCells(grip.cells, cell);
  }

  // Is that POINT within TAP_PAD of one of them? Measured against each
  // square's rectangle, in logical pixels, so a press that fell off the piece
  // by less than the pad still counts as a press on it. It takes a point
  // rather than a cell on purpose: the pad reaches past the edge of the grid,
  // where there is no cell to name, which is what makes a piece parked on the
  // left-hand column as tappable as one in the middle.
  function nearFootprint(grip, L, px, py) {
    if (!grip || !L || !grip.cells) return false;
    var pad = TAP_PAD * L.cell, i, c, x0, y0, dx, dy;
    for (i = 0; i < grip.cells.length; i++) {
      c = grip.cells[i];
      x0 = L.gridX + c.x * L.cell;
      y0 = L.gridY + c.y * L.cell;
      dx = Math.max(x0 - px, px - (x0 + L.cell), 0);
      dy = Math.max(y0 - py, py - (y0 + L.cell), 0);
      if (dx <= pad && dy <= pad) return true;
    }
    return false;
  }

  // `opts.toLogical(clientX, clientY)` -> {x,y} in canvas coordinates,
  // `opts.layout()` -> the layout in force, `opts.hits()` -> the rects the
  // renderer is drawing on the current screen, and
  // `opts.piece()` -> null when there is nothing in hand, or
  //   { cells: [{x,y},...], handle: {x,y}, snip: bool, junctions: [{x,y},...] }
  // where `cells` is the piece's footprint ON THE BOARD, `handle` is the
  // square the rules call the cursor, and `junctions` is every cell of the
  // BOARD holding one (EVRTEK 2026-09-07 — a tap on one flips it). Everything
  // the scheme needs to tell ON from BESIDE from ON A JUNCTION, and nothing
  // else: no piece object, no rotation, no game. `junctions` is optional, so a
  // caller that leaves it out gets the old behaviour rather than a throw.
  // A null piece means NOTHING IS IN HAND — a front-end screen, or a run that
  // is over — and that is the one state where a drag says nothing at all,
  // because there is nothing on the board for the screen to be a d-pad for.
  // Listeners are attached only when a canvas is passed, so
  // `new Touch(null, opts)` is a pure object.
  function Touch(canvas, opts) {
    this.opts = opts || {};
    this.queue = [];
    this.reset();
    if (!canvas || !canvas.addEventListener) return;

    var self = this;
    // preventDefault on down and move so the page never scrolls, zooms or
    // hands the gesture to the browser halfway through a drag across the
    // board. The canvas also carries touch-action: none, and both are needed.
    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      // One finger at a time — but a down from the SAME pointer while one is
      // still tracked means its release never arrived (a mouse let go off the
      // canvas, a tab switch mid-press). Tron's patrol froze the game that
      // way, permanently. Start over instead. Capturing the pointer makes the
      // release arrive even when it happens off the canvas.
      if (self.pointerId !== null && self.pointerId !== e.pointerId) return;
      if (self.pointerId !== null) self._cancel();
      self.pointerId = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      var p = self.opts.toLogical(e.clientX, e.clientY);
      self._down(p.x, p.y, stamp());
    });
    canvas.addEventListener('pointermove', function (e) {
      e.preventDefault();
      if (self.pointerId !== e.pointerId) return;
      var p = self.opts.toLogical(e.clientX, e.clientY);
      self._move(p.x, p.y, stamp());
    });
    canvas.addEventListener('pointerup', function (e) {
      if (self.pointerId !== e.pointerId) return;
      self.pointerId = null;
      var p = self.opts.toLogical(e.clientX, e.clientY);
      self._up(p.x, p.y, stamp());
    });
    canvas.addEventListener('pointercancel', function (e) {
      if (self.pointerId !== e.pointerId) return;
      self.pointerId = null;
      self._cancel();
    });
  }

  // Gesture state only. The queue outlives a gesture on purpose: the command
  // it produced has not been read by a frame yet.
  Touch.prototype._clear = function () {
    this.active = false;
    this.dragging = false;
    this.pointerId = null;
    this.hit = null;      // the rect the press landed on, if any
    this.cell = null;     // the grid cell it landed on, if any
    this.grip = null;     // the piece as it was when the finger went down
    this.home = null;     // H0: where its handle was at that moment
    this.step = null;     // the last {col,row} a drag reported, in squares
    this.downX = 0; this.downY = 0; this.downT = 0;
  };

  // Everything, queue included. main.js calls this when the layout changes
  // under the player's finger, where a half-finished drag means nothing.
  Touch.prototype.reset = function () {
    this._clear();
    this.queue = [];
  };

  Touch.prototype._push = function (o) {
    var c = blank(), k;
    for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) c[k] = o[k];
    this.queue.push(c);
  };

  Touch.prototype._layout = function () {
    return this.opts.layout ? (this.opts.layout() || null) : null;
  };

  Touch.prototype._cellAt = function (lx, ly) {
    if (typeof CW_LAYOUT === 'undefined') return null;
    var L = this._layout();
    return L ? CW_LAYOUT.cellAt(L, lx, ly) : null;
  };

  Touch.prototype._down = function (lx, ly, t) {
    // A down while one is already active is one of two things. Within a
    // moment of the first it is a SECOND FINGER, and it is ignored — the first
    // keeps the gesture. Long after it, the first press's release was LOST (a
    // mouse let go off the canvas, a tab switch mid-press; Tron's patrol froze
    // the game that way for good), and the only sane thing is to begin again.
    // The DOM layer also filters by pointer id, so a different finger never
    // gets this far; the time rule is what makes the pure machine safe alone.
    if (this.active) {
      if (t - this.downT < 1.0) return;
      this._clear();
    }
    this.active = true;
    this.dragging = false;
    this.downX = lx; this.downY = ly; this.downT = t;
    var list = this.opts.hits ? (this.opts.hits() || []) : [];
    this.hit = hitAt(list, lx, ly);
    this.cell = this.hit ? null : this._cellAt(lx, ly);
    // The piece is read ONCE, here, and held for the rest of the gesture. It
    // moves while the finger is down — that is the whole point — so asking
    // again mid-drag would measure the travel against a piece that had already
    // travelled, and the piece would sprint away from the finger.
    // Read on ANY press that is not a button, not just one that landed on the
    // board (EVRTEK 2026-09-07): the whole screen is a d-pad now, so a drag
    // that begins on the source strip or the HUD has to know where the handle
    // started too.
    this.grip = (!this.hit && this.opts.piece) ? (this.opts.piece() || null) : null;
    // H0. Copied rather than aliased, so a caller handing out a live object
    // cannot have the origin of the drag shift under it.
    this.home = this.grip ? { x: this.grip.handle.x, y: this.grip.handle.y } : null;
    this.step = null;
  };

  Touch.prototype._move = function (lx, ly, t) {
    if (!this.active) return;
    if (!this.dragging) {
      var dx = lx - this.downX, dy = ly - this.downY;
      if (dx * dx + dy * dy > DRAG_SLOP * DRAG_SLOP) this.dragging = true;
    }
    // A press that started on a button is a button press, however far it
    // wanders. With nothing in hand there is nothing to drive, so a drag on
    // the front end says nothing at all.
    if (!this.dragging || this.hit || !this.grip) return;
    var L = this._layout();
    if (!L) return;
    // THE D-PAD RULE (EVRTEK 2026-09-07). The move is measured from where the
    // FINGER went down to where it is now, in whole squares, and added to
    // where the HANDLE was when it went down. Nothing here asks what is under
    // the finger, which is the point: the piece is never dragged TO anywhere,
    // so the thumb is never on top of what it is aiming at.
    //   round(), not floor(): the piece follows the NEAREST square of travel,
    // so it turns over at the half-cell rather than a full cell late.
    //   Measured from the down point every time rather than accumulated, so
    // dragging out past the edge and back returns the piece exactly where it
    // started however hard the rules clamped it in between.
    var col = Math.round((lx - this.downX) / L.cell);
    var row = Math.round((ly - this.downY) / L.cell);
    if (this.step && this.step.col === col && this.step.row === row) return;
    this.step = { col: col, row: row };
    // Off the board included: the rules clamp it back.
    this._push({ to: { x: this.home.x + col, y: this.home.y + row } });
  };

  Touch.prototype._up = function (lx, ly, t) {
    if (!this.active) return;
    var held = t - this.downT, drag = this.dragging, hit = this.hit, cell = this.cell;
    var grip = this.grip;
    // The DOWN point, kept for the same reason the CELL is resolved on the way
    // down: that is where the finger landed, and the pad below has to measure
    // against the aim rather than the release.
    var px = this.downX, py = this.downY, L = this._layout();
    this._clear();
    // A drag already said everything it had to say, one `to` at a time, and a
    // press held past TAP_TIME was someone thinking rather than tapping.
    if (drag) return;
    // A button is a button however long it was held — plenty of people press
    // slowly (Tron's patrol). The board keeps the tap window, where a long
    // press is someone thinking.
    if (!hit && held > TAP_TIME) return;
    if (hit) {
      // CUT is the only play-screen button left, and it becomes the command
      // the rules already understand, so the game never learns there are
      // buttons at all. Everything else is a front-end control and travels by
      // name.
      if (hit.id === 'cut') this._push({ destroy: true });
      else this._push({ pick: hit.id });
      return;
    }
    // Nothing in hand — a front-end screen, or a run that is over, or a caller
    // that supplies no piece at all — so the cell itself is all there is to
    // report, and the rules ignore it everywhere it does not mean anything.
    // First now, because every rule below is about a piece, and one of them
    // fires with no cell at all.
    if (!grip) { if (cell) this._push({ tap: cell }); return; }
    // The cell resolved on the way DOWN, not on the way up: that is the square
    // the finger landed on, and a tap that drifts four pixels over a boundary
    // should not mean a different one.
    //
    // ON the piece is PLACE, wherever on it the finger landed: it is reported
    // as the HANDLE, because a tap on the handle is what the rules already
    // read as commit. Tuning comes free with it — handle on a junction, tap
    // the piece, and commit tunes. In the destructor the same tap is the cut.
    if (onFootprint(grip, cell)) { this._push({ tap: { x: grip.handle.x, y: grip.handle.y } }); return; }
    // BESIDE it, in the destructor: NOTHING. The cross used to jump to the tap,
    // and a jump is precisely what EVRTEK 2026-09-07 ruled out — "I don't want
    // it to jump to where you've pressed" — so the cross is moved the one way
    // everything else is now, by dragging. Which leaves the destructor with two
    // gestures and no third: drag it about, tap it to cut.
    // The pad applies in here too, since the miss it fixes is the same one: a
    // press on a corner of the cross's 3x3 box is aimed at the cross, and the
    // only thing a tap does in the destructor is cut.
    if (grip.snip) {
      if (nearFootprint(grip, L, px, py)) {
        this._push({ tap: { x: grip.handle.x, y: grip.handle.y } });
      }
      return;
    }
    // A JUNCTION ALREADY ON THE BOARD OUTRANKS THE TURN (EVRTEK 2026-09-07:
    // "on mobile to toggle S vs M can we just make that a single tap... it
    // would not turn the active piece, instead only the toggle would occur").
    // Checked before the column comparison on purpose, so a junction straight
    // above or below the handle — which the turn rule ignores — still flips.
    // An EXACT junction cell also outranks the PAD, so a junction sitting in
    // the square right beside the piece is still tappable: the pad is there to
    // catch a miss, and a finger on a junction did not miss.
    if (inCells(grip.junctions, cell)) {
      this._push({ tune: { x: cell.x, y: cell.y } });
      return;
    }
    // NEAR the piece is ON it (EVRTEK 2026-09-08). Measured from the point
    // rather than the cell, so this can fire with no cell at all — a press
    // just off the edge of the grid, beside a piece in the edge column.
    if (nearFootprint(grip, L, px, py)) {
      this._push({ tap: { x: grip.handle.x, y: grip.handle.y } });
      return;
    }
    // Off the grid and not near the piece: there is nothing to turn towards.
    if (!cell) return;
    // Otherwise it is a TURN (EVRTEK 2026-09-07): right of the handle is
    // clockwise, left is anticlockwise, and the same column is neither, so a
    // tap straight above or below the piece is ignored rather than guessed at.
    if (cell.x > grip.handle.x) this._push({ rot: 1 });
    else if (cell.x < grip.handle.x) this._push({ rot: -1 });
  };

  Touch.prototype._cancel = function () { this._clear(); };

  // One command per frame. Consecutive drag positions COALESCE to the latest
  // one — a finger crossing the board produces a position every few
  // milliseconds, and playing them back one frame at a time would have the
  // handle trailing the finger by half a second.
  Touch.prototype.command = function () {
    if (!this.queue.length) return blank();
    var c = this.queue.shift();
    if (c.to) {
      while (this.queue.length && this.queue[0].to) c = this.queue.shift();
    }
    return c;
  };

  // Honest readout for the one thing CLU cannot test without hardware:
  // whether the Gamepad API actually reports a pad from this page's origin.
  function padReport() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) {
      return { supported: false, pads: [] };
    }
    var pads = navigator.getGamepads(), out = [];
    for (var i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) {
        out.push({ index: i, id: (pads[i].id || 'pad').slice(0, 34), mapping: pads[i].mapping || '?' });
      }
    }
    return { supported: true, pads: out };
  }

  return {
    Controller: Controller, Keyboard: Keyboard, Touch: Touch, padReport: padReport,
    blank: blank,
    KEYS_P1: KEYS_P1, KEYS_P2: KEYS_P2, DAS_DELAY: DAS_DELAY, DAS_RATE: DAS_RATE,
    DRAG_SLOP: DRAG_SLOP, TAP_TIME: TAP_TIME, TAP_PAD: TAP_PAD
  };
})();
