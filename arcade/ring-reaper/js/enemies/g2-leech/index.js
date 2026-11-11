// THE LEECH (galaxy 2, THE TANGLE's enemy): a grafted lamprey, 5 long (Yori's leech), that swims alongside the lane.
//  - TELL: its mouth-ring glows red and a thin red aim-line reaches for you (1.0 s; 1.3 s the first time).
//  - THE TETHER: then it shoots its tether, and it LATCHES. While it is on you lose shield slowly and are dragged
//    toward the leech. It is a hit that isn't a moment but a state, and you have to end it.
//  - ROLL TO SNAP IT: SNAPPED!, the tether whips back and cracks the leech's graft (a deflect; a silver lamprey darts
//    off). Roll as the tether arrives instead and it glances off you: a graze, and the leech tries again.
//  - Left on, its grip tears loose after a few seconds on its own (no fully blocked moment, ever).
//  - target 'whale': it latches onto one of the herd's whales across your lane instead and drags it out. Its tether
//    crosses the lane: fly through it and roll to snap it (SNAPPED!, and the whale swims free).
//   add(d, 'g2-leech', { side: 1, ny: 0, z: -7, tries: 2, gap: 1.6, first: false, target: 'ship' })
//     d      where it has swum in beside you (out of the haze, FLY seconds before that); its aim starts `wait` s later
//     tries  how many times it shoots its tether (a glance-off or a tear-loose uses one; a snap ends it)
import { THREE, defineEnemy, buildModel, clamp, damp, smoothstep, SPAWN_D, HIT_R, GRAZE_R } from '../../api.js?v=0.6.1';
import { MESH } from './mesh.js?v=0.6.1';
import { Freed } from '../../levels/g2/level4/freed.js?v=0.6.1';

export const LEECH = { fly: 2.6, z: -7, nx: 1.3, wait: 0.4, tel: 1.0, telFirst: 1.3, reach: 0.4, reachFirst: 0.7, hold: 3.2, holdWhale: 5, bite: 4, drain: 4, drag: 3.6, nose: 2.6, snapR: 2.3 };
const FREE = new Freed(MESH.freed);
const UP = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), mid = new THREE.Vector3();

function rope(api, w, op) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.userData.w = w; m.visible = false; m.frustumCulled = false;
  return m;
}
// lay a rope from a to b (world points)
function lay(m, a, b, w) {
  dir.set(b.x - a.x, b.y - a.y, b.z - a.z); const len = dir.length() || 0.001;
  mid.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  m.position.copy(mid); m.scale.set(w, len, w); m.quaternion.setFromUnitVectors(UP, dir.multiplyScalar(1 / len));
}
function make(api) {
  const g = new THREE.Group();
  const rest = buildModel(MESH.rest).group, lit = buildModel(MESH.lit).group; lit.visible = false;
  const body = new THREE.Group(); body.add(rest, lit); g.add(body);
  const aim = rope(api, 0.05, 0.75), tether = rope(api, 0.13, 0.95);
  api.scene.add(aim, tether);
  g.userData = { rest, lit, body, aim, tether };
  return g;
}
const mouth = (e) => ({ x: e.x - Math.sin(e.yaw) * LEECH.nose, y: e.y, z: e.z - Math.cos(e.yaw) * LEECH.nose });
// the whale it goes for: a herd whale on the other side of the lane
function whaleFor(e, api) {
  let best = null;
  for (const q of api.course.list) if (q.type === 'g2-whale' && q.alive && q.state === 'swim' && Math.sign(q.x) !== e.side && (!best || Math.abs(q.z) < Math.abs(best.z))) best = q;
  return best;
}
// the closest point to p on segment a-b
function nearest(a, b, p) {
  const ax = b.x - a.x, ay = b.y - a.y, az = b.z - a.z, aa = ax * ax + ay * ay + az * az || 1e-9;
  const f = clamp(((p.x - a.x) * ax + (p.y - a.y) * ay + (p.z - a.z) * az) / aa, 0, 1);
  return { x: a.x + ax * f, y: a.y + ay * f, z: a.z + az * f };
}

export default defineEnemy({
  name: 'g2-leech',
  motion: 'own', spawnAt: 'now', lead: LEECH.fly,
  hazard: { cls: 'shot', introduced: [2, 6], shotT: LEECH.reach, tel: LEECH.tel },
  killPts: 1500,
  sample: { side: 1, ny: 0 },
  targetable: (e) => e.phase === 1,
  begin(api) { FREE.tick(api); },
  spawn(e, ev, api) {
    const B = api.box;
    e.obj = api.course.get('g2-leech', () => make(api));
    e.side = ev.side ?? 1; e.first = !!ev.first; e.target = ev.target || 'ship';
    e.hx = e.side * (ev.nx ?? LEECH.nx) * B.x; e.hy = (ev.ny ?? 0) * B.y; e.hz = ev.z ?? LEECH.z;
    e.tries = ev.tries ?? (e.target === 'whale' ? 1 : 2); e.gap = ev.gap ?? 1.6;
    e.TEL = e.first ? LEECH.telFirst : LEECH.tel; e.REACH = (e.first ? LEECH.reachFirst : LEECH.reach) * (api.ease ? api.ease.shot : 1);
    e.phase = 0; e.mode = 'wait'; e.mt = ev.wait ?? LEECH.wait; e.yaw = 0; e.vz = 0; e.n = 0; e.whale = null;
    e.x0 = e.hx * 1.6; e.y0 = e.hy + 5;
    e.x = ev.warm ? e.hx : e.x0; e.y = ev.warm ? e.hy : e.y0; e.z = ev.warm ? -40 : -SPAWN_D;
    if (ev.warm) e.phase = 1;
    e.r = 1.3; e.hitR = 1.7; e.sx = e.sy = e.sz = 1.1;
    const u = e.obj.userData; u.rest.visible = true; u.lit.visible = false; u.aim.visible = false; u.tether.visible = false;
    u.tether.material.color.setHex(0xff3355);   // a pooled leech freed mid-whip-back kept its cyan
  },
  update(e, dt, api) {
    const u = e.obj.userData, ship = api.ship, G = api.game, B = api.box;
    u.aim.visible = false; u.tether.visible = false;
    if (e.phase === 0) {
      const k = Math.min(1, e.t / LEECH.fly), ease = 1 - Math.pow(1 - k, 3);
      e.z = -SPAWN_D + (SPAWN_D + e.hz) * ease;
      e.x = e.x0 + (e.hx - e.x0) * ease; e.y = e.y0 + (e.hy - e.y0) * ease;
      if (k >= 1) { e.phase = 1; e.t = 0; }
    } else if (e.phase === 1) {
      // it swims beside you, its body rippling
      e.x = e.hx + Math.sin(e.t * 2.4) * 0.3; e.y = e.hy + Math.sin(e.t * 1.7) * 0.25; e.z = e.hz;
      if (e.mode === 'wait') {
        e.yaw = damp(e.yaw, 0, 3, dt); e.mt -= dt;
        if (e.mt <= 0) {
          if (e.n >= e.tries) { e.phase = 2; e.t = 0; }
          else {
            e.whale = e.target === 'whale' ? whaleFor(e, api) : null;
            if (e.target === 'whale' && !e.whale) { e.phase = 2; e.t = 0; }
            else { e.mode = 'aim'; e.mt = 0; G.sfx('fire', { rate: 0.45, vol: 0.3, pan: clamp(e.x / B.x * 0.6, -0.6, 0.6) }); }
          }
        }
      }
      const goal = () => (e.whale ? e.whale.kind.flank(e.whale, e.x) : { x: ship.x, y: ship.y, z: 0 });
      // its head turns to face what it is going for (her leech's mouth is at -Z: yaw so -Z points at the target; behind
      // it, you are about 125 degrees round; a whale is straight across the lane)
      if (e.mode !== 'wait') { const g = goal(); e.yaw = damp(e.yaw, Math.atan2(-(g.x - e.x), -(g.z - e.z)), 5, dt); }
      const m = mouth(e);
      if (e.mode === 'aim') {
        // the tell: its mouth-ring glows and a thin red aim-line reaches for the target
        e.mt += dt; const k = Math.min(1, e.mt / e.TEL), gp = goal();
        u.rest.visible = false; u.lit.visible = true;
        lay(u.aim, m, { x: m.x + (gp.x - m.x) * k, y: m.y + (gp.y - m.y) * k, z: m.z + (gp.z - m.z) * k }, 0.05 + 0.03 * Math.sin(e.mt * 30));
        u.aim.material.opacity = 0.35 + 0.5 * k; u.aim.visible = true;
        if (k >= 1) { e.mode = 'reach'; e.mt = 0; }
      } else if (e.mode === 'reach') {
        // the tether shoots out and arrives where the target is
        e.mt += dt; const k = Math.min(1, e.mt / e.REACH), gp = goal();
        lay(u.tether, m, { x: m.x + (gp.x - m.x) * k, y: m.y + (gp.y - m.y) * k, z: m.z + (gp.z - m.z) * k }, 0.13); u.tether.visible = true;
        if (k >= 1) {
          e.n++;
          if (e.whale) { e.mode = 'held'; e.mt = 0; e.whale.held = (e.whale.held || 0) + 1; G.sfx('g2-leech-latch', { vol: 0.6 }); }
          else if (ship.rolling) {
            // rolled as it arrived: it glances off you (a graze), and the leech pulls it back for another try
            G.graze({ x: ship.x + e.side * 0.8, y: ship.y, z: 0 }, 1.4, HIT_R, GRAZE_R);
            G.pop('GLANCED', ship.x, ship.y + 1.5, 0, 'cyan');
            e.mode = 'wait'; e.mt = e.gap; u.rest.visible = true; u.lit.visible = false;
          } else {
            // it latches: it drains your shield and drags you until you snap it or its grip tears (not a hit: a state)
            e.mode = 'latched'; e.mt = 0; G.sfx('g2-leech-latch', { pan: clamp(e.x / B.x * 0.6, -0.6, 0.6) });
            if (e.first) G.call('ROLL TO SNAP IT!', 'c-red');
          }
        }
      } else if (e.mode === 'latched' || e.mode === 'held') {
        e.mt += dt;
        const gp = goal();
        lay(u.tether, m, gp, 0.13 + 0.03 * Math.sin(e.mt * 18)); u.tether.visible = true;
        let snap = false;
        if (e.mode === 'latched') {
          G.drain(LEECH.drain * dt);
          const dx = e.x - ship.x, dy = e.y - ship.y, d = Math.hypot(dx, dy) || 1;
          api.push(dx / d * LEECH.drag, dy / d * LEECH.drag);
          snap = ship.rolling;
        } else {
          // a whale's tether across the lane: flying through it while rolling snaps it
          const p = nearest(m, gp, { x: ship.x, y: ship.y, z: 0 });
          snap = ship.rolling && Math.hypot(p.x - ship.x, p.y - ship.y, p.z) < LEECH.snapR;
          if (e.whale && e.whale.alive) e.whale.drag = e.side * -1;
        }
        if (snap) {
          G.counter({ label: 'SNAPPED!', target: e, x: ship.x, y: ship.y, sfx: 'g2-tether-snap', shake: 0.4 });
          e.mode = 'snapped'; e.mt = 0; e.tries = 0;
          if (e.whale) { e.whale.held = Math.max(0, (e.whale.held || 1) - 1); e.whale.freed = true; }
        } else if (e.mt > (e.whale ? LEECH.holdWhale : LEECH.hold)) {
          // its grip tears loose
          if (e.whale) e.whale.held = Math.max(0, (e.whale.held || 1) - 1);
          e.mode = 'wait'; e.mt = e.gap; u.rest.visible = true; u.lit.visible = false;
        }
      } else if (e.mode === 'snapped') {
        // the tether whips back into its mouth (the echo home cracks its graft)
        e.mt += dt; const k = Math.min(1, e.mt / 0.18), gp = goal();
        lay(u.tether, m, { x: gp.x + (m.x - gp.x) * k, y: gp.y + (m.y - gp.y) * k, z: gp.z + (m.z - gp.z) * k }, 0.1); u.tether.visible = k < 1;
        u.tether.material.color.setHex(0x53e6ff);
        if (k >= 1) { u.tether.material.color.setHex(0xff3355); e.mode = 'wait'; e.mt = 99; }
      }
    } else {
      // done: it peels away ahead, back into the haze
      e.vz = Math.min(170, e.vz + dt * 120);
      e.z -= e.vz * dt; e.x += e.side * 4 * dt;
      e.yaw = damp(e.yaw, 0, 3, dt);
      u.rest.visible = true; u.lit.visible = false;
      if (e.z < -SPAWN_D) e.alive = false;
    }
    e.appear = api.appear(e.z);
    api.pose(e);
    e.obj.rotation.set(0, e.yaw, Math.sin(e.t * 2.4) * 0.1);
  },
  remove(e, api) { const u = e.obj.userData; u.aim.visible = false; u.tether.visible = false; api.course.put('g2-leech', e.obj); },
  onKill(e, byShot, api) {
    const u = e.obj.userData; u.aim.visible = false; u.tether.visible = false;
    FREE.spawn(api, e, { side: e.side, out: 4, vz: 22, s: e.sx });
    // (the graft-crack sound is the engine's now: galaxies 4d1e242)
  },
  // the bots: snap a latched tether at once; fly to a whale's tether where it crosses the lane, and roll there
  rollAsk(e, api) {
    if (e.mode === 'latched') return [{ t: -0.045, key: 'l' + e.n }];   // now (just inside every bot's window)
    if (e.mode === 'held' && e.whale) {
      const B = api.box, m = mouth(e), gp = e.whale.kind.flank(e.whale, e.x);
      let best = null;
      for (let k = 0; k <= 16; k++) { const f = k / 16, x = m.x + (gp.x - m.x) * f, y = m.y + (gp.y - m.y) * f, z = m.z + (gp.z - m.z) * f; if (Math.abs(x) > B.x * 0.9 || Math.abs(y) > B.y * 0.9) continue; const sc = Math.abs(z) * 2 + Math.abs(x - api.ship.x) * 0.2; if (!best || sc < best.sc) best = { x, y, sc }; }
      return best ? [{ t: Math.hypot(best.x - api.ship.x, best.y - api.ship.y) < 1.5 ? -0.045 : 0.4, x: best.x, y: best.y, r: 1.5, go: true, key: 'w' + e.n }] : [];
    }
    return [];
  },
});
