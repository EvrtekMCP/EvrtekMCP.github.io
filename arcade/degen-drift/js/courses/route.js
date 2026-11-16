// DRIFTLINE: courses as a few lines of text. A route is a string of turtle moves that the builder walks into the
// control points the Track splines through. It closes the loop by itself: straights marked * stretch or shrink (the
// least they can) so the end meets the start, and one bend written with ? turns whatever the heading still needs.
// Pure JS: the game, the course tools and the Node simulator all build the same points.
//
//   S120     a straight, 120 m            S90*   a straight the loop may stretch to close
//   L40:90   a left bend, radius 40 m, 90 degrees        R25:180  a right hairpin
//   L60:?    a left bend turning whatever closes the heading
//   w6.5     half width from here (the lane, metres)     o4  runoff on the outside of the bends from here (metres)
//   g6       grade from here, percent (negative is down); the loop's height closes over the graded moves
//   k1       wall/scenery kind from here (per region: 0 default, 1 the alternate, 2 tunnel, 3 bridge)
const DEG = Math.PI / 180;

export function buildRoute(spec, opt = {}) {
  const toks = spec.trim().split(/\s+/);
  let half = opt.half ?? 6.5, run = opt.runoff ?? 0, grade = 0, kind = opt.kind ?? 0;
  const ops = [];
  for (const t of toks) {
    const c = t[0], v = t.slice(1);
    if (c === 'w') half = +v; else if (c === 'o') run = +v; else if (c === 'g') grade = +v / 100; else if (c === 'k') kind = +v;
    else if (c === 'S') ops.push({ t: 'S', len: parseFloat(v), flex: v.endsWith('*'), half, run, grade, kind });
    else if (c === 'L' || c === 'R') { const [r, a] = v.split(':'); ops.push({ t: 'A', r: +r, deg: a === '?' ? null : +a, dir: c === 'L' ? 1 : -1, half, run, grade, kind }); }
    else if (c === 'C') { const [r, lead] = v.split(':'); ops.push({ t: 'C', r: +r, lead: lead === undefined ? null : +lead, half, run, grade, kind }); }
    else throw new Error('route: unknown move ' + t);
  }
  // C<r>[:<lead>] (last): close the loop back onto the start with bends of radius r. With a lead and flex straights,
  // the flex straights first put the end of the route `lead` metres before one last bend into the start straight;
  // then the shortest bend-straight-bend (a Dubins path) that keeps the loop one turn round joins the two.
  const ci = ops.findIndex((o) => o.t === 'C');
  if (ci >= 0) {
    const cl = ops.splice(ci, 1)[0];
    const x0 = opt.x ?? 0, z0 = opt.z ?? 0, h0 = (opt.heading ?? 0) * DEG;
    const bodyEnd = () => { let x = x0, z = z0, psi = h0; for (const o of ops) { if (o.t === 'S') { o.psi = psi; x += Math.sin(psi) * o.len; z += Math.cos(psi) * o.len; } else { const a = o.dir * o.deg * DEG, ch = 2 * o.r * Math.sin(Math.abs(a) / 2), mid = psi + a / 2; x += Math.sin(mid) * ch; z += Math.cos(mid) * ch; psi += a; } } return [x, z, psi]; };
    let [x, z, psi] = bodyEnd();
    const fl = ops.filter((o) => o.t === 'S' && o.flex);
    if (cl.lead !== null && fl.length >= 2) {
      const rem = (psi - h0 > 0 ? 2 * Math.PI : -2 * Math.PI) - (psi - h0), d = Math.sign(rem) || 1;
      const N = (h) => [Math.cos(h), -Math.sin(h)], n0 = N(h0), ne = N(psi);
      const cx = x0 + d * cl.r * n0[0], cz = z0 + d * cl.r * n0[1];
      const tx = cx - d * cl.r * ne[0] - cl.lead * Math.sin(psi), tz = cz - d * cl.r * ne[1] - cl.lead * Math.cos(psi);
      const rx = x - tx, rz = z - tz;
      let a = 0, b = 0, c2 = 0; for (const o of fl) { const ux = Math.sin(o.psi), uz = Math.cos(o.psi); a += ux * ux; b += ux * uz; c2 += uz * uz; }
      const det = a * c2 - b * b; if (Math.abs(det) < 1e-6) throw new Error('route: the flex straights are parallel');
      const lx = (c2 * -rx - b * -rz) / det, lz = (a * -rz - b * -rx) / det;
      for (const o of fl) { o.len += Math.sin(o.psi) * lx + Math.cos(o.psi) * lz; if (o.len < 6) throw new Error('route: a flex straight would shrink to ' + o.len.toFixed(1) + ' m'); o.flex = false; }
      [x, z, psi] = bodyEnd();
    }
    const best = dubins([x, z, psi], [x0, z0, h0], cl.r, psi - h0);
    if (!best) throw new Error('route: no simple closing path (the loop would cross itself)');
    const base = { half: cl.half, run: cl.run, grade: cl.grade, kind: cl.kind };
    if (best.a1 > 0.002) ops.push({ t: 'A', r: cl.r, deg: best.a1 / DEG, dir: best.d1, ...base });
    if (best.L > 0.05) ops.push({ t: 'S', len: best.L, flex: false, ...base });
    if (best.a2 > 0.002) ops.push({ t: 'A', r: cl.r, deg: best.a2 / DEG, dir: best.d2, ...base });
  }
  // heading closure: the auto bend takes what the turns still need to make a whole loop
  const auto = ops.filter((o) => o.t === 'A' && o.deg === null);
  const turned = ops.reduce((a, o) => a + (o.t === 'A' && o.deg !== null ? o.dir * o.deg : 0), 0);
  if (auto.length > 1) throw new Error('route: one auto bend at most');
  if (auto.length) { const target = Math.abs(turned + 360) < Math.abs(turned - 360) ? -360 : 360; auto[0].deg = (target - turned) * auto[0].dir; if (auto[0].deg <= 0) throw new Error('route: the auto bend would turn backwards (' + auto[0].deg.toFixed(1) + ')'); }
  const total = ops.reduce((a, o) => a + (o.t === 'A' ? o.dir * o.deg : 0), 0);
  if (!opt.open && Math.abs(Math.abs(total) - 360) > 0.01) throw new Error('route: the turns add up to ' + total.toFixed(1) + ' degrees, not 360');
  // walk once to find where each flex straight points and how far the end misses the start
  const walk = (emit) => {
    let x = opt.x ?? 0, z = opt.z ?? 0, psi = (opt.heading ?? 0) * DEG, y = opt.y ?? 0;
    for (const o of ops) {
      if (o.t === 'S') {
        const segs = Math.max(1, Math.ceil(o.len / 14)), d = o.len / segs; o.psi = psi;
        for (let k = 0; k < segs; k++) { emit && emit(x, z, y, o); x += Math.sin(psi) * d; z += Math.cos(psi) * d; y += o.grade * d; }
      } else {
        const len = o.r * o.deg * DEG, segs = Math.max(2, Math.ceil(len / Math.min(10, o.r * 0.35))), d = len / segs, dpsi = o.dir * o.deg * DEG / segs;
        for (let k = 0; k < segs; k++) {
          emit && emit(x, z, y, o);
          // exact chord of the arc step
          const ch = 2 * o.r * Math.sin(Math.abs(dpsi) / 2), mid = psi + dpsi / 2;
          x += Math.sin(mid) * ch; z += Math.cos(mid) * ch; y += o.grade * d; psi += dpsi;
        }
      }
    }
    return { x, z, y };
  };
  let end = walk(null);
  const flex = ops.filter((o) => o.t === 'S' && o.flex);
  const rx = end.x - (opt.x ?? 0), rz = end.z - (opt.z ?? 0);
  if (opt.open) { const points = []; walk((x, z, y, o) => points.push([x, z, y, o.half, o.kind, o.run])); return { points, miss: [rx, rz], ops }; }
  if (Math.hypot(rx, rz) > 0.01) {
    if (flex.length < 2) throw new Error('route: needs two flex straights (S..*) to close; misses by ' + Math.hypot(rx, rz).toFixed(1) + ' m');
    // least-norm length changes: sum dl_i u_i = -r, u_i = (sin psi_i, cos psi_i)
    let a = 0, b = 0, c = 0; for (const o of flex) { const ux = Math.sin(o.psi), uz = Math.cos(o.psi); a += ux * ux; b += ux * uz; c += uz * uz; }
    const det = a * c - b * b; if (Math.abs(det) < 1e-6) throw new Error('route: the flex straights are parallel');
    const lx = (c * -rx - b * -rz) / det, lz = (a * -rz - b * -rx) / det;
    for (const o of flex) { o.len += Math.sin(o.psi) * lx + Math.cos(o.psi) * lz; if (o.len < 6) throw new Error('route: a flex straight would shrink to ' + o.len.toFixed(1) + ' m'); }
    end = walk(null);
  }
  // height closure over the graded moves
  if (Math.abs(end.y - (opt.y ?? 0)) > 0.01) {
    const graded = ops.filter((o) => o.grade !== 0);
    const L = graded.reduce((s, o) => s + (o.t === 'S' ? o.len : o.r * o.deg * DEG), 0);
    if (!L) throw new Error('route: the loop climbs ' + end.y.toFixed(1) + ' m with no graded move to close it');
    const fix = -(end.y - (opt.y ?? 0)) / L; for (const o of graded) o.grade += fix;
  }
  const points = [];
  let length = 0, climb = 0, prev = null;
  walk((x, z, y, o) => { points.push([x, z, y, o.half, o.kind, o.run]); if (prev) { length += Math.hypot(x - prev[0], z - prev[1]); climb += Math.max(0, y - prev[2]); } prev = [x, z, y]; });
  length += Math.hypot(points[0][0] - prev[0], points[0][1] - prev[1]);
  return { points, length, climb, ops };
}

// the shortest bend-straight-bend from pose A to pose B ([x, z, heading]) with bends of radius r
function dubins(A, B, r, turned = null) {
  const N = (h) => [Math.cos(h), -Math.sin(h)], TAU = 2 * Math.PI, md = (a) => ((a % TAU) + TAU) % TAU;
  let best = null;
  for (const d1 of [1, -1]) for (const d2 of [1, -1]) {
    const n1 = N(A[2]), n2 = N(B[2]);
    const c1 = [A[0] + d1 * r * n1[0], A[1] + d1 * r * n1[1]], c2 = [B[0] + d2 * r * n2[0], B[1] + d2 * r * n2[1]];
    const Dx = c2[0] - c1[0], Dz = c2[1] - c1[1], m = Math.hypot(Dx, Dz), phi = Math.atan2(Dx, Dz);
    let h, L;
    if (d1 === d2) { h = phi; L = m; } else { if (m < 2 * r) continue; h = phi + Math.asin(2 * d1 * r / m); L = Math.sqrt(m * m - 4 * r * r); }
    const a1 = md(d1 * (h - A[2])), a2 = md(d2 * (B[2] - h)), len = r * (a1 + a2) + L;
    // keep only closings that make the whole loop one turn round (a figure eight crosses itself)
    if (turned !== null && Math.abs(Math.abs(turned + d1 * a1 + d2 * a2) - TAU) > 1e-3) continue;
    if (!best || len < best.len) best = { d1, d2, a1, a2, L, len };
  }
  return best;
}

// a course from its route and its card data
export function course(meta) {
  const r = buildRoute(meta.route, meta.at || {});
  return Object.assign({ startOffset: 24 }, meta, { points: r.points, routeLength: r.length, climb: r.climb });
}

// the small map for the course list: the control points as an SVG path, north up, fitted to a w x h box
export function miniMap(c, w = 120, h = 80, pad = 6) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of c.points) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minZ = Math.min(minZ, p[1]); maxZ = Math.max(maxZ, p[1]); }
  const k = Math.min((w - 2 * pad) / (maxX - minX || 1), (h - 2 * pad) / (maxZ - minZ || 1));
  const ox = (w - (maxX - minX) * k) / 2, oz = (h - (maxZ - minZ) * k) / 2;
  // seen from above with north up, +x runs to the left (the same as tools/map.mjs)
  const X = (x) => (ox + (maxX - x) * k).toFixed(1), Y = (z) => (oz + (maxZ - z) * k).toFixed(1);
  const d = c.points.map((p, i) => (i ? 'L' : 'M') + X(p[0]) + ' ' + Y(p[1])).join('') + 'Z';
  const s = c.points[0];
  return { d, start: [X(s[0]), Y(s[1])], w, h };
}
