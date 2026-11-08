// THE COUNTERFEIT's race rings: the rings it races you for during the fight. A boss fight holds the course (no course
// event spawns), so the fight lays its own ring lines; they are not the level's rings and count toward no ring share
// (galaxy 1's fights have none either). Caught, one pays as a ring does: points with the combo, a step of combo,
// shield. Taken by the Counterfeit first (it flies ahead of you), one mends its hull a third of a crack.
// In the Photo Finish they are boost rings: fly a whole chain and it fires a speed burst, as galaxy 1's do.
import { THREE, definePickup, RING_R } from '../../api.js?v=0.4.1';

let geo, mat, glow, chev;
const chains = new Map();
function make() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat.clone()));
  const s = new THREE.Sprite(glow.clone()); s.scale.set(5, 5, 1); g.add(s);
  const c = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.06, 4, 3), chev.clone()); g.add(c); // the boost mark: a white triangle round it
  return g;
}
export const raceRing = definePickup({
  name: 'g3-cf-ring',
  hazard: null,
  sample: { boost: true, chain: '_warm', idx: 0, of: 1 },
  init(api) {
    geo = new THREE.TorusGeometry(1.6, 0.13, 8, 28);
    mat = new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true });
    glow = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffb020, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 });
    chev = new THREE.MeshBasicMaterial({ color: 0xdfe6f2, transparent: true });
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('g3-cf-ring', make);
    e.obj.children[0].material.color.setHex(0xffcc33); e.obj.children[0].material.opacity = 1; e.obj.children[1].material.opacity = 0.55;
    e.obj.children[2].visible = !!ev.boost; e.obj.children[2].material.opacity = 1;
    e.anim = 0; e.grow = 1; e.taken = false;
    if (ev.boost && ev.idx === 0) chains.set(ev.chain, { got: 0, broken: false });
  },
  update(e, dt, api) {
    e.obj.rotation.z += dt * (e.ev.boost ? 2.2 : 1.2);
    const fade = e.z > 0 ? Math.max(0, 1 - e.z / 4) : 1, m = e.obj.children[0].material, h = e.obj.children[1].material, c = e.obj.children[2].material;
    if (e.anim > 0) {
      e.anim += dt; const k = Math.min(1, e.anim / 0.16);
      e.grow = 1 + k * 0.35; m.color.setHex(e.taken ? 0xff5a4a : 0xfff0b0); m.opacity = (1 - k) * fade; h.opacity = 0.9 * (1 - k); c.opacity = 1 - k;
      if (k >= 1) e.alive = false;
    } else {
      m.opacity = fade; h.opacity = 0.55 * fade; c.opacity = fade;
      if (e.crossed) {
        const ch = e.ev.boost ? chains.get(e.ev.chain) : null;
        if (Math.hypot(api.ship.x - e.x, api.ship.y - e.y) < RING_R * (e.ev.boost ? 1.2 : 1) * api.ease.ring) {
          e.anim = 0.001;
          const g = api.game, roll = g.rolling;
          g.chain(1);
          g.score(100 * g.mult * (roll ? 2 : 1), e.x, e.y + 1.2, 0, roll ? 'cyan' : '', roll ? 'ROLL-RING' : '');
          g.heal(4 * api.ease.heal);
          g.sfx('ring', { rate: 1.05, pan: e.x / api.box.x * 0.5 });
          // a completed chain plays the reward cue at its own pitch (Evrtek 11-07; at 1.3 the default sits 87% in 2-5 kHz, the piercing band)
          if (ch && !ch.broken && ++ch.got >= e.ev.of) { g.boost(2.4, 1.3); g.call('BOOST!', ''); g.sfx('reward'); }
        } else if (ch) ch.broken = true;
      }
    }
    e.sx = e.sy = e.sz = e.grow;
    api.pose(e);
    if (e.z > 14) e.alive = false;
  },
});
// the Counterfeit takes one: it flashes red and is gone (no miss for you; it was never yours)
export function take(e) { e.taken = true; e.anim = 0.001; if (e.ev.boost) { const ch = chains.get(e.ev.chain); if (ch) ch.broken = true; } }
