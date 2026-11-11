// MINES (level 1, from the derelict on): Yori's Lattice mine, in clusters (a ring of mines round one in the
// middle). The red seams pulse faster as you close; armed, a white-hot strobe; then each pops into four bolts in
// a cross, fixed in the track and spreading. Touching one costs a hit.
import { THREE, defineObstacle, Instanced, modelGroups, clamp, SHIP_R } from '../../api.js?v=0.6.3';

const tmpQ = new THREE.Quaternion(), tmpA = new THREE.Vector3(), tmpC = new THREE.Color();
let layers;
const put = (x, y, z, q, s, col) => { for (const L of layers) L.put(x, y, z, q, s, s, s, L.glow ? col : undefined); };
export default defineObstacle({
  name: 'mines',
  hazard: { cls: 'static', introduced: 2 },
  sample: { n: 1 },
  // 0.4.0 (the MCP, 11-07), check-levels' "no fully blocked moment", check-only: a cluster's mines never drift (each
  // stays where it was laid) and each pops into its cross of bolts about 0.9 s before it would reach you; the worst case
  // is taken anyway: every mine of the cluster still whole at the ship's plane, a solid of its crash radius (0.95 m),
  // the ones laid 3 m deeper as a moment of their own. Its bolts are fire, the roll's or the steering's, never a wall.
  solid(ev, B) {
    if (ev.decor) return null;
    const n = ev.n || 5, x0 = ev.x ?? (ev.nx || 0) * B.x, y0 = ev.y ?? (ev.ny || 0) * B.y, rows = [[], []];
    for (let i = 0; i < n; i++) { const a = i / (n - 1 || 1) * Math.PI * 2, rr = i === n - 1 ? 0 : 1.9; rows[i % 2].push([x0 + Math.cos(a) * rr, y0 + Math.sin(a) * rr]); }
    return rows.map((ms, k) => (ms.length ? { at: k * 3, dist: (x, y) => Math.min(...ms.map(([mx, my]) => Math.hypot(x - mx, y - my))) - 0.95 } : null)).filter(Boolean);
  },
  init(api) {
    layers = modelGroups('mine').map((g) => {
      const mat = g.glow ? new THREE.MeshBasicMaterial({ color: 0xffffff }) : new THREE.MeshStandardMaterial({ color: g.color, metalness: 0.5, roughness: 0.45, flatShading: true, side: THREE.DoubleSide });
      const L = new Instanced(api.scene, g.geo, mat, 60); L.glow = g.glow;
      if (g.glow) L.mesh.setColorAt(0, tmpC.setHex(0xff3355));
      return L;
    });
  },
  begin() { for (const L of layers) L.begin(); },
  end() { for (const L of layers) L.end(); },
  spawn(e, ev) {
    e.members = [];
    const n = ev.n || 5;
    for (let i = 0; i < n; i++) {
      const a = i / (n - 1 || 1) * Math.PI * 2;
      const rr = i === n - 1 ? 0 : 1.9;
      e.members.push({ x: e.x + Math.cos(a) * rr, y: e.y + Math.sin(a) * rr, dz: (i % 2) * 3, state: 0, t: 0, alive: true, spin: Math.random() * 6 });
    }
  },
  update(e, dt, api) {
    const v = api.v, ship = api.ship;
    let any = false;
    for (const m of e.members) {
      if (!m.alive) continue;
      any = true;
      const mz = e.z - m.dz;
      m.spin += dt * 1.5;
      const arrive = -mz / Math.max(1, v);
      if (m.state === 0 && arrive < 1.35 && arrive > 0) { m.state = 1; m.t = 0; api.game.mineArm(m); }
      // idle: a red pulse that quickens from 1.5 to 7 a second as it closes; armed: a white-hot strobe
      m.ph = (m.ph || 0) + dt * Math.PI * 2 * (1.5 + 5.5 * clamp(1 - arrive / 3.5, 0, 1));
      const pk = 0.5 + 0.5 * Math.sin(m.ph);
      tmpC.setRGB(0.35 + 0.65 * pk, (0.06 + 0.14 * pk), (0.1 + 0.23 * pk));
      let col = tmpC.getHex();
      if (m.state === 1) {
        m.t += dt; col = (Math.floor(m.t * 16) % 2) ? 0xffe0e6 : 0xff3355;
        if (m.t > 0.42) { // pop: four shots out in a cross, fixed in the track, spreading
          m.state = 2; m.alive = false;
          const a0 = (m.dz ? Math.PI / 4 : 0);
          for (let k = 0; k < 4; k++) {
            const a = a0 + k * Math.PI / 2;
            api.fire({ x: m.x, y: m.y, z: mz, mine: true }, 0, 0, { vel: [Math.cos(a) * 5.5, Math.sin(a) * 5.5, 6], carry: 1 });
          }
          api.game.minePop(m, mz);
          continue;
        }
      }
      tmpQ.setFromAxisAngle(tmpA.set(0.3, 1, 0.2).normalize(), m.spin);
      put(m.x, m.y, mz, tmpQ, e.appear, col);
      if (Math.abs(mz) < 1.3 && Math.hypot(ship.x - m.x, ship.y - m.y) < 0.95 + SHIP_R) { m.alive = false; api.game.crash({ kind: e.kind, type: 'mine', x: m.x, y: m.y, z: mz }, 18, true); }
    }
    if (!any || e.z > 30) e.alive = false;
  },
});
