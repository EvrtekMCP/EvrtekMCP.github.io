// THE SNIPER's sight-lines: thin glowing ribbons from a muzzle to the ship's plane, and the reticle where the shot
// will land. One draw call for every sniper on screen. Widened in the vertex shader so a line 300 m long never
// thins below about 1.5 pixels at its far end (a world-width line would vanish into the haze).
import { THREE } from '../../api.js?v=0.4.1';

const VS = `
attribute vec3 perp; attribute float side; attribute float wid; attribute vec4 col;
uniform float uFocal; uniform float uMinPx;
varying vec4 vC; varying float vS;
void main() {
  vec4 c0 = modelViewMatrix * vec4(position, 1.0);
  float depth = max(0.5, -c0.z);
  float w = max(wid, uMinPx * depth / uFocal);
  vC = col; vS = side;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + perp * side * w, 1.0);
}`;
const FS = `
varying vec4 vC; varying float vS;
void main() { float a = vC.a * (1.0 - vS * vS * 0.85); gl_FragColor = vec4(vC.rgb * a, a); }`;
const F = 12;

export class SightLines {
  constructor(scene, cap = 160) {
    this.cap = cap; this.n = 0;
    this.buf = new Float32Array(cap * 4 * F);
    const ib = new THREE.InterleavedBuffer(this.buf, F).setUsage(THREE.DynamicDrawUsage); this.ib = ib;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.InterleavedBufferAttribute(ib, 3, 0));
    g.setAttribute('perp', new THREE.InterleavedBufferAttribute(ib, 3, 3));
    g.setAttribute('side', new THREE.InterleavedBufferAttribute(ib, 1, 6));
    g.setAttribute('wid', new THREE.InterleavedBufferAttribute(ib, 1, 7));
    g.setAttribute('col', new THREE.InterleavedBufferAttribute(ib, 4, 8));
    const idx = new Uint16Array(cap * 6);
    for (let q = 0; q < cap; q++) { const v = q * 4, o = q * 6; idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v + 2; idx[o + 4] = v + 1; idx[o + 5] = v + 3; }
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({ uniforms: { uFocal: { value: 600 }, uMinPx: { value: 1.4 } }, vertexShader: VS, fragmentShader: FS,
      transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 8;
    scene.add(this.mesh);
  }
  begin(focalPx) { this.n = 0; if (focalPx) this.mat.uniforms.uFocal.value = focalPx; }
  // a straight ribbon a -> b, half-width w (metres, before the pixel floor), facing a camera near (cx, cy, cz)
  line(ax, ay, az, bx, by, bz, w, r, g, b, a, cx = 0, cy = 2.5, cz = 9.2) {
    if (this.n >= this.cap) return;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const mx = (ax + bx) / 2 - cx, my = (ay + by) / 2 - cy, mz = (az + bz) / 2 - cz;
    let px = dy * mz - dz * my, py = dz * mx - dx * mz, pz = dx * my - dy * mx; const L = Math.hypot(px, py, pz) || 1;
    px /= L; py /= L; pz /= L;
    const B = this.buf; let o = this.n * 4 * F;
    for (let k = 0; k < 4; k++) {
      const end = k >> 1;
      B[o] = end ? bx : ax; B[o + 1] = end ? by : ay; B[o + 2] = end ? bz : az;
      B[o + 3] = px; B[o + 4] = py; B[o + 5] = pz; B[o + 6] = (k & 1) ? 1 : -1; B[o + 7] = w;
      B[o + 8] = r; B[o + 9] = g; B[o + 10] = b; B[o + 11] = a; o += F;
    }
    this.n++;
  }
  // the reticle: a diamond on the ship's plane round (x, y), s metres across
  reticle(x, y, z, s, w, r, g, b, a) {
    const P = [[x, y + s], [x + s, y], [x, y - s], [x - s, y]];
    for (let i = 0; i < 4; i++) { const p = P[i], q = P[(i + 1) % 4]; this.line(p[0], p[1], z, q[0], q[1], z, w, r, g, b, a, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, z + 10); }
  }
  end() {
    this.mesh.geometry.setDrawRange(0, this.n * 6);
    this.ib.clearUpdateRanges(); if (this.n) this.ib.addUpdateRange(0, this.n * 4 * F);
    this.ib.needsUpdate = true;
  }
}
