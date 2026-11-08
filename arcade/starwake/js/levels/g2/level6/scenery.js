// THE TANGLE's scenery (ruling 5; rule 22). Yori's look (looks/level-g2-06-the-tangle.png): a dead reef choked in
// red-seamed vine, arches of tangled coral, leeches hanging in them; olive and rust, the darkest green. The red threads
// in the vine are the graft (her thin seams, never large flat red: rule 9). Everything here is outside the box.
//  - g2-l6-motes:    the Deep's motes, olive and pale green (level 4's kind)
//  - g2-l6-vines:    her thornvine, 30 m runs of tangled coral along both sides: the canyon walls
//  - g2-l6-reefs:    dead reef boulders, silver and seamed red, outside the box
//  - g2-l6-arches:   her briar arches spanning the lane, the box well inside them (THE BRIAR GATE thickens them)
//  - g2-l6-deadreef: the landmark, a dead reef the size of a moon, choked in vine, on the horizon
// and the level's one obstacle of its own:
//  - g2-l6-wall:     her coral wall across part of the lane with her violet crack on it (the clue that never changes:
//                    "Phase gets you through here"); solid, but PHASE takes you through, to a cache behind it
import { THREE, defineScenery, defineDecor, defineObstacle, Instanced, modelGroups, material, buildModel, rng } from '../../../api.js?v=0.4.0';
import { MESH } from './mesh.js?v=0.4.0';
import { moteStream, motes as moteKind } from '../level4/scenery.js?v=0.4.0';

const q = new THREE.Quaternion(), eul = new THREE.Euler();
export const motes = moteStream('g2-l6-motes', 0xa0c040, 0xc8e0b0, [40, 80]);

// a decor kind drawing one of her meshes per copy, instanced, with a fixed random turn
function instDecor(name, variants, cap, o = {}) {
  let Ls = null;
  return defineDecor({
    name, hazard: null, sample: { s: 1 },
    init(api) { if (!Ls) Ls = variants.map((m) => modelGroups(m).map((g) => new Instanced(api.scene, g.geo, material(g.color, g.glow), cap))); },
    begin() { for (const v of Ls) for (const L of v) L.begin(); },
    end() { for (const v of Ls) for (const L of v) L.end(); },
    spawn(e, ev) { e.v = (ev.v ?? e.id) % variants.length; e.s = ev.s || 1; e.q = new THREE.Quaternion().setFromEuler(eul.set(ev.rx ?? (Math.random() - 0.5) * (o.tilt ?? 0.5), ev.ry ?? Math.random() * (o.yaw ?? 6.28), ev.rz ?? (Math.random() - 0.5) * (o.tilt ?? 0.5))); },
    update(e) { const s = e.s * e.appear; for (const L of Ls[e.v]) L.put(e.x, e.y, e.z, e.q, s, s, s); if (e.z > (o.gone ?? 60)) e.alive = false; },
  });
}
export const vine = instDecor('g2-l6-vine', [MESH.vineA, MESH.vineB], 80, { tilt: 0.25, yaw: 0.4, gone: 50 });
export const reef = instDecor('g2-l6-reef', [MESH.reefA, MESH.reefB], 60);
export const arch = instDecor('g2-l6-arch', [MESH.arch], 24, { tilt: 0.05, yaw: 0.15, gone: 40 });

export const vines = defineScenery({
  name: 'g2-l6-vines',
  stream: { every: [16, 34], place: (R, api) => { const B = api.box, side = R.sign(); return { type: 'g2-l6-vine', x: side * R.range(B.x * 1.55, B.x * 2.8), y: R.range(-B.y * 1.6, B.y * 1.8), s: R.range(1, 1.7), v: R() < 0.5 ? 0 : 1 }; } },
});
export const reefs = defineScenery({
  name: 'g2-l6-reefs',
  stream: { every: [60, 130], place: (R, api) => { const B = api.box, a = R.range(0, Math.PI * 2), rr = R.range(2.4, 5.5); return { type: 'g2-l6-reef', x: Math.cos(a) * B.x * rr, y: Math.sin(a) * B.y * rr * 1.2, s: R.range(0.8, 2.2) }; } },
});
export const arches = defineScenery({
  name: 'g2-l6-arches',
  stream: { every: [120, 220], place: (R) => ({ type: 'g2-l6-arch', x: R.range(-1.5, 1.5), y: 0, s: R.range(1.05, 1.35), rx: 0, ry: R.range(-0.12, 0.12), rz: R.range(-0.08, 0.08) }) },
});

// ---- the landmark: a dead reef the size of a moon, choked in red-seamed vine, low on the horizon
export const deadReef = defineScenery({
  name: 'g2-l6-deadreef',
  ease: 0.35,
  init(api) {
    const g = new THREE.Group(), mats = [];
    const add = (model, s, at, rot) => { for (const grp of modelGroups(model)) { const m = material(grp.color, grp.glow, true); m.transparent = true; m.opacity = 0; m.fog = false; m.depthWrite = false; mats.push(m); const me = new THREE.Mesh(grp.geo, m); me.scale.setScalar(s); me.position.set(...at); me.rotation.set(...rot); g.add(me); } };
    const R = rng(606);
    add(MESH.reefA, 26, [0, 0, 0], [0.3, 0.5, 0.1]); add(MESH.reefB, 18, [110, 40, 30], [0.8, 1.2, 0.4]); add(MESH.reefA, 14, [-120, -30, 20], [1.1, 0.2, 0.6]);
    for (let i = 0; i < 9; i++) add(i % 2 ? MESH.vineA : MESH.vineB, R.range(5, 8), [R.range(-160, 160), R.range(-80, 120), R.range(-40, 60)], [R.range(-1, 1), R.range(0, 6), R.range(-1, 1)]);
    g.position.set(-340, -40, -1000); g.renderOrder = -4; g.visible = false;
    api.scene.add(g);
    return { g, mats };
  },
  update(s, w, dt) {
    s.g.visible = w > 0.003;
    for (const m of s.mats) m.opacity = 0.55 * w;
    s.g.rotation.y += dt * 0.004;
  },
});

// ---- the coral wall with the violet crack
//   add(d, 'g2-l6-wall', { nx: -0.4, ny: 0, wn: 1.3, hn: 2.2, crack: [-0.4, 0] })   (sizes in box half-widths/heights)
const UNIT = { w: 16, h: 10 };   // her coralWall(61, 16, 10)
export const wall = defineObstacle({
  name: 'g2-l6-wall',
  hazard: { cls: 'static', introduced: [2, 6] },
  sample: { nx: -0.4, ny: 0, wn: 1.2, hn: 2 },
  spawn(e, ev, api) {
    const B = api.box;
    e.obj = api.course.get('g2-l6-wall', () => {
      const g = new THREE.Group(), w = buildModel(MESH.wall).group; w.rotation.y = Math.PI; g.add(w);
      const c = buildModel(MESH.crack).group; c.position.z = 2.7; g.add(c);
      g.userData = { crack: c };
      return g;
    });
    e.w = (ev.wn || 1.2) * B.x; e.h = (ev.hn || 2) * B.y;
    e.sx = e.w / UNIT.w; e.sy = e.h / UNIT.h; e.sz = 1;
    const c = ev.crack || [ev.nx || 0, ev.ny || 0], u = e.obj.userData;
    // the crack is drawn at its own size (5 x 4 m), wherever on the wall it is: undo the wall's stretch for it
    u.crack.position.set((c[0] * B.x - e.x) / e.sx, (c[1] * B.y - e.y) / e.sy, 2.7); u.crack.scale.set(1 / e.sx, 1 / e.sy, 1);
  },
  update(e, dt, api) {
    api.pose(e);
    if (e.crossed && Math.abs(api.ship.x - e.x) < e.w / 2 + 0.4 && Math.abs(api.ship.y - e.y) < e.h / 2 + 0.4) api.game.crash(e, 18, false);   // PHASE: crash() lets you through
    if (e.z > 12) e.alive = false;
  },
  // the 0.3.1 check (no fully blocked moment): its own side of the edge is solid. It is a rectangle (with the 0.4 m it
  // reaches in contact) that runs past the box's height, so in the box it is everything on its side of its open edge;
  // the signed distance to the rectangle says so on any box (sizes and place scale with the box, as the wall does).
  solid(ev, box) {
    const cx = (ev.nx || 0) * box.x, cy = (ev.ny || 0) * box.y, hw = (ev.wn || 1.2) * box.x / 2 + 0.4, hh = (ev.hn || 2) * box.y / 2 + 0.4;
    return [{ dist: (x, y) => { const dx = Math.abs(x - cx) - hw, dy = Math.abs(y - cy) - hh; return dx > 0 || dy > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) : Math.max(dx, dy); } }];
  },
  // the bots: a row of keep-out circles along it
  avoid(e) { const out = [], n = Math.max(2, Math.ceil(e.w / e.h * 2)); for (let i = 0; i < n; i++) out.push({ x: e.x - e.w / 2 + e.w * (i + 0.5) / n, y: e.y, r: Math.max(e.h / 2, e.w / n / 2) + 1.2 }); return out; },
});

export const SCENERY = [motes, vines, reefs, arches, deadReef];
export const DECOR = [moteKind, vine, reef, arch];
