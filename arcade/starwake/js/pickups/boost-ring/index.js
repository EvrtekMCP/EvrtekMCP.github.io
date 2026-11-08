// THE BOOST RING (level 2's headline): Yori's amber hoop with three white chevrons. Boost rings come in CHAINS;
// fly every ring of a chain in order and it fires a SPEED BURST: x1.4 for 3 s, a chain bonus, and GREED. Miss one
// and the chain is broken (the rings still count as rings). Amber is the collect hue (rule 9); the chevrons and
// the size tell it from a plain ring (rule 8).
//   add(d, 'boost-ring', { nx, ny, chain: 'c1', idx: 0, of: 4 })     (layout: L.line(d, x0, y0, x1, y1, n, step,
//   'boost-ring', (i, n) => ({ chain: 'c1', idx: i, of: n })) lays a whole chain)
import { THREE, definePickup, buildModel } from '../../api.js?v=0.4.1';
import { MESH } from './mesh.js?v=0.4.1';

const R_COLLECT = 2.1;              // a touch more generous than a plain ring (rule 14): it is bigger
export const BOOST = { secs: 3.0, mul: 1.4, bonus: 1000, greed: 20 };
const chains = new Map();           // chain id -> { got, missed }
let glowMat;
function make(api) {
  const g = new THREE.Group();
  const m = buildModel(MESH.ring, { own: ['#ffcc33*', '#dfe6f2*'] });
  m.group.scale.setScalar(0.62);    // her ring is 3.2 across the middle; ours flies at about 2
  g.add(m.group);
  const s = new THREE.Sprite(glowMat.clone()); s.scale.set(7, 7, 1); g.add(s);
  g.userData = { amber: m.mats['#ffcc33*'], chev: m.mats['#dfe6f2*'], glow: s, spinner: m.group };
  return g;
}
export default definePickup({
  name: 'boost-ring',
  countsAsRing: true,
  hazard: null,
  sample: { chain: '_warm', idx: 0, of: 1 },
  init(api) { glowMat = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffb020, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6 }); },
  spawn(e, ev, api) {
    e.obj = api.course.get('boost-ring', () => make(api));
    const u = e.obj.userData;
    u.amber.color.setHex(0xffcc33); u.amber.transparent = true; u.amber.opacity = 1; u.chev.transparent = true; u.chev.opacity = 1; u.glow.material.opacity = 0.6;
    e.anim = 0; e.grow = 1;
    if (ev.idx === 0) chains.set(ev.chain, { got: 0, missed: false });
  },
  update(e, dt, api) {
    const u = e.obj.userData, ev = e.ev;
    u.spinner.rotation.z += dt * 2.2;
    const fade = e.z > 0 ? Math.max(0, 1 - e.z / 4) : 1;
    if (e.anim > 0) {
      e.anim += dt; const k = Math.min(1, e.anim / 0.18);
      e.grow = 1 + k * 0.5; u.amber.color.setHex(0xfff0b0); u.amber.opacity = u.chev.opacity = (1 - k) * fade; u.glow.material.opacity = 0.95 * (1 - k);
      if (k >= 1) e.alive = false;
    } else {
      u.amber.opacity = u.chev.opacity = fade; u.glow.material.opacity = (0.45 + 0.2 * Math.sin(e.t * 9)) * fade;
      if (e.crossed) {
        const c = chains.get(ev.chain) || { got: 0, missed: true };
        if (Math.hypot(api.ship.x - e.x, api.ship.y - e.y) < R_COLLECT * api.ease.ring) { // 0.3.0: the level's ease.ring
          e.anim = 0.001; api.game.ring(e);
          if (!c.missed) {
            c.got++;
            if (c.got >= ev.of) {
              api.game.boost(BOOST.secs, BOOST.mul);
              api.game.score(BOOST.bonus * api.game.mult, api.ship.x, api.ship.y + 2, 0, 'big', 'BOOST');
              api.game.greed(BOOST.greed);
              api.game.call('BOOST!', '');
              api.game.sfx('reward'); // at its own pitch: at 1.3 the default sat 87% in 2-5 kHz, the piercing band (11-07)
            } else api.game.pop(c.got + ' / ' + ev.of, e.x, e.y - 1.6, 0, '');
          }
        } else {
          api.game.missRing(e);
          if (!c.missed && ev.of > 1) { c.missed = true; api.game.pop('CHAIN BROKEN', e.x, e.y, 0, 'red'); }
        }
        chains.set(ev.chain, c);
      }
    }
    e.sx = e.sy = e.sz = e.grow;
    api.pose(e);
    if (e.z > 14) e.alive = false;
  },
});
