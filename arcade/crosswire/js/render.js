'use strict';
// CROSSWIRE — drawing.
//
// Everything is drawn from arithmetic. No image files, no font files, no
// external request: the same house rule the rest of the Arcade ships under,
// and the reason this runs from a file:// URL with nothing installed.
var CW_RENDER = (function () {

  var C = CW_COLOUR;

  // EVRTEK 2026-09-07: "can we make the game mobile friendly as well." Every
  // number below used to be a constant. They are now module variables written
  // by setLayout() out of a CW_LAYOUT, because there are two shapes of cabinet
  // and the renderer has to be able to be told which one it is drawing. The
  // desktop layout holds exactly the numbers this file always had, so nothing
  // downstream of here changed: the drawing code still says GRID_X.
  var L = null;
  var CELL, GRID_X, GRID_Y, SRC_X, SRC_W;
  var BAR_X, BAR_W;                // the main clock, hugging the play space
  var BAR2_X, BAR2_W;              // the surge clock, on the far side
  var TGT_X;                       // where the lead from the grid ends
  var BULB_R, BULB_CX, STAT_X;
  var PIECE_X, PIECE_W;
  var W, H;
  var MOBILE = false, LITE = false;
  // Every hand-tuned pixel size in here was measured against a 30px cell. K is
  // the ratio of the live cell to that one, so a wire that was 6px thick on
  // desktop stays the same fraction of its cell on a phone.
  var K = 1;

  var BG = '#0a0e18', PANEL = '#111726', LINE = '#1c2438', WIRE_OFF = '#39435c';
  var INK = '#c9d6f0', INK_DIM = '#6d7c9c', ACCENT = '#2fe3e3';

  var MONO = '600 13px Consolas, "Courier New", monospace';
  var MONO_S = '600 11px Consolas, "Courier New", monospace';
  var MONO_XS = '600 10px Consolas, "Courier New", monospace';
  var MONO_B = '700 15px Consolas, "Courier New", monospace';
  var MONO_L = '700 19px Consolas, "Courier New", monospace';
  var TITLE = '700 32px Consolas, "Courier New", monospace';

  var showSymbols = true;
  var rotatePrompt = false;
  var helpCards = null;            // the lesson panels, built lazily
  var OPP = { N: 'S', E: 'W', S: 'N', W: 'E' };
  var DX = { N: 0, E: 1, S: 0, W: -1 }, DY = { N: -1, E: 0, S: 1, W: 0 };

  // Touch targets for the CURRENT screen, in logical canvas coordinates.
  // Rebuilt from scratch every frame by the same code that draws them, so a
  // button can never be somewhere the finger is not — there is one set of
  // numbers, not two.
  var hits = [];
  function hit(id, x, y, w, h) { hits.push({ id: id, x: x, y: y, w: w, h: h }); }

  function setLayout(nl) {
    L = nl || CW_LAYOUT.desktop();
    CELL = L.cell; GRID_X = L.gridX; GRID_Y = L.gridY;
    SRC_X = L.srcX; SRC_W = L.srcW;
    BAR_X = L.barX; BAR_W = L.barW;
    BAR2_X = L.bar2X; BAR2_W = L.bar2W;
    TGT_X = L.tgtX; BULB_R = L.bulbR; BULB_CX = L.bulbCx; STAT_X = L.statX;
    PIECE_X = L.pieceX; PIECE_W = L.pieceW;
    W = L.W; H = L.H;
    MOBILE = !!L.mobile; LITE = !!L.lite;
    K = CELL / 30;
    helpCards = null;
    field = null;                    // the title's field is laid out per canvas size too
  }
  setLayout(CW_LAYOUT.desktop());

  // LITE skips every glow. A phone GPU pays real money for shadowBlur and the
  // board has hundreds of strokes on it, so the whole mobile layout runs lite.
  function setGlow(ctx, hex, blur) {
    if (LITE) return;
    ctx.shadowColor = hex;
    ctx.shadowBlur = blur;
  }

  function cx(x) { return GRID_X + x * CELL + CELL / 2; }
  function cy(y) { return GRID_Y + y * CELL + CELL / 2; }

  function edgePoint(x, y, e) {
    var a = cx(x), b = cy(y), h = CELL / 2;
    if (e === 'N') return [a, b - h];
    if (e === 'S') return [a, b + h];
    if (e === 'E') return [a + h, b];
    return [a - h, b];
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(ctx, s, x, y, font, colour, align) {
    ctx.font = font || MONO;
    ctx.fillStyle = colour || INK;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }

  function clock(s) {
    s = Math.max(0, s);
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  // Trim a line to fit a box, measured rather than counted. Every hand-counted
  // width in this file is counted against Courier New, which is the monospace
  // an iPhone actually has; this asks the canvas instead, which is the only way
  // to be right on a machine that has neither of the fonts named here.
  function clip(ctx, s, font, maxw) {
    ctx.font = font || MONO;
    if (ctx.measureText(s).width <= maxw) return s;
    var t = String(s);
    while (t.length > 1 && ctx.measureText(t + '…').width > maxw) t = t.slice(0, -1);
    return t + '…';
  }

  // A difficulty's blurb, broken for a narrow card. The rules write it as one
  // string with middle dots — "seven sources · 4 to 7 demands · no clock" —
  // which was fine when there were three cards on a 920px screen and is 265px
  // of 11px Courier New in a card that is now 208. Split at the FIRST dot, so
  // the head of it (how many sources) sits on its own line and everything else
  // follows on the second.
  function blurbLines(s) {
    var parts = String(s || '').split(' · ');
    if (parts.length <= 1) return parts;
    return [parts[0], parts.slice(1).join(' · ')];
  }

  // ---- wire ---------------------------------------------------------------

  function edgesOf(node) { return node.e; }

  // ---- current ------------------------------------------------------------
  // A breadth-first walk out from every source, stamping each node with how
  // far the power travelled to reach it. Drawn as a bright pulse that runs
  // along the wire source-outward, so the direction of flow is visible on
  // every cell and not only at the junctions' arrows. Renderer-only: the
  // stamp lives on the node but the rules never read it.
  function computeFlow(board) {
    var x, y, i, c, queue = [], head = 0;
    for (y = 0; y < board.h; y++) {
      for (x = 0; x < board.w; x++) {
        c = board.at(x, y);
        if (!c || c.dead) continue;
        for (i = 0; i < c.nodes.length; i++) c.nodes[i]._flow = -1;
      }
    }
    for (i = 0; i < board.sources.length; i++) {
      var src = board.sources[i], ni = board.nodeOnEdge(0, src.row, 'W');
      if (ni < 0) continue;
      var n0 = board.at(0, src.row).nodes[ni];
      if (n0._flow >= 0) continue;
      n0._flow = 0;
      queue.push({ x: 0, y: src.row, node: n0 });
    }
    while (head < queue.length) {
      var q = queue[head++], ee = q.node.e;
      for (i = 0; i < ee.length; i++) {
        var nx = q.x + DX[ee[i]], ny = q.y + DY[ee[i]];
        if (!board.inside(nx, ny)) continue;
        var nj = board.nodeOnEdge(nx, ny, OPP[ee[i]]);
        if (nj < 0) continue;
        var nn = board.at(nx, ny).nodes[nj];
        if (nn._flow >= 0) continue;
        nn._flow = q.node._flow + 1;
        queue.push({ x: nx, y: ny, node: nn });
      }
    }
  }

  // The pulse itself: a bright head, a fading tail, one cell per step.
  function flowOverlay(ctx, x, y, node) {
    if (!node.colour || node.short || node._flow === undefined || node._flow < 0) return;
    var ph = (node._flow * 0.5 - Date.now() / 1000 * 2.6) % 1;
    if (ph < 0) ph += 1;
    var glow = Math.max(0, 1 - ph * 2.4);
    if (glow <= 0.02) return;
    var a = cx(x), b = cy(y), ee = edgesOf(node);
    ctx.save();
    ctx.globalAlpha = glow * 0.55;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3 * K;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (var i = 0; i < ee.length; i++) {
      var p = edgePoint(x, y, ee[i]);
      ctx.moveTo(a, b);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
    ctx.restore();
  }

  function strokeNode(ctx, x, y, node, hex, surge) {
    var a = cx(x), b = cy(y);
    var lit = hex !== WIRE_OFF;
    ctx.lineCap = 'round';
    ctx.lineWidth = (lit ? 6 : 4) * K;
    ctx.strokeStyle = hex;
    if (lit) setGlow(ctx, hex, 8 + surge * 14);
    var edges = edgesOf(node);
    for (var i = 0; i < edges.length; i++) {
      var p = edgePoint(x, y, edges[i]);
      ctx.beginPath();
      ctx.moveTo(a, b);
      ctx.lineTo(p[0], p[1]);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  // A SPAN lying over another wire. Drawn as a genuine hop: the wire beneath
  // stays whole, and the one on top arches over it with a shadow gap either
  // side, which is the only readable way to say "these do not touch".
  function strokeJump(ctx, x, y, node, hex, surge) {
    var a = cx(x), b = cy(y);
    var horiz = node.e.indexOf('E') >= 0;
    var lit = hex !== WIRE_OFF;
    var stroke = hex;
    // The arch is a fraction of the cell like everything else, or on a phone
    // it would swallow the square it is drawn in.
    var h = CELL / 2, lift = 9 * K;

    // Clear a gap so the wire underneath visibly passes behind the arch.
    ctx.strokeStyle = BG;
    ctx.lineCap = 'butt';
    ctx.lineWidth = 13 * K;
    ctx.beginPath();
    if (horiz) { ctx.moveTo(a - h, b); ctx.lineTo(a + h, b); }
    else { ctx.moveTo(a, b - h); ctx.lineTo(a, b + h); }
    ctx.stroke();

    ctx.strokeStyle = stroke;
    ctx.lineCap = 'round';
    ctx.lineWidth = (lit ? 6 : 4) * K;
    if (lit) setGlow(ctx, stroke, 8 + surge * 12);
    ctx.beginPath();
    if (horiz) {
      ctx.moveTo(a - h, b);
      ctx.lineTo(a - lift, b);
      ctx.arc(a, b, lift, Math.PI, 0, false);
      ctx.moveTo(a + lift, b);
      ctx.lineTo(a + h, b);
    } else {
      ctx.moveTo(a, b - h);
      ctx.lineTo(a, b - lift);
      ctx.arc(a, b, lift, -Math.PI / 2, Math.PI / 2, true);
      ctx.moveTo(a, b + lift);
      ctx.lineTo(a, b + h);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // An arrowhead on an edge, pointing in or out of the cell centre. A VALVE is
  // the only directional thing on the board and its orientation is the only
  // thing about it that its shape does not tell you, so it is spelled out.
  function arrow(ctx, x, y, edge, outward, colour) {
    var a = cx(x), b = cy(y);
    var p = edgePoint(x, y, edge);
    var ux = (p[0] - a) / (CELL / 2), uy = (p[1] - b) / (CELL / 2);
    var px = -uy, py = ux;
    var d = outward ? 1 : -1;
    var tipD = (outward ? 12 : 9) * K;
    var hd = 4 * K, tl = 3 * K;
    var tx = a + ux * tipD, ty = b + uy * tipD;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(tx + ux * hd * d, ty + uy * hd * d);
    ctx.lineTo(tx - ux * tl * d + px * hd, ty - uy * tl * d + py * hd);
    ctx.lineTo(tx - ux * tl * d - px * hd, ty - uy * tl * d - py * hd);
    ctx.closePath();
    ctx.fill();
  }

  // A JUNCTION: three or more ways in one cell. Each way is drawn in the colour
  // actually sitting on it, so an input arm shows its own colour and every
  // output shows the blend. Arrows appear ONLY once flow has resolved, which is
  // Evrtek's point exactly: a junction has no direction until something is
  // connected to it, and then it shows you the one it worked out.
  // EVRTEK 2026-09-07: the mode is stamped on the piece. A player should never
  // have to read the colours downstream to work out what a junction decided.
  function modeMark(ctx, x, y, node) {
    var m = CW_POWER.mode(node);
    var a = cx(x), b = cy(y);
    ctx.beginPath();
    ctx.arc(a, b, 8.5 * K, 0, Math.PI * 2);
    ctx.fillStyle = '#080c15';
    ctx.fill();
    ctx.strokeStyle = m === 'M' ? '#ffd60a' : '#8fa2c8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    text(ctx, m, a, b + 0.5 * K, '700 ' + (13 * K).toFixed(1) + 'px Consolas, "Courier New", monospace',
      m === 'M' ? '#ffd60a' : '#8fa2c8', 'center');
  }

  function drawJunction(ctx, x, y, node, brownout, surge) {
    var a = cx(x), b = cy(y), i;
    var resolved = !brownout && !node.short && node.ins && node.ins.length > 0;

    for (i = 0; i < node.e.length; i++) {
      var edge = node.e[i];
      var col = (brownout || node.short) ? 0 : (node.ports ? node.ports[edge] : node.colour);
      var hex = col ? C.hex(col) : WIRE_OFF;
      var p = edgePoint(x, y, edge);
      ctx.lineCap = 'round';
      ctx.lineWidth = (col ? 6 : 4) * K;
      ctx.strokeStyle = hex;
      if (col) setGlow(ctx, hex, 8 + surge * 14);
      ctx.beginPath();
      ctx.moveTo(a, b);
      ctx.lineTo(p[0], p[1]);
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (resolved && col) arrow(ctx, x, y, edge, node.ins.indexOf(edge) < 0, hex);
    }

    var body = node.short ? '#ff3b30'
      : ((node.colour && !brownout) ? C.hex(node.colour) : '#4a5674');
    ctx.fillStyle = '#0d1220';
    ctx.strokeStyle = body;
    ctx.lineWidth = 2.5;
    roundRect(ctx, a - 9 * K, b - 9 * K, 18 * K, 18 * K, 4 * K);
    ctx.fill();
    ctx.stroke();
    modeMark(ctx, x, y, node);
  }

  // A port facing nothing, so a run that simply stops is visible.
  function openPorts(ctx, board, x, y, node) {
    var ee = edgesOf(node);
    for (var i = 0; i < ee.length; i++) {
      var e = ee[i], nx = x + DX[e], ny = y + DY[e];
      var open;
      if (board.inside(nx, ny)) open = board.nodeOnEdge(nx, ny, OPP[e]) < 0;
      else if (x === 0 && e === 'W') open = !board.sources.some(function (s) { return s.row === y; });
      else if (x === board.w - 1 && e === 'E') open = !board.targets.some(function (t) { return t.row === y; });
      else open = true;
      if (!open) continue;
      var p = edgePoint(x, y, e);
      var a = cx(x), b = cy(y);
      ctx.beginPath();
      ctx.arc(a + (p[0] - a) * 0.78, b + (p[1] - b) * 0.78, 3.2 * K, 0, Math.PI * 2);
      ctx.fillStyle = BG;
      ctx.fill();
      ctx.strokeStyle = '#8a95ad';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  function drawCell(ctx, board, x, y, surge, brownout) {
    var c = board.at(x, y);
    if (!c) return;
    var a = cx(x), b = cy(y);
    if (c.dead) return;   // slabs are drawn as one object, below

    // The jumper draws last so its arch sits above what it crosses.
    var order = c.nodes.map(function (n, i) { return i; }).sort(function (p, q) {
      return (c.nodes[p].jumped ? 1 : 0) - (c.nodes[q].jumped ? 1 : 0);
    });

    for (var k = 0; k < order.length; k++) {
      var n = c.nodes[order[k]];
      var junction = n.e.length >= 3;
      var hex = (brownout || n.short || !n.colour) ? WIRE_OFF : C.hex(n.colour);
      if (junction) drawJunction(ctx, x, y, n, brownout, surge);
      else if (n.jumped) strokeJump(ctx, x, y, n, hex, surge);
      else strokeNode(ctx, x, y, n, hex, surge);
      if (!brownout) flowOverlay(ctx, x, y, n);
      openPorts(ctx, board, x, y, n);
      if (n.short) {
        // Sparking, and about to burn away on the pulse.
        ctx.fillStyle = '#ff3b30';
        ctx.beginPath();
        ctx.arc(a, b, (5 + Math.sin(Date.now() / 60) * 2) * K, 0, Math.PI * 2);
        ctx.fill();
      } else if (!brownout && n.colour && showSymbols && !n.jumped && !junction) {
        var big = false;
        ctx.fillStyle = big ? 'rgba(10,14,24,0.8)' : 'rgba(10,14,24,0.7)';
        ctx.beginPath();
        ctx.arc(a, b, (big ? 7.5 : 6.5) * K, 0, Math.PI * 2);
        ctx.fill();
        C.glyph(ctx, n.colour, a, b, (big ? 5 : 4.4) * K);
      }
    }
  }

  // EVRTEK 2026-09-14: "the red blocks cannot be destroyed, they need to be
  // worked around." They were a muddy maroon that read as dead board rather
  // than as a hazard, and the destructor took them, so the colour did not have
  // to mean anything. Now it does: a slab is RED — the game's own RED, the one
  // the surge toast is printed in and the one the destructor's ghost uses — so
  // "red means you cannot cut this" is one lesson and not three.
  //
  // ONE function for standing, airborne and rising slabs. They were drawn by
  // two pieces of code saying the same thing in different colours until today,
  // which is how the plunging slab and the landed one came to look like
  // different objects.
  var SLAB_FILL = '#3d1218', SLAB_FILL_AIR = '#521a20';
  var SLAB_EDGE = '#ff3b30', SLAB_EDGE_AIR = '#ff7a70';
  var SLAB_HATCH = 'rgba(255,59,48,0.42)';

  function slabBlock(ctx, px, py, pw, ph, alpha, lift) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = lift ? SLAB_FILL_AIR : SLAB_FILL;
    roundRect(ctx, px, py, pw, ph, 5);
    ctx.fill();
    ctx.strokeStyle = lift ? SLAB_EDGE_AIR : SLAB_EDGE;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    roundRect(ctx, px, py, pw, ph, 5);
    ctx.clip();
    ctx.strokeStyle = SLAB_HATCH;
    ctx.lineWidth = 2;
    for (var d = -ph; d < pw; d += 12) {
      ctx.beginPath();
      ctx.moveTo(px + d, py + ph);
      ctx.lineTo(px + d + ph, py);
      ctx.stroke();
    }
    ctx.restore();
  }

  // TRON 2026-09-14 patrol, M3: WHERE A SLAB IS ALLOWED TO BE PAINTED.
  //
  // A slab appears above the square it is going to land on and plunges — up to
  // 66 * K above it, which for a slab bound for row 0 or row 1 is above the top
  // of the grid entirely. Tron measured it: on portrait such a slab is drawn
  // from y 78 to y 133 against a preview row that occupies y 64..124, so 46 of
  // that row's 60 pixels are covered for the 1.1s of the plunge, and NOW /
  // NEXT / JUNCTIONS are unreadable underneath it. On desktop the same slab
  // reaches y 12..80 against a grid top of 78 and crosses the version stamp and
  // the HUD's bottom row. Row 0 is the most common landing row of the
  // seventeen: 16.7% of launched slabs are bound for row 0 or 1.
  //
  // So the flight is clipped to the GRID and four pixels — which is not an
  // arbitrary margin but the board's OWN FRAME, the rect drawGrid outlines and
  // vignette shades (GRID_X - 4, GRID_Y - 4). A slab in flight is scaled to
  // 1.14 while it hangs above its square, so it can overhang its own box by
  // about four pixels, and the frame is exactly the room that needs.
  //
  // It is also all the room there is. On portrait the preview row ends at y 124
  // and the grid starts at 132; on desktop the TIME and SURGE labels over the
  // clock bars sit at y 66 and the grid starts at 78. A slab bound for the top
  // rows now fades in INSIDE the frame and slides down out of its top edge —
  // the same animation, seen through the window it belongs in. Every other row
  // is untouched: nothing else ever reached the margin.
  var SLAB_MARGIN = 4;

  function slabClip(ctx, board) {
    ctx.beginPath();
    ctx.rect(GRID_X - SLAB_MARGIN, GRID_Y - SLAB_MARGIN,
      board.w * CELL + SLAB_MARGIN * 2, board.h * CELL + SLAB_MARGIN * 2);
    ctx.clip();
  }

  // EVRTEK 2026-09-07: "can they fade into view above the board and then
  // plunge into place with a cool animation?" A slab fades in hovering above
  // its square, its target outlined and blinking underneath, then drops with
  // a cubic ease and hits with a flash. The board changes only on impact —
  // the game handles that — so what you see is the warning.
  function drawIncoming(ctx, g) {
    if (!g.incoming || !g.incoming.length) return;
    for (var i = 0; i < g.incoming.length; i++) {
      var inc = g.incoming[i];
      var flight = inc.max - inc.delay;
      if (inc.t > flight) continue;                    // its turn has not come
      var tp = 1 - inc.t / flight;                     // 0..1 through the drop
      var px = GRID_X + inc.x * CELL + 2, py = GRID_Y + inc.y * CELL + 2;
      var pw = inc.size * CELL - 4, ph = inc.size * CELL - 4;

      // the target, blinking faster as it gets close
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(tp * tp * 28));
      ctx.strokeStyle = '#ff3b30';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(px, py, pw, ph);
      ctx.setLineDash([]);
      ctx.restore();

      var alpha, lift, scale;
      if (tp < 0.5) {
        var h = tp / 0.5;                                // fading in, hanging
        alpha = h; lift = (-66 + h * 8) * K; scale = 1.14;
      } else {
        var q = (tp - 0.5) / 0.5;                        // the plunge
        alpha = 1; lift = -58 * K * (1 - q * q * q); scale = 1.14 - 0.14 * q;
      }
      // its shadow on the board grows as it comes down
      ctx.save();
      ctx.globalAlpha = 0.18 + 0.32 * tp;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(px + pw / 2, py + ph / 2 + 2, pw * (0.25 + 0.3 * tp), ph * (0.16 + 0.22 * tp), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      var sw2 = pw * scale, sh2 = ph * scale;
      slabBlock(ctx, px + (pw - sw2) / 2, py + (ph - sh2) / 2 + lift, sw2, sh2, alpha, true);
    }
  }

  // Blockers are 2x2 slabs (Evrtek 09-07, down from 4x4) and get drawn as one
  // object, with hatching, so each reads as a lump of dead board rather than
  // four separate squares.
  function drawBlockers(ctx, board) {
    var seen = {}, x, y;
    for (y = 0; y < board.h; y++) {
      for (x = 0; x < board.w; x++) {
        var c = board.at(x, y);
        if (!c || !c.dead || seen[c.origin]) continue;
        seen[c.origin] = true;
        var x1 = x, y1 = y, x2 = x, y2 = y, i, j;
        for (j = 0; j < board.h; j++) {
          for (i = 0; i < board.w; i++) {
            var cc = board.at(i, j);
            if (cc && cc.dead && cc.origin === c.origin) {
              if (i < x1) x1 = i; if (i > x2) x2 = i;
              if (j < y1) y1 = j; if (j > y2) y2 = j;
            }
          }
        }
        var px = GRID_X + x1 * CELL + 2, py = GRID_Y + y1 * CELL + 2;
        var pw = (x2 - x1 + 1) * CELL - 4, ph = (y2 - y1 + 1) * CELL - 4;
        // The same block the airborne ones are drawn with, so a slab looks the
        // same standing as it did coming down (and going back up).
        slabBlock(ctx, px, py, pw, ph, 1, false);
      }
    }
  }

  // EVRTEK 2026-09-14: "the red blocks will move around when the trigger occurs
  // instead of ever adding new ones, OLD ONES WILL RISE FROM THE BOARD and new
  // ones will fall." So this is drawIncoming run backwards, off the same kind
  // of record: the board cells were freed at the instant of the lift — the
  // player can already build through them — and what is drawn here is the slab
  // leaving, so the square opening up is something you watched happen rather
  // than something you noticed later.
  function drawRising(ctx, g) {
    if (!g.rising || !g.rising.length) return;
    for (var i = 0; i < g.rising.length; i++) {
      var r = g.rising[i];
      var tp = 1 - r.t / r.max;                       // 0..1 on the way up
      var px = GRID_X + r.x * CELL + 2, py = GRID_Y + r.y * CELL + 2;
      var pw = r.size * CELL - 4, ph = r.size * CELL - 4;

      // Accelerating away and fading with it, which is the exact reverse of the
      // plunge's cubic ease-in.
      var lift = -70 * K * tp * tp;
      var scale = 1 + 0.16 * tp;
      var alpha = Math.max(0, 1 - tp * tp);

      // the shadow it was casting, shrinking as it goes
      ctx.save();
      ctx.globalAlpha = 0.30 * (1 - tp);
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(px + pw / 2, py + ph / 2 + 2, pw * (0.5 - 0.25 * tp), ph * (0.36 - 0.2 * tp), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      var sw = pw * scale, sh = ph * scale;
      slabBlock(ctx, px + (pw - sw) / 2, py + (ph - sh) / 2 + lift, sw, sh, alpha, true);
    }
  }

  // EVRTEK 2026-09-07: TWO bars, one either side of the play space.
  //
  // LEFT is the main clock: green, yellow a third of the way down, red at a
  // quarter, pulsing under an eighth, and jumping back up every time a line
  // lands. RIGHT is the SURGE clock, half as long, which never stops and never
  // gets a reprieve; when it empties the rig interrupts you.
  //
  // The thresholds are FRACTIONS of each maximum rather than fixed seconds, so
  // both bars read identically at every difficulty even though CALM's clock is
  // more than twice as long as SHARP's.
  // The bar is exactly as tall as the play space, so its height is the RULES'
  // grid height and not a number written down here. It was 20 * CELL until the
  // board came down to seventeen rows (EVRTEK 2026-09-14) and the bars would
  // have run three cells past the bottom of the grid they belong to.
  function drawBar(ctx, x, w, frac, hex, alpha, marks) {
    var top = GRID_Y, h = CW_GAME.GRID_H * CELL;
    ctx.fillStyle = '#111726';
    roundRect(ctx, x, top, w, h, 5);
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.stroke();

    var fh = Math.max(2, h * Math.max(0, Math.min(1, frac)));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = hex;
    roundRect(ctx, x + 2, top + h - fh + 2, w - 4, fh - 4, 4);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Where the colour changes, so the thresholds are visible before they bite.
    ctx.strokeStyle = 'rgba(201,214,240,0.35)';
    ctx.lineWidth = 1;
    for (var m = 0; m < marks.length; m++) {
      var my = top + h - h * marks[m];
      ctx.beginPath();
      ctx.moveTo(x, my);
      ctx.lineTo(x + w, my);
      ctx.stroke();
    }
  }

  function blink(period) { return 0.45 + 0.55 * Math.abs(Math.sin(Date.now() / period)); }

  function drawBars(ctx, g) {
    // EVRTEK 2026-09-14, CALM: "no pressure, no timed disaster bar that drops
    // blocks. no timer at all." An empty bar is still a bar, and a bar that
    // never moves is a promise the game will do something eventually. So on the
    // sandbox there is no bar at all, either side, and the HUD says why.
    if (g.untimed()) return;
    var bot = GRID_Y + CW_GAME.GRID_H * CELL + 12;

    // On a phone the bars are 10px strips wedged against the canvas edges and
    // there is no room to write anything around them, so the labels and the
    // digits are skipped: both clocks are numbers in the HUD strip instead.
    var max = g.timeMax(), t = g.timeT, f = t / max;
    var hex = f > 0.375 ? '#3ede72' : (f > 0.25 ? '#ffd60a' : '#ff3b30');
    if (!MOBILE) text(ctx, 'TIME', BAR_X + BAR_W / 2, GRID_Y - 12, MONO_S, INK_DIM, 'center');
    drawBar(ctx, BAR_X, BAR_W, f, hex, f <= 0.125 ? blink(130) : 1, [0.375, 0.25, 0.125]);
    if (!MOBILE) text(ctx, clock(t), BAR_X + BAR_W / 2, bot, MONO_S, hex, 'center');

    var smax = g.surgeMax(), sf = g.surgeT / smax;
    var shex = sf > 0.25 ? '#ff8c1a' : '#ff3b30';
    if (!MOBILE) text(ctx, 'SURGE', BAR2_X + BAR2_W / 2, GRID_Y - 12, MONO_S, INK_DIM, 'center');
    drawBar(ctx, BAR2_X, BAR2_W, sf, shex, sf <= 0.12 ? blink(110) : 1, [0.25]);
    if (!MOBILE) text(ctx, clock(g.surgeT), BAR2_X + BAR2_W / 2, bot, MONO_S, shex, 'center');
  }

  function drawGrid(ctx, g) {
    var board = g.board, x, y;
    ctx.fillStyle = PANEL;
    roundRect(ctx, GRID_X - 4, GRID_Y - 4, board.w * CELL + 8, board.h * CELL + 8, 6);
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    for (x = 0; x <= board.w; x++) {
      ctx.beginPath();
      ctx.moveTo(GRID_X + x * CELL, GRID_Y);
      ctx.lineTo(GRID_X + x * CELL, GRID_Y + board.h * CELL);
      ctx.stroke();
    }
    for (y = 0; y <= board.h; y++) {
      ctx.beginPath();
      ctx.moveTo(GRID_X, GRID_Y + y * CELL);
      ctx.lineTo(GRID_X + board.w * CELL, GRID_Y + y * CELL);
      ctx.stroke();
    }
    // The first and last columns never take a blocker, so they are tinted.
    ctx.fillStyle = 'rgba(47,227,227,0.035)';
    ctx.fillRect(GRID_X, GRID_Y, CELL, board.h * CELL);
    ctx.fillRect(GRID_X + (board.w - 1) * CELL, GRID_Y, CELL, board.h * CELL);

    drawBlockers(ctx, board);
    var brownout = g.bugActive && g.bugActive('BROWNOUT');
    for (y = 0; y < board.h; y++) {
      for (x = 0; x < board.w; x++) drawCell(ctx, board, x, y, g.surge, brownout);
    }
  }

  function plug(ctx, x, y, w, h, colour, facingRight, outline) {
    ctx.fillStyle = '#161d2e';
    ctx.strokeStyle = outline || C.hex(colour);
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.hex(colour);
    ctx.fillRect(facingRight ? x + w : x - 6, y + h / 2 - 3, 6, 6);
  }

  // EVRTEK 2026-09-07: "the mouth of each source could be sort of sparking."
  // Three short jittering strokes and a white core, new every frame, thrown
  // out of the mouth toward the board. Cheap, and it makes the left edge
  // read as live power rather than a row of labels.
  function sparks(ctx, mx, my, colour) {
    var hex = C.hex(colour), i, n = LITE ? 2 : 3;
    ctx.save();
    ctx.lineCap = 'round';
    for (i = 0; i < n; i++) {
      var ang = (Math.random() - 0.5) * 1.6;
      var len = 3 + Math.random() * 7;
      var ex = mx + Math.cos(ang) * len, ey = my + Math.sin(ang) * len;
      ctx.globalAlpha = 0.35 + Math.random() * 0.6;
      ctx.strokeStyle = Math.random() < 0.3 ? '#ffffff' : hex;
      ctx.lineWidth = 1 + Math.random() * 1.2;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(ex, ey);
      if (Math.random() < 0.5) ctx.lineTo(ex + (Math.random() - 0.5) * 5, ey + (Math.random() - 0.5) * 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.7 + Math.random() * 0.3;
    ctx.fillStyle = '#ffffff';
    setGlow(ctx, hex, 10);
    ctx.beginPath();
    ctx.arc(mx, my, 1.6 + Math.random(), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSources(ctx, g) {
    // No label on a phone: the column is 36px wide and the word does not fit
    // above it. The sparking mouths say what it is.
    if (!MOBILE) text(ctx, 'SOURCES', SRC_X + 18, GRID_Y - 16, MONO_S, INK_DIM, 'center');
    for (var i = 0; i < g.board.sources.length; i++) {
      var s = g.board.sources[i];
      var y = GRID_Y + s.row * CELL;
      plug(ctx, SRC_X, y + 3, SRC_W - 8, CELL - 6, s.colour, true);
      C.glyph(ctx, s.colour, SRC_X + (SRC_W - 8) / 2, y + CELL / 2, 7 * K);
      sparks(ctx, SRC_X + SRC_W - 2, y + CELL / 2, s.colour);
    }
  }

  var STATUS_INK = { LIT: '#3ede72', WRONG: '#ffb020', SHORT: '#ff3b30',
                     DARK: '#6d7c9c', OPEN: '#6d7c9c' };

  // EVRTEK 2026-09-07: a demand is a LIGHT BULB. The ring is the colour it
  // wants. The shapes inside are the primaries that make that colour: a red
  // triangle beside a yellow square says ORANGE more directly than the word
  // ORANGE does, and it says it to a colourblind player as well, which is the
  // whole reason the shapes exist. So the words come out of the bulb entirely.
  function drawBulb(ctx, colour, bx, by, lit) {
    var hex = C.hex(colour), i;

    // the screw base, facing the wire, so it reads as a bulb and not a button
    ctx.fillStyle = '#2a3247';
    roundRect(ctx, bx - BULB_R - 9, by - 6, 11, 12, 2);
    ctx.fill();
    ctx.strokeStyle = '#3c4763';
    ctx.lineWidth = 1;
    for (i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(bx - BULB_R - 9, by - 3 + i * 3);
      ctx.lineTo(bx - BULB_R + 2, by - 3 + i * 3);
      ctx.stroke();
    }

    if (lit) {
      ctx.globalAlpha = 0.30 + 0.16 * Math.sin(Date.now() / 180);
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.arc(bx, by, BULB_R + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.arc(bx, by, BULB_R, 0, Math.PI * 2);
    ctx.fillStyle = lit ? '#18213a' : '#0e1424';
    ctx.fill();
    if (lit) setGlow(ctx, hex, 14);
    ctx.strokeStyle = hex;
    ctx.lineWidth = lit ? 4 : 3;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // the recipe, centred: one shape for a primary, two for a blend
    var n = C.depth(colour), r = 4.8 * K, gap = 3.0 * K;
    var wide = n * r * 2 + (n - 1) * gap;
    C.recipeGlyphs(ctx, colour, bx - wide / 2, by, r, gap);
  }

  function drawTargets(ctx, g) {
    // EVRTEK 2026-09-07, portrait: there is no room beside a 400px canvas for
    // a WHY NOT column, so the reason goes VISUAL. A wrong colour arriving is
    // drawn as that colour's own glyph; a short run is a red dot. LIT, DARK
    // and OPEN say nothing extra, because the bulb and the lead already do.
    if (!MOBILE) {
      text(ctx, 'DEMAND', BULB_CX, GRID_Y - 16, MONO_S, INK_DIM, 'center');
      text(ctx, 'WHY NOT', STAT_X, GRID_Y - 16, MONO_S, INK_DIM);
    }
    for (var i = 0; i < g.board.targets.length; i++) {
      var t = g.board.targets[i];
      var y = GRID_Y + t.row * CELL + CELL / 2;
      var st = g.demandStatus(t);
      var lit = st.state === 'LIT';

      ctx.strokeStyle = lit ? C.hex(t.colour) : LINE;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(GRID_X + g.board.w * CELL, y);
      ctx.lineTo(BULB_CX - BULB_R - 9, y);
      ctx.stroke();

      drawBulb(ctx, t.colour, BULB_CX, y, lit);
      // EVRTEK 2026-09-14, EXTREME: "have the targets randomly reassign on the
      // blocker drop countdown trigger." A demand whose colour changed under
      // the player has to SAY SO, or the run they had planned simply stops
      // working for no visible reason. The rules mark it (`shuffled`, decaying
      // over CW_GAME.SHUFFLE_FLASH) and the bulb spins a dashed ring while the
      // mark lasts — a rotation rather than a blink, because half the bulbs on
      // the board are already blinking for other reasons.
      if (t.shuffled > 0) {
        var k = Math.max(0, Math.min(1, t.shuffled / CW_GAME.SHUFFLE_FLASH));
        ctx.save();
        ctx.globalAlpha = k;
        ctx.translate(BULB_CX, y);
        ctx.rotate((1 - k) * 9);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, BULB_R + 5 + (1 - k) * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      if (!MOBILE) {
        text(ctx, st.label, STAT_X, y, MONO_S, STATUS_INK[st.state] || INK_DIM);
      } else if (st.state === 'WRONG' && st.colour) {
        C.glyph(ctx, st.colour, STAT_X + 10, y, 5);
      } else if (st.state === 'SHORT') {
        ctx.fillStyle = '#ff3b30';
        ctx.beginPath();
        ctx.arc(STAT_X + 10, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawGhost(ctx, g) {
    if (!g.started || g.over) return;

    if (g.snipMode) {
      // EVRTEK 2026-09-07: the destructor is a CROSS, and the whole cross is
      // drawn even where an arm hangs off the board, because a tip doing
      // nothing is information: it is how you cut three cells against an edge.
      var ready = g.cutCd <= 0;
      var col = ready ? '#ff3b30' : '#6d7c9c';
      var foot = g.destroyFootprint();
      var doomed = g.destroyPreview();
      var hit = {}, arms = {}, d;
      for (d = 0; d < doomed.length; d++) hit[doomed[d][0] + ',' + doomed[d][1]] = true;
      for (d = 0; d < foot.length; d++) arms[foot[d][0] + ',' + foot[d][1]] = true;

      // EVRTEK 2026-09-08: "increase the brightness of the destructor ghost so
      // it's more noticeable." Over empty board the cross used to be five
      // squares of 7% grey, which on a phone in daylight is no cross at all.
      // Now every arm carries the destructor's red the moment it is armed, a
      // halo breathes around the silhouette of the whole cross, and the
      // squares it would actually take are filled solid enough to read from
      // arm's length. Cooling keeps the grey, so the colour alone still says
      // whether a cut would land.
      var breath = 0.6 + 0.4 * Math.abs(Math.sin(Date.now() / 260));
      ctx.strokeStyle = ready ? 'rgba(255,59,48,' + (0.30 * breath).toFixed(3) + ')'
                              : 'rgba(109,124,156,' + (0.24 * breath).toFixed(3) + ')';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (d = 0; d < foot.length; d++) {
        // Only the edges with no arm beyond them, so the halo wraps the cross
        // as one shape instead of gridding its insides.
        var ex = foot[d][0], ey = foot[d][1];
        var l = cx(ex) - CELL / 2, t = cy(ey) - CELL / 2, r = l + CELL, b = t + CELL;
        if (!arms[ex + ',' + (ey - 1)]) { ctx.moveTo(l, t); ctx.lineTo(r, t); }
        if (!arms[ex + ',' + (ey + 1)]) { ctx.moveTo(l, b); ctx.lineTo(r, b); }
        if (!arms[(ex - 1) + ',' + ey]) { ctx.moveTo(l, t); ctx.lineTo(l, b); }
        if (!arms[(ex + 1) + ',' + ey]) { ctx.moveTo(r, t); ctx.lineTo(r, b); }
      }
      ctx.stroke();
      ctx.lineCap = 'butt';

      for (d = 0; d < foot.length; d++) {
        var fx = cx(foot[d][0]), fy = cy(foot[d][1]);
        var takes = hit[foot[d][0] + ',' + foot[d][1]];
        ctx.fillStyle = !takes
          ? (ready ? 'rgba(255,59,48,0.18)' : 'rgba(109,124,156,0.18)')
          : (ready ? 'rgba(255,59,48,0.46)' : 'rgba(109,124,156,0.30)');
        roundRect(ctx, fx - CELL / 2 + 2, fy - CELL / 2 + 2, CELL - 4, CELL - 4, 4);
        ctx.fill();
        ctx.strokeStyle = takes ? col
          : (ready ? 'rgba(255,122,112,0.85)' : 'rgba(150,166,200,0.8)');
        ctx.lineWidth = takes ? 2.5 : 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(fx - CELL / 2 + 1, fy - CELL / 2 + 1, CELL - 2, CELL - 2);
        ctx.setLineDash([]);
      }

      // The X at the centre: the destructor's colour with a hot core, so the
      // one square a tap or SPACE cuts from is never in doubt.
      var sx = cx(g.cursor.x), sy = cy(g.cursor.y), arm = Math.round(CELL * 0.3);
      ctx.lineCap = 'round';
      ctx.strokeStyle = col;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx - arm, sy - arm); ctx.lineTo(sx + arm, sy + arm);
      ctx.moveTo(sx + arm, sy - arm); ctx.lineTo(sx - arm, sy + arm);
      ctx.stroke();
      ctx.strokeStyle = ready ? 'rgba(255,241,238,0.95)' : 'rgba(226,233,247,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx - arm, sy - arm); ctx.lineTo(sx + arm, sy + arm);
      ctx.moveTo(sx + arm, sy - arm); ctx.lineTo(sx - arm, sy + arm);
      ctx.stroke();
      ctx.lineCap = 'butt';

      // These headers sit in the gutter above the grid, which portrait spends
      // on the piece row instead. The hint line under the buttons carries the
      // same information there.
      if (!MOBILE) {
        text(ctx, ready ? 'CUT' : 'COOLING', GRID_X, GRID_Y - 16, MONO_S, col);
        text(ctx, doomed.length
          ? 'SPACE CUTS ' + doomed.length + '  ·  B OUT'
          : 'NOTHING HERE  ·  B OUT',
          GRID_X + 96, GRID_Y - 16, MONO_S, INK_DIM);
      }
      return;
    }

    // EVRTEK 2026-09-07: no mode to enter. Hover an existing junction with the
    // piece you are holding and commit tunes it instead of placing, so the
    // ghost has to say that plainly BEFORE the press.
    var hov = g.hoverJunction();
    if (hov) {
      var hx = cx(g.cursor.x), hy = cy(g.cursor.y);
      var to = CW_POWER.mode(hov) === 'M' ? 'S' : 'M';
      var pulse = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 240));

      ctx.globalAlpha = 0.45;
      drawGhostPiece(ctx, g, true);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = 'rgba(255,214,10,' + (0.45 + pulse * 0.45).toFixed(2) + ')';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(hx, hy, CELL * 0.62 + pulse * 2, 0, Math.PI * 2);
      ctx.stroke();

      // the letter it would become, floating above the one it is
      ctx.fillStyle = '#0d1220';
      ctx.strokeStyle = '#ffd60a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hx + CELL * 0.62, hy - CELL * 0.62, 9 * K, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      text(ctx, to, hx + CELL * 0.62, hy - CELL * 0.62 + 0.5 * K,
        '700 ' + (12 * K).toFixed(1) + 'px Consolas, "Courier New", monospace',
        '#ffd60a', 'center');

      if (!MOBILE) {
        text(ctx, 'TUNE', GRID_X, GRID_Y - 16, MONO_S, '#ffd60a');
        text(ctx, 'SPACE MAKES IT ' + (to === 'M' ? 'A MIXER' : 'A SPLITTER'),
          GRID_X + 46, GRID_Y - 16, MONO_S, INK_DIM);
      }
      return;
    }

    drawGhostPiece(ctx, g, false);
  }

  function drawGhostPiece(ctx, g, dim) {
    var shape = g.feed.shape();
    var piece = g.feed.piece();
    var o = g.origin();
    var ok = g.board.canPlace(piece, g.feed.rot, o.x, o.y);
    if (dim) ok = false;
    for (var i = 0; i < shape.cells.length; i++) {
      var handle = (i === piece.target);
      var x = o.x + shape.cells[i][0], y = o.y + shape.cells[i][1];
      // The cursor roams the whole board now, so part of a wide piece can hang
      // off the edge. Those cells are not drawn — painting them would put a
      // ghost on top of the demand column.
      if (!g.board.inside(x, y)) continue;
      var ax = cx(x), ay = cy(y);
      var over = ok && piece.jumps && g.board.at(x, y);
      // The HANDLE is drawn brighter than the rest of the piece: it is the
      // square the cursor is actually on, and therefore the one that decides
      // whether commit places or tunes.
      ctx.fillStyle = !ok ? (handle ? 'rgba(255,59,48,0.34)' : 'rgba(255,59,48,0.18)')
        : (over ? 'rgba(255,214,10,0.18)'
                : (handle ? 'rgba(126,247,247,0.30)' : 'rgba(47,227,227,0.14)'));
      roundRect(ctx, ax - CELL / 2 + 2, ay - CELL / 2 + 2, CELL - 4, CELL - 4, 4);
      ctx.fill();
      ctx.strokeStyle = !ok ? '#ff3b30' : (over ? '#ffd60a' : ACCENT);
      ctx.lineWidth = handle ? 2.5 : 1.5;
      ctx.stroke();
      var nodes = shape.wire[i];
      for (var n = 0; n < nodes.length; n++) {
        ctx.lineWidth = 4 * K;
        var ghostInk = ok ? 'rgba(201,214,240,0.85)' : 'rgba(255,138,128,0.85)';
        ctx.strokeStyle = ghostInk;
        var ge = edgesOf(nodes[n]);
        for (var e = 0; e < ge.length; e++) {
          var p = edgePoint(x, y, ge[e]);
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(p[0], p[1]);
          ctx.stroke();
        }
        // A junction shows as a body with no arrows: it has not resolved a
        // direction yet, and it will not until it is connected to something.
        if (nodes[n].e.length >= 3) {
          ctx.fillStyle = 'rgba(13,18,32,0.9)';
          ctx.strokeStyle = ok ? '#ffd60a' : '#ff8a80';
          ctx.lineWidth = 2;
          roundRect(ctx, ax - 8 * K, ay - 8 * K, 16 * K, 16 * K, 3 * K);
          ctx.fill(); ctx.stroke();
        }
      }
    }
    if (piece.jumps && !MOBILE) {
      text(ctx, 'SPAN JUMPS OVER WIRE', GRID_X, GRID_Y - 16, MONO_S, '#ffd60a');
    }
  }

  function drawFlashes(ctx, g) {
    for (var i = 0; i < g.flashes.length; i++) {
      var f = g.flashes[i];
      ctx.globalAlpha = Math.max(0, f.t / 0.6);
      ctx.fillStyle = f.colour ? C.hex(f.colour) : '#ff3b30';
      roundRect(ctx, cx(f.x) - CELL / 2 + 2, cy(f.y) - CELL / 2 + 2, CELL - 4, CELL - 4, 4);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawPops(ctx, g) {
    for (var i = 0; i < g.pops.length; i++) {
      var p = g.pops[i];
      if (p.delay > 0) continue;
      var k = 1 - Math.max(0, p.t / p.max);
      var a = cx(p.x), b = cy(p.y);
      var hex = C.hex(p.colour);
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.fillStyle = hex;
      var s = (CELL - 6) * (1 - k * 0.55);
      roundRect(ctx, a - s / 2, b - s / 2, s, s, 4);
      ctx.fill();
      ctx.globalAlpha = (1 - k) * 0.85;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5 * (1 - k);
      ctx.beginPath();
      ctx.arc(a, b, 4 + k * 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawFlares(ctx, g) {
    for (var i = 0; i < g.flares.length; i++) {
      var f = g.flares[i];
      var k = 1 - Math.max(0, f.t / f.max);
      var px = BULB_CX, py = GRID_Y + f.row * CELL + CELL / 2;
      var hex = C.hex(f.colour);
      for (var r = 0; r < 3; r++) {
        var kk = Math.max(0, Math.min(1, k * 1.8 - r * 0.18));
        if (kk <= 0 || kk >= 1) continue;
        ctx.globalAlpha = (1 - kk) * 0.7;
        ctx.strokeStyle = r === 0 ? '#ffffff' : hex;
        ctx.lineWidth = 3 * (1 - kk);
        ctx.beginPath();
        ctx.ellipse(px, py, (30 + kk * 90) * K, (14 + kk * 42) * K, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = Math.max(0, 1 - k * 1.4);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, BULB_R + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = Math.max(0, 1 - k);
      text(ctx, '+' + f.score, px, py - 6 - k * 34, MONO_L, hex, 'center');
      ctx.globalAlpha = 1;
    }
  }

  // EVRTEK 2026-09-07: a blinking callout when a line lands. CROSSWIRE, DOUBLE
  // CROSSWIRE, MEGA CROSSWIRE, on an angle, in the spirit of an arcade
  // announcer. The voice that goes with it is stubbed in CW_VOICE.
  var CALLOUT_INK = { 1: '#2fe3e3', 2: '#ffd60a', 3: '#ff3b30' };

  function drawCallout(ctx, g) {
    if (!g.callout) return;
    var c = g.callout;
    var k = 1 - Math.max(0, c.t / c.max);
    var blink = Math.sin(k * Math.PI * 14) > -0.35;
    if (!blink && k < 0.75) return;

    var pop = k < 0.16 ? k / 0.16 : 1;
    var scale = 0.7 + pop * 0.45 - Math.max(0, k - 0.7) * 0.3;
    var ink = CALLOUT_INK[c.tier] || ACCENT;
    var px = GRID_X + 5 * CELL, py = GRID_Y + 6.5 * CELL;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.13);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.75) * 4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Scaled down with the cell, but only by nine tenths of the way: a callout
    // that shrinks all the way to K stops shouting, and shouting is its job.
    // Scaled DOWN on the phone: at K*1.1 a MEGA CROSSWIRE was 335px across a
    // 260px board and hid the sources and bulbs for two seconds (Tron).
    var cs = MOBILE ? K * 0.82 : 1;
    var size = (c.tier >= 3 ? 40 : (c.tier === 2 ? 34 : 30)) * cs;
    ctx.font = '700 ' + size.toFixed(1) + 'px Consolas, "Courier New", monospace';
    ctx.lineWidth = 7 * cs;
    ctx.strokeStyle = '#06090f';
    ctx.strokeText(c.text, 0, 0);
    setGlow(ctx, ink, 22);
    ctx.fillStyle = ink;
    ctx.fillText(c.text, 0, 0);
    ctx.shadowBlur = 0;

    // EVRTEK 2026-09-07: DOUBLE SOURCE / MEGA SOURCE, said underneath. It is
    // still one crosswire, so it sits below the call rather than replacing it.
    if (c.sub) {
      ctx.font = '700 ' + (20 * cs).toFixed(1) + 'px Consolas, "Courier New", monospace';
      ctx.lineWidth = 6 * cs;
      ctx.strokeStyle = '#06090f';
      ctx.strokeText(c.sub, 0, size * 0.9);
      setGlow(ctx, '#ffd60a', 16);
      ctx.fillStyle = '#ffd60a';
      ctx.fillText(c.sub, 0, size * 0.9);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawBanner(ctx, g) {
    if (!g.banner) return;
    var k = 1 - Math.max(0, g.banner.t / 2.6);
    var y = GRID_Y + 190 - k * 26;
    ctx.globalAlpha = Math.max(0, Math.min(1, (1 - k) * 2.4));
    ctx.fillStyle = 'rgba(8,12,20,0.85)';
    roundRect(ctx, GRID_X - 4, y - 34, 10 * CELL + 8, 68, 6);
    ctx.fill();
    ctx.strokeStyle = '#ffd60a';
    ctx.lineWidth = 2;
    ctx.stroke();
    // KEYSTONE at 32px is wider than a 260px portrait grid, so it drops a size.
    text(ctx, g.banner.text, GRID_X + 5 * CELL, y - 10,
      MOBILE ? '700 26px Consolas, "Courier New", monospace' : TITLE, '#ffd60a', 'center');
    text(ctx, g.banner.sub, GRID_X + 5 * CELL, y + 18, MONO, INK, 'center');
    ctx.globalAlpha = 1;
  }

  // Kept short: this line also renders in the NEXT slots, where it has about
  // eighteen characters before the panel edge clips it.
  var TAGS = {
    VALVE: 'JUNCTION  ·  S / M', TEE: 'JUNCTION  ·  S / M',
    YOKE: 'JUNCTION  ·  S / M', JUNCTION: 'FOUR WAYS  ·  S / M',
    SPAN: 'JUMPS OVER WIRE'
  };

  function drawMini(ctx, piece, rot, bx, by, bw, bh, size, colour) {
    var shape = piece.rotations[rot % piece.rotations.length];
    var ox = bx + (bw - shape.w * size) / 2;
    var oy = by + (bh - shape.h * size) / 2;
    // The handle, marked here as well as on the board, so the square is
    // learned from the panel rather than discovered by moving.
    if (shape.cells[piece.target]) {
      var hc = shape.cells[piece.target];
      ctx.fillStyle = 'rgba(126,247,247,0.16)';
      roundRect(ctx, ox + hc[0] * size + 1, oy + hc[1] * size + 1, size - 2, size - 2, 2);
      ctx.fill();
    }
    for (var i = 0; i < shape.cells.length; i++) {
      var gx = ox + shape.cells[i][0] * size;
      var gy = oy + shape.cells[i][1] * size;
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.strokeRect(gx, gy, size, size);
      var a = gx + size / 2, b = gy + size / 2, h = size / 2;
      var nodes = shape.wire[i];
      for (var n = 0; n < nodes.length; n++) {
        var node = nodes[n];
        ctx.strokeStyle = colour;
        ctx.lineWidth = Math.max(2, size * 0.16);
        ctx.lineCap = 'round';
        var me = edgesOf(node);
        for (var e = 0; e < me.length; e++) {
          var d = me[e];
          var px = a + (d === 'E' ? h : d === 'W' ? -h : 0);
          var py = b + (d === 'S' ? h : d === 'N' ? -h : 0);
          ctx.beginPath();
          ctx.moveTo(a, b);
          ctx.lineTo(px, py);
          ctx.stroke();
        }
        if (node.e.length >= 3) {
          ctx.fillStyle = '#0d1220';
          ctx.strokeStyle = colour;
          ctx.lineWidth = 2;
          roundRect(ctx, a - size * 0.22, b - size * 0.22, size * 0.44, size * 0.44, 2);
          ctx.fill(); ctx.stroke();
        }
      }
    }
  }

  function drawFeed(ctx, g) {
    var p = g.feed.piece();
    text(ctx, 'NOW', PIECE_X, 100, MONO_S, INK_DIM);
    ctx.fillStyle = '#16213a';
    roundRect(ctx, PIECE_X, 110, PIECE_W, 132, 6); ctx.fill();
    ctx.strokeStyle = p.jumps ? '#ffd60a' : ACCENT; ctx.lineWidth = 2; ctx.stroke();
    drawMini(ctx, p, g.feed.rot, PIECE_X, 116, PIECE_W, 86, 24, p.jumps ? '#ffd60a' : ACCENT);
    text(ctx, p.name, PIECE_X + PIECE_W / 2, 216, MONO_L, INK, 'center');
    text(ctx, p.size + (p.size === 1 ? ' CELL' : ' CELLS') +
      (TAGS[p.id] ? '  ·  ' + TAGS[p.id] : ''),
      PIECE_X + PIECE_W / 2, 232, MONO_S, TAGS[p.id] ? '#ffd60a' : INK_DIM, 'center');

    var blind = g.bugActive && g.bugActive('BLIND');
    text(ctx, blind ? 'NEXT  ·  BLIND' : 'NEXT', PIECE_X, 264, MONO_S, blind ? '#ff3b30' : INK_DIM);
    var nx = g.feed.nexts();
    for (var i = 0; i < nx.length; i++) {
      var y = 274 + i * 62;
      ctx.fillStyle = PANEL;
      roundRect(ctx, PIECE_X, y, PIECE_W, 56, 5); ctx.fill();
      ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.stroke();
      if (blind) { text(ctx, '?', PIECE_X + 40, y + 28, TITLE, '#3a4358', 'center'); continue; }
      drawMini(ctx, nx[i], 0, PIECE_X + 6, y + 4, 76, 48, 13, '#7d8cad');
      text(ctx, nx[i].name, PIECE_X + 92, y + 22, MONO, INK_DIM);
      if (TAGS[nx[i].id]) text(ctx, TAGS[nx[i].id], PIECE_X + 92, y + 40, MONO_S, '#8a7a30');
    }

    var dy = 470;
    text(ctx, 'DESTRUCTOR', PIECE_X, dy, MONO_S, INK_DIM);
    var ready = g.cutCd <= 0;
    ctx.fillStyle = '#1b2233';
    roundRect(ctx, PIECE_X, dy + 10, PIECE_W, 14, 3); ctx.fill();
    ctx.fillStyle = ready ? '#3ede72' : '#ff8c1a';
    roundRect(ctx, PIECE_X, dy + 10, Math.max(3, PIECE_W * (ready ? 1 : 1 - g.cutCd / g.cutCdMax)), 14, 3);
    ctx.fill();
    text(ctx, ready ? 'READY  ·  B' : g.cutCd.toFixed(1) + 's',
      PIECE_X + PIECE_W, dy, MONO_S, ready ? '#3ede72' : '#ff8c1a', 'right');

    // EVRTEK 2026-09-07: any junction can be changed at any time, so the key
    // that does it has to exist on screen during play and not only on a help
    // page nobody has open. The count is the useful part: it says there is
    // something to tune without the player going looking.
    var ty2 = dy + 34;
    var tally = junctionTally(g), jn = tally.jn, mix = tally.mix;
    text(ctx, 'JUNCTIONS', PIECE_X, ty2, MONO_S, INK_DIM);
    text(ctx, jn ? 'HOVER + SPACE' : 'none yet', PIECE_X + PIECE_W, ty2, MONO_S,
      jn ? '#ffd60a' : INK_DIM, 'right');
    if (jn) {
      ctx.fillStyle = '#1b2233';
      roundRect(ctx, PIECE_X, ty2 + 10, PIECE_W, 14, 3); ctx.fill();
      if (mix) {
        ctx.fillStyle = '#ffd60a';
        roundRect(ctx, PIECE_X, ty2 + 10, Math.max(3, PIECE_W * (mix / jn)), 14, 3);
        ctx.fill();
      }
      // Left-aligned inside the bar: where there is fill it is dark ink on
      // yellow, and where there is none it is light ink on the empty track.
      text(ctx, mix + ' M  ·  ' + (jn - mix) + ' S', PIECE_X + 7, ty2 + 17,
        MONO_S, mix ? '#2a2100' : INK_DIM);
    }
  }

  function drawBugs(ctx, g) {
    if (!g.bugs.length) return;
    text(ctx, 'BUGS RUNNING', PIECE_X, 542, MONO_S, '#ff3b30');
    for (var i = 0; i < g.bugs.length && i < 4; i++) {
      var b = g.bugs[i], y = 556 + i * 22;
      ctx.fillStyle = '#2a1620';
      roundRect(ctx, PIECE_X, y, PIECE_W, 18, 3); ctx.fill();
      if (b.max > 0) {
        ctx.fillStyle = 'rgba(255,59,48,0.35)';
        roundRect(ctx, PIECE_X, y, PIECE_W * (b.t / b.max), 18, 3); ctx.fill();
      }
      text(ctx, b.id, PIECE_X + 6, y + 9, MONO_S, '#ff8c8c');
      if (b.max > 0) text(ctx, b.t.toFixed(1) + 's', PIECE_X + PIECE_W - 6, y + 9, MONO_S, '#ff8c8c', 'right');
    }
  }

  function drawHud(ctx, g, pads) {
    text(ctx, 'CROSSWIRE', 24, 30, MONO_L, ACCENT);
    text(ctx, 'beta ' + CW_VERSION, 150, 32, MONO_S, INK_DIM);

    text(ctx, 'SCORE', 246, 20, MONO_S, INK_DIM);
    text(ctx, String(g.score), 246, 40, MONO_L, INK);
    // EVRTEK 2026-09-08: three levels and then the rig is complete, so the box
    // says how far up the ladder the run is rather than counting for ever.
    // "2 / 3" is five characters where it used to be one, which is why WIRED
    // moved right: five characters of 19px Courier New — the monospace an
    // iPhone actually has and the widest this file names — is 57px, and the
    // old 430 left one pixel between the two numbers.
    text(ctx, 'LEVEL', 372, 20, MONO_S, INK_DIM);
    text(ctx, g.level + ' / ' + g.levelCount(), 372, 40, MONO_L, INK);

    // The quota, which is the level's actual goal.
    text(ctx, 'WIRED', 448, 20, MONO_S, INK_DIM);
    text(ctx, g.onLevel + ' / ' + g.quota(), 448, 40, MONO_L,
      g.onLevel ? '#3ede72' : INK);

    // The clock is the only crunch: no demand ever times out. It is drawn big
    // beside the play space as well; this is just the number.
    //
    // EVRTEK 2026-09-14, CALM: "no pressure, no timed disaster bar that drops
    // blocks. no timer at all... basically represents tutorial mode." So there
    // is no number here and no credit line under it either — "+1:48 A LINE" is
    // a promise about a clock that does not exist. The box says what the
    // setting is instead, which is the only honest thing to put in the space.
    if (g.untimed()) {
      text(ctx, 'SANDBOX', 540, 20, MONO_S, INK_DIM);
      text(ctx, 'NO CLOCK', 540, 40, MONO_L, ACCENT);
    } else {
      var low = g.timeT < 30;
      text(ctx, 'TIME', 540, 20, MONO_S, low ? '#ff3b30' : INK_DIM);
      text(ctx, clock(g.timeT), 540, 40, MONO_L, low ? '#ff3b30' : INK);
      text(ctx, '+' + clock(g.timePerDelivery()) + ' A LINE', 600, 40, MONO_S, INK_DIM);
    }

    // EVRTEK 2026-09-07: the PULSE dial that used to sit here counted the beat
    // and did nothing else, so it is gone. The beat still exists internally as
    // the moment a short burns away; it just no longer needs a face.

    // The difficulty carries the LEVEL'S NAME with it now — STEADY · SURGE —
    // because the level number alone does not say what changed about the rig.
    text(ctx, g.diff().id + '  ·  ' + g.levelName() + (g.mayhem ? '  ·  MAYHEM' : ''),
      W - 24, 16, MONO_S, g.mayhem ? '#ff3b30' : '#ffd60a', 'right');
    text(ctx, 'SEED ' + g.seed.toString(36).toUpperCase(), W - 24, 32, MONO_S, INK_DIM, 'right');
    var label = pads.supported
      ? (pads.pads.length ? 'PAD ' + pads.pads[0].index : 'NO PAD')
      : 'NO GAMEPAD API';
    // The pad line is short, so it takes the row beside the clock; the
    // toggles get the bottom row to themselves, clear of "+1:30 A LINE".
    var musicOn = CW_AUDIO.musicOn();
    text(ctx, label, W - 24, 48, MONO_S, pads.pads.length ? '#3ede72' : INK_DIM, 'right');
    text(ctx, (showSymbols ? 'SYMBOLS [G]' : 'no symbols [G]') + '  ·  ' +
      (musicOn ? 'MUSIC [M]' : 'no music [M]'),
      W - 24, 64, MONO_S, musicOn ? '#3ede72' : INK_DIM, 'right');
  }

  function drawToasts(ctx, g) {
    for (var i = 0; i < g.toasts.length; i++) {
      var t = g.toasts[i];
      ctx.globalAlpha = Math.min(1, t.t / 0.5);
      text(ctx, t.text, PIECE_X, 622 + i * 19, MONO_S, t.colour ? C.hex(t.colour) : INK_DIM);
      ctx.globalAlpha = 1;
    }
  }

  // ---- portrait ------------------------------------------------------------
  // EVRTEK 2026-09-07, on making the game mobile friendly. The board itself is
  // already phone-shaped; everything AROUND it had to be rebuilt. The side
  // panels become one HUD strip across the top, one row of boxes under it, and
  // one full-width CUT button under the grid — the only button left, now that
  // moving, turning and placing are all gestures. Nothing scrolls and nothing
  // is hidden behind a menu: a phone screen is the whole cabinet.

  // How many junctions are on the board and how many of them are mixing. The
  // desktop panel says this too; portrait squeezes it into the CUT box.
  function junctionTally(g) {
    var jn = g.junctionCells ? g.junctionCells().length : 0, mix = 0;
    if (jn) {
      var cells = g.junctionCells();
      for (var q = 0; q < cells.length; q++) {
        var ns = g.junctionsAt(cells[q].x, cells[q].y);
        for (var w2 = 0; w2 < ns.length; w2++) if (CW_POWER.mode(ns[w2]) === 'M') { mix++; break; }
      }
    }
    return { jn: jn, mix: mix };
  }

  // Five columns of numbers and nothing else: no seed, no pad, no key toggles.
  // A phone has no keyboard to toggle anything with, and the seed belongs on
  // the game-over card where somebody might actually copy it down.
  function drawHudMobile(ctx, g) {
    // The wordmark, the difficulty and the LEVEL'S NAME. Thirty characters of
    // 11px Courier New is 198px from x 8, and the QUIT chip starts at 334, so
    // the whole line fits on a 400px screen with the wordmark kept.
    text(ctx, 'CROSSWIRE  ·  ' + g.diff().id + '  ·  ' + g.levelName() +
      (g.mayhem ? '  ·  MAYHEM' : ''), 8, 14, MONO_S, ACCENT);
    // The way out. Tron's patrol found there was none: no pause, no quit, a
    // run you started by accident held you for four and a half minutes. Two
    // presses, like everything else here — the first arms it and says so.
    //
    // TRON 2026-09-14 patrol, M2: this was the ONLY tap target in the game
    // under 44 logical pixels — 72 x 30, which is 67.5 x 28.1 CSS px on a 375
    // phone — and it is the way out of a run. js/layout.js:fits() holds every
    // button and every strip target to 44 in both dimensions; this rect escaped
    // that floor only because it is registered here rather than in the layout.
    //
    // THE CHIP IS DRAWN THE SIZE IT ALWAYS WAS. What grew is the rect: 88 x 48,
    // flush with the right edge, with the chip centred across it and sitting at
    // the top of it. 48 rather than 44 because these are LOGICAL pixels and the
    // canvas is scaled to the screen — on a 375-wide phone the ratio is 0.9375,
    // so 48 is the first even number that is still 44 CSS pixels when it lands.
    // The room it takes is room nothing else wants: the HUD publishes no other
    // rect, the wordmark ends at x 206, and the piece row starts at y 64,
    // sixteen pixels below the bottom of this. The numbers under it (TIME and
    // SURGE, or SANDBOX on CALM, which does not reach this far) are read, not
    // pressed, and a stray press only ARMS the quit: it says SURE?, toasts, and
    // forgets it two seconds later.
    var qa = g.quitArm > 0;
    var qw = 88, qh = 48, qcx = W - qw / 2;         // the rect, and its centre
    ctx.fillStyle = qa ? '#2a1620' : PANEL;
    roundRect(ctx, qcx - 29, 2, 58, 24, 5); ctx.fill();
    ctx.strokeStyle = qa ? '#ff3b30' : LINE; ctx.lineWidth = 1; ctx.stroke();
    text(ctx, qa ? 'SURE?' : 'QUIT', qcx, 14, MONO_XS, qa ? '#ff3b30' : INK_DIM, 'center');
    hit('play:quit', W - qw, 0, qw, qh);

    var low = g.timeT < 30, surging = g.surgeT < 8;
    var cols = [
      ['SCORE', String(g.score), INK, INK_DIM],
      ['LEVEL', g.level + ' / ' + g.levelCount(), INK, INK_DIM],
      ['WIRED', g.onLevel + ' / ' + g.quota(), g.onLevel ? '#3ede72' : INK, INK_DIM]
    ];
    // LEVEL moved left four pixels when it became "2 / 3": five characters of
    // 15px Courier New is 45px, and it has to clear WIRED at 152.
    var xs = [8, 96, 152, 232, 312];
    // EVRTEK 2026-09-14: on the sandbox the last TWO columns are one, because
    // neither clock exists. "NO CLOCK" is eight characters of 15px Courier New
    // — 72px from x 232, well inside a 400px screen — so it takes the TIME
    // column's place and the SURGE column is simply not there.
    if (g.untimed()) {
      cols.push(['SANDBOX', 'NO CLOCK', ACCENT, INK_DIM]);
    } else {
      cols.push(['TIME', clock(g.timeT), low ? '#ff3b30' : INK, low ? '#ff3b30' : INK_DIM]);
      cols.push(['SURGE', clock(g.surgeT), surging ? '#ff8c1a' : INK, surging ? '#ff8c1a' : INK_DIM]);
    }
    for (var i = 0; i < cols.length; i++) {
      text(ctx, cols[i][0], xs[i], 30, MONO_XS, cols[i][3]);
      text(ctx, cols[i][1], xs[i], 47, MONO_B, cols[i][2]);
    }
  }

  // NOW, the two NEXTs and the destructor, side by side in one 60px band.
  function drawFeedMobile(ctx, g) {
    var p = g.feed.piece(), b = L.piece, i;

    ctx.fillStyle = '#16213a';
    roundRect(ctx, b.x, b.y, b.w, b.h, 6); ctx.fill();
    ctx.strokeStyle = p.jumps ? '#ffd60a' : ACCENT; ctx.lineWidth = 2; ctx.stroke();
    drawMini(ctx, p, g.feed.rot, b.x, b.y, b.w, 42, 12, p.jumps ? '#ffd60a' : ACCENT);
    text(ctx, p.name, b.x + b.w / 2, b.y + b.h - 9, MONO_XS, INK, 'center');

    var blind = g.bugActive && g.bugActive('BLIND');
    var nx = g.feed.nexts();
    for (i = 0; i < L.next.length; i++) {
      var n = L.next[i];
      ctx.fillStyle = PANEL;
      roundRect(ctx, n.x, n.y, n.w, n.h, 5); ctx.fill();
      ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.stroke();
      if (blind || !nx[i]) {
        text(ctx, '?', n.x + n.w / 2, n.y + n.h / 2, TITLE, '#3a4358', 'center');
        continue;
      }
      drawMini(ctx, nx[i], 0, n.x, n.y, n.w, 42, 10, '#7d8cad');
      text(ctx, nx[i].name, n.x + n.w / 2, n.y + n.h - 9, MONO_XS, INK_DIM, 'center');
    }

    // This box used to say CUT with a cooldown bar, which put two things on
    // one screen that said CUT (Tron's patrol). The button below IS the
    // destructor and carries its own cooldown; this box is the junction tally.
    var cb = L.cut;
    ctx.fillStyle = PANEL;
    roundRect(ctx, cb.x, cb.y, cb.w, cb.h, 5); ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.stroke();
    var t = junctionTally(g);
    text(ctx, 'JUNCTIONS', cb.x + cb.w / 2, cb.y + 12, MONO_XS, INK_DIM, 'center');
    text(ctx, t.jn ? String(t.jn) : '\u2014', cb.x + cb.w / 2, cb.y + 32, MONO_B, t.jn ? INK : INK_DIM, 'center');
    text(ctx, t.jn ? t.mix + ' M · ' + (t.jn - t.mix) + ' S' : 'none yet',
      cb.x + cb.w / 2, cb.y + cb.h - 9, MONO_XS, t.jn ? '#ffd60a' : INK_DIM, 'center');
  }

  // The two TURN pads and their arc glyphs are gone with the scheme that
  // needed them (EVRTEK 2026-09-07): turning is a tap beside the piece now.

  // The destructor's own shape, five squares in a cross, exactly what it takes.
  function cutGlyph(ctx, gx, gy, colour) {
    var s = 4, d = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    ctx.fillStyle = colour;
    for (var i = 0; i < 5; i++) {
      ctx.fillRect(gx + d[i][0] * 5 - s / 2, gy + d[i][1] * 5 - s / 2, s, s);
    }
  }

  // The one line of text on the phone that says what a finger can do right
  // now, and it changes with what is under it. MONO_XS, not MONO_S: the
  // scheme takes three clauses to state and eleven-pixel Courier New runs off
  // a 400px screen at sixty characters. At ten pixels it is 6px a character,
  // so the budget is 66 characters edge to edge.
  //
  // EVRTEK 2026-09-07 made the drag a d-pad, and "DRAG ANYWHERE TO MOVE" costs
  // seven characters more than "DRAG THE PIECE" did — 67 with the double
  // spaces this line has always set its dots in, which is one character over
  // the screen. The dots lost a space either side rather than the line losing a
  // word: DRAG ANYWHERE is the whole of what changed today and TO MOVE is what
  // makes the three clauses read in parallel, so neither was worth 24 pixels.
  // 63 characters, 378px, eleven pixels of margin a side.
  function hintLine(ctx, g) {
    var s = 'DRAG ANYWHERE TO MOVE · TAP BESIDE IT TO TURN · TAP IT TO PLACE';
    var col = INK_DIM;
    if (g.snipMode) {
      // Two gestures now, not three: the cross no longer jumps to a tap
      // (EVRTEK 2026-09-07), so there is nothing left to say about elsewhere.
      s = 'DRAG ANYWHERE TO MOVE THE CROSS  ·  TAP IT TO CUT';
    } else {
      var hov = g.hoverJunction();
      if (hov) {
        s = 'TAP THE PIECE: MAKE IT ' +
          (CW_POWER.mode(hov) === 'M' ? 'A SPLITTER' : 'A MIXER');
        col = '#ffd60a';
      } else if (g.feed.piece().jumps) {
        s = 'SPAN JUMPS OVER WIRE  ·  TAP BESIDE IT TO TURN';
        col = '#ffd60a';
      }
    }
    text(ctx, s, W / 2, L.hintY, MONO_XS, col, 'center');
  }

  // One button, full width, and it is the destructor. Still written as a loop
  // over L.buttons rather than against `cut` by name: the layout owns where
  // the controls are, and this file owns nothing but how they look.
  function drawControls(ctx, g) {
    for (var i = 0; i < L.buttons.length; i++) {
      var b = L.buttons[i];
      var armed = b.id === 'cut' && g.snipMode;
      var cooling = b.id === 'cut' && g.cutCd > 0;

      ctx.fillStyle = armed ? '#2a1620' : PANEL;
      roundRect(ctx, b.x, b.y, b.w, b.h, 8);
      ctx.fill();
      ctx.strokeStyle = armed ? '#ff3b30' : LINE;
      ctx.lineWidth = armed ? 2 : 1;
      ctx.stroke();

      // Glyph and label are placed off the button's CENTRE, not its left edge,
      // so a full-width button reads as one mark instead of a label adrift in
      // 360 pixels of panel.
      var ink = cooling ? '#4a5674' : (armed ? '#ff3b30' : INK);
      var gy = b.y + b.h / 2, gcx = b.x + b.w / 2;
      cutGlyph(ctx, gcx - 26, gy, ink);
      text(ctx, b.label, gcx + 12, gy, MONO_B, ink, 'center');

      if (cooling) {
        ctx.fillStyle = '#ff8c1a';
        ctx.fillRect(b.x + 10, b.y + b.h - 8,
          (b.w - 20) * (1 - g.cutCd / g.cutCdMax), 3);
      }
      hit(b.id, b.x, b.y, b.w, b.h);
    }
    hintLine(ctx, g);
  }

  function drawBugsMobile(ctx, g) {
    if (!g.bugs.length) return;
    var names = [];
    for (var i = 0; i < g.bugs.length; i++) names.push(g.bugs[i].id);
    // 14 above the hint, not 18: at 18 the capitals clip the bottom edge of
    // the CUT button, and there is exactly one gap here to sit in.
    text(ctx, names.join(' · '), W - 8, L.hintY - 14, MONO_XS, '#ff8c8c', 'right');
  }

  function drawToastsMobile(ctx, g, baseY) {
    for (var i = 0; i < g.toasts.length && i < 2; i++) {
      var t = g.toasts[i];
      ctx.globalAlpha = Math.min(1, t.t / 0.5);
      text(ctx, t.text, 8, baseY + i * 18, MONO_S, t.colour ? C.hex(t.colour) : INK_DIM);
      ctx.globalAlpha = 1;
    }
  }

  // ---- the strip: the shredder and the two bins ---------------------------
  //
  // EVRTEK 2026-09-14: "let's reduce the board size by 3 rows, those rows
  // should be replaced by the 'shredder' and two storage bins. The player can
  // drag a piece on to the shredder and it is disintegrated (an animation
  // would be cool). The player can also drag a piece onto one of the storage
  // bins to hold it for later, if there's a piece in the bin, the active piece
  // should swap with the one in the bin."
  //
  // His reason, in the same pass: "one major goal is to have fewer unused
  // pieces to clutter the board." The strip is where a piece nobody wants goes
  // INSTEAD of onto the board, so this row of three is the answer to the
  // complaint and has to look like somewhere you would put something.
  //
  // It is drawn identically on both layouts and on both it publishes its three
  // rects, because the mouse reaches the game through the touch code and a
  // desktop player has to be able to click them as well as press X, 1 and 2.
  function stripTargets() { return (L.strip && L.strip.targets) || []; }

  // One deterministic pseudo-random number per fragment. Deliberately NOT
  // Math.random: a fragment that re-rolls its scatter every frame does not
  // fly anywhere, it flickers.
  function frand(n) {
    var x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  // The freshest shred still running, which is what the shredder animates to.
  function shredNow(g) {
    if (!g.shreds || !g.shreds.length) return null;
    var best = null;
    for (var i = 0; i < g.shreds.length; i++) {
      if (!best || g.shreds[i].t > best.t) best = g.shreds[i];
    }
    return best;
  }

  // A little key chip in the corner of a target. Desktop only: a phone has no
  // keyboard, and the whole point of the target is that it is a place to drag
  // a piece onto rather than a key to remember.
  function keyChip(ctx, t, on) {
    if (MOBILE || !t.key) return;
    var w = 16, h = 14, x = t.x + t.w - w - 6, y = t.y + 6;
    ctx.fillStyle = '#0d1220';
    roundRect(ctx, x, y, w, h, 3);
    ctx.fill();
    ctx.strokeStyle = on ? ACCENT : LINE;
    ctx.lineWidth = 1;
    ctx.stroke();
    text(ctx, t.key, x + w / 2, y + h / 2 + 0.5, MONO_XS, on ? ACCENT : INK_DIM, 'center');
  }

  // WHERE THE SLOT IS inside the shredder's card. Centred in whatever room the
  // label leaves, because the two layouts give it different amounts (74px tall
  // on the desktop card, 64 on the phone) — and said ONCE, because the
  // disintegration animation has to fly its fragments into the same hole this
  // draws, and two copies of the arithmetic is two holes.
  function shredMouth(t) {
    var h = Math.min(26, Math.max(12, t.h - 40));
    return { x: t.x + 12, w: t.w - 24, h: h, y: t.y + Math.round((t.h - 20 - h) / 2) + 2 };
  }

  // THE SHREDDER. A slot with two rows of teeth that turn while something is
  // going through them, and a cooldown that fills the bottom edge back up —
  // EVRTEK 2026-09-14: "there should be a cool down on the shredder that gets
  // longer with increasing difficulties", which is 3, 5, 8 and 12 seconds.
  function drawShredder(ctx, g, t) {
    var ready = g.shredCd <= 0;
    var live = shredNow(g);
    var flash = live ? Math.max(0, live.t / live.max) : 0;

    ctx.fillStyle = flash ? '#2a1620' : PANEL;
    roundRect(ctx, t.x, t.y, t.w, t.h, 8);
    ctx.fill();
    ctx.strokeStyle = flash ? '#ffffff' : (ready ? ACCENT : '#3a4358');
    ctx.lineWidth = flash ? 2 : 1;
    ctx.stroke();

    var m = shredMouth(t), mx = m.x, my = m.y, mw = m.w, mh = m.h;
    ctx.fillStyle = '#05080f';
    roundRect(ctx, mx, my, mw, mh, 3);
    ctx.fill();

    // the teeth, clipped into the mouth so nothing spills out of the slot.
    // `phase` slides them sideways, which is what a pair of counter-rotating
    // blades looks like from the front.
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, mx, my, mw, mh, 3);
    ctx.clip();
    var spin = live ? (1 - live.t / live.max) * 7 : 0;
    var teeth = 7, tw = mw / teeth, phase = (spin - Math.floor(spin)) * tw;
    // White while something is going through, steel when it is ready, and dim
    // while it cools. `flash` is asked FIRST, because a shred sets the cooldown
    // in the same instant it starts the animation — ask `ready` first and the
    // blades go dark exactly when they are supposed to be turning.
    ctx.fillStyle = flash ? '#ffffff' : (ready ? '#7ea0c8' : '#3a4358');
    for (var k = -1; k <= teeth; k++) {
      var x0 = mx + k * tw + phase;
      ctx.beginPath();                       // upper row, pointing down
      ctx.moveTo(x0, my);
      ctx.lineTo(x0 + tw / 2, my + mh * 0.44);
      ctx.lineTo(x0 + tw, my);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();                       // lower row, pointing up
      ctx.moveTo(x0 - tw / 2, my + mh);
      ctx.lineTo(x0, my + mh - mh * 0.44);
      ctx.lineTo(x0 + tw / 2, my + mh);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // the label, which carries the cooldown when there is one. One line rather
    // than two: the destructor's readout taught that a control saying READY in
    // one place and 3.2s in another reads as two controls.
    var lab = ready ? t.label : t.label + '  ' + g.shredCd.toFixed(1) + 's';
    text(ctx, lab, t.x + t.w / 2, t.y + t.h - 11, MONO_XS,
      ready ? INK : '#ff8c1a', 'center');
    if (!ready && g.shredCdMax > 0) {
      ctx.fillStyle = '#1b2233';
      ctx.fillRect(t.x + 10, t.y + t.h - 6, t.w - 20, 3);
      ctx.fillStyle = '#ff8c1a';
      ctx.fillRect(t.x + 10, t.y + t.h - 6, (t.w - 20) * (1 - g.shredCd / g.shredCdMax), 3);
    }
    keyChip(ctx, t, ready);
  }

  // A BIN. A well with whatever is in it drawn small, in the same style the
  // NEXT boxes use, because it IS the same thing: a piece waiting its turn.
  // EVRTEK 2026-09-14: "if there's a piece in the bin, the active piece should
  // swap with the one in the bin", so a full bin is not a locked bin and is
  // drawn live rather than greyed.
  function drawBin(ctx, g, t, i) {
    var held = (g.bins && g.bins[i]) || null;

    ctx.fillStyle = PANEL;
    roundRect(ctx, t.x, t.y, t.w, t.h, 8);
    ctx.fill();
    ctx.strokeStyle = held ? ACCENT : LINE;
    ctx.lineWidth = held ? 2 : 1;
    ctx.stroke();

    var ix = t.x + 8, iy = t.y + 7, iw = t.w - 16, ih = t.h - 25;
    ctx.fillStyle = '#0d1220';
    roundRect(ctx, ix, iy, iw, ih, 4);
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.stroke();

    if (held) {
      // Rotation zero, like the NEXT boxes: a stashed piece comes back the way
      // the feed deals it, so showing it turned would be a lie about what you
      // get back.
      var size = Math.max(6, Math.floor(Math.min(iw / 5.4, ih / 5.4)));
      drawMini(ctx, held, 0, ix, iy, iw, ih, size, held.jumps ? '#ffd60a' : ACCENT);
    } else {
      text(ctx, 'EMPTY', ix + iw / 2, iy + ih / 2, MONO_XS, '#3a4358', 'center');
    }

    text(ctx, t.label, t.x + t.w / 2, t.y + t.h - 11, MONO_XS,
      held ? INK : INK_DIM, 'center');
    keyChip(ctx, t, !!held);
  }

  // TRON 2026-09-14 patrol, L2: the strip looked live while the destructor was
  // armed and answered with nothing. The rule itself is right — there is no
  // piece in hand to shred or stash while the cursor is a cutting cross
  // (js/game.js, _applyNow) — but the guard was SILENT: no toast, and all three
  // panels kept their normal cyan borders and their live labels. Three buttons
  // that look pressable and do nothing is a worse lie than three buttons that
  // look unavailable, so while CUT is armed the whole strip is drawn at 45%,
  // labels and key chips included. The targets stay in the hit list: a press is
  // still answered by the rules, which is where the rule about it lives.
  var STRIP_DIM = 0.45;

  function drawStrip(ctx, g) {
    var ts = stripTargets(), i, t;
    if (!ts.length) return;
    ctx.save();
    if (g.snipMode) ctx.globalAlpha = STRIP_DIM;
    for (i = 0; i < ts.length; i++) {
      t = ts[i];
      if (t.id === 'shred') drawShredder(ctx, g, t);
      else drawBin(ctx, g, t, t.id === 'bin1' ? 1 : 0);
      // Painted and made tappable in the same breath, the way every other
      // control on this screen is: one set of numbers, never two.
      hit(t.id, t.x, t.y, t.w, t.h);
    }
    // The desktop key line. On a phone the targets ARE the controls, so there
    // is nothing to say; on a desktop these three keys exist and nothing else
    // on the screen would tell you so. It sits in the gap the clock digits
    // leave between the board and the strip.
    if (!MOBILE) {
      text(ctx, 'X  SHRED   ·   1  BIN 1   ·   2  BIN 2',
        ts[0].x, ts[0].y - 10, MONO_S, INK_DIM);
    }
    ctx.restore();
  }

  // THE DISINTEGRATION. "an animation would be cool" — EVRTEK 2026-09-14, and
  // this is it: the piece comes apart where it stood, the pieces of it scatter
  // for a moment and are then pulled down into the shredder's mouth, fading as
  // they go, with sparks thrown back out as they arrive.
  //
  // It is driven entirely off g.shreds, which the RULES leave behind — the
  // board cells in the record are where the piece WAS, and they were freed the
  // instant it was shredded. Nothing here touches the game.
  function drawShreds(ctx, g) {
    if (!g.shreds || !g.shreds.length) return;
    var ts = stripTargets(), tgt = null, i, j, k;
    for (i = 0; i < ts.length; i++) if (ts[i].id === 'shred') tgt = ts[i];
    if (!tgt) return;
    // The mouth is where the fragments are going, read from the same function
    // that draws it.
    var mouth = shredMouth(tgt);
    var tx = mouth.x + mouth.w / 2, ty = mouth.y + mouth.h / 2;
    var frags = LITE ? 3 : 5;

    for (i = 0; i < g.shreds.length; i++) {
      var s = g.shreds[i];
      var p = Math.max(0, Math.min(1, 1 - s.t / s.max));
      var pull = p * p;                       // ease IN: it is being sucked down
      var burst = Math.min(1, p * 5);         // the scatter, over in the first fifth
      for (j = 0; j < s.cells.length; j++) {
        var ox = cx(s.cells[j][0]), oy = cy(s.cells[j][1]);
        for (k = 0; k < frags; k++) {
          var id = i * 977 + j * 71 + k * 13;
          var sx = ox + (frand(id) - 0.5) * CELL * 1.5 * burst;
          var sy = oy + (frand(id + 3) - 0.5) * CELL * 1.1 * burst;
          var fx = sx + (tx - sx) * pull;
          var fy = sy + (ty - sy) * pull - Math.sin(p * Math.PI) * 16 * K;
          var sz = Math.max(1.5, CELL * 0.17 * (1 - p * 0.65));
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - p * p);
          ctx.translate(fx, fy);
          ctx.rotate((frand(id + 9) - 0.5) * 6 + p * 11);
          ctx.fillStyle = (k % 2) ? '#7ef7f7' : ACCENT;
          ctx.fillRect(-sz / 2, -sz * 0.3, sz, sz * 0.6);
          ctx.restore();
        }
      }
      // sparks out of the mouth, once the first fragments have reached it
      if (p > 0.4) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - p) * 0.9;
        ctx.lineCap = 'round';
        ctx.lineWidth = 1.5;
        for (k = 0; k < (LITE ? 3 : 5); k++) {
          var ang = Math.PI + (frand(i * 31 + k * 7 + Math.floor(p * 40)) - 0.5) * 2.4;
          var len = 4 + frand(k * 17 + Math.floor(p * 40)) * 9;
          ctx.strokeStyle = (k % 2) ? '#ffd60a' : '#ffffff';
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx + Math.cos(ang) * len, ty + Math.sin(ang) * len);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  // ---- the front end ------------------------------------------------------
  // EVRTEK 2026-09-07: a title screen that picks the mode, a difficulty screen
  // with a tutorial playing on each option, and a help screen that actually
  // explains the game instead of a paragraph nobody reads.

  // THE CONTROLS PANEL, desktop: keys on the left, what they do, the pad
  // button on the right. Three of these rows are new with the strip under the
  // board (EVRTEK 2026-09-14) — X shreds, 1 and 2 are the bins, and on a pad
  // either trigger shreds and the two bumpers are the bins (js/input.js).
  //
  // TRON 2026-09-14 patrol, L3: the QUIT row is the eighth, and it was missing.
  // The phone's list has ended ['QUIT, TWICE', 'leave a run'] since the chip was
  // built; the desktop's never mentioned Escape — and the desktop draws no QUIT
  // chip either (that is drawHudMobile), so this panel is the only place a
  // player at a keyboard can find out the way out of a run. It was in README.md
  // and nowhere in the game. The key column says the two presses the way the
  // phone's does, because one press does not leave: it arms.
  var KEYS = [
    ['W A S D', 'move the piece', 'D-PAD'],
    ['Q  E', 'turn it', 'X  B'],
    ['SPACE', 'put it down, or tune a junction', 'A'],
    ['B', 'arm the destructor', 'Y'],
    ['X', 'shred the piece in hand', 'TRIGGER'],
    ['1  2', 'stash it in a bin', 'LB  RB'],
    ['ESC, TWICE', 'leave a run', ''],
    ['M  G', 'music · colourblind marks', '']
  ];

  // THE WALL OF RULES IS GONE (EVRTEK'S RULING 108, 2026-09-14): "let's use the
  // 'picture says 1,000 words approach' here, the help screens should include
  // animated samples of what needs to be done. Simple description in words but
  // a visual representation of the game in action to show how things work."
  //
  // What stood here was six sections and 442 words introducing about two dozen
  // named ideas before the player had made a single move — Quorra's playtest of
  // the live beta, which also found that "the first minute is the hardest part
  // of the game". Every one of those ideas is a LESSON PANEL now: a title, two
  // plain sentences, and the thing itself happening on a looping board. The
  // panels are js/demo.js's CW_DEMO.LESSONS; this file lays them out, sizes
  // them and pages them. The only words left in here are the CONTROLS, which
  // are the one thing that differs between the two cabinets and so cannot live
  // in a shared script.

  // The keys a phone has instead of keys, said in gestures. Measured and
  // clipped to the panel now rather than hand-counted against Courier New,
  // because the panel is a different width on each layout.
  //
  // THE TWO STRIP ROWS ARE NEW (ruling 108). The strip arrived on 09-14 with
  // three ways to reach it — a key, a pad button, and a finger — and the
  // finger had TWO gestures of which only one was ever written down anywhere:
  // a tap on the target, and a drag of the piece released over it. The drag
  // was stated nowhere in the game at all, which is the kind of thing a help
  // screen exists for.
  var TOUCH_KEYS = [
    // EVRTEK 2026-09-07: the drag is a d-pad, so the label is the rule. His
    // note ran "move the piece — the screen is a d-pad"; the label right
    // beside it already says what is being dragged, so "it" says the same.
    ['DRAG ANYWHERE', 'move it — the screen is a d-pad'],
    ['TAP BESIDE IT', 'turn it — right for clockwise'],
    ['TAP THE PIECE', 'put it down'],
    // EVRTEK 2026-09-07: one tap on a junction flips it, and the piece stays
    // where it is. Said in full rather than as "S ↔ M", because this page is
    // where someone finds out what those two letters mean.
    ['TAP A JUNCTION', 'flip it: S becomes M, M becomes S'],
    ['CUT, THEN THE CROSS', 'the destructor'],
    ['TAP SHRED OR A BIN', 'send the piece in hand there'],
    ['OR DRAG IT ONTO ONE', 'let go over the target'],
    ['QUIT, TWICE', 'leave a run']
  ];

  // x / w / h are optional: portrait wants a full-width 52px row, desktop the
  // 420x42 one it has always had.
  function menuRow(ctx, label, note, y, on, dim, mx, mw, mh) {
    var w = mw || 420, h = mh || 42;
    var x = mx === undefined ? W / 2 - w / 2 : mx;
    ctx.fillStyle = on ? '#16213a' : PANEL;
    roundRect(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = on ? ACCENT : LINE;
    ctx.lineWidth = on ? 2 : 1;
    ctx.stroke();
    text(ctx, label, x + 26, y + h / 2, MONO_L, dim ? '#4a5674' : (on ? INK : INK_DIM));
    if (note) text(ctx, note, x + w - 26, y + h / 2, MONO_S, dim ? '#4a5674' : INK_DIM, 'right');
    if (on) text(ctx, '>', x + 10, y + h / 2, MONO_L, ACCENT);
  }

  // One rounded box with a centred label AND its touch target, registered in
  // the same breath, so the rect a finger hits can never drift from the rect
  // that was painted.
  function tapRow(ctx, id, x, y, w, h, label, font, fill, stroke, sw, ink) {
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = sw || 1;
    ctx.stroke();
    text(ctx, label, x + w / 2, y + h / 2, font, ink, 'center');
    if (id) hit(id, x, y, w, h);
  }

  // ---- the title -----------------------------------------------------------
  //
  // EVRTEK 2026-09-08: "title screen isn't nearly cool enough, see what you
  // can do to spruce that baby up!" So the title is a CROSSWIRE. A source on
  // the left, the wordmark is the wire, a bulb on the right: every few
  // seconds a charge leaves the source, runs the trace and through the
  // letters, and lights the bulb in its colour — the six the game has, in
  // turn. Behind it, a field of traces carrying current, bending the way
  // wire on the board bends. The letters power on one at a time the first
  // time the screen is seen. None of it is an image; it is all the game's
  // own drawing, which is the Arcade's rule and also the point.
  var TITLE_COLOURS = [1, 2, 4, 3, 6, 5];   // red, yellow, blue, orange, green, purple
  var TITLE_PERIOD = 3.4;                   // seconds from the source to the bulb
  var titleT0 = 0;   // when the title was first drawn this visit; draw() clears it elsewhere
  var field = null, fieldKey = '';

  function mixHex(a, b, k) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = (pa >> 16) & 255, g = (pa >> 8) & 255, bl = pa & 255;
    r += (((pb >> 16) & 255) - r) * k; g += (((pb >> 8) & 255) - g) * k; bl += ((pb & 255) - bl) * k;
    // Hex out as well as in, so a mix can be mixed again.
    function h(v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }
    return '#' + h(r) + h(g) + h(bl);
  }

  // The field: a dozen and a half traces that enter from one side, bend two
  // or three times on a 20px grid and leave by the other, each with a charge
  // running along it. Seeded, so the field is the same every time and the
  // same on every machine.
  function titleField() {
    var key = W + 'x' + H;
    if (field && fieldKey === key) return field;
    var seed = 7;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    var n = MOBILE ? 12 : 16, paths = [], i, s, k;
    for (i = 0; i < n; i++) {
      var g = 20, fromLeft = (i % 2 === 0), dir = fromLeft ? 1 : -1;
      var x = fromLeft ? -40 : W + 40, y = g * (2 + Math.floor(rnd() * (H / g - 4)));
      var pts = [[x, y]], segs = 2 + Math.floor(rnd() * 2);
      for (s = 0; s < segs; s++) {
        x += dir * g * (4 + Math.floor(rnd() * 10)); pts.push([x, y]);
        y += (rnd() < 0.5 ? -1 : 1) * g * (1 + Math.floor(rnd() * 4));
        y = Math.max(g, Math.min(H - g, y)); pts.push([x, y]);
      }
      x += dir * (W + 80); pts.push([x, y]);
      var len = 0, cum = [0];
      for (k = 1; k < pts.length; k++) {
        len += Math.abs(pts[k][0] - pts[k - 1][0]) + Math.abs(pts[k][1] - pts[k - 1][1]);
        cum.push(len);
      }
      paths.push({ pts: pts, cum: cum, len: len, speed: 55 + rnd() * 75, phase: rnd(),
                   colour: TITLE_COLOURS[i % TITLE_COLOURS.length] });
    }
    field = paths; fieldKey = key;
    return field;
  }
  // Clamped, not wrapped: a dash that ran off the far end and reappeared at
  // the near one drew a diagonal across the screen.
  function pointAt(p, d) {
    d = Math.max(0, Math.min(p.len, d));
    for (var k = 1; k < p.cum.length; k++) {
      if (d <= p.cum[k]) {
        var a = p.pts[k - 1], b = p.pts[k], f = (d - p.cum[k - 1]) / ((p.cum[k] - p.cum[k - 1]) || 1);
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      }
    }
    return p.pts[p.pts.length - 1];
  }
  // A dash of current from distance d0 to d1 along a path, following the
  // bends: sampled every few pixels so a corner is turned, not cut.
  function dash(ctx, p, d0, d1) {
    var n = Math.max(2, Math.ceil((d1 - d0) / 6)), i;
    ctx.beginPath();
    for (i = 0; i <= n; i++) {
      var q = pointAt(p, d0 + (d1 - d0) * i / n);
      if (i === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke();
  }

  function drawTitleAmbience(ctx) {
    var t = Date.now() / 1000, F = titleField(), i, j;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (i = 0; i < F.length; i++) {
      var p = F[i];
      ctx.globalAlpha = 0.07;
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (j = 0; j < p.pts.length; j++) {
        if (j === 0) ctx.moveTo(p.pts[j][0], p.pts[j][1]); else ctx.lineTo(p.pts[j][0], p.pts[j][1]);
      }
      ctx.stroke();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = ACCENT;
      for (j = 1; j < p.pts.length - 1; j++) ctx.fillRect(p.pts[j][0] - 2, p.pts[j][1] - 2, 4, 4);
      // The charge runs from the near end to 130px past the far one, so its
      // tail has left the screen before the head comes round again.
      var lap = p.len + 130, d = (t * p.speed + p.phase * lap) % lap, col = CW_COLOUR.hex(p.colour);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;  dash(ctx, p, d - 22, d);
      ctx.globalAlpha = 0.2;  dash(ctx, p, d - 60, d - 24);
      ctx.globalAlpha = 0.08; dash(ctx, p, d - 120, d - 62);
    }
    ctx.restore();
    vignette(ctx, 0, 0, W, H);
  }

  // The wordmark as a wire. `size` is the letter height; the trace runs at
  // `ty` from the source at `x0` to the bulb at `x1`.
  function drawTitleWire(ctx, cy, size, ty, x0, x1) {
    var t = Date.now() / 1000;
    if (!titleT0) titleT0 = t;                 // first frame back on the title: power up
    var age = t - titleT0;
    var n = Math.floor(t / TITLE_PERIOD), ph = (t % TITLE_PERIOD) / TITLE_PERIOD;
    var colour = TITLE_COLOURS[n % TITLE_COLOURS.length];
    var prev = TITLE_COLOURS[(n + TITLE_COLOURS.length - 1) % TITLE_COLOURS.length];
    var hex = CW_COLOUR.hex(colour);
    var px = x0 + ph * (x1 - x0);
    var i;

    // The trace, and the charge on it: a bright head, a halo, a long tail.
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, ty); ctx.lineTo(x1, ty); ctx.stroke();
    var head = Math.min(x1, px), tail = Math.max(x0, px - 46), far = Math.max(x0, px - 130);
    ctx.strokeStyle = hex;
    ctx.globalAlpha = 0.16; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(far, ty); ctx.lineTo(tail, ty); ctx.stroke();
    ctx.globalAlpha = 0.28; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(tail, ty); ctx.lineTo(head, ty); ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(tail, ty); ctx.lineTo(head, ty); ctx.stroke();
    ctx.restore();

    // The source: a box in the colour of the charge, a lead, and sparks at
    // the mouth while the charge is leaving.
    var sw = size * 0.55, sh = size * 0.4, sx = x0 - sw - 6, sy = ty - sh / 2;
    var leaving = ph < 0.14 ? 1 - ph / 0.14 : 0;
    ctx.save();
    ctx.strokeStyle = hex; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx + sw, ty); ctx.lineTo(x0 + 1, ty); ctx.stroke();
    ctx.fillStyle = mixHex('#0a0e18', hex, 0.35 + leaving * 0.25);
    roundRect(ctx, sx, sy, sw, sh, 4); ctx.fill();
    ctx.strokeStyle = hex; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = hex;
    ctx.fillRect(sx + sw * 0.3, sy + sh * 0.3, sw * 0.4, sh * 0.4);
    ctx.lineWidth = 1.5;
    for (i = 0; i < 3; i++) {
      var a = Math.sin(t * 41 + i * 2.1) * 0.9, l = 4 + Math.abs(Math.sin(t * 23 + i)) * 5;
      ctx.globalAlpha = 0.45 + leaving * 0.5;
      ctx.beginPath(); ctx.moveTo(x0 + 2, ty); ctx.lineTo(x0 + 2 + Math.cos(a) * l, ty + Math.sin(a) * l); ctx.stroke();
    }
    ctx.restore();

    // The letters, lit as the charge passes through them.
    var word = 'CROSSWIRE', adv = size * 1.22, lx = (x0 + x1) / 2 - adv * (word.length - 1) / 2;
    ctx.save();
    ctx.font = '700 ' + size + 'px Consolas, "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (i = 0; i < word.length; i++) {
      var cx = lx + i * adv;
      var on = Math.max(0, Math.min(1, (age - i * 0.07) / 0.22));
      if (on <= 0) continue;
      var k = Math.max(0, 1 - Math.abs(cx - px) / (adv * 1.15));
      var ink = mixHex(mixHex(ACCENT, hex, k), '#ffffff', k * 0.5);
      ctx.globalAlpha = on;
      if (!LITE) { ctx.shadowColor = k > 0.05 ? hex : ACCENT; ctx.shadowBlur = 10 + 18 * k; }
      ctx.fillStyle = ink;
      ctx.fillText(word[i], cx, cy);
    }
    ctx.restore();

    // The bulb: lit in the colour that has just arrived, fading as the next
    // charge sets out.
    var lit = ph > 0.93 ? (ph - 0.93) / 0.07 : (ph < 0.35 ? 1 - ph / 0.35 : 0);
    var bcol = CW_COLOUR.hex(ph > 0.93 ? colour : prev), R = size * 0.28, bx = x1 + 8 + R, by = ty;
    ctx.save();
    ctx.strokeStyle = bcol; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x1 - 1, ty); ctx.lineTo(bx - R - 4, ty); ctx.stroke();
    ctx.fillStyle = bcol;
    ctx.fillRect(bx - R - 5, ty - 3, 4, 6);                   // the screw base
    if (lit > 0) {
      var gr = ctx.createRadialGradient(bx, by, R * 0.5, bx, by, R * 3.4);
      gr.addColorStop(0, bcol); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.5 * lit;
      ctx.fillStyle = gr;
      ctx.fillRect(bx - R * 3.4, by - R * 3.4, R * 6.8, R * 6.8);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = mixHex('#0a0e18', bcol, 0.85 * lit);
    ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = bcol; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.restore();
  }

  function drawTitle(ctx, g) {
    drawTitleWire(ctx, 150, 56, 190, 150, W - 150);
    text(ctx, 'split it, mix it, light it up!', W / 2, 232, MONO, INK_DIM, 'center');
    text(ctx, 'beta ' + CW_VERSION, W / 2, 252, MONO_S, '#3a4358', 'center');

    menuRow(ctx, '1 PLAYER', '', 290, g.titlePick === 0, false);
    menuRow(ctx, '2 PLAYERS', 'NOT BUILT YET', 342, g.titlePick === 1, true);
    menuRow(ctx, 'HOW TO PLAY', '', 394, g.titlePick === 2, false);

    text(ctx, 'W / S to move   ·   SPACE to choose', W / 2, 476, MONO, INK_DIM, 'center');
  }

  // Portrait: the same three choices, plus the music toggle, which on desktop
  // is the M key and on a phone has to be a thing you can touch.
  function drawTitleMobile(ctx, g) {
    drawTitleWire(ctx, 128, 30, 160, 52, W - 52);
    text(ctx, 'split it, mix it, light it up!', W / 2, 196, MONO_S, INK_DIM, 'center');
    text(ctx, 'beta ' + CW_VERSION, W / 2, 216, MONO_XS, '#3a4358', 'center');

    // EVRTEK 2026-09-07: no 2 PLAYERS row on a phone — "it will never work."
    // Two rows, then the music switch, which on a phone has no key.
    menuRow(ctx, '1 PLAYER', '', 250, g.titlePick === 0, false, 20, 360, 52);
    menuRow(ctx, 'HOW TO PLAY', '', 318, g.titlePick === 2, false, 20, 360, 52);
    hit('title:0', 20, 250, 360, 52);
    hit('title:2', 20, 318, 360, 52);

    var on = CW_AUDIO.musicOn();
    tapRow(ctx, 'title:music', 20, 402, 360, 52, on ? 'MUSIC  ON' : 'MUSIC  OFF',
      MONO_L, PANEL, LINE, 1, on ? '#3ede72' : INK_DIM);

    text(ctx, 'TAP TO CHOOSE', W / 2, 484, MONO_S, INK_DIM, 'center');
  }

  // ---- the help: LESSON PANELS (EVRTEK'S RULING 108) ----------------------
  //
  // A panel is a title, a caption of one or two plain sentences, and a board
  // with the lesson playing on it — the same CW_DEMO.draw the difficulty cards
  // run, live. Nine of them come from js/demo.js. The tenth is the CONTROLS,
  // which is the one panel that cannot live in a shared script because the two
  // cabinets have nothing in common there: keys and a pad on the desktop,
  // gestures on a phone.
  //
  // Nothing on a panel is hand-counted. The caption is wrapped to a measured
  // width and the board is given a cell size that fits the room left over, so
  // a longer caption or a taller board moves the arithmetic instead of running
  // off the edge — the same principle the old two-column split worked on.

  function helpPanels() {
    if (helpCards) return helpCards;
    var out = [], i, l;
    for (i = 0; i < CW_DEMO.LESSONS.length; i++) {
      l = CW_DEMO.LESSONS[i];
      out.push({ title: l.title, caption: l.caption, script: l.script });
    }
    out.push({ title: 'CONTROLS', controls: true });
    helpCards = out;
    return out;
  }

  // Where the panels sit. Said ONCE, because the page count the rules clamp
  // paging on (Game._helpPages, through helpPageCount) and the drawing have to
  // agree exactly or the last page is unreachable or blank.
  function helpGrid() {
    if (MOBILE) return { cols: 1, rows: 1, x: 16, y: 64, w: W - 32, h: 624, gx: 0, gy: 0 };
    return { cols: 2, rows: 2, x: 36, y: 74, w: 414, h: 258, gx: 20, gy: 14 };
  }

  function helpMetrics() {
    return MOBILE
      ? { pad: 14, titleFont: MONO_L, titleH: 30, capFont: MONO_S, capLine: 17,
          capMax: 5, rowH: 30 }
      : { pad: 12, titleFont: MONO_B, titleH: 24, capFont: MONO_S, capLine: 15,
          capMax: 4, rowH: 22 };
  }

  function helpPerPage() { var gr = helpGrid(); return gr.cols * gr.rows; }

  function helpPageCount() {
    return Math.max(1, Math.ceil(helpPanels().length / helpPerPage()));
  }

  // Break a sentence to a width, measured rather than counted: the captions
  // are written in demo.js with no idea what they will be drawn into, and the
  // panel is a different width on each layout. Anything past the last line is
  // folded onto it and clipped, so a caption can be too long for its panel and
  // still not paint over the next one.
  function wrapLines(ctx, s, font, maxw, maxLines) {
    ctx.font = font || MONO;
    var words = String(s).split(' '), lines = [], cur = '', i, t;
    for (i = 0; i < words.length; i++) {
      t = cur ? cur + ' ' + words[i] : words[i];
      if (cur && ctx.measureText(t).width > maxw) { lines.push(cur); cur = words[i]; }
      else cur = t;
    }
    if (cur) lines.push(cur);
    if (maxLines && lines.length > maxLines) {
      var rest = lines.slice(maxLines - 1).join(' ');
      lines = lines.slice(0, maxLines - 1);
      lines.push(clip(ctx, rest, font, maxw));
    }
    return lines;
  }

  // ONE CELL SIZE FOR A WHOLE PAGE. Each board could take the biggest cell its
  // own script fits in, but four boards at four scales on one page reads as
  // four different games, so the page takes the smallest of them. The panel
  // with the strip under it is the tall one and usually decides.
  function helpCell(list, bw, bh) {
    var c = MOBILE ? 46 : 30, i, sz, ok;
    while (c > 8) {
      ok = true;
      for (i = 0; i < list.length; i++) {
        if (!list[i].script) continue;
        sz = CW_DEMO.size(list[i].script, c);
        if (sz.w > bw || sz.h > bh) { ok = false; break; }
      }
      if (ok) return c;
      c--;
    }
    return 8;
  }

  // The one panel that is not a picture: what the buttons do. Three columns on
  // a desktop — key, what it does, the pad button — and two on a phone, where
  // the gesture IS the name of the thing.
  function drawControlsPanel(ctx, x, y, w, h) {
    var rows = MOBILE ? TOUCH_KEYS : KEYS;
    var m = helpMetrics(), pad = m.pad, i;
    var keyFont = MOBILE ? MONO_S : MONO;
    var lh = Math.min(m.rowH, Math.floor((h - 22) / rows.length));
    var lx = x + pad, kw = 0;
    ctx.font = keyFont;
    for (i = 0; i < rows.length; i++) kw = Math.max(kw, ctx.measureText(rows[i][0]).width);
    var nx = lx + kw + 12;
    var padCol = MOBILE ? 0 : 74;
    var room = (x + w - pad - padCol) - nx;
    for (i = 0; i < rows.length; i++) {
      var ry = y + 6 + i * lh + lh / 2;
      text(ctx, rows[i][0], lx, ry, keyFont, INK);
      text(ctx, clip(ctx, rows[i][1], m.capFont, room), nx, ry, m.capFont, INK_DIM);
      if (!MOBILE && rows[i][2]) {
        text(ctx, rows[i][2], x + w - pad, ry, MONO_XS, '#4a5674', 'right');
      }
    }
    var foot = MOBILE
      ? 'a target is a button AND a place to let go of a piece'
      : 'right-hand column is the gamepad · the mouse works too';
    text(ctx, clip(ctx, foot, MONO_XS, w - pad * 2),
      lx, y + 6 + rows.length * lh + 10, MONO_XS, '#4a5674');
  }

  // How tall a panel actually needs to be. Portrait draws ONE panel on a page
  // and has no grid to keep, so its box is fitted to its contents and centred:
  // a fixed 624px card round a 210px board is mostly empty, and empty space on
  // a phone reads as something missing rather than as room to breathe.
  function helpNatural(ctx, panel, w, cell) {
    var m = helpMetrics(), h = m.pad * 2 + m.titleH;
    if (panel.controls) return h + 6 + (MOBILE ? TOUCH_KEYS : KEYS).length * m.rowH + 22;
    var lines = wrapLines(ctx, panel.caption, m.capFont, w - m.pad * 2, m.capMax);
    return h + CW_DEMO.size(panel.script, cell).h + 12 + lines.length * m.capLine;
  }

  function drawHelpPanel(ctx, panel, x, y, w, h, now, cell) {
    var m = helpMetrics(), pad = m.pad, i;
    ctx.fillStyle = PANEL;
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.stroke();

    text(ctx, clip(ctx, panel.title, m.titleFont, w - pad * 2),
      x + pad, y + pad + m.titleH / 2 - 2, m.titleFont, '#ffd60a');

    var top = y + pad + m.titleH;
    if (panel.controls) {
      drawControlsPanel(ctx, x, top, w, y + h - pad - top);
      return;
    }

    var lines = wrapLines(ctx, panel.caption, m.capFont, w - pad * 2, m.capMax);
    var capH = lines.length * m.capLine;
    var room = (y + h - pad - capH - 6) - top;
    var sz = CW_DEMO.size(panel.script, cell);
    CW_DEMO.draw(ctx, panel.script,
      x + Math.round((w - sz.w) / 2),
      top + Math.max(0, Math.round((room - sz.h) / 2)),
      cell, now, true);
    for (i = 0; i < lines.length; i++) {
      text(ctx, clip(ctx, lines[i], m.capFont, w - pad * 2),
        x + pad, y + h - pad - capH + i * m.capLine + m.capLine / 2, m.capFont, INK_DIM);
    }
  }

  // One page of panels, both layouts. The page number is the game's and may be
  // past the end of a layout that has since changed shape, so it is clamped
  // here rather than trusted.
  function drawHelpPage(ctx, g, now) {
    var panels = helpPanels(), gr = helpGrid(), m = helpMetrics();
    var per = gr.cols * gr.rows, pages = helpPageCount();
    var pg = Math.max(0, Math.min(pages - 1, g.helpPage | 0));
    var list = panels.slice(pg * per, pg * per + per), i;
    var cell = helpCell(list, gr.w - m.pad * 2,
      gr.h - m.pad * 2 - m.titleH - m.capMax * m.capLine - 6);

    text(ctx, 'HOW TO PLAY', W / 2, MOBILE ? 38 : 46, MONO_L, ACCENT, 'center');

    // A page that does not fill the grid is CENTRED in it rather than pinned
    // to the top left corner, so the last page — two panels where four fit —
    // reads as a short page and not as a page with two panels missing.
    var used = Math.ceil(list.length / gr.cols);
    var oy = gr.y + Math.round((gr.rows - used) * (gr.h + gr.gy) / 2);
    for (i = 0; i < list.length; i++) {
      var row = Math.floor(i / gr.cols);
      var wide = Math.min(gr.cols, list.length - row * gr.cols);
      var ox = gr.x + Math.round((gr.cols - wide) * (gr.w + gr.gx) / 2);
      var px = ox + (i % gr.cols) * (gr.w + gr.gx);
      var py = oy + row * (gr.h + gr.gy);
      var ph = gr.h;
      if (MOBILE) {
        ph = Math.min(gr.h, helpNatural(ctx, list[i], gr.w, cell));
        py += Math.round((gr.h - ph) / 2);
      }
      drawHelpPanel(ctx, list[i], px, py, gr.w, ph, now, cell);
    }

    var back = pg > 0, fwd = pg < pages - 1;
    if (MOBILE) {
      tapRow(ctx, 'help:prev', 20, 704, 110, 52, 'PREV', MONO,
        PANEL, LINE, 1, back ? INK : '#39435c');
      tapRow(ctx, 'help:next', 145, 704, 110, 52, 'NEXT', MONO,
        PANEL, LINE, 1, fwd ? INK : '#39435c');
      tapRow(ctx, 'help:back', 270, 704, 110, 52, 'DONE', MONO, '#16213a', ACCENT, 2, ACCENT);
      text(ctx, (pg + 1) + ' / ' + pages, W / 2, 780, MONO_XS, INK_DIM, 'center');
    } else {
      // The desktop gets the same three as buttons, because the mouse is a
      // supported input here (his ruling 2026-09-08) and a paged help screen
      // with no way to turn a page but a key is a trap for a mouse.
      tapRow(ctx, 'help:prev', W / 2 - 176, 616, 104, 34, '< A', MONO,
        PANEL, LINE, 1, back ? INK : '#39435c');
      tapRow(ctx, 'help:next', W / 2 - 52, 616, 104, 34, 'D >', MONO,
        PANEL, LINE, 1, fwd ? INK : '#39435c');
      tapRow(ctx, 'help:back', W / 2 + 72, 616, 104, 34, 'DONE', MONO,
        '#16213a', ACCENT, 2, ACCENT);
      text(ctx, (pg + 1) + ' / ' + pages + '   ·   SPACE or B to go back',
        W / 2, 668, MONO_S, INK_DIM, 'center');
    }
  }

  // FOUR CARDS since EVRTEK 2026-09-14 ("difficulties become Normal, Advanced
  // and Extreme", with CALM promoted to a setting of its own). Three 280px
  // cards fitted a 920px canvas with room to spare; four do not, so the card is
  // 208 wide and everything inside it had to be re-measured against that. The
  // demo survived at its full 24px cell — it is the whole reason this screen
  // exists — and the prose gave up the room: the blurb is two lines now and
  // every line is clipped to the card rather than trusted to fit.
  function drawSelect(ctx, g, now) {
    text(ctx, 'CHOOSE A DIFFICULTY', W / 2, 44, MONO_L, ACCENT, 'center');

    var d = CW_GAME.DIFFICULTY, i, j;
    var pw = 208, gap = 14, ph = 300, py = 84, pad = 8;
    var x0 = W / 2 - (d.length * pw + (d.length - 1) * gap) / 2;
    for (i = 0; i < d.length; i++) {
      var px = x0 + i * (pw + gap);
      var on = i === g.diffIndex;
      var mid = px + pw / 2, room = pw - pad * 2;
      ctx.fillStyle = on ? '#131c30' : PANEL;
      roundRect(ctx, px, py, pw, ph, 8);
      ctx.fill();
      ctx.strokeStyle = on ? '#ffd60a' : LINE;
      ctx.lineWidth = on ? 2 : 1;
      ctx.stroke();

      text(ctx, d[i].id, mid, py + 26, MONO_L, on ? '#ffd60a' : INK_DIM, 'center');

      // The tutorial. Only the highlighted one runs.
      var script = CW_DEMO.SCRIPTS[i];
      var cell = 24;
      var bw = (script.w + 2) * cell;
      CW_DEMO.draw(ctx, script, px + (pw - bw) / 2, py + 56, cell, now, on);

      text(ctx, clip(ctx, script.caption, MONO_XS, room), mid, py + 200,
        MONO_XS, on ? INK : '#4a5674', 'center');
      var bl = blurbLines(d[i].blurb);
      for (j = 0; j < bl.length && j < 2; j++) {
        text(ctx, clip(ctx, bl[j], MONO_S, room), mid, py + 226 + j * 16,
          MONO_S, INK_DIM, 'center');
      }
      text(ctx, clip(ctx, d[i].quota + ' lines a level · three levels', MONO_XS, room),
        mid, py + 262, MONO_XS, INK_DIM, 'center');
      // EVRTEK 2026-09-14: "yes, let's add a saved high score." One per
      // setting, on the card for that setting, and nothing at all until there
      // is one — an empty BEST 0 on four cards is four pieces of furniture
      // saying the player has never played.
      var best = CW_BEST.get(d[i].id);
      if (best) text(ctx, 'BEST ' + best, mid, py + 284, MONO_S, '#3ede72', 'center');
    }

    text(ctx, '< A      D >', W / 2, 410, MONO, INK_DIM, 'center');

    // EVRTEK 2026-09-07: the MAYHEM switch that sat here is off the menu for
    // now — "I have another few ideas for a more interesting two player
    // anyway." The machinery stays in the rules, unreachable from here.
    text(ctx, 'SPACE TO START   ·   B TO GO BACK', W / 2, 472, MONO_L, ACCENT, 'center');
  }

  // Portrait: the panels stack, and each one turns on its side — the words on
  // the left, the tutorial playing on the right. The whole point of this
  // screen is that you can SEE the difference between the settings, so the
  // demo survives the shrink and the prose gives up the room.
  //
  // FOUR of them since EVRTEK 2026-09-14, on a screen that is still 800 tall.
  // The panel lost twelve pixels (140 to 128) and the gap between them eight,
  // which buys the fourth slot and still leaves START and BACK where a thumb
  // expects them, at the bottom of the screen rather than floating.
  function drawSelectMobile(ctx, g, now) {
    text(ctx, 'CHOOSE A DIFFICULTY', W / 2, 36, MONO_L, ACCENT, 'center');

    var d = CW_GAME.DIFFICULTY, i, j;
    var px = 20, pw = 360, ph = 128, top = 56, gap = 8;
    for (i = 0; i < d.length; i++) {
      var py = top + i * (ph + gap), on = i === g.diffIndex;
      ctx.fillStyle = on ? '#131c30' : PANEL;
      roundRect(ctx, px, py, pw, ph, 8);
      ctx.fill();
      ctx.strokeStyle = on ? '#ffd60a' : LINE;
      ctx.lineWidth = on ? 2 : 1;
      ctx.stroke();

      // Everything on the left of the card has 228px to live in: the demo's
      // leftmost pixel is its source swatch at x 264, and the words start at
      // 36. The blurbs grew past that when the four settings arrived, so they
      // are TWO lines here as well, and every line is measured and clipped
      // rather than counted and hoped for.
      var room = 224;
      text(ctx, d[i].id, px + 16, py + 24, MONO_L, on ? '#ffd60a' : INK_DIM);
      var bl = blurbLines(d[i].blurb);
      for (j = 0; j < bl.length && j < 2; j++) {
        text(ctx, clip(ctx, bl[j], MONO_S, room), px + 16, py + 48 + j * 17, MONO_S, INK_DIM);
      }
      text(ctx, clip(ctx, d[i].quota + ' lines a level · three levels', MONO_XS, room),
        px + 16, py + 88, MONO_XS, INK_DIM);

      var script = CW_DEMO.SCRIPTS[i];
      CW_DEMO.draw(ctx, script, px + 244, py + 14, 12, now, on);

      text(ctx, clip(ctx, script.caption, MONO_XS, room), px + 16, py + 110,
        MONO_XS, on ? INK : '#4a5674');
      // The saved best for this setting (EVRTEK 2026-09-14), right-aligned
      // under the demo so it never collides with the caption.
      var best = CW_BEST.get(d[i].id);
      if (best) text(ctx, 'BEST ' + best, px + pw - 16, py + 110, MONO_XS, '#3ede72', 'right');

      hit('select:' + i, px, py, pw, ph);
    }

    // No MAYHEM row here either (off the menu, his ruling), so START and BACK
    // sit closer under the panels.
    tapRow(ctx, 'select:start', 20, 616, 360, 60, 'START', MONO_L,
      '#16213a', ACCENT, 2, ACCENT);
    tapRow(ctx, 'select:back', 20, 690, 360, 48, 'BACK', MONO, PANEL, LINE, 1, INK_DIM);
  }

  // What the result card says about the saved best. EVRTEK 2026-09-14: "yes,
  // let's add a saved high score." NEW BEST only when THIS run set it — the
  // record is stamped by main.js on the frame the run ended, and it carries
  // the difficulty it was set on, so a card can never claim a best that was
  // set on a different setting. Otherwise the standing best, quietly; and
  // nothing at all on the first run of a device, where a "BEST 0" would be
  // the card's way of saying nothing twice.
  function bestLine(g) {
    var r = CW_BEST.last();
    if (r && r.diffId === g.diff().id && r.isNew) {
      return { text: 'NEW BEST   ' + r.best, ink: '#ffd60a' };
    }
    var b = CW_BEST.get(g.diff().id);
    return b ? { text: 'BEST   ' + b, ink: INK_DIM } : null;
  }

  function drawGameOver(ctx, g) {
    // The card owns the screen, so it owns the touch targets too. This used to
    // be the portrait card's problem alone, because the desktop play screen
    // registered no rects at all — until the strip arrived (EVRTEK 2026-09-14)
    // and gave the desktop three, which the mouse reaches through the same
    // touch code. A live SHRED under a game-over card is exactly the class of
    // bug Tron's patrol went looking for.
    hits.length = 0;
    ctx.fillStyle = 'rgba(6,9,16,0.93)';
    ctx.fillRect(0, 0, W, H);
    // EVRTEK 2026-09-08: the rig can be FINISHED now, so this card has two
    // faces. Everything under the top two lines is the same either way — the
    // score, the keystones, the seed and the buttons are exactly where they
    // have always been. A win changes what the headline says, changes its
    // colour from the red to the accent, and adds the one line underneath it
    // that says what was completed.
    var y = 180;
    text(ctx, g.won ? 'RIG COMPLETE' : 'OUT OF TIME', W / 2, y, TITLE,
      g.won ? ACCENT : '#ff3b30', 'center');
    if (g.won) {
      text(ctx, g.diff().id + ' · ' + g.delivered + ' LINES WIRED',
        W / 2, y + 26, MONO, ACCENT, 'center');
    }
    // On a win the sub-line above has already said the difficulty and the
    // count, so this row is the score and nothing else rather than printing
    // "30 WIRED" twice in twenty pixels.
    text(ctx, g.won ? 'SCORE  ' + g.score
      : 'SCORE  ' + g.score + '   ·   LEVEL ' + g.level + '   ·   ' + g.delivered + ' WIRED',
      W / 2, y + 46, MONO_L, INK, 'center');
    text(ctx, g.keystones + ' KEYSTONE' + (g.keystones === 1 ? '' : 'S'),
      W / 2, y + 76, MONO, g.keystones ? '#ffd60a' : INK_DIM, 'center');
    var bl = bestLine(g);
    if (bl) text(ctx, bl.text, W / 2, y + 102, MONO_L, bl.ink, 'center');
    text(ctx, g.diff().id + (g.mayhem ? '  ·  MAYHEM' : '') +
      '   ·   SEED ' + g.seed.toString(36).toUpperCase(),
      W / 2, y + 128, MONO, INK_DIM, 'center');
    text(ctx, 'SPACE TO GO AGAIN   ·   B FOR THE TITLE', W / 2, y + 174, MONO, ACCENT, 'center');
  }

  function drawGameOverMobile(ctx, g) {
    // The card owns the screen, so it owns the touch targets too: the play
    // buttons underneath it are painted over and must stop answering.
    hits.length = 0;
    ctx.fillStyle = 'rgba(6,9,16,0.93)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, g.won ? 'RIG COMPLETE' : 'OUT OF TIME', W / 2, 240, TITLE,
      g.won ? ACCENT : '#ff3b30', 'center');
    if (g.won) {
      text(ctx, g.diff().id + ' · ' + g.delivered + ' LINES WIRED',
        W / 2, 266, MONO, ACCENT, 'center');
    }
    text(ctx, 'SCORE  ' + g.score, W / 2, 290, MONO, INK, 'center');
    // Same as the desktop card: a win has already said the level and the count
    // on the line under the headline, so this row keeps only the keystones.
    text(ctx, (g.won ? '' : 'LEVEL ' + g.level + '  ·  ' + g.delivered + ' WIRED  ·  ') +
      g.keystones + ' KEYSTONE' + (g.keystones === 1 ? '' : 'S'),
      W / 2, 316, MONO, g.keystones ? '#ffd60a' : INK_DIM, 'center');
    var blm = bestLine(g);
    if (blm) text(ctx, blm.text, W / 2, 344, MONO_L, blm.ink, 'center');
    text(ctx, g.diff().id + (g.mayhem ? '  ·  MAYHEM' : '') +
      '   ·   SEED ' + g.seed.toString(36).toUpperCase(),
      W / 2, 374, MONO_XS, INK_DIM, 'center');
    tapRow(ctx, 'over:again', 20, 520, 360, 60, 'AGAIN', MONO_L,
      '#16213a', ACCENT, 2, ACCENT);
    tapRow(ctx, 'over:title', 20, 600, 360, 48, 'TITLE', MONO, PANEL, LINE, 1, INK_DIM);
  }

  // EVRTEK 2026-09-07: portrait only. Landscape gets a card and nothing else
  // — the board is twenty rows tall and there is no honest way to lie it on
  // its side, so the game asks rather than pretending.
  function drawRotate(ctx) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    // Not a small card on a black screen (Tron): the same field of current as
    // the title, and the wordmark, so it reads as the game asking.
    drawTitleAmbience(ctx);
    text(ctx, 'C R O S S W I R E', W / 2, H / 2 - 120,
      '700 30px Consolas, "Courier New", monospace', ACCENT, 'center');
    var cw = Math.min(W - 40, 360), x = W / 2 - cw / 2, y = H / 2 - 60;
    ctx.fillStyle = PANEL;
    roundRect(ctx, x, y, cw, 120, 10);
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.stroke();
    text(ctx, 'TURN YOUR PHONE', W / 2, y + 48, MONO_L, ACCENT, 'center');
    text(ctx, 'CROSSWIRE plays upright', W / 2, y + 78, MONO_S, INK_DIM, 'center');
  }

  function vignette(ctx, x, y, w, h) {
    var gr = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.45,
                                      x + w / 2, y + h / 2, Math.max(w, h) * 0.78);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = gr;
    ctx.fillRect(x, y, w, h);
  }

  function draw(ctx, g, pads) {
    // The touch targets are rebuilt from nothing every frame by the same code
    // that paints them. There is one set of numbers, not two.
    hits.length = 0;
    if (g.screen !== 'title') titleT0 = 0;   // so the wordmark powers on again next visit
    if (rotatePrompt) { drawRotate(ctx); return; }

    if (g.screen === 'title') {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      drawTitleAmbience(ctx);
      drawInner(ctx, g, pads, true);
      // No key hints on a phone: there are no keys.
      if (!MOBILE) {
        text(ctx, 'M  music   ·   G  colourblind symbols',
          W / 2, H - 104, MONO_S, INK_DIM, 'center');
      }
      return;
    }
    if (g.screen === 'play') computeFlow(g.board);
    var sh = (g.screen === 'play' && g.shake > 0) ? g.shake : 0;
    ctx.save();
    if (sh > 0) ctx.translate((Math.random() - 0.5) * 7 * sh, (Math.random() - 0.5) * 7 * sh);
    drawInner(ctx, g, pads, false);
    if (g.screen === 'play') {
      // Slabs leaving before slabs arriving: on a surge both happen at once and
      // the one going up is the older news.
      //
      // BOTH INSIDE THE GRID'S WINDOW (Tron's M3): a slab in flight is the only
      // thing on this screen drawn outside the square it occupies, and the lift
      // takes it clean over the chrome above the board. One clip round the pair
      // of them, because a rising slab leaves by the same door an arriving one
      // comes in through. See slabClip.
      ctx.save();
      slabClip(ctx, g.board);
      drawRising(ctx, g);
      drawIncoming(ctx, g);
      ctx.restore();
      vignette(ctx, GRID_X - 4, GRID_Y - 4, g.board.w * CELL + 8, g.board.h * CELL + 8);
      // Over the vignette, because the fragments leave the board entirely and
      // half of their flight is across chrome that is not dimmed.
      drawShreds(ctx, g);
    }
    ctx.restore();
  }

  function drawInner(ctx, g, pads, keepBg) {
    var now = Date.now() / 1000;
    if (!keepBg) ctx.fillStyle = BG; else ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, W, H);

    if (g.screen === 'title') {
      if (MOBILE) { drawTitleMobile(ctx, g); drawToastsMobile(ctx, g, 600); }
      else { drawTitle(ctx, g); drawToasts(ctx, g); }
      return;
    }
    if (g.screen === 'help') {
      // One drawing for both cabinets since ruling 108: the lesson panels are
      // the same panels either way, only laid out and paged differently.
      drawHelpPage(ctx, g, now);
      return;
    }
    if (g.screen === 'select') {
      if (MOBILE) drawSelectMobile(ctx, g, now); else drawSelect(ctx, g, now);
      return;
    }

    if (MOBILE) drawHudMobile(ctx, g); else drawHud(ctx, g, pads);
    drawBars(ctx, g);
    drawGrid(ctx, g);
    drawSources(ctx, g);
    drawTargets(ctx, g);
    drawFlashes(ctx, g);
    drawGhost(ctx, g);
    drawPops(ctx, g);
    drawFlares(ctx, g);
    drawBanner(ctx, g);
    drawCallout(ctx, g);
    // The strip is chrome under the board and belongs to BOTH layouts, which
    // is why it is drawn here rather than inside either branch below.
    drawStrip(ctx, g);
    if (MOBILE) {
      drawFeedMobile(ctx, g);
      drawControls(ctx, g);
      drawBugsMobile(ctx, g);
      drawToastsMobile(ctx, g, L.toastY);
    } else {
      drawFeed(ctx, g);
      drawBugs(ctx, g);
      drawToasts(ctx, g);
    }
    if (g.over) { if (MOBILE) drawGameOverMobile(ctx, g); else drawGameOver(ctx, g); }
  }

  function toggleSymbols() { showSymbols = !showSymbols; }
  function setRotatePrompt(v) { rotatePrompt = !!v; }

  // W and H were constants and are now layout fields, so they go out as
  // FUNCTIONS: an exported number would be whatever the layout happened to be
  // at load and would go stale the moment the cabinet changed shape.
  return {
    draw: draw,
    setLayout: setLayout,
    layout: function () { return L; },
    width: function () { return W; },
    height: function () { return H; },
    hits: function () { return hits; },
    setRotatePrompt: setRotatePrompt,
    helpPageCount: helpPageCount,
    toggleSymbols: toggleSymbols
  };
})();
