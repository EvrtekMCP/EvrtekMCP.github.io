'use strict';
// CROSSWIRE — layout.
//
// EVRTEK 2026-09-07: "can we make the game mobile friendly as well... the
// game would need to detect on load which version is to be used." Portrait
// only, on his ruling, iPhone first.
//
// The board is 10 wide and 20 tall — phone-shaped already — so the play
// field drops into portrait as it is. Everything AROUND it does not: the side
// panels, the bars, the keyboard. So every position the renderer used to
// hold as a constant is a field of a LAYOUT, and there are two: the desktop
// one, which is exactly the numbers the game has always had, and a portrait
// one at 400x800 logical pixels with the piece preview above the board and
// the touch controls below it. The renderer scales the canvas to whatever
// screen it is on; the layout never changes shape mid-screen.
var CW_LAYOUT = (function () {

  function desktop() {
    return {
      mode: 'desktop', mobile: false, lite: false,
      W: 920, H: 700, cell: 30,
      gridX: 100, gridY: 78,
      srcX: 56, srcW: 40,
      barX: 24, barW: 20, bar2X: 660, bar2W: 20,
      tgtX: 410, bulbR: 14, bulbCx: 434, statX: 486,
      pieceX: 692, pieceW: 204,
      buttons: []
    };
  }

  // Portrait. Cells are 26px logical, which on a 390px-wide phone is about
  // 25 real pixels: big enough to tap, small enough that twenty rows plus a
  // piece row plus the controls fit in one screen with nothing scrolling.
  // Left of the grid: the clock strip and the sources. Right: the demand
  // bulbs and the surge strip. Above: the piece in hand and the next two.
  // Below: CUT, a hint line, and the toasts.
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
      tgtX: gridX + 10 * cell, bulbR: 11, bulbCx: gridX + 10 * cell + 22, statX: gridX + 10 * cell + 40,
      pieceX: 58, pieceW: 110,
      hudY: 14,
      piece: { x: 58, y: 64, w: 110, h: 60 },
      next: [{ x: 176, y: 64, w: 66, h: 60 }, { x: 250, y: 64, w: 66, h: 60 }],
      cut: { x: 324, y: 64, w: 70, h: 60 },
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

  // Does a layout actually hold together: the grid inside the canvas, the
  // controls inside the canvas and clear of the grid, every button big
  // enough for a thumb. Pure, so the harness can prove both layouts.
  function fits(L) {
    var gridR = L.gridX + 10 * L.cell, gridB = L.gridY + 20 * L.cell;
    if (gridR > L.W || gridB > L.H || L.gridX < 0 || L.gridY < 0) return 'grid off canvas';
    if (L.bar2X + L.bar2W > L.W) return 'surge bar off canvas';
    for (var i = 0; i < L.buttons.length; i++) {
      var b = L.buttons[i];
      if (b.x < 0 || b.y < 0 || b.x + b.w > L.W || b.y + b.h > L.H) return b.id + ' off canvas';
      if (b.y < gridB) return b.id + ' overlaps the grid';
      if (b.h < 44 || b.w < 44) return b.id + ' too small for a thumb';
      for (var j = i + 1; j < L.buttons.length; j++) {
        var c = L.buttons[j];
        if (b.x < c.x + c.w && c.x < b.x + b.w && b.y < c.y + c.h && c.y < b.y + b.h) return b.id + ' overlaps ' + c.id;
      }
    }
    if (L.mobile && L.piece.y + L.piece.h > L.gridY) return 'piece row overlaps the grid';
    if (L.mobile && L.cell < 24) return 'cells too small to tap';
    return null;
  }

  // The cell under a logical point, or null.
  function cellAt(L, lx, ly) {
    var x = Math.floor((lx - L.gridX) / L.cell), y = Math.floor((ly - L.gridY) / L.cell);
    if (x < 0 || y < 0 || x >= 10 || y >= 20) return null;
    return { x: x, y: y };
  }

  return { desktop: desktop, mobile: mobile, pick: pick, forMode: forMode, fits: fits, cellAt: cellAt };
})();
