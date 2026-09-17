'use strict';
// CROSSWIRE — the tutorial boards.
//
// EVRTEK 2026-09-07: the three difficulties should each show a sample board
// with a tutorial essentially being played on it, looping. The highlighted one
// animates; the others hold still.
//
// FOUR of them since 2026-09-14, when CALM became a setting of its own and the
// ladder ran CALM / NORMAL / ADVANCED / EXTREME. The fourth panel is EXTREME's
// and it plays the two things that setting is named for: the red slabs that
// cannot be cut, and the surge RE-DEALING what a demand wants under you.
//
// AND NINE MORE SINCE RULING 108 (EVRTEK 2026-09-14): "let's use the 'picture
// says 1,000 words approach' here, the help screens should include animated
// samples of what needs to be done. Simple description in words but a visual
// representation of the game in action to show how things work." So the help
// screen is no longer a wall of rules; it is LESSONS, and a lesson is one of
// these boards with a title and two plain sentences over it. They live here
// rather than in the renderer because they are the same kind of thing the
// difficulty cards are — a scripted picture — and they are drawn by exactly
// the same function.
//
// These are SCRIPTED PICTURES, not the real engine. That is deliberate: a demo
// has to read clearly in a five-second loop, and the real solver would need a
// board, a feed and a clock to say the same thing. Every step here is a cell
// appearing with the colour it would actually carry.
//
// THE VOCABULARY, in one place, because every field below is read generically
// by draw() and no panel is special-cased:
//
//   w, h        the grid, in cells. Sources hang off the left of it and the
//               demands off the right, so a box is (w + 2) cells wide.
//   sources     [{row, colour}]      the swatches on the left edge
//   demand      {row, colour}        one demand — the old singular form
//   demands     [{row, colour}]      or several; the plural wins if both exist
//   steps       [step()]             a cell appearing, and optionally dying
//   toggle      {t, x, y}            a junction being pressed from S to M
//   cut         {from, to, x, y}     the destructor's cross, armed then fired
//   spark       {from, to}           a SHORT: everything with a `die` flickers
//                                    red between these two times
//   spin        {t, until, x, y, e}  a piece TURNING before it lands
//   slab        {t, x, y, size}      one red slab — the old singular form
//   slabs       [{t, x, y, size, until}]  or several; `until` is when it LIFTS
//   redeal      {t, colour}          the surge re-dealing the first demand
//   strip       true                 draw SHRED / BIN 1 / BIN 2 under the grid
//   shred       {t, from:[x,y]}      a piece flying into the shredder
//   stash       {t, from:[x,y], bin} a piece flying into a bin, and staying
//   clock       {start, drain}       a clock bar under the grid, and the half
//                                    it gets back on a delivery
//   deliver     t                    the demands light (omit: nothing pays)
//   clear       t                    and the wire burns back down
//   loop        t                    the length of the whole thing
//
// Everything is a pure function of t, so a frozen frame (live = false) is
// stable and two machines draw the same picture at the same moment.
var CW_DEMO = (function () {

  var C = CW_COLOUR;

  // Quarter-turn map, for the piece that turns before it lands.
  var CWROT = { N: 'E', E: 'S', S: 'W', W: 'N' };

  // How long a slab takes to lift off, and how long a shredded or stashed
  // piece hangs before it flies and how long the flight is.
  var RISE = 0.38, HOLD = 0.35, FLY = 0.55, FRAG = 0.45, COOL = 1.4;

  // t: when the cell appears. e: the ways it joins. hub: it is a junction.
  // die: when it burns away, for the script that shows a mistake being cleared.
  function step(t, x, y, e, colour, hub, die) {
    return { t: t, x: x, y: y, e: e, colour: colour, hub: !!hub, die: die || 0 };
  }

  // A cell that changes colour partway through, which is what a junction going
  // from S to M does to everything downstream of it.
  function turns(st, t, colour) { st.becomes = { t: t, colour: colour }; return st; }

  // One deterministic pseudo-random number per fragment. Deliberately NOT
  // Math.random: a shard that re-rolls its scatter every frame does not fly
  // anywhere, it flickers — and a frozen frame has to be the same frame twice.
  function frand(n) {
    var x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---- the four difficulty cards -------------------------------------------

  // EVRTEK 2026-09-14: "Calm needs to include blends." The sandbox card played
  // a plain connection for one build, which was the only card that did not
  // show the thing its own setting is about — CALM deals blends from the very
  // first demand and is the tutorial setting besides. So its loop is a run
  // from a source to a demand WITH a blend forming on the way: red goes out,
  // yellow comes up to meet it, the junction is pressed, and the tail turns
  // orange into an orange bulb.
  var CALM = {
    w: 6, h: 5,
    sources: [{ row: 2, colour: C.RED }, { row: 4, colour: C.YELLOW }],
    demand: { row: 2, colour: C.ORANGE },
    // Quorra's playtest caught the old caption promising something the board
    // rarely hands you — a source sitting on the same row as the bulb wanting
    // its colour. This one describes THE PICTURE instead of making a promise.
    caption: 'a run, and a blend at a junction',
    steps: [
      step(0.4, 0, 2, ['W', 'E'], C.RED),
      step(0.8, 1, 2, ['W', 'E'], C.RED),
      step(1.2, 0, 4, ['W', 'E'], C.YELLOW),
      step(1.5, 1, 4, ['W', 'E'], C.YELLOW),
      step(1.8, 2, 4, ['W', 'N'], C.YELLOW),
      step(2.1, 2, 3, ['N', 'S'], C.YELLOW),
      turns(step(2.4, 2, 2, ['W', 'S', 'E'], C.RED, true), 3.6, C.ORANGE),
      turns(step(2.7, 3, 2, ['W', 'E'], C.RED), 3.6, C.ORANGE),
      turns(step(3.0, 4, 2, ['W', 'E'], C.RED), 3.6, C.ORANGE),
      turns(step(3.3, 5, 2, ['W', 'E'], C.RED), 3.6, C.ORANGE)
    ],
    toggle: { t: 3.6, x: 2, y: 2 },
    deliver: 4.2, clear: 5.0, loop: 5.8
  };

  // EVRTEK 2026-09-07: every junction lands as a SPLITTER, and mixing is a
  // decision the player makes. So this panel plays exactly that: the junction
  // goes in, carries red straight through because that is what a splitter
  // does, the demand stays unlit — and then it is toggled to M and the whole
  // line downstream turns orange.
  var MIXED = {
    w: 6, h: 5,
    sources: [{ row: 1, colour: C.RED }, { row: 3, colour: C.YELLOW }],
    demand: { row: 2, colour: C.ORANGE },
    caption: 'junctions land on S. press for M',
    steps: [
      step(0.4, 0, 1, ['W', 'E'], C.RED),
      step(0.8, 1, 1, ['W', 'S'], C.RED),
      step(1.2, 0, 3, ['W', 'E'], C.YELLOW),
      step(1.6, 1, 3, ['N', 'W'], C.YELLOW),
      turns(step(2.1, 1, 2, ['N', 'S', 'E'], C.RED, true), 3.5, C.ORANGE),
      turns(step(2.5, 2, 2, ['W', 'E'], C.RED), 3.5, C.ORANGE),
      turns(step(2.8, 3, 2, ['W', 'E'], C.RED), 3.5, C.ORANGE),
      turns(step(3.1, 4, 2, ['W', 'E'], C.RED), 3.5, C.ORANGE),
      turns(step(3.3, 5, 2, ['W', 'E'], C.RED), 3.5, C.ORANGE)
    ],
    toggle: { t: 3.5, x: 1, y: 2 },
    deliver: 4.1, clear: 4.9, loop: 5.7
  };

  // EVRTEK 2026-09-07: the hardest panel shows the DESTRUCTOR at work. (It
  // showed a short circuit for one build; he asked for the tool instead, which
  // is the better lesson — a short teaches you what not to do, and this
  // teaches you how to undo it.)
  //
  // A run takes a wrong turn and dead-ends. The cross lands on the three cells
  // that went wrong, takes exactly those, and the route is laid again straight
  // through. The two cells before the mistake never move, which is the whole
  // point of a cut that only takes what it touches.
  var SNIP = {
    w: 6, h: 5,
    sources: [{ row: 2, colour: C.BLUE }],
    demand: { row: 2, colour: C.BLUE },
    caption: 'the destructor cuts a cross',
    steps: [
      step(0.3, 0, 2, ['W', 'E'], C.BLUE),
      step(0.6, 1, 2, ['W', 'E'], C.BLUE),
      // the wrong turn, and the dead end at the top
      step(0.9, 2, 2, ['W', 'N'], C.BLUE, false, 3.0),
      step(1.2, 2, 1, ['N', 'S'], C.BLUE, false, 3.0),
      step(1.5, 2, 0, ['S', 'E'], C.BLUE, false, 3.0),
      // laid again, straight to the demand
      step(3.4, 2, 2, ['W', 'E'], C.BLUE),
      step(3.7, 3, 2, ['W', 'E'], C.BLUE),
      step(4.0, 4, 2, ['W', 'E'], C.BLUE),
      step(4.3, 5, 2, ['W', 'E'], C.BLUE)
    ],
    cut: { from: 1.9, to: 3.0, x: 2, y: 1 },
    deliver: 4.8, clear: 5.5, loop: 6.3
  };

  // EVRTEK 2026-09-14: "Extreme mode will have blocks fall and have the targets
  // randomly reassign on the blocker drop countdown trigger." Both of those, in
  // one loop, because they arrive together — the surge does them in the same
  // instant and the panel would lie if it showed one without the other.
  //
  // A red run reaches a RED demand and is about to pay. The surge fires: a slab
  // lands in the lower right, and the demand is re-dealt to ORANGE, so the run
  // that was finished is now the wrong colour. The answer is the one the game
  // always gives — bring the second colour in at a junction — and the panel
  // plays it: the yellow source runs across, the plain cell where the two meet
  // is replaced by a junction, it is set to M, and everything downstream of it
  // turns orange.
  var SURGE = {
    w: 6, h: 5,
    sources: [{ row: 1, colour: C.RED }, { row: 3, colour: C.YELLOW }],
    demand: { row: 2, colour: C.RED },
    // What the surge re-deals it to, and when. Drawn as a spin on the ring, so
    // the eye is taken to the bulb at the moment it changes.
    redeal: { t: 2.6, colour: C.ORANGE },
    // The red slab, which lands on the same trigger and cannot be cut. Two by
    // two, clear of the wire, in the corner the yellow run would otherwise
    // have taken.
    slab: { t: 2.6, x: 3, y: 3, size: 2 },
    caption: 'the surge re-deals the demands',
    steps: [
      step(0.3, 0, 1, ['W', 'E'], C.RED),
      step(0.6, 1, 1, ['W', 'S'], C.RED),
      step(0.9, 1, 2, ['N', 'E'], C.RED),
      // The plain cell that has to give way to a junction once the demand has
      // changed under the player. It dies the instant the junction goes in.
      step(1.2, 2, 2, ['W', 'E'], C.RED, false, 4.0),
      turns(step(1.5, 3, 2, ['W', 'E'], C.RED), 4.4, C.ORANGE),
      turns(step(1.8, 4, 2, ['W', 'E'], C.RED), 4.4, C.ORANGE),
      turns(step(2.1, 5, 2, ['W', 'E'], C.RED), 4.4, C.ORANGE),
      // the yellow branch, laid after the re-deal
      step(3.2, 0, 3, ['W', 'E'], C.YELLOW),
      step(3.5, 1, 3, ['W', 'E'], C.YELLOW),
      step(3.8, 2, 3, ['N', 'W'], C.YELLOW),
      turns(step(4.1, 2, 2, ['W', 'S', 'E'], C.RED, true), 4.4, C.ORANGE)
    ],
    toggle: { t: 4.4, x: 2, y: 2 },
    deliver: 4.9, clear: 5.7, loop: 6.5
  };

  // One per difficulty, in the ladder's own order: CALM, NORMAL, ADVANCED,
  // EXTREME. The difficulty screen indexes this list by CW_GAME.DIFFICULTY's
  // index, so a fifth setting would need a fifth script the same day.
  var SCRIPTS = [CALM, MIXED, SNIP, SURGE];

  // ---- the lessons (EVRTEK'S RULING 108) -----------------------------------
  //
  // Quorra's playtest of the live beta: How to Play is one screen of 442 words
  // introducing about two dozen named ideas before the first move, and "the
  // first minute is the hardest part of the game". His answer was to show it
  // instead of saying it, so each lesson below is a title, two plain sentences
  // and a board with the thing happening on it.
  //
  // The captions are written for someone who has never seen the game. Shop
  // words are glossed once where the picture cannot do it on its own, and
  // dropped everywhere else.

  var L_WIRE = {
    w: 6, h: 5,
    sources: [{ row: 2, colour: C.RED }],
    demands: [{ row: 2, colour: C.RED }],
    steps: [
      step(0.4, 0, 2, ['W', 'E'], C.RED),
      step(0.7, 1, 2, ['W', 'E'], C.RED),
      step(1.0, 2, 2, ['W', 'E'], C.RED),
      step(1.3, 3, 2, ['W', 'E'], C.RED),
      step(1.6, 4, 2, ['W', 'E'], C.RED),
      step(1.9, 5, 2, ['W', 'E'], C.RED)
    ],
    deliver: 2.4, clear: 3.1, loop: 4.0
  };

  // A bend going up and over a slab. The piece TURNS first — that is the half
  // of the lesson a still picture cannot carry, and the reason `spin` exists.
  var L_TURN = {
    w: 6, h: 5,
    sources: [{ row: 2, colour: C.RED }],
    demands: [{ row: 2, colour: C.RED }],
    slabs: [{ t: 0, x: 2, y: 2, size: 2 }],
    spin: { t: 0.9, until: 1.7, x: 1, y: 2, e: ['W', 'N'] },
    steps: [
      step(0.3, 0, 2, ['W', 'E'], C.RED),
      step(1.7, 1, 2, ['W', 'N'], C.RED),
      step(2.0, 1, 1, ['S', 'E'], C.RED),
      step(2.3, 2, 1, ['W', 'E'], C.RED),
      step(2.6, 3, 1, ['W', 'E'], C.RED),
      step(2.9, 4, 1, ['W', 'S'], C.RED),
      step(3.2, 4, 2, ['N', 'E'], C.RED),
      step(3.5, 5, 2, ['W', 'E'], C.RED)
    ],
    deliver: 4.0, clear: 4.7, loop: 5.6
  };

  // One colour in, two ways out, and two bulbs paid from one run. This is the
  // panel that earns the plural `demands`.
  var L_SPLIT = {
    w: 6, h: 5,
    sources: [{ row: 2, colour: C.RED }],
    demands: [{ row: 1, colour: C.RED }, { row: 3, colour: C.RED }],
    steps: [
      step(0.3, 0, 2, ['W', 'E'], C.RED),
      step(0.6, 1, 2, ['W', 'E'], C.RED),
      step(0.9, 2, 2, ['W', 'E'], C.RED),
      step(1.3, 3, 2, ['W', 'N', 'S'], C.RED, true),
      step(1.7, 3, 1, ['S', 'E'], C.RED),
      step(2.0, 4, 1, ['W', 'E'], C.RED),
      step(2.3, 5, 1, ['W', 'E'], C.RED),
      step(2.7, 3, 3, ['N', 'E'], C.RED),
      step(3.0, 4, 3, ['W', 'E'], C.RED),
      step(3.3, 5, 3, ['W', 'E'], C.RED)
    ],
    deliver: 3.8, clear: 4.5, loop: 5.4
  };

  var L_MIX = {
    w: 6, h: 5,
    sources: [{ row: 1, colour: C.RED }, { row: 3, colour: C.YELLOW }],
    demands: [{ row: 2, colour: C.ORANGE }],
    steps: [
      step(0.3, 0, 1, ['W', 'E'], C.RED),
      step(0.6, 1, 1, ['W', 'S'], C.RED),
      step(1.0, 0, 3, ['W', 'E'], C.YELLOW),
      step(1.3, 1, 3, ['N', 'W'], C.YELLOW),
      turns(step(1.7, 1, 2, ['N', 'S', 'E'], C.RED, true), 3.2, C.ORANGE),
      turns(step(2.0, 2, 2, ['W', 'E'], C.RED), 3.2, C.ORANGE),
      turns(step(2.3, 3, 2, ['W', 'E'], C.RED), 3.2, C.ORANGE),
      turns(step(2.6, 4, 2, ['W', 'E'], C.RED), 3.2, C.ORANGE),
      turns(step(2.9, 5, 2, ['W', 'E'], C.RED), 3.2, C.ORANGE)
    ],
    toggle: { t: 3.2, x: 1, y: 2 },
    deliver: 3.8, clear: 4.5, loop: 5.4
  };

  // THE ONE FAIL CASE. Red and blue arrive in one plain two-way cell, which is
  // not a junction and has no business holding two colours. Nothing is rebuilt
  // afterwards and no bulb ever lights: the lesson is the loss.
  var L_SHORT = {
    w: 6, h: 5,
    sources: [{ row: 2, colour: C.RED }, { row: 4, colour: C.BLUE }],
    demands: [{ row: 2, colour: C.RED }],
    spark: { from: 2.3, to: 3.4 },
    steps: [
      step(0.3, 0, 2, ['W', 'E'], C.RED, false, 3.4),
      step(0.6, 1, 2, ['W', 'E'], C.RED, false, 3.4),
      step(1.0, 0, 4, ['W', 'E'], C.BLUE, false, 3.4),
      step(1.3, 1, 4, ['W', 'E'], C.BLUE, false, 3.4),
      step(1.6, 2, 4, ['W', 'N'], C.BLUE, false, 3.4),
      step(1.9, 2, 3, ['N', 'S'], C.BLUE, false, 3.4),
      step(2.3, 2, 2, ['W', 'S'], C.RED, false, 3.4)
    ],
    loop: 4.6
  };

  // The cross, with a slab sitting in one of its arms. EVRTEK 2026-09-14: "the
  // red blocks cannot be destroyed, they need to be worked around" — so the
  // cut is aimed where it touches the slab, and the slab is still there
  // afterwards. That is the whole reason this panel is not SNIP again.
  var L_CUT = {
    w: 6, h: 5,
    sources: [{ row: 2, colour: C.BLUE }],
    demands: [{ row: 2, colour: C.BLUE }],
    slabs: [{ t: 0, x: 3, y: 0, size: 2 }],
    steps: [
      step(0.3, 0, 2, ['W', 'E'], C.BLUE),
      step(0.6, 1, 2, ['W', 'E'], C.BLUE),
      step(0.9, 2, 2, ['W', 'N'], C.BLUE, false, 3.1),
      step(1.2, 2, 1, ['N', 'S'], C.BLUE, false, 3.1),
      step(1.5, 2, 0, ['S', 'E'], C.BLUE, false, 3.1),
      step(3.5, 2, 2, ['W', 'E'], C.BLUE),
      step(3.8, 3, 2, ['W', 'E'], C.BLUE),
      step(4.1, 4, 2, ['W', 'E'], C.BLUE),
      step(4.4, 5, 2, ['W', 'E'], C.BLUE)
    ],
    cut: { from: 2.0, to: 3.1, x: 2, y: 1 },
    deliver: 4.9, clear: 5.6, loop: 6.5
  };

  // The strip under the board, which is the one part of the screen that is not
  // the board. A piece goes into the shredder and is gone; the next one goes
  // into a bin and waits there.
  // FOUR rows, not five: this is the one lesson with the strip drawn under the
  // grid, and on a page that takes one cell size for every board (the help
  // screen does) a six-and-a-half-cell panel would shrink the other three.
  var L_STRIP = {
    w: 6, h: 4,
    sources: [{ row: 2, colour: C.RED }],
    demands: [{ row: 2, colour: C.RED }],
    strip: true,
    steps: [
      step(0.3, 0, 2, ['W', 'E'], C.RED),
      step(0.6, 1, 2, ['W', 'E'], C.RED)
    ],
    shred: { t: 1.2, from: [3, 2] },
    stash: { t: 3.2, from: [3, 2], bin: 0 },
    loop: 5.6
  };

  // The surge: one slab lifts off, another lands somewhere else, and the bulb
  // is re-dealt on the same beat. Nothing is delivered — the run that was
  // finished is the wrong colour now, which is exactly what the trigger does.
  var L_SURGE = {
    w: 6, h: 5,
    sources: [{ row: 2, colour: C.RED }, { row: 4, colour: C.YELLOW }],
    demands: [{ row: 2, colour: C.RED }],
    slabs: [{ t: 0, x: 1, y: 0, size: 2, until: 2.2 },
            { t: 2.5, x: 3, y: 3, size: 2 }],
    redeal: { t: 2.5, colour: C.ORANGE },
    steps: [
      step(0.3, 0, 2, ['W', 'E'], C.RED),
      step(0.6, 1, 2, ['W', 'E'], C.RED),
      step(0.9, 2, 2, ['W', 'E'], C.RED),
      step(1.2, 3, 2, ['W', 'E'], C.RED),
      step(1.5, 4, 2, ['W', 'E'], C.RED),
      step(1.8, 5, 2, ['W', 'E'], C.RED)
    ],
    loop: 4.8
  };

  // The ladder and the clock, with the half a finished line pays back drawn as
  // a jump in the bar rather than described.
  // Four rows for the same reason L_STRIP has four: the clock bar under the
  // grid is another cell of height this board asks for and the others do not.
  var L_CLOCK = {
    w: 6, h: 4,
    sources: [{ row: 2, colour: C.BLUE }],
    demands: [{ row: 2, colour: C.BLUE }],
    clock: { start: 0.52, drain: 0.10 },
    steps: [
      step(0.3, 0, 2, ['W', 'E'], C.BLUE),
      step(0.6, 1, 2, ['W', 'E'], C.BLUE),
      step(0.9, 2, 2, ['W', 'E'], C.BLUE),
      step(1.2, 3, 2, ['W', 'E'], C.BLUE),
      step(1.5, 4, 2, ['W', 'E'], C.BLUE),
      step(1.8, 5, 2, ['W', 'E'], C.BLUE)
    ],
    deliver: 2.3, clear: 3.0, loop: 4.8
  };

  var LESSONS = [
    { id: 'WIRE', title: 'WIRE IT', script: L_WIRE,
      caption: 'Power comes in on the left. Run wire across to a demand — the ' +
               'bulb on the right asking for one colour — and the whole line ' +
               'lights up and clears away.' },
    { id: 'TURN', title: 'TURN AND JOG', script: L_TURN,
      caption: 'Every piece turns before you put it down. Bend the run up and ' +
               'over whatever is in the way, then step it back down to the bulb.' },
    { id: 'SPLIT', title: 'SPLIT', script: L_SPLIT,
      caption: 'Any piece with three or more ways out is a junction. One colour ' +
               'arrives and it pours out of every other way, so one run can feed ' +
               'two bulbs at once.' },
    { id: 'MIX', title: 'MIX', script: L_MIX,
      caption: 'Press on a junction and it turns from a splitter into a mixer. ' +
               'Red and yellow arriving together now leave as orange, which is ' +
               'what this bulb wants.' },
    { id: 'SHORT', title: 'SHORT', script: L_SHORT,
      caption: 'Two different colours meeting in plain wire is a SHORT. It ' +
               'sparks, and the whole run burns away. Colours are only allowed ' +
               'to meet at a junction.' },
    { id: 'CUT', title: 'THE DESTRUCTOR', script: L_CUT,
      caption: 'The destructor cuts a cross and takes only the wire it covers, ' +
               'so a mistake costs three cells and not the run. It cannot touch ' +
               'a red slab — those you build around.' },
    { id: 'STRIP', title: 'SHRED AND STASH', script: L_STRIP,
      caption: 'A piece you cannot use goes in the SHRED and is gone, and the ' +
               'shredder takes a few seconds to reload. One you want later waits ' +
               'in a BIN, swapping with whatever is already in there.' },
    { id: 'SURGE', title: 'THE SURGE', script: L_SURGE,
      caption: 'When the surge bar empties, every red slab lifts off and lands ' +
               'somewhere else. On EXTREME the bulbs are re-dealt on the same ' +
               'beat, so a finished run can come out the wrong colour.' },
    { id: 'CLOCK', title: 'LEVELS AND THE CLOCK', script: L_CLOCK,
      caption: 'Ten lines wire a level and three levels finish the rig. Every ' +
               'line you finish puts half the clock back. CALM has no clock at ' +
               'all and cannot be lost.' }
  ];

  // ---- drawing -------------------------------------------------------------

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // The plural forms, said once. A script may write `demand` or `demands` and
  // `slab` or `slabs`; everything below this line only ever sees the list.
  function demandsOf(s) {
    return s.demands || (s.demand ? [s.demand] : []);
  }
  function slabsOf(s) {
    return s.slabs || (s.slab ? [s.slab] : []);
  }

  // How big a box this script needs at this cell size. The renderer asks
  // rather than working it out, because a panel with a strip or a clock under
  // it is taller than the grid and only this file knows by how much.
  // Both of these are the arithmetic the drawing below uses, said once so the
  // box a panel reserves and the pixels that land in it cannot drift apart.
  function stripExtra(cell) {
    return Math.round(cell * 0.3) + Math.max(16, Math.round(cell * 1.0)) + 2;
  }
  function clockExtra(cell) {
    return Math.round(cell * 0.35) + Math.max(5, Math.round(cell * 0.22)) +
           Math.round(cell * 0.32) + Math.max(7, Math.round(cell * 0.3));
  }

  function size(script, cell) {
    var h = script.h * cell;
    if (script.strip) h += stripExtra(cell);
    else if (script.clock) h += clockExtra(cell);
    return { w: (script.w + 2) * cell, h: h };
  }

  // The three targets of the strip, in the real one's order: SHRED on the
  // left, then the two bins (layout.js, EVRTEK 2026-09-14). A lesson that put
  // the shredder somewhere else would teach the wrong reach.
  function stripBoxes(gx, gy, script, cell) {
    var y = gy + script.h * cell + Math.round(cell * 0.3);
    var h = Math.max(16, Math.round(cell * 1.0));
    var gap = Math.max(2, Math.round(cell * 0.12));
    var w = Math.floor((script.w * cell - gap * 2) / 3);
    return [
      { label: 'SHRED', x: gx, y: y, w: w, h: h },
      { label: 'BIN 1', x: gx + w + gap, y: y, w: w, h: h },
      { label: 'BIN 2', x: gx + 2 * (w + gap), y: y, w: w, h: h }
    ];
  }

  // A piece in hand, drawn small: a token with a wire through it. It is not a
  // real piece and does not pretend to be — what matters is that the same
  // object goes in the shredder or in the bin.
  function token(ctx, x, y, cell, alpha) {
    var w = cell * 1.3, h = cell * 0.78;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#16213a';
    roundRect(ctx, x - w / 2, y - h / 2, w, h, 3);
    ctx.fill();
    ctx.strokeStyle = '#2fe3e3';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = '#2fe3e3';
    ctx.lineWidth = Math.max(1.5, cell * 0.14);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + 3, y);
    ctx.lineTo(x + w / 2 - 3, y);
    ctx.stroke();
    ctx.restore();
  }

  function drawSlabBox(ctx, x, y, w, h, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#3d1218';
    roundRect(ctx, x, y, w, h, 3);
    ctx.fill();
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    roundRect(ctx, x, y, w, h, 3);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,59,48,0.45)';
    ctx.lineWidth = 1.5;
    for (var d = -h; d < w; d += 7) {
      ctx.beginPath();
      ctx.moveTo(x + d, y + h);
      ctx.lineTo(x + d + h, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Draw one script at time t inside a box. `live` false freezes it at the
  // start, which is how the two unselected panels sit still.
  function draw(ctx, script, bx, by, cell, t, live) {
    var i, s, d;
    if (!live) t = 0.15;
    t = t % script.loop;

    var gx = bx + cell, gy = by;
    var demands = demandsOf(script), slabs = slabsOf(script);
    // A script with no delivery at all (the SHORT lesson, the SURGE lesson)
    // must not light anything and must not fade anything, so the two clocks
    // are asked whether they exist rather than compared blind.
    var pays = typeof script.deliver === 'number';

    // grid
    ctx.strokeStyle = '#1c2438';
    ctx.lineWidth = 1;
    for (i = 0; i <= script.w; i++) {
      ctx.beginPath();
      ctx.moveTo(gx + i * cell, gy);
      ctx.lineTo(gx + i * cell, gy + script.h * cell);
      ctx.stroke();
    }
    for (i = 0; i <= script.h; i++) {
      ctx.beginPath();
      ctx.moveTo(gx, gy + i * cell);
      ctx.lineTo(gx + script.w * cell, gy + i * cell);
      ctx.stroke();
    }

    // THE RED SLABS (EVRTEK 2026-09-14). Drawn under the wire, like the board
    // draws them, and in the same deep red with the bright edge — this is
    // where a player first learns that the red thing is not something they can
    // cut. One drops in over a fifth of a second so the eye catches it
    // landing; one with an `until` LIFTS OFF at that moment and is gone, which
    // is the surge relocating rather than adding.
    for (i = 0; i < slabs.length; i++) {
      var sl = slabs[i];
      if (t < sl.t) continue;
      var lifts = typeof sl.until === 'number';
      if (lifts && t >= sl.until + RISE) continue;
      var kp = Math.min(1, (t - sl.t) / 0.22);
      var up = 0, alpha = kp;
      if (lifts && t >= sl.until) {
        var rk = Math.min(1, (t - sl.until) / RISE);
        up = rk * cell * 1.8;
        alpha = 1 - rk;
      }
      drawSlabBox(ctx,
        gx + sl.x * cell + 1,
        gy + sl.y * cell + 1 - (1 - kp) * cell * 0.7 - up,
        sl.size * cell - 2, sl.size * cell - 2, alpha);
    }

    // sources
    for (i = 0; i < script.sources.length; i++) {
      s = script.sources[i];
      var sy = gy + s.row * cell + cell / 2;
      ctx.fillStyle = C.hex(s.colour);
      roundRect(ctx, gx - cell + 2, sy - cell / 2 + 2, cell - 4, cell - 4, 2);
      ctx.fill();
    }

    // The demands are the same light bulbs the game draws, just small: a ring
    // in the colour it wants, with the primaries that make it inside.
    //
    // WHAT ONE WANTS CAN CHANGE (EVRTEK 2026-09-14, EXTREME): the surge
    // re-deals it, so the ring and the recipe are read off `wants` rather than
    // off the script's opening colour, and a spinning dashed ring marks the
    // moment it changed. A re-deal names the FIRST demand, which is the only
    // one any script with a re-deal has.
    var lit = pays && t >= script.deliver && t < script.clear;
    var dr = cell * 0.36;
    for (d = 0; d < demands.length; d++) {
      var dem = demands[d];
      var wants = (d === 0 && script.redeal && t >= script.redeal.t)
        ? script.redeal.colour : dem.colour;
      var dy = gy + dem.row * cell + cell / 2;
      var dx2 = gx + script.w * cell + cell / 2;
      ctx.beginPath();
      ctx.arc(dx2, dy, dr, 0, Math.PI * 2);
      ctx.fillStyle = lit ? '#18213a' : '#0e1424';
      ctx.fill();
      ctx.strokeStyle = C.hex(wants);
      ctx.lineWidth = lit ? 3 : 2;
      ctx.stroke();
      var dn = C.depth(wants), rr2 = dr * 0.34, gp = rr2 * 0.6;
      C.recipeGlyphs(ctx, wants, dx2 - (dn * rr2 * 2 + (dn - 1) * gp) / 2, dy, rr2, gp);
      if (d === 0 && script.redeal && t >= script.redeal.t && t < script.redeal.t + 0.9) {
        var rk2 = 1 - (t - script.redeal.t) / 0.9;
        ctx.save();
        ctx.globalAlpha = rk2;
        ctx.translate(dx2, dy);
        ctx.rotate((1 - rk2) * 7);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, dr + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // A PIECE TURNING before it lands. The ways are drawn faint and step round
    // a quarter at a time, which is what Q and E (or a tap beside the piece)
    // actually do — the one half of "turn and jog" a still picture cannot say.
    if (script.spin && t >= script.spin.t && t < script.spin.until) {
      var sp = script.spin;
      var quarters = Math.floor((t - sp.t) / 0.28) % 4;
      var sax = gx + sp.x * cell + cell / 2, say = gy + sp.y * cell + cell / 2;
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#8fa2c8';
      ctx.lineWidth = Math.max(2, cell * 0.18);
      ctx.lineCap = 'round';
      for (i = 0; i < sp.e.length; i++) {
        var way = sp.e[i];
        for (var q = 0; q < quarters; q++) way = CWROT[way];
        ctx.beginPath();
        ctx.moveTo(sax, say);
        ctx.lineTo(sax + (way === 'E' ? cell / 2 : way === 'W' ? -cell / 2 : 0),
                   say + (way === 'S' ? cell / 2 : way === 'N' ? -cell / 2 : 0));
        ctx.stroke();
      }
      // the turn itself, as an arc with a tick on the end of it
      ctx.strokeStyle = '#ffd60a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sax, say, cell * 0.42, -1.2, 1.2);
      ctx.stroke();
      ctx.restore();
    }

    // the wire, as far as the script has got
    var fade = (pays && t >= script.clear) ? Math.max(0, 1 - (t - script.clear) * 4) : 1;
    ctx.globalAlpha = fade;
    // A cell marked `die` flickers red while the destructor is armed over it
    // or while the run is SHORTING. Both are the same picture — wire about to
    // stop being wire — so they are the same branch.
    var cutting = script.cut && t >= script.cut.from && t < script.cut.to;
    var sparking = cutting ||
      (script.spark && t >= script.spark.from && t < script.spark.to);
    for (i = 0; i < script.steps.length; i++) {
      s = script.steps[i];
      if (t < s.t) continue;
      if (s.die && t >= s.die) continue;
      var a = gx + s.x * cell + cell / 2, b = gy + s.y * cell + cell / 2;
      var pop = Math.min(1, (t - s.t) * 8);
      var shown = (s.becomes && t >= s.becomes.t) ? s.becomes.colour : s.colour;
      ctx.strokeStyle = (sparking && s.die) ? '#ff3b30' : C.hex(shown);
      if (sparking && s.die) ctx.globalAlpha = fade * (0.55 + 0.45 * Math.abs(Math.sin(t * 20)));
      ctx.lineWidth = Math.max(2, cell * 0.22) * pop;
      ctx.lineCap = 'round';
      for (var e = 0; e < s.e.length; e++) {
        var dd = s.e[e];
        var px = a + (dd === 'E' ? cell / 2 : dd === 'W' ? -cell / 2 : 0);
        var py = b + (dd === 'S' ? cell / 2 : dd === 'N' ? -cell / 2 : 0);
        ctx.beginPath();
        ctx.moveTo(a, b);
        ctx.lineTo(px, py);
        ctx.stroke();
      }
      ctx.globalAlpha = fade;
      if (s.hub) {
        // The mode letter, the same S / M the real board draws.
        var m = (script.toggle && t >= script.toggle.t) ? 'M' : 'S';
        var mk = m === 'M' ? '#ffd60a' : '#8fa2c8';
        var press = script.toggle && t >= script.toggle.t && t < script.toggle.t + 0.35;
        ctx.fillStyle = '#0d1220';
        ctx.strokeStyle = press ? '#ffffff' : mk;
        ctx.lineWidth = press ? 2.5 : 2;
        ctx.beginPath();
        ctx.arc(a, b, cell * 0.34, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.font = '700 ' + Math.round(cell * 0.5) + 'px Consolas, "Courier New", monospace';
        ctx.fillStyle = mk;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(m, a, b + 0.5);
      }
    }

    // The tool itself: the cross, drawn as five cells with the centre marked,
    // so the panel shows the SHAPE of the destructor and not just its effect.
    if (script.cut) {
      var CX = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
      var ccx = gx + script.cut.x * cell + cell / 2;
      var ccy = gy + script.cut.y * cell + cell / 2;
      if (cutting) {
        ctx.strokeStyle = '#ff3b30';
        ctx.setLineDash([3, 2]);
        ctx.lineWidth = 1.5;
        for (i = 0; i < CX.length; i++) {
          var ax2 = script.cut.x + CX[i][0], ay2 = script.cut.y + CX[i][1];
          if (ax2 < 0 || ay2 < 0 || ax2 >= script.w || ay2 >= script.h) continue;
          ctx.strokeRect(gx + ax2 * cell + 2, gy + ay2 * cell + 2, cell - 4, cell - 4);
        }
        ctx.setLineDash([]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ccx - 4, ccy - 4); ctx.lineTo(ccx + 4, ccy + 4);
        ctx.moveTo(ccx + 4, ccy - 4); ctx.lineTo(ccx - 4, ccy + 4);
        ctx.stroke();
      }
      if (t >= script.cut.to && t < script.cut.to + 0.45) {
        var bk = (t - script.cut.to) / 0.45;
        ctx.globalAlpha = 1 - bk;
        ctx.strokeStyle = '#ff3b30';
        ctx.lineWidth = 3 * (1 - bk);
        ctx.beginPath();
        ctx.arc(ccx, ccy, cell * (0.4 + bk * 2.2), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    ctx.globalAlpha = 1;

    // THE STRIP (EVRTEK 2026-09-14). Three boxes under the grid, and a piece
    // flying into one of them: SHRED disintegrates it and then has to reload;
    // a BIN keeps it, drawn sitting in the well for the rest of the loop.
    if (script.strip) {
      var boxes = stripBoxes(gx, gy, script, cell);
      var held = script.stash && t >= script.stash.t + HOLD + FLY ? script.stash.bin + 1 : -1;
      var shredT = script.shred ? t - script.shred.t : -1;
      var cooling = script.shred && shredT >= HOLD + FLY && shredT < HOLD + FLY + COOL;
      for (i = 0; i < boxes.length; i++) {
        var bx2 = boxes[i];
        var hot = (i === 0 && script.shred && shredT >= HOLD + FLY && shredT < HOLD + FLY + FRAG);
        ctx.fillStyle = hot ? '#2a1620' : '#111726';
        roundRect(ctx, bx2.x, bx2.y, bx2.w, bx2.h, 4);
        ctx.fill();
        ctx.strokeStyle = hot ? '#ffffff' : (i === held ? '#2fe3e3' : '#1c2438');
        ctx.lineWidth = (hot || i === held) ? 2 : 1;
        ctx.stroke();
        if (i === 0) {
          // the slot, with teeth in it
          var mw = bx2.w - 10, mh = Math.max(5, bx2.h * 0.34);
          var mx = bx2.x + 5, my = bx2.y + 5;
          ctx.fillStyle = '#05080f';
          roundRect(ctx, mx, my, mw, mh, 2);
          ctx.fill();
          ctx.strokeStyle = hot ? '#ffffff' : '#3a4358';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (var tth = 0; tth <= 6; tth++) {
            var txp = mx + tth * (mw / 6);
            ctx.moveTo(txp, my);
            ctx.lineTo(txp + mw / 12, my + mh * 0.6);
          }
          ctx.stroke();
          if (cooling) {
            var ck = (shredT - HOLD - FLY) / COOL;
            ctx.fillStyle = '#1b2233';
            ctx.fillRect(bx2.x + 4, bx2.y + bx2.h - 4, bx2.w - 8, 2);
            ctx.fillStyle = '#ff8c1a';
            ctx.fillRect(bx2.x + 4, bx2.y + bx2.h - 4, (bx2.w - 8) * ck, 2);
          }
        } else if (i === held) {
          token(ctx, bx2.x + bx2.w / 2, bx2.y + bx2.h * 0.45, cell * 0.7, 1);
        }
        ctx.font = '700 ' + Math.max(7, Math.round(cell * 0.3)) +
          'px Consolas, "Courier New", monospace';
        ctx.fillStyle = hot ? '#ffffff' : '#6d7c9c';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bx2.label, bx2.x + bx2.w / 2, bx2.y + bx2.h - 6);
      }

      // The two flights, and the fragments the shredder makes of one of them.
      var events = [];
      if (script.shred) events.push({ ev: script.shred, box: boxes[0], burst: true });
      if (script.stash) events.push({ ev: script.stash, box: boxes[script.stash.bin + 1], burst: false });
      for (i = 0; i < events.length; i++) {
        var evn = events[i], ev = evn.ev, k = t - ev.t;
        if (k < 0) continue;
        var fx0 = gx + ev.from[0] * cell + cell / 2;
        var fy0 = gy + ev.from[1] * cell + cell / 2;
        var fx1 = evn.box.x + evn.box.w / 2, fy1 = evn.box.y + evn.box.h * 0.45;
        if (k < HOLD) {
          token(ctx, fx0, fy0, cell, 1);
        } else if (k < HOLD + FLY) {
          var fk = (k - HOLD) / FLY;
          token(ctx, fx0 + (fx1 - fx0) * fk, fy0 + (fy1 - fy0) * fk, cell * (1 - fk * 0.3), 1);
        } else if (evn.burst && k < HOLD + FLY + FRAG) {
          var gk = (k - HOLD - FLY) / FRAG;
          ctx.save();
          ctx.globalAlpha = 1 - gk;
          for (var fr = 0; fr < 9; fr++) {
            var ang = frand(fr + 1) * Math.PI * 2;
            var spd = (0.4 + frand(fr + 11) * 0.9) * cell * 1.6;
            ctx.fillStyle = fr % 2 ? '#2fe3e3' : '#ff8c1a';
            ctx.fillRect(fx1 + Math.cos(ang) * spd * gk - 1,
                         fy1 + Math.sin(ang) * spd * gk - 1, 3, 3);
          }
          ctx.restore();
        }
      }
    }

    // THE CLOCK, under the grid: it drains, and a finished line puts half of it
    // back. EVRTEK'S LADDER (2026-09-08): "a level's credit per line is always
    // half its own main clock", which is a thing to SHOW rather than to say.
    if (script.clock) {
      var cy2 = gy + script.h * cell + Math.round(cell * 0.35);
      var cw2 = script.w * cell, ch2 = Math.max(5, Math.round(cell * 0.22));
      var v = script.clock.start - script.clock.drain * t;
      if (pays && t >= script.deliver) v += 0.5;
      v = Math.max(0, Math.min(1, v));
      ctx.fillStyle = '#1b2233';
      roundRect(ctx, gx, cy2, cw2, ch2, 2);
      ctx.fill();
      ctx.fillStyle = v < 0.25 ? '#ff3b30' : '#3ede72';
      roundRect(ctx, gx, cy2, cw2 * v, ch2, 2);
      ctx.fill();
      ctx.font = '700 ' + Math.max(7, Math.round(cell * 0.3)) +
        'px Consolas, "Courier New", monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#6d7c9c';
      ctx.fillText('CLOCK', gx, cy2 + ch2 + Math.round(cell * 0.32));
      if (pays && t >= script.deliver && t < script.deliver + 0.8) {
        ctx.globalAlpha = 1 - (t - script.deliver) / 0.8;
        ctx.textAlign = 'right';
        ctx.fillStyle = '#3ede72';
        ctx.fillText('+ HALF', gx + cw2, cy2 + ch2 + Math.round(cell * 0.32));
        ctx.globalAlpha = 1;
      }
    }

    if (lit) {
      for (d = 0; d < demands.length; d++) {
        ctx.globalAlpha = 1 - (t - script.deliver) / (script.clear - script.deliver);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(gx + script.w * cell + cell / 2,
                gy + demands[d].row * cell + cell / 2,
                cell * (0.5 + (t - script.deliver) * 3), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  return { SCRIPTS: SCRIPTS, LESSONS: LESSONS, draw: draw, size: size,
           CALM: CALM, MIXED: MIXED, SNIP: SNIP, SURGE: SURGE };
})();
