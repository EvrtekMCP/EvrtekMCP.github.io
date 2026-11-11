// THE DERELICT'S STRUCTURE (level 1, the Quiet Colossus): girders across the lane (over or under), pylons
// (left or right), and ribs that arch over the whole lane (scenery you fly through). Three kinds, one hull.
import { THREE, defineObstacle, TX, SHIP_R } from '../../api.js?v=0.6.2';

let hullMat, warnMat, stripeMat;
function mats() {
  if (hullMat) return;
  const t = TX.hullShared();
  const hm = new THREE.MeshLambertMaterial({ map: t.map.clone(), emissiveMap: t.emissive.clone(), emissive: 0xffffff, emissiveIntensity: 1.2, color: 0xb0b8d0 });
  hm.map.repeat.set(4, 1); hm.emissiveMap.repeat.set(4, 1); hm.map.needsUpdate = hm.emissiveMap.needsUpdate = true;
  hullMat = hm;
  warnMat = new THREE.MeshBasicMaterial({ color: 0xff3355 });
  stripeMat = new THREE.MeshBasicMaterial({ color: 0xff4fd8 });
}
function build(kind) {
  const g = new THREE.Group();
  if (kind === 'girder') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(20, 1.4, 2.2), hullMat); g.add(b);
    const s = new THREE.Mesh(new THREE.BoxGeometry(20, 0.08, 0.08), warnMat); s.position.set(0, 0.74, 1.12); g.add(s);
    const s2 = s.clone(); s2.position.y = -0.74; g.add(s2);
  } else if (kind === 'pylon') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 20, 2.2), hullMat); g.add(b);
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.08, 20, 0.08), warnMat); s.position.set(0.74, 0, 1.12); g.add(s);
    const s2 = s.clone(); s2.position.x = -0.74; g.add(s2);
  } else { // a rib of the hull arching over the whole lane
    const post = new THREE.BoxGeometry(2.4, 26, 3.5), beam = new THREE.BoxGeometry(26, 2.4, 3.5);
    const L = new THREE.Mesh(post, hullMat); L.position.set(-10.2, -2, 0);
    const Rr = new THREE.Mesh(post, hullMat); Rr.position.set(10.2, -2, 0);
    const T = new THREE.Mesh(beam, hullMat); T.position.set(0, 7.2, 0);
    const st = new THREE.Mesh(new THREE.BoxGeometry(18, 0.1, 0.1), stripeMat); st.position.set(0, 5.95, 1.8);
    g.add(L, Rr, T, st);
  }
  return g;
}
function bar(name) {
  return defineObstacle({
    name,
    hazard: name === 'rib' ? null : { cls: 'static', introduced: 2 },
    // 0.3.1, check-levels' "no fully blocked moment": its solid shape as it crosses the ship's plane, as the distance from
    // a ship centre (x, y) to its surface (the kind's own hit test is that distance under part of SHIP_R)
    solid: name === 'rib' ? null : (ev, B) => [{ dist: name === 'girder' ? (x, y) => Math.abs(y - (ev.ny || 0) * B.y) - 0.7 : (x) => Math.abs(x - (ev.nx || 0) * B.x) - 0.7 }],
    init: mats,
    spawn(e, ev, api) {
      e.obj = api.course.get(name, () => build(name));
      const B = api.box;
      if (name === 'girder') e.sx = B.x * 3.4 / 20;
      if (name === 'pylon') e.sy = B.y * 3.6 / 20;
      if (name === 'rib') { e.sx = B.x / 7.5; e.sy = B.y / 4.3; }
    },
    update(e, dt, api) {
      api.pose(e);
      if (name !== 'rib' && !e.checked && (e.crossed || Math.abs(e.z) < 1.4)) {
        e.checked = true;
        const d = name === 'girder' ? Math.abs(api.ship.y - e.y) : Math.abs(api.ship.x - e.x);
        if (d < 0.7 + SHIP_R * 0.8) api.game.crash(e, 26);
        else if (d < 0.7 + 2.2) api.game.scrape(e, d);
      }
      if (e.z > 20) e.alive = false;
    },
  });
}
export const girder = bar('girder');
export const pylon = bar('pylon');
export const rib = bar('rib');
