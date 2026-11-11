// Galaxy 3, levels 4-6 (CLU g3-b): the scenery kit. Yori's pieces (her vertex lists, exported to each level's mesh.js)
// drawn as instanced decor that streams down the track, or as one persistent set piece that fades by its weight.
// Lit colours take a milled-metal spec (the Unmade is "precise, cold, unfinished"); glowing ones are unlit.
import { THREE, defineDecor, Instanced } from '../../../api.js?v=0.6.1';
import { geometryOf } from '../../../enemies/crystal-emitter/parts.js?v=0.6.1';

const tmpQ = new THREE.Quaternion(), eul = new THREE.Euler();
export function matFor(g, o = {}) {
  if (g.glow) return new THREE.MeshBasicMaterial({ color: g.color, fog: o.fog !== false, transparent: !!o.fade, opacity: 1, depthWrite: !o.fade, side: THREE.DoubleSide });
  return new THREE.MeshStandardMaterial({ color: g.color, metalness: 0.55, roughness: 0.4, flatShading: true, fog: o.fog !== false, transparent: !!o.fade, opacity: 1, side: THREE.DoubleSide, emissive: o.emissive || 0x000000 });
}
// a decor kind drawing one of `variants` (each an array of Yori's colour groups) per entity, instanced.
// Event fields: v (variant), s (scale), rx ry rz (turn), spin (rad/s about y), keep (metres past the ship it lives)
export function meshDecor(name, variants, { cap = 60, keep = 40, spinAxis = 'y' } = {}) {
  let layers = null;
  return defineDecor({
    name,
    init(api) { layers = variants.map((groups) => groups.map((g) => new Instanced(api.scene, geometryOf(g), matFor(g), cap))); },
    begin() { for (const v of layers) for (const L of v) L.begin(); },
    end() { for (const v of layers) for (const L of v) L.end(); },
    spawn(e, ev) { if (ev.dyM) e.y += ev.dyM; e.v = (ev.v || 0) % variants.length; e.s = ev.s || 1; e.rx = ev.rx || 0; e.ry = ev.ry || 0; e.rz = ev.rz || 0; e.spin = ev.spin || 0; },
    update(e, dt) {
      if (e.spin) { if (spinAxis === 'z') e.rz += e.spin * dt; else e.ry += e.spin * dt; }
      tmpQ.setFromEuler(eul.set(e.rx, e.ry, e.rz));
      const s = e.s * e.appear;
      for (const L of layers[e.v]) L.put(e.x, e.y, e.z, tmpQ, s, s, s);
      if (e.z > keep) e.alive = false;
    },
  });
}
// one of Yori's pieces as a plain group (a set piece's part), its materials collected so it can fade
export function pieceGroup(groups, o = {}) {
  const g = new THREE.Group(), mats = [];
  // far and fog-free, so unlit: a lit colour is drawn at its own value a little dimmed (lighting cost a phone a third of
  // its frame on the Orrery, measured), one-sided, and it never writes depth (it fades)
  for (const grp of groups) { const c = new THREE.Color(grp.color); if (!grp.glow) c.multiplyScalar(0.55); const m = new THREE.MeshBasicMaterial({ color: c, fog: o.fog !== false, transparent: true, opacity: 1, depthWrite: false }); mats.push(m); g.add(new THREE.Mesh(geometryOf(grp), m)); }
  g.userData.mats = mats;
  return g;
}
export const fadeTo = (g, w) => { for (const m of g.userData.mats) m.opacity = w; };
export const side = (R, lo, hi) => R.sign() * R.range(lo, hi);
