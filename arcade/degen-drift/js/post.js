// DRIFTLINE: the light post pass, high tier only (the same four-pass recipe as RING REAPER's): the scene renders to a
// half-float target, its bright parts (lamps, neon, the sun, the tail lights) are pulled out at quarter size, blurred
// across and down, and laid back over the picture with a soft vignette and a touch of grade. Below the high tier the
// scene draws straight to the screen and the glow points carry the look on their own.
import * as THREE from '../vendor/three/three.module.min.js?v=0.1.23';

const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BRIGHT = `uniform sampler2D tex; uniform vec2 texel; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tex, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(tex, vUv + texel * vec2(1.0, -1.0)).rgb
         + texture2D(tex, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tex, vUv + texel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c * smoothstep(0.85, 1.8, l), 1.0);
}`;
const BLUR = `uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tex, vUv).rgb * 0.227;
  c += (texture2D(tex, vUv + dir * 1.385).rgb + texture2D(tex, vUv - dir * 1.385).rgb) * 0.316;
  c += (texture2D(tex, vUv + dir * 3.231).rgb + texture2D(tex, vUv - dir * 3.231).rgb) * 0.070;
  gl_FragColor = vec4(c, 1.0);
}`;
const COMBINE = `uniform sampler2D scene; uniform sampler2D bloom; uniform float strength; uniform float flash; varying vec2 vUv;
void main() {
  vec3 c = texture2D(scene, vUv).rgb + texture2D(bloom, vUv).rgb * strength;
  vec2 d = vUv - 0.5;
  c *= 1.0 - dot(d, d) * 0.75;
  c += vec3(1.0, 0.1, 0.15) * flash * dot(d, d) * 2.5;
  c = c / (1.0 + max(c - 1.0, 0.0) * 0.6); // soft shoulder for the hot spots
  c = clamp(c, 0.0, 1.0);
  c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  gl_FragColor = vec4(c, 1.0);
}`;

export class Post {
  constructor(renderer) {
    this.r = renderer;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.quad);
    const mk = (fs, u) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false });
    this.mBright = mk(BRIGHT, { tex: { value: null }, texel: { value: new THREE.Vector2() } });
    this.mBlur = mk(BLUR, { tex: { value: null }, dir: { value: new THREE.Vector2() } });
    this.mCombine = mk(COMBINE, { scene: { value: null }, bloom: { value: null }, strength: { value: 0.7 }, flash: { value: 0 } });
    const ext = renderer.extensions;
    this.type = ext.has('EXT_color_buffer_half_float') || ext.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.rt = null;
  }
  setSize() {
    const s = this.r.getDrawingBufferSize(new THREE.Vector2()), w = Math.max(1, s.x), h = Math.max(1, s.y), q = (n) => Math.max(1, Math.floor(n / 4));
    if (!this.rt) {
      this.rt = new THREE.WebGLRenderTarget(w, h, { type: this.type, samples: 4 });
      const o = { type: this.type, depthBuffer: false };
      this.a = new THREE.WebGLRenderTarget(q(w), q(h), o); this.b = new THREE.WebGLRenderTarget(q(w), q(h), o);
    } else { this.rt.setSize(w, h); this.a.setSize(q(w), q(h)); this.b.setSize(q(w), q(h)); }
    this.w = w; this.h = h;
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.scene, this.cam); }
  render(scene, camera, on, flash = 0) {
    const r = this.r;
    if (!on) { r.setRenderTarget(null); r.render(scene, camera); return; }
    if (!this.rt) this.setSize();
    r.setRenderTarget(this.rt); r.render(scene, camera);
    this.mBright.uniforms.tex.value = this.rt.texture; this.mBright.uniforms.texel.value.set(1 / this.w, 1 / this.h);
    this.pass(this.mBright, this.a);
    this.mBlur.uniforms.tex.value = this.a.texture; this.mBlur.uniforms.dir.value.set(1 / this.a.width, 0); this.pass(this.mBlur, this.b);
    this.mBlur.uniforms.tex.value = this.b.texture; this.mBlur.uniforms.dir.value.set(0, 1 / this.a.height); this.pass(this.mBlur, this.a);
    this.mCombine.uniforms.scene.value = this.rt.texture; this.mCombine.uniforms.bloom.value = this.a.texture; this.mCombine.uniforms.flash.value = flash;
    this.pass(this.mCombine, null);
  }
}
