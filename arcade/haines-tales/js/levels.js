'use strict';
// ---------------------------------------------------------------------------
// LEVELS ARE DATA.  (Evrtek's ruling 1 of 2026-09-22.)
//
// A level is a file — `levels/<id>.js` — holding one call to registerLevel()
// wrapped around pure JSON. The code DSL in world.js stays exactly where it
// was: this loader is a CALLER of it, not a replacement for it. Everything a
// level file can say is something `item()`, `foe()`, `scene()`, `brick()` and
// the rest already did, which is why a level built from a file and the same
// level built from code come out byte-identical (tools/level-equiv.js).
//
// One classic script per level rather than a .json, because `fetch` of a JSON
// file fails from a file:// URL and every Arcade cabinet has to run off disk.
// sprites.js already lives with this. One wrapper line around real JSON keeps
// it parseable as data by the editor and the tools, and diffable by a human.
//
// THE KIND NAMES ARE NOT TYPED IN HERE. They are read off the engine's own
// constants at run time — FOE_*, IT_*, SC_*, SURF_* — lower-cased with the
// prefix removed. Adding FOE_RACCOON to enemy.js makes "raccoon" a legal kind
// in a level file with no edit to this file and no chance of the two drifting
// apart. A hand-written table is a second source of truth, and a second source
// of truth about names is how a level silently loads the wrong enemy.
// ---------------------------------------------------------------------------

// Every registered document, by meta.id.
var LevelDocs = Object.create(null);

// What was built last, so a restart can rebuild the same thing. tally.js needs
// this: TRY AGAIN has to rebuild the WORLD, not just reset the entities, or the
// second run starts with every block already broken (see tallyRestart).
var LevelCur = { id: null, at: null, aty: null };

// The five things a tile can be, and the one character each is written as.
var LEVEL_TILE_CH = { 0: '.', 1: '#', 2: '-', 3: '^', 4: 'B' };
var LEVEL_CH_TILE = { '.': 0, '#': 1, '-': 2, '^': 3, 'B': 4 };

// The keys this version of the format understands. Anything else is ignored
// with a warning rather than a throw — the format is going to grow, and a level
// written by a later editor must still open in an earlier game.
var LEVEL_KEYS = ['meta', 'spawn', 'pickup', 'tiles', 'drops', 'foes', 'items', 'bins',
                  'decoys', 'trees', 'scenery', 'labels', 'checks', 'sections',
                  'surfaces', 'platforms', 'materials', 'ledges', 'blocks', 'arena'];

// --- the registries, generated from the engine ------------------------------
//
// `globalThis` is the script scope here: a classic script's top-level `var` is
// a property of the global object in a browser and of the vm box in the tools,
// so the same walk works in both. Built once, lazily, because enemy.js and
// items.js may load after this file does.

var LevelKinds = null;

function levelKindTable(prefix, valid) {
  var g = (typeof globalThis !== 'undefined') ? globalThis : this;
  var byName = Object.create(null), byVal = Object.create(null), names = [];
  var re = new RegExp('^' + prefix + '[A-Z][A-Z0-9_]*$');
  for (var k in g) {
    if (!re.test(k)) continue;
    var v = g[k];
    if (typeof v !== 'number' || v !== (v | 0) || v < 0) continue;   // FOE_NAME is an array; FOE_MAX is a count
    if (valid && !valid(v)) continue;
    var name = k.slice(prefix.length).toLowerCase();
    byName[name] = v; byVal[v] = name; names.push(name);
  }
  names.sort();
  return { byName: byName, byVal: byVal, names: names };
}

function levelKinds() {
  if (LevelKinds) return LevelKinds;
  LevelKinds = {
    // FOE_MAX is a pool size, not a kind. FOE_NAME is the engine's own list of
    // what a kind can be, so its length is the honest upper bound.
    foe: levelKindTable('FOE_', function (v) {
      return (typeof FOE_NAME === 'undefined') ? true : v < FOE_NAME.length;
    }),
    item: levelKindTable('IT_', function (v) {
      return (typeof ITEM_NAME === 'undefined') ? true : v < ITEM_NAME.length;
    }),
    scene: levelKindTable('SC_'),
    // What a solid tile is made of — the pavings, brick and cement (ruling 42).
    // Still named for SURF_*, because that is the constant the names come off.
    surf: levelKindTable('SURF_'),
    // What a one-way ledge is built of. Same walk, same bargain: adding
    // PLAT_ROPE to world.js makes "rope" legal in a level file and gives it its
    // own brush in the editor's Platforms group, with no edit here and none there.
    plat: levelKindTable('PLAT_'),
    // What a breakable block is made of (2026-09-24). BLOCK_JAR in world.js
    // would be legal in a level file and its own brush in the Blocks group,
    // with no edit here and none there.
    block: levelKindTable('BLOCK_')
  };
  return LevelKinds;
}

// Names in, numbers out — and a sentence in the console when a level names
// something this build of the game has never heard of.
function levelLookup(table, name, what, where) {
  if (name === undefined || name === null) return undefined;
  var v = table.byName[String(name).toLowerCase()];
  if (v === undefined) {
    if (typeof console !== 'undefined')
      console.warn('level: unknown ' + what + ' "' + name + '"' + (where ? ' at ' + where : '') +
                   ' — this build knows: ' + table.names.join(' '));
    return undefined;
  }
  return v;
}

// --- registration -----------------------------------------------------------

function registerLevel(doc) {
  if (!doc || !doc.meta || !doc.meta.id) {
    if (typeof console !== 'undefined') console.warn('registerLevel: a level needs meta.id; ignored.');
    return null;
  }
  for (var k in doc) {
    if (LEVEL_KEYS.indexOf(k) < 0 && typeof console !== 'undefined')
      console.warn('level "' + doc.meta.id + '": key "' + k + '" is not part of this build\'s format — ignored.');
  }
  LevelDocs[doc.meta.id] = doc;
  return doc.meta.id;
}

function levelDoc(id) { return LevelDocs[id] || null; }
function levelIds() { var a = []; for (var k in LevelDocs) a.push(k); a.sort(); return a; }

// --- building ---------------------------------------------------------------

// The list order in the file IS the placement order, and it is load-bearing:
// scenery variants cycle with World.sceneN, the first checkpoint becomes
// World.check, trees pick their shape by index, and Foes fills in order — which
// is what makes a bot run reproducible. The exporter preserves it; this replays
// it. Nothing below reorders anything.
function levelBuild(id, atTx, atTy) {
  var doc = LevelDocs[id];
  if (!doc) {
    if (typeof console !== 'undefined') console.error('levelBuild: no level registered as "' + id + '".');
    return false;
  }
  var K = levelKinds();
  var m = doc.meta || {};
  var i, o, n;

  World.w = m.w | 0; World.h = m.h | 0;
  World.px = World.w * TS; World.py = World.h * TS;
  World.t = new Uint8Array(World.w * World.h);
  World.bhp = new Uint8Array(World.w * World.h);
  World.surf = new Uint8Array(World.w);
  World.plat = new Uint8Array(World.w);   // PLAT_WOOD everywhere until a run says otherwise
  World.bstyle = new Uint8Array(World.w * World.h);   // BLOCK_CRATE everywhere until the list says otherwise
  World.role = null;                      // filled by worldClassify() at the end
  World.mat = null; World.pstyle = null;  // per tile: from the file's runs below, or worked out at the end
  World.labels.length = 0;
  World.foes.length = 0;
  World.items.length = 0;
  World.bins.length = 0;
  World.decoys.length = 0;
  World.trees.length = 0;
  World.scenery.length = 0;
  World.sceneN.length = 0;                // or a rebuild carries on counting and the street reshuffles
  World.drops = Object.create(null);
  World.check.tx = 0; World.check.ty = 0;
  World.checks.length = 0; World.sections.length = 0;
  World.arena = null;
  World.pickup = null;
  // WHICH FAR BACKGROUND. A level that names none wears the default, which is
  // what every level written before 2026-09-23 does — the field is additive and
  // an older file opens and plays unchanged. An id this build does not know is
  // kept here and warned about by bgFarClip() at draw time rather than being
  // quietly rewritten, so saving the level again does not lose it.
  World.background = (m.background === undefined || m.background === null || m.background === '')
    ? BG_FAR_DEFAULT : String(m.background);

  // What is sealed inside each breakable, keyed by tile, so the tile pass can
  // hand it straight to brick() — the same path the code DSL uses, so the block
  // gets its hit points from TUNE.blockHp exactly as it always did.
  var drops = doc.drops || [], dropAt = Object.create(null);
  for (i = 0; i < drops.length; i++) {
    o = drops[i];
    var dk = levelLookup(K.item, o.kind, 'item kind', 'drop ' + o.tx + ',' + o.ty);
    if (dk !== undefined) dropAt[o.ty * World.w + o.tx] = dk;
  }

  // The terrain: h strings of w characters, top row first.
  var rows = doc.tiles || [];
  if (rows.length !== World.h && typeof console !== 'undefined')
    console.warn('level "' + id + '": ' + rows.length + ' tile rows for a world ' + World.h + ' tall.');
  for (var ty = 0; ty < World.h; ty++) {
    var row = rows[ty] || '';
    if (row.length !== World.w && typeof console !== 'undefined' && ty === 0)
      console.warn('level "' + id + '": tile row ' + ty + ' is ' + row.length + ' chars for a world ' + World.w + ' wide.');
    for (var tx = 0; tx < World.w; tx++) {
      var v = LEVEL_CH_TILE[row.charAt(tx)];
      if (v === undefined) v = EMPTY;
      var p = ty * World.w + tx;
      if (v === BREAK) brick(tx, ty, tx + 1, ty + 1, dropAt[p]);
      else World.t[p] = v;
    }
  }

  // WHAT EACH TILE IS MADE OF (ruling 42, 0.9.0). Two ways a file can say it,
  // and the presence of `materials` is what tells them apart:
  //
  //   0.9.0 and later  `materials` + `ledges`: per TILE (the shape is below).
  //   before 0.9.0     `surfaces` + `platforms`: per COLUMN. Read into
  //                    World.surf / World.plat and turned into per-tile looks
  //                    ONCE by the old rules (worldLegacyLooks, world.js), in
  //                    worldClassify at the end of this function. That is what
  //                    lets level 1 open unchanged: nobody rewrote the file.
  //
  // THE STORED FORM: runs along a ROW. `{"ty":30,"x0":126,"x1":174,"kind":"street"}`
  // is row 30, columns 126 to 173, street — the shape `surfaces` already had,
  // with a row added. Chosen over a second grid of characters beside `tiles`
  // for three reasons. It is diffable by a person: painting one cobble into a
  // street is one line becoming three lines that each say what they are, where
  // a character grid changes one letter in a 510-character line nobody can
  // read. It needs no legend: the names are the engine's own (SURF_*, PLAT_*),
  // read off the constants like every other kind in this file, so a material
  // added to world.js is legal here with no table to extend and no letters to
  // run out of. And an unknown name fails ONE run, with a sentence, and that
  // run falls back to street or wood — the contract every other list here
  // keeps. The writer (js/editor/doc.js) makes a run the longest stretch of one
  // material over tiles of the right kind, in row order, so any one level has
  // exactly one spelling and a save with no edits is byte-identical.
  var looksGiven = Array.isArray(doc.materials);
  if (looksGiven) {
    World.mat = new Uint8Array(World.w * World.h);       // SURF_STREET until a run says otherwise
    World.pstyle = new Uint8Array(World.w * World.h);    // PLAT_WOOD likewise
    var mats = doc.materials;
    for (i = 0; i < mats.length; i++) {
      o = mats[i];
      var mk = levelLookup(K.surf, o.kind, 'material', 'row ' + o.ty + ', ' + o.x0 + '-' + o.x1);
      if (mk !== undefined) materialRun(o.ty | 0, o.x0 | 0, o.x1 | 0, mk);
    }
    var ledges = doc.ledges || [];
    for (i = 0; i < ledges.length; i++) {
      o = ledges[i];
      var lk = levelLookup(K.plat, o.kind, 'platform style', 'row ' + o.ty + ', ' + o.x0 + '-' + o.x1);
      if (lk !== undefined) ledgeRun(o.ty | 0, o.x0 | 0, o.x1 | 0, lk);
    }
    if ((doc.surfaces || doc.platforms) && typeof console !== 'undefined')
      console.warn('level "' + id + '": it says what each tile is made of, so its per-column ' +
                   '`surfaces` and `platforms` are ignored.');
  } else {
    // What each stretch is paved with, per column, the pre-0.9.0 way.
    var surfs = doc.surfaces || [];
    for (i = 0; i < surfs.length; i++) {
      o = surfs[i];
      var sk = levelLookup(K.surf, o.kind, 'surface', o.x0 + '-' + o.x1);
      if (sk !== undefined) surface(o.x0 | 0, o.x1 | 0, sk);
    }

    // And what its one-way ledges are built of. Runs, exactly like surfaces, and
    // absent means PLAT_WOOD end to end — which is every level written before
    // 2026-09-23 and is today's plank, so an older file loads unchanged.
    var plats = doc.platforms || [];
    for (i = 0; i < plats.length; i++) {
      o = plats[i];
      var pk = levelLookup(K.plat, o.kind, 'platform style', o.x0 + '-' + o.x1);
      if (pk !== undefined) platform(o.x0 | 0, o.x1 | 0, pk);
    }
  }

  // What each breakable is made of: per TILE, and only the ones that are not
  // crates — the same shape as `drops`. Absent means crates, which is every
  // level written before 2026-09-24, so an older file loads unchanged. After
  // the tile pass, because blockStyle() only styles a tile that IS a block.
  var blks = doc.blocks || [];
  for (i = 0; i < blks.length; i++) {
    o = blks[i];
    var bk = levelLookup(K.block, o.kind, 'block style', o.tx + ',' + o.ty);
    if (bk !== undefined) blockStyle(o.tx | 0, o.ty | 0, bk);
  }

  // The lists, in file order, through the DSL world.js already had.
  var items = doc.items || [];
  for (i = 0; i < items.length; i++) {
    o = items[i];
    var ik = levelLookup(K.item, o.kind, 'item kind', o.tx + ',' + o.ty);
    if (ik !== undefined) item(o.tx | 0, o.ty | 0, ik);
  }

  var foes = doc.foes || [];
  for (i = 0; i < foes.length; i++) {
    o = foes[i];
    var fk = levelLookup(K.foe, o.kind, 'enemy kind', o.tx + ',' + o.ty);
    if (fk === undefined) continue;
    // `undefined`, not null: foe() stores what it is handed, and "carries
    // nothing" has always been undefined in this engine. JSON cannot say
    // undefined, so null in the file means the same thing here.
    var carry = (o.carry === undefined || o.carry === null)
      ? undefined : levelLookup(K.item, o.carry, 'carried item', o.tx + ',' + o.ty);
    var leash = (o.leash === undefined || o.leash === null) ? undefined : o.leash;
    foe(fk, o.tx | 0, o.ty | 0, o.face, carry, leash);
  }

  var bins = doc.bins || [];
  for (i = 0; i < bins.length; i++) bin(bins[i].tx | 0, bins[i].ty | 0);

  var decoys = doc.decoys || [];
  for (i = 0; i < decoys.length; i++) decoy(decoys[i].tx | 0, decoys[i].ty | 0);

  var trees = doc.trees || [];
  for (i = 0; i < trees.length; i++) tree(trees[i].tx | 0, trees[i].ty | 0);

  var scen = doc.scenery || [];
  for (i = 0; i < scen.length; i++) {
    o = scen[i];
    var ck = levelLookup(K.scene, o.kind, 'scenery kind', o.tx + ',' + o.ty);
    if (ck !== undefined) scene(o.tx | 0, o.ty | 0, ck);
  }

  var labels = doc.labels || [];
  for (i = 0; i < labels.length; i++) label(labels[i].tx | 0, labels[i].ty | 0, labels[i].text);

  var checks = doc.checks || [];
  for (i = 0; i < checks.length; i++) checkpoint(checks[i].tx | 0, checks[i].ty | 0);

  var secs = doc.sections || [];
  for (i = 0; i < secs.length; i++) section(secs[i].tx | 0, secs[i].name);

  if (doc.arena) arena(doc.arena.enterTx | 0, doc.arena.gateTx | 0, doc.arena.gateTop | 0, doc.arena.gateBot | 0);

  // Where the truck comes for him when there is no boss (2026-09-26). Absent —
  // which is level 1 and every file written before today — means none: the
  // level ends at its boss, as it always did.
  if (doc.pickup) pickup(doc.pickup.tx | 0, doc.pickup.ty | 0);

  worldClassify(looksGiven);
  // The maxima, taken now because the level eats its own evidence: blockHit()
  // empties the tile and deletes the item sealed inside it, so counting the
  // secrets at the end counts the ones you MISSED.
  if (typeof tallySnapshot === 'function') tallySnapshot();

  var sp = doc.spawn || { tx: 0, ty: 0 };
  World.spawn.x = (sp.tx | 0) * TS;
  World.spawn.y = (sp.ty | 0) * TS;

  // The editor's Play button: start him at the cursor instead of at the door.
  // Only ever an override — the file's own spawn is what the game boots to.
  // `atTy`, the cursor's row, is optional (0.9.0); see levelSpawnAt.
  var hasAt = atTx !== undefined && atTx !== null && isFinite(atTx);
  var hasAtY = hasAt && atTy !== undefined && atTy !== null && isFinite(atTy);
  if (hasAt) levelSpawnAt(atTx | 0, hasAtY ? (atTy | 0) : undefined);

  LevelCur.id = id;
  LevelCur.at = hasAt ? (atTx | 0) : null;
  LevelCur.aty = hasAtY ? (atTy | 0) : null;
  return true;
}

// Put him down, standing, as near the marker as there is somewhere to stand.
//
// SOMEWHERE TO STAND is any tile with a walkable top — solid, a breakable
// block, or a one-way ledge — with room above it for his head. Until 0.9.0 it
// was only the top of the unbroken run of solid from the bottom of the world
// (World.groundTop), which is ruling 42's complaint again from a different
// side: a floating street was nowhere to stand. It needs no ground under it now.
//
// NEAREST THE MARKER. The editor's Play gives the cursor's column AND row, and
// the nearest place to stand to that point wins — so Play with the cursor by a
// street hanging in the air starts him on it. A caller that gives only the
// column (every ?at= written before 0.9.0) gets the nearest COLUMN with
// somewhere to stand, and the LOWEST place to stand in it — which, in any
// column with ground in it, is the top of that ground, the row 0.8.6 used.
// Either way a tie goes to the left, as it always did.
//
// The level's own spawn and its checkpoints never come through here: they are
// where the file puts them, tile for tile, exactly as before.
function levelSpawnAt(tx, ty) {
  var byRow = !(ty === undefined || ty === null);
  var best = -1, bestY = -1, bestD = 1e18;
  for (var x = Math.max(0, tx - 24); x < Math.min(World.w, tx + 25); x++) {
    for (var y = 2; y < World.h; y++) {
      var v = World.t[wIdx(x, y)];
      if (!isBlocking(v) && v !== ONEWAY) continue;
      if (tileAt(x, y - 1) !== EMPTY || tileAt(x, y - 2) !== EMPTY) continue;   // he is two and a half tiles tall
      var dx = x - tx, dy = byRow ? y - ty : 0;
      // A strict order, so the answer never depends on which way the loop
      // runs: the distance (squared, with a row; the columns alone, without),
      // then the nearer column, then the left of two (0.8.6's tie), then the
      // lower of two places in one column. Each weight is larger than
      // everything after it can add up to: a level is at most 256 tall and
      // the search 24 columns each way.
      var d = (byRow ? (dx * dx + dy * dy) * 1048576 : 0) + Math.abs(dx) * 1024 + (dx > 0 ? 512 : 0) + (World.h - y);
      if (d < bestD) { bestD = d; best = x; bestY = y; }
    }
  }
  if (best < 0) {
    if (typeof console !== 'undefined') console.warn('level: nowhere to stand near tile ' + tx + '; keeping the level\'s own spawn.');
    return false;
  }
  World.spawn.x = best * TS;
  World.spawn.y = bestY * TS;
  return true;
}

// Build the same thing again, from scratch. TRY AGAIN needs the WORLD back, not
// just the entities: blockHit() empties a broken tile and deletes the item
// sealed in it, so a restart that only resets entities starts with every block
// already broken and every secret gone.
function levelRebuild() {
  if (LevelCur.id && LevelDocs[LevelCur.id]) return levelBuild(LevelCur.id, LevelCur.at, LevelCur.aty);
  if (typeof buildSandbox === 'function') { buildSandbox(); return true; }
  return false;
}
