// DRIFTLINE region 2, Canyon: a hot dusk in red rock country. A huge banded sun low in a magenta sky, terraced
// sandstone walls rising beside the road and flat-topped mesas beyond, cacti and scrub on the floor, boulders at the
// road's edge, a line of telephone poles, a water tower and a roadside gas stop under a neon sun.
import * as THREE from '../../vendor/three/three.module.min.js?v=0.1.22';
import { sstep, fbm, colorGeom, mergeGeoms } from '../world.js?v=0.1.22';
import * as K from './kit.js?v=0.1.22';
import * as D from './detail.js?v=0.1.22';
import * as P from './props.js?v=0.1.22';

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
    road: { runoff: ['#b8642e', '#e8d2b0'], kerb: ['#b01818', '#e8dccc'], glare: 0.6, sunSheen: 0.42, mirage: 0.6 },
    // 11-26 Full: high wisps of cloud set alight by the huge sun, and its rays through the dust
    skyFull: { scale: 0.11, cover: [0.49, 0.72], k: 0.8, hi: 0.62, drift: [0.003, 0.001], shadow: '#4a1a46', lit: '#ffb060', rays: 0.4 },
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

// ================================================================ 11-26 Full detail (graphics uplift part 2)
// Settings > World detail > Full. Nothing above changes; this adds, with its own dice (ctx.R2): oil pumpjacks nodding
// out on the floor and a ranch windpump turning, hoodoo spires, a barbed-wire fence along the first stretch, warning
// signs before the bends (pictures, no words), drums, tyres and a flag at the gas stop, dust devils far out, dust on
// the wind, the heat's mirage on the road ahead (look.road.mirage), and pools of light under the lamps and the neon.
export function dressFull(ctx) {
  const { R2: R, hAt, track, PAL } = ctx, lite = ctx.lite, free = D.occupancy(ctx);
  const steep = (x, z, d = 5) => Math.abs(hAt(x + d, z) - hAt(x - d, z)) + Math.abs(hAt(x, z + d) - hAt(x, z - d));
  const open = (x, z, r, pad = 2) => ctx.clear(x, z, r, pad) && free(x, z, r) && steep(x, z, Math.max(3, r)) < 2.5;
  // pumpjacks on the floor, 30-160 m out, nodding at their own pace
  const jacks = [];
  for (let k = 0; k < (lite ? 2 : 5); k++) {
    const sp = D.besideRoad(ctx, (x, z) => open(x, z, 4.2, 4), { reach: [30, 160], tries: 600 }); if (!sp) continue;
    free.take(sp[0], sp[1], 4.5); jacks.push([sp[0], sp[1], R() * 6.28, 1, null]);
  }
  D.movers(ctx, 'pumpjacks', P.pumpjack(), jacks, (t, k) => [Math.sin(t * (0.9 + k * 0.13) + k * 1.7) * 0.32, 0, 0], { aoH: 3 });
  for (const j of jacks) ctx.pools.push([j[0], j[1], 9, 9, 0, 0.12, [1, 0.7, 0.4]]);
  // windpumps by the ranch lights, their wheels turning in the evening wind
  const pumps = [];
  for (let k = 0; k < (lite ? 1 : 3); k++) {
    const sp = D.besideRoad(ctx, (x, z) => open(x, z, 2.2, 3), { reach: [16, 90], tries: 600 }); if (!sp) continue;
    free.take(sp[0], sp[1], 2.4); pumps.push([sp[0], sp[1], R() * 6.28, 1, null]);
  }
  D.movers(ctx, 'windpumps', P.windpump(), pumps, (t, k) => [0, 0, -t * (1.6 + k * 0.4)], { aoH: 6 });
  // hoodoos: tall stacked spires of the red rock, out on the floor
  const hoo = [];
  for (let k = 0; k < (lite ? 6 : 16); k++) {
    const sp = D.besideRoad(ctx, (x, z) => open(x, z, 3, 3), { reach: [18, 140], tries: 300 }); if (!sp) continue;
    free.take(sp[0], sp[1], 3); const r = 1.4 + R() * 1.6, c = PAL.rock.clone().multiplyScalar(0.75 + R() * 0.3);
    hoo.push([sp[0], sp[1], r, 2.6 + R() * 1.8, c]);
    if (R() < 0.6) hoo.push([sp[0] + (R() - 0.5) * r, sp[1] + (R() - 0.5) * r, r * 0.55, 3.5, c.clone().multiplyScalar(1.1)]);
  }
  K.rocks(ctx, hoo, { name: 'hoodoos', seed: 61 });
  // a barbed-wire ranch fence along the outside of the first long stretch, 8 m off the wall
  const fence = [];
  for (let s = 20; s < track.length * 0.45; s += 7) {
    const i = Math.floor(s / track.step) % track.n, p = track.point(s, track.half[i] + 8.5);
    if (!ctx.clear(p[0], p[2], 0.3, 4) || !free(p[0], p[2], 0.4) || steep(p[0], p[2], 3) > 3) { if (fence.length > 6) break; fence.length = 0; continue; }
    fence.push([p[0], p[2]]);
  }
  if (fence.length > 6) K.poleLine(ctx, fence, { height: 1.4, wires: 3, color: '#3a2a22', name: 'ranch-fence' });
  // warning signs before the tight bends: the bend's way, a winding road before a hairpin, falling rock under the walls
  const signs = { posts: [], faces: [] };
  for (const zn of track.zones) {
    if (zn.peak < 1 / 40 || R() < 0.35) continue;
    const glyph = zn.hairpin ? 2 : zn.side > 0 ? 0 : 1;
    D.roadSign(ctx, zn.s0 - 45, R() < 0.5 ? 1 : -1, glyph, signs) || D.roadSign(ctx, zn.s0 - 52, 1, glyph, signs);
  }
  for (let k = 0; k < 3; k++) { const s = R() * track.length, i = Math.floor(s / track.step) % track.n; for (const side of [1, -1]) { const p = track.point(s, side * (track.half[i] + 6)); if (hAt(p[0], p[2]) - track.y[i] > 5) { D.roadSign(ctx, s - 20, side, 4, signs); break; } } }
  D.place(ctx, 'sign-posts', P.signPost(), signs.posts, { audit: false, aoH: 2.4 }); D.signFaces(ctx, signs.faces);
  // the gas stop: a stack of tyres, drums and a flag (found by its canopy)
  const gas = ctx.placed.find((p) => p.what === 'canopy');
  if (gas) {
    const kit = { tyre: [], drum: [] }, poles = [], fl = [];
    for (let k = 0; k < 14; k++) {
      const a = R() * 6.28, d = 11 + R() * 6, x = gas.x + Math.cos(a) * d, z = gas.z + Math.sin(a) * d;
      if (!ctx.clear(x, z, 0.6, 1) || !free(x, z, 0.7) || steep(x, z, 2) > 1.5) continue;
      free.take(x, z, 0.7); (R() < 0.5 ? kit.tyre : kit.drum).push([x, z, R() * 6.28, 1, [C('#b8302a'), C('#2a5aa8'), C('#e0b020')][Math.floor(R() * 3)]]);
    }
    D.place(ctx, 'gas-tyres', P.tyres(4), kit.tyre.map((t) => [t[0], t[1], t[2], 1, null])); D.place(ctx, 'gas-drums', P.drum(), kit.drum, { aoH: 0.9 });
    for (let k = 0; k < 2; k++) { const a = R() * 6.28, x = gas.x + Math.cos(a) * 14, z = gas.z + Math.sin(a) * 14; if (!ctx.clear(x, z, 0.3, 1.5) || !free(x, z, 0.5)) continue; const y = ctx.ground(x, z, 0.2) - 0.05; poles.push([x, z, 0, 1, null, y]); free.take(x, z, 0.5); fl.push([x, y + 7.6, z, R() * 6.28, 2.2, 1.3, [C('#ffb34a'), C('#36f2ff')][k]]); }
    D.place(ctx, 'flag-poles', P.flagPole(), poles, { aoH: 2 }); D.flags(ctx, fl, { gust: 0.8 });
    ctx.pools.push([gas.x, gas.z, 26, 26, 0, 0.5, [1, 0.88, 0.7]]);
  }
  // light: under the lamps, and the billboards' neon on the ground beneath them
  D.lampPools(ctx, { k: 0.3 });
  for (const B of ctx.placed) if (B.what === 'billboard') ctx.pools.push([B.x, B.z, 14, 14, 0, 0.35, [1, 0.45, 0.6]]);
  // dust devils far out on the floor, and dust on the wind round you
  const devils = [];
  for (let k = 0; k < (lite ? 1 : 3); k++) { const sp = D.besideRoad(ctx, (x, z) => open(x, z, 4, 6), { reach: [90, 260], tries: 300 }); if (sp) devils.push([sp[0], ctx.ground(sp[0], sp[1], 2) + 0.5, sp[1], [0.95, 0.62, 0.42]]); }
  D.plumes(ctx, devils, { per: lite ? 12 : 20, height: 30, speed: 0.11, size: [2.5, 7], wind: [0.25, 0, 0.1], tint: [1, 0.85, 0.72], alpha: 0.2, name: 'dust-devils' });
  D.drift(ctx, { kind: 'dust', count: lite ? 50 : 100, box: [60, 4, 60], lo: -0.3, size: 0.07, wind: [4.5, 0.3, 1.5], tint: [0.9, 0.55, 0.38], colors: [[1, 0.85, 0.7], [1, 0.7, 0.5]] });
  D.drift(ctx, { kind: 'leaf', count: lite ? 14 : 30, box: [70, 1.6, 70], lo: -0.25, size: 0.16, wind: [5, 0.1, 1.8], tint: [0.7, 0.45, 0.32], colors: [[0.7, 0.55, 0.35], [0.55, 0.42, 0.3]], name: 'drift-brush' });
}
// mesas farther than the far ones, hazy pink
export function farFull() {
  const mesa = (seed, lo, hi) => (a, k) => { const n = fbm(k * 0.03 + seed, seed), t = n > 0.5 ? 1 : n > 0.45 ? (n - 0.45) / 0.05 : 0; return 15 + t * (lo + (hi - lo) * fbm(Math.floor(k / 11) * 0.3, seed)); };
  return [{ r: 2700, lo: '#5a2a48', hi: '#b8606a', span: 320, seg: 300, shape: mesa(29, 140, 300), haze: 1.3 }];
}
