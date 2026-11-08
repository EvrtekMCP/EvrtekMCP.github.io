# GALAXY 3, LEVEL 10: THE WEFTWORK (CLU, g3-d, 2026-11-06 night)

**Headline (rule 20, one sentence, no "and"):** the finale cuts the last thread of the engine that weaves the Lattice.
The plan's 4.10 is the spec; where it was silent, the calls I made are marked **(my call)**.

The last level of the whole game. Three acts, a boss, the unravel and the run home, each on its own part of the music:
`g3/level10/warp` (145 bpm), `shed` (152) and `weftwork` (156), all D minor. The course is laid out in BARS
(`grid.js` turns a bar into seconds), so every set piece, speed step and the boss's entrance sits on a bar line of
the take that is playing (rule 30).

**Music today.** The three takes wait on ElevenLabs credits. Until they land, the engine plays galaxy 1's finale takes
in their place, by position (warp on the approach, shed on the dive, weftwork on the core). Their bar maps are the
same, bar for bar, so the level flies to a beat now. When the real takes land, `grid.js`'s three lines take each
take's own `bpm` and `firstBeat`, and nothing else changes. The boss reads its beat off the playing take at run time,
so it is right with either.

## Rule 19, the four acts
| act (rule 19) | what | the idea in it |
|---|---|---|
| introduce | ACT 1 THE WARP | the loom from outside; WARP THREADS that ring when a shuttle passes; then the roll call of galaxy 3, in order |
| develop | ACT 2 THE SHED | the dive between the loom's layers at 190-215 m/s: HEDDLES, the shed planned white before the layers move |
| twist | ACT 3 THE WEFTWORK | the boss: call and response; the beater's combs; THE SHEAR, the one thing in the galaxy you cannot roll back |
| master | THE UNRAVEL, THE RUN HOME | the loom comes apart; outrun it on known hazards only; then every unmade star lit again, and home |

## The two new obstacles
- **WARP THREAD** (`js/obstacles/g3-warp-thread`). Yori's taut red thread across the lane between two steel spools,
  40 m long, at any angle. Taut, it is a line to skim (a CLOSE call). Plucked: for 1.2 s (the first 1.6 s) it brightens
  and hums, and the plan of its lens draws in white from the shuttle's spool. Then her shuttle zips along it, and it
  RINGS. The blur of a ringing string is a lens across the lane, widest in the middle (B, 1.6-2.4 m each way). Be
  outside the lens when it reaches you. **(My call:** the plan's "sweeps sideways" is played as the string's ring. A
  plucked string swings to both sides, so its blur is a lens: deterministic, readable, and true to a loom.**)**
- **HEDDLE** (`js/obstacles/g3-heddle`). Yori's heddle frame holding two layers of ultraviolet warp, one hanging from
  above and one standing from below. The gap between them is the SHED, the only way through. 1.3 s (the first 1.6 s)
  before the layers move, the shed's plan draws in white where it will be when you arrive. Then both layers slide
  there together and hold. **(My call:** her heddle has one central slot that rising cannot move. The plan says "whole
  layers of thread rise and fall around you" and calls the act THE SHED, the gap between the layers, so the game builds
  her layer twice, above and below, and moves the gap.**)**

## Beat sheet (rule 1; calm / rising / peak). The `beats` field in level10.js is the same list in metres.
ACT 1, THE WARP (warp take bars 1-56, about 96 s; 104 -> 155 m/s in four steps, each on a section line)
| bars | tag | beat |
|---|---|---|
| 1-8 | calm | the whole Weftwork on the horizon; rings in the open; the first warp thread alone, humming, its plan white (rules 4, 18) |
| 9-24 | rising | the roll call: blueprint walls (1), shuttlers (2), a lockgate (3), augurs (4), warp threads between; RING MAGNET into the field of cut-thread rings |
| 25-32 | rising | the speed step first; then plotters (5), crossed threads, forgeries (6) |
| 33-48 | peak | OVERCLOCK into the riveters (7); fractals (8); two bars of rings; MIRROR SHELL into the shuttle crossfire; the vault (9) |
| 49-56 | calm | THE WEAVE PARTS: nothing shoots; PHASE through a thread wall to a cache; the shed opens ahead |

ACT 2, THE SHED (shed take bars 1-48, about 80 s; 190 -> 215 m/s, the fastest in the game)
| bars | tag | beat |
|---|---|---|
| 1-4 | rising | the dive: the layers of warp close round you; rings down the middle |
| 5-20 | rising | heddles: the first alone with a 1.6 s plan, then one every other bar, then every bar, up and down |
| 21-23 | peak | SLIPSTREAM on the line, then the gauntlet: five heddles, one every half bar (beatable at full speed: stars never assume it). Two bars, because the slow motion covers about a bar and a half of course |
| 24-28 | calm | rings only, while the snap-back (x1.4) catches the course up to the music |
| 29-44 | peak | the deep shed at 215 m/s: heddles every bar, plucked threads, giant shuttles racing past; bars 37-38 rings only |
| 45-48 | calm | out onto the Weftwork; a SHIELD CELL at the shed's end, another at the boss's door |

ACT 3, THE WEFTWORK: the boss (its own section below).

THE UNRAVEL and THE RUN HOME (the weftwork take from bar 37, once, to its end)
| bars | tag | beat |
|---|---|---|
| Snap 37-44 | calm | the loom comes apart round you, threads whipping outward; the first unmade stars light (the first 800 m are empty, the engine's rule) |
| Build 45-52 | rising | back up to 150 m/s; rings; loose threads ringing slow, wide and known |
| Unravel 53-68 | peak | outrun it at 220 m/s: threads and falling heddles, every one known, generous (4 m sheds, 1.6 s plans), a breath in the middle (rule 5: spectacle, not a spike) |
| Peak 69-84 | calm | the run home: every unmade star shining again, galaxy 2's freed star, galaxy 1's quiet blue planet at sunrise, one sky; a slow corkscrew of rings; nothing can hurt you |
| Outro 85-90 | calm | the finish as the take's last bar dies away; LEVEL CLEAR, then Yori's GALAXY CLEAR over the sunrise; the tally; the credits roll (the engine's) |

The hardest stretches are the deep shed and the fight, about two thirds of the way in (rule 5). The unravel is fast
and loud but asks only what you already know.

## The boss: THE WEFTWORK (`js/bosses/g3-weftwork`)
Yori's loom at 2.4x (96 m across): posts, beams, the warp running toward you above and below the lane, the giant
shuttle on its rail, the beater (a comb of ten red reeds) and the shear's two white-hot blades at its sides.

**Call and response.** Each loop is four bars of its track (the Call and Beat sections loop, 32 bars, eight loops):
| bar | what happens |
|---|---|
| 1 THE CALL | the loom draws its pattern in white along the comb's lower roots: the shuttle's path, a mark on each note's reed flashing (and chiming) on its beat, and that reed outlined white |
| 2 THE RESPONSE | the shuttle runs the path for real and fires a red bolt on every note |
| 3 | each bolt takes exactly one bar (no ease), so the bolts reach you in the rhythm the call showed: roll on the notes. Each note keys its reed: the reed's roots light as its bolt arrives (rule 25), and a bolt you roll home flies to a lit root |
| 4 | the beater beats up; thread-light spills |

| phase | notes per loop | what is added (rule 24) |
|---|---|---|
| THE CALL (to 70%) | two, three beats apart | the idea alone |
| THE BEAT (to 25%) | a pair half a beat apart (one roll takes both) and one more | the beater SLAMS twice a loop: a comb of reeds driven at you, its one gap planned on the beater a bar before; the slams sit between the volleys |
| THE SHEAR (the last 25%, the shortest) | the same three | one slam, then THE SHEAR between the last volleys: two white-hot blades close across the lane, the gap planned in white 1.5 s before; it cannot be rolled back. Its gaps run left, right, middle |

Notes are always three beats apart, or a pair half a beat apart, never between: the roll recharges in 0.95 s. Each
phase's pattern is fixed, so the third time round you know it by heart (rule 28). The fight runs on the music's clock:
every loop starts on the take's Call bar line, read live from the playing take, and on its own clock from the same grid
when there is no music.

Ten reeds, two hits each (20). Every hit spills thread-light (amber: rule 9; shield and points, not a ring), a cut reed
spills two, and every loop spills one, so the shield can be won back while the fight holds the course (rule 7). After
150 s unbeaten the loom tears itself apart anyway and the unravel plays (rule 26), with no boss bonus. Every hit buys
3 s (galaxy 1's finale rule), so only a ship that has stopped hurting it is timed out: the decent human bot brought it
to 10% in 150 s before this, and a person who is still landing hits should get to finish it.

**Weak points (my call):** her sheet marks both roots of every reed. The game makes the lower root of each reed one weak
point with two hits. With twenty one-hit roots, a pair rolled home together would often fly to the same root, and the
second bolt would be wasted.

## Power-ups (the plan's 6; seven, the finale's allowance)
| power-up | where | why |
|---|---|---|
| RING MAGNET | warp bar 20, on the line into the field of cut-thread rings | a scattered field (every ring in reach without it) |
| OVERCLOCK | warp bar 33.6, at the roll call's riveter stretch | riveter strings, roll on every stitch |
| MIRROR SHELL | warp bar 42.6, before the shuttle crossfire | shuttles on both rails firing together |
| PHASE | warp bar 50, in the parting | through a thread wall to a cache (9 cache rings, never in the total) |
| SLIPSTREAM | shed bar 20.6, before the heddle gauntlet | a heddle every half bar; the calm after it absorbs the snap-back |
| SHIELD CELL | shed bar 45.2, the shed's end | after the deep shed |
| SHIELD CELL | shed bar 47.6, at the Weftwork's door | the calm before it flies in |
None during the fight: its struck reeds spill thread-light. Slipstream is 55 s from the nearest Overclock or Mirror Shell.

## Warning times (rule 12; `node tools/check-levels.js 3-10` checks every spawn at GREED speed)
- warp thread: hum and plan 1.2 s (the first 1.6), then 0.6 s from the pluck to you: 1.8 s at worst (new: floor 1.2).
- heddle: plan 1.3 s, move 0.55, hold 0.45: 2.3 s at worst.
- thread wall: static, in sight from 580 m.
- the boss: every bolt is called a bar ahead, then flies a bar (about 1.6 s); a comb's gap is planned a bar before it
  leaves the loom, then it takes a bar to reach you; the shear's gap is planned 1.5 s before it closes.
Everything is timed by time to arrival (-z / speed), never the clock, so a tell always runs its full length.

## Colour (rule 9)
Red is the threads that hurt, the reeds and the bolts. The scenery's warp runs are dim ultraviolet, with dark wine only
on the far runs, well clear of the lane. The loom beams' hanging red guides are left off **(my call)**, because they
read as more hazard threads. Rings stay amber, thread-light is amber, your shots cyan, the plans white, the shear
white-hot, and the run home gold and blue.

## Measured (11-07, g3-d; galaxy 1 placeholders in the roll call until g3-a/b/c land)
| check | result |
|---|---|
| check-levels 3-10 | PASS: 413 rings + 9 cache; worst warnings: warp thread 1.80 s, heddle 2.30 s (floor 1.2) |
| non-god pop-in run (autopilot), on 7611453 | ALL PASS: the whole level cleared (392/413 rings, 2 hits), nothing popped in or appeared under 150 m, no errors, 129 fps desktop |
| boss bots, on 7611453 | ALL PASS: never-roll cannot hang it (it tears itself apart at 150 s); always-roll beats it, every phase, 22 deflects for 20 hits |
| decent human bot, the fight alone | beaten on seeds 1-3 (lowest shield 22, 81, 31) |
| decent human bot, whole level | cleared on seeds 1-3: rings 89/91/90%, hits 7/8/6, lowest shield 47/45/76, boss beaten each time |
| good human bot, power-ups ignored | cleared on seeds 1-3: rings 94/92/91%, hits 4/6/5 |
| devpop (every dev jump) | ALL PASS; also with g3-a's and g3-b's real kinds in a local preview merge |
| phone proxy (390x844, DPR 3) | unthrottled: 123 fps in the roll call (galaxy 1's finale: 121). CPU x4: the deep shed 66 fps, the fight 61 (galaxy 1's finale fight: 62.5) |
| kinds gallery | every kind square to the lane; no console errors |
The ring shares: every bot ranked DEGENERATE on the plan's 25/50/65/75/85, so the MCP passed the global gates
(30/60/80/90/95) to CLU-I with the curve re-base, to be re-measured once the roll call has its real kinds.
