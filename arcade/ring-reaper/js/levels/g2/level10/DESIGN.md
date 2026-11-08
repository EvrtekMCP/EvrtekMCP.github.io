# GALAXY 2, LEVEL 10: THE ROOTMIND (CLU, g2-d, 2026-11-06 night)

**Headline (rule 20, one sentence, no "and"):** the finale cuts a living star free of the machine strangling it.

Three acts, a boss and a release, each on its own part of the music (`audio/g2/level10/canopy`, `taproot`,
`rootmind`: 140, 146 and 150 bpm, all F minor, by the sound branch's plan). Until ElevenLabs credits return, the
engine plays galaxy 1's finale parts in their places (canopy: approach, taproot: dive, rootmind: core; the sound
branch built the new parts on the same bar maps, bar for bar). The course is laid out in BARS through the `GRID`
table in `level10.js`, which holds the stand-ins' measured grids tonight. **When the takes land, copy each one's
`bpm` and `firstBeat` from its `.json` into `GRID`; nothing else moves.**

## Rule 19, the four acts
| act (rule 19) | what | the idea in it |
|---|---|---|
| introduce | ACT 1 THE CANOPY | the Rootmind from outside; the root-whip taught alone; one wave from every level of the Deep, in order |
| develop | ACT 2 THE TAPROOT | the dive down the main root at galaxy 2's top speed: sap knots taught alone, Phase through a root wall, the knot crossfire |
| twist | ACT 3 THE ROOTMIND | the boss you orbit; its starfire, the one thing in the Deep you cannot send back |
| master | THE RELEASE | the star's first breath, the flare carrying you out at 210 m/s past known whips, then the Deep swimming home with you |

## Beat sheet (rule 1). The `beats` field is the same list in metres.
ACT 1, THE CANOPY (canopy bars 1-56, about 96 s; 100 -> 150 m/s in three steps, each just after a section line)
| bars | tag | beat |
|---|---|---|
| 1-8 | calm | the Rootmind far ahead, up and right (where the fight will be); rings in the open; the first root-whip alone, a 1.6 s tell, the way past lit with rings (rules 4, 18) |
| 9-24 | rising | the roll call: Tideway's current, the Shoals, the Drumreef's thrummer, the Migration's hounds and calf; whips between |
| 25-32 | rising | the speed step first; then Gravity Garden's wells and the Tangle's leeches |
| 33-48 | peak | THE CROWN: Overclock, then Bloomfall's barrage (a roll every 1.2 s for 7 s), Angler's Deep, the Murmuration's flock, a pair of whips from both sides |
| 49-56 | calm | THE MOUTH: nothing hurts; a Shield Cell; the star looms; the rings lead into the taproot |

ACT 2, THE TAPROOT (taproot bars 1-48, about 79 s; 180 -> 205 m/s)
| bars | tag | beat |
|---|---|---|
| 1-4 | rising | into the root: Yori's tunnel rings close round you |
| 5-20 | rising | sap knots: the first alone (one bolt, a 1.7 s swell), the next two bars apart, then one a bar; whips on bars of their own, and from bar 13 the root answers each whip with a knot half a bar later (g2-roll) |
| 21-28 | rising | Phase on the ring line; 2.3 s later THE ROOT WALL across the right half, its crack, the cache behind it; the open way left; then the Mirror Shell; a knot at 24.5 (g2-roll) |
| 29-44 | peak | THE KNOT CROSSFIRE at 205 m/s: one knot on bar 29, then knots on both walls on one bar, fans of three, and a lone knot half a bar after each whip (g2-roll); bars 37-38 rings only (rule 2) |
| 45-48 | calm | out into the cage, slowing to 72 m/s; a Shield Cell; the star turning beside you |

ACT 3, THE ROOTMIND (the boss; the rootmind part loops its Grip and Starfire, bars 5-36)
| phase | loop (4 bars, 6.4 s) | what is new (rule 24) |
|---|---|---|
| THE GRIP | knot volleys bars 1, 2 and 3, whip bar 4 (g2-roll; was knot, whip, knot); every second volley of the fight bursts as a net | the star turns the next knot round to you (0.75 bar), it whitens for 1.2 s, fires a fan of three on the bar; one roll sends the fan home into that knot. A root-whip lashes through where you are, 2.8 s after it shoots out of its anchor |
| THE STARFIRE | knot volley, STARFIRE, knot volley, knot volley (g2-roll: the third lands in the next loop's first bar) | a gap in the roots brightens white-green for 1.3 s, then a white-hot band crosses the lane for 1 s. Bands come in a fixed order: high, low, both edges (the middle safe), the middle |
| THE LAST ROOT | the taproot's swing; every second swing its volley bursts as a net (g2-roll) | the shortest: the taproot swings round from behind the star (1.5 bars), its huge knot opens white, fires a tight volley; one send-back per swing, three and the root lets go |
Eight knots of two hits each (16) and the taproot's three: 19. The star only ever turns one way, three knots in every four
bars (g2-roll; it was one every two), skipping the burnt-out ones, so the rhythm is the music's and the third loop is known (rules 28, 30). A burnt-out
knot's root loses its red seams and pales toward silver: the graft dies root by root, in plain sight. Every hit spills
sap-light and every loop spills one more (rule 7). After 120 s unbeaten the star tears itself free anyway and the
release plays with no boss bonus (after 135 s); every hit buys 3 s, so only a ship that stops hurting it is timed out (rule 26).

THE RELEASE (the rootmind part from its Breath, once, to the end)
| bars | tag | beat |
|---|---|---|
| Breath 37-44 | calm | THE STAR IS FREE: its roots silver and opening, its first breath of light; the first 800 m are empty (the engine's rule) |
| Build 45-52 | rising | the flare carries you out; silver roots lift out of your way; the current's green streaks |
| Release 53-68 | peak | ride the flare at 210 m/s: known whips only, every other bar, 1.4 s tells; two bars to breathe at 61-62 (rule 5: spectacle, not a spike) |
| Peak 69-84 | calm | the Deep set free swims home with you: star-whales, the Whirlmaw, the Snare, a cloud of moths. Nothing can hurt you |
| Outro 85-90 | calm | the finish line as the part's last bar dies; the herd swims on ahead; then GALAXY CLEAR and THE UNMADE IS OPEN (the engine's end card) |

## Warning times (rule 12; `node tools/check-levels.js 2-10` checks every spawn at GREED speed)
- root-whip (new here, floor 1.2 s): bark splits for 1.2 s (1.6 s the first time), a 0.28 s lash ending 0.8 s before it reaches you: 2.28 s at worst.
- sap knot (new here, floor 1.2 s): it swells 1.3 s (1.7 s the first), then 1.25 s x ease.shot of flight: 2.50 s at worst.
- root wall: static, in sight from READ_D: 2.31 s at 196 m/s in GREED.
- boss: knot fans 1.2 s whitening + 1.25 s flight; every second volley a net (g2-roll, the MCP's ruling 11-07: 7 bolts landing together 0.4 s after the bar), 1.2 s whitening + 0.4 s; starfire 1.3 s gap glow and ghost; whips 2.8 s from birth; the taproot's knot opens 1.6 s before its volley.
- every timer runs on time to arrival (-z / speed), never the clock, so a tell always runs its full length at any speed.
- the cap: never more than three roll moments in any 3 s (checked from the event list: at most 3).

## Power-ups (the plan's 3.10 and 6.4; five of a finale's seven)
| power-up | where | why |
|---|---|---|
| OVERCLOCK | the crown's first bar, on a ring line, 1.8 s before the barrage | Bloomfall's barrage asks a roll every 1.2 s for 7 s |
| SHIELD CELL | the mouth (the canopy's end) | after the crown, the calm before the dive |
| PHASE | taproot bar 21, on the ring line | 2.3 s later the root wall: through its crack to the cache (five cache rings and a sap-light). The open way left never needs it |
| MIRROR SHELL | taproot bar 28, before the crossfire | the crossfire's fans put bolts 2.8 m either side of you: a normal roll (2.3 m) brings home the middle ones, the Mirror Shell's 3.45 m all of them |
| SHIELD CELL | the cage, before the boss | the calm before it turns to you (the one power-up allowed at a boss's entrance) |
None in the fight: the knots spill sap-light instead. Missing every one is never a fail (the `?nopu` human bot run).

## Colour (rule 9)
The roots are the enemy, so their red stays a thin seam (Yori's), and in the taproot her seams are dimmed to a deep
red so the knots' bright red bolts read against ring after ring of them (rule 10). Rings amber, your shots cyan,
starfire white-hot (white-hot always means "dodge this"), sap-light pale sap-green (Yori: sap-green is shield), the
Phase crack violet, the Deep's motes green-white and orchid. The skies run Yori's palette: dark bark and white-green
starlight, darkening down the taproot, white-green in the cage, the whole Deep lit green at the end.

## Art (all Yori's: g2-art bc96c9f, `art-incoming/yori/g2/`)
Exported with `tools/art/export-model.js` through a re-export of her lists that also offers her `freed()` variants:
`module.exports = Object.assign({}, require('powerups.js'), require('bosses.js'), require('enemies.js'), require('scenery.js'), { rootFreed: () => L.freed(B.rootmindRoot(0, 0)), whirlmawFreed: () => L.freed(B.whirlmaw(0)), snareFreed: (n) => L.freed(B.snare(n || 6, 0)), mothFreed: (f) => L.freed(E.moth(f || 0.3, false)), calfFreed: () => L.freed(E.calf()) })`, then
- `js/bosses/g2-rootmind/mesh.js`: `rootmindStar=star([0]) rootmindRoot=root([0,0]) rootFreed starfireColumn=column([60]) sapKnot=bigKnot([1]) rootWhip=arm([0])`
- `js/obstacles/g2-root-whip/mesh.js`: `rootWhip=whip([1])`;  `js/enemies/g2-sap-knot/mesh.js`: `sapKnot=knot([0]) sapKnot=swollen([1])`
- `js/levels/g2/level10/mesh.js`: `canopyRoot=canopyA([71,80]) canopyRoot=canopyB([29,80]) rootTunnel=tunnel whirlmawFreed=whirlmaw snareFreed=snare([6]) mothFreed=moth([0.3]) calfFreed=calf phaseCrack=crack([7,7,5])`
The star-whales are her calf at 7-12x (her `starWhale(len)` is the same body). Nothing here is drawn by hand.

## The roll call and the other builders
`rollcall.js` holds one slot per level of the Deep. Each uses that level's own kind once it has merged into
`galaxies` (listed in `LANDED`, its folder checked), and a galaxy 1 stand-in until then that asks the same of you
(a roll here, a slip there) and keeps the music's time.
- **Real now (g2-a, merged at cbbdfec):** 1 Tideway (a cross current over three bars, the rings on its bent path, a
  drifter riding it), 2 The Shoals (a school of eight ring-fish on an S-curve, then a gulper that spits a pair back),
  3 The Drumreef (two drums beating on bar lines 17 and 19: fly the hole or roll for a PARRY).
- **Written, gated until g2-c lands:** 7 Bloomfall (four bloomers fired on the beat), 8 Angler's Deep (one angler and
  its lure), 9 The Murmuration (a flock wall with one hole, the rings threaded through it), from g2-c's own levels.
- **Stand-ins until g2-b lands:** 4 The Migration (shrikes), 5 Gravity Garden (crystals and a pod), 6 The Tangle
  (seeker drones). When their kinds merge, each slot's events should follow g2-b's own levels, as 1-3 and 7-9 do.

## Tested (2026-11-07, branch g2-d at the roll call's wiring; SW_PORT=8194, SW_CDP_OFFSET=1200, one Chrome at a time)
Only runs whose summary line printed count (the MCP's rule: a silent exit is a failure, and was rerun).
- `check-levels 2-10`: PASS, 371 rings + 9 cache (with g2-a's shoal), every warning over its floor (worst: whip 2.28 s,
  sap knot 2.50 s, the thrummer's pulse 1.34 s against its 1.0 s sweep floor). Roll moments from the event list: about
  14 a minute through the run-in, 23 at the heartwood's peak, about 19 in the fight; never more than three in any 3 s.
- `run.js popin - 2-10` with NOGOD=1: ALL PASS (351 of 371 rings; nothing popped in, nothing first seen inside 150 m).
- `run.js full - 2-10`: ALL PASS (348 of 371 rings, 3 hits, 104 deflects, 126 fps, zero console errors).
- The boss bots (boss.js's own checks, the two bots one after the other): the never-roll bot cannot hang it (the star
  tears itself free, the level ends); the always-roll bot beats it through all three phases. ALL PASS.
- Human bot, decent: seed 1 clear, 87%, DEGENERATE, the Rootmind beaten; every power-up ignored (NOPU=1, seed 4): clear,
  83%, five stars, beaten. Earlier the same night (before the roll call's real kinds): decent seeds 2-3 clear (83-86%,
  five stars, beaten); good seeds 1-2 clear (87-88%, DEGENERATE, beaten). The level's style minimums (`style` in
  level10.js: A 4/10, S 6/17, DEGENERATE 10/27) come from the decent runs.
- `devpop.js 2-10`: every dev jump (start, nine sections, the boss) clean. The end card: GALAXY CLEAR and THE UNMADE
  IS OPEN (Yori's art), NEXT GALAXY, at desktop and phone size.
- Phone size (390x844, DPR 3): unthrottled, 102-123 fps across the crown, heartwood, fight and home stretch, level with
  galaxy 1's finale measured in the same session (110-128). Under 4x CPU throttle the overloaded shared machine starved
  every level alike (galaxy 1's finale too), so those numbers say nothing about this level.

## Roll demand (g2-roll, 2026-11-07; SW_CDP_OFFSET=3600)
Evrtek: roll demand rises through the game. RD = the decent bot's rolls a minute + the dodger's roll-only hits a minute
(`curve.js --span fire`: the beats not tagged calm, up to the end of the fight). Decent and dodger, seeds 1-2.
- Before: fire span 13.9 (fight 9.7, the rest 18.2), whole run 9.1. After: fire span 20.9 (fight 23.7, the rest 19.7),
  whole run 14.1. The MCP's band for it: 19-21, under G3-10's 22.9.
- What changed: knots at taproot bars 13.5, 17.5, 24.5, 29, 35.5, 40.5 and 42.5; the Grip turns a knot on bars 1-3 and
  whips on bar 4; the Starfire has a third knot; one knot volley in two, the Last Root's included, bursts as a net (the
  MCP's ruling for the two finale bosses). A knot can be hurt from the bar it fires, so a fan always goes home into
  its own knot.
- Decent: clear on both seeds (DEGENERATE and S), lowest shield 40 and 31, the Rootmind beaten. Never more than three
  roll moments in any 3 s.
- Net bolts sent home score as deflects, as any net's do, so the fight now scores higher than it did.
