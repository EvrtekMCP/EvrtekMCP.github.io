// LEVEL 8 course kinds: the broken spar (a supporting obstacle: a girder you already know, torn and lying at an
// angle) and the GHOST marker that pays an act's stealth bonus.
import { THREE, defineObstacle, defineDecor, SHIP_R, SPAWN_D } from '../../api.js?v=0.6.1';
import { watch } from '../../enemies/searchlight-sentry/index.js?v=0.6.1';

const DEG = Math.PI / 180;
// ---- the spar: a rusted I-beam 30 m long through (nx, ny) at angle a (degrees from level), one end torn off
let sparParts;
function sparMake() {
  if (!sparParts) {
    const rust = new THREE.MeshStandardMaterial({ color: 0x5a3a2c, metalness: 0.35, roughness: 0.85, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2c32, metalness: 0.55, roughness: 0.6, flatShading: true });
    const edge = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, metalness: 0.4, roughness: 0.6, flatShading: true });
    sparParts = { rust, dark, edge, box: new THREE.BoxGeometry(1, 1, 1) };
  }
  const { rust, dark, edge, box } = sparParts, g = new THREE.Group();
  const add = (m, sx, sy, sz, x, y, z, rz = 0) => { const o = new THREE.Mesh(box, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); o.rotation.z = rz; g.add(o); };
  add(dark, 30, 1.1, 0.24, 0, 0, 0);                           // the web
  add(rust, 30, 0.16, 1.3, 0, 0.62, 0); add(rust, 30, 0.16, 1.3, 0, -0.62, 0);   // the flanges
  add(edge, 30, 0.05, 0.05, 0, 0.71, 0.66); add(edge, 30, 0.05, 0.05, 0, -0.71, 0.66);  // a worn bright edge, so it reads on black
  for (let i = -6; i <= 6; i++) add(rust, 0.18, 1.1, 1.0, i * 2.3, 0, 0);   // stiffener plates
  // the torn end: the flanges peel apart
  add(rust, 2.6, 0.16, 1.3, 15.9, 1.1, 0, 0.45); add(rust, 2.2, 0.16, 1.3, 15.6, -1.0, 0, -0.35); add(dark, 1.6, 0.9, 0.24, 15.6, 0.1, 0, 0.2);
  return g;
}
export const spar = defineObstacle({
  name: 'l8-spar',
  hazard: { cls: 'static', introduced: 8 },
  sample: { nx: 0, ny: 0.4, a: 10 },
  // 0.3.1, check-levels' "no fully blocked moment": its solid shape as it crosses the ship's plane, as the distance from
  // a ship centre (x, y) to its surface (the kind's own hit test is that distance under part of SHIP_R)
  solid: (ev, B) => { const a = (ev.a || 0) * DEG, ca = Math.cos(a), sa = Math.sin(a), ex = ev.x ?? (ev.nx || 0) * B.x, ey = ev.y ?? (ev.ny || 0) * B.y; return [{ dist: (x, y) => Math.abs(-sa * (x - ex) + ca * (y - ey)) - 0.7 }]; },
  spawn(e, ev, api) {
    e.obj = api.course.get('l8-spar', sparMake);
    e.a = (ev.a || 0) * DEG; e.ca = Math.cos(e.a); e.sa = Math.sin(e.a);
    e.obj.rotation.set(0, 0, e.a);
    e.ship = api.ship;
    e.checked = false;
  },
  update(e, dt, api) {
    api.pose(e);
    if (!e.checked && (e.crossed || Math.abs(e.z) < 1.4) && !e.ev.warm) {
      e.checked = true;
      const d = Math.abs(-e.sa * (api.ship.x - e.x) + e.ca * (api.ship.y - e.y));
      if (d < 0.7 + SHIP_R * 0.8) api.game.crash(e, 26);
      else if (d < 0.7 + 2.2) api.game.scrape(e, d);
    }
    if (e.z > 20) e.alive = false;
  },
  // the test pilot keeps off the beam: the point of it nearest the ship, pushed clear
  avoid(e) {
    if (e.z < -140 || e.z > 0 || !e.ship) return null;
    const s = e.ship, t = e.ca * (s.x - e.x) + e.sa * (s.y - e.y);
    return [{ x: e.x + e.ca * t, y: e.y + e.sa * t, r: 2.7 }];
  },
});

// ---- the GHOST check at the end of an act: no searchlight caught you in it, 5,000 on the tally
export const GHOST_PTS = 5000;
export const ghost = defineDecor({
  name: 'l8-ghost',
  motion: 'own', spawnAt: 'now',
  spawn(e, ev, api) { e.z = -SPAWN_D; e.obj = null; },
  update(e, dt, api) {
    e.alive = false;
    if (e.ev.warm) return;
    const t = watch.byTag[e.ev.tag];
    if (!t || t.caught > 0 || t.unseen + t.out === 0) return;
    api.game.bonus('GHOST ' + e.ev.sub, GHOST_PTS);
    api.game.call('GHOST: ' + e.ev.sub, 'c-mag');
    api.game.pop('GHOST +' + GHOST_PTS.toLocaleString('en-US'), api.ship.x, api.ship.y + 2.2, 0, 'mag big');
  },
});
