'use strict';
// CROSSWIRE — the rules.
//
// Beta scope: ONE rig, one player. The two-player modes are the same engine
// with different board data.
var CW_GAME = (function () {

  var GRID_W = 10, GRID_H = 20;
  var C = CW_COLOUR;

  // EVRTEK'S DIFFICULTY AXES, 2026-09-06: how many sources are on the board,
  // how many demands at once, and how much blending is required. All three
  // primaries are always present, or some demands would be impossible rather
  // than hard. More sources means shorter routes, so more sources is easier.
  // EVRTEK 2026-09-06: "we should have at least, say, ten of them lit up as
  // source colours. I just think it's more interesting if there's more
  // available starting points as opposed to fewer." Agreed, and with mixing
  // back at valves it also raises the stakes: more sources means more chances
  // to join two of them by accident, which is now a SHORT.
  //
  // EVRTEK 2026-09-08, THE LADDER: "let's have each difficulty consist of 3
  // levels, adjust all levers to make the levels within them each feel
  // different. Might require increasing the starting clocks for STEADY and
  // SHARP so they don't get so tight that they're unplayable."
  //
  // So a difficulty is no longer one row of numbers with an endless level
  // counter on top of it. It is THREE NAMED LEVELS, and EVERY lever moves
  // between them. Ten lines still wire a level; three levels COMPLETE THE RIG
  // and the run ends in a win rather than running forever.
  //
  //   1  WIRE    routing. Few demands, mostly single colours, gentle surges,
  //              generous clocks — the level where the board is learned.
  //   2  SURGE   obstruction. More slabs per surge and a much shorter surge
  //              clock; the destructor starts to matter.
  //   3  BLEND   colour theory under the tightest clock: demands at their
  //              most, and most of them blends.
  //
  // Every clock here is a WHOLE NUMBER OF SECONDS and is that level's FULL
  // LENGTH. TIME_BASE, SURGE_BASE and timeScale are gone with the old scheme:
  // one scale factor per difficulty could not say "this level is tighter than
  // the one before it inside the same difficulty", which is the whole ruling.
  // The clocks went UP where he asked — STEADY opens at 3:00 where the flat
  // number was 2:24, SHARP at 2:20 where it was 1:36 — and only the last level
  // of each is tighter than what it replaced.
  //
  // `slabs` is how many 2x2 slabs land every time the surge clock empties, and
  // how many the board drops at the start of a level. Sources DO NOT move on a
  // surge (his ruling 09-07: "having sources or targets move is too punishing")
  // — the interruption is obstacles appearing and nothing else.
  //
  // `demands` are the lit bulbs. They take DISTINCT rows (_freeTargetRow) out
  // of twenty, so even eight fits with room over, and a finished line RESPAWNS
  // its own demand rather than adding one, which is what holds the count at the
  // number on this table for the whole of a level.
  //
  // `blend` is the share of NEW demands that are a mixed colour. It replaces
  // the flat 0.64 the whole game used to run on and it is the third level's
  // real teeth. CALM still holds every blend back until five lines are done
  // (`simpleFirst`), whatever the level says.
  //
  // `cut` is the destructor's cooldown in seconds — his 09-08 ruling doubled
  // it, and it now climbs with the level as well. `pulse` is the beat a short
  // burns away on, and it was the ONLY thing that used to move with the level.
  var DIFFICULTY = [
    {
      id: 'CALM', blurb: 'fourteen sources · 3 to 5 demands',
      sources: 14, quota: 10, simpleFirst: 5,
      levels: [
        { name: 'WIRE', demands: 3, slabs: 1, time: 216, surge: 120, blend: 0.35, cut: 4, pulse: 3.4, hint: 'WIRE WHAT IT ASKS FOR' },
        { name: 'SURGE', demands: 4, slabs: 2, time: 200, surge: 90, blend: 0.55, cut: 4, pulse: 3.0, hint: 'MORE SLABS, A SHORTER SURGE' },
        { name: 'BLEND', demands: 5, slabs: 3, time: 180, surge: 75, blend: 0.80, cut: 5, pulse: 2.6, hint: 'MOST DEMANDS ARE BLENDS' }
      ]
    },
    {
      id: 'STEADY', blurb: 'twelve sources · 4 to 7 demands',
      sources: 12, quota: 10, simpleFirst: 0,
      levels: [
        { name: 'WIRE', demands: 4, slabs: 2, time: 180, surge: 90, blend: 0.45, cut: 5, pulse: 3.0, hint: 'WIRE WHAT IT ASKS FOR' },
        { name: 'SURGE', demands: 6, slabs: 3, time: 160, surge: 65, blend: 0.65, cut: 6, pulse: 2.7, hint: 'MORE SLABS, A SHORTER SURGE' },
        { name: 'BLEND', demands: 7, slabs: 4, time: 140, surge: 55, blend: 0.85, cut: 7, pulse: 2.4, hint: 'MOST DEMANDS ARE BLENDS' }
      ]
    },
    {
      id: 'SHARP', blurb: 'ten sources · 6 to 8 demands',
      sources: 10, quota: 10, simpleFirst: 0,
      levels: [
        { name: 'WIRE', demands: 6, slabs: 3, time: 140, surge: 70, blend: 0.60, cut: 6, pulse: 2.6, hint: 'WIRE WHAT IT ASKS FOR' },
        { name: 'SURGE', demands: 8, slabs: 5, time: 120, surge: 52, blend: 0.75, cut: 8, pulse: 2.3, hint: 'MORE SLABS, A SHORTER SURGE' },
        { name: 'BLEND', demands: 8, slabs: 5, time: 105, surge: 45, blend: 0.90, cut: 9, pulse: 2.0, hint: 'MOST DEMANDS ARE BLENDS' }
      ]
    }
  ];

  // Evrtek 09-07: 2x2 slabs, and MORE of them. A standing population of twice
  // what one surge drops, so the board churns under pressure instead of slowly
  // filling in — the oldest slab retires to make room for the newest.
  var BLOCKER_SIZE = 2;
  var BLOCKER_STANDING = 2;
  var KEYSTONE_BONUS = 500;

  // THE DESTRUCTOR, Evrtek 09-07: a cross three wide and three tall, taking
  // ONLY the cells it covers rather than the whole run they belong to. It can
  // sit on an edge with a tip hanging off the board, which is what makes a
  // three-cell correction possible right along any edge.
  var CUT = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];

  // EVRTEK 2026-09-07: TWO CLOCKS, and they are both on the ladder above now.
  //
  // The MAIN clock is the level's `time`, with HALF of it back for every demand
  // finished, capped at that maximum. So a double clear always refills it, at
  // every difficulty and on every level, and the game is about keeping the line
  // moving rather than racing the level. The credit is derived rather than
  // written down (timePerDelivery), which is what keeps that rule true as the
  // clocks move.
  //
  // The SURGE clock is the level's `surge` and does not stop for anything. When
  // it empties the rig interrupts you and it starts again. It is the reason to
  // hurry even when the main clock is comfortable, and it is the lever that
  // moves hardest between levels: on SHARP it goes 1:10, 0:52, 0:45.

  // EVRTEK 2026-09-07: the gap between finishing a line and the game noticing
  // was up to a whole pulse, which is far too long to sit through and long
  // enough to lose on. Deliveries came off the pulse entirely and onto their
  // own short fuse: just enough of a beat to see the circuit light up.
  var DELIVER_LEAD = 0.3;

  // EVRTEK 2026-09-07: "can the surge blocks fade into view above the board
  // and then plunge into place?" So a slab is IN THE AIR for this long before
  // it lands, the board does not change until it does, and the three-second
  // alarm before the surge is a warning you can actually act on.
  var PLUNGE = 1.15;
  var PLUNGE_STAGGER = 0.14;

  // The callouts. His words: crosswire, double crosswire, mega crosswire, in
  // the spirit of Unreal Tournament's kill ladder. The voice comes later; every
  // one of these goes through CW_VOICE so there is one place to wire it.
  function calloutFor(n) {
    if (n >= 3) return { text: 'MEGA CROSSWIRE', cue: 'MEGA', tier: 3 };
    if (n === 2) return { text: 'DOUBLE CROSSWIRE', cue: 'DOUBLE', tier: 2 };
    return { text: 'CROSSWIRE', cue: 'CROSSWIRE', tier: 1 };
  }

  function scoreFor(colour) {
    var d = C.depth(colour);
    return d >= 3 ? 900 : (d === 2 ? 300 : 100);
  }

  // THE KEYSTONE, Evrtek 2026-09-06. Every game in this family has one move
  // much harder than the rest that pays for itself: the four-line Tetris, the
  // Dr. Mario combo. Here it is ONE PIECE that completes TWO demands at once.
  var BUGS = [
    { id: 'BROWNOUT', dur: 5, blurb: 'the colour drains out of the wire' },
    { id: 'LAG', dur: 7, blurb: 'your inputs run late' },
    { id: 'INVERT', dur: 7, blurb: 'left and right swap' },
    { id: 'RUST', dur: 0, blurb: 'a blocker lands right now' },
    { id: 'BLIND', dur: 10, blurb: 'you cannot see what is coming' },
    { id: 'POLARITY', dur: 9, blurb: 'a source changes colour under you' }
  ];

  function Game(seed, difficulty, mayhem) {
    this.seed = seed >>> 0;
    this.diffIndex = difficulty === undefined ? 1 : difficulty;
    this.mayhem = !!mayhem;
    // Front end state. Deliberately NOT touched by reset(), so starting a run
    // does not bounce the player back to the title.
    this.screen = 'title';     // title | help | select | play
    this.titlePick = 0;
    this.players = 1;
    // The help is paged rather than one wall of text, because on a phone it
    // has to be. Front-end state, so a run never resets it.
    this.helpPage = 0;
    this.reset();
  }

  Game.prototype.diff = function () { return DIFFICULTY[this.diffIndex]; };

  // THE LEVEL'S ROW. `level` is 1-based and is CLAMPED to the last row, so
  // nothing can ever index past the end of the ladder — a level 4 cannot
  // happen (the tenth line of level 3 ends the run), but a clamp is cheaper
  // than trusting that forever.
  Game.prototype.lvl = function () {
    var rows = this.diff().levels;
    return rows[Math.max(0, Math.min(rows.length - 1, (this.level | 0) - 1))];
  };

  Game.prototype.levelName = function () { return this.lvl().name; };
  Game.prototype.levelCount = function () { return this.diff().levels.length; };

  Game.prototype.reset = function () {
    var d = this.diff();
    this.board = new CW_BOARD.Board(GRID_W, GRID_H);
    this.feed = new CW_BAG.Feed(this.seed, 3);
    this.rand = CW_BAG.rng(this.seed ^ 0x9e3779b9);

    this.score = 0;
    this.level = 1;
    this.delivered = 0;
    this.onLevel = 0;
    this.keystones = 0;

    this.cutCdMax = this.lvl().cut;
    this.cutCd = 0;

    this.pulsePeriod = this.lvl().pulse;
    this.pulseT = this.pulsePeriod;
    this.surge = 0;

    this.cursor = { x: 3, y: 9 };
    this.junctionHints = 3;    // the "space again tunes it" nudge, first few only
    this.snipMode = false;
    this.dirty = true;
    this.shorts = [];
    this.flashes = [];
    this.pops = [];
    this.flares = [];
    this.toasts = [];
    this.banner = null;
    this.bugs = [];
    this.lagQueue = [];
    this.clock = 0;
    this.callout = null;
    this.timeT = this.timeMax();
    this.surgeT = this.surgeMax();
    this.deliverT = -1;          // -1 is nothing pending
    this.incoming = [];          // slabs in the air, not yet on the board
    this.shake = 0;              // screen shake, decays
    this.quitArm = 0;            // seconds left on a first press of QUIT
    this.surgeWarned = 0;        // last whole second the surge alarm sounded on
    this.timeWarned = 0;         // same for the clock
    this.over = false;
    this.won = false;            // the rig is complete: level 3's tenth line
    this.started = false;

    var rows = this._spread(d.sources);
    for (var i = 0; i < d.sources; i++) {
      this.board.sources.push({ row: rows[i], colour: C.PRIMARIES[i % 3] });
    }
    for (var j = 0; j < this.lvl().demands; j++) this._spawnTarget();
    this._beginLevel();
  };

  Game.prototype.quota = function () { return this.diff().quota; };

  // Every one of these reads the LEVEL's row, not the difficulty's. That is
  // the whole of the 09-08 ladder ruling in six lines.
  Game.prototype.timeMax = function () { return this.lvl().time; };
  Game.prototype.surgeMax = function () { return this.lvl().surge; };
  Game.prototype.timePerDelivery = function () { return this.timeMax() / 2; };

  Game.prototype.blockerCount = function () { return this.lvl().slabs; };
  Game.prototype.slabCap = function () { return this.lvl().slabs * BLOCKER_STANDING; };

  // EVRTEK'S RULING, 2026-09-06: the crunch is GLOBAL, not per demand. Doing a
  // pile of good work and then losing because one demand timed out is a bad
  // way to lose. A demand now waits as long as it takes; the LEVEL CLOCK is
  // what runs out.
  Game.prototype._beginLevel = function () {
    this.onLevel = 0;
    // Old slabs go, new ones land. Whatever wire the player has built stays.
    for (var i = 0; i < this.board.cells.length; i++) {
      var c = this.board.cells[i];
      if (c && c.dead) this.board.removeOrigin(c.origin);
    }
    var want = this.blockerCount();
    for (var b = 0; b < want; b++) this._dropBlocker();
    // The pulse used to be the ONE thing a level changed, on a -0.1s formula
    // that ran forever. It is a column of the ladder now like everything else.
    this.pulsePeriod = this.lvl().pulse;
  };

  // Every live slab on the board, oldest first. The origin carries the serial
  // it was made with, which is the only ordering that survives a save.
  Game.prototype._slabs = function () {
    var seen = {}, out = [], i;
    for (i = 0; i < this.board.cells.length; i++) {
      var c = this.board.cells[i];
      if (c && c.dead && !seen[c.origin]) { seen[c.origin] = true; out.push(c.origin); }
    }
    out.sort(function (a, b) { return (+a.slice(3)) - (+b.slice(3)); });
    return out;
  };

  // EVRTEK 2026-09-07: the surge clock is "the trigger for things that
  // interrupt your game", and later the same day he ruled what it may do:
  // OBSTRUCTIONS ONLY. It moved a source on CALM for one build; he called that
  // too punishing, and he is right — losing a route you had planned is a
  // different kind of blow from being made to plan around something new.
  //
  // MAYHEM still adds a bug on top, because MAYHEM is the mode where the rig
  // is allowed to bite.
  Game.prototype._interrupt = function () {
    this.surgeT = this.surgeMax();
    this.surgeWarned = 0;
    var want = this.blockerCount(), got = 0, i;
    for (i = 0; i < want; i++) if (this._dropBlocker(i * PLUNGE_STAGGER)) got++;
    if (got) this.toast('SURGE  ' + got + (got === 1 ? ' SLAB INCOMING' : ' SLABS INCOMING'), C.RED);
    CW_AUDIO.play('surgehit');
    if (this.mayhem) this.fireBug();
    this.dirty = true;
  };

  // A slab does not land; it is LAUNCHED. It appears above the board, hangs
  // there, and plunges — the render draws that — and only when it comes down
  // does the board change. The spot is chosen now and reserved, so a volley
  // of five never stacks two on one square.
  Game.prototype._dropBlocker = function (delay) {
    var taken = this.incoming, spots = this.board.blockerSpots(BLOCKER_SIZE).filter(function (sp) {
      for (var k = 0; k < taken.length; k++) {
        if (Math.abs(taken[k].x - sp[0]) < BLOCKER_SIZE && Math.abs(taken[k].y - sp[1]) < BLOCKER_SIZE) return false;
      }
      return true;
    });
    if (!spots.length) return 0;
    var sp = spots[Math.floor(this.rand() * spots.length)];
    var dur = PLUNGE + (delay || 0);
    this.incoming.push({ x: sp[0], y: sp[1], size: BLOCKER_SIZE, t: dur, max: dur, delay: delay || 0 });
    return 1;
  };

  Game.prototype._landSlab = function (inc) {
    // Slabs never pile up past the cap: the oldest retires to make room.
    var live = this._slabs();
    while (live.length >= this.slabCap()) this.board.removeOrigin(live.shift());
    this.board.placeBlocker(inc.x, inc.y, inc.size);
    for (var dy = 0; dy < inc.size; dy++) {
      for (var dx = 0; dx < inc.size; dx++) {
        this.flashes.push({ x: inc.x + dx, y: inc.y + dy, t: 0.45, colour: 0 });
      }
    }
    this.shake = Math.min(1, this.shake + 0.5);
    CW_AUDIO.play('land');
    this.dirty = true;
  };

  // Distinct rows, spread as evenly as the count allows. With fourteen sources
  // on twenty rows they have to be packed, so this must never collide.
  Game.prototype._spread = function (n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(Math.floor(i * GRID_H / n));
    return out;
  };

  // A finished line retires its SOURCES as well as its demand, so the board
  // keeps changing shape instead of settling (Evrtek 2026-09-06). All three
  // primaries are always kept on the board.
  Game.prototype._moveSource = function (src) {
    var used = {}, i;
    for (i = 0; i < this.board.sources.length; i++) used[this.board.sources[i].row] = true;
    var open = [];
    for (i = 0; i < GRID_H; i++) if (!used[i]) open.push(i);
    if (open.length) src.row = open[Math.floor(this.rand() * open.length)];

    var others = this.board.sources.filter(function (s) { return s !== src; });
    var missing = C.PRIMARIES.filter(function (c) {
      return !others.some(function (s) { return s.colour === c; });
    });
    src.colour = missing.length
      ? missing[Math.floor(this.rand() * missing.length)]
      : C.PRIMARIES[Math.floor(this.rand() * 3)];
    this.dirty = true;
  };

  Game.prototype._freeTargetRow = function () {
    var used = {}, i;
    for (i = 0; i < this.board.targets.length; i++) used[this.board.targets[i].row] = true;
    var open = [];
    for (i = 0; i < GRID_H; i++) if (!used[i]) open.push(i);
    if (!open.length) return 0;
    return open[Math.floor(this.rand() * open.length)];
  };

  // Primaries and secondaries only. Tertiaries are out of the game on his
  // ruling: "just too complicated."
  Game.prototype._pickTargetColour = function () {
    // EVRTEK 2026-09-07: CALM opens on single-colour demands only and holds the
    // first blend back until five lines are done. A new player gets to learn
    // the shape of the game before the colour theory arrives. (It was two of
    // them when he said it; his 09-08 ruling doubled the count to four, and the
    // rule is about the COLOUR, so it holds for however many there are.)
    var first = this.diff().simpleFirst || 0;
    if (this.delivered < first) return C.PRIMARIES[Math.floor(this.rand() * 3)];
    // EVRTEK 2026-09-08, the ladder: the flat 0.64 that used to sit here is a
    // COLUMN now. WIRE is mostly single colours, BLEND is mostly blends, and
    // the difficulty sets how far apart those two ends are.
    if (this.rand() < this.lvl().blend) return C.SECONDARIES[Math.floor(this.rand() * 3)];
    return C.PRIMARIES[Math.floor(this.rand() * 3)];
  };

  Game.prototype._spawnTarget = function () {
    this.board.targets.push({
      row: this._freeTargetRow(),
      colour: this._pickTargetColour(),
      owner: 0, cooldown: 0
    });
  };

  Game.prototype.toast = function (text, colour) {
    this.toasts.push({ text: text, colour: colour || 0, t: 1.8 });
  };

  // ---- why is this demand not lit ---------------------------------------
  // If a player has to ask, the game failed to say.
  Game.prototype.demandStatus = function (t) {
    var x = this.board.w - 1;
    var ni = this.board.nodeOnEdge(x, t.row, 'E');
    if (ni < 0) return { state: 'OPEN', label: 'NOT WIRED' };
    var n = this.board.at(x, t.row).nodes[ni];
    if (n.short) return { state: 'SHORT', label: 'SHORTED' };
    if (!n.colour) return { state: 'DARK', label: 'NO SOURCE' };
    if (n.colour !== t.colour) {
      return { state: 'WRONG', label: 'HAS ' + C.name(n.colour), colour: n.colour };
    }
    return { state: 'LIT', label: 'READY' };
  };

  // ---- bugs (MAYHEM) -----------------------------------------------------

  Game.prototype.bugActive = function (id) {
    for (var i = 0; i < this.bugs.length; i++) if (this.bugs[i].id === id) return true;
    return false;
  };

  Game.prototype.fireBug = function () {
    var def = BUGS[Math.floor(this.rand() * BUGS.length)];
    var bug = { id: def.id, blurb: def.blurb, t: def.dur, max: def.dur };
    if (def.id === 'RUST') {
      this._dropBlocker();
    } else if (def.id === 'POLARITY') {
      var s = this.board.sources[Math.floor(this.rand() * this.board.sources.length)];
      var others = C.PRIMARIES.filter(function (c) { return c !== s.colour; });
      bug.source = s;
      bug.was = s.colour;
      s.colour = others[Math.floor(this.rand() * others.length)];
      this.dirty = true;
    }
    this.bugs.push(bug);
    CW_AUDIO.play('bug');
    this.toast('BUG  ' + def.id + '  ·  ' + def.blurb, C.RED);
    return bug;
  };

  Game.prototype._endBug = function (bug) {
    if (bug.id === 'POLARITY' && bug.source) { bug.source.colour = bug.was; this.dirty = true; }
  };

  // ---- one frame of intent ----------------------------------------------

  Game.prototype.apply = function (cmd) {
    if (this.started && !this.over && this.bugActive('LAG')) {
      this.lagQueue.push({ cmd: cmd, at: this.clock + 0.16 });
      while (this.lagQueue.length && this.lagQueue[0].at <= this.clock) {
        this._applyNow(this.lagQueue.shift().cmd);
      }
      return;
    }
    while (this.lagQueue.length) this._applyNow(this.lagQueue.shift().cmd);
    this._applyNow(cmd);
  };

  // EVRTEK 2026-09-07: a proper front end. TITLE picks the mode, SELECT picks
  // the difficulty against animated sample boards, and HELP explains the game
  // properly instead of in a paragraph nobody reads.
  Game.prototype._startRun = function () {
    var d = this.diffIndex, m = this.mayhem, p = this.players;
    this.seed = (this.seed + 0x2545F491) >>> 0;
    this.diffIndex = d;
    this.reset();
    this.diffIndex = d; this.mayhem = m; this.players = p;
    this.screen = 'play';
    this.started = true;
    this.over = false;
    CW_AUDIO.play('start');
    // EVRTEK 2026-09-08: a different score per level. The music has to be told
    // where it is starting, or a second run picks up on level 3's score.
    // Guarded because the recipe is the audio program's to add.
    if (CW_AUDIO.setLevel) CW_AUDIO.setLevel(1);
  };

  // How many pages the help has is the RENDERER's business — it is the one
  // that knows how much fits on the screen it is drawing. Guarded by typeof so
  // the rules still run headless, where the answer is one page.
  // Whether the screen is the phone layout. The rules do not own the layout;
  // they ask the renderer, and headless there is no renderer, so: desktop.
  Game.prototype._mobileUI = function () {
    return (typeof CW_RENDER !== 'undefined' && CW_RENDER.layout) ? !!CW_RENDER.layout().mobile : false;
  };

  // EVRTEK 2026-09-07: "2 player should not be an option on mobile. It will
  // never work." Two people cannot share one phone, so the row is not drawn
  // there and the keyboard cycle steps over it.
  Game.prototype._titleRows = function () {
    return this._mobileUI() ? [0, 2] : [0, 1, 2];
  };

  Game.prototype._helpPages = function () {
    return (typeof CW_RENDER !== 'undefined' && CW_RENDER.helpPageCount)
      ? CW_RENDER.helpPageCount() : 1;
  };

  Game.prototype._helpTurn = function (d) {
    var was = this.helpPage;
    this.helpPage = Math.max(0, Math.min(this._helpPages() - 1, this.helpPage + d));
    if (this.helpPage !== was) CW_AUDIO.play('menumove');
  };

  // EVRTEK 2026-09-07: on a phone the front end is TAPPED. A pick names the
  // control directly instead of describing a cursor move, because a finger
  // has no cursor to move — and it is the same code underneath, so the
  // keyboard and a thumb can never drift apart.
  Game.prototype._pick = function (id) {
    var parts = String(id).split(':'), where = parts[0], what = parts[1];

    if (where === 'title') {
      if (what === 'music') {
        this.toast(CW_AUDIO.toggleMusic() ? 'MUSIC ON' : 'MUSIC OFF', 0);
        return;
      }
      if (this._titleRows().indexOf(+what) < 0) return;   // not a row on this screen
      this.titlePick = +what;
      CW_AUDIO.play('menupick');
      if (this.titlePick === 0) { this.players = 1; this.screen = 'select'; }
      else if (this.titlePick === 1) this.toast('TWO PLAYERS IS NOT BUILT YET', C.RED);
      else { this.screen = 'help'; this.helpPage = 0; }
      return;
    }

    if (where === 'select') {
      // EVRTEK 2026-09-07: MAYHEM is off the menu for now ("I have another few
      // ideas for a more interesting two player anyway"). The machinery stays
      // — the bugs, the keystone bite, the surge bite — reachable only by the
      // constructor's flag, which is how the harness still proves it.
      if (what === 'mayhem') return;
      if (what === 'start') { this._startRun(); return; }
      if (what === 'back') { this.screen = 'title'; CW_AUDIO.play('menumove'); return; }
      this.diffIndex = Math.max(0, Math.min(DIFFICULTY.length - 1, +what));
      CW_AUDIO.play('menumove');
      return;
    }

    if (where === 'help') {
      if (what === 'back') { this.screen = 'title'; return; }
      this._helpTurn(what === 'next' ? 1 : -1);
      return;
    }

    if (where === 'over') {
      if (what === 'again') { this._startRun(); return; }
      this.screen = 'title';
      this.over = false;
      this.started = false;
    }
  };

  Game.prototype._front = function (cmd) {
    if (cmd.pick) { this._pick(cmd.pick); return; }
    if (this.screen === 'title') {
      if (cmd.dy) {
        var rows = this._titleRows(), at = rows.indexOf(this.titlePick);
        if (at < 0) at = 0;
        this.titlePick = rows[(at + cmd.dy + rows.length) % rows.length];
        CW_AUDIO.play('menumove');
      }
      if (cmd.commit) {
        CW_AUDIO.play('menupick');
        if (this.titlePick === 0) { this.players = 1; this.screen = 'select'; }
        else if (this.titlePick === 1) this.toast('TWO PLAYERS IS NOT BUILT YET', C.RED);
        else { this.screen = 'help'; this.helpPage = 0; }
      }
      return;
    }
    if (this.screen === 'help') {
      // A and D turn the pages, so the keyboard reaches everything the two
      // arrows on the phone's help screen do.
      if (cmd.dx) this._helpTurn(cmd.dx);
      if (cmd.commit || cmd.destroy) this.screen = 'title';
      return;
    }
    if (this.screen === 'select') {
      if (cmd.dx) { this.diffIndex = Math.max(0, Math.min(DIFFICULTY.length - 1, this.diffIndex + cmd.dx)); CW_AUDIO.play('menumove'); }
      // W/S used to toggle MAYHEM here. Off the menu, his ruling; see _pick.
      if (cmd.destroy) { this.screen = 'title'; return; }
      if (cmd.commit) this._startRun();
      return;
    }
    // game over
    // started must drop too, or the next update sees a clock at zero and
    // ends the run again, sound and all (Tron: the ending replayed).
    if (cmd.destroy) { this.screen = 'title'; this.over = false; this.started = false; return; }
    if (cmd.commit) this._startRun();
  };

  Game.prototype._applyNow = function (cmd) {
    if (this.screen !== 'play' || this.over) { this._front(cmd); return; }
    if (cmd.pick === 'play:quit') { this._quit(); return; }

    // EVRTEK 2026-09-07: "on mobile to toggle S vs M can we just make that a
    // single tap? In this case it would not turn the active piece, instead
    // only the toggle would occur." So a tune is the WHOLE command: it names
    // the cell outright, the cursor never moves, nothing is committed, and the
    // piece in hand is not spent. First, so nothing below it can also happen.
    if (cmd.tune) { this._tuneAt(cmd.tune.x, cmd.tune.y); return; }

    // INVERT swaps the DIRECTIONS. A tap or a drag names a square outright, so
    // there is nothing to swap about it — it is carried through untouched
    // rather than dropped, which is what happened when the bug was written
    // before a finger could reach the board.
    if (this.bugActive('INVERT')) cmd = {
      dx: -cmd.dx, dy: cmd.dy, rot: cmd.rot,
      commit: cmd.commit, destroy: cmd.destroy,
      to: cmd.to, tap: cmd.tap, pick: cmd.pick, tune: cmd.tune
    };

    if (cmd.destroy) { this.snipMode = !this.snipMode; this._clampCursor(); CW_AUDIO.play('menumove'); }
    // Rotating pivots the piece around the handle, so the square you are
    // pointing at does not move under you. It ticks; moving does not, on his
    // ruling — a sound on every step would be constant and would grate.
    if (cmd.rot) { this.feed.rotate(cmd.rot); this._clampCursor(); CW_AUDIO.play('rotate'); }

    // EVRTEK 2026-09-07: the cursor is the piece's HANDLE — one marked cell of
    // the piece itself — and the piece is kept wholly on the board, so a
    // rotation swings the rest of it around the square you are pointing at.
    // Reaching an edge with a long piece is then a matter of turning it,
    // exactly as he described. The corners stay out of reach for the longest
    // pieces, which is his call and his words: move on to the next piece.
    // A drag puts the handle straight onto the cell under the finger. It is
    // the same move as holding a direction, just said in one word, and the
    // same clamp keeps the piece on the board. It works in the destructor too,
    // where the cursor is the centre of the cross.
    if (cmd.to) this.cursor = { x: cmd.to.x, y: cmd.to.y };
    if (cmd.dx) this.cursor.x += cmd.dx;
    if (cmd.dy) this.cursor.y += cmd.dy;
    this._clampCursor();

    // EVRTEK'S RULE, 2026-09-07: "tap a cell and the piece's bright handle goes
    // there; tap the same cell again and it commits." TWO taps, never one, so a
    // fat finger on a 26px cell cannot spend the piece by accident. The clamp
    // may land the handle somewhere other than the square that was tapped —
    // a wide piece near an edge — and then the second tap has to be on where
    // the handle actually IS, which is why the renderer's hint reads "tap the
    // bright square to place" rather than naming the cell.
    var commit = cmd.commit;
    if (cmd.tap) {
      if (this.cursor.x === cmd.tap.x && this.cursor.y === cmd.tap.y) commit = true;
      else { this.cursor = { x: cmd.tap.x, y: cmd.tap.y }; this._clampCursor(); }
    }

    // ONE COMMIT KEY, and what it does is whatever you are pointing at. No
    // mode to enter (Evrtek 2026-09-07): hovering an existing junction turns
    // commit into TUNE, and the ghost says so before you press it.
    if (commit) {
      if (this.snipMode) this._destroy();
      else if (this.hoverJunction()) this._tune();
      else this._place();
    }
  };

  // EVRTEK'S RULING 2026-09-07: "Every junction lands as a splitter... The
  // player can press the commit button on any junction to toggle to a mixer."
  //
  // Which needed a way to point at a junction, because commit already places
  // the piece in your hand. So T arms TUNE the way B arms the destructor, the
  // cursor becomes one cell, and commit toggles whatever junction is under it.
  Game.prototype.junctionsAt = function (x, y) {
    var c = this.board.at(x, y), out = [], i;
    if (!c || c.dead) return out;
    for (i = 0; i < c.nodes.length; i++) {
      if (CW_POWER.isJunction(c.nodes[i])) out.push(c.nodes[i]);
    }
    return out;
  };

  // Every cell on the board holding a junction, in reading order.
  Game.prototype.junctionCells = function () {
    var out = [], x, y;
    for (y = 0; y < GRID_H; y++) {
      for (x = 0; x < GRID_W; x++) {
        if (this.junctionsAt(x, y).length) out.push({ x: x, y: y });
      }
    }
    return out;
  };

  // Where the piece's marked cell sits inside the shape, and therefore where
  // the shape's own origin has to be for the handle to land on the cursor.
  Game.prototype.handle = function () {
    return CW_PIECES.targetCell(this.feed.piece(), this.feed.rot);
  };

  Game.prototype.origin = function () {
    var t = this.handle();
    return { x: this.cursor.x - t[0], y: this.cursor.y - t[1] };
  };

  // The handle may go anywhere that leaves the whole piece on the board. In
  // the destructor there is no piece, so the cursor is free.
  // Point the handle at one square if the piece in hand can manage it, and
  // leave the cursor alone if it cannot. Everything about "if possible" lives
  // here: try it, clamp it, and put it back if the clamp moved it.
  Game.prototype.pointAt = function (x, y) {
    var was = { x: this.cursor.x, y: this.cursor.y };
    this.cursor = { x: x, y: y };
    this._clampCursor();
    if (this.cursor.x === x && this.cursor.y === y) return true;
    this.cursor = was;
    return false;
  };

  Game.prototype._clampCursor = function () {
    if (this.snipMode) {
      this.cursor.x = Math.max(0, Math.min(GRID_W - 1, this.cursor.x));
      this.cursor.y = Math.max(0, Math.min(GRID_H - 1, this.cursor.y));
      return;
    }
    var shape = this.feed.shape(), t = this.handle();
    this.cursor.x = Math.max(t[0], Math.min(GRID_W - shape.w + t[0], this.cursor.x));
    this.cursor.y = Math.max(t[1], Math.min(GRID_H - shape.h + t[1], this.cursor.y));
  };

  // The junction the cursor is sitting on, if any. This is the whole of the
  // tuning interface: what commit does depends on what is under you.
  Game.prototype.hoverJunction = function () {
    if (this.snipMode) return null;
    var js = this.junctionsAt(this.cursor.x, this.cursor.y);
    return js.length ? js[0] : null;
  };

  // Tuning ONE named square. The keyboard reaches it through the cursor and a
  // finger names the square it tapped (EVRTEK 2026-09-07), so the toggle is
  // written once, here, and both roads lead to it. That is the whole reason it
  // takes a cell instead of reading the cursor: the two callers disagree about
  // where the junction is, and only one of them has a cursor on it.
  Game.prototype._tuneAt = function (x, y) {
    var js = this.junctionsAt(x, y);
    if (!js.length) { this.toast('NO JUNCTION THERE', 0); return; }
    // Any junction on the board, at any time, however long ago it was placed
    // (Evrtek 2026-09-07). Nothing about a junction is fixed by placing it.
    var m = null;
    for (var i = 0; i < js.length; i++) m = CW_POWER.toggleMode(js[i]);
    this.toast(m === 'M' ? 'MIXER  ·  blends what arrives'
                         : 'SPLITTER  ·  carries one colour', 0);
    CW_AUDIO.play('tune', { to: m });
    this.flashes.push({ x: x, y: y, t: 0.3, colour: 0 });
    this.dirty = true;
  };

  Game.prototype._tune = function () {
    this._tuneAt(this.cursor.x, this.cursor.y);
  };

  // The way out of a run. Tron's patrol found there was none — no pause,
  // no quit — which on a phone is a four-and-a-half-minute trap. Two presses,
  // like placing a piece: the first arms it for two seconds and says so, the
  // second leaves. Escape on a keyboard, the QUIT chip on a phone.
  Game.prototype._quit = function () {
    if (this.quitArm > 0) {
      this.quitArm = 0;
      this.screen = 'title';
      this.started = false;
      this.over = false;
      this.incoming.length = 0;
      this.shake = 0;
      CW_AUDIO.setTension(0);
      CW_AUDIO.play('menupick');
      return;
    }
    this.quitArm = 2;
    this.toast('QUIT?  PRESS AGAIN TO LEAVE THE RUN', C.YELLOW);
  };

  Game.prototype._readyRows = function () {
    var out = [];
    for (var i = 0; i < this.board.targets.length; i++) {
      var t = this.board.targets[i];
      if (this.demandStatus(t).state === 'LIT') out.push(t.row);
    }
    return out;
  };

  // Where the junctions of a shape land on the board, if it has any.
  function junctionCellsOf(shape, ox, oy) {
    var out = [], i, n;
    for (i = 0; i < shape.cells.length; i++) {
      for (n = 0; n < shape.wire[i].length; n++) {
        if (shape.wire[i][n].e.length >= 3) {
          out.push({ x: ox + shape.cells[i][0], y: oy + shape.cells[i][1] });
          break;
        }
      }
    }
    return out;
  }

  // EVRTEK'S RULING, 2026-09-07, MOBILE ONLY: "the rule where a new piece would
  // appear over a previous piece that was a junction no longer applies. In fact,
  // when it does appear there, the new piece can get lost if it's a single
  // block. New pieces on mobile should start at a legal space that is 1-2
  // squares away."
  //
  // The desktop trick below — park the next piece ON the junction just laid, so
  // a second SPACE tunes it — depends on a cursor you can see moving. A finger
  // has none, so on a phone the new piece is simply sitting on top of the one
  // that was just put down, and a one-cell piece vanishes into it entirely.
  //
  // The order is fixed rather than clever, because the same board has to put
  // the piece in the same square every time (mirror match, replays, and a
  // player's own muscle memory): the eight neighbours first, then the sixteen
  // beyond them, and inside a ring the four straight-on directions before the
  // corners. RIGHT leads because the demands are east and that is the way the
  // player is building.
  var PARK_RINGS = [
    // ring 1: right, left, down, up, then the corners
    [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]],
    // ring 2: the same four, the same four corners, then what is left of the
    // ring read in rows, top to bottom and left to right.
    [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, 2], [2, -2], [-2, -2],
     [-1, -2], [1, -2], [-2, -1], [2, -1], [-2, 1], [2, 1], [-1, 2], [1, 2]]
  ];

  // Could the piece in hand be put down with its handle on this square? Asks
  // and answers, changing nothing: the origin the handle implies has to be a
  // legal placement, which also guarantees the whole piece is on the board and
  // overlapping nothing.
  //
  // EMPTY is checked separately and is not the same question. A SPAN may
  // lawfully lie ACROSS a wire, so canPlace alone would happily park a handle
  // on top of one — which is the exact "the new piece can get lost" case his
  // ruling is about.
  Game.prototype._canHandleAt = function (x, y) {
    if (!this.board.inside(x, y)) return false;
    if (this.board.at(x, y)) return false;
    var t = this.handle();
    return this.board.canPlace(this.feed.piece(), this.feed.rot, x - t[0], y - t[1]);
  };

  // Step the new piece aside from where the last one went down. Pure: it moves
  // the cursor and nothing else — it never places, never spends the piece, and
  // never touches the feed.
  Game.prototype._parkNewPiece = function (fromX, fromY) {
    for (var r = 0; r < PARK_RINGS.length; r++) {
      for (var i = 0; i < PARK_RINGS[r].length; i++) {
        var x = fromX + PARK_RINGS[r][i][0], y = fromY + PARK_RINGS[r][i][1];
        if (this._canHandleAt(x, y) && this.pointAt(x, y)) return true;
      }
    }
    // Nothing within two squares fits, so the cursor stays where the clamp put
    // it. Hunting further is worse than not moving: a piece that reappears half
    // a screen from the thumb that placed the last one is lost in a different
    // way, and on a board that tight the player is about to cut anyway.
    return false;
  };

  Game.prototype._place = function () {
    var p = this.feed.piece(), o = this.origin();
    if (!this.board.canPlace(p, this.feed.rot, o.x, o.y)) {
      this.toast('NO ROOM', C.RED);
      CW_AUDIO.play('noroom');
      return;
    }
    var landed = junctionCellsOf(this.feed.shape(), o.x, o.y);
    // Where the handle was when this piece went down. The phone's park rule
    // measures from here, and the clamp below is about to move the cursor.
    var from = { x: this.cursor.x, y: this.cursor.y };
    // The keystone is measured at PLACEMENT, not at the pulse: the question is
    // what this one piece did, and that is only knowable either side of it.
    CW_POWER.solve(this.board);
    var before = this._readyRows();
    this.board.place(p, this.feed.rot, o.x, o.y, 0);
    this.feed.advance();
    this._clampCursor();
    CW_AUDIO.play('place');

    // EVRTEK 2026-09-07: "if you just placed a junction, the next piece should
    // default (if possible) to having its junction modifier piece start on the
    // previous junction. This allows the player to commit a piece and then
    // immediately change its mode without having to fiddle with finding the
    // modifier block." So placing a junction and choosing S or M is one
    // gesture now — commit, then commit again.
    //
    // ON A PHONE IT IS THE OPPOSITE MOVE (his ruling later the same day, see
    // _parkNewPiece): the new piece steps aside instead of stacking, junction
    // or not. No nudge toast goes with it, because there is nothing to tap
    // again onto — a tap on a planted junction already tunes it wherever the
    // piece in hand happens to be.
    if (this._mobileUI()) {
      this._parkNewPiece(from.x, from.y);
    } else if (landed.length && this.pointAt(landed[0].x, landed[0].y) && this.junctionHints > 0) {
      this.junctionHints--;
      this.toast('SPACE AGAIN TUNES IT', C.YELLOW);
    }
    CW_POWER.solve(this.board);
    this.dirty = false;

    var gained = this._readyRows().filter(function (r) { return before.indexOf(r) < 0; });
    if (gained.length >= 2) this._keystone(gained.length);
  };

  Game.prototype._keystone = function (n) {
    var bonus = KEYSTONE_BONUS * (n - 1);
    this.score += bonus;
    this.keystones++;
    this.banner = {
      text: n >= 3 ? 'TRIPLE KEYSTONE' : 'KEYSTONE',
      sub: 'ONE PIECE, ' + n + ' DEMANDS   +' + bonus,
      t: 2.2
    };
    CW_AUDIO.play('keystone');
    CW_VOICE.say('KEYSTONE');
    if (this.mayhem) for (var i = 0; i < n - 1; i++) this.fireBug();
  };

  // Where the cross sits: every arm that is actually on the board. A tip that
  // hangs off the edge simply is not in this list and does nothing, which is
  // how a three-cell correction works right up against an edge.
  Game.prototype.destroyFootprint = function () {
    var out = [], i, x, y;
    for (i = 0; i < CUT.length; i++) {
      x = this.cursor.x + CUT[i][0];
      y = this.cursor.y + CUT[i][1];
      if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) continue;
      out.push([x, y]);
    }
    return out;
  };

  // What it would actually take. ONLY what it touches, wire and slab alike:
  // no more taking the whole run home with it (Evrtek 2026-09-07). Half a
  // piece may be left standing, and that is the point — the cut is a
  // correction now, not a penalty.
  Game.prototype.destroyPreview = function () {
    var board = this.board;
    return this.destroyFootprint().filter(function (c) { return !!board.at(c[0], c[1]); });
  };

  Game.prototype._destroy = function () {
    if (this.cutCd > 0) {
      this.toast('DESTRUCTOR COOLING  ' + this.cutCd.toFixed(1) + 's', C.RED);
      return;
    }
    var doomed = this.destroyPreview(), i, n = 0;
    if (!doomed.length) { this.toast('NOTHING THERE', 0); return; }
    for (i = 0; i < doomed.length; i++) {
      this.flashes.push({ x: doomed[i][0], y: doomed[i][1], t: 0.4, colour: C.RED });
      n += this.board.clearCell(doomed[i][0], doomed[i][1]);
    }
    this.toast('CUT  ' + n + (n === 1 ? ' CELL' : ' CELLS'), C.RED);
    CW_AUDIO.play('cut');
    this.cutCd = this.cutCdMax;
    this.dirty = true;
  };

  // ---- the clock ---------------------------------------------------------

  Game.prototype.update = function (dt) {
    var i;
    this.clock += dt;
    for (i = this.toasts.length - 1; i >= 0; i--) {
      this.toasts[i].t -= dt;
      if (this.toasts[i].t <= 0) this.toasts.splice(i, 1);
    }
    for (i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].t -= dt;
      if (this.flashes[i].t <= 0) this.flashes.splice(i, 1);
    }
    for (i = this.pops.length - 1; i >= 0; i--) {
      if (this.pops[i].delay > 0) { this.pops[i].delay -= dt; continue; }
      this.pops[i].t -= dt;
      if (this.pops[i].t <= 0) this.pops.splice(i, 1);
    }
    for (i = this.flares.length - 1; i >= 0; i--) {
      this.flares[i].t -= dt;
      if (this.flares[i].t <= 0) this.flares.splice(i, 1);
    }
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    if (this.callout) { this.callout.t -= dt; if (this.callout.t <= 0) this.callout = null; }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.2);
    if (this.quitArm > 0) this.quitArm = Math.max(0, this.quitArm - dt);
    if (!this.started || this.over) return;

    for (i = this.bugs.length - 1; i >= 0; i--) {
      this.bugs[i].t -= dt;
      if (this.bugs[i].t <= 0) { this._endBug(this.bugs[i]); this.bugs.splice(i, 1); }
    }

    if (this.dirty) { this.shorts = CW_POWER.solve(this.board); this.dirty = false; }
    if (this.cutCd > 0) this.cutCd = Math.max(0, this.cutCd - dt);

    // Deliveries run on their own short fuse, armed the moment a demand goes
    // ready. Nothing waits for the pulse any more.
    if (this.deliverT < 0 && this._readyRows().length) this.deliverT = DELIVER_LEAD;
    if (this.deliverT >= 0) {
      this.deliverT -= dt;
      if (this.deliverT <= 0) { this.deliverT = -1; this._deliver(); }
    }
    // That delivery may have been the tenth line of level 3, which ends the
    // run. Nothing below here may run on a finished run: the surge would keep
    // ticking and setTension would undo the settle for a frame.
    if (this.over) return;

    this.timeT -= dt;
    if (this.timeT <= 0) {
      // EVRTEK 2026-09-07: he finished a line with a second left and lost
      // anyway, because the delivery had not been counted yet. A line that is
      // wired when the clock runs out is a line: it pays out FIRST, and only
      // if the clock is still empty afterwards is the game over.
      if (this._readyRows().length) { this.deliverT = -1; this._deliver(); }
      // ...and if that line COMPLETED the rig, it is a win, not a loss, even
      // though the clock is sitting on zero.
      if (this.over) return;
      if (this.timeT <= 0) {
        this.timeT = 0;
        this._settle();
        CW_AUDIO.play('gameover');
        return;
      }
    }

    // EVRTEK 2026-09-07: a warning that time is almost up. A soft tick on each
    // of the last fifteen seconds, a double tick on the last five. Once per
    // second, tracked by the whole second so a credit that lifts the clock
    // back over fifteen resets it.
    var tt = Math.ceil(this.timeT);
    if (tt > 15) this.timeWarned = 0;
    else if (tt >= 1 && tt !== this.timeWarned) {
      this.timeWarned = tt;
      CW_AUDIO.play('timewarn', { urgent: tt <= 5 });
    }

    // The surge clock never stops and never gets a reprieve. It does warn:
    // three pulses, one a second, rising, before it fires.
    this.surgeT -= dt;
    var st = Math.ceil(this.surgeT);
    if (st > 3) this.surgeWarned = 0;
    else if (st >= 1 && st !== this.surgeWarned) {
      this.surgeWarned = st;
      CW_AUDIO.play('surgewarn', { k: 3 - st });
    }
    if (this.surgeT <= 0) this._interrupt();

    // The music tightens over the last thirty seconds of the clock and the
    // last eight of the surge, whichever is the more pressing.
    CW_AUDIO.setTension(Math.max(
      this.timeT < 30 ? (30 - this.timeT) / 30 : 0,
      this.surgeT < 8 ? (8 - this.surgeT) / 8 : 0));

    // Slabs in the air come down. Nothing on the board changes until they do.
    for (i = this.incoming.length - 1; i >= 0; i--) {
      var inc = this.incoming[i];
      inc.t -= dt;
      if (inc.t <= 0) { this.incoming.splice(i, 1); this._landSlab(inc); }
    }

    this.surge = Math.max(0, this.surge - dt * 2.6);
    this.pulseT -= dt;
    if (this.pulseT <= 0) { this.pulseT += this.pulsePeriod; this._pulse(); }
  };

  Game.prototype._pulse = function () {
    this.shorts = CW_POWER.solve(this.board);
    this.surge = 1;

    // EVRTEK'S RULING, 2026-09-06: a short flashes red and then the links
    // disappear. It sparks from the moment it is made, so there is a beat to
    // see it and cut it before the pulse takes it, and then it is gone and the
    // space is free again. The player learns quickly that two colours may only
    // meet inside a valve.
    if (this.shorts.length) {
      var burn = {}, cells = 0, s;
      for (s = 0; s < this.shorts.length; s++) {
        var sh = this.shorts[s];
        this.flashes.push({ x: sh.x, y: sh.y, t: 0.45, colour: C.RED });
        var node = this.board.at(sh.x, sh.y);
        if (node && node.nodes[sh.node]) burn[node.nodes[sh.node].origin] = true;
      }
      for (var org in burn) if (burn.hasOwnProperty(org)) cells += this.board.removeOrigin(org);
      this.toast('SHORT  ' + cells + ' CELLS BURNED', C.RED);
      CW_AUDIO.play('short');
      this.shorts = [];
      this.dirty = true;
      CW_POWER.solve(this.board);
    }

  };

  // Everything a finished line does. Called off the delivery fuse, and once
  // more the instant the clock runs out so a line wired on the last tick is
  // never thrown away.
  Game.prototype._deliver = function () {
    if (this.dirty) { this.shorts = CW_POWER.solve(this.board); this.dirty = false; }
    var hits = CW_POWER.deliveries(this.board);
    if (!hits.length) return;

    // A minute back per demand, capped at the maximum. Two at once therefore
    // always refills the clock completely, at every difficulty.
    this.timeT = Math.min(this.timeMax(), this.timeT + hits.length * this.timePerDelivery());

    var call = calloutFor(hits.length);
    this.callout = { text: call.text, tier: call.tier, t: 1.9, max: 1.9, sub: null };
    CW_AUDIO.play('crosswire', { tier: call.tier });
    CW_VOICE.say(call.cue);

    var mult = hits.length, kill = {}, best = 1;
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      var comp = CW_POWER.componentOrdered(this.board, h.x, h.y, h.node);

      // EVRTEK 2026-09-07: three yellow sources into one yellow demand is
      // still ONE crosswire, but it is worth more and it gets said out loud.
      // Counted exactly: a source only feeds this line if the node it pushes
      // into is part of this line.
      var inComp = {}, si;
      for (var q = 0; q < comp.length; q++) inComp[comp[q].x + ':' + comp[q].y + ':' + comp[q].i] = true;
      var feeds = 0;
      for (si = 0; si < this.board.sources.length; si++) {
        var fs = this.board.sources[si];
        var fi = this.board.nodeOnEdge(0, fs.row, 'W');
        if (fi >= 0 && inComp['0:' + fs.row + ':' + fi]) feeds++;
      }
      if (feeds < 1) feeds = 1;
      if (feeds > best) best = feeds;

      var gain = scoreFor(h.target.colour) * mult * feeds;
      this.score += gain;
      this.delivered++;
      this.onLevel++;

      this.flares.push({
        row: h.target.row, colour: h.target.colour, score: gain, t: 1.0, max: 1.0
      });
      // Halved from the first cut: he found the clear-away too slow to sit
      // through when it happens every few seconds.
      for (var c = 0; c < comp.length; c++) {
        this.pops.push({
          x: comp[c].x, y: comp[c].y, colour: h.target.colour,
          delay: comp[c].d * 0.013, t: 0.21, max: 0.21
        });
        var node = this.board.at(comp[c].x, comp[c].y).nodes[comp[c].i];
        if (node) kill[node.origin] = true;
      }

      h.target.colour = this._pickTargetColour();
      h.target.row = this._freeTargetRow();
    }

    // DOUBLE SOURCE / MEGA SOURCE, printed under the crosswire callout.
    if (best >= 3) { this.callout.sub = 'MEGA SOURCE'; CW_AUDIO.play('source', { n: 3 }); CW_VOICE.say('MEGA_SOURCE'); }
    else if (best === 2) { this.callout.sub = 'DOUBLE SOURCE'; CW_AUDIO.play('source', { n: 2 }); CW_VOICE.say('DOUBLE_SOURCE'); }

    // The sources that fed a finished line retire with it and reappear
    // somewhere else, so the left edge keeps changing shape.
    var moved = [];
    for (var mk in kill) if (kill.hasOwnProperty(mk)) {
      for (var y = 0; y < GRID_H; y++) {
        var edge = this.board.at(0, y);
        if (!edge || edge.dead) continue;
        if (!edge.nodes.some(function (n) { return n.origin === mk; })) continue;
        for (var si = 0; si < this.board.sources.length; si++) {
          var src = this.board.sources[si];
          if (src.row === y && moved.indexOf(src) < 0) moved.push(src);
        }
      }
    }
    for (var org in kill) if (kill.hasOwnProperty(org)) this.board.removeOrigin(org);
    for (var mv = 0; mv < moved.length; mv++) this._moveSource(moved[mv]);
    this.shorts = CW_POWER.solve(this.board);
    this.dirty = false;

    if (this.onLevel >= this.quota()) this._levelUp();
  };

  // How a run STOPS, win or lose, in one place: nothing left in the air, no
  // shake carried into the card, and the music let off the tension it was
  // holding. Shared so the win cannot drift from the loss.
  Game.prototype._settle = function () {
    this.over = true;
    this.shake = 0;
    this.incoming.length = 0;
    CW_AUDIO.setTension(0);
  };

  // EVRTEK 2026-09-08: three levels and then the rig is COMPLETE. The tenth
  // line of level 3 ends the run as a WIN — the first ending in this game that
  // is not a failure — and it settles exactly the way running out of time
  // does, only with a different cue over it.
  Game.prototype._complete = function () {
    this._settle();
    this.won = true;
    CW_AUDIO.play('complete');
  };

  Game.prototype._levelUp = function () {
    if (this.level >= this.levelCount()) { this._complete(); return; }

    this.level++;
    // HIS WORRY WAS TIGHTNESS. Finishing a level earns a fresh start on both
    // clocks at the NEW level's length: the tighter level is the pressure, not
    // a drained clock carried into it.
    this.timeT = this.timeMax();
    this.surgeT = this.surgeMax();
    this.timeWarned = 0;
    this.surgeWarned = 0;

    // Dead slabs go, the new level's count lands, onLevel resets, and the
    // pulse period is re-read — all of that is _beginLevel.
    this._beginLevel();

    // More demands light up; none is ever taken away. A level that asks for
    // the same number as the one before it (SHARP 2 and 3, both eight) simply
    // spawns nothing here.
    while (this.board.targets.length < this.lvl().demands) this._spawnTarget();

    // A cooldown already running is not cancelled by a level-up; it is only
    // held to the new maximum, which is never shorter than the old one today.
    this.cutCdMax = this.lvl().cut;
    if (this.cutCd > this.cutCdMax) this.cutCd = this.cutCdMax;

    this.banner = {
      text: 'LEVEL ' + this.level + ' · ' + this.lvl().name,
      sub: this.lvl().hint,
      t: 2.6
    };
    CW_AUDIO.play('levelup');
    if (CW_AUDIO.setLevel) CW_AUDIO.setLevel(this.level);
  };

  return {
    Game: Game, GRID_W: GRID_W, GRID_H: GRID_H,
    DIFFICULTY: DIFFICULTY, BUGS: BUGS, scoreFor: scoreFor,
    KEYSTONE_BONUS: KEYSTONE_BONUS, BLOCKER_SIZE: BLOCKER_SIZE, CUT: CUT,
    BLOCKER_STANDING: BLOCKER_STANDING, DELIVER_LEAD: DELIVER_LEAD,
    PLUNGE: PLUNGE, PLUNGE_STAGGER: PLUNGE_STAGGER
  };
})();
