// THE SNARE's tether (THE BINDING and THE LUNGE): a red line from its mouth that latches onto the mother (or, in the
// lunge, onto you). The boss spawns it; it is a course thing only so the bots can see it and the level's kinds list it.
//  - on the mother: it crosses your lane. Fly through it and roll to snap it (SNAPPED!): the whip-back hits the Snare
//    (an echo home to its lit flank node). Left on for 3 s, the Snare FEEDS: one node grows back (never a fail).
//  - on you: it drains your shield and drags you toward it, like a leech's, until you roll to snap it.
// It lets go when the Snare breaks off (the boss calls release) or after `hold` seconds.
//   api.spawn({ type: 'g2-snare-tether', boss: b, to: 'mother' | 'ship', dy: 0, hold: 4.5 }, 0)
import { THREE, defineDecor, clamp } from '../../api.js?v=0.6.1';

export const TETHER = { reach: 0.55, feed: 3, hold: 4.5, snapR: 2.4, drain: 4, drag: 4 };
const UP = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
let pool = [];
function rope(api) {
  const m = pool.pop() || new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
  if (!m.parent) api.scene.add(m);
  m.visible = true; m.frustumCulled = false; m.material.color.setHex(0xff3355);
  return m;
}
function lay(m, a, b, w) {
  dir.set(b.x - a.x, b.y - a.y, b.z - a.z); const len = dir.length() || 0.001;
  m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); m.scale.set(w, len, w); m.quaternion.setFromUnitVectors(UP, dir.multiplyScalar(1 / len));
}
function nearest(a, b, p) {
  const ax = b.x - a.x, ay = b.y - a.y, az = b.z - a.z, aa = ax * ax + ay * ay + az * az || 1e-9;
  const f = clamp(((p.x - a.x) * ax + (p.y - a.y) * ay + (p.z - a.z) * az) / aa, 0, 1);
  return { x: a.x + ax * f, y: a.y + ay * f, z: a.z + az * f };
}

function cut(e) {
  if (e.mode === 'on' && e.to === 'mother' && e.boss.mother) e.boss.mother.held = Math.max(0, (e.boss.mother.held || 1) - 1);
  e.mode = 'gone'; e.alive = false;
}

export default defineDecor({
  name: 'g2-snare-tether',
  motion: 'own', spawnAt: 'now', noWarm: true,
  hazard: null,
  spawn(e, ev, api) {
    e.boss = ev.boss; e.to = ev.to || 'mother'; e.dy = ev.dy || 0; e.hold = ev.hold ?? TETHER.hold;
    e.mode = 'reach'; e.mt = 0; e.fed = false; e.rope = rope(api); e.x = 0; e.y = 0; e.z = -5;
  },
  update(e, dt, api) {
    const b = e.boss, G = api.game, ship = api.ship;
    e.mt += dt;
    const a = b.mouth;
    const end = e.to === 'ship' ? { x: ship.x, y: ship.y, z: 0 } : (() => { const M = b.mother; if (!M || !M.alive) return null; const f = M.kind.flank(M, a.x); return { x: f.x, y: f.y + e.dy, z: f.z }; })();
    if (!end || !b.alive || b.state !== 'fight' || e.released) { cut(e); return; }
    if (e.mode === 'reach') {
      const k = Math.min(1, e.mt / TETHER.reach);
      lay(e.rope, a, { x: a.x + (end.x - a.x) * k, y: a.y + (end.y - a.y) * k, z: a.z + (end.z - a.z) * k }, 0.18);
      if (k >= 1) {
        e.mode = 'on'; e.mt = 0;
        if (e.to === 'ship') { if (ship.rolling) { G.graze({ x: ship.x + 0.8, y: ship.y, z: 0 }, 1.4, 0.78, 2.5); G.pop('GLANCED', ship.x, ship.y + 1.5, 0, 'cyan'); cut(e); return; } }
        else if (b.mother) b.mother.held = (b.mother.held || 0) + 1;
        G.sfx('g2-leech-latch', { vol: 0.7 });
      }
      return;
    }
    // latched
    lay(e.rope, a, end, 0.18 + 0.04 * Math.sin(e.mt * 20));
    e.x = (a.x + end.x) / 2; e.y = (a.y + end.y) / 2; e.z = (a.z + end.z) / 2;
    let snap;
    if (e.to === 'ship') {
      G.drain(TETHER.drain * dt);
      const dx = a.x - ship.x, dy = a.y - ship.y, d = Math.hypot(dx, dy) || 1; api.push(dx / d * TETHER.drag, dy / d * TETHER.drag);
      snap = ship.rolling;
    } else {
      b.tethered = (b.tethered || 0) + dt;   // MOTHER SAFE: how long tethers held her
      const p = nearest(a, end, { x: ship.x, y: ship.y, z: 0 });
      snap = ship.rolling && Math.hypot(p.x - ship.x, p.y - ship.y, p.z) < TETHER.snapR;
      if (!e.fed && e.mt > TETHER.feed) { e.fed = true; b.feed(api); }
    }
    if (snap) {
      G.counter({ label: 'SNAPPED!', target: b, x: ship.x, y: ship.y, sfx: 'g2-tether-snap', shake: 0.4 });
      e.rope.material.color.setHex(0x53e6ff);
      cut(e); return;
    }
    if (e.mt > e.hold) cut(e);
  },
  remove(e) { if (e.rope) { e.rope.visible = false; pool.push(e.rope); e.rope = null; } },
  // the bots: a tether on you is snapped at once; one on the mother is flown to where it crosses your lane, and rolled
  rollAsk(e, api) {
    if (e.mode !== 'on') return [];
    if (e.to === 'ship') return [{ t: -0.045, key: 'ts' + e.id }];   // now (just inside every bot's window)
    const B = api.box, a = e.boss.mouth, M = e.boss.mother; if (!M) return [];
    const f = M.kind.flank(M, a.x), end = { x: f.x, y: f.y + e.dy, z: f.z };
    let best = null;
    for (let k = 0; k <= 16; k++) { const q = k / 16, x = a.x + (end.x - a.x) * q, y = a.y + (end.y - a.y) * q, z = a.z + (end.z - a.z) * q; if (Math.abs(x) > B.x * 0.9 || Math.abs(y) > B.y * 0.9) continue; const sc = Math.abs(z) * 2 + Math.abs(x - api.ship.x) * 0.2; if (!best || sc < best.sc) best = { x, y, sc }; }
    return best ? [{ t: Math.hypot(best.x - api.ship.x, best.y - api.ship.y) < 1.5 ? -0.045 : 0.4, x: best.x, y: best.y, r: 1.5, go: true, key: 'tm' + e.id }] : [];
  },
});
