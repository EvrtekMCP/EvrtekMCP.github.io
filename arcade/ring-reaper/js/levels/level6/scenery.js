// LEVEL 6 scenery: the ice canyon. Yori's look (art-incoming/yori/levels/looks/level-06-frozen-rift.png): tight
// pale walls either side, glittering spray, a dense bright fog, the lane dark between. Her iceWall sections line
// both sides (two layers, the outer one taller, for depth), her ice-shard clusters sit on the ledges, ice ribs span
// the canyon high overhead (the level's landmark, rule 22), and mint glints drift in the air. Nothing here enters
// the flight box (rule 15/16) and nothing uses the reserved hues (rule 9).
import { THREE, defineScenery, defineDecor, Instanced, SPAWN_D, clamp, smoothstep } from '../../api.js?v=0.6.3';
import { MESH } from './mesh.js?v=0.6.3';

// ---- the canyon's width: how far the inner wall face stands outside the flight box, by course distance. The
// level sets it (gapAt), the streams read it at the spawn line, so a narrowing arrives from the haze like anything.
export const RIFT = { gapAt: (d) => 3 };
const WALL_EVERY = 34; // her sections are 40 long: they overlap by 6
const tmpQ = new THREE.Quaternion(), eul = new THREE.Euler();

const geoCache = new Map();
function geoOf(group) {
  if (!geoCache.has(group)) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(group.p, 3)); g.computeVertexNormals(); g.computeBoundingSphere(); geoCache.set(group, g); }
  return geoCache.get(group);
}
let iceMat = null, glintMat = null, shardMat = null;
function mats() {
  if (iceMat) return;
  // her ice #6aa8d8, faceted; a little self-light so the walls stay pale in the shade of the canyon
  iceMat = new THREE.MeshStandardMaterial({ color: 0x6aa8d8, metalness: 0.08, roughness: 0.32, flatShading: true, side: THREE.DoubleSide, emissive: 0x1e3a60, emissiveIntensity: 0.55 });
  glintMat = new THREE.MeshBasicMaterial({ color: 0xc0ffe8, side: THREE.DoubleSide });
  shardMat = new THREE.MeshStandardMaterial({ color: 0xdfe6f2, metalness: 0.05, roughness: 0.25, flatShading: true, side: THREE.DoubleSide, emissive: 0x3a5a80, emissiveIntensity: 0.4 });
}

// ---- a wall section (decor). ev: side (-1 left, +1 right), v (variant 0..3), sy (height scale), lift
const WALLS = ['wallA', 'wallB', 'wallC', 'wallD'];
let wallLayers = null;
export const wall = defineDecor({
  name: 'l6-wall',
  init(api) {
    mats();
    wallLayers = WALLS.map((k) => MESH[k].map((g) => new Instanced(api.scene, geoOf(g), g.glow ? glintMat : iceMat, 90)));
  },
  begin() { for (const v of wallLayers) for (const L of v) L.begin(); },
  end() { for (const v of wallLayers) for (const L of v) L.end(); },
  sample: { side: -1, v: 0, sy: 1, lift: 0, x: -12 },
  spawn(e, ev) { e.side = ev.side; e.v = ev.v || 0; e.sy = ev.sy || 1; e.lift = ev.lift || 0; e.flip = ev.flip ? -1 : 1; },
  update(e, dt, api) {
    // grows in from the haze like everything: the depth and height scale with appear, the x stays on the wall line
    const a = e.appear;
    tmpQ.identity();
    // her section's jagged face is toward +X; the right-hand wall is the same section mirrored (scale x -1)
    for (const L of wallLayers[e.v]) L.put(e.x, e.y + e.lift, e.z, tmpQ, -e.side * a, e.sy * a, e.flip * a);
    if (e.z > 60) e.alive = false;
  },
});
// both walls, two layers each, every 34 m: the outer layer stands further out, taller and half a section along
export const walls = defineScenery({
  name: 'l6-walls',
  ease: 2,
  stream: {
    every: [WALL_EVERY, WALL_EVERY],
    place: (R, api) => {
      const gap = RIFT.gapAt((api.G.courseD || 0) + SPAWN_D), bx = api.box.x, out = [];
      for (const side of [-1, 1]) {
        const face = bx + gap + R.range(0, 0.8);
        out.push({ type: 'l6-wall', side, v: R.int(0, 3), x: side * (face + 5), y: R.range(-4, 6), sy: R.range(1.0, 1.25), flip: R() < 0.5 });
        out.push({ type: 'l6-wall', side, v: R.int(0, 3), x: side * (face + 9 + R.range(0, 4)), y: 0, lift: R.range(18, 34), sy: R.range(1.2, 1.6), flip: R() < 0.5, dz: -WALL_EVERY / 2 });
      }
      return out;
    },
  },
});

// ---- Yori's ice-shard clusters on the wall ledges and drifting in the spray (decor)
let shardLayer = null;
export const shard = defineDecor({
  name: 'l6-shard',
  init(api) { mats(); shardLayer = new Instanced(api.scene, geoOf(MESH.shard[0]), shardMat, 160); },
  begin() { shardLayer.begin(); }, end() { shardLayer.end(); },
  sample: { x: -14, y: -6, s: 2 },
  spawn(e, ev) { e.s = ev.s || 2; e.spin = Math.random() * 6; e.rate = (Math.random() - 0.5) * (ev.tumble || 0); e.q = new THREE.Quaternion(); e.rx = Math.random() * 6; },
  update(e, dt, api) {
    e.spin += dt * e.rate;
    e.q.setFromEuler(eul.set(e.rx, e.spin, 0));
    const s = e.s * e.appear;
    shardLayer.put(e.x, e.y, e.z, e.q, s, s, s);
    if (e.z > 40) e.alive = false;
  },
});
export const shards = defineScenery({
  name: 'l6-shards',
  stream: {
    every: [14, 30],
    place: (R, api) => {
      const gap = RIFT.gapAt((api.G.courseD || 0) + SPAWN_D), side = R.sign(), bx = api.box.x, by = api.box.y;
      // on the ledge at the wall's foot, or tumbling in the spray up the wall: always outside the box
      if (R() < 0.6) return { type: 'l6-shard', x: side * (bx + gap + R.range(-0.5, 1.5)), y: R.range(-by - 9, -by - 4), s: R.range(1.6, 3.4) };
      return { type: 'l6-shard', x: side * (bx + gap + R.range(-1.2, 0.5)), y: R.range(by * 1.6, by * 1.6 + 16), s: R.range(0.7, 1.5), tumble: 3 };
    },
  },
});

// ---- glints: tiny mint lights drifting in the air along the walls (the glittering spray)
let glints = null;
export const glint = defineDecor({
  name: 'l6-glint',
  init(api) { glints = new Instanced(api.scene, new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: 0xe8fff6 }), 260); },
  begin() { glints.begin(); }, end() { glints.end(); },
  sample: { x: -12, y: 6 },
  spawn(e) { e.ph = Math.random() * 6; e.q = new THREE.Quaternion(); },
  update(e, dt, api) {
    e.ph += dt * 3;
    const tw = 0.55 + 0.45 * Math.sin(e.ph * 2.3), s = e.appear * tw * 1.4;
    e.q.setFromEuler(eul.set(e.ph, e.ph * 0.7, 0));
    glints.put(e.x, e.y + Math.sin(e.ph * 0.5) * 0.4, e.z, e.q, s, s, s);
    if (e.z > 30) e.alive = false;
  },
});
export const spray = defineScenery({
  name: 'l6-spray',
  stream: {
    every: [5, 11],
    place: (R, api) => {
      const gap = RIFT.gapAt((api.G.courseD || 0) + SPAWN_D), bx = api.box.x, by = api.box.y;
      const side = R.sign();
      return R() < 0.7
        ? { type: 'l6-glint', x: side * (bx + gap * R.range(0.2, 0.95)) + side * 1.2, y: R.range(-by * 1.6, by * 2.8) }
        : { type: 'l6-glint', x: R.range(-bx * 1.6, bx * 1.6), y: R.range(by * 1.5, by * 3.2) };
    },
  },
});

// ---- the ribs: great bridges of ice across the canyon high overhead, the level's landmark (rule 22)
let ribIce = null, ribGlint = null;
function ribGeometry(seed) {
  // a sagging arch of faceted ice, wall to wall, 1 m units: x -1..1 (scaled to the canyon), y up
  const pts = [];
  const n = 9;
  for (let i = 0; i <= n; i++) { const t = i / n, x = -1 + 2 * t; pts.push(new THREE.Vector3(x * 18, -Math.cos((t - 0.5) * Math.PI) * 3.2 + Math.sin(i * 1.7 + seed) * 0.6, Math.sin(i * 2.3 + seed) * 1.2)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, 18, 2.6, 5, false);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + Math.sin(i * 12.9898 + seed) * 0.5);
  g.computeVertexNormals();
  return g;
}
export const rib = defineDecor({
  name: 'l6-rib',
  init(api) {
    mats();
    ribIce = new Instanced(api.scene, ribGeometry(3), iceMat, 24);
    const gg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-17, -1.6, 2.1), new THREE.Vector3(0, 1.4, 2.4), new THREE.Vector3(17, -1.6, 2.1)]), 12, 0.22, 4, false);
    ribGlint = new Instanced(api.scene, gg, glintMat, 24);
  },
  begin() { ribIce.begin(); ribGlint.begin(); }, end() { ribIce.end(); ribGlint.end(); },
  sample: { x: 0, y: 30, w: 1 },
  spawn(e, ev) { e.w = ev.w || 1; e.tilt = ev.tilt || 0; },
  update(e, dt, api) {
    const a = e.appear;
    tmpQ.setFromEuler(eul.set(0, 0, e.tilt));
    ribIce.put(e.x, e.y, e.z, tmpQ, e.w * a, a, a);
    ribGlint.put(e.x, e.y, e.z, tmpQ, e.w * a, a, a);
    if (e.z > 60) e.alive = false;
  },
});
export const ribs = defineScenery({
  name: 'l6-ribs',
  stream: {
    every: [260, 520],
    place: (R, api) => {
      const gap = RIFT.gapAt((api.G.courseD || 0) + SPAWN_D), bx = api.box.x;
      return { type: 'l6-rib', x: R.range(-2, 2), y: api.box.y * 1.6 + R.range(9, 22), w: (bx + gap + 6) / 17, tilt: R.range(-0.12, 0.12) };
    },
  },
});

// ---- the floor of the rift: a dark lane far below with pale streaks running along it (her mood frame), and pale
// ice ledges along the foot of each wall. A set piece: it fades by its weight and its streaks scroll with speed.
function floorTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 128, 0);
  grd.addColorStop(0, '#16325a'); grd.addColorStop(0.18, '#0a1a34'); grd.addColorStop(0.5, '#071328'); grd.addColorStop(0.82, '#0a1a34'); grd.addColorStop(1, '#16325a');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 512);
  let s = 11; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) { const x = rnd() * 128, y = rnd() * 512, l = 20 + rnd() * 90; g.fillStyle = 'rgba(122,184,224,' + (0.08 + rnd() * 0.22) + ')'; g.fillRect(x, y, 1 + rnd() * 1.5, l); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
export const floor = defineScenery({
  name: 'l6-floor',
  ease: 0.8,
  init(api) {
    const tex = floorTexture(); tex.repeat.set(1, 6);
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0 });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 900), m);
    plane.rotation.x = -Math.PI / 2; plane.position.set(0, -20, -430); plane.renderOrder = -1; plane.visible = false;
    const lm = new THREE.MeshBasicMaterial({ color: 0x7ab8e0, transparent: true, opacity: 0 });
    const ledges = [-1, 1].map((s) => { const l = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 900), lm); l.position.set(0, -19.4, -430); l.visible = false; l.userData.s = s; return l; });
    api.scene.add(plane, ...ledges);
    return { plane, m, tex, ledges, lm };
  },
  update(s, w, dt, api) {
    const vis = w > 0.003;
    s.plane.visible = vis; for (const l of s.ledges) l.visible = vis;
    s.m.opacity = clamp(w * 2, 0, 1); s.lm.opacity = clamp(w * 2, 0, 1) * 0.85;
    const gap = RIFT.gapAt(api.G.courseD || 0), half = api.box.x + gap;
    const y = -(api.box.y + 13);
    s.plane.scale.x = half * 2 + 4; s.plane.position.y = y;
    for (const l of s.ledges) { l.position.x = l.userData.s * (half - 0.3); l.position.y = y + 0.5; }
    s.tex.offset.y = ((api.G.dist || 0) / 150) % 1;
  },
});

export const SCENERY = [walls, shards, spray, ribs, floor];
export const DECOR = [wall, shard, glint, rib];
// the canyon closes in over its first stretch: wide at the mouth, tight from about 700 m
export const mouthGap = (d) => 3 + 16 * (1 - smoothstep(150, 750, d));
