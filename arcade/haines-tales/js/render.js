'use strict';
// ---------------------------------------------------------------------------
// Camera and drawing.
//
// Everything is drawn into a small fixed-height pixel buffer and upscaled by
// the GPU. The visible height is a slider now: doubling the carrier's height
// halved how much world you could see, and how zoomed in a platformer feels is
// not something you can settle on paper.
// ---------------------------------------------------------------------------

var VIEW_H = 496;                 // default backbuffer height, overridden by TUNE
var ASPECT_MIN = 1.48, ASPECT_MAX = 2.60;

var view = { w: 880, h: VIEW_H };
var Cam = { x: 0, y: 0, prevX: 0, prevY: 0 };

var back = null, bx = null;       // backbuffer canvas + context

var PAL = {
  sky0: '#4d9ad6', sky1: '#bcdcef',
  far: '#9dbdd4', near: '#7ca2be',
  rock: '#9aa3ab', rockTop: '#d3d9dc', rockDark: '#6d757d',
  oneway: '#a97f4f', onewayTop: '#dcb27c',
  // The three paving kinds added 2026-09-23, and the two new platform styles.
  // These exist ONLY so the new kinds read differently from each other before
  // Yori's tiles2.png lands — placeholder rectangles, the same as everything
  // else in this palette, and they go quiet the moment the sheet arrives.
  cobble: '#8f8b86', cobbleTop: '#b8b2aa', cobbleJoint: '#6a6560',
  planks: '#9a7348', planksTop: '#c4995f', planksJoint: '#6f5030',
  stone: '#9ba0a8', stoneTop: '#c8ccd2', stoneJoint: '#71767e',
  grate: '#7d8896', grateTop: '#aab6c6', grateSlot: '#333b46',
  platStone: '#98a0a8', platStoneTop: '#c6ccd2', platStoneDark: '#6b727a',
  // 2026-09-24, the same job for tiles3.png, blocks.png, houses2.png and
  // huts.png: three jungle pavings, three platform styles, three new block
  // styles and two house sets, each told apart from its neighbours until the
  // sheet lands. Placeholders, not a look.
  moss: '#5f8f3e', mossDark: '#3f6b2a',
  mud: '#4a3526', mudShine: '#7a5c44', mudDark: '#2f2118',
  sand: '#d8b77a', sandLine: '#b8955a', sandJoint: '#a0804a',
  log: '#7b5230', logTop: '#a8784a', logBark: '#553820',
  vine: '#3d7a34', vineTop: '#6fb45a', vineLeaf: '#4f9a3f',
  scafBoard: '#bfa05a', scafTube: '#8e99a4', scafTubeTop: '#c9d2da', scafClamp: '#4d5660',
  barrel: '#8a5a32', barrelDark: '#6b4424', barrelRim: '#b07c4a', barrelHoop: '#3b3f46',
  steel: '#8c97a3', steelHi: '#c3ccd6', steelLo: '#59636e', steelRivet: '#3e4650',
  wicker: '#c9a45a', wickerDark: '#9c7a3a', wickerRim: '#7d5e2a',
  blockCrack: '#2a211b',
  house2: '#9a4f3c', house2Trim: '#5b3a30', stoop: '#8a8f96',
  hutPost: '#6b4a2b', hutFloor: '#7b5a36', hutWall: '#b08a4e', hutSlat: '#8c6a38',
  thatch: '#c9a54e', thatchDark: '#a88637', hutDoor: '#3a2a1a',
  spike: '#c2506b', spikeDark: '#7e2f45',
  skin: '#e8b48c', cloth: '#3f6fa8', clothDark: '#2d5183',
  cap: '#24406b', bag: '#c19553', bagDark: '#96713c', shade: '#1b2433',
  mail: '#f0ead8', mailFlap: '#b9ae93',
  aim: '#ffd27a',
  dogBody: '#9a7550', dogDark: '#6b4f33', dogLight: '#c19a6b',
  dogNose: '#241c14', dogEye: '#ffe08a',
  hpFill: '#e2564e', hpTop: '#ff9184', hpFrame: '#141c2b',
  hpEmpty: '#2a3448', hpGhost: '#3d4a63',
  brick: '#b07f61', brickTop: '#d6a37e', brickDark: '#7b543c', brickDust: '#e0c0a4',
  itemGlow: '#ffe6a3', parcel: '#b98a5a', parcelTape: '#e7d9bd',
  satchel: '#c19553', glass: '#d9a45c', gummy: '#e06aa0',
  blast: '#ffc86b',
  post: '#8b96a4', boxBody: '#4b7fb5', boxDark: '#35608f', flag: '#e2564e',
  lid: '#aab6c6', bin: '#5d8a63', binDark: '#3f6146',
  gnomeHat: '#d64b4b', gnomeCoat: '#4e7ab0', gnomeBeard: '#f2f2ea', gnomeStone: '#7c8797',
  droneBody: '#6a7686', droneDark: '#434e5c', droneEye: '#ff6b5e', rotor: '#c6d4e4',
  boxMouth: '#101722', boxEye: '#ffe08a',
  pandaFur: '#79838f', pandaMask: '#222831', pandaLight: '#b3bdc8',
  bossCoat: '#2b4a7a', bossTrim: '#cfe1f5', bossSack: '#c19553',
  truck: '#dfe6ee', truckDark: '#9aa7b6', truckGlass: '#6f92b8', truckWheel: '#20262f',
  truckStripe: '#3f6fa8',
  wall: '#d8cbb4', wallDark: '#b3a288', roofTile: '#b25a44', door: '#4b7fb5',
  win: '#8fc4dd', trunk: '#6b4f33', leaf: '#5ca85f', leafDark: '#3f7c46',
  metal: '#a9b4c0', yellow: '#efc63f', sign: '#eef2f6',
  dust: '#cdd9e8'
};

function attachBackbuffer(canvasEl) {
  // The game canvas IS the backbuffer: it is sized in world pixels and the GPU
  // does the upscale from CSS. No per-frame blit, one compositing layer.
  back = canvasEl;
  bx = back.getContext('2d', { alpha: false });
}

function resizeView(cssW, cssH) {
  var vh = Math.max(120 * (TS / 16), (TUNE.viewH | 0) || VIEW_H);
  if (vh % 2) vh++;
  var aspect = cssW / Math.max(1, cssH);
  var w = Math.round(vh * Math.max(ASPECT_MIN, Math.min(ASPECT_MAX, aspect)));
  if (w % 2) w++;                               // even width keeps halves whole
  view.w = w; view.h = vh;
  back.width = view.w; back.height = view.h;
  bx.imageSmoothingEnabled = false;
}

// --- Camera ----------------------------------------------------------------

function clampCamX(x) { return Math.max(0, Math.min(World.px - view.w, x)); }
function clampCamY(y) { return Math.max(0, Math.min(World.py - view.h, y)); }

function camAnchorY() { return view.h * (TUNE.camAnchor || 0.655); }

function camSnap() {
  Cam.x = Cam.prevX = clampCamX(P.x + P.w * 0.5 - view.w * 0.5);
  Cam.y = Cam.prevY = clampCamY(P.y + P.h * 0.5 - camAnchorY());
}

function camStep(dt) {
  Cam.prevX = Cam.x; Cam.prevY = Cam.y;
  // A little look-ahead in the direction of travel: you see where you are
  // going rather than where you have been, which reads as the game keeping up.
  var lead = Math.max(-TS * 2.875, Math.min(TS * 2.875, P.vx * 0.24));
  var tx = clampCamX(P.x + P.w * 0.5 - view.w * 0.5 + lead);
  var ty = clampCamY(P.y + P.h * 0.5 - camAnchorY());
  var kx = 1 - Math.exp(-11 * dt);
  var ky = 1 - Math.exp(-(P.grounded ? 9 : 5.5) * dt);
  Cam.x += (tx - Cam.x) * kx;
  Cam.y += (ty - Cam.y) * ky;
}

// --- Particles: a fixed pool, never allocated after boot -------------------

var PART_MAX = 96;
var Parts = { n: 0, a: [] };
(function () {
  for (var i = 0; i < PART_MAX; i++)
    Parts.a.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, r: 1, c: '#cdd9e8' });
})();

function puff(x, y, vx, vy, n, col) {
  var u = TS / 16;                        // spreads and grain sizes were authored at TS = 16
  for (var i = 0; i < n && Parts.n < PART_MAX; i++) {
    var p = Parts.a[Parts.n++];
    p.x = x; p.y = y;
    p.vx = vx + (Math.random() - 0.5) * 46 * u;
    p.vy = vy + (Math.random() - 0.5) * 34 * u;
    p.max = p.life = 0.22 + Math.random() * 0.24;
    p.r = (1 + (Math.random() * 1.6 | 0)) * u;
    p.c = col || PAL.dust;
  }
}

function partsStep(dt) {
  for (var i = 0; i < Parts.n; i++) {
    var p = Parts.a[i];
    p.life -= dt;
    if (p.life <= 0) {
      var last = Parts.a[--Parts.n];
      Parts.a[Parts.n] = p; Parts.a[i] = last; i--;
      continue;
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 260 * (TS / 16) * dt; p.vx *= 0.94;
  }
}

function drainFx() {
  var mid = P.x + P.w * 0.5, u = TS / 16;   // launch speeds were authored at TS = 16
  if (P.fxLand) { puff(mid, P.y + P.h, 0, -26 * u, 5); P.fxLand = 0; }
  if (P.fxJump) { puff(mid, P.y + P.h, 0, -10 * u, P.fxJump === 2 ? 7 : 4); P.fxJump = 0; }
  if (P.fxWall) { puff(mid, P.y + P.h * 0.6, P.vx * 0.25, 0, 7); P.fxWall = 0; }
  if (P.fxHurt) { puff(mid, P.y + P.h * 0.5, 0, -60 * u, 9, PAL.spike); P.fxHurt = 0; }
  if (P.fxToss) { puff(mid + P.aimX * P.w, P.y + P.h * 0.35, 0, 0, 2, PAL.mail); P.fxToss = 0; }
}

// --- Drawing ---------------------------------------------------------------

var skyGrad = null, skyH = 0;

function drawSky() {
  if (!skyGrad || skyH !== view.h) {
    skyGrad = bx.createLinearGradient(0, 0, 0, view.h);
    skyGrad.addColorStop(0, PAL.sky0);
    skyGrad.addColorStop(1, PAL.sky1);
    skyH = view.h;
  }
  bx.fillStyle = skyGrad;
  bx.fillRect(0, 0, view.w, view.h);
}

// Two parallax bands of blocky shapes. They exist so motion is legible: a
// runway with nothing behind it makes any top speed feel like the same speed.
// The painted far layer, when there is one. It is 1024 px wide and wraps, so it
// draws as however many copies the view needs — at a quarter parallax across a
// 320-tile level that is two to three repeats, which is why it had to be
// seamless rather than merely wide.
//
// Returns false when the sheet is not there and drawParallax falls through to
// its rectangles, the same seam the tiles and the characters use.
function farPainted(cx, cy) {
  // WHICH far layer is the LEVEL's business, not the renderer's. World.background
  // is an id out of the one registry in sprites.js and bgFarClip resolves it to
  // a clip; an id this build has never heard of falls back to the city, and a
  // background whose SHEET is not painted yet fails exactly the way a missing
  // sheet has always failed here — drawParallax draws its rectangles instead.
  var name = bgFarClip(World.background);
  var c = SPR.clips[name];
  if (!c || !sprHas(name)) return false;
  var sheet = SPR.sheets[c.file];
  var f = cx * 0.25;
  // Sat so its horizon lands a little above the middle of the view, and drifting
  // only slightly with the camera: a distant thing that tracks vertical motion
  // one for one stops reading as distant.
  var top = Math.round(view.h * 0.62 - c.h + cy * 0.06);
  var x0 = -(((Math.round(f) % c.w) + c.w) % c.w);
  for (var x = x0; x < view.w; x += c.w)
    bx.drawImage(sheet.img, c.x, c.y, c.w, c.h, x, top, c.w, c.h);
  return true;
}

function drawParallax(cx, cy) {
  var i, x, hgt;
  if (farPainted(cx, cy)) return;
  bx.fillStyle = PAL.far;
  var f = cx * 0.25, base = view.h - 104 + (cy * 0.06);
  for (i = -1; i < 16; i++) {
    x = Math.floor(i * 148 - (f % 148));
    hgt = 60 + ((i * 37) % 5) * 22;
    bx.fillRect(x, Math.floor(base - hgt), 104, hgt + 180);
  }
  bx.fillStyle = PAL.near;
  var n = cx * 0.5; base = view.h - 52 + (cy * 0.12);
  for (i = -1; i < 20; i++) {
    x = Math.floor(i * 106 - (n % 106));
    hgt = 36 + ((i * 29) % 4) * 18;
    bx.fillRect(x, Math.floor(base - hgt), 74, hgt + 180);
  }
}

// Painted tiles, when there are any. Returns false for anything it cannot draw,
// and drawTiles falls through to the rectangles for that one tile — the same
// per-clip seam the characters use, so a half-finished tile sheet still plays.
//
// Which clip a tile gets comes from two things and no others (ruling 42,
// 0.9.0): WHAT IT IS MADE OF — World.mat, World.pstyle or World.bstyle, one per
// tile — and WHAT IS NEXT TO IT. Not its height, not what it is connected to.
// See world.js.
//
// A material's FACE: what it looks like with nothing solid on top of it. For a
// paving that is the paving; for brick it is brick; for cement it is the soffit
// you see from underneath, which is the only face a ceiling ever shows. Indexed
// by SURF_*, and the last two are the tiles brick and ceiling were before they
// were materials — no new art.
var TILE_SURF_CLIP = ['tile.street', 'tile.kerb', 'tile.pavement', 'tile.grass', 'tile.dirt',
                      'tile.cobble', 'tile.planks', 'tile.stone',
                      'tile.moss', 'tile.mud', 'tile.sandstone',
                      'tile.brick', 'tile.roof'];

// What a solid tile is made of. A World built before World.mat existed has
// none, and reads as street, which is what SURF_STREET = 0 has always meant.
function matAt(tx, ty) {
  return World.mat ? World.mat[wIdx(tx, ty)] | 0 : SURF_STREET;
}

// Is the tile next to this one SOLID — the thing that covers a face? Only
// SOLID. A crate, a ledge and spikes all leave the face underneath them on
// show: that is the fix ruling 42 asked for ("if a block or box or crate are
// placed on top of pavers the paver becomes dirt instead"). The edges answer
// as tileAt does: the sides and the top of the world are solid, the bottom open.
function solidAt(tx, ty) { return tileAt(tx, ty) === SOLID; }

// WHAT A ONE-WAY LEDGE IS BUILT OF, by the ledge's own style (per tile since
// 0.9.0, so two ledges in one column can differ).
//
// PLAT_WOOD KEEPS `tile.oneway`, and that is on purpose: tile.oneway is on
// tiles.png, which is PAINTED and in the game today. Pointing wood at a new
// `plat.wood` on a sheet nobody has drawn yet would have taken the game's
// existing planks away and replaced them with rectangles until Yori delivered —
// the opposite of "add variety without repainting anything". The city's
// background keeps the plain `bg.far` name for the same reason. Only the two
// NEW styles need new art.
var PLAT_CLIP = ['tile.oneway', 'plat.grate', 'plat.stone',
                 'plat.log', 'plat.vine', 'plat.scaffold'];

function platStyleAt(tx, ty) {
  return World.pstyle ? World.pstyle[wIdx(tx, ty)] | 0 : PLAT_WOOD;
}

function platClipFor(tx, ty) {
  return PLAT_CLIP[platStyleAt(tx, ty)] || 'tile.oneway';
}

// WHAT A BREAKABLE BLOCK IS MADE OF, by the tile's block style (2026-09-24).
// Indexed by BLOCK_*, one row of blocks.png each.
//
// A CRATE THAT IS NOT PAINTED YET IS `tile.break`, the block in the game today,
// and that is the PLAT_WOOD decision again: tile.break is on tiles.png, painted
// and cracking in its three states right now. Keying crates straight to an
// undrawn block.crate would have swapped level 1's blocks for rectangles until
// Yori delivered. The moment block.crate IS painted it wins, with no edit.
var BLOCK_CLIP = ['block.crate', 'block.barrel', 'block.metal', 'block.basket'];

function blockStyleAt(tx, ty) {
  return World.bstyle ? World.bstyle[wIdx(tx, ty)] | 0 : 0;
}

function blockClipFor(tx, ty) {
  var k = blockStyleAt(tx, ty);
  var clip = BLOCK_CLIP[k] || BLOCK_CLIP[BLOCK_CRATE];
  if (clip === BLOCK_CLIP[BLOCK_CRATE] && !sprHas(clip)) return 'tile.break';
  return clip;
}

// Which variant of a styled block, by POSITION: fixed per tile so it never
// boils, and different from both its neighbours in a row and the one above it,
// so a row of four crates is four different crates. Not tileVariant(): that
// one is weighted towards a plain frame on purpose, and "four identical
// crates" is exactly what a weighting towards one frame produces.
function blockVariant(tx, ty, n) {
  if (n <= 1) return 0;
  return ((tx + 2 * ty) % n + n) % n;
}

function tileClipFor(tx, ty, v) {
  if (v === BREAK) return blockClipFor(tx, ty);
  if (v === ONEWAY) return platClipFor(tx, ty);
  if (v === HAZARD) return 'tile.hazard';
  if (v !== SOLID) return null;
  var k = matAt(tx, ty);
  // BRICK is brick all the way through: a wall looks the same from every side.
  if (k === SURF_BRICK) return 'tile.brick';
  // CEMENT is the ceiling's slab: the face you can see from below is the
  // soffit, and the mass above it is brick. One row of cement, however deep
  // the slab goes — exactly the ceiling 0.8.6 drew, now because the tile is
  // cement and not because it touches the top of the world.
  if (k === SURF_CEMENT) return solidAt(tx, ty + 1) ? 'tile.brick' : 'tile.roof';
  // A PAVING shows its face wherever nothing solid covers it — under open air,
  // a crate, a ledge or spikes alike — and earth where something does. So a
  // street can float, sit on brick, or be stacked three deep in one column, and
  // each one is the street it was painted as.
  if (solidAt(tx, ty - 1)) return 'tile.dirt';
  return TILE_SURF_CLIP[k] || 'tile.street';
}

// Which VARIANT. Fixed per tile position, never random per frame, or the road
// would boil. A cheap integer hash of the coordinates: the same tile is the
// same variant every frame and for the whole run, but neighbours differ.
// How often a tile is the PLAIN frame, per material, as a percentage. A surface
// is a single row a few hundred tiles long, so features on it are punctuation.
// A bulk fill is thousands of tiles stacked fifteen deep, and the same rate
// turns it into wallpaper: at 38% the ceiling grew a standpipe every third
// brick. The rule is the material's AREA, not its taste — the more of it there
// is, the rarer the feature has to be to still read as one.
var TILE_PLAIN = { 'tile.brick': 90, 'tile.dirt': 86, 'tile.roof': 80 };

function tileVariant(tx, ty, n, name) {
  if (n <= 1) return 0;
  var h = (tx * 73856093) ^ (ty * 19349663);
  h = (h ^ (h >>> 13)) >>> 0;
  // WEIGHTED, not uniform. Frame 0 of every row is the plain one and the rest
  // are features — a drain, a water main, a crack, a dandelion. Split evenly,
  // a third of all the earth in the level was exposed water main, which reads
  // as a plumbing diagram rather than as ground. The plain tile has to be the
  // ground and the features have to be occasional.
  if ((h % 100) < (TILE_PLAIN[name] || 62)) return 0;
  return 1 + ((h >>> 9) % (n - 1));
}

function tilePainted(tx, ty, v, sx, sy) {
  var name = tileClipFor(tx, ty, v);
  if (!name) return false;
  var c = SPR.clips[name];
  if (!c) return false;
  var f;
  if (v === BREAK) {
    var maxHp = Math.max(1, TUNE.blockHp | 0);
    var hp = World.bhp[wIdx(tx, ty)] || maxHp;
    if (name !== 'tile.break') {
      // A STYLED BLOCK: its frames are variants, not damage (see BLOCK_CLIP),
      // so the damage is drawn over it here — the same cracks, at the same two
      // thresholds, as the procedural block. The player still counts the hits.
      if (!sprDraw(bx, name, blockVariant(tx, ty, c.frames), sx + TS * 0.5, sy + TS, false)) return false;
      blockCracks(sx, sy, TS / 16, 1 - hp / maxHp, PAL.blockCrack);
      return true;
    }
    // tile.break: the three states are the damage, not decoration: pick by
    // remaining life so the player can count the hits.
    f = Math.min(c.frames - 1, Math.round((1 - hp / maxHp) * (c.frames - 1)));
  } else if (v === HAZARD) {
    f = Math.floor(Level.time * 8) % c.frames;          // animated, and shared so a row pulses together
  } else {
    f = tileVariant(tx, ty, c.frames, name);
  }
  // sprClip defaults a cell origin to (w/2, h), so a tile is placed by its
  // CENTRE-BOTTOM, not its top-left corner.
  return sprDraw(bx, name, f, sx + TS * 0.5, sy + TS, false);
}

// --- placeholders for the kinds that have no art yet ------------------------
//
// Everything below is rectangles, like the rest of this file's fallbacks, and
// every one of them stops being drawn the instant its clip is painted. They are
// not a look: they are three answers to "which of these three did I just
// paint?", which is a question a level author has to be able to answer before
// the art exists or the editor is a set of identical grey stripes.
//
// Each is keyed to the MATERIAL rather than decorated freely — cobble is
// rounded lumps, planks run along the way you walk, stone is big flat slabs —
// so the placeholder and the painted tile will read as the same idea.

function surfFallback(tx, ty, sx, sy, u) {
  var k = matAt(tx, ty);                             // the tile's own material, not its column's (0.9.0)
  var i;
  if (k === SURF_COBBLE) {
    bx.fillStyle = PAL.cobbleTop;
    bx.fillRect(sx, sy, TS, 3 * u);
    bx.fillStyle = PAL.cobbleJoint;
    // Four setts across a tile, and the joints alternate by row so a run of
    // them does not stripe.
    for (i = 0; i < 4; i++) bx.fillRect(sx + i * 4 * u + ((tx & 1) ? 2 * u : 0), sy, 1 * u, 3 * u);
  } else if (k === SURF_PLANKS) {
    bx.fillStyle = PAL.planksTop;
    bx.fillRect(sx, sy, TS, 3 * u);
    bx.fillStyle = PAL.planksJoint;
    bx.fillRect(sx, sy + 1 * u, TS, 1 * u);          // the boards run ALONG the walk
    if (!(tx % 3)) bx.fillRect(sx, sy, 1 * u, 3 * u); // a butt joint every third tile
  } else if (k === SURF_STONE) {
    bx.fillStyle = PAL.stoneTop;
    bx.fillRect(sx, sy, TS, 3 * u);
    bx.fillStyle = PAL.stoneJoint;
    if (!(tx & 1)) bx.fillRect(sx, sy, 1 * u, 3 * u); // big slabs: one joint every two tiles
  } else if (k === SURF_MOSS) {
    bx.fillStyle = PAL.moss;
    bx.fillRect(sx, sy, TS, 3 * u);
    bx.fillStyle = PAL.mossDark;                     // tufts, a different pair per tile
    bx.fillRect(sx + ((tx * 5) % 7) * u, sy + 1 * u, 2 * u, 1 * u);
    bx.fillRect(sx + (8 + (tx * 3) % 6) * u, sy + 2 * u, 2 * u, 1 * u);
  } else if (k === SURF_MUD) {
    bx.fillStyle = PAL.mud;
    bx.fillRect(sx, sy, TS, 3 * u);
    bx.fillStyle = PAL.mudDark;
    bx.fillRect(sx, sy + 2 * u, TS, 1 * u);
    bx.fillStyle = PAL.mudShine;                     // wet: a glint that wanders
    bx.fillRect(sx + ((tx * 5) % 11) * u, sy, 4 * u, 1 * u);
  } else if (k === SURF_SANDSTONE) {
    bx.fillStyle = PAL.sand;
    bx.fillRect(sx, sy, TS, 3 * u);
    bx.fillStyle = PAL.sandLine;
    bx.fillRect(sx, sy + 1 * u, TS, 1 * u);          // the bedding runs along
    bx.fillStyle = PAL.sandJoint;
    if (!(tx % 3)) bx.fillRect(sx + 5 * u, sy, 1 * u, 3 * u); // blocks: a joint every third tile, off the edge
  }
}

function platFallback(tx, ty, sx, sy, u) {
  var k = platStyleAt(tx, ty);                       // the ledge's own style (0.9.0)
  var i;
  if (k === PLAT_GRATE) {
    // Open metal: you can see through it, so it is slotted rather than solid.
    bx.fillStyle = PAL.grate;
    bx.fillRect(sx, sy, TS, 4 * u);
    bx.fillStyle = PAL.grateTop;
    bx.fillRect(sx, sy, TS, 1 * u);
    bx.fillStyle = PAL.grateSlot;
    for (i = 0; i < 4; i++) bx.fillRect(sx + 1 * u + i * 4 * u, sy + 1 * u, 2 * u, 3 * u);
  } else if (k === PLAT_STONE) {
    // A slab: thicker than a plank, and heavier underneath than on top.
    bx.fillStyle = PAL.platStone;
    bx.fillRect(sx, sy, TS, 6 * u);
    bx.fillStyle = PAL.platStoneTop;
    bx.fillRect(sx, sy, TS, 2 * u);
    bx.fillStyle = PAL.platStoneDark;
    bx.fillRect(sx, sy + 5 * u, TS, 1 * u);
  } else if (k === PLAT_LOG) {
    // Round and barked: a lit top, a line of bark, and a knot now and then.
    bx.fillStyle = PAL.log;
    bx.fillRect(sx, sy, TS, 5 * u);
    bx.fillStyle = PAL.logTop;
    bx.fillRect(sx, sy, TS, 1 * u);
    bx.fillStyle = PAL.logBark;
    bx.fillRect(sx, sy + 3 * u, TS, 1 * u);
    if (!(tx % 4)) bx.fillRect(sx + 6 * u, sy + 1 * u, 3 * u, 2 * u);
  } else if (k === PLAT_VINE) {
    // The thinnest ledge: a green line you can land on, leaves hanging off it.
    bx.fillStyle = PAL.vine;
    bx.fillRect(sx, sy, TS, 2 * u);
    bx.fillStyle = PAL.vineTop;
    bx.fillRect(sx, sy, TS, 1 * u);
    bx.fillStyle = PAL.vineLeaf;
    bx.fillRect(sx + ((tx & 1) ? 3 : 9) * u, sy + 2 * u, 2 * u, 3 * u);
    bx.fillRect(sx + ((tx & 1) ? 11 : 2) * u, sy + 2 * u, 2 * u, 2 * u);
  } else if (k === PLAT_SCAFFOLD) {
    // A site board on a steel tube, a clamp where each length meets the next.
    bx.fillStyle = PAL.scafBoard;
    bx.fillRect(sx, sy, TS, 2 * u);
    bx.fillStyle = PAL.scafTube;
    bx.fillRect(sx, sy + 3 * u, TS, 2 * u);
    bx.fillStyle = PAL.scafTubeTop;
    bx.fillRect(sx, sy + 3 * u, TS, 1 * u);
    bx.fillStyle = PAL.scafClamp;
    bx.fillRect(sx, sy + 2 * u, 2 * u, 4 * u);
  } else {
    bx.fillStyle = PAL.oneway;                       // PLAT_WOOD: today's plank, unchanged
    bx.fillRect(sx, sy, TS, 5 * u);
    bx.fillStyle = PAL.onewayTop;
    bx.fillRect(sx, sy, TS, 2 * u);
  }
}

// The damage on a block, drawn the same way whatever the block is made of: a
// first crack past a fifth of its life, falling apart past a little over half.
// These are the rectangles the procedural brick always drew, lifted out so a
// barrel, a steel box and a painted variant crack exactly where a brick does.
function blockCracks(sx, sy, u, gone, colour) {
  bx.fillStyle = colour;
  if (gone > 0.2) {                         // first crack
    bx.fillRect(sx + 2 * u, sy + 2 * u, 1 * u, 4 * u);
    bx.fillRect(sx + 3 * u, sy + 5 * u, 1 * u, 3 * u);
    bx.fillRect(sx + 11 * u, sy + 9 * u, 1 * u, 5 * u);
  }
  if (gone > 0.55) {                        // falling apart
    bx.fillRect(sx + 9 * u, sy + 1 * u, 1 * u, 6 * u);
    bx.fillRect(sx + 5 * u, sy + 10 * u, 4 * u, 1 * u);
    bx.fillRect(sx + 13 * u, sy + 3 * u, 1 * u, 4 * u);
    bx.fillStyle = 'rgba(0,0,0,0.28)';
    bx.fillRect(sx, sy, TS, TS);
  }
}

// Barrel, steel box and basket before blocks.png lands. Each is keyed to the
// thing it is — hoops, rivets, a weave — so the placeholder and the painted
// block read as the same idea. The crate has none: it is the brick below, the
// block the game has always drawn.
function blockFallback(k, tx, ty, sx, sy, u) {
  var i, j;
  if (k === BLOCK_BARREL) {
    bx.fillStyle = PAL.barrel;
    bx.fillRect(sx + 1 * u, sy, 14 * u, TS);
    bx.fillStyle = PAL.barrelDark;                   // the curve, and the staves
    bx.fillRect(sx + 1 * u, sy, 2 * u, TS);
    bx.fillRect(sx + 13 * u, sy, 2 * u, TS);
    bx.fillRect(sx + 6 * u, sy, 1 * u, TS);
    bx.fillRect(sx + 10 * u, sy, 1 * u, TS);
    bx.fillStyle = PAL.barrelRim;
    bx.fillRect(sx + 1 * u, sy, 14 * u, 1 * u);
    bx.fillStyle = PAL.barrelHoop;
    bx.fillRect(sx, sy + 3 * u, TS, 2 * u);
    bx.fillRect(sx, sy + 11 * u, TS, 2 * u);
  } else if (k === BLOCK_METAL) {
    bx.fillStyle = PAL.steel;
    bx.fillRect(sx, sy, TS, TS);
    bx.fillStyle = PAL.steelHi;                      // bevel: lit top and left
    bx.fillRect(sx, sy, TS, 1 * u);
    bx.fillRect(sx, sy, 1 * u, TS);
    bx.fillStyle = PAL.steelLo;                      // and a dark bottom and right: a box, not wall
    bx.fillRect(sx, sy + 15 * u, TS, 1 * u);
    bx.fillRect(sx + 15 * u, sy, 1 * u, TS);
    bx.fillStyle = PAL.steelRivet;
    bx.fillRect(sx + 2 * u, sy + 2 * u, 1 * u, 1 * u);
    bx.fillRect(sx + 13 * u, sy + 2 * u, 1 * u, 1 * u);
    bx.fillRect(sx + 2 * u, sy + 13 * u, 1 * u, 1 * u);
    bx.fillRect(sx + 13 * u, sy + 13 * u, 1 * u, 1 * u);
  } else {                                           // BLOCK_BASKET
    bx.fillStyle = PAL.wicker;
    bx.fillRect(sx, sy, TS, TS);
    bx.fillStyle = PAL.wickerDark;                   // the weave: over one, under one
    for (j = 0; j < 7; j++)
      for (i = 0; i < 8; i++)
        if ((i + j) & 1) bx.fillRect(sx + i * 2 * u, sy + 2 * u + j * 2 * u, 2 * u, 2 * u);
    bx.fillStyle = PAL.wickerRim;
    bx.fillRect(sx, sy, TS, 2 * u);
  }
}

function drawTiles(cx, cy) {
  var x0 = Math.max(0, Math.floor(cx / TS));
  var x1 = Math.min(World.w - 1, Math.ceil((cx + view.w) / TS));
  var y0 = Math.max(0, Math.floor(cy / TS));
  var y1 = Math.min(World.h - 1, Math.ceil((cy + view.h) / TS));
  var u = TS / 16;               // art unit: every tile detail below was authored at TS = 16

  for (var ty = y0; ty <= y1; ty++) {
    for (var tx = x0; tx <= x1; tx++) {
      var v = World.t[wIdx(tx, ty)];
      if (v === EMPTY) continue;
      var sx = tx * TS - cx, sy = ty * TS - cy;

      if (tilePainted(tx, ty, v, sx, sy)) continue;

      if (v === SOLID) {
        bx.fillStyle = PAL.rock;
        bx.fillRect(sx, sy, TS, TS);
        if (tileAt(tx, ty - 1) !== SOLID) {
          bx.fillStyle = PAL.rockTop;
          bx.fillRect(sx, sy, TS, 3 * u);
          // THE THREE NEW PAVINGS GET THEIR OWN PLACEHOLDER, and the five older
          // ones deliberately do not. Before 2026-09-23 every surface fell back
          // to the same grey top face and that was fine, because tiles.png is
          // painted and nobody sees it. Cobble, planks and stone have no sheet
          // yet, so without this they would be three names for one grey stripe
          // in the editor and a level author could not tell what he had
          // painted. Touching the older five would have changed a look that is
          // already agreed for nothing.
          //
          // Only a PAVING wears one (0.9.0): brick and cement are masonry, and
          // before materials were per tile a brick ledge in a cobbled column
          // came out cobbled here.
          var mk = matAt(tx, ty);
          if (mk !== SURF_BRICK && mk !== SURF_CEMENT) surfFallback(tx, ty, sx, sy, u);
        }
        // One dark line on the inside edges reads as depth for two fills.
        bx.fillStyle = PAL.rockDark;
        if (tileAt(tx - 1, ty) !== SOLID) bx.fillRect(sx, sy + 3 * u, 1 * u, TS - 3 * u);
        if (tileAt(tx + 1, ty) !== SOLID) bx.fillRect(sx + TS - 1 * u, sy + 3 * u, 1 * u, TS - 3 * u);
      } else if (v === ONEWAY) {
        platFallback(tx, ty, sx, sy, u);
      } else if (v === BREAK) {
        var maxHp = Math.max(1, TUNE.blockHp | 0);
        var left = World.bhp[wIdx(tx, ty)] || maxHp;
        var gone = 1 - left / maxHp;
        var bk = blockStyleAt(tx, ty);
        if (bk !== BLOCK_CRATE && BLOCK_CLIP[bk]) {
          blockFallback(bk, tx, ty, sx, sy, u);
          blockCracks(sx, sy, u, gone, PAL.blockCrack);
        } else {
          // BLOCK_CRATE: the brick this block has always been, pixel for pixel.
          bx.fillStyle = PAL.brick;
          bx.fillRect(sx, sy, TS, TS);
          bx.fillStyle = PAL.brickTop;
          bx.fillRect(sx, sy, TS, 2 * u);
          bx.fillStyle = PAL.brickDark;
          bx.fillRect(sx, sy + 7 * u, TS, 1 * u);          // mortar
          bx.fillRect(sx + 7 * u, sy, 1 * u, 7 * u);
          bx.fillRect(sx + 3 * u, sy + 8 * u, 1 * u, TS - 8 * u);
          blockCracks(sx, sy, u, gone, PAL.brickDark);
        }
      } else if (v === HAZARD) {
        bx.fillStyle = PAL.spikeDark;
        bx.fillRect(sx, sy + TS - 4 * u, TS, 4 * u);
        bx.fillStyle = PAL.spike;
        for (var s = 0; s < 4; s++) {            // 4 is a COUNT; the stride is a LENGTH
          var px = sx + s * 4 * u;
          bx.fillRect(px + 1 * u, sy + 6 * u, 2 * u, TS - 6 * u);
          bx.fillRect(px + 1 * u, sy + 3 * u, 2 * u, 3 * u);
        }
      }
    }
  }
}

function drawParts(cx, cy) {
  for (var i = 0; i < Parts.n; i++) {
    var p = Parts.a[i];
    var a = p.life / p.max;
    if (a > 1) a = 1;
    bx.globalAlpha = a;
    bx.fillStyle = p.c;
    bx.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), p.r, p.r);
  }
  bx.globalAlpha = 1;
}

// Tumbling mail. Drawn in four axis-aligned phases rather than rotated — a
// rotated fill is antialiased, and antialiasing on a pixel game reads as mud.
function drawToss(cx, cy) {
  var u = TS / 16;                       // the letter was authored at TS = 16
  for (var i = 0; i < Toss.n; i++) {
    var m = Toss.a[i];
    var x = Math.round(m.x - cx), y = Math.round(m.y - cy);
    var ph = ((m.spin / (Math.PI * 0.5)) | 0) & 3;
    // shots.png: every row is centred in a 32 cell, so the floor is 16 below the middle.
    if (sprDraw(bx, 'shot.mail', ph, x, y + 16, false)) continue;
    var w = (ph & 1) ? 4 * u : 9 * u, h = (ph & 1) ? 7 * u : 6 * u;
    bx.fillStyle = PAL.mail;
    bx.fillRect(x - (w >> 1), y - (h >> 1), w, h);
    bx.fillStyle = PAL.mailFlap;
    if (ph & 1) bx.fillRect(x - (w >> 1), y - (h >> 1), w, 2 * u);
    else {
      bx.fillRect(x - (w >> 1), y - (h >> 1), w, 1 * u);
      bx.fillRect(x - 1 * u, y - 1 * u, 3 * u, 2 * u);
    }
  }
}

// Placeholder carrier. Proportions are derived from his height so the drawing
// still reads when the slider moves. Yori draws the real one.
function drawPlayer(cx, cy, alpha) {
  var x = Math.round(P.prevX + (P.x - P.prevX) * alpha - cx);
  var y = Math.round(P.prevY + (P.y - P.prevY) * alpha - cy);
  var w = P.w, h = P.h, f = P.facing;

  // Blink through the invincibility window rather than vanishing.
  if (P.invulnT > 0 && (Math.floor(P.invulnT * 18) & 1)) return;

  // The painted version if it exists, the rectangles if it does not. Origin is
  // the middle of the feet so art can be any size without moving the hitbox.
  if (!sprDrawAnim(bx, P.anim, x + w * 0.5, y + h, f < 0)) drawPlayerBody(x, y, w, h, f);
  drawPlayerAura(x, y, w, h);
}

// Whatever must sit OVER whichever body was drawn — the painted one or the
// rectangles. Nothing in here may depend on how the body was made.
function drawPlayerAura(x, y, w, h) {
  var u = TS / 16;                     // outline and pip were authored at TS = 16
  // The rye. It has to be obvious that it is on, and obvious that it is going.
  if (P.ryeT > 0) {
    var warn = P.ryeT < 1.2 && (Math.floor(P.ryeT * 12) & 1);
    bx.globalAlpha = warn ? 0.25 : 0.55 + 0.25 * Math.sin(P.ryeT * 14);
    bx.fillStyle = PAL.itemGlow;
    bx.fillRect(x - 2 * u, y - 2 * u, w + 4 * u, 2 * u);
    bx.fillRect(x - 2 * u, y + h, w + 4 * u, 2 * u);
    bx.fillRect(x - 2 * u, y, 2 * u, h);
    bx.fillRect(x + w, y, 2 * u, h);
    bx.globalAlpha = 1;
  }

  // The aim pip used to be here, and this was the wrong place for it — this
  // function's own rule, two comments up, is that nothing in it may depend on
  // how the body was made, and the pip depended on it completely. It has moved
  // into drawPlayerBody. See the note there.
}

// The placeholder carrier, for as long as there is no painted one.
function drawPlayerBody(x, y, w, h, f) {
  var u = TS / 16;                       // every trim size below was authored at TS = 16
  var capH = Math.max(2 * u, Math.round(h * 0.075));
  var headB = Math.max(capH + 3 * u, Math.round(h * 0.26));   // bottom of the head
  var legT = Math.round(h * 0.68);                         // top of the legs
  var beltT = legT - Math.max(2 * u, Math.round(h * 0.05));

  // Bag rides on the back.
  var bagW = Math.max(4 * u, Math.round(w * 0.45));
  var bagX = f > 0 ? x - bagW + 2 * u : x + w - 2 * u;
  bx.fillStyle = PAL.bag;
  bx.fillRect(bagX, y + headB + 2 * u, bagW, Math.max(4 * u, legT - headB - 4 * u));
  bx.fillStyle = PAL.bagDark;
  bx.fillRect(bagX, y + headB + 2 * u, bagW, 1 * u);

  // Torso.
  bx.fillStyle = PAL.cloth;
  bx.fillRect(x, y + headB, w, legT - headB);
  bx.fillStyle = PAL.clothDark;
  bx.fillRect(x, y + beltT, w, legT - beltT);

  // Legs: a two-frame shuffle while running, together when crouched or still.
  var run = P.grounded && !P.crouch && Math.abs(P.vx) > 14 * u;
  var swing = run ? ((Math.floor(P.x / (9 * u)) & 1) ? 1 * u : -1 * u) : 0;
  var legW = Math.max(3 * u, Math.round(w * 0.32));
  bx.fillStyle = PAL.clothDark;
  bx.fillRect(x + 1 * u + (swing > 0 ? 1 * u : 0), y + legT, legW, h - legT);
  bx.fillRect(x + w - legW - 1 * u - (swing < 0 ? 1 * u : 0), y + legT, legW, h - legT);

  // The throwing arm, stepped along the aim so it points where he is actually
  // throwing. A single horizontal bar looked fine until he aimed upward.
  var armY = y + headB + Math.round((legT - headB) * 0.22);
  var sx = x + w * 0.5, st = Math.max(2.2 * u, w * 0.2);
  bx.fillStyle = PAL.skin;
  for (var seg = 1; seg <= 3; seg++) {
    bx.fillRect(Math.round(sx + P.aimX * (w * 0.42 + seg * st) - 1.5 * u),
                Math.round(armY + P.aimY * seg * st), 3 * u, 3 * u);
  }

  // Head, shades, cap with the brim leading.
  bx.fillStyle = PAL.skin;
  bx.fillRect(x + 1 * u, y + capH, w - 2 * u, headB - capH);
  bx.fillStyle = PAL.shade;
  bx.fillRect(x + 1 * u, y + capH + 2 * u, w - 2 * u, 2 * u);
  bx.fillStyle = PAL.cap;
  bx.fillRect(x, y, w, capH);
  bx.fillRect(f > 0 ? x + w : x - 4 * u, y + capH - 1 * u, 4 * u, 1 * u);

  // Hugging a wall: a scrape of dust down the side.
  if (P.sliding) {
    bx.fillStyle = PAL.dust;
    bx.globalAlpha = 0.5;
    bx.fillRect(P.wallDir > 0 ? x + w : x - 1 * u, y + headB, 1 * u, legT - headB);
    bx.globalAlpha = 1;
  }

  // AIM PIP — and it belongs in here, with the rectangles, not over the top of
  // everything. A single dot showing where the next letter leaves his hand.
  //
  // Evrtek, 2026-09-20: "when aiming up, a small yellow dot appears on the
  // player". It did, and the answer is that the pip has outlived its job. It
  // was readability scaffolding for a carrier made of boxes, which cannot show
  // you where it is aiming. The painted carrier has carrier.throwUp and
  // carrier.throwDown — he turns and points, and the pose IS the confirmation.
  // A yellow square stuck on top of that is a worse version of what the art
  // already says.
  //
  // So it lives with the body it was drawn for. No painted sheet, boxes and a
  // pip; painted sheet, the pose and nothing else. Same per-clip seam every
  // other piece of art in this game hangs on.
  if (P.aimY !== 0 || P.fxTossAnim > 0) {
    var inv = (P.aimX && P.aimY) ? 0.7071 : 1;
    var px = x + w * 0.5 + P.aimX * inv * (w * 0.5 + 8 * u);
    var py = y + h * (P.crouch ? 0.42 : 0.34) + P.aimY * inv * 8 * u;
    bx.fillStyle = PAL.aim;
    bx.globalAlpha = 0.85;
    bx.fillRect(Math.round(px) - 1 * u, Math.round(py) - 1 * u, 2 * u, 2 * u);
    bx.globalAlpha = 1;
  }
}


// The dog. Low and long, and drawn from its own width and height so the sliders
// still produce a dog. Legs tuck under it in the air, which is most of why a
// leap reads as a leap rather than as a slide.
function drawDog(d, cx, cy) {
  var x = Math.round(d.x - cx), y = Math.round(d.y - cy), w = d.w, h = d.h;
  var f = d.facing;
  var flash = d.hurtT > 0 && (Math.floor(d.hurtT * 30) & 1);

  var bodyC = flash ? '#ffffff' : PAL.dogBody;
  var darkC = flash ? '#ffffff' : PAL.dogDark;
  var liteC = flash ? '#ffffff' : PAL.dogLight;

  // Head end is whichever way it faces; everything below is written facing
  // right and mirrored by reading hx through f.
  function hx(v) { return f > 0 ? x + v : x + w - v; }

  var u = TS / 16;                       // the dog's trim was authored at TS = 16
  var headW = Math.max(5 * u, Math.round(w * 0.34));
  var legH = Math.max(2 * u, Math.round(h * 0.22));
  var bodyT = Math.round(h * 0.28);

  // Tail, at the back, up when it has seen you.
  bx.fillStyle = darkC;
  var tailUp = d.seen ? -2 * u : 1 * u;
  bx.fillRect(Math.min(hx(0) - 3 * u * f, hx(0)), y + bodyT + tailUp, 3 * u, 2 * u);

  // Body.
  bx.fillStyle = bodyC;
  bx.fillRect(x + 2 * u, y + bodyT, w - 4 * u, h - bodyT - legH);
  bx.fillStyle = liteC;
  bx.fillRect(x + 2 * u, y + bodyT, w - 4 * u, 2 * u);

  // Legs: four in the air tucked into two, planted when it is on the ground.
  bx.fillStyle = darkC;
  var legY = y + h - legH;
  if (d.grounded) {
    var stride = d.pauseT > TUNE.dogPause * 0.5 ? 1 * u : 0;
    bx.fillRect(x + 3 * u + stride, legY, 3 * u, legH);
    bx.fillRect(x + w - 6 * u - stride, legY, 3 * u, legH);
  } else {
    bx.fillRect(x + 4 * u, legY - 1 * u, 4 * u, legH);
    bx.fillRect(x + w - 8 * u, legY - 1 * u, 4 * u, legH);
  }

  // Head, ear, snout.
  bx.fillStyle = bodyC;
  bx.fillRect(Math.min(hx(w - headW), hx(w)), y + Math.round(h * 0.12), headW, Math.round(h * 0.52));
  bx.fillStyle = darkC;
  bx.fillRect(Math.min(hx(w - headW), hx(w - headW + 3 * u)), y, 3 * u, Math.round(h * 0.2) + 1 * u);   // ear
  bx.fillStyle = PAL.dogNose;
  bx.fillRect(f > 0 ? x + w - 2 * u : x, y + Math.round(h * 0.34), 2 * u, 2 * u);              // nose

  // Eye. It lights up when it has you, which is the only tell it gives.
  bx.fillStyle = d.seen ? PAL.dogEye : PAL.dogNose;
  bx.fillRect(f > 0 ? x + w - 5 * u : x + 3 * u, y + Math.round(h * 0.26), 2 * u, 2 * u);
}

// --- The mailbox bot -------------------------------------------------------
// Its mouth is the whole enemy: shut it eats letters and takes nothing, open
// it is the only thing on screen worth hitting.
function drawBox(f, cx, cy) {
  var x = Math.round(f.x - cx), y = Math.round(f.y - cy), w = f.w, h = f.h;
  var open = f.s0 !== 0;
  var flash = f.hurtT > 0 && (Math.floor(f.hurtT * 30) & 1);
  var u = TS / 16;                              // the bot was authored at TS = 16
  bx.fillStyle = PAL.post;
  bx.fillRect(x + 3 * u, y + h - 6 * u, 3 * u, 6 * u);
  bx.fillRect(x + w - 6 * u, y + h - 6 * u, 3 * u, 6 * u);
  bx.fillStyle = flash ? '#ffffff' : (open ? '#5f93cf' : PAL.boxBody);
  bx.fillRect(x, y + 2 * u, w, h - 8 * u);
  bx.fillStyle = flash ? '#ffffff' : PAL.boxDark;
  bx.fillRect(x, y + 2 * u, w, 3 * u);
  // The mouth.
  bx.fillStyle = PAL.boxMouth;
  if (open) bx.fillRect(x + 3 * u, y + 12 * u, w - 6 * u, 9 * u);
  else bx.fillRect(x + 3 * u, y + 15 * u, w - 6 * u, 3 * u);
  if (open) {                                   // a letter turning over in there
    bx.fillStyle = PAL.mail;
    bx.fillRect(x + 6 * u + (Math.floor(f.t0 * 9) & 1) * u, y + 15 * u, 6 * u, 4 * u);
  }
  bx.fillStyle = PAL.boxEye;
  bx.fillRect(x + 4 * u, y + 7 * u, 3 * u, 3 * u);
  bx.fillRect(x + w - 7 * u, y + 7 * u, 3 * u, 3 * u);
  bx.fillStyle = PAL.flag;                      // its own little flag, always up
  bx.fillRect(x + w - 1 * u, y - 5 * u, 1 * u, 8 * u);
  bx.fillRect(x + w, y - 5 * u, 4 * u, 3 * u);
}

// --- The drone -------------------------------------------------------------
function drawDrone(f, cx, cy) {
  var x = Math.round(f.x - cx), y = Math.round(f.y - cy), w = f.w, h = f.h;
  // The lock reads as the dive does — tilted, swept, lit — because it is the
  // warning FOR the dive. See droneLock in tune.js.
  var diving = f.s0 === 1 || f.s0 === 3;
  var flash = f.hurtT > 0 && (Math.floor(f.hurtT * 30) & 1);
  var u = TS / 16;                       // the drone was authored at TS = 16
  // Rotors: a blur when hovering, swept back in a dive.
  bx.fillStyle = PAL.rotor;
  bx.globalAlpha = 0.75;
  var span = diving ? 6 * u : 9 * u;
  bx.fillRect(x + 1 * u, y + (diving ? 3 * u : 1 * u), span, 1 * u);
  bx.fillRect(x + w - 1 * u - span, y + (diving ? 3 * u : 1 * u), span, 1 * u);
  bx.globalAlpha = 1;
  bx.fillStyle = PAL.droneDark;
  bx.fillRect(x + 3 * u, y + 2 * u, 2 * u, 3 * u);
  bx.fillRect(x + w - 5 * u, y + 2 * u, 2 * u, 3 * u);
  bx.fillStyle = flash ? '#ffffff' : PAL.droneBody;
  bx.fillRect(x + 2 * u, y + 5 * u, w - 4 * u, h - 7 * u);
  bx.fillStyle = flash ? '#ffffff' : PAL.droneDark;
  bx.fillRect(x + 2 * u, y + h - 4 * u, w - 4 * u, 2 * u);
  bx.fillStyle = diving ? '#fff0c2' : PAL.droneEye;
  bx.fillRect(f.facing > 0 ? x + w - 6 * u : x + 3 * u, y + 7 * u, 3 * u, 3 * u);
  // What it is carrying, slung underneath. That is the reason to shoot it down.
  if (f.carry >= 0) {
    bx.fillStyle = PAL.parcel;
    bx.fillRect(x + (w >> 1) - 4 * u, y + h - 2 * u, 8 * u, 6 * u);
    bx.fillStyle = PAL.parcelTape;
    bx.fillRect(x + (w >> 1) - 1 * u, y + h - 2 * u, 2 * u, 6 * u);
  }
}

// --- The gnome -------------------------------------------------------------
function drawGnome(f, cx, cy) {
  var x = Math.round(f.x - cx), y = Math.round(f.y - cy), w = f.w, h = f.h;
  var stone = f.s0 === 0;
  var waking = f.s0 === 1;
  var u = TS / 16;                                         // authored at TS = 16
  if (waking) x += (Math.floor(f.t0 * 40) & 1) ? 1 * u : -1 * u;   // a shudder, as warning
  var flash = f.hurtT > 0 && (Math.floor(f.hurtT * 30) & 1);

  var hat = flash ? '#ffffff' : (stone ? PAL.gnomeStone : PAL.gnomeHat);
  var coat = flash ? '#ffffff' : (stone ? PAL.gnomeStone : PAL.gnomeCoat);
  var beard = flash ? '#ffffff' : (stone ? '#9aa5b3' : PAL.gnomeBeard);

  bx.fillStyle = hat;                               // the hat, a stack of steps
  bx.fillRect(x + 6 * u, y, 4 * u, 2 * u);
  bx.fillRect(x + 4 * u, y + 2 * u, 8 * u, 2 * u);
  bx.fillRect(x + 2 * u, y + 4 * u, 12 * u, 3 * u);
  bx.fillStyle = beard;
  bx.fillRect(x + 3 * u, y + 7 * u, 10 * u, 7 * u);
  bx.fillStyle = stone ? '#6b7684' : '#e8b48c';     // the face, in the beard
  bx.fillRect(x + 5 * u, y + 8 * u, 6 * u, 3 * u);
  bx.fillStyle = stone ? '#39424f' : '#2b2118';
  bx.fillRect(x + 6 * u, y + 9 * u, 1 * u, 1 * u);
  bx.fillRect(x + 9 * u, y + 9 * u, 1 * u, 1 * u);
  bx.fillStyle = coat;
  bx.fillRect(x + 2 * u, y + 14 * u, 12 * u, h - 17 * u);
  bx.fillStyle = stone ? '#5d687a' : '#2d5183';
  bx.fillRect(x + 3 * u, y + h - 3 * u, 4 * u, 3 * u);
  bx.fillRect(x + 9 * u, y + h - 3 * u, 4 * u, 3 * u);
}

// --- The trash panda -------------------------------------------------------
function drawPanda(f, cx, cy) {
  var x = Math.round(f.x - cx), y = Math.round(f.y - cy), w = f.w, h = f.h;
  var fc = f.facing;
  var flash = f.hurtT > 0 && (Math.floor(f.hurtT * 30) & 1);
  var fur = flash ? '#ffffff' : PAL.pandaFur;
  var lunging = f.s0 === 2;
  var u = TS / 16;                                  // authored at TS = 16

  function hx(v) { return fc > 0 ? x + v : x + w - v; }

  // Tail, striped, at the back.
  bx.fillStyle = flash ? '#ffffff' : PAL.pandaMask;
  bx.fillRect(Math.min(hx(0) - 6 * u * fc, hx(0)), y + 6 * u, 6 * u, 4 * u);
  bx.fillStyle = fur;
  bx.fillRect(Math.min(hx(1 * u) - 4 * u * fc, hx(1 * u)), y + 6 * u, 3 * u, 4 * u);

  bx.fillStyle = fur;                               // body, lower when lunging
  bx.fillRect(x + 2 * u, y + (lunging ? 7 * u : 5 * u), w - 4 * u, h - (lunging ? 9 * u : 7 * u));
  bx.fillStyle = flash ? '#ffffff' : PAL.pandaLight;
  bx.fillRect(x + 2 * u, y + (lunging ? 7 * u : 5 * u), w - 4 * u, 2 * u);
  bx.fillStyle = flash ? '#ffffff' : PAL.pandaMask;
  bx.fillRect(x + 3 * u, y + h - 3 * u, 4 * u, 3 * u);
  bx.fillRect(x + w - 7 * u, y + h - 3 * u, 4 * u, 3 * u);

  // Head and bandit mask.
  bx.fillStyle = fur;
  bx.fillRect(Math.min(hx(w - 9 * u), hx(w)), y + 2 * u, 9 * u, 9 * u);
  bx.fillStyle = flash ? '#ffffff' : PAL.pandaMask;
  bx.fillRect(Math.min(hx(w - 8 * u), hx(w - 1 * u)), y + 5 * u, 7 * u, 3 * u);
  bx.fillStyle = '#ffe08a';
  bx.fillRect(fc > 0 ? x + w - 5 * u : x + 3 * u, y + 6 * u, 2 * u, 1 * u);

  // The lid, held in front, and only in front.
  if (f.shield > 0) {
    var lx = fc > 0 ? x + w - 2 * u : x - 4 * u;
    bx.fillStyle = flash ? '#ffffff' : PAL.lid;
    bx.fillRect(lx, y + 1 * u, 6 * u, h - 3 * u);
    bx.fillStyle = '#7d8a9a';
    bx.fillRect(lx + (fc > 0 ? 4 * u : 0), y + 1 * u, 2 * u, h - 3 * u);
    // How much lid is left, as pips on it.
    bx.fillStyle = '#2b3442';
    for (var p = 0; p < f.shield; p++) bx.fillRect(lx + 2 * u, y + 4 * u + p * 5 * u, 2 * u, 3 * u);
  }
}

// --- The Postmaster --------------------------------------------------------
function drawBoss(f, cx, cy) {
  var x = Math.round(f.x - cx), y = Math.round(f.y - cy), w = f.w, h = f.h;
  var fc = f.facing;
  var flash = f.hurtT > 0 && (Math.floor(f.hurtT * 30) & 1);
  var coat = flash ? '#ffffff' : PAL.bossCoat;
  var u = TS / 16;                                   // authored at TS = 16

  // Phase 3: he is sitting on the sack, so draw it under him.
  if (f.phase === 2) {
    bx.fillStyle = flash ? '#ffffff' : PAL.bossSack;
    bx.fillRect(x - 2 * u, y + h - 14 * u, w + 4 * u, 16 * u);
    bx.fillStyle = PAL.bagDark;
    bx.fillRect(x - 2 * u, y + h - 14 * u, w + 4 * u, 3 * u);
  }

  bx.fillStyle = coat;                               // the coat
  bx.fillRect(x + 3 * u, y + 15 * u, w - 6 * u, h - (f.phase === 2 ? 30 * u : 20 * u));
  bx.fillStyle = flash ? '#ffffff' : PAL.bossTrim;
  bx.fillRect(x + 3 * u, y + 22 * u, w - 6 * u, 2 * u);
  bx.fillRect(x + (w >> 1) - 1 * u, y + 15 * u, 2 * u, h - (f.phase === 2 ? 30 * u : 20 * u));
  if (f.phase !== 2) {
    bx.fillStyle = flash ? '#ffffff' : '#1e3556';
    bx.fillRect(x + 6 * u, y + h - 8 * u, 8 * u, 8 * u);
    bx.fillRect(x + w - 14 * u, y + h - 8 * u, 8 * u, 8 * u);
  }
  bx.fillStyle = flash ? '#ffffff' : PAL.skin;       // head
  bx.fillRect(x + 8 * u, y + 5 * u, w - 16 * u, 10 * u);
  bx.fillStyle = PAL.shade;
  bx.fillRect(x + 8 * u, y + 8 * u, w - 16 * u, 3 * u);
  bx.fillStyle = flash ? '#ffffff' : '#16294a';      // the peaked cap
  bx.fillRect(x + 6 * u, y, w - 12 * u, 6 * u);
  bx.fillRect(fc > 0 ? x + w - 8 * u : x - 2 * u, y + 5 * u, 10 * u, 2 * u);
  bx.fillStyle = PAL.bossTrim;
  bx.fillRect(x + 6 * u, y + 4 * u, w - 12 * u, 1 * u);

  // The sack he throws from, on his back, when he is on foot.
  if (f.phase !== 2) {
    bx.fillStyle = flash ? '#ffffff' : PAL.bossSack;
    bx.fillRect(fc > 0 ? x - 3 * u : x + w - 5 * u, y + 18 * u, 8 * u, 14 * u);
  }

  drawBossBar(f, cx, cy);
}

// Health, and which phase this is. Three pips and a bar for the ten hits. Drawn
// separately because it belongs over the art as much as over the rectangles.
function drawBossBar(f, cx, cy) {
  var x = Math.round(f.x - cx), y = Math.round(f.y - cy), w = f.w;
  var u = TS / 16;                       // the bar was authored at TS = 16
  var bw = w + 12 * u, bxx = x - 6 * u, byy = y - 12 * u;
  bx.fillStyle = 'rgba(8,12,20,0.8)';
  bx.fillRect(bxx - 1 * u, byy - 1 * u, bw + 2 * u, 7 * u);
  bx.fillStyle = '#7e2f45';
  bx.fillRect(bxx, byy, bw, 5 * u);
  bx.fillStyle = f.phase === 2 ? '#ffd27a' : PAL.flag;
  bx.fillRect(bxx, byy, Math.max(0, Math.round(bw * (f.hp / Math.max(1, f.maxHp)))), 5 * u);
  for (var ph = 0; ph < 3; ph++) {
    bx.fillStyle = ph <= f.phase ? '#ffe08a' : '#3d4a63';
    bx.fillRect(bxx + ph * 5 * u, byy - 5 * u, 3 * u, 3 * u);
  }
}

// --- Enemy fire and the bins ----------------------------------------------

function drawShots(cx, cy) {
  var u = TS / 16;                                   // authored at TS = 16
  for (var i = 0; i < Shots.n; i++) {
    var s = Shots.a[i];
    var x = Math.round(s.x - cx), y = Math.round(s.y - cy);
    if (s.kind === 1) {                              // a dropped bomb: half a tile
      if (sprDraw(bx, 'shot.bomb', (s.spin / (Math.PI * 2 / 3)) | 0, x, y + 16, false)) continue;
      bx.fillStyle = PAL.parcel;
      bx.fillRect(x - 4 * u, y - 4 * u, 8 * u, 8 * u);
      bx.fillStyle = '#ff9a5e';
      bx.fillRect(x - 1 * u, y - 6 * u, 2 * u, 2 * u);
    } else {                                         // spat or thrown mail
      var ph = ((s.spin / (Math.PI * 0.5)) | 0) & 3;
      if (sprDraw(bx, 'shot.mailEnemy', ph, x, y + 16, false)) continue;
      var w = (ph & 1) ? 4 * u : 9 * u, h = (ph & 1) ? 7 * u : 6 * u;
      bx.fillStyle = '#ffd9d4';
      bx.fillRect(x - (w >> 1), y - (h >> 1), w, h);
      bx.fillStyle = PAL.spike;
      bx.fillRect(x - (w >> 1), y - (h >> 1), w, 2 * u);
    }
  }
}

// Trees are DRAWN and never collidable. A six-tile trunk standing on the street
// is a wall a hold-right player cannot get past, and that is exactly what it
// would be if it were made of tiles.
function drawTrees(cx, cy) {
  var u = TS / 16;                       // authored at TS = 16; the trunk is six tiles
  for (var i = 0; i < World.trees.length; i++) {
    var t = World.trees[i];
    var x = Math.round(t.tx * TS - cx), y = Math.round(t.ty * TS - cy);
    if (sprDraw(bx, 'prop.tree', i % 3, x + TS * 0.5, y, false)) continue;   // by placement order: three in a row are three shapes
    bx.fillStyle = PAL.trunk;
    bx.fillRect(x + 4 * u, y - 96 * u, 8 * u, 96 * u);
    bx.fillStyle = PAL.leafDark;
    bx.fillRect(x - 26 * u, y - 132 * u, 68 * u, 30 * u);
    bx.fillStyle = PAL.leaf;
    bx.fillRect(x - 22 * u, y - 138 * u, 60 * u, 26 * u);
    bx.fillRect(x - 12 * u, y - 148 * u, 40 * u, 14 * u);
  }
}

// Six of these stand in the park among four live ones. They are drawn from the
// same rectangles as gnome.statue on purpose: an ambusher that is the only
// statue on the lawn is not an ambusher, it is a signpost.
function drawDecoys(cx, cy) {
  var u = TS / 16;                       // same rectangles as drawGnome, authored at TS = 16
  for (var i = 0; i < World.decoys.length; i++) {
    var d = World.decoys[i];
    var x = Math.round(d.tx * TS - cx), y = Math.round(d.ty * TS - cy) - 22 * u;
    // Three ornaments from the same generation as the live gnome's statue, so
    // there is nothing to tell them apart by. Which of the three a decoy is
    // comes from its tile, so a row of them varies and never changes.
    if (sprDraw(bx, 'prop.gnomeDecoy', (d.tx * 7 + 3) % 3, x + TS * 0.5, y + 22 * u, false)) continue;
    bx.fillStyle = PAL.gnomeStone;
    bx.fillRect(x + 6 * u, y, 4 * u, 2 * u);
    bx.fillRect(x + 4 * u, y + 2 * u, 8 * u, 2 * u);
    bx.fillRect(x + 2 * u, y + 4 * u, 12 * u, 3 * u);
    bx.fillStyle = '#9aa5b3';
    bx.fillRect(x + 3 * u, y + 7 * u, 10 * u, 7 * u);
    bx.fillStyle = '#6b7684';
    bx.fillRect(x + 5 * u, y + 8 * u, 6 * u, 3 * u);
    bx.fillStyle = '#39424f';
    bx.fillRect(x + 6 * u, y + 9 * u, 1 * u, 1 * u); bx.fillRect(x + 9 * u, y + 9 * u, 1 * u, 1 * u);
    bx.fillStyle = PAL.gnomeStone;
    bx.fillRect(x + 2 * u, y + 14 * u, 12 * u, 5 * u);
    bx.fillStyle = '#5d687a';
    bx.fillRect(x + 3 * u, y + 19 * u, 4 * u, 3 * u); bx.fillRect(x + 9 * u, y + 19 * u, 4 * u, 3 * u);
  }
}

// Placeholder furniture. None of it collides; it is here so the level reads as
// a neighbourhood until Yori's sheets land and replace the lot.
function drawScenery(cx, cy) {
  var u = TS / 16;                         // every piece below was authored at TS = 16
  // Two passes: the depot GATES first, everything else after. Painted, the gates
  // are the widest piece of scenery by far — 168 px where the placeholder was
  // 64 — and they are a backdrop, so whatever stands beside them belongs in
  // front of the iron. Level 1 has a street mailbox one tile to the left of the
  // depot gates, and drawn in list order it stood half hidden behind a gatepost.
  // Moving no placement fixes it; drawing the backdrop first does.
  for (var pass = 0; pass < 2; pass++)
  for (var i = 0; i < World.scenery.length; i++) {
    var s = World.scenery[i];
    if ((s.kind === SC_GATES) !== (pass === 0)) continue;
    var x = Math.round(s.tx * TS - cx), y = Math.round(s.ty * TS - cy);
    if (x < -180 * u || x > view.w + 180 * u) continue;
    switch (s.kind) {
      case SC_HOUSE:
        // Nine houses, four designs, so WHICH one matters more than usual. s.v is
        // its ordinal among the houses, counted at build time (see scene() in
        // world.js), so sprDraw's own modulo cycles them 0,1,2,3,0,... down the
        // street: no two neighbours the same and none of the four unused.
        if (sprDraw(bx, 'prop.house', s.v, x + 32 * u, y, false)) break;
        bx.fillStyle = PAL.wall; bx.fillRect(x, y - 72 * u, 64 * u, 72 * u);
        bx.fillStyle = PAL.roofTile; bx.fillRect(x - 4 * u, y - 84 * u, 72 * u, 12 * u);
        bx.fillStyle = PAL.door; bx.fillRect(x + 26 * u, y - 26 * u, 12 * u, 26 * u);
        bx.fillStyle = PAL.win; bx.fillRect(x + 8 * u, y - 60 * u, 12 * u, 12 * u); bx.fillRect(x + 44 * u, y - 60 * u, 12 * u, 12 * u);
        break;
      case SC_HOUSE2: {
        // The second city set: drawn exactly as SC_HOUSE is, cycling its own
        // four variants by its own count. Its placeholder is a different
        // building on purpose — a tall flat-roofed brick walk-up, not the
        // pitched house — so the two sets can be told apart before either
        // sheet is painted.
        if (sprDraw(bx, 'prop.house2', s.v, x + 32 * u, y, false)) break;
        bx.fillStyle = PAL.house2; bx.fillRect(x, y - 104 * u, 56 * u, 104 * u);
        bx.fillStyle = PAL.house2Trim; bx.fillRect(x - 2 * u, y - 110 * u, 60 * u, 6 * u);
        bx.fillStyle = PAL.win;
        for (var wr = 0; wr < 3; wr++)
          for (var wc = 0; wc < 2; wc++) bx.fillRect(x + 8 * u + wc * 28 * u, y - 96 * u + wr * 24 * u, 12 * u, 14 * u);
        bx.fillStyle = PAL.door; bx.fillRect(x + 22 * u, y - 24 * u, 12 * u, 24 * u);
        bx.fillStyle = PAL.stoop; bx.fillRect(x + 18 * u, y - 4 * u, 20 * u, 4 * u);
        break;
      }
      case SC_HUT2: {
        // Huts and ruins, the jungle's house set (huts.png, clip prop.hut). NOT
        // SC_HUT, the depot's gate hut, which keeps its own small drawing below.
        if (sprDraw(bx, 'prop.hut', s.v, x + 32 * u, y, false)) break;
        bx.fillStyle = PAL.hutPost;                    // stilts, and a ladder up to the door
        bx.fillRect(x + 6 * u, y - 22 * u, 3 * u, 22 * u); bx.fillRect(x + 46 * u, y - 22 * u, 3 * u, 22 * u);
        bx.fillRect(x + 24 * u, y - 22 * u, 1 * u, 22 * u); bx.fillRect(x + 31 * u, y - 22 * u, 1 * u, 22 * u);
        for (var rg = 0; rg < 4; rg++) bx.fillRect(x + 24 * u, y - 18 * u + rg * 5 * u, 8 * u, 1 * u);
        bx.fillStyle = PAL.hutFloor; bx.fillRect(x + 2 * u, y - 26 * u, 52 * u, 4 * u);
        bx.fillStyle = PAL.hutWall; bx.fillRect(x + 8 * u, y - 54 * u, 40 * u, 28 * u);
        bx.fillStyle = PAL.hutSlat;
        for (var sl = 0; sl < 8; sl++) bx.fillRect(x + 10 * u + sl * 5 * u, y - 54 * u, 1 * u, 28 * u);
        bx.fillStyle = PAL.hutDoor; bx.fillRect(x + 23 * u, y - 46 * u, 10 * u, 20 * u);
        for (var th = 0; th < 6; th++) {               // thatch, stepped: no antialiased diagonals
          bx.fillStyle = (th & 1) ? PAL.thatchDark : PAL.thatch;
          bx.fillRect(x + th * 4 * u, y - 58 * u - th * 4 * u, 56 * u - th * 8 * u, 4 * u);
        }
        break;
      }
      // Yori's eight (scenery.png, 2026-09-27), each at the middle of the
      // placeholder it replaces. Variants cycle by placement count via s.v.
      case SC_GARAGE:
        if (sprDraw(bx, 'scen.garage', s.v, x + 28 * u, y, false)) break;
        bx.fillStyle = PAL.wallDark; bx.fillRect(x, y - 56 * u, 56 * u, 56 * u);
        bx.fillStyle = PAL.metal; bx.fillRect(x + 6 * u, y - 34 * u, 44 * u, 34 * u);
        break;
      // The street and depot pieces below were rectangles until 2026-09-27: the
      // lamp and fence come off props.png (painted for the items batch and never
      // wired until now), the rest off scenery.png. Each is anchored at the
      // middle of the placeholder it replaces, so no placement in any level
      // moves, and each keeps its placeholder as the fallback.
      case SC_FENCE:
        // Two painted panels across the run the placeholder drew.
        if (sprHas('prop.fence')) {
          sprDraw(bx, 'prop.fence', 0, x + 8 * u, y, false);
          sprDraw(bx, 'prop.fence', 0, x + 24 * u, y, false);
          break;
        }
        bx.fillStyle = PAL.sign;
        for (var p = 0; p < 6; p++) bx.fillRect(x + p * 6 * u, y - 18 * u, 3 * u, 18 * u);
        bx.fillRect(x, y - 14 * u, 34 * u, 2 * u);
        break;
      case SC_LAMP:
        if (sprDraw(bx, 'prop.lamp', 0, x + 8 * u, y, false)) break;
        bx.fillStyle = PAL.metal; bx.fillRect(x + 6 * u, y - 64 * u, 4 * u, 64 * u);
        bx.fillStyle = PAL.win; bx.fillRect(x + 2 * u, y - 70 * u, 12 * u, 6 * u);
        break;
      case SC_MAILBOX:
        // The STREET mailbox, never the checkpoint's (that one is prop.mailbox).
        // s.v alternates the flag down the street.
        if (sprDraw(bx, 'prop.streetMailbox', s.v, x + 8 * u, y, false)) break;
        bx.fillStyle = PAL.post; bx.fillRect(x + 6 * u, y - 20 * u, 4 * u, 20 * u);
        bx.fillStyle = PAL.boxBody; bx.fillRect(x + 1 * u, y - 30 * u, 14 * u, 10 * u);
        bx.fillStyle = PAL.flag; bx.fillRect(x + 15 * u, y - 34 * u, 4 * u, 3 * u);
        break;
      case SC_BARRIER:
        if (sprDraw(bx, 'prop.barrier', 0, x + 17 * u, y, false)) break;
        bx.fillStyle = PAL.yellow; bx.fillRect(x, y - 20 * u, 34 * u, 5 * u);
        bx.fillStyle = '#c2506b'; bx.fillRect(x + 4 * u, y - 20 * u, 6 * u, 5 * u); bx.fillRect(x + 20 * u, y - 20 * u, 6 * u, 5 * u);
        bx.fillStyle = PAL.metal; bx.fillRect(x + 2 * u, y - 15 * u, 3 * u, 15 * u); bx.fillRect(x + 28 * u, y - 15 * u, 3 * u, 15 * u);
        break;
      case SC_PIPE:
        if (sprDraw(bx, 'prop.pipe', 0, x + 6 * u, y, false)) break;
        bx.fillStyle = PAL.metal; bx.fillRect(x + 4 * u, y - 60 * u, 5 * u, 60 * u);
        break;
      case SC_GATES:
        if (sprDraw(bx, 'prop.gates', 0, x + 16 * u, y, false)) break;
        bx.fillStyle = PAL.wallDark;
        for (var g = 0; g < 5; g++) bx.fillRect(x + g * 7 * u, y - 46 * u, 3 * u, 46 * u);
        bx.fillRect(x, y - 50 * u, 32 * u, 4 * u);
        break;
      case SC_BANDSTAND:
        bx.fillStyle = '#7d9a6f'; bx.fillRect(x - 24 * u, y - 96 * u, 72 * u, 10 * u);
        bx.fillStyle = PAL.metal;
        for (var c2 = 0; c2 < 4; c2++) bx.fillRect(x - 20 * u + c2 * 20 * u, y - 86 * u, 4 * u, 30 * u);
        break;
      case SC_BENCH:
        // GPT's bench (props.png), Evrtek's pick on 2026-09-27 over Yori's
        // scen.bench, which stays on scenery.png unused.
        if (sprDraw(bx, 'prop.bench', 0, x + 14 * u, y, false)) break;
        bx.fillStyle = PAL.trunk; bx.fillRect(x, y - 14 * u, 28 * u, 4 * u); bx.fillRect(x, y - 24 * u, 28 * u, 4 * u);
        bx.fillStyle = PAL.wallDark; bx.fillRect(x + 1 * u, y - 14 * u, 3 * u, 14 * u); bx.fillRect(x + 24 * u, y - 14 * u, 3 * u, 14 * u);
        break;
      case SC_POND_SIGN:
        if (sprDraw(bx, 'prop.pondSign', 0, x + 8 * u, y, false)) break;
        bx.fillStyle = PAL.metal; bx.fillRect(x + 6 * u, y - 30 * u, 3 * u, 30 * u);
        bx.fillStyle = PAL.sign; bx.fillRect(x, y - 42 * u, 16 * u, 12 * u);
        break;
      case SC_SHOP:
        if (sprDraw(bx, 'scen.shop', s.v, x + 30 * u, y, false)) break;
        bx.fillStyle = PAL.wall; bx.fillRect(x, y - 64 * u, 60 * u, 64 * u);
        bx.fillStyle = '#c2506b'; bx.fillRect(x, y - 44 * u, 60 * u, 8 * u);
        bx.fillStyle = PAL.win; bx.fillRect(x + 6 * u, y - 34 * u, 22 * u, 26 * u); bx.fillRect(x + 34 * u, y - 34 * u, 18 * u, 26 * u);
        break;
      case SC_BUS_STOP:
        // The placeholder's roof starts 2u left of the tile, so its middle is 17u.
        if (sprDraw(bx, 'scen.busStop', 0, x + 17 * u, y, false)) break;
        bx.fillStyle = PAL.metal; bx.fillRect(x, y - 44 * u, 3 * u, 44 * u); bx.fillRect(x + 30 * u, y - 44 * u, 3 * u, 44 * u);
        bx.fillRect(x - 2 * u, y - 48 * u, 38 * u, 4 * u);
        bx.fillStyle = PAL.sign; bx.fillRect(x + 6 * u, y - 38 * u, 20 * u, 14 * u);
        break;
      case SC_DIGGER:
        if (sprDraw(bx, 'prop.digger', 0, x + 20 * u, y, false)) break;
        bx.fillStyle = PAL.yellow; bx.fillRect(x, y - 26 * u, 40 * u, 18 * u);
        bx.fillStyle = '#20262f'; bx.fillRect(x + 2 * u, y - 10 * u, 12 * u, 10 * u); bx.fillRect(x + 24 * u, y - 10 * u, 12 * u, 10 * u);
        bx.fillStyle = PAL.yellow; bx.fillRect(x + 34 * u, y - 44 * u, 6 * u, 20 * u);
        break;
      case SC_DRAIN:
        if (sprDraw(bx, 'prop.drain', 0, x + 6 * u, y, false)) break;
        bx.fillStyle = '#20262f'; bx.fillRect(x - 8 * u, y - 6 * u, 28 * u, 6 * u);
        bx.fillStyle = PAL.metal;
        for (var d2 = 0; d2 < 5; d2++) bx.fillRect(x - 6 * u + d2 * 5 * u, y - 6 * u, 2 * u, 6 * u);
        break;
      case SC_CONTAINER:
        if (sprDraw(bx, 'scen.container', s.v, x + 28 * u, y, false)) break;
        bx.fillStyle = '#4a6b74'; bx.fillRect(x, y - 44 * u, 56 * u, 44 * u);
        bx.fillStyle = '#35505a';
        for (var r2 = 0; r2 < 7; r2++) bx.fillRect(x + 2 * u + r2 * 8 * u, y - 42 * u, 3 * u, 40 * u);
        break;
      case SC_HUT:
        // The depot's gatehouse. NOT the jungle huts: those are SC_HUT2 / prop.hut.
        if (sprDraw(bx, 'scen.gateHut', 0, x + 15 * u, y, false)) break;
        bx.fillStyle = PAL.wallDark; bx.fillRect(x, y - 40 * u, 30 * u, 40 * u);
        bx.fillStyle = PAL.win; bx.fillRect(x + 6 * u, y - 32 * u, 18 * u, 12 * u);
        break;
      case SC_ROLLER:
        // The doorway is DARK, not see-through (Evrtek, 2026-09-27). Yori drew
        // it as a clean 68 x 74 transparent hole between the guide rails, from
        // 78 px to 4 px above the sprite's feet, so the dark goes in exactly
        // behind it and her drawing is untouched.
        if (sprHas('scen.roller')) {
          bx.fillStyle = '#20262f';
          bx.fillRect(x + 20 * u - 34, y - 78, 68, 74);
          sprDraw(bx, 'scen.roller', 0, x + 20 * u, y, false);
          break;
        }
        bx.fillStyle = PAL.metal; bx.fillRect(x, y - 70 * u, 40 * u, 8 * u);
        bx.fillStyle = PAL.wallDark; bx.fillRect(x + 2 * u, y - 62 * u, 36 * u, 6 * u);
        break;
      case SC_PIGEONHOLES:
        bx.fillStyle = PAL.wallDark; bx.fillRect(x, y - 90 * u, 48 * u, 90 * u);
        bx.fillStyle = '#2a3446';
        for (var py = 0; py < 8; py++)
          for (var px2 = 0; px2 < 4; px2++) bx.fillRect(x + 3 * u + px2 * 12 * u, y - 86 * u + py * 11 * u, 9 * u, 8 * u);
        break;
      case SC_TRUCK_BAY:
        if (sprDraw(bx, 'scen.truckBay', 0, x + 20 * u, y, false)) break;
        bx.fillStyle = PAL.wallDark; bx.fillRect(x, y - 8 * u, 40 * u, 8 * u);
        break;
      default:                               // anything new, until it is painted
        bx.fillStyle = PAL.wallDark; bx.fillRect(x, y - 8 * u, 40 * u, 8 * u);
        break;
    }
  }
}

function drawBins(cx, cy) {
  var u = TS / 16;                       // the bin fills its tile; authored at TS = 16
  for (var i = 0; i < World.bins.length; i++) {
    var b = World.bins[i];
    var x = Math.round(b.tx * TS - cx), y = Math.round(b.ty * TS - cy);
    // The painted bin is the one from the trash panda's own sheet, cut out of
    // the row where it takes the lid — so the bin standing in the street and the
    // bin in the animation are the same object. Frame 0 lidded, frame 1 open.
    if (sprDraw(bx, 'prop.bin', b.lid ? 0 : 1, x + TS * 0.5, y, false)) continue;
    bx.fillStyle = PAL.bin;
    bx.fillRect(x + 1 * u, y - 14 * u, 14 * u, 14 * u);
    bx.fillStyle = PAL.binDark;
    bx.fillRect(x + 4 * u, y - 12 * u, 2 * u, 12 * u);
    bx.fillRect(x + 10 * u, y - 12 * u, 2 * u, 12 * u);
    if (b.lid) {
      bx.fillStyle = PAL.lid;
      bx.fillRect(x, y - 17 * u, 16 * u, 3 * u);
      bx.fillRect(x + 6 * u, y - 19 * u, 4 * u, 2 * u);
    }
  }
}

function drawFoes(cx, cy) {
  for (var i = 0; i < Foes.n; i++) {
    var f = Foes.a[i];
    if (!f.alive) continue;
    if (sprDrawAnim(bx, f.anim, Math.round(f.x - cx) + f.w * 0.5, Math.round(f.y - cy) + f.h, f.facing < 0)) {
      if (f.kind === FOE_BOSS) drawBossBar(f, cx, cy);
      continue;
    }
    switch (f.kind) {
      case FOE_DOG:   drawDog(f, cx, cy); break;
      case FOE_BOX:   drawBox(f, cx, cy); break;
      case FOE_DRONE: drawDrone(f, cx, cy); break;
      case FOE_GNOME: drawGnome(f, cx, cy); break;
      case FOE_PANDA: drawPanda(f, cx, cy); break;
      default:        drawBoss(f, cx, cy); break;
    }
  }
}

// --- Items, the package in flight, and the checkpoint ----------------------

var ITEM_CLIP = ['item.thick', 'item.bag', 'item.express', 'item.rye', 'item.gummy', 'item.package'];

function drawItem(it, cx, cy) {
  var x = Math.round(it.x - cx), y = Math.round(it.y - cy);
  var clip = ITEM_CLIP[it.kind];
  var u = TS / 16;                                  // the pickups were authored at TS = 16
  // Anchored centre-bottom on the item's own box, so the art follows ITEM_BOX.
  if (sprHas(clip) && sprDraw(bx, clip, Math.floor(it.bob * 2), x + it.w * 0.5, y + it.h, false)) return;
  // A soft cross of light under everything, so a pickup reads from across the
  // screen rather than having to be looked for.
  bx.globalAlpha = 0.20 + 0.10 * Math.sin(it.bob * 1.7);
  bx.fillStyle = PAL.itemGlow;
  bx.fillRect(x - 2 * u, y + 4 * u, 18 * u, 6 * u);
  bx.fillRect(x + 4 * u, y - 2 * u, 6 * u, 18 * u);
  bx.globalAlpha = 1;

  switch (it.kind) {
    case IT_THICK:                                  // a fat envelope
      bx.fillStyle = PAL.mail; bx.fillRect(x, y + 1 * u, 14 * u, 11 * u);
      bx.fillStyle = PAL.mailFlap; bx.fillRect(x, y + 1 * u, 14 * u, 2 * u);
      bx.fillRect(x, y + 6 * u, 14 * u, 2 * u);
      bx.fillStyle = PAL.itemGlow; bx.fillRect(x + 5 * u, y + 3 * u, 4 * u, 3 * u);
      break;
    case IT_BAG:                                    // the satchel: a spare life
      bx.fillStyle = PAL.satchel; bx.fillRect(x, y + 3 * u, 14 * u, 9 * u);
      bx.fillStyle = PAL.bagDark; bx.fillRect(x, y + 3 * u, 14 * u, 2 * u);
      bx.fillRect(x + 5 * u, y + 5 * u, 4 * u, 7 * u);
      bx.fillStyle = PAL.satchel; bx.fillRect(x + 3 * u, y, 8 * u, 3 * u);
      break;
    case IT_EXPRESS:                                // an envelope in a hurry
      bx.fillStyle = PAL.mail; bx.fillRect(x + 3 * u, y + 2 * u, 11 * u, 9 * u);
      bx.fillStyle = '#9fe8b0'; bx.fillRect(x + 3 * u, y + 2 * u, 11 * u, 2 * u);
      bx.fillRect(x, y + 4 * u, 3 * u, 1 * u); bx.fillRect(x - 1 * u, y + 7 * u, 4 * u, 1 * u);
      break;
    case IT_RYE:                                    // the glass
      bx.fillStyle = PAL.glass; bx.fillRect(x + 3 * u, y + 3 * u, 8 * u, 9 * u);
      bx.fillStyle = '#f2d9a8'; bx.fillRect(x + 3 * u, y + 3 * u, 8 * u, 2 * u);
      bx.fillStyle = PAL.mail; bx.fillRect(x + 4 * u, y + 1 * u, 2 * u, 3 * u);
      break;
    case IT_GUMMY:                                  // a packet of worms
      bx.fillStyle = '#d8e4f2'; bx.fillRect(x + 1 * u, y + 2 * u, 12 * u, 10 * u);
      bx.fillStyle = PAL.gummy;
      bx.fillRect(x + 3 * u, y + 4 * u, 2 * u, 6 * u); bx.fillRect(x + 6 * u, y + 5 * u, 2 * u, 5 * u);
      bx.fillStyle = '#6ad0a0'; bx.fillRect(x + 9 * u, y + 4 * u, 2 * u, 6 * u);
      break;
    default:                                        // the parcel
      bx.fillStyle = PAL.parcel; bx.fillRect(x + 1 * u, y + 2 * u, 12 * u, 10 * u);
      bx.fillStyle = PAL.parcelTape;
      bx.fillRect(x + 5 * u, y + 2 * u, 3 * u, 10 * u); bx.fillRect(x + 1 * u, y + 6 * u, 12 * u, 3 * u);
      break;
  }
}

function drawItems(cx, cy) {
  for (var i = 0; i < Items.n; i++) drawItem(Items.a[i], cx, cy);
}

function drawNades(cx, cy) {
  var u = TS / 16;                       // authored at TS = 16
  for (var i = 0; i < Nade.n; i++) {
    var g = Nade.a[i];
    var x = Math.round(g.x - cx), y = Math.round(g.y - cy);
    // It blinks faster as the fuse runs down. That is the only warning it gives.
    var hot = g.fuse < 0.45 && (Math.floor(g.fuse * 22) & 1);
    if (g.fuse < 0.45) { if (sprDraw(bx, 'shot.packageLit', hot ? 1 : 0, x, y + 16, false)) continue; }
    else if (sprDraw(bx, 'shot.package', ((g.spin || 0) / (Math.PI * 0.5)) | 0, x, y + 16, false)) continue;
    bx.fillStyle = hot ? '#fff0c2' : PAL.parcel;
    bx.fillRect(x - 4 * u, y - 4 * u, 9 * u, 8 * u);
    bx.fillStyle = hot ? '#ff9a5e' : PAL.parcelTape;
    bx.fillRect(x - 1 * u, y - 4 * u, 3 * u, 8 * u);
    bx.fillRect(x - 4 * u, y - 1 * u, 9 * u, 3 * u);
  }
}

// The checkpoint. A mailbox, and the flag going up is the whole message.
// One per checkpoint. The body below was written for a single global Check and
// still reads that way: the loop simply points Check-shaped drawing at each
// entry of Checks in turn, so not a line of the mailbox itself had to change.
function drawCheckpoint(cx, cy) {
  if (!Check.armed) return;
  for (var ci = 0; ci < Checks.length; ci++) drawOneCheckpoint(Checks[ci], cx, cy);
}

function drawOneCheckpoint(Check, cx, cy) {
  var x = Math.round(Check.x - cx), y = Math.round(Check.y - cy);
  if (x < -TS * 2 || x > view.w + TS * 2) return;
  var w = Check.w, h = Check.h;
  var u = TS / 16;                       // authored at TS = 16, against Check.w/Check.h
  if (sprDraw(bx, 'prop.mailbox', Check.flag >= 0.5 ? 1 : 0, x + (w >> 1), y + h, false)) {
    if (Check.flag >= 1) {
      bx.globalAlpha = 0.5 + 0.3 * Math.sin(Check.flag * 6 + Items.n);
      bx.fillStyle = PAL.itemGlow;
      bx.fillRect(x - 1 * u, y + 1 * u, w + 2 * u, 1 * u);
      bx.globalAlpha = 1;
    }
    return;
  }
  bx.fillStyle = PAL.post;
  bx.fillRect(x + (w >> 1) - 2 * u, y + 10 * u, 4 * u, h - 10 * u);
  bx.fillStyle = Check.hit ? PAL.boxBody : PAL.boxDark;
  bx.fillRect(x, y + 2 * u, w, 11 * u);
  bx.fillStyle = Check.hit ? '#5f93cf' : PAL.post;
  bx.fillRect(x, y + 2 * u, w, 2 * u);
  bx.fillStyle = PAL.boxDark;
  bx.fillRect(x + 1 * u, y + 7 * u, w - 2 * u, 2 * u);

  var fl = Check.flag;
  var fx = x + w - 1 * u, fy = Math.round(y + 10 * u - fl * 9 * u);
  bx.fillStyle = PAL.post;
  bx.fillRect(fx, fy, 1 * u, Math.round(4 * u + fl * 5 * u));
  bx.fillStyle = PAL.flag;
  bx.fillRect(fx + 1 * u, fy, 5 * u, 3 * u);
  if (fl >= 1) {
    bx.globalAlpha = 0.5 + 0.3 * Math.sin(Check.flag * 6 + Items.n);
    bx.fillStyle = PAL.itemGlow;
    bx.fillRect(x - 1 * u, y + 1 * u, w + 2 * u, 1 * u);
    bx.globalAlpha = 1;
  }
}

// The pickup: where the truck stops for him in a level with no boss
// (2026-09-26). A post with the truck on its sign, and the bay the truck parks
// in painted on the road beyond it — the same stretch stageFinish parks it on
// (pickupAnchor + TUNE.truckPark), so a player reads "the truck stops here"
// before it ever arrives. Placeholder like all furniture here: drawn from the
// truck's own livery colours until a sheet is painted for it.
//
// Not drawn while the level has a boss room, because it does nothing then (the
// boss room wins; see pickupLive in world.js) and a stop that never stops
// would be a lie on the street.
function drawPickup(cx, cy) {
  if (typeof pickupLive !== 'function' || !pickupLive()) return;
  var pk = World.pickup, u = TS / 16;                  // authored at TS = 16, like the rest
  var x = Math.round(pk.tx * TS - cx), y = Math.round(pk.ty * TS - cy);
  if (x < -TS * 10 || x > view.w + TS * 2) return;

  // The bay: dashes along the kerb edge of the road, from the post to where
  // the truck's door will be, and a bar across each end.
  var an = pickupAnchor(pk);
  var bay1 = Math.round(an.x + TUNE.truckPark + TUNE.truckDoorX + TUNE.bodyW - cx);
  bx.fillStyle = PAL.yellow;
  for (var dx = x + TS; dx < bay1; dx += 10 * u) bx.fillRect(dx, y, Math.min(6 * u, bay1 - dx), 1 * u);
  bx.fillRect(x + TS, y, 1 * u, 3 * u);
  bx.fillRect(bay1 - 1 * u, y, 1 * u, 3 * u);

  // The post, and the plate on it above his head — he stands at the stop, so a
  // sign at head height is a sign his cap covers (it did, at 40u: checked in
  // the browser, 2026-09-26).
  bx.fillStyle = PAL.post;
  bx.fillRect(x + 7 * u, y - 50 * u, 2 * u, 50 * u);
  // The sign: a plate with the truck on it, in the truck's own colours.
  bx.fillStyle = PAL.truckDark; bx.fillRect(x, y - 62 * u, 16 * u, 12 * u);
  bx.fillStyle = PAL.sign;      bx.fillRect(x + 1 * u, y - 61 * u, 14 * u, 10 * u);
  bx.fillStyle = PAL.truckStripe;
  bx.fillRect(x + 2 * u, y - 59 * u, 8 * u, 5 * u);    // box
  bx.fillRect(x + 10 * u, y - 57 * u, 3 * u, 3 * u);   // cab
  bx.fillStyle = PAL.truckWheel;
  bx.fillRect(x + 3 * u, y - 54 * u, 2 * u, 2 * u);
  bx.fillRect(x + 10 * u, y - 54 * u, 2 * u, 2 * u);
}

// The mail truck. Generic livery only — it is OUR postal service, and a real
// one's marks are a rights question nobody needs.
function drawTruck(cx, cy) {
  if (Stage.phase === ST_PLAY) return;
  var x = Math.round(Stage.truckX - cx), y = Math.round(Stage.truckY - cy);
  var u = TS / 16;                                     // the truck was authored at TS = 16
  var w = 76 * u, h = 46 * u;
  var flip = Stage.phase >= ST_OUTRO_DRIVE;

  if (sprHas('truck.drive')) {
    var clip = Stage.door > 0 && Stage.door < 1 ? 'truck.doorOpen'
             : Stage.door >= 1 ? 'truck.doorOpen' : 'truck.drive';
    var fr = Stage.door > 0 ? Math.floor(Stage.door * 3) : Math.floor(Stage.t * 12);
    if (sprDraw(bx, clip, fr, x, y, flip)) return;
  }

  var top = y - h;
  bx.fillStyle = PAL.truckWheel;                       // wheels
  bx.fillRect(x - 26 * u, y - 9 * u, 16 * u, 9 * u);
  bx.fillRect(x + 12 * u, y - 9 * u, 16 * u, 9 * u);
  bx.fillStyle = PAL.truck;                            // body
  bx.fillRect(x - w * 0.5, top, w, h - 6 * u);
  bx.fillStyle = PAL.truckDark;
  bx.fillRect(x - w * 0.5, y - 10 * u, w, 4 * u);
  bx.fillStyle = PAL.truckStripe;                      // our own stripe, no eagle
  bx.fillRect(x - w * 0.5, top + 14 * u, w, 5 * u);
  bx.fillStyle = PAL.truckGlass;                       // cab
  bx.fillRect(x + w * 0.5 - 20 * u, top + 4 * u, 16 * u, 12 * u);
  // The door, which opens by sliding up.
  var dh = Math.round(24 * u * (1 - Stage.door));
  bx.fillStyle = '#131a24';
  bx.fillRect(x - 6 * u, top + 12 * u, 22 * u, 24 * u);
  bx.fillStyle = PAL.truckDark;
  bx.fillRect(x - 6 * u, top + 12 * u, 22 * u, dh);
  bx.fillStyle = PAL.truck;
  bx.fillRect(x - 6 * u, top + 12 * u + dh, 22 * u, 2 * u);
}

function renderWorld(alpha) {
  var cx = Math.round(Cam.prevX + (Cam.x - Cam.prevX) * alpha);
  var cy = Math.round(Cam.prevY + (Cam.y - Cam.prevY) * alpha);
  drawSky();
  drawParallax(cx, cy);
  drawTiles(cx, cy);
  drawScenery(cx, cy);
  drawTrees(cx, cy);
  drawDecoys(cx, cy);
  drawBins(cx, cy);
  drawCheckpoint(cx, cy);
  drawPickup(cx, cy);
  drawItems(cx, cy);
  drawFoes(cx, cy);
  drawParts(cx, cy);
  drawToss(cx, cy);
  drawNades(cx, cy);
  drawShots(cx, cy);
  drawTruck(cx, cy);
  if (Stage.shown) drawPlayer(cx, cy, alpha);
  return { cx: cx, cy: cy };
}
