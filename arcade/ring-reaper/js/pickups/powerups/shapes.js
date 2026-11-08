// STARWAKE 0.4.0: the six power-up shapes and the halo they turn in: YORI's (art-incoming/yori/g2/powerups.js, branch
// g2-art), through tools/art/export-model.js into ./mesh.js. Each returns a Group about 1.2 m across, centred, built once
// and pooled, with its own materials (so one pickup fading never fades another). A ring is a hoop you fly through; a
// power-up is a SOLID thing you fly into, so the two never read alike (rule 8).
//   node tools/art/export-model.js art-incoming/yori/g2/powerups.js js/pickups/powerups/mesh.js shieldCell=shield overclock=overclock "mirrorShell=mirror([0])" "mirrorShell=mirrorFlash([1])" phase=phase ringMagnet=magnet slipstream=slip "halo=halo([1.25])"
import { buildModel } from '../../api.js?v=0.5.0';
import { MESH } from './mesh.js?v=0.5.0';

const keysOf = (m) => m.map((g) => g.color + (g.glow ? '*' : ''));
// a model with materials of its own, every one able to fade
function own(name) {
  const m = buildModel(MESH[name], { own: keysOf(MESH[name]) });
  for (const mat of Object.values(m.mats)) { mat.transparent = true; mat.userData.op = 1; }
  return m;
}
function shape(name, extra = {}) {
  const m = own(name);
  m.group.userData = Object.assign({ mats: Object.values(m.mats) }, extra);
  return m.group;
}
export const SHAPES = {
  shield: () => shape('shield'),                     // a six-sided battery cell, two dark bands, a pale terminal
  overclock: () => shape('overclock', { spin: 7 }),  // an eight-toothed cog, spinning fast about its axle
  // a three-faced mirrored pyramid with one face flashing white: her two states, swapped as it turns
  mirror: () => {
    const a = own('mirror'), b = own('mirrorFlash');
    a.group.add(b.group); b.group.visible = false;
    a.group.userData = { mats: Object.values(a.mats).concat(Object.values(b.mats)), flashPair: [a.group.children.filter((c) => c !== b.group), b.group] };
    return a.group;
  },
  phase: () => shape('phase', { flicker: true }),   // an outline-only octahedron, bright vertices, a point at its heart
  magnet: () => shape('magnet'),                     // a horseshoe U with pale tips, facing the player
  slip: () => shape('slip'),                         // an hourglass: two cones tip to tip, dark end plates, pale pillars
};
// the thin white ring every pickup turns inside
export const HALO = () => { const m = own('halo'); m.group.userData = { mats: Object.values(m.mats) }; return m.group; };
