# Level 5: ION STORM (design notes, CLU, 2026-11-05)

**Headline (rule 20):** *Slip through the lightning when it goes dark.*
**New enemy (rule 23):** the **sniper**: a sight-line finds you, goes white, and one fast bolt flies down it. Its
question is "where will you be in 0.6 s?": step off the white line, or roll on it and send the bolt home.
**Twist (rule 19):** snipers ride the lightning's own cables. Send a rail sniper's bolt home and its sheet of
lightning shorts out for good (SHORT CIRCUIT), opening the rings behind it.
**Set piece (rule 3):** the lightning wall: six walls on six bar lines, one gap each, the gap moving; then THE
LIGHTNING WALL itself, 300 m across on giant pylons, its gap opening from 3.5 m to 6 m as you arrive.
**Landmark (rule 22):** the Stormcrown, a turning column of storm cloud on the horizon, lit from inside.

## The pieces (js/levels/level5/storm.js, js/enemies/sniper/)

| piece | what it does | warning (rule 12) |
|---|---|---|
| `l5-arc` | one arc across the lane between two pylon lamps, switching on its pattern | a whole bar of charge (4 beats: 1.64 s, 1.28 s under GREED): both lamps red going white-hot; the last beat or so, thin red pilot sparks |
| `l5-sheet` | two cables strung down the track on pylons, a curtain of arcs between them: the box split in two while it runs | the same bar of charge; an always-live sheet is static (580 m) |
| `l5-wall` | arcs across the whole lane but one gap; always live | static: seen from 580 m (2.6 s+ at 144 m/s) |
| `sniper` | sight 0.8 s (1.2 s the first time), lock 0.3 s (line white, still), bolt 0.3 s; its muzzle burns red while it sights and white while locked, so the line's source reads 300 m out (Yori's model at 1.7x, 6.5 m long) | 1.4 s from the first sight (1.8 s the first time); 0.6 s from the white (the hard floor) |

**The patterns** (`arcs.js`, one character a beat, X live): `slow` (2 bars on, 2 off), `bar` / `anti` (1 on, 1 off,
in turn), `strike` (live on the ONE of every other bar, charging the whole bar before), `live`. A dark run shorter
than the 4-beat charge is refused when the level loads, so no arc comes on with less than a bar of warning.

**The clock.** Arcs run on the COURSE's beat: the beat the music is on at that point of the course at the plan's
speed (`plan.js`). Played at that speed it is the music's beat to the frame. GREED carries the course ahead of the
music and the arcs go with it, so the rings laid out against the dark beats stay true (a music clock put the
rings into live lightning after the first GREED: 7 autopilot hits that went away with this change). Under GREED
the charge lasts 1.28 s of real time (x1.28 speed); at the plan's speed 1.64 s. (A 3-beat charge was tried first: 0.96 s
under GREED, under the 1.2 s floor, so the charge became a whole bar and the strike every other bar.)

**Colour (rule 9).** The storm is violet and white (Yori's palette). A hazard arc is a white-hot core in a red fringe:
the only red in the level is on things that hurt. Lamps: violet idle, red going white-hot on a charge, white live,
dead grey once shorted. The storm's own far lightning and the scenery pylons' arcs are violet-white with no red.

**Scoring (rule 31, the risk line).** CLOSE (+80 x mult) for passing within 2.4 m of a live arc; THREADED (+300 x
mult) for crossing a sheet, or passing an arc, while its lamps are lit (charging: still safe, about to fire);
SHORT CIRCUIT (+2,000 x mult) for a rail sniper killed by its own bolt (plus its KILL, 1,500).

## The music (l5-t1, 146.013 bpm, C# minor; bar = 1.644 s, first kick 0.359 s)

Intro 1-8 · Groove 9-24 · Build one 25-32 · Drop one 33-48 · Breakdown 49-56 · Build two 57-64 · Drop two 65-80 ·
Drive 81-88 · (Outro 89-94, never played). The finish is the first beat of bar 89, so the level ends as Drive does.

**Speed (rule 6),** stepped on bar lines, each ramping over one bar: 72 (bar 1), 80 (9), 92 (25), 104 (33), 116
(57), 126 (65), 136 (77), 144 (81). No density step shares a bar with a speed step: every speed step bar is a
calm bar or carries only what was already running. 15,128 m, 2:25.

## The four acts and the beat sheet (rules 1, 2, 4, 5, 19)

| bars | act | tag | what |
|---|---|---|---|
| 1-4 | introduce | calm | the storm opens; rings in the open; nothing that can hurt (rule 4: 6.6 s) |
| 5-8 | introduce | calm | the first arc, alone and high, live as you pass under it; one low; one across the middle, DARK, the rings straight through it |
| 9-14 | introduce | rising | faster; arc gates high and low in turn, the middle always safe; one across the middle you meet dark |
| 15-19 | introduce | rising | the first sheet, under you: live 2 bars, then dark, and the rings dip through it |
| 19-22 | introduce | rising | a sheet down the middle: keep left while it is live, cross when it goes dark |
| 23-24 | introduce | peak | the corridor: two sheets two bars apart; rise into the top lane in its dark |
| 25-26 | develop | calm | faster; open space |
| 27-32 | develop | rising | THE SNIPER alone: its first shot locks 1.6 m off you on purpose (a GRAZE); then one true; then one with two shots |
| 33 | develop | rising | Drop one: faster, nothing new for a bar |
| 34-41 | develop | peak | the crossfire: three columns, the outer sheets two bars each in turn; snipers both sides |
| 41-46 | develop | peak | the strike: a sheet across the middle live on the ONE of every other bar, charging the bar before; cross between strikes; sniper pairs |
| 47-48 | develop | calm | the peak fades |
| 49-56 | develop | calm | the quiet cell: a long corkscrew of rings; the Stormcrown rises |
| 57 | twist | calm | faster |
| 58-61 | twist | rising | the rail sniper, taught safe: a live sheet under you holds the rings; send its sniper home and it shorts out |
| 62-64 | twist | rising | a second, the live sheet ABOVE you, its sniper hanging under a lamp |
| 65-74 | twist | peak | Drop two: a corridor with a rail sniper (middle, then the shorted floor, then the top lane in its dark); then a strike down the middle and a live floor with a rail sniper; sniper pairs. The hardest stretch, 74-84 % of the way in |
| 75-76 | twist | calm | the peak fades |
| 77-78 | master | calm | faster; the Stormcrown fills the sky (the set piece's lead-in, rule 3) |
| 79-84 | master | rising | a lightning wall on each bar line, one gap each, the gap moving (middle, left, right, low right, low left, middle); a ring in every gap |
| 85-86 | master | calm | the last breath: the rings gather to the middle |
| 87-88 | master | peak | THE LIGHTNING WALL; through it, a ring corkscrew home; the finish on bar 89 |

Peaks: 23-24 (3 s), 34-46 (21 s, with the crossfire-to-strike change as its turn), 65-74 (16 s). Every peak is
followed by a calm of 3 s or more; the longest calm is the quiet cell (13 s). The last 15 % (bars 76-88) is the
set piece: walls whose gaps never switch, so it is spectacle, not the hardest stretch (rule 5).

## Spawn table (counts)

338 rings · 12 arcs · 13 sheets (3 with a rail sniper, 5 always-live including those) · 13 snipers (3 on rails,
10 on perch pylons, each perch an `l5-pylon`) · 7 walls (6 + the great one). Scenery streams: `l5-field` (pylons,
pairs, high pairs over the lane), set pieces `l5-sky` (far lightning on the bar lines) and `l5-crown` (the landmark).

## Checks (run 2026-11-05, before hand-in)

- Ring paths against every switching arc and sheet, landscape and portrait boxes: no ring path crosses a sheet's
  line, or passes an arc, while it is live at the plan's speed; 6 crossings land in a charge (THREADED, by design:
  the strike); 6 cross an always-live sheet (only after a SHORT CIRCUIT).
- Every hazard's warning against rule 12's floors (new: 1.2 s), at GREED's speed: arcs/sheets 1.28 s; sniper 1.4-1.8 s;
  walls 3.15 s (`node tools/check-levels.js 5`: PASS).
- Ranks from the autopilot's total (513k, `run.js full`): DEGENERATE 455k, S 315k, A 200k, B 95k (`ranksFrom`).
- Snipers all outside the box (|nx| >= 1.3), so none can be flown into.

## PROPOSED (ideas only: none of these is built)

1. A sniper sound of its own from Eleven: a thin rising whine while it sights and a click on the lock (today it
   borrows level 1's `fire` at 2x pitch for the lock).
2. The storm's light flickering with the live arcs near the ship (Yori's "the light flickers with the arcs"):
   needs an engine hook to pulse the scene's key light from a level.
3. A dev toggle to put the arcs on the audio clock instead of the course's beat, so Evrtek can play both and
   pick (one line in storm.js, `beatNow`).
4. STORM CHASER: a section bonus for threading every charging sheet in it.
5. The Stormcrown's inner lightning on the drops (bars 33 and 65) as well as at random bars.
