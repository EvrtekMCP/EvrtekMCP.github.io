'use strict';
// ---------------------------------------------------------------------------
// Tilemap and collision.
//
// Swept AABB against a tile grid, one axis at a time, sub-stepped so nothing
// can tunnel through a wall at any slider setting. About eighty lines, exact,
// and it runs in microseconds — a physics library would be both larger and
// worse for platformer feel, because a platformer's movement is a hand-authored
// lie and a solver keeps trying to make it honest.
// ---------------------------------------------------------------------------

var TS = 32;              // tile size, px
var EMPTY = 0, SOLID = 1, ONEWAY = 2, HAZARD = 3, BREAK = 4;

// Scenery. None of it collides with anything — it exists so the level reads as
// a neighbourhood rather than as a tileset with a theme name attached. A tree
// TRUNK in particular must never be solid: a six-tile column standing on the
// street is a wall a hold-right player cannot get past.
var SC_HOUSE = 0, SC_FENCE = 1, SC_LAMP = 2, SC_MAILBOX = 3, SC_BARRIER = 4,
    SC_GARAGE = 5, SC_PIPE = 6, SC_GATES = 7, SC_BANDSTAND = 8, SC_BENCH = 9,
    SC_POND_SIGN = 10, SC_SHOP = 11, SC_BUS_STOP = 12, SC_DIGGER = 13,
    SC_DRAIN = 14, SC_CONTAINER = 15, SC_HUT = 16, SC_ROLLER = 17,
    SC_PIGEONHOLES = 18, SC_TRUCK_BAY = 19,
    // Evrtek, 2026-09-24: "more background houses. Stuff that works in the
    // current city scapes and a tile set that would make sense in our jungle
    // zone." A second house set for the city, and huts and ruins for the jungle.
    //
    // SC_HUT2 AND NOT SC_HUT, because SC_HUT is already taken: it is the depot's
    // gate hut, placed twice in level 1 (tiles 461 and 464) and drawn 30 x 40 in
    // the doorway. Handing that name to a 128 x 216 jungle hut would have put
    // two jungle huts in the depot doorway the day huts.png lands. The sheet
    // (huts.png) and the clip (prop.hut) are exactly as the art brief names them.
    SC_HOUSE2 = 20, SC_HUT2 = 21;

// The editor's words for the scenery kinds whose constant does not say it well
// enough. Sparse on purpose: a kind with no entry here is shown as its own name
// prettified (SC_POND_SIGN reads "Pond sign"), which is right for all the
// older ones. An array, so the loader's walk of SC_* skips it.
var SC_NAME = [];
SC_NAME[SC_HOUSE2] = 'House, set 2';
SC_NAME[SC_HUT2] = 'Hut / ruin';

var World = {
  w: 0, h: 0,            // in tiles
  px: 0, py: 0,          // in pixels
  t: null,               // Uint8Array
  spawn: { x: 0, y: 0 },
  foes: [],
  bins: [],
  decoys: [],           // garden gnomes that are only ever garden gnomes
  trees: [],
  scenery: [],
  sceneN: [],          // how many of each kind placed so far, for variant cycling
  items: [],
  drops: null,          // tile index -> the item inside it
  check: { tx: 0, ty: 0 },
  checks: [],           // every checkpoint, in placement order; `check` stays the first
  sections: [],         // [startTx, name] — the level describes itself, run.js reads this
  arena: null,          // { enterTx, gateTx, gateTop, gateBot, sealed }
  pickup: null,         // { tx, ty } — where the truck comes for him when there is no boss (see pickup())
  bhp: null,            // how much life each breakable tile has left
  plat: null,           // one entry per COLUMN: an OLD file's ledge style, read once (see worldLegacyLooks)
  mat: null,            // one entry per TILE: what a solid tile is made of (SURF_*) — ruling 42
  pstyle: null,         // one entry per TILE: what a one-way ledge is built of (PLAT_*) — ruling 42
  bstyle: null,         // one entry per TILE: what a breakable block is made of (BLOCK_*)
  labels: [],
  // WHICH FAR BACKGROUND this level wears — an id out of the one registry in
  // sprites.js (city, city2, jungle, mountains), set from the level file's
  // meta.background. It is art and nothing else: the physics has never seen it,
  // which is why it is one string here and not a layer.
  background: (typeof BG_FAR_DEFAULT === 'undefined') ? 'city' : BG_FAR_DEFAULT
};

function wIdx(tx, ty) { return ty * World.w + tx; }

function tileAt(tx, ty) {
  if (tx < 0 || tx >= World.w) return SOLID;   // the world is walled
  // THE TOP EDGE IS A CEILING, painted or not (Evrtek's ruling 42, 2026-09-26:
  // "could there not just be a top of the level and bottom of the level as an
  // impassible tile and everything inside the level is free to be placed as
  // chosen?"). It was open sky, which is why every level had to paint a roof
  // across its whole width before a wall-kicker could be kept in. Level 1
  // paints its roof rows, so nothing in it ever reached this line and nothing
  // in it plays differently.
  if (ty < 0) return SOLID;
  // THE BOTTOM EDGE STAYS OPEN (his answer "a"): a hole that reaches the last
  // row is a pit, and falling out of it still costs a life (player.js).
  if (ty >= World.h) return EMPTY;
  return World.t[wIdx(tx, ty)];
}

// A breakable block is solid until it is not. Collision must not care which.
function isBlocking(v) { return v === SOLID || v === BREAK; }

// Level state that is not terrain.
var Level = { time: 0, over: false, reason: '' };

// The clock. It does not run during the truck sequence — that is not his time
// to lose — and running out costs a life rather than ending the run outright.
function levelTick(dt) {
  if (Level.over || (typeof Stage !== 'undefined' && Stage.lock)) return;
  // Elapsed is accumulated here and nowhere else. It cannot be computed as
  // levelTime - Level.time, because running out of time sets the clock BACK to
  // full six lines below and leaves no trace — so a run that timed out twice
  // would report as the fastest of the day.
  if (typeof Tally !== 'undefined') Tally.elapsed += dt;
  Level.time -= dt;
  if (Level.time <= 0) {
    Level.time = 0;
    playerHurt(P.hpMax + 1, P.facing > 0 ? -1 : 1);
    Level.time = TUNE.levelTime;
  }
}

function levelReset() {
  Level.time = TUNE.levelTime;
  Level.over = false;
  Level.reason = '';
}

// --- Room construction helpers --------------------------------------------

function fill(x0, y0, x1, y1, v) {
  for (var y = y0; y < y1; y++) {
    if (y < 0 || y >= World.h) continue;
    for (var x = x0; x < x1; x++) {
      if (x < 0 || x >= World.w) continue;
      World.t[wIdx(x, y)] = v;
    }
  }
}

function ground(x0, x1, top) { fill(x0, top, x1, World.h, SOLID); }
function label(tx, ty, text) { World.labels.push({ x: tx * TS, y: ty * TS, text: text }); }
// `leash`, optional and in tiles, is a drone's own patch width when the
// level needs it narrower than TUNE.droneLeash: the pond drone's home is
// three tiles from the park's exit arch, and on the default ten-tile leash it
// hovered over the doorway and dived on everyone who walked through.
function foe(kind, tx, ty, face, carry, leash) {
  World.foes.push({ kind: kind, tx: tx, ty: ty, face: face || -1, carry: carry, leash: leash });
}
function dog(tx, ty, face) { foe(FOE_DOG, tx, ty, face); }
function bin(tx, ty) { World.bins.push({ tx: tx, ty: ty, lid: true }); }

// Six of these stand in the park among four live gnomes. They are the entire
// reason the gnome works: an ambusher that is the only statue on the lawn is
// not an ambusher, it is a signpost.
function decoy(tx, ty) { World.decoys.push({ tx: tx, ty: ty }); }
function tree(tx, ty) { World.trees.push({ tx: tx, ty: ty }); }
// `v` is which variant of its kind this piece is, and it is COUNTED rather than
// hashed. Hashing the tile position was the first attempt: it put two identical
// houses nine tiles apart, both on screen at once, and left one of the four
// designs unused entirely. Nine items over four designs is far too small a
// sample for a hash to spread evenly. Counting each kind as it is placed and
// letting the renderer cycle through the designs cannot do that — no two
// consecutive houses are ever the same, and nine come out 3/2/2/2.
function scene(tx, ty, kind) {
  kind = kind | 0;
  var n = (World.sceneN[kind] || 0);
  World.sceneN[kind] = n + 1;
  World.scenery.push({ tx: tx, ty: ty, kind: kind, v: n });
}

// A roof over the whole level. Without one a determined player wall-kicks up the
// side of a building and runs along the sky, and every section below is skipped.
function roof(x0, x1, row) { fill(x0, 0, x1, row + 1, SOLID); }

// --- What a tile is MADE OF ------------------------------------------------
//
// World.t stores five things — empty, solid, one-way, hazard, breakable —
// because that is everything the physics needs, and the physics still reads
// nothing else. The art needs more: a solid tile might be tarmac, a paving
// slab, a lawn, the earth under a road, a brick wall you wall-jump off, or the
// ceiling.
//
// EVERY BLOCK IS AN ITEM (Evrtek's ruling 42, 2026-09-26). His question: "why
// is it that the ground and ceiling need to be fixed tiles as either ground or
// brick, and only pavers sit on top of ground ... I also can't have some ground
// floating or bricks under ground." And then: "there's no reason for a solid —
// every block is simply an item that can be placed anywhere."
//
// Until 0.9.0 a level said only WHERE the solid was, and what it was made of
// was GUESSED at draw time: ceiling if it touched the top row, ground if it
// touched the bottom, brick otherwise; paving only on the top of the unbroken
// run from the bottom, one paving per COLUMN. That guess is why a street could
// not float, why brick could not sit under a street, and why a crate standing
// on a street turned the street to dirt. So now every solid tile carries its
// own material, per TILE (World.mat), and its look follows only that material
// and its neighbours — see tileClipFor in render.js. Nothing is decided by
// height or by what a tile is connected to any more.
//
// THE MATERIALS ARE SURF_*, all of them: the eleven pavings, and brick and the
// ceiling's cement, which used to be roles and are now simply two more things
// a block can be made of. Adding a name here is still the whole cost of a new
// one: js/levels.js reads SURF_* at run time so the name is legal in a level
// file, and js/editor/palette.js reads the same table and makes it a brush.
//
// History of the list: street to dirt were level 1's five. Cobble, planks and
// stone arrived 2026-09-23 ("let's also add some more tile assets to the editor
// for the ground or platforms"); moss, mud and sandstone 2026-09-24 ("a tile
// set that would make sense in our jungle zone" — tiles3.png). Brick and cement
// 2026-09-26, ruling 42, with no new art: they are tile.brick and tile.roof.
var SURF_STREET = 0, SURF_KERB = 1, SURF_PAVE = 2, SURF_GRASS = 3, SURF_DIRT = 4,
    SURF_COBBLE = 5, SURF_PLANKS = 6, SURF_STONE = 7,
    SURF_MOSS = 8, SURF_MUD = 9, SURF_SANDSTONE = 10,
    SURF_BRICK = 11, SURF_CEMENT = 12;

// The sidebar's word for a material whose constant does not say it, the way
// SC_NAME does it for scenery: SURF_PAVE is "Pavement" to a person, and "pave"
// stays the name a level file writes. Sparse, and an array so the loader's walk
// of SURF_* skips it.
var SURF_NAME = [];
SURF_NAME[SURF_PAVE] = 'Pavement';

// A LEVEL WRITTEN BEFORE 0.9.0 still says what it is paved with per COLUMN —
// the `surfaces` runs — and that is what this fills. It is read ONCE, by
// worldLegacyLooks() below, to work out each tile's material by the old rules;
// nothing draws from it. The code-built levels (buildSandbox, js/level1.js)
// still speak this way, which is why it stays a DSL call.
function surface(x0, x1, kind) {
  for (var x = Math.max(0, x0); x < Math.min(World.w, x1); x++) World.surf[x] = kind;
}

// PLATFORM STYLE: what a stand-through ledge is BUILT of. Per TILE since 0.9.0
// (World.pstyle) for the same reason as a material — two ledges in one column
// can be two different things. It was a run over columns, and a file written
// before 0.9.0 still says it that way (`platforms`), which fills World.plat and
// is read once by worldLegacyLooks(), exactly like `surfaces`.
//
// WOOD IS 0 AND IT IS TODAY'S PLANK. A level that says nothing about its
// ledges is wooden from end to end, which is every level written before
// 2026-09-23.
//
// Log, vine and scaffold arrived 2026-09-24 on tiles3.png: two for the jungle,
// one for a city with a building going up.
var PLAT_WOOD = 0, PLAT_GRATE = 1, PLAT_STONE = 2,
    PLAT_LOG = 3, PLAT_VINE = 4, PLAT_SCAFFOLD = 5;

function platform(x0, x1, kind) {
  for (var x = Math.max(0, x0); x < Math.min(World.w, x1); x++) World.plat[x] = kind;
}

// The 0.9.0 form, per tile, as the loader replays a file's runs: row `ty`,
// columns x0 to x1 (end excluded). Only a tile of the right KIND takes it — a
// material on a tile that is not solid, or a ledge style on one that is not a
// ledge, is a fact about nothing (the rule blockStyle() already keeps), and no
// writer could put it back in the file.
function materialRun(ty, x0, x1, kind) {
  if (!World.mat || ty < 0 || ty >= World.h) return;
  for (var x = Math.max(0, x0); x < Math.min(World.w, x1); x++)
    if (World.t[wIdx(x, ty)] === SOLID) World.mat[wIdx(x, ty)] = kind | 0;
}

function ledgeRun(ty, x0, x1, kind) {
  if (!World.pstyle || ty < 0 || ty >= World.h) return;
  for (var x = Math.max(0, x0); x < Math.min(World.w, x1); x++)
    if (World.t[wIdx(x, ty)] === ONEWAY) World.pstyle[wIdx(x, ty)] = kind | 0;
}

// BLOCK STYLE: what a breakable block is MADE of. Evrtek, 2026-09-24: "more
// breakable boxes." Art and nothing else — every style takes the same hits,
// holds the same drop and breaks the same way, because the physics has never
// looked at it.
//
// PER TILE, NOT A RUN. It was the first thing stored this way; since 0.9.0
// (ruling 42) ledge style and material are per tile as well. A block is a
// single placed thing, and a breakable WALL is a column of them. As a run over
// columns, painting one barrel would have restyled every crate above and below
// it, and nudging a block one tile sideways would have changed what it is made
// of. So it is stored the way a block's CONTENTS already are — per tile — and
// written the way `drops` is: a sparse list of the blocks that are not crates.
//
// CRATE IS 0 AND IT IS TODAY'S BLOCK. A level with no `blocks` list is crates
// from end to end, which is every level written before this existed.
var BLOCK_CRATE = 0, BLOCK_BARREL = 1, BLOCK_METAL = 2, BLOCK_BASKET = 3;

// Only a breakable can have a style: a style on a tile that is not a block is a
// fact about nothing, and no writer could put it back in the file.
function blockStyle(tx, ty, kind) {
  if (tx < 0 || tx >= World.w || ty < 0 || ty >= World.h) return;
  if (!World.bstyle || World.t[wIdx(tx, ty)] !== BREAK) return;
  World.bstyle[wIdx(tx, ty)] = kind | 0;
}

// ROLE is DERIVED, because it is a fact about the shape of the level rather
// than a decision. A solid tile connected to the top row is ceiling; one
// connected to the bottom row is ground; anything else is free-standing
// structure, which is what every wall-jump shaft and gate post here is.
//
// Flooded once at build time, not guessed per tile at draw time. Judging a wall
// by "is it narrow and tall" would be both expensive and wrong — the depot's
// loading dock is neither.
//
// SINCE 0.9.0 (ruling 42) ROLE AND groundTop DECIDE NOTHING YOU CAN SEE. They
// are still worked out, and they mean exactly what they always meant, but the
// only thing that reads them is worldLegacyLooks() — turning a file written
// before 0.9.0 into per-tile materials, once, at load. The renderer and the
// spawn search (levelSpawnAt) never look at either.
var ROLE_GROUND = 0, ROLE_ROOF = 1, ROLE_STRUCT = 2;

// `looksGiven`: the builder has already filled World.mat and World.pstyle from
// a 0.9.0 file, so there is nothing to work out. Every other caller — a file
// written before 0.9.0, buildSandbox, js/level1.js — says nothing, and gets its
// looks worked out by the old rules.
function worldClassify(looksGiven) {
  var n = World.w * World.h, i, x, y, p;
  World.role = new Uint8Array(n);
  for (i = 0; i < n; i++) World.role[i] = ROLE_STRUCT;
  var seen = new Uint8Array(n);

  // GROUND LEVEL, per column: the top of the unbroken run of solid tiles that
  // reaches the bottom of the world. Everything at or below it is earth and may
  // wear a surface; anything above it was BUILT and must be masonry.
  //
  // Evrtek's rule, and it is the right one: a paving slab or a lawn floating
  // three tiles up is not a paving slab, it is a mistake. The depot's loading
  // dock and every ledge in the level sit above their column's run, so they
  // come out as brick without anyone having to mark them.
  //
  // World.h means "no ground in this column" — a pit, or open sky.
  World.groundTop = new Uint16Array(World.w);
  for (x = 0; x < World.w; x++) {
    y = World.h - 1;
    if (World.t[wIdx(x, y)] !== SOLID) { World.groundTop[x] = World.h; continue; }
    while (y > 0 && World.t[wIdx(x, y - 1)] === SOLID) y--;
    World.groundTop[x] = y;
  }

  // BOTH FRONTS AT ONCE, and each tile takes whichever reaches it first.
  //
  // Running the two floods one after the other does not work, and the reason is
  // the boundary wall: this level is walled floor-to-ceiling down both sides, so
  // a flood that starts at the bottom row climbs the wall and comes out along
  // the entire ceiling. Every roof tile in the level classified as ground.
  //
  // Racing the fronts splits that wall somewhere up the middle, which is the
  // honest answer — the bottom of it is floor you stand on and the top of it is
  // ceiling you hit your head on, and there is no single correct row where one
  // becomes the other.
  var q = [], head = 0;
  for (x = 0; x < World.w; x++) {
    p = wIdx(x, 0);
    if (World.t[p] === SOLID) { World.role[p] = ROLE_ROOF; seen[p] = 1; q.push(p); }
    p = wIdx(x, World.h - 1);
    if (World.t[p] === SOLID && !seen[p]) { World.role[p] = ROLE_GROUND; seen[p] = 1; q.push(p); }
  }
  while (head < q.length) {
    p = q[head++];
    var role = World.role[p];
    y = (p / World.w) | 0; x = p - y * World.w;
    var nb = [x > 0 ? p - 1 : -1, x < World.w - 1 ? p + 1 : -1,
              y > 0 ? p - World.w : -1, y < World.h - 1 ? p + World.w : -1];
    for (i = 0; i < 4; i++) {
      var q2 = nb[i];
      if (q2 < 0 || seen[q2] || World.t[q2] !== SOLID) continue;
      seen[q2] = 1;
      World.role[q2] = role;
      q.push(q2);
    }
  }

  if (!looksGiven) worldLegacyLooks();
}

// THE OLD RULES, RUN ONCE. A level that does not say what each tile is made of
// — every file written before 0.9.0, and the two code-built rooms — gets it
// worked out here, from exactly what 0.8.6 drew, and from then on it is per
// tile like any other level. Each old role becomes the material whose new look
// is the old look:
//
//   ceiling (flooded from the top row)      -> cement: soffit over open air, brick above
//   free-standing (touches neither edge)    -> brick
//   ground, above its column's ground level -> brick   ("anything built above the ground is masonry")
//   ground, at or below it                  -> the column's paving: its face on top, earth below
//   a one-way ledge                         -> its column's platform style
//
// The ONE thing that comes out different is the fix he asked for: the old
// renderer showed paving only under EMPTY, so a crate, a ledge or spikes
// standing on a street turned the street to dirt. Now a material's top shows
// whenever the tile above is not solid. (The same rule turns the cement
// directly over a ledge, a block or spikes into soffit rather than brick.)
// tools/looks.js renders a level both ways and names every tile that moved.
//
// Buried ground gets the column's PAVING, not "dirt": covered, a paving shows
// earth, so it looks the same today — and the day an edit digs down to it, it
// is the street it was under that shows, which is what the old renderer showed
// in a sunken section too.
function worldLegacyLooks() {
  var n = World.w * World.h, x, y, p;
  World.mat = new Uint8Array(n);
  World.pstyle = new Uint8Array(n);
  for (y = 0; y < World.h; y++) {
    for (x = 0; x < World.w; x++) {
      p = wIdx(x, y);
      var v = World.t[p];
      if (v === ONEWAY) { World.pstyle[p] = World.plat ? World.plat[x] | 0 : PLAT_WOOD; continue; }
      if (v !== SOLID) continue;
      var role = World.role[p];
      if (role === ROLE_ROOF) World.mat[p] = SURF_CEMENT;
      else if (role === ROLE_STRUCT || y < World.groundTop[x]) World.mat[p] = SURF_BRICK;
      else World.mat[p] = World.surf ? World.surf[x] | 0 : SURF_STREET;
    }
  }
}

// The arena. The boss is inert until the player crosses enterTx; at that moment
// the gate column fills in behind them and he wakes up.
function arena(enterTx, gateTx, gateTop, gateBot) {
  World.arena = {
    enterTx: enterTx, gateTx: gateTx,
    gateTop: gateTop, gateBot: gateBot, sealed: false
  };
}

function arenaReset() {
  var a = World.arena;
  if (!a) return;
  a.sealed = false;
  for (var y = a.gateTop; y <= a.gateBot; y++) World.t[wIdx(a.gateTx, y)] = EMPTY;
}

// Reopened. The gate column empties, the Postmaster goes back to his mark and
// stands down — at the health and phase he had, not healed (his ruling
// 2026-09-22; see bossStandDown) — the dogs he called are gone, his mail is
// out of the air, and the level's own music comes back. The trigger is the
// player being OUTSIDE a sealed arena — which, the gate being solid, only a
// respawn can arrange. Evrtek, 2026-09-21: "when you die in the boss arena,
// you go back to a checkpoint and then the arena is closed and you can't get
// back in... the boss needs to move back to a position where he's not active
// until the player re-enters the arena."
function arenaReopen() {
  var a = World.arena;
  if (!a || !a.sealed) return;
  a.sealed = false;
  for (var y = a.gateTop; y <= a.gateBot; y++) {
    World.t[wIdx(a.gateTx, y)] = EMPTY;
    puff(a.gateTx * TS + TS * 0.5, y * TS + TS * 0.5, 0, -40, 2, PAL.rockTop);
  }
  for (var i = 0; i < Foes.n; i++) {
    var f = Foes.a[i];
    if (f.kind === FOE_BOSS && f.alive) bossStandDown(f); // on his mark, inert, wounds and phase kept
    else if (f.summoned) { f.alive = false; f.deadT = 0; }  // his dogs go with the fight
  }
  Shots.n = 0;
  musicPlay('level');
}

function arenaStep() {
  var a = World.arena;
  if (!a) return;
  // Sealed, and he is outside it: he died in there and came back to a flag.
  if (a.sealed) { if (P.x + P.w < a.gateTx * TS) arenaReopen(); return; }
  if (P.x + P.w * 0.5 < a.enterTx * TS) return;
  a.sealed = true;
  for (var y = a.gateTop; y <= a.gateBot; y++) {
    World.t[wIdx(a.gateTx, y)] = SOLID;
    // The gate is BRICK. It is the only tile in the game that turns solid while
    // you play, so nothing in the level file says what it is made of; before
    // 0.9.0 it came out brick because the flood had never reached it (an empty
    // tile at build time keeps ROLE_STRUCT), and this keeps it exactly that.
    if (World.mat) World.mat[wIdx(a.gateTx, y)] = SURF_BRICK;
    puff(a.gateTx * TS + TS * 0.5, y * TS + TS * 0.5, 0, -80, 4, PAL.rockTop);
  }
  for (var i = 0; i < Foes.n; i++) if (Foes.a[i].kind === FOE_BOSS) Foes.a[i].s1 = 1;
  // The loudest sound in the level is this door — and until 0.10.0 it made
  // none. The boss track opens with a hit on the same frame.
  sfx('gateSlam');
  musicPlay('boss');
}

// THE PICKUP. Evrtek, 2026-09-26, asking what ends a level with no boss in it —
// "does the mail truck just show up to pick you up?" — and then: "yes add the
// pickup marker". Until this, the Postmaster's death was the only thing that
// ever called stageFinish(), so a level built without a boss room could be
// played and never finished.
//
// It is the truck's pickup point, NOT an item: the six things he collects are
// "items" in the code and in the editor, and this is where the truck stops for
// him. One per level, like the spawn and the arena. What reaching it means,
// and the outro it starts, are in stage.js (stagePickupReached, stagePickup).
function pickup(tx, ty) { World.pickup = { tx: tx, ty: ty }; }

// THE BOSS ROOM WINS. A level with both is a level with a fight in it, and a
// pickup that still worked would be a way round the fight — walk past the
// door and the truck takes you home. So while the level has an arena the pickup
// is inert: it does not trigger and the game does not draw it. The editor warns
// about the pair on save and on Play.
function pickupLive() { return !!World.pickup && !World.arena; }

// Where the truck parks for it: the middle of the marker's column and the top
// of the ground it stands on (ty is the ground row, the way the spawn's and a
// checkpoint's are). The boss's ending anchors on the CARRIER instead; every
// number after the anchor — how far off the truck parks, where its door is —
// is the same TUNE for both, which is what makes it the same outro.
function pickupAnchor(pk) { return { x: pk.tx * TS + TS * 0.5, feet: pk.ty * TS }; }

function item(tx, ty, kind) { World.items.push({ tx: tx, ty: ty, kind: kind }); }
// A level may have several. World.check stays as the FIRST one, because the
// sandbox and everything in tools/check.js was written against exactly one.
function checkpoint(tx, ty) {
  if (!World.checks.length) { World.check.tx = tx; World.check.ty = ty; }
  World.checks.push({ tx: tx, ty: ty });
}

// Where a named stretch of the level begins. The level describes itself, so the
// bot's section splits cannot drift out of step with a rebuilt level — they
// were a hardcoded table in tools/run.js, which is fine until the level moves.
function section(tx, name) { World.sections.push([tx, name]); }

// A run of breakable blocks. 'drop' is what falls out of the LAST one broken in
// the run — or of a single block, which is the usual case.
function brick(x0, y0, x1, y1, dropKind) {
  for (var y = y0; y < y1; y++) {
    for (var x = x0; x < x1; x++) {
      if (x < 0 || x >= World.w || y < 0 || y >= World.h) continue;
      World.t[wIdx(x, y)] = BREAK;
      World.bhp[wIdx(x, y)] = Math.max(1, TUNE.blockHp | 0);
      if (dropKind !== undefined && dropKind !== null) World.drops[wIdx(x, y)] = dropKind;
    }
  }
}

// Returns true if the block was destroyed by this hit.
function blockHit(tx, ty, dmg) {
  if (tileAt(tx, ty) !== BREAK) return false;
  var i = wIdx(tx, ty);
  var left = World.bhp[i] - (dmg | 0);
  if (left > 0) {
    World.bhp[i] = left;
    sfx('blockHit', tx * TS + TS * 0.5, ty * TS + TS * 0.5);
    puff(tx * TS + TS * 0.5, ty * TS + TS * 0.5, 0, -60, 3, PAL.brickDust);
    return false;
  }
  World.t[i] = EMPTY;
  World.bhp[i] = 0;
  sfx('blockBreak', tx * TS + TS * 0.5, ty * TS + TS * 0.5);
  puff(tx * TS + TS * 0.5, ty * TS + TS * 0.5, 0, -120, 10, PAL.brickDust);
  P.score += TUNE.scoreBlock | 0;
  if (typeof Tally !== 'undefined') Tally.blocks++;
  var drop = World.drops[i];
  if (drop !== undefined) {
    // A SECRET is a block that had something in it, counted here because in one
    // more line the evidence is gone: the delete below is why the denominator
    // has to be snapshotted at build time rather than counted at the end.
    if (typeof Tally !== 'undefined') Tally.secrets++;
    itemSpawn(tx * TS + TS / 16, ty * TS + TS / 16, drop, true);
    delete World.drops[i];
  }
  return true;
}

// --- The sandbox room ------------------------------------------------------
// One room, laid out left to right as a list of things to go and feel. Nothing
// here is level design; it is a set of test rigs with the walls left visible.

function buildSandbox() {
  World.w = 192; World.h = 32;
  World.px = World.w * TS; World.py = World.h * TS;
  World.t = new Uint8Array(World.w * World.h);
  World.bhp = new Uint8Array(World.w * World.h);
  World.surf = new Uint8Array(World.w);   // what each COLUMN is paved with
  World.plat = new Uint8Array(World.w);   // and what its one-way ledges are built of
  World.bstyle = new Uint8Array(World.w * World.h);   // every block a crate
  World.role = null;                      // filled by worldClassify() once built
  World.mat = null; World.pstyle = null;  // and these by the old rules, from the two lines above
  World.labels.length = 0;
  World.foes.length = 0;
  World.bins.length = 0;
  World.decoys.length = 0;
  World.trees.length = 0;
  World.scenery.length = 0;
  World.sceneN.length = 0;
  World.items.length = 0;
  World.drops = Object.create(null);
  World.check.tx = 0; World.check.ty = 0;
  World.checks.length = 0; World.sections.length = 0;
  World.arena = null;
  World.pickup = null;                  // the sandbox ends at its boss, like level 1
  World.background = BG_FAR_DEFAULT;    // the sandbox is a test rig; it wears the default

  var G = 25;   // the floor everything returns to

  // Boundary walls, and a roof over the whole thing. Without the roof a
  // determined player wall-kicks up a building side and runs along the sky.
  fill(0, 0, 2, World.h, SOLID);
  fill(World.w - 2, 0, World.w, World.h, SOLID);
  roof(0, World.w, 3);

  // 1. Runway — acceleration, top speed, and the length of a skid.
  ground(2, 26, G);
  label(4, G - 2, 'RUN — accelerate, then let go and feel the skid');

  // 2. Gaps of increasing width. Bottomless: falling costs you a respawn.
  ground(29, 34, G);
  ground(38, 43, G);
  ground(48, 60, G);

  // The mailbox bot, and a drone above it holding something worth having.
  foe(FOE_BOX, 50, G, -1);
  label(48, G - 4, 'MAILBOX BOT — feed it, then hit the open mouth');
  foe(FOE_DRONE, 56, G - 7, -1, IT_EXPRESS);
  label(55, G - 10, 'DRONE — it is carrying the prize');
  label(27, G - 2, 'GAPS — 3, 4 and 5 tiles');

  // A dog in the open, facing the way you will arrive from.
  dog(20, G, -1);
  label(16, G - 4, 'DOG — it has to SEE you');

  // A wall of breakable blocks across the runway: three tiles tall, so it is
  // impassable standing or crouched and has to be broken through.
  brick(23, G - 3, 25, G);
  label(21, G - 5, 'BREAK THROUGH — 3 hits each');

  // One of everything, hovering at about chest height.
  item(8, G - 2, IT_PACKAGE);
  item(13, G - 2, IT_THICK);
  item(31, G - 2, IT_GUMMY);
  item(40, G - 2, IT_EXPRESS);
  item(51, G - 2, IT_RYE);
  item(56, G - 2, IT_BAG);

  // A floating block with something inside it.
  brick(35, G - 6, 36, G - 5, IT_PACKAGE);
  label(33, G - 8, 'SOMETHING INSIDE');

  // 3. Stairs to an upper ledge that simply stops. Run off the end of it.
  ground(60, 62, G - 1);
  ground(62, 64, G - 2);
  ground(64, 66, G - 3);
  fill(66, G - 4, 76, G - 3, SOLID);
  label(66, G - 6, 'COYOTE — run off the end and jump late');

  // The second one sits on the floor directly under that ledge. Stand on the
  // ledge and it cannot see you through it; step off the end and it can.
  dog(70, G, -1);
  label(63, G - 2, 'LINE OF SIGHT — the ledge hides you');

  // Ground carries on underneath the ledge.
  ground(60, 78, G);

  // Two gnomes. One of them is only ever a garden gnome.
  foe(FOE_GNOME, 68, G, 1);
  foe(FOE_GNOME, 72, G, 1);
  label(67, G - 7, 'GNOMES — one of these is not');

  // 4. Hazards. No enemies yet, so the spikes stand in for being hit.
  ground(78, 95, G);
  fill(82, G - 1, 84, G, HAZARD);
  fill(87, G - 1, 88, G, HAZARD);
  fill(91, G - 1, 93, G, HAZARD);
  label(78, G - 3, 'KNOCKBACK — touch one');

  // The checkpoint. Touch it and the flag goes up.
  checkpoint(76, G);
  label(72, G - 4, 'CHECKPOINT');

  // 5. Wall-jump shaft: two facing walls, four tiles apart, thirteen tall.
  var shaftL = 96, shaftR = 101, shaftTop = 12;
  ground(95, shaftL + 1, G);
  // Two tiles of clearance under each wall: with the wall jump switched off
  // these were dead ends, and both profiles have to be able to reach the end
  // of the room. Crouched or sliding gets you under; standing does not.
  fill(shaftL, shaftTop, shaftL + 1, G - 2, SOLID);
  // The right wall stops two tiles short of the left one, so the kick that
  // finally clears it carries you over the lip instead of into it.
  fill(shaftR, shaftTop + 2, shaftR + 1, G - 2, SOLID);
  ground(shaftL + 1, shaftR, G);          // shaft floor
  fill(shaftR, shaftTop, 112, shaftTop + 1, SOLID);   // the ledge you are climbing to
  label(96, shaftTop - 2, 'WALL JUMP — climb out');

  // A way back down, and on.
  ground(102, 112, G);

  // A trash panda and the bin it is going to rob.
  foe(FOE_PANDA, 103, G, 1);
  bin(107, G);
  label(102, G - 5, 'TRASH PANDA — get behind it');

  // A column of blocks the package opens faster than letters do.
  brick(108, G - 3, 109, G, IT_GUMMY);

  // 6. Floating platforms at air-jump heights, stepping back to the floor.
  fill(114, 20, 118, 21, SOLID);
  fill(120, 17, 124, 18, ONEWAY);
  fill(126, 14, 130, 15, SOLID);
  fill(120, 22, 124, 23, ONEWAY);
  ground(112, 132, G);
  label(114, 12, 'DOUBLE JUMP — the thin ones are stand-through');

  // 7. Low corridor — headroom for a standing carrier, tight enough to notice.
  fill(134, 0, 148, G - 4, SOLID);      // underside at y 672, floor at 800: 128 px
  ground(132, 150, G);
  label(133, G - 6, 'CEILING');

  // 8. Crouch tunnel — two tiles of headroom. He does not fit standing up, and
  //    he will not stand back up inside it either.
  fill(150, 0, 159, G - 2, SOLID);      // underside at y 736: 64 px of room
  ground(150, 162, G);
  label(150, G - 4, 'CROUCH — hold down');

  // 9. One lone wall with nothing to chain to. With the kick shortened to 300
  //    it can be climbed on its own, which is what he asked the number for.
  fill(165, 9, 166, G - 2, SOLID);
  ground(162, World.w, G);

  // The arena. The gate shuts behind you at tile 176 and he wakes up; before
  // that he is scenery, because plinking a boss through a doorway is not a fight.
  arena(176, 173, 4, G - 1);
  foe(FOE_BOSS, 180, G, -1);
  label(172, G - 12, 'THE POSTMASTER — three phases, ten hits each');
  label(159, G - 9, 'ONE WALL — climb it');

  // The sandbox is one street from end to end; it is a test rig, not a place.
  surface(0, World.w, SURF_STREET);
  worldClassify();

  World.spawn.x = 5 * TS;
  World.spawn.y = (G - 1) * TS;        // his FEET; playerSpawn sits his box on it
}

// --- Collision -------------------------------------------------------------

function blockedBox(x, y, w, h) {
  var x0 = Math.floor(x / TS), x1 = Math.floor((x + w - 0.001) / TS);
  var y0 = Math.floor(y / TS), y1 = Math.floor((y + h - 0.001) / TS);
  for (var ty = y0; ty <= y1; ty++)
    for (var tx = x0; tx <= x1; tx++)
      if (isBlocking(tileAt(tx, ty))) return true;
  return false;
}

function overlapsHazard(e) {
  var x0 = Math.floor(e.x / TS), x1 = Math.floor((e.x + e.w - 0.001) / TS);
  var y0 = Math.floor(e.y / TS), y1 = Math.floor((e.y + e.h - 0.001) / TS);
  for (var y = y0; y <= y1; y++)
    for (var x = x0; x <= x1; x++)
      if (tileAt(x, y) === HAZARD) return true;
  return false;
}

// Is there a blocking tile immediately to `dir` of the box? Used for walls.
function touchingWall(e, dir) {
  // Every offset here is a FRACTION OF A TILE, not a pixel count. Written as
  // raw pixels they survive a change of tile size silently — the probe still
  // finds the wall, but the top and bottom insets trim half as much of a body
  // that is twice as tall, so the test reaches further up and down a ledge than
  // it used to. Nothing errors. (For the record: this was NOT the cause of the
  // gate section slowing from 8.68 s to 10.67 s after the 2x up-res. Fixing it
  // changed that number by zero. It is correct on its own terms, not a cure.)
  var probe = dir > 0 ? e.x + e.w + TS / 16 : e.x - TS / 16;
  var tx = Math.floor(probe / TS);
  // Ignore the top and bottom edge so a floor or ceiling never reads as a wall.
  var y0 = Math.floor((e.y + TS / 8) / TS), y1 = Math.floor((e.y + e.h - TS * 3 / 16) / TS);
  for (var y = y0; y <= y1; y++) if (isBlocking(tileAt(tx, y))) return true;
  return false;
}

function moveX(e, dx) {
  e.x += dx;
  if (dx === 0) return 0;
  var y0 = Math.floor(e.y / TS), y1 = Math.floor((e.y + e.h - 0.001) / TS);
  var col, y;
  if (dx > 0) {
    col = Math.floor((e.x + e.w - 0.001) / TS);
    for (y = y0; y <= y1; y++) if (isBlocking(tileAt(col, y))) {
      e.x = col * TS - e.w; e.vx = 0; return 1;
    }
  } else {
    col = Math.floor(e.x / TS);
    for (y = y0; y <= y1; y++) if (isBlocking(tileAt(col, y))) {
      e.x = (col + 1) * TS; e.vx = 0; return -1;
    }
  }
  return 0;
}

function moveY(e, dy) {
  var wasBottom = e.y + e.h;
  e.y += dy;
  if (dy === 0) return 0;
  var x0 = Math.floor(e.x / TS), x1 = Math.floor((e.x + e.w - 0.001) / TS);
  var row, x, v;

  if (dy > 0) {
    row = Math.floor((e.y + e.h - 0.001) / TS);
    for (x = x0; x <= x1; x++) {
      v = tileAt(x, row);
      // A stand-through platform only exists if you were above it already.
      if (isBlocking(v) || (v === ONEWAY && !e.dropThrough && wasBottom <= row * TS + TS / 32)) {
        e.y = row * TS - e.h; e.vy = 0; return 1;
      }
    }
  } else {
    row = Math.floor(e.y / TS);
    for (x = x0; x <= x1; x++) if (isBlocking(tileAt(x, row))) {
      // Corner nudge: if only one edge is caught and it is caught by a sliver,
      // slide past it rather than killing the jump outright.
      var n = TUNE.cornerNudge | 0;
      if (n > 0) {
        var leftIn = (x0 + 1) * TS - e.x;            // overlap into the left tile
        var rightIn = e.x + e.w - x1 * TS;           // overlap into the right tile
        if (x === x0 && x0 !== x1 && leftIn <= n && !isBlocking(tileAt(x0 + 1, row))) {
          e.x = (x0 + 1) * TS; return 0;
        }
        if (x === x1 && x0 !== x1 && rightIn <= n && !isBlocking(tileAt(x1 - 1, row))) {
          e.x = x1 * TS - e.w; return 0;
        }
      }
      e.y = (row + 1) * TS; e.vy = 0; return -1;
    }
  }
  return 0;
}

// Sub-stepped so no slider setting can push the box through a tile in one tick.
function moveEntity(e, dx, dy) {
  var n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (TS * 0.5)));
  var sx = dx / n, sy = dy / n;
  var hitX = 0, hitY = 0;
  for (var i = 0; i < n; i++) {
    var hx = moveX(e, sx); if (hx) hitX = hx;
    var hy = moveY(e, sy); if (hy) hitY = hy;
  }
  e.hitX = hitX; e.hitY = hitY;
}
