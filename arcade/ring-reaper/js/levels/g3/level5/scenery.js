// GALAXY 3, LEVEL 5 scenery: THE DRAFTING HALL (Yori's look sheet g3-level-05: an endless plane of blueprints standing
// on edge, cyanotype blue sheets ruled in white, plotters drawing lines of mines across them; the only blue level in
// the game). Her pieces from g3-scenery.js: draftingPlane(w, h, seed). Rule 9: the sheets are cyanotype blue (hue 222,
// well off cyan's 190) and white; the only red is the plotters' mines, and they hurt.
// Also here: the CACHE CLUE (the plan's 6.4): a green glow bleeding round a finished mine line and green and amber
// sparks drifting out of it, so a Shield Cell and a cache behind the line are never a secret without a sign.
import { THREE, defineScenery, defineDecor, GlowPoints, clamp } from '../../../api.js?v=0.5.0';
import { MESH } from './mesh.js?v=0.5.0';
import { meshDecor, pieceGroup, fadeTo, side } from '../level4/kit.js?v=0.5.0';

// ---- decor: the standing sheets (two of her seeds), edge-on beside the lane
export const sheet = meshDecor('g3-l5-sheet', [MESH.plane, MESH.plane2], { cap: 40, keep: 80 });

// ---- streams
// the hall: sheets standing on edge in long rows beside the lane, turned along it, some leaning; and smaller ones far
// below, flat, like a drafting floor
export const hall = defineScenery({
  name: 'g3-l5-hall',
  stream: { every: [44, 90], place: (R, api) => {
    const b = api.box, s = R.range(0.5, 1.1);
    if (api.tier === 0 && R() < 0.3) return null;
    const x = side(R, b.x * 2 + 31 * s, b.x * 2 + 110);
    return { type: 'g3-l5-sheet', x, y: R.range(-b.y * 2, b.y * 4), s, v: R.int(0, 1), ry: Math.sign(x) * Math.PI / 2 + R.range(-0.35, 0.35), rz: R.range(-0.15, 0.15) }; // its ruled face toward the lane
  } },
});
export const floor = defineScenery({
  name: 'g3-l5-floor',
  stream: { every: [70, 140], place: (R, api) => {
    const b = api.box, s = R.range(0.35, 0.7);
    if (api.tier === 0 && R() < 0.5) return null;
    return { type: 'g3-l5-sheet', x: R.range(-b.x * 8, b.x * 8), y: -b.y * 2.4 - 26 - R.range(0, 30), s, v: R.int(0, 1), rx: Math.PI / 2 + R.range(-0.2, 0.2), rz: R() * 6 }; // face up
  } },
});

// ---- the set piece: THE ENDLESS SHEET, the landmark. A blueprint the size of a mountain standing on edge far ahead, its
// white rules glowing; in the master act it draws in. fog: false, fading by its weight.
export const endless = defineScenery({
  name: 'g3-l5-endless',
  ease: 0.35,
  init(api) {
    const g = new THREE.Group(); g.visible = false; g.renderOrder = -3;
    const a = pieceGroup(MESH.plane, { fog: false }), b = pieceGroup(MESH.plane2, { fog: false });
    a.scale.setScalar(16); b.scale.setScalar(12); a.position.set(-260, 80, 0); b.position.set(380, -60, 200); b.rotation.y = -0.5; a.rotation.y = 0.25;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0x4a80f0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    halo.scale.set(900, 600, 1);
    g.add(halo, a, b); api.scene.add(g);
    return { g, a, b, halo };
  },
  update(s, w, dt, api) {
    s.g.visible = w > 0.003;
    fadeTo(s.a, w * 0.9); fadeTo(s.b, w * 0.8); s.halo.material.opacity = 0.12 * w;
    const L = api.level, k = L ? clamp((api.G.courseD ?? 0) / L.length, 0, 1) : 0;
    s.g.position.set(0, 0, -2600 + 900 * k);
  },
});

// ---- THE CACHE CLUE: a glow bleeding round whatever hides a reward, in the reward's own colour, and motes of it (and of
// the cache's amber) drifting out (two clues: the plan's glow bleed and sparks). Event: { nx, ny, w, h (metres of the
// glow), color }
let motes = null;
export const clue = defineDecor({
  name: 'g3-l5-clue',
  init(api) { motes = new GlowPoints(api.scene, 400, api.glowTex); },
  begin() { motes.begin(); },
  end(api) { motes.setScale(api.focalPx * 1.2); motes.end(); },
  spawn(e, ev, api) {
    e.obj = api.course.get('g3-l5-clue', () => new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0x4dff8a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5 })));
    e.obj.material.color.setHex(ev.color || 0x4dff8a);
    e.sx = (ev.w || 7) * 1.6; e.sy = (ev.h || 6) * 1.6; e.sz = 1; e.seed = Math.random() * 100;
  },
  update(e, dt, api) {
    api.pose(e);
    e.obj.material.opacity = (0.42 + 0.12 * Math.sin(e.t * 3)) * e.appear;
    const a = e.appear, W = (e.ev.w || 7) / 2, H = (e.ev.h || 6) / 2;
    for (let i = 0; i < 18; i++) {
      const ph = (e.t * 0.35 + i / 18) % 1, ang = i * 2.4 + e.seed;
      const r = 1 + ph * 0.9, x = e.x + Math.cos(ang) * W * r, y = e.y + Math.sin(ang) * H * r;
      const amber = i % 3 === 0;
      motes.push(x, y, e.z + 1, 0.9 * a, amber ? 1 : 0.3, amber ? 0.8 : 1, amber ? 0.2 : 0.55, (1 - ph) * 0.9 * a);
    }
    if (e.z > 12) e.alive = false;
  },
});
