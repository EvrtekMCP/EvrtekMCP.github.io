'use strict';
// ---------------------------------------------------------------------------
// HAINES TALES title screen — Yori, 2026-09-21.
//
// A held image, a logo, a blinking prompt. Two beats stacked the way a SNES
// did it: a maker's card, then the title. Not a loading screen (nothing says
// LOADING, there is no bar), not an attract mode (titleAttract() is the empty
// hook for one). It is also where the art gets requested and where the first
// user gesture happens, which is what lets the music start.
//
// Everything is counted in 60 Hz SIMULATION FRAMES, never the wall clock.
// Depends on: haines-tales-letterforms.js (buildTitle, buildWordmark,
// drawUIText), sprites.js (SPR, sprHas, sprClip), render.js (view),
// version.js (GAME_TITLE, GAME_VERSION). Canvas 2D only; no pixel reads
// anywhere — the dusk regrade is compositing, so it runs identically off
// file:// and http.
//
// Wiring for CLU: titleBegin() at boot after sprProbe(); titleStep() once per
// simulation step while titleActive(); titleDraw(bx) instead of renderWorld
// while active; titlePress() from any keydown / pointerdown (the press that
// starts the game). When titleStep() returns false the opening sequence owns
// the screen. GAME_PROMPT belongs next to GAME_TITLE in js/version.js.
// ---------------------------------------------------------------------------

// GAME_PROMPT, GAME_PROMPT_TOUCH and GAME_MAKER live in js/version.js,
// beside GAME_TITLE. Ruling 1 keeps the name in one place; the rest of the
// screen's strings keep it company so there is one file to edit.

// The beat sheet, in frames. See the brief; nothing here is a second.
var TB = { cardIn: 22, cardHold: 90, cardCap: 180, cardOut: 22, sceneIn: 22, hold: 28,
  gravity: 0.7, bounce: 0.4, landed: 8, settle: 20,
  flash: 24, solid: 12, fadeOut: 22, alive: 200, drift: 4 };

// One dog hop on the title: coil (3 frames at 16 fps), leap (the move, an arc),
// land (2 at 18 fps), a beat. Distance per hop in px.
var HOP = { coil: 12, leap: 18, land: 8, rest: 14, dist: 84, arc: 26 };

// The layout, as fractions of the fixed 496 height. x is always from view.w.
var TL = { titleTop: 0.121, ground: 0.806, promptBase: 0.889, creditBase: 0.949 };

// Dusk: multiply tints (darken + cool), then additive warmth, per row band of
// the far layer, seams aligned to the layer's own bands so no new sub-band
// appears. The sheet keeps its own alpha (destination-in at the end).
var DUSK_FAR = [
  { y: 0, mul: '#7a5973', add: '#000000' },
  { y: 70, mul: '#845e74', add: '#000000' },
  { y: 120, mul: '#96636f', add: '#000000' },
  { y: 170, mul: '#ae6c6a', add: '#000000' },
  { y: 210, mul: '#c8715f', add: '#000000' },
  { y: 245, mul: '#e87c55', add: '#000000' },
  { y: 275, mul: '#ff9152', add: '#0a0000' },
  { y: 321, mul: '#5a6a7a', add: '#000000' },   // hills
  { y: 354, mul: '#5a5a70', add: '#000000' },   // town
  { y: 422, mul: '#5f7380', add: '#000000' },   // field
  { y: 512 }
];
var DUSK_MUL = { houses: '#8f96a8', tiles: '#8a8ea0', carrier: '#e8dcd8', dog: '#8f96a8', drone: '#8f96a8' };
// Window panes lit warm: [house, x, y, w, h] in cell coords, measured off houses.png.
var DUSK_WINDOWS = [
  [0, 74, 152, 10, 14], [0, 86, 152, 10, 14],
  [2, 24, 168, 7, 11], [2, 33, 168, 7, 11],
  [3, 70, 46, 5, 6], [3, 77, 46, 5, 6], [3, 70, 54, 5, 6], [3, 77, 54, 5, 6]
];
var DUSK_WINDOW_GLOW = ['#805018', '#6a4210'];   // two-step cycle, palette-cycling proper

var Title = {
  on: false, state: 'off', t: 0, f: 0, pf: 0,
  skipCard: false, logoY: 0, mail: false, armed: false,
  dusk: null, aliveT: 0, mover: 0, moverX: 0, oneShot: -1
};

function titleActive() { return Title.on; }
function titleAttract() { /* attract mode hook: no demo to play, so nothing yet */ }

function titleBegin() {
  Title.on = true; Title.state = 'card'; Title.t = 0; Title.f = 0; Title.pf = 0;
  Title.skipCard = false; Title.armed = false;
  Title.aliveT = 0; Title.mover = 0; Title.hopT = 0; Title.oneShot = -1; Title.dusk = null;
  // Ask for every sheet now, so the card is where the wait happens. EVERY one,
  // read off the clip table (sprWarmAll, sprites.js): this was a hand-typed
  // list of six, and each sheet added after it loaded mid-level instead.
  sprWarmAll();
}

// The card holds (up to TB.cardCap) until every sheet has resolved; a failed
// sheet counts as resolved.
function titleSheetsReady() {
  return sprSettled();
}

// The press that starts the game. Every beat is skippable by it.
function titlePress() {
  if (!Title.on) return;
  var st = Title.state;
  if (st === 'card' || st === 'cardOut') { Title.skipCard = true; return; }
  if (st === 'sceneIn' || st === 'hold' || st === 'drop' || st === 'landed' || st === 'settle') { titleArm(); sfx('menu'); return; }
  // PLAYER 1 - START, pressed: the coin-in chirp, and the title's music hands
  // over to the level's under the flash (CLU, 0.10.0).
  if (st === 'armed') { titleGo('confirm'); sfx('start'); musicPlay('level'); }
}
function titleArm() { Title.state = 'armed'; Title.t = 0; Title.pf = 0; Title.logoY = 0; Title.armed = true; }
function titleGo(st) { Title.state = st; Title.t = 0; }
// How far above its line the logo starts: its own height plus the line's
// distance from the top, so its lowest pixel begins just outside the frame.
function titleDropFrom() {
  var lg = buildTitle(GAME_TITLE, view.w, view.h);
  return Math.round(view.h * TL.titleTop) - lg.big.capTop + lg.canvas.height;
}

// One simulation step. Returns false once the title has handed off.
function titleStep() {
  if (!Title.on) return false;
  Title.f++; Title.t++;
  var t = Title.t;
  switch (Title.state) {
    case 'card':
      if (t >= TB.cardCap || (t >= TB.cardHold && titleSheetsReady()) || (Title.skipCard && t >= TB.cardIn && titleSheetsReady())) titleGo('cardOut');
      break;
    case 'cardOut': if (t >= TB.cardOut) { titleGo(Title.skipCard ? 'armed' : 'sceneIn'); if (Title.skipCard) titleArm(); } break;
    case 'sceneIn': if (t >= TB.sceneIn) titleGo('hold'); break;
    case 'hold': if (t >= TB.hold) { titleGo('drop'); Title.logoY = -titleDropFrom(); Title.logoV = 0; Title.bounced = false; } break;
    case 'drop':
      // Falls under gravity from wholly above the frame, hits its line, bounces
      // ONCE at a fraction of the impact speed, and the second contact is the
      // landing. (Evrtek, 2026-09-21: "fall into frame, bounce once and settle".)
      Title.logoV += TB.gravity; Title.logoY += Title.logoV;
      if (Title.logoY >= 0) {
        Title.logoY = 0;
        if (Title.bounced) titleGo('landed');
        else { Title.logoV = -Title.logoV * TB.bounce; Title.bounced = true; }
      }
      break;
    case 'landed': if (t >= TB.landed) titleGo('settle'); break;
    case 'settle': if (t >= TB.settle) titleArm(); break;
    case 'armed': Title.pf++; titleAliveStep(); break;
    case 'confirm':
      titleAliveStep();
      if (t >= TB.flash + TB.solid + TB.fadeOut) { Title.on = false; Title.state = 'off'; return false; }
      break;
  }
  return true;
}

// Alive, not busy: every ~200 frames the carrier plays one one-shot, and on
// alternate cycles a dog trots the pavement or a drone crosses the sky.
function titleAliveStep() {
  Title.aliveT++;
  if (Title.mover === 2) {
    Title.moverX += 3;                                  // drone rightward across the sky
    if (Title.moverX > view.w + 120) Title.mover = 0;
  } else if (Title.mover === 1) {
    // The dog has no trot: it crosses the pavement leftward in hops, and only
    // the leap moves it. Facing left, so it goes the way it looks.
    var hp = ++Title.hopT;
    if (hp >= HOP.coil + HOP.leap + HOP.land + HOP.rest) Title.hopT = 0;
    else if (hp > HOP.coil && hp <= HOP.coil + HOP.leap) Title.moverX -= HOP.dist / HOP.leap;
    if (Title.moverX < -120) Title.mover = 0;
  }
  if (Title.oneShot >= 0 && ++Title.oneShot >= 36) Title.oneShot = -1;
  if (Title.aliveT % TB.alive === 0) {
    var cycle = (Title.aliveT / TB.alive) | 0;
    if (cycle % 2 === 1) Title.oneShot = 0;
    else if (!Title.mover) { Title.mover = (cycle % 4 === 0) ? 1 : 2; Title.moverX = Title.mover === 1 ? view.w + 100 : -80; Title.hopT = 0; }
  }
}

// --- Fades: quantised to 16 steps, the way hardware did it ------------------
function titleFadeAlpha(t, n, up) { var a = Math.round((t / n) * 15) / 15; a = Math.max(0, Math.min(1, a)); return up ? 1 - a : a; }
function titleBlack(ctx, a) { if (a <= 0) return; ctx.globalAlpha = a; ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, view.w, view.h); ctx.globalAlpha = 1; }

// --- Dusk regrade, built once per sheet, compositing only -------------------
function titleCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; var x = c.getContext('2d'); x.imageSmoothingEnabled = false; return c; }
function duskSheet(img, bands) {
  var c = titleCanvas(img.width, img.height), x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  var i, b, y0, y1, xx;
  // Multiply is cumulative, so every pixel is tinted exactly once: the band
  // fills stop short of the seam rows, and a 2x2 checker of the two tints
  // covers the row above and the row below each seam.
  x.globalCompositeOperation = 'multiply';
  var n = bands.length - 1;
  for (i = 0; i < n; i++) {
    b = bands[i]; y0 = b.y + (i > 0 ? 1 : 0); y1 = bands[i + 1].y - (i < n - 1 ? 1 : 0);
    x.fillStyle = b.mul; x.fillRect(0, y0, c.width, y1 - y0);
  }
  for (i = 1; i < n; i++) {
    y0 = bands[i].y;
    for (xx = 0; xx < c.width; xx++) {
      var odd = (xx + y0) & 1;
      x.fillStyle = odd ? bands[i].mul : bands[i - 1].mul; x.fillRect(xx, y0 - 1, 1, 1);
      x.fillStyle = odd ? bands[i - 1].mul : bands[i].mul; x.fillRect(xx, y0, 1, 1);
    }
  }
  x.globalCompositeOperation = 'lighter';
  for (i = 0; i < bands.length - 1; i++) {
    b = bands[i]; if (!b.add || b.add === '#000000') continue;
    x.fillStyle = b.add; x.fillRect(0, b.y, c.width, bands[i + 1].y - b.y);
  }
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-over';
  return c;
}
function duskFlat(img, mul) { return duskSheet(img, [{ y: 0, mul: mul, add: '#000000' }, { y: img.height }]); }
function duskHouses(img, glow) {
  var c = duskFlat(img, DUSK_MUL.houses), x = c.getContext('2d');
  x.globalCompositeOperation = 'lighter';
  x.fillStyle = glow;
  for (var i = 0; i < DUSK_WINDOWS.length; i++) { var w = DUSK_WINDOWS[i]; x.fillRect(w[0] * 128 + w[1], w[2], w[3], w[4]); }
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-over';
  return c;
}
function titleBuildDusk() {
  if (Title.dusk) return Title.dusk;
  var S = SPR.sheets, d = {};
  function img(f) { return S[f] && S[f].state === 1 ? S[f].img : null; }
  var far = img('bg-far.png'), ho = img('houses.png'), ti = img('tiles.png'), ca = img('carrier.png'), dg = img('dog.png'), dr = img('drone.png');
  d['bg-far.png'] = far ? duskSheet(far, DUSK_FAR) : null;
  d['houses.png'] = ho ? duskHouses(ho, DUSK_WINDOW_GLOW[0]) : null;
  d.houses2 = ho ? duskHouses(ho, DUSK_WINDOW_GLOW[1]) : null;
  d['tiles.png'] = ti ? duskFlat(ti, DUSK_MUL.tiles) : null;
  d['carrier.png'] = ca ? duskFlat(ca, DUSK_MUL.carrier) : null;
  d['dog.png'] = dg ? duskFlat(dg, DUSK_MUL.dog) : null;
  d['drone.png'] = dr ? duskFlat(dr, DUSK_MUL.drone) : null;
  Title.dusk = d;
  return d;
}
// Draw frame f of a clip from its dusk sheet at integer scale k, origin at the feet.
function duskClip(ctx, name, f, dx, dy, k, flip) {
  var c = SPR.clips[name]; if (!c) return false;
  var sh = Title.dusk && Title.dusk[c.file]; if (!sh) return false;
  var i = c.frames <= 1 ? 0 : ((f | 0) % c.frames + c.frames) % c.frames;
  var sx = c.x + i * c.w, sy = c.y + c.row * c.h;
  var py = Math.round(dy - c.oy * k);
  if (flip) {
    // Sheets face right; a mover going left is mirrored the way sprDraw does it.
    var px = Math.round(dx - (c.w - c.ox) * k);
    ctx.save(); ctx.translate(px + c.w * k, py); ctx.scale(-1, 1);
    ctx.drawImage(sh, sx, sy, c.w, c.h, 0, 0, c.w * k, c.h * k);
    ctx.restore();
  } else {
    ctx.drawImage(sh, sx, sy, c.w, c.h, Math.round(dx - c.ox * k), py, c.w * k, c.h * k);
  }
  return true;
}

// --- Drawing -----------------------------------------------------------------
function titleDraw(ctx) {
  if (!Title.on) return;
  var W = view.w, H = view.h, st = Title.state, t = Title.t;
  ctx.imageSmoothingEnabled = false;
  if (st === 'card' || st === 'cardOut') {
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, H);
    // The maker's card: type only, one line, sized from the view like everything else.
    var cs = Math.max(3, Math.min(6, Math.floor(W * 0.4 / lfLayout(LF_DISPLAY, GAME_MAKER).w)));
    var card = buildWordmark(GAME_MAKER, cs);
    ctx.drawImage(card.canvas, (W - card.w) >> 1, ((H - card.h) >> 1));
    if (st === 'card') titleBlack(ctx, titleFadeAlpha(Math.min(t, TB.cardIn), TB.cardIn, true));
    else titleBlack(ctx, titleFadeAlpha(t, TB.cardOut, false));
    return;
  }
  titleScene(ctx);
  if (st === 'sceneIn') titleBlack(ctx, titleFadeAlpha(t, TB.sceneIn, true));
  if (st === 'confirm' && t > TB.flash + TB.solid) titleBlack(ctx, titleFadeAlpha(t - TB.flash - TB.solid, TB.fadeOut, false));
}

function titleScene(ctx) {
  var W = view.w, H = view.h, st = Title.state, f = Title.f;
  var ground = Math.round(H * TL.ground);
  var d = titleSheetsReady() ? titleBuildDusk() : null;

  // Sky: banded fills so there is a dusk even before (or without) the far layer.
  var sky = ['#2a3a63', '#35406a', '#45476e', '#5c4f6e', '#7a5a68', '#9c6a5c', '#c8804f'];
  for (var i = 0; i < 7; i++) { ctx.fillStyle = sky[i]; ctx.fillRect(0, Math.round(i * ground / 7), W, Math.round((i + 1) * ground / 7) - Math.round(i * ground / 7)); }
  ctx.fillStyle = '#2f4a4a'; ctx.fillRect(0, ground - 32, W, 32);

  // Far layer, drifting 1 px every 4th frame, its field just above the ground line.
  if (d && d['bg-far.png']) {
    var far = d['bg-far.png'], top = ground - 512 + 90;
    var x0 = -(((f / TB.drift) | 0) % far.width);
    for (var x = x0; x < W; x += far.width) ctx.drawImage(far, x, top);
  }
  // Drone crosses the sky behind the logo.
  if (Title.mover === 2) duskClip(ctx, 'drone.hover', (f / 4) | 0, Math.round(Title.moverX), Math.round(H * 0.5), 1);

  // Four house fronts at 1:1, symmetric, feet on the ground line.
  if (d && d['houses.png']) {
    var hs = ((f >> 5) & 1) ? d.houses2 : d['houses.png'], order = [0, 1, 3, 2];
    var gap = (W - 4 * 128) / 5;
    for (i = 0; i < 4; i++) {
      var hx = Math.round(gap + i * (128 + gap));
      ctx.drawImage(hs, order[i] * 128, 0, 128, 216, hx, ground - 216, 128, 216);
    }
  }
  // Dog trots the pavement.
  if (Title.mover === 1) {
    var hp = Title.hopT, clip = 'dog.idle', fr = (f / 10) | 0, lift = 0;
    if (hp <= HOP.coil) { clip = 'dog.coil'; fr = Math.min(2, (hp / 4) | 0); }
    else if (hp <= HOP.coil + HOP.leap) {
      var u = (hp - HOP.coil) / HOP.leap;
      clip = 'dog.leap'; fr = u < 0.5 ? 0 : 1; lift = Math.round(HOP.arc * 4 * u * (1 - u));
    } else if (hp <= HOP.coil + HOP.leap + HOP.land) { clip = 'dog.land'; fr = Math.min(1, ((hp - HOP.coil - HOP.leap) / 4) | 0); }
    duskClip(ctx, clip, fr, Math.round(Title.moverX), ground - lift, 1, true);
  }

  // Ground band: pavement, kerb, street, to the frame edge.
  if (d && d['tiles.png']) {
    var n = ((W / 32) | 0) + 1;
    for (i = 0; i < n; i++) {
      duskClip(ctx, 'tile.pavement', (i * 7) % 4, i * 32 + 16, ground + 32, 1);
      duskClip(ctx, 'tile.kerb', (i * 5) % 2, i * 32 + 16, ground + 64, 1);
      duskClip(ctx, 'tile.street', (i * 3) % 4, i * 32 + 16, ground + 96, 1);
    }
  } else {
    ctx.fillStyle = '#5a5f6e'; ctx.fillRect(0, ground, W, H - ground);
    ctx.fillStyle = '#7f7c75'; ctx.fillRect(0, ground, W, 4);
  }

  // The carrier at x2, feet on the ground line, idle with the occasional one-shot.
  var cx = W >> 1;
  if (Title.oneShot >= 0 && SPR.clips['carrier.drink']) duskClip(ctx, 'carrier.drink', (Title.oneShot / 6) | 0, cx, ground, 2);
  else duskClip(ctx, 'carrier.idle', (f / 10) | 0, cx, ground, 2);

  // The logo: still, except for its one drop.
  if (st === 'drop' || st === 'landed' || st === 'settle' || st === 'armed' || st === 'confirm') {
    var lg = buildTitle(GAME_TITLE, W, H);
    var ly = Math.round(H * TL.titleTop) - lg.big.capTop + (st === 'drop' ? Title.logoY : 0);
    ctx.drawImage(lg.canvas, (W - lg.w) >> 1, ly);
  }

  // The prompt: 32 lit, 32 dark, hard toggle. Confirm: 4/4 for 24 frames then solid.
  if (st === 'armed' || st === 'confirm') {
    var lit;
    if (st === 'confirm') lit = Title.t < TB.flash ? ((Title.t >> 2) & 1) === 0 : true;
    else lit = ((Title.pf >> 5) & 1) === 0;
    if (lit) {
      var touch = (typeof Touch !== 'undefined' && Touch.on);
      drawUIText(ctx, touch ? GAME_PROMPT_TOUCH : GAME_PROMPT, cx, Math.round(H * TL.promptBase), 3, '#e4e0e1', 'center');
    }
    drawUIText(ctx, 'V' + GAME_VERSION + '   ' + GAME_MAKER + ' 2026', cx, Math.round(H * TL.creditBase), 2, '#a9a39f', 'center');
  }

  // Still waiting on art past the cap: four squares lighting in sequence. No word.
  if (!d) {
    var lit4 = ((f / 12) | 0) % 5;
    for (i = 0; i < 4; i++) { ctx.fillStyle = i < lit4 ? '#e4e0e1' : '#592307'; ctx.fillRect(W - 60 + i * 12, H - 20, 8, 8); }
  }
}
