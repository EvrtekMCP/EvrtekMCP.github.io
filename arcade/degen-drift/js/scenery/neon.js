// DRIFTLINE region 4, Neon city: a closed street circuit after dark. Towers whose windows the shader lights, neon
// pictograms on the facades, pink and cyan pools of light on wet asphalt, an elevated rail line crossing the circuit
// on columns, beacons blinking on the rooftops, and a skyline glowing all round.
import * as THREE from '../../vendor/three/three.module.min.js?v=0.1.20';
import { sstep, fbm, colorGeom, mergeGeoms } from '../world.js?v=0.1.20';
import * as K from './kit.js?v=0.1.20';

const C = (h) => new THREE.Color(h);

export function look() {
  return {
    pal: {
      zenith: '#04020c', sky: '#14082c', horizonAway: '#4a1458', horizonSun: '#ff3fa4', sunCore: '#ffd0f0',
      fog: '#2a0c3a', fogSun: '#8a1a6a', skyAmb: '#3a2a62', groundAmb: '#100818', sunLight: '#4a2a7a',
      asphalt: '#2c2834', line: '#f4ecff', concrete: '#5c5672', rail: '#a0a8c8',
      grass: '#16121e', rock: '#2a2638', sand: '#24202e', seaDeep: '#05030f', sodium: '#ffb060', led: '#c8f4ff',
    },
    sun: [0.4, 0.25, 0.88], sunK: 0.35, ambK: 0.6,
    sky: { disc: 0, clouds: 0.4, stars: 0.3, moon: [-0.5, 0.45, -0.73], moonSize: 0.035 },
    water: { kind: 'none' },
    fogDensity: 0.0032,
    road: { runoff: ['#2a3ac8', '#d8dcf0'], kerb: ['#d01860', '#e8e8f0'], sheen: 0.22, glare: 0.25 },
  };
}

export function lamps(ctx) {
  const { track, PAL } = ctx, lp = [0, 0, 0], lq = [0, 0, 0];
  const cols = [PAL.led, PAL.neonPink.clone().lerp(PAL.led, 0.35), PAL.neonCyan.clone().lerp(PAL.led, 0.35)];
  for (let s = 14, k = 0; s < track.length - 8; s += 26, k++) {
    const i = Math.floor(s / track.step) % track.n, half = track.half[i];
    for (const side of [1, -1]) {
      track.point(s, side * (half + 1.7), lp); track.point(s, side * (half - 0.7), lq);
      const c = cols[(k + (side > 0 ? 0 : 1)) % 3];
      ctx.lamps.push({ x: lq[0], y: lq[1] + 7.4, z: lq[2], r: c.r, g: c.g, b: c.b, i: 0.75, range: 19 });
      ctx.mounts.push({ x: lp[0], y: lp[1], z: lp[2], ax: lq[0] - lp[0], az: lq[2] - lp[2], style: 'arm', color: c });
      ctx.glow(lq[0], lq[1] + 7.65, lq[2], c, 5);
    }
  }
  // the signs' spill: coloured pools on the street between the lamps
  for (let s = 27; s < track.length - 8; s += 52) {
    const i = Math.floor(s / track.step) % track.n, side = (Math.floor(s / 52) % 2) ? 1 : -1, c = side > 0 ? PAL.neonPink : PAL.neonCyan;
    track.point(s, side * (track.half[i] + 6), lq);
    ctx.lamps.push({ x: lq[0], y: lq[1] + 5, z: lq[2], r: c.r, g: c.g, b: c.b, i: 0.6, range: 16 });
  }
}

export function terrain(ctx) {
  const { PAL } = ctx;
  return {
    margin: 430, blend: 14,
    height() { return -0.6; },
    albedo(x, z, h, slope, e) {
      // sidewalks along the circuit, dark plazas and lots beyond
      if (e > 0.4 && e < 6) return [PAL.concrete.r * 0.5, PAL.concrete.g * 0.5, PAL.concrete.b * 0.55];
      const v = 0.8 + 0.3 * fbm(x * 0.04, z * 0.04);
      return [0.05 * v, 0.045 * v, 0.07 * v];
    },
  };
}

export function wall(ctx, kind, side) {
  const { PAL } = ctx;
  return { prof: 'barrier', color: [PAL.concrete.r, PAL.concrete.g, PAL.concrete.b], k: 0.9, strip: side > 0 ? PAL.neonCyan : PAL.neonPink };
}

export function dress(ctx) {
  const { R, PAL, track } = ctx;
  // the city: a grid of lots; towers where there is room, taller toward the middle of the circuit
  const B = ctx.bbox, lot = 30, items = [], signs = [];
  const hues = ['#2a2440', '#1e2a3e', '#30223a', '#26262e', '#3a2a40', '#1c2034'].map(C);
  const { x0, z0, ext } = ctx.terrainBox;
  const cx = B.cx, cz = B.cz, spanR = Math.max(B.maxX - B.minX, B.maxZ - B.minZ) / 2;
  for (let gx = x0 + 20; gx < x0 + ext - 20; gx += lot) for (let gz = z0 + 20; gz < z0 + ext - 20; gz += lot) {
    const far = Math.hypot(gx - cx, gz - cz);
    if (far > spanR + 380 || R() < 0.12) continue;
    const w = 12 + R() * 14, d = 12 + R() * 14, rad = Math.hypot(w, d) / 2;
    const x = gx + (R() - 0.5) * 6, z = gz + (R() - 0.5) * 6;
    if (!ctx.clear(x, z, rad, 5)) continue;
    const core = 1 - sstep(spanR * 0.3, spanR + 300, far);
    const h = 10 + R() * 22 + core * (R() < 0.35 ? 40 + R() * 90 : R() * 30);
    items.push([x, z, w, h, d, 0, hues[Math.floor(R() * hues.length)], 0.22 + R() * 0.25]);
    // beacons on the tall ones, a neon pictogram on the face toward the road on the near ones
    if (h > 70) ctx.glow(x, h + 1.5, z, [1, 0.08, 0.05], 3, 0.6 + R());
    const e = ctx.edge(x, z);
    if (e < 50 && R() < 0.7) {
      const nr = ctx.nearRoad(x, z, 3); if (!nr) continue;
      const dx = track.x[nr.i] - x, dz = track.z[nr.i] - z, face = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
      const fx = x + face[0] * (w / 2 + 0.25), fz = z + face[1] * (d / 2 + 0.25), ry = Math.atan2(face[0], face[1]);
      const sz = 4 + R() * 5, sy = Math.min(h - sz / 2 - 1, 6 + R() * 18);
      signs.push([fx, ctx.ground(x, z) + sy, fz, ry, sz, sz, Math.floor(R() * 8), [PAL.neonPink, PAL.neonCyan, C('#ffd23f'), C('#a64bff')][Math.floor(R() * 4)]]);
    }
  }
  K.buildings(ctx, items, { name: 'towers', floor: 3.6, bay: 2.6 });
  K.signs(ctx, signs, { name: 'neon-signs' });
  // roof-edge neon on the low buildings near the road
  for (const b of items) if (b[3] < 30 && ctx.edge(b[0], b[1]) < 40 && R() < 0.5) { const c = R() < 0.5 ? PAL.neonPink : PAL.neonCyan; for (const [ox, oz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) ctx.glow(b[0] + ox * b[2], ctx.ground(b[0], b[1]) + b[3], b[1] + oz * b[4], c, 3.5); }
  // the elevated rail: a straight line across the circuit, 14 m up, columns only where they stand clear of the road
  const ang = R() * Math.PI, ux = Math.sin(ang), uz = Math.cos(ang), L = spanR * 2 + 500, parts = [];
  const deck = new THREE.BoxGeometry(5, 1.6, L); deck.rotateY(ang); deck.translate(cx, 14, cz); parts.push(colorGeom(deck, C('#3a3450'), 1));
  for (let t = -L / 2; t <= L / 2; t += 30) {
    const x = cx + ux * t, z = cz + uz * t; if (!ctx.clear(x, z, 1.6, 2.5)) continue;
    const y = ctx.ground(x, z, 1.2) - 0.2, col = new THREE.BoxGeometry(2.2, 14 - y, 2.2); col.translate(x, y + (14 - y) / 2, z); parts.push(colorGeom(col, C('#2a2638'), 1));
    ctx.placed.push({ x, z, r: 1.6, y0: y, what: 'rail column' });
  }
  for (let t = -L / 2; t <= L / 2; t += 9) ctx.glow(cx + ux * t + uz * 2.4, 14.9, cz + uz * t - ux * 2.4, (Math.round(t / 9) % 2) ? PAL.neonCyan : PAL.neonPink, 1.6);
  // the rail passes over the circuit: keep it high above every part of the road it crosses
  let low = 1e9; for (let i = 0; i < track.n; i += 2) { const dx = track.x[i] - cx, dz = track.z[i] - cz; if (Math.abs(dx * uz - dz * ux) < 6) low = Math.min(low, 14 - 0.8 - track.y[i]); }
  if (low > 6) ctx.root.add(Object.assign(new THREE.Mesh(mergeGeoms(parts), new THREE.MeshBasicMaterial({ vertexColors: true })), { name: 'rail-line' }));
  // a grandstand by the start: tiers facing the straight, lit along the front
  const s = 70, i = Math.floor(s / track.step) % track.n;
  for (const side of [1, -1]) {
    const p = track.point(s, side * (track.half[i] + 14)); if (!ctx.clear(p[0], p[2], 12, 2)) continue;
    const a = track.psi[i], y = ctx.ground(p[0], p[2], 12) - 0.2, tiers = [];
    for (let k = 0; k < 6; k++) { const g = new THREE.BoxGeometry(2.2, 1 + k * 1.1, 40); g.translate(side * (k * 2.2), (1 + k * 1.1) / 2, 0); g.rotateY(a); g.translate(p[0], y, p[2]); tiers.push(colorGeom(g, C('#2a2a3a'), 1)); }
    ctx.root.add(Object.assign(new THREE.Mesh(mergeGeoms(tiers), new THREE.MeshBasicMaterial({ vertexColors: true })), { name: 'grandstand' }));
    for (let k = -18; k <= 18; k += 3) ctx.glow(p[0] + Math.sin(a) * k, y + 1.4, p[2] + Math.cos(a) * k, PAL.led, 2);
    ctx.placed.push({ x: p[0], z: p[2], r: 7, y0: y, what: 'grandstand' });
    break;
  }
  // the skyline beyond: towers of light
  for (let k = 0; k < 1500 * ctx.dense; k++) {
    const a = R() * 6.28, r = spanR + 500 + R() * 900, x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r, h = R() < 0.3 ? R() * 160 : R() * 40;
    ctx.glow(x, h, z, R() < 0.6 ? [1, 0.75, 0.45] : R() < 0.5 ? [0.5, 0.9, 1] : [1, 0.35, 0.75], 5 + R() * 6, R() < 0.04 ? 0.7 : 0);
  }
  void fbm;
}

export function far() {
  // the city to the horizon: blocks of towers, two layers
  const blocks = (seed, base, top) => (a, k) => { const b = Math.floor(k / 2); const r = ((b * 7919 + seed * 131) % 101) / 101; return base + (r > 0.55 ? r * top : r * top * 0.35); };
  return [
    { r: 2200, lo: '#0c0618', hi: '#3a1450', span: 300, seg: 420, shape: blocks(3, 20, 260) },
    { r: 1700, lo: '#08040f', hi: '#24103a', span: 200, seg: 360, shape: blocks(11, 10, 150) },
  ];
}
