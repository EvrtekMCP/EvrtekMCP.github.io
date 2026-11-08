// THE SEEKER DRONE (level 4 on): Yori's dart, three fins and a red core at the tail (levels/enemies.js).
// Its job (rule 23): the shot you cannot sidestep, so you roll it. It flies in out of the haze, brakes, and HOLDS
// station ahead of you, drifting toward your lane. Each attack: its fins flare out and its tail core blooms red
// (the tell), then it fires a bolt that leaves wide and CURVES after you, trailing a red thread so you can watch
// it turn. Sent back by a roll, the bolt homes on its own drone (the engine sends a shot to its owner): the
// drone dies to its own fire (rule 27, the volley the Leviathan will ask for). After its bolts it peels away
// and climbs back into the haze, so a pilot who never rolls cannot hang it.
//
// Event: { nx, ny (where it holds, normalised), shots (3), hold (m ahead, 110), first (the teaching one: a
//          longer tell, a slower bolt, and its first bolt only grazes you) }
// Yori's two states: her seekerDrone(1) sweeps the fins back along the body, seekerDrone(0) spreads them. Her
// note says the fins hug the body and FLARE before it fires, so: at rest = her (1), the tell = her (0).
import { THREE, defineEnemy, buildModel, GlowPoints, clamp, damp, smoothstep, SPAWN_D } from '../../api.js?v=0.4.1';
import { MESH } from './mesh.js?v=0.4.1';

const HUG = MESH.flared, SPREAD = MESH.rest;
const RED = new THREE.Color(0xff3355), HOT = new THREE.Color(0xfff0f0);
const bolts = [];
let trail = null, API = null;

function make(api) {
  const g = new THREE.Group(), inner = new THREE.Group(); inner.rotation.y = Math.PI; g.add(inner); // nose to +Z: lookAt aims it
  const m = buildModel(HUG, { own: ['#ff3355*'] });
  const meshes = [];
  m.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  meshes.forEach((o, i) => {
    const geo = o.geometry;
    if (!geo.morphAttributes.position) geo.morphAttributes.position = [new THREE.Float32BufferAttribute(SPREAD[i].p, 3)];
    o.updateMorphTargets(); o.frustumCulled = false;
  });
  inner.add(m.group);
  const bloom = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.35 }));
  bloom.position.z = -0.9; bloom.scale.setScalar(1.6); g.add(bloom);
  g.userData = { meshes, core: m.mats['#ff3355*'], bloom, inner };
  return g;
}
function setFlare(e, k) {
  const ud = e.obj.userData;
  for (const o of ud.meshes) o.morphTargetInfluences[0] = k;
}

export default defineEnemy({
  name: 'seeker-drone',
  motion: 'own', spawnAt: 'now',
  hazard: { cls: 'shot', introduced: 4, shotT: 1.3, tel: 0.5 },
  killPts: 1500,
  sample: { nx: 0, ny: 0.5 },
  targetable: (e) => e.phase === 1,
  init(api) {
    API = api;
    trail = new GlowPoints(api.scene, 700, api.glowTex);
  },
  // every frame, drone or no drone: steer the bolts in flight and draw their threads
  begin(api) {
    if (!trail) return;
    const ship = api.ship, dt = api.dt || 0;
    if (api.focalPx) trail.mat.uniforms.uScale.value = api.focalPx;
    trail.begin();
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i], s = b.s;
      if (!s.alive || s.reflected) { bolts.splice(i, 1); continue; }
      const tr = -s.z / Math.max(1, s.vz);
      if (tr > 0.06 && dt > 0) {
        const tx = ship.x + b.offX, ty = ship.y + b.offY, A = b.acc * dt;
        s.vx += clamp((tx - s.x) / tr - s.vx, -A, A);
        s.vy += clamp((ty - s.y) / tr - s.vy, -A, A);
      }
      b.acc2 += dt;
      if (b.acc2 >= 1 / 45) { b.acc2 = 0; b.hist.unshift(s.x, s.y, s.z); if (b.hist.length > 42) b.hist.length = 42; }
      for (let k = 0; k < b.hist.length; k += 3) {
        const f = 1 - k / 45;
        trail.push(b.hist[k], b.hist[k + 1], b.hist[k + 2], 1.35 * f + 0.35, 1, 0.2, 0.33, 0.8 * f);
      }
    }
    trail.end();
  },
  spawn(e, ev, api) {
    const B = api.box;
    e.obj = api.course.get('seeker-drone', () => make(api));
    e.first = !!ev.first;
    e.hold = ev.hold || 110;
    e.hx = (ev.nx || 0) * B.x; e.hy = (ev.ny ?? 0.5) * B.y;
    e.shots = ev.shots || 3; e.fired = 0; e.tel = -1; e.cool = e.first ? 1.0 : 0.7;
    e.TEL = e.first ? 0.85 : 0.5; e.GAP = e.first ? 2.3 : 1.55; e.T = e.first ? 1.5 : 1.3;
    e.phase = 0; e.t = 0; e.flare = 0; e.r = 1.2; e.hitR = 1.3;
    e.x0 = e.hx * 1.8; e.y0 = e.hy + 9;
    e.x = e.x0; e.y = e.y0; e.z = -SPAWN_D;
    e.sx = e.sy = e.sz = 1.8;   // 3.8 long: its fins must read at its station (the tell is a shape change)
    const ud = e.obj.userData;
    setFlare(e, 0); ud.core.color.copy(RED); ud.bloom.material.opacity = 0.35; ud.bloom.scale.setScalar(1.6);
    e.spin = Math.random() * 6;
  },
  update(e, dt, api) {
    const ud = e.obj.userData, B = api.box, ship = api.ship, G = api.game;
    e.spin += dt * (e.phase === 1 && e.tel >= 0 ? 7 : 1.4);
    if (e.phase === 0) {
      // in out of the haze: fast, then braking onto its station
      const k = Math.min(1, e.t / 3.2), ease = 1 - (1 - k) * (1 - k);
      e.z = -SPAWN_D + (SPAWN_D - e.hold) * ease;
      e.x = e.x0 + (e.hx - e.x0) * ease; e.y = e.y0 + (e.hy - e.y0) * ease;
      if (k >= 1) { e.phase = 1; e.t = 0; }
    } else if (e.phase === 1) {
      // hold: drift toward your lane, never quite on top of it
      const tx = clamp(e.hx + (ship.x - e.hx) * 0.55, -B.x * 0.95, B.x * 0.95), ty = clamp(e.hy + (ship.y - e.hy) * 0.25, -B.y * 0.9, B.y * 0.95);
      e.x = damp(e.x, tx, 0.9, dt); e.y = damp(e.y, ty, 0.9, dt);
      e.z = -e.hold + Math.sin(e.t * 1.7) * 2;
      e.cool -= dt;
      if (e.tel < 0 && e.cool <= 0 && e.fired < e.shots) { e.tel = 0; G.telegraph(e); G.sfx('fire', { rate: 0.55, vol: 0.3, pan: clamp(e.x / B.x * 0.6, -0.6, 0.6) }); }
      if (e.tel >= 0) {
        e.tel += dt;
        const k = Math.min(1, e.tel / e.TEL);
        e.flare = smoothstep(0, 0.7, k);
        ud.core.color.copy(RED).lerp(HOT, smoothstep(0.55, 1, k));
        ud.bloom.material.opacity = 0.35 + 0.65 * k * (0.75 + 0.25 * Math.sin(e.tel * 40)); ud.bloom.scale.setScalar(1.6 + 3.2 * k);
        if (e.tel >= e.TEL) {
          e.tel = -1; e.fired++; e.cool = e.GAP;
          const side = e.x < ship.x ? -1 : 1;
          // it leaves wide on its own side and curves in: the thread shows the turn
          const muzzle = { x: e.x, y: e.y, z: e.z + 1.2 };
          const s = api.fire(muzzle, clamp(ship.x + side * 6.5, -B.x * 1.6, B.x * 1.6), ship.y + 2.5, { T: e.T, owner: e });
          const graze = e.first && e.fired === 1;
          bolts.push({ s, offX: graze ? -side * 1.6 : 0, offY: graze ? 0.4 : 0, acc: 42, hist: [], acc2: 0 });
          ud.core.color.copy(RED);
        }
      } else {
        e.flare = Math.max(0, e.flare - dt / 0.35);
        ud.bloom.material.opacity = damp(ud.bloom.material.opacity, 0.35, 6, dt); ud.bloom.scale.setScalar(damp(ud.bloom.scale.x, 1.6, 6, dt));
      }
      // done (or held too long): it peels away
      if ((e.fired >= e.shots && e.cool <= e.GAP - 1.6) || e.t > 16) { e.phase = 2; e.t = 0; e.vz = 0; }
    } else {
      // gone: it climbs away ahead, back out past the fog (rule 5: never vanish in plain view)
      e.vz = Math.min(320, e.vz + dt * 260);
      e.z -= e.vz * dt; e.y += 7 * dt;
      e.flare = Math.max(0, e.flare - dt * 3);
      if (e.z < -SPAWN_D) e.alive = false;
    }
    setFlare(e, e.flare);
    e.appear = api.appear(e.z);
    api.pose(e);
    e.obj.lookAt(ship.x, ship.y, 8);
    ud.inner.rotation.z = e.spin;
  },
});
