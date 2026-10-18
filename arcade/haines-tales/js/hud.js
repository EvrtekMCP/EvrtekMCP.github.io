'use strict';
// ---------------------------------------------------------------------------
// The status bar.
//
// A black band across the top, the way Castlevania and every arcade platformer
// of that era did it: lives, health, score, ammunition and the clock, all in
// one place that never moves and never overlaps the world.
//
// Drawn on the crisp overlay rather than in the pixel buffer, on purpose and
// for now: it has to be legible while the numbers are still being argued about.
// When Yori draws the real one it moves into the buffer and becomes art.
// ---------------------------------------------------------------------------

var HUD = { h: 0, top: 0, bar: 0, pad: 0, font: 12 };

function hudLayout(cssW, cssH) {
  // The phone's own top inset is its business: the black runs through it so the
  // notch sits in black, but nothing of OURS is placed above HUD.top. In
  // portrait on a Home Screen web app the score sat under the clock without it.
  HUD.top = Touch.safe.t || 0;
  HUD.bar = Math.max(30, Math.min(52, Math.min(cssW, cssH) * 0.105));
  HUD.h = HUD.top + HUD.bar;
  HUD.pad = Math.round(HUD.bar * 0.30);
  HUD.font = Math.round(HUD.bar * 0.34);
}

function hudTime(t) {
  if (t < 0) t = 0;
  var m = Math.floor(t / 60), s = Math.floor(t % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// The lives icon is HIS head — cropped out of carrier.idle frame 0 on the real
// sheet (cap, shades, grin: x 33-72, y 27-58 of the cell), and the package
// counter is the parcel pickup itself off items.png. Evrtek, 2026-09-21: "a
// better looking version of the face for number of lives... pull from one of
// the carrier frames", "same for the special packages indicator". Each is drawn
// nearest-neighbour to a fraction of the bar height; while a sheet is still
// loading the old hand-placed pixels below stand in, the same seam as the world.
var HUD_FACE = { clip: 'carrier.idle', x: 33, y: 27, w: 40, h: 32 };
var HUD_NADE = { clip: 'item.package', frame: 0, box: null };

// The sheet and cell for a clip, or null until it has arrived and is painted.
function hudSheet(clip) {
  if (typeof sprHas !== 'function' || !sprHas(clip)) return null;
  var c = SPR.clips[clip], sh = SPR.sheets[c.file];
  return sh && sh.state === 1 ? { img: sh.img, c: c } : null;
}

// Draws a crop of a sheet at a height of `tall` CSS px, integer-snapped position,
// returns the width used.
function hudBlit(c, img, sx, sy, sw, sh, x, midY, tall) {
  var k = tall / sh, w = Math.round(sw * k);
  c.imageSmoothingEnabled = false;
  c.drawImage(img, sx, sy, sw, sh, Math.round(x), Math.round(midY - tall * 0.5), w, Math.round(tall));
  return w;
}

function hudFace(c, x, midY, tall) {
  var s = hudSheet(HUD_FACE.clip);
  if (!s) return 0;
  return hudBlit(c, s.img, s.c.x + HUD_FACE.x, s.c.y + s.c.row * s.c.h + HUD_FACE.y, HUD_FACE.w, HUD_FACE.h, x, midY, tall);
}

// The parcel sits low in its 40x40 cell, so the cell is measured once for the
// ink's own box and that box is what gets drawn, centred on the bar.
function hudNadeSprite(c, x, midY, tall) {
  var s = hudSheet(HUD_NADE.clip);
  if (!s) return 0;
  if (!HUD_NADE.box) {
    var cv = document.createElement('canvas'), cc = s.c, fx = cc.x + HUD_NADE.frame * cc.w, fy = cc.y + cc.row * cc.h;
    cv.width = cc.w; cv.height = cc.h;
    var g = cv.getContext('2d'); g.drawImage(s.img, fx, fy, cc.w, cc.h, 0, 0, cc.w, cc.h);
    var d = g.getImageData(0, 0, cc.w, cc.h).data, x0 = cc.w, y0 = cc.h, x1 = -1, y1 = -1;
    for (var yy = 0; yy < cc.h; yy++) for (var xx = 0; xx < cc.w; xx++) if (d[(yy * cc.w + xx) * 4 + 3] >= 128) {
      if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
    }
    if (x1 < 0) return 0;
    HUD_NADE.box = { sx: fx + x0, sy: fy + y0, sw: x1 - x0 + 1, sh: y1 - y0 + 1 };
  }
  var b = HUD_NADE.box;
  return hudBlit(c, s.img, b.sx, b.sy, b.sw, b.sh, x, midY, tall);
}

// A carrier's head, eight pixels of it — the stand-in until carrier.png arrives.
function hudIcon(c, x, y, s) {
  c.fillStyle = PAL.cap;
  c.fillRect(x, y, s * 7, s * 2);
  c.fillRect(x + s * 7, y + s, s * 2, s);
  c.fillStyle = PAL.skin;
  c.fillRect(x + s, y + s * 2, s * 5, s * 4);
  c.fillStyle = PAL.shade;
  c.fillRect(x + s, y + s * 3, s * 5, s * 1.5);
}

function hudCapsule(c, x, y, w, h) {
  var r = h * 0.5;
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// Long bubbles, not tiny blocks. Each cell is wide enough that a part-full one
// reads as a fraction at a glance, which is the whole job of a health bar you
// are meant to read while something is chasing you.
function hudCells(c, x, y, w, h) {
  var cells = Math.max(1, Math.min(6, TUNE.hpCells | 0));
  var per = Math.max(1, TUNE.hpPerCell | 0);
  var gap = Math.max(2, Math.round(h * 0.34));
  var cw = (w - gap * 5) / 6;
  for (var i = 0; i < 6; i++) {
    var cx = x + i * (cw + gap);
    if (i >= cells) {                       // not earned yet: an empty outline
      c.globalAlpha = 0.55;
      hudCapsule(c, cx, y, cw, h);
      c.strokeStyle = PAL.hpGhost;
      c.lineWidth = 1.2;
      c.stroke();
      c.globalAlpha = 1;
      continue;
    }
    hudCapsule(c, cx, y, cw, h);
    c.fillStyle = PAL.hpEmpty;
    c.fill();
    var inCell = Math.max(0, Math.min(per, P.hp - i * per));
    if (inCell > 0) {
      c.save();
      c.clip();                             // fill INSIDE the capsule, so a part
      c.fillStyle = PAL.hpFill;             // cell keeps its rounded end
      c.fillRect(cx, y, cw * (inCell / per), h);
      c.fillStyle = PAL.hpTop;
      c.fillRect(cx, y + h * 0.12, cw * (inCell / per), Math.max(1, h * 0.22));
      c.restore();
    }
    hudCapsule(c, cx, y, cw, h);
    c.strokeStyle = 'rgba(0,0,0,0.9)';
    c.lineWidth = 1.2;
    c.stroke();
  }
}

function hudNade(c, x, y, s) {
  c.fillStyle = PAL.parcel;
  c.fillRect(x, y, s * 6, s * 5);
  c.fillStyle = PAL.parcelTape;
  c.fillRect(x + s * 2.4, y, s * 1.2, s * 5);
  c.fillRect(x, y + s * 2, s * 6, s * 1.2);
}

// ONE ENVELOPE, at whatever height the bar can spare. Deliberately the SAME
// nine-by-six recipe drawToss() uses for a letter in flight — body, a flap band
// across the top, a mark where the flap meets — so the thing in the corner and
// the thing leaving his hand are recognisably one object rather than two
// drawings of the same idea. Returns the width it used, like hudFace().
//
// Drawn rather than blitted from items.png on purpose: item.thick is a fat
// BUNDLE tied with string, which says "pick me up", and this has to say "this
// is what you throw". The bar is still overlay text and not art; when Yori's
// hud.png lands the whole row moves into the buffer together.
function hudEnvelope(c, x, midY, tall) {
  var u = Math.max(1, Math.round(tall / 6));
  var w = 9 * u, h = 6 * u;
  // One unit UP from the text's own middle. The power-up row deliberately sits
  // low in the bar so that losing something is visible, and a solid glyph
  // centred on that line puts its bottom row straight through the bar's own
  // hairline border — a notch in the underline. Text gets away with it because
  // only its descenders reach that far; a filled rectangle does not.
  var ix = Math.round(x), iy = Math.round(midY - h * 0.5) - u;
  c.fillStyle = PAL.mail;
  c.fillRect(ix, iy, w, h);
  c.fillStyle = PAL.mailFlap;
  c.fillRect(ix, iy, w, u);                 // the flap, folded down
  c.fillRect(ix + 3 * u, iy + 2 * u, 3 * u, 2 * u);
  return w;
}

function drawHudBar(c) {
  var w = Fit.cssW, h = HUD.h;
  var sl = Touch.safe.l || 0, sr = Touch.safe.r || 0;

  c.fillStyle = '#000000';
  c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(143,208,255,0.35)';
  c.fillRect(0, h - 1, w, 1);

  var f = HUD.font;
  c.font = '700 ' + f + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
  c.textBaseline = 'middle';
  c.textAlign = 'left';

  var mid = HUD.top + HUD.bar * 0.5;
  var x = sl + HUD.pad;
  var ps = Math.max(1, Math.round(HUD.bar * 0.055));      // pixel size for the icon

  // Lives: his face off the sheet, the pixel head until it loads.
  var fw = hudFace(c, x, mid, Math.round(HUD.bar * 0.8));
  if (fw) x += fw + HUD.pad * 0.5;
  else { hudIcon(c, x, mid - ps * 3, ps); x += ps * 9 + HUD.pad * 0.5; }
  // WHERE THE PORTRAIT ENDS. The standing power-up row at the bottom of the bar
  // starts here and not at the bar's left edge, because the portrait is drawn
  // at 80% of the BAR's height and therefore reaches all the way down into that
  // row. The words THICK and EXPRESS had always been printed over the bottom of
  // his face and got away with it; a solid envelope did not — it landed on his
  // chin and the ×3 beside it was unreadable against the cap. Found by
  // magnifying the drawn bar rather than by looking at a screenshot.
  var afterFace = x;
  c.fillStyle = '#e8f2ff';
  var lives = ('0' + Math.min(99, P.lives)).slice(-2);
  c.fillText('×' + lives, x, mid + 1);
  x += c.measureText('×' + lives).width + HUD.pad;

  // Health.
  var cellW = Math.min(w * 0.34, HUD.bar * 5.4);
  var cellH = HUD.bar * 0.34;
  hudCells(c, x, mid - cellH * 0.5, cellW, cellH);
  x += cellW + HUD.pad;

  // Packages on hand: the parcel pickup itself, the three rectangles until it loads.
  var nw = hudNadeSprite(c, x, mid, Math.round(HUD.bar * 0.7));
  if (nw) x += nw + HUD.pad * 0.4;
  else { hudNade(c, x, mid - ps * 2.5, ps); x += ps * 7 + HUD.pad * 0.4; }
  c.fillStyle = P.grenades > 0 ? '#e8f2ff' : '#54657a';
  c.fillText('×' + P.grenades, x, mid + 1);
  x += c.measureText('×' + P.grenades).width;
  var leftEnd = x;

  // Clock, hard right, and red when it is nearly gone.
  c.textAlign = 'right';
  var t = Level.time;
  c.fillStyle = (t <= 30 && (Math.floor(t * 2) & 1)) ? '#ff6b5e' : (t <= 30 ? '#ffb4ab' : '#e8f2ff');
  c.fillText(hudTime(t), w - sr - HUD.pad, mid + 1);
  var tw = c.measureText(hudTime(t)).width;
  c.fillStyle = '#54657a';
  c.font = '700 ' + Math.round(f * 0.72) + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
  var timeLeft = w - sr - HUD.pad - tw - HUD.pad * 0.5 - c.measureText('TIME').width;
  c.fillText('TIME', w - sr - HUD.pad - tw - HUD.pad * 0.5, mid + 1);

  // Score, centred in whatever is left — measured between the left cluster and
  // the clock, not at half the width: the face and the parcel made the left
  // side wider and the score ran into the package count.
  c.font = '700 ' + f + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
  c.textAlign = 'center';
  c.fillStyle = '#e8f2ff';
  c.fillText(('0000000' + P.score).slice(-7), Math.round((leftEnd + timeLeft) * 0.5), mid + 1);

  // What you just picked up, briefly, under the bar.
  if (P.gotItemT > 0) {
    var a = Math.min(1, P.gotItemT / 0.45);
    c.globalAlpha = a;
    c.fillStyle = PAL.itemGlow;
    c.font = '700 ' + Math.round(f * 0.9) + 'px ui-sans-serif, system-ui, sans-serif';
    c.fillText(ITEM_NAME[P.gotItem] || '', w * 0.5, h + f * 1.4);
    c.globalAlpha = 1;
  }

  // Standing power-ups, bottom left of the bar, so their loss is visible.
  c.textAlign = 'left';
  c.font = '700 ' + Math.round(f * 0.66) + 'px ui-sans-serif, system-ui, sans-serif';
  var px2 = afterFace;
  var py2 = HUD.top + HUD.bar - f * 0.42;
  // THE MAIL TIER, as an envelope and a count. Evrtek, 2026-09-23: three levels
  // of the envelope weapon, so the bar says WHICH ONE rather than the word
  // THICK — which could only ever say on or off and would have to lie the
  // moment there were three states.
  //
  // TIER 1 SHOWS NOTHING, exactly as no THICK showed nothing before it. Tier 1
  // is the weapon everybody has and never loses; a permanent "×1" in the corner
  // is a light that is always on, which is a light nobody reads. So the icon
  // appearing means you went up and the icon vanishing means you came back down
  // to bare mail — both of which are the events worth seeing.
  var tier = Math.max(1, Math.min(MAIL_TIER_MAX, P.mailTier | 0));
  if (tier > 1) {
    var ew = hudEnvelope(c, px2, py2, Math.round(f * 0.72));
    px2 += ew + 3;
    c.fillStyle = PAL.itemGlow;
    var mult = '×' + tier;
    c.fillText(mult, px2, py2);
    px2 += c.measureText(mult).width + 8;
  }
  if (P.pwExpress) { c.fillStyle = '#9fe8b0'; c.fillText('EXPRESS', px2, py2); px2 += c.measureText('EXPRESS').width + 8; }
  if (P.ryeT > 0) { c.fillStyle = '#ffd27a'; c.fillText('RYE ' + P.ryeT.toFixed(1), px2, py2); }
}
