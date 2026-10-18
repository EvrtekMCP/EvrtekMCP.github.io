'use strict';
// ---------------------------------------------------------------------------
// Everything that wants to stop the mail.
//
// One pool, one step, one damage door. Six kinds so far, and each of them is a
// different QUESTION rather than a different amount of health:
//
//   DOG     chases on sight and leaps.            Answer: keep moving.
//   BOX     swallows a letter and spits it back.  Answer: time the mouth.
//   DRONE   dives, and carries the reward.        Answer: aim up, then move.
//   GNOME   is scenery until it is not.           Answer: look before you walk.
//   PANDA   shields its front with a bin lid.     Answer: get behind it.
//   BOSS    three phases of the above.            Answer: all of it.
//
// They share swept collision with the carrier, so they fall off the same ledges
// and stop on the same walls.
// ---------------------------------------------------------------------------

var FOE_DOG = 0, FOE_BOX = 1, FOE_DRONE = 2, FOE_GNOME = 3, FOE_PANDA = 4, FOE_BOSS = 5;
var FOE_NAME = ['DOG', 'MAILBOX BOT', 'DRONE', 'GNOME', 'TRASH PANDA', 'THE POSTMASTER'];

var FOE_MAX = 72;    // World 1-1 places 43, and the boss raises more
var Foes = { n: 0, a: [] };
(function () {
  for (var i = 0; i < FOE_MAX; i++)
    Foes.a.push({
      kind: 0,
      x: 0, y: 0, w: 44, h: 32, vx: 0, vy: 0,
      hitX: 0, hitY: 0, dropThrough: false,
      homeX: 0, homeY: 0, faceHome: -1,
      grounded: false, wasGrounded: false, facing: -1,
      hp: 3, maxHp: 3, alive: true, deadT: 0, hurtT: 0,
      seen: false, forgetT: 0, awake: false,
      s0: 0, s1: 0, t0: 0, t1: 0,
      carry: -1, shield: 0, phase: 0, flash: 0,
      vt: 0, vs: 0,                  // its voice: a timer, and which tell it last gave
      anim: null
    });
})();

// Enemy fire. Nothing here belongs to the player, so it lives in its own pool
// and only ever damages him.
var SHOT_MAX = 28;
var Shots = { n: 0, a: [] };
(function () {
  for (var i = 0; i < SHOT_MAX; i++)
    Shots.a.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, kind: 0, spin: 0 });
})();

function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// A straight line between two points, sampled every half tile. Half a tile is
// fine because nothing in the world is thinner than a whole one.
function hasLineOfSight(ax, ay, bx2, by2) {
  var dx = bx2 - ax, dy = by2 - ay;
  var dist = Math.sqrt(dx * dx + dy * dy);
  var steps = Math.ceil(dist / (TS * 0.5));
  for (var i = 1; i < steps; i++) {
    var t = i / steps;
    if (isBlocking(tileAt(Math.floor((ax + dx * t) / TS), Math.floor((ay + dy * t) / TS))))
      return false;
  }
  return true;
}

// --- Size, health and menace, per kind -------------------------------------

function foeSize(kind, f) {
  switch (kind) {
    // WORLD PIXELS. These scale with TS — the dog takes its size from TUNE
    // (dogW/dogH) and so scaled automatically; these five did not, and a boss
    // 34 px wide under a carrier that had just become 28 px wide left no hat to
    // stand on. If the tile size changes again, these change with it.
    case FOE_DOG:   f.w = Math.max(TS * 0.5, TUNE.dogW | 0); f.h = Math.max(TS * 0.375, TUNE.dogH | 0); break;
    case FOE_BOX:   f.w = TS * 1.25; f.h = TS * 2.125; break;
    case FOE_DRONE: f.w = TS * 1.375; f.h = TS * 0.875; break;
    case FOE_GNOME: f.w = TS; f.h = TS * 1.375; break;
    case FOE_PANDA: f.w = TS * 1.5; f.h = TS * 1.25; break;
    default:        f.w = TS * 2.125; f.h = TS * 3.25; break;
  }
}

function foeMaxHp(kind) {
  switch (kind) {
    case FOE_DOG:   return TUNE.dogHp | 0;
    case FOE_BOX:   return TUNE.boxHp | 0;
    case FOE_DRONE: return TUNE.droneHp | 0;
    case FOE_GNOME: return TUNE.gnomeHp | 0;
    case FOE_PANDA: return TUNE.pandaHp | 0;
    default:        return TUNE.bossHp | 0;
  }
}

function foeTouchDamage(kind) {
  switch (kind) {
    case FOE_DOG:   return TUNE.dogTouch | 0;
    case FOE_BOX:   return TUNE.boxTouch | 0;
    case FOE_DRONE: return TUNE.droneTouch | 0;
    case FOE_GNOME: return TUNE.gnomeTouch | 0;
    case FOE_PANDA: return TUNE.pandaTouch | 0;
    default:        return TUNE.bossTouch | 0;
  }
}

function foeScore(kind) {
  return (TUNE.scoreDog | 0) * (kind === FOE_BOSS ? 25 : kind === FOE_PANDA ? 2 : 1);
}

// --- Placing and reviving --------------------------------------------------

function foePlace(f, spec) {
  f.kind = spec.kind | 0;
  foeSize(f.kind, f);
  f.homeX = spec.tx * TS;
  f.homeY = spec.ty * TS - f.h;
  f.faceHome = spec.face || -1;
  f.leash = spec.leash ? spec.leash * TS : 0;               // 0: the tuned default
  f.summoned = false;                                    // a placed enemy is the level's, not the boss's
  f.carry = (spec.carry === undefined || spec.carry === null) ? -1 : spec.carry;
  foeRevive(f);
}

function foeRevive(f) {
  foeSize(f.kind, f);
  f.x = f.homeX; f.y = f.homeY;
  f.vx = f.vy = 0;
  f.grounded = false; f.wasGrounded = false;
  f.facing = f.faceHome;
  f.maxHp = Math.max(1, foeMaxHp(f.kind));
  f.hp = f.maxHp;
  f.alive = true; f.deadT = 0; f.hurtT = 0; f.flash = 0;
  f.seen = false; f.forgetT = 0; f.awake = false;
  f.s0 = 0; f.s1 = 0; f.s2 = 0; f.t0 = 0; f.t1 = 0; f.t2 = 0;
  f.shield = 0; f.phase = 0; f.bombs = 0; f.dropThrough = false;
  f.vt = 0; f.vs = 0;
}

// A sound from this enemy, from where it is: panned to its side of the screen,
// quieter past the edge, and not played at all from further than that
// (audio.js, rule 3). Every enemy sound goes through here.
function foeSound(f, name) { sfx(name, f.x + f.w * 0.5, f.y + f.h * 0.5); }

function foesReset() {
  Foes.n = 0;
  Shots.n = 0;
  for (var i = 0; i < World.foes.length && i < FOE_MAX; i++)
    foePlace(Foes.a[Foes.n++], World.foes[i]);
  for (var b = 0; b < World.bins.length; b++) World.bins[b].lid = true;
  arenaReset();
}

// --- Damage ----------------------------------------------------------------

// `dirX` is the direction the hit is TRAVELLING. The panda's lid only covers
// the way it is facing, so a hit travelling the same way it faces has come from
// behind it — and that is the whole enemy.
function foeHurt(f, amount, dirX) {
  if (!f.alive || amount <= 0) return false;

  if (f.kind === FOE_BOX && f.s0 === 0) return false;   // shut: it just eats things
  if (f.kind === FOE_BOSS && !f.s1) return false;       // not yet in the fight
  if (f.kind === FOE_GNOME && f.s0 === 0) gnomeWake(f); // hitting a statue wakes it

  if (f.shield > 0 && dirX !== 0 && dirX === -f.facing) {
    f.shield -= 1;                                      // the lid took it
    f.hurtT = TUNE.foeHurt;
    puff(f.x + f.w * 0.5, f.y + f.h * 0.4, -dirX * 80, -60, 5, PAL.lid);
    foeSound(f, 'lidBlock');                            // TINK: that did nothing, get behind it
    return false;
  }

  // DAMAGE DEALT, clamped to what was actually there. A 3-damage package on a
  // 1 HP drone removes 1, not 3, and counting the 3 would push the row past its
  // own maximum. This line is below the shut-bot, pre-gate and lid returns on
  // purpose: those deal nothing.
  if (typeof Tally !== 'undefined') Tally.dealt += Math.min(amount, Math.max(0, f.hp));
  f.hp -= amount;
  f.hurtT = TUNE.foeHurt;
  f.flash = 1;
  if (f.kind !== FOE_BOSS && f.kind !== FOE_BOX) {
    f.vx = dirX * TUNE.dogKnock;
    f.vy = -140;
    f.grounded = false;
  }
  f.seen = true;
  f.forgetT = TUNE.dogForget;

  if (f.hp <= 0) {
    if (f.kind === FOE_BOSS && f.phase < 2) {
      // A phase, not a life. He picks himself up and changes how he fights.
      f.phase++;
      f.hp = f.maxHp;
      f.t0 = TUNE.bossPhaseGap;
      f.s0 = 0;
      sfx('bossPhase');
      puff(f.x + f.w * 0.5, f.y + f.h * 0.5, 0, -240, 20, PAL.itemGlow);
      return true;
    }
    f.alive = false;
    // ONE KILL, at the kill. The boss's phase changes return above this line
    // with his HP refilled, so anything hung on the `hp <= 0` test counts the
    // Postmaster three times.
    if (typeof Tally !== 'undefined') Tally.kills++;
    f.deadT = TUNE.dogRespawn;
    P.score += foeScore(f.kind);
    if (f.kind === FOE_BOSS) sfx('bossDie');            // his, wherever the camera is
    else foeSound(f, 'foeDie');
    if (f.kind === FOE_BOSS) {
      bossClearField(); musicStop();                    // the field clears; the truck comes back
      if (typeof musicSting === 'function') musicSting('victory');
      stageFinish();
    }
    puff(f.x + f.w * 0.5, f.y + f.h * 0.5, dirX * 80, -140, 14, PAL.dogBody);
    if (f.carry >= 0) {                                 // the drone's whole point
      itemSpawn(f.x + f.w * 0.5 - 14, f.y + f.h * 0.5, f.carry, true);
      f.carry = -1;
    }
  } else {
    puff(f.x + f.w * 0.5, f.y + f.h * 0.4, dirX * 40, -60, 4, PAL.dogBody);
    foeSound(f, f.kind === FOE_BOSS ? 'bossHit' : 'foeHit');
  }
  return true;
}

// --- Enemy fire ------------------------------------------------------------

function shotFire(x, y, vx, vy, kind) {
  if (Shots.n >= SHOT_MAX) return;
  var s = Shots.a[Shots.n++];
  s.x = x; s.y = y; s.vx = vx; s.vy = vy;
  s.life = TUNE.shotLife; s.kind = kind || 0; s.spin = 0;
}

function shotKill(i) {
  var last = Shots.a[--Shots.n];
  var dead = Shots.a[i];
  Shots.a[Shots.n] = dead; Shots.a[i] = last;
}

function shotsStep(dt) {
  for (var i = 0; i < Shots.n; i++) {
    var s = Shots.a[i];
    s.life -= dt;
    s.spin += 9 * dt;
    if (s.kind === 1) s.vy += TUNE.shotGravity * dt;      // a dropped bomb
    var n = Math.max(1, Math.ceil(Math.max(Math.abs(s.vx), Math.abs(s.vy)) * dt / (TS * 0.5)));
    var gone = s.life <= 0, landed = false;
    for (var k = 0; k < n && !gone; k++) {
      s.x += s.vx * dt / n;
      s.y += s.vy * dt / n;
      if (isBlocking(tileAt(Math.floor(s.x / TS), Math.floor(s.y / TS)))) { gone = true; landed = s.kind === 1; }
    }
    if (landed) bossBombLanded(s);            // a bomb on the ground: every Nth is a bot
    if (!gone && P.invulnT <= 0 && P.ryeT <= 0 &&
        s.x + TS * 0.25 >= P.x && s.x - TS * 0.25 <= P.x + P.w && s.y + TS * 0.25 >= P.y && s.y - TS * 0.25 <= P.y + P.h) {
      playerHurt(TUNE.shotDamage, s.vx >= 0 ? 1 : -1);
      gone = true;
    }
    if (gone || s.x < 0 || s.x > World.px || s.y > World.py) {
      puff(s.x, s.y, 0, -60, 3, PAL.mail);
      shotKill(i); i--;
    }
  }
}

// --- The dog: chases on sight, and leaps -----------------------------------

function foeSees(f, range) {
  var px = P.x + P.w * 0.5, py = P.y + P.h * 0.5;
  var ex = f.x + f.w * 0.5, ey = f.y + f.h * 0.35;
  var dx = px - ex, dy = py - ey;
  if (Math.abs(dx) > range) return false;
  if (Math.abs(dy) > range * 0.7) return false;
  if (dx * f.facing < 0 && Math.abs(dx) > TS * 3) return false;
  return hasLineOfSight(ex, ey, px, py);
}

function stepDog(f, dt) {
  var was = f.seen;
  if (foeSees(f, TUNE.dogSight)) { f.seen = true; f.forgetT = TUNE.dogForget; }
  else if (f.seen) { f.forgetT -= dt; if (f.forgetT <= 0) f.seen = false; }

  // ITS VOICE (0.10.0, Evrtek: "the enemies don't make any noise"). A bark
  // the moment it notices you, and again every two or three seconds while it
  // chases; a snarl and a snap on a leap from close enough to land on you,
  // which is the one to jump at. vt is the timer for both, so a dog at your
  // heels snaps at most every second and barks between.
  if (f.vt > 0) f.vt -= dt;
  if (f.seen && !was) { foeSound(f, 'dogBark'); f.vt = 2 + Math.random(); }

  if (f.grounded) {
    f.vx = 0;
    if (f.seen && f.hurtT <= 0) {
      f.t0 -= dt;
      if (f.t0 <= 0) {
        var dir = (P.x + P.w * 0.5) > (f.x + f.w * 0.5) ? 1 : -1;
        f.facing = dir;
        f.vx = dir * TUNE.dogSpeed;
        f.vy = -TUNE.dogLeap;
        f.t0 = TUNE.dogPause;
        if (Math.abs((P.x + P.w * 0.5) - (f.x + f.w * 0.5)) < TS * 4 && f.vt <= 1.1) {
          foeSound(f, 'dogSnap'); f.vt = 2;
        } else if (f.vt <= 0) { foeSound(f, 'dogBark'); f.vt = 2 + Math.random(); }
      }
    } else {
      f.t0 = TUNE.dogPause * 0.5;
    }
  }
  foeGravity(f, dt, TUNE.dogGravity);
}

// --- The mailbox bot: swallow, chew, spit ----------------------------------
// s0: 0 shut and invulnerable, 1 chewing and open, 2 recovering and open.

function stepBox(f, dt) {
  // It walks. Slowly, and only when it has seen you — a mailbox on legs closing
  // the distance while you work out its timing is the whole of the pressure.
  var openNow = f.s0 !== 0;
  if (foeSees(f, TUNE.boxSight)) { f.seen = true; f.forgetT = TUNE.dogForget; }
  else if (f.seen) { f.forgetT -= dt; if (f.forgetT <= 0) f.seen = false; }

  if (f.seen && !openNow && f.hurtT <= 0) {
    var dir = (P.x + P.w * 0.5) > (f.x + f.w * 0.5) ? 1 : -1;
    f.facing = dir;
    f.vx = dir * TUNE.boxSpeed;
    f.t1 += dt;                        // the waddle, for the legs to read from
  } else {
    f.vx = 0;                          // it plants itself to chew
  }
  f.t0 -= dt;
  // CHEWING, out loud: a chomp every 0.3 s while the mouth is open (hit it
  // now), then the windup a third of a second before the spit (move).
  if (f.s0 === 1) {
    if (f.vt > 0) f.vt -= dt;
    if (f.t0 > 0.34) { if (f.vt <= 0) { foeSound(f, 'boxChomp'); f.vt = 0.3; } }
    else if (!f.vs) { f.vs = 1; foeSound(f, 'boxWindup'); }
  }
  if (f.s0 === 1 && f.t0 <= 0) {
    // Spit it back, hard, at wherever he is standing now.
    var ex = f.x + f.w * 0.5, ey = f.y + f.h * 0.265;
    var dx = (P.x + P.w * 0.5) - ex, dy = (P.y + P.h * 0.4) - ey;
    var d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    f.facing = dx >= 0 ? 1 : -1;
    shotFire(ex + f.facing * f.w * 0.45, ey, dx / d * TUNE.boxSpit, dy / d * TUNE.boxSpit, 0);
    f.s0 = 2;
    f.t0 = TUNE.boxRecover;
    f.vs = 0;
    foeSound(f, 'boxSpit');
  } else if (f.s0 === 2 && f.t0 <= 0) {
    f.s0 = 0;
  }
  foeGravity(f, dt, TUNE.dogGravity);
}

// --- The drone: hovers, dives, and is carrying the reward ------------------
// s0: 0 hovering, 1 diving, 2 climbing back.

function stepDrone(f, dt) {
  var px = P.x + P.w * 0.5, py = P.y + P.h * 0.5;
  var ex = f.x + f.w * 0.5, ey = f.y + f.h * 0.5;

  if (f.s0 === 0) {
    f.t1 += dt;
    // Holds altitude and slides toward him, bobbing: easy to aim at, hard to
    // ignore, and obviously about to do something.
    var wantY = f.homeY + Math.sin(f.t1 * 2.1) * (TS * 0.375);
    f.vy = (wantY - f.y) * 4;
    var dx = px - ex;
    // A DRONE HAS A PATCH, AND IT STAYS ON IT. It used to slide toward the
    // player from anywhere, from frame zero, with nothing to stop it but a wall:
    // measured on 2026-09-21 with the player standing still at the spawn and
    // touching nothing, the drone placed at tile 39 was overhead in under ten
    // seconds, the one from tile 91 joined it by twenty, and he died three times
    // in a minute without pressing a button. Every other drone in the level
    // drifted west until terrain happened to stop it, so not one of the six
    // fought where it had been put.
    //
    // Two rules now. It does not NOTICE him until he is within droneNotice of
    // its home, and it never CHASES further than droneLeash from that home —
    // past the leash it holds the edge of its patch, and when he has gone it
    // goes back. Where a drone is placed means something again.
    var homeC = f.homeX + f.w * 0.5;
    var noticed = Math.abs(px - homeC) < TUNE.droneNotice;
    var leash = f.leash || TUNE.droneLeash;
    var goalX = noticed ? Math.max(homeC - leash, Math.min(homeC + leash, px)) : homeC;
    var gdx = goalX - ex;
    f.facing = (noticed ? dx : gdx) >= 0 ? 1 : -1;
    f.vx = Math.max(-TUNE.droneSpeed, Math.min(TUNE.droneSpeed, gdx * 1.6));
    f.t0 -= dt;
    if (noticed && f.t0 <= 0 && Math.abs(dx) < TUNE.droneRange && py > ey + TS &&
        hasLineOfSight(ex, ey, px, py)) {
      // LOCK first, not the dive. It picks its spot, then holds for a beat so
      // the player can read it and move. Without this it committed the same
      // frame it decided, which is the difference between hard and unfair.
      f.s0 = 3;
      f.t0 = TUNE.droneLock;
      f.s1 = px;                                  // the spot it chose, not where he goes
      f.s2 = P.y + P.h;                           // and how far down his feet were
      f.vy = 0;
      foeSound(f, 'droneLock');                   // the beat is heard as well as seen
    }
  } else if (f.s0 === 3) {
    // The warning beat: stopped, tilted, lit up. It has already chosen where.
    f.t0 -= dt;
    f.vx *= 0.82;
    f.vy = 0;
    if (f.t0 <= 0) {
      f.s0 = 1;
      foeSound(f, 'droneDive');
      // The dive lasts as long as the drop needs, not a fixed 0.7 s: over the
      // culvert his feet are 496 px down and 600 px/s for 0.7 s is 420, so the
      // drone stopped 76 px over his head every time. droneDiveTime is the floor.
      var ddx = f.s1 - (f.x + f.w * 0.5), ddy = f.s2 - (f.y + f.h);
      f.t0 = Math.max(TUNE.droneDiveTime, Math.sqrt(ddx * ddx + ddy * ddy) / TUNE.droneDive + 0.15);
    }
  } else if (f.s0 === 1) {
    f.t0 -= dt;
    // A straight swoop at the spot it chose, at dive speed, so it arrives over
    // him and down at his feet in the same moment; it used to drop at full
    // speed and slide across separately, and reached his level while still
    // beside him when the drop was short and the slide was long. Never less
    // than half its speed downward, so a long slide is still a dive.
    var tdx = f.s1 - ex, tdy = f.s2 - (f.y + f.h), tdd = Math.max(1, Math.sqrt(tdx * tdx + tdy * tdy));
    f.vx = tdx / tdd * TUNE.droneDive;
    f.vy = Math.max(TUNE.droneDive * 0.5, tdy / tdd * TUNE.droneDive);
    // THROUGH any plank between it and the spot it chose. A porch roof, a
    // perch, a belt: measured 2026-09-22, five drones across their patches
    // touched a player standing on the street at 23 of 55 positions, and the
    // rest were a one-way plank between them that the dive obeyed as a floor
    // (Evrtek: "some of the drones don't seem to dive low enough to hit the
    // player"). It stops passing them once it is down at his feet, so the plank
    // he is standing on is still where it lands. Solid tiles still stop it.
    f.dropThrough = (f.y + f.h) < f.s2 - TS * 0.25;
    var there = (f.y + f.h) >= f.s2;
    if (there || f.t0 <= 0 || f.hitY === 1) { f.s0 = 2; f.t0 = TUNE.droneClimb; f.dropThrough = false; }
  } else {
    // THE CLIMB. It has to FLY home, not be put there.
    //
    // Evrtek, 2026-09-20: "the drones on their flight back up teleport part of
    // the way up". They did, and it was every dive rather than a rare case.
    // This branch used to end on `f.t0 <= 0 || f.y <= f.homeY` and then run
    // `f.y = Math.min(f.y, f.homeY + TS * 0.25)` — which reads as a clamp and
    // behaves as a teleport whenever the timer won the race.
    //
    // The timer always won. A dive drops it 352 px in 0.7 s; the climb ran at
    // hover speed x 1.2, which is 168 px/s, and got 151 px of that back inside
    // its 0.9 s window. The clamp silently covered the remaining 198 px in a
    // single frame, every cycle, against a normal climb frame of 2.8 px.
    //
    // So: a climb speed that can actually cover a dive, arrival ends the climb,
    // and the timer is only a safety — out of time and still low, it hands over
    // to the hover, whose own lerp flies it the rest of the way. Nothing here
    // moves it anywhere it did not travel.
    f.t0 -= dt;
    f.vy = -TUNE.droneClimbSpeed;
    f.vx *= 0.9;
    if (f.y <= f.homeY) {
      f.s0 = 0;
      f.t0 = TUNE.droneRest;
      f.y = f.homeY;                  // one frame of overshoot, not a jump home
    } else if (f.t0 <= 0) {
      f.s0 = 0;
      f.t0 = TUNE.droneRest;          // the hover takes it from wherever it got to
    }
  }
  // It flies: no gravity, but it still stops on walls.
  moveEntity(f, f.vx * dt, f.vy * dt);
  f.grounded = f.hitY === 1;
}

// --- The gnome: scenery, until it is not ------------------------------------
// s0: 0 dormant, 1 waking, 2 awake.

function gnomeWake(f) {
  if (f.s0 !== 0) return;
  f.s0 = 1;
  f.t0 = TUNE.gnomeWake;
  f.seen = true;
  puff(f.x + f.w * 0.5, f.y + f.h * 0.5, 0, -120, 8, PAL.gnomeHat);
  foeSound(f, 'gnomeWake');                       // stone on stone: the statue is not a statue
}

function stepGnome(f, dt) {
  var dx = (P.x + P.w * 0.5) - (f.x + f.w * 0.5);
  if (f.s0 === 0) {
    f.vx = 0;
    // Proximity, not sight. The joke only works if it does not watch you coming.
    if (Math.abs(dx) < TUNE.gnomeTrigger && Math.abs(P.y - f.y) < TS * 5) gnomeWake(f);
  } else if (f.s0 === 1) {
    f.vx = 0;
    f.t0 -= dt;                                    // a beat of shuddering: fair warning
    if (f.t0 <= 0) { f.s0 = 2; foeSound(f, 'gnomeGo'); }
  } else {
    f.facing = dx >= 0 ? 1 : -1;
    f.vx = f.facing * TUNE.gnomeSpeed;
    if (f.hitX !== 0 && f.grounded) { f.vy = -TUNE.gnomeHop; foeSound(f, 'gnomeHop'); }   // it will not be walled in
  }
  foeGravity(f, dt, TUNE.dogGravity);
}

// --- The trash panda: takes a lid, then holds a line ------------------------
// s0: 0 heading for a bin, 1 patrolling, 2 lunging.

function nearestBin(f) {
  var best = null, bd = 1e9;
  for (var i = 0; i < World.bins.length; i++) {
    var b = World.bins[i];
    if (!b.lid) continue;
    var d = Math.abs(b.tx * TS - f.x);
    if (d < bd) { bd = d; best = b; }
  }
  return bd < TUNE.pandaBinRange ? best : null;
}

function stepPanda(f, dt) {
  var px = P.x + P.w * 0.5, ex = f.x + f.w * 0.5;

  if (f.s0 === 0) {
    var bin = nearestBin(f);
    if (!bin) { f.s0 = 1; f.t0 = TUNE.pandaLungeEvery; }
    else {
      var bx2 = bin.tx * TS + TS * 0.5;
      f.facing = bx2 >= ex ? 1 : -1;
      f.vx = f.facing * TUNE.pandaSpeed;
      if (Math.abs(bx2 - ex) < TS) {
        bin.lid = false;
        f.shield = TUNE.pandaShield | 0;
        f.homeX = f.x;                             // it patrols from where it armed
        f.s0 = 1; f.t0 = TUNE.pandaLungeEvery;
        puff(bx2, bin.ty * TS - TS * 0.375, 0, -160, 8, PAL.lid);
        sfx('pandaLid', bx2, bin.ty * TS - TS * 0.375);   // the clank of a bin lid, from the bin
      }
    }
  } else if (f.s0 === 1) {
    // Back and forth, always facing the way it walks — which is what makes
    // getting behind it a manoeuvre rather than a coin flip.
    if (f.x < f.homeX - TUNE.pandaRange) f.facing = 1;
    else if (f.x > f.homeX + TUNE.pandaRange) f.facing = -1;
    if (f.hitX !== 0) f.facing = -f.facing;
    f.vx = f.facing * TUNE.pandaSpeed;
    f.t0 -= dt;
    if (f.t0 <= 0 && Math.abs(px - ex) < TUNE.pandaLungeRange) {
      f.facing = px >= ex ? 1 : -1;
      f.s0 = 2;
      f.t0 = TUNE.pandaLungeTime;
      foeSound(f, 'pandaChitter');
    }
  } else {
    f.t0 -= dt;
    f.vx = f.facing * TUNE.pandaLungeSpeed;
    if (f.t0 <= 0) { f.s0 = 1; f.t0 = TUNE.pandaLungeEvery; }
  }
  foeGravity(f, dt, TUNE.dogGravity);
}

// --- The Postmaster --------------------------------------------------------
// phase 0: he throws the mail at you.            (what THROW taught you)
// phase 1: he sends dogs, AND keeps throwing.    (what the dogs taught you)
// phase 2: he goes up on the sack and rains bombs, and every fifth one that
//          lands stands up as a mailbox bot.     (what aiming up taught you)
// Each phase carries the last one's pressure. Evrtek, 2026-09-22: "The boss
// phases are not increasing in difficulty. The dog phase is too easy. He should
// throw mail during phase 2 also. For phase 3 his drop rate needs to increase in
// frequency so there's more bombs falling. Every 5th bomb that lands should turn
// into a robo mailbox."

// A fan of three letters at wherever he is standing now.
function bossThrow(f, px, ex) {
  var sy = f.y + f.h * 0.34;
  var dx = px - ex, dy = (P.y + P.h * 0.4) - sy;
  var d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  foeSound(f, 'bossThrow');
  for (var k = -1; k <= 1; k++)
    shotFire(ex + f.facing * f.w * 0.35, sy,
             (dx / d) * TUNE.bossShot + k * TUNE.bossShot * 0.108, (dy / d) * TUNE.bossShot + k * TUNE.bossShot * 0.075, 0);
}

function stepBoss(f, dt) {
  // s1 is the switch: he is scenery until the arena gate shuts behind you.
  // Walking up to a boss and plinking him through the doorway is not a fight.
  if (!f.s1) { f.vx = 0; foeGravity(f, dt, TUNE.dogGravity); return; }

  var px = P.x + P.w * 0.5, ex = f.x + f.w * 0.5;
  f.facing = px >= ex ? 1 : -1;

  if (f.t0 > 0 && f.s0 === 0) {          // the pause between phases
    f.t0 -= dt;
    f.vx = 0;
    f.hurtT = Math.max(f.hurtT, 0.05);
    if (f.t0 <= 0) { f.s0 = 1; f.t1 = 0; }
    foeGravity(f, dt, TUNE.dogGravity);
    return;
  }

  f.t1 -= dt;
  if (f.phase === 0) {
    f.vx = (Math.abs(px - ex) > TS * 5 ? f.facing : -f.facing) * TUNE.bossWalk;
    if (f.t1 <= 0) { f.t1 = TUNE.bossThrowEvery; bossThrow(f, px, ex); }
  } else if (f.phase === 1) {
    f.vx = f.facing * TUNE.bossWalk * 0.6;
    if (f.t1 <= 0) { f.t1 = TUNE.bossDogEvery; bossSummonDog(f); }
    // And the mail keeps coming, on its own clock.
    f.t2 -= dt;
    if (f.t2 <= 0) { f.t2 = TUNE.bossP2Throw; bossThrow(f, px, ex); }
  } else {
    // On the sack. He will not come down, so you cannot stay flat-footed.
    var wantY = f.homeY - TUNE.bossHigh;
    f.vy = (wantY - f.y) * 3.2;
    f.vx = Math.max(-TUNE.bossWalk * 2, Math.min(TUNE.bossWalk * 2, (px - ex) * 1.4));
    if (f.t1 <= 0) { f.t1 = TUNE.bossBombEvery; shotFire(ex, f.y + f.h, 0, 80, 1); foeSound(f, 'bossBomb'); }
    moveEntity(f, f.vx * dt, f.vy * dt);
    f.grounded = false;
    return;
  }
  foeGravity(f, dt, TUNE.dogGravity);
}

// He stands down but KEEPS HIS WOUNDS: back on his mark, inert, at the health
// and the phase the last attempt left him. Evrtek, 2026-09-22: "he should keep
// his health and phase between attempts. Otherwise the player is waaay too
// punished for the failed attempt. Especially since any powerups they had are
// gone." The phase-gap beat runs again on the next wake, so walking back in is
// not walking into a throw.
function bossStandDown(f) {
  f.x = f.homeX; f.y = f.homeY; f.vx = f.vy = 0;
  f.grounded = false; f.wasGrounded = false; f.facing = f.faceHome;
  f.hurtT = 0; f.flash = 0;
  f.s1 = 0; f.s0 = 0; f.t0 = TUNE.bossPhaseGap; f.t1 = 0; f.t2 = 0;
}

// Something he calls into the fight: a dog beside him in phase two, a mailbox
// bot where a bomb landed in phase three. Reuses one of that kind already down
// before taking a fresh slot. Born awake, and marked as his, so it goes when
// the attempt does (arenaReopen) and never comes back on the respawn timer.
function bossSummon(f, kind, tx, ty, face) {
  var s = null;
  for (var i = 0; i < Foes.n; i++) {
    var d = Foes.a[i];
    if (d.kind === kind && !d.alive) { s = d; break; }   // reuse one that is already down
  }
  if (!s) { if (Foes.n >= FOE_MAX) return null; s = Foes.a[Foes.n++]; }
  foePlace(s, { kind: kind, tx: tx, ty: ty, face: face });
  s.seen = true; s.forgetT = TUNE.dogForget; s.awake = true; s.summoned = true;
  puff(s.x + s.w * 0.5, s.y + s.h * 0.4, 0, -120, 8, kind === FOE_DOG ? PAL.dogBody : PAL.boxBody);
  return s;
}

function bossSummonDog(f) {
  foeSound(f, 'bossWhistle');                     // a postman's whistle: here, boy
  var tx = Math.floor((f.x + f.facing * f.w * 0.76) / TS);
  var ty = Math.floor((f.y + f.h) / TS);
  bossSummon(f, FOE_DOG, tx, ty, f.facing);
}

// A bomb has hit the ground. Every Nth one stands up as a mailbox bot, on the
// tile it landed on, facing him.
function bossBombLanded(s) {
  for (var i = 0; i < Foes.n; i++) {
    var f = Foes.a[i];
    if (f.kind !== FOE_BOSS || !f.alive || !f.s1) continue;
    sfx('bombLand', s.x, s.y);
    f.bombs++;
    var every = Math.max(1, TUNE.bossBoxEvery | 0);
    if (f.bombs % every !== 0) return;
    var tx = Math.floor(s.x / TS), ty = Math.floor(s.y / TS);
    var face = (P.x + P.w * 0.5) >= tx * TS ? 1 : -1;
    var bot = bossSummon(f, FOE_BOX, tx, ty, face);
    if (bot) foeSound(bot, 'boxRise');
    return;
  }
}

// He is beaten: everything he called, and everything else still up, goes with
// him. Evrtek, 2026-09-22: "When the boss is defeated all the enemies on screen
// should disappear." Not kills - nothing scored, nothing tallied.
function bossClearField() {
  for (var i = 0; i < Foes.n; i++) {
    var f = Foes.a[i];
    if (f.kind === FOE_BOSS || !f.alive) continue;
    f.alive = false; f.deadT = 0;
    puff(f.x + f.w * 0.5, f.y + f.h * 0.5, 0, -100, 8, PAL.itemGlow);
  }
  Shots.n = 0;
}

// --- Shared ----------------------------------------------------------------

function foeGravity(f, dt, g) {
  f.vy += g * dt;
  if (f.vy > TS * 45) f.vy = TS * 45;
  moveEntity(f, f.vx * dt, f.vy * dt);
  f.grounded = f.hitY === 1;
  if (f.grounded && !f.wasGrounded) puff(f.x + f.w * 0.5, f.y + f.h, 0, -40, 3);
}

function foeStep(f, dt) {
  if (!f.alive) {
    // A dog the Postmaster called does not come back on its own: it belongs to
    // the fight, and the fight is over or reset.
    if (TUNE.dogRespawn > 0 && f.kind !== FOE_BOSS && !f.summoned) {
      f.deadT -= dt;
      if (f.deadT <= 0) foeRevive(f);
    }
    return;
  }
  if (f.hurtT > 0) f.hurtT -= dt;
  if (f.flash > 0) f.flash -= dt * 4;
  f.wasGrounded = f.grounded;

  // ASLEEP UNTIL HE IS NEAR. Every enemy in the level used to run its whole
  // behaviour from the first frame, however far away — and the level is five
  // hundred tiles long. Measured on 2026-09-21 with the player standing still
  // at the spawn: four of the five trash pandas had walked to their bins, taken
  // the lids and begun patrolling within FIVE SECONDS, between 250 and 440
  // tiles off-screen. So nobody ever saw a panda take a lid, which is the whole
  // joke of the enemy and the only explanation of where its shield came from.
  // The bin was always already empty by the time he got there.
  //
  // Now a foe does nothing but fall until he first comes within foeWake of it,
  // and once awake it stays awake. The Postmaster is exempt — the arena gate is
  // his switch — and so is anything already hurt, so a long throw still starts
  // a fight rather than bouncing off a sleeper.
  if (!f.awake) {
    var near = Math.abs((P.x + P.w * 0.5) - (f.x + f.w * 0.5)) < TUNE.foeWake;
    if (near || f.kind === FOE_BOSS || f.hp < foeMaxHp(f.kind)) f.awake = true;
    else {
      if (f.kind !== FOE_DRONE) foeGravity(f, dt, TUNE.dogGravity);
      foeAnim(f, dt);
      return;
    }
  }

  switch (f.kind) {
    case FOE_DOG:   stepDog(f, dt); break;
    case FOE_BOX:   stepBox(f, dt); break;
    case FOE_DRONE: stepDrone(f, dt); break;
    case FOE_GNOME: stepGnome(f, dt); break;
    case FOE_PANDA: stepPanda(f, dt); break;
    default:        stepBoss(f, dt); break;
  }

  if (f.y > World.py + TS * 7.5) foeRevive(f);
  foeAnim(f, dt);
}

// One clip per state, per kind. Same contract as the carrier: the renderer asks
// the animation what to draw, never the other way round.
function foeAnim(f, dt) {
  if (!f.anim) f.anim = animMake();
  var c;
  switch (f.kind) {
    case FOE_DOG:
      c = f.hurtT > 0 ? 'dog.hurt' : !f.grounded ? 'dog.leap'
        : (f.seen && f.t0 < 0.08) ? 'dog.coil' : 'dog.idle';
      break;
    case FOE_BOX:
      c = f.hurtT > 0 ? 'boxbot.hurt' : f.s0 === 1 ? 'boxbot.chew'
        : f.s0 === 2 ? 'boxbot.spit' : Math.abs(f.vx) > 8 ? 'boxbot.walk' : 'boxbot.idle';
      break;
    case FOE_DRONE:
      c = f.hurtT > 0 ? 'drone.hurt' : f.s0 === 3 ? 'drone.lock'
        : f.s0 === 1 ? 'drone.dive'
        : f.s0 === 2 ? 'drone.climb' : 'drone.hover';
      break;
    case FOE_GNOME:
      c = f.s0 === 0 ? 'gnome.statue' : f.s0 === 1 ? 'gnome.wake'
        : f.hurtT > 0 ? 'gnome.hurt' : !f.grounded ? 'gnome.hop' : 'gnome.walk';
      break;
    case FOE_PANDA:
      c = f.hurtT > 0 ? (f.shield > 0 ? 'panda.lidHit' : 'panda.hurt')
        : f.s0 === 0 ? 'panda.walk' : f.s0 === 2 ? 'panda.lunge' : 'panda.patrol';
      break;
    default:
      c = !f.s1 ? 'boss.idle' : f.t0 > 0 && f.s0 === 0 ? 'boss.phase'
        : f.phase === 2 ? 'boss.ride'
        : f.hurtT > 0 ? 'boss.hurt'
        : f.phase === 1 ? (f.t1 > TUNE.bossDogEvery - 0.35 ? 'boss.summon' : 'boss.walk')
        : (f.t1 > TUNE.bossThrowEvery - 0.3 ? 'boss.throw' : 'boss.walk');
      break;
  }
  animPlay(f.anim, c);
  animStep(f.anim, dt);
}

function foesStep(dt) {
  for (var i = 0; i < Foes.n; i++) foeStep(Foes.a[i], dt);
  shotsStep(dt);
  foeHatCheck();
  arenaStep();

  // Touching one hurts. Checked after everything has moved, so it cannot depend
  // on which of the two happened to be updated first.
  if (P.invulnT > 0 || P.knockT > 0 || P.ryeT > 0) return;
  for (var k = 0; k < Foes.n; k++) {
    var f = Foes.a[k];
    if (!f.alive) continue;
    if (k === P.onHat) continue;                         // you are ON him, not in him
    if (f.kind === FOE_BOSS && !f.s1) continue;          // inert until the gate shuts
    if (f.kind === FOE_GNOME && f.s0 === 0) continue;    // a statue is a statue
    if (aabbOverlap(P, f)) {
      var push = (P.x + P.w * 0.5) < (f.x + f.w * 0.5) ? -1 : 1;
      playerHurt(foeTouchDamage(f.kind), push);
      return;
    }
  }
}

// --- Standing on the Postmaster --------------------------------------------
// His cap is solid from above and only from above, checked after everything has
// moved. Cornered against a wall you can always go UP, and that is the whole
// difference between a hard fight and an unfair one.
function foeHatCheck() {
  P.onHat = -1;
  if (!TUNE.bossHatTop || P.vy < 0) return;
  for (var i = 0; i < Foes.n; i++) {
    var f = Foes.a[i];
    if (!f.alive || f.kind !== FOE_BOSS) continue;
    var top = f.y + TS / 8;                             // the brim, not the crown
    if (P.x + P.w <= f.x + TS * 0.125 || P.x >= f.x + f.w - TS * 0.125) continue;
    var feet = P.y + P.h, wasFeet = P.prevY + P.h;
    if (wasFeet <= top + 6 && feet >= top) {
      P.y = top - P.h;
      P.vy = 0;
      P.grounded = true;
      P.coyoteT = TUNE.coyote;
      P.airJumps = TUNE.airJumps | 0;
      P.cut = true;
      P.onHat = i;
      return;
    }
  }
}

// --- What the player's weapons see -----------------------------------------

function foesAt(x, y) {
  for (var i = 0; i < Foes.n; i++) {
    var f = Foes.a[i];
    if (!f.alive) continue;
    if (f.kind === FOE_GNOME && f.s0 === 0) continue;
    if (x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h) return true;
  }
  return false;
}

// A blast is not a letter. It comes from everywhere at once, so a panda's lid
// does not cover it (the hit is passed as travelling the way it faces, which
// is "from behind" to foeHurt) and a shut mailbox bot is blown open and hurt
// rather than eating it. The boss before the gate shuts is still not in the
// fight. Evrtek, 2026-09-22: "like a grenade so they clearly should do area
// damage and lots of it when they land."
function foesBlast(x, y, r, dmg) {
  for (var i = 0; i < Foes.n; i++) {
    var f = Foes.a[i];
    if (!f.alive) continue;
    var cx = f.x + f.w * 0.5 - x, cy = f.y + f.h * 0.5 - y;
    if (cx * cx + cy * cy > r * r) continue;
    if (f.kind === FOE_BOX && f.s0 === 0) { f.s0 = 1; f.t0 = TUNE.boxChew; }
    foeHurt(f, dmg, f.facing);
    if (f.alive && f.kind !== FOE_BOSS && f.kind !== FOE_BOX) { f.vx = (cx >= 0 ? 1 : -1) * TUNE.dogKnock * 1.5; f.vy = -260; f.grounded = false; }
  }
}

// Returns true if this letter was used up. It returns true for the mailbox bot
// even though the bot took no damage: it ate it.
function foesTakeMail(mx, my, dirX) {
  var rx = TS * 0.25, ry = 6;
  for (var i = 0; i < Foes.n; i++) {
    var f = Foes.a[i];
    if (!f.alive) continue;
    if (f.kind === FOE_GNOME && f.s0 === 0) continue;
    if (mx + rx < f.x || mx - rx > f.x + f.w || my + ry < f.y || my - ry > f.y + f.h) continue;

    if (f.kind === FOE_BOX && f.s0 === 0) {
      f.s0 = 1;                                    // swallowed: the mouth opens
      f.t0 = TUNE.boxChew;
      f.vt = 0.25; f.vs = 0;                       // the first chomp comes after the gulp
      foeSound(f, 'boxEat');
      puff(f.x + f.w * 0.5, f.y + f.h * 0.29, 0, -60, 5, PAL.mail);
      return true;
    }
    foeHurt(f, Math.max(1, TUNE.mailDamage | 0), dirX);
    return true;
  }
  return false;
}
