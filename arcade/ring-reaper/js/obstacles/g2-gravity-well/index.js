// THE GRAVITY WELL (galaxy 2, GRAVITY GARDEN's obstacle): a dark pearl with no glow at its core, a pale lensing ring
// that warps the stars behind it, and a slow swirl of motes (Yori's gravityWell). Space itself is curved here:
//  - it PULLS the ship toward its core: gently far off, sharply close in, and only while it is near your plane;
//  - it BENDS every shot that passes it, yours sent home too (each bent shot shows its dotted path ahead of it, so a
//    curve is always readable): one that looks wide can swing into you, one aimed at you can swing away;
//  - its CORE costs a hit (solid: PHASE takes you through it);
//  - skim its RIM (the band from the core's edge out to its lensing ring) for SLINGSHOT!: a speed burst and GREED,
//    and it counts as a close call;
//  - a GREEN well (green glow bleeding round its core: the clue) can be dived with PHASE for DEEP SLINGSHOT!, the
//    biggest boost in the level.
//   add(d, 'g2-gravity-well', { nx, ny, rn: 0.45, green: false, orbit: { cx, cy, rx, ry, w, ph }, k: 1 })
//     rn     its core's radius as a share of the box's half-width (0.45 is 3.4 m on a wide screen), so its rim lands
//            on the same normalised x on every screen and a ring line at nx +- 1.3 rn from it skims the rim; or r in metres
//     orbit  it circles (cx, cy) in the normalised box, radii rx, ry, at w rad/s from phase ph (THE BINARY: two wells,
//            phases half a turn apart). Without it the well sits at (nx, ny).
//     k      strength of its pull and its bend (1)
import { THREE, defineObstacle, buildModel, clamp, smoothstep } from '../../api.js?v=0.5.0';
import { MESH } from './mesh.js?v=0.5.0';

export const WELL = { r: 3.5, rim: 1.9, pullZ: 45, bendZ: 28, bend: 1300, pull: 2.4, pullCore: 9 };
const MOTE = '#9affc0*';

function make(green) {
  const m = buildModel(green ? MESH.green : MESH.well);
  let motes = null;
  m.group.traverse((o) => { if (o.isMesh && o.material && o.material.color && '#' + o.material.color.getHexString() === MOTE.slice(0, 7)) motes = o; });
  const g = new THREE.Group(); g.add(m.group);
  g.userData = { motes };
  return g;
}

export default defineObstacle({
  name: 'g2-gravity-well',
  hazard: { cls: 'static', introduced: [2, 5] },
  sample: { nx: 1.5, ny: 0, r: 3.5 },
  spawn(e, ev, api) {
    const B = api.box;
    e.green = !!ev.green;
    e.obj = api.course.get(e.green ? 'g2-gravity-well-green' : 'g2-gravity-well', () => make(e.green));
    e.r = ev.r || (ev.rn ? ev.rn * B.x : WELL.r); e.k = ev.k ?? 1;
    e.sx = e.sy = e.sz = e.r / 4;                  // her mesh is drawn at a core radius of 4
    e.orbit = ev.orbit || null;
    e.bx = (ev.nx || 0) * B.x; e.by = (ev.ny || 0) * B.y;
    e.skimmed = false; e.spin = (e.id % 5) * 1.3;
    e.hitR = e.r;
  },
  update(e, dt, api) {
    const B = api.box, ship = api.ship, G = api.game;
    if (e.orbit) {
      const o = e.orbit, a = (o.ph || 0) + (o.w || 0.8) * e.t;
      e.x = ((o.cx || 0) + Math.cos(a) * (o.rx ?? 0.6)) * B.x; e.y = ((o.cy || 0) + Math.sin(a) * (o.ry ?? 0.3)) * B.y;
    } else { e.x = e.bx; e.y = e.by; }
    api.pose(e);
    e.spin += dt * 0.6;
    if (e.obj.userData.motes) e.obj.userData.motes.rotation.z = e.spin;
    if (e.z > -480 && e.z < 25) {
      const W = e, K = WELL.bend * e.k * (e.r / WELL.r), R2 = e.r * e.r;
      // bend every shot passing it (in the plane across the lane; strongest level with it). The slingers' bolts already
      // fly their curve round it, so it leaves them alone until they are sent home.
      api.field((s, h) => {
        if (s.tag === 'sling' && !s.reflected) return false;
        const dz = s.z - W.z; if (Math.abs(dz) > WELL.bendZ * 2) return false;
        const dx = W.x - s.x, dy = W.y - s.y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2) || 1;
        if (d > e.r * 7) return false;
        const a = K / (d2 + R2) * Math.exp(-(dz * dz) / (WELL.bendZ * WELL.bendZ));
        s.vx += dx / d * a * h; s.vy += dy / d * a * h;
        return a > 2;
      });
      if (e.z < -8) api.lens(e.x, e.y, e.z, e.r * 2.6, 0.32);
      // pull the ship toward the core while the well is near your plane: gently far off, sharply close in
      const dx = e.x - ship.x, dy = e.y - ship.y, d = Math.hypot(dx, dy) || 1;
      const near = Math.exp(-(e.z * e.z) / (WELL.pullZ * WELL.pullZ));
      if (near > 0.02) {
        const close = clamp(1 - (d - e.r) / (e.r * 2.5), 0, 1);
        const sp = (WELL.pull + WELL.pullCore * close * close) * e.k * near * clamp(e.r / WELL.r, 0.6, 1.8);
        api.push(dx / d * sp, dy / d * sp);
        if (!e.pulled && close > 0.15 && e.z > -20) { e.pulled = true; G.sfx('g2-well-pull', { vol: 0.6, pan: clamp(e.x / B.x * 0.6, -0.6, 0.6) }); }
      }
    }
    // it reaches your plane: the core (a hit, or PHASED; a green one dived pays DEEP SLINGSHOT), or the rim (SLINGSHOT!)
    if (e.crossed) {
      const d = Math.hypot(ship.x - e.x, ship.y - e.y);
      if (d < e.r * 0.9) {
        if (api.phasing) {
          if (e.green) { G.boost(3.2, 1.55); G.greed(35); G.score(2500 * G.mult, ship.x, ship.y + 1.6, 0, 'mag big', 'DEEP SLINGSHOT'); G.call('DEEP SLINGSHOT!', 'c-cyan'); G.sfx('g2-slingshot', { rate: 0.8 }); G.shake(0.6); }
          G.phased(e);
        } else G.crash(e, 18, false);
      } else if (d < e.r * WELL.rim && !e.skimmed) {
        e.skimmed = true;
        G.scrape(e, d);
        G.boost(1.6, 1.22); G.greed(18);
        G.score(600 * G.mult, ship.x, ship.y + 1.4, 0, 'mag', 'SLINGSHOT');
        G.call('SLINGSHOT!', 'c-cyan'); G.sfx('g2-slingshot', { pan: clamp(e.x / B.x * 0.6, -0.6, 0.6) });
      }
    }
    if (e.z > 30) e.alive = false;
  },
  // the 0.3.1 check (no fully blocked moment): only its CORE is solid (it costs a hit inside 0.9 of its radius); the
  // pull is not. An orbiting well (THE BINARY) is where its orbit has taken it when it reaches you, and that depends on
  // how fast you fly (its clock starts at the spawn line): between the level's own speed and GREED with a boost its angle
  // differs by most of a turn, so the whole orbit is taken as solid (the worst case; the middle of the pair stays clear).
  solid(ev, box) {
    const r = (ev.r || (ev.rn ? ev.rn * box.x : WELL.r)) * 0.9;
    if (!ev.orbit) { const cx = (ev.nx || 0) * box.x, cy = (ev.ny || 0) * box.y; return [{ dist: (x, y) => Math.hypot(x - cx, y - cy) - r }]; }
    const o = ev.orbit, P = [];
    for (let i = 0; i < 24; i++) { const t = i / 24 * Math.PI * 2; P.push([((o.cx || 0) + Math.cos(t) * (o.rx ?? 0.6)) * box.x, ((o.cy || 0) + Math.sin(t) * (o.ry ?? 0.3)) * box.y]); }
    return [{ dist: (x, y) => { let m = 1e9; for (const [px, py] of P) m = Math.min(m, Math.hypot(x - px, y - py)); return m - r; } }];
  },
  // the bots: keep clear of the core (they never chase a slingshot or a Phase dive)
  avoid(e) { return [{ x: e.x, y: e.y, r: e.r * 1.05 + 1.0 }]; },
});
