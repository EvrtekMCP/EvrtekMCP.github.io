// ANGLER'S DEEP scenery (Yori's look sheet level-g2-08: near-black, readable darkness). Almost nothing is lit but the
// lures, the anglers' red jaw-seams and the green life in the dark. Her pieces (scenery.js, mesh.js here): the abyss
// slope (dark slabs with green motes, the slopes the bloomers grow on) and the lure stalk (the lone lure that opens the
// level, before any angler). THE GREAT LANTERN, the landmark, is her own recipe (greatLantern: her angler at six times
// its size, its lure a star), built here from the angler's parts so it costs no second copy of the mesh.
// Plankton motes, dim bio-green (hue 145, never cyan), drift past all the time (the galaxy's ambient stream).
// Rule 9: her amber ring is left off the stalk, so the only amber in the deep is a ring you can really take.
import { THREE, defineScenery, defineDecor, Instanced, modelGroups, material, GlowPoints, rng, clamp } from '../../../api.js?v=0.5.0';
import { MESH } from './mesh.js?v=0.5.0';
import { buildAngler } from '../../../enemies/g2-angler/index.js?v=0.5.0';

const tmpQ = new THREE.Quaternion(), eul = new THREE.Euler();
const layers = (api, groups, cap, skip = []) => modelGroups(groups).filter((g) => !skip.includes(g.color + (g.glow ? '*' : ''))).map((g) => new Instanced(api.scene, g.geo, material(g.color, g.glow), cap));

// ---------------------------------------------------------------- decor: the abyss slopes, far below and out to the sides
// her slope is a slab about 44 x 6 x 30 with a scatter of green motes over it
let slopeL;
export const abyssSlope = defineDecor({
  name: 'g2-l8-slope',
  init(api) { slopeL = layers(api, MESH.slope, 70); },
  begin() { for (const L of slopeL) L.begin(); },
  end() { for (const L of slopeL) L.end(); },
  spawn(e, ev) { e.s = ev.s || 1; e.ry = ev.ry || 0; e.rz = ev.rz || 0; },
  update(e) {
    tmpQ.setFromEuler(eul.set(0, e.ry, e.rz));
    const s = e.s * e.appear;
    for (const L of slopeL) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
    if (e.z > 50) e.alive = false;
  },
});
// ---------------------------------------------------------------- decor: the lone lure stalk (her lureStalk, its ring left off)
// The stalk rises from the dark below; its tip (5.4 above the stalk's top) is where the level hangs the real ring.
let stalkL;
export const lureStalk = defineDecor({
  name: 'g2-l8-stalk',
  init(api) { stalkL = layers(api, MESH.stalk, 8, ['#ffcc33*']); },
  begin() { for (const L of stalkL) L.begin(); },
  end() { for (const L of stalkL) L.end(); },
  spawn(e) { e.y -= STALK_TIP; },                        // ev.ny is where its tip (the ring) hangs
  update(e) {
    tmpQ.setFromEuler(eul.set(0, e.t * 0.3, Math.sin(e.t * 0.8) * 0.05));
    const s = e.appear;
    for (const L of stalkL) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
    if (e.z > 20) e.alive = false;
  },
});
const STALK_TIP = 5.4;

// ---------------------------------------------------------------- streams
export const slopes = defineScenery({
  name: 'g2-l8-slopes',
  // the floor of the deep, well below the box, and the walls of the trench out to the sides
  stream: { every: [26, 50], place: (R, api) => { const b = api.box, s = R.range(0.8, 1.6); if (api.tier === 0 && R() < 0.35) return null;
    return R() < 0.6 ? { type: 'g2-l8-slope', x: R.range(-b.x * 7, b.x * 7), y: -b.y * 2.8 - 6 * s - R.range(4, 34), s, ry: R.range(0, 6), rz: R.range(-0.15, 0.15) }
      : { type: 'g2-l8-slope', x: R.sign() * (b.x * 1.5 + 24 * s + R.range(4, 50)), y: R.range(-b.y * 2, b.y * 3), s, ry: R.range(0, 6), rz: Math.PI / 2 + R.range(-0.4, 0.4) }; } },
});

// ---------------------------------------------------------------- set piece: plankton motes (the ambient stream)
export const motes = defineScenery({
  name: 'g2-l8-motes',
  ease: 0.8,
  init(api) {
    const N = 220, R = rng(83), P = [];
    for (let i = 0; i < N; i++) P.push({ x: R.range(-70, 70), y: R.range(-30, 40), z: R.range(-760, 0), ph: R.range(0, 6.28), s: R.range(0.25, 0.7) });
    const layer = new GlowPoints(api.scene, N, api.glowTex);
    layer.setFar(420, 760); layer.setScale(api.focalPx || 600);
    return { P, layer };
  },
  update(st, w, dt, api) {
    const L = st.layer; L.setScale(api.focalPx || 600); L.begin();
    if (w > 0.003) {
      const v = api.v || 0, t = api.time || 0, b = api.box;
      for (const p of st.P) {
        p.z += v * dt; p.y += Math.sin(t * 0.4 + p.ph) * dt * 0.4;
        // never inside the flight box: they pass round it
        if (p.z > 8) { p.z -= 760; p.x = (Math.random() - 0.5) * 140; if (Math.abs(p.x) < b.x * 1.5 && Math.abs(p.y) < b.y * 1.4) p.x = Math.sign(p.x || 1) * (b.x * 1.5 + Math.random() * 20); }
        const tw = 0.6 + 0.4 * Math.sin(t * 1.3 + p.ph);
        L.push(p.x, p.y, p.z, p.s * 2.2, 0.35, 0.82, 0.56, 0.5 * tw * w);
      }
    }
    L.end();
  },
});

// ---------------------------------------------------------------- set piece: THE GREAT LANTERN, the landmark
// Far below and ahead: an ancient angler the size of a moon (her angler at x6), its lure a white star. Its jaw-seams
// are its own red; it is too far away, and too far below, to ever be in the lane. It rises toward you as the level goes.
export const greatLantern = defineScenery({
  name: 'g2-l8-lantern',
  ease: 0.35,
  init(api) {
    const g = buildAngler(api), u = g.userData;
    u.crack.group.visible = false; u.glow.material.opacity = 0;
    const mats = [];
    g.traverse((o) => { if (o.material) { o.material.fog = false; o.material.transparent = true; mats.push(o.material); } });
    // the star where her lure's ring would be: 7 up and 67 ahead of the mouth's middle (her greatLantern: geoSphere r 14)
    const star = new THREE.Mesh(new THREE.IcosahedronGeometry(14 / 6, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true }));
    star.position.set(0, 7, -67); g.add(star); mats.push(star.material);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xf0ffc0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    halo.scale.set(60, 60, 1); halo.position.copy(star.position); g.add(halo);
    g.scale.set(6, 6, 6); g.rotation.set(0.35, 0.6, 0);
    // (inside the camera's 1200 m: about 900 m off, 360 m below the lane)
    const root = new THREE.Group(); root.add(g); root.position.set(240, -360, -820); root.renderOrder = -4; root.visible = false;
    api.scene.add(root);
    return { root, mats, halo, t: 0 };
  },
  update(st, w, dt, api) {
    st.root.visible = w > 0.003;
    for (const m of st.mats) m.opacity = w;
    st.t += dt; st.halo.material.opacity = (0.5 + 0.2 * Math.sin(st.t * 1.1)) * w;
    const L = api.level, k = L ? clamp((api.G.courseD ?? 0) / L.length, 0, 1) : 0;
    st.root.position.set(240 - 70 * k, -360 + 110 * k, -820 + 120 * k);
  },
});
