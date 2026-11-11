// LEVEL 10 kinds: the Heart's own machinery. Everything here is new to level 10 and only level 10 uses it.
//  l10-defence-ring  act 1: an orbital ring 100 across, its shutter blades turning across the lane; fly a gap
//  l10-ram           act 2: a piston ram that slams in from the tunnel wall after its caps glow (escape: dead, still)
//  l10-iris          act 2: an iris door whose six blades close to a hexagonal hole; be in the hole
//  l10-wall          the core: the Heart's piston wall, driven at you with one gap in it
//  l10-beam          the core: THE GREAT BEAM, the one thing in the game that cannot be sent back
//  l10-debris        the escape: a torn armour plate tumbling across the lane
// Every hazard is timed by its time to arrival (-z / speed), never by the clock, so its state when it reaches you is
// the one the course was laid out for at any speed, GREED included, and its tell always runs for its full length.
import { THREE, defineObstacle, definePickup, buildModel, modelGroups, smoothstep, SHIP_R, READ_D, RING_R, Instanced } from '../../api.js?v=0.6.3';
import { MESH } from './mesh.js?v=0.6.3';
import { MESH as HEART } from '../../bosses/lattice-heart/mesh.js?v=0.6.3';

const RED = 0xff3355, PLATE = 0x4a5070, DARK = 0x2a1018, TRUSS = 0x2a2e44;
const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const arriveOf = (e, api) => -e.z / Math.max(1, api.v);
// a hit from a big structure: the burst comes from where the ship is
const crash = (api, e, dmg) => api.game.crash({ x: api.ship.x, y: api.ship.y, type: e.type, kind: e.kind }, dmg);
let glowMat = null;
const glowSprite = (api, color, s) => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  sp.scale.setScalar(s); return sp;
};
// keep only the triangles of a mesh group list that pass a test on their centroid (Yori's iris frame without its blades)
function filterGroups(groups, keep) {
  return groups.map((g) => {
    const p = [];
    for (let i = 0; i < g.p.length; i += 9) {
      const cx = (g.p[i] + g.p[i + 3] + g.p[i + 6]) / 3, cy = (g.p[i + 1] + g.p[i + 4] + g.p[i + 7]) / 3;
      if (keep(cx, cy, g)) for (let k = 0; k < 9; k++) p.push(g.p[i + k]);
    }
    return Object.assign({}, g, { p });
  }).filter((g) => g.p.length);
}

// =====================================================================================================================
// THE DEFENCE RING. Yori's ring, 100 across, facing you, with 2 to 4 shutter blades (slate plate, red edges) from its hub
// to its rim, turning about the lane. The open sectors between the blades are the way through; the course puts amber
// rings in the one it wants you to take. ev: blades, width (radians each), spin (rad/s, signed), gnx/gny (the direction
// of that gap at arrival, in the normalised box), scale (1).
const HUB_R = 1.7, BLADE_R = 47;
const bladeGeo = {};
function bladeGeometry(w) {
  const k = Math.round(w * 100);
  if (bladeGeo[k]) return bladeGeo[k];
  const s = new THREE.Shape(), n = 18;
  s.moveTo(Math.cos(-w / 2) * HUB_R, Math.sin(-w / 2) * HUB_R);
  for (let i = 0; i <= n; i++) { const a = -w / 2 + w * i / n; s.lineTo(Math.cos(a) * BLADE_R, Math.sin(a) * BLADE_R); }
  for (let i = n; i >= 0; i--) { const a = -w / 2 + w * i / n; s.lineTo(Math.cos(a) * HUB_R, Math.sin(a) * HUB_R); }
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.2, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -0.6);
  return (bladeGeo[k] = g);
}
let ringParts = null, edgeGeo = null, edgeMat = null, bladeMat = null, hubGeo = null, hubMat = null;
function makeRing(api) {
  const g = new THREE.Group();
  const ring = buildModel(MESH.defring).group; g.add(ring);
  const blades = new THREE.Group(); g.add(blades);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Group();
    b.add(new THREE.Mesh(bladeGeometry(1), bladeMat));
    for (const sgn of [-1, 1]) { const ed = new THREE.Mesh(edgeGeo, edgeMat); ed.userData.sgn = sgn; b.add(ed); }
    blades.add(b);
  }
  const hub = new THREE.Mesh(hubGeo, hubMat); g.add(hub);
  const core = glowSprite(api, RED, 5); core.material.opacity = 0.8; g.add(core);
  g.userData = { ring, blades, hub, core };
  return g;
}
export const defenceRing = defineObstacle({
  name: 'l10-defence-ring',
  // it turns, and it is in sight from READ_D on; the open sector is lit with rings
  hazard: { cls: 'sweep', introduced: 10, warn: (ev, v) => READ_D / v },
  sample: { blades: 3, width: 1.1, spin: 0.4, gnx: 1, gny: 0 },
  // 0.3.1, check-levels' "no fully blocked moment": its solid shape as it crosses the ship's plane, as the distance from
  // a ship centre (x, y) to its surface (the kind's own hit test is that distance under part of SHIP_R)
  solid(ev, B) {
    const n = ev.blades || 3, w = ev.width || 1.0, rot = Math.atan2((ev.gny || 0) * B.y, (ev.gnx ?? 1) * B.x);
    return [{ dist: (x, y) => { const rho = Math.hypot(x, y), phi = Math.atan2(y, x); let near = 9; for (let k = 0; k < n; k++) near = Math.min(near, Math.abs(angDiff(phi, rot + (k + 0.5) * TAU / n)) - w / 2); return Math.min(rho - HUB_R, near < 0 ? -0.01 : rho * Math.sin(Math.min(near, Math.PI / 2))); } }];
  },
  init() {
    bladeMat = new THREE.MeshStandardMaterial({ color: PLATE, metalness: 0.45, roughness: 0.5, flatShading: true, side: THREE.DoubleSide });
    edgeGeo = new THREE.BoxGeometry(BLADE_R - HUB_R, 0.42, 1.5); edgeGeo.translate((BLADE_R + HUB_R) / 2, 0, 0);
    edgeMat = new THREE.MeshBasicMaterial({ color: RED });
    hubGeo = new THREE.CylinderGeometry(HUB_R + 0.3, HUB_R + 0.3, 1.8, 8); hubGeo.rotateX(Math.PI / 2);
    hubMat = new THREE.MeshStandardMaterial({ color: DARK, metalness: 0.5, roughness: 0.45, flatShading: true });
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('l10-defence-ring', () => makeRing(api));
    const ud = e.obj.userData, B = api.box;
    e.x = 0; e.y = 0; e.n = ev.blades || 3; e.w = ev.width || 1.0; e.spin = ev.spin || 0;
    e.gap = Math.atan2((ev.gny || 0) * B.y, (ev.gnx ?? 1) * B.x);
    e.sx = e.sy = e.sz = ev.scale || 1; e.hit = false; e.tilt = ev.tilt || 0;
    ud.blades.children.forEach((b, i) => {
      b.visible = i < e.n;
      b.children[0].geometry = bladeGeometry(e.w);
      b.rotation.z = (i + 0.5) * TAU / e.n;
      for (const ed of b.children.slice(1)) ed.rotation.z = ed.userData.sgn * e.w / 2;
    });
  },
  update(e, dt, api) {
    const ud = e.obj.userData, arrive = arriveOf(e, api);
    e.rot = e.gap - e.spin * arrive;               // at arrival the chosen gap faces ev's direction
    ud.blades.rotation.z = e.rot;
    ud.ring.rotation.z = -e.rot * 0.25;
    ud.core.material.opacity = 0.55 + 0.35 * Math.sin(e.t * 6);
    api.pose(e);
    if (e.crossed && !e.hit) {
      const s = api.ship, rho = Math.hypot(s.x, s.y), phi = Math.atan2(s.y, s.x);
      const m = Math.asin(Math.min(1, SHIP_R * 0.6 / Math.max(rho, 0.01)));
      let near = 9;
      for (let k = 0; k < e.n; k++) near = Math.min(near, Math.abs(angDiff(phi, e.rot + (k + 0.5) * TAU / e.n)) - e.w / 2);
      if (rho < HUB_R + SHIP_R * 0.6 || near < m) { e.hit = true; crash(api, e, 22); }
      else if (near < m + 0.16) api.game.scrape(e, near);
    }
    if (e.z > 60) e.alive = false;
  },
  // the test autopilot: stay off the blades' centre lines and the hub
  avoid(e) {
    const out = [{ x: 0, y: 0, r: HUB_R + 2.2 }];
    for (let k = 0; k < e.n; k++) { const a = e.gap + (k + 0.5) * TAU / e.n; for (const r of [3, 5.5, 8, 10.5]) out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, r: 1.2 + r * Math.sin(e.w / 2) + 1.0 }); }
    return out;
  },
});

// =====================================================================================================================
// THE RAM. A piston ram in the tunnel wall: a slab of the Heart's plate with a red leading edge and three red caps.
// Its caps glow (the tell), then it slams across the lane, its edge stopping at `edge` (normalised: for a ram from the
// top, edge 0.2 means it fills everything above ny = 0.2). ev: side 'top' | 'bottom' | 'left' | 'right', edge, tel
// (s, default 1.2), lead (s before arrival the stroke ends, default 1.0), still (the escape's dead rams: already out).
const WALL = 15, STROKE = 0.24;
let ramBodyMat = null, ramEdgeMat = null, ramBoxGeo = null;
const axisOf = (side) => (side === 'top' || side === 'bottom' ? 'y' : 'x');
const signOf = (side) => (side === 'top' || side === 'right' ? 1 : -1);
// the ram's edge in metres along its axis: home in the wall at k = 0, `edge` of the box at k = 1
function ramEdge(e, api) {
  const half = e.ax === 'y' ? api.box.y : api.box.x;
  const out = e.sg * (e.ev.edge ?? 0.2) * half, home = e.sg * (WALL - 1);
  return home + (out - home) * e.k;
}
function makeRam(api) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(ramBoxGeo, ramBodyMat); g.add(body);
  const edge = new THREE.Mesh(ramBoxGeo, ramEdgeMat); g.add(edge);
  const pistons = [];
  for (let i = 0; i < 3; i++) { const p = buildModel(MESH.piston); g.add(p.group); pistons.push(p.group); }
  const caps = [0, 1, 2].map(() => { const c = glowSprite(api, RED, 3.2); g.add(c); return c; });
  g.userData = { body, edge, pistons, caps };
  return g;
}
export const ram = defineObstacle({
  name: 'l10-ram',
  hazard: { cls: 'sweep', introduced: 10, warn: (ev) => (ev.still ? 99 : (ev.lead ?? 1.0) + STROKE + (ev.tel ?? 1.2)) },
  sample: { side: 'top', edge: 0.2 },
  // 0.3.1, check-levels' "no fully blocked moment": its solid shape as it crosses the ship's plane, as the distance from
  // a ship centre (x, y) to its surface (the kind's own hit test is that distance under part of SHIP_R)
  // (its edge, out: everything on its side of `edge` along its axis is solid)
  solid(ev, B) { const side = ev.side || 'top', ax = axisOf(side), sg = signOf(side), at = sg * (ev.edge ?? 0.2) * (ax === 'y' ? B.y : B.x); return [{ dist: (x, y) => sg * (at - (ax === 'y' ? y : x)) }]; },
  init() {
    ramBodyMat = new THREE.MeshStandardMaterial({ color: PLATE, metalness: 0.45, roughness: 0.5, flatShading: true });
    ramEdgeMat = new THREE.MeshBasicMaterial({ color: RED });
    ramBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('l10-ram', () => makeRam(api));
    e.x = 0; e.y = 0; e.sx = e.sy = e.sz = 1;
    e.side = ev.side || 'top'; e.ax = axisOf(e.side); e.sg = signOf(e.side);
    e.tel = ev.tel ?? 1.2; e.lead = ev.lead ?? 1.0; e.hit = false;
    e.k = ev.still ? 1 : 0; e._box = api.box; e.slam = false;
  },
  update(e, dt, api) {
    const ud = e.obj.userData, arrive = arriveOf(e, api), still = e.ev.still;
    let glow = 0;
    if (!still) {
      const t1 = e.lead, t0 = t1 + STROKE, tt = t0 + e.tel;
      if (arrive > tt) e.k = 0;
      else if (arrive > t0) { e.k = 0; glow = 1 - (arrive - t0) / e.tel; }
      else if (arrive > t1) { const u = 1 - (arrive - t1) / STROKE; e.k = u * u; glow = 1; if (!e.slam && u > 0.95) { e.slam = true; if (e.z > -260) { api.game.shake(0.25); api.game.sfx('boom', { rate: 1.7, vol: 0.3, pan: e.sg * (e.ax === 'x' ? 0.6 : 0) }); } } }
      else { e.k = arrive > -0.3 ? 1 : Math.max(0, 1 - (-0.3 - arrive) * 1.5); glow = 0.6; }
    } else glow = 0.25 + 0.15 * Math.sin(e.t * 3);
    const edge = ramEdge(e, api), back = e.sg * (WALL + 6), len = Math.abs(back - edge), mid = (back + edge) / 2;
    const W = 40, D = 3.2;
    if (e.ax === 'y') {
      ud.body.scale.set(W, len, D); ud.body.position.set(0, mid, 0);
      ud.edge.scale.set(W, 0.5, D + 0.2); ud.edge.position.set(0, edge, 0);
      ud.pistons.forEach((p, i) => { p.rotation.set(0, 0, e.sg > 0 ? 0 : Math.PI); p.position.set((i - 1) * 9, edge + e.sg * 9.6, -1.9); });
      ud.caps.forEach((c, i) => c.position.set((i - 1) * 9, edge, -2));
    } else {
      ud.body.scale.set(len, W, D); ud.body.position.set(mid, 0, 0);
      ud.edge.scale.set(0.5, W, D + 0.2); ud.edge.position.set(edge, 0, 0);
      ud.pistons.forEach((p, i) => { p.rotation.set(0, 0, e.sg > 0 ? Math.PI / 2 : -Math.PI / 2); p.position.set(edge + e.sg * 9.6, (i - 1) * 7, -1.9); });
      ud.caps.forEach((c, i) => c.position.set(edge, (i - 1) * 7, -2));
    }
    const pulse = glow >= 1 ? 1 : glow * (0.6 + 0.4 * Math.sin(e.t * 30));
    for (const c of ud.caps) { c.material.opacity = 0.15 + 0.85 * pulse; c.scale.setScalar(3 + 4 * pulse); }
    api.pose(e);
    if (e.crossed && !e.hit) {
      const s = api.ship, p = e.ax === 'y' ? s.y : s.x, m = SHIP_R * 0.7;
      const inside = e.sg > 0 ? p + m > edge : p - m < edge;
      if (inside) { e.hit = true; crash(api, e, 20); }
      else if (Math.abs(p - edge) < m + 0.7) api.game.scrape(e, Math.abs(p - edge));
    }
    if (e.z > 30) e.alive = false;
  },
  avoid(e) {
    const edge = e.ev.edge ?? 0.2, R = 60, box = e._box || { x: 7.5, y: 4.3 };
    const half = e.ax === 'y' ? box.y : box.x, ep = e.sg * edge * half;
    return e.ax === 'y' ? [{ x: 0, y: ep + e.sg * R, r: R + 1.7 }] : [{ x: ep + e.sg * R, y: 0, r: R + 1.7 }];
  },
});

// =====================================================================================================================
// THE IRIS DOOR. Yori's frame (30 across, a red seam inside it) round a hexagonal hole whose six blades close as you
// come. The frame's seam pulses (the tell), then the blades close to `a` metres (the hole's inner radius) and hold.
// ev: cnx, cny (the hole's centre, normalised), a (default 3.2), tel (1.3), close (1.0), lead (0.45).
const IRIS_OUT = 14.4, TAN30 = Math.tan(Math.PI / 6);
let irisFrameGroups = null, irisBladeMat = null, irisTipMat = null;
function makeIris(api) {
  const g = new THREE.Group();
  const frame = buildModel(irisFrameGroups, { own: ['#ff3355*'] }); g.add(frame.group);
  // the six blades, rebuilt each frame from the hole's size: front, back and the inner edge of each
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6 * 18 * 3), 3));
  const blades = new THREE.Mesh(bg, irisBladeMat); g.add(blades);
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6 * 6 * 3), 3));
  const tips = new THREE.Mesh(tg, irisTipMat); g.add(tips);
  blades.frustumCulled = false; tips.frustumCulled = false;
  g.userData = { frame, seam: frame.mats['#ff3355*'], blades, tips, a: -1 };
  return g;
}
function setIris(ud, a) {
  if (Math.abs(ud.a - a) < 0.003) return;
  ud.a = a;
  const P = ud.blades.geometry.attributes.position.array, T = ud.tips.geometry.attributes.position.array;
  let p = 0, q = 0;
  const put = (A, i, x, y, z) => { A[i] = x; A[i + 1] = y; A[i + 2] = z; return i + 3; };
  for (let k = 0; k < 6; k++) {
    const ang = k * Math.PI / 3, c = Math.cos(ang), s = Math.sin(ang);
    const rot = (x, y) => [x * c - y * s, x * s + y * c];
    const il = rot(-a * TAN30, a), ir = rot(a * TAN30, a), ol = rot(-IRIS_OUT * TAN30, IRIS_OUT), or = rot(IRIS_OUT * TAN30, IRIS_OUT);
    for (const z of [-0.45, 0.45]) { // the two faces
      p = put(P, p, il[0], il[1], z); p = put(P, p, ir[0], ir[1], z); p = put(P, p, or[0], or[1], z);
      p = put(P, p, il[0], il[1], z); p = put(P, p, or[0], or[1], z); p = put(P, p, ol[0], ol[1], z);
    }
    // the inner edge, facing the hole
    p = put(P, p, il[0], il[1], -0.45); p = put(P, p, ir[0], ir[1], -0.45); p = put(P, p, ir[0], ir[1], 0.45);
    p = put(P, p, il[0], il[1], -0.45); p = put(P, p, ir[0], ir[1], 0.45); p = put(P, p, il[0], il[1], 0.45);
    // its red lip on the face toward you (+Z is toward the ship)
    const w = 0.38, i2 = rot(-(a + w) * TAN30, a + w), r2 = rot((a + w) * TAN30, a + w);
    q = put(T, q, il[0], il[1], 0.5); q = put(T, q, ir[0], ir[1], 0.5); q = put(T, q, r2[0], r2[1], 0.5);
    q = put(T, q, il[0], il[1], 0.5); q = put(T, q, r2[0], r2[1], 0.5); q = put(T, q, i2[0], i2[1], 0.5);
  }
  ud.blades.geometry.attributes.position.needsUpdate = true; ud.tips.geometry.attributes.position.needsUpdate = true;
  ud.blades.geometry.computeVertexNormals();
}
export const iris = defineObstacle({
  name: 'l10-iris',
  hazard: { cls: 'sweep', introduced: 10, warn: (ev) => (ev.lead ?? 0.45) + (ev.close ?? 1.0) + (ev.tel ?? 1.3) },
  sample: { cnx: 0, cny: 0, a: 3.2 },
  // 0.3.1, check-levels' "no fully blocked moment": its solid shape as it crosses the ship's plane, as the distance from
  // a ship centre (x, y) to its surface (the kind's own hit test is that distance under part of SHIP_R)
  solid: (ev, B) => [{ dist: (x, y) => (ev.a || 3.2) - Math.hypot(x - (ev.cnx || 0) * B.x, y - (ev.cny || 0) * B.y) }],
  init() {
    irisFrameGroups = filterGroups(MESH.iris, (x, y, g) => g.color !== '#140408' && Math.hypot(x, y) > 12.4);
    irisBladeMat = new THREE.MeshStandardMaterial({ color: PLATE, metalness: 0.45, roughness: 0.5, flatShading: true, side: THREE.DoubleSide });
    irisTipMat = new THREE.MeshBasicMaterial({ color: RED, side: THREE.DoubleSide });
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('l10-iris', () => makeIris(api));
    e.x = (ev.cnx || 0) * api.box.x; e.y = (ev.cny || 0) * api.box.y;
    e.sx = e.sy = e.sz = 1; e.a1 = ev.a || 3.2; e.hit = false;
    e.tel = ev.tel ?? 1.3; e.close = ev.close ?? 1.0; e.lead = ev.lead ?? 0.45;
    e.obj.rotation.z = (ev.turn || 0);
  },
  update(e, dt, api) {
    const ud = e.obj.userData, arrive = arriveOf(e, api), t1 = e.lead, t0 = t1 + e.close, tt = t0 + e.tel, A0 = 13.2;
    let a = A0, tell = 0;
    if (arrive > tt) a = A0;
    else if (arrive > t0) { tell = 1 - (arrive - t0) / e.tel; }
    else if (arrive > t1) { const u = smoothstep(0, 1, 1 - (arrive - t1) / e.close); a = A0 + (e.a1 - A0) * u; tell = 1; }
    else { a = e.a1; tell = 1; }
    e.aNow = a;
    setIris(ud, a);
    const pk = tell >= 1 ? 1 : tell * (0.55 + 0.45 * Math.sin(e.t * 28));
    ud.seam.color.setRGB(0.55 + 0.45 * pk, 0.12 + 0.2 * pk * pk, 0.2 + 0.2 * pk * pk);
    e.obj.rotation.z += dt * 0.15 * (e.ev.spin || 0);
    api.pose(e);
    if (e.crossed && !e.hit) {
      const d = Math.hypot(api.ship.x - e.x, api.ship.y - e.y), m = SHIP_R * 0.6;
      if (d > e.a1 - m) { e.hit = true; crash(api, e, 24); }
      else if (d > e.a1 - m - 0.7) api.game.scrape(e, e.a1 - d);
    }
    if (e.z > 30) e.alive = false;
  },
  avoid(e) {
    const out = [], a = e.a1;
    for (let k = 0; k < 10; k++) { const ang = k / 10 * TAU; out.push({ x: e.x + Math.cos(ang) * (a + 6), y: e.y + Math.sin(ang) * (a + 6), r: 6.6 }); }
    return out;
  },
});

// =====================================================================================================================
// THE PISTON WALL (the core, phase 3). The Heart drives a wall of its plating at you with one gap in it. The gap's
// edges glow red while it comes and turn white in its last 0.35 s. It is fired from the Heart's own z and reaches you
// in ev.T seconds. ev: gnx, gny (the gap's centre, normalised), gw, gh (the gap in metres), T (1.8), z0.
let wallMat = null, wallEdgeMat = null, wallBox = null, barMat = null;
function makeWall() {
  const g = new THREE.Group();
  const blocks = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(wallBox, wallMat); g.add(m); return m; });
  const edges = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(wallBox, wallEdgeMat); g.add(m); return m; });
  const bars = [];
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(wallBox, barMat); g.add(m); bars.push(m); }
  g.userData = { blocks, edges, bars };
  return g;
}
export const wall = defineObstacle({
  name: 'l10-wall',
  motion: 'own', spawnAt: 'now',
  hazard: { cls: 'mover', introduced: 10, warn: (ev) => ev.T || 1.8 },
  sample: { gnx: 0, gny: 0, gw: 4.2, gh: 3.6, T: 1.8, z0: -120 },
  init() {
    wallBox = new THREE.BoxGeometry(1, 1, 1);
    wallMat = new THREE.MeshStandardMaterial({ color: PLATE, metalness: 0.45, roughness: 0.5, flatShading: true });
    barMat = new THREE.MeshStandardMaterial({ color: TRUSS, metalness: 0.55, roughness: 0.45, flatShading: true });
    wallEdgeMat = new THREE.MeshBasicMaterial({ color: RED });
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('l10-wall', makeWall);
    const B = api.box, ud = e.obj.userData;
    e.gx = (ev.gnx || 0) * B.x; e.gy = (ev.gny || 0) * B.y; e.gw = ev.gw || 4.2; e.gh = ev.gh || 3.6;
    e.T = ev.T || 1.8; e.z0 = ev.z0 ?? -120; e.z = e.z0; e.x = 0; e.y = 0; e.sx = e.sy = e.sz = 1; e.hit = false; e.k = 0; e.appear = 0;
    const L = e.gx - e.gw / 2, R = e.gx + e.gw / 2, Bt = e.gy - e.gh / 2, Tp = e.gy + e.gh / 2, X = 26, Y = 20, D = 2.2;
    const set = (m, x0, x1, y0, y1, d) => { m.scale.set(Math.max(0.01, x1 - x0), Math.max(0.01, y1 - y0), d); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); };
    set(ud.blocks[0], -X, L, -Y, Y, D); set(ud.blocks[1], R, X, -Y, Y, D); set(ud.blocks[2], L, R, Tp, Y, D); set(ud.blocks[3], L, R, -Y, Bt, D);
    const w = 0.34;
    set(ud.edges[0], L - w, L, Bt - w, Tp + w, D + 0.3); set(ud.edges[1], R, R + w, Bt - w, Tp + w, D + 0.3);
    set(ud.edges[2], L - w, R + w, Tp, Tp + w, D + 0.3); set(ud.edges[3], L - w, R + w, Bt - w, Bt, D + 0.3);
    // truss bars standing proud of the plating, off the gap
    ud.bars.forEach((m, i) => { const x = -X + (i + 0.5) * (2 * X / ud.bars.length); const off = x > L - 0.6 && x < R + 0.6; m.visible = !off; m.scale.set(0.55, 2 * Y, 0.6); m.position.set(x, 0, 1.4); });
  },
  update(e, dt, api) {
    const ud = e.obj.userData;
    e.k += dt / e.T;
    e.z = e.z0 * (1 - e.k);
    const left = e.T * (1 - e.k);
    const white = left < 0.35 && left > -0.2;
    wallEdgeMat.color.setHex(white ? 0xffffff : RED);
    e.appear = Math.pow(Math.min(1, e.t / 0.7), 3); // grows out of the socket over 0.7 s, slowly at first (it is 52 m wide)
    api.pose(e);
    if (e.k >= 1 && !e.hit && !e.done) {
      e.done = true;
      const s = api.ship, m = SHIP_R * 0.6;
      const inGap = Math.abs(s.x - e.gx) < e.gw / 2 - m && Math.abs(s.y - e.gy) < e.gh / 2 - m;
      if (!inGap) { e.hit = true; crash(api, e, 22); }
      else api.game.scrape(e, 0.3);
    }
    if (e.z > 30) e.alive = false;
  },
  avoid(e) {
    const out = [];
    const L = e.gx - e.gw / 2, R = e.gx + e.gw / 2, B = e.gy - e.gh / 2, T = e.gy + e.gh / 2;
    out.push({ x: L - 40, y: e.gy, r: 40 + 1.2 }, { x: R + 40, y: e.gy, r: 40 + 1.2 }, { x: e.gx, y: T + 40, r: 40 + 1.2 }, { x: e.gx, y: B - 40, r: 40 + 1.2 });
    return out;
  },
});

// =====================================================================================================================
// THE GREAT BEAM. A wedge of white fire from the Heart's pupil that covers most of the lane for 1.5 s. Its tell
// (1.3 s) is a faint white ghost of the wedge, flickering, with the eye's pupil shrinking and a magenta ring growing
// thinnest on the safe side (the boss draws those). It is the one thing in the game a roll cannot send back.
// ev: dir (radians: the direction of the covered side from the lane's centre), cover (how far past the centre line
// it reaches, metres), tel (1.3), on (1.5), from: { x, y, z } the pupil.
let beamMat = null, beamCoreMat = null, beamEdgeMat = null;
function makeBeam() {
  const g = new THREE.Group();
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(8 * 3), 3));
  geo.setIndex([0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7, 4, 5, 6, 4, 6, 7]);
  const m = new THREE.Mesh(geo, beamMat); m.frustumCulled = false; g.add(m);
  const core = new THREE.Mesh(geo, beamCoreMat); core.frustumCulled = false; g.add(core);
  // its edge: a bright curtain along the line the beam stops at, so where it ends is never in doubt
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(4 * 3), 3)); eg.setIndex([0, 1, 2, 0, 2, 3]);
  const edge = new THREE.Mesh(eg, beamEdgeMat); edge.frustumCulled = false; g.add(edge);
  g.userData = { m, core, geo, edge, eg };
  return g;
}
export const beam = defineObstacle({
  name: 'l10-beam',
  motion: 'own', spawnAt: 'now',
  hazard: { cls: 'sweep', introduced: 10, warn: (ev) => ev.tel || 1.3 },
  sample: { dir: Math.PI, cover: 1.2, from: { x: 0, y: 0, z: -150 }, warm: true },
  init() {
    beamMat = new THREE.MeshBasicMaterial({ color: 0xfff4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    beamCoreMat = new THREE.MeshBasicMaterial({ color: 0xffd0f4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    beamEdgeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  },
  spawn(e, ev, api) {
    // its picture is not the entity's obj: the beam is born at the Heart's pupil (in plain view), and it is drawn
    // in the world's frame; the entity itself is only its timing, its hit and the test pilot's avoid
    e.vis = api.course.get('l10-beam', makeBeam);
    // it lives just ahead of the ship's plane (so the test autopilot looks at it), but it is drawn in the world's frame
    e.x = 0; e.y = 0; e.z = -2; e.sx = e.sy = e.sz = 1; e.appear = 1; e.hit = false;
    e.tel = ev.tel || 1.3; e.on = ev.on || 1.5; e.dir = ev.dir ?? Math.PI; e.cover = ev.cover ?? 1.2;
    e.from = ev.from || { x: 0, y: 0, z: -150 };
    // the covered region on the ship's plane: everything on the dir side of a line `cover` metres past the centre
    const B = api.box, ux = Math.cos(e.dir), uy = Math.sin(e.dir), vx = -uy, vy = ux, far = 26, wide = 30;
    const c0x = -ux * e.cover, c0y = -uy * e.cover;           // the line's middle
    const P = [[c0x + vx * wide, c0y + vy * wide], [c0x + ux * far + vx * wide, c0y + uy * far + vy * wide], [c0x + ux * far - vx * wide, c0y + uy * far - vy * wide], [c0x - vx * wide, c0y - vy * wide]];
    const A = e.vis.userData.geo.attributes.position.array, f = e.from;
    // near end: the covered region on the ship's plane; far end: the same shape, small, at the pupil
    const cx = (P[0][0] + P[1][0] + P[2][0] + P[3][0]) / 4, cy = (P[0][1] + P[1][1] + P[2][1] + P[3][1]) / 4;
    for (let i = 0; i < 4; i++) { A[i * 3] = f.x + (P[i][0] - cx) * 0.07 + ux * 2; A[i * 3 + 1] = f.y + (P[i][1] - cy) * 0.07 + uy * 2; A[i * 3 + 2] = f.z; }
    for (let i = 0; i < 4; i++) { A[12 + i * 3] = P[i][0]; A[12 + i * 3 + 1] = P[i][1]; A[12 + i * 3 + 2] = 0.5; }
    e.vis.userData.geo.attributes.position.needsUpdate = true;
    e.ux = ux; e.uy = uy; e.B = B; e.near = A.slice(12, 24); e.farQ = A.slice(0, 12); e.grown = 0;
    for (let i = 0; i < 12; i++) A[12 + i] = e.farQ[i]; // it starts at the pupil and reaches out
    const E = e.vis.userData.eg.attributes.position.array;
    for (const [k, src] of [[0, 9], [1, 0], [2, 0], [3, 9]]) { E[k * 3] = A[src]; E[k * 3 + 1] = A[src + 1]; E[k * 3 + 2] = A[src + 2]; } // grows out with the beam
    e.vis.userData.eg.attributes.position.needsUpdate = true;
    if (!ev.warm) api.game.sfx('fire', { rate: 0.45, vol: 0.9 });
  },
  update(e, dt, api) {
    const ud = e.vis.userData;
    e.appear = 1; e.vis.position.set(0, 0, 0); e.vis.scale.setScalar(1);
    if (e.grown < 1) {
      e.grown = Math.min(1, e.t / 0.3); const A = ud.geo.attributes.position.array, k = e.grown * e.grown;
      for (let i = 0; i < 12; i++) A[12 + i] = e.farQ[i] + (e.near[i] - e.farQ[i]) * k;
      ud.geo.attributes.position.needsUpdate = true;
      const E = ud.eg.attributes.position.array; for (let i = 0; i < 3; i++) { E[6 + i] = A[12 + i]; E[9 + i] = A[21 + i]; }
      ud.eg.attributes.position.needsUpdate = true;
    }
    if (e.t < e.tel) {
      const k = e.t / e.tel;
      beamMat.opacity = 0.03 + 0.07 * k * (0.5 + 0.5 * Math.sin(e.t * 34));
      beamEdgeMat.opacity = 0.1 + 0.25 * k * (0.5 + 0.5 * Math.sin(e.t * 34));
      beamCoreMat.opacity = 0;
    } else if (e.t < e.tel + e.on) {
      const k = (e.t - e.tel) / e.on;
      if (!e.fired) { e.fired = true; api.game.shake(0.9); api.game.hitstop(0.05); api.game.sfx('boom', { rate: 0.55, vol: 0.9 }); }
      beamMat.opacity = 0.17 * (1 - k * 0.3) * (0.85 + 0.15 * Math.sin(e.t * 50));
      beamEdgeMat.opacity = 0.55 * (1 - k * 0.4);
      beamCoreMat.opacity = 0.12 * (1 - k);
      const s = api.ship, side = s.x * e.ux + s.y * e.uy; // how far the ship is toward the covered side
      if (!e.hit && side > -e.cover + SHIP_R * 0.6 && !api.ship.invuln) { e.hit = true; api.game.damage(30, true); api.game.burst(s.x, s.y, 0, 40, { speed: 14, life: 0.5, s0: 1.6, r: 1, g: 0.9, b: 1, carry: 0 }); }
    } else {
      beamMat.opacity = Math.max(0, beamMat.opacity - dt * 3); beamCoreMat.opacity = 0; beamEdgeMat.opacity = Math.max(0, beamEdgeMat.opacity - dt * 4);
      if (e.t > e.tel + e.on + 0.3) e.alive = false;
    }
  },
  remove(e, api) { beamMat.opacity = 0; beamCoreMat.opacity = 0; beamEdgeMat.opacity = 0; api.course.put('l10-beam', e.vis); e.vis = null; },
  // the autopilot: get to the far side of the line
  avoid(e) { const r = 60; return [{ x: e.ux * (r - e.cover), y: e.uy * (r - e.cover), r: r + 1.4 }]; },
});

// =====================================================================================================================
// DEBRIS (the escape). A torn armour plate of the Heart, tumbling slowly across the lane: Yori's plate, its hinge dead.
// ev: nx, ny, drift (m/s sideways), r (its hit radius, default 2.6).
let debrisLayers = null;
const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
export const debris = defineObstacle({
  name: 'l10-debris',
  hazard: { cls: 'static', introduced: 10 },
  sample: { r: 2.6 },
  // 0.3.1, check-levels' "no fully blocked moment": its solid shape as it crosses the ship's plane, as the distance from
  // a ship centre (x, y) to its surface (the kind's own hit test is that distance under part of SHIP_R)
  // (it drifts sideways from the read line in: drift x the time from there to the ship, at the speed it is met)
  solid: (ev, B, v) => { const cx = (ev.x ?? (ev.nx || 0) * B.x) + (ev.drift || 0) * READ_D / Math.max(1, v), cy = ev.y ?? (ev.ny || 0) * B.y; return [{ dist: (x, y) => Math.hypot(x - cx, y - cy) - (ev.r || 2.6) * 0.8 }]; },
  init(api) {
    // Yori's armour plate with its hinge core gone dark: torn off the Heart
    const dead = HEART.plate.map((g) => (g.glow ? Object.assign({}, g, { color: '#2a2730', glow: false }) : g));
    debrisLayers = modelGroups(dead).map((g) => new Instanced(api.scene, g.geo, new THREE.MeshStandardMaterial({ color: g.color, metalness: 0.5, roughness: 0.5, flatShading: true, side: THREE.DoubleSide }), 60));
  },
  begin() { for (const L of debrisLayers) L.begin(); },
  end() { for (const L of debrisLayers) L.end(); },
  spawn(e, ev) { e.r = ev.r || 2.6; e.drift = ev.drift || 0; e.spin = ev.spin || 0.8; e.ph = ev.ph || 0; e.hit = false; },
  update(e, dt, api) {
    if (e.z > -READ_D) e.x += e.drift * dt;
    tmpQ.setFromEuler(tmpE.set(e.ph + e.t * e.spin * 0.7, e.t * e.spin, e.ph * 2 + e.t * e.spin * 0.4));
    const s = e.appear * e.r / 3.4;
    for (const L of debrisLayers) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
    if (e.crossed && !e.hit && Math.hypot(api.ship.x - e.x, api.ship.y - e.y) < e.r * 0.8 + SHIP_R * 0.6) { e.hit = true; crash(api, e, 18); }
    if (e.z > 30) e.alive = false;
  },
  avoid(e) { return [{ x: e.x + e.drift * 0.5, y: e.y, r: e.r + 1.6 }]; },
});

// =====================================================================================================================
// BEACON-ENERGY (the core). What the rings are made of: a struck hinge spills it. An amber spark you fly through for
// shield and points, so the shield can be won back while the fight holds the course (rule 7). It is not a ring: it
// never counts toward RINGS or a PERFECT, so the tally stays honest.
let sparkMat = null;
export const energy = definePickup({
  name: 'l10-energy',
  hazard: null,
  init(api) { sparkMat = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffcc33, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.9 }); },
  spawn(e, ev, api) {
    e.obj = api.course.get('l10-energy', () => { const g = new THREE.Group(); const s = new THREE.Sprite(sparkMat); s.scale.setScalar(3.2); g.add(s); const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), new THREE.MeshBasicMaterial({ color: 0xffe9a0 })); g.add(c); g.userData.core = c; return g; });
    e.sx = e.sy = e.sz = 0.01; e.got = false;
  },
  update(e, dt, api) {
    e.sx = e.sy = e.sz = Math.min(1, e.t / 0.4);
    e.obj.userData.core.rotation.y += dt * 4; e.obj.userData.core.rotation.x += dt * 2.6;
    api.pose(e);
    if (e.crossed && !e.got && Math.hypot(api.ship.x - e.x, api.ship.y - e.y) < RING_R + 0.3) {
      e.got = true; api.game.heal(7); api.game.greed(4); api.game.score(400 * api.game.mult, e.x, e.y + 1.2, 0, '', 'ENERGY');
      api.game.sfx('ring', { rate: 1.3, vol: 0.8 }); api.game.burst(e.x, e.y, 0, 18, { speed: 8, life: 0.4, s0: 0.9, r: 1, g: 0.8, b: 0.25, carry: 1 });
      e.alive = false;
    }
    if (e.z > 14) e.alive = false;
  },
});
