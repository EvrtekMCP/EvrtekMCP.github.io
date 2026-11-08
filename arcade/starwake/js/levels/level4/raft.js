// LEVEL 4: THE SHIELD-PLATE RAFT. Yori's drifting hex plates (levels/scenery.js shieldPlate, 18 across), strung
// down the track point-to-point and overlapping like scales, so their flat sides make two straight edges. The
// column on the plates' shadow side is the safe lane from the flares (headline: "duck into a plate's shadow"):
// above a LOW raft when the fire comes up from the surface, below a HIGH raft when it rains from a prominence.
// Two violet light-curtains stand on the edges of that column, so the player sees exactly where the shade is.
// Violet is the level's safe colour (Yori's palette); it is none of the three reserved hues.
//
// Event: { len (m), nx, nx2 (centre at the near and far ends), snake (amplitude), waves, ph, w (half-width),
//          ny (height), from: 'below' | 'above', slide (it drifts in from this far aside and settles on its line
//          by the time it is 250 m out, so the course is the same on every run) }
import { THREE, defineObstacle, Instanced, modelGroups, clamp, smoothstep, appear, SHIP_R, SPAWN_D } from '../../api.js?v=0.4.0';
import { MESH } from './mesh.js?v=0.4.0';
import { rafts } from './shade.js?v=0.4.0';

const CAP = 420, SEG = 40;
export const RAFT_LOW = -0.85, RAFT_HIGH = 1.5;
const VIOLET = [0.62, 0.4, 1.0];
const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), eul = new THREE.Euler();
let layers = null;

export const fogFade = (z) => 1 - smoothstep(170, 760, -z);
// Matte, so the flat plates never mirror the bright horizon (a gold glint reads as AMBER, the collect hue), with
// a cool violet in their shade (Yori: "violet shadow under the shield plates").
export const plateMaterial = (color) => new THREE.MeshStandardMaterial({ color, metalness: 0.12, roughness: 0.85, flatShading: true, side: THREE.DoubleSide, emissive: 0x3a1460, emissiveIntensity: 0.9, envMapIntensity: 0.35 });

// per sample: wall A [base, top], wall B [base, top], the glow strip on the plates [left, right]
const VPS = 6;
function corridorMesh() {
  const g = new THREE.BufferGeometry();
  const n = (SEG + 1) * VPS;
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const idx = [];
  for (let p = 0; p < 3; p++) for (let k = 0; k < SEG; k++) {
    const a = k * VPS + p * 2, b = (k + 1) * VPS + p * 2;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.frustumCulled = false; m.renderOrder = 2;
  return m;
}

export default defineObstacle({
  name: 'l4-raft',
  hazard: { cls: 'static', introduced: 4 },
  sample: { len: 40, nx: 0, ny: -0.6 },
  init(api) {
    layers = modelGroups(MESH.plate).map((g) => new Instanced(api.scene, g.geo, plateMaterial(g.color), CAP));
  },
  begin() { for (const L of layers) L.begin(); },
  end() { for (const L of layers) L.end(); },
  spawn(e, ev, api) {
    const B = api.box;
    e.from = ev.from || 'below';
    e.len = ev.len || 120;
    e.hw = Math.max(1.9, (ev.w || 0.36) * B.x);
    // LOW rafts sit so near the bottom of the box there is no room to fly under them; HIGH rafts float ABOVE the
    // box, where the chase camera (0.62 x ship height + 2.8) can never reach them: inside the box they filled
    // the screen. Their shade is the whole box beneath.
    e.y = (ev.ny ?? (e.from === 'below' ? RAFT_LOW : RAFT_HIGH)) * B.y;
    const x0 = (ev.nx || 0) * B.x, x1 = (ev.nx2 ?? ev.nx ?? 0) * B.x, amp = (ev.snake || 0) * B.x, waves = ev.waves || 1, ph = ev.ph || 0;
    const lim = B.x * 1.05 - e.hw * 0.4;
    e.slide = (ev.slide || 0) * B.x; e.off = 0;
    e.cx = (u) => clamp(x0 + (x1 - x0) * clamp(u / e.len, 0, 1) + amp * Math.sin(ph + waves * Math.PI * 2 * u / e.len), -lim, lim) + e.off;
    e.s = e.hw / 7.79;                 // her flat sides sit at 7.79 x scale: the plates' edges ARE the corridor's
    e.sp = 9 * e.s;                    // vertex to vertex: the union has straight sides
    e.n = Math.ceil(e.len / e.sp) + 1;
    e.jit = Array.from({ length: e.n }, (_, i) => [Math.sin(i * 12.9898) * 0.035, Math.cos(i * 4.1414) * 0.035, (i % 2) * 0.14]);
    e.heat = 0; e.hitT = 0;
    e.reg = { near: e.z, len: e.len, cx: e.cx, hw: e.hw, y: e.y, from: e.from, heat: 0 };
    if (!ev.warm) rafts.add(e.reg);
    // the curtains are drawn in ship space from the origin; NOT e.obj (the course would pose them as one object)
    e.curt = api.course.get('l4-corridor', corridorMesh);
    e.curt.position.set(0, 0, 0); e.curt.scale.set(1, 1, 1);
  },
  remove(e, api) { rafts.delete(e.reg); if (e.curt) api.course.put('l4-corridor', e.curt); e.curt = null; },
  update(e, dt, api) {
    const B = api.box, ship = api.ship;
    // the drift: it slides in from aside and settles on its line by 250 m out
    e.off = e.slide * (1 - smoothstep(-650, -250, e.z));
    e.reg.near = e.z;
    e.heat = Math.max(e.reg.heat, e.heat - dt * 1.5); e.reg.heat = 0;
    const bob = Math.sin(e.t * 2.4) * 0.08;
    // the plates
    const yaw = Math.PI / 2;
    for (let i = 0; i < e.n; i++) {
      const u = i * e.sp, z = e.z - u;
      if (z > 14) continue;
      if (z < -SPAWN_D) break;
      const a = appear(z) * (e.fadeIn !== undefined ? e.fadeIn / 0.5 : 1);
      if (a <= 0.001) continue;
      const j = e.jit[i], dx = e.cx(u + 0.5) - e.cx(u - 0.5);
      qA.setFromEuler(eul.set(j[0], yaw - Math.atan(dx), j[1]));
      const s = e.s * a;
      const y = e.y + bob + (e.from === 'below' ? -j[2] : j[2]);
      for (const L of layers) L.put(e.cx(u), y, z, qA, s, s, s);
    }
    // the corridor's two curtains, from the spawn line to just behind the ship
    const pos = e.curt.geometry.attributes.position, col = e.curt.geometry.attributes.color;
    const ua = Math.max(0, e.z - 6), ub = Math.min(e.len, e.z + SPAWN_D);
    const dir = e.from === 'below' ? 1 : -1, top = e.from === 'below' ? B.y + 3 : -B.y - 3;
    const glow = 0.3 + 0.75 * e.heat, floor = 0.12 + 0.3 * e.heat, fy = e.y + bob + dir * (0.5 * e.s + 0.25);
    const fi = e.fadeIn !== undefined ? e.fadeIn / 0.5 : 1;
    for (let k = 0; k <= SEG; k++) {
      const u = ub > ua ? ua + (ub - ua) * k / SEG : ua, z = e.z - u, cx = e.cx(u);
      const f = (ub > ua ? 1 : 0) * appear(z) * fogFade(z) * (1 - smoothstep(-2, 6, z)) * fi, i = k * VPS;
      for (let w = 0; w < 2; w++) {
        const x = cx + (w ? e.hw : -e.hw), j = i + w * 2, c = glow * f;
        pos.setXYZ(j, x, e.y + bob, z); pos.setXYZ(j + 1, x, top, z);
        col.setXYZ(j, VIOLET[0] * c, VIOLET[1] * c, VIOLET[2] * c); col.setXYZ(j + 1, 0, 0, 0);
      }
      const c = floor * f;
      pos.setXYZ(i + 4, cx - e.hw, fy, z); pos.setXYZ(i + 5, cx + e.hw, fy, z);
      col.setXYZ(i + 4, VIOLET[0] * c, VIOLET[1] * c, VIOLET[2] * c); col.setXYZ(i + 5, VIOLET[0] * c, VIOLET[1] * c, VIOLET[2] * c);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
    // a plate is solid: flying into its edge or through it costs a small hit
    e.hitT -= dt;
    if (e.z >= 0 && e.z <= e.len && e.hitT <= 0) {
      const cx = e.cx(e.z);
      if (Math.abs(ship.y - e.y) < 0.2 + SHIP_R * 0.6 && Math.abs(ship.x - cx) < e.hw - 0.2) { e.hitT = 0.8; api.game.crash({ kind: e.kind, type: 'l4-plate', x: ship.x, y: e.y, z: 0 }, 12, true); }
    }
    if (e.z - e.len > 14) e.alive = false;
  },
});
