// THE BOULDER (level 2): a chunk of the broken moon tumbling ACROSS the lane. It rolls on a straight diagonal
// through the track, so its path reads from far out (rule 18: predictable motion): watch where it will be when
// it reaches you. A side arrow and a low rumble as it enters the lane region; a trail of dust behind it.
// Its fissures glow the hurts red (rule 9), where the drifting scenery chunks glow Yori's warm sun edge.
//   add(d, 'boulder', { from: -1 | 1, cross: nx where it meets the ship's plane, ny, r: 2..4, span: 320 })
import { THREE, defineObstacle, Instanced, modelGroups, SHIP_R, READ_D } from '../../api.js?v=0.6.4';
import { MESH } from './mesh.js?v=0.6.4';

const VARIANTS = ['a', 'b', 'c'];
let layers;
const tmpQ = new THREE.Quaternion(), ax = new THREE.Vector3();
export default defineObstacle({
  name: 'boulder',
  breaks: true,
  // its whole path is visible from the read line; the warning is the time from there (rule 12)
  hazard: { cls: 'mover', introduced: 1, warn: (ev, v) => READ_D / v },
  // 0.3.1, check-levels' "no fully blocked moment": its solid shape as it crosses the ship's plane, as the distance from
  // a ship centre (x, y) to its surface (the kind's own hit test is that distance under part of SHIP_R)
  // it meets the ship's plane at `cross` (normalised x), on its own height
  solid: (ev, B) => [{ dist: (x, y) => Math.hypot(x - (ev.cross || 0) * B.x, y - (ev.ny || 0) * B.y) - (ev.r || 2) * 0.8 }],
  sample: { from: 1, cross: 0, r: 2 },
  avoid: (e) => [{ x: e.xAt(0), y: e.y, r: e.r * 0.8 + 2.2 }],
  init(api) {
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x6a5a4e, flatShading: true });
    const hot = new THREE.MeshBasicMaterial({ color: 0xff4a3a });
    layers = VARIANTS.map((v) => modelGroups(MESH[v]).map((g) => new Instanced(api.scene, g.geo, g.glow ? hot : rockMat, 24)));
  },
  begin() { for (const v of layers) for (const L of v) L.begin(); },
  end() { for (const v of layers) for (const L of v) L.end(); },
  spawn(e, ev, api) {
    e.r = ev.r || 2.6; e.from = ev.from || 1; e.v = (ev.variant ?? Math.floor(Math.random() * 3)) % 3;
    const B = api.box, span = ev.span || 320, xc = (ev.cross || 0) * B.x, k = 2.2 * B.x / span;
    // where it is when it is z metres ahead (z < 0); it keeps rolling past the ship to the other side
    e.xAt = (z) => xc + e.from * k * (-z);
    e.x = e.xAt(e.z); e.span = span; e.k = k;
    e.q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    e.tumble = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, 0).normalize();
    e.warned = false; e.rumbled = false;
  },
  update(e, dt, api) {
    const ship = api.ship, dz = e.z - e.pz;
    const nx = e.xAt(e.z), dx = nx - e.x; e.x = nx;
    // roll across: about the track's axis, at the rate its sideways travel turns a ball of radius r; a little tumble
    tmpQ.setFromAxisAngle(ax.set(0, 0, 1), -dx / e.r); e.q.premultiply(tmpQ);
    tmpQ.setFromAxisAngle(e.tumble, dz * 0.004); e.q.premultiply(tmpQ);
    const s = e.r * e.appear;
    for (const L of layers[e.v]) L.put(e.x, e.y, e.z, e.q, s, s, s);
    if (!e.warned && e.z > -e.span) { e.warned = true; api.game.warn(e.from, 0.9); }
    if (!e.rumbled && e.z > -300) { e.rumbled = true; api.game.sfx('boom', { rate: 0.45, vol: 0.35, pan: Math.sign(e.x) * 0.5 }); }
    // a trail of moon dust behind it, left in the track
    if (e.z > -420 && e.z < 5 && Math.random() < dt * 40) api.game.emit(e.x - e.from * e.r * 0.9, e.y + (Math.random() - 0.5) * e.r, e.z + (Math.random() - 0.5) * e.r,
      { life: 0.9, s0: e.r * 0.9, s1: e.r * 1.6, r: 0.55, g: 0.45, b: 0.38, a: 0.35, carry: 1, vx: -e.from * 2 });
    if (e.crossed && !e.hit) {
      const d = Math.hypot(ship.x - e.x, ship.y - e.y), reach = e.r * 0.8 + SHIP_R;
      if (d < reach) { e.hit = true; e.alive = api.game.crash(e, 24) !== 'gone'; }
      else if (d < reach + 2.2) api.game.scrape(e, d);
    }
    if (e.z > 30) e.alive = false;
  },
});
