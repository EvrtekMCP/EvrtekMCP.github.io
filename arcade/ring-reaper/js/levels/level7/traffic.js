// LEVEL 7 traffic: Yori's freighter (26 long, six containers, pink port and teal starboard running lights) as the
// level's one new obstacle. Freighters move. Two ways, one rule each:
//  - FLOW: in your direction, slower than you, so you overtake them. A flow freighter fills one cell of the lane
//    (three columns, two decks) and you pick the open one. Some change lanes: the side they will move to strobes
//    red for a full second first, then they slide across. The world speed is a fraction r of yours, so it closes on
//    you at (1 - r) of your speed: an event's place on the course is where its tail meets you.
//  - CROSS: across your route, a crossing street. A crossing freighter is a long bar at one height sliding sideways;
//    its running lights say which way: pink, it is going LEFT; teal, RIGHT (Yori's port and starboard). Its sideways
//    position is a straight line in depth, so where it is when you reach it is fixed by the course, not by luck.
// Positions are in the normalised flight box, so the cells and gaps are the same on a wide screen and a tall one.
import { THREE, defineObstacle, Instanced, GlowPoints, modelGroups, clamp, smoothstep, SHIP_R, READ_D } from '../../api.js?v=0.6.2';
import { MESH } from './mesh.js?v=0.6.2';
import { zones, courseAt } from './scenery.js?v=0.6.2';

// the lane grid (normalised): three columns, two decks
export const COL_X = [-0.67, 0, 0.67], DECK_Y = [-0.5, 0.5];
export const HX = 0.28, HY = 0.42;   // a freighter's half size in the box (one cell; neighbours nearly touch, so a cell is open or shut)
export const CROSS_HX = 1.3;          // a crossing freighter's half length, in box widths (it spans more than the box)
// Yori's model: x -3.3..3.3, y -1.8..2.5, z -13..13.75 (nose at -Z, engines at +Z)
const MX = 3.3, MY = 2.15, MYC = 0.35, MZ = 13.4, MZC = 0.38;
const TINTS = ['#3a3250', '#3a3f48', '#4a3a5e', '#2e4a52', '#5e3a4e', '#4a4a5a', '#3a2e48'].map((h) => new THREE.Color(h).getHex());
// Yori's engines are ember orange (#ff9a1a); under bloom that reads as amber, the collect colour (rule 9), on the one
// thing in the level that must never look collectable. So her engine faces are drawn a hot violet-white here.
const ENGINE = 0xd8a0ff;
const PINK = [1, 0.18, 0.63], TEAL = [0.12, 0.88, 0.82], EMBER = [0.72, 0.45, 1], REDL = [1, 0.2, 0.33];

const tmpQ = new THREE.Quaternion(), eul = new THREE.Euler(), tmpC = new THREE.Color();
// lights fade as they come up beside you, so nothing passing the chase camera blooms into a disc across the screen
const nf = (z, far = 16) => clamp((-z - 2) / (far - 2), 0, 1);
let layers, lights;

// the box a freighter fills, in metres: centre x, y, half sizes, and its near and far depth
function shape(e, api) {
  const B = api.box;
  if (e.mode === 'cross') {
    const hx = CROSS_HX * B.x * e.len, hy = HY * B.y, dz = MX * 2 * e.sx * 0.5;
    return { x: e.x, y: e.y, hx, hy, z0: e.z, z1: e.z - dz * 2, len: dz * 2 };
  }
  const hx = HX * B.x, hy = HY * B.y, L = MZ * 2 * e.sz;
  return { x: e.x, y: e.y, hx, hy, z0: e.z, z1: e.z - L, len: L };
}

export const freighter = defineObstacle({
  name: 'l7-freighter',
  motion: 'own',
  // rule 12: a flow freighter closes at (1 - r) of your speed from where it reads (580 m); a lane change strobes
  // for 1.0 s before its slide starts; a crossing one is in the track, its sideways line readable from 580 m
  hazard: { cls: 'mover', introduced: 5,
    warn(ev, v) {
      if (ev.decor) return 99;
      if (ev.mode === 'cross') return READ_D / v;
      const t = READ_D / ((1 - (ev.r ?? 0.4)) * v);
      return ev.lc === undefined ? t : Math.min(t, (ev.lcAt ?? 2.2) + 1.0);
    } },
  sample: { mode: 'flow', nx: 0, ny: 0 },
  // the test autopilot steers round these (circles along the box it fills, while it is close ahead)
  avoid(e) {
    if (e.decor || !e.shape) return null;
    const s = e.shape, out = [], r = Math.min(s.hx, s.hy) + 1.4;
    const nx = Math.max(1, Math.round(s.hx / Math.min(s.hx, s.hy))), ny = Math.max(1, Math.round(s.hy / Math.min(s.hx, s.hy)));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) out.push({ x: s.x - s.hx + s.hx * 2 * (i + 0.5) / nx, y: s.y - s.hy + s.hy * 2 * (j + 0.5) / ny, r });
    return out;
  },
  init(api) {
    layers = modelGroups(MESH.freighter).map((g) => {
      const geo = g.geo;
      const tint = g.color === '#3a3250' || g.color === '#3a3f48';
      const mat = g.glow ? new THREE.MeshBasicMaterial({ color: g.color === '#ff9a1a' ? ENGINE : g.color })
        // mid-tone, not black: the city's towers are near-black with bright windows, so a hull that lifts out of the dark
        // by its own value (and its red markers) reads as the thing to avoid (rules 8, 10)
        : new THREE.MeshStandardMaterial({ color: tint ? 0xffffff : g.color, metalness: 0.15, roughness: 0.6, flatShading: true, emissive: g.color, emissiveIntensity: 0.35 });
      const L = new Instanced(api.scene, geo, mat, 48); L.tint = tint;
      if (tint) L.mesh.setColorAt(0, tmpC.set(g.color));
      return L;
    });
    lights = new GlowPoints(api.scene, 900, api.glowTex);
  },
  begin(api) { for (const L of layers) L.begin(); lights.begin(); lights.setScale(api.focalPx); },
  end() { for (const L of layers) L.end(); lights.end(); },
  blocks(e, api) { return e.decor || e.gone ? null : shape(e, api); },
  spawn(e, ev, api) {
    const B = api.box;
    e.mode = ev.mode || 'flow'; e.decor = !!ev.decor; e.hit = false; e.scraped = false; e.near = 1e9; e.gone = false;
    e.r = ev.r ?? 0.4;                 // flow: its speed as a fraction of yours
    e.len = ev.len || 1;               // flow: length factor; cross: span factor
    e.tint = TINTS[(ev.tint ?? Math.floor(Math.random() * 7)) % TINTS.length];
    e.tint2 = TINTS[((ev.tint ?? 3) + 3) % TINTS.length];
    e.ph = Math.random() * 6;
    if (e.mode === 'cross') {
      e.dir = ev.dir || 1; e.k = ev.k ?? 0.8;   // normalised box widths it slides per 100 m you fly
      e.nx0 = ev.nx || 0;                         // where its middle is when you reach it
      e.sx = (ev.depth || 0.66) * (B.x / 7.5); e.sy = HY * B.y / MY; e.sz = CROSS_HX * B.x * e.len / MZ;
      e.x = (e.nx0 - e.dir * e.k * (-e.z) / 100) * B.x;
    } else {
      e.sx = HX * B.x / MX; e.sy = HY * B.y / MY; e.sz = 0.8 * e.len;
      e.lc = ev.lc;                               // a lane change: the column it moves to (normalised x)
      e.lcAt = ev.lcAt ?? 2.2;                    // seconds before it reaches you that the slide starts
      e.nx = ev.nx || 0; e.x = e.nx * B.x;
      // where it is now, from where it meets you (exact even when a run starts part-way into the level)
      if (ev.pass !== undefined && api.G && api.G.state === 'play') e.z = -(ev.pass - (api.G.courseD || 0)) * (1 - e.r);
    }
    e.y = (ev.ny || 0) * B.y;
    // the side traffic keeps out of the tunnel; the high and low crossings mark their cross streets for the towers
    if (e.decor) {
      const d = courseAt(e, api);
      if (e.mode === 'cross') { if (zones.inTunnel(d, 80)) e.alive = false; else if (d > 0) zones.addCross(d); }
      else if (zones.flowBlocked(d)) e.alive = false;
    }
  },
  update(e, dt, api) {
    const B = api.box, v = api.v, ship = api.ship;
    const closing = e.mode === 'flow' ? 1 - e.r : 1;
    e.z += v * closing * dt;
    e.t += dt;
    let blink = 0;
    if (e.mode === 'cross') {
      e.x = (e.nx0 - e.dir * e.k * Math.max(-e.z, -60) / 100) * B.x;
    } else if (e.lc !== undefined) {
      const arrive = -e.z / Math.max(1, v * closing);
      const k = smoothstep(e.lcAt, e.lcAt - 1.0, arrive);
      e.x = (e.nx + (e.lc - e.nx) * k) * B.x;
      if (arrive < e.lcAt + 1.0 && k < 1) { blink = Math.sign(e.lc - e.nx); if (!e.told) { e.told = true; api.game.telegraph(e); } }
    }
    const s = shape(e, api), a = e.appear;
    // ---- draw: the hull, then its lights
    if (e.mode === 'cross') eul.set(0, e.dir > 0 ? -Math.PI / 2 : Math.PI / 2, 0); else eul.set(0, 0, 0);
    tmpQ.setFromEuler(eul);
    const cz = e.mode === 'cross' ? (s.z0 + s.z1) / 2 : e.z - MZ * e.sz - MZC * e.sz;
    const cy = e.y - MYC * e.sy;
    for (let i = 0; i < layers.length; i++) { const L = layers[i]; L.put(e.x, cy, cz, tmpQ, e.sx * a, e.sy * a, e.sz * a, L.tint ? (i % 2 ? e.tint : e.tint2) : undefined); }
    e.shape = s;
    this.drawLights(e, s, a, blink, api);
    if (e.decor) { if (s.z1 > 30) e.alive = false; return; }
    // ---- the ship against it, while the ship is alongside (rule 14: the box is a little inside the hull)
    if (!e.hit && s.z1 - 0.6 < 0 && s.z0 + 0.6 > 0) {
      const dx = Math.abs(ship.x - s.x) - s.hx * 0.93, dy = Math.abs(ship.y - s.y) - s.hy * 0.95, rr = SHIP_R * 0.85;
      if (dx < rr && dy < rr && (dx < 0 || dy < 0 || Math.hypot(dx, dy) < rr)) { e.hit = true; api.game.crash(e, 24); }
      else { const d = Math.max(0, dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy)); e.near = Math.min(e.near, d); }
    }
    if (!e.scraped && !e.hit && s.z1 > 0.6 && e.near < 1.9) { e.scraped = true; api.game.scrape(e, e.near); }
    if (s.z1 > 30) e.alive = false;
  },
  // running lights: rows of small lights down each side (pink port, teal starboard), engines, red corner markers.
  // A lane change strobes the side it will move to, red, for a second before it moves.
  // Only a freighter that can hit you carries red (rule 9): red markers at its corners and along its roof edges. The
  // side traffic, which never touches the lane, runs dimmer and with no red at all.
  drawLights(e, s, a, blink, api) {
    if (a < 0.02) return;
    const L = lights, tw = 0.75 + 0.25 * Math.sin(api.time * 9 + e.ph), strobe = (Math.floor(api.time * 8) % 2) ? 1 : 0.15;
    const red = e.decor ? 0 : 1, dim = e.decor ? 0.55 : 1;
    if (e.mode === 'cross') {
      const side = e.dir < 0 ? PINK : TEAL, lead = e.x + e.dir * s.hx, tail = e.x - e.dir * s.hx;
      for (let i = 0; i < 9; i++) { const x = tail + (lead - tail) * (i + 0.5) / 9; L.push(x, e.y + s.hy * 0.15, s.z0 + 0.3, 1.2 * a, side[0], side[1], side[2], 0.9 * tw * dim * nf(s.z0)); }
      L.push(lead, e.y + s.hy * 0.4, s.z0, 2.2 * a, 1, 0.92, 0.96, 0.95 * nf(s.z0));                  // the bow light, leading
      L.push(tail, e.y - s.hy * 0.2, (s.z0 + s.z1) / 2, 4.2 * a, EMBER[0], EMBER[1], EMBER[2], 0.9 * nf(s.z0, 30)); // the engines, trailing
      if (red) { for (const x of [lead, tail]) for (const y of [-1, 1]) L.push(x, e.y + y * s.hy * 0.9, s.z0, 1.5 * a, REDL[0], REDL[1], REDL[2], nf(s.z0));
        for (let i = 1; i < 6; i++) L.push(tail + (lead - tail) * i / 6, e.y + s.hy * 0.95, s.z0, 0.9 * a, REDL[0], REDL[1], REDL[2], 0.85 * nf(s.z0)); }
      return;
    }
    const zt = s.z0;
    // engines at the tail, facing you
    L.push(e.x, e.y - s.hy * 0.25, zt + 0.4, 3.6 * a, EMBER[0], EMBER[1], EMBER[2], 0.85 * tw * nf(zt, 40));
    for (const sd of [-1, 1]) {
      const col = blink === sd ? REDL : (sd < 0 ? PINK : TEAL), al = blink === sd ? strobe : 0.85;
      const size = blink === sd ? 1.6 : 1.0;
      for (let i = 0; i < 6; i++) { const z = zt - (i + 0.5) * s.len / 6; L.push(e.x + sd * s.hx * 1.02, e.y + s.hy * 0.1, z, size * a, col[0], col[1], col[2], al * dim * nf(z)); }
      if (red) {
        for (const y of [-1, 1]) L.push(e.x + sd * s.hx, e.y + y * s.hy * 0.9, zt, 1.5 * a, REDL[0], REDL[1], REDL[2], nf(zt));
        for (let i = 1; i < 5; i++) { const z = zt - i * s.len / 5; L.push(e.x + sd * s.hx, e.y + s.hy * 0.95, z, 0.9 * a, REDL[0], REDL[1], REDL[2], 0.8 * nf(z)); }
      }
    }
  },
});
