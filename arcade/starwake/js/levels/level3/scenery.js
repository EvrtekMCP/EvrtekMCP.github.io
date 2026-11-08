// LEVEL 3, THE GATEFIELD: the scenery (ruling 5: every stretch keeps something in view). All of it is Yori's
// ring-gate (art-incoming/yori/levels/scenery.js ringGate; look sheet level-03): "kilometre ring-gates in a grid,
// tarnished bronze and teal, keystones that light on the beat; everything is a circle".
//  - l3-ring      one ancient gate as decor, instanced (four colour layers for every gate in view). Its keystones
//                 flash on the beat; an ARCH (a giant one the lane runs through) flares as you pass it.
//  - l3-shard     a broken keystone block tumbling near the lane, for the sense of speed
//  - streams      the grid of gates in straight rows either side and above and below; the shards
//  - l3-horizon   a set piece: the far grid of gates on the horizon, beyond the fog, slowly closing
import { THREE, rng, defineScenery, defineDecor, Instanced, material, clamp } from '../../api.js?v=0.4.1';
import { MESH } from './mesh.js?v=0.4.1';
import { beatClock, pulse } from './beat.js?v=0.4.1';
import { GATE_S } from './gate.js?v=0.4.1';

const tmpQ = new THREE.Quaternion(), eul = new THREE.Euler();
// Decor laid down by a level's first fill (on the loading screen, before the run's own fade window opens) would
// otherwise be there at full size on the first frame: everything here also grows in over its first half second.
const born = (e) => { const k = Math.max(0, Math.min(1, (e.t - 0.15) / 0.5)); return k * k * (3 - 2 * k); };
const KEY = new THREE.Color(0x9fffe0), DIM = new THREE.Color(0x2c4038), WHITE = new THREE.Color(0xffffff), tmpC = new THREE.Color();

// ---------------------------------------------------------------- one gate, as decor
let layers = null, keyLayer = null, beatNow = 0, quiet = false;
export const ringDecor = defineDecor({
  name: 'l3-ring',
  init(api) {
    layers = []; keyLayer = null;
    MESH.gate.forEach((grp) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(grp.p, 3)); g.computeVertexNormals(); g.computeBoundingSphere();
      if (grp.glow) {
        const m = new THREE.MeshBasicMaterial({ color: 0xffffff });
        keyLayer = new Instanced(api.scene, g, m, 160);
        keyLayer.mesh.setColorAt(0, tmpC.set(0xffffff)); // makes the per-instance colour buffer
        layers.push(keyLayer);
      } else layers.push(new Instanced(api.scene, g, material(grp.color, false), 160));
    });
  },
  begin(api) {
    for (const L of layers) L.begin();
    const c = beatClock(api);
    quiet = api.G && api.G.section === 'sleeping';
    // the kick drops out in the breakdown: the gates breathe on the bar instead of the beat
    beatNow = quiet ? 0.45 * pulse(c, 0.6, 4) : pulse(c, 0.45);
  },
  end() { for (const L of layers) L.end(); },
  sample: { x: 60, y: 0, s: 1 },
  spawn(e, ev) { e.s = (ev.s || 1) * GATE_S; e.spin = (ev.spin || 0) * Math.PI / 4; e.lit = ev.lit ?? 1; e.flare = 0; e.arch = !!ev.arch; },
  update(e, dt, api) {
    const a = e.appear * born(e), s = e.s * a;
    tmpQ.setFromEuler(eul.set(0, 0, e.spin));
    if (e.arch && e.crossed) e.flare = 1;
    e.flare = Math.max(0, e.flare - dt * 1.6);
    const k = clamp(e.lit * (0.25 + 0.75 * beatNow) + e.flare, 0, 1.6);
    tmpC.copy(DIM).lerp(KEY, Math.min(1, k)); if (k > 1) tmpC.lerp(WHITE, k - 1);
    for (const L of layers) L.put(e.x, e.y, e.z, tmpQ, s, s, s, L === keyLayer ? tmpC.getHex() : undefined);
    if (e.z > 60 * e.s + 20) e.alive = false;
  },
});

// ---------------------------------------------------------------- a broken keystone block
let shardL, shardKeys;
export const shard = defineDecor({
  name: 'l3-shard',
  init(api) {
    shardL = new Instanced(api.scene, new THREE.BoxGeometry(1, 1, 1), material('#5a5a48', false), 200);
    const kg = new THREE.BoxGeometry(1.02, 0.25, 1.02);
    shardKeys = new Instanced(api.scene, kg, new THREE.MeshBasicMaterial({ color: 0x3f7a68 }), 200);
  },
  begin() { shardL.begin(); shardKeys.begin(); },
  end() { shardL.end(); shardKeys.end(); },
  sample: { x: 30, y: 0, w: 2, h: 1, dp: 1.5 },
  spawn(e, ev) { e.w = ev.w; e.h = ev.h; e.dp = ev.dp; e.rx = ev.rx || 0; e.ry = ev.ry || 0; e.vr = ev.vr || 0.3; },
  update(e, dt, api) {
    const a = e.appear * born(e); e.rx += dt * e.vr; e.ry += dt * e.vr * 0.7;
    tmpQ.setFromEuler(eul.set(e.rx, e.ry, 0));
    shardL.put(e.x, e.y, e.z, tmpQ, e.w * a, e.h * a, e.dp * a);
    shardKeys.put(e.x, e.y, e.z, tmpQ, e.w * a * 0.6, e.h * a * 1.02, e.dp * a * 0.6);
    if (e.z > 30) e.alive = false;
  },
});

// ---------------------------------------------------------------- streams
// The grid: fixed columns and rows, every 80 m exactly, so the gates stand in straight rows to the haze. Each cell
// is filled or not at random; the lane itself (x = 0, y = 0) is never filled.
const COLS = [-160, -84, 84, 160], ROWS = [-70, 0, 70];
export const gateRows = defineScenery({
  name: 'l3-gate-rows',
  stream: {
    every: [120, 120],
    place(R, api, w) {
      // the low tier (phones that dropped) keeps the inner columns and half the fill
      const out = [], p = 0.36 * Math.min(1, w + 0.2) * (api.tier === 0 ? 0.55 : 1);
      for (const x of COLS) for (const y of ROWS) if (R() < p && !(api.tier === 0 && Math.abs(x) > 100)) out.push({ type: 'l3-ring', x, y, s: Math.abs(x) > 100 ? 1.7 : 1.3, spin: R.int(0, 1), lit: R() < 0.7 ? 1 : 0.15 });
      for (const y of [-74, 74]) if (R() < 0.3 * w) out.push({ type: 'l3-ring', x: 0, y, s: 1.3, spin: R.int(0, 1), lit: 1 });
      return out;
    },
  },
});
const side = (R, lo, hi) => R.sign() * R.range(lo, hi);
export const shards = defineScenery({
  name: 'l3-shards',
  stream: { every: [34, 60], place: (R) => ({ type: 'l3-shard', nx: side(R, 1.8, 4.2), ny: R.range(-2.6, 2.6), w: R.range(1.2, 3.4), h: R.range(0.8, 2.2), dp: R.range(1, 3), rx: R() * 6, ry: R() * 6, vr: R.range(0.2, 0.9) }) },
});

// ---------------------------------------------------------------- the horizon: the far grid, past the fog
export const horizon = defineScenery({
  name: 'l3-horizon',
  ease: 0.5,
  init(api) {
    const g = new THREE.Group(), R = rng(303);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x123c3c, fog: false, transparent: true, opacity: 0, depthWrite: false });
    const torus = new THREE.TorusGeometry(1, 0.06, 4, 32);
    const keys = [];
    for (let i = 0; i < 26; i++) {
      const r = R.range(55, 150), m = new THREE.Mesh(torus, ringMat);
      const col = R.int(-4, 4), row = R.int(-1, 1);
      m.position.set(col * 150 + R.range(-10, 10), row * 160 + R.range(-6, 6), -R.range(0, 160)); m.scale.set(r, r, r * 3);
      g.add(m);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; keys.push(m.position.x + Math.cos(a) * r, m.position.y + Math.sin(a) * r, m.position.z); }
    }
    const km = new THREE.PointsMaterial({ color: 0x9fffe0, size: 5, map: api.glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    g.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(keys, 3)), km));
    g.position.set(0, 0, -960); g.renderOrder = -4; g.visible = false;
    api.scene.add(g);
    return { g, ringMat, km };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003;
    const c = beatClock(api);
    s.ringMat.opacity = 0.6 * w;
    s.km.opacity = w * (0.35 + 0.5 * pulse(c, 0.5, api.G && api.G.section === 'sleeping' ? 4 : 1));
    s.g.position.z = -960 + Math.min((api.G ? api.G.dist : 0) * 0.006, 120);
  },
});
