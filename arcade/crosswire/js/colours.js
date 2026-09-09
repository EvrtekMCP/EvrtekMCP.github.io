'use strict';
// CROSSWIRE — the colour model.
//
// PAINT, on Evrtek's ruling: red, yellow and blue mixing to orange, green and
// purple, because that is what everyone already knows.
//
// NO TERTIARIES, on his ruling 2026-09-06: "the idea of the tertiary colours is
// just too complicated." Dropping them collapses the model back to something
// far simpler than the parts arithmetic it replaced. Six colours, and a colour
// is one bit per primary:
//
//   RED 1   YELLOW 2   BLUE 4
//   ORANGE 3 (R|Y)   PURPLE 5 (R|B)   GREEN 6 (Y|B)
//   all three = 7, which is not a colour anyone wants and never appears as a
//   demand; a valve fed that way SHORTS instead.
//
// Blending is one bitwise OR, and red plus red is still red for free.
//
// Every colour also carries a SHAPE. The whole mechanic is colour
// identification, so without one a colourblind player cannot play at all. The
// shapes are drawn as paths, never as text, so they need no font.
var CW_COLOUR = (function () {

  var RED = 1, YELLOW = 2, BLUE = 4;
  var ORANGE = 3, PURPLE = 5, GREEN = 6;
  var BAD = 7;                       // all three: not a colour, a mistake

  var PRIMARIES = [RED, YELLOW, BLUE];
  var SECONDARIES = [ORANGE, GREEN, PURPLE];

  var INFO = {};
  INFO[RED] = { name: 'RED', hex: '#ff3b30', shape: 'tri' };
  INFO[YELLOW] = { name: 'YELLOW', hex: '#ffd60a', shape: 'sqr' };
  INFO[BLUE] = { name: 'BLUE', hex: '#3b7bff', shape: 'cir' };
  INFO[ORANGE] = { name: 'ORANGE', hex: '#ff8c1a', shape: 'dia' };
  INFO[GREEN] = { name: 'GREEN', hex: '#35c759', shape: 'hex' };
  INFO[PURPLE] = { name: 'PURPLE', hex: '#a05cff', shape: 'str' };
  INFO[BAD] = { name: 'MUD', hex: '#7a6a58', shape: 'mud' };

  function known(c) { return c === RED || c === YELLOW || c === BLUE ||
    c === ORANGE || c === GREEN || c === PURPLE; }
  // Nothing is NONE, not MUD: naming a dark wire "mud" would send a player
  // hunting for a mixing mistake they never made.
  function name(c) { return c ? (INFO[c] ? INFO[c].name : 'MUD') : 'NONE'; }
  function hex(c) { return INFO[c] ? INFO[c].hex : '#3a4050'; }
  function shape(c) { return INFO[c] ? INFO[c].shape : 'mud'; }

  // 1 straight from a source, 2 needs a valve.
  function depth(c) {
    return ((c & 1) ? 1 : 0) + ((c & 2) ? 1 : 0) + ((c & 4) ? 1 : 0);
  }

  function blend(a, b) { return (a | b) & 7; }

  // "R+Y". The recipe in text, because a name alone teaches nothing.
  function recipe(c) {
    var out = [], bits = [RED, YELLOW, BLUE], key = ['R', 'Y', 'B'];
    for (var i = 0; i < 3; i++) if (c & bits[i]) out.push(key[i]);
    return out.join('+');
  }

  // The two primaries a secondary is made of.
  function madeOf(c) {
    if (depth(c) !== 2) return null;
    var out = [], bits = [RED, YELLOW, BLUE];
    for (var i = 0; i < 3; i++) if (c & bits[i]) out.push(bits[i]);
    return out;
  }

  // ---- shapes -------------------------------------------------------------
  function path(ctx, kind, cx, cy, r) {
    var i, a, rr, t;
    ctx.beginPath();
    if (kind === 'tri') {
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.92, cy + r * 0.72);
      ctx.lineTo(cx - r * 0.92, cy + r * 0.72);
      ctx.closePath();
    } else if (kind === 'sqr') {
      ctx.rect(cx - r * 0.82, cy - r * 0.82, r * 1.64, r * 1.64);
    } else if (kind === 'cir') {
      ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
    } else if (kind === 'dia') {
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy);
      ctx.closePath();
    } else if (kind === 'hex') {
      t = r * 0.4;
      ctx.moveTo(cx - t, cy - r); ctx.lineTo(cx + t, cy - r);
      ctx.lineTo(cx + t, cy - t); ctx.lineTo(cx + r, cy - t);
      ctx.lineTo(cx + r, cy + t); ctx.lineTo(cx + t, cy + t);
      ctx.lineTo(cx + t, cy + r); ctx.lineTo(cx - t, cy + r);
      ctx.lineTo(cx - t, cy + t); ctx.lineTo(cx - r, cy + t);
      ctx.lineTo(cx - r, cy - t); ctx.lineTo(cx - t, cy - t);
      ctx.closePath();
    } else if (kind === 'str') {
      for (i = 0; i < 10; i++) {
        a = -Math.PI / 2 + i * Math.PI / 5;
        rr = (i % 2 === 0) ? r : r * 0.45;
        ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.closePath();
    } else {
      ctx.rect(cx - r * 0.8, cy - r * 0.5, r * 1.6, r);
    }
  }

  function glyph(ctx, c, cx, cy, r) {
    path(ctx, shape(c), cx, cy, r);
    ctx.fillStyle = hex(c);
    ctx.fill();
  }

  // The recipe as pictures: the primaries that make it, side by side, so a
  // demand teaches itself instead of assuming colour theory.
  function recipeGlyphs(ctx, c, x, y, r, gap) {
    var bits = [RED, YELLOW, BLUE], drawn = 0;
    for (var i = 0; i < 3; i++) {
      if (!(c & bits[i])) continue;
      glyph(ctx, bits[i], x + drawn * (r * 2 + gap) + r, y, r);
      drawn++;
    }
    return drawn;
  }

  return {
    RED: RED, YELLOW: YELLOW, BLUE: BLUE,
    ORANGE: ORANGE, GREEN: GREEN, PURPLE: PURPLE, BAD: BAD, MUD: BAD,
    PRIMARIES: PRIMARIES, SECONDARIES: SECONDARIES, TERTIARIES: [],
    known: known, name: name, hex: hex, depth: depth, blend: blend,
    recipe: recipe, madeOf: madeOf, glyph: glyph, recipeGlyphs: recipeGlyphs
  };
})();
