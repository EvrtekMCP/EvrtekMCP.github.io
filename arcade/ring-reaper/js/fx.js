// STARWAKE: glowing points. One draw call each for every particle on screen and for every shot in flight.
// Points are sized in world units and drawn additively, so overlapping light reads as heat.
import * as THREE from '../vendor/three/three.module.min.js?v=0.6.3';

const VS = `
attribute float size; attribute vec4 col; varying vec4 vC; uniform float uScale; uniform vec2 uFar;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vC = col;
  vC.a *= smoothstep(1.5, 6.0, -mv.z) * (1.0 - smoothstep(uFar.x, uFar.y, -mv.z));
  gl_PointSize = clamp(size * uScale / max(0.5, -mv.z), 0.0, 256.0);
  gl_Position = projectionMatrix * mv;
}`;
const FS = `
uniform sampler2D map; varying vec4 vC;
void main() {
  float a = texture2D(map, gl_PointCoord).a * vC.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vC.rgb * a, a);
}`;

export class GlowPoints {
  constructor(scene, cap, tex) {
    this.cap = cap; this.n = 0;
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 4); this.size = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('col', this.aCol); g.setAttribute('size', this.aSize);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uScale: { value: 400 }, uFar: { value: new THREE.Vector2(1e5, 1e5 + 1) } }, vertexShader: VS, fragmentShader: FS,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    g.setDrawRange(0, 0);
    scene.add(this.points);
  }
  begin() { this.n = 0; }
  push(x, y, z, s, r, g, b, a) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a; this.size[i] = s;
  }
  end() {
    this.points.geometry.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = true;
  }
  setScale(px) { this.mat.uniforms.uScale.value = px; }
  // fade points out between these depths (scenery glows fade into the haze; shots never do)
  setFar(a, b) { this.mat.uniforms.uFar.value.set(a, b); return this; }
}

// Particles: CPU-side state, written into a GlowPoints layer each frame. "carry" particles are fixed in the
// track and stream back at the ship's speed (engine wake, ring bursts); others move only by their own velocity.
export class Particles {
  constructor(scene, cap, tex) {
    this.layer = new GlowPoints(scene, cap, tex); this.cap = cap;
    this.p = []; this.free = [];
    for (let i = 0; i < cap; i++) this.free.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, s0: 1, s1: 0, r: 1, g: 1, b: 1, a: 1, carry: 1, drag: 0 });
  }
  emit(x, y, z, o) {
    const q = this.free.pop(); if (!q) return;
    q.x = x; q.y = y; q.z = z; q.vx = o.vx || 0; q.vy = o.vy || 0; q.vz = o.vz || 0;
    q.life = q.max = o.life || 0.5; q.s0 = o.s0 ?? 1; q.s1 = o.s1 ?? 0; q.r = o.r ?? 1; q.g = o.g ?? 1; q.b = o.b ?? 1; q.a = o.a ?? 1;
    q.carry = o.carry ?? 1; q.drag = o.drag || 0;
    this.p.push(q);
  }
  burst(x, y, z, n, o) {
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), sp = (o.speed || 10) * (0.4 + 0.6 * Math.random());
      this.emit(x, y, z, Object.assign({}, o, { vx: Math.cos(th) * s * sp, vy: Math.sin(th) * s * sp, vz: u * sp * (o.flatZ ?? 1), life: (o.life || 0.6) * (0.6 + 0.4 * Math.random()) }));
    }
  }
  update(dt, v) {
    const L = this.layer; L.begin();
    for (let i = this.p.length - 1; i >= 0; i--) {
      const q = this.p[i];
      q.life -= dt;
      if (q.life <= 0 || q.z > 30) { this.p[i] = this.p[this.p.length - 1]; this.p.pop(); this.free.push(q); continue; }
      if (q.drag) { const k = Math.exp(-q.drag * dt); q.vx *= k; q.vy *= k; q.vz *= k; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += (q.vz + v * q.carry) * dt;
      const t = q.life / q.max;
      L.push(q.x, q.y, q.z, q.s1 + (q.s0 - q.s1) * t, q.r, q.g, q.b, q.a * Math.min(1, t * 1.5));
    }
    L.end();
  }
  clear() { while (this.p.length) this.free.push(this.p.pop()); this.layer.begin(); this.layer.end(); }
}
