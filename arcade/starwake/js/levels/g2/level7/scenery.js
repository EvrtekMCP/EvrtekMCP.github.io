// BLOOMFALL scenery (Yori's look sheet level-g2-07: orchid pink and white, the one warm-pink level; palettes.js).
// Her pieces from scenery.js (mesh.js here): the nebula flower (the landmark: a flower-nebula, orchid and white, that
// opens and closes like a slow anemone), the meadow wall (a jade coral slab grown over with orchid flowers) and her
// petal drift. Plus THE MEADOW's one obstacle: her meadow walls turned in along the lane so they make a corridor, and
// dodging a fan wide is no longer an answer (the plan's twist: roll it in its middle).
// Rule 9: orchid, pale orchid, jade and white. The seeds are the only red here, and they hurt.
import { THREE, defineScenery, defineDecor, defineObstacle, Instanced, modelGroups, material, clamp } from '../../../api.js?v=0.4.0';
import { MESH } from './mesh.js?v=0.4.0';
import { morphModel, setMorph } from '../../../enemies/g2-bloomer/morph.js?v=0.4.0';

const tmpQ = new THREE.Quaternion(), eul = new THREE.Euler();
const side = (R) => R.sign();
// her pieces as instanced layers, one per colour group (lit ones take the game's material spec, glowing ones unlit)
const layers = (api, groups, cap) => modelGroups(groups).map((g) => new Instanced(api.scene, g.geo, material(g.color, g.glow), cap));

// ---------------------------------------------------------------- decor: petal clusters drifting past, far out
// her petalDrift(10): ten petals in a loose cloud about 32 x 21 x 45 m; each cluster turns slowly as it goes by
let petalL;
export const petalCluster = defineDecor({
  name: 'g2-l7-petal',
  init(api) { petalL = layers(api, MESH.petals, 60); },
  begin() { for (const L of petalL) L.begin(); },
  end() { for (const L of petalL) L.end(); },
  spawn(e, ev) { e.s = ev.s || 1; e.ry = ev.ry || 0; e.rx = ev.rx || 0; e.spin = ev.spin || 0.2; },
  update(e, dt) {
    e.ry += e.spin * dt; e.y += dt * 0.6;
    tmpQ.setFromEuler(eul.set(e.rx, e.ry, 0));
    const s = e.s * e.appear;
    for (const L of petalL) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
    if (e.z > 60) e.alive = false;
  },
});
// ---------------------------------------------------------------- decor: meadow walls, banks of flowering coral both sides
// her meadow wall is 31 wide, 24 tall and its flowers face -z: turned a quarter (ry) its flowers face the lane
let bankL;
export const meadowBank = defineDecor({
  name: 'g2-l7-bank',
  init(api) { bankL = layers(api, MESH.meadow, 60); },
  begin() { for (const L of bankL) L.begin(); },
  end() { for (const L of bankL) L.end(); },
  spawn(e, ev) { e.s = ev.s || 1; e.ry = ev.ry ?? Math.PI / 2; e.rz = ev.rz || 0; },
  update(e) {
    tmpQ.setFromEuler(eul.set(0, e.ry, e.rz));
    const s = e.s * e.appear;
    for (const L of bankL) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
    if (e.z > 40) e.alive = false;
  },
});

// ---------------------------------------------------------------- THE MEADOW's walls (the obstacle)
// One wall piece: her meadow wall at 0.6, turned so its flowers face the lane, its flower tips at the corridor's edge.
// side: +1 right, -1 left. edge: the corridor's half-width in metres (the level gives it from the box). A piece is
// 18 m long; the level lays them every 16 m so the wall is continuous. Flying past the edge is a hit; near it, CLOSE.
const WALL_S = 0.6, TIP = 6.4 * WALL_S, HALF_L = 15 * WALL_S;
let wallL;
export const meadowWall = defineObstacle({
  name: 'g2-l7-wall',
  hazard: { cls: 'static', introduced: [2, 7] },
  sample: { side: 1, edge: 3 },
  // 0.3.1, no fully blocked moment: solid past its flowers' tips (and the half metre a hit allows), the corridor between
  // the two sides is the way through (it is the same edge the wall is laid on: the box's own, never under 2.6 m)
  solid: (ev, box) => { const side = ev.side || 1, edge = ev.edge || Math.max(2.6, box.x * 0.35); return [{ dist: (x) => edge + 0.5 - side * x }]; },
  init(api) { wallL = layers(api, MESH.meadow, 160); },             // (two pieces every 16 m: up to ~100 alive at once)
  begin() { for (const L of wallL) L.begin(); },
  end() { for (const L of wallL) L.end(); },
  spawn(e, ev, api) { e.side = ev.side || 1; e.edge = ev.edge || Math.max(2.6, api.box.x * 0.35); e.x = e.side * (e.edge + TIP); e.y = ev.ny ? ev.ny * api.box.y : 0; e.hit = false; e.close = false; },
  update(e, dt, api) {
    tmpQ.setFromEuler(eul.set(0, e.side * Math.PI / 2, 0));
    const s = WALL_S * e.appear;
    for (const L of wallL) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
    // alongside: the ship past the flowers' tips is a hit; within 1.4 m of them, a close call
    if (Math.abs(e.z) < HALF_L && !e.hit) {
      const into = e.side * api.ship.x - e.edge;
      if (into > 0.5) { e.hit = true; api.game.crash(e, 14, true); }
      else if (into > -1.4 && !e.close && Math.abs(e.z) < 2) { e.close = true; api.game.scrape(e, -into); }
    }
    if (e.z > 30) e.alive = false;
  },
  // the bots keep inside the corridor: circles just past the edge, top to bottom
  avoid(e) { const out = []; for (let y = -6; y <= 6; y += 2) out.push({ x: e.side * (e.edge + 2.6), y, r: 3.6 }); return out; },
});

// ---------------------------------------------------------------- streams
export const petals = defineScenery({
  name: 'g2-l7-petals',
  // a cluster reaches 18 m from its middle: its near edge stays outside the box
  stream: { every: [40, 80], place: (R, api) => { const b = api.box; if (api.tier === 0 && R() < 0.35) return null; return { type: 'g2-l7-petal', x: side(R) * (b.x * 1.5 + 20 + R.range(0, 40)), y: R.range(-b.y * 2, b.y * 4), s: R.range(0.8, 1.4), ry: R.range(0, 6), rx: R.range(-0.4, 0.4), spin: R.range(-0.3, 0.3) }; } },
});
export const banks = defineScenery({
  name: 'g2-l7-banks',
  // a wall reaches 6.4 x its scale toward the lane and 16 x its scale along it
  stream: { every: [55, 100], place: (R, api) => { const b = api.box, s = R.range(0.55, 1.0), sd = side(R); if (api.tier === 0 && R() < 0.3) return null; return { type: 'g2-l7-bank', x: sd * (b.x * 1.5 + 7 * s + R.range(30, 70)), y: R.range(-b.y * 3.5, b.y * 0.5), s, ry: sd * Math.PI / 2, rz: R.range(-0.15, 0.15) }; } },
});

// ---------------------------------------------------------------- set piece: the flower-nebula, the landmark
// her nebulaFlower(80) at 4x: a flower a kilometre across, far ahead and above, opening and closing like a slow
// anemone (one breath every 12 s). It comes a little closer as the level goes on, and opens wide on the Full Bloom.
export const flowerNebula = defineScenery({
  name: 'g2-l7-flower',
  ease: 0.35,
  init(api) {
    const m = morphModel(MESH.flowerShut, MESH.flowerOpen);
    for (const x of m.meshes) { x.mesh.material.fog = false; x.mesh.material.depthWrite = false; }
    const g = new THREE.Group(); g.add(m.group); g.scale.setScalar(4); g.rotation.set(1.05, 0, 0.25);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xd070ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    halo.scale.set(900, 900, 1); halo.position.set(0, 20, 0);
    // (inside the camera's 1200 m far plane: about a kilometre off, up and to the left)
    const root = new THREE.Group(); root.add(halo, g); root.position.set(-230, 190, -900); root.renderOrder = -4; root.visible = false;
    api.scene.add(root);
    return { root, m, halo, t: 0 };
  },
  update(st, w, dt, api) {
    st.root.visible = w > 0.003;
    for (const x of st.m.meshes) x.mesh.material.opacity = w * 0.85;
    st.halo.material.opacity = 0.12 * w;
    st.t += dt;
    const L = api.level, k = L ? clamp((api.G.courseD ?? 0) / L.length, 0, 1) : 0;
    // a slow breath, and wider open toward the end (the Full Bloom)
    setMorph(st.m, clamp(0.25 + 0.35 * (0.5 - 0.5 * Math.cos(st.t * Math.PI * 2 / 12)) + 0.4 * k, 0, 1));
    st.root.position.z = -900 + 200 * k; st.root.rotation.y = Math.sin(st.t * 0.05) * 0.1;
  },
});
