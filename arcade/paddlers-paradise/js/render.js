// PORTAGE — RENDERER
// ---------------------------------------------------------------------------
// One art-resolution framebuffer, upscaled once with nearest-neighbour, so
// every sprite, ripple and letter sits on the same pixel grid. The terrain is
// rasterised to an offscreen canvas a single time; each frame blits the
// visible window of it and draws entities over the top, painter's order.
// ---------------------------------------------------------------------------

'use strict';

// Two framebuffer texels per world unit (v0.2.0): the world draws at double
// density and upscales once. The on-screen framing is unchanged — only the
// grain is finer. Device scale is kept EVEN so fb texels map to a whole
// number of device pixels and nothing shimmers.
var RES = 2;

var R = {
  canvas: null, ctx: null,
  fb: null, g: null,               // framebuffer + its context
  scale: 3, artW: 320, artH: 240,
  cz: 1, czT: 0,                   // camp zoom, smoothed (Evrtek: camp is a
  viewW: 320, viewH: 240,          // zone, dramatically zoomed — a minigame
                                   // inside the game world)
  terrain: null,
  camX: 0, camY: 0,
  buttons: {},                     // art-space hit rects, rebuilt every frame
  joyView: null,                   // set by main.js when a touch stick is live
};

function initRender(canvas) {
  R.canvas = canvas;
  R.ctx = canvas.getContext('2d');
  R.fb = document.createElement('canvas');
  R.g = R.fb.getContext('2d');
  onResize();
  window.addEventListener('resize', onResize);
  if (!R.terrain) prerenderTerrain();   // loadPark(0) at boot has usually baked it already
}

/**
 * A park just loaded (world.js loadPark): bake its terrain and forget the
 * camp floor — it is per-site and repaints on the next enterCamp.
 */
function rebuildTerrain() {
  prerenderTerrain();
  campGround = null;
}

function onResize() {
  // the true device ratio (capped at 3), so the even-scale rule below lands
  // each fb texel on a whole number of DEVICE pixels, not just canvas ones —
  // the 2 cap gave 2.625x Androids 1.31 device px per canvas px (note 17)
  var dpr = Math.min(3, window.devicePixelRatio || 1);
  var w = Math.round(window.innerWidth * dpr);
  var h = Math.round(window.innerHeight * dpr);
  // A hidden or still-loading tab can report 0x0; building a zero-size
  // framebuffer would poison every drawImage after it. Wait and retry.
  if (w < 8 || h < 8) { setTimeout(onResize, 200); return; }
  R.canvas.width = w; R.canvas.height = h;
  R.canvas.style.width = window.innerWidth + 'px';
  R.canvas.style.height = window.innerHeight + 'px';
  // Pick the scale from BOTH axes (~240 world units on the short side, at
  // most ~470 on the long one), then round UP to an even number so each 2x
  // framebuffer texel lands on a whole number of device pixels.
  var s0 = Math.max(2,
    Math.floor(Math.min(w, h) / 210),
    Math.ceil(Math.max(w, h) / 470));
  R.scale = s0 + (s0 % 2);
  R.artW = Math.ceil(w / R.scale);
  R.artH = Math.ceil(h / R.scale);
  R.fb.width = R.artW * RES; R.fb.height = R.artH * RES;
  R.ctx.imageSmoothingEnabled = false;
  R.g.imageSmoothingEnabled = false;
}

// --- terrain, once per park ----------------------------------------------------

function prerenderTerrain() {
  // re-entrant: the old canvas is released FIRST (iOS Safari counts canvas
  // memory — never hold two 30 MB terrains), then the new one is painted
  if (R.terrain) { R.terrain.width = 0; R.terrain.height = 0; R.terrain = null; }
  var c = document.createElement('canvas');
  c.width = WORLD.W * RES; c.height = WORLD.H * RES;
  var g = c.getContext('2d');
  var CELL = WORLD.CELL, gx, gy;

  for (gy = 0; gy < GH; gy++) {
    for (gx = 0; gx < GW; gx++) {
      var t = GRID[gy * GW + gx];
      var v = (gx * 7 + gy * 13) % 5;           // quiet per-cell variation
      var col;
      if (t === WORLD.DEEP)         col = v ? PAL.deep : PAL.water;
      else if (t === WORLD.WATER)   col = v ? PAL.water : PAL.deep;
      else if (t === WORLD.SHALLOW) col = v ? PAL.shallow : PAL.water;
      else if (t === WORLD.SAND)    col = v ? PAL.sand : PAL.sandDk;
      else if (t === WORLD.TRAIL)   col = v ? PAL.trail : PAL.trailDk;
      else                          col = v === 0 ? PAL.grassDk : (v === 3 ? PAL.forest : PAL.grass);
      g.fillStyle = col;
      g.fillRect(gx * CELL * RES, gy * CELL * RES, CELL * RES, CELL * RES);
    }
  }

  // the dock: planks into the launch lake, drawn at texel resolution — six
  // wide, from 4 u behind the foot to 16 u out over the water, the way the
  // park says it faces (pois.dock.facing; north, the default, is up)
  var dd = dockDir(), dk = POIS.dock, along = dd.dx !== 0;
  g.fillStyle = PAL.dock;
  if (along) g.fillRect((dk.x + Math.min(dd.dx * -4, dd.dx * 16)) * RES, (dk.y - 3) * RES, 20 * RES, 6 * RES);
  else g.fillRect((dk.x - 3) * RES, (dk.y + Math.min(dd.dy * -4, dd.dy * 16)) * RES, 6 * RES, 20 * RES);
  g.fillStyle = PAL.dockDk;
  for (var pk = -1; pk < 15; pk += 3) {                     // the plank lines, every 3 u
    if (along) g.fillRect((dk.x + dd.dx * pk) * RES, (dk.y - 3) * RES, 1, 6 * RES);
    else g.fillRect((dk.x - 3) * RES, (dk.y + dd.dy * pk) * RES, 6 * RES, 1);
  }

  // lilies are furniture, not actors — bake them (2x sprites draw 1:1 here)
  LILIES.forEach(function (l) {
    g.drawImage(SPRITES.lily, Math.round(l.x * RES - 6), Math.round(l.y * RES - 3));
  });

  // reeds: short strokes leaning out of the shallows (#11)
  REEDS.forEach(function (r) {
    var i2, h2 = ((r.x * 31 + r.y * 17) | 0);
    for (i2 = 0; i2 < r.n; i2++) {
      var ox = ((h2 >> i2) % 5) - 2 + i2 * 2;
      g.fillStyle = (i2 + h2) % 2 ? PAL.pineLt : PAL.trail;
      g.fillRect(Math.round((r.x + ox) * RES), Math.round((r.y - 3) * RES), 1, 3 * RES);
      g.fillStyle = PAL.trailDk;
      g.fillRect(Math.round((r.x + ox) * RES), Math.round((r.y - 0.5) * RES), 1, RES);
    }
  });

  // shore stones: grey backs just breaking the surface (#18)
  STONES.forEach(function (s) {
    g.fillStyle = PAL.rockDk;
    g.fillRect(Math.round((s.x - s.r) * RES), Math.round((s.y - s.r * 0.7) * RES),
      Math.round(s.r * 2 * RES), Math.round(s.r * 1.4 * RES));
    g.fillStyle = PAL.rock;
    g.fillRect(Math.round((s.x - s.r * 0.6) * RES), Math.round((s.y - s.r * 0.7) * RES),
      Math.round(s.r * 1.2 * RES), Math.round(s.r * 0.6 * RES));
    g.fillStyle = PAL.ripple;
    g.fillRect(Math.round((s.x - s.r - 1) * RES), Math.round((s.y + s.r * 0.6) * RES),
      Math.round((s.r * 2 + 2) * RES), 1);
  });

  // the lookout ledge (note 8): a patch of bare granite in the clearing,
  // speckled the way the shore stones are, ~18 u across — the rock sprite
  // and the lone pine stand on it from drawEntities
  (LOOKOUTS || []).forEach(function (lo) {
    var h3 = ((lo.x * 31 + lo.y * 17) | 0), n3 = 0, i3;
    var rw = Math.min(18, lo.r * 0.8);
    for (i3 = 0; i3 < 70; i3++) {
      h3 = (Math.imul(h3, 1103515245) + 12345) >>> 0;
      var ox3 = ((h3 >>> 8) % 1000) / 1000 - 0.5, oy3 = ((h3 >>> 18) % 1000) / 1000 - 0.5;
      if (ox3 * ox3 + oy3 * oy3 > 0.25) continue;         // a disc, not a square
      g.fillStyle = (n3++ % 3) ? PAL.rock : PAL.rockDk;
      g.fillRect(Math.round((lo.x + ox3 * rw * 2) * RES), Math.round((lo.y + oy3 * rw * 1.4) * RES), 2 * RES, RES);
    }
  });

  // cottage lots (pass 4, parks-shape §1.13): a small cabin on each — log
  // walls, a grey roof with its ridge, a door and one lit window — baked
  // into the terrain the way the lookout's granite is; scatterFlora keeps
  // the trees off the lot. Smoke's 'civilised opening screen'.
  (COTTAGES || []).forEach(function (c) {
    var hc = ((c[0] * 31 + c[1] * 17) | 0), cw = 6 + (hc % 3), ch = 3 + ((hc >> 2) % 2);
    var x0 = c[0] - cw / 2, base = c[1];
    g.fillStyle = PAL.trunk;
    g.fillRect(Math.round(x0 * RES), Math.round((base - ch) * RES), cw * RES, ch * RES);
    g.fillStyle = PAL.trunkLt;
    g.fillRect(Math.round(x0 * RES), Math.round((base - ch + 1) * RES), cw * RES, 1);
    g.fillStyle = PAL.rockDk;                           // the roof, a unit wider than the walls
    g.fillRect(Math.round((x0 - 0.5) * RES), Math.round((base - ch - 2) * RES), (cw + 1) * RES, 2 * RES);
    g.fillStyle = PAL.rock;
    g.fillRect(Math.round((x0 - 0.5) * RES), Math.round((base - ch - 2) * RES), (cw + 1) * RES, 1);
    g.fillStyle = PAL.trunkLt;                          // the door, on the side the hash says
    var dx = (hc & 8) ? x0 + 1 : x0 + cw - 2.5;
    g.fillRect(Math.round(dx * RES), Math.round((base - 2) * RES), 1.5 * RES, 2 * RES);
    g.fillStyle = PAL.sand;                             // one window
    g.fillRect(Math.round((dx < c[0] ? x0 + cw - 2.5 : x0 + 1) * RES), Math.round((base - ch + 1) * RES), 1.5 * RES, RES);
  });

  // deadheads: a dark tip and a ring of stillness around it (#11)
  DEADHEADS.forEach(function (d) {
    g.save();
    g.translate(d.x * RES, d.y * RES);
    g.rotate(d.a);
    g.fillStyle = PAL.trunk;
    g.fillRect(-1 * RES, -3 * RES, 2 * RES, 6 * RES);
    g.fillStyle = PAL.trunkLt;
    g.fillRect(-1 * RES, -3 * RES, 2 * RES, RES);
    g.restore();
    g.fillStyle = PAL.ripple;
    g.fillRect(Math.round((d.x - 3) * RES), Math.round((d.y + 3) * RES), 6 * RES, 1);
  });

  R.terrain = c;
}

// --- helpers -------------------------------------------------------------------

function sx(x) { return x - R.camX; }
function sy(y) { return y - R.camY; }

function drawSprite(name, x, y, ang) {
  var s = SPRITES[name];
  var dw = s.width / RES, dh = s.height / RES;   // world-unit footprint
  var rx = Math.round(sx(x) * RES) / RES, ry = Math.round(sy(y) * RES) / RES;
  if (ang === undefined || ang === null) {
    R.g.drawImage(s, rx - dw / 2, ry - dh / 2, dw, dh);
    return;
  }
  R.g.save();
  R.g.translate(rx, ry);
  R.g.rotate(ang);
  R.g.drawImage(s, -dw / 2, -dh / 2, dw, dh);
  R.g.restore();
}

/**
 * Padding under a sprite's ink, in texels: the maps are authored with blank
 * rows below the trunk, so "stand it on the ground" means the lowest INKED
 * row on the ground, not the canvas edge. Scanned once per sprite, cached.
 */
function spritePad(s) {
  if (s._pad !== undefined) return s._pad;
  var d = s.getContext('2d').getImageData(0, 0, s.width, s.height).data;
  var y, x, pad = s.height;
  for (y = s.height - 1; y >= 0 && pad === s.height; y--) {
    for (x = 0; x < s.width; x++) {
      if (d[(y * s.width + x) * 4 + 3]) { pad = s.height - 1 - y; break; }
    }
  }
  s._pad = pad;
  return pad;
}

/** Draw a sprite with the bottom of its ink standing on world y (trees). */
function drawSpriteBased(name, x, baseY) {
  var s = SPRITES[name];
  var dh = s.height / RES;
  drawSprite(name, x, baseY + spritePad(s) / RES - dh / 2);
}

function uiFont(size) {
  return '600 ' + (size || 7) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
}

function text(str, x, y, col, size, align) {
  // Regular text, per Evrtek: the UI pass renders at device resolution, so
  // this is a real font drawn crisp — only the WORLD is pixel art.
  R.g.font = uiFont(size);
  R.g.textAlign = align || 'left';
  R.g.textBaseline = 'top';
  R.g.fillStyle = 'rgba(8,12,10,0.75)';
  R.g.fillText(str, x + 0.5, y + 0.5);
  R.g.fillStyle = col || PAL.white;
  R.g.fillText(str, x, y);
}

/**
 * Word-wrap by measurement (note 1): the font is set here first so the
 * measure matches what text() will draw at the same size. Returns lines.
 * An explicit `font` string overrides the UI face (the journal's hand).
 */
function wrapText(str, maxW, size, font) {
  var g = R.g;
  g.font = font || uiFont(size);
  var words = String(str).split(' '), lines = [], line = '', i;
  for (i = 0; i < words.length; i++) {
    var t2 = line ? line + ' ' + words[i] : words[i];
    if (g.measureText(t2).width > maxW && line) { lines.push(line); line = words[i]; }
    else line = t2;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Fit one line into maxW: shrink the size in half-point steps down to
 * minSize, then trim with an ellipsis — by measureText, never by character
 * count. Returns {text, size} for the caller to hand to text().
 */
function fitText(str, maxW, size, minSize) {
  var g = R.g, s = size || 7, lo = minSize || s, t = String(str);
  g.font = uiFont(s);
  while (g.measureText(t).width > maxW && s - 0.5 >= lo) { s -= 0.5; g.font = uiFont(s); }
  if (g.measureText(t).width <= maxW) return { text: t, size: s };
  while (t.length > 1 && g.measureText(t.replace(/\s+$/, '') + '…').width > maxW) t = t.slice(0, -1);
  return { text: t.replace(/\s+$/, '') + '…', size: s };
}

function speakerPill(x, y, w, h, muted) {
  var g = R.g;
  g.fillStyle = PAL.uiBg;
  g.fillRect(x, y, w, h);
  g.strokeStyle = PAL.white;
  g.lineWidth = 2 / R.scale;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  speakerGlyph(x + w / 2 - 3, y + h / 2, muted);
}

/** The speaker alone (no box) — the HUD pill and the gear's SOUND row share it. */
function speakerGlyph(cx, cy, muted) {
  var g = R.g;
  g.fillStyle = PAL.white;
  g.fillRect(cx - 4, cy - 2, 3, 4);              // the driver box
  g.beginPath();                                  // the cone
  g.moveTo(cx - 1, cy - 2);
  g.lineTo(cx + 3, cy - 5);
  g.lineTo(cx + 3, cy + 5);
  g.lineTo(cx - 1, cy + 2);
  g.closePath();
  g.fill();
  if (muted) {
    g.strokeStyle = PAL.bad;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(cx + 5, cy - 4); g.lineTo(cx + 10, cy + 4);
    g.moveTo(cx + 10, cy - 4); g.lineTo(cx + 5, cy + 4);
    g.stroke();
  } else {
    g.strokeStyle = PAL.white;
    g.lineWidth = 1;
    g.beginPath(); g.arc(cx + 4.5, cy, 3, -0.9, 0.9); g.stroke();
    g.beginPath(); g.arc(cx + 4.5, cy, 5.5, -0.8, 0.8); g.stroke();
  }
}

/**
 * The gear (note 13): a six-tooth cog in the speaker's old pill — the
 * speaker itself moved inside the menu the cog opens. Teeth are rotated
 * rects, the body an arc, the axle a hole punched in panel colour.
 */
function gearPill(x, y, w, h) {
  var g = R.g;
  g.fillStyle = PAL.uiBg;
  g.fillRect(x, y, w, h);
  g.strokeStyle = PAL.white;
  g.lineWidth = 2 / R.scale;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  var cx = x + w / 2, cy = y + h / 2, i;
  g.fillStyle = PAL.white;
  for (i = 0; i < 6; i++) {
    g.save();
    g.translate(cx, cy);
    g.rotate(i * Math.PI / 3);
    g.fillRect(-1.2, -5.5, 2.4, 11);
    g.restore();
  }
  g.beginPath(); g.arc(cx, cy, 3.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = PAL.uiBg;
  g.beginPath(); g.arc(cx, cy, 1.4, 0, Math.PI * 2); g.fill();
}

function pill(x, y, w, h, label, col) {
  R.g.fillStyle = PAL.uiBg;
  R.g.fillRect(x, y, w, h);
  R.g.strokeStyle = col || PAL.gold;
  R.g.lineWidth = 2 / R.scale;
  R.g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  text(label, x + w / 2, y + (h - 7) / 2 + 0.5, col || PAL.gold, 7, 'center');
}

/**
 * A pill whose label is one or two pre-fitted rows ({text, size} from
 * fitText) — the action button on a phone (note 1). One row sits where
 * pill() puts it; two rows share the height at a 9-unit pitch.
 */
function pillRows(x, y, w, h, rows, col) {
  R.g.fillStyle = PAL.uiBg;
  R.g.fillRect(x, y, w, h);
  R.g.strokeStyle = col || PAL.gold;
  R.g.lineWidth = 2 / R.scale;
  R.g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  var pitch = 9, top = y + (h - (rows.length - 1) * pitch - rows[0].size) / 2 + 0.5, i;
  for (i = 0; i < rows.length; i++) {
    text(rows[i].text, x + w / 2, top + i * pitch, col || PAL.gold, rows[i].size, 'center');
  }
}

/**
 * The height of each of the two bottom HUD bars: narrow screens (portrait
 * phones — gated on WIDTH, so a landscape phone keeps its short bars) get
 * taller bars that wrap to two lines. Shared with everything that must
 * stay clear of them (the pinned edge markers).
 */
function hudBarH() {
  return R.artW < 230 ? 20 : 12;
}

/**
 * One full-width HUD bar's worth of text (note 1). Narrow screens wrap to
 * at most two 6.5px lines — a third line's words are squeezed onto the
 * second by fitText, so nothing ever paints outside the bar; wide screens
 * shrink one 7px line to 6 before trimming. Vertically centred in barH.
 */
function barText(str, y, barH, col, narrow) {
  var maxW = R.artW - 8;
  if (!narrow) {
    var f = fitText(str, maxW, 7, 6);
    text(f.text, R.artW / 2, y + (barH - f.size) / 2 + 0.5, col, f.size, 'center');
    return;
  }
  var size = 6.5, pitch = 8.5;
  var lines = wrapText(str, maxW, size);
  if (lines.length > 2) lines = [lines[0], lines.slice(1).join(' ')];
  var rows = lines.map(function (l) { return fitText(l, maxW, size, 6); });
  var top = y + (barH - (rows.length - 1) * pitch - size) / 2 + 0.5, i;
  for (i = 0; i < rows.length; i++) {
    text(rows[i].text, R.artW / 2, top + i * pitch, col, rows[i].size, 'center');
  }
}

// --- the frame -------------------------------------------------------------------

function draw(state, nowMs) {
  var g = R.g;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, R.fb.width, R.fb.height);

  // the campsite is a scene of its own: a dedicated stage at double the
  // overworld's texel density (Evrtek: a switch, not a zoom). A card raised
  // from INSIDE a first-person scene keeps that scene as its backdrop.
  if (state.campSession && state.mode !== 'scene' &&
      !(state.mode === 'card' && state.scene)) {
    drawCampScene(state, nowMs);
    drawFade(state, nowMs);
    present();
    uiPass(function () {
      if (state.mapOpen) drawMap(state);
      else if (state.journalOpen) drawJournal(state);
      else if (state.gearOpen) drawGear(state);
      else drawHUD(state, nowMs);
      if (state.mode === 'card') drawCard(state);
    });
    return;
  }

  // a scene owns the whole screen: first-person, full bleed (#6, #9) —
  // and it stays the backdrop when a card opens from within it
  if (state.scene && (state.mode === 'scene' || state.mode === 'card')) {
    g.setTransform(RES, 0, 0, RES, 0, 0);
    SCENE_PAINTERS[state.scene.name](g, R.artW, R.artH,
      (nowMs - state.scene.t0) / 1000, rngFrom(state.scene.seed));
    if (state.eyesT) drawEyelids(state, nowMs);
    present();
    uiPass(function () {
      if (state.mode === 'card') { drawCard(state); return; }
      if (state.eyesT) { R.buttons = {}; }
      else drawSceneUI(state);
    });
    return;
  }



  // the title screen (v0.9.2): Yori's painter owns the whole framebuffer —
  // painted under the RES transform BEFORE present(), the shelf's pattern —
  // and drawTitle lays the words and the pill over it in the UI pass. t is
  // nowMs/1000 with no t0: every moving part (the stroke, the wake, the
  // birds, the sun's breath, the light on the water) is a continuous periodic
  // function of t, so it needs no origin. The seed is FIXED and re-seeded
  // every frame on purpose — the water's streaks then hold their places and
  // only slide, instead of reshuffling into static every frame. Nothing here
  // writes into S: tickGame returns early for 'title'.
  if (state.mode === 'title') {
    g.setTransform(RES, 0, 0, RES, 0, 0);
    SCENE_PAINTERS.title(g, R.artW, R.artH, nowMs / 1000, rngFrom(7));
    present();
    uiPass(function () { drawTitle(nowMs); });
    return;
  }

  if (state.mode === 'trips') {
    // the Highway 60 park screen: the road strip is pixel art painted into
    // the framebuffer first (the scene pattern), the cards crisp in the UI
    // pass above it. t = nowMs/1000 needs no t0 — everything on the strip
    // is periodic — and nothing here writes into S: tickGame returns early
    // for 'trips', so the shelf stays outside time (the v0.8.0 HIGH bug).
    g.setTransform(RES, 0, 0, RES, 0, 0);
    g.fillStyle = '#12291a';
    g.fillRect(0, 0, R.artW, R.artH);
    var roadH = shelfRoadH();
    SCENE_PAINTERS.highway60(g, R.artW, R.artH, nowMs / 1000, rngFrom(60), R.artH - roadH, roadH);
    present();
    uiPass(function () { drawParks(state, nowMs); });
    return;
  }

  // (the camp zoom of v0.2.1 was retired the same day: camp is a full SCENE
  // SWITCH now — see drawCampScene — so the overworld always renders at 1)
  var czTarget = 1;
  var czNow = nowMs;
  var czDt = Math.min(0.1, (czNow - (R.czT || czNow)) / 1000);
  R.czT = czNow;
  R.cz += (czTarget - R.cz) * Math.min(1, czDt * 3.2);
  if (Math.abs(R.cz - czTarget) < 0.01) R.cz = czTarget;
  var cz = R.cz;
  R.viewW = R.artW / cz;
  R.viewH = R.artH / cz;

  // camera — when the viewport out-sizes the world on an axis, centre the
  // world instead of letting the min/max clamp invert
  R.camX = R.viewW >= WORLD.W ? (WORLD.W - R.viewW) / 2
    : Math.max(0, Math.min(WORLD.W - R.viewW, state.player.x - R.viewW / 2));
  R.camY = R.viewH >= WORLD.H ? (WORLD.H - R.viewH) / 2
    : Math.max(0, Math.min(WORLD.H - R.viewH, state.player.y - R.viewH / 2));
  // ...then snapped to the framebuffer texel grid (note 17): with camX*RES
  // an integer the terrain source rect is exact and every drawSprite round
  // lands on the same grid — the forest stops shimmering against the ground.
  // The player stays pinned: round(p.x*RES) - artW is artW/2 off p.x*RES.
  R.camX = Math.round(R.camX * RES) / RES;
  R.camY = Math.round(R.camY * RES) / RES;

  // everything in the world pass is drawn in world units under a xRES·zoom
  // transform, straight onto the 2x framebuffer
  g.setTransform(RES * cz, 0, 0, RES * cz, 0, 0);

  // terrain window (source rect kept inside the terrain canvas)
  var tsx = Math.max(0, R.camX), tsy = Math.max(0, R.camY);
  var tdx = Math.max(0, -R.camX), tdy = Math.max(0, -R.camY);
  var tw = Math.min(R.viewW - tdx, WORLD.W - tsx), th = Math.min(R.viewH - tdy, WORLD.H - tsy);
  g.fillStyle = PAL.forest;
  g.fillRect(0, 0, R.viewW + 1, R.viewH + 1);
  g.drawImage(R.terrain, tsx * RES, tsy * RES, tw * RES, th * RES, tdx, tdy, tw, th);

  drawWater(state, nowMs);
  drawEntities(state, nowMs);
  // rings and stars sit OVER the crowns (note 14): a 24-unit pine would
  // otherwise bury a vista star or a camp ring
  drawCampRings(state, nowMs);
  drawPoiBeckons(state, nowMs);
  if (state.squall) drawRain(state, nowMs);
  drawDayTint(state);
  drawFade(state, nowMs);

  present();
  uiPass(function () {
    drawLakeNames(state);
    var pinned = drawMarker(state, nowMs);
    drawCanoeArrow(state, nowMs, pinned);
    if (state.mapOpen) drawMap(state);
    else if (state.journalOpen) drawJournal(state);   // camp-only by design; drawn here too so the HUD never paints over the paper
    else if (state.gearOpen) drawGear(state);
    else drawHUD(state, nowMs);
    if (state.mode === 'card') drawCard(state);
  });
}

/**
 * Lake names, laid gently over the middle of their water (#8): regular text,
 * semi-transparent white, so you always know what you are paddling.
 */
function drawLakeNames(state) {
  if (state.mapOpen || state.gearOpen || state.mode === 'card') return;
  var g = R.g;
  LAKE_POLYS.forEach(function (l) {
    // on the label pole (note 15), the water farthest from any shore — a
    // bent lake's centroid can be on land
    var x = (l.lx - R.camX) * R.cz, y = (l.ly - R.camY) * R.cz;
    var size = l.big ? 13 : 9;
    g.font = '600 ' + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    // a name that would show at all is shown WHOLE: pulled inside the
    // viewport by its measured width (note 1 — it clipped at phone edges)
    var label = (l.label || l.name).toUpperCase();     // a park may give a lake a shorter display label
    var hw = g.measureText(label).width / 2 + 2, hh = size / 2 + 2;
    if (x + hw < 0 || x - hw > R.artW || y + hh < 0 || y - hh > R.artH) return;
    // ...and fades as its pole leaves the screen, so a pinned name
    // slips away instead of popping out at the cull line
    var out = Math.max(-x / hw, (x - R.artW) / hw, -y / hh, (y - R.artH) / hh);
    var a = Math.max(0, Math.min(1, 1 - out));
    if (hw * 2 >= R.artW) x = R.artW / 2;
    else x = Math.min(Math.max(x, hw), R.artW - hw);
    y = Math.min(Math.max(y, hh), R.artH - hh);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.globalAlpha = a;
    g.fillStyle = 'rgba(10,20,26,0.25)';
    g.fillText(label, x + 0.5, y + 0.5);
    g.fillStyle = 'rgba(255,255,255,0.38)';
    g.fillText(label, x, y);
    g.globalAlpha = 1;
  });
  g.textBaseline = 'top';
}

/**
 * The vistas call out (#2): a gold four-point star bobbing over every place
 * worth looking at, with a slow pulse ring — dimming once you have been.
 */
function drawPoiBeckons(state, nowMs) {
  var g = R.g;
  INSPECTS.forEach(function (p) {
    if (p.x < R.camX - 30 || p.x > R.camX + R.viewW + 30 ||
        p.y < R.camY - 30 || p.y > R.camY + R.viewH + 30) return;
    if (p.info) return;                 // a thing to read, not a vista (note 21): the board is its own sign
    var seen = !!state.seenPOIs[p.scene];
    var bob = Math.sin(nowMs / 320 + p.x * 0.1) * 1.6;
    var x = sx(p.x), y = sy(p.y) - 11 + bob;
    // the hidden lookout (note 8) advertises nothing until it has been
    // found — within 60 u a faint pulse is the whole whisper
    if (p.hidden && !seen) {
      if (Math.hypot(state.player.x - p.x, state.player.y - p.y) > 60) return;
      var hp = (nowMs / 1400 + p.y * 0.01) % 1;
      g.strokeStyle = 'rgba(242,193,75,' + (0.5 * (1 - hp)).toFixed(2) + ')';
      g.lineWidth = 0.6;
      g.beginPath();
      g.arc(x, y, 3 + hp * 8, 0, Math.PI * 2);
      g.stroke();
      return;
    }
    var a = seen ? 0.25 : 0.9;
    // the star
    g.fillStyle = seen ? 'rgba(242,242,232,' + a + ')' : 'rgba(242,193,75,' + a + ')';
    g.fillRect(x - 0.7, y - 2.4, 1.4, 4.8);
    g.fillRect(x - 2.4, y - 0.7, 4.8, 1.4);
    g.fillRect(x - 1.1, y - 1.1, 2.2, 2.2);
    // the pulse, only while unvisited
    if (!seen) {
      var ph = (nowMs / 1400 + p.y * 0.01) % 1;
      g.strokeStyle = 'rgba(242,193,75,' + (0.5 * (1 - ph)).toFixed(2) + ')';
      g.lineWidth = 0.6;
      g.beginPath();
      g.arc(x, y, 3 + ph * 8, 0, Math.PI * 2);
      g.stroke();
    }
  });
}

/**
 * The game's one "this is the spot" mark: twelve orange dots turning slowly
 * on the ground. Drawn in whatever units the caller's transform is in — the
 * overworld campsite targets pass screen units, the camp stage passes stage
 * units and a smaller dot to match (note 21).
 */
function dotRing(cx, cy, r, a, nowMs, sz) {
  var g = R.g, rot = nowMs / 4000, s = sz || 1.5, i;
  g.fillStyle = 'rgba(226,115,31,' + a.toFixed(3) + ')';
  for (i = 0; i < 12; i++) {
    var an = rot + (i / 12) * Math.PI * 2;
    g.fillRect(cx + Math.cos(an) * r - s / 3, cy + Math.sin(an) * r - s / 3, s, s);
  }
}

/**
 * The MAKE CAMP target, visible but subtle (#17): a slow ring of orange dots
 * on the ground at each campsite, waking up when you are close enough.
 */
function drawCampRings(state, nowMs) {
  CAMPSITES.forEach(function (c) {
    if (c.x < R.camX - 30 || c.x > R.camX + R.viewW + 30 ||
        c.y < R.camY - 30 || c.y > R.camY + R.viewH + 30) return;
    var d = Math.hypot(state.player.x - c.x, state.player.y - c.y);
    var hot = d < 24 && state.travel !== 'canoe';
    var a = hot ? 0.55 + 0.25 * Math.sin(nowMs / 200) : 0.3;
    dotRing(sx(c.x), sy(c.y), 10, a, nowMs, 1.5);
  });
}

function present() {
  R.ctx.setTransform(1, 0, 0, 1, 0, 0);
  R.ctx.clearRect(0, 0, R.canvas.width, R.canvas.height);
  R.ctx.drawImage(R.fb, 0, 0, R.artW * RES, R.artH * RES, 0, 0, R.artW * R.scale, R.artH * R.scale);
  R.lastDraw = performance.now();
}

/**
 * The UI pass draws AFTER the pixel world has been presented, straight onto
 * the main canvas under a scale transform — so every layout number stays in
 * art units but text renders at device resolution. The world keeps its low-bit
 * soul; the words are just words (Evrtek's ruling from the phone playtest:
 * "the text should just be, like, regular text").
 */
function uiPass(fn) {
  var g0 = R.g;
  R.g = R.ctx;
  R.ctx.save();
  R.ctx.setTransform(R.scale, 0, 0, R.scale, 0, 0);
  R.ctx.imageSmoothingEnabled = false;
  fn();
  R.ctx.restore();
  R.g = g0;
  R.lastDraw = performance.now();
}

function drawRain(state, nowMs) {
  var g = R.g;
  g.fillStyle = 'rgba(60,80,110,0.28)';
  g.fillRect(0, 0, R.viewW + 1, R.viewH + 1);
  g.strokeStyle = 'rgba(200,220,240,0.5)';
  g.lineWidth = 0.5;
  var t = nowMs * 0.06, i;
  g.beginPath();
  for (i = 0; i < 90; i++) {
    var h = (i * 2654435761) >>> 0;
    var x = ((h % R.artW) + t * (2 + (h % 3))) % R.artW;
    var y = ((h >>> 8) % R.artH + t * 4) % R.artH;
    g.moveTo(x, y);
    g.lineTo(x - 2, y + 5);
  }
  g.stroke();
}

// ripples + whitecaps, only inside the visible window
function drawWater(state, nowMs) {
  var g = R.g, CELL = WORLD.CELL;
  var t = nowMs / 1000;
  var gx0 = Math.floor(R.camX / CELL), gy0 = Math.floor(R.camY / CELL);
  var gx1 = Math.ceil((R.camX + R.viewW) / CELL), gy1 = Math.ceil((R.camY + R.viewH) / CELL);
  var windy = state.wind.str > 0.45;
  g.fillStyle = PAL.ripple;
  for (var gy = gy0; gy < gy1; gy++) {
    for (var gx = gx0; gx < gx1; gx++) {
      if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
      var ter = GRID[gy * GW + gx];
      if (ter !== WORLD.WATER && ter !== WORLD.DEEP) continue;
      var h = (gx * 2654435761 ^ gy * 340573321) >>> 0;
      if ((h % 47) !== 0) continue;
      var phase = Math.sin(t * 1.4 + (h % 628) / 100);
      if (phase < 0.35) continue;
      var x = gx * CELL - R.camX, y = gy * CELL - R.camY;
      g.fillRect(x, y + (h % 3) * 0.5, 2, 0.5);
      if (windy && ter === WORLD.DEEP && (h % 3) === 0) {
        g.fillStyle = PAL.white;
        g.fillRect(x, y + 1, 1.5, 0.5);        // whitecap
        g.fillStyle = PAL.ripple;
      }
    }
  }
}

function drawEntities(state, nowMs) {
  var list = [];

  // trees in view (TREES is y-sorted; simple filter is fast enough). A tree
  // stands on tr.y and grows UP, so the slack goes below the viewport: a
  // 24-unit pine whose base is just under the bottom edge still shows its
  // crown, while one whose base is above the top edge shows nothing
  R.px = state.player.x; R.py = state.player.y;   // for the crown-fade
  for (var i = 0; i < TREES.length; i++) {
    var tr = TREES[i];
    if (tr.y < R.camY - 4 || tr.y > R.camY + R.viewH + 26) continue;
    if (tr.x < R.camX - 10 || tr.x > R.camX + R.viewW + 10) continue;
    list.push({ y: tr.y, f: drawTree, a: tr });
  }

  // signs at landings & POIs
  LANDINGS.forEach(function (l) {
    if (l.kind === 'portage') list.push({ y: l.y, f: function (o) { drawSprite('portSign', o.x, o.y - 4); }, a: l });
  });
  CAMPSITES.forEach(function (c) {
    list.push({ y: c.y, f: function (o) { drawSprite('campSign', o.x + 8, o.y - 2); }, a: c });
  });
  if (POIS.board) list.push({ y: POIS.board.y, f: function () { drawSprite('board', POIS.board.x, POIS.board.y - 4); }, a: null });
  if (POIS.cairn) list.push({ y: POIS.cairn.y, f: function () { drawSprite('rock', POIS.cairn.x, POIS.cairn.y); }, a: null });

  // beaver lodges out in the shallows (#9)
  (state.huts || []).forEach(function (h) {
    list.push({ y: h.y, f: function (o) { drawSprite('hut', o.x, o.y); }, a: h });
  });

  // the canoe, when beached — the hull lies BROADSIDE to the heading it
  // landed on, along the shore (note 11); the map is drawn lengthwise
  if (state.canoe.beached) {
    list.push({ y: state.canoe.y, f: function () {
      drawSprite('canoeBeached', state.canoe.x, state.canoe.y, state.canoe.ang + Math.PI / 2);
    }, a: null });
  }

  if (state.campfire && !state.campSession) {
    list.push({ y: state.campfire.y, f: function () {
      drawSprite((Math.floor(nowMs / 160) % 2) ? 'fire1' : 'fire2', state.campfire.x, state.campfire.y);
    }, a: null });
  }

  // berry bushes (note 8): furniture with a per-trip state, so they go
  // through the entity list rather than the terrain bake — picked bare
  // once the handful is in the pocket. Stems on the ground like a tree.
  for (var bi = 0; bi < BERRIES.length; bi++) {
    var bsh = BERRIES[bi];
    if (bsh.y < R.camY - 6 || bsh.y > R.camY + R.viewH + 8) continue;
    if (bsh.x < R.camX - 8 || bsh.x > R.camX + R.viewW + 8) continue;
    list.push({ y: bsh.y, f: function (o) {
      drawSpriteBased(state.picked[o.id] ? 'bushBare' : 'bush', o.x, o.y);
    }, a: bsh });
  }

  // the lookout ledge (note 8): the granite is baked; the rock and one lone
  // stunted pine stand on it — a clearing with something in it, found by
  // whoever bushwhacks that far
  (LOOKOUTS || []).forEach(function (lo) {
    if (lo.x < R.camX - 30 || lo.x > R.camX + R.viewW + 30 ||
        lo.y < R.camY - 30 || lo.y > R.camY + R.viewH + 30) return;
    list.push({ y: lo.y + 2, f: function (o) { drawSprite('rock', o.x, o.y + 2); }, a: lo });
    list.push({ y: lo.y - lo.r * 0.6, f: function (o) {
      drawSpriteBased(treeSprite('pineSm'), o.x + lo.r * 0.45, o.y - lo.r * 0.6);
    }, a: lo });
  });

  // wildlife
  state.animals.forEach(function (a) {
    if (!animalActive(a) || a.state === 'gone') return;
    list.push({ y: a.y, f: function (an) { drawSprite(speciesSprite(an.species), an.x, an.y); }, a: a });
  });

  // splashes and other short-lived things: a `ring` spreads and fades on the
  // water (the strike's ripples, note 5); a sprite with `rise` climbs as it
  // goes (the landed fish's leap, note 6); anything else just sits its ttl
  state.fx.forEach(function (fx2) {
    list.push({ y: fx2.y, f: function (o) {
      if (o.ring) { drawRipple(o); return; }
      var lift = o.rise && o.life ? o.rise * (1 - o.ttl / o.life) : 0;
      drawSprite(o.sprite, o.x, o.y - lift);
    }, a: fx2 });
  });

  // the bobber, while the line is in: white waiting, red and bobbing on the
  // strike (+/-1.2 u, note 5), stone-grey when a stump has it
  if (state.fish) {
    var bx = state.player.x + Math.cos(state.player.ang) * 15;   // clear of the longer bow
    var by = state.player.y + Math.sin(state.player.ang) * 15;
    list.push({ y: by, f: function () {
      var ph = state.fish.phase;
      var bob = ph === 'strike' ? Math.sin(nowMs / 45) * 1.2 : 0;
      var vx = sx(bx), vy = sy(by) + bob;      // viewport space, like everything else
      R.g.fillStyle = ph === 'strike' ? PAL.bad : ph === 'snag' ? PAL.rock : PAL.white;
      R.g.fillRect(vx - 1, vy - 1, 2, 2);
      R.g.fillStyle = PAL.canoe;
      R.g.fillRect(vx - 1, vy - 2, 2, 1);
    }, a: null });
  }

  // the tripper
  list.push({ y: state.player.y, f: function () { drawPlayer(state); }, a: null });

  list.sort(function (a, b) { return a.y - b.y; });
  list.forEach(function (e) { e.f(e.a); });

  // sighting ring above the animal being watched
  if (state.sightTarget && state.sightT > 0.1) {
    var a2 = state.sightTarget;
    var frac = Math.min(1, state.sightT / TUNE.sightSeconds);
    R.g.strokeStyle = PAL.gold;
    R.g.beginPath();
    R.g.arc(sx(a2.x), sy(a2.y) - 10, 4, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    R.g.stroke();
  }
}

/**
 * A ripple ring fx (note 5): a flattened ellipse that grows from 1.5 to
 * ~7 u across its life and thins out as it goes, in the water's own ripple
 * colour. Drawn in world units like every entity.
 */
function drawRipple(o) {
  var age = o.life ? 1 - Math.max(0, o.ttl) / o.life : 1;
  var r = 1.5 + age * 5.5;
  R.g.save();
  R.g.globalAlpha = Math.max(0, 1 - age) * 0.9;
  R.g.strokeStyle = PAL.ripple;
  R.g.lineWidth = 0.6;
  R.g.beginPath();
  R.g.ellipse(sx(o.x), sy(o.y), r, r * 0.5, 0, 0, Math.PI * 2);
  R.g.stroke();
  R.g.restore();
}

// species -> sprite (note 8): a table, so a new roster entry is one line
// and a species nobody drew is SEEN — a red marker and a console line —
// instead of quietly turning into a turtle the way the old chain did
var SPECIES_SPRITES = {
  'Moose': 'moose', 'Common Loon': 'loon', 'Great Blue Heron': 'heron',
  'Beaver': 'beaver', 'River Otter': 'otter', 'White-tailed Deer': 'deer',
  'Bald Eagle': 'eagle', 'Belted Kingfisher': 'kingfisher', 'Black Bear': 'bear',
  'Red-tailed Hawk': 'hawk', 'Painted Turtle': 'turtle', 'Snapping Turtle': 'turtle',
  'Ruffed Grouse': 'grouse', 'Pine Marten': 'marten', 'Barred Owl': 'owl',
  'Eastern Wolf': 'wolf',
};
var speciesWarned = {};
function speciesSprite(species) {
  var name = SPECIES_SPRITES[species];
  if (name && SPRITES[name]) return name;
  if (!speciesWarned[species]) {
    speciesWarned[species] = true;
    console.warn('no sprite for species "' + species + '" — add it to SPECIES_SPRITES (render.js)');
  }
  return 'markerRed';
}

// the tree map for a kind, or its size-mate when a map is missing — so the
// woods still draw if the big and understory maps land in either order
function treeSprite(kind) {
  if (SPRITES[kind]) return kind;
  var alt = { pine: 'pineSm', pineSm: 'pine', birch: 'birchSm', birchSm: 'birch' }[kind];
  return SPRITES[alt] ? alt : 'stand';
}

/**
 * A tree stands on its BASE at tr.y (note 14): the sprite's height decides
 * where the crown goes, so a 24-unit pine and a 7-unit understory birch
 * share one footing and one painter's key. The crown that is covering the
 * tripper thins to 0.6 so nobody is lost under the canopy.
 */
function drawTree(tr) {
  var name = treeSprite(tr.kind);
  var s = SPRITES[name];
  var dw = s.width / RES, dh = s.height / RES;
  // the band is the INK's extent (the canvas keeps blank pad rows under the
  // trunk) grown by the tripper's own half-size, 3 x 4 units: a tree drawn
  // after the player (base below py) whose ink reaches the 6x8 sprite fades
  var inkH = dh - spritePad(s) / RES;
  var under = R.py < tr.y && R.py > tr.y - inkH - 4 &&
    Math.abs(R.px - tr.x) < dw / 2 + 3;
  if (under) R.g.globalAlpha = 0.6;
  drawSpriteBased(name, tr.x, tr.y);
  if (under) R.g.globalAlpha = 1;
}

// the stride (note 16): the pass-through 'stand' pose between the two
// strides is what sells a walk; the divisors are cadence, not a TUNE dial
var WALK_CYCLE = ['walk1', 'stand', 'walk2', 'stand'];
var HD_WALK_CYCLE = ['hdWalk1', 'hdStand', 'hdWalk2', 'hdStand'];

function drawPlayer(state) {
  var p = state.player;
  var frame;
  var rot = p.ang + Math.PI / 2;          // sprites face up
  if (state.travel === 'canoe') {
    frame = (Math.floor(p.anim / 6) % 2) ? 'canoeL' : 'canoeR';
    drawSprite(frame, p.x, p.y, rot);
  } else if (state.travel === 'carry') {
    frame = (Math.floor(p.anim / 3) % 2) ? 'carry1' : 'carry2';
    drawSprite(frame, p.x, p.y, rot);
  } else {
    frame = p.speed > 1 ? WALK_CYCLE[Math.floor(p.anim / 1.4) % 4] : 'stand';
    drawSprite(frame, p.x, p.y, rot);
  }
}

/**
 * An arrow pinned to the screen edge, pointing at a world target with its
 * distance beneath (8 units = 10 m, the one conversion both arrows share).
 * `avoid` is another arrow's pin; when both land on the same edge within
 * 18 units this one slides 18 along it. Returns its pin for the next one.
 */
function drawEdgeArrow(state, tx, ty, sprite, col, label, avoid) {
  var cx = R.artW / 2, cy = R.artH / 2;
  var dx = tx - state.player.x, dy = ty - state.player.y;
  var len = Math.hypot(dx, dy) || 1;
  var ux = dx / len, uy = dy / len;
  var kx = ux !== 0 ? (R.artW / 2 - 14) / Math.abs(ux) : Infinity;
  var ky = uy !== 0 ? (R.artH / 2 - 14) / Math.abs(uy) : Infinity;
  var side = kx < ky ? 'x' : 'y';         // pinned on a side edge, or top/bottom
  var k = Math.min(kx, ky);
  var ex = cx + ux * k;
  var ey = cy + uy * k;
  // keep the pinned marker out from under the HUD panels, and a labelled
  // one far enough in that its whole label is on screen
  var str = (label ? label + ' · ' : '') + Math.round(len / 8) * 10 + ' m';
  R.g.font = uiFont(7);
  var half = R.g.measureText(str).width / 2 + 2;
  // (the two bottom bars start at artH - 2*hudBarH(); the label sits at
  // ey+6..ey+13, so the floor keeps it clear of them on phones too)
  var floor = R.artH - hudBarH() * 2 - 14;
  ey = Math.max(40, Math.min(floor, ey));
  ex = Math.max(Math.max(12, half), Math.min(R.artW - Math.max(36, half), ex));
  if (avoid && avoid.side === side && Math.abs(avoid.x - ex) < 18 && Math.abs(avoid.y - ey) < 18) {
    if (side === 'x') ey = ey + 18 <= floor ? ey + 18 : ey - 18;
    else ex = ex + 18 <= R.artW - 36 ? ex + 18 : ex - 18;
  }
  R.g.save();
  R.g.translate(Math.round(ex), Math.round(ey));
  R.g.rotate(Math.atan2(dy, dx) + Math.PI / 2);
  var mp = SPRITES[sprite] || SPRITES.marker;
  R.g.drawImage(mp, -mp.width / (2 * RES), -mp.height / (2 * RES), mp.width / RES, mp.height / RES);
  R.g.restore();
  text(str, Math.round(ex), Math.round(ey) + 6, col, 7, 'center');
  return { x: ex, y: ey, side: side };
}

function drawMarker(state, nowMs) {
  var t = currentTarget();
  if (!t || state.mode !== 'play') return null;
  if (state.campSession) return null;     // the evening needs no compass
  var bob = Math.sin(nowMs / 240) * 2;
  var mx = sx(t[0]) * R.cz, my = (sy(t[1]) - 14 + bob) * R.cz;
  var on = mx > 8 && mx < R.artW - 8 && my > 8 && my < R.artH - 8;
  if (on) {
    var ms = SPRITES.marker;
    R.g.drawImage(ms, mx - ms.width / (2 * RES), my - ms.height / (2 * RES), ms.width / RES, ms.height / RES);
    return null;
  }
  // pinned to the screen edge, pointing the way
  return drawEdgeArrow(state, t[0], t[1], 'marker', PAL.gold, '', null);
}

/**
 * The way back to the boat (note 19): on foot with the canoe beached and
 * out of sight (or more than 90 units off), a red chevron at the screen
 * edge with 'CANOE · N m'. Objective 0 already points there, so not then;
 * never at camp, on the map, or over a scene or card.
 */
function drawCanoeArrow(state, nowMs, pinned) {
  if (state.mode !== 'play' || state.travel !== 'foot') return;
  if (!state.canoe.beached || state.campSession || state.mapOpen || state.gearOpen) return;
  if (state.objIndex === 0) return;
  var c = state.canoe;
  var mx = sx(c.x) * R.cz, my = sy(c.y) * R.cz;
  var on = mx > 8 && mx < R.artW - 8 && my > 8 && my < R.artH - 8;
  var far = Math.hypot(c.x - state.player.x, c.y - state.player.y) > 90;
  if (on && !far) return;
  drawEdgeArrow(state, c.x, c.y, 'markerRed', PAL.canoe, 'CANOE', pinned);
}

// The light of a full day, as one continuous curve (#3): violet pre-dawn,
// rose sunrise, clear noon, long golden afternoon, amber dusk, and a night
// that is genuinely dark blue rather than merely dim. Stops are interpolated
// so the palette shifts smoothly instead of stepping.
var DAYLIGHT = [
  [5.0,  '#141a3e', 0.55],
  [6.0,  '#4a4a7a', 0.34],
  [6.8,  '#c47a5a', 0.16],
  [8.0,  '#f2d8a0', 0.05],
  [11.0, '#ffffff', 0.00],
  [16.5, '#f7dfae', 0.05],
  [18.5, '#e2954a', 0.14],
  [19.6, '#b45a3a', 0.26],
  [20.4, '#3a2a5c', 0.42],
  [21.2, '#0a1030', 0.60],
  [22.5, '#060a24', 0.68],
];
function hexLerp(c1, c2, t) {
  var a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  var r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  var g2 = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  var b2 = Math.round((a & 255) + ((b & 255) - (a & 255)) * t);
  return 'rgb(' + r + ',' + g2 + ',' + b2 + ')';
}
function daylightAt(h) {
  if (h <= DAYLIGHT[0][0]) return { col: DAYLIGHT[0][1], a: DAYLIGHT[0][2] };
  var last = DAYLIGHT[DAYLIGHT.length - 1];
  if (h >= last[0]) return { col: last[1], a: last[2] };
  for (var i = 0; i < DAYLIGHT.length - 1; i++) {
    var s0 = DAYLIGHT[i], s1 = DAYLIGHT[i + 1];
    if (h >= s0[0] && h <= s1[0]) {
      var t = (h - s0[0]) / (s1[0] - s0[0]);
      return { col: hexLerp(s0[1], s1[1], t), a: s0[2] + (s1[2] - s0[2]) * t };
    }
  }
  return { col: '#ffffff', a: 0 };
}
function drawDayTint(state) {
  var h = state.clock / 60;
  var g = R.g;
  var d = daylightAt(h);
  if (d.a <= 0.01) return;
  g.globalAlpha = d.a;
  g.fillStyle = d.col;
  g.fillRect(0, 0, Math.max(R.artW, R.viewW) + 1, Math.max(R.artH, R.viewH) + 1);
  g.globalAlpha = 1;
  // a warm pool around a lit fire, cut out of the night (overworld only —
  // the camp stage draws its own glow)
  if (state.campfire && !state.campSession && h > 18.5) {
    var fx = sx(state.campfire.x + 8), fy = sy(state.campfire.y);
    var grad = g.createRadialGradient(fx, fy, 2, fx, fy, 34);
    grad.addColorStop(0, 'rgba(242,193,75,0.30)');
    grad.addColorStop(1, 'rgba(242,193,75,0)');
    g.fillStyle = grad;
    g.fillRect(fx - 36, fy - 36, 72, 72);
  }
}

// --- HUD -------------------------------------------------------------------------

function clockText(state) {
  var m = Math.floor(state.clock);
  var h24 = Math.floor(m / 60), mm = m % 60;
  var ap = h24 >= 12 ? 'PM' : 'AM';
  var h12 = ((h24 + 11) % 12) + 1;
  return h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ap;
}

function drawHUD(state, nowMs) {
  var g = R.g;
  R.buttons = {};

  // top-left: day, clock, energy, food
  g.fillStyle = PAL.uiBg;
  g.fillRect(2, 2, 96, 30);
  text('DAY ' + state.day + '  ' + clockText(state), 6, 5, PAL.white);
  // energy
  g.fillStyle = PAL.black; g.fillRect(6, 14, 62, 5);
  g.fillStyle = state.energy > TUNE.exhaustedAt ? PAL.good : PAL.bad;
  g.fillRect(7, 15, Math.round(60 * state.energy / TUNE.energyMax), 3);
  // spent (note 7): the bar is empty, so the letter carries the red
  text('E', 70, 13, state.energy <= 0 ? PAL.bad : PAL.white);
  // food + snacks
  var fx = 6;
  for (var i = 0; i < state.food; i++) { g.fillStyle = PAL.gold; g.fillRect(fx, 23, 4, 4); fx += 6; }
  text('MEALS', fx + 2, 22, PAL.white);

  // (the wind gauge is hidden for now, per Evrtek — the wind itself still
  // blows; the drawing can come back when the HUD earns the room)

  // top-right: the gear beside MAP (#6, note 13) — the speaker lives inside
  // the gear now; key N still mutes quietly
  R.buttons.map = { x: R.artW - 30, y: 4, w: 26, h: 14 };
  pill(R.buttons.map.x, R.buttons.map.y, 26, 14, 'MAP', PAL.white);
  R.buttons.gear = { x: R.artW - 56, y: 4, w: 22, h: 14 };
  gearPill(R.buttons.gear.x, R.buttons.gear.y, 22, 14);
  // the journal (note 12), camp stage only: beside the gear on wide screens,
  // tucked under MAP on phones where the day panel owns the top-left
  if (state.campSession) {
    R.buttons.journal = R.artW >= 230 ? { x: R.artW - 104, y: 4, w: 44, h: 14 }
                                      : { x: R.artW - 48, y: 21, w: 44, h: 14 };
    pill(R.buttons.journal.x, R.buttons.journal.y, 44, 14, 'JOURNAL', PAL.white);
  }

  // the two full-width bars (#5): quest on the bottom edge, the single
  // current notification directly above it. Narrow screens get taller bars
  // that wrap to two lines (hudBarH); everything else fits one line.
  var narrow = R.artW < 230;
  var barH = hudBarH();
  var obj = OBJS[state.objIndex];
  g.fillStyle = PAL.uiBg;
  g.fillRect(0, R.artH - barH, R.artW, barH);
  if (obj) barText('★ ' + obj.text, R.artH - barH, barH, PAL.gold, narrow);
  g.fillStyle = 'rgba(12,20,16,0.72)';
  g.fillRect(0, R.artH - barH * 2, R.artW, barH);
  if (state.toasts.length) {
    barText(state.toasts[0].text, R.artH - barH * 2, barH, PAL.white, narrow);
  }

  // context action button, snug against the notification bar (#5): the
  // width is MEASURED, not guessed; phones drop the ' (E)' hint (touch-
  // first) and take a two-line label before anything gets an ellipsis
  var act = contextAction();
  if (act) {
    // the line is in (note 5): STRIKE! and the snag drop the key hint on
    // every screen so the pill under the boat stays narrow; REEL IN keeps it
    var fishing = state.mode === 'fish' && state.fish;
    var phase = fishing ? state.fish.phase : '';
    var label = narrow || phase === 'strike' || phase === 'snag' ? act.label : act.label + ' (E)';
    var snackW = narrow ? 34 : 62;
    var maxW = R.artW - (state.snacks > 0 ? snackW + 10 : 8);
    g.font = uiFont(7);
    var aw = Math.max(64, Math.ceil(g.measureText(label).width) + 12);
    var ah = 16, rows = [{ text: label, size: 7 }];
    if (aw > maxW) {
      aw = maxW;
      var mid = Math.floor(label.length / 2), sp = label.indexOf(' ', mid);
      if (sp < 0) sp = label.lastIndexOf(' ', mid);
      var parts = sp > 0 ? [label.slice(0, sp), label.slice(sp + 1)] : [label];
      if (parts.length === 2) ah = 24;
      rows = parts.map(function (p) { return fitText(p, aw - 10, 7, 6); });
    }
    // the strike flashes gold/red every 150 ms (the title's trick); the snag
    // is its own steady colour; everything else is the gold it always was
    var col = phase === 'strike' ? (Math.floor(nowMs / 150) % 2 ? PAL.bad : PAL.gold)
      : phase === 'snag' ? PAL.signOr : PAL.gold;
    var floorY = R.artH - barH * 2 - ah - 1;
    if (fishing) {
      // under the boat (note 5): centred on the hull, 14 u below it, clamped
      // inside the safe area — under the day panel, above the bars, inside
      // artW, and off the snack pill when it has to sit on the floor. The
      // boat is not always centred (the camera clamps at the world's edge),
      // so this is the boat's real screen position, not artW/2. Facing
      // south the bobber (15 u along the heading) sits exactly where the
      // pill goes, and the UI pass paints over it — so the pill moves
      // ABOVE the hull whenever the line is cast down-screen (sin > 0.5:
      // the sweep found every south-facing cast losing its bobber).
      var bx = sx(state.player.x) * R.cz, by = sy(state.player.y) * R.cz;
      var below = Math.sin(state.player.ang) <= 0.5;
      var px = Math.max(3, Math.min(R.artW - aw - 3, Math.round(bx - aw / 2)));
      var py = Math.max(36, Math.min(floorY, Math.round(below ? by + 14 : by - 14 - ah)));
      // on the floor it clears the snack pill by the corner layout's own gap
      // (snackW + 7 is where the ordinary pill starts at maxW), right margin
      // last — the whole band the snack pill stands in (its top is 16 u
      // above the floor), not just the floor row
      if (py > floorY - 16 && state.snacks > 0) px = Math.min(R.artW - aw - 3, Math.max(px, snackW + 7));
      R.buttons.action = { x: px, y: py, w: aw, h: ah, isAction: true };
    } else {
      R.buttons.action = { x: R.artW - aw - 3, y: floorY, w: aw, h: ah, isAction: true };
    }
    pillRows(R.buttons.action.x, R.buttons.action.y, aw, ah, rows, col);
  }

  // the sky button, when the sky has something to say (#6) — in open play
  // only; during cards and fishing the button routed nowhere good
  // (phones: under the camp JOURNAL pill's row, y 21..35, not across it)
  if (state.lookUp && state.mode === 'play') {
    R.buttons.lookup = { x: R.artW / 2 - 42, y: narrow ? 40 : 34, w: 84, h: 16 };
    pill(R.buttons.lookup.x, R.buttons.lookup.y, 84, 16, '✦ LOOK UP (L)', PAL.gold);
  }

  // snack button, snug bottom-left (#5) — a short form on phones so the
  // action button beside it gets the room
  if (state.snacks > 0) {
    var sw = narrow ? 34 : 62;
    R.buttons.snack = { x: 3, y: R.artH - barH * 2 - 17, w: sw, h: 16 };
    pill(R.buttons.snack.x, R.buttons.snack.y, sw, 16,
      narrow ? 'Q×' + state.snacks : 'SNACK×' + state.snacks + ' (Q)', PAL.white);
  }

  // mosquito hint
  if (state.mosquito && Math.floor(nowMs / 400) % 2) {
    text('~ mosquitoes ~', R.artW / 2, 22, PAL.bad, 7, 'center');
  }

  // touch joystick ghost
  if (R.joyView) {
    g.strokeStyle = 'rgba(242,242,232,0.5)';
    g.beginPath(); g.arc(R.joyView.x, R.joyView.y, 14, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(242,242,232,0.7)';
    g.fillRect(R.joyView.x + R.joyView.dx * 10 - 2, R.joyView.y + R.joyView.dy * 10 - 2, 5, 5);
  }
}

/**
 * The gear menu (note 13), in place of the HUD while it is open: a dark
 * overlay and one panel — SOUND, RETURN TO MAIN MENU, RESUME. RETURN turns
 * the same panel into the confirm step (state.gearConfirm) with two pills,
 * which drawCard's single button could not do. The panel is 150 wide and
 * shrinks to the 160-unit phone floor; the pills sit 22 apart.
 */
function drawGear(state) {
  var g = R.g;
  g.fillStyle = 'rgba(8,12,10,0.78)';
  g.fillRect(0, 0, R.artW, R.artH);
  var w = Math.min(150, R.artW - 16);
  var pw = w - 24, ph = 16, pitch = 22;
  var lines = state.gearConfirm ? wrapText('Abandon this trip? Nothing is saved.', w - 12, 7) : [];
  // four rows now: SOUND, KEYS, MAIN MENU, RESUME (note 22). 24 + 4x22 + 4 =
  // 116 art units tall, which still clears portrait's 284 with room over.
  var hh = state.gearConfirm ? 24 + lines.length * 11 + 8 + pitch * 2 + 4 : 24 + pitch * 4 + 4;
  var x = Math.round((R.artW - w) / 2), y = Math.round((R.artH - hh) / 2);
  g.fillStyle = PAL.uiBg; g.fillRect(x, y, w, hh);
  g.strokeStyle = PAL.gold; g.strokeRect(x + 0.5, y + 0.5, w - 1, hh - 1);
  text('GEAR', R.artW / 2, y + 7, PAL.gold, 9, 'center');
  R.buttons = {};
  var px = x + 12, py = y + 24, i;
  if (state.gearConfirm) {
    for (i = 0; i < lines.length; i++) text(lines[i], R.artW / 2, py + i * 11, PAL.white, 7, 'center');
    py += lines.length * 11 + 8;
    R.buttons.gearYes = { x: px, y: py, w: pw, h: ph };
    pill(px, py, pw, ph, 'YES, GO HOME', PAL.bad);
    py += pitch;
    R.buttons.gearStay = { x: px, y: py, w: pw, h: ph };
    pill(px, py, pw, ph, 'STAY', PAL.gold);
    return;
  }
  R.buttons.gearSound = { x: px, y: py, w: pw, h: ph };
  pill(px, py, pw, ph, 'SOUND: ' + (AUDIO.isMuted() ? 'OFF' : 'ON'), PAL.white);
  speakerGlyph(px + 8, py + ph / 2, AUDIO.isMuted());
  py += pitch;
  // note 22: STEER is W-forward / A-D-turn; COMPASS is the old W-is-north.
  // Named for what the keys DO, so a tester can flip it and feel the answer.
  R.buttons.gearKeys = { x: px, y: py, w: pw, h: ph };
  pill(px, py, pw, ph, 'KEYS: ' + (TUNE.steerKeys ? 'STEER' : 'COMPASS'), PAL.white);
  py += pitch;
  R.buttons.gearQuit = { x: px, y: py, w: pw, h: ph };
  pill(px, py, pw, ph, 'RETURN TO MAIN MENU', PAL.white);
  py += pitch;
  R.buttons.gearResume = { x: px, y: py, w: pw, h: ph };
  pill(px, py, pw, ph, 'RESUME', PAL.gold);
}

// --- the journal (note 12) ---------------------------------------------------------
// A hand-written diary on cream paper, one page at a time. The face is a
// system stack (file:// safe, nothing fetched); where a phone has no script
// font the READ comes from the paper, the rules, the ink and the italic.

var JOURNAL_PAPER = '#efe6cf';
var JOURNAL_INK = '#2a2418';
var JOURNAL_RULE = 9;

function journalFont(size) {
  return 'italic 600 ' + size + 'px "Segoe Print", "Bradley Hand", "Marker Felt", "Noteworthy", cursive';
}

/** Ink on paper: no drop shadow, baseline on the rule. */
function inkText(str, x, y, size, align) {
  var g = R.g;
  g.font = journalFont(size);
  g.textAlign = align || 'left';
  g.textBaseline = 'alphabetic';
  g.fillStyle = JOURNAL_INK;
  g.fillText(str, x, y);
}

/**
 * The journal screen, in place of the HUD while it is open: dark overlay,
 * one page sized from the screen (never wider than 240 or taller than 340,
 * clear of the corner pills), each page turned a fraction of a degree so
 * the stack reads as paper, a curl shadow on the outer edge. Pages come
 * from journalPages() with THIS paper's width and face for the wrap, cached
 * until the diary or the screen changes. Buttons: CLOSE top-right, ‹ ›
 * bottom corners, 'n / N' between them.
 */
function drawJournal(state) {
  var g = R.g;
  g.fillStyle = 'rgba(8,12,10,0.82)';
  g.fillRect(0, 0, R.artW, R.artH);

  var size = R.artW >= 300 ? 7 : 6.5;
  var pw = Math.min(R.artW - 16, 240);
  // the corner pills own the bottom strip; CLOSE (x artW-38..) owns the top
  // one wherever the paper's right edge reaches under it — every screen
  // under 320 wide, phones and the 960x540 window alike
  var top = R.artW < 320 ? 20 : 8, bot = R.artH - 26;
  var ph = Math.min(bot - top, 340);
  var px = Math.round((R.artW - pw) / 2), py = Math.round(top + (bot - top - ph) / 2);
  var inner = pw - 20;                            // text column: 12 in from the left, 8 from the right
  var perPage = Math.max(1, Math.floor((ph - 16) / JOURNAL_RULE) - 2);

  // the trip id leads the key: two fresh trips at camp on day 1 count the
  // same, and the cover would otherwise keep the last trip's name
  var key = [state.trip ? state.trip.id : '', state.log.length, state.journal.length, state.day, inner, perPage, size,
    Object.keys(state.seenPOIs).length, Object.keys(state.stats.skySeen).length,
    state.catches ? state.catches.length : 0].join(':');
  if (!R.journalCache || R.journalCache.key !== key) {
    R.journalCache = { key: key, pages: journalPages(function (s) {
      return wrapText(s, inner, size, journalFont(size));
    }, perPage) };
  }
  var pages = R.journalCache.pages, n = pages.length;
  R.journalN = n;
  var pi = Math.max(0, Math.min(n - 1, state.journalPage | 0));
  state.journalPage = pi;
  var pg = pages[pi];

  // the sheet, turned a hair either way (deterministic per page)
  var rot = ((((pi * 37) % 7) / 6) - 0.5) * 1.2 * Math.PI / 180;
  g.save();
  g.translate(px + pw / 2, py + ph / 2);
  g.rotate(rot);
  var x0 = -pw / 2, y0 = -ph / 2, i;
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillRect(x0 + 2, y0 + 3, pw, ph);
  g.fillStyle = JOURNAL_PAPER;
  g.fillRect(x0, y0, pw, ph);
  var firstRule = y0 + 8 + JOURNAL_RULE;          // the header sits on this rule
  if (pg.kind !== 'cover') {
    g.strokeStyle = 'rgba(96,120,160,0.35)';
    g.lineWidth = 0.6;
    g.beginPath();
    var ry;
    for (ry = firstRule; ry <= y0 + ph - 6; ry += JOURNAL_RULE) {
      g.moveTo(x0 + 6, ry + 0.5); g.lineTo(x0 + pw - 6, ry + 0.5);
    }
    g.stroke();
    g.strokeStyle = 'rgba(190,90,80,0.35)';       // the margin
    g.beginPath(); g.moveTo(x0 + 9.5, y0 + 4); g.lineTo(x0 + 9.5, y0 + ph - 4); g.stroke();
  }
  // the curl: a shadow gathering along the outer edge, and the corner lifting
  var grad = g.createLinearGradient(x0 + pw - 14, 0, x0 + pw, 0);
  grad.addColorStop(0, 'rgba(70,50,25,0)');
  grad.addColorStop(1, 'rgba(70,50,25,0.28)');
  g.fillStyle = grad;
  g.fillRect(x0 + pw - 14, y0, 14, ph);
  g.fillStyle = 'rgba(8,12,10,0.82)';             // the corner cut away shows the dark behind
  g.beginPath(); g.moveTo(x0 + pw, y0 + ph - 10); g.lineTo(x0 + pw, y0 + ph); g.lineTo(x0 + pw - 10, y0 + ph); g.closePath(); g.fill();
  g.fillStyle = '#f8f2e2';                        // ...and the flap, paler, folded over
  g.beginPath(); g.moveTo(x0 + pw - 10, y0 + ph - 10); g.lineTo(x0 + pw, y0 + ph - 10); g.lineTo(x0 + pw - 10, y0 + ph); g.closePath(); g.fill();

  var tx = x0 + 12;
  if (pg.kind === 'cover') {
    g.strokeStyle = JOURNAL_INK;
    g.lineWidth = 0.8; g.strokeRect(x0 + 6.5, y0 + 6.5, pw - 13, ph - 13);
    g.lineWidth = 0.4; g.strokeRect(x0 + 9.5, y0 + 9.5, pw - 19, ph - 19);
    var tsz = size + 4;
    var tl = wrapText(pg.title, pw - 32, tsz, journalFont(tsz));
    var cy = y0 + ph * 0.36;
    for (i = 0; i < tl.length; i++) inkText(tl[i], 0, cy + i * (tsz + 3), tsz, 'center');
    cy += tl.length * (tsz + 3) + 2;
    g.lineWidth = 0.6; g.beginPath(); g.moveTo(-pw * 0.2, cy); g.lineTo(pw * 0.2, cy); g.stroke();
    cy += size + 8;
    for (i = 0; i < pg.lines.length; i++) inkText(pg.lines[i], 0, cy + i * (JOURNAL_RULE + 2), size, 'center');
    inkText("— a paddler's journal —", 0, y0 + ph - 15, size - 0.5, 'center');
  } else {
    inkText(pg.title + (pg.cont ? ' (cont.)' : ''), tx, firstRule - 2, size + 2.5);
    for (i = 0; i < pg.lines.length; i++) {
      inkText(pg.lines[i], tx, firstRule + JOURNAL_RULE * (i + 2) - 2, size);
    }
  }
  g.restore();

  // the controls, on the screen rather than the sheet
  R.buttons = {};
  R.buttons.journalClose = { x: R.artW - 38, y: 4, w: 34, h: 14 };
  pill(R.buttons.journalClose.x, R.buttons.journalClose.y, 34, 14, 'CLOSE', PAL.white);
  R.buttons.journalPrev = { x: 4, y: R.artH - 22, w: 26, h: 18 };
  R.buttons.journalNext = { x: R.artW - 30, y: R.artH - 22, w: 26, h: 18 };
  g.globalAlpha = pi > 0 ? 1 : 0.4;
  pill(R.buttons.journalPrev.x, R.buttons.journalPrev.y, 26, 18, '', PAL.gold);
  text('‹', R.buttons.journalPrev.x + 13, R.buttons.journalPrev.y + 1, PAL.gold, 12, 'center');
  g.globalAlpha = pi < n - 1 ? 1 : 0.4;
  pill(R.buttons.journalNext.x, R.buttons.journalNext.y, 26, 18, '', PAL.gold);
  text('›', R.buttons.journalNext.x + 13, R.buttons.journalNext.y + 1, PAL.gold, 12, 'center');
  g.globalAlpha = 1;
  text((pi + 1) + ' / ' + n, R.artW / 2, R.artH - 16, PAL.white, 6.5, 'center');
}

// --- cards & screens ---------------------------------------------------------------

function drawSceneUI(state) {
  var g = R.g;
  R.buttons = {};

  // one quiet button, off to the right (Evrtek: the scene is the point —
  // the UI whispers); big enough for a thumb, translucent enough to ignore
  var label = state.scene.btn || 'LOOK AWAY';
  var bw = Math.max(58, label.length * 5 + 18);
  R.buttons.action = { x: R.artW - bw - 5, y: R.artH - 24, w: bw, h: 18, isAction: true };
  g.globalAlpha = 0.55;
  pill(R.buttons.action.x, R.buttons.action.y, bw, 18, label, PAL.white);
  g.globalAlpha = 1;

  // a neighbour passing (#5): the wave is optional, and correct
  if (state.scene.name === 'firewatch' && state.campSession &&
      state.campSession.visitor && !state.campSession.visitor.waved) {
    R.buttons.wave = { x: R.artW - 63, y: R.artH - 46, w: 58, h: 18 };
    g.globalAlpha = 0.8;
    pill(R.buttons.wave.x, R.buttons.wave.y, 58, 18, 'WAVE (V)', PAL.gold);
    g.globalAlpha = 1;
  }

  // feeding the fire, without leaving it (Evrtek's tending minigame) —
  // a shorter label on narrow screens, and never clipped off the left edge
  if (state.scene.name === 'firewatch' && state.campSession && state.campSession.chores.fire) {
    var wlab = (R.artW < 230 ? 'WOOD ×' : 'ADD WOOD ×') + state.campSession.chores.wood + ' (F)';
    var ww = Math.max(60, wlab.length * 5 + 16);
    R.buttons.addwood = { x: Math.max(3, R.artW - bw - ww - 11), y: R.artH - 24, w: ww, h: 18 };
    g.globalAlpha = 0.7;
    pill(R.buttons.addwood.x, R.buttons.addwood.y, ww, 18, wlab, PAL.gold);
    g.globalAlpha = 1;
  }

  // the caption: small text in the lower LEFT, fading away after a few
  // seconds; a NEW caption fades back in — that is the "stay for this"
  // whisper, and it never crosses the fire at centre
  if (!state.scene.caption) return;
  var age = (performance.now() - (state.scene.capT || state.scene.t0)) / 1000;
  var a = age < 0.6 ? age / 0.6 : age < 7 ? 1 : Math.max(0, 1 - (age - 7) / 1.6);
  if (a <= 0) return;
  g.globalAlpha = a;
  var leftPill = R.buttons.addwood ? R.buttons.addwood.x : R.buttons.action.x;
  var maxw = Math.min(R.artW * 0.55, leftPill - 14);
  var aboveRow = false;
  if (maxw < R.artW * 0.34) {          // narrow phones: climb above the pills
    maxw = R.artW * 0.6;
    aboveRow = true;
  }
  var lines = wrapText(state.scene.caption, maxw, 7);
  var y = (aboveRow ? R.artH - 30 : R.artH - 8) - lines.length * 9;
  lines.forEach(function (l, i) {
    text(l, 6, y + i * 9, 'rgba(242,242,232,0.9)', 7);
  });
  g.globalAlpha = 1;
}

/**
 * TRIP COMPLETE deserves better than four lines (#4, #20): the full ledger,
 * every earning on its own row, the completionist's checklist at the bottom.
 * Two columns when the screen is short, one when it is tall.
 */
function drawScoreCard(state) {
  var g = R.g, c = state.card, sc = c.score;
  g.fillStyle = 'rgba(8,12,10,0.85)';
  g.fillRect(0, 0, R.artW, R.artH);

  var rowH = 8.5, headH = 30, compH = c.comp.length * 8 + 12, footH = 24;
  var cols = 1;
  var need = function () {
    return headH + Math.ceil(sc.rows.length / cols) * rowH + compH + footH + 8;
  };
  if (need() > R.artH - 6 && R.artW > 250) cols = 2;
  while (need() > R.artH - 6 && rowH > 6) rowH -= 0.5;   // shrink before dropping
  var hh = Math.min(need(), R.artH - 6);
  var perCol = Math.ceil(sc.rows.length / cols);
  var w = Math.min(R.artW - 10, cols === 2 ? 300 : 210);
  var x = (R.artW - w) / 2, y = (R.artH - hh) / 2;

  g.fillStyle = PAL.uiBg; g.fillRect(x, y, w, hh);
  g.strokeStyle = PAL.gold; g.strokeRect(x + 0.5, y + 0.5, w - 1, hh - 1);
  text(c.title, R.artW / 2, y + 5, PAL.gold, 10, 'center');
  text(sc.total + ' POINTS', R.artW / 2, y + 17, PAL.white, 9, 'center');

  var colW = (w - 16) / cols, i;
  var compTop = y + hh - footH - compH;
  var dropped = 0;
  for (i = 0; i < sc.rows.length; i++) {
    var col = Math.floor(i / perCol);
    var rx = x + 8 + col * colW;
    var ry = y + headH + (i % perCol) * rowH;
    if (ry > compTop - rowH) { dropped++; continue; }
    var pts = sc.rows[i][1];
    text(sc.rows[i][0], rx, ry, PAL.white, 6);
    text((pts > 0 ? '+' : '') + pts, rx + colW - 10, ry, pts < 0 ? PAL.bad : PAL.gold, 6, 'right');
  }
  if (dropped) text('… +' + dropped + ' more in the total', x + w - 10, compTop - rowH + 1, PAL.gold, 6, 'right');

  var cy2 = compTop + 6;
  g.strokeStyle = 'rgba(242,193,75,0.4)';
  g.beginPath(); g.moveTo(x + 8, cy2 - 3); g.lineTo(x + w - 8, cy2 - 3); g.stroke();
  for (i = 0; i < c.comp.length; i++) {
    text(c.comp[i], R.artW / 2, cy2 + i * 8, PAL.white, 6, 'center');
  }

  R.buttons = {};
  R.buttons.action = { x: R.artW / 2 - 44, y: y + hh - 20, w: 88, h: 16, isAction: true };
  pill(R.buttons.action.x, R.buttons.action.y, 88, 16, c.button, PAL.gold);
}

/** A card's lines, each wrapped to the card; a blank line stays a blank line. */
function wrapCardLines(src, maxW, size) {
  var out = [], i;
  for (i = 0; i < src.length; i++) {
    var w = wrapText(src[i], maxW, size);
    if (!w.length) w = [''];
    out = out.concat(w);
  }
  return out;
}

function drawCard(state) {
  var g = R.g, c = state.card;
  if (c.kind === 'end' && c.score) { drawScoreCard(state); return; }
  g.fillStyle = 'rgba(8,12,10,0.78)';
  g.fillRect(0, 0, R.artW, R.artH);
  var w = Math.min(R.artW - 16, 230);
  // every line wraps to the card (note 1) and the card grows to hold them;
  // if that would leave the screen, the type drops half a point and the
  // height is clamped so the button always stays inside
  var size = 7, pitch = 11;
  var src = c.lines.slice(c.page || 0);
  var lines = wrapCardLines(src, w - 12, size);
  var hh = Math.max(96, 24 + lines.length * pitch + 28);
  R.cardNext = null;
  if (hh > R.artH - 12) {
    size = 6.5; pitch = 9.5;
    lines = wrapCardLines(src, w - 12, size);
    hh = Math.min(R.artH - 12, Math.max(96, 24 + lines.length * pitch + 28));
    // a site curiosity's card (note 4) can run four authored lines of
    // somebody's own words — on the 240x135 PC frame the clamp above cut
    // the slab table's last four rows. Pass 4: page it instead. Show the
    // authored lines that fit whole (at least one), say MORE, and let
    // doAction turn the page; the button closes only on the last one.
    if (c.kind === 'feature' && 24 + lines.length * pitch + 28 > hh) {
      var maxN = Math.floor((hh - 46 - pitch) / pitch) + 1, n = 0, take = 0;
      while (take < src.length) {
        var k = wrapCardLines([src[take]], w - 12, size).length;
        if (n + k > maxN && take > 0) break;
        n += k; take++;
      }
      lines = wrapCardLines(src.slice(0, take), w - 12, size);
      if (take < src.length) R.cardNext = (c.page || 0) + take;
    }
  }
  var x = (R.artW - w) / 2, y = Math.round((R.artH - hh) / 2);
  g.fillStyle = PAL.uiBg; g.fillRect(x, y, w, hh);
  g.strokeStyle = PAL.gold; g.strokeRect(x + 0.5, y + 0.5, w - 1, hh - 1);
  text(c.title, R.artW / 2, y + 7, PAL.gold, 9, 'center');
  for (var i = 0; i < lines.length; i++) {
    if (y + 24 + i * pitch > y + hh - 22 - pitch) break;   // never under the button
    text(lines[i], R.artW / 2, y + 24 + i * pitch, PAL.white, size, 'center');
  }
  R.buttons = {};
  R.buttons.action = { x: R.artW / 2 - 44, y: y + hh - 22, w: 88, h: 16, isAction: true };
  pill(R.buttons.action.x, R.buttons.action.y, 88, 16, R.cardNext !== null ? 'MORE' : c.button, PAL.gold);
}

// ---------------------------------------------------------------------------
// THE CAMP STAGE — its own ground, its own light, double the texel density.
// One prerendered floor (painted once, seeded) + live water, furniture and
// the HD tripper, all in stage coordinates under a fixed x2 view.
// ---------------------------------------------------------------------------

var campGround = null;

function buildCampGround() {
  var T4 = 4;                                 // stage texels per unit
  var c = document.createElement('canvas');
  c.width = CAMP.W * T4; c.height = CAMP.H * T4;
  var g = c.getContext('2d');
  var rnd = rngFrom(CAMP.groundSeed);   // this SITE's floor, its own every time

  var i, x, y;

  // forest floor: a gradient from deep woods at the top to open grass at the
  // clearing, in the overworld's own diagonal mottle so the two worlds rhyme
  for (y = 0; y < c.height; y += 3) {
    for (x = 0; x < c.width; x += 3) {
      var deepness = Math.max(0, 1 - y / (c.height * 0.55));
      var v = (((x / 3) | 0) * 7 + ((y / 3) | 0) * 13 + (((x / 3) | 0) * ((y / 3) | 0)) % 5) % 9;
      var col = v === 0 ? PAL.grassDk : PAL.grass;
      if (deepness > 0.55) col = v < 3 ? PAL.forest : PAL.grassDk;
      if (deepness > 0.8) col = v < 7 ? PAL.forest : PAL.grassDk;
      g.fillStyle = col;
      g.fillRect(x, y, 3, 3);
    }
  }
  // organic speckle over the hatch
  for (i = 0; i < 2600; i++) {
    var sx2 = rnd() * c.width, sy2 = rnd() * c.height;
    var sv = rnd();
    g.fillStyle = sv > 0.6 ? PAL.grassDk : sv > 0.3 ? PAL.pineLt : PAL.forest;
    g.fillRect(sx2, sy2, 1 + rnd() * 2, 1 + rnd());
  }

  // the clearing: trodden ground lightening toward the fire ring
  var fx = CAMP.fire.x * T4, fy = CAMP.fire.y * T4;
  for (i = 0; i < 2400; i++) {
    var a = rnd() * Math.PI * 2, r = rnd() * rnd() * 22 * T4;
    g.fillStyle = rnd() > 0.6 ? PAL.trailDk : rnd() > 0.3 ? PAL.trail : PAL.sandDk;
    g.fillRect(fx + Math.cos(a) * r, fy + Math.sin(a) * r * 0.72, 1.6, 1.2);
  }

  // two soft paths only — the stage should read as a place, not a diagram
  function path(x0, y0, x1, y1, w2, density) {
    var steps = 90, s2;
    for (s2 = 0; s2 <= steps; s2++) {
      if (rnd() > density) continue;
      var t2 = s2 / steps;
      var px = (x0 + (x1 - x0) * t2) * T4 + (rnd() - 0.5) * 8;
      var py = (y0 + (y1 - y0) * t2) * T4 + (rnd() - 0.5) * 8;
      g.fillStyle = rnd() > 0.5 ? PAL.trail : PAL.trailDk;
      g.fillRect(px - w2 / 2, py, w2, 2);
    }
  }
  path(CAMP.fire.x, CAMP.fire.y + 3, CAMP.tent.x, CAMP.tent.y + 4, 4, 0.65);
  path(CAMP.fire.x, CAMP.fire.y + 3, CAMP.coveX + 16, shoreY(CAMP.coveX + 16) - 3, 4, 0.65);

  // granite coming through the soil — under every rock, and under a site
  // feature that IS granite (the ledge, the slab and rock tables; note 4),
  // an apron as wide as its map so the outcrop reads as bedrock, not a prop
  var aprons = CAMP.rocks.map(function (r2) { return { x: r2.x, y: r2.y, w: 32 }; });
  var fe = CAMP.feature;
  if (fe && /^hd(Ledge|SlabTable|RockTable)$/.test(fe.sprite) && SPRITES[fe.sprite]) {
    aprons.push({ x: fe.x, y: fe.y, w: Math.max(32, SPRITES[fe.sprite].width) });
  }
  aprons.forEach(function (r2) {
    var gx = r2.x * T4, gy = r2.y * T4, k, n = Math.round(60 * r2.w / 32);
    for (k = 0; k < n; k++) {
      g.fillStyle = rnd() > 0.5 ? PAL.rockDk : PAL.rock;
      g.fillRect(gx - r2.w / 2 + rnd() * r2.w, gy - 7 + rnd() * 14, 2.5, 1.5);
    }
  });

  // THE SHORE, curved: dry sand, wet sand, shallows, then open water —
  // the same shoreY() the collision walks on
  for (x = 0; x < CAMP.W; x++) {
    var syU = shoreY(x);
    var px2 = x * T4;
    g.fillStyle = PAL.sand;
    g.fillRect(px2, (syU - 5) * T4, T4, 5 * T4);
    g.fillStyle = PAL.sandDk;
    g.fillRect(px2, (syU - 1.2) * T4, T4, 1.2 * T4);
    g.fillStyle = PAL.shallow;
    g.fillRect(px2, syU * T4, T4, 3.5 * T4);
    g.fillStyle = PAL.water;
    g.fillRect(px2, (syU + 3.5) * T4, T4, c.height - (syU + 3.5) * T4);
    // sand speckle
    if (x % 2 === 0) {
      g.fillStyle = rnd() > 0.5 ? PAL.sandDk : PAL.sand;
      g.fillRect(px2 + rnd() * T4, (syU - 5 + rnd() * 4.5) * T4, 2, 1);
    }
  }
  // deeper water at the bottom edge
  g.fillStyle = PAL.deep;
  for (x = 0; x < c.width; x += 4) {
    var dv = ((x >> 2) * 7) % 3;
    if (dv === 0) g.fillRect(x, c.height - 8 * T4, 4, 8 * T4);
  }

  // lily pads in the cove's still water — wherever this site's cove is
  for (i = 0; i < 7; i++) {
    var lxu = CAMP.coveX - 14 + rnd() * 26;
    var lx = lxu * T4, ly = (shoreY(lxu) + 6 + rnd() * 8) * T4;
    g.drawImage(SPRITES.lily, lx, ly);
  }
  // a driftwood log on the sand
  g.drawImage(SPRITES.hdDeadfall, 88 * T4, (shoreY(92) - 4) * T4 - 8, 28, 16);

  // grass tufts, thinning toward the clearing
  for (i = 0; i < 46; i++) {
    var tx2 = rnd() * CAMP.W, ty2 = 8 + rnd() * 58;
    if (Math.hypot(tx2 - CAMP.fire.x, ty2 - CAMP.fire.y) < 16) continue;
    g.drawImage(SPRITES.hdTuft, Math.round(tx2 * T4), Math.round(ty2 * T4));
  }

  // a soft vignette so the stage feels held, not cropped
  var vg = g.createRadialGradient(c.width / 2, c.height * 0.45, c.width * 0.25,
                                  c.width / 2, c.height * 0.45, c.width * 0.62);
  vg.addColorStop(0, 'rgba(6,12,8,0)');
  vg.addColorStop(1, 'rgba(6,12,8,0.34)');
  g.fillStyle = vg;
  g.fillRect(0, 0, c.width, c.height);

  campGround = c;
}

/** Draw an HD sprite at stage coords: 4 texels per unit, native density. */
function drawHD(name, x, y, k) {
  var s = SPRITES[name];
  var sc = (k || 1) / 4;
  R.g.drawImage(s, x - s.width * sc / 2, y - s.height * sc / 2, s.width * sc, s.height * sc);
}

/**
 * An HD sprite standing on its ink base at stage y (camp trees, k=1);
 * flip mirrors it left-right about its own centre.
 */
function drawHDBased(name, x, baseY, flip) {
  var s = SPRITES[name];
  var y = baseY + spritePad(s) / 4 - s.height / 8;
  if (!flip) { drawHD(name, x, y); return; }
  R.g.save();
  R.g.translate(x, y);
  R.g.scale(-1, 1);
  R.g.drawImage(s, -s.width / 8, -s.height / 8, s.width / 4, s.height / 4);
  R.g.restore();
}

var HD_CARRY_CYCLE = ['hdCarryWood1', 'hdCarryStand', 'hdCarryWood2', 'hdCarryStand'];
// v0.9.2: the food barrel is HUGGED, not floated — same cadence as the wood
// (Evrtek: "make it more like a carrying animation similar to the logs")
var HD_CARRY_BARREL_CYCLE = ['hdCarryBarrel1', 'hdCarryBarrelStand', 'hdCarryBarrel2', 'hdCarryBarrelStand'];

/** The pile at the ring grows through three maps as the split logs stack up. */
function woodPileSprite(n) {
  return n >= 10 ? 'hdWoodPile3' : n >= 5 ? 'hdWoodPile2' : 'hdWoodPile1';
}

// where the barrel rope leaves the big pine, in stage units off the TREE's
// ink base (CAMP.trees, not the hang point six units in front of it):
// hdBigPine's limb stub is rows 46-48 of 104 = 56 texels = 14 units up, and
// reaches cols 30-45 of 48 = 1.5..5.25 units out from the trunk centre
var CAMP_LIMB = { dx: 4, up: 14 };

/** The camp tree the barrel hangs from: the one standing at the hang point. */
function barrelPineTree() {
  var bp = CAMP.barrelPine, best = null, bd = Infinity;
  CAMP.trees.forEach(function (t) {
    var d = Math.hypot(t.x - bp.x, t.y - bp.y);
    if (d < bd) { bd = d; best = t; }
  });
  return best || bp;
}

function drawCampScene(state, nowMs) {
  if (!campGround) buildCampGround();
  var g = R.g;
  var sZ = 2;                                 // stage units -> art units
  var Vw = R.artW / sZ, Vh = R.artH / sZ;
  var cx = CAMP.W <= Vw ? (CAMP.W - Vw) / 2
    : Math.max(0, Math.min(CAMP.W - Vw, state.player.x - Vw / 2));
  var cy = CAMP.H <= Vh ? (CAMP.H - Vh) / 2
    : Math.max(0, Math.min(CAMP.H - Vh, state.player.y - Vh / 2));
  // snapped to the stage's own texel grid (RES*sZ texels per stage unit) so
  // a scrolling stage on a phone does not wobble either (note 17)
  cx = Math.round(cx * RES * sZ) / (RES * sZ);
  cy = Math.round(cy * RES * sZ) / (RES * sZ);

  // night ground behind the letterbox
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#0a140d';
  g.fillRect(0, 0, R.fb.width, R.fb.height);

  g.setTransform(RES * sZ, 0, 0, RES * sZ, -cx * RES * sZ, -cy * RES * sZ);

  g.drawImage(campGround, 0, 0, CAMP.W * 4, CAMP.H * 4, 0, 0, CAMP.W, CAMP.H);

  // live water: lap lines tracing the curved shore, ripples drifting below
  var t = nowMs / 1000, i;
  g.fillStyle = 'rgba(240,246,250,0.45)';
  for (i = 0; i < CAMP.W; i += 7) {
    var lap = Math.sin(t * 1.6 + i * 0.4) * 1.1;
    g.fillRect(i + (i % 14 ? 2 : 0), shoreY(i) + 1.2 + lap, 5, 0.5);
  }
  g.fillStyle = PAL.ripple;
  for (i = 0; i < 26; i++) {
    var h2 = (i * 2654435761) >>> 0;
    var wx2 = (h2 % CAMP.W), wy2 = shoreY(h2 % CAMP.W) + 6 + (h2 >>> 8) % 12;
    if (Math.sin(t * 1.2 + i) > 0.2) g.fillRect(wx2, wy2, 3, 0.5);
  }

  // The wood marker (note 21, Evrtek's play note): the first armload of the
  // trip is told where it goes, in the same orange dots the campsite targets
  // use — a ground decal, so it goes down before the sorted stage list and
  // the ring stones and the pile stand on top of it. It lifts the moment
  // STACK THE WOOD fires, and never returns this trip.
  if (state.woodMarker === 1) {
    dotRing(CAMP.fire.x, CAMP.fire.y + 1, 9,
      0.55 + 0.25 * Math.sin(nowMs / 200), nowMs, 0.9);
  }

  var ch = state.campSession.chores;
  var list = [];
  var put = function (y, f) { list.push({ y: y, f: f }); };

  // the forest wall along the top — overlapping crowns, back rows first;
  // every tree stands on its ink base at tr.y (note 3), so a taller map
  // grows upward from the same footing and keeps its sort key
  CAMP.treeline.forEach(function (tr) {
    put(tr.y + 5, function () { drawHDBased(tr.kind, tr.x, tr.y); });
  });
  CAMP.trees.forEach(function (tr) {
    // the big pine's limb stub is authored on the RIGHT; on the mirrored
    // sites the tree stands at stage right, so flip it and the limb (and
    // the rope from it) stays inboard, over the hang point
    var flip = tr.kind === 'hdBigPine' && tr.x > CAMP.W / 2;
    put(tr.y + 5, function () { drawHDBased(tr.kind, tr.x, tr.y, flip); });
  });
  CAMP.rocks.forEach(function (r2) {
    put(r2.y, function () { drawHD('hdRock', r2.x, r2.y); });
  });
  // the site's curiosity (note 4), standing on its ink base like a tree —
  // its map carries pad rows under the ground line, so the clawed birch
  // grows up from its foot and the ledge lies flat on the ground
  if (CAMP.feature && SPRITES[CAMP.feature.sprite]) {
    put(CAMP.feature.y, function () { drawHDBased(CAMP.feature.sprite, CAMP.feature.x, CAMP.feature.y); });
  }
  // the woodpile beside the ring: the visible reason for every haul (#10)
  if (ch.wood > 0) {
    // v0.9.2: the piles grew to 28 texels wide, so the pile stands one unit
    // further out — its left edge clears the ring's stones
    put(CAMP.fire.y + 3, function () { drawHD(woodPileSprite(ch.wood), CAMP.fire.x + 8, CAMP.fire.y + 3); });
  }
  put(CAMP.canoe.y, function () { drawHD('hdCanoeSide', CAMP.canoe.x, CAMP.canoe.y, 1.3); });
  put(CAMP.sign.y, function () { drawHD('hdSign', CAMP.sign.x, CAMP.sign.y - 2, 1.2); });
  put(CAMP.fire.y, function () { drawHD('hdRing', CAMP.fire.x, CAMP.fire.y, 1.8); });
  if (ch.fire) {
    put(CAMP.fire.y + 0.5, function () {
      var fu = state.campSession.fireFuel || 0;
      if (fu <= 0.15) {
        // coals only — both views agree the fire is nearly gone
        var pg = R.g.createRadialGradient(CAMP.fire.x, CAMP.fire.y, 0.5, CAMP.fire.x, CAMP.fire.y, 5);
        var pa = 0.35 + 0.15 * Math.sin(nowMs / 320);
        pg.addColorStop(0, 'rgba(232,110,40,' + pa.toFixed(2) + ')');
        pg.addColorStop(1, 'rgba(232,110,40,0)');
        R.g.fillStyle = pg;
        R.g.fillRect(CAMP.fire.x - 5, CAMP.fire.y - 5, 10, 10);
      } else {
        var fsc = 1.5 * (0.75 + Math.min(12, fu) * 0.05);
        drawHD((Math.floor(nowMs / 150) % 2) ? 'hdFire1' : 'hdFire2', CAMP.fire.x, CAMP.fire.y - 3, fsc);
      }
    });
  }
  if (!ch.barrel && !state.campSession.carryingBarrel) {
    var bp = state.campSession.barrelPos || CAMP.barrel;
    // v0.9.2: the drum's ink now runs 4 texels past the map's centre (it used
    // to stop there), so lift it by those 4 texels (1.5 stage units at k=1.5)
    // and its foot stands exactly where it stood — at the mirrored sites the
    // barrel otherwise came down onto the sign board (burnt, raggedisle,
    // penisle: sign at {58,64}, barrel at {60,56})
    put(bp.y, function () { drawHD('hdBarrel', bp.x, bp.y - 1.5, 1.5); });
  }
  if (ch.tent) {
    put(CAMP.tent.y + 2, function () { drawHD('hdTent', CAMP.tent.x, CAMP.tent.y - 3, 1.15); });
  } else {
    // an unpitched tent is a BUNDLE on the pad, not a ghost rectangle —
    // the dashed outline read as "tent already pitched" (Evrtek)
    put(CAMP.tent.y, function () { drawHD('hdTentBundle', CAMP.tent.x, CAMP.tent.y, 1.4); });
  }
  // the dead trees: snags standing, logs lying — bucked rounds once chopped
  (state.campSession.sources || []).forEach(function (sc) {
    put(sc.y + (sc.kind === 'snag' ? 4 : 1), function () {
      if (sc.done) drawHD('hdDeadfall', sc.x, sc.y + (sc.kind === 'snag' ? 3 : 0), 1.3);
      else if (sc.kind === 'snag') drawHD('hdSnag', sc.x, sc.y, 1.1);
      else drawHD('hdFallenLog', sc.x, sc.y, 1.2);
    });
  });
  // wood chips in the air, over everything
  put(999, function () {
    R.g.fillStyle = PAL.sand;
    (state.campSession.chips || []).forEach(function (cp) {
      R.g.fillRect(cp.x - 0.4, cp.y - 0.3, 0.9, 0.7);
    });
  });
  if (ch.barrel) put(CAMP.barrelPine.y, function () {
    // the rope runs from the big pine's limb (inboard, 14 units up the
    // trunk from the TREE's base) down to the top of the hung barrel's own
    // short rope (note 3)
    var bh = SPRITES.hdBarrelHung, bp2 = CAMP.barrelPine, pt = barrelPineTree();
    var inboard = bp2.x < CAMP.W / 2 ? 1 : -1;
    var topY = bp2.y - 3 - bh.height * 1.3 / 8;
    R.g.strokeStyle = PAL.trunkLt;
    R.g.lineWidth = 0.5;
    R.g.beginPath();
    R.g.moveTo(pt.x + inboard * CAMP_LIMB.dx, pt.y - CAMP_LIMB.up);
    R.g.lineTo(bp2.x, topY + 0.5);
    R.g.stroke();
    drawHD('hdBarrelHung', bp2.x, bp2.y - 3, 1.3);
  });
  put(CAMP.box.y, function () { drawHD('hdBox', CAMP.box.x, CAMP.box.y, 1.3); });
  put(CAMP.bench.y, function () { drawHD('hdBench', CAMP.bench.x, CAMP.bench.y, 1.5); });

  // the camp's small lives (#15)
  (state.campSession.critters || []).forEach(function (cr) {
    put(cr.y, function () {
      var spr = SPRITES[cr.kind];
      var hop = cr.phase === 'pause' ? 0 : Math.abs(Math.sin(cr.anim * 2)) * 1.0;
      R.g.save();
      R.g.translate(cr.x, cr.y - hop);
      R.g.scale(cr.face || 1, 1);
      R.g.drawImage(spr, -spr.width / 8, -spr.height / 8, spr.width / 4, spr.height / 4);
      R.g.restore();
    });
  });

  // the tripper — UPRIGHT at all times (Evrtek: a fixed camera never tips
  // the actor); left/right movement mirrors the sprite, that is all
  put(state.player.y, function () {
    var p = state.player;
    // arms under a stack of split logs — or around the food barrel: the
    // carry set replaces the walk set, it is never an overlay
    var cycle = state.campSession.carryingBarrel ? HD_CARRY_BARREL_CYCLE
      : state.campSession.carryingWood > 0 ? HD_CARRY_CYCLE : HD_WALK_CYCLE;
    var frame = p.speed > 1 ? cycle[Math.floor(p.anim / 1.4) % 4] : cycle[1];
    var spr = SPRITES[frame];
    R.g.save();
    R.g.translate(p.x, p.y);
    R.g.scale(p.face || 1, 1);
    R.g.drawImage(spr, -spr.width / 8, -spr.height / 8, spr.width / 4, spr.height / 4);
    if (state.campSession.chopT > 0) {
      // the swing: raised behind the shoulder, driven down through impact
      var pr2 = Math.min(1, state.campSession.chopT / 0.26);
      var ang2 = -2.0 + pr2 * pr2 * 2.3;
      var ax2 = SPRITES.hdAxe;
      R.g.save();
      R.g.translate(2.4, -1.6);                   // grip, in mirrored space
      R.g.rotate(ang2);
      R.g.drawImage(ax2, -ax2.width / 8, -ax2.height / 4 + 0.6, ax2.width / 4, ax2.height / 4);
      R.g.restore();
    }
    R.g.restore();
  });

  list.sort(function (a, b) { return a.y - b.y; });
  list.forEach(function (e) { e.f(); });

  // firelight, breathing — down to a murmur over embers
  if (ch.fire) {
    var fuG = state.campSession.fireFuel || 0;
    var glow = g.createRadialGradient(CAMP.fire.x, CAMP.fire.y, 2, CAMP.fire.x, CAMP.fire.y, 30);
    var breathe = (0.24 + 0.06 * Math.sin(t * 5)) * (fuG <= 0.15 ? 0.35 : 1);
    glow.addColorStop(0, 'rgba(242,193,75,' + breathe.toFixed(3) + ')');
    glow.addColorStop(1, 'rgba(242,193,75,0)');
    g.fillStyle = glow;
    g.fillRect(CAMP.fire.x - 32, CAMP.fire.y - 32, 64, 64);
  }

  // the day's light lies over the stage too — the SAME eleven-stop curve the
  // overworld runs on, so dusk falls here at the same minute it falls there
  g.setTransform(RES, 0, 0, RES, 0, 0);
  drawDayTint(state);

  // and after dark the stage contracts to the circle the fire can hold: a
  // second night layer everywhere EXCEPT around a lit fire
  var hNow = state.clock / 60;
  if (hNow > 19.8 || hNow < 5.5) {
    var na = Math.min(0.42, (hNow > 19.8 ? (hNow - 19.8) : (5.5 - hNow)) * 0.5);
    g.setTransform(RES * sZ, 0, 0, RES * sZ, -cx * RES * sZ, -cy * RES * sZ);
    if (ch.fire) {
      var dark = g.createRadialGradient(CAMP.fire.x, CAMP.fire.y, 14, CAMP.fire.x, CAMP.fire.y, 55);
      dark.addColorStop(0, 'rgba(6,9,20,0)');
      dark.addColorStop(1, 'rgba(6,9,20,' + na.toFixed(3) + ')');
      g.fillStyle = dark;
      g.fillRect(cx - 2, cy - 2, R.artW / sZ + 4, R.artH / sZ + 4);
    } else {
      g.fillStyle = 'rgba(6,9,20,' + na.toFixed(3) + ')';
      g.fillRect(cx - 2, cy - 2, R.artW / sZ + 4, R.artH / sZ + 4);
    }
    g.setTransform(RES, 0, 0, RES, 0, 0);
  }
}

/** A short fade from black on every side of the scene switch. */
function drawFade(state, nowMs) {
  if (!state.fadeT) return;
  var a = 1 - (nowMs - state.fadeT) / 350;
  if (a <= 0) return;
  var g = R.g;
  g.setTransform(RES, 0, 0, RES, 0, 0);
  g.globalAlpha = Math.min(1, a);
  g.fillStyle = '#06090c';
  g.fillRect(0, 0, R.artW, R.artH);
  g.globalAlpha = 1;
}

/**
 * The title screen (v0.9.2). Yori's painting owns the whole framebuffer —
 * draw() paints SCENE_PAINTERS.title under the RES transform BEFORE present(),
 * the same pattern the Highway 60 shelf uses — so this pass only lays the
 * words and the pill on top, in the layout that composition proposes: the sky
 * (top 40%) is calm for the title, subtitle and tagline, and on TALL screens
 * (H >= 1.15*W) for the three hint lines too; on WIDE screens the hints sit
 * bottom-left over the dark near bank. The pill's row at 84% is quiet water
 * under the wake — nothing in the painting is drawn there. Nothing here
 * writes into S (tickGame returns early for 'title').
 */
function drawTitle(nowMs) {
  var W = R.artW, H = R.artH, l;

  var title = fitText("PADDLER'S PARADISE", W - 8, 20, 14);   // phones: shrink, never clip
  var tall = H >= W * 1.15;
  var ty = Math.round(H * (tall ? 0.09 : 0.06));
  text(title.text, W / 2, ty, PAL.gold, title.size, 'center');
  text('an Algonquin canoe trip', W / 2, ty + title.size + 6, PAL.white, 8, 'center');
  text('paddle · portage · camp before dark', W / 2, ty + title.size + 18, PAL.white, 7, 'center');

  var lines = [
    'MOVE   WASD / arrows / touch-drag',
    'ACT    E / tap the button',
    'MAP    M   ·   SNACK  Q',
  ];
  var py = Math.round(H * 0.84);
  // ONE size for all three lines — the smallest that fits the widest — so a
  // 160-unit floor screen shrinks the block instead of clipping a line, and
  // the rows stay a matched set instead of going ragged
  var hs = 7;
  for (l = 0; l < lines.length; l++) hs = Math.min(hs, fitText(lines[l], W - 16, 7, 6).size);
  var hpitch = hs + 3;                                        // 10 at size 7, as drawn
  if (tall) {
    var hy = Math.max(Math.round(H * 0.27), ty + title.size + 32);
    for (l = 0; l < lines.length; l++) text(lines[l], W / 2, hy + l * hpitch, PAL.white, hs, 'center');
  } else {
    var hy2 = py - (hpitch * lines.length + 4);               // ends 4 units above the pill
    for (l = 0; l < lines.length; l++) text(lines[l], 8, hy2 + l * hpitch, PAL.white, hs, 'left');
  }

  R.buttons = {};
  R.buttons.action = { x: W / 2 - 56, y: py, w: 112, h: 18, isAction: true };
  pill(R.buttons.action.x, py, 112, 18, 'CHOOSE A PARK',
    Math.floor(nowMs / 500) % 2 ? PAL.gold : PAL.white);
  // the Outfitter is hidden for now (Evrtek) — OUTFIT.enabled brings back
  // the pill and the O key; the dials and saved overrides keep working
  if (OUTFIT.enabled) {
    R.buttons.outfit = { x: W - 56, y: H - 22, w: 52, h: 16 };
    pill(R.buttons.outfit.x, R.buttons.outfit.y, 52, 16, 'OUTFIT', PAL.white);
  }
}

/**
 * The Highway 60 park screen (pass 6, the shelf of #1): what the game is,
 * in three lines, then one card per park in PARKS order — west to east along
 * the highway — each headed by its launch lake, the trip name beneath, the
 * review fleet's own record and your best. The road strip is already in the
 * framebuffer (draw() paints SCENE_PAINTERS.highway60 under this pass); the
 * cards keep off it, the footer sits on its sky, and the road has no hit
 * rect — a mis-tap on it does nothing. Nothing here writes into S.
 */
function shelfRoadH() {
  // clamp(round(artH*0.18), 44, 72) — stacked cards (portrait) cap it at 56,
  // so a 188x406 phone keeps its 87-unit cards and their blurb lines
  // (critic.md: 'road strip ~56 px on phones, cards ~81 px'; as built the
  // phone lands on 87 u with up to three blurb lines once the intro is two)
  var cap = R.artW >= 280 ? 72 : 56;
  return Math.max(44, Math.min(cap, Math.round(R.artH * 0.18)));
}

/** 'Highway 60 · km 14.1 north' — the side only where two parks share a marker. */
function accessLine(park) {
  var a = park.access, shared = false, j;
  for (j = 0; j < PARKS.length; j++) {
    if (PARKS[j] !== park && PARKS[j].access.hwyKm === a.hwyKm) shared = true;
  }
  return 'Highway 60 · km ' + a.hwyKm + (shared && a.side ? ' ' + a.side : '');
}

function drawParks(state, nowMs) {
  var g = R.g;
  var roadH = shelfRoadH(), roadTop = R.artH - roadH;

  text('CHOOSE YOUR PARK', R.artW / 2, 6, PAL.gold, 11, 'center');
  // the how-and-why, wrapped to the screen like everything else (fleet:
  // it clipped both edges on portrait phones); its first two lines when the
  // cards stack (the phone budget), all three on a row — and paid for out
  // of vertical SLACK, never out of the cards: lines drop until a row keeps
  // its blurb (78) or a stack its minimum (58). A flat `artH < 200` gate
  // used to skip it on every maximised desktop (1080p is 320x180, which
  // has room for two lines); the 240x135 pane still lands on none.
  var intro = [
    'Paddle the old routes. Portage between lakes. Look at what is worth looking at.',
    'Camp before dark: tent, firewood, dinner, and hang the barrel — bears audit.',
    'Meals refill you, daylight spends fast, and everything you do earns points.',
  ];
  var short = R.artH < 200;
  // a row of three from 280 wide — and on any short screen (three stacked
  // cards never fit 135 units: the 960x540 window at dpr 1 is 240x135)
  var row = R.artW >= 280 || short;
  var minCh = 58;
  var maxIW = R.artW - 16;
  function layout(asRow) {
    var L = { introLines: [], top: 20, chh: 0 }, n = asRow ? intro.length : 2, need = asRow ? 78 : minCh, i2;
    for (;;) {
      L.introLines = [];
      var iy = 22;
      for (i2 = 0; i2 < n; i2++) {
        var lines2 = wrapText(intro[i2], maxIW, 6.5);
        L.introLines.push(lines2);
        iy += lines2.length * 9 + 1;
      }
      L.top = n ? iy + 4 : 20;
      L.chh = asRow ? Math.min(100, R.artH - L.top - roadH - 10)
                    : Math.floor((R.artH - L.top - roadH - 8) / 3) - 5;
      if (L.chh >= need || n === 0) break;
      n--;
    }
    return L;
  }
  var L = layout(row);
  // three stacked cards that cannot clear the strip even at 58 fall back to
  // the row (the sweep's 200..248-tall band — a 176x210 window put card 3
  // over the strip and past the screen bottom; as a row its 48-wide cards
  // all fit). Only under ~130 units tall does the row itself run short.
  if (!row && L.chh < minCh && L.top + PARKS.length * (minCh + 6) - 6 > roadTop - 2) { row = true; L = layout(true); }
  var introLines = L.introLines, top = L.top, chh = L.chh, ii, li2;
  if (chh < minCh) chh = minCh;
  var ty = 22;
  for (ii = 0; ii < introLines.length; ii++) {
    for (li2 = 0; li2 < introLines[ii].length; li2++) {
      text(introLines[ii][li2], R.artW / 2, ty, 'rgba(242,242,232,0.85)', 6.5, 'center');
      ty += 9;
    }
    ty += 1;
  }

  R.buttons = {};
  var cw = row ? Math.floor((R.artW - 32) / 3) : Math.min(R.artW - 16, 230);
  var tall = chh >= 72;                 // room for the km line under the title
  var i;
  for (i = 0; i < PARKS.length; i++) {
    var pk = PARKS[i], tr = pk.trip;
    var x = row ? 8 + i * (cw + 8) : (R.artW - cw) / 2;
    var y = row ? top : top + i * (chh + 6);
    R.buttons['park' + i] = { x: x, y: y, w: cw, h: chh };
    g.fillStyle = PAL.uiBg;
    g.fillRect(x, y, cw, chh);
    g.strokeStyle = PAL.gold;
    g.lineWidth = 2 / R.scale;
    g.strokeRect(x + 0.5, y + 0.5, cw - 1, chh - 1);
    // the launch lake in gold, the access marker, the trip's name in white
    var nm = fitText(pk.name, cw - 6, 7.5, 6);        // three-across cards are narrow
    text(nm.text, x + cw / 2, y + 4, PAL.gold, nm.size, 'center');
    if (tall) {                          // fitted like its siblings: 61 u of text on a 56-wide row card
      var al = fitText(accessLine(pk), cw - 6, 5, 4);
      text(al.text, x + cw / 2, y + 13, 'rgba(242,242,232,0.65)', al.size, 'center');
    }
    var tn = fitText(tr.name, cw - 6, 6, 5);
    text(tn.text, x + cw / 2, y + (tall ? 21 : 13), PAL.white, tn.size, 'center');
    // the blurb, wrapped to the card, as many lines as end above the facts
    // (up to three on the phone's 87-unit cards, four on a 100, one at 78);
    // a blurb with more lines than room ends in an ellipsis on its last
    // shown line — never cut mid-sentence, never 'over the 2,170'
    if (chh >= 78) {
      var lines = wrapText(tr.blurb, cw - 14, 6);
      var maxL = Math.floor((chh - 71) / 8) + 1, wi;
      for (wi = 0; wi < lines.length && wi < maxL; wi++) {
        var bl = lines[wi];
        if (wi === maxL - 1 && lines.length > maxL) {
          // trimmed at a word, not a letter ('home —…', never 'th…')
          var bw = bl.split(' ');
          g.font = uiFont(6);
          while (bw.length > 1 && g.measureText(bw.join(' ') + '…').width > cw - 14) bw.pop();
          bl = bw.join(' ').replace(/[\s—·,;:-]+$/, '') + '…';
        }
        text(bl, x + cw / 2, y + 30 + wi * 8, PAL.white, 6, 'center');
      }
    }
    var facts = tr.facts.split(' · ');
    // the small lines shrink rather than spill on the narrowest row cards
    var f0 = fitText(facts[0], cw - 6, 5, 4);
    text(f0.text, x + cw / 2, y + chh - 34, 'rgba(242,242,232,0.65)', f0.size, 'center');
    if (facts[1]) {
      var f1 = fitText(facts[1], cw - 6, 5, 4);
      text(f1.text, x + cw / 2, y + chh - 27, 'rgba(242,242,232,0.65)', f1.size, 'center');
    }
    var best = tripBest(tr.id);
    var fr = fitText('FLEET RECORD ' + (tr.fleetScore || '—'), cw - 6, 5.5, 4);
    text(fr.text, x + cw / 2, y + chh - 18, PAL.gold, fr.size, 'center');
    var yb = fitText('YOUR BEST ' + (best || '—'), cw - 6, 5.5, 4);
    text(yb.text, x + cw / 2, y + chh - 9, best > (tr.fleetScore || 0) ? PAL.good : PAL.white, yb.size, 'center');
  }
  // the footer sits on the strip's sky, and only where the last card leaves
  // it the room (pass 1's rule: never over a card)
  var cardsBot = row ? top + chh : top + PARKS.length * (chh + 6) - 6;
  if (cardsBot <= roadTop - 2) {
    text('tap a launch lake — or press 1, 2, 3', R.artW / 2, roadTop + 2, 'rgba(18,41,26,0.9)', 6, 'center');
  }
}
var drawTrips = drawParks;   // the old name, kept

// --- the park map ------------------------------------------------------------------

function drawMap(state) {
  var g = R.g;
  g.fillStyle = 'rgba(8,12,10,0.9)';
  g.fillRect(0, 0, R.artW, R.artH);

  var pad = 8;
  var vertical = R.artW < 340;               // phone portrait: stack, not split
  var sc = vertical
    ? Math.min((R.artW - pad * 2) / WORLD.W, (R.artH * 0.55) / WORLD.H)
    : Math.min((R.artW * 0.55) / WORLD.W, (R.artH - pad * 2) / WORLD.H);
  var mw = WORLD.W * sc, mh = WORLD.H * sc;
  var mx = vertical ? (R.artW - mw) / 2 : pad;
  var my = vertical ? 10 : (R.artH - mh) / 2;
  g.drawImage(R.terrain, 0, 0, WORLD.W * RES, WORLD.H * RES, mx, my, mw, mh);
  g.strokeStyle = PAL.gold; g.strokeRect(mx + 0.5, my + 0.5, mw - 1, mh - 1);

  // labels, on each lake's label pole (note 15). Pass 5 sweep: the stacked
  // PC map (artW < 340) is 56-74 px wide, so a name is kept inside the gold
  // frame by its measured width (drawLakeNames' rule) and the big lakes are
  // named first — a small lake whose name would print over one already
  // there gives way instead (Rock's 'Pen' sat under 'Galipo River')
  var placed = [];
  var order = LAKE_POLYS.slice().sort(function (a, b) { return (b.big ? 1 : 0) - (a.big ? 1 : 0); });
  g.font = uiFont(6);
  order.forEach(function (l) {
    var s = l.label.replace(' Lake', '');
    var w = g.measureText(s).width;
    var lx = mx + l.lx * sc, ly = my + l.ly * sc - 3, i2;
    if (w >= mw - 2) lx = mx + mw / 2;
    else lx = Math.min(Math.max(lx, mx + w / 2 + 1), mx + mw - w / 2 - 1);
    var box = { x0: lx - w / 2, x1: lx + w / 2, y0: ly, y1: ly + 6 };
    for (i2 = 0; i2 < placed.length; i2++) {
      var p = placed[i2];
      if (box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0) return;
    }
    placed.push(box);
    text(s, lx, ly, PAL.white, 6, 'center');
  });

  // the vistas, marked and named (#2) — gold until you have looked; the
  // hidden lookout only once it has been (note 8), the board never (note 21)
  g.textAlign = 'left';
  INSPECTS.forEach(function (p) {
    var seen = !!state.seenPOIs[p.scene];
    if (p.info || (p.hidden && !seen)) return;
    var px = mx + p.x * sc, py2 = my + p.y * sc;
    g.fillStyle = seen ? 'rgba(242,242,232,0.55)' : PAL.gold;
    g.fillRect(px - 0.8, py2 - 2.2, 1.6, 4.4);
    g.fillRect(px - 2.2, py2 - 0.8, 4.4, 1.6);
  });

  // you, and where you are bound — while camped, the player stands in
  // STAGE coordinates; the overworld truth is the saved return point
  var ppos = state.campSession && state.campReturn ? state.campReturn : state.player;
  g.fillStyle = PAL.bad;
  g.fillRect(mx + ppos.x * sc - 1, my + ppos.y * sc - 1, 3, 3);
  var t = currentTarget();
  if (t) {
    g.fillStyle = PAL.gold;
    g.fillRect(mx + t[0] * sc - 1, my + t[1] * sc - 1, 3, 3);
  }

  // the journal lives on its own pages now (note 12): one tally line here —
  // beside the map on wide screens, under it on phones — and the freed
  // column is what used to run off the bottom of a portrait screen
  var jx = vertical ? 10 : mx + mw + 10;
  var jy = vertical ? my + mh + 8 : my + 2;
  text('TRIP JOURNAL', jx, jy, PAL.gold, 8);
  var sumW = R.artW - jx - 8, si;
  var sum = wrapText(journalTally() + ' — read the journal at camp', sumW, 6);
  for (si = 0; si < sum.length; si++) text(sum[si], jx, jy + 12 + si * 9, PAL.white, 6);

  R.buttons = {};
  R.buttons.map = { x: R.artW - 30, y: 4, w: 26, h: 14 };
  pill(R.buttons.map.x, R.buttons.map.y, 26, 14, 'BACK', PAL.white);
}

/**
 * Sleep arriving (#8): the lids come down over whatever you were watching,
 * soft-edged, over about a second and a half — then the night takes over.
 */
function drawEyelids(state, nowMs) {
  var g = R.g;
  var p = Math.min(1, (nowMs - state.eyesT) / 1700);
  p = p * p * (3 - 2 * p);                        // ease: heavy at the end
  var cover = R.artH * 0.58 * p;
  if (cover < 2) return;
  g.fillStyle = '#020303';
  g.fillRect(0, 0, R.artW, Math.max(0, cover - 6));
  g.fillRect(0, R.artH - Math.max(0, cover - 6), R.artW, cover);
  var grT = g.createLinearGradient(0, cover - 7, 0, cover + 5);
  grT.addColorStop(0, '#020303');
  grT.addColorStop(1, 'rgba(2,3,3,0)');
  g.fillStyle = grT;
  g.fillRect(0, cover - 7, R.artW, 12);
  var yB = R.artH - cover;
  var grB = g.createLinearGradient(0, yB + 7, 0, yB - 5);
  grB.addColorStop(0, '#020303');
  grB.addColorStop(1, 'rgba(2,3,3,0)');
  g.fillStyle = grB;
  g.fillRect(0, yB - 5, R.artW, 12);
}
