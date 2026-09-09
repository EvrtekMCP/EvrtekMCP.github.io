'use strict';
// CROSSWIRE — power.
//
// EVRTEK'S RULING, 2026-09-07, after a playtest: "can we make mixer valves
// remain without a direction until either a source or a target are connected
// to it? The directional flow is only established at the point where enough of
// those situations is true."
//
// So NOTHING on the board is directional by declaration. A piece is not a
// mixer because it says so; it is a junction because it has three or more ways
// out of one cell. Direction resolves at solve time from what is actually
// connected, which is the difference between a rule a player has to be taught
// and one they can see.
//
//   PLAIN WIRE is a node with two ways. Everything joined edge to edge is one
//   NET carrying exactly one colour, and two different colours arriving is a
//   SHORT: the run sparks and burns away on the next pulse.
//
//   A JUNCTION is a node with three or more ways. Any way that has a colour
//   arriving is an INPUT; every other way is an OUTPUT.
//
// EVRTEK'S RULING 2026-09-07, third pass: WHAT A JUNCTION DOES WITH TWO
// COLOURS IS THE PLAYER'S CHOICE, not the board's guess.
//
//   Every junction lands as a SPLITTER (drawn "S"). It carries ONE colour —
//   the one arriving from whichever input is nearest the power — and puts that
//   on every output. A second colour arriving is simply not taken up.
//
//   Pressing commit on it toggles it to a MIXER (drawn "M"). A mixer takes
//   every input and puts the BLEND on every output.
//
// With one input the two modes are identical, which is why S is the safe
// default: a junction cannot mix by accident any more, and the letter on the
// piece says which it is without the player having to read the colours
// downstream to find out.
//
// AND SHORTS NARROWED, same ruling: a short is now exactly TWO DIFFERENTLY
// COLOURED SOURCES ON ONE RUN OF PLAIN WIRE. A junction always breaks a run in
// two, so a line with a junction on it cannot short — whatever a junction puts
// out is its own business and never fights a source, because a way with a
// source-fed net on the far side is an input and a junction never pushes into
// its own input.
//
// Junctions are settled one at a time, NEAREST THE SOURCES FIRST, so the first
// junction the power actually reaches owns the stretch of wire beyond it. See
// build() for how that order is worked out and solve() for why it matters.
var CW_POWER = (function () {

  var DX = CW_BOARD.DX, DY = CW_BOARD.DY, OPP = CW_BOARD.OPP;

  function key(x, y, i) { return x + ':' + y + ':' + i; }
  function isJunction(node) { return node.e.length >= 3; }

  // Every junction lands as a SPLITTER. Nothing writes the mode until the
  // player toggles it, so an older board reads as all-splitters rather than
  // needing migrating.
  function mode(node) { return node.mode === 'M' ? 'M' : 'S'; }
  function setMode(node, m) {
    if (!isJunction(node)) return null;
    node.mode = (m === 'M') ? 'M' : 'S';
    return node.mode;
  }
  function toggleMode(node) { return setMode(node, mode(node) === 'M' ? 'S' : 'M'); }

  // ---- structure ----------------------------------------------------------

  function build(board) {
    var parent = {}, plains = [], juncs = [], juncBy = {}, at = {};
    function root(k) { while (parent[k] !== k) { parent[k] = parent[parent[k]]; k = parent[k]; } return k; }
    function union(a, b) { a = root(a); b = root(b); if (a !== b) parent[a] = b; }

    var x, y, i, c;
    for (y = 0; y < board.h; y++) {
      for (x = 0; x < board.w; x++) {
        c = board.at(x, y);
        if (!c || c.dead) continue;
        for (i = 0; i < c.nodes.length; i++) {
          var k = key(x, y, i);
          at[k] = { x: x, y: y, i: i, node: c.nodes[i] };
          if (isJunction(c.nodes[i])) {
            var j = { key: k, x: x, y: y, i: i, node: c.nodes[i], nb: {}, n: juncs.length };
            juncs.push(j);
            juncBy[k] = j;
          } else {
            parent[k] = k;
            plains.push(at[k]);
          }
        }
      }
    }

    // Plain joined to plain is one net. A junction is a boundary between nets.
    for (var p = 0; p < plains.length; p++) {
      var pl = plains[p];
      for (var e = 0; e < pl.node.e.length; e++) {
        var d = pl.node.e[e];
        var nx = pl.x + DX[d], ny = pl.y + DY[d];
        var nj = board.nodeOnEdge(nx, ny, OPP[d]);
        if (nj < 0) continue;
        if (!isJunction(board.at(nx, ny).nodes[nj])) union(key(pl.x, pl.y, pl.i), key(nx, ny, nj));
      }
    }

    // What sits on the far side of each of a junction's ways.
    for (var q = 0; q < juncs.length; q++) {
      var jn = juncs[q];
      for (var ee = 0; ee < jn.node.e.length; ee++) {
        var dd = jn.node.e[ee];
        var ax = jn.x + DX[dd], ay = jn.y + DY[dd];
        var aj = board.nodeOnEdge(ax, ay, OPP[dd]);
        if (aj < 0) { jn.nb[dd] = null; continue; }
        var an = board.at(ax, ay).nodes[aj];
        jn.nb[dd] = isJunction(an)
          ? { junction: key(ax, ay, aj), edge: OPP[dd] }
          : { net: root(key(ax, ay, aj)) };
      }
    }

    // Sources push into column 0.
    var netSources = {}, juncSources = {};
    for (var s = 0; s < board.sources.length; s++) {
      var src = board.sources[s];
      var ni = board.nodeOnEdge(0, src.row, 'W');
      if (ni < 0) continue;
      var sk = key(0, src.row, ni);
      if (isJunction(board.at(0, src.row).nodes[ni])) {
        (juncSources[sk] = juncSources[sk] || {}).W =
          CW_COLOUR.blend((juncSources[sk] || {}).W || 0, src.colour);
      } else {
        var r = root(sk);
        (netSources[r] = netSources[r] || []).push(src.colour);
      }
    }

    // EVRTEK 2026-09-07: "the act of mixing should follow SHORTEST ROUTE FIRST
    // up to the final mixer before a target." With several junctions in a row,
    // board order was deciding which one owned the wire between them, and board
    // order has nothing to do with where the power came from. So the junctions
    // are ordered by how far the power has to travel to reach them, nearest
    // first: a plain breadth-first walk out from the sources over nets and
    // junctions alike. The junction closest to a source resolves first and the
    // rest fall in behind it, which is the order a player traces with a finger.
    // Ties break on board order, so a solve is still deterministic.
    var adj = {}, hops = {}, queue = [], seen = {}, qi, cur, out, oi, nxt;
    function link(a, b) { (adj[a] = adj[a] || []).push(b); }
    for (var t = 0; t < juncs.length; t++) {
      var jt = juncs[t];
      for (var te = 0; te < jt.node.e.length; te++) {
        var tb = jt.nb[jt.node.e[te]];
        if (!tb) continue;
        var id = tb.net ? 'n' + root(tb.net) : tb.junction;
        link(jt.key, id);
        link(id, jt.key);
      }
    }
    for (var ns in netSources) if (netSources.hasOwnProperty(ns)) queue.push('n' + root(ns));
    for (var js in juncSources) if (juncSources.hasOwnProperty(js)) queue.push(js);
    for (qi = 0; qi < queue.length; qi++) { seen[queue[qi]] = true; hops[queue[qi]] = 0; }
    for (qi = 0; qi < queue.length; qi++) {
      cur = queue[qi];
      out = adj[cur] || [];
      for (oi = 0; oi < out.length; oi++) {
        nxt = out[oi];
        if (seen[nxt]) continue;
        seen[nxt] = true;
        hops[nxt] = hops[cur] + 1;
        queue.push(nxt);
      }
    }
    // Shortest route first, and where two junctions are the same distance from
    // the power, the one nearer the SOURCE EDGE goes first. Hops alone tie far
    // too often — every junction touching a source-fed net is one hop — and the
    // old fallback was board order, which reads top to bottom while the game
    // reads left to right. Column order is the direction the player is actually
    // looking. Junctions the power never reaches settle last: they have nothing
    // to say either way.
    var order = juncs.slice();
    order.sort(function (a, b) {
      var da = hops[a.key] === undefined ? 1e9 : hops[a.key];
      var db = hops[b.key] === undefined ? 1e9 : hops[b.key];
      if (da !== db) return da - db;
      if (a.x !== b.x) return a.x - b.x;
      if (a.y !== b.y) return a.y - b.y;
      return a.n - b.n;
    });

    // How far the power is from each of a junction's ways. A SPLITTER needs
    // this: it carries the colour from its NEAREST input, and "nearest" has to
    // mean nearest to a source rather than first in some list.
    for (var wi = 0; wi < juncs.length; wi++) {
      var jw = juncs[wi];
      jw.wayHops = {};
      for (var we = 0; we < jw.node.e.length; we++) {
        var wd = jw.node.e[we], wb = jw.nb[wd];
        var wid = wb ? (wb.net ? 'n' + root(wb.net) : wb.junction) : null;
        jw.wayHops[wd] = (wid && hops[wid] !== undefined) ? hops[wid] : 1e9;
      }
      // A source sitting straight on the junction is nearer than anything.
      var ds = juncSources[jw.key];
      if (ds) for (var de in ds) if (ds.hasOwnProperty(de)) jw.wayHops[de] = -1;
    }

    return { root: root, plains: plains, juncs: juncs, juncBy: juncBy, order: order,
             hops: hops, netSources: netSources, juncSources: juncSources, at: at };
  }

  // ---- solve --------------------------------------------------------------
  //
  // A junction listens on every way that has a colour arriving on it, and pours
  // the blend out of every way that has not. Which is which is not declared
  // anywhere; it is worked out from the board.
  //
  // Working it out needs care. Two junctions either side of the same stretch of
  // wire can both claim it, and then neither feeds the other and the stretch
  // sits dead. So the junctions are settled ONE AT A TIME, in the order the
  // power reaches them (build() walks that out), each seeing what the ones
  // before it decided. The junction nearest the sources owns the stretch beyond
  // it, and everything downstream falls in behind. Deterministic, and with a
  // row of junctions it lands on the reading a player traces with a finger:
  // the trunk feeds the branch, not the other way round.
  function solve(board) {
    var g = build(board), i, j, k, e;

    var st = {}, rank = {};
    for (i = 0; i < g.juncs.length; i++) {
      st[g.juncs[i].key] = { ins: {}, got: {}, blend: 0, bad: false };
    }
    // Where each junction sits in the settle order, so a net fed by two
    // junctions takes the colour of the one the power reached first.
    for (i = 0; i < g.order.length; i++) rank[g.order[i].key] = i + 1;
    var netColour = {}, netShort = {}, netContrib = {};

    function portOut(jkey, edge) {
      var t = st[jkey];
      if (!t || t.bad || t.ins[edge]) return 0;
      return t.blend;
    }

    // Contributions are tagged with WHO made them, so a junction never reads
    // its own colour straight back and mistakes it for something arriving.
    // Every index in here is local on purpose: this is called from inside the
    // junction sweep, and sharing a loop variable with the caller would walk
    // straight off the end of it.
    function resolveNets() {
      var r, pi, kk;
      netContrib = {};
      for (pi = 0; pi < g.plains.length; pi++) {
        r = g.root(key(g.plains[pi].x, g.plains[pi].y, g.plains[pi].i));
        if (!netContrib[r]) netContrib[r] = [];
      }
      for (kk in g.netSources) if (g.netSources.hasOwnProperty(kk)) {
        var k = kk;
        r = g.root(k);
        netContrib[r] = netContrib[r] || [];
        for (var q = 0; q < g.netSources[k].length; q++) {
          netContrib[r].push({ who: 'source', colour: g.netSources[k][q] });
        }
      }
      for (var a = 0; a < g.juncs.length; a++) {
        var jj = g.juncs[a];
        for (var b = 0; b < jj.node.e.length; b++) {
          var edge = jj.node.e[b], nb = jj.nb[edge];
          if (!nb || !nb.net) continue;
          var out = portOut(jj.key, edge);
          if (!out) continue;
          r = g.root(nb.net);
          netContrib[r] = netContrib[r] || [];
          netContrib[r].push({ who: jj.key, colour: out });
        }
      }
      netColour = {}; netShort = {};
      for (var nk in netContrib) if (netContrib.hasOwnProperty(nk)) {
        netColour[nk] = settleNet(netContrib[nk], null, nk);
      }
    }

    // What ONE run of plain wire is carrying, and whether it is shorted.
    //
    // EVRTEK 2026-09-07: only SOURCES short. Two of them, different colours, on
    // one plain run with no junction between them — that is the whole rule now.
    // Anything a junction puts in is not a source and never shorts; if two
    // junctions ever feed one run, the one the power reached first wins, which
    // is the same precedence used everywhere else.
    //
    // `ignore` lets a junction ask what a net carries WITHOUT counting its own
    // contribution, which is what stops it reading its own colour back.
    function settleNet(list, ignore, markShort) {
      var srcs = [], best = null, n;
      for (n = 0; n < list.length; n++) {
        if (ignore && list[n].who === ignore) continue;
        if (list[n].who === 'source') {
          if (srcs.indexOf(list[n].colour) < 0) srcs.push(list[n].colour);
        } else {
          var rk = rank[list[n].who] || 1e9;
          if (!best || rk < best.rank) best = { rank: rk, colour: list[n].colour };
        }
      }
      if (srcs.length > 1) {
        // A short is judged only once everything has settled; it is never
        // latched, because early on a junction is acting on half a board.
        if (markShort !== null && markShort !== undefined) netShort[markShort] = true;
        return 0;
      }
      // A source always beats a junction on the same run. It cannot actually
      // come up — a junction treats a source-fed way as an input and so never
      // pushes there — but saying so keeps the rule true by construction.
      if (srcs.length === 1) return srcs[0];
      return best ? best.colour : 0;
    }

    // What a junction can see arriving from a net, ignoring whatever it is
    // putting into that net itself.
    function netSeenBy(netRoot, jkey) {
      return settleNet(netContrib[g.root(netRoot)] || [], jkey, null);
    }

    function settle(j) {
      var t = st[j.key];
      var direct = g.juncSources[j.key] || {};
      var mix = mode(j.node) === 'M';
      var ins = {}, blend = 0, bad = false, e2, near = null;
      for (e2 = 0; e2 < j.node.e.length; e2++) {
        var ed = j.node.e[e2], nb = j.nb[ed];
        var arriving = direct[ed] || 0;
        if (nb) {
          if (nb.net) arriving = CW_COLOUR.blend(arriving, netSeenBy(nb.net, j.key));
          else arriving = CW_COLOUR.blend(arriving, portOut(nb.junction, nb.edge));
        }
        t.got[ed] = arriving;
        if (!arriving) continue;
        ins[ed] = true;
        if (mix) {
          // A MIXER takes everything arriving and puts the blend out.
          blend = CW_COLOUR.blend(blend, arriving);
        } else {
          // A SPLITTER carries ONE colour: whichever input the power reached
          // first. The others are inputs still — they keep their own colour on
          // their own side — they are simply not taken up.
          var hp = j.wayHops ? j.wayHops[ed] : 0;
          if (near === null || hp < near) { near = hp; blend = arriving; }
        }
      }
      if (CW_COLOUR.depth(blend) > 2) { bad = true; blend = 0; }
      var same = blend === t.blend && bad === t.bad;
      if (same) {
        for (e2 = 0; e2 < j.node.e.length; e2++) {
          if (!!ins[j.node.e[e2]] !== !!t.ins[j.node.e[e2]]) { same = false; break; }
        }
      }
      t.ins = ins; t.blend = blend; t.bad = bad;
      return !same;
    }

    for (var pass = 0; pass < 24; pass++) {
      var changed = false;
      for (i = 0; i < g.order.length; i++) {
        resolveNets();
        if (settle(g.order[i])) changed = true;
      }
      if (!changed) break;
    }
    resolveNets();

    // --- write back --------------------------------------------------------
    var shorts = [];
    for (i = 0; i < g.plains.length; i++) {
      var pl = g.plains[i];
      var r2 = g.root(key(pl.x, pl.y, pl.i));
      pl.node.colour = netColour[r2] || 0;
      pl.node.short = !!netShort[r2];
      pl.node.ports = null;
      pl.node.ins = null;
      if (pl.node.short) shorts.push({ x: pl.x, y: pl.y, node: pl.i });
    }
    for (i = 0; i < g.juncs.length; i++) {
      j = g.juncs[i];
      var ss = st[j.key];
      var ports = {}, insList = [];
      for (e = 0; e < j.node.e.length; e++) {
        var ee = j.node.e[e];
        if (ss.ins[ee]) { ports[ee] = ss.got[ee]; insList.push(ee); }
        else ports[ee] = ss.blend;
      }
      j.node.colour = ss.blend;
      j.node.ports = ports;
      j.node.ins = insList;
      j.node.short = ss.bad;
      if (ss.bad) shorts.push({ x: j.x, y: j.y, node: j.i });
    }
    return shorts;
  }

  // What colour is sitting on one edge of one node.
  function colourOnEdge(board, x, y, edge) {
    var ni = board.nodeOnEdge(x, y, edge);
    if (ni < 0) return 0;
    var n = board.at(x, y).nodes[ni];
    if (n.short) return 0;
    if (n.ports) return n.ports[edge] || 0;
    return n.colour || 0;
  }

  function deliveries(board) {
    var out = [];
    for (var t = 0; t < board.targets.length; t++) {
      var tg = board.targets[t];
      var x = board.w - 1;
      var ni = board.nodeOnEdge(x, tg.row, 'E');
      if (ni < 0) continue;
      if (colourOnEdge(board, x, tg.row, 'E') === tg.colour) {
        out.push({ target: tg, x: x, y: tg.row, node: ni });
      }
    }
    return out;
  }

  function neighbours(board, x, y, i) {
    var c = board.at(x, y);
    if (!c || c.dead || !c.nodes[i]) return [];
    var edges = c.nodes[i].e, out = [];
    for (var e = 0; e < edges.length; e++) {
      var d = edges[e];
      var nx = x + DX[d], ny = y + DY[d];
      var nj = board.nodeOnEdge(nx, ny, OPP[d]);
      if (nj >= 0) out.push({ x: nx, y: ny, i: nj });
    }
    return out;
  }

  // Every node joined to this one, breadth-first so each carries its distance
  // from the start, which is what lets a delivered circuit discharge as a wave.
  function componentOrdered(board, sx, sy, sni) {
    var queue = [{ x: sx, y: sy, i: sni, d: 0 }], seen = {}, out = [], head = 0;
    while (head < queue.length) {
      var j = queue[head++];
      var k = key(j.x, j.y, j.i);
      if (seen[k]) continue;
      seen[k] = true;
      var c = board.at(j.x, j.y);
      if (!c || c.dead || !c.nodes[j.i]) continue;
      out.push({ x: j.x, y: j.y, i: j.i, d: j.d });
      var nb = neighbours(board, j.x, j.y, j.i);
      for (var n = 0; n < nb.length; n++) {
        queue.push({ x: nb[n].x, y: nb[n].y, i: nb[n].i, d: j.d + 1 });
      }
    }
    return out;
  }

  function component(board, sx, sy, sni) {
    return componentOrdered(board, sx, sy, sni).map(function (c) { return [c.x, c.y]; });
  }

  function componentOrigins(board, sx, sy, sni) {
    var nodes = componentOrdered(board, sx, sy, sni), out = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = board.at(nodes[i].x, nodes[i].y).nodes[nodes[i].i];
      if (out.indexOf(n.origin) < 0) out.push(n.origin);
    }
    return out;
  }

  return {
    solve: solve, deliveries: deliveries, colourOnEdge: colourOnEdge,
    isJunction: isJunction,
    mode: mode, setMode: setMode, toggleMode: toggleMode,
    component: component, componentOrdered: componentOrdered,
    componentOrigins: componentOrigins
  };
})();
