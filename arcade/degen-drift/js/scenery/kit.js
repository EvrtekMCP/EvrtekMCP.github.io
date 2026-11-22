// DRIFTLINE scenery kit: the cheap pieces every region dresses its roads with. One instanced draw per kind of thing;
// light baked per instance (the sky, the sun and the lamps where it stands); every texture drawn on a small canvas at
// load. Buildings draw their windows in the shader from their own position, so a whole city is one draw and no image.
// Everything placed is recorded in ctx.placed for the audit (nothing on the road, nothing floating).
import * as THREE from '../../vendor/three/three.module.min.js?v=0.1.18';
import { colorGeom, mergeGeoms } from '../world.js?v=0.1.18';

const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), eu = new THREE.Euler(), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function tex(ctx, c, { srgb = true, repeat = false } = {}) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; ctx.disposables.push(t); return t; }

// random spots in the land box that pass a test: fn(x, z) -> extra data or false
export function scatter(ctx, count, fn, tries = 8) {
  const { x0, z0, ext } = ctx.terrainBox, out = [], R = ctx.R;
  for (let t = 0; t < count * tries && out.length < count; t++) { const x = x0 + R() * ext, z = z0 + R() * ext; const r = fn(x, z); if (r) out.push(r); }
  return out;
}

// ---------------------------------------------------------------- crossed cards (trees, cacti, bushes)
// items: [x, z, size, tint [r,g,b], rotY?]; standing on the ground (sunk a little so no root floats)
export function cards(ctx, texture, items, { name = 'cards', aspect = 2, light = 1.6, sink = 0.3, trunk = 0.12 } = {}) {
  if (!items.length) return null;
  const g1 = new THREE.PlaneGeometry(1, aspect); g1.translate(0, aspect / 2, 0);
  const g2 = g1.clone(); g2.rotateY(Math.PI / 2);
  const geo = mergeGeoms([g1, g2]);
  const mat = new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.45, side: THREE.DoubleSide });
  const im = new THREE.InstancedMesh(geo, mat, items.length);
  const c = new THREE.Color(), L = [0, 0, 0];
  items.forEach((t, k) => {
    const [x, z, s, tint, rot] = t, y = ctx.ground(x, z, s * trunk) - sink;
    eu.set(0, rot ?? ctx.R() * Math.PI, 0); qq.setFromEuler(eu); m4.compose(v3.set(x, y, z), qq, sc.set(s * 0.5, s * 0.5, s * 0.5)); im.setMatrixAt(k, m4);
    ctx.light(x, y + s * 0.5, z, 0, 0.6, 0, L, ctx.sunVis(x, y + s * 0.6, z) * 0.6 + 0.4);
    c.setRGB(L[0] * light * tint[0], L[1] * light * tint[1], L[2] * light * tint[2]); im.setColorAt(k, c);
    ctx.placed.push({ x, z, r: s * trunk, y0: y, what: name });
  });
  im.name = name; ctx.root.add(im);
  return im;
}

// ---------------------------------------------------------------- rocks: low, faceted, sunk into the ground
// items: [x, z, radius, squash (height/radius), color THREE.Color]
export function rocks(ctx, items, { name = 'rocks', seed = 5 } = {}) {
  if (!items.length) return null;
  const R = rng(seed);
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  // jitter by vertex position (the same jitter for shared corners, so no cracks)
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 0.78 + 0.4 * (Math.sin(x * 12.9 + y * 78.2 + z * 37.7) * 0.5 + 0.5); p.setXYZ(i, x * k, Math.max(-0.35, y * k), z * k); }
  g.computeVertexNormals();
  colorGeom(g, new THREE.Color(1, 1, 1), 1);
  const im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ vertexColors: true }), items.length);
  const c = new THREE.Color(), L = [0, 0, 0];
  items.forEach((t, k) => {
    // stood on the lowest ground under its whole footprint, so no side hangs over a slope
    const [x, z, r, sq, col] = t, base = ctx.ground(x, z, r * 1.2);
    eu.set(R() * 0.4, R() * 6.28, R() * 0.4); qq.setFromEuler(eu); m4.compose(v3.set(x, base + r * sq * 0.1, z), qq, sc.set(r, r * sq, r * (0.8 + R() * 0.4))); im.setMatrixAt(k, m4);
    ctx.lampsAt(x, base + r, z, 0, 1, 0, L); const v = 0.8 + R() * 0.35;
    c.setRGB(col.r * v + L[0] * 0.5 * col.r, col.g * v + L[1] * 0.5 * col.g, col.b * v + L[2] * 0.5 * col.b); im.setColorAt(k, c);
    ctx.placed.push({ x, z, r: r * 1.2, y0: base, what: name });
  });
  im.name = name; ctx.root.add(im);
  return im;
}

// ---------------------------------------------------------------- boxes: containers, sheds, tanks' plinths, crates
// items: [x, z, w, h, d, rotY, color, y? (default: the ground under it)]
export function boxes(ctx, items, { name = 'boxes', k = 1, geo = null } = {}) {
  if (!items.length) return null;
  const g = geo || new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  // per-face shade, darker at the foot (baked ambient occlusion)
  const nrm = g.attributes.normal, pos = g.attributes.position, arr = new Float32Array(pos.count * 3), amb = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) { ctx.ambientN(nrm.getX(i), nrm.getY(i), nrm.getZ(i), amb); const ao = 0.62 + 0.38 * Math.min(1, pos.getY(i) * 2.5); for (let q = 0; q < 3; q++) arr[i * 3 + q] = (amb[q] * 1.35 + 0.05) * ao * k; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  const im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ vertexColors: true }), items.length);
  const c = new THREE.Color(), L = [0, 0, 0];
  items.forEach((t, kk) => {
    const [x, z, w, h, d, ry, col, yy] = t, rad = Math.hypot(w, d) / 2;
    const y = yy ?? ctx.ground(x, z, rad) - 0.25;
    eu.set(0, ry, 0); qq.setFromEuler(eu); m4.compose(v3.set(x, y, z), qq, sc.set(w, h + (yy === undefined ? 0.25 : 0), d)); im.setMatrixAt(kk, m4);
    ctx.lampsAt(x, y + h * 0.5, z, 0, 0.3, 0, L);
    c.setRGB(col.r + L[0] * 0.45 * (0.4 + col.r), col.g + L[1] * 0.45 * (0.4 + col.g), col.b + L[2] * 0.45 * (0.4 + col.b)); im.setColorAt(kk, c);
    ctx.placed.push({ x, z, r: rad, y0: y, what: name, hangs: yy !== undefined });
  });
  im.name = name; ctx.root.add(im);
  return im;
}

// ---------------------------------------------------------------- buildings: boxes whose windows the shader draws
// items: [x, z, w, h, d, rotY, body THREE.Color, lit share 0..1]; opts: window size, colours, roof neon
export function buildings(ctx, items, { name = 'buildings', floor = 3.4, bay = 2.8, warm = '#ffc27a', cool = '#8ff0ff', pink = '#ff5fb0', dark = 0.08 } = {}) {
  if (!items.length) return null;
  const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
  const aLit = new Float32Array(items.length), aSeed = new Float32Array(items.length);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: false });
  const C = (h) => new THREE.Color(h);
  const wc = C(warm), cc = C(cool), pc = C(pink);
  const sunv = ctx.sun;
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aLit; attribute float aSeed; varying vec3 vLocal; varying vec3 vScale; varying vec3 vN; varying float vLit; varying float vSeed;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vLit = aLit; vSeed = aSeed;
        vec3 sx = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vScale = sx; vLocal = position * sx; vN = normal;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vLocal; varying vec3 vScale; varying vec3 vN; varying float vLit; varying float vSeed;
        float hb(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 an = abs(vN);
          float side = an.y > 0.5 ? 0.0 : 1.0;
          // face shade: the sun side brighter, the roof dark
          float sh = an.y > 0.5 ? 0.55 : 0.6 + 0.4 * max(0.0, dot(normalize(vec3(vN.x, 0.0, vN.z)), normalize(vec3(${sunv.x.toFixed(3)}, 0.0, ${sunv.z.toFixed(3)}))));
          diffuseColor.rgb *= sh;
          if (side > 0.5) {
            float u = an.x > 0.5 ? vLocal.z : vLocal.x;
            vec2 cell = vec2(floor(u / ${bay.toFixed(2)}), floor(vLocal.y / ${floor.toFixed(2)}));
            vec2 f = vec2(fract(u / ${bay.toFixed(2)}), fract(vLocal.y / ${floor.toFixed(2)}));
            float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.28, f.y) * step(f.y, 0.78) * step(2.5, vLocal.y) * step(vLocal.y, vScale.y - 1.2);
            float r = hb(vec3(cell, vSeed + (an.x > 0.5 ? 7.0 : 0.0) + sign(vN.x + vN.z)));
            float on = step(1.0 - vLit, r);
            vec3 wcol = r > 0.97 ? ${`vec3(${pc.r.toFixed(3)}, ${pc.g.toFixed(3)}, ${pc.b.toFixed(3)})`} : r > 0.9 ? ${`vec3(${cc.r.toFixed(3)}, ${cc.g.toFixed(3)}, ${cc.b.toFixed(3)})`} : ${`vec3(${wc.r.toFixed(3)}, ${wc.g.toFixed(3)}, ${wc.b.toFixed(3)})`};
            diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(${dark.toFixed(3)}), wcol * (0.75 + 0.5 * hb(vec3(cell, 3.0))), on), win);
            // a slab line every floor
            diffuseColor.rgb *= 1.0 - 0.25 * (1.0 - step(0.06, f.y));
          }
        }`);
  };
  const im = new THREE.InstancedMesh(g, mat, items.length);
  const c = new THREE.Color(), L = [0, 0, 0];
  items.forEach((t, k) => {
    const [x, z, w, h, d, ry, col, lit] = t, rad = Math.hypot(w, d) / 2, y = ctx.ground(x, z, rad) - 0.4;
    eu.set(0, ry, 0); qq.setFromEuler(eu); m4.compose(v3.set(x, y, z), qq, sc.set(w, h + 0.4, d)); im.setMatrixAt(k, m4);
    ctx.light(x, y + 4, z, 0, 0.4, 0, L);
    c.setRGB(col.r * (0.5 + L[0]), col.g * (0.5 + L[1]), col.b * (0.5 + L[2])); im.setColorAt(k, c);
    aLit[k] = lit; aSeed[k] = k * 1.37 + 0.5;
    ctx.placed.push({ x, z, r: rad, y0: y, what: name });
  });
  g.setAttribute('aLit', new THREE.InstancedBufferAttribute(aLit, 1)); g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
  im.name = name; ctx.root.add(im);
  return im;
}

// ---------------------------------------------------------------- neon signs: glowing pictograms (no words), additive
// items: [x, y, z, rotY, w, h, glyph 0..7, color THREE.Color]
export function signs(ctx, items, { name = 'signs' } = {}) {
  if (!items.length) return null;
  const atlas = signAtlas(ctx);
  const g = new THREE.PlaneGeometry(1, 1);
  const aG = new Float32Array(items.length);
  const mat = new THREE.MeshBasicMaterial({ map: atlas, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlyph;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = (uv + vec2(mod(aGlyph, 4.0), 1.0 - floor(aGlyph / 4.0))) * vec2(0.25, 0.5);\n#endif');
  };
  const im = new THREE.InstancedMesh(g, mat, items.length);
  items.forEach((t, k) => {
    const [x, y, z, ry, w, h, gl, col] = t;
    eu.set(0, ry, 0); qq.setFromEuler(eu); m4.compose(v3.set(x, y, z), qq, sc.set(w, h, 1)); im.setMatrixAt(k, m4);
    im.setColorAt(k, col.clone().multiplyScalar(1.6)); aG[k] = gl;
  });
  g.setAttribute('aGlyph', new THREE.InstancedBufferAttribute(aG, 1));
  im.name = name; im.renderOrder = 3; ctx.root.add(im);
  return im;
}
// eight pictograms in neon tubes: a sun, a palm, a wave, a chevron, a star, a heart-ish diamond, a crescent, rings
function signAtlas(ctx) {
  if (ctx._signAtlas) return ctx._signAtlas;
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 256);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const tube = (draw) => { for (const [w, a] of [[14, 0.25], [7, 0.6], [3, 1]]) { g.lineWidth = w; g.strokeStyle = `rgba(255,255,255,${a})`; draw(); } };
  const at = (k) => [(k % 4) * 128 + 64, Math.floor(k / 4) * 128 + 64];
  // 0 sun with bands
  { const [x, y] = at(0); tube(() => { g.beginPath(); g.arc(x, y, 40, Math.PI, 0); g.stroke(); for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x - 40 + i * 4, y + 8 + i * 9); g.lineTo(x + 40 - i * 4, y + 8 + i * 9); g.stroke(); } }); }
  // 1 palm
  { const [x, y] = at(1); tube(() => { g.beginPath(); g.moveTo(x + 6, y + 48); g.quadraticCurveTo(x - 2, y, x + 4, y - 24); g.stroke(); for (const a of [-2.6, -2.0, -1.2, -0.5, 0.1]) { g.beginPath(); g.moveTo(x + 4, y - 24); g.quadraticCurveTo(x + 4 + Math.cos(a) * 30, y - 24 + Math.sin(a) * 30 - 10, x + 4 + Math.cos(a) * 44, y - 24 + Math.sin(a) * 44 + 14); g.stroke(); } }); }
  // 2 waves
  { const [x, y] = at(2); tube(() => { for (let r = 0; r < 3; r++) { g.beginPath(); for (let i = 0; i <= 20; i++) { const px = x - 46 + i * 4.6, py = y - 22 + r * 22 + Math.sin(i * 0.7) * 8; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); } }); }
  // 3 double chevron
  { const [x, y] = at(3); tube(() => { for (const dx of [-22, 10]) { g.beginPath(); g.moveTo(x + dx, y - 34); g.lineTo(x + dx + 26, y); g.lineTo(x + dx, y + 34); g.stroke(); } }); }
  // 4 star
  { const [x, y] = at(4); tube(() => { g.beginPath(); for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 18 : 44; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }); }
  // 5 diamond in a diamond
  { const [x, y] = at(5); tube(() => { for (const r of [44, 24]) { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.stroke(); } }); }
  // 6 crescent
  { const [x, y] = at(6); tube(() => { g.beginPath(); g.arc(x, y, 40, 0.6, Math.PI * 2 - 0.6); g.arc(x + 18, y, 30, Math.PI * 2 - 0.9, 0.9, true); g.closePath(); g.stroke(); }); }
  // 7 rings
  { const [x, y] = at(7); tube(() => { for (const r of [44, 30, 16]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); } }); }
  const t = tex(ctx, c); ctx._signAtlas = t; return t;
}

// ---------------------------------------------------------------- wires on poles (telephone lines, harbour fences)
// poles: [[x, z], ...] along a line; one LineSegments draw for the wires, an instanced draw for the poles
export function poleLine(ctx, poles, { height = 8, wires = 3, color = '#141018', name = 'poles' } = {}) {
  if (poles.length < 2) return;
  const tops = poles.map(([x, z]) => { const y = ctx.ground(x, z, 0.3) - 0.3; ctx.placed.push({ x, z, r: 0.3, y0: y, what: name }); return [x, y, z]; });
  const pg = new THREE.CylinderGeometry(0.12, 0.17, height, 5); pg.translate(0, height / 2, 0);
  const bar = new THREE.BoxGeometry(2.2, 0.14, 0.14); bar.translate(0, height - 0.6, 0);
  const geo = mergeGeoms([pg, bar]);
  const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color) }), tops.length);
  const line = [];
  tops.forEach(([x, y, z], k) => {
    const nx = tops[Math.min(k + 1, tops.length - 1)], pv = tops[Math.max(k - 1, 0)], ang = Math.atan2(nx[0] - pv[0], nx[2] - pv[2]);
    eu.set(0, ang + Math.PI / 2, 0); qq.setFromEuler(eu); m4.compose(v3.set(x, y, z), qq, sc.set(1, 1, 1)); im.setMatrixAt(k, m4);
    if (k < tops.length - 1) {
      const [x2, y2, z2] = nx;
      for (let w = 0; w < wires; w++) {
        const off = (w - (wires - 1) / 2) * 0.9, ox = Math.cos(ang) * off, oz = -Math.sin(ang) * off;
        let px = x + ox, py = y + height - 0.55, pz = z + oz;
        for (let s = 1; s <= 8; s++) { const t = s / 8, qx = x + (x2 - x) * t + ox, qz = z + (z2 - z) * t + oz, qy = y + (y2 - y) * t + height - 0.55 - Math.sin(t * Math.PI) * 1.1; line.push(px, py, pz, qx, qy, qz); px = qx; py = qy; pz = qz; }
      }
    }
  });
  im.name = name; ctx.root.add(im);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(line, 3));
  const wl = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.8) })); wl.name = name + '-wires'; ctx.root.add(wl);
}

// ---------------------------------------------------------------- canvas art for the cards
export function pineArt(ctx, { body = ['#2c5a50', '#15302c', '#0f2224'], rim = '#ff9a6a', snow = 0, seed = 3 } = {}) {
  const [c, g] = canvas(128, 256), R = rng(seed);
  for (let t = 0; t < 9; t++) {
    const y = 236 - t * 24, w = 58 - t * 5.5 + R() * 6;
    const grd = g.createLinearGradient(64 - w, 0, 64 + w, 0);
    grd.addColorStop(0, body[0]); grd.addColorStop(0.35, body[1]); grd.addColorStop(0.8, body[2]); grd.addColorStop(1, rim);
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(64, y - 42);
    const pts = []; for (let k = 0; k <= 10; k++) { const a = k / 10; pts.push([64 - w + a * 2 * w + (R() - 0.5) * 6, y + (k % 2 ? 4 : -2) + R() * 5]); }
    for (const [px, py] of pts) g.lineTo(px, py);
    g.closePath(); g.fill();
    if (snow) { g.fillStyle = `rgba(235,240,255,${snow})`; g.beginPath(); g.moveTo(64, y - 42); g.lineTo(64 - w * 0.55, y - 12); g.lineTo(64 - w * 0.2, y - 16); g.lineTo(64 + w * 0.25, y - 10); g.lineTo(64 + w * 0.5, y - 14); g.closePath(); g.fill(); }
  }
  g.fillStyle = '#1a1014'; g.fillRect(60, 232, 8, 24);
  return tex(ctx, c);
}
export function cactusArt(ctx, seed = 9) {
  const [c, g] = canvas(128, 256), R = rng(seed);
  const body = (x, y0, y1, w) => { const grd = g.createLinearGradient(x - w, 0, x + w, 0); grd.addColorStop(0, '#2a3a26'); grd.addColorStop(0.45, '#4f6a3a'); grd.addColorStop(0.75, '#2e3f28'); grd.addColorStop(1, '#ffae6a'); g.fillStyle = grd; g.beginPath(); g.moveTo(x - w, y0); g.lineTo(x - w, y1 + w); g.arc(x, y1 + w, w, Math.PI, 0); g.lineTo(x + w, y0); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x + i * w * 0.45, y0); g.lineTo(x + i * w * 0.45, y1 + w); g.stroke(); } };
  body(64, 256, 26, 13);
  const arm = (dir, yb, len, up) => { const x0 = 64 + dir * 10, x1 = 64 + dir * len; g.fillStyle = '#3f5a32'; g.beginPath(); g.moveTo(x0, yb); g.lineTo(x1 + 8 * dir, yb); g.lineTo(x1 + 8 * dir, yb - 16); g.lineTo(x0, yb - 16); g.fill(); body(x1, yb - 4, yb - up, 9); };
  arm(-1, 150 + R() * 20, 34, 60 + R() * 20); if (R() < 0.8) arm(1, 120 + R() * 30, 32, 45 + R() * 25);
  return tex(ctx, c);
}
export function bushArt(ctx, { cols = ['#3a2a1e', '#5a4026', '#7a5a34'], seed = 4 } = {}) {
  const [c, g] = canvas(128, 128), R = rng(seed);
  for (let i = 0; i < 70; i++) { const a = R() * Math.PI, r = 20 + R() * 44, x = 64 + Math.cos(a) * r * 0.9, y = 124 - Math.sin(a) * r * 0.75; g.fillStyle = cols[Math.floor(R() * cols.length)]; g.beginPath(); g.arc(x, y, 5 + R() * 9, 0, 7); g.fill(); }
  return tex(ctx, c);
}
export function palmArt(ctx, seed = 6) {
  const [c, g] = canvas(128, 256), R = rng(seed);
  g.strokeStyle = '#2a1a22'; g.lineWidth = 7; g.beginPath(); g.moveTo(66, 256); g.quadraticCurveTo(58, 150, 68, 64); g.stroke();
  for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.42 + (R() - 0.5) * 0.2; g.strokeStyle = i % 2 ? '#1a3a34' : '#24504a'; g.lineWidth = 9; g.beginPath(); g.moveTo(68, 64); g.quadraticCurveTo(68 + Math.cos(a) * 34, 64 + Math.sin(a) * 34 - 6, 68 + Math.cos(a) * 58, 64 + Math.sin(a) * 58 + 26); g.stroke(); }
  return tex(ctx, c);
}

// an instanced mesh of one merged geometry at many spots: [x, y, z, rotY, scale, color]
export function many(ctx, geo, items, { name = 'many', mat = null, r = 1, hangs = false } = {}) {
  if (!items.length) return null;
  const im = new THREE.InstancedMesh(geo, mat || new THREE.MeshBasicMaterial({ vertexColors: !!geo.attributes.color }), items.length);
  items.forEach((t, k) => {
    const [x, y, z, ry, s, col] = t;
    eu.set(0, ry, 0); qq.setFromEuler(eu); m4.compose(v3.set(x, y, z), qq, sc.set(s, s, s)); im.setMatrixAt(k, m4);
    if (col) im.setColorAt(k, col);
    ctx.placed.push({ x, z, r: r * s, y0: y, what: name, hangs });
  });
  im.name = name; ctx.root.add(im);
  return im;
}
