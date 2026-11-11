// THE CALF (galaxy 2, THE MIGRATION on): a young star-whale, soft blue-white and big (Yori's calf(), 14 long), that
// swims beside your lane. An ALLY: never solid (you pass through its glow), never a target. It mostly stays just
// outside the box and sometimes drifts in (the level's path says where). Hounds fire slow bolts at it across your
// lane: fly into a bolt's path and roll (INTERCEPT!). A bolt that reaches it makes it flinch and its glow drops a
// step. It cannot die; it can only end the level dimmer, and a step comes back after a while with nothing hitting it.
// When the level sends it home (the Nursery) it swims off to its mother, and a fully bright calf pays CALF SAFE.
//   add(d, 'g2-calf', { side: -1, ny: -0.1, path: [[d, nx, ny], ...], home: dHome })
//     d      where it has finished swimming in beside you (it comes out of the haze for FLY seconds before that)
//     path   where it swims, by course distance, in the normalised box (outside it, |nx| about 1.35, is its usual
//            place; inside it, it marks a lane: its glow is the safe line). Between two points it eases across.
//     home   the course distance where it leaves for its mother; CALF SAFE is paid then if it is fully bright
import { THREE, defineAlly, buildModel, clamp, damp, smoothstep, SPAWN_D } from '../../api.js?v=0.6.2';
import { MESH } from './mesh.js?v=0.6.2';

export const CALF = { z: -3, s: 0.85, steps: 4, recover: 12, fly: 3, bonus: 20000 };
const BRIGHT = new THREE.Color(0xe8f6ff), DIM = new THREE.Color(0x30465e), BODY = new THREE.Color(0xcfe8ff);

function make(api) {
  const g = new THREE.Group();
  const m = buildModel(MESH.calf, { own: ['#e8f6ff*', '#cfe8ff', '#6a90b8', '#2a4a70'] });
  const body = m.mats['#cfe8ff'];
  const all = Object.values(m.mats); for (const mt of all) { mt.transparent = true; mt.side = THREE.FrontSide; } body.emissive = new THREE.Color(0x30506e); body.emissiveIntensity = 0.8;
  g.add(m.group);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xcfe8ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.4 }));
  halo.scale.set(22, 12, 1); g.add(halo);
  g.userData = { spots: m.mats['#e8f6ff*'], body, halo, inner: m.group, all };
  return g;
}

// the live calf beside you (swimming, not arriving or leaving), or null
export function calfOf(api) {
  for (const q of api.course.list) if (q.type === 'g2-calf' && q.alive && q.state === 'swim') return q;
  return null;
}
// where a bolt fired from x = fromX should land on the calf: its flank on that side, `flank` metres out
export function calfAim(c, fromX, flank = 1.8) {
  const s = Math.sign(fromX - c.x) || 1;
  return { x: c.x + s * flank, y: c.y + 0.2, z: c.z };
}
export function flinch(c, api) {
  if (!c.alive || c.state !== 'swim') return;
  c.glow = Math.max(0, c.glow - 1); c.flinches++; c.since = 0; c.shake = 0.7;
  api.game.sfx('g2-calf-flinch', { pan: clamp(c.x / api.box.x * 0.6, -0.6, 0.6) });
  api.game.pop('THE CALF IS HIT', c.x * 0.6, c.y + 3, -6, 'red');
}

// where it wants to be now, in the normalised box: its path at the current course distance
function targetOf(e, api) {
  const P = e.path, d = api.G.courseD || 0;
  if (!P || !P.length) return [e.side * 1.5, e.ev.ny ?? -0.1];
  if (d <= P[0][0]) return [P[0][1], P[0][2]];
  for (let i = 1; i < P.length; i++) if (d < P[i][0]) { const a = P[i - 1], b = P[i], k = smoothstep(a[0], b[0], d); return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  const z = P[P.length - 1]; return [z[1], z[2]];
}

export default defineAlly({
  name: 'g2-calf',
  motion: 'own', spawnAt: 'now', lead: CALF.fly,
  hazard: null,
  sample: { side: -1, ny: 0 },
  spawn(e, ev, api) {
    e.obj = api.course.get('g2-calf', () => make(api));
    const B = api.box;
    e.side = ev.side ?? -1; e.path = ev.path || null; e.home = ev.home ?? Infinity;
    e.glow = CALF.steps; e.flinches = 0; e.since = 0; e.shake = 0; e.paid = false;
    e.state = ev.warm ? 'swim' : 'in';
    const [nx, ny] = targetOf(e, api);
    e.tx = nx * B.x; e.ty = ny * B.y;
    e.x0 = e.tx * 1.5; e.y0 = e.ty + 7;
    e.x = ev.warm ? e.tx : e.x0; e.y = ev.warm ? e.ty : e.y0; e.z = ev.warm ? -40 : -SPAWN_D;
    e.sx = e.sy = e.sz = CALF.s; e.r = 3; e.op = 0.9; e.vz = 0;
    const u = e.obj.userData; u.spots.color.copy(BRIGHT); u.body.opacity = 0.9;
  },
  update(e, dt, api) {
    const B = api.box, u = e.obj.userData;
    const [nx, ny] = targetOf(e, api);
    e.tx = nx * B.x; e.ty = ny * B.y;
    if (e.state === 'in') {
      // out of the haze, slowing to swim beside you
      const k = Math.min(1, e.t / CALF.fly), ease = k * k * k * (k * (k * 6 - 15) + 10);   // eased at both ends
      e.z = -SPAWN_D + (SPAWN_D + CALF.z) * ease;
      e.x = e.x0 + (e.tx - e.x0) * ease; e.y = e.y0 + (e.ty - e.y0) * ease;
      if (k >= 1) { e.state = 'swim'; e.t = 0; api.game.sfx('g2-calf-call', { pan: clamp(e.x / B.x * 0.6, -0.6, 0.6) }); }
    } else if (e.state === 'swim') {
      const px = e.x;
      e.x = damp(e.x, e.tx, 1.4, dt); e.y = damp(e.y, e.ty, 1.4, dt);
      e.z = CALF.z + Math.sin(e.t * 0.7) * 0.35;
      e.vx = dt > 0 ? (e.x - px) / dt : 0;
      e.since += dt;
      if (e.glow < CALF.steps && e.since > CALF.recover) { e.glow++; e.since = 0; }
      if ((api.G.courseD || 0) >= e.home && !e.ev.warm) {
        e.state = 'home'; e.t = 0;
        if (e.glow >= CALF.steps) { e.paid = true; api.game.bonus('CALF SAFE', CALF.bonus); api.game.call('CALF SAFE', 'c-cyan'); }
        else api.game.call('THE CALF IS HOME', 'c-cyan');
        api.game.sfx('g2-calf-call', { vol: 1 });
      }
    } else {
      // home: it swims off ahead to its mother, rising, out into the haze
      e.vz = Math.min(220, e.vz + dt * 60);
      e.z -= e.vz * dt; e.y += 3 * dt; e.x = damp(e.x, e.side * B.x * 0.6, 0.4, dt);
      if (e.z < -SPAWN_D) e.alive = false;
    }
    // its glow is its health: the spots dim a step a flinch, the halo with them
    const g = e.glow / CALF.steps;
    u.spots.color.copy(DIM).lerp(BRIGHT, g);
    u.body.emissiveIntensity = (0.25 + 0.75 * g) * (0.3 + 0.7 * e.op);
    u.halo.material.opacity = (0.12 + 0.3 * g) * (e.shake > 0 ? 0.5 + 0.5 * Math.sin(e.t * 50) : 1);
    // inside the box it turns see-through, so it never hides what is coming
    const inBox = Math.abs(e.x) < B.x * 1.1 && Math.abs(e.y) < B.y * 1.15;
    e.op = damp(e.op, inBox ? 0.18 : 0.92, 3, dt); for (const mt of u.all) { mt.opacity = e.op; mt.depthWrite = e.op > 0.6; }
    u.body.color.copy(BODY);
    e.shake = Math.max(0, e.shake - dt);
    e.age = (e.age || 0) + dt; const born = Math.min(1, e.age / 1.0);   // grows in by time too: never a jump in size
    e.appear = api.appear(e.z) * born * born * (3 - 2 * born);
    api.pose(e);
    e.obj.position.x += e.shake > 0 ? Math.sin(e.t * 47) * e.shake * 0.5 : 0;
    u.inner.rotation.set(Math.sin(e.t * 0.6) * 0.04, clamp(-(e.vx || 0) * 0.04, -0.35, 0.35), Math.sin(e.t * 0.9) * 0.07);
  },
});
