// PORTAGE — THE WORLD
// ---------------------------------------------------------------------------
// Hand-authored geography, one PARK at a time (v0.9). A park is a plain data
// object — lakes, narrows, portages, points of interest, vistas, campsites,
// wildlife, lodges, and the trip that runs through it — and the game loads
// one into the globals every other file reads (LAKES, PORTAGES, POIS...),
// rasterises it into a coarse grid for collision, and pre-renders it into an
// offscreen canvas for drawing. Lake names and portage lengths are real
// facts; the shapes are drawn from knowledge of the place, never traced from
// the published park map (Evrtek's ruling: clean data only, no theft).
//
// The first park is the classic beginner route out of the Canoe Lake access
// point: north up Canoe Lake, the 295m portage past the Joe Lake dam, through
// Joe and Little Joe and Baby Joe, and on to Burnt Island Lake. World units
// are art pixels. North is up. The map is fun-sized, not to scale — a 3-day
// trip in about fifteen minutes. The shape of a park and the loadPark
// pipeline are specified in scope/v0.9/parks/parks-shape.md.
// ---------------------------------------------------------------------------

'use strict';

var WORLD = {
  W: 1200, H: 1600,          // world size, world units (assigned per park by loadPark)
  CELL: 2,                   // collision cell — halved at v0.2.0: shorelines
                             // rasterise twice as fine (Evrtek's resolution note)
  // terrain codes
  DEEP: 0, WATER: 1, SHALLOW: 2, SAND: 3, GRASS: 4, TRAIL: 5,
};

// ---------------------------------------------------------------------------
// The parks
// ---------------------------------------------------------------------------
// Pristine data: nothing here is ever mutated. loadPark deep-clones a park
// before the geometry is snapped to the raster (fixupGeography writes the
// snapped coordinates back into the clone), so a park can be loaded any
// number of times and always builds the same world. Every field is plain
// JSON except trip.objectives, the one function — the chain builder, called
// by game.js buildObjectives with helpers that resolve landings, campsites,
// vistas, lake names and POIs to their SNAPPED coordinates.
//
// Lakes: control points, clockwise-ish, smoothed with Catmull-Rom before
// filling so the shorelines read as lakes rather than as polygons. Islands
// are {c, r} circles or {pts} polygons (smoothed the same way). Channels are
// straight stamped water lines joining two named waters; `gates` are the
// fleet driver's waypoints through a between-lakes narrows, ordered
// lakes[0] -> lakes[1] (a channel naming the same lake twice is a bay
// widener and has none). Portage paths are trail polylines whose two ends
// are the canoe landings, raw and never snapped; the posted lengths are the
// real ones. Fish rows are per lake: {species, weight, lbMin, lbMax, big,
// rare?, legend?} — note 6 rolls by weight, big is the trophy pound mark,
// legend names the once-a-lifetime row (until the roll lands, the heaviest
// row is what bites). Campsites carry their camp-stage face (the old
// CAMP_VARIANTS entry) under `variant`, and their note-4 feature inside it.
// Berry patches, the lookout clearing and any plain clearings are world
// data too: scatterFlora reads them (note 8).

var CANOE = {
  id: 'canoe',                       // record key paddlers.best2.canoe (fresh; the shipped 'classic' key stays in storage untouched)
  name: 'CANOE LAKE',                // gold card title on the park screen
  access: {
    name: 'Canoe Lake Access Point', // full name: the dock POI
    short: 'Canoe Lake',             // 'Head home to the <short> dock'; the end-of-trip log line
    hwyKm: 14.1,                     // km marker on Highway 60 (research-geo: the access-point page says 14.1)
    side: 'north',                   // which side of the highway the access road turns off
    launch: 'Canoe Lake',            // the lake the dock and canoeStart sit on
  },
  W: 1200, H: 1600,

  // Lakes (note 15, v0.9): 20-35 control points each, drawn from the
  // character of the place — bays, points, an arm — never traced. Canoe
  // Lake's north tip was pulled south so the isthmus the dam trail crosses
  // is a real 95 u (note 2); Joe's dam pond is a bay of its own polygon now
  // (the old 'Joe south bay' stamp is gone); Wapomeo and the Joe camp island
  // are polygons, the rest stay circles.
  lakes: [
    {
      id: 'canoe', name: 'Canoe Lake',
      big: true,                              // open water: wind matters here
      pts: [
        [624, 1102],                          // the north tip: the dam trail lands here
        [656, 1108], [690, 1104], [718, 1124], [746, 1152], [766, 1186],
        [780, 1220], [792, 1262], [768, 1296], [790, 1330], [788, 1372],   // the east bay
        [772, 1404], [740, 1460], [694, 1497], [640, 1520],
        [589, 1532], [540, 1530],             // the south shore: the access point
        [492, 1512], [450, 1480], [420, 1434], [404, 1392], [392, 1350],
        [382, 1306], [394, 1262], [404, 1234], [380, 1206], [398, 1182],   // the west cove: the west site's landing
        [420, 1140], [447, 1094], [482, 1074], [518, 1082], [560, 1090], [596, 1100],
      ],
      islands: [
        { pts: [[552, 1248], [574, 1234], [600, 1236], [620, 1252], [624, 1274],   // Wapomeo, roughly — the lightning pine stands on it
                [608, 1294], [582, 1300], [556, 1286], [546, 1266]] },
        { c: [520, 1170], r: 16 },
      ],
      // research-fish: smallmouth water first, lakers deep and uncommon,
      // whitefish at dusk and burbot in the dark as the rarities; a splake
      // here can only be a stray down from the little Highway 60 lakes
      fish: [
        { species: 'Smallmouth Bass', weight: 40, lbMin: 0.5, lbMax: 2.5, big: 4 },
        { species: 'Rock Bass',       weight: 18, lbMin: 0.2, lbMax: 0.6, big: 1 },
        { species: 'Yellow Perch',    weight: 18, lbMin: 0.2, lbMax: 0.7, big: 1 },
        { species: 'Lake Trout',      weight: 12, lbMin: 1.5, lbMax: 6,   big: 8 },
        { species: 'Lake Whitefish',  weight: 5,  lbMin: 1.5, lbMax: 4,   big: 4, rare: true },
        { species: 'Burbot',          weight: 4,  lbMin: 2,   lbMax: 5,   big: 5, rare: true },
        { species: 'Splake',          weight: 1,  lbMin: 3,   lbMax: 5,   big: 5, rare: true, legend: 'the stray splake' },
      ],
    },
    {
      id: 'joe', name: 'Joe Lake',
      pts: [
        [560, 770],                           // the narrows corner (the channel starts here — unmoved)
        [580, 724], [610, 690], [654, 686], [700, 700], [739, 725],
        [770, 760], [786, 803], [790, 850], [786, 898], [770, 940],
        [739, 970], [700, 990], [660, 997],
        [636, 1006], [612, 1010], [586, 1006], [570, 988],   // the dam pond: the south bay the portage skirts,
                                                             // reaching 60 u west of the landing so the driver's
                                                             // pond waypoint is out of LAND HERE's reach
        [566, 960], [548, 908], [532, 884], [545, 860], [548, 814],   // a west bay
      ],
      islands: [
        { pts: [[720, 772], [736, 760], [754, 764], [766, 776], [768, 792],   // the island the campsite sits on, with its east point
                [758, 808], [740, 812], [724, 802], [716, 788]] },
      ],
      // research-fish: a smallmouth lake first and foremost, 'not noted for trout'
      fish: [
        { species: 'Smallmouth Bass', weight: 62, lbMin: 0.5, lbMax: 3,   big: 4 },
        { species: 'Rock Bass',       weight: 28, lbMin: 0.2, lbMax: 0.6, big: 1 },
        { species: 'Lake Trout',      weight: 10, lbMin: 2,   lbMax: 4,   big: 8, rare: true },
      ],
    },
    {
      id: 'ljoe', name: 'Little Joe Lake',
      pts: [
        [436, 546], [454, 546], [470, 550],   // the north shore: the 435 m lands at its west end
        [506, 556], [534, 572], [556, 600], [572, 620], [566, 644], [556, 668],   // a north-east bay
        [535, 699], [500, 720],               // the narrows corner (unmoved)
        [459, 727], [420, 722], [392, 704], [372, 684],   // the south-west bay: moose country
        [364, 650], [360, 618], [366, 586], [380, 562], [404, 550],
      ],
      islands: [],
      lilies: true,                           // shallow, weedy — moose country
      // the Little Joe / Baby Joe table (research-fish): perch water first,
      // which is also what the v0.8.0 rod always brought up here
      fish: [
        { species: 'Yellow Perch',    weight: 50, lbMin: 0.2, lbMax: 0.8, big: 1 },
        { species: 'Smallmouth Bass', weight: 38, lbMin: 0.5, lbMax: 2.5, big: 4 },
        { species: 'Brook Trout',     weight: 12, lbMin: 0.8, lbMax: 2,   big: 2.5, rare: true },
      ],
    },
    {
      id: 'bjoe', name: 'Baby Joe Lake',
      pts: [
        [360, 326], [382, 320], [404, 324], [430, 335],   // the north shore: the 200 m leaves from here (the sign end sits 5 u up the bank)
        [446, 350], [458, 370], [464, 392], [458, 416], [446, 434],
        [424, 448], [398, 453], [376, 452], [370, 449],   // the south shore: the 435 m arrives here
        [344, 439], [322, 423], [311, 402], [309, 380],   // the west wall: the pictographs
        [314, 358], [326, 340], [344, 333],
      ],
      islands: [],
      lilies: true,
      fish: [
        { species: 'Yellow Perch',    weight: 50, lbMin: 0.2, lbMax: 0.8, big: 1 },
        { species: 'Smallmouth Bass', weight: 38, lbMin: 0.5, lbMax: 2,   big: 4 },
        { species: 'Brook Trout',     weight: 12, lbMin: 0.8, lbMax: 2,   big: 2.5, rare: true },
      ],
    },
    {
      id: 'burnt', name: 'Burnt Island Lake',
      big: true,
      pts: [
        [200, 70], [300, 52], [340, 74], [380, 50], [420, 40],   // a north inlet
        [531, 44], [586, 62], [640, 55], [700, 60], [753, 70],   // the ranger ruin stands back from here
        [850, 90], [914, 118], [950, 150], [956, 187], [930, 220],
        [890, 238], [840, 230], [790, 250], [740, 244], [691, 241],   // the south-east bay
        [640, 236], [600, 230], [560, 250], [514, 239],
        [430, 250], [341, 243], [300, 250], [260, 240],   // the 200 m lands here (the sign end sits 5 u up the bank)
        [196, 220], [150, 190], [134, 155], [140, 120], [156, 93],
      ],
      islands: [
        { c: [520, 138], r: 26 },
        { c: [750, 160], r: 18 },
      ],
      // research-fish: the laker lake of the route — 6-7 lb fish documented;
      // the fifteen-pounder on a wire line at dawn is the one everybody tells
      fish: [
        { species: 'Lake Trout',      weight: 45, lbMin: 1.5, lbMax: 7,   big: 8 },
        { species: 'Smallmouth Bass', weight: 32, lbMin: 1,   lbMax: 2.5, big: 4 },
        { species: 'Lake Whitefish',  weight: 8,  lbMin: 1.5, lbMax: 4,   big: 4,   rare: true },
        { species: 'Brook Trout',     weight: 7,  lbMin: 0.8, lbMax: 1.5, big: 2.5, rare: true },
        { species: 'Lake Trout',      weight: 1,  lbMin: 12,  lbMax: 16,  big: 8,   rare: true, legend: 'the fifteen-pound laker' },
      ],
    },
  ],

  // narrows: water channels joining lakes that you paddle straight through.
  // The gates convention (parks-shape §1.3): the first and last gate stand in
  // OPEN water just inside each lake's polygon, the middle one threads the
  // throat — the driver drives a straight line at gate 0 from anywhere on
  // the source lake.
  channels: [
    { name: 'Joe -> Little Joe narrows', a: [560, 770], b: [520, 700], w: 22,
      lakes: ['Joe Lake', 'Little Joe Lake'],
      gates: [[572, 786], [546, 748], [517, 700]] },
  ],

  // portages: each is a trail polyline; the two ends are canoe landings.
  // Lengths are the real posted lengths, which the HUD shows on the yellow
  // signs; the world lengths ORDER with them (note 2): 200 m < 295 m < 435 m.
  // Every end stands 4-8 u inland with its last segment pointing at the water.
  portages: [
    { name: 'Joe Lake Dam portage', metres: 295,
      path: [[626, 1098], [640, 1050], [648, 1006]],          // ~95 u up the isthmus
      lakes: ['Canoe Lake', 'Joe Lake'] },
    { name: 'Little Joe portage', metres: 435,
      path: [[438, 542], [418, 504], [400, 484], [384, 458]], // ~100 u, winding
      lakes: ['Little Joe Lake', 'Baby Joe Lake'] },
    { name: 'Burnt Island portage', metres: 200,
      path: [[352, 322], [340, 284], [328, 248]],             // ~78 u, the short one
      lakes: ['Baby Joe Lake', 'Burnt Island Lake'] },
  ],

  // points of interest — the dock stands on the south shore of Canoe Lake,
  // planks reaching north (facing 'north' is the default; a north-shore
  // launch would say 'south'). `start` is derived by fixupGeography.
  pois: {
    dock:       { x: 600, y: 1500, name: 'Canoe Lake Access Point' },
    board:      { x: 585, y: 1512 },                    // the permit board
    canoeStart: { x: 615, y: 1496 },                    // your canoe, waiting
    cairn:      { x: 782, y: 860, name: 'Tom Thomson cairn',   // this park only: the 'rock' sprite; the 'cairn' vista is aliased to it
                  text: 'A stone cairn to the painter Tom Thomson, who knew these lakes.' },
  },

  // Things worth paddling over to. Each has a first-person scene (#9): walk or
  // paddle close and LOOK, and the game turns its whole screen into the view.
  // `scene` names its painter in SCENE_PAINTERS; `water` vistas are looked at
  // from the canoe. Land vistas stand 20-34 u in from the water, so the canoe
  // you beached to walk up is out of arm's reach when you get there, and
  // 30 u from any landing (contextAction ranks LAND / CARRY / LAUNCH above
  // LOOK). The retired STILL WATER / FAR SHORE vistas stay as optional
  // beckons. `hidden` (note 8): no star until seen, paired with a lookout
  // clearing. `info` (note 21): a thing to read, not a vista — the plumbing
  // skips it in 'Vistas looked at' and the places row.
  inspects: [
    { x: 800, y: 865,  scene: 'cairn',      name: 'Tom Thomson cairn', lake: 'Joe Lake',
      caption: 'The cairn to Tom Thomson, who painted these lakes and drowned in this one, 1917.' },
    { x: 592, y: 1026, scene: 'dam',        name: 'Joe Lake Dam', lake: 'Joe Lake',
      caption: 'The old dam sluices Joe Lake down toward Canoe Lake. The portage goes around, the water goes over.' },
    { x: 312, y: 398,  scene: 'pictograph', name: 'Ochre pictographs', water: true, lake: 'Baby Joe Lake',
      caption: 'Figures in red ochre on wet granite — a canoe, a moose, a sun. Painted long before any portage sign.' },
    { x: 408, y: 522,  scene: 'bigpine',    name: 'The great white pine', lake: 'Little Joe Lake',
      caption: 'A white pine the loggers never got. Neck bent all the way back, you still cannot see the top move.' },
    { x: 695, y: 30,   scene: 'ranger',     name: 'Ranger cabin ruin', lake: 'Burnt Island Lake',
      caption: 'A ranger cabin gone to moss and peeled logs. The stove has warmed nobody for sixty years.' },
    { x: 585, y: 1258, scene: 'lightning',  name: 'The lightning pine', lake: 'Canoe Lake',
      caption: 'Split crown to root one August night. Half of it died; the other half decided not to.' },
    { x: 300, y: 830,  scene: 'lookout',    name: 'the lookout ledge', lake: 'Joe Lake', hidden: true,
      caption: 'Joe Lake laid out below like a map of itself. The canoe is a red seed on it.' },
    // caption '' on purpose (Evrtek, 2026-09-04): the board is PAINTED with
    // its notices — a text box over it would only say them a second time
    { x: 576, y: 1546, scene: 'board',      name: 'the message board', lake: 'Canoe Lake', info: true,
      caption: '' },
  ],

  // campsites, each with its camp-stage face (#4): mirrors, moved furniture,
  // its own shore — and one FEATURE per site (note 4): the thing about this
  // site worth a look, at a stage spot off the fleet's chore paths.
  campsites: [
    { id: 'joe',   x: 745, y: 785,  lake: 'Joe Lake',          name: 'Joe Lake island site',
      variant: { mirror: false, phase: 1.2, coveX: 30,  groundSeed: 0xCA4B1, treeSeed: 0,
                 feature: { id: 'ledge', x: 128, y: 48, sprite: 'hdLedge', r: 3,
                            label: 'LOOK AT THE LEDGE', title: 'THE GRANITE LEDGE',
                            lines: ['A shelf of pink granite runs out from the fire pit and stops over the water.',
                                    'Somebody has worn a seat into it. A hundred summers of sitting.',
                                    'From here you can watch the whole west end of Joe Lake go gold.'],
                            entry: 'Day N — sat on the granite ledge above the water until the light went.' } } },
    { id: 'burnt', x: 520, y: 138,  lake: 'Burnt Island Lake', name: 'Burnt Island — island site',
      variant: { mirror: true,  phase: 2.6, coveX: 130, groundSeed: 0xB0A71, treeSeed: 1,
                 canoe: { x: 130, y: 62 }, sign: { x: 58, y: 64 },
                 feature: { id: 'logtable', x: 36, y: 56, sprite: 'hdLogTable', r: 3,
                            label: 'LOOK AT THE LOG TABLE', title: 'THE LOG TABLE',
                            lines: ['Four legs of deadfall and a top of split logs, lashed with cord gone grey.',
                                    'Somebody packed rope in for this. The rules say no structures.',
                                    'It is exactly the right height for a cutting board.'],
                            entry: 'Day N — chopped onions on a table some tripper lashed together from deadfall.' } } },
    { id: 'canoe', x: 366, y: 1200, lake: 'Canoe Lake',        name: 'Canoe Lake west site',
      variant: { mirror: false, phase: 0.2, coveX: 42,  groundSeed: 0xC0A0E, treeSeed: 2,
                 tent: { x: 98, y: 26 }, box: { x: 14, y: 17 }, sign: { x: 120, y: 66 },
                 barrel: { x: 62, y: 58 },
                 feature: { id: 'erratic', x: 130, y: 44, sprite: 'hdErratic', r: 3,
                            label: 'LOOK AT THE BOULDER', title: 'THE SPLIT ERRATIC',
                            lines: ['A boulder the size of a car, dropped here by the ice and split clean in two.',
                                    'The crack is wide enough to walk through. Neither half has moved in ten thousand years.',
                                    'A birch has taken root in the gap and is slowly prying it wider.'],
                            entry: 'Day N — walked through the crack in the glacier boulder. Sideways, holding my breath.' } } },
    { id: 'ljoe',  x: 502, y: 540,  lake: 'Little Joe Lake',   name: 'Little Joe site',
      variant: { mirror: true,  phase: 3.6, coveX: 118, groundSeed: 0x10E77, treeSeed: 3,
                 tent: { x: 52, y: 30 }, canoe: { x: 130, y: 64 }, sign: { x: 58, y: 66 },
                 feature: { id: 'clawbirch', x: 112, y: 52, sprite: 'hdClawBirch', r: 3,
                            label: 'LOOK AT THE BIRCH', title: 'THE CLAWED BIRCH',
                            lines: ['A white birch by the tent pads, scored chest-high with four long grooves.',
                                    'Bear. Old marks, healed over dark — a signpost, not a threat.',
                                    'The barrel goes up the pine tonight. High.'],
                            entry: 'Day N — found bear claw marks on the birch by the tent. Hung the barrel high.' } } },
  ],

  // wildlife anchors + habits. Actual individuals are spawned per trip from
  // the trip seed in game.js; these are the places and hours they keep, each
  // ON the terrain it wants (the 55 u spawn jitter is luck, not a plan).
  // `remote` anchors (note 8) stand 90 u or more off every route feature:
  // the deep-woods four — grouse, marten, owl, and the Eastern Wolf in the
  // far north-west, who howls at dusk and never comes closer.
  wildlife: [
    { species: 'River Otter',        at: [545, 758],  water: true,  from: 6,  to: 20 },
    { species: 'White-tailed Deer',  at: [356, 1300], water: false, from: 6,  to: 10 },
    { species: 'Bald Eagle',         at: [600, 150],  water: true,  from: 8,  to: 18, flies: true },
    { species: 'Belted Kingfisher',  at: [586, 624],  water: false, from: 7,  to: 19 },
    { species: 'Snapping Turtle',    at: [392, 430],  water: true,  from: 8,  to: 18 },
    { species: 'Common Loon',        at: [600, 1300], water: true,  from: 0,  to: 24 },
    { species: 'Common Loon',        at: [680, 860],  water: true,  from: 0,  to: 24 },
    { species: 'Common Loon',        at: [470, 110],  water: true,  from: 0,  to: 24 },
    { species: 'Moose',              at: [376, 716],  water: false, from: 6,  to: 10 },
    { species: 'Moose',              at: [440, 274],  water: false, from: 17, to: 21 },
    { species: 'Great Blue Heron',   at: [398, 1428], water: false, from: 7,  to: 19 },
    { species: 'Beaver',             at: [616, 998],  water: true,  from: 17, to: 22 },
    { species: 'Painted Turtle',     at: [545, 640],  water: true,  from: 9,  to: 17 },
    { species: 'Painted Turtle',     at: [760, 930],  water: true,  from: 9,  to: 17 },
    { species: 'Red-tailed Hawk',    at: [500, 1056], water: false, from: 9,  to: 18, flies: true },
    { species: 'Red-tailed Hawk',    at: [400, 300],  water: false, from: 10, to: 17, flies: true },
    { species: 'River Otter',        at: [700, 190],  water: true,  from: 7,  to: 19 },
    { species: 'Beaver',             at: [420, 712],  water: true,  from: 16, to: 22 },
    // the deep woods (note 8)
    { species: 'Ruffed Grouse',      at: [250, 700],  water: false, from: 7,  to: 19, remote: true },
    { species: 'Ruffed Grouse',      at: [1000, 180], water: false, from: 7,  to: 19, remote: true },
    { species: 'Pine Marten',        at: [300, 1000], water: false, from: 6,  to: 10, remote: true },
    { species: 'Pine Marten',        at: [900, 760],  water: false, from: 17, to: 20, remote: true },
    { species: 'Barred Owl',         at: [870, 1000], water: false, from: 18, to: 22, remote: true },
    { species: 'Eastern Wolf',       at: [150, 360],  water: false, from: 18, to: 21, remote: true },
  ],

  // beaver lodges (#9): authored roughly, snapped to real shallows in fixup;
  // which of them stand this trip is rolled per trip in game.js
  huts: [
    { x: 630, y: 1008 },
    { x: 415, y: 705 },
    { x: 372, y: 446 },
  ],

  // berry patches (note 8): twelve centres on GRASS, well off every trail,
  // camp and vista — scatterFlora grows 3-4 bushes within 9 u of each into
  // BERRIES, and keeps the forest from burying them. Hidden fun: no marker.
  berries: [
    [270, 760], [340, 920], [440, 960], [760, 1060], [880, 880], [900, 1200],
    [860, 1400], [300, 1300], [250, 1100], [236, 540], [620, 420], [520, 300],
  ],
  // the hidden lookout (note 8): a granite ledge in the interior west of Joe
  // Lake — ~160 u of bushwhack from Little Joe's south-west bay, ~230 u from
  // Joe's west shore. Tree-free within r; prerender
  // bakes the granite; its vista is the `hidden` inspect at the same spot.
  lookouts: [{ x: 300, y: 830, r: 22 }],
  clearings: [],     // tree-free spots {x, y, r} beyond the built-in ones around vistas, landings, the board, the cairn

  // The trip through this park (#1): the card on the park screen and the
  // objective chain. The vista objectives complete through S.seenPOIs, so
  // LOOKING is the goal, not just arriving. fleetScore is the review fleet's
  // own best full playthrough — driven, never typed. The v0.8.0 record (1116)
  // retired with the v0.9 chain (three vistas, the re-laid trails, the
  // tripled burn, the fish rows); the one below was earned on the new chain
  // through tools/headless.js, best of eight seeds.
  //
  // Every text <= 46 chars (note 1). Water waypoints route the driver's
  // straight lines round Wapomeo and into the dam pond — each one 60 u or
  // more from any landing, because the driver presses LAND HERE whenever a
  // landing is within 30 u and its target within 30 u (the pond taught us);
  // `via` names the narrows a leg paddles so the driver takes the gates.
  trip: {
    name: 'THE PORTAGE CLASSIC',
    blurb: 'North over the 295 m to Burnt Island and home — the honest loop.',
    facts: '2 nights · the dam & the cairn',
    // v0.9.1 pass 7 record, re-driven under canoe momentum — never typed:
    // `node tools/headless.js 0 --seed 11` = 1710 pts (3 days); seeds
    // 3/7/11/23/31/47/59/101 ran 1269-1710, median 1606.5. Momentum re-rolls
    // every seed's whole trip, so the pass 3 record (1750 at seed 59, band
    // 1498-1750, median 1577.5) retired with the instant-stop hull. The low
    // end fell to seed 31, which still COMPLETES but takes 9 days: it beaches
    // on top of the cairn inspect and the on-foot action precedence in
    // game.js (nearCanoe() outranks nearestInspect()) hides LOOK for six
    // sim-days. A driver/precedence defect the coast exposed, reported not
    // papered over — the band below is the honest one.
    fleetScore: 1710,
    objectives: function (P, C, I, L, O) {
      return [
        O.launch(),
        { text: 'Paddle north up Canoe Lake to the portage',
          wps: [[660, 1330], [644, 1180], P(0, 0)],           // east of Wapomeo, then the north arm
          done: function () { return S.travel !== 'canoe' && near(P(0, 0), 30); } },
        { text: 'Portage 295 m past the Joe Lake dam, put in',
          wps: [P(0, 1)],
          done: function () { return S.travel === 'canoe' && lakeAt(S.player.x, S.player.y) === L('Joe Lake'); } },
        { text: 'Go ashore and look at the Joe Lake dam',
          wps: [[584, 996], I('dam')],                         // to the pond's far end, then up the bank
          done: function () { return !!S.seenPOIs.dam; } },
        { text: 'Camp at the Joe Lake island site before dark',
          wps: [C('joe')],
          done: function () { return S.lastCamp === 'joe'; } },
        { text: 'Day 2 — find the Tom Thomson cairn',
          wps: [I('cairn')],
          done: function () { return !!S.seenPOIs.cairn; } },
        { text: 'Portage north to Burnt Island Lake',
          wps: [P(1, 0), P(1, 1), P(2, 0), P(2, 1)],
          via: ['Joe Lake', 'Little Joe Lake'],        // the leg runs the narrows: the driver takes its gates
          done: function () { return S.travel === 'canoe' && lakeAt(S.player.x, S.player.y) === L('Burnt Island Lake'); } },
        { text: 'Camp at the Burnt Island north site',
          wps: [C('burnt')],
          done: function () { return S.lastCamp === 'burnt'; } },
        { text: 'Day 3 — carry back south to Canoe Lake',
          wps: [P(2, 1), P(2, 0), P(1, 1), P(1, 0), P(0, 1), P(0, 0)],
          via: ['Little Joe Lake', 'Joe Lake'],        // the narrows again, the other way
          done: function () { return S.travel === 'canoe' && lakeAt(S.player.x, S.player.y) === L('Canoe Lake'); } },
        { text: 'Cross to Wapomeo — look at the lightning pine',
          wps: [I('lightning')],
          done: function () { return !!S.seenPOIs.lightning; } },
        O.home([[640, 1200], [660, 1330]]),                   // off the island's north shore, round its east side
      ];
    },
  },
};

// ---------------------------------------------------------------------------
// SMOKE LAKE (v0.9 pass 4). Smoke Lake Access Point (#6), Highway 60 km 14.1,
// south side. The chain runs north to south: Smoke Lake (big, open, cottages,
// NO campsites) -> 240 m portage beside the Ragged dam / old log-chute outlet
// -> Ragged Lake (broad, bays, islands, snags, no cottages) -> 590 m "Devil's
// Staircase" (log steps, a 90-degree switchback) -> Big Porcupine Lake: a
// tannin-dark NORTH arm and a clear blue-green SOUTH arm joined by a rocky
// narrows. Two nights: the point site on Ragged, then the cliff-top on the
// south arm (the slab table — on Big Porcupine per Evrtek's 2026-09-02
// correction), then home.
//
// CLEAN DATA: every lake outline here was authored from the CHARACTER of the
// lake as described in scope/v0.9/research-geo.md / research-lore.md (long and
// open; broad with bays and islands; two arms and a narrows) — none was traced
// from the published park map or any map image. Real facts kept real: lake
// names, posted portage lengths (240 m, 590 m), the access km (14.1), the
// nickname "Devil's Staircase", the dam and log chute at the Ragged outlet.
// Where the research gives no name the text stays generic ("the north arm").
// The slab-table story is Evrtek's family's, told in his words, attributed
// only to "a family" (scope/v0.9/evrtek-answers.md). Authored and critic-fixed
// as scope/v0.9/parks/park-smoke.js (the CRITIC comments are its audit trail).
var SMOKE = {
  id: 'smoke',                         // record key paddlers.best2.smoke
  name: 'SMOKE LAKE',                  // gold card title on the Highway 60 screen (card 2 of 3)
  access: {
    name: 'Smoke Lake Access Point',   // dock POI name; 'took out at the Smoke Lake Access Point. Trip complete.'
    short: 'Smoke Lake',               // 'Head home to the Smoke Lake dock'
    hwyKm: 14.1,                       // research-geo: Smoke Lake Access Point #6 at km 14.1, the road turns SOUTH
    side: 'south',
    launch: 'Smoke Lake',              // the dock stands on Smoke's north shore; the water is SOUTH of the dock
  },
  W: 1200, H: 1600,

  // ---------------------------------------------------------------------------
  lakes: [
    {
      // Smoke Lake: ~607 ha, the deepest lake in the game (55 m), long and open,
      // runs roughly N-S with the access at the north end; wind builds real
      // waves; ~89 cottage lots along its shores; NO backcountry campsites.
      id: 'smoke', name: 'Smoke Lake', big: true,
      // 35 control points, clockwise from the north (dock) bay: a narrow north
      // bay, a point and a bay on the north-east shore, the wide east lobe (the
      // open water the wind works on), the long run south narrowing to the
      // portage at the south tip, a cove on the south-west, a point on the west
      // shore, and a deep north-west arm on the way back up.
      pts: [
        [572, 96],  [600, 86],  [632, 94],  [658, 118],
        [664, 160], [700, 176], [730, 200], [716, 240],
        [672, 272], [690, 310], [750, 330], [800, 356], [812, 410], [786, 452], [744, 470],
        [770, 500], [742, 546], [690, 578], [642, 598], [615, 606],
        [586, 594], [556, 574], [520, 512],
        [498, 470], [520, 430], [496, 396], [452, 384],
        [430, 340], [458, 300], [482, 262], [440, 238], [416, 210], [452, 190], [500, 166], [530, 130],
      ],
      islands: [
        // a wooded island mid-lake (character: Smoke has a few small islands)
        { pts: [[628, 388], [652, 382], [672, 396], [668, 418], [646, 428], [624, 416], [618, 400]] },
        // a rock islet in the north half
        { pts: [[560, 244], [576, 240], [586, 252], [578, 266], [562, 268], [552, 256]] },
      ],
      // research-fish: lake trout, smallmouth, whitefish (dusk), yellow perch,
      // rock bass; big deep burbot at night; the 'Conan Doyle' laker legend
      // (a fine Smoke Lake trout was mounted and shipped to Lady Conan Doyle).
      fish: [
        { species: 'Smallmouth Bass', weight: 38, lbMin: 1,   lbMax: 2.5, big: 4 },
        { species: 'Yellow Perch',    weight: 20, lbMin: 0.3, lbMax: 0.8, big: 1 },
        { species: 'Rock Bass',       weight: 12, lbMin: 0.2, lbMax: 0.6, big: 1 },
        { species: 'Lake Trout',      weight: 14, lbMin: 2,   lbMax: 5,   big: 8 },
        { species: 'Lake Whitefish',  weight: 9,  lbMin: 1.5, lbMax: 4,   big: 4 },                 // dusk riser
        { species: 'Burbot',          weight: 4,  lbMin: 3,   lbMax: 8,   big: 5, rare: true },     // night, the deep hole
        { species: 'Smallmouth Bass', weight: 2,  lbMin: 4,   lbMax: 4.5, big: 4, rare: true },     // a 19-inch bass is on the books here
        { species: 'Lake Trout',      weight: 1,  lbMin: 14,  lbMax: 20,  big: 8, rare: true,
          legend: 'the Conan Doyle laker' },                                                       // legendary: 20 lb from the 180-ft hole
      ],
    },
    {
      // Ragged Lake: ~628 ha, 'a broad, attractive body of water' with many
      // bays — Parkside Bay an out-of-the-way offshoot to the east, marshy
      // lily-pad bays to the south-west; the coveted island sites in the
      // south-west; dead standing snags in the shallows from the old dam
      // flooding; no cottages, no powerboats.
      id: 'ragged', name: 'Ragged Lake', lilies: true,
      // 35 control points, clockwise from the north-west: a shallow bay on the
      // north shore, the portage landing, the point-site peninsula, the narrow
      // mouth into Parkside Bay (the offshoot), the long south-east shore down
      // to the Staircase landing, the marshy South Bay and a south-west bay
      // with the islands off them, then the west shore.
      pts: [
        [214, 742], [256, 704], [318, 688], [376, 702], [424, 730],
        [540, 690], [616, 684], [660, 696],
        [686, 722], [700, 766], [732, 806], [760, 764], [776, 728],
        [856, 722], [872, 760],
        [892, 772], [984, 716], [1022, 736], [1030, 786], [996, 824], [906, 816],
        [884, 854], [856, 914], [760, 988], [634, 1036], [560, 1048],
        [506, 1044], [416, 1076], [368, 1058], [334, 1030], [262, 1040],
        [198, 1000], [172, 940], [196, 792], [206, 764],
      ],
      islands: [
        // the two south-west islands (the coveted ones); the campsite is on the first
        { pts: [[278, 934], [304, 926], [328, 940], [326, 966], [302, 978], [276, 964]] },
        { pts: [[356, 986], [382, 980], [398, 996], [386, 1016], [362, 1014], [348, 1000]] },
        // a rock islet in the open middle
        { pts: [[608, 870], [626, 864], [640, 876], [634, 892], [614, 894], [602, 882]] },
      ],
      // research-fish: smallmouth, yellow perch (10 in / 1 lb logged), rock bass,
      // lake trout, suckers; brook trout 'still holding out' (rare); the 8 lb
      // Ragged bass is a real survey rumour — legendary.
      fish: [
        { species: 'Smallmouth Bass', weight: 42, lbMin: 1,   lbMax: 2,   big: 4 },
        { species: 'Yellow Perch',    weight: 24, lbMin: 0.5, lbMax: 1,   big: 1 },
        { species: 'Rock Bass',       weight: 10, lbMin: 0.2, lbMax: 0.6, big: 1 },
        { species: 'Lake Trout',      weight: 10, lbMin: 1.5, lbMax: 3,   big: 6 },
        { species: 'White Sucker',    weight: 8,  lbMin: 1,   lbMax: 3,   big: 4 },
        { species: 'Brook Trout',     weight: 5,  lbMin: 1,   lbMax: 2,   big: 2.5, rare: true },
        { species: 'Smallmouth Bass', weight: 1,  lbMin: 6,   lbMax: 8,   big: 4, rare: true,
          legend: 'the eight-pound Ragged bass' },
      ],
    },
    {
      // Big Porcupine Lake, the NORTH arm: tannin-dark water, quieter, the
      // Devil's Staircase lands on its north shore; a terraced rock point on
      // the west shore (site-1 lore: gravel beach, grassed ledge, reflector rock).
      id: 'porcnorth', name: 'Big Porcupine Lake', big: true,
      // 22 control points, clockwise from the north-west: the Staircase landing
      // on the north shore, a bay east of it, the east end funnelling into the
      // narrows at the south-east corner, a lumpy south shore, and the quiet
      // west end where the terrace site stands.
      pts: [
        [436, 1196], [484, 1180], [530, 1172], [572, 1184], [596, 1212], [634, 1190], [686, 1194],
        [726, 1222], [742, 1266], [730, 1304], [706, 1330],
        [674, 1324], [642, 1338], [606, 1318], [568, 1336], [524, 1324], [482, 1324],
        [446, 1304], [412, 1292], [386, 1262], [390, 1230], [412, 1206],
      ],
      islands: [],
      // research-fish: a Type 2 lake — many small lake trout, brook trout, small
      // littoral burbot, NO bass ('nothing but skinny lakers').
      fish: [
        { species: 'Lake Trout',  weight: 68, lbMin: 0.8, lbMax: 2,   big: 4 },
        { species: 'Brook Trout', weight: 18, lbMin: 0.8, lbMax: 2,   big: 2.5 },
        { species: 'Burbot',      weight: 8,  lbMin: 0.5, lbMax: 1,   big: 2 },                    // night
        { species: 'Lake Trout',  weight: 5,  lbMin: 4,   lbMax: 6,   big: 4, rare: true },
        { species: 'Lake Trout',  weight: 1,  lbMin: 7,   lbMax: 8,   big: 4, rare: true,
          legend: 'the fat old laker from the deepest hole' },
      ],
    },
    {
      // Big Porcupine Lake, the SOUTH arm: strikingly clear blue-green water,
      // a cliff on the east shore (site-4 lore: a site on a cliff edge), the
      // 'huge' site high on smooth rock in the south-west, an island site.
      // Same lake, second polygon: the two arms are joined by the narrows channel.
      // `name` is the data key (lakeAt, via, fish, campsite.lake); `label` is
      // what the 13 px lake name and the map show — the key is 25 chars and
      // ran off the 160 u phone floor (pass 4).
      id: 'porcsouth', name: 'Big Porcupine — south arm', label: 'Big Porcupine (S)', big: true,
      // 24 control points, clockwise from the narrows mouth: the north shore
      // running east under the cliff head, a bay in the south shore, the
      // smooth-rock point at the south-west, and a small point on the north
      // shore just west of the narrows.
      pts: [
        [716, 1392], [758, 1394], [806, 1404], [850, 1416], [900, 1436], [938, 1470], [952, 1512],
        [930, 1548], [888, 1572], [846, 1578], [812, 1552], [772, 1554], [740, 1578], [696, 1576],
        [652, 1580], [606, 1576], [570, 1556], [548, 1524], [560, 1492], [588, 1466],
        [624, 1444], [656, 1426], [680, 1444], [698, 1420],
      ],
      islands: [
        { pts: [[742, 1478], [766, 1472], [784, 1486], [778, 1506], [756, 1512], [738, 1500]] },
      ],
      fish: [
        { species: 'Lake Trout',  weight: 68, lbMin: 0.8, lbMax: 2,   big: 4 },
        { species: 'Brook Trout', weight: 18, lbMin: 0.8, lbMax: 2,   big: 2.5 },
        { species: 'Burbot',      weight: 8,  lbMin: 0.5, lbMax: 1,   big: 2 },
        { species: 'Lake Trout',  weight: 5,  lbMin: 4,   lbMax: 6,   big: 4, rare: true },
        { species: 'Lake Trout',  weight: 1,  lbMin: 7,   lbMax: 8,   big: 4, rare: true,
          legend: 'the fat old laker from the deepest hole' },
      ],
    },
  ],

  // ---------------------------------------------------------------------------
  channels: [
    // the Big Porcupine narrows: 'a narrow, shallow channel strewn with
    // submerged rocks and sunken logs' between the arms; wind funnels through it.
    // Gates ordered north arm -> south arm for the fleet driver. CRITIC: the
    // first and last gates stand in OPEN water just inside each arm (like the
    // Canoe park's GATE_N), not inside the channel — the driver steers a
    // straight line at gate 0 from wherever it is on the arm, and a gate in
    // the channel throat made both approaches clip the mouth lips.
    { name: 'Big Porcupine narrows', a: [702, 1330], b: [716, 1392], w: 22,
      lakes: ['Big Porcupine Lake', 'Big Porcupine — south arm'],
      gates: [[700, 1318], [709, 1361], [722, 1410]] },
  ],

  // ---------------------------------------------------------------------------
  portages: [
    // 240 m, Smoke south end -> Ragged north shore: short and steep with a
    // switchback partway up, sandy landings; the outlet creek, its cascade and
    // the Ragged dam (the old log-chute site) run beside it.
    { name: 'Ragged Lake portage', metres: 240,
      path: [[615, 611], [600, 640], [624, 662], [616, 680]],
      lakes: ['Smoke Lake', 'Ragged Lake'] },
    // 590 m, "the Devil's Staircase": straight uphill first, then a sharp
    // 90-degree switchback, log steps most of the way, +44 m.
    { name: "Devil's Staircase portage", metres: 590,
      path: [[560, 1052], [570, 1082], [528, 1104], [520, 1140], [530, 1168]],
      lakes: ['Ragged Lake', 'Big Porcupine Lake'] },
  ],

  // ---------------------------------------------------------------------------
  pois: {
    // The access dock on the NORTH shore of Smoke Lake's north bay. fixup looks
    // 30 u south of the authored point: that is the shoreline here, the walk-
    // back lands the foot 8 u inland. NOTE for render: the water is SOUTH of
    // this dock (planks must reach south, not north as on Canoe Lake).
    dock:       { x: 600, y: 56, name: 'Smoke Lake Access Point', facing: 'south' },
    board:      { x: 586, y: 74 },
    canoeStart: { x: 610, y: 88 },
  },

  // ---------------------------------------------------------------------------
  // CRITIC: contextAction ranks LAND HERE (any LANDING within 30 u) and LAND AT
  // CAMP (campsite within 44 u) ABOVE LOOK in the canoe, and MAKE CAMP (24 u) /
  // the beached canoe (20 u) above LOOK on foot — so a water vista must sit
  // >= 60 u from every landing and >= 70 u from every campsite, or the LOOK
  // button never appears there and the objective cannot complete.
  inspects: [
    // 66 u east of the Ragged landing along the north shore (was 28 u: LAND HERE shadowed it)
    { x: 672, y: 716, scene: 'chute', name: 'The old chute dam', lake: 'Ragged Lake', water: true,
      caption: 'A low dam holds Ragged Lake one step above Smoke. In the timber days a log chute ran down beside it; the creek still roars, and almost nothing of the chute is left to see.' },
    // 32 u from the Staircase landing (was 25: the beached canoe's 20 u reach came too close)
    { x: 556, y: 1150, scene: 'staircase', name: "Top of the Devil's Staircase", lake: 'Big Porcupine Lake',
      caption: 'Log steps fall away north toward Ragged Lake, its dead snags standing in the shallows like masts. Every one of those steps is yours, both ways.' },   // pass 5 sweep: the chain asks for this look on Day 3 at the top, before walking DOWN — true whichever day it is read
    // under the cliff's south face, 80 u from the cliff site (was 22 u: LAND AT CAMP shadowed it)
    { x: 906, y: 1554, scene: 'bluewater', name: 'The blue-water cliff', lake: 'Big Porcupine — south arm', water: true,
      caption: 'Under the cliff the water turns blue-green and you can count the boulders on the bottom. The north arm was tea; this is glass.' },
    // note 8: the hidden lookout — a granite knob on the peninsula between the
    // two arms, found only by bushwhacking; no real place name exists, so none used
    // `twin` (pass 4): the shared lookout painter draws TWO basins — tea-brown
    // above, blue-green below, the narrows a thread between — instead of one lake
    { x: 470, y: 1366, scene: 'lookout', name: 'the granite knob', lake: 'Big Porcupine Lake', hidden: true, twin: true,
      caption: 'Bare granite above the trees, and both arms of Big Porcupine at once: tea-brown to the north, blue-green to the south, the narrows a thread between them.' },
    // note 21: the message board at the launch (final sweep — every park's
    // first objective says 'Read the board'; only Canoe had one to read).
    // Authored 18 u west of where fixup stands the board (578,88), 32 u from
    // the dock landing so CARRY/LAUNCH never shadows LOOK; `info`, so the
    // vista tallies skip it
    // caption '' on purpose (Evrtek, 2026-09-04): the painting already reads
    { x: 560, y: 84, scene: 'board', name: 'the message board', lake: 'Smoke Lake', info: true,
      caption: '' },
  ],

  // ---------------------------------------------------------------------------
  campsites: [
    // Ragged Lake — the flat point site near the portage junction (site-3 lore:
    // a fire pit backed against a large rock that throws the heat back).
    // (The slab table lived here in the first draft; Evrtek's memory placed it
    // on Big Porcupine on 2026-09-02 — it is at the cliff site now.)
    { id: 'ragged', x: 736, y: 780, lake: 'Ragged Lake', name: 'Ragged Lake point site',
      variant: { mirror: false, phase: 1.6, coveX: 36, groundSeed: 0x5A6D1, treeSeed: 6,
                 feature: { id: 'reflector', x: 96, y: 44, sprite: 'hdReflectorRock', r: 3,
                            label: 'LOOK AT THE REFLECTOR ROCK', title: 'THE REFLECTOR ROCK',
                            lines: [
                              'The fire pit is built hard against a boulder with one flat face.',
                              'Whatever heat goes into the rock comes back out at you — the best seat on the lake on a cold night.',
                              'The point is flat and open; the portage junction is a short paddle west.',
                            ],
                            entry: 'Day N — cold night, but the rock behind the fire gave it all back. Best seat on Ragged Lake.' } } },
    // Ragged Lake — the south-west island site (site-22 lore: a drying rack of
    // thin trunks lashed between trees; an oversized fire pit split in two)
    { id: 'raggedisle', x: 302, y: 952, lake: 'Ragged Lake', name: 'Ragged Lake island site',
      variant: { mirror: true, phase: 3.1, coveX: 124, groundSeed: 0x2C8E3, treeSeed: 7,
                 canoe: { x: 130, y: 62 }, sign: { x: 58, y: 64 },
                 // pass 4: was {46,48}, 5 u under the mirrored tent's PITCH TENT spot —
                 // now the quiet corner between the left trees and the tent, above the shore
                 feature: { id: 'dryrack', x: 30, y: 52, sprite: 'hdDryingRack', r: 3,
                            label: 'LOOK AT THE DRYING RACK', title: 'THE DRYING RACK',
                            lines: [
                              'Thin trunks lashed between two pines at head height: a rack for wet gear and wetter socks.',
                              'Beside it the fire pit is oversized and split down the middle by a low stone wall — two fires, one ring.',
                              'Somebody here had a big group, and possibly an argument.',
                            ],
                            entry: 'Day N — hung the socks on a rack of lashed trunks. Two fires in one pit here; someone had a group and an argument.' } } },
    // Big Porcupine north arm — the terraced rock point (site-1 lore: sheltered
    // gravel beach, a grassed ledge with a sunset view, tent pads on top; the
    // natural rock 'table' fire pit with benches is site-13 lore, kept on the
    // north arm so the slab table can stand alone at the cliff site)
    { id: 'porcnorth', x: 376, y: 1242, lake: 'Big Porcupine Lake', name: 'Big Porcupine terrace site',
      variant: { mirror: false, phase: 0.4, coveX: 44, groundSeed: 0x7B1F9, treeSeed: 8,
                 tent: { x: 98, y: 26 }, box: { x: 14, y: 17 }, sign: { x: 120, y: 66 },
                 feature: { id: 'rocktable', x: 128, y: 46, sprite: 'hdRockTable', r: 3,
                            label: 'LOOK AT THE ROCK TABLE', title: 'THE ROCK TABLE',
                            lines: [
                              'The fire pit and its log benches sit on one flat shelf of granite — a natural table at the top of the slope.',
                              'Above it a grassed ledge looks west for the sunset; the tent pads are one terrace higher still.',
                              'The thunder box is downhill and, everyone agrees, not private.',
                            ],
                            entry: 'Day N — great fire pit on a shelf of bare rock, terrible privy. You can wave at the loons from the seat.' } } },
    // Big Porcupine south arm — the cliff site (site-4 lore: a site on a cliff
    // edge with a westward view, rock porches stepping down to the water).
    // THE SLAB TABLE: Evrtek's family's, in his words, attributed to "a
    // family" — on Big Porcupine, per his correction of 2026-09-02 (his
    // first note said Ragged; his memory put it right). Night 2 of the chain.
    { id: 'porccliff', x: 962, y: 1496, lake: 'Big Porcupine — south arm', name: 'Big Porcupine cliff site',
      variant: { mirror: true, phase: 2.2, coveX: 118, groundSeed: 0x9D4A2, treeSeed: 9,
                 tent: { x: 52, y: 30 }, canoe: { x: 130, y: 64 }, sign: { x: 58, y: 66 },
                 feature: { id: 'slab', x: 100, y: 46, sprite: 'hdSlabTable', r: 3,
                            label: 'LOOK AT THE SLAB TABLE', title: 'THE SLAB TABLE',
                            lines: [
                              'A four-hundred-pound slab of shore rock, level as a counter. A family made it, and told it this way:',
                              '"We used tiny sticks which we inserted into a small split in the rock. We soaked the sticks with water until they swelled and we repeated this for hours until the rock gently released from the shoreline."',
                              '"We then traversed 40 feet of distance and 10 feet of elevation by rolling the slab along the ground on cut fire logs."',
                              '"Four of us then heaved the stone 3 feet up onto built supports and used small flat stones to shim the slab perfectly level."',
                            ],
                            entry: 'Day N — ate off the slab table. A family soaked sticks in a split in the rock until they swelled and it released from the shoreline, rolled it along the ground on cut fire logs, heaved it 3 feet up onto built supports and shimmed it perfectly level. Four hundred pounds.' } } },
    // Big Porcupine south arm — the 'huge' south-west site high on smooth rock
    // with a commanding view (research-geo)
    { id: 'porcrock', x: 542, y: 1540, lake: 'Big Porcupine — south arm', name: 'Big Porcupine smooth-rock site',
      variant: { mirror: false, phase: 2.9, coveX: 40, groundSeed: 0x3E7C4, treeSeed: 10,
                 barrel: { x: 62, y: 58 },
                 // pass 4: was {126,48}, 11 u from the tent's PITCH TENT spot — moved down
                 // the slope toward the water, where a whaleback runs anyway
                 feature: { id: 'whaleback', x: 134, y: 54, sprite: 'hdLedge', r: 3,
                            label: 'LOOK AT THE WHALEBACK', title: 'THE WHALEBACK',
                            lines: [
                              'A whole hillside of smooth bare granite runs from the tent pads down into the lake, polished by the last ice age.',
                              'From the top the whole south arm is laid out — every island, every point.',
                              'Wet, it is a slide. Dry, it is the best sunning rock in the park.',
                            ],
                            entry: 'Day N — camped on a hill of smooth granite that slides straight into blue-green water. Whole south arm from the tent door.' } } },
  ],

  // ---------------------------------------------------------------------------
  // wildlife anchors: real Algonquin residents, each ON matching terrain; the
  // four deep-woods species (note 8) sit at remote anchors >= 90 u off the route
  wildlife: [
    { species: 'Common Loon',        at: [600, 300],  water: true,  from: 0,  to: 24 },
    { species: 'Common Loon',        at: [520, 880],  water: true,  from: 0,  to: 24 },
    { species: 'Common Loon',        at: [800, 1500], water: true,  from: 0,  to: 24 },
    { species: 'River Otter',        at: [760, 430],  water: true,  from: 6,  to: 20 },
    { species: 'River Otter',        at: [690, 1300], water: true,  from: 7,  to: 19 },
    { species: 'Beaver',             at: [286, 1016], water: true,  from: 16, to: 22 },
    { species: 'Beaver',             at: [440, 1280], water: true,  from: 17, to: 22 },
    { species: 'Painted Turtle',     at: [440, 1050], water: true,  from: 9,  to: 17 },
    { species: 'Painted Turtle',     at: [970, 780],  water: true,  from: 9,  to: 17 },
    { species: 'Moose',              at: [420, 1100], water: false, from: 6,  to: 10 },
    { species: 'Moose',              at: [250, 690],  water: false, from: 17, to: 21 },
    { species: 'Great Blue Heron',   at: [1040, 800], water: false, from: 7,  to: 19 },
    { species: 'Belted Kingfisher',  at: [828, 292],  water: false, from: 7,  to: 19 },
    { species: 'Bald Eagle',         at: [700, 400],  water: true,  from: 8,  to: 18, flies: true },
    { species: 'Red-tailed Hawk',    at: [880, 1000], water: false, from: 9,  to: 18, flies: true },
    { species: 'White-tailed Deer',  at: [880, 1200], water: false, from: 6,  to: 10 },
    { species: 'Ruffed Grouse',      at: [200, 560],  water: false, from: 7,  to: 19, remote: true },
    { species: 'Pine Marten',        at: [1000, 360], water: false, from: 6,  to: 10, remote: true },
    { species: 'Barred Owl',         at: [1040, 1140], water: false, from: 18, to: 22, remote: true },
    { species: 'Eastern Wolf',       at: [150, 1400], water: false, from: 18, to: 21, remote: true },
  ],

  // beaver lodges in the shallows: the marshy south-west bay of Ragged, the
  // south bay under the Staircase, the west bay of the north arm
  huts: [
    { x: 250, y: 1030 },
    { x: 470, y: 1060 },
    { x: 400, y: 1278 },
  ],

  // note 8: berry patch centres on GRASS, >= 40 u from trails and camps
  // (80 from the dock), >= 30 u from vistas
  berries: [
    [330, 300], [900, 200], [960, 560], [300, 640], [1100, 900], [110, 800],
    [700, 1100], [860, 1100], [260, 1250], [1050, 1420], [420, 1480], [1100, 1560],
  ],

  // note 8: the hidden lookout clearing pairs with the 'lookout' inspect above
  lookouts: [
    { x: 470, y: 1366, r: 22 },
  ],
  clearings: [],     // no extra tree-free spots beyond the built-in ones

  // snag beds (pass 4, parks-shape §1.14): research-geo — the old dam flooding
  // left Ragged 'studded with tree stumps', thickest at the Devil's Staircase
  // end. scatterFlora drops n extra DEADHEADS into the water within r of each
  // centre (never within 30 u of a trail or a camp landing), on top of the
  // park-wide fourteen. Decoration and a fishing snag risk, nothing more.
  snags: [
    { x: 540, y: 1000, r: 70, n: 9 },      // the south shallows under the Staircase landing
  ],

  // ---------------------------------------------------------------------------
  // Cottage lots along Smoke's shore (research-geo: ~89 of them; the park
  // carries nine as decoration, parks-shape §1.13). Pass 4 bakes a small
  // cabin at each on the terrain and keeps the trees off it — the 'civilised
  // opening screen'. Each lot sits on land within ~20 u of Smoke's water.
  cottages: [
    [496, 148], [684, 148], [744, 222], [824, 378], [830, 430], [400, 214], [426, 318], [498, 424], [500, 502],
  ],

  // ---------------------------------------------------------------------------
  trip: {
    name: "THE DEVIL'S STAIRCASE",
    blurb: 'Down big Smoke, up the log steps to two-coloured Big Porcupine, and home.',
    facts: '2 nights · the slab table & the Staircase',
    // v0.9.1 pass 7 record, re-driven under canoe momentum — never typed:
    // `node tools/headless.js 1 --seed 31` = 1690 pts (3 days); seeds
    // 3/7/11/23/31/47/59/101 ran 1504-1690, median 1600.5. All eight complete
    // in 3 days. Retires the pass 4 record (1730 at seed 3, band 1469-1730,
    // median 1556): the coast moves every landing, so the whole band re-rolled.
    fleetScore: 1690,
    objectives: function (P, C, I, L, O) {
      return [
        O.launch(),
        { text: 'Paddle south down Smoke to the portage sign',            // pass 5 sweep: a first-timer's first Smoke objective names the yellow sign convention, as Canoe / Rock do
          wps: [[592, 392], P(0, 0)],                                   // west of the mid-lake island
          done: function () { return S.travel !== 'canoe' && near(P(0, 0), 30); } },
        { text: 'Portage 240 m, then put in on Ragged Lake',
          wps: [P(0, 1)],
          done: function () { return S.travel === 'canoe' && lakeAt(S.player.x, S.player.y) === L('Ragged Lake'); } },
        { text: 'Look at the old chute dam from the water',
          wps: [I('chute')],
          done: function () { return !!S.seenPOIs.chute; } },
        { text: 'Camp at the point site — the reflector rock',
          wps: [[676, 760], [684, 806], C('ragged')],                   // round the west side of the point (a straight line crosses it), staying > 60 u off the camp landing so the driver paddles past instead of landing early
          done: function () { return S.lastCamp === 'ragged'; } },
        { text: "Day 2 — climb the Devil's Staircase, 590 m",
          wps: [[670, 860], P(1, 0), P(1, 1)],                         // first target > 60 u from the camp: the driver goes to the boat first
          done: function () { return S.travel === 'canoe' && lakeAt(S.player.x, S.player.y) === L('Big Porcupine Lake'); } },
        { text: 'Through the rocky narrows to the south arm',
          wps: [[700, 1318], [709, 1361], [722, 1410], [760, 1440]],   // = the channel gates, then open water
          via: ['Big Porcupine Lake', 'Big Porcupine — south arm'],
          done: function () { return S.travel === 'canoe' && lakeAt(S.player.x, S.player.y) === L('Big Porcupine — south arm'); } },
        { text: 'Paddle under the blue-water cliff',
          wps: [I('bluewater')],
          done: function () { return !!S.seenPOIs.bluewater; } },
        { text: 'Camp at the cliff site — the slab table',
          wps: [C('porccliff')],
          done: function () { return S.lastCamp === 'porccliff'; } },
        { text: 'Day 3 — back north to the Staircase landing',
          wps: [[722, 1410], [709, 1361], [700, 1318], P(1, 1)],       // the gates reversed
          via: ['Big Porcupine — south arm', 'Big Porcupine Lake'],
          done: function () { return S.travel !== 'canoe' && near(P(1, 1), 30); } },
        { text: 'Look north over Ragged from the top step',
          wps: [I('staircase')],
          done: function () { return !!S.seenPOIs.staircase; } },
        O.home([P(1, 1), P(1, 0), P(0, 1), P(0, 0), [592, 392]]),
      ];
    },
  },
};

// ---------------------------------------------------------------------------
// ROCK LAKE (v0.9 pass 5). Rock Lake Access Point (#9), Highway 60 km 40.3,
// south side, then 8 km of gravel to the launch on the Madawaska River between
// Whitefish Lake and the north end of Rock Lake. The chain: Rock Lake (big,
// granite bluffs, three islands, the ochre pictographs, Booth's Rock ~400 ft
// above the water) -> 375 m round the dam on the Pen outlet (Pen Falls on a
// side trail) -> Pen Lake (long and narrow, the boulder line at its north
// entrance, the big sand beach) -> the Galipo River off Pen's east side ->
// 295 m past the small falls -> the river reach -> the 2,170 m, long and level
// -> Welcome Lake (round, beaches, choppy). Two nights: Pen's beach, then
// Welcome's northwest beach with the granite slab; then home.
//
// CLEAN DATA: every outline here was authored from the CHARACTER of the water
// as scope/v0.9/research-geo.md / research-lore.md describe it (long N-S with
// bluffs and islands; long and narrow; a winding river reach; a small round
// lake with a finger peninsula) — none was traced from any map. Real facts
// kept real: lake names, posted lengths (375 / 295 / 2,170 m), the access km
// (40.3), Booth's Rock, the ochre pictographs, Pen Falls and its spring pipe,
// J.R. Booth's railway (1896, last train in the forties). Where the research
// gives no name the text stays generic ("Beaver pond", "the pasture ridge").
// Authored and critic-fixed as scope/v0.9/parks/park-rock.js (the CRITIC
// comments are its audit trail); pass 5 adds `clearings` (Booth's bare top),
// `stoneLines` (the Pen boulder line, parks-shape §1.15) and moves one camp
// feature off the fleet's tent goal.
var ROCK = {
  id: 'rock',
  name: 'ROCK LAKE',
  access: {
    name: 'Rock Lake Access Point',
    short: 'Rock Lake',
    hwyKm: 40.3,                 // Rock Lake Road turns off at km 40.3, 8 km of gravel to the launch
    side: 'south',
    launch: 'Rock Lake',
  },
  W: 1200, H: 1600,

  lakes: [
    {
      // ROCK LAKE — ~5 km², granite bluffs, three islands, cottages and the old
      // railbed along the east shore, the Madawaska in from the north (the
      // river arm + the launch pool) and out at the south-east (the outflow
      // bay). North-south. Big open water: wind and motorboats.
      id: 'rock', name: 'Rock Lake', big: true, lilies: false,
      pts: [
        [212, 108], [262, 96],  [328, 124],                          // the launch pool (Madawaska)
        [350, 168], [366, 258],                                      // the river arm, east bank
        [404, 282], [500, 302], [546, 318], [572, 352],              // the north-east bay
        [548, 392], [532, 432],                                      // a bight on the east shore
        [560, 486],                                                  // Booth's Rock: the bluff headland
        [536, 540], [506, 566], [520, 600],                          // the bay under the bluff
        [556, 632], [566, 672], [592, 706], [580, 728],              // the south-east outflow arm (the Madawaska leaves here)
        [440, 742], [386, 750], [344, 740],                          // south shore; the tip is the Pen portage
        [292, 708], [244, 640],                                      // south-west
        [250, 604], [206, 572], [160, 532], [204, 494], [248, 466],  // the pictograph bay, deep between two granite headlands
        [214, 372], [270, 306],                                      // west shore north
        [310, 262], [314, 172],                                      // the river arm, west bank
        [286, 153], [256, 150], [224, 138],                          // pool bottom (the dock stands here); CRITIC: corner eased 7 u SW so the launch leg clears the arm's mouth; PASS 5: 7 u further S so the exit leg to [318,132] clears the shore by 5 u
      ],
      islands: [
        { pts: [[372, 452], [398, 442], [426, 450], [436, 470], [424, 492], [398, 500], [374, 488], [362, 470]] },   // the big central island (the island site)
        { pts: [[314, 382], [334, 378], [348, 390], [344, 404], [326, 408], [312, 398]] },                           // a small north island
        { pts: [[446, 590], [466, 586], [478, 598], [470, 612], [452, 614], [440, 604]] },                           // a small south island
      ],
      // research-fish.md ROCK LAKE: smallmouth, rock bass, perch common; brook
      // trout, lake trout, burbot (14 in / 1 lb documented), largemouth in a
      // weedy back bay uncommon; round whitefish and the stray walleye (moved up
      // from Galeairy) rare; the 3 lb rock bass is the legend (world record is
      // an Ontario fish, 3 lb, 1974).
      fish: [
        { species: 'Smallmouth Bass', weight: 34, lbMin: 1,   lbMax: 2.5, big: 4 },
        { species: 'Rock Bass',       weight: 20, lbMin: 0.2, lbMax: 0.8, big: 1.5 },
        { species: 'Yellow Perch',    weight: 12, lbMin: 0.2, lbMax: 0.7, big: 1 },
        { species: 'Brook Trout',     weight: 8,  lbMin: 1,   lbMax: 2,   big: 2.5 },
        { species: 'Lake Trout',      weight: 8,  lbMin: 1,   lbMax: 3,   big: 5 },
        { species: 'Burbot',          weight: 5,  lbMin: 0.7, lbMax: 1.5, big: 2 },
        { species: 'Largemouth Bass', weight: 5,  lbMin: 1,   lbMax: 3,   big: 4 },
        { species: 'Round Whitefish', weight: 3,  lbMin: 0.5, lbMax: 1.5, big: 2,   rare: true },
        { species: 'Walleye',         weight: 1.5, lbMin: 2,  lbMax: 4,   big: 5,   rare: true },
        { species: 'Rock Bass',       weight: 0.5, lbMin: 2.8, lbMax: 3,  big: 2.5, rare: true, legend: 'the three-pound rock bass' },
      ],
    },
    {
      // PEN LAKE — long and narrow north-south, sheltered from the westerlies;
      // a small island and a boulder line near the north entrance with one
      // canoe-width gap; red pine and sand on the east shore (the big beach on
      // a point); the west shore is moose pasture; the Galipo River leaves the
      // east side as a narrow arm; the south end is grassy moose ground.
      id: 'pen', name: 'Pen Lake', big: false, lilies: false,
      pts: [
        [372, 855], [400, 868], [420, 900], [430, 948],              // north tip (the 375 m lands here), north-east
        [414, 996], [430, 1040], [448, 1090], [462, 1130],           // east shore
        [480, 1158],                                                 // the sand point (the beach site)
        [482, 1186], [520, 1190], [548, 1200],                       // the Galipo mouth: a narrow arm east
        [546, 1218], [512, 1222], [478, 1218],
        [464, 1252], [454, 1312], [442, 1372], [422, 1424],          // south-east shore
        [386, 1462], [344, 1454],                                    // south end, grassy
        [318, 1410], [304, 1350], [300, 1284], [312, 1216],          // west shore
        [286, 1150], [308, 1090], [310, 1032],                       // west bays
        [326, 962], [308, 922], [344, 878],                          // the west pinch at the boulder line
      ],
      islands: [
        { pts: [[352, 940], [368, 936], [380, 946], [378, 960], [364, 966], [350, 958]] },   // the small landmark island at the north entrance
      ],
      // research-fish.md PEN LAKE: a lot of perch, numerous small lakers (a
      // lake-trout-only lake); a 2 lb speck documented; NO bass, no burbot, no
      // whitefish; the 6 lb brookie is the legend.
      fish: [
        { species: 'Yellow Perch',    weight: 45, lbMin: 0.3, lbMax: 0.8, big: 1 },
        { species: 'Lake Trout',      weight: 35, lbMin: 1,   lbMax: 2,   big: 4 },
        { species: 'Brook Trout',     weight: 14, lbMin: 1.5, lbMax: 2.5, big: 2.5 },
        { species: 'Lake Trout',      weight: 5,  lbMin: 4,   lbMax: 5,   big: 4,   rare: true },
        { species: 'Brook Trout',     weight: 1,  lbMin: 5.5, lbMax: 6,   big: 2.5, rare: true, legend: 'the six-pound brookie' },
      ],
    },
    {
      // THE GALIPO RIVER — the reach above the 295 m: a winding river with
      // beaver dams, low and muddy in summer, bending north-east toward the
      // 2,170 m. Authored as a narrow river polygon (a "lake" to the game).
      id: 'galipo', name: 'Galipo River', big: false, lilies: true,
      pts: [
        [644, 1166], [642, 1184], [648, 1202],                                   // west end (the 295 m lands here)
        [676, 1214], [706, 1218], [736, 1208], [762, 1192], [788, 1174],         // south bank, east
        [812, 1154], [836, 1136], [856, 1116],                                   // bending north-east
        [862, 1096], [848, 1082],                                                // the north-east end (the 2,170 m leaves here)
        [826, 1090], [804, 1112], [780, 1136], [752, 1156], [724, 1170],         // north bank, back west
        [694, 1178], [666, 1174],
      ],
      islands: [],
      // River fish, inferred from the park-wide notes (research-fish.md): brook
      // trout below a brook-trout lake, creek chub and suckers as the honest
      // river catch. No survey of the Galipo itself was found.
      fish: [
        { species: 'Brook Trout',  weight: 50, lbMin: 0.5, lbMax: 1.5, big: 2.5 },
        { species: 'Creek Chub',   weight: 30, lbMin: 0.2, lbMax: 0.5, big: 1 },
        { species: 'White Sucker', weight: 20, lbMin: 1,   lbMax: 2,   big: 4 },
      ],
    },
    {
      // THE BEAVER POND — the small pond midway along the 2,170 m carry
      // (research-lore: "a small pond midway"). Generic name on purpose.
      id: 'pond', name: 'Beaver pond', big: false, lilies: true,
      pts: [
        [862, 974], [875, 977], [885, 985], [891, 996], [893, 1008],
        [889, 1020], [881, 1028], [871, 1034], [859, 1038], [847, 1036],
        [837, 1030], [831, 1020], [833, 1010], [839, 1004], [833, 996],   // a small bay on the west side, toward the trail
        [835, 986], [841, 979], [849, 974], [855, 972], [858, 973],
      ],
      islands: [],
      fish: [
        { species: 'Brook Trout', weight: 60, lbMin: 0.3, lbMax: 1,   big: 2.5 },
        { species: 'Creek Chub',  weight: 40, lbMin: 0.2, lbMax: 0.5, big: 1 },
      ],
    },
    {
      // WELCOME LAKE — small, round-ish, not deep, ringed with sand beaches,
      // a peninsula off the west shore, beach sites on the north-west shore.
      // Surprisingly choppy: headwinds and the roughest water of the loop.
      id: 'welcome', name: 'Welcome Lake', big: true, lilies: false,
      pts: [
        [944, 652], [958, 686], [984, 656],                              // a small north bay
        [1032, 668], [1064, 700], [1088, 742], [1096, 790],              // north-east and east shore
        [1084, 836], [1058, 876], [1024, 906], [988, 926],               // south-east beaches
        [952, 932], [922, 914], [896, 893],                              // south beach; the 2,170 m lands at the south-west
        [868, 870], [850, 842],                                          // south-west
        [852, 816], [900, 812], [936, 800], [900, 786], [852, 782],      // the west peninsula: a sandy finger pointing east
        [846, 752], [832, 716],                                          // the north-west bay (the beach site with the slab)
        [848, 682], [884, 660], [916, 650],                              // north-west shore
      ],
      islands: [],
      // research-fish.md WELCOME LAKE: a premier natural brook trout lake, "big
      // and fat"; lake trout present but uncommon; white sucker; a 4-5 lb
      // brookie at the thermocline is the rare one; the tagged research brookie
      // (2014 acoustic study) is the legend — releasing it pays a bonus.
      fish: [
        { species: 'Brook Trout',  weight: 58, lbMin: 1,   lbMax: 2.5, big: 3 },
        { species: 'Lake Trout',   weight: 15, lbMin: 1.5, lbMax: 3,   big: 4 },
        { species: 'White Sucker', weight: 15, lbMin: 1,   lbMax: 3,   big: 4 },
        { species: 'Brook Trout',  weight: 6,  lbMin: 4,   lbMax: 5,   big: 3,   rare: true },
        // pass 5 sweep: the legend string is also the score-card row label, drawn
        // at 6 px with no fit — the 62-char line overran the points column on
        // the PC frame and ran off the 160 floor; landFish's toast and journal
        // line already say 'let it go' / 'science thanks you'
        { species: 'Brook Trout',  weight: 1,  lbMin: 2,   lbMax: 3.5, big: 3,   rare: true, tagged: true, legend: 'the tagged research brookie' },
      ],
    },
  ],

  // Stamped water lines. The two creeks are same-lake dead-ends: the water the
  // portages go AROUND (the Pen outlet under the dam with Pen Falls on it, and
  // the Galipo rapids below the 295 m). Neither reaches the other lake — the
  // dam and the falls are the gap. No between-lakes narrows in this park, so
  // no gates; the Galipo mouth is part of Pen's outline (the east arm).
  channels: [
    { name: 'the Pen outlet creek (Pen Falls)', a: [398, 866], b: [404, 796], w: 10,
      lakes: ['Pen Lake', 'Pen Lake'], gates: [] },
    { name: 'the Galipo rapids', a: [652, 1208], b: [578, 1226], w: 10,
      lakes: ['Galipo River', 'Galipo River'], gates: [] },
  ],

  // path[0] / path[last] are the landings (raw). Each end 1-4 u inland with the
  // last segment pointing at its water; the line between is dry.
  portages: [
    { name: 'Pen Lake portage', metres: 375,                     // around the dam; Pen Falls off the side trail a third of the way
      path: [[382, 756], [366, 792], [360, 822], [372, 848]],
      lakes: ['Rock Lake', 'Pen Lake'] },
    { name: 'Galipo River portage', metres: 295,                 // climbs past the small falls and rapids
      path: [[553, 1200], [590, 1188], [614, 1172], [636, 1184]],
      lakes: ['Pen Lake', 'Galipo River'] },
    { name: 'Welcome Lake portage', metres: 2170,                // the long, level, open one — the stamina carry
      // pass 5: the Galipo end pulled 4 u back up the trail ([846,1082] stood on
      // SHALLOW — the checker's endLand rule, added after this park was authored)
      path: [[843, 1079], [806, 1036], [796, 984], [816, 940], [858, 922], [890, 899]],   // one long westward bow, ~242 u
      lakes: ['Galipo River', 'Welcome Lake'] },
  ],

  pois: {
    // the launch on the Madawaska: the dock on the south shore of the river
    // pool, planks reaching north into the water; the canoe waits beside it
    dock:       { x: 256, y: 138, name: 'Rock Lake Access Point' },
    board:      { x: 242, y: 160 },
    canoeStart: { x: 266, y: 148 },
  },

  inspects: [
    { x: 582, y: 486, scene: 'boothsrock', name: "Booth's Rock lookout", lake: 'Rock Lake',
      caption: "Rock Lake laid out four hundred feet below, islands and all. Whitefish Lake is a thin blue line to the northwest. J.R. Booth's railway once ran along the shore down there." },
    { x: 182, y: 544, scene: 'ochre', name: 'Ochre pictographs', lake: 'Rock Lake', water: true,
      caption: 'Red ochre on grey granite — small marks in two shadowed alcoves. Three lines, each about a foot long. Somebody made these a very long time ago. Leave them be.' },
    { x: 388, y: 790, scene: 'penfalls', name: 'Pen Falls', lake: 'Pen Lake',
      caption: 'Pen Falls — a trough of white water a couple of metres high, roaring into a run of low rapids. A stub of pipe in the creek marks a cold spring. Sweetest water on the trip.' },
    { x: 190, y: 1060, scene: 'lookout', name: 'the pasture ridge', lake: 'Pen Lake', hidden: true,
      caption: 'A bare granite ridge above the moose pasture. Pen Lake lies below, long and thin as a canoe, the sand point white on the far shore.' },
    // note 21: the message board at the launch (final sweep, as on Smoke):
    // 18 u west-south-west of where fixup stands the board (240,160), 33 u
    // from the dock landing; `info`, never a vista
    // caption '' on purpose (Evrtek, 2026-09-04): the painting already reads
    { x: 222, y: 164, scene: 'board', name: 'the message board', lake: 'Rock Lake', info: true,
      caption: '' },
  ],

  campsites: [
    { id: 'rockisle', x: 400, y: 470, lake: 'Rock Lake', name: 'Rock Lake island site',
      variant: { mirror: false, phase: 1.2, coveX: 30, groundSeed: 0x50C41, treeSeed: 10,
                 feature: { id: 'railspike', x: 128, y: 48, sprite: 'hdRailSpike', r: 3,
                            label: 'LOOK AT THE RAIL SPIKE', title: 'THE RAIL SPIKE',
                            lines: ['A square-headed iron spike sits on the fire-ring rock, rusted orange.',
                                    'Somebody carried it over from the old railbed on the east shore.',
                                    "J.R. Booth's line ran along this lake from 1896. The last train through was in the forties.",
                                    'The rails are long gone. The spikes keep turning up.'],
                            entry: "Day N — found a rail spike on the fire-ring rock. Booth's railway ran along this shore; the trains stopped in the forties." } } },
    { id: 'penisle', x: 365, y: 951, lake: 'Pen Lake', name: 'Pen Lake island site',
      variant: { mirror: true, phase: 2.6, coveX: 130, groundSeed: 0x9E415, treeSeed: 11,
                 canoe: { x: 130, y: 62 }, sign: { x: 58, y: 64 },
                 // pass 5: {48,50} stood 8 u from the fleet's PITCH TENT goal on this
                 // mirrored stage (tent at {44,34}); moved up the slope to the left
                 feature: { id: 'boulder', x: 30, y: 42, sprite: 'hdErratic', r: 3,
                            label: 'LOOK AT THE BOULDER', title: 'THE SPLIT BOULDER',
                            lines: ['A boulder the size of a canoe, split clean down the middle by frost.',
                                    'Its cousins stand in a line across the lake just off this island,',
                                    'with one gap between them a canoe fits through. Everyone finds it the slow way.'],
                            entry: 'Day N — slept beside a frost-split boulder. Its cousins line the lake off the island, one canoe-width gap between them.' } } },
    { id: 'penbeach', x: 486, y: 1160, lake: 'Pen Lake', name: 'Pen Lake beach site',
      variant: { mirror: false, phase: 0.2, coveX: 42, groundSeed: 0x9E8EA, treeSeed: 12,
                 tent: { x: 98, y: 26 }, box: { x: 14, y: 17 }, sign: { x: 120, y: 66 }, barrel: { x: 62, y: 58 },
                 feature: { id: 'pineridge', x: 130, y: 44, sprite: 'hdPineRidge', r: 3,
                            label: 'LOOK AT THE PINE RIDGE', title: 'THE PINE RIDGE',
                            lines: ['A ridge of red pines on red gravel stands behind the beach.',
                                    'The tent pads hide behind it, out of the wind off the lake.',
                                    'You can see these pines from two islands away. Everyone races for this site.'],
                            entry: 'Day N — camped on the big sand beach under the red pines. You can see them from two islands away. Got here first.' } } },   // pass 5 sweep: a solo paddler — no 'we' (every other entry is first-person-singular or subjectless)
    { id: 'welcomenw', x: 816, y: 730, lake: 'Welcome Lake', name: 'Welcome Lake northwest beach',
      variant: { mirror: true, phase: 3.6, coveX: 118, groundSeed: 0x3E1C0, treeSeed: 13,
                 tent: { x: 52, y: 30 }, canoe: { x: 130, y: 64 }, sign: { x: 58, y: 66 },
                 // pass 5: {112,52} stood 10 u from a CHOP WOOD goal (the mirrored
                 // deadwood log at {120,48}); moved down to the beach edge, 13 u
                 // above this site's waterline — sand one side, water the other
                 feature: { id: 'beachslab', x: 100, y: 62, sprite: 'hdLedge', r: 3,
                            label: 'LOOK AT THE GRANITE SLAB', title: 'THE GRANITE SLAB',
                            lines: ['A slab of granite the size of a door lies flat at the edge of the beach.',
                                    'Somebody has been using it as a table. It is exactly knee-high and dead level.',
                                    'Sand on one side, cold water on the other. Best kitchen on the lake.'],
                            entry: 'Day N — ate off a flat granite slab at the beach edge. Table height, dead level, cold sand under it.' } } },
  ],

  wildlife: [
    { species: 'Common Loon',        at: [330, 520],  water: true,  from: 0,  to: 24 },
    { species: 'Common Loon',        at: [380, 1300], water: true,  from: 0,  to: 24 },
    { species: 'Common Loon',        at: [990, 760],  water: true,  from: 0,  to: 24 },
    { species: 'Bald Eagle',         at: [470, 640],  water: true,  from: 8,  to: 18, flies: true },
    { species: 'Moose',              at: [268, 1130], water: false, from: 6,  to: 10 },   // the west-shore moose pasture
    { species: 'Moose',              at: [380, 1486], water: false, from: 17, to: 21 },   // the grassy south end
    { species: 'Great Blue Heron',   at: [690, 1234], water: false, from: 7,  to: 19 },
    { species: 'Beaver',             at: [708, 1196], water: true,  from: 16, to: 22 },   // the Galipo dams
    { species: 'Beaver',             at: [380, 1436], water: true,  from: 17, to: 22 },
    { species: 'River Otter',        at: [334, 236],  water: true,  from: 6,  to: 20 },   // the river arm
    { species: 'Painted Turtle',     at: [324, 1150], water: true,  from: 9,  to: 17 },
    { species: 'Belted Kingfisher',  at: [614, 700],  water: false, from: 7,  to: 19 },   // beside the outflow arm
    { species: 'White-tailed Deer',  at: [940, 1010], water: false, from: 6,  to: 10 },   // the open hardwoods along the 2,170 m
    { species: 'Red-tailed Hawk',    at: [620, 420],  water: false, from: 9,  to: 18, flies: true },
    { species: 'Ruffed Grouse',      at: [640, 1330], water: false, from: 7,  to: 19, remote: true },
    { species: 'Pine Marten',        at: [720, 600],  water: false, from: 6,  to: 10, remote: true },
    { species: 'Barred Owl',         at: [1080, 1090], water: false, from: 18, to: 22, remote: true },
    { species: 'Eastern Wolf',       at: [150, 1420], water: false, from: 18, to: 21, remote: true },
    // 09-04 TAIL FIX (the v0.9 soft spot "Rock Lake can finish animal-free"):
    // the 18 anchors above either sit off the paddled line or open after dark,
    // so a paddler who keeps to the route could finish 0 of 14 — seeds 2, 18
    // and 22 of 1-40 did. These three sit ON the water the trip actually
    // crosses, daylight only, and are all species already on this roster (the
    // 'of N' denominator does not move); each is >= 40 u off every anchor above.
    { species: 'Painted Turtle',     at: [380, 960],  water: true,  from: 7,  to: 19 },   // the boulder line at Pen's north entrance, east of the gap island
    { species: 'Common Loon',        at: [326, 638],  water: true,  from: 7,  to: 19 },   // Rock's south basin, off the yellow portage sign
    { species: 'River Otter',        at: [772, 1160], water: true,  from: 7,  to: 19 },   // the Madawaska narrows between the 295 m and the 2,170 m
  ],

  huts: [
    { x: 700, y: 1210 },    // the Galipo, where the dams are
    { x: 392, y: 1446 },    // Pen's grassy south end
    { x: 582, y: 714 },     // the quiet end of Rock's outflow arm
  ],

  berries: [
    [600, 250], [680, 720], [760, 820], [1130, 700], [1100, 940], [760, 1260],
    [560, 1420], [200, 880], [170, 1260], [450, 1560], [1000, 520], [120, 300],
  ],

  lookouts: [
    { x: 190, y: 1060, r: 22 },   // the granite knob above the moose pasture, west of Pen
  ],

  // pass 5 (parks-shape §1.11): the bare top of Booth's Rock — an ADVERTISED
  // lookout, so it gets a plain tree-free disc rather than a lookouts[] entry
  // (those pair with a hidden vista); the granite is in the painter, not baked
  clearings: [
    { x: 582, y: 486, r: 16 },
  ],

  // pass 5 (parks-shape §1.15): the boulder line across Pen's north entrance
  // west of the landmark island, with one canoe-width gap (research-lore: "a
  // line of large boulders across the lake ... one gap a canoe fits through").
  // scatterFlora drops shore STONES along a -> b at ~5.5 u, skipping gapW
  // units centred at fraction `gap` of the line: here two boulders off the
  // west shore, one off the island, and a ~6 u clear corridor between (the
  // passage west of the island is 26 u wide). Hull-scrape rocks like every
  // other stone; the driver's route runs EAST of the island and never meets it.
  stoneLines: [
    { a: [327, 957], b: [352, 953], gap: 0.5, gapW: 13 },
  ],

  trip: {
    name: "BOOTH'S ROCK",
    blurb: "Down the Madawaska, up the Galipo, over the 2,170 m to Welcome's beaches.",
    facts: "2 nights · Booth's Rock & the 2,170 m",
    // v0.9.1 pass 7 record, re-driven under canoe momentum — never typed:
    // `node tools/headless.js 2 --seed 11` = 1905 pts (3 days); seeds
    // 3/7/11/23/31/47/59/101 ran 1728-1905, median 1794. All eight complete in
    // 3 days, and this is the one park the coast PAID: the drift-aware
    // wildlife approach stops the hull short instead of flushing the animal,
    // so seed 11 banked 15 sightings. Retires the v0.9 record (1792 at seed 3,
    // band 1617-1792, median 1686.5).
    fleetScore: 1905,
    objectives: function (P, C, I, L, O) {
      return [
        O.launch(),
        // CRITIC: waypoints re-laid so every straight driver leg keeps >= 6 u of
        // water: the launch pool exit, the river-arm mouth, the pictograph-bay
        // headland (the old [300,660] leg crossed 51 u of it).
        // PASS 5: every routing waypoint now keeps >= 60 u from every landing
        // (the checker's trip.wpLanding rule, pass 3 — the driver's LAND HERE
        // trap): the pool exit [278,116] -> [318,132] (66 u off the dock
        // landing), [430,540] -> [440,556] (65 u off the island site's landing),
        // [400,1000] -> [404,1030] and [440,1130] -> [420,1120] on Pen, the
        // Galipo-arm centre wp dropped (no point in the arm clears both the beach
        // landing and the 295 m sign), [822,1112] -> [798,1138] on the river,
        // [880,720] -> [900,720] on Welcome. Same in the home chain.
        { text: "Land on the east shore and climb Booth's Rock",
          wps: [[318, 132], [322, 150], [342, 190], [336, 262], [440, 330], I('boothsrock')],
          done: function () { return !!S.seenPOIs.boothsrock; } },
        { text: 'Find the ochre pictographs on the cliff',          // the research gives no compass side for the cliff
          wps: [[440, 556], I('ochre')],
          done: function () { return !!S.seenPOIs.ochre; } },
        { text: 'Paddle south to the yellow portage sign',
          wps: [[340, 620], P(0, 0)],
          done: function () { return S.travel !== 'canoe' && near(P(0, 0), 30); } },
        { text: 'Walk up the trail to Pen Falls',
          wps: [I('penfalls')],
          done: function () { return !!S.seenPOIs.penfalls; } },
        { text: 'Carry the canoe 375 m over to Pen Lake',
          wps: [P(0, 0), P(0, 1)],
          done: function () { return S.travel === 'canoe' && lakeAt(S.player.x, S.player.y) === L('Pen Lake'); } },
        { text: 'Camp on the big sand beach — the pine ridge',           // pass 5 sweep: was 'before dark' — the leg lands by 10:04 on every seed, 9.5 game hours before dusk; the Smoke chain's 'Camp at … — the <feature>' style instead
          wps: [[404, 1030], [420, 1120], C('penbeach')],              // stay off the east-shore bulge north of the sand point
          done: function () { return S.lastCamp === 'penbeach'; } },
        { text: 'Day 2 — east up the Galipo to the 295 m sign',
          wps: [[416, 1212], P(1, 0)],                                 // first target ~87 u from the camp (driver boat-first rule is 60), then straight up the arm's centre line
          done: function () { return S.travel !== 'canoe' && near(P(1, 0), 30); } },
        { text: 'Portage 295 m, then paddle up the river',
          wps: [P(1, 1), [700, 1196], [770, 1162], [798, 1138], P(2, 0)],
          done: function () { return S.travel !== 'canoe' && near(P(2, 0), 30); } },
        { text: 'The long one — carry 2,170 m to Welcome Lake',
          wps: [P(2, 1)],
          done: function () { return S.travel === 'canoe' && lakeAt(S.player.x, S.player.y) === L('Welcome Lake'); } },
        // PASS 5 SWEEP: the peninsula-tip waypoint [960,800] -> [990,800]. The
        // driver turns TUNE.waypointAt (26 u) short of a waypoint, so from
        // [960,800] both the camp leg (toward [900,720]) and the home leg (toward
        // the 2,170 m landing) cut back across the tip's sand at x <= 934 and
        // pinned in the shallows at [934,797] on the headwind seeds; from
        // [990,800] the same early turns pass the tip at x 957-960 (23 u clear).
        { text: 'Camp on the northwest beach of Welcome',
          wps: [[990, 800], [900, 720], C('welcomenw')],
          done: function () { return S.lastCamp === 'welcomenw'; } },
        // PASS 5 SWEEP: the home tail [342,190] -> [322,150] -> [318,132] -> dock
        // had its last two waypoints 18 u apart (< 26): both were consumed at
        // once at ~[324,157] and the canoe ran west along y 156 — the launch
        // pool's sand shelf — and pinned at [302,156] for 16-31 ticks on every
        // seed. Now [326,150] -> [308,120] (35 u apart, 72 / 61 u off the dock
        // landing): the early turn comes at ~[321,142] and the line to the dock
        // crosses water and the landing's shallows, LAND HERE firing at ~[282,150].
        O.home([[920, 740], [990, 800], P(2, 1), P(2, 0), [798, 1138], [770, 1162], [700, 1196], P(1, 1),
                P(1, 0), [416, 1212], [420, 1120], [404, 1030], P(0, 1), P(0, 0),
                [300, 660], [288, 390], [330, 290], [336, 262], [342, 190], [326, 150], [308, 120]]),
      ];
    },
  },
};

var PARKS = [CANOE, SMOKE, ROCK];         // pristine, in Highway 60 order west to east
PARKS.forEach(function (p) { p.trip.id = p.id; });   // S.trip.id IS the record key

// --- the live park ------------------------------------------------------------
// loadPark assigns these; the same names every other file has always read.
var PARK = null;                   // the deep clone the game plays on
var LAKES = null, CHANNELS = null, PORTAGES = null, POIS = null, INSPECTS = null,
    CAMPSITES = null, WILDLIFE_SPOTS = null, HUT_SPOTS = null,
    BERRY_PATCHES = null, LOOKOUTS = null, CLEARINGS = null,
    COTTAGES = null, SNAG_BEDS = null,   // pass 4: shoreline cabin lots (baked), extra deadhead beds
    STONE_LINES = null;                  // pass 5: authored boulder lines with a gap (Pen Lake)
var BERRIES = [];                  // generated from BERRY_PATCHES by scatterFlora (note 8), like STONES: {x, y, id}

function clonePark(p) {
  var c = JSON.parse(JSON.stringify(p));   // JSON drops the function silently
  c.trip.objectives = p.trip.objectives;   // reattach the one function we keep
  return c;
}

/**
 * Load a park: clone it, point the globals at the clone, and rebuild
 * everything that is built from them — the raster (which snaps the clone's
 * points), the landings, the lake polygons, the terrain canvas, and a fresh
 * trip state standing on this park's dock. Picking the same park again still
 * runs the whole pipeline: correctness over the second of CPU.
 */
function loadPark(i) {
  var p = clonePark(PARKS[i]);
  PARK = p;
  WORLD.W = p.W; WORLD.H = p.H;
  LAKES = p.lakes; CHANNELS = p.channels; PORTAGES = p.portages; POIS = p.pois;
  INSPECTS = p.inspects; CAMPSITES = p.campsites; WILDLIFE_SPOTS = p.wildlife;
  HUT_SPOTS = p.huts; BERRY_PATCHES = p.berries || []; LOOKOUTS = p.lookouts || [];
  CLEARINGS = p.clearings || []; COTTAGES = p.cottages || []; SNAG_BEDS = p.snags || [];
  STONE_LINES = p.stoneLines || [];
  // the camp stage's per-site faces (camp.js) come with the campsites
  CAMP_VARIANTS = {};
  p.campsites.forEach(function (c) { if (c.variant) CAMP_VARIANTS[c.id] = c.variant; });

  buildWorld();          // raster -> fixupGeography (snaps the clone) -> scatterFlora
  buildLandings();       // dock + raw trail ends + campsite water edges
  buildLakePolys();      // game.js: LAKE_POLYS for lakeAt
  rebuildTerrain();      // render.js: the terrain canvas, and the camp floor forgets its site
  newTrip();             // game.js: player at POIS.start, canoe at POIS.canoeStart — all of THIS park
  return p;
}

/** The dock's plank direction as a unit step: 'north' (the default) is up. */
function dockDir() {
  var f = (POIS.dock && POIS.dock.facing) || 'north';
  return { dx: f === 'east' ? 1 : f === 'west' ? -1 : 0,
           dy: f === 'south' ? 1 : f === 'north' ? -1 : 0 };
}

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

/** A polygon's bounding box — the cheap reject before pointInPoly (note 15). */
function polyBox(poly) {
  var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }, i;
  for (i = 0; i < poly.length; i++) {
    if (poly[i][0] < b.x0) b.x0 = poly[i][0];
    if (poly[i][0] > b.x1) b.x1 = poly[i][0];
    if (poly[i][1] < b.y0) b.y0 = poly[i][1];
    if (poly[i][1] > b.y1) b.y1 = poly[i][1];
  }
  return b;
}

function inBox(x, y, b) {
  return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
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
  // the dock stands on the south shore of the launch lake, planks reaching north
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

  // the cairn is one park's own (optional): snapped, then its vista stands
  // exactly on it — found by scene, never by position in the list
  if (POIS.cairn) {
    var cn = snapTo(POIS.cairn.x + 20, POIS.cairn.y, wantsLand);
    POIS.cairn.x = Math.round(cn.x); POIS.cairn.y = Math.round(cn.y);
  }

  INSPECTS.forEach(function (p) {
    var q = p.water ? snapTo(p.x, p.y, wantsShallow, 60) : snapTo(p.x, p.y, wantsLand, 60);
    p.x = Math.round(q.x); p.y = Math.round(q.y);
  });
  if (POIS.cairn) {
    var ci = INSPECTS.filter(function (p) { return p.scene === 'cairn'; })[0];
    if (ci) { ci.x = POIS.cairn.x; ci.y = POIS.cairn.y; }   // one cairn, one truth
  }

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

  // every lake outline smoothed once, with its bounding box for the reject
  // below; islands are {c, r} circles or {pts} polygons smoothed the same way
  var polys = LAKES.map(function (l) {
    var poly = smoothPoly(l.pts, 6);
    return {
      lake: l, poly: poly, box: polyBox(poly),
      isles: (l.islands || []).map(function (isl) {
        if (isl.pts) { var ip = smoothPoly(isl.pts, 6); return { poly: ip, box: polyBox(ip) }; }
        return { c: isl.c, r: isl.r };
      }),
    };
  });

  var gx, gy, i;
  for (gy = 0; gy < GH; gy++) {
    for (gx = 0; gx < GW; gx++) {
      var x = gx * CELL + CELL / 2, y = gy * CELL + CELL / 2;
      for (i = 0; i < polys.length; i++) {
        if (!inBox(x, y, polys[i].box)) continue;     // outside the box, outside the lake
        if (pointInPoly(x, y, polys[i].poly)) {
          var isle = false, isl = polys[i].isles, k;
          for (k = 0; k < isl.length; k++) {
            if (isl[k].poly) {
              if (inBox(x, y, isl[k].box) && pointInPoly(x, y, isl[k].poly)) { isle = true; break; }
            } else {
              var dx = x - isl[k].c[0], dy = y - isl[k].c[1];
              if (dx * dx + dy * dy < isl[k].r * isl[k].r) { isle = true; break; }
            }
          }
          GRID[gy * GW + gx] = isle ? WORLD.GRASS : WORLD.WATER;
          break;
        }
      }
    }
  }

  // channels: stamp water along the joining lines (a/b; from/to is the
  // v0.8.0 spelling and still reads)
  CHANNELS.forEach(function (c) {
    stampLine(c.a || c.from, c.b || c.to, c.w / 2, WORLD.WATER);
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

  // where each lake's name goes (note 15): the pole of inaccessibility,
  // written onto the lake record for buildLakePolys / the renderer to read
  polys.forEach(function (P) {
    var pole = lakeLabelPole(P);
    P.lake.labelX = pole.x; P.lake.labelY = pole.y;
  });

  fixupGeography();          // points snap to the terrain they need
  scatterFlora();            // then the forest keeps clear of the real spots
}

/**
 * The pole of inaccessibility of a lake (note 15): the water cell farthest
 * from any shore — its own outline AND its islands — so a crescent or an
 * L-shaped lake gets its name on the water, not on the land the centroid
 * of a bent polygon falls on. A coarse 8 u grid over the lake's box, each
 * candidate scored against the smoothed outlines; ~3,000 cells x ~250
 * outline points on the biggest lake, a few milliseconds at build.
 */
function lakeLabelPole(P) {
  var shore = P.poly.slice(), i, a;
  P.isles.forEach(function (isl) {
    if (isl.poly) { shore = shore.concat(isl.poly); return; }
    for (a = 0; a < Math.PI * 2; a += Math.PI / 8) shore.push([isl.c[0] + Math.cos(a) * isl.r, isl.c[1] + Math.sin(a) * isl.r]);
  });
  var best = null, bestD = -1, x, y;
  for (y = P.box.y0 + 4; y < P.box.y1; y += 8) {
    for (x = P.box.x0 + 4; x < P.box.x1; x += 8) {
      if (!pointInPoly(x, y, P.poly) || !isWater(terrainAt(x, y))) continue;
      var d = 1e9;
      for (i = 0; i < shore.length; i++) {
        var dx = x - shore[i][0], dy = y - shore[i][1], d2 = dx * dx + dy * dy;
        if (d2 < d) { d = d2; if (d <= bestD) break; }     // already beaten: next cell
      }
      if (d > bestD) { bestD = d; best = [x, y]; }
    }
  }
  if (!best) {                       // a lake too thin for the grid: fall back to its centroid
    var cx = 0, cy = 0, n = P.lake.pts.length;
    P.lake.pts.forEach(function (p) { cx += p[0]; cy += p[1]; });
    return { x: cx / n, y: cy / n };
  }
  return { x: best[0], y: best[1] };
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
  // 7,000 samples make a canopy (note 14): ~65% full-height pine/birch with
  // the old maps as understory beneath them. A literal on purpose — not a
  // TUNE dial, so saved Outfitter overrides can never thin the woods.
  var rnd = rngFrom(0x0A160), i;
  TREES.length = 0;
  for (i = 0; i < 7000; i++) {
    var x = rnd() * WORLD.W, y = rnd() * WORLD.H;
    var t = terrainAt(x, y);
    if (t !== WORLD.GRASS) continue;
    // clearings wide enough that a 24-unit crown never buries a trail, a
    // camp, a sign or a vista star
    if (nearAnyTrail(x, y, 14)) continue;
    if (nearAnyCamp(x, y, 22)) continue;
    if (nearAnySpot(x, y, 14)) continue;
    if (inAnyClearing(x, y)) continue;               // the lookout ledge, berry patches, the park's own clearings
    var big = rnd() < 0.65;
    var pine = rnd() < 0.72;
    TREES.push({ x: x, y: y, kind: pine ? (big ? 'pine' : 'pineSm') : (big ? 'birch' : 'birchSm') });
  }
  TREES.sort(function (a, b) { return a.y - b.y; });   // painter's order

  // lily pads on the weedy lakes, in their own shallows (note 15): sampled
  // over the lake's box and kept where the water is shallow — a bent lake
  // gets lilies in every bay, not a disc round a centroid on the land
  LILIES.length = 0;
  LAKES.forEach(function (l) {
    if (!l.lilies) return;
    var b = polyBox(l.pts), got = 0, j;
    for (j = 0; j < 400 && got < 40; j++) {
      var lx = b.x0 + rnd() * (b.x1 - b.x0), ly = b.y0 + rnd() * (b.y1 - b.y0);
      if (terrainAt(lx, ly) !== WORLD.SHALLOW) continue;
      LILIES.push({ x: lx, y: ly }); got++;
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

  // berry bushes (note 8): 3-4 to a patch, within 9 u of each authored
  // centre, so a patch reads as a place you found rather than a scatter.
  // Last in the seed order on purpose: adding a park's patches never
  // re-rolls its forest. Each bush is picked once per trip by its id
  // (S.picked in game.js); the counts are literals like the forest's.
  BERRIES.length = 0;
  BERRY_PATCHES.forEach(function (c, pi) {
    var n = 3 + (rnd() < 0.5 ? 1 : 0), got = 0, g5 = 0;
    while (got < n && g5++ < 40) {
      var ba = rnd() * Math.PI * 2, br = 3 + rnd() * 6;
      var bx = c[0] + Math.cos(ba) * br, by = c[1] + Math.sin(ba) * br;
      if (terrainAt(bx, by) !== WORLD.GRASS) continue;
      BERRIES.push({ x: bx, y: by, id: 'b' + pi + '.' + got });
      got++;
    }
  });

  // snag beds (pass 4, parks-shape §1.14): where a park says the drowned
  // stumps stand thick, n more deadheads in the water within r of the
  // centre — shallows allowed, since that is where a flooded stump shows.
  // Last in the seed order and rolled only when declared, so a park without
  // beds (Canoe) builds exactly the world it built before. Trails and camp
  // landings keep a 30 u berth: the put-in walk stays a clean paddle.
  SNAG_BEDS.forEach(function (b) {
    var got = 0, g6 = 0;
    while (got < b.n && g6++ < 400) {
      var sa = rnd() * Math.PI * 2, sr = Math.sqrt(rnd()) * b.r;
      var sx6 = b.x + Math.cos(sa) * sr, sy6 = b.y + Math.sin(sa) * sr;
      var t6 = terrainAt(sx6, sy6);
      if (t6 !== WORLD.WATER && t6 !== WORLD.SHALLOW) continue;
      if (nearAnyTrail(sx6, sy6, 30) || nearAnyCamp(sx6, sy6, 30)) continue;
      DEADHEADS.push({ x: sx6, y: sy6, a: rnd() * Math.PI * 2 });
      got++;
    }
  });

  // boulder lines (pass 5, parks-shape §1.15): where a park says a line of
  // rocks bars a passage with one gap in it (Pen Lake's north entrance), a
  // row of shore stones every ~5.5 u along a -> b, skipping `gapW` units
  // centred at fraction `gap` of the line, each a little off the line so it
  // reads as a reef and not a ruler. Only cells that are water take a stone;
  // the reach of a stone is r + 2.4, so the gap needs > 10 u to be a gap.
  // Last in the seed order, rolled only when declared: no other park moves.
  STONE_LINES.forEach(function (ln) {
    var len = Math.hypot(ln.b[0] - ln.a[0], ln.b[1] - ln.a[1]);
    if (len < 1) return;
    var ux = (ln.b[0] - ln.a[0]) / len, uy = (ln.b[1] - ln.a[1]) / len;
    var step = ln.step || 5.5, gapAt = (ln.gap === undefined ? 0.5 : ln.gap) * len, gapW = ln.gapW || 12, s;
    for (s = 0; s <= len; s += step) {
      var jit = (rnd() - 0.5) * 2;                       // one roll per slot, gap or not, so the line is stable
      if (Math.abs(s - gapAt) < gapW / 2) continue;
      var sx7 = ln.a[0] + ux * s - uy * jit, sy7 = ln.a[1] + uy * s + ux * jit;
      if (!isWater(terrainAt(sx7, sy7))) continue;
      STONES.push({ x: sx7, y: sy7, r: 2.2 + rnd() * 0.8, hitAt: -99 });   // boulders, not pebbles
    }
  });
}

// the tree-free discs the park declares (note 8 / parks-shape §1.11-1.12):
// the lookout ledge (its r), a 12 u ring round every berry patch so the
// bushes show, and any plain clearings
function inAnyClearing(x, y) {
  var i;
  for (i = 0; i < LOOKOUTS.length; i++) {
    if (Math.hypot(x - LOOKOUTS[i].x, y - LOOKOUTS[i].y) < LOOKOUTS[i].r) return true;
  }
  for (i = 0; i < CLEARINGS.length; i++) {
    if (Math.hypot(x - CLEARINGS[i].x, y - CLEARINGS[i].y) < CLEARINGS[i].r) return true;
  }
  for (i = 0; i < BERRY_PATCHES.length; i++) {
    if (Math.hypot(x - BERRY_PATCHES[i][0], y - BERRY_PATCHES[i][1]) < 12) return true;
  }
  for (i = 0; i < COTTAGES.length; i++) {           // a cottage lot is a cleared lot (pass 4)
    if (Math.hypot(x - COTTAGES[i][0], y - COTTAGES[i][1]) < 9) return true;
  }
  return false;
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

// the signed and starred places: vistas, portage landings (trail ends), the
// permit board, the cairn and the dock — the forest keeps its distance
function nearAnySpot(x, y, d) {
  var i;
  for (i = 0; i < INSPECTS.length; i++) {
    if (Math.hypot(x - INSPECTS[i].x, y - INSPECTS[i].y) < d) return true;
  }
  for (i = 0; i < PORTAGES.length; i++) {
    var p = PORTAGES[i].path, a = p[0], b = p[p.length - 1];
    if (Math.hypot(x - a[0], y - a[1]) < d || Math.hypot(x - b[0], y - b[1]) < d) return true;
  }
  if (Math.hypot(x - POIS.board.x, y - POIS.board.y) < d) return true;
  if (POIS.cairn && Math.hypot(x - POIS.cairn.x, y - POIS.cairn.y) < d) return true;
  if (Math.hypot(x - POIS.dock.x, y - POIS.dock.y) < d) return true;
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
  var dd = dockDir();          // the landing sits 8 u out along the planks
  LANDINGS.push({ x: POIS.dock.x + dd.dx * 8, y: POIS.dock.y + dd.dy * 8, kind: 'dock', name: 'Access Point dock' });
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
