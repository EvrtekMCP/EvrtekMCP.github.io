// THE HOUND (galaxy 2, THE MIGRATION's enemy): a lean, six-finned grafted hunter (Yori's hound) that runs with the
// herd at the lane's edge and fires slow bolts (1.8 s) at the calf, ACROSS your lane. Fly into a bolt's path and roll
// for INTERCEPT!: the bolt goes home and cracks the hound's graft (the red falls away and a silver hound darts off).
// Fly into one without rolling and you take a small hit instead of the calf; let it through and the calf flinches.
// Its effect: shots you used to dodge become shots you chase, so the player hunts for danger.
// Its tell (her hound(1)): the muzzle node and the eyes go white-hot and it turns its head to the lane.
//   add(d, 'g2-hound', { side: 1, ny: 0, shots: ['calf', 'calf'], gap: 2.2 })
//     d       where it has run in beside you (it comes out of the haze for FLY seconds before that)
//     side    the lane edge it runs on (+1 right, -1 left); ny its height in the box
//     shots   what each bolt is aimed at, in order: 'calf', or 'ship' (a plain bolt at you, across from the edge);
//             'calf' with no calf beside you fires at you instead
//     gap     seconds between bolts; wait: seconds on station before the first tell (0.4)
//     flank   how far from the calf's middle its bolts land (1.8; the crossfire uses its flanks, 2.6)
//     first   the teaching hound: a longer tell, a slower bolt, and its bolt can only ever graze you
// Each bolt is timed to cross the middle of the lane HOUND.cross seconds after its tell starts (see crossAfter).
import { THREE, defineEnemy, buildModel, clamp, damp, smoothstep, SPAWN_D } from '../../api.js?v=0.6.2';
import { MESH } from './mesh.js?v=0.6.2';
import { calfOf, calfAim, flinch } from '../../allies/g2-calf/index.js?v=0.6.2';
import { Freed } from '../../levels/g2/level4/freed.js?v=0.6.2';

export const HOUND = { fly: 2.6, z: -0.6, nx: 1.25, tel: 0.7, telFirst: 1.0, T: 1.8, TFirst: 2.1, wait: 0.4, gap: 2.2, dmg: 6, nose: 2.75 };
// seconds from its arrival beside you to the moment its n-th bolt crosses the middle of the lane (for laying rings on
// the intercept spot): the wait, the tell, the gaps, and about half the bolt's flight
export const crossAfter = (n = 0, o = {}) => (o.wait ?? HOUND.wait) + (o.first ? HOUND.telFirst : HOUND.tel) + n * (o.gap ?? HOUND.gap) + 0.5 * (o.first ? HOUND.TFirst : HOUND.T);

const RED = new THREE.Color(0xff3355), HOT = new THREE.Color(0xfff0f0);
const FREE = new Freed(MESH.freed);

function make(api) {
  const g = new THREE.Group();
  const m = buildModel(MESH.rest, { own: ['#ff3355*'] });
  g.add(m.group);
  const charge = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  charge.position.set(0, 0, -HOUND.nose); g.add(charge);
  g.userData = { red: m.mats['#ff3355*'], charge };
  return g;
}
// where its bolt leaves: the muzzle node at the tip of its nose, as it is turned
const muzzle = (e) => ({ x: e.x - Math.sin(e.yaw) * HOUND.nose * e.sx, y: e.y, z: e.z - Math.cos(e.yaw) * HOUND.nose * e.sx });

// for the bots (rollAsk): where each catchable bolt in the list passes nearest the ship's plane inside the box, and when
// it gets there: be there (go) and roll as it arrives. The whale (the Snare's mother) asks the same for bolts at her.
export function interceptAsks(bolts, api) {
  const out = [], B = api.box, ship = api.ship;
  for (const s of bolts) {
    if (!s.alive || s.reflected || s.met) continue;
    const rem = s.T - s.age; if (rem <= 0.02) continue;
    let best = null;
    for (let k = 1; k <= 20; k++) {
      const t = rem * k / 20, x = s.x + s.vx * t, y = s.y + s.vy * t, z = s.z + s.vz * t;
      if (Math.abs(x) > B.x * 0.95 || Math.abs(y) > B.y * 0.92) continue;
      const sc = Math.abs(x - ship.x) * 0.15 + Math.max(0, Math.abs(z) - 0.5) * 4;
      if (!best || sc < best.sc) best = { t, x, y, sc };
    }
    if (best) out.push({ t: best.t, x: best.x, y: best.y, r: 1.4, go: true, key: s.k ?? s.tag });
  }
  return out;
}

function fire(e, api) {
  const B = api.box, ship = api.ship, G = api.game, m = muzzle(e);
  const want = e.plan[e.n], c = want === 'calf' ? calfOf(api) : null;
  const T = e.first ? HOUND.TFirst : HOUND.T;
  let s;
  if (c) {
    const a = calfAim(c, e.x, e.flank);
    // its path lies on the ship's plane where it crosses the lane: the landing point's depth is chosen so that the
    // bolt is at z = -0.3 over the middle of the in-box stretch of its path (you can meet it anywhere along there)
    const xIn = e.side * B.x, xOut = clamp(a.x, -B.x, B.x), xm = (xIn + xOut) / 2;
    const f = (m.x - xm) / ((m.x - a.x) || 1);
    a.z = clamp(m.z + (-0.3 - m.z) / clamp(f, 0.2, 1), c.z - 5, c.z + 5);   // and on its body
    s = api.fire(m, 0, 0, { T, at: a, owner: e, label: 'INTERCEPT!', dmg: HOUND.dmg, tag: 'calf',
      onArrive: (sh) => { if (!sh.reflected && c.alive) flinch(c, api); } });
    if (e.first) s.tutor = true; // the teaching bolt only ever grazes you (the engine's tutor shot never hurts)
    s.k = e.n;
    e.bolts.push(s);
  } else {
    s = api.fire(m, clamp(ship.x + ship.vx * 0.25, -B.x, B.x), clamp(ship.y + ship.vy * 0.2, -B.y, B.y), { T: T - 0.2, owner: e });
  }
  G.sfx('g2-hound-bolt', { pan: clamp(e.x / B.x * 0.6, -0.6, 0.6) });
  e.n++; e.tel = -1; e.cool = e.gap;
}

export default defineEnemy({
  name: 'g2-hound',
  motion: 'own', spawnAt: 'now', lead: HOUND.fly,
  hazard: { cls: 'shot', introduced: [2, 4], shotT: HOUND.T, tel: HOUND.tel },
  killPts: 1500,
  sample: { side: 1, ny: 0 },
  targetable: (e) => e.phase === 1,
  begin(api) { FREE.tick(api); },
  spawn(e, ev, api) {
    const B = api.box;
    e.obj = api.course.get('g2-hound', () => make(api));
    e.side = ev.side ?? 1; e.first = !!ev.first;
    e.hx = e.side * (ev.nx ?? HOUND.nx) * B.x; e.hy = (ev.ny ?? 0) * B.y; e.hz = ev.z ?? HOUND.z;
    e.plan = (ev.shots || ['calf']).slice(); e.gap = ev.gap ?? HOUND.gap; e.flank = ev.flank ?? 1.8;
    e.n = 0; e.tel = -1; e.cool = ev.wait ?? HOUND.wait; e.phase = 0; e.yaw = 0; e.vz = 0;
    e.TEL = e.first ? HOUND.telFirst : HOUND.tel;
    e.x0 = e.hx * 1.7; e.y0 = e.hy + 5;
    e.x = ev.warm ? e.hx : e.x0; e.y = ev.warm ? e.hy : e.y0; e.z = ev.warm ? -40 : -SPAWN_D;
    if (ev.warm) e.phase = 1;
    e.r = 1.4; e.hitR = 1.7; e.sx = e.sy = e.sz = ev.s || 1;
    e.bolts = [];
    const u = e.obj.userData; u.red.color.copy(RED); u.charge.material.opacity = 0;
  },
  update(e, dt, api) {
    const u = e.obj.userData;
    if (e.phase === 0) {
      // out of the haze along its edge of the lane, slowing to run beside you
      const k = Math.min(1, e.t / HOUND.fly), ease = 1 - Math.pow(1 - k, 3);
      e.z = -SPAWN_D + (SPAWN_D + e.hz) * ease;
      e.x = e.x0 + (e.hx - e.x0) * ease; e.y = e.y0 + (e.hy - e.y0) * ease;
      if (k >= 1) { e.phase = 1; e.t = 0; }
    } else if (e.phase === 1) {
      // it lopes beside you
      e.x = e.hx + Math.sin(e.t * 2.1) * 0.25; e.y = e.hy + Math.sin(e.t * 3.3) * 0.2; e.z = e.hz + Math.sin(e.t * 1.3) * 0.3;
      e.cool -= dt;
      if (e.tel < 0 && e.cool <= 0 && e.n < e.plan.length) { e.tel = 0; api.game.sfx('fire', { rate: 0.55, vol: 0.3, pan: clamp(e.x / api.box.x * 0.6, -0.6, 0.6) }); }
      if (e.tel >= 0) {
        e.tel += dt;
        const k = Math.min(1, e.tel / e.TEL);
        e.yaw = damp(e.yaw, e.side * 0.75, 6, dt);                       // it turns its head to the lane
        u.red.color.copy(RED).lerp(HOT, smoothstep(0.35, 1, k));         // the muzzle node and the eyes go white-hot
        u.charge.material.opacity = 0.2 + 0.8 * k * (0.75 + 0.25 * Math.sin(e.tel * 40));
        u.charge.scale.setScalar(1.2 + 3 * k);
        if (e.tel >= e.TEL) { fire(e, api); u.red.color.copy(RED); }
      } else {
        e.yaw = damp(e.yaw, 0, 3, dt);
        u.charge.material.opacity = damp(u.charge.material.opacity, 0, 6, dt);
      }
      // its bolts spent: it peels away ahead, back into the haze (never vanishing in plain view)
      if (e.n >= e.plan.length && e.cool <= e.gap - 1.2) { e.phase = 2; e.t = 0; }
    } else {
      e.vz = Math.min(170, e.vz + dt * 120);
      e.z -= e.vz * dt; e.x += e.side * 5 * dt; e.y += 1.5 * dt;
      e.yaw = damp(e.yaw, -e.side * 0.2, 2, dt);
      u.charge.material.opacity = 0;
      if (e.z < -SPAWN_D) e.alive = false;
    }
    e.appear = api.appear(e.z);
    api.pose(e);
    e.obj.rotation.set(0, e.yaw, Math.sin(e.t * 2.1) * 0.08 - e.side * 0.1);
  },
  // an INTERCEPT goes home to the hound that fired it, running beside you
  redirect(e, s, api) {
    if (s && s.tag === 'calf') api.game.sfx('g2-intercept', { gap: 0.05 });
    return e.alive && !e.dead ? e : undefined;
  },
  onKill(e, byShot, api) {
    FREE.spawn(api, e, { side: e.side, out: 5, vz: 25, s: e.sx });
    // (the graft-crack sound is the engine's now: galaxies 4d1e242)
  },
  // the bots: be where a bolt at the calf crosses your lane, near the ship's plane, and roll as it gets there
  rollAsk(e, api) { return interceptAsks(e.bolts, api); },
});
