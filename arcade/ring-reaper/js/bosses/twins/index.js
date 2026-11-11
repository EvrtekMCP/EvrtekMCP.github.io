// THE TWINS (level 9 mini-boss): Yori's boss-09. Two mirrored crescent ships that also reflect. Each has a red core
// at the crescent's heart and a MIRROR PLATE hinged in front of it: plate UP (a white flash) means wait, anything sent
// back bounces off it and comes at you again; plate DOWN means the core is bare (it glows), send it back NOW.
// Damage only from your own reflected bolts (rules 25-26). Three phases (rule 24), each with a new thing and a tell:
//   1 MIRROR GUARD  they take turns: drop the plate, fire a pair at you, snap the plate up, then drop it again for
//                   about a second, just when your send-back arrives. Learn the plate: white wait, red now.
//   2 CROSS VOLLEY  a white thread joins them (0.5 s), one fires into the OTHER's raised plate and the bolt comes
//                   at you off it, from the side you weren't watching (the bank shot the Hall of Mirrors taught).
//                   Send it back and it goes home to the shooter, whose core is bare. Then the SCISSOR PASS: red
//                   bands mark two heights, the twins dive through your plane at them and swap sides; thread the gap.
//   3 GHOST SPLIT   the field shows four twins: two are pink phantoms with no core glow, and their bolts are ghosts
//                   that arrive first. The real two fire after. The level's lesson, one last time. (Shortest phase.)
// The rhythm is the music's: the Twins' track is 136 bpm, a bar is 1.765 s, and every loop is whole bars (rule 28).
import { THREE, defineBoss, SPAWN_D, clamp } from '../../api.js?v=0.6.1';
import { TWIN } from './mesh.js?v=0.6.1';
import { buildParts } from '../../enemies/crystal-emitter/parts.js?v=0.6.1';
import { Ghosts } from '../../enemies/crystal-emitter/ghosts.js?v=0.6.1';
import hull, { hullState } from './hull.js?v=0.6.1';

const BAR = 240 / 136, GAP = 4.6, SCALE = 1.3, HOLD = 48;
const CORE_Z = -0.7 * SCALE, MUZZLE_Z = -1.25 * SCALE, PLATE = [0, 0.25, -0.5];
const tmpV = new THREE.Vector3();
const ghostMat = new THREE.MeshBasicMaterial({ color: 0xff9ad0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });

// one twin: holder (moves in the boss's space) > flip (turns her -Z front to the ship) > her parts; the plate on a
// pivot at her hinge (0, 1.45, 0.1), turned exactly as her twin(side, guard) turns it
function makeTwin(side, phantom) {
  const holder = new THREE.Group(), flip = new THREE.Group(); flip.rotation.y = Math.PI; flip.scale.setScalar(SCALE); holder.add(flip);
  const m = buildParts(TWIN[side > 0 ? 'right' : 'left'], { own: phantom ? [] : ['horns:#ff3355*', 'core:#ff3355*', 'plate:#f4f8ff*'] });
  if (phantom) m.group.traverse((o) => { if (o.isMesh) o.material = ghostMat; });
  const plate = m.parts.plate; m.group.remove(plate);
  const pivot = new THREE.Group(); pivot.position.set(0, 1.45, 0.1); pivot.add(plate); m.group.add(pivot);
  flip.add(m.group);
  return { holder, pivot, side, phantom, horns: m.mats['horns:#ff3355*'], core: m.mats['core:#ff3355*'], plateMat: m.mats['plate:#f4f8ff*'],
    guard: 1, want: 1, flash: 0, dead: false, hp: 1, home: new THREE.Vector3(), world: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), mv: 1, chase: 0, closeT: 0 };
}
// a thin white beam (the cross-volley thread) and a red carrier glow, in the boss's space
function beam(color, r) {
  const g = new THREE.CylinderGeometry(r, r, 1, 5, 1); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.5);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
}
const setBeam = (m, a, b, op) => { m.position.copy(a); m.scale.set(1, 1, Math.max(0.01, a.distanceTo(b))); m.lookAt(b); m.material.opacity = op; m.visible = op > 0.004; };

// ---- positions, in the boss's space (its root sits HOLD m ahead)
const coreOf = (t, out) => out.set(t.holder.position.x, t.holder.position.y, t.holder.position.z + CORE_Z);
const muzzleOf = (t, out) => out.set(t.holder.position.x, t.holder.position.y, t.holder.position.z + MUZZLE_Z);
const plateOf = (t, out) => out.set(t.holder.position.x + PLATE[0], t.holder.position.y + PLATE[1], t.holder.position.z + PLATE[2]);
const toWorld = (b, v) => b.root.localToWorld(v);
const aim = (api, lead = 0.3) => [clamp(api.ship.x + api.ship.vx * lead, -api.box.x, api.box.x), clamp(api.ship.y + api.ship.vy * lead, -api.box.y, api.box.y)];
const live = (b, i) => b.weak[i] && b.weak[i].hp > 0;

// ---- attacks (each a pattern step: the framework telegraphs it at its muzzle first)
function aimed(i, n = 2, T = 1.35) {
  return (b, api) => {
    if (!live(b, i)) return;
    for (let k = 0; k < n; k++) b.later(k * 0.22, () => { const t = b.tw[i]; const p = toWorld(b, muzzleOf(t, tmpV)); const [tx, ty] = aim(api); api.fire({ x: p.x, y: p.y, z: p.z }, tx, ty, { T, owner: b }); });
    api.game.sfx('fire', { rate: 0.8, vol: 0.7, pan: b.tw[i].holder.position.x / 8 });
  };
}
// i fires into j's raised plate; the bolt comes off it at you. With j gone, i fires straight.
function cross(i, j, n = 2) {
  return (b, api) => {
    if (!live(b, i)) return;
    if (!live(b, j)) { aimed(i, n, 1.3)(b, api); return; }
    for (let k = 0; k < n; k++) b.later(k * 0.2, () => { // 0.2 s apart: one well-timed roll returns the pair (MULTI-DEFLECT)
      b.carry = { i, j, t: 0 };
      b.later(0.22, () => { const p = toWorld(b, plateOf(b.tw[j], tmpV)); const [tx, ty] = aim(api, 0.25); api.fire({ x: p.x, y: p.y, z: p.z }, tx, ty, { T: 1.3, owner: b }); b.tw[j].flash = 1; api.game.sfx('fire', { rate: 1.35, vol: 0.6 }); });
    });
  };
}
// the ghost split: each real twin fires a real bolt, its phantom a ghost pair that lands 0.5 s earlier
function split(i, T = 1.4) {
  return (b, api) => {
    const ph = b.ph[i];
    if (ph && b.phantomsOn) { const p = toWorld(b, muzzleOf(ph, tmpV)); const [tx, ty] = aim(api, 0); Ghosts.fire(api, p.x, p.y, p.z, tx - 0.5, ty + 0.3, T - 0.5, 0); Ghosts.fire(api, p.x, p.y, p.z, tx + 0.5, ty - 0.3, T - 0.5, 0); }
    aimed(i, 2, T)(b, api);
  };
}

// ---- the plate schedule per phase: 1 = up (guarded), 0 = down (core bare). u = time into the phase's loop
function guardP1(i, u) { const o = ((u - i * 2 * BAR) % (4 * BAR) + 4 * BAR) % (4 * BAR); return o < 1.2 ? 0 : o < 2.05 ? 1 : o < 3.2 ? 0 : 1; }
function guardP2(i, u) { const o = ((u - i * 2 * BAR) % (8 * BAR) + 8 * BAR) % (8 * BAR); return o < 3.4 ? 0 : 1; }
function guardP3(i, u) { const f = 1.3 + i * BAR, o = u - f; return o >= -0.9 && o < 0.3 ? 0 : o >= 0.3 && o < 1.25 ? 1 : o >= 1.25 && o < 2.45 ? 0 : 1; }
// phase 3's corner dance: the four ships take the four corners, the real two in a new pair of corners each loop
const CORNERS = [[-5.2, 2.2], [5.2, 2.2], [-5.2, -1.8], [5.2, -1.8]];
const DEALS = [[0, 3, 1, 2], [2, 1, 0, 3], [1, 2, 3, 0], [3, 0, 2, 1]]; // [real0, real1, phantom0, phantom1]

export default defineBoss({
  name: 'twins', title: 'THE TWINS',
  hold: HOLD, scale: 1, y: 0.5, enterTime: 4.5,
  bonus: 80000, hitPts: 3000,
  downCall: 'THE TWINS SHATTER!', pointDown: 'TWIN DOWN!',
  build(api, b) {
    const root = new THREE.Group();
    b.tw = [makeTwin(-1, false), makeTwin(1, false)];
    b.ph = [makeTwin(-1, true), makeTwin(1, true)];
    b.tw[0].home.set(GAP, 0, 0); b.tw[1].home.set(-GAP, 0, 0);   // her pair as seen from the front
    for (const t of b.tw) { t.holder.position.copy(t.home); t.mv = 1; t.from.copy(t.home); t.to.copy(t.home); root.add(t.holder); }
    for (const p of b.ph) { p.holder.visible = false; root.add(p.holder); }
    b.thread = beam(0xffffff, 0.08); b.carrier = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    b.carrier.scale.setScalar(3.4);
    b.flashes = b.tw.map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); s.scale.setScalar(7); root.add(s); return s; });
    // the scissor pass's two guide bands: red lines across the lane at the heights the twins will pass
    // the scissor pass's tell: two red sheets from the twins to your plane, at the heights they will sweep through
    // (sheets, not lines: in perspective a sheet shows its height against your ship all the way along)
    b.bands = [0, 1].map(() => { const g = new THREE.BoxGeometry(1, 0.9, 1); g.translate(0, 0, -0.5); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.visible = false; root.add(m); return m; });
    root.add(b.thread, b.carrier);
    return {
      root,
      weak: b.tw.map((t) => ({ at: [t.home.x, t.home.y, CORE_Z], r: 1.5, hp: 8 })),
      muzzles: b.tw.map((t) => [t.home.x, t.home.y, MUZZLE_Z]),
    };
  },
  enter(b, api) {
    hullState.boss = b;
    api.spawn({ type: 'twins-hull' }, b.z);
    b.phantomsOn = false; b.dive = null; b.loops = 0;
  },
  exposed(b, w) { const t = b.tw[w.i]; return !t.dead && t.guard < 0.3 && !b.dive; },
  phases: [
    { name: 'MIRROR GUARD', until: 0.75, loop: 4 * BAR,
      pattern: [{ at: 0.9, attack: aimed(0), tel: 0.9, from: 0 }, { at: 2 * BAR + 0.9, attack: aimed(1), tel: 0.9, from: 1 }],
      guard: guardP1 },
    { name: 'CROSS VOLLEY', until: 0.3125, loop: 8 * BAR,
      pattern: [{ at: 0.9, attack: cross(0, 1), tel: 0.9, from: 0 }, { at: 2 * BAR + 0.9, attack: cross(1, 0), tel: 0.9, from: 1 }],
      guard: guardP2,
      enter(b) { b.loops = 0; },
      update(b, dt, api) {
        // the thread joins shooter and mirror for the last 0.5 s of each cross volley's charge
        const u = b.loopT;
        for (const [i, j, at] of [[0, 1, 0.9], [1, 0, 2 * BAR + 0.9]]) if (u > at - 0.5 && u < at + 0.25 && live(b, i) && live(b, j)) b.threadOn = { i, j, k: clamp((u - (at - 0.5)) / 0.5, 0, 1) };
        // bar 4: the scissor pass
        if (!b.dive && u >= 4 * BAR && u < 4 * BAR + 0.2 && b.state === 'fight') startDive(b, api);
      } },
    { name: 'GHOST SPLIT', loop: 4 * BAR,
      pattern: [{ at: 1.3, attack: split(0), tel: 0.9, from: 0 }, { at: 1.3 + BAR, attack: split(1), tel: 0.9, from: 1 }],
      guard: guardP3,
      enter(b, api) { b.phantomsOn = true; b.phantomT = 0; b.loops = 0; api.game.flash(); deal(b, 0); },
      update(b) { if (b.loopT < b.lastLoopT) { b.loops++; deal(b, b.loops); } b.lastLoopT = b.loopT; } },
  ],
  update(b, dt, api) {
    const ph = b.phase, u = b.loopT;
    // the plates: snap up fast (a white flash), drop more slowly
    for (let i = 0; i < 2; i++) {
      const t = b.tw[i]; if (t.dead) continue;
      const want = b.state !== 'fight' || b.dive ? 1 : ph.guard ? ph.guard(i, u) : 1;
      if (want > t.want) { t.flash = Math.max(t.flash, 1); api.game.sfx('deflect', { rate: 1.6, vol: 0.25, pan: t.holder.position.x / 8 }); }
      t.want = want;
      t.guard += (want - t.guard) * Math.min(1, dt * (want > t.guard ? 18 : 9));
      t.pivot.rotation.x = -0.1 - (1 - t.guard) * Math.PI / 2;
      t.flash = Math.max(0, t.flash - dt * 3.5);
      b.flashes[i].position.copy(plateOf(t, tmpV)); b.flashes[i].material.opacity = t.flash * 0.9; b.flashes[i].visible = t.flash > 0.005;
      // the bare core burns brighter; the horns chase red horn to horn before a dive
      const bare = 1 - t.guard;
      t.core.color.setRGB(1, 0.2 + 0.5 * bare * (0.5 + 0.5 * Math.sin(b.t * 14)), 0.33 + 0.3 * bare);
      const chase = t.chase > 0 ? 0.5 + 0.5 * Math.sin(b.t * 30 + i * 3) : 0;
      t.horns.color.setRGB(1, 0.2 + 0.8 * chase, 0.33 + 0.67 * chase);
    }
    moveTwins(b, dt, api);
    // weak points and muzzle glows follow the twins (her `at` arrays are read by the framework every frame)
    for (let i = 0; i < 2; i++) {
      const t = b.tw[i], w = b.weak[i]; coreOf(t, tmpV); w.at[0] = tmpV.x; w.at[1] = tmpV.y; w.at[2] = tmpV.z; w.glow.position.copy(tmpV);
      if (b.glows[i]) b.glows[i].position.copy(muzzleOf(t, tmpV));
      t.world.copy(t.holder.position); toWorld(b, t.world);
    }
    // the thread and the carrier (cross volley)
    if (b.threadOn) { const { i, j, k } = b.threadOn; setBeam(b.thread, coreOf(b.tw[i], new THREE.Vector3()), plateOf(b.tw[j], new THREE.Vector3()), (0.3 + 0.7 * k) * (0.75 + 0.25 * Math.sin(b.t * 50))); }
    else setBeam(b.thread, tmpV.set(0, 0, 0), tmpV, 0);
    b.threadOn = null; // the phase's update (run by the framework before this) sets it again next frame
    if (b.carry) {
      b.carry.t += dt; const k = Math.min(1, b.carry.t / 0.22), a = coreOf(b.tw[b.carry.i], new THREE.Vector3()), c = plateOf(b.tw[b.carry.j], new THREE.Vector3());
      b.carrier.position.lerpVectors(a, c, k); b.carrier.material.opacity = 1;
      if (k >= 1) b.carry = null;
    } else b.carrier.material.opacity = 0;
    b.carrier.visible = b.carrier.material.opacity > 0;
    // phantoms (phase 3): pink, 40 %, no core glow
    ghostMat.opacity = b.phantomsOn && b.state === 'fight' ? 0.4 * Math.min(1, (b.phantomT = (b.phantomT || 0) + dt) / 0.6) * (0.85 + 0.15 * Math.sin(b.t * 23)) : Math.max(0, ghostMat.opacity - dt);
    for (const p of b.ph) { p.holder.visible = ghostMat.opacity > 0.01; p.pivot.rotation.x = -0.1; }
    // the rally: a send-back that reaches a raised plate bounces off it and comes at you again (Yori's MIRROR GUARD)
    rally(b, api);
    hullState.boss = b.alive ? b : null;
  },
  onWeakDown(b, w, api) {
    const t = b.tw[w.i]; t.dead = true;
    const p = t.world; api.game.burst(p.x, p.y, p.z, 90, { speed: 22, life: 0.9, s0: 2.2, r: 0.85, g: 0.75, b: 1, carry: 0, drag: 1.4 });
    t.holder.visible = false; b.flashes[w.i].visible = false; if (b.ph[w.i]) b.ph[w.i].holder.visible = false;
  },
  defeat(b) { b.phantomsOn = false; hullState.boss = null; },
});
// the twins glide between where they were and where they are going (station, corners, the dive)
function moveTwins(b, dt, api) {
  if (b.dive) { diveFrame(b, dt, api); return; }
  for (const set of [b.tw, b.ph]) for (const t of set) {
    if (t.mv < 1) { t.mv = Math.min(1, t.mv + dt / 0.9); const k = t.mv * t.mv * (3 - 2 * t.mv); t.holder.position.lerpVectors(t.from, t.to, k); }
    // a slow figure-of-eight sway: alive, but readable
    const s = set === b.tw ? 1 : -1;
    t.holder.position.y += Math.sin(b.t * 1.1 + (t.side > 0 ? 0 : Math.PI)) * 0.006 * s;
    t.holder.rotation.z = (t.to.x - t.holder.position.x) * -0.05;
  }
}
function deal(b, n) {
  const d = DEALS[n % DEALS.length];
  const go = (t, c) => { t.from.copy(t.holder.position); t.to.set(CORNERS[c][0], CORNERS[c][1], 0); t.mv = 0; };
  go(b.tw[0], d[0]); go(b.tw[1], d[1]); go(b.ph[0], d[2]); go(b.ph[1], d[3]);
  if (n === 0) { b.ph[0].holder.position.copy(b.tw[1].holder.position); b.ph[1].holder.position.copy(b.tw[0].holder.position); b.ph[0].from.copy(b.ph[0].holder.position); b.ph[1].from.copy(b.ph[1].holder.position); }
}
// ---- the SCISSOR PASS: 1.4 s of tell (bands + horn chase), a dive through your plane at two heights crossing,
// out behind you, then back in out of the haze to station on the other sides
// H: the two sweep heights. Each twin's cup and plate hang 1.4 below its crescent, so at 3.0 a slot about
// 1.8 m tall stays open in the middle (more at the sides): thread it.
const H = 3.0;
function startDive(b, api) {
  const up = b.tw[0].holder.position.x > 0 ? 1 : -1;
  b.dive = { t: 0, ys: [H * up, -H * up], x0: b.tw.map((t) => t.holder.position.x) };
  for (const t of b.tw) t.chase = 1;
  api.game.call('SCISSOR PASS', 'c-red');
}
function diveFrame(b, dt, api) {
  const D = b.dive; D.t += dt;
  const TELL = 1.4, IN = 1.15, OUT = 0.5, BACK = 2.6;
  // the bands: in your plane's space (the root moves, so counter its position)
  for (let i = 0; i < 2; i++) {
    const m = b.bands[i], on = D.t < TELL + IN;
    m.visible = on; m.material.opacity = on ? (0.09 + 0.13 * Math.abs(Math.sin(D.t * 9))) * Math.min(1, D.t / 0.3) : 0;
    // from your plane to wherever the twins are now, in the boss's own space (it moves during the dive)
    m.scale.set(api.box.x * 2.4, 1, Math.max(1, -b.z + 1)); m.position.set(0, D.ys[i] - b.y, 1 - b.z);
  }
  if (D.t < TELL) { // the twins rise and fall to their bands, still on station
    for (let i = 0; i < 2; i++) { const t = b.tw[i]; t.holder.position.y += (D.ys[i] - b.y - t.holder.position.y) * Math.min(1, dt * 4); }
    return;
  }
  const k = D.t - TELL;
  if (k < IN) { // the dive: the whole pair comes at you; they cross in x as they reach your plane
    const f = k / IN, e = f * f;
    b.z = -HOLD + (HOLD + 1) * e * 1.0;
    // they close on the middle as they come, so at your plane each covers the full red band it showed
    for (let i = 0; i < 2; i++) { const t = b.tw[i]; t.holder.position.x = D.x0[i] * (1 - e); t.holder.position.y = D.ys[i] - b.y; t.holder.rotation.z = -Math.sign(D.x0[i]) * 0.35 * Math.sin(f * Math.PI); }
    return;
  }
  if (k < IN + OUT) { b.z += 180 * dt; for (let i = 0; i < 2; i++) b.tw[i].holder.position.x -= D.x0[i] * dt * 2; return; } // gone past you, still crossing
  for (const m of b.bands) { m.visible = false; m.material.opacity = 0; m.scale.set(1, 1, 1); m.position.set(0, 0, 0); } // (and home: a hidden sheet still counts in the boss's bounds)
  if (!D.back) { D.back = true; b.z = -SPAWN_D - 10; for (let i = 0; i < 2; i++) { const t = b.tw[i]; t.home.x = -D.x0[i]; t.holder.position.set(t.home.x, 0, 0); t.from.copy(t.holder.position); t.to.copy(t.holder.position); t.mv = 1; t.chase = 0; t.holder.rotation.z = 0; } }
  const f = Math.min(1, (k - IN - OUT) / BACK), e = 1 - Math.pow(1 - f, 3);
  b.z = -SPAWN_D - 10 + (SPAWN_D + 10 - HOLD) * e;
  if (f >= 1) { b.z = -HOLD; b.dive = null; }
}
// a send-back homing on a guarded core: before it CLANGs, it bounces off the plate and comes at you again
function rally(b, api) {
  for (const s of api.course.shots) {
    if (!s.reflected || !s.alive || !s.target || s.target.kind.role !== 'weakpoint' || s.target.boss !== b) continue;
    const w = s.target.wp, t = b.tw[w.i];
    if (b.exposed(w)) continue;
    if (Math.hypot(s.x - s.target.x, s.y - s.target.y, s.z - s.target.z) > 6) continue;
    s.alive = false; t.flash = 1;
    const p = toWorld(b, plateOf(t, tmpV)); const [tx, ty] = aim(api, 0.2);
    api.fire({ x: p.x, y: p.y, z: p.z }, tx, ty, { T: 1.05, owner: b });
    api.game.pop('BOUNCED', p.x, p.y + 2, p.z, 'red'); api.game.sfx('deflect', { rate: 0.7, vol: 0.7 });
    api.game.burst(p.x, p.y, p.z, 16, { speed: 9, life: 0.35, s0: 1.4, r: 1, g: 1, b: 1, carry: 0 });
  }
}
export { hull };
