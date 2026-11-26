// DEGEN DRIFT: the cars you see, built in code (no model files) from Portero's turnaround sheets (Exchange job 002),
// as numbers in carbodies.js. The body is lofted station by station along the car: a cross-section that follows the
// sheet's side silhouette, plan width and wheel arches, with a crisp shoulder where the car has one; the cabin rises
// from the belt line to the roof line, with the glass set into it. Then each car's own face: lamps, grilles and
// intakes on the nose, tail lamps and pipes on the tail, the wing, scoop, vents, louvres, splitter, diffuser and
// mirrors, the livery (painted bands and glowing pinstripes), and its own rims.
// The paint is a matcap drawn at load: a metallic base whose reflections take the paint's colour, under a clear coat
// that mirrors the sunset at grazing angles. The baked lamp light under the car brightens it without shifting its hue.
// 11-26: beside the matcaps, the same parts under a reflection of the world (carpaint.js, reflect.js); setReflect
// switches between them (Settings > Car reflections: Off is the matcaps).
// Upgrades show: calipers colour with the brakes, coilovers lower it, a carbon bonnet comes with the lightest level,
// the straight pipe pops flame on the lift, nitrous burns blue. It leans on its springs, dents where it hits, and
// smokes from the bonnet when the engine is hurt. Local axes: +z forward, +x left, y up.
// Draws per car: body (paint, cabin and painted parts in one), glass, trim (black parts, seams, pipes), head lamps,
// tail lamps, livery (when it has painted bands), pinstripes (when it has them), four wheels of three each (tyre, rim
// with its disc, caliper), and the shadow, light pool, halos and flames.
import * as THREE from '../vendor/three/three.module.min.js?v=0.1.23';
import * as TX from './textures.js?v=0.1.23';
import { BODIES, shapeOf } from './carbodies.js?v=0.1.23';
import { finish, carUniforms } from './carpaint.js?v=0.1.23';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
// vertex shades for the trim (one chrome matcap, darkened per part): gloss black, matte black, slats, polished metal
const BLACK = 0.11, DEEP = 0.06, SLAT = 0.24, METAL = 0.95, SEAM = 0.03;

// ---------------------------------------------------------------- an indexed geometry builder (position, colour)
class Geo {
  constructor() { this.p = []; this.c = []; this.i = []; }
  get n() { return this.p.length / 3; }
  v(x, y, z, c = 1) { this.p.push(x, y, z); if (Array.isArray(c)) this.c.push(c[0], c[1], c[2]); else this.c.push(c, c, c); return this.n - 1; }
  // rows[k][m] = [x, y, z]; a quad between rows k, k+1 and points m, m+1; flip reverses the winding
  grid(rows, flip = false, col = () => 1) {
    const M = rows[0].length, base = this.n;
    rows.forEach((r, k) => r.forEach((p, m) => this.v(p[0], p[1], p[2], col(k, m))));
    for (let k = 0; k < rows.length - 1; k++) for (let m = 0; m < M - 1; m++) {
      const a = base + k * M + m, b = a + 1, c = a + M, d = c + 1;
      if (flip) this.i.push(a, c, b, b, c, d); else this.i.push(a, b, c, b, d, c);
    }
  }
  // a fan: centre, then a closed perimeter
  fan(ctr, per, flip = false, col = 1) {
    const c = this.v(ctr[0], ctr[1], ctr[2], col), b = this.n;
    per.forEach((p) => this.v(p[0], p[1], p[2], col));
    for (let k = 0; k < per.length; k++) { const a = b + k, d = b + (k + 1) % per.length; if (flip) this.i.push(c, d, a); else this.i.push(c, a, d); }
  }
  // a three.js geometry (indexed or not), coloured
  add(g, col = 1) {
    const P = g.attributes.position, base = this.n;
    for (let k = 0; k < P.count; k++) this.v(P.getX(k), P.getY(k), P.getZ(k), col);
    if (g.index) for (let k = 0; k < g.index.count; k++) this.i.push(base + g.index.getX(k));
    else for (let k = 0; k < P.count; k++) this.i.push(base + k);
    g.dispose();
  }
  // a box, turned and placed
  box(w, h, d, x, y, z, { rx = 0, ry = 0, rz = 0, col = 1 } = {}) {
    const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); g.translate(x, y, z); this.add(g, col);
  }
  // a convex outline extruded along a direction (a thin plate): pts are [x, y, z] in order, d the thickness vector
  plate(pts, d, col = 1) {
    const back = pts.map((p) => [p[0] + d[0], p[1] + d[1], p[2] + d[2]]), cx = (a) => [0, 1, 2].map((k) => a.reduce((s, p) => s + p[k], 0) / a.length);
    this.fan(cx(pts), pts, false, col); this.fan(cx(back), back, true, col);
    const rows = []; for (let k = 0; k <= pts.length; k++) rows.push([pts[k % pts.length], back[k % pts.length]]); this.grid(rows, false, () => col);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i); g.computeVertexNormals(); return g;
  }
}

// ---------------------------------------------------------------- the body: stations along the car
function stations(S) {
  const B = S.B, W = B.wheels, C = B.cabin, out = new Set(), add = (z) => { if (z >= S.zR - 1e-6 && z <= S.zF + 1e-6) out.add(Math.round(clamp(z, S.zR, S.zF) * 1000) / 1000); };
  for (let z = S.zR; z <= S.zF + 1e-6; z += 0.12) add(z);
  add(S.zF); for (let k = 1; k <= 6; k++) { add(S.zF - k * 0.025); add(S.zR + k * 0.025); }
  for (let k = 4; k <= 10; k++) { add(S.zF - k * 0.05); add(S.zR + k * 0.05); }
  for (const a of [W.f, W.r]) { for (let k = -5; k <= 5; k++) add(a + k * W.arch / 5); add(a - W.arch - 0.012); add(a + W.arch + 0.012); }
  for (const z of [C.screen, C.deck]) { add(z - 0.012); add(z + 0.012); }
  for (const f of B.fix || []) for (const p of f) add(p[0]);
  return [...out].sort((a, b) => a - b);
}
function bodyGeo(S, g) {
  const B = S.B, zs = stations(S), ring = zs.map((z) => S.ring(z)), arch = zs.map((z) => S.archY(z) > 0);
  const steep = zs.map((z) => Math.abs(S.bot(z + 0.03) - S.bot(z - 0.03)) / 0.06 > 0.35 && S.archY(z) < 0);
  const groups = B.sec.crease ? [[0, 2], [2, 3, 4, 5, 6], [6, 7, 8, 9]] : [[0, 2], [2, 3, 4, 5, 6, 7, 8, 9]];
  for (const side of [1, -1]) for (const grp of groups) {
    const rows = zs.map((z, k) => grp.map((i) => [side * ring[k][i][0], ring[k][i][1], z]));
    g.grid(rows, side < 0, (k, m) => (grp[0] === 0 ? (arch[k] ? 0.1 : steep[k] ? 0.85 : 0.22) : 1));
  }
  // the end faces (painted): the whole ring, both sides
  for (const [k, flip] of [[zs.length - 1, false], [0, true]]) {
    const r = ring[k], z = zs[k], per = [...r.map(([x, y]) => [x, y, z]), ...r.slice(1, -1).reverse().map(([x, y]) => [-x, y, z])];
    const cy = r.reduce((s, p) => s + p[1], 0) / r.length; g.fan([0, cy, z], per, flip, 1);
  }
  // the cabin, belt to roof
  const C = B.cabin, cz = [];
  for (let z = C.deck + 0.004; z < C.screen - 0.003; z += 0.08) cz.push(z);
  for (const z of [C.roofF, C.roofR, C.glassEnd, C.bpillar, C.quarter, C.screen - 0.004, C.screen - 0.04, C.deck + 0.04]) if (z > C.deck && z < C.screen) cz.push(z);
  cz.sort((a, b) => a - b);
  const cr = cz.map((z) => S.cabRing(z)), cgroups = B.sec.crease ? [[0, 1, 2], [2, 3, 4]] : [[0, 1, 2, 3, 4]];
  for (const side of [1, -1]) for (const grp of cgroups) g.grid(cz.map((z, k) => grp.map((i) => [side * cr[k][i][0], cr[k][i][1], z])), side < 0);
  return { zs, cz };
}
// the point at a fraction u of the way along a 2D polyline
function along(pts, u) {
  const seg = []; let L = 0; for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) || 1e-5; seg.push(d); L += d; }
  let d = u * L; for (let i = 0; i < seg.length; i++) { if (d <= seg[i] || i === seg.length - 1) { const t = Math.min(1, d / seg[i]); return [lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t)]; } d -= seg[i]; }
  return pts[pts.length - 1];
}
// the glass set into the cabin: windscreen, rear glass, side windows split by the B-pillar, a few mm proud
function glassGeo(S) {
  const B = S.B, C = B.cabin, g = new Geo();
  const across = (z, u0, u1, n) => { // points across the roof from one cant rail to the other
    const r = S.cabRing(z), line = [[r[2][0], r[2][1]], [r[3][0], r[3][1]], [0, r[4][1]], [-r[3][0], r[3][1]], [-r[2][0], r[2][1]]];
    const seg = []; let L = 0; for (let i = 0; i < 4; i++) { const d = Math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]) || 1e-4; seg.push(d); L += d; }
    const at = (u) => { let d = u * L; for (let i = 0; i < 4; i++) { if (d <= seg[i] || i === 3) { const t = Math.min(1, d / seg[i]); return [lerp(line[i][0], line[i + 1][0], t) * 1.01, lerp(line[i][1], line[i + 1][1], t) + 0.01, z]; } d -= seg[i]; } return [0, 0, z]; };
    const out = []; for (let k = 0; k <= n; k++) out.push(at(lerp(u0, u1, k / n))); return out;
  };
  const sheet = (z0, z1, n, u0, u1) => { const rows = []; for (let k = 0; k <= n; k++) rows.push(across(lerp(z0, z1, k / n), u0, u1, 6)); g.grid(rows, z1 > z0); };
  sheet(C.screen - 0.03, C.roofF + 0.05, 6, 0.04, 0.96);
  if (C.glassEnd < C.roofR - 0.1) sheet(C.roofR - 0.05, C.glassEnd + 0.03, 6, 0.06, 0.94);
  const bz = C.bpillar;
  for (const side of [1, -1]) for (const [za, zb] of [[C.screen - 0.06, bz + 0.04], [bz - 0.04, C.quarter]]) {
    if (za - zb < 0.08) continue;
    const rows = [];
    for (let k = 0; k <= 10; k++) {
      const z = lerp(za, zb, k / 10), r = S.cabRing(z), path = [r[0], r[1], r[2]], row = [];
      for (let j = 0; j <= 3; j++) { const p = along(path, lerp(0.1, 0.88, j / 3)); row.push([side * (p[0] + 0.012), p[1] + 0.003, z]); }
      rows.push(row);
    }
    g.grid(rows, side > 0);
  }
  return g.geometry();
}

// ---------------------------------------------------------------- things laid on the skin
// a patch on the nose (dir 1) or the tail (dir -1): (x, y) in the face, each vertex pushed onto the skin, off m proud
function facePt(S, dir, x, y, off) { const z = dir > 0 ? S.frontAt(x, y) + off : S.rearAt(x, y) - off; return [x, y, z]; }
// a patch on the face as a grid, map(u, v) -> [x, y] in the face; every vertex pushed onto the skin, so even a wide
// intake that wraps round the corner of the nose hugs it
function facePatch(S, g, dir, map, nu, nv, off, col) {
  const rows = [];
  for (let i = 0; i <= nu; i++) { const row = []; for (let j = 0; j <= nv; j++) { const [x, y] = map(i / nu, j / nv); row.push(facePt(S, dir, x, y, off)); } rows.push(row); }
  g.grid(rows, false, () => col);
}
const boxMap = (x0, x1, y0, y1) => (u, v) => [lerp(x0, x1, u), lerp(y0, y1, v)];
const ellMap = (x, y, rx, ry, a, r0 = 0, r1 = 1) => (u, v) => { const t = u * Math.PI * 2, r = lerp(r0, r1, v), px = Math.cos(t) * rx * r, py = Math.sin(t) * ry * r; return [x + px * Math.cos(a) - py * Math.sin(a), y + px * Math.sin(a) + py * Math.cos(a)]; };
const boxPatch = (S, g, dir, x0, x1, y0, y1, off, col) => facePatch(S, g, dir, boxMap(x0, x1, y0, y1), Math.max(2, Math.ceil(Math.abs(x1 - x0) / 0.06)), Math.max(1, Math.ceil(Math.abs(y1 - y0) / 0.06)), off, col);
// a strip along a polyline in the face, w wide
function faceLine(S, g, dir, pts, w, off, col) {
  const rows = [];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2;
    rows.push([facePt(S, dir, pts[k][0] + nx, pts[k][1] + ny, off), facePt(S, dir, pts[k][0] - nx, pts[k][1] - ny, off)]);
  }
  g.grid(rows, false, () => col);
}
const LAMP = 3.0; // a lamp's strength (the head and tail materials carry the tint)
// a black lamp housing standing out of a raked nose, its face turned forward (tilt: back from upright), round lamps in it
function lampPod(S, trim, lamp, x0, x1, y0, y1, tilt, lamps) {
  const xm = (x0 + x1) / 2, zb = S.frontAt(xm, y0) + 0.012, tn = Math.tan(tilt), zf = (y) => zb - (y - y0) * tn, D = 0.22;
  const P = (x, y, back = 0) => [x, y, zf(y) - back];
  const q = (a, b, c, d) => trim.grid([[a, b], [c, d]], false, () => BLACK);
  q(P(x0, y0), P(x1, y0), P(x0, y1), P(x1, y1));                          // face
  q(P(x0, y1), P(x1, y1), P(x0, y1, D), P(x1, y1, D));                    // top
  q(P(x0, y0), P(x1, y0), P(x0, y0, D), P(x1, y0, D));                    // bottom
  for (const x of [x0, x1]) q(P(x, y0), P(x, y1), P(x, y0, D), P(x, y1, D)); // ends
  const n = [0, Math.sin(tilt), Math.cos(tilt)], up = [0, Math.cos(tilt), -Math.sin(tilt)];
  for (const [lx, ly, r] of lamps) {
    const c = P(lx, ly), at = (dx, dy, o) => [c[0] + dx, c[1] + dy * up[1] + n[1] * o, c[2] + dy * up[2] + n[2] * o];
    const rows = []; for (let i = 0; i <= 14; i++) { const t = i / 14 * Math.PI * 2, row = []; for (let j = 0; j <= 3; j++) { const k = j / 3; row.push(at(Math.cos(t) * r * k, Math.sin(t) * r * k, 0.008)); } rows.push(row); }
    lamp.grid(rows, false, (i, j) => LAMP * (1 - j / 3 * 0.72));
    const ring = []; for (let i = 0; i <= 14; i++) { const t = i / 14 * Math.PI * 2; ring.push([at(Math.cos(t) * r, Math.sin(t) * r, 0.006), at(Math.cos(t) * r * 1.16, Math.sin(t) * r * 1.16, 0.006)]); }
    trim.grid(ring, false, () => METAL * 0.6);
  }
}
// a round lamp: white-hot in the middle, its own tint at the rim
function lampDisc(S, g, dir, x, y, r) {
  const rows = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14 * Math.PI * 2, row = []; for (let j = 0; j <= 3; j++) { const q = j / 3; row.push(facePt(S, dir, x + Math.cos(t) * r * q, y + Math.sin(t) * r * q, 0.015)); } rows.push(row); }
  g.grid(rows, false, (i, j) => LAMP * (1 - j / 3 * 0.72));
}
// the nose's or the tail's list of elements, into the trim, lamp and tail geometries
function faceElements(S, list, dir, trim, lamp, tail) {
  for (const e of list || []) {
    const sides = (e.x0 !== undefined ? e.x0 > 0 : e.x !== undefined ? e.x > 0 : true) ? [1, -1] : [1];
    for (const s of sides) {
      const X = (x) => x * s;
      if (e.t === 'pod') lampPod(S, trim, lamp, X(e.x0), X(e.x1), e.y0, e.y1, e.tilt, e.lamps.map(([x, y, r]) => [X(x), y, r]));
      if (e.t === 'box' || e.t === 'tbox') boxPatch(S, e.t === 'tbox' ? tail : trim, dir, X(e.x0), X(e.x1), e.y0, e.y1, e.t === 'tbox' ? 0.013 : 0.009, e.t === 'tbox' ? LAMP : DEEP);
      if (e.t === 'ell') facePatch(S, trim, dir, ellMap(X(e.x), e.y, e.rx, e.ry, e.a * s), 16, 3, 0.006, DEEP);
      if (e.t === 'disc') { lampDisc(S, lamp, dir, X(e.x), e.y, e.r); facePatch(S, trim, dir, ellMap(X(e.x), e.y, e.r, e.r, 0, 1, 1.14), 14, 1, 0.012, METAL * 0.6); }
      if (e.t === 'line' || e.t === 'aline' || e.t === 'tline') {
        const pts = e.pts.map(([x, y]) => [X(x), y]);
        faceLine(S, e.t === 'tline' ? tail : lamp, dir, pts, e.w, 0.014, e.t === 'aline' ? [LAMP, LAMP * 0.42, LAMP * 0.07] : LAMP);
        faceLine(S, trim, dir, pts, e.w + 0.03, 0.009, DEEP);
      }
    }
  }
}
// a patch on a flank between heights y0(z) and y1(z) from za to zb, both sides; stops where the skin is not there
function flankBand(S, g, za, zb, y0, y1, off, col, nv = 3) {
  for (const side of [1, -1]) {
    let rows = [];
    const flush = () => { if (rows.length > 1) g.grid(rows, side < 0, () => col); rows = []; };
    const n = Math.max(2, Math.ceil(Math.abs(zb - za) / 0.07));
    for (let k = 0; k <= n; k++) {
      const z = lerp(za, zb, k / n), row = [];
      let ok = true;
      for (let j = 0; j <= nv; j++) { const y = lerp(y0(z), y1(z), j / nv), x = S.halfAt(z, y); if (x < 0.05 || y < S.bot(z) + 0.004) { ok = false; break; } row.push([side * (x + off), y, z]); }
      if (ok) rows.push(row); else flush();
    }
    flush();
  }
}
// a patch over the top between x0 and x1 (mirrored when it is off centre) from za to zb
function topBand(S, g, za, zb, x0, x1, off, col, nu = 3) {
  const sides = x0 > 0 ? [1, -1] : [1];
  for (const s of sides) {
    const rows = [], n = Math.max(2, Math.ceil(Math.abs(zb - za) / 0.07));
    for (let k = 0; k <= n; k++) { const z = lerp(za, zb, k / n), row = []; for (let j = 0; j <= nu; j++) { const x = s * lerp(x0, x1, j / nu); row.push([x, S.topAt(z, x) + off, z]); } rows.push(row); }
    g.grid(rows, (za < zb) !== (s < 0), () => col);
  }
}

// ---------------------------------------------------------------- the details of one body
function details(S, paint, trim, lamp, tail, livery, glowG) {
  const B = S.B, C = B.cabin, tips = [], halos = [], tailHalos = [];
  // nose and tail
  faceElements(S, B.front, 1, trim, lamp, tail);
  faceElements(S, B.rear, -1, trim, lamp, tail);
  for (const [x, y] of B.lampHalo || []) for (const s of [1, -1]) halos.push([s * x, y, S.frontAt(s * x, y) + 0.06]);
  for (const [x, y] of B.tailHalo || []) for (const s of [1, -1]) tailHalos.push([s * x, y, S.rearAt(s * x, y) - 0.03]);
  // the pipes, with a dark bore
  const E = B.exhaust;
  for (const x0 of E.x) for (const s of [1, -1]) {
    const x = s * x0, z = S.rearAt(x, E.y + E.r + 0.03), zt = Math.min(z, S.zR + 0.15) - 0.05;
    const c = new THREE.CylinderGeometry(E.r, E.r * 0.95, 0.14, 14, 1, true); c.rotateX(Math.PI / 2); c.translate(x, E.y, zt + 0.09); trim.add(c, METAL);
    const d = new THREE.CircleGeometry(E.r * 0.8, 12); d.rotateY(Math.PI); d.translate(x, E.y, zt + 0.04); trim.add(d, DEEP);
    const lip = new THREE.RingGeometry(E.r * 0.78, E.r, 14, 1); lip.rotateY(Math.PI); lip.translate(x, E.y, zt + 0.02); trim.add(lip, METAL);
    tips.push([x, E.y, zt - 0.01]);
  }
  // splitter and diffuser
  if (B.splitter) { // a blade under the nose, its front edge a few centimetres proud of the bumper
    const p = B.splitter, rows = [];
    for (let i = 0; i <= 14; i++) { const x = lerp(-p.w, p.w, i / 14), zf = Math.min(p.z0, S.frontAt(x, p.y + 0.09) + 0.05); rows.push([[x, p.y, zf], [x, p.y, p.z1]]); }
    trim.grid(rows, false, () => BLACK);
  }
  if (B.diffuser) {
    const d = B.diffuser; boxPatch(S, trim, -1, -d.x, d.x, d.y0, d.y1, 0.006, DEEP);
    for (let k = 0; k < d.fins; k++) { const x = lerp(-d.x * 0.8, d.x * 0.8, k / Math.max(1, d.fins - 1)), z = S.rearAt(x, (d.y0 + d.y1) / 2); trim.box(0.014, d.y1 - d.y0, 0.16, x, (d.y0 + d.y1) / 2, z + 0.02, { col: BLACK }); }
  }
  // side vents (black, with slats) and bonnet vents
  for (const v of B.vents || []) {
    flankBand(S, trim, v.z0, v.z1, () => v.y0, () => v.y1, 0.005, DEEP, 2);
    for (let k = 1; k <= v.fins; k++) { const y = lerp(v.y0, v.y1, k / (v.fins + 1)); flankBand(S, trim, v.z0, v.z1, () => y - 0.008, () => y + 0.008, 0.012, SLAT, 1); }
  }
  for (const v of B.tvents || []) {
    topBand(S, trim, v.z0, v.z1, v.x0, v.x1, 0.005, DEEP, 2);
    for (let k = 1; k <= v.n; k++) { const z = lerp(v.z0, v.z1, k / (v.n + 1)); topBand(S, trim, z + 0.012, z - 0.012, v.x0 + 0.01, v.x1 - 0.01, 0.012, SLAT, 1); }
  }
  // louvres: slats across the deck or the rear glass, or on the quarter (side)
  for (const l of B.louvres || []) {
    if (l.t === 'top') {
      topBand(S, trim, l.z0, l.z1, -l.x, l.x, 0.004, DEEP, 4);
      for (let k = 0; k < l.n; k++) { const z = lerp(l.z0 - 0.02, l.z1 + 0.02, k / Math.max(1, l.n - 1)); topBand(S, trim, z + 0.018, z - 0.018, -l.x + 0.02, l.x - 0.02, 0.016, SLAT, 4); }
    } else {
      flankBand(S, trim, l.z0, l.z1, () => l.y0, () => l.y1, 0.006, DEEP, 2);
      for (let k = 0; k < l.n; k++) { const z = lerp(l.z0 - 0.03, l.z1 + 0.03, k / Math.max(1, l.n - 1)); flankBand(S, trim, z + 0.014, z - 0.014, () => l.y0 + 0.02, () => l.y1 - 0.02, 0.014, SLAT, 2); }
    }
  }
  // panel seams: the door cuts, the bonnet's edges
  for (const z of B.doors || []) flankBand(S, trim, z + 0.005, z - 0.005, (zz) => S.bot(zz) + 0.04, (zz) => S.shoulder(zz) - 0.012, 0.003, SEAM, 3);
  const bf = S.zF - 0.24;
  if (bf > C.screen + 0.3) for (const s of [1, -1]) { const rows = []; for (let k = 0; k <= 10; k++) { const z = lerp(C.screen + 0.04, bf, k / 10), x = s * S.plan(z) * 0.66, y = S.topAt(z, x) + 0.003; rows.push([[x - 0.004, y, z], [x + 0.004, y, z]]); } trim.grid(rows, s < 0, () => SEAM); }
  // mirrors: a painted housing on a black stalk, at the door's front
  const mz = C.screen - 0.45 * (C.screen - C.roofF) - 0.2, my = S.belt(mz) + 0.05, mx = S.halfAt(mz, S.belt(mz) - 0.02);
  for (const s of [1, -1]) { paint.box(0.13, 0.07, 0.1, s * (mx + 0.075), my, mz, { ry: s * 0.15 }); trim.box(0.08, 0.05, 0.05, s * (mx + 0.015), my - 0.035, mz + 0.01, { col: BLACK }); }
  // the scoop: a painted box on the bonnet, open (black) at the front
  if (B.scoop) {
    const p = B.scoop, yb = S.topAt((p.z0 + p.z1) / 2, 0) - 0.03, yt = Math.max(S.topAt(p.z0, 0), S.topAt(p.z1, 0)) + p.h;
    paint.plate([[p.w, yb, p.z0], [p.w, yb, p.z1], [p.w, yt, p.z1], [p.w, yt - 0.02, p.z0]], [-2 * p.w, 0, 0]);
    boxPatch({ frontAt: () => p.z0 + 0.002, rearAt: () => 0 }, trim, 1, -p.w + 0.025, p.w - 0.025, yt - p.h * 0.75, yt - 0.04, 0.002, DEEP);
  }
  // the wing
  const Wg = B.wing;
  if (Wg) {
    const into = Wg.paint ? paint : trim, wc = Wg.paint ? 1 : BLACK, chord = Wg.z0 - Wg.z1, ang = Math.atan2(Wg.y1 - Wg.y0, chord);
    const zm = (Wg.z0 + Wg.z1) / 2, ym = (Wg.y0 + Wg.y1) / 2;
    if (Wg.t === 'lip') { // a thin blade rising out of the deck across the tail
      const base = (z) => S.topAt(z, 0) - 0.01;
      into.plate([[Wg.span, base(Wg.z0), Wg.z0], [Wg.span, Wg.y1 - Wg.th, Wg.z1], [Wg.span, Wg.y1, Wg.z1], [Wg.span, base(Wg.z0) + Wg.th, Wg.z0 + 0.02]], [-2 * Wg.span, 0, 0], wc);
    } else {
      into.box(Wg.span * 2, Wg.th, chord, 0, ym, zm, { rx: ang, col: wc });
      if (Wg.plates) for (const s of [1, -1]) {
        const pl = [[s * Wg.span, Wg.y0 + 0.03, Wg.z0 + 0.02], [s * Wg.span, Wg.y1 + 0.05, Wg.z1 - 0.02], [s * Wg.span, Wg.y1 - 0.11, Wg.z1 - 0.02], [s * Wg.span, Wg.y0 - 0.09, Wg.z0 + 0.06]];
        const po = s > 0 ? pl : pl.slice().reverse();
        if (Wg.plateCol) livery.plate(po, [s * 0.018, 0, 0], rgb(Wg.plateCol)); else into.plate(po, [s * 0.018, 0, 0], wc);
      }
      for (const x0 of Wg.stands || []) for (const s of [1, -1]) {
        const x = s * x0;
        if (Wg.t === 'swan') { // a swan neck: from the deck up and over, hanging the wing from above
          const zb = Wg.z0 + 0.08, yb = S.topAt(zb, x) - 0.02, zt = zm + 0.02, yt = lerp(Wg.y0, Wg.y1, (Wg.z0 - zt) / chord) + 0.07;
          trim.plate([[x, yb, zb + 0.06], [x, yb, zb - 0.1], [x, yt, zt - 0.08], [x, yt + 0.02, zt + 0.06], [x, yt - 0.04, Wg.z0 + 0.05]], [s * 0.022, 0, 0], BLACK);
        } else {
          const yb = S.topAt(zm, x) - 0.02, yt = ym - 0.01;
          (Wg.t === 'duck' ? into : trim).box(0.03, yt - yb, 0.12, x, (yb + yt) / 2, zm + 0.04, { rx: -0.15, col: Wg.t === 'duck' ? wc : BLACK });
        }
      }
    }
  }
  // the livery
  for (const l of B.livery || []) {
    const col = rgb(l.col);
    if (l.t === 'line') {
      const n = l.pts.length;
      for (let i = 0; i < n - 1; i++) {
        const [za, ya] = l.pts[i], [zb, yb] = l.pts[i + 1], y = (z) => lerp(ya, yb, (za - z) / (za - zb));
        flankBand(S, glowG, za, zb, (z) => y(z) - l.w / 2, (z) => y(z) + l.w / 2, 0.004, col, 1);
      }
    }
    if (l.t === 'flank') { const lo = plf(l.lo), hi = plf(l.hi), za = Math.min(l.lo[0][0], l.hi[0][0]), zb = Math.max(l.lo[l.lo.length - 1][0], l.hi[l.hi.length - 1][0]); flankBand(S, livery, za, zb, lo, hi, 0.004, col, 2); }
    if (l.t === 'top') topBand(S, livery, l.z0, l.z1, l.x0, l.x1, 0.004, col, 3);
    if (l.t === 'front' || l.t === 'rear') { const dir = l.t === 'front' ? 1 : -1; for (const s of l.x0 > 0 ? [1, -1] : [1]) boxPatch(S, livery, dir, s * l.x0, s * l.x1, l.y0, l.y1, 0.004, col); }
  }
  return { tips, halos, tailHalos };
}
function plf(pts) { const p = pts.slice().sort((a, b) => b[0] - a[0]); return (z) => { if (z >= p[0][0]) return p[0][1]; for (let i = 0; i < p.length - 1; i++) if (z >= p[i + 1][0]) return lerp(p[i][1], p[i + 1][1], (p[i][0] - z) / (p[i][0] - p[i + 1][0])); return p[p.length - 1][1]; }; }

// ---------------------------------------------------------------- the rims (each car's own; the upgrade rims)
function rimGeo(B, style) {
  const W = B.wheels, R = W.R, tw = W.tw, rr = W.rim, g = new Geo(), Rm = B.rims;
  const stock = !style || style === 'spoke', st = stock ? Rm.style : style;
  // the rim's colours: the matcap carries the brightest, the vertices darken the rest (the lip polished, the cap painted)
  const spokeC = stock ? Rm.col : style === 'mesh' ? '#c99a3a' : '#c8ccd8', lipC = stock && Rm.lip ? Rm.lip : spokeC;
  const lum = (h) => { const c = new THREE.Color(h); return Math.max(c.r, c.g, c.b); };
  const top = lum(spokeC) > lum(lipC) ? spokeC : lipC, base = rgb(top);
  const rel = (h) => { const c = rgb(h); return c.map((v, k) => clamp(v / Math.max(0.05, base[k]), 0, 1.4)); };
  const SP = rel(spokeC), LIP = rel(lipC), CAP = stock ? rel(Rm.cap) : SP;
  const face = tw * 0.36, dish = stock ? (Rm.dish ? 0.07 : 0.025) : style === 'dish' ? 0.1 : 0.03;
  // barrel (dark inside), the outer lip, the brake disc behind
  const barrel = new THREE.CylinderGeometry(rr, rr, tw * 0.8, 16, 1, true); barrel.rotateZ(Math.PI / 2); barrel.translate(-tw * 0.02, 0, 0); g.add(barrel, 0.12);
  const lipW = st === 'dish' || (stock && Rm.dish) ? 0.065 : 0.022;
  const lip = new THREE.RingGeometry(rr - lipW, rr + 0.006, 20, 1); lip.rotateY(Math.PI / 2); lip.translate(face, 0, 0); g.add(lip, LIP);
  const disc = new THREE.CircleGeometry(rr * 0.82, 14); disc.rotateY(Math.PI / 2); disc.translate(-tw * 0.15, 0, 0); g.add(disc, 0.2);
  const hubX = face - dish, rIn = 0.07, rOut = rr - lipW * 0.6;
  // a spoke: a box from the hub to the lip, tapered, turned to angle a (twist: the outer end turned on by tw)
  const spoke = (a, wIn, wOut, th, col, twist = 0) => {
    const rows = [], seg = 3;
    for (let k = 0; k <= seg; k++) {
      const t = k / seg, r = lerp(rIn, rOut, t), aa = a + twist * t, w = lerp(wIn, wOut, t), x = lerp(hubX, face - 0.004, Math.sqrt(t));
      const cy = Math.cos(aa) * r, cz = Math.sin(aa) * r, ty = -Math.sin(aa), tz = Math.cos(aa);
      rows.push([[x, cy - ty * w / 2, cz - tz * w / 2], [x, cy + ty * w / 2, cz + tz * w / 2], [x - th, cy + ty * w / 2, cz + tz * w / 2], [x - th, cy - ty * w / 2, cz - tz * w / 2], [x, cy - ty * w / 2, cz - tz * w / 2]]);
    }
    g.grid(rows.map((r) => r), false, () => col);
  };
  const N = { five: 5, fived: 5, six: 6, multi: 15, turbine: 18, mesh: 14, dish: 6 }[st] || 5;
  for (let k = 0; k < N; k++) {
    const a = k / N * Math.PI * 2;
    if (st === 'five') spoke(a, 0.085, 0.06, 0.04, SP);
    if (st === 'six') spoke(a, 0.075, 0.07, 0.03, SP);
    if (st === 'fived') spoke(a, 0.07, 0.04, 0.04, SP, 0.22);
    if (st === 'multi') spoke(a, 0.022, 0.014, 0.02, SP, 0.12);
    if (st === 'mesh') spoke(a, 0.016, 0.012, 0.016, SP, k % 2 ? 0.5 : -0.5);
    if (st === 'dish') spoke(a, 0.05, 0.04, 0.025, SP);
    if (st === 'turbine') { // a curved blade, pitched so it reads as a fan
      const rows = [], seg = 4, w = 0.034, pitch = 0.75;
      for (let j = 0; j <= seg; j++) {
        const t = j / seg, r = lerp(0.075, rOut, t), aa = a + 0.95 * t, x = lerp(hubX, face - 0.006, t);
        const cy = Math.cos(aa) * r, cz = Math.sin(aa) * r, ty = -Math.sin(aa), tz = Math.cos(aa), u = [Math.sin(pitch) * w / 2, ty * Math.cos(pitch) * w / 2, tz * Math.cos(pitch) * w / 2];
        rows.push([[x - u[0], cy - u[1], cz - u[2]], [x + u[0], cy + u[1], cz + u[2]]]);
      }
      g.grid(rows, false, () => SP);
    }
  }
  if (st === 'turbine') { const ring = new THREE.RingGeometry(0.06, 0.11, 18, 1); ring.rotateY(Math.PI / 2); ring.translate(hubX + 0.004, 0, 0); g.add(ring, SP); }
  // the centre cap and the nuts
  const cap = new THREE.CylinderGeometry(0.045, 0.06, 0.04, 10); cap.rotateZ(-Math.PI / 2); cap.translate(hubX + 0.012, 0, 0); g.add(cap, CAP);
  return { geo: g.geometry(), col: top };
}

// ---------------------------------------------------------------- the car
export class CarMesh {
  constructor(look, bodyId = 'kestrel') {
    this.group = new THREE.Group();     // follows the chassis (position, heading)
    this.body = new THREE.Group();      // leans on the springs
    this.group.add(this.body);
    const PO = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
    this.mats = {
      paint: new THREE.MeshMatcapMaterial({ matcap: TX.matcap('paint', look.paint), vertexColors: true }),
      glass: new THREE.MeshMatcapMaterial({ matcap: TX.matcap('tint', '#2c323e'), side: THREE.DoubleSide }), // tinted, the cabin's grey behind it (002)
      trim: new THREE.MeshMatcapMaterial(Object.assign({ matcap: TX.matcap('chrome', '#b4b7bf'), vertexColors: true, side: THREE.DoubleSide }, PO)),
      rubber: new THREE.MeshMatcapMaterial({ matcap: TX.matcap('rubber', '#111') }),
      rim: new THREE.MeshMatcapMaterial({ matcap: TX.matcap('chrome', '#c8ccd8'), vertexColors: true, side: THREE.DoubleSide }),
      caliper: new THREE.MeshMatcapMaterial({ matcap: TX.matcap('paint', '#3a3a40') }),
      livery: new THREE.MeshMatcapMaterial(Object.assign({ matcap: TX.matcap('paint', '#ffffff'), vertexColors: true, side: THREE.DoubleSide }, PO)),
      decal: new THREE.MeshMatcapMaterial(Object.assign({ matcap: TX.matcap('paint', '#f4f1f8'), side: THREE.DoubleSide }, { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })),
    };
    this.mats.paint.userData = { name: 'paint', base: look.paint, metal: 0.4, rough: 0.3 };
    this.mats.glass.userData = { name: 'glass', base: '#10131c', metal: 0.1, rough: 0.05 };
    this.mats.trim.userData = { name: 'trim', base: '#b4b7bf', metal: 0.6, rough: 0.35 };
    this.mats.rubber.userData = { name: 'tyre', base: '#151515', metal: 0, rough: 0.9 };
    this.mats.rim.userData = { name: 'rim', base: '#c8ccd8', metal: 0.9, rough: 0.25 };
    this.mats.caliper.userData = { name: 'caliper', base: '#3a3a40', metal: 0.2, rough: 0.5 };
    this.mats.livery.userData = { name: 'livery', base: '#ffffff', metal: 0.4, rough: 0.3 };
    this.tintables = [this.mats.paint, this.mats.glass, this.mats.trim, this.mats.rubber, this.mats.rim, this.mats.caliper, this.mats.decal, this.mats.livery];
    // 11-26: the same parts under a reflection of the world (carpaint.js), and a switch between the two sets (setReflect:
    // Settings > Car reflections > Off keeps the matcaps above). this.mats is the set in use; new parts take from it.
    this.uCar = carUniforms();
    const DS = THREE.DoubleSide;
    this.sets = {
      old: this.mats,
      new: {
        paint: finish('paint', this.uCar, { base: look.paint, rough: 0.04, coatAttr: true, vertexColors: true }),
        glass: finish('glass', this.uCar, { base: '#2c323e', rough: 0, side: DS }),
        trim: finish('trim', this.uCar, Object.assign({ base: '#b4b7bf', rough: 0.08, vertexColors: true, side: DS }, PO)),
        rubber: finish('rubber', this.uCar, { base: '#111111', rough: 0.7 }),
        rim: finish('rim', this.uCar, { base: '#c8ccd8', rough: 0.06, vertexColors: true, side: DS }),
        caliper: finish('paint', this.uCar, { base: '#3a3a40', rough: 0.15 }),
        livery: finish('paint', this.uCar, Object.assign({ base: '#ffffff', rough: 0.04, vertexColors: true, side: DS }, PO)),
        decal: finish('paint', this.uCar, { base: '#f4f1f8', rough: 0.04, side: DS, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
      },
    };
    for (const set of Object.values(this.sets)) for (const [k, m] of Object.entries(set)) m.userData.key = k;
    for (const [k, m] of Object.entries(this.sets.new)) m.userData.name = this.mats[k].userData.name || k;
    this.active = 'old';
    const LO = { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 };
    this.headMat = new THREE.MeshBasicMaterial(Object.assign({ color: new THREE.Color(3.2, 3.4, 3.8), side: THREE.DoubleSide, vertexColors: true }, LO));
    this.tailMat = new THREE.MeshBasicMaterial(Object.assign({ color: new THREE.Color(0.5, 0.004, 0.008), side: THREE.DoubleSide, vertexColors: true }, LO));
    this.stripeMat = new THREE.MeshBasicMaterial(Object.assign({ color: new THREE.Color(1.7, 1.7, 1.7), side: THREE.DoubleSide, vertexColors: true }, PO));
    this.headMat.userData = { name: 'lamp', emissive: '#fff4dc' }; this.tailMat.userData = { name: 'tail lamp', emissive: '#ff1830' }; this.stripeMat.userData = { name: 'pinstripe', base: '#ffffff', metal: 0.2, rough: 0.3 };
    // the shadow, the headlight pool on the road, the underglow (kept across body swaps)
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 5.1), new THREE.MeshBasicMaterial({ map: TX.shadowBlob(), transparent: true, depthWrite: false, opacity: 0.9 }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.035; sh.renderOrder = 1; this.group.add(sh); this.shadow = sh;
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(5, 18), poolMaterial(new THREE.Color(0.2, 0.22, 0.27)));
    this.pool.rotation.x = -Math.PI / 2; this.pool.position.set(0, 0.05, 12); this.pool.renderOrder = 2; this.group.add(this.pool);
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.2), poolMaterial(new THREE.Color(0, 0, 0)));
    this.glow.rotation.x = -Math.PI / 2; this.glow.position.y = 0.04; this.glow.renderOrder = 2; this.group.add(this.glow);
    // lamp halos and exhaust flames: soft additive points riding on the body
    this.halo = new THREE.Points(new THREE.BufferGeometry(), haloMaterial()); this.halo.frustumCulled = false; this.halo.renderOrder = 6; this.body.add(this.halo);
    this.flame = new THREE.Points(new THREE.BufferGeometry(), haloMaterial()); this.flame.frustumCulled = false; this.flame.renderOrder = 6; this.body.add(this.flame);
    // 11-26, high tier: the lamps mirrored in the road (the halos' own points, drawn where the eye meets their mirror image)
    this.wet = new THREE.Points(this.halo.geometry, wetMaterial()); this.wet.frustumCulled = false; this.wet.renderOrder = 5; this.wet.visible = false; this.body.add(this.wet);
    this.bodyId = null; this.look = {}; this.damageKey = ''; this._c = new THREE.Color(); this.flameT = 0; this.lastThr = 0;
    this.build(bodyId, look);
  }

  // ---------------------------------------------------------------- build (or rebuild for another car)
  build(bodyId, look) {
    if (this.parts) for (const o of this.parts) { if (o.parent) o.parent.remove(o); o.geometry.dispose(); }
    this.parts = [];
    const B = BODIES[bodyId] || BODIES.kestrel, S = shapeOf(B);
    this.bodyId = BODIES[bodyId] ? bodyId : 'kestrel'; this.B = B; this.S = S;
    const add = (g, m, name) => { if (!g || !g.attributes.position.count) return null; const o = new THREE.Mesh(g, m); o.name = name; this.body.add(o); this.parts.push(o); return o; };
    const paint = new Geo(), trim = new Geo(), lamp = new Geo(), tail = new Geo(), livery = new Geo(), glowG = new Geo();
    bodyGeo(S, paint);
    const D = details(S, paint, trim, lamp, tail, livery, glowG);
    this.tips = D.tips;
    const bg = paint.geometry(); this.bodyGeo = bg;
    this.basePos = Float32Array.from(bg.attributes.position.array); this.baseCol = Float32Array.from(bg.attributes.color.array); this.baseNor = Float32Array.from(bg.attributes.normal.array);
    // what each vertex takes from each corner's damage, worked out once (a hit costs a few multiply-adds per vertex)
    const nv = bg.attributes.position.count, P = this.basePos, fz = S.zF - 0.3, rz = S.zR + 0.3, fw = S.plan(fz), rw = S.plan(rz);
    this.dmgCorners = [['fl', fw, fz], ['fr', -fw, fz], ['rl', rw, rz], ['rr', -rw, rz], ['engine', 0, S.zF + 0.1]];
    this.dmgW = new Float32Array(nv * 5); this.dmgNoise = new Float32Array(nv); this.carbonW = new Float32Array(nv);
    for (let i = 0; i < nv; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      this.dmgCorners.forEach(([, cx, cz], k) => { this.dmgW[i * 5 + k] = Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / 0.35); });
      this.dmgNoise[i] = 0.5 + 0.5 * Math.sin(x * 23 + z * 17);
      // the carbon bonnet: the top of the nose ahead of the screen, a weave under the clear coat (0 = not bonnet)
      if (z > B.cabin.screen + 0.02 && z < S.zF - 0.03 && y > S.shoulder(z) - 0.03 && Math.abs(x) < S.plan(z) * 0.8) this.carbonW[i] = 0.07 + 0.03 * ((Math.floor(x * 40) + Math.floor(z * 40)) & 1);
    }
    // 11-26: the clear coat per vertex (carpaint.js 'coat': its strength and the roughness damage adds): full on the
    // painted body, none in the wheel arches (shade 0.1), most of it on the darker sills (0.22); setDamage takes it down
    this.baseCoat = new Float32Array(nv); const coat = new Float32Array(nv * 2);
    for (let i = 0; i < nv; i++) { const c = clamp((this.baseCol[i * 3] - 0.1) / 0.15, 0, 1); this.baseCoat[i] = c * c * (3 - 2 * c); coat[i * 2] = this.baseCoat[i]; }
    bg.setAttribute('coat', new THREE.BufferAttribute(coat, 2));
    this.normalsDirty = false; this.normalsT = 0;
    add(bg, this.mats.paint, 'body');
    add(glassGeo(S), this.mats.glass, 'glass');
    add(trim.geometry(), this.mats.trim, 'trim');
    add(lamp.geometry(), this.headMat, 'lamps');
    add(tail.geometry(), this.tailMat, 'tail lamps');
    if (livery.n) add(livery.geometry(), this.mats.livery, 'livery');
    if (glowG.n) add(glowG.geometry(), this.stripeMat, 'pinstripe');
    this.decalMesh = null;
    // halos for lamps (head white-warm, tail red)
    const hp = [], hc = [], hs = [], ht = B.headTint || [0.9, 0.95, 1.0];
    for (const h of D.halos) { hp.push(h[0], h[1], h[2]); hc.push(ht[0], ht[1], ht[2]); hs.push(1.1); }
    this.headMat.color.setRGB(ht[0], ht[1], ht[2]);
    this.tailIdx = hp.length / 3;
    for (const t of D.tailHalos) { hp.push(t[0], t[1], t[2]); hc.push(1.0, 0.08, 0.12); hs.push(0.8); }
    const hg = this.halo.geometry; hg.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3)); hg.setAttribute('color', new THREE.Float32BufferAttribute(hc, 3)); hg.setAttribute('aSize', new THREE.Float32BufferAttribute(hs, 1));
    this.haloBase = Float32Array.from(hc);
    const fp = [], fc = [], fs = []; for (const t of this.tips) { fp.push(...t); fc.push(0, 0, 0); fs.push(0.7); }
    const fg = this.flame.geometry; fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3)); fg.setAttribute('aSize', new THREE.Float32BufferAttribute(fs, 1));
    this.shadow.scale.set(B.W / 1.85, B.L / 4.45, 1);
    this.buildWheels(look.rim || 'spoke');
    this.damageKey = '';
    this.look = {};
    this.setLook(look, true);
  }
  decalGeom(kind) {
    if (!kind || kind === 'none') return null;
    const S = this.S, C = this.B.cabin, g = new Geo();
    if (kind === 'stripes') { // twin stripes nose to tail over the bonnet, roof and deck
      for (const [za, zb] of [[S.zF - 0.06, C.screen + 0.02], [C.roofF - 0.02, C.roofR + 0.02], [C.deck - 0.02, S.zR + 0.06]]) if (za > zb) topBand(S, g, za, zb, 0.09, 0.19, 0.007, 1, 2);
    }
    if (kind === 'spear') { // a tapering spear along each flank, under the shoulder
      const za = S.zF - 0.45, zb = S.zR + 0.45, mid = (z) => S.shoulder(z) - 0.14, half = (z) => 0.012 + 0.045 * (z - zb) / (za - zb);
      flankBand(S, g, za, zb, (z) => mid(z) - half(z), (z) => mid(z) + half(z), 0.007, 1, 2);
    }
    return g.n ? g.geometry() : null;
  }
  buildWheels(style) {
    for (const w of this.wheels || []) { this.group.remove(w.pivot); }
    if (this.wheelGeos) for (const g of this.wheelGeos) g.dispose();
    this.wheels = [];
    const B = this.B, W = B.wheels, R = W.R, tw = W.tw, rr = W.rim;
    // the tyre: a rounded section turned round the axle
    const prof = [[rr + 0.01, -tw / 2 + 0.01], [R - 0.035, -tw / 2], [R - 0.008, -tw / 2 + 0.02], [R, -tw / 2 + 0.05], [R, tw / 2 - 0.05], [R - 0.008, tw / 2 - 0.02], [R - 0.035, tw / 2], [rr + 0.01, tw / 2 - 0.01]].map(([r, x]) => new THREE.Vector2(r, x));
    const tire = new THREE.LatheGeometry(prof, 16); tire.rotateZ(Math.PI / 2);
    const rim = rimGeo(B, style), cal = new THREE.BoxGeometry(0.05, 0.09, 0.16); cal.translate(-tw * 0.1, rr * 0.6, -0.05);
    this.wheelGeos = [tire, rim.geo, cal];
    const O = this.sets.old;
    if (O.rim.matcap) O.rim.matcap.dispose();
    O.rim.matcap = TX.matcap(style === 'mesh' ? 'gold' : 'chrome', rim.col); O.rim.needsUpdate = true; O.rim.userData.base = rim.col;
    this.sets.new.rim.uniforms.base.value.set(rim.col);
    for (const [z, s] of [[W.f, 1], [W.f, -1], [W.r, 1], [W.r, -1]]) {
      const x = s * this.S.track(z) / 2;
      const pivot = new THREE.Group(); pivot.position.set(x, R, z);
      const spin = new THREE.Group(); pivot.add(spin);
      const tm = new THREE.Mesh(tire, this.mats.rubber), rm = new THREE.Mesh(rim.geo, this.mats.rim), cm = new THREE.Mesh(cal, this.mats.caliper);
      tm.name = 'tyre'; rm.name = 'rim'; cm.name = 'caliper';
      for (const m of [tm, rm]) { m.scale.x = s; spin.add(m); }
      cm.scale.x = s; pivot.add(cm);
      this.group.add(pivot);
      this.wheels.push({ pivot, spin });
    }
  }
  // look: { paint, rim, smoke, glow, decal, brakes (0-3), ride (0-2), carbon (bool), exhaust (0-2) }
  setLook(look, force = false) {
    const prev = this.look || {};
    this.look = look;
    const O = this.sets.old, N = this.sets.new;
    if (force || prev.paint !== look.paint) { if (O.paint.matcap) O.paint.matcap.dispose(); O.paint.matcap = TX.matcap('paint', look.paint); O.paint.needsUpdate = true; O.paint.userData.base = look.paint; N.paint.uniforms.base.value.set(look.paint); }
    if (!force && (prev.rim || 'spoke') !== (look.rim || 'spoke')) this.buildWheels(look.rim || 'spoke');
    if (force || prev.decal !== look.decal) {
      if (this.decalMesh) { this.decalMesh.parent.remove(this.decalMesh); this.decalMesh.geometry.dispose(); this.parts = this.parts.filter((o) => o !== this.decalMesh); this.decalMesh = null; }
      const g = this.decalGeom(look.decal); if (g) { this.decalMesh = new THREE.Mesh(g, this.mats.decal); this.decalMesh.name = 'decal'; this.body.add(this.decalMesh); this.parts.push(this.decalMesh); }
    }
    if (force || prev.brakes !== look.brakes) { const c = ['#3a3a40', '#c4182c', '#d8a02a', '#2a7bff'][look.brakes || 0]; O.caliper.matcap.dispose(); O.caliper.matcap = TX.matcap('paint', c); O.caliper.needsUpdate = true; O.caliper.userData.base = c; N.caliper.uniforms.base.value.set(c); }
    const gc = look.glow ? new THREE.Color(look.glow).multiplyScalar(0.9) : new THREE.Color(0, 0, 0);
    this.glow.material.uniforms.color.value.copy(gc); this.glow.visible = !!look.glow;
    this.rideDrop = 0.025 * (look.ride || 0);
    if (force || prev.carbon !== look.carbon) this.damageKey = '';
  }
  // paint per vertex: dents and scuffs where the damage is, and the carbon bonnet. The weights are worked out at build;
  // the normals follow the dents a moment later (update(), at most four times a second), so a scrape along a wall
  // costs a pass of multiply-adds, not a re-shading of the whole body every hit.
  setDamage(d) {
    const key = ['engine', 'fl', 'fr', 'rl', 'rr', 'body'].map((k) => (d[k] || 0).toFixed(2)).join(',') + (this.look.carbon ? 'c' : '');
    if (key === this.damageKey) return; this.damageKey = key;
    const pos = this.bodyGeo.attributes.position, col = this.bodyGeo.attributes.color, Bp = this.basePos, Bc = this.baseCol, W = this.dmgW, N = this.dmgNoise, CB = this.carbonW;
    const coat = this.bodyGeo.attributes.coat, C0 = this.baseCoat; // 11-26: the clear coat dulls and roughens where it is hurt
    const amt = this.dmgCorners.map(([k]) => Math.max(0, d[k] || 0)), sx = this.dmgCorners.map(([, cx]) => (cx !== 0 ? -Math.sign(cx) * 0.08 : 0)), sz = this.dmgCorners.map(([, , cz]) => -Math.sign(cz) * 0.1);
    const body = (d.body || 0) * 0.25, carbon = !!this.look.carbon;
    let dented = false;
    for (let i = 0, n = pos.count; i < n; i++) {
      let dx = 0, dz = 0, dark = body * N[i];
      for (let k = 0; k < 5; k++) { if (!amt[k]) continue; const f = W[i * 5 + k] * amt[k]; dx += sx[k] * f; dz += sz[k] * f; dark += f * 0.7; }
      if (dx || dz || dark) dented = true;
      pos.setXYZ(i, Bp[i * 3] + dx, Bp[i * 3 + 1] - dark * 0.02, Bp[i * 3 + 2] + dz);
      const v = 1 - clamp(dark, 0, 0.6);
      if (carbon && CB[i]) col.setXYZ(i, CB[i], CB[i], CB[i] * 1.1); else col.setXYZ(i, v * Bc[i * 3], v * 0.97 * Bc[i * 3 + 1], v * 0.95 * Bc[i * 3 + 2]);
      coat.setXY(i, C0[i] * (1 - clamp(dark * 1.3, 0, 0.75)), clamp(dark * 0.9, 0, 0.6));
    }
    pos.needsUpdate = true; col.needsUpdate = true; coat.needsUpdate = true;
    if (dented) this.normalsDirty = true;
    else { this.bodyGeo.attributes.normal.array.set(this.baseNor); this.bodyGeo.attributes.normal.needsUpdate = true; this.normalsDirty = false; }
  }
  // 11-26, Settings > Car reflections. mode 'off': the matcaps (the cars before 11-26); 'course' or 'live': the finishes
  // under reflection (carpaint.js), reading env (a cube map) of size px a face. high: the high tier's extras (the road's
  // pools in the sills, and on a wet road the lamps mirrored in it); wet: the course's road shines (the neon city).
  setReflect(mode, env, size, high = false, wet = false) {
    const want = mode === 'off' ? 'old' : 'new';
    if (want !== this.active) {
      const from = this.sets[this.active], to = this.sets[want];
      this.group.traverse((o) => { const m = o.material, k = m && m.userData && m.userData.key; if (k && from[k] === m) o.material = to[k]; });
      for (const m of Object.values(to)) m.needsUpdate = true; // compiled with the look's fog now (look.js epoch)
      this.active = want; this.mats = to;
    }
    this.uCar.envMap.value = env; this.uCar.envBias.value = Math.log2(256 / (size || 256));
    const on = want === 'new' && high;
    this.uCar.groundK.value = on ? 1 : 0;
    this.wet.visible = on && wet; // only a wet road (the neon city) holds a lamp's image; on a dry one it read as stray lights
    const u = this.wet.material.uniforms; u.k.value = 0.55; u.stretch.value = 1; u.size.value = 2.4;
  }
  // what a reflection of this car must leave out when it is not the car being reflected (a rival in your paint):
  // its additive glows and pools, sized for the screen
  fxParts() { return [this.halo, this.flame, this.wet, this.pool, this.glow]; }
  // car: the physics state; light: the baked light under it (linear rgb); dt
  update(car, light, dt) {
    this.normalsT += dt;
    if (this.normalsDirty && this.normalsT > 0.25) { this.bodyGeo.computeVertexNormals(); this.normalsDirty = false; this.normalsT = 0; }
    this.group.position.set(car.x, car.y, car.z);
    this.group.rotation.y = car.psi;
    // springs: lean against the cornering load, squat and dive with throttle and brake; coilovers sit it lower and firmer
    const stiff = 1 - 0.25 * (this.look.ride || 0);
    const roll = clamp(car.ay * 0.0085 * stiff, -0.07, 0.07), pitch = clamp(-car.ax * 0.006 * stiff, -0.05, 0.05);
    this.body.rotation.z += (roll - this.body.rotation.z) * Math.min(1, dt * 8);
    this.body.rotation.x += (pitch - this.body.rotation.x) * Math.min(1, dt * 8);
    this.body.position.y = -Math.abs(this.body.rotation.z) * 0.4 - (this.rideDrop || 0);
    const g = car.track.grade[car.trackI] || 0, tx = car.track.tx[car.trackI], tz = car.track.tz[car.trackI];
    this.group.rotation.x = -Math.atan(g) * (Math.sin(car.psi) * tx + Math.cos(car.psi) * tz);
    for (let k = 0; k < 4; k++) { const w = this.wheels[k]; if (k < 2) w.pivot.rotation.y = car.delta; w.spin.rotation.x = car.wheelRot; }
    // the lamp light under the car brightens it; the hue stays the paint's (a little warmth, no colour cast)
    const lum = 0.2126 * light[0] + 0.7152 * light[1] + 0.0722 * light[2];
    const k = clamp(0.62 + lum * 0.95, 0.62, 1.55);
    this._c.setRGB(k, k * 0.985, k * 0.97);
    for (const m of this.tintables) m.color.copy(this._c);
    // 11-26: the finishes under reflection read the same light, where the car is (its own pools under it, high tier),
    // and the lamps' mirror images sit on the road the car is on
    const U = this.uCar;
    U.tint.value.copy(this._c); U.carPos.value.set(car.x, car.y, car.z); U.carDir.value.set(Math.sin(car.psi), Math.cos(car.psi));
    if (this.glow.visible) U.glowCol.value.copy(this.glow.material.uniforms.color.value); else U.glowCol.value.setRGB(0, 0, 0);
    if (this.wet.visible) this.wet.material.uniforms.roadY.value = car.y;
    // brake lights and their halos
    const br = car.brake > 0.1 || car.handbrake > 0.1 ? 1 : 0;
    this.tailMat.color.setRGB(0.5 + br * 1.2, 0.004 + br * 0.035, 0.008 + br * 0.04);
    const hc = this.halo.geometry.attributes.color, hb = this.haloBase;
    for (let i = this.tailIdx; i < hc.count; i++) hc.setXYZ(i, hb[i * 3] * (0.55 + br * 0.9), hb[i * 3 + 1], hb[i * 3 + 2]);
    hc.needsUpdate = true;
    // exhaust flame: the straight pipe pops on a lift at high revs; nitrous burns blue while it flows
    const lift = this.lastThr > 0.6 && car.throttle < 0.15 && car.rpm > car.T.car.redline * 0.6;
    this.lastThr = car.throttle;
    if (lift && (this.look.exhaust || 0) >= 2) this.flameT = 0.22;
    this.flameT = Math.max(0, this.flameT - dt);
    const fc = this.flame.geometry.attributes.color, flick = 0.6 + 0.4 * Math.random();
    for (let i = 0; i < fc.count; i++) {
      if (car.nosOn) fc.setXYZ(i, 0.4 * flick, 0.55 * flick, 2.2 * flick);
      else if (this.flameT > 0) { const a = this.flameT / 0.22 * flick; fc.setXYZ(i, 2.2 * a, 0.9 * a, 0.2 * a); }
      else fc.setXYZ(i, 0, 0, 0);
    }
    fc.needsUpdate = true;
  }
}
// an additive soft ellipse on the road (headlight pool, underglow)
function poolMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: color } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 color; varying vec2 vUv; void main() { vec2 q = (vUv - 0.5) * 2.0; float d = dot(q, q); float a = exp(-d * 3.0) * (1.0 - smoothstep(0.7, 1.0, d)); gl_FragColor = vec4(color * a, 1.0); }',
  });
}
// 11-26, high tier: a lamp mirrored in the road. Its mirror image lies under the road; it is drawn where the eye's ray
// to it meets the road (just above it, so the road never hides it and the car still does), at the size its true
// distance gives, and only from the side the lamp faces (head lamps forward, tail lamps back: the car's own body hides
// the others): a thin streak from the road under the lamp down to its image, the way lights lie on a wet street (stretch
// 1; stretch 0, a round soft glow, was the first try on every course and read as stray lights on a dry road, so only
// the wet neon city shows them now). vp: the drawing buffer's size (main.js resize).
export const WET_VP = { value: new THREE.Vector2(1, 1) };
function wetMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { roadY: { value: 0 }, k: { value: 0.2 }, stretch: { value: 0 }, size: { value: 1.4 }, vp: WET_VP },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSize; attribute vec3 color; uniform float roadY; uniform float k; uniform float size; uniform float stretch; uniform vec2 vp;
      varying vec3 vC; varying float vWr;
      void main() {
        vec3 L = (modelMatrix * vec4(position, 1.0)).xyz, M = vec3(L.x, 2.0 * roadY - L.y, L.z), C = cameraPosition;
        vec3 P = C + (M - C) * clamp((roadY + 0.04 - C.y) / min(M.y - C.y, -1e-3), 0.0, 1.0);
        vec3 face = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, position.z > 0.0 ? 1.0 : -1.0));
        float vis = smoothstep(0.05, 0.35, dot(face, normalize(C - L)));
        vec4 cp = projectionMatrix * viewMatrix * vec4(P, 1.0), cf = projectionMatrix * viewMatrix * vec4(L.x, roadY + 0.04, L.z, 1.0);
        vec2 b = cp.xy / cp.w, a = cf.xy / max(cf.w, 1e-3);
        float lampPx = aSize * size * 300.0 / max(length(M - C), 0.5);
        float px = mix(lampPx, max(lampPx, length((a - b) * vp * 0.5) * 1.35), stretch);
        gl_Position = vec4(mix(b, (a + b) * 0.5, stretch) * cp.w, cp.z, cp.w);
        gl_PointSize = clamp(px, 2.0, 220.0);
        vWr = clamp(lampPx * 0.28 / max(px, 1.0), 0.03, 1.0);
        vC = color * k * vis;
      }`,
    fragmentShader: `uniform float stretch; varying vec3 vC; varying float vWr;
      void main() { vec2 q = (gl_PointCoord - 0.5) * 2.0;
        float soft = exp(-dot(q, q) * 4.0) * (1.0 - smoothstep(0.75, 1.0, length(q)));
        float streak = exp(-q.x * q.x / (vWr * vWr) * 1.5) * exp(-(q.y - 0.45) * (q.y - 0.45) * 2.5) * (1.0 - smoothstep(0.85, 1.0, abs(q.y))); // brightest near the image
        float a = mix(soft, streak, stretch);
        if (a < 0.004) discard; gl_FragColor = vec4(vC * a, 1.0); }`,
  });
}
// soft additive points that keep a sensible size on screen (lamp halos, flames)
function haloMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float aSize; attribute vec3 color; varying vec3 vC; void main() { vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aSize * 300.0 / -mv.z, 2.0, 90.0); }',
    fragmentShader: 'varying vec3 vC; void main() { vec2 q = gl_PointCoord - 0.5; float d = dot(q, q) * 4.0; float a = (exp(-d * 7.0) + 0.25 * exp(-d * 2.5)) * (1.0 - smoothstep(0.6, 1.0, d)); if (a < 0.004) discard; gl_FragColor = vec4(vC * a, 1.0); }',
  });
}
