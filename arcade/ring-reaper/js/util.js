// STARWAKE: small shared helpers.
export const VERSION = '0.6.4';
export const V = '?v=' + VERSION;

// Mulberry32 (Tommy Ettinger, public domain): the level is authored from a fixed seed, so every run flies the
// same course and best scores compare like with like.
export function rng(seed) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.sign = () => (f() < 0.5 ? -1 : 1);
  return f;
}
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
// frame-rate independent exponential approach
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
export const smooth = (t) => t * t * (3 - 2 * t);
// 0 at a, 1 at b, eased; a may be greater than b
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const isTouch = () => (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
export function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
export function store(key, val) {
  try {
    if (val === undefined) { const s = localStorage.getItem(key); return s == null ? null : JSON.parse(s); }
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) { /* private window or blocked storage: the game simply forgets */ }
  return null;
}
