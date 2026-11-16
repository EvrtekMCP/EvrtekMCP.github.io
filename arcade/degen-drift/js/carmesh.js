// DEGEN DRIFT: the cars you see, built in code (no model files) from the shapes in carbodies.js. A lofted body with its
// arches, a painted cabin with glass set into it (windscreen, side windows, rear glass), panel seams, lamps that glow,
// wheels with spokes, lug nuts, discs and calipers, and each car's own face (lamps, wing, scoop, vents, pipes).
// The paint is a matcap drawn at load: a metallic base whose reflections take the paint's colour, under a clear coat
// that mirrors the sunset at grazing angles. The baked lamp light under the car brightens it without shifting its hue.
// Upgrades show: calipers colour with the brakes, coilovers lower it, a carbon bonnet comes with the lightest level,
// the straight pipe pops flame on the lift, nitrous burns blue. It leans on its springs, dents where it hits, and
// smokes from the bonnet when the engine is hurt. Local axes: +z forward, +x left, y up.
import * as THREE from '../vendor/three/three.module.min.js?v=0.1.0';
import * as TX from './textures.js?v=0.1.0';
import { BODIES } from './carbodies.js?v=0.1.0';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sgn = (v) => (v < 0 ? -1 : 1);

// ---------------------------------------------------------------- the shape functions of one body
export function shapeOf(B) {
  const zF = B.L / 2, zR = -B.L / 2, END = 0.36;
  const belt = (z) => z > B.zScreen ? B.cowlH - (z - B.zScreen) * (B.cowlH - B.noseH) / (zF - B.zScreen)
    : z > B.tailStart ? B.cowlH + (B.zScreen - z) * (B.deckH - B.cowlH) / (B.zScreen - B.tailStart)
      : B.deckH + (B.tailStart - z) * B.tailKick;
  const endSq = (z) => { const d = Math.max(z - (zF - END), (zR + END) - z); return d > 0 ? Math.sqrt(Math.max(0.1, 1 - (d / (END + 0.01)) ** 2)) : 1; };
  const halfW = (z) => (B.half + B.fF * Math.exp(-(((z - B.axleF) / B.fFw) ** 2)) + B.fR * Math.exp(-(((z - B.axleR) / B.fRw) ** 2))) * (0.55 + 0.45 * endSq(z));
  const roofTop = B.roofH - 0.03 * (B.zRoofF - B.zRoofR);
  const roof = (z) => z > B.zRoofF ? B.roofH - (z - B.zRoofF) / (B.zScreen - B.zRoofF) * (B.roofH - belt(B.zScreen))
    : z > B.zRoofR ? B.roofH - (B.zRoofF - z) * 0.03
      : roofTop - (B.zRoofR - z) / (B.zRoofR - B.zGlassEnd) * (roofTop - belt(B.zGlassEnd));
  // a point on the body's skin: ph = 0 the left flank's widest, pi/2 the top centre, pi the right flank, -pi/2 under
  const section = (z, ph) => {
    const w = halfW(z), sq = endSq(z), top = belt(z), bot = B.ride + (1 - sq) * 0.16;
    const yc = (top + bot) / 2, hh = (top - bot) / 2 * (0.6 + 0.4 * sq);
    const c = Math.cos(ph), s = Math.sin(ph), n = B.n;
    const tuck = 1 - 0.12 * Math.max(0, s) - 0.16 * Math.max(0, -s) ** 1.5;
    return [sgn(c) * Math.pow(Math.abs(c), 2 / n) * w * tuck, yc + sgn(s) * Math.pow(Math.abs(s), 2 / n) * hh];
  };
  // the cabin's section: base on the belt, the roof's shoulders, its crown
  const cabin = (z) => {
    const b = belt(z) - 0.012, t = Math.max(b + 0.01, roof(z)), wb = halfW(z) * 0.86, wt = B.roofW;
    return [[wb, b], [wt + 0.06, t - 0.07], [wt * 0.75, t], [-wt * 0.75, t], [-wt - 0.06, t - 0.07], [-wb, b]];
  };
  return { B, zF, zR, belt, halfW, endSq, roof, section, cabin };
}

// ---------------------------------------------------------------- geometry helpers
function geo(pos, idx, color) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (idx) g.setIndex(idx);
  if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(1), 3));
  g.computeVertexNormals(); return g;
}
function mergeNI(list) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = parts.reduce((a, g) => a + g.attributes.position.count, 0), arr = new Float32Array(total * 3);
  let o = 0; for (const g of parts) { arr.set(g.attributes.position.array, o); o += g.attributes.position.array.length; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(arr, 3)); out.computeVertexNormals(); return out;
}
// a strip through pairs of points (rows of [a, b])
function strip(rows) {
  const pos = [], idx = [];
  rows.forEach(([a, b]) => pos.push(...a, ...b));
  for (let k = 0; k < rows.length - 1; k++) { const i = k * 2; idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
  return geo(pos, idx);
}

function loftBody(S) {
  const ZS = 36, M = 28, pos = [], idx = [];
  const zAt = (k) => S.zR + (S.zF - S.zR) * (k / (ZS - 1));
  for (let k = 0; k < ZS; k++) { const z = zAt(k); for (let m = 0; m < M; m++) { const [x, y] = S.section(z, (m / M) * Math.PI * 2); pos.push(x, y, z); } }
  for (let k = 0; k < ZS - 1; k++) for (let m = 0; m < M; m++) { const a = k * M + m, b = k * M + (m + 1) % M, c = a + M, d = b + M; idx.push(a, b, c, b, d, c); }
  const cap = (k, flip) => { const c = pos.length / 3; let y = 0; for (let m = 0; m < M; m++) y += pos[(k * M + m) * 3 + 1]; pos.push(0, y / M, zAt(k)); for (let m = 0; m < M; m++) { const a = k * M + m, b = k * M + (m + 1) % M; if (flip) idx.push(c, b, a); else idx.push(c, a, b); } };
  cap(0, true); cap(ZS - 1, false);
  return geo(pos, idx, true);
}
function loftCabin(S) {
  const B = S.B, ZS = 18, rows = [];
  for (let k = 0; k < ZS; k++) { const z = B.zScreen - (B.zScreen - B.zGlassEnd) * (k / (ZS - 1)); rows.push(S.cabin(z).map(([x, y]) => [x, y, z])); }
  const pos = [], idx = [], P = 6;
  for (const r of rows) for (const p of r) pos.push(...p);
  for (let k = 0; k < ZS - 1; k++) for (let m = 0; m < P - 1; m++) { const a = k * P + m, b = a + 1, c = a + P, d = c + 1; idx.push(a, c, b, b, c, d); }
  return geo(pos, idx, true);
}
// the glass set into the cabin: windscreen, rear glass, side windows (split by the B-pillar), a few mm proud
function glassPanels(S) {
  const B = S.B, parts = [], lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const across = (z, u0, u1, lift) => { // points across the crown, shoulder to shoulder
    const c = S.cabin(z), line = [c[1], c[2], c[3], c[4]], segs = [];
    let L = 0; for (let i = 0; i < 3; i++) { const d = Math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]) || 1e-4; segs.push(d); L += d; }
    const at = (u) => { let d = u * L; for (let i = 0; i < 3; i++) { if (d <= segs[i] || i === 2) { const p = lerp(line[i], line[i + 1], Math.min(1, d / segs[i])); return [p[0], p[1] + lift, z]; } d -= segs[i]; } return [0, 0, z]; };
    return [at(u0), at(u1)];
  };
  const sheet = (z0, z1, n, u0, u1) => { const rows = []; for (let k = 0; k <= n; k++) rows.push(across(z0 + (z1 - z0) * k / n, u0, u1, 0.006)); return strip(rows); };
  parts.push(sheet(B.zScreen - 0.04, B.zRoofF + 0.06, 6, 0.04, 0.96));          // windscreen
  parts.push(sheet(B.zRoofR - 0.06, B.zGlassEnd + 0.08, 6, 0.06, 0.94));       // rear glass
  const bz = (B.zRoofF + B.zRoofR) / 2 - 0.12;
  for (const side of [1, -1]) {
    for (const [za, zb] of [[B.zScreen - 0.16, bz + 0.05], [bz - 0.05, Math.max(B.zGlassEnd + 0.22, B.zRoofR - 0.25)]]) {
      const rows = [];
      for (let k = 0; k <= 8; k++) {
        const z = za + (zb - za) * k / 8, c = S.cabin(z), lo = c[side > 0 ? 0 : 5], hi = c[side > 0 ? 1 : 4];
        const a = lerp(lo, hi, 0.12), b = lerp(lo, hi, 0.86);
        rows.push([[a[0] + side * 0.006, a[1], z], [b[0] + side * 0.006, b[1], z]]);
      }
      parts.push(strip(rows));
    }
  }
  return mergeNI(parts);
}
// panel seams: door cuts, the bonnet and boot lid edges (dark hairlines just proud of the paint)
function seams(S) {
  const B = S.B, parts = [], W = 0.009;
  const along = (ph, z0, z1) => { const rows = []; for (let k = 0; k <= 16; k++) { const z = z0 + (z1 - z0) * k / 16, a = S.section(z, ph - 0.02), b = S.section(z, ph + 0.02); rows.push([[a[0] * 1.004, a[1] + 0.002, z], [b[0] * 1.004, b[1] + 0.002, z]]); } return strip(rows); };
  const around = (z, ph0, ph1) => { const rows = []; for (let k = 0; k <= 12; k++) { const ph = ph0 + (ph1 - ph0) * k / 12, p = S.section(z, ph); rows.push([[p[0] * 1.004, p[1], z - W], [p[0] * 1.004, p[1], z + W]]); } return strip(rows); };
  const doorF = B.zScreen - 0.08, doorR = Math.max(B.zRoofR - 0.2, B.zGlassEnd + 0.15);
  for (const z of [doorF, doorR]) { parts.push(around(z, -0.55, 1.15)); parts.push(around(z, Math.PI - 1.15, Math.PI + 0.55)); }
  parts.push(along(1.15, B.zScreen + 0.05, S.zF - 0.22), along(Math.PI - 1.15, B.zScreen + 0.05, S.zF - 0.22)); // bonnet
  parts.push(around(S.zF - 0.22, 1.15, Math.PI - 1.15));
  parts.push(along(1.15, S.zR + 0.2, B.zGlassEnd - 0.05), along(Math.PI - 1.15, S.zR + 0.2, B.zGlassEnd - 0.05)); // boot
  return mergeNI(parts);
}

// ---------------------------------------------------------------- the car
export class CarMesh {
  constructor(look, bodyId = 'kestrel') {
    this.group = new THREE.Group();     // follows the chassis (position, heading)
    this.body = new THREE.Group();      // leans on the springs
    this.group.add(this.body);
    this.mats = {
      paint: new THREE.MeshMatcapMaterial({ matcap: TX.matcap('paint', look.paint), vertexColors: true }),
      glass: new THREE.MeshMatcapMaterial({ matcap: TX.matcap('glass', '#0a0d18'), side: THREE.DoubleSide }),
      trim: new THREE.MeshMatcapMaterial({ matcap: TX.matcap('trim', '#0c0b12') }),
      rubber: new THREE.MeshMatcapMaterial({ matcap: TX.matcap('rubber', '#111') }),
      rim: new THREE.MeshMatcapMaterial({ matcap: TX.matcap('chrome', '#c8ccd8') }),
      disc: new THREE.MeshMatcapMaterial({ matcap: TX.matcap('chrome', '#55585f') }),
      caliper: new THREE.MeshMatcapMaterial({ matcap: TX.matcap('paint', '#3a3a40') }),
      seam: new THREE.MeshBasicMaterial({ color: 0x050307, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      decal: new THREE.MeshMatcapMaterial({ matcap: TX.matcap('paint', '#f4f1f8'), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    };
    this.tintables = [this.mats.paint, this.mats.glass, this.mats.trim, this.mats.rubber, this.mats.rim, this.mats.disc, this.mats.caliper, this.mats.decal];
    this.headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.4, 3.8), side: THREE.DoubleSide });
    this.tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 0.06, 0.12), side: THREE.DoubleSide });
    this.stripeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.6, 1.8), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    // the shadow, the headlight pool on the road, the underglow (kept across body swaps)
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 5.1), new THREE.MeshBasicMaterial({ map: TX.shadowBlob(), transparent: true, depthWrite: false, opacity: 0.9 }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.035; sh.renderOrder = 1; this.group.add(sh);
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(5, 18), poolMaterial(new THREE.Color(0.2, 0.22, 0.27)));
    this.pool.rotation.x = -Math.PI / 2; this.pool.position.set(0, 0.05, 12); this.pool.renderOrder = 2; this.group.add(this.pool);
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.2), poolMaterial(new THREE.Color(0, 0, 0)));
    this.glow.rotation.x = -Math.PI / 2; this.glow.position.y = 0.04; this.glow.renderOrder = 2; this.group.add(this.glow);
    // lamp halos and exhaust flames: soft additive points riding on the body
    this.halo = new THREE.Points(new THREE.BufferGeometry(), haloMaterial()); this.halo.frustumCulled = false; this.halo.renderOrder = 6; this.body.add(this.halo);
    this.flame = new THREE.Points(new THREE.BufferGeometry(), haloMaterial()); this.flame.frustumCulled = false; this.flame.renderOrder = 6; this.body.add(this.flame);
    this.bodyId = null; this.look = {}; this.damageKey = ''; this._c = new THREE.Color(); this.flameT = 0; this.lastThr = 0;
    this.build(bodyId, look);
  }

  // ---------------------------------------------------------------- build (or rebuild for another car)
  build(bodyId, look) {
    if (this.parts) for (const o of this.parts) { if (o.parent) o.parent.remove(o); o.geometry.dispose(); }
    this.parts = [];
    const B = BODIES[bodyId] || BODIES.kestrel, S = shapeOf(B);
    this.bodyId = bodyId; this.B = B; this.S = S;
    const add = (g, m, parent = this.body) => { const o = new THREE.Mesh(g, m); parent.add(o); this.parts.push(o); return o; };
    // the skin and the cabin (painted), the glass set in, the seams
    const bg = loftBody(S); this.bodyGeo = bg; this.basePos = Float32Array.from(bg.attributes.position.array);
    add(bg, this.mats.paint);
    add(loftCabin(S), this.mats.paint);
    add(glassPanels(S), this.mats.glass);
    add(seams(S), this.mats.seam);
    // trim: splitter, skirts, diffuser, mirrors, the black tail panel, the grille, scoop, vents, wing, pipes
    const trim = [], box = (w, h, d, x, y, z, rx = 0, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(x, y, z); trim.push(g); };
    const wF = S.halfW(S.zF - 0.3), wR = S.halfW(S.zR + 0.3);
    box(wF * 1.35, 0.03, 0.1, 0, B.ride - 0.005, S.zF - 0.2);
    for (const s of [1, -1]) box(0.05, 0.07, (B.axleF - B.axleR) - 0.8, s * (B.half - 0.07), B.ride + 0.03, (B.axleF + B.axleR) / 2);
    box(wR * 1.3, 0.07, 0.12, 0, B.ride + 0.04, S.zR + 0.24);
    const mz = B.zScreen - 0.18, mw = S.halfW(mz) * 0.97, my = S.belt(mz) + 0.07;
    for (const s of [1, -1]) box(0.13, 0.065, 0.1, s * mw, my, mz);
    box(wR * 1.4, 0.2, 0.05, 0, S.belt(S.zR + 0.05) - 0.12, S.zR + 0.04);
    box(wF * 0.95, 0.1, 0.05, 0, Math.max(B.ride + 0.12, B.noseH * 0.55), S.zF - 0.05);
    if (B.scoop) box(0.5, 0.07, 0.62, 0, S.belt(B.zScreen + 0.55) + 0.03, B.zScreen + 0.55, -0.05);
    if (B.vents) for (const s of [1, -1]) for (let k = 0; k < 3; k++) box(0.02, 0.05, 0.32, s * S.halfW(B.axleF - 0.62), B.ride + 0.25 + k * 0.09, B.axleF - 0.62, 0, s * 0.08);
    const deckY = S.belt(S.zR + 0.3);
    if (B.wing === 'lip') box(wR * 1.5, 0.03, 0.12, 0, deckY + 0.04, S.zR + 0.22, -0.3);
    if (B.wing === 'spoiler') box(wR * 1.6, 0.05, 0.16, 0, deckY + 0.08, S.zR + 0.24, -0.2);
    if (B.wing === 'raised') { const wy = deckY + 0.2; box(1.5, 0.03, 0.24, 0, wy, S.zR + 0.28, -0.1); for (const s of [1, -1]) { box(0.03, 0.2, 0.1, s * 0.5, deckY + 0.1, S.zR + 0.3); box(0.02, 0.1, 0.28, s * 0.76, wy - 0.01, S.zR + 0.28); } }
    if (B.lamps === 'quadround') for (const s of [1, -1]) box(S.halfW(S.zF - 0.2) * 0.5, 0.16, 0.06, s * S.halfW(S.zF - 0.2) * 0.6, Math.max(S.belt(S.zF - 0.1) - 0.06, B.ride + 0.2) - 0.01, S.zF - 0.1, 0, s * 0.3);
    if (B.wing === 'gt') { const wy = deckY + 0.36; box(1.72, 0.035, 0.3, 0, wy, S.zR + 0.3, -0.08); for (const s of [1, -1]) { box(0.035, 0.36, 0.14, s * 0.55, deckY + 0.18, S.zR + 0.32); box(0.02, 0.16, 0.36, s * 0.87, wy - 0.02, S.zR + 0.3); } }
    this.tips = [];
    const tipY = B.ride + 0.07, tipZ = S.zR + 0.14, tipsAt = { dual: [0.35, 0.5], quad: [0.3, 0.42, -0.3, -0.42], center: [0.07, -0.07], single: [0.45] }[B.exhaust] || [0.4];
    const big = B.exhaust === 'center' ? 0.06 : 0.045;
    for (const x of tipsAt) { const ex = new THREE.CylinderGeometry(big, big, 0.2, 12, 1, true); ex.rotateX(Math.PI / 2); ex.translate(x, tipY, tipZ); trim.push(ex); this.tips.push([x, tipY, tipZ - 0.12]); }
    add(mergeNI(trim), this.mats.trim);
    // lamps
    const disc = (x, y, z, r, ry, rx = 0, sx = 1) => { const g = new THREE.CircleGeometry(r, 16); g.scale(sx, 1, 1); g.rotateX(rx); g.rotateY(ry); g.translate(x, y, z); return g; };
    const bar = (w, h, x, y, z, ry) => { const g = new THREE.PlaneGeometry(w, h); g.rotateY(ry); g.translate(x, y, z); return g; };
    const head = [], halos = [], hz = S.zF - 0.1, hy = Math.max(S.belt(hz) - 0.06, B.ride + 0.2);
    const lampX = (u) => S.halfW(hz - 0.1) * u;
    for (const s of [1, -1]) {
      if (B.lamps === 'twin') { head.push(disc(s * lampX(0.52), hy, hz + 0.04, 0.07, s * 0.32, -0.45), disc(s * lampX(0.72), hy - 0.01, hz - 0.04, 0.065, s * 0.55, -0.45)); halos.push([s * lampX(0.6), hy, hz + 0.07, 1]); }
      if (B.lamps === 'quadround') { for (const u of [0.46, 0.74]) head.push(disc(s * lampX(u), hy, hz + 0.02 - (u - 0.46) * 0.12, 0.06, s * 0.3, -0.1)); halos.push([s * lampX(0.6), hy, hz + 0.07, 1]); }
      if (B.lamps === 'quad') { for (const u of [0.48, 0.72]) head.push(disc(s * lampX(u), hy - 0.03, hz + 0.06, 0.075, s * 0.12, 0)); halos.push([s * lampX(0.6), hy - 0.03, hz + 0.09, 1]); }
      if (B.lamps === 'slim') { head.push(bar(0.42, 0.045, s * lampX(0.62), hy, hz + 0.02, s * 0.45)); head.push(bar(0.3, 0.02, s * lampX(0.6), hy - 0.06, hz + 0.04, s * 0.4)); halos.push([s * lampX(0.62), hy, hz + 0.06, 0.9]); }
      if (B.lamps === 'pods') { head.push(bar(0.3, 0.03, s * lampX(0.6), hy + 0.01, hz - 0.02, s * 0.35)); head.push(disc(s * lampX(0.4), hy - 0.07, hz + 0.07, 0.035, s * 0.15)); halos.push([s * lampX(0.55), hy, hz + 0.02, 0.8]); }
      if (B.lamps === 'round') { head.push(disc(s * lampX(0.62), hy + 0.02, hz - 0.1, 0.11, s * 0.5, -0.6, 0.85)); halos.push([s * lampX(0.62), hy + 0.02, hz - 0.06, 1.1]); }
    }
    add(mergeNI(head), this.headMat);
    const tail = [], tailHalos = [], tz = S.zR + 0.012, ty = S.belt(tz + 0.05) - 0.12;
    const tX = (u) => S.halfW(tz + 0.12) * u;
    for (const s of [1, -1]) {
      if (B.tails === 'twin') { tail.push(disc(s * tX(0.48), ty, tz, 0.075, Math.PI), disc(s * tX(0.7), ty, tz + 0.02, 0.075, Math.PI - s * 0.2)); tailHalos.push([s * tX(0.6), ty, tz - 0.03]); }
      if (B.tails === 'triple') { for (const u of [0.42, 0.6, 0.78]) tail.push(disc(s * tX(u), ty, tz + 0.01, 0.055, Math.PI)); tailHalos.push([s * tX(0.6), ty, tz - 0.03]); }
      if (B.tails === 'bar' || B.tails === 'slimbar') { tail.push(bar(tX(0.36), B.tails === 'bar' ? 0.07 : 0.035, s * tX(0.6), ty, tz - 0.003, Math.PI)); tailHalos.push([s * tX(0.66), ty, tz - 0.03]); }
    }
    if (B.tails === 'wide') { tail.push(bar(tX(1.6), 0.08, 0, ty, tz - 0.003, Math.PI)); tailHalos.push([tX(0.6), ty, tz - 0.03], [-tX(0.6), ty, tz - 0.03]); }
    if (B.tails === 'bar') tail.push(bar(tX(0.7), 0.02, 0, ty, tz - 0.003, Math.PI));
    add(mergeNI(tail), this.tailMat);
    // the car's own pinstripe, along each flank at the shoulder
    if (B.pinstripe) {
      const pts = [];
      for (const s of [1, -1]) { const r = []; for (let k = 0; k <= 40; k++) { const z = S.zR + 0.35 + (S.zF - S.zR - 0.6) * k / 40, p = S.section(z, s > 0 ? 0.62 : Math.PI - 0.62); r.push([[p[0] * 1.006, p[1] - 0.012, z], [p[0] * 1.006, p[1] + 0.012, z]]); } pts.push(strip(r)); }
      this.stripeMat.color.set(B.pinstripe).multiplyScalar(1.8);
      add(mergeNI(pts), this.stripeMat);
    }
    this.decalMesh = null;
    // halos for lamps (head white-blue, tail red)
    const hp = [], hc = [], hs = [];
    const ht = B.headTint || [0.9, 0.95, 1.0];
    for (const h of halos) { hp.push(h[0], h[1], h[2]); hc.push(ht[0], ht[1], ht[2]); hs.push(1.1 * (h[3] || 1)); }
    this.headMat.color.setRGB(3.4 * ht[0], 3.4 * ht[1], 3.4 * ht[2]);
    this.tailIdx = hp.length / 3;
    for (const t of tailHalos) { hp.push(t[0], t[1], t[2]); hc.push(1.0, 0.08, 0.12); hs.push(0.8); }
    const hg = this.halo.geometry; hg.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3)); hg.setAttribute('color', new THREE.Float32BufferAttribute(hc, 3)); hg.setAttribute('aSize', new THREE.Float32BufferAttribute(hs, 1));
    this.haloBase = Float32Array.from(hc);
    const fp = [], fc = [], fs = []; for (const t of this.tips) { fp.push(...t); fc.push(0, 0, 0); fs.push(0.7); }
    const fg = this.flame.geometry; fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3)); fg.setAttribute('aSize', new THREE.Float32BufferAttribute(fs, 1));
    this.buildWheels(look.rim || 'spoke');
    this.damageKey = '';
    this.look = {};
    this.setLook(look, true);
  }
  decalGeom(kind) {
    if (!kind || kind === 'none') return null;
    const S = this.S, B = this.B, parts = [];
    if (kind === 'stripes') {
      for (const [a, b] of [[1.38, 1.48], [Math.PI - 1.48, Math.PI - 1.38]]) {
        const body = (z0, z1) => { const r = []; for (let k = 0; k <= 18; k++) { const z = z0 + (z1 - z0) * k / 18, p = S.section(z, a), q = S.section(z, b); r.push([[p[0] * 1.004, p[1] + 0.004, z], [q[0] * 1.004, q[1] + 0.004, z]]); } return strip(r); };
        parts.push(body(B.zScreen + 0.02, S.zF - 0.06), body(S.zR + 0.06, B.zGlassEnd - 0.02));
      }
      for (const u of [[0.1, 0.2], [-0.2, -0.1]]) { const r = []; for (let k = 0; k <= 18; k++) { const z = B.zRoofF + 0.04 - (B.zRoofF - B.zRoofR + 0.08) * k / 18, y = S.roof(z) + 0.008; r.push([[u[0], y, z], [u[1], y, z]]); } parts.push(strip(r)); }
    }
    if (kind === 'spear') {
      for (const s of [1, -1]) { const r = []; for (let k = 0; k <= 24; k++) { const z = S.zF - 0.5 - (S.zF - S.zR - 0.9) * k / 24, h = 0.05 * (1 - k / 24) + 0.012, p = S.section(z, s > 0 ? 0.15 : Math.PI - 0.15); r.push([[p[0] * 1.006, p[1] - h, z], [p[0] * 1.006, p[1] + h, z]]); } parts.push(strip(r)); }
    }
    return parts.length ? mergeNI(parts) : null;
  }
  buildWheels(style) {
    for (const w of this.wheels || []) this.group.remove(w.pivot);
    this.wheels = [];
    const B = this.B, R = B.wheelR, W = B.tireW;
    const prof = []; for (let k = 0; k <= 10; k++) { const a = k / 10 * Math.PI; prof.push(new THREE.Vector2(R - 0.075 + Math.sin(a) * 0.075, -W / 2 + (1 - Math.cos(a)) / 2 * W)); }
    const tire = new THREE.LatheGeometry(prof, 22); tire.rotateZ(Math.PI / 2);
    const rr = R * 0.76, parts = [];
    const lip = new THREE.CylinderGeometry(rr, rr, style === 'dish' ? 0.06 : 0.035, 24, 1, true); lip.rotateZ(Math.PI / 2); lip.translate(W * 0.36, 0, 0); parts.push(lip);
    const spokes = style === 'mesh' ? 14 : style === 'dish' ? 6 : 5;
    for (let k = 0; k < spokes; k++) { const sp = new THREE.BoxGeometry(0.03, style === 'mesh' ? 0.014 : 0.05, rr * 0.9); sp.translate(W * 0.38, 0, rr * 0.48); sp.rotateX(k / spokes * Math.PI * 2 + (style === 'mesh' ? (k % 2 ? 0.4 : -0.4) : 0)); parts.push(sp); }
    const cap = new THREE.CylinderGeometry(0.05, 0.06, 0.04, 14); cap.rotateZ(Math.PI / 2); cap.translate(W * 0.4, 0, 0); parts.push(cap);
    for (let k = 0; k < 5; k++) { const n = new THREE.CylinderGeometry(0.011, 0.011, 0.03, 6); n.rotateZ(Math.PI / 2); n.translate(W * 0.42, Math.cos(k * 1.2566) * 0.08, Math.sin(k * 1.2566) * 0.08); parts.push(n); }
    const rim = mergeNI(parts);
    const disc = new THREE.CylinderGeometry(rr * 0.92, rr * 0.92, 0.025, 22); disc.rotateZ(Math.PI / 2); disc.translate(W * 0.1, 0, 0);
    const cal = new THREE.BoxGeometry(0.07, 0.11, 0.2); cal.translate(W * 0.2, rr * 0.55, -0.06);
    for (const [x, z] of [[B.track / 2, B.axleF], [-B.track / 2, B.axleF], [B.track / 2, B.axleR], [-B.track / 2, B.axleR]]) {
      const pivot = new THREE.Group(); pivot.position.set(x, R, z);
      const spin = new THREE.Group(); pivot.add(spin);
      const side = x > 0 ? 1 : -1;
      const tm = new THREE.Mesh(tire, this.mats.rubber), rm = new THREE.Mesh(rim, this.mats.rim), dm = new THREE.Mesh(disc, this.mats.disc), cm = new THREE.Mesh(cal, this.mats.caliper);
      for (const m of [tm, rm, dm]) { m.scale.x = side; spin.add(m); }
      cm.scale.x = side; pivot.add(cm);
      this.group.add(pivot);
      this.wheels.push({ pivot, spin });
    }
  }
  // look: { paint, rim, smoke, glow, decal, brakes (0-3), ride (0-2), carbon (bool), exhaust (0-2) }
  setLook(look, force = false) {
    const prev = this.look || {};
    this.look = look;
    if (force || prev.paint !== look.paint) { if (this.mats.paint.matcap) this.mats.paint.matcap.dispose(); this.mats.paint.matcap = TX.matcap('paint', look.paint); this.mats.paint.needsUpdate = true; }
    if (force || prev.rim !== look.rim) {
      this.mats.rim.matcap.dispose();
      this.mats.rim.matcap = TX.matcap(look.rim === 'mesh' ? 'gold' : 'chrome', look.rim === 'mesh' ? '#c99a3a' : '#c8ccd8'); this.mats.rim.needsUpdate = true;
      if (!force) this.buildWheels(look.rim);
    }
    if (force || prev.decal !== look.decal) {
      if (this.decalMesh) { this.decalMesh.parent.remove(this.decalMesh); this.decalMesh.geometry.dispose(); this.parts = this.parts.filter((o) => o !== this.decalMesh); this.decalMesh = null; }
      const g = this.decalGeom(look.decal); if (g) { this.decalMesh = new THREE.Mesh(g, this.mats.decal); this.body.add(this.decalMesh); this.parts.push(this.decalMesh); }
    }
    if (force || prev.brakes !== look.brakes) { const c = ['#3a3a40', '#c4182c', '#d8a02a', '#2a7bff'][look.brakes || 0]; this.mats.caliper.matcap.dispose(); this.mats.caliper.matcap = TX.matcap('paint', c); this.mats.caliper.needsUpdate = true; }
    const gc = look.glow ? new THREE.Color(look.glow).multiplyScalar(0.9) : new THREE.Color(0, 0, 0);
    this.glow.material.uniforms.color.value.copy(gc); this.glow.visible = !!look.glow;
    this.rideDrop = 0.025 * (look.ride || 0);
    if (force || prev.carbon !== look.carbon) this.damageKey = '';
  }
  // paint per vertex: dents and scuffs where the damage is, and the carbon bonnet
  setDamage(d) {
    const key = ['engine', 'fl', 'fr', 'rl', 'rr', 'body'].map((k) => (d[k] || 0).toFixed(2)).join(',') + (this.look.carbon ? 'c' : '');
    if (key === this.damageKey) return; this.damageKey = key;
    const pos = this.bodyGeo.attributes.position, col = this.bodyGeo.attributes.color, Bp = this.basePos, B = this.B, S = this.S;
    const fz = S.zF - 0.3, rz = S.zR + 0.3, fw = S.halfW(fz), rw = S.halfW(rz);
    const corners = [['fl', fw, fz], ['fr', -fw, fz], ['rl', rw, rz], ['rr', -rw, rz], ['engine', 0, S.zF + 0.1]];
    for (let i = 0; i < pos.count; i++) {
      const x = Bp[i * 3], y = Bp[i * 3 + 1], z = Bp[i * 3 + 2];
      let dx = 0, dz = 0, dark = (d.body || 0) * 0.25 * (0.5 + 0.5 * Math.sin(x * 23 + z * 17));
      for (const [k, cx, cz] of corners) {
        const amt = d[k] || 0; if (amt <= 0) continue;
        const f = Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / 0.35) * amt;
        if (cx !== 0) dx -= Math.sign(cx) * f * 0.08;
        dz -= Math.sign(cz) * f * 0.1; dark += f * 0.7;
      }
      pos.setXYZ(i, x + dx, y - dark * 0.02, z + dz);
      const v = 1 - clamp(dark, 0, 0.6); let cr = v, cg = v * 0.97, cb = v * 0.95;
      // the carbon bonnet: the top of the nose ahead of the screen goes nearly black, a weave under the clear coat
      if (this.look.carbon && z > B.zScreen + 0.02 && y > S.belt(z) - 0.08 && Math.abs(x) < S.halfW(z) * 0.82) { const w = 0.07 + 0.03 * ((Math.floor(x * 40) + Math.floor(z * 40)) & 1); cr = w; cg = w; cb = w * 1.1; }
      col.setXYZ(i, cr, cg, cb);
    }
    pos.needsUpdate = true; col.needsUpdate = true; this.bodyGeo.computeVertexNormals();
  }
  // car: the physics state; light: the baked light under it (linear rgb); dt
  update(car, light, dt) {
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
    // brake lights and their halos
    const br = car.brake > 0.1 || car.handbrake > 0.1 ? 1 : 0;
    this.tailMat.color.setRGB(2.0 + br * 4.0, 0.06 + br * 0.15, 0.12 + br * 0.2);
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
// soft additive points that keep a sensible size on screen (lamp halos, flames)
function haloMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float aSize; attribute vec3 color; varying vec3 vC; void main() { vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aSize * 300.0 / -mv.z, 2.0, 90.0); }',
    fragmentShader: 'varying vec3 vC; void main() { vec2 q = gl_PointCoord - 0.5; float d = dot(q, q) * 4.0; float a = (exp(-d * 7.0) + 0.25 * exp(-d * 2.5)) * (1.0 - smoothstep(0.6, 1.0, d)); if (a < 0.004) discard; gl_FragColor = vec4(vC * a, 1.0); }',
  });
}
