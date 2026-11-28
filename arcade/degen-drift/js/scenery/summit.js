// DRIFTLINE region 5, Summit: the hard high touge just before dawn. A pink sun breaking over a sea of cloud far
// below, a pale moon setting behind, snow and bare rock falling away on both sides of a narrow road, red-and-white
// snow poles, a radio mast blinking on the highest crag and an observatory dome at the top.
import * as THREE from '../../vendor/three/three.module.min.js?v=0.1.26';
import { sstep, fbm, colorGeom, mergeGeoms } from '../world.js?v=0.1.26';
import * as K from './kit.js?v=0.1.26';
import * as D from './detail.js?v=0.1.26';
import * as P from './props.js?v=0.1.26';

const C = (h) => new THREE.Color(h);

export function look(course) {
  void course;
  return {
    pal: {
      zenith: '#0a0c2a', sky: '#2a2e66', horizonAway: '#6a62a8', horizonSun: '#ffa088', sunCore: '#fff0e0',
      fog: '#3c3e70', fogSun: '#ff9a8a', skyAmb: '#8a8cd0', groundAmb: '#2a2c4a', sunLight: '#ffc0a8',
      asphalt: '#44465a', line: '#ffffff', concrete: '#9a9cb4', rail: '#cfd6e8',
      grass: '#cfd4ec', rock: '#545670', sand: '#a8acc8', seaDeep: '#101030', sodium: '#ffb070', led: '#d0f0ff',
    },
    sun: [0.75, 0.045, 0.66], sunK: 1.1, ambK: 0.72,
    sky: { disc: 0.07, bands: true, clouds: 0.3, stars: 1.0, moon: [-0.7, 0.3, -0.6], moonSize: 0.07 },
    fogDensity: 0.0020,
    road: { runoff: ['#c01020', '#f0f0f8'], kerb: ['#c01020', '#f0f0f8'], sunSheen: 0.4, spindrift: 0.75 },
    // 11-26 Full: the dawn breaking: cloud above lit rose and gold from below the horizon, and the sun's rays
    skyFull: { scale: 0.13, cover: [0.54, 0.76], k: 0.75, hi: 0.7, drift: [0.005, 0.002], shadow: '#3a3466', lit: '#ffb4a0', rays: 0.5 },
  };
}

export function lamps(ctx) {
  const { track, PAL } = ctx, lp = [0, 0, 0], lq = [0, 0, 0];
  // a lamp at each hairpin's apex (the only lights up here) and two at the start
  const spots = [[20, 1], [60, -1]];
  for (const zn of track.zones) if (zn.hairpin) spots.push([zn.s0 + zn.len * zn.apexT, -zn.side]);
  for (const [s, side] of spots) {
    const i = Math.floor(track.wrapS(s) / track.step) % track.n, half = track.half[i];
    track.point(s, side * (half + 1.7), lp); track.point(s, side * (half - 0.7), lq);
    const c = PAL.sodium;
    ctx.lamps.push({ x: lq[0], y: lq[1] + 7.4, z: lq[2], r: c.r, g: c.g, b: c.b, i: 1.3, range: 20 });
    ctx.mounts.push({ x: lp[0], y: lp[1], z: lp[2], ax: lq[0] - lp[0], az: lq[2] - lp[2], style: 'arm', color: c });
    ctx.glow(lq[0], lq[1] + 7.65, lq[2], c, 5);
  }
}

export function terrain(ctx) {
  const { PAL, bbox: B } = ctx;
  const sea = B.minY - 120;
  ctx.cloudLevel = sea;
  return {
    margin: 520, blend: 22,
    height(x, z, mem, e) {
      // the ridge the road follows, falling away on both sides toward the clouds; crags and peaks stand up out of it
      const fall = sstep(18, 260, e) * (70 + fbm(x * 0.004, z * 0.004) * 110) + sstep(240, 560, e) * 260;
      const crag = Math.max(0, fbm(x * 0.006 + 5, z * 0.006 + 2) - 0.52) * 520 * sstep(60, 200, e);
      const rough = (fbm(x * 0.02, z * 0.02) - 0.5) * 10;
      return Math.max(sea - 30, mem - fall + crag + rough);
    },
    albedo(x, z, h, slope) {
      const c = PAL.grass.clone().lerp(PAL.rock, sstep(0.25, 0.5, slope) * (0.6 + 0.4 * fbm(x * 0.05, z * 0.05)));
      return [c.r, c.g, c.b];
    },
  };
}

export function wall(ctx) {
  const { PAL } = ctx;
  return { prof: 'rail', color: [PAL.rail.r, PAL.rail.g, PAL.rail.b], reflect: [1.0, 0.3, 0.2], posts: true };
}

export function dress(ctx) {
  const { R, hAt, PAL, track } = ctx;
  const steep = (x, z, d = 4) => Math.abs(hAt(x + d, z) - hAt(x - d, z)) + Math.abs(hAt(x, z + d) - hAt(x, z - d));
  // rocks everywhere: boulders by the rails, scree down the slopes
  const rk = [];
  for (let s = 0; s < track.length; s += 6) {
    const i = Math.floor(s / track.step) % track.n;
    for (const side of [1, -1]) {
      if (R() < 0.6) continue;
      const p = track.point(s, side * (track.half[i] + 2.4 + R() * 10)), r = 0.6 + R() * 2.2;
      if (!ctx.clear(p[0], p[2], r)) continue;
      rk.push([p[0], p[2], r, 0.6 + R() * 0.4, PAL.rock.clone().multiplyScalar(0.8 + R() * 0.4)]);
    }
  }
  const scree = K.scatter(ctx, Math.round(700 * ctx.dense), (x, z) => { if (ctx.edge(x, z) > 500) return false; const r = 1.5 + R() * 6; if (!ctx.clear(x, z, r, 2)) return false; return [x, z, r, 0.7, PAL.rock.clone().multiplyScalar(0.7 + R() * 0.3)]; });
  K.rocks(ctx, rk.concat(scree), { name: 'rocks', seed: 44 });
  // a few hardy pines, low down, snow on their shoulders
  const pines = K.scatter(ctx, Math.round(500 * ctx.dense), (x, z) => { const e = ctx.edge(x, z); if (e < 6 || e > 300 || steep(x, z) > 8) return false; if (hAt(x, z) > ctx.memAt(x, z) - 10) return false; if (!ctx.clear(x, z, 0.5)) return false; return [x, z, 6 + R() * 7, [0.9, 0.92, 1]]; });
  K.cards(ctx, K.pineArt(ctx, { body: ['#2a4a5a', '#142a34', '#0c1a24'], rim: '#ffb0a0', snow: 0.85, seed: 12 }), pines, { name: 'snow-pines' });
  // snow poles: red and white, one each side every 22 m, a reflector on top
  const poles = [];
  for (let s = 6; s < track.length; s += 22) {
    const i = Math.floor(s / track.step) % track.n; if (track.kind[i] >= 2) continue;
    for (const side of [1, -1]) {
      const p = track.point(s, side * (track.half[i] + 1.6)); if (!ctx.clear(p[0], p[2], 0.1, 0.4)) continue;
      const y = ctx.ground(p[0], p[2], 0.1) - 0.2; poles.push([p[0], y, p[2], 0, 1, null]);
      ctx.glow(p[0], y + 2.3, p[2], side > 0 ? [1, 0.25, 0.15] : [1, 0.85, 0.6], 0.7);
    }
  }
  const pg = new THREE.CylinderGeometry(0.05, 0.05, 2.4, 4); pg.translate(0, 1.2, 0);
  const pc = new Float32Array(pg.attributes.position.count * 3); for (let k = 0; k < pg.attributes.position.count; k++) { const red = Math.floor(pg.attributes.position.getY(k) / 0.4) % 2 === 0; pc.set(red ? [0.7, 0.06, 0.06] : [0.9, 0.9, 0.95], k * 3); }
  pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  K.many(ctx, pg, poles, { name: 'snow-poles', r: 0.05 });
  // the radio mast on the highest crag within reach, blinking red all the way up
  let top = null;
  K.scatter(ctx, 400, (x, z) => { const e = ctx.edge(x, z); if (e < 50 || e > 380 || !ctx.clear(x, z, 4, 4)) return false; const h = hAt(x, z); if (!top || h > top[2]) top = [x, z, h]; return false; }, 1);
  if (top) {
    const [x, z] = top, y = ctx.ground(x, z, 3) - 0.3, parts = [];
    const mast = new THREE.CylinderGeometry(0.4, 1.6, 70, 4); mast.translate(x, y + 35, z); parts.push(colorGeom(mast, C('#c8c0d0'), 1));
    const hy = ctx.ground(x + 5, z, 3.6) - 0.3, hut = new THREE.BoxGeometry(6, 3.4 + (y - hy), 4); hut.translate(x + 5, hy + (3.4 + (y - hy)) / 2, z); parts.push(colorGeom(hut, C('#6a6880'), 1));
    ctx.root.add(Object.assign(new THREE.Mesh(mergeGeoms(parts), new THREE.MeshBasicMaterial({ vertexColors: true })), { name: 'mast' }));
    for (let k = 1; k <= 5; k++) ctx.glow(x, y + k * 14, z, [1, 0.08, 0.05], 3.5, 0.5);
    ctx.placed.push({ x, z, r: 1.6, y0: y, what: 'mast' }, { x: x + 5, z, r: 3.6, y0: hy, what: 'mast hut' });
  }
  // the observatory: a white dome on a drum, its slit lit, beside the highest part of the road
  let hi = 0; for (let i = 0; i < track.n; i++) if (track.y[i] > track.y[hi]) hi = i;
  for (const side of [1, -1]) {
    const p = track.point(hi * track.step, side * (track.half[hi] + 24)); if (!ctx.clear(p[0], p[2], 11, 3)) continue;
    const y = ctx.ground(p[0], p[2], 10) - 0.3, parts = [];
    const drum = new THREE.CylinderGeometry(9, 9.5, 8, 24); drum.translate(p[0], y + 4, p[2]); parts.push(colorGeom(drum, C('#d8d8e8'), 1));
    const dome = new THREE.SphereGeometry(9.2, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2); dome.translate(p[0], y + 8, p[2]); parts.push(colorGeom(dome, C('#eeeef8'), 1));
    ctx.root.add(Object.assign(new THREE.Mesh(mergeGeoms(parts), new THREE.MeshBasicMaterial({ vertexColors: true })), { name: 'observatory' }));
    for (let k = 0; k < 6; k++) ctx.glow(p[0] + 1.5, y + 9 + k * 1.3, p[2] + 8.6 - k * 1.6, [1, 0.8, 0.55], 2.2);
    ctx.placed.push({ x: p[0], z: p[2], r: 9.5, y0: y, what: 'observatory' });
    break;
  }
}

export function far(ctx) {
  // peaks standing out of the clouds, the nearest dark, the farthest catching the dawn
  const c = ctx.cloudLevel, peaks = (seed, hs) => (a, k) => c + 20 + Math.pow(fbm(k * 0.06 + seed, seed), 2.2) * 1100 * hs;
  return [
    { r: 2500, lo: '#3a3a70', hi: '#ffd0c8', span: 600, seg: 280, base: c - 10, shape: peaks(4, 0.9) },
    { r: 1900, lo: '#24264e', hi: '#9a9ad0', span: 480, seg: 260, base: c - 10, shape: peaks(19, 0.55) },
  ];
}

// the water here is the sea of cloud, at a level the terrain chose
export function water(ctx) { return { kind: 'clouds', level: ctx.cloudLevel }; }

// ================================================================ 11-26 Full detail (graphics uplift part 2)
// Settings > World detail > Full. Nothing above changes; this adds, with its own dice (ctx.R2): a snow pole every 11 m
// (between 0.1.21's), snow banked along the outside of the rails, slatted snow fences on the slopes, a weather mast
// with its cups spinning, cairns, signs (ice, steep grade, the bends), snow blowing on the wind and streaming across
// the road (look.road.spindrift), the low sun's road of light across the cloud sea, and pools under the lamps.
export function dressFull(ctx) {
  const { R2: R, hAt, track, PAL } = ctx, lite = ctx.lite, free = D.occupancy(ctx);
  const steep = (x, z, d = 4) => Math.abs(hAt(x + d, z) - hAt(x - d, z)) + Math.abs(hAt(x, z + d) - hAt(x, z - d));
  // snow poles between the old ones, and snow banked against the outside of the rails
  const poles = [], banks = [], snowC = C('#e4e8fa');
  for (let s = 17; s < track.length; s += 22) {
    const i = Math.floor(s / track.step) % track.n; if (track.kind[i] >= 2) continue;
    for (const side of [1, -1]) {
      const p = track.point(s, side * (track.half[i] + 1.6)); if (!ctx.clear(p[0], p[2], 0.1, 0.4) || !free(p[0], p[2], 0.2)) continue;
      const y = ctx.ground(p[0], p[2], 0.1) - 0.2; poles.push([p[0], p[2], 0, 1, null, y]); free.take(p[0], p[2], 0.2);
      ctx.glow(p[0], y + 2.3, p[2], side > 0 ? [1, 0.25, 0.15] : [1, 0.85, 0.6], 0.7);
    }
  }
  for (let s = 0; s < track.length; s += lite ? 9 : 5) {
    const i = Math.floor(s / track.step) % track.n; if (track.kind[i] >= 2) continue;
    for (const side of [1, -1]) {
      if (R() < 0.35) continue;
      const r = 1.1 + R() * 1.6, p = track.point(s, side * (track.half[i] + 1.5 + r * 1.2)); if (!ctx.clear(p[0], p[2], r * 1.2, 0.35) || !free(p[0], p[2], r * 0.8)) continue;
      banks.push([p[0], p[2], r, 0.32 + R() * 0.15, snowC.clone().multiplyScalar(0.92 + R() * 0.1)]);
    }
  }
  D.place(ctx, 'snow-poles-2', P.snowPole(), poles, { aoH: 0.6, audit: false });
  K.rocks(ctx, banks, { name: 'snow-banks', seed: 71 });
  // snow fences on the slopes above the road, across the wind
  const fences = [];
  for (let k = 0; k < (lite ? 4 : 10); k++) {
    const sp = D.besideRoad(ctx, (x, z) => ctx.clear(x, z, 3.2, 2) && free(x, z, 3.3) && steep(x, z, 3) < 2.5, { reach: [6, 30], tries: 300 }); if (!sp) continue;
    free.take(sp[0], sp[1], 3.3); fences.push([sp[0], sp[1], track.psi[sp[4]] + (R() - 0.5) * 0.4, 1, null]);
  }
  D.place(ctx, 'snow-fences', P.snowFence(), fences, { aoH: 1.6 });
  // a weather mast by the radio mast (or the observatory), its cups spinning
  const near = ctx.placed.find((p) => p.what === 'mast hut') || ctx.placed.find((p) => p.what === 'observatory');
  if (near) {
    for (let t = 0; t < 30; t++) { const a = R() * 6.28, d = near.r + 6 + R() * 6, x = near.x + Math.cos(a) * d, z = near.z + Math.sin(a) * d;
      if (!ctx.clear(x, z, 1, 2) || !free(x, z, 1.2) || steep(x, z, 2) > 2) continue;
      D.movers(ctx, 'weather-mast', P.weatherMast(), [[x, z, R() * 6.28, 1, null]], (tt) => [0, tt * 7, 0], { aoH: 3 });
      ctx.glow(x, ctx.ground(x, z, 0.5) + 6.1, z, [1, 0.1, 0.05], 1.6, 0.9); break; }
  }
  // cairns on the crests
  const cairns = [];
  for (let k = 0; k < (lite ? 4 : 10); k++) {
    const sp = D.besideRoad(ctx, (x, z) => ctx.clear(x, z, 1, 2) && free(x, z, 1.1) && steep(x, z, 2) < 2, { reach: [5, 40], tries: 200 }); if (!sp) continue;
    free.take(sp[0], sp[1], 1.1); const c = PAL.rock.clone().multiplyScalar(0.9);
    for (let j = 0; j < 4; j++) cairns.push([sp[0] + (R() - 0.5) * 0.15, sp[1] + (R() - 0.5) * 0.15, 0.75 - j * 0.15, 0.55, c]);
  }
  // stacked: each stone a little higher (rocks() stands each on the ground, so lift them by hand after)
  const cm = K.rocks(ctx, cairns, { name: 'cairns', seed: 73 });
  if (cm) { const m4 = new ctx.THREE.Matrix4(); for (let k = 0; k < cairns.length; k++) { cm.getMatrixAt(k, m4); m4.elements[13] += (k % 4) * 0.42; cm.setMatrixAt(k, m4); if (k % 4) ctx.placed[ctx.placed.length - cairns.length + k].hangs = true; } }
  // signs: ice, the grade, the bends
  const signs = { posts: [], faces: [] };
  for (const zn of track.zones) { if (zn.peak < 1 / 40 || R() < 0.45) continue; D.roadSign(ctx, zn.s0 - 40, R() < 0.5 ? 1 : -1, zn.hairpin ? 2 : zn.side > 0 ? 0 : 1, signs); }
  for (let k = 0; k < (lite ? 2 : 4); k++) D.roadSign(ctx, R() * track.length, R() < 0.5 ? 1 : -1, R() < 0.5 ? 5 : 6, signs);
  D.place(ctx, 'sign-posts', P.signPost(), signs.posts, { audit: false, aoH: 2.4 }); D.signFaces(ctx, signs.faces);
  // snow on the wind, and the lamps' pools on the snow
  D.drift(ctx, { kind: 'snow', count: lite ? 160 : 380, box: [60, 9, 60], lo: -0.5, size: 0.09, wind: [7, -0.6, 2.5], tint: [0.75, 0.75, 0.9], colors: [[1, 1, 1]] });
  D.lampPools(ctx, { k: 0.3 });
}
// the farthest peaks, catching the dawn
export function farFull(ctx) {
  const c = ctx.cloudLevel, peaks = (seed, hs) => (a, k) => c + 20 + Math.pow(fbm(k * 0.05 + seed, seed), 2.2) * 1100 * hs;
  return [{ r: 2750, lo: '#5a4a80', hi: '#ffe0d8', span: 650, seg: 260, base: c - 10, shape: peaks(31, 1.05), haze: 1.2 }];
}
