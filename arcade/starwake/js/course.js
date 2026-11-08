// STARWAKE 0.4.0: the course engine. It owns the live entities (every kind's instances), spawns them from the
// level's events at the spawn line, streams them down the track, and runs every shot in flight: aimed fire, the
// graze, the hit and the deflect. What each thing looks like and does lives in its kind (js/pickups, js/obstacles,
// js/enemies, js/levels/*); what it scores lives in the game (main.js), reached through api.game.
import * as THREE from '../vendor/three/three.module.min.js?v=0.4.1';
import { GlowPoints } from './fx.js?v=0.4.1';
import { getKind } from './registry.js?v=0.4.1';
import { appear, Instanced, HIT_R, GRAZE_R, DEFLECT_R, SHOT_T, NET_S, NET_T, LEGACY_LINE } from './space.js?v=0.4.1';

// While a level warms up (shaders compiling on a loading screen) its kinds run against this: every game call
// does nothing, so a sample shrike does not flash a warning and a sample ring does not score.
const NOOP_GAME = new Proxy({}, { get: (t, k) => (k === 'mult' ? 1 : k === 'G' ? {} : () => undefined) });

export class Course {
  constructor(api) {
    this.api = api; api.course = this;
    this.list = []; this.shots = []; this.pool = {};
    this.inited = new Set(); this.active = [];
    this.nextId = 1;
    this.shotLayer = new GlowPoints(api.scene, 2400, api.glowTex); // 0.3.0: nine glows a shot (head, trail, core); 0.4.0: + path dots
    this.onSpawn = null; // test hook
    this.fields = [];    // 0.4.0: functions that bend every shot in flight this frame (course.field)
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
    this.list.length = 0; this.list.push(...keep); this.shots.length = 0; this.netN = 0;
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
    this.fields.length = 0; // 0.4.0: shot fields (gravity wells) are registered again each frame by whatever bends shots
    for (const k of this.active) if (k.begin) k.begin(api);
    const M = api.magnetR || 0, ship = api.ship;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.alive) {
        e.pz = e.z;
        if (e.kind.motion !== 'own') e.z += v * dt;
        e.crossed = e.pz < 0 && e.z >= 0;
        e.appear = appear(e.z); e.t += dt;
        // 0.4.0, RING MAGNET: a ring that counts, within reach of the ship and under a second out, drifts in to meet it
        // (it arrives where the ship is). Never a cache, never one a level marks noMagnet (a ring behind a wall).
        if (M && e.kind.countsAsRing && !e.anim && e.z < 0 && e.z > -Math.max(30, v * 0.8) && !(e.ev && (e.ev.cache || e.ev.noMagnet || e.decor))) {
          const dx = ship.x - e.x, dy = ship.y - e.y, d = Math.hypot(dx, dy);
          if (d < M && d > 0.02) { const tArr = -e.z / Math.max(1, v), k = Math.min(1, dt / Math.max(dt, tArr - 0.04)); e.x += dx * k; e.y += dy * k; e.magnet = true; }
        }
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
  // 0.4.0 (galaxies 2 and 3), all optional:
  //   steer(s, dt, api)  called every frame of its flight before it moves: change s.vx/vy/vz (a curve, a homing seed)
  //   weave { amp, hz, axis: 'x'|'y', phase }  it weaves side to side (or up and down) about its line as it flies
  //   preview: true      a faint dotted line of where it is going, drawn ahead of it (any shot a field bends gets one)
  //   at { x, y, z }     it flies to a point anywhere (not the ship's plane): a bolt at an ally beside the lane. Such a
  //                      shot is CATCHABLE: wherever its path passes the ship, a roll sends it home and no roll takes the hit
  //   onArrive(s, api)   called when it reaches its point (an `at` shot) or passes the ship's plane unanswered
  //   label 'INTERCEPT!' what a deflect of it is called (the call-out); tag: anything the level wants to read back
  // 0.3.1, roll-or-hit fire (levels.js FIRE): opts.net marks plain aimed fire (a kind's shot at you, not a miss); on a
  // level that asks, one such volley in `every` comes as a NET (see _net). opts.beat (s): the kind's shots land on the
  // beat, so a net's flight is whole beats too; opts.netT, a longer flight for its net (a kind's warning floor).
  fire(from, tx, ty, opts = {}) {
    // 0.4.0: FIRE_G may name galaxy 2 and 3 kinds whose plain aimed fire can come as a net (the engine's own opt-in, from
    // levels.js, never the kind's file): a shot at you with nothing of its own (no steer, weave, at, vel, preview, label),
    // never a teaching one (first: true, wide, skim; a kind's numeric 'first' is its timing, not a lesson) and never a boss's;
    // a net's own bolts (netId) are never asked again (asked again, they folded into their own net and none flew)
    const F = this.api.netFire, o = opts.owner || from; // (a kind that fires from itself without naming an owner: the gulper)
    if (!opts.net && !opts.netId && F && F.kinds && o && o.kind && F.kinds[o.kind.name] && !o.kind.boss && o.kind.role !== 'boss' && o.kind.role !== 'weakpoint' &&
      !opts.steer && !opts.weave && !opts.at && !opts.vel && !opts.noReflect && !opts.preview && !opts.label &&
      !(o.first === true || (o.ev && (o.ev.first === true || o.ev.wide || o.ev.skim || o.ev.teach || o.ev.warm || o.ev.gallery)))) opts = Object.assign({}, opts, { net: true, netT: opts.netT || F.kinds[o.kind.name].netT });
    if (opts.net && !opts.vel && !opts.noReflect) { const r = this._net(from, tx, ty, opts); if (r !== undefined) return r; }
    const T = (opts.T || SHOT_T) * (opts.noEase || !this.api.ease ? 1 : this.api.ease.shot);
    const s = { x: from.x, y: from.y, z: from.z, vx: (tx - from.x) / T, vy: (ty - from.y) / T, vz: -from.z / T, owner: opts.owner || from, reflected: false, grazed: false,
      alive: true, age: 0, carry: 0, noReflect: !!opts.noReflect, dmg: opts.dmg, T, net: opts.netId || 0 };
    if (opts.vel) { s.vx = opts.vel[0]; s.vy = opts.vel[1]; s.vz = opts.vel[2]; s.carry = opts.carry || 0; }
    if (opts.at) { const a = opts.at; s.vx = (a.x - from.x) / T; s.vy = (a.y - from.y) / T; s.vz = ((a.z || 0) - from.z) / T; s.catch = true; s.carry = opts.carry || 0; }
    if (opts.steer) s.steer = opts.steer;
    if (opts.weave) s.weave = Object.assign({ amp: 2, hz: 1, axis: 'x', phase: 0 }, opts.weave), s.woff = 0;
    if (opts.preview) s.preview = true;
    if (opts.onArrive) s.onArrive = opts.onArrive;
    if (opts.label) s.label = opts.label;
    if (opts.tag !== undefined) s.tag = opts.tag;
    this.shots.push(s);
    this.api.game.fired(s);
    return s;
  }
  // 0.4.0: a shot field, registered every frame by whatever bends shots (a gravity well): fn(s, dt) changes the shot's
  // velocity and returns true if it bent it. It acts on every shot in flight, sent-back ones too.
  field(fn) { this.fields.push(fn); }
  // 0.4.0: an ECHO, a sent-back shot that starts at the ship (or `from`) and homes on `target`: what a roll answering
  // something that is not a shot sends home (a pulse's PARRY, a tether's SNAP). A boss body sends it to its lit weak point.
  echo(target, from) {
    const ship = this.api.ship;
    if (target && target.kind && target.kind.redirect) { const t = target.kind.redirect(target, null, this.api); if (t !== undefined) target = t; }
    const s = { x: from ? from.x : ship.x, y: from ? from.y : ship.y, z: from ? from.z : -0.5, vx: 0, vy: 0, vz: -260, owner: null, reflected: true, grazed: true, alive: true, age: 0, carry: 0, target };
    if (target) { const dx = target.x - s.x, dy = target.y - s.y, dz = target.z - s.z, d = Math.hypot(dx, dy, dz) || 1; s.vx = dx / d * 220; s.vy = dy / d * 220; s.vz = dz / d * 220; }
    this.shots.push(s);
    return s;
  }
  // A NET: the centre bolt where the shot was aimed and a hex lattice round it NET_S apart (no gap a ship fits: every
  // point inside is within 0.75 m of a bolt, under HIT_R), fired at once, landing together NET_T later. Steering out
  // means clearing 2.1 m (one ring) or 3.4 m (two) in the 0.4 s it flies, from when it is seen leaving; a roll as it lands
  // sends back every bolt within DEFLECT_R, and none further out can touch you. A burst (a pod's three, a turret's
  // quarter-beat pair) is one volley: its shots after the first fold into the net (returns null). Returns undefined to
  // fire the shot as it was.
  _net(from, tx, ty, opts) {
    const F = this.api.netFire; if (!F) return undefined;
    const o = opts.owner || from, now = this.api.time || 0;
    if (o._netT !== undefined && now - o._netT < 0.45) { o._netT = now; return o._net ? null : undefined; }
    o._netT = now; o._net = this.netNext();
    if (!o._net) return undefined;
    const nt = opts.netT || NET_T, T = opts.beat ? Math.max(1, Math.round(nt / opts.beat)) * opts.beat : nt;
    let first = null;
    for (const [dx, dy] of this.netPoints()) {
      const s = this.fire(from, tx + dx, ty + dy, { T, owner: o, dmg: opts.dmg, noEase: opts.noEase || !!opts.beat, netId: this.netN });
      if (!first) first = s;
    }
    return first;
  }
  // a net's bolts round its centre (the level's rings), turned a little each net so no two look the same
  netPoints() {
    const F = this.api.netFire, a0 = (this.netN || 0) * 0.7, pts = [[0, 0]];
    for (let k = 0; k < 6; k++) { const a = a0 + k * Math.PI / 3; pts.push([Math.cos(a) * NET_S, Math.sin(a) * NET_S]); }
    if (F && F.rings > 1) for (let k = 0; k < 6; k++) {
      const a = a0 + k * Math.PI / 3, b = a + Math.PI / 6;
      pts.push([Math.cos(a) * NET_S * 2, Math.sin(a) * NET_S * 2], [Math.cos(b) * NET_S * Math.sqrt(3), Math.sin(b) * NET_S * Math.sqrt(3)]);
    }
    return pts;
  }
  // Is the next aimed volley a net? One in the level's every, counted over the whole level. A kind that lays out its
  // own volley (the swarm: one bolt a kite) asks this once a volley and fires the net's points itself.
  netNext() { const F = this.api.netFire; if (!F) return false; this.netN = (this.netN || 0) + 1; return this.netN % F.every === 0; }
  kill(e, byShot) {
    if (!e.alive) return;
    e.alive = false; e.dead = true;
    if (e.kind.onKill) e.kind.onKill(e, byShot, this.api);
    this.api.game.kill(e, byShot);
  }

  // one frame of a shot's own motion (steer, fields, weave), shared by the flight and the dotted preview
  _move(s, dt, v, sim) {
    if (s.steer && !s.reflected) s.steer(s, dt, this.api);
    let bent = false;
    for (const f of this.fields) if (f(s, dt)) bent = true;
    if (bent && !sim) s.bent = 1.2;
    let ox = 0, oy = 0;
    if (s.weave && !s.reflected) { const w = s.weave, o = w.amp * Math.sin(s.age * w.hz * Math.PI * 2 + w.phase); const d = o - s.woff; s.woff = o; if (w.axis === 'y') oy = d; else ox = d; }
    s.x += s.vx * dt + ox; s.y += s.vy * dt + oy; s.z += (s.vz + (s.carry && !s.reflected ? v : 0)) * dt;
  }
  // the dotted line ahead of a bent or weaving shot: where it will be, every 0.1 s, for up to 1.2 s or to the ship's plane
  _preview(s, v, L) {
    const p = { x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz, age: s.age, carry: s.carry, steer: s.steer, weave: s.weave, woff: s.woff, tag: s.tag, owner: s.owner, reflected: false, sim: true };
    const h = 1 / 30;
    for (let i = 1; i <= 36; i++) {
      p.age += h; this._move(p, h, v, true);
      if (i % 3 === 0) L.push(p.x, p.y, p.z, 0.75, 1, 0.3, 0.4, 0.32 * (1 - i / 40));
      if (p.z >= 0 || (s.catch && p.age >= s.T)) break;
    }
  }

  _shots(dt, v, ship) {
    const L = this.shotLayer, api = this.api; L.begin();
    const DR = ship.deflectR || DEFLECT_R; // 0.4.0: MIRROR SHELL reaches half as far again
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
        if (this.fields.length) this._move(s, dt, v, false); else { s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; }
        if (s.z < -900 || s.age > 4) s.alive = false;
      } else {
        // the roll lesson's shot steers onto the ship, so it always arrives where the roll has to meet it
        if (s.home) { const tr = -s.z / Math.max(1, s.vz + (s.carry ? v : 0)); if (tr > 0.05) { s.vx = (ship.x - s.x) / tr; s.vy = (ship.y - s.y) / tr; } }
        if (s.steer || s.weave || this.fields.length) this._move(s, dt, v, false);
        else { s.x += s.vx * dt; s.y += s.vy * dt; s.z += (s.vz + (s.carry ? v : 0)) * dt; }
        if (s.bent) s.bent = Math.max(0, s.bent - dt);
        // where it meets the ship: a catchable shot (one flying to a point, 0.4.0) wherever its path passes nearest the
        // ship; any other where it crosses the ship's plane
        // where it meets the ship. A CATCHABLE shot (one flying to a point, 0.4.0) is answered at its CLOSEST approach: while
        // it is inside the roll's (or a graze's) reach it is checked every frame (a roll in reach sends it home, a pass inside
        // HIT_R hits), and only when it leaves does it count as passed, with a graze if it came that close (g2-b's fix: it
        // was decided the frame it entered, before it got near). Any other shot meets the ship where it crosses its plane.
        let meet = false, d = 1e9, cx = 0, cy = 0;
        if (s.catch) {
          if (!s.met) {
            const ax = s.x - px, ay = s.y - py, az = s.z - pz, aa = ax * ax + ay * ay + az * az || 1e-9;
            const f = Math.max(0, Math.min(1, ((ship.x - px) * ax + (ship.y - py) * ay + (0 - pz) * az) / aa));
            cx = px + ax * f; cy = py + ay * f; const cz = pz + az * f;
            d = Math.hypot(ship.x - cx, ship.y - cy, cz);
            if (d < Math.max(GRAZE_R, DR)) {
              s.inside = true; s.dmin = Math.min(s.dmin ?? 1e9, d);
              if (ship.rolling && d < DR && !s.noReflect) this._sendHome(s, d);
              else if (d < HIT_R && !ship.invuln) { s.alive = false; s.met = true; api.game.shot(s, d); }
            } else if (s.inside) this._passed(s);
          }
        } else if (pz < 0 && s.z >= 0) {
          const f = -pz / (s.z - pz); cx = px + (s.x - px) * f; cy = py + (s.y - py) * f;
          d = Math.hypot(ship.x - cx, ship.y - cy); meet = true;
        }
        if (meet) {
          if (ship.rolling && d < DR && !s.noReflect) this._sendHome(s, d);
          else if (d < HIT_R && !ship.invuln) { s.alive = false; api.game.shot(s, d); }
          else if (d < GRAZE_R && !s.grazed) { s.grazed = true; api.game.graze(s, d, HIT_R, GRAZE_R); }
          else if (s.onArrive && !s.arrived) { s.arrived = true; s.onArrive(s, api); }
        }
        if (s.catch && !s.reflected && s.alive && s.age >= s.T) { if (s.inside && !s.met) this._passed(s); s.alive = false; if (s.onArrive) s.onArrive(s, api); }
        if (s.z > 12) { if (s.alive && s.onArrive && !s.arrived && !s.catch) { s.arrived = true; s.onArrive(s, api); } s.alive = false; }
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
      // 0.4.0: a bent or weaving shot shows where it is going (the plan: "curves stay readable")
      if (!s.reflected && (s.preview || s.bent > 0 || s.weave)) this._preview(s, v, L);
    }
    L.end();
  }
  // a roll met it: it goes home (to its owner's choice, its owner, or the nearest enemy ahead)
  _sendHome(s, d) {
    s.reflected = true; s.met = true; s.age = 0; s.z = Math.min(s.z, -0.5);
    s.target = this._targetFor(s);
    const t = s.target;
    if (t) { const dx = t.x - s.x, dy = t.y - s.y, dz = t.z - s.z, dd = Math.hypot(dx, dy, dz) || 1; s.vx = dx / dd * 220; s.vy = dy / dd * 220; s.vz = dz / dd * 220; }
    else { s.vx = (Math.random() - 0.5) * 30; s.vy = 20; s.vz = -260; }
    this.api.game.deflect(s, d);
  }
  // a catchable shot has left the ship's reach unanswered: done with the ship, a graze if it came within GRAZE_R
  _passed(s) { s.met = true; if (s.dmin < GRAZE_R && !s.grazed) { s.grazed = true; this.api.game.graze(s, s.dmin, HIT_R, GRAZE_R); } }
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
