'use strict';
// ---------------------------------------------------------------------------
// Every movement number in the game, in one table.
//
// The table is the only source of truth: TUNE is built from it, the panel is
// generated from it, and "reset" just reads it again. Adding a knob is one line
// here and nothing anywhere else.
//
// Units are pixels and seconds. The world is 16 px to a tile and the carrier is
// 14 x 40 — two and a half tiles — so "top speed 205" is about thirteen tiles
// a second, or five of his own heights.
// ---------------------------------------------------------------------------

var TUNE_SPEC = [
  // ---- Ground movement: this group is the momentum model ------------------
  { g: 'Run', k: 'maxRun', l: 'Top speed', v: 410, min: 100, max: 720, s: 1, u: 'px/s',
    d: 'How fast he ends up going. Momentum lives in the two numbers below it.' },
  { g: 'Run', k: 'groundAccel', l: 'Acceleration', v: 3000, min: 200, max: 24000, s: 50, u: 'px/s²',
    d: 'Low is Mario — a wind-up. High is Mega Man — instant top speed.' },
  { g: 'Run', k: 'groundFriction', l: 'Friction', v: 3200, min: 200, max: 24000, s: 50, u: 'px/s²',
    d: 'How hard he stops when you let go. Low slides, high plants.' },
  { g: 'Run', k: 'turnAccel', l: 'Skid turn', v: 6000, min: 200, max: 24000, s: 50, u: 'px/s²',
    d: 'Acceleration while reversing. Below Acceleration gives you a long skid.' },

  // ---- Air ----------------------------------------------------------------
  { g: 'Air', k: 'airAccel', l: 'Air acceleration', v: 2000, min: 0, max: 24000, s: 50, u: 'px/s²',
    d: 'Steering authority in the air. Zero commits you to the arc you jumped with.' },
  { g: 'Air', k: 'airFriction', l: 'Air friction', v: 600, min: 0, max: 24000, s: 50, u: 'px/s²',
    d: 'Drag with no input held while airborne.' },

  // ---- Jump ---------------------------------------------------------------
  { g: 'Jump', k: 'jumpVel', l: 'Jump strength', v: 750, min: 160, max: 1240, s: 1, u: 'px/s' },
  { g: 'Jump', k: 'gravity', l: 'Gravity (rising)', v: 2300, min: 400, max: 8000, s: 10, u: 'px/s²' },
  { g: 'Jump', k: 'fallGravity', l: 'Gravity (falling)', v: 3500, min: 400, max: 10000, s: 10, u: 'px/s²',
    d: 'Heavier than rising gravity is the oldest trick in the genre — it is what makes a jump feel snappy instead of floaty.' },
  { g: 'Jump', k: 'jumpCut', l: 'Release cut', v: 0.4, min: 0, max: 1, s: 0.01, u: '×',
    d: 'Upward speed is multiplied by this the instant you let go. This is the whole of variable jump height.' },
  { g: 'Jump', k: 'maxFall', l: 'Terminal velocity', v: 1120, min: 200, max: 1680, s: 10, u: 'px/s' },
  { g: 'Jump', k: 'apexSpeed', l: 'Apex window', v: 96, min: 0, max: 400, s: 1, u: 'px/s',
    d: 'Vertical speed under which he counts as "at the apex".' },
  { g: 'Jump', k: 'apexGravity', l: 'Apex gravity', v: 0.55, min: 0.1, max: 1, s: 0.01, u: '×',
    d: 'Gravity multiplier at the top of the arc. Under 1 buys hang time exactly where the player is aiming.' },
  { g: 'Jump', k: 'apexControl', l: 'Apex control', v: 1.3, min: 0.5, max: 3, s: 0.05, u: '×',
    d: 'Extra air steering at the apex. Hang time plus steering is where a jump starts feeling generous.' },

  // ---- Double jump --------------------------------------------------------
  { g: 'Double jump', k: 'airJumps', l: 'Air jumps', v: 1, min: 0, max: 3, s: 1, u: '' },
  { g: 'Double jump', k: 'airJumpVel', l: 'Air jump strength', v: 660, min: 160, max: 1240, s: 1, u: 'px/s' },
  { g: 'Double jump', k: 'airJumpZero', l: 'Cancel fall first', v: 1, min: 0, max: 1, s: 1, u: '', t: 'bool',
    d: 'On: the second jump wipes your downward speed before it fires, so it is the same height whenever you use it. Off: it adds to whatever you were doing.' },

  // ---- Assists — these are the "responsive" ones --------------------------
  { g: 'Assists', k: 'coyote', l: 'Coyote time', v: 0.10, min: 0, max: 0.3, s: 0.005, u: 's',
    d: 'How long after walking off a ledge you can still jump. Nobody notices it until it is gone.' },
  { g: 'Assists', k: 'jumpBuffer', l: 'Jump buffer', v: 0.13, min: 0, max: 0.3, s: 0.005, u: 's',
    d: 'Press jump this long before landing and it still fires. This is the single biggest "it ate my input" fix.' },
  { g: 'Assists', k: 'cornerNudge', l: 'Corner nudge', v: 8, min: 0, max: 16, s: 1, u: 'px',
    d: 'Clipping a ceiling corner by this much slides you past it instead of stopping you dead.' },

  // ---- Wall ---------------------------------------------------------------
  { g: 'Wall', k: 'wallSlide', l: 'Slide speed', v: 184, min: 0, max: 800, s: 1, u: 'px/s',
    d: 'Fall speed while hugging a wall.' },
  { g: 'Wall', k: 'wallJumpX', l: 'Kick outward', v: 300, min: 0, max: 1000, s: 1, u: 'px/s' },
  { g: 'Wall', k: 'wallJumpY', l: 'Kick upward', v: 710, min: 160, max: 1240, s: 1, u: 'px/s' },
  { g: 'Wall', k: 'wallLock', l: 'Steering lock', v: 0.06, min: 0, max: 0.4, s: 0.005, u: 's',
    d: 'Air steering is ignored for this long after a kick, so it actually leaves the wall instead of being held back into it. It is also what decides whether ONE wall is climbable: at 0.14 the round trip back to the wall took longer than the rise and every cycle lost height. Measured at the 150 kick, the cliff is between 0.08 and 0.06.' },
  { g: 'Wall', k: 'wallCoyote', l: 'Wall coyote', v: 0.09, min: 0, max: 0.3, s: 0.005, u: 's',
    d: 'Grace period to wall jump after sliding off the end of a wall.' },
  { g: 'Wall', k: 'wallStick', l: 'Stick time', v: 0.12, min: 0, max: 0.5, s: 0.005, u: 's',
    d: 'How long you can hold away from a wall before you actually let go of it.' },
  { g: 'Wall', k: 'wallRefresh', l: 'Refreshes air jump', v: 1, min: 0, max: 1, s: 1, u: '', t: 'bool',
    d: 'On: every wall kick gives the double jump back, so a shaft can be climbed forever.' },

  // ---- The carrier himself ------------------------------------------------
  { g: 'Body', k: 'bodyH', l: 'Height', v: 80, min: 32, max: 120, s: 1, u: 'px',
    d: 'Two and a half tiles. Everything else in the game is measured against this, so it is the first number to settle.' },
  { g: 'Body', k: 'bodyW', l: 'Width', v: 28, min: 16, max: 52, s: 1, u: 'px',
    d: 'Under a full tile on purpose — a carrier exactly one tile wide has to be pixel-perfect to fit through a one-tile gap.' },
  { g: 'Body', k: 'crouchH', l: 'Crouched height', v: 48, min: 24, max: 96, s: 1, u: 'px',
    d: 'Hold down on the ground. He will not stand back up until there is room for his head.' },
  { g: 'Body', k: 'crouchSpeed', l: 'Crouched speed', v: 0.4, min: 0, max: 1, s: 0.05, u: '×',
    d: 'Fraction of top speed while crouched. Zero plants him.' },

  // ---- The thrown mail ----------------------------------------------------
  { g: 'Throw', k: 'tossSpeed', l: 'Throw speed', v: 680, min: 160, max: 1520, s: 10, u: 'px/s' },
  { g: 'Throw', k: 'tossGravity', l: 'Throw drop', v: 380, min: 0, max: 2800, s: 10, u: 'px/s²',
    d: 'Zero flies flat like Contra. Higher arcs it like something actually thrown — but the further it drops, the less the 45 degree lock means.' },
  { g: 'Throw', k: 'tossCooldown', l: 'Rate of fire', v: 0.28, min: 0.04, max: 0.7, s: 0.01, u: 's',
    d: 'Hold the button to keep throwing at this rate. It was 0.16 until 2026-09-20, which is FASTER than the 0.222 s throw animation — so a held button re-fired before the arm had come back and the pose froze on its last frame. Two numbers describing one action, disagreeing.' },
  { g: 'Throw', k: 'tossAnimGate', l: 'Finish the throw first', v: 1, min: 0, max: 1, s: 1, u: '', t: 'bool',
    d: 'On: a held button cannot fire again until the throw animation has played out, so every letter gets its own visible throw however long you lean on the button. Off: only the cooldown above gates it, and a short cooldown spams letters out of a frozen pose.' },
  { g: 'Throw', k: 'tossLife', l: 'Lifetime', v: 1.8, min: 0.3, max: 4, s: 0.1, u: 's' },
  { g: 'Throw', k: 'tossInherit', l: 'Carries your speed', v: 0.25, min: 0, max: 1, s: 0.05, u: '×',
    d: 'How much of his own run goes into the throw. Running forward should help a little.' },

  // ---- Knockback ----------------------------------------------------------
  { g: 'Knockback', k: 'knockX', l: 'Push back', v: 370, min: 0, max: 1000, s: 1, u: 'px/s' },
  { g: 'Knockback', k: 'knockY', l: 'Push up', v: 420, min: 0, max: 1000, s: 1, u: 'px/s' },
  { g: 'Knockback', k: 'knockLock', l: 'Control lockout', v: 0.22, min: 0, max: 1, s: 0.01, u: 's',
    d: 'How long you cannot steer after being hit. This is the number that decides whether damage is annoying or fair.' },
  { g: 'Knockback', k: 'invuln', l: 'Invincibility', v: 1.1, min: 0, max: 3, s: 0.05, u: 's' },

  // ---- Health -------------------------------------------------------------
  { g: 'Health', k: 'hpCells', l: 'Cells', v: 4, min: 1, max: 6, s: 1, u: '',
    d: 'Four to start. The bar has room for six, and the two empty outlines are there to say so — they are what a pickup would fill.' },
  { g: 'Health', k: 'hpPerCell', l: 'HP in a cell', v: 25, min: 5, max: 50, s: 1, u: '' },
  { g: 'Health', k: 'hazardDamage', l: 'Spike damage', v: 25, min: 0, max: 100, s: 1, u: 'HP' },
  { g: 'Health', k: 'dogTouch', l: 'Dog touch damage', v: 15, min: 0, max: 100, s: 1, u: 'HP',
    d: 'Under a full cell on purpose: brushing one should cost you, not gut you.' },

  // ---- The dog ------------------------------------------------------------
  { g: 'Dog', k: 'dogHp', l: 'Hits to kill', v: 3, min: 1, max: 10, s: 1, u: '' },
  { g: 'Dog', k: 'mailDamage', l: 'Damage per letter', v: 1, min: 1, max: 5, s: 1, u: '' },
  { g: 'Dog', k: 'dogSpeed', l: 'Leap speed', v: 410, min: 80, max: 840, s: 5, u: 'px/s',
    d: 'Speed DURING a hop, not the average. The average is this times the share of the cycle it spends airborne — which is how it lands near 60% of you while still being frightening at the moment it jumps.' },
  { g: 'Dog', k: 'dogLeap', l: 'Leap height', v: 380, min: 80, max: 840, s: 5, u: 'px/s' },
  { g: 'Dog', k: 'dogPause', l: 'Pause between hops', v: 0.18, min: 0, max: 1, s: 0.01, u: 's',
    d: 'Raise it and the average speed drops without the leap itself getting any less committed.' },
  { g: 'Dog', k: 'dogGravity', l: 'Dog gravity', v: 2800, min: 600, max: 8000, s: 10, u: 'px/s²' },
  { g: 'Dog', k: 'dogSight', l: 'Sight range', v: 400, min: 80, max: 1200, s: 5, u: 'px',
    d: 'It also needs clear line of sight, and it only looks behind itself within three tiles.' },
  { g: 'Dog', k: 'dogForget', l: 'Forgets you after', v: 3, min: 0, max: 10, s: 0.1, u: 's',
    d: 'Line of sight is needed to NOTICE you, not to keep chasing. Breaking sight has to feel like it worked rather than like a light switch.' },
  { g: 'Dog', k: 'dogKnock', l: 'Knocked back by mail', v: 180, min: 0, max: 800, s: 5, u: 'px/s' },
    { g: 'Enemies', k: 'dogRespawn', l: 'Comes back after', v: 0, min: 0, max: 20, s: 0.5, u: 's',
    d: 'ZERO, and it stays zero: his ruling is that enemies do not come back, which is why the level carries so many of them. Raise it only to make the sandbox easier to poke at.' },
  { g: 'Dog', k: 'dogW', l: 'Dog width', v: 52, min: 20, max: 96, s: 1, u: 'px' },
  { g: 'Dog', k: 'dogH', l: 'Dog height', v: 44, min: 16, max: 80, s: 1, u: 'px',
    d: 'Just over half his height. Much shorter and a flat throw sails over it, because he throws from the shoulder and the mail barely drops.' },

  // ---- Shared by everything that is not the dog --------------------------
  { g: 'Enemies', k: 'foeHurt', l: 'Stunned for', v: 0.25, min: 0, max: 1.5, s: 0.05, u: 's' },
  { g: 'Enemies', k: 'shotDamage', l: 'Enemy shot damage', v: 12, min: 0, max: 100, s: 1, u: 'HP' },
  { g: 'Enemies', k: 'shotLife', l: 'Enemy shot lifetime', v: 4, min: 0.5, max: 10, s: 0.1, u: 's' },
  { g: 'Enemies', k: 'shotGravity', l: 'Dropped bomb arc', v: 1040, min: 0, max: 4000, s: 10, u: 'px/s\u00b2' },

  // ---- Mailbox bot: swallow, chew, spit ----------------------------------
  { g: 'Mailbox bot', k: 'boxHp', l: 'Hits to kill', v: 3, min: 1, max: 12, s: 1, u: '' },
  { g: 'Mailbox bot', k: 'boxTouch', l: 'Touch damage', v: 15, min: 0, max: 100, s: 1, u: 'HP' },
  { g: 'Mailbox bot', k: 'boxChew', l: 'Mouth open for', v: 1.5, min: 0.2, max: 4, s: 0.05, u: 's',
    d: 'Shut, it swallows letters and takes nothing. This is the window, and it only opens because you threw something into it.' },
  { g: 'Mailbox bot', k: 'boxRecover', l: 'Still open after spitting', v: 0.6, min: 0, max: 2, s: 0.05, u: 's',
    d: 'The cooldown he asked for: it cannot swallow again until this is over, so feeding it faster than it can chew is the tactic.' },
  { g: 'Mailbox bot', k: 'boxSpit', l: 'Spit speed', v: 600, min: 120, max: 1400, s: 10, u: 'px/s' },
  { g: 'Mailbox bot', k: 'boxSpeed', l: 'Walk speed', v: 124, min: 0, max: 440, s: 2, u: 'px/s',
    d: 'It is a mailbox on legs, not a fixture. Slow and deliberate — the threat is that it closes distance while you are working out the timing, not that it can catch you.' },
  { g: 'Mailbox bot', k: 'boxSight', l: 'Notices you within', v: 380, min: 60, max: 1200, s: 5, u: 'px' },

  // ---- Drone: it dives, and it is carrying the reward --------------------
  { g: 'Drone', k: 'droneHp', l: 'Hits to kill', v: 2, min: 1, max: 10, s: 1, u: '' },
  { g: 'Drone', k: 'droneTouch', l: 'Touch damage', v: 15, min: 0, max: 100, s: 1, u: 'HP' },
  { g: 'Drone', k: 'droneSpeed', l: 'Hover speed', v: 140, min: 20, max: 600, s: 5, u: 'px/s' },
  { g: 'Drone', k: 'droneRange', l: 'Dives from within', v: 300, min: 60, max: 1000, s: 5, u: 'px' },
  { g: 'Dog', k: 'foeWake', l: 'Enemies wake within', v: 800, min: 200, max: 4000, s: 40, u: 'px',
    d: 'EVERY enemy, not just the dog — it lives in this group because there is no better one. Twenty-five tiles: a little over half a screen beyond the edge, so a thing is already doing what it does as it scrolls into view, and has not been doing it for the last five minutes. Before this, a trash panda 440 tiles away had taken its bin lid before the player pressed a button.' },
  { g: 'Drone', k: 'droneNotice', l: 'Notices you within', v: 640, min: 120, max: 2400, s: 20, u: 'px',
    d: 'Measured from where it was PLACED, not from where it is. Twenty tiles, a little under a screen: it wakes as it comes into view. Before this existed every drone in the level flew at the player from the first frame, and standing still at the spawn was fatal.' },
  { g: 'Drone', k: 'droneLeash', l: 'Chases this far from home', v: 320, min: 0, max: 1600, s: 20, u: 'px',
    d: 'Ten tiles either side of where it was placed. Past that it holds the edge of its patch and lets you go. A drone put over a pit stays over the pit, which is the whole point of putting it there.' },
  { g: 'Drone', k: 'droneDive', l: 'Dive speed', v: 600, min: 120, max: 1400, s: 10, u: 'px/s',
    d: 'It commits to the spot you were standing in, not to you. That is what makes a dive dodgeable and a homing one miserable.' },
  { g: 'Drone', k: 'droneLock', l: 'Warning before a dive', v: 0.28, min: 0, max: 1, s: 0.02, u: 's',
    d: 'It stops, tilts and lights up for this long before committing. The manifest always specified a lock clip — "the player must get a beat of warning" — but no state ever played it, so the drone dove from 300 px away with no tell at all. Set it to ZERO for the old behaviour; the dog gets 0.19 s of coil and the gnome 0.35 s of shudder, so this sits between them.' },
  { g: 'Drone', k: 'droneDiveTime', l: 'Dive lasts', v: 0.7, min: 0.1, max: 2, s: 0.05, u: 's' },
  { g: 'Drone', k: 'droneClimb', l: 'Climb back', v: 0.9, min: 0.1, max: 3, s: 0.05, u: 's',
    d: 'How long it has to get back to altitude. It is a SAFETY now, not the thing that ends the climb — the climb ends when it arrives. Out of time and still low, it hands over to the hover, which flies it the rest of the way.' },
  { g: 'Drone', k: 'droneClimbSpeed', l: 'Climb speed', v: 420, min: 40, max: 1200, s: 10, u: 'px/s',
    d: 'It used to climb at hover speed x 1.2, which is 168 px/s — against a dive that drops it 352 px in 0.7 s. It could never get home inside its own climb window, so the difference was made up by teleporting it 198 px in one frame, every dive, forever. This is the speed that actually covers the dive.' },
  { g: 'Drone', k: 'droneRest', l: 'Between dives', v: 1.4, min: 0.2, max: 6, s: 0.1, u: 's' },

  // ---- Gnome: scenery, until it is not -----------------------------------
  { g: 'Gnome', k: 'gnomeHp', l: 'Hits to kill', v: 2, min: 1, max: 10, s: 1, u: '' },
  { g: 'Gnome', k: 'gnomeTouch', l: 'Touch damage', v: 15, min: 0, max: 100, s: 1, u: 'HP' },
  { g: 'Gnome', k: 'gnomeTrigger', l: 'Wakes within', v: 120, min: 20, max: 600, s: 5, u: 'px',
    d: 'Proximity, not line of sight. The joke only works if it does not watch you coming.' },
  { g: 'Gnome', k: 'gnomeWake', l: 'Waking takes', v: 0.35, min: 0, max: 1.5, s: 0.05, u: 's',
    d: 'A beat of shuddering before it moves. Without it the ambush is unfair rather than funny.' },
  { g: 'Gnome', k: 'gnomeSpeed', l: 'Walk speed', v: 170, min: 20, max: 600, s: 5, u: 'px/s' },
  { g: 'Gnome', k: 'gnomeHop', l: 'Hops a step of', v: 440, min: 0, max: 1000, s: 10, u: 'px/s' },

  // ---- Trash panda: takes a lid and holds a line -------------------------
  { g: 'Trash panda', k: 'pandaHp', l: 'Hits to kill', v: 3, min: 1, max: 12, s: 1, u: '' },
  { g: 'Trash panda', k: 'pandaTouch', l: 'Touch damage', v: 18, min: 0, max: 100, s: 1, u: 'HP' },
  { g: 'Trash panda', k: 'pandaShield', l: 'Lid absorbs', v: 3, min: 0, max: 10, s: 1, u: ' hits',
    d: 'And only from the front. A hit that arrives travelling the way it is facing has come from behind it, and goes straight through.' },
  { g: 'Trash panda', k: 'pandaSpeed', l: 'Walk speed', v: 140, min: 20, max: 600, s: 5, u: 'px/s' },
  { g: 'Trash panda', k: 'pandaBinRange', l: 'Looks for a bin within', v: 480, min: 0, max: 1600, s: 10, u: 'px' },
  { g: 'Trash panda', k: 'pandaRange', l: 'Patrols', v: 120, min: 20, max: 600, s: 5, u: 'px either way' },
  { g: 'Trash panda', k: 'pandaLungeEvery', l: 'Bashes every', v: 2.2, min: 0.4, max: 8, s: 0.1, u: 's' },
  { g: 'Trash panda', k: 'pandaLungeRange', l: 'Bashes from within', v: 220, min: 40, max: 800, s: 5, u: 'px' },
  { g: 'Trash panda', k: 'pandaLungeTime', l: 'Bash lasts', v: 0.45, min: 0.1, max: 2, s: 0.05, u: 's' },
  { g: 'Trash panda', k: 'pandaLungeSpeed', l: 'Bash speed', v: 480, min: 80, max: 1200, s: 10, u: 'px/s' },

  // ---- The Postmaster: three phases of what you have learned -------------
  { g: 'Postmaster', k: 'bossHp', l: 'Hits per phase', v: 20, min: 1, max: 40, s: 1, u: '',
    d: 'Three phases, so sixty in total. Each phase asks a different question. Was ten a phase until 2026-09-20, when Evrtek played it and said he died too fast.' },
  { g: 'Postmaster', k: 'bossTouch', l: 'Touch damage', v: 25, min: 0, max: 100, s: 1, u: 'HP' },
  { g: 'Postmaster', k: 'bossWalk', l: 'Walk speed', v: 160, min: 20, max: 600, s: 5, u: 'px/s' },
  { g: 'Postmaster', k: 'bossPhaseGap', l: 'Pause between phases', v: 1.4, min: 0, max: 5, s: 0.1, u: 's' },
  { g: 'Postmaster', k: 'bossThrowEvery', l: 'P1: throws every', v: 1.3, min: 0.2, max: 5, s: 0.05, u: 's' },
  { g: 'Postmaster', k: 'bossShot', l: 'P1: throw speed', v: 480, min: 120, max: 1200, s: 10, u: 'px/s' },
  { g: 'Postmaster', k: 'bossDogEvery', l: 'P2: a dog every', v: 2.6, min: 0.5, max: 10, s: 0.1, u: 's' },
  { g: 'Postmaster', k: 'bossP2Throw', l: 'P2: throws every', v: 2.2, min: 0.3, max: 6, s: 0.05, u: 's',
    d: 'Added 2026-09-22: "the dog phase is too easy. He should throw mail during phase 2 also." Slower than his phase-one clock, since the dogs are the other half of it.' },
  { g: 'Postmaster', k: 'bossHigh', l: 'P3: rides this high', v: 180, min: 40, max: 400, s: 5, u: 'px' },
  { g: 'Postmaster', k: 'bossHatTop', l: 'Hat is a platform', v: 1, min: 0, max: 1, s: 1, u: '', t: 'bool',
    d: 'His cap is solid from above. Cornered against a wall you can always go UP, which is the difference between a hard fight and an unfair one.' },
  { g: 'Postmaster', k: 'bossBombEvery', l: 'P3: drops every', v: 0.5, min: 0.2, max: 5, s: 0.05, u: 's',
    d: 'Was 1.0. Evrtek 2026-09-22: "his drop rate needs to increase in frequency so there\'s more bombs falling."' },
  { g: 'Postmaster', k: 'bossBoxEvery', l: 'P3: every Nth bomb is a bot', v: 5, min: 1, max: 20, s: 1, u: '',
    d: 'Evrtek 2026-09-22: "Every 5th bomb that lands should turn into a robo mailbox." Counted on landings, not drops.' },

  // ---- Items and power-ups ------------------------------------------------
  { g: 'Items', k: 'itemBob', l: 'Hover height', v: 6, min: 0, max: 20, s: 0.5, u: 'px',
    d: 'Items hover rather than sitting on the floor. A hovering thing reads as collect-me from across a screen; a thing on the ground reads as scenery.' },
  { g: 'Items', k: 'itemBobRate', l: 'Hover speed', v: 2.4, min: 0.5, max: 8, s: 0.1, u: '' },
  { g: 'Items', k: 'pwLoseAt', l: 'Power-ups lost at', v: 50, min: 1, max: 200, s: 1, u: 'HP',
    d: 'A single hit of this much or more drops the mail tier by ONE and strips EXPRESS. Two cells is deliberately a lot: you lose them to a mistake, not to a graze.' },
  { g: 'Items', k: 'pwLoseGrenades', l: '...and the packages too', v: 0, min: 0, max: 1, s: 1, u: '', t: 'bool',
    d: 'Off: grenades survive a big hit, because they are ammunition rather than a state. On: everything goes. His call.' },
  { g: 'Items', k: 'thickSpread', l: 'Double mail spread', v: 0.13, min: 0, max: 0.6, s: 0.01, u: 'rad',
    d: 'TIER 2. Two letters per throw, fanned by this much either side of the aim, with nothing down the middle.' },
  { g: 'Items', k: 'tier3Spread', l: 'Triple mail spread', v: 0.2, min: 0, max: 0.8, s: 0.01, u: 'rad',
    d: 'TIER 3. Three letters: one straight down the aim line and one this far either side. Deliberately WIDER than the double — at the double\'s 0.13 the three would sit inside the same 15 degrees and the top tier would read as a slightly fatter double instead of a new weapon.' },
  { g: 'Items', k: 'expressSpeed', l: 'Express speed', v: 1.5, min: 1, max: 3, s: 0.05, u: '\u00d7' },
  { g: 'Items', k: 'expressRate', l: 'Express rate', v: 1.5, min: 1, max: 3, s: 0.05, u: '\u00d7' },
  { g: 'Items', k: 'ryeTime', l: 'Rye & ginger', v: 5, min: 1, max: 20, s: 0.5, u: 's',
    d: 'Invincible, and it shows. Runs down in the bar so the end never surprises you.' },

  // ---- The package: a second, heavier weapon ------------------------------
  { g: 'Package', k: 'nadeMax', l: 'Carried at once', v: 3, min: 1, max: 9, s: 1, u: '' },
  { g: 'Package', k: 'nadeSpeed', l: 'Throw speed', v: 640, min: 120, max: 1400, s: 10, u: 'px/s' },
  { g: 'Package', k: 'nadeGravity', l: 'Arc', v: 1800, min: 200, max: 4800, s: 10, u: 'px/s\u00b2',
    d: 'It is thrown, not fired. The arc is the cost of the damage.' },
  { g: 'Package', k: 'nadeFuse', l: 'Fuse', v: 1.3, min: 0.2, max: 4, s: 0.05, u: 's' },
  { g: 'Package', k: 'nadeBounce', l: 'Bounce', v: 0.35, min: 0, max: 0.9, s: 0.05, u: '\u00d7',
    d: 'How much of its speed it keeps off a wall. Zero makes it stick where it lands.' },
  { g: 'Package', k: 'nadeImpact', l: 'Goes off on landing', v: 1, min: 0, max: 1, s: 1, u: '', t: 'bool',
    d: 'On (2026-09-22): it detonates the moment it hits the ground. Off: it bounces and the fuse decides, the way it did before - and "the special attack doesn\'t really do much."' },
  { g: 'Package', k: 'nadeRadius', l: 'Blast radius', v: 128, min: 16, max: 320, s: 1, u: 'px',
    d: 'Four tiles. Was 76 (two and a bit). Evrtek 2026-09-22: "area damage and lots of it when they land."' },
  { g: 'Package', k: 'nadeDamage', l: 'Blast damage', v: 10, min: 1, max: 30, s: 1, u: '',
    d: 'Was 3, a dog\'s worth. Ten kills anything on the street outright and takes half a phase off the Postmaster; a lid does not cover it and a shut bot is blown open.' },

  // ---- The mail truck, which bookends every stage -------------------------
  { g: 'Level', k: 'truckDrive', l: 'Truck drives in over', v: 1.15, min: 0.3, max: 4, s: 0.05, u: 's',
    d: 'The whole arrival costs the player about three seconds and no input, which is why every phase of it is short.' },
  { g: 'Level', k: 'truckDoor', l: 'Door takes', v: 0.42, min: 0.1, max: 2, s: 0.02, u: 's' },
  { g: 'Level', k: 'truckPark', l: 'Parks this far off', v: 108, min: 0, max: 400, s: 2, u: 'px' },
  { g: 'Level', k: 'truckRunUp', l: 'Comes in from', v: 600, min: 120, max: 1800, s: 10, u: 'px',
    d: 'How far off screen it starts. It only has to be further than the camera can see.' },
  { g: 'Level', k: 'truckDoorX', l: 'Door is this far in', v: 124, min: 0, max: 320, s: 2, u: 'px' },

  // ---- The level ----------------------------------------------------------
  { g: 'Level', k: 'levelTime', l: 'Time limit', v: 270, min: 30, max: 600, s: 5, u: 's',
    d: 'Was 180 while a hold-right run to the boss door took 30 s, which is six times the speedrun. The level was rebuilt on 2026-09-21 to a 45 s speedrun, so the clock went to 270 to keep the same ratio — it also has to cover a sixty-hit Postmaster, who was thirty when 180 was chosen.' },
  { g: 'Level', k: 'startLives', l: 'Starting lives', v: 3, min: 1, max: 99, s: 1, u: '' },
  { g: 'Level', k: 'deathSendsBack', l: 'Death sends you back', v: 1, min: 0, max: 1, s: 1, u: '', t: 'bool',
    d: 'On: dying puts you at the checkpoint, or at the start of the level if you have not reached one. Off: it puts you back on the last ground you stood on, which is where you died — so a death cost a life and nothing else, and Evrtek noticed on 2026-09-20 that he was respawning in place.' },
  { g: 'Level', k: 'pitCostsLife', l: 'A pit costs a life', v: 1, min: 0, max: 1, s: 1, u: '', t: 'bool',
    d: 'On: falling into a bottomless gap is a death like any other — a life, the power-ups, and wherever the setting above sends you. Off: it is free. It was free, and it was not counted as a death either, which made the three gaps in level 1 the safest places in it.' },
  { g: 'Level', k: 'blockHp', l: 'Hits to break a block', v: 3, min: 1, max: 6, s: 1, u: '',
    d: 'And it looks more broken with each one, so you always know how close it is.' },
  { g: 'Level', k: 'scoreItem', l: 'Points: an item', v: 50, min: 0, max: 2000, s: 10, u: '' },
  { g: 'Level', k: 'scoreDog', l: 'Points: an enemy', v: 200, min: 0, max: 5000, s: 10, u: '' },
  { g: 'Level', k: 'scoreBlock', l: 'Points: a block', v: 10, min: 0, max: 500, s: 5, u: '' },
  { g: 'Level', k: 'scoreCheck', l: 'Points: the checkpoint', v: 500, min: 0, max: 5000, s: 50, u: '' },

  // ---- Sandbox ------------------------------------------------------------
  { g: 'Sandbox', k: 'camAnchor', l: 'He sits this far down', v: 0.655, min: 0.4, max: 0.85, s: 0.005, u: '\u00d7',
    d: 'A fraction of the screen height. 0.5 put him dead centre, which spent half the screen on the unusable dark under the street. Two thirds down shows sky instead.' },
  { g: 'Sandbox', k: 'viewH', l: 'Visible height', v: 496, min: 352, max: 680, s: 8, u: 'px',
    d: 'How much world fits on the screen. Doubling his height halved how much you can see, so this is the counterweight.' },
  { g: 'Sandbox', k: 'showReadout', l: 'Show readout', v: 0, min: 0, max: 1, s: 1, u: '', t: 'bool',
    d: 'Speed, state and frame time in the corner.' },
  { g: 'Sandbox', k: 'showLabels', l: 'Show zone labels', v: 1, min: 0, max: 1, s: 1, u: '', t: 'bool' },
  { g: 'Sandbox', k: 'uiOpacity', l: 'Button opacity', v: 0.34, min: 0.08, max: 0.9, s: 0.02, u: '' },
  { g: 'Sandbox', k: 'uiScale', l: 'Button size', v: 1, min: 0.6, max: 1.6, s: 0.05, u: '×' }
];

// Presets are starting positions to argue with, not answers. The defaults are
// the game; these lean it one way or the other.
var TUNE_PRESETS = {
  'Heavier': {
    maxRun: 180, groundAccel: 900, groundFriction: 1050, turnAccel: 1900,
    airAccel: 640, airFriction: 180, jumpVel: 392, gravity: 1060, fallGravity: 1560,
    jumpCut: 0.5, apexGravity: 0.62, apexControl: 1.15
  },

  'Snappier': {
    maxRun: 235, groundAccel: 2900, groundFriction: 3200, turnAccel: 4200,
    airAccel: 1750, airFriction: 700, jumpVel: 362, gravity: 1340, fallGravity: 2150,
    jumpCut: 0.3, apexGravity: 0.5, apexControl: 1.4
  }
};

var TUNE = {};

function tuneReset(preset) {
  for (var i = 0; i < TUNE_SPEC.length; i++) TUNE[TUNE_SPEC[i].k] = TUNE_SPEC[i].v;
  if (preset && TUNE_PRESETS[preset]) {
    var p = TUNE_PRESETS[preset];
    for (var k in p) if (k in TUNE) TUNE[k] = p[k];
  }
}

function tuneSave() {
  try {
    var blob = { __v: TUNE_VERSION, t: TUNE };
    localStorage.setItem(SAVE_KEY_TUNE, JSON.stringify(blob));
  } catch (e) {}
}

function tuneLoad() {
  tuneReset();
  try {
    var raw = localStorage.getItem(SAVE_KEY_TUNE);
    if (!raw) return;
    var blob = JSON.parse(raw);
    // An older save is discarded wholesale rather than merged: the defaults it
    // would override are decisions, not preferences.
    if (!blob || blob.__v !== TUNE_VERSION) return;
    var o = blob.t || {};
    // Only keys the spec still knows about, so a removed knob cannot resurrect.
    for (var i = 0; i < TUNE_SPEC.length; i++) {
      var s = TUNE_SPEC[i];
      var v = o[s.k];
      if (typeof v === 'number' && isFinite(v)) TUNE[s.k] = Math.min(s.max, Math.max(s.min, v));
    }
  } catch (e) {}
}
