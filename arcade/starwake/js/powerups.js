// STARWAKE 0.4.0: the six power-ups (Evrtek's set, ruled 11-06; the plan's section 6). This is the engine's table:
// what each one is called, its colour, how long it runs and what it sounds like. The pickups that carry them live in
// js/pickups/powerups/ (fly into one: it fires at once, it is never stored); main.js runs their effects.
//   Galaxy 1 (the retrofit): SHIELD CELL, OVERCLOCK. Galaxy 2 adds MIRROR SHELL and PHASE. Galaxy 3 adds RING MAGNET and
//   SLIPSTREAM. Colours: none of them red, amber or cyan (rule 9); the effect on your ship may use cyan, which is yours.
// `secs` runs on the PLAYER's time (real time): Slipstream slows the world, never these clocks.
export const POWERUPS = {
  shield: { kind: 'shield-cell', name: 'SHIELD CELL', color: 0x4dff8a, css: '#4dff8a', secs: 0, glow: 1.5, heal: 50 },
  overclock: { kind: 'overclock', name: 'OVERCLOCK', color: 0xff4fd8, css: '#ff4fd8', secs: 6, rollCool: 0.10 },
  mirror: { kind: 'mirror-shell', name: 'MIRROR SHELL', color: 0xeef2ff, css: '#eef2ff', secs: 8, reach: 1.5 },
  phase: { kind: 'phase', name: 'PHASE', color: 0x9b6bff, css: '#9b6bff', secs: 4 },
  magnet: { kind: 'ring-magnet', name: 'RING MAGNET', color: 0xb8ff40, css: '#b8ff40', secs: 8, reach: 6 },
  slip: { kind: 'slipstream', name: 'SLIPSTREAM', color: 0x4a64ff, css: '#4a64ff', secs: 4, scale: 0.5, ease: 0.25, snap: 1.4 },
};
export const POWERUP_IDS = Object.keys(POWERUPS);
export const kindToId = (name) => POWERUP_IDS.find((id) => POWERUPS[id].kind === name) || null;
// how close counts as flying into one: more generous than a ring (2.4 m against 1.75 m)
export const PICK_R = 2.4;
// The sound hooks. Each is a whole ElevenLabs take in audio/sfx/<name>.{ogg,mp4}, from the sound branch; until one is
// listed in audio/sfx/manifest.json the game plays nothing for it (and asks the server for nothing, so no 404s).
//   pu-<id>       the pickup (a charge chord for the cell, a ratchet for overclock, a glassy shimmer, a reversed whoosh,
//                 a magnetic thrum, a time drop)
//   pu-tick       the shared three-tick warning in a power-up's last second
//   pu-mirror-ping  each deflect while the Mirror Shell runs     pu-phase-pass  passing through something solid
//   pu-magnet-clink a ring drawn in by the magnet                 pu-slip-out    the reversed swell into the snap-back
export const POWERUP_SFX = POWERUP_IDS.map((id) => 'pu-' + id).concat(['pu-tick', 'pu-mirror-ping', 'pu-phase-pass', 'pu-magnet-clink', 'pu-slip-out', 'pu-cache']);
export const POWERUP_SFX_GAIN = { 'pu-tick': 0.45, 'pu-mirror-ping': 0.4, 'pu-phase-pass': 0.55, 'pu-magnet-clink': 0.35, 'pu-cache': 0.6 };
