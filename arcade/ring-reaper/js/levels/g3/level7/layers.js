// GALAXY 3, levels 7-9 (CLU, g3-c): drawing Yori's pieces as scenery. One instanced layer per colour group of one of her
// models: lit groups take her colour and metal; glowing groups are unlit (white, tinted per copy when asked). And a
// far model for a landmark: her groups with their own materials, out of the fog, faded by the scenery's weight.
import { THREE, Instanced, modelGroups } from '../../../api.js?v=0.6.0';

const tmpC = new THREE.Color();
// opts.dead: glowing colours to draw unlit in her "dead" colour (#2a2730): the guns mounted on a scenery gantry are
// not enemies, and red hurts (rule 9), so on scenery their cores are dark
export function layersOf(api, groups, cap, opts = {}) {
  return modelGroups(groups).map((g) => {
    const dead = g.glow && opts.dead && opts.dead.includes(g.color);
    const mat = dead ? new THREE.MeshStandardMaterial({ color: 0x2a2730, metalness: 0.4, roughness: 0.6, flatShading: true })
      : g.glow ? new THREE.MeshBasicMaterial({ color: g.color })
      : new THREE.MeshStandardMaterial({ color: g.color, metalness: opts.metal ?? 0.45, roughness: opts.rough ?? 0.5, flatShading: true, emissive: g.color, emissiveIntensity: opts.selfLit || 0 });
    const L = new Instanced(api.scene, g.geo, mat, cap); L.glow = g.glow; L.color = tmpC.set(g.color).getHex();
    return L;
  });
}
export const begin = (sets) => { for (const ls of sets) for (const L of ls) L.begin(); };
export const end = (sets) => { for (const ls of sets) for (const L of ls) L.end(); };

// a landmark: her model, its own materials (transparent, no fog), opacity set by fade(w)
export function farModel(groups, opts = {}) {
  const g = new THREE.Group(), mats = [];
  modelGroups(groups).forEach((x) => {
    const dead = x.glow && opts.dead && opts.dead.includes(x.color);
    const m = dead ? new THREE.MeshBasicMaterial({ color: 0x2a2730, fog: false, transparent: true, opacity: 0 })
      : x.glow ? new THREE.MeshBasicMaterial({ color: x.color, fog: false, transparent: true, opacity: 0, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color: x.color, metalness: 0.4, roughness: 0.55, flatShading: true, fog: false, transparent: true, opacity: 0, emissive: x.color, emissiveIntensity: opts.selfLit ?? 0.35 });
    mats.push(m); g.add(new THREE.Mesh(x.geo, m));
  });
  g.visible = false; g.renderOrder = -1;
  g.userData.fade = (w) => { g.visible = w > 0.003; for (const m of mats) m.opacity = w; };
  return g;
}
