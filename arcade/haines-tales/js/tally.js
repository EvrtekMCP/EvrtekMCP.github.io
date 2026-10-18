'use strict';
// ---------------------------------------------------------------------------
// The end-of-level tally.
//
// Evrtek: "the level should end with a tally of how you did, enemies defeated,
// secrets found, things collected, out of the max possible, damage taken,
// damage dealt etc. And a button to try again."
//
// Two things had to exist before this one could. The first is a set of honest
// counters: of the seven rows he named, exactly ONE (deaths) was already a
// usable number and one (P.hits) was the wrong number wearing the right name —
// a COUNT of hits, not a sum of HP. The rest did not exist at all.
//
// The second is a consumer for Level.over. It was set in two places and read by
// nobody: running out of lives left the flag true, the clock stopped, and you
// carried on playing forever on zero lives. This screen is what that flag was
// always for, and it has to handle BOTH endings — the win and the loss.
//
// EVERY COUNTER LIVES HERE, in one object with one reset, because the ones that
// already existed taught the lesson the hard way: P.hits, P.thrown, P.deaths
// and P.blasted are initialised once in player.js's object literal and then
// never touched again — not by playerSpawn, not by playerRespawn, not by
// levelReset, not by the restart hook. A second run reported the first run's
// numbers added on top of its own, and had done since the day they were added.
//
// THE DENOMINATORS ARE SNAPSHOTTED AT BUILD TIME and never derived at the end,
// because the level eats its own evidence as you play it: blockHit() sets the
// tile EMPTY and then `delete World.drops[i]`, so counting the secrets when the
// level is over counts the ones you MISSED.
// ---------------------------------------------------------------------------

var Tally = {
  open: false, reason: '', t: 0,
  // counted during the run
  kills: 0, items: 0, blocks: 0, secrets: 0, dealt: 0, taken: 0,
  // snapshotted when the level is built
  maxKills: 0, maxItems: 0, maxBlocks: 0, maxSecrets: 0, maxDealt: 0,
  startClock: 0, elapsed: 0
};

// Called at the end of buildLevel1(), while the level is still pristine.
function tallySnapshot() {
  var i, n = World.w * World.h;
  Tally.maxKills = World.foes.length;
  var blocks = 0;
  for (i = 0; i < n; i++) if (World.t[i] === BREAK) blocks++;
  Tally.maxBlocks = blocks;
  // A "secret" is a breakable with something inside it. NOT every breakable:
  // two of the eleven in level 1 are the depot roller door and hold nothing, so
  // showing 11 would send the player hunting for two prizes that do not exist.
  var secrets = 0;
  for (var k in World.drops) if (World.drops[k] !== undefined) secrets++;
  Tally.maxSecrets = secrets;
  // Everything obtainable: placed in the level, sealed in a block, or carried
  // by a drone that has to be shot down for it.
  var carried = 0;
  for (i = 0; i < World.foes.length; i++) if (World.foes[i].carry !== undefined && World.foes[i].carry !== null) carried++;
  Tally.maxItems = World.items.length + secrets + carried;
  // Total enemy HP, with the boss counted once per phase. A FLOOR rather than a
  // cap: the Postmaster summons dogs, and a summoned dog can be killed for more
  // damage than this. Read live from TUNE so a slider move cannot rot it.
  var dealt = 0;
  for (i = 0; i < World.foes.length; i++) {
    var kind = World.foes[i].kind;
    dealt += foeMaxHp(kind) * (kind === FOE_BOSS ? 3 : 1);
  }
  Tally.maxDealt = dealt;
}

// One reset, and TRY AGAIN is the only thing that calls it.
function tallyReset() {
  Tally.open = false; Tally.reason = ''; Tally.t = 0;
  Tally.kills = 0; Tally.items = 0; Tally.blocks = 0;
  Tally.secrets = 0; Tally.dealt = 0; Tally.taken = 0;
  Tally.elapsed = 0;
  P.hits = 0; P.thrown = 0; P.deaths = 0; P.blasted = 0;   // the four that never reset
}

// The level has ended, once. Guarded because OUT OF LIVES fires from inside
// playerHurt and the old code carried straight on to respawn and refill.
function tallyEnd(reason) {
  if (Tally.open) return;
  Tally.open = true;
  Tally.reason = reason;
  Tally.t = 0;
  Level.over = true;
  Level.reason = reason;
  // Elapsed is accumulated, NOT computed as levelTime - Level.time: running out
  // of time costs a life and sets the clock BACK to full (world.js), leaving no
  // trace, so a run that timed out twice would report as the fastest of the day.
}

function tallyActive() { return Tally.open; }

// ---------------------------------------------------------------------------
// The rows. Value, maximum, and how to say it.
// ---------------------------------------------------------------------------
function tallyRows() {
  var pct = function (a, b) { return b > 0 ? Math.round(Math.min(1, a / b) * 100) : 0; };
  var cap = function (a, b) { return Math.min(a, b); };
  return [
    { k: 'ENEMIES DEFEATED', v: cap(Tally.kills, Tally.maxKills), m: Tally.maxKills },
    { k: 'SECRETS FOUND', v: cap(Tally.secrets, Tally.maxSecrets), m: Tally.maxSecrets },
    { k: 'MAIL COLLECTED', v: cap(Tally.items, Tally.maxItems), m: Tally.maxItems },
    { k: 'BLOCKS BROKEN', v: cap(Tally.blocks, Tally.maxBlocks), m: Tally.maxBlocks },
    { k: 'DAMAGE DEALT', v: pct(Tally.dealt, Tally.maxDealt), m: -1, suffix: '%' },
    { k: 'DAMAGE TAKEN', v: Tally.taken, m: -1, suffix: ' HP' },
    { k: 'TIMES DOWN', v: P.deaths, m: -1 },
    { k: 'TIME', v: Tally.elapsed, m: -1, time: true },
    // Evrtek: the score belongs here and does NOT count up like the rest. It is
    // the sum of everything above rather than another measurement of it, so it
    // arrives whole, below the rule, at the size that says so.
    { k: 'SCORE', v: P.score, m: -1, still: true, big: true }
  ];
}

// A grade, from the things the player chose to do rather than the things that
// happened to them.
//
// FINISHING IS THE FLOOR, and it has to be. The first version made completion
// the whole score and graded the fight-everything bot an E — 18 of 43 enemies,
// no deaths, level finished, bottom mark. That curve assumed near-total
// collection was the normal case, and the measured reality is that a bot which
// holds right gets 17% of the content and one that fights everything in reach
// gets 37%. A player who gets to the end deserves a middling grade for it; the
// collection lifts them off that floor, and damage and deaths tax them.
//
// Calibrated against the two bots and the two extremes:
//   hold right, 3 deaths, 553 HP   ->  D
//   fight everything, no deaths    ->  C
//   everything, untouched          ->  S
//   nothing, out of lives          ->  E
function tallyGrade() {
  var got = Tally.kills + Tally.secrets + Tally.items + Tally.blocks;
  var max = Tally.maxKills + Tally.maxSecrets + Tally.maxItems + Tally.maxBlocks;
  var done = max > 0 ? Math.min(1, got / max) : 0;
  var hurt = Math.min(1, Tally.taken / Math.max(1, P.hpMax * 3));
  var s = (Tally.reason === 'DELIVERED' ? 40 : 0) + done * 55 - hurt * 15 - P.deaths * 4;
  return s >= 90 ? 'S' : s >= 75 ? 'A' : s >= 60 ? 'B' : s >= 45 ? 'C' : s >= 25 ? 'D' : 'E';
}

function tallyClock(secs) {
  var m = Math.floor(secs / 60), s = Math.floor(secs % 60);
  return m + ':' + ('0' + s).slice(-2);
}

// ---------------------------------------------------------------------------
// Drawing. On the UI canvas, AFTER the HUD, in CSS pixels — the same surface
// and the same units the HUD uses, so it is crisp on a phone rather than
// upscaled with the backbuffer.
// ---------------------------------------------------------------------------
// THE WHOLE SCREEN POPULATES IN UNDER FIVE SECONDS, which is Evrtek's number
// and is the constraint the rest of this is derived from rather than a target
// it happens to meet. At 60 Hz that is 300 frames, and the budget is spent:
//
//   panel arrives                     14
//   8 counting rows at 28 each       224     label in, then the number counts
//   the score, whole, no count        16
//   the grade                         18
//   the button                        10
//                                    ---
//                                     282 frames = 4.70 s
//
// A row takes the same time whether it is counting to 9 or to 553 — the number
// steps faster, the rhythm does not change. A duration that scaled with the
// value would make DAMAGE TAKEN the longest line on the screen, which is the
// opposite of what it deserves.
var TALLY_IN = 14;          // panel arrives
var TALLY_LBL = 6;          // label lands, before its number starts moving
var TALLY_CNT = 20;         // the count itself
var TALLY_GAP = 2;          // a beat before the next row
var TALLY_ROW = TALLY_LBL + TALLY_CNT + TALLY_GAP;     // 28
var TALLY_STILL = 16;       // a row that does not count (the score)
var TALLY_GRADE = 18;
var TALLY_TICK = 2;         // a tick every other frame while a row counts
var TALLY_BTN = { x: 0, y: 0, w: 0, h: 0 };

// When each row STARTS, in frames from the panel opening. Counting rows take
// TALLY_ROW; a still one takes TALLY_STILL.
function tallyRowStart(i, rows) {
  var t = TALLY_IN;
  for (var k = 0; k < i; k++) t += rows[k].still ? TALLY_STILL : TALLY_ROW;
  return t;
}
function tallyTotal(rows) {
  return tallyRowStart(rows.length, rows) + TALLY_GRADE;
}

// 0 = not started, 1 = fully counted. The label is in before this moves.
function tallyRowProgress(i, rows) {
  var st = tallyRowStart(i, rows);
  if (Tally.t < st) return -1;                       // not on screen at all
  if (rows[i].still) return Tally.t >= st + TALLY_STILL ? 1 : 0;
  var c = (Tally.t - st - TALLY_LBL) / TALLY_CNT;
  return Math.max(0, Math.min(1, c));
}

function tallyStep() {
  if (!Tally.open) return;
  Tally.t++;
  var rows = tallyRows();
  // The ticker, and the full stop at the end of each row.
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].still) continue;
    var st = tallyRowStart(i, rows);
    var into = Tally.t - st - TALLY_LBL;
    if (into > 0 && into < TALLY_CNT) {
      if (into % TALLY_TICK === 0 && tallyRowValue(i, rows) > 0) sfx('tallyTick');
    } else if (into === TALLY_CNT) {
      sfx('tallyRow');
    }
  }
  if (Tally.t === tallyRowStart(rows.length, rows) + TALLY_GRADE) sfx('tallyGrade');
}

// What a row reads RIGHT NOW: its final value scaled by how far it has counted.
// Time counts in whole seconds, everything else in whole units.
function tallyRowValue(i, rows) {
  var r = rows[i], pr = tallyRowProgress(i, rows);
  if (pr < 0) return 0;
  if (r.still) return r.v;
  return r.time ? r.v * pr : Math.round(r.v * pr);
}

function tallyShownRows() {
  var rows = tallyRows(), n = 0;
  for (var i = 0; i < rows.length; i++) if (Tally.t >= tallyRowStart(i, rows)) n++;
  return n;
}
function tallyGradeIn() { return Tally.t >= tallyRows().length && Tally.t >= tallyRowStart(tallyRows().length, tallyRows()); }
function tallyDone() { return Tally.t >= tallyTotal(tallyRows()); }

// A press: skip the count-up if it is still running, otherwise TRY AGAIN.
function tallyPress() {
  if (!Tally.open) return false;
  if (!tallyDone()) { Tally.t = tallyTotal(tallyRows()); sfx('menu'); return true; }
  sfx('start');
  tallyRestart();
  return true;
}

// TRY AGAIN. This REBUILDS THE LEVEL, and it has to.
//
// The restart hook in main.js resets the entities and not the world, which is
// correct for its own job and wrong for this one: blockHit() sets a broken tile
// EMPTY and DELETES the item sealed inside it, so a second run through the old
// hook starts with every block already broken and nine collectibles gone for
// good. Measured, not assumed.
function tallyRestart() {
  Tally.open = false;
  // Whichever world is up — the level that was loaded, at the tile it was
  // started from, or the sandbox. levelRebuild() is the one thing that knows.
  levelRebuild();         // the world itself, blocks and drops restored
  levelReset();
  playerSpawn();
  P.lives = TUNE.startLives | 0;
  P.score = 0;
  P.checkX = -1; P.checkY = -1;
  // A WIN leaves the power-ups on: playerStripRun only runs from playerDie, so
  // the DELIVERED path would hand run two a free THICK and EXPRESS.
  playerStripRun();
  tallyReset();
  foesReset(); itemsReset(); checkReset(false);
  stageBegin();
  if (typeof camSnap === 'function') camSnap();
}

function tallyDraw(c) {
  if (!Tally.open) return;
  var W = Fit.cssW, H = Fit.cssH;
  var win = Tally.reason === 'DELIVERED';
  var a = Math.min(1, Tally.t / TALLY_IN);

  c.save();
  c.globalAlpha = a * 0.82;
  c.fillStyle = '#0b0f19';
  c.fillRect(0, 0, W, H);
  c.globalAlpha = 1;

  var pad = Math.max(14, Math.round(H * 0.035));
  var pw = Math.min(Math.round(W * 0.78), Math.round(H * 1.25));
  var ph = Math.round(H * 0.84);
  var px = Math.round((W - pw) * 0.5);
  var py = Math.round((H - ph) * 0.5) + Math.round((1 - a) * H * 0.06);

  c.globalAlpha = a;
  c.fillStyle = '#141c2b';
  c.fillRect(px, py, pw, ph);
  c.fillStyle = win ? '#e2b04e' : '#c2506b';
  c.fillRect(px, py, pw, Math.max(3, Math.round(ph * 0.012)));

  var f = Math.max(11, Math.round(ph * 0.042));
  c.textBaseline = 'middle';

  // Heading. The two endings say different things and look different.
  c.font = '700 ' + Math.round(f * 1.5) + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
  c.fillStyle = win ? '#e2b04e' : '#c2506b';
  c.textAlign = 'center';
  c.fillText(win ? 'DELIVERED' : Tally.reason, px + pw * 0.5, py + pad + f);

  var rows = tallyRows();
  var y = py + pad + f * 3.1;
  var lh = (ph - (y - py) - pad * 3.4) / (rows.length + 1);

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var pr = tallyRowProgress(i, rows);
    if (pr < 0) { y += lh; continue; }              // not on screen yet
    var v = tallyRowValue(i, rows);
    var counting = !r.still && pr < 1;

    // SCORE gets a rule above it and its own weight. It is the sum of the rows
    // rather than another one of them, and it arrives whole.
    if (r.big) {
      c.globalAlpha = a * 0.35;
      c.fillStyle = '#7e8aa3';
      c.fillRect(px + pad * 1.4, Math.round(y - lh * 0.52), pw - pad * 2.8, 1);
      c.globalAlpha = a;
    }

    var fs2 = r.big ? Math.round(f * 1.25) : f;
    c.font = '700 ' + fs2 + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
    c.textAlign = 'left';
    c.fillStyle = r.big ? '#c9c2b4' : '#7e8aa3';
    c.fillText(r.k, px + pad * 1.4, y);

    var txt;
    if (r.time) txt = tallyClock(v);
    else if (r.m >= 0) txt = v + ' / ' + r.m;
    else txt = v + (r.suffix || '');

    c.textAlign = 'right';
    // Still counting: dimmer, so the eye knows the number is not final yet.
    // Landed on its maximum: green, because a maximum is worth saying out loud.
    if (counting) c.fillStyle = '#b9b2a4';
    else if (r.m >= 0 && v >= r.m && r.m > 0) c.fillStyle = '#9fe8b0';
    else c.fillStyle = r.big ? '#e2b04e' : '#e6e1d3';
    c.fillText(txt, px + pw - pad * 1.4, y);
    y += lh;
  }

  // The grade lands last, after every row has finished counting.
  if (tallyGradeIn()) {
    c.textAlign = 'center';
    c.font = '700 ' + Math.round(f * 2.4) + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
    c.fillStyle = '#e2b04e';
    c.fillText(tallyGrade(), px + pw * 0.5, y + f * 0.35);
  }

  // TRY AGAIN. Drawn, not a DOM button — installKeyboard gives up Space and the
  // arrow keys while a real <button> has focus, so one would quietly eat half
  // the controls for the rest of the session.
  if (tallyDone()) {
    var bw = Math.round(pw * 0.52), bh = Math.round(f * 2.4);
    var bx2 = Math.round(px + (pw - bw) * 0.5), by2 = Math.round(py + ph - pad - bh);
    TALLY_BTN.x = bx2; TALLY_BTN.y = by2; TALLY_BTN.w = bw; TALLY_BTN.h = bh;
    var pulse = ((Tally.t >> 5) & 1) === 0;
    c.fillStyle = pulse ? '#e2b04e' : '#8a6a2d';
    c.fillRect(bx2, by2, bw, bh);
    c.fillStyle = '#141c2b';
    c.font = '700 ' + Math.round(f * 1.05) + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
    c.textAlign = 'center';
    c.fillText('TRY AGAIN', bx2 + bw * 0.5, by2 + bh * 0.5 + 1);
  } else {
    TALLY_BTN.w = 0;
  }
  c.restore();
}

// Did a tap land on the button? In CSS pixels, the same space tallyDraw uses.
function tallyHit(cssX, cssY) {
  if (!Tally.open || TALLY_BTN.w <= 0) return false;
  return cssX >= TALLY_BTN.x && cssX <= TALLY_BTN.x + TALLY_BTN.w &&
         cssY >= TALLY_BTN.y && cssY <= TALLY_BTN.y + TALLY_BTN.h;
}
