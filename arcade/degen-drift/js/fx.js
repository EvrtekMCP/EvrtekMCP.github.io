// DRIFTLINE: the cheap effects that sell a drift. Tire smoke: one instanced draw of camera-facing puffs whose whole
// life (rise, spread, fade) is worked out on the GPU from their birth time, so the CPU writes one puff and forgets it.
// Skid marks: a ring buffer of quads on the road, oldest overwritten, fading with age. Sparks off the walls: additive
// points with gravity. Speed lines: streaks round the edge of the view, fed by speed.
import * as THREE from '../vendor/three/three.module.min.js?v=0.1.25';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Smoke {
  constructor(count) {
    this.n = count; this.head = 0;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aVel = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aBirth = new THREE.InstancedBufferAttribute(new Float32Array(count).fill(-999), 1).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4).setUsage(THREE.DynamicDrawUsage); // rgb light, life
    g.setAttribute('aPos', this.aPos); g.setAttribute('aVel', this.aVel); g.setAttribute('aBirth', this.aBirth); g.setAttribute('aCol', this.aCol);
    g.instanceCount = count;
    this.uTime = { value: 0 };
    this.mat = new THREE.ShaderMaterial({
      uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { time: this.uTime, tint: { value: new THREE.Color('#e8e4ee') }, density: { value: 1 } }),
      fog: true, transparent: true, depthWrite: false,
      vertexShader: `attribute vec3 aPos; attribute vec3 aVel; attribute float aBirth; attribute vec4 aCol; uniform float time; uniform float density; varying float vA; varying vec3 vL; varying vec2 vQ;
        #include <fog_pars_vertex>
        void main() {
          float life = aCol.w, age = (time - aBirth) / life;
          if (age < 0.0 || age > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          float t = age * life;
          vec3 p = aPos + aVel * (1.0 - exp(-t * 1.6)) / 1.6 + vec3(0.0, 0.9 * t + 0.25 * t * t, 0.0);
          float size = 0.7 + 4.2 * sqrt(age);
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          // day 3, the white-out: a puff near the lens fades away (gone inside 1.5 m), and a puff that would cover a big
          // share of the screen thins out, so your own smoke never blinds you; from outside it looks the same
          float depth = max(-mvPosition.z, 0.05);
          float nearF = smoothstep(1.5, 6.0, depth);
          float cover = size / (depth * 0.6);
          float coverF = clamp(0.5 / max(cover, 0.5), 0.0, 1.0);
          float a = fract(sin(aBirth * 91.7) * 43758.5) * 6.28 + t * 0.6;
          vec2 c = position.xy; vQ = c;
          mvPosition.xy += mat2(cos(a), -sin(a), sin(a), cos(a)) * c * size;
          gl_Position = projectionMatrix * mvPosition;
          vA = (1.0 - age) * (1.0 - age) * smoothstep(0.0, 0.06, age) * nearF * coverF * density; vL = aCol.rgb;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform vec3 tint; varying float vA; varying vec3 vL; varying vec2 vQ;
        #include <fog_pars_fragment>
        void main() { float d = dot(vQ, vQ) * 4.0; float a = (1.0 - smoothstep(0.35, 1.0, d)) * vA * 0.34; if (a < 0.004) discard;
          // the light it picks up is capped: a lamp-lit puff glows, it never goes paper white
          gl_FragColor = vec4(tint * min(vL, vec3(0.82)), a);
          #include <fog_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 4;
    this.dirty = [];
  }
  emit(x, y, z, vx, vy, vz, light, life, time) {
    const i = this.head; this.head = (this.head + 1) % this.n;
    this.aPos.array.set([x, y, z], i * 3); this.aVel.array.set([vx, vy, vz], i * 3);
    this.aBirth.array[i] = time; this.aCol.array.set([light[0], light[1], light[2], life], i * 4);
    this.dirty.push(i);
  }
  flush(time) {
    this.uTime.value = time;
    if (!this.dirty.length) return;
    let lo = Math.min(...this.dirty), hi = Math.max(...this.dirty);
    if (hi - lo > this.n / 2) { lo = 0; hi = this.n - 1; } // wrapped round: send it all
    for (const [a, s] of [[this.aPos, 3], [this.aVel, 3], [this.aBirth, 1], [this.aCol, 4]]) { a.clearUpdateRanges(); a.addUpdateRange(lo * s, (hi - lo + 1) * s); a.needsUpdate = true; }
    this.dirty.length = 0;
  }
  setTint(hex) { this.mat.uniforms.tint.value.set(hex); }
  // how much smoke hangs round the camera: count the living puffs within 7 m of it, thin them all as the count rises,
  // and tell the emitter to ease off (returns the emission factor, 0.2..1)
  crowd(cam, time) {
    let near = 0; const P = this.aPos.array, B = this.aBirth.array, C = this.aCol.array;
    for (let i = 0; i < this.n; i++) {
      if (time - B[i] > C[i * 4 + 3]) continue;
      const dx = P[i * 3] - cam.x, dy = P[i * 3 + 1] - cam.y, dz = P[i * 3 + 2] - cam.z;
      if (dx * dx + dy * dy + dz * dz < 49) near++;
    }
    this.near = near;
    const d = Math.max(0.4, Math.min(1, 1 - (near - 16) / 60)) * (this.maxDensity ?? 1);
    this.mat.uniforms.density.value += (d - this.mat.uniforms.density.value) * 0.1;
    return Math.max(0.2, Math.min(1, 24 / Math.max(24, near)));
  }
}

export class Skids {
  // 11-26: room for cap quads; the ring in use is setLength's (the quality tier's under Classic World detail, as before;
  // under Full a lap's worth, so the marks stay for the lap). Only the ring in use is drawn.
  constructor(quads, cap = quads) {
    this.n = quads; this.head = 0; this.cap = cap = Math.max(cap, quads); quads = cap;
    const pos = new Float32Array(quads * 4 * 3), alpha = new Float32Array(quads * 4), order = new Float32Array(quads * 4), idx = new Uint32Array(quads * 6);
    for (let q = 0; q < quads; q++) { for (let k = 0; k < 4; k++) order[q * 4 + k] = q; idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 1, q * 4 + 3, q * 4 + 2], q * 6); }
    const g = new THREE.BufferGeometry();
    this.aP = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage); this.aA = new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aP); g.setAttribute('aAlpha', this.aA); g.setAttribute('aOrder', new THREE.BufferAttribute(order, 1)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.uHead = { value: 0 };
    this.mat = new THREE.ShaderMaterial({
      uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { head: this.uHead, total: { value: this.n } }),
      fog: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
      vertexShader: `attribute float aAlpha; attribute float aOrder; uniform float head; uniform float total; varying float vA;
        #include <fog_pars_vertex>
        void main() { float age = mod(head - aOrder + total, total) / total; vA = aAlpha * (1.0 - age * age * age); vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader: `varying float vA;
        #include <fog_pars_fragment>
        void main() { gl_FragColor = vec4(0.012, 0.01, 0.016, vA * 0.78);
        #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
    this.last = [null, null, null, null]; this.lo = Infinity; this.hi = -1;
    g.setDrawRange(0, this.n * 6);
  }
  setLength(n) { n = Math.max(1, Math.min(this.cap, n)); if (n === this.n) return; this.n = n; this.mat.uniforms.total.value = n; this.mesh.geometry.setDrawRange(0, n * 6); this.head = 0; this.aA.array.fill(0); this.aA.clearUpdateRanges(); this.aA.needsUpdate = true; this.lift(); }
  // a wheel's mark: p = [x,y,z] contact, (dx,dz) the wheel's sideways unit vector, a = strength 0..1 (0 lifts)
  mark(w, p, dx, dz, a) {
    const half = 0.12, L = [p[0] + dx * half, p[1] + 0.03, p[2] + dz * half], Rr = [p[0] - dx * half, p[1] + 0.03, p[2] - dz * half];
    const prev = this.last[w];
    if (a <= 0.02) { this.last[w] = null; return; }
    if (!prev) { this.last[w] = { L, R: Rr, a }; return; }
    if ((L[0] - prev.L[0]) ** 2 + (L[2] - prev.L[2]) ** 2 < 0.09) return; // every ~30 cm
    const q = this.head; this.head = (this.head + 1) % this.n;
    const P = this.aP.array, A = this.aA.array;
    P.set([...prev.L, ...prev.R, ...L, ...Rr], q * 12);
    A.set([prev.a, prev.a, a, a], q * 4);
    this.lo = Math.min(this.lo, q); this.hi = Math.max(this.hi, q);
    this.last[w] = { L, R: Rr, a };
  }
  lift() { this.last = [null, null, null, null]; }
  flush() {
    this.uHead.value = this.head;
    if (this.hi < 0) return;
    let lo = this.lo, hi = this.hi; if (hi - lo > this.n / 2) { lo = 0; hi = this.n - 1; }
    this.aP.clearUpdateRanges(); this.aP.addUpdateRange(lo * 12, (hi - lo + 1) * 12); this.aP.needsUpdate = true;
    this.aA.clearUpdateRanges(); this.aA.addUpdateRange(lo * 4, (hi - lo + 1) * 4); this.aA.needsUpdate = true;
    this.lo = Infinity; this.hi = -1;
  }
  clear() { this.aA.array.fill(0); this.aA.clearUpdateRanges(); this.aA.needsUpdate = true; this.lift(); }
}

export class Sparks {
  constructor(count = 96) {
    this.n = count; this.head = 0;
    const g = new THREE.BufferGeometry();
    this.aP = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aV = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aB = new THREE.BufferAttribute(new Float32Array(count).fill(-999), 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aP); g.setAttribute('aVel', this.aV); g.setAttribute('aBirth', this.aB);
    this.uTime = { value: 0 }; this.uScale = { value: 1 };
    this.mat = new THREE.ShaderMaterial({
      uniforms: { time: this.uTime, scale: this.uScale }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 aVel; attribute float aBirth; uniform float time; uniform float scale; varying float vA;
        void main() { float t = time - aBirth; if (t < 0.0 || t > 0.55) { gl_Position = vec4(2.0); gl_PointSize = 0.0; return; }
          vec3 p = position + aVel * t + vec3(0.0, -4.9 * t * t, 0.0); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          vA = 1.0 - t / 0.55; gl_PointSize = clamp(9.0 * scale / -mv.z * 6.0, 1.0, 8.0 * scale); }`,
      fragmentShader: `varying float vA; void main() { vec2 q = gl_PointCoord - 0.5; float a = exp(-dot(q, q) * 14.0) * vA; gl_FragColor = vec4(vec3(1.6, 0.9, 0.35) * a, 1.0); }`,
    });
    this.mesh = new THREE.Points(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
  }
  burst(p, nx, nz, speed, time, rnd) {
    const k = Math.min(24, 6 + Math.round(speed * 2));
    for (let j = 0; j < k; j++) {
      const i = this.head; this.head = (this.head + 1) % this.n;
      this.aP.array.set(p, i * 3);
      const s = 2 + rnd() * 5 + speed * 0.3, sx = (rnd() - 0.5) * 6;
      this.aV.array.set([-nx * s + nz * sx, 1 + rnd() * 3, -nz * s - nx * sx], i * 3);
      this.aB.array[i] = time;
    }
    this.aP.needsUpdate = this.aV.needsUpdate = this.aB.needsUpdate = true;
  }
  flush(time) { this.uTime.value = time; }
}

// streaks at the edges of the view, in camera space; strength 0..1
export class SpeedLines {
  constructor(count = 70) {
    const pos = [], aS = [], idx = [];
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, r = 1.1 + Math.random() * 1.6, z0 = Math.random(), base = pos.length / 3;
      const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.62, w = 0.008 + Math.random() * 0.01, nx = -Math.sin(a), ny = Math.cos(a) * 0.62;
      for (const [d, e] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) { pos.push(x + nx * w * d, y + ny * w * d, e); aS.push(z0); }
      idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(aS, 1)); g.setIndex(idx);
    this.u = { time: { value: 0 }, strength: { value: 0 } };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aSeed; uniform float time; varying float vA; varying float vE;
        void main() { float z = fract(aSeed - time * 1.7); float e = position.z; vec3 p = vec3(position.xy * (1.0 + z * 0.4), -1.0 - (z + e * 0.35) * 6.0);
          vA = sin(z * 3.14159); vE = e; gl_Position = projectionMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform float strength; varying float vA; varying float vE; void main() { float a = vA * strength * (1.0 - vE) * 0.35; gl_FragColor = vec4(vec3(0.75, 0.9, 1.0) * a, 1.0); }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 10;
  }
  update(time, strength) { this.u.time.value = time; this.u.strength.value = clamp(strength, 0, 1); this.mesh.visible = strength > 0.02; }
}
