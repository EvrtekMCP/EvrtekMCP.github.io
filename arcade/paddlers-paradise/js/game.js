// PORTAGE — GAME STATE
// ---------------------------------------------------------------------------
// The trip: launch at the park's access point, paddle, portage, camp before
// dark, reach the far lake, and come home. Energy, food and daylight are the
// whole economy. Nothing here kills you — the worst night in Algonquin is a
// rough one, and so it is in the game.
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
    // vx/vy are the hull's momentum (note 21) — live only while afloat with
    // TUNE.glide above zero; zeroed at every put-in and every landing
    canoe: { x: POIS.canoeStart.x, y: POIS.canoeStart.y, ang: -Math.PI / 2, beached: true, vx: 0, vy: 0 },
    carryFrom: null,          // {portage, end} the canoe was shouldered at (note 2) — PUT IN is for the OTHER end
    roughFed: false,          // dinner was cooked before the dark caught you (note 20): the rough night floors higher
    wind: rollWind(rnd, 1),
    objIndex: 0, wpIndex: 0,
    journal: [], seen: {},
    seenPOIs: {},
    picked: {}, hinted: {},   // berry bushes taken / patches whispered about, by id, this trip (note 8)
    log: [],                  // diary entries {day, text} — read in the journal (note 12)
    stats: { paddle: 0, portage: 0, portageM: 0, roughNights: 0, camps: 0, fish: 0,
             cooked: 0, hung: 0, stars: 0, boxUses: 0, bearRaids: 0,
             fireSits: 0, logsFed: 0, tended: 0, fireDied: 0, waves: 0,
             berries: 0, skySeen: {}, sites: {},
             features: {} },          // site curiosities looked at, by campsite id (note 4)
    toasts: [], toastT: 0,
    campfire: null,           // {x, y} while a camp is pitched this evening
    sightT: 0, sightTarget: null,
    animals: [],
    card: null,               // {title, lines[], button} for camp/night/end
    mapOpen: false,
    gearOpen: false,          // the gear menu (note 13) — pauses like the map
    gearConfirm: false,       // ...and its 'abandon this trip?' second step
    journalOpen: false,       // the hand-written journal (note 12) — camp only, pauses like the map
    journalPage: 0,
    scene: null,              // full-screen first-person moment, when open
    fish: null,               // the line in the water, when fishing
    catches: [],              // every fish landed: {species, lb, lake, day, rare, legend, big} (note 6)
    reRig: false,             // a parted line: the next cast waits longer
    fx: [],                   // short-lived splashes and such
    campSession: null,        // the evening's camp, while it is pitched
    // the first armload of the trip gets a target ring on the fire ring
    // (note 21): 0 = not carried yet, 1 = showing, 2 = stacked, never again
    woodMarker: 0,
    hintT: 0,
    // note 22: the steering keys own the heading — set while A/D/W/S drive,
    // cleared the moment a compass direction (the stick) does, and read only
    // when TUNE.steerKeys is on. It survives the release so the bow holds
    // where it was steered while the hull coasts.
    headKeys: false,
  };
  // which beaver lodges stand this trip (#9) — the entries are the HUT_SPOTS
  // objects themselves, so the once-per-trip 'seen' flag resets here too
  HUT_SPOTS.forEach(function (h) { h.seen = false; });
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
  S.howled = false;           // the wolf's one dusk howl a day (note 8)
}

function rollWind(rnd, day) {
  // day 1 gentle, later days rougher — a real forecast shape
  var str = Math.min(1, 0.15 + rnd() * 0.35 + (day - 1) * 0.2);
  return { from: rnd() * Math.PI * 2, str: str };
}

// --- parks, trips & objectives ---------------------------------------------------
// One trip per park (#1): the card on the shelf is the park's own trip record
// (world.js PARKS[i].trip, id = the park id, so S.trip.id is the record key).
// Each is an objective chain built by the park's own builder; the vista
// objectives complete through S.seenPOIs, so LOOKING is the goal, not just
// arriving. fleetScore lines are the review fleet's own best full playthroughs.

var TRIPS = PARKS.map(function (p) { return p.trip; });

function tripBest(id) {
  try { return +localStorage.getItem('paddlers.best2.' + id) || 0; } catch (e) { return 0; }
}

/**
 * Pick a park: load it (world, landings, terrain, a fresh S standing on its
 * dock — half a second to a second and a half on a phone, under the fade),
 * build its chain, and go. startTrip is the old name, kept as an alias.
 */
function startPark(i) {
  if (!PARKS[i]) return;
  loadPark(i);
  S.trip = PARK.trip;
  buildObjectives();
  S.day = 1;
  S.clock = TUNE.dayStartMin + 60;   // 07:00 sharp — browsing the shelf is free
  S.mode = 'play';
  S.fadeT = performance.now();       // instant start off the park screen: the new world fades in
  AUDIO.song.fadeOut(5);           // the tune lets go as the trip starts; the lake takes over
  AUDIO.chime();
  toast(OBJS[0].text);
}
var startTrip = startPark;

var OBJS = [];

/**
 * The chain comes from the park (PARK.trip.objectives), built AFTER the park
 * is loaded so every coordinate the helpers hand out is the snapped one:
 *   P(i, end)  a portage landing, end 0 = path[0], 1 = path[last]
 *   C(id)      a campsite         I(scene)  a vista
 *   L(name)    a lake NAME, checked — a typo dies here, not as an objective
 *              that can never complete
 *   O(key)     a POI: dock / canoeStart / board / start / cairn
 *   O.launch() and O.home(wpsBeforeDock) are the two park-agnostic
 *   objectives; O.access is the park's access record.
 * Every helper throws on a name it cannot find (headless --check runs this).
 */
function buildObjectives() {
  var missing = function (what) { throw new Error('objectives: no ' + what + ' in park ' + PARK.id); };
  var P = function (i, end) {
    var L2 = LANDINGS.filter(function (l) { return l.kind === 'portage' && l.portage === i && l.end === end; })[0];
    if (!L2) missing('portage ' + i + ' end ' + end);
    return [L2.x, L2.y];
  };
  var C = function (id) {
    var c = CAMPSITES.filter(function (c2) { return c2.id === id; })[0];
    if (!c) missing('campsite ' + id);
    return [c.x, c.y];
  };
  var I = function (scene) {
    var p = INSPECTS.filter(function (q) { return q.scene === scene; })[0];
    if (!p) missing('inspect ' + scene);
    return [p.x, p.y];
  };
  var L = function (name) {
    if (!LAKES.some(function (l) { return l.name === name; })) missing('lake ' + name);
    return name;
  };
  var O = function (key) {
    var p = POIS[key];
    if (!p) missing('poi ' + key);
    return [p.x, p.y];
  };
  O.access = PARK.access;
  O.launch = function () {
    // the board (note 21) gets its one mention here: 41 chars, under the bar
    return { text: 'Read the board, then launch the red canoe',
      wps: [O('canoeStart')],
      done: function () { return S.travel === 'canoe'; } };
  };
  O.home = function (wps) {
    var dock = O('dock');
    return { text: 'Head home to the ' + PARK.access.short + ' dock',
      wps: (wps || []).concat([dock]),
      done: function () { return S.travel !== 'canoe' && near(dock, 26); } };
  };
  OBJS = PARK.trip.objectives(P, C, I, L, O);
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
    var poly = smoothPoly(l.pts, 6);
    // the name goes on the label pole buildWorld computed (note 15) — the
    // water cell farthest from any shore — and only falls back to the
    // centroid when a park's build never wrote one
    return { name: l.name, label: l.label || l.name, poly: poly, box: polyBox(poly), big: !!l.big,
             cx: cx / l.pts.length, cy: cy / l.pts.length,
             lx: l.labelX !== undefined ? l.labelX : cx / l.pts.length,
             ly: l.labelY !== undefined ? l.labelY : cy / l.pts.length };
  });
}

function lakeAt(x, y) {
  var i;
  for (i = 0; i < LAKE_POLYS.length; i++) {
    if (!inBox(x, y, LAKE_POLYS[i].box)) continue;
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

/**
 * How far off the beaten path a point is (note 8): the distance to the
 * nearest route feature — a portage segment, a campsite, the dock, a vista.
 * The interior between the lakes scores in the hundreds; a landing scores 0.
 */
function remoteness(x, y) {
  var d = 1e9, i, j;
  for (i = 0; i < PORTAGES.length; i++) {
    var p = PORTAGES[i].path;
    for (j = 0; j < p.length - 1; j++) d = Math.min(d, distToSeg(x, y, p[j], p[j + 1]));
  }
  for (i = 0; i < CAMPSITES.length; i++) d = Math.min(d, Math.hypot(x - CAMPSITES[i].x, y - CAMPSITES[i].y));
  for (i = 0; i < INSPECTS.length; i++) d = Math.min(d, Math.hypot(x - INSPECTS[i].x, y - INSPECTS[i].y));
  d = Math.min(d, Math.hypot(x - POIS.dock.x, y - POIS.dock.y));
  return d;
}

/**
 * A random spot whose terrain suits the animal, or null. With `minRemote`
 * the first forty tries also want that much distance from any route
 * feature (the roamers live in the deep woods, note 8); after that any
 * suitable ground will do, so a park with no interior still gets its extras.
 */
function randomHaunt(wantWater, minRemote) {
  var tries = 0;
  while (tries++ < 100) {
    var x = 20 + S.rnd() * (WORLD.W - 40), y = 20 + S.rnd() * (WORLD.H - 40);
    if (isWater(terrainAt(x, y)) !== wantWater) continue;
    if (minRemote && tries <= 40 && remoteness(x, y) < minRemote) continue;
    return { x: x, y: y };
  }
  return null;
}

function spawnAnimals() {
  S.animals = [];
  // Every haunt rolls for turnout and settles somewhere new each day — two
  // mornings never share a wildlife map (#10). A remote anchor wanders
  // half again as far (note 8): the interior is big and nobody is watching.
  WILDLIFE_SPOTS.forEach(function (w) {
    if (S.rnd() > TUNE.animalChance) return;        // out on other business today
    var hx = w.at[0], hy = w.at[1], tries = 14;
    var jit = TUNE.animalJitter * (w.remote ? 1.5 : 1);
    while (tries--) {
      var jx = w.at[0] + (S.rnd() - 0.5) * jit * 2;
      var jy = w.at[1] + (S.rnd() - 0.5) * jit * 2;
      if (jx < 12 || jy < 12 || jx > WORLD.W - 12 || jy > WORLD.H - 12) continue;
      if (isWater(terrainAt(jx, jy)) === w.water) { hx = jx; hy = jy; break; }
    }
    pushAnimal(w.species, hx, hy, w.water,
      w.from + (S.rnd() - 0.5) * 2, w.to + (S.rnd() - 0.5) * 2, w.flies);
  });
  // wandering extras: today's surprises, off the route where the terrain
  // suits them — the reward for leaving the path (note 8)
  var i;
  for (i = 0; i < TUNE.roamers; i++) {
    var w2 = WILDLIFE_SPOTS[Math.floor(S.rnd() * WILDLIFE_SPOTS.length)];
    var p = randomHaunt(w2.water, TUNE.roamRemote);
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

  // the wolf's dusk howl (note 8): once a day, from any wolf still out
  // within 200 u — an audible lure into the deep woods, never a visit. It
  // keeps its distance like everything else; the flee rule above is all
  // the closer it ever gets.
  if (!S.howled && S.clock >= TUNE.duskMin) {
    var wi;
    for (wi = 0; wi < S.animals.length; wi++) {
      var wf = S.animals[wi];
      if (wf.species !== 'Eastern Wolf' || !animalActive(wf)) continue;
      if (Math.hypot(px - wf.x, py - wf.y) > 200) continue;
      S.howled = true;
      AUDIO.howl();
      toast('Somewhere west, a howl.');
      break;
    }
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
  if (a.species === 'Eastern Wolf') AUDIO.howl();
}

// --- movement -------------------------------------------------------------------

/**
 * The two tiers of tired (note 7): under the exhaustion line the tripper
 * trudges; at an EMPTY bar every stroke is a chore. Neither strands anyone —
 * the floor in moveSpeed sees to that.
 */
function tiredMult() {
  return S.energy <= 0 ? TUNE.exhaustedZeroMult
    : S.energy <= TUNE.exhaustedAt ? TUNE.exhaustedMult : 1;
}

function moveSpeed(dirX, dirY) {
  if (S.campSession) {
    // on the camp stage: an easy walking pace, no wind, no bushwhack —
    // slower with the barrel or an armload of wood in your arms, feet
    // PLANTED mid-axe-swing
    if (S.campSession.chopT > 0) return 0;
    return tiredMult() * TUNE.walk * 0.9 *
      (S.campSession.carryingBarrel ? 0.75 : 1) *
      (S.campSession.carryingWood > 0 ? 0.85 : 1);
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
  sp *= tiredMult();
  // the floor is 6, not 10: a spent portage (27 x 0.3 = 8) must not be
  // clamped back up to the pace it is supposed to have lost
  return Math.max(6, sp);
}

function passable(x, y) {
  if (S.campSession) return campPassable(x, y);   // the stage has its own floor
  var t = terrainAt(x, y);
  if (x < 4 || y < 4 || x > WORLD.W - 4 || y > WORLD.H - 4) return false;
  if (S.travel === 'canoe') return isWater(t);
  return !isWater(t);
}

// The canoe's momentum (note 21). GLIDE_ACCEL is the time constant of the
// stroke's BITE — a paddle grabs water fast, so ~0.1 s puts the hull within
// a few per cent of the pace moveSpeed asks for; the release side is the
// player's dial, TUNE.glide. GLIDE_FLOOR ends a drift that has become a
// rounding error (so 'stopped' really is stopped, and the sighting hold, the
// rod and the stones all settle); GLIDE_NOSE is the speed above which the
// hull points where it is GOING rather than where the last stroke pushed.
var GLIDE_ACCEL = 0.10;      // s
var GLIDE_FLOOR = 1.5;       // u/s
var GLIDE_NOSE = 4;          // u/s

// Steering keys (note 22). Backing up is not a second gear: a reverse walk
// and a back-paddle both go at half the forward pace, which is generous to
// the paddler and about right for the walker.
var STEER_BACK = 0.5;
var DEG = Math.PI / 180;

/** Wrap an angle to (-PI, PI] so a long spin never drifts into big floats. */
function wrapAng(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

/**
 * The canoe carries. A stroke bites in about a quarter second; when the
 * stroke stops the hull COASTS, shedding speed on TUNE.glide's exponential,
 * so a paddler eases up to a landing instead of hitting a wall. Position
 * still integrates through the same passable()/slide logic as walking, so
 * collision stops the hull and tickStones still hears a CLUNK at speed.
 *
 * Everything that asks "is it stopped" — FISH, the sighting hold, the walk
 * frames, the blackfly drain — reads S.player.speed, and S.player.speed is
 * the REAL velocity here, not the pace the input asked for.
 *
 * The paddle sound, the stroke animation and the energy drain stay tied to
 * INPUT: you do not paddle while you coast.
 *
 * TUNE.glide 0 never reaches this function — tickMove keeps the v0.9.0
 * instant-stop path below untouched for it, so the dial is an honest toggle.
 *
 * spMul scales the pace a stroke asks for (half, backing up under the steering
 * keys). headLock says the KEYS own the bow — this tick or the stroke that is
 * still coasting: the hull holds the heading they turned it to instead of
 * noseing round to the velocity, so a back-paddle does not spin the canoe end
 * for end, on the stroke OR on the release, and A/D swing a drifting hull.
 * Both default to the v0.9.2 behaviour, which is what the stick sends.
 */
function tickCanoeGlide(dt, inX, inY, spMul, headLock) {
  var c = S.canoe;
  var mag = Math.hypot(inX, inY);
  var held = mag >= 0.1;
  var sp = 0;
  if (held) {
    inX /= mag; inY /= mag;
    sp = moveSpeed(inX, inY) * (spMul || 1);
    var ka = 1 - Math.exp(-dt / GLIDE_ACCEL);
    c.vx += (inX * sp - c.vx) * ka;
    c.vy += (inY * sp - c.vy) * ka;
  } else {
    var kd = Math.exp(-dt / TUNE.glide);
    c.vx *= kd; c.vy *= kd;
  }
  var v = Math.hypot(c.vx, c.vy);
  // the floor ends a DRIFT that has become a rounding error — it must never
  // touch a stroke. Applied to a held tick it scaled with the FRAME TIME: on
  // a 120 Hz phone the first bite of a stroke is only 0.08 x moveSpeed, so a
  // spent paddler (13.8 u/s) never cleared 1.5 and the canoe would not move
  // at all, tick after tick. Reviewer's catch; measured, not guessed.
  if (!held && v < GLIDE_FLOOR) { c.vx = 0; c.vy = 0; v = 0; }

  if (v > 0) {
    // the same slide order the walker uses, aimed down the VELOCITY: full
    // move, each axis, then the two 45-degree deflections
    var dx = c.vx / v, dy = c.vy / v, step = v * dt;
    var nx = S.player.x + dx * step, ny = S.player.y + dy * step;
    var ax = (dx - dy) * 0.7, ay = (dy + dx) * 0.7;
    var bx = (dx + dy) * 0.7, by = (dy - dx) * 0.7;
    if (passable(nx, ny)) { S.player.x = nx; S.player.y = ny; }
    else if (passable(nx, S.player.y)) { S.player.x = nx; c.vy = 0; }
    else if (passable(S.player.x, ny)) { S.player.y = ny; c.vx = 0; }
    else if (passable(S.player.x + ax * step, S.player.y + ay * step)) {
      S.player.x += ax * step; S.player.y += ay * step;
      c.vx = ax * v; c.vy = ay * v;
    } else if (passable(S.player.x + bx * step, S.player.y + by * step)) {
      S.player.x += bx * step; S.player.y += by * step;
      c.vx = bx * v; c.vy = by * v;
    } else { c.vx = 0; c.vy = 0; }        // the hull is up against something
  }

  var vn = Math.hypot(c.vx, c.vy);
  S.player.speed = vn;
  if (vn > GLIDE_NOSE && !headLock) {
    S.player.ang = Math.atan2(c.vy, c.vx);      // the hull drifts nose-first
    if (c.vx > 0.1) S.player.face = 1;
    else if (c.vx < -0.1) S.player.face = -1;
  }
  c.x = S.player.x; c.y = S.player.y; c.ang = S.player.ang;
  S.stats.paddle += vn * dt;                    // the odometer counts water covered

  if (!held) return;                            // coasting: no stroke, no cost

  S.player.anim += dt * sp * 0.28;
  var drain = TUNE.drainPaddle;
  if (onBigOpenWater()) {
    var fx = Math.cos(S.wind.from), fy = Math.sin(S.wind.from);
    if (inX * fx + inY * fy > 0.3) drain *= TUNE.headwindDrain;
  }
  if (S.squall) drain *= 1.5;                   // rain-lashed water
  var wasAbove = S.energy > TUNE.exhaustedAt, wasSome = S.energy > 0;
  S.energy = Math.max(0, S.energy - drain * dt);
  if (wasAbove && S.energy <= TUNE.exhaustedAt) {
    toast('Exhausted — eat a snack, or make camp.');
  }
  if (wasSome && S.energy <= 0) {
    toast('Spent. Every stroke is a chore — eat, or make camp.');
  }
  S.strokeT = (S.strokeT || 0) - dt;
  if (S.strokeT <= 0) { AUDIO.paddle(); S.strokeT = S.energy <= 0 ? 1.0 : 0.55; }
}

/**
 * STEERING (note 22). inX/inY are a DIRECTION — a compass vector, which is
 * what the touch stick has always sent and what the fleet driver sends. The
 * optional throttle/steer pair is the steering-keys mapping from main.js:
 * throttle +1 forward / -1 back along the tripper's own heading, steer -1/+1
 * turning that heading left/right. They only build the vector; everything
 * below — terrain, the slide order, energy, momentum, the stroke sounds and
 * every "is it stopped" test — is the same code the stick drives, so the two
 * mappings differ in nothing but how the arrow is pointed.
 *
 * The stick WINS any frame it is live in: a direction is a direction, and a
 * thumb that says "go north-east" is not asking to be turned.
 */
function tickMove(dt, inX, inY, throttle, steer) {
  throttle = throttle || 0; steer = steer || 0;
  var spMul = 1, stick = Math.hypot(inX, inY) >= 0.1;
  if ((throttle || steer) && !stick) {
    if (steer) {
      var rate = (S.travel === 'canoe' && !S.campSession) ? TUNE.turnCanoe : TUNE.turnFoot;
      S.player.ang = wrapAng(S.player.ang + steer * rate * DEG * dt);
    }
    // the heading is authoritative now: the sprite mirrors off IT, not off
    // the way the body happens to be travelling (backing up must not spin
    // the tripper round to face his own heels)
    S.headKeys = true;
    var ca = Math.cos(S.player.ang), sa = Math.sin(S.player.ang);
    if (ca > 0.1) S.player.face = 1;
    else if (ca < -0.1) S.player.face = -1;
    if (throttle) {
      inX = ca * throttle; inY = sa * throttle;
      if (throttle < 0) spMul = STEER_BACK;
    } else {
      inX = 0; inY = 0;      // A/D alone: turn on the spot, no ground covered
    }
  } else if (stick) {
    S.headKeys = false;      // a compass direction takes the heading back
  }
  // ...and the keys keep the heading through the COAST that follows, or
  // letting go of a back-paddle would swing the bow 180 degrees round to the
  // drift, and letting go of A would un-turn the turn you just made (both
  // measured, reviewer's catch). Gated on the dial, so steerKeys 0 is HEAD.
  var headLock = !!S.headKeys && !!TUNE.steerKeys;
  // afloat, with the glide dial off zero, the canoe has its own integrator
  // (note 21). On foot, under the canoe, and on the camp stage nothing here
  // changed — and neither did this path at TUNE.glide 0.
  if (TUNE.glide > 0 && S.travel === 'canoe' && !S.campSession) {
    tickCanoeGlide(dt, inX, inY, spMul, headLock);
    return;
  }
  var mag = Math.hypot(inX, inY);
  if (mag < 0.1) {
    S.player.speed = 0;
    // A/D with no throttle still swings the hull — at TUNE.glide 0 this is the
    // only line that hears about it, because nothing below this return runs
    if (headLock && S.travel !== 'foot' && !S.campSession) S.canoe.ang = S.player.ang;
    return;
  }
  inX /= mag; inY /= mag;

  var sp = moveSpeed(inX, inY) * spMul;
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

  if (!headLock) {                     // steering already set both (note 22)
    S.player.ang = Math.atan2(inY, inX);
    if (inX > 0.1) S.player.face = 1;
    else if (inX < -0.1) S.player.face = -1;
  }
  S.player.speed = sp;
  S.player.anim += dt * sp * 0.28;

  // the canoe rides with you when aboard or overhead
  if (S.travel !== 'foot' && !S.campSession) {
    S.canoe.x = S.player.x; S.canoe.y = S.player.y; S.canoe.ang = S.player.ang;
  }

  // energy — a beach drains at the walk rate it walks at (SAND used to
  // charge the bushwhack rate while moveSpeed gave it walk speed)
  var t2 = terrainAt(S.player.x, S.player.y);
  var drain = S.campSession ? TUNE.drainWalk * 0.5
    : S.travel === 'canoe' ? TUNE.drainPaddle
    : S.travel === 'carry' ? TUNE.drainCarry
    : ((t2 === WORLD.TRAIL || t2 === WORLD.SAND) ? TUNE.drainWalk : TUNE.drainBush);
  if (S.travel === 'canoe' && onBigOpenWater()) {
    var fx = Math.cos(S.wind.from), fy = Math.sin(S.wind.from);
    if (inX * fx + inY * fy > 0.3) drain *= TUNE.headwindDrain;
  }
  if (S.squall && S.travel === 'canoe') drain *= 1.5;   // rain-lashed water
  var wasAbove = S.energy > TUNE.exhaustedAt, wasSome = S.energy > 0;
  S.energy = Math.max(0, S.energy - drain * dt);
  if (wasAbove && S.energy <= TUNE.exhaustedAt) {
    toast('Exhausted — eat a snack, or make camp.');
  }
  if (wasSome && S.energy <= 0) {
    toast('Spent. Every stroke is a chore — eat, or make camp.');
  }

  // the trip log's odometers
  if (S.travel === 'canoe') S.stats.paddle += sp * dt;
  if (S.travel === 'carry') S.stats.portage += sp * dt;
  // paddle strokes, for the ears — slower and rarer on an empty bar, so
  // the body feels it before the HUD says so
  if (S.travel === 'canoe') {
    S.strokeT = (S.strokeT || 0) - dt;
    if (S.strokeT <= 0) { AUDIO.paddle(); S.strokeT = S.energy <= 0 ? 1.0 : 0.55; }
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

/** The closest unpicked berry bush within reach, on foot (note 8). */
function nearestBerry() {
  var best = null, bd = TUNE.interact, i;
  for (i = 0; i < BERRIES.length; i++) {
    var b = BERRIES[i];
    if (S.picked[b.id]) continue;
    var d = Math.hypot(S.player.x - b.x, S.player.y - b.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

/**
 * A handful of blueberries into the pocket (note 8): one snack a bush, once
 * a trip, capped at the pocket's size; two game-minutes of picking so it is
 * not free. The first patch earns a diary line; the rest are just lunch.
 * A full pocket refuses: the bush stays for later, and nothing is scored
 * for a handful that went nowhere (the sweep found SNACK ×9 toasting on a
 * ninth snack that was never gained).
 */
function pickBerries(b) {
  if (S.snacks >= TUNE.berrySnackCap) { toast('Pocket is full — eat a snack first.'); return; }
  S.picked[b.id] = true;
  S.snacks = Math.min(TUNE.berrySnackCap, S.snacks + 1);
  S.stats.berries++;
  S.clock += 2;
  if (S.stats.berries === 1) S.log.push({ day: S.day, text: 'Found blueberries in the bush. Ate half, pocketed the rest.' });
  toast('Blueberries — a handful for the pocket. SNACK ×' + S.snacks + '.');
  AUDIO.chime();
}

/**
 * The whisper (note 8): the first time you walk within 45 u of a patch with
 * berries still on it, one line says there is something here. Once a patch
 * a trip, on foot only — from the canoe the brush is just brush.
 */
function tickBerryHints() {
  if (S.travel !== 'foot') return;
  var i;
  for (i = 0; i < BERRIES.length; i++) {
    var b = BERRIES[i];
    var patch = b.id.slice(0, b.id.indexOf('.'));
    if (S.hinted[patch] || S.picked[b.id]) continue;
    var dx = S.player.x - b.x; if (dx > 45 || dx < -45) continue;
    var dy = S.player.y - b.y; if (dy > 45 || dy < -45) continue;
    if (dx * dx + dy * dy > 45 * 45) continue;
    S.hinted[patch] = true;
    toast('Something blue low in the brush.');
    return;
  }
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
    var fp = S.fish ? S.fish.phase : 'wait';
    return { label: fp === 'strike' ? 'STRIKE!' : fp === 'snag' ? 'SNAGGED — PULL' : 'REEL IN', act: fishAction };
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
      S.log.push({ day: S.day, text: 'Paddled in close to the ' + poW.name + '.' });
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
    // into the pond is a canoe in a puddle (fleet playthrough catch). And
    // only at the end you did NOT shoulder the canoe at (note 2): the sign
    // you started from used to offer PUT IN the instant the carry began,
    // straight back into the lake you had just left. No omnidirectional
    // water search while carrying, ever — mid-trail the button is SET CANOE
    // DOWN and nothing else. A carry that started off any sign (S.carryFrom
    // null) may put in at whichever end it reaches.
    var w = portagePutIn();
    if (w && S.carryFrom && w.portage === S.carryFrom.portage && w.end === S.carryFrom.end &&
        !pastTrailMidpoint(S.carryFrom)) w = null;
    if (w) return { label: 'PUT IN & PADDLE', act: function () {
      // the posted length is credited on the far sign — a whole carry, not
      // an odometer times a factor that only ever fitted one trail
      if (S.carryFrom && (S.carryFrom.portage !== w.portage || S.carryFrom.end !== w.end)) {
        S.stats.portageM += PORTAGES[w.portage].metres;
      }
      putIn(w);
    } };
    return { label: 'SET CANOE DOWN', act: function () {
      S.travel = 'foot'; S.canoe.beached = true;       // carryFrom stays: the carry may resume (trailEndBehind)
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
      // ...unless you shouldered it at THIS sign and set it back down here:
      // then the trail is the thing you changed your mind about, and the
      // lake you just left is the way back (the sweep found CARRY / SET DOWN
      // looping at all six signs with no way onto the water). The put-in is
      // the sign's own outward walk — at the dam's south sign the nearest
      // water is the pond, and the walk knows better. A put-in forgets the
      // sign, so the next tap at a landing is a fresh CARRY.
      if (S.carryFrom && S.carryFrom.portage === pl.portage && S.carryFrom.end === pl.end) {
        var wb = portagePutIn() || waterNearby();
        if (wb) return { label: 'LAUNCH CANOE', act: function () { putIn(wb); } };
      }
      var metres = PORTAGES[pl.portage].metres;
      return { label: 'CARRY CANOE — ' + metres + ' m', act: function () {
        S.travel = 'carry'; S.canoe.beached = false;
        // this sign is behind you now (note 2) — unless the carry began at
        // THIS trail's other sign and was only set down here (a look at the
        // dam, a stray tap on the one button mid-trail offers): then the
        // sign behind you is still the one you started from, and PUT IN
        // stays on offer here. Overwriting it made the far sign a dead end.
        if (!(S.carryFrom && S.carryFrom.portage === pl.portage)) S.carryFrom = { portage: pl.portage, end: pl.end };
      } };
    }
    var w2 = waterNearby();
    if (w2) return { label: 'LAUNCH CANOE', act: function () { putIn(w2); } };
    // shouldered again mid-trail (set down for a look, or for berries): the
    // nearer sign is the one behind you, so the far one still credits the
    // carry; off any trail there is no sign behind you at all
    return { label: 'CARRY CANOE', act: function () { S.travel = 'carry'; S.canoe.beached = false; S.carryFrom = trailEndBehind(); } };
  }
  var po = nearestInspect();
  if (po) return { label: 'LOOK — ' + po.name.toUpperCase(), act: function () {
    // an `info` inspect (the message board, note 21) is read, not looked
    // at: the star dims but no diary line, and the tallies skip it
    S.seenPOIs[po.scene] = true;
    if (!po.info) S.log.push({ day: S.day, text: 'Stood a while at the ' + po.name + '.' });
    openScene(po.scene, po.caption);
  } };
  // last on purpose (note 8): a bush must never shadow the camp ring, the
  // canoe or a vista — the fleet driver walks by label
  var bb = nearestBerry();
  if (bb) return { label: 'PICK BERRIES', act: function () { pickBerries(bb); } };
  return null;
}

function putIn(w) {
  if (!w || !isWater(terrainAt(w.x, w.y))) return;   // never board onto land
  S.travel = 'canoe';
  S.canoe.beached = false;
  S.canoe.vx = 0; S.canoe.vy = 0;        // a boat put in is a boat at rest (note 21)
  S.carryFrom = null;
  S.player.x = w.x; S.player.y = w.y;
  S.canoe.x = w.x; S.canoe.y = w.y;
  AUDIO.paddle();
}

/**
 * Water on the OUTWARD side of the nearest portage end, if we stand at one
 * (within 20 u — wide enough that the far sign feels generous). Returns
 * {x, y, portage, end} so the carry branch can tell which sign it is.
 */
function portagePutIn() {
  var bd = 20, bi = -1, be = 0, i, e;
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
    if (isWater(terrainAt(wx, wy))) return { x: wx, y: wy, portage: bi, end: be };
  }
  return null;
}

/**
 * The sign behind a canoe shouldered mid-trail, as {portage, end}. SET
 * CANOE DOWN keeps S.carryFrom (only a put-in forgets it), so a carry that
 * paused for a look resumes toward the same far sign; with nothing
 * remembered for THIS trail the nearer sign is the best guess. Off every
 * trail (a canoe dragged through the bush) there is no sign behind you.
 */
function trailEndBehind() {
  var pi = -1, pd = 1e9, i, j, e;
  for (i = 0; i < PORTAGES.length; i++) {
    var path = PORTAGES[i].path;
    for (j = 0; j < path.length - 1; j++) {
      var d = distToSeg(S.player.x, S.player.y, path[j], path[j + 1]);
      if (d < pd) { pd = d; pi = i; }
    }
  }
  if (pi < 0 || pd > 8) return null;                 // the trail is stamped 5 u each side
  if (S.carryFrom && S.carryFrom.portage === pi) return S.carryFrom;
  var p2 = PORTAGES[pi].path, ends = [p2[0], p2[p2.length - 1]], best = null, bd = 1e9;
  for (e = 0; e < 2; e++) {
    var de = Math.hypot(S.player.x - ends[e][0], S.player.y - ends[e][1]);
    if (de < bd) { bd = de; best = { portage: pi, end: e }; }
  }
  return best;
}

/**
 * Where along a trail the player stands, 0 at path[0] to 1 at the far end,
 * by projection onto the nearest segment (the fleet driver's carryAim does
 * the same sum). `from` is the {portage, end} the carry began at; past the
 * midpoint means the far half, whichever end that is.
 */
function pastTrailMidpoint(from) {
  var pts = PORTAGES[from.portage].path, total = 0, along = 0, bestD = 1e9, i;
  for (i = 0; i < pts.length - 1; i++) {
    var ax = pts[i][0], ay = pts[i][1], vx = pts[i + 1][0] - ax, vy = pts[i + 1][1] - ay;
    var L2 = vx * vx + vy * vy || 1, L = Math.sqrt(L2);
    var t = Math.max(0, Math.min(1, ((S.player.x - ax) * vx + (S.player.y - ay) * vy) / L2));
    var d = Math.hypot(S.player.x - (ax + vx * t), S.player.y - (ay + vy * t));
    if (d < bestD) { bestD = d; along = total + L * t; }
    total += L;
  }
  var frac = along / (total || 1);
  return from.end === 0 ? frac > 0.5 : frac < 0.5;
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
        S.canoe.vx = 0; S.canoe.vy = 0;      // beached: the drift is over (note 21)
        S.player.speed = 0;
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
  S.log.push({ day: S.day, text: 'The dark caught me out. A rough night.' });
  // afloat, the dinner line still tells the truth: PADDLE ON after cooking
  // (cancelCamp) carries S.roughFed out onto the water with you
  var afloat = S.travel === 'canoe';
  S.canoe.vx = 0; S.canoe.vy = 0;                // you doze; the hull settles
  S.player.speed = 0;
  S.card = {
    title: 'THE DARK CATCHES YOU',
    lines: sleepLine(afloat ? [
      'You drift into a black bay and doze against the gunwales.',
      S.roughFed ? 'At least dinner was eaten before the light went.' : 'Too dark to cook — dinner stays in the barrel.',
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
    button: 'ENDURE', kind: 'rough',
  };
  S.mode = 'card';
}

/**
 * The dawn line: 'Day N — ' and the objective. An objective authored with
 * its own 'Day N — ' lead (parks-shape) drops it here, or the bar reads
 * 'Day 2 — Day 2 — find the cairn' (the v0.8.0 doubling, finally).
 */
function morningToast() {
  var o = OBJS[S.objIndex];
  toast('Day ' + S.day + ' — ' + (o ? o.text.replace(/^Day\s+\d+\s*[—–-]\s*/, '') : 'homeward.'));
}

/**
 * The morning after a ROUGH night — the only card that ends a day out here
 * (a camp's morning is breakCamp). Meals add (note 20), so no morning fills
 * the bar: a rough night floors at 30, or 42 with dinner in.
 */
function nextMorning() {
  S.day++;
  S.clock = TUNE.dayStartMin + 30;      // 06:30, mist on the water
  S.energy = S.roughFed ? TUNE.roughNightFed : TUNE.roughNight;
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
  morningToast();
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
  // the posted lengths, credited per completed carry (note 2) — the old
  // 5.9 m/u odometer factor only ever fitted the dam trail
  var m = st.portageM;
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
  // the catch (note 6): 30 a fish plus 6 a pound, the rarities on their own
  // rows, and the one that gets talked about — the count row stays
  // (pass 5 sweep: st.fish counts the BARREL — a released fish is in S.catches
  // for its own rows, the legend and the release, but never in the count)
  if (S.catches.length) {
    var fishPts = 0, rares = 0, biggest = null, ci;
    for (ci = 0; ci < S.catches.length; ci++) {
      var ct = S.catches[ci];
      if (!biggest || ct.lb > biggest.lb) biggest = ct;
      if (ct.released) continue;
      fishPts += 30 + Math.round(ct.lb * 6);
      if (ct.rare) rares++;
    }
    if (st.fish) add(st.fish + ' fish to the barrel', fishPts || st.fish * 30);
    if (rares) add(rares + (rares === 1 ? ' rare catch' : ' rare catches'), rares * 60);
    for (ci = 0; ci < S.catches.length; ci++) {
      if (S.catches[ci].legend) add(capFirst(S.catches[ci].legend), 150);
      if (S.catches[ci].released) add('Released the tagged research fish', 100);   // pass 5: science thanks you
    }
    if (biggest) add('Biggest: ' + biggest.species + ', ' + biggest.lb.toFixed(1) + ' lb', Math.round(biggest.lb * 10));
  }
  if (S.journal.length) add(S.journal.length + ' wildlife sightings', S.journal.length * 15);
  var sp = Object.keys(S.seen).length;
  if (sp) add(sp + ' species in the journal', sp * 40);
  var pois = vistaTally().seen;
  if (pois) add(pois + (pois === 1 ? ' place' : ' places') + ' properly looked at', pois * 35);
  var skies = Object.keys(st.skySeen).length;
  if (skies) add(skies + (skies === 1 ? ' night sky' : ' night skies') + ' witnessed', skies * 45);
  if (st.boxUses) add('Thunder box, ' + st.boxUses + (st.boxUses === 1 ? ' visit' : ' visits'), Math.min(30, st.boxUses * 5));
  // the site curiosities (note 4): one look per site counts, five sites' worth at most
  var cur = Object.keys(st.features || {}).length;
  if (cur) add(cur + (cur === 1 ? ' campsite curiosity' : ' campsite curiosities'), Math.min(100, cur * 20));
  if (st.berries) add(st.berries + (st.berries === 1 ? ' handful' : ' handfuls') + ' of berries', Math.min(40, st.berries * 8));
  // only the PACKED snacks earn the bonus — berries (note 8) top the pocket
  // up past three, and a full pocket of found food is not restraint
  var unSnacked = Math.min(S.snacks, TUNE.snacks);
  if (unSnacked > 0) add(unSnacked + (unSnacked === 1 ? ' snack' : ' snacks') + ' never needed', unSnacked * 10);
  if (st.roughNights) add(st.roughNights + (st.roughNights === 1 ? ' rough night' : ' rough nights'), st.roughNights * -40);
  if (st.bearRaids) add(st.bearRaids + (st.bearRaids === 1 ? ' bear raid' : ' bear raids'), st.bearRaids * -35);
  return { rows: rows, total: total };
}

/**
 * The vistas, counted honestly (notes 8 + 21): every INSPECT that is a
 * place to look at — the hidden lookout included, so the checklist reads
 * '6 of 7' and nudges the wanderer — but not an `info` one like the
 * message board, which is read, not looked at.
 */
function vistaTally() {
  var seen = 0, of = 0, i;
  for (i = 0; i < INSPECTS.length; i++) {
    if (INSPECTS[i].info) continue;
    of++;
    if (S.seenPOIs[INSPECTS[i].scene]) seen++;
  }
  return { seen: seen, of: of };
}

/** How many of this park's campsites carry a note-4 curiosity. */
function featureCount() {
  return CAMPSITES.filter(function (c) { return c.variant && c.variant.feature; }).length;
}

function completionLines() {
  var vt = vistaTally();
  return [
    'Species seen: ' + Object.keys(S.seen).length + ' of ' + speciesRosterCount(),
    'Vistas looked at: ' + vt.seen + ' of ' + vt.of,
    'Night skies: ' + Object.keys(S.stats.skySeen).length + ' of 3 kinds',
    'Campsites slept: ' + Object.keys(S.stats.sites).length + ' of ' + CAMPSITES.length,
    'Site curiosities: ' + Object.keys(S.stats.features || {}).length + ' of ' + featureCount(),
  ];
}

function endTrip() {
  S.log.push({ day: S.day, text: 'Took out at the ' + PARK.access.short + ' dock. Trip complete.' });
  var sc = computeScore();
  try {
    var k = 'paddlers.best2.' + (S.trip ? S.trip.id : PARK.id);
    if (sc.total > (+localStorage.getItem(k) || 0)) localStorage.setItem(k, String(sc.total));
  } catch (e) {}
  S.card = {
    title: 'TRIP COMPLETE',
    score: sc,
    comp: completionLines(),
    lines: [],
    button: 'CHOOSE THE NEXT PARK', kind: 'end',
  };
  S.mode = 'card';
}

// --- fishing (#4, notes 5 + 6) ------------------------------------------------
// Stop the canoe, put a line in. Waiting costs daylight — that is the price —
// and the strike is a moment: miss it and dinner swims off. What bites is a
// roll over the lake's own fish rows (world.js): the everyday fish by weight,
// the rare rows at their own odds, the legend once in a hundred bites — and
// each only in its hours. Size skews small with the odd trophy. Or a sunken
// stump takes the lure instead, and three pulls decide whether the line
// comes back.

// what bites where nothing is written down: a narrows between two lakes
// fishes as the nearer lake, and this is the fallback when neither resolves
// (the Joe table — smallmouth water, a rock bass, the odd laker)
var DEFAULT_FISH = [
  { species: 'Smallmouth Bass', weight: 62, lbMin: 0.5, lbMax: 3,   big: 4 },
  { species: 'Rock Bass',       weight: 28, lbMin: 0.2, lbMax: 0.6, big: 1 },
  { species: 'Lake Trout',      weight: 10, lbMin: 2,   lbMax: 4,   big: 8, rare: true },
];

// the hours a species keeps when its row says nothing (a row's own `when`
// wins): whitefish rise at dusk, burbot feed after dark
var FISH_WHEN = { 'Lake Whitefish': 'dusk', 'Burbot': 'night' };

/** The bobber, 15 u past the longer bow — where the fx and the snag look. */
function bobberPoint() {
  return { x: S.player.x + Math.cos(S.player.ang) * 15, y: S.player.y + Math.sin(S.player.ang) * 15 };
}

/** The lake's name at a point, or null — through a narrows too. */
function fishLakeNameAt(x, y) {
  var name = lakeAt(x, y), i;
  if (!name) {
    // a channel: the nearer of the two lakes it joins
    for (i = 0; i < CHANNELS.length && !name; i++) {
      var c = CHANNELS[i], a = c.a || c.from, b = c.b || c.to;
      if (!c.lakes || c.lakes.length < 2) continue;
      var vx = b[0] - a[0], vy = b[1] - a[1], len2 = vx * vx + vy * vy || 1;
      var t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / len2));
      if (Math.hypot(x - (a[0] + vx * t), y - (a[1] + vy * t)) <= c.w / 2 + 8) name = c.lakes[t < 0.5 ? 0 : 1];
    }
  }
  return name;
}

/** The fish rows of the lake under the canoe (lake.fish), or DEFAULT_FISH. */
function fishTableHere() {
  var name = fishLakeNameAt(S.player.x, S.player.y), i;
  if (name) {
    for (i = 0; i < LAKES.length; i++) {
      if (LAKES[i].name === name && LAKES[i].fish && LAKES[i].fish.length) return LAKES[i].fish;
    }
  }
  return DEFAULT_FISH;
}

/** Whether a row's hours ('dawn' | 'dusk' | 'night', or none) allow it now. */
function fishWhenOK(row) {
  var when = row.when || FISH_WHEN[row.species];
  if (!when) return true;
  var h = hourNow();
  if (when === 'dawn') return h <= 8.5;          // the morning feed
  if (when === 'dusk') return h >= 17;           // the evening rise
  if (when === 'night') return h >= 20;          // after the light has gone
  return true;
}

function fishPickWeighted(rows, r) {
  var sum = 0, i;
  for (i = 0; i < rows.length; i++) sum += rows[i].weight;
  var at = r() * sum;
  for (i = 0; i < rows.length; i++) { at -= rows[i].weight; if (at <= 0) return rows[i]; }
  return rows[rows.length - 1];
}

/**
 * What bit (note 6): legend, then rare, then the everyday rows, each tier at
 * its odds and each row only in its hours; the size skews small (rnd^2.2)
 * with the odd trophy at or over the row's `big` mark. Returns the catch
 * record that S.catches keeps.
 */
function fishRoll() {
  var rows = fishTableHere(), r = S.rnd;
  var common = [], rare = [], legend = [], i;
  for (i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!fishWhenOK(row)) continue;
    if (row.legend) legend.push(row);
    else if (row.rare) rare.push(row);
    else common.push(row);
  }
  var pick;
  if (legend.length && r() < TUNE.fishLegendChance) pick = fishPickWeighted(legend, r);
  else if (rare.length && r() < TUNE.fishRareChance) pick = fishPickWeighted(rare, r);
  else pick = fishPickWeighted(common.length ? common : rare.length ? rare : rows, r);
  var lb = Math.round((pick.lbMin + (pick.lbMax - pick.lbMin) * Math.pow(r(), 2.2)) * 10) / 10;
  var lakeName = fishLakeNameAt(S.player.x, S.player.y);
  var lake = 'the narrows';
  for (i = 0; i < LAKE_POLYS.length; i++) if (LAKE_POLYS[i].name === lakeName) lake = LAKE_POLYS[i].label;
  return {
    species: pick.species, lb: lb, lake: lake, day: S.day,
    rare: !!pick.rare && !pick.legend, legend: pick.legend || null,
    big: !!pick.big && lb >= pick.big,
    tagged: !!pick.tagged,                 // the research fish (pass 5): landing it RELEASES it for the bonus
  };
}

/** A deadhead or a shore stone within reach of the bobber: snag water. */
function fishSnagNear(b) {
  var reach = TUNE.fishSnagReach, i;
  for (i = 0; i < DEADHEADS.length; i++) {
    if (Math.hypot(DEADHEADS[i].x - b.x, DEADHEADS[i].y - b.y) < reach) return true;
  }
  for (i = 0; i < STONES.length; i++) {
    if (Math.hypot(STONES[i].x - b.x, STONES[i].y - b.y) < reach) return true;
  }
  return false;
}

function fishHourMult() {
  var h = hourNow();
  if ((h >= 5.5 && h <= 8.5) || (h >= 17 && h <= 20.5)) return TUNE.fishPrimeMult;
  if (h >= 11 && h <= 15) return TUNE.fishSlowMult;
  return 1;
}

/** Seconds until the next bite: the base wait, the hour, hot water. */
function fishWait() {
  var hot = S.fishHot > S.clock;
  return (TUNE.fishBiteBase + S.rnd() * TUNE.fishBiteSpread) * (hot ? TUNE.fishHotMult : 1) * fishHourMult();
}

function startFishing() {
  var hot = S.fishHot > S.clock;
  var hm = fishHourMult();
  var reRig = S.reRig;
  S.reRig = false;                        // the parted line cost this one cast
  S.fish = {
    phase: 'wait',
    t: 0,
    biteIn: fishWait() * (reRig ? TUNE.fishReRig : 1),
    window: TUNE.fishWindow,
    pulls: 0,                             // failed pulls on a snag
    catch: null,                          // rolled at the bite
  };
  S.mode = 'fish';
  toast(reRig ? 'Re-rigged and back in. This will take a while.'
    : hot ? 'Line in. The water is boiling with them.'
    : hm < 1 ? 'Line in. The light is right — they should be feeding.'
    : hm > 1 ? 'Line in. Midday — the fish are sulking somewhere cool.'
    : 'Line in. Now the waiting.');
}

function tickFish(dt) {
  // daylight keeps spending while you wait — fishing is never free
  var minPerSec = (TUNE.dayEndMin - TUNE.dayStartMin) / TUNE.daySeconds;
  S.clock += minPerSec * dt;
  // the ripples spread and the pull messages rotate while the line is in —
  // tickGame hands the whole tick here, so the fx and the bar age here too
  tickFx(dt);
  tickToasts(dt);
  var f = S.fish;
  f.t += dt;
  if (f.phase === 'wait' && f.t >= f.biteIn) {
    f.t = 0;
    var b = bobberPoint();
    if (S.rnd() < (fishSnagNear(b) ? TUNE.fishSnagNear : TUNE.fishSnag)) {
      // a stump has the lure: the line stops dead, no splash
      f.phase = 'snag';
      f.pulls = 0;
      toast('The line stops dead. Snagged.');
    } else {
      f.phase = 'strike';
      f.catch = fishRoll();
      // two or three rings spreading from the bobber, not one splash (note 5)
      var n = 2 + (S.rnd() < 0.5 ? 1 : 0), i;
      for (i = 0; i < n; i++) {
        S.fx.push({ ring: true, x: b.x + (S.rnd() - 0.5) * 4, y: b.y + (S.rnd() - 0.5) * 3,
          ttl: 0.6 + i * 0.18, life: 0.6 + i * 0.18 });
      }
      AUDIO.strike();
    }
  } else if (f.phase === 'strike' && f.t > f.window) {
    S.fish = null; S.mode = 'play';
    toast('It got away.');
  }
  if (S.clock >= TUNE.roughMin) { S.fish = null; S.mode = 'play'; roughNight(); }
}

/**
 * The fight (note 6's minigame, a cut that is not built): resolves a strike
 * to the catch it rolled. TUNE.fishFight (hidden dial, 0) is the switch for
 * the eventual live scene — openScene('fishfight', ...) on the firewatch
 * pattern (camp.js fire tending, scenes.js SCENE_PAINTERS), where a big fish
 * could shorten the window or throw the hook. Off, the fish is simply landed.
 */
function fishFight(f) {
  if (TUNE.fishFight) { /* the live scene goes here */ }
  return f.catch || fishRoll();
}

function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/** A landed fish: the barrel, the ledger, the toast, the leap. */
function landFish(c) {
  S.catches.push(c);
  var b = bobberPoint();
  S.fx.push({ sprite: 'fishLeap', x: b.x, y: b.y, ttl: 1.0, life: 1.0, rise: 10 });
  var lbTxt = c.lb.toFixed(1) + ' lb';
  // the tagged research fish (pass 5, the Welcome Lake brookie): it goes
  // back in the water with its tag — no meal, the release is the bonus
  // (computeScore: +100 a release) and the journal says so. It is not
  // counted in S.stats.fish (pass 5 sweep): that is the barrel, and the end
  // card said '1 fish to the barrel' on a trip where none went in
  if (c.tagged) {
    c.released = true;
    toast(capFirst(c.legend || 'a tagged ' + c.species.toLowerCase() + ' — science thanks you') + '. Released, ' + lbTxt + '.');
    S.log.push({ day: S.day, text: 'A tagged ' + c.species.toLowerCase() + ', ' + lbTxt + ', ' + c.lake +
      ' — a research fish. Let it go with its tag. Science thanks you.' });
    AUDIO.chime();
    return;
  }
  S.stats.fish++;
  var meals = c.big ? 2 : 1;                     // +2 at trophy size (critic: barrel-only)
  S.food = Math.min(9, S.food + meals);
  var mealTxt = ' +' + meals + (meals === 1 ? ' meal' : ' meals');
  var lower = c.species.toLowerCase();
  var an = /^[aeiou]/i.test(lower) ? 'An ' : 'A ';
  if (c.legend) {
    toast(capFirst(c.legend) + '! ' + lbTxt + '.' + mealTxt);
    S.log.push({ day: S.day, text: capFirst(c.legend) + ' — ' + c.species + ', ' + lbTxt + ', ' + c.lake +
      '. Nobody is going to believe this.' });
  } else if (c.rare) {
    toast(an + lower + ' — rare here.' + mealTxt);
    S.log.push({ day: S.day, text: an + lower + ' out of ' + c.lake + ', ' + lbTxt + ' — rare here.' });
  } else {
    toast(c.species + ', ' + lbTxt + '!' + mealTxt);
  }
  if (c.big && !c.legend) S.log.push({ day: S.day, text: 'A trophy: ' + c.species + ', ' + lbTxt + ', ' + c.lake + '.' });
  AUDIO.chime();
}

/**
 * One pull on a snagged line: free (a fresh wait, halved — the fish are
 * still there), stuck, or on the third failure the line parts and the next
 * cast waits longer. The third pull ALWAYS ends fish mode; nobody — the
 * fleet driver included — is ever held on a stump.
 */
function pullSnag(f) {
  if (S.rnd() < TUNE.fishSnagFree) {
    f.phase = 'wait'; f.t = 0; f.pulls = 0;
    f.biteIn = fishWait() * 0.5;
    toast('It comes free. Line back in.');
    return;
  }
  f.pulls++;
  if (f.pulls >= 3) {
    S.reRig = true;
    S.fish = null; S.mode = 'play';
    toast('The line parts on a sunken stump. Re-rig.');
    return;
  }
  toast(f.pulls === 1 ? 'Stuck fast. Pull again.' : 'Still stuck. One more pull.');
}

function fishAction() {
  var f = S.fish;
  if (!f) return;
  if (f.phase === 'snag') { pullSnag(f); return; }
  if (f.phase === 'strike') landFish(fishFight(f));
  else toast('Reeled in. Nothing doing.');
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
  if (S.mode !== 'play' || S.mapOpen || S.gearOpen || S.journalOpen || OUTFIT.isOpen()) return;
  if (!S.lookUp || S.skyShown) return;
  S.skyShown = true; S.lookUp = false;
  S.stats.skySeen[S.skyTonight] = true;
  var caps = {
    aurora: 'The aurora, green and silent, the whole width of the north.',
    meteors: 'The Perseids. Count them until you lose count.',
    moonrise: 'The moon comes up the colour of birch bark.',
  };
  S.log.push({ day: S.day, text: S.skyTonight === 'aurora' ? 'The northern lights.' :
    S.skyTonight === 'meteors' ? 'A meteor shower.' : 'Watched the moon rise.' });
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

/** Only the SHOWING notification ages; the pending one waits its turn. */
function tickToasts(dt) {
  if (S.toasts.length) {
    S.toasts[0].ttl -= dt;
    if (S.toasts[0].ttl <= 0) S.toasts.shift();
  }
}

/**
 * Naming the lodge (#9): the first time the canoe passes within 26 units of
 * a standing beaver lodge this trip, one line says what that brown dome in
 * the shallows is — by day the family is inside, and nothing else tells you.
 */
function tickLodges() {
  if (S.travel !== 'canoe') return;
  var i;
  for (i = 0; i < S.huts.length; i++) {
    var h = S.huts[i];
    if (h.seen) continue;
    if (Math.hypot(S.player.x - h.x, S.player.y - h.y) < 26) {
      h.seen = true;
      toast('A beaver lodge — mud and gnawed sticks. The family is inside.');
    }
  }
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
        S.log.push({ day: S.day, text: 'Watched the stars come out over the lake.' });
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
  if (S.mode === 'play' && (S.mapOpen || S.gearOpen || S.journalOpen)) return;   // the map (gear, journal) is a rest stop

  // clock
  var minPerSec = (TUNE.dayEndMin - TUNE.dayStartMin) / TUNE.daySeconds;
  S.clock += minPerSec * dt;
  if (S.clock >= TUNE.roughMin) { roughNight(); return; }
  if (!S.duskWarned && S.clock >= TUNE.duskMin) {
    S.duskWarned = true;
    toast('The light is going — find a campsite (orange sign).');
  }
  if (S.clock < TUNE.duskMin) S.duskWarned = false;

  // throttle/steer are the steering keys (note 22); the fleet driver and the
  // touch stick send a plain {x, y} and these come through undefined, which
  // tickMove reads as zero — the compass path, untouched
  tickMove(dt, input.x, input.y, input.throttle, input.steer);
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
    tickLodges();
    tickBerryHints();
  }
  tickObjectives();
  tickFx(dt);

  // dusk mosquitoes on land, unless a fire is going nearby
  var duskish = S.clock >= TUNE.duskMin;
  var nearFire = S.campfire && Math.hypot(S.player.x - S.campfire.x, S.player.y - S.campfire.y) < 30;
  S.mosquito = duskish && S.travel !== 'canoe' && !nearFire;
  if (S.mosquito) S.energy = Math.max(0, S.energy - TUNE.mosquitoDrain * dt);

  tickToasts(dt);

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
    // back to the shelf as you are: the next park's loadPark deals the
    // fresh S (a newTrip here would deal it on the park just finished)
    // the shelf is the shelf: it gets its tune back here exactly as quitToMenu
    // hands it back (a no-op if the context was never unlocked)
    if (S.card.kind === 'end') { S.card = null; S.mode = 'trips'; AUDIO.song.start(); return; }
    if (S.card.kind === 'boxCheck') { S.card = null; S.mode = 'play'; return; }
    if (S.card.kind === 'feature') {                   // the site curiosity, read (note 4)
      // a long card pages (pass 4): drawCard left the next authored line's
      // index in R.cardNext when its words did not all fit; turn the page
      // and clear it, so a press before the next frame closes rather than
      // re-turning a stale page
      if (R.cardNext !== null && R.cardNext !== undefined) { S.card.page = R.cardNext; R.cardNext = null; return; }
      S.card = null; S.mode = 'play'; return;
    }
    if (S.card.kind === 'fireSafety') {
      S.card = null;
      S.mode = S.scene ? 'scene' : 'play';   // back to the (large) fire
      return;
    }
    if (S.card.kind === 'campNight') { showCampMorning(); return; }
    if (S.card.kind === 'campMorning') { breakCamp(); return; }
    if (S.card.kind === 'rough') { nextMorning(); return; }
    // every kind is routed above; a kind nobody wired is read and dismissed,
    // never a morning (the old fall-through filled the bar to 100)
    S.card = null; S.mode = 'play';
    return;
  }
  if (S.mapOpen) { S.mapOpen = false; return; }
  if (S.gearOpen) { closeGear(); return; }
  if (S.journalOpen) { closeJournal(); return; }
  var a = contextAction();
  if (a) a.act();
}

// --- the journal (note 12) -------------------------------------------------------
// A hand-written diary read at camp: a pause screen layered on 'play' like
// the map. Only the camp stage offers it (the pill lives in drawHUD there,
// key J refuses everywhere else). Opening and closing arm the tap lock so
// the same touch cannot also land on what the paper was covering.

function openJournal() {
  if (S.mode !== 'play' || !S.campSession || S.mapOpen || S.gearOpen || OUTFIT.isOpen()) return;
  S.journalOpen = true; S.journalPage = 0;
  R.tapLock = performance.now() + 320;
}

function closeJournal() {
  if (!S.journalOpen) return;
  S.journalOpen = false;
  R.tapLock = performance.now() + 320;
}

/** Turn a page; the renderer publishes the page count as R.journalN. */
function journalTurn(dir) {
  if (!S.journalOpen) return;
  var n = Math.max(1, R.journalN || 1);
  S.journalPage = Math.max(0, Math.min(n - 1, S.journalPage + dir));
}

function plural(n, one, many) {
  return n + ' ' + (n === 1 ? one : many);
}

/** '12 sightings · 7 entries' — the cover's tally, and the map's one line. */
function journalTally() {
  return plural(S.journal.length, 'sighting', 'sightings') + ' · ' +
    plural(S.log.length, 'entry', 'entries');
}

/**
 * The journal's pages, data to text (note 12): a cover, one section per day
 * in diary order (that day's log lines, then its sightings as lines), a
 * field-list tally, and a catches page at the back. `wrap(str)` returns a
 * string's wrapped lines — the renderer supplies it with the paper width and
 * the hand-written face so nothing here string-measures; `perPage` lines fit
 * under a page's header, and a section that overruns spills onto
 * continuation pages (`cont`). Pages: {kind, title, lines[], cont}.
 */
function journalPages(wrap, perPage) {
  wrap = wrap || function (s) { return [s]; };
  perPage = Math.max(1, perPage || 24);
  var pages = [];
  var section = function (kind, title, raw) {
    var lines = [], i;
    for (i = 0; i < raw.length; i++) lines = lines.concat(wrap(raw[i]));
    if (!lines.length) lines = wrap('Nothing written.');
    var at = 0, first = true;
    while (at < lines.length || first) {
      pages.push({ kind: kind, title: title, lines: lines.slice(at, at + perPage), cont: !first });
      at += perPage; first = false;
    }
  };
  var article = function (name) { return (/^[aeiou]/i.test(name) ? 'an ' : 'a ') + name; };

  // the cover
  pages.push({ kind: 'cover', title: S.trip ? S.trip.name : "PADDLER'S JOURNAL", cont: false,
    lines: ['Day ' + S.day + ' of the trip', journalTally()] });

  // the days
  var d, i;
  for (d = 1; d <= S.day; d++) {
    var raw = [];
    for (i = 0; i < S.log.length; i++) if (S.log[i].day === d) raw.push(S.log[i].text);
    var seen = {}, order = [];
    for (i = 0; i < S.journal.length; i++) {
      var j = S.journal[i];
      if (j.day !== d) continue;
      if (!seen[j.species]) { seen[j.species] = 0; order.push(j.species); }
      seen[j.species]++;
    }
    for (i = 0; i < order.length; i++) {
      var n = seen[order[i]];
      raw.push('Saw ' + article(order[i]) + '.' +
        (n === 2 ? ' Twice.' : n === 3 ? ' Three times.' : n > 3 ? ' ' + n + ' times.' : ''));
    }
    section('day', 'Day ' + d, raw);
  }

  // the field list
  var fl = [], spOrder = [];
  for (i = 0; i < S.journal.length; i++) {
    if (spOrder.indexOf(S.journal[i].species) < 0) spOrder.push(S.journal[i].species);
  }
  for (i = 0; i < spOrder.length; i++) {
    var c = S.seen[spOrder[i]] || 0;
    fl.push(spOrder[i] + (c > 1 ? '  ×' + c : ''));
  }
  if (!spOrder.length) fl.push('No wildlife yet — move gently.');
  var vt = vistaTally();
  fl.push('Vistas seen: ' + vt.seen + ' of ' + vt.of + '.');
  var skyNames = { aurora: 'the northern lights', meteors: 'a meteor shower', moonrise: 'the moonrise' };
  var skies = Object.keys(S.stats.skySeen).map(function (k) { return skyNames[k] || k; });
  fl.push('Skies seen: ' + (skies.length ? skies.length + ' of 3 — ' + skies.join(', ') + '.' : 'none yet.'));
  section('list', 'Field list', fl);

  // the catches (note 6): 'Day 2 — Lake Trout, 4.3 lb, Burnt Island Lake',
  // the rarities and the legend saying so after a dash
  var ct = [];
  if (S.catches && S.catches.length) {
    for (i = 0; i < S.catches.length; i++) {
      var k = S.catches[i];
      ct.push('Day ' + k.day + ' — ' + k.species + ', ' + k.lb.toFixed(1) + ' lb, ' + k.lake +
        (k.released ? ' — tagged, released' : k.legend ? ' — ' + k.legend : k.rare ? ' — rare here' : k.big ? ' — a trophy' : ''));
    }
  } else ct.push('Nothing landed yet.');
  section('catch', 'Catches', ct);
  return pages;
}

// --- the gear menu (note 13) ---------------------------------------------------
// A pause screen layered on 'play' exactly like the map: sound, a two-step
// way home, resume. Opening and closing live here so every input path
// (pill, Escape, E) agrees on what 'closed' means — the confirm step never
// survives a close.

function openGear() {
  if (S.mode !== 'play' || S.mapOpen || S.journalOpen || OUTFIT.isOpen()) return;
  S.gearOpen = true; S.gearConfirm = false;
}

function closeGear() {
  S.gearOpen = false; S.gearConfirm = false;
}

/**
 * Abandon the trip: back to the title screen with nothing kept. newTrip
 * rebuilds S wholesale (the camp session, the scene, the card all go with
 * it) and startPark resets the day and clock, so the shelf stays outside
 * time; the best score is never written, so an abandoned trip scores
 * nothing. The tap lock keeps the YES tap from also tapping the title.
 */
function quitToMenu() {
  AUDIO.hush();
  AUDIO.song.start();     // back on the title: the tune picks up again (no-op if locked)
  newTrip();
  S.mode = 'title';
  R.tapLock = performance.now() + 320;
}

function eatSnack() {
  if (S.mode !== 'play' || S.mapOpen || S.gearOpen || S.journalOpen || OUTFIT.isOpen() || S.snacks <= 0) return;
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
