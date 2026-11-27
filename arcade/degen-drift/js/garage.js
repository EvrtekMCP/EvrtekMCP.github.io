// DRIFTLINE: the garage's arithmetic. What a car is (base tuning + its own numbers + fitted upgrade levels + damage),
// what it is worth on a course (the ability rating against the course's difficulty), what a run pays, what repairs
// cost, and the saved progress. Pure JS: the economy simulator (tools/economy.mjs) uses it too.
// No pay-to-win: credits come from play only, and nothing is ever sold.
import { TUNING } from './config.js?v=0.1.25';
import { CARS, carById } from './data/cars.js?v=0.1.25';
import { CATEGORIES, COSMETICS, SETUP, category, cosmetic } from './data/upgrades.js?v=0.1.25';

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
  return { v: SAVE_VERSION, credits: TUNING.economy.startCredits, car: CARS[0].id, garage: [CARS[0].id], cars: { [CARS[0].id]: newCarState(CARS[0]) }, best: {}, firsts: {}, runs: 0, earned: 0 };
}
export const carState = (p, id = p.car) => (p.cars[id] ||= newCarState(carById(id)));

// ---- cars: bought with credits, kept for good; switching is free
export function ownsCar(p, id) { return p.garage.includes(id); }
export function buyCar(p, id) {
  const c = carById(id); if (!c || c.id !== id || ownsCar(p, id) || p.credits < c.price) return false;
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
  const n = nextLevel(p, catId); if (!n) return false;
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
export function rating(p, carId = p.car) {
  const car = carById(carId), st = carState(p, carId);
  let got = 0, all = 0;
  for (const [id, w] of Object.entries(WEIGHT)) { const m = car.levels[id] || 0; if (!m) continue; all += w; got += w * Math.min(st.levels[id], m) / m; }
  const frac = all ? got / all : 0;
  return Math.round((car.rating[0] + (car.rating[1] - car.rating[0]) * frac) * (1 - 0.25 * (1 - condition(p, carId) / 100)));
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
export const SAVE_VERSION = 3;
const KEY = 'driftline.progress';            // from v3 on, one key; the version lives inside
const OLD_KEYS = ['driftline.progress.v2', 'driftline.progress.v1'];
const BACKUP = 'driftline.progress.backup';
const MIGRATE = {
  // v1 (0.1.0's first shape, never shipped live): one car's levels and damage at the top level
  1: (s) => { const n = newProgress(); const st = n.cars.kestrel; Object.assign(st.levels, s.levels || {}); if (s.damage) Object.assign(st.damage, s.damage); return Object.assign(n, { credits: s.credits ?? n.credits, best: s.best || {}, firsts: s.firsts || {}, runs: s.runs || 0, earned: s.earned || 0, v: 2 }); },
  // v2 -> v3: the key loses its version suffix; every car gets the fields added since (setup sheet, decals, glow)
  2: (s) => Object.assign(s, { v: 3 }),
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
