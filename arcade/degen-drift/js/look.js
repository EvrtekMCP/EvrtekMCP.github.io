// DRIFTLINE: the look. A palette per region (0.1.0's evening on the coast is the harbour's), the baked-light helpers
// every mesh uses at load, and a directional fog: three.js's fog chunks are replaced so every material (built-in or
// ours) fades toward the sun's colour looking into it and the region's haze looking away. No lights are used at run
// time: the world's light is baked into vertex colours.
// Changing course (courses 0.2.0): setLook() copies the region's colours INTO the same PAL objects (so every importer
// sees them), moves the sun, rewrites the fog chunks and bumps an epoch that is part of every material's program key,
// so materials that already exist (the car's) recompile with the new fog when they are next marked for update.
import * as THREE from '../vendor/three/three.module.min.js?v=0.1.19';

const lin = (hex) => new THREE.Color(hex); // three converts sRGB hex to linear on the way in
const BASE = {
  zenith: '#130a33', sky: '#3b1a66', horizonAway: '#c03c7c', horizonSun: '#ff8a3c', sunCore: '#fff1b8',
  fog: '#5a2a6a', fogSun: '#ff7f45',
  skyAmb: '#5c4a9a', groundAmb: '#2a1a2a', sunLight: '#ff9a5c',
  asphalt: '#4a4658', line: '#f4e8dc', concrete: '#8c8496', rail: '#b8c0d0',
  grass: '#22403c', rock: '#5a4a62', sand: '#7a5e66', seaDeep: '#0d0726',
  sodium: '#ffae52', led: '#8ff0ff', neonPink: '#ff3fa4', neonCyan: '#36f2ff',
  zone: '#36f2ff', sweet: '#ff3fa4',
};
export const PAL = Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k, lin(v)]));

let SUN = new THREE.Vector3(-0.62, 0.105, -0.78).normalize();
let K = { sun: 1.25, amb: 0.62 };   // the sun's and the sky's strength in the baked light
export function sunDir() { return SUN; }
const v3 = (c) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;

// every material's program key carries the fog's epoch, so a new look recompiles them (see setLook)
let EPOCH = 0;
const baseKey = THREE.Material.prototype.customProgramCacheKey;
THREE.Material.prototype.customProgramCacheKey = function () { return baseKey.call(this) + '|fog' + EPOCH; };

// A region's look: { pal: {name: '#hex'}, sun: [x, y, z], sunK, ambK }. Unnamed colours fall back to the harbour's.
export function setLook(look = {}) {
  for (const [k, v] of Object.entries(BASE)) PAL[k].set((look.pal && look.pal[k]) || v);
  K = { sun: look.sunK ?? 1.25, amb: look.ambK ?? 0.62 };
  EPOCH++;
  installFog(look.sun || [-0.62, 0.105, -0.78]);
}

// Replace the fog chunks (before materials compile; setLook calls it again on a new course).
export function installFog(sun = [-0.62, 0.105, -0.78]) {
  SUN = new THREE.Vector3().fromArray(sun).normalize();
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = `#ifdef USE_FOG
varying float vFogDepth; varying vec3 vFogDir;
#endif`;
  C.fog_vertex = `#ifdef USE_FOG
vFogDepth = - mvPosition.z; vFogDir = (vec4(mvPosition.xyz, 0.0) * viewMatrix).xyz;
#endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG
uniform vec3 fogColor; varying float vFogDepth; varying vec3 vFogDir;
const vec3 FOG_SUN_DIR = vec3(${SUN.x.toFixed(4)}, ${SUN.y.toFixed(4)}, ${SUN.z.toFixed(4)});
const vec3 FOG_SUN = ${v3(PAL.fogSun)};
#ifdef FOG_EXP2
uniform float fogDensity;
#else
uniform float fogNear; uniform float fogFar;
#endif
#endif`;
  C.fog_fragment = `#ifdef USE_FOG
#ifdef FOG_EXP2
float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
#else
float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
#endif
vec3 fdir = normalize(vFogDir);
float fsun = pow(max(dot(fdir, FOG_SUN_DIR), 0.0), 3.0);
vec3 fcol = mix(fogColor, FOG_SUN, fsun * 0.9);
gl_FragColor.rgb = mix( gl_FragColor.rgb, fcol, fogFactor );
#endif`;
}

// ---- baked light: what a surface at p with normal n gets from the sky, the low sun and the lamps
// lamps: { list: [{x,y,z,r,g,b,range}], grid: Map } built by lampGrid()
export function lampGrid(list, cell = 32) {
  const grid = new Map();
  for (const L of list) {
    const r = Math.ceil(L.range / cell);
    const cx = Math.floor(L.x / cell), cz = Math.floor(L.z / cell);
    for (let i = -r; i <= r; i++) for (let k = -r; k <= r; k++) { const key = (cx + i) * 73856093 ^ (cz + k) * 19349663; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(L); }
  }
  return { list, grid, cell };
}
const _a = [0, 0, 0];
export function lampsAt(lamps, x, y, z, nx = 0, ny = 1, nz = 0, out = _a) {
  out[0] = out[1] = out[2] = 0;
  if (!lamps) return out;
  const key = Math.floor(x / lamps.cell) * 73856093 ^ Math.floor(z / lamps.cell) * 19349663;
  const near = lamps.grid.get(key);
  if (!near) return out;
  for (const L of near) {
    const dx = L.x - x, dy = L.y - y, dz = L.z - z, d2 = dx * dx + dy * dy + dz * dz, R2 = L.range * L.range;
    if (d2 >= R2) continue;
    const d = Math.sqrt(d2) || 1;
    const facing = Math.max(0, (dx * nx + dy * ny + dz * nz) / d) * 0.75 + 0.25;
    const f = (1 - d2 / R2); const k = f * f * facing * L.i;
    out[0] += L.r * k; out[1] += L.g * k; out[2] += L.b * k;
  }
  return out;
}
// sky + sun on a normal; returns rgb multipliers (linear)
export function ambient(nx, ny, nz, sunVis = 1, out = [0, 0, 0]) {
  const h = ny * 0.5 + 0.5;
  const ndl = Math.max(0, nx * SUN.x + ny * SUN.y + nz * SUN.z) * sunVis;
  for (let c = 0; c < 3; c++) {
    const k = c === 0 ? 'r' : c === 1 ? 'g' : 'b';
    out[c] = (PAL.groundAmb[k] * (1 - h) + PAL.skyAmb[k] * h) * K.amb + PAL.sunLight[k] * ndl * K.sun;
  }
  return out;
}

// common material bits
export function fogUniforms() { return THREE.UniformsUtils.clone(THREE.UniformsLib.fog); }
export const SHADER_FOG_V = '#include <fog_pars_vertex>';
export const SHADER_FOG_F = '#include <fog_pars_fragment>';
