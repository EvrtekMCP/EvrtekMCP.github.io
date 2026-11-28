// DRIFTLINE: the garage's arithmetic. What a car is (base tuning + its own numbers + fitted upgrade levels + damage),
// what it is worth on a course (the ability rating against the course's difficulty), what a run pays, what repairs
// cost, and the saved progress. Pure JS: the economy simulator (tools/economy.mjs) uses it too.
// No pay-to-win: credits come from play only, and nothing is ever sold.
import { TUNING } from './config.js?v=0.1.26';
import { CARS, carById } from './data/cars.js?v=0.1.26';
import { CATEGORIES, COSMETICS, SETUP, category, cosmetic } from './data/upgrades.js?v=0.1.26';
import { COURSES } from './courses/index.js?v=0.1.26';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const PARTS = ['engine', 'fl', 'fr', 'rl', 'rr', 'body'];
export const PART_NAMES = { engine: 'Engine', fl: 'Front left', fr: 'Front right', rl: 'Rear left', rr: 'Rear right', body: 'Bodywork' };
const PART_PRICE = { engine: 'engine', fl: 'front', fr: 'front', rl: 'rear', rr: 'rear', body: 'body' };
// how much each category counts toward the ability rating
const WEIGHT = { engine: 3, induction: 2, nos: 1.5, tires: 2, diff: 1.5, angle: 1.5, suspension: 1.2, weight: 1.2, brakes: 0.8, transmission: 0.8, exhaust: 0.5 };

function newCarState(car) {
  const levels = {}; for (const c of CATEGORIES) levels[c.id] = 0;
  const owned = {}, pick = {}; for (const c of COSMETICS) { owned[c.id] = [c.options[0].id]; pick[c.id] = c.options[0].id; }
  const setup = {}; for (const k of SETUP) setup[k.id] = 0;
  return { levels, owned, pick, setup, damage: { engine: 0, fl: 0, fr: 0, rl: 0, rr: 0, body: 0 } };
}
export function newProgress() {
  return { v: SAVE_VERSION, credits: TUNING.economy.startCredits, xp: 0, car: CARS[0].id, garage: [CARS[0].id], cars: { [CARS[0].id]: newCarState(CARS[0]) }, best: {}, firsts: {}, runs: 0, earned: 0 };
}
export const carState = (p, id = p.car) => (p.cars[id] ||= newCarState(carById(id)));

// ---- levels and progression (Evrtek 11-27 (4); the numbers are config.js TUNING.progression)
// Levels 1-100 from XP; XP never goes down and is never bought. Courses open by stars (skill is the fast lane); cars and
// every part tier open by level. A course already finished stays open, and a car or part already owned stays usable.
const PR = () => TUNING.progression;
export const MAX_LEVEL = 100;
// the XP from level L to L + 1: the curve's anchors, and a geometric curve between them
function stepOf(C, ks, L) {
  if (L <= ks[0]) return C[ks[0]];
  if (L >= ks[ks.length - 1]) return C[ks[ks.length - 1]];
  let i = 0; while (ks[i + 1] < L) i++;
  const a = ks[i], b = ks[i + 1];
  return Math.round(C[a] * Math.pow(C[b] / C[a], (L - a) / (b - a)) / 10) * 10;
}
// the XP it takes to reach each level (AT[L]), worked out again only when the curve's numbers change (the tuning panel)
let sig = '', AT = null;
function table() {
  const C = PR().curve, s = JSON.stringify(C); if (s === sig) return AT;
  const ks = Object.keys(C).map(Number).sort((a, b) => a - b); AT = [0, 0];
  for (let L = 1; L < MAX_LEVEL; L++) AT[L + 1] = AT[L] + stepOf(C, ks, L);
  sig = s; return AT;
}
export const xpToNext = (L) => { const T = table(); return L >= MAX_LEVEL ? 0 : T[L + 1] - T[L]; };
export const xpAtLevel = (L) => table()[Math.max(1, Math.min(MAX_LEVEL, L))];
// where a total of XP puts you: the level, the XP into it, the XP it takes, the share of the bar
export function levelInfo(xp) {
  const T = table(); xp = Math.max(0, xp || 0);
  if (xp >= T[MAX_LEVEL]) return { level: MAX_LEVEL, into: 0, need: 0, frac: 1, at: T[MAX_LEVEL], max: true };
  let lo = 1, hi = MAX_LEVEL; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= xp) lo = m; else hi = m; }
  const need = T[lo + 1] - T[lo];
  return { level: lo, into: xp - T[lo], need, frac: (xp - T[lo]) / need, at: T[lo] };
}
export const levelOf = (p) => levelInfo(p.xp).level;
export const starsOf = (p) => Object.values(p.best || {}).reduce((a, b) => a + ((b && b.stars) || 0), 0);
const openAll = () => !!PR().unlockAll;
// what a course needs: its region's stars, or its own (the boss's); null when it is open
export function starsFor(course) { const P = PR(); return Math.max(P.regionStars[course.region] || 0, (P.courseStars || {})[course.id] || 0); }
export function courseLock(p, course, stars = starsOf(p)) {
  if (openAll() || (p.best && p.best[course.id])) return null;
  const need = starsFor(course);
  return stars >= need ? null : { stars: need, have: stars };
}
export const carLevel = (id) => PR().cars[id] || 0;
export const partLevel = (catId, tier) => ((PR().parts[catId] || {})[tier]) || 0;
export const carLocked = (p, id, L = levelOf(p)) => !openAll() && !ownsCar(p, id) && L < carLevel(id);
export const partLocked = (p, catId, tier, L = levelOf(p)) => !openAll() && L < partLevel(catId, tier);
// the course's suggested level range, and where a level sits against it: in it, normal XP; under it, a bonus; over it, little
export function range(course) { const r = PR().range[course.id]; return r ? { lo: r.lo, hi: r.hi } : { lo: 1, hi: MAX_LEVEL }; }
export function fit(L, course) {
  const P = PR(), r = range(course);
  if (L < r.lo) return { kind: 'under', mult: 1 + P.underMax * clamp((r.lo - L) / P.underSpan, 0, 1), by: r.lo - L };
  if (L > r.hi) return { kind: 'over', mult: Math.max(P.overFloor, 1 - (1 - P.overFloor) * (L - r.hi) / P.overSpan), by: L - r.hi };
  return { kind: 'in', mult: 1, by: 0 };
}
export const courseXp = (course) => PR().xpBase * (1 + course.difficulty * PR().xpPerDiff) * ((PR().xpCourse || {})[course.id] || 1);
// The XP a finished run (or a duel) earns, as the steps the results screen counts through: the base, then each
// modifier in turn (how it went, the range), then the first-time XP. duel: { won, firstWin } for a duel.
export function runXp(p, result, course, duel = null) {
  const P = PR(), base = courseXp(course), L = levelOf(p), first = (p.firsts && p.firsts[course.id]) || { clear: false, stars: 0, top: false };
  const steps = []; let x = base;
  const mul = (k, m, extra) => { if (Math.abs(m - 1) < 0.005) return; x *= m; steps.push(Object.assign({ k, mult: m, total: Math.round(x) }, extra)); };
  const add = (k, v, extra) => { if (v <= 0) return; x += v; steps.push(Object.assign({ k, add: Math.round(v), total: Math.round(x) }, extra)); };
  if (duel) mul(duel.won ? 'duelwon' : 'duellost', duel.won ? P.duelWin : P.duelLoss);
  else if (result.top) mul('deg', P.xpDegenerate);
  else mul('stars', P.xpStars[result.stars] ?? 1, { stars: result.stars });
  const f = fit(L, course); mul(f.kind, f.mult, { by: f.by });
  if (duel) { if (duel.won && duel.firstWin) add('firstwin', P.firstDuelWin * base); }
  else {
    if (!first.clear) add('first', P.firstClear * base);
    if (result.stars > first.stars) add('newstar', (result.stars - first.stars) * P.firstStar * base, { n: result.stars - first.stars });
    if (result.top && !first.top) add('firstdeg', P.firstDegenerate * base);
  }
  const total = Math.round(x);
  return { base: Math.round(base), steps, total, fit: f, apply() { p.xp = (p.xp || 0) + total; } };
}
// what opened between two moments (level, stars): regions and the boss by stars, cars and part tiers by level. Cars first,
// then courses, then the parts the car being driven can take, then the rest.
export function openedBetween(p, L0, S0, L1, S1) {
  if (openAll()) return [];
  const out = [], seen = new Set();
  for (const c of COURSES) { const need = starsFor(c); if (need > S0 && need <= S1 && !(p.best && p.best[c.id])) { const key = need === (PR().regionStars[c.region] || 0) ? 'region:' + c.region : 'course:' + c.id; if (seen.has(key)) continue; seen.add(key); out.push(key.startsWith('region') ? { kind: 'region', id: c.region, stars: need } : { kind: 'course', id: c.id, name: c.name, stars: need }); } }
  for (const car of CARS) { const n = carLevel(car.id); if (n > L0 && n <= L1) out.unshift({ kind: 'car', id: car.id, name: car.name, level: n }); }
  const mine = [], rest = [];
  for (const cat of CATEGORIES) cat.levels.forEach((lv, i) => { const n = partLevel(cat.id, i + 1); if (n > L0 && n <= L1) (i < maxLevel(p.car, cat.id) ? mine : rest).push({ kind: 'part', id: cat.id, tier: i + 1, name: cat.id === 'induction' ? carById(p.car).induction.name : lv.name, art: cat.art, level: n }); });
  return out.concat(mine, rest);
}
// the next thing a level opens (for a level-up that opened nothing yet, and the badges)
export function nextUnlock(p, L = levelOf(p)) {
  let best = null;
  for (const car of CARS) { const n = carLevel(car.id); if (n > L && (!best || n < best.level)) best = { kind: 'car', id: car.id, name: car.name, level: n }; }
  for (const cat of CATEGORIES) cat.levels.forEach((lv, i) => { const n = partLevel(cat.id, i + 1); if (n > L && i < maxLevel(p.car, cat.id) && (!best || n < best.level)) best = { kind: 'part', id: cat.id, tier: i + 1, name: cat.id === 'induction' ? carById(p.car).induction.name : lv.name, art: cat.art, level: n }; });
  return best;
}

// ---- cars: bought with credits, kept for good; switching is free
export function ownsCar(p, id) { return p.garage.includes(id); }
export function buyCar(p, id) {
  const c = carById(id); if (!c || c.id !== id || ownsCar(p, id) || p.credits < c.price || carLocked(p, id)) return false;
  p.credits -= c.price; p.garage.push(id); carState(p, id); p.car = id; return true;
}
// Evrtek 11-25: sell any car but the one being driven, never the last; it returns a share of the car's price and a
// smaller share of what its parts and looks cost (economy.resaleCar / resaleParts). Bought again later, it starts stock.
export function partsSpent(p, id) {
  const st = p.cars[id]; if (!st) return 0; let s = 0;
  for (const cat of CATEGORIES) for (let L = 1; L <= (st.levels[cat.id] || 0); L++) s += levelPrice(id, cat.id, L);
  for (const cos of COSMETICS) for (const o of st.owned[cos.id] || []) if (o !== cos.options[0].id) s += cosmeticPrice(id, cos.id, o);
  return s;
}
export function saleValue(p, id) { const E = TUNING.economy, c = carById(id); return Math.round((c.price * E.resaleCar + partsSpent(p, id) * E.resaleParts) / 50) * 50; }
export function canSell(p, id) { return ownsCar(p, id) && p.car !== id && p.garage.length > 1; }
export function sellCar(p, id) {
  if (!canSell(p, id)) return false;
  p.credits += saleValue(p, id); p.garage = p.garage.filter((x) => x !== id); delete p.cars[id]; return true;
}
export function switchCar(p, id) { if (!ownsCar(p, id)) return false; p.car = id; carState(p, id); return true; }

// ---- upgrades
export function maxLevel(carId, catId) { return carById(carId).levels[catId] || 0; }
export function levelPrice(carId, catId, level) { // level is 1-based: the price of fitting that level
  const c = category(catId), L = c && c.levels[level - 1];
  return L ? Math.round(L.price * carById(carId).partScale / 50) * 50 : Infinity;
}
export function nextLevel(p, catId) { const st = carState(p), n = st.levels[catId] + 1; return n <= maxLevel(p.car, catId) ? n : 0; }
export function buyLevel(p, catId) {
  const n = nextLevel(p, catId); if (!n || partLocked(p, catId, n)) return false;
  const price = levelPrice(p.car, catId, n); if (p.credits < price) return false;
  p.credits -= price; carState(p).levels[catId] = n; return true;
}
export function cosmeticPrice(carId, cosId, optId) { const o = cosmetic(cosId).options.find((x) => x.id === optId); return o ? Math.round(o.price * carById(carId).partScale / 50) * 50 : Infinity; }
export function buyCosmetic(p, cosId, optId) {
  const st = carState(p);
  if (st.owned[cosId].includes(optId)) { st.pick[cosId] = optId; return true; }
  const price = cosmeticPrice(p.car, cosId, optId); if (p.credits < price) return false;
  p.credits -= price; st.owned[cosId].push(optId); st.pick[cosId] = optId; return true;
}
// what the car looks like: its cosmetics, and the upgrades that show (calipers, ride height, carbon bonnet, pipes)
export function looks(p) {
  const st = carState(p), car = carById(p.car), val = (id) => { const o = cosmetic(id).options.find((x) => x.id === st.pick[id]); return o ? o.value : null; };
  return { paint: val('paint') || car.paint, rim: val('rims'), smoke: val('smoke'), glow: val('glow'), decal: val('decal'),
    brakes: st.levels.brakes, ride: st.levels.suspension, carbon: st.levels.weight >= 3, exhaust: st.levels.exhaust };
}
export function soundHints(p) {
  const st = carState(p), car = carById(p.car), out = { preset: car.sound };
  for (const c of CATEGORIES) for (let k = 0; k < st.levels[c.id]; k++) Object.assign(out, c.levels[k].sound || {});
  if (st.levels.induction > 0) { if (car.induction.kind === 'super') { out.super = 1; delete out.turbo; } else out.turbo = 1; }
  if (st.levels.weight >= 2) out.strip = 1;
  return out;
}

// The car the next run drives: base tuning, then the car's own numbers, then fitted levels, then damage. The debug
// panel edits the base (TUNING); this is rebuilt from it at every start and after every hit.
export function deriveTune(p) {
  const T = JSON.parse(JSON.stringify(TUNING)), D = TUNING.damage, car = carById(p.car), st = carState(p);
  for (const [grp, vals] of Object.entries(car.tune || {})) Object.assign(T[grp], vals);
  const fx = { power: 0, top: 0, mass: 0, muFront: 0, muRear: 0, slideRear: 0, brake: 0, handbrakeGrip: 0, lockDeg: 0, counterMaxDeg: 0, cgHeight: 0, transferScale: 0, driftHold: 0, holdThrottleDeg: 0, peakSlipRatio: 0, shiftCut: 0, nosSeconds: 0, boost: 0 };
  for (const c of CATEGORIES) for (let k = 0; k < Math.min(st.levels[c.id], maxLevel(p.car, c.id)); k++) for (const [key, v] of Object.entries(c.levels[k].fx)) fx[key] += v;
  const d = st.damage;
  T.car.powerKW *= (1 + fx.power + fx.boost) * (1 - D.engPower * clamp(d.engine, 0, 1));
  T.car.maxDrive *= 1 + (fx.power + fx.boost) * 0.5;
  T.car.topSpeedKmh = (T.car.topSpeedKmh + fx.top) * (1 - D.engTop * clamp(d.engine, 0, 1));
  T.car.mass += fx.mass;
  T.car.brakeForce *= 1 + fx.brake;
  T.car.handbrakeGrip += fx.handbrakeGrip;
  T.car.cgHeight += fx.cgHeight; T.car.transferScale += fx.transferScale;
  T.tires.muFront = (T.tires.muFront + fx.muFront) * (1 - D.frontGrip * clamp((d.fl + d.fr) / 2, 0, 1));
  T.tires.muRear = (T.tires.muRear + fx.muRear) * (1 - D.rearGrip * clamp((d.rl + d.rr) / 2, 0, 1));
  T.tires.slideRear += fx.slideRear; T.tires.peakSlipRatio += fx.peakSlipRatio;
  T.steer.lockDeg += fx.lockDeg; T.steer.counterMaxDeg += fx.counterMaxDeg;
  T.steer.pullDeg = (clamp(d.fl, 0, 1) - clamp(d.fr, 0, 1)) * D.steerPullDeg; // + pulls left (toward the worse corner)
  T.assist.driftHold += fx.driftHold; T.assist.holdThrottleDeg += fx.holdThrottleDeg;
  T.gearbox.shiftCut = Math.max(0.04, T.gearbox.shiftCut + fx.shiftCut);
  const kind = car.induction ? car.induction.kind : 'turbo';
  T.car.turbo = !!T.car.turbo || (fx.boost > 0 && kind === 'turbo'); // a turbo spools; a supercharger is there at once
  T.car.super = fx.boost > 0 && kind === 'super';
  // the setup sheet (adjustable coilovers): each slider -1..1
  if (st.levels.suspension >= 2 && st.setup) {
    const u = st.setup, c = (v) => clamp(v || 0, -1, 1);
    T.tires.muRear -= 0.035 * c(u.balance); T.tires.muFront += 0.015 * c(u.balance);
    T.assist.driftHold *= 1 + 0.35 * c(u.assist); T.steer.counterAssist = clamp(T.steer.counterAssist + 0.08 * c(u.assist), 0, 1);
    T.steer.lockDeg += 4 * c(u.lock); T.steer.counterMaxDeg += 3 * c(u.lock);
    T.car.brakeFront = clamp(T.car.brakeFront + 0.06 * c(u.bias), 0.45, 0.75);
    T.car.finalDrive *= 1 + 0.12 * c(u.gearing); T.car.maxDrive *= 1 + 0.08 * c(u.gearing); T.car.topSpeedKmh *= 1 - 0.06 * c(u.gearing);
  }
  T.car.nos = fx.nosSeconds > 0; T.nos.seconds = fx.nosSeconds || T.nos.seconds;
  return T;
}

// Ability rating, 0-100: the car's own range (data/cars.js rating [stock, full]), how much of its upgrade tree is
// fitted (weighted), then its condition.
export function rating(p, carId = p.car, worn = true) {
  const car = carById(carId), st = carState(p, carId);
  let got = 0, all = 0;
  for (const [id, w] of Object.entries(WEIGHT)) { const m = car.levels[id] || 0; if (!m) continue; all += w; got += w * Math.min(st.levels[id], m) / m; }
  const frac = all ? got / all : 0;
  return Math.round((car.rating[0] + (car.rating[1] - car.rating[0]) * frac) * (worn ? 1 - 0.25 * (1 - condition(p, carId) / 100) : 1));
}
export function verdict(carRating, difficulty) {
  const d = carRating - difficulty;
  return d >= 0 ? { word: 'Recommended', cls: 'ok' } : d >= -12 ? { word: 'Tough', cls: 'warn' } : { word: 'Very tough', cls: 'bad' };
}
export function condition(p, carId = p.car) {
  const d = carState(p, carId).damage, w = d.engine * 0.3 + (d.fl + d.fr) * 0.15 + (d.rl + d.rr) * 0.12 + d.body * 0.16;
  return Math.round(100 * (1 - clamp(w, 0, 1)));
}

// ---- what a finished run pays: the entry, points, stars, the top tier, and first-time bonuses; all times the
// course's pay factor (harder courses pay more)
// the early-play boost (Evrtek 11-25): low at the easiest course, high at the hardest, on a cosine S-curve between
export function payBoost(difficulty) {
  const B = TUNING.economy.payBoost; if (!B) return 1;
  const t = clamp((difficulty - B.from) / (B.to - B.from), 0, 1), s = (1 - Math.cos(Math.PI * t)) / 2;
  return 1 + B.low + (B.high - B.low) * s;
}
// (11-27 (2)'s payCut, the outclassed and bored-crowd cuts, went with the levels, 11-27 (4): the range moves XP instead)
export function payout(p, result, course) {
  const E = TUNING.economy, f = (1 + course.difficulty * E.payPerDifficulty) * payBoost(course.difficulty), lines = [];
  const first = (p.firsts[course.id] ||= { clear: false, stars: 0, top: false });
  lines.push(['Entry', E.entryPay * f]);
  lines.push(['Points', result.score * E.perPoint * f]);
  if (result.stars > 0) lines.push([result.stars === 1 ? '1 star' : result.stars + ' stars', E.starPay[result.stars] * f]);
  if (result.top) lines.push([TUNING.scoring.topTierName, E.degeneratePay * f]);
  if (!first.clear) lines.push(['First clear', E.firstClearPay * f]);
  if (result.stars > first.stars) lines.push(['New stars', (result.stars - first.stars) * E.firstStarPay * f]);
  if (result.top && !first.top) lines.push(['First ' + TUNING.scoring.topTierName, E.firstDegeneratePay * f]);
  for (const l of lines) l[1] = Math.round(l[1]);
  return { lines, total: lines.reduce((a, l) => a + l[1], 0), apply() { first.clear = true; first.stars = Math.max(first.stars, result.stars); first.top = first.top || result.top; } };
}

// ---- damage: a wall hit, sorted by where it landed. rel: the wall's direction from the car, relative to its nose
// (radians, + to the left); speed: m/s into the wall. Returns the part hit.
export function hit(p, rel, speed) {
  const D = TUNING.damage, d = carState(p).damage;
  const a = Math.abs(Math.atan2(Math.sin(rel), Math.cos(rel))), left = Math.sin(rel) > 0;
  const part = a < D.headOnDeg * Math.PI / 180 ? 'engine' : a < Math.PI * 0.42 ? (left ? 'fl' : 'fr') : a < Math.PI * 0.62 ? 'body' : (left ? 'rl' : 'rr');
  const amt = Math.max(0, speed - D.minHit) * D.perHit;
  d.body = clamp(d.body + Math.min(speed, 10) * 0.006, 0, 1); // every knock scuffs the paint
  d[part] = clamp(d[part] + amt, 0, 1);
  return { part, amt };
}
export function repairCost(p) {
  const E = TUNING.economy, d = carState(p).damage, sc = carById(p.car).partScale;
  let c = 0; for (const k of PARTS) c += d[k] * E.repair[PART_PRICE[k]] * sc;
  return Math.round(Math.min(c, E.repairCap * sc));
}
export function patchCost(p) { return Math.round(repairCost(p) * TUNING.economy.patchShare); }
export function repair(p, patch = false) {
  const cost = patch ? patchCost(p) : repairCost(p), d = carState(p).damage;
  if (cost <= 0 || p.credits < cost) return false;
  p.credits -= cost;
  for (const k of PARTS) d[k] = patch ? d[k] * (1 - TUNING.economy.patchFix) : 0;
  return true;
}

// ---- saved progress (this browser only)
// ---- saved progress (this browser only): versioned, migrated forward, never wiped by an update
// The save carries its own version (SAVE_VERSION). Loading reads the newest key there is (older keys too), runs every
// migration from its version up to now, keeps any field it does not know (a newer build's data survives an older one),
// and keeps a copy of the save as it was found under BACKUP before the first write of a migrated one. A save that
// cannot be read is kept in BACKUP too, never thrown away. Each future change of shape adds one step to MIGRATE.
export const SAVE_VERSION = 4;
// v3 -> v4 (11-27 (4), the levels): the XP an old save's play would have earned. Every course finished: its first clear,
// its stars and its first DEGENERATE as first-time XP; every other run as a replay of a course it finished (the average of
// their base XP at their best stars, in range); every duel course won once (the duel record) its first-win XP. Its cars
// and parts stay owned and usable whatever its level; every course it finished stays open.
export function oldXp(s, duelsWon = []) {
  const P = PR(), done = COURSES.filter((c) => (s.firsts && s.firsts[c.id] && s.firsts[c.id].clear) || (s.best && s.best[c.id]));
  let xp = 0, rep = 0;
  for (const c of done) {
    const f = (s.firsts && s.firsts[c.id]) || {}, b = (s.best && s.best[c.id]) || {}, st = Math.max(f.stars || 0, b.stars || 0), top = !!(f.top || b.top), base = courseXp(c);
    xp += base * (P.firstClear + st * P.firstStar + (top ? P.firstDegenerate : 0));
    rep += base * (top ? P.xpDegenerate : P.xpStars[st] ?? 1);
  }
  if (done.length) xp += Math.max(0, (s.runs || 0) - done.length) * rep / done.length;
  for (const id of duelsWon) { const c = COURSES.find((x) => x.id === id); if (c) xp += P.firstDuelWin * courseXp(c); }
  return Math.round(xp);
}
const duelsWonSaved = () => { try { const r = JSON.parse(localStorage.getItem('driftline.duels.v1') || '{}'); return Object.keys(r).filter((k) => r[k] && r[k].won > 0); } catch (e) { return []; } };
const KEY = 'driftline.progress';            // from v3 on, one key; the version lives inside
const OLD_KEYS = ['driftline.progress.v2', 'driftline.progress.v1'];
const BACKUP = 'driftline.progress.backup';
const MIGRATE = {
  // v1 (0.1.0's first shape, never shipped live): one car's levels and damage at the top level
  1: (s) => { const n = newProgress(); const st = n.cars.kestrel; Object.assign(st.levels, s.levels || {}); if (s.damage) Object.assign(st.damage, s.damage); return Object.assign(n, { credits: s.credits ?? n.credits, best: s.best || {}, firsts: s.firsts || {}, runs: s.runs || 0, earned: s.earned || 0, v: 2 }); },
  // v2 -> v3: the key loses its version suffix; every car gets the fields added since (setup sheet, decals, glow)
  2: (s) => Object.assign(s, { v: 3 }),
  // v3 -> v4: XP for what it has done (oldXp above); the 11-27 (2) list of recent courses (the bored crowd) goes
  3: (s) => { s.xp = oldXp(s, duelsWonSaved()); delete s.recent; s.v = 4; return s; },
};
function readSaved() {
  const ls = (() => { try { return localStorage; } catch (e) { return null; } })(); if (!ls) return null;
  for (const k of [KEY, ...OLD_KEYS]) { const raw = ls.getItem(k); if (raw == null) continue; try { return { key: k, raw, s: JSON.parse(raw) }; } catch (e) { try { ls.setItem(BACKUP, raw); } catch (e2) { /* full */ } return null; } }
  return null;
}
// bring any saved shape up to now, filling every car's state from a fresh one (fields added later get their defaults)
export function migrate(s) {
  if (!s || typeof s !== 'object') return null;
  let v = s.v || 1;
  while (v < SAVE_VERSION) { if (!MIGRATE[v]) return null; s = MIGRATE[v](s); v = s.v; }
  const n = newProgress(), out = Object.assign(n, s, { v: SAVE_VERSION });
  out.cars = out.cars || {};
  out.garage = (out.garage || ['kestrel']).filter((id, i, arr) => carById(id).id === id && arr.indexOf(id) === i);
  if (!out.garage.length) out.garage = ['kestrel'];
  for (const id of out.garage) {
    const fresh = newCarState(carById(id)), st = out.cars[id] || fresh;
    out.cars[id] = Object.assign({}, st, { levels: Object.assign(fresh.levels, st.levels), owned: Object.assign(fresh.owned, st.owned), pick: Object.assign(fresh.pick, st.pick), setup: Object.assign(fresh.setup, st.setup), damage: Object.assign(fresh.damage, st.damage) });
  }
  if (!out.garage.includes(out.car)) out.car = out.garage[0];
  if (!isFinite(out.credits) || out.credits < 0) out.credits = 0;
  if (!isFinite(out.xp) || out.xp < 0) out.xp = 0;
  return out;
}
export function loadProgress() {
  const found = readSaved(); if (!found) return newProgress();
  const out = migrate(JSON.parse(JSON.stringify(found.s)));
  if (!out) { try { localStorage.setItem(BACKUP, found.raw); } catch (e) { /* full */ } return newProgress(); }
  if (found.key !== KEY || (found.s && found.s.v) !== SAVE_VERSION) {
    try { localStorage.setItem(BACKUP, found.raw); localStorage.setItem(KEY, JSON.stringify(out)); for (const k of OLD_KEYS) localStorage.removeItem(k); } catch (e) { /* not saved; play on */ }
  }
  return out;
}
export function saveProgress(p) { try { p.v = SAVE_VERSION; localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* not saved; play on */ } }
export function resetProgress() { try { const raw = localStorage.getItem(KEY); if (raw) localStorage.setItem(BACKUP, raw); localStorage.removeItem(KEY); for (const k of OLD_KEYS) localStorage.removeItem(k); } catch (e) { /* nothing */ } return newProgress(); }
