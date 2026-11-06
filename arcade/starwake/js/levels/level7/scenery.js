// LEVEL 7 scenery: the orbital city at night. Yori's city towers (rows of lit windows) and holo-signs line the
// lane, her freighters run in the outer traffic lanes and cross overhead, pink lights mark the port edge of the lane
// and teal the starboard, the distant traffic streams by in lines of small lights, and far ahead the Spindle, the
// station's spine, waits with the tunnel through it. Her tunnel rings are the set piece (laid by the course, not a
// stream, so the tunnel starts and ends on its bar lines). Nothing here collides; everything stays outside the box.
import { THREE, defineScenery, defineDecor, Instanced, GlowPoints, modelGroups, clamp, smoothstep, rng } from '../../api.js?v=0.2.0';
import { MESH } from './mesh.js?v=0.2.0';

const tmpQ = new THREE.Quaternion(), eul = new THREE.Euler(), tmpC = new THREE.Color();
const side = (R, lo, hi) => R.sign() * R.range(lo, hi);
const PINK = 0xff2fa0, TEAL = 0x1fe0d0, VIOLET = 0x7a2aff, ROSE = 0xff6ac0, MINT = 0x5af0c8;
// lights fade as they come up beside you, so nothing passing the chase camera blooms into a disc across the screen
const nf = (z, far = 16) => clamp((-z - 2) / (far - 2), 0, 1);

// Instanced layers for one of Yori's models. Lit groups take her colour; glowing groups are white so each copy can
// be tinted (instance colour) without touching her materials.
function layersOf(api, groups, cap, opts = {}) {
  return modelGroups(groups).map((g) => {
    const tint = g.glow || (opts.tintLit && opts.tintLit.includes(g.color));
    const mat = g.glow ? new THREE.MeshBasicMaterial(opts.holo ? { color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide } : { color: 0xffffff })
      : new THREE.MeshStandardMaterial({ color: tint ? 0xffffff : g.color, metalness: 0.35, roughness: 0.6, flatShading: true, emissive: g.color, emissiveIntensity: opts.selfLit || 0 });
    const L = new Instanced(api.scene, g.geo, mat, cap); L.glow = g.glow; L.color = new THREE.Color(g.color).getHex(); L.tint = tint;
    if (tint) L.mesh.setColorAt(0, tmpC.setHex(L.color));
    return L;
  });
}

// ---------------------------------------------------------------- decor kinds
// A city tower beside the lane, rising from the deck far below or hanging from the one above. Left of the lane its
// teal windows burn violet, right of it its pink ones do: pink port, teal starboard, as the level reads.
const TOWERS = ['tower40', 'tower64', 'tower90'], TOWER_H = [44, 68, 94];
let towerL;
export const tower = defineDecor({
  name: 'l7-tower', hazard: null,
  sample: { x: 30, y: -40, v: 0, s: 1 },
  init(api) { towerL = TOWERS.map((m) => layersOf(api, MESH[m], 90, { selfLit: 0.25 })); },
  begin() { for (const ls of towerL) for (const L of ls) L.begin(); },
  end() { for (const ls of towerL) for (const L of ls) L.end(); },
  spawn(e, ev, api) {
    e.v = ev.v || 0; e.s = ev.s || 1; e.hang = !!ev.hang; e.ry = ev.ry || 0; e.dim = ev.dim ?? 1;
    const d = courseAt(e, api); if (zones.nearCross(d, 46) || zones.nearMouth(d, 45)) e.alive = false; // a cross street, or the tunnel mouth
  },
  update(e, dt, api) {
    const a = e.appear, s = e.s * a;
    tmpQ.setFromEuler(eul.set(e.hang ? Math.PI : 0, e.ry, 0));
    const left = e.x < 0;
    for (const L of towerL[e.v]) {
      let col;
      if (L.glow) { col = L.color === PINK ? (left ? PINK : VIOLET) : (left ? VIOLET : TEAL); tmpC.setHex(col).multiplyScalar(e.dim); col = tmpC.getHex(); }
      L.put(e.x, e.y, e.z, tmpQ, s, e.s * a, s, col);
    }
    if (e.z > 40) e.alive = false;
  },
});

// A holo-sign: Yori's lit panel in its truss frame. No words, a flat colour that flickers like a projection.
let signL;
const SIGN_COLS = [PINK, VIOLET, ROSE, MINT];
export const sign = defineDecor({
  name: 'l7-sign', hazard: null,
  sample: { x: 20, y: 8, s: 1 },
  init(api) { signL = layersOf(api, MESH.sign, 60, { holo: true }); },
  begin() { for (const L of signL) L.begin(); },
  end() { for (const L of signL) L.end(); },
  spawn(e, ev, api) {
    e.s = ev.s || 1; e.ry = ev.ry || 0; e.col = SIGN_COLS[(ev.c || 0) % SIGN_COLS.length]; e.ph = (ev.ph || 0) * 6;
    const d = courseAt(e, api); if (zones.nearCross(d, 34) || zones.inTunnel(d, 30)) e.alive = false;
  },
  update(e, dt, api) {
    const a = e.appear, s = e.s * a;
    tmpQ.setFromEuler(eul.set(0, e.ry, 0));
    // a projector's flicker: mostly steady, a stutter now and then
    const f = 0.82 + 0.18 * Math.sin(api.time * 3 + e.ph) * (Math.sin(api.time * 23 + e.ph * 3) > 0.92 ? 0.2 : 1);
    for (const L of signL) {
      let col;
      if (L.glow) { tmpC.setHex(L.color === PINK ? e.col : (e.col === MINT ? PINK : TEAL)).multiplyScalar(f * 0.45 * nf(e.z, 40)); col = tmpC.getHex(); }
      L.put(e.x, e.y, e.z, tmpQ, s, s, s, col);
    }
    if (e.z > 40) e.alive = false;
  },
});

// Yori's tunnel ring: 24 across, dark, four teal lane lights and a pink arch. The course lays one every 14 m through
// the Spindle; the mouth ring is bigger. Lights on the ring pulse with the music's beat.
let ringL, ringGlow;
export const tunnelRing = defineDecor({
  name: 'l7-ring', hazard: null,
  sample: { s: 1 },
  init(api) { ringL = layersOf(api, MESH.tunnel, 90, { selfLit: 0.15 }); ringGlow = new GlowPoints(api.scene, 600, api.glowTex).setFar(600, 790); },
  begin(api) { for (const L of ringL) L.begin(); ringGlow.begin(); ringGlow.setScale(api.focalPx); },
  end() { for (const L of ringL) L.end(); ringGlow.end(); },
  spawn(e, ev) { e.s = ev.s || 1; e.spin = ev.spin || 0; e.x = 0; e.y = 0; e.i = ev.i || 0; },
  update(e, dt, api) {
    const a = e.appear, s = e.s * a;
    tmpQ.setFromEuler(eul.set(0, 0, e.spin));
    for (const L of ringL) L.put(0, 0, e.z, tmpQ, s, s, s, L.glow ? L.color : undefined);
    // the lane lights, with a soft halo, and a chase of pink round the ring that runs one ring per beat
    const r = 10.9 * s;
    for (let i = 0; i < 4; i++) { const ang = i / 4 * Math.PI * 2 + Math.PI / 4 + e.spin; ringGlow.push(Math.cos(ang) * r, Math.sin(ang) * r, e.z, 2.3 * a, 0.12, 0.88, 0.82, 0.75 * nf(e.z, 24)); }
    const ch = ((api.time * 2.37 + e.i * 0.25) % 1) * Math.PI * 2;
    ringGlow.push(Math.cos(ch + e.spin) * r * 1.05, Math.sin(ch + e.spin) * r * 1.05, e.z, 3 * a, 1, 0.2, 0.65, 0.85 * nf(e.z, 24));
    if (e.z > 40) e.alive = false;
  },
});

// The blast-out: when the course reaches it, the tunnel spits you into the open. A speed kick, a shake and a burst.
export const blast = defineDecor({
  name: 'l7-blast', hazard: null, motion: 'own', spawnAt: 'now',
  sample: { warm: true },
  spawn(e, ev) { e.z = -800; e.done = !!ev.warm; },
  update(e, dt, api) {
    if (!e.done) {
      e.done = true;
      api.game.boost(1.1, 1.18); api.game.shake(0.7); api.game.hitstop(0.06);
      api.game.sfx('combo', { rate: 0.7 });
      api.game.burst(api.ship.x, api.ship.y, -6, 70, { speed: 30, life: 0.9, s0: 2.2, r: 1, g: 0.3, b: 0.75, carry: 1, drag: 1 });
      api.game.burst(api.ship.x, api.ship.y, -6, 50, { speed: 22, life: 0.8, s0: 1.8, r: 0.2, g: 0.95, b: 0.85, carry: 1, drag: 1 });
      api.game.call('BLAST OUT!', 'c-cyan');
    }
    e.alive = false;
  },
});

// ---------------------------------------------------------------- where the course needs the scenery to keep clear
// Crossing freighters cross the route at fixed distances, sweeping in from far out to either side, so a cross street
// has no towers or signs in it (plausibility: nothing slices through a tower). The level's build() names its own
// crossings and its tunnel; the traffic stream adds the high and low crossings it makes as it makes them (it is
// listed before the towers, so it streams first at each step).
export const zones = {
  cross: [], tunnel: null,
  setCourse(cross, tunnel) { this.cross = cross.slice().sort((a, b) => a - b); this.course = this.cross.slice(); this.tunnel = tunnel; },
  addCross(d) { this.cross.push(d); if (this.cross.length > 400) this.cross = this.course.concat(this.cross.slice(-100)).sort((a, b) => a - b); else this.cross.sort((a, b) => a - b); },
  nearCross(d, m) { for (const c of this.cross) if (Math.abs(c - d) < m) return true; return false; },
  inTunnel(d, m) { return !!this.tunnel && d > this.tunnel[0] - m && d < this.tunnel[1] + m; },
  nearMouth(d, m) { return !!this.tunnel && Math.abs(d - this.tunnel[0]) < m; },
  // a side-lane freighter born at d sweeps the course from d to d + 431 m before you overtake it (it runs at 0.35 of
  // your speed from 800 m out); none may be alongside you in the tunnel
  flowBlocked(d) { return !!this.tunnel && d > this.tunnel[0] - 470 && d < this.tunnel[1] + 30; },
  reset() { this.cross = (this.course || []).slice(); },
};
// the course distance a stream's new piece is born at (the spawn line ahead of the ship)
// The checks run as each piece is born (spawn), where its depth is known: a stream fills a whole stretch in one go
// at a cut, so the piece's own z is the only true measure of where on the course it is.
export const courseAt = (e, api) => (api.G && api.G.state === 'play' ? (api.G.courseD || 0) - e.z : -1e9);

// ---------------------------------------------------------------- streams
// Towers in three bands. NEAR the lane (12-22 m out) they stay below or above the lane's level, so the side traffic
// runs between them like an elevated road; MID (28-40 m) and FAR (45-90 m) towers stand at any height.
export const towers = defineScenery({
  name: 'l7-towers',
  stream: {
    every: [14, 26],
    place: (R, api) => {
      const out = [];
      for (const sd of [-1, 1]) {
        if (R() > 0.8) continue;
        const band = R(), v = band < 0.4 ? R.int(0, 1) : R.int(0, 2);
        let x, s, y, hang;
        if (band < 0.4) { // near: below the lane or hanging above it
          s = R.range(0.8, 1.3); x = sd * R.range(12 + 4 * s, 22); const h = TOWER_H[v] * s; hang = R() < 0.4;
          y = hang ? R.range(12, 22) + h * 0.5 : R.range(-28, -12) - h * 0.5 - 4 * s;
        } else if (band < 0.7) {
          s = R.range(0.9, 1.2); x = sd * R.range(28, 40); const h = TOWER_H[v] * s; hang = R() < 0.3;
          y = hang ? R.range(10, 34) + h * 0.5 : R.range(-6, 30) - h * 0.5;
        } else {
          s = R.range(1.4, 2.6); x = sd * R.range(48, 90); const h = TOWER_H[v] * s; hang = R() < 0.25;
          y = hang ? R.range(16, 50) + h * 0.5 : R.range(-10, 50) - h * 0.5;
        }
        out.push({ type: 'l7-tower', x, y, v, s, hang, ry: R.range(-0.4, 0.4), dim: R.range(0.65, 1) });
      }
      return out;
    },
  },
});
// holo-signs hung over the lane and under it, clear of the box and of the side traffic
export const signs = defineScenery({
  name: 'l7-signs',
  stream: {
    every: [60, 120],
    place: (R, api) => {
      const s = R.range(0.6, 0.95), up = R() < 0.5, B = api.box, sx = R.sign();
      const y = up ? B.y + 3 + 3.15 * s + R.range(0, 4) : -B.y - 2.5 - 2.45 * s - R.range(0, 3);
      // a sign is up to 10.4 m wide: centred 4-6.5 m out it ends short of the nearest towers (12 m out)
      return { type: 'l7-sign', x: sx * R.range(4, 6.5), y: y + (up ? 2 : 0), s, ry: -sx * R.range(0, 0.12), c: R.int(0, 3), ph: R() };
    },
  },
});
// the outer traffic: freighters in the side lanes, running with you, and crossing high overhead and far below.
// Side lanes are 1.75-2.6 box widths out and never above or below 1.75 box heights.
const sideFlow = (R, high) => ({ type: 'l7-freighter', mode: 'flow', nx: side(R, 1.75, 2.6), ny: high ? R.sign() * R.range(1.5, 1.75) : R.range(-1.75, 1.75), r: 0.35, len: R.range(0.8, 1.5), tint: R.int(0, 6) });
function overhead(R, api) {
  const up = R() < 0.6;
  return { type: 'l7-freighter', mode: 'cross', nx: R.range(-3, 3), ny: up ? R.range(2.6, 3.8) : R.range(-3.8, -2.6), dir: R.sign(), k: R.range(0.5, 1.1), len: R.range(0.9, 1.3), tint: R.int(0, 6) };
}
export const traffic = defineScenery({
  name: 'l7-traffic',
  stream: { every: [50, 100], place: (R, api) => (R() < 0.7 ? sideFlow(R, false) : overhead(R, api)) },
});
// the same with the side lanes only above and below the lane's level: for the stretches where freighters cross the
// route at the lane's level (they would cut through the side lanes there)
export const trafficHigh = defineScenery({
  name: 'l7-traffic-high',
  stream: { every: [50, 100], place: (R, api) => (R() < 0.7 ? sideFlow(R, true) : overhead(R, api)) },
});

// ---------------------------------------------------------------- set pieces
// The lane edges: a light every 32 m down each edge of the lane, pink to port, teal to starboard; and the far traffic:
// lines of small lights streaming past in both directions between the towers. All glow, one draw call.
export const lanes = defineScenery({
  name: 'l7-lanes',
  ease: 0.8,
  init(api) {
    const L = new GlowPoints(api.scene, 1400, api.glowTex).setFar(520, 780);
    const R = rng(707), far = [];
    for (let i = 0; i < 14; i++) {
      const sd = i % 2 ? 1 : -1, up = R() < 0.5;
      const n = R.int(16, 40);
      far.push({ x: sd * R.range(24, 110), y: up ? R.range(12, 60) : R.range(-50, -10), u: R() < 0.4 ? -R.range(0.3, 0.9) : R.range(0.2, 1.4), n, gap: 800 / n, off: R() * 800,
        col: [[1, 0.18, 0.63], [0.12, 0.88, 0.82], [1, 0.9, 0.96], [0.55, 0.3, 1]][R.int(0, 3)] });
    }
    return { L, far, last: null };
  },
  update(s, w, dt, api) {
    const L = s.L; L.begin(); L.setScale(api.focalPx);
    if (w > 0.003) {
      const B = api.box, D = api.G.dist || 0, S = 32;
      // lane edge lights (they are in the track, so they come at your speed)
      for (let k = Math.ceil((D - 20) / S); k * S < D + 790; k++) {
        const z = -(k * S - D);
        for (const sd of [-1, 1]) {
          const c = sd < 0 ? [1, 0.18, 0.63] : [0.12, 0.88, 0.82];
          L.push(sd * (B.x + 3.2), -B.y - 1.6, z, 1.5, c[0], c[1], c[2], 0.85 * w * nf(z));
          L.push(sd * (B.x + 3.2), B.y + 1.8, z, 1.1, c[0], c[1], c[2], 0.5 * w * nf(z));
        }
      }
      // far traffic: each line moves at its own speed u (a fraction of yours; below 0 it comes at you)
      const v = api.v || 0;
      for (const f of s.far) {
        f.off = (f.off + v * (1 - f.u) * dt) % 800;
        for (let k = 0; k < f.n; k++) {
          const z = 20 - (((k * f.gap - f.off) % 800) + 800) % 800;
          if (z > 20 || z < -790) continue;
          L.push(f.x, f.y, z, 2.2, f.col[0], f.col[1], f.col[2], 0.75 * w * nf(z, 40));
          L.push(f.x, f.y, z - 5, 1.4, f.col[0], f.col[1], f.col[2], 0.45 * w * nf(z - 5, 40));
        }
      }
    }
    L.end();
  },
});

// The Spindle: the station's spine far ahead. A dark column, tapering, ringed with thin bands of light, a great wheel
// of light at its waist on six spokes, and the tunnel mouth glowing pink in its middle. Low contrast where the play is
// (rule 10: shots read against it), bright only at the wheel. It closes in over the level; the tunnel goes into it.
export const spindle = defineScenery({
  name: 'l7-spindle',
  ease: 1.1,
  init(api) {
    const g = new THREE.Group();
    const mats = [];
    const m = (o) => { const { op = 1, ...rest } = o; const mm = new THREE.MeshBasicMaterial(Object.assign({ fog: false, transparent: true, opacity: 0, depthWrite: false }, rest)); mats.push([mm, op]); return mm; };
    const R0 = 34, R1 = 52, H = 1600;
    const column = new THREE.Mesh(new THREE.CylinderGeometry(R0, R1, H, 20, 1, true), m({ color: 0x150c24 }));
    // bands of light up and down the column: one instanced ring, tinted per band
    const bandM = m({ color: 0xffffff, blending: THREE.AdditiveBlending, op: 0.3 });
    const bands = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.028, 4, 40), bandM, 24);
    const cols = [PINK, VIOLET, TEAL, VIOLET], M4 = new THREE.Matrix4(), Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), P = new THREE.Vector3(), S = new THREE.Vector3();
    for (let i = 0; i < 24; i++) { const y = -H / 2 + 60 + i * (H - 120) / 23; if (Math.abs(y) < 60) { M4.makeScale(0, 0, 0); bands.setMatrixAt(i, M4); continue; } const r = R1 + (R0 - R1) * (y + H / 2) / H + 1.5; M4.compose(P.set(0, y, 0), Q, S.set(r, r, r * 2.5)); bands.setMatrixAt(i, M4); bands.setColorAt(i, tmpC.setHex(cols[i % 4])); }
    // the wheel at its waist: a dark rim on six spokes, lit pink inside and teal outside
    const rim = new THREE.Mesh(new THREE.TorusGeometry(205, 9, 6, 72), m({ color: 0x1a1030 }));
    const halo1 = new THREE.Mesh(new THREE.TorusGeometry(194, 2.2, 6, 80), m({ color: PINK, blending: THREE.AdditiveBlending }));
    const halo2 = new THREE.Mesh(new THREE.TorusGeometry(216, 1.6, 6, 80), m({ color: TEAL, blending: THREE.AdditiveBlending }));
    for (const t of [rim, halo1, halo2]) t.rotation.x = Math.PI / 2 - 0.08;
    const spokes = new THREE.Group(); spokes.rotation.x = -0.08;
    for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(160, 5, 7), m({ color: 0x1a1030 })); const a = i / 6 * Math.PI * 2; sp.position.set(Math.cos(a) * 125, 0, Math.sin(a) * 125); sp.rotation.y = -a; spokes.add(sp); }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(24, 2.4, 8, 48), m({ color: PINK, blending: THREE.AdditiveBlending }));
    const mouthIn = new THREE.Mesh(new THREE.CircleGeometry(22, 40), m({ color: 0x3a1a5a, blending: THREE.AdditiveBlending, op: 0.7 }));
    mouth.position.z = mouthIn.position.z = R1 + 2;
    g.add(column, bands, rim, halo1, halo2, spokes, mouth, mouthIn);
    g.position.set(0, -10, -900); g.visible = false; g.renderOrder = -4;
    api.scene.add(g);
    return { g, mats, mouth, spokes };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003;
    for (const [mm, op] of s.mats) mm.opacity = w * op;
    if (!s.g.visible) return;
    const L = api.level, k = L && api.G.state === 'play' ? clamp((api.G.courseD || 0) / L.length, 0, 1) : 0;
    // it closes in over the level: smaller at the start, filling the view by the tunnel
    const sc = 0.55 + 0.75 * k * k;
    s.g.scale.setScalar(sc);
    s.g.position.z = -900 + 100 * k;
    // off to the left for most of the level, so the middle of the view (where the shots come from) stays dark and
    // clear; it swings onto the lane only as the tunnel nears
    s.g.position.x = -190 * (1 - smoothstep(0.62, 0.86, k));
    s.spokes.rotation.y += dt * 0.03;
    s.mouth.scale.setScalar(1 + 0.04 * Math.sin(api.time * 6));
  },
});
