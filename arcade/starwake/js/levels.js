// STARWAKE 0.2.0: the ten levels: the catalogue, loading a level module, laying out its course, and the
// player's progress (unlocks, stars, best score and rank per level). All progress is in localStorage on the
// device; dev runs never write any of it.
import { V, rng, store } from './util.js?v=0.3.0';
import { getKind } from './registry.js?v=0.3.0';
import { layout } from './layout.js?v=0.3.0';
import { SPAWN_D, LEGACY_LINE } from './space.js?v=0.3.0';

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
// '' is a clear with no letter (one star) or a run that did not finish
export const RANK_ORDER = ['', 'C', 'B', 'A', 'S', 'DEGENERATE'];

// ---- the difficulty curve (0.3.0, the human pass; Evrtek 11-06: "Game is too hard in the early levels"). Per level,
// in play order; a level with no entry plays at full strength, so levels 7-10 keep their character (6 has softer hits).
//   dmg   every hit to the shield is scaled by this
//   heal  the shield a ring gives back is scaled by this
//   shot  enemy shots take this much longer to reach you: more warning, more time to roll (level 3 keeps 1: its gate
//         turrets land their shots on the beat)
//   ring  how far from a ring's middle still counts as through it (a boost ring's too), scaled
// Why (tools/test/human.js, the human bot, on 0.2.0): a newcomer finished Nebula Run on 2% shield, six of its thirteen
// hits on the lightgates' frames; and on levels 1 and 2 no skill caught 80% of the rings, where levels 3-8 gave 88-97%.
export const EASE = {
  1: { dmg: 0.55, heal: 1.5, shot: 1.3, ring: 1.3 },
  2: { dmg: 0.6, heal: 1.5, shot: 1.25, ring: 1.3 },
  3: { dmg: 0.75, heal: 1.25, shot: 1, ring: 1.15 },
  4: { dmg: 0.85, heal: 1.1, shot: 1, ring: 1.05 },
  5: { dmg: 0.92, heal: 1, shot: 1, ring: 1 },
  // the one late step steeper than the rest: in the Leviathan's fight (it holds 52 m out, fans of five) the bot's decent
  // runs fell to 8% and 30% shield and a newcomer went down, below levels 9 and 10. Softer hits and 10% slower shots;
  // its patterns, its loop timing (so the fight is no longer), the rings and the speed are untouched.
  6: { dmg: 0.8, heal: 1, shot: 1.1, ring: 1 },
};
export const easeOf = (n) => Object.assign({ dmg: 1, heal: 1, shot: 1, ring: 1 }, EASE[n] || {});

// ---- stars and ranks (Evrtek 11-06, the human pass): FIVE stars a level, won by the share of the level's rings
// caught; the top ones also want some style. Score never buys a star or a rank (it is the brag number). The rank
// letters follow the stars, and DEGENERATE sits above all five: the brag rank, no sixth star.
//   ★ clear the level   ★★ 30% of the rings (C)   ★★★ 60% (B)   ★★★★ 80% + style (A)   ★★★★★ 90% + style (S)
//   DEGENERATE 95% + more style   (levels 9 and 10 ask less: RING_SHARES, below)
// Style = grazes and close calls (counted together) and roll deflects (shots sent back), each with a small minimum per
// level (STYLE), sized from the human bot so a decent player who is trying gets them on the way.
export const MAX_STARS = 5;
export const GATES = [
  { stars: 1, rank: '', rings: 0 },
  { stars: 2, rank: 'C', rings: 0.30 },
  { stars: 3, rank: 'B', rings: 0.60 },
  { stars: 4, rank: 'A', rings: 0.80, style: true },
  { stars: 5, rank: 'S', rings: 0.90, style: true },
  { stars: 5, rank: 'DEGENERATE', rings: 0.95, style: true },
];
// [grazes + close calls, deflects] wanted for A, S and DEGENERATE, per level in play order. Sized from the human bot's
// decent runs on 0.3.0 (tools/test/human.js; what it showed per level, close / deflects: 1: 16/10, 2: 24/19, 3: 17/33,
// 4: 1/8, 5: 18/4, 6: 65/76, 7: 14/8, 8: 7/7, 9: 26/26, 10: 19/47): A asks about a quarter of that, S about 40%,
// DEGENERATE about 60%. Level 4 asks no close calls: nothing on it scrapes, and its seekers' grazing bolts only graze if
// you do not roll them (the autopilot, rolling everything, made none), so there its style is the roll alone. The rings
// are the real gate.
export const STYLE = {
  1: { A: [3, 2], S: [5, 3], DEGENERATE: [8, 5] },
  2: { A: [4, 3], S: [6, 5], DEGENERATE: [10, 8] },
  3: { A: [3, 4], S: [5, 6], DEGENERATE: [8, 10] },
  4: { A: [0, 2], S: [0, 3], DEGENERATE: [0, 6] },
  5: { A: [3, 1], S: [5, 2], DEGENERATE: [8, 3] },
  6: { A: [8, 8], S: [14, 14], DEGENERATE: [24, 24] },
  7: { A: [2, 2], S: [4, 3], DEGENERATE: [6, 5] },
  8: { A: [1, 2], S: [2, 3], DEGENERATE: [4, 5] },
  9: { A: [4, 4], S: [6, 6], DEGENERATE: [10, 10] },
  10: { A: [3, 6], S: [5, 10], DEGENERATE: [8, 16] },
};
const styleOf = (n, rank) => (STYLE[n] || STYLE[1])[rank] || [0, 0];
// A LEVEL'S OWN RING SHARES (0.3.0, Evrtek 11-06: "Make them easier"), where the global ones ask for rings nobody can
// catch: on levels 9 and 10 even the autopilot takes only 86% (its runs: 324 of 376 and 310 of 358). Levels 1-8 use
// GATES. Style is not touched. Each entry: the share for C, B, A, S and DEGENERATE. DEGENERATE sits just under the
// autopilot (320 and 305 rings needed). The good human bot caught 77% of level 9 on three seeds out of three and 84% of
// level 10, so five stars ask 75% and 80%: a good run clears them by about the same few rings.
export const RING_SHARES = {
  9: { C: 0.25, B: 0.5, A: 0.65, S: 0.75, DEGENERATE: 0.85 },
  10: { C: 0.25, B: 0.5, A: 0.7, S: 0.8, DEGENERATE: 0.85 },
};
export const shareOf = (gate, n) => (RING_SHARES[n] && RING_SHARES[n][gate.rank] !== undefined ? RING_SHARES[n][gate.rank] : gate.rings);
export const rankAtLeast = (r, want) => RANK_ORDER.indexOf(r || '') >= RANK_ORDER.indexOf(want || '');
export const rankForStars = (s) => ['', '', 'C', 'B', 'A', 'S'][Math.max(0, Math.min(5, s))];
const starText = (n) => '★'.repeat(n);
const pctFloor = (f) => Math.floor(f * 100 + 1e-9);

// what a gate still wants from this run ([] when it is met), on level n (its own ring shares, if it has them). The
// ring share is a whole number of rings: 90% of 187 rings is 169 (168.3 rounded up).
export function missing(run, gate, n) {
  const out = [];
  if (!run.cleared) out.push({ what: 'clear' });
  const share = shareOf(gate, n), total = run.ringTotal || 0, need = Math.ceil(total * share - 1e-9);
  if (run.rings < need) out.push({ what: 'rings', pct: Math.round(share * 100), got: total ? pctFloor(run.rings / total) : 0, more: need - run.rings });
  if (gate.style) {
    const [close, defl] = styleOf(n, gate.rank), haveClose = (run.grazes || 0) + (run.scrapes || 0);
    if (haveClose < close) out.push({ what: 'close', more: close - haveClose });
    if ((run.deflects || 0) < defl) out.push({ what: 'deflects', more: defl - (run.deflects || 0) });
  }
  return out;
}
// what is missing, the way a person would say it
function sayMissing(m) {
  const parts = [];
  for (const x of m) {
    if (x.what === 'rings') parts.push('CATCH ' + x.pct + '% OF THE RINGS (YOU GOT ' + x.got + '%)');
    else if (x.what === 'close') parts.push(x.more + ' MORE ' + (x.more === 1 ? 'GRAZE OR CLOSE CALL' : 'GRAZES OR CLOSE CALLS'));
    else if (x.what === 'deflects') parts.push('ROLL ' + x.more + ' MORE ' + (x.more === 1 ? 'SHOT' : 'SHOTS') + ' BACK');
  }
  return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' AND ' + parts[parts.length - 1] : parts[0] || '';
}
// A finished run, cleared or not -> its stars (0..5), its rank letter, and the next thing to aim for in plain words.
// run: { cleared, rings, ringTotal, grazes, scrapes, deflects }; n = the level, in play order.
export function grade(run, n) {
  let top = null;
  for (const g of GATES) if (!missing(run, g, n).length) top = g;
  const stars = top ? top.stars : 0, rank = top ? top.rank : '';
  // the next gate up: the next star, or DEGENERATE once all five are won
  const next = GATES.find((g) => g.stars > stars) || (rank !== 'DEGENERATE' ? GATES[GATES.length - 1] : null);
  let hint;
  if (!run.cleared) hint = 'MAKE IT TO THE END FOR YOUR FIRST ★';
  else if (!next) hint = 'DEGENERATE. THAT IS THE TOP OF THE GAME.';
  else if (next.rank === 'DEGENERATE') hint = 'ALL FIVE STARS. FOR DEGENERATE: ' + sayMissing(missing(run, next, n));
  else hint = sayMissing(missing(run, next, n)) + ' FOR ' + starText(next.stars);
  return { stars, rank, have: Array.from({ length: MAX_STARS }, (_, i) => i < stars), next: hint, nextGate: next };
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
  // the human pass (0.3.0): how gentle this level is (EASE, by its place in the play order)
  return Object.assign(L, { events, line, now, ringTotal, ringTotals, sectionAt, spawnD: SPAWN_D, ease: easeOf(L.n) });
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
// five stars (Evrtek 11-06): a record from the three-star game is moved over once per device. Its ring share was
// never kept, so the stars cannot be re-derived; they are mapped up so nobody sees fewer than they earned
// (1 -> 1, 2 -> 3, 3 -> 4), and the rank letter follows the new star count, as it does from now on.
export const STAR_MAP = { 0: 0, 1: 1, 2: 3, 3: 4 };
(function migrateStars() {
  try {
    if (localStorage.getItem('starwake.stars') === '5') return;
    for (const c of CATALOGUE) {
      const r = store(key(c.n)); if (!r) continue;
      const stars = STAR_MAP[r.stars | 0] ?? Math.min(MAX_STARS, r.stars | 0);
      store(key(c.n), Object.assign(r, { stars, rank: rankForStars(stars) }));
    }
    localStorage.setItem('starwake.stars', '5');
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
  // a finished run: keep the best of everything (score, stars, rank, each on its own); returns what changed. Stars
  // and rank never go down.
  save(n, run, stars) {
    const b = this.get(n), isNew = run.total > b.score;
    const rec = { score: Math.max(b.score, run.total), rank: rankAtLeast(run.rank, b.rank) ? run.rank : b.rank, stars: Math.max(b.stars, stars), cleared: b.cleared || run.cleared };
    store(key(n), rec);
    return { isNew, before: b, after: rec, newStars: rec.stars > b.stars };
  },
  // one-time lessons (0.3.0: 'roll', the barrel-roll lesson on level 1), kept beside the records
  tip(name) { return !!(store('starwake.tips') || {})[name]; },
  setTip(name, on = true) { const t = store('starwake.tips') || {}; if (on) t[name] = 1; else delete t[name]; store('starwake.tips', t); },
  // NEW GAME's erase: every record, and the lessons come back too
  wipe() { for (const k of CATALOGUE.map((c) => key(c.n)).concat(['starwake.tips'])) { try { localStorage.removeItem(k); } catch (e) { /* storage blocked */ } } },
};
