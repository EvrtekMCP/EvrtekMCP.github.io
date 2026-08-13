/* 8-BIT GAMBIT -- game controller / state machine. */
(function () {
  'use strict';

  var Chess = window.ChessJS.Chess;
  var UI = window.UI;
  var Ad = window.Adaptive;

  var profile = null;
  var rival = null;
  var effRating = 0;
  var game = null;
  var playerColor = 'w';
  var aiThinking = false;
  var over = false;
  var gameSeq = 0;          // guards stale async AI turns from finished games
  var flags = {};           // per-game dialogue flags
  var confirmTimers = {};   // double-click confirmations

  var UNDO_LINES = [
    'TAKE-BACKSIES? BOLD STRATEGY.',
    'I SAW NOTHING. THE BOARD SAW NOTHING.',
    'REWINDING THE TAPE... DONE.',
    'FINE. BUT THE PIXELS REMEMBER.'
  ];

  function $(id) { return document.getElementById(id); }

  /* ---- boot ------------------------------------------------------ */

  function init() {
    profile = window.Storage8.load();
    if (!window.Avatars.art[profile.avatarId]) profile.avatarId = 'kid';
    window.Sound.setMuted(profile.muted);

    window.Board.setup($('board'), {
      onSelect: onSelect,
      onMoveAttempt: onMoveAttempt
    });

    bindUI();
    syncMuteLabel();
    UI.fillTitle(profile);
    UI.showScreen('screen-title');
  }

  function syncMuteLabel() {
    $('btn-mute').textContent = profile.muted ? 'SOUND: OFF' : 'SOUND: ON';
  }

  function bindUI() {
    $('screen-title').addEventListener('click', function (ev) {
      if (ev.target.id === 'btn-reset') return;
      startPressed();
    });
    $('btn-reset').addEventListener('click', function (ev) {
      ev.stopPropagation();
      doubleConfirm('reset', $('btn-reset'), 'SURE? CLICK AGAIN', 'RESET PROGRESS', function () {
        profile = window.Storage8.reset();
        window.Sound.setMuted(profile.muted);
        syncMuteLabel();
        UI.fillTitle(profile);
        window.Sound.play('illegal');
      });
    });
    $('btn-profile-done').addEventListener('click', profileDone);
    $('initials').addEventListener('input', function () {
      this.value = this.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    });
    $('btn-fight').addEventListener('click', function () { window.Sound.play('challenger'); newGame(); });
    $('btn-continue').addEventListener('click', function () {
      UI.showOverlay('overlay-over', false);
      window.Sound.play('blip');
      goVS();
    });
    $('btn-undo').addEventListener('click', undo);
    $('btn-resign').addEventListener('click', function () {
      if (over || !game) return;
      doubleConfirm('resign', $('btn-resign'), 'REALLY? CLICK AGAIN', 'RESIGN', function () {
        endGame(0, 'resign');
      });
    });
    $('btn-mute').addEventListener('click', toggleMute);
    $('btn-menu').addEventListener('click', function () {
      var abandonIsLoss = game && !over && game.history().length >= 6;
      doubleConfirm('menu', $('btn-menu'),
        abandonIsLoss ? 'COUNTS AS A LOSS!' : 'LEAVE? CLICK AGAIN', 'MENU', function () {
        if (abandonIsLoss) {
          endGame(0, 'abandon');
          UI.showOverlay('overlay-over', false);
        }
        /* cancel any in-flight AI turn cleanly */
        over = true;
        gameSeq++;
        aiThinking = false;
        UI.stopThinking();
        UI.fillTitle(profile);
        UI.showScreen('screen-title');
      });
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' || ev.repeat) return;
      /* a focused button already handles Enter natively -- acting here too
       * would double-fire (e.g. two newGame() calls, two AI coroutines) */
      if (ev.target && ev.target.tagName === 'BUTTON') return;
      if ($('screen-title').classList.contains('active')) startPressed();
      else if ($('screen-profile').classList.contains('active')) profileDone();
      else if ($('screen-vs').classList.contains('active')) { window.Sound.play('challenger'); newGame(); }
      else if (!$('overlay-over').classList.contains('hidden')) {
        UI.showOverlay('overlay-over', false);
        goVS();
      }
    });
  }

  /* Double-click-to-confirm for destructive buttons. The action that runs
   * is the one captured when the button was ARMED (first click), so the
   * label the player read always matches what happens -- even if game
   * state shifted between the two clicks. */
  function doubleConfirm(key, btn, armedLabel, normalLabel, action) {
    window.Sound.play('blip');
    var armed = confirmTimers[key];
    if (armed) {
      clearTimeout(armed.timer);
      confirmTimers[key] = null;
      btn.textContent = normalLabel;
      armed.action();
      return;
    }
    btn.textContent = armedLabel;
    confirmTimers[key] = {
      action: action,
      btn: btn,
      label: normalLabel,
      timer: setTimeout(function () {
        confirmTimers[key] = null;
        btn.textContent = normalLabel;
      }, 2500)
    };
  }

  /* disarm all pending confirmations (game boundaries) */
  function clearConfirms() {
    Object.keys(confirmTimers).forEach(function (key) {
      var armed = confirmTimers[key];
      if (armed) {
        clearTimeout(armed.timer);
        armed.btn.textContent = armed.label;
        confirmTimers[key] = null;
      }
    });
  }

  function startPressed() {
    window.Sound.unlock();
    window.Sound.play('blip');
    if (!profile.created) {
      UI.fillProfile(profile);
      UI.showScreen('screen-profile');
    } else {
      goVS();
    }
  }

  function profileDone() {
    var v = $('initials').value.toUpperCase().replace(/[^A-Z]/g, '');
    profile.initials = (v + 'AAA').slice(0, 3);
    profile.created = true;
    window.Storage8.save(profile);
    window.Sound.play('promote');
    goVS();
  }

  function goVS() {
    var pick = Ad.pickRival(profile);
    rival = pick.rival;
    window.Storage8.save(profile);
    var banner = (pick.changed && pick.reason !== 'first') ? pick.reason : null;
    UI.fillVS(profile, rival, banner);
    UI.showScreen('screen-vs');
    if (banner === 'relegated') window.Sound.play('draw');
    else if (banner) window.Sound.play('challenger');
  }

  /* ---- game lifecycle -------------------------------------------- */

  function newGame() {
    gameSeq++;
    clearConfirms();
    game = new Chess();
    playerColor = profile.nextColor || 'w';
    effRating = Ad.effectiveRating(profile, rival);
    over = false;
    aiThinking = false;
    flags = { saidWinning: false, saidLosing: false, saidCheck: false, saidUndo: false };

    window.Board.update({
      game: game,
      orientation: playerColor,
      selected: null,
      legalMoves: [],
      lastMove: null,
      interactive: playerColor === 'w',
      playerColor: playerColor
    });
    UI.fillGameHUD(profile, rival);
    UI.rivalMood(null);
    refreshCaptures();
    UI.showScreen('screen-game');
    UI.say(rival.name, window.Roster.taunt(rival, 'intro'));

    if (playerColor === 'b') aiMove(1400);
  }

  function onSelect(sq) {
    if (aiThinking || over) return;
    window.Sound.play('select');
    window.Board.update({
      selected: sq,
      legalMoves: game.moves({ square: sq, verbose: true })
    });
  }

  function onMoveAttempt(from, to) {
    if (aiThinking || over) return;
    var candidates = game.moves({ square: from, verbose: true }).filter(function (m) {
      return m.to === to;
    });
    if (!candidates.length) {
      /* not an error -- the player is just changing their mind */
      window.Board.update({ selected: null, legalMoves: [] });
      return;
    }
    if (candidates[0].promotion) {
      UI.pickPromotion(playerColor).then(function (t) {
        if (t === null) {
          /* picker dismissed: quietly abandon the move */
          window.Board.update({ selected: null, legalMoves: [] });
          return;
        }
        applyMove({ from: from, to: to, promotion: t }, true);
      });
      return;
    }
    applyMove({ from: from, to: to }, true);
  }

  function applyMove(moveSpec, byPlayer) {
    var made;
    try {
      made = game.move(moveSpec);
    } catch (e) {
      window.Sound.play('illegal');
      return;
    }

    /* sounds */
    if (made.captured) {
      window.Sound.play('capture');
      window.Board.addEffect('flash', made.to, 200);
    } else if (made.flags.indexOf('k') !== -1 || made.flags.indexOf('q') !== -1) {
      window.Sound.play('castle');
    } else if (made.promotion) {
      window.Sound.play('promote');
    } else {
      window.Sound.play('move');
    }
    if (game.inCheck()) window.Sound.play('check');

    window.Board.update({
      selected: null,
      legalMoves: [],
      lastMove: { from: made.from, to: made.to },
      interactive: !byPlayer && !game.isGameOver()
    });
    refreshCaptures();

    if (game.isGameOver()) {
      settleFinishedGame();
      return;
    }

    if (byPlayer) {
      var delayThink = 0;
      if (game.inCheck() && !flags.saidCheck) {
        flags.saidCheck = true;
        var line = window.Roster.taunt(rival, 'check');
        if (line) { UI.say(rival.name, line); delayThink = 1300; }
      }
      aiMove(delayThink);
    }
  }

  function settleFinishedGame() {
    var result;
    if (game.isCheckmate()) {
      var loser = game.turn();
      result = (loser === playerColor) ? 0 : 1;
    } else {
      result = 0.5;
    }
    endGame(result, 'board');
  }

  async function aiMove(extraDelayMs) {
    var seq = gameSeq;
    aiThinking = true;
    window.Board.update({ interactive: false, selected: null, legalMoves: [] });

    var thinkFlavor = rival.thinkMs || [500, 1200];
    var flavorMs = thinkFlavor[0] + Math.random() * (thinkFlavor[1] - thinkFlavor[0]);
    var t0 = performance.now();

    if (extraDelayMs) await wait(extraDelayMs);
    if (seq !== gameSeq) return;
    UI.startThinking(rival.name);

    /* subtle mercy: AI's own static view of the position */
    var aiColor = game.turn();
    var staticEval = window.Eval.evaluate(game.board(), aiColor, rival.persona);
    var aiAdv = (aiColor === 'w' ? 1 : -1) * staticEval;
    var mercy = Ad.mercyMultiplier(aiAdv, game.moveNumber());

    var pick = null;
    try {
      pick = await window.AI.chooseMove(game.fen(), {
        rating: effRating,
        persona: rival.persona,
        mercy: mercy,
        moveNumber: game.moveNumber(),
        history: game.history()
      });
    } catch (e) {
      console.error('[ai] chooseMove failed', e);
    }

    /* keep the "thinking" beat believable */
    var elapsed = performance.now() - t0;
    if (elapsed < flavorMs) await wait(flavorMs - elapsed);

    if (seq !== gameSeq) return;      // a new game started while we thought
    UI.stopThinking();
    aiThinking = false;
    if (over) return;                 // resigned / left while thinking

    if (!pick || !pick.move) {
      /* no legal moves should already mean game over; belt & braces */
      if (game.isGameOver()) settleFinishedGame();
      return;
    }

    applyMove(pick.move, false);
    if (over) return;

    /* dialogue reactions from the AI's perspective */
    var s = pick.bestScore;
    if (s > 350 && !flags.saidWinning) {
      flags.saidWinning = true;
      UI.say(rival.name, window.Roster.taunt(rival, 'winning'));
      UI.rivalMood('happy');
    } else if (s < -350 && !flags.saidLosing) {
      flags.saidLosing = true;
      UI.say(rival.name, window.Roster.taunt(rival, 'losing'));
      UI.rivalMood('sad');
    } else {
      UI.say(null, rival.name + ' PLAYS ' + pick.move.san, { instant: true });
    }
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function refreshCaptures() {
    var hist = game.history({ verbose: true });
    var byPlayer = [], byRival = [];
    hist.forEach(function (m) {
      if (!m.captured) return;
      if (m.color === playerColor) byPlayer.push(m.captured);
      else byRival.push(m.captured);
    });
    var rivalColor = playerColor === 'w' ? 'b' : 'w';
    UI.drawCaptures('cap-player', byPlayer, rivalColor);
    UI.drawCaptures('cap-rival', byRival, playerColor);
  }

  function undo() {
    if (aiThinking || over || !game) return;
    var hist = game.history();
    if (hist.length < 2 || game.turn() !== playerColor) return;
    game.undo();
    game.undo();
    var newHist = game.history({ verbose: true });
    var last = newHist.length ? newHist[newHist.length - 1] : null;
    window.Board.update({
      selected: null,
      legalMoves: [],
      lastMove: last ? { from: last.from, to: last.to } : null,
      interactive: true
    });
    refreshCaptures();
    window.Sound.play('blip');
    if (!flags.saidUndo) {
      flags.saidUndo = true;
      UI.say(rival.name, UNDO_LINES[Math.floor(Math.random() * UNDO_LINES.length)]);
    }
  }

  function endGame(result, how) {
    if (over) return;
    over = true;
    aiThinking = false;
    UI.stopThinking();
    clearConfirms();
    window.Board.update({ interactive: false, selected: null, legalMoves: [] });

    var delta = Ad.applyResult(profile, effRating, result);
    Ad.recordVsRival(profile, rival.id, result);
    profile.nextColor = playerColor === 'w' ? 'b' : 'w';
    window.Storage8.save(profile);

    var resKey = result === 1 ? 'win' : result === 0 ? 'loss' : 'draw';
    window.Sound.play(resKey === 'win' ? 'win' : resKey === 'loss' ? 'lose' : 'draw');
    UI.rivalMood(resKey === 'win' ? 'sad' : resKey === 'loss' ? 'happy' : null);

    var tauntKey = resKey === 'win' ? 'lose' : resKey === 'loss' ? 'win' : 'draw';
    var tauntText = window.Roster.taunt(rival, tauntKey);
    var deltaText = 'SKILL ' + (delta >= 0 ? '+' : '') + delta +
      (how === 'resign' ? '  (RESIGNED)' : how === 'abandon' ? '  (WALKED AWAY)' : '');

    if (how !== 'abandon') {
      UI.fillGameOver(resKey, rival, deltaText, Ad.rankTitle(profile.rating), tauntText);
    }
  }

  function toggleMute() {
    profile.muted = !profile.muted;
    window.Sound.setMuted(profile.muted);
    window.Storage8.save(profile);
    $('btn-mute').textContent = profile.muted ? 'SOUND: OFF' : 'SOUND: ON';
    if (!profile.muted) window.Sound.play('blip');
  }

  window.Game = { init: init };
})();
