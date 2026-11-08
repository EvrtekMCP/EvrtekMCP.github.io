// LEVEL 4 scenery (ruling 5: the view never goes blank; rule 22: its own palette, landmark and silhouette).
// Yori's look (levels/looks/level-04-solar-skim.png): hot pink-orange below, black above, never hazard red.
//  - l4-surface: the star itself, a granulated magenta-and-orange plain under the flight box that curves away to
//    a horizon. In the final stretch its weight falls and the limb drops away beneath you, into night.
//  - l4-prominences: arches of star-stuff over the lane (Yori's prominence), the level's landmark.
//  - l4-plate-drifts: her shield-plates at full size, tumbling slowly outside the box.
//  - l4-great-loop: one colossal prominence standing on the horizon.
import { THREE, defineScenery, defineDecor, Instanced, buildModel, modelGroups, material, clamp, smoothstep, rng } from '../../api.js?v=0.4.0';
import { MESH } from './mesh.js?v=0.4.0';
import { star } from './star.js?v=0.4.0';
import { surfaceY } from './shade.js?v=0.4.0';
import { plateMaterial } from './raft.js?v=0.4.0';

const BASE_CURV = 1 / 26000;

// a tileable value noise, for the slow swells of heat under the granules
function tileNoise(R, n) {
  const g = Array.from({ length: n * n }, () => R());
  return (u, v) => {
    const x = u * n, y = v * n, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const a = g[(j % n) * n + (i % n)], b = g[(j % n) * n + ((i + 1) % n)], c = g[((j + 1) % n) * n + (i % n)], d = g[((j + 1) % n) * n + ((i + 1) % n)];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}
// granulation: soft, rounded cells of hot plasma with dim magenta lanes between them and slow swells of heat
// over them, tileable. Soft on purpose: crisp polygon edges read as a tiled floor, and hexes are the PLATES'
// shape, the one shape the player must find.
function granulation(size, seed) {
  const R = rng(seed), N = 16, pts = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) pts.push([(i + 0.1 + 0.8 * R()) / N, (j + 0.1 + 0.8 * R()) / N, R()]);
  const swell = tileNoise(R, 4), tint = tileNoise(R, 3);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data;
  const lane = [0x6a, 0x18, 0x50], cellA = [0xf0, 0x5a, 0xb8], cellB = [0xf8, 0x7c, 0x48];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    let d1 = 9, d2 = 9, h = 0;
    const ci = Math.floor(u * N), cj = Math.floor(v * N);
    for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
      const ii = (ci + ox + N) % N, jj = (cj + oy + N) % N, p = pts[jj * N + ii];
      const px = p[0] + Math.floor((ci + ox) / N), py = p[1] + Math.floor((cj + oy) / N);
      const dx = u - px, dy = v - py, dd = dx * dx + dy * dy;
      if (dd < d1) { d2 = d1; d1 = dd; h = p[2]; } else if (dd < d2) d2 = dd;
    }
    const lanes = smoothstep(0, 0.034, Math.sqrt(d2) - Math.sqrt(d1));      // 0 on a lane, 1 inside a granule, soft
    const centre = 1 - smoothstep(0, 0.045, Math.sqrt(d1));
    const heat = 0.68 + 0.5 * swell(u, v);
    const k = clamp((0.5 + 0.5 * lanes) * (0.7 + 0.3 * centre) * heat, 0, 1.15);
    const mix = clamp(0.25 * h + 0.75 * tint(u, v), 0, 1);
    const i = (y * size + x) * 4;
    for (let ch = 0; ch < 3; ch++) { const cell = cellA[ch] + (cellB[ch] - cellA[ch]) * mix; d[i + ch] = Math.round(clamp(lane[ch] + (cell - lane[ch]) * k * 0.8, 0, 255)); }
    d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---- the star's surface
export const surface = defineScenery({
  name: 'l4-surface',
  ease: 0.9,
  init(api) {
    const tile = 90, W = 1600, D = 1100;
    const tex = granulation(api.tier === 0 ? 256 : 512, 404);
    tex.repeat.set(W / tile, D / tile);
    const geo = new THREE.PlaneGeometry(W, D, 1, 90); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, -D / 2 + 140);
    const uni = { uCurv: { value: BASE_CURV }, uDrop: { value: 0 } };
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xd8b0c0 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = 'uniform float uCurv; uniform float uDrop;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed.y -= uCurv * transformed.z * transformed.z + uDrop;');
    };
    mat.customProgramCacheKey = () => 'l4-surface';
    const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = -2;
    m.position.y = surfaceY(api.box.y);
    api.scene.add(m);
    return { m, mat, tex, uni, tile, odo: 0 };
  },
  update(s, w, dt, api) {
    s.m.visible = true;
    s.m.position.y = surfaceY(api.box.y);
    s.odo += api.v * dt;
    s.tex.offset.y = (s.odo / s.tile) % 1;
    s.tex.offset.x = Math.sin(s.odo * 0.0004) * 0.3;
    // the limb: as the weight falls (the final stretch), the surface curves away and drops beneath you
    const g = 1 - w;
    star.curv = BASE_CURV + g * g * (1 / 380);
    star.drop = g * 45;
    s.uni.uCurv.value = star.curv; s.uni.uDrop.value = star.drop;
    s.mat.color.setRGB(0.85 - 0.55 * g, 0.69 - 0.5 * g, 0.75 - 0.4 * g);
  },
});

// ---- prominences: arches of star-stuff over the lane (her prominence(26), 52 across), and some along it, aside
let promGroups = null;
export const prominence = defineDecor({
  name: 'l4-prominence',
  hazard: null,
  sample: { k: 1, along: false },
  init() { promGroups = modelGroups(MESH.prom); },
  spawn(e, ev, api) {
    e.obj = api.course.get('l4-prominence', () => buildModel(MESH.prom).group);
    const k = ev.k || 1;
    e.sx = e.sy = e.sz = k;
    e.y = surfaceY(api.box.y) - 3 * k;
    e.obj.rotation.set(0, ev.along ? Math.PI / 2 + (ev.yaw || 0) : (ev.yaw || 0), ev.lean || 0);
  },
  update(e, dt, api) {
    e.y = surfaceY(api.box.y) - 3 * e.sx - star.curv * e.z * e.z - star.drop;
    api.pose(e);
    if (e.z > 60) e.alive = false;
  },
});
export const prominences = defineScenery({
  name: 'l4-prominences',
  stream: {
    every: [150, 320],
    place: (R, api) => {
      const B = api.box;
      if (R() < 0.55) return { type: 'l4-prominence', x: R.range(-9, 9), k: R.range(1.0, 1.9), yaw: R.range(-0.35, 0.35), lean: R.range(-0.12, 0.12) };
      const side = R.sign();
      return { type: 'l4-prominence', x: side * R.range(B.x + 34, B.x + 120), k: R.range(1.2, 3.2), along: true, yaw: R.range(-0.4, 0.4), lean: side * R.range(0, 0.25) };
    },
  },
});

// ---- her shield-plates at full size, drifting and tumbling outside the box
let plateL = null;
const qT = new THREE.Quaternion(), qS = new THREE.Quaternion(), ax = new THREE.Vector3();
export const plateDrift = defineDecor({
  name: 'l4-plate-drift',
  hazard: null,
  sample: { r: 1 },
  init(api) {
    plateL = modelGroups(MESH.plate).map((g) => new Instanced(api.scene, g.geo, plateMaterial(g.color), 90));
  },
  begin() { for (const L of plateL) L.begin(); },
  end() { for (const L of plateL) L.end(); },
  spawn(e, ev) {
    e.r = ev.r || 1;
    e.q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    e.spin = new THREE.Quaternion().setFromAxisAngle(ax.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), (Math.random() - 0.5) * 0.25);
  },
  update(e, dt) {
    qS.identity().slerp(e.spin, dt); e.q.multiply(qS);
    const s = e.r * e.appear;
    for (const L of plateL) L.put(e.x, e.y, e.z, e.q, s, s, s);
    if (e.z > 40) e.alive = false;
  },
});
export const plateDrifts = defineScenery({
  name: 'l4-plate-drifts',
  stream: {
    every: [120, 260],
    place: (R, api) => {
      const B = api.box, up = R() < 0.3;
      return up ? { type: 'l4-plate-drift', x: R.sign() * R.range(B.x * 1.2, B.x * 4), y: R.range(B.y * 3.2, B.y * 6), r: R.range(0.7, 1.3) }
        : { type: 'l4-plate-drift', x: R.sign() * R.range(B.x * 2.8, B.x * 6), y: R.range(-B.y * 0.8, B.y * 3), r: R.range(0.7, 1.5) };
    },
  },
});

// ---- one colossal prominence on the horizon: the landmark that is always there
export const greatLoop = defineScenery({
  name: 'l4-great-loop',
  ease: 0.4,
  init(api) {
    const g = new THREE.Group();
    const mats = [];
    for (const grp of MESH.prom) {
      const geo = modelGroups([grp])[0].geo;
      const m = material(grp.color, true, true); m.transparent = true; m.opacity = 0; m.fog = false; m.depthWrite = false;
      mats.push(m); g.add(new THREE.Mesh(geo, m));
    }
    g.scale.setScalar(11); g.position.set(-170, -60, -820); g.rotation.set(0, 0.5, 0.18); g.renderOrder = -4; g.visible = false;
    api.scene.add(g);
    return { g, mats };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003;
    for (const m of s.mats) m.opacity = 0.55 * w;
    s.g.position.y = -60 - star.drop * 3;
    s.g.position.x = -170 + Math.sin((api.G.dist || 0) * 0.00012) * 30;
  },
});
