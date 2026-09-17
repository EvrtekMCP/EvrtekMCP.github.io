'use strict';
// CROSSWIRE — layout.
//
// EVRTEK 2026-09-07: "can we make the game mobile friendly as well... the
// game would need to detect on load which version is to be used." Portrait
// only, on his ruling, iPhone first.
//
// The board is 10 wide and 17 tall — phone-shaped already — so the play
// field drops into portrait as it is. Everything AROUND it does not: the side
// panels, the bars, the keyboard. So every position the renderer used to
// hold as a constant is a field of a LAYOUT, and there are two: the desktop
// one, which is exactly the numbers the game has always had, and a portrait
// one at 400x800 logical pixels with the piece preview above the board and
// the touch controls below it. The renderer scales the canvas to whatever
// screen it is on; the layout never changes shape mid-screen.
var CW_LAYOUT = (function () {

  // THE GRID, as this file understands it. It was ten by TWENTY until EVRTEK
  // 2026-09-14: "let's reduce the board size by 3 rows, those rows should be
  // replaced by the 'shredder' and two storage bins."
  //
  // These two numbers are the rules' CW_GAME.GRID_W and GRID_H, written out
  // again here rather than read: layout.js loads BEFORE game.js in index.html
  // and in the harness, and has to be pure at load time. The harness proves
  // the pair against the rules on every run, so the two cannot drift apart
  // without a red line.
  var COLS = 10, ROWS = 17;

  // EVRTEK 2026-09-14, THE STRIP: "the player can drag a piece on to the
  // shredder and it is disintegrated... the player can also drag a piece onto
  // one of the storage bins to hold it for later."
  //
  // Three targets in a row: SHRED, BIN 1, BIN 2. The shredder is on the LEFT
  // rather than in the middle on purpose — the middle is where a straight drag
  // down from the centre of the board lands, and the target you hit by
  // accident should be the harmless one.
  //
  // Published as RECTS, the same shape the renderer's hit list uses, so a
  // finger and a mouse both reach them through exactly one set of numbers.
  function strip(y, h, x0, w, gap) {
    var ids = ['shred', 'bin0', 'bin1'];
    var labels = ['SHRED', 'BIN 1', 'BIN 2'];
    var keys = ['X', '1', '2'];
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      out.push({
        id: ids[i], label: labels[i], key: keys[i],
        x: x0 + i * (w + gap), y: y, w: w, h: h
      });
    }
    return { y: y, h: h, targets: out };
  }

  function desktop() {
    // 78 + 17 * 30 = 588 on a 700px canvas: the three rows the board gave up
    // are ninety pixels of daylight under it, and the strip lives in them. It
    // is exactly as wide as the grid (100 to 400), so it reads as three slots
    // cut into the bottom of the rig rather than a toolbar parked nearby.
    return {
      mode: 'desktop', mobile: false, lite: false,
      W: 920, H: 700, cell: 30,
      gridX: 100, gridY: 78,
      srcX: 56, srcW: 40,
      barX: 24, barW: 20, bar2X: 660, bar2W: 20,
      tgtX: 410, bulbR: 14, bulbCx: 434, statX: 486,
      pieceX: 692, pieceW: 204,
      strip: strip(610, 74, 100, 92, 12),
      buttons: []
    };
  }

  // Portrait. Cells are 26px logical, which on a 390px-wide phone is about
  // 25 real pixels: big enough to tap, small enough that seventeen rows plus
  // a piece row, the strip and the controls fit in one screen with nothing
  // scrolling.
  // Left of the grid: the clock strip and the sources. Right: the demand
  // bulbs and the surge strip. Above: the piece in hand and the next two.
  // Below: the shredder and the two bins, then CUT, a hint line, the toasts.
  //
  // EVRTEK 2026-09-07: the two TURN pads are GONE. Turning is a tap beside the
  // piece now, so the only button left is the destructor — and it gets the
  // whole width, which is the easiest thing on the screen to hit by accident
  // and the easiest to hit on purpose. It is also the one control with no
  // gesture of its own, because arming a mode is not a move.
  function mobile() {
    var cell = 26, gridX = 58, gridY = 132;
    return {
      mode: 'mobile', mobile: true, lite: true,
      W: 400, H: 800, cell: cell,
      gridX: gridX, gridY: gridY,
      srcX: 20, srcW: 36,
      barX: 6, barW: 10, bar2X: 384, bar2W: 10,
      tgtX: gridX + COLS * cell, bulbR: 11,
      bulbCx: gridX + COLS * cell + 22, statX: gridX + COLS * cell + 40,
      pieceX: 58, pieceW: 110,
      hudY: 14,
      piece: { x: 58, y: 64, w: 110, h: 60 },
      next: [{ x: 176, y: 64, w: 66, h: 60 }, { x: 250, y: 64, w: 66, h: 60 }],
      cut: { x: 324, y: 64, w: 70, h: 60 },
      // 132 + 17 * 26 = 574, and the grid's frame ends at 578. The strip runs
      // 592 to 656 and CUT starts at 668, so there are twelve clear pixels
      // either side of it: enough that a thumb aimed at CUT does not stash,
      // and that one aimed at BIN 2 does not arm the destructor.
      strip: strip(592, 64, 20, 112, 12),
      buttons: [
        { id: 'cut', x: 20, y: 668, w: 360, h: 60, label: 'CUT', glyph: 'cut' }
      ],
      hintY: 748,
      toastY: 770
    };
  }

  // Which one. A coarse pointer (a finger) on a narrow or tall screen means
  // a phone. `force` is for testing: ?mode=mobile on the URL picks it on a
  // desktop browser, ?mode=desktop the other way.
  function pick(env) {
    env = env || {};
    if (env.force === 'mobile') return 'mobile';
    if (env.force === 'desktop') return 'desktop';
    var coarse = !!env.coarse, w = env.w || 0, h = env.h || 0;
    if (coarse && (w < 760 || h > w)) return 'mobile';
    return 'desktop';
  }

  function forMode(mode) { return mode === 'mobile' ? mobile() : desktop(); }

  function overlaps(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }

  // Does a layout actually hold together: the grid inside the canvas, the
  // controls inside the canvas and clear of the grid, every button big
  // enough for a thumb. Pure, so the harness can prove both layouts.
  function fits(L) {
    var gridR = L.gridX + COLS * L.cell, gridB = L.gridY + ROWS * L.cell;
    if (gridR > L.W || gridB > L.H || L.gridX < 0 || L.gridY < 0) return 'grid off canvas';
    if (L.bar2X + L.bar2W > L.W) return 'surge bar off canvas';
    for (var i = 0; i < L.buttons.length; i++) {
      var b = L.buttons[i];
      if (b.x < 0 || b.y < 0 || b.x + b.w > L.W || b.y + b.h > L.H) return b.id + ' off canvas';
      if (b.y < gridB) return b.id + ' overlaps the grid';
      if (b.h < 44 || b.w < 44) return b.id + ' too small for a thumb';
      for (var j = i + 1; j < L.buttons.length; j++) {
        if (overlaps(b, L.buttons[j])) return b.id + ' overlaps ' + L.buttons[j].id;
      }
    }
    // THE STRIP, held to the same terms as a button and for the same reason:
    // it is three things a thumb has to hit, under the board, clear of
    // everything else on the screen that answers a press.
    if (L.strip) {
      var ts = L.strip.targets, k, m, t;
      if (!ts || ts.length !== 3) return 'the strip is not three targets';
      for (k = 0; k < ts.length; k++) {
        t = ts[k];
        if (t.x < 0 || t.y < 0 || t.x + t.w > L.W || t.y + t.h > L.H) return t.id + ' off canvas';
        if (t.y < gridB) return t.id + ' overlaps the grid';
        if (t.h < 44 || t.w < 44) return t.id + ' too small for a thumb';
        for (m = k + 1; m < ts.length; m++) {
          if (overlaps(t, ts[m])) return t.id + ' overlaps ' + ts[m].id;
        }
        for (m = 0; m < L.buttons.length; m++) {
          if (overlaps(t, L.buttons[m])) return t.id + ' overlaps ' + L.buttons[m].id;
        }
      }
    }
    if (L.mobile && L.piece.y + L.piece.h > L.gridY) return 'piece row overlaps the grid';
    if (L.mobile && L.cell < 24) return 'cells too small to tap';
    return null;
  }

  // The cell under a logical point, or null.
  function cellAt(L, lx, ly) {
    var x = Math.floor((lx - L.gridX) / L.cell), y = Math.floor((ly - L.gridY) / L.cell);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
    return { x: x, y: y };
  }

  return { desktop: desktop, mobile: mobile, pick: pick, forMode: forMode,
           fits: fits, cellAt: cellAt, COLS: COLS, ROWS: ROWS };
})();
