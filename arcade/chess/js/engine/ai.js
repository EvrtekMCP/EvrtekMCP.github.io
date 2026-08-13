/* 8-BIT GAMBIT -- the adaptive opponent.
 *
 * Converts an "effective rating" into search parameters + a noise model,
 * then picks a move like a fallible human: sampled root moves carry real
 * scores, Gaussian noise proportional to weakness is added, and sometimes
 * the objectively best move simply isn't "seen".
 *
 * Root moves the search only PROVED to be far below the best (capped
 * bounds) are never sampled -- the AI "didn't consider them". This keeps
 * weak play human (near-misses among reasonable moves) instead of random
 * (occasionally lobbing the queen into a proven disaster).
 *
 * AI.chooseMove(fen, opts) -> Promise<{
 *   move,           chess.js verbose move to play
 *   bestScore,      engine's true best score (mover's perspective, cp)
 *   chosenScore,    true score of the move actually chosen
 *   scoreDrop,      bestScore - chosenScore  (how big a "mistake" this was)
 *   depth, nodes
 * }>
 * opts: {
 *   rating          effective Elo-ish strength 300..2100
 *   persona         eval persona from the roster
 *   mercy           noise multiplier >= 1 (subtle blowout easing; 1 = off)
 *   moveNumber      current full-move number (opening variety)
 *   history         SAN history of the real game (lets the search see
 *                   threefold repetition against actual play)
 *   noYield         run synchronously (tests)
 * }
 */
(function () {
  'use strict';

  var Chess = window.ChessJS.Chess;

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  /* Box-Muller */
  function gauss() {
    var u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /* rating -> engine parameters */
  function paramsForRating(rating) {
    var t = clamp((rating - 300) / 1800, 0, 1);
    return {
      t: t,
      maxDepth: 1 + Math.round(t * 3),                    // 1..4
      timeMs: Math.round(150 + t * 2450),                 // 150..2600ms
      useQuiescence: t > 0.22,
      noiseCp: Math.round(8 + 260 * Math.pow(1 - t, 1.7)),// ~268 -> 8
      pMissBest: 0.22 * Math.pow(1 - t, 1.4)              // ~22% -> 0
    };
  }

  /* Rebuild the position for the search. Replaying the real game's SAN
   * history (when provided) lets the engine's isDraw() see repetitions
   * against positions that actually occurred. */
  function buildGame(fen, history) {
    if (history && history.length) {
      try {
        var g = new Chess();
        for (var i = 0; i < history.length; i++) g.move(history[i]);
        if (g.fen() === fen) return g;
      } catch (e) { /* fall through to FEN */ }
    }
    return new Chess(fen);
  }

  async function chooseMove(fen, opts) {
    /* via window.AI so tests can substitute faster parameters */
    var params = window.AI.paramsForRating(opts.rating || 800);
    var game = buildGame(fen, opts.history);
    var aiColor = game.turn();

    /* noise scale: mercy easing + extra chaos in the first few moves */
    var sigma = params.noiseCp * (opts.mercy || 1);
    if ((opts.moveNumber || 99) <= 4) sigma *= 1.5;

    var result = await window.Search.rootSearch(game, {
      maxDepth: params.maxDepth,
      timeMs: params.timeMs,
      useQuiescence: params.useQuiescence,
      persona: opts.persona,
      aiColor: aiColor,
      noYield: !!opts.noYield,
      /* capped moves are excluded from sampling, so the margin only trades
       * search effort against pool size */
      noiseMargin: Math.round(2.5 * sigma)
    });

    if (!result.moves.length) return null;   // game over, nothing to do

    var entries = result.moves;              // sorted best first
    var bestScore = entries[0].score;

    /* only fully-scored moves may be sampled */
    var pool = entries.filter(function (e) { return !e.capped; });
    if (!pool.length) pool = [entries[0]];

    /* occasionally fail to "see" the best move at all (weak play feels
     * human when the obvious move is missed, not when play is uniformly
     * random). Never miss a forced mate-in-1 for strong characters. */
    if (pool.length > 1 && Math.random() < params.pMissBest) {
      var bestIsMate = bestScore > window.Search.MATE - 1000;
      if (!(bestIsMate && params.t > 0.5)) pool = pool.slice(1);
    }

    /* pick the highest noisy score; mate scores dwarf noise, so found
     * mates are still played and walking into mate is still avoided */
    var chosen = pool[0], chosenNoisy = -Infinity;
    for (var i = 0; i < pool.length; i++) {
      var noisy = pool[i].score + gauss() * sigma;
      if (noisy > chosenNoisy) { chosenNoisy = noisy; chosen = pool[i]; }
    }

    return {
      move: chosen.move,
      bestScore: bestScore,
      chosenScore: chosen.score,
      scoreDrop: bestScore - chosen.score,
      depth: result.depth,
      nodes: result.nodes
    };
  }

  window.AI = {
    paramsForRating: paramsForRating,
    chooseMove: chooseMove
  };
})();
