// LEVEL 9 scenery: THE MIRROR FIELD (Yori's look sheet level-09: pearl and lilac, hard white glints, hypnotic).
// Her two signature pieces, mirrorCrystal(seed) clusters and crystalArch(), from her vertex lists (mesh.js); the
// glass floor far below; THE PRISM, the level's one landmark, a crystal the size of a mountain that hangs ahead
// all level and draws closer; the glints (every crystal has one white face that catches the light); the mirror
// panes of the Hall; and the mirror-shard, the one obstacle this level adds (a known thing, the level-1 crystal's
// cousin, with the red spine that says it hurts).
// Rule 9: nothing here is red, amber or cyan as a large flat colour; the shard's spine is the only red, and it hurts.
import { THREE, defineScenery, defineDecor, defineObstacle, Instanced, GlowPoints, rng, clamp, SHIP_R } from '../../api.js?v=0.6.4';
import { SCENERY } from './mesh.js?v=0.6.4';
import { geometryOf } from '../../enemies/crystal-emitter/parts.js?v=0.6.4';
import { glassTex } from './mirror.js?v=0.6.4';

const tmpQ = new THREE.Quaternion(), eul = new THREE.Euler();
const side = (R, lo, hi) => R.sign() * R.range(lo, hi);
const FLOOR_Y = -24;

// ---------------------------------------------------------------- decor: Yori's mirror crystal clusters
// three variants, each a lit lilac body and its one white mirror face (unlit, so it glints in any light)
let crys;
const crystalMat = () => new THREE.MeshStandardMaterial({ color: 0xb09aff, metalness: 0.35, roughness: 0.22, flatShading: true });
export const mirrorCrystal = defineDecor({
  name: 'l9-crystal',
  init(api) {
    const body = crystalMat(), glint = new THREE.MeshBasicMaterial({ color: 0xf4f8ff });
    crys = SCENERY.crystals.map((groups) => groups.map((g) => new Instanced(api.scene, geometryOf(g), g.glow ? glint : body, 90)));
  },
  begin() { for (const v of crys) for (const L of v) L.begin(); },
  end() { for (const v of crys) for (const L of v) L.end(); },
  spawn(e, ev) { e.v = ev.v ?? 0; e.s = ev.s || 1; e.rx = ev.rx || 0; e.ry = ev.ry ?? Math.random() * 6; e.rz = ev.rz || 0; e.spin = (Math.random() - 0.5) * 0.25; },
  update(e, dt) {
    e.ry += e.spin * dt;
    tmpQ.setFromEuler(eul.set(e.rx, e.ry, e.rz));
    const s = e.s * e.appear;
    for (const L of crys[e.v % 3]) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
    if (e.z > 40) e.alive = false;
  },
});
// ---------------------------------------------------------------- decor: Yori's crystal arch, 26 across
let arches;
export const crystalArch = defineDecor({
  name: 'l9-arch',
  init(api) {
    const body = new THREE.MeshStandardMaterial({ color: 0x4a3a8a, metalness: 0.4, roughness: 0.3, flatShading: true }), glint = new THREE.MeshBasicMaterial({ color: 0xdfe6f2 });
    arches = SCENERY.arch.map((g) => new Instanced(api.scene, geometryOf(g), g.glow ? glint : body, 12));
  },
  begin() { for (const L of arches) L.begin(); },
  end() { for (const L of arches) L.end(); },
  // her arch is the upper half of a ring centred 4 below its middle; at 1.35x its inner edge clears every corner of
  // the flight box, landscape (7.5 x 4.3) or portrait (4.1 x 5.6), so it frames the lane and never crosses it
  spawn(e, ev) { e.s = ev.s || 1.35; e.rz = ev.rz || 0; },
  update(e, dt, api) {
    tmpQ.setFromEuler(eul.set(0, 0, e.rz));
    const s = e.s * e.appear;
    for (const L of arches) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
    if (e.z > 30) e.alive = false;
  },
});
// ---------------------------------------------------------------- decor: the Hall's mirror panes
let panes, paneEdges;
export const mirrorPane = defineDecor({
  name: 'l9-pane',
  init(api) {
    // glass: the mirror gate's sheen, faint, so the panes read as mirrors and never as walls
    const g = new THREE.CircleGeometry(1, 6); g.rotateZ(Math.PI / 6);
    panes = new Instanced(api.scene, g, new THREE.MeshBasicMaterial({ map: glassTex(), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }), 40);
    const t = new THREE.TorusGeometry(1.02, 0.035, 3, 6); t.rotateZ(Math.PI / 6);
    paneEdges = new Instanced(api.scene, t, new THREE.MeshBasicMaterial({ color: 0xf4f8ff }), 40);
  },
  begin() { panes.begin(); paneEdges.begin(); },
  end() { panes.end(); paneEdges.end(); },
  spawn(e, ev) { e.w = ev.w || 7; e.h = ev.h || 12; e.ry = ev.ry || 0; },
  update(e) {
    tmpQ.setFromEuler(eul.set(0, e.ry, 0));
    const a = e.appear;
    panes.put(e.x, e.y, e.z, tmpQ, e.w * a, e.h * a, a); paneEdges.put(e.x, e.y, e.z, tmpQ, e.w * a, e.h * a, a);
    if (e.z > 30) e.alive = false;
  },
});

// ---------------------------------------------------------------- the obstacle: the mirror shard
// A tall, thin crystal blade standing in the lane at an angle: deep lilac, a red spine down its length (the
// hurts colour, the only red in the field). Fly round it; the near miss pays CLOSE like a girder.
let shardBody, shardSpine;
export const mirrorShard = defineObstacle({
  name: 'l9-shard',
  hazard: { cls: 'static', introduced: 1 },
  sample: { len: 10, tilt: 0.3 },
  // 0.3.1, check-levels' "no fully blocked moment": its solid shape as it crosses the ship's plane, as the distance from
  // a ship centre (x, y) to its surface (the kind's own hit test is that distance under part of SHIP_R)
  solid(ev, B) {
    const half = (ev.len || 10) / 2, ux = -Math.sin(ev.tilt || 0), uy = Math.cos(ev.tilt || 0), ex = ev.x ?? (ev.nx || 0) * B.x, ey = ev.y ?? (ev.ny || 0) * B.y;
    return [{ dist: (x, y) => { const dx = x - ex, dy = y - ey, t = clamp(dx * ux + dy * uy, -half, half); return Math.hypot(dx - ux * t, dy - uy * t) - (0.62 * (1 - Math.abs(t) / half) + 0.12); } }];
  },
  init(api) {
    const g = new THREE.OctahedronGeometry(1, 0); g.scale(0.55, 0.5, 0.42);
    shardBody = new Instanced(api.scene, g, new THREE.MeshStandardMaterial({ color: 0x4a3a8a, metalness: 0.45, roughness: 0.25, flatShading: true }), 40);
    const s = new THREE.BoxGeometry(0.09, 0.96, 0.09); s.translate(0, 0, -0.43);
    shardSpine = new Instanced(api.scene, s, new THREE.MeshBasicMaterial({ color: 0xff3355 }), 40);
  },
  begin() { shardBody.begin(); shardSpine.begin(); },
  end() { shardBody.end(); shardSpine.end(); },
  spawn(e, ev) { e.len = ev.len || 10; e.tilt = ev.tilt || 0; e.half = e.len / 2; e.ux = -Math.sin(e.tilt); e.uy = Math.cos(e.tilt); },
  update(e, dt, api) {
    tmpQ.setFromEuler(eul.set(0, 0, e.tilt));
    const a = e.appear, L = e.len * a;
    shardBody.put(e.x, e.y, e.z, tmpQ, 2.2 * a, L, 2.2 * a);
    shardSpine.put(e.x, e.y, e.z, tmpQ, a, L, a);
    if (!e.checked && (e.crossed || Math.abs(e.z) < 1.0)) {
      e.checked = true;
      // distance from the ship to the blade's centre line, in the plane
      const dx = api.ship.x - e.x, dy = api.ship.y - e.y, t = clamp(dx * e.ux + dy * e.uy, -e.half, e.half);
      const d = Math.hypot(dx - e.ux * t, dy - e.uy * t), w = 0.62 * (1 - Math.abs(t) / e.half) + 0.12;
      if (d < w + SHIP_R * 0.8) api.game.crash(e, 22);
      else if (d < w + 2.2) api.game.scrape(e, d);
    }
    if (e.z > 20) e.alive = false;
  },
  // the test autopilot keeps off the blade: circles along it
  avoid(e) { const out = []; for (let k = -2; k <= 2; k++) { const t = k / 2 * e.half * 0.9; out.push({ x: e.x + e.ux * t, y: e.y + e.uy * t, r: 1.9 }); } return out; },
});

// ---------------------------------------------------------------- streams
// crystal clusters off to the sides and above, big, slow-turning
export const crystalBanks = defineScenery({
  name: 'l9-banks',
  // a cluster is about 2.4 x its scale in radius: keep its near edge outside the box (|x| > 1.5 box)
  stream: { every: [22, 46], place: (R, api) => { const b = api.box, s = R.range(0.9, 2.4); if (api.tier === 0 && R() < 0.4) return null; return { type: 'l9-crystal', x: side(R, b.x * 1.5 + s * 2.6, b.x * 6), y: R.range(-b.y * 2.2, b.y * 3), v: R.int(0, 2), s, rx: R.range(-0.5, 0.5), rz: R.range(-0.6, 0.6) }; } },
});
// a field of crystals growing from the glass floor below
export const crystalFloorField = defineScenery({
  name: 'l9-floorfield',
  // a tall one stands 7 x its scale: under the lane they stay short enough to keep their tips below the box.
  // Fewer under the lane (a clean corridor to read hazards against), and fewer again on the low quality tier.
  stream: { every: [10, 22], place: (R, api) => {
    const b = api.box, x = R.range(-b.x * 9, b.x * 9), under = Math.abs(x) < b.x * 1.8;
    if (under && R() < 0.6) return null;
    if (api.tier === 0 && R() < 0.45) return null;
    return { type: 'l9-crystal', x, y: FLOOR_Y + 2, v: R.int(0, 2), s: under ? R.range(0.6, 1.2) : R.range(1.1, 3.4), rx: R.range(-0.2, 0.2), rz: R.range(-0.2, 0.2) };
  } },
});
// arches over the lane, now and then
export const archStream = defineScenery({
  name: 'l9-arches',
  stream: { every: [260, 420], place: (R) => ({ type: 'l9-arch', x: 0, y: 0, rz: R.range(-0.12, 0.12) }) },
});
// the Hall of Mirrors: tall panes standing both sides of the lane, turned in toward it
export const hallPanes = defineScenery({
  name: 'l9-hall',
  // a pane is w across each way from its middle: its near edge stays outside the box (|x| > 1.45 box)
  stream: { every: [34, 58], place: (R, api) => { const b = api.box, s = R.sign(), w = R.range(4, 6.5); return { type: 'l9-pane', x: s * (b.x * 1.45 + w + R.range(0, b.x * 0.9)), y: R.range(-b.y * 0.6, b.y * 0.8), w, h: R.range(9, 14), ry: s * R.range(0.35, 0.7) }; } },
});

// ---------------------------------------------------------------- set pieces
// the glass floor: a dark violet plane with pale facet lines, far below, scrolling with the track
function floorTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#16142e'; g.fillRect(0, 0, 256, 256);
  const R = rng(91);
  // a triangle lattice, some cells lit lilac, some pearl, most dark: crystal facets seen from above
  const s = 32, h = s * 0.866;
  for (let row = -1; row < 256 / h + 1; row++) for (let col = -1; col < 256 / s + 1; col++) {
    for (const up of [0, 1]) {
      const x0 = col * s + (row % 2) * s / 2, y0 = row * h;
      const p = up ? [[x0, y0 + h], [x0 + s / 2, y0], [x0 + s, y0 + h]] : [[x0 + s / 2, y0], [x0 + s, y0 + h], [x0 + s * 1.5, y0]];
      const k = R();
      g.fillStyle = k < 0.06 ? 'rgba(223,230,242,0.30)' : k < 0.3 ? 'rgba(176,154,255,0.16)' : 'rgba(74,58,138,0.10)';
      g.beginPath(); g.moveTo(...p[0]); g.lineTo(...p[1]); g.lineTo(...p[2]); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(224,208,255,0.13)'; g.lineWidth = 1.2; g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
export const glassFloor = defineScenery({
  name: 'l9-floor',
  ease: 0.5,
  init(api) {
    const t = floorTex(); t.repeat.set(12, 36);
    const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(420, 900), m);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, FLOOR_Y, -420); floor.renderOrder = -2; floor.visible = false;
    api.scene.add(floor);
    return { floor, m, t };
  },
  update(s, w, dt, api) {
    s.floor.visible = w > 0.003;
    s.m.opacity = clamp(w, 0, 1) * 0.9;
    s.t.offset.y = (api.G.dist || 0) / 25 % 1;
  },
});
// THE PRISM: the landmark. A six-sided crystal a few hundred metres tall, hanging ahead and to the right all
// level, turning slowly, one face mirror-white. It drifts closer as the level goes on; the Twins come out of it.
export const thePrism = defineScenery({
  name: 'l9-prism',
  ease: 0.35,
  init(api) {
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0, 70, 150, 6, 1); geo.translate(0, 75, 0);
    const geo2 = new THREE.CylinderGeometry(70, 0, 110, 6, 1); geo2.translate(0, -55, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xb09aff, metalness: 0.5, roughness: 0.18, flatShading: true, fog: false, transparent: true, opacity: 0, emissive: 0x2a1a5a });
    const top = new THREE.Mesh(geo, mat), bot = new THREE.Mesh(geo2, mat);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0, 70.6, 150.6, 6, 1, true, 0, Math.PI / 3), new THREE.MeshBasicMaterial({ color: 0xf4f8ff, fog: false, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    face.geometry.translate(0, 75, 0);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xb09aff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    halo.scale.set(520, 520, 1);
    g.add(halo, top, bot, face); g.position.set(170, 60, -1500); g.renderOrder = -4; g.visible = false;
    api.scene.add(g);
    return { g, mat, face, halo, spin: 0 };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003;
    s.mat.opacity = w; s.face.material.opacity = w * (0.55 + 0.45 * Math.max(0, Math.sin(s.spin * 3)));
    s.halo.material.opacity = 0.16 * w;
    s.spin += dt * 0.06; s.g.rotation.y = s.spin;
    const L = api.level, k = L ? clamp((api.G.courseD ?? api.G.dist ?? 0) / L.length, 0, 1) : 0;
    s.g.position.z = -1500 + 420 * k; s.g.position.x = 170 - 60 * k;
  },
});
// the glints: hard white sparkles hanging in the field, each flashing now and then (the hypnotic part)
export const glints = defineScenery({
  name: 'l9-glints',
  ease: 0.8,
  init(api) {
    const N = 150, R = rng(57), P = [];
    for (let i = 0; i < N; i++) P.push({ x: R.range(-90, 90), y: R.range(-22, 45), z: R.range(-760, 0), ph: R.range(0, 6.28), sp: R.range(0.6, 1.8) });
    const layer = new GlowPoints(api.scene, N, api.glowTex);
    layer.setFar(420, 760); layer.setScale(api.focalPx || 600);
    return { P, layer };
  },
  update(s, w, dt, api) {
    const L = s.layer; L.setScale(api.focalPx || 600); L.begin();
    if (w > 0.003) {
      const v = api.v || 0, t = api.time || 0;
      // the low tier shows 70 of them; the rest keep flying and fade out (and back in), never switch
      const n = api.tier === 0 ? 70 : s.P.length;
      for (let i = 0; i < s.P.length; i++) { const p = s.P[i];
        p.z += v * dt;
        if (p.z > 8) { p.z -= 760; p.x = (Math.random() - 0.5) * 180; if (Math.abs(p.x) < 14 && p.y > -10 && p.y < 12) p.x += Math.sign(p.x || 1) * 16; }
        p.vis = (p.vis ?? 1) + ((i < n ? 1 : 0) - (p.vis ?? 1)) * Math.min(1, dt * 2);
        if (p.vis < 0.01) continue;
        const tw = Math.pow(Math.max(0, Math.sin(t * p.sp + p.ph)), 24);
        L.push(p.x, p.y, p.z, 0.8 + 3.2 * tw, 1, 0.97 + 0.03 * tw, 1, (0.25 + 0.75 * tw) * w * p.vis);
      }
    }
    L.end();
  },
});
