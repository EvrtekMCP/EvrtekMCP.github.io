// GALAXY 3, LEVEL 6 scenery: THE FORGERY (Yori's look sheet g3-level-06: the Mint, a dark hall where copies of the Wake
// are stamped out of light; presses, blanks hanging on hooks, weld sparks everywhere; the one level where the magenta is
// the light). Her pieces from g3-scenery.js: mintPress(stroke) (its die apart, so it stamps), blank(), sparks().
// Rule 9: weld magenta (hue 312) is the light here; the only red is the copies of your ship in the presses (forgeries:
// they are the enemy, and red says so) and the turrets' cores.
import { THREE, defineScenery, defineDecor, Instanced, clamp } from '../../../api.js?v=0.4.0';
import { geometryOf } from '../../../enemies/crystal-emitter/parts.js?v=0.4.0';
import { MESH } from './mesh.js?v=0.4.0';
import { meshDecor, matFor, pieceGroup, fadeTo, side } from '../level4/kit.js?v=0.4.0';

const tmpQ = new THREE.Quaternion(), eul = new THREE.Euler();

// ---- decor
// blanks: unpainted copies of the Wake hanging on hooks, in rows
export const blank = meshDecor('g3-l6-blank', [MESH.blank], { cap: 70, keep: 60 });
// weld sparks: bursts of magenta and white bars, turning
export const spark = meshDecor('g3-l6-spark', [MESH.sparks], { cap: 50, keep: 30, spinAxis: 'z' });
// the presses: the frame stands still, the die comes down and up (a stamp every bar of 146 bpm)
let pressL = null, dieL = null;
export const press = defineDecor({
  name: 'g3-l6-press',
  init(api) { pressL = MESH.press.map((g) => new Instanced(api.scene, geometryOf(g), matFor(g), 24)); dieL = MESH.die.map((g) => new Instanced(api.scene, geometryOf(g), matFor(g), 24)); },
  begin() { for (const L of pressL) L.begin(); for (const L of dieL) L.begin(); },
  end() { for (const L of pressL) L.end(); for (const L of dieL) L.end(); },
  spawn(e, ev) { e.s = ev.s || 1; e.ry = ev.ry || 0; e.ph = ev.ph || 0; },
  update(e, dt, api) {
    tmpQ.setFromEuler(eul.set(0, e.ry, 0));
    const s = e.s * e.appear, bar = 240 / 146, k = ((api.time || 0) / bar + e.ph) % 1, stroke = k < 0.18 ? Math.sin(k / 0.18 * Math.PI) : 0;
    for (const L of pressL) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
    for (const L of dieL) L.put(e.x, e.y - stroke * 3 * s, e.z, tmpQ, s, s, s);
    if (e.z > 60) e.alive = false;
  },
});

// ---- streams
export const blanks = defineScenery({
  name: 'g3-l6-blanks',
  stream: { every: [26, 52], place: (R, api) => {
    const b = api.box, s = R.range(1.4, 2.4);
    if (api.tier === 0 && R() < 0.35) return null;
    return { type: 'g3-l6-blank', x: side(R, b.x * 1.6 + 3 * s, b.x * 5), y: R.range(b.y * 1.2, b.y * 3.2), s, ry: R.range(-0.4, 0.4) };
  } },
});
export const presses = defineScenery({
  name: 'g3-l6-presses',
  stream: { every: [60, 120], place: (R, api) => {
    const b = api.box, s = R.range(1.2, 2.0), x = side(R, b.x * 1.6 + 7 * s, b.x * 1.6 + 7 * s + 40), y = R() < 0.5 ? -b.y * 1.4 - 8 * s : R.range(-b.y * 2, b.y * 2);
    const out = [{ type: 'g3-l6-press', x, y, s, ry: R.range(-0.5, 0.5), ph: R() }];
    if (R() < 0.6) out.push({ type: 'g3-l6-spark', x: x - Math.sign(x) * 6 * s, y: y - 3 * s, s: R.range(1, 2), rz: R() * 6, spin: R.range(-2, 2) });
    return out;
  } },
});

// ---- the set piece: THE MINT. A press the size of a cathedral far ahead, stamping on the bar, its weld light flaring
// magenta on every stroke; through the master act it draws in, and the Counterfeit rolls out of it. fog: false.
export const mint = defineScenery({
  name: 'g3-l6-mint',
  ease: 0.35,
  init(api) {
    const g = new THREE.Group(); g.visible = false; g.renderOrder = -3;
    const frame = pieceGroup(MESH.press, { fog: false }), die = pieceGroup(MESH.die, { fog: false });
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff4ad8, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    glow.scale.set(260, 160, 1); glow.position.set(0, 0, 10);
    const box = new THREE.Group(); box.add(frame, die); box.scale.setScalar(16);
    g.add(glow, box); api.scene.add(g);
    return { g, frame, die, glow, box };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003;
    fadeTo(s.frame, w); fadeTo(s.die, w);
    const bar = 240 / 146, k = ((api.time || 0) / bar) % 1, stroke = k < 0.2 ? Math.sin(k / 0.2 * Math.PI) : 0;
    s.die.position.y = -stroke * 3;
    s.glow.material.opacity = w * (0.1 + 0.25 * stroke);
    const L = api.level, p = L ? clamp((api.G.courseD ?? 0) / L.length, 0, 1) : 0;
    s.g.position.set(0, 40 - 30 * p, -2400 + 1400 * p);
  },
});
