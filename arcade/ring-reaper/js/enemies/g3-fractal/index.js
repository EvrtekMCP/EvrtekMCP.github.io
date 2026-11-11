// THE FRACTAL (galaxy 3, level 8 on: the Fractal Yard's headline). Yori's geometric drone, a triangle of triangles with
// a red core (g3-enemies.js fractal(gen)); the red inner triangle on its face is the shape it will split into. The plan
// (4.8): "Fractal drones split in two when their own fire comes home."
//   SPLIT       send its bolt home and it splits into two of the next generation: one, then two, then four. Each
//               generation is 0.6 the size, its core hotter, its bolt quicker, and it is worth more.
//   LEAVE IT    and after its bolts it drifts away, back into the haze.
//   FAIR        every fractal bolt in the air lands at least 1.0 s after the last one (a roll and its recharge), unless
//               two siblings are told to fire as a PAIR: then they land together and one roll takes both. Never all
//               at once, and never more than CAP pieces up at a time (rule 15).
//   FRACTAL CLEAR  every piece of one fractal sent home (seven, for the usual three generations): a bonus.
//
// Event: { nx, ny       its station, normalised (inside the box is fine: it never comes near you)
//          hold 158     metres ahead it hovers (never under 155)
//          depth 2      how many times it splits (2: 1 + 2 + 4 = 7 pieces; 3: 15, the Yard's cascade)
//          shots 2      bolts the first generation fires (each child fires one, a second if it is left alone)
//          tame         its children never fire: they spin and drift off (the first one you meet)
//          pair         siblings fire together (the cascade: "children firing from every side")
//          wide         children fly apart across the lane instead of close by
//          kidShots 2   bolts each child fires if it is left alone
//          first        the first one you meet: a slower bolt
//          from {x,y,z} born at a point instead of out of the haze (the Breeder's release): it grows in as it leaves
//          big 1        size }
import { THREE, defineEnemy, buildModel, clamp, damp, SPAWN_D } from '../../api.js?v=0.6.3';
import { MESH } from './mesh.js?v=0.6.3';
import { bookNote } from '../g3-riveter/clock.js?v=0.6.3';

const IN = 2.8, SCALE = 2.5, CAP = 8, TEL = 0.5;
const T_GEN = [1.15, 1.05, 0.95, 0.9], GAP_GEN = [2.0, 1.7, 1.45, 1.3], PTS_GEN = [0, 500, 1000, 1500];
const MESHES = [MESH.gen0, MESH.gen1, MESH.gen2, MESH.gen3];
const RED = new THREE.Color(0xff3355), HOT = new THREE.Color(0xfff0e8);
const FAM = new Map();
let lastRun = -1, famN = 0, bloomMat = null;
const pieces = (depth, gen) => (1 << (depth - gen + 1)) - 1; // a piece of generation gen and everything it can split into

function make(api, gen) {
  const g = new THREE.Group(), inner = new THREE.Group(); inner.rotation.y = Math.PI; g.add(inner); // her face (the plan, the inner triangle) toward you
  const m = buildModel(MESHES[gen]); inner.add(m.group);
  const bloom = new THREE.Sprite(bloomMat.clone()); bloom.scale.setScalar(1.6); inner.add(bloom);
  g.userData = { inner, bloom };
  return g;
}

export default defineEnemy({
  name: 'g3-fractal',
  motion: 'own', spawnAt: 'now',
  // the quickest bolt is the third generation's (0.9 s, x the level's ease.shot) plus its 0.5 s tell
  hazard: { cls: 'shot', introduced: [3, 8], shotT: 0.9, tel: TEL },
  killPts: 800,
  sample: { nx: 0, ny: 0.3 },
  targetable: (e) => e.phase === 1,
  init(api) { bloomMat = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.4 }); },
  // shaders for every generation, warmed on the loading screen
  warm(api) {
    const objs = [0, 1, 2, 3].map((g) => { const o = make(api, g); o.position.set(-6 + g * 4, 0, -50); api.scene.add(o); return o; });
    return () => { for (const o of objs) api.scene.remove(o); };
  },
  spawn(e, ev, api) {
    if (api.time < lastRun) FAM.clear(); lastRun = api.time;
    const B = api.box;
    e.gen = ev.gen || 0; e.depth = ev.depth ?? 2; e.child = !!ev.child; e.bigK = ev.big || 1;
    e.obj = api.course.get('g3-fractal-' + e.gen, () => make(api, e.gen));
    e.hold = ev.hold || 158;   // never under 155: a split is born where its parent hangs, and nothing appears inside 150 m
    e.from = null;
    if (e.child) { e.x0 = ev.x; e.y0 = ev.y; e.hx = ev.hx; e.hy = ev.hy; e.x = e.x0; e.y = e.y0; e.z = ev.z; e.family = ev.family; e.hold = -ev.z; }
    else {
      e.hx = (ev.nx ?? 0) * B.x; e.hy = (ev.ny ?? 0.3) * B.y; e.x0 = e.hx * 1.6; e.y0 = e.hy + 8; e.x = e.x0; e.y = e.y0; e.z = -SPAWN_D;
      // born from a point (the Breeder releasing one): it grows in as it leaves her and flies to its station
      if (ev.from) { e.from = ev.from; e.x0 = e.x = ev.from.x; e.y0 = e.y = ev.from.y; e.z = ev.from.z; e.grow = 0; }
      e.family = ++famN; FAM.set(e.family, { need: pieces(e.depth, 0), got: 0, spoiled: !!ev.tame, x: 0, y: 0, z: 0 });
    }
    e.T = T_GEN[Math.min(3, e.gen)] + (ev.first ? 0.35 : 0); e.gap = GAP_GEN[Math.min(3, e.gen)];
    e.shots = e.gen === 0 ? (ev.shots ?? 2) : (ev.tame ? 0 : ev.kidShots ?? 2); e.fired = 0; e.slot = null; e.lastShot = 0;
    e.wait = e.child ? 0.45 + (ev.stagger || 0) : 0.6;
    e.phase = 0; e.t = 0; e.grow = e.child || e.from ? 0 : 1; e.spin = (e.id % 5) * 1.3; e.heat = 0;
    e.r = 1.6 * Math.pow(0.6, e.gen) * e.bigK + 0.6; e.hitR = e.r + 0.4;
    e.sx = e.sy = e.sz = SCALE * e.bigK;
    e.obj.userData.bloom.material.opacity = 0.4; e.obj.userData.bloom.material.color.copy(RED);
    if (e.grow === 0) e.appear = 0;   // the engine poses a new thing right after spawn: a split grows from nothing, even on that first frame
  },
  update(e, dt, api) {
    const ud = e.obj.userData, ship = api.ship;
    if (e.phase === 0) {
      if (e.child) {
        // out of the split: it grows from nothing as it slides to its own station
        const k = Math.min(1, e.t / 0.35), ease = 1 - (1 - k) * (1 - k);
        e.grow = k * k * (3 - 2 * k); e.x = e.x0 + (e.hx - e.x0) * ease; e.y = e.y0 + (e.hy - e.y0) * ease;
        if (k >= 1) { e.phase = 1; e.t = 0; }
      } else if (e.from) {
        const k = Math.min(1, e.t / 1.8), ease = 1 - (1 - k) * (1 - k);
        e.grow = Math.min(1, e.t / 0.45); e.grow = e.grow * e.grow * (3 - 2 * e.grow);
        e.z = e.from.z + (-e.hold - e.from.z) * ease; e.x = e.x0 + (e.hx - e.x0) * ease; e.y = e.y0 + (e.hy - e.y0) * ease;
        if (k >= 1) { e.phase = 1; e.t = 0; }
      } else {
        const k = Math.min(1, e.t / IN), ease = 1 - (1 - k) * (1 - k);
        e.z = -SPAWN_D + (SPAWN_D - e.hold) * ease;
        e.x = e.x0 + (e.hx - e.x0) * ease; e.y = e.y0 + (e.hy - e.y0) * ease;
        if (k >= 1) { e.phase = 1; e.t = 0; }
      }
    } else if (e.phase === 1) {
      e.z = -e.hold + Math.sin(e.t * 1.9 + e.id) * 1.5;
      e.x = damp(e.x, e.hx + Math.sin(e.t * 0.9 + e.id) * 0.4, 2, dt); e.y = damp(e.y, e.hy, 2, dt);
      // its next bolt: booked on the shared clock, then telegraphed, then fired so it lands on its slot
      if (!e.slot && e.fired < e.shots && e.t >= e.wait) e.slot = book(e, api, api.time + TEL + e.T * api.ease.shot);
      if (e.slot) {
        const fireAt = e.slot - e.T * api.ease.shot;
        e.heat = clamp(1 - (fireAt - api.time) / TEL, 0, 1);
        if (api.time >= fireAt) { shoot(e, api); e.slot = null; e.fired++; e.wait = e.t + e.gap; e.heat = 0; e.lastShot = e.t; }
      }
      const done = e.shots === 0 ? e.t > 1.8 : e.fired >= e.shots && !e.slot && e.t > e.lastShot + 1.0;
      if (done || e.t > 11) { e.phase = 2; e.t = 0; e.vz = 0; e.escaped = true; const f = FAM.get(e.family); if (f) f.spoiled = true; }
    } else {
      // left alone: it drifts away, up and back into the haze
      e.vz = Math.min(300, e.vz + dt * 200);
      e.z -= e.vz * dt; e.y += 4 * dt; e.x += Math.sign(e.x || 1) * 3 * dt;
      if (e.z < -SPAWN_D) e.alive = false;
    }
    e.spin += dt * (0.7 + 6 * e.heat);
    ud.inner.rotation.z = e.spin;
    ud.bloom.material.color.copy(RED).lerp(HOT, e.heat * e.heat);
    ud.bloom.material.opacity = 0.4 + 0.6 * e.heat; ud.bloom.scale.setScalar(1.4 + 3 * e.heat);
    e.appear = api.appear(e.z) * e.grow;
    api.pose(e);
  },
  remove(e, api) { if (e.obj) api.course.put('g3-fractal-' + e.gen, e.obj); },
  // its own bolt (or any sent-back shot) reaching it: a split, or the last generation's end
  onKill(e, byShot, api) {
    if (!byShot) return;
    const f = FAM.get(e.family);
    if (f) f.got++;
    if (PTS_GEN[e.gen]) api.game.score(PTS_GEN[e.gen], e.x, e.y + 3, e.z, 'big');
    if (e.gen < e.depth) split(e, api, f);
    if (f && !f.spoiled && f.got >= f.need) {
      api.game.call('FRACTAL CLEAR', 'c-cyan');
      api.game.sfx('g3-fractal-clear', { vol: 0.9 });
      api.game.bonus('FRACTAL CLEAR', 4000 * f.need);
      api.game.score(1500 * f.need, e.x, e.y + 4, e.z, 'big', 'FRACTAL CLEAR');
      FAM.delete(e.family);
    }
  },
});

// two of the next generation, where it was; never more than CAP pieces up (a split past the cap pays as if cleared)
function split(e, api, f) {
  const B = api.box, ev = e.ev, g = e.gen + 1, live = api.course.list.filter((q) => q.type === 'g3-fractal' && q.alive && q.phase !== 2).length;
  api.game.sfx('g3-split', { vol: 0.8, pan: clamp(e.x / B.x * 0.5, -0.8, 0.8) });
  const sp = (ev.spread || 2.6) * Math.pow(0.75, e.gen) * e.bigK;
  const vertical = g % 2 === 0;
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1;
    if (live + i >= CAP) { if (f) f.got += pieces(e.depth, g); continue; }
    let hx, hy;
    if (ev.wide) { hx = clamp(e.hx * 0.3 + s * B.x * (0.4 + 0.18 * g), -B.x * 0.9, B.x * 0.9); hy = clamp(e.hy + (g % 2 ? -1 : 1) * B.y * 0.25 * (i ? 1 : -1), -B.y * 0.85, B.y * 0.9); }
    else { hx = clamp(e.hx + (vertical ? 0.3 * s : s * sp), -B.x * 0.88, B.x * 0.88); hy = clamp(e.hy + (vertical ? s * sp * 0.8 : 0.2), -B.y * 0.85, B.y * 0.9); }
    api.spawn({ type: 'g3-fractal', child: true, gen: g, depth: e.depth, family: e.family, tame: ev.tame, pair: ev.pair, wide: ev.wide, spread: ev.spread, big: ev.big, kidShots: ev.kidShots,
      stagger: ev.pair ? 0 : i * 0.9, x: e.x, y: e.y, z: e.z, hx, hy, pairKey: ev.pair ? e.family + ':' + g + ':' + e.id : null }, e.z);
  }
}

// the guns' shared ledger (the riveter's clock.js): a bolt lands MIN_GAP clear of every other gun's, or with its pair
const book = (e, api, want) => bookNote(api, want, e.ev.pairKey ? e.ev.pairKey + ':' + e.fired : null);

function shoot(e, api) {
  const B = api.box, ship = api.ship, lead = 0.2;
  const tx = clamp(ship.x + ship.vx * lead, -B.x, B.x), ty = clamp(ship.y + ship.vy * lead, -B.y, B.y);
  api.fire({ x: e.x, y: e.y, z: e.z + 1 }, tx, ty, { T: e.T, owner: e, tag: 'fractal' });
}
