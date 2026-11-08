// GALAXY 2, LEVEL 3, THE DRUMREEF: its pieces, from Yori's look sheet (art-incoming/yori/g2/looks/level-g2-03-the-drumreef.png):
// warm ochre reef against dark water. The landmark is the DRUMREEF itself, a wall of coral the height of a moon: her
// reefCliff, stood either side of the lane as canyon walls (its extruded rock, with her drum corals and coral heads on its
// face, by her own placement loop). Ungrafted drum corals crowd the reef and beat in time with the take (the red
// skins, the thrummers, are the only red, and they are the enemy). The reef's heart is a cathedral of great drums ringing
// the lane, beating on the beat. The reef, the motes and the shafts are Tideway's.
import { THREE, defineDecor, defineScenery, Instanced, modelGroups, rng, clamp, smoothstep } from '../../../api.js?v=0.5.0';
import { MESH } from './mesh.js?v=0.5.0';
import { makeShafts } from '../level1/scenery.js?v=0.5.0';
import { beatNow } from './time.js?v=0.5.0';

export const shafts = makeShafts('g2-l3-shafts', 0xffe8c0, 37);
const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), Sv = new THREE.Vector3();
const lambert = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
const basic = (c) => new THREE.MeshBasicMaterial({ color: c });
const layersOf = (api, model, cap) => modelGroups(model).map((g) => new Instanced(api.scene, g.geo, g.glow ? basic(g.color) : lambert(g.color), cap));
// a beat's swell: 1 on the beat, falling over a third of a beat (every `every` beats)
const kick = (api, every = 1) => { const b = beatNow(api) / every, f = b - Math.floor(b); return f < 0.33 ? 1 - f / 0.33 : 0; };

// ---- DRUM CORALS (her drumCoral, ungrafted ochre drums): on the reef beside the lane; they swell on the kick
let drumL;
export const drumCoral = defineDecor({
  name: 'g2-l3-drum',
  sample: { s: 1, v: 0 },
  init(api) { drumL = [layersOf(api, MESH.drumA, 160), layersOf(api, MESH.drumB, 160)]; },
  begin() { for (const v of drumL) for (const L of v) L.begin(); },
  end() { for (const v of drumL) for (const L of v) L.end(); },
  spawn(e, ev) { e.s = ev.s || 2; e.v = ev.v || 0; e.q = new THREE.Quaternion().setFromEuler(tmpE.set(ev.rx || 0, ev.ry || 0, ev.rz || 0)); },
  update(e, dt, api) {
    const s = e.s * e.appear * (1 + 0.06 * kick(api));
    for (const L of drumL[e.v]) L.put(e.x, e.y, e.z, e.q, s, s, s);
    if (e.z > 40) e.alive = false;
  },
});

// ---- THE REEF CLIFF (her reefCliff(37, 60, 40) at x3: 180 m of wall, 120 m tall): its rock, and on its face her six drum
// corals and four coral heads where her loop put them. side 1: the right wall (its face turned to the lane), -1: the left.
let cliffL, cliffDrumL, cliffHeadL;
export const cliff = defineDecor({
  name: 'g2-l3-cliff',
  sample: { side: 1, s: 1 },
  init(api) {
    cliffL = layersOf(api, MESH.cliffRock, 30);
    cliffDrumL = [layersOf(api, MESH.drumA, 120), layersOf(api, MESH.drumB, 120)];
    cliffHeadL = [layersOf(api, MESH.coralA, 80), layersOf(api, MESH.coralB, 80)];
  },
  begin() { for (const L of cliffL) L.begin(); for (const v of cliffDrumL) for (const L of v) L.begin(); for (const v of cliffHeadL) for (const L of v) L.begin(); },
  end() { for (const L of cliffL) L.end(); for (const v of cliffDrumL) for (const L of v) L.end(); for (const v of cliffHeadL) for (const L of v) L.end(); },
  spawn(e, ev) { e.s = ev.s || 3; e.side = ev.side || 1; e.q = new THREE.Quaternion().setFromAxisAngle(Sv.set(0, 1, 0), e.side > 0 ? Math.PI : 0); },
  update(e, dt, api) {
    // it is hundreds of metres long, so it grows in with time since it was born as well as with distance (a boss's
    // rule): by distance alone it would jump from nothing to several pixels in one long frame
    const born = Math.min(1, e.t / 2.5), s = e.s * e.appear * born * born, k = 1 + 0.05 * kick(api, 2);
    for (const L of cliffL) L.put(e.x, e.y, e.z, e.q, s, s, s);
    // her placements are in the cliff's own frame (face toward +x); turned for the right wall
    const put = (layers, x, y, z, sc) => { P.set(x * s, y * s, z * s).applyQuaternion(e.q); for (const L of layers) L.put(e.x + P.x, e.y + P.y, e.z + P.z, e.q, sc, sc, sc); };
    for (const d of MESH.cliffDrums) put(cliffDrumL[d[0]], d[1], d[2], d[3], d[4] * s * k);
    for (const h of MESH.cliffHeads) put(cliffHeadL[h[0]], h[1], h[2], h[3], h[4] * s);
    if (e.z > 400) e.alive = false;
  },
});

// ---- streams
export const drums = defineScenery({
  name: 'g2-l3-drums',
  stream: { every: [24, 48], place: (R, api) => { const sd = R.sign(); return { type: 'g2-l3-drum', x: sd * (api.box.x * 2.6 + R.range(6, 34)), y: R.range(-api.box.y * 2.4, api.box.y * 0.8), s: R.range(1.3, 2.3), v: R.int(0, 1), rz: -sd * R.range(0.9, 1.4), rx: R.range(-0.3, 0.3) }; } },
});
// THE DRUMREEF itself: one wall of coral the height of a moon, far off the lane's left (her cliff at x9-12: 550-700 m tall),
// running on as one wall (each piece is 540-720 m long, one every 420-560 m), hazed by the deep
export const cliffs = defineScenery({
  name: 'g2-l3-cliffs',
  stream: { every: [420, 560], place: (R, api) => ({ type: 'g2-l3-cliff', x: -(api.box.x * 1.55 + R.range(240, 290)), y: R.range(-120, -60), side: -1, s: R.range(9, 12), dz: R.range(-40, 40) }) },
});

// ---- THE REEF'S HEART: a cathedral of great drums ringing the lane far ahead, beating on every beat (the master)
export const heart = defineScenery({
  name: 'g2-l3-heart', ease: 0.5,
  init(api) {
    const g = new THREE.Group(), R = rng(303), mats = [], items = [];
    const mk = (gr) => { const m = gr.glow ? new THREE.MeshBasicMaterial({ color: gr.color, transparent: true, opacity: 0, fog: false }) : new THREE.MeshLambertMaterial({ color: gr.color, flatShading: true, transparent: true, opacity: 0, fog: false }); mats.push(m); return m; };
    const groupsA = modelGroups(MESH.drumA), groupsB = modelGroups(MESH.drumB);
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2, r = R.range(170, 230), s = R.range(16, 26), d = new THREE.Group();
      for (const gr of (i % 2 ? groupsA : groupsB)) d.add(new THREE.Mesh(gr.geo, mk(gr)));
      d.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.8, -R.range(0, 260)); d.scale.setScalar(s);
      d.quaternion.setFromUnitVectors(Sv.set(0, 1, 0), P.set(-Math.cos(a), -Math.sin(a), 0.4).normalize());
      g.add(d); items.push({ d, s, ph: i % 4 });
    }
    g.position.set(0, 0, -1100); g.visible = false; g.renderOrder = -4; api.scene.add(g);
    return { g, mats, items };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003;
    for (const m of s.mats) m.opacity = w;
    const b = beatNow(api);
    for (const it of s.items) { const f = (b + it.ph * 0.25) % 1, k = f < 0.3 ? 1 - f / 0.3 : 0; it.d.scale.setScalar(it.s * (1 + 0.08 * k)); }
  },
});
export { clamp, smoothstep };
