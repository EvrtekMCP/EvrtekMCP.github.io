// THE SHOAL (galaxy 2, the Shoals' headline: "The rings swim in shoals, so chase them."). A school of ring-fish: each
// one a real amber ring with little fins (Yori's ringFish), and each counts as a ring. They swim a set path as one, the
// same every run, so it can be learned: S-curves, spirals, a dive. Before every turn the leader's tail flicks white
// for a second (the tell). Catch a whole shoal: SHOAL!
// A shoal is n events, one per fish, laid by the level's shoal() helper:
//   add(d + i * gap, 'g2-shoal', { shoal: 'S3', idx: i, of: n, gap, keys: [[p, nx, ny], ...], off: [ox, oy], split?, cache? })
//   keys: where the school's middle is (normalised box) when its leader has come p metres in from the spawn line (p = 0
//   at 800 m out, 800 at the ship); every fish follows the same keys, so the line of rings you meet traces the path.
//   split: { p, len, dx, dy }: a gulper cuts through at p; the fish part into two streams (odd and even) dx, dy either
//   side for len metres, then close up again.
//   orbit: { r, w, a0 } (decor fish only): it circles the lane, r box-widths out (the Bait Ball).
//   free: true (spawned by the Whirlmaw's gulp): it pours out of the boss's mouth; catching it gives shield and points, and
//   it is never a ring (no total, no miss).
import { THREE, definePickup, modelGroups, Instanced, GlowPoints, RING_R, SPAWN_D, clamp, smoothstep } from '../../api.js?v=0.5.0';
import { MESH } from './mesh.js?v=0.5.0';
import { pathAt } from '../../obstacles/g2-current/index.js?v=0.5.0';

const SCALE = 1.6;                         // her ring is 1.0 across the middle; the game's ring flies at 1.6
const schools = new Map();                 // shoal id -> { got, missed, of }
const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
let fishL = null, flickL = null, halo = null;
const SHOAL_BONUS = 1500;

function layers(api, model, cap) { return modelGroups(model).map((g) => new Instanced(api.scene, g.geo, new THREE.MeshBasicMaterial({ color: g.color }), cap)); }
// the school's middle at progress p (normalised), with this fish's place in it
function lateral(ev, p) {
  const [cx, cy] = pathAt(ev.keys, p);
  let x = cx + (ev.off ? ev.off[0] : 0), y = cy + (ev.off ? ev.off[1] : 0);
  const s = ev.split;
  if (s) { const k = smoothstep(s.p - 40, s.p + 40, p) * smoothstep(s.p + s.len + 60, s.p + s.len - 20, p), side = ev.idx % 2 ? 1 : -1; x += side * (s.dx || 0) * k; y += side * (s.dy || 0) * k; }
  return [x, y];
}
// how far before a turn the leader flicks: 1 s at the speed flown
function turning(ev, p, v) {
  const K = ev.keys; if (!K || K.length < 3) return false;
  for (let i = 1; i < K.length - 1; i++) { const dp = K[i][0] - p; if (dp > 0 && dp < v * 1.0) return true; }
  return false;
}

export default definePickup({
  name: 'g2-shoal',
  countsAsRing: true,                      // every fish is a ring (a decor fish of the Bait Ball is not: ev.decor)
  hazard: null,
  sample: { keys: [[0, 0, 0]], idx: 0, of: 1, shoal: '_warm' },
  init(api) { fishL = layers(api, MESH.fish, 400); flickL = layers(api, MESH.flick, 40); halo = new GlowPoints(api.scene, 600, api.glowTex); },
  begin() { for (const L of fishL) L.begin(); for (const L of flickL) L.begin(); halo.begin(); },
  end() { for (const L of fishL) L.end(); for (const L of flickL) L.end(); halo.end(); },
  spawn(e, ev, api) {
    e.decor = !!(ev.decor || ev.free); e.anim = 0; e.wag = (ev.idx || 0) * 0.9 + (ev.d || 0) * 0.01;
    if (ev.idx === 0 && !ev.decor) schools.set(ev.shoal, { got: 0, missed: 0, of: ev.of || 1 });
    place(e, api, 0);
  },
  update(e, dt, api) {
    const ev = e.ev;
    place(e, api, dt);
    // a FREE fish (the Whirlmaw's gulp: the shoal pouring out of its mouth): your shield back and points, never a ring
    if (ev.free && !e.anim && e.crossed) {
      if (Math.hypot(api.ship.x - e.x, api.ship.y - e.y) < RING_R * api.ease.ring) { e.anim = 0.001; api.game.heal(5); api.game.chain(1); api.game.score(100 * api.game.mult, e.x, e.y + 1.2, 0, '', ''); api.game.sfx('ring', { rate: 1.2 }); api.game.burst(e.x, e.y, 0, 20, { speed: 9, life: 0.45, s0: 0.9, r: 1, g: 0.8, b: 0.25, carry: 1, flatZ: 0.3 }); }
    } else if (!e.decor && !e.anim && e.crossed && !ev.warm) {
      const sc = schools.get(ev.shoal) || { got: 0, missed: 0, of: ev.of || 1 };
      if (Math.hypot(api.ship.x - e.x, api.ship.y - e.y) < RING_R * api.ease.ring) {
        e.anim = 0.001; api.game.ring(e); sc.got++;
        if (sc.got === sc.of && !sc.missed && sc.of >= 5) {
          api.game.score(SHOAL_BONUS * api.game.mult, api.ship.x, api.ship.y + 2, 0, 'big', 'SHOAL');
          api.game.greed(12); api.game.call('SHOAL!', ''); api.game.sfx('g2-shoal');
        }
      } else { api.game.missRing(e); sc.missed++; }
    }
    // drawn: the fish (or the leader's flick before a turn), swimming nose-on away from you, tail wagging
    let s = SCALE * e.appear * (ev.free ? Math.min(1, e.t / 0.35) ** 2 : 1);   // a free fish is born at the boss's mouth: it grows in
    if (e.anim > 0) { e.anim += dt; s *= 1 + Math.min(1, e.anim / 0.12) * 0.4; if (e.anim > 0.12) { e.alive = false; return; } }
    if (e.z > 0) s *= Math.max(0, 1 - e.z / 4);
    if (s > 0.001) {
      tmpE.set(e.pitch || 0, (e.yaw || 0) + Math.sin(e.wag) * 0.18, Math.sin(e.wag * 0.5) * 0.1); tmpQ.setFromEuler(tmpE);
      const L = e.flick ? flickL : fishL;
      for (const l of L) l.put(e.x, e.y, e.z, tmpQ, s, s, s);
      halo.push(e.x, e.y, e.z, 4.6 * s / SCALE, 1, 0.69, 0.13, (e.decor ? 0.28 : 0.5) * Math.min(1, e.appear * 1.5));
    }
    if (e.z > 14) e.alive = false;
  },
});
function place(e, api, dt) {
  const ev = e.ev, B = api.box;
  e.wag += dt * 7;
  if (ev.orbit) {
    // the Bait Ball: a fish circling the lane, well outside the flight box, drifting a little along it
    const o = ev.orbit, a = o.a0 + o.w * (e.t || 0);
    const px = Math.cos(a) * o.r * B.x, py = Math.sin(a) * o.r * B.y;
    e.yaw = 0; e.pitch = 0; e.flick = false;
    if (dt > 0) { e.yaw = -Math.atan2(-Math.sin(a) * o.w * o.r * 4, 6); }
    e.x = px; e.y = py; return;
  }
  const p = SPAWN_D + e.z + (ev.idx || 0) * (ev.gap || 0);
  const [nx, ny] = lateral(ev, p), x = clamp(nx, -0.95, 0.95) * B.x, y = clamp(ny, -0.9, 0.9) * B.y;
  // it turns to where it is going (the lateral swim against the way the course comes at it)
  if (dt > 0 && e.x !== undefined) { const v = Math.max(20, api.v), lx = (x - e.x) / dt, ly = (y - e.y) / dt; e.yaw = -Math.atan2(lx, v * 0.6) * 0.9; e.pitch = Math.atan2(ly, v * 0.6) * 0.9; }   // nose at -Z: +x needs a negative yaw
  e.x = x; e.y = y;
  e.flick = ev.idx === 0 && turning(ev, p, api.v || 100);
}
export { lateral };
