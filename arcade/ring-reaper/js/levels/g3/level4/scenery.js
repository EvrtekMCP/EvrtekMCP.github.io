// GALAXY 3, LEVEL 4 scenery: THE AUGURY (Yori's look sheet g3-level-04: a clockwork model of a galaxy turning around
// you; thin orchid rings and arms against deep indigo, small worlds on their ends, prism pylons, quiet and exact,
// everything moving in arcs). Her signature pieces from g3-scenery.js: orreryRing(r), orreryHub(), prismPylon(h).
// Rule 9: no red, amber or cyan anywhere as large flat colour; the hollow red rings in the air are the augurs' (they hurt).
import { THREE, defineScenery, clamp } from '../../../api.js?v=0.6.4';
import { MESH } from './mesh.js?v=0.6.4';
import { meshDecor, pieceGroup, fadeTo, side } from './kit.js?v=0.6.4';

// ---- decor
// the prism pylons: Yori's graphite column with a lilac prism on top; they stand in rows beside and below the lane,
// and a sniper perches on one (the level lays a pylon under each sniper)
export const pylon = meshDecor('g3-l4-pylon', [MESH.pylon], { cap: 80, keep: 60 });
// small orrery rings: worlds on their arms, turning slowly, far out beside the lane
export const smallOrrery = meshDecor('g3-l4-orbit', [MESH.ring40], { cap: 16, keep: 120, spinAxis: 'z' });

// ---- streams (every section has one: the view never goes blank)
// pylons: rows beside the lane (|x| > 1.8 box) and a few below it, standing on nothing (the whole level hangs in space)
export const pylons = defineScenery({
  name: 'g3-l4-pylons',
  stream: { every: [36, 70], place: (R, api) => {
    const b = api.box, s = R.range(0.7, 1.4);
    if (api.tier === 0 && R() < 0.35) return null;
    if (R() < 0.3) return { type: 'g3-l4-pylon', x: R.range(-b.x * 3, b.x * 3), y: -b.y * 1.6 - 16 * s - R.range(0, 30), s };
    return { type: 'g3-l4-pylon', x: side(R, b.x * 1.8 + 2 * s, b.x * 7), y: R.range(-b.y * 3, b.y * 1.2), s };
  } },
});
// far orbits: an orrery ring with its worlds, tilted, slowly turning, 50-140 m out to the side
export const orbits = defineScenery({
  name: 'g3-l4-orbits',
  stream: { every: [240, 420], place: (R, api) => {
    const b = api.box, s = R.range(0.5, 1.1);
    if (api.tier === 0 && R() < 0.5) return null;
    return { type: 'g3-l4-orbit', x: side(R, b.x * 2 + 44 * s, b.x * 2 + 130), y: R.range(-b.y * 6, b.y * 9), s, rx: R.range(0.6, 1.4), ry: R.range(-0.8, 0.8), rz: R() * 6, spin: R.range(-0.25, 0.25) };
  } },
});

// ---- the set piece: THE ORRERY. A clockwork model of a galaxy: a graphite hub with a lilac-white heart, and two great
// rings with their worlds turning round the lane on tilted axes. All level it hangs far ahead; in the master act
// (weight up to 1) it draws in until its rings sweep round you. fog: false, and it fades by its weight.
export const orrery = defineScenery({
  name: 'g3-l4-orrery',
  ease: 0.35,
  init(api) {
    const g = new THREE.Group(); g.visible = false; g.renderOrder = -3;
    const hub = pieceGroup(MESH.hub, { fog: false }); hub.scale.setScalar(5);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xd8c8ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    halo.scale.set(140, 140, 1);
    const rA = pieceGroup(MESH.ring110, { fog: false }), rB = pieceGroup(MESH.ring70, { fog: false });
    const aA = new THREE.Group(), aB = new THREE.Group(); aA.add(rA); aB.add(rB);
    g.add(halo, hub, aA, aB);
    api.scene.add(g);
    return { g, hub, halo, rA, rB, aA, aB, t: 0 };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003;
    s.t += dt;
    for (const p of [s.hub, s.rA, s.rB]) fadeTo(p, w);
    s.halo.material.opacity = 0.22 * w;
    // how far into the level: it draws in through the master act (weight 1 there)
    const L = api.level, k = L ? clamp((api.G.courseD ?? 0) / L.length, 0, 1) : 0, near = clamp((k - 0.68) / 0.18, 0, 1);
    s.g.position.set(0, 60 - 50 * near, -1300 + 950 * near);
    // the rings turn on tilted axes (orchid arcs sweeping round the lane once it is near)
    s.aA.rotation.set(1.1 - 0.5 * near, 0.2, 0); s.rA.rotation.z = s.t * 0.07; s.rA.scale.setScalar(1 + 1.4 * near);
    s.aB.rotation.set(-0.7 + 0.3 * near, 0.6, 0); s.rB.rotation.z = -s.t * 0.11; s.rB.scale.setScalar(1 + 0.9 * near);
    s.hub.rotation.y = s.t * 0.05;
  },
});
