// CRYSTALS (level 1, the Halcyon Drift): slow violet spires to slip round. decor: true = scenery, no contact.
import { THREE, defineObstacle, Instanced, SHIP_R } from '../../api.js?v=0.4.0';

const tmpQ = new THREE.Quaternion(), tmpA = new THREE.Vector3(0, 1, 0);
let L;
export default defineObstacle({
  name: 'crystal',
  hazard: { cls: 'static', introduced: 2 },
  // 0.3.1, check-levels' "no fully blocked moment": its solid shape as it crosses the ship's plane, as the distance from
  // a ship centre (x, y) to its surface (the kind's own hit test is that distance under part of SHIP_R)
  solid: (ev, B) => (ev.decor ? null : [{ dist: (x, y) => Math.hypot(x - (ev.x ?? (ev.nx || 0) * B.x), y - (ev.y ?? (ev.ny || 0) * B.y)) - (ev.r || 1) * 0.5 }]),
  sample: { r: 1 },
  init(api) {
    const g = new THREE.OctahedronGeometry(1, 0); g.scale(0.55, 1.6, 0.55);
    L = new Instanced(api.scene, g, new THREE.MeshLambertMaterial({ color: 0xb070ff, emissive: 0x6a1a8a, flatShading: true, transparent: true, opacity: 0.92 }), 96);
  },
  begin() { L.begin(); },
  end() { L.end(); },
  spawn(e, ev) {
    e.r = ev.r || 1; e.decor = !!ev.decor;
    e.q = new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.6, Math.random() * 6, (Math.random() - 0.5) * 0.6));
    e.spinY = (Math.random() - 0.5) * 0.4;
  },
  update(e, dt, api) {
    tmpQ.setFromAxisAngle(tmpA, e.spinY * dt); e.q.multiply(tmpQ);
    const s = e.r * e.appear;
    L.put(e.x, e.y, e.z, e.q, s, s, s);
    if (!e.decor && !e.hit && Math.abs(e.z) < e.r + 1.2) {
      const reach = e.r * 0.5 + SHIP_R;
      if (Math.hypot(api.ship.x - e.x, api.ship.y - e.y) < reach && Math.abs(e.z) < e.r * 0.8 + 0.6) { e.hit = true; e.alive = api.game.crash(e, 20) !== 'gone'; }
    }
    if (e.z > 30) e.alive = false;
  },
});
