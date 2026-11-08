# Galaxy 3, levels 4-6 and the Counterfeit (CLU, branch g3-b, 2026-11-06/07)

The overnight build (Evrtek: "Build everything for the new galaxies. Have them ready for tomorrow."). The plan is
`projects/starwake-galaxies.md` §4.4-4.6, §5 and §6 in the home base; the contract is LEVEL-API §12.

## What is here

| File | What |
|---|---|
| `js/levels/g3/level4.js` + `level4/` | THE AUGURY: course, scenery (prism pylons, far orbits, THE ORRERY set piece), the shared clock (`clock.js`) and scenery kit (`kit.js`) levels 5 and 6 use |
| `js/levels/g3/level5.js` + `level5/` | THE DRAFTING HALL: course, scenery (standing blueprint sheets, a drafting floor, THE ENDLESS SHEET), the cache clue decor |
| `js/levels/g3/level6.js` + `level6/` | THE FORGERY: course, scenery (blanks on hooks, presses that stamp on the bar, weld sparks, THE MINT) |
| `js/enemies/g3-augur/` | the AUGUR (level 4's new enemy) |
| `js/enemies/g3-plotter/` | the PLOTTER (level 5's new enemy) and its plan (`plannedMines`, read by the bots and my sheet check) |
| `js/enemies/g3-forgery/` | the FORGERY (level 6's new enemy) |
| `js/enemies/g3-forge-turret/` | the turret keyed to forgeries (level 6) |
| `js/bosses/g3-counterfeit/` | THE COUNTERFEIT, its race rings (`rings.js`, kind `g3-cf-ring`) |

Meshes: every `mesh.js` is generated from Yori's `art-incoming/yori/g3` vertex lists by `level4/export-meshes.cjs`
(a builder tool, never staged), which splits her pieces into parts by comparing two states of one of her functions.

## Calls I made where the plan is silent or pulls two ways

- **A plotter draws on a SHEET.** Its line is printed on a plane the course carries toward you, so its mines stand
  across the lane as a wall drawn live; only where you are when the sheet reaches you counts. A single line is a
  stripe you only have to be off; a BAND (strokes too close to pass between) is a wall; the Signature's loops are a
  band that grows behind the pen. Mines land white-hot and are harmless until red (0.35 s), so the pen never drops a
  mine on you unread.
- **Slipstream and the Drafting Table.** The plan puts Slipstream right before the table and also says never before
  the level's final mastery test. The table is the set piece; the final test is THE FAIR COPY after it, at full speed.
- **The forgeries' stolen rings** count in the ring total (the MCP's default 4: they are the skill ★4 and ★5 ask for).
  The shower a burst forgery drops is those same rings coming back (plain rings, not caches), so a ring counts once
  whichever way it is caught. A forgery's cradle holds three: full, it makes off with them (slowly, so a keyed bolt
  still catches it), which keeps any one forgery from emptying a line and puts about a fifth of the level's rings in
  a forgery's reach.
- **Keyed turrets wait for their mark.** From 4.6 s out a forge turret fires the moment a forgery is carrying stolen
  rings (and anyway at its last chance), so its bolt is worth rolling when it reaches you.
- **The Heist** ("take it first or lose the burst"): a forgery ahead of you always reaches a ring first, so "take it
  first" is read as "take the forgery out first": burst it before the chain reaches its plane.
- **The Counterfeit's race rings** are its own pickup (`g3-cf-ring`): a boss fight holds the course, so the fight lays
  its own ring lines, which count toward no ring share (galaxy 1's fights have none either). "Every ring it takes mends
  a crack" is read as: every six rings it takes mend one crack (tuned on the bots: per ring, or per three, it healed
  faster than a decent pilot could hurt it). It takes none while busy (rolling, its ring refilling, or knocked off its
  line by a hit), so baiting it as its line comes denies the mend.
- **The Counterfeit's bolts are bait.** The turrets' bolts turn gently onto your line all the way in (7 m/s^2: drifting
  does not slip them, a hard step aside does), and its own return keeps exactly to you (it is your bolt coming back:
  only a roll answers it). Being bait they hit for 7 and 8, not 16. Measured on the decent bot first, without this a
  decent pilot rarely got a rally started and died to the misses.
- **Sound ids** are the sound branch's (`g3-augur-charge`, `g3-plot`, `g3-forgery-burst`, `g3-forgery-roll`,
  `g3-ratchet`); until each lands the engine plays its stand-in.

## PROPOSED (not asked for; none of it is built)

1. A short "plan view" of the Drafting Table on the pause screen (the four sheets drawn flat), for players who want to
   learn the maze.
2. A per-level tally line, FORGERIES STOPPED n / m, beside CACHES.
3. The Orrery's rings could tick on the clockwork beat of level 4's take once it lands (the take has a clockwork tick).
4. A Counterfeit ghost in the dev menu: replay your own best run's path as a forgery that races you.
5. The augur's crosshair could leave a faint after-image where it locked, so a near miss reads after the fact.
