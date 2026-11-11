// THE POWER-UPS (0.4.0; Evrtek's set, ruled 11-06). Fly into one and it fires at once: no button, no inventory, never
// stored. Each is a solid shape, turning and gently bobbing inside a thin white halo, in its own colour (none of them
// red, amber or cyan: rule 9). Missing one is never a fail. What each does is the engine's (js/powerups.js, main.js).
//   import { shieldCell, overclock } from '../pickups/powerups/index.js?v=0.6.1';   (or POWERUP_KINDS, all six)
//   add(d, 'shield-cell', { nx, ny })     add(d, 'overclock', { nx: 0.2, ny: 0.1 })     ...
// Kind names: shield-cell, overclock, mirror-shell, phase, ring-magnet, slipstream. Each counts toward no ring total.
import { THREE, definePickup } from '../../api.js?v=0.6.1';
import { POWERUPS, PICK_R } from '../../powerups.js?v=0.6.1';
import { SHAPES, HALO } from './shapes.js?v=0.6.1';

let glowMat = null;
function make(api, id) {
  const P = POWERUPS[id], g = new THREE.Group();
  const shape = SHAPES[id](); g.add(shape);                                     // Yori's shape (shapes.js)
  const halo = HALO(); g.add(halo);                                             // her thin white halo round it
  const glow = new THREE.Sprite(glowMat.clone()); glow.material.color.setHex(P.color); glow.scale.set(4.2, 4.2, 1); g.add(glow);
  g.userData = { shape, halo, glow, mats: shape.userData.mats, haloMats: halo.userData.mats };
  return g;
}
function kindFor(id) {
  const P = POWERUPS[id];
  return definePickup({
    name: P.kind,
    powerup: id,                  // the engine's id (POWERUPS); the bots and check-levels read it
    hazard: null,
    init(api) {
      if (glowMat) return;
      glowMat = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5 });
    },
    spawn(e, ev, api) {
      e.obj = api.course.get(P.kind, () => make(api, id));
      e.anim = 0; e.grow = 1; e.bob = (e.id % 7) * 0.9;
      const u = e.obj.userData; for (const m of u.haloMats) m.opacity = 0.7; u.glow.material.opacity = 0.5; for (const m of u.mats) m.opacity = 1;
    },
    update(e, dt, api) {
      const u = e.obj.userData;
      u.shape.rotation.y += dt * 1.6; if (u.shape.userData.spin) u.shape.rotation.z += dt * u.shape.userData.spin;
      u.halo.lookAt(api.camera.position);   // the halo always faces the player
      e.bob += dt * 2.2;
      const fade = e.z > 0 ? Math.max(0, 1 - e.z / 4) : 1;
      if (e.anim > 0) {
        e.anim += dt; const k = Math.min(1, e.anim / 0.22);
        e.grow = 1 + k * 0.9; for (const m of u.mats) m.opacity = 1 - k; for (const m of u.haloMats) m.opacity = 0.7 * (1 - k); u.glow.material.opacity = 0.9 * (1 - k);
        if (k >= 1) e.alive = false;
      } else {
        let a = fade;
        if (u.shape.userData.flicker) a *= 0.7 + 0.3 * Math.sin(e.t * 23) * Math.sin(e.t * 7.3);
        for (const m of u.mats) m.opacity = a;
        const fp = u.shape.userData.flashPair; // the mirror: one face flashes white as it turns toward you
        if (fp) { const on = Math.sin(u.shape.rotation.y * 3) > 0.92; for (const c of fp[0]) c.visible = !on; fp[1].visible = on; }
        for (const m of u.haloMats) m.opacity = 0.7 * fade; u.glow.material.opacity = (0.4 + 0.15 * Math.sin(e.t * 5)) * fade;
        // fly into it: it fires the moment the ship's middle passes within PICK_R of it
        if (e.crossed && Math.hypot(api.ship.x - e.x, api.ship.y - e.y) < PICK_R) { if (api.game.powerup(id, e)) e.anim = 0.001; }
      }
      e.sx = e.sy = e.sz = e.grow;
      api.pose(e);
      e.obj.position.y = e.y + Math.sin(e.bob) * 0.18;      // a gentle bob, drawn only (the pickup test uses e.y)
      if (e.z > 14) e.alive = false;
    },
  });
}
export const shieldCell = kindFor('shield');
export const overclock = kindFor('overclock');
export const mirrorShell = kindFor('mirror');
export const phase = kindFor('phase');
export const ringMagnet = kindFor('magnet');
export const slipstream = kindFor('slip');
export const POWERUP_KINDS = [shieldCell, overclock, mirrorShell, phase, ringMagnet, slipstream];
export default POWERUP_KINDS;
