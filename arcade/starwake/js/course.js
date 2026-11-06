// STARWAKE 0.3.0: the course engine. It owns the live entities (every kind's instances), spawns them from the
// level's events at the spawn line, streams them down the track, and runs every shot in flight: aimed fire, the
// graze, the hit and the deflect. What each thing looks like and does lives in its kind (js/pickups, js/obstacles,
// js/enemies, js/levels/*); what it scores lives in the game (main.js), reached through api.game.
import * as THREE from '../vendor/three/three.module.min.js?v=0.3.0';
import { GlowPoints } from './fx.js?v=0.3.0';
import { getKind } from './registry.js?v=0.3.0';
import { appear, Instanced, HIT_R, GRAZE_R, DEFLECT_R, SHOT_T, LEGACY_LINE } from './space.js?v=0.3.0';

// While a level warms up (shaders compiling on a loading screen) its kinds run against this: every game call
// does nothing, so a sample shrike does not flash a warning and a sample ring does not score.
const NOOP_GAME = new Proxy({}, { get: (t, k) => (k === 'mult' ? 1 : k === 'G' ? {} : () => undefined) });

export class Course {
  constructor(api) {
    this.api = api; api.course = this;
    this.list = []; this.shots = []; this.pool = {};
    this.inited = new Set(); this.active = [];
    this.nextId = 1;
    this.shotLayer = new GlowPoints(api.scene, 1800, api.glowTex); // 0.3.0: nine glows a shot (head, trail, core)
    this.onSpawn = null; // test hook
  }
  // A level's kinds: each is built (init) the first time any level uses it. Kinds of the previous level that are
  // not in this one draw nothing more.
  use(kinds) {
    const next = [];
    for (const k of kinds) { if (!next.includes(k)) next.push(k); }
    for (const k of this.active) if (!next.includes(k)) { k.begin && k.begin(this.api); k.end && k.end(this.api); }
    for (const k of next) if (!this.inited.has(k)) { this.inited.add(k); if (k.init) k.init(this.api); }
    this.active = next;
  }
  // pooled scene objects, per kind name
  get(name, make) {
    const p = (this.pool[name] ||= []);
    const o = p.pop() || make();
    o.visible = true; if (!o.parent) this.api.scene.add(o);
    return o;
  }
  put(name, o) { o.visible = false; (this.pool[name] ||= []).push(o); }

  // keepDecor: scenery already streaming (the title screen's) stays, so a run starts without a cut in it.
  // A run that starts as a cut shows its opening already in place, behind a short fade from black (main.js; the
  // MCP's ruling 11-05: a cut at the start of a run is not pop-in; pop-in is something appearing mid-flight).
  reset(keepDecor = false) {
    const keep = [];
    for (const e of this.list) { if (keepDecor && e.alive && (e.kind.role === 'decor' || (e.ev && e.ev.stream))) keep.push(e); else this._remove(e); }
    this.list.length = 0; this.list.push(...keep); this.shots.length = 0;
  }
  _remove(e) {
    if (e.kind.remove) e.kind.remove(e, this.api);
    else if (e.obj) this.put(e.kind.name, e.obj);
    e.obj = null;
  }

  // ------------------------------------------------------------------ spawning
  // z is where it is born (negative, ahead). Most things are born at the spawn line; a kind with spawnAt: 'now'
  // is born when the course reaches its event and places itself (a strafer flying in from the side).
  spawn(ev, z) {
    const k = getKind(ev.type);
    if (!k) throw new Error('no kind "' + ev.type + '": define it and list it in the level\'s kinds');
    if (!this.active.includes(k)) { this.use(this.active.concat([k])); }
    const api = this.api, box = api.box;
    const e = { id: this.nextId++, kind: k, type: ev.type, ev, x: ev.x ?? (ev.nx || 0) * box.x, y: ev.y ?? (ev.ny || 0) * box.y, z, pz: z,
      alive: true, appear: appear(z), sx: 1, sy: 1, sz: 1, t: 0, crossed: false };
    if (k.spawn) k.spawn(e, ev, api);
    if (e.obj) this.api.pose(e);
    this.list.push(e);
    if (this.onSpawn) this.onSpawn(e);
    return e;
  }

  // ------------------------------------------------------------------ the frame
  update(dt) {
    const api = this.api, v = api.v;
    this.frame = (this.frame || 0) + 1;
    for (const k of this.active) if (k.begin) k.begin(api);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.alive) {
        e.pz = e.z;
        if (e.kind.motion !== 'own') e.z += v * dt;
        e.crossed = e.pz < 0 && e.z >= 0;
        e.appear = appear(e.z); e.t += dt;
        Instanced.cur = e;
        e.kind.update(e, dt, api);
        Instanced.cur = null;
      }
      if (!e.alive) { this._remove(e); this.list[i] = this.list[this.list.length - 1]; this.list.pop(); }
    }
    for (const k of this.active) if (k.end) k.end(api);
    this._shots(dt, v, api.ship);
  }

  // Shaders compile the first time a material is drawn, which mid-run is a visible stall (measured 11-05: 217 ms
  // when the derelict's first girder, pylon, pod and rib arrived together, on a 6x-throttled CPU). So one of each
  // of the level's kinds is put in view on a loading screen, compiled there, and packed away again.
  warmup() {
    const api = this.api, real = api.game, made = [];
    api.game = NOOP_GAME;
    let i = 0;
    const undo = [];
    for (const k of this.active) {
      if (k.warm) { const u = k.warm(api); if (u) undo.push(u); continue; }
      if (k.role === 'weakpoint' || k.noWarm) continue;
      const ev = Object.assign({ type: k.name, nx: 0, ny: 0, side: 1, warm: true }, k.sample || {});
      const e = this.spawn(ev, -40 - (i++ % 8) * 6);
      e.appear = 1; this.list.splice(this.list.indexOf(e), 1); made.push(e);
    }
    for (const k of this.active) if (k.begin) k.begin(api);
    for (const e of made) { e.appear = 1; Instanced.cur = e; e.kind.update(e, 0, api); e.appear = 1; if (e.obj) { e.obj.visible = true; api.pose(e); } }
    Instanced.cur = null;
    for (const k of this.active) if (k.end) k.end(api);
    this.shotLayer.begin(); this.shotLayer.push(0, 0, -50, 1, 1, 0.2, 0.3, 1); this.shotLayer.end();
    api.game = real;
    return () => {
      for (const u of undo) u();
      for (const e of made) this._remove(e);
      for (const k of this.active) { if (k.begin) k.begin(api); if (k.end) k.end(api); }
      this.shotLayer.begin(); this.shotLayer.end();
    };
  }

  // ------------------------------------------------------------------ shots
  // from: anything with x, y, z (an entity, or a plain point). It travels to (tx, ty) on the ship's plane in T s.
  // opts: T, vel [vx, vy, vz] (then it flies free), carry (1 = also streams with the track), owner (who a roll
  // sends it back to, when not `from`: a boss fires from a muzzle point but owns the shot), noReflect (a roll
  // does not send it back: it must be dodged; drawn white-hot), dmg (shield damage on a hit).
  // 0.3.0, the human pass: on the early levels every shot takes longer to arrive (the level's ease.shot), so it is
  // seen for longer and there is more time to roll; noEase keeps a flight time exact (the roll lesson's own shot).
  fire(from, tx, ty, opts = {}) {
    const T = (opts.T || SHOT_T) * (opts.noEase || !this.api.ease ? 1 : this.api.ease.shot);
    const s = { x: from.x, y: from.y, z: from.z, vx: (tx - from.x) / T, vy: (ty - from.y) / T, vz: -from.z / T, owner: opts.owner || from, reflected: false, grazed: false,
      alive: true, age: 0, carry: 0, noReflect: !!opts.noReflect, dmg: opts.dmg };
    if (opts.vel) { s.vx = opts.vel[0]; s.vy = opts.vel[1]; s.vz = opts.vel[2]; s.carry = opts.carry || 0; }
    this.shots.push(s);
    this.api.game.fired(s);
    return s;
  }
  kill(e, byShot) {
    if (!e.alive) return;
    e.alive = false; e.dead = true;
    if (e.kind.onKill) e.kind.onKill(e, byShot, this.api);
    this.api.game.kill(e, byShot);
  }

  _shots(dt, v, ship) {
    const L = this.shotLayer, api = this.api; L.begin();
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.age += dt;
      const pz = s.z, px = s.x, py = s.y;
      if (s.reflected) {
        // home on the target: it lives in the track, so it streams toward us as we chase it
        const t = s.target;
        if (t && t.alive && !t.dead) {
          const dx = t.x - s.x, dy = t.y - s.y, dz = t.z - s.z, d = Math.hypot(dx, dy, dz) || 1;
          const sp = 260;
          s.vx += (dx / d * sp - s.vx) * Math.min(1, dt * 8); s.vy += (dy / d * sp - s.vy) * Math.min(1, dt * 8); s.vz += (dz / d * sp - s.vz) * Math.min(1, dt * 8);
          if (d < (t.hitR ?? t.r ?? 1) + 0.9) {
            s.alive = false;
            if (t.kind.onShot) t.kind.onShot(t, s, api); else this.kill(t, true);
          }
        }
        s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
        if (s.z < -900 || s.age > 4) s.alive = false;
      } else {
        // the roll lesson's shot steers onto the ship, so it always arrives where the roll has to meet it
        if (s.home) { const tr = -s.z / Math.max(1, s.vz + (s.carry ? v : 0)); if (tr > 0.05) { s.vx = (ship.x - s.x) / tr; s.vy = (ship.y - s.y) / tr; } }
        s.x += s.vx * dt; s.y += s.vy * dt; s.z += (s.vz + (s.carry ? v : 0)) * dt;
        if (pz < 0 && s.z >= 0) {
          // where it crossed the ship's plane
          const f = -pz / (s.z - pz), cx = px + (s.x - px) * f, cy = py + (s.y - py) * f;
          const d = Math.hypot(ship.x - cx, ship.y - cy);
          if (ship.rolling && d < DEFLECT_R && !s.noReflect) {
            s.reflected = true; s.age = 0; s.z = -0.5;
            s.target = this._targetFor(s);
            const t = s.target;
            if (t) { const dx = t.x - s.x, dy = t.y - s.y, dz = t.z - s.z, dd = Math.hypot(dx, dy, dz) || 1; s.vx = dx / dd * 220; s.vy = dy / dd * 220; s.vz = dz / dd * 220; }
            else { s.vx = (Math.random() - 0.5) * 30; s.vy = 20; s.vz = -260; }
            api.game.deflect(s, d);
          } else if (d < HIT_R && !ship.invuln) {
            s.alive = false; api.game.shot(s, d);
          } else if (d < GRAZE_R && !s.grazed) {
            s.grazed = true; api.game.graze(s, d, HIT_R, GRAZE_R);
          }
        }
        if (s.z > 12) s.alive = false;
      }
      if (!s.alive) { this.shots[i] = this.shots[this.shots.length - 1]; this.shots.pop(); continue; }
      const pulse = 0.85 + 0.15 * Math.sin(s.age * 30);
      // 0.3.0, the human pass (Evrtek 11-06: "more of a visual warning when incoming weapons fire is coming"): a bigger,
      // brighter head with a white-hot core, and a TRAIL strung back along its line of flight (as it moves through the
      // track) that points at whoever fired it. Red hurts, cyan is yours (rule 9); the great beam stays white-hot.
      const rz = s.vz + (!s.reflected && s.carry ? v : 0), sp = Math.hypot(s.vx, s.vy, rz) || 1;
      const len = Math.min(10, Math.max(2.4, sp * 0.06)), n = 7, bx = s.vx / sp * len / n, by = s.vy / sp * len / n, bz = rz / sp * len / n;
      if (s.reflected) { for (let k = 0; k < n; k++) L.push(s.x - bx * k, s.y - by * k, s.z - bz * k, 2.6 * (1 - k / n * 0.7), 0.33, 0.9, 1, 0.8 * (1 - k / n)); L.push(s.x, s.y, s.z, 1.1, 1, 1, 1, 1); }
      else if (s.noReflect) { for (let k = 0; k < n; k++) L.push(s.x - bx * k, s.y - by * k, s.z - bz * k, 3.6 * (1 - k / n * 0.6) * pulse, 1, 0.45, 0.2, 0.85 * (1 - k / n)); L.push(s.x, s.y, s.z, 1.6, 1, 1, 1, 1); }
      else { L.push(s.x, s.y, s.z, 4.2 * pulse, 1, 0.16, 0.3, 0.55); for (let k = 0; k < n; k++) L.push(s.x - bx * k, s.y - by * k, s.z - bz * k, 3.0 * (1 - k / n * 0.7) * pulse, 1, 0.2, 0.33, 0.85 * (1 - k / n * 0.85)); L.push(s.x, s.y, s.z, 1.35, 1, 0.92, 0.92, 1); }
    }
    L.end();
  }
  // Where a sent-back shot goes: the owner's choice first (a boss sends it to a lit weak point), then the owner
  // itself if it is still there, then the nearest live enemy ahead that can be hit.
  _targetFor(s) {
    const o = s.owner, api = this.api;
    if (o && o.kind && o.kind.redirect) { const t = o.kind.redirect(o, s, api); if (t !== undefined) return t; }
    if (o && o.alive && !o.dead && !o.mine && o.z < -2) return o;
    let best = null, bd = 1e9;
    for (const e of this.list) {
      if (e.kind.role !== 'enemy' || !e.alive || e.z >= -5 || e.z < -LEGACY_LINE) continue;
      if (e.kind.targetable && !e.kind.targetable(e)) continue;
      const d = -e.z; if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  threats() { return this.shots; }
}
