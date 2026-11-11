// THE RING (level 1 on): amber, the collect hue (rule 9). Fly through its middle for points, combo and shield.
import { THREE, definePickup, RING_R } from '../../api.js?v=0.6.1';

let geo, mat, glow;
export default definePickup({
  name: 'ring',
  countsAsRing: true, // counts toward RINGS and PERFECT SECTOR
  hazard: null,
  init(api) {
    geo = new THREE.TorusGeometry(1.6, 0.13, 8, 28);
    mat = new THREE.MeshBasicMaterial({ color: 0xffcc33 });
    glow = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffb020, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 });
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('ring', make);
    const m = e.obj.children[0].material; m.color.setHex(0xffcc33); m.opacity = 1; m.transparent = true;
    e.obj.children[1].material.opacity = 0.55; e.anim = 0; e.grow = 1;
  },
  update(e, dt, api) {
    e.obj.rotation.z += dt * 1.2;
    // once past the ship a ring fades out before it can reach the lens
    const fade = e.z > 0 ? Math.max(0, 1 - e.z / 4) : 1;
    const ring = e.obj.children[0].material, halo = e.obj.children[1].material;
    if (e.anim > 0) {
      e.anim += dt; const k = Math.min(1, e.anim / 0.16);
      e.grow = 1 + k * 0.35; ring.color.setHex(0xfff0b0); ring.opacity = (1 - k) * fade; halo.opacity = 0.9 * (1 - k);
      if (k >= 1) e.alive = false;
    } else {
      ring.opacity = fade; halo.opacity = 0.55 * fade;
      if (e.crossed) {
        // 0.3.0: the early levels count a ring from further out (the level's ease.ring, levels.js EASE)
        if (Math.hypot(api.ship.x - e.x, api.ship.y - e.y) < RING_R * api.ease.ring) { e.anim = 0.001; api.game.ring(e); }
        else api.game.missRing(e);
      }
    }
    e.sx = e.sy = e.sz = e.grow || 1;
    api.pose(e);
    if (e.z > 14) e.alive = false;
  },
});
function make() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat.clone()));
  const s = new THREE.Sprite(glow.clone()); s.scale.set(5, 5, 1); g.add(s);
  return g;
}
