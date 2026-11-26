// DRIFTLINE: every texture is drawn at load time on a small canvas: asphalt grain, the pine cards, lit warehouse
// windows, corner chevrons, the car's shadow, and the matcaps that give the paint its baked sunset reflection. Nothing
// is downloaded; the whole set costs a few milliseconds and a couple of megabytes of video memory.
import * as THREE from '../vendor/three/three.module.min.js?v=0.1.21';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function tex(c, { repeat = false, srgb = true, mips = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4; t.generateMipmaps = mips;
  return t;
}

// grey grain around mid-grey (tiles); r channel = fine grain, g = blotches
export function grain(size = 256, seed = 7) {
  const [c, g] = canvas(size, size), R = rng(seed), img = g.createImageData(size, size);
  // blotch field: a few soft value-noise octaves, tiled
  const N = 16, grid = []; for (let i = 0; i < N * N; i++) grid.push(R());
  const val = (x, y, n) => { const gx = x * n / size, gy = y * n / size, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0; const at = (i, k) => grid[((((y0 + k) % n) + n) % n) * N + ((((x0 + i) % n) + n) % n)]; const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return (at(0, 0) * (1 - sx) + at(1, 0) * sx) * (1 - sy) + (at(0, 1) * (1 - sx) + at(1, 1) * sx) * sy; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, fine = R(), blot = val(x, y, 4) * 0.6 + val(x, y, 8) * 0.3 + val(x, y, 16) * 0.1;
    img.data[i] = 96 + fine * 64 + (R() < 0.02 ? 50 : 0); img.data[i + 1] = blot * 255; img.data[i + 2] = 128; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, { repeat: true, srgb: false });
}

// a pine on a transparent card: dark body, a warm rim on the sunward edge, a cool one on the other
export function pineCard(seed = 3) {
  const [c, g] = canvas(128, 256), R = rng(seed);
  const tiers = 9;
  for (let t = 0; t < tiers; t++) {
    const y = 236 - t * 24, w = 58 - t * 5.5 + R() * 6;
    const grd = g.createLinearGradient(64 - w, 0, 64 + w, 0);
    grd.addColorStop(0, '#2c5a50'); grd.addColorStop(0.35, '#15302c'); grd.addColorStop(0.8, '#0f2224'); grd.addColorStop(1, '#ff9a6a');
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(64, y - 42);
    for (let k = 0; k <= 10; k++) { const a = k / 10; g.lineTo(64 - w + a * 2 * w + (R() - 0.5) * 6, y + (k % 2 ? 4 : -2) + R() * 5); }
    g.closePath(); g.fill();
  }
  g.fillStyle = '#1a1014'; g.fillRect(60, 232, 8, 24);
  return tex(c);
}

// lit windows on a dark facade (tiles): warm offices, a few cool screens, many dark
export function facade(seed = 11) {
  const [c, g] = canvas(256, 256), R = rng(seed);
  g.fillStyle = '#1b1626'; g.fillRect(0, 0, 256, 256);
  for (let y = 8; y < 256; y += 16) for (let x = 6; x < 256; x += 12) {
    const r = R();
    g.fillStyle = r < 0.22 ? '#ffc27a' : r < 0.28 ? '#9ff0ff' : r < 0.31 ? '#ff6fb5' : '#2a2238';
    g.fillRect(x, y, 7, 9);
  }
  g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < 256; y += 64) g.fillRect(0, y, 256, 3);
  return tex(c, { repeat: true });
}

// a corner chevron board: glowing amber arrows on black, no words
export function chevron() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#100810'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#ffb347'; g.lineWidth = 16; g.lineJoin = 'miter';
  for (const x of [30, 74]) { g.beginPath(); g.moveTo(x, 22); g.lineTo(x + 30, 64); g.lineTo(x, 106); g.stroke(); }
  g.strokeStyle = '#3a2430'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
  return tex(c);
}

// soft dark rounded rectangle for under the car
export function shadowBlob() {
  const [c, g] = canvas(128, 256);
  for (let i = 0; i < 24; i++) { const k = i / 24; g.fillStyle = `rgba(0,0,0,${0.05 + k * 0.035})`; const ix = 6 + k * 34, iy = 10 + k * 58; g.beginPath(); if (g.roundRect) g.roundRect(ix, iy, 128 - 2 * ix, 256 - 2 * iy, 30 * (1 - k) + 6); else g.rect(ix, iy, 128 - 2 * ix, 256 - 2 * iy); g.fill(); }
  return tex(c, { srgb: false });
}

// A matcap: what a sphere of this finish looks like at sunset. View space: up is sky (violet), the horizon band is
// the sunset (orange to pink), down is dark ground; plus a hot sun glint and a cool lamp glint.
export function matcap(kind, hex = '#20d6c7') {
  const S = 256, [c, g] = canvas(S, S), img = g.createImageData(S, S);
  const base = new THREE.Color(hex);
  const P = { paint: [1.15, 0.55, 0.5], glass: [0.06, 0.72, 0.9], rubber: [0.06, 0.18, 0.12], chrome: [0.25, 1.1, 1.0], gold: [0.4, 1.0, 0.9], dark: [0.12, 0.35, 0.3], trim: [0.15, 0.16, 0.25], tint: [0.55, 0.3, 0.5] }[kind];
  const [diff, refl, spec] = P;
  const env = (ry) => { // reflection colour by the reflected ray's height
    if (ry > 0.18) { const t = Math.min(1, (ry - 0.18) / 0.8); return [0.32 * (1 - t) + 0.08 * t, 0.16 * (1 - t) + 0.05 * t, 0.55 * (1 - t) + 0.22 * t]; }
    if (ry > -0.05) { const t = (ry + 0.05) / 0.23; return [1.0 * (1 - t) + 0.95 * t, 0.62 * (1 - t) + 0.3 * t, 0.3 * (1 - t) + 0.5 * t]; }
    const t = Math.min(1, (-ry - 0.05) / 0.5); return [0.18 * (1 - t) + 0.03 * t, 0.08 * (1 - t) + 0.02 * t, 0.12 * (1 - t) + 0.04 * t];
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const nx = (x + 0.5) / S * 2 - 1, ny = 1 - (y + 0.5) / S * 2, r2 = nx * nx + ny * ny, i = (y * S + x) * 4;
    if (r2 > 1) { img.data[i + 3] = 0; continue; }
    const nz = Math.sqrt(1 - r2);
    // reflect the view ray (0,0,-1) about n: r = v - 2 (v.n) n
    const ry = 2 * nz * ny, rx = 2 * nz * nx;
    const fres = 0.12 + 0.88 * Math.pow(1 - nz, 3);
    let e = env(ry);
    // black trim (mirrors, wing, struts, pipes) reflects the sky without its colour: no tan cast under the lamps
    if (kind === 'trim') { const l = 0.3 * e[0] + 0.55 * e[1] + 0.15 * e[2]; e = [l * 0.75, l * 0.8, l * 0.95]; }
    const lambert = Math.max(0, nx * -0.35 + ny * 0.6 + nz * 0.7) * 0.75 + 0.25;
    let col = [0, 0, 0];
    if (kind === 'paint') {
      // Metallic paint under a clear coat (day 2: the KESTREL must read deep violet, not teal). The base coat's own
      // colour, lit; its reflections tinted by that colour (metal flake: the hue stays the paint's); a sparkle of
      // flake; and the clear coat on top, a colourless mirror that only wakes at grazing angles.
      const mx = Math.max(base.r, base.g, base.b, 1e-3), hue = [base.r / mx, base.g / mx, base.b / mx];
      const lumE = 0.3 * e[0] + 0.55 * e[1] + 0.15 * e[2];
      const flake = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1 + 1) % 1 > 0.93 ? 0.35 : 0;
      const coat = Math.pow(1 - nz, 4) * 0.85 + 0.03;
      for (let k = 0; k < 3; k++) {
        const b = k === 0 ? base.r : k === 1 ? base.g : base.b;
        col[k] = b * (0.5 + 1.1 * lambert) + hue[k] * mx * (lumE * 1.6 + flake) * (0.6 + 0.4 * nz) + e[k] * coat;
      }
    } else for (let k = 0; k < 3; k++) {
      const b = k === 0 ? base.r : k === 1 ? base.g : base.b;
      col[k] = b * diff * lambert + e[k] * refl * (0.6 + 0.4 * fres) * (kind === 'gold' ? [1, 0.75, 0.35][k] : 1);
    }
    // glints: the low sun off to the side, a lamp above
    const sun = Math.pow(Math.max(0, (rx * -0.75 + ry * 0.1 + 0.6) / 1.35), 40) * 2.2 * spec;
    const lamp = Math.pow(Math.max(0, ny * 0.8 + nx * 0.3 + nz * 0.5), 60) * 1.2 * spec;
    col[0] += sun * 1.0 + lamp * 0.7; col[1] += sun * 0.75 + lamp * 0.95; col[2] += sun * 0.45 + lamp * 1.0;
    // to sRGB bytes
    for (let k = 0; k < 3; k++) { const v = Math.max(0, Math.min(1, col[k])); img.data[i + k] = Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); }
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, { mips: false });
}
