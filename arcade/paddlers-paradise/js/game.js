// PORTAGE — GAME STATE
// ---------------------------------------------------------------------------
// The trip: launch at the Canoe Lake access point, paddle north, portage,
// camp before dark, reach Burnt Island Lake, and come home. Energy, food and
// daylight are the whole economy. Nothing here kills you — the worst night in
// Algonquin is a rough one, and so it is in the game.
//
// The vantage is old-school GTA on purpose, and so is the grammar: the canoe
// is the car. You walk, you board, you paddle — and on a portage you carry it
// over your head, which no car ever asked of anyone.
// ---------------------------------------------------------------------------

'use strict';

// TUNE lives in tune.js now (Evrtek's dashboard order): a schema the
// Outfitter panel builds its dials from, flattened to the same TUNE object
// the whole codebase has always read.

var DEV = (location.hash || '').indexOf('dev') >= 0;

// --- the whole game -----------------------------------------------------------

var S = null;               // state; rebuilt for every trip
var LAKE_POLYS = [];        // [{name, poly}] for lakeAt()

function newTrip() {
  var seed = (Date.now() & 0xffffffff) >>> 0;
  var rnd = rngFrom(seed);
  S = {
    mode: 'title',
    seed: seed, rnd: rnd,
    day: 1, clock: TUNE.dayStartMin + 60,   // 07:00 on day 1
    energy: TUNE.energyMax, food: TUNE.meals, snacks: TUNE.snacks,
    player: { x: (POIS.start || POIS.dock).x, y: (POIS.start || POIS.dock).y, ang: -Math.PI / 2, speed: 0, anim: 0 },
    travel: 'foot',
    canoe: { x: POIS.canoeStart.x, y: POIS.canoeStart.y, ang: -Math.PI / 2, beached: true },
    wind: rollWind(rnd, 1),
    objIndex: 0, wpIndex: 0,
    journal: [], seen: {},
    seenPOIs: {},
    log: [],
    stats: { paddle: 0, portage: 0, roughNights: 0, camps: 0, fish: 0,
             cooked: 0, hung: 0, stars: 0, boxUses: 0, bearRaids: 0,
             fireSits: 0, logsFed: 0, tended: 0, fireDied: 0, waves: 0,
             skySeen: {}, sites: {} },
    toasts: [], toastT: 0,
    campfire: null,           // {x, y} while a camp is pitched this evening
    sightT: 0, sightTarget: null,
    animals: [],
    card: null,               // {title, lines[], button} for camp/night/end
    mapOpen: false,
    scene: null,              // full-screen first-person moment, when open
    fish: null,               // the line in the water, when fishing
    fx: [],                   // short-lived splashes and such
    campSession: null,        // the evening's camp, while it is pitched
    hintT: 0,
  };
  // which beaver lodges stand this trip (#9)
  S.huts = HUT_SPOTS.filter(function () { return S.rnd() < 0.65; });
  STONES.forEach(function (st) { st.hitAt = -99; });  // clunks reset per trip
  spawnAnimals();
  planDay();
}

/**
 * Each day gets a plan drawn from the trip seed (#6, #8): maybe a sky event
 * after dusk, and zero-to-two things that happen out on the water — so two
 * playthroughs share a route but never quite share a trip.
 */
function planDay() {
  var r = S.rnd;
  var skyRoll = r();
  S.skyTonight = skyRoll < 0.3 ? 'aurora' : skyRoll < 0.65 ? 'meteors' : 'moonrise';
  S.skyShown = false;
  S.lookUp = false;
  S.events = [];
  var n = r() < 0.55 ? 1 : (r() < 0.35 ? 2 : 0);
  var pool = ['windshift', 'squall', 'bearShore', 'fishJump', 'bugs', 'fishJump', 'windshift'];
  var i;
  for (i = 0; i < n; i++) {
    S.events.push({
      at: 9 * 60 + r() * 9 * 60,          // sometime between 09:00 and 18:00
      type: pool[Math.floor(r() * pool.length)],
      done: false,
    });
  }
  S.squall = null;
  S.bugs = null;
  S.fishHot = 0;
}

function rollWind(rnd, day) {
  // day 1 gentle, later days rougher — a real forecast shape
  var str = Math.min(1, 0.15 + rnd() * 0.35 + (day - 1) * 0.2);
  return { from: rnd() * Math.PI * 2, str: str };
}

// --- trips & objectives ---------------------------------------------------------
// Three trips over the one honest park (#1): similar lengths, different
// things worth seeing. Each is an objective chain; the vista objectives
// complete through S.seenPOIs, so LOOKING is the goal, not just arriving.
// fleetScore lines are the review fleet's own best full playthroughs.

var TRIPS = [
  { id: 'classic', name: 'THE PORTAGE CLASSIC',
    blurb: 'North over the 295 m to Burnt Island and home — the honest loop.',
    facts: '2 nights · the dam & the cairn',
    fleetScore: 1116 },
  { id: 'still', name: 'STILL WATER',
    blurb: 'Lily country: the ochre pictographs and the great white pine.',
    facts: '2 nights · the pictographs & the pine',
    fleetScore: 739 },
  { id: 'farshore', name: 'THE FAR SHORE',
    blurb: 'Big-water crossings: the lightning pine and the ranger ruin.',
    facts: '2 nights · the ruin & the lightning pine',
    fleetScore: 1195 },
];

function tripBest(id) {
  try { return +localStorage.getItem('paddlers.best2.' + id) || 0; } catch (e) { return 0; }
}

function startTrip(i) {
  if (!TRIPS[i]) return;
  S.trip = TRIPS[i];
  buildObjectives();
  S.day = 1;
  S.clock = TUNE.dayStartMin + 60;   // 07:00 sharp — browsing the shelf is free
  S.mode = 'play';
  AUDIO.chime();
  toast(OBJS[0].text);
}

var OBJS = [];

function buildObjectives() {
  var P = function (i, end) {
    var L = LANDINGS.filter(function (l) { return l.kind === 'portage' && l.portage === i && l.end === end; })[0];
    return [L.x, L.y];
  };
  var C = function (id) {
    var c = CAMPSITES.filter(function (c2) { return c2.id === id; })[0];
    return [c.x, c.y];
  };
  var I = function (scene) {
    var p = INSPECTS.filter(function (q) { return q.scene === scene; })[0];
    return [p.x, p.y];
  };
  var launch = { text: 'Walk to your red canoe and launch it',
    wps: [[POIS.canoeStart.x, POIS.canoeStart.y]],
    done: function () { return S.travel === 'canoe'; } };
  var home = { text: 'Head home to the Canoe Lake dock',
    wps: [P(2, 1), P(2, 0), P(1, 1), P(1, 0), P(0, 1), P(0, 0), [POIS.dock.x, POIS.dock.y]],
    done: function () { return S.travel !== 'canoe' && near([POIS.dock.x, POIS.dock.y], 26); } };
  var homeShort = { text: 'Head home to the Canoe Lake dock',
    wps: [P(0, 1), P(0, 0), [POIS.dock.x, POIS.dock.y]],
    done: function () { return S.travel !== 'canoe' && near([POIS.dock.x, POIS.dock.y], 26); } };
  var tripId = S.trip ? S.trip.id : 'classic';

  if (tripId === 'still') {
    OBJS = [
      launch,
      { text: 'Paddle north up Canoe Lake to the yellow portage sign',
        wps: [P(0, 0)],
        done: function () { return S.travel !== 'canoe' && near(P(0, 0), 30); } },
      { text: 'Portage 295 m, then paddle on into Little Joe',
        wps: [P(0, 1), [552, 752], [505, 688]],
        done: function () { return S.travel === 'canoe' && lakeAt(S.player.x, S.player.y) === 'Little Joe Lake'; } },
      { text: 'Camp at the Little Joe site before dark',
        wps: [C('ljoe')],
        done: function () { return S.lastCamp === 'ljoe'; } },
      { text: 'Day 2 — find the ochre pictographs on Baby Joe',
        wps: [P(1, 0), P(1, 1), I('pictograph')],
        done: function () { return !!S.seenPOIs.pictograph; } },
      { text: 'Stand under the great white pine',
        wps: [I('bigpine')],
        done: function () { return !!S.seenPOIs.bigpine; } },
      { text: 'Make camp for the night — any orange sign',
        wps: [C('ljoe')],
        done: function () { return S.stats.camps >= 2; } },
      homeShort,
    ];
  } else if (tripId === 'farshore') {
    OBJS = [
      launch,
      { text: 'Cross to Wapomeo Island — the lightning pine',
        wps: [I('lightning')],
        done: function () { return !!S.seenPOIs.lightning; } },
      { text: 'Camp at the Canoe Lake west site before dark',
        wps: [C('canoe')],
        done: function () { return S.lastCamp === 'canoe'; } },
      { text: 'Day 2 — run the portages north to Burnt Island Lake',
        wps: [P(0, 0), P(0, 1), P(1, 0), P(1, 1), P(2, 0), P(2, 1)],
        done: function () { return S.travel === 'canoe' && lakeAt(S.player.x, S.player.y) === 'Burnt Island Lake'; } },
      { text: 'Find the ranger cabin ruin',
        wps: [I('ranger')],
        done: function () { return !!S.seenPOIs.ranger; } },
      { text: 'Camp at the Burnt Island north site',
        wps: [C('burnt')],
        done: function () { return S.lastCamp === 'burnt'; } },
      home,
    ];
  } else {
    OBJS = [
      launch,
      { text: 'Paddle north up Canoe Lake to the yellow portage sign',
        wps: [P(0, 0)],
        done: function () { return S.travel !== 'canoe' && near(P(0, 0), 30); } },
      { text: 'Portage 295 m over the Joe Lake dam, then put in',
        wps: [P(0, 1)],
        done: function () { return S.travel === 'canoe' && lakeAt(S.player.x, S.player.y) === 'Joe Lake'; } },
      { text: 'Camp at the Joe Lake island site before dark',
        wps: [C('joe')],
        done: function () { return S.lastCamp === 'joe'; } },
      { text: 'Day 2 — make for Burnt Island Lake',
        wps: [P(1, 0), P(1, 1), P(2, 0), P(2, 1)],
        done: function () { return S.travel === 'canoe' && lakeAt(S.player.x, S.player.y) === 'Burnt Island Lake'; } },
      { text: 'Camp at the Burnt Island north site',
        wps: [C('burnt')],
        done: function () { return S.lastCamp === 'burnt'; } },
      home,
    ];
  }
}

function currentTarget() {
  var o = OBJS[S.objIndex];
  if (!o) return null;
  return o.wps[Math.min(S.wpIndex, o.wps.length - 1)];
}

function near(pt, d) {
  return Math.hypot(S.player.x - pt[0], S.player.y - pt[1]) < d;
}

function tickObjectives() {
  var o = OBJS[S.objIndex];
  if (!o) return;
  var t = currentTarget();
  if (t && near(t, TUNE.waypointAt) && S.wpIndex < o.wps.length - 1) S.wpIndex++;
  if (o.done()) {
    S.objIndex++; S.wpIndex = 0;
    if (S.objIndex >= OBJS.length) { endTrip(); return; }
    AUDIO.chime();
    toast(OBJS[S.objIndex].text);
  }
}

// --- lakes -----------------------------------------------------------------------

function buildLakePolys() {
  LAKE_POLYS = LAKES.map(function (l) {
    var cx = 0, cy = 0;
    l.pts.forEach(function (p) { cx += p[0]; cy += p[1]; });
    return { name: l.name, poly: smoothPoly(l.pts, 6), big: !!l.big,
             cx: cx / l.pts.length, cy: cy / l.pts.length };
  });
}

function lakeAt(x, y) {
  var i;
  for (i = 0; i < LAKE_POLYS.length; i++) {
    if (pointInPoly(x, y, LAKE_POLYS[i].poly)) return LAKE_POLYS[i].name;
  }
  return null;
}

function onBigOpenWater() {
  if (S.travel !== 'canoe') return false;
  if (terrainAt(S.player.x, S.player.y) !== WORLD.DEEP) return false;
  var l = lakeAt(S.player.x, S.player.y), i;
  for (i = 0; i < LAKE_POLYS.length; i++) {
    if (LAKE_POLYS[i].name === l) return LAKE_POLYS[i].big;
  }
  return false;
}

// --- wildlife ----------------------------------------------------------------------

function pushAnimal(species, x, y, water, from, to, flies) {
  S.animals.push({
    species: species, home: [x, y], water: water,
    from: from, to: to, flies: !!flies,
    x: x, y: y, ang: S.rnd() * Math.PI * 2, state: 'idle', t: S.rnd() * 4, fleeT: 0,
  });
}

/** A random spot whose terrain suits the animal, or null. */
function randomHaunt(wantWater) {
  var tries = 60;
  while (tries--) {
    var x = 20 + S.rnd() * (WORLD.W - 40), y = 20 + S.rnd() * (WORLD.H - 40);
    if (isWater(terrainAt(x, y)) === wantWater) return { x: x, y: y };
  }
  return null;
}

function spawnAnimals() {
  S.animals = [];
  // Every haunt rolls for turnout and settles somewhere new each day — two
  // mornings never share a wildlife map (#10)
  WILDLIFE_SPOTS.forEach(function (w) {
    if (S.rnd() > TUNE.animalChance) return;        // out on other business today
    var hx = w.at[0], hy = w.at[1], tries = 14;
    while (tries--) {
      var jx = w.at[0] + (S.rnd() - 0.5) * TUNE.animalJitter * 2;
      var jy = w.at[1] + (S.rnd() - 0.5) * TUNE.animalJitter * 2;
      if (jx < 12 || jy < 12 || jx > WORLD.W - 12 || jy > WORLD.H - 12) continue;
      if (isWater(terrainAt(jx, jy)) === w.water) { hx = jx; hy = jy; break; }
    }
    pushAnimal(w.species, hx, hy, w.water,
      w.from + (S.rnd() - 0.5) * 2, w.to + (S.rnd() - 0.5) * 2, w.flies);
  });
  // wandering extras: today's surprises, anywhere the terrain suits them
  var i;
  for (i = 0; i < TUNE.roamers; i++) {
    var w2 = WILDLIFE_SPOTS[Math.floor(S.rnd() * WILDLIFE_SPOTS.length)];
    var p = randomHaunt(w2.water);
    if (p) pushAnimal(w2.species, p.x, p.y, w2.water,
      Math.max(6, w2.from - 2), Math.min(22, w2.to + 2), w2.flies);
  }
  // an occupied lodge means beavers working the bay at dusk (#9) — and a
  // beaver's home is WATER, verified, never a spot 8 units up the beach
  (S.huts || []).forEach(function (h) {
    if (S.rnd() >= 0.7) return;
    var bx = h.x, by = h.y, tries = 12;
    while (tries--) {
      var jx = h.x + (S.rnd() - 0.5) * 24, jy = h.y + (S.rnd() - 0.5) * 24;
      if (isWater(terrainAt(jx, jy))) { bx = jx; by = jy; break; }
    }
    if (isWater(terrainAt(bx, by))) pushAnimal('Beaver', bx, by, true, 16, 22);
  });
}

function hourNow() { return S.clock / 60; }

function animalActive(a) {
  var h = hourNow();
  return h >= a.from && h <= a.to && a.state !== 'gone';
}

function tickAnimals(dt) {
  var px = S.player.x, py = S.player.y, pspeed = S.player.speed;
  S.sightTarget = null;
  S.animals.forEach(function (a) {
    if (!animalActive(a)) return;
    a.t -= dt;
    if (a.state === 'idle') {
      if (a.t <= 0) { a.ang = S.rnd() * Math.PI * 2; a.t = 2 + S.rnd() * 4; }
      // small drift, tethered home
      var drift = a.flies ? 14 : a.species === 'Moose' ? 5 : 8;
      a.x += Math.cos(a.ang) * drift * dt;
      a.y += Math.sin(a.ang) * drift * dt;
      var hx = a.home[0] - a.x, hy = a.home[1] - a.y;
      if (Math.hypot(hx, hy) > 46) { a.ang = Math.atan2(hy, hx); }
      // stay in / out of water as its kind demands
      var wet = isWater(terrainAt(a.x, a.y));
      if (!a.flies && a.water !== wet) { a.x = a.home[0]; a.y = a.home[1]; }

      var d = Math.hypot(px - a.x, py - a.y);
      if (d < TUNE.fleeRadius && pspeed > TUNE.calmSpeed) {
        a.state = 'flee'; a.fleeT = 1.2;
        if (a.species === 'Beaver') AUDIO.tailSlap();
      } else if (d < TUNE.sightRadius && pspeed <= TUNE.calmSpeed) {
        S.sightTarget = a;
      }
    } else if (a.state === 'flee') {
      var away = Math.atan2(a.y - py, a.x - px);
      a.x += Math.cos(away) * 40 * dt;
      a.y += Math.sin(away) * 40 * dt;
      a.fleeT -= dt;
      if (a.fleeT <= 0) a.state = 'gone';   // dove, or slipped into the trees
    }
  });

  if (S.sightTarget) {
    S.sightT += dt;
    if (S.sightT >= TUNE.sightSeconds) {
      recordSighting(S.sightTarget);
      S.sightT = 0;
    }
  } else {
    S.sightT = 0;
  }
}

function recordSighting(a) {
  a.state = 'gone';           // it goes about its day; the moment was yours
  var first = !S.seen[a.species];
  S.seen[a.species] = (S.seen[a.species] || 0) + 1;
  S.journal.push({ species: a.species, day: S.day });
  toast(a.species + (first ? ' — sighted!' : ' — another one!') +
    ' (' + S.journal.length + ' in the journal)');
  AUDIO.chime();
  if (a.species === 'Common Loon') AUDIO.loon();
}

// --- movement -------------------------------------------------------------------

function moveSpeed(dirX, dirY) {
  if (S.campSession) {
    // on the camp stage: an easy walking pace, no wind, no bushwhack —
    // slower with the barrel in your arms, feet PLANTED mid-axe-swing
    if (S.campSession.chopT > 0) return 0;
    return (S.energy <= TUNE.exhaustedAt ? TUNE.exhaustedMult : 1) * TUNE.walk * 0.9 *
      (S.campSession.carryingBarrel ? 0.75 : 1);
  }
  var t = terrainAt(S.player.x, S.player.y);
  var sp;
  if (S.travel === 'canoe') {
    sp = t === WORLD.SHALLOW ? TUNE.paddleShallow : TUNE.paddle;
    if (onBigOpenWater() && S.wind.str > 0.05) {
      var fx = Math.cos(S.wind.from), fy = Math.sin(S.wind.from);
      var head = dirX * fx + dirY * fy;               // >0 = into the wind
      if (head > 0) sp -= head * S.wind.str * TUNE.windMaxSlow;
    }
  } else if (S.travel === 'carry') {
    sp = TUNE.carry * (t === WORLD.TRAIL ? 1 : 0.7);
  } else {
    sp = (t === WORLD.TRAIL || t === WORLD.SAND) ? TUNE.walk : TUNE.bushwhack;
  }
  if (S.energy <= TUNE.exhaustedAt) sp *= TUNE.exhaustedMult;
  return Math.max(10, sp);
}

function passable(x, y) {
  if (S.campSession) return campPassable(x, y);   // the stage has its own floor
  var t = terrainAt(x, y);
  if (x < 4 || y < 4 || x > WORLD.W - 4 || y > WORLD.H - 4) return false;
  if (S.travel === 'canoe') return isWater(t);
  return !isWater(t);
}

function tickMove(dt, inX, inY) {
  var mag = Math.hypot(inX, inY);
  if (mag < 0.1) { S.player.speed = 0; return; }
  inX /= mag; inY /= mag;

  var sp = moveSpeed(inX, inY);
  var nx = S.player.x + inX * sp * dt;
  var ny = S.player.y + inY * sp * dt;
  // slide order: full move, each axis, then 45-degree deflections — the last
  // two let a walker skirt ROUND obstacles (a diagonal into the fire ring
  // used to dead-stop against the circle, both axis-slides still inside it)
  var d45a = { x: S.player.x + (inX - inY) * 0.7 * sp * dt, y: S.player.y + (inY + inX) * 0.7 * sp * dt };
  var d45b = { x: S.player.x + (inX + inY) * 0.7 * sp * dt, y: S.player.y + (inY - inX) * 0.7 * sp * dt };
  if (passable(nx, ny)) { S.player.x = nx; S.player.y = ny; }
  else if (passable(nx, S.player.y)) { S.player.x = nx; }
  else if (passable(S.player.x, ny)) { S.player.y = ny; }
  else if (passable(d45a.x, d45a.y)) { S.player.x = d45a.x; S.player.y = d45a.y; }
  else if (passable(d45b.x, d45b.y)) { S.player.x = d45b.x; S.player.y = d45b.y; }
  else { S.player.speed = 0; return; }

  S.player.ang = Math.atan2(inY, inX);
  if (inX > 0.1) S.player.face = 1;
  else if (inX < -0.1) S.player.face = -1;
  S.player.speed = sp;
  S.player.anim += dt * sp * 0.28;

  // the canoe rides with you when aboard or overhead
  if (S.travel !== 'foot' && !S.campSession) {
    S.canoe.x = S.player.x; S.canoe.y = S.player.y; S.canoe.ang = S.player.ang;
  }

  // energy
  var drain = S.campSession ? TUNE.drainWalk * 0.5
    : S.travel === 'canoe' ? TUNE.drainPaddle
    : S.travel === 'carry' ? TUNE.drainCarry
    : (terrainAt(S.player.x, S.player.y) === WORLD.TRAIL ? TUNE.drainWalk : TUNE.drainBush);
  if (S.travel === 'canoe' && onBigOpenWater()) {
    var fx = Math.cos(S.wind.from), fy = Math.sin(S.wind.from);
    if (inX * fx + inY * fy > 0.3) drain *= TUNE.headwindDrain;
  }
  if (S.squall && S.travel === 'canoe') drain *= 1.5;   // rain-lashed water
  var wasAbove = S.energy > TUNE.exhaustedAt;
  S.energy = Math.max(0, S.energy - drain * dt);
  if (wasAbove && S.energy <= TUNE.exhaustedAt) {
    toast('Exhausted — eat a snack, or make camp.');
  }

  // the trip log's odometers
  if (S.travel === 'canoe') S.stats.paddle += sp * dt;
  if (S.travel === 'carry') S.stats.portage += sp * dt;
  // paddle strokes, for the ears
  if (S.travel === 'canoe') {
    S.strokeT = (S.strokeT || 0) - dt;
    if (S.strokeT <= 0) { AUDIO.paddle(); S.strokeT = 0.55; }
  }
}

// --- context action ---------------------------------------------------------------
// One button, whose meaning is always written on it. This is most of the
// "figure out what to do" answer: stand near a thing, the button names it.

function nearestLanding(maxD) {
  var best = null, bd = maxD || TUNE.interact;
  LANDINGS.forEach(function (l) {
    var d = Math.hypot(S.player.x - l.x, S.player.y - l.y);
    if (d < bd) { bd = d; best = l; }
  });
  return best;
}

function nearestInspect() {
  var best = null, bd = 22, i;
  for (i = 0; i < INSPECTS.length; i++) {
    var p = INSPECTS[i];
    if (!!p.water !== (S.travel === 'canoe')) continue;   // shore things afoot, cliff things afloat
    var d = Math.hypot(S.player.x - p.x, S.player.y - p.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function nearestCampsite(maxD) {
  var best = null, bd = maxD || 24;
  CAMPSITES.forEach(function (c) {
    var d = Math.hypot(S.player.x - c.x, S.player.y - c.y);
    if (d < bd) { bd = d; best = c; }
  });
  return best;
}

function nearCanoe() {
  return S.canoe.beached &&
    Math.hypot(S.player.x - S.canoe.x, S.player.y - S.canoe.y) < TUNE.interact;
}

function waterNearby() {
  // Only ever return a point that was ACTUALLY verified to be water. The
  // first version tested at radius r and returned r+6 unverified — the review
  // fleet found 149 standing positions where that put the canoe on dry land
  // with no way to move and no button to press. Prefer the deeper point when
  // it is also water; fall back to the proven sample.
  var a, r;
  for (r = 6; r <= 22; r += 4) {
    for (a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      var wx = S.player.x + Math.cos(a) * r, wy = S.player.y + Math.sin(a) * r;
      if (isWater(terrainAt(wx, wy))) {
        var dx2 = S.player.x + Math.cos(a) * (r + 6), dy2 = S.player.y + Math.sin(a) * (r + 6);
        if (isWater(terrainAt(dx2, dy2))) return { x: dx2, y: dy2 };
        return { x: wx, y: wy };
      }
    }
  }
  return null;
}

function contextAction() {
  if (S.mode !== 'play' && S.mode !== 'fish' && S.mode !== 'scene') return null;

  if (S.mode === 'scene') return { label: 'LOWER YOUR EYES', act: closeScene };
  if (S.mode === 'fish') {
    return { label: S.fish && S.fish.phase === 'strike' ? 'STRIKE!' : 'REEL IN', act: fishAction };
  }

  // while a camp is pitched, the evening owns the button — the canoe waits
  // until morning, chores by proximity (#2)
  if (S.campSession) {
    var ca = campAction();
    if (ca) return ca;
    return null;
  }

  if (S.travel === 'canoe') {
    var l = nearestLanding(30);
    if (l) return { label: 'LAND HERE', act: function () { landCanoe(l); } };
    // A campsite can be approached from any side — if its shore is close,
    // land right where the bow touches instead of demanding one blessed spot.
    var c0 = nearestCampsite(44);
    if (c0) return { label: 'LAND AT CAMP', act: function () {
      landCanoe({ x: S.player.x, y: S.player.y });
    } };
    var poW = nearestInspect();
    if (poW) return { label: 'LOOK — ' + poW.name.toUpperCase(), act: function () {
      S.seenPOIs[poW.scene] = true;
      S.log.push('Day ' + S.day + ' — paddled in close to the ' + poW.name + '.');
      openScene(poW.scene, poW.caption);
    } };
    // anywhere the bow can nose in, you can go ashore (#19) — the whole
    // shoreline is a landing now; named landings just do it better
    var aa, shoreOK = false;
    for (aa = 0; aa < Math.PI * 2; aa += Math.PI / 8) {
      if (!isWater(terrainAt(S.player.x + Math.cos(aa) * 12, S.player.y + Math.sin(aa) * 12))) {
        shoreOK = true; break;
      }
    }
    if (shoreOK) return { label: 'GO ASHORE', act: function () {
      if (!landCanoe({ x: S.player.x, y: S.player.y })) toast('No footing here — try along the shore.');
    } };
    // open water, nothing else calling: the rod is always in the canoe (#4)
    if (S.player.speed < 8) {
      return { label: 'FISH', act: startFishing };
    }
    return null;
  }

  if (S.travel === 'carry') {
    // At a portage END, put in on the side the trail EXITS toward — nearest
    // water at the Joe dam's south sign is the dam POND, and a canoe put
    // into the pond is a canoe in a puddle (fleet playthrough catch).
    var w = portagePutIn() || waterNearby();
    if (w) return { label: 'PUT IN & PADDLE', act: function () { putIn(w); } };
    return { label: 'SET CANOE DOWN', act: function () {
      S.travel = 'foot'; S.canoe.beached = true;
      S.canoe.x = S.player.x; S.canoe.y = S.player.y;
    } };
  }

  // on foot — inside the orange target ring, MAKE CAMP is the primary
  // action at ANY hour (Evrtek: the zone should mean camp, full stop). The
  // old morning deadlock (MAKE CAMP shadowing LAUNCH forever) is prevented
  // by suppression instead of the clock: after BREAK CAMP or walking out,
  // the site stays quiet until you have left its ring once.
  var cSite = nearestCampsite();
  if (cSite && S.suppressCampId === cSite.id &&
      hourNow() < 16 && S.energy > TUNE.exhaustedAt) {
    cSite = null;                     // you just left this one; the canoe first
  }
  if (cSite) return { label: 'MAKE CAMP', act: function () { makeCamp(cSite); } };
  if (nearCanoe()) {
    // At a portage sign the canoe goes over your head — water is ALWAYS
    // nearby at a landing, so if launching outranked carrying, the portage
    // could never begin (found by the first full playthrough drive).
    var pl = nearestLanding(TUNE.interact + 6);
    if (pl && pl.kind === 'portage') {
      var metres = PORTAGES[pl.portage].metres;
      return { label: 'CARRY CANOE — ' + metres + ' m', act: function () {
        S.travel = 'carry'; S.canoe.beached = false;
      } };
    }
    var w2 = waterNearby();
    if (w2) return { label: 'LAUNCH CANOE', act: function () { putIn(w2); } };
    return { label: 'CARRY CANOE', act: function () { S.travel = 'carry'; S.canoe.beached = false; } };
  }
  var po = nearestInspect();
  if (po) return { label: 'LOOK — ' + po.name.toUpperCase(), act: function () {
    S.seenPOIs[po.scene] = true;
    S.log.push('Day ' + S.day + ' — stood a while at the ' + po.name + '.');
    openScene(po.scene, po.caption);
  } };
  return null;
}

function putIn(w) {
  if (!w || !isWater(terrainAt(w.x, w.y))) return;   // never board onto land
  S.travel = 'canoe';
  S.canoe.beached = false;
  S.player.x = w.x; S.player.y = w.y;
  S.canoe.x = w.x; S.canoe.y = w.y;
  AUDIO.paddle();
}

/** Water on the OUTWARD side of the nearest portage end, if we stand at one. */
function portagePutIn() {
  var best = null, bd = 16, bi = -1, be = 0, i, e;
  for (i = 0; i < PORTAGES.length; i++) {
    var path = PORTAGES[i].path;
    var ends = [path[0], path[path.length - 1]];
    for (e = 0; e < 2; e++) {
      var d = Math.hypot(S.player.x - ends[e][0], S.player.y - ends[e][1]);
      if (d < bd) { bd = d; bi = i; be = e; }
    }
  }
  if (bi < 0) return null;
  var p2 = PORTAGES[bi].path;
  var end = be === 0 ? p2[0] : p2[p2.length - 1];
  var adj = be === 0 ? p2[1] : p2[p2.length - 2];
  var dx = end[0] - adj[0], dy = end[1] - adj[1];
  var len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  var k;
  for (k = 5; k <= 26; k += 3) {
    var wx = end[0] + dx * k, wy = end[1] + dy * k;
    if (isWater(terrainAt(wx, wy))) return { x: wx, y: wy };
  }
  return null;
}

function landCanoe(l) {
  // Find dry ground FIRST; only then commit to being on foot. And beach the
  // canoe at the water NEAREST THE PLAYER'S FEET, not wherever the bow first
  // touched — the fleet proved a landing that walked the player 38+ units
  // one way while the canoe stayed offshore the other, unreachable.
  var a, r;
  for (r = 6; r <= 48; r += 4) {
    for (a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      var x = l.x + Math.cos(a) * r, y = l.y + Math.sin(a) * r;
      if (!isWater(terrainAt(x, y))) {
        S.travel = 'foot';
        S.canoe.beached = true;
        S.player.x = x; S.player.y = y;
        // the canoe follows to the closest water within arm's reach of shore
        var bx = l.x, by = l.y, bd = Math.hypot(x - l.x, y - l.y);
        var a2, r2;
        for (r2 = 4; r2 <= 16; r2 += 4) {
          for (a2 = 0; a2 < Math.PI * 2; a2 += Math.PI / 8) {
            var wx = x + Math.cos(a2) * r2, wy = y + Math.sin(a2) * r2;
            if (isWater(terrainAt(wx, wy))) {
              var d2 = r2;
              if (d2 < bd) { bd = d2; bx = wx; by = wy; }
              break;
            }
          }
          if (bd <= r2) break;
        }
        S.canoe.x = bx; S.canoe.y = by;
        return true;
      }
    }
  }
  return false;              // no shore in reach: stay in the canoe
}

// --- camp & nights -----------------------------------------------------------------

function makeCamp(site) {
  // v0.2.0: camp is an EVENING (camp.js), not a card. Tent, wood, fire,
  // dinner, the barrel, the box, the stars — then you turn in.
  enterCamp(site);
}

function sightingsToday() {
  return S.journal.filter(function (j) { return j.day === S.day; }).length;
}

function sleepLine(lines) {
  if (S.fellAsleep) { lines.unshift('You drifted off watching the sky.'); S.fellAsleep = false; }
  return lines;
}

function roughNight() {
  // If camp is pitched and the tent is up, the dark just sends you to bed —
  // a late turn-in, not a rough night. No tent, and the half-made camp is
  // abandoned to the dark.
  if (S.campSession) {
    if (S.campSession.chores.tent) { finishCampNight(); return; }
    S.roughFed = !!S.campSession.chores.cooked;   // dinner was real; credit it
    S.suppressCampId = S.campSession.site.id;     // the ring stays quiet at dawn
    S.campSession = null;
    S.campfire = null;
    leaveCampWorld();                              // the dark sends you back
  }
  S.stats.roughNights++;
  // No fire, no dinner — and no meal deducted: the review fleet caught the
  // first version silently consuming food the morning ignored, which cost a
  // player their last meal for nothing.
  S.log.push('Day ' + S.day + ' — the dark caught me out. A rough night.');
  var afloat = S.travel === 'canoe';
  S.card = {
    title: 'THE DARK CATCHES YOU',
    lines: sleepLine(afloat ? [
      'You drift into a black bay and doze against the gunwales.',
      'Too dark to cook — dinner stays in the barrel.',
      'Camp earlier tomorrow — look for the orange signs.',
    ] : S.roughFed ? [
      'The half-made camp is abandoned to the dark.',
      'At least dinner was eaten before the light went.',
      'Pitch the tent FIRST tomorrow.',
    ] : [
      'No campsite, no fire, all mosquitoes.',
      'Too dark to cook — dinner stays in the barrel.',
      'Camp earlier tomorrow — look for the orange signs.',
    ]),
    button: 'ENDURE', kind: 'rough', ate: true,
  };
  S.mode = 'card';
}

function nextMorning(rough) {
  S.day++;
  S.clock = TUNE.dayStartMin + 30;      // 06:30, mist on the water
  S.energy = rough ? (S.roughFed ? 58 : 45) : (S.card && S.card.ate === false ? 60 : TUNE.energyMax);
  S.roughFed = false;
  S.fish = null;                        // no session survives a night
  S.lookUp = false;                     // last night's sky is last night's
  S.wind = rollWind(S.rnd, S.day);
  S.campfire = null;
  S.campSession = null;
  spawnAnimals();
  planDay();
  S.card = null;
  S.mode = 'play';
  AUDIO.morning();
  tickObjectives();          // last night's camp may have finished an objective
  toast('Day ' + S.day + ' — ' + (OBJS[S.objIndex] ? OBJS[S.objIndex].text : 'homeward.'));
}

function speciesRosterCount() {
  var set = {}, n = 0;
  WILDLIFE_SPOTS.forEach(function (w) { if (!set[w.species]) { set[w.species] = 1; n++; } });
  if (!set['Black Bear']) n++;               // the shore-event walk-on counts
  return n;
}

/**
 * Everything the trip did earns something (#4). The rows double as the trip's
 * story; the completion lines under them are the naturalist's checklist (#20).
 */
function computeScore() {
  var st = S.stats;
  var rows = [], total = 0;
  var add = function (label, pts) { rows.push([label, pts]); total += pts; };
  add('Trip completed', 400);
  if (S.day <= 3) add('Home in ' + S.day + ' days — swift water', 150);
  else if (S.day > 5) add(S.day + ' days out — the barrel ran thin', (S.day - 5) * -30);
  var km = Math.round(st.paddle / 40) / 10;
  add(km + ' km paddled', Math.min(240, Math.round(km * 12)));   // capped: no grinding laps
  var m = Math.round(st.portage * 5.9);   // matches the posted sign lengths
  add(m + ' m portaged', Math.min(200, Math.round(m / 10)));
  if (st.camps) add(st.camps + (st.camps === 1 ? ' night' : ' nights') + ' under canvas', st.camps * 60);
  if (st.cooked) add(st.cooked + (st.cooked === 1 ? ' dinner' : ' dinners') + ' over the fire', st.cooked * 25);
  if (st.hung) add('Barrel hung, ' + st.hung + (st.hung === 1 ? ' night' : ' nights'), st.hung * 20);
  if (st.stars) add(st.stars + (st.stars === 1 ? ' evening' : ' evenings') + ' watching the sky', st.stars * 20);
  if (st.fireSits) add('Sat with the fire ' + st.fireSits + (st.fireSits === 1 ? ' evening' : ' evenings'), Math.min(40, st.fireSits * 10));
  if (st.tended) add(st.tended + (st.tended === 1 ? ' fire' : ' fires') + ' kept to the last', st.tended * 35);
  if (st.logsFed) add(st.logsFed + ' logs fed to evening fires', Math.min(30, st.logsFed * 3));
  if (st.fireDied) add(st.fireDied + (st.fireDied === 1 ? ' fire' : ' fires') + ' lost to neglect', st.fireDied * -20);
  if (st.waves) add(st.waves + ' neighbourly ' + (st.waves === 1 ? 'wave' : 'waves'), Math.min(30, st.waves * 10));
  if (st.fish) add(st.fish + ' fish to the barrel', st.fish * 40);
  if (S.journal.length) add(S.journal.length + ' wildlife sightings', S.journal.length * 15);
  var sp = Object.keys(S.seen).length;
  if (sp) add(sp + ' species in the journal', sp * 40);
  var pois = Object.keys(S.seenPOIs).length;
  if (pois) add(pois + (pois === 1 ? ' place' : ' places') + ' properly looked at', pois * 35);
  var skies = Object.keys(st.skySeen).length;
  if (skies) add(skies + (skies === 1 ? ' night sky' : ' night skies') + ' witnessed', skies * 45);
  if (st.boxUses) add('Thunder box, ' + st.boxUses + (st.boxUses === 1 ? ' visit' : ' visits'), Math.min(30, st.boxUses * 5));
  if (S.snacks) add(S.snacks + (S.snacks === 1 ? ' snack' : ' snacks') + ' never needed', S.snacks * 10);
  if (st.roughNights) add(st.roughNights + (st.roughNights === 1 ? ' rough night' : ' rough nights'), st.roughNights * -40);
  if (st.bearRaids) add(st.bearRaids + (st.bearRaids === 1 ? ' bear raid' : ' bear raids'), st.bearRaids * -35);
  return { rows: rows, total: total };
}

function completionLines() {
  return [
    'Species seen: ' + Object.keys(S.seen).length + ' of ' + speciesRosterCount(),
    'Vistas looked at: ' + Object.keys(S.seenPOIs).length + ' of ' + INSPECTS.length,
    'Night skies: ' + Object.keys(S.stats.skySeen).length + ' of 3 kinds',
    'Campsites slept: ' + Object.keys(S.stats.sites).length + ' of ' + CAMPSITES.length,
  ];
}

function endTrip() {
  S.log.push('Day ' + S.day + ' — took out at the Canoe Lake dock. Trip complete.');
  var sc = computeScore();
  try {
    var k = 'paddlers.best2.' + (S.trip ? S.trip.id : 'classic');
    if (sc.total > (+localStorage.getItem(k) || 0)) localStorage.setItem(k, String(sc.total));
  } catch (e) {}
  S.card = {
    title: 'TRIP COMPLETE',
    score: sc,
    comp: completionLines(),
    lines: [],
    button: 'CHOOSE THE NEXT TRIP', kind: 'end',
  };
  S.mode = 'card';
}

// --- fishing (#4) -----------------------------------------------------------
// Stop the canoe, put a line in. Waiting costs daylight — that is the price —
// and the strike is a moment: miss it and dinner swims off.

function fishSpeciesHere() {
  var l = lakeAt(S.player.x, S.player.y);
  if (l === 'Burnt Island Lake') return 'Lake Trout';
  if (l === 'Little Joe Lake' || l === 'Baby Joe Lake') return 'Yellow Perch';
  return 'Smallmouth Bass';
}

function fishHourMult() {
  var h = hourNow();
  if ((h >= 5.5 && h <= 8.5) || (h >= 17 && h <= 20.5)) return TUNE.fishPrimeMult;
  if (h >= 11 && h <= 15) return TUNE.fishSlowMult;
  return 1;
}

function startFishing() {
  var hot = S.fishHot > S.clock;
  var hm = fishHourMult();
  S.fish = {
    phase: 'wait',
    t: 0,
    biteIn: (TUNE.fishBiteBase + S.rnd() * TUNE.fishBiteSpread) * (hot ? TUNE.fishHotMult : 1) * hm,
    window: TUNE.fishWindow,
  };
  S.mode = 'fish';
  toast(hot ? 'Line in. The water is boiling with them.'
    : hm < 1 ? 'Line in. The light is right — they should be feeding.'
    : hm > 1 ? 'Line in. Midday water — the fish are sulking somewhere cool.'
    : 'Line in. Now the waiting.');
}

function tickFish(dt) {
  // daylight keeps spending while you wait — fishing is never free
  var minPerSec = (TUNE.dayEndMin - TUNE.dayStartMin) / TUNE.daySeconds;
  S.clock += minPerSec * dt;
  var f = S.fish;
  f.t += dt;
  if (f.phase === 'wait' && f.t >= f.biteIn) {
    f.phase = 'strike';
    f.t = 0;
    S.fx.push({ sprite: 'splash', x: S.player.x + Math.cos(S.player.ang) * 10,
      y: S.player.y + Math.sin(S.player.ang) * 10, ttl: 0.8 });
    AUDIO.tailSlap();
  } else if (f.phase === 'strike' && f.t > f.window) {
    S.fish = null; S.mode = 'play';
    toast('It got away.');
  }
  if (S.clock >= TUNE.roughMin) { S.fish = null; S.mode = 'play'; roughNight(); }
}

function fishAction() {
  var f = S.fish;
  if (!f) return;
  if (f.phase === 'strike') {
    var sp = fishSpeciesHere();
    S.food = Math.min(9, S.food + 1);
    S.stats.fish++;
    toast(sp + '! +1 meal in the barrel.');
    AUDIO.chime();
  } else {
    toast('Reeled in. Nothing doing.');
  }
  S.fish = null;
  S.mode = 'play';
}

// --- the day's events (#8) ---------------------------------------------------

function nearestShorePoint(x, y) {
  var a, r;
  for (r = 6; r <= 120; r += 6) {
    for (a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      var nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r;
      if (!isWater(terrainAt(nx, ny))) return { x: nx, y: ny };
    }
  }
  return null;
}

function fireEvent(type) {
  if (type === 'windshift') {
    S.wind = { from: S.rnd() * Math.PI * 2, str: Math.min(1, 0.2 + S.rnd() * 0.6) };
    toast('The wind swings around.');
  } else if (type === 'squall') {
    if (!S.squall) S.windBefore = S.wind;   // never save a squall as "before"
    S.squall = { until: S.clock + 35 + S.rnd() * 25 };
    S.wind = { from: S.rnd() * Math.PI * 2, str: 0.95 };
    toast('A squall line rolls in — rain and hard wind!');
  } else if (type === 'bearShore') {
    var p = nearestShorePoint(S.player.x, S.player.y);
    if (p) {
      S.animals.push({ species: 'Black Bear', home: [p.x, p.y], water: false,
        from: 0, to: 24, x: p.x, y: p.y, ang: S.rnd() * Math.PI * 2,
        state: 'idle', t: 2, fleeT: 0 });
      toast('Something big is moving on the shore…');
    }
  } else if (type === 'fishJump') {
    S.fx.push({ sprite: 'splash', x: S.player.x + 14, y: S.player.y - 8, ttl: 1.2 });
    S.fishHot = S.clock + 90;
    AUDIO.tailSlap();
    toast('A fish jumps, close. Good water here.');
  } else if (type === 'bugs') {
    S.bugs = { until: S.clock + 25 };
    toast('Blackflies found you — outrun them!');
  }
}

function tickEvents(dt) {
  S.events.forEach(function (e) {
    if (!e.done && S.clock >= e.at) { e.done = true; fireEvent(e.type); }
  });
  if (S.squall && S.clock >= S.squall.until) {
    S.squall = null;
    if (S.windBefore) S.wind = S.windBefore;
    toast('The squall blows through. Quiet again.');
  }
  if (S.bugs) {
    if (S.clock >= S.bugs.until) { S.bugs = null; toast('You outlasted the blackflies.'); }
    else if (S.player.speed < 45) S.energy = Math.max(0, S.energy - 1.1 * dt);
  }
  // tonight's sky, offered once the light is truly gone (#6)
  var h = hourNow();
  if (!S.skyShown && h >= 20.2 && h <= 21.4 && !S.lookUp) {
    S.lookUp = true;
    toast('The sky is doing something. LOOK UP.');
  }
}

function lookUpNow() {
  // Only from open play: fired during a card it orphaned the card (the fleet
  // walked a double-breakfast and a permanently stranded TRIP COMPLETE);
  // fired during fishing it left a phantom bobber following the player.
  if (S.mode !== 'play' || S.mapOpen || OUTFIT.isOpen()) return;
  if (!S.lookUp || S.skyShown) return;
  S.skyShown = true; S.lookUp = false;
  S.stats.skySeen[S.skyTonight] = true;
  var caps = {
    aurora: 'The aurora, green and silent, the whole width of the north.',
    meteors: 'The Perseids. Count them until you lose count.',
    moonrise: 'The moon comes up the colour of birch bark.',
  };
  S.log.push('Day ' + S.day + ' — ' + (S.skyTonight === 'aurora' ? 'the northern lights.' :
    S.skyTonight === 'meteors' ? 'a meteor shower.' : 'watched the moon rise.'));
  openScene(S.skyTonight, caps[S.skyTonight]);
}

function tickStones() {
  if (S.travel !== 'canoe' || S.player.speed < 6) return;
  var i;
  for (i = 0; i < STONES.length; i++) {
    var st = STONES[i];
    var dx = S.player.x - st.x; if (dx > 60 || dx < -60) continue;
    var dy = S.player.y - st.y; if (dy > 60 || dy < -60) continue;
    var reach = st.r + 2.4;
    if (dx * dx + dy * dy < reach * reach) {
      var stamp = S.day * 1440 + S.clock;             // monotonic across days
      if (stamp >= st.hitAt && stamp - st.hitAt < 8) return;   // one clunk per pass
      st.hitAt = stamp;
      AUDIO.clunk();
      S.energy = Math.max(0, S.energy - TUNE.stoneEnergy);
      toast('CLUNK — a rock just under the surface. Watch the shallows.');
      // the hull glances off
      var d = Math.hypot(dx, dy) || 1;
      var nx = S.player.x + (dx / d) * 3, ny = S.player.y + (dy / d) * 3;
      if (passable(nx, ny)) { S.player.x = nx; S.player.y = ny; S.canoe.x = nx; S.canoe.y = ny; }
      return;
    }
  }
}

function tickFx(dt) {
  S.fx.forEach(function (f) { f.ttl -= dt; });
  S.fx = S.fx.filter(function (f) { return f.ttl > 0; });
}

// --- toasts -----------------------------------------------------------------------

function toast(text) {
  // one visible notification, one pending behind it: paired messages rotate
  // through the bar instead of the first dying unrendered (fleet catch)
  S.toasts.push({ text: text, ttl: 3.4 });
  if (S.toasts.length > 2) S.toasts.splice(1, 1);   // newest pending wins
}

// --- per-frame --------------------------------------------------------------------

function tickGame(dt, input) {
  if (OUTFIT.isOpen()) return;      // the Outfitter is a rest stop, everywhere
  if (S.mode === 'scene') {
    if (S.scene && S.scene.live) {
      var mps = (TUNE.dayEndMin - TUNE.dayStartMin) / TUNE.daySeconds;
      S.clock += mps * dt * TUNE.sceneTime;   // savour the first-person hours (#3)
      if (S.campSession && S.scene.name === 'firewatch') {
        tickFireTending(mps * dt * TUNE.sceneTime);
        tickVisitor(dt);
      }
      // sit long enough and the stars COME OUT — that is the watching
      if (S.campSession && S.scene.name === 'firewatch' &&
          !S.campSession.chores.stars && S.clock >= 19.6 * 60) {
        S.campSession.chores.stars = true;
        S.log.push('Day ' + S.day + ' — watched the stars come out over the lake.');
      }
      if (S.clock >= TUNE.roughMin && !S.eyesT) {
        S.eyesT = performance.now();          // you drifted off watching (#8)
      }
      if (S.eyesT && performance.now() - S.eyesT > 1700) {
        S.eyesT = 0;
        S.fellAsleep = true;
        closeScene(); roughNight(); return;
      }
      AUDIO.ambient(dt, {
        onWater: false, dusk: S.clock >= TUNE.duskMin,
        campfire: !!(S.campSession && S.campSession.chores.fire), mosquito: false,
      });
    }
    return;
  }
  if (S.mode === 'title' || S.mode === 'card' || S.mode === 'trips') return;
  if (S.mode === 'fish') { tickFish(dt); return; }    // the line is in; be still
  if (S.mode === 'play' && S.mapOpen) return;         // the map is a rest stop

  // clock
  var minPerSec = (TUNE.dayEndMin - TUNE.dayStartMin) / TUNE.daySeconds;
  S.clock += minPerSec * dt;
  if (S.clock >= TUNE.roughMin) { roughNight(); return; }
  if (!S.duskWarned && S.clock >= TUNE.duskMin) {
    S.duskWarned = true;
    toast('The light is going — find a campsite (orange sign).');
  }
  if (S.clock < TUNE.duskMin) S.duskWarned = false;

  tickMove(dt, input.x, input.y);
  if (S.suppressCampId) {
    // lifts only on genuinely leaving the ring (the canoe counts — the
    // position check runs while paddling too); contextAction bypasses it
    // in the evening and when exhausted, so an island dawdler can still
    // camp again when camping is the honest intent
    var sup = null, si;
    for (si = 0; si < CAMPSITES.length; si++) {
      if (CAMPSITES[si].id === S.suppressCampId) { sup = CAMPSITES[si]; break; }
    }
    if (!sup || Math.hypot(S.player.x - sup.x, S.player.y - sup.y) > 30) {
      S.suppressCampId = null;
    }
  }
  if (S.campSession) {
    S.sightTarget = null; S.sightT = 0;
    tickCampLife(dt);
  } else {
    tickAnimals(dt);
    tickEvents(dt);
    tickStones();
  }
  tickObjectives();
  tickFx(dt);

  // dusk mosquitoes on land, unless a fire is going nearby
  var duskish = S.clock >= TUNE.duskMin;
  var nearFire = S.campfire && Math.hypot(S.player.x - S.campfire.x, S.player.y - S.campfire.y) < 30;
  S.mosquito = duskish && S.travel !== 'canoe' && !nearFire;
  if (S.mosquito) S.energy = Math.max(0, S.energy - TUNE.mosquitoDrain * dt);

  // only the SHOWING notification ages; the pending one waits its turn
  if (S.toasts.length) {
    S.toasts[0].ttl -= dt;
    if (S.toasts[0].ttl <= 0) S.toasts.shift();
  }

  AUDIO.ambient(dt, {
    onWater: S.travel === 'canoe',
    dusk: duskish,
    campfire: !!nearFire,
    mosquito: !!S.mosquito,
  });
}

function doAction() {
  if (OUTFIT.isOpen()) return;      // nothing happens behind the panel
  if (S.mode === 'title') { S.mode = 'trips'; return; }
  if (S.mode === 'trips') { return; }   // picked by button or 1/2/3
  if (S.mode === 'scene') { if (S.eyesT) return; closeScene(); return; }
  if (S.mode === 'fish') { fishAction(); return; }
  if (S.mode === 'card') {
    if (S.card.kind === 'end') { newTrip(); S.mode = 'trips'; return; }
    if (S.card.kind === 'boxCheck') { S.card = null; S.mode = 'play'; return; }
    if (S.card.kind === 'fireSafety') {
      S.card = null;
      S.mode = S.scene ? 'scene' : 'play';   // back to the (large) fire
      return;
    }
    if (S.card.kind === 'campNight') { showCampMorning(); return; }
    if (S.card.kind === 'campMorning') { breakCamp(); return; }
    nextMorning(S.card.kind === 'rough');
    return;
  }
  if (S.mapOpen) { S.mapOpen = false; return; }
  var a = contextAction();
  if (a) a.act();
}

function eatSnack() {
  if (S.mode !== 'play' || S.mapOpen || OUTFIT.isOpen() || S.snacks <= 0) return;
  S.snacks--;
  S.energy = Math.min(TUNE.energyMax, S.energy + TUNE.snackEnergy);
  AUDIO.chime();
  toast('Snack. ' + S.snacks + ' left.');
}

// dev conveniences, only behind #dev
function devKey(code) {
  if (!DEV) return;
  if (code === 'KeyT') S.clock += 60;
  if (code === 'KeyU') S.energy = TUNE.energyMax;
  if (code === 'KeyY') {
    var t = currentTarget();
    if (t) { S.player.x = t[0]; S.player.y = t[1] - 4;
      if (S.travel !== 'foot') { S.canoe.x = t[0]; S.canoe.y = t[1] - 4; } }
  }
}
