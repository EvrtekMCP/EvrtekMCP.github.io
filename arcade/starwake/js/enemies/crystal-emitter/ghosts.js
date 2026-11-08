// LEVEL 9: GHOST BOLTS, the Mirror Field's lies (Yori's sheet: "only the real bolt glows; ghosts are flat pink").
// A ghost is a reflection of a bolt: a flat, hollow pink ring at 40 %, no glow, no trail, flickering, and it passes
// straight through the ship. The real bolt is the engine's own shot (a bright capsule with a trail), so the two
// differ in shape, brightness and motion, not only in colour (Quorra rule 8). Ghosts are drawn here, never added
// to the engine's shots: they cannot hit, graze or be deflected, and the autopilot never sees them.
// Reading them pays: a ghost that passes through you while you hold your roll scores READ IT; rolling at one
// shows FOOLED (no penalty but the roll you spent).
import { THREE } from '../../api.js?v=0.4.1';
import { ringTex } from './parts.js?v=0.4.1';

const CAP = 96, PINK = new THREE.Color(0xff9ad0);
const list = [];
let pts = null, aPos, aCol, lastTime = 0;

function init(api) {
  if (pts) return;
  const g = new THREE.BufferGeometry();
  aPos = new THREE.BufferAttribute(new Float32Array(CAP * 3), 3).setUsage(THREE.DynamicDrawUsage);
  aCol = new THREE.BufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', aPos); g.setAttribute('color', aCol); g.setDrawRange(0, 0);
  const m = new THREE.PointsMaterial({ size: 1.55, map: ringTex(), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true });
  pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 3;
  api.scene.add(pts);
}

export const Ghosts = {
  // a ghost from (x, y, z) to (tx, ty) on the ship's plane, arriving in T s; hidden for `hide` s (still inside the
  // bolt it splits from); `ghostTwin` ghosts come from the boss's phantoms
  fire(api, x, y, z, tx, ty, T, hide = 0) {
    init(api);
    if (list.length >= CAP) return null;
    const g = { x, y, z, vx: (tx - x) / T, vy: (ty - y) / T, vz: -z / T, age: 0, hide, passed: false, alive: true };
    list.push(g);
    return g;
  },
  clear() { list.length = 0; if (pts) pts.geometry.setDrawRange(0, 0); },
  get count() { return list.length; },
  // called once per frame by the crystal emitter kind (its end()), so it runs whenever level 9's course runs
  update(api) {
    if (!pts) return;
    const dt = api.dt || 0, ship = api.ship;
    // a restarted run (the clock went back) or a run that is over: no ghosts carry across
    const st = api.G && api.G.state;
    if (api.time < lastTime - 0.25 || st === 'title' || st === 'end' || st === 'loading') list.length = 0;
    lastTime = api.time;
    let n = 0;
    const flick = 0.75 + 0.25 * Math.sin(api.time * 47) * Math.sin(api.time * 13);
    for (let i = list.length - 1; i >= 0; i--) {
      const g = list[i];
      g.age += dt;
      const pz = g.z;
      g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
      if (pz < 0 && g.z >= 0 && !g.passed) {
        g.passed = true;
        const d = Math.hypot(ship.x - g.x, ship.y - g.y);
        if (d < 2.4) {
          // it goes through you: a pink shimmer, and the read is scored
          api.game.burst(ship.x, ship.y, 0, 10, { speed: 7, life: 0.35, s0: 1.0, r: 1, g: 0.6, b: 0.82, carry: 0, drag: 2 });
          if (api.game.rolling) api.game.pop('FOOLED', ship.x, ship.y + 1.6, 0, 'red');
          else api.game.score(150, ship.x, ship.y + 1.6, 0, '', 'READ IT');
        }
      }
      if (g.z > 10) { list[i] = list[list.length - 1]; list.pop(); continue; }
      if (g.age < g.hide || n >= CAP) continue;
      // fade in after the split; thin out over the last 6 m so it never fills the lens as it passes through you
      const fadeIn = Math.min(1, (g.age - g.hide) / 0.12), past = g.z > -6 ? Math.max(0, -g.z / 6) * 0.7 + 0.1 : 1;
      aPos.setXYZ(n, g.x, g.y, g.z);
      aCol.setXYZW(n, PINK.r, PINK.g, PINK.b, 0.55 * flick * fadeIn * past);
      n++;
    }
    pts.geometry.setDrawRange(0, n);
    aPos.needsUpdate = aCol.needsUpdate = true;
  },
};
