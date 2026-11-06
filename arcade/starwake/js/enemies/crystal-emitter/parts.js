// LEVEL 9 helpers shared by the crystal emitter, the Twins and the Mirror Field's scenery: Yori's vertex lists
// (exported per part by tools/levels/level9/export-meshes.cjs into each folder's mesh.js) made into three.js
// objects, with her colours through the game's own material spec (api.material), so they light like level 1's.
import { THREE, material } from '../../api.js?v=0.2.0';

const geoCache = new Map();
// one BufferGeometry per exported group (flat triangles, so every face keeps its own normal)
export function geometryOf(g) {
  let geo = geoCache.get(g);
  if (!geo) {
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3));
    geo.computeVertexNormals(); geo.computeBoundingSphere();
    geoCache.set(g, geo);
  }
  return geo;
}
// groups -> { group, parts: { name: Group }, mats: { '#rrggbb' or '#rrggbb*': material } }. `own` lists the colour
// keys that get a private material (parts that flash); everything else shares the game's material.
export function buildParts(groups, { own = [], skip = [] } = {}) {
  const group = new THREE.Group(), parts = {}, mats = {};
  for (const g of groups) {
    if (skip.includes(g.part)) continue;
    const key = g.color + (g.glow ? '*' : '');
    const mine = own.includes(key) || own.includes(g.part + ':' + key);
    const mat = mine ? material(g.color, g.glow, true) : material(g.color, g.glow);
    const mesh = new THREE.Mesh(geometryOf(g), mat);
    mats[g.part + ':' + key] = mat; if (!mats[key]) mats[key] = mat;
    if (!parts[g.part]) { parts[g.part] = new THREE.Group(); group.add(parts[g.part]); }
    parts[g.part].add(mesh);
  }
  return { group, parts, mats };
}
// a flat ring sprite texture (the ghost bolt's look: hollow, no glow) drawn once
let ringTexOnce = null;
export function ringTex() {
  if (ringTexOnce) return ringTexOnce;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 9;
  g.beginPath(); g.arc(32, 32, 22, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(32, 32, 6, 0, Math.PI * 2); g.fill();
  ringTexOnce = new THREE.CanvasTexture(c); ringTexOnce.colorSpace = THREE.SRGBColorSpace;
  return ringTexOnce;
}
