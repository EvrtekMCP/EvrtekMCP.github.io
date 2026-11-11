// THE WEFTWORK's level-only kinds.
//  g3-l10-thread-wall  a block of loom thread across part of the lane, in a steel frame: solid, unless you are PHASING.
//                      It hides a cache, and it says so twice (the plan's 6.4 clue language): Yori's violet Phase
//                      crack on its face, the cache's amber glow bleeding round its edges, and amber sparks drifting
//                      out of it. The level lays a trail of cache rings running into it: real rings, never fake ones.
// ev: nx, ny (its middle), w, h (metres), seed.
import { THREE, defineObstacle, buildModel, SHIP_R } from '../../../api.js?v=0.6.2';
import { MESH as CRACK } from './crack-mesh.js?v=0.6.2';

const PITCH = 0.85;
let thrGeo = null, thrMat = null, frameMat = null, boxGeo = null, bleedMat = null, sparkMat = null;
const tmpM = new THREE.Matrix4();
function makeWall(api) {
  const g = new THREE.Group();
  const threads = new THREE.InstancedMesh(thrGeo, thrMat, 40); threads.frustumCulled = false; g.add(threads);
  const frame = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(boxGeo, frameMat); g.add(m); return m; });
  const crack = buildModel(CRACK.crack, { own: ['#5a3aa0*'] }); crack.group.position.z = 0.6; crack.group.rotation.y = Math.PI; g.add(crack.group); // her front (-Z) to you
  crack.mats['#5a3aa0*'].transparent = true; crack.mats['#5a3aa0*'].opacity = 0.4; crack.mats['#5a3aa0*'].depthWrite = false;
  const bleed = [0, 1, 2, 3].map(() => { const s = new THREE.Sprite(bleedMat); g.add(s); return s; });
  const sparks = [0, 1, 2, 3, 4, 5].map(() => { const s = new THREE.Sprite(sparkMat); s.scale.setScalar(0.7); g.add(s); return s; });
  g.userData = { threads, frame, crack: crack.group, bleed, sparks };
  return g;
}
export const threadWall = defineObstacle({
  name: 'g3-l10-thread-wall',
  hazard: { cls: 'static', introduced: [3, 10] },
  sample: { nx: 0.5, ny: 0, w: 5, h: 7 },
  // 0.3.1's no-blocked check: where it is solid as it reaches your plane (its frame, the same box its hit tests); Phase
  // passes it, but the check, like the stars, never assumes a power-up
  solid(ev, B) {
    const cx = ev.x ?? (ev.nx || 0) * B.x, cy = ev.y ?? (ev.ny || 0) * B.y, hw = (ev.w || 5) / 2, hh = (ev.h || 7) / 2;
    return [{ dist: (x, y) => { const dx = Math.abs(x - cx) - hw, dy = Math.abs(y - cy) - hh; return dx > 0 || dy > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) : Math.max(dx, dy); } }];
  },
  init(api) {
    thrGeo = new THREE.BoxGeometry(0.12, 1, 0.12);
    thrMat = new THREE.MeshBasicMaterial({ color: 0x9a6aff });           // her loom thread, lit
    frameMat = new THREE.MeshStandardMaterial({ color: 0x8a94a8, metalness: 0.5, roughness: 0.45, flatShading: true });
    boxGeo = new THREE.BoxGeometry(1, 1, 1);
    bleedMat = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffcc33, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.45 });
    sparkMat = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffcc33, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.9 });
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('g3-l10-thread-wall', () => makeWall(api));
    const ud = e.obj.userData;
    e.w = ev.w || 5; e.h = ev.h || 7; e.sx = e.sy = e.sz = 1; e.hit = false;
    const n = Math.min(40, Math.floor(e.w / PITCH));
    for (let i = 0; i < 40; i++) { const x = -e.w / 2 + (i + 0.5) * e.w / n; ud.threads.setMatrixAt(i, i < n ? tmpM.makeScale(1, e.h, 1).setPosition(x, 0, 0) : tmpM.makeScale(0, 0, 0)); }
    ud.threads.instanceMatrix.needsUpdate = true;
    const t = 0.5, set = (m, x, y, sx, sy) => { m.position.set(x, y, 0); m.scale.set(sx, sy, 0.8); };
    set(ud.frame[0], 0, e.h / 2 + t / 2, e.w + 2 * t, t); set(ud.frame[1], 0, -e.h / 2 - t / 2, e.w + 2 * t, t);
    set(ud.frame[2], -e.w / 2 - t / 2, 0, t, e.h); set(ud.frame[3], e.w / 2 + t / 2, 0, t, e.h);
    ud.crack.scale.setScalar(Math.min(e.w / 4.2, e.h / 6.0) * 0.9);
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([a, b], i) => { const s = ud.bleed[i]; s.position.set(a * (e.w / 2 + 0.6), b * (e.h / 2 + 0.6), -1); s.scale.set(a ? 2.6 : e.w + 3, b ? 2.6 : e.h + 3, 1); });
  },
  update(e, dt, api) {
    const ud = e.obj.userData;
    for (const s of ud.bleed) s.material.opacity = 0.32 + 0.14 * Math.sin(e.t * 3);
    // sparks: amber motes drifting out of the gaps, from the crack, toward you
    ud.sparks.forEach((s, i) => { const k = (e.t * 0.6 + i / 6) % 1, a = i * 2.4; s.position.set(Math.cos(a) * e.w * 0.3 * k, Math.sin(a) * e.h * 0.3 * k, 1 + 7 * k); s.material.opacity = 0.9 * (1 - k); });
    api.pose(e);
    if (e.crossed && !e.hit) {
      const m = SHIP_R * 0.6, inside = Math.abs(api.ship.x - e.x) < e.w / 2 + m && Math.abs(api.ship.y - e.y) < e.h / 2 + m;
      if (inside) { e.hit = true; api.game.crash({ x: api.ship.x, y: api.ship.y, type: e.type, kind: e.kind }, 18); }
    }
    if (e.z > 30) e.alive = false;
  },
  avoid(e) { return [{ x: e.x, y: e.y, r: Math.max(e.w, e.h) / 2 + 1.6 }]; },
});
