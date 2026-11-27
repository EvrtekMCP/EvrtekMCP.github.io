// DRIFTLINE region 1, Harbour: sunset over the sea, violet sky, LED and neon on the docks, sodium on the pass.
// Two layouts share the look: EMBER BAY PASS ('harbour-pass': 0.1.0's harbour front and the climb through the pines,
// now with rock and forest close to the road) and the closed docks (DRYDOCK RUN, SALT PIER CIRCUIT: a flat yard on
// the water, container stacks, gantry cranes on the quay, a ship alongside, floodlight masts, the city across the bay).
import * as THREE from '../../vendor/three/three.module.min.js?v=0.1.25';
import { sstep, fbm, colorGeom, mergeGeoms } from '../world.js?v=0.1.25';
import * as K from './kit.js?v=0.1.25';
import * as D from './detail.js?v=0.1.25';
import * as P from './props.js?v=0.1.25';

const C = (h) => new THREE.Color(h);
const pass = (ctx) => ctx.course.dressing === 'harbour-pass';

export function look(course) {
  return {
    pal: {}, // the harbour is the base palette (look.js)
    sun: course.sun || [-0.62, 0.105, -0.78],
    sky: { disc: 0.085, bands: true, clouds: 0.85, stars: 1 },
    water: { kind: 'sea', level: course.seaLevel ?? -1.6 },
    fogDensity: 0.0024,
    road: { runoff: ['#b8283a', '#e6dcd8'], kerb: ['#c00a12', '#d8d2cc'], sunSheen: 0.34 },
    // 11-26 Full: a deck of sunset cloud, violet bellies and fire on the edges toward the sun, and rays
    skyFull: { scale: 0.15, cover: [0.5, 0.74], k: 0.85, drift: [0.004, 0.0016], shadow: '#3a1f52', lit: '#ff9c5a', rays: 0.32 },
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

// ================================================================ 11-26 Full detail (graphics uplift part 2)
// Settings > World detail > Full. Nothing above changes; this adds, with its own dice (ctx.R2): the quay's working
// kit (forklifts, pallets, drums, spools, cones, bollards, water barriers and a wall of old tyres by the start), two
// ship-to-shore cranes with their trolleys running, work lights in the yards, the lamps and the far shore in the water,
// pools of light under the lamps and the windows, flags on the quay, steam from the ship and the warehouses' vents,
// litter on the wind, and on the pass a better pine.
export function dressFull(ctx) {
  const { PAL } = ctx, R = ctx.R2, lite = ctx.lite, free = D.occupancy(ctx), level = ctx.course.seaLevel ?? -1.6;
  const pal = containerPalette(), kit = { fork: [], pal0: [], pal1: [], pal2: [], drum: [], spool: [], cone: [], bar: [], bol: [], tyre: [] };
  const flat = pass(ctx) ? (x, z) => ctx.harbourRect(x, z) && ctx.hAt(x, z) > 0 : (x, z) => ctx.hAt(x, z) > -0.7 && ctx.hAt(x, z) < -0.2;
  // the working kit, scattered on the flat beside the road (never on it, never on anything else)
  const want = (n) => Math.round(n * (lite ? 0.5 : 1) * (pass(ctx) ? 0.6 : 1));
  const put = (list, n, r, make, reach = [1.5, 26]) => { for (let k = 0; k < want(n); k++) { const sp = D.besideRoad(ctx, (x, z) => flat(x, z) && ctx.clear(x, z, r, 0.6) && free(x, z, r) ? [x, z] : null, { reach }); if (!sp) continue; free.take(sp[0], sp[1], r); list.push(make(sp[0], sp[1])); } };
  put(kit.fork, 14, 1.8, (x, z) => [x, z, R() * 6.28, 1, null]);
  put(kit.pal0, 22, 0.9, (x, z) => [x, z, Math.round(R() * 4) * 1.57 + (R() - 0.5) * 0.2, 1, null]);
  put(kit.pal1, 16, 0.9, (x, z) => [x, z, R() * 6.28, 1, null]);
  put(kit.pal2, 12, 0.9, (x, z) => [x, z, R() * 6.28, 1, null]);
  put(kit.spool, 10, 0.9, (x, z) => [x, z, R() * 6.28, 0.8 + R() * 0.5, null]);
  for (let k = 0; k < want(16); k++) { // drums come in huddles
    const sp = D.besideRoad(ctx, (x, z) => flat(x, z) && ctx.clear(x, z, 1.6, 0.6) && free(x, z, 1.6) ? [x, z] : null, { reach: [2, 24] }); if (!sp) continue; free.take(sp[0], sp[1], 1.6);
    const c = [C('#2a5aa8'), C('#b8302a'), C('#e0b020'), C('#2a7a4a'), C('#5a5a62')][Math.floor(R() * 5)];
    for (let q = 0, n = 2 + Math.floor(R() * 4); q < n; q++) kit.drum.push([sp[0] + (q % 2) * 0.62 - 0.3, sp[1] + Math.floor(q / 2) * 0.62 - 0.3, R() * 6.28, 1, R() < 0.25 ? C('#7a6a5a') : c]);
  }
  // cones in short lines along the wall where the road kinks (someone's been setting out a course)
  for (let k = 0; k < want(10); k++) {
    const sp = D.besideRoad(ctx, (x, z) => flat(x, z) && ctx.clear(x, z, 0.5, 0.3) ? [x, z] : null, { reach: [0.6, 3] }); if (!sp) continue;
    const T = ctx.track, i = Math.floor(T.wrapS(sp[2]) / T.step) % T.n;
    for (let q = 0; q < 4; q++) { const p = T.point(sp[2] + q * 2.2, sp[3] * (T.half[i] + 0.6 + 1.1)); if (flat(p[0], p[2]) && ctx.clear(p[0], p[2], 0.25, 0.3) && free(p[0], p[2], 0.3)) { kit.cone.push([p[0], p[2], R() * 6.28, 1, null]); free.take(p[0], p[2], 0.3); } }
  }
  // the start: a wall of old tyres and water barriers, red and white, along the outside of the first straight
  for (const side of [1, -1]) for (let s = 8; s < 70; s += side > 0 ? 2.2 : 2.05) {
    const T = ctx.track, i = Math.floor(T.wrapS(s) / T.step) % T.n, p = T.point(s, side * (T.half[i] + 0.6 + (side > 0 ? 1.45 : 1.0)));
    if (!flat(p[0], p[2]) || !ctx.clear(p[0], p[2], side > 0 ? 1.05 : 0.5, 0.35) || !free(p[0], p[2], 0.6)) continue;
    if (side > 0) { kit.bar.push([p[0], p[2], T.psi[i], 1, (Math.floor(s / 2.2) % 2) ? C('#c8202a') : C('#e8e6e0')]); free.take(p[0], p[2], 1); }
    else if (Math.floor(s / 2.05) % 3 !== 2) { kit.tyre.push([p[0], p[2], R() * 6.28, 1, null]); free.take(p[0], p[2], 0.5); }
  }
  // bollards along the quay's edge, every 14 m
  for (let k = 0; k < (lite ? 200 : 500) && kit.bol.length < (pass(ctx) ? 26 : 40); k++) {
    const { x0, z0, ext } = ctx.terrainBox, x = x0 + R() * ext, z = z0 + R() * ext;
    const h = ctx.hAt(x, z); if (!(h > -0.75 && h < -0.2) && !(pass(ctx) && Math.abs(z + 20) < 0.8 && ctx.harbourRect(x, z))) continue;
    let wet = false; for (let a = 0; a < 8 && !wet; a++) if (ctx.hAt(x + Math.cos(a * 0.785) * 5, z + Math.sin(a * 0.785) * 5) < -3) wet = true;
    if (!wet || !ctx.clear(x, z, 0.4, 1) || !free(x, z, 7)) continue;
    kit.bol.push([x, z, 0, 1, null]); free.take(x, z, 0.4);
  }
  if (pass(ctx)) for (let x = -240; x < 290; x += 14) if (ctx.clear(x, -21, 0.4, 1) && free(x, -21, 0.5)) kit.bol.push([x, -21, 0, 1, null, 0.35]); // on the quay wall's top
  D.place(ctx, 'forklifts', P.forklift(), kit.fork, { aoH: 1.4 });
  D.place(ctx, 'pallets', P.pallets(0), kit.pal0); D.place(ctx, 'pallet-boxes', P.pallets(1), kit.pal1); D.place(ctx, 'pallet-stacks', P.pallets(2), kit.pal2, { aoH: 0.5 });
  D.place(ctx, 'drums', P.drum(), kit.drum, { aoH: 0.9 }); D.place(ctx, 'spools', P.spool(), kit.spool); D.place(ctx, 'cones', P.cone(), kit.cone, { aoH: 0.4 });
  D.place(ctx, 'barriers', P.barrier(), kit.bar, { aoH: 0.8 }); D.place(ctx, 'tyre-walls', P.tyres(5), kit.tyre); D.place(ctx, 'bollards', P.bollard(), kit.bol, { aoH: 0.5 });
  for (const f of kit.fork) ctx.glow(f[0] - Math.sin(f[2]) * 0.5, ctx.ground(f[0], f[1], 1) + 2.2, f[1] - Math.cos(f[2]) * 0.5, [1, 0.5, 0.1], 0.8, 1.7 + R());
  // ship-to-shore cranes on the quay, booms out over the water, trolleys running out and back
  const sts = [], used = ctx.placed.filter((p) => p.what === 'crane');
  const T0 = ctx.track, roadZ = (x) => { let best = 1e9, bz = 0; for (let i = 0; i < T0.n; i += 2) { if (!ctx.harbourRect || !ctx.harbourRect(T0.x[i], T0.z[i])) continue; const d = Math.abs(T0.x[i] - x); if (d < best) { best = d; bz = T0.z[i]; } } return best < 6 ? bz : null; };
  const span = pass(ctx) ? 33 : 16;
  const quaySpots = pass(ctx) ? [-85, 65, 175].map((x) => [x, roadZ(x), Math.PI]).filter((q) => q[1] !== null) : (() => {
    const out = [];
    for (let t = 0; t < 900 && out.length < 3; t++) {
      const { x0, z0, ext } = ctx.terrainBox, x = x0 + R() * ext, z = z0 + R() * ext, h = ctx.hAt(x, z); if (h < -0.7 || h > -0.2) continue;
      let best = null; for (let a = 0; a < 16; a++) { const dx = Math.sin(a * 0.3927), dz = Math.cos(a * 0.3927); if (ctx.hAt(x + dx * 18, z + dz * 18) < -4 && ctx.hAt(x - dx * 14, z - dz * 14) > -0.7) { best = [dx, dz]; break; } }
      if (!best) continue;
      const cx = x - best[0] * 11, cz = z - best[1] * 11;
      if (out.some((o) => Math.hypot(o[0] - cx, o[1] - cz) < 60) || used.some((u) => Math.hypot(u.x - cx, u.z - cz) < 40)) continue;
      out.push([cx, cz, Math.atan2(best[0], best[1])]);
    }
    return out;
  })();
  for (const [x, z, ry] of quaySpots) {
    const legs = [[-9, -span / 2], [9, -span / 2], [-9, span / 2], [9, span / 2]].map(([lx, lz]) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)]);
    if (!legs.every(([lx, lz]) => ctx.clear(lx, lz, 1.6, 1.2) && free(lx, lz, 1.4) && ctx.hAt(lx, lz) > (pass(ctx) ? -4 : -0.75))) continue;
    if (used.some((u) => Math.hypot(u.x - x, u.z - z) < 30)) continue;
    const y = Math.min(...legs.map(([lx, lz]) => ctx.ground(lx, lz, 1.3))) - 0.05;
    sts.push([x, z, ry, 1, null, y]); for (const [lx, lz] of legs) { free.take(lx, lz, 1.4); ctx.placed.push({ x: lx, z: lz, r: 1.2, y0: y, what: 'sts crane leg' }); }
  }
  if (sts.length) {
    const M = P.stsCrane('#2f62b0', span);
    D.movers(ctx, 'sts-cranes', M, sts, (t, k) => [0, 0, 0, 0, 0, M.reach[0] + (M.reach[1] - M.reach[0]) * (0.5 + 0.5 * Math.sin(t * 0.09 + k * 2.1))], { aoH: 20, reflect: true, audit: false });
    for (const [x, z, ry, , , y] of sts) { const at = (lz, h) => [x + Math.sin(ry) * lz, y + h, z + Math.cos(ry) * lz]; for (const [lz, h] of [[-4, 73.5], [57, 45.5], [-33, 45.5]]) { const p = at(lz, h); ctx.glow(p[0], p[1], p[2], [1, 0.08, 0.05], 2.4, 0.8 + R() * 0.4); } const c = at(10, 40); ctx.glow(c[0], c[1], c[2], [1, 0.82, 0.55], 2.5); const f = at(0, 38); ctx.pools.push([f[0], f[2], 30, 30, 0, 0.28, [1, 0.85, 0.65]]); }
  }
  // work lights in the yards: a trailer with four lamps, its pool on the ground and its light on what stands near
  const towers = [];
  for (let k = 0; k < want(pass(ctx) ? 5 : 12); k++) {
    const sp = D.besideRoad(ctx, (x, z) => flat(x, z) && ctx.clear(x, z, 1.4, 2) && free(x, z, 1.6) ? [x, z] : null, { reach: [3, 30] }); if (!sp) continue;
    const T = ctx.track, i = Math.floor(T.wrapS(sp[2]) / T.step) % T.n, ry = T.psi[i] + (sp[3] > 0 ? -Math.PI / 2 : Math.PI / 2) + (R() - 0.5) * 0.6; // lamps toward the road
    free.take(sp[0], sp[1], 1.6); towers.push([sp[0], sp[1], ry, 1, null]);
    const y = ctx.ground(sp[0], sp[1], 1.2), fx = sp[0] + Math.sin(ry) * 9, fz = sp[1] + Math.cos(ry) * 9;
    ctx.addLamp({ x: fx, y: y + 6, z: fz, r: 1, g: 0.95, b: 0.85, i: 0.9, range: 18 });
    ctx.pools.push([fx, fz, 22, 22, 0, 0.42, [1, 0.94, 0.82]]);
    for (const dx of [-0.72, -0.24, 0.24, 0.72]) ctx.glow(sp[0] + Math.cos(ry) * dx + Math.sin(ry) * 0.25, y + 7.3, sp[1] - Math.sin(ry) * dx + Math.cos(ry) * 0.25, [1, 0.96, 0.88], 1.6);
  }
  D.place(ctx, 'light-towers', P.lightTower(), towers, { aoH: 1 });
  // pools of light: under the lamps, and the warm spill from the sheds' windows onto the ground
  D.lampPools(ctx, { k: 0.26 });
  for (const S of ctx.placed) if (S.what === 'sheds' && ctx.edge(S.x, S.z) < 120) for (let q = 0; q < 3; q++) { const a = R() * 6.28, d = S.r * 0.62; ctx.pools.push([S.x + Math.cos(a) * d, S.z + Math.sin(a) * d, 9, 9, a, 0.3, [1, 0.72, 0.42]]); }
  // flags on the quay by the start: four poles, colours, no words
  { const fl = [], poles = [], T = ctx.track;
    for (let k = 0; k < 4; k++) { const s = 30 + k * 7, i = Math.floor(T.wrapS(s) / T.step) % T.n, side = -1, p = T.point(s, side * (T.half[i] + 0.6 + 3.2)); if (!flat(p[0], p[2]) || !ctx.clear(p[0], p[2], 0.3, 1.5) || !free(p[0], p[2], 0.6)) continue; const y = ctx.ground(p[0], p[2], 0.2) - 0.05; poles.push([p[0], p[2], 0, 1, null, y]); free.take(p[0], p[2], 0.6); fl.push([p[0], y + 7.6, p[2], T.psi[i] + 0.9, 2.2, 1.3, [C('#ff3fa4'), C('#36f2ff'), C('#ffd23f'), C('#f4ecff')][k]]); }
    D.place(ctx, 'flag-poles', P.flagPole(), poles, { aoH: 2 }); D.flags(ctx, fl); }
  // the water: the lights over it laid along it toward you
  D.streaks(ctx, D.streaksFromGlows(ctx, level, { share: lite ? 0.35 : 0.7 }));
  // steam: the ship's funnel and the warehouses' roof vents
  const steam = [];
  for (const S of ctx.placed) if (S.what === 'sheds' && R() < 0.6) { const top = ctx.ground(S.x, S.z) + 10; steam.push([S.x + (R() - 0.5) * S.r * 0.6, top + 2, S.z + (R() - 0.5) * S.r * 0.6]); }
  const ship = ctx.root.getObjectByName('ship'); if (ship) { ship.geometry.computeBoundingBox(); const b = ship.geometry.boundingBox; steam.push([(b.min.x + b.max.x) / 2, b.max.y + 14, (b.min.z + b.max.z) / 2]); }
  D.plumes(ctx, steam.slice(0, lite ? 4 : 10), { per: lite ? 6 : 10, height: 9, alpha: 0.22 });
  // litter on the wind
  D.drift(ctx, { kind: 'paper', count: lite ? 50 : 110, tint: [0.62, 0.5, 0.66], colors: [[1, 1, 1], [0.9, 0.86, 0.8], [0.8, 0.85, 0.95]] });
  // the pass: a better pine (the art, and a third card for body from every side)
  if (pass(ctx)) D.betterPines(ctx, ['pines'], D.pineArt2(ctx, { body: ['#2c5a50', '#15302c', '#0b1c1c'], tip: '#4a8070', rim: '#ff9a6a', cool: '#8a8ad8', seed: 31 }));
  void PAL; void pal;
}
// signs' spill and the yards' floodlights stay as they were; the extra light is placed with the dressing (addLamp)
export const shadowOpts = { reach: 90 };
