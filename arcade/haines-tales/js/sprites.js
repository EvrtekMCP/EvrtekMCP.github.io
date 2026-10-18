'use strict';
// ---------------------------------------------------------------------------
// Sprites.
//
// Everything in this game is currently drawn out of coloured rectangles. That
// was right for settling the feel and it is wrong for shipping: Evrtek's note
// is that the fidelity has to come "waaay up" so an item is identifiable as the
// thing it is. Rectangles cannot do that; painted pixels can.
//
// So this file is the seam. Every entity's draw call becomes:
//
//     if (sprHas(clip)) sprDraw(...)        <- the real art, once it exists
//     else <the rectangles we already have> <- until then, and if it fails to load
//
// Nothing blocks on art. The game runs identically with an empty art folder,
// which means Yori's sheets can arrive one at a time and each one improves the
// game the moment it lands, with no code change and no rebuild.
//
// THE MANIFEST AT THE BOTTOM IS THE BRIEF. It is the single source of truth for
// what art this game needs: tools/manifest.js turns it into the document Yori
// works from, so the list she is given and the list the code looks for cannot
// drift apart.
// ---------------------------------------------------------------------------

var SPR = {
  dir: 'art/',
  sheets: Object.create(null),   // file name -> { img, state: 0 pending 1 ok 2 failed }
  clips: Object.create(null),    // clip name -> definition
  loaded: 0, failed: 0, wanted: 0,
  off: false, probed: false
};

// EMBEDDED ART. A bundled build (tools/bundle.js) defines ART_INLINE before this
// file: { 'carrier.png': { png: 'data:image/png;base64,...', json: {...}|null } }.
// The probe and every sheet then read from it and not one request leaves the
// page. Built for the review build on the artifact host, 2026-09-21, where the
// page's <script src> references were resolved for us but a URL built here at
// run time — SPR.dir + file — resolved against the page's own address and
// found nothing, so every sheet fell back to its procedural stand-in.
function sprInline(file) {
  return (typeof ART_INLINE !== 'undefined' && ART_INLINE && ART_INLINE[file]) || null;
}

// The companion JSON, applied to a sheet: which clips are painted, and where
// the rows of a mixed-height sheet actually sit.
function sprApplyJson(s, j) {
  if (!j || !j.clips || !j.clips.length) return;
  var m = {};
  for (var i = 0; i < j.clips.length; i++) m[j.clips[i]] = 1;
  s.only = m;
  // A sheet whose rows are NOT all the same height carries each clip's own
  // cell and y offset, because row-times-height cannot find a row on it. That is
  // every props sheet: a bin, three gnomes and a tree share a file and
  // nothing else. The manifest keeps declaring the cell; the JSON says
  // where on the sheet it actually is.
  if (j.cells) for (var k = 0; k < j.cells.length; k++) {
    var cc = j.cells[k], clip = SPR.clips[cc.clip];
    if (clip) { clip.x = cc.x | 0; clip.y = cc.y | 0; clip.row = 0; }
  }
}

// ONE request decides whether any art exists at all. art/art.png is a sentinel:
// if it is not there, the whole system switches off and never asks for another
// sheet, so a game with no art folder makes exactly one failed request instead
// of one per sheet. The instant Yori drops the folder in, everything wakes up.
function sprProbe() {
  if (SPR.probed) return;
  SPR.probed = true;
  if (typeof ART_INLINE !== 'undefined' && ART_INLINE) return;     // bundled: the art is here
  if (typeof Image === 'undefined') { SPR.off = true; return; }
  var probe = new Image();
  probe.onerror = function () { SPR.off = true; };
  probe.src = SPR.dir + 'art.png';
}

// A sheet is one PNG. Sheets load lazily and in the background; a sheet that is
// missing or broken simply never becomes ready, and every clip on it stays on
// the placeholder path forever. That is a feature — it is what lets the game
// ship before the art does.
function sprSheet(file) {
  if (SPR.off) return null;
  var s = SPR.sheets[file];
  if (s) return s;
  s = { img: null, state: 0, only: null };
  SPR.sheets[file] = s;
  SPR.wanted++;
  // A sheet may carry a companion list of the clips actually PAINTED on it.
  // Art arrives over nine prompts and several days, so a sheet is normally part
  // empty — and an empty cell drawn faithfully is an invisible character. With
  // the list, a clip that is not on it fails exactly the way a missing sheet
  // does and the engine falls back to its procedural body. It is the seam this
  // game already had, moved from per-sheet down to per-clip.
  // No list means every clip is painted, which is the finished state.
  var inl = sprInline(file);
  // Bundled, and not in the bundle: the bundle IS the art folder, so this sheet
  // was never painted. Fail it here and make no request for it.
  if (!inl && typeof ART_INLINE !== 'undefined' && ART_INLINE) { s.state = 2; SPR.failed++; return s; }
  if (inl) sprApplyJson(s, inl.json);
  else if (typeof fetch === 'function') {
    fetch(SPR.dir + file.replace(/\.png$/, '.json'))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { sprApplyJson(s, j); })
      .catch(function () {});
  }
  if (typeof Image === 'undefined') { s.state = 2; SPR.failed++; return s; }
  var img = new Image();
  img.onload = function () {
    // A zero-sized decode is a broken file wearing a success event.
    if (!img.naturalWidth) { s.state = 2; SPR.failed++; return; }
    s.img = img; s.state = 1; SPR.loaded++;
  };
  img.onerror = function () { s.state = 2; SPR.failed++; };
  img.src = inl ? inl.png : SPR.dir + file;
  return s;
}

// EVERY SHEET, ASKED FOR AT ONCE (2026-09-27). Lazy is right for the idea of a
// sheet that may not be painted yet, and wrong for WHEN it is asked for. A sheet
// first asked for in the middle of a level arrives a few frames late, and for
// those frames its clips take their fallback. For a crate the fallback is
// tile.break, a DIFFERENT painted crate, so level 1's crates swapped art the
// first time one came into view. The editor never showed it, because building
// its sidebar icons asks for every clip, so the two pages drew level 1's 18
// crates differently (Tron, 0.9.0 verify, note 7). The title card and the editor
// both call this at start: the wait happens on the card, and both pages hold
// the same art before they draw a level.
//
// The list is read off the clip table, never typed. The title used to name six
// sheets by hand, and every sheet added after it (blocks, tiles2, tiles3, the
// far skylines, the house and hut sets) quietly went lazy.
function sprWarmAll() {
  if (SPR.off) return 0;
  var n = 0;
  for (var k in SPR.clips) {
    var f = SPR.clips[k].file;
    if (f && !SPR.sheets[f]) { sprSheet(f); n++; }
  }
  return n;
}

// True once every sheet that has been asked for has resolved: painted, or
// failed for good. A failed sheet counts as resolved; it is never coming.
function sprSettled() {
  if (SPR.off) return true;
  for (var f in SPR.sheets) if (SPR.sheets[f].state === 0) return false;
  return true;
}

// A clip is one animation: a horizontal strip of `frames` cells, `w` x `h` each,
// starting at (x, y) on its sheet. ox/oy are where the entity's ORIGIN sits
// inside a cell — for a character that is the middle of the feet, so a 40 px
// carrier and a 64 px carrier both stand on the same floor.
function sprClip(name, spec) {
  var c = {
    file: spec.file,
    x: spec.x | 0, y: spec.y | 0,
    w: spec.w | 0, h: spec.h | 0,
    frames: Math.max(1, spec.frames | 0),
    fps: spec.fps || 12,
    loop: spec.loop === undefined ? true : !!spec.loop,
    ox: spec.ox === undefined ? (spec.w | 0) * 0.5 : spec.ox,
    oy: spec.oy === undefined ? (spec.h | 0) : spec.oy,
    row: spec.row || 0
  };
  SPR.clips[name] = c;
  return c;   // declaring a clip does not fetch anything
}

function sprHas(name) {
  if (SPR.off) return false;
  var c = SPR.clips[name];
  if (!c) return false;
  var s = SPR.sheets[c.file] || sprSheet(c.file);   // lazy: asked for, so fetch it
  if (!s || s.state !== 1) return false;
  return !s.only || !!s.only[name];                // painted yet? see sprSheet
}

// Draw clip `name`, frame `f`, with its origin at (dx, dy) in BACKBUFFER pixels.
// `flip` mirrors horizontally about the origin, which is why the origin is the
// middle of the feet and not a corner.
function sprDraw(ctx, name, f, dx, dy, flip) {
  if (SPR.off) return false;
  var c = SPR.clips[name];
  if (!c) return false;
  // Lazy fetch here too, not only in sprHas: the carrier and every enemy reach
  // this function through sprDrawAnim and never touch sprHas, so without this
  // their sheets are never requested and the art silently never appears.
  var s = SPR.sheets[c.file] || sprSheet(c.file);
  if (!s || s.state !== 1) return false;
  // Not painted on this sheet yet: fail like a missing sheet so the caller
  // draws its procedural body instead of a cell of nothing.
  if (s.only && !s.only[name]) return false;
  var i = c.frames <= 1 ? 0 : ((f | 0) % c.frames + c.frames) % c.frames;
  var sx = c.x + i * c.w, sy = c.y + c.row * c.h;
  var px = Math.round(dx - (flip ? c.w - c.ox : c.ox));
  var py = Math.round(dy - c.oy);
  if (flip) {
    ctx.save();
    ctx.translate(px + c.w, py);
    ctx.scale(-1, 1);
    ctx.drawImage(s.img, sx, sy, c.w, c.h, 0, 0, c.w, c.h);
    ctx.restore();
  } else {
    ctx.drawImage(s.img, sx, sy, c.w, c.h, px, py, c.w, c.h);
  }
  return true;
}

// --- Animation state -------------------------------------------------------
// Entities own one of these. It is a plain object with no allocation per frame.

function animMake() { return { clip: '', t: 0, frame: 0, done: false }; }

function animPlay(a, clip, restart) {
  if (a.clip === clip && !restart) return;
  a.clip = clip; a.t = 0; a.frame = 0; a.done = false;
}

function animStep(a, dt) {
  var c = SPR.clips[a.clip];
  if (!c) return;
  a.t += dt;
  var adv = a.t * c.fps;
  if (c.loop) {
    a.frame = Math.floor(adv) % c.frames;
  } else {
    a.frame = Math.min(c.frames - 1, Math.floor(adv));
    if (a.frame >= c.frames - 1) a.done = true;
  }
}

// Convenience: draw an entity's current animation, or report false so the
// caller falls back to its rectangles.
function sprDrawAnim(ctx, a, dx, dy, flip) {
  return a && a.clip ? sprDraw(ctx, a.clip, a.frame, dx, dy, flip) : false;
}

// ---------------------------------------------------------------------------
// THE MANIFEST
//
// One entry per clip the game will ask for. `frames` and `fps` are what the
// code will play; `w`/`h` are the cell size Yori draws to. `note` is the brief
// for that clip and ends up verbatim in her document.
//
// Sizes follow from the world: 16 px tiles, a 14 x 40 carrier. Cells are drawn
// LARGER than the hitbox so art can overhang it — a cap brim, a swinging bag, a
// dog's tail — without changing what the physics thinks the thing is.
// ---------------------------------------------------------------------------

var SPRITE_MANIFEST = [
  // --- the carrier ---------------------------------------------------------
  { sheet: 'carrier.png', clip: 'carrier.idle', w: 96, h: 112, frames: 4, fps: 6, row: 0,
    note: 'Standing, breathing, bag settling. He should look like he is between deliveries, not at attention.' },
  { sheet: 'carrier.png', clip: 'carrier.walk', w: 96, h: 112, frames: 8, fps: 12, row: 1,
    note: 'A purposeful walk with the bag swinging on the off-beat.' },
  { sheet: 'carrier.png', clip: 'carrier.run', w: 96, h: 112, frames: 8, fps: 16, row: 2,
    note: 'Full sprint, forward lean, cap brim taking the wind. This is the frame set the player sees most.' },
  { sheet: 'carrier.png', clip: 'carrier.jump', w: 96, h: 112, frames: 3, fps: 12, loop: false, row: 3,
    note: 'Crouch, push, tuck. Frame 3 holds for the whole rise.' },
  { sheet: 'carrier.png', clip: 'carrier.doubleJump', w: 96, h: 112, frames: 4, fps: 16, loop: false, row: 4,
    note: 'A mid-air twist or a kick off nothing. Must read clearly as the SECOND jump and not the first.' },
  { sheet: 'carrier.png', clip: 'carrier.fall', w: 96, h: 112, frames: 2, fps: 8, row: 5,
    note: 'Arms out, legs reaching for the ground.' },
  { sheet: 'carrier.png', clip: 'carrier.land', w: 96, h: 112, frames: 3, fps: 18, loop: false, row: 6,
    note: 'Absorb and recover. Brief — it must never feel like a stumble.' },
  { sheet: 'carrier.png', clip: 'carrier.throw', w: 96, h: 112, frames: 4, fps: 18, loop: false, row: 7,
    note: 'Flat throw from the shoulder. The letter leaves on frame 2.' },
  { sheet: 'carrier.png', clip: 'carrier.throwUp', w: 96, h: 112, frames: 4, fps: 18, loop: false, row: 8,
    note: 'The same throw aimed up at 45 and straight up. The engine picks this for any upward aim.' },
  { sheet: 'carrier.png', clip: 'carrier.throwDown', w: 96, h: 112, frames: 4, fps: 18, loop: false, row: 9,
    note: 'Aimed down at 45. Used airborne, so the legs are off the ground.' },
  { sheet: 'carrier.png', clip: 'carrier.crouch', w: 96, h: 112, frames: 2, fps: 8, row: 10,
    note: 'Down on one knee, head tucked. The hitbox is 24 px tall here so the art must not stand taller.' },
  { sheet: 'carrier.png', clip: 'carrier.crawl', w: 96, h: 112, frames: 6, fps: 12, row: 11,
    note: 'Crawling forward at crouch height, bag dragging.' },
  { sheet: 'carrier.png', clip: 'carrier.wallSlide', w: 96, h: 112, frames: 2, fps: 8, row: 12,
    note: 'Pressed to a wall, one hand braced, boots scraping.' },
  { sheet: 'carrier.png', clip: 'carrier.wallKick', w: 96, h: 112, frames: 3, fps: 20, loop: false, row: 13,
    note: 'The push off. Needs to read as explosive in three frames.' },
  { sheet: 'carrier.png', clip: 'carrier.hurt', w: 96, h: 112, frames: 3, fps: 14, loop: false, row: 14,
    note: 'Knocked back, mail scattering. Plays during the control lockout.' },
  { sheet: 'carrier.png', clip: 'carrier.drink', w: 96, h: 112, frames: 6, fps: 10, loop: false, row: 15,
    note: 'The rye and ginger. Five seconds of invincibility starts here, so it should look like a decision.' },
  { sheet: 'carrier.png', clip: 'carrier.die', w: 96, h: 112, frames: 6, fps: 10, loop: false, row: 16,
    note: 'Down, hat off, letters everywhere. Slapstick, never gore.' },
  { sheet: 'carrier.png', clip: 'carrier.victory', w: 96, h: 112, frames: 6, fps: 8, loop: false, row: 17,
    note: 'Plays when the truck arrives. A fist up, or a tip of the cap.' },
  { sheet: 'carrier.png', clip: 'carrier.exitTruck', w: 96, h: 112, frames: 6, fps: 12, loop: false, row: 18,
    note: 'Hopping down out of the truck door at the start of a stage.' },

  // --- the dog -------------------------------------------------------------
  { sheet: 'dog.png', clip: 'dog.idle', w: 80, h: 56, frames: 4, fps: 6, row: 0,
    note: 'Sitting, alert, ears twitching. It has not seen you yet.' },
  { sheet: 'dog.png', clip: 'dog.coil', w: 80, h: 56, frames: 3, fps: 16, loop: false, row: 1,
    note: 'The crouch before a leap. This is the tell the player reads.' },
  { sheet: 'dog.png', clip: 'dog.leap', w: 80, h: 56, frames: 2, fps: 10, row: 2,
    note: 'Stretched out mid-air, all four legs extended.' },
  { sheet: 'dog.png', clip: 'dog.land', w: 80, h: 56, frames: 2, fps: 18, loop: false, row: 3,
    note: 'Absorbing the landing, ready to go again.' },
  { sheet: 'dog.png', clip: 'dog.hurt', w: 80, h: 56, frames: 2, fps: 16, loop: false, row: 4, note: 'Yelp and recoil.' },
  { sheet: 'dog.png', clip: 'dog.die', w: 80, h: 56, frames: 4, fps: 12, loop: false, row: 5,
    note: 'Tumbles over, legs up, dazed. It is a cartoon, not a corpse.' },

  // --- the mailbox bot -----------------------------------------------------
  { sheet: 'boxbot.png', clip: 'boxbot.idle', w: 64, h: 88, frames: 4, fps: 6, row: 0,
    note: 'A mailbox on two legs. Shut, smug, flag up. This is the state where it is immune.' },
  { sheet: 'boxbot.png', clip: 'boxbot.walk', w: 64, h: 88, frames: 6, fps: 10, row: 1,
    note: 'A heavy, waddling walk. Slow enough that it reads as inevitable rather than fast.' },
  { sheet: 'boxbot.png', clip: 'boxbot.eat', w: 64, h: 88, frames: 3, fps: 18, loop: false, row: 2,
    note: 'The slot snaps open and swallows a letter. This is the moment the player caused.' },
  { sheet: 'boxbot.png', clip: 'boxbot.chew', w: 64, h: 88, frames: 4, fps: 8, row: 3,
    note: 'Mouth OPEN and working, letter visible inside. The only window where it can be hurt, so the open mouth must be unmistakable from across a screen.' },
  { sheet: 'boxbot.png', clip: 'boxbot.spit', w: 64, h: 88, frames: 3, fps: 20, loop: false, row: 4,
    note: 'Fires the letter back. Recoil, mouth still open.' },
  { sheet: 'boxbot.png', clip: 'boxbot.hurt', w: 64, h: 88, frames: 2, fps: 16, loop: false, row: 5, note: 'Dented.' },
  { sheet: 'boxbot.png', clip: 'boxbot.die', w: 64, h: 88, frames: 5, fps: 12, loop: false, row: 6,
    note: 'Legs buckle, door swings open, letters spill out.' },

  // --- the drone -----------------------------------------------------------
  { sheet: 'drone.png', clip: 'drone.hover', w: 64, h: 48, frames: 4, fps: 16, row: 0,
    note: 'Rotors blurred, holding station, parcel swinging under it.' },
  { sheet: 'drone.png', clip: 'drone.lock', w: 64, h: 48, frames: 3, fps: 14, loop: false, row: 1,
    note: 'It has chosen a spot. A tilt and a light change — the player must get a beat of warning.' },
  { sheet: 'drone.png', clip: 'drone.dive', w: 64, h: 48, frames: 2, fps: 18, row: 2,
    note: 'Nose down, rotors swept, committed.' },
  { sheet: 'drone.png', clip: 'drone.climb', w: 64, h: 48, frames: 3, fps: 12, row: 3, note: 'Labouring back up to altitude.' },
  { sheet: 'drone.png', clip: 'drone.hurt', w: 64, h: 48, frames: 2, fps: 16, loop: false, row: 4, note: 'Sparks, one rotor stutters.' },
  { sheet: 'drone.png', clip: 'drone.die', w: 64, h: 48, frames: 5, fps: 14, loop: false, row: 5,
    note: 'Spins down and drops the parcel. The parcel must clearly SEPARATE — it is the reward.' },

  // --- the gnome -----------------------------------------------------------
  { sheet: 'gnome.png', clip: 'gnome.statue', w: 48, h: 64, frames: 1, fps: 1, row: 0,
    note: 'THE MOST IMPORTANT FRAME IN THE GAME. It must be indistinguishable from harmless garden scenery — same palette and same finish as the real ornaments placed around it. If a player can tell this one is alive, the enemy does not work.' },
  { sheet: 'gnome.png', clip: 'gnome.wake', w: 48, h: 64, frames: 4, fps: 14, loop: false, row: 1,
    note: 'Cracks, a shudder, the eyes come on. About a third of a second of warning — the ambush should be funny, not unfair.' },
  { sheet: 'gnome.png', clip: 'gnome.walk', w: 48, h: 64, frames: 6, fps: 12, row: 2,
    note: 'A stiff, ceramic stomp. Still obviously made of the same stuff it was pretending to be.' },
  { sheet: 'gnome.png', clip: 'gnome.hop', w: 48, h: 64, frames: 3, fps: 14, loop: false, row: 3, note: 'A little hop over a kerb.' },
  { sheet: 'gnome.png', clip: 'gnome.hurt', w: 48, h: 64, frames: 2, fps: 16, loop: false, row: 4, note: 'A chip comes off.' },
  { sheet: 'gnome.png', clip: 'gnome.die', w: 48, h: 64, frames: 4, fps: 14, loop: false, row: 5,
    note: 'Shatters into ceramic shards. The most satisfying death in the level.' },

  // --- the trash panda -----------------------------------------------------
  { sheet: 'panda.png', clip: 'panda.walk', w: 72, h: 56, frames: 6, fps: 12, row: 0,
    note: 'Scurrying, low, tail up. This is it heading for a bin.' },
  { sheet: 'panda.png', clip: 'panda.grab', w: 72, h: 56, frames: 4, fps: 12, loop: false, row: 1,
    note: 'Up on hind legs, wrenching the lid off a wheelie bin.' },
  { sheet: 'panda.png', clip: 'panda.patrol', w: 72, h: 56, frames: 6, fps: 11, row: 2,
    note: 'Walking with the lid held out in front like a riot shield. The lid must clearly cover the FRONT and nothing else, because that is the whole enemy.' },
  { sheet: 'panda.png', clip: 'panda.lunge', w: 72, h: 56, frames: 4, fps: 20, loop: false, row: 3,
    note: 'A shield bash. Weight forward, lid leading.' },
  { sheet: 'panda.png', clip: 'panda.lidHit', w: 72, h: 56, frames: 2, fps: 18, loop: false, row: 4,
    note: 'Something bounced off the lid. Sparks or a dent — the player must know the hit did NOT count.' },
  { sheet: 'panda.png', clip: 'panda.hurt', w: 72, h: 56, frames: 2, fps: 16, loop: false, row: 5,
    note: 'Hit from behind, where the lid is not. This must look and feel different from lidHit.' },
  { sheet: 'panda.png', clip: 'panda.die', w: 72, h: 56, frames: 5, fps: 12, loop: false, row: 6, note: 'Drops the lid and tumbles.' },

  // --- the Postmaster ------------------------------------------------------
  { sheet: 'boss.png', clip: 'boss.idle', w: 112, h: 144, frames: 4, fps: 6, row: 0,
    note: 'Arms folded, cap low, sack at his feet. Inert until the gate shuts — he should look bored by you.' },
  { sheet: 'boss.png', clip: 'boss.walk', w: 112, h: 144, frames: 6, fps: 10, row: 1, note: 'An unhurried, heavy advance.' },
  { sheet: 'boss.png', clip: 'boss.throw', w: 112, h: 144, frames: 5, fps: 16, loop: false, row: 2,
    note: 'PHASE 1. A three-way spread of mail out of the sack. Wind-up must be readable.' },
  { sheet: 'boss.png', clip: 'boss.summon', w: 112, h: 144, frames: 5, fps: 12, loop: false, row: 3,
    note: 'PHASE 2. A whistle, and a dog arrives. Two fingers to the mouth, cap tipped back.' },
  { sheet: 'boss.png', clip: 'boss.mount', w: 112, h: 144, frames: 6, fps: 12, loop: false, row: 4,
    note: 'PHASE 3 transition. He climbs onto the mail sack and it lifts.' },
  { sheet: 'boss.png', clip: 'boss.ride', w: 112, h: 144, frames: 4, fps: 8, row: 5,
    note: 'PHASE 3. Airborne on the sack, looking down. The cap brim is a PLATFORM the player can stand on, so its top edge must read as flat and solid.' },
  { sheet: 'boss.png', clip: 'boss.bomb', w: 112, h: 144, frames: 3, fps: 16, loop: false, row: 6, note: 'Dropping a parcel over the side.' },
  { sheet: 'boss.png', clip: 'boss.hurt', w: 112, h: 144, frames: 2, fps: 18, loop: false, row: 7, note: 'A flinch, not a stagger. He does not give ground.' },
  { sheet: 'boss.png', clip: 'boss.phase', w: 112, h: 144, frames: 6, fps: 10, loop: false, row: 8,
    note: 'Between phases. He straightens up, and something about him changes — this is the beat that says the fight just got harder.' },
  { sheet: 'boss.png', clip: 'boss.die', w: 112, h: 144, frames: 8, fps: 10, loop: false, row: 9,
    note: 'The long one. Buried in his own mail.' },

  // --- items, projectiles and effects --------------------------------------
  { sheet: 'items.png', clip: 'item.thick', w: 40, h: 40, frames: 4, fps: 8, row: 0,
    note: 'A fat bundle of letters tied with string. Must read as MORE MAIL at a glance — it doubles your throw.' },
  { sheet: 'items.png', clip: 'item.bag', w: 40, h: 40, frames: 4, fps: 8, row: 1,
    note: 'A carrier satchel. This is a 1-up, so it should feel precious — a little shine on it.' },
  { sheet: 'items.png', clip: 'item.express', w: 40, h: 40, frames: 4, fps: 8, row: 2,
    note: 'An express envelope with speed stripes. Green flash, obviously URGENT.' },
  { sheet: 'items.png', clip: 'item.rye', w: 40, h: 40, frames: 4, fps: 8, row: 3,
    note: 'A rye and ginger in a tumbler, ice and a lemon. Five seconds of invincibility.' },
  { sheet: 'items.png', clip: 'item.gummy', w: 40, h: 40, frames: 4, fps: 8, row: 4,
    note: 'A packet of gummy worms, one worm escaping over the top. Refills one health bubble.' },
  { sheet: 'items.png', clip: 'item.package', w: 40, h: 40, frames: 4, fps: 8, row: 5,
    note: 'A taped brown parcel. This is the grenade — it should look heavy and a bit dangerous.' },

  { sheet: 'shots.png', clip: 'shot.mail', w: 32, h: 32, frames: 4, fps: 20, row: 0,
    note: 'A thrown letter tumbling end over end.' },
  { sheet: 'shots.png', clip: 'shot.mailEnemy', w: 32, h: 32, frames: 4, fps: 20, row: 1,
    note: 'The same letter spat back by a bot. Tinted so an incoming letter is never confused with your own.' },
  { sheet: 'shots.png', clip: 'shot.package', w: 32, h: 32, frames: 4, fps: 14, row: 2, note: 'A parcel in flight, tumbling.' },
  { sheet: 'shots.png', clip: 'shot.packageLit', w: 32, h: 32, frames: 2, fps: 20, row: 3,
    note: 'The same parcel with its fuse nearly gone. Must flash — it is the only warning the blast gives.' },
  { sheet: 'shots.png', clip: 'shot.bomb', w: 32, h: 32, frames: 3, fps: 14, row: 4, note: 'The boss drops these from the sack.' },

  { sheet: 'fx.png', clip: 'fx.dust', w: 64, h: 64, frames: 5, fps: 20, loop: false, row: 0, note: 'Footfall and landing dust.' },
  { sheet: 'fx.png', clip: 'fx.jump', w: 64, h: 64, frames: 4, fps: 22, loop: false, row: 1, note: 'A ring of dust at the push-off.' },
  { sheet: 'fx.png', clip: 'fx.stars', w: 64, h: 64, frames: 4, fps: 12, loop: false, row: 2, note: 'Hurt stars. Slapstick.' },
  { sheet: 'fx.png', clip: 'fx.blast', w: 128, h: 128, frames: 6, fps: 20, loop: false, row: 3,
    note: 'The package going off. Big, bright, brief.' },
  { sheet: 'fx.png', clip: 'fx.sparkle', w: 64, h: 64, frames: 5, fps: 18, loop: false, row: 4, note: 'An item being collected.' },
  { sheet: 'fx.png', clip: 'fx.brick', w: 64, h: 64, frames: 5, fps: 18, loop: false, row: 5, note: 'A block breaking apart.' },
  { sheet: 'fx.png', clip: 'fx.shards', w: 64, h: 64, frames: 5, fps: 16, loop: false, row: 6, note: 'The gnome shattering.' },

  // --- the mail truck ------------------------------------------------------
  { sheet: 'truck.png', clip: 'truck.drive', w: 192, h: 128, frames: 4, fps: 12, row: 0,
    note: 'The mail truck rolling in, wheels turning, generic livery only — it is OUR postal service, no real one.' },
  { sheet: 'truck.png', clip: 'truck.stop', w: 192, h: 128, frames: 3, fps: 12, loop: false, row: 1, note: 'Settling on its springs.' },
  { sheet: 'truck.png', clip: 'truck.doorOpen', w: 192, h: 128, frames: 4, fps: 12, loop: false, row: 2, note: 'The side door rolling up.' },
  { sheet: 'truck.png', clip: 'truck.doorShut', w: 192, h: 128, frames: 4, fps: 12, loop: false, row: 3, note: 'And down again.' },

  // --- the world -----------------------------------------------------------
  { sheet: 'tiles.png', clip: 'tile.street', w: 32, h: 32, frames: 4, fps: 1, row: 0,
    note: 'Road surface, four variants so a long run does not visibly repeat. Tarmac, cracks, a manhole.' },
  { sheet: 'tiles.png', clip: 'tile.kerb', w: 32, h: 32, frames: 3, fps: 1, row: 1, note: 'Kerb and pavement edge, including the broken one at a sunken section.' },
  { sheet: 'tiles.png', clip: 'tile.pavement', w: 32, h: 32, frames: 4, fps: 1, row: 2, note: 'Paving slabs, four variants.' },
  { sheet: 'tiles.png', clip: 'tile.grass', w: 32, h: 32, frames: 4, fps: 1, row: 3, note: 'Park grass and lawn, four variants.' },
  { sheet: 'tiles.png', clip: 'tile.dirt', w: 32, h: 32, frames: 3, fps: 1, row: 4, note: 'Earth under a sunken road section, exposed pipe and rubble.' },
  { sheet: 'tiles.png', clip: 'tile.brick', w: 32, h: 32, frames: 3, fps: 1, row: 5, note: 'Building wall, for the bits you can wall-jump.' },
  { sheet: 'tiles.png', clip: 'tile.break', w: 32, h: 32, frames: 3, fps: 1, row: 6,
    note: 'A breakable block in its THREE states: whole, cracked, nearly gone. The player must be able to count the hits by looking.' },
  { sheet: 'tiles.png', clip: 'tile.oneway', w: 32, h: 32, frames: 2, fps: 1, row: 7, note: 'A thin stand-through ledge: scaffold plank, and a tree branch.' },
  { sheet: 'tiles.png', clip: 'tile.hazard', w: 32, h: 32, frames: 4, fps: 8, row: 8, note: 'Hazard: broken railings, or a burst pipe. Animated.' },
  { sheet: 'tiles.png', clip: 'tile.roof', w: 32, h: 32, frames: 4, fps: 1, row: 9,
    note: 'The CEILING, seen from underneath: the face of a concrete slab, with red brick stacked above it. Plain, a conduit run that joins edge to edge with itself, a vent, and an aged one. The bottom edge is the lip the player head-butts, so it is the darkest row on the tile. This was an outdoor roofline until 2026-09-20 — eaves, an awning, a grass verge — which is how a lawn came to be hanging thirteen rows in the air.' },

  // --- more ground and more platforms --------------------------------------
  //
  // Evrtek, 2026-09-23: "Let's also add some more tile assets to the editor for
  // the ground or platforms. Want to make sure we have some variety to play
  // with. Yori should be able to add some neat stuff here."
  //
  // Its own sheet rather than three more rows of tiles.png, so tiles.png keeps
  // the row numbers it already has and the painted rows on it do not move. Same
  // 32 px cell and the same four-variants-per-row convention as tiles.png, so a
  // row of it drops straight into the renderer that already draws that one.
  //
  // There is no `plat.wood`: PLAT_WOOD is `tile.oneway` on tiles.png, which is
  // painted and in the game today (see PLAT_CLIP in render.js). Only the two
  // NEW platform styles need art.
  { sheet: 'tiles2.png', clip: 'tile.cobble', w: 32, h: 32, frames: 4, fps: 1, row: 0,
    note: 'GROUND. Cobbles / setts, four variants. Rounded lumps with dark joints between them, worn smooth along the middle where the traffic goes. An old lane or a mews — it has to read as older and rougher than tile.pavement at a glance, because that is the only reason to choose it.' },
  { sheet: 'tiles2.png', clip: 'tile.planks', w: 32, h: 32, frames: 4, fps: 1, row: 1,
    note: 'GROUND. A boardwalk or decking, four variants. Timber boards running ALONG the way the player walks, with the butt joints and the nail heads as the variation. One variant with a board missing and the dark underneath showing. Not to be confused with plat.* — this is ground you stand on, not a ledge you jump through.' },
  { sheet: 'tiles2.png', clip: 'tile.stone', w: 32, h: 32, frames: 4, fps: 1, row: 2,
    note: 'GROUND. Big flat flagstones, four variants. Larger than a paving slab — a joint every couple of tiles rather than every tile — so a run of it reads as civic or ancient rather than suburban. Cracks and a little moss in the joints are the variants.' },
  { sheet: 'tiles2.png', clip: 'plat.grate', w: 32, h: 32, frames: 4, fps: 1, row: 3,
    note: 'ONE-WAY PLATFORM, metal grating. A thin stand-through ledge you can SEE THROUGH: open slots with the background visible between the bars, which is the whole point of it against the solid plank. Four variants — plain, a bolted end, a bent bar, a rusted one. The TOP EDGE is what the player lands on, so it must be the crispest line on the tile.' },
  { sheet: 'tiles2.png', clip: 'plat.stone', w: 32, h: 32, frames: 4, fps: 1, row: 4,
    note: 'ONE-WAY PLATFORM, stone slab. A thicker, heavier ledge than the plank: a flat top, a shadowed underside, a chipped corner or two. Four variants. It has to read as STAND-THROUGH and not as solid ground — nothing below the slab, no earth under it, just the slab and air.' },

  // --- the jungle zone's ground and ledges ----------------------------------
  //
  // Evrtek, 2026-09-24: "more tiles for building more interesting looking
  // worlds... a tile set that would make sense in our jungle zone." Its own
  // sheet for the reason tiles2.png is: the painted rows on the others keep the
  // numbers they have. Same 32 px cell, four variants a row. Three pavings
  // (SURF_MOSS, SURF_MUD, SURF_SANDSTONE) and three one-way styles (PLAT_LOG,
  // PLAT_VINE, PLAT_SCAFFOLD); see TILE_SURF_CLIP and PLAT_CLIP in render.js.
  { sheet: 'tiles3.png', clip: 'tile.moss', w: 32, h: 32, frames: 4, fps: 1, row: 0,
    note: 'GROUND, jungle floor. A mossy top over dark earth, four variants (for example plain moss, a fern tuft, a root breaking the surface). The top edge is what he runs on, so it stays a clean walkable line — the moss can hang a pixel or two over the edge, never grow up into his feet.' },
  { sheet: 'tiles3.png', clip: 'tile.mud', w: 32, h: 32, frames: 4, fps: 1, row: 1,
    note: 'GROUND, wet mud. Dark and glossy on top, four variants (a puddle catching the light, a footprint, a half-sunk stone). It must read as WET at a glance and darker than tile.dirt — dirt is what is under a road; mud is what a jungle path turns into.' },
  { sheet: 'tiles3.png', clip: 'tile.sandstone', w: 32, h: 32, frames: 4, fps: 1, row: 2,
    note: 'GROUND, sandstone — the floor of a ruin. Warm tan blocks with soft horizontal bedding lines, four variants (a carved band, a crack, green in a joint). Warmer and softer than tile.stone, which is grey civic flagstone; the two must never be mistaken for each other.' },
  { sheet: 'tiles3.png', clip: 'plat.log', w: 32, h: 32, frames: 4, fps: 1, row: 3,
    note: 'ONE-WAY PLATFORM, a log laid along the way he walks. Round, barked, a flat worn top he lands on. Four variants (a knot, a stub of branch, moss on top) and a run of them has to join end to end into one long log with no visible seam. Nothing under it: it is a ledge, not ground.' },
  { sheet: 'tiles3.png', clip: 'plat.vine', w: 32, h: 32, frames: 4, fps: 1, row: 4,
    note: 'ONE-WAY PLATFORM, a thick woven vine strung across a gap, leaves hanging off it. The THINNEST ledge of all and you can see through it, but the top edge must still read as a line you can land on. Four variants. Joins end to end with itself.' },
  { sheet: 'tiles3.png', clip: 'plat.scaffold', w: 32, h: 32, frames: 4, fps: 1, row: 5,
    note: 'ONE-WAY PLATFORM, CITY: a building-site scaffold board on a steel tube, a coupler clamp where they meet. Four variants. It belongs to the current city, not the jungle: a street with a building going up. The board is the top edge; the tube is under it with daylight showing through.' },

  // --- breakable boxes, by what they are made of ----------------------------
  //
  // Evrtek, 2026-09-24: "more breakable boxes." One row per BLOCK_* style, and
  // the four frames of a row are VARIANTS, NOT DAMAGE: the renderer picks one
  // by the block's position so a row of crates is not four identical crates,
  // and draws the cracks ITSELF, over whichever variant it is, as the hits
  // land. The player still counts hits by looking; the sheet does not carry it.
  //
  // BLOCK_CRATE falls back to `tile.break` on tiles.png — the block in the game
  // today, cracking in its three painted states — until block.crate is painted,
  // so level 1 keeps its look to the pixel meanwhile. The same reasoning as
  // PLAT_WOOD keeping tile.oneway.
  { sheet: 'blocks.png', clip: 'block.crate', w: 32, h: 32, frames: 4, fps: 1, row: 0,
    note: 'BREAKABLE, the default: a wooden shipping crate, today\'s breakable block. Four VARIANTS, not damage states. The game draws the cracks on top as it is hit, so paint all four WHOLE. Fills the full 32 x 32 cell — it is a solid block until it breaks.' },
  { sheet: 'blocks.png', clip: 'block.barrel', w: 32, h: 32, frames: 4, fps: 1, row: 1,
    note: 'BREAKABLE, a wooden barrel stood on end: staves, two dark hoops, a lighter lid rim. Four whole variants. Fills the cell edge to edge like the crate, so a stack of them is a wall — rounding only at the very corners.' },
  { sheet: 'blocks.png', clip: 'block.metal', w: 32, h: 32, frames: 4, fps: 1, row: 2,
    note: 'BREAKABLE, a riveted steel box — the city\'s industrial one. Bevelled plate, rivets, four whole variants. It must still read as BREAKABLE and not as solid wall: a box, with a seam round it, never a slab of the masonry.' },
  { sheet: 'blocks.png', clip: 'block.basket', w: 32, h: 32, frames: 4, fps: 1, row: 3,
    note: 'BREAKABLE, the jungle\'s one: a woven wicker basket or reed-bound bundle, lid tied down. Four whole variants. Warm straw colours, so a stack of them reads as jungle next to a stack of crates.' },

  // --- houses ---------------------------------------------------------------
  // Their own sheet rather than a row of props.png, because a clip finds its row
  // at row * h and props.png is rows of nine different heights: the moment a
  // 128x168 house shares that file every row after it needs an explicit y. Fold
  // it in when props.png is actually built and the layout is known.

  { sheet: 'houses.png', clip: 'prop.house', w: 128, h: 216, frames: 4, fps: 1, row: 0,
    note: 'Four suburban house fronts, one street: a bungalow, a storey-and-a-half with a dormer, a porch-fronted one, and a narrow front-gable with a side extension. Each carries a different mail point — a kerbside box, a letter plate, a wall box, a door slot — because that is what the game is about. The feet sit on the bottom edge of the cell. Nine houses are placed in level 1, so four variants are the difference between a street and a row of clones.' },

  // Two more sets on the same cell, one sheet each for the same reason
  // houses.png is its own sheet. Evrtek, 2026-09-24: "more background houses.
  // Stuff that works in the current city scapes and a tile set that would make
  // sense in our jungle zone." Drawn exactly as prop.house is — SC_HOUSE2 and
  // SC_HUT2 each count their own placements, so each set cycles its four
  // variants down the street on its own.
  { sheet: 'houses2.png', clip: 'prop.house2', w: 128, h: 216, frames: 4, fps: 1, row: 0,
    note: 'HOUSES, SET 2 — the same city as houses.png, so it sits beside that set on one street without looking like another town. Four fronts that set does not have — denser and more urban (terraces, a walk-up, a shop with a flat over it). Each still carries a mail point. Same cell and the same rule: feet on the bottom edge.' },
  { sheet: 'huts.png', clip: 'prop.hut', w: 128, h: 216, frames: 4, fps: 1, row: 0,
    note: 'HUTS AND RUINS, the jungle zone. Four, huts and ruins mixed (a thatched hut on stilts, a crumbling sandstone ruin, and so on). Warm greens and tans that sit in front of bg-far-jungle.png without disappearing into it. Background scenery — nothing he stands on — so a stilt or ladder is decoration, and the feet sit on the bottom edge of the cell.' },

  { sheet: 'props.png', clip: 'prop.bin', w: 48, h: 64, frames: 2, fps: 1, row: 0,
    note: 'A wheelie bin, WITH its lid and WITHOUT. The trash panda takes the lid off this one.' },
  { sheet: 'props.png', clip: 'prop.mailbox', w: 48, h: 72, frames: 2, fps: 1, row: 1,
    note: 'The checkpoint mailbox, flag DOWN and flag UP. The flag going up is the only feedback the checkpoint gives, so it has to be unmissable.' },
  { sheet: 'props.png', clip: 'prop.lamp', w: 48, h: 128, frames: 1, fps: 1, row: 2, note: 'A street lamp.' },
  { sheet: 'props.png', clip: 'prop.tree', w: 192, h: 192, frames: 3, fps: 1, row: 3, note: 'Park trees, three shapes so a row of them is not a row of clones. 192 wide, not the 128 the brief asked: the delivered canopies spread wider than they stand, and in a 128 cell they came out four tiles tall against the six the level was laid out around.' },
  { sheet: 'props.png', clip: 'prop.hedge', w: 64, h: 48, frames: 2, fps: 1, row: 4, note: 'Garden hedging.' },
  { sheet: 'props.png', clip: 'prop.fence', w: 32, h: 48, frames: 2, fps: 1, row: 5, note: 'Picket fence, and a broken panel.' },
  { sheet: 'props.png', clip: 'prop.bench', w: 64, h: 48, frames: 1, fps: 1, row: 6, note: 'A park bench.' },
  { sheet: 'props.png', clip: 'prop.gnomeDecoy', w: 48, h: 64, frames: 3, fps: 1, row: 7,
    note: 'THREE harmless garden gnomes. These exist purely so the live one can hide among them — they must match gnome.statue exactly in palette and finish.' },
  { sheet: 'props.png', clip: 'prop.car', w: 128, h: 80, frames: 2, fps: 1, row: 8, note: 'A parked car, two colours.' },
  { sheet: 'props.png', clip: 'prop.hydrant', w: 32, h: 48, frames: 1, fps: 1, row: 9, note: 'A fire hydrant.' },

  // --- SCENERY, painted (2026-09-27) ----------------------------------------
  //
  // Fifteen of the scenery kinds drawScenery had only ever drawn as rectangles,
  // on two sheets from two hands, the same evening, on Evrtek's two lists.
  //
  // props2.png — seven from one GPT delivery (ART-PROMPT-SCENERY.md; built by
  // tools/props.js from art/incoming/recipe-scenery.json). The cells are fitted
  // to what was DELIVERED, not to the brief's first guess: the gates, the digger
  // and the barrier came back wider than they are tall, and the brief's narrow
  // cells would have shrunk the gates to a third of the carrier's height. The
  // lamp and fence need no row here: GPT painted both for props.png, and
  // drawScenery now uses them.
  { sheet: 'props2.png', clip: 'prop.streetMailbox', w: 48, h: 72, frames: 2, fps: 1, row: 0,
    note: 'The ordinary STREET mailbox, NOT the checkpoint: the mailbox bot\'s innocent cousin, the same blue box on ONE grey post with no face. Flag down, flag up; a street of them alternates.' },
  { sheet: 'props2.png', clip: 'prop.pondSign', w: 48, h: 96, frames: 1, fps: 1, row: 1, note: 'The park sign by the duck pond: a duck on two wavy lines, no words.' },
  { sheet: 'props2.png', clip: 'prop.pipe', w: 48, h: 128, frames: 1, fps: 1, row: 2, note: 'A downpipe on a wall: two brackets and a bend at the foot.' },
  { sheet: 'props2.png', clip: 'prop.gates', w: 176, h: 104, frames: 1, fps: 1, row: 3, note: 'The depot gates, shut. Dark iron, rounded tops, a latch where the halves meet.' },
  { sheet: 'props2.png', clip: 'prop.drain', w: 72, h: 16, frames: 1, fps: 1, row: 4, note: 'A storm drain in the kerb, side on: a grate in a kerbstone.' },
  { sheet: 'props2.png', clip: 'prop.digger', w: 160, h: 96, frames: 1, fps: 1, row: 5, note: 'A parked mini digger at the road works, arm up, nobody in it.' },
  { sheet: 'props2.png', clip: 'prop.barrier', w: 96, h: 48, frames: 1, fps: 1, row: 6, note: 'A road-works barrier: a yellow-and-red striped plank on two legs.' },
  //
  // scenery.png — eight drawn in code by Yori (creative/briefs/haines-tales-
  // scenery-brief.md; her notes: art/incoming/yori-notes-scenery.txt). Each cell
  // is the footprint of the placeholder it replaces, and scenery.json carries
  // every cell's x and y, because eight sizes do not stack as rows. Variants
  // cycle by placement count, as the houses do.
  { sheet: 'scenery.png', clip: 'scen.shop', w: 120, h: 128, frames: 4, fps: 1, row: 0,
    note: 'Four shopfronts for the parade — baker, fishmonger, cafe, florist — each sign a PICTURE of the trade, never a word.' },
  { sheet: 'scenery.png', clip: 'scen.garage', w: 112, h: 112, frames: 3, fps: 1, row: 0, note: 'Three garages, the third with its door half open.' },
  { sheet: 'scenery.png', clip: 'scen.container', w: 112, h: 88, frames: 2, fps: 1, row: 0, note: 'Shipping containers in the depot yard, teal and rust-red.' },
  { sheet: 'scenery.png', clip: 'scen.roller', w: 80, h: 140, frames: 1, fps: 1, row: 0,
    note: 'The roller shutter at THE GATE: housing, slats, guide rails. The opening is drawn see-through; drawScenery puts the dark behind it (Evrtek: dark, 2026-09-27).' },
  { sheet: 'scenery.png', clip: 'scen.busStop', w: 76, h: 96, frames: 1, fps: 1, row: 0, note: 'A bus shelter; its roof sign is a picture of a bus.' },
  { sheet: 'scenery.png', clip: 'scen.gateHut', w: 60, h: 80, frames: 1, fps: 1, row: 0,
    note: 'The depot gatehouse (SC_HUT) — NOT the jungle huts, which are prop.hut (SC_HUT2).' },
  { sheet: 'scenery.png', clip: 'scen.bench', w: 56, h: 48, frames: 1, fps: 1, row: 0,
    note: 'A park bench — drawn, and NOT used: Evrtek picked GPT\'s prop.bench for SC_BENCH on 2026-09-27. Kept so the choice can be reversed in one line.' },
  { sheet: 'scenery.png', clip: 'scen.truckBay', w: 80, h: 16, frames: 1, fps: 1, row: 0,
    note: 'Where the truck drops him off at THE KERB: a dropped kerb, a yellow bay line, a bollard at each end.' },

  // --- the far layer: ONE SHEET PER BACKGROUND, chosen per level ------------
  //
  // `bg` is what makes an entry one of the level's choosable backgrounds. It is
  // the whole registry: levels/<id>.js says `"background":"jungle"` in its
  // meta, the renderer looks the id up here, and the editor's Background picker
  // is built from this list. ADDING A SHEET HERE ADDS IT TO THE PICKER and
  // makes the id legal in a level file, with no edit to the editor and none to
  // the loader — the same bargain FOE_/IT_/SC_/SURF_ already strike for kinds.
  //
  // The city keeps the plain clip name `bg.far` and the plain sheet name
  // `bg-far.png` because it is the one that already exists and because
  // js/title.js names both of them directly: the title screen is always the
  // city at dusk, whatever level 1 is set to. The others are `bg.far.<id>`.
  { sheet: 'bg-far.png', clip: 'bg.far', w: 1024, h: 512, frames: 1, fps: 1, row: 0,
    bg: { id: 'city', name: 'City' },
    note: 'FAR LAYER, tiles horizontally and seamlessly. Distant rooftops, water tower, a church spire, hills beyond. Low contrast, cool, hazy — it must sit BEHIND everything without competing. THE DEFAULT: a level that names no background gets this one.' },
  { sheet: 'bg-far-city2.png', clip: 'bg.far.city2', w: 1024, h: 512, frames: 1, fps: 1, row: 0,
    bg: { id: 'city2', name: 'City skyline' },
    note: 'FAR LAYER, alternative city. Tiles horizontally and seamlessly, same 1024 x 512 cell as bg-far.png. A BIGGER town than bg-far.png: office blocks and tower cranes on the skyline rather than rooftops and a church spire, so the two cities read as different places and not as two drawings of one. Same low contrast, same cool haze — it has to sit behind the level without competing.' },
  { sheet: 'bg-far-jungle.png', clip: 'bg.far.jungle', w: 1024, h: 512, frames: 1, fps: 1, row: 0,
    bg: { id: 'jungle', name: 'Jungle' },
    note: 'FAR LAYER, jungle. Tiles horizontally and seamlessly, same 1024 x 512 cell. Layered canopy receding into mist, a few emergent trunks, maybe a ruin or a waterfall far back. Greens, desaturated and hazy with distance — the trap here is contrast: a jungle drawn at full saturation eats the foreground whole.' },
  { sheet: 'bg-far-mountains.png', clip: 'bg.far.mountains', w: 1024, h: 512, frames: 1, fps: 1, row: 0,
    bg: { id: 'mountains', name: 'Mountains' },
    note: 'FAR LAYER, mountain range. Tiles horizontally and seamlessly, same 1024 x 512 cell. Two or three ridges stepping back into haze, snow on the furthest. Cool blues and greys, lowest contrast of the four — this is the one that should feel like distance itself. The seam is the hard part: a ridge line has to meet its own start again without an obvious repeat.' },
  { sheet: 'bg-near.png', clip: 'bg.near', w: 1024, h: 512, frames: 3, fps: 1, row: 0,
    note: 'NEAR LAYER, three seamless variants that the engine cross-fades between by section: 1 STREET - houses, porches, driveways, lawns; 2 PARK - trees, a bandstand, a pond; 3 DEPOT - a sorting depot, loading bays, chain fence. Each must tile with itself.' },
  { sheet: 'bg-fore.png', clip: 'bg.fore', w: 512, h: 512, frames: 3, fps: 1, row: 0,
    note: 'FOREGROUND OCCLUDERS that pass in front of the player: a hedge, a tree trunk, a parked van. Sparse, dark, used to sell depth. Must not hide anything that can hurt you.' },

  // --- the status bar ------------------------------------------------------
  { sheet: 'hud.png', clip: 'hud.face', w: 48, h: 48, frames: 3, fps: 1, row: 0,
    note: 'The carrier portrait in the lives counter: healthy, hurt, and down to the last cell.' },
  { sheet: 'hud.png', clip: 'hud.bubble', w: 96, h: 32, frames: 3, fps: 1, row: 1,
    note: 'A health bubble: FULL, EMPTY, and the not-yet-earned outline. Long capsules, not squares — there are six slots and four are filled at the start.' },
  { sheet: 'hud.png', clip: 'hud.package', w: 32, h: 32, frames: 1, fps: 1, row: 2, note: 'The package counter icon.' },
  { sheet: 'hud.png', clip: 'hud.digits', w: 24, h: 32, frames: 11, fps: 1, row: 3,
    note: 'Digits 0-9 and a colon, for the score and the clock. Chunky, high contrast, readable at speed on a phone.' }
];

// ---------------------------------------------------------------------------
// THE BACKGROUND REGISTRY, read off the manifest above.
//
// Evrtek, 2026-09-23: "We will also need to be able to select from more than
// one background image in the editor so let's make 3 to choose from." There is
// exactly one list of them and it is the manifest — not a table here, not a
// table in the editor, not a table in the loader. A hand-written second list is
// how a picker comes to offer a background the renderer has never heard of.
//
// A level names one by id in its meta; the renderer asks for that id's clip; a
// missing sheet fails the way every other missing sheet fails and the game
// draws its procedural sky instead. Nothing blocks on art, here either.
// ---------------------------------------------------------------------------

var BG_FAR_DEFAULT = 'city';

function bgFarList() {
  var out = [], seen = Object.create(null);
  for (var i = 0; i < SPRITE_MANIFEST.length; i++) {
    var m = SPRITE_MANIFEST[i];
    if (!m.bg || !m.bg.id || seen[m.bg.id]) continue;
    seen[m.bg.id] = 1;
    out.push({ id: m.bg.id, name: m.bg.name || m.bg.id, clip: m.clip, sheet: m.sheet });
  }
  return out;
}

function bgFarHas(id) {
  var list = bgFarList();
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return true;
  return false;
}

// The clip a background id draws from, or the default's clip when the id is one
// this build has never heard of. A level written by a later editor naming a
// background this build does not have opens and plays; it just wears the city.
function bgFarClip(id) {
  var list = bgFarList(), i, def = null;
  for (i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i].clip;
    if (list[i].id === BG_FAR_DEFAULT) def = list[i].clip;
  }
  if (id && typeof console !== 'undefined')
    console.warn('background "' + id + '" is not in this build — using ' + BG_FAR_DEFAULT +
                 '. This build knows: ' + list.map(function (b) { return b.id; }).join(' '));
  return def || 'bg.far';
}

// Register everything in the manifest. Nothing loads until a sheet is actually
// wanted, and a missing sheet costs one failed request and nothing else.
(function () {
  for (var i = 0; i < SPRITE_MANIFEST.length; i++) {
    var m = SPRITE_MANIFEST[i];
    sprClip(m.clip, {
      file: m.sheet, x: 0, y: 0, w: m.w, h: m.h,
      frames: m.frames, fps: m.fps, loop: m.loop, row: m.row,
      ox: m.ox === undefined ? m.w * 0.5 : m.ox,
      oy: m.oy === undefined ? m.h : m.oy
    });
  }
})();
