// THE CURRENT (galaxy 2, Tideway's headline: "Space-currents carry the ship, so ride them."). A river of glowing
// plankton through the lane. Inside it the ship drifts with the flow (api.push): the path bends without your hands.
// It moves ONLY the ship, never shots, so the deflect stays honest (the plan, 3.1). Its warning is itself: the motes
// stream from the read line on, and the kelp on the banks (the level's scenery, which asks flowAt) leans with them.
//
// Two shapes:
//   a CROSS current: add(d, 'g2-current', { len, fx, fy, band?: [ny0, ny1], flip?: { at, slack, ramp } })
//     flows across the lane for `len` metres of course. fx, fy are in HALF-BOXES a second (0.5 = half the box's
//     half-width each second), so a current carries the ship the same share of the box on a phone as on a wide
//     screen, and the rings laid on its path line up on both. `band` keeps it to a slice of the box's height.
//     `flip`: THE TURN OF THE TIDE. The flow slows to slack water `slack` metres before `at`, holds still through it,
//     and runs the other way by `ramp` metres after: the kelp ahead shows it long before the ship gets there.
//   a lengthwise RIBBON: add(d, 'g2-current', { len, ride: true, path: [[u, nx, ny], ...], w, say? })
//     a tube of current along the lane (radius w, in the box's own units) following `path` (u = metres into it).
//     Riding inside it: x1.15 speed (api.game.flow), RIDE points, a little GREED, and a gentle pull back in near its edge,
//     so it carries you along its line. say: a call-out the first time you slip into it (the Tide Race names itself).
// The level lays its rings on the carried path with simulateDrift() (below), the same sums the engine runs.
import { THREE, defineObstacle, GlowPoints, clamp, smoothstep } from '../../api.js?v=0.4.0';

const LIVE = new Set();
const RIDE = { mul: 1.15, pts: 60, greed: 2.5, pull: 0.55 };   // the ride's speed, points and GREED a second, pull to the middle
const MOTE = [0.62, 1, 0.76];                                    // green-white plankton (Yori: hue 140-165, never cyan)

// the flow multiplier at u metres into a current: eased in and out at its ends, and the tide's turn
export function profile(ev, u) {
  const len = ev.len || 300, E = Math.min(ev.ease ?? 45, len / 3);
  if (u < 0 || u > len) return 0;
  let k = smoothstep(0, E, u) * smoothstep(len, len - E, u);
  const f = ev.flip;
  if (f) {
    const slack = f.slack ?? 60, ramp = f.ramp ?? 120;
    k *= u < f.at ? 1 - smoothstep(f.at - slack - ramp, f.at - slack, u) : -smoothstep(f.at + slack, f.at + slack + ramp, u);
  }
  return k;
}
const pathAt = (path, u) => {
  if (!path || !path.length) return [0, 0];
  if (u <= path[0][0]) return [path[0][1], path[0][2]];
  for (let i = 1; i < path.length; i++) if (u <= path[i][0]) { const a = path[i - 1], b = path[i], t = (u - a[0]) / (b[0] - a[0] || 1), s = t * t * (3 - 2 * t); return [a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s]; }
  const z = path[path.length - 1]; return [z[1], z[2]];
};
export { pathAt };
const inBand = (ev, ny) => !ev.band || (ny >= ev.band[0] && ny <= ev.band[1]);

// What the water is doing at a point (ship-relative z; x, y in metres, optional): fx, fy in half-boxes a second, and
// ride (0..1) if the point is inside a ribbon. Scenery asks it to lean the kelp; drifters ask it to ride.
export function flowAt(api, z, x, y) {
  const o = { fx: 0, fy: 0, ride: 0 };
  for (const e of LIVE) {
    if (!e.alive) continue;
    const ev = e.ev, u = e.z - z;
    if (u < 0 || u > (ev.len || 300)) continue;
    const k = profile(ev, u);
    if (ev.ride) { if (x !== undefined) { const [cx, cy] = pathAt(ev.path, u), w = ev.w || 0.35; if (Math.hypot((x / api.box.x - cx) / w, (y / api.box.y - cy) / w) < 1) o.ride = Math.max(o.ride, k); } continue; }
    if (y !== undefined && !inBand(ev, y / api.box.y)) continue;
    o.fx += (ev.fx || 0) * k; o.fy += (ev.fy || 0) * k;
  }
  return o;
}

// The carried path, at layout time: where a ship whose stick is held still sits (normalised box units) at each course
// distance, from the same sums main.js runs (the push adds to a drift that never passes 0.75 of the box and eases back
// at 1.2 a second once nothing pushes; the ship follows its target on a stiff spring). evs: the current events (d plus
// their fields); speed(d): the level's base speed. Returns (d) -> [nx, ny] for a stick held at `start`.
export function simulateDrift(evs, speed, d0, d1, start = [0, 0]) {
  const step = 1 / 120, out = [];
  let d = d0, dx = 0, dy = 0, sx = start[0], sy = start[1], vx = 0, vy = 0;
  const K = 60, C = 2 * Math.sqrt(K);
  while (d <= d1 + 1) {
    out.push([d, sx, sy]);
    let px = 0, py = 0;
    for (const ev of evs) {
      if (ev.ride) continue;
      const u = d - ev.d; if (u < 0 || u > (ev.len || 300)) continue;
      if (!inBand(ev, sy)) continue;
      const k = profile(ev, u); px += (ev.fx || 0) * k; py += (ev.fy || 0) * k;
    }
    const pushing = Math.abs(px) + Math.abs(py) > 0.01;
    dx = clamp(dx + px * step, -0.75, 0.75); dy = clamp(dy + py * step, -0.75, 0.75);
    if (!pushing) { const k = Math.exp(-1.2 * step); dx *= k; dy *= k; }
    const tx = clamp(start[0] + dx, -1, 1), ty = clamp(start[1] + dy, -1, 1);
    vx += ((tx - sx) * K - vx * C) * step; vy += ((ty - sy) * K - vy * C) * step;
    sx += vx * step; sy += vy * step;
    d += speed(d) * step;
  }
  return (q) => {
    if (q <= out[0][0]) return [out[0][1], out[0][2]];
    let lo = 0, hi = out.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (out[m][0] < q) lo = m; else hi = m; }
    const a = out[lo], b = out[hi], t = (q - a[0]) / (b[0] - a[0] || 1);
    return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  };
}

let layer = null;
export default defineObstacle({
  name: 'g2-current',
  hazard: null,                       // it never hurts; it is the level's idea (the plan, 3.1)
  sample: { len: 120, fx: 0.4 },
  noWarm: false,
  init(api) { layer = new GlowPoints(api.scene, 6000, api.glowTex); },
  begin() { layer.begin(); },
  end() { layer.end(); },
  spawn(e, ev, api) {
    const len = ev.len || 300, R = mulberry((ev.seed ?? Math.round(ev.d || 7)) >>> 0);
    e.len = len; e.inside = false; e.rideT = 0; e.rideAcc = 0; e.turnSaid = false; e.riding = false;
    // the motes: across the whole lane and well past its edges (a river, not a lane marker), or down the ribbon
    const n = ev.ride ? Math.round(clamp(len / 2.2, 60, 420)) : Math.round(clamp(len / 2.6, 40, 260));
    e.m = new Float32Array(n * 4);                                  // x (box units), y (box units), u (metres), phase
    for (let i = 0; i < n; i++) {
      if (ev.ride) { const a = R() * Math.PI * 2, r = Math.sqrt(R()) * (ev.w || 0.35) * 1.15; e.m[i * 4] = Math.cos(a) * r; e.m[i * 4 + 1] = Math.sin(a) * r; }
      else { e.m[i * 4] = -2.1 + R() * 4.2; e.m[i * 4 + 1] = ev.band ? ev.band[0] - 0.08 + R() * (ev.band[1] - ev.band[0] + 0.16) : -1.5 + R() * 3.0; }
      e.m[i * 4 + 2] = R() * len; e.m[i * 4 + 3] = R() * 6.28;
    }
    if (!ev.warm) LIVE.add(e);
  },
  update(e, dt, api) {
    const ev = e.ev, B = api.box, ship = api.ship, len = e.len;
    // ---- the ship, while the current is round it (u = metres into the current at the ship's plane)
    const u = e.z;
    if (u >= 0 && u <= len && !ev.warm) {
      const k = profile(ev, u);
      if (ev.ride) {
        const [cx, cy] = pathAt(ev.path, u), w = ev.w || 0.35;
        const ox = ship.x / B.x - cx, oy = ship.y / B.y - cy, r = Math.hypot(ox / w, oy / w);
        // a gentle pull back in near its edge (none in its core, so the engine's drift eases off there and the pull never
        // builds up): it keeps you in the stream and carries you along its path
        if (r > 0.65 && r < 1.6 && k > 0.05) { const f = Math.min(1, (r - 0.65) / 0.35) * RIDE.pull * k; api.push(-ox / r * f * B.x * w * 2, -oy / r * f * B.y * w * 2); }
        const riding = r < 1 && k > 0.2;
        if (riding) {
          api.game.flow(1 + (RIDE.mul - 1) * k);
          if (!e.riding) { api.game.sfx('g2-current-in', { vol: 0.8 }); if (ev.say && !e.rideSaid) { e.rideSaid = true; api.game.call(ev.say, 'c-cyan'); } }
          e.rideAcc += dt; e.rideT += dt;
          if (e.rideAcc >= 0.5) { e.rideAcc -= 0.5; api.game.score(RIDE.pts * 0.5 * api.game.mult, ship.x, ship.y + 1.2, 0, 'cyan', 'RIDE'); api.game.greed(RIDE.greed * 0.5); }
        }
        e.riding = riding;
      } else if (inBand(ev, ship.y / B.y)) {
        if (Math.abs(k) > 0.02) api.push((ev.fx || 0) * k * B.x, (ev.fy || 0) * k * B.y);
        if (!e.inside && Math.abs(k) > 0.15) { e.inside = true; api.game.sfx('g2-current-in', { vol: 0.7, pan: Math.sign(ev.fx || 0) * 0.4 }); }
      }
      // the tide turns: a sound 1.5 s before slack water, the call once
      if (ev.flip && !e.turnSaid && u > ev.flip.at - (ev.flip.slack ?? 60) - 1.5 * api.v) { e.turnSaid = true; api.game.sfx('g2-tide-turn'); api.game.call('THE TIDE TURNS', 'c-cyan'); }
    }
    // ---- the motes: each drifts with the water where it is; drawn only where the course has grown in (no pop-in)
    const m = e.m, n = m.length / 4;
    const vis = ev.ride ? api.v * (RIDE.mul - 1) * 1.6 : 0;          // a ribbon's water runs the way you fly
    for (let i = 0; i < n; i++) {
      let mu = m[i * 4 + 2];
      const zz = e.z - mu; if (zz < -800 || zz > 30) continue;
      const a = api.appear(zz); if (a <= 0.001) continue;
      const k = profile(ev, mu);
      let x, y, sx = 0, sy = 0, sz = 0;
      if (ev.ride) {
        mu += vis * dt; if (mu > len) mu -= len; m[i * 4 + 2] = mu;
        const [cx, cy] = pathAt(ev.path, mu);
        x = (cx + m[i * 4]) * B.x; y = (cy + m[i * 4 + 1]) * B.y; sz = -0.9;
      } else {
        let mx = m[i * 4] + (ev.fx || 0) * k * dt * 1.6, my = m[i * 4 + 1] + (ev.fy || 0) * k * dt * 1.6;
        if (mx > 2.1) mx -= 4.2; else if (mx < -2.1) mx += 4.2;
        if (!ev.band) { if (my > 1.5) my -= 3; else if (my < -1.5) my += 3; }
        m[i * 4] = mx; m[i * 4 + 1] = my;
        x = mx * B.x; y = my * B.y + Math.sin(m[i * 4 + 3] + e.t * 0.9) * 0.25;
        const s = Math.hypot(ev.fx || 0, ev.fy || 0) || 1; sx = (ev.fx || 0) * k / s * 0.9; sy = (ev.fy || 0) * k / s * 0.9;
      }
      const edge = smoothstep(0, 30, mu) * smoothstep(len, len - 30, mu);
      const al = a * edge * (0.28 + 0.5 * Math.abs(k)) * (0.75 + 0.25 * Math.sin(m[i * 4 + 3] * 3 + e.t * 2));
      const sz0 = 0.55 * a;
      // a streak: a bright head and two fading points behind it along the flow (Yori's currentRibbon: streaks)
      layer.push(x, y, zz, sz0, MOTE[0], MOTE[1], MOTE[2], al);
      layer.push(x - sx * 0.8, y - sy * 0.8, zz - sz * 0.8, sz0 * 0.8, MOTE[0], MOTE[1], MOTE[2], al * 0.55);
      layer.push(x - sx * 1.6, y - sy * 1.6, zz - sz * 1.6, sz0 * 0.6, MOTE[0], MOTE[1], MOTE[2], al * 0.28);
    }
    if (e.z > len + 30) e.alive = false;
  },
  remove(e) { LIVE.delete(e); },
});
// a small seeded random for the motes (the same river every run)
function mulberry(a) { return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export { THREE };
