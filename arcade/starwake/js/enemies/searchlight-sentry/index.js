// THE SEARCHLIGHT SENTRY (level 8 on): Yori's dish on a mast, standing on a torn slab of wreck plating. Its lamp
// throws a pale beam, and whatever the beam catches, it calls the dead fleet's defence wave down on.
//
//   mode 'sweep'  the lamp sits outside the flight box and swings its beam across the lane like a wiper. The swing
//                 is laid out in METRES of track, not seconds: where the beam is when it reaches the ship is fixed by
//                 the course (so the rings can show the dark), and it swings faster when the ship flies faster.
//   mode 'hunt'   (level 8's twist) the lamp stands on a wreck tower ahead and drives a pool of light across the
//                 ship's plane toward the ship, slower than the ship can fly. Stay in the pool for HUNT_DWELL and it
//                 has you. The pool warms from pale to red while it is closing on you.
//
// Caught: the beam goes red, the dish rim flashes, SPOTTED!, and ev.wave launches from the wrecks: strafers swoop
// in out of the haze, pods condense at the spawn line. A hunter also fires one slow bolt down its beam; roll it
// back up the beam into the lamp and the light goes out. Passed without being seen: UNSEEN, a small stealth score.
//
// ev: { mode, nx, ny }  the lamp, in the normalised box (outside it: |nx| or |ny| past 1)
//     sweep: { aim, swing, wave, arrive, dir }  degrees in the XY plane (0 = +x, 90 = +y): the centre of the
//            swing, its half-width, metres of track per full swing, the angle when the lamp reaches the ship's
//            plane, and which way it is swinging then (+1 toward larger angles)
//     hunt:  { slew }    metres per second the pool closes at (the ship crosses the box in about half a second)
//     wave:  { shrikes, pods, shots }  what being caught calls
import { THREE, defineEnemy, buildModel, clamp, smoothstep, SPAWN_D, READ_D, HUES } from '../../api.js?v=0.2.0';
import { SENTRY, PIVOT } from './mesh.js?v=0.2.0';

export const SCALE = 1.7;            // Yori's 3.0-tall sentry, drawn 5.1 tall so it reads beside a 3.3 ship
export const BEAM_R = 2.3;           // the beam is this wide (radius, metres) 20 m out; it spreads at a fixed angle (see beamR)
export const CATCH_K = 0.72;         // rule 14: the beam catches inside 72 % of its drawn radius (its soft edge is free)
export const SHIP_CORE = 0.35;       // ...plus this much of the ship
export const HUNT_FAR = 520, HUNT_NEAR = 48;   // a hunter hunts while its lamp is this far ahead (metres)
export const HUNT_DWELL = 0.55;      // seconds in the pool before it has you
export const SPOT_R = 2.3;           // the pool's radius
// a sweeping beam's radius at `along` metres from its lamp, for a beam `len` long: 0.15 of its 20 m width at the lamp
// (scaled with length), spreading at a fixed angle. The drawn cone and the catch test both use it.
export const beamR = (along, len) => BEAM_R * (0.15 * len + 0.85 * along) / 20;
export const WAVE_CAP = 5;           // rule 15: never more than this many wave craft alive at once
export const BOLT_T = 1.5;           // a hunter's bolt takes this long down the beam (rule 12: a new shot, >= 1.2 s)
export const BOLT_TEL = 0.45;        // ...after the beam pulses red this long
export const SWING = 0.7;            // seconds a hunter takes to swing its beam down onto the lane (or back up)

const PALE = new THREE.Color(0xfff0d0), RED = new THREE.Color(HUES.hurts);
const DEG = Math.PI / 180;

// ---- the stats a level reads for its stealth bonuses (reset by the level at the start of a run)
export const watch = { caught: 0, unseen: 0, out: 0, byTag: {}, lastT: 0, reset() { this.caught = this.unseen = this.out = 0; this.byTag = {}; } };
const tagOf = (e) => e.ev.tag || 'all';
function note(e, what) { const t = (watch.byTag[tagOf(e)] ||= { caught: 0, unseen: 0, out: 0 }); t[what]++; watch[what]++; }

// ---- shaders: a volumetric-looking cone (bright where you look through its middle, fading at its edges and
// along its length) and the hunter's pool (a soft disc with a bright rim)
const BEAM_VS = 'varying float vA; varying float vF;\n' +
  'void main() { vA = position.y; vec4 mv = modelViewMatrix * vec4(position, 1.0);\n' +
  '  vec3 n = normalize(normalMatrix * normal); vF = abs(dot(n, normalize(-mv.xyz)));\n' +
  '  gl_Position = projectionMatrix * mv; }';
// uFlat: how much of it glows even edge-on (a hunter's beam is seen nearly end-on); uEnd: 1 fades the far end out
// (a sweep's beam dies into the dark), 0 carries it at full strength down to the pool
const BEAM_FS = 'uniform vec3 uCol; uniform float uOp; uniform float uFlat; uniform float uEnd; varying float vA; varying float vF;\n' +
  'void main() { float a = mix(pow(vF, 2.2), 0.55, uFlat) * mix(1.0 - smoothstep(0.8, 1.0, vA), (1.0 - smoothstep(0.55, 1.0, vA)) * (0.45 + 0.55 * (1.0 - vA)), uEnd);\n' +
  '  gl_FragColor = vec4(uCol, a * uOp); }';
const SPOT_VS = 'varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const SPOT_FS = 'uniform vec3 uCol; uniform float uOp; varying vec2 vP;\n' +
  'void main() { float r = length(vP); float a = (1.0 - smoothstep(0.9, 1.0, r)) * (0.1 + 0.9 * smoothstep(0.78, 0.93, r));\n' +
  '  gl_FragColor = vec4(uCol, a * uOp); }';
let beamGeo, spotGeo;
function beamMat(op) {
  return new THREE.ShaderMaterial({ vertexShader: BEAM_VS, fragmentShader: BEAM_FS, uniforms: { uCol: { value: PALE.clone() }, uOp: { value: op }, uFlat: { value: 0 }, uEnd: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
}

// ---- the sentry and its perch (one pooled group); the beam, glare and pool live in the scene (world space)
let perchGeo, perchMat, rustMat;
function make(api) {
  if (!perchGeo) {
    perchGeo = new THREE.BoxGeometry(1, 1, 1);
    perchMat = new THREE.MeshStandardMaterial({ color: 0x3a3f48, metalness: 0.5, roughness: 0.7, flatShading: true });
    rustMat = new THREE.MeshStandardMaterial({ color: 0x4a3028, metalness: 0.3, roughness: 0.9, flatShading: true });
  }
  const g = new THREE.Group();
  const m = buildModel(SENTRY, { own: ['#fff0d0*', '#ff3355*'] });
  const head = m.parts.head; head.position.set(PIVOT[0], PIVOT[1], PIVOT[2]);
  g.add(m.group);
  // the perch: a slab of torn hull plating under the foot, a rusted rib across it, a broken stub of a beam
  const slab = new THREE.Mesh(perchGeo, perchMat); slab.scale.set(7.5, 0.8, 6.0); slab.position.set(0.4, -2.0, 0.6); slab.rotation.y = 0.12;
  const rib = new THREE.Mesh(perchGeo, rustMat); rib.scale.set(0.6, 0.6, 6.4); rib.position.set(2.2, -1.4, 0.6);
  const stub = new THREE.Mesh(perchGeo, rustMat); stub.scale.set(0.45, 2.2, 0.45); stub.position.set(-1.6, -0.9, 1.1); stub.rotation.z = 0.35;
  g.add(slab, rib, stub);
  g.userData = { head, own: { lamp: m.mats['#fff0d0*'], core: m.mats['#ff3355*'] } };
  return g;
}
function fxMake(api) {
  if (!beamGeo) {
    beamGeo = new THREE.CylinderGeometry(1, 0.15, 1, 28, 1, true); beamGeo.translate(0, 0.5, 0);
    spotGeo = new THREE.CircleGeometry(1, 48);
  }
  const halo = new THREE.Mesh(beamGeo, beamMat(0.5)), core = new THREE.Mesh(beamGeo, beamMat(0.9)), haze = new THREE.Mesh(beamGeo, beamMat(0.2));
  const spot = new THREE.Mesh(spotGeo, new THREE.ShaderMaterial({ vertexShader: SPOT_VS, fragmentShader: SPOT_FS, uniforms: { uCol: { value: PALE.clone() }, uOp: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xfff0d0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  for (const m of [haze, halo, core, spot, glare]) { m.frustumCulled = false; m.renderOrder = 6; m.visible = false; api.scene.add(m); }
  return { halo, core, haze, spot, glare };
}
const fxPool = [];

// ---- small vector helpers (no allocation per frame)
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vD = new THREE.Vector3(), vL = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), NZ = new THREE.Vector3(0, 0, -1);
const qInv = new THREE.Quaternion(), tmpC = new THREE.Color();

// where a sweeping lamp points when it is z metres ahead (z <= 0); the swing is a sine laid along the track.
// Angles are in the NORMALISED box (so a course reads the same on a wide screen and a tall one); beamDir turns one
// into a direction in metres for the box in use.
export function sweepAngle(sw, z) {
  const k = clamp((sw.arrive - sw.aim) / (sw.swing || 1), -1, 1);
  const psi = (sw.dir || 1) > 0 ? Math.asin(k) : Math.PI - Math.asin(k);
  return (sw.aim + sw.swing * Math.sin(psi + 2 * Math.PI * z / sw.wave)) * DEG;
}
export function beamDir(sw, z, box) {
  const a = sweepAngle(sw, z), dx = Math.cos(a) * box.x, dy = Math.sin(a) * box.y, n = Math.hypot(dx, dy) || 1;
  return [dx / n, dy / n];
}
// the lamp sits this far in from the sentry's base, toward the lane
export const LAMP_IN = 0.62;
// how far a ray from (x, y) along (dx, dy) runs before it leaves the box (plus a margin), for the beam's length
export function reach(x, y, dx, dy, box) {
  const X = box.x + 12, Yy = box.y + 10;
  let t = 60;
  if (dx > 1e-4) t = Math.min(t, (X - x) / dx); else if (dx < -1e-4) t = Math.min(t, (-X - x) / dx);
  if (dy > 1e-4) t = Math.min(t, (Yy - y) / dy); else if (dy < -1e-4) t = Math.min(t, (-Yy - y) / dy);
  return clamp(t, 8, 60);
}
// distance from p to the beam (lamp L, unit direction d, length len): returns how far inside its catch radius
// p is (> 0 means caught)
function inBeam(px, py, pz, L, d, len) {
  vB.set(px - L.x, py - L.y, pz - L.z);
  const along = vB.dot(d);
  if (along < 0 || along > len) return -1;
  vB.addScaledVector(d, -along);
  const r = beamR(along, len);
  return r * CATCH_K + SHIP_CORE - vB.length();
}

function setBeam(fx, L, d, len, rFar, col, op, flat) {
  for (const [m, k, o] of [[fx.haze, 1.9, 0.22], [fx.halo, 1, 0.6], [fx.core, 0.36, 0.95]]) {
    m.material.uniforms.uFlat.value = flat ? 0.5 : 0; m.material.uniforms.uEnd.value = flat ? 0 : 1;
    // a hunter's beam has no haze: seen nearly end-on, its wide end would fill the screen
    m.visible = op > 0.004 && !(flat && m === fx.haze);
    m.position.copy(L);
    m.quaternion.setFromUnitVectors(Y, d);
    m.scale.set(rFar * k, len, rFar * k);
    m.material.uniforms.uCol.value.copy(col);
    m.material.uniforms.uOp.value = op * o;
  }
}

export default defineEnemy({
  name: 'searchlight-sentry',
  // rule 12: a sweeping beam is in view from the read line; a hunter's pool must cross at least the box's half-height
  // and then hold you for HUNT_DWELL; its bolt flies BOLT_T after a BOLT_TEL tell
  hazard: { cls: 'sweep', introduced: 8, warn: (ev, v) => (ev.mode === 'hunt' ? Math.min(4.1 / ((ev.hunt && ev.hunt.slew) || 4) + HUNT_DWELL, BOLT_T + BOLT_TEL) : READ_D / Math.max(1, v)) },
  killPts: 1500,
  sample: { mode: 'hunt', nx: 0.4, ny: 1.6, hunt: { slew: 4 } },
  // only a hunter far enough ahead can be hit; a sweeper is past before anything could reach it
  targetable: (e) => e.mode === 'hunt' && e.z < -20 && !e.dark,
  spawn(e, ev, api) {
    e.obj = api.course.get('searchlight-sentry', () => make(api));
    e.fx = fxPool.pop() || fxMake(api);
    e.mode = ev.mode || 'sweep'; e.sw = ev.sweep || null; e.hn = ev.hunt || { slew: 4 };
    e.sx = e.sy = e.sz = SCALE; e.r = 1.6; e.hitR = 2.0; e.hp = 1; e.ship = api.ship; e.box = api.box;
    e.caught = false; e.dark = false; e.dwell = 0; e.tel = -1; e.fired = false; e.flash = 0; e.done = false;
    e.spot = null; e.spotOp = 0; e.aimK = 0; e.lamp = new THREE.Vector3(); e.dir = new THREE.Vector3(1, 0, 0); e.len = 20;
    // stand the sentry on its perch with its up toward the lane: wall lamps lean in sideways, the others stand
    // up or hang down
    const B = api.box, nx = (ev.nx ?? -1.3), ny = (ev.ny ?? 0);
    const wall = Math.abs(nx) > 1 && Math.abs(nx) - 1 >= Math.abs(ny) - 1;
    const up = wall ? [-Math.sign(nx), 0] : [0, -Math.sign(ny) || 1];
    e.obj.quaternion.setFromUnitVectors(Y, vA.set(up[0], up[1], 0));
    // the dish's rest aim, before it has a beam: across the lane
    e.rest = Math.atan2(up[1], up[0]);
    const ud = e.obj.userData;
    ud.own.lamp.color.setHex(0xfff0d0); ud.own.core.color.setHex(0xff3355);
    if (ev.warm) { e.x = nx * B.x; e.y = ny * B.y; }
  },
  update(e, dt, api) {
    const ud = e.obj.userData, fx = e.fx, ship = api.ship, box = api.box;
    api.pose(e);
    e.obj.updateMatrixWorld(true);
    ud.head.getWorldPosition(e.lamp);
    const vis = e.appear * (e.dark ? 0 : 1);
    // ---- where the beam points
    let col = PALE, op = vis, len = 20;
    if (e.mode === 'sweep') {
      if (e.caught) { const dx = ship.x - e.lamp.x, dy = ship.y - e.lamp.y, n = Math.hypot(dx, dy) || 1; e.dir.set(dx / n, dy / n, 0); len = Math.min(60, n + 4); }
      else { const [dx, dy] = beamDir(e.sw, e.z, box); e.dir.set(dx, dy, 0); len = reach(e.lamp.x, e.lamp.y, dx, dy, box); }
      // nothing blinds the camera: the beam thins away as it passes the ship
      op *= 1 - smoothstep(-5, 2.5, e.z);
      if (!e.caught && !e.done && e.z > -7 && !e.ev.warm) {
        // swept test: the lamp moved from pz to z this frame; check four points of that
        let hit = false;
        for (let i = 1; i <= 4 && !hit; i++) { const zz = e.pz + (e.z - e.pz) * i / 4; vL.set(e.lamp.x, e.lamp.y, zz); if (inBeam(ship.x, ship.y, 0, vL, e.dir, len) > 0) hit = true; }
        if (hit) catchShip(e, api);
        else if (e.z > 0.5) { e.done = true; unseen(e, api); }
      }
    } else {
      huntStep(e, dt, api);
      // idle, it searches the dark ahead and above the lane, swaying, so you see a hunter coming
      vD.set(Math.sin(e.t * 0.8 + e.id) * 0.45, 0.32 + 0.12 * Math.sin(e.t * 0.5 + e.id * 2), -0.85).normalize(); len = 34;
      if (e.spot) {
        vB.set(e.spot.x - e.lamp.x, e.spot.y - e.lamp.y, -1.2 - e.lamp.z); const pl = vB.length(); vB.divideScalar(pl || 1);
        const k = smoothstep(0, 1, e.aimK);
        e.dir.copy(vD).lerp(vB, k).normalize(); len = 34 + (pl - 34) * k;
      } else e.dir.copy(vD);
      op *= 1 - smoothstep(-30, -6, e.z);
    }
    // ---- colour: pale, warming to red as a hunter's pool closes on you; red when it has you; the rim flashes
    if (e.caught) col = RED;
    else if (e.mode === 'hunt' && e.dwell > 0) col = tmpC.copy(PALE).lerp(RED, clamp(e.dwell / HUNT_DWELL, 0, 1));
    if (e.flash > 0) e.flash -= dt;
    const flashOn = e.flash > 0 && Math.sin(e.flash * 40) > 0;
    ud.own.core.color.setHex(flashOn ? 0xffffff : 0xff3355);
    ud.own.lamp.color.copy(e.dark ? tmpC.setHex(0x2a2730) : col === PALE ? PALE : col);
    // ---- aim the dish down the beam (in the sentry's own frame)
    qInv.copy(e.obj.quaternion).invert();
    vD.copy(e.dir).applyQuaternion(qInv);
    ud.head.quaternion.setFromUnitVectors(NZ, vD);
    // a hunter's beam starts a touch in front of its dish
    vL.copy(e.lamp).addScaledVector(e.dir, 0.9);
    const rFar = e.mode === 'hunt' && e.spot ? SPOT_R : beamR(len, len);
    const tel = e.tel >= 0 ? 0.5 + 0.5 * Math.sin(e.tel * 30) : 0;
    setBeam(fx, vL, e.dir, Math.max(1, len - 0.9), rFar, col, op * (e.caught ? 0.9 + 0.5 * tel : 1), e.mode === 'hunt' && !!e.spot);
    // ---- the glare: bright when the lamp faces the camera, always a little, so a lamp reads from far off
    // the camera rides 9.2 m behind and 2.8 m above the ship (main.js); near enough for the glare
    vB.set(e.lamp.x - ship.x * 0.62, e.lamp.y - ship.y * 0.62 - 2.8, e.lamp.z - 9.2).normalize();
    const facing = clamp(-e.dir.dot(vB), 0, 1);
    fx.glare.visible = vis > 0.01; fx.glare.position.copy(e.lamp).addScaledVector(e.dir, 0.4);
    fx.glare.material.color.copy(col); fx.glare.material.opacity = vis * (0.45 + 0.55 * facing * facing);
    // a lamp facing you reads from far off: the glare keeps some of its size on screen with distance
    fx.glare.scale.setScalar((3 + 9 * facing * facing + (e.caught ? 2 : 0)) * (1 + Math.max(0, -e.z) / 140));
    // ---- the pool
    if (e.spot && e.spotOp > 0.004) {
      fx.spot.visible = true; fx.spot.position.set(e.spot.x, e.spot.y, -1.2); fx.spot.scale.setScalar(SPOT_R);
      fx.spot.material.uniforms.uCol.value.copy(col); fx.spot.material.uniforms.uOp.value = e.spotOp * vis * 0.5;
    } else if (e.ev.warm) { // the loading screen compiles the pool's shader too, so the first hunt never stalls a frame
      fx.spot.visible = true; fx.spot.position.set(e.x, e.y, e.z); fx.spot.scale.setScalar(SPOT_R); fx.spot.material.uniforms.uOp.value = 0.001;
    } else fx.spot.visible = false;
    if (e.z > 14) e.alive = false;
  },
  onKill(e, byShot, api) {
    // the light goes out: the lamp dies, its beam with it
    e.dark = true; note(e, 'out');
    api.game.pop('LIGHTS OUT', e.lamp.x, e.lamp.y + 2, e.lamp.z, 'big');
  },
  remove(e, api) {
    const fx = e.fx;
    if (fx) { for (const m of [fx.haze, fx.halo, fx.core, fx.spot, fx.glare]) m.visible = false; fxPool.push(fx); e.fx = null; }
    if (e.obj) api.course.put('searchlight-sentry', e.obj);
  },
  // the wave queue runs here, every frame, so a wave keeps launching after the lamp that called it has gone by
  begin(api) {
    const t = api.G ? api.G.time || 0 : 0;
    if (t < watch.lastT - 0.5) watch.reset();   // a new run
    watch.lastT = t;
    pump(api);
  },
  // the test pilot keeps out of the light: a sweeper's beam where it will be when it arrives, a hunter's pool
  avoid(e) {
    if (e.dark || e.caught || e.done || !e.ship) return null;
    if (e.mode === 'hunt') return e.spot && e.spotOp > 0.2 ? [{ x: e.spot.x, y: e.spot.y, r: SPOT_R + 1.8 }] : null;
    if (e.z < -110 || e.z > 0) return null;
    const [dx, dy] = beamDir(e.sw, 0, e.box), s = e.ship;
    const t = Math.max(0, dx * (s.x - e.lamp.x) + dy * (s.y - e.lamp.y));
    const r = beamR(t, reach(e.lamp.x, e.lamp.y, dx, dy, e.box)) * CATCH_K + SHIP_CORE + 1.4;
    return [{ x: e.lamp.x + dx * t, y: e.lamp.y + dy * t, r }];
  },
});

// ---- the hunt: the pool appears at the far side of the box from the ship and closes on it
function huntStep(e, dt, api) {
  const ship = api.ship, box = api.box;
  const active = e.z > -HUNT_FAR && e.z < -HUNT_NEAR && !e.dark && !e.ev.warm;
  if (active && !e.spot && !e.caught && !e.done) {
    e.spot = { x: -Math.sign(ship.x || 1) * box.x * 0.95, y: -Math.sign(ship.y || 1) * box.y * 0.85 };
    if (e.ev.hunt && e.ev.hunt.from) e.spot = { x: e.ev.hunt.from[0] * box.x, y: e.ev.hunt.from[1] * box.y };
    e.aimK = 0;
  }
  if (!e.spot) return;
  // the lamp swings down out of the sky onto the lane (SWING s), and the pool forms where it lands; when its
  // watch is over it swings back up the same way
  if (!active) {
    e.aimK = Math.max(0, e.aimK - dt / SWING); e.spotOp = smoothstep(0.6, 1, e.aimK);
    if (e.aimK <= 0) { e.spot = null; if (!e.caught && !e.done && !e.dark) unseen(e, api); e.done = true; }
    return;
  }
  e.aimK = Math.min(1, e.aimK + dt / SWING); e.spotOp = smoothstep(0.6, 1, e.aimK);
  if (e.aimK < 1 && !e.caught) return;
  if (e.caught) {
    // it has you: the pool rides on the ship
    e.spot.x += (ship.x - e.spot.x) * Math.min(1, dt * 12); e.spot.y += (ship.y - e.spot.y) * Math.min(1, dt * 12);
    if (e.tel >= 0) {
      e.tel += dt;
      if (e.tel >= BOLT_TEL) {
        e.tel = -1; e.fired = true;
        vL.copy(e.lamp).addScaledVector(e.dir, 1.2);
        api.fire({ x: vL.x, y: vL.y, z: vL.z }, clamp(ship.x + ship.vx * 0.3, -box.x, box.x), clamp(ship.y + ship.vy * 0.3, -box.y, box.y), { T: BOLT_T, owner: e });
      }
    }
    return;
  }
  const dx = ship.x - e.spot.x, dy = ship.y - e.spot.y, d = Math.hypot(dx, dy);
  const step = Math.min(d, (e.hn.slew || 4) * dt);
  if (d > 1e-3) { e.spot.x += dx / d * step; e.spot.y += dy / d * step; }
  const inside = Math.hypot(ship.x - e.spot.x, ship.y - e.spot.y) < SPOT_R * CATCH_K + SHIP_CORE * 0.5;
  e.dwell = inside ? e.dwell + dt : Math.max(0, e.dwell - dt * 2);
  if (e.dwell >= HUNT_DWELL) { catchShip(e, api); e.tel = 0; }
}

function unseen(e, api) {
  note(e, 'unseen');
  const g = api.game;
  g.score(200 * (g.mult || 1), api.ship.x, api.ship.y + 1.6, 0, '', 'UNSEEN');
}

// ---- caught: the alarm, and the wave it calls
const pending = [];
let waveSide = 1;
function catchShip(e, api) {
  if (e.caught) return;
  e.caught = true; e.flash = 1.2; note(e, 'caught');
  const g = api.game;
  g.call('SPOTTED!', 'c-red');
  g.sfx('searchlight-alarm', { pan: clamp(e.lamp.x / api.box.x, -1, 1) * 0.5 });
  g.shake(0.25);
  const W = e.ev.wave || { shrikes: 1 };
  let delay = 0.35;
  for (let i = 0; i < (W.shrikes || 0); i++) {
    pending.push({ t: delay, ev: { type: 'shrike', side: waveSide, ny: (i % 2 ? -0.45 : 0.5) * (waveSide > 0 ? 1 : -1), shots: W.shots || 3, wave: true } });
    waveSide = -waveSide; delay += 0.55;
  }
  for (let i = 0; i < (W.pods || 0); i++) {
    pending.push({ t: 0.2 + i * 0.3, ev: { type: 'pod', nx: clamp(-api.ship.x / api.box.x * 0.6 + (i - (W.pods - 1) / 2) * 0.7, -0.8, 0.8), ny: 0.25 + 0.35 * (i % 2), drift: 0, bursts: 1, shots: W.shots || 2, wave: true }, line: true });
  }
}
function pump(api) {
  if (!pending.length) return;
  const dt = api.dt || 0;
  if (api.G && api.G.state && api.G.state !== 'play') { pending.length = 0; return; }
  for (let i = pending.length - 1; i >= 0; i--) {
    const p = pending[i];
    p.t -= dt;
    if (p.t > 0) continue;
    pending.splice(i, 1);
    let live = 0; for (const x of api.course.list) if (x.alive && x.ev && x.ev.wave) live++;
    if (live >= WAVE_CAP) continue;
    api.spawn(p.ev, -SPAWN_D);
  }
}
export const _test = { pending, sweepAngle, inBeam };
