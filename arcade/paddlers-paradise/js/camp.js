// PADDLER'S PARADISE — CAMP (the scene)
// ---------------------------------------------------------------------------
// Camp is a SCENE SWITCH, not a zoom (Evrtek's ruling, v0.3.0): landing at an
// orange sign and making camp fades to a dedicated stage — its own layout,
// its own collision, its own high-fidelity sprite set at double the
// overworld's texel density. The paddling world is the overworld; this is
// the intimate room inside it. Break camp and the overworld fades back in,
// with the trip exactly where you left it.
//
// The stage is one hand-authored campsite every camp shares — the fire ring
// centre-stage, the tent pad up and right, the water along the bottom with
// the canoe pulled up, deadfall back in the trees, the barrel rope on the big
// pine at left, the thunder box discreetly up its path. All chores by
// proximity; every choice keeps its consequence.
// ---------------------------------------------------------------------------

'use strict';

var CAMP = {
  W: 160, H: 100,            // stage size in scene units
  fire:   { x: 80,  y: 48 },
  tent:   { x: 116, y: 34 },
  bench:  { x: 80,  y: 36 },   // just behind the fire, facing it and the lake (#6)
  barrel: { x: 100, y: 56 },   // where the blue barrel sits until it is hung (#14)
  barrelPine: { x: 18, y: 40 },// where it hangs once you have done the right thing
  box:    { x: 143, y: 15 },
  deadwood: [
    { x: 34,  y: 19, kind: 'snag' },
    { x: 124, y: 18, kind: 'snag' },
    { x: 62,  y: 15, kind: 'log'  },
    { x: 40,  y: 48, kind: 'log'  },
  ],
  canoe:  { x: 30,  y: 68 },
  sign:   { x: 102, y: 70 },
  trees: [
    { x: 18,  y: 34, kind: 'hdBigPine' }, // the barrel pine, towering apart (#3)
    { x: 8,   y: 46, kind: 'hdBirch' },   // a birch beside it, so the pair reads as two
    { x: 152, y: 40, kind: 'hdPine'  },
    { x: 150, y: 56, kind: 'hdBirch' },
  ],
  rocks: [ { x: 54, y: 58 }, { x: 118, y: 56 }, { x: 140, y: 66 } ],
  treeline: [],              // generated below: the forest wall along the top
  phase: 1.2,                // per-site shoreline character (#4)
  coveX: 30,                 // where the water bites in and the canoe lands
  groundSeed: 0xCA4B1,
  treeSeed: 0,
};

// The shoreline is a CURVE, not a band — the cove is where the canoe is
// pulled up. Shared by the painter, the collision, and the water; its phase
// and cove position are per-site now (#4).
function shoreY(x) {
  return 76
    + Math.sin(x * 0.045 + CAMP.phase) * 3
    + Math.sin(x * 0.013 + CAMP.phase + 0.9) * 4
    - Math.max(0, 8 - Math.abs(x - CAMP.coveX) * 0.35);
}

function buildCampTreeline() {
  // a WALL of forest, crowns overlapping — two staggered passes, with the
  // one gap kept in front of wherever this site's thunder box stands
  CAMP.treeline.length = 0;
  var pass, x;
  for (pass = 0; pass < 2; pass++) {
    x = 3 + pass * 4;
    while (x < 157) {
      var h = ((x + pass * 131 + CAMP.treeSeed * 977) * 2654435761) >>> 0;
      var y = (pass === 0 ? 1 : 6) + (h % 5);
      var kind = (h % 5) < 3 ? 'hdPine' : 'hdBirch';
      var gap = Math.abs(x - CAMP.box.x) < 7 && pass === 1;
      if (!gap) CAMP.treeline.push({ x: x, y: y, kind: kind, front: pass === 1 });
      x += 5 + (h % 4);
    }
  }
  CAMP.treeline.sort(function (a, b) { return a.y - b.y; });
}
buildCampTreeline();

// --- per-site character (#4): mirrors, moved furniture, its own shore ------
// The faces live on the park now (world.js: campsite.variant, one per site);
// loadPark fills this table from them. A site with no face gets the default.
var CAMP_BASE = null;
var CAMP_VARIANTS = {};
var CAMP_DEFAULT_VARIANT = { mirror: false, phase: 1.2, coveX: 30, groundSeed: 0xCA4B1, treeSeed: 0 };

function applyCampVariant(siteId) {
  if (!CAMP_BASE) {
    CAMP_BASE = JSON.parse(JSON.stringify({
      tent: CAMP.tent, box: CAMP.box, barrel: CAMP.barrel,
      barrelPine: CAMP.barrelPine, canoe: CAMP.canoe, sign: CAMP.sign,
      trees: CAMP.trees, rocks: CAMP.rocks, deadwood: CAMP.deadwood,
    }));
  }
  var b = JSON.parse(JSON.stringify(CAMP_BASE));
  var v = CAMP_VARIANTS[siteId] || CAMP_DEFAULT_VARIANT;
  var mx = function (p) { if (v.mirror) p.x = CAMP.W - p.x; return p; };
  CAMP.tent = mx(b.tent); CAMP.box = mx(b.box); CAMP.barrel = mx(b.barrel);
  CAMP.barrelPine = mx(b.barrelPine); CAMP.canoe = mx(b.canoe); CAMP.sign = mx(b.sign);
  CAMP.trees = b.trees.map(mx); CAMP.rocks = b.rocks.map(mx); CAMP.deadwood = b.deadwood.map(mx);
  CAMP.feature = null;               // no site inherits the last one's curiosity
  var k;
  for (k in v) {
    if (k === 'mirror' || k === 'phase' || k === 'coveX' || k === 'groundSeed' || k === 'treeSeed') continue;
    // a plain {x, y} override copies as before; the site's `feature` (note 4)
    // carries its sprite, label, card lines and journal entry along with its
    // stage spot, so copy the whole record — the overrides are already in
    // this site's own (mirrored) stage coordinates
    CAMP[k] = JSON.parse(JSON.stringify(v[k]));
  }
  CAMP.phase = v.phase; CAMP.coveX = v.coveX;
  CAMP.groundSeed = v.groundSeed; CAMP.treeSeed = v.treeSeed;
  buildCampTreeline();
  campGround = null;                 // the painter rebuilds this site's floor
}

// solid things the tripper walks around, not through
function campBlockers() {
  var b = [];
  CAMP.trees.forEach(function (t) {
    b.push({ x: t.x, y: t.y + 4, r: t.kind === 'hdBigPine' ? 3.2 : 2.4 });   // the big pine has a big butt
  });
  CAMP.treeline.forEach(function (t) {
    if (t.front) b.push({ x: t.x, y: t.y + 5, r: 2.2 });
  });
  CAMP.rocks.forEach(function (r) { b.push({ x: r.x, y: r.y, r: 3.4 }); });
  // the site's curiosity (note 4) is solid too — a small radius, so it
  // never pinches the walk between the ring and the furniture round it
  if (CAMP.feature) b.push({ x: CAMP.feature.x, y: CAMP.feature.y, r: CAMP.feature.r || 3 });
  b.push({ x: CAMP.bench.x, y: CAMP.bench.y, r: 2.2 });
  CAMP.deadwood.forEach(function (d) {
    if (d.kind === 'snag') b.push({ x: d.x, y: d.y + 4, r: 2 });
  });
  b.push({ x: CAMP.fire.x, y: CAMP.fire.y, r: 4 });
  b.push({ x: CAMP.box.x, y: CAMP.box.y, r: 3 });
  b.push({ x: CAMP.canoe.x, y: CAMP.canoe.y, r: 4 });
  // no tent blocker: pitching it used to spawn a collider under the player's
  // own feet and freeze them beside it (the drive slept through a whole night
  // because the only button in reach was TURN IN)
  return b;
}

function campPassable(x, y) {
  if (x < 4 || x > CAMP.W - 4) return false;
  if (y < 4 || y > shoreY(x) - 1) return false;      // ankles stay dry
  var bs = campBlockers(), i;
  for (i = 0; i < bs.length; i++) {
    var dx = x - bs[i].x, dy = y - bs[i].y;
    if (dx * dx + dy * dy < bs[i].r * bs[i].r) {
      // never trap someone already inside a blocker — stepping OUT is always
      // legal, or a collider spawned underfoot becomes a cage
      var px = S.player.x - bs[i].x, py = S.player.y - bs[i].y;
      if (px * px + py * py < bs[i].r * bs[i].r) continue;
      return false;
    }
  }
  return true;
}

function enterCamp(site) {
  // remember exactly where the overworld trip pauses
  S.campReturn = { x: S.player.x, y: S.player.y };
  applyCampVariant(site.id);                          // this site's own face (#4)
  var spawnX = CAMP.coveX + (CAMP.coveX < 80 ? 14 : -14);
  S.player.x = spawnX; S.player.y = shoreY(spawnX) - 6;
  S.player.ang = -Math.PI / 2;
  S.campSession = {
    site: site,
    chores: { tent: false, wood: 0, fire: false, cooked: false,
              barrel: false, box: 0, stars: false, satTonight: false,
              feature: false },        // had a look at the site's curiosity (note 4)
    guided: S.stats.camps === 0,
    critters: [], critT: 6,
    barrelPos: { x: CAMP.barrel.x, y: CAMP.barrel.y },   // where it rests (#2)
    carryingBarrel: false,
    lookHint: false,                 // the guided 'worth a look' line, owed once the bar is free (note 4)
    carryingWood: 0,                 // split logs in your arms; chores.wood is the PILE at the ring (#10)
    sources: CAMP.deadwood.map(function (d) {
      return { x: d.x, y: d.y, kind: d.kind, chops: 0, done: false };
    }),
    chopT: 0, chopAt: null, chopHit: false, chips: [],
    fireFuel: 0, logsAdded: 0, fireDied: false, emberMin: 0,
    capSpam: 0, safetyShown: false,
    visitor: null,
    visitorDone: S.rnd() < 0.35,   // some evenings, nobody passes (#5)
    visitorWait: 8 + S.rnd() * 22,
  };
  S.fadeT = performance.now();                       // the scene fades in
  toast('Camp at ' + site.name + '.');
  if (S.campSession.guided) toast('First: pitch the tent on the flat spot.');
}

function leaveCampWorld() {
  // back to the overworld, exactly where the trip paused
  if (S.campReturn) {
    S.player.x = S.campReturn.x;
    S.player.y = S.campReturn.y;
    S.campReturn = null;
  }
  S.fadeT = performance.now();
}

function campNear(p, d) {
  return Math.hypot(S.player.x - p.x, S.player.y - p.y) < (d || 12);
}

/**
 * The context action while at camp: gather every station in reach, serve the
 * NEAREST. All positions are stage coordinates.
 */
function campAction() {
  var cs = S.campSession;
  if (!cs) return null;
  var ch = cs.chores;

  // mid-swing (and for a beat after a tree finishes) the axe owns the
  // button: no chore can be mash-triggered through the end of a chop —
  // the fleet walked a finishing press straight into TURN IN
  if (cs.chopT > 0 || (cs.actCool || 0) > 0) return null;

  // both hands are full: hang it or set it down, nothing else (#2)
  if (cs.carryingBarrel) {
    var dPine = Math.hypot(S.player.x - CAMP.barrelPine.x, S.player.y - CAMP.barrelPine.y);
    if (dPine < 12) {
      return { label: 'HANG THE BARREL', act: function () {
        cs.carryingBarrel = false;
        ch.barrel = true;
        toast('Barrel high on the pine, well off the ground. Sleep easier.');
      } };
    }
    return { label: 'SET BARREL DOWN', act: function () {
      cs.carryingBarrel = false;
      cs.barrelPos = { x: S.player.x, y: S.player.y + 2 };
      toast('The barrel rests where you drop it. Bears take note.');
    } };
  }

  var cands = [];
  var add = function (p, r, label, act) {
    var d = Math.hypot(S.player.x - p.x, S.player.y - p.y);
    // i breaks exact ties (STACK THE WOOD and LIGHT FIRE share the ring's
    // spot) in ADD order, whatever the engine's sort does with equal keys
    if (d < r) cands.push({ d: d, label: label, act: act, i: cands.length });
  };

  add(CAMP.tent, 13, ch.tent ? 'TURN IN' : 'PITCH TENT', ch.tent ? finishCampNight : function () {
    ch.tent = true;
    toast('Tent up. Home for the night.');
    if (cs.guided) toast('The axe wants work — buck a dead tree, carry the splits to the ring.');
    // the bar holds one line and one pending: a third push here would evict
    // the axe line unrendered, so the look hint waits its turn (tickCampLife)
    if (cs.guided && CAMP.feature) cs.lookHint = true;
  });

  // firewood is chopped, not found stacked: each dead tree takes a few
  // swings of the axe to buck into an armload — and the armload is CARRIED
  // to the ring (#10), not teleported. Arms at the cap: the axe waits.
  var armsFull = cs.carryingWood >= TUNE.armload;
  cs.sources.forEach(function (sc) {
    if (sc.done) return;
    add(sc, 9, armsFull ? 'ARMS FULL' : 'CHOP WOOD', armsFull ? function () {
      toast('ARMS FULL — STACK IT FIRST');
    } : function () {
      if (cs.chopT > 0) return;              // mid-swing already
      cs.chopT = 0.0001;
      cs.chopAt = sc;
      cs.chopHit = false;
      AUDIO.chop(0.2);                        // the thock lands with the blade
    });
  });

  // the pile lives at the ring: stack what you carried, then the fire
  if (cs.carryingWood > 0) {
    add(CAMP.fire, 12, 'STACK THE WOOD', function () {
      ch.wood += cs.carryingWood;
      cs.carryingWood = 0;
      if (S.woodMarker === 1) S.woodMarker = 2;    // the ring said where; you went (note 21)
      toast('Stacked — ' + ch.wood + ' in the pile.');
      if (cs.guided && ch.wood >= 6 && !ch.fire) toast('Enough to burn — light the fire ring.');
    });
  }

  if (!ch.fire) {
    add(CAMP.fire, 12, ch.wood >= 6 ? 'LIGHT FIRE' : 'NEED MORE WOOD', ch.wood >= 6 ? function () {
      ch.fire = true;
      ch.wood -= 6;                     // six split logs build the base
      cs.fireFuel = 5;
      // logsAdded and fireDied are EVENING ledgers, not per-lighting: a
      // relit fire does not erase the lapse the night card should mention
      S.campfire = { x: CAMP.fire.x, y: CAMP.fire.y };
      toast('The fire catches. Mosquitoes keep their distance.');
      if (cs.guided) toast('Dinner cooks over a real fire.');
    } : function () {
      toast('The ring wants ' + (6 - ch.wood) + ' more split log' + (6 - ch.wood === 1 ? '' : 's') + '.');
    });
  } else if (!ch.cooked) {
    add(CAMP.fire, 12, S.food > 0 ? 'COOK DINNER' : 'BARREL IS EMPTY', S.food > 0 ? function () {
      ch.cooked = true; S.food--;
      // a hot meal ADDS to the bar (note 20 reverses the v0.8.0 fill-to-full
      // #6 order): dinner + sleep + breakfast wake a drained arrival near 85
      S.energy = Math.min(TUNE.energyMax, S.energy + TUNE.dinnerEnergy);
      toast('Dinner over the fire — you feel whole again.' + (S.food === 0 ? ' Last of the barrel.' : ''));
      if (cs.guided) toast('Hang the barrel on the big pine — bears know campsites.');
    } : function () {
      toast('Nothing left to cook. A fish tomorrow would fix that.');
    });
  }

  // both hands are under the wood: the barrel waits until it is stacked
  if (!ch.barrel && !cs.carryingWood) add(cs.barrelPos, 9, 'PICK UP THE BARREL', function () {
    cs.carryingBarrel = true;
    toast('Sixty pounds of dinners. Now, the big pine.');
    if (cs.guided) toast('Carry it to the big pine at the ' +
      (CAMP.barrelPine.x < 80 ? 'left' : 'right') + ' and hang it.');
  });

  add(CAMP.box, 11, 'VISIT THE THUNDER BOX', function () {
    ch.box++;
    S.stats.boxUses++;
    if (ch.box === 1) {
      S.energy = Math.min(TUNE.energyMax, S.energy + 4);
      toast('The throne of the interior. No further comment.');
    } else if (ch.box === 2) {
      S.energy = Math.min(TUNE.energyMax, S.energy + 1);
      toast('Back already? The chipmunks are starting to talk.');
    } else if (ch.box === 3) {
      S.card = {
        title: 'A DELICATE QUESTION',
        lines: ['Three visits before bedtime.',
                'Feeling alright out there, tripper?',
                'Maybe go easier on the lake coffee.'],
        button: 'NEVER BETTER', kind: 'boxCheck',
      };
      S.mode = 'card';
    } else {
      toast('The box creaks in weary recognition.');
    }
  });

  // the thing about this site worth a look (note 4): every site has one —
  // a ledge, a lashed table, a split boulder, a clawed birch — and the first
  // look of the trip writes the journal and counts on the score card; every
  // look after it just reads the card again
  if (CAMP.feature) add(CAMP.feature, 10, CAMP.feature.label, function () {
    var f = CAMP.feature, siteId = cs.site.id;
    ch.feature = true;
    if (!S.stats.features[siteId]) {
      S.stats.features[siteId] = true;
      S.log.push({ day: S.day, text: featureEntry(f.entry, S.day) });
    }
    S.card = { title: f.title, lines: f.lines.slice(), button: 'HUH.', kind: 'feature' };
    S.mode = 'card';
  });

  // living trees are spoken for (#3): the axe refuses, three ways
  CAMP.trees.forEach(function (tr) {
    add({ x: tr.x, y: tr.y + 4 }, 8, 'CHOP TREE', function () {
      cs.greenChops = (cs.greenChops || 0) + 1;
      toast(cs.greenChops === 1
        ? 'The axe stops an inch from green bark. Living trees stand.'
        : cs.greenChops === 2
        ? 'Still alive, still spoken for — DEAD trees are the firewood.'
        : 'The pine declines. Firmly.');
    });
  });

  // the bench faces the fire with the whole lake behind it — sit, and the
  // screen becomes the view (#6, #7). Time keeps flowing while you watch.
  add(CAMP.bench, 9, ch.fire ? 'WATCH THE FIRE' : 'SIT A WHILE', function () {
    if (!ch.satTonight) { ch.satTonight = true; S.stats.fireSits++; }
    var hh = hourNow();
    if (hh >= 19.6 && !ch.stars) {
      ch.stars = true;
      S.log.push({ day: S.day, text: 'Watched the stars come out over the lake.' });
    }
    var cap = hh >= 20.3 ? 'Sparks climb. The stars hold still.'
      : hh >= 18.6 ? 'The sun leans on the far treeline. Stay for this.'
      : 'The lake breathes. You match it.';
    openScene('firewatch', cap, 'time keeps moving — tap to stand up', true);
  });

  // deciding not to stay is allowed (#2): the canoe is right there
  var canoeNearReturn = S.campReturn &&
    Math.hypot(S.canoe.x - S.campReturn.x, S.canoe.y - S.campReturn.y) < 60;
  add(CAMP.canoe, 10, canoeNearReturn ? 'PADDLE ON' : 'MOVE ON', function () {
    cancelCamp();                            // back on the overworld, camp struck
    var close = Math.hypot(S.canoe.x - S.player.x, S.canoe.y - S.player.y) < 60;
    var w = waterNearby();
    if (!w && close) {
      // the beached canoe is guaranteed to sit at the water's edge — probe
      // from THERE when the camp stood too far inland
      var sx0 = S.player.x, sy0 = S.player.y;
      S.player.x = S.canoe.x; S.player.y = S.canoe.y;
      w = waterNearby();
      if (!w) { S.player.x = sx0; S.player.y = sy0; }
    }
    if (w && close) { putIn(w); toast('Not tonight — you push off again.'); }
    else toast('You walk back out. The site keeps its silence.');
  });

  if (!cands.length) return null;
  cands.sort(function (a, b) { return a.d - b.d || a.i - b.i; });
  return cands[0];
}

/**
 * A feature's journal entry is authored 'Day N — …' (parks-shape §1.7): put
 * the day in for N, then drop that lead — S.log carries {day, text} and the
 * journal (note 12) already heads each day's page, so the line reads like
 * its neighbours ('Camped at …', 'Watched the stars …').
 */
function featureEntry(entry, day) {
  var s = String(entry || '').replace(/\bN\b/, String(day));
  return s.replace(/^Day\s+\d+\s*[—–-]\s*/, '');
}

// --- the night, and the morning after ----------------------------------------

function cancelCamp() {
  if (S.campSession) {
    S.suppressCampId = S.campSession.site.id;
    S.roughFed = !!S.campSession.chores.cooked;   // dinner was real and paid for: the dark credits it
  }
  S.campSession = null;
  S.campfire = null;
  leaveCampWorld();
}

/**
 * Camp has small lives of its own (#15): chipmunks and red squirrels dart in
 * from the treeline, check a rock or the woodpile for crumbs, and dart back.
 * Come at one too fast and it leaves early.
 */
function tickCampLife(dt) {
  var cs = S.campSession;
  if (!cs) return;

  // the guided look hint (note 4), delivered when the bar is empty — after
  // the tent's two lines have had their turn; moot once the look is taken
  if (cs.lookHint && (cs.chores.feature || !CAMP.feature)) cs.lookHint = false;
  else if (cs.lookHint && !S.toasts.length) {
    cs.lookHint = false;
    toast('Something about this site is worth a look.');
  }

  // the axe swing: raised, falling, impact at 0.24s, recovered by 0.42s
  if (cs.chopT > 0) {
    cs.chopT += dt;
    if (!cs.chopHit && cs.chopT >= 0.24 && cs.chopAt) {
      cs.chopHit = true;
      var sc2 = cs.chopAt;
      sc2.chops++;
      S.energy = Math.max(0, S.energy - TUNE.chopEnergy);
      var ci;
      for (ci = 0; ci < 5; ci++) {
        cs.chips.push({
          x: sc2.x + (S.rnd() - 0.5) * 2.5,
          y: sc2.y - (sc2.kind === 'snag' ? 0 : 1),
          vx: (S.rnd() - 0.5) * 26, vy: -14 - S.rnd() * 16,
          ttl: 0.45 + S.rnd() * 0.3,
        });
      }
      if (sc2.chops >= TUNE.chopSwings) {
        sc2.done = true;
        cs.actCool = 0.5;               // a breath before the next station answers
        cs.carryingWood += TUNE.logsPerTree;      // in your arms, not yet in the pile (#10)
        // the words say "the ring"; the FIRST armload of the trip also gets
        // the ring pointed at, in the same orange dots the campsite targets
        // use (note 21, Evrtek's play note)
        if (S.woodMarker === 0) S.woodMarker = 1;
        toast('Split — an armload of ' + TUNE.logsPerTree + '. Carry it to the ring.');
      }
    }
    if (cs.chopT >= 0.42) { cs.chopT = 0; cs.chopAt = null; }
  }
  if (cs.actCool > 0) cs.actCool -= dt;
  var wi;
  for (wi = cs.chips.length - 1; wi >= 0; wi--) {
    var cp = cs.chips[wi];
    cp.vy += 70 * dt;
    cp.x += cp.vx * dt;
    cp.y += cp.vy * dt;
    cp.ttl -= dt;
    if (cp.ttl <= 0) cs.chips.splice(wi, 1);
  }
  if (!cs.critters) { cs.critters = []; cs.critT = 6; }
  cs.critT -= dt;
  if (cs.critT <= 0 && cs.critters.length < 2) {
    cs.critT = TUNE.critterEvery * (0.6 + S.rnd() * 0.9);
    var targets = [CAMP.rocks[0], CAMP.rocks[1], CAMP.deadwood[0], CAMP.deadwood[3], CAMP.sign];
    var tgt = targets[Math.floor(S.rnd() * targets.length)];
    var x0 = 10 + S.rnd() * (CAMP.W - 20);
    var tx0 = tgt.x + (S.rnd() - 0.5) * 6;
    var ty0 = tgt.y + 3 + (S.rnd() - 0.5) * 3;
    if (ty0 > shoreY(tx0) - 2) ty0 = shoreY(tx0) - 2;   // paws stay dry
    cs.critters.push({
      kind: S.rnd() < 0.65 ? 'hdChip' : 'hdSquirrel',
      x: x0, y: 7 + S.rnd() * 4, ex: x0, ey: 6,
      tx: tx0, ty: ty0,
      phase: 'in', pause: 1 + S.rnd() * 2, anim: 0, face: 1,
    });
  }
  var i;
  for (i = cs.critters.length - 1; i >= 0; i--) {
    var c = cs.critters[i];
    c.anim += dt * 10;
    // a heavy footstep nearby ends the visit
    if (c.phase !== 'out' &&
        Math.hypot(S.player.x - c.x, S.player.y - c.y) < 9 && S.player.speed > 20) {
      c.phase = 'out';
    }
    if (c.phase === 'pause') {
      c.pause -= dt;
      if (c.pause <= 0) c.phase = 'out';
      continue;
    }
    var gx = c.phase === 'in' ? c.tx : c.ex;
    var gy = c.phase === 'in' ? c.ty : c.ey;
    var dx = gx - c.x, dy = gy - c.y, d = Math.hypot(dx, dy);
    if (d < 1.5) {
      if (c.phase === 'in') c.phase = 'pause';
      else cs.critters.splice(i, 1);
      continue;
    }
    var sp = c.phase === 'out' ? 42 : 30;
    var nx2 = c.x + (dx / d) * sp * dt;
    var ny2 = c.y + (dy / d) * sp * dt;
    // never through the fire, the box, the canoe — or into the lake
    var solids = [
      { x: CAMP.fire.x, y: CAMP.fire.y, r: 5 },
      { x: CAMP.box.x, y: CAMP.box.y, r: 3 },
      { x: CAMP.canoe.x, y: CAMP.canoe.y, r: 4 },
    ];
    var blocked = ny2 > shoreY(nx2) - 1, bi;
    for (bi = 0; bi < solids.length && !blocked; bi++) {
      var bdx = nx2 - solids[bi].x, bdy = ny2 - solids[bi].y;
      if (bdx * bdx + bdy * bdy < solids[bi].r * solids[bi].r) blocked = true;
    }
    if (blocked) {
      var px2 = c.x - (dy / d) * sp * dt, py2 = c.y + (dx / d) * sp * dt;
      if (py2 <= shoreY(px2) - 1) { c.x = px2; c.y = py2; }
      else c.phase = 'out';                 // skirting failed; call it a day
    } else { c.x = nx2; c.y = ny2; }
    if (dx > 0.5) c.face = 1; else if (dx < -0.5) c.face = -1;
  }
}

/**
 * The fire burns DOWN while you sit with it (Evrtek's firewatch minigame):
 * a bigger fire eats faster, embers warn you, and an untended fire dies —
 * relighting costs six fresh logs. Runs only inside the firewatch scene.
 */
function sceneSay(msg) {
  if (!S.scene) return;
  S.scene.caption = msg;
  S.scene.capT = performance.now();
  S.scene.capHold = performance.now() + 6500;   // the hourly caption waits
}

function tickFireTending(gameMin) {
  var cs = S.campSession;
  if (!cs || !cs.chores.fire) return;
  var burn = (0.022 + cs.fireFuel * 0.0075) * TUNE.fireBurn;   // 6 logs lasts an honest evening
  cs.fireFuel = Math.max(0, cs.fireFuel - burn * gameMin);
  if (cs.fireFuel <= 0.01) {
    cs.emberMin += gameMin;
    if (!cs.warnedEmbers) {
      cs.warnedEmbers = true;
      sceneSay('Down to embers — feed the fire or lose it.');
    }
    if (cs.emberMin > 20) {
      cs.chores.fire = false;
      cs.fireDied = true;
      S.stats.fireDied++;
      S.campfire = null;
      sceneSay('The fire is out. The dark feels bigger than it was.');
    }
  } else {
    cs.emberMin = 0;
    cs.warnedEmbers = false;
  }
}

/**
 * Someone paddles by while you sit with the fire (#5) — about once a day.
 * A wave is optional. Waving is correct.
 */
function tickVisitor(dt) {
  var cs = S.campSession;
  if (!cs || cs.visitorDone) return;
  if (!cs.visitor) {
    cs.visitorWait -= dt;
    if (cs.visitorWait <= 0) {
      cs.visitor = {
        t: 0, dur: 22,
        dir: S.rnd() < 0.5 ? 1 : -1,
        lane: S.rnd(),
        waved: false, wavedBack: 0,
      };
    }
    return;
  }
  var v = cs.visitor;
  v.t += dt;
  if (v.wavedBack > 0) v.wavedBack -= dt;
  if (v.t > v.dur) { cs.visitor = null; cs.visitorDone = true; }
}

function waveAtVisitor() {
  var cs = S.campSession;
  if (!cs || !cs.visitor || cs.visitor.waved) return;
  if (S.mode !== 'scene' || !S.scene || S.scene.name !== 'firewatch') return;
  cs.visitor.waved = true;
  cs.visitor.wavedBack = 3;
  S.stats.waves++;
  AUDIO.hail();
  sceneSay('You raise a hand. They lift a paddle in reply.');
}

function addFireLog() {
  var cs = S.campSession;
  if (!cs || S.mode !== 'scene' || !S.scene || S.scene.name !== 'firewatch') return;
  if (!cs.chores.fire) { sceneSay('Only cold stone here now. Six logs would start again.'); return; }
  if (cs.chores.wood <= 0) { sceneSay('No split wood left — the axe waits by the dead trees.'); return; }
  if (cs.fireFuel >= 12) {
    cs.capSpam++;                        // hammering a full ring IS the signal
    sceneSay('The ring cannot hold more than this.');
    maybeFireSafety(cs);
    return;
  }
  cs.chores.wood--;
  cs.fireFuel = Math.min(12, cs.fireFuel + 1);
  cs.logsAdded++;
  cs.capSpam = 0;
  S.stats.logsFed++;
  AUDIO.feed();
  maybeFireSafety(cs);
}

/** Ten logs in an evening — or five taps at a full ring — earns the word. */
function maybeFireSafety(cs) {
  if (cs.safetyShown) return;
  if (cs.logsAdded < 10 && cs.capSpam < 5) return;
  cs.safetyShown = true;
  S.card = {
    title: 'A WORD ON FIRE SAFETY',
    lines: ['Ten logs. The fire is taller than you.',
            'This is a campfire, not a signal pyre.',
            'The rangers, the bears and the loons',
            'are all pretending not to stare.'],
    button: 'POINT TAKEN', kind: 'fireSafety',
  };
  S.mode = 'card';
}

function finishCampNight() {
  var cs = S.campSession, ch = cs.chores;
  S.lastCamp = cs.site.id;
  S.stats.camps++;
  S.stats.sites[cs.site.id] = true;
  if (ch.cooked) S.stats.cooked++;
  if (ch.barrel) S.stats.hung++;
  if (ch.stars) S.stats.stars++;
  S.lookUp = false;                                 // the evening is spoken for

  // the bear ledger: an unhung barrel with food in it is an invitation
  cs.bearRaid = !ch.barrel && S.food > 0 && S.rnd() < TUNE.bearRaidChance;

  var lines = sleepLine([]);
  lines.push(ch.cooked ? 'Fed, warm' + (ch.fire ? ', fire settling to coals.' : '.')
                       : 'No dinner tonight.');
  lines.push(ch.barrel ? 'The barrel hangs far off in the dark.'
                       : 'The barrel sits by the tent. Probably fine.');
  if (cs.fireDied) lines.push('The fire went out on your watch. It happens once.');
  else if (cs.logsAdded >= 6) {
    lines.push('The fire was fed all evening — kept to the last.');
    S.stats.tended++;
  }
  if (ch.stars) lines.push('The sky did its work. Sleep comes easy.');
  if (sightingsToday() > 0) lines.push(sightingsToday() + ' sighting' + (sightingsToday() > 1 ? 's' : '') + ' in the journal today.');

  S.log.push({ day: S.day, text: 'Camped at ' + cs.site.name + '.' });
  S.card = { title: 'NIGHT ' + S.day, lines: lines, button: 'SLEEP', kind: 'campNight' };
  S.mode = 'card';
}

function showCampMorning() {
  var cs = S.campSession;
  var lines = [];
  if (cs.bearRaid) {
    S.stats.bearRaids++;
    S.food = Math.max(0, S.food - 1);
    lines.push('Dawn. The barrel is TIPPED and clawed open —');
    lines.push('a bear took a meal in the night. Hang it next time.');
  } else {
    lines.push('Dawn, and mist on the water.');
  }
  if (S.food > 0) {
    S.food--;
    cs.breakfast = true;
    S.energy = Math.min(TUNE.energyMax, S.energy + TUNE.breakfastEnergy);   // breakfast adds too (note 20)
    lines.push('Breakfast: oatmeal and lake coffee.');
  } else {
    lines.push('Nothing for breakfast. The rod is in the canoe.');
  }
  lines.push('Pack up, load the canoe, back on the water.');
  S.card = { title: 'DAY ' + (S.day + 1), lines: lines, button: 'BREAK CAMP', kind: 'campMorning' };
}

function breakCamp() {
  var cs = S.campSession, ch = cs.chores;
  S.fish = null;
  S.lookUp = false;
  S.day++;
  S.clock = TUNE.dayStartMin + 45;                  // 06:45, packed and moving
  // sleep ADDS, with a floor (note 20) — breakfast has already been added by
  // showCampMorning, and with additive meals the order no longer matters;
  // then a hungry morning still costs a little on top of the meal it missed
  S.energy = Math.min(TUNE.energyMax, Math.max(TUNE.sleepFloor, S.energy + TUNE.sleepEnergy));
  if (!cs.breakfast) S.energy = Math.max(25, S.energy - 15);
  S.roughFed = false;                               // a real bed spends the credit a struck camp left behind
  S.wind = rollWind(S.rnd, S.day);
  S.campfire = null;
  S.suppressCampId = S.campSession.site.id;   // quiet until you leave the ring
  S.campSession = null;
  leaveCampWorld();
  spawnAnimals();
  planDay();
  S.card = null;
  S.mode = 'play';
  AUDIO.morning();
  tickObjectives();
  morningToast();
}
