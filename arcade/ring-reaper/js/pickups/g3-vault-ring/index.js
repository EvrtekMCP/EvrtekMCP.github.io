// THE VAULT RING (galaxy 3, level 9): the rings inside a vault, and the High Roller's payout.
//   IN A VAULT  { vault: id, nx, ny }: a plain amber ring that COUNTS in the ring total, laid in a line through its
//               vault. It shows (and can be caught) only while its vault is open; while the door is shut it waits behind
//               it unseen, and flying round a shut vault costs nothing (no MISS, no combo step). The Ring Magnet pulls it
//               only through an open door (never through a wall).
//   A PAYOUT    { payout: true, cache: true, x, y, tx, ty }: spawned by the High Roller's amber segments and its JACKPOT.
//               An extra (a cache: score, combo and shield, never part of a star). It flies out of the wheel toward its
//               spot in the lane, growing in from nothing as it leaves (never popping into view).
import { THREE, definePickup, RING_R, clamp } from '../../api.js?v=0.6.1';
import { VAULTS } from '../../obstacles/g3-vault/index.js?v=0.6.1';

let geo, mat, glow;
function make() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat.clone()));
  const s = new THREE.Sprite(glow.clone()); s.scale.set(5, 5, 1); g.add(s);
  return g;
}
export default definePickup({
  name: 'g3-vault-ring',
  countsAsRing: true,
  hazard: null,
  sample: { nx: 0, ny: 0, payout: true, cache: true, x: 0, y: 0, tx: 0, ty: 0 },
  init(api) {
    geo = new THREE.TorusGeometry(1.6, 0.13, 8, 28);
    mat = new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true });
    glow = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffb020, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 });
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('g3-vault-ring', make);
    e.anim = 0; e.grow = 1; e.show = 0; e.payout = !!ev.payout;
    if (e.payout) { e.x0 = ev.x; e.y0 = ev.y; e.z0 = Math.min(-20, e.z); e.grow = 0; e.show = 1; e.appear = 0; }
    else { e.ev.noMagnet = true; e.decor = true; }
    e.obj.children[0].material.color.setHex(0xffcc33);
  },
  update(e, dt, api) {
    const ring = e.obj.children[0].material, halo = e.obj.children[1].material;
    let vault = null, open = true;
    if (!e.payout) {
      vault = VAULTS.get(e.ev.vault); open = !!(vault && vault.open);
      // the bots and the magnet see it only through an open door
      e.decor = !open; e.ev.noMagnet = !open;
      e.show = clamp(e.show + (open ? 1 : -1) * dt / 0.22, 0, 1);
    } else {
      // out of the wheel, toward its spot in the lane, growing in as it goes
      const p = clamp(1 - e.z / e.z0, 0, 1), q = p * (2 - p);
      e.x = e.x0 + (e.ev.tx - e.x0) * q; e.y = e.y0 + (e.ev.ty - e.y0) * q;
      e.grow = clamp(e.grow + dt / 0.3, 0, 1);
    }
    e.obj.rotation.z += dt * 1.2;
    const fade = e.z > 0 ? Math.max(0, 1 - e.z / 4) : 1;
    if (e.anim > 0) {
      e.anim += dt; const k = Math.min(1, e.anim / 0.16);
      e.sc = 1 + k * 0.35; ring.color.setHex(0xfff0b0); ring.opacity = (1 - k) * fade; halo.opacity = 0.9 * (1 - k);
      if (k >= 1) e.alive = false;
    } else {
      e.sc = 1;
      ring.opacity = fade * e.show; halo.opacity = 0.55 * fade * e.show;
      if (e.crossed) {
        const near = Math.hypot(api.ship.x - e.x, api.ship.y - e.y) < RING_R * api.ease.ring;
        if (open && near) { e.anim = 0.001; api.game.ring(e); }
        else if (open) api.game.missRing(e);   // a payout is a cache: missing it costs nothing (the engine's rule)
        else e.alive = false;                   // behind a shut door: gone, at no cost
      }
    }
    e.sx = e.sy = e.sz = e.sc * e.grow;
    api.pose(e);
    if (e.z > 14) e.alive = false;
  },
});
