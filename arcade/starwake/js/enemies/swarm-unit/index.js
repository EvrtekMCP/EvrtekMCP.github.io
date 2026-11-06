// THE SWARM (level 7 on): Yori's swarm unit, a flat Lattice kite with a red core, flying in CHAINS of five to
// eight. A chain swoops out of the haze and holds station ahead of you, every kite COPYING YOUR PATH: the head flies
// where you were a second ago, each kite behind it where you were a little before that, so the chain draws your
// own recent flying in the air in front of you. Then its tell: the kites light red one after another, tail to
// head. The head fires, then each kite in turn, a quick volley down one line. A roll as it arrives sends the whole
// volley back up the chain, every bolt to its own kite: MULTI-DEFLECT, and the chain is gone.
//
// One entity per chain; its kites are members (like the mines), and each kite owns its own bolt, so a sent-back
// bolt homes on the kite that fired it. Kites slip round anything solid on the course (a kind with blocks(e)),
// so a chain weaves through traffic instead of flying through it.
//
// Event: { type: 'swarm-unit', n: 5..8, tel: ripple s (1.2 when new), volleys: 1|2, aim: 'ship'|'graze', side: -1|1,
//          hold: s at station before the first ripple, station: m ahead of the ship for the head }
// aim 'graze' sends the volley 1.6 m wide of the ship: do nothing and it is a GRAZE, roll and it all comes back.
// That is how the level teaches it (rule 18: the first one costs nothing).
import { THREE, defineEnemy, Instanced, GlowPoints, modelGroups, clamp, SPAWN_D, SHOT_T } from '../../api.js?v=0.2.0';
import { MESH } from './mesh.js?v=0.2.0';

const SCALE = 3.4;          // Yori's kite is 1.4 across; it holds station ahead of you, so it is drawn 4.8 m across to read there
const DELAY = 1.0, GAP = 0.12; // the head copies you 1.0 s ago; each kite 0.12 s before the one ahead of it
const PITCH = 4.5;          // metres between kites along the chain
const IN_T = 1.6;           // the swoop in from the haze
const LIFT = 1.6;           // metres above your old line
const SPREAD = 0.05;        // seconds between bolts in a volley: eight arrive within 0.35 s, so one 0.45 s roll can take them all
const AGAIN = 2.6;          // seconds from one volley to the next ripple

// ---- the ship's recent path, sampled every frame (one history for every chain)
const H = { t: new Float32Array(512), x: new Float32Array(512), y: new Float32Array(512), n: 0, i: 0, last: -1 };
function record(t, x, y) {
  if (t === H.last) return;
  if (t < H.last) H.n = 0; // a new run
  H.last = t; H.i = (H.i + 1) % 512; H.t[H.i] = t; H.x[H.i] = x; H.y[H.i] = y; H.n = Math.min(512, H.n + 1);
}
const out = { x: 0, y: 0 };
function past(t) { // the ship's position at time t (clamped to what is recorded)
  if (!H.n) { out.x = 0; out.y = 0; return out; }
  let j = H.i;
  for (let k = 0; k < H.n - 1; k++) {
    const p = (j + 511) % 512;
    if (H.t[p] <= t) { const a = H.t[p], b = H.t[j], f = b > a ? clamp((t - a) / (b - a), 0, 1) : 1; out.x = H.x[p] + (H.x[j] - H.x[p]) * f; out.y = H.y[p] + (H.y[j] - H.y[p]) * f; return out; }
    j = p;
  }
  out.x = H.x[j]; out.y = H.y[j]; return out;
}

const tmpQ = new THREE.Quaternion(), eul = new THREE.Euler(), tmpC = new THREE.Color();
const PLATE = new THREE.Color('#4a5070'), RED = new THREE.Color('#ff3355'), CORE = new THREE.Color('#ff3355'), HOT = new THREE.Color('#ffe0e6');
let layers, halo;
function put(x, y, z, q, s, plate, core) { for (const L of layers) L.put(x, y, z, q, s, s, s, L.glow ? core : (L.tint ? plate : undefined)); }

// slip a point out of anything solid near depth z (the freighters), toward the nearest open side
function slip(api, x, y, z, m) {
  for (const o of api.course.list) {
    const k = o.kind; if (!k.blocks || !o.alive) continue;
    const b = k.blocks(o, api); if (!b || z > b.z0 + m || z < b.z1 - m) continue;
    const hx = b.hx + m, hy = b.hy + m, dx = x - b.x, dy = y - b.y;
    if (Math.abs(dx) < hx && Math.abs(dy) < hy) {
      const px = hx - Math.abs(dx), py = hy - Math.abs(dy);
      if (px < py) x = b.x + Math.sign(dx || 1) * hx; else y = b.y + Math.sign(dy || 1) * hy;
    }
  }
  out.x = x; out.y = y; return out;
}

const kind = defineEnemy({
  name: 'swarm-unit',
  motion: 'own', spawnAt: 'now',
  hazard: { cls: 'shot', introduced: 7, shotT: SHOT_T, tel: 0.9 },
  sample: { n: 2 },
  killPts: 600,
  init(api) {
    layers = modelGroups(MESH.unit).map((g) => {
      const geo = g.geo;
      const mat = g.glow ? new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
        : new THREE.MeshStandardMaterial({ color: g.color === '#4a5070' ? 0xffffff : g.color, metalness: 0.45, roughness: 0.5, flatShading: true, side: THREE.DoubleSide });
      const L = new Instanced(api.scene, geo, mat, 64); L.glow = g.glow; L.tint = g.color === '#4a5070';
      if (g.glow || L.tint) L.mesh.setColorAt(0, tmpC.set(g.color));
      return L;
    });
    halo = new GlowPoints(api.scene, 96, api.glowTex);
  },
  begin(api) {
    for (const L of layers) L.begin(); halo.begin(); halo.setScale(api.focalPx);
    if (api.G && api.G.state === 'play') record(api.time, api.ship.x, api.ship.y);
  },
  end() { for (const L of layers) L.end(); halo.end(); },
  targetable: (e) => e.members.some((m) => m.alive),
  spawn(e, ev, api) {
    const n = ev.n || 6;
    e.n = n; e.tel = ev.tel || 0.9; e.volleys = ev.volleys || 1; e.aim = ev.aim || 'ship'; e.side = ev.side || 1;
    e.hold = ev.hold ?? 0.6; e.station = ev.station || 40; e.r = 1.6; e.hitR = 1.6;
    e.z = -SPAWN_D; e.phase = 0; e.volley = 0; e.rip = -1; e.fireT = -1; e.cleared = false; e.t = 0;
    e.members = [];
    for (let i = 0; i < n; i++) {
      e.members.push({ i, kind, type: 'swarm-unit', chain: e, alive: true, dead: false, hitR: 1.3, r: 1.3,
        x: e.side * (4 + i), y: 10 + i * 1.5, z: -SPAWN_D - i * PITCH, vx: 0, vy: 0, lit: 0, hot: 0, fired: -1, sw: i * 1.25 });
    }
    if (ev.warm) { e.phase = 1; e.t = IN_T; }
  },
  update(e, dt, api) {
    // grown in with time since birth as well as distance, so its first frame is never drawn above nothing (CLU A, 11-05)
    e.born = (e.born || 0) + dt; const bornK = Math.min(1, e.born / 0.8), grow = bornK * bornK * (3 - 2 * bornK);
    const ship = api.ship, box = api.box, now = api.time;
    e.t += dt;
    // ---- where the chain is: swooping in, on station, or leaving
    let zHead, k = 1;
    if (e.phase === 0) {
      k = clamp(e.t / IN_T, 0, 1); const ease = 1 - Math.pow(1 - k, 3);
      zHead = -SPAWN_D + (SPAWN_D - e.station) * ease;
      if (k >= 1) { e.phase = 1; e.t = 0; }
    } else if (e.phase === 1) {
      zHead = -e.station;
      // the ripple, the volley, again, then away
      if (e.rip < 0 && e.fireT < 0 && e.volley < e.volleys && e.t >= (e.volley === 0 ? e.hold : e.next)) { e.rip = 0; api.game.telegraph(e); }
      if (e.rip >= 0) {
        e.rip += dt;
        if (e.rip >= e.tel) { e.rip = -1; e.fireT = 0; for (const m of e.members) m.fired = -1; }
      }
      if (e.fireT >= 0) {
        e.fireT += dt;
        let left = false, slot = 0;
        for (const m of e.members) {
          if (!m.alive) continue;
          if (m.fired < 0 && e.fireT >= slot * SPREAD) {
            m.fired = 1; m.hot = 1;
            let tx = ship.x + ship.vx * 0.3, ty = ship.y + ship.vy * 0.3;
            if (e.aim === 'graze') { const d = Math.hypot(ship.x, ship.y); const ux = d > 0.5 ? -ship.x / d : (e.side > 0 ? -1 : 1), uy = d > 0.5 ? -ship.y / d : 0; tx = ship.x + ux * 1.6; ty = ship.y + uy * 1.6; }
            // later bolts fly a touch faster, so the volley bunches as it lands: a well-timed roll takes all of it
            api.fire(m, clamp(tx, -box.x, box.x), clamp(ty, -box.y, box.y), { T: SHOT_T - slot * 0.012 });
          }
          if (m.fired < 0) left = true;
          slot++;
        }
        if (!left) { e.fireT = -1; e.volley++; e.next = e.t + AGAIN; if (e.volley >= e.volleys) e.leaveAt = e.t + SHOT_T + 1.1; }
      }
      if (e.leaveAt !== undefined && e.t >= e.leaveAt) { e.phase = 2; e.t = 0; }
    } else {
      // away: it climbs off ahead, back out past the haze
      e.station += (60 + e.t * 260) * dt;
      zHead = -e.station;
      if (zHead < -SPAWN_D - e.n * PITCH) { e.alive = false; }
    }
    // ---- each kite: copy the path, swim a little, slip round traffic, light up in the ripple
    let lead = null, anyAlive = false;
    const ripK = e.rip >= 0 ? e.rip / e.tel : (e.fireT >= 0 ? 1 : 0);
    for (const m of e.members) {
      if (!m.alive) continue;
      anyAlive = true;
      const z = zHead - m.i * PITCH;
      const p = past(now - DELAY - m.i * GAP);
      // a little above your old line, so the chain reads against the rings you are flying, not on top of them
      // and a swim down the chain, a wave from head to tail, so the kites never stack into one blob
      let tx = p.x + Math.sin(now * 2.2 - m.sw) * 2.8, ty = Math.min(box.y, p.y + LIFT) + Math.cos(now * 1.7 - m.sw) * 1.5;
      if (e.phase === 0) { const f = 1 - Math.pow(1 - k, 2); tx = e.side * (4 + m.i) * (1 - f) + tx * f; ty = (10 + m.i * 1.5) * (1 - f) + ty * f; }
      if (e.phase === 2) ty += e.t * e.t * 9;
      const s = slip(api, tx, ty, z, 1.8); tx = s.x; ty = s.y;
      const ox = m.x, oy = m.y, rate = e.phase === 0 ? 20 : 7;
      m.x += (tx - m.x) * (1 - Math.exp(-rate * dt)); m.y += (ty - m.y) * (1 - Math.exp(-rate * dt)); m.z = z;
      m.vx = dt > 0 ? (m.x - ox) / dt : 0; m.vy = dt > 0 ? (m.y - oy) / dt : 0;
      // the ripple runs tail to head: the tail lights first
      const order = e.n > 1 ? (e.n - 1 - m.i) / (e.n - 1) : 0;
      const want = ripK > order * 0.85 ? 1 : 0;
      m.lit += (want - m.lit) * (1 - Math.exp(-(want ? 22 : 5) * dt));
      m.hot = Math.max(0, m.hot - dt * 4);
      const a = api.appear(z) * grow;
      eul.set(0.15 - m.vy * 0.03, Math.PI + clamp(-m.vx * 0.02, -0.4, 0.4), clamp(-m.vx * 0.05, -0.8, 0.8));
      tmpQ.setFromEuler(eul);
      const plate = tmpC.copy(PLATE).lerp(RED, m.lit * 0.85).getHex();
      const core = m.hot > 0 ? HOT.getHex() : CORE.getHex();
      put(m.x, m.y, z, tmpQ, SCALE * a, plate, core);
      const glowA = (0.35 + 0.65 * m.lit + m.hot) * a;
      halo.push(m.x, m.y, z, (3.4 + 4 * m.lit + 4.5 * m.hot) * a, 1, 0.2 + 0.6 * m.hot, 0.33 + 0.5 * m.hot, Math.min(1, glowA));
      if (!lead || z > lead.z) lead = m;
    }
    if (lead) { e.x = lead.x; e.y = lead.y; e.z = lead.z; }
    if (!anyAlive) {
      if (!e.cleared && e.members.every((m) => m.dead)) {
        e.cleared = true;
        api.game.score(Math.round(2000 * e.n / 6) * api.game.mult, e.x, e.y + 3, e.z, 'big', 'SWARM DOWN');
        api.game.call('SWARM DOWN!', 'c-cyan');
      }
      e.alive = false;
    }
  },
  // a sent-back bolt reached a kite (its own), or the chain (a stray bolt from something else): the nearest kite goes
  onShot(t, s, api) {
    if (t.chain) { if (t.alive) api.kill(t, true); return; }
    let best = null, bd = 1e9;
    for (const m of t.members) if (m.alive) { const d = Math.hypot(m.x - s.x, m.y - s.y, m.z - s.z); if (d < bd) { bd = d; best = m; } }
    if (best) api.kill(best, true);
  },
  onKill(e) { e.alive = false; e.dead = true; },
  remove() {},
});
export default kind;
