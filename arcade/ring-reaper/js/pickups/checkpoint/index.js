// THE CHECKPOINT (0.6.0, the player pass; Evrtek 11-10: "Checkpoints on ALL levels ... a symbolic checkpoint you grab ...
// A visible object, not an invisible save. You restart from it if you fail the level"). One a level, laid by the engine
// on the ring line (levels.js layCheckpoint): about half way down a level, and just before the boss on a boss level.
// Fly through it and it is yours: the game keeps what the run had at that moment (main.js checkpoint), and a run that
// ends with its shield down may start again from here instead of from the start.
//
// What it looks like (a first build in code, for Kalakar to redraw): a tall hexagon of pale light standing across the
// lane, a slow diamond turning inside it, and a thin beam rising through it so it reads from far off. Pale ally blue and
// white: it is on your side, and it is none of the three reserved hues (rule 9: red hurts, amber is collected, cyan is
// what you send back). It is bigger than a ring and far more forgiving: CHECKPOINT_R, more than twice a ring's reach.
// A checkpoint you fly past does not count (main.js T.checkpointMissCounts): it says so, and the run carries on.
import { THREE, definePickup } from '../../api.js?v=0.6.0';

export const CHECKPOINT_R = 4.2;
const PALE = 0xeaf6ff, BLUE = 0x9fd8ff;
let frameGeo = null, diamondGeo = null, beamGeo = null, glowMat = null;

function make(api) {
  const g = new THREE.Group();
  const lit = (geo, color, opacity = 1) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity }));
  const frame = lit(frameGeo, PALE); frame.rotation.z = Math.PI / 6; g.add(frame);            // flat sides left and right, a point up
  const diamond = lit(diamondGeo, BLUE); g.add(diamond);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  g.add(beam);
  const glow = new THREE.Sprite(glowMat.clone()); glow.scale.set(11, 11, 1); g.add(glow);
  g.userData = { frame, diamond, beam, glow };
  return g;
}

export default definePickup({
  name: 'checkpoint',
  checkpoint: true,             // the bots never let one go, and the tips know it by this
  hazard: null,
  init(api) {
    if (frameGeo) return;
    frameGeo = new THREE.TorusGeometry(3.7, 0.15, 6, 6);     // six straight sides: a hexagon you fly through
    diamondGeo = new THREE.TorusGeometry(1.25, 0.1, 6, 4);   // four sides: a diamond
    beamGeo = new THREE.PlaneGeometry(0.42, 44);
    glowMat = new THREE.SpriteMaterial({ map: api.glowTex, color: BLUE, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.45 });
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('checkpoint', () => make(api));
    e.anim = 0; e.grow = 1; e.missed = false;
    const u = e.obj.userData; u.frame.material.opacity = 1; u.diamond.material.opacity = 1; u.beam.material.opacity = 0.3; u.glow.material.opacity = 0.45;
    u.frame.material.color.setHex(PALE);
  },
  update(e, dt, api) {
    const u = e.obj.userData;
    u.diamond.rotation.z -= dt * 1.1; u.diamond.rotation.y += dt * 1.7;
    const fade = e.z > 0 ? Math.max(0, 1 - e.z / 4) : 1, pulse = 0.5 + 0.5 * Math.sin(e.t * 3.2);
    if (e.anim > 0) {
      // taken: it opens out round the ship and is gone
      e.anim += dt; const k = Math.min(1, e.anim / 0.4);
      e.grow = 1 + k * 0.8;
      u.frame.material.opacity = 1 - k; u.diamond.material.opacity = 1 - k; u.beam.material.opacity = 0.5 * (1 - k); u.glow.material.opacity = 0.9 * (1 - k);
      if (k >= 1) e.alive = false;
    } else {
      u.frame.material.opacity = fade * (e.missed ? 0.35 : 1); u.diamond.material.opacity = fade * (e.missed ? 0.35 : 1);
      u.beam.material.opacity = (0.22 + 0.12 * pulse) * fade; u.glow.material.opacity = (0.35 + 0.15 * pulse) * fade;
      if (e.crossed) {
        if (Math.hypot(api.ship.x - e.x, api.ship.y - e.y) < CHECKPOINT_R) { e.anim = 0.001; u.frame.material.color.setHex(0xffffff); api.game.checkpoint(e); }
        else { e.missed = true; api.game.checkpointMiss(e); }
      }
    }
    e.sx = e.sy = e.sz = e.grow;
    api.pose(e);
    if (e.z > 14) e.alive = false;
  },
});
