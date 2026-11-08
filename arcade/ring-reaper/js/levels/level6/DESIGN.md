# LEVEL 6: FROZEN RIFT (CLU, 2026-11-05)

**Headline (rule 20, one sentence, no "and"):** the Leviathan hunts you down a tight ice canyon.

Everything else supports it: the canyon walls (the setting, Yori's look), the ice mine (this level's enemy), the
canyon furniture and the forks (the twist), the boss (the payoff).

## The chase, as a mechanic: THE PASS (`l6-pass`, js/levels/level6/kinds.js)
The Leviathan is behind you. Every so often it surges past.
- **Tell (rule 11, in layers):** the lane it will take lights red down the canyon ahead of you (a tube of red light
  whose bands rush the way it will go), the side arrow flashes, a low boom, the glare of its maw comes up the lane.
  The lane is where it will be: half the box (left, right, top or bottom), or along a wall outside the box (the
  harmless teaching passes).
- **Timing (rule 12):** 1.5-1.6 s from the light to its head the first time each lane is used, 1.25 s after
  (`tools/check-levels.js` holds every pass in its own level to the 1.2 s new-hazard floor). Each pass is placed so its
  head reaches you on a bar line; if GREED has you there early, the warning stretches to the next beat, never shrinks.
- **The pass:** the head comes from behind and below, out of frame, slides into the lit lane and runs on down the
  canyon; its eight segments stream through the lane for about a second; 170 m ahead it dives into the ice in a burst of
  spray. Touching it: a big hit (26).
- **Degenerate line (rule 31):** flying within a couple of metres of it pays CLOSE (up to four a second) and fills
  GREED. Hug the beast.
- **The set piece (act 4):** once, it comes up beside you and runs with you for three seconds before it surges ahead.

## The level's enemy: THE ICE MINE (`ice-mine`, js/obstacles/ice-mine)
Yori's hexagonal ice crystal in a truss belt with red crack lines. Its question: **"where is the eye?"**
- It floats in the canyon. If your line takes you within 4.6 m of it, it ARMS 1.75-1.4 s out: the cracks go red to
  white and it shakes for 0.6 s (the tell, with the `ice-crack` sound). Then it pops into SIX shards that fly out in a
  ring and stay in the track: the ring is 2.1 m across when it reaches you, at least 0.8 s after the pop.
- **The eye:** the middle of the ring is empty. Hold your line through where the mine was and all six pass round you:
  six GRAZES. Roll in the eye and they all go home: a MULTI-DEFLECT. Drift half-way and you meet one. Steer wide and it
  never arms.
- A sent-back shard homes on the next live mine down the canyon, which shatters harmlessly (a kill). The Leviathan's
  own mines send them to its lit lens.
- Unlike level 1's mine clusters (static, a fixed cross of four, no choice): this one is about reading space and
  holding your nerve. It is an `enemy` by role (so a sent-back shot can find it) living in `js/obstacles/ice-mine/`.

## Canyon furniture (supporting; dark old ice that reads against the pale walls, red-cracked edges where it hurts)
- **Spur** (`l6-spur`): an outcrop from the left or right wall into the box. Go round it on the open side.
- **Curtain** (`l6-curtain`): a slab of ice hanging from above with icicle teeth, or a ridge rising from below.
- **The fork** (`l6-fork`, the twist): a glacier spire splits the canyon into a left and a right channel for 300 m.
- **Icefall** (`l6-icefall`, the boss's wall slam): a slab of wall drops into the lane on one side.

## Speed (rule 6: clear steps on bar lines, never with a density step)
84 m/s; 100 at bar 21; 116 at bar 48; 132 at bar 64 (each eased over 150 m in a calm stretch).

## The four acts (rule 19) on the track's sections (rule 30), and the beat sheet (rule 1)
Bars count from 0 at the first beat (the track's own numbering is one more). The track: intro 8 bars, groove 16,
build 8, DROP 16, breakdown 8, build 8, DROP 16, drive.

| bar | act / track | tag | beat |
|---|---|---|---|
| 0 | INTRODUCE: THE RIFT MOUTH / intro | calm | the walls close in from wide to tight; rings in the open |
| 8 | groove | calm | the first ice mine, alone, on the ring line: the rings lead into its eye |
| 10-14 | | rising | spurs left and right, a curtain overhead, a second mine |
| 15 | | rising | **SET PIECE, the first sighting:** "SOMETHING IS IN THE ICE", then it surges past along the left wall, outside the box. Harmless. "THE LEVIATHAN" |
| 19 | | calm | a second harmless pass along the right wall |
| 21 | DEVELOP: THE NARROWS | calm | speed step; rings only |
| 24 | build one | rising | the first real pass (the left half), rings on the safe side |
| 28-30 | | rising | a pass on the right; a spur and a floor ridge together |
| 32 | DROP one | peak | passes from above, then below; mines in the safe half |
| 40-42 | | peak | the double: two passes two bars apart, opposite sides |
| 43.5-48 | | calm | breather: a ring corkscrew |
| 48 | TWIST: THE FORKS / breakdown | calm | speed step; the first fork, nothing chasing: one channel greedy (a mine and more rings), one plain |
| 56 | build two | rising | the second fork: it lights ONE channel before the prow; take the other |
| 58.5-63 | | peak | from above; the third fork, lit, mines in the safe channel, a pass from below as you leave: the hardest stretch |
| 64 | MASTER: THE THROAT / DROP two | calm | speed step; two calm bars |
| 66-72 | | rising | passes on a two-bar rhythm, all four sides, rings showing the safe half |
| 74 | | rising | **SET PIECE (spectacle, not difficulty):** it runs beside you for three seconds, then surges ahead |
| 77 | | calm | "IT TURNS." The canyon opens into the cavern |
| 79 | BOSS: THE LEVIATHAN / its own track | peak | the fight |

## The boss: THE LEVIATHAN (js/bosses/leviathan; rules 23-28)
It has overtaken you, and turned. It swims ahead of you with its head turned back on you, keeping pace, its body
coiled broadside across the cavern so every lens is in view. Only reflected shots hurt it, and only in the ONE lit lens
(the first live lens from the head back, flashing red to white; the others dim; dead ones go Yori's dark #2a2730).
Six lenses, 8 hits each.
- **Phase 1, THE MAW** (two-bar loop): the jaws open and the throat blooms red for 0.7 s, then a fan of five bolts
  across 4.4 m, so one roll in the middle sends all five home; then a burst of three aimed bolts.
- **Phase 2, THE SHARDS** (three-bar loop): adds the shard drop. The tail tips flash ice-white and it flings three ice
  mines out of its tail and down the canyon; they drift back onto your line and pop. Their shards, rolled back, go to
  its lens too.
- **Phase 3, THE WALL SLAM** (two-bar loop, the shortest): it swings its head into a wall and two slabs of it drop into
  the lane on that side (a pale glow where they broke away), alternating sides; the maw keeps firing.
- **Never hangs (rule 26):** it fires on every loop; if it is not beaten in 110 s it dives into the ice ("IT DIVES INTO
  THE ICE") and the level ends without its bonus. Bot tests: a never-rolling bot sees it escape; the rolling autopilot
  beats it.
