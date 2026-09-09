'use strict';
// CROSSWIRE — the piece set.
//
// EVRTEK'S LAW of 2026-09-06 was that no piece may be an exact copy of a
// Tetris piece, enforced structurally: no piece had four cells. HE LIFTED IT
// 2026-09-07 — "I think we're far enough removed from tetris that we can use
// some 4 tile pieces" — and named the one he wanted: the Z, as a way to
// correct a build that has ended up one row out.
//
// So there are now two of them, ZAG and ZIG, because a Z alone only corrects
// downward and being one row out happens in both directions. They are the
// only four-cell pieces, and they exist for a job rather than for variety.
//
// A piece is a footprint plus WIRING. Two pieces can share a footprint and be
// different pieces, because what matters is what the wire does inside.
//
// Each cell carries a list of NODES. A node is one electrically continuous
// thing inside that cell:
//   { e: ['W','E'] }   a conductor joining those edges. NOTHING HERE HAS A
//                      DIRECTION. Evrtek 2026-09-07, after a playtest: a
//                      junction stays undirected until a source or a demand is
//                      connected to it, and only then does flow resolve.
//
// So a piece is not a mixer or a wire by declaration. A node with THREE OR MORE
// ways is a junction, and a junction mixes what arrives and splits what leaves.
// A node with two is plain wire, and two colours meeting in plain wire is a
// SHORT. That is the whole rule, and it is why every piece rotates freely.
var CW_PIECES = (function () {

  var CW_ROT = { N: 'E', E: 'S', S: 'W', W: 'N' };

  // EVRTEK 2026-09-08, after playing the phone build: "let's increase the piece
  // rates of the 2 & 3 line straight lines to appear 25% more frequently than
  // current state", and "let's reduce the u-shape and 5 block cross piece
  // frequency by 10%." Those are LINK and RUN, YOKE and JUNCTION.
  //
  // He asked for FREQUENCY, and `weight` is not frequency: bag.js layers a size
  // tilt, a run cap, a small-piece drought and a JUNCTION DROUGHT on top of the
  // draw, and the last of those puts a floor under YOKE and JUNCTION that
  // resists a smaller weight — cutting their weights by a flat ten percent
  // moves their share by about four. So the weights below were MEASURED to his
  // numbers rather than scaled to them: 40,000 draws, seed 4242, the same feed
  // the harness runs, solved until every one landed inside a percent of target.
  //
  //   piece      weight        share of the feed        asked
  //   LINK       12 -> 16.5    11.12% -> 13.89%         x1.25  (hit x1.250)
  //   RUN        10 -> 13.5     8.46% -> 10.53%         x1.25  (hit x1.244)
  //   YOKE        7 ->  6.85    4.62% ->  4.15%         x0.90  (hit x0.898)
  //   JUNCTION    5 ->  4.9     3.48% ->  3.13%         x0.90  (hit x0.897)
  //
  // Nothing else moved, so the other ten pieces give up the difference between
  // them: the biggest single loser is KNEE, 13.39% -> 12.67%. Decimals are on
  // purpose — the pool is a weighted draw over floats and there is no rounder
  // number that lands inside his tolerance once the droughts have had their
  // say. The harness re-measures all four at that seed, so a change anywhere in
  // bag.js that quietly moves them fails rather than drifts.

  // Every definition is written in its home rotation and rotated at runtime.
  var DEFS = [
    {
      id: 'PIN', name: 'PIN', weight: 10,
      cells: [[0, 0]],
      wire: [[{ e: ['W', 'E'] }]]
    },
    {
      id: 'KNEE', name: 'KNEE', weight: 12,
      cells: [[0, 0]],
      wire: [[{ e: ['W', 'S'] }]]
    },
    {
      // Three ways in one cell, so it mixes and splits. The compact junction.
      id: 'VALVE', name: 'VALVE', weight: 10,
      cells: [[0, 0]],
      wire: [[{ e: ['W', 'E', 'S'] }]]
    },
    {
      id: 'LINK', name: 'LINK', weight: 16.5,
      cells: [[0, 0], [1, 0]],
      wire: [[{ e: ['W', 'E'] }], [{ e: ['W', 'E'] }]]
    },
    {
      id: 'RUN', name: 'RUN', weight: 13.5,
      cells: [[0, 0], [1, 0], [2, 0]],
      wire: [[{ e: ['W', 'E'] }], [{ e: ['W', 'E'] }], [{ e: ['W', 'E'] }]]
    },
    {
      id: 'BEND', name: 'BEND', weight: 12,
      cells: [[0, 0], [1, 0], [1, 1]],
      wire: [[{ e: ['W', 'E'] }], [{ e: ['W', 'S'] }], [{ e: ['N', 'S'] }]]
    },
    {
      // A three-way with a longer body, so the third way starts a cell over.
      id: 'TEE', name: 'TEE', weight: 8,
      cells: [[0, 0], [1, 0], [1, 1]],
      wire: [[{ e: ['W', 'E'] }], [{ e: ['W', 'E', 'S'] }], [{ e: ['N', 'S'] }]]
    },
    {
      // THE ONLY PIECE THAT JUMPS (Evrtek, 2026-09-06). A SPAN may be laid
      // across an existing wire and pass over it without touching, but only
      // where it shares no edge with what is underneath, which is exactly
      // "crossing perpendicular". Nothing else on the board can do this, so a
      // SPAN is the answer to a wire in the way.
      id: 'SPAN', name: 'SPAN', weight: 6, jumps: true,
      cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
      wire: [[{ e: ['W', 'E'] }], [{ e: ['W', 'E'] }], [{ e: ['W', 'E'] }],
             [{ e: ['W', 'E'] }], [{ e: ['W', 'E'] }]]
    },
    {
      // U pentomino with a third way out of the closed end. The widest
      // junction: two prongs and an outflow, and it still ducks around whatever
      // is sitting in the notch.
      id: 'YOKE', name: 'YOKE', weight: 6.85,
      cells: [[0, 0], [1, 0], [1, 1], [1, 2], [0, 2]],
      wire: [[{ e: ['W', 'E'] }], [{ e: ['W', 'S'] }],
             [{ e: ['N', 'S', 'E'] }],
             [{ e: ['N', 'W'] }], [{ e: ['W', 'E'] }]]
    },
    {
      // X pentomino. The centre is a FOUR-way junction, so it mixes and splits
      // like the rest (Evrtek 2026-09-07). Bridging belongs to the SPAN.
      // EVRTEK 2026-09-07: the realign pieces. A run that has come out one row
      // short of its demand can be nudged onto the right line with one piece
      // instead of a corner, a straight and another corner. ZAG steps DOWN as
      // it runs east, ZIG steps UP.
      id: 'ZAG', name: 'ZAG', weight: 8,
      cells: [[0, 0], [1, 0], [1, 1], [2, 1]],
      wire: [[{ e: ['W', 'E'] }], [{ e: ['W', 'S'] }],
             [{ e: ['N', 'E'] }], [{ e: ['W', 'E'] }]]
    },
    {
      id: 'ZIG', name: 'ZIG', weight: 8,
      cells: [[0, 1], [1, 1], [1, 0], [2, 0]],
      wire: [[{ e: ['W', 'E'] }], [{ e: ['W', 'N'] }],
             [{ e: ['S', 'E'] }], [{ e: ['W', 'E'] }]]
    },
    {
      id: 'JUNCTION', name: 'JUNCTION', weight: 4.9,
      cells: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
      wire: [[{ e: ['N', 'S'] }], [{ e: ['W', 'E'] }],
             [{ e: ['N', 'E', 'S', 'W'] }],
             [{ e: ['W', 'E'] }], [{ e: ['N', 'S'] }]]
    }
  ];

  function rotEdge(e, times) {
    for (var i = 0; i < times; i++) e = CW_ROT[e];
    return e;
  }

  function rotNode(node, times) {
    return { e: node.e.map(function (e) { return rotEdge(e, times); }) };
  }

  // (x,y) -> (-y,x) per quarter turn, then shifted back into the corner.
  function rotateShape(def, times) {
    var cells = def.cells.map(function (c) { return [c[0], c[1]]; });
    var wire = def.wire.map(function (nodes) {
      return nodes.map(function (n) { return rotNode(n, times); });
    });
    for (var t = 0; t < times; t++) {
      cells = cells.map(function (c) { return [-c[1], c[0]]; });
    }
    var minX = Math.min.apply(null, cells.map(function (c) { return c[0]; }));
    var minY = Math.min.apply(null, cells.map(function (c) { return c[1]; }));
    cells = cells.map(function (c) { return [c[0] - minX, c[1] - minY]; });
    var w = Math.max.apply(null, cells.map(function (c) { return c[0]; })) + 1;
    var h = Math.max.apply(null, cells.map(function (c) { return c[1]; })) + 1;
    return { cells: cells, wire: wire, w: w, h: h };
  }

  // An identity that does not care what order the edges happen to be listed
  // in. Without this a PIN reports four rotations because ['W','E'] and
  // ['E','W'] stringify differently, and the player presses rotate twice for
  // nothing.
  function shapeKey(s) {
    var parts = s.cells.map(function (c, i) {
      var nodes = s.wire[i].map(function (n) {
        return 'P' + n.e.slice().sort().join('');
      }).sort().join('+');
      return c[0] + ',' + c[1] + '=' + nodes;
    });
    return parts.sort().join('|');
  }

  // Distinct rotations only, so a PIN does not waste two of its four presses.
  // With nothing directional left, EVERY piece rotates (Evrtek 2026-09-07);
  // a piece with one entry here is one that is genuinely symmetric.
  function buildRotations(def) {
    var out = [], seen = {};
    for (var t = 0; t < 4; t++) {
      var s = rotateShape(def, t);
      var key = shapeKey(s);
      if (seen[key]) continue;
      seen[key] = true;
      out.push(s);
    }
    return out;
  }

  // EVRTEK'S RULING 2026-09-07: the cursor was the top-left of the bounding
  // BOX, and on some pieces that square is not part of the piece at all — the
  // four-way's corner is empty, and so is ZIG's. Pointing at a square you are
  // not standing on is nonsense, so every piece now names ONE OF ITS OWN CELLS
  // as the handle, and it is drawn differently so you can see which.
  //
  // The handle is the cell nearest the piece's middle. Two reasons: it keeps
  // the unreachable area down to the corners rather than a whole quadrant (a
  // handle on one end of a five-long piece cannot get near two edges at once),
  // and on every piece that carries a junction it lands ON that junction,
  // which makes the marker mean something rather than just being a dot.
  //
  // It is an INDEX, so it rotates with the piece: rotateShape keeps cell order,
  // and the same index is a real cell in every rotation.
  function targetIndex(def) {
    var cells = def.cells, n = cells.length, i, d;
    var mx = 0, my = 0;
    for (i = 0; i < n; i++) { mx += cells[i][0]; my += cells[i][1]; }
    mx /= n; my /= n;
    var best = 0, bd = Infinity;
    for (i = 0; i < n; i++) {
      d = (cells[i][0] - mx) * (cells[i][0] - mx) + (cells[i][1] - my) * (cells[i][1] - my);
      if (d < bd - 1e-9) { bd = d; best = i; }
    }
    return best;
  }

  var BY_ID = {};
  var LIST = DEFS.map(function (def) {
    var p = {
      id: def.id, name: def.name, weight: def.weight,
      jumps: !!def.jumps,
      mixes: def.wire.some(function (nodes) { return nodes.some(function (n) { return n.e.length >= 3; }); }),
      size: def.cells.length,
      target: targetIndex(def),
      rotations: buildRotations(def)
    };
    BY_ID[def.id] = p;
    return p;
  });

  // Asserted at boot rather than trusted: a handle that is not on the piece is
  // the exact bug this replaced.
  for (var t = 0; t < LIST.length; t++) {
    var lp = LIST[t];
    for (var rr = 0; rr < lp.rotations.length; rr++) {
      if (!lp.rotations[rr].cells[lp.target]) {
        throw new Error('CROSSWIRE: ' + lp.id + ' rotation ' + rr + ' has no handle cell');
      }
    }
  }

  function get(id) { return BY_ID[id]; }

  // Where the handle sits inside one rotation, as [x, y] within the shape.
  function targetCell(piece, rot) {
    var shape = piece.rotations[rot % piece.rotations.length];
    return shape.cells[piece.target];
  }

  return { LIST: LIST, get: get, rotEdge: rotEdge, targetCell: targetCell };
})();
