// GALAXY 2, LEVEL 10's own pieces (level-only, so they live here and carry the level's prefix).
//  g2-l10-root-wall  THE ROOT WALL in the taproot: roots grown across one side of the tunnel, solid. The other side is
//                    open (no fully blocked moment). On its face, Yori's violet CRACK: Phase gets you through there, to a
//                    sap-light cache behind it. Its clues (the plan's 6.4, at least two; this has all four): the crack,
//                    the cache's colours bleeding round the crack's edge (amber rings, sap-green light), sparks drifting
//                    out of it, and a ring trail running in (the level lays the trail and the cache).
//   ev: side (+1: it covers the right of the lane; -1 the left), edge (nx where it stops; the rest is open),
//       cx, cy (the crack's middle, normalised)
import { THREE, defineObstacle, buildModel, SHIP_R } from '../../../api.js?v=0.4.1';
import { MESH } from './mesh.js?v=0.4.1';
import { MESH as WHIP } from '../../../obstacles/g2-root-whip/mesh.js?v=0.4.1';

const crash = (api, e, dmg) => api.game.crash({ x: api.ship.x, y: api.ship.y, type: e.type, kind: e.kind }, dmg);
const glowSprite = (api, color, s, o) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: o })); sp.scale.setScalar(s); return sp; };
let backMat = null, lipMat = null, boxGeo = null;
const W_OUT = 16, ROOTS = 12;
function make(api) {
  const g = new THREE.Group();
  const back = new THREE.Mesh(boxGeo, backMat); g.add(back);
  const lip = new THREE.Mesh(boxGeo, lipMat); g.add(lip);
  const roots = [];
  for (let i = 0; i < ROOTS; i++) { const r = buildModel(WHIP.whip); r.group.rotation.z = Math.PI / 2; r.group.scale.set(1.05, 1.2, 1.4); g.add(r.group); roots.push(r.group); }
  const crack = buildModel(MESH.crack, { own: ['#5a3aa0*', '#9b6bff*'] });
  crack.mats['#5a3aa0*'].transparent = true; crack.mats['#5a3aa0*'].opacity = 0.8;
  g.add(crack.group);
  const bleed = [0xffcc33, 0xd0ffb0, 0xffcc33, 0xd0ffb0, 0xffcc33, 0xd0ffb0].map((c) => { const s = glowSprite(api, c, 3.4, 0.6); g.add(s); return s; });
  const shine = glowSprite(api, 0x9b6bff, 12, 0.55); g.add(shine);   // the crack's violet light, seen from far off
  const sparks = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const s = glowSprite(api, i % 3 ? 0xffcc33 : 0xd0ffb0, 0.9, 0.9); g.add(s); return s; });
  crack.group.scale.setScalar(1.25);
  g.userData = { back, lip, roots, crack: crack.group, crackMats: crack.mats, bleed, sparks, shine };
  return g;
}
export const rootWall = defineObstacle({
  name: 'g2-l10-root-wall',
  hazard: { cls: 'static', introduced: [2, 10] },
  sample: { side: 1, edge: -0.05, cx: 0.5, cy: 0.1 },
  // the 0.3.1 check (no fully blocked moment): where it is solid as it crosses the ship's plane: everything on its side
  // of its edge, as the distance from a ship centre to that edge (Phase can take you through, but the check never
  // counts on Phase: the open side must be a fair way through on its own)
  solid: (ev, box) => { const s = ev.side === -1 ? -1 : 1, ex = (ev.edge ?? -0.05) * box.x; return [{ dist: (x) => (x - ex) * -s }]; },
  init() {
    boxGeo = new THREE.BoxGeometry(1, 1, 1);
    backMat = new THREE.MeshStandardMaterial({ color: 0x4a3220, emissive: 0x1a120a, metalness: 0.15, roughness: 0.75, flatShading: true });
    lipMat = new THREE.MeshBasicMaterial({ color: 0xff3355 });
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('g2-l10-root-wall', () => make(api));
    const B = api.box, ud = e.obj.userData;
    e.x = 0; e.y = 0; e.sx = e.sy = e.sz = 1; e.hit = false;
    e.side = ev.side === -1 ? -1 : 1; e.E = (ev.edge ?? -0.05) * B.x;
    const x0 = e.E, x1 = e.side * W_OUT, w = Math.abs(x1 - x0), mid = (x0 + x1) / 2;
    ud.back.scale.set(w, 30, 2.2); ud.back.position.set(mid, 0, -0.4);
    ud.lip.scale.set(0.7, 30, 2.6); ud.lip.position.set(x0, 0, -0.2);
    ud.roots.forEach((r, i) => { const k = (i + 0.5) / ROOTS; r.position.set(x0 + (x1 - x0) * k, ((i * 7) % 5 - 2) * 0.8, 1.0); r.rotation.set(0, 0, Math.PI / 2 + ((i * 5) % 7 - 3) * 0.035); r.visible = Math.abs(r.position.x - x0) > 0.8; });
    e.cx = (ev.cx ?? 0.5) * B.x; e.cy = (ev.cy ?? 0.1) * B.y;
    ud.crack.position.set(e.cx, e.cy, 1.9); ud.shine.position.set(e.cx, e.cy, 1.5);
    ud.bleed.forEach((s, i) => { const a = i / ud.bleed.length * Math.PI * 2; s.position.set(e.cx + Math.cos(a) * 3.3, e.cy + Math.sin(a) * 3.0, 1.6); });
  },
  update(e, dt, api) {
    const ud = e.obj.userData;
    // the clues breathe: the bleed pulses, the sparks drift out of the crack toward you and start again
    ud.bleed.forEach((s, i) => { s.material.opacity = 0.35 + 0.35 * Math.sin(e.t * 3 + i * 1.7); s.scale.setScalar(2.2 + 0.8 * Math.sin(e.t * 2.3 + i)); });
    ud.sparks.forEach((s, i) => { const k = (e.t * 0.6 + i / ud.sparks.length) % 1, a = i * 2.4; s.position.set(e.cx + Math.cos(a) * 1.4 * k, e.cy + Math.sin(a) * 1.2 * k, 2 + 9 * k); s.material.opacity = 0.9 * (1 - k); });
    ud.crackMats['#9b6bff*'].color.setHSL(0.72, 0.9, 0.62 + 0.12 * Math.sin(e.t * 5)); ud.shine.material.opacity = 0.4 + 0.2 * Math.sin(e.t * 2.6);
    api.pose(e);
    if (e.crossed && !e.hit) {
      const s = api.ship, into = e.side * (s.x - e.E), m = SHIP_R * 0.6;
      if (into > -m) { e.hit = true; crash(api, e, 20); }          // Phase lets the ship through (the engine: PHASED!)
      else if (into > -m - 0.7) api.game.scrape(e, -into);
    }
    if (e.z > 30) e.alive = false;
  },
  // the test pilots keep to the open side (they never take Phase routes on purpose)
  avoid(e) { const out = []; for (let x = e.E + e.side * 1.6; Math.abs(x) < 11; x += e.side * 2.4) for (let y = -6; y <= 6; y += 2.4) out.push({ x, y, r: 2.2 }); return out; },
});
