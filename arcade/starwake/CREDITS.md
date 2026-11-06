# CREDITS

**STARWAKE**, an arcade space-runner by **REIMERTEK STUDIOS**. Version 0.2.0: ten levels and four bosses.

**Design:** Evrtek's concept and rulings, among them:
- the double-tap roll and its cooldown;
- the shield bar;
- "genre, not copy";
- the degenerate scoring;
- no pop-in;
- the level order;
- the press-to-start;
- the menu music.

The MCP planned the ten levels. Quorra researched level design and wrote the checklist every level was built to.

**Build:** CLU. Level 1 and the level framework, then one CLU per level for levels 3 to 10, and a sound CLU. Every line of game code is original.

**Art: Yori.**
- The STARWAKE wordmark and all the call-out lettering, from GRAZE! to DEGENERATE.
- The Wake.
- The Lattice enemies and the four bosses: the Warden, the Leviathan, the Twins and the Lattice Heart.
- Every level's look and scenery.
- The launcher, the loading screen, the sector map and level select, the icons, the share card and the cabinet art.
- Her 2D art is drawn in code by her own renderer. Her ship, enemy, boss and scenery designs are vertex lists that the game builds into 3D at run time. No model files are loaded.

## What this folder holds

- **Code:** the game's own ES modules (`js/`) and one third-party library, vendored and pinned: **three.js r170** (`vendor/three/three.module.min.js`), © 2010-2024 three.js authors, MIT licence (`vendor/three/LICENSE`). Nothing else third-party. A few `DESIGN.md` files under `js/levels/` are the builders' design notes.
- **Images:** Yori's PNGs in `art/`, and her icons and share card in the root. Every other picture is drawn at run time.
- **Audio:** every file comes in two formats: Ogg Vorbis at about 256 kbps (`.ogg`), and AAC at 256 kbps (`.mp4`) for Safari.
  - **Music:** one track per level (`audio/music.*` and `audio/levels/levelN/`), one per boss (`audio/bosses/`), the three parts of the finale (`audio/levels/level10/`), and a deep-house track for the menus (`audio/menu/`).
  - **Effects:** the effects in `audio/` and `audio/sfx/`.
  - **How it was made:** all of it was generated with **ElevenLabs** (Eleven Music and its sound-effects model) on Evrtek's account, from original text prompts that name no artist, track or game. Each file is a whole take. The only edits are trimming silence, short fades, one static gain, and the loop points (on bar lines).
  - **What was not done:** nothing is layered, and no sound is synthesised in code. The prompts and every generation are logged in the game's source repository.
- **Type:** whatever monospace font the device already has. No font files.
- **No external requests.** The game loads nothing from outside its own folder.

## Reference

- **Mulberry32** (Tommy Ettinger, public domain): the seeded random-number generator that lays out each level, so every run flies the same course.

## Trademark note

STARWAKE is an original game in the forward-flying rail-shooter genre. Its ship, enemies, bosses, names, levels and music are its own. It is not affiliated with, sponsored by or endorsed by any publisher of any game it may remind you of.

© Evrtek. All original code.
