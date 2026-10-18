'use strict';
// ---------------------------------------------------------------------------
// Ruling 1 (Evrtek, 2026-09-19): the title is a real person's name and has to
// stay removable. It lives here and NOWHERE else — not in a filename, not in a
// folder name, not in a save key, not in an identifier. Changing this one line
// changes the game's name everywhere it is ever shown.
// ---------------------------------------------------------------------------
var GAME_TITLE = 'HAINES TALES';

// The title screen's other strings. Here rather than in title.js for the same
// reason the name is: one place to change them, and the prompt in particular is
// a thing Evrtek said he would judge once it was blinking on a screen rather
// than on paper. PLAYER 1 - START is arcade idiom and a console would have said
// PRESS START; the cabinet framing earns the arcade register, and this is the
// one line that changes it.
var GAME_PROMPT = 'PLAYER 1 - START';
var GAME_PROMPT_TOUCH = 'TOUCH TO START';
var GAME_MAKER = 'EVRTEK';

var GAME_VERSION = '0.10.1';

// Deliberately generic, for the same reason.
var SAVE_KEY_TUNE = 'mailrun.tune.v1';

// Bumped whenever a DEFAULT changes in a way a stale save must not override.
// Without this, a tune saved before a ruling quietly reinstates what the ruling
// removed — enemy respawn came back from the dead exactly that way.
var TUNE_VERSION = 10;  // 8: bossBombEvery 1.0 -> 0.5, bossP2Throw, bossBoxEvery; 9: nadeImpact, nadeRadius 128, nadeDamage 10 (2026-09-22); 10: tier3Spread 0.2 — the envelope weapon has three tiers (2026-09-23)
