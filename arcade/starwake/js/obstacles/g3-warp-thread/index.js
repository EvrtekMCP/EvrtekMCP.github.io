// THE WARP THREAD (galaxy 3, level 10, THE WEFTWORK, act 1; the plan's 4.10). Yori's warp thread (art-incoming/yori/g3/
// g3-enemies.js warpThread): a taut red thread stretched across the lane between two steel spools, 40 m long, at any
// angle. Taut, it is a thin line you skim past (a CLOSE call if you skim it near).
//   THE PLUCK  when a shuttle passes, the thread is plucked: it RINGS, its middle swinging fast to either side, and
//              the blur of it fills a lens across the lane (widest in the middle, `B` metres each way). Be outside the
//              lens when it reaches you.
//   THE TELL   for `tel` seconds (1.2; the first one 1.6) it brightens and hums, and the plan of the lens draws in white
//              (galaxy 3's promise: the white plan never lies). Then a shuttle zips along it from one spool to the other
//              and it rings, `lead` seconds (0.6) before it reaches you.
// ev: nx, ny (a point the thread passes through), a (its angle, radians: 0 lies across, PI/2 stands up), B (the lens's
//     half-width in the middle, metres; default 2.4), pluck (false: it stays taut), tel, lead, side (+1 / -1: the spool
//     the shuttle starts from), still (taut and never plucked: a static line).
// Every state is timed by its time to arrival (-z / speed), never the clock, so it rings where the course laid it at
// any speed, GREED included, and its tell always runs its full length.
import { THREE, defineObstacle, buildModel, clamp, smoothstep, SHIP_R, READ_D } from '../../api.js?v=0.4.1';
import { MESH } from './mesh.js?v=0.4.1';

const L = 40, HALF = L / 2, N = 28;                 // its length, and the points along it
const RED = new THREE.Color(0xff3355), HOT = new THREE.Color(0xffd8e0), WHITE = new THREE.Color(0xe8eeff);
const arriveOf = (e, api) => -e.z / Math.max(1, api.v);
// how far the middle of the string swings at s along it (0 at the spools, 1 in the middle)
const prof = (s) => Math.sin(Math.PI * clamp((s + HALF) / L, 0, 1));
// her spools, one each side (the thread itself is drawn live below, from her tube's numbers)
let SPOOL = null;
function spools() {
  if (SPOOL) return SPOOL;
  const keep = (sgn) => MESH.thread.filter((g) => !g.glow).map((g) => {
    const p = [];
    for (let i = 0; i < g.p.length; i += 9) { const cx = (g.p[i] + g.p[i + 3] + g.p[i + 6]) / 3; if (Math.sign(cx) === sgn) for (let k = 0; k < 9; k++) p.push(g.p[i + k]); }
    return Object.assign({}, g, { p });
  }).filter((g) => g.p.length);
  return (SPOOL = { L: keep(-1), R: keep(1) });
}

// a ribbon along the thread's length, in its own plane (the plane faces the ship): w(i) its width, off(i) its middle
function ribbon(mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((N + 1) * 2 * 3), 3));
  const idx = []; for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setIndex(idx);
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false;
  return m;
}
function setRibbon(m, lo, hi) {
  const P = m.geometry.attributes.position.array;
  for (let i = 0; i <= N; i++) {
    const s = -HALF + L * i / N, j = i * 6;
    P[j] = s; P[j + 1] = lo(s, i); P[j + 2] = 0;
    P[j + 3] = s; P[j + 4] = hi(s, i); P[j + 5] = 0;
  }
  m.geometry.attributes.position.needsUpdate = true;
}
const glowMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

function makeThread() {
  const g = new THREE.Group();
  const core = ribbon(new THREE.MeshBasicMaterial({ color: RED, side: THREE.DoubleSide }));
  const glow = ribbon(glowMat(RED, 0.22));
  const lens = ribbon(glowMat(0xff7090, 0));             // the blur of a ringing string
  const planA = ribbon(glowMat(WHITE, 0)), planB = ribbon(glowMat(WHITE, 0)); // the plan of the lens, white
  core.renderOrder = 2; g.add(lens, glow, core, planA, planB);
  const sp = spools(), left = buildModel(sp.L).group, right = buildModel(sp.R).group;
  left.position.x = -(HALF - 15); right.position.x = HALF - 15; // her spools sit at +-15 on a 30 m thread
  g.add(left, right);
  const shuttle = buildModel(MESH.shuttle).group; shuttle.scale.setScalar(1.3); g.add(shuttle);
  g.userData = { core, glow, lens, planA, planB, shuttle, last: -1 };
  return g;
}

export default defineObstacle({
  name: 'g3-warp-thread',
  // a plucked one: from the first readable sign (it hums and its lens's plan draws in) to the ship's plane
  hazard: { cls: 'sweep', introduced: [3, 10], warn: (ev, v) => (ev.still ? READ_D / v : (ev.lead ?? 0.6) + (ev.tel ?? 1.2)) },
  sample: { nx: 0, ny: 0, a: 0, B: 2.4 },
  // 0.3.1's no-blocked check: where it is solid as it reaches your plane (the same shape its hit tests): a plucked
  // thread is its whole ringing lens, a taut one the thread itself. The distance from a ship centre to that surface.
  solid(ev, B) {
    const a = ev.a || 0, ux = Math.cos(a), uy = Math.sin(a), x0 = ev.x ?? (ev.nx || 0) * B.x, y0 = ev.y ?? (ev.ny || 0) * B.y, b = ev.still ? 0 : ev.B ?? 2.4;
    return [{ dist: (x, y) => { const dx = x - x0, dy = y - y0, s = dx * ux + dy * uy; if (Math.abs(s) >= HALF) return 99; return Math.abs(-dx * uy + dy * ux) - (b * prof(s) + 0.12); } }];
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('g3-warp-thread', makeThread);
    e.sx = e.sy = e.sz = 1;
    e.a = ev.a || 0; e.B = ev.B ?? 2.4; e.tel = ev.tel ?? 1.2; e.lead = ev.lead ?? 0.6; e.side = ev.side || (ev.a > 0 ? -1 : 1);
    e.still = !!ev.still; e.hit = false; e.hummed = false; e.plucked = false; e.amp = 0;
    e.ux = Math.cos(e.a); e.uy = Math.sin(e.a); e.nx = -e.uy; e.ny = e.ux;
    e.obj.rotation.set(0, 0, e.a);
    const ud = e.obj.userData; ud.shuttle.visible = !e.still; ud.shuttle.position.set(e.side * (HALF - 2.5), 0, 0);
    ud.shuttle.rotation.y = e.side > 0 ? Math.PI / 2 : -Math.PI / 2; // her nose (-Z) leads, toward the far spool
  },
  update(e, dt, api) {
    const ud = e.obj.userData, arrive = arriveOf(e, api), t1 = e.lead, t0 = t1 + e.tel;
    let tell = 0, ring = 0;
    if (!e.still) {
      if (arrive <= t0 && arrive > t1) tell = 1 - (arrive - t1) / e.tel;
      else if (arrive <= t1) { tell = 1; ring = 1; }
    }
    // the hum, then the pluck (sounds only once it is near enough to matter)
    if (tell > 0 && !e.hummed) { e.hummed = true; if (e.z > -420) api.game.sfx('g3-thread-hum', { vol: 0.5 }); }
    if (ring && !e.plucked) { e.plucked = true; if (e.z > -360) { api.game.sfx('g3-pluck', { vol: 0.6 }); api.game.shake(0.12); } }
    // the shuttle: waits at its spool, winds back through the tell, then zips to the other spool as it plucks
    if (!e.still) {
      const zip = ring ? clamp((t1 - arrive) / 0.22, 0, 1) : 0, wind = tell * 1.2;
      ud.shuttle.position.x = e.side * (HALF - 2.5 + wind) * (1 - 2 * smoothstep(0, 1, zip));
      ud.shuttle.visible = zip < 1;
    }
    // how far it swings: up to B by the end of the zip, ringing fast; it keeps ringing well past you
    const want = ring ? e.B : 0;
    e.amp += (want - e.amp) * Math.min(1, dt * (ring ? 22 : 6));
    const osc = Math.sin(e.t * 2 * Math.PI * 11), hum = tell * 0.05 * Math.sin(e.t * 2 * Math.PI * 23);
    const mid = (s) => e.amp * prof(s) * osc + hum * prof(s);
    // the string itself: red, brightening toward white-hot through the tell and while it rings
    const heat = Math.max(tell * 0.55, ring ? 0.75 : 0) * (0.8 + 0.2 * Math.sin(e.t * 40));
    ud.core.material.color.copy(RED).lerp(HOT, heat);
    ud.glow.material.color.copy(ud.core.material.color); ud.glow.material.opacity = 0.18 + 0.3 * heat;
    const w = 0.14 + 0.08 * heat;
    setRibbon(ud.core, (s) => mid(s) - w, (s) => mid(s) + w);
    const far = Math.max(0, -e.z);                      // at range the glow and the plan widen, so they stay a few pixels
    const gw = 0.7 + far * 0.004, pw = 0.06 + far * 0.0045;
    setRibbon(ud.glow, (s) => mid(s) - gw, (s) => mid(s) + gw);
    // the blur: the whole lens it rings through, so the danger reads as an area
    ud.lens.material.color.setHex(0xff7090);
    ud.lens.material.opacity = ring ? 0.16 * Math.min(1, e.amp / Math.max(0.1, e.B)) : 0;
    if (ring) setRibbon(ud.lens, (s) => -e.amp * prof(s), (s) => e.amp * prof(s));
    // the plan: the lens's outline, drawn in white from the shuttle's spool across, through the tell
    const plan = e.still ? 0 : tell > 0 ? 1 : 0, draw = clamp(tell * 4, 0, 1), from = e.side;
    ud.planA.material.opacity = ud.planB.material.opacity = plan * (ring ? 0.35 : 0.6 + 0.25 * Math.sin(e.t * 18));
    if (plan) {
      const shown = (s) => (from > 0 ? s >= HALF - L * draw : s <= -HALF + L * draw);
      const edge = (k) => (s) => (shown(s) ? k * (e.B * prof(s) + 0.05) : k * e.B * prof(from * HALF));
      setRibbon(ud.planA, (s) => edge(1)(s) - pw, (s) => edge(1)(s) + pw);
      setRibbon(ud.planB, (s) => edge(-1)(s) - pw, (s) => edge(-1)(s) + pw);
      // a faint white fill of the planned lens, so the area reads before it rings
      if (!ring) { ud.lens.material.color.setHex(0xe8eeff); ud.lens.material.opacity = 0.07 * draw; setRibbon(ud.lens, (s) => (shown(s) ? -e.B * prof(s) : 0), (s) => (shown(s) ? e.B * prof(s) : 0)); }
    }
    api.pose(e);
    // the hit, where it crosses your plane: inside the lens (or on a taut string) is a crash; near it is a CLOSE call
    if (e.crossed && !e.hit) {
      const dx = api.ship.x - e.x, dy = api.ship.y - e.y, s = dx * e.ux + dy * e.uy, dn = Math.abs(dx * e.nx + dy * e.ny);
      const hw = (e.plucked ? e.B * prof(s) : 0) + 0.12, m = SHIP_R * 0.6;
      if (Math.abs(s) < HALF && dn < hw + m) { e.hit = true; api.game.crash({ x: api.ship.x, y: api.ship.y, type: e.type, kind: e.kind }, 18); }
      else if (Math.abs(s) < HALF && dn < hw + m + 0.8) api.game.scrape(e, dn - hw);
    }
    if (e.z > 30) e.alive = false;
  },
  // the test pilots: keep out of the lens (a taut one: off the line)
  avoid(e) {
    const out = [], hw = (k) => (e.still ? 0.2 : e.B * k) + 1.3;
    for (let s = -12; s <= 12; s += 1.5) out.push({ x: e.x + e.ux * s, y: e.y + e.uy * s, r: hw(prof(s)) });
    return out;
  },
});
