// THE TWINS' bodies as a course thing: draws nothing, but it is what hurts when the Twins dive through the lane
// (the SCISSOR PASS), and it tells the test autopilot where not to fly (avoid). The boss (index.js) sets `live` to
// itself while it fights; this entity reads the twins' positions from it every frame.
import { defineObstacle, SHIP_R, SPAWN_D } from '../../api.js?v=0.5.0';

export const hullState = { boss: null };
export default defineObstacle({
  name: 'twins-hull',
  motion: 'own', spawnAt: 'now',
  // the scissor pass is a lane sweep: its guide bands and horn lights show 1.4 s before the twins reach your plane
  hazard: { cls: 'sweep', introduced: 9, warn: () => 1.4 + 1.15 },
  sample: { warm: true },
  spawn(e) { e.z = -SPAWN_D; e.hit = [false, false]; },
  update(e, dt, api) {
    const b = hullState.boss;
    if (!b || !b.alive) { if (!e.ev.warm) e.alive = false; return; }
    e.z = b.z;
    const ship = api.ship;
    for (let i = 0; i < 2; i++) {
      const t = b.tw && b.tw[i]; if (!t || t.dead) continue;
      const p = t.world;
      // a twin is a flat crescent 9 across and about 1 thick, with its cup and plate standing 3 tall at the middle
      // in your plane this frame, or crossed it since the last (a fast dive can step over the window)
      const pz = t.lastZ ?? p.z; t.lastZ = p.z;
      if ((Math.abs(p.z) < 2.2 || (pz < -2.2 && p.z > 2.2)) && !e.hit[i]) {
        const dx = Math.abs(ship.x - p.x), dy = Math.abs(ship.y - p.y);
        const inHull = dx < 4.3 && dy < 0.55 + SHIP_R * 0.8, inCup = dx < 1.6 && dy < 1.5 + SHIP_R * 0.8;
        if (inHull || inCup) { e.hit[i] = true; api.game.crash({ x: p.x, y: p.y, z: 0 }, 22); api.game.shake(0.9); }
        else if (dy < 2.6 && dx < 4.6 && !t.closeT) { t.closeT = 1; api.game.scrape({ x: p.x, y: p.y, z: 0 }, dy); }
      }
      if (p.z > 3) { e.hit[i] = false; t.closeT = 0; }
    }
  },
  // while the twins are near your plane, keep out of their two bands
  avoid() {
    const b = hullState.boss, out = [];
    if (!b || !b.tw) return out;
    for (const t of b.tw) {
      if (t.dead || t.world.z < -45 || t.world.z > 4) continue;
      for (let k = -2; k <= 2; k++) out.push({ x: t.world.x + k * 2.1, y: t.world.y, r: 2.1 });
    }
    return out;
  },
});
