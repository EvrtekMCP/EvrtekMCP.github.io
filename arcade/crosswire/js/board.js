'use strict';
// CROSSWIRE — the board.
//
// A board is DATA, and that is the whole reason two modes are one game. Solo
// and MIRROR MATCH use this shape with one owner; the shared ONE BOARD mode is
// the same object, wider, with demands owned by two players.
//
// Ownership lives on the NODE, not the cell. That is what lets a SPAN jump
// over an existing wire: the two pieces share a square and stay electrically
// unaware of each other, and either can be removed without touching the other.
var CW_BOARD = (function () {

  var DX = { N: 0, E: 1, S: 0, W: -1 };
  var DY = { N: -1, E: 0, S: 1, W: 0 };
  var OPP = { N: 'S', E: 'W', S: 'N', W: 'E' };

  function Board(w, h) {
    this.w = w;
    this.h = h;
    this.cells = new Array(w * h);   // null | {nodes:[], dead:bool, origin?}
    this.sources = [];               // {row, colour}
    this.targets = [];               // {row, colour, owner}
    this._serial = 0;
    for (var i = 0; i < w * h; i++) this.cells[i] = null;
  }

  Board.prototype.idx = function (x, y) { return y * this.w + x; };
  Board.prototype.inside = function (x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  };
  Board.prototype.at = function (x, y) {
    return this.inside(x, y) ? this.cells[this.idx(x, y)] : null;
  };

  function edgesOf(node) { return node.e; }

  // Everything a piece's cell would occupy, as a flat edge list.
  function shapeEdges(nodes) {
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var e = edgesOf(nodes[i]);
      for (var j = 0; j < e.length; j++) out.push(e[j]);
    }
    return out;
  }

  // A placement is legal when every cell lands on the board and every cell is
  // free. Connection is NOT required: building an island and wiring it up
  // later is most of the strategy.
  //
  // The exception is a JUMPING piece. A SPAN may lie across an existing wire,
  // but only where it shares no edge with it, which is exactly what "crossing
  // perpendicular" means. It can never cross a blocker.
  Board.prototype.canPlace = function (piece, rot, ox, oy) {
    var shape = piece.rotations[rot % piece.rotations.length];
    for (var i = 0; i < shape.cells.length; i++) {
      var x = ox + shape.cells[i][0], y = oy + shape.cells[i][1];
      if (!this.inside(x, y)) return false;
      var c = this.cells[this.idx(x, y)];
      if (!c) continue;
      if (c.dead || !piece.jumps) return false;
      var mine = shapeEdges(shape.wire[i]);
      for (var n = 0; n < c.nodes.length; n++) {
        var theirs = edgesOf(c.nodes[n]);
        for (var a = 0; a < theirs.length; a++) {
          if (mine.indexOf(theirs[a]) >= 0) return false;
        }
      }
    }
    return true;
  };

  Board.prototype.place = function (piece, rot, ox, oy, owner) {
    var shape = piece.rotations[rot % piece.rotations.length];
    if (!this.canPlace(piece, rot, ox, oy)) return false;
    var origin = 'p' + (++this._serial);
    for (var i = 0; i < shape.cells.length; i++) {
      var x = ox + shape.cells[i][0], y = oy + shape.cells[i][1];
      var k = this.idx(x, y);
      if (!this.cells[k]) this.cells[k] = { nodes: [], dead: false };
      var cell = this.cells[k];
      for (var n = 0; n < shape.wire[i].length; n++) {
        cell.nodes.push({
          e: shape.wire[i][n].e.slice(),
          origin: origin,
          piece: piece.id,
          owner: owner || 0,
          jumped: cell.nodes.length > 0,   // it is lying over something
          colour: 0,
          short: false,
          ports: null,
          ins: null
        });
      }
    }
    return { origin: origin };
  };

  // Removing any part of a piece removes all of it. Half a BEND is not a
  // thing, and stranded stubs would be unreadable.
  Board.prototype.removeOrigin = function (origin) {
    var cells = 0;
    for (var i = 0; i < this.cells.length; i++) {
      var c = this.cells[i];
      if (!c) continue;
      if (c.dead) {
        if (c.origin === origin) { this.cells[i] = null; cells++; }
        continue;
      }
      var before = c.nodes.length;
      c.nodes = c.nodes.filter(function (n) { return n.origin !== origin; });
      if (c.nodes.length !== before) {
        if (!c.nodes.length) { this.cells[i] = null; }
        cells++;
      }
    }
    return cells;
  };

  Board.prototype.originsAt = function (x, y) {
    var c = this.at(x, y);
    if (!c) return [];
    if (c.dead) return [c.origin];
    var out = [];
    for (var i = 0; i < c.nodes.length; i++) {
      if (out.indexOf(c.nodes[i].origin) < 0) out.push(c.nodes[i].origin);
    }
    return out;
  };

  // EVRTEK'S RULING 2026-09-07: the destructor takes only what it touches, so
  // there must be a way to remove ONE cell without the rest of its piece going
  // with it. Half a BEND is now a legal thing to have on the board: a stub
  // that carries nothing until something is wired back onto it. That is the
  // whole point of a surgical cut, and it is what lets a three-cell correction
  // fix a mistake instead of costing the whole run.
  Board.prototype.clearCell = function (x, y) {
    if (!this.at(x, y)) return 0;
    this.cells[this.idx(x, y)] = null;
    return 1;
  };

  Board.prototype.removeAt = function (x, y) {
    var origins = this.originsAt(x, y), n = 0;
    for (var i = 0; i < origins.length; i++) n += this.removeOrigin(origins[i]);
    return n;
  };

  // EVRTEK'S RULING 2026-09-06, revised 09-07: blockers are a 2x2 slab and
  // there are MORE of them — a 4x4 was a wall rather than an obstacle, and
  // small ones scattered around make a board you have to route through instead
  // of one you have to route past. Never in the first or last column, because
  // a blocker there can permanently wall off a source or a demand, and that is
  // not difficulty.
  Board.prototype.placeBlocker = function (x, y, size) {
    size = size || 2;
    if (x < 1 || y < 0 || x + size > this.w - 1 || y + size > this.h) return 0;
    var origin = 'blk' + (++this._serial), took = 0;
    for (var dy = 0; dy < size; dy++) {
      for (var dx = 0; dx < size; dx++) {
        var cx = x + dx, cy = y + dy;
        var existing = this.at(cx, cy);
        if (existing) took += this.removeAt(cx, cy);
        this.cells[this.idx(cx, cy)] = { nodes: [], dead: true, origin: origin };
      }
    }
    return took;
  };

  // Where a slab of this size could legally land, top-left corners only.
  //
  // Spots that would land ON an existing slab are held back and only offered
  // if there is nowhere else: a new slab absorbs whatever it covers, so five
  // slabs landing at once could otherwise arrive as three. Wire underneath is
  // fair game — that is the obstacle doing its job.
  Board.prototype.blockerSpots = function (size) {
    size = size || 2;
    var out = [], last = [], x, y, dx, dy, onSlab, c;
    for (y = 0; y + size <= this.h; y++) {
      for (x = 1; x + size <= this.w - 1; x++) {
        onSlab = false;
        for (dy = 0; dy < size && !onSlab; dy++) {
          for (dx = 0; dx < size; dx++) {
            c = this.at(x + dx, y + dy);
            if (c && c.dead) { onSlab = true; break; }
          }
        }
        (onSlab ? last : out).push([x, y]);
      }
    }
    return out.length ? out : last;
  };

  Board.prototype.emptyCells = function () {
    var out = [];
    for (var y = 0; y < this.h; y++) {
      for (var x = 0; x < this.w; x++) if (!this.cells[this.idx(x, y)]) out.push([x, y]);
    }
    return out;
  };

  // Does this cell expose a wire on that edge, and on which node? Two nodes in
  // one cell can never claim the same edge, so this answer is unambiguous.
  Board.prototype.nodeOnEdge = function (x, y, edge) {
    var c = this.at(x, y);
    if (!c || c.dead) return -1;
    for (var i = 0; i < c.nodes.length; i++) {
      if (edgesOf(c.nodes[i]).indexOf(edge) >= 0) return i;
    }
    return -1;
  };

  return { Board: Board, DX: DX, DY: DY, OPP: OPP };
})();
