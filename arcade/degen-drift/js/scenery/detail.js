// DEGEN DRIFT: the worlds' Full detail (11-26, graphics uplift part 2; Evrtek 11-25: "The worlds could also stand to
// look a bit better too... I want this game to feel like full on cinema quality Tokyo Drift style gameplay").
// Settings > World detail: Classic is 0.1.21's worlds exactly (none of this is made); Full adds the layers here, each a
// single draw, none of them a light at run time:
//   decals   soft contact shadows under things (multiplied into the ground) and pools of light spilling from windows,
//            signs and work lights (added), laid on the ground and tilted to it;
//   streaks  the lamps' reflections in water: a soft streak from under each light toward the camera, wherever it is;
//   drift    things carried on the wind round the camera: litter, leaves, dust, snow;
//   plumes   steam and smoke rising from vents, chimneys and manholes;
//   flags    cloth on poles, waved by the wind in the vertex shader;
//   beams    searchlights sweeping the neon city's sky.
// Every layer registers under a five-tap panel switch (TUNING.world: road, sky, water, kit, motion, pools) and asks to be
// left out of the cars' reflection cube (ctx.noReflect), so the cube passes stay as cheap as 0.1.21's.
import * as THREE from '../../vendor/three/three.module.min.js?v=0.1.26';
import { SAFE } from '../glsafe.js?v=0.1.26';

const m4 = new THREE.Matrix4(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), eu = new THREE.Euler(), v3 = new THREE.Vector3(), sc = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), nv = new THREE.Vector3();
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const FOG_F = `#ifdef USE_FOG
  float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  #else
  float fogF = 0.0;
  #endif`;
const fogU = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog);

// the ground's normal under (x, z), from the land's own heights r metres either side
export function groundNormal(ctx, x, z, r = 1.5) {
  const h = ctx.hAt; nv.set(h(x - r, z) - h(x + r, z), 2 * r, h(x, z - r) - h(x, z + r)).normalize(); return nv;
}
// a layer's object: on the panel switch `layer`, out of the reflection cube, into the world
export function add(ctx, obj, layer, { reflect = false } = {}) {
  ctx.root.add(obj); (ctx.layers[layer] ||= []).push(obj); if (!reflect) ctx.noReflect.push(obj); return obj;
}

// ---------------------------------------------------------------- decals: contact shadows and pools of light
// items: [x, z, w, d, rotY, strength, color [r,g,b]] (w and d: the decal's size in metres; strength 0..1 for a shadow,
// any for light). A shadow multiplies the ground by its colour (a cool dark), a pool adds its colour.
export function decals(ctx, items, { light = false, name = light ? 'light-pools' : 'contact-shadows', lift = 0.06 } = {}) {
  if (!items.length) return null;
  const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
  const n = items.length, aK = new Float32Array(n), aC = new Float32Array(n * 3);
  const mat = new THREE.ShaderMaterial({
    uniforms: fogU(), fog: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    blending: light ? THREE.AdditiveBlending : THREE.CustomBlending,
    blendEquation: THREE.AddEquation, blendSrc: light ? THREE.OneFactor : THREE.ZeroFactor, blendDst: light ? THREE.OneFactor : THREE.SrcColorFactor,
    vertexShader: `attribute float aK; attribute vec3 aC; varying vec2 vQ; varying float vK; varying vec3 vC;
      #include <fog_pars_vertex>
      void main() { vQ = position.xz * 2.0; vK = aK; vC = aC; vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `varying vec2 vQ; varying float vK; varying vec3 vC;${SAFE}
      #include <fog_pars_fragment>
      void main() {
        ${FOG_F}
        ${light ? `float r = length(vQ); float a = (exp(-r * r * 3.2) * 0.85 + 0.15 * (1.0 - r)) * (1.0 - smoothstep(0.75, 1.0, r)) * vK * (1.0 - fogF);
        gl_FragColor = vec4(ddSafe(vC * a), 1.0);`
        : `vec2 q = abs(vQ); float a = (1.0 - smoothstep(0.3, 1.0, q.x)) * (1.0 - smoothstep(0.3, 1.0, q.y)) * vK * (1.0 - fogF * 0.9);
        gl_FragColor = vec4(mix(vec3(1.0), vC, clamp(ddSafe(a), 0.0, 1.0)), 1.0);`}
      }`,
  });
  const im = new THREE.InstancedMesh(g, mat, n);
  items.forEach((t, k) => {
    const [x, z, w, d, ry, s, c] = t, y = ctx.hAt(x, z) + lift;
    qa.setFromUnitVectors(UP, groundNormal(ctx, x, z, Math.max(1, Math.min(w, d) * 0.4))); eu.set(0, ry, 0); qb.setFromEuler(eu); qa.multiply(qb);
    m4.compose(v3.set(x, y, z), qa, sc.set(w, 1, d)); im.setMatrixAt(k, m4);
    aK[k] = s; const cc = c || [0.3, 0.29, 0.4]; aC[k * 3] = cc[0]; aC[k * 3 + 1] = cc[1]; aC[k * 3 + 2] = cc[2];
  });
  g.setAttribute('aK', new THREE.InstancedBufferAttribute(aK, 1)); g.setAttribute('aC', new THREE.InstancedBufferAttribute(aC, 3));
  im.name = name; im.renderOrder = light ? 2 : 1; im.frustumCulled = false;
  return add(ctx, im, 'pools');
}
// a contact shadow under each placed thing the world recorded since `from` (its footprint, a little bigger), within
// reach of the road (where the camera sees them close); boxes get a box, the rest a round blob
// (not rocks: they are sunk into the ground already; not on steep ground, where a flat shadow reads as a hole)
const NO_SHADOW = /rock|riprap|boulder|scree|outcrop|tunnel|crane|lamp/;
export function shadowsFor(ctx, from = 0, { reach = 90, minR = 0.35, maxR = 9, k = 0.62, grow = 1.35, skip = () => false } = {}) {
  const out = [];
  for (let i = from; i < ctx.placed.length; i++) {
    const P = ctx.placed[i]; if (P.skip || P.hangs || P.r < minR || P.r > maxR || NO_SHADOW.test(P.what) || skip(P)) continue;
    if (ctx.edge(P.x, P.z) > reach || groundNormal(ctx, P.x, P.z, Math.max(1, P.r)).y < 0.93) continue;
    const s = P.r * 2 * grow + 0.5; out.push([P.x, P.z, P.w ? P.w * grow + 0.6 : s, P.d ? P.d * grow + 0.6 : s, P.ry || 0, k]);
  }
  return out;
}

// ---------------------------------------------------------------- streaks: the lamps in the water
// items: [x, y (the water's level), z, [r,g,b], length, width]. Each lies on the water and points from under its
// light toward the camera wherever the camera is, so from the road it reads as the long broken column of a light in
// rippled water. Broken by the waves, shorter as the camera nears it.
export function streaks(ctx, items, { name = 'water-streaks' } = {}) {
  if (!items.length) return null;
  const base = new THREE.PlaneGeometry(2, 1, 1, 6); base.translate(0, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.attributes.position);
  const n = items.length, aP = new Float32Array(n * 3), aC = new Float32Array(n * 3), aL = new Float32Array(n * 3), R = rng(77);
  items.forEach((t, k) => { aP.set([t[0], t[1] + 0.04, t[2]], k * 3); aC.set(t[3], k * 3); aL.set([t[4], t[5], R() * 40], k * 3); });
  g.setAttribute('aP', new THREE.InstancedBufferAttribute(aP, 3)); g.setAttribute('aC', new THREE.InstancedBufferAttribute(aC, 3)); g.setAttribute('aL', new THREE.InstancedBufferAttribute(aL, 3));
  g.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign(fogU(), { time: ctx.uTime, on: { value: 1 } }), fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aP; attribute vec3 aC; attribute vec3 aL; uniform float time; varying vec2 vQ; varying vec3 vC; varying float vL; varying float vS;
      #include <fog_pars_vertex>
      void main() {
        vec2 to = cameraPosition.xz - aP.xz; float dist = length(to); vec2 f = to / max(dist, 0.001), s = vec2(-f.y, f.x);
        float L = min(aL.x, dist * 0.8), along = position.y * L, w = aL.y * (1.0 + position.y * 1.5);
        vec3 wp = vec3(aP.x + f.x * along + s.x * position.x * 0.5 * w, aP.y, aP.z + f.y * along + s.y * position.x * 0.5 * w);
        vQ = vec2(position.x * 0.5, position.y); vC = aC; vL = L; vS = aL.z;
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float time; uniform float on; varying vec2 vQ; varying vec3 vC; varying float vL; varying float vS;${SAFE}
      #include <fog_pars_fragment>
      void main() {
        ${FOG_F}
        float d = vQ.y * vL;
        float across = exp(-vQ.x * vQ.x * 9.0);
        float waves = 0.35 + 0.65 * smoothstep(0.15, 0.9, sin(d * 0.9 + time * 2.3 + vS) * 0.5 + 0.5 + sin(d * 2.7 - time * 3.1 + vS * 2.0) * 0.35);
        float a = across * waves * pow(clamp(1.0 - vQ.y, 0.0, 1.0), 1.4) * smoothstep(0.0, 0.04, vQ.y) * on * (1.0 - fogF * 0.8);
        gl_FragColor = vec4(ddSafe(vC * a), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.name = name; mesh.renderOrder = 2;
  return add(ctx, mesh, 'water');
}

// ---------------------------------------------------------------- drift: things on the wind round the camera
// One Points draw: count particles in a box round the camera (they wrap as it moves), carried by the wind, tumbling.
// kind: 'paper' (scraps), 'leaf', 'dust' (fine motes), 'snow' (flakes streaming sideways). tint: their light.
// The box is centred on the camera across, and stands on the car's road height (ctx.uFloor, world.focus()) from lo up.
export function drift(ctx, { kind = 'paper', count = 160, box = [70, 2.4, 70], lo = -0.2, wind = [3.5, 0.2, 1.2], size = 0.12, tint = [1, 1, 1], colors = [[1, 1, 1]], name = 'drift-' + kind } = {}) {
  const R = rng(91), n = Math.round(count), aB = new Float32Array(n * 4), aCol = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { aB.set([R(), R(), R(), R()], k * 4); aCol.set(colors[Math.floor(R() * colors.length)], k * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('aB', new THREE.BufferAttribute(aB, 4)); g.setAttribute('aCol', new THREE.BufferAttribute(aCol, 3));
  const shape = { paper: 'vec2 r = abs(q) / vec2(0.42, 0.26); float a = step(max(r.x, r.y), 1.0);', leaf: 'vec2 r = q / vec2(0.45, 0.22); float a = 1.0 - smoothstep(0.8, 1.0, dot(r, r));', dust: 'float a = exp(-dot(q, q) * 14.0);', snow: 'vec2 r = q / vec2(0.5, 0.12); float a = exp(-dot(r, r) * 2.5);' }[kind];
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign(fogU(), { time: ctx.uTime, scale: { value: 1 }, floorY: ctx.uFloor, tint: { value: new THREE.Vector3(...tint) } }), fog: true, transparent: true, depthWrite: false,
    blending: kind === 'dust' || kind === 'snow' ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: `attribute vec4 aB; attribute vec3 aCol; uniform float time; uniform float scale; uniform float floorY; varying vec3 vCol; varying float vRot; varying float vA;
      #include <fog_pars_vertex>
      const vec3 BOX = vec3(${box.map((x) => x.toFixed(1)).join(', ')}); const vec3 WIND = vec3(${wind.map((x) => x.toFixed(2)).join(', ')});
      void main() {
        float ph = aB.w * 6.2832, sp = 0.7 + aB.w * 0.6;
        vec3 p = aB.xyz * BOX + WIND * sp * time + vec3(sin(time * 1.3 + ph) * 0.8, sin(time * 2.1 + ph * 1.7) * 0.35, cos(time * 1.1 + ph) * 0.8);
        vec3 c0 = vec3(cameraPosition.x - BOX.x * 0.5, floorY + (${lo.toFixed(2)}), cameraPosition.z - BOX.z * 0.5);
        p = c0 + mod(p - c0, BOX);
        vec3 rel = (p - c0) / BOX; vA = smoothstep(0.0, 0.12, rel.x) * (1.0 - smoothstep(0.88, 1.0, rel.x)) * smoothstep(0.0, 0.12, rel.z) * (1.0 - smoothstep(0.88, 1.0, rel.z)) * smoothstep(0.0, 0.15, rel.y) * (1.0 - smoothstep(0.8, 1.0, rel.y)); // 11-26 (4): edges in order (reversed edges are undefined in GLSL: on a phone's GPU it read as 0)
        vCol = aCol; vRot = time * (2.0 + aB.w * 5.0) + ph;
        vec4 mvPosition = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp(${size.toFixed(3)} * 300.0 * scale / max(-mvPosition.z, 0.05), 0.0, 22.0 * scale);
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 tint; varying vec3 vCol; varying float vRot; varying float vA;${SAFE}
      #include <fog_pars_fragment>
      void main() {
        ${FOG_F}
        vec2 q = gl_PointCoord - 0.5; float cs = cos(vRot), sn = sin(vRot); ${kind === 'snow' || kind === 'dust' ? '' : 'q = vec2(q.x * cs - q.y * sn, q.x * sn + q.y * cs * (0.35 + 0.65 * abs(sin(vRot * 0.7))));'}
        ${shape} a = ddSafe(a * vA); if (a < 0.02) discard;
        vec3 c = vCol * tint;
        ${kind === 'dust' || kind === 'snow' ? 'gl_FragColor = vec4(c * a * (1.0 - fogF), 1.0);' : 'gl_FragColor = vec4(mix(c, fogColor, fogF), a * 0.9);'}
      }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.name = name; pts.renderOrder = 4;
  ctx.scaled.push(mat);
  return add(ctx, pts, 'motion');
}

// ---------------------------------------------------------------- plumes: steam and smoke rising
// emitters: [x, y, z]; per emitter `per` puffs cycling up `height` metres, drifting with the wind, growing, fading
export function plumes(ctx, emitters, { per = 10, height = 7, speed = 0.12, size = [0.8, 3.2], wind = [1.2, 0, 0.4], tint = [0.8, 0.8, 0.85], alpha = 0.28, name = 'plumes' } = {}) {
  if (!emitters.length) return null;
  const n = emitters.length * per, pos = new Float32Array(n * 3), aK = new Float32Array(n * 3), aT = new Float32Array(n * 3), R = rng(55);
  emitters.forEach((e, i) => { const L = [0, 0, 0]; ctx.light(e[0], e[1] + 2, e[2], 0, 1, 0, L); const lt = e[3] || [Math.min(1.6, 0.35 + L[0] * 0.9), Math.min(1.6, 0.35 + L[1] * 0.9), Math.min(1.6, 0.38 + L[2] * 0.9)]; for (let k = 0; k < per; k++) { const j = i * per + k; pos.set([e[0], e[1], e[2]], j * 3); aK.set([k / per + R() * 0.05, R(), R()], j * 3); aT.set(lt, j * 3); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aK', new THREE.BufferAttribute(aK, 3)); g.setAttribute('aT', new THREE.BufferAttribute(aT, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign(fogU(), { time: ctx.uTime, scale: { value: 1 }, tint: { value: new THREE.Vector3(...tint) } }), fog: true, transparent: true, depthWrite: false,
    vertexShader: `attribute vec3 aK; attribute vec3 aT; uniform float time; uniform float scale; varying float vA; varying vec3 vT; varying float vR;
      #include <fog_pars_vertex>
      void main() {
        float age = fract(time * ${speed.toFixed(3)} * (0.85 + aK.y * 0.3) + aK.x);
        vec3 p = position + vec3((aK.y - 0.5) * 0.7, age * ${height.toFixed(2)}, (aK.z - 0.5) * 0.7) + vec3(${wind[0].toFixed(2)}, 0.0, ${wind[2].toFixed(2)}) * age * age * ${height.toFixed(2)} * 0.4;
        vA = smoothstep(0.0, 0.12, age) * (1.0 - age) * (1.0 - age); vT = aT; vR = aK.z * 6.28 + age * 2.0;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp(mix(${size[0].toFixed(2)}, ${size[1].toFixed(2)}, age) * 300.0 * scale / max(-mvPosition.z, 0.05), 0.0, 220.0 * scale);
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 tint; varying float vA; varying vec3 vT; varying float vR;${SAFE}
      #include <fog_pars_fragment>
      void main() {
        ${FOG_F}
        vec2 q = gl_PointCoord - 0.5; float d = dot(q, q) * 4.0;
        float a = exp(-d * 3.0) * (1.0 - smoothstep(0.6, 1.0, d)) * (0.75 + 0.25 * sin(q.x * 9.0 + vR) * sin(q.y * 7.0 - vR)) * vA * ${alpha.toFixed(3)};
        a = ddSafe(a); if (a < 0.004) discard;
        gl_FragColor = vec4(mix(tint * vT, fogColor, fogF), a);
      }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.name = name; pts.renderOrder = 4;
  ctx.scaled.push(mat);
  return add(ctx, pts, 'motion');
}

// ---------------------------------------------------------------- flags: cloth on the wind
// items: [x, y (the top of the cloth), z, rotY, w, h, color THREE.Color]. The poles are the caller's (they stand still).
export function flags(ctx, items, { name = 'flags', gust = 1 } = {}) {
  if (!items.length) return null;
  const g = new THREE.PlaneGeometry(1, 1, 8, 3); g.translate(0.5, -0.5, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign(fogU(), { time: ctx.uTime }), fog: true, side: THREE.DoubleSide,
    vertexShader: `uniform float time; varying vec3 vC; varying float vS;
      #include <fog_pars_vertex>
      void main() {
        vec3 p = position; float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
        float w = sin(p.x * 7.0 - time * ${(7 * gust).toFixed(2)} + ph) * 0.11 * p.x + sin(p.x * 13.0 - time * ${(11 * gust).toFixed(2)} + ph * 2.0) * 0.035 * p.x;
        p.z += w; p.y -= p.x * p.x * 0.08; vS = 0.78 + 3.2 * (w - 0.0);
        vC = instanceColor;
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `varying vec3 vC; varying float vS;
      #include <fog_pars_fragment>
      void main() { gl_FragColor = vec4(vC * clamp(vS, 0.45, 1.15), 1.0);
        #include <fog_fragment>
      }`,
  });
  const im = new THREE.InstancedMesh(g, mat, items.length), c = new THREE.Color(), L = [0, 0, 0];
  items.forEach(([x, y, z, ry, w, h, col], k) => {
    eu.set(0, ry, 0); qa.setFromEuler(eu); m4.compose(v3.set(x, y, z), qa, sc.set(w, h, 1)); im.setMatrixAt(k, m4);
    ctx.light(x, y - h / 2, z, 0, 0.3, 0, L); c.setRGB(col.r * (L[0] * 1.3 + 0.08), col.g * (L[1] * 1.3 + 0.08), col.b * (L[2] * 1.3 + 0.08)); im.setColorAt(k, c);
  });
  im.name = name; im.frustumCulled = false;
  return add(ctx, im, 'motion');
}

// ---------------------------------------------------------------- beams: searchlights in the night sky
// items: [x, y, z, [r,g,b], phase]; each a long soft cone sweeping slowly round and nodding
export function beams(ctx, items, { length = 900, name = 'searchlights' } = {}) {
  if (!items.length) return null;
  const g = new THREE.CylinderGeometry(9, 0.8, length, 10, 1, true); g.translate(0, length / 2, 0);
  const meshes = [], group = new THREE.Group(); group.name = name;
  for (const [x, y, z, col, ph] of items) {
    const mat = new THREE.ShaderMaterial({
      uniforms: Object.assign(fogU(), { col: { value: new THREE.Vector3(...col) } }), fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; varying float vD; void main() { vY = position.y / ${length.toFixed(1)}; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); vD = distance(cameraPosition, wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform vec3 col; varying float vY; varying vec3 vN; varying vec3 vV; varying float vD;${SAFE} void main() { float f = abs(dot(normalize(vN), normalize(vV))); float a = pow(f, 2.5) * (1.0 - vY) * (1.0 - vY) * smoothstep(0.0, 0.03, vY) * 0.16 * smoothstep(60.0, 220.0, vD); gl_FragColor = vec4(ddSafe(col * a), 1.0); }`,
    });
    const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.frustumCulled = false; m.renderOrder = 3; m.userData.ph = ph; group.add(m); meshes.push(m);
  }
  ctx.onFrame.push((t) => { for (const m of meshes) { const p = m.userData.ph; m.rotation.set(0.32 + Math.sin(t * 0.21 + p) * 0.18, t * 0.13 + p * 2.1, 0, 'YXZ'); } });
  return add(ctx, group, 'sky');
}

// ---------------------------------------------------------------- the racing line, worn into the road
// For every road sample: where the drivers' line runs across the lane (lane-relative, metres) and how much of a drift
// zone it is in (0..1, smoothed): through a zone the zone's own line (track.zoneLine), easing to the lane's middle
// between them. The road's shader darkens two tyre tracks along it and, in the zones, the black arcs of a thousand drifts.
export function racingLine(track) {
  const n = track.n, line = new Float32Array(n), zw = new Float32Array(n);
  for (const zn of track.zones) {
    const steps = Math.ceil(zn.len / track.step);
    for (let k = 0; k <= steps; k++) { const t = k / steps, i = Math.floor(track.wrapS(zn.s0 + t * zn.len) / track.step) % n; line[i] = track.zoneLine(zn, t, track.half[i]) - track.laneOff[i]; zw[i] = 1; }
  }
  // smooth both round the loop (about 24 m), so the line flows into and out of each zone
  const sm = (a, w) => { const o = new Float32Array(n); let s = 0; for (let k = -w; k <= w; k++) s += a[(k + n) % n]; for (let i = 0; i < n; i++) { o[i] = s / (2 * w + 1); s += a[(i + w + 1) % n] - a[(i - w + n) % n]; } return o; };
  const L = sm(sm(line, 8), 8), Z = sm(sm(zw, 6), 6);
  return { line: L, zone: Z };
}

// ---------------------------------------------------------------- the kit, placed (props.js makes the pieces)
// The piece's light baked per vertex (the sky and the low sun on each face, the warm and the cool side, darker toward
// its foot) and per instance (the lamps where it stands; tint paints it). One draw a piece.
// items: [x, z, rotY, scale, tint THREE.Color|null, y? (default: on the lowest ground under it)]
function shade(ctx, geo, aoH) {
  const g = geo.clone(), nm = g.attributes.normal, p = g.attributes.position, c = g.attributes.color, e = g.attributes.emit, out = new Float32Array(p.count * 3), amb = [0, 0, 0];
  for (let i = 0; i < p.count; i++) {
    ctx.ambientN(nm.getX(i), nm.getY(i), nm.getZ(i), amb);
    const ao = 0.48 + 0.52 * Math.min(1, Math.max(0, p.getY(i) / aoH)), em = e ? e.getX(i) : 0;
    for (let q = 0; q < 3; q++) out[i * 3 + q] = c.array[i * 3 + q] * ((amb[q] * 1.3 + 0.06) * ao * (1 - em) + em * 1.7);
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3)); g.deleteAttribute('emit');
  return g;
}
export function place(ctx, name, geo, items, { layer = 'kit', sink = 0.04, aoH = 1.2, reflect = false, lamp = 0.55, audit = true } = {}) {
  if (!items.length) return null;
  geo.computeBoundingBox(); const bb = geo.boundingBox, w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z, r = Math.hypot(w, d) / 2;
  const im = new THREE.InstancedMesh(shade(ctx, geo, aoH), new THREE.MeshBasicMaterial({ vertexColors: true }), items.length);
  const c = new THREE.Color(), L = [0, 0, 0];
  items.forEach((t, k) => {
    const [x, z, ry = 0, s = 1, tint = null, yy] = t, y = yy ?? ctx.ground(x, z, r * s) - sink;
    eu.set(0, ry, 0); qa.setFromEuler(eu); m4.compose(v3.set(x, y, z), qa, sc.set(s, s, s)); im.setMatrixAt(k, m4);
    ctx.lampsAt(x, y + 1, z, 0, 0.4, 0, L); const tr = tint ? tint.r : 1, tg = tint ? tint.g : 1, tb = tint ? tint.b : 1;
    c.setRGB(tr * (1 + L[0] * lamp), tg * (1 + L[1] * lamp), tb * (1 + L[2] * lamp)); im.setColorAt(k, c);
    if (audit) ctx.placed.push({ x, z, r: r * s, y0: y, what: name, w: w * s, d: d * s, ry, hangs: yy !== undefined });
  });
  im.name = name;
  return add(ctx, im, layer, { reflect });
}
// a piece with a moving part (props.js { base, moving, pivot }): the base placed as above, the moving part turned about
// its pivot every frame by spin(t, k) -> [rx, ry, rz] (in the piece's own frame). Few of them, so plain matrix updates.
export function movers(ctx, name, M, items, spin, opts = {}) {
  const base = place(ctx, name, M.base, items, opts); if (!base) return null;
  const im = new THREE.InstancedMesh(shade(ctx, M.moving, opts.aoH ?? 1.2), new THREE.MeshBasicMaterial({ vertexColors: true }), items.length);
  const pv = new THREE.Vector3(...M.pivot), mats = [], tmp = new THREE.Matrix4(), rot = new THREE.Matrix4(), e2 = new THREE.Euler(), c = new THREE.Color();
  for (let k = 0; k < items.length; k++) { base.getMatrixAt(k, tmp); mats.push(tmp.clone().multiply(new THREE.Matrix4().makeTranslation(pv.x, pv.y, pv.z))); base.getColorAt(k, c); im.setColorAt(k, c); }
  const pose = (t) => { for (let k = 0; k < mats.length; k++) { const [a, b, g, tx = 0, ty = 0, tz = 0] = spin(t, k); e2.set(a, b, g); rot.makeRotationFromEuler(e2); rot.setPosition(tx, ty, tz); tmp.multiplyMatrices(mats[k], rot); im.setMatrixAt(k, tmp); } im.instanceMatrix.needsUpdate = true; };
  pose(0); ctx.onFrame.push(pose);
  im.name = name + '-moving'; im.frustumCulled = false;
  return add(ctx, im, opts.layer || 'kit', { reflect: !!opts.reflect });
}

// road signs' faces: pictograms on a sign board (no words), drawn once on a canvas atlas
// items: [x, y (the board's middle), z, rotY, glyph 0..7]
// 0 bend left, 1 bend right, 2 winding road, 3 deer, 4 falling rocks, 5 ice, 6 steep hill, 7 slippery road
export function signFaces(ctx, items, { name = 'sign-faces', size = 0.9, face = '#f2c418', ink = '#141210' } = {}) {
  if (!items.length) return null;
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  const at = (k) => [(k % 4) * 128 + 64, Math.floor(k / 4) * 128 + 64];
  for (let k = 0; k < 8; k++) {
    const [x, y] = at(k);
    g.save(); g.translate(x, y); g.fillStyle = ink; g.beginPath(); g.moveTo(0, -62); g.lineTo(62, 0); g.lineTo(0, 62); g.lineTo(-62, 0); g.closePath(); g.fill();
    g.fillStyle = face; g.beginPath(); g.moveTo(0, -55); g.lineTo(55, 0); g.lineTo(0, 55); g.lineTo(-55, 0); g.closePath(); g.fill();
    g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
    const arrowUp = (px, py) => { g.beginPath(); g.moveTo(px - 9, py + 9); g.lineTo(px, py - 2); g.lineTo(px + 9, py + 9); g.fill(); };
    if (k === 0 || k === 1) { const sx = k === 0 ? -1 : 1; g.beginPath(); g.moveTo(-6 * sx, 28); g.lineTo(-6 * sx, 0); g.quadraticCurveTo(-6 * sx, -14, 10 * sx, -14); g.stroke(); g.beginPath(); g.moveTo(8 * sx, -26); g.lineTo(22 * sx, -14); g.lineTo(8 * sx, -2); g.fill(); }
    if (k === 2) { g.beginPath(); g.moveTo(0, 30); g.bezierCurveTo(-22, 16, 22, 4, 0, -8); g.bezierCurveTo(-14, -16, -6, -22, 0, -24); g.stroke(); arrowUp(0, -30); }
    if (k === 3) { g.beginPath(); g.ellipse(2, 4, 17, 8, -0.15, 0, 7); g.fill(); g.lineWidth = 4; for (const [a, b, c2, d2] of [[-10, 8, -18, 24], [-4, 10, -6, 26], [12, 8, 20, 22], [16, 6, 26, 18]]) { g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d2); g.stroke(); } g.beginPath(); g.moveTo(16, -2); g.lineTo(24, -16); g.stroke(); g.beginPath(); g.ellipse(26, -18, 6, 4, -0.5, 0, 7); g.fill(); g.lineWidth = 3; g.beginPath(); g.moveTo(24, -22); g.lineTo(20, -32); g.moveTo(26, -22); g.lineTo(30, -32); g.stroke(); }
    if (k === 4) { g.beginPath(); g.moveTo(-26, -26); g.lineTo(-26, 30); g.lineTo(26, 30); g.stroke(); for (const [px, py, r] of [[-8, -18, 6], [4, -4, 7], [-4, 12, 5], [12, 18, 6]]) { g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); } }
    if (k === 5) { g.lineWidth = 5; for (let a = 0; a < 3; a++) { const an = a * Math.PI / 3; g.beginPath(); g.moveTo(Math.cos(an) * -24, Math.sin(an) * -24); g.lineTo(Math.cos(an) * 24, Math.sin(an) * 24); g.stroke(); } g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fill(); }
    if (k === 6) { g.beginPath(); g.moveTo(-30, 26); g.lineTo(30, 26); g.lineTo(30, -10); g.closePath(); g.fill(); g.beginPath(); g.rect(-8, -6, 18, 8); g.fill(); }
    if (k === 7) { g.beginPath(); g.rect(-14, -26, 28, 16); g.fill(); g.beginPath(); g.moveTo(-14, -6); g.bezierCurveTo(-30, 6, 2, 12, -12, 28); g.stroke(); g.beginPath(); g.moveTo(14, -6); g.bezierCurveTo(-2, 6, 30, 12, 14, 28); g.stroke(); }
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; ctx.disposables.push(tex);
  const geo = new THREE.PlaneGeometry(size, size), aG = new Float32Array(items.length);
  const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 });
  mat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlyph;').replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = (uv + vec2(mod(aGlyph, 4.0), 1.0 - floor(aGlyph / 4.0))) * vec2(0.25, 0.5);\n#endif'); };
  const im = new THREE.InstancedMesh(geo, mat, items.length), L = [0, 0, 0], cc = new THREE.Color();
  items.forEach(([x, y, z, ry, gl], k) => {
    eu.set(0, ry, 0); qa.setFromEuler(eu); m4.compose(v3.set(x, y, z), qa, sc.set(1, 1, 1)); im.setMatrixAt(k, m4); aG[k] = gl;
    // lit by the place, plus a share as if headlights catch its reflective face
    ctx.light(x, y, z, Math.sin(ry), 0.2, Math.cos(ry), L); cc.setRGB(Math.min(1.4, L[0] * 1.2 + 0.32), Math.min(1.4, L[1] * 1.2 + 0.3), Math.min(1.4, L[2] * 1.2 + 0.28)); im.setColorAt(k, cc);
  });
  geo.setAttribute('aGlyph', new THREE.InstancedBufferAttribute(aG, 1));
  im.name = name;
  return add(ctx, im, 'kit');
}
// a road sign beside the road at s, facing the traffic that meets it: a post (props.signPost) and its face
export function roadSign(ctx, s, side, glyph, out) {
  const T = ctx.track, i = Math.floor(T.wrapS(s) / T.step) % T.n, p = T.point(s, side * (T.half[i] + 2.1));
  if (T.kind[i] >= 2 || !ctx.clear(p[0], p[2], 0.5, 0.4)) return false;
  const ry = T.psi[i] + Math.PI; // the face looks back down the road, at the traffic coming
  const y = ctx.ground(p[0], p[2], 0.3) - 0.04;
  out.posts.push([p[0], p[2], ry, 1, null, y]); out.faces.push([p[0] + Math.sin(ry) * 0.03, y + 2.4, p[2] + Math.cos(ry) * 0.03, ry, glyph]);
  ctx.placed.push({ x: p[0], z: p[2], r: 0.5, y0: y, what: 'road sign' });
  return true;
}

// ---------------------------------------------------------------- helpers the regions share
// a quick "is anything already standing here" test over everything placed so far (0.1.21's things included)
export function occupancy(ctx, cell = 12) {
  const G = new Map(), key = (i, k) => i * 92821 + k;
  const put = (P) => { const r = P.r || 0.5, i0 = Math.floor((P.x - r) / cell), i1 = Math.floor((P.x + r) / cell), k0 = Math.floor((P.z - r) / cell), k1 = Math.floor((P.z + r) / cell); for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) { const kk = key(i, k); if (!G.has(kk)) G.set(kk, []); G.get(kk).push(P); } };
  for (const P of ctx.placed) put(P);
  const free = (x, z, r, pad = 0.4) => { const i0 = Math.floor((x - r) / cell), i1 = Math.floor((x + r) / cell), k0 = Math.floor((z - r) / cell), k1 = Math.floor((z + r) / cell); for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) { const L = G.get(key(i, k)); if (L) for (const P of L) { const rr = (P.r || 0.5) + r + pad; if ((P.x - x) ** 2 + (P.z - z) ** 2 < rr * rr) return false; } } return true; };
  free.take = (x, z, r) => put({ x, z, r }); // reserve a spot for what is about to be placed
  return free;
}
// a spot near the road that passes a test: [x, z, s (along the road), side] or null; reach: metres out from the wall
export function besideRoad(ctx, test, { tries = 400, reach = [2, 14], kinds = null } = {}) {
  const T = ctx.track, R = ctx.R2;
  for (let t = 0; t < tries; t++) {
    const s = R() * T.length, i = Math.floor(s / T.step) % T.n; if (kinds && !kinds.includes(T.kind[i])) continue;
    const side = R() < 0.5 ? 1 : -1, off = T.half[i] + 0.6 + reach[0] + R() * (reach[1] - reach[0]), p = T.point(s, side * off);
    if (test(p[0], p[2], s, side, i)) return [p[0], p[2], s, side, i];
  }
  return null;
}
// the water's streaks under every steady light that stands over the water (ships, crane booms, the far shore)
export function streaksFromGlows(ctx, level, { share = 1, minSize = 1.5, maxN = 240, k = 0.55 } = {}) {
  const G = ctx.glows, out = [];
  for (let i = 0; i < G.length && out.length < maxN; i += 8) {
    const x = G[i], y = G[i + 1], z = G[i + 2], size = G[i + 6];
    if (size < minSize || G[i + 7] !== 0 || y < level + 1.2 || ctx.hAt(x, z) > level - 0.3 || ctx.R2() > share) continue;
    const h = y - level;
    out.push([x, level, z, [G[i + 3] * k, G[i + 4] * k, G[i + 5] * k], Math.min(170, 22 + h * 2.4), Math.min(4.5, 0.7 + size * 0.22)]);
  }
  return out;
}
// a pool of light on the ground under every lamp head (the land beside the road is coarse, so its baked pools blur)
export function lampPools(ctx, { k = 0.3, size = 1 } = {}) {
  for (const M of ctx.mounts) {
    const mast = M.style === 'mast', L = Math.hypot(M.ax, M.az) || 1, hx = M.x + (mast ? 0 : M.ax / L * 2.3), hz = M.z + (mast ? 0 : M.az / L * 2.3), s = (mast ? 44 : 17) * size;
    ctx.pools.push([hx, hz, s, s, 0, (mast ? 0.45 : 1) * k, [M.color.r, M.color.g, M.color.b]]);
  }
}
// a better pine for the cards: many drooping tiers of needled fronds, dark in the heart, lit at the tips, a warm rim
// on one edge and a cool one on the other
export function pineArt2(ctx, { body = ['#1f4a44', '#123029', '#0a1c1a'], tip = '#3f7a64', rim = '#ff9a6a', cool = '#7a9ad8', snow = 0, seed = 3 } = {}) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d'), R = rng(seed);
  g.fillStyle = '#1a1014'; g.fillRect(61, 200, 6, 56);
  const tiers = 13;
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1), y = 236 - f * 214, w = 58 * (1 - f * 0.86) + R() * 4;
    for (let k = 0; k < 9; k++) {
      const side = k % 2 ? 1 : -1, reach = w * (0.45 + R() * 0.6), x0 = 64 + side * (2 + R() * 4), y0 = y - 18 + R() * 6, x1 = 64 + side * reach, y1 = y + R() * 6;
      const grd = g.createLinearGradient(64, 0, 64 + side * w, 0); grd.addColorStop(0, body[2]); grd.addColorStop(0.45, body[1]); grd.addColorStop(0.85, body[0]); grd.addColorStop(1, side > 0 ? rim : cool);
      g.fillStyle = grd; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, y0 - 2, x1, y1); g.lineTo(x1 - side * 4, y1 + 5); g.quadraticCurveTo((x0 + x1) / 2, y0 + 10, x0, y0 + 9); g.closePath(); g.fill();
      g.strokeStyle = tip; g.globalAlpha = 0.5; g.lineWidth = 1;
      for (let q = 0; q < 6; q++) { const u = 0.3 + q * 0.12, px = x0 + (x1 - x0) * u, py = y0 + (y1 - y0) * u + 2; g.beginPath(); g.moveTo(px, py); g.lineTo(px + side * 3, py + 5); g.stroke(); }
      g.globalAlpha = 1;
    }
    if (snow) { g.fillStyle = `rgba(236,242,255,${snow})`; g.beginPath(); g.ellipse(64 - w * 0.1, y - 14, w * 0.55, 3.5, 0, 0, 7); g.fill(); }
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; ctx.disposables.push(tex);
  return tex;
}
// give the classic card trees (by name) the better art and a third card, so they read round from every side
export function betterPines(ctx, names, art) {
  for (const o of ctx.root.children) {
    if (!o.isInstancedMesh || !names.includes(o.name)) continue;
    const old = o.geometry, pos = old.attributes.position; let maxY = 0; for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i));
    const parts = [0, Math.PI / 3, 2 * Math.PI / 3].map((a) => { const p = new THREE.PlaneGeometry(1, maxY); p.translate(0, maxY / 2, 0); p.rotateY(a); return p.toNonIndexed(); });
    const g = new THREE.BufferGeometry(); for (const nm of ['position', 'uv', 'normal']) { const arr = new Float32Array(parts.reduce((a, p) => a + p.attributes[nm].array.length, 0)); let off = 0; for (const p of parts) { arr.set(p.attributes[nm].array, off); off += p.attributes[nm].array.length; } g.setAttribute(nm, new THREE.BufferAttribute(arr, p0size(nm))); }
    o.geometry = g; ctx.disposables.push(old);
    const m = o.material.clone(); m.map = art; o.material = m;
  }
}
function p0size(nm) { return nm === 'uv' ? 2 : 3; }
// a simple hash of a course's id (each course's own dice under Full)
export function idSeed(id) { let h = 2166136261; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
