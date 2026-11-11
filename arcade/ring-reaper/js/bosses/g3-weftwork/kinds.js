// THE WEFTWORK's own machinery: what the boss puts on the course. Only the Weftwork uses these.
//  g3-weft-comb   THE BEAT: the beater slams and a comb of red reeds is driven at you, one gap in it, its plan drawn first
//  g3-weft-shear  THE SHEAR: two white-hot blades close across the lane from the sides; the one thing you cannot roll back
//  g3-weft-light  THREAD-LIGHT: what a struck reed spills (shield and points; not a ring, so the tally stays honest)
// Yori's pieces: the reed is her beater's reed (a red bar with its roots), the blades are her shear's blades; both are
// taken from js/bosses/g3-weftwork/mesh.js (her g3-bosses.js), and repeated or moved here, never redrawn.
import { THREE, definePickup, defineObstacle, buildModel, clamp, smoothstep, SHIP_R, RING_R } from '../../api.js?v=0.6.3';
import { MESH } from './mesh.js?v=0.6.3';

const RED = 0xff3355;
// keep the triangles of her groups whose centroid passes a test
export function pick(groups, keep) {
  return groups.map((g) => {
    const p = [];
    for (let i = 0; i < g.p.length; i += 9) { const c = [(g.p[i] + g.p[i + 3] + g.p[i + 6]) / 3, (g.p[i + 1] + g.p[i + 4] + g.p[i + 7]) / 3, (g.p[i + 2] + g.p[i + 5] + g.p[i + 8]) / 3]; if (keep(c, g)) for (let k = 0; k < 9; k++) p.push(g.p[i + k]); }
    return Object.assign({}, g, { p });
  }).filter((g) => g.p.length);
}
// her beater's reeds sit at these x (her units), ten of them: the comb has no reed in its middle (|x| < 4.5)
export const REED_X = (() => { const out = []; for (let i = 0; i < 14; i++) { const x = -16.5 + 33 * i / 13; if (Math.abs(x) >= 4.5) out.push(x); } return out; })();
// one reed, alone (its bar and its two roots), centred on x = 0
let REED = null;
export function reedGroups() {
  if (REED) return REED;
  const x0 = REED_X[REED_X.length - 1];
  const g = pick(MESH.beater, (c, gr) => gr.glow && gr.color === '#ff3355' && Math.abs(c[0] - x0) < 0.9);
  return (REED = g.map((q) => { const p = q.p.slice(); for (let i = 0; i < p.length; i += 3) { p[i] -= x0; p[i + 2] = 6 - p[i + 2]; } /* centred, her front (-Z) turned to you */ return Object.assign({}, q, { p }); }));
}

// =====================================================================================================================
// THE COMB. The beater slams forward and drives a comb of her reeds at you across the whole lane: red bars 1.25 m apart
// (too close to fly between) with ONE gap, `gw` metres wide at `gx`. The gap's plan (white, the galaxy's promise) shows
// on it all the way in. It leaves the loom at z0 and reaches your plane in T seconds, its gap outlined white in its last
// 0.35 s. ev: gnx (the gap's middle, normalised across the box), gw (default 3.6), T, z0.
const PITCH = 1.25, SPAN = 30, NREED = Math.round(SPAN * 2 / PITCH) + 1;
let reedGeo = null, reedMat = null, combBar = null, combBarMat = null, combPlanMat = null;
const tmpM = new THREE.Matrix4();
function makeComb() {
  const g = new THREE.Group();
  if (!reedGeo) { reedGeo = new THREE.BufferGeometry(); reedGeo.setAttribute('position', new THREE.Float32BufferAttribute(reedGroups().flatMap((q) => q.p), 3)); reedGeo.computeVertexNormals(); }
  // every reed of the comb in one draw: the ones in the gap are scaled to nothing
  const reeds = new THREE.InstancedMesh(reedGeo, reedMat, NREED); reeds.frustumCulled = false; g.add(reeds);
  // the beater's steel bars above and below the lane, carrying the reeds
  const top = new THREE.Mesh(combBar, combBarMat), bot = new THREE.Mesh(combBar, combBarMat);
  top.scale.set(SPAN * 2 + 2, 1.2, 1.2); bot.scale.set(SPAN * 2 + 2, 1.2, 1.2); top.position.y = 9.4; bot.position.y = -9.4; g.add(top, bot);
  // the gap's plan: two white uprights and a faint band
  const pl = new THREE.Mesh(combBar, combPlanMat), pr = new THREE.Mesh(combBar, combPlanMat);
  pl.scale.set(0.16, 18, 0.2); pr.scale.set(0.16, 18, 0.2); g.add(pl, pr);
  g.userData = { reeds, pl, pr };
  return g;
}
export const comb = defineObstacle({
  name: 'g3-weft-comb',
  motion: 'own', spawnAt: 'now',
  hazard: { cls: 'mover', introduced: [3, 10], warn: (ev) => (ev.T || 1.6) + 1.6 },
  sample: { gnx: 0, gw: 3.6, T: 1.6, z0: -140 },
  init() {
    reedMat = new THREE.MeshBasicMaterial({ color: RED, side: THREE.DoubleSide });
    combBar = new THREE.BoxGeometry(1, 1, 1);
    combBarMat = new THREE.MeshStandardMaterial({ color: 0x8a94a8, metalness: 0.5, roughness: 0.45, flatShading: true });
    combPlanMat = new THREE.MeshBasicMaterial({ color: 0xe8eeff, transparent: true, opacity: 0.85, depthWrite: false });
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('g3-weft-comb', makeComb);
    const ud = e.obj.userData;
    e.gx = clamp(ev.gnx || 0, -0.85, 0.85) * api.box.x; e.gw = ev.gw || 3.6;
    e.T = ev.T || 1.6; e.z0 = ev.z0 ?? -140; e.z = e.z0; e.x = 0; e.y = 0; e.sx = e.sy = e.sz = 1; e.hit = false; e.k = 0; e.appear = 0;
    for (let i = 0; i < NREED; i++) { const x = -SPAN + i * PITCH, s = Math.abs(x - e.gx) > e.gw / 2 ? 1 : 0.0001; ud.reeds.setMatrixAt(i, tmpM.makeScale(s, s, s).setPosition(x, 0, 0)); }
    ud.reeds.instanceMatrix.needsUpdate = true;
    ud.pl.position.set(e.gx - e.gw / 2, 0, -0.3); ud.pr.position.set(e.gx + e.gw / 2, 0, -0.3);
  },
  update(e, dt, api) {
    const ud = e.obj.userData;
    e.k += dt / e.T;
    e.z = e.z0 * (1 - Math.min(1, e.k)) + (e.k > 1 ? (e.k - 1) * e.T * 40 : 0);
    const left = e.T * (1 - e.k);
    ud.pl.material.color.setHex(left < 0.35 && left > -0.2 ? 0xffffff : 0xe8eeff);
    e.appear = Math.pow(Math.min(1, e.t / 0.5), 2); // it bursts out of the beater
    api.pose(e);
    if (e.k >= 1 && !e.done) {
      e.done = true;
      const off = Math.abs(api.ship.x - e.gx), m = SHIP_R * 0.6;
      if (off > e.gw / 2 - m) { e.hit = true; api.game.crash({ x: api.ship.x, y: api.ship.y, type: e.type, kind: e.kind }, 20); }
      else if (off > e.gw / 2 - m - 0.7) api.game.scrape(e, e.gw / 2 - off);
    }
    if (e.z > 30) e.alive = false;
  },
  avoid(e) { const R = 60; return [{ x: e.gx - e.gw / 2 - R, y: 0, r: R + 1.0 }, { x: e.gx + e.gw / 2 + R, y: 0, r: R + 1.0 }]; },
});

// =====================================================================================================================
// THE SHEAR. The loom's cutter: two of her white-hot blades close across the lane from the sides, leaving one gap,
// `gw` metres wide at `gx`. For `tel` seconds (1.5) the gap shows as a white plan in front of you and the blades wait,
// glowing, beyond the lane's edges; then they close (0.16 s), hold (`on`, 0.5 s) and part. Nothing sends it back.
// Like galaxy 1's great beam, the entity sits just ahead of your plane; its picture is drawn in the world (e.vis).
// ev: gnx, gw (default 3.4), tel, on.
let SHEAR = null, shearMat = null, shearPlanMat = null, shearBox = null;
function makeShear() {
  if (!SHEAR) {
    // her two blades and their steel backs, split by side, each moved so its cutting point sits at x = 0
    SHEAR = { L: pick(MESH.shear, (c) => c[0] < 0), R: pick(MESH.shear, (c) => c[0] > 0) };
  }
  const g = new THREE.Group();
  const side = (k) => {
    const b = buildModel(SHEAR[k], { own: ['#ffffff*'] }).group, holder = new THREE.Group();
    b.position.set(k === 'L' ? 22 - 5.5 : -22 + 5.5, 0, 4); holder.add(b);
    holder.scale.setScalar(0.62); g.add(holder); return holder;
  };
  const L = side('L'), R = side('R');
  const glowL = new THREE.Mesh(shearBox, shearMat.clone()), glowR = new THREE.Mesh(shearBox, shearMat.clone());
  g.add(glowL, glowR);
  const pl = new THREE.Mesh(shearBox, shearPlanMat.clone()), pr = new THREE.Mesh(shearBox, shearPlanMat.clone());
  g.add(pl, pr);
  g.userData = { L, R, glowL, glowR, pl, pr };
  return g;
}
export const shear = defineObstacle({
  name: 'g3-weft-shear',
  motion: 'own', spawnAt: 'now',
  hazard: { cls: 'sweep', introduced: [3, 10], warn: (ev) => ev.tel || 1.5 },
  sample: { gnx: 0, gw: 3.4, warm: true },
  init() {
    shearBox = new THREE.BoxGeometry(1, 1, 1);
    shearMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    shearPlanMat = new THREE.MeshBasicMaterial({ color: 0xe8eeff, transparent: true, opacity: 0, depthWrite: false, fog: false });
  },
  spawn(e, ev, api) {
    e.vis = api.course.get('g3-weft-shear', makeShear);
    e.x = 0; e.y = 0; e.z = -2; e.sx = e.sy = e.sz = 1; e.appear = 1; e.hit = false;
    e.gx = clamp(ev.gnx || 0, -0.8, 0.8) * api.box.x; e.gw = ev.gw || 3.4; e.tel = ev.tel ?? 1.5; e.on = ev.on ?? 0.5;
    e.out = api.box.x + 9; // where the blades wait: beyond the lane's edges
  },
  update(e, dt, api) {
    const ud = e.vis.userData, close = 0.16, t = e.t, T1 = e.tel, T2 = T1 + close, T3 = T2 + e.on, T4 = T3 + 0.35;
    let k = 0; // 0 waiting at the edges, 1 shut on the gap
    if (t > T1 && t <= T2) k = smoothstep(0, 1, (t - T1) / close); else if (t > T2 && t <= T3) k = 1; else if (t > T3) k = 1 - clamp((t - T3) / 0.35, 0, 1);
    if (t > T1 && !e.slam) { e.slam = true; api.game.sfx('g3-shear', { vol: 0.9 }); api.game.shake(0.7); api.game.hitstop(0.04); }
    // each blade's cutting point: from beyond the edge to the gap's edge
    const xl = -e.out + (e.gx - e.gw / 2 + e.out) * k, xr = e.out + (e.gx + e.gw / 2 - e.out) * k;
    ud.L.position.set(xl, 0, -3); ud.R.position.set(xr, 0, -3);
    // the white-hot sheet each blade sweeps (everything outside the gap), so where it cuts is never in doubt
    const hot = k > 0 ? (0.25 + 0.3 * k) * (0.85 + 0.15 * Math.sin(t * 50)) : 0.05 + 0.08 * clamp(t / T1, 0, 1);
    const wl = Math.max(0.01, xl + e.out + 30), wr = Math.max(0.01, e.out + 30 - xr);
    ud.glowL.scale.set(wl, 16, 0.4); ud.glowL.position.set(xl - wl / 2, 0, -3); ud.glowL.material.opacity = k > 0 ? hot : 0;
    ud.glowR.scale.set(wr, 16, 0.4); ud.glowR.position.set(xr + wr / 2, 0, -3); ud.glowR.material.opacity = k > 0 ? hot : 0;
    // the plan of the gap: two white uprights where the blades will stop, drawn in through the tell
    const draw = smoothstep(0, 0.3, t), pOp = t < T3 ? (t < T1 ? 0.75 + 0.25 * Math.sin(t * 22) : 0.4) : 0;
    for (const [p, x] of [[ud.pl, e.gx - e.gw / 2], [ud.pr, e.gx + e.gw / 2]]) { p.scale.set(0.12, 14 * draw, 0.12); p.position.set(x, 0, -4); p.material.opacity = pOp; }
    e.vis.position.set(0, 0, 0); e.vis.scale.setScalar(1);
    // the cut: once, while the blades are shut (or shutting past half)
    if (!e.hit && k > 0.5 && t < T3 && !api.ship.invuln) {
      const off = Math.abs(api.ship.x - e.gx), m = SHIP_R * 0.6;
      if (off > e.gw / 2 - m) { e.hit = true; api.game.damage(26, true); api.game.burst(api.ship.x, api.ship.y, 0, 40, { speed: 14, life: 0.5, s0: 1.6, r: 1, g: 1, b: 1, carry: 0 }); }
    }
    if (t > T4) e.alive = false;
  },
  remove(e, api) { api.course.put('g3-weft-shear', e.vis); e.vis = null; },
  avoid(e) { const R = 60; return [{ x: e.gx - e.gw / 2 - R, y: 0, r: R + 1.0 }, { x: e.gx + e.gw / 2 + R, y: 0, r: R + 1.0 }]; },
});

// =====================================================================================================================
// THREAD-LIGHT. A struck reed spills it: an amber spark (rule 9: amber is what you collect) trailing a short violet thread.
// Fly through it for shield and points, so the shield can be won back while the fight holds the course (rule 7). Not a
// ring: never in RINGS or a PERFECT.
let lightMat = null, threadMat = null, coreGeo = null, coreMat = null;
export const light = definePickup({
  name: 'g3-weft-light',
  hazard: null,
  init(api) {
    lightMat = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffcc33, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.9 });
    threadMat = new THREE.SpriteMaterial({ map: api.glowTex, color: 0x9a6aff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6 });
    coreGeo = new THREE.OctahedronGeometry(0.55, 0); coreMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('g3-weft-light', () => {
      const g = new THREE.Group(), s = new THREE.Sprite(lightMat); s.scale.setScalar(3.2); g.add(s);
      const tail = new THREE.Sprite(threadMat); tail.scale.set(0.5, 3.6, 1); tail.position.z = -2.2; g.add(tail);
      const c = new THREE.Mesh(coreGeo, coreMat); g.add(c); g.userData.core = c; return g;
    });
    e.sx = e.sy = e.sz = 0.01; e.got = false;
  },
  update(e, dt, api) {
    e.sx = e.sy = e.sz = Math.min(1, e.t / 0.4);
    e.obj.userData.core.rotation.y += dt * 4; e.obj.userData.core.rotation.x += dt * 2.6;
    api.pose(e);
    if (e.crossed && !e.got && Math.hypot(api.ship.x - e.x, api.ship.y - e.y) < RING_R + 0.3) {
      e.got = true; api.game.heal(7); api.game.greed(4); api.game.score(400 * api.game.mult, e.x, e.y + 1.2, 0, '', 'THREAD-LIGHT');
      api.game.sfx('ring', { rate: 1.3, vol: 0.8 }); api.game.burst(e.x, e.y, 0, 18, { speed: 8, life: 0.4, s0: 0.9, r: 1, g: 0.8, b: 0.25, carry: 1 });
      e.alive = false;
    }
    if (e.z > 14) e.alive = false;
  },
});
