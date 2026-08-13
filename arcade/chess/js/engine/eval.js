/* 8-BIT GAMBIT -- position evaluation.
 *
 * Scores are centipawns from WHITE's perspective; search flips sign by turn.
 * A `persona` object (from the rival roster) biases the eval so each AI
 * character plays with a recognizable style. Persona terms are computed from
 * the AI side's point of view and folded into the white-perspective score.
 *
 * persona fields (all optional):
 *   pawnValue      pawn worth in cp for the AI side (default 100) -- pawn hoarders
 *   aggression     0..1  bonus for pieces shipped into the enemy half
 *   centerLove     0..1  bonus for occupying the extended center
 *   queenTradeShy  0..1  penalty when queens have been traded off
 *   materialWeight multiplier on material terms   (default 1)
 *   positionalWeight multiplier on PST/structure  (default 1)
 */
(function () {
  'use strict';

  var VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

  /* Piece-square tables, row 0 = rank 8 (white index r*8+f, black (7-r)*8+f) */
  var PST = {
    p: [
      0, 0, 0, 0, 0, 0, 0, 0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
      5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0,
      5, -5, -10, 0, 0, -10, -5, 5,
      5, 10, 10, -20, -20, 10, 10, 5,
      0, 0, 0, 0, 0, 0, 0, 0
    ],
    n: [
      -50, -40, -30, -30, -30, -30, -40, -50,
      -40, -20, 0, 0, 0, 0, -20, -40,
      -30, 0, 10, 15, 15, 10, 0, -30,
      -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30,
      -30, 5, 10, 15, 15, 10, 5, -30,
      -40, -20, 0, 5, 5, 0, -20, -40,
      -50, -40, -30, -30, -30, -30, -40, -50
    ],
    b: [
      -20, -10, -10, -10, -10, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 10, 10, 5, 0, -10,
      -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10,
      -10, 10, 10, 10, 10, 10, 10, -10,
      -10, 5, 0, 0, 0, 0, 5, -10,
      -20, -10, -10, -10, -10, -10, -10, -20
    ],
    r: [
      0, 0, 0, 0, 0, 0, 0, 0,
      5, 10, 10, 10, 10, 10, 10, 5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      0, 0, 0, 5, 5, 0, 0, 0
    ],
    q: [
      -20, -10, -10, -5, -5, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 5, 5, 5, 0, -10,
      -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5,
      -10, 5, 5, 5, 5, 5, 0, -10,
      -10, 0, 5, 0, 0, 0, 0, -10,
      -20, -10, -10, -5, -5, -10, -10, -20
    ],
    kMid: [
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20,
      -10, -20, -20, -20, -20, -20, -20, -10,
      20, 20, 0, 0, 0, 0, 20, 20,
      20, 30, 10, 0, 0, 10, 30, 20
    ],
    kEnd: [
      -50, -40, -30, -20, -20, -30, -40, -50,
      -30, -20, -10, 0, 0, -10, -20, -30,
      -30, -10, 20, 30, 30, 20, -10, -30,
      -30, -10, 30, 40, 40, 30, -10, -30,
      -30, -10, 30, 40, 40, 30, -10, -30,
      -30, -10, 20, 30, 30, 20, -10, -30,
      -30, -30, 0, 0, 0, 0, -30, -30,
      -50, -30, -30, -30, -30, -30, -30, -50
    ]
  };

  /* extended center: c3..f6 */
  function inCenter(r, f) { return r >= 2 && r <= 5 && f >= 2 && f <= 5; }

  /* evaluate(gameBoard, aiColor, persona) -> centipawns, white perspective.
   * gameBoard is the result of chessjs.board(): [8][8] of {type,color}|null,
   * row 0 = rank 8. */
  function evaluate(board, aiColor, persona) {
    persona = persona || {};
    var matW = persona.materialWeight != null ? persona.materialWeight : 1;
    var posW = persona.positionalWeight != null ? persona.positionalWeight : 1;
    var aiPawnVal = persona.pawnValue != null ? persona.pawnValue : 100;

    var material = { w: 0, b: 0 };      // includes pawns
    var nonPawnMat = { w: 0, b: 0 };
    var pst = { w: 0, b: 0 };
    var bishops = { w: 0, b: 0 };
    var kingPos = { w: null, b: null };
    var enemyHalf = { w: 0, b: 0 };     // pieces (not pawns/king) across the frontier
    var center = { w: 0, b: 0 };
    var queens = { w: 0, b: 0 };
    /* pawnRanks[color][file] = list of row indices (row 0 = rank 8) */
    var pawnRanks = { w: [[], [], [], [], [], [], [], []], b: [[], [], [], [], [], [], [], []] };

    var r, f, sq, idx;
    for (r = 0; r < 8; r++) {
      for (f = 0; f < 8; f++) {
        sq = board[r][f];
        if (!sq) continue;
        var c = sq.color, t = sq.type;
        idx = (c === 'w') ? r * 8 + f : (7 - r) * 8 + f;

        if (t === 'p') {
          material[c] += (c === aiColor) ? aiPawnVal : 100;
          pst[c] += PST.p[idx];
          pawnRanks[c][f].push(r);
        } else if (t === 'k') {
          kingPos[c] = { r: r, f: f };
        } else {
          material[c] += VAL[t];
          nonPawnMat[c] += VAL[t];
          pst[c] += (t === 'n') ? PST.n[idx] : (t === 'b') ? PST.b[idx] : (t === 'r') ? PST.r[idx] : PST.q[idx];
          if (t === 'b') bishops[c]++;
          if (t === 'q') queens[c]++;
          /* white's enemy half is rows 0..3; black's is rows 4..7 */
          if (c === 'w' && r <= 3) enemyHalf.w++;
          if (c === 'b' && r >= 4) enemyHalf.b++;
        }
        if (inCenter(r, f)) center[c]++;
      }
    }

    /* endgame factor: 1 when heavy pieces are gone */
    var totalNonPawn = nonPawnMat.w + nonPawnMat.b;
    var endgame = Math.max(0, Math.min(1, 1 - totalNonPawn / 3200));

    /* king PSTs interpolated mid<->end */
    ['w', 'b'].forEach(function (c) {
      if (!kingPos[c]) return;   // should not happen in legal positions
      var kr = kingPos[c].r, kf = kingPos[c].f;
      var kidx = (c === 'w') ? kr * 8 + kf : (7 - kr) * 8 + kf;
      pst[c] += Math.round(PST.kMid[kidx] * (1 - endgame) + PST.kEnd[kidx] * endgame);
    });

    /* pawn structure: doubled, isolated, passed */
    var structure = { w: 0, b: 0 };
    ['w', 'b'].forEach(function (c) {
      var other = (c === 'w') ? 'b' : 'w';
      for (var file = 0; file < 8; file++) {
        var mine = pawnRanks[c][file];
        if (!mine.length) continue;
        if (mine.length > 1) structure[c] -= 15 * (mine.length - 1);
        var neighbors = (file > 0 ? pawnRanks[c][file - 1].length : 0) +
                        (file < 7 ? pawnRanks[c][file + 1].length : 0);
        if (!neighbors) structure[c] -= 12;
        /* passed pawn check per pawn */
        for (var i = 0; i < mine.length; i++) {
          var row = mine[i];
          var blocked = false;
          for (var df = -1; df <= 1 && !blocked; df++) {
            var ff = file + df;
            if (ff < 0 || ff > 7) continue;
            var theirs = pawnRanks[other][ff];
            for (var j = 0; j < theirs.length; j++) {
              /* enemy pawn "ahead" of this pawn on its way to promotion */
              if (c === 'w' ? theirs[j] < row : theirs[j] > row) { blocked = true; break; }
            }
          }
          if (!blocked) {
            var advance = (c === 'w') ? (6 - row) : (row - 1); // 0 at start rank
            structure[c] += 20 + Math.max(0, advance) * 7;
          }
        }
      }
    });

    /* bishop pair */
    if (bishops.w >= 2) structure.w += 30;
    if (bishops.b >= 2) structure.b += 30;

    /* king pawn shield (midgame only) */
    ['w', 'b'].forEach(function (c) {
      if (!kingPos[c] || endgame > 0.6) return;
      var kr = kingPos[c].r, kf = kingPos[c].f;
      var dir = (c === 'w') ? -1 : 1;   // toward opponent
      var shield = 0;
      for (var df = -1; df <= 1; df++) {
        var ff = kf + df;
        if (ff < 0 || ff > 7) continue;
        var rr = kr + dir;
        if (rr >= 0 && rr <= 7) {
          var s1 = board[rr][ff];
          if (s1 && s1.type === 'p' && s1.color === c) { shield++; continue; }
        }
        rr = kr + dir * 2;
        if (rr >= 0 && rr <= 7) {
          var s2 = board[rr][ff];
          if (s2 && s2.type === 'p' && s2.color === c) shield += 0.5;
        }
      }
      structure[c] += Math.round(shield * 12 * (1 - endgame));
    });

    var score =
      matW * (material.w - material.b) +
      posW * ((pst.w - pst.b) + (structure.w - structure.b));

    /* ---- persona flavor terms (AI point of view) ------------------- */
    var aiSign = (aiColor === 'w') ? 1 : -1;
    var flavor = 0;
    if (persona.aggression) {
      flavor += persona.aggression * 8 * (enemyHalf[aiColor] - enemyHalf[aiColor === 'w' ? 'b' : 'w']);
    }
    if (persona.centerLove) {
      flavor += persona.centerLove * 5 * (center[aiColor] - center[aiColor === 'w' ? 'b' : 'w']);
    }
    if (persona.queenTradeShy && queens.w === 0 && queens.b === 0) {
      flavor -= persona.queenTradeShy * 60;
    }
    score += aiSign * flavor;

    return Math.round(score);
  }

  window.Eval = {
    VAL: VAL,
    evaluate: evaluate
  };
})();
