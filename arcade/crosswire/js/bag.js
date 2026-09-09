'use strict';
// CROSSWIRE — the piece feed.
//
// EVRTEK'S RULING, 2026-09-06: no hand to choose from. The game PRESENTS the
// piece, like Tetris. Three reasons, all his:
//   1. A hand pulls your eyes off the play space.
//   2. It costs buttons, and there is no mouse.
//   3. It ruins the point of the mirror match. If both players are dealt the
//      same pieces in the same order on the same board, the only difference
//      left is how they played it.
//
// So this is a queue with a preview, seeded, and identical for any two rigs
// built from the same seed.
var CW_BAG = (function () {

  // Mulberry32. Small, fast, and identical on every machine, which is the
  // whole basis of "same seed, same game".
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var DROUGHT = 7;      // pieces without a junction before one is forced
  var RUN_CAP = 2;      // Evrtek: never the same piece more than twice running
  var SMALL_DROUGHT = 5; // draws without a one-cell piece before one is forced

  // EVRTEK'S RULING 2026-09-07: "we should slightly favour certain pieces that
  // make the game slightly easier. Since there is randomness to what you
  // receive, if you keep getting giant pieces and you're waiting on one small
  // piece to finish a knee bend, it sucks for the player."
  //
  // Two things, because they fix different halves of that. SIZE_TILT bends the
  // long-run odds toward the small pieces, and SMALL_DROUGHT is the safety
  // net: five draws without a one-cell piece and the next one is one. The tilt
  // alone cannot promise anything — a run of five pentominoes is unlikely, not
  // impossible, and "unlikely" is no comfort to the player it happens to.
  // Measured over 40,000 draws: with the safety net alone, one-cell pieces are
  // 33.8% of the feed and five-cell 16.0%. With this tilt: 37.9% and 12.9%.
  // Slight, which is what he asked for — the net is what makes the promise.
  // (His 09-08 reweighting of LINK, RUN, YOKE and JUNCTION — see pieces.js —
  // moved those two figures a little, since the pieces it favours are two- and
  // three-cell: the same measurement now reads 37.5% and 11.0% at seed 4242.
  // The shape of the tilt is unchanged, and so is the promise.)
  var SIZE_TILT = { 1: 1.2, 2: 1.1, 3: 1.0, 4: 0.9, 5: 0.8 };
  function weightOf(p) { return p.weight * (SIZE_TILT[p.size] || 1); }

  function Feed(seed, preview) {
    this.rand = rng(seed);
    this.preview = preview || 3;
    this.sinceSolder = 0;
    this.sinceSmall = 0;
    this.last = null;
    this.runLen = 0;
    this.queue = [];
    while (this.queue.length < this.preview + 1) this.queue.push(this._draw());
    this.rot = 0;
    this.discards = 0;
  }

  // Everything the next draw is allowed to be. The run cap is a HARD rule, so
  // it is applied by removing the piece from the pool rather than by rerolling
  // — a reroll can fail, and a filter cannot.
  Feed.prototype._pool = function () {
    var out = [], i, p;
    for (i = 0; i < CW_PIECES.LIST.length; i++) {
      p = CW_PIECES.LIST[i];
      if (this.runLen >= RUN_CAP && p.id === this.last) continue;
      out.push(p);
    }
    return out.length ? out : CW_PIECES.LIST.slice();
  };

  Feed.prototype._pick = function (pool) {
    var total = 0, i;
    for (i = 0; i < pool.length; i++) total += weightOf(pool[i]);
    var r = this.rand() * total, acc = 0;
    for (i = 0; i < pool.length; i++) {
      acc += weightOf(pool[i]);
      if (r < acc) return pool[i];
    }
    return pool[pool.length - 1];
  };

  // Bookkeeping every draw goes through, whatever chose it.
  Feed.prototype._took = function (p) {
    this.runLen = (p.id === this.last) ? this.runLen + 1 : 1;
    this.last = p.id;
    this.sinceSolder = p.mixes ? 0 : this.sinceSolder + 1;
    this.sinceSmall = (p.size === 1) ? 0 : this.sinceSmall + 1;
    return p;
  };

  function only(pool, test) {
    var out = [], i;
    for (i = 0; i < pool.length; i++) if (test(pool[i])) out.push(pool[i]);
    return out;
  }

  // TWO promises the feed keeps, and they can come due on the same draw:
  //
  //   never more than SMALL_DROUGHT draws without a one-cell piece, because a
  //   corner you cannot finish is the worst way to be stuck (Evrtek 09-07);
  //   never more than DROUGHT without a junction, because merging two colours
  //   needs one and a drought would be a dead end rather than a challenge.
  //
  // Satisfying one by picking a piece that fails the other quietly breaks it —
  // the harness caught exactly that. So when both are due the draw comes from
  // the INTERSECTION first, which is what a one-cell junction is for.
  Feed.prototype._draw = function () {
    var pool = this._pool(), sub;
    var needSmall = this.sinceSmall >= SMALL_DROUGHT;
    var needJunc = this.sinceSolder >= DROUGHT;

    if (needSmall && needJunc) {
      sub = only(pool, function (p) { return p.size === 1 && p.mixes; });
      if (sub.length) return this._took(this._pick(sub));
    }
    if (needJunc) {
      // Prefer one that also settles the small debt, when there is one.
      sub = only(pool, function (p) { return p.mixes && p.size === 1; });
      if (!sub.length) sub = only(pool, function (p) { return p.mixes; });
      if (sub.length) return this._took(this._pick(sub));
    }
    if (needSmall) {
      sub = only(pool, function (p) { return p.size === 1; });
      if (sub.length) return this._took(this._pick(sub));
    }
    return this._took(this._pick(pool));
  };

  Feed.prototype.piece = function () { return this.queue[0]; };
  Feed.prototype.nexts = function () { return this.queue.slice(1, 1 + this.preview); };
  Feed.prototype.shape = function () {
    var p = this.queue[0];
    return p.rotations[this.rot % p.rotations.length];
  };

  Feed.prototype.rotate = function (dir) {
    var n = this.queue[0].rotations.length;
    this.rot = (this.rot + (dir > 0 ? 1 : n - 1)) % n;
  };

  // Rotation belongs to the slot, not the piece, so the next one arrives
  // upright rather than inheriting whatever the last one was turned to.
  Feed.prototype.advance = function () {
    this.queue.shift();
    this.queue.push(this._draw());
    this.rot = 0;
  };

  Feed.prototype.discard = function () {
    var old = this.queue.shift();
    this.queue.push(this._draw());
    this.rot = 0;
    this.discards++;
    return old;
  };

  Feed.prototype.randInt = function (n) { return Math.floor(this.rand() * n); };

  return { Feed: Feed, rng: rng, DROUGHT: DROUGHT, RUN_CAP: RUN_CAP,
           SMALL_DROUGHT: SMALL_DROUGHT, SIZE_TILT: SIZE_TILT, weightOf: weightOf };
})();
