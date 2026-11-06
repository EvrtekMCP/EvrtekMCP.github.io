// LEVEL 6 course kinds. The headline is THE PASS: the Leviathan is behind you and surges past down the canyon. The
// rest is the canyon's furniture, all "space" pieces with red-lit edges where they hurt (rule 9 and 11): SPURS of
// ice from the left or right wall, CURTAINS of ice from the top or the floor, and the FORK, a glacier spire that
// splits the canyon into a left and a right channel for a while (the twist).
import { THREE, defineObstacle, clamp, smoothstep, SHIP_R, SPAWN_D } from '../../api.js?v=0.2.0';
import { Serpent } from '../../bosses/leviathan/serpent.js?v=0.2.0';
import { RIFT } from './scenery.js?v=0.2.0';

// ------------------------------------------------------------------ shared ice
let ice = null, crack = null, clearIce = null;
function mats() {
  if (ice) return;
  // the ice that hurts is old, dense, dark-blue ice (the walls are pale): it reads by value against them (rule 8), and its
  // edges carry the Lattice's red cracks (rule 9: red hurts)
  ice = new THREE.MeshStandardMaterial({ color: 0x2c5684, metalness: 0.1, roughness: 0.28, flatShading: true, side: THREE.DoubleSide, emissive: 0x0c1c38, emissiveIntensity: 0.6 });
  crack = new THREE.MeshBasicMaterial({ color: 0xff3355 });
}
// a faceted column: polygon `pts` ([x, z] pairs, in order) extruded along Y from y0 to y1, its outline jittered at
// `rows` heights so the faces break up like ice. Non-indexed: every face flat.
function icePrism(pts, y0, y1, rows, seed, jit = 0.6) {
  let s = seed * 9301 + 49297; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const ring = [];
  for (let r = 0; r <= rows; r++) {
    const y = y0 + (y1 - y0) * r / rows, edge = r === 0 || r === rows;
    ring.push(pts.map(([x, z]) => [x + (edge ? 0 : (rnd() - 0.5) * jit), y + (edge ? 0 : (rnd() - 0.5) * jit * 2), z + (edge ? 0 : (rnd() - 0.5) * jit)]));
  }
  const p = [], n = pts.length, tri = (a, b, c) => p.push(...a, ...b, ...c);
  for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) { const j = (i + 1) % n, a = ring[r][i], b = ring[r][j], c = ring[r + 1][j], d = ring[r + 1][i]; tri(a, b, c); tri(a, c, d); }
  for (let i = 1; i + 1 < n; i++) { tri(ring[0][0], ring[0][i], ring[0][i + 1]); tri(ring[rows][0], ring[rows][i + 1], ring[rows][i]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
const redBar = (w, h, d) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), crack);

// ------------------------------------------------------------------ SPUR: ice from a side wall into the lane
// ev: side (-1 the left wall, +1 the right), to (the tip, in nx: the lane is open beyond it). Full height.
function makeSpur() {
  mats();
  const g = new THREE.Group();
  // a wedge pointing +X (into the lane), the tip at x = 0, running back 16 m into the wall; 9 m deep at the wall
  const body = new THREE.Mesh(icePrism([[0.3, -0.4], [-4, -3.4], [-16, -4.5], [-16, 4.5], [-4, 3.4], [0.3, 0.4]], -26, 26, 6, 3, 0.9), ice);
  g.add(body);
  const edge = redBar(0.32, 52, 0.32); edge.position.set(0.45, 0, 0); g.add(edge); // the tip's red crack: the line that hurts
  for (const y of [-9, 4, 15]) { const c = redBar(5, 0.12, 0.12); c.position.set(-2.2, y, 3.0); c.rotation.z = 0.5; g.add(c); }
  return g;
}
export const spur = defineObstacle({
  name: 'l6-spur',
  hazard: { cls: 'static', introduced: 6 },
  breaks: false,
  sample: { side: -1, to: -0.3 },
  spawn(e, ev, api) {
    e.obj = api.course.get('l6-spur', makeSpur);
    e.side = ev.side || -1; e.tip = (ev.to ?? -0.3) * api.box.x; e.x = e.tip; e.y = 0;
    e.obj.rotation.y = e.side < 0 ? 0 : Math.PI; // the right-hand spur points -X
    e.checked = false;
  },
  avoid: (e) => [{ x: e.tip + e.side * 6, y: 0, r: 6 + 1.8 }],
  update(e, dt, api) {
    const a = e.appear; e.obj.position.set(e.x, 0, e.z); e.obj.scale.set(a, a, a);
    if (!e.checked && (e.crossed || Math.abs(e.z) < 1.2)) {
      e.checked = true;
      const into = (api.ship.x - e.tip) * e.side; // > 0: on the wall side of the tip (left wall: x below the tip)
      if (into > -SHIP_R * 0.8) api.game.crash(e, 22);
      else if (into > -SHIP_R - 2.2) api.game.scrape(e, -into);
    }
    if (e.z > 20) e.alive = false;
  },
});

// ------------------------------------------------------------------ CURTAIN: ice hanging from above, or a ridge from below
// ev: from ('top' or 'bottom'), to (the edge, in ny). Wall to wall.
function makeCurtain() {
  mats();
  const g = new THREE.Group();
  // a slab whose lower edge is at y = 0, rising 30 m, 6 m deep, 40 wide (scaled to the canyon); icicle teeth below
  const slab = new THREE.Mesh(icePrism([[-20, -3], [20, -3], [20, 3], [-20, 3]], 0.4, 30, 5, 7, 1.2), ice); g.add(slab);
  const teeth = [];
  for (let i = 0; i < 16; i++) { const x = -19 + i * 2.53, h = 0.9 + ((i * 7) % 5) * 0.12; teeth.push([x, h]); }
  const tg = new THREE.ConeGeometry(0.75, 1, 5); tg.translate(0, -0.5, 0);
  for (const [x, h] of teeth) { const t = new THREE.Mesh(tg, ice); t.position.set(x, 0.5, 0); t.scale.set(1, h, 1); g.add(t); }
  const edge = redBar(40, 0.26, 0.26); edge.position.set(0, 0.3, 3.1); g.add(edge); // the edge that hurts
  const edge2 = edge.clone(); edge2.position.z = -3.1; g.add(edge2);
  return g;
}
export const curtain = defineObstacle({
  name: 'l6-curtain',
  hazard: { cls: 'static', introduced: 6 },
  sample: { from: 'top', to: 0.2 },
  spawn(e, ev, api) {
    e.obj = api.course.get('l6-curtain', makeCurtain);
    e.dir = ev.from === 'bottom' ? -1 : 1; e.edge = (ev.to ?? 0.2) * api.box.y; e.x = 0; e.y = e.edge;
    e.obj.rotation.z = e.dir > 0 ? 0 : Math.PI; // the floor ridge is the curtain upside down
    e.w = (api.box.x + RIFT.gapAt(api.G.courseD + (-e.z)) + 4) / 20;
    e.checked = false;
  },
  avoid: (e) => [{ x: 0, y: e.edge + e.dir * 8, r: 8 + 1.9 }, { x: -6, y: e.edge + e.dir * 8, r: 9.9 }, { x: 6, y: e.edge + e.dir * 8, r: 9.9 }],
  update(e, dt, api) {
    const a = e.appear; e.obj.position.set(0, e.edge, e.z); e.obj.scale.set(e.w * a, a, a);
    if (!e.checked && (e.crossed || Math.abs(e.z) < 1.2)) {
      e.checked = true;
      const into = (api.ship.y - e.edge) * e.dir + 1.0; // the teeth reach about 1 m past the edge line
      if (into > -SHIP_R * 0.8) api.game.crash(e, 22);
      else if (into > -SHIP_R - 2.2) api.game.scrape(e, -into);
    }
    if (e.z > 20) e.alive = false;
  },
});

// ------------------------------------------------------------------ THE FORK: a glacier spire down the middle
// ev: len (metres of spire), hw (half width, in nx). The prow points at you; the spire runs on behind it.
const FORK_RAMP = 26;
function makeFork() {
  mats();
  const g = new THREE.Group(), L = 400;
  // unit half-width 1: the prow at z = 0, full width 26 m behind it; long enough for any fork (scaled in z per use)
  const pts = [[0, 0.2], [0.55, -FORK_RAMP * 0.5], [1, -FORK_RAMP], [0.9, -L * 0.5], [1, -L + 30], [0, -L], [-1, -L + 30], [-0.9, -L * 0.5], [-1, -FORK_RAMP], [-0.55, -FORK_RAMP * 0.5]];
  // clear glacier ice: you see the other channel through it, and the Leviathan when it takes that channel. Its prow
  // is solid dark ice with the red crack, the line that hurts.
  clearIce ||= new THREE.MeshStandardMaterial({ color: 0x7ab8e0, metalness: 0.1, roughness: 0.15, flatShading: true, side: THREE.DoubleSide, emissive: 0x1e3a60, emissiveIntensity: 0.5, transparent: true, opacity: 0.38, depthWrite: false });
  const body = new THREE.Mesh(icePrism(pts, -28, 28, 7, 11, 0.25), clearIce); body.renderOrder = 3; g.add(body);
  const nose = new THREE.Mesh(icePrism([[0, 0.2], [0.55, -FORK_RAMP * 0.5], [0.8, -FORK_RAMP * 0.8], [-0.8, -FORK_RAMP * 0.8], [-0.55, -FORK_RAMP * 0.5]], -28, 28, 7, 13, 0.2), ice); g.add(nose);
  const prow = redBar(0.34, 56, 0.34); prow.position.set(0, 0, 0.3); g.add(prow);
  for (const s of [-1, 1]) for (const y of [-6, 0, 6]) { const c = redBar(0.12, 0.12, FORK_RAMP * 0.8); c.position.set(s * 0.45, y, -FORK_RAMP * 0.4); c.rotation.y = -s * 0.034; g.add(c); }
  g.userData.L = L;
  return g;
}
export const fork = defineObstacle({
  name: 'l6-fork',
  hazard: { cls: 'static', introduced: 6 },
  sample: { len: 200, hw: 0.2 },
  spawn(e, ev, api) {
    e.obj = api.course.get('l6-fork', makeFork);
    e.len = ev.len || 220; e.hw = (ev.hw || 0.2) * api.box.x; e.x = 0; e.y = 0; e.hitT = 0; e.scraped = false;
  },
  // half width of the spire at the ship's plane (0 when the plane is not inside it)
  avoid: (e) => (e.z > -260 && e.z - e.len < 0 ? [{ x: 0, y: 0, r: e.hw + 2.2 }, { x: 0, y: 3, r: e.hw + 2.2 }, { x: 0, y: -3, r: e.hw + 2.2 }] : []),
  update(e, dt, api) {
    const a = e.appear;
    // the spire keeps its length (its far end is beyond the haze when it is born): only its width grows in
    e.obj.position.set(0, 0, e.z); e.obj.scale.set(e.hw * a, a, e.len / e.obj.userData.L * a);
    if (e.z >= -1 && e.z - e.len <= 1) {
      const zl = -e.z, w = zl < FORK_RAMP ? e.hw * clamp(0.1 + zl / FORK_RAMP, 0, 1) : e.hw; // its half width here
      const gap = Math.abs(api.ship.x) - w;
      e.hitT -= dt;
      if (gap < SHIP_R * 0.8 && e.hitT <= 0) { e.hitT = 0.9; api.game.crash(e, 16, true); }
      else if (gap < SHIP_R + 2.0 && !e.scraped) { e.scraped = true; api.game.scrape(e, gap); }
    }
    if (e.z - e.len > 30) e.alive = false;
  },
});

// ------------------------------------------------------------------ THE PASS: the Leviathan surges past
// ev: lane ('L' 'R' 'T' 'B': half the box; 'EL' 'ER': along a wall, outside the box: harmless, the teacher),
//     warn (seconds from the lane lighting to its head reaching you), hold (seconds it runs beside you before it
//     surges on: the set piece), quiet (no call-out).
// THE TELL (rule 11, in layers): the lane it will take lights red down the canyon ahead of you, the side arrow
// flashes, it roars, a red glare comes up behind you. THE TIMING (rule 12): warn >= 1.2 s while it is new, >= 1.0 s
// after (a lane sweep). Its body then fills that lane for about a second and it dives into the ice ahead.
export const PASS = { u: 78, scale: 1.8, segs: 8, exitZ: 170 };
function laneOf(lane, box, R) {
  const m = SHIP_R + R + 0.05 * box.x, my = SHIP_R + R + 0.05 * box.y;
  switch (lane) {
    case 'L': return { x: 0.05 * box.x - m, y: 0, side: -1, axis: 'x' };
    case 'R': return { x: -0.05 * box.x + m, y: 0, side: 1, axis: 'x' };
    case 'T': return { x: 0, y: 0.05 * box.y + my, side: 1, axis: 'y' };
    case 'B': return { x: 0, y: -0.05 * box.y - my, side: -1, axis: 'y' };
    case 'EL': return { x: -(box.x + R + 0.9), y: -0.5, side: -1, axis: 'x', edge: true };
    default: return { x: box.x + R + 0.9, y: -0.5, side: 1, axis: 'x', edge: true }; // 'ER'
  }
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = 16; c.height = 256;
  const g = c.getContext('2d');
  for (let y = 0; y < 256; y++) { const k = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(y / 256 * Math.PI * 2 * 6), 3); g.fillStyle = 'rgba(255,255,255,' + k.toFixed(3) + ')'; g.fillRect(0, y, 16, 1); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
let glowTex = null;
function makePass(api) {
  const s = new Serpent(PASS.segs, PASS.scale);
  const g = s.root; g.userData.serpent = s;
  glowTex ||= glowTexture();
  // the lit lane: a long red tube of light ahead of you, its bands rushing down the canyon the way it will go
  const lm = new THREE.MeshBasicMaterial({ color: 0xff3355, map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const lg = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true); lg.rotateX(Math.PI / 2); lg.translate(0, 0, -0.5);
  const lane = new THREE.Mesh(lg, lm); lane.frustumCulled = false; lane.renderOrder = 2;
  // the glare behind you: its maw's light, coming up
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, fog: false }));
  const keep = new THREE.Group(); keep.add(lane, glare);
  g.userData.lane = lane; g.userData.glare = glare; g.userData.keep = keep;
  return g;
}
export const pass = defineObstacle({
  name: 'l6-pass',
  motion: 'own', spawnAt: 'now',
  hazard: { cls: 'sweep', introduced: 6, warn: (ev) => ev.warn || 1.2 },
  sample: { lane: 'L', warn: 1.4 },
  spawn(e, ev, api) {
    e.obj = api.course.get('l6-pass', () => makePass(api));
    const ud = e.obj.userData, S = ud.serpent;
    if (!ud.keep.parent) api.scene.add(ud.keep);
    ud.keep.visible = true;
    e.S = S; e.W = ev.warn || 1.2; e.hold = ev.hold || 0;
    // rule 30: its head lands ON a beat of the music. The course places it for a bar line at the level's own speeds;
    // if GREED has you there early, the warning stretches to the next beat (never shrinks: at most one beat longer)
    const mu = api.music, m = mu && mu.meta;
    if (m && m.bpm && !ev.warm && mu.position() >= 0) {
      const beat = 60 / m.bpm, tArr = mu.position() + e.W, n = Math.ceil((tArr - (m.firstBeat || 0)) / beat - 0.04);
      e.W += Math.max(0, (m.firstBeat || 0) + n * beat - tArr);
    }
    const ln = laneOf(ev.lane || 'L', api.box, S.maxR);
    e.lane = ln; e.x = ln.x; e.y = ln.y; e.z = -SPAWN_D; // its course position (unused): it moves itself
    e.D = 0; e.t = 0; e.v0 = Math.max(40, api.v);
    e.hit = false; e.closeT = 0; e.done = false; e.passed = false; e.sprayed = 0;
    // the head's path is fixed in the TRACK (zeta: metres along the canyon from where you were when it lit): in from
    // behind and below, into the lane, along it, and out into the wall (or the floor, or the sky) far ahead
    const W = e.W, v0 = e.v0, u = PASS.u, H = e.hold;
    const sx = ln.axis === 'x' ? Math.sign(ln.x) || -1 : 0, sy = ln.axis === 'y' ? Math.sign(ln.y) : 0;
    e.entry = [ln.x + (sx || 0.4) * 12, ln.y + (sy || -1) * 9];
    e.in0 = -v0 * W + 50; e.in1 = -v0 * W - 6;
    const tExit = H ? W + 28 / u + H + (PASS.exitZ - 28) / (1.15 * u) : W + PASS.exitZ / u; // when its head is exitZ ahead
    e.out0 = -PASS.exitZ - v0 * tExit; e.out1 = e.out0 - 110;
    const gap = RIFT.gapAt(api.G.courseD || 0);
    e.exit = ln.axis === 'x' ? [sx * (api.box.x + gap + 16), ln.y - 6] : [ln.x + 3, sy > 0 ? api.box.y + 46 : -api.box.y - 40];
    // the lane light
    const lane = ud.lane; lane.position.set(ln.x, ln.y, -2); lane.scale.set(S.bodyR, S.bodyR, 280);
    lane.material.opacity = 0; ud.glare.material.opacity = 0;
    if (!ev.warm) {
      if (ln.axis === 'x') api.game.warn(ln.side, W + 0.4);
      api.game.sfx('boom', { rate: 0.42, vol: ln.edge ? 0.7 : 0.95, pan: ln.side * 0.5 });
      if (ev.call) api.game.call(ev.call, 'c-red');
    }
    if (ev.warm) { e.t = W; } // the loading screen: its body in view, so its shaders compile there
    S.root.visible = true;
    for (let i = 0; i < S.n; i++) { S.setLens(i, 'idle'); S.setJoint(i, 0.6); }
    S.setTips(0); S.setThroat(0.2); S.setJaw(0.3);
  },
  // the head's distance behind (+) or ahead (-) of the ship's plane at time t
  headZ(e, t) {
    const u = PASS.u, W = e.W, H = e.hold;
    if (!H) return u * (W - t);
    const zb = -28; // runs beside you, its head 28 m ahead, for H seconds
    const tb = W + 28 / u;
    if (t < tb) return u * (W - t);
    if (t < tb + H) return zb + Math.sin((t - tb) * 1.8) * 3;
    return zb - u * 1.15 * (t - tb - H);
  },
  avoid(e) {
    if (e.done || e.t > e.W + e.hold + 2.4) return [];
    const L = e.lane, R = e.S.maxR + 1.8, out = [];
    // a row of circles across the lane's half, so the pilot's target is pushed fully into the safe half
    if (L.axis === 'x') for (const y of [-4, 0, 4]) out.push({ x: L.x, y, r: R });
    else for (const x of [-6, -2, 2, 6]) out.push({ x, y: L.y, r: R });
    return L.edge ? [] : out;
  },
  update(e, dt, api) {
    const ud = e.obj.userData, S = e.S, ship = api.ship, L = e.lane;
    e.D += api.v * dt; // (e.t is the engine's: its age)
    e.obj.position.set(0, 0, 0); e.obj.scale.set(1, 1, 1); // the body's parts carry their own places (the engine posed the root at spawn)
    const t = e.t, W = e.W;
    // ---- the lane light: up over the warning, pulsing; it goes as the body takes the lane
    const k = clamp(t / W, 0, 1), pulse = 0.75 + 0.25 * Math.sin(t * 22);
    const fade = 1 - smoothstep(W + 0.15, W + 0.7 + e.hold, t);
    ud.lane.material.opacity = (0.06 + 0.3 * k * k) * pulse * fade * (L.edge ? 0.7 : 1);
    ud.lane.material.map.offset.y = (ud.lane.material.map.offset.y - dt * 2.4) % 1;
    // the glare of its maw, coming up the lane from behind you: low at the lane's near end
    ud.glare.position.set(L.x + (L.axis === 'x' ? L.side * 1.5 : 0), L.y + (L.axis === 'y' ? L.side * 1.5 : -1.5), -14);
    ud.glare.scale.setScalar(5 + 9 * k);
    ud.glare.material.opacity = 0.5 * k * k * fade;
    // ---- the body
    const hz = this.headZ(e, t), zh = hz - e.D; // head's track position
    const path = (zeta) => {
      let x = L.x, y = L.y;
      const sway = Math.sin(zeta * 0.045 + e.id) * 0.45;
      if (L.axis === 'x') y += sway; else x += sway;
      const a = smoothstep(e.in1, e.in0, zeta); // 1 = still at the entry point, behind you
      x += (e.entry[0] - x) * a; y += (e.entry[1] - y) * a;
      const b = smoothstep(e.out0, e.out1, zeta); // 1 = gone into the ice ahead
      x += (e.exit[0] - x) * b * b; y += (e.exit[1] - y) * b * b;
      return [x, y];
    };
    S.pose((s) => { const zeta = zh + s; const p = path(zeta); return [p[0], p[1], zeta + e.D]; });
    S.setJaw(0.35 + 0.25 * Math.sin(t * 7));
    for (let i = 0; i < S.n; i++) S.setJoint(i, 0.7 + 0.3 * Math.sin(t * 9 - i * 0.8));
    // ---- the ice it breaks: spray where its head goes into the wall
    const head = S.items[0].pos;
    e.x = head.x; e.y = head.y; e.z = head.z; // the entity is where its head is (behind you while it is coming)
    if (zh < e.out0 + 20 && zh > e.out1 - 40 && e.sprayed < 26 && head.z > -SPAWN_D * 0.7) { e.sprayed++; api.game.burst(head.x, head.y, head.z, 14, { speed: 14, life: 0.9, s0: 2.2, r: 0.8, g: 0.95, b: 1, carry: 1, drag: 1.2 }); }
    if (L.edge && Math.abs(head.z) < 30 && e.sprayed < 26) { e.sprayed++; api.game.burst(L.x - L.side * 2.5, head.y, Math.min(4, head.z), 6, { speed: 10, life: 0.6, s0: 1.6, r: 0.85, g: 0.97, b: 1, carry: 1, drag: 1.5 }); }
    if (!e.passed && hz < 0) { e.passed = true; api.game.shake(L.edge ? 0.35 : 0.6); api.game.sfx('boom', { rate: 0.55, vol: 0.8, pan: L.side * 0.6 }); }
    // ---- touching it: a big hit; flying close to it pays (CLOSE), at most four times a second
    const [gap] = S.near(ship.x, ship.y, 1.5);
    if (gap < SHIP_R * 0.8 && !e.hit && !e.ev.warm) { e.hit = true; api.game.crash({ x: ship.x, y: ship.y, z: 0, type: 'leviathan' }, 26); }
    e.closeT -= dt;
    if (gap >= SHIP_R * 0.8 && gap < SHIP_R + 2.4 && e.closeT <= 0 && !e.hit) { e.closeT = 0.25; api.game.scrape(e, gap); }
    // ---- gone: its tail is into the ice
    if (zh + S.length < e.out1 - 10 || t > W + e.hold + 9) { e.alive = false; e.done = true; }
  },
  remove(e, api) {
    const ud = e.obj.userData; ud.lane.material.opacity = 0; ud.glare.material.opacity = 0; ud.keep.visible = false;
    api.course.put('l6-pass', e.obj); e.obj = null;
  },
});


// ------------------------------------------------------------------ ICEFALL: the Leviathan's wall slam (its boss phase 3)
// A slab of the canyon wall breaks off and drops into the lane on one side. It is born ahead, in plain view, already
// falling; a pale glow marks the wall where it broke away. It blocks that side beyond its edge (like a spur) once down.
// ev: side (-1 the left wall, +1 the right), to (its inner edge, in nx), fall (seconds to land)
function makeIcefall(api) {
  const g = makeSpur();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xd8fff0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  glow.scale.set(14, 30, 1); g.userData.glow = glow;
  return g;
}
export const icefall = defineObstacle({
  name: 'l6-icefall',
  hazard: { cls: 'static', introduced: 6 },
  sample: { side: -1, to: -0.2, fall: 0.01 },
  spawn(e, ev, api) {
    e.obj = api.course.get('l6-icefall', () => makeIcefall(api));
    const gl = e.obj.userData.glow; if (!gl.parent) api.scene.add(gl);
    e.side = ev.side || -1; e.tip = (ev.to ?? -0.2) * api.box.x; e.x = e.tip; e.y = 0;
    e.obj.rotation.y = e.side < 0 ? 0 : Math.PI; e.obj.rotation.z = 0;
    e.fall = ev.fall ?? 1.0; e.checked = false; e.landed = false;
    e.y = 150; e.appear = 0; // born above the view, already falling, and growing out of the haze of the break (no pop-in)
  },
  remove(e, api) { e.obj.userData.glow.material.opacity = 0; api.course.put('l6-icefall', e.obj); e.obj = null; },
  avoid: (e) => [{ x: e.tip + e.side * 6, y: 0, r: 6 + 1.8 }],
  update(e, dt, api) {
    const a = e.appear * Math.min(1, e.t / 0.6), k = Math.min(1, e.t / e.fall), drop = 1 - k * k;
    e.y = 150 * drop; // it drops in from above the top of the view (no pop-in)
    e.obj.position.set(e.x, e.y, e.z); e.obj.scale.set(1.7 * a, a, a); // x 1.7: long enough to reach the cavern's walls
    e.obj.rotation.z = e.side * 0.35 * drop;
    const gl = e.obj.userData.glow; gl.position.set(e.side * (api.box.x + 5), api.box.y + 14, e.z);
    gl.material.opacity = 0.45 * (1 - smoothstep(0.6, 2.2, e.t)) * a;
    if (k >= 1 && !e.landed) { e.landed = true; api.game.burst(e.x + e.side * 4, -api.box.y, e.z, 30, { speed: 12, life: 0.8, s0: 2, r: 0.85, g: 0.95, b: 1, carry: 1, drag: 1.4 }); }
    if (!e.checked && (e.crossed || Math.abs(e.z) < 1.2)) {
      e.checked = true;
      const into = (api.ship.x - e.tip) * e.side; // > 0: on the wall side of its edge
      if (into > -SHIP_R * 0.8 && k > 0.6) api.game.crash(e, 22);
      else if (into > -SHIP_R - 2.2) api.game.scrape(e, -into);
    }
    if (e.z > 20) e.alive = false;
  },
});

export const KINDS = [spur, curtain, fork, pass, icefall];
