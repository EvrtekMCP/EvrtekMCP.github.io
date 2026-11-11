// GALAXY 2, LEVEL 10, THE ROOTMIND: the scenery. Set pieces fade by weight, streams keep every stretch full (ruling 5).
// Everything stays outside the flight box; red is only ever a thin seam on the roots (rule 9: the roots are the enemy,
// so their red reads as "this hurts"), and the Deep's own lights stay on the green side.
//  ACT 1  g2-l10-far      the Rootmind from outside: a star in a cage of red-seamed roots, looming ahead
//         g2-l10-canopy   Yori's canopy roots arching over the lane (stream)     g2-l10-plankton  the Deep's drifting motes (stream)
//  ACT 2  g2-l10-tunnel   the taproot: Yori's root-tunnel rings, their sap-light beating with the music (stream)
//  ACT 3  g2-l10-chamber  inside the cage: slack roots overhead turning with the star, so you feel yourself circling it
//  OUT    g2-l10-freed    the freed star: silver roots opening, its first breath of light; you fly past it
//         g2-l10-opening  the canopy again, freed: silver roots lifting out of your way (stream)
//         g2-l10-current  the flare's current: long green streaks (stream)
//         g2-l10-herd     the Deep you set free swims home with you: star-whales, the Whirlmaw, the Snare, the moths
import { THREE, defineScenery, defineDecor, Instanced, modelGroups, clamp, smoothstep } from '../../../api.js?v=0.6.2';
import { MESH } from './mesh.js?v=0.6.2';
import { MESH as BOSS } from '../../../bosses/g2-rootmind/mesh.js?v=0.6.2';
import { ROOTMIND_AT as RM } from '../../../bosses/g2-rootmind/index.js?v=0.6.2';

const TAU = Math.PI * 2;
const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), ID_Q = new THREE.Quaternion();
const mothP = new THREE.Vector3(), mothS = new THREE.Vector3(3, 3, 3), mothM = new THREE.Matrix4();
// where the run is inside a section (0..1), by its id; -1 before it, 2 after it
export function sectionK(api, id) {
  const s = api.level.sections.find((q) => q.id === id); if (!s) return -1;
  const d = api.G.courseD; if (d < s.d0) return -1; if (d > s.d1) return 2;
  return (d - s.d0) / (s.d1 - s.d0);
}
// the music's beat, 0..1 since the last beat (1 with no beat grid)
function beatPhase(api) {
  const m = api.music; if (!m || !m.meta || !m.meta.beatSec) return 1;
  const p = m.position(); if (p < 0) return 1;
  return (((p - (m.meta.firstBeat || 0)) / m.meta.beatSec) % 1 + 1) % 1;
}
// a far transparent material that fades by weight and ignores the fog
const fadeMat = (color, glow) => (glow
  ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide })
  : new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.55, flatShading: true, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide }));
// a whole model from groups with materials of our own (so it can fade): -> { group, mats: [] }
function fadeModel(groups, recolor) {
  const g = new THREE.Group(), mats = [];
  for (const m of modelGroups(groups)) { const mat = fadeMat(recolor ? recolor(m.color, m.glow) : m.color, m.glow); mats.push(mat); g.add(new THREE.Mesh(m.geo, mat)); }
  return { group: g, mats };
}
const setOpacity = (mats, o) => { for (const m of mats) m.opacity = o; };
const glowSprite = (api, color, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, fog: false })); sp.scale.setScalar(s); return sp; };
// her star in its eight roots (the boss's own lists), upright, for the far view and the freed star
function rootmindModel(rootGroups) {
  const g = new THREE.Group(), body = new THREE.Group(); body.rotation.x = -Math.PI / 2; g.add(body);
  const star = fadeModel(BOSS.star); body.add(star.group);
  const shared = modelGroups(rootGroups).map((m) => ({ geo: m.geo, mat: fadeMat(m.color, m.glow) }));
  const roots = [];
  for (let i = 0; i < 8; i++) { const rg = new THREE.Group(); rg.rotation.z = i * TAU / 8; for (const s of shared) rg.add(new THREE.Mesh(s.geo, s.mat)); body.add(rg); roots.push(rg); }
  return { g, body, star, roots, mats: star.mats.concat(shared.map((s) => s.mat)) };
}

// =====================================================================================================================
// ACT 1: THE ROOTMIND FROM OUTSIDE. Kept beyond the course's 800 m and inside the far plane; it looms over the canopy.
export const far = defineScenery({
  name: 'g2-l10-far',
  ease: 0.5,
  init(api) {
    const m = rootmindModel(BOSS.root);
    m.g.renderOrder = -8; m.g.traverse((o) => { o.renderOrder = -8; });
    const halo = glowSprite(api, 0xd0ffb0, 3.6); halo.renderOrder = -9; m.g.add(halo);
    m.g.visible = false; api.scene.add(m.g);
    return Object.assign(m, { halo });
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003; if (!s.g.visible) return;
    // up and to the right of the lane (where the fight will be), so the lane's middle stays dark for the shots and
    // rings; it swings in toward the middle as you near the taproot's mouth
    const k = clamp(api.G.courseD / 15500, 0, 1), e = k * k, R = 7 + 6 * e, cz = -(860 + 20 * R);   // its front past the 800 m spawn line, its heart inside the 1200 m far plane
    s.g.position.set(420 - 330 * e, 300 - 170 * e, cz); s.g.scale.setScalar(R);
    s.body.rotation.z += dt * 0.012;
    setOpacity(s.mats, w); s.halo.material.opacity = 0.55 * w * (0.9 + 0.1 * Math.sin(api.time * 1.3));
  },
});

// ---- the canopy: Yori's machine roots arching over the lane. Two shapes, mirrored at random; outside the box always
// (their legs come down 30 m and more to the side, their crowns 14 m and more overhead). `free` is the release's: the
// same roots with their grafts gone (silver bark, sap-green seams), lifting out of your way as you come.
let archLayers = null, freeLayers = null;
const FREE_COL = { '#4a3220': '#c8d0dc', '#2a1c12': '#8a96a8', '#ff3355': '#d0ffb0' };
function layersFor(api, recolor, n) {
  return [MESH.canopyA, MESH.canopyB].map((groups) => modelGroups(groups).map((g) => {
    const c = recolor ? recolor[g.color] || g.color : g.color;
    const mat = g.glow ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshStandardMaterial({ color: c, metalness: 0.35, roughness: 0.6, flatShading: true, side: THREE.DoubleSide });
    return new Instanced(api.scene, g.geo, mat, n);
  }));
}
function putArch(layers, e, lift) {
  tmpQ.setFromEuler(tmpE.set(0.08 * Math.sin(e.t * 0.3 + e.ph), 0, e.roll + 0.03 * Math.sin(e.t * 0.5 + e.ph)));
  const s = e.s * e.appear;
  for (const L of layers[e.variant]) L.put(e.x, e.y + lift, e.z, tmpQ, s * e.flip, s, s);
}
export const arch = defineDecor({
  name: 'g2-l10-arch',
  init(api) { archLayers = layersFor(api, null, 18); },
  begin() { for (const v of archLayers) for (const L of v) L.begin(); },
  end() { for (const v of archLayers) for (const L of v) L.end(); },
  spawn(e, ev) { e.variant = ev.variant || 0; e.roll = ev.roll || 0; e.s = ev.s || 1; e.flip = ev.flip || 1; e.ph = ev.ph || 0; },
  update(e) { putArch(archLayers, e, 0); if (e.z > 70) e.alive = false; },
});
export const canopy = defineScenery({
  name: 'g2-l10-canopy',
  stream: { every: [55, 120], place: (R) => ({ type: 'g2-l10-arch', nx: 0, ny: R.range(-0.3, 1.2), variant: R() < 0.5 ? 0 : 1, roll: R.range(-0.32, 0.32), s: R.range(0.95, 1.35), flip: R() < 0.5 ? -1 : 1, ph: R.range(0, 6) }) },
});
export const archFree = defineDecor({
  name: 'g2-l10-arch-free',
  init(api) { freeLayers = layersFor(api, FREE_COL, 14); },
  begin() { for (const v of freeLayers) for (const L of v) L.begin(); },
  end() { for (const v of freeLayers) for (const L of v) L.end(); },
  spawn(e, ev) { e.variant = ev.variant || 0; e.roll = ev.roll || 0; e.s = ev.s || 1; e.flip = ev.flip || 1; e.ph = ev.ph || 0; },
  // it opens as you come: the last 300 m it lifts and widens out of the way
  update(e) { const k = smoothstep(-300, -40, e.z); putArch(freeLayers, e, 26 * k); if (e.z > 70) e.alive = false; },
});
export const opening = defineScenery({
  name: 'g2-l10-opening',
  stream: { every: [70, 140], place: (R) => ({ type: 'g2-l10-arch-free', nx: 0, ny: R.range(0, 1.2), variant: R() < 0.5 ? 0 : 1, roll: R.range(-0.3, 0.3), s: R.range(1.0, 1.4), flip: R() < 0.5 ? -1 : 1, ph: R.range(0, 6) }) },
});

// ---- plankton: the Deep's motes, green-white with now and then an orchid one, drifting past outside the box.
// One event is a little cloud of five. `streak` stretches them along the lane (the flare's current).
let moteLayer = null, orchidLayer = null;
const MOTE_OFF = [[0, 0, 0], [1.6, 0.7, -2.2], [-1.2, 1.4, 1.8], [0.8, -1.5, 3.1], [-1.9, -0.6, -3.4]];
export const mote = defineDecor({
  name: 'g2-l10-mote',
  init(api) {
    const geo = new THREE.OctahedronGeometry(1, 0);
    moteLayer = new Instanced(api.scene, geo, new THREE.MeshBasicMaterial({ color: 0xc8ffd8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), 900);
    orchidLayer = new Instanced(api.scene, geo, new THREE.MeshBasicMaterial({ color: 0xe0a0ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), 200);
  },
  begin() { moteLayer.begin(); orchidLayer.begin(); },
  end() { moteLayer.end(); orchidLayer.end(); },
  spawn(e, ev) { e.r = ev.r || 0.2; e.streak = ev.streak || 1; e.orchid = !!ev.orchid; e.dx = ev.dx || 0; e.dy = ev.dy || 0; },
  update(e, dt) {
    e.x += e.dx * dt; e.y += e.dy * dt;
    const L = e.orchid ? orchidLayer : moteLayer, s = e.r * e.appear;
    for (const o of MOTE_OFF) L.put(e.x + o[0], e.y + o[1] + 0.3 * Math.sin(e.t * 1.1 + o[2]), e.z + o[2], ID_Q, s, s, s * e.streak);
    if (e.z > 20) e.alive = false;
  },
});
// outside the flight box: |nx| beyond 1.4, or |ny| beyond 1.3
const outside = (R, a, b) => (R() < 0.6 ? { nx: R.sign() * R.range(1.45, a), ny: R.range(-b, b) } : { nx: R.range(-a, a), ny: R.sign() * R.range(1.35, b) });
export const plankton = defineScenery({
  name: 'g2-l10-plankton',
  // (none smaller than 0.22 m: a smaller mote is first seen inside 150 m, where it would seem to appear from nothing)
  stream: { every: [7, 16], place: (R) => Object.assign({ type: 'g2-l10-mote', r: R.range(0.22, 0.4), orchid: R() < 0.12, dx: R.range(-0.6, 0.6), dy: R.range(-0.3, 0.3) }, outside(R, 4.2, 3.4)) },
});
export const current = defineScenery({
  name: 'g2-l10-current',
  stream: { every: [5, 11], place: (R) => Object.assign({ type: 'g2-l10-mote', r: R.range(0.22, 0.34), streak: R.range(14, 30), orchid: R() < 0.08 }, outside(R, 3.6, 3.0)) },
});

// =====================================================================================================================
// ACT 2: THE TAPROOT. Yori's tunnel rings (30 across: bark, red seams, sap-light between), one every 10-13 m, turned at
// random. The sap-light swells on every beat of the music, so the tunnel breathes with the track.
let segLayers = null, segSap = null;
export const seg = defineDecor({
  name: 'g2-l10-seg',
  init(api) {
    segLayers = modelGroups(MESH.tunnel).map((g) => {
      const mat = g.glow ? new THREE.MeshBasicMaterial({ color: g.color }) : new THREE.MeshStandardMaterial({ color: g.color, metalness: 0.3, roughness: 0.65, flatShading: true, side: THREE.DoubleSide });
      if (g.color === '#d0ffb0') segSap = mat;
      // her seams, dimmed: ring after ring of full red down a tunnel drowns the knots' red bolts (rules 9, 10)
      if (g.color === '#ff3355') mat.color.setHex(0x7a1c2a);
      return new Instanced(api.scene, g.geo, mat, 110);
    });
  },
  begin(api) {
    for (const L of segLayers) L.begin();
    if (segSap) { const p = beatPhase(api), k = Math.exp(-p * 5); segSap.color.setRGB(0.55 + 0.45 * k, 0.75 + 0.25 * k, 0.5 + 0.3 * k); }
  },
  end() { for (const L of segLayers) L.end(); },
  spawn(e, ev) { e.rot = ev.rot || 0; e.s = ev.s || 1; },
  update(e) { tmpQ.setFromEuler(tmpE.set(0, 0, e.rot)); const s = e.s * e.appear; for (const L of segLayers) L.put(0, 0, e.z, tmpQ, s, s, s * 1.3); if (e.z > 30) e.alive = false; },
});
export const tunnel = defineScenery({
  name: 'g2-l10-tunnel',
  stream: { every: [13, 16], place: (R) => ({ type: 'g2-l10-seg', nx: 0, ny: 0, rot: R.range(0, TAU), s: R.range(1.0, 1.06) }) },
});

// =====================================================================================================================
// ACT 3: THE CHAMBER, inside the cage. Six of the canopy roots, three times their size, hang slack overhead round the
// star and turn with it: the star turning beside you and the roots wheeling over you read as you circling it.
export const chamber = defineScenery({
  name: 'g2-l10-chamber',
  ease: 0.5,
  init(api) {
    const g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
    const A = fadeModel(MESH.canopyA), B = fadeModel(MESH.canopyB);
    const mats = A.mats.concat(B.mats);
    for (let i = 0; i < 6; i++) {
      const src = i % 2 ? B : A, m = new THREE.Group();
      for (const c of src.group.children) m.add(new THREE.Mesh(c.geometry, c.material));
      const a = i / 6 * TAU, r = 120;
      m.position.set(Math.cos(a) * r, 46 + (i % 3) * 8, Math.sin(a) * r); m.rotation.set(0, -a + Math.PI / 2, (i % 2 ? 0.25 : -0.2)); m.scale.setScalar(2.6);
      spin.add(m);
    }
    const glow = glowSprite(api, 0xe8ffe0, 160); g.add(glow);
    g.position.set(RM.x, RM.y, RM.z); g.visible = false; api.scene.add(g);
    return { g, spin, mats, glow, a: 0 };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003; if (!s.g.visible) return;
    const b = api.course && api.course.list ? api.course.list.find((e) => e.type === 'boss-body' && e.turn) : null;
    s.a = b ? b.turn.rotation.y : s.a + dt * 0.12;
    s.spin.rotation.y = s.a;
    setOpacity(s.mats, w); s.glow.material.opacity = 0.32 * w;
  },
});

// =====================================================================================================================
// THE RELEASE. The freed star where the Rootmind was: its roots silver and opening, its light breathing out. It holds
// beside you through its first breath, then stays where it is as the flare carries you on past it.
export const freed = defineScenery({
  name: 'g2-l10-freed',
  ease: 0.7,
  init(api) {
    const m = rootmindModel(BOSS.rootFreed);
    const halo = glowSprite(api, 0xd0ffb0, 80), core = glowSprite(api, 0xffffff, 36); m.g.add(halo); m.g.add(core);
    m.g.visible = false; api.scene.add(m.g);
    return Object.assign(m, { halo, core, fixAt: null });
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003; if (!s.g.visible) { s.fixAt = null; return; }
    const kb = sectionK(api, 'breath'), open = clamp(kb < 0 ? 0 : kb > 1 ? 1 : kb, 0, 1);
    // it holds beside you for most of the breath, then stays put in the world: you fly on past it
    let z = RM.z;
    if (kb > 0.7 || kb === 2) { if (s.fixAt === null) s.fixAt = api.G.courseD; z = RM.z + (api.G.courseD - s.fixAt); } else s.fixAt = null;
    s.g.position.set(RM.x, RM.y, z); s.g.scale.setScalar(RM.scale);
    s.body.rotation.z += dt * 0.05;
    for (const rg of s.roots) rg.scale.setScalar(1.15 + 0.35 * smoothstep(0, 1, open));
    const breath = 0.5 + 0.5 * Math.sin(api.time * 1.1);
    setOpacity(s.mats, w);
    s.halo.material.opacity = w * (0.45 + 0.25 * breath); s.halo.scale.setScalar(70 + 40 * open + 10 * breath);
    s.core.material.opacity = w * 0.6;
  },
});

// THE HERD. The Deep you set free, swimming home beside you: three star-whales far out, the Whirlmaw on your left, the
// Snare weaving on your right, a cloud of moths overhead. They keep pace (they move with you), outside the box, and
// after the finish line they swim on ahead.
const SWIM = [
  // what, x, y, z, scale, sway
  ['calf', -150, 46, -460, 9, 1.0], ['calf', 170, 64, -620, 12, 0.7], ['calf', 120, -52, -420, 7, 1.3],
  ['whirlmaw', -62, 16, -190, 1.0, 1.1], ['snare', 50, -18, -150, 1.0, 1.6],
];
export const herd = defineScenery({
  name: 'g2-l10-herd',
  ease: 0.6,
  init(api) {
    const g = new THREE.Group(), all = [], mats = [];
    const RECOL = (c) => c;
    for (const [what, x, y, z, sc, sw] of SWIM) {
      const m = fadeModel(MESH[what], RECOL); m.group.scale.setScalar(sc); m.group.position.set(x, y, z);
      g.add(m.group); mats.push(...m.mats); all.push({ o: m.group, x, y, z, sw, what, ph: x * 0.1 });
    }
    // the moths: a cloud of Yori's freed moths, three times her size, flying as one shape overhead (one instanced mesh)
    const mothMat = fadeMat(modelGroups(MESH.moth)[0].color, true), N_MOTH = 70;
    const moths = new THREE.InstancedMesh(modelGroups(MESH.moth)[0].geo, mothMat, N_MOTH);
    moths.instanceMatrix.setUsage(THREE.DynamicDrawUsage); moths.frustumCulled = false;
    moths.position.set(0, 44, -300); g.add(moths); mats.push(mothMat);
    const light = glowSprite(api, 0xb0ffd0, 260); light.position.set(0, 60, -700); g.add(light);
    g.visible = false; api.scene.add(g);
    return { g, all, mats, moths, light, ahead: 0 };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003; if (!s.g.visible) return;
    const t = api.time;
    // after the finish line they swim on ahead of you
    if (api.G.state === 'clear') s.ahead += dt * 40; else s.ahead = Math.max(0, s.ahead - dt * 40);
    for (const a of s.all) {
      const sway = Math.sin(t * 0.5 * a.sw + a.ph);
      a.o.position.set(a.x + sway * 4 * a.sw, a.y + Math.sin(t * 0.37 * a.sw + a.ph) * 3, a.z - s.ahead);
      a.o.rotation.set(Math.sin(t * 0.4 + a.ph) * 0.05, sway * 0.12, sway * 0.06);
    }
    // the moth cloud breathes between a disc and a wave
    const k = 0.5 + 0.5 * Math.sin(t * 0.35), n = s.moths.count;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU * 3 + t * 0.3, r = 14 + (i % 7) * 3;
      mothP.set(Math.cos(a) * r * (1.2 - 0.4 * k), Math.sin(a * 0.5 + t) * 4 * k + (i % 5) * 1.5, Math.sin(a) * r * 0.6);
      tmpQ.setFromEuler(tmpE.set(0, -a, Math.sin(t * 8 + i) * 0.5));
      s.moths.setMatrixAt(i, mothM.compose(mothP, tmpQ, mothS));
    }
    s.moths.instanceMatrix.needsUpdate = true;
    s.moths.position.z = -300 - s.ahead;
    setOpacity(s.mats, w); s.light.material.opacity = 0.35 * w;
  },
});
