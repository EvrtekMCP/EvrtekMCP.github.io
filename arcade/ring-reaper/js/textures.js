// STARWAKE: every texture is drawn on a canvas at load time. No image files are fetched.
import * as THREE from '../vendor/three/three.module.min.js?v=0.6.0';
import { rng } from './util.js?v=0.6.0';

// Chrome's canvas dithers every gradient with the same ordered pattern; a hundred additive blobs stack it into a
// visible lattice once the texture is magnified. Two box blurs of radius 2 take it out (the stars go on after).
function soften(g, W, H, wrapX) {
  const img = g.getImageData(0, 0, W, H), d = img.data, tmp = new Float32Array(W * H * 3), r = 2, n = 2 * r + 1;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { // across
      let a = 0, b = 0, c = 0;
      for (let k = -r; k <= r; k++) { let xx = x + k; xx = wrapX ? (xx + W) % W : Math.max(0, Math.min(W - 1, xx)); const i = (y * W + xx) * 4; a += d[i]; b += d[i + 1]; c += d[i + 2]; }
      const o = (y * W + x) * 3; tmp[o] = a / n; tmp[o + 1] = b / n; tmp[o + 2] = c / n;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { // down
      let a = 0, b = 0, c = 0;
      for (let k = -r; k <= r; k++) { const yy = Math.max(0, Math.min(H - 1, y + k)), o = (yy * W + x) * 3; a += tmp[o]; b += tmp[o + 1]; c += tmp[o + 2]; }
      const i = (y * W + x) * 4; d[i] = a / n; d[i + 1] = b / n; d[i + 2] = c / n;
    }
  }
  g.putImageData(img, 0, 0);
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, opts = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = opts.aniso || 1;
  return t;
}

// a soft round glow, white, for sprites and points
export function glow(size = 64, hard = 0.25) {
  const c = canvas(size, size), g = c.getContext('2d');
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(hard, 'rgba(255,255,255,0.85)');
  r.addColorStop(0.55, 'rgba(255,255,255,0.22)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, size, size);
  return tex(c);
}

// a soft, lumpy cloud for nebula gas sprites
export function cloud(seed = 3) {
  const S = 128, c = canvas(S, S), g = c.getContext('2d'), R = rng(seed);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const x = S / 2 + R.range(-30, 30), y = S / 2 + R.range(-30, 30), rad = R.range(14, 44);
    const r = g.createRadialGradient(x, y, 0, x, y, rad);
    r.addColorStop(0, 'rgba(255,255,255,0.10)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, S, S);
  }
  // fade the square edge away
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S / 2);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m; g.fillRect(0, 0, S, S);
  return tex(c);
}

// The sky: an equirectangular canvas of glowing gas and stars, one per sector palette.
// pal: [base, c1, c2, c3] as css colours. Drawn with additive blobs, wrapped at the seam.
export function sky(seed, pal, opts = {}) {
  const W = opts.w || 1024, H = opts.h || 512, c = canvas(W, H), g = c.getContext('2d'), R = rng(seed);
  g.fillStyle = pal[0]; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  const blob = (x, y, rad, col, a) => {
    for (const ox of [-W, 0, W]) {
      if (x + ox + rad < 0 || x + ox - rad > W) continue;
      const r = g.createRadialGradient(x + ox, y, 0, x + ox, y, rad);
      r.addColorStop(0, col.replace('A', a)); r.addColorStop(1, col.replace('A', 0));
      g.fillStyle = r; g.fillRect(x + ox - rad, y - rad, rad * 2, rad * 2);
    }
  };
  // a band of gas across the forward view (u = 0.25 is straight ahead for a sphere seen from inside, -Z)
  const band = opts.band ?? 0.5;
  for (let i = 0; i < (opts.blobs || 140); i++) {
    const u = R(), x = u * W, y = H * band + R.range(-1, 1) * H * 0.22 * (0.4 + R());
    const col = pal[1 + (i % 3)];
    blob(x, y, R.range(30, 150), col, R.range(0.04, 0.16) * (opts.gas ?? 1));
  }
  // dark dust lanes
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < (opts.dust ?? 30); i++) {
    const x = R() * W, y = H * band + R.range(-0.15, 0.15) * H, rad = R.range(20, 90);
    for (const ox of [-W, 0, W]) {
      const r = g.createRadialGradient(x + ox, y, 0, x + ox, y, rad);
      r.addColorStop(0, 'rgba(0,0,0,0.28)'); r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r; g.fillRect(x + ox - rad, y - rad, rad * 2, rad * 2);
    }
  }
  soften(g, W, H, true);
  // stars
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < (opts.stars || 1600); i++) {
    const x = R() * W, y = R() * H, b = Math.pow(R(), 3);
    g.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.75 * b).toFixed(2) + ')';
    const s = b > 0.85 ? 2 : 1;
    g.fillRect(x, y, s, s);
    if (b > 0.93) blob(x, y, 6, 'rgba(200,230,255,A)', 0.5);
  }
  const t = tex(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// Hull plating for the derelict: panel seams, rivets and a few dead or blinking lights (the lights go in an
// emissive map so they glow without lighting).
export function hull(seed = 9) {
  const S = 256, c = canvas(S, S), e = canvas(S, S), g = c.getContext('2d'), ge = e.getContext('2d'), R = rng(seed);
  g.fillStyle = '#2a2f3c'; g.fillRect(0, 0, S, S);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  const panels = [[0, 0, 128, 96], [128, 0, 128, 64], [128, 64, 64, 64], [192, 64, 64, 128], [0, 96, 64, 160], [64, 96, 128, 96],
    [64, 192, 128, 64], [192, 192, 64, 64]];
  for (const [x, y, w, h] of panels) {
    const v = 36 + R.int(0, 22);
    g.fillStyle = `rgb(${v},${v + 4},${v + 14})`; g.fillRect(x + 2, y + 2, w - 4, h - 4);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 2, y + h - 5, w - 4, 3);
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + 2, y + 2, w - 4, 2);
    for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x + 6 + R() * (w - 12), y + 6 + R() * (h - 12), 2, 2); }
  }
  // greebles
  for (let i = 0; i < 40; i++) { const v = 20 + R.int(0, 30); g.fillStyle = `rgb(${v},${v},${v + 10})`; g.fillRect(R() * S, R() * S, R.range(4, 18), R.range(3, 10)); }
  // light strips
  for (let i = 0; i < 7; i++) {
    const x = R() * S, y = R() * S, w = R.range(10, 40), col = R() < 0.6 ? '#53e6ff' : '#ff4fd8';
    ge.fillStyle = col; ge.fillRect(x, y, w, 2);
    g.fillStyle = '#111'; g.fillRect(x, y, w, 2);
  }
  const map = tex(c, { repeat: true, aniso: 4 }), emissive = tex(e, { repeat: true, aniso: 4 });
  return { map, emissive };
}

// a gas giant: banded, with a soft terminator; drawn once
export function planet(seed = 21) {
  const W = 512, H = 256, c = canvas(W, H), g = c.getContext('2d'), R = rng(seed);
  const cols = ['#3b1d5e', '#5a2a7a', '#8a3f8f', '#c0628a', '#e29a7a', '#6b3c8c', '#402266'];
  for (let y = 0; y < H; y++) {
    const t = y / H, k = Math.floor((Math.sin(t * 19 + Math.sin(t * 7) * 2) * 0.5 + 0.5) * (cols.length - 1));
    g.fillStyle = cols[k]; g.fillRect(0, y, W, 1);
  }
  g.globalAlpha = 0.25;
  for (let i = 0; i < 120; i++) { g.fillStyle = R.pick(cols); g.fillRect(R() * W, R() * H, R.range(20, 160), R.range(1, 4)); }
  g.globalAlpha = 1;
  return tex(c);
}

// one hull texture pair for every user (the derelict's floor and its girders share the drawing)
let hullOnce = null;
export function hullShared() { return hullOnce || (hullOnce = hull(9)); }
