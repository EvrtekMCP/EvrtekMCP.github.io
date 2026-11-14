// LEVEL 5, ION STORM: the lightning. One draw call for every arc on screen (ArcLayer), and the clock that
// switches them (patterns locked to the music's beat). Arcs are white-hot cores in a red fringe: white is
// Yori's storm, the red fringe is rule 9 (red hurts). Only an arc that can hurt you has the fringe; the
// storm's own far lightning (scenery.js) is violet-white with none.
import { THREE } from '../../api.js?v=0.6.4';

// ---------------------------------------------------------------- the patterns
// One character per beat: X live (it hurts), . dark. The FOUR beats before every live run are its CHARGE: both
// lamps lit, red going white-hot (Yori's tell: "an arc about to fire has both lamps lit"): a whole bar of warning,
// then it fires on the beat. 4 beats at 146 bpm is 1.64 s at the plan's speed and 1.28 s at GREED's (x1.28: the
// arcs keep the course's beat), over rule 12's 1.2 s for a new hazard either way. A pattern with a dark run
// shorter than the charge is refused when the level loads.
export const CHARGE_BEATS = 4;
export const PATTERNS = {
  slow: 'XXXXXXXX........', // a whole two bars live, two bars dark
  bar: 'XXXX....',          // a bar live, a bar dark
  anti: '....XXXX',         // the same, half a cycle later (the other wall of a corridor)
  strike: 'X.......',       // live on the one of every other bar, charging the whole bar before
  chase: 'XXXX........',    // three of these, offset 0, 4 and 8 beats, light one after another
  half: 'XX......',         // live for two beats in eight
  live: 'X',                // always live (the lightning wall)
};
export function checkPattern(p, who) {
  if (!/^[X.]+$/.test(p)) throw new Error(who + ': pattern "' + p + '" may hold only X and .');
  if (!p.includes('.')) return p; // always live: no switching, nothing to warn of
  if (!p.includes('X')) return p;
  // every dark run, read round the cycle, must be at least CHARGE_BEATS long
  const n = p.length, start = p.indexOf('X');
  let run = 0;
  for (let k = 1; k <= n; k++) {
    const c = p[(start + k) % n];
    if (c === '.') run++;
    else { if (run > 0 && run < CHARGE_BEATS) throw new Error(who + ': pattern "' + p + '" has a dark run of ' + run + ' beats; a live run needs ' + CHARGE_BEATS + ' dark beats before it (rule 12)'); run = 0; }
  }
  return p;
}
// state at beat b (a float, beats since the level began) for pattern p shifted by `off` beats:
//   live: hurts now. charge: 0..1 over the CHARGE_BEATS before a live run (0 when not charging).
//   toLive: beats until it next goes live (0 when live).
export function arcState(p, b, off = 0, out = {}) {
  const n = p.length, x = b - off, i = ((Math.floor(x) % n) + n) % n, f = x - Math.floor(x);
  out.live = p[i] === 'X';
  if (out.live) { out.charge = 0; out.toLive = 0; return out; }
  let k = 1;
  while (k <= n && p[(i + k) % n] !== 'X') k++;
  const to = k > n ? 1e9 : k - f;
  out.toLive = to;
  out.charge = to <= CHARGE_BEATS ? 1 - to / CHARGE_BEATS : 0;
  return out;
}

// ---------------------------------------------------------------- the layer
// Ribbons in world space, widened in the vertex shader so a far arc never thins below uMinPx pixels.
const VS = `
attribute vec3 perp; attribute float side; attribute float wid; attribute vec4 col;
uniform float uFocal; uniform float uMinPx; uniform vec2 uFade;
varying vec4 vC; varying float vS;
void main() {
  vec4 c0 = modelViewMatrix * vec4(position, 1.0);
  float depth = max(0.5, -c0.z);
  float w = max(wid, uMinPx * depth / uFocal);
  vec4 mv = modelViewMatrix * vec4(position + perp * side * w, 1.0);
  vC = col; vC.a *= 1.0 - smoothstep(uFade.x, uFade.y, depth);
  vS = side;
  gl_Position = projectionMatrix * mv;
}`;
const FS = `
varying vec4 vC; varying float vS;
void main() {
  float a = vC.a * (1.0 - vS * vS);
  if (a < 0.003) discard;
  gl_FragColor = vec4(vC.rgb * a, a);
}`;
const FLOATS = 12; // position 3, perp 3, side 1, wid 1, col 4 (interleaved)

export class ArcLayer {
  constructor(scene, cap) {
    this.cap = cap; this.n = 0;
    this.buf = new Float32Array(cap * 4 * FLOATS);
    const ib = new THREE.InterleavedBuffer(this.buf, FLOATS).setUsage(THREE.DynamicDrawUsage);
    this.ib = ib;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.InterleavedBufferAttribute(ib, 3, 0));
    g.setAttribute('perp', new THREE.InterleavedBufferAttribute(ib, 3, 3));
    g.setAttribute('side', new THREE.InterleavedBufferAttribute(ib, 1, 6));
    g.setAttribute('wid', new THREE.InterleavedBufferAttribute(ib, 1, 7));
    g.setAttribute('col', new THREE.InterleavedBufferAttribute(ib, 4, 8));
    const idx = new Uint32Array(cap * 6);
    for (let q = 0; q < cap; q++) { const v = q * 4, o = q * 6; idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v + 2; idx[o + 4] = v + 1; idx[o + 5] = v + 3; }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uFocal: { value: 600 }, uMinPx: { value: 1.6 }, uFade: { value: new THREE.Vector2(420, 760) } },
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    scene.add(this.mesh);
    this.pts = new Float32Array(64 * 3);
  }
  begin(focalPx) { this.n = 0; if (focalPx) this.mat.uniforms.uFocal.value = focalPx; }
  // one straight ribbon from a to b (world), w its half-width, colour r g b a (premultiplied on draw)
  seg(ax, ay, az, bx, by, bz, w, r, g, b, a, px, py, pz) {
    if (this.n >= this.cap) return;
    if (px === undefined) { // perpendicular in the xy plane (every arc here lies across the track)
      let dx = bx - ax, dy = by - ay; const L = Math.hypot(dx, dy) || 1; px = -dy / L; py = dx / L; pz = 0;
    }
    const B = this.buf; let o = this.n * 4 * FLOATS;
    for (let k = 0; k < 4; k++) {
      const end = k >> 1, s = (k & 1) ? 1 : -1;
      B[o] = end ? bx : ax; B[o + 1] = end ? by : ay; B[o + 2] = end ? bz : az;
      B[o + 3] = px; B[o + 4] = py; B[o + 5] = pz; B[o + 6] = s; B[o + 7] = w;
      B[o + 8] = r; B[o + 9] = g; B[o + 10] = b; B[o + 11] = a;
      o += FLOATS;
    }
    this.n++;
  }
  // a jagged bolt from a to b. seed picks the jag (change it every few frames and the bolt crackles).
  // o: segs, amp (fraction of length), core [r,g,b,a], coreW, halo [r,g,b,a] or null, haloW, fork (0..1 chance)
  bolt(ax, ay, az, bx, by, bz, seed, o) {
    const segs = o.segs || 9, len = Math.hypot(bx - ax, by - ay, bz - az) || 1;
    const amp = (o.amp ?? 0.12) * len;
    let dx = bx - ax, dy = by - ay; const L2 = Math.hypot(dx, dy) || 1; const nx = -dy / L2, ny = dx / L2;
    let h = (seed * 2654435761) >>> 0;
    const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) / 4294967296); };
    const P = this.pts;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, env = Math.sin(t * Math.PI);
      const j = (i === 0 || i === segs) ? 0 : (rnd() * 2 - 1) * amp * (0.35 + 0.65 * env);
      P[i * 3] = ax + (bx - ax) * t + nx * j; P[i * 3 + 1] = ay + (by - ay) * t + ny * j; P[i * 3 + 2] = az + (bz - az) * t + (rnd() - 0.5) * amp * 0.3;
    }
    const c = o.core, hc = o.halo;
    for (let i = 0; i < segs; i++) {
      const a = i * 3, b = a + 3;
      if (hc) this.seg(P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], o.haloW || 0.7, hc[0], hc[1], hc[2], hc[3]);
      this.seg(P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], o.coreW || 0.12, c[0], c[1], c[2], c[3]);
    }
    // a fork: a short spur off one joint
    if (o.fork && rnd() < o.fork) {
      const i = 2 + Math.floor(rnd() * (segs - 3)), a = i * 3;
      const fl = len * (0.08 + rnd() * 0.12), s = rnd() < 0.5 ? 1 : -1;
      const ex = P[a] + ((bx - ax) / len * 0.5 + nx * s) * fl, ey = P[a + 1] + ((by - ay) / len * 0.5 + ny * s) * fl;
      this.seg(P[a], P[a + 1], P[a + 2], ex, ey, P[a + 2], (o.coreW || 0.12) * 0.7, c[0], c[1], c[2], c[3] * 0.8);
    }
  }
  // a flat quad on the plane through two points, extended along the track from z0 to z1 (a sheet's glow)
  plane(ax, ay, bx, by, z0, z1, r, g, b, a) {
    // drawn as one ribbon from the a-b midpoint at z0 to z1, half-width = half the a-b span, perpendicular a-b
    const mx = (ax + bx) / 2, my = (ay + by) / 2, L = Math.hypot(bx - ax, by - ay) || 1;
    this.seg(mx, my, z0, mx, my, z1, L / 2, r, g, b, a, (bx - ax) / L, (by - ay) / L, 0);
  }
  end() {
    const g = this.mesh.geometry;
    g.setDrawRange(0, this.n * 6);
    this.ib.clearUpdateRanges();
    if (this.n) this.ib.addUpdateRange(0, this.n * 4 * FLOATS);
    this.ib.needsUpdate = true;
  }
}
