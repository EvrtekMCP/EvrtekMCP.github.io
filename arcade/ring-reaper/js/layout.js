// STARWAKE 0.2.0: course-authoring helpers, used inside a level's build(R, L). Positions are in the NORMALISED
// flight box (nx, ny in -1..1; beyond 1 is outside it), so a course fits a wide screen and a narrow portrait one
// alike. d is distance down the track, in metres. These are 0.1.0's helpers, unchanged, so level 1 lays out the
// same course from the same seed.
import { clamp } from './util.js?v=0.6.3';

export function layout() {
  const events = [], rings = [];
  const add = (d, type, o = {}) => { const e = Object.assign({ d, type }, o); events.push(e); return e; };
  // one ring (clamped inside the box), and remember it so other things can keep clear of it
  const ring = (d, nx, ny, type = 'ring', o = {}) => { const r = { nx: clamp(nx, -0.95, 0.95), ny: clamp(ny, -0.9, 0.9) }; add(d, type, Object.assign(r, o)); rings.push({ d, ...r }); return d; };
  // n rings on a straight line from (x0,y0) to (x1,y1), step metres apart; returns the distance after it
  const line = (d, x0, y0, x1, y1, n = 5, step = 24, type = 'ring', o = {}) => { for (let i = 0; i < n; i++) { const t = n > 1 ? i / (n - 1) : 0; ring(d + i * step, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, type, typeof o === 'function' ? o(i, n) : o); } return d + n * step; };
  // n rings round an ellipse (a corkscrew down the track)
  const sine = (d, n, step, ax, ay, ph = 0, cx = 0, cy = 0, type = 'ring', o = {}) => { for (let i = 0; i < n; i++) { const a = ph + i / n * Math.PI * 2; ring(d + i * step, cx + Math.sin(a) * ax, cy + Math.cos(a) * ay, type, typeof o === 'function' ? o(i, n) : o); } return d + n * step; };
  // is (nx, ny) at distance d at least r (normalised) away from every ring within 34 m?
  const clearOfRings = (d, nx, ny, r) => !rings.some((g) => Math.abs(g.d - d) < 34 && Math.hypot(g.nx - nx, g.ny - ny) < r);
  return { events, rings, add, ring, line, sine, clearOfRings };
}

// (0.3.0: ranksFrom() is gone. Ranks are no longer a share of a score: levels.js GATES, the rings caught and the style.)
