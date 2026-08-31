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
  prerenderTerrain();
}

function onResize() {
  var dpr = Math.min(2, window.devicePixelRatio || 1);
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

// --- terrain, once -----------------------------------------------------------

function prerenderTerrain() {
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

  // the dock: planks into Canoe Lake, drawn at texel resolution
  g.fillStyle = PAL.dock;
  g.fillRect((POIS.dock.x - 3) * RES, (POIS.dock.y - 16) * RES, 6 * RES, 20 * RES);
  g.fillStyle = PAL.dockDk;
  for (var py = POIS.dock.y - 14; py < POIS.dock.y + 2; py += 3) {
    g.fillRect((POIS.dock.x - 3) * RES, py * RES, 6 * RES, 1);
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

function text(str, x, y, col, size, align) {
  // Regular text, per Evrtek: the UI pass renders at device resolution, so
  // this is a real font drawn crisp — only the WORLD is pixel art.
  R.g.font = '600 ' + (size || 7) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  R.g.textAlign = align || 'left';
  R.g.textBaseline = 'top';
  R.g.fillStyle = 'rgba(8,12,10,0.75)';
  R.g.fillText(str, x + 0.5, y + 0.5);
  R.g.fillStyle = col || PAL.white;
  R.g.fillText(str, x, y);
}

function speakerPill(x, y, w, h, muted) {
  var g = R.g;
  g.fillStyle = PAL.uiBg;
  g.fillRect(x, y, w, h);
  g.strokeStyle = PAL.white;
  g.lineWidth = 2 / R.scale;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  var cx = x + w / 2 - 3, cy = y + h / 2;
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

function pill(x, y, w, h, label, col) {
  R.g.fillStyle = PAL.uiBg;
  R.g.fillRect(x, y, w, h);
  R.g.strokeStyle = col || PAL.gold;
  R.g.lineWidth = 2 / R.scale;
  R.g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  text(label, x + w / 2, y + (h - 7) / 2 + 0.5, col || PAL.gold, 7, 'center');
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



  if (state.mode === 'title') {
    present();                       // clears to the framebuffer (empty)
    uiPass(function () { drawTitle(nowMs); });
    return;
  }

  if (state.mode === 'trips') {
    present();
    uiPass(function () { drawTrips(state, nowMs); });
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

  drawCampRings(state, nowMs);
  drawWater(state, nowMs);
  drawPoiBeckons(state, nowMs);
  drawEntities(state, nowMs);
  if (state.squall) drawRain(state, nowMs);
  drawDayTint(state);
  drawFade(state, nowMs);

  present();
  uiPass(function () {
    drawLakeNames(state);
    drawMarker(state, nowMs);
    if (state.mapOpen) drawMap(state);
    else drawHUD(state, nowMs);
    if (state.mode === 'card') drawCard(state);
  });
}

/**
 * Lake names, laid gently over the middle of their water (#8): regular text,
 * semi-transparent white, so you always know what you are paddling.
 */
function drawLakeNames(state) {
  if (state.mapOpen || state.mode === 'card') return;
  var g = R.g;
  LAKE_POLYS.forEach(function (l) {
    var x = (l.cx - R.camX) * R.cz, y = (l.cy - R.camY) * R.cz;
    if (x < -80 || x > R.artW + 80 || y < -20 || y > R.artH + 20) return;
    var size = l.big ? 13 : 9;
    g.font = '600 ' + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(10,20,26,0.25)';
    g.fillText(l.name.toUpperCase(), x + 0.5, y + 0.5);
    g.fillStyle = 'rgba(255,255,255,0.38)';
    g.fillText(l.name.toUpperCase(), x, y);
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
    var seen = !!state.seenPOIs[p.scene];
    var bob = Math.sin(nowMs / 320 + p.x * 0.1) * 1.6;
    var x = sx(p.x), y = sy(p.y) - 11 + bob;
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
 * The MAKE CAMP target, visible but subtle (#17): a slow ring of orange dots
 * on the ground at each campsite, waking up when you are close enough.
 */
function drawCampRings(state, nowMs) {
  var g = R.g;
  CAMPSITES.forEach(function (c) {
    if (c.x < R.camX - 30 || c.x > R.camX + R.viewW + 30 ||
        c.y < R.camY - 30 || c.y > R.camY + R.viewH + 30) return;
    var d = Math.hypot(state.player.x - c.x, state.player.y - c.y);
    var hot = d < 24 && state.travel !== 'canoe';
    var a = hot ? 0.55 + 0.25 * Math.sin(nowMs / 200) : 0.3;
    var rot = nowMs / 4000, i;
    g.fillStyle = 'rgba(226,115,31,' + a.toFixed(3) + ')';
    for (i = 0; i < 12; i++) {
      var an = rot + (i / 12) * Math.PI * 2;
      g.fillRect(sx(c.x) + Math.cos(an) * 10 - 0.5, sy(c.y) + Math.sin(an) * 10 - 0.5, 1.5, 1.5);
    }
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

  // trees in view (TREES is y-sorted; simple filter is fast enough)
  for (var i = 0; i < TREES.length; i++) {
    var tr = TREES[i];
    if (tr.y < R.camY - 14 || tr.y > R.camY + R.viewH + 12) continue;
    if (tr.x < R.camX - 8 || tr.x > R.camX + R.viewW + 8) continue;
    list.push({ y: tr.y, f: drawTree, a: tr });
  }

  // signs at landings & POIs
  LANDINGS.forEach(function (l) {
    if (l.kind === 'portage') list.push({ y: l.y, f: function (o) { drawSprite('portSign', o.x, o.y - 4); }, a: l });
  });
  CAMPSITES.forEach(function (c) {
    list.push({ y: c.y, f: function (o) { drawSprite('campSign', o.x + 8, o.y - 2); }, a: c });
  });
  list.push({ y: POIS.board.y, f: function () { drawSprite('board', POIS.board.x, POIS.board.y - 4); }, a: null });
  list.push({ y: POIS.cairn.y, f: function () { drawSprite('rock', POIS.cairn.x, POIS.cairn.y); }, a: null });

  // beaver lodges out in the shallows (#9)
  (state.huts || []).forEach(function (h) {
    list.push({ y: h.y, f: function (o) { drawSprite('hut', o.x, o.y); }, a: h });
  });

  // the canoe, when beached
  if (state.canoe.beached) {
    list.push({ y: state.canoe.y, f: function () { drawSprite('canoeBeached', state.canoe.x, state.canoe.y); }, a: null });
  }

  if (state.campfire && !state.campSession) {
    list.push({ y: state.campfire.y, f: function () {
      drawSprite((Math.floor(nowMs / 160) % 2) ? 'fire1' : 'fire2', state.campfire.x, state.campfire.y);
    }, a: null });
  }

  // wildlife
  state.animals.forEach(function (a) {
    if (!animalActive(a) || a.state === 'gone') return;
    var name = a.species === 'Moose' ? 'moose'
      : a.species === 'Common Loon' ? 'loon'
      : a.species === 'Great Blue Heron' ? 'heron'
      : a.species === 'Beaver' ? 'beaver'
      : a.species === 'River Otter' ? 'otter'
      : a.species === 'White-tailed Deer' ? 'deer'
      : a.species === 'Bald Eagle' ? 'eagle'
      : a.species === 'Belted Kingfisher' ? 'kingfisher'
      : a.species === 'Black Bear' ? 'bear'
      : a.species === 'Red-tailed Hawk' ? 'hawk' : 'turtle';
    list.push({ y: a.y, f: function (an) { drawSprite(name, an.x, an.y); }, a: a });
  });

  // splashes and other short-lived things
  state.fx.forEach(function (fx2) {
    list.push({ y: fx2.y, f: function (o) { drawSprite(o.sprite, o.x, o.y); }, a: fx2 });
  });

  // the bobber, while the line is in
  if (state.fish) {
    var bx = state.player.x + Math.cos(state.player.ang) * 10;
    var by = state.player.y + Math.sin(state.player.ang) * 10;
    list.push({ y: by, f: function () {
      var vx = sx(bx), vy = sy(by);      // viewport space, like everything else
      R.g.fillStyle = state.fish.phase === 'strike' ? PAL.bad : PAL.white;
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

function drawTree(tr) {
  drawSprite(tr.kind === 'pine' ? 'pine' : 'birch', tr.x, tr.y - 5);
}

function drawPlayer(state) {
  var p = state.player;
  var frame;
  var rot = p.ang + Math.PI / 2;          // sprites face up
  if (state.travel === 'canoe') {
    frame = (Math.floor(p.anim / 6) % 2) ? 'canoeL' : 'canoeR';
    drawSprite(frame, p.x, p.y, rot);
  } else if (state.travel === 'carry') {
    frame = (Math.floor(p.anim / 5) % 2) ? 'carry1' : 'carry2';
    drawSprite(frame, p.x, p.y, rot);
  } else {
    frame = p.speed > 1 ? ((Math.floor(p.anim / 5) % 2) ? 'walk1' : 'walk2') : 'stand';
    drawSprite(frame, p.x, p.y, rot);
  }
}

function drawMarker(state, nowMs) {
  var t = currentTarget();
  if (!t || state.mode !== 'play') return;
  if (state.campSession) return;          // the evening needs no compass
  var bob = Math.sin(nowMs / 240) * 2;
  var mx = sx(t[0]) * R.cz, my = (sy(t[1]) - 14 + bob) * R.cz;
  var on = mx > 8 && mx < R.artW - 8 && my > 8 && my < R.artH - 8;
  if (on) {
    var ms = SPRITES.marker;
    R.g.drawImage(ms, mx - ms.width / (2 * RES), my - ms.height / (2 * RES), ms.width / RES, ms.height / RES);
  } else {
    // pinned to the screen edge, pointing the way
    var cx = R.artW / 2, cy = R.artH / 2;
    var dx = t[0] - state.player.x, dy = t[1] - state.player.y;
    var len = Math.hypot(dx, dy) || 1;
    var ux = dx / len, uy = dy / len;
    var kx = ux !== 0 ? (R.artW / 2 - 14) / Math.abs(ux) : Infinity;
    var ky = uy !== 0 ? (R.artH / 2 - 14) / Math.abs(uy) : Infinity;
    var k = Math.min(kx, ky);
    var ex = cx + ux * k;
    var ey = cy + uy * k;
    // keep the pinned marker out from under the HUD panels
    ey = Math.max(40, Math.min(R.artH - 30, ey));
    ex = Math.max(12, Math.min(R.artW - 36, ex));
    R.g.save();
    R.g.translate(Math.round(ex), Math.round(ey));
    R.g.rotate(Math.atan2(dy, dx) + Math.PI / 2);
    var mp = SPRITES.marker;
    R.g.drawImage(mp, -mp.width / (2 * RES), -mp.height / (2 * RES), mp.width / RES, mp.height / RES);
    R.g.restore();
    text(Math.round(len / 8) * 10 + ' m', Math.round(ex), Math.round(ey) + 6, PAL.gold, 7, 'center');
  }
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
  text('E', 70, 13, PAL.white);
  // food + snacks
  var fx = 6;
  for (var i = 0; i < state.food; i++) { g.fillStyle = PAL.gold; g.fillRect(fx, 23, 4, 4); fx += 6; }
  text('MEALS', fx + 2, 22, PAL.white);

  // (the wind gauge is hidden for now, per Evrtek — the wind itself still
  // blows; the drawing can come back when the HUD earns the room)

  // top-right: speaker beside MAP (#6)
  R.buttons.map = { x: R.artW - 30, y: 4, w: 26, h: 14 };
  pill(R.buttons.map.x, R.buttons.map.y, 26, 14, 'MAP', PAL.white);
  R.buttons.mute = { x: R.artW - 56, y: 4, w: 22, h: 14 };
  speakerPill(R.buttons.mute.x, R.buttons.mute.y, 22, 14, AUDIO.isMuted());

  // the two full-width bars (#5): quest on the bottom edge, the single
  // current notification directly above it
  var barH = 12;
  var obj = OBJS[state.objIndex];
  g.fillStyle = PAL.uiBg;
  g.fillRect(0, R.artH - barH, R.artW, barH);
  if (obj) text('★ ' + obj.text, R.artW / 2, R.artH - barH + 2.5, PAL.gold, 7, 'center');
  g.fillStyle = 'rgba(12,20,16,0.72)';
  g.fillRect(0, R.artH - barH * 2, R.artW, barH);
  if (state.toasts.length) {
    text(state.toasts[0].text, R.artW / 2, R.artH - barH * 2 + 2.5, PAL.white, 7, 'center');
  }

  // context action button, snug against the notification bar (#5)
  var act = contextAction();
  if (act) {
    var label = act.label + ' (E)';
    var aw = Math.max(64, label.length * 5 + 12);
    var maxW = R.artW - (state.snacks > 0 ? 72 : 8);
    if (aw > maxW) {
      aw = maxW;
      var fit = Math.max(6, Math.floor((aw - 10) / 5) - 1);
      if (label.length > fit) label = label.slice(0, fit) + '…';
    }
    R.buttons.action = { x: R.artW - aw - 3, y: R.artH - barH * 2 - 17, w: aw, h: 16, isAction: true };
    pill(R.buttons.action.x, R.buttons.action.y, aw, 16, label, PAL.gold);
  }

  // the sky button, when the sky has something to say (#6) — in open play
  // only; during cards and fishing the button routed nowhere good
  if (state.lookUp && state.mode === 'play') {
    R.buttons.lookup = { x: R.artW / 2 - 42, y: 34, w: 84, h: 16 };
    pill(R.buttons.lookup.x, R.buttons.lookup.y, 84, 16, '✦ LOOK UP (L)', PAL.gold);
  }

  // snack button, snug bottom-left (#5)
  if (state.snacks > 0) {
    R.buttons.snack = { x: 3, y: R.artH - barH * 2 - 17, w: 62, h: 16 };
    pill(R.buttons.snack.x, R.buttons.snack.y, 62, 16, 'SNACK×' + state.snacks + ' (Q)', PAL.white);
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
  g.font = '600 7px system-ui, -apple-system, sans-serif';
  var leftPill = R.buttons.addwood ? R.buttons.addwood.x : R.buttons.action.x;
  var maxw = Math.min(R.artW * 0.55, leftPill - 14);
  var aboveRow = false;
  if (maxw < R.artW * 0.34) {          // narrow phones: climb above the pills
    maxw = R.artW * 0.6;
    aboveRow = true;
  }
  var words = state.scene.caption.split(' ');
  var lines = [], line = '';
  words.forEach(function (w) {
    var t2 = line ? line + ' ' + w : w;
    if (g.measureText(t2).width > maxw && line) { lines.push(line); line = w; }
    else line = t2;
  });
  if (line) lines.push(line);
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

function drawCard(state) {
  var g = R.g, c = state.card;
  if (c.kind === 'end' && c.score) { drawScoreCard(state); return; }
  g.fillStyle = 'rgba(8,12,10,0.78)';
  g.fillRect(0, 0, R.artW, R.artH);
  var w = Math.min(R.artW - 16, 230);
  var hh = Math.max(96, 24 + c.lines.length * 11 + 28);
  var x = (R.artW - w) / 2, y = Math.round((R.artH - hh) / 2);
  g.fillStyle = PAL.uiBg; g.fillRect(x, y, w, hh);
  g.strokeStyle = PAL.gold; g.strokeRect(x + 0.5, y + 0.5, w - 1, hh - 1);
  text(c.title, R.artW / 2, y + 7, PAL.gold, 9, 'center');
  for (var i = 0; i < c.lines.length; i++) {
    text(c.lines[i], R.artW / 2, y + 24 + i * 11, PAL.white, 7, 'center');
  }
  R.buttons = {};
  R.buttons.action = { x: R.artW / 2 - 44, y: y + hh - 22, w: 88, h: 16, isAction: true };
  pill(R.buttons.action.x, R.buttons.action.y, 88, 16, c.button, PAL.gold);
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

  // granite coming through the soil
  CAMP.rocks.forEach(function (r2) {
    var gx = r2.x * T4, gy = r2.y * T4, k;
    for (k = 0; k < 60; k++) {
      g.fillStyle = rnd() > 0.5 ? PAL.rockDk : PAL.rock;
      g.fillRect(gx - 16 + rnd() * 32, gy - 7 + rnd() * 14, 2.5, 1.5);
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

function drawCampScene(state, nowMs) {
  if (!campGround) buildCampGround();
  var g = R.g;
  var sZ = 2;                                 // stage units -> art units
  var Vw = R.artW / sZ, Vh = R.artH / sZ;
  var cx = CAMP.W <= Vw ? (CAMP.W - Vw) / 2
    : Math.max(0, Math.min(CAMP.W - Vw, state.player.x - Vw / 2));
  var cy = CAMP.H <= Vh ? (CAMP.H - Vh) / 2
    : Math.max(0, Math.min(CAMP.H - Vh, state.player.y - Vh / 2));

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

  var ch = state.campSession.chores;
  var list = [];
  var put = function (y, f) { list.push({ y: y, f: f }); };

  // the forest wall along the top — overlapping crowns, back rows first
  CAMP.treeline.forEach(function (tr) {
    put(tr.y + 5, function () { drawHD(tr.kind, tr.x, tr.y); });
  });
  CAMP.trees.forEach(function (tr) {
    put(tr.y + 5, function () { drawHD(tr.kind, tr.x, tr.y); });
  });
  CAMP.rocks.forEach(function (r2) {
    put(r2.y, function () { drawHD('hdRock', r2.x, r2.y); });
  });
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
    put(bp.y, function () { drawHD('hdBarrel', bp.x, bp.y, 1.5); });
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
  if (ch.barrel) put(CAMP.barrelPine.y, function () { drawHD('hdBarrelHung', CAMP.barrelPine.x, CAMP.barrelPine.y - 3, 1.3); });
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
    var frame = p.speed > 1 ? ((Math.floor(p.anim / 5) % 2) ? 'hdWalk1' : 'hdWalk2') : 'hdStand';
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
    if (state.campSession.carryingBarrel) drawHD('hdBarrel', p.x, p.y - 4.5, 1.2);
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

function drawTitle(nowMs) {
  var g = R.g;
  g.fillStyle = '#12291a';
  g.fillRect(0, 0, R.artW, R.artH);
  // a quiet lake band with ripples
  g.fillStyle = PAL.water;
  g.fillRect(0, R.artH * 0.62, R.artW, R.artH * 0.38);
  g.fillStyle = PAL.ripple;
  for (var i = 0; i < 30; i++) {
    var h = (i * 2654435761) >>> 0;
    var x = (h % R.artW), y = R.artH * 0.62 + (h % Math.round(R.artH * 0.34));
    if (Math.sin(nowMs / 900 + i) > 0.2) g.fillRect(x, y, 4, 1);
  }
  g.drawImage(SPRITES.pine, 14, Math.round(R.artH * 0.62) - 12, SPRITES.pine.width / RES, SPRITES.pine.height / RES);
  g.drawImage(SPRITES.birch, 32, Math.round(R.artH * 0.62) - 11, SPRITES.birch.width / RES, SPRITES.birch.height / RES);
  g.drawImage(SPRITES.canoeL, Math.round(R.artW * 0.7), Math.round(R.artH * 0.74), SPRITES.canoeL.width / RES, SPRITES.canoeL.height / RES);

  R.g.font = '800 20px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  text("PADDLER'S PARADISE", R.artW / 2, R.artH * 0.18, PAL.gold, 20, 'center');
  text('an Algonquin canoe trip', R.artW / 2, R.artH * 0.18 + 24, PAL.white, 8, 'center');
  text('paddle · portage · camp before dark', R.artW / 2, R.artH * 0.2 + 40, PAL.white, 7, 'center');

  var lines = [
    'MOVE   WASD / arrows / touch-drag',
    'ACT    E / tap the button',
    'MAP    M   ·   SNACK  Q',
  ];
  for (var l = 0; l < lines.length; l++) {
    text(lines[l], R.artW / 2, R.artH * 0.52 + l * 10, PAL.white, 7, 'center');
  }

  R.buttons = {};
  R.buttons.action = { x: R.artW / 2 - 56, y: Math.round(R.artH * 0.84), w: 112, h: 18, isAction: true };
  if (Math.floor(nowMs / 500) % 2) pill(R.buttons.action.x, R.buttons.action.y, 112, 18, 'CHOOSE A TRIP', PAL.gold);
  else pill(R.buttons.action.x, R.buttons.action.y, 112, 18, 'CHOOSE A TRIP', PAL.white);
  // the Outfitter is hidden for now (Evrtek) — OUTFIT.enabled brings back
  // the pill and the O key; the dials and saved overrides keep working
  if (OUTFIT.enabled) {
    R.buttons.outfit = { x: R.artW - 56, y: R.artH - 22, w: 52, h: 16 };
    pill(R.buttons.outfit.x, R.buttons.outfit.y, 52, 16, 'OUTFIT', PAL.white);
  }
}

/**
 * The trip shelf (#1): what the game is, in three lines, then three trips —
 * each with the review fleet's own record and your best beside it.
 */
function drawTrips(state, nowMs) {
  var g = R.g;
  g.fillStyle = '#12291a';
  g.fillRect(0, 0, R.artW, R.artH);
  g.fillStyle = 'rgba(30,86,122,0.35)';
  g.fillRect(0, R.artH * 0.9, R.artW, R.artH * 0.1);

  text('CHOOSE YOUR TRIP', R.artW / 2, 6, PAL.gold, 11, 'center');
  // the how-and-why, wrapped to the screen like everything else (fleet:
  // it clipped both edges on portrait phones), and skipped when the
  // window is too short to afford it
  var g2 = R.g;
  var intro = [
    'Paddle the old routes. Portage between lakes. Look at what is worth looking at.',
    'Camp before dark: tent, firewood, dinner, and hang the barrel — bears audit.',
    'Meals refill you, daylight spends fast, and everything you do earns points.',
  ];
  var iy = 22, ii, iw;
  var short = R.artH < 200;
  if (!short) {
    g2.font = '600 6.5px system-ui, -apple-system, sans-serif';
    var maxIW = R.artW - 16;
    for (ii = 0; ii < intro.length; ii++) {
      var words = intro[ii].split(' ');
      var lines2 = [], ln = '';
      for (iw = 0; iw < words.length; iw++) {
        var t3 = ln ? ln + ' ' + words[iw] : words[iw];
        if (g2.measureText(t3).width > maxIW && ln) { lines2.push(ln); ln = words[iw]; }
        else ln = t3;
      }
      if (ln) lines2.push(ln);
      var li2;
      for (li2 = 0; li2 < lines2.length; li2++) {
        text(lines2[li2], R.artW / 2, iy, 'rgba(242,242,232,0.85)', 6.5, 'center');
        iy += 9;
      }
      iy += 1;
    }
  }

  R.buttons = {};
  var top = short ? 20 : iy + 4;
  var row = R.artW >= 280;
  var cw = row ? Math.floor((R.artW - 32) / 3) : Math.min(R.artW - 16, 230);
  var chh = row ? Math.max(88, R.artH - top - 26) : Math.floor((R.artH - top - 14) / 3) - 6;
  if (row && chh > 130) chh = 130;
  if (chh < 62) chh = 62;
  var i;
  for (i = 0; i < TRIPS.length; i++) {
    var tr = TRIPS[i];
    var x = row ? 8 + i * (cw + 8) : (R.artW - cw) / 2;
    var y = row ? top : top + i * (chh + 6);
    R.buttons['trip' + i] = { x: x, y: y, w: cw, h: chh };
    g.fillStyle = PAL.uiBg;
    g.fillRect(x, y, cw, chh);
    g.strokeStyle = PAL.gold;
    g.lineWidth = 2 / R.scale;
    g.strokeRect(x + 0.5, y + 0.5, cw - 1, chh - 1);
    text(tr.name, x + cw / 2, y + 5, PAL.gold, 7.5, 'center');
    // blurb, wrapped to the card
    g.font = '600 6px system-ui, -apple-system, sans-serif';
    var words = tr.blurb.split(' ');
    var lines = [], line = '';
    var wi;
    for (wi = 0; wi < words.length; wi++) {
      var t2 = line ? line + ' ' + words[wi] : words[wi];
      if (g.measureText(t2).width > cw - 14 && line) { lines.push(line); line = words[wi]; }
      else line = t2;
    }
    if (line) lines.push(line);
    var ly2 = y + 17;
    if (chh >= 84) {
      for (wi = 0; wi < lines.length; wi++) {
        text(lines[wi], x + cw / 2, ly2 + wi * 8, PAL.white, 6, 'center');
      }
    }
    var facts = tr.facts.split(' · ');
    text(facts[0], x + cw / 2, y + chh - 34, 'rgba(242,242,232,0.65)', 5, 'center');
    if (facts[1]) text(facts[1], x + cw / 2, y + chh - 27, 'rgba(242,242,232,0.65)', 5, 'center');
    var best = tripBest(tr.id);
    text('FLEET RECORD ' + (tr.fleetScore || '—'), x + cw / 2, y + chh - 18, PAL.gold, 5.5, 'center');
    text('YOUR BEST ' + (best || '—'), x + cw / 2, y + chh - 9, best > (tr.fleetScore || 0) ? PAL.good : PAL.white, 5.5, 'center');
  }
  text('tap a trip — or press 1, 2, 3', R.artW / 2, R.artH - 10, 'rgba(242,242,232,0.6)', 6, 'center');
}

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

  // labels
  g.font = '700 6px monospace'; g.textAlign = 'left';
  LAKES.forEach(function (l) {
    var cx = 0, cy = 0;
    l.pts.forEach(function (p) { cx += p[0]; cy += p[1]; });
    cx /= l.pts.length; cy /= l.pts.length;
    text(l.name.replace(' Lake', ''), mx + cx * sc, my + cy * sc - 3, PAL.white, 6, 'center');
  });

  // the vistas, marked and named (#2) — gold until you have looked
  g.textAlign = 'left';
  INSPECTS.forEach(function (p) {
    var seen = !!state.seenPOIs[p.scene];
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

  // the journal — beside the map on wide screens, under it on phones
  var jx = vertical ? 10 : mx + mw + 10;
  var jy = vertical ? my + mh + 8 : my + 2;
  text('TRIP JOURNAL', jx, jy, PAL.gold, 8);
  if (state.journal.length === 0) text('nothing yet — move gently', jx, jy + 12, PAL.white, 6);
  var agg = {}, order = [];
  state.journal.forEach(function (j) {
    if (!agg[j.species]) { agg[j.species] = { n: 0, days: [] }; order.push(j.species); }
    agg[j.species].n++;
    if (agg[j.species].days.indexOf(j.day) < 0) agg[j.species].days.push(j.day);
  });
  var shown = order.slice(0, 11);
  shown.forEach(function (spec, i) {
    var a = agg[spec];
    var lab = '• ' + spec + (a.n > 1 ? ' ×' + a.n : '') + '  (day ' + a.days.join(', ') + ')';
    text(lab, jx, jy + 12 + i * 9, PAL.white, 6);
  });
  if (order.length > shown.length) {
    text('… and ' + (order.length - shown.length) + ' more', jx, jy + 12 + shown.length * 9, PAL.white, 6);
  }
  var ly = jy + 12 + Math.max(1, Math.min(order.length + (order.length > 11 ? 1 : 0), 12)) * 9 + 8;
  text('TRIP LOG', jx, ly, PAL.gold, 8);
  state.log.slice(-4).forEach(function (line, i) {
    text(line.length > 34 ? line.slice(0, 33) + '…' : line, jx, ly + 12 + i * 9, PAL.white, 6);
  });

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
