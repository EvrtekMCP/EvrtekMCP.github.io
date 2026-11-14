// THE BLOOMER (galaxy 2, level 7 Bloomfall; the plan 3.7). A grafted anemone-flower on a drifting stalk (Yori's
// bloomer(open) and seedBolt(crack), mesh.js). It fires ONE thing: a fat, slow seed-bolt.
//   - the tell: its petals open and the seed at its heart brightens (0.6 s), then it fires;
//   - the seed flies 1.6 s to your plane, but about 60% of the way in its skin cracks white along five lines (0.4 s)
//     and it BURSTS into a fan of five bolts, about 5 m wide;
//   - ROLL THE SEED EARLY, as it cracks (or just before): one clean answer, the seed goes home and the graft cracks
//     (NIPPED IN THE BUD!, a counter: style, GREED, an echo home);
//   - LET IT BLOOM: five ordinary bolts. Roll in their middle for MULTI-DEFLECT x5 (big points, more risk), or dodge wide.
// The same shot asks a different question depending on when you answer it, and greedy players wait.
// The seed is the engine's own shot (so it flashes at the muzzle, trails, warns off screen and counts as fire); its
// steer() runs the crack, the early catch and the bloom, so it blooms on time even if its bloomer is already freed.
// Freed (a sent-back shot reaches it): the red falls away and it goes silver, drifting up and out (the Deep's grammar).
//   add(d, 'g2-bloomer', { nx, ny, fireAt: 290, seeds: 1, gap: 1.2, mode: 'at' | 'wide', aim: { nx, ny }, s: 1.2 })
//   fireAt: metres out it fires its first seed; seeds: how many; gap: seconds between; mode 'wide' aims 6 m off
//   (harmless: the lesson's seed); aim: a fixed point on your plane to aim at instead of you.
import { THREE, defineEnemy, clamp, DEFLECT_R } from '../../api.js?v=0.6.4';
import { MESH } from './mesh.js?v=0.6.4';
import { morphModel, setMorph, setLook } from './morph.js?v=0.6.4';

export const SEED = { T: 1.6, bloomAt: 0.6, crack: 0.4, tell: 0.6, fanN: 5, fanW: 4.4, size: 1.6 };
// how close to the seed's line the ship must be for an early roll to take it: the roll's reach, plus a little (a
// seed is fat); the Mirror Shell's reach counts
const catchR = (api) => (api.ship.deflectR || DEFLECT_R) + 1.0;

function makeBloomer() {
  const m = morphModel(MESH.shut, MESH.open);
  // her bloomer faces -Z; the ship meets a thing's +z side first, so it is turned half round to face you, and tipped
  // toward you a little so its petals opening reads from behind the ship
  m.group.rotation.set(0.55, Math.PI, 0);
  const g = new THREE.Group(); g.add(m.group);
  // the seed at its heart glows red through the haze, and swells as the petals open (the tell, by light)
  const core = new THREE.Sprite(glowMat.clone()); core.position.set(0, 0.75, 0.4); core.scale.set(2.6, 2.6, 1); g.add(core);
  g.userData.model = m; g.userData.core = core;
  return g;
}
let glowMat = null;
function makeSeed(api) {
  const m = morphModel(MESH.crack, null);
  const g = new THREE.Group(); g.add(m.group); g.scale.setScalar(SEED.size);
  const glow = new THREE.Sprite(glowMat.clone()); glow.scale.set(2.4, 2.4, 1); g.add(glow);
  g.userData = { model: m, white: m.meshes.find((x) => x.key === '#ffffff*'), glow };
  return g;
}

// every seed in flight that a bloomer fired: its shot and the mesh drawn on it
const live = [];
let seedId = 1;

// the seed's own flight, run by the engine every frame (steer): the crack, the early catch, the bloom
function seedSteer(s, dt, api) {
  if (s.sim) return;                              // the dotted preview simulates the flight: change nothing
  const q = s.tag; if (!q || q.done) return;
  const tb = s.T * SEED.bloomAt, tc0 = tb - SEED.crack;
  q.crack = clamp((s.age - tc0) / SEED.crack, 0, 1);
  // the early roll: from a moment before the crack shows until it bursts, with the ship on the seed's line
  if (s.age >= tc0 - 0.2 && s.age < tb && api.ship.rolling && Math.hypot(api.ship.x - q.tx, api.ship.y - q.ty) < catchR(api)) {
    q.done = true; s.alive = false;
    const b = q.from && q.from.alive && !q.from.freed ? q.from : null;
    api.game.counter({ label: 'NIPPED IN THE BUD!', target: b, pts: 220, greed: 10, shake: 0.25 });
    api.game.burst(s.x, s.y, s.z, 26, { speed: 9, life: 0.4, s0: 1.1, r: 0.33, g: 0.9, b: 1, carry: 0, drag: 2 });
    return;
  }
  if (s.age >= tb) {
    // BLOOM: five bolts fanned across where the seed was going, arriving when the seed would have
    q.done = true; s.alive = false;
    const left = Math.max(0.36, s.T - s.age), n = SEED.fanN;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1) - 0.5;
      api.fire(s, q.tx + k * SEED.fanW, q.ty, { T: left, noEase: true, owner: q.from && q.from.alive ? q.from : s.owner, tag: { bloom: q.id } });
    }
    api.game.sfx('g2-bloom', { vol: clamp(1 - (-s.z) / 420, 0.3, 1) });
    api.game.burst(s.x, s.y, s.z, 30, { speed: 7, life: 0.45, s0: 1.2, r: 1, g: 0.85, b: 0.92, carry: 0, drag: 2 });
  }
}

export default defineEnemy({
  name: 'g2-bloomer',
  // the seed is its shot: 1.6 s of flight to your plane, after a 0.6 s tell (the petals open). The fan is the seed's
  // second half (it arrives when the seed would have), so the seed's flight is its warning.
  hazard: { cls: 'shot', introduced: [2, 7], shotT: SEED.T, tel: SEED.tell },
  killPts: 1200,
  sample: { nx: 0, ny: 0 },
  init(api) {
    glowMat = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6 });
  },
  // the seeds are drawn after every kind has moved and before the shots do, so each is put where its shot will be
  // this frame. A seed whose shot is gone (it bloomed, was caught, or the run restarted) gives its mesh back.
  end(api) {
    const dt = api.dt || 0;
    for (let i = live.length - 1; i >= 0; i--) {
      const r = live[i], s = r.s;
      if (!s.alive || !api.course.shots.includes(s)) { api.course.put('g2-seed', r.obj); live.splice(i, 1); continue; }
      const u = r.obj.userData, k = s.tag.crack || 0, born = Math.min(1, s.age / 0.18);
      r.obj.position.set(s.x + s.vx * dt, s.y + s.vy * dt, s.z + s.vz * dt);
      r.obj.scale.setScalar(SEED.size * born * (1 + 0.12 * k * Math.sin(s.age * 40)));
      r.obj.rotation.z += dt * 3; r.obj.rotation.x += dt * 1.3;
      u.white.mesh.material.opacity = k; u.white.mesh.visible = k > 0.01;
      u.glow.material.opacity = 0.35 + 0.5 * k;
    }
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('g2-bloomer', makeBloomer);
    const m = e.obj.userData.model; setMorph(m, 0); setLook(m, { opacity: 1 }); e.obj.userData.core.material.opacity = 0.35;
    e.s = ev.s || 1.6; e.sx = e.sy = e.sz = e.s; e.r = 1.2 * e.s; e.hitR = 1.4 * e.s;
    e.fireD = ev.fireAt ?? 290; e.n = ev.seeds ?? 1; e.gap = ev.gap ?? 1.2; e.mode = ev.mode || 'at'; e.aim = ev.aim || null;
    e.fired = 0; e.clock = -1; e.open = 0; e.freed = 0; e.dead = false; e.hit = false;
    e.ph = (e.id % 9) * 0.7; e.x0 = e.x; e.y0 = e.y;
  },
  update(e, dt, api) {
    const m = e.obj.userData.model;
    if (e.freed) {
      // freed: silver, the graft gone, darting up and away; it leaves once it has faded
      e.freed += dt; const k = clamp(e.freed / 0.35, 0, 1);
      e.y += dt * 6 * k; e.x += dt * 2 * Math.sign(e.x || 1) * k; e.z -= dt * 30 * k;
      setLook(m, { opacity: 1 - clamp((e.freed - 0.6) / 0.6, 0, 1), silver: k, red: 1 - k });
      e.obj.userData.core.material.opacity = 0.6 * (1 - k);
      api.pose(e);
      if (e.freed > 1.2 || e.z > 12) e.alive = false;
      return;
    }
    // it drifts on its stalk, a slow sway
    e.x = e.x0 + Math.sin(e.t * 0.7 + e.ph) * 0.35; e.y = e.y0 + Math.sin(e.t * 0.5 + e.ph * 1.3) * 0.25;
    const v = Math.max(1, api.v);
    if (e.clock < 0 && e.n > 0 && e.z >= -(e.fireD + SEED.tell * v)) e.clock = 0;
    if (e.clock >= 0) {
      e.clock += dt;
      const tf = SEED.tell + e.fired * e.gap;           // the next seed's moment
      if (e.fired < e.n) {
        e.open = Math.max(e.open - dt * 2, clamp(1 - (tf - e.clock) / SEED.tell, 0, 1));
        if (e.clock >= tf) { e.fired++; if (e.z < -90) fireSeed(e, api); }
      } else e.open = Math.max(0, e.open - dt * 2);
    }
    setMorph(m, e.open);
    const core = e.obj.userData.core; core.material.opacity = 0.35 + 0.6 * e.open; core.scale.setScalar(2.2 + 2.4 * e.open);
    api.pose(e);
    // flying into its bulb is a small hit
    // (its bulb is 0.75 x its scale across from the middle: the hit is a touch inside it, rule 14)
    if (e.crossed && !e.hit && Math.hypot(api.ship.x - e.x, api.ship.y - e.y) < 0.7 * e.s + 0.3) { e.hit = true; api.game.crash(e, 12, true); }
    if (e.z > 12) e.alive = false;
  },
  // the loading screen compiles a bloomer and a seed together (a seed's first flight must not stall the frame)
  warm(api) {
    const b = api.course.get('g2-bloomer', makeBloomer), s = api.course.get('g2-seed', () => makeSeed(api));
    b.position.set(-2, 0, -40); b.scale.setScalar(1.2); s.position.set(2, 0, -40); s.scale.setScalar(SEED.size);
    s.userData.white.mesh.visible = true; s.userData.white.mesh.material.opacity = 1;
    return () => { api.course.put('g2-bloomer', b); api.course.put('g2-seed', s); };
  },
  targetable: (e) => !e.freed,
  // a sent-back shot (or an early roll's echo) reaching it: the graft cracks and it is set free
  onShot(e, s, api) {
    if (e.freed) return;
    api.game.kill(e, true);                               // (the engine frees a g2- creature: g2-graft-crack, FREED!)
    e.freed = 0.001; e.dead = true; e.alive = true;
  },
  avoid(e) { return e.freed ? [] : [{ x: e.x, y: e.y, r: 0.7 * e.s + 1.3 }]; },
  // the bots: be on a seed's line, and roll as it cracks
  rollAsk(e, api) {
    const out = [];
    for (const r of live) {
      const s = r.s, q = s.tag; if (q.from !== e || q.done || q.mode === 'wide' || !s.alive) continue;
      const tc0 = s.T * SEED.bloomAt - SEED.crack;
      // no `go`: a seed is aimed where you are, so a pilot rolls it from where it flies (it never leaves the rings for it)
      out.push({ t: tc0 + 0.1 - s.age, x: q.tx, y: q.ty, r: catchR(api) * 0.9, key: q.id });
    }
    return out;
  },
});

function fireSeed(e, api) {
  const ship = api.ship, box = api.box;
  let tx, ty;
  if (e.aim) { tx = e.aim.nx * box.x; ty = e.aim.ny * box.y; }
  else if (e.mode === 'wide') { const side = ship.x > 0 ? -1 : 1; tx = ship.x + side * 6.5; ty = ship.y + 1.2; }
  else { tx = clamp(ship.x + ship.vx * 0.3, -box.x, box.x); ty = clamp(ship.y + ship.vy * 0.3, -box.y, box.y); }
  const from = { x: e.x, y: e.y + 0.85 * e.s, z: e.z };
  const q = { id: seedId++, from: e, tx, ty, mode: e.mode, crack: 0, done: false };
  const s = api.fire(from, tx, ty, { T: SEED.T, owner: e, steer: seedSteer, tag: q });
  live.push({ s, obj: api.course.get('g2-seed', () => makeSeed(api)) });
  api.game.sfx('fire', { rate: 0.7, vol: 0.6 });
}
export { live as seedsInFlight };
