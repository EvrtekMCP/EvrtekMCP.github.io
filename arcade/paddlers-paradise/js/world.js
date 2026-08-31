// PORTAGE — THE WORLD
// ---------------------------------------------------------------------------
// Hand-authored geography of the classic beginner route out of the Canoe Lake
// access point: north up Canoe Lake, the 295m portage past the Joe Lake dam,
// through Joe and Little Joe and Baby Joe, and on to Burnt Island Lake. Lake
// names and portage lengths are real facts; the shapes are drawn from
// knowledge of the place, never traced from the published park map (Evrtek's
// ruling: clean data only, no theft).
//
// The world is authored as lake polygons + portage polylines + points of
// interest, then rasterised once into a coarse grid for collision and
// pre-rendered once into an offscreen canvas for drawing. World units are art
// pixels. North is up. The map is fun-sized, not to scale — a 3-day trip in
// about fifteen minutes.
// ---------------------------------------------------------------------------

'use strict';

var WORLD = {
  W: 1200, H: 1600,          // world size, world units
  CELL: 2,                   // collision cell — halved at v0.2.0: shorelines
                             // rasterise twice as fine (Evrtek's resolution note)
  // terrain codes
  DEEP: 0, WATER: 1, SHALLOW: 2, SAND: 3, GRASS: 4, TRAIL: 5,
};

// --- lakes as smoothed polygons ---------------------------------------------
// Control points, clockwise-ish. Smoothed with Catmull-Rom before filling so
// the shorelines read as lakes rather than as polygons.

var LAKES = [
  {
    name: 'Canoe Lake',
    big: true,                              // open water: wind matters here
    pts: [
      [560, 1030], [660, 1050], [740, 1120], [780, 1220], [790, 1340],
      [740, 1460], [640, 1520], [540, 1530], [450, 1480], [400, 1380],
      [390, 1260], [420, 1140], [480, 1060],
    ],
    islands: [
      { c: [590, 1265], r: 34 },            // Wapomeo, roughly
      { c: [520, 1170], r: 16 },
    ],
  },
  {
    name: 'Joe Lake',
    pts: [
      [610, 690], [700, 700], [770, 760], [790, 850], [770, 940],
      [700, 990], [620, 1000], [560, 950], [545, 860], [560, 770],
    ],
    islands: [
      { c: [745, 785], r: 20 },             // the island the campsite sits on
    ],
  },
  {
    name: 'Little Joe Lake',
    pts: [
      [430, 520], [510, 540], [560, 600], [560, 670], [500, 720],
      [420, 720], [370, 660], [365, 580],
    ],
    islands: [],
    lilies: true,                           // shallow, weedy — moose country
  },
  {
    name: 'Baby Joe Lake',
    pts: [
      [360, 320], [430, 335], [460, 390], [440, 450], [380, 470],
      [325, 440], [310, 375],
    ],
    islands: [],
    lilies: true,
  },
  {
    name: 'Burnt Island Lake',
    big: true,
    pts: [
      [200, 70], [420, 40], [640, 55], [850, 90], [950, 150],
      [930, 220], [780, 250], [600, 230], [430, 250], [260, 240],
      [150, 190], [140, 120],
    ],
    islands: [
      { c: [520, 140], r: 26 },
      { c: [750, 160], r: 18 },
    ],
  },
];

// narrows: water channels joining lakes that you paddle straight through
var CHANNELS = [
  { from: [620, 1000], to: [640, 960], w: 26 },    // Joe south bay
  { from: [560, 770], to: [520, 700], w: 22 },     // Joe -> Little Joe narrows
];

// --- portages ---------------------------------------------------------------
// Each portage is a trail polyline; the two ends are canoe landings. Lengths
// are the real posted lengths, which the HUD shows on the yellow signs.

var PORTAGES = [
  {
    name: 'Joe Lake Dam portage', metres: 295,
    path: [[622, 1035], [640, 1000], [643, 990]],
    lakes: ['Canoe Lake', 'Joe Lake'],
  },
  {
    name: 'Little Joe portage', metres: 435,
    path: [[424, 530], [404, 486], [392, 459]],
    lakes: ['Little Joe Lake', 'Baby Joe Lake'],
  },
  {
    name: 'Burnt Island portage', metres: 200,
    path: [[352, 322], [340, 284], [328, 248]],
    lakes: ['Baby Joe Lake', 'Burnt Island Lake'],
  },
];

// --- points of interest ------------------------------------------------------

var POIS = {
  dock:      { x: 600, y: 1500, name: 'Canoe Lake Access Point' },
  board:     { x: 585, y: 1512 },                       // the permit board
  canoeStart:{ x: 615, y: 1496 },                       // your canoe, waiting
  cairn:     { x: 782, y: 860, name: 'Tom Thomson cairn',
               text: 'A stone cairn to the painter Tom Thomson, who knew these lakes.' },
};

// Things worth paddling over to. Each has a first-person scene (#9): walk or
// paddle close and LOOK, and the game turns its whole screen into the view.
var INSPECTS = [
  { x: 800, y: 865,  scene: 'cairn',      name: 'Tom Thomson cairn',
    caption: 'The cairn to Tom Thomson, who painted these lakes and drowned in this one, 1917.' },
  { x: 634, y: 1012, scene: 'dam',        name: 'Joe Lake Dam',
    caption: 'The old dam sluices Joe Lake down toward Canoe Lake. The portage goes around, the water goes over.' },
  { x: 312, y: 398,  scene: 'pictograph', name: 'Ochre pictographs', water: true,
    caption: 'Figures in red ochre on wet granite — a canoe, a moose, a sun. Painted long before any portage sign.' },
  { x: 408, y: 505,  scene: 'bigpine',    name: 'The great white pine',
    caption: 'A white pine the loggers never got. Neck bent all the way back, you still cannot see the top move.' },
  { x: 695, y: 30,   scene: 'ranger',     name: 'Ranger cabin ruin',
    caption: 'A ranger cabin gone to moss and peeled logs. The stove has warmed nobody for sixty years.' },
  { x: 585, y: 1258, scene: 'lightning',  name: 'The lightning pine',
    caption: 'Split crown to root one August night. Half of it died; the other half decided not to.' },
];

var CAMPSITES = [
  { id: 'joe',   x: 745, y: 785,  lake: 'Joe Lake',          name: 'Joe Lake island site' },
  { id: 'burnt', x: 520, y: 138,  lake: 'Burnt Island Lake', name: 'Burnt Island — island site' },
  { id: 'canoe', x: 430, y: 1200, lake: 'Canoe Lake',        name: 'Canoe Lake west site' },
  { id: 'ljoe',  x: 500, y: 545,  lake: 'Little Joe Lake',   name: 'Little Joe site' },
];

// --- wildlife ----------------------------------------------------------------
// Anchors + habits. Actual individuals are spawned per trip from the trip
// seed in game.js; these are the places and hours they keep.

var WILDLIFE_SPOTS = [
  { species: 'River Otter',        at: [545, 758],  water: true,  from: 6,  to: 20 },
  { species: 'White-tailed Deer',  at: [386, 1310], water: false, from: 6,  to: 10 },
  { species: 'Bald Eagle',         at: [600, 150],  water: true,  from: 8,  to: 18, flies: true },
  { species: 'Belted Kingfisher',  at: [552, 648],  water: false, from: 7,  to: 19 },
  { species: 'Snapping Turtle',    at: [392, 430],  water: true,  from: 8,  to: 18 },
  { species: 'Common Loon',        at: [600, 1300], water: true,  from: 0,  to: 24 },
  { species: 'Common Loon',        at: [680, 860],  water: true,  from: 0,  to: 24 },
  { species: 'Common Loon',        at: [500, 140],  water: true,  from: 0,  to: 24 },
  { species: 'Moose',              at: [400, 690],  water: false, from: 6,  to: 10 },
  { species: 'Moose',              at: [430, 250],  water: false, from: 17, to: 21 },
  { species: 'Great Blue Heron',   at: [430, 1420], water: false, from: 7,  to: 19 },
  { species: 'Beaver',             at: [630, 1010], water: true,  from: 17, to: 22 },
  { species: 'Painted Turtle',     at: [545, 640],  water: true,  from: 9,  to: 17 },
  { species: 'Painted Turtle',     at: [760, 930],  water: true,  from: 9,  to: 17 },
  { species: 'Red-tailed Hawk',    at: [500, 1120], water: false, from: 9,  to: 18, flies: true },
  { species: 'Red-tailed Hawk',    at: [400, 300],  water: false, from: 10, to: 17, flies: true },
  { species: 'River Otter',        at: [700, 190],  water: true,  from: 7,  to: 19 },
  { species: 'Beaver',             at: [420, 712],  water: true,  from: 16, to: 22 },
];

// beaver lodges (#9): authored roughly, snapped to real shallows in fixup;
// which of them stand this trip is rolled per trip in game.js
var HUT_SPOTS = [
  { x: 630, y: 1008 },
  { x: 415, y: 705 },
  { x: 372, y: 452 },
];

// ---------------------------------------------------------------------------
// Rasterisation
// ---------------------------------------------------------------------------

var GRID = null;           // Uint8Array of terrain codes, gw x gh
var GW = 0, GH = 0;
var TREES = [];            // {x, y, kind} scattered on land, for the renderer
var LILIES = [];           // lily pads on the weedy lakes
var REEDS = [];            // reed clumps along quiet shallows (#11)
var STONES = [];           // just-submerged rocks near shore — hull hazards (#18)
var DEADHEADS = [];        // waterlogged logs, tips breaking the surface (#11)

function smoothPoly(pts, subdiv) {
  // Catmull-Rom through the control points, closed loop
  var out = [], n = pts.length, i, t, p0, p1, p2, p3;
  for (i = 0; i < n; i++) {
    p0 = pts[(i - 1 + n) % n]; p1 = pts[i];
    p2 = pts[(i + 1) % n];     p3 = pts[(i + 2) % n];
    for (t = 0; t < subdiv; t++) {
      var u = t / subdiv, u2 = u * u, u3 = u2 * u;
      out.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3),
      ]);
    }
  }
  return out;
}

function pointInPoly(x, y, poly) {
  var inside = false, i, j, n = poly.length;
  for (i = 0, j = n - 1; i < n; j = i++) {
    var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Author roughly, snap precisely. Every authored point of interest is walked
 * to the nearest cell of the terrain it actually needs, spiralling outward —
 * so a campsite authored a few pixels into the lake climbs out onto its own
 * shore instead of drowning the player. This ran the first probe of the world
 * red (every start point was DEEP water) and is the reason it can never
 * happen again: the shapes own the truth, the points follow.
 */
function snapTo(x, y, wants, maxR) {
  if (wants(terrainAt(x, y))) return { x: x, y: y };
  var r, a;
  for (r = 4; r <= (maxR || 120); r += 4) {
    for (a = 0; a < Math.PI * 2; a += Math.PI / 16) {
      var nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r;
      if (nx < 8 || ny < 8 || nx > WORLD.W - 8 || ny > WORLD.H - 8) continue;
      if (wants(terrainAt(nx, ny))) return { x: nx, y: ny };
    }
  }
  return { x: x, y: y };
}

function wantsLand(t)    { return !isWater(t); }
function wantsShallow(t) { return t === WORLD.SHALLOW; }

function fixupGeography() {
  // the dock stands on the south shore of Canoe Lake, planks reaching north
  var d = snapTo(POIS.dock.x, POIS.dock.y + 30, wantsLand);
  // walk it back toward the water so the planks actually reach it
  var w = snapTo(d.x, d.y, wantsShallow, 60);
  var dx = w.x - d.x, dy = w.y - d.y, len = Math.hypot(dx, dy) || 1;
  POIS.dock.x = Math.round(w.x - (dx / len) * 8);
  POIS.dock.y = Math.round(w.y - (dy / len) * 8);
  var land = snapTo(POIS.dock.x, POIS.dock.y, wantsLand, 60);
  POIS.start = { x: land.x, y: land.y };
  POIS.board.x = land.x - 14; POIS.board.y = land.y + 4;
  var bl = snapTo(POIS.board.x, POIS.board.y, wantsLand, 40);
  POIS.board.x = bl.x; POIS.board.y = bl.y;
  // the canoe waits in the shallows beside the dock
  var cs = snapTo(POIS.dock.x + 10, POIS.dock.y - 4, wantsShallow, 60);
  POIS.canoeStart.x = cs.x; POIS.canoeStart.y = cs.y;

  // campsites climb out of the water onto their own ground
  CAMPSITES.forEach(function (c) {
    var p = snapTo(c.x, c.y, wantsLand);
    // then a step further inland, off the beach
    var p2 = snapTo(p.x, p.y, function (t) { return t === WORLD.GRASS; }, 24);
    c.x = Math.round(p2.x); c.y = Math.round(p2.y);
  });

  var cn = snapTo(POIS.cairn.x + 20, POIS.cairn.y, wantsLand);
  POIS.cairn.x = Math.round(cn.x); POIS.cairn.y = Math.round(cn.y);

  INSPECTS.forEach(function (p) {
    var q = p.water ? snapTo(p.x, p.y, wantsShallow, 60) : snapTo(p.x, p.y, wantsLand, 60);
    p.x = Math.round(q.x); p.y = Math.round(q.y);
  });
  INSPECTS[0].x = POIS.cairn.x; INSPECTS[0].y = POIS.cairn.y;   // one cairn, one truth

  // beaver lodges stand in the shallows, never on a lawn
  HUT_SPOTS.forEach(function (h) {
    var p = snapTo(h.x, h.y, wantsShallow, 80);
    h.x = Math.round(p.x); h.y = Math.round(p.y);
  });
}

function buildWorld() {
  var CELL = WORLD.CELL;
  GW = Math.ceil(WORLD.W / CELL);
  GH = Math.ceil(WORLD.H / CELL);
  GRID = new Uint8Array(GW * GH);
  GRID.fill(WORLD.GRASS);

  var polys = LAKES.map(function (l) { return { lake: l, poly: smoothPoly(l.pts, 6) }; });

  var gx, gy, i;
  for (gy = 0; gy < GH; gy++) {
    for (gx = 0; gx < GW; gx++) {
      var x = gx * CELL + CELL / 2, y = gy * CELL + CELL / 2;
      for (i = 0; i < polys.length; i++) {
        if (pointInPoly(x, y, polys[i].poly)) {
          var isle = false, isl = polys[i].lake.islands, k;
          for (k = 0; k < isl.length; k++) {
            var dx = x - isl[k].c[0], dy = y - isl[k].c[1];
            if (dx * dx + dy * dy < isl[k].r * isl[k].r) { isle = true; break; }
          }
          GRID[gy * GW + gx] = isle ? WORLD.GRASS : WORLD.WATER;
          break;
        }
      }
    }
  }

  // channels: stamp water along the joining lines
  CHANNELS.forEach(function (c) {
    stampLine(c.from, c.to, c.w / 2, WORLD.WATER);
  });

  // shallows + sand: water next to land becomes shallow; land next to water, sand
  var next = new Uint8Array(GRID);
  for (gy = 2; gy < GH - 2; gy++) {
    for (gx = 2; gx < GW - 2; gx++) {
      var t = GRID[gy * GW + gx];
      var nearOther = false, ox, oy;
      for (oy = -2; oy <= 2 && !nearOther; oy++) {
        for (ox = -2; ox <= 2; ox++) {
          var o = GRID[(gy + oy) * GW + (gx + ox)];
          if ((t === WORLD.WATER) !== (o === WORLD.WATER || o === WORLD.SHALLOW)) {
            if ((t === WORLD.WATER && o === WORLD.GRASS) || (t === WORLD.GRASS && (o === WORLD.WATER))) { nearOther = true; break; }
          }
        }
      }
      if (nearOther) next[gy * GW + gx] = (t === WORLD.WATER) ? WORLD.SHALLOW : WORLD.SAND;
    }
  }
  GRID = next;

  // deep water: water far from any shore (a second pass over the result)
  var deep = new Uint8Array(GRID);
  for (gy = 5; gy < GH - 5; gy++) {
    for (gx = 5; gx < GW - 5; gx++) {
      if (GRID[gy * GW + gx] !== WORLD.WATER) continue;
      var allWater = true, ox2, oy2;
      for (oy2 = -5; oy2 <= 5 && allWater; oy2++) {
        for (ox2 = -5; ox2 <= 5; ox2++) {
          var o2 = GRID[(gy + oy2) * GW + (gx + ox2)];
          if (o2 !== WORLD.WATER && o2 !== WORLD.DEEP) { allWater = false; break; }
        }
      }
      if (allWater) deep[gy * GW + gx] = WORLD.DEEP;
    }
  }
  GRID = deep;

  // portage trails carved into the land
  PORTAGES.forEach(function (p) {
    var i2;
    for (i2 = 0; i2 < p.path.length - 1; i2++) {
      stampLine(p.path[i2], p.path[i2 + 1], 5, WORLD.TRAIL, true);
    }
  });

  fixupGeography();          // points snap to the terrain they need
  scatterFlora();            // then the forest keeps clear of the real spots
}

function stampLine(a, b, radius, code, landOnly) {
  var CELL = WORLD.CELL;
  var len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  var steps = Math.ceil(len / (CELL / 2)), s;
  for (s = 0; s <= steps; s++) {
    var x = a[0] + ((b[0] - a[0]) * s) / steps;
    var y = a[1] + ((b[1] - a[1]) * s) / steps;
    var r = Math.ceil(radius / CELL), ox, oy;
    var cgx = Math.floor(x / CELL), cgy = Math.floor(y / CELL);
    for (oy = -r; oy <= r; oy++) {
      for (ox = -r; ox <= r; ox++) {
        if (ox * ox + oy * oy > r * r) continue;
        var gx = cgx + ox, gy = cgy + oy;
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
        var cur = GRID[gy * GW + gx];
        if (landOnly && (cur === WORLD.WATER || cur === WORLD.DEEP || cur === WORLD.SHALLOW)) continue;
        GRID[gy * GW + gx] = code;
      }
    }
  }
}

function terrainAt(x, y) {
  var gx = Math.floor(x / WORLD.CELL), gy = Math.floor(y / WORLD.CELL);
  if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return WORLD.GRASS;
  return GRID[gy * GW + gx];
}

function isWater(t) { return t === WORLD.WATER || t === WORLD.DEEP || t === WORLD.SHALLOW; }

function scatterFlora() {
  // Terrain is the same every trip, so the forest is too: fixed seed.
  var rnd = rngFrom(0x0A160), i;
  TREES.length = 0;
  for (i = 0; i < 2600; i++) {
    var x = rnd() * WORLD.W, y = rnd() * WORLD.H;
    var t = terrainAt(x, y);
    if (t !== WORLD.GRASS) continue;
    // keep a small clearing around trails, camps and signs
    if (nearAnyTrail(x, y, 10)) continue;
    if (nearAnyCamp(x, y, 16)) continue;
    TREES.push({ x: x, y: y, kind: rnd() < 0.72 ? 'pine' : 'birch' });
  }
  TREES.sort(function (a, b) { return a.y - b.y; });   // painter's order

  LILIES.length = 0;
  var lakes = LAKES.filter(function (l) { return l.lilies; });
  lakes.forEach(function (l) {
    var cx = 0, cy = 0;
    l.pts.forEach(function (p) { cx += p[0]; cy += p[1]; });
    cx /= l.pts.length; cy /= l.pts.length;
    var j;
    for (j = 0; j < 40; j++) {
      var a = rnd() * Math.PI * 2, r = 30 + rnd() * 90;
      var lx = cx + Math.cos(a) * r, ly = cy + Math.sin(a) * r;
      if (isWater(terrainAt(lx, ly))) LILIES.push({ x: lx, y: ly });
    }
  });

  // reeds where the shallows meet sand — the quiet corners of every lake (#11)
  REEDS.length = 0;
  var g2 = 0;
  while (REEDS.length < 240 && g2++ < 20000) {
    var rx = rnd() * WORLD.W, ry = rnd() * WORLD.H;
    if (terrainAt(rx, ry) !== WORLD.SHALLOW) continue;
    if (terrainAt(rx + 5, ry) !== WORLD.SAND && terrainAt(rx - 5, ry) !== WORLD.SAND &&
        terrainAt(rx, ry + 5) !== WORLD.SAND && terrainAt(rx, ry - 5) !== WORLD.SAND) continue;
    REEDS.push({ x: rx, y: ry, n: 3 + Math.floor(rnd() * 3) });
  }

  // shore stones, lying just under the surface (#18): the paddler's tax
  STONES.length = 0;
  var g3 = 0;
  while (STONES.length < 46 && g3++ < 20000) {
    var sx3 = rnd() * WORLD.W, sy3 = rnd() * WORLD.H;
    if (terrainAt(sx3, sy3) !== WORLD.SHALLOW) continue;
    if (nearAnyCamp(sx3, sy3, 30)) continue;         // landings stay kind
    if (nearAnyTrail(sx3, sy3, 20)) continue;        // portage put-ins too
    STONES.push({ x: sx3, y: sy3, r: 1.6 + rnd() * 1.8, hitAt: -99 });
  }

  // deadheads: old logs the loggers lost, tips breaking the surface (#11)
  DEADHEADS.length = 0;
  var g4 = 0;
  while (DEADHEADS.length < 14 && g4++ < 20000) {
    var dx4 = rnd() * WORLD.W, dy4 = rnd() * WORLD.H;
    if (terrainAt(dx4, dy4) !== WORLD.WATER) continue;
    DEADHEADS.push({ x: dx4, y: dy4, a: rnd() * Math.PI * 2 });
  }
}

function nearAnyTrail(x, y, d) {
  var i, j;
  for (i = 0; i < PORTAGES.length; i++) {
    var p = PORTAGES[i].path;
    for (j = 0; j < p.length - 1; j++) {
      if (distToSeg(x, y, p[j], p[j + 1]) < d) return true;
    }
  }
  return false;
}

function nearAnyCamp(x, y, d) {
  var i;
  for (i = 0; i < CAMPSITES.length; i++) {
    var c = CAMPSITES[i];
    if (Math.hypot(x - c.x, y - c.y) < d) return true;
  }
  if (Math.hypot(x - POIS.dock.x, y - POIS.dock.y) < d * 2) return true;
  return false;
}

function distToSeg(px, py, a, b) {
  var dx = b[0] - a[0], dy = b[1] - a[1];
  var t = ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t));
}

// --- landings ---------------------------------------------------------------
// The only places a canoe goes ashore: the dock, portage ends, and the water
// edge of each campsite. Keeping landings explicit means nobody ever strands
// a canoe somewhere unreachable.

var LANDINGS = [];

function buildLandings() {
  LANDINGS.length = 0;
  LANDINGS.push({ x: POIS.dock.x, y: POIS.dock.y - 8, kind: 'dock', name: 'Access Point dock' });
  PORTAGES.forEach(function (p, i) {
    var a = p.path[0], b = p.path[p.path.length - 1];
    LANDINGS.push({ x: a[0], y: a[1], kind: 'portage', portage: i, end: 0, name: p.name + ' (' + p.metres + ' m)' });
    LANDINGS.push({ x: b[0], y: b[1], kind: 'portage', portage: i, end: 1, name: p.name + ' (' + p.metres + ' m)' });
  });
  CAMPSITES.forEach(function (c) {
    // campsite landing sits at the nearest water within a short walk
    var best = null, bd = 1e9, a;
    for (a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      var r;
      for (r = 4; r < 40; r += 4) {
        var x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
        if (isWater(terrainAt(x, y))) {
          var d = r;
          if (d < bd) { bd = d; best = { x: x, y: y }; }
          break;
        }
      }
    }
    if (best) LANDINGS.push({ x: best.x, y: best.y, kind: 'camp', camp: c.id, name: c.name });
  });
}
