// THE BLUEPRINT WALL (galaxy 3, level 1, THE SCAFFOLD; the plan's 4.1). Yori's wall (art-incoming/yori/g3/g3-enemies.js
// blueprintWall, assemblerArm; g3-lib.js panel, wireRect, bar): a wall across the whole lane with one gap in it.
//  - THE PLAN: it condenses out of the haze as a white wireframe of exactly the wall that is coming, gap included,
//    with the gap outlined in white. Galaxy 3's promise: the plan never lies.
//  - THE BUILD: from `lead` seconds out (2.0 the first time, 1.4 once known) her assembler arms at the lane's edges
//    swing graphite plates into the plan, cell by cell, bottom row up, from the edges in. It is solid, graphite with
//    red edges, well before you reach it (0.45 s out).
//  - REVISIONS (the level's twist): `revise` gives a second gap. 1.2 s before the build starts the old plan
//    flickers out and the new one draws in, and the wall is built to the new plan.
//  - A cracked panel (`crack`): Yori's Phase crack (art-incoming/yori/g2/powerups.js phaseCrack, the same in every
//    galaxy) on one built cell. Phase gets you through; the level lays a ring trail into it and a cache behind it.
// Hitting the wall anywhere but the gap is a crash (Phase passes through it, as through anything solid). Flying the
// gap close to its edge is a CLOSE call.
//   add(d, 'g3-blueprint-wall', { gap: [nx, ny, halfW, halfH], lead: 2.0, revise: [nx, ny, halfW, halfH], crack: [nx, ny] })
//   (grow: true for one spawned in view, as the Foreman's rush job does: it draws in over half a second)
import { THREE, defineObstacle, Instanced, material, clamp, smoothstep, READ_D } from '../../api.js?v=0.6.0';
import { beatClock } from '../../levels/level3/beat.js?v=0.6.0';
import { MESH } from './mesh.js?v=0.6.0';
import { MESH as ARM } from './arm.js?v=0.6.0';
import { MESH as CRACK } from './crack.js?v=0.6.0';

export const SPAN = [1.32, 1.36];        // the wall's half-size in the normalised box: past the box on every side
export const LEAD = 1.4, LEAD_NEW = 2.0;  // seconds out the build starts (the plan's 4.1)
export const REVISE = 1.2;                // seconds before the build a revision draws its new plan
const DONE = 0.45;                        // seconds out the last plate is home
const SHIP_IN = 0.5;                      // the ship's radius for the gap (SHIP_R is 0.72: the gap favours you, rule 14)
const CLOSE = 0.6;                        // within this of a gap edge (inside it) is a CLOSE call
const MIN_W = 2.9, MIN_H = 2.6;           // no gap is ever smaller than this, in metres, on any screen
const CW = 4, CH = 3.5;                   // her cell (blueprintWall's 24 x 14 in 6 x 4)
const tmpQ = new THREE.Quaternion(), qV = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
const qArmL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
const qArmR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
const IDQ = new THREE.Quaternion();
// Yori's pieces face -Z; the ship meets a thing's +z side, so her cells and her crack are turned half round to face you
const FACE = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

let L = null; // the instanced layers
function layersOf(api, groups, cap, opts = {}) {
  return groups.map((g) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.computeVertexNormals(); geo.computeBoundingSphere();
    let mat = material(g.color, g.glow);
    if (opts.alpha && g.glow) mat = new THREE.MeshBasicMaterial({ color: g.color, transparent: true, opacity: opts.alpha, depthWrite: false, side: THREE.DoubleSide });
    return new Instanced(api.scene, geo, mat, cap);
  });
}
const putAll = (layers, x, y, z, q, sx, sy, sz) => { for (const l of layers) l.put(x, y, z, q, sx, sy, sz); };

// the wall's cell grid and its gap, in metres, for the box it is born in
function plan(e, gap, box) {
  const W = SPAN[0] * box.x, H = SPAN[1] * box.y;
  const cols = Math.max(4, Math.round(2 * W / 2.4)), rows = Math.max(4, Math.round(2 * H / 2.0));
  const cw = 2 * W / cols, ch = 2 * H / rows;
  const [gx, gy, gw, gh] = gap;
  const a = (gx - gw) * box.x, b = (gx + gw) * box.x, c = (gy - gh) * box.y, d = (gy + gh) * box.y, eps = 1e-6;
  let c0 = Math.floor((a + W) / cw + eps), c1 = Math.ceil((b + W) / cw - eps) - 1;
  let r0 = Math.floor((c + H) / ch + eps), r1 = Math.ceil((d + H) / ch - eps) - 1;
  c0 = clamp(c0, 0, cols - 1); c1 = clamp(c1, c0, cols - 1); r0 = clamp(r0, 0, rows - 1); r1 = clamp(r1, r0, rows - 1);
  // never too small to fly, on any screen: grow toward the side with more room
  while ((c1 - c0 + 1) * cw < MIN_W && (c0 > 0 || c1 < cols - 1)) { if (c1 < cols - 1 && (c0 === 0 || (cols - 1 - c1) >= c0)) c1++; else c0--; }
  while ((r1 - r0 + 1) * ch < MIN_H && (r0 > 0 || r1 < rows - 1)) { if (r1 < rows - 1 && (r0 === 0 || (rows - 1 - r1) >= r0)) r1++; else r0--; }
  const cells = [];
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    if (q >= c0 && q <= c1 && r >= r0 && r <= r1) continue;
    const x = -W + cw * (q + 0.5), y = -H + ch * (r + 0.5);
    // build order: bottom row up, from both edges in toward the gap (her arms stand at the edges)
    const fromEdge = Math.min(q, cols - 1 - q);
    cells.push({ q, r, x, y, side: x < 0 ? -1 : 1, order: r * cols + fromEdge * 2 + (x < 0 ? 0 : 1) });
  }
  cells.sort((m, n) => m.order - n.order);
  cells.forEach((k, i) => { k.i = i; });
  return { W, H, cols, rows, cw, ch, cells, gx0: -W + c0 * cw, gx1: -W + (c1 + 1) * cw, gy0: -H + r0 * ch, gy1: -H + (r1 + 1) * ch };
}

export default defineObstacle({
  name: 'g3-blueprint-wall',
  // the plan is readable from the haze (READ_D); a revised one only from its revision, `lead` + 1.2 s out
  hazard: { cls: 'mover', introduced: [3, 1], warn: (ev, v) => (ev.revise ? Math.min(READ_D / v, (ev.lead ?? LEAD) + REVISE) : READ_D / v) },
  sample: { gap: [0, 0, 0.3, 0.3], crack: [-0.8, -0.6] },
  init(api) {
    L = {
      cell: layersOf(api, MESH.cell, 900), plan: layersOf(api, MESH.plan, 900), line: layersOf(api, MESH.line, 320),
      arm: layersOf(api, ARM.arm, 60), crack: layersOf(api, CRACK.crack, 12, { alpha: 0.55 }),
    };
  },
  begin(api) { beatClock(api); for (const k in L) for (const l of L[k]) l.begin(); },
  end() { for (const k in L) for (const l of L[k]) l.end(); },
  spawn(e, ev, api) {
    const box = api.box;
    e.x = 0; e.y = 0;
    e.lead = ev.lead ?? LEAD;
    e.P = plan(e, ev.gap || [0, 0, 0.3, 0.3], box);
    e.P2 = ev.revise ? plan(e, ev.revise, box) : null;
    e.revised = false; e.flick = 0;
    e.hit = false; e.close = false;
    e.crack = null;
    if (ev.crack) { // the cracked panel: the built cell nearest the asked-for point
      const cx = ev.crack[0] * box.x, cy = ev.crack[1] * box.y, P = e.P2 || e.P;
      let best = null, bd = 1e9; for (const k of P.cells) { const d = Math.hypot(k.x - cx, k.y - cy); if (d < bd) { bd = d; best = k; } }
      e.crack = best;
    }
  },
  update(e, dt, api) {
    // a wall the Foreman builds in front of you (grow) draws in over 0.8 s instead of out of the haze, from nothing and
    // slowly at first (a smootherstep), so even a long frame never jumps it into view
    const gk = e.ev.grow ? clamp(e.t / 0.8, 0, 1) : 1, a = e.appear * gk * gk * gk * (gk * (gk * 6 - 15) + 10), v = Math.max(1, api.v), tArr = -e.z / v;
    // REVISIONS: the plan changes once, 1.2 s before the build
    if (e.P2 && !e.revised && tArr <= e.lead + REVISE) { e.revised = true; e.flick = 0.0001; api.game.sfx('g3-blueprint', { vol: 0.8 }); api.game.call('REVISION!', 'c-red'); }
    if (e.flick > 0) e.flick += dt;
    const P = e.revised ? e.P2 : e.P;
    const b = clamp((e.lead - tArr) / (e.lead - DONE), 0, 1); // the build, 0 (the plan) to 1 (solid)
    if (b > 0 && !e.building) { e.building = true; api.game.sfx('g3-build', { vol: 0.7 }); }
    const n = P.cells.length, z = e.z;
    // the old plan flickers out over 0.3 s, the new one draws in over the next 0.3 s, sweeping in build order
    const oldOn = e.flick > 0 && e.flick < 0.3 && Math.floor(e.flick * 30) % 2 === 0;
    const drawK = e.flick > 0 ? clamp((e.flick - 0.3) / 0.3, 0, 1) : 1;
    if (oldOn) for (const k of e.P.cells) putAll(L.plan, k.x * a, k.y * a, z, FACE, P.cw / CW * a, P.ch / CH * a, a);
    for (const k of P.cells) {
      if (k.i / n > drawK) continue;
      // each plate flies in from its arm over a quarter of the build, in order
      const p = smoothstep(0, 1, clamp((b - k.i / n * 0.72) / 0.28, 0, 1));
      const sx = P.cw / CW * a, sy = P.ch / CH * a;
      if (p < 1) putAll(L.plan, k.x * a, k.y * a, z, FACE, sx, sy, a);
      if (p > 0) {
        const fx = k.side * (P.W + 2.5), x = fx + (k.x - fx) * p, zz = z - 4 * (1 - p) * Math.sin(p * Math.PI);
        putAll(L.cell, x * a, k.y * a, zz, FACE, sx, sy, sx);
      }
    }
    // the white outer frame and the gap's outline: the promise, always drawn
    const line = (x0, y0, x1, y1) => { const len = Math.hypot(x1 - x0, y1 - y0), q = Math.abs(x1 - x0) < 1e-3 ? qV : IDQ; putAll(L.line, (x0 + x1) / 2 * a, (y0 + y1) / 2 * a, z + 0.45, q, len * a, a, a); };
    const rect = (x0, y0, x1, y1) => { line(x0, y0, x1, y0); line(x1, y0, x1, y1); line(x1, y1, x0, y1); line(x0, y1, x0, y0); };
    rect(-P.W, -P.H, P.W, P.H);
    if (drawK >= 1 || !e.P2) rect(P.gx0, P.gy0, P.gx1, P.gy1);
    // her assembler arms at the edges, two a side, nodding as they work
    const work = b > 0 && b < 1 ? Math.sin(api.time * 9) * 0.6 : 0;
    for (const s of [-1, 1]) for (const yy of [-0.45, 0.45]) {
      const x = s * (P.W + 1.6), y = yy * P.H * 2 * 0.62 + work * s;
      putAll(L.arm, x * a, y * a, z - 1.5, s < 0 ? qArmL : qArmR, a, a, a);
    }
    // the cracked panel: Yori's Phase crack on it once that plate is home
    if (e.crack && P.cells.includes(e.crack)) {
      const k = e.crack, p = clamp((b - k.i / n * 0.72) / 0.28, 0, 1);
      const s = Math.min(P.cw / 3.6, P.ch / 3.1) * a * (p >= 1 ? 1 : 0.85);
      putAll(L.crack, k.x * a, k.y * a, z + 0.4, FACE, s, s, a);
      if (api.tier > 0 && Math.random() < dt * 6 && e.z < -10 && e.z > -260) api.game.emit(k.x, k.y, z + 0.6, { life: 0.9, s0: 0.5, s1: 0.1, r: 0.6, g: 0.42, b: 1, a: 0.8, vx: (Math.random() - 0.5) * 2, vy: 1.2, carry: 1 });
    }
    // the moment it reaches you: the gap, or a crash
    if (e.crossed && !e.hit) {
      const sx = api.ship.x, sy = api.ship.y;
      const inX = sx > P.gx0 + SHIP_IN && sx < P.gx1 - SHIP_IN, inY = sy > P.gy0 + SHIP_IN && sy < P.gy1 - SHIP_IN;
      if (!(inX && inY)) { e.hit = true; api.game.crash({ x: sx, y: sy, z: 0, type: 'g3-blueprint-wall', id: e.id }, 18, false); }
      else {
        // a close call: an edge of the gap that lies inside the box, passed within CLOSE of the ship
        const B = api.box, edges = [];
        if (Math.abs(P.gx0) < B.x) edges.push(sx - P.gx0); if (Math.abs(P.gx1) < B.x) edges.push(P.gx1 - sx);
        if (Math.abs(P.gy0) < B.y) edges.push(sy - P.gy0); if (Math.abs(P.gy1) < B.y) edges.push(P.gy1 - sy);
        const near = Math.min(...edges.concat([99]));
        if (near < SHIP_IN + CLOSE) api.game.scrape(e, near - SHIP_IN);
      }
    }
    if (e.z > 12) e.alive = false;
  },
  // the blocked-moment check (0.3.1's): as it crosses it is solid everywhere but its gap (the revised gap, if it has a
  // revision: that is the one built). A side of the gap that runs out to the wall's own edge, past the box, has no wall.
  solid(ev, B) {
    const P = plan(null, ev.revise || ev.gap || [0, 0, 0.3, 0.3], B), eps = 1e-3;
    const edge = { l: P.gx0 > -P.W + eps, r: P.gx1 < P.W - eps, b: P.gy0 > -P.H + eps, t: P.gy1 < P.H - eps };
    return [{ at: 0, dist: (x, y) => {
      if (x > P.gx0 && x < P.gx1 && y > P.gy0 && y < P.gy1) {
        let m = 1e9; if (edge.l) m = Math.min(m, x - P.gx0); if (edge.r) m = Math.min(m, P.gx1 - x); if (edge.b) m = Math.min(m, y - P.gy0); if (edge.t) m = Math.min(m, P.gy1 - y);
        return m;
      }
      return -Math.hypot(Math.max(P.gx0 - x, 0, x - P.gx1), Math.max(P.gy0 - y, 0, y - P.gy1));
    } }];
  },
  // the bots: anywhere but the gap is a wall (four half-planes that hold the pilot inside it)
  avoid(e) {
    const P = e.revised || (e.P2 && e.z > -1e9 && -e.z / 120 < e.lead + REVISE) ? e.P2 || e.P : e.P, m = SHIP_IN + 0.45, R = 1000;
    const cx = (P.gx0 + P.gx1) / 2, cy = (P.gy0 + P.gy1) / 2;
    const x0 = Math.min(cx, P.gx0 + m), x1 = Math.max(cx, P.gx1 - m), y0 = Math.min(cy, P.gy0 + m), y1 = Math.max(cy, P.gy1 - m);
    return [{ x: x0 - R, y: cy, r: R }, { x: x1 + R, y: cy, r: R }, { x: cx, y: y0 - R, r: R }, { x: cx, y: y1 + R, r: R }];
  },
});
