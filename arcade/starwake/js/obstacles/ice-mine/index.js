// THE ICE MINE (level 6, Frozen Rift; the Leviathan sheds them too): Yori's hexagonal ice crystal in a truss belt
// with red crack lines. Its question is "where is the eye?" It floats in the canyon. If your line takes you within
// reach of it, it ARMS: the cracks go red to white-hot and it shakes for 0.6 s (the tell). Then it pops into SIX
// shards that fly out in a ring, fixed in the track, about 2 m across by the time they reach you. The middle of the
// ring is empty: hold your line through where the mine was and all six pass round you (six grazes); roll there and
// they all go home (a MULTI-DEFLECT). Drift half-way and you meet one. Steer wide and it never arms.
// A sent-back shard homes on the next live mine down the canyon (or on whoever owns the mine: the Leviathan sends
// them to its lit lens), which shatters harmlessly.
import { THREE, defineEnemy, material, clamp, SHIP_R } from '../../api.js?v=0.4.1';
import { MESH } from './mesh.js?v=0.4.1';
const ICE_MINE = MESH.mine;

export const MINE = {
  scale: 1.4,     // Yori's 1.6 across, 2.4 tall -> 2.2 x 3.4: big enough to read at speed
  reach: 4.6,     // it arms if the ship is within this many metres of it (x, y) ...
  armFrom: 1.75,  // ... at this many seconds out, or any time until ...
  armTo: 1.4,     // ... this many (so the warning never shrinks: tell 0.6 s, then >= 0.8 s of shard flight)
  tell: 0.6,      // cracks red to white and the shake, before the pop
  ringR: 2.1,     // the shards' ring radius when they cross the ship's plane: inside GRAZE (2.5), inside DEFLECT (2.3)
  shards: 6,
};
const geoCache = new Map();
function geo(i) {
  if (!geoCache.has(i)) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(ICE_MINE[i].p, 3)); g.computeVertexNormals(); g.computeBoundingSphere(); geoCache.set(i, g); }
  return geoCache.get(i);
}
let iceMat = null;
function make(api) {
  const g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
  // her ice body is pale; give it a little of its own light so it holds up in the bright fog
  if (!iceMat) iceMat = new THREE.MeshStandardMaterial({ color: 0xdfe6f2, metalness: 0.05, roughness: 0.25, flatShading: true, side: THREE.DoubleSide, emissive: 0x3a5a80, emissiveIntensity: 0.35 });
  const cracks = material('#ff3355', true, true), core = cracks; // her cracks and core are one red group
  ICE_MINE.forEach((grp, i) => {
    const m = grp.glow ? cracks : grp.color === '#dfe6f2' ? iceMat : material(grp.color, false);
    const mesh = new THREE.Mesh(geo(i), m); mesh.frustumCulled = false; spin.add(mesh);
  });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5 }));
  glow.scale.setScalar(2.2); g.add(glow);
  g.userData = { spin, cracks, core, glow };
  return g;
}
const crackCol = (ud, k) => { ud.cracks.color.setRGB(1, 0.2 + 0.8 * k, 0.33 + 0.67 * k); };

export default defineEnemy({
  name: 'ice-mine',
  killPts: 600,
  // 'burst': a thing that arms when you come near and then fires shards (MINE.armTo + tell are its timing)
  hazard: { cls: 'shot', introduced: 6, tel: MINE.tell, shotT: MINE.armTo - MINE.tell },
  sample: { nx: 0, ny: 0 },
  targetable: (e) => e.state === 0 && !e.fling,
  // the test autopilot: once it is in the eye it holds it; otherwise it keeps clear of the shards' ring
  avoid: (e) => (e.state === 2 || e.fling || e.z > -2 ? [] : e.eye ? [] : [{ x: e.bx, y: e.by, r: 3.4 }]),
  spawn(e, ev, api) {
    e.obj = api.course.get('ice-mine', () => make(api));
    e.sx = e.sy = e.sz = MINE.scale;
    e.r = 1.1; e.hitR = 1.3; e.hp = 1;
    e.state = 0; e.tt = 0; e.owner = ev.owner || null;
    e.dx = (ev.drift || 0); e.dy = (ev.driftY || 0);
    e.bob = Math.random() * 6; e.spin = ev.spin ?? (0.6 + Math.random() * 0.6);
    const ud = e.obj.userData; crackCol(ud, 0); ud.glow.material.opacity = 0.5; ud.spin.rotation.set(0, Math.random() * 6, 0);
    e.bx = e.x; e.by = e.y; e.eye = false;
    // flung (the Leviathan's shard drop): it flies from where it was shed, up and away down the canyon to `to`
    // (x, y, z ship-relative) over `t` seconds, then drops into the lane and streams back like any mine
    e.fling = ev.fling ? { from: [ev.fling.x, ev.fling.y, ev.fling.z], to: ev.fling.to, T: ev.fling.t || 0.8, t: 0 } : null;
    if (e.fling) { e.x = ev.fling.x; e.y = ev.fling.y; e.z = ev.fling.z; e.appear = 0; } // shed from the tail: it grows out of it
  },
  update(e, dt, api) {
    const ud = e.obj.userData, v = Math.max(1, api.v), ship = api.ship, box = api.box;
    e.bob += dt;
    if (e.fling) {
      const f = e.fling; f.t += dt;
      const k = Math.min(1, f.t / f.T), ease = 1 - Math.pow(1 - k, 2);
      e.x = f.from[0] + (f.to[0] - f.from[0]) * ease; e.y = f.from[1] + (f.to[1] - f.from[1]) * ease + Math.sin(k * Math.PI) * 9;
      e.z = f.from[2] + (f.to[2] - f.from[2]) * ease;
      e.bx = e.x; e.by = e.y; { const g = Math.min(1, f.t / 0.45); e.appear = g * g * (3 - 2 * g); } // it grows out of the tail as it is shed
      ud.spin.rotation.y += dt * 9; ud.spin.rotation.x += dt * 5;
      if (k >= 1) { e.fling = null; ud.spin.rotation.x = 0; }
      api.pose(e);
      return;
    }
    const arrive = -e.z / v;
    if (arrive < MINE.armFrom + 0.2) e.eye = e.eye || Math.hypot(ship.x - e.bx, ship.y - e.by) < 1.0;
    if (e.state === 0) {
      // idle: drifts slowly across the canyon, bobbing; a slow red pulse
      e.bx = clamp(e.bx + e.dx * dt, -box.x * 1.05, box.x * 1.05); e.by = clamp(e.by + e.dy * dt, -box.y * 1.05, box.y * 1.05);
      e.x = e.bx; e.y = e.by + Math.sin(e.bob * 1.7) * 0.25;
      const pk = 0.5 + 0.5 * Math.sin(e.bob * 4);
      ud.glow.material.opacity = 0.35 + 0.25 * pk; ud.glow.scale.setScalar(2.0 + pk * 0.6);
      ud.spin.rotation.y += dt * e.spin;
      if (arrive <= MINE.armFrom && arrive >= MINE.armTo && !e.ev.warm) {
        if (Math.hypot(ship.x - e.x, ship.y - e.y) < MINE.reach) { e.state = 1; e.tt = 0; api.game.mineArm(e); api.game.sfx('ice-crack', { vol: 0.9, pan: e.x / box.x * 0.6 }); }
      }
    } else if (e.state === 1) {
      // armed: the cracks go white-hot and it shakes, then it pops
      e.tt += dt;
      const k = clamp(e.tt / MINE.tell, 0, 1);
      crackCol(ud, k);
      const sh = 0.08 + 0.22 * k;
      e.x = e.bx + (Math.random() - 0.5) * sh; e.y = e.by + (Math.random() - 0.5) * sh;
      ud.spin.rotation.y += dt * (e.spin + 14 * k);
      ud.glow.material.opacity = 0.6 + 0.4 * k; ud.glow.scale.setScalar(2.4 + 3.2 * k);
      ud.glow.material.color.setRGB(1, 0.2 + 0.75 * k, 0.33 + 0.6 * k);
      if (e.tt >= MINE.tell) { pop(e, api, v); return; }
    }
    api.pose(e);
    if (Math.abs(e.z) < 1.6 && !e.rammed && Math.hypot(ship.x - e.x, ship.y - e.y) < e.r + SHIP_R) { e.rammed = true; api.game.crash(e, 18, true); api.kill(e, false); }
    if (e.z > 14) e.alive = false;
  },
  onKill(e, byShot, api) { shatter(e, api); },
});

// six shards out from where it was, fixed in the track: radial speed set so the ring is MINE.ringR across when it
// reaches the ship's plane; the ring's turn alternates so two mines in a row are not the same pattern
function pop(e, api, v) {
  e.state = 2;
  const vz = 6, tPlane = Math.max(0.3, -e.z / (v + vz)), rv = MINE.ringR / tPlane;
  const a0 = (e.id % 2) * Math.PI / MINE.shards;
  const src = { x: e.bx, y: e.by, z: e.z, mine: true };
  for (let k = 0; k < MINE.shards; k++) {
    const a = a0 + k / MINE.shards * Math.PI * 2;
    api.fire(src, 0, 0, { vel: [Math.cos(a) * rv, Math.sin(a) * rv, vz], carry: 1, owner: e.owner || src });
  }
  api.game.minePop(src, e.z);
  shatter(e, api);
  e.alive = false;
}
function shatter(e, api) {
  api.game.burst(e.x, e.y, e.z, 26, { speed: 9, life: 0.55, s0: 1.3, r: 0.85, g: 0.95, b: 1, carry: 1, drag: 1.5 });
  api.game.burst(e.x, e.y, e.z, 10, { speed: 4, life: 0.35, s0: 2.2, r: 1, g: 0.35, b: 0.4, carry: 1, drag: 2 });
}
