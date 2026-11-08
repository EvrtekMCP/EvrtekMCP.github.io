// STARWAKE 0.2.0 (0.4.0: secondary targets, restore): the boss framework. A boss (defineBoss, one folder each in js/bosses/) is a body that flies
// in out of the haze, holds station ahead of the ship, and fights in PHASES. It has no armour you can shoot:
// the ONLY damage is your own deflect (Quorra rules 24-28):
//  - it always fires, on a pattern that repeats (learnable in 2-3 goes), and changes pattern each phase;
//  - its WEAK POINTS glow only while they can be hit (exposed); a reflected shot homes on a lit one;
//  - every attack is telegraphed (a charge glow at its muzzle, tel >= 0.8 s for anything reflectable);
//  - each phase starts with a tell (a call-out, a shake, and whatever the boss's enter() does);
//  - if it is not beaten in escapeAfter seconds it retreats, so a fight can never hang (rule 26).
// While a boss is up the course holds (no new course events), the scenery keeps streaming and its own music plays.
import * as THREE from '../vendor/three/three.module.min.js?v=0.4.1';
import { clamp } from './util.js?v=0.4.1';
import { defineEnemy, defineWeakPoint } from './registry.js?v=0.4.1';
import { SPAWN_D } from './space.js?v=0.4.1';

const tmpV = new THREE.Vector3();
// ---- attack helpers: (b, api, o) with o = the pattern step. `from` = a muzzle index (default 0).
const muzzle = (b, i) => { const m = b.muzzles[(i || 0) % b.muzzles.length]; tmpV.set(m[0], m[1], m[2]); b.root.localToWorld(tmpV); return { x: tmpV.x, y: tmpV.y, z: tmpV.z }; };
const aimAt = (api, lead = 0.3) => [clamp(api.ship.x + api.ship.vx * lead, -api.box.x, api.box.x), clamp(api.ship.y + api.ship.vy * lead, -api.box.y, api.box.y)];
export const ATTACKS = {
  // n shots at where the ship is heading, gap s apart, each T s to the ship's plane
  aimed(b, api, o) { for (let i = 0; i < (o.n || 1); i++) b.later(i * (o.gap ?? 0.18), () => { const [tx, ty] = aimAt(api); api.fire(muzzle(b, o.from), tx, ty, { T: o.T || 1.3, owner: b, noReflect: o.noReflect }); }); },
  // n shots fanned across `spread` metres around the ship, all at once
  fan(b, api, o) { const [tx, ty] = aimAt(api, 0.15), n = o.n || 5, w = o.spread || 6; for (let i = 0; i < n; i++) { const k = n > 1 ? i / (n - 1) - 0.5 : 0; api.fire(muzzle(b, o.from), clamp(tx + k * w, -api.box.x, api.box.x), ty, { T: o.T || 1.4, owner: b, noReflect: o.noReflect }); } },
  // n shots onto a circle of radius r around the ship: stay put and roll, or slip out
  ring(b, api, o) { const [tx, ty] = aimAt(api, 0), n = o.n || 6, r = o.r || 2.4; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; api.fire(muzzle(b, o.from), tx + Math.cos(a) * r, ty + Math.sin(a) * r, { T: o.T || 1.5, owner: b, noReflect: o.noReflect }); } },
};

// the weak points are course entities, so reflected shots find them like any target
export const weakPointKind = defineWeakPoint({
  name: 'weak-point',
  motion: 'own', spawnAt: 'now',
  spawn(e, ev) { e.boss = ev.boss; e.wp = ev.wp; e.r = ev.wp.r || 1.5; e.hitR = e.r; },
  update(e) { if (!e.boss.alive) e.alive = false; },
  onShot(e, s, api) { e.boss.hitWeak(e, s, api); e.alive = true; },
});

// the body: one internal kind runs every boss
export const bossKind = defineEnemy({
  name: 'boss-body',
  motion: 'own', spawnAt: 'now',
  targetable: () => false,
  // a shot sent back from a boss goes to its nearest lit weak point; if none is lit, to the nearest one (it
  // glances off: CLANG, no damage), so the player always sees where the shot went
  redirect(b) {
    let best = null, bd = 1e9, lit = false;
    for (const w of b.weak) {
      if (w.hp <= 0) continue;
      const on = b.exposed(w), d = Math.hypot(w.ent.x, w.ent.y, w.ent.z);
      if ((on && !lit) || (on === lit && d < bd)) { best = w.ent; bd = d; lit = on; }
    }
    return best;
  },
  spawn(b, ev, api) { setup(b, ev.def, api); },
  // the level's boss, built once in view on the loading screen so its shaders compile there
  warm(api) {
    const L = api.level; if (!L || !L.boss) return null;
    const fake = { later() {}, weak: [], muzzles: [] };
    const built = L.boss.def.build(api, fake);
    built.root.position.set(0, 0, -60); built.root.scale.setScalar(L.boss.def.scale || 1);
    api.scene.add(built.root);
    return () => api.scene.remove(built.root);
  },
  update(b, dt, api) { tick(b, dt, api); },
  remove(b, api) { if (b.root) { api.scene.remove(b.root); } },
});

function setup(b, def, api) {
  b.def = def; b.state = 'enter'; b.t = 0; b.fightT = 0; b.pi = 0; b.loopT = 0; b.queue = []; b.alive = true; b.r = 6;
  b.hold = def.hold || 80; b.x = 0; b.y = def.y || 0; b.z = -SPAWN_D;
  const built = def.build(api, b);
  b.root = built.root; b.muzzles = built.muzzles && built.muzzles.length ? built.muzzles : [[0, 0, 2]];
  api.scene.add(b.root);
  b.glows = b.muzzles.map((m) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); s.position.set(m[0], m[1], m[2]); b.root.add(s); return s; });
  b.weak = (built.weak || []).map((w, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: w.color || 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.15 }));
    s.position.set(w.at[0], w.at[1], w.at[2]); s.scale.setScalar((w.r || 1.5) * 2.2); b.root.add(s);
    const o = { i, at: w.at, r: w.r || 1.5, hp: w.hp || 3, max: w.hp || 3, glow: s, obj: w.obj || null, flash: 0, counts: w.counts !== false, call: w.call || null, tag: w.tag, color: w.color };
    o.ent = api.course.spawn({ type: 'weak-point', boss: b, wp: o }, b.z);
    return o;
  });
  // 0.4.0: a weak point with counts: false is a SECONDARY target (a keystone, a knot): it is hit like any other but is not
  // part of the health bar; knocking it out is the boss's cue (onWeakDown) to open the real one. restore(w, hp) rebuilds one.
  b.maxHp = b.weak.reduce((s, w) => s + (w.counts ? w.max : 0), 0) || 1;
  b.exposed = (w) => w.hp > 0 && (def.exposed ? !!def.exposed(b, w, api) : true);
  b.later = (sec, fn) => b.queue.push({ t: sec, fn });
  b.hp = () => b.weak.reduce((s, w) => s + (w.counts ? Math.max(0, w.hp) : 0), 0) / b.maxHp;
  b.restore = (w, hp) => { w.hp = Math.min(w.max, hp ?? w.max); if (w.obj) w.obj.visible = true; api.game.boss({ frac: b.hp() }); };
  b.hitWeak = (e, s, api2) => hit(b, e.wp, api2, s);
  b.phase = def.phases[0];
  b.freed = api.game.bossFreed ? api.game.bossFreed(def) : false; // 0.4.0: galaxy 2's bosses are freed, not destroyed
  api.game.boss({ show: true, title: def.title, frac: 1, phase: 0, phases: def.phases.length });
  if (def.enter) def.enter(b, api);
}

function tick(b, dt, api) {
  const def = b.def;
  b.t += dt;
  // fly in, out of the haze, decelerating onto station
  if (b.state === 'enter') {
    // eased at BOTH ends (lv-3's report: the old ease-out left the haze at ~300 m/s, so one long frame threw the
    // boss tens of metres in a step); it starts from rest, peaks mid-flight, and settles onto its station
    const T = def.enterTime || 4, k = Math.min(1, b.t / T), ease = k * k * k * (k * (k * 6 - 15) + 10);
    b.z = -SPAWN_D + (SPAWN_D - b.hold) * ease;
    if (k >= 1) { b.state = 'fight'; b.t = 0; startPhase(b, 0, api); }
  } else if (b.state === 'fight') {
    b.fightT += dt;
    runPattern(b, dt, api);
    watchdog(b, dt, api);
    if (def.escapeAfter && b.fightT > def.escapeAfter) { b.state = 'escape'; b.t = 0; api.game.call(def.escapeCall || 'IT GOT AWAY', 'c-red'); }
  } else if (b.state === 'escape') {
    b.z -= 120 * dt; b.y += 4 * dt;
    if (b.z < -SPAWN_D) { b.alive = false; api.game.bossEnd(false); }
  } else if (b.state === 'dying') {
    const T = def.defeatTime || 2.8;
    // 0.4.0 (g2-c): a FREED boss (galaxy 2) sheds pearl motes and plays g2-boss-freed; any other bursts and booms
    const freed = b.freed, c = freed ? { r: 0.9, g: 1, b: 0.94 } : { r: 1, g: 0.6, b: 0.25 }, c2 = freed ? { r: 0.8, g: 1, b: 0.9 } : { r: 1, g: 0.9, b: 0.7 };
    if (Math.random() < dt * 14) api.game.burst(b.x + (Math.random() - 0.5) * 14, b.y + (Math.random() - 0.5) * 10, b.z + (Math.random() - 0.5) * 6, 40, Object.assign({ speed: freed ? 12 : 18, life: freed ? 1.1 : 0.7, s0: 2.4, carry: 0, drag: 1.5 }, c));
    if (b.t > T) { b.alive = false; api.game.burst(b.x, b.y, b.z, 160, Object.assign({ speed: freed ? 20 : 30, life: freed ? 1.6 : 1.2, s0: 3, carry: 0, drag: 1.2 }, c2)); api.game.sfx(freed ? 'g2-boss-freed' : 'boom', freed ? { vol: 1 } : { vol: 1, rate: 0.7 }); api.game.bossEnd(true); }
  }
  // delayed shots
  for (let i = b.queue.length - 1; i >= 0; i--) { const q = b.queue[i]; q.t -= dt; if (q.t <= 0) { b.queue.splice(i, 1); if (b.state === 'fight') q.fn(); } }
  if (def.update) def.update(b, dt, api);
  // it grows in with distance AND with time since it was born: a fast fly-in (short enterTime) covers 20 m+ in its
  // first frame, which by distance alone would be a jump in size (lv-6's report, z -777)
  b.age = (b.age || 0) + dt;
  const born = Math.min(1, b.age / 0.8), grow = born * born * (3 - 2 * born);
  b.appear = api.appear(b.z) * grow * (b.state === 'dying' ? clamp(1.4 - b.t / (def.defeatTime || 2.8), 0, 1) : 1);
  b.root.position.set(b.x, b.y, b.z);
  b.root.scale.setScalar((def.scale || 1) * b.appear);
  // muzzle glows follow the muzzles (a boss may move them, lv-9's Twins)
  b.glows.forEach((g, i) => { const m = b.muzzles[i]; if (m) g.position.set(m[0], m[1], m[2]); });
  // weak points: follow the body; lit only while hittable (rule 25)
  for (const w of b.weak) {
    w.glow.position.set(w.at[0], w.at[1], w.at[2]); if (w.obj && w.follow) w.obj.position.copy(w.glow.position);
    tmpV.set(w.at[0], w.at[1], w.at[2]); b.root.localToWorld(tmpV);
    w.ent.x = tmpV.x; w.ent.y = tmpV.y; w.ent.z = tmpV.z;
    const on = b.state === 'fight' && b.exposed(w);
    w.flash = Math.max(0, w.flash - dt * 4);
    w.glow.visible = w.hp > 0;
    w.glow.material.opacity = w.hp <= 0 ? 0 : on ? 0.75 + 0.25 * Math.sin(b.t * 9) + w.flash : 0.12;
    // 0.4.0: a weak point's own colour when it has one (the Whirlmaw's gills light green on the exhale: set w.color any time)
    w.glow.material.color.setHex(w.flash > 0.3 ? 0xffffff : (w.color ?? 0xff3355));
  }
}

function startPhase(b, i, api) {
  b.pi = i; b.phase = b.def.phases[i]; b.loopT = 0; b.fired = new Set(); b.teled = new Set();
  if (i > 0) { api.game.call(b.phase.name || 'PHASE ' + (i + 1), 'c-red'); api.game.shake(0.8); api.game.hitstop(0.12); }
  if (b.phase.enter) b.phase.enter(b, api);
  api.game.boss({ phase: i });
}
// a phase's pattern: steps at fixed times in a loop of `loop` seconds; each telegraphs `tel` s before it fires
function runPattern(b, dt, api) {
  const ph = b.phase, loop = ph.loop || 4;
  b.loopT += dt;
  if (b.loopT >= loop) { b.loopT -= loop; b.fired.clear(); b.teled.clear(); }
  for (const g of b.glows) g.material.opacity = Math.max(0, g.material.opacity - dt * 3);
  (ph.pattern || []).forEach((st, k) => {
    const tel = st.tel ?? 0.9, t0 = ((st.at - tel) % loop + loop) % loop;
    const into = ((b.loopT - t0) % loop + loop) % loop;
    if (into < tel) { const g = b.glows[(st.from || 0) % b.glows.length]; g.material.opacity = Math.max(g.material.opacity, into / tel); g.scale.setScalar(2 + 4 * into / tel); if (!b.teled.has(k)) { b.teled.add(k); api.game.sfx('fire', { rate: 0.6, vol: 0.5 }); } }
    if (!b.fired.has(k) && b.loopT >= st.at) {
      b.fired.add(k);
      const f = typeof st.attack === 'function' ? st.attack : ATTACKS[st.attack];
      if (f) f(b, api, st);
    }
  });
  if (ph.update) ph.update(b, dt, api);
}
// 0.4.0 (Tron, field fixes 11-07; Evrtek: "the boss just kind of floated there and nothing ever happened"): the WATCHDOG.
// A fight shows itself: a shot of its own in flight, a lit weak point, or something it has just put on the course (the
// course holds during a boss, so anything newly born is its). A boss that shows nothing for IDLE_S seconds is not
// fighting (its own clock waits on something that never comes), so the framework takes it over: every weak point still
// standing lights, and it fires a telegraphed aimed volley of its own every RESCUE.loop s, so it can always be beaten.
// escapeAfter still runs (fightT). The music clock (audio.tick) is the real fix; this is the net under every boss.
const IDLE_S = 10, RESCUE = { loop: 2.8, at: 1.5, tel: 0.9, n: 3, gap: 0.25, T: 1.4 };
function watchdog(b, dt, api) {
  let busy = b.weak.some((w) => b.exposed(w));
  if (!busy) for (const s of api.course.shots) if (s.owner === b && !s.reflected) { busy = true; break; }
  if (!busy) for (const e of api.course.list) if (e !== b && e.t < 1 && e.type !== 'weak-point' && e.kind.role !== 'decor' && !(e.ev && e.ev.stream)) { busy = true; break; }
  b.idleT = busy ? 0 : (b.idleT || 0) + dt; b.idleMax = Math.max(b.idleMax || 0, b.idleT); // (idleMax: tools/test/boss-trigger.js)
  if (!b.rescue && b.idleT > IDLE_S) {
    b.rescue = true; b.rescueT = 0; b.exposed = (w) => w.hp > 0;
    console.warn('boss watchdog: ' + (b.def.title || b.def.name) + ' showed nothing for ' + IDLE_S + ' s of its fight; the framework runs it');
  }
  if (!b.rescue) return;
  const was = b.rescueT; b.rescueT = (b.rescueT + dt) % RESCUE.loop;
  const into = b.rescueT - (RESCUE.at - RESCUE.tel), g = b.glows[0];
  if (into > 0 && into < RESCUE.tel) { g.material.opacity = Math.max(g.material.opacity, into / RESCUE.tel); g.scale.setScalar(2 + 4 * into / RESCUE.tel); }
  if (was < RESCUE.at && b.rescueT >= RESCUE.at) ATTACKS.aimed(b, api, RESCUE);
}
function hit(b, w, api, shot) {
  if (b.state !== 'fight' || w.hp <= 0) return;
  if (!b.exposed(w)) {
    // a boss may answer an unlit hit itself (lv-9: the Twins bounce it off a raised plate); return true to skip the CLANG
    if (b.def.onClang && b.def.onClang(b, w, shot, api) === true) return;
    api.game.burst(w.ent.x, w.ent.y, w.ent.z, 14, { speed: 10, life: 0.3, s0: 0.8, r: 0.6, g: 0.9, b: 1, carry: 0 }); api.game.pop('CLANG', w.ent.x, w.ent.y + 1.5, w.ent.z, 'red'); return; }
  w.hp--; w.flash = 1;
  api.game.score(b.def.hitPts ?? 2500, w.ent.x, w.ent.y + 2, w.ent.z, 'big', 'WEAK POINT');
  api.game.hitstop(0.06); api.game.shake(0.4); api.game.sfx('boom', { vol: 0.7, rate: 1.3 });
  api.game.burst(w.ent.x, w.ent.y, w.ent.z, 40, { speed: 16, life: 0.6, s0: 1.8, r: 1, g: 0.5, b: 0.3, carry: 0, drag: 1.5 });
  if (w.hp <= 0) { api.game.call(w.call || b.def.pointDown || 'CORE DOWN!', 'c-cyan'); if (w.obj) w.obj.visible = false; if (b.def.onWeakDown) b.def.onWeakDown(b, w, api); }
  const f = b.hp();
  api.game.boss({ frac: f });
  if (f <= 0) { b.state = 'dying'; b.t = 0; api.game.hitstop(0.25); api.game.shake(1.2); api.game.flash(); api.game.call(b.def.downCall || (b.freed ? 'FREED!' : 'BOSS DOWN!'), 'c-cyan'); if (b.def.defeat) b.def.defeat(b, api); return; }
  const next = b.def.phases[b.pi + 1];
  if (next && f <= (b.phase.until ?? 0)) startPhase(b, b.pi + 1, api);
}
