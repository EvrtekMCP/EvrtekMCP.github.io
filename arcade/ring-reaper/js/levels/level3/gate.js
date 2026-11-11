// LEVEL 3, THE GATEFIELD: the BEAT GATE (kind 'l3-gate'), the level's one idea. Yori's ancient ring-gate
// (art-incoming/yori/levels/scenery.js ringGate, her look sheet level-03) stands across the lane, its aperture cut
// into SECTORS. A closed sector fills with her mint field, edged in red (rule 9: red hurts): don't fly through it.
// The fields move only ON THE BEAT of the music, and each gate stops moving a few beats before you reach it, so the
// way through is always readable in time (rule 12):
//
//   mode 'step'  the closed fields spin one sector a beat (or flip side to side) and LOCK `hold` beats before the
//                gate reaches you: a new reader gets 4 beats (1.7 s), a practised one 2 (0.86 s). This is the level.
//   mode 'turn'  the twist (act 3): the gate never locks. It ratchets a quarter-sector every beat as it comes, and
//                you ride the gap through (the Warden's spoke sweep, taught before the Warden; rule 27).
//   mode 'sleep' no fields: the gate only beats its keystones (the opening, and the breakdown where the kick stops).
//
// Sectors are cut in the NORMALISED flight box, so every sector holds the same share of the box on a wide screen
// and a tall phone alike; in metres a boundary is the line through the hub along (cos a * box.x, sin a * box.y).
// Event: { nx, ny (the hub), n (sectors), rot (in sectors; 0 puts a boundary on the +x axis), closed: [indices],
//          mode, pattern 'spin' | 'flip', dir (+1 anticlockwise), step (sectors a beat), hold (beats), dmg }
import { THREE, defineObstacle, buildModel, clamp, READ_D, SHIP_R } from '../../api.js?v=0.6.0';
import { MESH } from './mesh.js?v=0.6.0';
import { beatClock, pulse } from './beat.js?v=0.6.0';

export const GATE_S = 0.7;                    // Yori's gate is 44 across in Wake units; at 0.7 it is ~31 m
export const FIELD_R = 18.4 * GATE_S;         // the field fills the ring's inner face
export const MOUNT_R = 15.2 * GATE_S;         // where a gate turret sits (her mount at six o'clock)
const TAU = Math.PI * 2;
const EDGE_SAFE = 0.32;                       // rule 14: inside a field by less than this is a THREAD, not a hit
const THREAD_R = 1.1;                         // within this of a field's edge (either side) pays THREAD

const VERT = /* glsl */`
  #include <fog_pars_vertex>
  varying vec2 vP;
  uniform float uR;
  void main() {
    vP = position.xy * uR;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const FRAG = /* glsl */`
  #include <fog_pars_fragment>
  varying vec2 vP;
  uniform vec2 uBox; uniform float uR, uN, uRot, uBeat, uHot, uA, uLock, uTime;
  uniform float uC[8];
  float closedAt(float i) { float c = 0.0; for (int k = 0; k < 8; k++) { if (float(k) == i) c = uC[k]; } return c; }
  float lineDist(float a) {               // metres from vP to the boundary half-line at normalised angle a
    vec2 d = normalize(vec2(cos(a) * uBox.x, sin(a) * uBox.y));
    float along = dot(vP, d);
    return along > 0.0 ? abs(d.x * vP.y - d.y * vP.x) : length(vP);
  }
  void main() {
    float r = length(vP);
    if (r > uR) discard;
    vec2 n = vP / uBox;
    float sec = 6.2831853 / uN;
    float a = mod(atan(n.y, n.x) - uRot * sec, 6.2831853);
    float fi = floor(a / sec);
    float c = closedAt(fi);
    float cPrev = closedAt(mod(fi - 1.0, uN)), cNext = closedAt(mod(fi + 1.0, uN));
    float a0 = (uRot + fi) * sec, a1 = (uRot + fi + 1.0) * sec;
    float d0 = lineDist(a0), d1 = lineDist(a1);
    // the field: Yori's mint, a hatch you can read in greyscale, a ring of light running out on every beat
    vec2 q = vP * 1.35;
    float h1 = abs(fract(q.x * 0.5 + q.y * 0.866) - 0.5), h2 = abs(fract(q.x * 0.5 - q.y * 0.866) - 0.5), h3 = abs(fract(q.x) - 0.5);
    float hatch = smoothstep(0.08, 0.0, min(min(h1, h2), h3));
    float wave = smoothstep(1.2, 0.0, abs(r - (1.0 - uBeat) * uR)) * uBeat;
    float rim = smoothstep(uR - 0.9, uR, r);
    vec3 mint = vec3(0.62, 1.0, 0.88);
    vec3 col = mint * c * (0.16 + 0.38 * hatch + 0.55 * wave + 0.5 * rim + 0.35 * uLock);
    // the edge where a field meets open space: red (it hurts), white-hot as you arrive (rule 9 / 11)
    float e0 = abs(c - cPrev), e1 = abs(c - cNext);
    float edge = max(e0 * smoothstep(0.26, 0.0, d0), e1 * smoothstep(0.26, 0.0, d1));
    float glowE = max(e0 * smoothstep(1.1, 0.0, d0), e1 * smoothstep(1.1, 0.0, d1)) * 0.35;
    vec3 red = mix(vec3(1.0, 0.2, 0.33), vec3(1.0, 0.92, 0.9), uHot);
    col += red * (edge * (1.4 + uHot) + glowE * (0.6 + uHot));
    // the hub: a small red-white knot where the fields meet
    col += red * smoothstep(0.55, 0.0, r) * max(max(c, cPrev), cNext) * 1.2;
    col *= uA;
    #ifdef USE_FOG
      float ff = smoothstep(fogNear, fogFar, vFogDepth);
      col *= 1.0 - ff;
    #endif
    gl_FragColor = vec4(col, 1.0);
  }`;

let discGeo = null;
function fieldMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), {
      uBox: { value: new THREE.Vector2(7.5, 4.3) }, uR: { value: FIELD_R }, uN: { value: 4 }, uRot: { value: 0 },
      uBeat: { value: 0 }, uHot: { value: 0 }, uA: { value: 1 }, uLock: { value: 0 }, uTime: { value: 0 },
      uC: { value: new Array(8).fill(0) },
    }),
    vertexShader: VERT, fragmentShader: FRAG, fog: true,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}
function make(api) {
  const g = new THREE.Group();
  const m = buildModel(MESH.gate, { own: ['#9fffe0*'] });
  m.group.scale.setScalar(GATE_S);
  g.add(m.group);
  const field = new THREE.Mesh(discGeo, fieldMaterial());
  field.position.z = -0.9 * GATE_S; field.renderOrder = 2; field.scale.setScalar(FIELD_R);
  g.add(field);
  // a lamp in front of each of Yori's eight keystones: lit mint over the way through once the gate locks
  const lamps = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0x9fffe0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    s.position.set(Math.cos(a) * 18.4 * GATE_S, Math.sin(a) * 18.4 * GATE_S, -1.6 * GATE_S); s.scale.setScalar(3.2);
    s.userData.a = a; g.add(s); lamps.push(s);
  }
  g.userData = { keys: m.mats['#9fffe0*'], field, lamps, model: m.group };
  return g;
}

// ---- the state machine. k = beats until the gate reaches the ship, re-read on every beat. It locks on the last
// beat that still leaves `hold` whole beats, so the locked answer is on show for hold to hold+1 beats.
function setTarget(e, k) {
  const ev = e.ev, st = e.st;
  const left = Math.max(0, Math.floor(k - st.hold + 1e-6)); // beats of motion left before the lock
  st.locked = st.mode !== 'turn' && left <= 0;
  if (st.mode === 'sleep') { st.rotT = st.rot0; for (let i = 0; i < 8; i++) st.cT[i] = 0; return; }
  if (st.pattern === 'flip' && st.mode === 'step') {
    st.rotT = st.rot0;
    const odd = left % 2 === 1;
    for (let i = 0; i < 8; i++) st.cT[i] = i < st.n ? (st.closed.has(i) !== odd ? 1 : 0) : 0;
  } else {
    // spin or turn: the field set is fixed, the gate turns into its final place
    st.rotT = st.rot0 - st.dir * st.step * left;
    for (let i = 0; i < 8; i++) st.cT[i] = st.closed.has(i) ? 1 : 0;
  }
}
// a ward (the Warden throws these) flies at its own pace; everything else streams at the ship's speed
const beatsLeft = (e, api, c) => -e.z / (e.wardV || Math.max(1, api.v)) / c.beatSec;
// a run of gates scored as one (the Cascade): every gate clean pays a bonus at the last one
const SETS = {};

export default defineObstacle({
  name: 'l3-gate',
  // a static thing in the track whose answer is shown `hold` beats out (step) or always (turn): rule 12
  hazard: { cls: 'mover', introduced: 3, warn: (ev, v) => (ev.mode === 'turn' || ev.mode === 'sleep' ? READ_D / v : (ev.hold ?? 3) * 60 / 140) },
  sample: { n: 4, closed: [0], mode: 'step' },
  // 0.3.1, check-levels' "no fully blocked moment": its solid shape as it crosses the ship's plane, as the distance from
  // a ship centre (x, y) to its surface (the kind's own hit test is that distance under part of SHIP_R)
  // (a step gate locks into its event's rot and closed set; a turning gate ratchets into it as it arrives)
  solid(ev, B) {
    if ((ev.mode || 'step') === 'sleep' || ev.ward || !(ev.closed || []).length) return null;
    const n = clamp(ev.n || 4, 2, 8), st = { n, rot: ev.rot || 0 }, shut = new Set(ev.closed), hx = (ev.nx || 0) * B.x, hy = (ev.ny || 0) * B.y;
    return [{ dist: (x, y) => { const s = sectorAt(st, hx, hy, x, y, B); if (shut.has(s.i)) return -0.01; return Math.min(shut.has(s.prev) ? s.d0 : 99, shut.has(s.next) ? s.d1 : 99); } }];
  },
  init(api) {
    discGeo = new THREE.CircleGeometry(1, 72);
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('l3-gate', () => make(api));
    const n = clamp(ev.n || 4, 2, 8);
    e.st = {
      n, mode: ev.mode || 'step', pattern: ev.pattern || 'spin', dir: ev.dir || 1,
      step: ev.step ?? (ev.mode === 'turn' ? 0.25 : 1), hold: ev.mode === 'turn' ? 0 : (ev.hold ?? 3),
      rot0: ev.rot || 0, closed: new Set(ev.closed || []), dmg: ev.dmg ?? 16,
      rotT: 0, rot: 0, cT: new Array(8).fill(0), c: new Array(8).fill(0), lastBeat: null, locked: false, lockT: 9, done: false,
    };
    e.wardV = ev.ward ? Math.max(20, -e.z / ev.ward) : 0; e.grow = ev.ward ? 0 : 1;
    if (ev.set && ev.setI === 0) SETS[ev.set] = { got: 0, missed: 0 };
    const c = beatClock(api);
    setTarget(e, beatsLeft(e, api, c));
    e.st.rot = e.st.rotT; for (let i = 0; i < 8; i++) e.st.c[i] = e.st.cT[i];
    e.st.lastBeat = Math.floor(c.beat);
    e.sx = e.sy = e.sz = ev.ward ? 0 : 1;
    const ud = e.obj.userData, u = ud.field.material.uniforms;
    u.uN.value = n; u.uR.value = FIELD_R;
    ud.model.rotation.z = (ev.mount ?? -90) * Math.PI / 180 + Math.PI / 2; // her mount sits at six o'clock
  },
  update(e, dt, api) {
    const st = e.st, ud = e.obj.userData, u = ud.field.material.uniforms, c = beatClock(api);
    if (e.wardV) {
      // undo the stream and fly at the ward's own pace; it grows out of the Warden's hub as it comes
      e.z += (e.wardV - api.v) * dt; e.crossed = e.pz < 0 && e.z >= 0;
      e.grow = Math.min(1, e.grow + dt * 2.4); e.sx = e.sy = e.sz = e.grow * e.grow * (3 - 2 * e.grow);
    }
    const bi = Math.floor(c.beat + 1e-6);
    const k = beatsLeft(e, api, c);
    if (bi !== st.lastBeat) {
      st.lastBeat = bi;
      const was = st.locked;
      setTarget(e, k);
      if (st.locked && !was && st.mode === 'step' && e.z < 0) { st.lockT = 0; if (e.z > -READ_D) api.game.sfx('fire', { rate: 0.5, vol: 0.32 }); }
    }
    // a step is a snap: most of the way in a tenth of a second, so the beat reads as a hit
    const kk = 1 - Math.exp(-dt * 26);
    st.rot += (st.rotT - st.rot) * kk;
    for (let i = 0; i < 8; i++) st.c[i] += (st.cT[i] - st.c[i]) * kk;
    st.lockT += dt;
    // draw
    api.pose(e);
    u.uBox.value.set(api.box.x, api.box.y);
    u.uRot.value = st.rot;
    for (let i = 0; i < 8; i++) u.uC.value[i] = st.c[i];
    u.uBeat.value = pulse(c, 0.5);
    u.uLock.value = Math.max(0, 1 - st.lockT / 0.35);
    u.uHot.value = st.mode === 'turn' ? clamp(1 - k / 4, 0, 1) * 0.7 : st.locked ? clamp(1 - k / Math.max(1, st.hold), 0, 1) : 0;
    // the field thins as it reaches you (the choice is made by then) and is gone a few metres past the ship, so
    // it never fills the screen on its way past the camera
    u.uA.value = e.appear * clamp(0.3 + 0.7 * (-e.z / 7), 0, 1) * (e.z > 0 ? Math.max(0, 1 - e.z / 3) : 1);
    const beatGlow = pulse(c, 0.4);
    ud.keys.color.setRGB(0.25 + 0.37 * beatGlow, 0.4 + 0.6 * beatGlow, 0.36 + 0.52 * beatGlow);
    // keystone lamps: after the lock, the ones over open sectors light the way
    for (const s of ud.lamps) {
      let open = 0;
      if (st.mode !== 'sleep') {
        const wa = s.userData.a;
        const nx = Math.cos(wa) / api.box.x, ny = Math.sin(wa) / api.box.y;
        const sec = TAU / st.n, a = ((Math.atan2(ny, nx) - st.rot * sec) % TAU + TAU) % TAU;
        const i = Math.floor(a / sec) % st.n;
        open = st.c[i] < 0.5 ? 1 : 0;
      }
      const want = st.mode === 'sleep' ? 0.35 * beatGlow : st.locked || st.mode === 'turn' ? open * (0.7 + 0.3 * beatGlow) : 0.15 * beatGlow;
      s.material.opacity = want * e.appear;
    }
    // for the test autopilot: circles on each closed sector, inside the box, once it is near
    if (st.mode !== 'sleep' && e.z > -api.v * 1.2 && e.z < 0) {
      const L = e.avoidList || (e.avoidList = []); L.length = 0;
      const sec = TAU / st.n, R = Math.min(api.box.x, api.box.y);
      for (let i = 0; i < st.n; i++) if (st.c[i] > 0.5) {
        const a = (st.rot + i + 0.5) * sec;
        for (const f of [0.35, 0.8]) L.push({ x: e.x + Math.cos(a) * api.box.x * f, y: e.y + Math.sin(a) * api.box.y * f, r: R * (f < 0.5 ? 0.42 : 0.62) });
      }
    }
    // the crossing
    if (e.crossed && !st.done) { st.done = true; cross(e, api); }
    if (e.z > 16) e.alive = false;
  },
  // the test autopilot: one circle on each closed sector, inside the box
  avoid(e) { return e.avoidList || null; },
});

// which sector is the ship in, and how far is it from that sector's two edges (metres)
export function sectorAt(st, hx, hy, px, py, box) {
  const sec = TAU / st.n, x = px - hx, y = py - hy;
  const a = ((Math.atan2(y / box.y, x / box.x) - st.rot * sec) % TAU + TAU) % TAU;
  const i = Math.floor(a / sec) % st.n;
  const dist = (ang) => { const dx = Math.cos(ang) * box.x, dy = Math.sin(ang) * box.y, L = Math.hypot(dx, dy); const ux = dx / L, uy = dy / L; return x * ux + y * uy > 0 ? Math.abs(ux * y - uy * x) : Math.hypot(x, y); };
  const a0 = (st.rot + i) * sec, a1 = (st.rot + i + 1) * sec;
  return { i, d0: dist(a0), d1: dist(a1), prev: (i - 1 + st.n) % st.n, next: (i + 1) % st.n };
}
function cross(e, api) {
  const st = e.st, ship = api.ship;
  if (st.mode === 'sleep') return;
  const s = sectorAt(st, e.x, e.y, ship.x, ship.y, api.box);
  const closed = st.c[s.i] > 0.5;
  const edge0 = Math.abs(st.c[s.i] - st.c[s.prev]) > 0.5, edge1 = Math.abs(st.c[s.i] - st.c[s.next]) > 0.5;
  const dEdge = Math.min(edge0 ? s.d0 : 99, edge1 ? s.d1 : 99);
  const at = { x: ship.x, y: ship.y - 1.4, type: 'l3-gate' };
  const clean = !(closed && dEdge > EDGE_SAFE);
  if (e.ev.set) tally(e.ev, clean, api);
  if (!clean) {
    api.game.crash(at, st.dmg, true); // a step off the combo, not all of it: it is the level's one idea
  } else {
    if (dEdge < THREAD_R) api.game.scrape(at, dEdge);
    api.game.gate(at, true);
  }
}

function tally(ev, clean, api) {
  const t = SETS[ev.set] || (SETS[ev.set] = { got: 0, missed: 0 });
  if (clean) t.got++; else t.missed++;
  if (t.got + t.missed < ev.setN) return;
  if (!t.missed) { api.game.call(ev.set.toUpperCase() + ' CLEAN!', 'c-cyan'); api.game.bonus(ev.set.toUpperCase() + ' CLEAN', ev.setBonus || 30000); api.game.shake(0.4); }
  else api.game.call(ev.set.toUpperCase() + ' ' + t.got + '/' + ev.setN, '');
}
