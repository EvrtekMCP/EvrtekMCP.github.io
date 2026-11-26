// DRIFTLINE region 2, Canyon: a hot dusk in red rock country. A huge banded sun low in a magenta sky, terraced
// sandstone walls rising beside the road and flat-topped mesas beyond, cacti and scrub on the floor, boulders at the
// road's edge, a line of telephone poles, a water tower and a roadside gas stop under a neon sun.
import * as THREE from '../../vendor/three/three.module.min.js?v=0.1.20';
import { sstep, fbm, colorGeom, mergeGeoms } from '../world.js?v=0.1.20';
import * as K from './kit.js?v=0.1.20';

const C = (h) => new THREE.Color(h);

export function look() {
  return {
    pal: {
      zenith: '#1c0b2a', sky: '#4a1a52', horizonAway: '#c84a5a', horizonSun: '#ffb34a', sunCore: '#fff4c8',
      fog: '#7a3a52', fogSun: '#ffa060', skyAmb: '#8a5a8a', groundAmb: '#4a2024', sunLight: '#ffb478',
      asphalt: '#4e4448', line: '#f6e6cc', concrete: '#a88a78', rail: '#c8b8a8',
      grass: '#9a4630', rock: '#b25a3a', sand: '#c88452', seaDeep: '#1a0a1a', sodium: '#ffb35a', led: '#ffe0b0',
    },
    sun: [0.55, 0.13, -0.83], sunK: 1.5, ambK: 0.6,
    sky: { disc: 0.12, bands: true, clouds: 0.5, stars: 0.4 },
    water: { kind: 'none' },
    fogDensity: 0.0019,
    road: { runoff: ['#b8642e', '#e8d2b0'], kerb: ['#b01818', '#e8dccc'], glare: 0.6 },
  };
}

export function lamps(ctx) {
  const { track, PAL } = ctx, lp = [0, 0, 0], lq = [0, 0, 0];
  // a lamp on the outside of every tight bend, and a few along the start straight
  const spots = [];
  for (const zn of track.zones) if (zn.peak > 1 / 45) spots.push([zn.s0 + zn.len * zn.apexT, -zn.side]);
  for (let s = 30; s < 160; s += 45) spots.push([s, 1]);
  for (const [s, side] of spots) {
    const i = Math.floor(track.wrapS(s) / track.step) % track.n, half = track.half[i];
    track.point(s, side * (half + 1.7), lp); track.point(s, side * (half - 0.7), lq);
    const c = PAL.sodium;
    ctx.lamps.push({ x: lq[0], y: lq[1] + 7.4, z: lq[2], r: c.r, g: c.g, b: c.b, i: 1.3, range: 22 });
    ctx.mounts.push({ x: lp[0], y: lp[1], z: lp[2], ax: lq[0] - lp[0], az: lq[2] - lp[2], style: 'arm', color: c });
    ctx.glow(lq[0], lq[1] + 7.65, lq[2], c, 5.5);
  }
}

// terraced sandstone: rises are cut into strata eight metres deep
const terrace = (h, step = 8) => { const f = h / step, i = Math.floor(f), t = f - i; return (i + sstep(0.3, 1, t)) * step; };

export function terrain(ctx) {
  const { PAL } = ctx;
  return {
    margin: 470, blend: 26,
    height(x, z, mem, e) {
      const floor = mem + (fbm(x * 0.02, z * 0.02) - 0.5) * 3;
      // canyon walls: rise steeply beyond 30-60 m of the road, in strata
      const wall = sstep(34 + fbm(x * 0.01, z * 0.01) * 40, 130, e) * (26 + fbm(x * 0.006 + 3, z * 0.006) * 70);
      // mesas: flat-topped blocks standing out on the floor
      const mesa = sstep(0.55, 0.58, fbm(x * 0.0032 + 11, z * 0.0032 - 4)) * (60 + fbm(x * 0.001, z * 0.001) * 90) * sstep(60, 140, e);
      return floor + terrace(Math.max(wall, mesa));
    },
    albedo(x, z, h, slope, e) {
      if (slope < 0.12 && e < 60) { const c = PAL.sand.clone().lerp(PAL.grass, 0.35 + 0.3 * fbm(x * 0.03, z * 0.03)); return [c.r, c.g, c.b]; }
      // strata: red, rust, cream bands by height
      const band = ((h * 0.16 + fbm(x * 0.01, z * 0.01) * 0.6) % 3 + 3) % 3;
      const c = band < 1 ? PAL.rock.clone() : band < 2 ? C('#8a3a2a') : C('#d8a070');
      if (slope < 0.2) c.lerp(PAL.sand, 0.5);
      return [c.r, c.g, c.b];
    },
  };
}

export function wall(ctx) {
  const c = ctx.PAL.concrete;
  return { prof: 'block', color: [c.r, c.g, c.b], k: 0.85, reflect: [1.0, 0.6, 0.2] };
}

export function dress(ctx) {
  const { R, hAt, PAL, track } = ctx;
  const steep = (x, z, d = 5) => Math.abs(hAt(x + d, z) - hAt(x - d, z)) + Math.abs(hAt(x, z + d) - hAt(x, z - d));
  // saguaros and scrub on the floor
  const cact = K.scatter(ctx, Math.round(700 * ctx.dense), (x, z) => { const e = ctx.edge(x, z); if (e < 4 || e > 420 || steep(x, z) > 3) return false; if (!ctx.clear(x, z, 0.5)) return false; return [x, z, 5 + R() * 6, [0.9 + R() * 0.2, 0.9, 0.85]]; });
  K.cards(ctx, K.cactusArt(ctx), cact, { name: 'cacti', light: 1.5 });
  const scrub = K.scatter(ctx, Math.round(1100 * ctx.dense), (x, z) => { const e = ctx.edge(x, z); if (e < 2.5 || e > 380 || steep(x, z) > 5) return false; if (!ctx.clear(x, z, 0.4, 0.8)) return false; return [x, z, 1.4 + R() * 2.2, [1, 0.9, 0.8]]; });
  K.cards(ctx, K.bushArt(ctx), scrub, { name: 'scrub', aspect: 1, light: 1.4, sink: 0.15, trunk: 0.3 });
  // boulders: tumbled at the road's edge and along the foot of the walls
  const rk = [];
  for (let s = 0; s < track.length; s += 7) {
    const i = Math.floor(s / track.step) % track.n;
    for (const side of [1, -1]) {
      if (R() < 0.55) continue;
      const p = track.point(s, side * (track.half[i] + 2.2 + R() * 14)), r = 0.7 + R() * 2.6;
      if (!ctx.clear(p[0], p[2], r)) continue;
      rk.push([p[0], p[2], r, 0.55 + R() * 0.4, PAL.rock.clone().multiplyScalar(0.75 + R() * 0.25)]);
    }
  }
  const foot = K.scatter(ctx, Math.round(500 * ctx.dense), (x, z) => { const s = steep(x, z, 6); if (s < 6 || s > 30) return false; const r = 2 + R() * 6; if (!ctx.clear(x, z, r, 2)) return false; return [x, z, r, 0.7, PAL.rock.clone().multiplyScalar(0.8)]; });
  K.rocks(ctx, rk.concat(foot), { name: 'boulders', seed: 21 });
  // telephone poles along the first long stretch, ten metres off the road
  const poles = [];
  for (let s = 40; s < track.length * 0.55; s += 42) {
    const i = Math.floor(s / track.step) % track.n, p = track.point(s, -(track.half[i] + 11));
    if (!ctx.clear(p[0], p[2], 0.6, 6) || steep(p[0], p[2]) > 6) { if (poles.length > 1) break; continue; }
    poles.push([p[0], p[2]]);
  }
  K.poleLine(ctx, poles, { height: 8.5 });
  // the gas stop by the start: a canopy on legs, a shop with a neon sun over the door, a water tower behind
  const st = findSpot(ctx, 40, 22, 30);
  if (st) {
    const [x, z, a] = st, ca = Math.cos(a), sa = Math.sin(a), y = ctx.ground(x, z, 14) - 0.2;
    K.buildings(ctx, [[x + sa * 10, z + ca * 10, 16, 6, 10, a, C('#d8b8a0'), 0.7]], { name: 'shop', floor: 3, bay: 2.4 });
    const parts = [];
    const canopy = new THREE.BoxGeometry(20, 0.8, 10); canopy.rotateY(a); canopy.translate(x - sa * 5, y + 5.6, z - ca * 5); parts.push(colorGeom(canopy, C('#e8e0d8'), 1));
    for (const [lx, lz] of [[-8, -9], [8, -9], [-8, -1], [8, -1]]) { const g = new THREE.BoxGeometry(0.4, 5.6, 0.4); g.translate(x + lx * ca + lz * sa, y + 2.8, z - lx * sa + lz * ca); parts.push(colorGeom(g, C('#3a2a2a'), 1)); }
    ctx.root.add(Object.assign(new THREE.Mesh(mergeGeoms(parts), new THREE.MeshBasicMaterial({ vertexColors: true })), { name: 'gas' }));
    for (let k = -2; k <= 2; k++) ctx.glow(x - sa * 5 + ca * k * 4, y + 5.1, z - ca * 5 - sa * k * 4, [1, 0.95, 0.85], 3);
    ctx.lamps.push({ x: x - sa * 5, y: y + 5, z: z - ca * 5, r: 1, g: 0.9, b: 0.8, i: 1, range: 18 }); // (after the bake: a glow only)
    K.signs(ctx, [[x + sa * 4.9, y + 7.6, z + ca * 4.9, a, 6, 6, 0, PAL.horizonSun], [x + sa * 4.9 + ca * 6, y + 4, z + ca * 4.9 - sa * 6, a, 2.4, 2.4, 1, C('#36f2ff')]]);
    ctx.placed.push({ x: x - sa * 5, z: z - ca * 5, r: 9, y0: y, what: 'canopy' });
    waterTower(ctx, x + sa * 30 + ca * 14, z + ca * 30 - sa * 14);
  }
  // billboards facing the road with a neon picture each (no words)
  const bb = [];
  for (const frac of [0.3, 0.62, 0.85]) {
    const s = track.length * frac, i = Math.floor(s / track.step) % track.n, side = track.curvSmooth[i] > 0 ? -1 : 1;
    const p = track.point(s, side * (track.half[i] + 16)); if (!ctx.clear(p[0], p[2], 6, 4)) continue;
    bb.push([p[0], p[2], track.psi[i] + (side > 0 ? -0.6 : 0.6) + Math.PI]);
  }
  const parts = [], signs = [];
  for (const [x, z, a] of bb) {
    const y = ctx.ground(x, z, 5) - 0.2;
    for (const lx of [-4, 4]) { const g = new THREE.BoxGeometry(0.4, 9, 0.4); g.translate(x + lx * Math.cos(a), y + 4.5, z - lx * Math.sin(a)); parts.push(colorGeom(g, C('#2a1e22'), 1)); }
    const board = new THREE.BoxGeometry(11, 5.5, 0.4); board.rotateY(a); board.translate(x, y + 9.5, z); parts.push(colorGeom(board, C('#140c14'), 1));
    signs.push([x + Math.sin(a) * 0.3, y + 9.5, z + Math.cos(a) * 0.3, a, 5, 5, [0, 1, 4][signs.length % 3], [PAL.horizonSun, C('#36f2ff'), C('#ff3fa4')][signs.length % 3]]);
    ctx.placed.push({ x, z, r: 5.5, y0: y, what: 'billboard' });
  }
  if (parts.length) ctx.root.add(Object.assign(new THREE.Mesh(mergeGeoms(parts), new THREE.MeshBasicMaterial({ vertexColors: true })), { name: 'billboards' }));
  K.signs(ctx, signs, { name: 'billboard-signs' });
  // far ranches: a few warm lights out on the floor
  for (let k = 0; k < 120 * ctx.dense; k++) { const a = R() * 6.28, r = 700 + R() * 600; ctx.glow(ctx.bbox.cx + Math.sin(a) * r, ctx.memAt(ctx.bbox.cx, ctx.bbox.cz) + 2 + R() * 6, ctx.bbox.cz + Math.cos(a) * r, [1, 0.72, 0.4], 5 + R() * 4); }
}

// a flat spot beside the first straight: [x, z, facing] or null
function findSpot(ctx, s0, off, r) {
  const { track } = ctx;
  for (let s = s0; s < s0 + 200; s += 12) {
    const i = Math.floor(s / track.step) % track.n;
    for (const side of [1, -1]) {
      const p = track.point(s, side * (track.half[i] + off));
      if (!ctx.clear(p[0], p[2], r * 0.6, 3)) continue;
      const h = ctx.hAt(p[0], p[2]); let ok = true;
      for (let a = 0; a < 8 && ok; a++) if (Math.abs(ctx.hAt(p[0] + Math.cos(a) * r * 0.6, p[2] + Math.sin(a) * r * 0.6) - h) > 2.5) ok = false;
      if (ok) return [p[0], p[2], track.psi[i] + (side > 0 ? Math.PI / 2 : -Math.PI / 2)];
    }
  }
  return null;
}

function waterTower(ctx, x, z) {
  if (!ctx.clear(x, z, 5, 2)) return;
  const y = ctx.ground(x, z, 4) - 0.2, parts = [];
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { const g = new THREE.BoxGeometry(0.35, 16, 0.35); g.translate(x + dx * 0.8, y + 8, z + dz * 0.8); parts.push(colorGeom(g, C('#3a2a28'), 1)); }
  const tank = new THREE.CylinderGeometry(4.2, 4.2, 6, 16); tank.translate(x, y + 19, z); parts.push(colorGeom(tank, C('#b8a898'), 1));
  const roof = new THREE.ConeGeometry(4.6, 2.4, 16); roof.translate(x, y + 23.2, z); parts.push(colorGeom(roof, C('#7a4a3a'), 1));
  ctx.root.add(Object.assign(new THREE.Mesh(mergeGeoms(parts), new THREE.MeshBasicMaterial({ vertexColors: true })), { name: 'water-tower' }));
  ctx.glow(x, y + 24.8, z, [1, 0.1, 0.05], 2.4, 0.7);
  ctx.placed.push({ x, z, r: 4, y0: y, what: 'water tower' });
}

export function far(ctx) {
  // mesas and buttes all round: flat tops, sheer sides
  const mesa = (seed, lo, hi) => (a, k) => { const n = fbm(k * 0.035 + seed, seed), t = n > 0.5 ? 1 : n > 0.44 ? (n - 0.44) / 0.06 : 0; return 20 + t * (lo + (hi - lo) * fbm(Math.floor(k / 9) * 0.3, seed)); };
  void ctx;
  return [
    { r: 2300, lo: '#3a1630', hi: '#9a4a4a', span: 300, seg: 300, shape: mesa(5, 120, 260) },
    { r: 1650, lo: '#2a0f22', hi: '#7a3434', span: 240, seg: 300, shape: mesa(17, 70, 170) },
  ];
}
