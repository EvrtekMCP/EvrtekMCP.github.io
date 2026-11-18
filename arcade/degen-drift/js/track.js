// DRIFTLINE: the course as numbers. A closed centripetal Catmull-Rom spline through the course's control points,
// resampled every metre: centre, height, heading, half width, curvature. Pure JS (no three.js), so the car, the
// scoring and the Node simulator all use the same road. Conventions: x/z ground, y up; heading psi with forward
// (sin psi, cos psi); "left" is (cos psi, -sin psi); lateral offsets are positive to the left; curvature is positive
// in a left-hand bend.
// Runoff (courses 0.2.0): a control point may carry extra drivable width for the OUTSIDE of its bends. The painted
// lane keeps its width; the walls step out. Internally the centre line the car, the walls and the zones use (x, z,
// half) is the lane's centre pushed toward the outside by half the runoff, and laneOff / laneHalf say where the
// painted lane sits on it. With no runoff the two are the same line (EMBER BAY is unchanged to the centimetre).

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => t * t * (3 - 2 * t);
// 11-18: the drift line's distance in from the painted lane's outside edge (a course's zones.edgeGap overrides it).
// A car sliding at 34 degrees reaches about 2.0 m to either side of its middle, and the wall stands 0.55 m past the
// road's edge (car.js walls()), so a car in the middle of the sweet spot clears the wall by 3.25 + 0.55 - 2.0 = 1.8 m:
// about a car's width. At the sweet spot's outer edge it is 0.6-0.9 m: nerve, with room to hold it.
const EDGE_GAP = 3.25;
const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a), 0, 1));

function catmull(p0, p1, p2, p3, t, alpha = 0.5) {
  // centripetal Catmull-Rom (Barry-Goldman) on n-dimensional points
  const d = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-4, alpha);
  const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
  const u = t1 + (t2 - t1) * t, out = [];
  for (let k = 0; k < 4; k++) {
    const a1 = (t1 - u) / (t1 - t0) * p0[k] + (u - t0) / (t1 - t0) * p1[k];
    const a2 = (t2 - u) / (t2 - t1) * p1[k] + (u - t1) / (t2 - t1) * p2[k];
    const a3 = (t3 - u) / (t3 - t2) * p2[k] + (u - t2) / (t3 - t2) * p3[k];
    const b1 = (t2 - u) / (t2 - t0) * a1 + (u - t0) / (t2 - t0) * a2;
    const b2 = (t3 - u) / (t3 - t1) * a2 + (u - t1) / (t3 - t1) * a3;
    out.push((t2 - u) / (t2 - t1) * b1 + (u - t1) / (t2 - t1) * b2);
  }
  return out;
}

export class Track {
  constructor(course) {
    this.course = course;
    // [x, z, y, halfWidth, kindIndex, runoff?]
    const P = course.points;
    const N = P.length, SUB = 40;
    // dense polyline
    const dense = [];
    for (let i = 0; i < N; i++) {
      const p0 = P[(i - 1 + N) % N], p1 = P[i], p2 = P[(i + 1) % N], p3 = P[(i + 2) % N];
      for (let s = 0; s < SUB; s++) { const q = catmull(p0, p1, p2, p3, s / SUB); q[4] = s < SUB / 2 ? p1[4] : p2[4]; q[5] = (p1[5] || 0) + ((p2[5] || 0) - (p1[5] || 0)) * (s / SUB); dense.push(q); }
    }
    const cum = [0];
    for (let i = 1; i <= dense.length; i++) { const a = dense[i - 1], b = dense[i % dense.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    const total = cum[dense.length];
    const step = 1.0, n = Math.floor(total / step);
    this.step = total / n; this.n = n; this.length = total;
    const x = new Float32Array(n), z = new Float32Array(n), y = new Float32Array(n), half = new Float32Array(n), kind = new Uint8Array(n), run = new Float32Array(n);
    let j = 0;
    const start = (course.startOffset || 0);
    for (let i = 0; i < n; i++) {
      let s = ((i * this.step + start) % total + total) % total;
      if (s < cum[j]) j = 0;
      while (cum[j + 1] < s) j++;
      const a = dense[j], b = dense[(j + 1) % dense.length], f = (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
      x[i] = a[0] + (b[0] - a[0]) * f; z[i] = a[1] + (b[1] - a[1]) * f; y[i] = a[2] + (b[2] - a[2]) * f;
      half[i] = a[3] + (b[3] - a[3]) * f; kind[i] = f < 0.5 ? a[4] : b[4]; run[i] = a[5] + (b[5] - a[5]) * f;
    }
    // smooth height and width so no kink shows (circular box blur, twice)
    const blur = (arr, r) => { for (let pass = 0; pass < 2; pass++) { const c = Float32Array.from(arr); for (let i = 0; i < n; i++) { let s = 0; for (let k = -r; k <= r; k++) s += c[(i + k + n) % n]; arr[i] = s / (2 * r + 1); } } };
    blur(y, 14); blur(half, 10);
    this.x = x; this.z = z; this.y = y; this.half = half; this.kind = kind;
    const tx = new Float32Array(n), tz = new Float32Array(n), psi = new Float32Array(n), curv = new Float32Array(n), grade = new Float32Array(n);
    const frame = () => {
      for (let i = 0; i < n; i++) {
        const a = (i - 1 + n) % n, b = (i + 1) % n;
        let dx = x[b] - x[a], dz = z[b] - z[a]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        tx[i] = dx; tz[i] = dz; psi[i] = Math.atan2(dx, dz); grade[i] = (y[b] - y[a]) / l;
      }
      for (let i = 0; i < n; i++) {
        const a = (i - 1 + n) % n, b = (i + 1) % n;
        let d = psi[b] - psi[a]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        // heading increasing = turning left (forward (sin, cos)), so curvature > 0 is a left-hander
        curv[i] = d / (2 * this.step);
      }
    };
    frame();
    // runoff: push the centre toward the outside of each bend by half the runoff there, and widen by the same
    this.laneOff = new Float32Array(n); this.laneHalf = Float32Array.from(half);
    let anyRun = false; for (let i = 0; i < n; i++) if (run[i] > 0.05) { anyRun = true; break; }
    if (anyRun) {
      const cs0 = Float32Array.from(curv); blur(cs0, 9);
      const shift = new Float32Array(n);
      for (let i = 0; i < n; i++) shift[i] = -Math.sign(cs0[i]) * run[i] * sstep(1 / 420, 1 / 160, Math.abs(cs0[i])) / 2;
      blur(shift, 12);
      for (let i = 0; i < n; i++) {
        const lx = tz[i], lz = -tx[i];
        x[i] += lx * shift[i]; z[i] += lz * shift[i];
        half[i] = this.laneHalf[i] + Math.abs(shift[i]); this.laneOff[i] = -shift[i];
      }
      frame();
    }
    this.run = run;
    // a smoothed curvature, for finding corners
    const cs = Float32Array.from(curv); blur(cs, 9);
    this.tx = tx; this.tz = tz; this.psi = psi; this.curv = curv; this.curvSmooth = cs; this.grade = grade;
    this._q = { i: 0, s: 0, lat: 0, f: 0, d2: 0 };
    this.zones = this.findZones(course.zones || {});
  }

  wrapI(i) { const n = this.n; return ((i % n) + n) % n; }
  wrapS(s) { const L = this.length; return ((s % L) + L) % L; }
  // signed forward distance from s0 to s1 along the loop, in (-L/2, L/2]
  ds(s0, s1) { let d = s1 - s0; const L = this.length; if (d > L / 2) d -= L; if (d <= -L / 2) d += L; return d; }

  // Nearest point on the centre line. hint: a sample index near the answer (searched +-win), or -1 for all of it.
  closest(px, pz, hint = -1, win = 40) {
    const { x, z, n } = this;
    let best = 0, bd = Infinity;
    if (hint < 0) { for (let i = 0; i < n; i += 4) { const d = (x[i] - px) ** 2 + (z[i] - pz) ** 2; if (d < bd) { bd = d; best = i; } } hint = best; win = 6; bd = Infinity; }
    for (let k = -win; k <= win; k++) { const i = this.wrapI(hint + k); const d = (x[i] - px) ** 2 + (z[i] - pz) ** 2; if (d < bd) { bd = d; best = i; } }
    // project onto the segment either side
    const q = this._q;
    let i0 = best, i1 = this.wrapI(best + 1);
    let ex = x[i1] - x[i0], ez = z[i1] - z[i0];
    let f = ((px - x[i0]) * ex + (pz - z[i0]) * ez) / (ex * ex + ez * ez);
    if (f < 0) { i1 = i0; i0 = this.wrapI(best - 1); ex = x[i1] - x[i0]; ez = z[i1] - z[i0]; f = ((px - x[i0]) * ex + (pz - z[i0]) * ez) / (ex * ex + ez * ez); }
    f = clamp(f, 0, 1);
    const cx = x[i0] + ex * f, cz = z[i0] + ez * f;
    const l = Math.hypot(ex, ez) || 1, lx = ez / l, lz = -ex / l; // left normal
    q.i = i0; q.f = f; q.s = (i0 + f) * this.step;
    q.lat = (px - cx) * lx + (pz - cz) * lz;
    q.d2 = (px - cx) ** 2 + (pz - cz) ** 2;
    return q;
  }
  // interpolated values at a sample index + fraction
  heightAt(i, f) { const j = this.wrapI(i + 1); return this.y[i] + (this.y[j] - this.y[i]) * f; }
  halfAt(i, f) { const j = this.wrapI(i + 1); return this.half[i] + (this.half[j] - this.half[i]) * f; }
  // a point on the road: s along, lat to the left. Returns [x, y, z]
  point(s, lat = 0, out = [0, 0, 0]) {
    s = this.wrapS(s); const fi = s / this.step, i = Math.floor(fi) % this.n, f = fi - Math.floor(fi), j = this.wrapI(i + 1);
    const cx = this.x[i] + (this.x[j] - this.x[i]) * f, cz = this.z[i] + (this.z[j] - this.z[i]) * f;
    const tx = this.tx[i] + (this.tx[j] - this.tx[i]) * f, tz = this.tz[i] + (this.tz[j] - this.tz[i]) * f, l = Math.hypot(tx, tz) || 1;
    out[0] = cx + (tz / l) * lat; out[2] = cz - (tx / l) * lat; out[1] = this.heightAt(i, f);
    return out;
  }
  headingAt(s) { const i = Math.floor(this.wrapS(s) / this.step) % this.n; return this.psi[i]; }

  // Corners: runs of curvature past a threshold, split where the bend changes hands (so an S is two zones), padded
  // so the zone starts as the car turns in and ends past the exit. Each gets a drift line along the outside of the
  // bend (zoneLine) and two bands along it: the zone and, tighter, the sweet spot.
  findZones(opt) {
    const { n, step } = this, cs = this.curvSmooth;
    const kMin = opt.minCurv || 1 / 230, pad0 = opt.padIn || 10, pad1 = opt.padOut || 16, minLen = opt.minLen || 30;
    const runs = [];
    let cur = null;
    // start scanning from a straight bit so no run wraps through the scan's start
    let i0 = 0; for (let i = 0; i < n; i++) if (Math.abs(cs[i]) < kMin * 0.5) { i0 = i; break; }
    for (let k = 0; k <= n; k++) {
      const i = (i0 + k) % n, c = cs[i], sg = Math.sign(c), on = Math.abs(c) >= kMin && k < n;
      if (on && cur && cur.side === sg) { cur.e = k; if (Math.abs(c) > cur.peak) { cur.peak = Math.abs(c); cur.apex = k; } }
      else { if (cur) runs.push(cur); cur = on ? { b: k, e: k, side: sg, peak: Math.abs(c), apex: k } : null; }
    }
    // merge same-handed runs with a short gap
    const merged = [];
    for (const r of runs) { const p = merged[merged.length - 1]; if (p && p.side === r.side && r.b - p.e < (opt.mergeGap || 22)) { p.e = r.e; if (r.peak > p.peak) { p.peak = r.peak; p.apex = r.apex; } } else merged.push({ ...r }); }
    const zones = [];
    for (let z = 0; z < merged.length; z++) {
      const r = merged[z];
      let b = r.b * step - pad0, e = r.e * step + pad1;
      // never overlap the neighbours: an S hands over at the midpoint
      const prev = merged[z - 1], next = merged[z + 1];
      if (prev) b = Math.max(b, (prev.e * step + r.b * step) / 2 + 1);
      if (next) e = Math.min(e, (r.e * step + next.b * step) / 2 - 1);
      if (e - b < minLen || r.peak < (opt.minPeak || 1 / 150)) continue; // too short, or too gentle to slide
      const s0 = this.wrapS(b + i0 * step), s1 = this.wrapS(e + i0 * step);
      zones.push({ s0, s1, len: e - b, side: r.side, apexT: clamp((r.apex * step - b) / (e - b), 0.25, 0.75), peak: r.peak, hairpin: r.peak > 1 / 30 });
    }
    zones.sort((a, b) => a.s0 - b.s0);
    const zh = opt.zoneHalf || 3.0, sh = opt.sweetHalf || 1.15, eg = opt.edgeGap || EDGE_GAP;
    zones.forEach((zn, k) => { zn.id = k; zn.zoneHalf = zh * (zn.hairpin ? 1.15 : 1); zn.sweetHalf = sh * (zn.hairpin ? 1.15 : 1); zn.edgeGap = eg; });
    return zones;
  }
  // where along a zone s sits: 0..1, or -1 if outside it
  zoneT(zn, s) { const d = this.ds(zn.s0, s); if (d < 0 || d > zn.len) return -1; return d / zn.len; }
  // The drift line's lateral offset at zone fraction t (from the centre line): the middle of the zone band and of its
  // sweet spot. 11-18 (Evrtek, after test v12: "The drift lines should be more on the outside of a turn, so that
  // you're incentivized to drift a little closer to the wall"): it rides the OUTSIDE of the bend, edgeGap in from the
  // painted lane's outside edge, from the turn-in to the exit, as the outer clipping zones of competition drifting run
  // along the wall. Until 11-18 it was the grip racing line (outside, apex, outside): it swung to the inside for the
  // middle of every bend, the part a slide spends longest in. It keeps to the painted lane (a runoff apron is room to
  // save a slide, never the line); the band never crosses the road's edge, and the line never passes the lane's middle
  // toward the inside. `half` is what callers pass (the road's half width there); the lane is read here.
  zoneLine(zn, t, half) {
    const i = Math.floor(this.wrapS(zn.s0 + t * zn.len) / this.step) % this.n;
    const lh = Math.min(half, this.laneHalf[i]), off = this.laneOff[i];
    // how far outside the lane's middle the line sits; the band's outer edge stays on the road
    const wide = Math.min(lh - zn.edgeGap, half + zn.side * off - zn.zoneHalf);
    return off - zn.side * Math.max(0, wide);
  }
  // which zone (if any) s is in, starting the search at a hint id
  zoneAt(s) { for (const zn of this.zones) { const t = this.zoneT(zn, s); if (t >= 0) return zn; } return null; }
}
