// STARWAKE: three.js meshes from Yori's vertex lists (js/meshes.js, generated from her scene3d.js).
// One mesh per colour group. Lit colours take her material spec (design sheet, revision 2); glowing colours are
// unlit. Materials are shared per colour unless `own` asks for private copies (for parts that flash).
import * as THREE from '../vendor/three/three.module.min.js?v=0.6.1';
import { MESHES } from './meshes.js?v=0.6.1';
import { param } from './params.js?v=0.6.1';

// metalness / roughness per lit colour, from the sheet
const SPEC = {
  '#6a7190': [0.5, 0.45],   // slate: the Wake's hull and ring-wing
  '#3a4058': [0.6, 0.35],   // gunmetal: struts, engine, cradle, canards
  '#4a5070': [0.45, 0.5],   // the Lattice's plating
  '#2a2e44': [0.55, 0.45],  // the Lattice's truss frames
};
const geoCache = new WeakMap(), matCache = {};
// Which Wake is built. ship-v3 (Yori, 2026-11-07, Evrtek's pick C): 3 (the default) is revision 4, two bell nozzles out on
// the outrigger blades and the blades to 1.55, so the back shows a roll turning; ?ship=v2 is revision 3 (ship-v2: the ring
// drawn in, blades to 1.38, one engine); ?ship=v1 is revision 2, as 0.4.0 shipped it (or #ship-v2, #ship-v1: params.js).
// Every ask for 'wake' (the ship, level 9's mirror ghost) gets the chosen one, so the looks never mix in one build.
export const SHIP_V = (() => { const v = param('ship'); return v === 'v1' ? 1 : v === 'v2' ? 2 : 3; })();
// a model is a name in js/meshes.js (0.1.0's: wake, pod, strafer, mine) or a groups array straight from a
// kind's own generated mesh file (0.2.0: tools/art/export-model.js writes one per kind, so no shared file)
const groupsOf = (model) => (Array.isArray(model) ? model : MESHES[model === 'wake' ? ['wake', 'wake', 'wake2', 'wake3'][SHIP_V] : model]);
function geometry(model, i) {
  const grp = groupsOf(model)[i];
  let g = geoCache.get(grp);
  if (!g) {
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(grp.p, 3));
    g.computeVertexNormals(); // non-indexed, so every face keeps its own normal: flat
    g.computeBoundingSphere();
    geoCache.set(grp, g);
  }
  return g;
}
export function material(color, glow, own) {
  const k = color + (glow ? '*' : '');
  if (!own && matCache[k]) return matCache[k];
  let m;
  if (glow) m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
  else { const [metalness, roughness] = SPEC[color] || [0.5, 0.45]; m = new THREE.MeshStandardMaterial({ color, metalness, roughness, flatShading: true, side: THREE.DoubleSide }); }
  if (!own) matCache[k] = m;
  return m;
}
// -> { group, parts: { body: Group, ring: Group, ... }, mats: { '#ff3355*': material, ... } }
export function buildModel(model, { own = [] } = {}) {
  const group = new THREE.Group(), parts = {}, mats = {};
  groupsOf(model).forEach((g, i) => {
    const key = g.color + (g.glow ? '*' : '');
    const mesh = new THREE.Mesh(geometry(model, i), material(g.color, g.glow, own.includes(key)));
    mats[key] = mesh.material;
    if (!parts[g.part]) { parts[g.part] = new THREE.Group(); group.add(parts[g.part]); }
    parts[g.part].add(mesh);
  });
  return { group, parts, mats };
}
// for instanced copies (the mines): one geometry per colour group
export function modelGroups(model) { return groupsOf(model).map((g, i) => ({ geo: geometry(model, i), color: g.color, glow: g.glow })); }
