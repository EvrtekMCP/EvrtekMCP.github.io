'use strict';
// ---------------------------------------------------------------------------
// Pickups, and the checkpoint.
//
// Items hover in place rather than sitting on the floor — his call, and it is
// the right one: a hovering thing reads as "collect me" from across a screen,
// and a thing lying on the ground reads as scenery.
//
// A fixed pool, like everything else. Items can be placed in the level or fall
// out of a broken block, and both go through the same door.
// ---------------------------------------------------------------------------

var IT_THICK = 0, IT_BAG = 1, IT_EXPRESS = 2, IT_RYE = 3, IT_GUMMY = 4, IT_PACKAGE = 5;

var ITEM_NAME = ['THICK MAIL', 'MAIL BAG', 'EXPRESS', 'RYE & GINGER', 'GUMMY WORMS', 'PACKAGE'];

// What each one sounds like when he takes it (audio.js), in IT_ order. The bag
// is a life, so it keeps the 1-up; until 0.10.0 the other five shared one chime.
var ITEM_SFX = ['getThick', 'oneUp', 'getExpress', 'getRye', 'getGummy', 'getPackage'];

var ITEM_MAX = 56;

// The pickup's collision box, in world pixels: 0.875 of a tile on both axes.
// Derived from TS so the next resolution change carries it — 28 at TS=32, and
// at the old TS=16 it reproduces the original 14 exactly.
var ITEM_BOX = TS * 0.875;

var Items = { n: 0, a: [] };
(function () {
  for (var i = 0; i < ITEM_MAX; i++)
    Items.a.push({ x: 0, y: 0, w: ITEM_BOX, h: ITEM_BOX, kind: 0, homeY: 0, bob: 0, born: 0, vy: 0, settled: true });
})();

function itemsClear() { Items.n = 0; }

// `fall` is for an item that has just come out of a block: it pops upward and
// then settles into its hover, so it reads as having been inside the block.
function itemSpawn(px, py, kind, fall) {
  if (Items.n >= ITEM_MAX) return null;
  var it = Items.a[Items.n++];
  it.x = px; it.y = py;
  it.w = ITEM_BOX; it.h = ITEM_BOX;
  it.kind = kind;
  it.homeY = py;
  it.bob = Math.random() * 6.283;
  it.settled = !fall;
  it.vy = fall ? -140 * (TS / 16) : 0;   // world px/s; pairs with the 900 in itemsStep
  return it;
}

function itemsReset() {
  itemsClear();
  for (var i = 0; i < World.items.length; i++) {
    var s = World.items[i];
    itemSpawn(s.tx * TS + (TS - ITEM_BOX) * 0.5, s.ty * TS, s.kind, false);   // centre the box in its tile
  }
}

function itemKill(i) {
  var last = Items.a[--Items.n];
  var dead = Items.a[i];
  Items.a[Items.n] = dead; Items.a[i] = last;
}

// What each one actually does. One switch, so the list in the dossier and the
// list in the code cannot drift apart.
function itemApply(kind) {
  switch (kind) {
    // THICK is a STEP UP, not a switch: single -> double -> triple, and the
    // third one you find is not wasted so much as capped. See tossVolley().
    case IT_THICK:
      P.mailTier = Math.min(MAIL_TIER_MAX, Math.max(1, P.mailTier | 0) + 1); break;
    case IT_BAG:
      P.lives = Math.min(99, P.lives + 1); break;
    case IT_EXPRESS:
      P.pwExpress = true; break;
    case IT_RYE:
      P.ryeT = TUNE.ryeTime; break;
    case IT_GUMMY:
      P.hp = Math.min(P.hpMax, P.hp + (TUNE.hpPerCell | 0)); break;
    case IT_PACKAGE:
      P.grenades = Math.min(TUNE.nadeMax | 0, P.grenades + 1); break;
  }
  // EVERY pickup comes through here — placed, out of a block, off a drone —
  // so one increment catches all three.
  if (typeof Tally !== 'undefined') Tally.items++;
  P.score += TUNE.scoreItem | 0;
  sfx(ITEM_SFX[kind] || 'itemGet');
  P.gotItem = kind;          // the HUD flashes this for a moment
  P.gotItemT = 1.4;
}

function itemsStep(dt, now) {
  for (var i = 0; i < Items.n; i++) {
    var it = Items.a[i];
    if (!it.settled) {
      it.vy += 900 * (TS / 16) * dt;   // world px/s^2; pairs with the launch speed in itemSpawn
      it.y += it.vy * dt;
      if (it.vy > 0 && it.y >= it.homeY) { it.y = it.homeY; it.settled = true; }
    } else {
      it.bob += TUNE.itemBobRate * dt;
      it.y = it.homeY + Math.sin(it.bob) * TUNE.itemBob;
    }
    if (aabbOverlap(P, it)) {
      puff(it.x + it.w * 0.5, it.y + it.h * 0.5, 0, -50 * (TS / 16), 8, PAL.itemGlow);
      itemApply(it.kind);
      itemKill(i); i--;
    }
  }
}

// --- The checkpoint --------------------------------------------------------
// A mailbox halfway through. Touch it and the flag goes up, which is the only
// signal it needs to give.

// Trigger box and drawn footprint, in world pixels: 1.0 x 1.5 tiles (32 x 48).
var Check = { x: 0, y: 0, w: TS, h: TS * 1.5, hit: false, flag: 0, armed: false };

// A LEVEL MAY HAVE SEVERAL. There was exactly one, 61% of the way into level 1,
// which was tolerable while a death put you back where you fell and stopped
// being tolerable the day a death started costing ground: 176 tiles with no
// safety net. `Check` stays as element ZERO of this list, the same object, so
// the sandbox and every assertion in tools/check.js still see precisely the
// one checkpoint they were written against.
var Checks = [Check];

function checkReset(keepHit) {
  var list = (World.checks && World.checks.length) ? World.checks
           : (World.check.tx > 0 ? [World.check] : []);
  Checks.length = 1;
  Check.armed = list.length > 0;
  for (var i = 0; i < list.length; i++) {
    var c = i === 0 ? Check : { x: 0, y: 0, w: TS, h: TS * 1.5, hit: false, flag: 0, armed: true };
    c.x = list[i].tx * TS;
    c.y = list[i].ty * TS - c.h;
    if (!keepHit || i > 0) { c.hit = false; c.flag = 0; }
    Checks[i] = c;
  }
}

function checkStep(dt) {
  if (!Check.armed) return;
  for (var i = 0; i < Checks.length; i++) {
    var c = Checks[i];
    if (c.hit) {
      if (c.flag < 1) c.flag = Math.min(1, c.flag + dt * 3.5);
      continue;
    }
    if (aabbOverlap(P, c)) {
      c.hit = true;
      // THE FURTHEST ONE WINS. Walking back to raise a flag you skipped must
      // not move your respawn backwards behind one you have already reached.
      var cx = c.x + c.w * 0.5 - P.w * 0.5;
      if (cx > P.checkX) {
        P.checkX = cx;
        P.checkY = c.y + c.h - standHeight();
      }
      P.score += TUNE.scoreCheck | 0;
      sfx('checkpoint');
      puff(c.x + c.w * 0.5, c.y, 0, -90 * (TS / 16), 14, PAL.flag);
    }
  }
}
