// THE VAULT's scenery (Yori's look sheet g3-level-09): the Treasury, a hall of sealed drums. Her bulb columns stand
// either side of the lane like the hall's lamps, her treasury walls (three vault fronts set into graphite, a marquee
// strip along the top) line it further out, and the High Roller's wheel hangs lit on the horizon the whole level, the
// landmark: built from the boss's own parts, so it is the same wheel that flies in at the end. It lights up in the calm
// before the fight and goes as the real one comes out of the haze. Warm white bulbs, never amber: only the rings are.
// Nothing here collides; everything stays outside the box.
import { THREE, defineScenery, defineDecor, clamp } from '../../../api.js?v=0.5.0';
import { MESH } from './mesh.js?v=0.5.0';
import { MESH as WHEEL } from '../../../bosses/g3-high-roller/mesh.js?v=0.5.0';
import { layersOf, begin, end, farModel } from '../level7/layers.js?v=0.5.0';

const tmpQ = new THREE.Quaternion(), eul = new THREE.Euler();

// ---------------------------------------------------------------- the hall's lamps: a bulb column either side
let colL;
export const column = defineDecor({
  name: 'g3-l9-column', hazard: null,
  sample: { x: 14, y: 0 },
  init(api) { colL = [layersOf(api, MESH.column, 60, { selfLit: 0.15 })]; },
  begin() { begin(colL); }, end() { end(colL); },
  spawn(e, ev) { e.s = ev.s || 1; },
  update(e) {
    tmpQ.identity(); const s = e.s * e.appear;
    for (const L of colL[0]) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
    if (e.z > 40) e.alive = false;
  },
});
// a column is 2 across: stood just outside the box (|x| > 1.5 box), in pairs, every 32-50 m
export const columns = defineScenery({
  name: 'g3-l9-columns',
  stream: { every: [32, 50], place: (R, api) => { const b = api.box; return { type: 'g3-l9-column', x: R.sign() * (b.x * 1.5 + R.range(2, 9)), y: R.range(-1, 2), s: R.range(0.95, 1.15) }; } },
});

// ---------------------------------------------------------------- the treasury walls, set back either side, facing the lane
let wallL;
export const treasury = defineDecor({
  name: 'g3-l9-treasury', hazard: null,
  sample: { x: 40, y: 0, ry: 1.57 },
  init(api) { wallL = [layersOf(api, MESH.treasury, 30, { selfLit: 0.12 })]; },
  begin() { begin(wallL); }, end() { end(wallL); },
  spawn(e, ev) { e.ry = ev.ry || 0; e.s = ev.s || 1; },
  update(e) {
    tmpQ.setFromEuler(eul.set(0, e.ry, 0)); const s = e.s * e.appear;
    for (const L of wallL[0]) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
    if (e.z > 60) e.alive = false;
  },
});
// her wall faces -Z; turned a quarter it faces across the lane: a left wall (x < 0) turns -90 degrees so its front
// faces +x, a right wall +90 so it faces -x (a turn about Y by a sends her -Z front to (-sin a, 0, -cos a))
export const treasuryHall = defineScenery({
  name: 'g3-l9-treasury-hall',
  stream: { every: [48, 80], place: (R, api) => { const b = api.box, sgn = R.sign(); if (api.tier === 0 && R() < 0.4) return null; return { type: 'g3-l9-treasury', x: sgn * (b.x * 1.5 + R.range(14, 26)), y: R.range(-3, 5), ry: sgn * Math.PI / 2, s: R.range(0.95, 1.2) }; } },
});

// ---------------------------------------------------------------- the landmark: the High Roller's wheel on the horizon
export const wheel = defineScenery({
  name: 'g3-l9-wheel',
  ease: 0.4,
  init(api) {
    const g = new THREE.Group(), flip = new THREE.Group(); flip.rotation.y = Math.PI; g.add(flip);
    const parts = [farModel(WHEEL.rim, { selfLit: 0.4 }), farModel(WHEEL.spokes, { selfLit: 0.3 })];
    const spin = new THREE.Group(); flip.add(spin);
    // its segments as Yori's horizon wheel shows them: two paying amber, two firing red, the rest dark
    const states = [1, 0, 0, 2, 0, 0, 1, 0, 0, 2, 0, 0];
    for (let i = 0; i < 12; i++) { const s = farModel(WHEEL['seg' + states[i]], { selfLit: 0.3 }); s.rotation.z = i / 12 * Math.PI * 2; spin.add(s); parts.push(s); }
    const hub = farModel(WHEEL.hub0, { selfLit: 0.4 }); parts.push(hub);
    for (const p of parts) if (p.parent !== spin) flip.add(p);
    g.scale.setScalar(7); g.position.set(0, 120, -1000);
    api.scene.add(g);
    return { g, spin, parts, gone: 0, lit: 0 };
  },
  update(st, w, dt, api) {
    const G = api.G || {};
    // it lights up in the calm before the fight; it goes as the real one comes out of the haze
    st.lit = clamp(st.lit + (G.section === 'lights' ? dt : -dt) * 0.5, 0, 1);
    st.gone = clamp(st.gone + (G.hold ? dt : -dt) * 0.6, 0, 1);
    st.spin.rotation.z += dt * (0.08 + 0.3 * st.lit);
    const k = clamp(w, 0, 1) * (0.55 + 0.45 * st.lit) * (1 - st.gone);
    for (const p of st.parts) p.userData.fade(k);
  },
});
