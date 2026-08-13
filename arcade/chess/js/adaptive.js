/* 8-BIT GAMBIT -- adaptive difficulty.
 *
 * Design: a hidden Elo-style player rating updates after every game and
 * decides (a) which rival challenges you and (b) how strong they actually
 * play (their band clamps it, plus a small +40 "keep you honest" offset).
 * Aims to hold the player near a 50% win rate without obvious scripting.
 *
 * In-game easing ("mercy") is separate and subtle: when the AI is winning
 * by a lot, its noise gets multiplied so it plays a bit more loosely.
 * It NEVER tightens up mid-game when the player is winning.
 */
(function () {
  'use strict';

  var R = window.Roster;

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  function expectedScore(a, b) {
    return 1 / (1 + Math.pow(10, (b - a) / 400));
  }

  /* result: 1 player win, 0.5 draw, 0 loss. Mutates + returns profile. */
  function applyResult(profile, oppEffectiveRating, result) {
    var K = profile.games < 8 ? 48 : 24;
    var exp = expectedScore(profile.rating, oppEffectiveRating);
    var delta = Math.round(K * (result - exp));
    profile.rating = clamp(profile.rating + delta, 200, 2400);
    profile.games++;
    if (result === 1) { profile.wins++; }
    else if (result === 0) { profile.losses++; }
    else { profile.draws++; }
    return delta;
  }

  /* Which rival should challenge the player right now?
   * Sticky: keep the current rival while the matchup is close. Beat them
   * twice in a row -> the next rival up appears (NEW CHALLENGER). Lose
   * three straight -> the ladder takes pity and sends the previous rival. */
  function pickRival(profile) {
    var roster = R.ROSTER;
    var current = profile.rivalId ? R.byId[profile.rivalId] : null;
    var next = null;
    var reason = 'same';

    if (!current) {
      /* everyone starts at the bottom of the ladder -- climbing past the
       * early rivals IS the tutorial */
      next = roster[0];
      reason = 'first';
    } else if (profile.streakVsRival >= 2 && current.index < roster.length - 1) {
      next = roster[current.index + 1];
      reason = 'promoted';
    } else if (profile.lossStreakVsRival >= 3 && current.index > 0) {
      next = roster[current.index - 1];
      reason = 'relegated';
    } else if (profile.rating > current.band.max + 120) {
      next = nearestByRating(profile.rating);
      reason = 'outgrew';
    } else {
      /* NOTE: deliberately no demotion for rating < band.min. A freshly
       * promoted player often sits far below the new rival's band; the
       * rival plays near the player's level anyway (see effectiveRating)
       * and relegation is earned only by 3 straight losses. A rating
       * check here would demote players immediately after every
       * promotion and make the ladder oscillate. */
      next = current;
    }

    var changed = !current || next.id !== current.id;
    if (changed) {
      profile.rivalId = next.id;
      profile.streakVsRival = 0;
      profile.lossStreakVsRival = 0;
    }
    return { rival: next, changed: changed, reason: reason };
  }

  function nearestByRating(rating) {
    var roster = R.ROSTER, best = roster[0], bestD = Infinity;
    for (var i = 0; i < roster.length; i++) {
      var d = Math.abs(roster[i].base - rating);
      if (d < bestD) { bestD = d; best = roster[i]; }
    }
    return best;
  }

  /* How strong the rival actually plays this game. Anchored to the PLAYER
   * (rating + 40 keeps them honest), capped by the rival's ceiling. There
   * is deliberately no band-floor clamp: a rival challenging above the
   * player's weight plays near the player's level -- challenge without
   * steamroll -- and only their ceiling differs. */
  function effectiveRating(profile, rival) {
    var hi = rival.band.max === 9999 ? profile.rating + 300 : rival.band.max;
    return clamp(profile.rating + 40, 200, Math.max(200, hi));
  }

  /* Mercy easing: aiAdvantageCp is the AI's own view of the position
   * (positive = AI winning). Returns a noise multiplier >= 1. */
  function mercyMultiplier(aiAdvantageCp, moveNumber) {
    if (moveNumber > 60) return 1;            // let endgames resolve honestly
    if (aiAdvantageCp > 1100) return 2.1;
    if (aiAdvantageCp > 650) return 1.55;
    return 1;
  }

  /* After a game vs the current rival, update streaks + per-char record. */
  function recordVsRival(profile, rivalId, result) {
    var rec = profile.perChar[rivalId] || { w: 0, l: 0, d: 0 };
    if (result === 1) {
      rec.w++;
      profile.streakVsRival++;
      profile.lossStreakVsRival = 0;
    } else if (result === 0) {
      rec.l++;
      profile.streakVsRival = 0;
      profile.lossStreakVsRival++;
    } else {
      rec.d++;
      profile.streakVsRival = 0;
      profile.lossStreakVsRival = 0;
    }
    profile.perChar[rivalId] = rec;
  }

  /* Rank titles for the HUD (display only -- rating stays hidden-ish). */
  var RANKS = [
    [0, 'WOOD PUSHER'],
    [500, 'PAWN STAR'],
    [700, 'SQUARE DANCER'],
    [900, 'FORK OPERATOR'],
    [1100, 'PIN PAL'],
    [1300, 'TACTICS GOBLIN'],
    [1500, 'BOARD BOSS'],
    [1700, 'ARCADE MASTER'],
    [1900, 'GRANDMASTER OF THE ARCADE']
  ];

  function rankTitle(rating) {
    var title = RANKS[0][1];
    for (var i = 0; i < RANKS.length; i++) {
      if (rating >= RANKS[i][0]) title = RANKS[i][1];
    }
    return title;
  }

  window.Adaptive = {
    expectedScore: expectedScore,
    applyResult: applyResult,
    pickRival: pickRival,
    effectiveRating: effectiveRating,
    mercyMultiplier: mercyMultiplier,
    recordVsRival: recordVsRival,
    rankTitle: rankTitle
  };
})();
