'use strict';
// ---------------------------------------------------------------------------
// The movement model. Momentum, per Evrtek's call: he accelerates, he skids,
// and letting go does not stop him dead.
//
// Everything in here reads from TUNE and nothing in here holds a number of its
// own, so the whole model is tunable from the panel without a reload. That now
// includes the carrier's own size — he is roughly twice the height he was, and
// the exact figure is a slider because it is the kind of thing you only know
// once you have run him past a wall.
// ---------------------------------------------------------------------------

var P = {
  x: 0, y: 0, w: 28, h: 80,
  vx: 0, vy: 0,
  prevX: 0, prevY: 0,
  hitX: 0, hitY: 0,
  grounded: false,
  wasGrounded: false,
  facing: 1,
  coyoteT: 0,
  airJumps: 0,
  cut: true,
  wallDir: 0,
  lastWallDir: 0,
  onWall: false,
  wallCoyoteT: 0,
  wallLockT: 0,
  wallStickT: 0,
  sliding: false,
  crouch: false,
  aimX: 1, aimY: 0,
  tossCd: 0,
  knockT: 0,
  invulnT: 0,
  dropThrough: false,
  safeX: 0, safeY: 0,
  hp: 100, hpMax: 100,
  lives: 3, score: 0, grenades: 0,
  // THE ENVELOPE WEAPON HAS THREE TIERS, not an on/off switch (Evrtek,
  // 2026-09-23: "there should be three levels of the envelope weapon, single
  // envelope, double envelope, triple envelope"). Tier 1 is where everyone
  // starts and it is never lost; THICK raises it by one; a big hit costs ONE
  // tier rather than the whole run of them.
  mailTier: 1, pwExpress: false, ryeT: 0,
  checkX: -1, checkY: -1, onHat: -1,
  gotItem: 0, gotItemT: 0,
  anim: null, fxTossAnim: 0, tossReplay: false,
  hits: 0, thrown: 0, deaths: 0, blasted: 0,
  state: 'air',
  // Feedback the renderer reads and clears.
  fxLand: 0, fxJump: 0, fxWall: 0, fxHurt: 0, fxToss: 0
};

function approach(v, target, delta) {
  if (v < target) return Math.min(v + delta, target);
  if (v > target) return Math.max(v - delta, target);
  return v;
}

function standHeight() { return Math.max(20, TUNE.bodyH | 0); }
function crouchHeight() { return Math.max(16, Math.min(TUNE.crouchH | 0, standHeight() - TS * 0.375)); }

function playerSpawn() {
  P.w = Math.max(12, TUNE.bodyW | 0);
  P.crouch = false;
  P.h = standHeight();
  P.x = World.spawn.x; P.y = World.spawn.y - P.h;
  P.prevX = P.x; P.prevY = P.y;
  P.vx = P.vy = 0;
  P.grounded = false; P.coyoteT = 0; P.airJumps = TUNE.airJumps | 0;
  P.wallDir = P.lastWallDir = 0; P.wallCoyoteT = P.wallLockT = P.wallStickT = 0;
  P.onWall = false; P.tossCd = 0; P.tossReplay = false;
  P.aimX = 1; P.aimY = 0;
  P.knockT = P.invulnT = 0; P.cut = true; P.sliding = false;
  P.safeX = P.x; P.safeY = P.y;
  P.state = 'air';
  P.ryeT = 0; P.gotItemT = 0;
  playerRefill();
  tossClear();
  nadeClear();
}

function playerRefill() {
  P.hpMax = Math.max(1, (TUNE.hpCells | 0) * (TUNE.hpPerCell | 0));
  P.hp = P.hpMax;
}

// Everything a new life starts without. The checkpoint keeps WHERE you are;
// it does not keep what you were carrying, which is the older bargain and the
// one that makes a power-up worth protecting.
function playerStripRun() {
  P.mailTier = 1; P.pwExpress = false; P.ryeT = 0;
  P.grenades = 0;
}

// One door for every kind of damage, so knockback, invincibility frames and the
// death check cannot drift apart between a spike and a dog.
function playerHurt(amount, pushDir) {
  if (P.invulnT > 0 || amount <= 0) return false;
  if (P.ryeT > 0) return false;             // the rye is the whole point of the rye
  // DAMAGE TAKEN as a SUM of HP. P.hits is a COUNT of hits and always has
  // been — a 15 HP dog bite and the 101 HP timeout kill each add 1 to it. Both
  // are worth showing, so both are kept. Clamped because the subtraction below
  // can go past zero and the clock's killing blow is hpMax + 1.
  if (typeof Tally !== 'undefined') Tally.taken += Math.min(amount, Math.max(0, P.hp));
  P.hp -= amount;
  P.vx = pushDir * TUNE.knockX;
  P.vy = -TUNE.knockY;
  P.grounded = false;
  P.knockT = TUNE.knockLock;
  P.invulnT = TUNE.invuln;
  P.cut = true;
  P.hits++;
  P.fxHurt = 1;
  // One big hit costs you what you were carrying. Two cells' worth is
  // deliberately a lot: you lose a power-up to a mistake, not to a graze.
  //
  // THE MAIL TIER COMES DOWN BY ONE, not to nothing (Evrtek, 2026-09-23).
  // Under the old boolean a single hit at triple mail took you back to a bare
  // single envelope, which made the third tier worth about as much as the
  // second and turned two pickups into one mistake. A step down is a cost you
  // can feel and still fight with; a wipe is a punishment you stop risking.
  // It never goes below 1 — tier 1 is the weapon, not a power-up.
  if (amount >= TUNE.pwLoseAt && (P.mailTier > 1 || P.pwExpress ||
      (TUNE.pwLoseGrenades && P.grenades > 0))) {
    P.mailTier = Math.max(1, P.mailTier - 1);
    P.pwExpress = false;
    if (TUNE.pwLoseGrenades) P.grenades = 0;
    puff(P.x + P.w * 0.5, P.y + P.h * 0.4, 0, -220, 14, PAL.itemGlow);
  }
  if (P.hp <= 0) playerDie();
  return true;
}

// ONE death, however it happened. Everything a death costs lives here, so a
// spike, a dog and a bottomless gap cannot drift apart — and they had: a gap
// routed straight to playerRespawn() and cost nothing whatever, not a life, not
// health, not even a counted death.
function playerDie() {
  P.hp = 0;
  P.deaths++;
  P.lives--;
  sfx('die');
  playerStripRun();
  if (P.lives < 0) {
    // THE RUN IS OVER. This used to set the flag and then carry straight on to
    // respawn and refill, so you played on forever with zero lives while the
    // clock sat stopped. Nothing read the flag. The tally is what it was for.
    P.lives = 0;
    if (typeof tallyEnd === 'function') tallyEnd('OUT OF LIVES');
    else { Level.over = true; Level.reason = 'OUT OF LIVES'; }
    return;
  }
  playerRespawn(false);
  playerRefill();
}

// Evrtek, 2026-09-20, having played it: "if you take lethal damage but have not
// hit the checkpoint do you not start back at the beginning of the level, looks
// like you respawn in place."
//
// He was right, and it was not a decision. P.safeX is the last frame he stood
// on solid ground, updated EVERY frame, and it was written for the one case
// that wants it — being picked out of a gap and put back on the edge you walked
// off. Sharing it with the death case meant a death put you down exactly where
// you died: before the checkpoint it cost a life and the power-ups and nothing
// else at all. No ground, no time, no score. The measurement was 0.0 tiles lost
// at every position tested.
//
// `footingOnly` is that old behaviour, kept for the single case that still
// wants it: a free lift out of a gap when pitCostsLife is off. A real death
// never passes it.
function playerRespawn(footingOnly) {
  // No truck on a respawn: the arrival opens a STAGE, it is not a death screen.
  if (P.checkX >= 0) {
    P.x = P.checkX; P.y = P.checkY;            // the checkpoint wins either way
  } else if (footingOnly || !TUNE.deathSendsBack) {
    P.x = P.safeX; P.y = P.safeY;
  } else {
    P.x = World.spawn.x; P.y = World.spawn.y - P.h;
  }
  P.safeX = P.x; P.safeY = P.y;
  P.prevX = P.x; P.prevY = P.y;
  P.vx = P.vy = 0;
  P.knockT = 0; P.invulnT = TUNE.invuln * 0.5;
  P.airJumps = TUNE.airJumps | 0;
  // Or the camera pans a hundred and seventy tiles back to the start, which is
  // a long time to watch. Guarded because the headless checkers load the
  // simulation without the renderer.
  if (typeof camSnap === 'function') camSnap();
}

function hazardPushDir() {
  // Push away from the middle of whichever hazard tile he is actually in.
  var x0 = Math.floor(P.x / TS), x1 = Math.floor((P.x + P.w - 0.001) / TS);
  var y0 = Math.floor(P.y / TS), y1 = Math.floor((P.y + P.h - 0.001) / TS);
  for (var y = y0; y <= y1; y++) {
    for (var x = x0; x <= x1; x++) {
      if (tileAt(x, y) === HAZARD) {
        var cx = x * TS + TS * 0.5;
        var pc = P.x + P.w * 0.5;
        if (Math.abs(pc - cx) < 1) return P.facing > 0 ? -1 : 1;
        return pc < cx ? -1 : 1;
      }
    }
  }
  return 0;
}

// EXPRESS speeds up the throw — the whole throw, pose included, not just the
// rate. If the power-up shortened the cooldown while the animation stayed the
// same length, the animation gate below would simply eat the power-up and
// EXPRESS would do nothing at all.
function tossRate() { return P.pwExpress ? TUNE.expressRate : 1; }

// How long a throw ACTUALLY takes to draw, read from the manifest rather than
// typed in a second time. This is the whole bug Evrtek reported on 2026-09-20:
// carrier.throw is 4 frames at 18 fps, which is 0.222 s, and the rate of fire
// was 0.16 s. A held button re-fired before the arm came back; animPlay ignores
// a request for the clip already playing, so the throw never restarted; and the
// clip does not loop, so it sat on its last frame. Arm out, letters pouring,
// nothing moving.
//
// SPR.clips is populated by the manifest at load, whether or not any art
// exists, so this is safe with an empty art folder and in the headless
// checkers. The fallback is only for a clip removed from the manifest entirely.
function tossAnimSecs() {
  var c = (typeof SPR !== 'undefined' && SPR.clips) ? SPR.clips['carrier.throw'] : null;
  return (c && c.fps > 0) ? c.frames / c.fps : 0.22;
}

// --- Thrown mail -----------------------------------------------------------
// A fixed pool. Nothing is allocated once the game is running.

var TOSS_MAX = 28;
var Toss = { n: 0, a: [] };
(function () {
  for (var i = 0; i < TOSS_MAX; i++)
    Toss.a.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, spin: 0, spinV: 0 });
})();

function tossClear() { Toss.n = 0; }

function tossSpawn(spread) {
  if (Toss.n >= TOSS_MAX) return;
  var m = Toss.a[Toss.n++];
  var ax = P.aimX, ay = P.aimY;
  var ang = Math.atan2(ay, ax) + (spread || 0);
  var sp = TUNE.tossSpeed * (P.pwExpress ? TUNE.expressSpeed : 1);
  // Leave from the hand, not the middle of him, or a throw into a wall he is
  // standing against spawns inside it.
  var inv = (ax && ay) ? 0.70710678 : 1;
  m.x = P.x + P.w * 0.5 + ax * inv * (P.w * 0.5 + TS * 3 / 16);
  m.y = P.y + P.h * (P.crouch ? 0.42 : 0.34) + ay * inv * (TS * 3 / 8);
  m.vx = Math.cos(ang) * sp + P.vx * TUNE.tossInherit;
  m.vy = Math.sin(ang) * sp;
  m.life = TUNE.tossLife;
  m.spin = 0;
  m.spinV = (ax >= 0 ? 1 : -1) * (7 + Math.random() * 4);
  P.thrown++;
}

// THREE TIERS OF THE ENVELOPE WEAPON. One letter, two, or three. THICK raises
// the tier; a big hit lowers it by one; it never leaves 1..MAIL_TIER_MAX.
//
//   1  single    one letter straight down the aim line.
//   2  double    two, fanned ±thickSpread either side of it. Nothing goes down
//                the middle, which is what a double has always felt like.
//   3  triple    the CENTRE LETTER PLUS ±tier3Spread — the aim line is covered
//                and the fan opens WIDER than the double's. Reusing the double's
//                angle here would have put three letters inside the same 15°
//                and the third would have been invisible: the player would see
//                a slightly thicker double rather than a new weapon. A wider
//                fan trades some point-blank damage for reach across a lane,
//                which is the right shape for a top tier — it covers more of
//                the screen rather than simply hitting one thing harder.
var MAIL_TIER_MAX = 3;

function mailTier() { return Math.max(1, Math.min(MAIL_TIER_MAX, P.mailTier | 0)); }

function tossVolley() {
  var t = mailTier();
  if (t >= 3) {
    tossSpawn(0);
    tossSpawn(-TUNE.tier3Spread);
    tossSpawn(TUNE.tier3Spread);
  } else if (t === 2) {
    tossSpawn(-TUNE.thickSpread);
    tossSpawn(TUNE.thickSpread);
  } else {
    tossSpawn(0);
  }
}

function tossKill(i) {
  var last = Toss.a[--Toss.n];
  var dead = Toss.a[i];
  Toss.a[Toss.n] = dead; Toss.a[i] = last;
}

function tossStep(dt) {
  for (var i = 0; i < Toss.n; i++) {
    var m = Toss.a[i];
    m.life -= dt;
    if (m.life <= 0) { tossKill(i); i--; continue; }
    m.vy += TUNE.tossGravity * dt;
    // Sub-stepped so a fast letter cannot pass through a one-tile wall.
    var n = Math.max(1, Math.ceil(Math.max(Math.abs(m.vx), Math.abs(m.vy)) * dt / (TS * 0.5)));
    var hit = false, wall = false;
    for (var s = 0; s < n && !hit; s++) {
      m.x += m.vx * dt / n;
      m.y += m.vy * dt / n;
      var mtx = Math.floor(m.x / TS), mty = Math.floor(m.y / TS);
      var mtv = tileAt(mtx, mty);
      if (mtv === BREAK) { blockHit(mtx, mty, 1); hit = true; }
      else if (isBlocking(mtv)) hit = wall = true;
      else if (foesTakeMail(m.x, m.y, m.vx >= 0 ? 1 : -1)) hit = true;
    }
    m.spin += m.spinV * dt;
    if (hit || m.x < 0 || m.x > World.px || m.y > World.py) {
      if (hit) puff(m.x, m.y, -m.vx * 0.12, -80, 4, PAL.mail);
      // Paper on a wall. A block and an enemy each say their own thing.
      if (wall) sfx('mailHit', m.x, m.y);
      tossKill(i); i--;
    }
  }
}

// --- The package: a thrown, arcing, area weapon ----------------------------
// The second button was the drink; it is the SPECIAL button now, and this is
// what it does. Heavier than mail in every way — it arcs, it takes a moment,
// and it opens walls that letters cannot.

var NADE_MAX = 12;
var Nade = { n: 0, a: [] };
(function () {
  for (var i = 0; i < NADE_MAX; i++)
    Nade.a.push({ x: 0, y: 0, vx: 0, vy: 0, fuse: 0, spin: 0 });
})();

function nadeClear() { Nade.n = 0; }

function nadeThrow() {
  if (P.grenades <= 0 || Nade.n >= NADE_MAX) return false;
  P.grenades--;
  var g = Nade.a[Nade.n++];
  var ax = P.aimX, ay = P.aimY;
  var inv = (ax && ay) ? 0.70710678 : 1;
  g.x = P.x + P.w * 0.5 + ax * inv * (P.w * 0.5 + TS * 0.25);
  g.y = P.y + P.h * 0.32 + ay * inv * (TS * 3 / 8);
  g.vx = ax * inv * TUNE.nadeSpeed + P.vx * 0.3;
  g.vy = ay * inv * TUNE.nadeSpeed - (ay < 0 ? 0 : TS * 7.5);   // a flat throw still lobs
  g.fuse = TUNE.nadeFuse;
  g.spin = 0;
  return true;
}

function nadeKill(i) {
  var last = Nade.a[--Nade.n];
  var dead = Nade.a[i];
  Nade.a[Nade.n] = dead; Nade.a[i] = last;
}

function nadeBoom(x, y) {
  var r = TUNE.nadeRadius, dmg = TUNE.nadeDamage | 0;
  puff(x, y, 0, -80, 22, PAL.blast);
  puff(x, y, 0, 0, 10, PAL.brickDust);
  foesBlast(x, y, r, dmg);
  // Everything breakable inside the circle, not the square.
  var t0 = Math.floor((x - r) / TS), t1 = Math.floor((x + r) / TS);
  var u0 = Math.floor((y - r) / TS), u1 = Math.floor((y + r) / TS);
  for (var ty = u0; ty <= u1; ty++) {
    for (var tx = t0; tx <= t1; tx++) {
      var cx = tx * TS + TS * 0.5 - x, cy = ty * TS + TS * 0.5 - y;
      if (cx * cx + cy * cy <= r * r) blockHit(tx, ty, dmg);
    }
  }
  P.blasted++;
  sfx('blast', x, y);
}

function nadeStep(dt) {
  for (var i = 0; i < Nade.n; i++) {
    var g = Nade.a[i];
    g.fuse -= dt;
    g.vy += TUNE.nadeGravity * dt;
    g.spin += (g.vx >= 0 ? 9 : -9) * dt;
    var steps = Math.max(1, Math.ceil(Math.max(Math.abs(g.vx), Math.abs(g.vy)) * dt / (TS * 0.5)));
    var blew = false;
    for (var s = 0; s < steps && !blew; s++) {
      var nx = g.x + g.vx * dt / steps, ny = g.y + g.vy * dt / steps;
      var tvx = tileAt(Math.floor(nx / TS), Math.floor(g.y / TS));
      if (tvx === BREAK) blew = true;
      else if (isBlocking(tvx)) g.vx = -g.vx * TUNE.nadeBounce;
      else g.x = nx;
      var tvy = tileAt(Math.floor(g.x / TS), Math.floor(ny / TS));
      if (tvy === BREAK) blew = true;
      else if (isBlocking(tvy)) {
        // ON IMPACT, when the tune says so: a package that lands goes off where
        // it lands. It used to bounce and wait out a 1.3 s fuse, by which time
        // whatever it was thrown at had walked away (Evrtek, 2026-09-22: "the
        // special attack doesn't really do much"). The fuse still ends one
        // that never lands.
        if (TUNE.nadeImpact && g.vy > 0) blew = true;
        else { g.vy = -g.vy * TUNE.nadeBounce; g.vx *= 0.8; }
      }
      else g.y = ny;
      if (foesAt(g.x, g.y)) blew = true;
    }
    if (blew || g.fuse <= 0 || g.y > World.py + TS * 5) {
      if (g.y <= World.py + TS * 5) nadeBoom(g.x, g.y);
      nadeKill(i); i--;
    }
  }
}

// --- Step ------------------------------------------------------------------

function playerStep(dt, now) {
  P.prevX = P.x; P.prevY = P.y;
  P.wasGrounded = P.grounded;

  if (P.coyoteT > 0) P.coyoteT -= dt;
  if (P.wallCoyoteT > 0) P.wallCoyoteT -= dt;
  if (P.wallLockT > 0) P.wallLockT -= dt;
  if (P.knockT > 0) P.knockT -= dt;
  if (P.invulnT > 0) P.invulnT -= dt;
  if (P.tossCd > 0) P.tossCd -= dt;
  if (P.ryeT > 0) P.ryeT -= dt;
  if (P.gotItemT > 0) P.gotItemT -= dt;

  inputMerge();
  var ix = Input.x, iy = Input.y;
  // The truck sequence owns him completely; nothing he presses reaches the game.
  if (stageLocksInput()) { ix = 0; iy = 0; }
  if (ix !== 0 && P.knockT <= 0) P.facing = ix;

  // --- Size, crouch, and standing back up --------------------------------
  // Height is a slider, so it can change under him at any moment. Feet stay
  // planted whatever happens: the box grows and shrinks upward.
  P.w = Math.max(12, TUNE.bodyW | 0);
  var standH = standHeight(), crouchH = crouchHeight();

  // Down plus jump drops through a stand-through platform; down alone crouches,
  // and a held direction does not cancel it, because crawling is the whole
  // point of a crouch tunnel.
  P.dropThrough = iy > 0 && Input.jump.held;
  var wantCrouch = P.grounded && iy > 0 && !P.dropThrough;

  if (wantCrouch) P.crouch = true;
  else if (P.crouch) {
    // Only stand up if there is somewhere to put his head.
    var upY = P.y + P.h - standH;
    if (!blockedBox(P.x, upY, P.w, standH)) P.crouch = false;
  }
  var targetH = P.crouch ? crouchH : standH;
  if (P.h !== targetH) { P.y += (P.h - targetH); P.h = targetH; }

  // --- Aim ----------------------------------------------------------------
  // Eight directions, locked to 45 degrees. Crouched, he throws flat — a throw
  // into the floor is no use to anybody.
  if (P.crouch || (ix === 0 && iy === 0)) { P.aimX = P.facing; P.aimY = 0; }
  else { P.aimX = ix; P.aimY = iy; }

  // --- Walls -------------------------------------------------------------
  // Touching a wall is not the same as being on one. You are only ON it if you
  // pressed into it — otherwise running off the end of a ledge glues you to the
  // edge you just left, and the game starts fighting the direction you are
  // holding. That bug is invisible in a screenshot and obvious in the hands.
  P.wallDir = 0;
  if (!P.grounded) {
    if (touchingWall(P, -1)) P.wallDir = -1;
    else if (touchingWall(P, 1)) P.wallDir = 1;
  }

  var stuckToWall = false;
  if (P.wallDir !== 0) {
    if (ix === P.wallDir) {
      P.onWall = true; P.wallStickT = 0;
    } else if (P.onWall) {
      // Holding away does not peel you off instantly.
      P.wallStickT += dt;
      if (P.wallStickT >= TUNE.wallStick) P.onWall = false;
      else if (ix === -P.wallDir) stuckToWall = true;
    }
  } else {
    P.onWall = false; P.wallStickT = 0;
  }
  if (P.onWall) {
    P.lastWallDir = P.wallDir;
    P.wallCoyoteT = TUNE.wallCoyote;
  }

  // --- Horizontal --------------------------------------------------------
  var atApex = !P.grounded && Math.abs(P.vy) < TUNE.apexSpeed;
  var canSteer = P.wallLockT <= 0 && P.knockT <= 0 && !stuckToWall;
  var speedCap = TUNE.maxRun * (P.crouch ? TUNE.crouchSpeed : 1);
  if (canSteer && ix !== 0) {
    var target = ix * speedCap;
    var a;
    if (P.grounded) {
      var reversing = (P.vx !== 0) && ((P.vx > 0) !== (ix > 0));
      a = reversing ? TUNE.turnAccel : TUNE.groundAccel;
    } else {
      a = TUNE.airAccel * (atApex ? TUNE.apexControl : 1);
    }
    P.vx = approach(P.vx, target, a * dt);
  } else if (P.knockT <= 0 && P.wallLockT <= 0) {
    var f = P.grounded ? TUNE.groundFriction : TUNE.airFriction;
    P.vx = approach(P.vx, 0, f * dt);
  }

  // --- Jump --------------------------------------------------------------
  // One buffered press, resolved against ground, then wall, then air. Ground
  // wins when you are standing next to a wall, which is what a player means.
  if (!stageLocksInput() && P.knockT <= 0 && btnBuffered(Input.jump, now, TUNE.jumpBuffer)) {
    if (P.grounded || P.coyoteT > 0) {
      if (!P.dropThrough) {
        P.vy = -TUNE.jumpVel;
        P.grounded = false; P.coyoteT = 0; P.cut = false;
        P.fxJump = 1;
      }
      btnConsume(Input.jump);
    } else if (P.onWall || P.wallCoyoteT > 0) {
      var d = P.onWall ? P.wallDir : P.lastWallDir;
      P.vy = -TUNE.wallJumpY;
      P.vx = -d * TUNE.wallJumpX;
      P.facing = -d;
      P.wallLockT = TUNE.wallLock;
      P.wallCoyoteT = 0; P.wallStickT = 0; P.onWall = false; P.cut = false;
      if (TUNE.wallRefresh) P.airJumps = TUNE.airJumps | 0;
      P.fxWall = 1;
      btnConsume(Input.jump);
    } else if (P.airJumps > 0) {
      if (TUNE.airJumpZero && P.vy > 0) P.vy = 0;
      P.vy = -TUNE.airJumpVel;
      P.airJumps--;
      P.cut = false;
      P.fxJump = 2;
      btnConsume(Input.jump);
    }
  }

  // Variable height: the whole of it is one multiply on release.
  if (!Input.jump.held && P.vy < 0 && !P.cut) {
    P.vy *= TUNE.jumpCut;
    P.cut = true;
  }

  // --- Throw --------------------------------------------------------------
  // Held fires on a cooldown; a fresh press inside the buffer fires at once, so
  // a quick tap never falls between two cooldown ticks and vanishes.
  if (!stageLocksInput() && P.knockT <= 0 && P.tossCd <= 0 &&
      (Input.toss.held || btnBuffered(Input.toss, now, 0.12))) {
    btnConsume(Input.toss);
    tossVolley();
    var tr = tossRate(), ta = tossAnimSecs() / tr;
    // The gate is whichever is longer: the rate of fire you asked for, or the
    // time the throw actually takes to draw. They used to be independent and
    // they disagreed — see tossAnimSecs().
    P.tossCd = TUNE.tossAnimGate ? Math.max(TUNE.tossCooldown / tr, ta)
                                 : TUNE.tossCooldown / tr;
    P.fxToss = 1;
    P.fxTossAnim = ta;
    P.tossReplay = true;        // animPlay dedupes by name; this forces a restart
  }

  // The SPECIAL button. One press, one package — never held down.
  if (!stageLocksInput() && P.knockT <= 0 && btnBuffered(Input.drink, now, 0.12)) {
    btnConsume(Input.drink);
    // fxToss 2, not 1: the puff is the same, but 1 is what tells the sound
    // to play a letter's throw, and a package has its own ('nade').
    if (nadeThrow()) { P.fxToss = 2; sfx('nade'); }
  }

  // --- Gravity -----------------------------------------------------------
  var g = P.vy < 0 ? TUNE.gravity : TUNE.fallGravity;
  if (atApex) g *= TUNE.apexGravity;
  P.vy += g * dt;

  P.sliding = false;
  if (!P.grounded && P.onWall && P.vy > 0) {
    P.sliding = true;
    if (P.vy > TUNE.wallSlide) P.vy = TUNE.wallSlide;
  }
  if (P.vy > TUNE.maxFall) P.vy = TUNE.maxFall;

  // --- Move and resolve --------------------------------------------------
  moveEntity(P, P.vx * dt, P.vy * dt);

  var landed = P.hitY === 1;
  P.grounded = landed;
  if (landed) {
    if (!P.wasGrounded) P.fxLand = 1;
    P.coyoteT = TUNE.coyote;
    P.airJumps = TUNE.airJumps | 0;
    P.cut = true;
  }

  // --- Hazards -----------------------------------------------------------
  if (P.invulnT <= 0 && overlapsHazard(P)) {
    playerHurt(TUNE.hazardDamage, hazardPushDir());
  }

  // Last safe footing, for the respawn that a bottomless gap earns you.
  if (P.grounded && !overlapsHazard(P) && P.knockT <= 0) {
    P.safeX = P.x; P.safeY = P.y - TS * 0.125;
  }
  // Out of the world. This used to call playerRespawn() directly, which meant
  // the three bottomless gaps in level 1 were the safest places in it: no life,
  // no health, not even a counted death, and you were set back on the edge you
  // walked off. It is a death now, and goes through the one door like the rest.
  if (P.y > World.py + TS * 10) {
    if (TUNE.pitCostsLife) playerDie();
    else playerRespawn(true);
  }

  tossStep(dt);
  nadeStep(dt);

  P.state = P.knockT > 0 ? 'knock' : P.crouch ? 'crouch'
    : P.grounded ? 'ground' : P.sliding ? 'slide' : 'air';

  playerAnim(dt);
}

// Which clip the carrier should be playing. One place, so the art and the state
// machine cannot drift: every state the physics can be in has exactly one
// answer here, and the renderer never has to guess.
function playerAnim(dt) {
  if (!P.anim) P.anim = animMake();
  var clip;
  if (P.knockT > 0) clip = 'carrier.hurt';
  // THE WALL SLIDE BEATS THE THROW, and it did not before. A slide is a whole
  // body pressed flat against a wall and a throw is an arm swung away from one;
  // they cannot both be true of the same pixels. With the throw on top and a
  // held button renewing it every frame, hugging a wall and leaning on the
  // button showed a frozen throw pose for the entire descent and the slide was
  // never drawn at all. The letter still leaves — fxToss and the sound are the
  // tell — but what you SEE is what he is doing, which is sliding.
  else if (P.sliding) clip = 'carrier.wallSlide';
  else if (P.fxTossAnim > 0) clip = P.aimY < 0 ? 'carrier.throwUp'
                                 : P.aimY > 0 ? 'carrier.throwDown' : 'carrier.throw';
  else if (!P.grounded) clip = P.vy < 0 ? (P.airJumps < (TUNE.airJumps | 0) ? 'carrier.doubleJump' : 'carrier.jump')
                                        : 'carrier.fall';
  else if (P.crouch) clip = Math.abs(P.vx) > TUNE.maxRun * 0.04 ? 'carrier.crawl' : 'carrier.crouch';
  else if (Math.abs(P.vx) > TUNE.maxRun * 0.55) clip = 'carrier.run';
  else if (Math.abs(P.vx) > TUNE.maxRun * 0.04) clip = 'carrier.walk';
  else clip = 'carrier.idle';
  if (P.fxTossAnim > 0) P.fxTossAnim -= dt;
  // A throw RESTARTS on every throw. animPlay deliberately ignores a request
  // for the clip already playing — which is right for a run cycle and exactly
  // wrong for a one-shot fired twice in a row.
  var isThrow = clip === 'carrier.throw' || clip === 'carrier.throwUp' || clip === 'carrier.throwDown';
  animPlay(P.anim, clip, isThrow && P.tossReplay);
  P.tossReplay = false;
  // Stepped at the express rate so the pose keeps pace with the rate of fire.
  animStep(P.anim, isThrow ? dt * tossRate() : dt);
}
