// THE SLINGER (galaxy 2, GRAVITY GARDEN's enemy): a squat grafted shell-turret, 2.6 across, a curved siphon out of
// one side (Yori's slinger). It sits on the track BEHIND a gravity well and fires round it on purpose: its bolt leaves
// wide, swings round the well's far side and comes at you from the side you weren't watching. Its dotted path is
// drawn ahead of it the whole way, so the curve is always readable. Sent home by a roll, the bolt goes back round
// the well (the well bends it), which is lovely to watch, and the slinger's graft cracks.
// Its tell (her slinger(1)): the siphon's muzzle and its eyes go white-hot and a red glow swells at the muzzle.
//   add(d, 'g2-slinger', { nx, ny, swing: 1, shots: 2, gap: 1.6, at: 300 })
//     swing  which side of the well its bolts go round (+1: the well's right as you see it, -1: its left); it is
//            drawn mirrored so the siphon points that way
//     shots  bolts; gap: seconds between them; at: how far ahead it fires its first (metres, 300)
//     wide   metres off you, toward its swing side, that its bolts land (0: at you; the Binary's crossfire lands one
//            wide, so only the Mirror Shell's reach takes both in one roll)
// It fires round the nearest well between it and you; with none, it fires its swing round an empty point instead.
import { THREE, defineEnemy, buildModel, clamp, smoothstep } from '../../api.js?v=0.5.0';
import { MESH } from './mesh.js?v=0.5.0';
import { Freed } from '../../levels/g2/level4/freed.js?v=0.5.0';

export const SLINGER = { T: 1.5, tel: 0.7, at: 300, gap: 1.6, s: 1.5 };
const RED = new THREE.Color(0xff3355), HOT = new THREE.Color(0xfff0f0);
const FREE = new Freed(MESH.freed);
const bez = (a, b, c, d, u) => { const v = 1 - u; return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d; };

function make(api) {
  const g = new THREE.Group(), inner = new THREE.Group(); inner.rotation.y = Math.PI; g.add(inner);   // siphon toward you
  const m = buildModel(MESH.rest, { own: ['#ff3355*'] }); inner.add(m.group);
  const charge = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  charge.position.set(-1.0, 0, 1.2); g.add(charge);
  g.userData = { red: m.mats['#ff3355*'], charge, inner };
  return g;
}
// the well it fires round: the nearest one between it and you
function wellFor(e, api) {
  let best = null;
  for (const q of api.course.list) if (q.type === 'g2-gravity-well' && q.alive && q.z > e.z && q.z < -20 && (!best || q.z < best.z)) best = q;
  return best;
}

// one bolt: a curve from the muzzle, round the well's far side, onto the ship's plane where the ship will be. The
// points that belong to the track (the muzzle, the well) stream toward you as it flies; the landing point does not.
// The bolt tracks the curve exactly (each frame it is put where the curve is), so the dotted preview shows it true.
function fire(e, api) {
  const B = api.box, ship = api.ship, v = api.v, T = SLINGER.T * (api.ease ? api.ease.shot : 1);
  const m = { x: e.x + e.swing * 1.0 * e.sx, y: e.y, z: e.z + 1.6 * e.sx };
  const W = wellFor(e, api) || { x: e.x * 0.5, y: e.y, z: e.z + 80, r: 3 };
  const tx = clamp(ship.x + ship.vx * 0.3 + e.swing * e.wide, -B.x * 1.2, B.x * 1.2), ty = clamp(ship.y + ship.vy * 0.2, -B.y, B.y);
  const side = e.swing, wr = (W.r || 3) * 2.6 + 2;
  const P = [
    [m.x, m.y, m.z, 1],
    [W.x + side * wr, W.y + 0.3 * (ty - W.y), W.z, 1],             // round the well's far side, level with it
    [tx + side * 9, ty + 0.5, -26, 0],                            // swinging in at you from that side (fixed to you)
    [tx, ty, 0, 0],
  ];
  const steer = (s, dt, A) => {
    const u = clamp(s.age / T, 0, 1.4), k = s.age * v;   // T and v are this bolt's own (the preview's copy has neither)
    // over its last stretch it leans in on where you are now (as galaxy 1's seeker bolts do), so a bolt you moved away
    // from still asks for a roll; the swing round the well is the same either way
    const h = A ? clamp((u - 0.45) / 0.45, 0, 1) : 0, sx = h ? (A.ship.x - P[3][0]) * h : 0, sy = h ? (A.ship.y - P[3][1]) * h : 0;
    const p = (i) => bez(P[0][i] + (i === 2 ? k * P[0][3] : 0), P[1][i] + (i === 2 ? k * P[1][3] : 0), P[2][i] + (i === 2 ? k * P[2][3] : 0) + (i === 0 ? sx : i === 1 ? sy : 0), P[3][i] + (i === 0 ? sx : i === 1 ? sy : 0), Math.min(1, u));
    let x = p(0), y = p(1), z = p(2);
    if (u > 1) { const du = u - 1; x += (P[3][0] - P[2][0]) * 3 * du; y += (P[3][1] - P[2][1]) * 3 * du; z += 26 * 3 * du; }   // on past you along its last heading, out behind the camera
    if (dt > 0) { s.vx = (x - s.x) / dt; s.vy = (y - s.y) / dt; s.vz = (z - s.z) / dt; }
  };
  api.fire(m, tx, ty, { T: SLINGER.T, owner: e, tag: 'sling', preview: true, steer });
  api.game.sfx('fire', { rate: 0.8, vol: 0.6, pan: clamp(e.x / B.x * 0.6, -0.6, 0.6) });
  e.fired++; e.tel = -1;
}

export default defineEnemy({
  name: 'g2-slinger',
  hazard: { cls: 'shot', introduced: [2, 5], shotT: SLINGER.T, tel: SLINGER.tel },
  killPts: 1500,
  sample: { nx: 0.5, ny: 0.4, swing: 1 },
  targetable: (e) => e.z < -8,
  begin(api) { FREE.tick(api); },
  spawn(e, ev, api) {
    e.obj = api.course.get('g2-slinger', () => make(api));
    e.swing = ev.swing || 1; e.shots = ev.shots || 2; e.gap = ev.gap ?? SLINGER.gap; e.fireAt = ev.at ?? SLINGER.at;
    e.fired = 0; e.tel = -1; e.next = null; e.wide = ev.wide || 0;
    e.sx = e.sy = e.sz = SLINGER.s; e.r = 1.6; e.hitR = 1.9;
    const u = e.obj.userData; u.red.color.copy(RED); u.charge.material.opacity = 0;
  },
  update(e, dt, api) {
    const u = e.obj.userData;
    // fire by distance (the first at `at` metres out, then every gap seconds), each after its tell
    if (e.next === null && e.z > -e.fireAt - SLINGER.tel * api.v) e.next = 0;
    if (e.next !== null && e.fired < e.shots && e.z < -30) {
      if (e.tel < 0) { e.next -= dt; if (e.next <= 0) { e.tel = 0; api.game.sfx('fire', { rate: 0.55, vol: 0.3 }); } }
      else {
        e.tel += dt;
        const k = Math.min(1, e.tel / SLINGER.tel);
        u.red.color.copy(RED).lerp(HOT, smoothstep(0.35, 1, k));
        u.charge.material.opacity = 0.25 + 0.75 * k; u.charge.scale.setScalar(1.6 + 3.4 * k);
        if (e.tel >= SLINGER.tel) { fire(e, api); e.next = e.gap; u.red.color.copy(RED); }
      }
    } else u.charge.material.opacity = Math.max(0, u.charge.material.opacity - dt * 3);
    api.pose(e);
    e.obj.scale.x *= -e.swing;   // mirrored so the siphon points the way its bolts swing
    e.obj.rotation.set(0, Math.sin(e.t * 0.8) * 0.1, Math.sin(e.t * 1.3) * 0.05);
    if (e.z > 12) e.alive = false;
  },
  onKill(e, byShot, api) {
    FREE.spawn(api, e, { side: e.x >= 0 ? 1 : -1, out: 4, vz: 15, s: e.sx });
    // (the graft-crack sound is the engine's now: galaxies 4d1e242)
  },
});
