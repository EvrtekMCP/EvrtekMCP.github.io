// ROCKS (level 1, the Shatter Belt): lumpy tumbling asteroids. In the lane they cost a hit and break; with
// decor: true they are scenery outside the flight box and never collide.
import { THREE, defineObstacle, Instanced, SHIP_R } from '../../api.js?v=0.4.0';

export function rockGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
  // lumpy, but every copy of a vertex moves the same way so the faceted surface stays closed
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + 0.22 * Math.sin(x * 5.1 + y * 2.3) * Math.cos(z * 4.7 - x * 1.3) + 0.12 * Math.sin(y * 9.0 + z * 3.0);
    p.setXYZ(i, x * n, y * n * 0.85, z * n);
  }
  g.computeVertexNormals();
  return g;
}
const tmpA = new THREE.Vector3();
let L;
export default defineObstacle({
  name: 'rock',
  hazard: { cls: 'static', introduced: 2 },
  sample: { r: 1 },
  // 0.3.1, check-levels' "no fully blocked moment": its solid shape as it crosses the ship's plane, as the distance from
  // a ship centre (x, y) to its surface (the kind's own hit test is that distance under part of SHIP_R)
  solid: (ev, B) => (ev.decor ? null : [{ dist: (x, y) => Math.hypot(x - (ev.x ?? (ev.nx || 0) * B.x), y - (ev.y ?? (ev.ny || 0) * B.y)) - (ev.r || 1) * 0.82 }]),
  init(api) { L = new Instanced(api.scene, rockGeometry(), new THREE.MeshLambertMaterial({ color: 0x7a6a62, flatShading: true }), 260); },
  begin() { L.begin(); },
  end() { L.end(); },
  spawn(e, ev) {
    e.r = ev.r || 1; e.decor = !!ev.decor;
    e.q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, 0));
    e.spin = new THREE.Quaternion().setFromAxisAngle(tmpA.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), (Math.random() - 0.5) * 0.04);
  },
  update(e, dt, api) {
    e.q.multiply(e.spin);
    const s = e.r * e.appear;
    L.put(e.x, e.y, e.z, e.q, s, s, s);
    if (!e.decor && !e.hit && Math.abs(e.z) < e.r + 1.2) {
      const reach = e.r * 0.82 + SHIP_R;
      if (Math.hypot(api.ship.x - e.x, api.ship.y - e.y) < reach && Math.abs(e.z) < e.r * 0.8 + 0.6) { e.hit = true; e.alive = api.game.crash(e, 24) !== 'gone'; }
    }
    if (e.z > 30) e.alive = false;
  },
});
