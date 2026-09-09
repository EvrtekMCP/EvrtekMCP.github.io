'use strict';
// CROSSWIRE — the tutorial boards on the difficulty screen.
//
// EVRTEK 2026-09-07: the three difficulties should each show a sample board
// with a tutorial essentially being played on it, looping. The highlighted one
// animates; the others hold still.
//
// These are SCRIPTED PICTURES, not the real engine. That is deliberate: a demo
// has to read clearly in a five-second loop, and the real solver would need a
// board, a feed and a clock to say the same thing. Every step here is a cell
// appearing with the colour it would actually carry.
var CW_DEMO = (function () {

  var C = CW_COLOUR;

  // t: when the cell appears. e: the ways it joins. hub: it is a junction.
  // die: when it burns away, for the script that shows a mistake being cleared.
  function step(t, x, y, e, colour, hub, die) {
    return { t: t, x: x, y: y, e: e, colour: colour, hub: !!hub, die: die || 0 };
  }

  // A cell that changes colour partway through, which is what a junction going
  // from S to M does to everything downstream of it.
  function turns(st, t, colour) { st.becomes = { t: t, colour: colour }; return st; }

  // A straight run from one source to one demand. Nothing to learn but the
  // shape of the game.
  var BASIC = {
    w: 6, h: 5,
    sources: [{ row: 2, colour: C.RED }],
    demand: { row: 2, colour: C.RED },
    caption: 'wire a source straight to a demand',
    steps: [
      step(0.5, 0, 2, ['W', 'E'], C.RED),
      step(0.9, 1, 2, ['W', 'E'], C.RED),
      step(1.3, 2, 2, ['W', 'E'], C.RED),
      step(1.9, 3, 2, ['W', 'E'], C.RED),
      step(2.3, 4, 2, ['W', 'E'], C.RED),
      step(2.7, 5, 2, ['W', 'E'], C.RED)
    ],
    deliver: 3.2, clear: 3.9, loop: 4.6
  };

  // EVRTEK 2026-09-07: every junction lands as a SPLITTER, and mixing is a
  // decision the player makes. So the middle panel plays exactly that: the
  // junction goes in, carries red straight through because that is what a
  // splitter does, the demand stays unlit — and then it is toggled to M and
  // the whole line downstream turns orange.
  var MIXED = {
    w: 6, h: 5,
    sources: [{ row: 1, colour: C.RED }, { row: 3, colour: C.YELLOW }],
    demand: { row: 2, colour: C.ORANGE },
    caption: 'a junction lands on S. press to make it M',
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

  // Same idea, plus the branch that makes one run feed two demands.
  var SPLIT = {
    w: 6, h: 5,
    sources: [{ row: 1, colour: C.RED }, { row: 3, colour: C.BLUE }],
    demand: { row: 2, colour: C.PURPLE },
    caption: 'one junction mixes, and splits what leaves',
    steps: [
      step(0.4, 0, 1, ['W', 'E'], C.RED),
      step(0.7, 1, 1, ['W', 'E'], C.RED),
      step(1.0, 2, 1, ['W', 'S'], C.RED),
      step(1.4, 0, 3, ['W', 'E'], C.BLUE),
      step(1.7, 1, 3, ['W', 'E'], C.BLUE),
      step(2.0, 2, 3, ['N', 'W'], C.BLUE),
      step(2.5, 2, 2, ['N', 'S', 'E'], C.PURPLE, true),
      step(3.0, 3, 2, ['W', 'E'], C.PURPLE),
      step(3.3, 4, 2, ['W', 'E'], C.PURPLE),
      step(3.6, 5, 2, ['W', 'E'], C.PURPLE)
    ],
    deliver: 4.1, clear: 4.9, loop: 5.6
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
    caption: 'the destructor cuts a cross, and only that',
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

  var SCRIPTS = [BASIC, MIXED, SNIP];

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Draw one script at time t inside a box. `live` false freezes it at the
  // start, which is how the two unselected panels sit still.
  function draw(ctx, script, bx, by, cell, t, live) {
    var i, s;
    if (!live) t = 0.15;
    t = t % script.loop;

    var gx = bx + cell, gy = by;
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

    // sources and the demand
    for (i = 0; i < script.sources.length; i++) {
      s = script.sources[i];
      var sy = gy + s.row * cell + cell / 2;
      ctx.fillStyle = C.hex(s.colour);
      roundRect(ctx, gx - cell + 2, sy - cell / 2 + 2, cell - 4, cell - 4, 2);
      ctx.fill();
    }
    // The demand is the same light bulb the game draws, just small: a ring in
    // the colour it wants, with the primaries that make it inside.
    var dy = gy + script.demand.row * cell + cell / 2;
    var dx2 = gx + script.w * cell + cell / 2;
    var lit = t >= script.deliver && t < script.clear;
    var dr = cell * 0.36;
    ctx.beginPath();
    ctx.arc(dx2, dy, dr, 0, Math.PI * 2);
    ctx.fillStyle = lit ? '#18213a' : '#0e1424';
    ctx.fill();
    ctx.strokeStyle = C.hex(script.demand.colour);
    ctx.lineWidth = lit ? 3 : 2;
    ctx.stroke();
    var dn = C.depth(script.demand.colour), rr2 = dr * 0.34, gp = rr2 * 0.6;
    C.recipeGlyphs(ctx, script.demand.colour,
      dx2 - (dn * rr2 * 2 + (dn - 1) * gp) / 2, dy, rr2, gp);

    // the wire, as far as the script has got
    var fade = (t >= script.clear) ? Math.max(0, 1 - (t - script.clear) * 4) : 1;
    ctx.globalAlpha = fade;
    var cutting = script.cut && t >= script.cut.from && t < script.cut.to;
    for (i = 0; i < script.steps.length; i++) {
      s = script.steps[i];
      if (t < s.t) continue;
      if (s.die && t >= s.die) continue;
      var a = gx + s.x * cell + cell / 2, b = gy + s.y * cell + cell / 2;
      var pop = Math.min(1, (t - s.t) * 8);
      var shown = (s.becomes && t >= s.becomes.t) ? s.becomes.colour : s.colour;
      ctx.strokeStyle = (cutting && s.die) ? '#ff3b30' : C.hex(shown);
      if (cutting && s.die) ctx.globalAlpha = fade * (0.55 + 0.45 * Math.abs(Math.sin(t * 20)));
      ctx.lineWidth = Math.max(2, cell * 0.22) * pop;
      ctx.lineCap = 'round';
      for (var e = 0; e < s.e.length; e++) {
        var d = s.e[e];
        var px = a + (d === 'E' ? cell / 2 : d === 'W' ? -cell / 2 : 0);
        var py = b + (d === 'S' ? cell / 2 : d === 'N' ? -cell / 2 : 0);
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

    if (lit) {
      ctx.globalAlpha = 1 - (t - script.deliver) / (script.clear - script.deliver);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(gx + script.w * cell + cell / 2, dy, cell * (0.5 + (t - script.deliver) * 3), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  return { SCRIPTS: SCRIPTS, draw: draw,
           BASIC: BASIC, MIXED: MIXED, SPLIT: SPLIT, SNIP: SNIP };
})();
