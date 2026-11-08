// THE GULPER (galaxy 2, the Shoals): Yori's sleek grafted hunter with red gill-seams. It cuts ACROSS the lane through a
// shoal, and the shoal parts round it into two streams of rings (the level lays the split where it crosses: ev.split on
// the fish). Its body is a hazard: it swims a straight diagonal through the track, so its path reads from the read line
// on (the boulder's rule); its tell is 1.2 s of its eyes lighting red, a wake through the motes and a side arrow. Once
// past you it wheels round, darts out ahead, turns to face you and spits a PAIR back: roll them home and its graft
// cracks. Freed, it goes silver (Yori's freed: her colour map, the seams gone) and darts off into the deep.
// THE GLOW (Evrtek 11-08, after playing the Shoals: "a glow on them when they're going to come towards you"), with
// ev.glow: over the last second before its body crosses your plane it lights up red along its length (rule 9's hurts
// colour: her body warms red and a red light gathers round it), swelling on each beat to the crossing, which the level
// lays on a beat; once it is past, the glow dies in a quarter of a second. Visible from 1.0 s out, strong from 0.8 s.
//   add(d, 'g2-gulper', { from: -1 | 1, cross: nx where it meets the ship's plane, ny, span: 220, shots: 2,
//                         glow: the level's beat in seconds (or true: 0.45 s) })
import { THREE, defineEnemy, buildModel, clamp, damp, smoothstep, SHIP_R, READ_D, SPAWN_D } from '../../api.js?v=0.4.0';
import { MESH } from './mesh.js?v=0.4.0';

const S = 1.3;                                          // her gulper is 6 long; it flies at about 8
const EYE_DARK = new THREE.Color(0x2a2730), EYE_LIT = new THREE.Color(0xff99aa);
// Yori's freed(): hunter -> silver, hunterLit -> silverLit, hunterDark -> silverDeep; graft and truss dropped
const FREED = { '#24485a': 0xc8d0dc, '#3f7a8a': 0xeef2ff, '#132a36': 0x8a96a8 };
const BODY = Object.keys(FREED);
const TEL = 0.6, SHOT_T = 1.1, HOLD_Z = -72;
const GLOW_T0 = 1.1, GLOW_T1 = 0.6, RED = new THREE.Color(0xff3355);   // the glow builds from 1.1 s out, full by 0.6 s
function make(api) {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const m = buildModel(MESH.lit, { own: ['#ff99aa*', '#ff3355*', '#2a2e44', ...BODY] }); inner.add(m.group);
  const mouth = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  mouth.position.set(0, 0, -3.4); mouth.scale.setScalar(2.4); inner.add(mouth);
  // the glow: three soft red lights along her body (it lies along z, nose at -z), one material per gulper
  const aura = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 });
  for (const z of [-2.3, 0, 2.2]) { const s = new THREE.Sprite(aura); s.position.set(0, 0, z); s.scale.setScalar(z ? 4.2 : 5.0); inner.add(s); }
  g.userData = { inner, mats: m.mats, mouth, aura };
  return g;
}
// the glow (ev.glow): while it sweeps in, from GLOW_T0 s before its crossing, full by GLOW_T1, a swell on each beat (the
// crossing is on one); from the crossing on it fades (4 a second), never toggled in one frame
function glow(e, dt, v, u) {
  let want = 0;
  if (e.phase === 0 && e.z < 0) {
    const tIn = -e.z / Math.max(1, v), beat = typeof e.ev.glow === 'number' ? e.ev.glow : 0.45;
    want = smoothstep(GLOW_T0, GLOW_T1, tIn) * (0.78 + 0.22 * Math.cos(tIn / beat * Math.PI * 2));
  }
  e.glow = want > e.glow ? want : Math.max(want, e.glow - dt * 4);
  u.aura.opacity = 0.95 * e.glow;
  if (e.freed) return;
  if (e.glow > 0) { for (const k of BODY) u.mats[k].color.set(k).lerp(RED, 0.7 * e.glow); e.tinted = true; }
  else if (e.tinted) { for (const k of BODY) u.mats[k].color.set(k); e.tinted = false; }
}
export default defineEnemy({
  name: 'g2-gulper',
  breaks: false,
  hazard: { cls: 'mover', introduced: [2, 2], warn: (ev, v) => READ_D / v },
  sample: { from: 1, cross: 0, ny: 0 },
  killPts: 1200,
  targetable: (e) => e.phase === 2 && !e.freed,
  // its body as it meets the ship's plane: a capsule along its swim, as three circles
  avoid: (e) => { if (e.phase !== 0) return []; const x = e.xAt(0); return [-2.2, 0, 2.2].map((o) => ({ x: x + o, y: e.y, r: 2.3 })); },
  spawn(e, ev, api) {
    e.obj = api.course.get('g2-gulper', () => make(api));
    const B = api.box, span = ev.span || 220, xc = (ev.cross || 0) * B.x, from = ev.from || 1;
    e.from = from; e.span = span;
    e.k = (1.6 * B.x - from * xc) / span;                 // metres sideways per metre the ship comes on
    e.xAt = (z) => xc + from * e.k * (-z);
    e.x = e.xAt(e.z); e.y = (ev.ny || 0) * B.y;
    e.r = 1.6; e.phase = 0; e.told = false; e.freed = false; e.fired = 0; e.tel = -1; e.t2 = 0; e.yaw = from * Math.PI / 2; e.roll = 0;
    e.sx = e.sy = e.sz = S;
    const u = e.obj.userData; u.mats['#ff99aa*'].color.copy(EYE_DARK); u.mats['#ff3355*'].visible = true; u.mats['#2a2e44'].visible = true;
    for (const k of BODY) u.mats[k].color.set(k); u.mouth.material.opacity = 0;
    u.aura.opacity = 0; e.glow = 0; e.tinted = false;
  },
  update(e, dt, api) {
    const ev = e.ev, u = e.obj.userData, ship = api.ship, v = api.v, B = api.box;
    if (e.phase === 0) {
      // the sweep: a straight diagonal through the track
      e.x = e.xAt(e.z);
      const tIn = -e.z / Math.max(1, v);                  // seconds until it meets the ship's plane
      if (!e.told && tIn < 1.2 + 0.9 && !ev.warm) { e.told = true; api.game.warn(e.from, 1.2); api.game.sfx('g2-gulper-pass', { pan: e.from * 0.5 }); }
      const eye = smoothstep(2.1, 0.9, tIn);
      u.mats['#ff99aa*'].color.copy(EYE_DARK).lerp(EYE_LIT, eye);
      // its wake through the plankton, from the tell on
      if (e.told && Math.random() < dt * 50) api.game.emit(e.x + e.from * 3, e.y + (Math.random() - 0.5) * 2, e.z + (Math.random() - 0.5) * 3, { life: 0.8, s0: 0.5, s1: 1.4, r: 0.6, g: 1, b: 0.76, a: 0.4, carry: 1, vx: e.from * 3 });
      if (e.crossed && !e.hit && !ev.warm) {
        // its body along its swim (sideways): a capsule 2 x 3.4 m either side of its middle
        const dx = Math.max(0, Math.abs(ship.x - e.x) - 3.0 * S / 1.3), dy = ship.y - e.y, d = Math.hypot(dx, dy), reach = 0.9 + SHIP_R;
        if (d < reach) { e.hit = true; api.game.crash(e, 16, true); } else if (d < reach + 1.8) api.game.scrape(e, d);
      }
      if (e.z > 8) { e.phase = 1; e.t2 = 0; e.p1 = { x: e.x, y: e.y, z: e.z }; }
    } else {
      e.z -= v * dt;                                       // from here it swims on its own (the course no longer carries it)
      e.t2 += dt;
      if (e.phase === 1) {
        // wheel round and dart out ahead, wide of the lane on the side it was heading for
        const k = smoothstep(0, 1.5, e.t2), side = -e.from, tx = side * 1.3 * B.x, ty = clamp(e.p1.y + 0.25 * B.y, -B.y * 0.8, B.y * 0.8);
        e.x = e.p1.x + (tx - e.p1.x) * k; e.y = e.p1.y + (ty - e.p1.y) * k; e.z = e.p1.z + (HOLD_Z - e.p1.z) * k;
        e.yaw = damp(e.yaw, 0, 4, dt);
        if (e.t2 > 1.5) { e.phase = 2; e.t2 = 0; }
      } else if (e.phase === 2) {
        // face you and spit the pair, then hold while they fly
        e.yaw = damp(e.yaw, Math.PI, 6, dt);
        const n = ev.shots ?? 2, at = (i) => 0.5 + i * 0.32;
        if (!e.freed && e.fired < n) {
          const tf = at(e.fired), into = e.t2 - (tf - TEL);
          if (into > 0) u.mouth.material.opacity = Math.max(u.mouth.material.opacity, into / TEL);
          if (e.t2 >= tf) { e.fired++; api.fire(e, ship.x, ship.y, { T: SHOT_T }); u.mouth.material.opacity = 1; }
        }
        u.mouth.material.opacity = Math.max(0, u.mouth.material.opacity - dt * 2);
        if (e.t2 > at(n - 1) + SHOT_T * 1.4 || e.freed) { e.phase = 3; e.t2 = 0; e.p3 = { x: e.x, y: e.y, z: e.z }; }
      } else {
        // away into the deep (freed: silver, rolling over)
        e.yaw = damp(e.yaw, 0, 3, dt); if (e.freed) e.roll += dt * 5;
        e.z -= (40 + e.t2 * 160) * dt; e.x += Math.sign(e.x || 1) * dt * 6;
        if (e.z < -SPAWN_D + 20) e.alive = false;
      }
    }
    if (ev.glow !== false && !ev.warm) glow(e, dt, v, u); // 11-08: on for every gulper (Evrtek: "yes"); ev.glow false turns it off
    u.inner.rotation.set(0, e.yaw, e.roll);
    api.pose(e);
    if (e.z > 40) e.alive = false;
  },
  // its own fire, sent home, cracks the graft: freed (Yori's colour map), and off it goes
  onShot(e, s, api) {
    if (e.freed) return;
    e.freed = true;
    const u = e.obj.userData;
    for (const k of BODY) u.mats[k].color.setHex(FREED[k]);
    u.mats['#ff3355*'].visible = false; u.mats['#2a2e44'].visible = false; u.mats['#ff99aa*'].color.copy(EYE_DARK);
    api.game.kill(e, true);                // the engine frees it: pearl motes, the graft's crack, FREED!
    api.game.burst(e.x, e.y, e.z, 30, { speed: 12, life: 0.6, s0: 1.2, r: 1, g: 0.3, b: 0.35, carry: 0, drag: 1.5 });   // and the red graft falls away in shards
    if (e.phase === 2) { e.phase = 3; e.t2 = 0; }
  },
});
