// DEGEN DRIFT: the cars' finish under a reflection of the world (11-26; Evrtek 11-25: "can we incorporate realtime
// reflections off the cars? The paint on these cars and the glass windows would likely be quite reflective").
// One unlit shader, five finishes. The diffuse part of each is the matcap's own sum (textures.js matcap(): the same
// view-space light, the same numbers), so a car keeps the colour it had. What the matcap painted in (a fixed sunset
// that rode with the camera) becomes a real reflection: a cube map of the world (reflect.js) looked up along the view
// ray mirrored in the surface, so lamps, neon, the sky and the walls slide across the car as it moves.
//   paint: the base coat (with its metal flake) under a clear coat: a mirror weighted by the viewing angle (8% face-on,
//          80% at a grazing angle: a show car's coat, past a real one's 4%, short of a full mirror at the silhouette),
//          the sun's highlight on top. Damage (carmesh.js setDamage) dulls and roughens the clear coat where it hits,
//          through a per-vertex 'coat' attribute.
//   glass: mostly reflection, over the dark tint the matcap gave it (the cabin a little lifted behind it).
// The world in a reflection is lifted (hot()): it is lit for the screen while the car is lit like a showroom, and its
// small lights (lamps, neon, lit windows, the sun) far more than its wide bright fields, so they ride over the paint.
//   trim:  chrome where the vertex shade says metal, gloss black elsewhere (a clear mirror only at grazing angles).
//   rim:   a near mirror in the rim's own metal colour.
//   rubber: a dull, blurred sheen.
// High tier only (groundK): the paint's downward reflections meet the road under the car, where the car's own
// underglow and headlight pool are (a fake planar reflection, worked out in the shader), so a neon underglow shows in
// the sills. Fog: the look's fog chunks, as every material (look.js bumps the program key on a new look).
import * as THREE from '../vendor/three/three.module.min.js?v=0.1.21';

// shared by every car: the sun's highlight and the five-tap panel's sliders (TUNING.reflect)
export const SHARED = {
  sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 1, 1) }, sunRef: { value: 1 }, sunOn: { value: 1 },
  coatK: { value: 1 }, roughK: { value: 0 },
};
const lumOf = (c) => 0.3 * c.r + 0.55 * c.g + 0.15 * c.b;
// the course's light, at a new look: where the sun is, its colour, and how bright its disc is in the sky shader (the
// highlight shows only where the cube map sees that disc, so a wall or a ridge between the car and the sun hides it)
export function setWorldLight(sun, pal, look) {
  SHARED.sunDir.value.copy(sun).normalize();
  const k = Math.max(0.3, Math.min(1.2, (look.sunK ?? 1.25) / 1.25));
  SHARED.sunCol.value.copy(pal.sunCore).multiplyScalar(k);
  // the disc's middle in world.js: mix(pink, sunCore, ~0.5) * 1.45, its lower half cut by bands
  const disc = new THREE.Color(1.0, 0.24, 0.42).lerp(pal.sunCore, 0.5).multiplyScalar(1.45 * 0.6);
  SHARED.sunRef.value = Math.max(0.05, lumOf(disc));
  SHARED.sunOn.value = look.sky && look.sky.disc === 0 ? 0 : 1;
}

// per car (shared by that car's finishes): which cube map, the lamp light under it, where it is, its own pools
export function carUniforms() {
  return {
    envMap: { value: null }, envBias: { value: 0 }, tint: { value: new THREE.Color(1, 1, 1) },
    groundK: { value: 0 }, carPos: { value: new THREE.Vector3() }, carDir: { value: new THREE.Vector2(0, 1) },
    poolCol: { value: new THREE.Color(0.2, 0.22, 0.27) }, glowCol: { value: new THREE.Color(0, 0, 0) },
  };
}

const VS = `
varying vec3 vW; varying vec3 vN; varying vec3 vV; varying vec3 vVN; varying vec3 vCol; varying vec2 vCoat; varying vec3 vObj;
#ifdef USE_COAT
attribute vec2 coat;
#endif
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vN = mat3(modelMatrix) * normal; // the car's parts have no scale but a mirror (the wheels): the plain matrix is right
  vec4 mvPosition = viewMatrix * wp;
  vV = -mvPosition.xyz;
  vVN = normalMatrix * normal;
#ifdef USE_COLOR
  vCol = color;
#else
  vCol = vec3(1.0);
#endif
#ifdef USE_COAT
  vCoat = coat;
#else
  vCoat = vec2(1.0, 0.0);
#endif
  vObj = position;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FS = `
uniform samplerCube envMap; uniform float envBias;
uniform vec3 base; uniform vec3 tint; uniform float rough0;
uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunRef; uniform float sunOn;
uniform float coatK; uniform float roughK;
uniform float groundK; uniform vec3 carPos; uniform vec2 carDir; uniform vec3 poolCol; uniform vec3 glowCol;
varying vec3 vW; varying vec3 vN; varying vec3 vV; varying vec3 vVN; varying vec3 vCol; varying vec2 vCoat; varying vec3 vObj;
#include <fog_pars_fragment>

float lum(vec3 c) { return dot(c, vec3(0.3, 0.55, 0.15)); } // the matcap's own weights
// the world along a ray, blurred by lod (in steps of the course map's 256 px faces; the live map is 128, envBias 1).
// The lookup keeps the GPU's own mip choice and adds the blur to it, so a small or curved patch never sparkles.
vec3 envAt(vec3 R, float lod) { return textureCube(envMap, R, max(lod - envBias, 0.0)).rgb; }
// the matcap's painted sunset by the reflected ray's height (textures.js matcap() env), for the metal flake's share
vec3 matEnv(float ry) {
  if (ry > 0.18) return mix(vec3(0.32, 0.16, 0.55), vec3(0.08, 0.05, 0.22), min(1.0, (ry - 0.18) / 0.8));
  if (ry > -0.05) return mix(vec3(1.0, 0.62, 0.3), vec3(0.95, 0.3, 0.5), (ry + 0.05) / 0.23);
  return mix(vec3(0.18, 0.08, 0.12), vec3(0.03, 0.02, 0.04), min(1.0, (-ry - 0.05) / 0.5));
}
// the low sun on a glossy surface: a crisp spot, wider and dimmer as the surface roughens; only where the cube map
// sees the sun's disc (a wall or a ridge in the way hides it)
vec3 sunGlint(vec3 R, float rough) {
  float s = max(dot(R, sunDir), 0.0);
  if (sunOn < 0.5 || s < 0.9) return vec3(0.0);
  float sr = sqrt(rough);
  float g = pow(s, mix(1400.0, 60.0, sr)) * mix(5.0, 0.5, sr) + pow(s, mix(90.0, 12.0, sr)) * 0.12;
  float vis = smoothstep(0.25, 0.65, lum(textureLod(envMap, sunDir, max(2.0 - envBias, 0.0)).rgb) / sunRef);
  return sunCol * g * vis;
}
float schlick(float c, float f0) { return f0 + (1.0 - f0) * pow(1.0 - c, 5.0); }
// the world along R as the car shows it. The world is lit for the screen (baked, about 0 to 1) while the car is lit
// like a showroom, so the reflection is lifted; and its small lights (a lamp, a neon tube, a lit window, the sun's
// disc: brighter than the blur around them) far more, so they ride bright over the paint while a wide bright field
// (snow, a sunset sky) does not wash the car out. b: the same ray, blurred.
vec3 hot(vec3 r, vec3 b) { return r * 1.6 + max(r - b * 1.1, 0.0) * 3.0; }
vec3 world(vec3 R, float lod) { return hot(envAt(R, lod), envAt(R, lod + 3.5)); }

void main() {
  float face = 1.0;
#ifdef DOUBLE_SIDED
  face = gl_FrontFacing ? 1.0 : -1.0;
#endif
  vec3 N = normalize(vN) * face;
  vec3 V = normalize(cameraPosition - vW);
  float NdV = clamp(dot(N, V), 0.0, 1.0);
  vec3 R = reflect(-V, N);
  // the matcap's coordinates (MeshMatcapMaterial's view-corrected mapping), so the diffuse light lands where it did
  vec3 vn = normalize(vVN) * face, vd = normalize(vV);
  vec3 ax = normalize(vec3(vd.z, 0.0, -vd.x)), ay = cross(vd, ax);
  vec2 m = vec2(dot(ax, vn), dot(ay, vn)) * 0.99;
  float mz = sqrt(max(0.0, 1.0 - dot(m, m)));
  float lam = max(0.0, m.x * -0.35 + m.y * 0.6 + mz * 0.7) * 0.75 + 0.25;
  float rough = clamp(rough0 + roughK + vCoat.y, 0.0, 1.0);
  float lod = rough * 7.0;
  vec3 col;
#if defined(KIND_PAINT)
  float mxb = max(max(base.r, base.g), max(base.b, 1e-3));
  vec3 hue = base / mxb;
  // the metal in the base coat takes the paint's hue: its brightness half the matcap's sunset, half the world's own
  vec3 rb = envAt(R, lod + 3.5);
  float lumM = mix(lum(matEnv(2.0 * mz * m.y)), lum(rb) * 3.0, 0.6);
  // flake: tiny facets (5 mm cells), seen only while a cell is about a pixel or two on the screen (the garage's
  // distance); nearer they would be polka dots and further off they would crawl, so there it is their average
  vec3 fc = vObj * 190.0;
  float h = fract(sin(dot(floor(fc), vec3(12.9898, 78.233, 37.719))) * 43758.5453), fw = length(fwidth(fc));
  float flake = mix(0.0245, step(0.93, h) * 0.35, smoothstep(0.3, 0.6, fw) * (1.0 - smoothstep(0.9, 1.6, fw)));
  vec3 d = min(base * (0.5 + 1.1 * lam) + hue * mxb * (lumM * 1.6 + flake) * (0.6 + 0.4 * mz), vec3(1.0)) * vCol * tint;
  vec3 r = hot(envAt(R, lod), rb);
  // high tier: the road under the car, with its own underglow and headlight pool on it (carmesh.js poolMaterial shapes)
  if (groundK > 0.0 && R.y < -0.03) {
    vec3 P = vW + R * max((carPos.y + 0.03 - vW.y) / R.y, 0.0);
    vec2 g = P.xz - carPos.xz, L = vec2(dot(g, vec2(carDir.y, -carDir.x)), dot(g, carDir));
    vec2 q1 = L / vec2(1.3, 2.6), q2 = (L - vec2(0.0, 12.0)) / vec2(2.5, 9.0);
    float d1 = dot(q1, q1), d2 = dot(q2, q2);
    vec3 pools = glowCol * exp(-d1 * 3.0) * (1.0 - smoothstep(0.7, 1.0, d1)) + poolCol * exp(-d2 * 3.0) * (1.0 - smoothstep(0.7, 1.0, d2));
    r += pools * groundK * smoothstep(-0.03, -0.2, R.y);
  }
  // a show car's coat: past a real one's 4% face-on, and short of a full mirror at the silhouette (the body's flat
  // facets there would ring the car in a bright outline)
  float F = clamp((0.08 + 0.72 * pow(1.0 - NdV, 4.0)) * coatK * vCoat.x, 0.0, 1.0);
  // the coat's own colour over the paint's: the paint dims only part of the way under a strong reflection, so a car
  // keeps its colour against a dark night
  col = d * (1.0 - 0.75 * F) + r * F + sunGlint(R, rough) * coatK * vCoat.x;
#elif defined(KIND_GLASS)
  // the dark tint, the cabin's grey a little lifted behind it (never a black hole), then mostly reflection
  vec3 d = (base * 0.55 + vec3(0.03, 0.03, 0.04)) * lam * tint;
  float F = clamp((0.1 + 0.75 * pow(1.0 - NdV, 4.0)) * coatK, 0.0, 1.0);
  col = d * (1.0 - 0.7 * F) + world(R, lod) * F + sunGlint(R, rough) * coatK;
#elif defined(KIND_TRIM)
  // chrome where the shade says metal (0.95), gloss black where it is dark (0.11), slats and seams between
  float metal = smoothstep(0.3, 0.9, max(vCol.r, max(vCol.g, vCol.b)));
  vec3 r = world(R, lod);
  vec3 dif = base * 0.25 * lam * vCol * tint;
  float F = schlick(NdV, 0.04);
  vec3 black = dif * (1.0 - F) + mix(vec3(lum(r)) * vec3(0.75, 0.8, 0.95), r, 0.4) * F;
  vec3 chrome = dif + r * vCol;
  col = mix(black, chrome, metal) + sunGlint(R, rough) * mix(0.5, 1.0, metal);
#elif defined(KIND_RIM)
  vec3 r = world(R, lod);
  vec3 metalCol = base / max(max(base.r, base.g), max(base.b, 1e-3));
  col = base * 0.25 * lam * vCol * tint + r * metalCol * vCol + sunGlint(R, rough) * vCol;
#else // rubber
  float fres = 0.12 + 0.88 * pow(1.0 - mz, 3.0);
  col = base * 0.06 * lam * tint + envAt(R, 5.0) * 0.18 * (0.6 + 0.4 * fres) + sunGlint(R, 0.8) * 0.1;
#endif
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
  #include <colorspace_fragment>
}`;

// kind: paint | glass | trim | rim | rubber. o: { base (hex), rough, coatAttr, vertexColors, side, polygonOffset... }
export function finish(kind, car, o = {}) {
  const u = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
  Object.assign(u, SHARED, car, { base: { value: new THREE.Color(o.base || '#ffffff') }, rough0: { value: o.rough ?? 0.05 } });
  const defines = { ['KIND_' + kind.toUpperCase()]: 1 };
  if (o.coatAttr) defines.USE_COAT = 1;
  const m = new THREE.ShaderMaterial({
    uniforms: u, defines, vertexShader: VS, fragmentShader: FS, fog: true,
    vertexColors: !!o.vertexColors, side: o.side ?? THREE.FrontSide,
    polygonOffset: !!o.polygonOffset, polygonOffsetFactor: o.polygonOffsetFactor || 0, polygonOffsetUnits: o.polygonOffsetUnits || 0,
  });
  return m;
}
