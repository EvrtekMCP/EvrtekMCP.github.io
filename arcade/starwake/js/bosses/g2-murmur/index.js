// THE MURMUR (galaxy 2, the boss of level 9 The Murmuration; the plan 3.9; Yori's sheet boss-09-the-murmur). The whole
// Deep's flock, thousands strong, led by a grafted QUEEN: a moth nine across, red core, wings veined in red seams
// (her murmurQueen(flap), mesh.js; the flock is her moths, drawn through the flock's shared swarm).
// WHAT MAKES IT A NEW KIND OF FIGHT: the boss is a crowd. You cannot hurt the flock, only the Queen, and she hides
// inside its shapes; the shapes are the attacks, and she fires from inside them. Her core is lit only when the flock
// opens an EYE round her (rule 25). Deflect-only: every point of damage is her own fire sent home (rules 26-28).
//   1. THE CLOUD: a wall gathers round her with an eye in it; she fires pairs from its rim (roll them home while the eye
//      is open); then the wall marches at you with its hole where she was: fly through the hole.
//   2. THE FUNNEL: the flock spins into a tunnel round the lane with her at its far end, firing down it. A patch of its
//      wall brightens, then dents inward: weave out of the patch, and roll.
//   3. THE STOOP (the shortest): the whole flock dives at you as one wave with her riding its crest, wide open: three
//      volleys and it is over.
// FREED: her graft burns out and she is a white moth again; the flock scatters into a sky of drifting lights (the stars
// of the finale's approach). If she is not freed in about 110 s, the flock disperses with no bonus (rule 26).
// Music: g2/bosses/murmur (145.03 bpm, C minor, the level's key; a stand-in plays until the sound branch's switch).
import { THREE, defineBoss, clamp, rng } from '../../api.js?v=0.4.0';
import { MESH } from './mesh.js?v=0.4.0';
import { morphModel, setMorph, setLook } from '../../enemies/g2-bloomer/morph.js?v=0.4.0';
import { moth, outline, MOTH } from '../../enemies/g2-flock/index.js?v=0.4.0';

const QSCALE = 1.6, WALL_N = 300, HOLE = 3.6, WALL_FLY = 1.5, FUNNEL_R = 7.4, DENT_R = 3.0, DENT_W = 0.75;
const lerpTo = (a, b, k) => a + (b - a) * k;

// a pair of aimed shots from one rim point of the eye (one roll answers both: MULTI-DEFLECT x2)
const pair = (b, api, o) => {
  for (let i = 0; i < 2; i++) b.later(i * 0.18, () => {
    const m = b.muzzle(o.from || 0), tx = clamp(api.ship.x + api.ship.vx * 0.3 + (i ? 0.35 : -0.35), -api.box.x, api.box.x), ty = clamp(api.ship.y + api.ship.vy * 0.3, -api.box.y, api.box.y);
    api.fire(m, tx, ty, { T: o.T || 1.3, owner: b });
  });
};
// n shots fanned across `spread` metres round where you are
const fan = (b, api, o) => {
  const m = b.muzzle(o.from || 0), n = o.n || 5, w = o.spread || 6, tx = clamp(api.ship.x, -api.box.x, api.box.x), ty = clamp(api.ship.y, -api.box.y, api.box.y);
  for (let i = 0; i < n; i++) { const k = n > 1 ? i / (n - 1) - 0.5 : 0; api.fire(m, clamp(tx + k * w, -api.box.x, api.box.x), ty, { T: o.T || 1.4, owner: b }); }
};
// n aimed shots in a row
const aimed = (b, api, o) => { for (let i = 0; i < (o.n || 3); i++) b.later(i * (o.gap ?? 0.22), () => { const m = b.muzzle(o.from || 0); api.fire(m, clamp(api.ship.x + api.ship.vx * 0.3, -api.box.x, api.box.x), clamp(api.ship.y + api.ship.vy * 0.3, -api.box.y, api.box.y), { T: o.T || 1.3, owner: b }); }); };

const tmpV = new THREE.Vector3();
export default defineBoss({
  name: 'g2-murmur', title: 'THE MURMUR',
  hold: 95, enterTime: 4.5, scale: 1, y: 0,
  escapeAfter: 110, escapeCall: 'THE FLOCK SCATTERS',
  bonus: 80000, hitPts: 2500, defeatTime: 3.0,
  build(api, b) {
    const root = new THREE.Group();
    const q = morphModel(MESH.down, MESH.up);
    q.group.rotation.y = Math.PI; q.group.scale.setScalar(QSCALE); root.add(q.group);
    b.queen = q;
    // her core (her graftNode at 0, 0.35, -0.3, turned to face you), and the rim of the eye round her: where her pairs leave
    return { root, weak: [{ at: [0, 0.35 * QSCALE, 0.3 * QSCALE], r: 2.4, hp: 18 }], muzzles: [[-5, 0.5, 1], [5, 0.5, 1], [0, 4.5, 1], [0, -4, 1]] };
  },
  // her core is lit only while the flock holds an eye open round her (rule 25)
  exposed(b) { return (b.eye || 0) > 0.5; },
  enter(b, api) {
    const R = rng(909);
    b.R = R; b.N = api.tierCount(1100); b.t9 = 0; b.walls = []; b.eye = 0; b.dent = null; b.dentN = 0;
    // every moth of the flock: where it is now, and a fixed place of its own in each of the shapes
    b.M = []; for (let i = 0; i < b.N; i++) b.M.push({ x: R.range(-30, 30), y: R.range(-18, 22), z: R.range(-40, 40), u: R(), v: R(), w: R() });
    b.muzzle = (i) => { const m = b.muzzles[i % b.muzzles.length]; tmpV.set(m[0], m[1], m[2]); b.root.localToWorld(tmpV); return { x: tmpV.x, y: tmpV.y, z: tmpV.z }; };
    b.cx = 0; b.cy = 0;
  },
  phases: [
    // (g2-roll, 11-07: a third pair from the eye's top rim, 1.3 s after the second; the eye holds a second longer so that
    // pair can still come home, and the loop is a second longer: three pairs in 6.6 s, never more than three in any 3 s)
    { name: 'THE CLOUD', until: 0.66, loop: 6.6,
      pattern: [{ at: 1.0, attack: pair, from: 0, tel: 0.9 }, { at: 2.3, attack: pair, from: 1, tel: 0.9 }, { at: 3.6, attack: pair, from: 2, tel: 0.9 }],
      update(b, dt, api) {
        // the eye opens round her as the wall gathers, holds while her pairs can come home, and closes as the wall leaves
        const t = b.loopT;
        b.eye = t < 0.5 ? 0 : t < 0.9 ? (t - 0.5) / 0.4 : t < 5.6 ? 1 : 0;
        if (t >= 5.6 && !b.sent) { b.sent = true; sendWall(b, api); }
        if (t < 1) b.sent = false;
      } },
    { name: 'THE FUNNEL', until: 0.28, loop: 4.0,
      pattern: [{ at: 1.7, attack: pair, from: 2, tel: 0.9 }, { at: 3.1, attack: fan, n: 3, spread: 5, from: 2, tel: 0.9 }],
      enter(b) { b.eye = 1; b.dentN = 0; },
      update(b, dt, api) {
        b.eye = 1;
        // a dent each loop: its patch of wall glows for 1.0 s, then dents in for 0.5 s (a different side each time)
        const t = b.loopT, A = [0, Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -3 * Math.PI / 4];
        if (t < 0.05 && (!b.dent || b.dent.done)) b.dent = { a: A[b.dentN++ % A.length], hit: false, done: false };
        if (b.dent) { b.dent.k = t < 1.0 ? 0 : t < 1.15 ? (t - 1.0) / 0.15 : t < 1.5 ? 1 : t < 1.8 ? 1 - (t - 1.5) / 0.3 : 0; b.dent.tell = t < 1.0 ? t : 0; if (t > 1.8) b.dent.done = true;
          const ship = api.ship, d = Math.hypot(ship.x - b.cx, ship.y - b.cy), da = Math.abs(Math.atan2(Math.sin(Math.atan2(ship.y - b.cy, ship.x - b.cx) - b.dent.a), Math.cos(Math.atan2(ship.y - b.cy, ship.x - b.cx) - b.dent.a)));
          const r = FUNNEL_R - (FUNNEL_R - DENT_R) * b.dent.k;
          if (b.dent.k > 0.6 && !b.dent.hit && da < DENT_W && d > r - 0.4) { b.dent.hit = true; api.game.crash({ x: ship.x, y: ship.y, z: 0, type: 'g2-murmur-dent' }, 12, true); } }
      } },
    { name: 'THE STOOP', loop: 3.2,
      pattern: [{ at: 0.9, attack: fan, n: 5, spread: 6, from: 0, tel: 0.9 }, { at: 2.2, attack: aimed, n: 3, from: 1, tel: 0.9 }],
      enter(b) { b.eye = 1; },
      update(b, dt) { b.eye = 1; b.z = lerpTo(b.z, -62, Math.min(1, dt * 0.8)); } },
  ],
  update(b, dt, api) {
    if (!b.M) return;
    b.t9 += dt;
    // she drifts slowly in the box; the flock follows her
    if (b.state === 'fight' || b.state === 'enter') { b.x = Math.sin(b.t9 * 0.37) * api.box.x * 0.32; b.y = Math.sin(b.t9 * 0.29 + 1) * api.box.y * 0.3; }
    setMorph(b.queen, 0.5 + 0.5 * Math.sin(b.t9 * 7));
    if (b.freedT !== undefined) { b.freedT += dt; setLook(b.queen, { opacity: 1, silver: Math.min(1, b.freedT / 0.6), red: Math.max(0, 1 - b.freedT / 0.4) }); }
    drawFlock(b, dt, api);
    marchWalls(b, dt, api);
  },
  // (the engine frees a galaxy 2 boss: pearl motes, g2-boss-freed, FREED!, the tally's THE MURMUR FREED); she goes white
  defeat(b) { b.freedT = 0; b.eye = 0; },
});

// ---------------------------------------------------------------- the flock round her
// Each moth has a fixed place in each shape (from its own u, v, w), and flies toward it: the shapes flow into each other.
function drawFlock(b, dt, api) {
  const N = b.N, a = b.appear ?? 1, ph = b.pi || 0, fight = b.state === 'fight', dying = b.state === 'dying', esc = b.state === 'escape';
  const k = Math.min(1, dt * (fight ? 3.2 : 1.6)), t = b.t9, qx = b.x, qy = b.y, qz = b.z;
  const loopT = b.loopT || 0;
  const wallN = Math.floor(N * 0.45);
  const sz = 1.5 * a * (dying ? clamp(1.2 - (b.t || 0) / 3, 0.2, 1) : 1);
  for (let i = 0; i < N; i++) {
    const m = b.M[i]; let tx, ty, tz, col = MOTH.PEARL;
    if (dying || esc) { // scattering: everything drifts out into a sky of lights
      const an = m.u * Math.PI * 2, r = 25 + m.v * 60; tx = qx + Math.cos(an) * r; ty = qy + Math.sin(an) * r * 0.6 + 10; tz = qz + (m.w - 0.5) * 80;
    } else if (!fight || ph === 0) {
      if (fight && i < wallN && loopT > 0.2 && loopT < 5.6) { // the gathering wall, its eye round her (5.6: the Cloud's eye)
        let x = (m.u - 0.5) * api.box.x * 3.2, y = (m.v - 0.5) * api.box.y * 3.2; const d = Math.hypot(x, y) || 1;
        if (d < HOLE + 0.8) { x *= (HOLE + 0.8 + m.w * 1.5) / d; y *= (HOLE + 0.8 + m.w * 1.5) / d; }
        tx = qx + x; ty = qy + y; tz = qz + 4 + (m.w - 0.5) * 1.6; col = loopT > 5.0 ? MOTH.BRIGHT : MOTH.PEARL;
      } else { // the cloud: a loose body round her, breathing
        const an = m.u * Math.PI * 2 + t * 0.2, el = (m.v - 0.5) * 2.4, r = 14 + m.w * 16 + Math.sin(t * 0.7 + i) * 2;
        tx = qx + Math.cos(an) * r * Math.cos(el); ty = qy + Math.sin(el) * r * 0.6; tz = qz - 6 + Math.sin(an) * r * 0.5;
      }
    } else if (ph === 1) { // THE FUNNEL: a spinning tunnel from just behind you to her; the dent's patch moves in
      const zz = m.w, an = m.u * Math.PI * 2 + t * 0.8 * (zz < 0.5 ? 1 : -1);
      let r = FUNNEL_R + (m.v - 0.5) * 1.2;
      const D = b.dent; let lit = false;
      if (D && !D.done) { const da = Math.abs(Math.atan2(Math.sin(an - D.a), Math.cos(an - D.a))); if (da < DENT_W) { r = FUNNEL_R - (FUNNEL_R - DENT_R) * D.k + (m.v - 0.5); lit = D.tell > 0 || D.k > 0; } }
      // (from just in front of you to her: none of it so near the lens that a moth fills the screen, rule 16)
      tx = b.cx + Math.cos(an) * r; ty = b.cy + Math.sin(an) * r; tz = -3 + zz * (qz + 3); col = lit ? MOTH.BRIGHT : MOTH.PEARL;
    } else { // THE STOOP: one great wave behind her, diving at you with her on its crest
      const x = (m.u - 0.5) * 60, crest = Math.sin(x * 0.12 + t * 1.5) * 6;
      tx = qx + x; ty = qy + 2 + crest - m.v * 14; tz = qz + 6 + m.w * 30 - Math.max(0, Math.sin(t * 1.9)) * 20;
    }
    m.x += (tx - m.x) * k; m.y += (ty - m.y) * k; m.z += (tz - m.z) * k;
    // the swarm grows in with her as she flies in out of the haze
    const gx = qx + (m.x - qx) * a, gy = qy + (m.y - qy) * a, gz = qz + (m.z - qz) * a;
    moth(i, gx, gy, gz, sz * (0.8 + (i % 5) * 0.1), t, col);
  }
  // the funnel's dent glows where it will come in (the tell)
  if (b.dent && !b.dent.done && b.dent.tell > 0 && ph === 1) for (let j = 0; j < 30; j++) { const an = b.dent.a + (j / 29 - 0.5) * DENT_W * 2; outline(b.cx + Math.cos(an) * DENT_R, b.cy + Math.sin(an) * DENT_R, -5, 0.6 * Math.min(1, b.dent.tell * 2), 1.3); }
}

// ---------------------------------------------------------------- THE CLOUD's marching walls
function sendWall(b, api) {
  const R = b.R, pts = [], bx = api.box;
  for (let i = 0; pts.length < WALL_N && i < WALL_N * 8; i++) { const x = R.range(-bx.x * 1.5, bx.x * 1.5), y = R.range(-bx.y * 1.5, bx.y * 1.5), d = Math.hypot(x - b.x, y - b.y); if (d < HOLE) continue; if (d < HOLE + 1.2 && R() < 0.6) continue; pts.push([x, y, R.range(-0.6, 0.6), R()]); }
  b.walls.push({ z: b.z + 4, z0: b.z + 4, t: 0, hx: b.x, hy: b.y, pts, hit: false, gone: 0 });
}
function marchWalls(b, dt, api) {
  const ship = api.ship;
  for (let i = b.walls.length - 1; i >= 0; i--) {
    const w = b.walls[i]; w.t += dt;
    const pz = w.z; w.z = w.z0 * (1 - Math.min(1, w.t / WALL_FLY)) + (w.t > WALL_FLY ? (w.t - WALL_FLY) * 60 : 0);
    // it crosses your plane: outside its hole, the dense flock is a small hit (Phase passes through)
    if (pz < 0 && w.z >= 0 && !w.hit && b.state === 'fight' && Math.hypot(ship.x - w.hx, ship.y - w.hy) > HOLE + 0.45) { w.hit = true; api.game.crash({ x: ship.x, y: ship.y, z: 0, id: 'mw' + i + ':' + w.z0, type: 'g2-murmur-wall' }, 12, true); }
    if (b.state !== 'fight') w.gone += dt;
    const fade = clamp(1 - w.gone / 0.8, 0, 1), s = 1.45 * fade;
    if (s > 0.01) for (let j = 0; j < w.pts.length; j++) { const p = w.pts[j]; moth(j + 7, p[0] + Math.sin(w.t * 2 + j) * 0.12, p[1], w.z + p[2], s * (0.8 + (j % 5) * 0.1), b.t9 + p[3], MOTH.PEARL); }
    if (w.z > 14 || fade <= 0) b.walls.splice(i, 1);
  }
}
