// THE CONDUCTOR (galaxy 2, level 9 The Murmuration; the plan 3.9). One moth among the flock with a red graft-core and red
// veins on its wings (Yori's conductor(flap), mesh.js): the only one that fires, in AIMED PAIRS. Its core swells red
// for 0.9 s first (the tell). Roll the pair home and it is freed; when a flock's last conductor is down, the flock
// scatters into drifting sparks, so the wall in front of you becomes snow.
// It rides its flock (the g2-flock with the same key), placed in the flock's plane at `at` (normalised), and holds
// with it when the flock flies with you (a tube). It fires on a clock that starts `first` seconds before it reaches
// you (or as its tube starts holding), one pair every `gap` seconds, `pairs` times.
//   add(d, 'g2-conductor', { flock: key, at: [nx, ny], dz: 0, first: 2.8, pairs: 1, gap: 1.6, hold })
//   (d and hold the same as its flock's, so the two move as one)
import { THREE, defineEnemy, clamp } from '../../api.js?v=0.6.4';
import { MESH } from './mesh.js?v=0.6.4';
import { morphModel, setMorph, setLook } from '../g2-bloomer/morph.js?v=0.6.4';
import { joined, conductorDown } from '../g2-flock/index.js?v=0.6.4';

const TEL = 0.9, SHOT_T = 1.3, PAIR_GAP = 0.18, SIZE = 1.8;
let glowMat = null;
function make() {
  const m = morphModel(MESH.down, MESH.up);
  m.group.rotation.y = Math.PI;                                  // nose toward you
  const g = new THREE.Group(); g.add(m.group);
  const core = new THREE.Sprite(glowMat.clone()); core.scale.set(2, 2, 1); g.add(core);
  g.userData = { model: m, core };
  return g;
}

export default defineEnemy({
  name: 'g2-conductor',
  motion: 'own',
  hazard: { cls: 'shot', introduced: [2, 9], shotT: SHOT_T, tel: TEL },
  killPts: 1500,
  sample: { at: [0, 0] },
  init(api) { glowMat = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5 }); },
  spawn(e, ev, api) {
    e.obj = api.course.get('g2-conductor', make);
    setLook(e.obj.userData.model, { opacity: 1 });
    e.flock = ev.flock ? api.course.list.filter((q) => q.type === 'g2-flock' && q.alive && q.key === ev.flock).pop() || null : null;
    if (e.flock) joined(e.flock);
    e.ox = (ev.at ? ev.at[0] : 0) * api.box.x; e.oy = (ev.at ? ev.at[1] : 0) * api.box.y; e.dz = ev.dz || 0;
    e.zb = e.z; e.z = e.zb + e.dz;
    e.first = ev.first ?? 2.8; e.pairs = ev.pairs ?? 1; e.gap = ev.gap ?? 1.6; e.hold = ev.hold || null;
    e.clock = -1; e.fired = 0; e.charge = 0; e.freed = 0; e.dead = false; e.r = 1.3; e.hitR = 1.6;
    e.sx = e.sy = e.sz = SIZE; e.held = 0; e.holding = false;
  },
  update(e, dt, api) {
    const v = Math.max(1, api.v), u = e.obj.userData;
    // ride the flock: stream with the track, and hold when the tube holds (the same rule, so they never part)
    e.zb += v * dt;
    if (e.hold) { if (!e.holding && e.held === 0 && e.zb >= e.hold.z) e.holding = true; if (e.holding) { e.zb -= v * dt; e.held += dt; if (e.held >= e.hold.secs + 1.6) e.holding = false; } }
    e.z = e.zb + e.dz;
    const f = e.flock;
    e.x = (f ? f.x : 0) + e.ox + Math.sin(e.t * 2.1 + e.id) * 0.25; e.y = (f ? f.y : 0) + e.oy + Math.cos(e.t * 1.7 + e.id) * 0.2;
    if (e.freed) {
      e.freed += dt; const k = clamp(e.freed / 0.3, 0, 1);
      e.y += dt * 5 * k; e.z -= dt * 20 * k; e.zb -= dt * 20 * k;
      setLook(u.model, { opacity: 1 - clamp((e.freed - 0.5) / 0.6, 0, 1), silver: k, red: 1 - k }); u.core.material.opacity = 0;
      setMorph(u.model, 0.5 + 0.5 * Math.sin(e.t * 22));
      api.pose(e);
      if (e.freed > 1.1) e.alive = false;
      return;
    }
    pairSecond(e, dt, api);
    // a scattered flock takes its conductor's nerve with it: it climbs away without firing
    if (f && f.scatter && !e.leaving) e.leaving = true;
    if (e.leaving) { e.y += dt * 4; e.zb -= dt * 30; }
    // the clock: starts `first` seconds before it reaches you, or as its tube starts holding
    // (a tube's conductor waits until its tube has wrapped round you)
    if (e.clock < 0 && !e.leaving && (e.hold ? e.holding && e.held > 0.8 : -e.z / v <= e.first + TEL)) e.clock = 0;
    if (e.clock >= 0 && !e.leaving) {
      e.clock += dt;
      const tf = TEL + e.fired * e.gap;
      if (e.fired < e.pairs) {
        e.charge = clamp(1 - (tf - e.clock) / TEL, 0, 1);
        if (e.clock >= tf) { e.fired++; e.charge = 0; if (e.z < -60) firePair(e, api); }
      }
    }
    setMorph(u.model, 0.5 + 0.5 * Math.sin(e.t * (12 + 6 * e.charge)));
    u.core.material.opacity = 0.35 + 0.65 * e.charge; u.core.scale.setScalar(1.6 + 3 * e.charge);
    api.pose(e);
    if (e.z > 12 || e.y > 40) e.alive = false;
  },
  targetable: (e) => !e.freed,
  onShot(e, s, api) {
    if (e.freed) return;
    api.game.kill(e, true);                               // (the engine frees a g2- creature: g2-graft-crack, FREED!)
    e.freed = 0.001; e.dead = true; e.alive = true;
    if (e.flock) conductorDown(e.flock, api);
  },
});

function firePair(e, api) {
  const ship = api.ship, box = api.box;
  const tx = clamp(ship.x + ship.vx * 0.3, -box.x, box.x), ty = clamp(ship.y + ship.vy * 0.3, -box.y, box.y);
  api.fire(e, tx - 0.35, ty, { T: SHOT_T, owner: e });
  // the second of the pair a beat behind (on the world's clock), so one roll answers both: MULTI-DEFLECT x2
  e.pending = { t: PAIR_GAP, tx: tx + 0.35, ty };
}
function pairSecond(e, dt, api) {
  const p = e.pending; if (!p) return;
  p.t -= dt; if (p.t > 0) return;
  e.pending = null;
  if (!e.freed && !e.leaving) api.fire(e, p.tx, p.ty, { T: SHOT_T, owner: e });
}
