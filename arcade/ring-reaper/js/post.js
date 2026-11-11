// STARWAKE: the light post pass, high tier only. The scene renders to a texture; its bright parts are pulled out
// at quarter size, blurred twice (across, then down), and laid back over the picture with a soft vignette.
// Four cheap passes. Below the high tier the scene draws straight to the screen and this costs nothing.
import * as THREE from '../vendor/three/three.module.min.js?v=0.6.2';

const VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BRIGHT = `uniform sampler2D tex; uniform vec2 texel; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tex, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(tex, vUv + texel * vec2(1.0, -1.0)).rgb
         + texture2D(tex, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tex, vUv + texel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c * smoothstep(0.62, 1.0, l), 1.0);
}`;
const BLUR = `uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tex, vUv).rgb * 0.227;
  c += (texture2D(tex, vUv + dir * 1.385).rgb + texture2D(tex, vUv - dir * 1.385).rgb) * 0.316;
  c += (texture2D(tex, vUv + dir * 3.231).rgb + texture2D(tex, vUv - dir * 3.231).rgb) * 0.070;
  gl_FragColor = vec4(c, 1.0);
}`;
// 0.4.0: up to four LENSES (a gravity well bending the stars behind it, api.lens): the picture is pulled in round each
// centre, strongest at its edge-in, nothing past its radius. Centre (x, y) in uv, z its radius in screen heights, w strength.
const COMBINE = `uniform sampler2D scene; uniform sampler2D bloom; uniform float strength; uniform float heat; uniform vec4 lens[4]; uniform float aspect; varying vec2 vUv;
void main() {
  vec2 uv = vUv;
  for (int i = 0; i < 4; i++) {
    vec4 L = lens[i]; if (L.z <= 0.0) continue;
    vec2 d = (uv - L.xy) * vec2(aspect, 1.0); float r = length(d);
    if (r < L.z && r > 1e-4) { float f = 1.0 - r / L.z; uv -= d / r * L.w * L.z * f * f * vec2(1.0 / aspect, 1.0); }
  }
  vec3 c = texture2D(scene, uv).rgb + texture2D(bloom, uv).rgb * strength;
  vec2 d = vUv - 0.5;
  float v = 1.0 - dot(d, d) * (0.9 + heat * 0.8);
  c *= v;
  c += vec3(0.25, 0.02, 0.06) * heat * dot(d, d) * 2.0;
  c = clamp(c, 0.0, 1.0);
  // the scene target holds linear light; the screen wants sRGB
  c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  gl_FragColor = vec4(c, 1.0);
}`;

export class Post {
  constructor(renderer) {
    this.renderer = renderer;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.quad);
    const mk = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
    this.mBright = mk(BRIGHT, { tex: { value: null }, texel: { value: new THREE.Vector2() } });
    this.mBlur = mk(BLUR, { tex: { value: null }, dir: { value: new THREE.Vector2() } });
    this.mCombine = mk(COMBINE, { scene: { value: null }, bloom: { value: null }, strength: { value: 0.85 }, heat: { value: 0 }, lens: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) }, aspect: { value: 1 } });
    this.rt = null;
  }
  setSize(renderer) {
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(1, s.x), h = Math.max(1, s.y), q = (n) => Math.max(1, Math.floor(n / 4));
    const opt = { type: THREE.UnsignedByteType, depthBuffer: false };
    if (!this.rt) {
      this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
      this.rt.texture.colorSpace = THREE.SRGBColorSpace;
      this.a = new THREE.WebGLRenderTarget(q(w), q(h), opt); this.b = new THREE.WebGLRenderTarget(q(w), q(h), opt);
    } else { this.rt.setSize(w, h); this.a.setSize(q(w), q(h)); this.b.setSize(q(w), q(h)); }
    this.w = w; this.h = h; this.mCombine.uniforms.aspect.value = w / h;
  }
  // this frame's lenses: [[u, v, radius, strength], ...] (main.js gathers them from api.lens)
  lens(list) { const U = this.mCombine.uniforms.lens.value; for (let i = 0; i < 4; i++) { const q = list[i]; if (q) U[i].set(q[0], q[1], q[2], q[3]); else U[i].set(0, 0, 0, 0); } }
  pass(mat, target) { this.quad.material = mat; this.renderer.setRenderTarget(target); this.renderer.render(this.scene, this.cam); }
  render(scene, camera, on, heat) {
    const r = this.renderer;
    if (!on || !this.rt) { r.setRenderTarget(null); r.render(scene, camera); return; }
    r.setRenderTarget(this.rt); r.render(scene, camera);
    this.mBright.uniforms.tex.value = this.rt.texture; this.mBright.uniforms.texel.value.set(1 / this.w, 1 / this.h);
    this.pass(this.mBright, this.a);
    const qw = this.a.width, qh = this.a.height;
    this.mBlur.uniforms.tex.value = this.a.texture; this.mBlur.uniforms.dir.value.set(1 / qw, 0); this.pass(this.mBlur, this.b);
    this.mBlur.uniforms.tex.value = this.b.texture; this.mBlur.uniforms.dir.value.set(0, 1 / qh); this.pass(this.mBlur, this.a);
    this.mCombine.uniforms.scene.value = this.rt.texture; this.mCombine.uniforms.bloom.value = this.a.texture; this.mCombine.uniforms.heat.value = heat;
    this.pass(this.mCombine, null);
  }
}
