// LEVEL 10 scenery: the machine itself, then the way out. Set pieces fade by weight; streams keep every stretch full
// (ruling 5). Everything stays outside the flight box, and red is only ever a thin seam or a light, never a flat field
// (rule 9: on the one level whose scenery IS the enemy, the hazards still have to read as the red things that hurt).
//  ACT 1  l10-sphere (the Lattice: a planet-sized machine, its orbital rings, the split in its shell)
//         l10-struts (relay struts drifting past) and l10-arcs (the arcs of orbital rings sweeping by outside the box)
//  ACT 2  l10-tunnel (the living tunnel: Yori's shell segments, turning, their seams beating with the music)
//  ACT 3  l10-chamber (the core chamber's wall) and l10-motes (floating plates and sparks)
//  OUT    l10-breach (the white way out ahead, and the shockwave's light behind you), l10-shaft (the white shaft)
//  HOME   l10-sunrise (a sunrise over a quiet blue planet) and l10-wisps (high cloud and the last of the debris)
import { THREE, defineScenery, defineDecor, Instanced, modelGroups, clamp, smoothstep, rng } from '../../api.js?v=0.2.0';
import { MESH } from './mesh.js?v=0.2.0';

const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpC = new THREE.Color();
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const texOf = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
// where the run is inside a section (0..1), by its id; -1 before it, 2 after it
function sectionK(api, id) {
  const s = api.level.sections.find((q) => q.id === id); if (!s) return -1;
  const d = api.G.courseD; if (d < s.d0) return -1; if (d > s.d1) return 2;
  return (d - s.d0) / (s.d1 - s.d0);
}
// the music's beat, 0..1 since the last beat (1 if there is no beat grid)
function beatPhase(api) {
  const m = api.music; if (!m || !m.meta || !m.meta.beatSec) return 1;
  const p = m.position(); if (p < 0) return 1;
  return (((p - (m.meta.firstBeat || 0)) / m.meta.beatSec) % 1 + 1) % 1;
}
// transparent far things: drawn after the course (so it always covers them) but before every other glow
const far = (mat, order) => { mat.transparent = true; mat.depthWrite = false; mat.fog = false; return order; };

// =====================================================================================================================
// THE LATTICE. A machine sphere hanging ahead, black with a red seam grid and running lights, ringed by two orbital
// rings, its limb glowing. It looms over act 1 (kept beyond the course's 800 m, inside the far plane). In the
// breakdown a seam across its face splits open and pours out red-white light: the way in.
function sphereTexture() {
  const W = 1024, H = 512, c = canvas(W, H), g = c.getContext('2d'), R = rng(1010);
  g.fillStyle = '#0d0308'; g.fillRect(0, 0, W, H);
  // panels: a slightly lighter plate here and there
  for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(' + (40 + R() * 30 | 0) + ',' + (14 + R() * 10 | 0) + ',' + (28 + R() * 16 | 0) + ',' + (0.35 + R() * 0.4).toFixed(2) + ')'; const x = R() * W, y = R() * H; g.fillRect(x, y, 10 + R() * 50, 6 + R() * 24); }
  // the seam grid: latitudes and meridians, thin and red
  g.strokeStyle = 'rgba(255,51,85,0.75)'; g.lineWidth = 1.2;
  for (let k = 1; k < 16; k++) { const y = k / 16 * H; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  for (let k = 0; k < 32; k++) { const x = k / 32 * W; g.beginPath(); g.moveTo(x, H * 0.06); g.lineTo(x, H * 0.94); g.stroke(); }
  // a few bright trench lines
  g.strokeStyle = 'rgba(255,120,140,0.9)'; g.lineWidth = 2.4;
  for (let k = 0; k < 6; k++) { const y = (0.2 + R() * 0.6) * H; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + (R() - 0.5) * 30); g.stroke(); }
  // running lights
  for (let i = 0; i < 900; i++) { const b = R(); g.fillStyle = b > 0.9 ? 'rgba(255,240,250,0.95)' : 'rgba(255,80,110,' + (0.4 + b * 0.5).toFixed(2) + ')'; g.fillRect(R() * W, R() * H, b > 0.9 ? 2 : 1.5, b > 0.9 ? 2 : 1.5); }
  return texOf(c);
}
function limbTexture() { // a ring of glow, clear in the middle
  const S = 256, c = canvas(S, S), g = c.getContext('2d');
  const r = g.createRadialGradient(S / 2, S / 2, S * 0.33, S / 2, S / 2, S / 2);
  r.addColorStop(0, 'rgba(255,60,110,0)'); r.addColorStop(0.25, 'rgba(255,60,110,0.9)'); r.addColorStop(0.45, 'rgba(160,20,80,0.35)'); r.addColorStop(1, 'rgba(80,0,40,0)');
  g.fillStyle = r; g.fillRect(0, 0, S, S); return texOf(c);
}
export const sphere = defineScenery({
  name: 'l10-sphere',
  ease: 0.5,
  init(api) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ map: sphereTexture(), color: 0xffffff, opacity: 0 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), mat); ball.renderOrder = far(mat, -8); ball.rotation.set(0.35, 0, 0.12); g.add(ball);
    const limbMat = new THREE.SpriteMaterial({ map: limbTexture(), blending: THREE.AdditiveBlending, opacity: 0 });
    const limb = new THREE.Sprite(limbMat); limb.renderOrder = far(limbMat, -7); g.add(limb);
    // two orbital rings: a back half drawn before the sphere and a front half after it
    const rings = [];
    for (const [tilt, roll, rad] of [[1.32, 0.22, 1.32], [1.18, -0.4, 1.55]]) {
      const halves = [];
      for (const [arc0, order] of [[Math.PI, -9], [0, -6]]) {
        const m = new THREE.MeshBasicMaterial({ color: 0xff3355, opacity: 0 });
        const t = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.006, 4, 96, Math.PI), m);
        t.rotation.z = arc0; t.renderOrder = far(m, order); halves.push(t);
        const m2 = new THREE.MeshBasicMaterial({ color: 0x3a1020, opacity: 0 });
        const band = new THREE.Mesh(new THREE.TorusGeometry(rad * 1.012, 0.018, 3, 96, Math.PI), m2);
        band.rotation.z = arc0; band.renderOrder = far(m2, order - 0.5); halves.push(band);
      }
      const holder = new THREE.Group(); holder.rotation.set(tilt, 0, roll, 'ZYX'); halves.forEach((h) => holder.add(h)); g.add(holder);
      rings.push({ holder, halves });
    }
    // the split: a seam of light down its face that opens in the breakdown
    const splitMat = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffd0dc, blending: THREE.AdditiveBlending, opacity: 0 });
    const split = new THREE.Sprite(splitMat); split.renderOrder = far(splitMat, -5); g.add(split);
    const splitRed = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, opacity: 0 }));
    splitRed.renderOrder = far(splitRed.material, -5.5); g.add(splitRed);
    g.visible = false; api.scene.add(g);
    return { g, ball, mat, limb, limbMat, rings, split, splitMat, splitRed };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003;
    if (!s.g.visible) return;
    // it looms across act 1: bigger and nearer, never inside the course's 800 m
    const k = clamp(api.G.courseD / 12000, 0, 1), R = 220 + 120 * k, cz = -(860 + R);
    s.g.position.set(0, 40 - 25 * k, cz); s.g.scale.setScalar(R);
    s.ball.rotation.y += dt * 0.004;
    s.mat.opacity = w; s.limbMat.opacity = 0.8 * w; s.limb.scale.setScalar(2.5);
    for (const r of s.rings) { r.holder.rotation.y += dt * 0.01; for (const h of r.halves) h.material.opacity = w * (h.material.color.r > 0.5 ? 0.9 : 1); }
    // the split opens through the breakdown and pours light in the first moments of the dive
    const sk = Math.max(sectionK(api, 'split') >= 0 && sectionK(api, 'split') <= 1 ? sectionK(api, 'split') : sectionK(api, 'split') > 1 ? 1 : 0, 0);
    const open = smoothstep(0.0, 0.7, sk);
    s.split.position.set(0, -0.05, 1.02); s.splitRed.position.set(0, -0.05, 1.01);
    s.split.scale.set(0.06 + 0.3 * open, 2.1 * Math.max(0.05, open), 1); s.splitRed.scale.set(0.35 + 1.1 * open, 2.4 * Math.max(0.05, open), 1);
    s.splitMat.opacity = Math.min(1, w * open * 1.6) * (0.85 + 0.15 * Math.sin(api.time * 9));
    s.splitRed.material.opacity = Math.min(1, w * open * 1.3);
  },
});

// ---- act 1 streams
// relay struts: long dark bars of the Lattice with red tip lights, drifting outside the box
let struts, strutTips;
export const strut = defineDecor({
  name: 'l10-strut',
  init(api) {
    const g = new THREE.BoxGeometry(1, 1, 1);
    struts = new Instanced(api.scene, g, new THREE.MeshStandardMaterial({ color: 0x4a5070, metalness: 0.5, roughness: 0.5, flatShading: true }), 160);
    strutTips = new Instanced(api.scene, new THREE.OctahedronGeometry(0.6, 0), new THREE.MeshBasicMaterial({ color: 0xff3355 }), 320);
  },
  begin() { struts.begin(); strutTips.begin(); },
  end() { struts.end(); strutTips.end(); },
  spawn(e, ev) { e.len = ev.len; e.rx = ev.rx; e.ry = ev.ry; e.rz = ev.rz; e.spin = ev.spin; },
  update(e, dt) {
    const a = e.appear;
    tmpQ.setFromEuler(tmpE.set(e.rx + e.t * e.spin, e.ry, e.rz + e.t * e.spin * 0.5));
    struts.put(e.x, e.y, e.z, tmpQ, 0.9 * a, 0.9 * a, e.len * a);
    const v = new THREE.Vector3(0, 0, e.len / 2).applyQuaternion(tmpQ);
    strutTips.put(e.x + v.x * a, e.y + v.y * a, e.z + v.z * a, tmpQ, a, a, a);
    strutTips.put(e.x - v.x * a, e.y - v.y * a, e.z - v.z * a, tmpQ, a, a, a);
    if (e.z > 40) e.alive = false;
  },
});
export const struts_ = defineScenery({
  name: 'l10-struts',
  stream: { every: [26, 60], place: (R) => ({ type: 'l10-strut', nx: R.sign() * R.range(1.7, 5.5), ny: R.range(-3.2, 3.2), len: R.range(10, 34), rx: R.range(0, 3), ry: R.range(0, 3), rz: R.range(0, 3), spin: R.range(-0.25, 0.25) }) },
});
// the arcs of orbital rings sweeping past outside the box: Yori's defence ring, its middle far off to one side
let arcLayers;
export const arc = defineDecor({
  name: 'l10-arc',
  init(api) { arcLayers = modelGroups(MESH.defring).map((g) => new Instanced(api.scene, g.geo, g.glow ? new THREE.MeshBasicMaterial({ color: g.color }) : new THREE.MeshStandardMaterial({ color: g.color, metalness: 0.5, roughness: 0.45, flatShading: true }), 12)); },
  begin() { for (const L of arcLayers) L.begin(); },
  end() { for (const L of arcLayers) L.end(); },
  spawn(e, ev) { e.tilt = ev.tilt; e.roll = ev.roll; e.s = ev.s; },
  update(e, dt) {
    tmpQ.setFromEuler(tmpE.set(e.tilt, 0, e.roll + e.t * 0.05));
    const s = e.s * e.appear;
    for (const L of arcLayers) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
    if (e.z > 120) e.alive = false;
  },
});
export const arcs = defineScenery({
  name: 'l10-arcs',
  stream: { every: [260, 420], place: (R, api) => { const side = R.sign(); return { type: 'l10-arc', x: side * R.range(84, 104), y: R.range(-18, 18), tilt: R.range(-0.5, 0.5), roll: R.range(0, 6), s: R.range(0.85, 1.15) }; } },
});

// =====================================================================================================================
// THE LIVING TUNNEL. Yori's shell segment (30 across, a red seam bar every 36 degrees), one every 6.5 m so the wall
// is whole. Each turns slowly, alternate ones the other way, and every seam flares on the music's beat.
let segLayers, seamMat;
export const segment = defineDecor({
  name: 'l10-segment',
  init(api) {
    seamMat = new THREE.MeshBasicMaterial({ color: 0xff3355 });
    segLayers = modelGroups(MESH.segment).map((g) => new Instanced(api.scene, g.geo, g.glow ? seamMat : new THREE.MeshStandardMaterial({ color: 0x241018, metalness: 0.55, roughness: 0.5, flatShading: true, side: THREE.DoubleSide }), 170));
  },
  begin(api) {
    for (const L of segLayers) L.begin();
    // the seams beat: bright on the beat, falling away after it
    const b = beatPhase(api), k = Math.exp(-b * 5);
    seamMat.color.setRGB(0.55 + 0.45 * k, 0.12 + 0.35 * k * k, 0.2 + 0.35 * k * k);
  },
  end() { for (const L of segLayers) L.end(); },
  spawn(e, ev) { e.rot = ev.rot; e.spin = ev.spin; e.s = ev.s || 1; },
  update(e, dt) {
    tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), e.rot + e.t * e.spin);
    const s = e.s * e.appear;
    for (const L of segLayers) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
    if (e.z > 30) e.alive = false;
  },
});
export const tunnel = defineScenery({
  name: 'l10-tunnel',
  ease: 1.5,
  stream: { every: [6.5, 6.5], place: (R, api, w) => (R() < w * 1.05 ? { type: 'l10-segment', x: 0, y: 0, rot: R() * 6.3, spin: (R() < 0.5 ? -1 : 1) * R.range(0.05, 0.22), s: 1 } : null) },
});
// the red glow at the tunnel's end, where it goes
export const tunnelGlow = defineScenery({
  name: 'l10-tunnel-glow',
  ease: 0.8,
  init(api) {
    const m = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff2a50, blending: THREE.AdditiveBlending, opacity: 0 });
    const s = new THREE.Sprite(m); s.renderOrder = far(m, -4); s.position.set(0, 0, -900); s.scale.set(260, 260, 1); s.visible = false; api.scene.add(s);
    return { s, m };
  },
  update(st, w, dt, api) { st.s.visible = w > 0.003; st.m.opacity = 0.55 * w * (0.8 + 0.2 * Math.exp(-beatPhase(api) * 4)); },
});

// =====================================================================================================================
// THE CORE CHAMBER. A hollow sphere round the Heart, its wall dark plum with rings of red seams and the lights of
// the machine; you hang in the middle of it while the fight lasts.
function chamberTexture() {
  const W = 1024, H = 512, c = canvas(W, H), g = c.getContext('2d'), R = rng(1030);
  const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#07030a'); grd.addColorStop(0.5, '#12060f'); grd.addColorStop(1, '#060208');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 400; i++) { g.fillStyle = 'rgba(' + (22 + R() * 20 | 0) + ',8,' + (20 + R() * 16 | 0) + ',0.5)'; g.fillRect(R() * W, R() * H, 8 + R() * 60, 4 + R() * 16); }
  g.strokeStyle = 'rgba(200,40,80,0.32)'; g.lineWidth = 0.7;
  for (let k = 1; k < 12; k++) { const y = k / 12 * H; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  for (let k = 0; k < 48; k++) { const x = k / 48 * W; g.beginPath(); g.moveTo(x, H * 0.08); g.lineTo(x, H * 0.92); g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1; }
  for (let i = 0; i < 1400; i++) { const b = R(); g.fillStyle = b > 0.93 ? 'rgba(255,244,255,0.9)' : 'rgba(200,70,110,' + (0.2 + b * 0.35).toFixed(2) + ')'; g.fillRect(R() * W, R() * H, 1.1, 1.1); }
  return texOf(c);
}
export const chamber = defineScenery({
  name: 'l10-chamber',
  ease: 0.7,
  init(api) {
    const mat = new THREE.MeshBasicMaterial({ map: chamberTexture(), side: THREE.BackSide, opacity: 0 });
    const m = new THREE.Mesh(new THREE.SphereGeometry(840, 48, 24), mat); m.renderOrder = far(mat, -8); m.visible = false; api.scene.add(m);
    return { m, mat };
  },
  update(s, w, dt, api) { s.m.visible = w > 0.003; s.mat.opacity = w; s.m.rotation.z += dt * 0.01; s.m.rotation.y += dt * 0.003; },
});
// motes: floating scraps of plate and white sparks, slow, outside the box
let moteLayer, sparkLayer;
export const mote = defineDecor({
  name: 'l10-mote',
  init(api) {
    moteLayer = new Instanced(api.scene, new THREE.TetrahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x4a3048, metalness: 0.5, roughness: 0.5, flatShading: true }), 260);
    sparkLayer = new Instanced(api.scene, new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: 0xfff0ff }), 260);
  },
  begin() { moteLayer.begin(); sparkLayer.begin(); },
  end() { moteLayer.end(); sparkLayer.end(); },
  spawn(e, ev) { e.s = ev.s; e.spin = ev.spin; e.spark = ev.spark; e.vy = ev.vy || 0; },
  update(e, dt) {
    e.y += e.vy * dt;
    tmpQ.setFromEuler(tmpE.set(e.t * e.spin, e.t * e.spin * 0.7, 0));
    const s = e.s * e.appear;
    if (e.spark) sparkLayer.put(e.x, e.y, e.z, tmpQ, s, s, s); else moteLayer.put(e.x, e.y, e.z, tmpQ, s, s * 0.3, s);
    if (e.z > 30) e.alive = false;
  },
});
export const motes = defineScenery({
  name: 'l10-motes',
  stream: { every: [7, 16], place: (R) => ({ type: 'l10-mote', nx: R.sign() * R.range(1.6, 6), ny: R.range(-4, 4), s: R.range(1.0, 2.8), spin: R.range(-1, 1), spark: R() < 0.4, vy: R.range(-0.6, 0.6) }) },
});

// =====================================================================================================================
// THE WAY OUT. Ahead, a white breach where the eye was, growing; behind you, the shockwave's light at the edges of
// the view, rising through the escape. The shaft you run down is the tunnel again, its seams now white-hot.
export const breach = defineScenery({
  name: 'l10-breach',
  ease: 1.0,
  init(api) {
    const m = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xfff6ff, blending: THREE.AdditiveBlending, opacity: 0 });
    const s = new THREE.Sprite(m); s.renderOrder = far(m, -4); s.position.set(0, 0, -900); s.visible = false; api.scene.add(s);
    const gm = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffb060, blending: THREE.AdditiveBlending, opacity: 0 });
    const gold = new THREE.Sprite(gm); gold.renderOrder = far(gm, -4.5); gold.position.set(0, 0, -950); gold.visible = false; api.scene.add(gold);
    // the shockwave's light: a white ring just in front of the ship's plane, round the edge of the view
    const ringM = new THREE.SpriteMaterial({ color: 0xfff4ff, opacity: 0, blending: THREE.AdditiveBlending, map: shockTexture() });
    const ring = new THREE.Sprite(ringM); ring.renderOrder = far(ringM, 50); ring.position.set(0, 2.35, 4); ring.scale.set(17, 13, 1); ring.visible = false; api.scene.add(ring);
    return { s, m, gold, gm, ring, ringM };
  },
  update(st, w, dt, api) {
    const on = w > 0.003; st.s.visible = st.gold.visible = st.ring.visible = on;
    if (!on) return;
    const c = sectionK(api, 'collapse'), e = sectionK(api, 'escape');
    const grow = c < 0 ? 0 : c <= 1 ? c * 0.5 : e < 0 ? 0.5 : e <= 1 ? 0.5 + e * 0.5 : 1;
    st.s.scale.setScalar(80 + 520 * grow * grow); st.m.opacity = w * (0.55 + 0.45 * grow) * (0.9 + 0.1 * Math.sin(api.time * 13));
    st.gold.scale.setScalar(200 + 700 * grow); st.gm.opacity = w * 0.35 * grow;
    // the shockwave: from the moment you pass the core it is behind you; it never quite catches you
    const sh = e < 0 ? 0 : e <= 1 ? 0.35 + 0.3 * e : 0.65;
    const pulse = 0.75 + 0.25 * Math.sin(api.time * 7);
    st.ringM.opacity = w * sh * pulse * 0.6;
    st.ring.position.set(api.ship.x * 0.66, api.ship.y * 0.66 + 2.35, 4); // round the edge of the view (the camera sits 2.8 m up, 9.2 m back)
    if (sh > 0 && Math.random() < dt * 3) api.game.shake(0.18 + sh * 0.25);
  },
});
function shockTexture() { // clear in the middle of the view, white light round its edges
  const S = 256, c = canvas(S, S), g = c.getContext('2d');
  const r = g.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.5);
  r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.55, 'rgba(255,240,250,0.25)'); r.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = r; g.fillRect(0, 0, S, S);
  return texOf(c);
}
let shaftLayers, shaftSeam;
export const shaftRing = defineDecor({
  name: 'l10-shaft-ring',
  init(api) {
    shaftSeam = new THREE.MeshBasicMaterial({ color: 0xfff0f6 });
    shaftLayers = modelGroups(MESH.segment).map((g) => new Instanced(api.scene, g.geo, g.glow ? shaftSeam : new THREE.MeshStandardMaterial({ color: 0x3a2a34, metalness: 0.5, roughness: 0.45, flatShading: true, side: THREE.DoubleSide }), 170));
  },
  begin(api) { for (const L of shaftLayers) L.begin(); const k = Math.exp(-beatPhase(api) * 4); shaftSeam.color.setRGB(1, 0.8 + 0.2 * k, 0.85 + 0.15 * k); },
  end() { for (const L of shaftLayers) L.end(); },
  spawn(e, ev) { e.rot = ev.rot; e.spin = ev.spin; e.broken = ev.broken; },
  update(e, dt) {
    tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), e.rot + e.t * e.spin);
    const s = e.appear * (e.broken ? 1.08 : 1);
    for (const L of shaftLayers) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
    if (e.z > 30) e.alive = false;
  },
});
export const shaft = defineScenery({
  name: 'l10-shaft',
  ease: 1.2,
  // a shaft that is coming apart: rings with gaps between them, some knocked askew
  stream: { every: [9, 22], place: (R) => ({ type: 'l10-shaft-ring', x: R.range(-1, 1), y: R.range(-1, 1), rot: R() * 6.3, spin: R.range(-0.6, 0.6), broken: R() < 0.3 }) },
});

// =====================================================================================================================
// THE RUN HOME. A sky from gold at the horizon to blue overhead, a quiet blue planet below with its rim lit, and the
// sun coming up over its edge ahead. Kept clear of the lane: the planet's horizon sits well below the box.
function skyDome() {
  const geo = new THREE.SphereGeometry(860, 48, 24), pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const hz = new THREE.Color(0xffb060), mid = new THREE.Color(0xff8a70), top = new THREE.Color(0x5aa0ff), deep = new THREE.Color(0x2a5ab0), low = new THREE.Color(0x1a2a5a);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 860, z = pos.getZ(i) / 860;
    const ahead = clamp(-z, 0, 1); // brighter toward the sun
    if (y >= 0) { tmpC.copy(hz).lerp(mid, clamp(y * 3, 0, 1) * 0.4).lerp(top, smoothstep(0.02, 0.45, y)).lerp(deep, smoothstep(0.45, 1, y)); tmpC.lerp(top, (1 - ahead) * 0.35 * (1 - clamp(y * 2, 0, 1))); }
    else tmpC.copy(hz).lerp(low, smoothstep(0, 0.25, -y));
    col[i * 3] = tmpC.r; col[i * 3 + 1] = tmpC.g; col[i * 3 + 2] = tmpC.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
function planetTexture() {
  const W = 1024, H = 512, c = canvas(W, H), g = c.getContext('2d'), R = rng(1066);
  const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#1f5ad8'); grd.addColorStop(0.5, '#1846b8'); grd.addColorStop(1, '#0c2a80');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  // land: a few soft green-brown masses
  for (let i = 0; i < 4; i++) { const x = R() * W, y = H * (0.25 + R() * 0.5), rx = 30 + R() * 70, ry = 14 + R() * 30; const r = g.createRadialGradient(x, y, 0, x, y, rx); r.addColorStop(0, 'rgba(70,110,70,0.85)'); r.addColorStop(0.7, 'rgba(60,90,60,0.5)'); r.addColorStop(1, 'rgba(40,70,60,0)'); g.fillStyle = r; g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y); g.fillRect(x - rx, y - rx, rx * 2, rx * 2); g.restore(); }
  // cloud bands and swirls
  for (let i = 0; i < 150; i++) { const x = R() * W, y = R() * H, rr = 6 + R() * 34; const r = g.createRadialGradient(x, y, 0, x, y, rr); r.addColorStop(0, 'rgba(255,255,255,' + (0.18 + R() * 0.35).toFixed(2) + ')'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.save(); g.translate(x, y); g.scale(2.6, 1); g.translate(-x, -y); g.fillRect(x - rr, y - rr, rr * 2, rr * 2); g.restore(); }
  return texOf(c);
}
export const sunrise = defineScenery({
  name: 'l10-sunrise',
  ease: 1.6,
  init(api) {
    const dm = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, opacity: 0 });
    const dome = new THREE.Mesh(skyDome(), dm); dome.renderOrder = far(dm, -8.5);
    const pm = new THREE.MeshBasicMaterial({ map: planetTexture(), opacity: 0, color: 0xffffff });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(2100, 160, 80), pm); planet.renderOrder = far(pm, -7.8); pm.depthWrite = true; // it hides the sun until it rises over the rim
    planet.position.set(0, -2240, -420); planet.rotation.set(Math.PI / 2 - 0.25, 0, 0.1); planet.scale.set(3.2, 1, 1); // a vast planet: its horizon about 760 m out
    const rimM = new THREE.SpriteMaterial({ map: api.glowTex, color: 0x9ad0ff, blending: THREE.AdditiveBlending, opacity: 0 });
    const rim = new THREE.Sprite(rimM); rim.renderOrder = far(rimM, -7.5); rim.position.set(0, -182, -840); rim.scale.set(2600, 110, 1);
    const sunM = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffe0a0, blending: THREE.AdditiveBlending, opacity: 0 });
    const sun = new THREE.Sprite(sunM); sun.renderOrder = far(sunM, -7.4); sun.position.set(-60, -200, -850); sun.scale.setScalar(260);
    const haloM = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffb060, blending: THREE.AdditiveBlending, opacity: 0 });
    const halo = new THREE.Sprite(haloM); halo.renderOrder = far(haloM, -7.45); halo.position.copy(sun.position); halo.scale.setScalar(900);
    const g = new THREE.Group(); g.add(dome, planet, rim, sun, halo); g.visible = false; api.scene.add(g);
    return { g, dm, pm, rimM, sunM, haloM, sun, halo, planet, rise: 0 };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003;
    if (!s.g.visible) return;
    // the sun climbs over the rim as you go
    s.rise = Math.min(1, s.rise + dt / 40);
    const y = -200 + 140 * s.rise;
    s.sun.position.y = y; s.halo.position.y = y;
    s.dm.opacity = w; s.pm.opacity = w; s.rimM.opacity = 0.7 * w; s.sunM.opacity = w; s.haloM.opacity = 0.55 * w;
    s.planet.rotation.y += dt * 0.004;
  },
});
// high wisps of cloud catching the sun, and the last shell fragments tumbling away below
let wispLayer;
export const wisp = defineDecor({
  name: 'l10-wisp',
  init(api) {
    const m = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffd8b0, transparent: true, depthWrite: false, opacity: 0.5 });
    wispLayer = { m, pool: [] };
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('l10-wisp', () => new THREE.Sprite(wispLayer.m.clone()));
    e.sx = ev.w; e.sy = ev.h; e.sz = 1; e.obj.material.opacity = 0;
  },
  update(e, dt, api) {
    e.obj.material.opacity = 0.35 * e.appear * smoothstep(20, -20, e.z);
    api.pose(e);
    if (e.z > 25) e.alive = false;
  },
});
export const wisps = defineScenery({
  name: 'l10-wisps',
  stream: { every: [30, 70], place: (R) => ({ type: 'l10-wisp', nx: R.sign() * R.range(1.8, 6), ny: R.range(-2.5, 3), w: R.range(30, 70), h: R.range(4, 9) }) },
});
