'use strict';
// ---------------------------------------------------------------------------
// HAINES TALES letterforms — Yori, 2026-09-21.
//
// Not a logo: an ALPHABET, and the code that sets any string in it at runtime,
// so the title lives in one constant (GAME_TITLE, js/version.js) and nowhere
// else. Two faces: a display face (14-row cap, 3 px stem, forward lean, the
// eight-layer treatment) for the wordmark, and a plain 5x7 UI face for prompts
// and the version line. Glyphs are hex row masks, MSB = left column, in
// [width, top, ...rows]; top is the first row relative to the cap top, so
// marks sit above (negative) and a comma or cedilla below.
//
// Authoring source (string maps) and generator: creative/drafts/haines-tales/
// glyphs-src.js + mkfont.js. Edit those and regenerate; do not hand-edit tables.
// Canvas 2D only. fillRect, drawImage, globalCompositeOperation. No fillText,
// no fonts, no rotate, no fractional scale. Runs off file://.
// ---------------------------------------------------------------------------

var LF_DISPLAY = {
  cap: 14, asc: 4, desc: 3, gap: 2, space: 5, measure: true, lean: 4, arc: 0,
  glyphs: {"0":[10,0,0xfc,0x1fe,0x387,0x387,0x387,0x387,0x387,0x387,0x387,0x387,0x387,0x387,0x1fe,0xfc],
  "1":[7,0,0x7,0xf,0x1f,0x3f,0x7,0x7,0x7,0x7,0x7,0x7,0x7,0x7,0x7f,0x7f],
  "2":[10,0,0x1fc,0x3fe,0x387,0x387,0x7,0xe,0x1c,0x38,0x70,0xe0,0x1c0,0x380,0x3ff,0x3ff],
  "3":[10,0,0x1fe,0x3ff,0x387,0x7,0x7,0x7e,0x7e,0x7,0x7,0x7,0x387,0x387,0x3ff,0x1fe],
  "4":[11,0,0x3c,0x7c,0xfc,0x1dc,0x39c,0x71c,0x71c,0x7fe,0x7fe,0x1c,0x1c,0x1c,0x7f,0x7f],
  "5":[10,0,0x3ff,0x3ff,0x380,0x380,0x380,0x3fe,0x3ff,0x7,0x7,0x7,0x387,0x387,0x3ff,0x1fe],
  "6":[10,0,0xfe,0x1fe,0x380,0x380,0x380,0x3fe,0x3ff,0x387,0x387,0x387,0x387,0x387,0x1fe,0xfc],
  "7":[10,0,0x3ff,0x3ff,0x307,0xe,0x1c,0x38,0x38,0x70,0x70,0x70,0x70,0x70,0x70,0x70],
  "8":[10,0,0xfc,0x1fe,0x387,0x387,0x387,0x1fe,0xfc,0x1fe,0x387,0x387,0x387,0x387,0x1fe,0xfc],
  "9":[10,0,0xfc,0x1fe,0x387,0x387,0x387,0x387,0x3ff,0x1ff,0x7,0x7,0x7,0x7,0x1fe,0x1fc],
  "A":[12,0,0xf0,0xf0,0x1f8,0x1f8,0x39c,0x39c,0x70e,0x70e,0x7fe,0x7fe,0x70e,0x70e,0xf0f,0xf0f],
  "B":[11,0,0x7fc,0x7fe,0x387,0x387,0x387,0x38e,0x3fc,0x3fc,0x38e,0x387,0x387,0x387,0x7fe,0x7fc],
  "C":[10,0,0xfe,0x1ff,0x387,0x387,0x380,0x380,0x380,0x380,0x380,0x380,0x387,0x387,0x1ff,0xfe],
  "D":[11,0,0x7fc,0x7fe,0x387,0x387,0x387,0x387,0x387,0x387,0x387,0x387,0x387,0x387,0x7fe,0x7fc],
  "E":[10,0,0x3ff,0x3ff,0x1c0,0x1c0,0x1c0,0x1c0,0x1fc,0x1fc,0x1c0,0x1c0,0x1c0,0x1c0,0x3ff,0x3ff],
  "F":[10,0,0x3ff,0x3ff,0x1c0,0x1c0,0x1c0,0x1c0,0x1fc,0x1fc,0x1c0,0x1c0,0x1c0,0x1c0,0x3e0,0x3e0],
  "G":[11,0,0x1fc,0x3fe,0x70e,0x70e,0x700,0x700,0x700,0x71f,0x71f,0x707,0x707,0x707,0x3ff,0x1fe],
  "H":[11,0,0x7df,0x7df,0x38e,0x38e,0x38e,0x38e,0x3fe,0x3fe,0x38e,0x38e,0x38e,0x38e,0x7df,0x7df],
  "I":[5,0,0x1f,0x1f,0xe,0xe,0xe,0xe,0xe,0xe,0xe,0xe,0xe,0xe,0x1f,0x1f],
  "J":[9,0,0x1f,0x1f,0xe,0xe,0xe,0xe,0xe,0xe,0xe,0xe,0x1ce,0x1ce,0xfe,0x7c],
  "K":[11,0,0x7cf,0x7cf,0x39c,0x3b8,0x3f0,0x3e0,0x3e0,0x3f0,0x3b8,0x39c,0x38e,0x387,0x7cf,0x7cf],
  "L":[10,0,0x3e0,0x3e0,0x1c0,0x1c0,0x1c0,0x1c0,0x1c0,0x1c0,0x1c0,0x1c0,0x1c0,0x1c0,0x3ff,0x3ff],
  "M":[13,0,0x1f1f,0x1f1f,0xf1e,0xfbe,0xeee,0xeee,0xe4e,0xe0e,0xe0e,0xe0e,0xe0e,0xe0e,0x1f1f,0x1f1f],
  "N":[12,0,0xf8e,0xf8e,0x7ce,0x7ce,0x7ce,0x76e,0x76e,0x73e,0x73e,0x73e,0x71e,0x71e,0x71f,0x71f],
  "O":[10,0,0xfc,0x1fe,0x387,0x387,0x387,0x387,0x387,0x387,0x387,0x387,0x387,0x387,0x1fe,0xfc],
  "P":[11,0,0x7fc,0x7fe,0x387,0x387,0x387,0x387,0x3fe,0x3fc,0x380,0x380,0x380,0x380,0x7c0,0x7c0],
  "Q":[11,0,0x1f8,0x3fc,0x70e,0x70e,0x70e,0x70e,0x70e,0x70e,0x70e,0x70e,0x76e,0x73e,0x3fe,0x1f7],
  "R":[12,0,0xff8,0xffc,0x70e,0x70e,0x70e,0x70e,0x7fc,0x7f8,0x770,0x738,0x738,0x71c,0xf9f,0xf9f],
  "S":[10,0,0xfe,0x1ff,0x387,0x387,0x3c0,0x1f0,0xfc,0x3e,0xf,0x7,0x387,0x387,0x3fe,0x1fc],
  "T":[11,0,0x7ff,0x7ff,0x673,0x70,0x70,0x70,0x70,0x70,0x70,0x70,0x70,0x70,0x1fc,0x1fc],
  "U":[11,0,0x7df,0x7df,0x38e,0x38e,0x38e,0x38e,0x38e,0x38e,0x38e,0x38e,0x38e,0x38e,0x3fe,0x1fc],
  "V":[12,0,0xf9f,0xf9f,0x70e,0x70e,0x70e,0x70e,0x39c,0x39c,0x1f8,0x1f8,0x1f8,0x1f8,0xf0,0xf0],
  "W":[14,0,0x3e1f,0x3e1f,0x1c0e,0x1c0e,0x1c0e,0x1c0e,0x1cce,0x1cce,0x1dee,0x1dee,0x1f3e,0x1f3e,0xe1c,0xe1c],
  "X":[12,0,0xf9f,0xf9f,0x70e,0x70e,0x39c,0x39c,0x1f8,0x1f8,0x39c,0x39c,0x70e,0x70e,0xf9f,0xf9f],
  "Y":[11,0,0x7df,0x7df,0x38e,0x38e,0x1dc,0x1dc,0xf8,0xf8,0x70,0x70,0x70,0x70,0x1fc,0x1fc],
  "Z":[10,0,0x3ff,0x3ff,0x307,0xe,0x1c,0x38,0x70,0xe0,0x1c0,0x380,0x380,0x383,0x3ff,0x3ff],
  "-":[6,6,0x3f,0x3f,0x3f],
  "'":[3,0,0x7,0x7,0x7,0x6,0x6],
  ".":[4,10,0xf,0xf,0xf,0xf],
  ",":[4,10,0xf,0xf,0xf,0xf,0x6,0xc,0x8],
  ":":[4,3,0xf,0xf,0xf,0xf,0x0,0x0,0x0,0xf,0xf,0xf,0xf],
  "!":[4,0,0xf,0xf,0xf,0xf,0xf,0xf,0xf,0xf,0xf,0x0,0xf,0xf,0xf,0xf],
  "?":[10,0,0x1fc,0x3fe,0x387,0x387,0x7,0xe,0x1c,0x38,0x38,0x0,0x3c,0x3c,0x3c,0x3c],
  "\uFFFD":[8,0,0xff,0xff,0xc3,0xc3,0xc3,0xc3,0xc3,0xc3,0xc3,0xc3,0xc3,0xc3,0xff,0xff]},
  marks: {"́":[4,-4,0x3,0x6,0xc],
  "̀":[4,-4,0xc,0x6,0x3],
  "̂":[6,-4,0xc,0x1e,0x33],
  "̃":[7,-4,0x31,0x7b,0x46],
  "̈":[7,-4,0x63,0x63],
  "̧":[4,14,0x6,0x3,0x6],
  "̊":[5,-4,0xe,0x1b,0x1b,0xe]},
  tofuMark: [4,-4,0xf,0x9,0xf]
};

var LF_UI = {
  cap: 7, asc: 3, desc: 2, gap: 1, space: 3, measure: false, lean: 0, arc: 0,
  glyphs: {"0":[7,0,0x3e,0x63,0x67,0x6b,0x73,0x63,0x3e],
  "1":[7,0,0x18,0x38,0x18,0x18,0x18,0x18,0x7e],
  "2":[7,0,0x3e,0x63,0x3,0xe,0x30,0x60,0x7f],
  "3":[7,0,0x7e,0x3,0x3,0x1e,0x3,0x3,0x7e],
  "4":[7,0,0xe,0x1e,0x36,0x66,0x7f,0x6,0x6],
  "5":[7,0,0x7f,0x60,0x60,0x7e,0x3,0x3,0x7e],
  "6":[7,0,0x3e,0x60,0x60,0x7e,0x63,0x63,0x3e],
  "7":[7,0,0x7f,0x3,0x6,0xc,0x18,0x18,0x18],
  "8":[7,0,0x3e,0x63,0x63,0x3e,0x63,0x63,0x3e],
  "9":[7,0,0x3e,0x63,0x63,0x3f,0x3,0x3,0x3e],
  "A":[7,0,0x3e,0x63,0x63,0x7f,0x63,0x63,0x63],
  "B":[7,0,0x7e,0x63,0x63,0x7e,0x63,0x63,0x7e],
  "C":[7,0,0x3e,0x63,0x60,0x60,0x60,0x63,0x3e],
  "D":[7,0,0x7e,0x63,0x63,0x63,0x63,0x63,0x7e],
  "E":[7,0,0x7f,0x60,0x60,0x7c,0x60,0x60,0x7f],
  "F":[7,0,0x7f,0x60,0x60,0x7c,0x60,0x60,0x60],
  "G":[7,0,0x3e,0x63,0x60,0x6f,0x63,0x63,0x3e],
  "H":[7,0,0x63,0x63,0x63,0x7f,0x63,0x63,0x63],
  "I":[7,0,0x7e,0x18,0x18,0x18,0x18,0x18,0x7e],
  "J":[7,0,0x6,0x6,0x6,0x6,0x6,0x66,0x3c],
  "K":[7,0,0x63,0x66,0x6c,0x78,0x6c,0x66,0x63],
  "L":[7,0,0x60,0x60,0x60,0x60,0x60,0x60,0x7f],
  "M":[7,0,0x63,0x77,0x7f,0x6b,0x63,0x63,0x63],
  "N":[7,0,0x63,0x73,0x7b,0x6f,0x67,0x63,0x63],
  "O":[7,0,0x3e,0x63,0x63,0x63,0x63,0x63,0x3e],
  "P":[7,0,0x7e,0x63,0x63,0x7e,0x60,0x60,0x60],
  "Q":[7,0,0x3e,0x63,0x63,0x63,0x6b,0x66,0x3d],
  "R":[7,0,0x7e,0x63,0x63,0x7e,0x6c,0x66,0x63],
  "S":[7,0,0x3f,0x60,0x60,0x3e,0x3,0x3,0x7e],
  "T":[7,0,0x7e,0x18,0x18,0x18,0x18,0x18,0x18],
  "U":[7,0,0x63,0x63,0x63,0x63,0x63,0x63,0x3e],
  "V":[7,0,0x63,0x63,0x63,0x63,0x36,0x36,0x1c],
  "W":[7,0,0x63,0x63,0x63,0x6b,0x7f,0x77,0x63],
  "X":[7,0,0x63,0x63,0x36,0x1c,0x36,0x63,0x63],
  "Y":[7,0,0x63,0x63,0x36,0x1c,0x18,0x18,0x18],
  "Z":[7,0,0x7f,0x3,0x6,0x1c,0x30,0x60,0x7f],
  "-":[7,3,0x3e,0x3e],
  "'":[7,0,0x18,0x18,0x30],
  ".":[7,5,0x18,0x18],
  ",":[7,5,0x18,0x18,0x30],
  ":":[7,1,0x18,0x18,0x0,0x0,0x18,0x18],
  "!":[7,0,0x18,0x18,0x18,0x18,0x0,0x18,0x18],
  "?":[7,0,0x3e,0x63,0x3,0xe,0x18,0x0,0x18],
  "\uFFFD":[7,0,0x7f,0x63,0x63,0x63,0x63,0x63,0x7f]},
  marks: {"́":[7,-3,0xc,0x18],
  "̀":[7,-3,0x18,0xc],
  "̂":[7,-3,0x1c,0x36],
  "̃":[7,-3,0x33,0x66],
  "̈":[7,-3,0x36,0x36],
  "̧":[7,7,0xc,0x18],
  "̊":[7,-3,0x1c,0x14,0x1c]},
  tofuMark: [4,-3,0xf,0x9,0xf]
};

// ---------------------------------------------------------------------------
// Setting a string.
//
// A glyph is a bitmap. A string is laid out by MEASURING those bitmaps — per
// row left and right ink edges — and sliding each glyph left until its closest
// approach to everything already set equals the target gap. The whole line is
// then one silhouette, and the outline is grown around that silhouette ONCE:
// letters ringed as one contour, the way a console logo was, and no black slab
// welded between two per-glyph outlines. The face is leaned by a whole-pixel
// shear (LF_LEAN rows per 1 px step) so no ctx.rotate ever touches the type.
//
// Every effect runs at NATIVE resolution — the design grid, 14 rows of cap —
// and the finished wordmark is integer-upscaled once, nearest neighbour. A
// 1 px outline, 1 px highlight and a 2x2 checker at each band join are then
// S px each on screen, which is what the eye reads as period.
// ---------------------------------------------------------------------------

var LF_LEAN = 3;          // rows per 1 px of forward lean on the display face (0 = upright); 1:3 is ~18 degrees
var LF_TUCK = 0.4;        // a glyph may tuck under its neighbour by at most this * cap
var LF_ARC = 0;           // baseline bounce, design px. The era's baseline is LEVEL; this stays 0.
var LF_KERN_FIX = {};     // pair overrides the measure still gets wrong: {'TA': -1}
var LF_CACHE = {}, LF_CACHE_N = 0, LF_WARNED = {};

// Palettes — every entry is on the carrier sheet (sampled 2026-09-21, 15 colours).
// kraft: parcel paper over satchel leather. The postal one, and the default.
var LF_PALETTES = {
  // kraft: a paper rim over satchel leather; the small word stamped on a tan label.
  kraft: { outline: '#101012', shadow: '#351605', bands: ['#e4e0e1', '#b16d30', '#a14713', '#7c330c'], split: [0.15, 0.50, 0.79], highlight: '#e4e0e1', shade: '#592307',
    banner: '#592307', bannerEdge: '#b16d30', small: { outline: '#101012', shadow: '#351605', bands: ['#e4e0e1', '#b16d30', '#b16d30', '#a14713'], split: [0.15, 0.5, 0.8], highlight: '#e4e0e1', shade: '#592307' } },
  // leather: no paper band at all, only the glint. Darker, quieter.
  leather: { outline: '#101012', shadow: '#351605', bands: ['#b16d30', '#a14713', '#7c330c', '#592307'], split: [0.30, 0.55, 0.78], highlight: '#e4e0e1', shade: '#351605',
    banner: '#351605', bannerEdge: '#b16d30', small: { outline: '#101012', shadow: '#351605', bands: ['#e4e0e1', '#b16d30', '#b16d30', '#a14713'], split: [0.15, 0.5, 0.8], highlight: '#e4e0e1', shade: '#592307' } },
  // ember: the carrier's hot ramp. Kept as a one-line switch; it is the warm-on-blue neighbourhood.
  ember: { outline: '#101012', shadow: '#351605', bands: ['#f98835', '#f1731e', '#cf5a10', '#a14713'], split: [0.30, 0.55, 0.78], highlight: '#e4e0e1', shade: '#7c330c',
    banner: '#592307', bannerEdge: '#b16d30', small: { outline: '#101012', shadow: '#351605', bands: ['#f98835', '#f98835', '#f1731e', '#f1731e'], split: [0.5, 0.5, 0.5], highlight: '#e4e0e1', shade: '#a14713' } }
};
var LF_PAL = LF_PALETTES.kraft;
// All in design px. shadow: (dx, dy) — down and against the lean. outline: ring radius.
var LF_STACK = { shadowX: -2, shadowY: 2, outline: 1, dither: true, hi: 1, lo: 1 };

function lfCanvas(w, h) {
  var c = document.createElement('canvas');
  c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
  return c;
}
function lfCtx(c) { var x = c.getContext('2d'); x.imageSmoothingEnabled = false; return x; }

// One glyph plus an optional mark, composed upright, as a grid of 0/1 cells.
// Rows run from -asc (above the cap) to cap+desc-1 (below the baseline).
function lfGrid(face, ch, mark) {
  var H = face.asc + face.cap + face.desc;
  var g = face.glyphs[ch] || face.glyphs['\uFFFD'];
  if (!face.glyphs[ch]) lfWarn(ch);
  var W = g[0];
  var m = null;
  if (mark) { m = face.marks[mark]; if (!m) { lfWarn(mark); m = face.tofuMark; } W = Math.max(W, m[0]); }
  var grid = new Uint8Array(W * H);
  lfStamp(grid, W, face.asc, g, (W - g[0]) >> 1);
  if (m) lfStamp(grid, W, face.asc, m, (W - m[0]) >> 1);
  return { w: W, h: H, g: grid };
}
function lfStamp(grid, W, asc, def, x0) {
  var w = def[0], top = def[1];
  for (var i = 2; i < def.length; i++) {
    var row = def[i], y = top + (i - 2) + asc;
    if (y < 0 || y * W >= grid.length) continue;
    for (var x = 0; x < w; x++) if (row & (1 << (w - 1 - x))) grid[y * W + x0 + x] = 1;
  }
}
function lfWarn(ch) {
  if (LF_WARNED[ch]) return;
  LF_WARNED[ch] = 1;
  var cp = ch.codePointAt(0).toString(16).toUpperCase();
  if (typeof console !== 'undefined') console.warn('letterforms: no glyph for U+' + cp + ' (' + ch + ') - drawn as tofu. Add it to the face.');
}

// Forward lean as a whole-pixel shear: row y shifts right by floor((cap-1-y)/lean).
function lfLeaned(face, grid) {
  if (!face.lean) return grid;
  var H = grid.h, lo = Math.floor((face.cap - 1 - (H - face.asc - 1)) / face.lean);
  var hi = Math.floor((face.cap - 1 + face.asc) / face.lean), W = grid.w + hi - lo;
  var out = new Uint8Array(W * H);
  for (var y = 0; y < H; y++) {
    var s = Math.floor((face.cap - 1 - (y - face.asc)) / face.lean) - lo;
    for (var x = 0; x < grid.w; x++) if (grid.g[y * grid.w + x]) out[y * W + x + s] = 1;
  }
  return { w: W, h: H, g: out };
}

// Per-row ink extents: left[y] / right[y], or -1 for an empty row.
function lfEdges(grid) {
  var L = [], R = [];
  for (var y = 0; y < grid.h; y++) {
    var l = -1, r = -1;
    for (var x = 0; x < grid.w; x++) if (grid.g[y * grid.w + x]) { if (l < 0) l = x; r = x; }
    L.push(l); R.push(r);
  }
  return { l: L, r: R };
}

// Uppercase, decompose (NFD), pair each base with its combining mark.
function lfChars(str) {
  var s = String(str).toUpperCase().normalize('NFD'), out = [], i = 0;
  while (i < s.length) {
    var cp = s.codePointAt(i), ch = String.fromCodePoint(cp); i += ch.length;
    var mark = null;
    while (i < s.length) {
      var c2 = s.codePointAt(i);
      if (c2 < 0x300 || c2 > 0x36F) break;
      var mch = String.fromCodePoint(c2); i += mch.length;
      if (!mark) mark = mch; else lfWarn(mch);       // one mark per base on this face
    }
    out.push({ ch: ch, mark: mark });
  }
  return out;
}

// Lay a string out in design px. Returns glyph placements and the ink box.
function lfLayout(face, str) {
  var chars = lfChars(str), items = [], H = face.asc + face.cap + face.desc;
  var profile = [], y;                       // right-most ink column so far, per row
  for (y = 0; y < H; y++) profile.push(-1);
  var maxRight = -1, first = true, afterSpace = false, prevCh = '';
  var gap = face.gap, tuckMax = Math.floor(face.cap * LF_TUCK);
  var n = 0, i;
  for (i = 0; i < chars.length; i++) if (chars[i].ch !== ' ') n++;
  var k = 0;
  for (i = 0; i < chars.length; i++) {
    var c = chars[i];
    if (c.ch === ' ') { afterSpace = true; continue; }
    var grid = lfLeaned(face, lfGrid(face, c.ch, c.mark)), e = lfEdges(grid);
    var minLeft = 1e9, x;
    for (y = 0; y < H; y++) if (e.l[y] >= 0 && e.l[y] < minLeft) minLeft = e.l[y];
    if (first) { x = -minLeft; }
    else if (afterSpace || !face.measure) { x = maxRight + 1 + (afterSpace ? face.space : gap) - minLeft; }
    else {
      var boxX = maxRight + 1 + gap - minLeft, tight = -1e9, any = false;
      for (y = 0; y < H; y++) {
        if (profile[y] < 0 || e.l[y] < 0) continue;
        any = true;
        var t = profile[y] + 1 + gap - e.l[y];
        if (t > tight) tight = t;
      }
      x = any ? Math.max(tight, boxX - tuckMax) : boxX - tuckMax;
      var fix = LF_KERN_FIX[prevCh + c.ch];
      if (fix) x += fix;
    }
    var yOff = 0;
    if (face.arc && n > 1) { var tt = 2 * (k + 0.5) / n - 1; yOff = Math.round(face.arc * tt * tt); }
    items.push({ grid: grid, x: x, y: yOff });
    for (y = 0; y < H; y++) if (e.r[y] >= 0 && x + e.r[y] > profile[y]) profile[y] = x + e.r[y];
    for (y = 0; y < H; y++) if (profile[y] > maxRight) maxRight = profile[y];
    first = false; afterSpace = false; prevCh = c.ch; k++;
  }
  var arcH = face.arc ? Math.abs(face.arc) : 0, minY = face.arc < 0 ? face.arc : 0;
  return { items: items, w: maxRight + 1, h: H + arcH, asc: face.asc, capTop: face.asc - minY, baseline: face.asc + face.cap - minY, yShift: -minY };
}

// The alpha-only silhouette of a string at design resolution, padded by `pad`.
function lfMask(face, str, pad) {
  pad = pad | 0;
  var lay = lfLayout(face, str), c = lfCanvas(lay.w + pad * 2, lay.h + pad * 2), x = lfCtx(c);
  x.fillStyle = '#ffffff';
  for (var i = 0; i < lay.items.length; i++) {
    var it = lay.items[i], g = it.grid;
    for (var yy = 0; yy < g.h; yy++) for (var xx = 0; xx < g.w; xx++)
      if (g.g[yy * g.w + xx]) x.fillRect(pad + it.x + xx, pad + it.y + yy + lay.yShift, 1, 1);
  }
  lay.canvas = c; lay.pad = pad;
  return lay;
}

// --- Mask ops: every effect is a compositing op on the silhouette -----------
function lfTint(src, colour, dx, dy) {
  var c = lfCanvas(src.width, src.height), x = lfCtx(c);
  x.drawImage(src, dx | 0, dy | 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = colour; x.fillRect(0, 0, c.width, c.height);
  return c;
}
// Ring-stamp: the mask at every offset within r, growing outward only.
function lfDilate(src, r) {
  var c = lfCanvas(src.width, src.height), x = lfCtx(c), rr = r * r + 1;
  for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++)
    if (dx * dx + dy * dy <= rr) x.drawImage(src, dx, dy);
  return c;
}
// mask AND NOT (mask shifted by dy): the top n rows (dy = n) or bottom n rows (dy = -n) of every stroke
function lfRim(src, dy) {
  var c = lfCanvas(src.width, src.height), x = lfCtx(c);
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'destination-out';
  x.drawImage(src, 0, dy);
  return c;
}
// Four flat bands, a 2x2 checker on each join, clipped to the mask.
function lfBands(src, capTop, capH, colours, split, dither) {
  var W = src.width, H = src.height, b = lfCanvas(W, H), bx = lfCtx(b);
  var ys = [0, capTop + Math.round(capH * split[0]), capTop + Math.round(capH * split[1]), capTop + Math.round(capH * split[2]), H];
  for (var i = 0; i < 4; i++) { bx.fillStyle = colours[i]; bx.fillRect(0, ys[i], W, ys[i + 1] - ys[i]); }
  if (dither) for (i = 1; i < 4; i++) {
    var y = ys[i];
    for (var x = 0; x < W; x++) {
      bx.fillStyle = colours[i]; if ((x + y) & 1) bx.fillRect(x, y - 1, 1, 1);
      bx.fillStyle = colours[i - 1]; if (!((x + y) & 1)) bx.fillRect(x, y, 1, 1);
    }
  }
  var c = lfCanvas(W, H), x2 = lfCtx(c);
  x2.drawImage(src, 0, 0);
  x2.globalCompositeOperation = 'source-in';
  x2.drawImage(b, 0, 0);
  return c;
}

// --- The wordmark: one line of the display face through the layer stack ------
// Built at native resolution, then upscaled by the integer S.
// Returns { canvas, w, h, S, capTop, baseline, inkW, layers } and caches on (str, S).
function buildWordmark(str, S, opts) {
  opts = opts || {};
  var face = LF_DISPLAY, pal = opts.pal || LF_PAL, st = LF_STACK;
  var key = 'W|' + str + '|' + S + '|' + (opts.arc || 0) + '|' + LF_LEAN + '|' + pal.bands[0];
  if (LF_CACHE[key]) return LF_CACHE[key];
  face.lean = LF_LEAN; face.arc = opts.arc || LF_ARC;
  var pad = st.outline + Math.max(Math.abs(st.shadowX), Math.abs(st.shadowY)) + 1;
  var m = lfMask(face, str, pad), M = m.canvas, W = M.width, H = M.height;
  var capTop = pad + m.capTop, L = {};
  L.shadow = lfTint(lfDilate(M, st.outline), pal.shadow, st.shadowX, st.shadowY);
  L.outline = lfTint(lfDilate(M, st.outline), pal.outline, 0, 0);
  L.face = lfBands(M, capTop, face.cap, pal.bands, pal.split, st.dither);
  L.highlight = lfTint(lfRim(M, st.hi), pal.highlight, 0, 0);
  L.shade = lfTint(lfRim(M, -st.lo), pal.shade, 0, 0);
  var nat = lfCanvas(W, H), x = lfCtx(nat), order = ['shadow', 'outline', 'face', 'highlight', 'shade'];
  for (var i = 0; i < order.length; i++) if (!opts.skip || !opts.skip[order[i]]) x.drawImage(L[order[i]], 0, 0);
  var out = lfCanvas(W * S, H * S);
  lfCtx(out).drawImage(nat, 0, 0, W * S, H * S);      // the one upscale: integer, nearest
  var res = { canvas: out, native: nat, w: W * S, h: H * S, S: S, pad: pad * S, capTop: capTop * S,
    baseline: (pad + m.baseline) * S, inkW: m.w * S, inkH: m.h * S, layers: L, mask: M };
  if (++LF_CACHE_N > 24) { LF_CACHE = {}; LF_CACHE_N = 0; }
  LF_CACHE[key] = res;
  return res;
}

// --- The lockup: big first word over a smaller rest, on a banner ------------
// Fits to the view. Nothing here knows a width; it is all derived from viewW/viewH.
var LF_LOCKUP = { width: 0.90, bigMaxW: 0.66, blockH: 0.32, smallRatio: 0.5, bannerPad: 10 };

function lfSplit(str) {
  var w = String(str).trim().split(/\s+/);
  return { big: w[0] || '', small: w.slice(1).join(' ') };
}

// The largest integer S such that the big word is no wider than bigMaxW * viewW
// and the whole block is no taller than blockH * viewH. Never below 2 (cap 28).
function lfFitTitle(str, viewW, viewH) {
  var sp = lfSplit(str), face = LF_DISPLAY; face.lean = LF_LEAN; face.arc = LF_ARC;
  var bigW = lfLayout(face, sp.big).w + 2 * LF_STACK.outline, capH = face.cap;
  var best = 2;
  for (var S = 2; S <= 12; S++) {
    var s2 = sp.small ? Math.max(2, Math.round(S * LF_LOCKUP.smallRatio)) : 0;
    var h = capH * S + (sp.small ? (capH + LF_LOCKUP.bannerPad) * s2 : 0);
    if (bigW * S > viewW * LF_LOCKUP.bigMaxW || h > viewH * LF_LOCKUP.blockH) break;
    best = S;
  }
  return best;
}

function buildTitle(str, viewW, viewH, opts) {
  opts = opts || {};
  var pal = opts.pal || LF_PAL;
  var key = 'T|' + str + '|' + viewW + '|' + viewH + '|' + LF_LEAN + '|' + LF_ARC + '|' + pal.bands[0];
  if (LF_CACHE[key]) return LF_CACHE[key];
  var sp = lfSplit(str), S = lfFitTitle(str, viewW, viewH);
  var big = buildWordmark(sp.big, S, { pal: pal });
  var W = Math.round(viewW * LF_LOCKUP.width), small = null, s2 = 0, bannerH = 0;
  if (sp.small) {
    s2 = Math.max(2, Math.round(S * LF_LOCKUP.smallRatio));
    small = buildWordmark(sp.small, s2, { pal: pal.small });
    bannerH = (LF_DISPLAY.cap + LF_LOCKUP.bannerPad) * s2;
  }
  if (W < big.w) W = big.w;
  var c = lfCanvas(W, big.h + bannerH), x = lfCtx(c);
  var bigX = (W - big.w) >> 1;
  if (small) {
    // The banner: a leaning band under the big word carrying the small one,
    // drawn as stepped fillRects — the lean is whole pixels, like the type.
    var by = big.baseline, e = s2, lean = LF_LEAN ? Math.round(bannerH / LF_LEAN) : 0;
    var shx = LF_STACK.shadowX * s2, shy = LF_STACK.shadowY * s2;
    lfBanner(x, shx, by + shy, W, bannerH, lean, pal.shadow, 0, bannerH, 0);
    lfBanner(x, 0, by, W, bannerH, lean, pal.outline, 0, bannerH, 0);
    lfBanner(x, 0, by, W, bannerH, lean, pal.banner, e, bannerH - e, e);
    lfBanner(x, 0, by, W, bannerH, lean, pal.bannerEdge, e, 2 * e, e);
    // The small word hangs clear of the big word's shadow and outline, which fall onto the banner.
    var clear = (LF_STACK.shadowY + LF_STACK.outline) * S + s2;
    var sx = (W - small.w) >> 1, sy = by + clear - small.capTop;
    x.drawImage(small.canvas, sx, sy);
  }
  x.drawImage(big.canvas, bigX, 0);
  var res = { canvas: c, w: c.width, h: c.height, S: S, s2: s2, big: big, small: small };
  LF_CACHE[key] = res;
  return res;
}
// Rows y0..y1 of a parallelogram (bx, by, w, h) sheared LEAN px over its FULL
// height, inset by INSET on both sides, in whole-pixel row steps.
function lfBanner(x, bx, by, w, h, lean, colour, y0, y1, inset) {
  x.fillStyle = colour;
  var step = lean ? Math.max(1, Math.round(h / lean)) : h;
  for (var y = Math.floor(y0 / step) * step; y < y1; y += step) {
    var s = lean ? Math.round(lean * (1 - (y + step * 0.5) / h)) : 0;
    var a = Math.max(y, y0), b = Math.min(y + step, y1);
    if (b > a) x.fillRect(bx + s + inset, by + a, w - 2 * inset, b - a);
  }
}

// --- The UI face: flat, one colour, fixed advance ----------------------------
function lfUIText(str, S, colour) {
  var key = 'U|' + str + '|' + S + '|' + colour;
  if (LF_CACHE[key]) return LF_CACHE[key];
  var m = lfMask(LF_UI, str, 0), c = lfCanvas(m.w * S, m.h * S);
  lfCtx(c).drawImage(m.canvas, 0, 0, m.w * S, m.h * S);
  var res = { canvas: lfTint(c, colour, 0, 0), w: m.w * S, h: m.h * S, baseline: m.baseline * S };
  if (++LF_CACHE_N > 24) { LF_CACHE = {}; LF_CACHE_N = 0; }
  LF_CACHE[key] = res;
  return res;
}
function measureUIText(str, S) { return lfLayout(LF_UI, str).w * S; }
// y is the BASELINE in backbuffer px; align is 'left' | 'center' | 'right'.
function drawUIText(ctx, str, x, y, S, colour, align) {
  var t = lfUIText(str, S, colour);
  var dx = align === 'center' ? x - (t.w >> 1) : align === 'right' ? x - t.w : x;
  ctx.drawImage(t.canvas, Math.round(dx), Math.round(y - t.baseline));
  return t.w;
}
