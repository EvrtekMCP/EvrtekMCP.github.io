// THE LIGHTGATE (level 1, sector 4): a hexagonal hoop. Through the middle pays; the frame hurts.
// 0.2.0 (Evrtek, rule 9 ruling): white-violet, not cyan, so it reads as structure and never as your own shot.
import { THREE, definePickup, SHIP_R } from '../../api.js?v=0.3.0';

const GATE_R = 2.9, GATE_T = 0.32;
let geo, disc, mat, fill;
export default definePickup({
  name: 'gate',
  hazard: { cls: 'static', introduced: 2 }, // its frame costs a hit
  init() {
    geo = new THREE.TorusGeometry(GATE_R, GATE_T, 6, 6);
    disc = new THREE.CircleGeometry(GATE_R - GATE_T, 6);
    mat = new THREE.MeshBasicMaterial({ color: 0xc9b8ff });
    fill = new THREE.MeshBasicMaterial({ color: 0xece6ff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('gate', () => { const g = new THREE.Group(); g.add(new THREE.Mesh(geo, mat), new THREE.Mesh(disc, fill)); return g; });
    e.obj.rotation.z = Math.PI / 6;
  },
  update(e, dt, api) {
    e.obj.rotation.z += dt * 0.6;
    api.pose(e);
    // 0.3.0, the human pass (Evrtek 11-06; the human bot's newcomer took six of its thirteen hits on these): the frame
    // only costs a hit when the ship's middle all but meets the bar, so the clear hole is the gate's inside edge (it
    // was the inside edge less most of a wing) and a near miss outside the frame is a near miss (rule 14)
    if (e.crossed) {
      const d = Math.hypot(api.ship.x - e.x, api.ship.y - e.y);
      if (d < GATE_R - GATE_T) api.game.gate(e, true);
      else if (d < GATE_R + GATE_T + SHIP_R * 0.25) api.game.gateFrame(e);
      else api.game.gate(e, false);
    }
    if (e.z > 16) e.alive = false;
  },
});
