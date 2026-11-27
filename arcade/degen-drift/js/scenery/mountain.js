// DRIFTLINE region 3, Mountain pass: blue hour in the high forest. The last of the sun behind the ridge, a moon over
// the snowfields, dense pines to the rails, rock cut faces on the uphill side, sodium lamps at the hairpins and in the
// tunnels, concrete bridges over gorges with a river below, cabins with lit windows and a fire lookout on the ridge.
import * as THREE from '../../vendor/three/three.module.min.js?v=0.1.25';
import { sstep, fbm, colorGeom, mergeGeoms } from '../world.js?v=0.1.25';
import * as K from './kit.js?v=0.1.25';
import * as D from './detail.js?v=0.1.25';
import * as P from './props.js?v=0.1.25';

const C = (h) => new THREE.Color(h);

export function look() {
  return {
    pal: {
      zenith: '#050a22', sky: '#142a5a', horizonAway: '#3a5a92', horizonSun: '#e8807a', sunCore: '#ffd8b0',
      fog: '#24365e', fogSun: '#46507e', skyAmb: '#4a6aa8', groundAmb: '#141a2a', sunLight: '#c88aa0',
      asphalt: '#3c4252', line: '#e8ecf4', concrete: '#7a8294', rail: '#b8c4d8',
      grass: '#173a34', rock: '#4a5468', sand: '#56586a', seaDeep: '#06142a', sodium: '#ffa64a', led: '#bfe8ff',
    },
    sun: [-0.3, 0.035, 0.95], sunK: 0.5, ambK: 0.85,
    sky: { disc: 0.06, bands: true, clouds: 0.6, stars: 1.2, moon: [0.6, 0.35, -0.7], moonSize: 0.055 },
    water: { kind: 'none' },
    fogDensity: 0.0026,
    road: { runoff: ['#3a6a8a', '#d8e0ea'], kerb: ['#c01020', '#e0e0e8'], glare: 0.14, sunSheen: 0.12 },
    // 11-26 Full: a moonlit deck of cloud, silver on the edges toward the moon, a halo round it, the last light's rays
    skyFull: { scale: 0.14, cover: [0.53, 0.75], k: 0.75, hi: 0.75, drift: [0.0025, 0.0018], light: 'moon', shadow: '#16233e', lit: '#a8b8f0', rays: 0.12, halo: 0.3 },
  };
}

export function lamps(ctx) {
  const { track, PAL } = ctx, lp = [0, 0, 0], lq = [0, 0, 0];
  const spots = [];
  // two lamps round the outside of every hairpin, one at other bends, a few on the start straight
  for (const zn of track.zones) {
    if (zn.hairpin) for (const f of [0.3, 0.7]) spots.push([zn.s0 + zn.len * f, -zn.side]);
    else if (zn.peak > 1 / 60) spots.push([zn.s0 + zn.len * zn.apexT, -zn.side]);
  }
  for (let s = 30; s < 150; s += 40) spots.push([s, -1]);
  for (const [s, side] of spots) {
    const i = Math.floor(track.wrapS(s) / track.step) % track.n; if (track.kind[i] >= 2) continue;
    const half = track.half[i];
    track.point(s, side * (half + 1.7), lp); track.point(s, side * (half - 0.7), lq);
    const c = PAL.sodium;
    ctx.lamps.push({ x: lq[0], y: lq[1] + 7.4, z: lq[2], r: c.r, g: c.g, b: c.b, i: 1.4, range: 22 });
    ctx.mounts.push({ x: lp[0], y: lp[1], z: lp[2], ax: lq[0] - lp[0], az: lq[2] - lp[2], style: 'arm', color: c });
    ctx.glow(lq[0], lq[1] + 7.65, lq[2], c, 5.5);
  }
}

export function terrain(ctx) {
  const { PAL } = ctx;
  return {
    margin: 520, blend: 34, gorgeDepth: 24,
    height(x, z, mem, e) {
      // the slope the road climbs (the membrane), roughened, then mountains rising away from the road
      const rough = (fbm(x * 0.012, z * 0.012) - 0.5) * 16;
      const rise = sstep(12, 240, e) * (40 + fbm(x * 0.003 + 7, z * 0.003) * 180);
      return mem + rough + rise;
    },
    albedo(x, z, h, slope, e) {
      const m = ctx.memAt(x, z), c = PAL.grass.clone().lerp(PAL.rock, sstep(0.22, 0.45, slope));
      // snow above the tree line
      c.lerp(C('#c8d4ec'), sstep(110, 170, h - m) * (1 - sstep(0.5, 0.7, slope)));
      void e; return [c.r, c.g, c.b];
    },
  };
}

export function wall(ctx, kind) {
  const { PAL } = ctx;
  if (kind === 2) return { prof: 'curb', color: [PAL.concrete.r, PAL.concrete.g, PAL.concrete.b], k: 0.7 };
  if (kind === 3) return { prof: 'parapet', color: [PAL.concrete.r, PAL.concrete.g, PAL.concrete.b], k: 0.85, reflect: [1.0, 0.55, 0.15] };
  return { prof: 'rail', color: [PAL.rail.r, PAL.rail.g, PAL.rail.b], reflect: [1.0, 0.55, 0.15], posts: true };
}

export function dress(ctx) {
  const { R, hAt, PAL, track } = ctx;
  const steep = (x, z, d = 4) => Math.abs(hAt(x + d, z) - hAt(x - d, z)) + Math.abs(hAt(x, z + d) - hAt(x, z - d));
  // the forest: two kinds of pine, thick right up to the rails, thinning with height
  const pines = [], firs = [];
  K.scatter(ctx, Math.round(3400 * ctx.dense), (x, z) => {
    const e = ctx.edge(x, z); if (e < 3 || e > 420) return false;
    const above = hAt(x, z) - ctx.memAt(x, z); if (above > 120 + R() * 40) return false;
    if (steep(x, z) > 9) return false;
    if (fbm(x * 0.012, z * 0.012) < 0.36 && e > 20) return false;
    if (!ctx.clear(x, z, 0.6)) return false;
    (R() < 0.6 ? pines : firs).push([x, z, (e < 30 ? 10 : 8) + R() * 9, [0.8 + R() * 0.35, 0.85 + R() * 0.3, 0.9 + R() * 0.3]]);
    return true;
  });
  K.cards(ctx, K.pineArt(ctx, { body: ['#2a5260', '#122a34', '#0c1c26'], rim: '#ff8a7a' }), pines, { name: 'pines' });
  K.cards(ctx, K.pineArt(ctx, { body: ['#1e4a40', '#0e2620', '#081814'], rim: '#9ab8ff', snow: 0.22, seed: 8 }), firs, { name: 'firs' });
  // pines on the tunnel mounds (they stand on the mound, not the land: the audit leaves them be)
  const onMound = ctx.moundSpots.filter(() => R() < 0.8).map(([x, y, z]) => [x, z, 8 + R() * 8, [0.85, 0.9, 0.95], y]);
  cardsAt(ctx, K.pineArt(ctx, { body: ['#2a5260', '#122a34', '#0c1c26'], rim: '#ff8a7a', seed: 5 }), onMound);
  // rock: cut faces on the uphill side of the road (boulders at their foot) and outcrops up the slopes
  const rk = [];
  for (let s = 0; s < track.length; s += 6) {
    const i = Math.floor(s / track.step) % track.n; if (track.kind[i] >= 2) continue;
    for (const side of [1, -1]) {
      const p = track.point(s, side * (track.half[i] + 3 + R() * 6)), up = hAt(p[0], p[2]) - track.y[i];
      if (R() < (up > 2 ? 0.25 : 0.7)) continue;
      const r = 0.8 + R() * (up > 2 ? 3.2 : 1.6); if (!ctx.clear(p[0], p[2], r)) continue;
      rk.push([p[0], p[2], r, 0.6 + R() * 0.5, PAL.rock.clone().multiplyScalar(0.8 + R() * 0.3)]);
    }
  }
  const out = K.scatter(ctx, Math.round(420 * ctx.dense), (x, z) => { const s = steep(x, z, 6); if (s < 7) return false; const r = 3 + R() * 9; if (!ctx.clear(x, z, r, 3)) return false; return [x, z, r, 0.8, PAL.rock.clone().multiplyScalar(0.85)]; });
  K.rocks(ctx, rk.concat(out), { name: 'rocks', seed: 33 });
  // cabins in clearings with warm windows and a lamp by the door
  const cabins = K.scatter(ctx, 16, (x, z) => { const e = ctx.edge(x, z); if (e < 18 || e > 160 || steep(x, z, 6) > 5) return false; if (!ctx.clear(x, z, 7, 5)) return false; return [x, z, 8 + R() * 4, 5 + R() * 2, 6 + R() * 3, R() * 6.28, C('#3a2a26'), 0.5]; });
  K.buildings(ctx, cabins, { name: 'cabins', floor: 2.6, bay: 2.0 });
  for (const c of cabins) ctx.glow(c[0], ctx.ground(c[0], c[1]) + 2.6, c[1], PAL.sodium, 3);
  // the fire lookout: on the highest clear ground near the course, a cabin on stilts with a light
  let best = null;
  K.scatter(ctx, 300, (x, z) => { const e = ctx.edge(x, z); if (e < 40 || e > 260 || !ctx.clear(x, z, 5, 4)) return false; const h = hAt(x, z); if (!best || h > best[2]) best = [x, z, h]; return false; }, 1);
  if (best) {
    const [x, z] = best, y = ctx.ground(x, z, 4) - 0.2, parts = [];
    for (const [dx, dz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) { const g = new THREE.BoxGeometry(0.35, 18, 0.35); g.translate(x + dx, y + 9, z + dz); parts.push(colorGeom(g, C('#2a2226'), 1)); }
    const roof = new THREE.ConeGeometry(4.6, 2.2, 4); roof.rotateY(Math.PI / 4); roof.translate(x, y + 23.6, z); parts.push(colorGeom(roof, C('#3a2a2a'), 1));
    ctx.root.add(Object.assign(new THREE.Mesh(mergeGeoms(parts), new THREE.MeshBasicMaterial({ vertexColors: true })), { name: 'lookout' }));
    K.buildings(ctx, [[x, z, 6, 4.2, 6, 0.3, C('#4a3a34'), 0.9]], { name: 'lookout-cab' });
    ctx.root.children[ctx.root.children.length - 1].position.y = y + 18 - (ctx.ground(x, z, Math.hypot(6, 6) / 2) - 0.4);
    ctx.placed[ctx.placed.length - 1].skip = true;
    ctx.glow(x, y + 21, z, PAL.sodium, 5); ctx.glow(x, y + 25, z, [1, 0.1, 0.05], 2.4, 0.6);
    ctx.placed.push({ x, z, r: 3.5, y0: y, what: 'lookout' });
  }
  // villages far down the valleys: clusters of warm lights
  for (let v = 0; v < 6; v++) {
    const a = R() * 6.28, r = 650 + R() * 450, vx = ctx.bbox.cx + Math.sin(a) * r, vz = ctx.bbox.cz + Math.cos(a) * r, vy = hAt(vx, vz);
    for (let k = 0; k < 30 * ctx.dense; k++) ctx.glow(vx + (R() - 0.5) * 80, vy + 2 + R() * 5, vz + (R() - 0.5) * 80, [1, 0.7, 0.4], 5 + R() * 3);
  }
}

// crossed cards at given heights (on the tunnel mounds)
function cardsAt(ctx, tex, items) {
  if (!items.length) return;
  const { THREE: T3 } = ctx, g1 = new T3.PlaneGeometry(1, 2); g1.translate(0, 1, 0); const g2 = g1.clone(); g2.rotateY(Math.PI / 2);
  const im = new T3.InstancedMesh(mergeGeoms([g1, g2]), new T3.MeshBasicMaterial({ map: tex, alphaTest: 0.45, side: T3.DoubleSide }), items.length);
  const m4 = new T3.Matrix4(), q = new T3.Quaternion(), e = new T3.Euler(), c = new T3.Color(), L = [0, 0, 0];
  items.forEach(([x, z, s, tint, y], k) => { e.set(0, ctx.R() * 3.14, 0); q.setFromEuler(e); m4.compose(new T3.Vector3(x, y, z), q, new T3.Vector3(s * 0.5, s * 0.5, s * 0.5)); im.setMatrixAt(k, m4); ctx.light(x, y + s * 0.5, z, 0, 0.6, 0, L); c.setRGB(L[0] * 1.6 * tint[0], L[1] * 1.6 * tint[1], L[2] * 1.6 * tint[2]); im.setColorAt(k, c); ctx.placed.push({ x, z, r: 0.3, y0: y, what: 'mound pine', skip: true }); });
  im.name = 'mound-pines'; ctx.root.add(im);
}

export function far() {
  // three ranges of peaks, snow catching the last light on the tops
  const peaks = (seed, hs) => (a, k) => 80 + Math.pow(fbm(k * 0.05 + seed, seed), 1.6) * 900 * hs;
  return [
    { r: 2400, lo: '#0c1430', hi: '#d8c8e8', span: 520, seg: 260, shape: peaks(3, 0.9) },
    { r: 1900, lo: '#0a1228', hi: '#8a90c0', span: 420, seg: 260, shape: peaks(11, 0.6) },
    { r: 1500, lo: '#081020', hi: '#2a3a5a', span: 300, seg: 220, shape: peaks(23, 0.35) },
  ];
}

// ================================================================ 11-26 Full detail (graphics uplift part 2)
// Settings > World detail > Full. Nothing above changes; this adds, with its own dice (ctx.R2): a better pine (fuller,
// three cards, a warm and a cool rim), cut logs stacked in the pull-outs, warning signs (deer, falling rock, ice by the
// bridges, the bends), smoke from the cabins, mist lying in the valleys, needles on the wind, the bridge lamps in the
// river, and pools of light under the lamps and the cabins' windows.
export function dressFull(ctx) {
  const { R2: R, hAt, track } = ctx, lite = ctx.lite, free = D.occupancy(ctx);
  const steep = (x, z, d = 4) => Math.abs(hAt(x + d, z) - hAt(x - d, z)) + Math.abs(hAt(x, z + d) - hAt(x, z - d));
  // the better pines
  D.betterPines(ctx, ['pines', 'mound-pines'], D.pineArt2(ctx, { body: ['#2a5260', '#122a34', '#0a1820'], tip: '#4a7a8a', rim: '#ff8a7a', cool: '#9ab8ff', seed: 41 }));
  D.betterPines(ctx, ['firs'], D.pineArt2(ctx, { body: ['#1e4a40', '#0e2620', '#071410'], tip: '#3a6a5a', rim: '#d8a0a8', cool: '#9ab8ff', snow: 0.35, seed: 43 }));
  // log piles in the pull-outs beside the road
  const logs = [];
  for (let k = 0; k < (lite ? 3 : 8); k++) {
    const sp = D.besideRoad(ctx, (x, z) => ctx.clear(x, z, 2.3, 1.2) && free(x, z, 2.4) && steep(x, z, 2.5) < 1.6, { reach: [2.5, 10], tries: 400, kinds: [0, 1] }); if (!sp) continue;
    const i = sp[4]; free.take(sp[0], sp[1], 2.4); logs.push([sp[0], sp[1], track.psi[i] + (R() - 0.5) * 0.3, 0.9 + R() * 0.2, null]);
  }
  D.place(ctx, 'log-piles', P.logs(), logs, { aoH: 1 });
  // signs: the bends, deer on the straights, falling rock under the cut faces, ice before the bridges
  const signs = { posts: [], faces: [] };
  for (const zn of track.zones) { if (zn.peak < 1 / 45 || R() < 0.4) continue; D.roadSign(ctx, zn.s0 - 42, R() < 0.5 ? 1 : -1, zn.hairpin ? 2 : zn.side > 0 ? 0 : 1, signs); }
  for (let k = 0; k < (lite ? 2 : 4); k++) D.roadSign(ctx, R() * track.length, R() < 0.5 ? 1 : -1, 3, signs);
  for (let k = 0; k < 4; k++) { const s = R() * track.length, i = Math.floor(s / track.step) % track.n; for (const side of [1, -1]) { const p = track.point(s, side * (track.half[i] + 6)); if (hAt(p[0], p[2]) - track.y[i] > 4) { D.roadSign(ctx, s - 18, side, 4, signs); break; } } }
  for (const B of ctx.bridges) D.roadSign(ctx, B.a * track.step - 40, 1, 5, signs);
  D.place(ctx, 'sign-posts', P.signPost(), signs.posts, { audit: false, aoH: 2.4 }); D.signFaces(ctx, signs.faces);
  // smoke from the cabins' chimneys, lit by their windows
  const smoke = ctx.placed.filter((p) => p.what === 'cabins').map((c) => [c.x + (R() - 0.5) * 2, c.y0 + 6.2, c.z + (R() - 0.5) * 2]);
  D.plumes(ctx, smoke, { per: lite ? 6 : 10, height: 10, speed: 0.07, size: [1.2, 5], wind: [0.9, 0, 0.3], tint: [0.75, 0.78, 0.9], alpha: 0.22, name: 'chimney-smoke' });
  // mist lying in the valleys below the road
  const mist = [];
  for (let t = 0; t < 600 && mist.length < (lite ? 4 : 10); t++) {
    const { x0, z0, ext } = ctx.terrainBox, x = x0 + R() * ext, z = z0 + R() * ext, e = ctx.edge(x, z);
    if (e < 120 || e > 600 || hAt(x, z) > ctx.memAt(x, z) - 25) continue;
    mist.push([x, hAt(x, z) + 3, z, [0.62, 0.7, 0.95]]);
  }
  D.plumes(ctx, mist, { per: 4, height: 6, speed: 0.012, size: [40, 70], wind: [2, 0, 1], tint: [0.55, 0.62, 0.85], alpha: 0.12, name: 'valley-mist' });
  // the bridges' lamps in the river below
  const st = [];
  for (const G of ctx.gorges) { const level = G.base - G.depth + 1.2; for (let k = 0; k < ctx.glows.length; k += 8) { const x = ctx.glows[k], y = ctx.glows[k + 1], z = ctx.glows[k + 2]; if (Math.hypot(x - G.mx, z - G.mz) > G.half + 10 || y < level + 4) continue; st.push([x, level, z, [ctx.glows[k + 3] * 0.6, ctx.glows[k + 4] * 0.6, ctx.glows[k + 5] * 0.6], 45, 1.4]); } }
  D.streaks(ctx, st);
  // pools of light: under the lamps, the cabins' windows on the snow and the needles round them
  D.lampPools(ctx, { k: 0.32 });
  for (const c of ctx.placed) if (c.what === 'cabins') ctx.pools.push([c.x, c.z, c.r * 3.2, c.r * 3.2, 0, 0.32, [1, 0.72, 0.42]]);
  // needles and leaves on the wind
  D.drift(ctx, { kind: 'leaf', count: lite ? 40 : 90, box: [60, 3, 60], lo: -0.2, size: 0.1, wind: [3, 0.2, 2], tint: [0.45, 0.5, 0.62], colors: [[0.6, 0.5, 0.35], [0.4, 0.5, 0.35], [0.7, 0.45, 0.3]] });
}
