// LEVEL 8 scenery: a dead fleet. Yori's wreck hulls drift off both sides, her ribs (the fleet's bones) tumble past
// and arch over the lane, rust and plating debris streams close by, ash hangs in the dark, and far ahead the
// biggest wreck of all, THE MAUSOLEUM, grows across the level until act 4 flies down the inside of it: its ribs
// flashing past, its torn plating overhead. Palette: Yori's level 8 (near-black greys, rust, olive ash). Nothing
// here is red, amber or cyan, and nothing here is in the flight box.
import { THREE, defineScenery, defineDecor, Instanced, buildModel, rng, clamp, smoothstep } from '../../api.js?v=0.6.4';
import { WRECK } from './meshes.js?v=0.6.4';

const tmpQ = new THREE.Quaternion(), eul = new THREE.Euler(), tmpV = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
// the Mausoleum's own sky-beams: a soft cone, brightest where you look through it, fading toward its far end
const SKY_VS = 'varying float vA; varying float vF; void main() { vA = position.y; vec4 mv = modelViewMatrix * vec4(position, 1.0);\n' +
  '  vec3 n = normalize(normalMatrix * normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }';
const SKY_FS = 'uniform float uOp; varying float vA; varying float vF;\n' +
  'void main() { gl_FragColor = vec4(1.0, 0.94, 0.82, pow(vF, 2.0) * (1.0 - vA) * (1.0 - vA) * uOp); }';
const side = (R, lo, hi) => R.sign() * R.range(lo, hi);
// Ruling 5 at the start of a run: decor the opening fill puts inside the visible range (not at the spawn line, where
// appear already starts it at nothing) grows in from nothing over 0.6 s, cubic, so its first frame is under a pixel.
function born(e) {
  if (e.z0 === undefined) e.z0 = e.z;
  if (e.z0 > -760 && e.t < 0.6) { const k = e.t / 0.6; e.appear *= k * k * k; }
}

// ---- a colossal hull section, far off to the side, turning slowly
const HULLS = ['hullA', 'hullB', 'hullC'];
export const hull = defineDecor({
  name: 'l8-hull',
  sample: { v: 0, x: 60, y: 0 },
  spawn(e, ev, api) {
    const k = HULLS[ev.v || 0];
    e.obj = api.course.get('l8-hull-' + k, () => buildModel(WRECK[k]).group);
    e.sx = e.sy = e.sz = ev.s || 1;
    e.rx = ev.rx || 0; e.ry = ev.ry || 0; e.rz = ev.rz || 0; e.spin = ev.spin || 0.02;
    e.obj.rotation.set(e.rx, e.ry, e.rz);
  },
  update(e, dt, api) {
    born(e);
    e.rz += e.spin * dt; e.obj.rotation.z = e.rz;
    api.pose(e);
    if (e.z > 160) e.alive = false;
  },
  remove(e, api) { api.course.put('l8-hull-' + HULLS[e.ev.v || 0], e.obj); },
});
// ---- a free rib arch: tumbling off to the side, or (lane: true) standing over the lane to fly under. In the
// Mausoleum (ring: true) two face each other as one whole frame round the lane.
export const rib = defineDecor({
  name: 'l8-rib',
  sample: { x: 40, y: 0 },
  spawn(e, ev, api) {
    const ring = !!ev.ring;
    e.obj = api.course.get(ring ? 'l8-rib-ring' : 'l8-rib', () => {
      const g = new THREE.Group(), a = buildModel(WRECK.rib).group; g.add(a);
      if (ring) { const b = buildModel(WRECK.rib).group; b.rotation.z = Math.PI; g.add(b); }
      return g;
    });
    e.ring = ring; e.sx = e.sy = e.sz = ev.s || 1;
    e.rz = ev.rz || 0; e.rx = ev.rx || 0; e.spin = ev.spin || 0;
  },
  update(e, dt, api) {
    born(e);
    e.rz += e.spin * dt;
    e.obj.rotation.set(e.rx, 0, e.rz);
    api.pose(e);
    if (e.z > 40) e.alive = false;
  },
  remove(e, api) { api.course.put(e.ring ? 'l8-rib-ring' : 'l8-rib', e.obj); },
});
// per-instance colour must exist before the first draw, or the shader compiles without it (and draws white)
function tint(L) { const c = new THREE.Color(0x3a3f48); for (let i = 0; i < L.cap; i++) L.mesh.setColorAt(i, c); L.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage); }
// ---- debris: torn plates and chunks of rust, instanced, tumbling just outside the box (the speed read)
let plates;
const DEB_COL = [0x3a3f48, 0x4a3028, 0x2a2c32, 0x5a4a3a, 0x3a3428];
export const debris = defineDecor({
  name: 'l8-debris',
  init(api) {
    const g = new THREE.BoxGeometry(1, 0.18, 0.7);
    plates = new Instanced(api.scene, g, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.4, roughness: 0.8, flatShading: true }), 260);
    tint(plates);
  },
  begin() { plates.begin(); },
  end() { plates.end(); },
  spawn(e, ev) { e.r = ev.r || 2; e.q0 = Math.random() * 6; e.q1 = Math.random() * 6; e.w0 = (Math.random() - 0.5) * 1.6; e.w1 = (Math.random() - 0.5) * 1.6; e.col = DEB_COL[(ev.c || 0) % DEB_COL.length]; },
  update(e, dt, api) {
    born(e);
    e.q0 += e.w0 * dt; e.q1 += e.w1 * dt;
    tmpQ.setFromEuler(eul.set(e.q0, e.q1, e.q0 * 0.5));
    const a = e.appear * e.r;
    plates.put(e.x, e.y, e.z, tmpQ, a, a, a, e.col);
    if (e.z > 30) e.alive = false;
  },
});

// ---- the streams
export const hullDrift = defineScenery({
  name: 'l8-hull-drift',
  stream: { every: [70, 150], place: (R) => ({ type: 'l8-hull', v: R.int(0, 2), x: side(R, 38, 95), y: R.range(-45, 35), s: R.range(0.8, 1.6), rx: R.range(-0.25, 0.25), ry: R.range(-0.6, 0.6), rz: R.range(0, 6), spin: R.range(-0.04, 0.04) }) },
});
export const ribDrift = defineScenery({
  name: 'l8-rib-drift',
  stream: { every: [90, 200], place: (R) => ({ type: 'l8-rib', x: side(R, 26, 60), y: R.range(-30, 25), s: R.range(0.7, 1.3), rx: R.range(-0.5, 0.5), rz: R.range(0, 6), spin: R.range(-0.2, 0.2) }) },
});
// the fleet's bones standing over the lane, to fly under (the breather): legs well outside the box
export const ribArches = defineScenery({
  name: 'l8-rib-arches',
  stream: { every: [110, 170], place: (R) => ({ type: 'l8-rib', x: 0, y: R.range(-1, 1), s: R.range(1.0, 1.15), rz: R.range(-0.25, 0.25) }) },
});
export const debrisField = defineScenery({
  name: 'l8-debris-field',
  stream: { every: [8, 20], place: (R) => ({ type: 'l8-debris', nx: side(R, 1.5, 4.2), ny: R.range(-2.6, 2.6), r: R.range(0.8, 3.2), c: R.int(0, 4) }) },
});
// inside the Mausoleum: a frame every few metres, round the lane
export const tombRibs = defineScenery({
  name: 'l8-tomb-ribs',
  stream: { every: [24, 30], place: (R) => ({ type: 'l8-rib', ring: true, x: 0, y: 0, s: 1.02, rz: R.range(-0.05, 0.05) }) },
});

// ---- inside the Mausoleum: torn plating between the frames, a keel walkway below with dim steel lamps
let panels, keel, lamps;
export const tombPlate = defineDecor({
  name: 'l8-tomb-plate',
  init(api) {
    panels = new Instanced(api.scene, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.75, flatShading: true, side: THREE.DoubleSide }), 320);
    tint(panels);
    keel = new Instanced(api.scene, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x24262c, metalness: 0.5, roughness: 0.7, flatShading: true }), 80);
    lamps = new Instanced(api.scene, new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshBasicMaterial({ color: 0x9aa0b0 }), 120);
  },
  begin() { panels.begin(); keel.begin(); lamps.begin(); },
  end() { panels.end(); keel.end(); lamps.end(); },
  spawn(e, ev) { e.ang = ev.ang || 0; e.len = ev.len || 8; e.arc = ev.arc || 0.5; e.col = ev.col || 0x30333a; e.keel = !!ev.keel; },
  update(e, dt, api) {
    born(e);
    const a = e.appear;
    if (e.keel) {
      tmpQ.identity();
      keel.put(0, -12.6 * a - 30 * (1 - a), e.z, tmpQ, 5 * a, 0.8 * a, e.len * a);
      lamps.put(-2.2, -12.0, e.z, tmpQ, a, a, a); lamps.put(2.2, -12.0, e.z, tmpQ, a, a, a);
    } else {
      // a curved panel, approximated by a slab tangent to the hull at radius 15 (its local y points outward)
      const r = 15.2 + 20 * (1 - a);
      tmpQ.setFromEuler(eul.set(0, 0, e.ang - Math.PI / 2));
      panels.put(Math.cos(e.ang) * r, Math.sin(e.ang) * r, e.z, tmpQ, 15.2 * e.arc * a, 0.5 * a, e.len * a, e.col);
    }
    if (e.z > 30) e.alive = false;
  },
});
const PLATE_COL = [0x30333a, 0x3a3f48, 0x3a2a24, 0x2a2c32];
export const tombPlating = defineScenery({
  name: 'l8-tomb-plating',
  stream: { every: [5, 9], place: (R) => {
    const out = [{ type: 'l8-tomb-plate', x: 0, y: 0, ang: R.range(0, Math.PI * 2), len: R.range(6, 14), arc: R.range(0.25, 0.6), col: PLATE_COL[R.int(0, 3)] }];
    if (R() < 0.35) out.push({ type: 'l8-tomb-plate', x: 0, y: 0, keel: true, len: R.range(10, 18) });
    return out;
  } },
});

// ---- ash: grey motes hanging in the dark around the ship; they give the searchlight beams something to cut through
export const ash = defineScenery({
  name: 'l8-ash',
  ease: 0.8,
  init(api) {
    const N = 420, R = rng(808), pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = R.range(-26, 26); pos[i * 3 + 1] = R.range(-15, 15); pos[i * 3 + 2] = R.range(-150, 10); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.PointsMaterial({ color: 0x6a645a, size: 0.13, map: api.glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: true, sizeAttenuation: true });
    const p = new THREE.Points(g, m); p.frustumCulled = false; p.visible = false; p.renderOrder = 2;
    api.scene.add(p);
    return { p, m, pos, N };
  },
  update(s, w, dt, api) {
    s.p.visible = w > 0.003; s.m.opacity = 0.4 * w;
    if (!s.p.visible) return;
    const dz = (api.v || 0) * dt, P = s.pos;
    for (let i = 0; i < s.N; i++) { let z = P[i * 3 + 2] + dz; if (z > 10) z -= 160; P[i * 3 + 2] = z; P[i * 3] += Math.sin(z * 0.05 + i) * dt * 0.3; }
    s.p.geometry.attributes.position.needsUpdate = true;
  },
});

// ---- THE MAUSOLEUM, far ahead: the biggest wreck in the graveyard, its torn stern toward you. It closes in over
// the level and fades as you enter it (act 4's frames and plating take over). Three dim steel lamps on its spine.
export const mausoleum = defineScenery({
  name: 'l8-mausoleum',
  ease: 0.35,
  init(api) {
    const g = new THREE.Group();
    const m = buildModel(WRECK.hullA, { own: ['#3a3f48', '#4a3028', '#1c1e24'] });
    const mats = Object.values(m.mats);
    for (const mt of mats) { mt.transparent = true; mt.opacity = 0; mt.fog = false; mt.depthWrite = false; }
    m.group.scale.setScalar(6); m.group.rotation.z = 0.12; g.add(m.group);
    const lm = new THREE.PointsMaterial({ color: 0x9aa0b0, size: 9, map: api.glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const R = rng(88), pts = [];
    for (let i = 0; i < 70; i++) { const a = R.range(0, Math.PI * 2); pts.push(Math.cos(a) * 68, Math.sin(a) * 68, R.range(-240, 120)); }
    const lights = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), lm);
    g.add(lights);
    // its own searchlights, still sweeping the sky a kilometre off: what makes it the landmark at a glance.
    // Pointed up and away, far outside the lane, they are never a hazard read, and dimmer than any lamp on the course.
    const geo = new THREE.CylinderGeometry(1, 0.08, 1, 20, 1, true); geo.translate(0, 0.5, 0);
    const beams = [[-22, 66, -170], [26, 64, 40], [-4, 68, 190]].map((p, i) => {
      const mat = new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: { uOp: { value: 0 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
      const b = new THREE.Mesh(geo, mat); b.position.set(p[0], p[1], p[2]); b.scale.set(16, 520, 16); b.frustumCulled = false; b.renderOrder = -3;
      g.add(b); return { b, mat, ph: i * 2.1 };
    });
    g.position.set(12, 4, -1100); g.renderOrder = -4; g.visible = false;
    api.scene.add(g);
    return { g, mats, lm, beams, t: 0 };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003;
    for (const m of s.mats) m.opacity = w;
    s.lm.opacity = w * 0.8;
    s.t += dt;
    for (const B of s.beams) {
      tmpV.set(Math.sin(s.t * 0.22 + B.ph) * 0.55, 1, Math.cos(s.t * 0.17 + B.ph * 1.3) * 0.45 + 0.15).normalize();
      B.b.quaternion.setFromUnitVectors(UP, tmpV);
      B.mat.uniforms.uOp.value = 0.32 * w;
    }
    // it closes from 1100 m to 880 m across the first three acts (the camera sees to 1200 m)
    const L = api.level, end = L && L.mausoleumD ? L.mausoleumD : 12000;
    const k = clamp((api.G.courseD || 0) / end, 0, 1);
    s.g.position.z = -1100 + 220 * smoothstep(0, 1, k);
    s.g.rotation.z += dt * 0.004;
  },
});
