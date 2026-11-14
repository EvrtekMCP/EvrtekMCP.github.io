// THE ROOTMIND's own kinds (the boss spawns them; level 10 lists them so their shaders warm on the loading screen).
//  g2-rootmind-starfire  STARFIRE: the strangled star flares through a gap between its roots in a white-hot sheet that
//                        crosses the lane as a band. Its gap brightens for 1.3 s first (the boss draws that), and a faint
//                        ghost of the band flickers where it will burn. The one thing in galaxy 2 a roll cannot send back.
//  g2-rootmind-sap       SAP-LIGHT: what a struck knot spills. Pale sap-green (Yori: sap-green is shield). Fly through it
//                        for shield and points. It is not a ring: it never counts toward RINGS or a PERFECT.
import { THREE, defineObstacle, definePickup, smoothstep, SHIP_R, RING_R } from '../../api.js?v=0.6.4';

// =====================================================================================================================
// STARFIRE. ev: c (metres: where the band's middle line crosses the lane's middle, along its normal), w (half-width, m),
// tilt (rad; 0 is a level band, so you dodge up or down), tel (1.3), on (1.0), from {x, y, z} (the gap in the roots).
// The covered region on the ship's plane: |n . p - c| < w, with n = (-sin tilt, cos tilt).
const HALF_L = 15;          // the band runs 15 m either side of the lane's middle: past both edges of the box
function makeBand() {
  const g = new THREE.Group();
  const mk = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const sheetMat = mk(0xffffff), haloMat = mk(0xd0ffb0), edgeMat = mk(0xffffff);
  // the sheet: from the gap (narrow) to the band on the ship's plane (wide); the halo is the same, a little wider
  const quad = () => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(8 * 3), 3)); geo.setIndex([0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7, 4, 5, 6, 4, 6, 7]); return geo; };
  const sheetGeo = quad(), haloGeo = quad();
  const sheet = new THREE.Mesh(sheetGeo, sheetMat), halo = new THREE.Mesh(haloGeo, haloMat);
  // its two edges on the ship's plane: bright lines, so where it stops is never in doubt
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(8 * 3), 3)); eg.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  const edges = new THREE.Mesh(eg, edgeMat);
  for (const m of [sheet, halo, edges]) { m.frustumCulled = false; g.add(m); }
  g.userData = { sheet, halo, edges, sheetMat, haloMat, edgeMat, sheetGeo, haloGeo, eg };
  return g;
}
// write a wedge from the gap to a band (corners on the ship's plane) into a quad geometry
function wedge(geo, from, n, u, c, w, grow) {
  const A = geo.attributes.position.array, near = [], far = [];
  for (const [su, sn] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x = n[0] * (c + sn * w) + u[0] * su * HALF_L, y = n[1] * (c + sn * w) + u[1] * su * HALF_L;
    near.push([x, y, 0.5]); far.push([from.x + (x - from.x) * 0.02, from.y + (y - from.y) * 0.02 + sn * 0.3, from.z]);
  }
  for (let i = 0; i < 4; i++) { const f = far[i], p = near[i]; A[i * 3] = f[0]; A[i * 3 + 1] = f[1]; A[i * 3 + 2] = f[2]; A[12 + i * 3] = f[0] + (p[0] - f[0]) * grow; A[13 + i * 3] = f[1] + (p[1] - f[1]) * grow; A[14 + i * 3] = f[2] + (p[2] - f[2]) * grow; }
  geo.attributes.position.needsUpdate = true;
}
export const starfire = defineObstacle({
  name: 'g2-rootmind-starfire',
  motion: 'own', spawnAt: 'now',
  hazard: { cls: 'sweep', introduced: [2, 10], warn: (ev) => ev.tel || 1.3 },
  sample: { c: 0, w: 1.8, tilt: 0, from: { x: 14, y: 2, z: -100 }, warm: true },
  spawn(e, ev, api) {
    e.vis = api.course.get('g2-rootmind-starfire', makeBand);   // drawn in the world's frame; the entity is only its timing and its hit
    e.x = 0; e.y = 0; e.z = -2; e.sx = e.sy = e.sz = 1; e.appear = 1; e.hit = false; e.fired = false;
    e.c = ev.c || 0; e.w = ev.w || 1.8; e.tilt = ev.tilt || 0; e.tel = ev.tel || 1.3; e.on = ev.on || 1.0;
    e.n = [-Math.sin(e.tilt), Math.cos(e.tilt)]; e.u = [Math.cos(e.tilt), Math.sin(e.tilt)];
    e.from = ev.from || { x: 14, y: 2, z: -100 };
    const ud = e.vis.userData;
    // the edges, on the ship's plane, the full length of the band
    const E = ud.eg.attributes.position.array, t = 0.12;
    let k = 0;
    for (const sn of [-1, 1]) for (const [su, so] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const off = e.c + sn * e.w + so * t; E[k++] = e.n[0] * off + e.u[0] * su * HALF_L; E[k++] = e.n[1] * off + e.u[1] * su * HALF_L; E[k++] = 0.55; }
    ud.eg.attributes.position.needsUpdate = true;
    wedge(ud.sheetGeo, e.from, e.n, e.u, e.c, e.w * 0.55, 0); wedge(ud.haloGeo, e.from, e.n, e.u, e.c, e.w, 0);
    ud.sheetMat.opacity = ud.haloMat.opacity = ud.edgeMat.opacity = 0;
    if (!ev.warm) api.game.sfx('fire', { rate: 0.4, vol: 0.5 });
  },
  update(e, dt, api) {
    const ud = e.vis.userData;
    e.appear = 1;
    const grow = smoothstep(0, 0.35, e.t);
    wedge(ud.sheetGeo, e.from, e.n, e.u, e.c, e.w * 0.55, grow); wedge(ud.haloGeo, e.from, e.n, e.u, e.c, e.w, grow);
    if (e.t < e.tel) {
      // the tell: a faint ghost of the sheet, flickering, its edges marked on the lane
      const k = e.t / e.tel, fl = 0.5 + 0.5 * Math.sin(e.t * 30);
      ud.haloMat.opacity = (0.03 + 0.06 * k) * fl; ud.sheetMat.opacity = 0; ud.edgeMat.opacity = (0.12 + 0.3 * k) * fl;
    } else if (e.t < e.tel + e.on) {
      const k = (e.t - e.tel) / e.on;
      if (!e.fired) { e.fired = true; api.game.shake(0.7); api.game.hitstop(0.04); api.game.sfx('g2-starfire', { vol: 0.9 }); }
      ud.sheetMat.opacity = 0.55 * (1 - k * 0.4) * (0.85 + 0.15 * Math.sin(e.t * 47));   // white-hot: dodge it
      ud.haloMat.opacity = 0.09 * (1 - k * 0.5); ud.edgeMat.opacity = 0.85 * (1 - k * 0.4);
      const s = api.ship, off = Math.abs(s.x * e.n[0] + s.y * e.n[1] - e.c);
      if (!e.hit && off < e.w + SHIP_R * 0.5 && !api.ship.invuln) { e.hit = true; api.game.damage(22, true); api.game.burst(s.x, s.y, 0, 36, { speed: 14, life: 0.5, s0: 1.5, r: 1, g: 1, b: 0.9, carry: 0 }); }
    } else {
      ud.sheetMat.opacity = Math.max(0, ud.sheetMat.opacity - dt * 3); ud.haloMat.opacity = Math.max(0, ud.haloMat.opacity - dt * 2); ud.edgeMat.opacity = Math.max(0, ud.edgeMat.opacity - dt * 4);
      if (e.t > e.tel + e.on + 0.35) e.alive = false;
    }
  },
  remove(e, api) { const ud = e.vis.userData; ud.sheetMat.opacity = ud.haloMat.opacity = ud.edgeMat.opacity = 0; api.course.put('g2-rootmind-starfire', e.vis); e.vis = null; },
  // the test pilots: off the band's middle line, the width of the band and a margin
  avoid(e) { const out = []; for (let s = -10; s <= 10; s += 1.6) out.push({ x: e.n[0] * e.c + e.u[0] * s, y: e.n[1] * e.c + e.u[1] * s, r: e.w + 1.0 }); return out; },
});

// =====================================================================================================================
// SAP-LIGHT. It pours out of a struck knot beside the lane and drifts into the lane as it comes (ev.x0, ev.y0: where it
// left the knot, metres; nx, ny: where it settles). It grows in over half a second.
let sapMat = null, coreGeo = null, coreMat = null;
export const sap = definePickup({
  name: 'g2-rootmind-sap',
  hazard: null,
  sample: { nx: 0, ny: 0 },
  init(api) {
    sapMat = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xd0ffb0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.9 });
    coreGeo = new THREE.OctahedronGeometry(0.55, 0); coreMat = new THREE.MeshBasicMaterial({ color: 0xf4fff0 });
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('g2-rootmind-sap', () => { const g = new THREE.Group(); const s = new THREE.Sprite(sapMat); s.scale.setScalar(3.4); g.add(s); const c = new THREE.Mesh(coreGeo, coreMat); g.add(c); g.userData.core = c; return g; });
    e.tx = e.x; e.ty = e.y; e.x0 = ev.x0 ?? e.x; e.y0 = ev.y0 ?? e.y; e.x = e.x0; e.y = e.y0;
    e.sx = e.sy = e.sz = 0.01; e.got = false;
  },
  update(e, dt, api) {
    const k = smoothstep(0, 1.2, e.t);
    e.x = e.x0 + (e.tx - e.x0) * k; e.y = e.y0 + (e.ty - e.y0) * k;
    e.sx = e.sy = e.sz = Math.min(1, e.t / 0.5);
    const c = e.obj.userData.core; c.rotation.y += dt * 4; c.rotation.x += dt * 2.6;
    api.pose(e);
    if (e.crossed && !e.got && Math.hypot(api.ship.x - e.x, api.ship.y - e.y) < RING_R + 0.3) {
      e.got = true; api.game.heal(7); api.game.greed(4); api.game.score(400 * api.game.mult, e.x, e.y + 1.2, 0, '', 'SAP-LIGHT');
      api.game.sfx('ring', { rate: 1.25, vol: 0.8 }); api.game.burst(e.x, e.y, 0, 18, { speed: 8, life: 0.4, s0: 0.9, r: 0.8, g: 1, b: 0.7, carry: 1 });
      e.alive = false;
    }
    if (e.z > 14) e.alive = false;
  },
});
