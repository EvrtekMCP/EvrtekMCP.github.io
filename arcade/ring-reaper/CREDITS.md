# CREDITS

**RING REAPER**, an arcade space-runner by **REIMERTEK STUDIOS**. Version 0.5.0: three galaxies of ten levels, twelve bosses and six power-ups.

*Formerly STARWAKE, renamed 2026-11-08.*

**Design:** Evrtek's concept and rulings, among them:
- the double-tap roll and its cooldown;
- the shield bar;
- "genre, not copy";
- the degenerate scoring;
- no pop-in;
- the level order;
- the press-to-start;
- the menu music;
- two more galaxies, each a little harder than the last, with new enemies and bosses on levels 3, 6, 9 and 10;
- the six power-ups, flown into and never stored (Shield Cell, Overclock, Mirror Shell, Phase, Ring Magnet, Slipstream).

The MCP planned the first ten levels; CLU planned galaxies 2 and 3 and the power-ups. Quorra researched level design and wrote the checklist every level was built to.

**Build:** CLU. Level 1 and the level framework, then one CLU per level for levels 3 to 10, and a sound CLU. For galaxies 2 and 3, an integrator CLU (the galaxy engine, the power-ups, the menus) and eight builder CLUs, three levels or a finale each, with a sound CLU. Every line of game code is original.

**Art: Yori.**
- The RING REAPER wordmark and all the call-out lettering, from GRAZE! to DEGENERATE.
- The Wake.
- The Lattice enemies and the four bosses: the Warden, the Leviathan, the Twins and the Lattice Heart.
- The Verdant Deep's creatures and its bosses (the Whirlmaw, the Snare, the Murmur, the Rootmind), and the Unmade's machines and its bosses (the Foreman, the Counterfeit, the High Roller, the Weftwork).
- The six power-ups, their icons and the galaxies' call-outs.
- Every level's look and scenery.
- The REIMERTEK STUDIOS logo (The Portal) on the opening splash.
- The launcher, the loading screen, the galaxy chart, each galaxy's sector map and level select, the icons, the share card and the cabinet art.
- Her 2D art is drawn in code by her own renderer. Her ship, enemy, boss and scenery designs are vertex lists that the game builds into 3D at run time. No model files are loaded.

## What this folder holds

- **Code:** the game's own ES modules (`js/`) and one third-party library, vendored and pinned: **three.js r170** (`vendor/three/three.module.min.js`), © 2010-2024 three.js authors, MIT licence (`vendor/three/LICENSE`). Nothing else third-party. A few `DESIGN.md` files under `js/levels/` are the builders' design notes.
- **Images:** Yori's PNGs in `art/` (and the studio logo's two SVGs in `art/studio/`), and her icons and share card in the root. Every other picture is drawn at run time.
- **Audio:** every file comes in two formats: Ogg Vorbis at about 256 kbps (`.ogg`), and AAC at 256 kbps (`.mp4`) for Safari.
  - **Music:** galaxy 1: one track per level (`audio/music.*` and `audio/levels/levelN/`), one per boss (`audio/bosses/`), the three parts of the finale (`audio/levels/level10/`), and a deep-house track for the menus (`audio/menu/`). Galaxies 2 and 3: one track per level (`audio/g2/levelN/`, `audio/g3/levelN/`), one per boss (`audio/g2/bosses/`, `audio/g3/bosses/`) and the three parts of each finale (`audio/g2/level10/`, `audio/g3/level10/`). Where a galaxy 2 or 3 track is not made yet, that level plays a galaxy 1 track in its place.
  - **Effects:** the effects in `audio/` and `audio/sfx/`.
  - **How it was made:** all of it was generated with **ElevenLabs** (Eleven Music and its sound-effects model) on Evrtek's account, from original text prompts that name no artist, track or game. Each file is a whole take. The only edits are trimming silence, short fades, one static gain, and the loop points (on bar lines). One exception, by Evrtek's pick: the multiplier sound (`audio/sfx/mult-15`) is the original combo effect cut before its shimmer and with its top end rolled off (a low-pass filter above 1.5 kHz), to take the harshness out.
  - **What was not done:** nothing is layered, and no sound is synthesised in code. The prompts and every generation are logged in the game's source repository.
- **Type:** whatever monospace font the device already has. No font files.
- **No external requests.** The game loads nothing from outside its own folder.

## Reference

- **Mulberry32** (Tommy Ettinger, public domain): the seeded random-number generator that lays out each level, so every run flies the same course.

## Trademark note

RING REAPER is an original game in the forward-flying rail-shooter genre. Its ship, enemies, bosses, names, levels and music are its own. It is not affiliated with, sponsored by or endorsed by any publisher of any game it may remind you of.

© Evrtek. All original code.
