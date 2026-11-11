// A HERD WHALE (galaxy 2, THE TANGLE and the Snare): one of the herd's star-whales (Yori's starWhale, scaled) swimming
// right beside your lane, big and slow, just outside the box. An ALLY: never solid, never a target.
//  - In THE TANGLE's twist, leeches on the far side latch onto it and drag it out; their tethers cross your lane. Fly
//    through one and roll to snap it (the leech does that), and the whale swims free.
//  - In the Snare's fight she is THE MOTHER (mother: true): bigger, the one the Snare hunts. The boss reads her flank
//    for its volleys and tethers, and pays MOTHER SAFE.
//   add(d, 'g2-whale', { side: -1, nx: -1.55, ny: 0.1, len: 30, life: 12 })
//     d     where she has swum in beside you; life: seconds she stays before swimming off ahead (Infinity: until told)
import { THREE, defineAlly, buildModel, clamp, damp, SPAWN_D } from '../../api.js?v=0.6.0';
import { MESH } from './mesh.js?v=0.6.0';
import { interceptAsks } from '../../enemies/g2-hound/index.js?v=0.6.0';

export const WHALE = { fly: 3.2, len: 30, z: -10 };

function make(api) {
  const g = new THREE.Group();
  const keys = MESH.whale.map((x) => x.color + (x.glow ? '*' : ''));
  const m = buildModel(MESH.whale, { own: keys });
  const all = Object.values(m.mats); for (const mt of all) { mt.transparent = true; mt.opacity = 0.92; }
  m.mats['#cfe8ff'].emissive = new THREE.Color(0x203448);
  g.add(m.group);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xcfe8ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.25 }));
  halo.scale.set(18, 9, 1); g.add(halo);
  g.userData = { all, halo, inner: m.group };
  return g;
}

export default defineAlly({
  name: 'g2-whale',
  motion: 'own', spawnAt: 'now', lead: WHALE.fly,
  hazard: null,
  sample: { side: -1, len: 30 },
  // where a tether or a bolt lands on her: her flank on the side it comes from, level with the ship's plane
  flank(e, fromX) {
    const s = Math.sign(fromX - e.x) || 1, k = e.len / 14;
    return { x: e.x + s * 1.9 * k, y: e.y + 0.3 * k, z: clamp(1.5, e.z - 0.35 * e.len, e.z + 0.35 * e.len) };
  },
  spawn(e, ev, api) {
    const B = api.box;
    e.obj = api.course.get('g2-whale', () => make(api));
    e.side = ev.side ?? -1; e.len = ev.len || WHALE.len; e.mother = !!ev.mother;
    e.sx = e.sy = e.sz = e.len / 14;
    e.hx = (ev.nx ?? e.side * 1.55) * B.x + e.side * e.len * 0.12; e.hy = (ev.ny ?? 0.1) * B.y; e.hz = ev.z ?? WHALE.z;
    e.life = ev.life ?? 12; e.state = ev.warm ? 'swim' : 'in'; e.vz = 0; e.held = 0; e.drag = 0; e.out = 0; e.freed = false;
    e.x0 = e.hx * 1.6; e.y0 = e.hy + 10;
    e.x = ev.warm ? e.hx : e.x0; e.y = ev.warm ? e.hy : e.y0; e.z = ev.warm ? -80 : -SPAWN_D;
    e.r = 4;
    for (const mt of e.obj.userData.all) mt.opacity = e.mother ? 0.8 : 0.92;   // the mother is huge and close: a little see-through
  },
  // the bots: bolts flying at her (the Snare's volleys) are intercepted where they cross your lane
  rollAsk(e, api) { return interceptAsks(api.course.shots.filter((s) => s.tag === 'mother'), api); },
  update(e, dt, api) {
    const u = e.obj.userData;
    if (e.state === 'in') {
      // eased at both ends, so she leaves the haze slowly (she is huge: a fast first frame would jump in size)
      const k = Math.min(1, e.t / WHALE.fly), ease = k * k * k * (k * (k * 6 - 15) + 10);
      e.z = -SPAWN_D + (SPAWN_D + e.hz) * ease;
      e.x = e.x0 + (e.hx - e.x0) * ease; e.y = e.y0 + (e.hy - e.y0) * ease;
      if (k >= 1) { e.state = 'swim'; e.t = 0; }
    } else if (e.state === 'swim') {
      // a leech's pull drags her out from the lane; free again, she comes back
      e.out = damp(e.out, e.held > 0 ? 9 : 0, e.held > 0 ? 0.35 : 0.8, dt);
      e.x = e.hx + e.side * e.out + Math.sin(e.t * 0.5) * 0.4;
      e.y = e.hy + Math.sin(e.t * 0.4) * 0.6;
      e.z = e.hz + Math.sin(e.t * 0.3) * 0.8;
      if (e.t > e.life && !e.held) { e.state = 'go'; e.t = 0; }
    } else {
      // she swims off ahead, rising, out into the haze
      e.vz = Math.min(160, e.vz + dt * 40);
      e.z -= e.vz * dt; e.y += 2 * dt;
      if (e.z < -SPAWN_D) e.alive = false;
    }
    e.ouch = Math.max(0, (e.ouch || 0) - dt);
    u.halo.material.opacity = 0.18 + (e.held > 0 || e.ouch > 0 ? 0.12 * Math.sin(e.t * 14) : 0.08);
    // she grows in with time since she was born as well as with distance (as a boss does): never a jump in size
    e.age = (e.age || 0) + dt; const born = Math.min(1, e.age / 1.2);
    e.appear = api.appear(e.z) * born * born * (3 - 2 * born);
    api.pose(e);
    u.inner.rotation.set(Math.sin(e.t * 0.35) * 0.03, e.side * -0.04 * (e.held > 0 ? 3 : 1), Math.sin(e.t * 0.5) * 0.05);
  },
});
