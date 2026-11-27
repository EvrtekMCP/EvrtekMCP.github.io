// DRIFTLINE: the world around the road, built in code at load. Every trick here is about looking rich for almost
// nothing: light is baked into vertex colours (sky, the low sun, every lamp's pool, ambient occlusion along the walls),
// materials are unlit, the scenery is instanced, glows are additive points, the sky and the water are one shader each,
// the far ranges are painted silhouettes, and fog does the depth.
// Courses 0.2.0: this file is the shared core (terrain, road, walls, tunnels, bridges, lamps, zones, sky, water); each
// region's look and dressing lives in js/scenery/<region>.js. Since 11-16 (Evrtek's report from a weak cell: a course
// pick waited on the network) every region's file is a static import, so it arrives with the game behind the boot bar
// and picking a course never fetches anything (about 20 KB gzipped for all five). The craft
// rules (the mixed physics stance) are checked by audit(): no ground over the road, no road left hanging, nothing
// standing on the road, nothing floating.
// 11-26 (graphics uplift part 2): Settings > World detail. Classic builds 0.1.21's worlds exactly; Full adds, here and in
// each region's dressFull (js/scenery/detail.js holds the shared layers): a worn road (tyre tracks and the black arcs of
// old drifts along the racing line, patches, flaking paint, a sheen toward the low sun, puddles, mirage, spindrift),
// richer baked light (warm and cool sides, longer lamp pools with a hot core, deeper contact shade), a deck of drifting
// cloud lit from the sun's side and rays, hazier far ranges, the sun's path and the lamps' streaks on the water, the
// new roadside kit, contact shadows and light pools, and things that move (litter, steam, flags, flicker, machines).
// Each Full layer answers a five-tap panel switch (TUNING.world), read in update().
import * as THREE from '../vendor/three/three.module.min.js?v=0.1.24';
import { PAL, sunDir, lampGrid, lampsAt, ambient, setLook, setDetail } from './look.js?v=0.1.24';
import { TUNING } from './config.js?v=0.1.24';
import * as D from './scenery/detail.js?v=0.1.24';
import * as TX from './textures.js?v=0.1.24';
import { SAFE } from './glsafe.js?v=0.1.24';
// the regions' files import a few helpers from this one (a cycle that is safe: they touch them only inside functions)
import * as harbour from './scenery/harbour.js?v=0.1.24';
import * as canyon from './scenery/canyon.js?v=0.1.24';
import * as mountain from './scenery/mountain.js?v=0.1.24';
import * as neon from './scenery/neon.js?v=0.1.24';
import * as summit from './scenery/summit.js?v=0.1.24';
const SCENERY = { harbour, canyon, mountain, neon, summit };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash2 = (x, y) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function vnoise(x, y) { const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); const a = hash2(x0, y0), b = hash2(x0 + 1, y0), c = hash2(x0, y0 + 1), d = hash2(x0 + 1, y0 + 1); return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy; }
export function fbm(x, y, o = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); a *= 0.5; f *= 2.03; } return s; }
const col3 = (c) => [c.r, c.g, c.b];
const g3 = (c) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;

// the sky's colour by direction, shared by the dome and the water's reflection (GLSL)
const SKY_GLSL = (sun) => `
const vec3 SUN = normalize(vec3(${sun.x.toFixed(4)}, ${sun.y.toFixed(4)}, ${sun.z.toFixed(4)}));
vec3 skyCol(vec3 d) {
  float h = d.y, sa = max(dot(d, SUN), 0.0);
  vec3 c = mix(${g3(PAL.horizonAway)}, ${g3(PAL.sky)}, smoothstep(-0.02, 0.28, h));
  c = mix(c, ${g3(PAL.zenith)}, smoothstep(0.28, 0.9, h));
  float glow = pow(sa, 5.0) * (1.0 - smoothstep(-0.05, 0.5, h));
  c = mix(c, ${g3(PAL.horizonSun)}, clamp(glow * 1.1, 0.0, 1.0));
  c += ${g3(PAL.sunLight)} * pow(sa, 60.0) * 0.8;
  return c;
}`;

// wall profiles: [outward offset from the wall line, height], eight points each so styles can change along a side
const PROFILES = {
  barrier: [[0, 0], [0.07, 0.25], [0.15, 0.82], [0.3, 0.9], [0.45, 0.82], [0.55, 0.25], [0.62, 0], [0.62, 0]],
  rail: [[0.02, 0.42], [0.0, 0.55], [0.06, 0.62], [0.0, 0.7], [0.03, 0.82], [0.14, 0.8], [0.14, 0.42], [0.14, 0.42]],
  parapet: [[0, 0], [0, 0.95], [0.08, 1.05], [0.42, 1.05], [0.5, 0.95], [0.5, -0.4], [0.5, -0.4], [0.5, -0.4]],
  curb: [[0, 0], [0, 0.55], [0.1, 0.65], [0.5, 0.65], [0.6, 0.55], [0.6, 0], [0.6, 0], [0.6, 0]],
  block: [[0, 0], [0, 1.0], [0.1, 1.1], [0.55, 1.1], [0.65, 1.0], [0.65, 0], [0.65, 0], [0.65, 0]],
};

// step(fraction, what): optional, awaited between the stages so a loading screen can show real progress (and the page
// can paint); the fractions follow where the time goes (measured 11-16 on four regions at a 4x CPU slowdown: the land
// is about half of it). Nothing built here is seen until the caller swaps the finished world in.
export async function buildWorld(track, course, tier, step = null, detail = 'full') {
  const S = SCENERY[course.scenery || course.region];
  if (!S) throw new Error('no scenery for ' + (course.scenery || course.region));
  const at = step || (() => null);
  const look = S.look(course);
  setLook(look);
  const FULL = detail !== 'classic'; // 11-26: Classic = 0.1.21's world, made by exactly the code it was made by
  setDetail(FULL);
  const root = new THREE.Group();
  const sun = sunDir();
  const R = rng(course.seed || 1234);
  const uTime = { value: 0 };
  const grainTex = TX.grain();
  const dense = tier >= 2 ? 1 : tier === 1 ? 0.7 : 0.45;
  const n = track.n;
  const disposables = [grainTex];

  // ---------------------------------------------------------------- the context every region builds with
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) { minX = Math.min(minX, track.x[i]); maxX = Math.max(maxX, track.x[i]); minZ = Math.min(minZ, track.z[i]); maxZ = Math.max(maxZ, track.z[i]); minY = Math.min(minY, track.y[i]); maxY = Math.max(maxY, track.y[i]); }
  const RG = new Map(), rc = 40;
  for (let i = 0; i < n; i += 2) { const key = Math.floor(track.x[i] / rc) * 7919 + Math.floor(track.z[i] / rc); if (!RG.has(key)) RG.set(key, []); RG.get(key).push(i); }
  const nearRoad = (x, z, reach = 2) => {
    const gx = Math.floor(x / rc), gz = Math.floor(z / rc); let best = -1, bd = Infinity;
    for (let a = -reach; a <= reach; a++) for (let b = -reach; b <= reach; b++) { const L = RG.get((gx + a) * 7919 + gz + b); if (L) for (const i of L) { const d = (track.x[i] - x) ** 2 + (track.z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } } }
    return best < 0 ? null : { i: best, d: Math.sqrt(bd) };
  };
  // runs of a kind along the loop (tunnels 2, bridges 3): [{a, b}] sample ranges, a <= b (may pass the end)
  const runsOf = (k) => { const out = []; let i0 = 0; while (i0 < n && track.kind[i0] === k) i0++; if (i0 === n) return [{ a: 0, b: n - 1 }]; let cur = null; for (let q = 0; q < n; q++) { const i = (i0 + q) % n; if (track.kind[i] === k) { if (!cur) cur = { a: i0 + q, b: i0 + q }; else cur.b = i0 + q; } else if (cur) { out.push(cur); cur = null; } } if (cur) out.push(cur); return out; };
  const tunnels = runsOf(2), bridges = runsOf(3);
  const ctx = {
    THREE, track, course, tier, dense, R, root, uTime, PAL, sun, TX, look,
    bbox: { minX, maxX, minZ, maxZ, minY, maxY, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 },
    glows: [],   // [x,y,z, r,g,b, size, blink]
    lamps: [],   // baked light sources {x,y,z,r,g,b,i,range}
    mounts: [],  // lamp poles {x,y,z, ax,az (the arm's direction), style, lamp (index), h}
    placed: [],  // dressing footprints for the audit {x, z, r, y0, what}
    tunnels, bridges, nearRoad, disposables, moundSpots: [],
    // 11-26 Full: its own dice (Classic's sequence, and so every classic thing's place, is untouched), the low tier's
    // lighter share, the five-tap switches' objects and uniforms, what the reflection cube leaves out, frame hooks
    full: FULL, lite: tier === 0, pools: [], uFloor: { value: 0 }, R2: D.rng(D.idSeed(course.id || 'course') ^ 0x2545f491), layers: {}, switches: {}, noReflect: [], onFrame: [], scaled: [], grain: grainTex,
    ambientN: (nx, ny, nz, out) => ambient(nx, ny, nz, 1, out),
    glow(x, y, z, c, size, blink = 0) { this.glows.push(x, y, z, c.r ?? c[0], c.g ?? c[1], c.b ?? c[2], size, blink); },
    // distance from the nearest road's wall line (negative: on the road)
    edge(x, z) { const nr = nearRoad(x, z, 3); return nr ? nr.d - track.half[nr.i] - 0.6 : 1e4; },
    // true when a footprint of radius r at (x, z) stands clear of every road, its walls and a margin
    clear(x, z, r, margin = 1.2) {
      if (this.edge(x, z) < r + margin) return false;
      for (const T of tunnels) if (nearRun(x, z, T, 36 + r)) return false;
      return true;
    },
  };
  const nearRun = (x, z, run, dist) => { for (let q = run.a; q <= run.b; q += 6) { const i = q % n; if ((track.x[i] - x) ** 2 + (track.z[i] - z) ** 2 < dist * dist) return true; } return false; };

  // ---------------------------------------------------------------- lamps (they light everything else)
  S.lamps(ctx);
  // the start gantry's floods
  { const p = track.point(1.5, 0); for (const l of [-4, 0, 4]) { const q = track.point(1.5, l); ctx.lamps.push({ x: q[0], y: p[1] + 7.5, z: q[2], r: 1, g: 0.9, b: 0.8, i: 1.0, range: 18 }); } }
  // tunnel lamps: a pair every 14 m along the roof
  const inTunnel = new Uint8Array(n); for (let i = 0; i < n; i++) inTunnel[i] = track.kind[i] === 2 ? 1 : 0;
  for (const T of tunnels) for (let q = T.a + 6; q <= T.b - 4; q += 14) { const i = q % n, p = track.point(i * track.step, 0); const c = PAL.sodium; ctx.lamps.push({ x: p[0], y: p[1] + 5.6, z: p[2], r: c.r, g: c.g, b: c.b, i: 1.25, range: 13 }); ctx.glow(p[0], p[1] + 5.7, p[2], c, 2.6); }
  if (FULL) {
    // the region's own extra light (signs' spill, work lights), every pool a fifth longer and a touch warmer (look.js
    // adds the hot core), and one lamp head in about twenty that flickers (a negative blink: glowMaterial)
    if (S.lampsFull) S.lampsFull(ctx);
    for (const L of ctx.lamps) { L.range *= 1.2; L.r *= 1.04; L.b *= 0.95; }
    const G = ctx.glows; for (let k = 0; k < G.length; k += 8) if (G[k + 6] >= 4.9 && G[k + 7] === 0 && ctx.R2() < 0.05) G[k + 7] = -(0.6 + ctx.R2() * 0.8);
  }
  const LG = lampGrid(ctx.lamps);
  // 11-26 Full: a lamp added after the bake (a work light placed with the dressing) lights what is placed after it
  ctx.addLamp = (L) => { ctx.lamps.push(L); const r = Math.ceil(L.range / LG.cell), cx0 = Math.floor(L.x / LG.cell), cz0 = Math.floor(L.z / LG.cell); for (let i = -r; i <= r; i++) for (let k = -r; k <= r; k++) { const key = (cx0 + i) * 73856093 ^ (cz0 + k) * 19349663; if (!LG.grid.has(key)) LG.grid.set(key, []); LG.grid.get(key).push(L); } };
  ctx.light = (x, y, z, nx = 0, ny = 1, nz = 0, out = [0, 0, 0], vis = 1) => { const a = ambient(nx, ny, nz, vis, [0, 0, 0]), l = lampsAt(LG, x, y, z, nx, ny, nz, [0, 0, 0]); for (let c = 0; c < 3; c++) out[c] = a[c] + l[c]; return out; };
  ctx.lampsAt = (x, y, z, nx, ny, nz, out) => lampsAt(LG, x, y, z, nx, ny, nz, out);

  await at(0.06, 'the land');
  // ---------------------------------------------------------------- the land: a height field around the course
  const T = S.terrain(ctx);  // { height(x, z, mem, edge, i), albedo(x, z, h, slope, edge), blend, margin }
  const margin = T.margin ?? 460;
  const ext = clamp(Math.max(maxX - minX, maxZ - minZ) + 2 * margin, 1300, 2600), res = [96, 140, 176][tier] || 140;
  const cx = (minX + maxX) / 2 + (T.shiftX || 0), cz = (minZ + maxZ) / 2 + (T.shiftZ || 0);
  const x0 = cx - ext / 2, z0 = cz - ext / 2, cell = ext / res;
  ctx.terrainBox = { x0, z0, ext, cell };
  // the membrane: road heights spread smoothly over the land (inverse distance), on a coarse grid
  const MG = 48, mcell = ext / MG, MEM = new Float32Array((MG + 1) * (MG + 1));
  {
    const pts = []; for (let i = 0; i < n; i += 8) pts.push(track.x[i], track.z[i], track.y[i]);
    for (let j = 0; j <= MG; j++) for (let i = 0; i <= MG; i++) {
      const x = x0 + i * mcell, z = z0 + j * mcell; let sw = 0, sy = 0;
      for (let k = 0; k < pts.length; k += 3) { const d2 = (pts[k] - x) ** 2 + (pts[k + 1] - z) ** 2 + 900; const w = 1 / (d2 * d2); sw += w; sy += w * pts[k + 2]; }
      MEM[j * (MG + 1) + i] = sy / sw;
    }
  }
  const memAt = (x, z) => { const gx = clamp((x - x0) / mcell, 0, MG - 1e-3), gz = clamp((z - z0) / mcell, 0, MG - 1e-3), i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, W = MG + 1; return (MEM[j * W + i] * (1 - fx) + MEM[j * W + i + 1] * fx) * (1 - fz) + (MEM[(j + 1) * W + i] * (1 - fx) + MEM[(j + 1) * W + i + 1] * fx) * fz; };
  ctx.memAt = memAt;
  await at(0.21, 'the land');
  // gorges under the bridges: a valley across the road at each bridge, deepest under its middle
  const gorges = bridges.map((B) => {
    const ia = B.a % n, ib = B.b % n, im = Math.floor((B.a + B.b) / 2) % n, len = (B.b - B.a) * track.step;
    return { mx: track.x[im], mz: track.z[im], ux: track.tz[im], uz: -track.tx[im], tx: track.tx[im], tz: track.tz[im], half: len / 2, base: Math.min(track.y[ia], track.y[ib], track.y[im]), depth: T.gorgeDepth ?? 20, im };
  });
  ctx.gorges = gorges;
  const gorgeAt = (x, z) => {
    let cut = Infinity;
    for (const G of gorges) {
      const dx = x - G.mx, dz = z - G.mz, across = Math.abs(dx * G.tx + dz * G.tz), along = Math.abs(dx * G.ux + dz * G.uz);
      const w = Math.max(10, G.half - 14), k = (1 - sstep(w * 0.5, w + 10, across)) * (1 - 0.5 * sstep(150, 600, along));
      if (k > 0) cut = Math.min(cut, G.base - G.depth * k);
    }
    return cut;
  };
  const N1 = res + 1, H = new Float32Array(N1 * N1), EDGE = new Float32Array(N1 * N1);
  const blend = T.blend ?? 46;
  for (let j = 0; j <= res; j++) for (let i = 0; i <= res; i++) {
    const x = x0 + i * cell, z = z0 + j * cell, k = j * N1 + i;
    const nr = nearRoad(x, z, 3);
    const e = nr ? nr.d - track.half[nr.i] : 1e4;
    let h = T.height(x, z, memAt(x, z), e, nr ? nr.i : -1);
    if (nr) {
      const w = track.half[nr.i] + 4.5, yr = track.y[nr.i] - 0.6;
      h = nr.d < w ? yr : yr + (h - yr) * sstep(w, w + blend, nr.d);
    }
    if (gorges.length) { const g = gorgeAt(x, z); if (g < h && (!nr || track.kind[nr.i] === 3 || nr.d - track.half[nr.i] > 14)) h = g; }
    H[k] = h; EDGE[k] = e;
  }
  // no ground over the road: every cell the road (and its walls) crosses is held under the road's surface
  for (let i = 0; i < n; i++) {
    if (track.kind[i] === 3) continue;
    const yc = track.y[i] - 0.45, hw = track.half[i] + 1.3;
    for (let lat = -hw; lat <= hw + 0.01; lat += hw / Math.ceil(hw / 0.8)) {
      const px = track.x[i] + track.tz[i] * lat, pz = track.z[i] - track.tx[i] * lat;
      const gi = Math.floor((px - x0) / cell), gj = Math.floor((pz - z0) / cell);
      if (gi < 0 || gj < 0 || gi >= res || gj >= res) continue;
      for (const k of [gj * N1 + gi, gj * N1 + gi + 1, (gj + 1) * N1 + gi, (gj + 1) * N1 + gi + 1]) if (H[k] > yc) H[k] = yc;
    }
  }
  await at(0.37, 'the land');
  const hAt = (x, z) => {
    const gx = clamp((x - x0) / cell, 0, res - 1e-3), gz = clamp((z - z0) / cell, 0, res - 1e-3), i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
    const a = H[j * N1 + i], b = H[j * N1 + i + 1], c = H[(j + 1) * N1 + i], d = H[(j + 1) * N1 + i + 1];
    // the same two triangles the mesh draws (split a-d), so objects sit exactly on what is seen
    return fx + fz < 1 ? a + (b - a) * fx + (c - a) * fz : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
  };
  ctx.hAt = hAt;
  // the lowest ground under a footprint: where to stand a thing so no corner floats
  ctx.ground = (x, z, r = 0) => { let m = hAt(x, z); if (r > 0) for (let a = 0; a < 6; a++) m = Math.min(m, hAt(x + Math.cos(a * 1.047) * r, z + Math.sin(a * 1.047) * r)); return m; };
  const sunVis = (x, y, z) => {
    if (sun.y < 0.01) return 0;
    let v = 1;
    for (let k = 1; k <= 22; k++) { const t = k * 14; const hy = hAt(x + sun.x * t, z + sun.z * t); const ry = y + sun.y * t; if (hy > ry + 0.5) { v = Math.max(0, 1 - (hy - ry) / 6); if (v === 0) break; } }
    return v;
  };
  ctx.sunVis = sunVis;
  {
    const pos = new Float32Array(N1 * N1 * 3), colr = new Float32Array(N1 * N1 * 3), uv = new Float32Array(N1 * N1 * 2);
    const amb = [0, 0, 0], lmp = [0, 0, 0];
    for (let j = 0; j <= res; j++) for (let i = 0; i <= res; i++) {
      const k = j * N1 + i, x = x0 + i * cell, z = z0 + j * cell, h = H[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z; uv[k * 2] = x / 9; uv[k * 2 + 1] = z / 9;
      const hl = H[j * N1 + Math.max(0, i - 1)], hr = H[j * N1 + Math.min(res, i + 1)], hd = H[Math.max(0, j - 1) * N1 + i], hu = H[Math.min(res, j + 1) * N1 + i];
      let nx = hl - hr, nz = hd - hu, ny = 2 * cell; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const alb = T.albedo(x, z, h, 1 - ny, EDGE[k]);
      const ao = clamp(1 - (((hl + hr + hd + hu) / 4) - h) * 0.04, 0.55, 1.1);
      ambient(nx, ny, nz, sunVis(x, h, z), amb);
      lampsAt(LG, x, h, z, nx, ny, nz, lmp);
      for (let c = 0; c < 3; c++) colr[k * 3 + c] = alb[c] * (amb[c] * ao + lmp[c] * 0.9);
    }
    const idx = new Uint32Array(res * res * 6); let o = 0;
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) { const a = j * N1 + i, b = a + 1, c = a + N1, d = c + 1; idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = d; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    const detail = TX.grain(128, 21); disposables.push(detail);
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, map: detail });
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', 'vec4 dt = texture2D( map, vMapUv ); diffuseColor.rgb *= 0.78 + 0.5 * dt.r * dt.g + 0.12;'); };
    const mesh = new THREE.Mesh(g, m); mesh.name = 'terrain'; root.add(mesh);
  }

  await at(0.52, 'the road');
  // ---------------------------------------------------------------- the road (one ribbon, its own shader)
  const ACROSS = 12;
  const roadLight = new Float32Array(n * 3); // the baked light along the centre, for the car and the smoke
  const RS = Object.assign({ runoff: ['#c8323c', '#e8e2e0'], kerb: ['#c00a12', '#d8d2cc'], sheen: 0.04, glare: 0.45, sunSheen: 0.3, puddles: 0, mirage: 0, spindrift: 0 }, look.road || {});
  const ca = (h) => new THREE.Color(h);
  {
    const V = n + 1, pos = new Float32Array(V * ACROSS * 3), colr = new Float32Array(V * ACROSS * 3), uv = new Float32Array(V * ACROSS * 2), hw = new Float32Array(V * ACROSS), kerb = new Float32Array(V * ACROSS), runA = new Float32Array(V * ACROSS);
    const amb = [0, 0, 0], lmp = [0, 0, 0], p = [0, 0, 0];
    const RL = FULL ? D.racingLine(track) : null, wear = FULL ? new Float32Array(V * ACROSS * 2) : null; // 11-26 Full: the line worn in
    // kerbs: the inside of every zone, around its apex (the same rule js/carsurface.js hears)
    const kerbAt = new Float32Array(n);
    for (const zn of track.zones) { const a = zn.s0 + zn.len * Math.max(0.1, zn.apexT - 0.35), b = zn.s0 + zn.len * Math.min(0.95, zn.apexT + 0.3); for (let s = a; s < b; s += track.step) kerbAt[Math.floor(track.wrapS(s) / track.step) % n] = zn.side; }
    for (let v = 0; v <= n; v++) {
      const i = v % n, half = track.half[i], s = v * track.step, lo = track.laneOff[i], lh = track.laneHalf[i], tun = inTunnel[i];
      for (let a = 0; a < ACROSS; a++) {
        const f = a / (ACROSS - 1), lat = (f * 2 - 1) * (half + 0.62);
        track.point(s, lat, p);
        const k = v * ACROSS + a;
        pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1] + 0.02; pos[k * 3 + 2] = p[2];
        uv[k * 2] = lat - lo; uv[k * 2 + 1] = s; hw[k] = lh; kerb[k] = kerbAt[i]; runA[k] = half - lh > 0.3 ? 1 : 0;
        const edge = sstep(half - 1.6, half + 0.62, Math.abs(lat));
        ambient(0, 1, 0, tun ? 0 : sunVis(p[0], p[1] + 0.5, p[2]), amb);
        lampsAt(LG, p[0], p[1], p[2], 0, 1, 0, lmp);
        for (let c = 0; c < 3; c++) colr[k * 3 + c] = amb[c] * (1 - edge * 0.38) * (tun ? 0.22 : 1) + lmp[c];
        if (FULL) { // a deeper contact shade in the last half metre at the wall's foot; the racing line for the shader
          const foot = 1 - 0.32 * sstep(half - 0.4, half + 0.62, Math.abs(lat)); for (let c = 0; c < 3; c++) colr[k * 3 + c] *= foot;
          wear[k * 2] = RL.line[i]; wear[k * 2 + 1] = RL.zone[i];
        }
        if (a === ACROSS >> 1) for (let c = 0; c < 3; c++) roadLight[i * 3 + c] = colr[k * 3 + c];
      }
    }
    const idx = new Uint32Array(n * (ACROSS - 1) * 6); let o = 0;
    for (let v = 0; v < n; v++) for (let a = 0; a < ACROSS - 1; a++) { const q = v * ACROSS + a, r = q + ACROSS; idx[o++] = q; idx[o++] = q + 1; idx[o++] = r; idx[o++] = q + 1; idx[o++] = r + 1; idx[o++] = r; }
    // 11-26 Full: the ribbon wound to face up. Since 0.1.0 it has faced down, so the default culling hid it from above and
    // what showed as the road was the land held 0.6 m under it (the lines, kerbs, start checker and sheen never drew,
    // and the car, its skid marks and the zones sat that much over what was seen). Classic keeps it exactly as it was.
    if (FULL) for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('aHalf', new THREE.BufferAttribute(hw, 1)); g.setAttribute('aKerb', new THREE.BufferAttribute(kerb, 1)); g.setAttribute('aRun', new THREE.BufferAttribute(runA, 1));
    if (FULL) g.setAttribute('aWear', new THREE.BufferAttribute(wear, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    const uRoad = { value: 1 }; (ctx.switches.road ||= []).push(uRoad);
    const F = FULL, seed = ((course.seed || 1234) % 997).toFixed(1);
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { grain: { value: grainTex } }, F ? { time: uTime, uRoad } : {}),
      fog: true,
      vertexShader: `attribute vec3 color; attribute float aHalf; attribute float aKerb; attribute float aRun; varying vec3 vLight; varying vec2 vUv; varying vec3 vWorld; varying float vHalf; varying float vKerb; varying float vRun;${F ? ' attribute vec2 aWear; varying vec2 vWear;' : ''}
        #include <fog_pars_vertex>
        void main() { vLight = color; vUv = uv; vHalf = aHalf; vKerb = aKerb; vRun = aRun;${F ? ' vWear = aWear;' : ''} vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader: `uniform sampler2D grain; varying vec3 vLight; varying vec2 vUv; varying vec3 vWorld; varying float vHalf; varying float vKerb; varying float vRun;${F ? ' varying vec2 vWear; uniform float time; uniform float uRoad;' + SAFE : ''}
        #include <fog_pars_fragment>
        const vec3 SUNV = normalize(vec3(${sun.x.toFixed(4)}, ${sun.y.toFixed(4)}, ${sun.z.toFixed(4)}));
        void main() {
          vec4 gr = texture2D(grain, vUv * 0.22); vec4 bl = texture2D(grain, vUv * 0.021 + 0.37);
          vec3 alb = ${g3(PAL.asphalt)} * (0.72 + 0.55 * gr.r / 1.0) * (0.82 + 0.36 * bl.g);
          float ax = abs(vUv.x);
${F ? `          // 11-26 Full: the coarse aggregate and streaks along the road; a patched repair now and then (a darker newer
          // one or a paler old one) with its sealed seam
          vec4 st = texture2D(grain, vec2(vUv.x * 0.35, vUv.y * 0.018) + 0.61);
          alb *= 1.0 + uRoad * (0.22 * (gr.r - 0.62) + 0.22 * (st.g - 0.5));
          // tar snakes: sealed cracks, thin glossy-black lines wandering along the road, in some stretches
          { float cn = texture2D(grain, vUv * vec2(0.09, 0.03) + 0.27 + (gr.g - 0.5) * 0.035).g, cw = fwidth(cn) * 0.9 + 0.002;
            float crack = (1.0 - smoothstep(0.0, cw, abs(cn - 0.5))) * step(ax, vHalf - 0.25) * smoothstep(0.55, 0.78, texture2D(grain, vUv * 0.009 + 0.71).g);
            alb *= 1.0 - crack * uRoad * 0.45; }
          { float cell = floor(vUv.y / 29.0), hp = fract(sin(cell * 91.7 + ${seed}) * 43758.5453);
            if (hp > 0.5) { float y0 = cell * 29.0 + fract(hp * 7.3) * 16.0, len = 3.0 + fract(hp * 13.1) * 9.0, x0 = (fract(hp * 3.7) - 0.5) * vHalf * 1.1, w = 0.8 + fract(hp * 5.9) * 2.0;
              vec2 q = vec2(abs(vUv.x - x0) - w, abs(vUv.y - y0 - len * 0.5) - len * 0.5); float mq = max(q.x, q.y), onL = step(ax, vHalf);
              alb *= 1.0 - uRoad * onL * (step(mq, 0.0) * (hp > 0.8 ? -0.18 : 0.3) + (1.0 - smoothstep(0.0, 0.08, abs(mq))) * 0.5); } }
` : ''}          float edge = 1.0 - smoothstep(0.07, 0.11, abs(ax - (vHalf - 0.42)));
          float centre = (1.0 - smoothstep(0.06, 0.1, ax)) * step(fract(vUv.y / 10.0), 0.42);
          vec3 lineC = ${g3(PAL.line)} * (0.8 + 0.25 * gr.r);
${F ? `          float lineK = 1.0 - uRoad * 0.5 * smoothstep(0.42, 0.72, texture2D(grain, vUv * vec2(1.7, 0.13) + 0.2).g); // the paint flaking
` : ''}          alb = mix(alb, lineC, max(edge, centre) * 0.92${F ? ' * lineK' : ''});
${F ? `          // the racing line: two rubbered tyre tracks either side of it and a polished band between; through the zones the
          // black arcs of every drift before yours (over the paint: tyres cross the lines)
          float dw = vUv.x - vWear.x, tyre = 1.0 - smoothstep(0.1, 0.4, abs(abs(dw) - 0.8)), polish = 1.0 - smoothstep(0.5, 1.8, abs(dw));
          float arcs = vWear.y * (1.0 - smoothstep(0.15, 0.8, abs(abs(dw) - 0.72))) * (0.5 + 0.5 * smoothstep(0.3, 0.7, texture2D(grain, vec2(vUv.x * 2.6, vUv.y * 0.045)).g));
          alb *= 1.0 - uRoad * clamp(tyre * (0.6 + 0.4 * vWear.y) * (0.7 + 0.5 * st.g) * 0.4 + polish * 0.1 + arcs * 0.68, 0.0, 0.78) * step(ax, vHalf + 0.3);
` : ''}          if (ax > vHalf) {
            if (vRun > 0.5) {
              // the runoff apron: painted stripes across it, then a kerb on the lane's edge
              float st = step(0.5, fract((vUv.y + ax * 0.6) / 3.0));
              alb = mix(${g3(ca(RS.runoff[0]))}, ${g3(ca(RS.runoff[1]))}, st) * (0.55 + 0.3 * gr.r);
            } else alb *= 0.65; // the shoulder past the white line: darker gravel
          }
          // kerbs inside the corners
          if (vKerb * vUv.x > 0.0 && ax > vHalf - 1.05 && ax < vHalf - 0.15) { float st = step(0.5, fract(vUv.y / 2.0)); alb = mix(${g3(ca(RS.kerb[0]))}, ${g3(ca(RS.kerb[1]))}, st); }
          // the start line
          if (vUv.y > 0.0 && vUv.y < 2.4 && ax < vHalf - 0.4) { float ch = mod(floor(vUv.x / 0.6) + floor(vUv.y / 0.6), 2.0); alb = mix(vec3(0.03), vec3(0.85), ch); }
          vec3 col = alb * vLight;
          // the sun's glare off the asphalt, and a sheen under the lamps (wet streets shine more)
          vec3 V = normalize(vWorld - cameraPosition); vec3 Rr = reflect(V, vec3(0.0, 1.0, 0.0));
          float gl = pow(max(dot(Rr, SUNV), 0.0), 18.0);
          col += ${g3(PAL.sunLight)} * gl * ${RS.glare.toFixed(3)} * (0.55 + 0.6 * gr.r);
          col += vLight * pow(max(-V.y, 0.0), 0.5) * ${RS.sheen.toFixed(3)} * gr.r;
${F ? `          // 11-26 Full: a broad sheen toward the low sun, strongest looking along the road and on the polished line
          float fres = pow(clamp(1.0 + V.y, 0.0, 1.0), 4.0); // 11-26 (4): never pow() of a negative (V.y can round past -1)
          float sl = pow(max(dot(normalize(vec3(Rr.x, Rr.y * 2.5, Rr.z)), normalize(vec3(SUNV.x, SUNV.y * 2.5, SUNV.z))), 0.0), 7.0);
          col += ${g3(PAL.sunLight)} * sl * fres * ${RS.sunSheen.toFixed(3)} * (0.4 + polish * 0.9) * uRoad;
${RS.puddles ? `          // rain-sheen puddles off the line: dark, mirror-wet, the street's light doubled in them, rain rings
          { float pm = smoothstep(0.585, 0.635, texture2D(grain, vUv * vec2(0.045, 0.03) + 0.13).g) * smoothstep(0.7, 1.5, abs(dw)) * step(ax, vHalf) * uRoad * ${RS.puddles.toFixed(2)};
            vec2 rp = vWorld.xz * 0.8, ci = floor(rp), cf = fract(rp) - 0.5; float h = fract(sin(dot(ci, vec2(12.9898, 78.233))) * 43758.5453), t = fract(time * 0.9 + h);
            float ring = (1.0 - smoothstep(0.0, 0.04, abs(length(cf) - t * 0.48))) * (1.0 - t) * step(0.4, h);
            vec3 neonR = mix(${g3(PAL.neonPink)}, ${g3(PAL.neonCyan)}, smoothstep(0.35, 0.65, texture2D(grain, vec2(vWorld.x + vWorld.z, vWorld.z - vWorld.x) * 0.004).g)); // the signs and the sky glow, streaked in the water
            vec3 vl = vLight / (1.0 + max(vLight.r, max(vLight.g, vLight.b))); // a floodlit puddle shines, but never as a white sheet
            col = mix(col, col * 0.38 + vl * (0.22 + 0.6 * fres) + neonR * (0.05 + 0.22 * fres) * (0.6 + 0.4 * sin(vUv.y * 0.9 + vUv.x * 3.0)) + vl * ring * 0.9, pm); }
` : ''}${RS.mirage ? `          // heat on the road ahead: far off, at a grazing look, it mirrors the hot sky and shimmers
          { float dist = length(vWorld - cameraPosition), mir = smoothstep(50.0, 130.0, dist) * (1.0 - smoothstep(0.004, 0.06, -V.y)) * uRoad;
            float wob = 0.55 + 0.45 * sin(vWorld.x * 0.23 + vWorld.z * 0.19 + time * 3.3) * sin(vWorld.z * 0.07 - vWorld.x * 0.05 - time * 1.7);
            vec3 hot = mix(${g3(PAL.horizonAway)}, ${g3(PAL.horizonSun)}, pow(max(dot(normalize(vec3(V.x, 0.0, V.z)), normalize(vec3(SUNV.x, 0.0, SUNV.z))), 0.0), 2.0));
            col = mix(col, hot * 0.95, mir * ${RS.mirage.toFixed(2)} * wob); }
` : ''}${RS.spindrift ? `          // spindrift: snow streaming across the road on the wind
          { vec2 sp = vec2(vWorld.x * 0.8 + vWorld.z * 0.6, vWorld.z * 0.8 - vWorld.x * 0.6) + vec2(time * 3.2, time * 0.7);
            float sd = smoothstep(0.52, 0.8, texture2D(grain, sp * vec2(0.03, 0.11)).g) * smoothstep(0.35, 0.7, texture2D(grain, sp * 0.013 + 0.5).g);
            col += (vLight * 0.7 + 0.03) * sd * ${RS.spindrift.toFixed(2)} * uRoad; }
` : ''}` : ''}          gl_FragColor = vec4(${F ? 'ddSafe(col)' : 'col'}, 1.0);
          #include <fog_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.name = 'road'; root.add(mesh);
  }

  await at(0.65, 'the walls');
  // ---------------------------------------------------------------- walls (and a skirt under the road's edge)
  const posts = [];
  {
    const P = 8, pos = [], colr = [], idx = [], neon = [], neonIdx = [], neonCol = [], skP = [], skC = [], skI = [];
    const amb = [0, 0, 0], lmp = [0, 0, 0], p = [0, 0, 0];
    for (const side of [1, -1]) {
      const base = pos.length / 3, nb = neon.length / 3, sb = skP.length / 3;
      for (let v = 0; v <= n; v++) {
        const i = v % n, half = track.half[i], s = v * track.step;
        const W = S.wall(ctx, track.kind[i], side, i); // { prof, color, k, strip (Color|null), reflect, posts }
        const prof = PROFILES[W.prof];
        const lx = track.tz[i] * side, lz = -track.tx[i] * side; // outward
        for (let q = 0; q < P; q++) {
          const [o, h] = prof[q];
          track.point(s, side * (half + 0.55 + o), p);
          pos.push(p[0], p[1] + h, p[2]);
          const a = prof[Math.max(0, q - 1)], b = prof[Math.min(P - 1, q + 1)];
          let dn = b[0] - a[0], dh = b[1] - a[1]; const nl = Math.hypot(dn, dh) || 1; const no = dh / nl, nh = -dn / nl;
          const nx = -lx * no, nz = -lz * no, ny = nh;
          ambient(nx, ny, nz, inTunnel[i] ? 0 : 0.85, amb); lampsAt(LG, p[0], p[1] + h, p[2], nx, ny, nz, lmp);
          const ao = FULL ? 0.36 + 0.64 * sstep(0, 0.8, h) : 0.55 + 0.45 * sstep(0, 0.6, h); // 11-26 Full: darker where the wall meets the road
          for (let c = 0; c < 3; c++) colr.push(W.color[c] * ((amb[c] * 1.1) * ao * (inTunnel[i] ? 0.3 : 1) + lmp[c] * 0.8) * (W.k ?? 1));
        }
        // the skirt: from just behind the wall's foot down into the ground, so the road never shows an edge in the air
        track.point(s, side * (half + 0.55 + prof[P - 1][0] + 0.02), p); skP.push(p[0], p[1] + Math.min(0, prof[P - 1][1]) - 0.02, p[2]);
        track.point(s, side * (half + 1.2), p); skP.push(p[0], p[1] - 5, p[2]);
        const sc = col3(PAL.concrete); for (let c = 0; c < 2; c++) skC.push(sc[0] * 0.18, sc[1] * 0.17, sc[2] * 0.2);
        // a neon strip along the top, reflectors and posts along rails
        if (W.strip) { track.point(s, side * (half + 0.55 + 0.3), p); neon.push(p[0], p[1] + 0.91, p[2]); track.point(s, side * (half + 0.55 + 0.22), p); neon.push(p[0], p[1] + 0.91, p[2]); neonCol.push(W.strip.r * 2.2, W.strip.g * 2.2, W.strip.b * 2.2, W.strip.r * 2.2, W.strip.g * 2.2, W.strip.b * 2.2); }
        else { neon.push(0, -1000, 0, 0, -1000, 0); neonCol.push(0, 0, 0, 0, 0, 0); }
        if (W.reflect && v % 8 === 0) { track.point(s, side * (half + 0.56), p); ctx.glow(p[0], p[1] + 0.72, p[2], W.reflect, 0.55); }
        if (W.posts && v % 4 === 0) { track.point(s, side * (half + 0.62), p); posts.push(p[0], p[1], p[2]); }
      }
      for (let v = 0; v < n; v++) for (let q = 0; q < P - 1; q++) { const a = base + v * P + q, b = a + P; if (side > 0) idx.push(a, b, a + 1, a + 1, b, b + 1); else idx.push(a, a + 1, b, a + 1, b + 1, b); }
      for (let v = 0; v < n; v++) { const a = nb + v * 2, b = a + 2; if (neon[a * 3 + 1] > -999 && neon[b * 3 + 1] > -999) neonIdx.push(a, b, a + 1, a + 1, b, b + 1, a, a + 1, b, a + 1, b + 1, b); }
      for (let v = 0; v < n; v++) { const a = sb + v * 2, b = a + 2; skI.push(a, b, a + 1, a + 1, b, b + 1, a, a + 1, b, a + 1, b + 1, b); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); g.setIndex(idx);
    const walls = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })); walls.name = 'walls'; root.add(walls);
    ctx.wallVerts = { count: pos.length / 3, expected: 2 * (n + 1) * P };
    const gs = new THREE.BufferGeometry(); gs.setAttribute('position', new THREE.Float32BufferAttribute(skP, 3)); gs.setAttribute('color', new THREE.Float32BufferAttribute(skC, 3)); gs.setIndex(skI);
    const skirt = new THREE.Mesh(gs, new THREE.MeshBasicMaterial({ vertexColors: true })); skirt.name = 'skirt'; root.add(skirt);
    if (neonIdx.length) {
      const gn = new THREE.BufferGeometry();
      gn.setAttribute('position', new THREE.Float32BufferAttribute(neon, 3)); gn.setAttribute('color', new THREE.Float32BufferAttribute(neonCol, 3)); gn.setIndex(neonIdx);
      const strip = new THREE.Mesh(gn, new THREE.MeshBasicMaterial({ vertexColors: true })); strip.name = 'neon'; root.add(strip);
    }
    if (posts.length) {
      const pg = new THREE.BoxGeometry(0.12, 0.85, 0.12); pg.translate(0, 0.42, 0);
      const pm = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.08, 0.07, 0.1) }), posts.length / 3);
      const mt = new THREE.Matrix4();
      for (let k = 0; k < posts.length / 3; k++) { mt.makeTranslation(posts[k * 3], posts[k * 3 + 1], posts[k * 3 + 2]); pm.setMatrixAt(k, mt); }
      pm.name = 'posts'; root.add(pm);
    }
  }

  await at(0.82, 'tunnels and bridges');
  // ---------------------------------------------------------------- tunnels: an arched bore through a mound, portals at both ends
  if (tunnels.length) {
    const parts = [], p = [0, 0, 0], q = [0, 0, 0];
    const A = 14; // points round the arch
    const rock = col3(T.moundColor ? new THREE.Color(T.moundColor) : PAL.rock), conc = col3(PAL.concrete), amb = [0, 0, 0], lmp = [0, 0, 0];
    for (const TU of tunnels) {
      const pos = [], colr = [], idx = [];
      const a0 = TU.a - 3, a1 = TU.b + 3, steps = a1 - a0;
      // inner arch (facing in) then the mound's outside (facing out): one ring of 2A points per sample
      for (let v = 0; v <= steps; v++) {
        const i = ((a0 + v) % n + n) % n, s = i * track.step, hw = track.half[i] + 0.55 + 0.62, y0 = track.y[i];
        for (let k = 0; k < A; k++) {
          const t = k / (A - 1), ang = Math.PI * t; // 0 = right foot, PI = left foot
          const lat = -Math.cos(ang) * hw, up = k === 0 || k === A - 1 ? 0 : Math.min(3.2, 3.2 * Math.sin(ang) * 2) + Math.max(0, Math.sin(ang) - 0.55) * 7.5;
          track.point(s, lat, p); pos.push(p[0], y0 + up, p[2]);
          const nx = Math.cos(ang) * track.tz[i], nz = -Math.cos(ang) * -track.tx[i], ny = -Math.sin(ang);
          ambient(0, -1, 0, 0, amb); lampsAt(LG, p[0], y0 + up, p[2], nx * 0.3, ny, nz * 0.3, lmp);
          for (let c = 0; c < 3; c++) colr.push(conc[c] * (amb[c] * 0.35 + lmp[c] * 0.9) + 0.004);
        }
        // the mound: from one foot out and over to the other, about 14 m high and 34 m either side, its outer edge
        // driven 12 m down so it is buried in the hillside whichever way the land falls (nothing floats)
        for (let k = 0; k < A; k++) {
          const t = k / (A - 1), lat = (t * 2 - 1) * (hw + 34), u = Math.abs(lat) / (hw + 34);
          const n1 = fbm(track.x[i] * 0.04 + k * 0.7, track.z[i] * 0.04 - k * 0.3);
          let up = 14 * Math.pow(Math.max(0, 1 - u * u), 0.7) - 1 + 9 * (n1 - 0.5) * (1 - u * 0.8);
          if (u > 0.86) up = up + (-12 - up) * sstep(0.86, 1, u);
          track.point(s, lat, q); pos.push(q[0], y0 + up, q[2]);
          const sl = Math.sign(lat) * (u > 0.86 ? 1.6 : 1.6 * u), nl = Math.hypot(sl, 1);
          const nx = sl * track.tz[i] / nl, nz = -sl * track.tx[i] / nl, ny = 1 / nl;
          ambient(nx, ny, nz, sunVis(q[0], y0 + up, q[2]), amb);
          const alb = T.albedo(q[0], q[2], y0 + up, 1 - ny, 40);
          for (let c = 0; c < 3; c++) colr.push((alb[c] * 0.7 + rock[c] * 0.3) * amb[c] * (0.85 + 0.3 * n1));
          if (k > 2 && k < A - 3 && k !== (A >> 1) && v % 7 === 3) ctx.moundSpots.push([q[0], y0 + up - 0.4, q[2]]);
        }
      }
      const ring = 2 * A;
      for (let v = 0; v < steps; v++) for (let k = 0; k < A - 1; k++) {
        const a = v * ring + k, b = a + ring; idx.push(a, a + 1, b, a + 1, b + 1, b);              // inner, seen from inside
        const c = v * ring + A + k, d = c + ring; idx.push(c, d, c + 1, c + 1, d, d + 1);          // outer, seen from outside
      }
      // portals: a concrete frame round the arch, then the mound's earth and rock out to its outline, at both ends
      for (const end of [0, steps]) {
        const base = end * ring, flip = end === 0, fb = pos.length / 3;
        const i = ((a0 + end) % n + n) % n, cxp = track.x[i], czp = track.z[i], y0 = track.y[i];
        for (let k = 0; k < A; k++) {
          const ax = pos[(base + k) * 3], ay = pos[(base + k) * 3 + 1], az = pos[(base + k) * 3 + 2];
          const ox = pos[(base + A + k) * 3], oy = pos[(base + A + k) * 3 + 1], oz = pos[(base + A + k) * 3 + 2];
          // the frame: 1.6 m proud of the arch, measured out from the bore's centre
          const dx = ax - cxp, dy = ay - (y0 + 2.4), dz = az - czp, L = Math.hypot(dx, dy, dz) || 1, f = 1.6 / L;
          const fx = ax + dx * f, fy = Math.max(y0 - 0.2, ay + dy * f), fz = az + dz * f;
          pos.push(ax, ay, az, fx, fy, fz, fx, fy, fz, ox, oy, oz);
          const n1 = fbm(fx * 0.3, fy * 0.3), alb = T.albedo(ox, oz, oy, 0.6, 40);
          for (const cc of [conc, conc]) colr.push(cc[0] * 0.42, cc[1] * 0.42, cc[2] * 0.45);
          for (let q = 0; q < 2; q++) colr.push((alb[0] * 0.6 + rock[0] * 0.4) * 0.2 * (0.7 + 0.6 * n1), (alb[1] * 0.6 + rock[1] * 0.4) * 0.2 * (0.7 + 0.6 * n1), (alb[2] * 0.6 + rock[2] * 0.4) * 0.22 * (0.7 + 0.6 * n1));
        }
        for (let k = 0; k < A - 1; k++) for (const [p0, p1] of [[0, 1], [2, 3]]) {
          const a = fb + k * 4 + p0, b = fb + k * 4 + p1, c = a + 4, d = b + 4;
          if (flip) idx.push(a, b, c, c, b, d); else idx.push(a, c, b, c, d, b);
        }
        void base;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); g.setIndex(idx);
      parts.push(g);
      // portal lamps
      for (const e of [TU.a - 3, TU.b + 3]) { const i = ((e % n) + n) % n; track.point(i * track.step, 0, p); ctx.glow(p[0], track.y[i] + 6.9, p[2], PAL.sodium, 3.2); }
      for (let v = 0; v <= steps; v += 3) { const i = ((a0 + v) % n + n) % n; ctx.placed.push({ x: track.x[i], z: track.z[i], r: 0, y0: track.y[i], what: 'tunnel', skip: true }); }
    }
    const mesh = new THREE.Mesh(mergeIndexed(parts), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })); mesh.name = 'tunnels'; root.add(mesh);
  }

  const uWater = { value: 1 }; if (FULL) (ctx.switches.water ||= []).push(uWater); // 11-26 Full: the water's own switch
  // ---------------------------------------------------------------- bridges: a deck under the road, piers down to the gorge
  if (bridges.length) {
    const parts = [], p = [0, 0, 0];
    const deckC = new THREE.Color(PAL.concrete).multiplyScalar(0.55);
    for (const B of bridges) {
      // the deck's underside and sides, as a box per few metres (cheap and it closes itself)
      for (let q = B.a - 4; q <= B.b + 4; q += 4) {
        const i = ((q % n) + n) % n, j = ((q + 4) % n + n) % n, w = (track.half[i] + 1.3) * 2;
        const len = 4.3, g = new THREE.BoxGeometry(w, 1.4, len); g.rotateY(track.psi[i]); g.translate((track.x[i] + track.x[j]) / 2, (track.y[i] + track.y[j]) / 2 - 0.82, (track.z[i] + track.z[j]) / 2);
        parts.push(colorGeom(g, deckC, 1));
      }
      // piers every 26 m: a pair of columns from the deck down into the gorge floor
      for (let q = B.a + 14; q <= B.b - 14; q += 26) {
        const i = q % n;
        for (const side of [1, -1]) {
          track.point(i * track.step, side * (track.half[i] - 0.6), p);
          const top = track.y[i] - 1.4, bot = hAt(p[0], p[2]) - 2, hgt = top - bot; if (hgt < 2) continue;
          const g = new THREE.BoxGeometry(1.5, hgt, 1.5); g.rotateY(track.psi[i]); g.translate(p[0], bot + hgt / 2, p[2]);
          parts.push(colorGeom(g, deckC, 1));
        }
      }
      // lamps along the parapets
      for (let q = B.a + 6; q <= B.b - 6; q += 18) { const i = q % n; for (const side of [1, -1]) { track.point(i * track.step, side * (track.half[i] + 0.8), p); ctx.glow(p[0], track.y[i] + 1.5, p[2], PAL.sodium, 1.6); } }
    }
    const mesh = new THREE.Mesh(mergeGeoms(parts), new THREE.MeshBasicMaterial({ vertexColors: true })); mesh.name = 'bridges'; root.add(mesh);
    // a river at the bottom of each gorge
    for (const G of gorges) {
      // only along the gorge's deep part (further out the valley floor rises above the water and hides it)
      const L = 420, Wd = Math.max(12, G.half * 0.6), g = new THREE.PlaneGeometry(Wd, L, 1, 1); g.rotateX(-Math.PI / 2);
      g.rotateY(Math.atan2(G.ux, G.uz)); g.translate(G.mx, G.base - G.depth + 1.2, G.mz);
      const river = new THREE.Mesh(g, waterMaterial(sun, uTime, 'river', FULL && uWater)); river.name = 'river'; root.add(river);
    }
  }

  await at(0.84, 'lamps and zones');
  // ---------------------------------------------------------------- the lamps themselves: poles, heads
  if (ctx.mounts.length) {
    const byStyle = {};
    for (const M of ctx.mounts) (byStyle[M.style || 'arm'] ||= []).push(M);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), ps = new THREE.Vector3();
    for (const [style, list] of Object.entries(byStyle)) {
      const ht = style === 'mast' ? 18 : 8;
      const pole = new THREE.CylinderGeometry(style === 'mast' ? 0.22 : 0.09, style === 'mast' ? 0.34 : 0.14, ht, 6); pole.translate(0, ht / 2, 0);
      const arm = style === 'mast' ? new THREE.BoxGeometry(3.4, 0.25, 0.25) : new THREE.BoxGeometry(0.1, 0.1, 2.5); arm.translate(0, ht - 0.15, style === 'mast' ? 0 : 1.2);
      const head = style === 'mast' ? new THREE.BoxGeometry(3.6, 0.6, 0.5) : new THREE.BoxGeometry(0.42, 0.14, 0.7); head.translate(0, style === 'mast' ? ht - 0.6 : ht - 0.3, style === 'mast' ? 0.2 : 2.3);
      const poles = new THREE.InstancedMesh(mergeGeoms([pole, arm]), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.06, 0.05, 0.08) }), list.length);
      const heads = new THREE.InstancedMesh(head, new THREE.MeshBasicMaterial({ color: 0xffffff }), list.length);
      list.forEach((M, k) => {
        M.y = Math.min(M.y, ctx.ground(M.x, M.z, style === 'mast' ? 0.4 : 0.15) - 0.05); // the foot on the ground, never above it
        e.set(0, Math.atan2(M.ax, M.az), 0); qq.setFromEuler(e); ps.set(M.x, M.y, M.z); m4.compose(ps, qq, sc);
        poles.setMatrixAt(k, m4); heads.setMatrixAt(k, m4);
        const c = M.color; heads.setColorAt(k, new THREE.Color(c.r * 3, c.g * 3, c.b * 3));
        ctx.placed.push({ x: M.x, z: M.z, r: style === 'mast' ? 0.4 : 0.15, y0: M.y, what: 'lamp ' + style });
      });
      poles.name = 'poles-' + style; heads.name = 'heads-' + style; root.add(poles, heads);
    }
  }

  // ---------------------------------------------------------------- zones: glowing bands on the road
  const zoneState = { value: new Float32Array(32) };
  // the zone colours are uniforms so the colour-safe option can swap them live (cars builder, day 4)
  const zoneCol = { value: PAL.zone.clone() }, sweetCol = { value: PAL.sweet.clone() };
  {
    const pos = [], aT = [], aU = [], aZ = [], aR = [], aM = [], idx = [];
    const p = [0, 0, 0];
    for (const zn of track.zones) {
      const base = pos.length / 3, steps = Math.ceil(zn.len / 1.0);
      for (let k = 0; k <= steps; k++) {
        const d = Math.min(zn.len, k * 1.0), t = d / zn.len, s = zn.s0 + d, i = Math.floor(track.wrapS(s) / track.step) % n;
        const line = track.zoneLine(zn, t, track.half[i]);
        for (const u of [-1, 1]) { track.point(s, line + u * zn.zoneHalf, p); pos.push(p[0], p[1] + 0.045, p[2]); aT.push(t); aU.push(u); aZ.push(Math.min(31, zn.id)); aR.push(zn.sweetHalf / zn.zoneHalf); aM.push(d); }
      }
      for (let k = 0; k < steps; k++) { const a = base + k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      // beacons on both walls where the zone starts
      for (const side of [1, -1]) { const i0 = Math.floor(zn.s0 / track.step) % n; track.point(zn.s0, side * (track.half[i0] + 0.85), p); ctx.glow(p[0], p[1] + 1.2, p[2], PAL.zone, 3.2); ctx.glow(p[0], p[1] + 2.4, p[2], PAL.sweet, 2.4); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    for (const [nm, a] of [['aT', aT], ['aU', aU], ['aZ', aZ], ['aR', aR], ['aM', aM]]) g.setAttribute(nm, new THREE.Float32BufferAttribute(a, 1));
    g.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { time: uTime, state: zoneState, zoneCol, sweetCol }),
      fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      vertexShader: `attribute float aT; attribute float aU; attribute float aZ; attribute float aR; attribute float aM; varying float vT; varying float vU; varying float vR; varying float vM; varying float vS;
        uniform float state[32];
        #include <fog_pars_vertex>
        void main() { vT = aT; vU = aU; vR = aR; vM = aM; vS = state[int(aZ + 0.5)]; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader: `uniform float time; uniform vec3 zoneCol; uniform vec3 sweetCol; varying float vT; varying float vU; varying float vR; varying float vM; varying float vS;
        #include <fog_pars_fragment>
        void main() {
          float u = abs(vU);
          float rim = smoothstep(0.84, 0.95, u) * (1.0 - smoothstep(0.97, 1.0, u));
          float fill = 0.07 * (1.0 - u * 0.5);
          float sw = 1.0 - smoothstep(vR - 0.05, vR, u);
          float swRim = smoothstep(vR - 0.16, vR - 0.05, u) * sw;
          float p = fract(vM / 3.2 - time * 1.4 + u * 0.55);
          float chev = smoothstep(0.0, 0.06, p) * (1.0 - smoothstep(0.14, 0.2, p)) * sw;
          float ends = smoothstep(0.0, 0.035, vT) * (1.0 - smoothstep(0.965, 1.0, vT));
          float lit = vS > 1.5 ? 1.0 + 0.25 * sin(time * 7.0) : vS > 0.5 ? 0.85 + 0.15 * sin(time * 3.0) : 0.5;
          vec3 c = zoneCol * (rim * 1.4 + fill) + sweetCol * (sw * 0.16 + swRim * 0.9 + chev * 0.55);
          c *= lit * ends;
          #ifdef USE_FOG
          float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth); c *= 1.0 - fogF;
          #endif
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.name = 'zones'; mesh.renderOrder = 2; root.add(mesh);
  }

  // ---------------------------------------------------------------- corner chevrons on the outside walls
  {
    const boards = [], p = [0, 0, 0];
    for (const zn of track.zones) for (let d = 6; d < zn.len - 6; d += zn.hairpin ? 7 : 11) {
      const s = zn.s0 + d, i = Math.floor(track.wrapS(s) / track.step) % n, side = -zn.side;
      if (inTunnel[i]) continue;
      track.point(s, side * (track.half[i] + 1.15), p);
      boards.push([p[0], p[1], p[2], track.psi[i], side]);
    }
    const geo = new THREE.PlaneGeometry(1.1, 1.1); geo.translate(0, 1.55, 0);
    const chev = TX.chevron(); disposables.push(chev);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: chev, side: THREE.DoubleSide, color: new THREE.Color(1.3, 1.2, 1.2) }), Math.max(1, boards.length));
    im.count = boards.length;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    boards.forEach((b, k) => { e.set(0, b[3] + Math.PI + (b[4] > 0 ? -0.35 : 0.35), 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(b[0], b[1], b[2]), q, new THREE.Vector3(b[4] > 0 ? 1 : -1, 1, 1)); im.setMatrixAt(k, m4); });
    im.name = 'chevrons'; root.add(im);
  }

  // ---------------------------------------------------------------- the start gantry, and the grid boxes for a duel
  {
    const parts = [], p0 = track.point(1.2, 0), h0 = track.half[1] + 1.0, psi = track.psi[1];
    for (const side of [1, -1]) { const q = track.point(1.2, side * h0); const g = new THREE.BoxGeometry(0.6, 6.5, 0.6); g.translate(q[0], q[1] + 3.25, q[2]); parts.push(g); }
    const beam = new THREE.BoxGeometry(2 * h0 + 0.6, 0.9, 0.7); beam.rotateY(psi + Math.PI / 2); beam.translate(p0[0], p0[1] + 6.6, p0[2]); parts.push(beam);
    const gm = new THREE.Mesh(mergeGeoms(parts.map((g) => colorGeom(g, new THREE.Color(0.08, 0.07, 0.11), 1))), new THREE.MeshBasicMaterial({ vertexColors: true }));
    gm.name = 'gantry'; root.add(gm);
    for (let l = -h0 + 0.8; l <= h0 - 0.8; l += 1.4) { const q = track.point(1.2, l); ctx.glow(q[0], q[1] + 6.1, q[2], [1.0, 0.85, 0.7], 1.5); }
    if (course.duel && course.duel.grid) {
      // two painted boxes on the grid: the player's slot and the rival's (the duels come later)
      const bx = [], p = [0, 0, 0];
      for (const [s, lat] of course.duel.grid) {
        for (const [a, b, l0, l1] of [[s - 2.6, s - 2.4, -1.15, 1.15], [s + 2.4, s + 2.6, -1.15, 1.15], [s - 2.6, s + 2.6, -1.15, -0.95], [s - 2.6, s + 2.6, 0.95, 1.15]]) {
          const v0 = bx.length / 3;
          for (const [ss, ll] of [[a, l0], [b, l0], [a, l1], [b, l1]]) { track.point(ss, lat + ll, p); bx.push(p[0], p[1] + 0.05, p[2]); }
          void v0;
        }
      }
      const idx = []; for (let k = 0; k < bx.length / 3; k += 4) idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3, k, k + 1, k + 2, k + 1, k + 3, k + 2);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(bx, 3)); g.setIndex(idx);
      const grid = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.82, 0.78), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })); grid.name = 'grid'; root.add(grid);
    }
  }

  await at(0.85, 'the scenery');
  // ---------------------------------------------------------------- the region's own dressing
  S.dress(ctx);
  if (FULL) {
    // 11-26 Full: the region's new kit, light and moving things, then a soft contact shadow under everything placed near
    // the road (0.1.21's things too) and the pools of light the region asked for
    if (S.dressFull) S.dressFull(ctx);
    D.decals(ctx, D.shadowsFor(ctx, 0, Object.assign({ reach: ctx.lite ? 45 : 80 }, S.shadowOpts || {})));
    if (ctx.pools.length) D.decals(ctx, ctx.pools, { light: true });
  }
  await at(0.96, 'the sky');

  // ---------------------------------------------------------------- the far side: painted silhouettes all round
  {
    const layers = (S.far && S.far(ctx)) || [];
    if (FULL && S.farFull) layers.push(...S.farFull(ctx));
    const parts = [], hz = PAL.fog.clone().lerp(PAL.horizonAway, 0.45);
    for (const L of layers) {
      const pos = [], colr = [], idx = [], c0 = new THREE.Color(L.lo), c1 = new THREE.Color(L.hi), seg = L.seg || 220;
      for (let k = 0; k <= seg; k++) {
        const a = k / seg * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
        const hgt = L.shape(a, k, dx, dz);
        const x = cx + dx * L.r, z = cz + dz * L.r;
        pos.push(x, (L.base ?? -12), z, x, hgt, z);
        const t = clamp((hgt - (L.base ?? -12)) / (L.span || 400), 0, 1);
        if (FULL) { // 11-26: the farther the range, the more of the air between: its foot sinks into the haze
          const k0 = clamp((L.r - 1100) / 1700, 0.18, 0.72) * (L.haze ?? 1), k1 = k0 * 0.4 * (1 - t * 0.5);
          const tr = c0.r + (c1.r - c0.r) * t, tg = c0.g + (c1.g - c0.g) * t, tb = c0.b + (c1.b - c0.b) * t;
          colr.push(c0.r + (hz.r - c0.r) * k0, c0.g + (hz.g - c0.g) * k0, c0.b + (hz.b - c0.b) * k0, tr + (hz.r - tr) * k1, tg + (hz.g - tg) * k1, tb + (hz.b - tb) * k1);
        } else colr.push(c0.r, c0.g, c0.b, c0.r + (c1.r - c0.r) * t, c0.g + (c1.g - c0.g) * t, c0.b + (c1.b - c0.b) * t);
      }
      for (let k = 0; k < seg; k++) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); g.setIndex(idx);
      parts.push(g);
    }
    if (parts.length) { const mtn = new THREE.Mesh(mergeIndexed(parts), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })); mtn.name = 'far'; mtn.renderOrder = -1; root.add(mtn); }
  }

  // ---------------------------------------------------------------- every glow in one draw: additive soft points
  {
    const gp = ctx.glows, cnt = gp.length / 8, pos = new Float32Array(cnt * 3), colr = new Float32Array(cnt * 3), size = new Float32Array(cnt), blink = new Float32Array(cnt);
    for (let k = 0; k < cnt; k++) { for (let c = 0; c < 3; c++) { pos[k * 3 + c] = gp[k * 8 + c]; colr[k * 3 + c] = gp[k * 8 + 3 + c]; } size[k] = gp[k * 8 + 6]; blink[k] = gp[k * 8 + 7]; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); g.setAttribute('aBlink', new THREE.BufferAttribute(blink, 1));
    const m = glowMaterial(uTime, FULL);
    if (FULL) (ctx.switches.motion ||= []).push(m.uniforms.flick);
    const pts = new THREE.Points(g, m); pts.name = 'glows'; pts.frustumCulled = false; pts.renderOrder = 3; root.add(pts);
    root.userData.glowMat = m;
  }

  // ---------------------------------------------------------------- sky and water
  const SK = Object.assign({ disc: 0.085, bands: true, clouds: 0.85, stars: 1, moon: null, haze: 0 }, look.sky || {});
  // 11-26 Full: the cloud deck (scale: how big the clouds; cover: the density range that becomes cloud; light: what lights
  // their edges, the sun or the moon), rays round the sun, a halo round the moon
  const SF = Object.assign({ scale: 0.16, cover: [0.5, 0.72], k: 0.8, hi: 0.7, drift: [0.0035, 0.0012], light: 'sun', shadow: null, lit: null, rays: 0, halo: 0 }, look.skyFull || {});
  const uSky = { value: 1 }; if (FULL) (ctx.switches.sky ||= []).push(uSky);
  const moonV = SK.moon ? new THREE.Vector3().fromArray(SK.moon).normalize() : null, LDIR = SF.light === 'moon' && moonV ? moonV : sun;
  const cShadow = SF.shadow ? new THREE.Color(SF.shadow) : PAL.zenith.clone().lerp(PAL.sky, 0.6).multiplyScalar(0.9), cLit = SF.lit ? new THREE.Color(SF.lit) : PAL.horizonSun.clone();
  const moon = SK.moon ? new THREE.Vector3().fromArray(SK.moon).normalize() : null;
  const skyMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ time: uTime, stars: { value: 1 } }, FULL ? { grain: { value: grainTex }, uSky } : {}), depthWrite: false, side: THREE.BackSide, fog: false, // stars: 0 in the cars' reflections (reflect.js)
    vertexShader: `varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform float time; uniform float stars; varying vec3 vDir;${FULL ? ' uniform sampler2D grain; uniform float uSky;' + SAFE : ''}
      ${SKY_GLSL(sun)}
      float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = skyCol(d);
        // streaks of cloud low over the horizon, lit from below by the sun
        float az = atan(d.x, d.z);
        float n = vn(vec2(${FULL ? '(az + time * 0.0025)' : 'az'} * 6.0, d.y * 38.0)) * 0.6 + vn(vec2(${FULL ? '(az + time * 0.0025)' : 'az'} * 17.0, d.y * 90.0)) * 0.4;
        float band = smoothstep(0.02, 0.07, d.y) * (1.0 - smoothstep(0.12, 0.26, d.y));
        float cl = smoothstep(0.55, 0.8, n) * band;
        float sa = max(dot(d, SUN), 0.0);
        c = mix(c, mix(${g3(PAL.zenith)} * 1.2 + vec3(0.03, 0.0, 0.05), ${g3(PAL.horizonSun)} * 1.1, pow(sa, 3.0) * 0.9 + 0.1), cl * ${SK.clouds.toFixed(3)});
        ${SK.disc > 0 ? `// the sun: a big disc with bands cut through its lower half
        float ang = acos(clamp(dot(d, SUN), -1.0, 1.0)), R = ${SK.disc.toFixed(4)};
        if (ang < R && d.y > -0.02) {
          float y = (d.y - SUN.y) / R;
          float cut = ${SK.bands ? 'y < 0.15 ? step(0.5 + y * 0.9, fract(y * 7.0 + 0.3)) : 1.0' : '1.0'};
          vec3 sc = mix(vec3(1.0, 0.24, 0.42), ${g3(PAL.sunCore)}, smoothstep(-0.9, 0.8, y));
          c = mix(c, sc * 1.45, cut * (1.0 - smoothstep(R * 0.96, R, ang)));
        }` : ''}
        ${moon ? `// the moon: a pale disc with a soft halo
        { vec3 M = normalize(vec3(${moon.x.toFixed(4)}, ${moon.y.toFixed(4)}, ${moon.z.toFixed(4)})); float ma = acos(clamp(dot(d, M), -1.0, 1.0)), MR = ${(SK.moonSize || 0.05).toFixed(4)};
          c += vec3(0.55, 0.6, 0.9) * exp(-ma * ma / (MR * MR * 9.0)) * 0.25;
          float disc = 1.0 - smoothstep(MR * 0.95, MR, ma); float mot = vn(d.xz * 90.0) * 0.18;
          c = mix(c, vec3(0.92, 0.9, 1.0) * (0.85 - mot), disc); }` : ''}
${FULL ? `        // 11-26 Full: a deck of cloud overhead receding to the horizon, drifting, lit on its edges toward the light
        // 11-26 (4): no branch round the lookups (a texture read inside a branch the horizon splits has no defined level of
        // detail on a phone's GPU); below the horizon the deck's own fade (cdn) is 0
        float cdn = 0.0;
        {
          const vec3 LDIR = normalize(vec3(${LDIR.x.toFixed(4)}, ${LDIR.y.toFixed(4)}, ${LDIR.z.toFixed(4)}));
          vec2 cp = d.xz / (max(d.y, 0.0) + 0.08) * ${SF.scale.toFixed(4)} + vec2(time * ${SF.drift[0].toFixed(5)}, time * ${SF.drift[1].toFixed(5)});
          float a1 = texture2D(grain, cp).g, a2 = texture2D(grain, cp * 2.37 + 0.31).g, a3 = texture2D(grain, cp * 5.11 + 0.67).g;
          vec2 tl = normalize(LDIR.xz + vec2(0.0001)) * 0.05;
          float b1 = texture2D(grain, cp + tl).g, b2 = texture2D(grain, (cp + tl) * 2.37 + 0.31).g;
          float rim = clamp(((a1 * 0.55 + a2 * 0.3) - (b1 * 0.55 + b2 * 0.3)) * 7.0 + 0.3, 0.0, 1.0);
          cdn = smoothstep(${SF.cover[0].toFixed(3)}, ${SF.cover[1].toFixed(3)}, a1 * 0.55 + a2 * 0.3 + a3 * 0.15) * smoothstep(0.012, 0.15, d.y) * (1.0 - smoothstep(${SF.hi.toFixed(3)}, 1.0, d.y)) * ${SF.k.toFixed(3)} * uSky;
          float la = max(dot(d, LDIR), 0.0);
          vec3 body = mix(${g3(cShadow)}, ${g3(cLit)}, rim * (0.25 + 0.75 * pow(la, 2.0))) + ${g3(cLit)} * pow(la, 10.0) * 0.55;
          c = mix(c, body, cdn);
        }
${SF.rays ? `        { vec3 ax1 = normalize(cross(SUN, vec3(0.0, 1.0, 0.0))), ax2 = cross(ax1, SUN); float ang = atan(dot(d, ax2), dot(d, ax1) + 1e-6);
          float ry = texture2D(grain, vec2(ang * 0.477465, time * 0.004)).g;
          c += ${g3(PAL.horizonSun)} * smoothstep(0.42, 0.85, ry) * pow(max(dot(d, SUN), 0.0), 5.0) * ${SF.rays.toFixed(3)} * uSky * (1.0 - cdn * 0.5); }
` : ''}${SF.halo && moon ? `        { vec3 M = normalize(vec3(${moon.x.toFixed(4)}, ${moon.y.toFixed(4)}, ${moon.z.toFixed(4)})); float ma = acos(clamp(dot(d, M), -1.0, 1.0)); float hd = (ma - 0.38) / 0.03; c += vec3(0.42, 0.48, 0.75) * exp(-hd * hd) * ${SF.halo.toFixed(3)} * uSky; } // 11-26 (4): was pow() of a negative number inside the ring (undefined: NaN on a phone's GPU, a black ring round the moon)
` : ''}` : ''}        // stars, fading in toward the top
        vec2 sp = floor(vec2(az * 260.0, d.y * 260.0));
        float st = step(0.9965, h1(sp)) * smoothstep(0.18, 0.6, d.y) * (0.6 + 0.4 * sin(time * 2.0 + h1(sp + 3.0) * 40.0)) * ${SK.stars.toFixed(3)} * stars${FULL ? ' * (1.0 - cdn)' : ''};
        c += vec3(0.9, 0.85, 1.0) * st;
        gl_FragColor = vec4(${FULL ? 'ddSafe(c)' : 'c'}, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), skyMat); sky.name = 'sky'; sky.renderOrder = -2; sky.frustumCulled = false;
  root.add(sky); root.userData.skyMat = skyMat;
  const WA = (S.water && S.water(ctx)) || look.water || { kind: 'sea', level: course.seaLevel ?? -1.6 };
  if (WA.kind !== 'none') {
    const seaG = new THREE.PlaneGeometry(9000, 9000, 1, 1); seaG.rotateX(-Math.PI / 2);
    const sea = new THREE.Mesh(seaG, waterMaterial(sun, uTime, WA.kind, FULL && uWater)); sea.position.set(cx, WA.level, cz); sea.name = 'water'; root.add(sea);
  }

  // ---------------------------------------------------------------- what the game reads
  const fog = Object.assign({ color: PAL.fog.clone(), density: 0.0024 }, look.fogDensity ? { density: look.fogDensity } : {});
  return {
    root, lamps: ctx.lamps, roadLight, fog, look,
    zoneState: zoneState.value,
    setZoneColors(z, sw) { zoneCol.value.copy(z); sweetCol.value.copy(sw); },
    // 11-26: which detail this world was made with, and what the cars' reflection cube leaves out of it (main.js)
    detail: FULL ? 'full' : 'classic', noReflect: ctx.noReflect,
    focus(y) { ctx.uFloor.value = y; }, // the road height where the car is (what blows on the wind stays near it)
    update(t) {
      uTime.value = t;
      if (FULL) { // the five-tap panel's layer switches (TUNING.world), live; the moving things only while motion is on
        const W = TUNING.world;
        for (const k in ctx.layers) { const on = (W[k] ?? 1) > 0.5; for (const o of ctx.layers[k]) o.visible = on; }
        for (const k in ctx.switches) { const v = (W[k] ?? 1) > 0.5 ? 1 : 0; for (const u of ctx.switches[k]) u.value = v; }
        if ((W.motion ?? 1) > 0.5) for (const f of ctx.onFrame) f(t);
      }
    },
    // the baked light where the car is (for tinting the car and its smoke)
    lightAt(i, out) { out[0] = roadLight[i * 3]; out[1] = roadLight[i * 3 + 1]; out[2] = roadLight[i * 3 + 2]; return out; },
    setPixelRatio(pr) { root.userData.glowMat.uniforms.scale.value = pr; for (const m of ctx.scaled) m.uniforms.scale.value = pr; },
    // a quiet camera path for the title and the course card: from the region (or a drive along the road)
    titleShot: S.titleShot ? S.titleShot(ctx) : null,
    hAt,
    dispose() {
      root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { for (const m of [].concat(o.material)) m.dispose(); } });
      for (const t of disposables) t.dispose();
    },
    // the craft rules (mixed physics stance), measured: returns counts and the worst offenders
    audit() {
      const out = { groundOverRoad: 0, roadHanging: 0, worstOver: 0, worstHang: 0, scenery: [], walls: ctx.wallVerts.count === ctx.wallVerts.expected, nan: 0, placed: ctx.placed.length };
      for (let i = 0; i < n; i++) {
        const hw = track.half[i] + 0.6;
        for (let lat = -hw; lat <= hw; lat += 0.5) {
          const px = track.x[i] + track.tz[i] * lat, pz = track.z[i] - track.tx[i] * lat, gh = hAt(px, pz), ry = track.y[i];
          if (!isFinite(gh)) out.nan++;
          if (gh > ry - 0.05) { out.groundOverRoad++; out.worstOver = Math.max(out.worstOver, gh - ry); }
          if (track.kind[i] !== 3 && Math.abs(lat) > track.half[i] && gh < ry - 4.9) { out.roadHanging++; if (ry - gh > out.worstHang) { out.worstHang = ry - gh; out.hangAt = [i, +px.toFixed(1), +pz.toFixed(1), track.kind[i]]; } }
        }
      }
      for (const P of ctx.placed) {
        if (P.skip) continue;
        const nr = nearRoad(P.x, P.z, 3), clearance = nr ? nr.d - track.half[nr.i] - 0.55 - P.r : 1e4;
        const g = ctx.ground(P.x, P.z, P.r);
        const floating = P.y0 > g + 0.08 && !P.hangs;
        if (clearance < 0.3 || floating) out.scenery.push({ what: P.what, x: +P.x.toFixed(1), z: +P.z.toFixed(1), clearance: +clearance.toFixed(2), floats: floating ? +(P.y0 - g).toFixed(2) : 0 });
      }
      return out;
    },
  };
}

// water: the sea (sky reflection, sun glitter, moving waves), a river, or a sea of cloud far below
export function waterMaterial(sun, uTime, kind = 'sea', uWater = null) {
  const cloud = kind === 'clouds', F = !!uWater; // 11-26: uWater given = Full (the sun's path)
  return new THREE.ShaderMaterial({
    uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { time: uTime }, F ? { uWater } : {}), fog: true,
    vertexShader: `varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float time; varying vec3 vWorld;${F ? ' uniform float uWater;' + SAFE : ''}
      #include <fog_pars_fragment>
      ${SKY_GLSL(sun)}
      float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec2 p = vWorld.xz;
        vec3 V = normalize(vWorld - cameraPosition);
        ${cloud ? `
        // a sea of cloud: soft billows lit from the sun's side, darker in the troughs
        vec2 q = p * 0.004 + vec2(time * 0.004, time * 0.002);
        float b = vn(q * 3.0) * 0.5 + vn(q * 7.0) * 0.3 + vn(q * 17.0 + 3.0) * 0.2;
        float sa = pow(max(dot(normalize(vec3(V.x, 0.0, V.z)), normalize(vec3(SUN.x, 0.0, SUN.z))), 0.0), 3.0);
        vec3 c = mix(${g3(PAL.fog)} * 0.75, mix(${g3(PAL.skyAmb)} * 1.15, ${g3(PAL.horizonSun)}, sa * 0.75), smoothstep(0.35, 0.8, b));
        c += ${g3(PAL.sunLight)} * pow(b, 3.0) * sa * 0.35;
${F ? `        // 11-26 Full: the low sun's road of light across the cloud tops
        c += ${g3(PAL.sunLight)} * pow(max(dot(normalize(vec3(V.x, V.y * 0.25, V.z)), normalize(vec3(SUN.x, -SUN.y * 0.25, SUN.z))), 0.0), 40.0) * (0.25 + 0.5 * pow(b, 2.0)) * uWater;
` : ''}        gl_FragColor = vec4(${F ? 'ddSafe(c)' : 'c'}, 1.0);` : `
        float a = time * 0.9;
        vec2 g = vec2(cos(p.x * 0.09 + a) * 0.5 + cos((p.x + p.y) * 0.05 - a * 0.7) * 0.4, cos(p.y * 0.11 + a * 1.2) * 0.5 + cos((p.x - p.y) * 0.21 + a * 1.6) * 0.25);
        vec3 n = normalize(vec3(g.x * ${kind === 'river' ? '0.14' : '0.08'}, 1.0, g.y * 0.08));
        vec3 Rr = reflect(V, n); Rr.y = abs(Rr.y);
        float fres = 0.04 + 0.96 * pow(${F ? 'clamp(1.0 - dot(-V, n), 0.0, 1.0)' : '1.0 - max(dot(-V, n), 0.0)'}, 5.0);
        vec3 c = mix(${g3(PAL.seaDeep)}, skyCol(Rr), clamp(fres + 0.18, 0.0, 1.0));
        float sd = max(dot(Rr, SUN), 0.0);
        c += ${g3(PAL.sunLight)} * (pow(sd, 260.0) * 6.0 + pow(sd, 22.0) * 0.35);
${F ? `        // 11-26 Full: the sun's path, a long column of glints from the horizon toward you
        { vec3 Rs = normalize(vec3(Rr.x, Rr.y * 0.2, Rr.z)), Ss = normalize(vec3(SUN.x, SUN.y * 0.2, SUN.z));
          float path = pow(max(dot(Rs, Ss), 0.0), 160.0);
          vec2 gp = p * 0.45 + vec2(time * 0.5, -time * 0.35);
          float glint = step(0.7, fract(sin(dot(floor(gp), vec2(127.1, 311.7)) + floor(time * 4.0 + h1(floor(gp)) * 4.0) * 0.37) * 43758.5453));
          c += ${g3(PAL.sunLight)} * path * (0.18 + 2.4 * glint) * fres * 1.4 * uWater; }
` : ''}        gl_FragColor = vec4(${F ? 'ddSafe(c)' : 'c'}, 1.0);`}
        #include <fog_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// soft additive points (lamp halos, reflectors, city lights, beacons that blink)
export function glowMaterial(uTime, full = false) {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { time: uTime, scale: { value: 1 } }, full ? { flick: { value: 1 } } : {}),
    fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSize; attribute float aBlink; attribute vec3 color; uniform float time; uniform float scale; varying vec3 vCol;
      #include <fog_pars_vertex>
${full ? `      // 11-26 Full: a lamp whose blink is negative flickers: now and then a few seconds of stutter
      uniform float flick;
      float flicker(float s) { float k = fract(sin(floor(time * 13.0 + s * 41.0) * 12.9898) * 43758.5453), on = step(0.72, fract(time * 0.09 * (0.6 + s) + s * 5.3)); return 1.0 - flick * on * (0.88 - 0.88 * step(0.45, k)); }
` : ''}      void main() { vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        float b = aBlink > 0.0 ? step(0.55, fract(time * 0.5 * aBlink + aBlink * 3.1)) : ${full ? 'aBlink < 0.0 ? flicker(-aBlink) : 1.0' : '1.0'};
        vCol = color * b;
        gl_PointSize = clamp(aSize * 260.0 * scale / -mvPosition.z, 1.5, 160.0 * scale);
        #include <fog_vertex>
      }`,
    fragmentShader: `varying vec3 vCol;${full ? SAFE : ''}
      #include <fog_pars_fragment>
      void main() { vec2 q = gl_PointCoord - 0.5; float d = dot(q, q) * 4.0; float a = (exp(-d * 6.0) + 0.3 * exp(-d * 2.2)) * (1.0 - smoothstep(0.55, 1.0, d)); if (a < 0.003) discard;
        vec3 c = vCol * a;
        #ifdef USE_FOG
        float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth); c *= 1.0 - fogF * 0.85;
        #endif
        gl_FragColor = vec4(${full ? 'ddSafe(c)' : 'c'}, 1.0); }`,
  });
}

// ---- small geometry helpers
export function mergeGeoms(list) {
  // non-indexed merge of position (+ color, uv when every part has them)
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const has = (nm) => parts.every((g) => g.attributes[nm]);
  const out = new THREE.BufferGeometry();
  for (const nm of ['position', 'color', 'uv', 'normal']) {
    if (!has(nm)) continue;
    const size = parts[0].attributes[nm].itemSize;
    const total = parts.reduce((a, g) => a + g.attributes[nm].count, 0), arr = new Float32Array(total * size);
    let o = 0; for (const g of parts) { arr.set(g.attributes[nm].array, o); o += g.attributes[nm].array.length; }
    out.setAttribute(nm, new THREE.BufferAttribute(arr, size));
  }
  return out;
}
// indexed merge of position + color (for the big generated meshes)
export function mergeIndexed(list) {
  const out = new THREE.BufferGeometry();
  const nv = list.reduce((a, g) => a + g.attributes.position.count, 0), ni = list.reduce((a, g) => a + g.index.count, 0);
  const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const g of list) { pos.set(g.attributes.position.array, vo * 3); col.set(g.attributes.color.array, vo * 3); const I = g.index.array; for (let k = 0; k < I.length; k++) idx[io + k] = I[k] + vo; vo += g.attributes.position.count; io += I.length; }
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
export function colorGeom(g, c, k = 1) {
  // bake per-face shading from the face normals into a colour attribute
  const nrm = g.attributes.normal, cnt = g.attributes.position.count, arr = new Float32Array(cnt * 3), amb = [0, 0, 0];
  for (let i = 0; i < cnt; i++) { ambient(nrm.getX(i), nrm.getY(i), nrm.getZ(i), 1, amb); for (let q = 0; q < 3; q++) arr[i * 3 + q] = (q === 0 ? c.r : q === 1 ? c.g : c.b) * k * (k > 1.5 ? 1 : amb[q] * 1.4 + 0.12); }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
export function bakeBox(g, k, top = 2.6) {
  const nrm = g.attributes.normal, p = g.attributes.position, cnt = p.count, arr = new Float32Array(cnt * 3), amb = [0, 0, 0];
  for (let i = 0; i < cnt; i++) { ambient(nrm.getX(i), nrm.getY(i), nrm.getZ(i), 1, amb); const ao = 0.6 + 0.4 * clamp(p.getY(i) / top, 0, 1); for (let q = 0; q < 3; q++) arr[i * 3 + q] = (amb[q] * 1.3 + 0.06) * ao * k; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
