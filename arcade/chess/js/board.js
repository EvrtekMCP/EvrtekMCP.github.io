/* 8-BIT GAMBIT -- canvas chess board: rendering + pointer input.
 *
 * The canvas runs at a tiny internal resolution (1 sprite pixel = 1 canvas
 * pixel) and is scaled up with CSS image-rendering: pixelated, so everything
 * stays perfectly chunky.
 *
 * Layout: 14px frame + 8 squares x 20px + 14px frame = 188x188.
 */
(function () {
  'use strict';

  var P = window.Palette;
  var S = window.Sprites;

  var SQ = 20, FRAME = 14, SIZE = FRAME * 2 + SQ * 8;
  var FILES = 'abcdefgh';

  var canvas = null, ctx = null, handlers = {};
  var state = {
    game: null,
    orientation: 'w',
    selected: null,        // 'e2'
    legalMoves: [],        // verbose moves from selected square
    lastMove: null,        // {from,to}
    interactive: false,
    playerColor: 'w'
  };
  var drag = null;         // {from, x, y, piece, moved}
  var effects = [];        // {type:'flash'|'shake', square?, start, dur}
  var rafId = null;

  /* ---- square <-> screen mapping -------------------------------- */

  function squareToGrid(square) {
    var f = FILES.indexOf(square[0]);
    var r = parseInt(square[1], 10) - 1;         // 0 = rank 1
    var col = state.orientation === 'w' ? f : 7 - f;
    var row = state.orientation === 'w' ? 7 - r : r;
    return { col: col, row: row };
  }

  function gridToSquare(col, row) {
    var f = state.orientation === 'w' ? col : 7 - col;
    var r = state.orientation === 'w' ? 7 - row : row;
    if (f < 0 || f > 7 || r < 0 || r > 7) return null;
    return FILES[f] + (r + 1);
  }

  function pointToSquare(x, y) {
    var col = Math.floor((x - FRAME) / SQ);
    var row = Math.floor((y - FRAME) / SQ);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return gridToSquare(col, row);
  }

  function canvasPoint(ev) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left) * (SIZE / rect.width),
      y: (ev.clientY - rect.top) * (SIZE / rect.height)
    };
  }

  /* ---- effects --------------------------------------------------- */

  function addEffect(type, square, dur) {
    effects.push({ type: type, square: square, start: performance.now(), dur: dur || 220 });
  }

  /* ---- rendering ------------------------------------------------- */

  function render() {
    if (!ctx) return;
    var now = performance.now();
    effects = effects.filter(function (e) { return now - e.start < e.dur; });

    var shake = effects.find(function (e) { return e.type === 'shake'; });
    var ox = 0, oy = 0;
    if (shake) {
      var phase = Math.floor((now - shake.start) / 40);
      ox = (phase % 2 === 0) ? 1 : -1;
    }

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.translate(ox, oy);

    /* frame */
    ctx.fillStyle = P.frame;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = P.frameEdge;
    ctx.fillRect(0, 0, SIZE, 2); ctx.fillRect(0, SIZE - 2, SIZE, 2);
    ctx.fillRect(0, 0, 2, SIZE); ctx.fillRect(SIZE - 2, 0, 2, SIZE);
    ctx.fillRect(FRAME - 2, FRAME - 2, SQ * 8 + 4, 2);
    ctx.fillRect(FRAME - 2, FRAME + SQ * 8, SQ * 8 + 4, 2);
    ctx.fillRect(FRAME - 2, FRAME - 2, 2, SQ * 8 + 4);
    ctx.fillRect(FRAME + SQ * 8, FRAME - 2, 2, SQ * 8 + 4);

    /* coordinates */
    ctx.fillStyle = '#c9a06a';
    ctx.font = '8px "PS2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < 8; i++) {
      var fileChar = state.orientation === 'w' ? FILES[i] : FILES[7 - i];
      var rankChar = state.orientation === 'w' ? String(8 - i) : String(i + 1);
      ctx.fillText(fileChar.toUpperCase(), FRAME + i * SQ + SQ / 2, SIZE - FRAME / 2);
      ctx.fillText(rankChar, FRAME / 2, FRAME + i * SQ + SQ / 2);
    }

    var board = state.game ? state.game.board() : null;

    /* find checked king for glow */
    var checkedKing = null;
    if (state.game && state.game.inCheck()) {
      var turn = state.game.turn();
      outer:
      for (var r = 0; r < 8; r++) {
        for (var f = 0; f < 8; f++) {
          var pc = board[r][f];
          if (pc && pc.type === 'k' && pc.color === turn) {
            checkedKing = FILES[f] + (8 - r);
            break outer;
          }
        }
      }
    }

    /* squares */
    for (var row = 0; row < 8; row++) {
      for (var col = 0; col < 8; col++) {
        var sqName = gridToSquare(col, row);
        var fIdx = FILES.indexOf(sqName[0]);
        var rIdx = parseInt(sqName[1], 10) - 1;
        var light = (fIdx + rIdx) % 2 === 1;
        var x = FRAME + col * SQ, y = FRAME + row * SQ;

        ctx.fillStyle = light ? P.sqLight : P.sqDark;
        ctx.fillRect(x, y, SQ, SQ);

        if (state.lastMove && (sqName === state.lastMove.from || sqName === state.lastMove.to)) {
          ctx.fillStyle = P.lastMove;
          ctx.fillRect(x, y, SQ, SQ);
        }
        if (checkedKing === sqName) {
          ctx.fillStyle = P.checkGlow;
          ctx.fillRect(x, y, SQ, SQ);
        }
        if (state.selected === sqName) {
          ctx.fillStyle = P.selOutline;
          ctx.fillRect(x, y, SQ, 2); ctx.fillRect(x, y + SQ - 2, SQ, 2);
          ctx.fillRect(x, y, 2, SQ); ctx.fillRect(x + SQ - 2, y, 2, SQ);
        }
      }
    }

    /* capture flashes under pieces */
    effects.forEach(function (e) {
      if (e.type !== 'flash' || !e.square) return;
      var g = squareToGrid(e.square);
      var alpha = 1 - (now - e.start) / e.dur;
      ctx.fillStyle = 'rgba(255,255,255,' + (alpha * 0.8).toFixed(2) + ')';
      ctx.fillRect(FRAME + g.col * SQ, FRAME + g.row * SQ, SQ, SQ);
    });

    /* pieces */
    if (board) {
      for (var br = 0; br < 8; br++) {
        for (var bf = 0; bf < 8; bf++) {
          var piece = board[br][bf];
          if (!piece) continue;
          var name = FILES[bf] + (8 - br);
          if (drag && drag.moved && drag.from === name) continue;   // being dragged
          var g2 = squareToGrid(name);
          var px = FRAME + g2.col * SQ + 2;
          var py = FRAME + g2.row * SQ + 2;
          if (state.selected === name && !drag) py -= 1;            // little lift
          S.drawSprite(ctx, S.PIECE_SPRITES[piece.type], px, py, S.pieceColorMap(piece.color), 1);
        }
      }
    }

    /* legal move markers on top of pieces (visible on captures) */
    if (state.selected && state.legalMoves.length) {
      state.legalMoves.forEach(function (m) {
        var g3 = squareToGrid(m.to);
        var cx = FRAME + g3.col * SQ, cy = FRAME + g3.row * SQ;
        if (m.captured || m.flags.indexOf('e') !== -1) {
          ctx.fillStyle = P.captureRing;      /* corner ticks = capture */
          ctx.fillRect(cx + 1, cy + 1, 4, 2); ctx.fillRect(cx + 1, cy + 1, 2, 4);
          ctx.fillRect(cx + SQ - 5, cy + 1, 4, 2); ctx.fillRect(cx + SQ - 3, cy + 1, 2, 4);
          ctx.fillRect(cx + 1, cy + SQ - 3, 4, 2); ctx.fillRect(cx + 1, cy + SQ - 5, 2, 4);
          ctx.fillRect(cx + SQ - 5, cy + SQ - 3, 4, 2); ctx.fillRect(cx + SQ - 3, cy + SQ - 5, 2, 4);
        } else {
          ctx.fillStyle = P.legalDot;
          ctx.fillRect(cx + SQ / 2 - 2, cy + SQ / 2 - 2, 4, 4);
        }
      });
    }

    /* dragged piece rides the cursor */
    if (drag && drag.moved && drag.piece) {
      var dx = Math.round(drag.x - 8), dy = Math.round(drag.y - 10);
      S.drawSprite(ctx, S.PIECE_SPRITES[drag.piece.type], dx, dy, S.pieceColorMap(drag.piece.color), 1);
    }

    ctx.restore();
  }

  function loop() {
    render();
    rafId = requestAnimationFrame(loop);
  }

  /* ---- input ----------------------------------------------------- */

  function onPointerDown(ev) {
    if (!state.interactive || !state.game) return;
    if (ev.button !== undefined && ev.button !== 0) return;   // left/touch/pen only
    if (drag) return;                                          // one pointer drives
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic events */ }
    var pt = canvasPoint(ev);
    var sq = pointToSquare(pt.x, pt.y);
    if (!sq) return;
    var piece = state.game.get(sq);
    if (piece && piece.color === state.playerColor) {
      drag = { from: sq, x: pt.x, y: pt.y, piece: piece, moved: false, pointerId: ev.pointerId };
      if (handlers.onSelect) handlers.onSelect(sq);
    } else if (state.selected) {
      if (handlers.onMoveAttempt) handlers.onMoveAttempt(state.selected, sq);
    }
  }

  function onPointerMove(ev) {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    var pt = canvasPoint(ev);
    if (!drag.moved) {
      if (drag.startX === undefined) { drag.startX = pt.x; drag.startY = pt.y; }
      if (Math.abs(pt.x - drag.startX) > 3 || Math.abs(pt.y - drag.startY) > 3) drag.moved = true;
    }
    drag.x = pt.x; drag.y = pt.y;
  }

  function onPointerUp(ev) {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    var pt = canvasPoint(ev);
    var target = pointToSquare(pt.x, pt.y);
    var from = drag.from;
    drag = null;
    if (!target) { render(); return; }
    if (target === from) {
      /* click in place: keep selection (click-click flow) */
      render();
      return;
    }
    if (handlers.onMoveAttempt) handlers.onMoveAttempt(from, target);
  }

  /* interrupted gestures (device rotation, app switch, capture loss) must
   * not leave a ghost drag that a later tap would replay as a move */
  function onPointerCancel(ev) {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    drag = null;
    render();
  }

  /* ---- public API ------------------------------------------------ */

  window.Board = {
    SIZE: SIZE,
    setup: function (canvasEl, h) {
      canvas = canvasEl;
      handlers = h || {};
      canvas.width = SIZE; canvas.height = SIZE;
      ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerCancel);
      canvas.addEventListener('lostpointercapture', onPointerCancel);
      canvas.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
      if (!rafId) loop();
    },
    update: function (partial) {
      Object.keys(partial).forEach(function (k) { state[k] = partial[k]; });
      render();   // state changes paint immediately even if rAF is throttled
    },
    getState: function () { return state; },
    addEffect: addEffect,
    render: render
  };
})();
