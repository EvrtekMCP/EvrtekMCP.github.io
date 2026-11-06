// STARWAKE 0.2.0: the backdrop every level shares: the sky (two shells that crossfade between looks), the fog,
// the light, the stars, the speed lines and the gas clouds. Nothing here collides. A level's looks set its
// colours (levels/levelN.js, `looks`); its landmarks and its streams of scenery are its own (scenery.js).
// 0.2.0 (ruling 5): the stars and the clouds used to wrap round to the far end at full brightness, a pop on
// every wrap. Both now condense out of the far haze.
import * as THREE from '../vendor/three/three.module.min.js?v=0.2.0';
import * as TX from './textures.js?v=0.2.0';
import { rng, lerp, clamp, smoothstep } from './util.js?v=0.2.0';
import { FOG_NEAR, FOG_FAR } from './space.js?v=0.2.0';

const tmpCol = new THREE.Color();
export class Backdrop {
  constructor(scene, tier) {
    this.scene = scene; this.tier = tier;
    this.glowTex = TX.glow(64, 0.2);
    this.sky = {}; this.env = {}; this.level = null; this.looks = {};
    const skyGeo = new THREE.SphereGeometry(900, 48, 24);
    this.skyA = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false }));
    this.skyB = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false, transparent: true, opacity: 0 }));
    this.skyA.renderOrder = -10; this.skyB.renderOrder = -9;
    scene.add(this.skyA, this.skyB);
    this.fade = 1; this.look = null; this.starK = 1;
    this.starTint = new THREE.Color(1, 1, 1);
    scene.fog = new THREE.Fog(0x000000, FOG_NEAR, FOG_FAR);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x202040, 1.6);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2); this.sun.position.set(-0.6, 1, 0.4);
    scene.add(this.hemi, this.sun);
    this._stars(); this._speedLines(); this._clouds();
  }
  _key(id) { return this.level.id + ':' + id; }
  _skyTex(id) {
    const k = this._key(id);
    if (!this.sky[k]) {
      const L = this.looks[id], low = this.tier === 0;
      // level 1's skies keep 0.1.0's seeds (id.length * 131 + 7), so its sectors look exactly as they did
      this.sky[k] = TX.sky(L.seed ?? id.length * 131 + 7, L.sky, { band: L.band, gas: L.gas, dust: L.dust, w: low ? 512 : 1024, h: low ? 256 : 512, stars: low ? 900 : (L.stars ?? 1600), blobs: low ? 90 : (L.blobs ?? 140) });
    }
    return this.sky[k];
  }
  // A level's skies and environment maps, built one per tick so the loading bar moves and nothing stalls a frame
  // for long. Each sky is also its look's environment map: Yori's slate and gunmetal are real metal, and metal
  // with nothing to reflect renders black.
  prepare(level, renderer, progress) {
    this.useLevel(level);
    const ids = Object.keys(level.looks).filter((id) => !this.env[this._key(id)]);
    return new Promise((done) => {
      if (!ids.length) { done(); return; }
      const pm = new THREE.PMREMGenerator(renderer);
      const next = (i) => {
        if (i >= ids.length) { pm.dispose(); if (this.look) this.scene.environment = this.env[this._key(this.look)] || null; done(); return; }
        const t = this._skyTex(ids[i]);
        renderer.initTexture(t);
        this.env[this._key(ids[i])] = pm.fromEquirectangular(t).texture;
        if (progress) progress((i + 1) / ids.length);
        setTimeout(() => next(i + 1), 16);
      };
      setTimeout(() => next(0), 16);
    });
  }
  // switching levels: free the other levels' skies (each is ~2 MB of texture plus its environment map)
  useLevel(level) {
    if (this.level === level) return;
    this.level = level; this.looks = level.looks; this.look = null;
    for (const k of Object.keys(this.sky)) if (!k.startsWith(level.id + ':')) {
      if (this.skyA.material.map === this.sky[k] || this.skyB.material.map === this.sky[k]) continue;
      this.sky[k].dispose(); delete this.sky[k];
      if (this.env[k]) { this.env[k].dispose(); delete this.env[k]; }
    }
  }
  setLook(id, instant) {
    if (this.look === id) return;
    const L = this.looks[id];
    if (!L) throw new Error('no look "' + id + '" in level ' + (this.level && this.level.n));
    this.look = id; this.L = L;
    // a look may aim the key light (level 2: a hard sun from the upper right); default is 0.1.0's upper left
    const sd = L.sunDir || [-0.6, 1, 0.4]; this.sun.position.set(sd[0], sd[1], sd[2]);
    this.sun.intensity = L.sunPower ?? 2.2; this.hemi.intensity = L.hemiPower ?? 1.6;
    const env = this.env[this._key(id)]; if (env) this.scene.environment = env;
    if (instant || !this.skyA.material.map) {
      this.skyA.material.map = this._skyTex(id); this.skyA.material.needsUpdate = true;
      this.skyB.material.opacity = 0; this.fade = 1;
      this.scene.fog.color.setHex(L.fog); this.hemi.color.setHex(L.hemiSky); this.hemi.groundColor.setHex(L.hemiGround); this.sun.color.setHex(L.sun);
      this.cloudCol.setHex(L.cloud);
      this.cloudLevel = L.clouds ?? 0.2; // a cut: in place at once, behind the fade from black
    } else {
      this.skyB.material.map = this._skyTex(id); this.skyB.material.needsUpdate = true; this.skyB.material.opacity = 0; this.fade = 0;
      this._from = { fog: this.scene.fog.color.clone(), hs: this.hemi.color.clone(), hg: this.hemi.groundColor.clone(), sun: this.sun.color.clone(), cl: this.cloudCol.clone() };
    }
  }
  _stars() {
    const n = this.tier === 0 ? 500 : this.tier === 1 ? 900 : 1400;
    const p = new Float32Array(n * 3), c = new Float32Array(n * 3), R = rng(5);
    this.starBase = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[i * 3] = R.range(-90, 90); p[i * 3 + 1] = R.range(-60, 60); p[i * 3 + 2] = R.range(-700, 20);
      if (Math.abs(p[i * 3]) < 9 && Math.abs(p[i * 3 + 1]) < 6) p[i * 3] += 18 * Math.sign(p[i * 3] || 1);
      const w = R(); this.starBase[i * 3] = 0.7 + 0.3 * w; this.starBase[i * 3 + 1] = 0.8 + 0.2 * R(); this.starBase[i * 3 + 2] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.9, map: this.glowTex, vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false, sizeAttenuation: true }));
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }
  _speedLines() {
    const n = this.tier === 0 ? 50 : 110;
    const p = new Float32Array(n * 6), c = new Float32Array(n * 6), R = rng(11);
    this.lines = [];
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, r = R.range(7, 30);
      this.lines.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.7, z: R.range(-400, 10), w: R.range(0.4, 1) });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    this.lineMesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.lineMesh.frustumCulled = false;
    this.scene.add(this.lineMesh);
  }
  _clouds() {
    this.cloudTex = TX.cloud(4);
    this.cloudCol = new THREE.Color(0xff5fd0);
    this.clouds = [];
    const n = this.tier === 0 ? 0 : this.tier === 1 ? 8 : 14, R = rng(17);
    for (let i = 0; i < n; i++) {
      // one material each, so each can fade on its own as it condenses out of the far end
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.cloudTex, color: 0xff5fd0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      const side = R.sign();
      s.position.set(side * R.range(14, 60), R.range(-30, 30), R.range(-700, 0));
      const k = R.range(40, 110); s.scale.set(k, k * R.range(0.5, 0.9), 1);
      this.clouds.push(s); this.scene.add(s);
    }
    this.cloudLevel = 0; this.cloudWant = 0;
  }
  // heat: GREED (0..1); boost: a boost burst (0..1) stretches the speed lines too
  update(dt, v, dist, heat, cam, boost = 0) {
    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / 2.5);
      const f = this.fade, L = this.L, o = this._from;
      this.skyB.material.opacity = f;
      this.scene.fog.color.copy(o.fog).lerp(tmpCol.setHex(L.fog), f);
      this.hemi.color.copy(o.hs).lerp(tmpCol.setHex(L.hemiSky), f);
      this.hemi.groundColor.copy(o.hg).lerp(tmpCol.setHex(L.hemiGround), f);
      this.sun.color.copy(o.sun).lerp(tmpCol.setHex(L.sun), f);
      this.cloudCol.copy(o.cl).lerp(tmpCol.setHex(L.cloud), f);
      if (f >= 1) { this.skyA.material.map = this.skyB.material.map; this.skyA.material.needsUpdate = true; this.skyB.material.opacity = 0; }
    }
    this.skyA.rotation.y = this.skyB.rotation.y = dist * 0.000015;
    this.skyA.position.copy(cam.position); this.skyB.position.copy(cam.position);

    // stars stream past, and brighten in from the far end instead of appearing there
    const sp = this.stars.geometry.attributes.position, a = sp.array, ca = this.stars.geometry.attributes.color.array, base = this.starBase;
    // a look can dim or tint the streaming stars (lv-4: white flakes read grey on a bright sky): starGlow 0..1, starTint
    const wantK = this.L ? (this.L.starGlow ?? 1) : 1;
    this.starK += (wantK - this.starK) * (1 - Math.exp(-dt * 1.5));
    if (this.L && this.L.starTint !== undefined) this.starTint.lerp(tmpCol.setHex(this.L.starTint), 1 - Math.exp(-dt * 1.5)); else this.starTint.lerp(tmpCol.setRGB(1, 1, 1), 1 - Math.exp(-dt * 1.5));
    const sk = this.starK, st = this.starTint;
    for (let i = 2, j = 0; i < a.length; i += 3, j += 3) {
      a[i] += v * dt; if (a[i] > 20) a[i] -= 720;
      const k = smoothstep(-700, -560, a[i]) * sk;
      ca[j] = base[j] * k * st.r; ca[j + 1] = base[j + 1] * k * st.g; ca[j + 2] = base[j + 2] * k * st.b;
    }
    sp.needsUpdate = true; this.stars.geometry.attributes.color.needsUpdate = true;

    // speed lines: length grows with speed, heat and boost
    const lp = this.lineMesh.geometry.attributes.position.array, lc = this.lineMesh.geometry.attributes.color.array;
    const hot = Math.max(heat, boost * 0.8);
    const len = clamp((v - 50) * 0.12, 1, 14) * (1 + hot * 0.8), bright = clamp((v - 55) / 80, 0.15, 1) * (0.7 + hot * 0.6);
    const hr = 0.5 + heat * 0.5, hg = 0.85 - heat * 0.45, hb = 1 - heat * 0.3;
    for (let i = 0; i < this.lines.length; i++) {
      const L = this.lines[i];
      L.z += v * dt * 1.6;
      if (L.z > 12) { L.z -= 410; }
      const o = i * 6;
      lp[o] = L.x; lp[o + 1] = L.y; lp[o + 2] = L.z; lp[o + 3] = L.x; lp[o + 4] = L.y; lp[o + 5] = L.z - len * L.w;
      const b = bright * L.w * clamp((L.z + 400) / 120, 0, 1);
      lc[o] = hr * b; lc[o + 1] = hg * b; lc[o + 2] = hb * b; lc[o + 3] = 0; lc[o + 4] = 0; lc[o + 5] = 0;
    }
    this.lineMesh.geometry.attributes.position.needsUpdate = true; this.lineMesh.geometry.attributes.color.needsUpdate = true;

    // clouds: the look sets how thick; each one fades in from the far end and out as it passes
    this.cloudWant = this.L ? (this.L.clouds ?? 0.2) : 0;
    this.cloudLevel = lerp(this.cloudLevel, this.cloudWant, 1 - Math.exp(-dt * 0.6));
    for (const s of this.clouds) {
      s.position.z += v * dt * 0.9; if (s.position.z > 30) s.position.z -= 740;
      s.material.opacity = this.cloudLevel * smoothstep(-710, -520, s.position.z) * smoothstep(20, -100, s.position.z);
      s.material.color.copy(this.cloudCol);
    }
  }
}
