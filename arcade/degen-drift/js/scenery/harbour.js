// DRIFTLINE region 1, Harbour: sunset over the sea, violet sky, LED and neon on the docks, sodium on the pass.
// Two layouts share the look: EMBER BAY PASS ('harbour-pass': 0.1.0's harbour front and the climb through the pines,
// now with rock and forest close to the road) and the closed docks (DRYDOCK RUN, SALT PIER CIRCUIT: a flat yard on
// the water, container stacks, gantry cranes on the quay, a ship alongside, floodlight masts, the city across the bay).
import * as THREE from '../../vendor/three/three.module.min.js?v=0.1.19';
import { sstep, fbm, colorGeom, mergeGeoms } from '../world.js?v=0.1.19';
import * as K from './kit.js?v=0.1.19';

const C = (h) => new THREE.Color(h);
const pass = (ctx) => ctx.course.dressing === 'harbour-pass';

export function look(course) {
  return {
    pal: {}, // the harbour is the base palette (look.js)
    sun: course.sun || [-0.62, 0.105, -0.78],
    sky: { disc: 0.085, bands: true, clouds: 0.85, stars: 1 },
    water: { kind: 'sea', level: course.seaLevel ?? -1.6 },
    fogDensity: 0.0024,
    road: { runoff: ['#b8283a', '#e6dcd8'], kerb: ['#c00a12', '#d8d2cc'] },
  };
}

// ---------------------------------------------------------------- lamps
export function lamps(ctx) {
  const { track, PAL } = ctx, lp = [0, 0, 0], lq = [0, 0, 0];
  for (let s = 18, k = 0; s < track.length - 10; k++) {
    const i = Math.floor(s / track.step) % track.n, kind = track.kind[i], half = track.half[i];
    const curv = track.curvSmooth[i];
    const sides = kind === 0 ? [1, -1] : [Math.abs(curv) > 1 / 300 ? -Math.sign(curv) : (k % 2 ? 1 : -1)];
    for (const side of sides) {
      track.point(s, side * (half + 1.7), lp); track.point(s, side * (half - 0.7), lq);
      const col = kind === 0 ? (side > 0 ? PAL.led : PAL.neonPink.clone().lerp(PAL.led, 0.55)) : PAL.sodium;
      ctx.lamps.push({ x: lq[0], y: lq[1] + 7.4, z: lq[2], r: col.r, g: col.g, b: col.b, i: kind === 0 ? 1.15 : 1.35, range: 21 });
      ctx.mounts.push({ x: lp[0], y: lp[1], z: lp[2], ax: lq[0] - lp[0], az: lq[2] - lp[2], style: 'arm', color: col });
      ctx.glow(lq[0], lq[1] + 7.65, lq[2], col, 5.5);
    }
    s += kind === 0 ? 30 : 38;
  }
  if (pass(ctx)) return;
  // the docks: floodlight masts in the yard, away from the road, a wide pool of cold light each
  const B = ctx.bbox;
  for (let x = B.minX - 40; x <= B.maxX + 40; x += 70) for (let z = B.minZ - 40; z <= B.maxZ + 40; z += 70) {
    const px = x + (ctx.R() - 0.5) * 20, pz = z + (ctx.R() - 0.5) * 20, e = ctx.edge(px, pz);
    if (e < 9 || e > 60) continue;
    const c = PAL.led.clone().lerp(new THREE.Color(1, 1, 1), 0.4);
    ctx.lamps.push({ x: px, y: 18, z: pz, r: c.r, g: c.g, b: c.b, i: 1.0, range: 42 });
    ctx.mounts.push({ x: px, y: 0.35, z: pz, ax: 1, az: 0, style: 'mast', color: c });
    for (const dx of [-1.2, 0, 1.2]) ctx.glow(px + dx, 17.6, pz, c, 4.5);
  }
}

// ---------------------------------------------------------------- the land
export function terrain(ctx) {
  const { PAL, bbox: B } = ctx;
  if (pass(ctx)) {
    // EMBER BAY: 0.1.0's land, unchanged: the harbour flat, the shore, hills rising to the north
    const cx = B.cx;
    const shoreZ = (x) => -50 + 20 * Math.sin(x / 170 + 0.5) + 10 * Math.sin(x / 61 + 1.7);
    const harbour = (x, z) => x > -255 && x < 300 && z < 40 && z > -90;
    ctx.harbourRect = harbour;
    return {
      margin: 536, shiftZ: 150, blend: 48,
      height(x, z) {
        if (harbour(x, z)) return z > -21 ? 0.35 : -7;
        const d = z - shoreZ(x), land = sstep(-30, 35, d);
        const hills = fbm(x * 0.0042 + 3.1, z * 0.0042 - 1.7) * 62 + fbm(x * 0.013, z * 0.013 + 9) * 12;
        const north = Math.max(0, z - 280) * 0.45 + Math.max(0, z - 620) * 0.6;
        const flanks = Math.max(0, Math.abs(x - cx) - 420) * 0.32;
        return -9 + (11 + hills * 0.8 + north + flanks) * land;
      },
      albedo(x, z, h, slope) {
        if (harbour(x, z) && h > -1) return [0.11, 0.1, 0.13];
        if (h < 1.6 && h > -3) return [PAL.sand.r, PAL.sand.g, PAL.sand.b];
        const c = PAL.grass.clone().lerp(PAL.rock, sstep(0.18, 0.42, slope) + sstep(150, 260, h)); return [c.r, c.g, c.b];
      },
    };
  }
  // the docks: a flat yard wherever the road runs (and the infield), the sea beyond, low hills far behind
  const dock = (x, z, e) => e < 78 || (x > B.minX - 30 && x < B.maxX + 30 && z > B.minZ - 30 && z < B.maxZ + 30);
  ctx.dock = dock;
  return {
    margin: 520, blend: 10,
    height(x, z, mem, e) {
      if (dock(x, z, e)) return -0.5;
      const far = Math.hypot(x - B.cx, z - B.cz);
      // a far shore of low hills round part of the bay, otherwise open water
      const hill = sstep(780, 1100, far) * (0.5 + 0.5 * Math.sin(Math.atan2(x - B.cx, z - B.cz) * 2 + 1)) * (20 + fbm(x * 0.006, z * 0.006) * 70);
      return -7 + hill;
    },
    albedo(x, z, h, slope, e) {
      if (h > 0) {
        if (h > 6) { const c = PAL.grass.clone().lerp(PAL.rock, sstep(0.2, 0.5, slope)); return [c.r, c.g, c.b]; }
        // yard concrete with tyre-worn patches and painted bays
        const v = 0.85 + 0.3 * fbm(x * 0.05, z * 0.05);
        const bay = (Math.abs(((x * 0.25) % 6) - 3) < 0.08 || Math.abs(((z * 0.25) % 13) - 6.5) < 0.08) && e > 10 ? 1.9 : 1;
        return [0.12 * v * bay, 0.11 * v * bay, 0.14 * v * bay];
      }
      return [PAL.sand.r * 0.6, PAL.sand.g * 0.6, PAL.sand.b * 0.6];
    },
  };
}

// ---------------------------------------------------------------- the walls: barriers with neon on the docks, rails on the pass
export function wall(ctx, kind, side) {
  const { PAL } = ctx;
  if (kind === 1) return { prof: 'rail', color: [PAL.rail.r, PAL.rail.g, PAL.rail.b], reflect: [1.0, 0.55, 0.15], posts: true };
  return { prof: 'barrier', color: [PAL.concrete.r, PAL.concrete.g, PAL.concrete.b], k: 0.8, strip: side > 0 ? PAL.neonCyan : PAL.neonPink };
}

// ---------------------------------------------------------------- dressing
export function dress(ctx) {
  if (pass(ctx)) dressPass(ctx); else dressDocks(ctx);
  cityAcrossTheBay(ctx);
}

function containerPalette() { return ['#7a2f3a', '#2f4f7a', '#2f6a5f', '#8a6a2a', '#5a3a6a', '#3a3a44', '#a0442a', '#2a5a8a'].map(C); }

function dressPass(ctx) {
  const { R, PAL, track, hAt } = ctx;
  // pines (0.1.0's forest) and, new, a denser stand right up to the rails on the pass and round the hairpin
  const list = [];
  const want = Math.round(2600 * ctx.dense);
  for (let tries = 0; tries < want * 6 && list.length < want; tries++) {
    const { x0, z0, ext } = ctx.terrainBox;
    const x = x0 + R() * ext, z = z0 + R() * ext, h = hAt(x, z);
    if (h < 2.2 || ctx.harbourRect(x, z)) continue;
    const e = ctx.edge(x, z);
    if (e < 3.2 || e > 330) continue;
    if (fbm(x * 0.01, z * 0.01) < 0.42 && e > 26) continue; // clumps, but always some close to the road
    const sl = Math.abs(hAt(x + 4, z) - hAt(x - 4, z)) + Math.abs(hAt(x, z + 4) - hAt(x, z - 4));
    if (sl > 9) continue;
    if (!ctx.clear(x, z, 0.6)) continue;
    const s = e < 30 ? 9 + R() * 8 : 7 + R() * 9;
    list.push([x, z, s, [0.75 + R() * 0.4, 0.75 + R() * 0.4, 0.75 + R() * 0.4]]);
  }
  K.cards(ctx, K.pineArt(ctx), list, { name: 'pines' });
  // rock: outcrops on the slopes beside the pass and boulders at the road's edge (the hairpin had nothing)
  const rk = [];
  const rockC = PAL.rock.clone().multiplyScalar(0.9);
  for (let s = 0; s < track.length; s += 9) {
    const i = Math.floor(s / track.step) % track.n; if (track.kind[i] !== 1) continue;
    for (const side of [1, -1]) {
      if (R() < 0.45) continue;
      const lat = side * (track.half[i] + 2.4 + R() * 9), p = track.point(s, lat);
      const r = 0.8 + R() * 2.4; if (!ctx.clear(p[0], p[2], r)) continue;
      rk.push([p[0], p[2], r, 0.55 + R() * 0.5, rockC]);
    }
  }
  const outcrop = K.scatter(ctx, Math.round(260 * ctx.dense), (x, z) => { const h = hAt(x, z); if (h < 8) return false; const sl = Math.abs(hAt(x + 6, z) - hAt(x - 6, z)) + Math.abs(hAt(x, z + 6) - hAt(x, z - 6)); if (sl < 5) return false; const r = 3 + R() * 7; if (!ctx.clear(x, z, r, 3)) return false; return [x, z, r, 0.6 + R() * 0.6, rockC]; });
  K.rocks(ctx, rk.concat(outcrop), { name: 'rocks' });
  // cabins on the slopes with lit windows: life on the hill
  const cabins = K.scatter(ctx, 14, (x, z) => { const h = hAt(x, z); if (h < 10 || ctx.edge(x, z) < 22 || ctx.edge(x, z) > 140) return false; const sl = Math.abs(hAt(x + 6, z) - hAt(x - 6, z)) + Math.abs(hAt(x, z + 6) - hAt(x, z - 6)); if (sl > 6 || !ctx.clear(x, z, 7, 4)) return false; return [x, z, 9 + R() * 5, 5 + R() * 3, 7 + R() * 3, R() * 6.28, C('#3a2a30'), 0.45]; });
  K.buildings(ctx, cabins, { name: 'cabins', floor: 2.8, bay: 2.2 });
  for (const c of cabins) ctx.glow(c[0], ctx.ground(c[0], c[1]) + c[3] + 1, c[1], PAL.sodium, 3);
  // the harbour: containers, sheds, cranes, the quay (0.1.0's, kept)
  const boxesL = [], pal = containerPalette();
  for (let x = -230; x < 270; x += 6.6) {
    if (R() < 0.18) continue;
    for (let row = 0; row < 3; row++) {
      const z = 24 + row * 3.0 + (x > 60 ? 6 : 0), stack = 1 + Math.floor(R() * (row === 0 ? 2 : 4));
      for (let k = 0; k < stack; k++) boxesL.push([x + (R() - 0.5) * 0.4, z, 6.1, 2.6, 2.44, 0, pal[Math.floor(R() * pal.length)], 0.35 + k * 2.6]);
    }
  }
  K.boxes(ctx, boxesL, { name: 'containers', k: 0.9 });
  const sheds = [];
  for (const [x, z, w, h, d] of [[-170, 70, 46, 14, 26], [-105, 92, 30, 22, 20], [-40, 74, 52, 12, 24], [40, 96, 26, 30, 22], [110, 78, 48, 16, 26], [190, 90, 34, 24, 22], [250, 70, 30, 12, 20]]) {
    sheds.push([x, z, w, h, d, 0, C('#2a2236'), 0.3]);
    ctx.glow(x - w / 2, h + 0.3, z - d / 2, PAL.neonPink, 4); ctx.glow(x + w / 2, h + 0.3, z - d / 2, PAL.neonCyan, 4);
  }
  K.buildings(ctx, sheds, { name: 'sheds' });
  quayAndCranes(ctx, [[-150, -21], [-20, -21], [140, -21]], 0);
  const qg = new THREE.BoxGeometry(560, 7.5, 1.2); qg.translate(22, -3.4, -21); colorGeom(qg, new THREE.Color(0.1, 0.09, 0.13), 1);
  const quay = new THREE.Mesh(qg, new THREE.MeshBasicMaterial({ vertexColors: true })); quay.name = 'quay'; ctx.root.add(quay);
}

// gantry cranes on the quay facing the water (angle: which way the boom points), red lamps blinking on top
function quayAndCranes(ctx, spots, angle) {
  const cr = [];
  for (const [x, z, a = angle] of spots) {
    const ca = Math.cos(a), sa = Math.sin(a);
    const T = (g, lx, lz) => { g.rotateY(a); g.translate(x + lx * ca + lz * sa, 0, z - lx * sa + lz * ca); cr.push(g); };
    for (const dx of [-5, 5]) for (const dz of [-3, 6]) { const l = new THREE.BoxGeometry(0.7, 26, 0.7); l.translate(0, 13, 0); T(l, dx, dz); }
    const top = new THREE.BoxGeometry(12, 2.2, 12); top.translate(0, 27, 0); T(top, 0, 1.5);
    const boom = new THREE.BoxGeometry(1.6, 1.6, 52); boom.translate(0, 27.4, 0); T(boom, 0, -18);
    const tie = new THREE.BoxGeometry(0.3, 0.3, 30); tie.rotateX(0.32); tie.translate(0, 32, 0); T(tie, 0, -12);
    ctx.glow(x + 1.5 * sa, 29, z + 1.5 * ca, [1.0, 0.08, 0.05], 2.6, 1); ctx.glow(x - 43 * sa, 28.4, z - 43 * ca, [1.0, 0.08, 0.05], 2.2, 1.3);
    ctx.placed.push({ x, z, r: 6, y0: 0, what: 'crane', skip: true });
  }
  const crane = new THREE.Mesh(mergeGeoms(cr.map((g) => colorGeom(g, new THREE.Color(0.75, 0.3, 0.14), 0.32))), new THREE.MeshBasicMaterial({ vertexColors: true }));
  crane.name = 'cranes'; ctx.root.add(crane);
}

function dressDocks(ctx) {
  const { R, PAL, hAt, track } = ctx;
  const pal = containerPalette();
  // container yards: blocks of stacks on a grid, an aisle every block, never near a wall
  const boxesL = [];
  const B = ctx.bbox;
  for (let x = B.minX - 120; x <= B.maxX + 120; x += 7) for (let z = B.minZ - 120; z <= B.maxZ + 120; z += 3.1) {
    if (Math.floor((x - B.minX) / 7) % 5 === 4 || Math.floor((z - B.minZ) / 3.1) % 6 === 5) continue; // aisles
    if (hAt(x, z) < -0.7 || !ctx.clear(x, z, 3.4, 2.5)) continue;
    if (fbm(x * 0.012 + 4, z * 0.012) < 0.38) continue; // whole yards come and go
    const stack = 1 + Math.floor(R() * R() * 5), base = ctx.ground(x, z, 3.4) - 0.1;
    for (let k = 0; k < stack; k++) boxesL.push([x, z, 6.1, 2.6, 2.44, 0, pal[Math.floor(R() * pal.length)], base + k * 2.6]);
    ctx.placed.push({ x, z, r: 3.3, y0: base, what: 'stack' });
  }
  K.boxes(ctx, boxesL.slice(0, Math.round(5200 * ctx.dense + 800)), { name: 'containers', k: 0.9 });
  // warehouses with lit windows and neon on the roof edge
  const sheds = K.scatter(ctx, 18, (x, z) => { if (hAt(x, z) < -0.7) return false; const w = 30 + R() * 30, d = 18 + R() * 12; if (!ctx.clear(x, z, Math.hypot(w, d) / 2, 4)) return false; return [x, z, w, 10 + R() * 14, d, Math.round(R() * 2) * Math.PI / 2, C('#2a2236'), 0.25]; });
  K.buildings(ctx, sheds, { name: 'sheds' });
  for (const s of sheds) ctx.glow(s[0], s[3] + 0.6, s[1], R() < 0.5 ? PAL.neonPink : PAL.neonCyan, 6);
  // fuel tanks: a cluster of squat cylinders
  const tanks = K.scatter(ctx, 7, (x, z) => { if (hAt(x, z) < -0.7) return false; const r = 7 + R() * 5; if (!ctx.clear(x, z, r, 4)) return false; return [x, ctx.ground(x, z, r) - 0.1, z, 0, r, PAL.concrete.clone().multiplyScalar(0.55)]; });
  const tg = new THREE.CylinderGeometry(1, 1, 1.1, 20); tg.translate(0, 0.55, 0); colorGeom(tg, new THREE.Color(1, 1, 1), 1);
  K.many(ctx, tg, tanks, { name: 'tanks', r: 1 });
  for (const t of tanks) ctx.glow(t[0], t[4] * 1.15, t[2], [1, 0.1, 0.05], 2, 0.8);
  // the quay: cranes where the yard meets the water, rocks along the edge, a ship alongside one of them
  const edge = K.scatter(ctx, 400, (x, z) => { const h = hAt(x, z); if (h > -0.8 || h < -4) return false; return [x, z]; }, 30);
  const rk = edge.filter(([x, z]) => ctx.clear(x, z, 2, 1)).slice(0, 260).map(([x, z]) => [x, z, 1.2 + R() * 1.8, 0.6, PAL.rock.clone().multiplyScalar(0.7)]);
  K.rocks(ctx, rk, { name: 'riprap' });
  const cranes = [];
  for (const [x, z] of edge) {
    if (cranes.length >= 6) break;
    if (cranes.some(([a, b]) => Math.hypot(a - x, b - z) < 90)) continue;
    // the boom points out over the water: away from the land's middle
    const a = Math.atan2(B.cx - x, B.cz - z) + Math.PI;
    const lx = x - Math.sin(a) * 4, lz = z - Math.cos(a) * 4;
    if (!ctx.clear(lx, lz, 9, 3) || hAt(lx, lz) < -0.7) continue;
    cranes.push([lx, lz, a]);
  }
  quayAndCranes(ctx, cranes.map(([x, z, a]) => [x, z, a + Math.PI]), 0);
  // a ship alongside the first crane: hull on the water, a lit bridge house aft
  if (cranes.length) {
    const [x, z, a] = cranes[0], ox = x + Math.sin(a) * 30, oz = z + Math.cos(a) * 30;
    if (hAt(ox, oz) < -2 && ctx.edge(ox, oz) > 40) {
      const hull = new THREE.BoxGeometry(150, 10, 24); hull.rotateY(a); hull.translate(ox, -1.5, oz);
      const fore = new THREE.BoxGeometry(22, 4, 20); fore.rotateY(a); fore.translate(ox + Math.cos(a) * 62, 5, oz - Math.sin(a) * 62);
      const ship = new THREE.Mesh(mergeGeoms([colorGeom(hull, C('#5a1e2a'), 1), colorGeom(fore, C('#5a1e2a'), 1)]), new THREE.MeshBasicMaterial({ vertexColors: true }));
      ship.name = 'ship'; ctx.root.add(ship);
      K.buildings(ctx, [[ox - Math.cos(a) * 55, oz + Math.sin(a) * 55, 18, 16, 22, a, C('#e8e0e8'), 0.6]], { name: 'ship-house' });
      ctx.placed[ctx.placed.length - 1].skip = true; // stands on the deck, over the water
      ctx.root.children[ctx.root.children.length - 1].position.y = 3.5 - (ctx.ground(ox - Math.cos(a) * 55, oz + Math.sin(a) * 55, Math.hypot(18, 22) / 2) - 0.4);
      for (let k = -6; k <= 6; k++) ctx.glow(ox + Math.cos(a) * k * 11, 6.2, oz - Math.sin(a) * k * 11, k % 2 ? PAL.led : PAL.sodium, 2.2);
    }
  }
  // fences of light poles along the yard's edges, bollards on the quay
  void track;
}

function cityAcrossTheBay(ctx) {
  const { R } = ctx, B = ctx.bbox;
  const pass_ = pass(ctx);
  for (let k = 0; k < 900 * ctx.dense; k++) {
    let x, z;
    if (pass_) { x = 500 + R() * 1500; z = -1250 - R() * 260; }
    else { const a = -0.9 + R() * 1.6, r = 1150 + R() * 300; x = B.cx + Math.sin(a + Math.PI) * r; z = B.cz + Math.cos(a + Math.PI) * r; }
    const tower = R() < 0.25 ? R() * 90 : R() * 8;
    const warm = R() < 0.7, c = warm ? [1, 0.7, 0.4] : [0.6, 0.9, 1.0];
    ctx.glow(x, tower + 1, z, c, 6 + R() * 6, R() < 0.1 ? 0.5 + R() : 0);
  }
}

// ---------------------------------------------------------------- the far side
export function far(ctx) {
  if (pass(ctx)) {
    return [[1500, 0.55, '#1e1236', '#5a2f62', 7], [2300, 0.35, '#2a1844', '#8a4a76', 13]].map(([r, hs, lo, hi, seed]) => ({
      r, lo, hi, shape: (a, k, dx, dz) => (60 + fbm(k * 0.09 + seed, seed) * 420 * hs + Math.pow(fbm(k * 0.03, seed * 2), 2) * 300 * hs) * sstep(-0.55, -0.2, dz),
    }));
  }
  // the docks: a low far shore with a skyline across the water (blocks, not peaks)
  return [
    { r: 1700, lo: '#1a1030', hi: '#4a2a5a', shape: (a, k) => 30 + fbm(k * 0.07, 3) * 160 },
    { r: 1450, lo: '#140c26', hi: '#2e1c44', seg: 360, shape: (a, k) => { const b = Math.floor(k / 3); return 8 + ((b * 7919) % 13 < 5 ? 20 + ((b * 104729) % 97) : 0) * (Math.sin(a * 2 + 1) > -0.2 ? 1 : 0.2); } },
  ];
}

// where the title camera drives: along the road (the default)
export function titleShot() { return null; }
