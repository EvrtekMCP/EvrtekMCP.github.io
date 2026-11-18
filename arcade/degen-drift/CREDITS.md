# CREDITS

**DEGEN DRIFT** ("Grip is for quitters."), a drift game by **REIMERTEK STUDIOS**: six cars, fifteen courses in five regions, and downhill duels.

**Design:** Evrtek's idea and rulings, among them:
- drift the course for points, star tiers all the way to DEGENERATE;
- the zone scoring: a zone on every corner, a sweet spot, linking zones for the multiplier, walls wiping the chain;
- fictional cars and tracks, upgrades and tuning, earned by play only;
- car damage that costs money to repair, never so much that a player gets stuck;
- WASD and a handbrake on computers; a phone held sideways with three throttles to try: a slider, "more thumb", and plain gas and brake.

Dirigent planned the full game, the cars and the economy. Indaga researched what phones report about touch pressure.

**Build:** Fundi. Every line of game code is original.

**Key art, app icon and share image:** painted by **Portero**, commissioned by Evrtek (the studio's outside hand, Exchange job 001, 2026-11-15). Made with built-in image generation from the studio's brief; the provenance record is `art/incoming/portero-001-key-art/MANIFEST.md`.

**Car designs:** **Portero**, commissioned by Evrtek (the studio's outside hand, Exchange job 002, 2026-11-16): a turnaround sheet for each of the six cars, side, front, rear, top and three-quarter. Made with built-in image generation from the studio's brief; the provenance record is `art/incoming/portero-002-car-turnarounds/MANIFEST.md`. The cars in the game are built in code from his sheets.

**Art:** drawn in code by Fundi:
- the DEGEN DRIFT wordmark and its letterforms;
- the DEGENERATE badge, the stars and the part illustrations;
- the six cars, KESTREL, VANTA, HALBERD, ORBIT, SPECTRE and ZENITH, modelled in code from Portero's designs (their shapes measured off his sheets);
- the fifteen courses, their five regions and the scenery.

Textures are drawn at load time; the only image files are Portero's (the key art, icons and share image) and the wordmark.

**Sound:** built by Fundi (the sound set in `audio/`, switched on in this build; a small placeholder synthesized in the browser remains only as a fallback):
- every car's engine under Settings > Engine sound: New (the default) is synthesized in real time, in house: a combustion model built from each engine's firing pulses and exhaust pipes (after the method of Baldan et al., "Physically informed car engine sound synthesis for virtual and augmented environments", 2015; no code taken), with the tires' squeal in three layers. Its small recorded layer is whole takes: the turbo's blow-off and compressor flutter, generated with **ElevenLabs** sound effects (`eleven_text_to_sound_v2`), 2026-11-18, and the KESTREL set's squeal loops and two exhaust bangs;
- the KESTREL's engine and tires under Engine sound: Recorded are recordings: its engine at four rev bands on and off the throttle, its blow-off valve and exhaust pops, and the tire squeal, chirps, road roar, gravel and kerb, generated with **ElevenLabs** sound effects (`eleven_text_to_sound_v2`), 2026-11-17, and used as whole takes (cut and looped only), crossfaded and pitched by the revs as the game plays;
- the other cars, and every car under Engine sound: Classic (every engine, the turbos, blow-off valves and flutter, overrun pops, the rev limiter, the tires, kerbs, gravel, road), and the wind for all of them, are synthesized in real time, in house, from the numbers in `audio/car-sounds.js`;
- the recorded effects (wall hits, nitrous, the gearbox clunk, interface sounds, the countdown, the star and DEGENERATE fanfares) were generated with **ElevenLabs** sound effects (`eleven_text_to_sound_v2`), 2026-11-15;
- the music, four original instrumental tracks, was generated with **ElevenLabs Eleven Music** (`music_v2_5`), 2026-11-15, and is used as whole takes, edited only where each one loops (on bar lines);
- every request (prompt, length, file) is in `audio-src/generation-log.jsonl`, the music requests in `audio-src/requests/`.

## What this folder holds

- **Code:** the game's own ES modules (`js/`) and one third-party library, vendored and pinned: **three.js r170** (`vendor/three/three.module.min.js`), © 2010-2024 three.js authors, MIT licence (`vendor/three/LICENSE`).
- **Images:** Portero's key art as WebP (`art/key-art-1920.webp`, `art/key-art-1280.webp`), icons (`icon-64.png`, `icon-180.png`, `icon-512.png`) and share image (`og-degen-drift.jpg`), all made from his delivery; the wordmark `art/wordmark.svg`, drawn in house.
- **Type:** whatever fonts the device already has. No font files.
- **Sound:** `audio/`: the sound module and its synthesis (code), 26 recorded effects, the KESTREL's 16 recorded engine and tire takes (`audio/rec/kestrel/`), the combustion engine's two turbo takes (`audio/rec/synth2/`) and four music tracks (Ogg Opus, with AAC copies for Safari; the music streams in short chunks). The WAV masters stay in `audio-src/` and do not ship.
- **No external requests and no analytics.** The game loads nothing from outside its own folder.
- **Saved data:** progress and settings stay in this browser's local storage.

## Reference

- **Mulberry32** (Tommy Ettinger, public domain): the seeded random-number generator that places the scenery.

## Trademark note

DEGEN DRIFT is an original game. Its cars, courses, names and art are its own. The cars are fictional, with no real make and no badges. It is not affiliated with, sponsored by or endorsed by any carmaker or any publisher of any game it may remind you of.

© Evrtek. All original code.
