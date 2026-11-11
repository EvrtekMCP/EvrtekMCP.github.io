// LEVEL 10's roll call (rule 29: the finale revisits every level's idea, in order, as a test). Act 1 brings back one
// wave from each level, levels 1 to 9, using each builder's own kind from its own folder (LEVEL-API section 1: level
// 10 imports everyone's kinds, it never copies them). The imports are dynamic and forgiving: a kind that has not been
// merged yet is simply absent, and its wave falls back to level 1's kinds, so this level always loads and plays.
// Each wave spawns the borrowed kind from its own `sample` event (the one it warms its shaders with, so it is a valid
// event by construction) with only the position changed.
const SRC = {
  'boost-ring': '../../pickups/boost-ring/index.js',             // level 2
  boulder: '../../obstacles/boulder/index.js',                   // level 2
  'gate-turret': '../../enemies/gate-turret/index.js',          // level 3
  'seeker-drone': '../../enemies/seeker-drone/index.js',        // level 4
  sniper: '../../enemies/sniper/index.js',                       // Ion Storm (level5.js), played 7th since 11-08
  'ice-mine': '../../obstacles/ice-mine/index.js',              // level 6
  'swarm-unit': '../../enemies/swarm-unit/index.js',            // Neon Orbital (level7.js), played 5th since 11-08
  'searchlight-sentry': '../../enemies/searchlight-sentry/index.js', // level 8
  'crystal-emitter': '../../enemies/crystal-emitter/index.js',  // level 9
};
const GOT = {};
await Promise.all(Object.entries(SRC).map(async ([key, path]) => {
  try { const m = await import(path + '?v=0.6.1'); if (m.default && m.default.name) GOT[key] = m.default; } catch (e) { /* not merged yet */ }
}));
export const cameoKinds = () => Object.values(GOT);
export const cameosPresent = () => Object.keys(GOT);

// put one of a borrowed kind at (nx, ny), from its sample event
function put(L, key, d, nx, ny, extra) {
  const k = GOT[key]; if (!k) return false;
  L.add(d, k.name, Object.assign({}, k.sample || {}, { nx, ny }, extra || {}));
  return true;
}
export const CAMEOS = {
  // level 1, NEBULA RUN: the lantern pods. Roll into their fire and it goes home.
  l1(L, d) {
    L.add(d, 'pod', { nx: -0.5, ny: 0.55, drift: 1.2, bursts: 1, shots: 2 });
    L.add(d + 70, 'pod', { nx: 0.5, ny: 0.45, drift: -1.2, bursts: 1, shots: 2 });
  },
  // level 2, SHATTERED MOON: a boost-ring chain, then strafers in a pair
  l2(L, d) {
    // a chain of four (fly them all for the speed burst), as level 2 lays them
    if (GOT['boost-ring']) L.line(d, -0.35, -0.25, 0.35, 0.2, 4, 34, GOT['boost-ring'].name, (i, n) => ({ chain: 'l10-c1', idx: i, of: n }));
    else L.line(d, -0.3, -0.2, 0.3, 0.2, 5, 26);
    L.add(d + 190, 'shrike', { side: 1, ny: 0.55, shots: 2 });
    L.add(d + 190, 'shrike', { side: -1, ny: -0.35, shots: 2 });
    if (GOT.boulder) L.add(d + 300, GOT.boulder.name, { from: -1, cross: -0.25, ny: -0.45, r: 2.4, span: 320, variant: 1 });
  },
  // level 3, THE GATEFIELD: gate turrets
  l3(L, d) {
    // seated on the mounts of a gate that is not there any more: they still keep the music's time
    if (!put(L, 'gate-turret', d, 0, 0, { gx: 0, gy: 0, mount: -50, volleys: [8], shots: 2 })) L.add(d, 'pod', { nx: -0.45, ny: 0.35, bursts: 2, shots: 1 });
    if (!put(L, 'gate-turret', d + 90, 0, 0, { gx: 0, gy: 0, mount: -130, volleys: [8], shots: 2 })) L.add(d + 90, 'pod', { nx: 0.45, ny: 0.35, bursts: 2, shots: 1 });
    L.line(d - 40, 0, -0.4, 0, -0.1, 4, 26);
  },
  // level 4, SOLAR SKIM: seeker drones
  l4(L, d) {
    // each holds station ahead, drifts toward your lane, and fires bolts that curve after you: roll them home
    if (!put(L, 'seeker-drone', d, 0.5, 0.5, { shots: 2 })) L.add(d, 'pod', { nx: 0.5, ny: 0.5, drift: -2, bursts: 2, shots: 1 });
    if (!put(L, 'seeker-drone', d + 110, -0.5, 0.2, { shots: 2 })) L.add(d + 110, 'pod', { nx: -0.5, ny: 0.2, drift: 2, bursts: 2, shots: 1 });
  },
  // level5.js, ION STORM (played 7th since 11-08): snipers
  l5(L, d) {
    // perched outside the box (level 5's rule), each sights you, locks, and fires one bolt down its line
    if (!put(L, 'sniper', d, -1.3, 0.65, { shots: 1 })) L.add(d, 'pod', { nx: -0.55, ny: 0.65, bursts: 1, shots: 3 });
    if (!put(L, 'sniper', d + 120, 1.3, 0.55, { shots: 1 })) L.add(d + 120, 'pod', { nx: 0.55, ny: 0.6, bursts: 1, shots: 3 });
    L.line(d - 30, 0, -0.5, 0, -0.2, 5, 24);
  },
  // level 6, FROZEN RIFT: ice mines
  l6(L, d) {
    if (!put(L, 'ice-mine', d, -0.4, 0.2)) L.add(d, 'mines', { nx: -0.4, ny: 0.2, n: 5 });
    if (!put(L, 'ice-mine', d + 80, 0.45, -0.3)) L.add(d + 80, 'mines', { nx: 0.45, ny: -0.3, n: 4 });
    L.line(d - 20, 0.5, 0.45, 0.6, 0.5, 3, 24);
  },
  // level7.js, NEON ORBITAL (played 5th since 11-08): a swarm
  l7(L, d) {
    // one chain of six, copying your path, then rippling red tail to head: one roll sends the whole volley back
    if (!put(L, 'swarm-unit', d, 0, 0, { n: 6, volleys: 1, aim: 'ship', side: 1, tel: 0.9 })) { L.add(d, 'shrike', { side: 1, ny: 0.4, shots: 3 }); L.add(d + 60, 'shrike', { side: -1, ny: 0.1, shots: 3 }); }
  },
  // level 8, GRAVEYARD OF GIANTS: searchlight sentries
  l8(L, d) {
    // two sweepers on the walls, as level 8 mounts them; get caught and a small wave comes (the rings keep to the dark)
    const wave = { shrikes: 1, shots: 2 }, sweep = (aim, arrive, dir) => ({ aim, swing: 30, wave: 480, arrive: aim + arrive, dir });
    if (!put(L, 'searchlight-sentry', d, -1.36, 0.2, { mode: 'sweep', sweep: sweep(0, 25, 1), wave })) L.add(d, 'pod', { nx: -0.5, ny: 0.6, drift: 1, bursts: 2, shots: 2 });
    if (!put(L, 'searchlight-sentry', d + 100, 0.3, 1.42, { mode: 'sweep', sweep: sweep(-90, -25, -1), wave })) L.add(d + 100, 'pod', { nx: 0.5, ny: 0.6, drift: -1, bursts: 2, shots: 2 });
    L.line(d - 30, 0.45, -0.55, 0.55, -0.6, 4, 26);
  },
  // level 9, THE MIRROR FIELD: crystal emitters
  l9(L, d) {
    if (!put(L, 'crystal-emitter', d, 0.45, 0.45, { vols: [{ at: 2.6, mode: 'truth' }] })) { L.add(d, 'pod', { nx: 0.45, ny: 0.45, bursts: 2, shots: 2 }); L.add(d + 30, 'crystal', { nx: -0.5, ny: -0.3, r: 1.8 }); }
    if (!put(L, 'crystal-emitter', d + 110, -0.45, 0.4, { vols: [{ at: 2.6, mode: 'mix' }] })) L.add(d + 110, 'pod', { nx: -0.45, ny: 0.4, bursts: 2, shots: 2 });
    L.line(d - 20, 0, -0.45, 0, -0.2, 4, 24);
  },
};
