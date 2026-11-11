// GRAVITY GARDEN's scenery (ruling 5; rule 22). Yori's look (looks/level-g2-05-gravity-garden.png): a collapsed
// star's garden, violet and pearl, with black holes in it; dark pearls with lensing rings, stars warping behind the
// wells. Everything here is outside the flight box and never solid; only the course's wells pull.
//  - g2-l5-motes:    the Deep's motes, violet and green (the galaxy's ambient stream, level 4's kind)
//  - g2-l5-pearls:   her garden pearls, small dark spheres in pale rings, drifting round the lane
//  - g2-l5-farwells: wells far out to the sides, big and still: the garden itself (scenery: no pull, no bend)
//  - g2-l5-disc:     the landmark: the collapsed star, a violet-white accretion disc seen nearly edge-on (not amber,
//                    not red); it swells toward the end, where THE DROP flies its rim
import { THREE, defineScenery, defineDecor, Instanced, modelGroups, material, rng } from '../../../api.js?v=0.6.2';
import { MESH } from './mesh.js?v=0.6.2';
import { moteStream, motes as moteKind } from '../level4/scenery.js?v=0.6.2';

const q = new THREE.Quaternion(), eul = new THREE.Euler();
export const motes = moteStream('g2-l5-motes', 0xc090ff, 0x9affc0);

// ---- garden pearls
let pearlL = null;
export const pearl = defineDecor({
  name: 'g2-l5-pearl', hazard: null, sample: { r: 1 },
  init(api) { if (!pearlL) pearlL = [MESH.pearlA, MESH.pearlB].map((m) => modelGroups(m).map((g) => new Instanced(api.scene, g.geo, material(g.color, g.glow), 90))); },
  begin() { for (const v of pearlL) for (const L of v) L.begin(); },
  end() { for (const v of pearlL) for (const L of v) L.end(); },
  spawn(e, ev) { e.r = ev.r || 1; e.v = e.id % 2; e.q = new THREE.Quaternion().setFromEuler(eul.set(Math.random() * 0.6 - 0.3, Math.random() * 6, Math.random() * 0.6 - 0.3)); e.ph = Math.random() * 6; },
  update(e) {
    const s = e.r * e.appear;
    for (const L of pearlL[e.v]) L.put(e.x, e.y + Math.sin(e.t * 0.7 + e.ph) * 0.4, e.z, e.q, s, s, s);
    if (e.z > 40) e.alive = false;
  },
});
export const pearls = defineScenery({
  name: 'g2-l5-pearls',
  stream: { every: [45, 110], place: (R, api) => { const B = api.box, a = R.range(0, Math.PI * 2), rr = R.range(1.9, 5); return { type: 'g2-l5-pearl', x: Math.cos(a) * B.x * rr, y: Math.sin(a) * B.y * rr * 1.2, r: R.range(1, 2.6) }; } },
});

// ---- far wells: the garden's other black holes, big and still, far to the sides
let farL = null;
export const farWell = defineDecor({
  name: 'g2-l5-farwell', hazard: null, sample: { r: 3 },
  init(api) { if (!farL) farL = modelGroups(MESH.farWell).map((g) => new Instanced(api.scene, g.geo, material(g.color, g.glow), 30)); },
  begin() { for (const L of farL) L.begin(); }, end() { for (const L of farL) L.end(); },
  spawn(e, ev) { e.r = ev.r || 3; e.spin = Math.random() * 6; },
  update(e, dt) {
    e.spin += dt * 0.25;
    q.setFromEuler(eul.set(0, 0, e.spin));
    const s = e.r * e.appear;
    for (const L of farL) L.put(e.x, e.y, e.z, q, s, s, s);
    if (e.z > 80) e.alive = false;
  },
});
export const farWells = defineScenery({
  name: 'g2-l5-farwells',
  stream: { every: [220, 420], place: (R, api) => { const B = api.box; return { type: 'g2-l5-farwell', x: R.sign() * R.range(B.x * 6, B.x * 13), y: R.range(-B.y * 5, B.y * 7), r: R.range(2.5, 5) }; } },
});

// ---- the landmark: the collapsed star (her accretionDisc(60), 120 across) blown up to fill the far sky, nearly
// edge-on, turning slowly. Its weight swells it toward the end of the level (THE DROP).
export const disc = defineScenery({
  name: 'g2-l5-disc',
  ease: 0.35,
  init(api) {
    const g = new THREE.Group(), mats = [];
    for (const grp of modelGroups(MESH.disc)) { const m = material(grp.color, grp.glow, true); m.transparent = true; m.opacity = 0; m.fog = false; m.depthWrite = false; mats.push(m); g.add(new THREE.Mesh(grp.geo, m)); }
    const R = rng(505);
    g.position.set(260, 150, -1050); g.rotation.set(0.32, 0.4, 0.18); g.renderOrder = -4; g.visible = false;
    api.scene.add(g);
    return { g, mats, spin: R() * 6 };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003;
    for (const m of s.mats) m.opacity = 0.62 * Math.min(1, w);
    s.spin += dt * 0.05;
    s.g.children.forEach((c, i) => { c.rotation.y = s.spin * (1 + i * 0.15); });
    s.g.scale.setScalar(3.2 + 1.6 * Math.max(0, w - 1));   // a weight over 1 swells it (THE DROP)
  },
});

export const SCENERY = [motes, pearls, farWells, disc];
export const DECOR = [moteKind, pearl, farWell];
