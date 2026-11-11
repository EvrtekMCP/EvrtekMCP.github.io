// THE ROOT-WHIP (galaxy 2, level 10, THE ROOTMIND: the finale's new obstacle). A machine root 30 m long, anchored outside
// the lane. It lies swung out of the flight box; its tell is the bark splitting along its length with red light running
// up it (1.2 s, the plan's 3.10); then it LASHES in (0.28 s) and rests as a bar across the lane until it has gone by.
// You are either side of it or you are hit. Yori's rootWhip (g2/enemies.js), drawn with its wave flattened a little.
//   ev: dir 'h' (a bar across, anchored left or right; dodge up or down) | 'v' (a bar up and down, anchored top or
//       bottom; dodge sideways)
//       ny (for 'h') / nx (for 'v'): where its rest line crosses the lane's middle, normalised
//       piv: -1 | 1 which end it is anchored at (h: left | right, v: bottom | top)     tilt: its rest angle off square (rad)
//       tel (1.2 s), lead (0.8 s: the lash ends this long before it reaches you), from (+1 | -1: which side of its rest
//       line it lashes in from; default the side nearer its edge), grow: true (born near, in a boss fight: it shoots out
//       of its anchor over half a second instead of growing in with distance)
// Every moment is timed by its time to arrival (-z / speed), so at any speed (GREED included) the lash always ends
// `lead` seconds before it reaches you and its tell runs its full length.
import { THREE, defineObstacle, buildModel, clamp, SHIP_R } from '../../api.js?v=0.6.0';
import { MESH } from './mesh.js?v=0.6.0';

const LEN = 30, SY = 0.6, STROKE = 0.28, SWING = { h: 0.8, v: 1.0 };
const WAVE = 1.2 * SY, HALF = 0.62;                 // the root's wave across its length, and its half-thickness (inside the drawn bark)
const BARK_DARK = new THREE.Color(0x2a1c12), SEAM = new THREE.Color(0xff3355), HOT = new THREE.Color(0xffd6dc);
const tmp = new THREE.Color();
const waveAt = (xl) => Math.sin(xl / LEN * Math.PI * 2) * WAVE;
const crash = (api, e, dmg) => api.game.crash({ x: api.ship.x, y: api.ship.y, type: e.type, kind: e.kind }, dmg);

function make(api) {
  const g = new THREE.Group(), arm = new THREE.Group(); g.add(arm);
  const m = buildModel(MESH.whip, { own: ['#ff99aa*'] });
  m.group.position.x = LEN / 2; m.group.scale.set(1, SY, 1);   // her root runs -15..15 along x: put its anchor at 0
  arm.add(m.group);
  // the red light running up the split bark during the tell
  const run = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  run.scale.set(5, 2.4, 1); arm.add(run);
  g.userData = { arm, seam: m.mats['#ff99aa*'], run };
  return g;
}
// the rest line, the anchor and the angle it lashes in from, worked out once from the event
function geometryOf(e, ev, box) {
  const dir = ev.dir === 'v' ? 'v' : 'h', piv = ev.piv === 1 ? 1 : -1, tilt = ev.tilt || 0;
  let C, phiR, Lp;
  if (dir === 'h') { C = [0, (ev.ny || 0) * box.y]; phiR = (piv < 0 ? 0 : Math.PI) + tilt; Lp = 16 / Math.cos(tilt); }
  else { C = [(ev.nx || 0) * box.x, 0]; phiR = (piv < 0 ? Math.PI / 2 : -Math.PI / 2) + tilt; Lp = 11 / Math.cos(tilt); }
  const P = [C[0] - Lp * Math.cos(phiR), C[1] - Lp * Math.sin(phiR)];
  // which way it comes in from: the side of its rest line nearer the lane's edge (or ev.from)
  const want = ev.from || (dir === 'h' ? (C[1] >= 0 ? 1 : -1) : (C[0] >= 0 ? 1 : -1));
  const mid = (s) => { const a = phiR + s, x = P[0] + Math.cos(a) * LEN / 2, y = P[1] + Math.sin(a) * LEN / 2; return dir === 'h' ? y - C[1] : x - C[0]; };
  const sw = SWING[dir], swing = Math.sign(mid(sw)) === want ? sw : -sw;
  return { dir, piv, P, phiR, swing };
}
// where the ship is against the root at its rest: its distance from the root's own wavy line (null if past its ends)
function gapOf(e, x, y) {
  const c = Math.cos(e.phiR), s = Math.sin(e.phiR), dx = x - e.P[0], dy = y - e.P[1];
  const xl = dx * c + dy * s, yl = -dx * s + dy * c;
  if (xl < -0.5 || xl > LEN + 0.5) return null;
  return Math.abs(yl - waveAt(clamp(xl, 0, LEN)));
}

export default defineObstacle({
  name: 'g2-root-whip',
  hazard: { cls: 'sweep', introduced: [2, 10], warn: (ev) => (ev.lead ?? 0.8) + STROKE + (ev.tel ?? 1.2) },
  sample: { dir: 'h', ny: 0.3, piv: -1 },
  // the 0.3.1 check (no fully blocked moment): where it is solid as it crosses the ship's plane, at rest across the
  // lane, as the distance from a ship centre to the root's surface (its wavy middle line, less its half-thickness;
  // past an end, to that end). The kind's own hit test is this distance under part of SHIP_R.
  solid: (ev, box) => {
    const g = geometryOf(null, ev, box), c = Math.cos(g.phiR), s = Math.sin(g.phiR);
    return [{ dist: (x, y) => {
      const dx = x - g.P[0], dy = y - g.P[1], xl = dx * c + dy * s, yl = -dx * s + dy * c, xc = clamp(xl, 0, LEN);
      return Math.hypot(xl - xc, yl - waveAt(xc)) - HALF;
    } }];
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('g2-root-whip', () => make(api));
    e.x = 0; e.y = 0; e.sx = e.sy = e.sz = 1; e.hit = false; e.lashed = false;
    Object.assign(e, geometryOf(e, ev, api.box));
    e.tel = ev.tel ?? 1.2; e.lead = ev.lead ?? 0.8; e.grow = ev.grow ? 0 : 1;
    e.ph = (e.id % 9) * 0.7;
    const ud = e.obj.userData;
    ud.arm.position.set(e.P[0], e.P[1], 0); ud.arm.rotation.z = e.phiR + e.swing; ud.arm.scale.setScalar(e.grow || 0.02);
    ud.seam.color.copy(BARK_DARK); ud.run.material.opacity = 0;
  },
  update(e, dt, api) {
    const ud = e.obj.userData, arrive = -e.z / Math.max(1, api.v);
    const t1 = e.lead, t0 = t1 + STROKE, tt = t0 + e.tel;
    let phi = e.phiR + e.swing + 0.04 * Math.sin(e.t * 1.3 + e.ph), tell = 0, runK = -1;
    if (arrive > tt) { /* swung out, swaying */ }
    else if (arrive > t0) { tell = 1 - (arrive - t0) / e.tel; runK = tell; }
    else if (arrive > t1) {
      const u = 1 - (arrive - t1) / STROKE;
      phi = e.phiR + e.swing * (1 - u * u); tell = 1;     // a lash: it accelerates into place
      if (!e.lashed) { e.lashed = true; if (e.z > -420) api.game.sfx('g2-root-lash', { vol: 0.8, pan: clamp(e.P[0] / 16, -0.7, 0.7) }); }
    } else {
      // at rest across the lane, quivering from the lash
      const k = Math.max(0, 1 - (t1 - arrive) * 2.5);
      phi = e.phiR + 0.05 * k * Math.sin(e.t * 40); tell = 1;
      if (!e.landed) { e.landed = true; if (e.z > -260) api.game.shake(0.18); }
    }
    ud.arm.rotation.z = phi;
    // the tell: the split bark lights red from its anchor out, then glows hot; the light runs up it as it splits
    tmp.copy(BARK_DARK).lerp(SEAM, Math.min(1, tell * 1.4));
    if (tell >= 1) tmp.lerp(HOT, 0.25 + 0.15 * Math.sin(e.t * 22));
    ud.seam.color.copy(tmp);
    if (runK >= 0) { ud.run.position.set(LEN * runK, waveAt(LEN * runK), 0.6); ud.run.material.opacity = 0.35 + 0.6 * Math.sin(runK * Math.PI); }
    else ud.run.material.opacity = Math.max(0, ud.run.material.opacity - dt * 3);
    // in a boss fight it is born near: it shoots out of its anchor instead of growing in with distance
    // (all three ways at once, from nothing: born in plain view, it is never drawn bigger than a pixel at first)
    if (e.grow < 1) { e.grow = Math.min(1, e.grow + dt / 0.5); ud.arm.scale.setScalar(Math.max(0.005, e.grow * e.grow * (3 - 2 * e.grow))); e.appear = 1; }
    api.pose(e);
    if (e.crossed && !e.hit) {
      const g = gapOf(e, api.ship.x, api.ship.y), m = SHIP_R * 0.6;
      if (g !== null && g < HALF + m) { e.hit = true; crash(api, e, 20); }
      else if (g !== null && g < HALF + m + 0.7) api.game.scrape(e, g - HALF);
    }
    if (e.z > 30) e.alive = false;
  },
  // the test pilots: keep off its rest line
  avoid(e) {
    const out = [], c = Math.cos(e.phiR), s = Math.sin(e.phiR);
    for (let xl = 2; xl <= LEN - 2; xl += 1.6) { const x = e.P[0] + c * xl - s * waveAt(xl), y = e.P[1] + s * xl + c * waveAt(xl); if (Math.abs(x) < 10 && Math.abs(y) < 7) out.push({ x, y, r: HALF + 1.5 }); }
    return out;
  },
});
