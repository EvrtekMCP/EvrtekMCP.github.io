# LEVEL 10: THE LATTICE HEART (CLU, lv-10, 2026-11-05)

**Headline (rule 20, one sentence, no "and"):** the finale dives into the machine itself to break its heart.

Three acts, a boss, an escape and an ending, each on its own part of the music (`audio/levels/level10/`: approach
140 bpm, dive 145, core 150, all D minor). The course is laid out in SECONDS of music (`at(t)` in `level10.js` turns a
time into the distance the speed curve reaches then), so every set piece starts on a bar line of the track that is
playing (rule 30). GREED and boosts run the course a little ahead of the music; each act's track cuts in on a bar
line when its section starts, so the music re-syncs at every act.

## Rule 19, the four acts
| act (rule 19) | what | the idea in it |
|---|---|---|
| introduce | ACT 1 THE APPROACH | the defence rings, then one wave from every level of the game, in the order you met them |
| develop | ACT 2 THE DIVE | the living tunnel at the fastest speed in the game: rams, then iris doors, then both |
| twist | ACT 3 THE CORE | the boss, and its great beam: the one thing in the game you cannot send back |
| master | THE ESCAPE, THE RUN HOME | outrun the shockwave on known hazards only, then a sunrise where nothing can hurt you |

## Beat sheet (rule 1; calm / rising / peak). The `beats` field in level10.js is the same list in metres.
ACT 1, THE APPROACH (approach track bars 1-56, about 96 s; 100 -> 140 m/s in three steps, each on a section line)
| bars | tag | beat |
|---|---|---|
| 1-8 | calm | the Lattice ahead, red seams; rings in the open; the first defence ring alone: two blades, half open, slow (rules 4, 18) |
| 9-24 | rising | the roll call: pods (L1), a boost chain and a strafer pair (L2), gate turrets (L3), seekers (L4); defence rings between |
| 25-32 | rising | the speed steps first; then a swarm (L5, Neon Orbital, since the 5/7 swap of 11-08), a counter-turning ring pair, ice mines (L6) |
| 33-48 | peak | THE DEFENCE GRID: snipers (L7, Ion Storm, since 11-08), searchlight sentries (L8), crystal emitters (L9), four-blade rings, ring pairs (27 s) |
| 49-56 | calm | THE SPLIT: nothing shoots; the shell splits open ahead; the rings lead in (rule 3's lead-in) |

ACT 2, THE DIVE (dive track bars 1-48, about 80 s; 172 -> 197 m/s, the fastest in the game)
| bars | tag | beat |
|---|---|---|
| 1-4 | rising | through the split: the tunnel closes round you |
| 5-20 | rising | rams: the first alone with a 1.6 s tell and the way past lit with rings; then a ram (or a pair) every bar |
| 21-28 | rising | iris doors: the first centred and wide (3.8 m), then the hole moves |
| 29-44 | peak | the deep machine: irises and ram pairs alternate every bar; bars 37-38 are rings only (rule 2) |
| 45-48 | calm | the pause: out of the tunnel into the core chamber; the eye far ahead |

ACT 3, THE CORE (core track: the fight loops Core one + Core two, 6.665-57.867 s)
| phase | loop (4 bars) | what is new (rule 24) |
|---|---|---|
| THE EYE OPENS | volley on bar 1, volley on bar 3 | two plates slide open, their hinges bloom; each hinge fires one pair, the second a bar after the first, so one roll returns a pair (MULTI-DEFLECT) and the cooldown never costs a shot; a sent-back shot homes on an open hinge |
| THE GREAT BEAM | volley on bar 1, BEAM on bar 3 | the pupil shrinks, a magenta ring grows thickest on the side the beam will cover (1.3 s), then white fire over most of the lane for 1.5 s; it cannot be sent back. Its sides run left, right, top, bottom |
| THE LAST PLATES | wall on bar 1, volley on bar 2 | the piston wall out from behind the eye: one gap, red edges, white in its last 0.35 s; gaps run round the lane in a fixed order. Bursts become triples 0.2 s apart (one roll). The shortest phase |
Eight hinges, three hits each (24). A struck hinge spills beacon-energy (shield and points, not a ring) and every
loop spills one more, so the shield can be won back while the fight holds the course (rule 7). After 150 s unbeaten
the Heart tears itself apart anyway and the escape plays (rule 26), with no boss bonus; every hit buys 4.5 s more,
so only a ship that stops hurting it is timed out. Its sounds: boss-warning, boss-phase, boss-hit, boss-defeat.

THE ESCAPE and THE RUN HOME (core track from the Collapse, once to its end)
| bars | tag | beat |
|---|---|---|
| Collapse 37-44 | calm | the eye has gone; the breach opens where it was (the first 800 m are empty, per the engine) |
| Build 45-52 | rising | into the shaft; the shockwave's light behind you; the first torn plates, slow and alone |
| Escape 53-68 | peak | outrun it at 200 m/s: torn plates and dead rams, all known, big and slow to read (rule 5: spectacle, not a spike) |
| Peak 69-84 | calm | out into a sunrise over a quiet blue planet; a slow corkscrew of rings; nothing can hurt you (rule 29's release) |
| Outro 85-90 | calm | the take's final hit; the finish line as its last bar dies away |

## Warning times (rule 12; `node tools/check-levels.js 10` checks every spawn at GREED speed)
- defence ring: in sight from READ_D (580 m), its gap lit with rings: 3.2 s at worst.
- ram: caps glow 1.2-1.6 s, then a 0.24 s stroke ending 1.0 s before you arrive: 2.4 s at worst.
- iris: seam pulses 1.3-1.6 s, the blades close over 1.0 s and are shut 0.45 s before you arrive: 2.75 s at worst.
- boss volleys: 1.2 s bloom + 1.4 s flight (rule 12's 0.8 s for reflectable shots); the beam 1.3 s tell; the wall 1.8 s.
- torn plates: static, in sight from READ_D; dead rams sit still.
All of them run on time to arrival (-z / speed), never on the clock, so a tell always runs its full length at any speed.

## Colour (rule 9)
Yori's look makes this the one level whose scenery is the enemy colour. To keep red reading as "this hurts", the red
on the scenery is only ever a thin seam or a light (the sphere's grid, the tunnel's seam bars, the chamber's rings), the
sky gas runs wine and plum (330 deg, clear of the hurts hue; `check-levels` passes it), and every red on a hazard is a
bright edge on a moving thing: the blades' edges, the rams' lips and caps, the iris tips, the wall's gap. Rings stay
amber, your shots cyan, the beam white-hot, the sunrise gold and blue.
