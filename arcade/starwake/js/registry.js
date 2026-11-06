// STARWAKE 0.2.0: the registries. Everything a level can put on the course is a KIND (a pickup, an obstacle, an
// enemy, a piece of decor), everything it can put around the course is SCENERY, and a boss is a BOSS. Each is
// defined once in its own file with one of the define* calls below and listed by the level that uses it, so a
// new level adds files and never edits the engine. See LEVEL-API.md.
//
// A name can be defined only once in the whole game. Two files defining the same name is a build error, thrown
// the moment the second one loads, so parallel builders find a collision on their first run, not at the merge.

const KINDS = new Map(), SCENERY = new Map(), BOSSES = new Map();
const ROLES = ['pickup', 'obstacle', 'enemy', 'decor', 'weakpoint'];

function put(table, what, d) {
  if (!d || typeof d.name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(d.name)) throw new Error(what + ': a name in kebab-case is required, got ' + (d && d.name));
  const have = table.get(d.name);
  if (have && have !== d) throw new Error(what + ' "' + d.name + '" is defined twice. Names are global: pick another.');
  table.set(d.name, d);
  return d;
}
function kind(role, d) {
  if (!ROLES.includes(role)) throw new Error('unknown role ' + role);
  return put(KINDS, role, Object.assign({ role, motion: 'stream', spawnAt: 'line' }, d));
}

// ---- course kinds
//  role 'pickup'    flown through for points (rings, gates, boost rings)
//  role 'obstacle'  hurts on contact, cannot be shot (rocks, girders, mines, boulders)
//  role 'enemy'     fires, and can be killed by its own (or anyone's) reflected shot
//  role 'decor'     scenery that streams down the track; never collides
export const definePickup = (d) => kind('pickup', d);
export const defineObstacle = (d) => kind('obstacle', d);
export const defineEnemy = (d) => kind('enemy', d);
export const defineDecor = (d) => kind('decor', d);
export const defineWeakPoint = (d) => kind('weakpoint', d); // the boss framework makes these; levels rarely need it

// ---- scenery (ambient, around the flight box): streams of decor and set pieces faded by weight
export const defineScenery = (d) => {
  if (!d.stream && !d.update) throw new Error('scenery "' + d.name + '" needs a stream, an update, or both');
  return put(SCENERY, 'scenery', d);
};
// ---- bosses (see boss.js for the framework that runs them)
export const defineBoss = (d) => {
  if (!d.title || !d.build || !Array.isArray(d.phases) || !d.phases.length) throw new Error('boss "' + d.name + '" needs a title, build() and phases');
  return put(BOSSES, 'boss', d);
};

export const getKind = (name) => KINDS.get(name);
export const getScenery = (name) => SCENERY.get(name);
export const getBoss = (name) => BOSSES.get(name);
export const allKinds = () => [...KINDS.values()];

// ---- levels
// defineLevel checks the shape now, so a missing field fails on load instead of mid-run. The engine builds
// the event list (levels.js) when the level is played.
const LEVEL_KEYS = ['n', 'id', 'name', 'idea', 'length', 'sections', 'looks', 'kinds', 'build', 'speed', 'ranks', 'beats', 'acts', 'music'];
export function defineLevel(L) {
  for (const k of LEVEL_KEYS) if (L[k] === undefined) throw new Error('level ' + (L.n || L.id || '?') + ': missing "' + k + '"');
  if (typeof L.speed !== 'function') throw new Error('level ' + L.n + ': speed must be a function of distance');
  for (const s of L.sections) {
    if (!L.looks[s.look || s.id]) throw new Error('level ' + L.n + ': section ' + s.id + ' has no look');
    if (!(s.d1 > s.d0)) throw new Error('level ' + L.n + ': section ' + s.id + ' needs d0 < d1');
  }
  for (const k of L.kinds) if (!k || !k.name) throw new Error('level ' + L.n + ': kinds holds something that is not a kind');
  for (const a of ['introduce', 'develop', 'twist', 'master']) if (!L.acts[a]) throw new Error('level ' + L.n + ': acts.' + a + ' is missing (rule 19)');
  return Object.assign({ scenery: [], boss: null, seed: L.n * 7919, sfx: [] }, L);
}
