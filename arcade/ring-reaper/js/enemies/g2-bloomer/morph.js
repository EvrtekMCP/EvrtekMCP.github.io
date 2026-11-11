// g2-c's shared helpers for Yori's galaxy 2 creatures (the bloomer, the angler, the conductor, the Murmur use them).
// Her vertex lists come in tell states (a bloomer shut and open, an angler's teeth open and shut): the same mesh in
// two poses. morphModel builds ONE three.js model from both, and every colour group that has the same triangles in
// both poses gets the second pose as a morph target, so a tell is a smooth tween (setMorph(model, 0..1)), never a swap.
// freedLook is the Verdant Deep's grammar (the plan, section 1): a sent-back shot burns the graft out, the red falls
// away and the creature goes silver (Yori's FREED colour #c0d0dc) as it darts off whole.
import { THREE } from '../../api.js?v=0.6.1';

const geoCache = new Map();
function geoOf(g, g2) {
  const key = g2 ? g : g;
  let geo = geoCache.get(key);
  if (geo && (!g2 || geo.morphAttributes.position)) return geo;
  geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3));
  if (g2) { const m = new THREE.Float32BufferAttribute(g2.p, 3); geo.morphAttributes.position = [m]; }
  geo.computeVertexNormals(); geo.computeBoundingSphere();
  geoCache.set(key, geo);
  return geo;
}
// Yori's material spec for a lit colour (the game's models.js values: a soft metal), or unlit for her glowing ones
function matOf(color, glow) {
  if (glow) return new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true });
  return new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.55, flatShading: true, side: THREE.DoubleSide, transparent: true });
}
// a: groups in pose 0; b: the same mesh in pose 1 (or null). skip: colour keys ('#ffcc33*') to leave out.
// -> { group, meshes: [{ mesh, key, color, glow, morph }], mats } with a private material per group (each pooled copy
// can flash, fade and go silver on its own).
export function morphModel(a, b, { skip = [] } = {}) {
  const group = new THREE.Group(), meshes = [], used = new Set();
  for (const g of a) {
    const key = g.color + (g.glow ? '*' : '');
    if (skip.includes(key)) continue;
    let twin = null;
    if (b) for (let i = 0; i < b.length; i++) { const h = b[i]; if (!used.has(i) && h.color === g.color && !!h.glow === !!g.glow && h.p.length === g.p.length) { twin = h; used.add(i); break; } }
    const mat = matOf(g.color, g.glow);
    const mesh = new THREE.Mesh(geoOf(g, twin), mat);
    if (twin) mesh.morphTargetInfluences = [0];
    group.add(mesh);
    meshes.push({ mesh, key, color: new THREE.Color(g.color), glow: !!g.glow, morph: !!twin, red: g.color === '#ff3355' });
  }
  return { group, meshes };
}
export function setMorph(model, k) { for (const m of model.meshes) if (m.morph) m.mesh.morphTargetInfluences[0] = k; }
// opacity for the whole model (a fade); red: an extra factor on the graft's red (0 hides it: freed)
export function setLook(model, { opacity = 1, silver = 0, red = 1 } = {}) {
  for (const m of model.meshes) {
    const mat = m.mesh.material;
    mat.opacity = opacity * (m.red ? red : 1);
    m.mesh.visible = mat.opacity > 0.01;
    if (silver > 0 && !m.red) mat.color.copy(m.color).lerp(FREED, silver); else mat.color.copy(m.color);
  }
}
export const FREED = new THREE.Color(0xc0d0dc);
