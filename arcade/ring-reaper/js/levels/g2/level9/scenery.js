// THE MURMURATION scenery (Yori's look sheet level-g2-09: pearl and lavender, the one pale level; out of the dark into
// light). Her drift lights (driftLights: a scattered flock, pearl motes) stream past outside the box all the time (the
// galaxy's ambient stream), and THE GREAT WHEEL, the set piece in the sky: a flock the size of the sky turning like a
// wheel, laid out by her greatWheel rule (eight spokes, about four in ten of the moths on the rim) from her own moth,
// instanced so it flaps and turns. The Murmur rises out of it. (The plan's other landmark, a pale nebula shaped like a
// pair of wings, is not among her pieces yet: the sky's own pearl gas stands in for it. A note for Yori.)
// Rule 9: pearl and lavender only. The one red point in the sky is a conductor, and it hurts.
import { THREE, defineScenery, defineDecor, Instanced, modelGroups, material, rng, clamp } from '../../../api.js?v=0.6.4';
import { MESH } from './mesh.js?v=0.6.4';
import { MESH as MOTHS } from '../../../enemies/g2-flock/mesh.js?v=0.6.4';

const tmpQ = new THREE.Quaternion(), eul = new THREE.Euler();

// ---------------------------------------------------------------- decor: drifting lights, outside the box
let lightL;
export const driftLights = defineDecor({
  name: 'g2-l9-lights',
  init(api) { lightL = modelGroups(MESH.lights).map((g) => new Instanced(api.scene, g.geo, material(g.color, g.glow), 70)); },
  begin() { for (const L of lightL) L.begin(); },
  end() { for (const L of lightL) L.end(); },
  spawn(e, ev) { e.s = ev.s || 1; e.ry = ev.ry || 0; },
  update(e, dt) {
    e.ry += dt * 0.05; e.y += dt * 0.5;
    tmpQ.setFromEuler(eul.set(0, e.ry, 0));
    const s = e.s * e.appear;
    for (const L of lightL) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
    if (e.z > 50) e.alive = false;
  },
});
export const lights = defineScenery({
  name: 'g2-l9-lights',
  // a cluster reaches 20 m from its middle across and 12 up and down: its near edge stays outside the box
  stream: { every: [30, 60], place: (R, api) => { const b = api.box; if (api.tier === 0 && R() < 0.35) return null; const sd = R.sign(); return R() < 0.7 ? { type: 'g2-l9-lights', x: sd * (b.x * 1.5 + 21 + R.range(0, 40)), y: R.range(-b.y * 3, b.y * 4), s: R.range(0.8, 1.5), ry: R.range(0, 6) } : { type: 'g2-l9-lights', x: R.range(-b.x * 4, b.x * 4), y: b.y * 1.4 + 13 + R.range(0, 30), s: R.range(0.8, 1.5), ry: R.range(0, 6) }; } },
});

// ---------------------------------------------------------------- set piece: THE GREAT WHEEL in the sky
// Her rule (greatWheel(n, r)): n moths on 8 spokes, 4 in 10 out on the rim; here 640 of them, r 300, about 950 m ahead and
// high, turning slowly (faster on the drop), each moth eight times her size so it reads at that distance. No fog on it.
export const greatWheel = defineScenery({
  name: 'g2-l9-wheel',
  ease: 0.3,
  init(api) {
    const R = rng(61), n = api.tierCount(640), P = [];
    for (let i = 0; i < n; i++) { const spoke = i % 8, t = R(), a = spoke / 8 * Math.PI * 2 + t * 0.15, rr = R() < 0.4 ? R.range(0.9, 1.05) : t; P.push({ a, rr, z: R.range(-3, 3), f: R() * 6 }); }
    const mk = (groups) => { const g = modelGroups(groups)[0]; const m = new THREE.MeshBasicMaterial({ color: 0xf4f0ff, fog: false, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }); return { L: new Instanced(api.scene, g.geo, m, n), m }; };
    const up = mk(MOTHS.up), down = mk(MOTHS.down);
    up.L.mesh.renderOrder = -3; down.L.mesh.renderOrder = -3;
    return { P, up, down, spin: 0, t: 0 };
  },
  update(st, w, dt, api) {
    st.t += dt; st.spin += dt * (0.05 + 0.08 * w);
    st.up.m.opacity = w; st.down.m.opacity = w;
    st.up.L.begin(); st.down.L.begin();
    if (w > 0.003) {
      const L = api.level, k = L ? clamp((api.G.courseD ?? 0) / L.length, 0, 1) : 0;
      const cx = 0, cy = 230 - 80 * k, cz = -980 + 120 * k, r = 300, s = 8;
      for (let i = 0; i < st.P.length; i++) {
        const p = st.P[i], a = p.a + st.spin;
        tmpQ.setFromEuler(eul.set(0, Math.PI, a + Math.PI / 2));
        (Math.sin(st.t * 6 + p.f) > 0 ? st.up.L : st.down.L).put(cx + Math.cos(a) * r * p.rr, cy + Math.sin(a) * r * p.rr, cz + p.z * 8, tmpQ, s, s, s);
      }
    }
    st.up.L.end(); st.down.L.end();
  },
});
