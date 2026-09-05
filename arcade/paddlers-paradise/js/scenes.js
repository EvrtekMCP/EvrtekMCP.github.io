// PADDLER'S PARADISE — SCENES
// ---------------------------------------------------------------------------
// Full-screen, first-person pixel renderings: the moments a trip is actually
// remembered by. Look up at an aurora, watch a meteor shower burn across the
// dark, stand at the Tom Thomson cairn, read an ochre pictograph on wet
// granite, look down on the lake from a ledge nobody signposted, read the
// permit board at the launch. Each scene is one painter function drawing
// procedurally at the framebuffer's 2x resolution — portrait on a phone,
// landscape on a PC, because the painter just fills whatever sky it is given.
//
// Painters receive (g, W, H, t, rnd): a context already under the world
// transform, the viewport in world units, seconds since the scene opened, and
// a PRNG seeded per-instance so no two meteor showers are the same shower.
// ---------------------------------------------------------------------------

'use strict';

var fwMoonCanvas = null, fwMoonR = 0;

function buildFwMoon(r) {
  var c = document.createElement('canvas');
  c.width = r * 2 + 2; c.height = r * 2 + 2;
  var g = c.getContext('2d');
  var x, y;
  for (y = -r; y <= r; y++) {
    for (x = -r; x <= r; x++) {
      var d = Math.sqrt(x * x + y * y) / r;
      if (d > 1) continue;
      var mare = Math.sin(x * 0.9 / (r / 8) + 2) * Math.sin(y * 1.1 / (r / 8) - 1) > 0.55;
      g.fillStyle = mare ? '#c9c4ae' : d > 0.9 ? '#ded9c4' : '#f0ead2';
      g.fillRect(x + r + 1, y + r + 1, 1, 1);
    }
  }
  fwMoonCanvas = c;
  fwMoonR = r;
}

function sceneStars(g, W, H, rnd, n, maxY) {
  var i;
  for (i = 0; i < n; i++) {
    var x = rnd() * W, y = rnd() * (maxY || H);
    var b = rnd();
    g.fillStyle = b > 0.85 ? '#f2f2e8' : b > 0.5 ? '#b8c0d8' : '#6a7290';
    g.fillRect(x, y, 0.5, 0.5);
    if (b > 0.96) { g.fillRect(x - 0.5, y, 0.5, 0.5); g.fillRect(x + 0.5, y, 0.5, 0.5); }
  }
}

// `scale` (optional, 1) shrinks the trees for a treeline seen from far
// above — a ridge, not a shore. The default is arithmetically the old line.
function sceneTreeline(g, W, H, rnd, yBase, col, scale) {
  var sc = scale || 1;
  g.fillStyle = col || '#060d08';
  g.fillRect(0, yBase, W, H - yBase);
  var x = 0;
  while (x < W) {
    var tw = (4 + rnd() * 8) * sc, th = (6 + rnd() * 16) * sc;
    var cx = x + tw / 2, ty = yBase - th;
    var s;
    for (s = 0; s < th; s += 1.5) {
      var half = (tw / 2) * (s / th);
      g.fillRect(cx - half, ty + s, half * 2, 1.6);
    }
    x += tw * 0.7;
  }
}

// The sky, by the hour, for any painter that reads the game clock (#6, #7,
// note 8): one curve, so the lookout's evening is the firewatch's evening.
// Keyframes: [hour, top, low, lake, treeline, starAlpha] — dawn, day, the
// long golden hour, a fast sunset, and the night that follows it.
var FW_SKY = [
  [5.0,  '#0a0f2e', '#25204a', '#0e1830', '#04140a', 0.8],
  [6.0,  '#233a66', '#c47a5a', '#1a2f4a', '#071a0d', 0.35],
  [8.0,  '#6fa8d4', '#cfe0e8', '#2b6b8f', '#12331c', 0],
  [12.0, '#7db6e0', '#dceaf2', '#2e719a', '#163c20', 0],
  [17.0, '#79a9d8', '#f2d8a0', '#2b6488', '#143a1e', 0],
  [18.8, '#5f7fb0', '#f2b076', '#28577c', '#0f2c16', 0],
  [19.7, '#3a4a8c', '#e2954a', '#22496e', '#0a2010', 0.08],
  [20.2, '#2a2f6e', '#d95f3b', '#1c3c5e', '#081808', 0.25],
  [20.7, '#171c48', '#7a3a58', '#132c48', '#061204', 0.55],
  [21.4, '#0a0f2e', '#252a5a', '#0c1c34', '#040d04', 0.85],
  [22.5, '#04061c', '#0a0f2e', '#081426', '#030a03', 1],
];

/** {top, low, lake, tree, starA} for hour h — rgb() strings, ready to fill. */
function skyAt(h) {
  var K = FW_SKY;
  var i2 = 0, u = 0;
  if (h <= K[0][0]) { i2 = 0; u = 0; }
  else if (h >= K[K.length - 1][0]) { i2 = K.length - 2; u = 1; }
  else {
    for (i2 = 0; i2 < K.length - 2; i2++) {
      if (h >= K[i2][0] && h <= K[i2 + 1][0]) break;
    }
    u = (h - K[i2][0]) / (K[i2 + 1][0] - K[i2][0]);
  }
  return {
    top: hexLerp(K[i2][1], K[i2 + 1][1], u),
    low: hexLerp(K[i2][2], K[i2 + 1][2], u),
    lake: hexLerp(K[i2][3], K[i2 + 1][3], u),
    tree: hexLerp(K[i2][4], K[i2 + 1][4], u),
    starA: K[i2][5] + (K[i2 + 1][5] - K[i2][5]) * u,
  };
}

/** 'rgb(r,g,b)' or '#rrggbb' -> [r, g, b]; the sky comes back from skyAt as rgb(). */
function sceneRGB(c) {
  if (c.charAt(0) === '#') {
    var v = parseInt(c.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  var m = /(\d+)\D+(\d+)\D+(\d+)/.exec(c);
  return [+m[1], +m[2], +m[3]];
}

/** Mix two colours of either notation — the ridges dim toward the night's treeline. */
function sceneMix(c1, c2, t) {
  var a = sceneRGB(c1), b = sceneRGB(c2);
  return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' +
    Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')';
}

// === v0.9.1 pass 7: the ten retaken painters -------------------------------
// Ten of the original first-person scenes were repainted in the low-bit idiom
// (scope/v0.9/scenes-retake/idiom.md) and judged against their v0.9.0 selves.
// Each winner keeps its own header below: what it draws, its three speeds, its
// ramps and its cost model. Their module-level caches and helpers live here,
// scene-prefixed; the painters themselves sit in SCENE_PAINTERS as always.
// ---------------------------------------------------------------------------

// --- aurora (v0.9.1 pass 7 retake, variant B) ---------------------------
// ---------------------------------------------------------------------------
// The northern lights as a PALETTE-CYCLED RAY FIELD over a dithered navy sky,
// framed by two near-black pine crowns in the bottom corners and a thin band
// of still lake that carries a dithered reflection. Same place as v0.9.0:
// three curtains (green over teal over violet) at their own heights, the
// star field above, the low treeline; the smooth per-column gradients are
// gone and every texel is a solid ramp entry.
//
// Three speeds:
//   slow    — curtain base curves drift at 18 s / 26 s / 40 s (one per curtain);
//             the teal curtain's FOLD (a bright curl) crosses W in 30 s; a
//             satellite crosses the top of the sky in 45 s; the lake's
//             reflection rolls between two dither variants every 4 s.
//   medium  — every ray breathes on its own phase, 3–5 s; bright stars
//             twinkle on a 2 s cycle, each on its own phase.
//   fast    — palette cycle steps every 0.35 s (green), 0.45 s (teal),
//             0.6 s (violet): the ramp scrolls UP the rays.
//
// Ramps (idiom §2 — PAL has no aurora hue, so each is built from PAL
// neighbours plus white, low to high):
//   green   pineDk #1f5330 → pine #2c6e3f → pineLt #3f8a52 → good #69c977 → white
//   teal    deep #17435f → shallow #2b6b8f → ripple #3f83a8 → #9fd8d0 → white
//   violet  berry #3b4f9a → #5a5cae → #7a6ab8 → #b08cc4 → lilyFl #e8b4c8
// plus the sky's own navy floor (#04040f → #101830) as four dithered bands.
//
// Cost model: everything static is baked ONCE per W x H into three offscreen
// canvases (sky, foreground A, foreground B) and the ray textures (one body
// strip and one cap strip per curtain — 5 phases x 2 ray types x 4 Bayer
// columns). Per frame: 1 sky blit + 160 star texels + one drawImage per ray
// column (+ one cap per bright ray) + 1 foreground blit + a satellite. No
// gradients, no globalAlpha, no per-pixel loop. All motion is a pure
// function of t and rnd.
// ---------------------------------------------------------------------------


// module-level cache keyed by W x H (rebuilt when the viewport changes)
var auroraBCache = { key: '' };

// --- meteors (v0.9.1 pass 7 retake, variant A) --------------------------
// ---------------------------------------------------------------------------
// Same place as the v0.9.0 painter — the tilted Milky Way, the dense dark
// sky, the treeline at H*0.9 — rebuilt on three speeds, then composed
// around them:
//
//   slow   (6 s / 12 s / ~80 s) — the sky TURNING: bright and mid stars step
//          one texel left every 6 s, the Milky Way and the dim stars every
//          12 s (parallax: the far layer lags); a satellite crosses the top
//          of the sky one texel at a time, one pass per W/4+20 s.
//   medium (1.5–4 s)            — twinkle by ramp step, never alpha: each
//          bright star walks a 6-slot sequence over the 3-colour stars ramp
//          on its own period (mid stars a slower one); a bolide's train
//          dithers away over 1.5 s in two steps (every 2nd texel, every 4th).
//   fast   (0.4 s / 0.55–0.8 s) — the meteors: texel streaks with a 3-step
//          tail (white head, #b8c0d8, #6a7290, the last third dithered),
//          Bresenham-stepped along the major axis, ~1/s, 0.55–0.8 s each,
//          fading in ramp steps; every 12th is a BOLIDE (2-unit head, halo,
//          tail twice as long, 1 s life, persistent train). The brightest
//          stars flick their cross arms on a 0.4 s clock while white.
//
// Palettes (idiom §2): stars ramp #6a7290 → #b8c0d8 → #f2f2e8 for stars,
// meteors, trains, the Milky Way and the keel line; sky #04040f (baseline)
// stepping to skyAt(22.5).low #0a0f2e at the horizon through ONE mixed step,
// Bayer-4x4 dithered in 2-texel cells (no gradient); treeline #060d08; the
// hull is plain black. No new hue.
//
// Cost: two cached texel canvases, built ONCE per scene open (keyed by
// W x H and the seed's first star):
//   sky — background, the dithered horizon rows, the Milky Way as 1-texel
//         dots on a fixed 1-unit lattice at two Bayer densities, and the dim
//         stars, written in a single ImageData pass; blitted per frame with
//         two drawImage calls (wrapped for the drift);
//   fg  — treeline, upturned hull, pine crown; two slice blits.
// Per frame beyond that: ~110 star fills and one or two streaks. The frame
// is never touched texel by texel at paint time.
//
// The rnd() stream is consumed in the baseline's order — 2000 draws for the
// Milky Way it no longer paints from, 660 for the stars, then 5 per meteor —
// so a given seed rolls the SAME shower as v0.9.0 (idiom §8).
//
// Quiet band (idiom §7): nothing brighter than the ramp's middle and nothing
// moving below H-48 (landscape) / H-60 (portrait): streak and train texels
// are clipped there, stars there sit still at their base colour, the hull,
// glow and treeline are static.
// ---------------------------------------------------------------------------


var meteorsBayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
var meteorsRamp = ['#6a7290', '#b8c0d8', '#f2f2e8'];        // the stars ramp
var meteorsSeqBright = [2, 2, 2, 1, 0, 1];                  // twinkle: mostly white, one dip
var meteorsSeqMid = [1, 1, 2, 1, 1, 0];                     // mid stars: a flash, a dip
var meteorsCache = { key: '', sky: null, fg: null, fgTop: 0, pineX: 0, pineH: 0 };

/** Milky Way centreline + half-width for this aspect: landscape keeps the
 *  baseline's 0.35 tilt from H*0.1; portrait runs it corner to corner. */
function meteorsBand(W, H) {
  var tall = H > W;
  return {
    slope: tall ? 1.4 : 0.35,
    y0: tall ? H * 0.12 : H * 0.1,
    hw: Math.min(W, H) * 0.15,
  };
}

/** The static sky, in texels: background, dithered horizon, the Milky Way
 *  lattice and the dim stars — written once into an ImageData (one pass over
 *  the frame per scene OPEN, never per frame) and put on a cached canvas.
 *  Opaque, so one wrapped blit is the whole far layer. */
function meteorsBuildSky(C, W, H, stars) {
  var FW = W * 2, FH = H * 2;
  var cv = document.createElement('canvas');
  cv.width = FW; cv.height = FH;
  var c = cv.getContext('2d');
  var img = c.createImageData(FW, FH), d = img.data;
  var x, y, i, o;
  // sky steps: #04040f (baseline) -> its half-mix with skyAt(22.5).low -> #0a0f2e
  var skyRGB = [[4, 4, 15], [7, 10, 31], [10, 15, 46]];
  var lo = [106, 114, 144], mid = [184, 192, 216];       // #6a7290, #b8c0d8
  for (i = 0; i < d.length; i += 4) { d[i] = 4; d[i + 1] = 4; d[i + 2] = 15; d[i + 3] = 255; }

  // --- horizon: three steps of sky, Bayer between them in 1-unit cells ---
  var yT = H * 0.9;
  var glowH = Math.min(H * 0.26, Math.min(W, H) * 0.3);
  var yA = Math.floor(yT - glowH);
  for (y = yA; y < H; y++) {
    var u = Math.min(1, (y - yA) / (yT - yA));
    var lv = u * 2, base = Math.floor(lv), fr = lv - base;
    if (base >= 2) { base = 2; fr = 0; }
    for (x = 0; x < W; x++) {
      var ci = (fr * 16 > meteorsBayer[(x & 3) + ((y & 3) << 2)]) ? base + 1 : base;
      if (ci === 0) continue;
      var rgb = skyRGB[ci];
      o = (y * 2 * FW + x * 2) * 4;
      d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2];
      d[o + 4] = rgb[0]; d[o + 5] = rgb[1]; d[o + 6] = rgb[2];
      o += FW * 4;
      d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2];
      d[o + 4] = rgb[0]; d[o + 5] = rgb[1]; d[o + 6] = rgb[2];
    }
  }

  // --- the Milky Way: 1-texel dots on a 1-unit lattice, two Bayer densities
  // (core 6/16, halo 2/16), a wandering dark rift through the core, and a
  // 1/16 sprinkle of the middle grey in the core ---
  var B = meteorsBand(W, H);
  var pf = 1 / Math.sqrt(1 + B.slope * B.slope);
  var hwx = [], rift = [];                                // per column: wavy edge, rift offset
  for (x = 0; x < W; x++) {
    hwx.push(B.hw * (0.85 + 0.25 * Math.sin(x * 0.045) + 0.12 * Math.sin(x * 0.11 + 1.7)));
    rift.push(B.hw * (0.05 + 0.12 * Math.sin(x * 0.06 + 2)));
  }
  var reach = B.hw * 1.3 / pf;
  var yLo = Math.max(0, Math.floor(B.y0 - reach));
  var yHi = Math.min(H, Math.ceil(B.y0 + B.slope * W + reach));
  for (y = yLo; y < yHi; y++) {
    for (x = 0; x < W; x++) {
      var dist = ((y + 0.5) - (B.y0 + B.slope * (x + 0.5))) * pf;
      var ad = Math.abs(dist) / hwx[x];
      if (ad >= 1) continue;
      var bay = meteorsBayer[(x & 3) + ((y & 3) << 2)];
      var core = ad < 0.5;
      var den = core ? (Math.abs(dist - rift[x]) < B.hw * 0.13 ? 2 : 6) : 2;
      if (bay >= den) continue;
      var hi = core && meteorsBayer[((x + 2) & 3) + (((y + 1) & 3) << 2)] < 1;
      var dot = hi ? mid : lo;
      o = (y * 2 * FW + x * 2 + (y & 1)) * 4;
      d[o] = dot[0]; d[o + 1] = dot[1]; d[o + 2] = dot[2];
    }
  }

  // --- the dim stars (b <= 0.5) ride with the Milky Way ---
  for (i = 0; i < stars.length; i += 3) {
    if (stars[i + 2] > 0.5) continue;
    o = (stars[i + 1] * 2 * FW + stars[i] * 2) * 4;
    d[o] = lo[0]; d[o + 1] = lo[1]; d[o + 2] = lo[2];
  }
  c.putImageData(img, 0, 0);
  C.sky = cv;
}

/** The still foreground: treeline (baseline's rngFrom(11)), the upturned
 *  hull bottom-left with a dashed starlit keel, a pine crown top-right. */
function meteorsBuildFg(C, W, H) {
  var FW = W * 2, FH = H * 2;
  var cv = document.createElement('canvas');
  cv.width = FW; cv.height = FH;
  var c = cv.getContext('2d');
  c.setTransform(2, 0, 0, 2, 0, 0);
  var mn = Math.min(W, H);
  var yT = H * 0.9;

  sceneTreeline(c, W, H, rngFrom(11), yT);

  // hull: a low black arch from off-left to past mid-frame, keel highest at
  // midship, stems swept up at the ends, one column per unit
  var hx0 = -2, hx1 = Math.floor(W * 0.56);
  var hullTop = Math.floor(yT - mn * 0.18);
  var x, topAt = [];
  for (x = hx0; x <= hx1; x++) {
    var u = (x - hx0) / (hx1 - hx0);
    var yk = hullTop + 2.5 - 2.5 * Math.sin(Math.PI * u);
    var stem = 0;
    if (u < 0.08) stem = (1 - u / 0.08) * 5;
    if (u > 0.92) stem = (1 - (1 - u) / 0.08) * 5;
    var yTop = Math.floor((yk - stem) * 2) / 2;
    topAt.push(yTop);
    c.fillStyle = '#000000';
    c.fillRect(x, yTop, 1, H - yTop);
  }
  // keel line: 1-texel dashes of the dimmest star grey, 2 on / 2 off
  c.fillStyle = meteorsRamp[0];
  for (x = hx0 + 2; x < hx1 - 2; x++) {
    if (((x - hx0) & 3) < 2) c.fillRect(x, topAt[x - hx0], 1, 0.5);
  }

  // pine crown, top-right: five bough tiers centred past the frame edge so
  // the right side is cut; a needle jag per row from its own rng
  var cw = mn * 0.3, th = mn * 0.06, tiers = 5;
  var xc = W - cw * 0.4;
  var pr = rngFrom(13);
  c.fillStyle = '#060d08';
  var tier, r;
  for (tier = 0; tier < tiers; tier++) {
    var wT = cw * (0.35 + tier * 0.16), y0 = tier * th - th * 0.35;
    for (r = 0; r < th; r += 1) {
      var half = (wT / 2) * (r / th) + pr() * 1.5;
      var yy = Math.floor((y0 + r) * 2) / 2;
      c.fillRect(Math.floor((xc - half) * 2) / 2, yy, half * 2, 1);
    }
  }
  C.pineX = Math.max(0, Math.floor(xc - cw * 0.6) - 2);
  C.pineH = Math.ceil(tiers * th) + 1;
  C.fgTop = Math.floor(Math.min(hullTop - 6, yT - 23));
  C.fg = cv;
}

// --- moonrise (v0.9.1 pass 7 retake, variant B) -------------------------
// ---------------------------------------------------------------------------
// The moon comes up the colour of birch bark — now over a lake you can see.
// Back to front: a five-band dithered sky (the baseline's own navies) → stars
// → the cached dithered moon inside a three-ring dithered halo → the far
// treeline → three bands of dithered water carrying the still reflections of
// the frame → a mist band breaking over the treeline's feet → the moon path, a
// palette-cycled lattice of dashes widening toward the viewer → a loon → and
// the frame itself: reeds rising from the bottom-left, a boulder at the
// bottom-right, both black and still.
//
// Three speeds (all pure functions of t and the scene rnd):
//   slow   — the moon climbs 1 texel / 8 s after the 4 s reveal; the mist
//            drifts right 1 texel / 2 s (48-unit lump period, 96 s cycle).
//   medium — the moon-path dashes wobble a texel left/right on a 2.2 s sine;
//            a loon crosses the path 1 texel / 0.4 s, once every 40 s.
//   fast   — the path's ramp index steps every 0.3 s (scrolling DOWN the
//            column); a glint texel at the bright path's near end and eight
//            twinkling stars flip every 0.5 s.
//
// Palette (idiom rule 2): sky = the baseline navies '#070a1c' → '#141a3e' in
// five steps; water = '#0e1e33' → '#122a44' in three; the path ramp is built
// from PAL neighbours — water '#122a44' mixed toward the dim star '#6a7290',
// then the stars ramp '#6a7290' → '#b8c0d8', then the moon face '#f0ead2'
// (five colours, ends included). Inside the quiet band (bottom 48 units
// landscape / 60 portrait) the path cycles only the ramp's dim half, never
// brighter than its middle, and the glint stays above the band.
//
// Cost: the sky, the water (with reflections), the mist tile and the moon +
// halo are rendered ONCE per W x H into offscreen canvases on moonriseCache
// and blitted with four drawImage calls; per frame the JS loops run over the
// stars, the treeline, ~25–80 path rows and the frame — never over W*H.
// No gradients anywhere.
// ---------------------------------------------------------------------------

var moonriseCache = {};

var MOONRISE_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function moonriseBuild(W, H) {
  var key = W + 'x' + H;
  if (moonriseCache[key]) return moonriseCache[key];
  var horizon = Math.round(H * 0.62 * 2) / 2;
  var r = Math.round(Math.min(W, H) * 0.11 * 2) / 2;
  var m = Math.min(W, H);
  var quietY = H - (H > W ? 60 : 48);
  var B = MOONRISE_BAYER;
  var x, y, cx, cy, i, j;

  // --- the sky: five bands of navy, Bayer 4x4 (1-unit cells) over 4 units ---
  var SKY = [];
  for (i = 0; i < 5; i++) SKY.push(hexLerp('#070a1c', '#141a3e', i / 4));
  var skyH = Math.ceil(horizon);
  var sky = document.createElement('canvas');
  sky.width = W * 2; sky.height = skyH * 2;
  var sg = sky.getContext('2d');
  sg.imageSmoothingEnabled = false;
  var bandH = skyH / 5;
  for (i = 0; i < 5; i++) {
    sg.fillStyle = SKY[i];
    var b0 = Math.round(bandH * i), b1 = i === 4 ? skyH : Math.round(bandH * (i + 1));
    sg.fillRect(0, b0 * 2, W * 2, (b1 - b0) * 2);
  }
  for (i = 1; i < 5; i++) {
    var by = Math.round(bandH * i);
    for (y = by - 2; y < by + 2; y++) {
      var f = (y - (by - 2) + 0.5) / 4;           // how far into the next band
      var lower = y < by;                         // above the boundary: paint 'next' cells
      sg.fillStyle = lower ? SKY[i] : SKY[i - 1];
      for (x = 0; x < W; x++) {
        var th = B[((y & 3) << 2) | (x & 3)] / 16;
        if (lower ? f > th : f <= th) sg.fillRect(x * 2, y * 2, 2, 2);
      }
    }
  }

  // --- the frame: reeds (bottom-left) and a boulder (bottom-right) ----------
  var fr = rngFrom(31);
  var shoreY = Math.round(H - m * 0.12);
  var reeds = [];
  var nReed = 13;
  for (i = 0; i < nReed; i++) {
    var rx = Math.round((1 + i * (W * 0.26 / nReed) + fr() * 2.5) * 2) / 2;
    var rh = Math.round((m * (0.17 + fr() * 0.23)) * 2) / 2;
    var lean = fr() < 0.5 ? -0.5 : 0.5;
    var head = fr() < 0.55;
    reeds.push({ x: rx, h: rh, lean: lean, head: head,
      blade: fr() < 0.75 ? Math.round(rh * (0.35 + fr() * 0.3)) : 0, bside: fr() < 0.5 ? -1 : 1 });
  }
  var rockW = Math.round(W * 0.26), rockH = Math.round(m * 0.15);
  var rockX = W - rockW + 2;
  var rockRows = [];                              // [x, y, w] per unit row, stepped silhouette
  for (i = 0; i < rockH; i++) {
    var u = i / rockH;
    var half = Math.round(rockW * Math.sqrt(1 - u * u) * 0.5 + (i % 3 === 0 ? 1 : 0));
    rockRows.push([rockX + rockW / 2 - half, shoreY - i - 1, half * 2 + rockW * 0.5]);
  }

  // --- the water: three bands, dithered joins, still reflections baked in ---
  var WAT = ['#0a1628', '#0e1e33', '#122a44'];   // deep night water → the baseline's near stop
  var wat = document.createElement('canvas');
  var watY0 = Math.floor(horizon), watH = H - watY0;
  wat.width = W * 2; wat.height = watH * 2;
  var wg = wat.getContext('2d');
  wg.imageSmoothingEnabled = false;
  var wb = watH / 3;
  for (i = 0; i < 3; i++) {
    wg.fillStyle = WAT[i];
    var w0 = Math.round(wb * i), w1 = i === 2 ? watH : Math.round(wb * (i + 1));
    wg.fillRect(0, w0 * 2, W * 2, (w1 - w0) * 2);
  }
  for (i = 1; i < 3; i++) {
    var wy = Math.round(wb * i);
    for (y = wy - 2; y < wy + 2; y++) {
      var f2 = (y - (wy - 2) + 0.5) / 4, low2 = y < wy;
      wg.fillStyle = low2 ? WAT[i] : WAT[i - 1];
      for (x = 0; x < W; x++) {
        var th2 = B[((y & 3) << 2) | (x & 3)] / 16;
        if (low2 ? f2 > th2 : f2 <= th2) wg.fillRect(x * 2, y * 2, 2, 2);
      }
    }
  }
  // reflections: a 50% checker of black under each reed and under the rock
  wg.fillStyle = '#081018';
  for (i = 0; i < nReed; i++) {
    var rl = Math.min(H - shoreY, Math.round(reeds[i].h * 0.5));
    for (y = 0; y < rl; y++) {
      var ry = shoreY + y - watY0;
      var rxx = reeds[i].x + (y >> 3) * reeds[i].lean;
      if (((Math.round(rxx) + y) & 1) === 0) wg.fillRect(Math.round(rxx * 2), ry * 2, 2, 2);
    }
  }
  for (i = 0; i < rockRows.length && shoreY + i < H; i++) {
    var rr = rockRows[Math.min(rockRows.length - 1, i)];
    var rw = rr[2] * (1 - i / rockRows.length * 0.5);
    var rx0 = Math.round(rr[0] + (rr[2] - rw) / 2);
    for (x = rx0; x < rx0 + rw; x++) {
      if (((x + i) & 1) === 0) wg.fillRect(x * 2, (shoreY + i - watY0) * 2, 2, 2);
    }
  }

  // --- the mist tile: 3 unit rows, lumpy, 48-unit period so the drift wraps
  var MIST_P = 48;
  var mist = document.createElement('canvas');
  mist.width = (W + MIST_P) * 2; mist.height = 6;
  var mg = mist.getContext('2d');
  // the sky's low colour lifted one step toward the dim star — plain '#141a3e'
  // vanishes against the water it is meant to hang over
  mg.fillStyle = hexLerp('#141a3e', '#6a7290', 0.3);
  var mistW = W + MIST_P;
  for (x = 0; x < mistW; x++) {
    var lump = 0.5 + 0.5 * Math.sin(x * Math.PI * 2 / MIST_P * 3) * Math.cos(x * Math.PI * 2 / MIST_P);
    for (y = 0; y < 3; y++) {
      var dens = y === 1 ? 0.55 + lump * 0.35 : 0.15 + lump * 0.4;
      if (dens > B[((y & 3) << 2) | (x & 3)] / 16) mg.fillRect(x * 2, y * 2, 2, 2);
    }
  }

  // --- high cloud: two dithered wisps in the sky's own band colours, 64-unit
  // period; the far layer of the parallax, drifting slower than the mist ----
  var CLOUD_P = 96;
  var cloud = document.createElement('canvas');
  var cloudW = W + CLOUD_P, cloudH = 5;
  cloud.width = cloudW * 2; cloud.height = cloudH * 2;
  var cg = cloud.getContext('2d');
  var cr = rngFrom(41), wisps = [];
  for (i = 0; i < 2; i++) wisps.push([i * CLOUD_P / 2 + cr() * 20, 1.5 + cr() * 2, 7 + cr() * 8]);
  cg.fillStyle = SKY[3];
  for (x = 0; x < cloudW; x++) {
    var cov = 0;
    for (i = 0; i < 2; i++) {
      var ddx = ((x - wisps[i][0]) % CLOUD_P + CLOUD_P) % CLOUD_P;
      if (ddx > CLOUD_P / 2) ddx -= CLOUD_P;
      var q = Math.abs(ddx) / wisps[i][2];
      if (q < 1) cov = Math.max(cov, (1 - q * q));
    }
    if (cov <= 0) continue;
    for (y = 0; y < cloudH; y++) {
      var vy = 1 - Math.abs(y - 2) / 2.6;
      var densC = cov * vy * 0.7;
      if (densC > B[((y & 3) << 2) | (x & 3)] / 16) cg.fillRect(x * 2, y * 2, 2, 2);
    }
  }

  // --- the moon, exactly the baseline's texels, inside a dithered halo ------
  var R = Math.ceil(r * 1.8);
  var S = (2 * R + 1) * 2;                        // texels across (0.5-unit steps)
  var moon = document.createElement('canvas');
  moon.width = S; moon.height = S;
  var og = moon.getContext('2d');
  var HALO = [hexLerp('#141a3e', '#6a7290', 0.42), hexLerp('#141a3e', '#6a7290', 0.3), hexLerp('#141a3e', '#6a7290', 0.2)];
  // halo: three concentric rings at 1-unit cells, each a sparser Bayer level
  for (cy = -R; cy <= R; cy++) {
    for (cx = -R; cx <= R; cx++) {
      var dd = Math.sqrt(cx * cx + cy * cy) / r;
      if (dd <= 1 || dd > 1.8) continue;
      var lvl = dd <= 1.25 ? 0 : dd <= 1.5 ? 1 : 2;
      var thr = lvl === 0 ? 8 : lvl === 1 ? 4 : 2;
      if (B[((cy & 3) << 2) | (cx & 3)] < thr) {
        og.fillStyle = HALO[lvl];
        og.fillRect((cx + R) * 2, (cy + R) * 2, 2, 2);
      }
    }
  }
  for (y = -r; y <= r; y += 0.5) {
    for (x = -r; x <= r; x += 0.5) {
      var d = Math.sqrt(x * x + y * y) / r;
      if (d > 1) continue;
      var mare = Math.sin(x * 0.8 + 2) * Math.sin(y * 0.9 - 1) > 0.55;
      og.fillStyle = mare ? '#c9c4ae' : d > 0.92 ? '#ded9c4' : '#f0ead2';
      og.fillRect((x + R) * 2 + 1, (y + R) * 2 + 1, 1, 1);
    }
  }

  // --- the twinklers: eight fixed bright stars high in the sky --------------
  var tw = rngFrom(101), twinkle = [];
  for (i = 0; i < 8; i++) {
    twinkle.push([Math.round(tw() * W * 2) / 2, Math.round(tw() * (horizon - r * 3) * 2) / 2]);
  }

  // --- the moon path ramp: water → dim star → mid star → moon ---------------
  var SHIM = [hexLerp('#122a44', '#6a7290', 0.3), hexLerp('#122a44', '#6a7290', 0.65),
              '#6a7290', '#b8c0d8', '#f0ead2'];

  var c = {
    horizon: horizon, r: r, m: m, quietY: quietY, shoreY: shoreY,
    sky: sky, wat: wat, watY0: watY0, mist: mist, mistP: MIST_P, moon: moon, R: R,
    cloud: cloud, cloudP: CLOUD_P, cloudY: Math.round(horizon - r * 4.2),
    reeds: reeds, rockRows: rockRows, twinkle: twinkle, SHIM: SHIM,
    rockRim: hexLerp('#081018', '#6e6e78', 0.55),
  };
  moonriseCache[key] = c;
  return c;
}

// --- starsCamp (v0.9.1 pass 7 retake, variant A) ------------------------
// ---------------------------------------------------------------------------
// The stars from the campsite: you are sitting at the fire looking up. The
// fire itself is below the frame; what you see of it is what it LIGHTS — the
// undersides of the two nearest pines at the bottom corners — and what it
// sends up through the middle of the view: a thin plume of smoke that blots
// out stars as it drifts, and the sparks riding it.
//
// Three speeds (idiom §5), all pure functions of t and the scene rnd:
//   slow    satellite crossing the sky on a 40 s track (2x2-texel head, a
//           three-texel dim tail so it has a direction even in a still), a
//           second, dimmer one on a higher lane every 90 s (crosses R→L),
//           and the smoke plume's sway (period ~14 s);
//   medium  firelight step-pulse on the pine undersides, period 2.5 s, two
//           held steps (dim: ember only / bright: fire1 on the lowest bough);
//   fast    sparks (0.6–1.0 s life, texel-snapped), satellite blink 1.2 s,
//           star twinkle in 0.5 s ramp steps.
//
// Everything static — the black sky, the Milky Way as a dithered band (the
// meteors recipe, opposite tilt), the fixed stars, the far treeline, the two
// framing pines with BOTH lit steps — is baked ONCE per scene open into two
// offscreen canvases (dim step / bright step) on starsCampCache, keyed by
// W x H and the instance's first rnd() draw; a frame is one drawImage plus
// ~150 small fills. No gradients anywhere: the baseline's orange
// createLinearGradient wash is gone, replaced by Bayer-4x4 dithered light on
// the boughs (1-unit = 2-texel cells).
//
// Ramps (idiom §2): sky→stars '#04040f' → '#0d0f24' → '#1c2038' → '#363c5c'
// → '#6a7290' → '#b8c0d8' → '#f2f2e8' (the smoke and the Milky Way body use
// the dark steps between the sky and the dim star; that is four steps between
// the sky and '#6a7290' and two more to white — the star ramp proper is the
// three the game already owns); fire ember '#8c3a1d' → fire1 '#e8842a' →
// fire2 '#f2c14b' → white '#f2f2e8'. Two ramps plus the (black) sky.
//
// Quiet band (idiom §7): the bottom 48/60 units hold only the treeline, the
// pine silhouettes and their ember-dithered undersides (dark, pulsing on the
// medium period; fire1 only on the lowest bough's outer half, which hangs
// below the caption's last line), and the smoke plume's dark base. Sparks are
// born at H-50 and die above H*0.7. Satellites and twinkle live in the top
// 60% of the frame.
// ---------------------------------------------------------------------------


// one entry: { key, dim, bright, tw, sparks, sat1, sat2, smoke, sparkY, sparkRise }
var starsCampCache = null;

// --- cairn (v0.9.1 pass 7 retake, variant A) ----------------------------
// ---------------------------------------------------------------------------
// The Tom Thomson cairn on its point, retaken in the low-bit idiom.
//
// Three speeds (idiom rule 5):
//   slow   — far clouds one texel right every 2 s, near clouds one texel every
//            1.2 s (parallax); a loon pair crossing the far water on a 50 s track.
//   medium — a pine bough hanging into the top-right corner sways in texel
//            steps on a 3 s period (base still, middle one texel, tip two);
//            the ripple lattice wobbles one texel either way on a 2 s period;
//            a wind-line of shallow dashes with a ripple crest sweeps left to
//            right every 9 s.
//   fast   — the water ramp steps every 0.4 s, scrolling toward the viewer;
//            grass tufts above the quiet band flick one texel every 0.6 s.
//
// Layers (rule 6), back to front: dithered sky → clouds (two depths) → hazy
// far ridge (sky.low mixed into the treeline colour) → the treeline → water
// → the point with its grass → the cairn → the bough framing the corner.
//
// Ramps (rule 2): water deep→water→shallow→ripple; pine pineDk→pine→pineLt;
// rock rockDk→rock→#9a9aa2 (the stones' pale top edge is now an opaque ramp
// step, not an alpha wash). The branch is the one trunk colour #463526 and
// the loons PAL.loon — single colours, not ramps. Sky = the baseline's two
// day blues quantized to four bands and blended with Bayer 4x4 (1-unit cells
// = 2 texels); the scene is a day scene in the baseline and stays one.
//
// Cost: everything static — sky bands, the hazy ridge, the treeline, the water
// plate, the land, the still grass inside the quiet band — is painted ONCE per
// W x H into two offscreen canvases (sky / land, the land one transparent where
// the sky shows so the clouds drift behind the trees) and blitted with two
// drawImage calls a frame. Per frame only the moving things are filled.
//
// rnd() consumption order is the baseline's: one roll per stone, nothing
// before it. Every other random thing rolls from its own rngFrom(seed).
// ---------------------------------------------------------------------------

var cairnRetakeCache = {};
var cairnBayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

function cairnSnap(v) { return Math.round(v * 2) / 2; }

// A horizontal Bayer transition: rows y0..y0+rows-1 (1-unit cells) blend
// from colour 'above' to colour 'below'; only the cells that differ from the
// band already painted underneath are filled.
function cairnDitherRows(g, W, y0, rows, above, below, underIsAbove) {
  var r, x;
  for (r = 0; r < rows; r++) {
    var f = (r + 1) / (rows + 1) * 16;
    for (x = 0; x < W; x++) {
      var lower = cairnBayer[r & 3][x & 3] < f;
      if (lower === underIsAbove(r)) {
        g.fillStyle = lower ? below : above;
        g.fillRect(x, y0 + r, 1, 1);
      }
    }
  }
}

function cairnBuild(W, H) {
  var m = Math.min(W, H), k = m / 135;
  var horizon = H * 0.5;
  var waterTop = cairnSnap(horizon + 6 * k);
  var landY = cairnSnap(H * 0.72);
  var quietY = H - (H > W ? 60 : 48);
  var C = { m: m, k: k, horizon: horizon, waterTop: waterTop, landY: landY, quietY: quietY };
  var i, j, x, y;

  // --- the sky: four dithered bands of the day blues ------------------------
  var sky = document.createElement('canvas');
  sky.width = W * 2; sky.height = H * 2;
  var sg = sky.getContext('2d');
  sg.setTransform(2, 0, 0, 2, 0, 0);
  var cols = [];
  for (i = 0; i < 4; i++) cols.push(hexLerp('#8fb6d8', '#c9d8e2', i / 3));
  var yb = [0, Math.round(horizon * 0.34), Math.round(horizon * 0.6), Math.round(horizon * 0.82), Math.ceil(horizon)];
  for (i = 0; i < 4; i++) {
    sg.fillStyle = cols[i];
    sg.fillRect(0, yb[i], W, yb[i + 1] - yb[i] + 1);
  }
  for (i = 1; i < 4; i++) {
    (function (bi) {
      cairnDitherRows(sg, W, yb[bi] - 2, 4, cols[bi - 1], cols[bi], function (r) { return r < 2; });
    })(i);
  }
  C.sky = sky;

  // --- the land: ridge, treeline, water plate, point, still grass -----------
  var land = document.createElement('canvas');
  land.width = W * 2; land.height = H * 2;
  var lg = land.getContext('2d');
  lg.setTransform(2, 0, 0, 2, 0, 0);
  var treeCol = '#274d33';
  var haze = hexLerp('#c9d8e2', '#274d33', 0.42);
  sceneTreeline(lg, W, H, rngFrom(42), Math.round(horizon - 9 * k), haze, 0.6);
  sceneTreeline(lg, W, H, rngFrom(41), horizon, treeCol);
  lg.fillStyle = '#1e567a';
  lg.fillRect(0, waterTop, W, landY - waterTop);
  // the far water catches the sky: a shallow rim dithered down into water
  lg.fillStyle = '#2b6b8f';
  lg.fillRect(0, waterTop, W, 1);
  cairnDitherRows(lg, W, waterTop + 1, 3, '#2b6b8f', '#1e567a', function () { return false; });
  // the point of land
  lg.fillStyle = '#2a5c35';
  lg.fillRect(0, landY, W, H - landY);
  lg.fillStyle = '#20492a';
  lg.fillRect(0, landY, W, 1.5);
  C.land = land;

  // --- grass tufts: still ones baked into the land, live ones kept ----------
  var gr = rngFrom(44);
  var live = [];
  var cx = W * 0.5, base = H * 0.88, rw0 = 8 * 4.6 * k + 4 * k;
  var n = Math.floor(W * H / 700), tf;
  for (i = 0; i < n; i++) {
    var fr = Math.sqrt(gr());
    tf = { x: cairnSnap(gr() * W), y: cairnSnap(landY + 3 + (H - landY - 3) * fr), ph: Math.floor(gr() * 4) };
    if (Math.abs(tf.x - cx) < rw0 / 2 + 2 * k && tf.y < base + 1) continue;
    tf.h = cairnSnap(1 + 2.5 * fr * k);
    if (tf.y - tf.h < quietY) live.push(tf);
    else cairnDrawTuft(lg, tf, 0);
  }
  // the bottom edge: a hedge of bigger, darker tufts framing the view
  for (x = gr() * 3; x < W; x += 2 + gr() * 3 * k) {
    tf = { x: cairnSnap(x), y: H + 0.5, h: cairnSnap((4 + gr() * 6) * k), ph: 0 };
    cairnDrawTuft(lg, tf, 0);
  }
  C.tufts = live;

  // --- clouds: 2-shade flat-bottomed blocks on a 2-unit row grid -----------
  var cr = rngFrom(43), clouds = [];
  // more of them under a taller sky: the count follows the sky's area
  var nFar = 2 + Math.floor(W * horizon / 8000), nNear = 2 + Math.floor(W * horizon / 24000);
  for (i = 0; i < nFar + nNear; i++) {
    var far = i < nFar;
    var cw = cairnSnap((far ? 18 + cr() * 16 : 36 + cr() * 30) * k);
    var rows = far ? 2 + Math.floor(cr() * 2) : 4 + Math.floor(cr() * 3);
    var cl = { far: far, w: cw, x0: cairnSnap(cr() * (W + cw)),
      y: Math.round((far ? 0.12 + cr() * 0.45 : 0.04 + cr() * 0.3) * horizon / 2) * 2, rows: [] };
    for (j = 0; j < rows; j++) {
      var rwid = cairnSnap(cw * (1 - j * (0.7 / rows) - cr() * 0.1));
      cl.rows.push({ dx: cairnSnap(cr() * (cw - rwid)), w: rwid, lit: cairnSnap(rwid * (0.25 + cr() * 0.3)) });
    }
    clouds.push(cl);
  }
  C.clouds = clouds;

  // --- the ripple lattice ---------------------------------------------------
  var rr = rngFrom(45), rowsR = [];
  var pitch = 2, ri = 0;
  for (y = waterTop + 3; y < landY - 1; y += pitch, ri++) {
    var row = { y: cairnSnap(y), i: ri, d: [] };
    var span = cairnSnap((11 + ri * 0.9) * k);
    var len = cairnSnap(Math.min(7 * k, (2 + ri * 0.45) * k));
    for (x = rr() * span; x < W + span; x += span) {
      row.d.push({ x: cairnSnap(x + rr() * 3 * k), len: cairnSnap(len * (0.7 + rr() * 0.6)), o: rr() < 0.5 ? 0 : 2 });
    }
    rowsR.push(row);
    if (ri % 3 === 2) pitch = cairnSnap(pitch + 0.5 * k);
  }
  C.rows = rowsR;

  // --- the frame: a pine bough hanging into the top-right corner ------------
  // A branch stepping down-left from the corner, one drooping needle bar per
  // unit along it (longest at the base, a wavy hem from a sine plus noise),
  // short bars above; sunlit bars carry a pine cap, a few a pineLt glint.
  // Three sway groups along its length: base still, middle one texel, tip two.
  var br = rngFrom(46), bough = [];
  var bx0 = W + 2, by0 = -2, bx1 = cairnSnap(W - m * 0.44), by1 = cairnSnap(m * 0.22);
  var nseg = Math.round(bx0 - bx1);
  var run = 0, runCap = 0, runGlint = false;
  for (i = 0; i <= nseg; i++) {
    var u = i / nseg;
    if (run <= 0) {
      // clumps of sunlit needles 2–4 columns wide, then a gap of 1–2
      run = runCap ? -(1 + Math.floor(br() * 2)) : 2 + Math.floor(br() * 3);
      runCap = runCap ? 0 : cairnSnap((2 + br() * 3) * k);
      runGlint = !!runCap && br() < 0.3;
      if (run < 0) { run = -run; }
    }
    var wave = Math.sin(i * 0.35) * 2.5 + Math.sin(i * 1.3) * 1 + br() * 2;
    var seg = {
      x: bx0 - i, y: cairnSnap(by0 + u * (by1 - by0)),
      th: u < 0.4 ? 2 : u < 0.75 ? 1.5 : 1,
      grp: u < 0.35 ? 0 : u < 0.7 ? 1 : 2,
      dn: cairnSnap((11 - 7.5 * u) * k + wave * k),
      up: cairnSnap((3 - 2 * u) * k + Math.sin(i * 0.7) * k + br() * k),
      cap: runCap ? cairnSnap(runCap + Math.sin(i * 0.8) * 0.5) : 0,
      glint: runGlint,
    };
    run--;
    if (seg.dn < 1) seg.dn = 1;
    if (seg.up < 0) seg.up = 0;
    bough.push(seg);
  }
  C.bough = bough;
  C.ridgeTop = Math.max(0, Math.round(horizon - 9 * k - 16 * 0.6 - 2));
  return C;
}

// A tuft is 3–5 texels: a centre blade, a shorter pine blade to one side, a
// darker stub to the other. flick (0/1) moves the centre blade's top texel.
function cairnDrawTuft(g, tf, flick) {
  g.fillStyle = '#1f5330';
  g.fillRect(tf.x, tf.y - tf.h + 0.5, 0.5, tf.h - 0.5);
  g.fillRect(tf.x + (flick ? 0.5 : 0), tf.y - tf.h, 0.5, 0.5);
  g.fillStyle = '#2c6e3f';
  g.fillRect(tf.x + 0.5, tf.y - cairnSnap(tf.h * 0.6), 0.5, cairnSnap(tf.h * 0.6));
  if (tf.h >= 2) {
    g.fillStyle = '#1f5330';
    g.fillRect(tf.x - 0.5, tf.y - cairnSnap(tf.h * 0.4), 0.5, cairnSnap(tf.h * 0.4));
  }
}

// --- dam (v0.9.1 pass 7 retake, variant A) ------------------------------
// ---------------------------------------------------------------------------
// The Joe Lake dam, rebuilt on the 8-bit trick: the falling water is a
// PALETTE-CYCLED SHEET — seven pre-rasterised phase frames of a striated,
// Bayer-dithered foam texture, and each frame only picks which phase to blit.
// Everything static (dithered sky, two treelines, the timber-and-stone crest,
// the cribs, the pool) is rasterised ONCE per scene open into an offscreen
// canvas keyed by W x H and the hour bucket, so a phone frame is two
// drawImages plus a couple of hundred texel-snapped fills.
//
// Three speeds (idiom rule 5):
//   slow   — cloud 1 texel / 2 s; upper-water glints 1 texel / 0.8 s toward
//            the crest; pool foam streaks 1 texel / 1 s away from the foot.
//   medium — churn line phase 1.1 s; spray plume sway 3 s.
//   fast   — sheet ramp step 0.25 s (7-step cycle); spray particles 0.45 s life, dying by
//            dither; thread accents ride the sheet at the step rate.
//
// Ramps (idiom rule 2): water/foam shallow->ripple->#cfe0e8->white (dimmed
// toward sky.lake at night; the sheet itself walks ripple->foam->white so
// its dark step is aerated pale blue, never the deep), trunk
// #463526->trunk->trunkLt, rock rockDk->rock->#9a9aa2; plus the sky from
// skyAt(h) (its `tree` colour also paints the boughs, its `low` the cloud).
// Two rusted spikes borrow ONE ember texel each (#8c3a1d) — an accent, not
// a ramp. The rock's cracks and shadow use PAL black.
//
// Layout (idiom rule 7/10): the churn line sits 3 units above the quiet band
// (48 landscape / 60 portrait), so the whole sheet, its threads and the
// spray live above the caption and the pills; the pool, the near-bank rock
// and the bough are the only things in the band and they are dark, still or
// slow. Portrait puts the slack into the sky (stars, the cloud, two boughs)
// and a spruce trunk up the left edge.
// ---------------------------------------------------------------------------


// one slot: a scene has one size and one hour while it is open
var damRetakeCache = { key: '', back: null, sheets: null, geo: null, ramp: null, threads: null };

var DAM_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];   // /16
var DAM_SEQ = [0, 1, 2, 3, 3, 2, 1];                                    // ramp walk, ping-pong (7 so a 2 s strip never aliases)
var DAM_RAMP_DAY = ['#2b6b8f', '#3f83a8', '#cfe0e8', '#f2f2e8'];

function damRetakeGeo(W, H) {
  var portrait = H > W;
  var quiet = portrait ? 60 : 48;
  var mn = Math.min(W, H);
  var sh = Math.round(Math.max(18, Math.min(H * 0.2, mn * 0.28)));     // sheet height
  var foot = Math.round(H - quiet - 3);                                 // churn line
  var dh = Math.round(Math.max(7, Math.min(10, H * 0.07)));            // crest height
  var crestBot = foot - sh;                                             // sheet top
  var crest = crestBot - dh;                                            // dam top
  var uw = Math.round(Math.max(8, Math.min(H * 0.1, mn * 0.12)));      // upper water
  var horizon = crest - uw;
  var cw = Math.round(Math.max(8, Math.min(20, W * 0.07)));            // stone crib width
  return { portrait: portrait, quiet: quiet, sh: sh, foot: foot, dh: dh, crestBot: crestBot,
           crest: crest, uw: uw, horizon: horizon, cw: cw, spanX: cw, spanW: W - 2 * cw,
           sprayH: Math.round(Math.max(6, Math.min(H * 0.1, sh * 0.45))) };
}

// a spruce bough seen close: a drooping stem with a solid fringe of needles
// hanging below it (long at the base, short at the tip) and a short bristle
// above, one column per unit; a few lit tips. dir = +1 grows right from x0.
function damRetakeBough(g, x0, y0, len, dir, col, colHi) {
  var s, x, y, droop, hang;
  g.fillStyle = col;
  for (s = 0; s < len; s += 1) {
    droop = Math.floor(s * s / (len * 5) * 2) / 2;
    x = x0 + dir * s; y = y0 + droop;
    hang = Math.round((1 - s / len) * 5 + 2 + ((s * 7) % 3));
    g.fillRect(dir > 0 ? x : x - 1, y - 1, 1, 1.5 + hang);
    if ((s & 1) === 0) g.fillRect(dir > 0 ? x : x - 1, y - 2, 1, 1);
  }
  // lit top edge, dithered every other unit, and a few lit needle tips
  g.fillStyle = colHi;
  for (s = 1; s < len; s += 2) {
    droop = Math.floor(s * s / (len * 5) * 2) / 2;
    x = x0 + dir * s; y = y0 + droop;
    g.fillRect(dir > 0 ? x : x - 1, y - 1, 1, 0.5);
    if (s % 6 === 1) {
      hang = Math.round((1 - s / len) * 5 + 2 + ((s * 7) % 3));
      g.fillRect(dir > 0 ? x + 0.5 : x - 0.5, y + hang, 0.5, 0.5);
    }
  }
}

function damRetakeBuild(W, H, hour) {
  var geo = damRetakeGeo(W, H);
  var sky = skyAt(hour);
  var starA = sky.starA;
  var dim = 0.55 * starA;
  var ramp = [], i, k;
  for (i = 0; i < 4; i++) ramp[i] = sceneMix(DAM_RAMP_DAY[i], sky.lake, dim);
  var Wt = Math.ceil(W * 2), Ht = Math.ceil(H * 2);

  // --- back plate: sky (dithered bands), treelines, upper water, dam, pool --
  var back = document.createElement('canvas');
  back.width = Wt; back.height = Ht;
  var b = back.getContext('2d');
  var skyT = geo.horizon * 2;                       // texels of sky
  var img = b.createImageData(Wt, skyT);
  var d = img.data;
  var bands = 5, bandCols = [];
  for (k = 0; k < bands; k++) bandCols.push(sceneRGB(sceneMix(sky.top, sky.low, k / (bands - 1))));
  var bandH = skyT / bands, tr = 8;                 // 4-unit dithered transition
  var ty, tx, p = 0;
  for (ty = 0; ty < skyT; ty++) {
    var kb = Math.min(bands - 1, Math.floor(ty / bandH));
    var edge = (kb + 1) * bandH;                    // boundary below this band
    var w = (ty - (edge - tr / 2)) / tr;            // 0..1 across the transition
    var c0 = bandCols[kb], c1 = bandCols[Math.min(bands - 1, kb + 1)];
    for (tx = 0; tx < Wt; tx++, p += 4) {
      var thr = (DAM_BAYER[((ty >> 1) & 3) * 4 + ((tx >> 1) & 3)] + 0.5) / 16;
      var c = (w > thr) ? c1 : c0;
      d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
    }
  }
  b.putImageData(img, 0, 0);
  b.setTransform(2, 0, 0, 2, 0, 0);                 // art units from here on
  // stars: dither by count, not alpha
  if (starA > 0.05) {
    sceneStars(b, W, geo.horizon, rngFrom(57), Math.round(70 * starA * (W * geo.horizon) / (240 * 40)), geo.horizon * 0.85);
  }
  // far ridge, then the near treeline (the baseline's seed 53)
  var tsc = geo.portrait ? 1 : 0.8;
  sceneTreeline(b, W, H, rngFrom(54), geo.horizon - 3, sceneMix(sky.tree, sky.low, 0.35), tsc * 0.7);
  sceneTreeline(b, W, H, rngFrom(53), geo.horizon, sky.tree, tsc);
  // upper water: lake colour, paling in dithered steps toward the lip
  b.fillStyle = sky.lake;
  b.fillRect(0, geo.horizon, W, geo.uw);
  b.fillStyle = ramp[0];
  b.fillRect(0, geo.crest - 3, W, 3);
  for (i = 0; i < W; i += 1) {
    if ((i & 1) === 0) b.fillRect(i, geo.crest - 4, 1, 1);
    if ((i & 1) === 1) { b.fillStyle = ramp[1]; b.fillRect(i, geo.crest - 1, 1, 1); b.fillStyle = ramp[0]; }
  }
  // the lip: foam curling over the top course
  b.fillStyle = ramp[2];
  b.fillRect(0, geo.crest - 0.5, W, 1);
  for (i = 0; i < W; i += 2) b.fillRect(i, geo.crest - 1, 1, 0.5);
  // the dam: two timber courses with log ends, a stone cap
  var y = geo.crest + 0.5, courseH = Math.max(2, Math.floor((geo.dh - 2) / 2));
  for (k = 0; k < 2; k++) {
    b.fillStyle = '#5d4632';
    b.fillRect(0, y, W, courseH);
    b.fillStyle = '#7a5c42';
    b.fillRect(0, y, W, 0.5);
    b.fillStyle = '#463526';
    b.fillRect(0, y + courseH - 0.5, W, 0.5);
    for (i = (k ? 4 : 0); i < W; i += 8) {           // log ends, staggered by course
      b.fillStyle = '#7a5c42';
      b.fillRect(i, y + 0.5, 2, courseH - 1);
      b.fillStyle = '#463526';
      b.fillRect(i + 0.5, y + 1, 1, Math.max(0.5, courseH - 2));
    }
    y += courseH;
  }
  b.fillStyle = '#8d8d95';                          // stone cap course
  b.fillRect(0, y, W, geo.crestBot - y);
  b.fillStyle = '#6e6e78';
  for (i = 3; i < W; i += 6) b.fillRect(i, y, 0.5, geo.crestBot - y);
  b.fillStyle = '#9a9aa2';
  b.fillRect(0, y, W, 0.5);
  // two rusted spikes on the top course (ember accent)
  b.fillStyle = '#8c3a1d';
  b.fillRect(Math.round(W * 0.31), geo.crest + 1, 0.5, 1);
  b.fillRect(Math.round(W * 0.68), geo.crest + 1, 0.5, 1);
  // the pool
  var pool = sceneMix(sky.lake, '#17435f', 0.6);
  b.fillStyle = pool;
  b.fillRect(0, geo.crestBot, W, H - geo.crestBot);
  b.fillStyle = ramp[0];
  b.fillRect(geo.spanX, geo.crestBot, geo.spanW, geo.sh);
  // foam base at the foot
  b.fillStyle = ramp[2];
  b.fillRect(geo.spanX, geo.foot - 1, geo.spanW, 2.5);
  b.fillStyle = ramp[1];
  for (i = geo.spanX; i < geo.spanX + geo.spanW; i += 2) b.fillRect(i + 1, geo.foot + 1, 1, 0.5);
  for (i = geo.spanX; i < geo.spanX + geo.spanW; i += 2) b.fillRect(i, geo.foot + 1.5, 1, 0.5);
  // stone cribs at each side: staggered blocks from the crest into the pool
  var cribBot = geo.foot + 2, side, bx, by, row;
  for (side = 0; side < 2; side++) {
    var x0 = side ? W - geo.cw : 0;
    b.fillStyle = '#6e6e78';
    b.fillRect(x0, geo.crest + 0.5, geo.cw, cribBot - geo.crest - 0.5);
    row = 0;
    for (by = geo.crest + 0.5; by < cribBot; by += 3, row++) {
      var bh = Math.min(3, cribBot - by);
      for (bx = x0 - (row & 1) * 2; bx < x0 + geo.cw; bx += 4) {
        var lx = Math.max(x0, bx), rx = Math.min(x0 + geo.cw, bx + 3.5);
        if (rx - lx < 0.5) continue;
        b.fillStyle = '#8d8d95';
        b.fillRect(lx, by, rx - lx, bh - 0.5);
        b.fillStyle = '#9a9aa2';
        b.fillRect(lx, by, rx - lx, 0.5);
      }
    }
    // wet foot of the crib, dithered into the pool
    b.fillStyle = pool;
    for (bx = x0; bx < x0 + geo.cw; bx += 1) if ((bx & 1) === 0) b.fillRect(bx, cribBot - 1, 1, 0.5);
  }

  // --- the sheet: seven phase frames of the palette cycle ---------------------
  var sW = Math.ceil(geo.spanW * 2), sH = geo.sh * 2;
  // column phases take a RANDOM WALK (-1 / 0 / +1 per column) so the bands
  // wander like a hanging curtain — vertical striation, no diagonal barber
  // pole, no random checker
  var colPhase = new Array(sW), cr = rngFrom(61), cx = 0, ph = 0;
  while (cx < sW) {
    var cwid = (1 + Math.floor(cr() * 3)) * 2;      // 1-3 unit columns
    ph = (ph + Math.floor(cr() * 3) - 1 + 7) % 7;
    for (i = cx; i < cx + cwid && i < sW; i++) colPhase[i] = ph;
    cx += cwid;
  }
  // the sheet's own four steps: ripple -> (ripple/foam) -> foam -> white,
  // so the dark step is the pale blue of aerated water, never the deep
  var sheetRamp = [ramp[1], sceneMix(ramp[1], ramp[2], 0.5), ramp[2], ramp[3]];
  var rampRGB = [];
  for (i = 0; i < 4; i++) rampRGB[i] = sceneRGB(sheetRamp[i]);
  var sheets = [], phase;
  for (phase = 0; phase < 7; phase++) {
    var sc = document.createElement('canvas');
    sc.width = sW; sc.height = sH;
    var sg = sc.getContext('2d');
    var sim = sg.createImageData(sW, sH), sd = sim.data;
    p = 0;
    for (ty = 0; ty < sH; ty++) {
      var r = ty >> 2;                                // 2-unit band index
      var minIdx = ty > sH * 0.78 ? 2 : ty > sH * 0.55 ? 1 : 0;
      var dRow = (ty & 3) === 0;                      // dithered seam row
      for (tx = 0; tx < sW; tx++, p += 4) {
        var cp = colPhase[tx];
        // (r - phase): the pattern walks DOWN the face one band per step
        var v = Math.max(minIdx, DAM_SEQ[(r + cp - phase + 700) % 7]);
        if (dRow && r > 0) {
          var vp = Math.max(minIdx, DAM_SEQ[(r - 1 + cp - phase + 700) % 7]);
          if (((tx >> 1) & 1) === 1) v = vp;
        }
        var cc = rampRGB[v];
        sd[p] = cc[0]; sd[p + 1] = cc[1]; sd[p + 2] = cc[2]; sd[p + 3] = 255;
      }
    }
    sg.putImageData(sim, 0, 0);
    sheets.push(sc);
  }

  // --- thread accents: fixed columns, fixed offsets ---------------------------
  var threads = [], trr = rngFrom(62), x = geo.spanX + 1;
  while (x < geo.spanX + geo.spanW - 1) {
    threads.push({ x: x, off: trr() * (geo.sh + 6) });
    x += 4 + Math.floor(trr() * 4);
  }

  damRetakeCache = { key: W + 'x' + H + '@' + hour, back: back, sheets: sheets, geo: geo,
                     ramp: ramp, threads: threads, sky: sky, pool: pool,
                     cloud: sceneMix(sky.low, '#f2f2e8', 0.45 - 0.35 * starA),
                     cloudDk: sceneMix(sky.low, sky.top, 0.35),
                     streak: sceneMix(pool, ramp[0], 0.45),
                     rockDk: sceneMix('#6e6e78', '#10100c', 0.5),
                     boughHi: sceneMix(sky.tree, sky.low, 0.18) };
  return damRetakeCache;
}

// --- pictograph (v0.9.1 pass 7 retake, variant B) -----------------------
// ---------------------------------------------------------------------------
// The wall of big ochre figures on granite at Canoe Lake, seen from your own
// canoe drifting in under the overhang. Composition first: the face leans out
// over you (a dark lip across the top, thicker on the left), two wet streaks
// run down it, and the water at its foot throws the sun back up the rock as
// a crawling dapple. Your red bow points at the wall from bottom centre with
// the paddle resting across the left gunwale.
//
// Three speeds (idiom rule 5):
//   slow   — the dapple field crawls 1 cell up every 1.5 s and 1 cell sideways
//            every 4 s (its 8-row tile cycles in 12 s); deep-water glints
//            drift a texel every 0.6 s across a ~20 s lap.
//   medium — the reflection wobbles on a 2-unit grid, period 2 s; the lap
//            dashes step their ramp every 0.5 s in a 2 s wave; the bow's
//            ripple breathes on a 3 s period.
//   fast   — one bright texel walks down each wet streak every 0.15 s; the
//            dapple's mid band flicks to its top step every 0.5 s (never
//            inside the quiet band).
//
// Palette (rule 2): three ramps, no sky (you are under the rock).
//   rock   '#4a4a54' (lip shade) -> rockDk '#6e6e78' -> '#7c7c86' -> rock
//          '#8d8d95' -> '#9a9aa2' (the dapple's top step; nothing brighter)
//   water  deep '#17435f' -> water '#1e567a' -> shallow '#2b6b8f' ->
//          ripple '#3f83a8' -> foam '#cfe0e8'
//   ochre  '#7c2c21' -> '#a33e2f' -> '#c05540' (the figures AND your hull)
//   The reflection tints are the rock ramp mixed 60% into deep water
//   (hexLerp), the same trick `ochre` uses with sceneMix. The paddle and the
//   deck plate are grey ash so the scene stays at three ramps.
//
// No gradients, no globalAlpha: every edge is a Bayer 4x4 dither on 1-unit
// (2-texel) cells. The rock, its streaks, the wet foot and the reflection
// strip are painted ONCE per W x H onto offscreen canvases; per frame the
// painter blits them and lays the dapple, trickles, water, figures and bow.
// Everything is a pure function of (t, rnd): same seed + same t = same frame.
// ---------------------------------------------------------------------------


// cache keyed by W x H: rock face, reflection strip, dapple tiles, trickle paths
var pictographCache = { key: '', rock: null, refl: null, refH: 0, waterY: 0,
                        TA: null, TB: null, paths: null, streaks: null };

// --- bigpine (v0.9.1 pass 7 retake, variant A) --------------------------
// ---------------------------------------------------------------------------
// Looking up the big white pine, retaken in the low-bit idiom. The trunk still
// converges on the vanishing point with its bark ridge rows and nine whorls of
// boughs alternate sides; what changed is that the boughs are now dithered
// needle MASSES (a thin plate with five tufts, the outer third the fattest —
// a white pine's look), the sky is three Bayer-dithered bands brightening to a
// stepped sun halo behind the crown, and the picture moves on three speeds.
//
// Three speeds (idiom rule 5):
//   slow   — two clouds on a 2-unit row grid drift past the crown, the far one
//            one texel every 3 s, the near one one texel every 1.5 s (parallax);
//            a raven crosses high once per 35 s cycle (an 8 s crossing).
//   medium — the boughs sway as three LAYERS, whole texels: near (whorls 6-8)
//            3 texels at 4 s with a 1-texel bob, middle (3-5) 2 texels at 5 s,
//            top (0-2) 1 texel at 6 s — the parallax is in the swing itself.
//            The framing bough (top-left corner) rides the near layer.
//   fast   — needle tips flick between pine and pineLt on a 0.7 s phase per
//            tuft, only on whorls attached above H*0.5; the raven's wings beat
//            at 0.25 s.
//
// Ramps (idiom rule 2): pine pineDk→pine→pineLt (the masses and the tips);
// trunk #463526→trunk→trunkLt (body, ridges, and a 2-step Bayer along the lit
// right side); sky = the baseline's flat #8fb6d8 stepped toward PAL white in
// six ramp entries (three bands + three halo rings share the ramp), never a
// new hue. The raven is PAL black. No gradient, no alpha anywhere.
//
// Cost: everything static — the dithered sky, the halo, the whole trunk — is
// one plate built ONCE per W x H by writing texels straight into an ImageData
// (no per-cell fillRect, so the build is a few ms) and blitted with one
// drawImage; the boughs are nine small transparent canvases (bbox-sized)
// blitted at their layer's offset; the trunk's thin top is re-blitted over
// the clouds and raven from a second small plate. Per frame only the clouds,
// the raven, the tips and ~12 drawImage calls are issued.
//
// rnd() consumption order (fixed, all at the top of the painter): raven start
// offset, raven height, raven direction, cloud A x0, cloud B x0, then nine
// per-whorl tip phases. Shapes come from their own rngFrom(0x8b1e) so the
// cache is the same for every scene instance at a given W x H.
// ---------------------------------------------------------------------------

var bigpineCache = {};
var bigpineBayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

function bigpineRGB(c) {
  if (c.charAt(0) === '#') {
    var v = parseInt(c.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  var m = /(\d+)\D+(\d+)\D+(\d+)/.exec(c);
  return [+m[1], +m[2], +m[3]];
}

// A texel sheet: an ImageData at 2 texels per unit with a put() that writes
// a unit-space rect (0.5-unit steps) straight into the bytes. Built once per
// W x H, then handed to a canvas with putImageData.
function bigpineSheet(wUnits, hUnits) {
  var cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(wUnits * 2)); cv.height = Math.max(1, Math.round(hUnits * 2));
  var g = cv.getContext('2d');
  var id = g.createImageData(cv.width, cv.height);
  var d = id.data, TW = cv.width, TH = cv.height;
  return {
    cv: cv, w: cv.width / 2, h: cv.height / 2,
    put: function (x, y, w, h, c) {
      var x0 = Math.round(x * 2), y0 = Math.round(y * 2);
      var x1 = Math.round((x + w) * 2), y1 = Math.round((y + h) * 2);
      if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0;
      if (x1 > TW) x1 = TW; if (y1 > TH) y1 = TH;
      var px, py, o;
      for (py = y0; py < y1; py++) {
        o = (py * TW + x0) * 4;
        for (px = x0; px < x1; px++) {
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
          o += 4;
        }
      }
    },
    done: function () { g.putImageData(id, 0, 0); return cv; },
  };
}

// A tuft profile along a bough: five humps, the outer ones the biggest.
function bigpineTufts(rng) {
  var amps = [0.5, 0.6, 0.78, 0.95, 1.05], out = [], j;
  for (j = 0; j < 5; j++) {
    out.push({
      c: 0.28 + j * 0.17 + (rng() - 0.5) * 0.05,
      r: 0.08 + rng() * 0.03 + j * 0.006,
      a: amps[j] + (rng() - 0.5) * 0.15,
    });
  }
  return out;
}
function bigpineBump(tufts, s, floor) {
  var b = 0, j;
  for (j = 0; j < tufts.length; j++) {
    var u = (s - tufts[j].c) / tufts[j].r;
    var v = tufts[j].a * (1 - u * u);
    if (v > b) b = v;
  }
  if (s >= 0.15 && b < floor) b = floor;
  return b;
}

// Builds one bough's needle mass as a transparent canvas at texel resolution.
// ox/oy: where the stem leaves the trunk; dir: +1 right, -1 left; R: reach;
// T: mass height above the stem at the fattest tuft; rise: how far the tip
// climbs on screen; slope: for the framing bough, its y per x (else null);
// sil: silhouette mode (the framing bough — pineDk with a sparse pine
// sprinkle); wantTips: collect the flicker cells on the outer three crests.
function bigpineBough(rng, ox, oy, dir, R, T, rise, slope, sil, wantTips) {
  var PD = [0x1f, 0x53, 0x30], PN = [0x2c, 0x6e, 0x3f], PL = [0x3f, 0x8a, 0x52], ST = [0x46, 0x35, 0x26];
  var tufts = bigpineTufts(rng);
  var cells = [], tips = [];
  var n = Math.max(2, Math.round(R)), i, r;
  var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  function put(x, y, w, h, col) {
    cells.push([x, y, w, h, col]);
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x + w > maxX) maxX = x + w; if (y + h > maxY) maxY = y + h;
  }
  // the stem, 1-unit cells tapering to a texel at the tip
  var stemY = [];
  for (i = 0; i <= n; i++) {
    var s = i / n;
    var sy = slope !== null ? oy + i * slope
      : oy + (Math.sin(s * 3) * 2 - s * 4) * (rise / 3.72);
    stemY.push(sy);
    var cx = ox + dir * i;
    put(Math.floor(cx), Math.round(sy * 2) / 2, 1, s < 0.5 ? 1 : 0.5, ST);
  }
  // the mass, column by column
  var lastTuft = -1;
  for (i = 0; i <= n; i++) {
    var s2 = i / n;
    var bump = bigpineBump(tufts, s2, 0.22);
    if (bump <= 0) continue;
    var up = T * bump, down = T * 0.55 * bigpineBump(tufts, s2, 0.1);
    var cxi = Math.floor(ox + dir * i);
    var top = Math.round(stemY[i] - up), bot = Math.round(stemY[i] + down);
    var rows = bot - top;
    if (rows < 1) continue;
    for (r = top; r < bot; r++) {
      var p = (r - top + 0.5) / rows, col;
      if (sil) col = bigpineBayer[r & 3][cxi & 3] < 2 ? PN : PD;
      else if (rows <= 2) col = r === top ? PN : PD;
      else col = p < 0.3 ? PL : p < 0.7 ? PN : PD;
      put(cxi, r, 1, 1, col);
    }
    // Bayer fringe into the sky: two rows above, two below
    var fr;
    for (fr = 1; fr <= 2; fr++) {
      var fy = top - fr;
      if (bigpineBayer[fy & 3][cxi & 3] < (fr === 1 ? 8 : 3)) put(cxi, fy, 1, 1, sil ? PD : PL);
      var by = bot + fr - 1;
      if (bigpineBayer[by & 3][cxi & 3] < (fr === 1 ? 8 : 3)) put(cxi, by, 1, 1, PD);
    }
    // needle strokes: a 3-texel diagonal, up and outward, dark or light
    if (!sil && rows >= 3 && rng() < 0.4) {
      var ry = top + Math.floor(rows * 0.3) + Math.floor(rng() * Math.max(1, Math.floor(rows * 0.4)));
      var dcol = rng() < 0.5 ? PD : PL, q;
      for (q = 0; q < 3; q++) put(cxi + dir * 0.5 * q, ry + 0.5 - 0.5 * q, 0.5, 0.5, dcol);
    }
    // a tip cell on the crest of each of the three outer tufts
    if (wantTips) {
      var j;
      for (j = 2; j < 5; j++) {
        if (j !== lastTuft && Math.abs(s2 - tufts[j].c) * n < 0.6) {
          tips.push([cxi - (dir < 0 ? 1 : 0), top - 1]);
          lastTuft = j;
        }
      }
    }
  }
  minX = Math.floor(minX); minY = Math.floor(minY);
  maxX = Math.ceil(maxX); maxY = Math.ceil(maxY);
  var sh = bigpineSheet(maxX - minX, maxY - minY);
  for (i = 0; i < cells.length; i++) {
    sh.put(cells[i][0] - minX, cells[i][1] - minY, cells[i][2], cells[i][3], cells[i][4]);
  }
  return { cv: sh.done(), x: minX, y: minY, w: sh.w, h: sh.h, tips: tips };
}

function bigpineBuild(W, H) {
  var rng = rngFrom(0x8b1e);
  var m = Math.min(W, H), k = m / 135, portrait = H > W;
  var quietY = H - (portrait ? 60 : 48);
  var vx = W * 0.5;
  var C = { W: W, H: H, m: m, k: k, portrait: portrait, quietY: quietY, vx: vx };
  var i, x, y;

  // --- the sky ramp: baseline blue stepped toward white ------------------
  var base = '#8fb6d8', white = '#f2f2e8';
  var ramp = [], steps = [0, 0.2, 0.4, 0.58, 0.76, 0.92];
  C.skyCol = [];
  for (i = 0; i < 6; i++) {
    C.skyCol.push(hexLerp(base, white, steps[i]));
    ramp.push(bigpineRGB(C.skyCol[i]));
  }

  // --- plate 1: sky bands + halo, then the trunk ---------------------------
  var plate = bigpineSheet(W, H);
  var e1 = H * 0.32, e2 = H * 0.64;                 // band edges (2 -> 1 -> 0)
  var rs = m * (portrait ? 1.35 : 1);
  var r0 = rs * 0.11, r1 = rs * 0.2, r2 = rs * 0.31, hw = 1.5;
  var hy = -m * 0.02;
  function bandLevel(cy) {
    if (cy < e1 - 2) return 2;
    if (cy < e1 + 2) return 2 - (cy - (e1 - 2)) / 4;
    if (cy < e2 - 2) return 1;
    if (cy < e2 + 2) return 1 - (cy - (e2 - 2)) / 4;
    return 0;
  }
  function level(cx, cy) {
    var Lb = bandLevel(cy);
    var dx = cx - vx, dy = cy - hy, dd = Math.sqrt(dx * dx + dy * dy);
    if (dd >= r2 + hw) return Lb;
    if (dd >= r2 - hw) return 3 + (Lb - 3) * ((dd - (r2 - hw)) / (2 * hw));
    if (dd >= r1 + hw) return 3;
    if (dd >= r1 - hw) return 4 - (dd - (r1 - hw)) / (2 * hw);
    if (dd >= r0 + hw) return 4;
    if (dd >= r0 - hw) return 5 - (dd - (r0 - hw)) / (2 * hw);
    return 5;
  }
  for (y = 0; y < H; y++) {
    for (x = 0; x < W; x++) {
      var L = level(x + 0.5, y + 0.5);
      var idx = Math.floor(L + (bigpineBayer[y & 3][x & 3] + 0.5) / 16);
      if (idx > 5) idx = 5; if (idx < 0) idx = 0;
      plate.put(x, y, 1, 1, ramp[idx]);
    }
  }

  // the trunk: rows, a 2-step Bayer along the lit (right) side, a shadow
  // step on the left of the near half, then the ridge rows — spaced by
  // perspective, tight near the vanishing point, wide at the base
  var TD = [0x46, 0x35, 0x26], TR = [0x5d, 0x46, 0x32], TL = [0x7a, 0x5c, 0x42];
  function trunkInto(sh, yMax, xOff) {
    var yy, cx;
    for (yy = 0; yy < yMax; yy++) {
      var frac = (yy + 0.5) / H;
      var tw = 4 + frac * frac * W * 0.42;
      var x0 = Math.round((vx - tw / 2) * 2) / 2;
      tw = Math.round(tw * 2) / 2;
      var near = frac > 0.5;
      sh.put(x0 - xOff, yy, tw, 1, near ? TR : TD);
      var litFrom = Math.ceil(x0 + tw * 0.7), litTo = Math.floor(x0 + tw - 1);
      for (cx = litFrom; cx <= litTo; cx++) {
        var u = (cx - (x0 + tw * 0.7)) / (tw * 0.3);
        if (bigpineBayer[yy & 3][cx & 3] < (u < 0.5 ? 5 : 11)) sh.put(cx - xOff, yy, 1, 1, near ? TL : TR);
      }
      if (near) {
        var shTo = Math.floor(x0 + tw * 0.15);
        for (cx = Math.ceil(x0); cx <= shTo; cx++) {
          if (bigpineBayer[yy & 3][cx & 3] < 6) sh.put(cx - xOff, yy, 1, 1, TD);
        }
      }
    }
    var ry = 1;
    while (ry < yMax) {
      var fr2 = ry / H;
      var tw2 = 4 + fr2 * fr2 * W * 0.42;
      if (tw2 - 2 >= 1) {
        var x02 = Math.round((vx - tw2 / 2) * 2) / 2 + 1;
        sh.put(x02 - xOff, ry, Math.round((tw2 - 2) * 2) / 2, fr2 < 0.35 ? 0.5 : 1, fr2 > 0.5 ? TL : TR);
      }
      ry += Math.max(2, Math.round(2 + fr2 * 6 * k));
    }
  }
  trunkInto(plate, H, 0);
  C.plate = plate.done();

  // plate 2: the trunk's thin top, re-blitted over the clouds and the raven
  var topY = Math.ceil(H * 0.42);
  var twTop = 4 + 0.42 * 0.42 * W * 0.42 + 2;
  var capX = Math.floor(vx - twTop / 2 - 1);
  var cap = bigpineSheet(Math.ceil(twTop + 2), topY);
  trunkInto(cap, topY, capX);
  C.cap = { cv: cap.done(), x: capX, y: 0, w: cap.w, h: cap.h };

  // --- the nine whorls ----------------------------------------------------
  var y0 = H * (portrait ? 0.1 : 0.06);
  var Tk = k * (portrait ? 1.25 : 1);
  var Tnear = (5 + 0.78 * 9) * Tk;
  var yLast = Math.min(H * 0.78, quietY - Tnear - 3);
  var sp = (yLast - y0) / 8;
  C.boughs = [];
  for (i = 0; i < 9; i++) {
    var by = Math.round(y0 + i * sp);
    var frac3 = by / H;
    var R = portrait ? Math.min(vx - 2, W * (0.16 + frac3 * 0.6)) : W * (0.12 + frac3 * 0.5);
    var T = (5 + frac3 * 9) * Tk;
    var dir = i % 2 ? 1 : -1;
    var twb = 4 + frac3 * frac3 * W * 0.42;
    var ax = vx + dir * Math.max(0, twb / 2 - 1.5);
    var rise = -R * 0.065;
    var b = bigpineBough(rng, ax, by, dir, R, T, rise, null, false, by < H * 0.5);
    b.layer = i < 3 ? 0 : i < 6 ? 1 : 2;
    C.boughs.push(b);
  }

  // --- the framing bough: a neighbour's limb over the top-left corner ------
  var fx0 = -m * 0.04, fy0 = -m * 0.05;
  var fx1 = W * (portrait ? 0.42 : 0.36), fy1 = H * (portrait ? 0.085 : 0.15);
  var fR = fx1 - fx0, fSlope = (fy1 - fy0) / fR;
  C.frame = bigpineBough(rng, fx0, fy0, 1, fR, m * 0.12, 0, fSlope, true, false);
  C.frame.layer = 2;

  // --- cloud shapes on the 2-unit row grid ---------------------------------
  function cloud(wid, rowsSpec) {
    var rows = [], j;
    for (j = 0; j < rowsSpec.length; j++) {
      var a = Math.round(rowsSpec[j][0] * wid), bb = Math.round(rowsSpec[j][1] * wid);
      if (bb - a < 1) bb = a + 1;
      rows.push([a, bb - a]);
    }
    return { w: wid, rows: rows };
  }
  C.cloudA = cloud(Math.round(m * 0.24), [[0.35, 0.65], [0.15, 0.85], [0, 1], [0.08, 0.95]]);
  C.cloudB = cloud(Math.round(m * 0.38), [[0.4, 0.62], [0.2, 0.85], [0.06, 1], [0, 0.97], [0.1, 0.9]]);
  C.cloudAy = Math.floor(H * (portrait ? 0.16 : 0.1) / 2) * 2;
  C.cloudBy = Math.floor(H * (portrait ? 0.3 : 0.2) / 2) * 2;
  C.cloudCol = [white, C.skyCol[1]];

  bigpineCache[W + 'x' + H] = C;
  return C;
}

// --- ranger (v0.9.1 pass 7 retake, variant B) ---------------------------
// ---------------------------------------------------------------------------
// The ranger cabin ruin on the Far Shore trip, retaken in the low-bit idiom.
// The retake is LIGHT: sun through a canopy the viewer stands under, laid
// over the clearing and the cabin's south wall as a crawling two-step Bayer
// dapple, with the north side of the wall in shade and mossed.
//
// Layers, back to front: dithered sky bands (5 flat stops of the baseline's
// two colours, Bayer seams) -> two clouds at two speeds (parallax) -> a hazy
// far ridge -> the treeline with three tall spruce behind the cabin -> the
// clearing (grass over grassDk, dithered seam, sparse static speckle) ->
// the ground dapple -> the cabin (courses, log ends, shade zone with a
// vertical Bayer seam, moss, doorway) -> the wall dapple -> the doorway's
// chink of light -> the chimney (with a chickadee) -> fireweed, grass tufts
// and the butterfly -> a leaning birch trunk as the near frame, entering at
// the left edge and leaving at the top, with a bough and a leaf cluster.
// The birch's foot is out of frame to the left so the trunk never crosses
// the caption: the frame element is the top-left corner and left edge only.
//
// Three speeds:
//   slow   — dapple crawl 1 texel / 2 s (a 96 s to-and-fro, canopy swaying);
//            clouds 1 texel / 3 s (far) and / 1.5 s (near); doorway chink
//            winks on a 6 s cycle; chickadee flits off the chimney every 20 s.
//   medium — fireweed nod and grass flick, a 3 s wave travelling across W
//            (phase by x); birch leaves on the same wave; chickadee head-turn 2 s.
//   fast   — butterfly texel step 0.12 s (wings alternate each step);
//            dapple two-step flick 0.4 s (the half-lit cells swap checker phase).
//   All of it above the quiet band: below H-48 (landscape) / H-60 (portrait)
//   the dapple only crawls (no half cells), fireweed and tufts stand still,
//   and the butterfly never goes.
//
// Ramps (idiom §2): trunk #463526 -> trunk #5d4632 -> trunkLt #7a5c42 ->
// sandDk #a8905e (the sunlit step; PAL sandDk, the closest warm light);
// pine pineDk #1f5330 -> pine #2c6e3f -> pineLt #3f8a52 (moss, tufts,
// stalks, leaves); rock rockDk #6e6e78 -> rock #8d8d95 -> #9a9aa2 (chimney).
// Ground: grassDk #20492a -> grass #2a5c35 -> pineLt #3f8a52 (the dapple).
// Fireweed heads: #7a6ab8 -> lilyFl #e8b4c8 (the berry->lilyFl ramp, mid and
// top). Butterfly signYl #e8c832. Birch birch #e8e4da / birchDk #b8b4aa with
// #463526 bands. Sky: the baseline's #8fb6d8 -> #cfe0e8 quantized to five
// stops. No createLinearGradient, no globalAlpha, no rgba anywhere.
//
// Cost (idiom §9): rangerCacheB (keyed W+'x'+H) holds, built once per scene
// open: `back` (sky, clouds' lane excepted, ridge, trees, ground, shadows,
// still tufts), `cabin` (wall, ends, shade seam, moss, doorway, chimney),
// `front` (the birch), and four dapple canvases — ground A/B and wall A/B,
// each P=24 units wider than the area it covers so the crawl is a source-x
// offset on a 9-arg drawImage. Per frame: 3 backdrop blits + 1 ground dapple
// + 8 wall dapple (one per course, so each stops at its own sagging end)
// + the live sprites. Deterministic: every position is a function of t and
// the scene rnd; the caches use fixed rngFrom seeds and an integer hash.
// ---------------------------------------------------------------------------

var rangerCacheB = { key: null };

// snap to one texel (0.5 art unit)
function rangerQ(v) { return Math.round(v * 2) / 2; }

// integer lattice hash -> [0, 1): the same on every engine (no Math.sin)
function rangerHash(i, j) {
  var h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul((j | 0) + 0x165667b1, 0x9e3779b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// value noise on that lattice, smoothstep-blended: blobs, not static
function rangerNoise(x, y) {
  var xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  var a = rangerHash(xi, yi), b = rangerHash(xi + 1, yi);
  var c = rangerHash(xi, yi + 1), d = rangerHash(xi + 1, yi + 1);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

// Bayer 4x4, the classic order
var rangerBayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

// Horizontal seam between two flat bands over 4 unit rows (1-unit cells):
// rows carry 1, 2, 2, 3 of every 4 cells of the LOWER colour. The upper band
// must already be painted through y0 + 4 and the lower band from y0 + 4 on.
function rangerDitherH(g, x0, x1, y0, upper, lower) {
  var x;
  g.fillStyle = lower;
  for (x = x0 + 2; x < x1; x += 4) g.fillRect(x, y0, 1, 1);
  for (x = x0; x < x1; x += 4) { g.fillRect(x, y0 + 1, 1, 1); g.fillRect(x + 2, y0 + 1, 1, 1); }
  for (x = x0 + 1; x < x1; x += 4) { g.fillRect(x, y0 + 2, 1, 1); g.fillRect(x + 2, y0 + 2, 1, 1); }
  g.fillRect(x0, y0 + 3, x1 - x0, 1);
  g.fillStyle = upper;
  for (x = x0 + 2; x < x1; x += 4) g.fillRect(x, y0 + 3, 1, 1);
}

// Vertical seam: columns x0..x0+3 go from `left` to `right`; the left colour
// must already cover the four columns. 1-unit cells on the Bayer threshold.
function rangerDitherV(g, x0, y0, y1, right) {
  var cuts = [2, 5, 10, 14], k, y, j;
  g.fillStyle = right;
  for (k = 0; k < 4; k++) {
    for (y = y0, j = 0; y < y1; y++, j++) {
      if (rangerBayer[j & 3][k] < cuts[k]) g.fillRect(x0 + k, y, 1, Math.min(1, y1 - y));
    }
  }
}

// one grass tuft: a base, a blade, a second blade on the tall ones
function rangerTuft(g, x, y, h, col, flick) {
  g.fillStyle = col;
  g.fillRect(x - 0.5, y - 0.5, 1.5, 0.5);
  g.fillRect(x + flick, y - h, 0.5, h);
  if (h >= 2) g.fillRect(x - 0.5 - flick, y - h + 1, 0.5, h - 1);
}

// the dapple's two-step Bayer: full cells and half (checker) cells. Half
// cells only above `quietY` (screen y); `phase` swaps the checker.
function rangerDappleCell(g, x, y, half, phase, col) {
  g.fillStyle = col;
  if (!half) { g.fillRect(x, y, 1, 1); return; }
  if (phase) { g.fillRect(x, y, 0.5, 0.5); g.fillRect(x + 0.5, y + 0.5, 0.5, 0.5); }
  else { g.fillRect(x + 0.5, y, 0.5, 0.5); g.fillRect(x, y + 0.5, 0.5, 0.5); }
}

function rangerNewCanvas(wUnits, hUnits) {
  var c = document.createElement('canvas');
  c.width = Math.ceil(wUnits * 2); c.height = Math.ceil(hUnits * 2);
  var g = c.getContext('2d');
  g.setTransform(2, 0, 0, 2, 0, 0);
  return { c: c, g: g };
}

function rangerBuildB(W, H) {
  var m = Math.min(W, H), port = H > W;
  var horizon = rangerQ(H * 0.5);
  var quietY = H - (port ? 60 : 48);
  var P = 24;                                         // dapple crawl span, units
  var base = rangerQ(horizon + 0.18 * m);             // the cabin's foot
  var cw = rangerQ(W * 0.42), cx0 = rangerQ(W * 0.24);
  var chh = rangerQ(Math.min(0.34 * m, cw * 0.75));   // portrait: the baseline's tower, shortened to a cabin
  var rowH = chh / 8;
  var shadeW = rangerQ(cw * 0.3);                     // the north side, in shade
  var chx = rangerQ(cx0 + cw + W * 0.04), chw = rangerQ(Math.max(W * 0.05, m * 0.06));
  var stoneH = rangerQ(0.036 * m), pitch = stoneH + 0.5;
  var chTop = base - 11 * pitch;
  var gTop = horizon + 1.5;
  var gseam = Math.floor(gTop + (H - gTop) * 0.66);
  var C = {
    key: W + 'x' + H, W: W, H: H, m: m, port: port, P: P,
    horizon: horizon, quietY: quietY, base: base, cx0: cx0, cw: cw, chh: chh,
    shadeW: shadeW, chx: chx, chw: chw, chTop: chTop, gTop: gTop, gseam: gseam,
    courses: [], liveTufts: [], leaves: [],
    laneTop: 4, laneBot: Math.max(8, Math.floor(horizon - 0.3 * m - 8)),
  };
  var i, x, y, r;

  // --- course geometry (sag snapped to the texel) ---------------------------
  // each course runs down to the top of the one below it (the bottom one to
  // the ground), so the sag never opens a gap the sky shows through; the
  // dark underside line drawn on every course keeps them reading as logs
  var cyMin = base, prevY = base;
  for (r = 0; r < 8; r++) {
    var ly = rangerQ(base - (r + 1) * rowH + Math.sin(r * 1.7) * 1.2);
    var h = prevY - ly;
    var w = rangerQ(cw * (1 - r * 0.03));
    C.courses.push({ y: ly, h: h, w: w, light: (r % 2) === 0 });
    if (ly < cyMin) cyMin = ly;
    prevY = ly;
  }
  C.cy0 = cyMin;
  // the doorway (in the shade zone, so the wall dapple never reaches it)
  C.door = { x: rangerQ(cx0 + cw * 0.16), w: rangerQ(cw * 0.16), y: rangerQ(cyMin + chh * 0.35) };

  // =========================================================================
  // BACK: sky, ridge, treeline, spruce, ground, shadows, still tufts
  // =========================================================================
  var bk = rangerNewCanvas(W, H), g = bk.g;
  var skyRamp = ['#8fb6d8', hexLerp('#8fb6d8', '#cfe0e8', 0.25), hexLerp('#8fb6d8', '#cfe0e8', 0.5),
                 hexLerp('#8fb6d8', '#cfe0e8', 0.75), '#cfe0e8'];
  var bandH = horizon / 5;
  for (i = 0; i < 5; i++) {
    g.fillStyle = skyRamp[i];
    g.fillRect(0, Math.floor(bandH * i), W, Math.ceil(bandH) + 2);
  }
  for (i = 1; i < 5; i++) {
    var sy = Math.round(bandH * i) - 2;
    g.fillStyle = skyRamp[i - 1]; g.fillRect(0, sy, W, 4);
    rangerDitherH(g, 0, W, sy, skyRamp[i - 1], skyRamp[i]);
  }
  // far ridge, hazed toward the low sky; then the treeline (baseline seed 71)
  sceneTreeline(g, W, H, rngFrom(77), horizon - 2.5, sceneMix('#cfe0e8', '#274d33', 0.45), 0.7);
  sceneTreeline(g, W, H, rngFrom(71), horizon, '#274d33');
  // three tall spruce behind the cabin, under the cloud lane
  var spr = [[cx0 + cw * 0.55, 0.30], [chx + chw + m * 0.05, 0.24], [cx0 - m * 0.08, 0.27]];
  g.fillStyle = '#1f5330';
  for (i = 0; i < 3; i++) {
    var sx = rangerQ(spr[i][0]), sh = rangerQ(spr[i][1] * m), sw = rangerQ(sh * 0.36), s;
    for (s = 0; s < sh; s += 1) {
      var half = rangerQ((sw / 2) * (s / sh) + 0.5);
      g.fillRect(sx - half, horizon - sh + s, half * 2, 1);
    }
  }
  // the clearing: grass over grassDk, one dithered seam, dark tree-foot row
  g.fillStyle = '#2a5c35'; g.fillRect(0, gTop, W, gseam + 4 - gTop);
  g.fillStyle = '#20492a'; g.fillRect(0, gseam + 4, W, H - gseam - 4);
  rangerDitherH(g, 0, W, gseam, '#2a5c35', '#20492a');
  g.fillStyle = '#1f5330'; g.fillRect(0, gTop - 0.5, W, 0.5);
  // sparse static speckle, texel-snapped, from a fixed seed
  var sp = rngFrom(79), nSp = Math.round(W * (H - gTop) / 14);
  for (i = 0; i < nSp; i++) {
    x = rangerQ(sp() * W); y = rangerQ(gTop + sp() * (H - gTop));
    g.fillStyle = y > gseam + 2 ? '#1b3f24' : (sp() < 0.5 ? '#20492a' : '#1f5330');
    g.fillRect(x, y, 1, 0.5);
  }
  // the cabin's shadow at its foot, dithered into the grass
  g.fillStyle = '#20492a';
  g.fillRect(cx0 - 2, base - 0.5, chx + chw - cx0 + 4, 2.5);
  rangerDitherH(g, Math.floor(cx0 - 2), Math.ceil(chx + chw + 2), base + 2 > gseam ? gseam - 1 : Math.floor(base + 2), '#20492a', '#2a5c35');
  // still tufts: the bottom edge (dark, quiet band) and the cabin's foot
  var tr = rngFrom(83), nT = Math.round(W / 5);
  for (i = 0; i < nT; i++) {
    x = rangerQ(tr() * W); y = rangerQ(H - 1 - tr() * 9);
    rangerTuft(g, x, y, 2 + Math.round(tr() * 2), tr() < 0.6 ? '#1f5330' : '#2c6e3f', 0);
  }
  var nF = Math.round((chx + chw - cx0) / 3.5);
  for (i = 0; i < nF; i++) {
    x = rangerQ(cx0 - 1 + tr() * (chx + chw - cx0 + 2)); y = rangerQ(base + 0.5 + tr() * 2);
    var th = 2 + Math.round(tr() * 2);
    var tc = tr() < 0.5 ? '#2c6e3f' : '#3f8a52';
    if (y - th < quietY) C.liveTufts.push({ x: x, y: y, h: th, col: tc, ph: tr() * 6.28 });
    else rangerTuft(g, x, y, th, tc, 0);
  }
  C.back = bk.c;

  // =========================================================================
  // CABIN: courses with a shaded north side, ends, moss, doorway, chimney
  // =========================================================================
  var cb = rangerNewCanvas(W, H); g = cb.g;
  for (r = 0; r < 8; r++) {
    var co = C.courses[r];
    var lit = co.light ? '#7a5c42' : '#5d4632', dk = co.light ? '#5d4632' : '#463526';
    g.fillStyle = lit; g.fillRect(cx0, co.y, co.w, co.h);
    g.fillStyle = dk;  g.fillRect(cx0, co.y, shadeW, co.h);          // north side in shade
    rangerDitherV(g, cx0 + shadeW, co.y, co.y + co.h, lit);          // its seam
    g.fillRect(cx0, co.y + co.h - 0.5, co.w, 0.5);                   // the log's underside
    g.fillStyle = co.light ? '#a8905e' : '#7a5c42';                  // sun on the top edge
    g.fillRect(cx0 + shadeW + 4, co.y, co.w - shadeW - 4, 0.5);
    g.fillStyle = '#463526'; g.fillRect(cx0 - 1.5, co.y, 1.5, co.h); // the log ends
    g.fillStyle = '#5d4632'; g.fillRect(cx0 - 1.5, co.y + 0.5, 0.5, co.h - 1); // end grain
  }
  // moss creeping up the north side: pine ramp, denser toward the wet corner
  for (y = Math.floor(C.cy0 + chh * 0.38); y < base; y += 1) {
    for (x = cx0; x < cx0 + shadeW + 6; x += 1.5) {
      var fx = (x - cx0) / (shadeW + 6), fy = (y - C.cy0) / chh;
      var v = rangerNoise(x / 5 + 3.1, y / 3 + 9.7) + (1 - fx) * 0.45 + fy * 0.4;
      if (v < 1.1) continue;
      g.fillStyle = v > 1.4 ? '#2c6e3f' : '#1f5330';
      g.fillRect(x, y, 1.5, 1);
      if (v > 1.5) { g.fillStyle = '#3f8a52'; g.fillRect(x + 0.5, y, 0.5, 0.5); }
    }
  }
  // the doorway, dark as a held breath
  g.fillStyle = '#0c0f0a';
  g.fillRect(C.door.x, C.door.y, C.door.w, base - C.door.y);
  // the stone chimney, still standing guard: alternating stones, sun on top edges
  var st;
  for (st = 0; st < 12; st++) {
    var sy4 = base - st * pitch, jx = rangerQ(Math.sin(st * 2.3) * 0.8), swd = rangerQ(chw - st * 0.12);
    g.fillStyle = st % 2 ? '#8d8d95' : '#6e6e78';
    g.fillRect(chx + jx, sy4, swd, stoneH);
    if (st % 2) { g.fillStyle = '#9a9aa2'; g.fillRect(chx + jx + 0.5, sy4, swd - 1, 0.5); }
    g.fillStyle = '#6e6e78'; g.fillRect(chx + jx, sy4, 0.5, stoneH);   // shaded left face
  }
  C.cabin = cb.c;
  C.cabBox = { x: cx0 - 2, y: chTop - 1, w: chx + chw - cx0 + 4, h: base + stoneH + 1 - chTop + 1 };

  // =========================================================================
  // DAPPLE: ground A/B (perspective blobs) and wall A/B (per-course colour)
  // =========================================================================
  var gh = H - gTop, gw = W + P;
  var dA = rangerNewCanvas(gw, gh), dB = rangerNewCanvas(gw, gh);
  var cy;
  // ground-plane mapping: a patch of light is the same size on the ground
  // everywhere, so on screen it shrinks and flattens toward the treeline
  for (cy = 0; cy < gh; cy += 1) {
    var z = cy / gh + 0.15;
    var screenY = gTop + cy, canHalf = screenY < quietY;
    var col = screenY > gseam + 2 ? '#2a5c35' : '#3f8a52';
    for (x = 0; x < gw; x += 1) {
      // two octaves: broad patches where the canopy has a gap, broken up by
      // a finer leaf-scale grain, so the light lands as flecks, not blobs
      // (x measured from the crawl's own centre, not the screen's, so the
      // perspective shear does not comb the patches into radial streaks)
      var n = rangerNoise((x - gw / 2) / (z * 5.5) + 7.3, 15 / z + 2.1) * 0.75 +
              rangerNoise(x / 2.2 + 31.1, cy / 1.6 + 4.7) * 0.25;
      if (n > 0.705) { rangerDappleCell(dA.g, x, cy, false, 0, col); rangerDappleCell(dB.g, x, cy, false, 0, col); }
      else if (n > 0.655 && canHalf) { rangerDappleCell(dA.g, x, cy, true, 0, col); rangerDappleCell(dB.g, x, cy, true, 1, col); }
    }
  }
  C.dapA = dA.c; C.dapB = dB.c;
  var ww = cw + P, wA = rangerNewCanvas(ww, chh + 2), wB = rangerNewCanvas(ww, chh + 2);
  for (r = 0; r < 8; r++) {
    var c2 = C.courses[r], wc = c2.light ? '#a8905e' : '#7a5c42';
    for (y = c2.y + 0.5; y < c2.y + c2.h - 0.5; y += 1) {
      var half2 = y < quietY;
      for (x = 0; x < ww; x += 1) {
        var n2 = rangerNoise(x / 6 + 11.7, y / 3.5 + 5.2) * 0.75 + rangerNoise(x / 2.2 + 41.3, y / 1.6 + 8.9) * 0.25;
        if (n2 > 0.69) { rangerDappleCell(wA.g, x, y - C.cy0, false, 0, wc); rangerDappleCell(wB.g, x, y - C.cy0, false, 0, wc); }
        else if (n2 > 0.64 && half2) { rangerDappleCell(wA.g, x, y - C.cy0, true, 0, wc); rangerDappleCell(wB.g, x, y - C.cy0, true, 1, wc); }
      }
    }
  }
  C.wallA = wA.c; C.wallB = wB.c;

  // =========================================================================
  // FRONT: the leaning birch — foot off-frame left, leaves the top edge
  // =========================================================================
  var fr = rangerNewCanvas(W, H); g = fr.g;
  // The trunk's centre runs from xt at the top edge to -bw at the top of
  // the quiet band, so it has left the frame by the left edge before the
  // caption's rows: rows stop as soon as the trunk's right edge is off-screen.
  var yb = quietY - 2, xt = rangerQ(W * 0.11), bw = rangerQ(0.075 * m);
  C.birch = { yb: yb, xt: xt, bw: bw };
  var br = rngFrom(89);
  for (y = 0; y < yb; y += 0.5) {
    var u = y / yb, xc = xt - (xt + bw) * u, wd = rangerQ(bw * (0.7 + 0.3 * u));
    var xl = rangerQ(xc - wd / 2), xr = xl + wd;
    if (xr <= 0) break;
    g.fillStyle = '#e8e4da'; g.fillRect(xl, y, wd, 0.5);
    g.fillStyle = '#b8b4aa'; g.fillRect(xl, y, rangerQ(wd * 0.35), 0.5);       // shaded side
    g.fillRect(xr - 0.5, y, 0.5, 0.5);                                         // the far edge
    var bv = br();
    if (bv < 0.16) {                                                            // lenticel band
      g.fillStyle = '#463526';
      var bx = rangerQ(xl + br() * wd * 0.6), bl = rangerQ(1 + br() * wd * 0.5);
      g.fillRect(bx, y, Math.min(bl, xr - bx), 0.5);
    } else if (bv < 0.2) {                                                      // peeling curl
      g.fillStyle = '#b8b4aa';
      g.fillRect(rangerQ(xl + br() * wd * 0.7), y, 1.5, 0.5);
    }
  }
  // a couple of branch scars, the dark eyes a birch keeps
  var eyes = [0.22, 0.58], e;
  for (e = 0; e < 2; e++) {
    var ey = rangerQ(yb * eyes[e]), exc = xt - (xt + bw) * eyes[e], ew = bw * (0.7 + 0.3 * eyes[e]);
    g.fillStyle = '#10100c';
    g.fillRect(rangerQ(exc + ew * 0.05), ey, rangerQ(ew * 0.3), 0.5);
    g.fillRect(rangerQ(exc + ew * 0.1), ey + 0.5, rangerQ(ew * 0.2), 1);
    g.fillRect(rangerQ(exc + ew * 0.15), ey + 1.5, rangerQ(ew * 0.1), 0.5);
  }
  // the boughs: from the trunk out to the right, thinning, each carrying a
  // canopy of leaf cells — this is the tree the dapple falls through. One
  // bough high in landscape; portrait hangs a second, longer one lower down
  // to spend the tall sky on the frame rather than on empty bands.
  var boughs = [[0.1, 0.22]];
  if (port) boughs.push([0.3, 0.34]);
  var lr = rngFrom(97), maxR = 0, k, b, c;
  for (b = 0; b < boughs.length; b++) {
    var bu = boughs[b][0], by0 = rangerQ(yb * bu), bx0 = rangerQ(xt - (xt + bw) * bu), bLen = rangerQ(W * boughs[b][1]);
    // a birch bough lifts off the trunk and droops at the tip: the spine
    var lift = b === 0 ? 0.16 : 0.1, droop = bLen * 0.14;
    var spineAt = function (kk) { var u2 = kk / bLen; return by0 - kk * lift + u2 * u2 * droop; };
    // the leaves hang in clumps from short twigs — a birch's foliage droops
    // in tufts, it is not a spruce's mass — in the pine ramp: pineLt on the
    // sunlit crown (with 'good' #69c977 tips, the sun is up there), pine in
    // the body, pineDk on the shaded underside, the silhouette roughened
    // by a few dropped cells. Every cell 1 unit, snapped.
    var nC = 3 + Math.floor(bLen / 10), spans = [0.55, 0.9, 1, 1, 0.85, 0.6, 0.35];
    var rightMost = bx0 + bLen;
    for (c = 0; c < nC; c++) {
      var f = 0.28 + (c + 0.3 + lr() * 0.5) / nC * 0.75;
      if (f > 1.02) f = 1.02;
      var kx = rangerQ(bLen * f), tx0 = bx0 + kx, ty0 = rangerQ(spineAt(kx));
      var up = c === 0 || lr() < 0.22;                          // a spray above the bough now and then
      var cwid = rangerQ((up ? 3 : 4) + lr() * (up ? 2 : 4)), rows = up ? 4 : 5 + Math.floor(lr() * 3);
      var twig = up ? 0 : 1 + Math.floor(lr() * 2), r5;
      if (!up) {                                                 // the twig, down and out
        g.fillStyle = '#b8b4aa';
        for (r5 = 0; r5 < twig; r5++) g.fillRect(tx0 + r5, ty0 + 1 + r5, 1, 1);
      }
      var cx2 = rangerQ(tx0 + twig + (up ? 0 : 0.5)), cy2 = up ? ty0 - rows : ty0 + 1 + twig;
      for (r5 = 0; r5 < rows; r5++) {
        var wr = Math.max(1, Math.round(cwid * spans[Math.min(6, Math.floor(r5 / rows * 7))]));
        var xs = Math.round(cx2 - wr / 2), yy = cy2 + r5, xx;
        var top = r5 < Math.max(1, Math.round(rows * 0.3)), bot = r5 >= rows - Math.max(1, Math.round(rows * 0.3));
        for (xx = xs; xx < xs + wr; xx++) {
          var edge = xx === xs || xx === xs + wr - 1 || r5 === 0 || r5 === rows - 1;
          if (edge && rangerHash(xx + b * 131, yy + c * 17) < 0.28) continue;
          g.fillStyle = bot ? '#1f5330' : top ? '#3f8a52' : '#2c6e3f';
          g.fillRect(xx, yy, 1, 1);
          if (top && !edge && rangerHash(yy + b * 7, xx + c * 29) < 0.35) { g.fillStyle = '#69c977'; g.fillRect(xx, yy, 0.5, 0.5); }
        }
        if (r5 === rows - 1 || r5 === 0) {
          // live leaves on the rim: the bottom row's ends, the crown's ends
          C.leaves.push({ x: xs - 0.5, y: r5 === 0 ? yy - 0.5 : yy + 0.5, col: r5 === 0 ? '#3f8a52' : '#1f5330', ph: lr() * 6.28 });
          C.leaves.push({ x: xs + wr - 0.5, y: r5 === 0 ? yy - 0.5 : yy + 0.5, col: r5 === 0 ? '#69c977' : '#2c6e3f', ph: lr() * 6.28 });
        }
        if (xs + wr + 1 > rightMost) rightMost = xs + wr + 1;
      }
      if (!up) C.leaves.push({ x: rangerQ(cx2), y: cy2 + rows, col: '#1f5330', ph: lr() * 6.28 });
    }
    // the bough itself, over the sprays and behind the hanging clumps' twigs:
    // 2 units at the trunk tapering to 1, a birchDk underside all the way
    for (k = 0; k < bLen; k += 1) {
      var by = rangerQ(spineAt(k)), bt = k < bLen * 0.35 ? 2 : k < bLen * 0.7 ? 1.5 : 1;
      g.fillStyle = '#e8e4da'; g.fillRect(bx0 + k, by, 1, bt);
      g.fillStyle = '#b8b4aa'; g.fillRect(bx0 + k, by + bt - 0.5, 1, 0.5);
      if ((k & 7) === 3) { g.fillStyle = '#463526'; g.fillRect(bx0 + k, by + (bt > 1 ? 0.5 : 0), 1, 0.5); }
    }
    if (rightMost + 2 > maxR) maxR = rightMost + 2;
  }
  C.front = fr.c;
  C.frontBox = { x: 0, y: 0, w: Math.min(W, Math.ceil(maxR + 2)), h: Math.ceil(yb + 1) };
  return C;
}

// --- lightning (v0.9.1 pass 7 retake, variant A) ------------------------
// ---------------------------------------------------------------------------
// The lightning pine on the Far Shore trip, retaken in the low-bit idiom. The
// silhouette is the baseline's, untouched: the charred spar leaning left, the
// living half leaning right, the char scar spiralling down the shared trunk.
// Everything around it is new: the weather, the ground, the bird.
//
// Three speeds (idiom rule 5):
//   slow   — the building cloud drifts in from the left one texel every 1.5 s
//            (wraps after it clears the frame) and BUILDS: its domes climb a
//            row out of the flat slab every few seconds and settle back on a
//            50 s rise-and-fall; a smaller far cloud, cut from the sky ramp,
//            drifts one texel every 3 s on the right (parallax), and portrait
//            gets a second one low over the ridge at one texel every 4 s; a
//            raven on a 25 s cycle — perched clear of the dead spar's tip for
//            19 s (it turns its head every 4 s, lifts a wing once), then it
//            lifts off and circles once, 6 s, and lands.
//   medium — the living half's needle tufts sway as two layers, the outer
//            tufts two texels on a 3.5 s period, the inner ones one texel on
//            5 s; the grass on the ground leans one texel every 3 s (dark
//            pine on darker pine — the ground is inside the quiet band).
//   fast   — sheet lightning far off: the whole sky and the cloud step one
//            ramp entry brighter for 0.1 s, with a 0.05 s after-flicker a
//            quarter second later, every 12–20 s on a schedule rolled from
//            the scene seed; no bolt. The needle tips (the pineLt cells)
//            flick one texel every 0.35 s (0.7 s period); the raven's wings
//            beat every 0.15 s while it flies.
//
// Layers (rule 6), back to front: dithered sky → far cloud(s) → the building
// cloud → hazy far ridge → the ground (pine-on-pineDk stipple, still) → the
// pine (trunk, spars, scar) → the needle tufts (varied: every third short,
// every third-plus-one a row higher, windward tufts on the odd boughs) →
// the shed shards and grass → the fallen charred limb across the bottom-left
// corner (the foreground frame: dark, still, in the quiet band) → the raven.
//
// Ramps (rule 2): sky = the baseline's day blues quantized to four bands,
// '#9fc2dc' → '#b0cde0' → '#c2d9e4' → '#dbe6e2' (+ '#eef2ec' as the flash's
// top step; five colours, four steps — the middle two sit OFF the cloud's
// lit shade so the cloud reads), blended with Bayer 4x4 over 4 rows of
// 1-unit cells; the building cloud is the brief's two shades '#cfe0e8' /
// '#8ea6c2' plus PAL white as a one-row rim on each dome's crown; the far
// cloud is cut from the sky ramp itself ('#eef2ec' / '#dbe6e2' / '#9fc2dc');
// pine pineDk → pine → pineLt for the tufts and ground; trunk '#463526' →
// '#5d4632' → '#7a5c42' for the bark; the char is '#16120e' with the one
// '#2b241c' step. The raven is black with a rockDk '#6e6e78' beak.
//
// Cost: the sky (two versions, dark and flashed), the ridge and ground, and
// the whole tree with its shards and the limb are painted ONCE per
// W x H x seed into three offscreen canvases (back / backFlash / front, the
// front transparent where the sky shows so the clouds drift behind the
// tree) plus the cloud plates (near and far, each a tower plate and a slab,
// dark and flashed — the build is a drawImage offset, never a repaint). Per
// frame: eight to ten drawImage calls and fills for the tufts, grass and
// raven only.
//
// rnd() is consumed ONCE per frame (the first roll seeds everything else);
// the baseline had no schedule to preserve. Same seed + same t = same frame.
// ---------------------------------------------------------------------------

var lightningCache = { key: null };
var lightningBayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
var lightningSkyRamp = ['#9fc2dc', '#b0cde0', '#c2d9e4', '#dbe6e2', '#eef2ec'];
// the building cloud's shades (the brief's two, plus PAL white as the crown
// rim) and their flash step; the far cloud is cut from the sky ramp itself
var lightningCloudShades = { rim: '#f2f2e8', lit: '#cfe0e8', dark: '#8ea6c2' };
var lightningCloudFlash  = { rim: '#f2f2e8', lit: '#eef2ec', dark: '#cfe0e8' };
var lightningFarShades   = { rim: '#eef2ec', lit: '#dbe6e2', dark: '#9fc2dc' };
var lightningFarFlash    = { rim: '#f2f2e8', lit: '#eef2ec', dark: '#c2d9e4' };

function lightningSnap(v) { return Math.round(v * 2) / 2; }

// A horizontal Bayer transition over `rows` 1-unit rows starting at y0. The
// band painted underneath is `above` for the top half of the rows and `below`
// for the bottom half, so only the cells that differ are filled.
function lightningDitherRows(g, W, y0, rows, above, below) {
  var r, x, half = rows >> 1;
  for (r = 0; r < rows; r++) {
    var f = (r + 1) / (rows + 1) * 16;
    for (x = 0; x < W; x++) {
      var takeBelow = lightningBayer[r & 3][x & 3] < f;
      if (takeBelow !== (r >= half)) {
        g.fillStyle = takeBelow ? below : above;
        g.fillRect(x, y0 + r, 1, 1);
      }
    }
  }
}

function lightningCanvas(W, H) {
  var c = document.createElement('canvas');
  c.width = W * 2; c.height = H * 2;
  var g = c.getContext('2d');
  g.setTransform(2, 0, 0, 2, 0, 0);
  g.imageSmoothingEnabled = false;
  return { c: c, g: g };
}

// The sky (four dithered bands, step 0 dark / 1 flashed), the hazy far ridge
// and the ground, into one canvas.
function lightningBuildBack(W, H, C, step, ridgeSeed) {
  var cv = lightningCanvas(W, H), g = cv.g;
  var cols = [], i;
  for (i = 0; i < 4; i++) cols.push(lightningSkyRamp[i + step]);
  var gy = C.groundY;
  var yb = [0, Math.round(gy * 0.28), Math.round(gy * 0.56), Math.round(gy * 0.8), Math.ceil(gy)];
  for (i = 0; i < 4; i++) {
    g.fillStyle = cols[i];
    g.fillRect(0, yb[i], W, yb[i + 1] - yb[i] + 1);
  }
  for (i = 1; i < 4; i++) lightningDitherRows(g, W, yb[i] - 2, 4, cols[i - 1], cols[i]);

  // far ridge: pines in a haze of the low sky — dimmer under the dark sky,
  // lit a step in the flash
  var ridgeCol = sceneMix('#1f5330', cols[3], step ? 0.7 : 0.55);
  sceneTreeline(g, W, H, rngFrom(ridgeSeed), gy, ridgeCol, 0.5 * C.k);

  // the ground: pine at the horizon dithering down into pineDk
  g.fillStyle = '#2c6e3f';
  g.fillRect(0, gy, W, 4);
  g.fillStyle = '#1f5330';
  g.fillRect(0, gy + 4, W, H - gy - 4);
  lightningDitherRows(g, W, gy + 2, 4, '#2c6e3f', '#1f5330');
  // a still stipple on the ground, pine on pineDk (one ramp step, in the
  // quiet band): sparse near the horizon, coarser lower down
  var srng = rngFrom(ridgeSeed + 7), y2, x2;
  g.fillStyle = '#2c6e3f';
  for (y2 = gy + 7; y2 < H - 1; y2 += 3) {
    var pitch = 4 + Math.floor((y2 - gy) / 8);
    for (x2 = Math.floor(srng() * pitch); x2 < W; x2 += pitch) {
      if (srng() < 0.55) g.fillRect(x2, y2 + (srng() < 0.5 ? 0 : 1), srng() < 0.3 ? 2 : 1, 1);
    }
  }
  return cv.c;
}

// The building cloud, TWO plates on a 2-unit row grid: the SLAB — a flat-
// bottomed base, lit above, its underside darker, the join dithered — and
// the TOWERS, the cauliflower domes that climb out of it. Per frame the
// towers are drawn first, shifted down by the frame's `cut`, and the slab
// over their feet: so the cloud builds (the domes rise) while its base never
// moves, for two drawImage calls. Shades: rim (a one-row highlight on each
// dome's crown) / lit / dark. tallness > 1 (portrait) builds the domes
// taller, to use the tall sky.
function lightningBuildCloud(cw, ch, seed, tallness, sh) {
  var rng = rngFrom(seed);
  var rows = ch / 2, r, i, x;
  var slabRows = Math.max(3, Math.round(rows * 0.34));
  // --- the towers: each dome's height is tied to its half-width (a
  //     cauliflower, not spires); two tall ones, the rest sit lower ---------
  var tcv = lightningCanvas(cw, ch), g = tcv.g;
  var towers = [], n = 6;
  for (i = 0; i < n; i++) {
    var tall = i === 1 || i === 3;
    var hw = cw * (tall ? 0.15 + rng() * 0.05 : 0.09 + rng() * 0.06);
    var hgt = Math.min(rows - 1,
      Math.round(hw * tallness * (tall ? 1.3 : 0.8 + rng() * 0.4) / 2) + slabRows);
    towers.push({ cx: cw * (0.14 + (i + 0.25 + rng() * 0.5) / n * 0.72), top: rows - hgt, hw: hw });
  }
  // row by row, a half-ellipse dome standing on the canvas floor (the slab
  // hides the feet); the crown's two rows take the rim shade, and a later
  // tower's crown over an earlier tower's body reads as a lobe. Build-time.
  for (r = 0; r < rows; r++) {
    for (i = 0; i < n; i++) {
      var tw = towers[i];
      if (r < tw.top) continue;
      var u = (r - tw.top + 1) / (rows - tw.top + 1);
      var hw2 = tw.hw * Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)));
      var left = Math.max(0, Math.floor(tw.cx - hw2)), right = Math.min(cw, Math.ceil(tw.cx + hw2));
      if (right <= left) continue;
      g.fillStyle = r < tw.top + 2 ? sh.rim : sh.lit;
      g.fillRect(left, r * 2, right - left, 2);
    }
  }
  // --- the slab: lit top rows, a two-row Bayer join, the dark underside,
  //     the last row tucked in -----------------------------------------------
  var scv = lightningCanvas(cw, slabRows * 2), sg = scv.g;
  var joinRow = Math.max(1, Math.floor(slabRows * 0.4));
  for (r = 0; r < slabRows; r++) {
    var half = cw * 0.5 * (0.84 + 0.16 * r / slabRows) - (r === slabRows - 1 ? cw * 0.04 : 0);
    var l0 = Math.floor(cw * 0.5 - half), r0 = Math.ceil(cw * 0.5 + half);
    if (r === joinRow || r === joinRow + 1) {
      var f = (r - joinRow + 1) / 3 * 16;
      for (x = l0 - (l0 & 1); x < r0; x += 2) {
        sg.fillStyle = lightningBayer[r & 3][(x >> 1) & 3] < f ? sh.dark : sh.lit;
        sg.fillRect(x, r * 2, 2, 2);
      }
    } else {
      sg.fillStyle = r < joinRow ? sh.lit : sh.dark;
      sg.fillRect(l0, r * 2, r0 - l0, 2);
    }
  }
  return { top: tcv.c, slab: scv.c, slabH: slabRows * 2, rows: rows,
           maxCut: Math.floor((rows - slabRows) * 0.5) };
}

// Draw a cloud at (x, y) with its domes `cut` rows (2 units each) short of
// fully built: the tower plate slides down behind the slab.
function lightningDrawCloud(g, cl, x, y, cw, ch, cut) {
  var th = (cl.rows - cut) * 2;
  g.drawImage(cl.top, 0, 0, cw * 2, th * 2, x, y + cut * 2, cw, th);
  g.drawImage(cl.slab, x, y + ch - cl.slabH, cw, cl.slabH);
}

// The tree, the shards and the fallen limb: everything still in front of the
// sky, on a transparent canvas.
function lightningBuildFront(W, H, C, seed) {
  var cv = lightningCanvas(W, H), g = cv.g;
  var rng = rngFrom(seed);
  var vx = C.vx, splitY = C.splitY, gy = C.groundY, k = C.k;
  var r, i, d, x;

  // shared trunk below the split, 2-step bark dither
  var rows = Math.ceil(gy + 3 * k - splitY);
  var barkLines = [0.42, 0.58, 0.74];
  for (r = 0; r < rows; r++) {
    var y = splitY + r;
    var frac = Math.min(1, r / (gy - splitY));
    var tw = lightningSnap(8 + frac * frac * W * 0.3);
    var x0 = lightningSnap(vx - tw / 2);
    g.fillStyle = '#5d4632';
    g.fillRect(x0, y, tw, 1);
    // shadow side, dithered edge
    var sw = Math.floor(tw * 0.3);
    g.fillStyle = '#463526';
    g.fillRect(x0, y, sw, 1);
    for (i = 0; i < 3; i++) {
      x = Math.floor(x0) + sw + i;
      if (lightningBayer[r & 3][x & 3] < (3 - i) * 4) g.fillRect(x, y, 1, 1);
    }
    // bark: broken lines following the taper
    for (i = 0; i < 3; i++) {
      if ((r + i * 2) % 3 === 0) continue;
      g.fillRect(Math.floor(x0 + tw * barkLines[i]), y, 1, 1);
    }
    // lit edge
    if (lightningBayer[r & 3][(Math.floor(x0 + tw)) & 3] < 8) {
      g.fillStyle = '#7a5c42';
      g.fillRect(x0 + tw - 1, y, 1, 1);
    }
  }
  // the char scar, spiralling down the living side of the trunk
  for (r = 0; r < rows; r += 2) {
    var frac2 = Math.min(1, r / (gy - splitY));
    var sw2 = (8 + frac2 * frac2 * W * 0.3) * 0.22;
    var sx = lightningSnap(vx + Math.sin(frac2 * 5) * sw2 * 1.6 - sw2 / 2);
    g.fillStyle = '#2b241c';
    g.fillRect(sx + lightningSnap(sw2) - 1, splitY + r, 1.5, 2);
    g.fillStyle = '#16120e';
    g.fillRect(sx, splitY + r, lightningSnap(sw2), 2);
  }
  // DEAD half: charred spar, leaning out left, bare
  for (d = 0; d < 1; d += 0.02) {
    var dx2 = lightningSnap(vx - d * W * 0.22), dy2 = lightningSnap(splitY - d * H * 0.42);
    g.fillStyle = d % 0.08 < 0.04 ? '#16120e' : '#2b241c';
    g.fillRect(lightningSnap(dx2 - 3 + d * 2), dy2, lightningSnap(6 - d * 4), 3);
  }
  // burnt branch stubs
  for (i = 0; i < 5; i++) {
    var bd = 0.18 + i * 0.17;
    var bx2 = lightningSnap(vx - bd * W * 0.22), by2 = lightningSnap(splitY - bd * H * 0.42);
    g.fillStyle = '#16120e';
    g.fillRect(bx2 - 6 * k, by2, 6 * k + 1, 1);
    if (i & 1) g.fillRect(bx2 + 1, by2 - 1, 3 * k, 1);
  }
  // LIVING half: leaning right, wood only — the tufts move, so they are
  // painted per frame
  for (d = 0; d < 1; d += 0.02) {
    var lx2 = lightningSnap(vx + d * W * 0.16), ly3 = lightningSnap(splitY - d * H * 0.4);
    var lw = lightningSnap(5 - d * 3);
    g.fillStyle = '#5d4632';
    g.fillRect(lightningSnap(lx2 - 2 + d), ly3, lw, 3);
    g.fillStyle = '#463526';
    g.fillRect(lightningSnap(lx2 - 2 + d), ly3 + 2, lw, 1);
  }
  // bough stubs on the living half
  for (i = 0; i < C.boughs.length; i++) {
    var b = C.boughs[i];
    g.fillStyle = '#463526';
    g.fillRect(Math.min(b.x, b.ex), b.y, Math.abs(b.ex - b.x) + 1, 1);
    g.fillRect(Math.min(b.x, b.ex) + (b.ex > b.x ? 1 : 0), b.y + 1, Math.abs(b.ex - b.x), 1);
  }
  // the shed black shards still lying where they fell
  for (i = 0; i < 6; i++) {
    g.fillStyle = '#16120e';
    g.fillRect(lightningSnap(W * (0.2 + rng() * 0.6)), gy + 1 + Math.floor(rng() * (H - gy - 6)),
      lightningSnap(4 + rng() * 5), 1);
  }
  // a fallen charred limb across the bottom-left corner: the foreground frame
  var L = Math.round(W * 0.34);
  for (x = 0; x <= L; x++) {
    var u = x / L;
    var th = Math.round((11 - u * 6) * k);
    var top = H - 2 - Math.round(u * 9 * k) - th;
    g.fillStyle = '#463526';
    g.fillRect(x, top, 1, 1);
    g.fillStyle = '#2b241c';
    g.fillRect(x, top + 1, 1, Math.ceil(th * 0.55) - 1);
    g.fillStyle = '#16120e';
    g.fillRect(x, top + Math.ceil(th * 0.55), 1, th - Math.ceil(th * 0.55));
    if ((x + 2) % 6 === 0 && u < 0.9) g.fillRect(x, top, 1, 2);
  }
  g.fillStyle = '#16120e';
  var s1 = Math.round(L * 0.3), s2 = Math.round(L * 0.68);
  g.fillRect(s1, H - 2 - Math.round(0.3 * 9 * k) - Math.round((11 - 1.8) * k) - 5 * k, 2, 5 * k);
  g.fillRect(s2, H - 2 - Math.round(0.68 * 9 * k) - Math.round((11 - 4.1) * k) - 4 * k, 1, 4 * k);
  return cv.c;
}

function lightningBuild(W, H, seed) {
  var m = Math.min(W, H), k = m / 135, portrait = H > W;
  var C = { W: W, H: H, k: k, vx: W * 0.5, splitY: Math.round(H * 0.5), groundY: lightningSnap(H * 0.86) };
  var i;
  // bough points along the living spar: outer tufts right (long), a few
  // short ones back toward the fork
  C.boughs = [];
  for (i = 0; i < 10; i++) {
    var d = 0.2 + i * 0.08;
    var right = true;                                   // the leeward side: all boughs reach right
    var len = Math.round((4 + 5 * (1 - d)) * k);
    var x = lightningSnap(C.vx + d * W * 0.16 + 1), y = lightningSnap(C.splitY - d * H * 0.4);
    // every third tuft is a short one, every third-plus-one rides a row
    // higher: the boughs are a pine's, not a comb's
    C.boughs.push({
      x: x, y: y, ex: x + len, right: right,
      w: Math.round((8 + 5 * (1 - d)) * k * (i % 3 === 2 ? 0.6 : 1)),
      lift: i % 3 === 1 ? 1 : 0,
      inner: i > 0 && (i & 1) === 1,
    });
  }
  C.back = lightningBuildBack(W, H, C, 0, seed + 11);
  C.backFlash = lightningBuildBack(W, H, C, 1, seed + 11);
  C.front = lightningBuildFront(W, H, C, seed + 23);
  // the building cloud: bigger in the tall portrait sky
  var tallness = portrait ? 2 : 1;
  C.cw = Math.round(W * (portrait ? 0.8 : 0.62));
  C.ch = 2 * Math.round(C.cw * 0.3 * tallness / 2);
  C.cloudY = lightningSnap(C.groundY * (portrait ? 0.08 : 0.04));
  C.cloud = lightningBuildCloud(C.cw, C.ch, seed + 37, tallness, lightningCloudShades);
  C.cloudFlash = lightningBuildCloud(C.cw, C.ch, seed + 37, tallness, lightningCloudFlash);
  // the far cloud: a small one of the same make, cut from the sky ramp, on
  // the right and lower — the parallax layer behind the near cloud
  C.fcw = Math.round(W * 0.3);
  C.fch = 2 * Math.round(C.fcw * 0.24 / 2);
  C.farY = lightningSnap(C.groundY * (portrait ? 0.34 : 0.26));
  C.far = lightningBuildCloud(C.fcw, C.fch, seed + 43, 1, lightningFarShades);
  C.farFlash = lightningBuildCloud(C.fcw, C.fch, seed + 43, 1, lightningFarFlash);
  // the band below which nothing moves between the sky and the tree: there
  // the sky and tree are blitted as one composite
  C.farY2 = portrait ? lightningSnap(C.groundY * 0.6) : 0;
  C.bandB = Math.ceil(Math.max(C.cloudY + C.ch, C.farY + C.fch, C.farY2 + C.fch));
  var st = lightningCanvas(W, H);
  st.g.drawImage(C.back, 0, 0, W, H);
  st.g.drawImage(C.front, 0, 0, W, H);
  C.composite = st.c;
  // grass tufts along the horizon
  var rng = rngFrom(seed + 41), n = Math.round(W / 12);
  C.grass = [];
  for (i = 0; i < n; i++) {
    C.grass.push({ x: Math.floor(rng() * W), h: 2 + Math.floor(rng() * 2.5), ph: rng() < 0.5 });
  }
  // sheet lightning schedule: eight gaps of 12–20 s, cycled
  var srng = rngFrom(seed + 53);
  C.flashAt = []; var acc = 0;
  for (i = 0; i < 8; i++) { acc += 12 + srng() * 8; C.flashAt.push(acc); }
  C.flashCycle = acc;
  // raven perch: the dead spar's tip
  C.tipX = lightningSnap(C.vx - 0.98 * W * 0.22 - 2);
  C.tipY = lightningSnap(C.splitY - 0.98 * H * 0.42);
  return C;
}

var SCENE_PAINTERS = {
  // --- aurora — v0.9.1 pass 7 retake (variant B); helpers and header above SCENE_PAINTERS
  aurora: function (g, W, H, t, rnd) {
    var RES2 = 2;                                   // texels per art unit
    var BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    var RAMPS = [
      ['#1f5330', '#2c6e3f', '#3f8a52', '#69c977', '#f2f2e8'],   // green
      ['#17435f', '#2b6b8f', '#3f83a8', '#9fd8d0', '#f2f2e8'],   // teal
      ['#3b4f9a', '#5a5cae', '#7a6ab8', '#b08cc4', '#e8b4c8'],   // violet
    ];
    var SKY = ['#04040f', '#070a1a', '#0a1024', '#101830'];
    var LAKE = '#0b1626';
    var mn = Math.min(W, H), sc = mn / 135;
    var portrait = H > W;
    var treeBase = Math.round(H * 0.86);
    var ROW = 2;                                    // one ray row = 2 units = 4 texels
    var C = auroraBCache;
    var key = W + 'x' + H;
    var c, x, y, r, i;

    // --- build the caches once per viewport -----------------------------------
    if (C.key !== key) {
      C.key = key;
      var mk = function (w, h) {
        var cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        return cv;
      };

      // sky: four navy bands, each edge dithered over 4 units with Bayer 4x4
      var sky = mk(W * RES2, H * RES2), sg = sky.getContext('2d');
      sg.setTransform(RES2, 0, 0, RES2, 0, 0);
      var edges = [Math.round(H * 0.32), Math.round(H * 0.58), Math.round(H * 0.78)];
      sg.fillStyle = SKY[0]; sg.fillRect(0, 0, W, H);
      for (i = 0; i < 3; i++) {
        sg.fillStyle = SKY[i + 1];
        sg.fillRect(0, edges[i] + 2, W, H - edges[i] - 2);
        // transition rows edges[i]-2 .. edges[i]+1: the lower band's colour
        // bleeds upward through the threshold, 1-unit cells
        for (r = 0; r < 4; r++) {
          var yy = edges[i] - 2 + r, thr = (r + 1) * 3.2;
          for (x = 0; x < W; x++) {
            if (BAYER[yy & 3][x & 3] < thr) sg.fillRect(x, yy, 1, 1);
          }
        }
      }
      C.sky = sky;

      // ray textures per curtain: column = (bayerX * 2 + type) * 8 + phase,
      // 1 unit wide, TOP-anchored: row 0 is the hem (solid, the brightest
      // edge), and the ray both darkens (ramp cap) and thins (Bayer density)
      // with depth, so wherever the breathing cuts it off the end is already
      // sparse. The ramp runs as an 8-row PULSE 0-1-2-3-4-3-2-1 (one white
      // row per pulse, not one per five) and scrolls up by phase.
      var CYC = [0, 1, 2, 3, 4, 3, 2, 1];
      var maxRows = Math.ceil(H * 0.62 / ROW) + 2;
      C.maxRows = maxRows;
      C.body = [];
      for (c = 0; c < 3; c++) {
        var ramp = RAMPS[c];
        var body = mk(64 * RES2, maxRows * ROW * RES2), bg = body.getContext('2d');
        bg.setTransform(RES2, 0, 0, RES2, 0, 0);
        var bx, type, p, col, idx;
        for (bx = 0; bx < 4; bx++) {
          for (type = 0; type < 2; type++) {
            for (p = 0; p < 8; p++) {
              col = (bx * 2 + type) * 8 + p;
              for (r = 0; r < maxRows; r++) {
                idx = CYC[(r + p) % 8];
                var thr;
                if (type === 1) {
                  // bright ray: full pulse in the hem, capped darker with depth
                  var capv = r < 5 ? 4 : r < 9 ? 3 : r < 13 ? 2 : 1;
                  if (idx > capv) idx = capv;
                  thr = r < 5 ? 16 : r < 9 ? 12 : r < 13 ? 8 : 5;
                } else {
                  // veil: the hem carries the pulse without its white row,
                  // below it only the two lowest steps, thinning fast
                  if (r < 2) { if (idx > 3) idx = 3; thr = 16; }
                  else { idx = idx < 2 ? idx : 0; thr = r < 6 ? 9 : 4; }
                }
                bg.fillStyle = ramp[idx];
                var ty = r * ROW;
                if (thr >= 16) { bg.fillRect(col, ty, 1, ROW); continue; }
                for (i = 0; i < ROW; i++) {
                  if (BAYER[(ty + i) & 3][bx] < thr) bg.fillRect(col, ty + i, 1, 1);
                }
              }
            }
          }
        }
        C.body.push(body);
      }

      // per-column ray tables, from a fixed rng so the cache is seed-free
      var rr = rngFrom(1701);
      C.cols = [];
      for (c = 0; c < 3; c++) {
        var tab = { ph: [], bright: [], bp: [], bw: [] };
        var jit = Math.floor(rr() * 3);
        for (x = 0; x < W; x++) {
          // phase runs in 4-unit steps so the scrolling bands lean like real
          // rays; an occasional kick breaks the diagonal
          tab.ph.push((Math.floor(x / 4) * 3 + (rr() < 0.15 ? 1 : 0)) % 8);
          // bright rays come in 2-unit pairs, two of every five columns
          tab.bright.push((x + jit) % 5 < 2 && rr() < 0.9 ? 1 : 0);
          tab.bp.push(rr() * Math.PI * 2);
          tab.bw.push(Math.PI * 2 / (3 + rr() * 2));   // 3–5 s breathing
        }
        C.cols.push(tab);
      }

      // foreground, two variants: treeline + lake + reflection + pine crowns
      var fgs = [], v;
      for (v = 0; v < 2; v++) {
        var fg = mk(W * RES2, H * RES2), fgg = fg.getContext('2d');
        fgg.setTransform(RES2, 0, 0, RES2, 0, 0);
        sceneTreeline(fgg, W, H, rngFrom(7), treeBase);
        // the lake: still, from the treeline's foot to the bottom edge
        var lakeY = treeBase + 1;
        fgg.fillStyle = LAKE;
        fgg.fillRect(0, lakeY, W, H - lakeY);
        // reflection: 3x1 dashes on a 4x2 lattice, each curtain's lowest two
        // steps mirrored (violet nearest the shore, green nearest the viewer),
        // thinning away from the shore; the variant shifts the threshold rows
        var lakeRows = Math.floor((H - lakeY) / 2);
        var lr = rngFrom(9001 + v);
        for (r = 0; r < lakeRows; r++) {
          var band = r / Math.max(1, lakeRows);
          var rc = band < 0.34 ? 2 : band < 0.67 ? 1 : 0;
          var dens = 6 - Math.floor(band * 5);               // 6/16 at the shore -> 1/16
          for (x = 0; x < W; x += 4) {
            var bv = BAYER[(r + v * 2) & 3][(x >> 2) & 3];
            var roll = lr();
            if (bv >= dens || roll < 0.35) continue;        // ragged, not a lattice
            fgg.fillStyle = RAMPS[rc][roll > 0.9 ? 1 : 0];
            fgg.fillRect(x + ((r + v) & 1), lakeY + r * 2 + 1, roll > 0.6 ? 3 : 2, 1);
          }
        }
        // pine crowns rising from the bottom corners: taller in portrait
        // taller in portrait (the slack goes to the frame), never past 45% of H
        var crownH = Math.round(Math.min(mn * (portrait ? 1.0 : 0.55), H * 0.45));
        var crownW = Math.round(mn * 0.5);
        var cr = rngFrom(4242);
        fgg.fillStyle = '#030704';
        for (i = 0; i < 2; i++) {
          var cx = i === 0 ? Math.round(crownW * 0.12) : W - Math.round(crownW * 0.12);
          var top0 = H - crownH;
          for (y = top0; y < H; y += 2) {
            var s = (y - top0) / crownH;
            var half = crownW * (0.08 + 0.92 * Math.pow(s, 1.6)) * 0.5;
            var jag = Math.floor(cr() * 3) * 2 - 2;          // -2, 0, +2 units
            if (((y - top0) >> 1) & 1) jag -= 3;              // alternate rows tuck in
            half = Math.max(2, Math.round(half + jag));
            fgg.fillRect(cx - half, y, half * 2, 2);
          }
          // a few bough tips reaching inward, 1 unit, stepped
          var k;
          for (k = 0; k < 6; k++) {
            var ty2 = top0 + Math.round(cr() * crownH * 0.8 / 2) * 2;
            var s2 = (ty2 - top0) / crownH;
            var reach = Math.round(crownW * (0.08 + 0.92 * Math.pow(s2, 1.6)) * 0.5 + 4 + cr() * 6);
            var dir = i === 0 ? 1 : -1;
            fgg.fillRect(cx + (dir > 0 ? 0 : -reach), ty2, reach, 1);
            fgg.fillRect(cx + dir * (reach - 3) - (dir > 0 ? 0 : 2), ty2 - 1, 2, 1);
          }
        }
        fgs.push(fg);
      }
      C.fg = fgs;
    }

    // --- sky -------------------------------------------------------------------
    g.drawImage(C.sky, 0, 0, W, H);

    // --- stars: three brightnesses, bright ones twinkle by phase ---------------
    // (rnd consumption: x, y, b per star, as sceneStars rolls them)
    var starMaxY = treeBase - 24 * sc;
    var STAR = ['#6a7290', '#b8c0d8', '#f2f2e8'];
    var tw = Math.floor(t * 2);
    for (i = 0; i < 160; i++) {
      var sx = Math.floor(rnd() * W * 2) / 2, sy = Math.floor(rnd() * starMaxY * 2) / 2;
      var b = rnd();
      var lvl = b > 0.85 ? 2 : b > 0.5 ? 1 : 0;
      if (lvl > 0 && ((tw + i * 7) % 4) === 0) lvl -= 1;   // a dip every 2 s, own phase
      g.fillStyle = STAR[lvl];
      g.fillRect(sx, sy, 0.5, 0.5);
      if (b > 0.96 && lvl === 2) { g.fillRect(sx - 0.5, sy, 0.5, 0.5); g.fillRect(sx + 0.5, sy, 0.5, 0.5); }
    }

    // --- a satellite crossing the top of the sky, whole texels, 45 s -----------
    var satU = (t / 45) % 1;
    var satX = Math.floor((satU * (W + 12) - 6) * 2) / 2;
    var satY = Math.floor((H * 0.05 + Math.sin(satU * Math.PI) * 4 * sc) * 2) / 2;
    g.fillStyle = '#b8c0d8';
    g.fillRect(satX, satY, 0.5, 0.5);

    // --- the curtains: violet (back, lowest), teal, green (front, highest) ------
    var ORDER = [2, 1, 0];
    var PERIOD = [0.35, 0.45, 0.6];
    var DRIFT = [18, 26, 40];
    var baseY = [0.10, 0.19, 0.28];
    var foldX = ((t / 30) % 1) * (W + 40) - 20;
    var o;
    for (o = 0; o < 3; o++) {
      c = ORDER[o];
      var tab2 = C.cols[c], body2 = C.body[c];
      var k2 = Math.floor(t / PERIOD[c]);
      var w1 = Math.PI * 2 / DRIFT[c], w2 = Math.PI * 2 / (DRIFT[c] * 1.7);
      var d1 = c * 2.1, d2 = c * 0.9 + 1.3;
      var len0 = H * (portrait ? 0.22 : 0.26);
      var amp1 = 5 * sc, amp2 = 8 * sc;
      for (x = 0; x < W; x++) {
        var ph1 = x * 0.05 * (135 / mn) + t * w1 + d1;
        var ph2 = x * 0.019 * (135 / mn) - t * w2 + d2;
        var top = H * baseY[c] + Math.sin(ph1) * amp1 + Math.sin(ph2) * amp2;
        var breath = 1 + 0.22 * Math.sin(t * tab2.bw[x] + tab2.bp[x]);
        var bright = tab2.bright[x];
        var len = len0 * breath * (bright ? 1 : 0.45);
        if (c === 1) {
          // the fold: a bright curl travelling along the teal curtain
          var fd = Math.abs(x - foldX);
          if (fd < 12) {
            var fw = 1 - fd / 12;
            bright = 1;
            len += len0 * 0.5 * fw;
            top += 5 * sc * fw * fw;
          }
        }
        var rows = Math.max(3, Math.round(len / ROW));
        if (rows > C.maxRows) rows = C.maxRows;
        var topI = Math.round(top);
        var pc = ((tab2.ph[x] - k2) % 8 + 8) % 8;
        var colB = ((x & 3) * 2 + bright) * 8 + pc;
        g.drawImage(body2, colB * RES2, 0, RES2, rows * ROW * RES2, x, topI, 1, rows * ROW);
      }
    }

    // --- foreground: treeline, lake with its rolling reflection, pine crowns ----
    g.drawImage(C.fg[Math.floor(t / 4) & 1], 0, 0, W, H);
  },

  // --- meteors — v0.9.1 pass 7 retake (variant A); helpers and header above SCENE_PAINTERS
  meteors: function (g, W, H, t, rnd) {
    var i, k, m;

    // --- the rnd stream, in the baseline's order (idiom §8) ---
    for (i = 0; i < 2000; i++) rnd();               // the old Milky Way's 500 x 4 draws
    var stars = [], nStars = 220, maxY = H * 0.85;
    for (i = 0; i < nStars; i++) {                   // sceneStars' x, y, b — snapped to texels
      stars.push(Math.floor(rnd() * W * 2) / 2, Math.floor(rnd() * maxY * 2) / 2, rnd());
    }

    var C = meteorsCache;
    var key = W + 'x' + H + ':' + stars[0] + ',' + stars[1] + ',' + stars[2];
    if (C.key !== key) {
      meteorsBuildSky(C, W, H, stars);
      meteorsBuildFg(C, W, H);
      C.key = key;
    }

    var FW = W * 2, FH = H * 2;
    var qy = H - (H > W ? 60 : 48);                  // the quiet band starts here

    // --- slow: the far layer (sky, Milky Way, dim stars), one texel left every
    // 12 s, wrapped; the near stars step every 6 s ---
    var offD = (Math.floor(t / 12) * 0.5) % W;
    var offB = (Math.floor(t / 6) * 0.5) % W;
    if (offD === 0) {
      g.drawImage(C.sky, 0, 0, W, H);
    } else {
      var oT = offD * 2;
      g.drawImage(C.sky, oT, 0, FW - oT, FH, 0, 0, W - offD, H);
      g.drawImage(C.sky, 0, 0, oT, FH, W - offD, 0, offD, H);
    }

    // --- medium: mid and bright stars, drifting every 6 s, twinkling by ramp step ---
    for (i = 0; i < nStars; i++) {
      var b = stars[i * 3 + 2];
      if (b <= 0.5) continue;
      var ox = stars[i * 3], y = stars[i * 3 + 1];
      var x = ox - offB;
      if (x < 0) x += W;
      var bright = b > 0.85;
      var ci;
      var hsh = ((ox * 62 + y * 34) % 97) / 97;      // per-star period and phase, from its texel
      var phase = ((ox * 14 + y * 6) % 13) / 13;
      if (y >= qy) {
        ci = bright ? 1 : 0;                         // quiet band: still, no higher than mid
      } else {
        var P = bright ? 1.5 + hsh * 1.5 : 2 + hsh * 2;
        var step = Math.floor((t / P + phase) * 6) % 6;
        ci = bright ? meteorsSeqBright[step] : meteorsSeqMid[step];
      }
      g.fillStyle = meteorsRamp[ci];
      g.fillRect(x, y, 0.5, 0.5);
      if (b > 0.96 && ci === 2 && ((Math.floor(t / 0.4 + phase * 5)) & 1) === 0) {
        g.fillRect(x - 0.5, y, 0.5, 0.5);
        g.fillRect(x + 0.5, y, 0.5, 0.5);
      }
    }

    // --- slow: a satellite, one texel at a time across the top of the sky ---
    var satPeriod = W / 4 + 20, sp = (t % satPeriod) - 1;
    if (sp >= 0) {
      var satX = Math.floor(sp * 4 * 2) / 2 - 2;
      if (satX < W) {
        var satY = Math.floor((H * 0.07 + satX * 0.05) * 2) / 2;
        g.fillStyle = meteorsRamp[1];
        g.fillRect(satX, satY, 1, 1);
      }
    }

    // --- fast: the shower, on the seed's schedule (5 rnd per meteor, as before);
    // the 40-meteor schedule wraps at 36 s so a long look never runs dry ---
    var tt = t % 36;
    for (m = 0; m < 40; m++) {
      var start = m * 0.9 + rnd() * 0.8;
      var x0 = rnd() * W, y0 = rnd() * H * 0.5;
      var ang = 2.2 + rnd() * 0.5;
      var speed = 90 + rnd() * 60;
      var age = tt - start;
      if (age < 0) continue;
      var bol = (m % 12 === 5);
      var life = bol ? 1.0 : 0.55 + ((y0 * 10) % 1) * 0.25;
      var cx = Math.cos(ang), cy = Math.sin(ang);
      var xMajor = Math.abs(cx) >= Math.abs(cy);
      var maj = xMajor ? Math.abs(cx) : Math.abs(cy);
      var px, py;

      if (age <= life) {
        var cell = bol ? 1 : 0.5;
        var hx = Math.floor((x0 + cx * speed * age) / cell) * cell;
        var hy = Math.floor((y0 + cy * speed * age) / cell) * cell;
        var L = Math.min(bol ? 30 : 15, (2 + age * speed * 0.3) * (bol ? 2 : 1));
        var fs = age / life < 0.6 ? 0 : age / life < 0.85 ? 1 : 2;   // ramp shift with age
        var N = Math.floor(L * maj / cell);
        for (k = 1; k <= N; k++) {
          var along = k * cell / maj;
          px = Math.floor((hx - cx * along) / cell) * cell;
          py = Math.floor((hy - cy * along) / cell) * cell;
          if (py >= qy || py < 0 || px < 0 || px >= W) continue;
          var f = k / N;
          var near = f < 0.35;
          ci = (near ? 1 : 0) - fs;
          if (f > 0.7 && (k & 1)) continue;                  // the tail's last third is dithered
          if (ci < 0) { if (ci === -1 && (k & 1) === 0) ci = 0; else continue; }
          g.fillStyle = meteorsRamp[ci];
          // the bright third of a normal streak is 2 texels thick so it reads at phone size
          if (near && !bol) g.fillRect(Math.floor(px), Math.floor(py), 1, 1);
          else g.fillRect(px, py, cell, cell);
        }
        var hci = 2 - fs;
        if (hci >= 0 && hy < qy && hy >= 0) {
          if (bol) {
            if (hci > 0) { g.fillStyle = meteorsRamp[hci - 1]; g.fillRect(hx - 0.5, hy - 0.5, 3, 3); }
            g.fillStyle = meteorsRamp[hci];
            g.fillRect(hx, hy, 2, 2);
          } else {
            g.fillStyle = meteorsRamp[hci];
            g.fillRect(hx, hy, 1, 1);
          }
        }
      } else if (bol && age < life + 1.5) {
        // persistent train: the dimmest grey along the whole path, every 2nd
        // texel for 0.75 s, every 4th for the next 0.75 s, then gone
        var every = age - life < 0.75 ? 2 : 4;
        var NT = Math.floor(speed * life * maj / 0.5);
        g.fillStyle = meteorsRamp[0];
        for (k = 0; k <= NT; k += every) {
          var al2 = k * 0.5 / maj;
          px = Math.floor((x0 + cx * al2) * 2) / 2;
          py = Math.floor((y0 + cy * al2) * 2) / 2;
          if (py >= qy || py < 0 || px < 0 || px >= W) continue;
          g.fillRect(px, py, 0.5, 0.5);
        }
      }
    }

    // --- the frame: pine crown top-right, hull and treeline below, both still ---
    g.drawImage(C.fg, C.pineX * 2, 0, (W - C.pineX) * 2, C.pineH * 2, C.pineX, 0, W - C.pineX, C.pineH);
    g.drawImage(C.fg, 0, C.fgTop * 2, FW, (H - C.fgTop) * 2, 0, C.fgTop, W, H - C.fgTop);
  },

  // --- moonrise — v0.9.1 pass 7 retake (variant B); helpers and header above SCENE_PAINTERS
  moonrise: function (g, W, H, t, rnd) {
    var c = moonriseBuild(W, H);
    var horizon = c.horizon, r = c.r, m = c.m;
    var i, j, k, x, y;

    // sky bands (cached), then the stars in the baseline's rnd order
    g.drawImage(c.sky, 0, 0, W, c.sky.height / 2);
    sceneStars(g, W, H, rnd, 120, H * 0.6);
    if (H > W) sceneStars(g, W, H, rngFrom(77), 50, horizon - r * 2.5);   // portrait: the extra sky is not empty
    var tick = Math.floor(t / 0.5);
    for (i = 0; i < c.twinkle.length; i++) {
      var ph = (tick + i * 3) % 4;
      g.fillStyle = ph === 0 ? '#f2f2e8' : ph === 2 ? '#6a7290' : '#b8c0d8';
      g.fillRect(c.twinkle[i][0], c.twinkle[i][1], 0.5, 0.5);
      if (ph === 0) { g.fillRect(c.twinkle[i][0] - 0.5, c.twinkle[i][1], 0.5, 0.5); g.fillRect(c.twinkle[i][0] + 0.5, c.twinkle[i][1], 0.5, 0.5); }
    }

    // high cloud, the far layer: one texel right every 3 s (the mist, nearer, every 2 s)
    if (c.cloudY > 4) {
      var cdrift = (Math.floor(t / 3) * 0.5) % c.cloudP;
      g.drawImage(c.cloud, cdrift - c.cloudP, c.cloudY, c.cloud.width / 2, c.cloud.height / 2);
    }

    // the moon: the 4 s reveal from behind the treeline, then a texel every 8 s
    var mx = Math.round(W * 0.6 * 2) / 2;
    var lift = Math.min(H * 0.16, r * 1.45);
    var rise = r * 0.81;
    var my = horizon - lift + Math.max(0, 4 - t) / 4 * rise;
    if (t > 4) my -= Math.floor((t - 4) / 8) * 0.5;
    my = Math.round(my * 2) / 2;
    g.drawImage(c.moon, mx - c.R - 0.5, my - c.R - 0.5, c.moon.width / 2, c.moon.height / 2);

    // the far shore (its base fill is covered by the water next)
    sceneTreeline(g, W, H, rngFrom(23), horizon, '#081018');
    g.drawImage(c.wat, 0, c.watY0, W, c.wat.height / 2);

    // mist over the treeline's feet, drifting right one texel per 2 s
    var drift = (Math.floor(t / 2) * 0.5) % c.mistP;
    g.drawImage(c.mist, drift - c.mistP, Math.round(horizon) - 1, c.mist.width / 2, 3);

    // the moon path: 2-unit rows of dashes, ramp index scrolling down the column
    var SHIM = c.SHIM, step = Math.floor(t / 0.3);
    var y0 = Math.round(horizon) + 2;
    k = 0;
    for (y = y0; y < H - 1; y += 2, k++) {
      var dy = y - horizon;
      var w = r * 0.6 + dy * 0.28;
      var pitch = 3 + dy * 0.04;
      var wob = Math.round(Math.sin(y * 0.9 + t * 2.856)) * 0.5;
      var quiet = y >= c.quietY;
      var idx = ((step - k) % 5 + 5) % 5;
      if (quiet) idx = idx % 3;                    // the quiet band: never above the ramp's middle
      var n = Math.floor(w / 2 / pitch) + 1;
      var off = (k & 1) ? pitch / 2 : 0;
      for (j = -n; j <= n; j++) {
        var dx = j * pitch + off;
        if (Math.abs(dx) > w / 2) continue;
        var edge = Math.abs(dx) > w / 2 - pitch;
        g.fillStyle = SHIM[edge ? Math.max(0, idx - 1) : idx];
        g.fillRect(Math.round((mx + dx + wob) * 2) / 2 - 0.5, y, 1.5, 1);
      }
    }
    // the glint: one texel at the bright path's near end, flickering every 0.5 s
    var glintY = Math.round(c.quietY) - 3;
    if (glintY > y0 + 2 && (tick & 1) === 0) {
      g.fillStyle = '#f2f2e8';
      g.fillRect(mx + Math.round(Math.sin(t * 2.856)) * 0.5, glintY, 0.5, 0.5);
    }

    // a loon crossing the path, one texel per 0.4 s, once every 40 s
    var lp = t % 40;
    if (lp < 22) {
      var ls = Math.min(1.6, Math.max(1.1, m / 120));
      var loonY = Math.round(horizon) + 4;
      var deep = c.quietY - 6 - loonY;
      if (deep > 0) loonY += Math.round(Math.min(deep, (H - horizon) * 0.25));
      var lx = Math.round((mx - 15 * ls) * 2) / 2 + Math.floor(lp / 0.4) * 0.5;
      g.fillStyle = '#081018';
      g.fillRect(lx, loonY, 5 * ls, 1.5);                       // body
      g.fillRect(lx + 4 * ls, loonY - 2, 1, 2.5);               // neck
      g.fillRect(lx + 3.5 * ls, loonY - 3, 2.5, 1);             // head
      g.fillRect(lx + 6 * ls, loonY - 2.5, 1.5, 0.5);           // bill
      g.fillStyle = '#6a7290';                                  // the loon's collar, one dim texel
      g.fillRect(lx + 4 * ls, loonY - 1, 1, 0.5);
      g.fillStyle = SHIM[0];
      g.fillRect(lx + 1, loonY + 2, 3 * ls, 0.5);               // its still reflection
    }

    // the frame: reeds bottom-left, the boulder bottom-right — black and still
    g.fillStyle = '#081018';
    for (i = 0; i < c.reeds.length; i++) {
      var rd = c.reeds[i];
      var segs = Math.ceil(rd.h / 4);
      for (k = 0; k < segs; k++) {
        g.fillRect(rd.x + (k >> 1) * rd.lean, c.shoreY - (k + 1) * 4, 1, 4);
      }
      var tx = rd.x + (segs >> 1) * rd.lean, ty = c.shoreY - segs * 4;
      if (rd.head) g.fillRect(tx - 0.5, ty - 6, 2, 6);       // the cattail's head
      else g.fillRect(tx + rd.lean, ty - 3, 1, 3);           // or a bare tip
      if (rd.blade) {                                        // a blade leaning off the stem, 3 steps
        var bx = rd.x + ((rd.blade >> 2) >> 1) * rd.lean, by2 = c.shoreY - rd.blade;
        for (k = 0; k < 3; k++) {
          g.fillRect(bx + (rd.bside > 0 ? (k + 1) * 1.5 : -(k + 1) * 1.5 - 0.5), by2 - k * 2 - 2, 1.5, 2.5);
        }
      }
    }
    g.fillRect(0, c.shoreY, W * 0.3, 1);                       // the reed bed's dark waterline
    for (i = 0; i < c.rockRows.length; i++) {
      var rr = c.rockRows[i];
      g.fillRect(rr[0], rr[1], rr[2], 1);
    }
    g.fillStyle = c.rockRim;                                    // moonlit lip: rockDk mixed to black
    var top = c.rockRows.length - 1;
    g.fillRect(c.rockRows[top][0], c.rockRows[top][1], c.rockRows[top][2], 0.5);
    for (i = top - 1; i >= top - 6 && i >= 0; i--) {
      g.fillRect(c.rockRows[i][0], c.rockRows[i][1], (c.rockRows[i + 1][0] - c.rockRows[i][0]) + 0.5, 0.5);
    }
  },

  // --- starsCamp — v0.9.1 pass 7 retake (variant A); helpers and header above SCENE_PAINTERS
  starsCamp: function (g, W, H, t, rnd) {
    var RES2 = 2;
    var BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    var STAR = ['#6a7290', '#b8c0d8', '#f2f2e8'];
    var FIRE = ['#8c3a1d', '#e8842a', '#f2c14b', '#f2f2e8'];
    var INK = '#010104';
    var snap = function (v) { return Math.round(v * 2) / 2; };

    // --- the bake ---------------------------------------------------------------
    function build(key) {
      var s = Math.min(W, H);
      var C = { key: key, tw: [], sparks: [] };
      var mk = function () {
        var c = document.createElement('canvas');
        c.width = W * RES2; c.height = H * RES2;
        var gc = c.getContext('2d');
        gc.imageSmoothingEnabled = false;
        gc.setTransform(RES2, 0, 0, RES2, 0, 0);
        return c;
      };
      var dim = mk(), gc = dim.getContext('2d');
      gc.setTransform(RES2, 0, 0, RES2, 0, 0);

      // sky
      gc.fillStyle = '#04040f';
      gc.fillRect(0, 0, W, H);

      // the Milky Way: a band tilted up to the right (meteors tilts the other
      // way), body in two dark ramp steps as 1-unit cells under a Bayer
      // threshold, dust in 1-texel dots; a coarse value-noise lattice gives it
      // clouds and rifts instead of an even smear
      var hw = H * 0.14, lat = [], LP = 8, lx, ly, LW = Math.ceil(W / LP) + 2, LH = Math.ceil(H / LP) + 2;
      for (ly = 0; ly < LH; ly++) for (lx = 0; lx < LW; lx++) lat.push(rnd());
      var noise = function (x, y) {
        var fx = x / LP, fy = y / LP, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
        if (ix < 0 || iy < 0 || ix >= LW - 1 || iy >= LH - 1) return 0.5;
        var a = lat[iy * LW + ix], b = lat[iy * LW + ix + 1], c = lat[(iy + 1) * LW + ix], d = lat[(iy + 1) * LW + ix + 1];
        return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
      };
      var x, y, cx, cy, dd, n, dens, th;
      for (y = 0; y < H; y++) {
        for (x = 0; x < W; x++) {
          cy = -0.4 * x + H * 0.55;
          dd = Math.abs(y - cy) / hw;
          if (dd > 1) continue;
          n = noise(x, y);
          dens = (1 - dd) * (1 - dd) * (1 - dd) * (0.3 + 1.1 * n);
          th = BAYER[y & 3][x & 3] / 16;
          if (dens > th + 0.5) gc.fillStyle = '#363c5c';
          else if (dens > th + 0.1) gc.fillStyle = '#1c2038';
          else continue;
          gc.fillRect(x, y, 1, 1);
        }
      }
      for (x = 0; x < 260; x++) {
        cx = rnd() * W;
        cy = -0.4 * cx + H * 0.55 + (rnd() + rnd() - 1) * hw * 0.9;
        n = noise(cx, cy);
        gc.fillStyle = n > 0.6 ? '#6a7290' : '#363c5c';
        gc.fillRect(snap(cx), snap(cy), 0.5, 0.5);
      }

      // a faint horizon glow over the far treeline — Bayer-dithered steps, not
      // a gradient — so the near pines have something to be black against
      var gTop = Math.round(H * 0.84 - s * 0.3), gBot = Math.round(H * 0.84) + 2, lv;
      for (y = gTop; y < gBot; y++) {
        lv = Math.pow((y - gTop) / (gBot - gTop), 1.6);
        for (x = 0; x < W; x++) {
          th = BAYER[y & 3][x & 3] / 16;
          if (lv > th + 0.55) gc.fillStyle = '#0d0f24';
          else if (lv > th) gc.fillStyle = '#08091a';
          else continue;
          gc.fillRect(x, y, 1, 1);
        }
      }
      C.glowTop = gTop;

      // fixed stars, then the twinklers (drawn per frame, not baked)
      sceneStars(gc, W, H, rnd, 220, H * 0.86);
      var i;
      for (i = 0; i < 48; i++) {
        C.tw.push({ x: snap(rnd() * W), y: snap(rnd() * H * 0.8), p: Math.floor(rnd() * 4), cross: rnd() > 0.65 });
      }

      // the far treeline: the same black band as before
      sceneTreeline(gc, W, H, rngFrom(31), H * 0.84);

      // the two nearest pines, one each corner: a trunk on the edge and boughs
      // reaching inward, sagging toward their tips, with needle tufts hanging
      // under them. Scaled by min(W,H) so a tall phone gets taller trees; the
      // reach is capped by W so the two never meet in the middle.
      var ph = s * 0.66;                          // visible height of each tree
      var tw = Math.max(3, Math.round(s * 0.05)); // trunk width
      var reach = Math.min(s * 0.38, W * 0.26);
      var NB = 6, k, boughs = [];                 // [ya, len, droop, light]
      for (k = 0; k < NB; k++) {
        var ya = Math.round(H - ph * (0.16 + 0.155 * k));
        var len = Math.round(reach * (1 - 0.12 * k) * (0.88 + rnd() * 0.24));
        boughs.push([ya, len, Math.round(len * 0.3), Math.max(0, 1 - k * 0.22), rnd() * 7]);
      }
      var trunkX = function (side) { return side < 0 ? Math.round(s * 0.03) : W - Math.round(s * 0.03) - tw; };
      // walk one bough's cells: cb(x, yb, th, d, len) for each 1-unit column,
      // yb the underside row, th the body thickness above it
      var walk = function (side, B, cb) {
        var xt = trunkX(side), d, x2, yb, th2, f;
        for (d = 0; d < B[1]; d++) {
          x2 = side < 0 ? xt + tw + d : xt - 1 - d;
          f = d / B[1];
          yb = B[0] + Math.round(B[2] * Math.pow(f, 1.4));
          th2 = 1 + Math.round(2.6 * (1 - f));
          cb(x2, yb, th2, d, B[1]);
        }
      };
      var drawPine = function (g2, side) {
        var tx = trunkX(side), top = H - ph - s * 0.22;
        g2.fillStyle = INK;
        g2.fillRect(tx, top, tw, H - top);
        g2.fillRect(tx + (side < 0 ? 0 : tw - 2), top - s * 0.08, 2, s * 0.08);   // the taper, off the top
        var q;
        for (q = 0; q < NB; q++) {
          var B = boughs[q];
          walk(side, B, function (x2, yb, th2, d) {
            g2.fillRect(x2, yb - th2 + 1, 1, th2);                 // the body
            if ((d + Math.floor(B[4])) % 3 === 1) g2.fillRect(x2, yb + 1, 1, 1 + (d & 1)); // a tuft hanging
            if ((d & 1) === 0 && d < B[1] - 2) g2.fillRect(x2, yb - th2, 1, 1);           // needles up
          });
          // the outward stub of the same bough, off the edge mostly
          var xo = side < 0 ? tx - Math.round(B[1] * 0.3) : tx + tw;
          g2.fillRect(xo, B[0] - 1, Math.round(B[1] * 0.3), 3);
        }
      };
      // firelight on the undersides: the bottom row of each bough and the tuft
      // ends, Bayer-dithered, brighter on the low boughs and toward the tips
      // (nearer the fire). `bright` is the second held step of the pulse.
      var litPine = function (g2, side, bright) {
        var q;
        for (q = 0; q < NB; q++) {
          var B = boughs[q], L = B[3];
          if (L <= 0) continue;
          var lvl = bright ? Math.min(1, 0.35 + 0.85 * L) : 0.5 * L;
          walk(side, B, function (x2, yb, th2, d, len) {
            var lv = lvl * (0.55 + 0.45 * d / len);
            var hot = bright && q === 0 && d > len * 0.45;
            g2.fillStyle = hot ? FIRE[1] : FIRE[0];
            if (BAYER[yb & 3][x2 & 3] < lv * 16) g2.fillRect(x2, yb, 1, 1);
            if ((d + Math.floor(B[4])) % 3 === 1) {
              var ty = yb + 1 + (d & 1);
              g2.fillStyle = FIRE[0];
              if (BAYER[ty & 3][x2 & 3] < lv * 16) g2.fillRect(x2, ty, 1, 1);
            }
            if (bright && lv > 0.7 && th2 > 1 && BAYER[(yb - 1) & 3][x2 & 3] < (lv - 0.6) * 16) {
              g2.fillStyle = FIRE[0]; g2.fillRect(x2, yb - 1, 1, 1);
            }
          });
        }
        // the trunk's inner face, lit from below and dying upward
        var tx = side < 0 ? trunkX(side) + tw - 1 : trunkX(side);
        var yy, top = H - ph * 0.6;
        g2.fillStyle = FIRE[0];
        for (yy = H - 1; yy > top; yy--) {
          var lv2 = (yy - top) / (H - top);
          lv2 = bright ? lv2 * 1.3 : lv2 * 0.7;
          if (BAYER[yy & 3][tx & 3] < lv2 * 16) g2.fillRect(tx, yy, 1, 1);
        }
      };
      drawPine(gc, -1); drawPine(gc, 1);
      var brightC = mk(), gb = brightC.getContext('2d');
      gb.setTransform(1, 0, 0, 1, 0, 0);
      gb.drawImage(dim, 0, 0);
      gb.setTransform(RES2, 0, 0, RES2, 0, 0);
      litPine(gc, -1, false); litPine(gc, 1, false);
      litPine(gb, -1, true);  litPine(gb, 1, true);
      C.dim = dim; C.bright = brightC;

      // sparks: sixteen slots, each on its own period, born at bottom-centre
      C.sparkY = H - 50;
      C.sparkRise = Math.min(40, Math.max(16, H * 0.12));
      for (i = 0; i < 16; i++) {
        C.sparks.push({
          life: 0.6 + rnd() * 0.4, gap: 0.2 + rnd() * 1.6, off: rnd() * 3,
          dx: (rnd() - 0.5) * 24, wob: 1 + Math.floor(rnd() * 3), x0: (rnd() - 0.5) * 8,
          big: rnd() > 0.3,
        });
      }
      // satellites: lane heights and phase offsets
      C.sat1 = { y: H * (0.14 + rnd() * 0.1), slope: (rnd() - 0.5) * 0.1, off: rnd() * 40 };
      C.sat2 = { y: H * (0.05 + rnd() * 0.06), slope: (rnd() - 0.5) * 0.06, off: rnd() * 90 };
      // the smoke plume: its sway phase and where it thins out
      C.smoke = { ph: rnd() * 6.28, top: H * 0.5, x0: (rnd() - 0.5) * W * 0.06 };
      return C;
    }

    var key = W + 'x' + H + ':' + Math.floor(rnd() * 1e9);
    var C = starsCampCache;
    if (!C || C.key !== key) C = starsCampCache = build(key);

    // --- the frame --------------------------------------------------------------
    // medium: the firelight pulse — two held steps, bright for 1.1 s of 2.5
    var bright = (t % 2.5) < 1.1;
    g.drawImage(bright ? C.bright : C.dim, 0, 0, W, H);

    // fast: twinkle by ramp step, 0.5 s
    var step = Math.floor(t / 0.5), i, tw, idx;
    var SEQ = [0, 1, 2, 1];
    for (i = 0; i < C.tw.length; i++) {
      tw = C.tw[i];
      idx = SEQ[(step + tw.p) & 3];
      g.fillStyle = STAR[idx];
      g.fillRect(tw.x, tw.y, 0.5, 0.5);
      if (idx === 2 && tw.cross) { g.fillRect(tw.x - 0.5, tw.y, 0.5, 0.5); g.fillRect(tw.x + 0.5, tw.y, 0.5, 0.5); }
    }

    // slow: the smoke plume, rising from the fire below the frame through the
    // middle of the view — sky-black where it crosses the horizon glow, one
    // ramp step up where it climbs into the dark, seen mostly by the stars it
    // hides. 2-unit rows, x snapped to a texel, ragged edges fixed per row,
    // thinning by row-dither toward its top.
    var sm = C.smoke, y, hgt, sway, w, span = H - sm.top, rag;
    for (y = H - 2; y > sm.top; y -= 2) {
      hgt = H - y;
      var f2 = hgt / span;
      if (f2 > 0.5 && ((y >> 1) & 1)) continue;           // every other row
      if (f2 > 0.78 && ((y >> 2) & 1)) continue;          // then every fourth
      sway = Math.sin(hgt * 0.04 - t * 0.45 + sm.ph) * hgt * 0.06 + Math.sin(hgt * 0.17 - t * 1.1) * 1.2;
      rag = ((y * 7) & 3) - 1.5;
      w = Math.min(16, 3 + hgt * 0.1) + rag;
      g.fillStyle = y > C.glowTop ? '#04040f' : '#08091a';
      g.fillRect(snap(W / 2 + sm.x0 + sway - w / 2), y, snap(w), 2);
    }

    // slow: the satellites. sat1 crosses L→R in 40 s and blinks every 1.2 s;
    // sat2 crosses R→L on a higher lane, visible 50 s of every 90, no blink.
    var u1 = ((t + C.sat1.off) % 40) / 40;
    var sx = snap(-4 + (W + 8) * u1), sy = snap(C.sat1.y + (sx - W / 2) * C.sat1.slope);
    var blink = (t % 1.2) < 0.15;
    g.fillStyle = STAR[0];
    g.fillRect(sx - 1.5, sy, 1.5, 0.5);                   // the tail: three dim texels behind
    g.fillStyle = blink ? STAR[2] : STAR[1];
    g.fillRect(sx, sy - 0.5, 1, 1);                       // the head: a 2x2-texel dot
    if (blink) g.fillRect(sx + 1, sy, 0.5, 0.5);          // the blink: one texel ahead
    var u2 = ((t + C.sat2.off) % 90) / 50;
    if (u2 <= 1) {
      sx = snap(W + 4 - (W + 8) * u2); sy = snap(C.sat2.y + (sx - W / 2) * C.sat2.slope);
      g.fillStyle = STAR[0];
      g.fillRect(sx, sy, 2, 0.5);
    }

    // fast: sparks up out of the plume, through the middle of the view
    var sp, per, age, px, py, f;
    for (i = 0; i < C.sparks.length; i++) {
      sp = C.sparks[i]; per = sp.life + sp.gap;
      age = (t + sp.off) % per;
      if (age >= sp.life) continue;
      f = age / sp.life;
      px = snap(W / 2 + sm.x0 + sp.x0 + sp.dx * f + Math.sin(age * 9) * sp.wob);
      py = snap(C.sparkY - C.sparkRise * f);
      g.fillStyle = FIRE[f < 0.2 ? 3 : f < 0.45 ? 2 : f < 0.75 ? 1 : 0];
      if (sp.big && f < 0.7) g.fillRect(px, py, 1, 1); else g.fillRect(px, py, 0.5, 0.5);
    }
  },

  // --- cairn — v0.9.1 pass 7 retake (variant A); helpers and header above SCENE_PAINTERS
  cairn: function (g, W, H, t, rnd) {
    var key = W + 'x' + H;
    var C = cairnRetakeCache[key] || (cairnRetakeCache[key] = cairnBuild(W, H));
    var k = C.k, horizon = C.horizon, waterTop = C.waterTop, landY = C.landY, quietY = C.quietY;
    var i, j;

    // sky, then the clouds, then the land in front of both
    // sky rows only (the land cache covers the rest), then the clouds, then the
    // land from the far ridge's tallest peak down — two blits, ~one frame of texels
    var skyH = Math.ceil(horizon) + 1;
    g.drawImage(C.sky, 0, 0, W * 2, skyH * 2, 0, 0, W, skyH);
    for (i = 0; i < C.clouds.length; i++) {
      var cl = C.clouds[i];
      var step = Math.floor(t / (cl.far ? 2 : 1.2)) * 0.5;
      var span = W + cl.w;
      var x = ((cl.x0 + step) % span + span) % span - cl.w;
      for (j = 0; j < cl.rows.length; j++) {
        var row = cl.rows[j];
        // 2-shade: the flat underside in the pale blue-grey; the body white
        // with a shaded left shoulder on every row above it
        if (j === 0) { g.fillStyle = '#cfe0e8'; g.fillRect(x + row.dx, cl.y, row.w, 2); }
        else {
          g.fillStyle = '#cfe0e8'; g.fillRect(x + row.dx, cl.y - j * 2, row.lit, 2);
          g.fillStyle = '#f2f2e8'; g.fillRect(x + row.dx + row.lit, cl.y - j * 2, row.w - row.lit, 2);
        }
      }
    }
    var rt = C.ridgeTop;
    g.drawImage(C.land, 0, rt * 2, W * 2, (H - rt) * 2, 0, rt, W, H - rt);

    // the water: palette-cycled dashes on a lattice, ramp scrolling toward us
    var ramp = ['#17435f', '#1e567a', '#2b6b8f', '#3f83a8'];
    var fast = Math.floor(t / 0.4), slow = Math.floor(t / 2);
    var gust = t % 9, gustX = -1e9;
    if (gust < 4) gustX = (gust / 4) * (W + 60 * k) - 50 * k;
    for (i = 0; i < C.rows.length; i++) {
      var r = C.rows[i];
      var quiet = r.y >= quietY;
      var wob = Math.round(Math.sin(t * Math.PI + r.i * 0.9) * 2) * 0.5;
      for (j = 0; j < r.d.length; j++) {
        var d = r.d[j];
        var idx = (((quiet ? slow : fast) - r.i + d.o) % 4 + 4) % 4;
        if (quiet && idx === 3) idx = 2;
        if (idx === 1) continue;                    // the plate's own colour: nothing to draw
        g.fillStyle = ramp[idx];
        g.fillRect(d.x + wob, r.y, idx === 0 ? cairnSnap(d.len * 0.5) : d.len, 0.5);
      }
      if (!quiet && gustX > -1e8) {
        // the wind-line: a diagonal front of shallow dashes crossing the band
        var gx = cairnSnap(gustX + r.i * 2.5 * k);
        g.fillStyle = '#2b6b8f';
        g.fillRect(gx, r.y, cairnSnap(12 * k), 0.5);
        g.fillRect(gx + cairnSnap(16 * k), r.y, cairnSnap(6 * k), 0.5);
        g.fillStyle = '#3f83a8';                    // the crest, one ramp step brighter
        g.fillRect(gx + cairnSnap(12 * k), r.y, cairnSnap(3 * k), 0.5);
      }
    }

    // the loon pair, far out, crossing on a 50 s track
    var lu = (t % 50) / 50;
    var lx = cairnSnap(lu * (W + 14 * k) - 7 * k), ly = cairnSnap(waterTop + 4 * k);
    g.fillStyle = '#1a1a22';
    g.fillRect(lx, ly, 2, 0.5); g.fillRect(lx + 1.5, ly - 0.5, 0.5, 0.5);
    var lx2 = cairnSnap(lx - 5 * k);
    g.fillRect(lx2, ly + 1, 2, 0.5); g.fillRect(lx2 + 1.5, ly + 0.5, 0.5, 0.5);

    // the cairn, scaled by min(W,H) so it holds its share of either aspect
    var cx = W * 0.5, base = H * 0.88, rows = 8, r2;
    var rowH = 4.2 * k, stoneH = cairnSnap(4 * k);
    for (r2 = 0; r2 < rows; r2++) {
      var rw = (rows - r2) * 4.6 * k + 4 * k, ry = cairnSnap(base - r2 * rowH);
      var stones = Math.max(2, Math.round(rw / (6 * k))), s2;
      for (s2 = 0; s2 < stones; s2++) {
        var stx = cairnSnap(cx - rw / 2 + (rw / stones) * s2 + rnd() * 1.5 * k);
        var stw = cairnSnap(rw / stones - 0.8 * k);
        var dark = (s2 + r2) % 2 === 0;
        g.fillStyle = dark ? '#6e6e78' : '#8d8d95';
        g.fillRect(stx, ry, stw, stoneH);
        g.fillStyle = dark ? '#8d8d95' : '#9a9aa2';
        g.fillRect(stx, ry, stw, 0.5);
      }
    }
    // the brass plaque
    g.fillStyle = '#a8905e';
    g.fillRect(cairnSnap(cx - 5 * k), cairnSnap(base - rows * rowH + 9 * k), cairnSnap(10 * k), cairnSnap(6 * k));

    // live grass: above the quiet band only, flicking one texel on a 0.6 s phase
    var flickStep = Math.floor(t / 0.6);
    for (i = 0; i < C.tufts.length; i++) {
      var tf = C.tufts[i];
      cairnDrawTuft(g, tf, ((flickStep + tf.ph) & 3) === 0 ? 1 : 0);
    }

    // the bough in the corner: the comb sways in texel steps, tip most (3 s)
    var bo = C.bough, sw = [0, 0, 0];
    sw[1] = Math.round(Math.sin(t * Math.PI * 2 / 3) * 1) * 0.5;
    sw[2] = Math.round(Math.sin(t * Math.PI * 2 / 3 - 0.5) * 2) * 0.5;
    for (i = 0; i < bo.length; i++) {
      var sg2 = bo[i], sy = sg2.y + sw[sg2.grp];
      g.fillStyle = '#1f5330';
      g.fillRect(sg2.x, sy + sg2.th, 1, sg2.dn);
      if (sg2.up) g.fillRect(sg2.x, sy - sg2.up, 1, sg2.up);
      if (sg2.cap) {
        g.fillStyle = sg2.glint ? '#3f8a52' : '#2c6e3f';
        g.fillRect(sg2.x, sy + sg2.th, 1, Math.min(sg2.cap, sg2.dn));
      }
      g.fillStyle = '#463526';
      g.fillRect(sg2.x, sy, 1, sg2.th);
    }
  },

  // --- dam — v0.9.1 pass 7 retake (variant A); helpers and header above SCENE_PAINTERS
  dam: function (g, W, H, t, rnd) {
    var hour = Math.round(hourNow() * 4) / 4;
    var C = damRetakeCache;
    if (C.key !== W + 'x' + H + '@' + hour) C = damRetakeBuild(W, H, hour);
    var geo = C.geo, ramp = C.ramp, i, x, y;
    var step = Math.floor(t / 0.25);                 // the fast clock

    // 1. back plate
    g.drawImage(C.back, 0, 0, W, H);

    // 2. one slow cloud, 1 texel / 2 s, blocky with a dithered underside
    var cs = Math.max(1, Math.round(Math.min(W, H) / 100 * 2) / 2);
    var cwid = 22 * cs;
    var cxp = Math.round(((W * 0.35 + t * 0.25) % (W + cwid + 8)) * 2) / 2 - cwid - 4;
    var cyp = Math.round(geo.horizon * (geo.portrait ? 0.3 : 0.28));
    g.fillStyle = C.cloud;
    g.fillRect(cxp + 5 * cs, cyp, 9 * cs, 1 * cs);
    g.fillRect(cxp + 2 * cs, cyp + 1 * cs, 16 * cs, 1 * cs);
    g.fillRect(cxp, cyp + 2 * cs, 22 * cs, 1.5 * cs);
    g.fillStyle = C.cloudDk;
    g.fillRect(cxp + 1 * cs, cyp + 3.5 * cs, 20 * cs, 0.5 * cs);
    for (i = 0; i < 20; i += 2) g.fillRect(cxp + (1 + i) * cs, cyp + 4 * cs, cs, 0.5 * cs);
    for (i = 1; i < 20; i += 2) g.fillRect(cxp + (1 + i) * cs, cyp + 3 * cs, cs, 0.5 * cs);

    // 3. upper-water glints sliding toward the crest (the current), 1 texel / 0.8 s
    var ng = Math.round(W / 10);
    g.fillStyle = ramp[1];
    for (i = 0; i < ng; i++) {
      x = Math.round(rnd() * W * 2) / 2;
      var gy0 = rnd() * (geo.uw - 4);
      y = geo.horizon + 1 + Math.round(((gy0 + t / 0.8 * 0.5) % (geo.uw - 4)) * 2) / 2;
      g.fillRect(x, y, 2 + (i % 2), 0.5);
    }

    // 4. the sheet: palette cycle, one blit
    g.drawImage(C.sheets[step % 7], geo.spanX, geo.crestBot, geo.spanW, geo.sh);

    // 5. threads riding the sheet at the step rate (8 units / s): a white
    //    thread with a ripple-blue shadow texel on its left so it shows on foam
    var thr = C.threads, ln = thr.length;
    for (i = 0; i < ln; i++) {
      y = geo.crestBot - 3 + Math.floor((t * 8 + thr[i].off) % (geo.sh + 6));
      var top = Math.max(geo.crestBot, y), bot = Math.min(geo.foot - 1, y + 3);
      if (bot <= top) continue;
      g.fillStyle = ramp[1];
      g.fillRect(thr[i].x - 0.5, top, 0.5, bot - top);
      g.fillStyle = ramp[3];
      g.fillRect(thr[i].x, top, 1, bot - top);
    }

    // 6. churn line at the foot, phase 1.1 s (not 1 s: whole-second strips would freeze it), texel-snapped
    var xe = geo.spanX + geo.spanW;
    for (x = geo.spanX; x < xe; x += 2) {
      var dy = Math.round(Math.sin(t * 5.712 + x * 0.9) * 3) / 2;
      g.fillStyle = (((x >> 1) + step) & 1) ? ramp[3] : ramp[2];
      g.fillRect(x, geo.foot + dy, 2, 1);
    }

    // 7. spray: texel particles rising off the churn, 0.45 s life, 3 s sway
    var ns = Math.round(geo.spanW / 5);
    var sway = Math.sin(t * 2.094);
    for (i = 0; i < ns; i++) {
      var sx = geo.spanX + rnd() * geo.spanW;
      var age = (t / 0.45 + rnd()) % 1;
      var px = Math.round((sx + sway * (1 + (i % 3))) * 2) / 2;
      var py = geo.foot - 1 - Math.round(age * geo.sprayH * 2) / 2;
      var sz = 0.5;
      if (age < 0.35) { g.fillStyle = ramp[3]; sz = 1; }
      else if (age < 0.7) g.fillStyle = ramp[2];
      else if (((i + Math.floor(t / 0.125)) & 1) === 0) g.fillStyle = ramp[2];
      else continue;
      g.fillRect(px, py, sz, sz);
    }

    // 8. pool: slow foam streaks drifting away from the foot, 1 texel / 1 s
    var poolH = H - geo.foot - 3;
    g.fillStyle = C.streak;
    for (i = 0; i < 8; i++) {
      x = Math.round(rnd() * W * 2) / 2;
      var py0 = rnd() * poolH;
      y = geo.foot + 3 + Math.round(((py0 + t * 0.5) % poolH) * 2) / 2;
      g.fillRect(x, y, 3 + (i % 3), 0.5);
    }

    // 9. foreground frame: the near bank — a dark stepped rock and a spruce
    //    bough, bottom-left, still; portrait adds a trunk up the left edge
    //    and two boughs over the sky
    var rw = Math.round(W * 0.22), rh = Math.round(geo.quiet * 0.42);
    var ry = H - rh;
    g.fillStyle = C.rockDk;
    g.fillRect(0, ry + 5, rw, rh - 5);                // base
    g.fillRect(0, ry + 3, rw - 3, 2);
    g.fillRect(0, ry + 1.5, rw - 7, 1.5);
    g.fillRect(2, ry, rw - 12, 1.5);
    g.fillRect(rw - 6, ry + 2, 2, 1);                 // a second hump
    g.fillStyle = '#6e6e78';                          // lit rim, dithered
    g.fillRect(2, ry, rw - 12, 0.5);
    for (i = 2; i < rw - 12; i += 2) g.fillRect(i, ry + 0.5, 1, 0.5);
    g.fillRect(rw - 10, ry + 1.5, 3, 0.5);
    g.fillRect(rw - 7, ry + 3, 4, 0.5);
    g.fillRect(rw - 3, ry + 5, 3, 0.5);
    g.fillStyle = '#8d8d95';
    g.fillRect(4, ry, 2, 0.5);
    g.fillRect(rw - 6, ry + 3, 1, 0.5);
    g.fillStyle = '#10100c';                          // cracks and the shadow under the lip
    g.fillRect(6, ry + 4, 0.5, 3);
    g.fillRect(rw - 9, ry + 7, 3, 0.5);
    g.fillRect(rw - 12, ry + 1.5, 2, 0.5);
    g.fillRect(rw - 3, ry + 5.5, 3, 0.5);
    for (i = 1; i < rw - 2; i += 5) g.fillRect(i + ((i * 3) % 4), ry + 9 + ((i * 7) % 5), 0.5, 0.5);
    var by = geo.foot + 5;
    var tw = geo.portrait ? Math.round(Math.max(6, W * 0.045)) : 0;
    if (geo.portrait) {
      // a spruce trunk up the left edge: tapers toward the top in 1-unit
      // steps, bark ridges in the three trunk tones, boughs off it
      var seg, segH = Math.max(12, Math.round(ry / 9)), sw;
      for (seg = 0; seg * segH < ry + 2; seg++) {
        sw = tw - Math.round(seg * tw * 0.35 / Math.max(1, Math.ceil((ry + 2) / segH) - 1));
        var sy = seg * segH, sh2 = Math.min(segH, ry + 2 - sy);
        g.fillStyle = '#5d4632';
        g.fillRect(0, sy, sw, sh2);
        g.fillStyle = '#463526';
        g.fillRect(sw - 1.5, sy, 1.5, sh2);
        g.fillRect(2 + ((seg * 5) % Math.max(1, sw - 4)), sy + 2, 1, sh2 - 4);
        g.fillStyle = '#7a5c42';
        g.fillRect(0, sy, 1, sh2);
        g.fillRect(1.5 + ((seg * 3) % Math.max(1, sw - 4)), sy + 4, 0.5, Math.max(1, sh2 - 8));
        g.fillRect(2 + ((seg * 7) % Math.max(1, sw - 4)), sy + sh2 - 3, 1.5, 0.5);
      }
      damRetakeBough(g, tw - 3, Math.round(geo.horizon * 0.4), Math.round(W * 0.42), 1, C.sky.tree, C.boughHi);
      damRetakeBough(g, tw - 2, Math.round(geo.horizon * 0.72), Math.round(W * 0.28), 1, C.sky.tree, C.boughHi);
    }
    damRetakeBough(g, Math.max(0, tw - 2), by, Math.round(W * 0.32), 1, C.sky.tree, C.boughHi);
  },

  // --- pictograph — v0.9.1 pass 7 retake (variant B); helpers and header above SCENE_PAINTERS
  pictograph: function (g, W, H, t, rnd) {
    var B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];   // Bayer 4x4, 0..15
    var RK = ['#4a4a54', '#6e6e78', '#7c7c86', '#8d8d95', '#9a9aa2'];  // rock ramp
    var WT = ['#17435f', '#1e567a', '#2b6b8f', '#3f83a8', '#cfe0e8'];  // water ramp
    var OC = ['#7c2c21', '#a33e2f', '#c05540'];                        // ochre ramp
    function q(v) { return Math.round(v * 2) / 2; }                    // snap to a texel
    var i, x, y;

    var waterY = q(H * 0.80);
    var bowY = q(H * 0.87);
    var quietY = H - (W >= H ? 48 : 60);        // rule 7: the caption / pill band
    var dapTop = q(H * 0.47);
    var sc = Math.min(W, H) / 120;               // figure scale (1.1 landscape, 1.6 phone)

    // --- build the cache once per W x H ------------------------------------
    var C = pictographCache, key = W + 'x' + H;
    if (C.key !== key) {
      C.key = key;
      C.waterY = waterY;
      var refH = Math.max(6, Math.floor(H * 0.12));
      C.refH = refH;
      // the two wet streaks: [x, width] in units, and a crooked path per row
      var streaks = [[q(W * 0.16), q(Math.max(4, W * 0.07))], [q(W * 0.71), q(Math.max(3, W * 0.05))]];
      C.streaks = streaks;
      var pr = rngFrom(4431), paths = [];
      for (i = 0; i < 2; i++) {
        var p = [], off = 0, r;
        for (r = 0; r <= waterY; r++) {
          if (pr() < 0.25) off += pr() < 0.5 ? -0.5 : 0.5;
          if (off > 1.5) off = 1.5;
          if (off < -1.5) off = -1.5;
          p.push(off);
        }
        paths.push(p);
      }
      C.paths = paths;

      // the face, painted with a palette P so the same routine draws the
      // reflection with the water-tinted greys
      var drawRock = function (g2, P) {
        var cr = rngFrom(443), xx, yy, k;
        g2.fillStyle = P[2];
        g2.fillRect(0, 0, W, H);
        // the granite's grain: three greys, texel-sized, snapped
        var n = Math.round(900 * (W * H) / (240 * 135));
        for (k = 0; k < n; k++) {
          var px = q(cr() * W), py = q(cr() * waterY), v = cr();
          g2.fillStyle = v > 0.85 ? P[4] : v > 0.5 ? P[3] : P[1];
          g2.fillRect(px, py, 1 + q(cr() * 2), 0.5 + q(cr() * 1.5));
        }
        // the foot of the face is wet and dark: a Bayer fade from the mid grey
        // down to rockDk over the bottom third, so the dapple has room above it
        var wet0 = Math.floor(H * 0.55);
        g2.fillStyle = P[1];
        for (yy = wet0; yy < waterY; yy++) {
          var wf = Math.round(((yy - wet0) / (waterY - wet0)) * 15);
          for (xx = 0; xx < W; xx++) {
            if (B4[(xx & 3) + (yy & 3) * 4] < wf) g2.fillRect(xx, yy, 1, 1);
          }
        }
        // the overhang's lip across the top, deeper on the left where the
        // rock leans furthest out; a five-cell Bayer fade into the face
        for (xx = 0; xx < W; xx++) {
          var yl = Math.round(H * 0.04 + (1 - xx / W) * H * 0.07 + Math.sin(xx * 0.17) * 0.8);
          g2.fillStyle = P[0];
          g2.fillRect(xx, 0, 1, yl);
          g2.fillStyle = P[1];
          for (k = 0; k < 5; k++) {
            if (B4[(xx & 3) + ((yl + k) & 3) * 4] < (5 - k) * 3) g2.fillRect(xx, yl + k, 1, 1);
          }
        }
        // fractures: three near-level cracks with a lit lower edge, two joints
        for (k = 0; k < 3; k++) {
          var cy0 = H * [0.17, 0.44, 0.69][k] + (cr() - 0.5) * H * 0.04, slope = (cr() - 0.5) * 0.12;
          for (xx = 0; xx < W; xx += 2) {
            cy0 += slope * 2 + (cr() < 0.2 ? (cr() < 0.5 ? -0.5 : 0.5) : 0);
            if (cr() < 0.75) {
              g2.fillStyle = P[0]; g2.fillRect(xx, q(cy0), 2, 0.5);
              g2.fillStyle = P[3]; g2.fillRect(xx, q(cy0) + 0.5, 2, 0.5);
            }
          }
        }
        for (k = 0; k < 2; k++) {
          var jx = q(W * (0.455 + k * 0.435)), jy0 = q(H * (0.1 + cr() * 0.3)), jl = H * 0.18;
          for (yy = jy0; yy < jy0 + jl; yy += 1) {
            if (cr() < 0.7) { g2.fillStyle = P[0]; g2.fillRect(jx + (cr() < 0.3 ? 0.5 : 0), yy, 0.5, 1); }
          }
        }
        // the wet streaks: a rockDk column following its crooked path, edges
        // dithered a cell either side, the grain inside them gone dark
        for (k = 0; k < 2; k++) {
          var sx = streaks[k][0], sw = streaks[k][1], path = paths[k];
          for (yy = 0; yy < waterY; yy++) {
            var ox = sx + path[yy];
            g2.fillStyle = P[1];
            g2.fillRect(ox, yy, sw, 1);
            if (B4[(yy & 3) * 4 + 1] < 8) g2.fillRect(ox - 1, yy, 1, 1);
            if (B4[(yy & 3) * 4 + 2] < 8) g2.fillRect(ox + sw, yy, 1, 1);
            if (cr() < 0.35) { g2.fillStyle = P[0]; g2.fillRect(ox + q(cr() * (sw - 1)), yy, 1 + q(cr()), 0.5); }
          }
        }
        // the wet foot, awash: three rows of lip shade, dithered upward
        g2.fillStyle = P[0];
        g2.fillRect(0, waterY - 1, W, 1);
        for (xx = 0; xx < W; xx++) {
          if (B4[(xx & 3)] < 8) g2.fillRect(xx, waterY - 2, 1, 1);
          if (B4[(xx & 3) + 4] < 4) g2.fillRect(xx, waterY - 3, 1, 1);
        }
      };

      var rc = document.createElement('canvas');
      rc.width = W * 2; rc.height = H * 2;
      var rg = rc.getContext('2d');
      rg.setTransform(2, 0, 0, 2, 0, 0);
      drawRock(rg, RK);
      C.rock = rc;

      // the reflection: the bottom refH units of the face mirrored about the
      // waterline in the water-tinted greys, then dithered into deep water
      // with depth
      var RP = [];
      for (i = 0; i < 5; i++) RP.push(hexLerp(RK[i], WT[0], 0.62));
      var fc = document.createElement('canvas');
      fc.width = W * 2; fc.height = refH * 2;
      var fg = fc.getContext('2d');
      fg.setTransform(2, 0, 0, -2, 0, 2 * waterY);
      drawRock(fg, RP);
      fg.setTransform(2, 0, 0, 2, 0, 0);
      fg.fillStyle = WT[0];
      for (y = 0; y < refH; y++) {
        var thr = Math.round((y / refH) * 17) - 1;
        for (x = 0; x < W; x++) {
          if (B4[(x & 3) + (y & 3) * 4] < thr) fg.fillRect(x, y, 1, 1);
        }
      }
      C.refl = fc;

      // the dapple's two field tiles, 0..15 each: a slanted wave (32x8) and a
      // tighter cross wave (24x12); their sum against the Bayer threshold is
      // the caustic. Crawling them at different rates is the whole animation.
      var TA = [], TB = [];
      for (y = 0; y < 8; y++) for (x = 0; x < 32; x++) {
        TA.push(Math.round(7.5 + 7.5 * Math.sin(x * Math.PI / 16 + 1.3 * Math.sin(y * Math.PI / 4))));
      }
      for (y = 0; y < 12; y++) for (x = 0; x < 24; x++) {
        TB.push(Math.round(7.5 + 7.5 * Math.sin(y * Math.PI / 3 + 1.4 * Math.sin(x * Math.PI / 12))));
      }
      C.TA = TA; C.TB = TB;
    }

    // --- the face --------------------------------------------------------------
    g.drawImage(C.rock, 0, 0, W, H);

    // --- the dapple: sun off the lake thrown up the rock --------------------
    // 1-unit cells, runs merged per row; the field crawls up and sideways in
    // whole cells, the Bayer threshold stays on the screen grid
    var TA = C.TA, TB = C.TB;
    var oxA = Math.floor(t / 4) % 32, oyA = Math.floor(t / 1.5) % 8;
    var oxB = (24 - Math.floor(t / 7) % 24) % 24, oyB = Math.floor(t / 2.5) % 12;
    var phase = Math.floor(t / 0.5) & 1;
    // cells are 2 units wide by 1 tall (4x2 texels): light off water lands as
    // short level bands, not grain. The Bayer runs at half strength so the
    // field's bands stay bands and the dither only softens their edges.
    var rows = Math.floor(waterY - 3 - dapTop), cols = Math.ceil(W / 2);
    var cy, cx;
    for (cy = 0; cy < rows; cy++) {
      y = dapTop + cy;
      var d = cy / rows, bias = Math.round(d * 12) - 3;
      var flick = phase && y < quietY;
      var rowA = ((cy + oyA) & 7) * 32, rowB = ((cy + oyB) % 12) * 24, rowD = (cy & 3) * 4;
      var run = -1, tone = 0;
      for (cx = 0; cx <= cols; cx++) {
        var tn = 0;
        if (cx < cols) {
          var s = TA[((cx + oxA) & 31) + rowA] + TB[((cx + oxB) % 24) + rowB] + bias - (B4[(cx & 3) + rowD] >> 1);
          tn = s >= 27 ? 2 : s >= 21 ? (flick ? 2 : 1) : 0;
        }
        if (tn !== tone) {
          if (tone) { g.fillStyle = tone === 2 ? RK[4] : RK[3]; g.fillRect(run * 2, y, (cx - run) * 2, 1); }
          run = cx; tone = tn;
        }
      }
    }

    // --- the trickles: one bright texel walking down each streak ---------------
    var step = Math.floor(t / 0.15);
    for (i = 0; i < 2; i++) {
      var st = C.streaks[i], pth = C.paths[i], span = Math.floor(waterY * 2) - 2, k2;
      for (k2 = 0; k2 < 3; k2++) {
        var yt = ((step + k2 * Math.floor(span / 3) + i * 37) % span) * 0.5;   // in units, texel steps
        var ry = Math.floor(yt), tx = st[0] + pth[ry] + q(st[1] * (0.3 + 0.2 * k2));
        g.fillStyle = RK[4];
        g.fillRect(tx, yt - 2, 1, 2);
        g.fillStyle = WT[4];
        g.fillRect(tx, yt, 1, 0.5);
      }
    }

    // --- the water ------------------------------------------------------------
    g.fillStyle = WT[0];
    g.fillRect(0, waterY, W, H - waterY);
    // the reflection, wobbling on a 2-unit grid (period 2 s), whole texels
    var refH = C.refH, band;
    for (band = 0; band < refH; band += 2) {
      var dx = Math.round(Math.sin(t * Math.PI + band * 0.7) * 3) * 0.5;
      g.drawImage(C.refl, 0, band * 2, W * 2, 4, dx, waterY + band, W, 2);
    }
    // deep-water glints drifting left, slow and dim, below the reflection
    var gr = rngFrom(4451), drift = Math.floor(t / 0.6) * 0.5;
    for (i = 0; i < 7; i++) {
      var gy = q(waterY + refH + 1 + gr() * (H - waterY - refH - 2)), gl = 3 + q(gr() * 5);
      var gx = (gr() * W - drift) % W; if (gx < 0) gx += W;
      g.fillStyle = WT[1];
      g.fillRect(q(gx), gy, gl, 0.5);
    }
    // the lap: dashes every 4 units cycling the ramp in a 2 s wave; brighter
    // steps only where the waterline sits above the quiet band
    var lapPal = waterY < quietY ? [WT[2], WT[3], WT[4]] : [WT[0], WT[1], WT[2]];
    var lapStep = Math.floor(t / 0.5);
    for (i = 0; i < W; i += 4) {
      var ph = Math.floor(i / 4) + lapStep, jit = ((ph + Math.floor(i / 16)) % 4) === 0 ? 0.5 : 0;
      g.fillStyle = lapPal[ph % 3];
      g.fillRect(i, waterY + jit, 2.5, 0.5);
    }

    // --- the ochre: the panel ---------------------------------------------------
    // one red, blocky; the moose, the canoe with paddlers and the rayed sun as
    // the baseline had them, plus a hand and a second small canoe so the wall
    // reads as a panel. A few texels weathered to the dark red, from rnd.
    var o = OC[1], u = sc;
    function R(xx, yy, ww, hh) { g.fillRect(q(xx), q(yy), q(ww), q(hh)); }
    g.fillStyle = o;
    var cxC = W * 0.32, cyC = H * 0.40;                          // the canoe
    R(cxC - 12 * u, cyC, 24 * u, 2 * u);
    R(cxC - 13 * u, cyC - 1.5 * u, 2 * u, 2 * u); R(cxC + 11 * u, cyC - 1.5 * u, 2 * u, 2 * u);
    R(cxC - 5 * u, cyC - 5 * u, 1.5 * u, 5 * u); R(cxC + 3 * u, cyC - 5 * u, 1.5 * u, 5 * u);
    R(cxC - 6.5 * u, cyC - 5 * u, 4.5 * u, 1 * u); R(cxC + 1.5 * u, cyC - 5 * u, 4.5 * u, 1 * u);   // paddles held level
    var mx = W * 0.62, my = H * 0.55;                              // the moose
    R(mx, my, 14 * u, 6 * u);
    R(mx + 12 * u, my - 4 * u, 3 * u, 5 * u);
    R(mx + 13 * u, my - 8 * u, 1 * u, 4 * u); R(mx + 15.5 * u, my - 8 * u, 1 * u, 4 * u);
    R(mx + 11.5 * u, my - 8 * u, 1.5 * u, 1 * u); R(mx + 16.5 * u, my - 8 * u, 1.5 * u, 1 * u);   // the rack's tines
    R(mx + 1 * u, my + 6 * u, 1.5 * u, 5 * u); R(mx + 10 * u, my + 6 * u, 1.5 * u, 5 * u);
    R(mx + 4 * u, my + 6 * u, 1.5 * u, 4 * u); R(mx + 7 * u, my + 6 * u, 1.5 * u, 4 * u);
    var sx = W * 0.5, sy = H * 0.22;                               // the rayed sun
    R(sx - 3 * u, sy - 3 * u, 6 * u, 6 * u);
    for (i = 0; i < 8; i++) {
      var a2 = (i / 8) * Math.PI * 2;
      R(sx + Math.cos(a2) * 6.5 * u - 0.75 * u, sy + Math.sin(a2) * 6.5 * u - 0.75 * u, 1.5 * u, 1.5 * u);
    }
    var hx = W * 0.80, hy = H * 0.30;                              // the hand
    R(hx, hy, 4 * u, 4 * u);
    R(hx - 1.5 * u, hy + 1.5 * u, 1.5 * u, 1 * u);
    for (i = 0; i < 4; i++) R(hx + i * u, hy - 3 * u + (i === 1 || i === 2 ? -0.5 * u : 0), 1 * u, 3 * u);
    var c2x = W * 0.20, c2y = H * 0.60, u2 = u * 0.7;               // a second, smaller canoe
    R(c2x - 8 * u2, c2y, 16 * u2, 2 * u2);
    R(c2x - 9 * u2, c2y - 1.5 * u2, 2 * u2, 2 * u2); R(c2x + 7 * u2, c2y - 1.5 * u2, 2 * u2, 2 * u2);
    R(c2x - 1 * u2, c2y - 5 * u2, 1.5 * u2, 5 * u2);
    // weathering: a scatter of dark-red texels on the big figures
    g.fillStyle = OC[0];
    for (i = 0; i < 10; i++) {
      var wk = rnd();
      if (wk < 0.4) R(cxC - 12 * u + rnd() * 24 * u, cyC + rnd() * 2 * u, 1, 0.5);
      else if (wk < 0.8) R(mx + rnd() * 14 * u, my + rnd() * 6 * u, 1, 0.5);
      else R(sx - 3 * u + rnd() * 6 * u, sy - 3 * u + rnd() * 6 * u, 0.5, 0.5);
    }

    // --- your bow: the red stem dead centre, gunwales to the corners --------
    var stemX = q(W * 0.5);
    for (y = bowY; y < H; y += 1) {
      var sp = (y - bowY) / (H - bowY), hw = q(2 + sp * W * 0.5);
      g.fillStyle = OC[0];
      g.fillRect(stemX - hw, y, hw * 2, 1);
      g.fillStyle = OC[1];
      g.fillRect(stemX - hw + 1.5, y, hw * 2 - 3, 1);
      g.fillStyle = OC[2];
      g.fillRect(stemX - hw, y, 1.5, 1); g.fillRect(stemX + hw - 1.5, y, 1.5, 1);
    }
    g.fillStyle = OC[0];                                            // the keel line and the inwales
    g.fillRect(stemX - 0.5, bowY + 4, 1, H - bowY - 4);
    for (y = bowY + 3; y < H; y += 1) {
      var sp2 = (y - bowY) / (H - bowY), hw2 = q(2 + sp2 * W * 0.5);
      g.fillRect(stemX - hw2 + 3, y, 1, 1); g.fillRect(stemX + hw2 - 4, y, 1, 1);
    }
    g.fillStyle = RK[3];                                            // the ash deck plate
    g.fillRect(stemX - 3, bowY + 1.5, 6, 2.5);
    g.fillStyle = RK[1];
    g.fillRect(stemX - 3, bowY + 4, 6, 0.5);
    // the paddle resting across the left gunwale: the blade out over the
    // water on the left, the shaft climbing over the gunwale into the hull
    var bh = H - bowY, bw = q(Math.max(9, W * 0.07)), bx0 = q(W * 0.03), by0 = q(bowY + bh * 0.45);
    var shx = bx0 + bw, shy = by0 + 1.5, shEnd = q(W * 0.40), k3 = 0;
    // (dark greys: the blade sits in the caption's corner and must stay quiet)
    g.fillStyle = RK[1];
    g.fillRect(bx0, by0, bw, 3.5);                                  // the blade
    g.fillStyle = RK[0];
    g.fillRect(bx0, by0 + 3.5, bw, 0.5); g.fillRect(bx0, by0 + 0.5, 0.5, 3);
    g.fillStyle = RK[2];
    g.fillRect(bx0 + 1.5, by0 + 0.5, bw - 3, 0.5);
    for (x = shx; x < shEnd; x += 4) {                              // the shaft, one texel up every 4 units
      g.fillStyle = RK[1];
      g.fillRect(x, shy - k3 * 0.5, 4.5, 1);
      g.fillStyle = RK[0];
      g.fillRect(x, shy - k3 * 0.5 + 1, 4.5, 0.5);
      k3++;
    }
    g.fillStyle = RK[2];                                            // the grip
    g.fillRect(shEnd, shy - k3 * 0.5 - 0.5, 2, 2);
    // the ripple off the stem, breathing on a 3 s period, whole texels
    var rw = 5 + Math.round(Math.sin(t * Math.PI * 2 / 3) * 2) * 0.5;
    g.fillStyle = WT[1];
    g.fillRect(stemX - rw, bowY - 0.5, rw * 2, 0.5);
    g.fillStyle = WT[2];
    g.fillRect(stemX - rw + 2, bowY - 0.5, rw * 2 - 4, 0.5);
  },

  // --- bigpine — v0.9.1 pass 7 retake (variant A); helpers and header above SCENE_PAINTERS
  bigpine: function (g, W, H, t, rnd) {
    var C = bigpineCache[W + 'x' + H] || bigpineBuild(W, H);
    var i, j;
    // rnd, in fixed order (header)
    var ravStart = rnd() * 27, ravY = H * (0.05 + rnd() * 0.12), ravDir = rnd() < 0.5 ? 1 : -1;
    var cAx0 = rnd() * (W + C.cloudA.w), cBx0 = rnd() * (W + C.cloudB.w);
    var tipPh = [];
    for (i = 0; i < 9; i++) tipPh.push(rnd() * 4);

    // layer offsets, whole texels: top / middle / near
    var TAU = Math.PI * 2;
    var off = [
      [Math.round(Math.sin(TAU * t / 6) * 1) * 0.5, 0],
      [Math.round(Math.sin(TAU * t / 5 + 0.6) * 2) * 0.5, 0],
      [Math.round(Math.sin(TAU * t / 4 + 1.2) * 3) * 0.5, Math.round(Math.sin(TAU * t / 4 + 2.4)) * 0.5],
    ];

    // 1. sky + trunk plate
    g.drawImage(C.plate, 0, 0, W, H);

    // 2. clouds (slow): one texel per period, wrapping
    function drawCloud(cl, x0, yTop, period) {
      var cx = ((x0 + Math.floor(t / period) * 0.5) % (W + cl.w)) - cl.w;
      cx = Math.round(cx * 2) / 2;
      var r;
      for (r = 0; r < cl.rows.length; r++) {
        g.fillStyle = r === cl.rows.length - 1 ? C.cloudCol[1] : C.cloudCol[0];
        g.fillRect(cx + cl.rows[r][0], yTop + r * 2, cl.rows[r][1], 2);
      }
    }
    drawCloud(C.cloudA, cAx0, C.cloudAy, 3);
    drawCloud(C.cloudB, cBx0, C.cloudBy, 1.5);

    // 3. the raven: an 8 s crossing inside a 35 s cycle, wings at 0.25 s
    var cyc = (t + ravStart) % 35;
    if (cyc < 8) {
      var u = cyc / 8;
      var rx = ravDir > 0 ? -2 + u * (W + 4) : W + 2 - u * (W + 4);
      rx = Math.round(rx * 2) / 2;
      var ry = Math.round((ravY + Math.sin(u * 7) * 1.5) * 2) / 2;
      g.fillStyle = '#10100c';
      if (Math.floor(t / 0.25) & 1) {
        g.fillRect(rx - 1.5, ry, 3, 0.5);
      } else {
        g.fillRect(rx - 0.5, ry, 1, 0.5);
        g.fillRect(rx - 1.5, ry - 0.5, 1, 0.5);
        g.fillRect(rx + 0.5, ry - 0.5, 1, 0.5);
      }
    }

    // 4. the trunk's top back over the sky traffic
    g.drawImage(C.cap.cv, C.cap.x, C.cap.y, C.cap.w, C.cap.h);

    // 5. boughs, far to near, each at its layer's offset
    for (i = 0; i < 9; i++) {
      var b = C.boughs[i], o = off[b.layer];
      g.drawImage(b.cv, b.x + o[0], b.y + o[1], b.w, b.h);
    }

    // 6. tips (fast): pine <-> pineLt on a 0.7 s phase per tuft
    for (i = 0; i < 9; i++) {
      var bb = C.boughs[i];
      if (!bb.tips.length) continue;
      var o2 = off[bb.layer];
      for (j = 0; j < bb.tips.length; j++) {
        var st = Math.floor(t / 0.7 + tipPh[i] + j * 0.37) & 1;
        g.fillStyle = st ? '#3f8a52' : '#2c6e3f';
        g.fillRect(bb.tips[j][0] + o2[0], bb.tips[j][1] + o2[1], 2, 1);
      }
    }

    // 7. the framing bough, nearest of all
    var fo = off[2];
    g.drawImage(C.frame.cv, C.frame.x + fo[0], C.frame.y + fo[1], C.frame.w, C.frame.h);
  },

  // --- ranger — v0.9.1 pass 7 retake (variant B); helpers and header above SCENE_PAINTERS
  ranger: function (g, W, H, t, rnd) {
    var C = rangerCacheB;
    if (C.key !== W + 'x' + H) C = rangerCacheB = rangerBuildB(W, H);
    var i, k, x, y, m = C.m, quietY = C.quietY;
    var wave = 6.2832 * t / 3;                             // the 3 s wave, phase by x below

    // 1. backdrop
    g.drawImage(C.back, 0, 0, W, H);

    // 2. clouds: two, at two speeds, in the lane above the chimney and spruce
    var lane = C.laneBot - C.laneTop, nCloud = lane > 90 ? 3 : 2;
    for (i = 0; i < nCloud; i++) {
      var far = i !== 1;
      var bw = Math.round(far ? W * 0.11 + rnd() * W * 0.05 : W * 0.18 + rnd() * W * 0.07);
      var yb = C.laneTop + rnd() * Math.max(0, lane - 8);
      yb = i === 2 ? Math.floor(lane * 0.55 + yb * 0.4) : far ? Math.floor(yb * 0.6) : Math.floor(yb * 0.5) + Math.floor(lane * 0.35);
      yb = Math.min(2 * Math.round(yb / 2), C.laneBot - 6);
      var x0 = rnd() * (W + bw);
      var drift = far ? Math.floor(t / 3) * 0.5 : Math.floor(t / 1.5) * 0.5;
      var cxl = ((x0 + drift) % (W + bw)) - bw;
      var rows = far ? 2 : 3;
      g.fillStyle = '#f2f2e8';
      for (k = 0; k < rows; k++) {
        var inset = k === 0 ? 0 : Math.round(bw * (0.12 + 0.18 * k)), rh = k === rows - 1 ? 1.5 : 2;
        g.fillRect(cxl + inset, yb + 2 - (k + 1) * 2 + (2 - rh), bw - inset * 2, rh);
      }
      g.fillStyle = '#cfe0e8';
      g.fillRect(cxl + 1, yb + 2, bw - 2, 1);                       // the flat underside
      g.fillRect(cxl, yb + 1, 1, 1); g.fillRect(cxl + bw - 1, yb + 1, 1, 1);
    }

    // 3. the dapple crawl: 1 texel / 2 s to and fro over P units (96 s cycle),
    //    flicking between the two checker phases every 0.4 s (0.5 would land
    //    on the same phase at every even second, so a t 0/2/4/6 strip would
    //    never show the second step)
    var step = Math.floor(t / 2) % (C.P * 4), off = step < C.P * 2 ? step * 0.5 : (C.P * 4 - step) * 0.5;
    var phase = Math.floor(t / 0.4) % 2;
    var gh = H - C.gTop;
    g.drawImage(phase ? C.dapB : C.dapA, off * 2, 0, W * 2, gh * 2, 0, C.gTop, W, gh);

    // 4. the cabin, then sun on its south wall course by course
    var cb = C.cabBox;
    g.drawImage(C.cabin, cb.x * 2, cb.y * 2, cb.w * 2, cb.h * 2, cb.x, cb.y, cb.w, cb.h);
    var wall = phase ? C.wallB : C.wallA, sx0 = C.shadeW + 4;
    for (i = 0; i < 8; i++) {
      var co = C.courses[i], ww = co.w - sx0;
      if (ww <= 0) continue;
      g.drawImage(wall, (off + sx0) * 2, (co.y - C.cy0) * 2, ww * 2, co.h * 2, C.cx0 + sx0, co.y, ww, co.h);
    }
    // the doorway's far side: a chink of light winks on a 6 s cycle
    if ((t % 6) < 1.5) {
      g.fillStyle = '#a8905e';
      g.fillRect(C.door.x + C.door.w - 1, rangerQ(C.door.y + (C.base - C.door.y) * 0.55), 1, 1.5);
    }

    // 5. the chickadee on the chimney: perched 16 s (head turning every 2 s),
    //    then a 4 s loop out over the clearing and back
    var p = t % 20, bxq, byq;
    var perchX = rangerQ(C.chx + C.chw / 2 - 0.5), perchY = C.chTop - 1;
    if (p < 16) {
      var face = Math.floor(t / 2) % 2;
      g.fillStyle = '#7a8a99'; g.fillRect(perchX, perchY, 1, 1);
      g.fillStyle = '#10100c'; g.fillRect(perchX, perchY, 1, 0.5);
      g.fillStyle = '#f2f2e8'; g.fillRect(perchX + (face ? 0.5 : 0), perchY, 0.5, 0.5);
    } else {
      var u = (p - 16) / 4, arc = Math.sin(u * 3.1416);
      bxq = rangerQ(perchX + arc * W * 0.16); byq = rangerQ(perchY - arc * m * 0.12 + Math.abs(Math.sin(u * 25)) * 1);
      var flap = Math.floor(t / 0.12) % 2;
      g.fillStyle = '#10100c'; g.fillRect(bxq, byq, 1, 0.5);
      g.fillRect(bxq - 0.5, byq - (flap ? 0.5 : 0), 0.5, 0.5); g.fillRect(bxq + 1, byq - (flap ? 0.5 : 0), 0.5, 0.5);
    }

    // 6. fireweed: stalks in the pine ramp, spike heads, a 3 s nod travelling
    //    across the clearing (above the quiet band only), sized by depth
    var nFw = 10 + Math.round(m * 0.06), fw = [], gT = C.gTop + 3;
    for (i = 0; i < nFw; i++) {
      x = rangerQ(rnd() * W); y = rangerQ(gT + rnd() * (H - 2 - gT));
      var onCabin = x > C.cx0 - 3 && x < C.chx + C.chw + 2 && y < C.base + 1;
      if (onCabin) y = rangerQ(C.base + 1 + rnd() * 3);
      var d = (y - C.gTop) / (H - C.gTop);
      fw.push({ x: x, y: y, h: rangerQ(3 + d * 0.085 * m), d: d });
    }
    fw.sort(function (a, b) { return a.y - b.y; });
    for (i = 0; i < nFw; i++) {
      var f = fw[i], live = f.y - f.h < quietY;
      var s = live ? Math.sin(wave - f.x * (12.566 / W)) : 0;
      var dx = s > 0.33 ? 0.5 : s < -0.33 ? -0.5 : 0;
      var top = f.y - f.h, bend = rangerQ(f.h * 0.4);
      g.fillStyle = f.d > 0.5 ? '#2c6e3f' : '#1f5330';
      g.fillRect(f.x, f.y - f.h + bend, 0.5, f.h - bend);            // the stalk
      g.fillRect(f.x + dx, top, 0.5, bend);                           // its bending top
      if (f.d > 0.35) { g.fillStyle = '#3f8a52'; g.fillRect(f.x - 1 + (dx < 0 ? -0.5 : 0), f.y - f.h * 0.5, 1, 0.5); } // a leaf
      if (f.h >= 6) {                                                 // the near ones: a spike
        g.fillStyle = '#7a6ab8'; g.fillRect(f.x + dx - 0.5, top - 1, 1.5, 1.5);
        g.fillStyle = '#e8b4c8'; g.fillRect(f.x + dx - 0.5, top - 2.5, 1.5, 1.5);
        g.fillRect(f.x + dx, top - 3, 0.5, 0.5);
      } else if (f.h >= 4) {
        g.fillStyle = '#7a6ab8'; g.fillRect(f.x + dx - 0.5, top - 0.5, 1.5, 1);
        g.fillStyle = '#e8b4c8'; g.fillRect(f.x + dx - 0.5, top - 1.5, 1.5, 1);
      } else {
        g.fillStyle = '#e8b4c8'; g.fillRect(f.x + dx - 0.5, top - 1, 1, 1);
      }
    }

    // 7. live grass tufts at the cabin's foot (those whose blade clears the quiet band)
    for (i = 0; i < C.liveTufts.length; i++) {
      var tf = C.liveTufts[i], sv = Math.sin(wave - tf.x * (12.566 / W) + tf.ph);
      rangerTuft(g, tf.x, tf.y, tf.h, tf.col, sv > 0.4 ? 0.5 : sv < -0.4 ? -0.5 : 0);
    }

    // 8. the butterfly: two texels of signYl on a random walk between fireweed
    //    heads, one texel step every 0.12 s, wings alternating each step. The
    //    walk is re-rolled from rnd every frame (256 steps, 30.7 s, the last 60
    //    of them homing on the start) so it is a pure function of t.
    var heads = [];
    for (i = 0; i < nFw; i++) if (fw[i].y - fw[i].h - 2 < quietY - 2 && fw[i].y - fw[i].h > C.gTop + 1) heads.push(fw[i]);
    if (heads.length) {
      var kk = Math.floor(t / 0.12) % 256;
      var h0 = heads[Math.floor(rnd() * heads.length)];
      var bx = h0.x, byy = h0.y - h0.h - 2, tgt = heads[Math.floor(rnd() * heads.length)], dwell = 0, sIdx;
      for (sIdx = 0; sIdx < kk; sIdx++) {
        var tx = sIdx >= 196 ? h0.x : tgt.x, ty = (sIdx >= 196 ? h0.y - h0.h : tgt.y - tgt.h) - 2;
        if (dwell > 0) {
          dwell--;
          var jr = rnd();
          if (jr < 0.25) bx += 0.5; else if (jr < 0.5) bx -= 0.5;
        } else {
          var rx = rnd(), ry = rnd();
          bx += tx > bx ? (rx < 0.8 ? 0.5 : -0.5) : tx < bx ? (rx < 0.8 ? -0.5 : 0.5) : (rx < 0.3 ? 0.5 : rx < 0.6 ? -0.5 : 0);
          byy += ty > byy ? (ry < 0.7 ? 0.5 : 0) : ty < byy ? (ry < 0.7 ? -0.5 : 0) : (ry < 0.3 ? 0.5 : ry < 0.6 ? -0.5 : 0);
          if (Math.abs(tx - bx) <= 0.5 && Math.abs(ty - byy) <= 0.5) {
            dwell = 6 + Math.floor(rnd() * 8);
            tgt = heads[Math.floor(rnd() * heads.length)];
          }
        }
        if (byy < C.gTop - 4) byy = C.gTop - 4;
        if (byy > quietY - 2) byy = quietY - 2;
        if (bx < 1) bx = 1; if (bx > W - 1) bx = W - 1;
      }
      var open = kk % 2 === 0;
      g.fillStyle = '#e8c832';
      if (open) g.fillRect(bx - 0.5, byy, 1, 0.5);
      else { g.fillRect(bx - 0.5, byy, 0.5, 0.5); g.fillRect(bx - 0.5, byy - 0.5, 0.5, 0.5); }
    }

    // 9. the near frame: the birch, then its leaves on the wave
    var fb = C.frontBox;
    g.drawImage(C.front, fb.x * 2, fb.y * 2, fb.w * 2, fb.h * 2, fb.x, fb.y, fb.w, fb.h);
    for (i = 0; i < C.leaves.length; i++) {
      var lf = C.leaves[i], ls = Math.sin(wave + lf.ph);
      g.fillStyle = lf.col;
      g.fillRect(lf.x + (ls > 0.5 ? 0.5 : ls < -0.5 ? -0.5 : 0), lf.y, 1, 0.5);
      g.fillRect(lf.x + 0.5, lf.y + 0.5, 0.5, 0.5);
    }
  },

  // --- lightning — v0.9.1 pass 7 retake (variant A); helpers and header above SCENE_PAINTERS
  lightning: function (g, W, H, t, rnd) {
    var seed = Math.floor(rnd() * 4294967296) >>> 0;
    var key = W + 'x' + H + ':' + seed;
    if (lightningCache.key !== key) { lightningCache = lightningBuild(W, H, seed); lightningCache.key = key; }
    var C = lightningCache;
    var k = C.k, i;

    // --- sheet lightning (fast): is this one of the flash frames? ------------
    var p = t % C.flashCycle, flash = false;
    for (i = 0; i < C.flashAt.length; i++) {
      var dt = p - C.flashAt[i];
      if ((dt >= 0 && dt < 0.1) || (dt >= 0.25 && dt < 0.3)) { flash = true; break; }
    }

    // --- sky, ridge, ground ---------------------------------------------------
    // On a normal frame only the cloud band (top bandB rows) needs the sky and
    // the tree as separate layers; below it the two are blitted as one
    // composite. A flash frame (rare) takes the plain three-layer path.
    var bB = C.bandB;
    if (flash) g.drawImage(C.backFlash, 0, 0, W, H);
    else g.drawImage(C.back, 0, 0, W * 2, bB * 2, 0, 0, W, bB);

    // --- far cloud (slow, half the near cloud's speed: parallax; built) ------
    var fx = W - C.fcw - Math.round(W * 0.08) + Math.floor(t / 3) * 0.5;
    fx = ((fx + C.fcw) % (W + C.fcw)) - C.fcw;
    lightningDrawCloud(g, flash ? C.farFlash : C.far, fx, C.farY, C.fcw, C.fch, 0);
    // portrait has the sky for a second one, low over the ridge on the left,
    // slower still (one texel every 4 s): the same plate, its domes half down
    if (C.farY2) {
      var fx2 = Math.round(W * 0.06) + Math.floor(t / 4) * 0.5;
      fx2 = ((fx2 + C.fcw) % (W + C.fcw)) - C.fcw;
      lightningDrawCloud(g, flash ? C.farFlash : C.far, fx2, C.farY2, C.fcw, C.fch, C.far.maxCut);
    }

    // --- the building cloud (slow: one texel every 1.5 s, from the left; its
    //     domes climb a row every few seconds on a 50 s rise-and-settle) -----
    var cx = -C.cw * 0.2 + Math.floor(t / 1.5) * 0.5;
    cx = ((cx + C.cw) % (W + C.cw)) - C.cw;
    var cut = Math.round(C.cloud.maxCut * (0.5 - 0.5 * Math.sin(t * Math.PI * 2 / 50)));
    lightningDrawCloud(g, flash ? C.cloudFlash : C.cloud, cx, C.cloudY, C.cw, C.ch, cut);

    // --- the tree --------------------------------------------------------------
    if (flash) g.drawImage(C.front, 0, 0, W, H);
    else {
      g.drawImage(C.front, 0, 0, W * 2, bB * 2, 0, 0, W, bB);
      g.drawImage(C.composite, 0, bB * 2, W * 2, (H - bB) * 2, 0, bB, W, H - bB);
    }

    // --- needle tufts (medium, two layers; fast tip flick) --------------------
    var swOuter = Math.round(Math.sin(t * Math.PI * 2 / 3.5) * 2) * 0.5;   // ±2 texels, 3.5 s
    var swInner = Math.round(Math.sin(t * Math.PI * 2 / 5)) * 0.5;         // ±1 texel, 5 s
    var flick = Math.floor(t / 0.35) & 1 ? 0.5 : 0;                        // 0.7 s period
    for (i = 0; i < C.boughs.length; i++) {
      var b = C.boughs[i];
      // the tuft hangs off the stub's end and droops: four rows, each a little
      // further right and narrower, pineLt tips on top, pineDk underneath
      var tx = b.ex - Math.floor(b.w * 0.6) + swOuter, ty = b.y - 1 - b.lift;
      var c;
      g.fillStyle = '#2c6e3f';
      g.fillRect(tx, ty, b.w, 1);
      g.fillRect(tx + 2, ty + 1, b.w - 2, 1);
      g.fillRect(tx + 4, ty + 2, b.w - 5, 1);
      g.fillStyle = '#3f8a52';
      for (c = 0; c < b.w; c += 2) g.fillRect(tx + c + flick, ty - 1, 1, 1);
      for (c = 1; c < b.w; c += 4) g.fillRect(tx + c, ty, 1, 1);
      g.fillStyle = '#1f5330';
      for (c = 3; c < b.w - 1; c += 2) g.fillRect(tx + c, ty + 1, 1, 1);
      for (c = 4; c < b.w - 5; c += 2) g.fillRect(tx + c, ty + 2, 1, 1);
      g.fillRect(tx + 6, ty + 3, Math.max(1, b.w - 9), 1);
      if (b.inner) {
        // a smaller tuft tucked against the spar's windward side, its own slower sway
        var ix = b.x - 2 - Math.round(6 * k) + swInner, iy = b.y - 2, iw = Math.round(6 * k);
        g.fillStyle = '#2c6e3f';
        g.fillRect(ix, iy, iw, 1);
        g.fillRect(ix + 1, iy + 1, iw - 1, 1);
        g.fillStyle = '#3f8a52';
        g.fillRect(ix + 1, iy - 1, 1, 1);
        g.fillRect(ix + 4, iy - 1, 1, 1);
        g.fillStyle = '#1f5330';
        g.fillRect(ix + 2, iy + 2, iw - 2, 1);
        g.fillRect(ix + 4, iy + 3, Math.max(1, iw - 5), 1);
      }
    }
    // a crown tuft at the living tip
    var tipx = lightningSnap(C.vx + 0.98 * W * 0.16) + swOuter, tipy = lightningSnap(C.splitY - 0.98 * H * 0.4);
    g.fillStyle = '#2c6e3f';
    g.fillRect(tipx - 2 * k, tipy - 1, 5 * k, 1);
    g.fillRect(tipx - 1, tipy - 2, 3, 1);
    g.fillStyle = '#3f8a52';
    g.fillRect(tipx + flick, tipy - 3, 1, 1);

    // --- grass at the horizon (medium-slow: one texel lean every 3 s; dark
    //     pine on pale sky, inside the quiet band so nothing brighter) -------
    var lean = Math.floor(t / 3) & 1 ? 0.5 : 0;
    g.fillStyle = '#1f5330';
    for (i = 0; i < C.grass.length; i++) {
      var gr = C.grass[i], gl = gr.ph ? lean : 0.5 - lean;
      g.fillRect(gr.x + gl, C.groundY - gr.h, 1, gr.h + 1);
      g.fillRect(gr.x + 1.5 - gl, C.groundY - gr.h + 1, 1, gr.h);
    }

    // --- the raven (slow 25 s cycle; fast wingbeat while flying) -------------
    var rp = t % 25, rx, ry;
    g.fillStyle = '#16120e';
    if (rp < 19) {
      // perched: clear of the spar's black tip so it cuts against the sky,
      // hunched, tail out over the drop; it looks the other way every 4 s and
      // lifts a wing to settle it once a cycle
      rx = C.tipX + 0.5; ry = C.tipY - 5;
      var turn = Math.floor(rp / 4) & 1;
      var shrug = rp > 9 && rp < 9.6;
      g.fillRect(rx - 1.5, ry, 4, 2);                             // body
      g.fillRect(rx - 1, ry + 2, 3, 1);                           // breast, on the tip
      g.fillRect(rx + (turn ? -3 : 1.5), ry + 1.5, 2, 1);         // tail
      g.fillRect(rx + (turn ? -2 : 1.5), ry - 1.5, 2, 1.5);       // head
      if (shrug) g.fillRect(rx - 1.5, ry - 1, 3, 1);              // the wing, lifted
      g.fillStyle = '#6e6e78';
      g.fillRect(rx + (turn ? -3 : 3.5), ry - 1, 1, 0.5);        // beak
    } else {
      var a = (rp - 19) / 6 * Math.PI * 2;
      var crx = W * 0.1, cry = H * 0.07;
      rx = lightningSnap(C.tipX - crx + crx * Math.cos(a));
      ry = lightningSnap(C.tipY - 2 - cry * Math.sin(a));
      var up = Math.floor(t / 0.15) & 1;
      g.fillRect(rx - 1, ry, 3, 1);                      // body
      if (up) { g.fillRect(rx - 3, ry - 1, 2, 1); g.fillRect(rx + 2, ry - 1, 2, 1); }
      else { g.fillRect(rx - 3, ry + 1, 2, 1); g.fillRect(rx + 2, ry + 1, 2, 1); }
    }
  },


  // ---------------------------------------------------------------------------
  // THE SMOKE LAKE PARK (v0.9 pass 4): three vistas, every one hour-aware the
  // way the lookout is — skyAt(hourNow()) paints the sky you arrived under,
  // the water takes that sky's colour, and the night folds the woods into the
  // treeline. Each fills whatever frame it is given by W/H fractions.
  // ---------------------------------------------------------------------------

  // --- the old chute dam, from the canoe on Ragged Lake -----------------------
  // Ragged sits one step above Smoke. From the water you face the low
  // log-and-rock dam across the creek mouth: the lake bulges white over its
  // lip and drops away behind it into the gorge, where the creek cascades
  // downhill between the banks toward a glint of Smoke Lake. The yellow
  // portage sign stands on the left bank; one rusty spike still holds a
  // timber that no longer needs holding. Two drowned snags keep you company.
  chute: function (g, W, H, t, rnd) {
    var h = hourNow(), sky = skyAt(h), night = sky.starA;
    var horizon = H * 0.36, lipY = H * 0.58, i, x, y, f;
    var grad = g.createLinearGradient(0, 0, 0, horizon);
    grad.addColorStop(0, sky.top);
    grad.addColorStop(1, sky.low);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, horizon + 2);
    var starRnd = rngFrom(Math.floor(rnd() * 0x7fffffff));   // one roll whatever the hour
    if (night > 0.02) {
      g.globalAlpha = night;
      sceneStars(g, W, H, starRnd, 120, horizon * 0.9);
      g.globalAlpha = 1;
    }
    // the far ridge beyond Smoke, hazed toward the sky by day
    sceneTreeline(g, W, H, rngFrom(211), horizon, sceneMix(sceneMix('#5c7c9c', sky.low, 0.3), sky.tree, night * 0.8), 0.5);
    // Smoke Lake: a strip of lower water seen over the drop of the land
    g.fillStyle = sceneMix('#2b6b8f', sky.lake, 0.5);
    g.fillRect(0, horizon + 1, W, H * 0.04 + 1);
    // the gorge: the banks close in from the notch at the lip up to the far
    // strip, a V of dark woods either side of the creek
    var wood = sceneMix('#1f4a2c', sky.tree, night * 0.75), woodLt = sceneMix('#2c6e3f', sky.tree, night * 0.75);
    var woodDk = sceneMix('#163c20', sky.tree, night * 0.75);
    var creek = sceneMix('#12303f', sky.lake, 0.35), top0 = horizon + H * 0.04;
    function halfAt(yy) { return W * 0.12 * (0.2 + 0.8 * (yy - top0) / (lipY - top0)); }
    for (y = top0; y < lipY; y += 1) {
      var hw = halfAt(y);
      g.fillStyle = wood;
      g.fillRect(0, y, W * 0.5 - hw, 1.2);
      g.fillRect(W * 0.5 + hw, y, W * 0.5 - hw, 1.2);
      g.fillStyle = creek;
      g.fillRect(W * 0.5 - hw, y, hw * 2, 1.2);
    }
    // the banks are woods, not lawns: rows of crowns stacked up the slope,
    // each row nearer and taller than the one behind it, none over the creek
    var rr2 = rngFrom(223), k2;
    for (k2 = 0; k2 < 6; k2++) {
      var ry0 = top0 + (lipY - top0) * (k2 + 1) / 6, scr = 0.35 + k2 * 0.16, colr = k2 % 2 ? woodDk : woodLt;
      var hwk = halfAt(ry0), xx = -2;
      while (xx < W) {
        var twr = (3 + rr2() * 5) * scr, thr = (5 + rr2() * 10) * scr, cxr = xx + twr / 2, sr2;
        if (Math.abs(cxr - W * 0.5) > hwk + twr * 0.4) {
          g.fillStyle = colr;
          for (sr2 = 0; sr2 < thr; sr2 += 1.2) g.fillRect(cxr - (twr / 2) * (sr2 / thr), ry0 - thr + sr2, twr * (sr2 / thr), 1.4);
        }
        xx += twr * 0.75;
      }
    }
    // the cascade: the creek steps down away from you over rock ledges, a
    // hop of white under each — every ledge further off and smaller, the
    // near ones at the lip the widest
    var rockLdg = sceneMix('#6e6e78', '#101418', night * 0.7), rockLdgLt = sceneMix('#8d8d95', '#101418', night * 0.7);
    for (i = 0; i < 5; i++) {
      var ly = top0 + (lipY - top0) * (0.2 + i * 0.17), lh = halfAt(ly), lt = 1 + i * 0.4;
      g.fillStyle = rockLdg;
      g.fillRect(W * 0.5 - lh, ly, lh * 2, lt + 1);
      g.fillStyle = rockLdgLt;
      g.fillRect(W * 0.5 - lh, ly, lh * 2, 0.6);
      var seg;
      for (seg = 0.05; seg < 1; seg += 0.12) {
        var ph = (t * 30 + i * 9 + seg * 40) % 10;
        g.fillStyle = 'rgba(240,246,250,' + (0.7 - night * 0.35).toFixed(2) + ')';
        g.fillRect(W * 0.5 - lh + lh * 2 * seg + Math.sin(seg * 9 + i) * 0.5, ly + lt + 1 + ph * 0.3, 1 + i * 0.15, 2 + i * 0.5);
      }
    }
    // the banks at the lip: green ground with a sand edge to the Ragged water
    var bankY = lipY - H * 0.07, notch = W * 0.12;
    g.fillStyle = sceneMix('#2a5c35', sky.tree, night * 0.7);
    g.fillRect(0, bankY, W * 0.5 - notch - W * 0.02, lipY - bankY + 4);
    g.fillRect(W * 0.5 + notch + W * 0.02, bankY, W, lipY - bankY + 4);
    g.fillStyle = sceneMix('#c9b27c', sky.lake, 0.3 + night * 0.5);
    g.fillRect(0, lipY + 2, W * 0.5 - notch - W * 0.02, 2);
    g.fillRect(W * 0.5 + notch + W * 0.02, lipY + 2, W, 2);
    // the dam: stone piles at the ends, two timber courses between, and the
    // lake sliding white over the crest and away
    var rock = sceneMix('#6e6e78', '#101418', night * 0.7), rockLt = sceneMix('#8d8d95', '#101418', night * 0.7);
    var bark = sceneMix('#5d4632', '#101418', night * 0.6), barkDk = sceneMix('#463526', '#101418', night * 0.6);
    var dL = W * 0.5 - notch - W * 0.05, dR = W * 0.5 + notch + W * 0.05;
    for (i = 0; i < 6; i++) {
      var pr = rngFrom(300 + i), sw = 3 + pr() * 3;
      g.fillStyle = i % 2 ? rock : rockLt;
      g.fillRect(dL + (i % 3) * 4, lipY - 3 + Math.floor(i / 3) * 3.5, sw, 3.4);
      g.fillRect(dR - (i % 3) * 4 - sw, lipY - 3 + Math.floor(i / 3) * 3.5, sw, 3.4);
    }
    g.fillStyle = bark;
    g.fillRect(dL + 6, lipY, dR - dL - 12, 3.2);
    g.fillStyle = barkDk;
    g.fillRect(dL + 6, lipY + 3.2, dR - dL - 12, 2.6);
    for (x = dL + 8; x < dR - 8; x += 6) g.fillRect(x, lipY, 0.8, 5.8);   // the log ends and checks
    for (x = W * 0.5 - notch; x < W * 0.5 + notch; x += 2.4) {          // the sheet over the crest
      var wob = Math.sin(t * 5 + x * 0.7) * 0.5;
      g.fillStyle = 'rgba(240,246,250,' + (0.75 - night * 0.35).toFixed(2) + ')';
      g.fillRect(x, lipY - 2.2 + wob, 1.6, 3.2);
      g.fillStyle = 'rgba(207,224,232,' + (0.35 - night * 0.2).toFixed(2) + ')';
      g.fillRect(x, lipY - 4.5 + wob, 1.2, 2.5);
    }
    // one rusty spike, square-headed, still driven through the top course
    g.fillStyle = '#b5562a';
    g.fillRect(dL + 13, lipY + 0.8, 1.6, 1.6);
    g.fillStyle = '#6b2f14';
    g.fillRect(dL + 13.4, lipY + 2.4, 0.8, 1.4);
    // the portage sign on the left bank: post, yellow board, the black tab
    var px = W * 0.2, py = bankY + 1;
    g.fillStyle = sceneMix('#4d3a28', '#101418', night * 0.6);
    g.fillRect(px, py - 9, 1.2, 10);
    g.fillStyle = sceneMix('#e8c832', '#4a4020', night * 0.6);
    g.fillRect(px - 4, py - 12, 9.5, 5);
    g.fillStyle = '#10100c';
    g.fillRect(px - 2.5, py - 10.5, 3, 1.2);
    g.fillRect(px + 1.5, py - 10.5, 2, 1.2);
    // Ragged Lake in front of you, the dam's dark reflection under the wall,
    // and two drowned snags off to the right, the old stumps the dam left
    var lake = sceneMix('#2b6b8f', sky.lake, 0.55 + night * 0.3);
    g.fillStyle = lake;
    g.fillRect(0, lipY + 4, W, H - lipY - 4);
    g.fillStyle = 'rgba(16,24,28,0.3)';
    g.fillRect(dL, lipY + 5.8, dR - dL, H * 0.05);
    for (i = 0; i < 2; i++) {
      var sx0 = W * (0.72 + i * 0.16), sy0 = H * (0.74 + i * 0.1), sh = H * (0.09 - i * 0.02);
      g.fillStyle = sceneMix('#4a4a52', '#101418', night * 0.6);
      g.fillRect(sx0 - 1.2 - i * 0.4, sy0 - sh, 2.4 + i * 0.8, sh);
      g.fillStyle = rockLt;
      g.fillRect(sx0 - 1.2 - i * 0.4, sy0 - sh, 2.4 + i * 0.8, 1);
      g.fillStyle = 'rgba(16,24,28,0.25)';
      g.fillRect(sx0 - 1.6 - i * 0.4, sy0, 3.2 + i * 0.8, sh * 0.5);
    }
    for (y = lipY + 8; y < H; y += 3) {
      f = (y - lipY) / (H - lipY);
      g.fillStyle = 'rgba(63,131,168,' + (0.32 - night * 0.2).toFixed(2) + ')';
      g.fillRect((Math.sin(y * 0.5 + t * 1.6) * 6 * f + W * 0.45) % W, y, 6 + f * 10, 0.6);
      g.fillRect((Math.cos(y * 0.35 - t * 1.2) * 8 * f + W * 0.1) % W, y + 1.5, 4 + f * 8, 0.5);
    }
  },

  // --- the top of the Devil's Staircase, looking north --------------------------
  // On foot at the top step, the whole climb behind you: the log steps fall
  // away downhill between the trunks, the trail jogs hard right at the
  // switchback partway down, and Ragged Lake lies below with the drowned
  // snags standing in its shallows like masts; the far shore is maple, the
  // rounder, lighter green in a country of pines.
  staircase: function (g, W, H, t, rnd) {
    var h = hourNow(), sky = skyAt(h), night = sky.starA;
    var horizon = H * 0.30, lakeTop = horizon + H * 0.02, lakeBot = H * 0.50, i, x, y;
    var grad = g.createLinearGradient(0, 0, 0, horizon);
    grad.addColorStop(0, sky.top);
    grad.addColorStop(1, sky.low);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, horizon + 2);
    var starRnd = rngFrom(Math.floor(rnd() * 0x7fffffff));
    if (night > 0.02) {
      g.globalAlpha = night;
      sceneStars(g, W, H, starRnd, 120, horizon * 0.9);
      g.globalAlpha = 1;
    }
    // the far ridge, then the maple shore: round crowns shouldering each other
    sceneTreeline(g, W, H, rngFrom(233), horizon, sceneMix(sceneMix('#6f8fae', sky.low, 0.3), sky.tree, night * 0.8), 0.4);
    var maple = sceneMix('#4f8a3a', sky.tree, night * 0.75), mapleLt = sceneMix('#6ea24a', sky.tree, night * 0.75);
    var mr = rngFrom(241);
    for (x = -4; x < W + 4; x += 3.2) {
      var cw = 4 + mr() * 4, ch = 2.6 + mr() * 2.2;
      g.fillStyle = mr() > 0.6 ? mapleLt : maple;
      g.beginPath(); g.ellipse(x, lakeTop - ch * 0.4, cw, ch, 0, 0, Math.PI * 2); g.fill();
    }
    // Ragged Lake below, its shimmer, and the snags in the near shallows
    var lake = sceneMix('#2b6b8f', sky.lake, 0.5 + night * 0.35);
    g.fillStyle = lake;
    g.fillRect(0, lakeTop, W, lakeBot - lakeTop + 1);
    for (y = lakeTop + 2; y < lakeBot - 2; y += 2) {
      var d = (y - lakeTop) / (lakeBot - lakeTop);
      g.fillStyle = 'rgba(210,226,236,' + (0.06 + 0.16 * d - night * 0.1).toFixed(3) + ')';
      g.fillRect((W * 0.3 + Math.sin(y * 0.6 + t * 1.5) * 5 * d) % W, y, 6 + d * 14, 0.5);
    }
    var snag = sceneMix('#4a4a52', '#101418', night * 0.6), snagLt = sceneMix('#8d8d95', '#101418', night * 0.6);
    var sr = rngFrom(Math.floor(rnd() * 0x7fffffff));
    for (i = 0; i < 14; i++) {
      var sx0 = sr() * W, sy0 = lakeBot - H * 0.005 - sr() * H * 0.07;
      var sh = H * (0.03 + sr() * 0.06), lean = (sr() - 0.5) * 0.25, sw = 0.8 + sr() * 0.9;
      var s;
      for (s = 0; s < sh; s += 1) {
        g.fillStyle = s < 1 ? snagLt : snag;
        g.fillRect(sx0 + lean * s, sy0 - sh + s, sw, 1.2);
      }
      g.fillStyle = 'rgba(16,24,28,0.28)';
      g.fillRect(sx0 - lean * 2, sy0, sw, sh * 0.45);
    }
    // the near shore at the foot of the stairs: sand, then the slope you are
    // standing on — forest floor rising toward you from the landing
    g.fillStyle = sceneMix('#c9b27c', sky.lake, 0.3 + night * 0.5);
    g.fillRect(0, lakeBot, W, 1.6);
    var floor = sceneMix('#2a5c35', sky.tree, night * 0.75), floorDk = sceneMix('#20492a', sky.tree, night * 0.75);
    g.fillStyle = floor;
    g.fillRect(0, lakeBot + 1.6, W, H - lakeBot);
    var tex = rngFrom(251);
    for (i = 0; i < 300; i++) {
      g.fillStyle = tex() > 0.5 ? floorDk : sceneMix('#3f8a52', sky.tree, night * 0.75);
      g.fillRect(tex() * W, lakeBot + 2 + tex() * (H - lakeBot - 2), 1.6, 0.8);
    }
    // the trail: from your feet (wide, at the bottom) up to the switchback,
    // a hard jog right, then on down to the landing at the vanishing point
    var vx = W * 0.48, vy = lakeBot + H * 0.01, swY = H * 0.72, swX = W * 0.62;
    var trail = sceneMix('#8a6b45', '#101418', night * 0.6), trailDk = sceneMix('#6f5436', '#101418', night * 0.6);
    var bark = sceneMix('#5d4632', '#101418', night * 0.6), barkLt = sceneMix('#7a5c42', '#101418', night * 0.6);
    function trailX(yy) {                    // the trail's centre line by height
      if (yy > swY) return W * 0.5 + (swX - W * 0.5) * (H - yy) / (H - swY) * 0.35;
      return swX + (vx - swX) * (swY - yy) / (swY - vy);
    }
    function trailW(yy) { return 3 + (yy - vy) / (H - vy) * W * 0.34; }
    for (y = vy; y < H; y += 1) {
      var tw = trailW(y), tcx = trailX(y);
      g.fillStyle = trail;
      g.fillRect(tcx - tw / 2, y, tw, 1.2);
    }
    // the switchback's shoulder: the trail runs level across, then turns
    g.fillStyle = trail;
    g.fillRect(trailX(swY + 0.5) - trailW(swY) / 2, swY - 2.5, swX - trailX(swY + 0.5) + trailW(swY) / 2, 5);
    // the log risers: one every few units, thicker and further apart as
    // they come toward your feet; a lighter top face on each
    var stepY = vy + 3, k = 0;
    while (stepY < H) {
      var tw2 = trailW(stepY), tcx2 = trailX(stepY), thick = 1 + (stepY - vy) / (H - vy) * 3;
      g.fillStyle = barkLt;
      g.fillRect(tcx2 - tw2 / 2 + 0.5, stepY, tw2 - 1, thick * 0.4);
      g.fillStyle = k % 3 === 2 ? barkLt : bark;
      g.fillRect(tcx2 - tw2 / 2 + 0.5, stepY + thick * 0.4, tw2 - 1, thick * 0.7);
      g.fillStyle = trailDk;
      g.fillRect(tcx2 - tw2 / 2 + 0.5, stepY + thick * 1.1, tw2 - 1, 0.6);
      stepY += 2.5 + (stepY - vy) / (H - vy) * H * 0.075;
      k++;
    }
    // trunks either side, the near ones at the frame edges thick as a
    // thigh, the far ones a pencil line; each with its bark highlight
    // (the nearest run off the top of the frame: that is the canopy)
    var tr = rngFrom(263);
    for (i = 0; i < 22; i++) {
      var side = i % 2 ? 1 : -1, near = tr() * tr();            // 0 down by the water -> 1 at your elbow
      var ty = lakeBot + 2 + near * (H - lakeBot) * 0.9;
      var txx = trailX(ty) + side * (trailW(ty) / 2 + 3 + near * W * 0.22 + tr() * W * 0.08);
      var th = H * (0.05 + near * 0.9), tww = 0.8 + near * 5.5;
      g.fillStyle = tr() > 0.4 ? bark : sceneMix('#463526', '#101418', night * 0.6);
      g.fillRect(txx - tww / 2, ty - th, tww, th);
      g.fillStyle = barkLt;
      g.fillRect(txx - tww / 2, ty - th, Math.max(0.6, tww * 0.25), th);
      // a crown on every trunk whose top is in the frame: three boughs of
      // needles, the widest lowest, so a pole reads as a pine
      if (ty - th > H * 0.04) {
        var cr2;
        for (cr2 = 0; cr2 < 3; cr2++) {
          g.fillStyle = cr2 % 2 ? sceneMix('#1f5330', sky.tree, night * 0.7) : sceneMix('#2c6e3f', sky.tree, night * 0.7);
          g.beginPath();
          g.ellipse(txx, ty - th + th * (0.06 + cr2 * 0.11), tww * (2.2 + cr2 * 1.1) + 1.5, th * 0.06 + 0.8, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  },

  // --- the blue-water cliff, from the canoe on the south arm ----------------------
  // Under the east cliff the water goes blue-green and clear to the bottom:
  // boulders lie on the floor in plain sight, paler the shallower they are.
  // The granite rises straight out of it on the right, fractured and
  // lichened, pines along its top; the paddle blade and the hull's red edge
  // are in the foreground, and far out on the open water, one loon.
  bluewater: function (g, W, H, t, rnd) {
    var h = hourNow(), sky = skyAt(h), night = sky.starA;
    var horizon = H * 0.45, i, x, y;
    var grad = g.createLinearGradient(0, 0, 0, horizon);
    grad.addColorStop(0, sky.top);
    grad.addColorStop(1, sky.low);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, horizon + 2);
    var starRnd = rngFrom(Math.floor(rnd() * 0x7fffffff));
    if (night > 0.02) {
      g.globalAlpha = night;
      sceneStars(g, W, H, starRnd, 120, horizon * 0.9);
      g.globalAlpha = 1;
    }
    // the far west shore, low and hazed
    sceneTreeline(g, W, H, rngFrom(271), horizon, sceneMix(sceneMix('#5c7c9c', sky.low, 0.3), sky.tree, night * 0.8), 0.45);
    // the water: blue-green by day, the sky's own dark at night
    var water = sceneMix(sceneMix('#2f8f8a', sky.lake, 0.35), sky.lake, night * 0.7);
    var waterDeep = sceneMix(sceneMix('#1e6a70', sky.lake, 0.45), sky.lake, night * 0.7);
    g.fillStyle = waterDeep;
    g.fillRect(0, horizon + 1, W, H - horizon);
    for (y = horizon + 1; y < H; y += 1) {
      var d = (y - horizon) / (H - horizon);            // 0 far -> 1 near
      g.fillStyle = sceneMix(waterDeep, water, Math.min(1, d * 1.6));
      g.fillRect(0, y, W, 1.2);
    }
    // the cliff's reflection, a dark green-grey column broken by the surface
    var cliffX = W * 0.5;
    g.fillStyle = 'rgba(40,52,50,0.35)';
    for (y = horizon + 1; y < H * 0.62; y += 1.5) {
      g.fillRect(cliffX + Math.sin(y * 0.9 + t * 2) * 1.5, y, W - cliffX, 0.9);
    }
    // the boulders on the bottom, seen through the water: rounded, paler
    // where the floor is shallower (near, and under the cliff), each with
    // a shadow side — the reason this arm has its name
    var br = rngFrom(Math.floor(rnd() * 0x7fffffff));
    var floorCol = sceneMix('#8aa89c', water, 0.35), floorDk = sceneMix('#5d7c72', water, 0.4);
    for (i = 0; i < 28; i++) {
      var bx = br() * W, by = horizon + H * 0.06 + br() * (H - horizon - H * 0.1);
      var dd = (by - horizon) / (H - horizon), shallow = Math.min(1, dd * 0.9 + (bx > cliffX ? 0.25 : 0));
      var rx = (2 + br() * 5) * (0.4 + dd), ry = rx * (0.45 + br() * 0.2);
      g.globalAlpha = (0.18 + shallow * 0.55) * (1 - night * 0.75);
      g.fillStyle = floorDk;
      g.beginPath(); g.ellipse(bx, by + ry * 0.35, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = floorCol;
      g.beginPath(); g.ellipse(bx - rx * 0.15, by, rx * 0.85, ry * 0.8, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    // caustic shimmer riding the surface, and the loon far out
    for (y = horizon + 3; y < H * 0.8; y += 2.5) {
      var d2 = (y - horizon) / (H - horizon);
      g.fillStyle = 'rgba(220,240,236,' + (0.05 + 0.14 * d2 - night * 0.12).toFixed(3) + ')';
      g.fillRect((Math.sin(y * 0.7 + t * 1.8) * 8 * d2 + W * 0.2 + y) % W, y, 4 + d2 * 12, 0.6);
    }
    var lx = W * 0.2 + Math.sin(t * 0.3) * 2, ly = horizon + H * 0.035;
    g.fillStyle = '#1a1a22';
    g.fillRect(lx - 1.6, ly - 0.6, 3.2, 1.1);
    g.fillRect(lx + 1.2, ly - 1.8, 0.9, 1.6);
    g.fillStyle = '#e8e8f0';
    g.fillRect(lx - 0.4, ly - 0.6, 1.2, 0.5);
    // the cliff: granite from the waterline to the top, leaning back a
    // touch, fractured in bands, lichen in the cracks, a wet dark foot
    var rock = sceneMix('#6e6e78', '#101418', night * 0.7), rockLt = sceneMix('#8d8d95', '#101418', night * 0.7);
    var rockDk = sceneMix('#4a4a52', '#101418', night * 0.7);
    var topY = H * 0.10;
    for (y = topY; y < horizon + 1; y += 1) {
      var lean = (horizon - y) / (horizon - topY);       // 0 at the water -> 1 at the top
      var ex = cliffX + lean * W * 0.04 + Math.sin(y * 0.35) * 1.2;
      g.fillStyle = rock;
      g.fillRect(ex, y, W - ex, 1.2);
      g.fillStyle = rockLt;
      g.fillRect(ex, y, 1.6, 1.2);
    }
    var cr = rngFrom(283);
    for (i = 0; i < 260; i++) {
      var v = cr(), px = cliffX + W * 0.02 + cr() * (W * 0.48), py = topY + cr() * (horizon - topY);
      g.fillStyle = v > 0.7 ? rockLt : v > 0.35 ? rockDk : rock;
      g.fillRect(px, py, 1 + cr() * 3, 0.6 + cr() * 1.2);
    }
    for (i = 0; i < 5; i++) {                           // the fracture bands
      var fy = topY + (horizon - topY) * (0.15 + i * 0.18);
      g.fillStyle = rockDk;
      g.fillRect(cliffX + W * 0.02, fy + Math.sin(i) * 1.5, W * 0.5, 1);
      g.fillStyle = rockLt;
      g.fillRect(cliffX + W * 0.02, fy + Math.sin(i) * 1.5 + 1, W * 0.5, 0.5);
    }
    for (i = 0; i < 26; i++) {                          // lichen: orange and pale green
      g.fillStyle = i % 3 ? 'rgba(210,140,60,' + (0.5 - night * 0.35).toFixed(2) + ')' : 'rgba(150,175,110,' + (0.45 - night * 0.3).toFixed(2) + ')';
      g.fillRect(cliffX + W * 0.04 + cr() * W * 0.45, topY + cr() * (horizon - topY), 1.4 + cr() * 1.6, 1);
    }
    g.fillStyle = 'rgba(20,30,34,0.45)';                // the wet foot, awash
    g.fillRect(cliffX - 1, horizon - 3 + Math.sin(t * 2) * 0.4, W - cliffX + 1, 4);
    // pines along the top of the cliff — clipped to the cliff's own width
    // and height, because sceneTreeline paints its ground clear across the
    // frame (the first draft turned the whole scene into that ground)
    g.save();
    g.beginPath();
    g.rect(cliffX + W * 0.03, 0, W, topY + 1.5);
    g.clip();
    sceneTreeline(g, W, H, rngFrom(293), topY + 0.5, sceneMix('#163c20', sky.tree, night * 0.75), 0.5);
    g.restore();
    g.fillStyle = rock;
    g.fillRect(cliffX + W * 0.04, topY + 0.5, W, 1);
    // the foreground: the paddle blade in the water on the left, the hull's
    // red edge along the bottom, and you in the middle of both
    var padCol = sceneMix('#c9a86a', '#101418', night * 0.5), padDk = sceneMix('#a8905e', '#101418', night * 0.5);
    var ex0 = W * 0.22, ey0 = H * 0.66;                 // where the blade enters the water
    var s2;
    for (s2 = 0; s2 < 1; s2 += 0.02) {                  // the shaft, from the lower left corner up to the blade
      g.fillStyle = s2 % 0.1 < 0.05 ? padCol : padDk;
      g.fillRect(W * 0.02 + (ex0 - W * 0.02) * s2 - 1, H - (H - ey0) * s2 + H * 0.02 - 1.2, 3, 2.4);
    }
    g.fillStyle = padCol;
    g.fillRect(ex0 - 2.5, ey0 - H * 0.06, 5, H * 0.06);
    g.fillStyle = sceneMix(padCol, water, 0.55);        // the submerged half, tinted
    g.fillRect(ex0 - 2.8, ey0, 5.6, H * 0.07);
    for (i = 0; i < 3; i++) {                           // the rings where it went in
      var rr = (t * 4 + i * 2.2) % 6;
      g.fillStyle = 'rgba(230,246,240,' + (0.4 - rr * 0.06 - night * 0.2).toFixed(2) + ')';
      g.fillRect(ex0 - 3 - rr * 1.6, ey0 - 0.4, 6 + rr * 3.2, 0.5);
    }
    for (x = 0; x < W; x += 1) {                        // the gunwale: a red curve, its top edge catching the light
      var gy = H * 0.9 + Math.sin(x / W * Math.PI) * -H * 0.06 + (x / W) * H * 0.02;
      g.fillStyle = '#7c2c21';
      g.fillRect(x, gy, 1.2, H - gy);
      g.fillStyle = '#a33e2f';
      g.fillRect(x, gy, 1.2, 3.5);
      g.fillStyle = '#c05540';
      g.fillRect(x, gy, 1.2, 1);
    }
  },

  // --- Booth's Rock (pass 5) -----------------------------------------------------
  // The advertised lookout of the east end: a granite cliff top four hundred
  // feet over Rock Lake, the lake filling the middle of the view with its
  // three islands and the bluffs along the far shore, a canoe the size of a
  // seed on it, and Whitefish Lake a thin blue line on the north-west horizon.
  // You stand at the lip — the drop is the foreground. The lookout painter's
  // pattern: sky by hourNow, ridges hazed, the same stars whatever the hour.
  boothsrock: function (g, W, H, t, rnd) {
    var h = hourNow(), sky = skyAt(h), night = sky.starA;
    var skyY = H * 0.34, i, x, y;
    var grad = g.createLinearGradient(0, 0, 0, skyY);
    grad.addColorStop(0, sky.top);
    grad.addColorStop(1, sky.low);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, skyY + 2);
    var starRnd = rngFrom(Math.floor(rnd() * 0x7fffffff));   // one roll whatever the hour
    if (night > 0.02) {
      g.globalAlpha = night;
      sceneStars(g, W, H, starRnd, 150, skyY * 0.9);
      g.globalAlpha = 1;
    }
    // the sun, low over the far ridges by evening; the shimmer follows it
    var glowX = W * 0.6, glowCol = '240,234,210', late = h > 18.2 && h < 19.95;
    if (h >= 5.8 && h < 19.95) {
      var sunP = Math.max(0, Math.min(1, (h - 6) / 13.9));
      var sunX = W * (0.18 + sunP * 0.64), sunY = skyY - Math.max(2, ((19.9 - h) / 13.9) * skyY * 0.85);
      var r0 = Math.min(W, H) * (late ? 0.04 : 0.028);
      if (late) {
        var sg = g.createRadialGradient(sunX, sunY, r0 * 0.4, sunX, sunY, r0 * 4);
        sg.addColorStop(0, 'rgba(242,150,60,0.5)');
        sg.addColorStop(1, 'rgba(242,150,60,0)');
        g.fillStyle = sg;
        g.fillRect(sunX - r0 * 4, sunY - r0 * 4, r0 * 8, r0 * 8);
      }
      g.fillStyle = late ? '#f0a850' : '#f7ecd0';
      g.beginPath(); g.arc(sunX, sunY, r0, 0, Math.PI * 2); g.fill();
      glowX = sunX;
      if (late) glowCol = '240,180,110';
    }
    // two far ridges, hazed to the sky by day; and between them, off to the
    // north-west, Whitefish Lake — a thin line of blue and nothing more
    var ridge = ['#8ea6c2', '#5c7c9c'];
    sceneTreeline(g, W, H, rngFrom(401), skyY - H * 0.06, sceneMix(sceneMix(ridge[0], sky.low, 0.4), sky.tree, night * 0.8), 0.4);
    // the nearer ridge dips away on the left (clipped off the first 30 % of
    // the frame), and in that window Whitefish Lake shows at the far ridge's
    // foot as a thin line of blue, a paler thread of light along it
    g.save();
    g.beginPath(); g.rect(W * 0.3, 0, W, H); g.clip();
    sceneTreeline(g, W, H, rngFrom(409), skyY - H * 0.02, sceneMix(sceneMix(ridge[1], sky.low, 0.22), sky.tree, night * 0.8), 0.55);
    g.restore();
    g.fillStyle = sceneMix(sceneMix('#9fc4dc', sky.low, 0.25), sky.lake, night * 0.8);
    g.fillRect(W * 0.03, skyY - H * 0.02 - 1.8, W * 0.24, 1.4);
    g.fillStyle = 'rgba(240,246,250,' + (0.35 - night * 0.3).toFixed(2) + ')';
    g.fillRect(W * 0.06, skyY - H * 0.02 - 1.8, W * 0.16, 0.5);
    // the far shore's forest, a canopy of two greens down to the water
    var forest = sceneMix('#1f4a2c', sky.tree, night * 0.75), forestLt = sceneMix('#2c6e3f', sky.tree, night * 0.75);
    var forestDk = sceneMix('#163c20', sky.tree, night * 0.75);
    var lakeTop = H * 0.42, lipY = H * 0.74;
    g.fillStyle = forest;
    g.fillRect(0, skyY, W, lakeTop - skyY + 2);
    var tex = rngFrom(419);
    for (i = 0; i < 220; i++) {
      g.fillStyle = tex() > 0.5 ? forestLt : forestDk;
      g.fillRect(tex() * W, skyY + tex() * (lakeTop - skyY), 1.6, 0.9);
    }
    // Rock Lake: the middle band of the view, its far shore bitten into bays
    // between granite headlands, the water paler toward the far side
    var water = sky.lake, waterFar = sceneMix(sky.lake, sky.low, 0.35);
    function farShore(xx) { return lakeTop + Math.sin(xx / W * 9.2 + 0.7) * H * 0.02 + Math.sin(xx / W * 3.1) * H * 0.015; }
    for (x = 0; x < W; x += 1) {
      var fy = farShore(x);
      var yy2;
      for (yy2 = fy; yy2 < lipY + 2; yy2 += 2) {
        g.fillStyle = sceneMix(waterFar, water, Math.min(1, (yy2 - lakeTop) / (lipY - lakeTop) * 1.4));
        g.fillRect(x, yy2, 1.2, 2.2);
      }
      // the bluffs: grey granite faces where the far shore stands tall
      if (Math.sin(x / W * 9.2 + 0.7) > 0.55) {
        g.fillStyle = sceneMix('#7c7c86', sky.low, 0.3 + night * 0.5);
        g.fillRect(x, fy - 1.5, 1.2, 1.7);
      }
    }
    // three islands: the big wooded one left of centre, two small ones — a
    // sand rim, the wooded top, a lighter crown of canopy (the lookout's recipe)
    var isl = [[W * 0.38, H * 0.53, W * 0.06, H * 0.024], [W * 0.62, H * 0.49, W * 0.028, H * 0.011], [W * 0.7, H * 0.6, W * 0.03, H * 0.012]];
    for (i = 0; i < 3; i++) {
      g.fillStyle = sceneMix('#c9b27c', sky.lake, 0.35 + night * 0.5);
      g.beginPath(); g.ellipse(isl[i][0], isl[i][1], isl[i][2] * 1.15, isl[i][3] * 1.25, 0.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = forest;
      g.beginPath(); g.ellipse(isl[i][0], isl[i][1] - isl[i][3] * 0.2, isl[i][2], isl[i][3], 0.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = forestLt;
      g.beginPath(); g.ellipse(isl[i][0] - isl[i][2] * 0.2, isl[i][1] - isl[i][3] * 0.5, isl[i][2] * 0.45, isl[i][3] * 0.4, 0.2, 0, Math.PI * 2); g.fill();
    }
    // the shimmer path under whatever light owns the sky
    for (y = lakeTop + 2; y < lipY - 2; y += 1) {
      var d = (y - lakeTop) / (lipY - lakeTop);
      var w2 = 2 + d * 10, wob2 = Math.sin(y * 0.8 + t * 2) * d * 1.6;
      g.fillStyle = 'rgba(' + glowCol + ',' + (0.05 + 0.12 * (1 - Math.abs(d - 0.5) * 2)).toFixed(3) + ')';
      g.fillRect(glowX - w2 / 2 + wob2, y, w2, 0.5);
    }
    // the red canoe, a seed crossing the lake in a slow minute, its wake a thread
    var cp = (t / 60) % 1;
    var canX = W * 0.1 + W * 0.8 * cp, canY = H * 0.6 + Math.sin(cp * Math.PI * 2) * H * 0.03;
    g.fillStyle = 'rgba(235,242,248,0.25)';
    g.fillRect(canX - 4, canY + 0.4, 3.2, 0.4);
    g.fillStyle = '#a33e2f';
    g.fillRect(canX - 1, canY - 0.4, 2, 0.9);
    // the cliff lip: the granite you stand on ends in a ragged edge, and
    // under it is air — a band of the cliff's own shadow on the water below,
    // the talus at its foot a pale line, nothing between you and it
    var rock = sceneMix('#6e6e78', '#101418', night * 0.7), rockLt = sceneMix('#8d8d95', '#101418', night * 0.7);
    var rockDk = sceneMix('#4a4a52', '#101418', night * 0.7);
    g.fillStyle = 'rgba(16,24,28,0.32)';
    g.fillRect(0, lipY - H * 0.045, W, H * 0.045);
    g.fillStyle = 'rgba(220,214,190,' + (0.35 - night * 0.25).toFixed(2) + ')';
    g.fillRect(0, lipY - H * 0.048, W, 0.8);
    for (x = 0; x < W; x += 2.5) {
      var top = lipY + Math.sin(x * 0.21) * 2.2 + Math.sin(x * 0.67) * 1.1 + (x > W * 0.55 && x < W * 0.68 ? 3 : 0);   // a bite out of the lip
      g.fillStyle = rockDk;
      g.fillRect(x, top - 1.2, 2.5, 1.4);                 // the edge in shade
      g.fillStyle = rock;
      g.fillRect(x, top, 2.5, H - top);
      g.fillStyle = rockLt;
      g.fillRect(x, top + 0.4, 2.5, 1.2);
    }
    for (i = 0; i < 240; i++) {
      var v = rnd();
      g.fillStyle = v > 0.66 ? rockLt : v > 0.33 ? rockDk : rock;
      g.fillRect(rnd() * W, lipY + 3 + rnd() * (H - lipY - 3), 1 + rnd() * 2, 0.6 + rnd() * 1.2);
    }
    var cr = rngFrom(431), s;
    for (i = 0; i < 3; i++) {                             // cracks running back from the edge
      var cx0 = cr() * W, cy0 = lipY + 2;
      g.fillStyle = rockDk;
      for (s = 0; s < 12; s++) g.fillRect(cx0 + Math.sin(s * 0.9) * 1.4, cy0 + s * ((H - lipY) / 14), 0.8, 1.6);
    }
    for (i = 0; i < 20; i++) {                            // lichen, and a few blueberry-bush tufts in the cracks
      g.fillStyle = i % 4 ? 'rgba(140,168,96,' + (0.3 - night * 0.2).toFixed(2) + ')' : sceneMix('#2c6e3f', sky.tree, night * 0.7);
      g.fillRect(cr() * W, lipY + 4 + cr() * (H - lipY - 6), 1.4 + cr() * 1.6, i % 4 ? 1 : 2);
    }
    // one hawk riding the updraft off the face
    var ha = t * 0.45, hx = W * 0.5 + Math.cos(ha) * W * 0.2, hy = H * 0.3 + Math.sin(ha) * H * 0.05 + Math.sin(t * 0.9) * 1.2;
    var bank = Math.cos(ha) * 0.6;
    g.fillStyle = 'rgba(14,18,20,0.85)';
    g.fillRect(hx - 2.8, hy - 0.5 - bank, 2.8, 0.7);
    g.fillRect(hx, hy - 0.5 + bank, 2.8, 0.7);
    g.fillRect(hx - 0.5, hy - 0.2, 1, 1.1);
  },

  // --- the ochre pictographs on Rock Lake (pass 5) ------------------------------
  // From the canoe, bow to the rock: a grey granite bluff leaning out over
  // you, two shadowed alcoves worn into it, and in each the small red-ochre
  // marks somebody left a very long time ago — a scatter of dashes and dots
  // on the left, three parallel vertical lines about a foot long on the
  // right. Water laps the foot of the rock; your red bow points at it. Not
  // the Canoe park's wall of big figures: these are small, and in the dark.
  ochre: function (g, W, H, t, rnd) {
    var h = hourNow(), sky = skyAt(h), night = sky.starA;
    var waterY = H * 0.76, i, x, y;
    // a sliver of sky over the bluff's top edge, which climbs out of frame
    // to the right; cedars along the rim
    var grad = g.createLinearGradient(0, 0, 0, H * 0.3);
    grad.addColorStop(0, sky.top);
    grad.addColorStop(1, sky.low);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H * 0.3);
    var starRnd = rngFrom(Math.floor(rnd() * 0x7fffffff));
    if (night > 0.02) {
      g.globalAlpha = night;
      sceneStars(g, W, H, starRnd, 60, H * 0.2);
      g.globalAlpha = 1;
    }
    function rimY(xx) { return H * 0.2 - (xx / W) * H * 0.24 + Math.sin(xx * 0.09) * 1.6; }
    var rock = sceneMix('#7c7c86', '#101418', night * 0.7), rockLt = sceneMix('#9a9aa2', '#101418', night * 0.7);
    var rockDk = sceneMix('#5a5a64', '#101418', night * 0.7), shade = sceneMix('#3c3c46', '#0c1014', night * 0.6);
    // the bluff: from the rim down to the water, leaning OUT toward the top
    // (the overhang is what kept the paint dry), banded by its fractures
    for (y = 0; y < waterY + 1; y += 1) {
      var lean = 1 - y / waterY;                            // 1 at the top, 0 at the water
      for (x = 0; x < W; x += 3) {
        if (y < rimY(x)) continue;
        var band = Math.sin(y * 0.16 + Math.sin(x * 0.02) * 2) > 0.82;
        g.fillStyle = band ? rockDk : lean > 0.55 ? shade : rock;
        g.fillRect(x, y, 3.2, 1.2);
      }
    }
    var cr = rngFrom(443);
    for (i = 0; i < 700; i++) {                             // the granite's grain
      var px = cr() * W, py = cr() * waterY, v = cr();
      if (py < rimY(px)) continue;
      g.fillStyle = v > 0.7 ? rockLt : v > 0.35 ? rockDk : rock;
      g.fillRect(px, py, 1 + cr() * 2.5, 0.6 + cr() * 1.2);
    }
    for (i = 0; i < 18; i++) {                              // lichen and a wet streak
      g.fillStyle = i % 3 ? 'rgba(210,140,60,' + (0.4 - night * 0.3).toFixed(2) + ')' : 'rgba(150,175,110,' + (0.4 - night * 0.3).toFixed(2) + ')';
      g.fillRect(cr() * W, H * 0.3 + cr() * (waterY - H * 0.3), 1.4 + cr() * 1.6, 1);
    }
    g.fillStyle = 'rgba(40,50,60,0.3)';
    g.fillRect(W * 0.52, H * 0.1, W * 0.05, waterY - H * 0.1);
    // cedars along the rim, clipped to the rock's own top
    g.save();
    g.beginPath();
    for (x = 0; x <= W; x += 4) { if (x === 0) g.moveTo(0, rimY(0) + 1); else g.lineTo(x, rimY(x) + 1); }
    g.lineTo(W, 0); g.lineTo(0, 0); g.closePath();
    g.clip();
    sceneTreeline(g, W, H, rngFrom(449), H * 0.21, sceneMix('#1f4a2c', sky.tree, night * 0.75), 0.45);
    g.restore();
    // two alcoves: dark hollows worn into the face at shoulder height, each
    // an irregular pocket with a paler lip where the rock turns in
    var alc = [[W * 0.3, H * 0.5, W * 0.13, H * 0.14], [W * 0.72, H * 0.48, W * 0.11, H * 0.15]];
    for (i = 0; i < 2; i++) {
      var a0 = alc[i], a;
      g.fillStyle = rockLt;
      g.beginPath();
      for (a = 0; a < Math.PI * 2 + 0.05; a += 0.12) {
        var wob = 1 + 0.1 * Math.sin(a * 3 + i) + 0.06 * Math.cos(a * 5 + 1);
        var bx = a0[0] + Math.cos(a) * a0[2] * wob * 1.06, by = a0[1] + Math.sin(a) * a0[3] * wob * 1.08;
        if (a === 0) g.moveTo(bx, by); else g.lineTo(bx, by);
      }
      g.closePath(); g.fill();
      g.fillStyle = shade;
      g.beginPath();
      for (a = 0; a < Math.PI * 2 + 0.05; a += 0.12) {
        var wob1 = 1 + 0.1 * Math.sin(a * 3 + i) + 0.06 * Math.cos(a * 5 + 1);
        var bx1 = a0[0] + Math.cos(a) * a0[2] * wob1, by1 = a0[1] + Math.sin(a) * a0[3] * wob1;
        if (a === 0) g.moveTo(bx1, by1); else g.lineTo(bx1, by1);
      }
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(8,10,14,0.45)';                   // the deeper dark up under the overhang
      g.beginPath(); g.ellipse(a0[0], a0[1] - a0[3] * 0.35, a0[2] * 0.7, a0[3] * 0.45, 0, 0, Math.PI * 2); g.fill();
    }
    // the ochre. Left alcove: a scatter of small marks — short dashes, dots,
    // one small stick figure with its arms up. Right alcove: three parallel
    // vertical lines about a foot long, the tally somebody kept
    var o = sceneMix('#a33e2f', '#3a1a14', night * 0.55), oLt = sceneMix('#c25a44', '#3a1a14', night * 0.55);
    var mr = rngFrom(457);
    for (i = 0; i < 9; i++) {
      var mx = alc[0][0] - alc[0][2] * 0.55 + mr() * alc[0][2] * 1.1, my = alc[0][1] - alc[0][3] * 0.1 + mr() * alc[0][3] * 0.6;
      g.fillStyle = i % 3 ? o : oLt;
      if (mr() > 0.5) g.fillRect(mx, my, 2.2 + mr() * 2, 0.9); else g.fillRect(mx, my, 1.1, 1.1);
    }
    var fx0 = alc[0][0] + alc[0][2] * 0.25, fy0 = alc[0][1] + alc[0][3] * 0.05;
    g.fillStyle = o;
    g.fillRect(fx0 - 0.5, fy0 - 3, 1, 5);                   // the figure
    g.fillRect(fx0 - 2.5, fy0 - 2.5, 2, 0.9); g.fillRect(fx0 + 0.5, fy0 - 2.5, 2, 0.9);
    g.fillRect(fx0 - 1.6, fy0 + 2, 1.2, 1.6); g.fillRect(fx0 + 0.4, fy0 + 2, 1.2, 1.6);
    var lh = H * 0.07, lx0 = alc[1][0] - 3.4, ly0 = alc[1][1] - lh * 0.3;
    for (i = 0; i < 3; i++) {
      g.fillStyle = i === 1 ? oLt : o;
      g.fillRect(lx0 + i * 3.2, ly0 + Math.sin(i) * 0.8, 1.1, lh);
    }
    // the water at the foot: the sky's lake colour gone dark under the rock,
    // the bluff's reflection wobbling, wavelets lapping the wet foot
    var water = sceneMix(sky.lake, '#0e1c26', 0.35);
    g.fillStyle = water;
    g.fillRect(0, waterY, W, H - waterY);
    for (y = waterY; y < waterY + H * 0.12; y += 1.5) {
      g.fillStyle = 'rgba(60,64,74,' + (0.28 - (y - waterY) / (H * 0.12) * 0.22).toFixed(3) + ')';
      g.fillRect(Math.sin(y * 0.9 + t * 2) * 1.5, y, W, 0.9);
    }
    g.fillStyle = 'rgba(20,30,34,0.5)';                     // the wet foot, awash
    g.fillRect(0, waterY - 3 + Math.sin(t * 2) * 0.5, W, 3.6);
    for (x = 0; x < W; x += 3) {
      g.fillStyle = 'rgba(200,216,224,' + (0.35 - night * 0.2).toFixed(2) + ')';
      g.fillRect(x, waterY + Math.sin(t * 2.2 + x * 0.4) * 0.8, 2, 0.6);
    }
    for (y = waterY + 4; y < H; y += 3) {
      var f = (y - waterY) / (H - waterY);
      g.fillStyle = 'rgba(120,150,170,' + (0.18 - night * 0.1).toFixed(2) + ')';
      g.fillRect((Math.sin(y * 0.5 + t * 1.6) * 6 * f + W * 0.3) % W, y, 4 + f * 8, 0.5);
    }
    // your bow, dead centre and pointing at the rock: the red stem, the deck
    // plate, the gunwales running out to the bottom corners
    var bowY = H * 0.86, stemX = W * 0.5;
    var hull = sceneMix('#a33e2f', '#101418', night * 0.5), hullDk = sceneMix('#7c2c21', '#101418', night * 0.5);
    var hullLt = sceneMix('#c05540', '#101418', night * 0.5);
    for (y = bowY; y < H; y += 1) {
      var sp = (y - bowY) / (H - bowY), hw = 2 + sp * W * 0.5;
      g.fillStyle = hullDk;
      g.fillRect(stemX - hw, y, hw * 2, 1.2);
      g.fillStyle = hull;
      g.fillRect(stemX - hw + 1.5, y, hw * 2 - 3, 1.2);
      g.fillStyle = hullLt;
      g.fillRect(stemX - hw, y, 1.6, 1.2); g.fillRect(stemX + hw - 1.6, y, 1.6, 1.2);
    }
    g.fillStyle = sceneMix('#c9a86a', '#101418', night * 0.5);   // the ash deck plate
    g.fillRect(stemX - 2.5, bowY + 1.5, 5, 2.2);
    g.fillStyle = 'rgba(230,246,240,' + (0.3 - night * 0.15).toFixed(2) + ')';   // the ripple off the stem
    g.fillRect(stemX - 5 - Math.sin(t * 3) * 1, bowY - 0.6, 10 + Math.sin(t * 3) * 2, 0.5);
  },

  // --- Pen Falls (pass 5) ---------------------------------------------------------
  // Up the side trail from the 375 m: a trough-type falls a couple of metres
  // high and five or six wide, white water pouring into a run of low rapids
  // between banks of hemlock and cedar, coming down the creek toward you.
  // A boardwalk crosses the creek in the foreground, and beside it a stub
  // of pipe in the bank runs the cold spring — the sweetest water on the trip.
  penfalls: function (g, W, H, t, rnd) {
    var h = hourNow(), sky = skyAt(h), night = sky.starA;
    var skyY = H * 0.22, lipY = H * 0.4, poolY = H * 0.5, walkY = H * 0.84, i, x, y;
    var grad = g.createLinearGradient(0, 0, 0, skyY);
    grad.addColorStop(0, sky.top);
    grad.addColorStop(1, sky.low);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, skyY + 2);
    var starRnd = rngFrom(Math.floor(rnd() * 0x7fffffff));
    if (night > 0.02) {
      g.globalAlpha = night;
      sceneStars(g, W, H, starRnd, 80, skyY * 0.9);
      g.globalAlpha = 1;
    }
    // the far woods over the top of the falls, then the banks: hemlock and
    // cedar, dark and drooping, closing in from both sides toward the creek
    var wood = sceneMix('#183a24', sky.tree, night * 0.75), woodLt = sceneMix('#245a34', sky.tree, night * 0.75);
    var woodDk = sceneMix('#0f2a18', sky.tree, night * 0.75), cedar = sceneMix('#3a6a3a', sky.tree, night * 0.75);
    sceneTreeline(g, W, H, rngFrom(463), skyY, wood, 0.7);
    // the creek's half-width: a thread far up in the woods, opening to the
    // trough at the lip, then the rapids widening toward you
    var tw2 = W * 0.09;
    function halfAt(yy) {
      if (yy < lipY) return W * 0.025 + (tw2 - W * 0.025) * Math.max(0, yy - skyY) / (lipY - skyY);
      return W * (0.06 + 0.42 * Math.pow((yy - lipY) / (walkY - lipY), 0.8));
    }
    for (y = skyY; y < H; y += 1) {
      var hw = halfAt(y);
      g.fillStyle = y < lipY ? woodDk : wood;
      g.fillRect(0, y, W * 0.5 - hw, 1.2);
      g.fillRect(W * 0.5 + hw, y, W * 0.5 - hw + 1, 1.2);
    }
    var br = rngFrom(467), k;
    for (k = 0; k < 7; k++) {                              // boughs stacked down the banks, none over the water
      var ry0 = skyY + (H - skyY) * (k + 1) / 7.5, scr = 0.35 + k * 0.14, col = k % 3 === 0 ? cedar : k % 2 ? woodLt : woodDk;
      var hwk = halfAt(ry0), xx = -3;
      while (xx < W) {
        var tw = (3 + br() * 6) * scr, th = (5 + br() * 9) * scr, cx = xx + tw / 2, s;
        if (Math.abs(cx - W * 0.5) > hwk + tw * 0.45) {
          g.fillStyle = col;
          for (s = 0; s < th; s += 1.2) g.fillRect(cx - (tw / 2) * (s / th) - Math.sin(s) * 0.4, ry0 - th + s, tw * (s / th), 1.5);   // the droop
        }
        xx += tw * 0.7;
      }
    }
    // the falls: a granite trough between two grey shoulders, the creek
    // arriving dark over the lip and going white all the way down into the
    // plunge pool, the sheet ridged and moving
    var rock = sceneMix('#6e6e78', '#101418', night * 0.7), rockLt = sceneMix('#8d8d95', '#101418', night * 0.7);
    var rockDk = sceneMix('#4a4a52', '#101418', night * 0.7), creek = sceneMix('#183848', sky.lake, 0.35);
    for (y = skyY + 2; y < lipY; y += 1) {                // the creek above, coming down out of the woods to the lip
      var hwc = halfAt(y), fc = (y - skyY) / (lipY - skyY);
      g.fillStyle = sceneMix(woodDk, creek, 0.35 + fc * 0.65);
      g.fillRect(W * 0.5 - hwc, y, hwc * 2, 1.2);
      if (fc > 0.3 && Math.sin(y * 1.7 + t * 4) > 0.6) {  // the current's glints, nearer the lip
        g.fillStyle = 'rgba(200,220,228,' + (0.25 * fc - night * 0.1).toFixed(2) + ')';
        g.fillRect(W * 0.5 - hwc * 0.6 + Math.sin(y * 0.9) * hwc * 0.5, y, hwc * 0.5, 0.6);
      }
    }
    // the shoulders: two granite knuckles the creek has worn its trough
    // between — ragged, leaning in at the top, their feet in the pool (review:
    // the first cut's two flat blocks read as a weir, not a falls)
    var shW = W * 0.06, shTop = lipY - H * 0.03, shBot = poolY + H * 0.025, side;
    for (side = -1; side <= 1; side += 2) {
      for (y = shTop; y < shBot; y += 1) {
        var sf = (y - shTop) / (shBot - shTop);
        var bulge = shW * (0.55 + 0.45 * Math.sin(sf * Math.PI)) + Math.sin(y * 0.9 + side) * 1.2;   // widest at the waist
        var inner = W * 0.5 + side * (tw2 - Math.max(0, 0.3 - sf) * shW * 0.6);                    // leans in over the lip
        g.fillStyle = sf < 0.12 ? rockLt : rock;
        if (side < 0) g.fillRect(inner - bulge, y, bulge, 1.2); else g.fillRect(inner, y, bulge, 1.2);
        g.fillStyle = rockDk;                                                                       // the wet shadowed face by the water
        if (side < 0) g.fillRect(inner - 1.5, y, 1.5, 1.2); else g.fillRect(inner, y, 1.5, 1.2);
        if (Math.sin(y * 2.3 + side * 4) > 0.75) { g.fillStyle = rockLt; g.fillRect(inner + side * bulge * 0.5, y, 1.5, 1); }   // a lit fracture
      }
    }
    var wa = (0.9 - night * 0.4).toFixed(2), wb = (0.5 - night * 0.25).toFixed(2);
    for (x = W * 0.5 - tw2; x < W * 0.5 + tw2; x += 1.6) {
      var ridge = Math.sin(x * 0.9 + t * 9) * 0.5 + 0.5;
      g.fillStyle = 'rgba(240,246,250,' + (ridge > 0.5 ? wa : wb) + ')';
      g.fillRect(x, lipY, 1.6, poolY - lipY);
      g.fillStyle = 'rgba(180,205,215,' + wb + ')';
      g.fillRect(x, lipY + ((t * 40 + x * 3) % (poolY - lipY)), 1.6, 2.5);   // the water moving down
    }
    g.fillStyle = 'rgba(200,220,228,' + wb + ')';                       // the lip, where it goes over
    g.fillRect(W * 0.5 - tw2 - 1, lipY - 1.5, tw2 * 2 + 2, 1.5);
    // the plunge pool's foam and the mist standing over it
    for (i = 0; i < 40; i++) {
      var fxp = W * 0.5 + (br() - 0.5) * tw2 * 2.6, fyp = poolY + br() * H * 0.05;
      g.fillStyle = 'rgba(240,246,250,' + (0.5 - br() * 0.3 - night * 0.15).toFixed(2) + ')';
      g.fillRect(fxp + Math.sin(t * 3 + i) * 0.8, fyp, 1.5 + br() * 2, 0.8);
    }
    for (i = 0; i < 24; i++) {
      var mx2 = W * 0.5 + (br() - 0.5) * tw2 * 3, my2 = lipY + br() * (poolY - lipY) - (t * 6 + i * 3) % (H * 0.08);
      g.fillStyle = 'rgba(230,240,246,' + (0.14 - night * 0.08).toFixed(2) + ')';
      g.fillRect(mx2, my2, 2.5, 1);
    }
    // the rapids: the creek widens toward you, white over every rock in it
    var wr = rngFrom(479);
    for (y = poolY; y < H; y += 1) {
      var hw3 = halfAt(y), f = (y - poolY) / (H - poolY);
      g.fillStyle = sceneMix(creek, sky.lake, 0.3 * f);
      g.fillRect(W * 0.5 - hw3, y, hw3 * 2, 1.2);
    }
    for (i = 0; i < 26; i++) {
      var ryy = poolY + H * 0.02 + wr() * (H - poolY - H * 0.04), rhw = halfAt(ryy);
      var rxx = W * 0.5 + (wr() - 0.5) * rhw * 1.7, rs = 1.5 + wr() * 3 * (0.4 + (ryy - poolY) / (H - poolY));
      g.fillStyle = rockDk;
      g.fillRect(rxx - rs, ryy - rs * 0.5, rs * 2, rs);
      g.fillStyle = rockLt;
      g.fillRect(rxx - rs * 0.6, ryy - rs * 0.5, rs * 1.2, rs * 0.4);
      g.fillStyle = 'rgba(240,246,250,' + (0.6 - night * 0.3).toFixed(2) + ')';   // the white pillow below each rock
      g.fillRect(rxx - rs * 1.1 + Math.sin(t * 6 + i) * 0.5, ryy + rs * 0.5, rs * 2.2, 1.4);
    }
    for (y = poolY + 4; y < H; y += 2.5) {                 // the standing waves and the streaks
      var f2 = (y - poolY) / (H - poolY), hw4 = halfAt(y);
      g.fillStyle = 'rgba(220,236,242,' + (0.16 + 0.1 * f2 - night * 0.1).toFixed(2) + ')';
      g.fillRect(W * 0.5 - hw4 + ((Math.sin(y * 0.6 + t * 4) + 1) * 0.5) * hw4 * 1.6, y, 3 + f2 * 6, 0.7);
    }
    // the boardwalk: three planks on two stringers crossing the creek in the
    // foreground, and the pipe — a stub of white plastic in the left bank
    // with the spring running out of it, a thread of clear water
    var plank = sceneMix('#8a7250', '#101418', night * 0.6), plankDk = sceneMix('#5d4632', '#101418', night * 0.6);
    var plankLt = sceneMix('#a8905e', '#101418', night * 0.6);
    for (i = 0; i < 3; i++) {
      var py2 = walkY + i * H * 0.045;
      g.fillStyle = plankDk;
      g.fillRect(0, py2 + H * 0.036, W, H * 0.012);
      g.fillStyle = i % 2 ? plank : plankLt;
      g.fillRect(0, py2, W, H * 0.038);
      for (x = 0; x < W; x += 9) g.fillRect(x, py2 + 1, 0.6, H * 0.03);   // the grain and the nail line
      g.fillStyle = 'rgba(40,30,20,0.5)';
      g.fillRect(W * 0.2, py2 + H * 0.017, 1.2, 1.2); g.fillRect(W * 0.8, py2 + H * 0.017, 1.2, 1.2);
    }
    var pxp = W * 0.5 - halfAt(walkY - H * 0.06) - W * 0.02, pyp = walkY - H * 0.08;
    g.fillStyle = sceneMix('#e6e6e0', '#101418', night * 0.6);
    g.fillRect(pxp - W * 0.03, pyp, W * 0.055, H * 0.022);
    g.fillStyle = sceneMix('#b8b8b4', '#101418', night * 0.6);
    g.fillRect(pxp + W * 0.02, pyp, 1.2, H * 0.022);
    g.fillStyle = 'rgba(30,40,46,0.5)';
    g.fillRect(pxp + W * 0.015, pyp + H * 0.005, 1.6, H * 0.012);          // the dark mouth
    for (y = pyp + H * 0.02; y < walkY - 1; y += 1.2) {                     // the spring, pouring
      var sp2 = (y - pyp) / (walkY - pyp);
      g.fillStyle = 'rgba(220,240,246,' + (0.7 - sp2 * 0.3 - night * 0.3).toFixed(2) + ')';
      g.fillRect(pxp + W * 0.02 + Math.sin(y * 1.2 + t * 8) * 0.4 + sp2 * 1.5, y, 1.2 + sp2 * 1.4, 1.4);
    }
    g.fillStyle = 'rgba(240,246,250,' + (0.45 - night * 0.2).toFixed(2) + ')';   // where it hits the creek
    g.fillRect(pxp + W * 0.005, walkY - 2.4 + Math.sin(t * 5) * 0.4, W * 0.04, 1.4);
  },

  // --- the hidden lookout (note 8) -------------------------------------------
  // The one place you see the park from ABOVE: the granite ledge nobody
  // signposted, the lake laid out below like a map of itself, a canoe the
  // size of a seed crossing it. Static like the cairn — the sky is the hour
  // you arrived, read once from skyAt() so it matches the firewatch's evening.
  lookout: function (g, W, H, t, rnd) {
    var h = hourNow();
    var sky = skyAt(h);
    var night = sky.starA;                    // 0 by day, 1 in the dark
    var skyY = H * 0.40;                      // the sky owns the top two fifths
    var i, r;

    var grad = g.createLinearGradient(0, 0, 0, skyY);
    grad.addColorStop(0, sky.top);
    grad.addColorStop(1, sky.low);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, skyY + 2);
    // the stars take one roll of the instance PRNG whatever the hour, so the
    // ledge below is the same ledge by day and by night
    var starRnd = rngFrom(Math.floor(rnd() * 0x7fffffff));
    if (night > 0.02) {
      g.globalAlpha = night;
      sceneStars(g, W, H, starRnd, 160, skyY * 0.9);
      g.globalAlpha = 1;
    }
    // the sun, low over the ridges by evening — the shimmer follows it
    var glowX = W * 0.56, glowCol = '240,234,210', late = h > 18.2 && h < 19.95;
    if (h >= 5.8 && h < 19.95) {
      var sunP = Math.max(0, Math.min(1, (h - 6) / 13.9));
      var sunX = W * (0.22 + sunP * 0.56);
      var sunY = skyY - Math.max(2, ((19.9 - h) / 13.9) * skyY * 0.85);
      var r0 = Math.min(W, H) * (late ? 0.04 : 0.028);
      if (late) {
        var sg = g.createRadialGradient(sunX, sunY, r0 * 0.4, sunX, sunY, r0 * 4);
        sg.addColorStop(0, 'rgba(242,150,60,0.5)');
        sg.addColorStop(1, 'rgba(242,150,60,0)');
        g.fillStyle = sg;
        g.fillRect(sunX - r0 * 4, sunY - r0 * 4, r0 * 8, r0 * 8);
      }
      g.fillStyle = late ? '#f0a850' : '#f7ecd0';
      g.beginPath();
      g.arc(sunX, sunY, r0, 0, Math.PI * 2);
      g.fill();
      glowX = sunX;
      if (late) glowCol = '240,180,110';
    }

    // three ridgelines, each a shade nearer: haze lifts the far ones toward
    // the sky by day, and the night folds them all into the treeline colour
    var ridge = ['#8ea6c2', '#5c7c9c', '#3a5a76'];
    for (r = 0; r < 3; r++) {
      var rc = sceneMix(sceneMix(ridge[r], sky.low, 0.36 - r * 0.15), sky.tree, night * 0.8);
      sceneTreeline(g, W, H, rngFrom(83 + r * 7), skyY - H * 0.07 + r * H * 0.035, rc, 0.42 + r * 0.16);
    }

    // the basin: forest floor from the near ridge down to the ledge, with a
    // canopy texture of two greens
    var forest = sceneMix('#1f4a2c', sky.tree, night * 0.75);
    var forestLt = sceneMix('#2c6e3f', sky.tree, night * 0.75);
    var ledgeY = H * 0.72;
    g.fillStyle = forest;
    g.fillRect(0, skyY, W, ledgeY - skyY + 2);
    var tex = rngFrom(97);
    for (i = 0; i < 360; i++) {
      g.fillStyle = tex() > 0.5 ? forestLt : sceneMix('#163c20', sky.tree, night * 0.75);
      g.fillRect(tex() * W, skyY + tex() * (ledgeY - skyY), 1.6, 0.9);
    }

    // the lake: a smoothed blob with a shallow rim, two islands, and the
    // shimmer path under whichever light owns the sky
    // rx 0.37, not 0.40: the wobble peaks at 1.24, and the rim (x1.05) of a
    // 0.40 lake ran off the right edge of every phone frame
    var cx = W * 0.5, cy = H * 0.56, rx = W * 0.37, ry = H * 0.13;
    function blob(scale, bcx, bcy, brx, bry, ph) {
      var a;
      g.beginPath();
      for (a = 0; a < Math.PI * 2 + 0.05; a += 0.1) {
        var wob = 1 + 0.12 * Math.sin(a * 3 + 1.1 + ph) + 0.07 * Math.sin(a * 5 + 0.4) + 0.05 * Math.cos(a * 2 + ph);
        var bx = bcx + Math.cos(a) * brx * wob * scale, by = bcy + Math.sin(a) * bry * wob * scale;
        if (a === 0) g.moveTo(bx, by); else g.lineTo(bx, by);
      }
      g.closePath();
      g.fill();
    }
    // a `twin` lookout (pass 4, parks-shape §1.6: Smoke's granite knob) sees
    // TWO basins at once — a tea-brown one above, a blue-green one below,
    // the narrows a thread between them; the canoe crosses the lower one
    var lk = null, li;
    for (li = 0; INSPECTS && li < INSPECTS.length; li++) if (INSPECTS[li].scene === 'lookout') lk = INSPECTS[li];
    var twin = !!(lk && lk.twin), isl;
    if (twin) {
      var tea = sceneMix(sceneMix('#6b4a22', sky.lake, 0.3), sky.lake, night * 0.6);
      var glass = sceneMix(sceneMix('#2f8f8a', sky.lake, 0.4), sky.lake, night * 0.6);
      var nX = W * 0.5 + W * 0.04, nY = cy - ry * 0.55, sX = W * 0.5 - W * 0.03, sY = cy + ry * 0.62;
      g.fillStyle = sceneMix(tea, sky.low, 0.25);
      blob(1.05, nX, nY, rx * 0.86, ry * 0.5, 0.9);
      g.fillStyle = tea;
      blob(1, nX, nY, rx * 0.86, ry * 0.5, 0.9);
      g.fillStyle = sceneMix(glass, sky.low, 0.25);
      blob(1.05, sX, sY, rx * 0.8, ry * 0.46, 2.3);
      g.fillStyle = glass;
      blob(1, sX, sY, rx * 0.8, ry * 0.46, 2.3);
      var ny2;                                // the narrows: a thread of the darker water, kinked once
      for (ny2 = nY + ry * 0.3; ny2 < sY - ry * 0.25; ny2 += 0.8) {
        g.fillStyle = sceneMix(tea, glass, (ny2 - nY) / (sY - nY));
        g.fillRect(W * 0.5 + W * 0.05 + Math.sin((ny2 - nY) * 0.4) * W * 0.012 - 1.2, ny2, 2.4, 1);
      }
      isl = [[sX - rx * 0.25, sY + ry * 0.05, W * 0.035, H * 0.014], [nX + rx * 0.3, nY - ry * 0.05, W * 0.025, H * 0.011]];
      cx = sX; cy = sY; rx = rx * 0.8; ry = ry * 0.46;   // the shimmer and the canoe take the lower basin
    } else {
      g.fillStyle = sceneMix('#2b6b8f', sky.lake, 0.5);
      blob(1.05, cx, cy, rx, ry, 0);
      g.fillStyle = sky.lake;
      blob(1, cx, cy, rx, ry, 0);
      isl = [[W * 0.40, H * 0.545, W * 0.045, H * 0.018], [W * 0.635, H * 0.595, W * 0.03, H * 0.013]];
    }
    for (i = 0; i < 2; i++) {
      // a sand rim, the wooded top, a lighter crown of canopy
      g.fillStyle = sceneMix('#c9b27c', sky.lake, 0.35 + night * 0.5);
      g.beginPath(); g.ellipse(isl[i][0], isl[i][1], isl[i][2] * 1.15, isl[i][3] * 1.25, 0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = forest;
      g.beginPath(); g.ellipse(isl[i][0], isl[i][1] - isl[i][3] * 0.2, isl[i][2], isl[i][3], 0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = forestLt;
      g.beginPath(); g.ellipse(isl[i][0] - isl[i][2] * 0.2, isl[i][1] - isl[i][3] * 0.5, isl[i][2] * 0.45, isl[i][3] * 0.4, 0.3, 0, Math.PI * 2); g.fill();
    }
    var yy;
    for (yy = cy - ry * 0.9; yy < cy + ry * 0.95; yy += 1) {
      var d = (yy - (cy - ry)) / (ry * 2);
      var w2 = 2 + d * 8, wob2 = Math.sin(yy * 0.8 + t * 2) * d * 1.6;
      g.fillStyle = 'rgba(' + glowCol + ',' + (0.05 + 0.12 * (1 - Math.abs(d - 0.5) * 2)).toFixed(3) + ')';
      g.fillRect(glowX - w2 / 2 + wob2, yy, w2, 0.5);
    }

    // the canoe: a red seed crossing the whole lake in a slow minute, its
    // wake a thread behind it
    var cp = (t / 55) % 1;
    var canX = cx - rx * 0.78 + rx * 1.56 * cp;
    var canY = cy + Math.sin(cp * Math.PI * 2) * ry * 0.3;
    g.fillStyle = 'rgba(235,242,248,0.25)';
    g.fillRect(canX - 4, canY + 0.4, 3.2, 0.4);
    g.fillStyle = '#a33e2f';
    g.fillRect(canX - 1, canY - 0.4, 2, 0.9);

    // one hawk soaring the thermal off the ledge, wings held in a shallow V
    var ha = t * 0.45;
    var hx = W * 0.56 + Math.cos(ha) * W * 0.16;
    var hy = H * 0.24 + Math.sin(ha) * H * 0.05 + Math.sin(t * 0.9) * 1.2;
    var bank = Math.cos(ha) * 0.6;
    g.fillStyle = 'rgba(14,18,20,0.85)';
    g.fillRect(hx - 2.8, hy - 0.5 - bank, 2.8, 0.7);
    g.fillRect(hx, hy - 0.5 + bank, 2.8, 0.7);
    g.fillRect(hx - 0.5, hy - 0.2, 1, 1.1);

    // the ledge you stand on: bare granite with an uneven lip, speckled,
    // cracked, a little lichen — dimmed with the rest when the dark comes
    var rock = sceneMix('#6e6e78', '#101418', night * 0.7);
    var rockLt = sceneMix('#8d8d95', '#101418', night * 0.7);
    var rockDk = sceneMix('#4a4a52', '#101418', night * 0.7);
    var x;
    for (x = 0; x < W; x += 3) {
      var top = ledgeY + Math.sin(x * 0.15) * 1.5 + Math.sin(x * 0.53) * 0.8;
      g.fillStyle = rock;
      g.fillRect(x, top, 3, H - top);
      g.fillStyle = rockLt;
      g.fillRect(x, top, 3, 1.4);
    }
    for (i = 0; i < 260; i++) {
      var v = rnd();
      g.fillStyle = v > 0.66 ? rockLt : v > 0.33 ? rockDk : rock;
      g.fillRect(rnd() * W, ledgeY + 2 + rnd() * (H - ledgeY - 2), 1 + rnd() * 2, 0.6 + rnd() * 1.2);
    }
    for (i = 0; i < 3; i++) {
      var cx0 = rnd() * W, cy0 = ledgeY + 3 + rnd() * (H - ledgeY - 6), s;
      g.fillStyle = rockDk;
      for (s = 0; s < 14; s++) g.fillRect(cx0 + s * 1.6 + Math.sin(s) * 0.6, cy0 + Math.sin(s * 0.7) * 2.2, 1.7, 0.7);
    }
    for (i = 0; i < 22; i++) {
      g.fillStyle = 'rgba(140,168,96,' + (0.25 + rnd() * 0.3 - night * 0.2).toFixed(2) + ')';
      g.fillRect(rnd() * W, ledgeY + 2 + rnd() * (H - ledgeY - 2), 1.2 + rnd() * 1.6, 1);
    }

    // the stunted pine that grew out of a crack, its one bough over the
    // lower right — swaying just barely, like every pine in this game
    var bx0 = W * 0.99, by0 = H * 0.93, bx1 = W * 0.78, by1 = H * 0.68;
    var dd;
    var bark = sceneMix('#5d4632', '#101418', night * 0.6);
    g.fillStyle = bark;
    for (dd = 0; dd < 1; dd += 0.03) {
      g.fillRect(bx0 + (bx1 - bx0) * dd - 1.6 + dd, by0 + (by1 - by0) * dd + Math.sin(dd * 4) * 1.2, 3.4 - dd * 1.8, 2.2);
    }
    // a side branch, low and to the left, and the boughs thick on the sunward end
    for (dd = 0; dd < 1; dd += 0.05) {
      g.fillRect(bx0 + (bx1 - bx0) * (0.45 + dd * 0.3), by0 + (by1 - by0) * 0.45 + dd * H * 0.06, 1.6, 1.4);
    }
    var pr = rngFrom(151);
    var needle = sceneMix('#2c6e3f', sky.tree, night * 0.7), needleLt = sceneMix('#3f8a52', sky.tree, night * 0.7);
    var needleDk = sceneMix('#1f5330', sky.tree, night * 0.7);
    for (i = 0; i < 90; i++) {
      var bp = i < 24 ? 0.5 + pr() * 0.3 : 0.4 + pr() * 0.65;
      var nx = bx0 + (bx1 - bx0) * bp + (pr() - 0.5) * W * 0.1;
      var ny = i < 24 ? by0 + (by1 - by0) * 0.45 + pr() * H * 0.07 - 2 : by0 + (by1 - by0) * bp + (pr() - 0.5) * H * 0.075 - 1.5;
      g.fillStyle = i % 4 === 0 ? needleLt : i % 4 === 1 ? needleDk : needle;
      g.fillRect(nx + Math.sin(t * 0.8 + i) * 0.4, ny, 3.4, 1.4);
    }
  },

  // --- the message board at the launch (note 21) ------------------------------
  // The permit board every trip starts under: weathered planks, and pinned
  // to them the park map drawn from the LIVE world — the vistas marked '?'
  // with their names beside them (the hidden one stays hidden), the sites
  // as orange signs, the dock as the white dot you are standing on. Static;
  // the sheet fills whatever frame it is given, phone or PC.
  board: function (g, W, H, t, rnd) {
    var i, y;
    var mn = Math.min(W, H);
    var ink = '#2a2418', paper = '#efe6cf';

    // the planks, grain and knots
    var plankH = Math.max(9, H / 9), pi = 0;
    for (y = 0; y < H; y += plankH, pi++) {
      g.fillStyle = pi % 2 ? '#5f5040' : '#6b5a45';
      g.fillRect(0, y, W, plankH);
      g.fillStyle = 'rgba(30,22,14,0.5)';
      g.fillRect(0, y, W, 0.7);
      var gl;
      for (gl = 0; gl < 7; gl++) {
        var gy = y + 1 + rnd() * (plankH - 2), gx = rnd() * W, gw = 8 + rnd() * W * 0.3;
        g.fillStyle = 'rgba(40,30,20,' + (0.15 + rnd() * 0.25).toFixed(2) + ')';
        g.fillRect(gx, gy, gw, 0.5);
      }
    }
    for (i = 0; i < 8; i++) {
      var kx = rnd() * W, ky = rnd() * H;
      g.fillStyle = '#3f3226';
      g.fillRect(kx - 1.8, ky - 1.2, 3.6, 2.4);
      g.fillStyle = '#54432f';
      g.fillRect(kx - 0.9, ky - 0.5, 1.8, 1);
    }
    // the frame: 2x4s round the edge, weathered silver on the sunny face
    var fr = Math.max(4, mn * 0.035);
    g.fillStyle = '#4d3a28';
    g.fillRect(0, 0, W, fr); g.fillRect(0, H - fr, W, fr);
    g.fillRect(0, 0, fr, H); g.fillRect(W - fr, 0, fr, H);
    g.fillStyle = '#7a6a56';
    g.fillRect(fr * 0.3, fr * 0.3, W - fr * 0.6, 0.8);
    g.fillRect(fr * 0.3, fr * 0.3, 0.8, H - fr * 0.6);

    // the sheet, pinned at its corners, a season of weather on it
    var m = fr + Math.max(4, mn * 0.05);
    var px = m, py = m, pw = W - m * 2, ph = H - m * 2;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(px + 1.2, py + 1.4, pw, ph);
    g.fillStyle = paper;
    g.fillRect(px, py, pw, ph);
    for (i = 0; i < 6; i++) {
      g.fillStyle = 'rgba(150,120,70,' + (0.06 + rnd() * 0.09).toFixed(2) + ')';
      g.fillRect(px + rnd() * pw, py + rnd() * ph, 6 + rnd() * pw * 0.25, 4 + rnd() * ph * 0.12);
    }
    var pins = [[px + 3, py + 3], [px + pw - 3, py + 3], [px + 3, py + ph - 3], [px + pw - 3, py + ph - 3]];
    for (i = 0; i < 4; i++) {
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(pins[i][0] - 1, pins[i][1] - 0.6, 2.6, 2.6);
      g.fillStyle = i === 2 ? '#f2c14b' : '#d94f4f';
      g.fillRect(pins[i][0] - 1.3, pins[i][1] - 1.3, 2.6, 2.6);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(pins[i][0] - 1, pins[i][1] - 1, 0.8, 0.8);
    }

    // the hand-lettered title: one line when it fits, else the park over
    // the access point
    function ink2(str, x, yy, size, col, align) {
      g.font = journalFont(size);
      g.textAlign = align || 'left';
      g.textBaseline = 'top';
      g.fillStyle = col;
      g.fillText(str, x, yy);
    }
    function widthOf(str, size) { g.font = journalFont(size); return g.measureText(str).width; }
    var access = PARK && PARK.access ? PARK.access.name : '';
    var title = 'ALGONQUIN PARK — ' + access;
    var maxW = pw - 10, ts = 9;
    while (widthOf(title, ts) > maxW && ts > 6.5) ts -= 0.5;
    var ty = py + 4, titleH;
    if (widthOf(title, ts) <= maxW) {
      ink2(title, px + pw / 2, ty, ts, ink, 'center');
      titleH = ts + 5;
    } else {
      ts = 8;
      while (widthOf(access, ts - 1.5) > maxW && ts > 6) ts -= 0.5;
      ink2('ALGONQUIN PARK', px + pw / 2, ty, ts, ink, 'center');
      ink2(access, px + pw / 2, ty + ts + 2, ts - 1.5, ink, 'center');
      titleH = ts * 2 + 5;
    }
    // the rule under it, in the same hand
    g.fillStyle = 'rgba(42,36,24,0.6)';
    g.fillRect(px + 6, ty + titleH - 1, pw - 12, 0.6);

    // two lines of park etiquette in small type at the foot — wrapped for
    // the sheet's width, so a phone reads them as three or four
    var rules = ['No cans or bottles in the interior. Pack out everything you pack in.',
                 'Fires in the ring only. Camp on marked sites. Give the wildlife the shore.'];
    var es = 5, lines = [], li;
    rules.forEach(function (rl) { lines = lines.concat(wrapText(rl, pw - 10, es, journalFont(es))); });
    if (lines.length > 4) {
      es = 4.2; lines = [];
      rules.forEach(function (rl) { lines = lines.concat(wrapText(rl, pw - 10, es, journalFont(es))); });
    }
    var eh = lines.length * (es + 1.6) + 3;
    for (li = 0; li < lines.length; li++) {
      ink2(lines[li], px + pw / 2, py + ph - eh + li * (es + 1.6), es, ink, 'center');
    }

    // the map, from the live terrain — the way the map screen blits it —
    // washed toward the paper so it reads as printed, not as the world
    var mapTop = ty + titleH + 2, mapBot = py + ph - eh - 3;
    var availW = pw - 8, availH = Math.max(10, mapBot - mapTop);
    var sc = Math.min(availW / WORLD.W, availH / WORLD.H);
    var mw = WORLD.W * sc, mh = WORLD.H * sc;
    var mx = px + (pw - mw) / 2, my = mapTop + (availH - mh) / 2;
    if (typeof R !== 'undefined' && R.terrain) {
      g.drawImage(R.terrain, 0, 0, WORLD.W * RES, WORLD.H * RES, mx, my, mw, mh);
    } else {
      // no baked terrain (should not happen after loadPark): the lake polygons
      g.fillStyle = '#c9bc98';
      g.fillRect(mx, my, mw, mh);
      g.fillStyle = '#5f86a8';
      LAKE_POLYS.forEach(function (l) {
        var k;
        g.beginPath();
        for (k = 0; k < l.poly.length; k++) {
          if (k === 0) g.moveTo(mx + l.poly[k][0] * sc, my + l.poly[k][1] * sc);
          else g.lineTo(mx + l.poly[k][0] * sc, my + l.poly[k][1] * sc);
        }
        g.closePath();
        g.fill();
      });
    }
    g.fillStyle = 'rgba(239,230,207,0.22)';
    g.fillRect(mx, my, mw, mh);
    g.fillStyle = ink;
    g.fillRect(mx - 0.6, my - 0.6, mw + 1.2, 0.6); g.fillRect(mx - 0.6, my + mh, mw + 1.2, 0.6);
    g.fillRect(mx - 0.6, my - 0.6, 0.6, mh + 1.2); g.fillRect(mx + mw, my - 0.6, 0.6, mh + 1.2);

    // the sites: orange signs; the launch: the white dot under your feet
    CAMPSITES.forEach(function (c) {
      var sx2 = mx + c.x * sc, sy2 = my + c.y * sc;
      g.fillStyle = ink;
      g.fillRect(sx2 - 1.7, sy2 - 1.7, 3.4, 3.4);
      g.fillStyle = '#e2731f';
      g.fillRect(sx2 - 1.1, sy2 - 1.1, 2.2, 2.2);
    });
    if (POIS && POIS.dock) {
      var dx = mx + POIS.dock.x * sc, dy = my + POIS.dock.y * sc;
      g.fillStyle = ink;
      g.fillRect(dx - 1.9, dy - 1.9, 3.8, 3.8);
      g.fillStyle = '#f2f2e8';
      g.fillRect(dx - 1.2, dy - 1.2, 2.4, 2.4);
    }
    // the vistas: a gold '?' each, the name beside it — to the left when the
    // sheet's edge is close; the hidden lookout is not on anybody's board,
    // and the board's own `info` inspect does not mark itself as a vista
    var qs = 7, ns = 4.5;
    INSPECTS.forEach(function (p) {
      if (p.hidden || p.info) return;
      var vx = mx + p.x * sc, vy = my + p.y * sc;
      ink2('?', vx + 0.5, vy - qs * 0.55 + 0.5, qs, ink, 'center');
      ink2('?', vx, vy - qs * 0.55, qs, '#f2c14b', 'center');
      var name = p.name || p.scene;
      var nw = widthOf(name, ns);
      var right = vx + 4 + nw <= px + pw - 3;
      g.fillStyle = 'rgba(239,230,207,0.7)';
      g.fillRect(right ? vx + 3.5 : vx - 3.5 - nw, vy - ns * 0.6, nw + 1, ns + 1.2);
      ink2(name, right ? vx + 4 : vx - 4, vy - ns * 0.5, ns, ink, right ? 'left' : 'right');
    });
  },

  // --- sitting with the fire (#6, #7) ---------------------------------------
  // The one scene that runs on the game clock: sky, sun, moon and stars are
  // read from hourNow() every frame, so a sunset happens WHILE you watch.
  firewatch: function (g, W, H, t, rnd) {
    var h = hourNow();
    var horizon = H * 0.52;

    // the sky keyframes live in FW_SKY / skyAt() above, shared with the lookout
    // distant wildlife schedule (#4) — consume rnd() a fixed number of
    // times BEFORE anything conditional touches the stream
    var wild = [];
    var we;
    for (we = 0; we < 12; we++) {
      wild.push({
        type: rnd(),
        start: 8 + we * 11 + rnd() * 7,
        lane: rnd(),
        dir: rnd() < 0.5 ? 1 : -1,
      });
    }
    var jumps = [];
    var jj;
    for (jj = 0; jj < 10; jj++) {
      jumps.push({ start: 5 + jj * 13 + rnd() * 9, x: rnd(), lane: rnd() });
    }

    var sky = skyAt(h);
    var top = sky.top, low = sky.low, lake = sky.lake, tree = sky.tree, starA = sky.starA;

    var grad = g.createLinearGradient(0, 0, 0, horizon);
    grad.addColorStop(0, top);
    grad.addColorStop(1, low);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, horizon + 2);

    if (starA > 0.02) {
      g.globalAlpha = starA;
      sceneStars(g, W, H, rnd, 220, horizon * 0.96);
      g.globalAlpha = 1;
    }

    // the sun: crosses and sinks; at the right hour you catch it touching
    // the treeline across the lake
    var glowX = null, glowCol = null;
    if (h < 19.95) {
      var sunP = Math.max(0, Math.min(1, (h - 6) / 13.9));
      var sunX = W * (0.26 + sunP * 0.46);
      var sunY = horizon - Math.max(1.5, ((19.9 - h) / 13.9) * H * 0.42);
      var late = h > 18.2;
      var r0 = late ? Math.min(W, H) * 0.055 : Math.min(W, H) * 0.035;
      if (late) {
        var sg = g.createRadialGradient(sunX, sunY, r0 * 0.4, sunX, sunY, r0 * 4);
        sg.addColorStop(0, 'rgba(242,150,60,0.5)');
        sg.addColorStop(1, 'rgba(242,150,60,0)');
        g.fillStyle = sg;
        g.fillRect(sunX - r0 * 4, sunY - r0 * 4, r0 * 8, r0 * 8);
      }
      g.fillStyle = late ? '#f0a850' : '#f7ecd0';
      g.beginPath();
      g.arc(sunX, sunY, r0, 0, Math.PI * 2);
      g.fill();
      glowX = sunX; glowCol = late ? '240,180,110' : '240,236,210';
    }

    // the moon climbs and crosses the evening sky, slowly — a solid thing
    // at integer pixels, drawn once and blitted, so it neither flickers nor
    // lets the stars shine through it (#7)
    if (h >= 19.7 || h < 5) {
      var hm = h < 5 ? h + 24 : h;
      var mp = Math.max(0, Math.min(1, (hm - 19.7) / 4.2));
      var mx = Math.round(W * (0.14 + 0.66 * mp));
      var my = Math.round(horizon - H * (0.1 + 0.27 * Math.sin(mp * Math.PI)));
      var mr = Math.max(3, Math.round(Math.min(W, H) * 0.05));
      if (!fwMoonCanvas || fwMoonR !== mr) buildFwMoon(mr);
      g.globalAlpha = Math.min(1, starA * 2 + 0.35);   // dusk ghost, night rock
      g.drawImage(fwMoonCanvas, mx - mr - 1, my - mr - 1);
      g.globalAlpha = 1;
      if (starA > 0.1) { glowX = mx; glowCol = '240,234,210'; }
    }

    // the far shore, then the lake over its skirt
    sceneTreeline(g, W, H, rngFrom(67), horizon, tree);
    g.fillStyle = lake;
    g.fillRect(0, horizon + 3.5, W, H - horizon - 3.5);

    // shimmer path under whichever light owns the sky
    if (glowX !== null) {
      var yy2;
      for (yy2 = horizon + 4; yy2 < H * 0.82; yy2 += 1) {
        var wob = Math.sin(yy2 * 0.8 + t * 2) * (yy2 - horizon) * 0.1;
        var w2 = 3 + (yy2 - horizon) * 0.3;
        g.fillStyle = 'rgba(' + glowCol + ',' + Math.max(0.02, 0.14 - (yy2 - horizon) / H * 0.2).toFixed(3) + ')';
        g.fillRect(glowX - w2 / 2 + wob, yy2, w2, 0.5);
      }
    }
    // something alive, far off (#4): a loon working the bay, a heron over
    // the far shore, a moose at the waterline — small, dark, unbothered
    drawFwWildlife(g, W, H, horizon, t, wild);
    drawFwFish(g, W, H, horizon, t, jumps);
    drawFwVisitor(g, W, H, horizon, t);

    // lap lines, catching whatever light there is
    var li;
    for (li = 0; li < 24; li++) {
      var lh = (li * 2654435761) >>> 0;
      var lx = lh % W, ly2 = horizon + 5 + (lh >>> 8) % Math.max(4, (H * 0.28) | 0);
      if (Math.sin(t * 1.3 + li) > 0.25) {
        g.fillStyle = 'rgba(235,242,248,0.3)';
        g.fillRect(lx, ly2, 5, 0.6);
      }
    }

    // the caption keeps the scene's own time — sitting long enough to cross
    // an hour should not leave last hour's words on screen
    if (S.scene && performance.now() >= (S.scene.capHold || 0)) {
      var fireAlive = S.campSession && S.campSession.chores.fire;
      var newCap = h >= 20.3 ? (fireAlive ? 'Sparks climb. The stars hold still.'
                                          : 'The stars hold still over a dark shore.')
        : h >= 18.6 ? 'The sun leans on the far treeline. Stay for this.'
        : 'The lake breathes. You match it.';
      if (newCap !== S.scene.caption) {
        S.scene.caption = newCap;
        S.scene.capT = performance.now();
      }
    }

    // the near ground you sit on
    g.fillStyle = '#0c1410';
    g.fillRect(0, H * 0.82, W, H * 0.18);
    var gi;
    for (gi = 0; gi < 40; gi++) {
      var gh2 = (gi * 340573321) >>> 0;
      g.fillStyle = gh2 % 2 ? '#132018' : '#0a100c';
      g.fillRect(gh2 % W, H * 0.82 + (gh2 >>> 6) % ((H * 0.16) | 0), 2, 1);
    }

    // the fire — sized by its FUEL (the tending minigame), embers when it
    // is nearly out, or the cold ring waiting for six fresh logs
    var lit = S.campSession && S.campSession.chores.fire;
    var fuel = S.campSession ? (S.campSession.fireFuel || 0) : 5;
    // Evrtek's play note (2026-09-04): "the fire should get larger with each
    // wood added — the difference is not noticeable." It was not: the old
    // `ff = 0.45 + fuel*0.11` moved a H*0.055 flame from 5 units to 13 over
    // ten logs, under an unchanging log pile. The burn/fuel logic in camp.js
    // is untouched; what changed is that FOUR things now step off a quantized
    // fuelStep, so a log is a step a thumb can see — 2 logs a low fire, 6 a
    // proper campfire, 12 a bonfire.
    var fuelStep = Math.max(0, Math.min(12, Math.ceil(fuel)));
    var embers = lit && fuel <= 0.15;
    var fx2 = W * 0.5, fy2 = H * 0.86;
    // the ring
    var si;
    for (si = 0; si < 9; si++) {
      var sa = (si / 9) * Math.PI * 2;
      g.fillStyle = si % 2 ? '#6e6e78' : '#4a4a52';
      g.fillRect(fx2 + Math.cos(sa) * W * 0.06 - 1.2, fy2 + Math.sin(sa) * H * 0.02 + 2 - 0.8, 2.6, 1.8);
    }
    if (embers) {
      // a bed of coals pulsing under ash — the warning made visible
      g.fillStyle = '#3a2c1e';
      g.fillRect(fx2 - 7, fy2 + 1, 14, 2.2);
      var eb;
      for (eb = 0; eb < 7; eb++) {
        var ebh = (eb * 340573321) >>> 0;
        var pulse = 0.25 + 0.2 * Math.sin(t * 2.4 + eb * 1.7);
        g.fillStyle = 'rgba(232,110,40,' + pulse.toFixed(2) + ')';
        g.fillRect(fx2 - 5 + (ebh % 10), fy2 + (ebh >>> 4) % 2, 1.4, 0.9);
      }
    } else if (lit) {
      // (1) the log pile — the first six logs each land as their own log in a
      // texel pyramid, so the BASE of the fire grows too, not just the flame;
      // past six the pile holds and the flame carries the growth
      var nlog = Math.max(1, Math.min(6, fuelStep));
      var lgX = [-5.2, 0, 5.2, -2.6, 2.6, 0];
      var lgY = [1, 1, 1, -1.1, -1.1, -3.2];
      var lg;
      for (lg = 0; lg < nlog; lg++) {
        g.fillStyle = '#3a2c1e';
        g.fillRect(fx2 + lgX[lg] - 2.6, fy2 + lgY[lg], 5.2, 2.2);
        g.fillStyle = lg % 2 ? '#5d4632' : '#463526';
        g.fillRect(fx2 + lgX[lg] - 2.6, fy2 + lgY[lg], 5.2, 0.8);
      }
      // the flame's own ground line — FIXED, not the pyramid's top. Evrtek's
      // play note (2026-09-04): the bottom of the flame used to ride the top
      // log, so burning a pile down slid the whole fire a pixel at a time.
      // fy2 + 3.2 is the foot of the bottom log row (lgY 1 + a 2.2 log) and
      // the ember bed's own line, inside the ring's front stones: the pile
      // shrinks underneath the flames, the flames stay put.
      var fireBase = fy2 + 3.2;
      // (2) the flame body — three nested tongues whose height and width come
      // straight off fuelStep: H*(0.05 + step*0.013) tall, min(W,H)*(0.05 +
      // step*0.008) wide. At 240x135 that is 10 / 17 / 28 units of flame at
      // 2 / 6 / 12 logs; at 188x406 it is 31 / 52 / 84. Each tongue breathes
      // at its own speed (the fast flicker, 0.2-0.6 s).
      var halfW = Math.min(W, H) * (0.05 + fuelStep * 0.008) * 0.5;
      // …capped at 2.2x its own width so a tall portrait gets a bonfire and
      // not a rocket (188x406 would otherwise put an 84-unit flame on a
      // 27-unit base); the cap never bites in landscape.
      var flameH = Math.min(H * (0.05 + fuelStep * 0.013), halfW * 4.4);
      var fcol = ['#e8842a', '#f2c14b', '#f2f2e8'];
      var fwk = [1, 0.62, 0.3], fhk = [1, 0.74, 0.44];
      var fl;
      for (fl = 0; fl < 3; fl++) {
        var fw = halfW * fwk[fl];
        var fh = flameH * fhk[fl] * (0.88 + 0.12 * Math.sin(t * (5 + fl * 2.3) + fl * 2));
        var lean = Math.sin(t * (2.2 + fl) + fl) * (1.2 + halfW * 0.12);
        g.fillStyle = fcol[fl];
        g.beginPath();
        g.moveTo(fx2 - fw, fireBase);
        g.quadraticCurveTo(fx2 + lean, fireBase - fh, fx2 + fw, fireBase);
        g.fill();
      }
      // (3) sparks — 3 + one per log, thrown as high as the flame is tall
      var sk, nsk = 3 + fuelStep, span = flameH * 1.5 + H * 0.03;
      for (sk = 0; sk < nsk; sk++) {
        var skh = (sk * 2654435761) >>> 0;
        var rise = (t * (14 + (skh % 7)) + sk * 11) % span;
        var alpha = Math.max(0, 1 - rise / span);
        g.fillStyle = 'rgba(242,193,75,' + (alpha * 0.8).toFixed(2) + ')';
        g.fillRect(fx2 + Math.sin(rise * 0.3 + sk) * 4, fireBase - flameH * 0.55 - rise, 0.7, 0.7);
      }
      // (4) the glow the fire throws on everything — radius and strength on
      // the same step, so the shore lights up log by log. Kept as the
      // baseline's radial gradient (idiom rule 4: it was already one, and
      // dithered rings would not pay for themselves inside the cost line).
      var gr = H * (0.12 + fuelStep * 0.015);
      var ga = 0.13 + fuelStep * 0.012 + 0.03 * Math.sin(t * 5);
      var fg2 = g.createRadialGradient(fx2, fy2, 2, fx2, fy2, gr);
      fg2.addColorStop(0, 'rgba(242,160,60,' + ga.toFixed(3) + ')');
      fg2.addColorStop(1, 'rgba(242,160,60,0)');
      g.fillStyle = fg2;
      g.fillRect(fx2 - gr, fy2 - gr, gr * 2, gr * 2);
    }
  },
  // --- Highway 60: the drive to the launch (v0.9.0 park shelf) ---------------
  // Not a view the player looks up at — a STRIP along the foot of the park
  // shelf, painted into the framebuffer before present() while the cards sit
  // crisp above it in the UI pass. `top`/`h` bound the strip; a caller that
  // omits them (the harness's screens pass) gets the shelf's own clamp at the
  // bottom of the screen. Layers back to front: day sky, a far ridge drifting
  // at 14 u/s, the lake glimpsed through a gap in the near trees every ~14 s,
  // the near treeline at 30 u/s, a granite rock cut and gravel shoulder,
  // asphalt with gold centre dashes at 64 u/s, brown pictorial signboards
  // (no numerals — the real km posts are a fact this scenery does not
  // claim), and the car fixed at W*0.35 with the red canoe hull-up on the
  // rack, everything streaming LEFT so the car travels EAST: the cards' own
  // west->east order. Every motion is a function of t alone — no t0, no
  // state: a shelf frame writes nothing (the v0.8.0 HIGH bug stays fixed).
  // Sprites: carSide1/2, canoeRoof and hwySign are dereferenced outright —
  // the pass-6 stand-in guards came out once the maps landed, and
  // sprite-lint holds all four to their dims.
  highway60: function (g, W, H, t, rnd, top, h) {
    if (h === undefined) {
      h = Math.max(44, Math.min(72, Math.round(H * 0.18)));
      top = H - h;
      g.fillStyle = '#8fb6d8';
      g.fillRect(0, 0, W, H);
    }
    var sc = h / 72;                         // 72 is the tall strip, 44 the short one
    var yFar = top + h * 0.36, yNear = top + h * 0.5;
    var yGrav = top + h * 0.57, yAsp = top + h * 0.6, rh = h - h * 0.6;
    var farOff = (t * 14) % W, nearOff = (t * 30) % W, ws = t * 30;
    var i, k, n;
    var hash = function (v) { var s = Math.sin(v * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
    // a tile painted twice, `off` units left, so a W-wide pattern wraps
    var twice = function (off, paint) {
      g.save(); g.translate(-off, 0); paint(); g.translate(W, 0); paint(); g.restore();
    };

    g.save();
    g.beginPath();
    g.rect(0, top, W, h);
    g.clip();

    // the sky (the cairn scene's day)
    var grad = g.createLinearGradient(0, top, 0, top + h * 0.5);
    grad.addColorStop(0, '#8fb6d8');
    grad.addColorStop(1, '#cfe0e8');
    g.fillStyle = grad;
    g.fillRect(0, top, W, h);

    // the far ridge, hazed, drifting
    twice(farOff, function () { sceneTreeline(g, W, H, rngFrom(601), yFar, '#3f6e58', sc * 0.48); });

    // the gap in the near trees, every 14 s (420 units at 30 u/s): the lake
    // shows through it, and only through it
    var gapW = Math.min(W * 0.55, 170), gapP = 420, gaps = [];
    for (k = Math.floor((ws - W - gapW) / gapP); k <= Math.floor(ws / gapP); k++) {
      var gx = W + k * gapP - ws;
      if (gx < W && gx + gapW > 0) gaps.push(gx);
    }
    if (gaps.length) {
      g.save();
      g.beginPath();
      for (k = 0; k < gaps.length; k++) g.rect(gaps[k], top, gapW, h);
      g.clip();
      g.fillStyle = PAL.water;
      g.fillRect(0, yFar + h * 0.025, W, yNear - yFar - h * 0.025);
      g.fillStyle = PAL.ripple;
      for (i = 0; i < 9; i++) {
        if (Math.sin(t * 3 + i * 1.7) < 0.2) continue;
        var spx = ((hash(i + 1) * W - t * 22) % W + W) % W;
        g.fillRect(spx, yFar + h * 0.05 + hash(i + 40) * (yNear - yFar - h * 0.09), 2 * sc + 0.5, 0.5);
      }
      g.fillStyle = PAL.sand;                // the far shore
      g.fillRect(0, yNear - 0.8 * sc - 0.3, W, 0.8 * sc + 0.3);
      g.restore();
    }

    // the near treeline, parted at the gap
    g.save();
    g.beginPath();
    g.rect(0, top, W, h);
    for (k = 0; k < gaps.length; k++) g.rect(gaps[k], top, gapW, h);
    g.clip('evenodd');
    twice(nearOff, function () { sceneTreeline(g, W, H, rngFrom(607), yNear, '#1f4a2c', sc * 0.66); });
    g.restore();
    // the gap feathers instead of ending square (the pass-6 soft spot: one
    // unbroken bar of water with vertical cut edges): two short bands of
    // lower, thinner trees just inside each edge, and behind the water a low
    // far-shore treeline sitting on the waterline, both scrolling with the
    // gap so the opening tapers as it passes
    if (gaps.length) {
      var fw = gapW * 0.16;
      g.save();
      g.beginPath();
      for (k = 0; k < gaps.length; k++) g.rect(gaps[k], top, gapW, yFar + h * 0.025 - top);
      g.clip();
      twice(farOff, function () { sceneTreeline(g, W, H, rngFrom(611), yFar + h * 0.025, '#4c7a62', sc * 0.22); });
      g.restore();
      g.save();
      g.beginPath();
      for (k = 0; k < gaps.length; k++) { g.rect(gaps[k], top, fw, h); g.rect(gaps[k] + gapW - fw, top, fw, h); }
      g.clip();
      twice(nearOff, function () { sceneTreeline(g, W, H, rngFrom(613), yNear, '#1f4a2c', sc * 0.4); });
      g.restore();
    }

    // the rock cut: two courses of blasted granite, then the gravel shoulder
    g.fillStyle = PAL.rockDk;
    g.fillRect(0, yNear, W, yGrav - yNear);
    var rowH = (yGrav - yNear) / 2, r;
    for (r = 0; r < 2; r++) {
      for (n = Math.floor(ws / 6) - 1; n * 6 - ws < W; n++) {
        var bx = n * 6 - ws + (r ? 3 : 0), hv = hash(n * 2 + r + 300);
        g.fillStyle = hv > 0.6 ? PAL.rock : hv > 0.3 ? '#9a8489' : PAL.rockDk;
        g.fillRect(bx, yNear + r * rowH, 5.4, rowH - 0.4);
      }
    }
    g.fillStyle = PAL.sandDk;
    g.fillRect(0, yGrav, W, yAsp - yGrav);
    g.fillStyle = PAL.trailDk;
    for (n = Math.floor(ws / 5); n * 5 - ws < W; n++) {
      if (hash(n + 500) > 0.5) g.fillRect(n * 5 - ws + hash(n + 520) * 3, yGrav + hash(n + 540) * (yAsp - yGrav - 0.5), 0.8, 0.5);
    }

    // the asphalt, the fog line, the gold centre dashes (8 on / 12 off)
    g.fillStyle = '#4a4a52';
    g.fillRect(0, yAsp, W, rh);
    g.fillStyle = 'rgba(240,240,232,0.65)';
    g.fillRect(0, yAsp + 0.6 * sc, W, 0.5);
    g.fillStyle = PAL.gold;
    var yc = yAsp + rh * 0.4, dx;
    for (dx = -((t * 64) % 20); dx < W; dx += 20) g.fillRect(dx, yc, 8, 0.9);
    g.fillStyle = PAL.sandDk;                // the near shoulder, along the bottom edge
    g.fillRect(0, top + h - 1.4 * sc, W, 1.4 * sc);

    // signboards on posts, riding the near layer: brown, white-edged, blank —
    // no numerals (the true markers are 14.1 and 40.3; a sign this small
    // cannot carry them honestly, so it carries nothing)
    var sgnP = 270, baseY = yAsp + 0.4;
    var ss = SPRITES.hwySign, sdw = ss.width / RES, sdh = ss.height / RES;
    for (k = Math.floor((ws - W - 20) / sgnP); k <= Math.floor(ws / sgnP) + 1; k++) {
      if (hash(k + 100) < 0.35) continue;    // occasional, not a picket line
      var sgx = W * 0.8 + k * sgnP - ws;
      if (sgx < -20 || sgx > W + 20) continue;
      g.drawImage(ss, sgx - sdw / 2, baseY - sdh, sdw, sdh);
    }

    // the car, fixed on the near lane, wheels on the asphalt; the road does the moving
    var cx = W * 0.35, bob = Math.sin(t * 11) * 0.35;
    var frame = Math.floor(t * 1000 / 90) % 2;
    var yWheel = yAsp + rh * 0.8;
    var car = frame ? SPRITES.carSide2 : SPRITES.carSide1;
    var cw = car.width / RES, ch2 = car.height / RES;
    var cxL = cx - cw / 2, cyT = yWheel - ch2;
    // dust off the rear wheel (the west side: the car faces east)
    var fl = Math.floor(t * 12);
    for (i = 0; i < 6; i++) {
      var pa = 0.34 - i * 0.05, ps = 1.7 - i * 0.2;
      g.fillStyle = 'rgba(210,200,178,' + pa.toFixed(2) + ')';
      g.fillRect(cxL + 1 - i * 1.7 - hash(fl + i * 3) * 1.4, yWheel - 0.4 - hash(fl * 7 + i) * 2.2 - i * 0.35, ps, ps * 0.7);
    }
    g.drawImage(car, cxL, cyT + bob, cw, ch2);
    // the red canoe hull-up on the rack: the map's last two rows are the
    // strap ends beside the car, so its gunwale row lands on the sprite's
    // rack towers
    var cr = SPRITES.canoeRoof, crw = cr.width / RES, crh = cr.height / RES;
    g.drawImage(cr, cx - crw / 2, cyT + bob + 1 - crh, crw, crh);

    g.restore();
  },
};

// ============================================================================
// TITLE SCREEN — Yori, draft 3 (2026-09-02), approved by Evrtek 2026-09-04;
// draft 4 (2026-09-04) answers his three play-test notes (still frame, scale,
// the river's curve); draft 5 (2026-09-04) freezes one paddle stroke, blade
// in the water, for his fourth note. Installed verbatim from
// creative/drafts/paddlers-title/title-painter.js.
// Registered after the literal above because it ASSIGNS onto SCENE_PAINTERS.
// ============================================================================

// PADDLER'S PARADISE — TITLE PAINTER
// Yori, draft 6 — the blade, 2026-09-04 (draft 5 the same day froze the
// stroke on Evrtek's note; draft 4 answered his three play-test notes; draft
// 3 was 2026-09-02).
// Drops into js/scenes.js beside the others as SCENE_PAINTERS.title. The
// poster: a paddler mid-stroke on the water at dusk, seen from behind, the river
// winding away to the left and narrowing back toward the last of the light —
// dusk sky, tall spruce banks, one red canoe (the eye goes to it; the game's
// own trick). Nothing traced, nothing borrowed; every shape is arithmetic.
//
// Contract (per the brief): (g, W, H, t, rnd) — g already under the game's 2x
// transform, W/H the screen in art units, t seconds since the screen opened,
// rnd a PRNG re-seeded every frame. Fills any aspect from W/H fractions.
// Budget: it is a STILL. Everything — sky, hills, banks, water, canoe and
// paddler — is painted ONCE per screen size into an offscreen texel canvas
// (titleBg) and blitted each frame; per frame only a slow, three-step shimmer
// on the sun's path. Nothing here writes game state. No helper outside this
// file is required.
//
// Draft 4, against draft 3: (1) no paddle stroke, wake, birds or breathing
// sun — the paddle rests across the gunwales, both hands on it, the canoe
// drifting; (2) the canoe is a fifth smaller and the bank spruces about
// twice as tall, near ones dark and towering, far ones short and hazy, so a
// person in a canoe reads as small against the forest; (3) each bank is one
// smooth curve (titleRiver) — the river bends left through the middle
// distance, narrows, comes back under the sun and slips behind the far
// shore; the sand, the tree bases and the light on the water all follow it.
//
// Draft 5, against draft 4: the paddle no longer rests across the gunwales.
// One stroke is frozen mid-pull on the paddler's right — top hand raised
// beside the head on the grip, lower hand on the shaft over the gunwale,
// the shaft painted BEFORE the body so the torso and head hide the stretch
// that crosses in front of them, and the blade standing in the open water
// beside the hull, tinted where it is under, a ring where it went in. Still
// paint, all of it; nothing else in draft 4 moved.
//
// Draft 6, against draft 5 (the reviewers' note: the business end read as a
// landing net at phone scale — a closed pale ring with a grey bag under it):
// the blade is a real blade, a broad leaf three shafts wide met by the shaft
// at a throat above the water, its upper half dry and lit along the sun
// side, its lower half the same leaf seen through the river; the entry is
// an open splash — an arc on the far side, two streaks — and never a ring;
// and the raised arm is a whole arm, shoulder to elbow-out to grip, in a
// sleeve one shade lighter than the jacket. Blade, entry, arm; nothing else.
//
// Layout the picture leaves for the UI pass: the sky (top 40%) is calm for
// the title, subtitle, tagline and — on tall screens — the hint lines; on
// wide screens the near-left bank (bottom-left, dark spruce) takes the
// hints; the pill's row at ~84% is quiet water behind the canoe.

var titleBg = { key: '', canvas: null };

function titleRng(seed) {                     // same mulberry32 as rngFrom, kept local
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function titleRGB(c) {
  if (c.charAt(0) === '#') { var v = parseInt(c.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  var m = /(\d+)\D+(\d+)\D+(\d+)/.exec(c); return [+m[1], +m[2], +m[3]];
}
function titleMix(c1, c2, u) {
  var a = titleRGB(c1), b = titleRGB(c2);
  return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * u) + ',' + Math.round(a[1] + (b[1] - a[1]) * u) + ',' + Math.round(a[2] + (b[2] - a[2]) * u) + ')';
}
function titleAt(stops, u) {                  // piecewise colour ramp, u in 0..1
  var i;
  if (u <= stops[0][0]) return stops[0][1];
  for (i = 0; i < stops.length - 1; i++) {
    if (u >= stops[i][0] && u <= stops[i + 1][0]) {
      return titleMix(stops[i][1], stops[i + 1][1], (u - stops[i][0]) / (stops[i + 1][0] - stops[i][0]));
    }
  }
  return stops[stops.length - 1][1];
}
function titleGeo(W, H) {
  var S = Math.min(W, H);
  var HZ = Math.round(H * 0.40);              // the far water line
  var VPX = W * 0.60;                         // the sun's notch; the river ends under it
  return {
    W: W, H: H, S: S, HZ: HZ, VPX: VPX,
    yFar: HZ + H * 0.014,                     // where the river slips behind the far shore
    yNear: H + 2,
    L: Math.min(S * 0.36, H * 0.28) * 0.8,    // the canoe's length on screen (draft 4: a fifth smaller)
    stern: H * 0.74,
    TR: Math.max(H, S * 1.3),                 // spruce heights scale on this, so wide screens keep a forest
  };
}
function titleGeoFull(W, H) {                 // geo plus the canoe's place: midway on the river between bow and stern
  var geo = titleGeo(W, H), us = titleRiverU(geo, geo.stern), ub = titleRiverU(geo, geo.stern - geo.L);
  geo.cx = (titleRiver(geo, us).x + titleRiver(geo, ub).x) / 2;
  return geo;
}
function titleRiverU(geo, y) { return (y - geo.yNear) / (geo.yFar - geo.yNear); }
// the river as one smooth curve. At far-ness u (0 the bottom of the screen,
// 1 the far shore): the centre line, the half width and the row on screen.
// The centre swings left through the middle distance and comes back under
// the sun; the width falls off faster than straight perspective, so the near
// banks bow open around the viewer instead of running straight to a point.
function titleRiver(geo, u) {
  var W = geo.W;
  var c = W * (0.5 - 0.14 * Math.sin(Math.PI * Math.pow(u, 2.2))) + (geo.VPX - W * 0.5) * u * u * u * u;
  var hw = W * (0.03 + 0.54 * Math.pow(1 - u, 1.6));
  return { x: c, hw: hw, y: geo.yNear + (geo.yFar - geo.yNear) * u, l: c - hw, r: c + hw };
}
function titleRiverPath(b, geo) {             // the water's outline, both banks, 40 steps a side
  var i, p;
  b.beginPath();
  for (i = 0; i <= 40; i++) { p = titleRiver(geo, i / 40); if (i === 0) b.moveTo(p.l, p.y); else b.lineTo(p.l, p.y); }
  for (i = 40; i >= 0; i--) { p = titleRiver(geo, i / 40); b.lineTo(p.r, p.y); }
  b.closePath();
}

// --- the still picture, painted once -----------------------------------------

// vertical colour bands with a 2x2-texel checker at every seam: low-bit sky
// and water, no "modern" gradient
function titleBands(b, x0, y0, W, hgt, stops, n) {
  var i, prev = null;
  for (i = 0; i < n; i++) {
    var ya = y0 + hgt * i / n, yb = y0 + hgt * (i + 1) / n;
    var col = titleAt(stops, (i + 0.5) / n);
    b.fillStyle = col;
    b.fillRect(x0, ya, W, yb - ya + 0.5);
    if (prev) {
      var y = Math.round(ya * 2) / 2, x;
      b.fillStyle = prev;
      for (x = Math.floor(x0); x < x0 + W; x += 1) { b.fillRect(x, y, 0.5, 0.5); b.fillRect(x + 0.5, y + 0.5, 0.5, 0.5); }
      b.fillStyle = col;
      for (x = Math.floor(x0); x < x0 + W; x += 1) { b.fillRect(x + 0.5, y - 0.5, 0.5, 0.5); b.fillRect(x, y - 1, 0.5, 0.5); }
    }
    prev = col;
  }
}
// a spruce as three stepped tiers — the game's treeline idiom, pointed
function titleSpruce(b, x, y, h, col) {
  var tier, yy;
  b.fillStyle = '#1a1208';
  b.fillRect(x - Math.max(0.5, h * 0.02), y - h * 0.3, Math.max(1, h * 0.04), h * 0.32);
  b.fillStyle = col;
  for (tier = 0; tier < 3; tier++) {
    var apex = y - h + tier * h * 0.27, base = y - h * 0.02 - (2 - tier) * h * 0.23;
    var halfMax = h * (0.2 + tier * 0.11);
    for (yy = apex; yy < base; yy += 1) {
      var half = halfMax * (yy - apex) / (base - apex);
      b.fillRect(x - half, yy, half * 2, 1.05);
    }
  }
}
// spruces along one bank in three inland layers, far to near, hazy to dark;
// every base sits on the bank's curve, so the forest bends with the river
function titleBankTrees(b, geo, rng, side) {
  var k, len = (geo.yNear - geo.yFar) * 1.15;                  // a bank's length, near enough
  for (k = 2; k >= 0; k--) {
    var u = 1;
    while (u > -0.06) {
      var uu = Math.max(0, u), s = 1 - uu;                      // depth: 0 far, 1 near
      var h = Math.min(geo.S * 0.85, (0.024 + 0.31 * Math.pow(s, 1.3)) * geo.TR) * (0.75 + 0.5 * rng());
      var p = titleRiver(geo, uu), bx = side < 0 ? p.l : p.r;
      var ox = side * (h * 0.14 + k * h * 0.5) + (rng() - 0.5) * h * 0.25, oy = -k * h * 0.08;
      var col = titleMix('#3d5d51', '#173620', Math.pow(s, 0.7));    // darker than the land at every depth
      col = titleMix(col, '#5a7a6c', k * 0.1);
      titleSpruce(b, bx + ox, p.y + oy, h, col);
      u -= (h * 0.45 * (0.7 + 0.6 * rng())) / len;
    }
  }
}
// the canoe and its paddler at rest, part of the still
function titleCanoe(g, geo) {
  var L = geo.L, cx = geo.cx, y0 = geo.stern;
  var hy = y0 - L * 0.16, sy = hy - L * 0.30, hr = L * 0.075, hcy = sy - L * 0.14;
  var i;
  // the canoe's reflection: a dark bar under the stern, a red smear the
  // water breaks into rows
  g.fillStyle = 'rgba(10,30,50,0.35)';
  g.fillRect(cx - L * 0.22, y0 + L * 0.02, L * 0.44, L * 0.07);
  for (i = 0; i < 4; i++) {
    g.fillStyle = 'rgba(163,62,47,' + (0.26 - i * 0.06) + ')';
    g.fillRect(cx - L * (0.19 - i * 0.035), y0 + L * (0.035 + i * 0.03), L * (0.38 - i * 0.07), Math.max(0.5, L * 0.015));
  }
  // hull, from behind: near end rounded, bow a point up the river
  var side = [[0.02, 0], [0.14, 0.12], [0.185, 0.32], [0.16, 0.56], [0.09, 0.8], [0.02, 0.97]];
  g.fillStyle = '#a33e2f';
  g.beginPath();
  g.moveTo(cx - side[0][0] * L, y0);
  for (i = 1; i < side.length; i++) g.lineTo(cx - side[i][0] * L, y0 - side[i][1] * L);
  g.lineTo(cx + L * 0.01, y0 - L);
  for (i = side.length - 1; i >= 0; i--) g.lineTo(cx + side[i][0] * L, y0 - side[i][1] * L);
  g.closePath(); g.fill();
  // the inside: cedar, with two thwarts and the gear
  g.fillStyle = '#c9a86a';
  g.beginPath();
  g.moveTo(cx - L * 0.02, y0 - L * 0.1);
  for (i = 1; i < side.length; i++) g.lineTo(cx - (side[i][0] - 0.035) * L, y0 - side[i][1] * L);
  g.lineTo(cx + L * 0.01, y0 - L * 0.95);
  for (i = side.length - 1; i >= 1; i--) g.lineTo(cx + (side[i][0] - 0.035) * L, y0 - side[i][1] * L);
  g.closePath(); g.fill();
  g.fillStyle = '#7a5530';
  g.fillRect(cx - L * 0.13, y0 - L * 0.45, L * 0.26, Math.max(0.5, L * 0.02));
  g.fillRect(cx - L * 0.07, y0 - L * 0.76, L * 0.14, Math.max(0.5, L * 0.02));
  g.fillStyle = '#8a6b45';                                 // a pack
  g.fillRect(cx - L * 0.08, y0 - L * 0.58, L * 0.16, L * 0.09);
  g.fillStyle = '#3f6fae';                                 // the barrel
  g.beginPath(); g.ellipse(cx + L * 0.01, y0 - L * 0.66, L * 0.06, L * 0.035, 0, 0, Math.PI * 2); g.fill();
  // one paddle stroke, frozen mid-pull on the paddler's right (the open
  // water, toward the viewer's right). Painted BEFORE the paddler, so the
  // shaft runs from the raised top hand beside the head, down behind the
  // body — the torso hides that stretch — and out past the right gunwale
  // to the blade, which stands half in the water. A still, like the rest;
  // only the hands go on afterwards, over the shaft.
  // Draft 6: the blade is a real blade — a broad leaf three shafts wide,
  // met by the shaft at a throat ABOVE the water, its upper half dry and
  // lit, its lower half the same leaf seen through the river; the entry is
  // an open splash (an arc on the far side, two streaks), never a ring.
  var gx = cx - L * 0.145, gy = sy - L * 0.24;                             // the grip, up beside the head
  var ex = cx + L * 0.34, ey = hy + L * 0.04;                              // where the shaft's line crosses the water
  var ang = Math.atan2(ey - gy, ex - gx), ca = Math.cos(ang), sa = Math.sin(ang);
  var shaftW = Math.max(1, L * 0.03);
  var thr = -L * 0.14;                                     // the throat, this far back up the shaft from the water line
  var tx = ex + thr * ca, ty = ey + thr * sa;
  function bladePath() {                                   // the leaf, in the shaft's frame: throat at thr, tip at +0.16L
    g.beginPath();
    g.moveTo(thr, -L * 0.015);
    g.quadraticCurveTo(thr + L * 0.05, -L * 0.045, thr + L * 0.11, -L * 0.045);
    g.lineTo(L * 0.08, -L * 0.04);
    g.quadraticCurveTo(L * 0.17, 0, L * 0.08, L * 0.04);
    g.lineTo(thr + L * 0.11, L * 0.045);
    g.quadraticCurveTo(thr + L * 0.05, L * 0.045, thr, L * 0.015);
    g.closePath();
  }
  g.save();
  g.translate(ex, ey); g.rotate(ang);
  bladePath();
  g.fillStyle = '#b07a3c'; g.fill();                       // the dry wood, whole
  g.strokeStyle = '#7d4d24'; g.lineWidth = Math.max(0.5, L * 0.012);       // its edge, the shaft's own dark
  bladePath(); g.stroke();
  g.strokeStyle = 'rgba(255,225,170,0.6)';                 // the low sun along the upper (sun-side) edge, dry part only
  g.beginPath(); g.moveTo(thr + L * 0.02, -L * 0.028); g.quadraticCurveTo(thr + L * 0.06, -L * 0.04, thr + L * 0.12, -L * 0.04); g.stroke();
  bladePath(); g.clip();                                   // below the water line the same leaf, through the river
  g.rotate(-ang); g.translate(-ex, -ey);
  g.fillStyle = 'rgba(48,118,158,0.5)';
  g.fillRect(ex - L * 0.3, ey, L * 0.6, L * 0.4);
  g.fillStyle = 'rgba(20,60,90,0.35)';                     // a hair of shadow right under the surface, so the cut reads
  g.fillRect(ex - L * 0.3, ey, L * 0.6, Math.max(0.5, L * 0.015));
  g.restore();
  g.strokeStyle = '#7d4d24'; g.lineWidth = shaftW;         // the shaft, grip to throat: dark, so it holds against cedar and water alike
  g.beginPath(); g.moveTo(gx, gy); g.lineTo(tx, ty); g.stroke();
  g.strokeStyle = 'rgba(255,225,170,0.5)'; g.lineWidth = Math.max(0.5, shaftW * 0.4);   // the low sun along its upper edge
  g.beginPath(); g.moveTo(gx + shaftW * 0.3, gy - shaftW * 0.3); g.lineTo(tx + shaftW * 0.3, ty - shaftW * 0.3); g.stroke();
  g.fillStyle = '#b07a3c';                                 // the grip
  g.fillRect(gx - L * 0.03, gy - L * 0.02, L * 0.06, L * 0.04);
  // the entry: an open splash — the water pushed ahead of the pull piles up
  // on the far side of the blade in one short arc, and slides off in two
  // streaks along the surface. No closed shape here, ever: a ring reads as a net.
  g.strokeStyle = 'rgba(214,236,246,0.8)'; g.lineWidth = Math.max(0.5, L * 0.018);
  g.beginPath(); g.ellipse(ex + L * 0.035, ey + L * 0.005, L * 0.085, L * 0.03, 0, -0.25 * Math.PI, 0.6 * Math.PI, false); g.stroke();
  g.strokeStyle = 'rgba(214,236,246,0.45)'; g.lineWidth = Math.max(0.5, L * 0.012);   // and a fainter fragment further out, the ripple leaving
  g.beginPath(); g.ellipse(ex + L * 0.04, ey + L * 0.01, L * 0.14, L * 0.05, 0, -0.1 * Math.PI, 0.35 * Math.PI, false); g.stroke();
  g.fillStyle = 'rgba(214,236,246,0.7)';
  g.fillRect(ex - L * 0.2, ey + L * 0.005, L * 0.11, Math.max(0.5, L * 0.012));
  g.fillRect(ex + L * 0.12, ey + L * 0.035, L * 0.09, Math.max(0.5, L * 0.012));
  g.fillStyle = 'rgba(214,236,246,0.8)';                   // drops off the shaft
  g.fillRect(tx - L * 0.06, ty - L * 0.05, Math.max(0.5, L * 0.012), Math.max(0.5, L * 0.012));
  g.fillRect(tx - L * 0.1, ty - L * 0.02, Math.max(0.5, L * 0.012), Math.max(0.5, L * 0.012));
  // the paddler, from behind: blonde, slim, a blue jacket
  g.fillStyle = '#375d8c';
  g.beginPath();
  g.moveTo(cx - L * 0.11, hy); g.lineTo(cx - L * 0.15, sy + L * 0.02); g.lineTo(cx - L * 0.09, sy - L * 0.03);
  g.lineTo(cx + L * 0.09, sy - L * 0.03); g.lineTo(cx + L * 0.15, sy + L * 0.02); g.lineTo(cx + L * 0.11, hy);
  g.closePath(); g.fill();
  g.fillStyle = '#d9a86c';                                 // neck
  g.fillRect(cx - L * 0.03, hcy + hr * 0.6, L * 0.06, sy - hcy - hr * 0.5);
  g.fillStyle = '#d9b866';                                 // hair, tidy
  g.beginPath(); g.arc(cx, hcy, hr, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,225,170,0.35)';                  // the low sun on the crown and shoulders
  g.fillRect(cx - hr * 0.8, hcy - hr, hr * 1.6, Math.max(0.5, hr * 0.25));
  g.fillRect(cx - L * 0.09, sy - L * 0.03, L * 0.18, Math.max(0.5, L * 0.015));
  // the arms. The top arm: an upper arm out from the shoulder to an elbow
  // held wide, a forearm up from there to the grip — a whole arm, joint and
  // all, in a sleeve one shade lighter than the jacket so it stands off the
  // torso. The lower arm straight out over the gunwale to the shaft. Hands
  // on the shaft, over it.
  var lhx = gx, lhy = gy;
  var elx = cx - L * 0.26, ely = sy - L * 0.05;
  var rhx = cx + L * 0.19, rhy = gy + (ey - gy) * (rhx - gx) / (ex - gx);
  var armW = Math.max(1, L * 0.05);
  g.strokeStyle = '#4169a0'; g.lineWidth = armW;
  g.beginPath(); g.moveTo(cx - L * 0.1, sy - L * 0.01); g.lineTo(elx, ely); g.stroke();
  g.beginPath(); g.moveTo(elx, ely); g.lineTo(lhx, lhy); g.stroke();
  g.fillStyle = '#4169a0';                                 // the elbow, a round joint over the two strokes' meeting
  g.beginPath(); g.arc(elx, ely, armW * 0.5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,225,170,0.35)'; g.lineWidth = Math.max(0.5, armW * 0.3);  // the sun on the top of the upper arm
  g.beginPath(); g.moveTo(cx - L * 0.1, sy - L * 0.035); g.lineTo(elx, ely - armW * 0.3); g.stroke();
  g.strokeStyle = '#375d8c'; g.lineWidth = armW;
  g.beginPath(); g.moveTo(cx + L * 0.11, sy + L * 0.03); g.lineTo(rhx, rhy); g.stroke();
  g.fillStyle = '#d9a86c';                                 // hands
  g.fillRect(lhx - L * 0.025, lhy - L * 0.02, L * 0.05, L * 0.04);
  g.fillRect(rhx - L * 0.025, rhy - L * 0.02, L * 0.05, L * 0.04);
  // the stern deck comes back over the paddler's hips
  g.fillStyle = '#a33e2f';
  g.beginPath(); g.moveTo(cx - L * 0.02, y0); g.lineTo(cx - L * 0.14, y0 - L * 0.12); g.lineTo(cx + L * 0.14, y0 - L * 0.12); g.lineTo(cx + L * 0.02, y0); g.closePath(); g.fill();
  g.strokeStyle = '#c05540'; g.lineWidth = Math.max(0.5, L * 0.012);
  g.beginPath();
  g.moveTo(cx - side[0][0] * L, y0);
  for (i = 1; i < side.length; i++) g.lineTo(cx - side[i][0] * L, y0 - side[i][1] * L);
  g.lineTo(cx + L * 0.01, y0 - L);
  for (i = side.length - 1; i >= 0; i--) g.lineTo(cx + side[i][0] * L, y0 - side[i][1] * L);
  g.closePath(); g.stroke();
}
function titleBuildBg(W, H) {
  var geo = titleGeoFull(W, H), HZ = geo.HZ, VPX = geo.VPX, S = geo.S;
  var c = document.createElement('canvas');
  c.width = W * 2; c.height = H * 2;
  var b = c.getContext('2d');
  b.setTransform(2, 0, 0, 2, 0, 0);
  b.imageSmoothingEnabled = false;
  var rng = titleRng(1730), i, x, p;

  // sky: dusk, warm at the far bend
  titleBands(b, 0, 0, W, HZ + 1, [[0, '#1c2350'], [0.3, '#3a4a8c'], [0.52, '#5f7fb0'], [0.7, '#9a7f8e'], [0.84, '#d5905a'], [0.94, '#e2954a'], [1, '#f2c98a']], 14);
  for (i = 0; i < 26; i++) {                               // early stars, high
    var sx = rng() * W, sy = rng() * HZ * 0.45, sb = rng();
    b.fillStyle = sb > 0.7 ? '#f2f2e8' : '#8a90b8';
    b.fillRect(sx, sy, 0.5, 0.5);
  }
  // the sun, low over the bend, and its warmth on the sky
  // setting: half behind the far shore, so it never sits under the UI text
  var sunX = VPX, sunY = HZ - S * 0.02, sunR = S * 0.045;
  var sg = b.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, S * 0.42);
  sg.addColorStop(0, 'rgba(255,214,150,0.55)');
  sg.addColorStop(1, 'rgba(255,214,150,0)');
  b.fillStyle = sg;
  b.fillRect(sunX - S * 0.42, sunY - S * 0.42, S * 0.84, S * 0.84);
  var pg = b.createRadialGradient(VPX, HZ - S * 0.06, S * 0.02, VPX, HZ - S * 0.06, S * 0.3);   // draft 3's breath, held
  pg.addColorStop(0, 'rgba(255,200,130,0.12)'); pg.addColorStop(1, 'rgba(255,200,130,0)');
  b.fillStyle = pg;
  b.fillRect(VPX - S * 0.3, HZ - S * 0.36, S * 0.6, S * 0.6);
  b.fillStyle = '#fff1cc';
  b.beginPath(); b.arc(sunX, sunY, sunR, 0, Math.PI * 2); b.fill();
  // two rolling hills in haze, a dip under the sun so it sits in the notch
  var rid, rr, hx;
  for (rr = 0; rr < 2; rr++) {
    var amp = H * (rr === 0 ? 0.062 : 0.036), ph = rr === 0 ? 0.9 : 2.6;
    b.fillStyle = rr === 0 ? titleMix('#8ea6c2', '#d5905a', 0.3) : '#5c7c9c';
    for (hx = 0; hx < W; hx += 1) {
      var q = hx / W, dip = 1 - 0.85 * Math.exp(-Math.pow((hx - VPX) / (W * 0.11), 2));
      var hh0 = amp * dip * (0.5 + 0.32 * Math.sin(q * 6.28 * 1.3 + ph) + 0.18 * Math.sin(q * 6.28 * 3.1 + ph * 2) + 0.1 * Math.sin(q * 6.28 * 7 + ph * 3));
      var hy = Math.round((HZ - hh0) * 2) / 2;
      b.fillRect(hx, hy, 1.05, HZ - hy + 1);
    }
  }
  // land under everything below the horizon — haze far, dark near — then the
  // water cut into it along the river's curve
  titleBands(b, 0, HZ, W, H - HZ + 2, [[0, '#4a6b5b'], [0.22, '#22432c'], [0.6, '#14301c'], [1, '#0e2414']], 12);
  b.save();
  titleRiverPath(b, geo);
  b.clip();
  titleBands(b, 0, HZ, W, H - HZ + 2, [[0, '#e6b784'], [0.07, '#7fa2b4'], [0.2, '#3f83a8'], [0.45, '#2b6b8f'], [0.74, '#1e567a'], [1, '#17435f']], 16);
  for (i = 0; i < 140; i++) {                              // still ripple flecks, cool, across the width of the water
    var d = Math.pow(rng(), 1.2);
    p = titleRiver(geo, 1 - d);
    b.fillStyle = 'rgba(63,131,168,' + (0.25 + 0.3 * rng()) + ')';
    b.fillRect(p.l + rng() * p.hw * 2, p.y + 3, 1 + 6 * d * rng(), 0.5);
  }
  // the sun's path on the water, still: warm streaks under the notch that
  // spread with nearness and bend with the banks, thinning out before the
  // pill's row
  var n = Math.round(W / 3);
  for (i = 0; i < n; i++) {
    var sd = Math.pow(rng(), 1.5);                         // 0 far, 1 near
    p = titleRiver(geo, 1 - sd * 0.78);
    var spread = p.hw * (0.2 + 0.7 * sd);
    var px = p.x + (VPX - p.x) * 0.7 + (rng() * 2 - 1) * spread * rng();
    var len = 2 + 16 * sd * rng(), a = 0.10 + 0.32 * (1 - sd) * rng();
    b.fillStyle = 'rgba(242,216,160,' + a + ')';
    b.fillRect(px - len / 2, p.y, len, 0.5 + sd);
  }
  b.restore();
  // sand at the water line along both curves, a hair of wet dark under it
  var bk, u;
  for (bk = 0; bk < 2; bk++) {
    var pass;
    for (pass = 0; pass < 2; pass++) {
      var prev = null;
      for (u = 1; u >= -0.001; u -= 0.025) {
        p = titleRiver(geo, Math.max(0, u));
        var qx = bk ? p.r : p.l, qy = p.y + (pass ? 0 : 0.6);
        if (prev) {
          b.strokeStyle = pass ? '#c9b27c' : '#173a4e'; b.lineWidth = 0.5 + (pass ? 2 : 2.2) * (1 - u);
          b.beginPath(); b.moveTo(prev[0], prev[1]); b.lineTo(qx, qy); b.stroke();
        }
        prev = [qx, qy];
      }
    }
  }
  // the far shore: a band of short hazy spruces along the horizon, standing
  // in front of the river's tail so it slips away behind them
  var row;
  for (row = 2; row >= 0; row--) {
    x = -S * 0.02;
    while (x < W + S * 0.02) {
      var fyb = geo.yFar + H * 0.02 - row * H * 0.009 - rng() * H * 0.004;
      var fh = (0.01 + rng() * 0.018) * H;
      b.fillStyle = row === 0 ? '#274d33' : (row === 1 ? '#2f5a44' : '#3d6a56');
      for (rid = 0; rid < fh; rid += 0.5) { var hh = (fh * 0.42) * (rid / fh); b.fillRect(x - hh, fyb - fh + rid, hh * 2, 0.55); }
      x += fh * 0.7;
    }
  }
  // the banks' spruces, three layers deep each side, and the canoe on the water
  titleBankTrees(b, geo, titleRng(1805), -1);
  titleBankTrees(b, geo, titleRng(1750), 1);
  titleCanoe(b, geo);
  return c;
}

// --- the one moving thing, every frame ---------------------------------------

SCENE_PAINTERS.title = function (g, W, H, t, rnd) {
  var key = W + 'x' + H;
  if (titleBg.key !== key) { titleBg.canvas = titleBuildBg(W, H); titleBg.key = key; }
  var geo = titleGeoFull(W, H), VPX = geo.VPX;
  var i;
  g.imageSmoothingEnabled = false;
  g.drawImage(titleBg.canvas, 0, 0, W, H);
  // a slow shimmer on the sun's path: a handful of streaks that step through
  // three brightnesses and drift a texel, nothing more. Every rnd() is drawn
  // before any branch so the streaks keep their places from frame to frame;
  // only t decides which are lit. Rows below ~83% (the pill's) stay still.
  var n = Math.round(W / 5);
  for (i = 0; i < n; i++) {
    var d = Math.pow(rnd(), 1.5), p = titleRiver(geo, 1 - d * 0.70);
    var spread = p.hw * (0.2 + 0.7 * d);
    var x = p.x + (VPX - p.x) * 0.7 + (rnd() * 2 - 1) * spread * rnd();
    var len = 2 + 14 * d * rnd();
    var lvl = Math.floor((Math.sin(t * 0.45 + i * 1.7) + 1) * 1.4995);          // 0, 1, 2
    if (lvl === 0) continue;
    x += Math.round(Math.sin(t * 0.3 + i) * 2 * d);
    x = Math.max(p.l + 1, Math.min(p.r - 1 - len, x));
    g.fillStyle = lvl === 2 ? 'rgba(250,228,180,0.34)' : 'rgba(242,216,160,0.16)';
    g.fillRect(x, p.y, len, 0.5 + d);
  }
  // and the water under the canoe catching the sky, a glint at a time
  var L = geo.L, cx = geo.cx, y0 = geo.stern;
  for (i = 0; i < 4; i++) {
    var gx = cx - L * 0.2 + rnd() * L * 0.4, gy = y0 + L * (0.03 + rnd() * 0.1), gl = 1 + rnd() * 3;
    if (Math.floor((Math.sin(t * 0.6 + i * 2.3) + 1) * 1.4995) !== 2) continue;
    g.fillStyle = 'rgba(214,236,246,0.3)';
    g.fillRect(gx, gy, gl, 0.5);
  }
};

/** The far-off lives in the firewatch view (#4). Cycles every ~140s. */
function drawFwWildlife(g, W, H, horizon, t, wild) {
  var i;
  for (i = 0; i < wild.length; i++) {
    var ev = wild[i];
    var kind = ev.type < 0.45 ? 'loon' : ev.type < 0.8 ? 'heron' : 'moose';
    var dur = kind === 'moose' ? 14 : kind === 'heron' ? 9 : 16;
    // wrap per-event: a crossing cut by the cycle simply finishes next cycle
    var age = ((t - ev.start) % 140 + 140) % 140;
    if (age > dur) continue;
    var p = age / dur;
    if (kind === 'loon') {
      // swims across the bay, diving for a stretch in the middle
      if (p > 0.45 && p < 0.58) continue;
      var lx = W * (ev.dir > 0 ? p : 1 - p);
      var ly = horizon + 6 + ev.lane * (H * 0.1);
      g.fillStyle = 'rgba(10,14,18,0.8)';
      g.fillRect(lx - 1.5, ly - 0.8, 3, 1);
      g.fillRect(lx + ev.dir * 1.5, ly - 1.9, 0.8, 1.4);
      g.fillStyle = 'rgba(230,238,244,0.22)';
      g.fillRect(lx - ev.dir * 3.2, ly + 0.4, 2.5, 0.4);
      g.fillRect(lx - ev.dir * 5.6, ly + 0.7, 2, 0.3);
    } else if (kind === 'heron') {
      var hx = W * (ev.dir > 0 ? p : 1 - p);
      var hy = horizon - 6 - ev.lane * (H * 0.12) - Math.sin(p * Math.PI * 3) * 1.5;
      var flap = Math.sin(t * 6 + i) > 0 ? 1.2 : -0.5;
      g.fillStyle = 'rgba(8,12,14,0.75)';
      g.fillRect(hx - 2.4, hy - flap, 2.4, 0.7);
      g.fillRect(hx, hy - flap * 0.5, 2.4, 0.7);
      g.fillRect(hx - 0.4, hy, 1, 0.8);
    } else {
      // a moose at the far waterline, there and then not
      var sx2 = W * (0.1 + ev.lane * 0.8);
      var a2 = Math.min(1, age, dur - age) * 0.6;
      g.fillStyle = 'rgba(6,10,8,' + a2.toFixed(2) + ')';
      g.fillRect(sx2 - 2, horizon - 2.6, 4, 1.8);
      g.fillRect(sx2 + (ev.dir > 0 ? 1.7 : -2.5), horizon - 3.7, 0.9, 1.5);
      g.fillRect(sx2 - 1.6, horizon - 0.9, 0.6, 1.1);
      g.fillRect(sx2 + 1, horizon - 0.9, 0.6, 1.1);
    }
  }
}

/** The passing canoeist (#5): hull, paddler, wake — and a paddle raised
 *  high for three seconds if you waved. */
function drawFwVisitor(g, W, H, horizon, t) {
  var cs = S.campSession;
  if (!cs || !cs.visitor) return;
  var v = cs.visitor;
  var p = v.t / v.dur;
  var vx = W * (v.dir > 0 ? -0.05 + p * 1.1 : 1.05 - p * 1.1);
  var vy = horizon + 8 + v.lane * (H * 0.1);
  var bob = Math.sin(t * 1.8) * 0.4;
  // wake
  g.fillStyle = 'rgba(225,235,242,0.2)';
  g.fillRect(vx - v.dir * 6, vy + 1.6 + bob * 0.4, 4.5, 0.5);
  g.fillRect(vx - v.dir * 10, vy + 2.1, 3.5, 0.4);
  // hull, ends upswept
  g.fillStyle = 'rgba(96,32,26,0.95)';
  g.fillRect(vx - 4.5, vy + bob, 9, 1.4);
  g.fillRect(vx - 5.2, vy - 0.6 + bob, 1.2, 1.2);
  g.fillRect(vx + 4.0, vy - 0.6 + bob, 1.2, 1.2);
  // paddler
  g.fillStyle = 'rgba(20,26,30,0.95)';
  g.fillRect(vx - 0.9, vy - 2.6 + bob, 1.8, 2.8);
  g.fillRect(vx - 0.6, vy - 3.6 + bob, 1.2, 1.2);
  // the paddle: dipping strokes — or held HIGH in reply
  if (v.wavedBack > 0) {
    g.fillRect(vx + v.dir * 1.2, vy - 6.6 + bob, 0.7, 4.4);
    g.fillRect(vx + v.dir * 0.9, vy - 7.6 + bob, 1.4, 1.4);
  } else {
    var stroke = Math.sin(t * 2.6);
    var side = stroke > 0 ? 1 : -1;
    g.fillRect(vx + side * 1.6, vy - 1.6 + bob, 0.7, 3 + Math.abs(stroke) * 1.2);
  }
}

/** Fish jumping out on the lake while you watch the fire (Evrtek). */
function drawFwFish(g, W, H, horizon, t, jumps) {
  var i;
  for (i = 0; i < jumps.length; i++) {
    var ev = jumps[i];
    var age = ((t - ev.start) % 140 + 140) % 140;
    if (age > 2.4) continue;
    var jx = W * (0.08 + 0.84 * ev.x);
    var jy = horizon + 6 + ev.lane * (H * 0.16);
    if (age < 0.7) {
      // the arc: up, a silver flash at the top, and back in
      var p = age / 0.7;
      var hgt = Math.sin(p * Math.PI) * 4.5;
      g.fillStyle = p > 0.35 && p < 0.65 ? 'rgba(180,196,206,0.9)' : 'rgba(14,20,26,0.85)';
      g.fillRect(jx - 0.9 + p * 1.8, jy - hgt, 1.8, 0.9);
    } else {
      // rings widening where it went back in
      var rr = (age - 0.7) * 6;
      var al = Math.max(0, 0.32 - (age - 0.7) * 0.16);
      if (al <= 0) continue;
      g.fillStyle = 'rgba(220,232,240,' + al.toFixed(2) + ')';
      g.fillRect(jx - rr, jy + 0.6, rr * 2, 0.5);
      g.fillRect(jx - rr * 0.55, jy - 0.4, rr * 1.1, 0.5);
    }
    if (age >= 0.62 && age < 0.78) {
      g.fillStyle = 'rgba(235,242,248,0.7)';
      g.fillRect(jx - 1.6, jy - 1, 3.2, 1);
    }
  }
}

// --- plumbing ----------------------------------------------------------------

function openScene(name, caption, sub, live) {
  S.scene = {
    name: name,
    caption: caption,
    capT: performance.now(),      // captions fade; a new one fades back in
    btn: live ? 'STAND UP' : 'LOOK AWAY',
    t0: performance.now(),
    seed: Math.floor(S.rnd() * 0xffffffff) >>> 0,
    live: !!live,                 // a live scene lets the game clock run
  };
  S.mode = 'scene';
}

function closeScene() {
  S.scene = null;
  S.mode = 'play';
}
