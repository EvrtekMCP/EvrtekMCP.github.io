'use strict';
// ---------------------------------------------------------------------------
// How a stage starts and how it ends.
//
// Evrtek's brief: the mail truck drives into frame, a door opens, and the
// carrier jumps out. When the boss goes down the same truck comes back, the
// door opens, and he gets in. A level with no boss ends the same way when he
// reaches its pickup marker (2026-09-26) — see stagePickup.
//
// It matters more than it sounds. A level that begins with the player already
// standing there begins nowhere; a level that begins with an arrival has a
// place and a reason. The whole sequence costs the player no input and about
// three seconds, and it is the only part of the game he cannot fail.
//
// The player has no control for the length of it. That is deliberate and it is
// why every phase here is short.
// ---------------------------------------------------------------------------

var ST_INTRO_DRIVE = 0, ST_INTRO_DOOR = 1, ST_INTRO_OUT = 2,
    ST_PLAY = 3,
    ST_OUTRO_DRIVE = 4, ST_OUTRO_DOOR = 5, ST_OUTRO_IN = 6, ST_DONE = 7;

var Stage = {
  phase: ST_PLAY,
  t: 0,
  lock: false,           // the player has no control while this is true
  truckX: 0, truckY: 0,  // the truck's own position, in world pixels
  truckFrom: 0, truckTo: 0,
  door: 0,               // 0 shut, 1 fully open
  shown: true,           // is the carrier drawn
  endX: 0, endY: 0,      // where the outro truck parks
  pickupDue: false,      // he crossed the pickup while hopping out; the truck comes as play begins
  voiced: -1             // the phase whose sound has been played (stageVoice)
};

function stageBegin() {
  Stage.phase = ST_INTRO_DRIVE;
  Stage.t = 0;
  Stage.lock = true;
  Stage.door = 0;
  Stage.shown = false;
  // It arrives from off screen to the left and parks just short of him, so the
  // first thing the player sees moving is the thing he is about to get out of.
  Stage.truckTo = World.spawn.x - TUNE.truckPark;
  Stage.truckFrom = Stage.truckTo - TUNE.truckRunUp;
  Stage.truckX = Stage.truckFrom;
  Stage.truckY = World.spawn.y;
  Stage.endX = 0; Stage.endY = 0;
  Stage.pickupDue = false;
  Stage.voiced = -1;
  // At boot this runs BEHIND the title screen, which has its own track; the
  // title hands over to the level's when it is pressed (title.js).
  musicPlay((typeof titleActive === 'function' && titleActive()) ? 'title' : 'level');
}

// Called the moment the Postmaster goes down — and, since 2026-09-26, the
// moment he reaches a pickup marker (stagePickup, below). ONE outro for both
// endings: this function and everything stageStep does after it.
//
// With no arguments it parks beside HIM, which is the boss's ending exactly as
// it always was. Given an anchor — a point on the ground, in world pixels — it
// parks beside that instead, with the same TUNE numbers from there on.
function stageFinish(atX, atFeet) {
  if (Stage.phase !== ST_PLAY) return;
  Stage.phase = ST_OUTRO_DRIVE;
  Stage.t = 0;
  Stage.lock = true;
  Stage.door = 0;
  // It comes in from the right this time, and parks beside wherever he is
  // standing when the fight ends.
  var ax = (atX === undefined) ? P.x + P.w * 0.5 : atX;
  Stage.truckY = (atFeet === undefined) ? P.y + P.h : atFeet;
  Stage.truckTo = ax + TUNE.truckPark;
  Stage.truckFrom = Stage.truckTo + TUNE.truckRunUp;
  Stage.truckX = Stage.truckFrom;
}

// HAS HE REACHED THE PICKUP?  [CLU, 2026-09-26 — Evrtek's to overrule]
//
// His MIDDLE CROSSING THE MARKER'S COLUMN, at any height, in either direction.
// The same line the arena's entry column draws, so a level author learns one
// rule for both endings. A column rather than a box because a box can be
// jumped over, and a missed pickup is a level with no way out of it; a column
// can only be crossed. Swept from where he was the frame before (P.prevX —
// playerStep sets it, and a respawn resets it, so being put down past the
// marker does not count as crossing it), so no speed can step over it.
//
// WHEN it counts: from the moment he hops out of the truck. The hop is real
// physics and he can land past a marker placed close to the spawn — which is
// exactly what the editor's Play-at-the-cursor does when the author puts the
// cursor on the pickup to watch the ending — so a crossing in the hop is kept
// (Stage.pickupDue) and the truck is called the frame play begins; stageFinish
// only ever runs from play. The drive-in never counts: he is carried along
// with the truck then, from far off to the left, not walking anywhere.
//
// Never while a boss room exists.
function stagePickupReached() {
  if (typeof pickupLive !== 'function' || !pickupLive()) return false;
  var x0 = World.pickup.tx * TS, x1 = x0 + TS;
  var a = P.prevX + P.w * 0.5, b = P.x + P.w * 0.5;
  return Math.max(a, b) >= x0 && Math.min(a, b) < x1;
}

// The truck comes for him: the Postmaster's ending without the Postmaster.
// The field clears the way it does when he falls — the carrier has no control
// for the next few seconds, and a dog must not get a free bite while the truck
// door is open — then the SAME stageFinish, anchored on the marker rather than
// on the carrier, so the truck parks on the marker's ground even when he
// crossed it in mid-jump. The clock stops here, as it stops for the boss:
// levelTick does not run while the truck has him.
function stagePickup() {
  if (typeof bossClearField === 'function') bossClearField();
  if (typeof musicStop === 'function') musicStop();
  sfx('checkpoint');                  // the one chime a stop already means: you made it here
  if (typeof musicSting === 'function') musicSting('victory');   // and then the fanfare
  var an = pickupAnchor(World.pickup);
  stageFinish(an.x, an.feet);
}

function stageEased(a) { return 1 - (1 - a) * (1 - a); }   // ease out, so it settles

// The truck's sounds, one per phase, the first step of it: the engine coming
// in, the door, and the drive away. Off the phase rather than off the call
// that sets it, because the intro is armed at boot behind the title and only
// starts moving when the title lets go.
function stageVoice(ph) {
  if (ph === ST_INTRO_DRIVE || ph === ST_OUTRO_DRIVE) sfx('truckIn');
  else if (ph === ST_INTRO_DOOR || ph === ST_OUTRO_DOOR) sfx('truckDoor');
  else if (ph === ST_DONE) sfx('truckOut');
}

function stageStep(dt) {
  Stage.t += dt;
  if (Stage.voiced !== Stage.phase) { Stage.voiced = Stage.phase; stageVoice(Stage.phase); }
  var a;
  switch (Stage.phase) {

    case ST_INTRO_DRIVE:
      a = Math.min(1, Stage.t / TUNE.truckDrive);
      Stage.truckX = Stage.truckFrom + (Stage.truckTo - Stage.truckFrom) * stageEased(a);
      // Hold him at the door so the camera has something to be looking at.
      P.x = Stage.truckX + TUNE.truckDoorX;
      P.y = Stage.truckY - P.h;
      P.vx = P.vy = 0;
      if (a >= 1) { Stage.phase = ST_INTRO_DOOR; Stage.t = 0; }
      break;

    case ST_INTRO_DOOR:
      Stage.door = Math.min(1, Stage.t / TUNE.truckDoor);
      P.x = Stage.truckX + TUNE.truckDoorX;
      P.y = Stage.truckY - P.h;
      if (Stage.door >= 1) {
        Stage.phase = ST_INTRO_OUT;
        Stage.t = 0;
        Stage.shown = true;
        // He hops out. A real jump through the real physics, so the first thing
        // the player ever sees him do is the thing he will spend the level doing.
        P.vx = TUNE.maxRun * 0.75;
        P.vy = -TUNE.jumpVel * 0.62;
        P.grounded = false;
        P.facing = 1;
      }
      break;

    case ST_INTRO_OUT:
      if (stagePickupReached()) Stage.pickupDue = true;   // hopped over it: the truck comes as he lands
      // Physics has him now. Hand control over the moment he is on the ground
      // again, or after a hard limit if he has landed somewhere awkward.
      if ((P.grounded && Stage.t > 0.18) || Stage.t > 1.6) {
        Stage.phase = ST_PLAY;
        Stage.lock = false;
        Stage.t = 0;
      }
      break;

    case ST_PLAY:
      // The one ending a level can have without a boss in it.
      if (Stage.pickupDue || stagePickupReached()) { Stage.pickupDue = false; stagePickup(); }
      break;

    case ST_OUTRO_DRIVE:
      a = Math.min(1, Stage.t / TUNE.truckDrive);
      Stage.truckX = Stage.truckFrom + (Stage.truckTo - Stage.truckFrom) * stageEased(a);
      if (a >= 1) { Stage.phase = ST_OUTRO_DOOR; Stage.t = 0; }
      break;

    case ST_OUTRO_DOOR:
      Stage.door = Math.min(1, Stage.t / TUNE.truckDoor);
      if (Stage.door >= 1) { Stage.phase = ST_OUTRO_IN; Stage.t = 0; }
      break;

    case ST_OUTRO_IN:
      // He walks to the door and climbs in.
      var doorX = Stage.truckX + TUNE.truckDoorX;
      var dx = doorX - P.x;
      // 6 world px at TS=32 (was 3 at TS=16) — a stop band, so it is a length.
      if (Math.abs(dx) > 6 && Stage.t < 2.2) {
        P.facing = dx > 0 ? 1 : -1;
        P.vx = P.facing * TUNE.maxRun * 0.55;
      } else {
        P.vx = 0;
        if (Stage.t > 0.4) {
          Stage.shown = false;
          Stage.door = Math.max(0, 1 - (Stage.t - 0.4) / TUNE.truckDoor);
          if (Stage.door <= 0) {
            Stage.phase = ST_DONE;
            Stage.t = 0;
            Level.over = true;
            Level.reason = 'DELIVERED';
          }
        }
      }
      break;

    case ST_DONE:
      // It pulls away, which is the last thing on screen.
      Stage.truckX += TUNE.maxRun * 1.1 * dt;
      // ...and THEN the tally. Level.over went true at the top of this phase,
      // which is why nothing may freeze on it: stop the simulation there and
      // the truck parks in the middle of the shot forever.
      if (Stage.t > 2.6 && typeof tallyEnd === 'function') tallyEnd('DELIVERED');
      break;
  }
}

// The carrier gets no say while the truck has him.
function stageLocksInput() { return Stage.lock; }
