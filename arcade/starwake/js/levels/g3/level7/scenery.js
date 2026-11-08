// THE RIVET LINE's scenery (Yori's look sheet g3-level-07): a dreadnought hull being riveted section by section as you
// fly its length. Her curved hull plates run under the lane as one long deck (rows of studs, a few hot; the unbuilt
// rows still white plan lines), her gantries span the lane one every 60 m or so with two riveters mounted high, arc-blue
// welding light flickers on the plates, and far off to the left the dreadnought itself lies half-riveted, the
// landmark. Nothing here collides; everything stays outside the box. Arc blue is pale and cool, never cyan.
import { THREE, defineScenery, defineDecor, GlowPoints, clamp } from '../../../api.js?v=0.4.1';
import { MESH } from './mesh.js?v=0.4.1';
import { layersOf, begin, end, farModel } from './layers.js?v=0.4.1';

const tmpQ = new THREE.Quaternion(), eul = new THREE.Euler();
export const DECK_Y = -15;   // the hull's crown, well under the lane (a phone's box reaches -5.6)

// ---------------------------------------------------------------- the gantries: a portal over the lane
let gantryL;
export const gantry = defineDecor({
  name: 'g3-l7-gantry', hazard: null,
  sample: { x: 0, y: 1, s: 1 },
  init(api) { gantryL = [layersOf(api, MESH.gantry, 24, { selfLit: 0.12, dead: ['#ff3355'] })]; },
  begin() { begin(gantryL); }, end() { end(gantryL); },
  spawn(e, ev) { e.s = ev.s || 1; e.rz = ev.rz || 0; },
  update(e) {
    tmpQ.setFromEuler(eul.set(0, 0, e.rz));
    const s = e.s * e.appear;
    for (const L of gantryL[0]) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
    if (e.z > 40) e.alive = false;
  },
});
export const gantries = defineScenery({
  name: 'g3-l7-gantries',
  stream: { every: [80, 110], place: (R, api) => (api.tier === 0 && R() < 0.3 ? null : { type: 'g3-l7-gantry', x: R.range(-0.6, 0.6), y: 1.2, s: R.range(0.98, 1.06), rz: R.range(-0.025, 0.025) }) },
});

// ---------------------------------------------------------------- the deck: hull plates under the lane, end to end
const HULLS = ['hullA', 'hullB', 'hullPlan'];
let hullL;
export const hull = defineDecor({
  name: 'g3-l7-hull', hazard: null,
  sample: { x: 0, y: DECK_Y, v: 0 },
  init(api) { hullL = HULLS.map((m) => layersOf(api, MESH[m], 40, { selfLit: 0.08 })); },
  begin() { begin(hullL); }, end() { end(hullL); },
  spawn(e, ev) { e.v = ev.v || 0; e.ry = ev.ry || 0; },
  update(e) {
    tmpQ.setFromEuler(eul.set(0, e.ry, 0));
    const s = e.appear;
    for (const L of hullL[e.v]) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
    if (e.z > 60) e.alive = false;
  },
});
// mostly riveted; more of it still plan in the Assembly Line, where the riveters are building it as you pass
export const deck = defineScenery({
  name: 'g3-l7-deck',
  stream: { every: [27.5, 28], place: (R, api) => { const plan = api.G && api.G.section === 'assembly' ? 0.32 : 0.1, r = R(); return { type: 'g3-l7-hull', x: R.range(-1.5, 1.5), y: DECK_Y, v: r < plan ? 2 : r < plan + 0.3 ? 1 : 0, ry: R() < 0.5 ? 0 : Math.PI }; } },
});
// the far decks either side, lower, so the hull reads as a whole ship's width
export const deckWide = defineScenery({
  name: 'g3-l7-deck-wide',
  stream: { every: [30, 44], place: (R, api) => (api.tier === 0 && R() < 0.5 ? null : { type: 'g3-l7-hull', x: R.sign() * R.range(30, 46), y: DECK_Y - R.range(6, 12), v: R.int(0, 2), ry: R() < 0.5 ? 0.25 : -0.25 }) },
});

// ---------------------------------------------------------------- arc light: welding flashes on the plates
export const arcs = defineScenery({
  name: 'g3-l7-arcs',
  init(api) {
    const L = new GlowPoints(api.scene, 160, api.glowTex).setFar(520, 780);
    const sp = Array.from({ length: 40 }, () => ({ x: 0, y: 0, z: 1, life: 0, max: 1 }));
    return { L, sp };
  },
  update(st, w, dt, api) {
    const { L, sp } = st; L.setScale(api.focalPx || 600); L.begin();
    if (w > 0.003) for (const s of sp) {
      s.z += (api.v || 0) * dt; s.life -= dt;
      if (s.life <= 0 || s.z > 4) { s.x = (Math.random() - 0.5) * 30; s.y = DECK_Y + 0.9; s.z = -40 - Math.random() * 600; s.max = s.life = 0.08 + Math.random() * 0.35; if (Math.random() < 0.3) { s.y = 12.4; s.x = (Math.random() - 0.5) * 34; } }
      const k = s.life / s.max, f = (Math.random() < 0.7 ? 1 : 0.4) * k * w;
      L.push(s.x, s.y, s.z, 2.6, 0.69, 0.85, 1, 0.9 * f); L.push(s.x, s.y, s.z, 0.8, 1, 1, 1, f);
    }
    L.end();
  },
});

// ---------------------------------------------------------------- the landmark: the dreadnought, half riveted
export const dreadnought = defineScenery({
  name: 'g3-l7-dreadnought',
  ease: 0.4,
  init(api) {
    const g = new THREE.Group();
    // her plates at nine times size, end to end down a long curved flank: riveted toward you, still plan at the bow
    for (let i = 0; i < 5; i++) {
      const p = farModel(MESH[i < 3 ? 'hullA' : i < 4 ? 'hullB' : 'hullPlan'], { selfLit: 0.25 });
      p.scale.setScalar(9); p.position.set(0, 0, -i * 240); p.rotation.set(0, 0, 0.9);
      g.add(p);
    }
    g.position.set(-250, -70, -520); g.rotation.y = -0.5;
    api.scene.add(g);
    return { g };
  },
  update(st, w) { for (const p of st.g.children) p.userData.fade(clamp(w, 0, 1) * 0.9); },
});
