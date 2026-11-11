// THE FLOCK (galaxy 2, level 9 The Murmuration; the plan 3.9). Hundreds of pearl light-moths (Yori's moth(flap), mesh.js)
// flying as ONE body, one shape at a time: a WALL with a hole, a rolling WAVE, a FUNNEL, a SPIRAL, a TUBE that flies
// with you and squeezes, a WHEEL of spokes, an EYE (a ring of moths round a pocket). Read the shape.
//   - Where it hurts: the dense parts are solid (a small hit); the thin parts (the hole's frayed edge, a scattered flock)
//     are harmless sparkle.
//   - Shape changes are warned: the flock INHALES (it slows and brightens, and a faint outline of the next shape shows for
//     1.2 s), then flows into the new shape. Every change is timed in seconds before it reaches you, so it lands with the
//     same warning at any speed (rule 12).
//   - Its CONDUCTOR (js/enemies/g2-conductor) is one moth with a red core, the only one that fires. Send its pair home and
//     it dies: the flock scatters into drifting sparks (a wall becomes snow).
// Geometry that has to meet a ring (a hole, the wave's crest, a wheel's gaps) is tied to distance, not time: the wave rolls
// and the wheel turns as they come at you, so the gap is where the rings are whatever your speed (GREED, boosts).
// The swarm layers are shared (the Murmur draws its thousands through them): swarmBegin/moth/outline/swarmEnd.
//   add(d, 'g2-flock', { key, shape: 'wall', n: 360, hole: { nx, ny, r }, script: [{ t: 3.4, to: { shape, ... } }],
//                        hold: { z: -30, secs: 8 } (a tube), crack: { nx, ny } (a phase patch), decor: true (harmless) })
import { THREE, defineObstacle, Instanced, GlowPoints, clamp, rng, modelGroups } from '../../api.js?v=0.6.0';
import { MESH } from './mesh.js?v=0.6.0';
import { MESH as CRACK } from '../g2-angler/crack.js?v=0.6.0';
import { morphModel } from '../g2-bloomer/morph.js?v=0.6.0';

// ---------------------------------------------------------------- the shared swarm: two flap poses, instanced
export const SW = { up: null, down: null, out: null, began: false };
const QS = [];
const PEARL = 0xcfc9e4, BRIGHT = 0xffffff;
function initSwarm(api) {
  if (SW.up) return;
  const mk = (groups) => { const g = modelGroups(groups)[0]; return new Instanced(api.scene, g.geo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), 3600); };
  SW.up = mk(MESH.up); SW.down = mk(MESH.down);
  SW.out = new GlowPoints(api.scene, 2000, api.glowTex);
  // eight headings, turned to face you (her moths fly nose -z): a flock never moves in step
  for (let i = 0; i < 8; i++) QS.push(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25 * Math.sin(i * 2.1), Math.PI + (i / 8 - 0.5) * 1.1, 0.35 * Math.cos(i * 1.7))));
}
export function swarmBegin(api) { initSwarm(api); if (SW.began) return; SW.began = true; SW.up.begin(); SW.down.begin(); SW.out.setScale(api.focalPx || 600); SW.out.begin(); }
export function swarmEnd() { if (!SW.began) return; SW.began = false; SW.up.end(); SW.down.end(); SW.out.end(); }
// one moth: i picks its heading and flap phase; t is a clock (the flock slows its wings as it inhales)
export function moth(i, x, y, z, s, t, color = PEARL) { (Math.sin(t * 13 + i * 1.7) > 0 ? SW.up : SW.down).put(x, y, z, QS[i & 7], s, s, s, color); }
export function outline(x, y, z, a, size = 0.9) { SW.out.push(x, y, z, size, 0.95, 0.94, 1, a); }
export const MOTH = { PEARL, BRIGHT };

// ---------------------------------------------------------------- shapes
// Each shape fills offsets (metres, round the flock's centre) and answers whether a point in its plane is solid. Box-sized
// shapes read api.box when they are made, so portrait and landscape both get a whole wall.
const W = (b) => b.x * 1.5, H = (b) => b.y * 1.5;
const SHAPES = {
  // a wall across the lane with a hole (its frayed edge thin and harmless)
  wall: {
    fill(s, n, R, b) { const out = []; const hx = s.hx, hy = s.hy, hr = s.hr; let guard = 0;
      while (out.length < n && guard++ < n * 20) { const x = R.range(-W(b), W(b)), y = R.range(-H(b), H(b)), d = Math.hypot(x - hx, y - hy); if (d < hr) continue; if (d < hr + 1.4 && R() < 0.6) continue; out.push([x, y, R.range(-0.7, 0.7)]); }
      return out; },
    solid(s, x, y, m = 0) { return Math.hypot(x - s.hx, y - s.hy) > s.hr + 0.55 - m; },
    thin: true,
  },
  // a rolling wave: a band across the lane, rising and falling as it comes at you (its phase follows its distance)
  wave: {
    fill(s, n, R, b) { const out = []; for (let i = 0; i < n; i++) out.push([R.range(-W(b), W(b)), R.range(-0.9, 0.9), R.range(-1, 1)]); return out; },
    at(s, x, z) { return s.cy + s.amp * Math.sin(s.k * x + s.ph + z * 0.012); },
    solid(s, x, y, m = 0) { return Math.abs(y - SHAPES.wave.at(s, x, 0)) < 1.15 + m; },
    thin: true,
  },
  // a funnel round the lane: wide where you enter, narrowing to its mouth (the exit) at (hx, hy)
  funnel: {
    fill(s, n, R) { const out = []; for (let i = 0; i < n; i++) { const t = R(), a = R.range(0, Math.PI * 2), r = s.r0 + (s.r1 - s.r0) * t + R.range(-0.5, 0.5); out.push([s.hx * t + Math.cos(a) * r, s.hy * t + Math.sin(a) * r, s.len / 2 - t * s.len]); } return out; },
    // zl: how far ahead its middle is (the near end, +len/2 local, reaches you first and is the wide one)
    radiusAt(s, zl) { const t = clamp((s.len / 2 - zl) / s.len, 0, 1); return { r: s.r0 + (s.r1 - s.r0) * t, cx: s.hx * t, cy: s.hy * t }; },
    long: true,
  },
  // a spiral arm coiling down the lane: one point of it crosses your plane at a time, circling the middle
  spiral: {
    fill(s, n, R) { const out = []; for (let i = 0; i < n; i++) { const t = R(), a = s.a0 + t * Math.PI * 2 * s.turns, r = s.r + R.range(-0.7, 0.7); out.push([Math.cos(a) * r, Math.sin(a) * r, -s.len / 2 + t * s.len + R.range(-1.5, 1.5)]); } return out; },
    armAt(s, zl) { const t = clamp((zl + s.len / 2) / s.len, 0, 1), a = s.a0 + t * Math.PI * 2 * s.turns; return [Math.cos(a) * s.r, Math.sin(a) * s.r]; },
    long: true,
  },
  // a wheel: spokes and a hub, turning as it comes (its angle follows its distance); the gaps between spokes are open
  wheel: {
    fill(s, n, R, b) { const out = []; for (let i = 0; i < n; i++) { const k = i % (s.spokes + 2); if (k >= s.spokes) { const a = R.range(0, Math.PI * 2), r = k === s.spokes ? R.range(0, 1.3) : R.range(Math.hypot(b.x, b.y) * 1.05, Math.hypot(b.x, b.y) * 1.3); out.push([Math.cos(a) * r, Math.sin(a) * r, R.range(-0.6, 0.6)]); } else { const a = k / s.spokes * Math.PI * 2, r = R.range(1.0, Math.hypot(b.x, b.y) * 1.3), w = R.range(-0.45, 0.45); out.push([Math.cos(a) * r - Math.sin(a) * w, Math.sin(a) * r + Math.cos(a) * w, R.range(-0.6, 0.6)]); } } return out; },
    angle(s, z) { return s.a0 + z * s.turn; },
    solid(s, x, y, m = 0) { const d = Math.hypot(x, y); if (d < 1.4 + m) return true; const a = Math.atan2(y, x) - SHAPES.wheel.angle(s, 0); for (let k = 0; k < s.spokes; k++) { const b = a - k / s.spokes * Math.PI * 2, along = d * Math.cos(b), across = Math.abs(d * Math.sin(b)); if (along > 0 && across < 0.7 + m) return true; } return false; },
    thin: true,
  },
  // a tube round the lane that flies with you and squeezes (the twist)
  tube: {
    fill(s, n, R) { const out = []; for (let i = 0; i < n; i++) { const a = R.range(0, Math.PI * 2); out.push([Math.cos(a), Math.sin(a), R.range(-s.len / 2, s.len / 2)]); } return out; },
    long: true,
  },
  // the flock's EYE with a cache in it: a short tube of moths round a point, capped in front by a dense, cracked patch
  // (Yori's violet crack). The only way in is through the cap or the side, and both are solid: PHASE takes you in.
  pocket: {
    fill(s, n, R) { const out = []; for (let i = 0; i < n; i++) { const a = R.range(0, Math.PI * 2); if (i % 3 === 0) { const r = Math.sqrt(R()) * s.r; out.push([s.hx + Math.cos(a) * r, s.hy + Math.sin(a) * r, -s.len / 2 + R.range(-0.6, 0.6)]); } else { const r = s.r + R.range(-0.3, 0.5); out.push([s.hx + Math.cos(a) * r, s.hy + Math.sin(a) * r, R.range(-s.len / 2, s.len / 2)]); } } return out; },
    long: true,
  },
  // an eye: a ring of moths round a pocket (harmless: the cache behind a phase wall sits in it)
  eye: {
    fill(s, n, R) { const out = []; for (let i = 0; i < n; i++) { const a = R.range(0, Math.PI * 2), r = s.r + R.range(-0.4, 0.4); out.push([s.hx + Math.cos(a) * r, s.hy + Math.sin(a) * r, R.range(-s.len / 2, s.len / 2)]); } return out; },
    long: true, harmless: true,
  },
};
// the shape's numbers in metres, from the event's normalised ones and this device's box
function shapeOf(o, b) {
  const s = Object.assign({}, o);
  s.hx = (o.hole ? o.hole.nx : o.hx ?? 0) * b.x; s.hy = (o.hole ? o.hole.ny : o.hy ?? 0) * b.y; s.hr = o.hole ? Math.max(2.4, o.hole.r * b.y) : 3;
  if (o.shape === 'wave') { s.amp = (o.amp ?? 0.55) * b.y; s.k = Math.PI * 2 / (b.x * (o.wl ?? 1.7)); s.ph = o.ph ?? 0; s.cy = (o.ny ?? 0) * b.y; }
  if (o.shape === 'funnel') { s.len = o.len ?? 60; s.r0 = Math.hypot(b.x, b.y) * 1.15; s.r1 = o.r1 ?? 2.9; }
  if (o.shape === 'spiral') { s.len = o.len ?? 220; s.r = (o.r ?? 0.55) * Math.min(b.x, b.y); s.a0 = o.a0 ?? 0; s.turns = o.turns ?? 1.25; }
  if (o.shape === 'wheel') { s.spokes = o.spokes ?? 5; s.a0 = o.a0 ?? 0; s.turn = o.turn ?? 0.004; }
  if (o.shape === 'tube') { s.len = o.len ?? 64; s.r = o.r ?? 7; }
  if (o.shape === 'eye') { s.len = o.len ?? 40; s.r = o.r ?? 2.3; }
  if (o.shape === 'pocket') { s.len = o.len ?? 70; s.r = o.r ?? 2.6; }
  return s;
}
const INHALE = 1.2, FLOW = 0.6;
const TUBE = { tell: 1.3, squeeze: 0.25, hold: 0.5, back: 0.4, rest: 0.4, min: 2.8 };

let crackObj = null;
export default defineObstacle({
  name: 'g2-flock',
  // a flock's final shape is complete (its outline shown and its flow done) a known time before it reaches you; a still
  // flock reads like anything in the track; the tube's squeezes each glow for 1.2 s first
  hazard: { cls: 'mover', introduced: [2, 9], warn: (ev, v) => {
    if (ev.shape === 'tube') return TUBE.tell;
    const last = (ev.script || []).slice(-1)[0];
    return last ? last.t - INHALE - FLOW : 580 / v;
  } },
  sample: { shape: 'wall', n: 40, warm: true },
  // 0.3.1, no fully blocked moment: where it is solid as it crosses your plane (the distance from a ship centre to its
  // surface, below 0 inside), for the shape it ends in (a script's last shape), never scattered (the worst case).
  // Every shape leaves its way through: a wall its hole, a wave above or below its band, a wheel its gaps, a funnel its
  // narrowing middle, the tube its squeezed core.
  solid(ev, box, v = 120) {
    if (ev.decor) return [];
    const last = (ev.script || []).slice(-1)[0], o = last ? Object.assign({}, ev, last.to) : ev, sh = SHAPES[o.shape || 'wall'];
    if (!sh || sh.harmless) return [];
    const s = shapeOf(Object.assign({ shape: 'wall' }, o), box), ox = (ev.nx || 0) * box.x, oy = (ev.ny || 0) * box.y;
    const rel = (fn) => (x, y) => fn(x - ox, y - oy);
    switch (s.shape) {
      case 'wall': return [{ dist: rel((x, y) => s.hr + 0.55 - Math.hypot(x - s.hx, y - s.hy)) }];
      case 'wave': return [{ dist: rel((x, y) => Math.abs(y - SHAPES.wave.at(s, x, 0)) - 1.15) }];
      case 'wheel': return [{ dist: rel((x, y) => wheelDist(s, x, y)) }];
      case 'funnel': { const out = []; for (let zl = s.len / 2; zl >= -s.len / 2 - 0.01; zl -= 10) { const f = SHAPES.funnel.radiusAt(s, zl); out.push({ at: -zl, dist: rel((x, y) => f.r - 0.4 - Math.hypot(x - f.cx, y - f.cy)) }); } return out; }
      case 'spiral': { const out = []; for (let zl = s.len / 2; zl >= -s.len / 2 - 0.01; zl -= 10) { const [ax, ay] = SHAPES.spiral.armAt(s, zl); out.push({ at: -zl, dist: rel((x, y) => Math.hypot(x - ax, y - ay) - 1.1) }); } return out; }
      case 'pocket': return [{ at: -s.len / 2, dist: rel((x, y) => Math.hypot(x - s.hx, y - s.hy) - (s.r + 0.3)) }];
      case 'tube': {
        if (!ev.hold) return [];
        const T = TUBE, cyc = T.tell + T.squeeze + T.hold + T.back + T.rest, out = [];
        for (let t = 0.6 + T.tell + T.squeeze; t < ev.hold.secs; t += cyc) out.push({ at: ev.hold.z + v * t, dist: rel((x, y) => T.min - 0.3 - Math.hypot(x, y)) });
        return out;
      }
    }
    return [];
  },
  init(api) {
    initSwarm(api);
    if (!crackObj) { const m = morphModel(CRACK.crack, null); crackObj = m.group; crackObj.visible = false; api.scene.add(crackObj); }
  },
  // (the crack is shown only by a cracked flock drawing it this frame)
  begin(api) { swarmBegin(api); if (crackObj) crackObj.visible = false; },
  warm(api) {
    // the swarm, its outline layer and the crack compile on the loading screen, not on the first flock
    swarmBegin(api); for (let i = 0; i < 16; i++) { moth(i, (i - 8) * 0.8, 0, -40, 1.4, i, i % 2 ? MOTH.PEARL : MOTH.BRIGHT); outline(i * 0.5, 1, -40, 0.5); } swarmEnd();
    crackObj.visible = true; crackObj.position.set(0, -2, -40);
    return () => { crackObj.visible = false; swarmBegin(api); swarmEnd(); };
  },
  end() { swarmEnd(); },
  spawn(e, ev, api) {
    const b = api.box;
    e.R = rng(ev.seed ?? (e.id * 7919));
    e.key = ev.key; e.n = ev.warm ? 40 : api.tierCount(ev.n || 340);
    e.s = shapeOf(ev, b); e.shape = SHAPES[ev.shape || 'wall'];
    e.P = e.shape.fill(e.s, e.n, e.R, b); e.T = null; e.P0 = null;
    e.script = (ev.script || []).slice(); e.inhale = 0; e.flow = 0; e.next = null; e.nextShape = null;
    e.scatter = 0; e.hit = false; e.cond = 0; e.clock = 0; e.harmless = !!ev.decor || !!e.shape.harmless;
    e.hold = ev.hold || null; e.held = 0; e.holding = false; e.squeeze = null; e.sq = 1;
    e.V = null; e.crack = ev.crack ? { x: ev.crack.nx * b.x, y: ev.crack.ny * b.y } : null;
  },
  update(e, dt, api) {
    const v = Math.max(1, api.v), ship = api.ship;
    e.clock += dt * (e.inhale > 0 ? 0.35 : 1);          // its wings slow as it inhales
    // ---- a tube flies with you: it holds station once its middle is `hold.z` ahead, for `hold.secs`, then lets go
    if (e.hold) {
      if (!e.holding && e.held === 0 && e.z >= e.hold.z) e.holding = true;
      if (e.holding) { e.z -= v * dt; e.held += dt; if (e.held >= e.hold.secs && !e.scatter) { e.scatter = 0.001; api.game.sfx('g2-flock-scatter', { vol: 0.6 }); } if (e.scatter > 1.6) e.holding = false; }
    }
    // ---- the script: inhale (slow, bright, the next shape's outline), then flow into it
    const tOut = -e.z / v;
    if (!e.next && e.script.length && tOut <= e.script[0].t && !e.scatter) {
      const step = e.script.shift();
      e.next = shapeOf(Object.assign({}, step.to), api.box); e.nextShape = SHAPES[step.to.shape || 'wall'];
      e.T = e.nextShape.fill(e.next, e.n, e.R, api.box); e.inhale = 0.001; e.flow = 0;
      api.game.sfx('g2-flock-shift', { vol: clamp(1 - tOut / 5, 0.3, 0.9) });
    }
    if (e.inhale > 0) { e.inhale += dt; if (e.inhale >= INHALE) { e.inhale = 0; e.flow = 0.001; e.P0 = e.P; } }
    if (e.flow > 0) { e.flow += dt; if (e.flow >= FLOW) { e.flow = 0; e.P = e.T; e.T = null; e.P0 = null; e.s = e.next; e.shape = e.nextShape; e.next = null; } }
    // ---- the tube's squeezes: glow (the tell), squeeze in, hold, ease back, rest
    if (e.holding && e.s.shape === 'tube' && !e.scatter) {
      const T = TUBE, cyc = T.tell + T.squeeze + T.hold + T.back + T.rest, c = (e.held - 0.6) % cyc;
      if (e.held > 0.6) {
        if (c < T.tell) { e.sq = 1; e.tell = c / T.tell; e.pinched = false; }
        else if (c < T.tell + T.squeeze) { e.tell = 1; e.sq = 1 - (1 - T.min / e.s.r) * ((c - T.tell) / T.squeeze); }
        else if (c < T.tell + T.squeeze + T.hold) { e.tell = 0; e.sq = T.min / e.s.r; }
        else if (c < T.tell + T.squeeze + T.hold + T.back) { e.tell = 0; e.sq = T.min / e.s.r + (1 - T.min / e.s.r) * ((c - T.tell - T.squeeze - T.hold) / T.back); }
        else { e.tell = 0; e.sq = 1; }
      }
      const R = e.s.r * e.sq;
      if (R < e.s.r * 0.7 && !e.pinched && Math.hypot(ship.x - e.x, ship.y - e.y) > R - 0.3) { e.pinched = true; api.game.crash(e, 12, true); }
    } else e.tell = 0;
    // ---- scatter: every moth drifts out from the middle and fades (snow)
    if (e.scatter) {
      e.scatter += dt;
      if (!e.V) { e.V = e.P.map(([x, y, z]) => { const d = Math.hypot(x, y) || 1; return [x / d * e.R.range(2, 7) + e.R.range(-2, 2), y / d * e.R.range(2, 7) + e.R.range(-1, 3), e.R.range(-3, 3)]; }); }
    }
    // ---- collisions: a thin shape is tested as it crosses your plane; a long one while it spans it
    if (!e.harmless && !e.scatter && !e.hit && e.flow === 0) {
      const sx = ship.x - e.x, sy = ship.y - e.y, sh = e.shape, s = e.s;
      // (threading a hole or a gap with under a metre to spare is a CLOSE call, as a girder is)
      if (sh.thin && e.pz < 0 && e.z >= 0) { if (sh.solid(s, sx, sy)) { e.hit = true; api.game.crash(e, 12, true); } else if (sh.solid(s, sx, sy, 1.0)) api.game.scrape(e, 0.5); }
      else if (s.shape === 'funnel' && Math.abs(e.z) < s.len / 2) { const f = sh.radiusAt(s, -e.z); if (Math.hypot(sx - f.cx, sy - f.cy) > f.r - 0.4) { e.hit = true; api.game.crash(e, 12, true); } }
      else if (s.shape === 'spiral' && Math.abs(e.z) < s.len / 2) { const [ax, ay] = sh.armAt(s, -e.z); if (Math.hypot(sx - ax, sy - ay) < 1.1) { e.hit = true; api.game.crash(e, 12, true); } }
      else if (s.shape === 'pocket') {
        // through the cap as it reaches you, or across the side while it spans you (in or out): solid, unless phasing
        const inside = Math.hypot(sx - s.hx, sy - s.hy) < s.r + 0.3, cap = e.z - s.len / 2, capP = e.pz - s.len / 2, span = cap < 0 && e.z + s.len / 2 > 0;
        if (capP < 0 && cap >= 0 && inside) { e.hit = true; api.game.crash(e, 12, true); }
        else if (span && e.wasIn !== undefined && inside !== e.wasIn) { e.hit = true; api.game.crash(e, 12, true); }
        e.wasIn = span ? inside : undefined;
      }
    }
    draw(e, dt, api);
    const ext = e.s.len ? e.s.len / 2 : 2;
    if (e.z - ext > 14 && !e.holding) e.alive = false;
  },
  // the bots read the shape: the spiral's arm where it will cross, the wave's band (a row of circles), a wheel's spokes
  avoid(e) {
    if (e.harmless || e.scatter) return [];
    const s = e.s, out = [];
    if (s.shape === 'spiral' && Math.abs(e.z) < s.len / 2 + 60) { for (let k = 0; k < 4; k++) { const [x, y] = SHAPES.spiral.armAt(s, -e.z + k * 12); out.push({ x: e.x + x, y: e.y + y, r: 1.8 }); } }
    else if (s.shape === 'wave' && e.z < 0) { for (let x = -9; x <= 9; x += 1.5) out.push({ x: e.x + x, y: e.y + SHAPES.wave.at(s, x, 0), r: 1.7 }); }
    else if (s.shape === 'pocket' && e.z - s.len / 2 < 0) out.push({ x: e.x + s.hx, y: e.y + s.hy, r: s.r + 1.5 });
    else if (s.shape === 'wheel' && e.z < 0) { const a = SHAPES.wheel.angle(s, 0); out.push({ x: e.x, y: e.y, r: 1.9 }); for (let k = 0; k < s.spokes; k++) for (const r of [2.5, 4, 5.5, 7]) { const b = a + k / s.spokes * Math.PI * 2; out.push({ x: e.x + Math.cos(b) * r, y: e.y + Math.sin(b) * r, r: 1.15 }); } }
    return out;
  },
});

// the wheel's surface: its hub and its spokes (as SHAPES.wheel.solid, as a distance)
function wheelDist(s, x, y) {
  const d = Math.hypot(x, y), a = Math.atan2(y, x) - SHAPES.wheel.angle(s, 0); let m = d - 1.4;
  for (let k = 0; k < s.spokes; k++) { const b = a - k / s.spokes * Math.PI * 2, along = d * Math.cos(b), across = Math.abs(d * Math.sin(b)); m = Math.min(m, along > 0 ? across - 0.7 : d - 0.7); }
  return m;
}
const tmpQ = new THREE.Quaternion();
function draw(e, dt, api) {
  const a = e.appear, sc = e.scatter, fade = sc ? clamp(1 - sc / 1.8, 0, 1) : 1, s = e.s, sh = e.shape;
  const size = 1.45 * a * (sc ? 0.45 + 0.55 * fade : 1) * (1 + 0.12 * (e.tell || 0)), bright = e.inhale > 0 || (e.tell || 0) > 0.5;
  if (size < 0.004) return;
  const col = bright ? BRIGHT : PEARL, t = e.clock, n = e.P.length;
  const k = e.flow > 0 ? e.flow / FLOW : 0, kk = k * k * (3 - 2 * k);
  const spin = s.shape === 'tube' ? e.clock * 0.5 : 0;
  for (let i = 0; i < n; i++) {
    let [x, y, z] = e.P[i];
    if (e.flow > 0) { const q = e.T[i], p = e.P0[i]; x = p[0] + (q[0] - p[0]) * kk; y = p[1] + (q[1] - p[1]) * kk; z = p[2] + (q[2] - p[2]) * kk; }
    else if (s.shape === 'wave') y = SHAPES.wave.at(s, x, e.z + z) + y;
    else if (s.shape === 'wheel') { const ang = SHAPES.wheel.angle(s, e.z) - s.a0, c = Math.cos(ang), sn = Math.sin(ang); const x2 = x * c - y * sn; y = x * sn + y * c; x = x2; }
    else if (s.shape === 'tube') { const c = Math.cos(spin), sn = Math.sin(spin), r = s.r * e.sq * (1 + 0.04 * Math.sin(i * 3.1 + t * 2)); const x2 = (x * c - y * sn) * r; y = (x * sn + y * c) * r; x = x2; }
    if (sc) { const vv = e.V[i]; x += vv[0] * sc; y += vv[1] * sc; z += vv[2] * sc; }
    // a little flutter of its own, so the shape breathes
    x += Math.sin(t * 2.3 + i) * 0.12; y += Math.cos(t * 1.9 + i * 1.3) * 0.12;
    moth(i, e.x + x, e.y + y, e.z + z, size * (0.8 + (i % 5) * 0.1), t, col);
  }
  // the inhale: a faint outline of the next shape, where each moth is about to go
  if (e.inhale > 0 && e.T) { const al = Math.min(1, e.inhale / 0.3) * 0.5 * a; for (let i = 0; i < e.T.length; i += 2) { const q = e.T[i]; outline(e.x + q[0], e.y + q[1], e.z + q[2], al); } }
  // the tube's tell: the ring it will squeeze to, glowing where it will be
  if (s.shape === 'tube' && e.tell > 0) for (let i = 0; i < 48; i++) { const an = i / 48 * Math.PI * 2; outline(e.x + Math.cos(an) * TUBE.min, e.y + Math.sin(an) * TUBE.min, -6, 0.55 * e.tell, 1.2); }
  // a phase patch: Yori's violet crack laid on the wall, with amber sparks at its edge (something to collect behind it)
  if (e.crack && !sc) {
    const cz = e.z + (s.shape === 'pocket' ? -s.len / 2 - 0.9 : 0.9);
    crackObj.visible = a > 0.02; crackObj.position.set(e.x + e.crack.x, e.y + e.crack.y, cz); crackObj.scale.setScalar(0.62 * a);
    for (let i = 0; i < 10; i++) { const an = i / 10 * Math.PI * 2 + t; SW.out.push(e.x + e.crack.x + Math.cos(an) * 2.2, e.y + e.crack.y + Math.sin(an) * 2.0, cz, 0.8, 1, 0.8, 0.2, 0.55 * a); }
  }
}
// a conductor tells its flock it has come (so the flock knows how many it must lose before it breaks)
export function joined(flock) { flock.cond++; }
// the last of a flock's conductors is down: it scatters into drifting sparks (a wall becomes snow)
export function conductorDown(flock, api) {
  flock.cond = Math.max(0, flock.cond - 1);
  if (flock.cond === 0 && !flock.scatter) { flock.scatter = 0.001; api.game.sfx('g2-flock-scatter', { vol: 0.8 }); api.game.call('SCATTERED!', 'c-cyan'); }
}
export { SHAPES, shapeOf };
