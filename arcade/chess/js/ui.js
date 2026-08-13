/* 8-BIT GAMBIT -- DOM screens, HUD, dialogue box, promotion picker. */
(function () {
  'use strict';

  var A = window.Avatars;
  var S = window.Sprites;

  function $(id) { return document.getElementById(id); }

  /* ---- screens --------------------------------------------------- */

  var SCREENS = ['screen-title', 'screen-profile', 'screen-vs', 'screen-game'];

  function showScreen(id) {
    SCREENS.forEach(function (s) {
      $(s).classList.toggle('active', s === id);
    });
  }

  function showOverlay(id, show) {
    $(id).classList.toggle('hidden', !show);
  }

  /* ---- pixel canvas helpers -------------------------------------- */

  function drawAvatar(canvasId, avatarId, scale) {
    var cv = $(canvasId);
    if (!cv) return;
    scale = scale || 1;
    cv.width = 16 * scale; cv.height = 16 * scale;
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    A.draw(ctx, avatarId, 0, 0, scale);
  }

  /* captured piece tray: types like ['p','p','n'], full sprites, no overlap */
  function drawCaptures(canvasId, types, color) {
    var cv = $(canvasId);
    if (!cv) return;
    var perRow = 6, cellW = 14, cellH = 17;
    cv.width = perRow * cellW + 2;
    cv.height = Math.max(1, Math.ceil(types.length / perRow)) * cellH + 2;
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    var order = { q: 0, r: 1, b: 2, n: 3, p: 4 };
    var sorted = types.slice().sort(function (a, b) { return order[a] - order[b]; });
    sorted.forEach(function (t, i) {
      var x = (i % perRow) * cellW + 1;
      var y = Math.floor(i / perRow) * cellH + 1;
      S.drawSprite(ctx, S.PIECE_SPRITES[t], x, y, S.pieceColorMap(color), 1);
    });
  }

  /* ---- dialogue box ---------------------------------------------- */

  var typeTimer = null;
  var thinkTimer = null;

  function say(speaker, text, opts) {
    opts = opts || {};
    stopThinking();
    if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
    var nameEl = $('dialogue-name');
    var textEl = $('dialogue-text');
    nameEl.textContent = speaker ? speaker + ':' : '';
    if (opts.instant) {
      textEl.textContent = text;
      return;
    }
    textEl.textContent = '';
    var i = 0;
    typeTimer = setInterval(function () {
      textEl.textContent += text[i];
      if (i % 2 === 0) window.Sound.play('type');
      i++;
      if (i >= text.length) { clearInterval(typeTimer); typeTimer = null; }
    }, 26);
  }

  function startThinking(name) {
    stopThinking();
    if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
    $('dialogue-name').textContent = '';
    var dots = 0;
    var textEl = $('dialogue-text');
    textEl.textContent = name + ' IS THINKING';
    thinkTimer = setInterval(function () {
      dots = (dots + 1) % 4;
      textEl.textContent = name + ' IS THINKING' + '...'.slice(0, dots);
      if (Math.random() < 0.3) window.Sound.play('thinking');
    }, 350);
  }

  function stopThinking() {
    if (thinkTimer) { clearInterval(thinkTimer); thinkTimer = null; }
  }

  /* ---- promotion picker ------------------------------------------ */

  /* resolves with 'q'|'r'|'b'|'n', or null if the player clicks the
   * backdrop to back out of an accidental promotion drag */
  function pickPromotion(color) {
    return new Promise(function (resolve) {
      var host = $('promo-choices');
      var overlay = $('overlay-promote');
      host.innerHTML = '';
      function finish(t) {
        overlay.onclick = null;
        showOverlay('overlay-promote', false);
        if (t) window.Sound.play('promote');
        resolve(t);
      }
      ['q', 'r', 'b', 'n'].forEach(function (t) {
        var btn = document.createElement('button');
        btn.className = 'promo-btn';
        var cv = document.createElement('canvas');
        cv.width = 16; cv.height = 16;
        var c2 = cv.getContext('2d');
        c2.imageSmoothingEnabled = false;
        S.drawSprite(c2, S.PIECE_SPRITES[t], 0, 0, S.pieceColorMap(color), 1);
        btn.appendChild(cv);
        btn.addEventListener('click', function () { finish(t); });
        host.appendChild(btn);
      });
      overlay.onclick = function (ev) {
        if (ev.target === overlay) finish(null);   // backdrop = cancel
      };
      showOverlay('overlay-promote', true);
    });
  }

  /* ---- screen fillers -------------------------------------------- */

  function fillTitle(profile) {
    var stats = $('title-stats');
    if (profile.created) {
      stats.textContent = profile.initials + '  ·  RANK: ' + window.Adaptive.rankTitle(profile.rating) +
        '  ·  W' + profile.wins + ' L' + profile.losses + ' D' + profile.draws;
      $('btn-reset').classList.remove('hidden');
    } else {
      stats.textContent = '';
      $('btn-reset').classList.add('hidden');
    }
    drawAvatar('title-canvas-1', 'boop', 4);
    drawAvatar('title-canvas-2', 'checkmatron', 4);
  }

  function fillProfile(profile) {
    $('initials').value = profile.initials || 'AAA';
    var host = $('avatar-pick');
    host.innerHTML = '';
    A.playerIds.forEach(function (id) {
      var btn = document.createElement('button');
      btn.className = 'avatar-btn' + (profile.avatarId === id ? ' picked' : '');
      btn.dataset.avatar = id;
      var cv = document.createElement('canvas');
      cv.width = 64; cv.height = 64;
      var c2 = cv.getContext('2d');
      c2.imageSmoothingEnabled = false;
      A.draw(c2, id, 0, 0, 4);
      btn.appendChild(cv);
      btn.addEventListener('click', function () {
        profile.avatarId = id;
        host.querySelectorAll('.avatar-btn').forEach(function (b) {
          b.classList.toggle('picked', b.dataset.avatar === id);
        });
        window.Sound.play('blip');
      });
      host.appendChild(btn);
    });
  }

  /* bannerReason: null | 'promoted' | 'relegated' | 'outgrew' */
  function fillVS(profile, rival, bannerReason) {
    var banner = $('vs-banner');
    banner.classList.toggle('hidden', !bannerReason);
    if (bannerReason === 'relegated') {
      banner.textContent = '★ THE LADDER TAKES PITY ON YOU ★';
    } else if (bannerReason) {
      banner.textContent = '★ A NEW CHALLENGER APPROACHES! ★';
    }
    drawAvatar('vs-player', profile.avatarId, 6);
    drawAvatar('vs-rival', rival.id, 6);
    $('vs-player-name').textContent = profile.initials;
    $('vs-player-rank').textContent = window.Adaptive.rankTitle(profile.rating);
    $('vs-rival-name').textContent = rival.name;
    $('vs-rival-title').textContent = rival.title;
    $('vs-bio').textContent = rival.bio;
    $('vs-taunt').textContent = '"' + window.Roster.taunt(rival, 'intro') + '"';
  }

  function fillGameHUD(profile, rival) {
    drawAvatar('hud-player', profile.avatarId, 4);
    drawAvatar('hud-rival', rival.id, 4);
    $('hud-player-name').textContent = profile.initials;
    $('hud-player-rank').textContent = window.Adaptive.rankTitle(profile.rating);
    $('hud-rival-name').textContent = rival.name;
    $('hud-rival-title').textContent = rival.title;
  }

  function fillGameOver(result, rival, deltaText, rankTitle, tauntText) {
    var banner = $('over-banner');
    banner.textContent = result === 'win' ? 'YOU WIN!' : result === 'loss' ? 'YOU LOSE!' : 'DRAW!';
    banner.className = result;
    $('over-taunt').textContent = tauntText ? '"' + tauntText + '"' : '';
    $('over-rating').textContent = deltaText;
    $('over-rank').textContent = 'RANK: ' + rankTitle;
    showOverlay('overlay-over', true);
  }

  /* rival avatar mood wiggle */
  function rivalMood(mood) {
    var cv = $('hud-rival');
    cv.classList.remove('mood-happy', 'mood-sad');
    if (mood === 'happy') cv.classList.add('mood-happy');
    if (mood === 'sad') cv.classList.add('mood-sad');
  }

  window.UI = {
    showScreen: showScreen,
    showOverlay: showOverlay,
    drawAvatar: drawAvatar,
    drawCaptures: drawCaptures,
    say: say,
    startThinking: startThinking,
    stopThinking: stopThinking,
    pickPromotion: pickPromotion,
    fillTitle: fillTitle,
    fillProfile: fillProfile,
    fillVS: fillVS,
    fillGameHUD: fillGameHUD,
    fillGameOver: fillGameOver,
    rivalMood: rivalMood
  };
})();
