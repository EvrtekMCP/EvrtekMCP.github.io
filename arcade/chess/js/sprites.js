/* 8-BIT GAMBIT -- chess piece pixel sprites + sprite drawing helpers.
 *
 * Sprites are 16x16 grids of characters:
 *   '.' transparent   '#' outline   'X' base fill   'o' highlight   's' shade
 * The same shapes are used for both sides; a color map recolors them.
 */
(function () {
  'use strict';

  var P = window.Palette;

  var PIECE_SPRITES = {
    p: [
      '................',
      '................',
      '................',
      '.....######.....',
      '....#oXXXXs#....',
      '....#oXXXXs#....',
      '....#oXXXXs#....',
      '.....#XXXs#.....',
      '....##XXXX##....',
      '....#oXXXXs#....',
      '.....#XXXs#.....',
      '.....#XXXs#.....',
      '....#oXXXXs#....',
      '...#oXXXXXXs#...',
      '..#oXXXXXXXXs#..',
      '..############..'
    ],
    n: [
      '................',
      '....##..........',
      '...#Xo##........',
      '..#XXXXo#.......',
      '.#XXXXXXo##.....',
      '.#XoXXXXXXo#....',
      '#XoXXXXXXXXs#...',
      '#Xo#XXXXXXXs#...',
      '#o#.#XXXXXs#....',
      '....#XXXXXs#....',
      '...#XXXXXXs#....',
      '...#XXXXXXXs#...',
      '..#XXXXXXXXs#...',
      '..#XXXXXXXXXs#..',
      '.#XXXXXXXXXXs#..',
      '.#############..'
    ],
    b: [
      '................',
      '.......##.......',
      '......#oo#......',
      '.....#oXXX#.....',
      '.....#oX#Xs#....',
      '....#oXX#XXs#...',
      '....#oXXXXXs#...',
      '.....#XXXXs#....',
      '......####......',
      '.....#oXXs#.....',
      '.....#oXXs#.....',
      '......#XX#......',
      '.....#XXXX#.....',
      '...##XXXXXX##...',
      '..#XXXXXXXXXX#..',
      '..############..'
    ],
    r: [
      '................',
      '..##..####..##..',
      '..#X##XXXX##X#..',
      '..#XXXXXXXXXs#..',
      '...#XXXXXXXs#...',
      '....#XXXXXs#....',
      '....#oXXXXs#....',
      '....#oXXXXs#....',
      '....#oXXXXs#....',
      '....#oXXXXs#....',
      '....#oXXXXs#....',
      '....#XXXXXs#....',
      '...#oXXXXXXs#...',
      '..#oXXXXXXXXs#..',
      '.#XXXXXXXXXXXX#.',
      '.##############.'
    ],
    q: [
      '................',
      '..#...#..#...#..',
      '.#X#.#X##X#.#X#.',
      '.#XX##XXXX##XX#.',
      '.#XXXXXXXXXXXs#.',
      '..#XXXXXXXXXs#..',
      '...#oXXXXXXs#...',
      '....#oXXXXs#....',
      '....##XXXX##....',
      '.....#XXXs#.....',
      '.....#XXXs#.....',
      '....#oXXXXs#....',
      '...#oXXXXXXs#...',
      '..#oXXXXXXXXs#..',
      '.#XXXXXXXXXXXX#.',
      '.##############.'
    ],
    k: [
      '.......##.......',
      '.....######.....',
      '.......##.......',
      '....##XXXX##....',
      '...#XXXXXXXX#...',
      '...#oXXXXXXs#...',
      '....#oXXXXs#....',
      '....#oXXXXs#....',
      '....##XXXX##....',
      '.....#XXXs#.....',
      '.....#XXXs#.....',
      '....#oXXXXs#....',
      '...#oXXXXXXs#...',
      '..#oXXXXXXXXs#..',
      '.#XXXXXXXXXXXX#.',
      '.##############.'
    ]
  };

  function pieceColorMap(color) {
    if (color === 'w') {
      return { '#': P.outline, 'X': P.wBase, 'o': P.wHi, 's': P.wSh };
    }
    return { '#': P.outline, 'X': P.bBase, 'o': P.bHi, 's': P.bSh };
  }

  /* Draw a sprite with 1 grid cell = `scale` canvas pixels (default 1). */
  function drawSprite(ctx, rows, x, y, colorMap, scale) {
    scale = scale || 1;
    for (var ry = 0; ry < rows.length; ry++) {
      var row = rows[ry];
      for (var rx = 0; rx < row.length; rx++) {
        var ch = row[rx];
        if (ch === '.') continue;
        var c = colorMap[ch];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x + rx * scale, y + ry * scale, scale, scale);
      }
    }
  }

  /* Sanity-check sprite grids; logs (does not throw) so art bugs are visible in console. */
  function validateGrid(name, rows, w, h) {
    if (rows.length !== h) {
      console.error('[sprites] ' + name + ': expected ' + h + ' rows, got ' + rows.length);
    }
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].length !== w) {
        console.error('[sprites] ' + name + ' row ' + i + ': expected width ' + w + ', got ' + rows[i].length + ' ("' + rows[i] + '")');
      }
    }
  }

  Object.keys(PIECE_SPRITES).forEach(function (k) {
    validateGrid('piece:' + k, PIECE_SPRITES[k], 16, 16);
  });

  window.Sprites = {
    PIECE_SPRITES: PIECE_SPRITES,
    pieceColorMap: pieceColorMap,
    drawSprite: drawSprite,
    validateGrid: validateGrid
  };
})();
