/* 8-BIT GAMBIT -- negamax alpha-beta search with quiescence and
 * iterative deepening. Runs on the main thread but yields to the event
 * loop between root moves so the UI keeps animating.
 *
 * Performance model (measured): chess.js moves({verbose:true}) costs ~4ms
 * because it renders SAN + FENs for every move; plain moves() is ~0.2ms.
 * So the tree works entirely in SAN strings -- verbose objects are built
 * exactly once, at the root, for the UI's benefit. Terminal states are
 * derived from the generated move list (never isCheckmate/isStalemate,
 * which would regenerate moves), and movegen + eval are cached by position.
 *
 * Entry point: Search.rootSearch(game, options) -> Promise<result>
 *   game     chess.js instance (mutated during search, restored after)
 *   options  {
 *     maxDepth      max iterative deepening depth (>= 1)
 *     timeMs        soft time budget
 *     useQuiescence boolean
 *     persona       eval persona (see eval.js)
 *     aiColor       'w' | 'b'  (the side the persona belongs to)
 *     noYield       skip event-loop yields (tests)
 *     noiseMargin   cp; sub-top root moves only need scores accurate to this
 *     nodeCap       absolute node backstop
 *   }
 * result: {
 *   moves: [{ move, score, capped }]
 *          Root moves with scores from the deepest data available (partial
 *          deeper iterations are merged over the last complete one), best
 *          first, mover's perspective. capped=true means the score is only
 *          an upper bound ("proven at least noiseMargin below the best") --
 *          selection code MUST NOT sample capped moves.
 *   depth, nodes, timedOut
 * }
 */
(function () {
  'use strict';

  var MATE = 100000;
  var evaluate = window.Eval.evaluate;

  function tick() { return new Promise(function (res) { setTimeout(res, 0); }); }

  /* ---- per-search caches ---------------------------------------------- */

  function nthSpace(s, n) {
    var idx = -1;
    while (n-- > 0) {
      idx = s.indexOf(' ', idx + 1);
      if (idx === -1) return s.length;
    }
    return idx;
  }

  /* SAN list for the current position (cached). */
  function genMoves(game, ctx) {
    var fen = game.fen();
    /* legal moves depend on: placement, turn, castling rights, ep square */
    var key = fen.slice(0, nthSpace(fen, 4));
    var hit = ctx.movesCache.get(key);
    if (hit) return hit;
    var moves = game.moves();
    if (ctx.movesCache.size < 40000) ctx.movesCache.set(key, moves);
    return moves;
  }

  function sideEval(game, ctx) {
    var fen = game.fen();
    var key = fen.slice(0, fen.indexOf(' '));
    var white = ctx.evalCache.get(key);
    if (white === undefined) {
      white = evaluate(game.board(), ctx.aiColor, ctx.persona);
      if (ctx.evalCache.size < 40000) ctx.evalCache.set(key, white);
    }
    return game.turn() === 'w' ? white : -white;
  }

  /* ---- SAN helpers ----------------------------------------------------- */

  var PIECE_OF_LETTER = { K: 'k', Q: 'q', R: 'r', B: 'b', N: 'n' };

  function sanDest(san) {
    /* strip check/mate suffix, then promotion suffix, take last 2 chars */
    var s = san;
    var last = s.charAt(s.length - 1);
    if (last === '+' || last === '#') s = s.slice(0, -1);
    if (s.charAt(s.length - 2) === '=') s = s.slice(0, -2);
    return s.slice(-2);
  }

  /* order SAN moves in place for the CURRENT position of `game` */
  function orderSans(game, sans, hint) {
    var VAL = window.Eval.VAL;
    var scored = new Array(sans.length);
    for (var i = 0; i < sans.length; i++) {
      var san = sans[i], s = 0;
      var ch = san.charAt(san.length - 1);
      if (ch === '#') s += 50000;
      else if (ch === '+') s += 60;
      if (san.indexOf('x') !== -1 && san.charAt(0) !== 'O') {
        var victim = game.get(sanDest(san));
        var vVal = victim ? VAL[victim.type] : 100;   // empty dest = en passant
        var attacker = PIECE_OF_LETTER[san.charAt(0)] || 'p';
        s += 10 * vVal - VAL[attacker] / 10;
      }
      if (san.indexOf('=') !== -1) s += 800;
      if (hint && hint[san] != null) s += hint[san];
      scored[i] = { san: san, s: s };
    }
    scored.sort(function (a, b) { return b.s - a.s; });
    for (i = 0; i < sans.length; i++) sans[i] = scored[i].san;
    return sans;
  }

  /* ---- quiescence ------------------------------------------------------ */

  function quiescence(game, alpha, beta, ctx, ply, qdepth) {
    ctx.nodes++;
    if (ctx.nodes > ctx.nodeCap) ctx.aborted = true;
    if ((ctx.nodes & 127) === 0 && ctx.deadline && performance.now() > ctx.deadline) ctx.aborted = true;
    if (ctx.aborted) return alpha;

    var moves = genMoves(game, ctx);
    if (!moves.length) {
      return game.inCheck() ? -(MATE - ply) : 0;      // mate / stalemate
    }

    var inCheck = game.inCheck();
    var stand = -Infinity;
    var candidates;

    if (inCheck) {
      /* no stand-pat while in check: every evasion must be searched */
      candidates = moves.slice();
    } else {
      stand = sideEval(game, ctx);
      if (stand >= beta) return beta;
      if (stand > alpha) alpha = stand;
      if (qdepth >= 8) return alpha;
      candidates = [];
      for (var i = 0; i < moves.length; i++) {
        if (moves[i].indexOf('x') !== -1 || moves[i].indexOf('=') !== -1) candidates.push(moves[i]);
      }
    }

    orderSans(game, candidates, null);
    var VAL = window.Eval.VAL;
    var tried = 0;
    for (var j = 0; j < candidates.length && tried < (inCheck ? 99 : 6); j++) {
      var san = candidates[j];
      if (!inCheck) {
        /* delta pruning: if even winning this material + margin can't reach
         * alpha, skip */
        var victim = game.get(sanDest(san));
        var gain = (san.indexOf('x') !== -1 ? (victim ? VAL[victim.type] : 100) : 0) +
                   (san.indexOf('=') !== -1 ? VAL.q - 100 : 0);
        if (stand + gain + 220 < alpha) continue;
      }
      tried++;
      game.move(san);
      var score = -quiescence(game, -beta, -alpha, ctx, ply + 1, qdepth + 1);
      game.undo();
      if (ctx.aborted) return alpha;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  /* ---- main search ----------------------------------------------------- */

  function negamax(game, depth, alpha, beta, ctx, ply) {
    ctx.nodes++;
    if (ctx.nodes > ctx.nodeCap) ctx.aborted = true;
    if ((ctx.nodes & 127) === 0 && ctx.deadline && performance.now() > ctx.deadline) ctx.aborted = true;
    if (ctx.aborted) return 0;

    var moves = genMoves(game, ctx);
    if (!moves.length) {
      return game.inCheck() ? -(MATE - ply) : 0;   // mate or stalemate
    }
    if (game.isDraw()) return 0;                    // 50-move / repetition / material

    if (depth <= 0) {
      return ctx.useQuiescence ? quiescence(game, alpha, beta, ctx, ply, 0) : sideEval(game, ctx);
    }

    moves = orderSans(game, moves.slice(), null);
    var best = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      game.move(moves[i]);
      var score = -negamax(game, depth - 1, -beta, -alpha, ctx, ply + 1);
      game.undo();
      if (ctx.aborted) return 0;
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }

  async function rootSearch(game, options) {
    var ctx = {
      nodes: 0,
      aborted: false,
      deadline: 0,
      nodeCap: options.nodeCap || 250000,
      useQuiescence: !!options.useQuiescence,
      persona: options.persona || {},
      aiColor: options.aiColor,
      movesCache: new Map(),
      evalCache: new Map()
    };
    var start = performance.now();
    var budget = Math.max(150, options.timeMs || 500);

    /* verbose exactly once: the UI needs from/to/promotion objects */
    var rootVerbose = game.moves({ verbose: true });
    if (!rootVerbose.length) return { moves: [], depth: 0, nodes: 0, timedOut: false };
    var verboseBySan = {};
    rootVerbose.forEach(function (m) { verboseBySan[m.san] = m; });
    var rootSans = rootVerbose.map(function (m) { return m.san; });

    /* depth-0 baseline: static eval after each root move. Bounded and
     * instant, so no matter what the clock does we always return a full,
     * sanely-ordered move list. */
    var scoreBySan = {};
    var cappedBySan = {};
    for (var b = 0; b < rootSans.length; b++) {
      game.move(rootSans[b]);
      var bs;
      var replies = genMoves(game, ctx);
      if (!replies.length) bs = game.inCheck() ? (MATE - 1) : 0;
      else if (game.isDraw()) bs = 0;
      else bs = -sideEval(game, ctx);
      game.undo();
      scoreBySan[rootSans[b]] = bs;
      cappedBySan[rootSans[b]] = false;
    }
    var completedDepth = 0;
    var timedOut = false;

    for (var depth = 1; depth <= Math.max(1, options.maxDepth); depth++) {
      ctx.deadline = start + budget;
      ctx.aborted = false;

      /* order by current best knowledge */
      rootSans.sort(function (a, z) { return scoreBySan[z] - scoreBySan[a]; });

      /* The blunder/noise model samples among the plausible top moves, so
       * those need REAL scores (full window). Moves far below the best only
       * need to be PROVEN far below: a cheap null-window test either fails
       * low (marked capped -- never sampled) or beats the bound and earns a
       * full re-search. */
      var FULL_K = 6;
      var margin = Math.max(300, options.noiseMargin || 0);
      var bestSoFar = -Infinity;
      var iterScore = {};
      var iterCapped = {};
      var covered = 0;
      var complete = true;

      for (var i = 0; i < rootSans.length; i++) {
        var san = rootSans[i];
        game.move(san);
        var score, capped = false;
        if (i < FULL_K || bestSoFar === -Infinity) {
          score = -negamax(game, depth - 1, -Infinity, Infinity, ctx, 1);
        } else {
          var bound = bestSoFar - margin;
          score = -negamax(game, depth - 1, -(bound + 1), -bound, ctx, 1);
          if (!ctx.aborted && score > bound) {
            score = -negamax(game, depth - 1, -Infinity, Infinity, ctx, 1);
          } else if (!ctx.aborted) {
            score = bound;               // upper bound only
            capped = true;
          }
        }
        game.undo();
        if (ctx.aborted) { complete = false; break; }
        if (score > bestSoFar) bestSoFar = score;
        iterScore[san] = score;
        iterCapped[san] = capped;
        covered++;
        /* yield so the UI can animate between root moves (tests skip this:
         * background tabs throttle timers to ~1/sec) */
        if (depth > 1 && !options.noYield) await tick();
        if (performance.now() > ctx.deadline) {
          if (covered < rootSans.length) complete = false;
          break;
        }
      }

      /* merge whatever this iteration finished -- deeper knowledge wins
       * even when the iteration was cut short */
      Object.keys(iterScore).forEach(function (s) {
        scoreBySan[s] = iterScore[s];
        cappedBySan[s] = iterCapped[s];
      });

      if (complete && covered === rootSans.length) {
        completedDepth = depth;
        if (bestSoFar > MATE - 1000) break;   // forced mate found
      } else {
        timedOut = depth <= options.maxDepth;
        break;
      }
      if (performance.now() - start > budget) {
        timedOut = depth < options.maxDepth;
        break;
      }
    }

    var out = rootSans.map(function (san) {
      return { move: verboseBySan[san], score: scoreBySan[san], capped: cappedBySan[san] };
    });
    out.sort(function (a, z) { return z.score - a.score; });
    return { moves: out, depth: completedDepth, nodes: ctx.nodes, timedOut: timedOut };
  }

  window.Search = {
    MATE: MATE,
    rootSearch: rootSearch
  };
})();
