// THE SHUTTLER (galaxy 3, level 2, THE LOOM FLOOR; the plan's 4.2). Yori's loom-shuttle (art-incoming/yori/g3/
// g3-enemies.js shuttler): long, sleek, pointed both ends, riding a rail beside the lane. It races in along its rail
// out of the haze, runs level with you a while, and fires bolts that WEAVE as they fly, side to side (or up and down,
// from a rail under the lane), each one drawing its weave behind it as a thin red thread and its path ahead as
// dots, so its rhythm reads. The weave crosses the lane and the bolt's line follows you, so stepping aside rarely
// works: roll where the weave crosses you and it goes home to its shuttle.
//   Tell: its red flank slits brighten to white-hot (0.6 s; 0.9 s for the first one you meet).
//   Event: { rail: 'L' | 'R' | 'B' (beside the lane, or under it), pos: nx or ny along the rail (default 0),
//            axis: 'x' | 'y' (the weave; default across the rail's side), shots: 3, gap: 1.6 (s), hold: 130 (m ahead),
//            first: true (the teaching one: a slower bolt that weaves wide of you and does not follow),
//            key: 'gate id' (a KEYED weave: sent home, it flies to that lockgate's keystone),
//            mesh: { hole: [dc, dr], parity: 0 | 1 } (THE CROSS-WEAVE: one volley into a three-by-three lattice round
//            where you are, about 1.7 m apart; this shuttle takes the cells of its parity, the hole [dc, dr] (-1..1, not
//            the middle) gets none; two shuttles of opposite parity, one across and one up-and-down, weave a mesh with
//            one hole: slip into it, or roll where you are and send the crossing home) }
import { THREE, defineEnemy, buildModel, GlowPoints, clamp, damp, smoothstep, SPAWN_D } from '../../api.js?v=0.6.1';
import { MESH } from './mesh.js?v=0.6.1';

export const SHOT_T = 1.36, TEL = 0.6, TEL_FIRST = 0.9;
const IN_T = 2.6;                 // the race in along the rail, out of the haze
const SCALE = 2.3;                // her shuttle is 5.2 long with its rail: drawn 12 m so it reads at its station
const RED = new THREE.Color(0xff3355), HOT = new THREE.Color(0xfff0f0);
const bolts = [];
let thread = null;

function make(api) {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const m = buildModel(MESH.shuttler, { own: ['#ff3355*'] }); inner.add(m.group);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  glow.position.set(0, 0, -1.9); glow.scale.setScalar(1.4); g.add(glow);
  g.userData = { core: m.mats['#ff3355*'], glow, inner };
  return g;
}
// where on the rail it rides, in metres
function station(ev, B) {
  const rail = ev.rail || 'L', at = ev.pos || 0;   // never ev.at: the engine stamps that on a lead kind's event (its birth distance)
  if (rail === 'B') return { x: at * B.x, y: -B.y * 1.32, side: 0, under: true };
  const s = rail === 'R' ? 1 : -1;
  return { x: s * B.x * 1.3, y: at * B.y, side: s, under: false };
}
// a bolt's line bends toward where you are now (not where you were), but only so fast: a late hard step still escapes
export function follow(acc) {
  return (s, dt, api) => {
    const vz = s.vz; if (!(vz > 0)) return;
    const tr = -s.z / vz; if (tr < 0.06) return;
    const bx = s.x - (s.weave && s.weave.axis !== 'y' ? s.woff || 0 : 0), by = s.y - (s.weave && s.weave.axis === 'y' ? s.woff || 0 : 0);
    const A = acc * dt;
    s.vx += clamp((api.ship.x - bx) / tr - s.vx, -A, A);
    s.vy += clamp((api.ship.y - by) / tr - s.vy, -A, A);
  };
}
// where a bolt crosses the ship's plane, and when (its line straight on, its weave at that moment)
function crossing(s) {
  const t = -s.z / Math.max(1e-3, s.vz), w = s.weave;
  let x = s.x + s.vx * t, y = s.y + s.vy * t;
  if (w) { const o = w.amp * Math.sin((s.age + t) * w.hz * Math.PI * 2 + w.phase) - (s.woff || 0); if (w.axis === 'y') y += o; else x += o; }
  return { t, x, y };
}

export default defineEnemy({
  name: 'g3-shuttler',
  motion: 'own', spawnAt: 'now', lead: IN_T,
  hazard: { cls: 'shot', introduced: [3, 2], shotT: SHOT_T, tel: TEL },
  killPts: 1500,
  sample: { rail: 'L', shots: 1 },
  targetable: (e) => e.phase === 1,
  init(api) { thread = new GlowPoints(api.scene, 900, api.glowTex); },
  // every frame: the red thread each bolt draws behind it
  begin(api) {
    if (!thread) return;
    if (api.focalPx) thread.mat.uniforms.uScale.value = api.focalPx;
    thread.begin();
    const dt = api.dt || 0;
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i], s = b.s;
      if (!s.alive || s.reflected) { b.fade = (b.fade ?? 1) - dt * 3; if (b.fade <= 0 || !b.hist.length) { bolts.splice(i, 1); continue; } }
      else { b.acc += dt; if (b.acc >= 1 / 50) { b.acc = 0; b.hist.unshift(s.x, s.y, s.z); if (b.hist.length > 66) b.hist.length = 66; } }
      const f0 = b.fade ?? 1;
      for (let k = 0; k < b.hist.length; k += 3) { const f = (1 - k / 70) * f0; thread.push(b.hist[k], b.hist[k + 1], b.hist[k + 2], 1.15 * f + 0.45, 1, 0.2, 0.33, 0.85 * f); }
    }
    thread.end();
  },
  spawn(e, ev, api) {
    const B = api.box, st = station(ev, B);
    e.obj = api.course.get('g3-shuttler', () => make(api));
    e.st = st; e.hold = ev.hold || 85;
    e.axis = ev.axis || (st.under ? 'y' : 'x');
    e.first = !!ev.first; e.key = ev.key || null; e.mesh = ev.mesh || null;
    e.shots = e.mesh ? 1 : (ev.shots ?? 3); e.gap = ev.gap ?? 1.6; e.fired = 0;
    e.TEL = e.first ? TEL_FIRST : TEL; e.T = e.first ? 1.6 : (ev.T || SHOT_T);
    e.cool = ev.delay ?? 0.35; e.tel = -1; e.phase = 0;
    e.x = st.x; e.y = st.y; e.z = -SPAWN_D;
    e.sx = e.sy = e.sz = SCALE; e.r = 1.6; e.hitR = 1.8;
    const ud = e.obj.userData; ud.core.color.copy(RED); ud.glow.material.opacity = 0;
    // her shuttle lies along Z, nose at -Z, its rail under it. It races in nose first (facing you), and on station it
    // turns its nose to the lane, the way a shuttle crosses a loom, so you see its whole length side-on
    ud.inner.rotation.set(0, 0, 0);
    e.yaw = Math.PI; e.yawTo = Math.PI;
  },
  update(e, dt, api) {
    const ud = e.obj.userData, ship = api.ship, G = api.game, B = api.box;
    if (e.phase === 0) {
      // racing in along its rail out of the haze, braking level with you
      // eased at both ends (as the bosses' fly-in): out of the haze from rest, so its first frames never jump in size
      const k = Math.min(1, e.t / IN_T), ease = k * k * k * (k * (k * 6 - 15) + 10);
      e.z = -SPAWN_D + (SPAWN_D - e.hold) * ease;
      if (e.t < 0.05) G.sfx('g3-shuttle', { vol: 0.5, pan: clamp(e.x / B.x * 0.6, -0.6, 0.6) });
      if (k >= 1) { e.phase = 1; e.t = 0; }
    } else if (e.phase === 1) {
      e.z = -e.hold + Math.sin(e.t * 2.1) * 1.5;
      e.cool -= dt;
      if (e.tel < 0 && e.cool <= 0 && e.fired < e.shots) { e.tel = 0; G.telegraph(e); }
      if (e.tel >= 0) {
        e.tel += dt;
        const k = Math.min(1, e.tel / e.TEL);
        ud.core.color.copy(RED).lerp(HOT, smoothstep(0.4, 1, k));
        ud.glow.material.opacity = k * (0.7 + 0.3 * Math.sin(e.tel * 38)); ud.glow.scale.setScalar(1.4 + 3 * k);
        if (e.tel >= e.TEL) { e.tel = -1; e.fired++; e.cool = e.gap; ud.core.color.copy(RED); ud.glow.material.opacity = 0; fire(e, api); }
      }
      if ((e.fired >= e.shots && e.cool <= e.gap - 1.4) || e.t > 18) { e.phase = 2; e.t = 0; e.vz = 0; }
    } else {
      // done: it races off ahead along its rail and back into the haze
      e.vz = Math.min(340, (e.vz || 0) + dt * 280);
      e.z -= e.vz * dt;
      if (e.z < -SPAWN_D) e.alive = false;
    }
    e.appear = api.appear(e.z);
    api.pose(e);
    e.yawTo = e.phase === 1 ? (e.st.under ? Math.PI / 2 : e.st.side * Math.PI / 2) : e.phase === 2 ? 0 : Math.PI;
    e.yaw = damp(e.yaw, e.yawTo, 7, dt);
    e.obj.rotation.set(0, e.yaw, 0);
  },
  // the bots: roll when a bolt of this shuttle reaches the ship's plane where the ship is
  rollAsk(e, api) {
    const out = [];
    for (const b of bolts) {
      const s = b.s; if (b.e !== e || !s.alive || s.reflected) continue;
      const c = crossing(s); if (c.t < -0.05 || c.t > 1.4) continue;
      out.push({ t: c.t, x: c.x, y: c.y, r: 2.0, key: b.n });
    }
    return out;
  },
  redirect(e, s, api) {
    // a keyed weave goes home to its lockgate's keystone
    if (s && s.tag && s.tag.keyTo) { const g = s.tag.keyTo; if (g.alive && g.kind.redirect) return g.kind.redirect(g, s, api); }
    return undefined;
  },
});

// one shot (or the cross-weave's whole volley)
function fire(e, api) {
  const ship = api.ship, B = api.box, from = { x: e.x + (e.st.under ? 0 : -e.st.side * 1.85 * SCALE), y: e.y + (e.st.under ? 1.0 : 0), z: e.z + 0.5 }; // its nose
  api.game.sfx('g3-weave', { vol: 0.7, pan: clamp(e.x / B.x * 0.6, -0.6, 0.6) });
  const T = e.T, Ts = T * (api.ease ? api.ease.shot : 1);
  const gate = e.key ? api.course.list.find((q) => q.alive && q.type === 'g3-lockgate' && q.ev.id === e.key) : null;
  const tag = gate ? { keyTo: gate } : undefined;
  if (e.mesh) {
    // THE CROSS-WEAVE: a three-by-three lattice of bolts round where you are, about 1.7 m apart, weaving into each
    // other's lanes so the threads make a mesh. This shuttle takes the cells of its parity; the hole gets none. Slip into
    // the hole, or roll where you are and send the crossing home (MULTI-DEFLECT). No bolt follows you.
    const M = e.mesh, gx = Math.max(0.24 * B.x, 1.55), gy = Math.max(0.36 * B.y, 1.55), hz = 1.5 / Ts;
    const cx = clamp(ship.x, -B.x + gx * 0.6, B.x - gx * 0.6), cy = clamp(ship.y, -B.y + gy * 0.6, B.y - gy * 0.6);
    for (let r = -1; r <= 1; r++) for (let c = -1; c <= 1; c++) {
      if ((((c + r) % 2) + 2) % 2 !== M.parity || (M.hole && c === M.hole[0] && r === M.hole[1])) continue;
      const tx = cx + c * gx, ty = cy + r * gy;
      const amp = (e.axis === 'y' ? gy : gx) * 0.75;
      const s = api.fire(from, tx, ty, { T, owner: e, weave: { amp, hz, axis: e.axis, phase: 0 }, tag });
      bolts.push({ s, e, n: e.fired * 100 + r * 10 + c, hist: [], acc: 0 });
    }
    return;
  }
  // a single bolt: one and a half waves across the lane, crossing its own line exactly as it reaches you
  const amp = (e.axis === 'y' ? B.y * 0.62 : B.x * 0.5) * (e.first ? 0.8 : 1), hz = 1.5 / Ts;
  let tx = clamp(ship.x + ship.vx * 0.25, -B.x, B.x), ty = clamp(ship.y + ship.vy * 0.25, -B.y, B.y);
  if (e.first) { if (e.axis === 'y') tx += tx > 0 ? -3.4 : 3.4; else ty += ty > 0 ? -2.9 : 2.9; } // wide: watch its thread
  const s = api.fire(from, tx, ty, { T, owner: e, weave: { amp, hz, axis: e.axis, phase: 0 }, steer: e.first ? undefined : follow(8), tag });
  bolts.push({ s, e, n: e.fired, hist: [], acc: 0 });
  if (gate && gate.shots) gate.shots.push(s); // the gate waits on it before it sends the bots to the duct
}
