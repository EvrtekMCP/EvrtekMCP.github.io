// LEVEL 1 scenery: the gas giant, the derelict's hull floor and its far skyline (0.1.0's backdrop pieces, now
// set pieces that fade by weight instead of switching on and off in a frame), and the streams that keep every
// stretch full (0.2.0, ruling 5).
import { THREE, TX, rng, defineScenery, defineDecor, Instanced, clamp } from '../../api.js?v=0.6.1';

// ---- the gas giant: hangs far off, drifts back very slowly
export const gasGiant = defineScenery({
  name: 'gas-giant',
  init(api) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ map: TX.planet(), fog: false, transparent: true, opacity: 0 });
    const m = new THREE.Mesh(new THREE.SphereGeometry(120, 40, 24), mat); m.rotation.z = 0.35;
    const ringM = new THREE.MeshBasicMaterial({ color: 0xffb0e0, transparent: true, opacity: 0, side: THREE.DoubleSide, fog: false, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(150, 230, 64), ringM); ring.rotation.x = Math.PI / 2 - 0.25; ring.rotation.y = 0.35;
    g.add(m, ring); g.position.set(-240, 90, -820); g.renderOrder = -5; g.visible = false;
    api.scene.add(g);
    return { g, m, mat, ringM };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003;
    s.mat.opacity = w; s.ringM.opacity = 0.22 * w;
    s.g.position.z = -820 + Math.min(api.G.dist * 0.012, 260);
    s.m.rotation.y += dt * 0.01;
  },
});

// ---- the derelict: its hull floor rises into view across the sector and falls away after
export const derelictFloor = defineScenery({
  name: 'derelict-floor',
  ease: 0.5,
  init(api) {
    const t = TX.hullShared();
    t.map.repeat.set(10, 30); t.emissive.repeat.set(10, 30);
    const m = new THREE.MeshLambertMaterial({ map: t.map, emissiveMap: t.emissive, emissive: 0xffffff, emissiveIntensity: 1.4, transparent: true, opacity: 0 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 780), m);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -15, -380); floor.visible = false; floor.renderOrder = -1;
    api.scene.add(floor);
    return { floor, m, t };
  },
  update(s, w, dt, api) {
    s.floor.visible = w > 0.003;
    s.m.opacity = clamp(w * 3, 0, 1);
    s.floor.position.y = -15 - (1 - w) * 60;
    const off = (api.G.dist / 26) % 1;
    s.t.map.offset.y = off; s.t.emissive.offset.y = off;
  },
});

// ---- the far silhouette of the colossus: dark slabs with running lights
export const derelictSkyline = defineScenery({
  name: 'derelict-skyline',
  ease: 1.2,
  init(api) {
    const sil = new THREE.Group();
    const slab = new THREE.MeshLambertMaterial({ color: 0x0b0d16, fog: false, transparent: true, opacity: 0 });
    const R = rng(23);
    for (let i = 0; i < 14; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(R.range(30, 120), R.range(20, 160), R.range(30, 80)), slab);
      b.position.set(R.range(-260, 260), R.range(-60, 40), R.range(-40, 40)); sil.add(b);
    }
    const lm = new THREE.PointsMaterial({ color: 0xff4fd8, size: 3, map: api.glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const lights = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(
      Array.from({ length: 240 }, () => [R.range(-300, 300), R.range(-80, 110), R.range(-20, 60)]).flat(), 3)), lm);
    sil.add(lights);
    sil.position.set(0, -10, -860); sil.visible = false;
    api.scene.add(sil);
    return { sil, slab, lm };
  },
  update(s, w, dt, api) {
    s.sil.visible = w > 0.003;
    s.slab.opacity = w; s.lm.opacity = w;
    // it closes in across the derelict sector and holds there while it fades after (no jump back)
    const hull = api.level.sections.find((q) => q.id === 'hull');
    const k = hull ? clamp((api.G.courseD - hull.d0) / (hull.d1 - hull.d0), 0, 1) : 0;
    s.sil.position.z = -860 + 200 * k;
  },
});

// ---- decor for the streams
const tmpQ = new THREE.Quaternion(), eul = new THREE.Euler();
// a tower of the derelict's superstructure, standing on its floor beside the lane, with a light on top
let towers, towerTips;
export const hullTower = defineDecor({
  name: 'hull-tower',
  init(api) {
    const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
    towers = new Instanced(api.scene, g, new THREE.MeshLambertMaterial({ color: 0x1c2030 }), 120);
    const tg = new THREE.OctahedronGeometry(0.5, 0);
    towerTips = new Instanced(api.scene, tg, new THREE.MeshBasicMaterial({ color: 0xc8a0ff }), 120);
  },
  begin() { towers.begin(); towerTips.begin(); },
  end() { towers.end(); towerTips.end(); },
  spawn(e, ev) { e.w = ev.w; e.h = ev.h; e.dep = ev.dep; },
  update(e, dt, api) {
    const a = e.appear;
    tmpQ.identity();
    towers.put(e.x, -15, e.z, tmpQ, e.w * a, e.h * a, e.dep * a);
    towerTips.put(e.x, -15 + e.h * a + 0.6, e.z, tmpQ, a * 1.4, a * 1.4, a * 1.4);
    if (e.z > 30) e.alive = false;
  },
});
// a beacon pylon of the lightgate field: a thin mast with a soft violet light
let masts, mastTips;
export const beacon = defineDecor({
  name: 'beacon',
  init(api) {
    const g = new THREE.CylinderGeometry(0.25, 0.4, 1, 6); g.translate(0, 0.5, 0);
    masts = new Instanced(api.scene, g, new THREE.MeshLambertMaterial({ color: 0x3a3060, emissive: 0x120830 }), 120);
    mastTips = new Instanced(api.scene, new THREE.IcosahedronGeometry(0.7, 0), new THREE.MeshBasicMaterial({ color: 0xe0c8ff }), 120);
  },
  begin() { masts.begin(); mastTips.begin(); },
  end() { masts.end(); mastTips.end(); },
  spawn(e, ev) { e.h = ev.h; e.base = ev.base; e.spin = Math.random() * 6; },
  update(e, dt, api) {
    const a = e.appear; e.spin += dt;
    tmpQ.setFromEuler(eul.set(0, e.spin, 0));
    masts.put(e.x, e.base, e.z, tmpQ, a, e.h * a, a);
    mastTips.put(e.x, e.base + e.h * a, e.z, tmpQ, a, a, a);
    if (e.z > 30) e.alive = false;
  },
});

// ---- the streams
const side = (R, lo, hi) => R.sign() * R.range(lo, hi);
// drifting crystal spires off to the sides (the obstacle kind, as decor)
export const crystalDrift = defineScenery({
  name: 'crystal-drift',
  stream: { every: [45, 85], place: (R) => ({ type: 'crystal', nx: side(R, 1.6, 4.5), ny: R.range(-2.2, 2.2), r: R.range(2, 5) }) },
});
// big rocks off to the sides
export const rockDrift = defineScenery({
  name: 'rock-drift',
  stream: { every: [30, 60], place: (R) => ({ type: 'rock', nx: side(R, 1.6, 4.5), ny: R.range(-2.5, 2.5), r: R.range(2.5, 7) }) },
});
// the derelict's towers on its floor, both sides
export const hullTowers = defineScenery({
  name: 'hull-towers',
  stream: { every: [28, 50], place: (R) => ({ type: 'hull-tower', x: side(R, 13, 60), y: -15, w: R.range(3, 9), h: R.range(6, 34), dep: R.range(3, 12) }) },
});
// the lightgate field's beacon masts, rising from below and hanging from above
export const beaconField = defineScenery({
  name: 'beacon-field',
  stream: { every: [26, 46], place: (R) => { const up = R() < 0.5; return { type: 'beacon', x: side(R, 12, 45), y: 0, h: R.range(10, 26), base: up ? R.range(-40, -22) : R.range(14, 26) }; } },
});
