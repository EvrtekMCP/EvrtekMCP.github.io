// STARWAKE 0.2.0: the ten levels: the catalogue, loading a level module, laying out its course, and the
// player's progress (unlocks, stars, best score and rank per level). All progress is in localStorage on the
// device; dev runs never write any of it.
import { V, rng, store } from './util.js?v=0.2.0';
import { getKind } from './registry.js?v=0.2.0';
import { layout } from './layout.js?v=0.2.0';
import { SPAWN_D, LEGACY_LINE } from './space.js?v=0.2.0';

// The PLAY ORDER (n is the number a player sees). `file` is the module, js/levels/level<file>.js, when it differs;
// `art` is Yori's name lettering (art/ui/name-<art>.png) when it differs. Evrtek, 11-05: "let's swap level one and
// two" (Shattered Moon is the gentler opener; Nebula Run's lightgates are the step up). Each level's module carries
// its own `n` = its place here, so progress, unlocks, CONTINUE and the dev menu all follow this order.
export const CATALOGUE = [
  { n: 1, name: 'SHATTERED MOON', file: 2, art: '02' },
  { n: 2, name: 'NEBULA RUN', file: 1, art: '01' },
  { n: 3, name: 'THE GATEFIELD', boss: 'THE WARDEN' },
  { n: 4, name: 'SOLAR SKIM' },
  { n: 5, name: 'ION STORM' },
  { n: 6, name: 'FROZEN RIFT', boss: 'THE LEVIATHAN' },
  { n: 7, name: 'NEON ORBITAL' },
  { n: 8, name: 'GRAVEYARD OF GIANTS' },
  { n: 9, name: 'THE MIRROR FIELD', boss: 'THE TWINS' },
  { n: 10, name: 'THE LATTICE HEART', boss: 'THE LATTICE HEART' },
];
export const RANK_ORDER = ['C', 'B', 'A', 'S', 'DEGENERATE'];

// ---- stars (Evrtek 11-05): three per level, best ever kept. One table, to tune after playtest.
//   1: clear the level.  2: clear at rank A or better.  3: clear at rank S or better AND (every ring OR no hits).
// DEGENERATE stays a rank above the stars: the brag tier.
export const STARS = {
  two: { rank: 'A' },
  three: { rank: 'S', anyOf: ['allRings', 'noHits'] },
};
const rankAtLeast = (r, want) => RANK_ORDER.indexOf(r) >= RANK_ORDER.indexOf(want);
export function starsFor(run) {
  const c = run.cleared, all = run.rings >= run.ringTotal, nohit = run.hits === 0;
  const have = [c, c && rankAtLeast(run.rank, STARS.two.rank),
    c && rankAtLeast(run.rank, STARS.three.rank) && STARS.three.anyOf.some((k) => (k === 'allRings' ? all : nohit))];
  const stars = have[2] ? 3 : have[1] ? 2 : have[0] ? 1 : 0;
  let next = '';
  if (!have[0]) next = 'CLEAR THE LEVEL FOR ★';
  else if (!have[1]) next = 'RANK ' + STARS.two.rank + ' FOR ★★';
  else if (!have[2]) next = (rankAtLeast(run.rank, STARS.three.rank) ? '' : 'RANK ' + STARS.three.rank + ' AND ') + 'EVERY RING OR NO HITS FOR ★★★';
  return { stars, have, next };
}

// ---- loading
const cache = {};
export async function loadLevel(n) {
  if (cache[n]) return cache[n];
  const c = CATALOGUE.find((q) => q.n === n), file = (c && c.file) || n;
  const mod = await import('./levels/level' + file + '.js' + V);
  cache[n] = prepareLevel(mod.default);
  return cache[n];
}
export const loaded = (n) => cache[n] || null;

// Lay a level's course out from its seed: the section banners first (0.1.0 did, and the order of ties matters
// for the same course), then the level's own build(R, L), then the boss or the finish line.
export function prepareLevel(L) {
  const R = rng(L.seed), lay = layout();
  for (const s of L.sections) if (s.banner !== false) lay.add(s.d0 + (s.d0 === 0 ? 40 : 10), 'banner', { section: s.id });
  L.build(R, lay, L);
  if (L.boss) lay.add(L.boss.at, 'boss', {});
  else if (!lay.events.some((e) => e.type === 'end')) lay.add(L.length, 'end', {});
  const events = lay.events.sort((a, b) => a.d - b.d);
  // Where 0.1.0's spawn queue would have spawned each event. Its queue spawned in order and a banner, a
  // strafer or the finish (0 m lead) held up everything behind it, which then appeared at once, in plain view:
  // the pop-in Evrtek saw. 0.2.0 spawns everything at the line; level 1's pods still start drifting where they
  // were born before (legacyAt: metres ahead of the ship), so it plays as it did.
  let q = -1e9;
  for (const e of events) { const nowish = isNow(e.type); q = Math.max(q, e.d - (nowish ? 0 : LEGACY_LINE)); e.legacyAt = L.legacy ? Math.max(0, e.d - q) : LEGACY_LINE; }
  // a fly-in kind with a lead (seconds) is born that much earlier, so its approach is seen and its main act (a strafe)
  // still starts where its event is; the now-queue runs in birth order
  for (const e of events) { const k = getKind(e.type); if (k && k.spawnAt === 'now' && k.lead) e.at = e.d - k.lead * L.speed(e.d); }
  const line = events.filter((e) => !isNow(e.type)), now = events.filter((e) => isNow(e.type)).sort((a, b) => (a.at ?? a.d) - (b.at ?? b.d));
  const ringTotals = {}; let ringTotal = 0;
  const sectionAt = (d) => { for (const s of L.sections) if (d < s.d1) return s; return L.sections[L.sections.length - 1]; };
  for (const e of events) { const k = getKind(e.type); if (k && k.countsAsRing && !e.decor) { ringTotal++; const s = sectionAt(e.d).id; ringTotals[s] = (ringTotals[s] || 0) + 1; } }
  return Object.assign(L, { events, line, now, ringTotal, ringTotals, sectionAt, spawnD: SPAWN_D });
}
const MARKERS = new Set(['banner', 'end', 'boss', 'music', 'call']);
export function isNow(type) { if (MARKERS.has(type)) return true; const k = getKind(type); return !!(k && k.spawnAt === 'now'); }
export const isMarker = (type) => MARKERS.has(type);

// ---- progress. Key per level: 0.1.0's 'starwake.best.level1' ({score, rank}) is read as it was and extended.
const key = (n) => 'starwake.best.level' + n;
// the swap (11-05): records were kept by slot; move levels 1 and 2's so each follows its level, once per device
(function migrateOrder() {
  try {
    if (localStorage.getItem('starwake.order') === '2') return;
    const a = localStorage.getItem(key(1)), b = localStorage.getItem(key(2));
    if (b !== null) localStorage.setItem(key(1), b); else localStorage.removeItem(key(1));
    if (a !== null) localStorage.setItem(key(2), a); else localStorage.removeItem(key(2));
    localStorage.setItem('starwake.order', '2');
  } catch (e) { /* storage blocked: nothing to move */ }
})();
export const Progress = {
  get(n) { return Object.assign({ score: 0, rank: '', stars: 0, cleared: false }, store(key(n)) || {}); },
  cleared(n) { return this.get(n).cleared; },
  // clearing N puts N on the select for replay and opens N+1; anything past that stays locked
  // a cleared level always stays replayable, even if the one before it is not cleared (the swap moved records)
  unlocked(n) { return n === 1 || this.cleared(n) || this.cleared(n - 1); },
  furthest() { let f = 1; for (const c of CATALOGUE) if (this.unlocked(c.n)) f = c.n; return f; },
  any() { return CATALOGUE.some((c) => { const r = this.get(c.n); return r.cleared || r.score > 0; }); },
  totalStars() { return CATALOGUE.reduce((s, c) => s + this.get(c.n).stars, 0); },
  totalScore() { return CATALOGUE.reduce((s, c) => s + this.get(c.n).score, 0); },
  // a finished run: keep the best of everything; returns what changed
  save(n, run, stars) {
    const b = this.get(n), isNew = run.total > b.score;
    const rank = !b.rank || rankAtLeast(run.rank, b.rank) ? run.rank : b.rank;
    const rec = { score: Math.max(b.score, run.total), rank: isNew || !b.rank ? (isNew ? run.rank : rank) : rank, stars: Math.max(b.stars, stars), cleared: b.cleared || run.cleared };
    store(key(n), rec);
    return { isNew, before: b, after: rec, newStars: rec.stars > b.stars };
  },
  wipe() { for (const c of CATALOGUE) { try { localStorage.removeItem(key(c.n)); } catch (e) { /* storage blocked */ } } },
};
