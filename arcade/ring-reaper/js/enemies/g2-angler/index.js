// THE ANGLER (galaxy 2, level 8 Angler's Deep; the plan 3.8). A huge grafted angler lying along the lane in the dark
// (Yori's anglerRib(close), anglerHead(), her bar; mesh.js, bar.js). Its open mouth is a tunnel of teeth; its lure, an
// amber ring on a glowing stalk, dangles into the flight box ahead of it.
//   - TAKE THE LURE (a real ring, an extra: LURE!, worth three rings) and the jaws close behind it: the angler lunges,
//     the teeth slide in from the rim over 1.2 s, and ONE CHEEK GAP stays open, lit green, on the side toward the open
//     lane. Steer out through it.
//   - SKIP THE LURE by flying round its head: safe, and it costs nothing.
// It never gets harder to read: it is lit by its own lure, its green eyes and the red seams on every rib (rule 16).
//
// How it plays (my calls where the plan is silent, for the MCP):
//   - The mouth is a disc in the flight box (its FOOTPRINT, the rim's radius) running 84 m along the lane. Outside the
//     footprint nothing can touch you. The lure hangs inside it.
//   - Entering the mouth (being in the footprint when its front reaches you) bites too, lure or no lure.
//   - A bite: the angler swims forward at 45% of your speed, so you spend about a second and a half inside instead of
//     half a second (her mouth is 70 m; at 140 m/s you would be through it before any jaw could close). The teeth
//     close on an ease-in (slowly at first, so taking the lure and turning for the gap is always in time).
//   - The teeth fill everything in the footprint outside the CHEEK GAP (a wedge 35 degrees either side of the gap's
//     direction) and farther from the axis than their tips. Caught in them: a small hit. Still in the footprint, and not
//     in the gap, when the throat arrives: a hard hit. One hit per angler at most. Phase: you pass through (PHASED!).
//   - kinds: 'side' (the usual: lying beside the lane, its footprint the outer third of the box, its gap facing the
//     middle); 'deep' (no cheek gap at all: the trap a SHIELD CELL sits in, with a violet crack on its front teeth:
//     Phase through); 'floor' (THE FALSE FLOOR: Yori's own size, the whole lane inside its mouth, its lure on top and
//     its cheek low on one side: the rings lead out through it).
//   add(d, 'g2-angler', { key, kind: 'side', side: 1, slow: false, lx, ly })   d = the mouth's middle; the level lays
//   the lure ring itself (an extra) at d - LURE_LEAD with { cache: true, lureOf: key } at the lure point (lurePoint()).
import { THREE, defineObstacle, clamp, SHIP_R } from '../../api.js?v=0.6.0';
import { MESH } from './mesh.js?v=0.6.0';
import { MESH as BAR } from './bar.js?v=0.6.0';
import { MESH as CRACK } from './crack.js?v=0.6.0';
import { morphModel, setMorph } from '../g2-bloomer/morph.js?v=0.6.0';

// her proportions: rib radius 11, teeth reach 2.5 (open) to 9 (shut) from 10.6, the cheek gap at angle 0 (no teeth
// within 0.6 rad of it), the lure ring 7 above the axis and 67 ahead of the mouth's middle, the mouth 70 long
const RIB_R = 11, TIP_OPEN = 8.1, TIP_SHUT = 1.6, LURE_UP = 7, LURE_AHEAD = 67, MOUTH = 70, HEAD = 57;
export const KZ = 1.2;                                // the length stretch along the lane (the mouth 84 m)
export const LURE_LEAD = LURE_AHEAD * KZ;             // how far ahead of the mouth's middle the lure hangs (80.4 m)
const GAP = 0.62, CLOSE_T = 1.2, LUNGE = 0.45;
// the side angler's lure, in the normalised box (its axis sits 7 x scale below it): the level lays the ring here
export const lurePoint = (kind, side) => (kind === 'floor' ? { nx: 0, ny: 0.86 } : { nx: side * 0.82, ny: 0.31 });

// Her mouth is seven identical ribs along its length and twelve bars round it (anglerMouth): the seven ribs are merged
// into one list per colour (the shut pose with them, as the morph), and the twelve bars into one, so an angler draws in
// a dozen calls, not fifty. Built once and shared by every angler.
let MOUTH_GROUPS = null, BAR_GEO = null;
function mouthGroups() {
  if (MOUTH_GROUPS) return MOUTH_GROUPS;
  const rep = (p) => { const out = new Array(p.length * 7); for (let i = 0; i < 7; i++) { const dz = -MOUTH / 2 + (i + 0.5) * MOUTH / 7; for (let j = 0; j < p.length; j += 3) { out[i * p.length + j] = p[j]; out[i * p.length + j + 1] = p[j + 1]; out[i * p.length + j + 2] = p[j + 2] + dz; } } return out; };
  MOUTH_GROUPS = { open: MESH.ribOpen.map((g) => Object.assign({}, g, { p: rep(g.p) })), shut: MESH.ribShut.map((g) => Object.assign({}, g, { p: rep(g.p) })) };
  const bp = BAR.bar[0].p, all = [];
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, ox = Math.cos(a) * RIB_R, oy = Math.sin(a) * RIB_R; for (let j = 0; j < bp.length; j += 3) all.push(bp[j] + ox, bp[j + 1] + oy, bp[j + 2]); }
  BAR_GEO = new THREE.BufferGeometry(); BAR_GEO.setAttribute('position', new THREE.Float32BufferAttribute(all, 3)); BAR_GEO.computeVertexNormals(); BAR_GEO.computeBoundingSphere();
  return MOUTH_GROUPS;
}
function makeAngler() {
  const g = new THREE.Group(), M = mouthGroups();
  const ribs = [morphModel(M.open, M.shut)]; g.add(ribs[0].group);
  g.add(new THREE.Mesh(BAR_GEO, new THREE.MeshStandardMaterial({ color: 0x132a36, metalness: 0.3, roughness: 0.55, flatShading: true })));
  // her head with its stalk and lamp; her amber ring is left out: the real lure ring (an extra) hangs where it was
  const head = morphModel(MESH.head, null, { skip: ['#ffcc33*'] }); g.add(head.group);
  // the deep angler's clue: her violet phase crack on its front teeth, and a green glow (the Shield Cell inside)
  const crack = morphModel(CRACK.crack, null); crack.group.position.set(0, -2, -MOUTH / 2 - 1); crack.group.scale.setScalar(1.6); g.add(crack.group);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0x4dff8a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  glow.scale.set(14, 14, 1); g.add(glow);
  g.userData = { ribs, head, crack, glow };
  return g;
}
let GLOW = null;

export default defineObstacle({
  name: 'g2-angler',
  // its teeth sit in the track like any static thing, read from the haze (and its lure dangles long before them)
  hazard: { cls: 'static', introduced: [2, 8] },
  sample: { kind: 'side', side: 1 },
  // 0.3.1, no fully blocked moment: where its teeth are solid as its mouth goes by (open at the opening, half shut in the
  // middle, shut at the throat: the worst case, as if bitten). Inside the mouth's disc, the cheek gap (none on a deep
  // angler) and the core inside the teeth's tips are open; outside the disc is open water.
  solid(ev, box) {
    const g = geom(ev, box), M = MOUTH / 2 * KZ;
    return [[-M, TIP_OPEN], [0, TIP_OPEN - (TIP_OPEN - TIP_SHUT) * 0.25], [M, TIP_SHUT]].map(([at, tip]) => ({ at, dist: (x, y) => teethDist(g, tip * g.k, x, y) }));
  },
  init(api) { GLOW = api.glowTex; },
  spawn(e, ev, api) {
    e.obj = api.course.get('g2-angler', makeAngler);
    const u = e.obj.userData, box = api.box;
    e.kind2 = ev.kind || 'side'; e.side = ev.side || 1; e.key = ev.key;
    // (the false floor is the whole lane: its jaws take longer, so a pilot near its lure always has time to turn)
    e.closeT = ev.slow ? 2.6 : e.kind2 === 'floor' ? 1.8 : CLOSE_T;
    const g = geom(ev, box); e.k = g.k; e.gx = g.gx; e.x = g.x; e.y = g.y;
    // Her angler faces -Z (her mouth and lure toward the viewer of her sheets); in the game the ship meets a thing's +z
    // side first, so she is turned half round: mouth and lure toward you, the head beyond. Her cheek gap is at +x, which
    // the turn sends to -x: the mirror puts it back on the gap's side (the middle of the lane, or the false floor's cheek).
    e.obj.rotation.set(0, Math.PI, 0);
    e.mir = e.gx > 0 ? -1 : 1;
    e.sx = e.k * e.mir; e.sy = e.k; e.sz = KZ;
    e.rF = g.rF; e.gapHalf = g.gapHalf;
    e.bit = 0; e.c = 0; e.lunge = 0; e.hit = false; e.lureEnt = null; e.throat = false; e.wasIn = false; e.closed = false;
    for (const r of u.ribs) setMorph(r, 0);
    u.crack.group.visible = e.kind2 === 'deep'; u.glow.material.opacity = 0; u.glow.position.set(0, LURE_UP, -MOUTH / 2 + 8);
  },
  update(e, dt, api) {
    const u = e.obj.userData, ship = api.ship, v = Math.max(1, api.v);
    // the lure: its ring (laid by the level) taken means a bite
    if (!e.lureEnt && e.key) e.lureEnt = api.course.list.find((q) => q.alive && q.ev && q.ev.lureOf === e.key) || null;
    if (!e.bit && e.lureEnt && e.lureEnt.anim > 0) bite(e, api, true);
    // its mouth's opening (the near end, reaching you first) and its throat (the far end, where the head begins)
    const front = e.z + MOUTH / 2 * KZ, throat = e.z - MOUTH / 2 * KZ, pthroat = e.pz - MOUTH / 2 * KZ;
    // where the ship is in the mouth's cross-section
    const dx = ship.x - e.x, dy = ship.y - e.y, d = Math.hypot(dx, dy);
    const inFoot = d < e.rF;
    const ang = Math.abs(Math.atan2(dy, dx * e.gx));      // 0 = straight at the gap
    const inGap = e.gapHalf > 0 && ang < e.gapHalf;
    // entering the mouth (through its front as it reaches you, or through its side wall) bites; coming in through the
    // rim's teeth rather than the gap is a hit
    const spans = front >= 0 && throat < 0;                    // the mouth is round the ship's plane
    const inside = spans && inFoot;
    if (inside && !e.wasIn) {
      if (!inGap && d > TIP_OPEN * e.k) teeth(e, api);
      if (!e.bit) bite(e, api, false);
    }
    // the risk pays (rule 31): out of a closing mouth unhurt, or skimming past its rim with under a metre to spare,
    // is a CLOSE call
    if (!e.closed && !e.hit && ((e.wasIn && !inside && e.bit && spans) || (spans && !inFoot && d < e.rF + 1.0))) { e.closed = true; api.game.scrape(e, Math.max(0, d - e.rF)); }
    e.wasIn = inside;
    if (e.bit) {
      e.bit += dt;
      const k = clamp(e.bit / e.closeT, 0, 1); e.c = k * k;                 // the ease-in: slowly at first
      // the lunge: up to speed at once, held while the jaws close, then it gives up and drifts
      e.lunge = e.bit < e.closeT + 0.5 ? Math.min(LUNGE, e.lunge + dt * 3) : Math.max(0, e.lunge - dt * 0.6);
      e.z -= e.lunge * v * dt;
      const tip = (TIP_OPEN - (TIP_OPEN - TIP_SHUT) * e.c) * e.k;
      if (inside && !inGap && d > tip) teeth(e, api);
    }
    // the throat: still in the footprint and not in the gap as it passes (a deep angler's always bites)
    if (pthroat < 0 && throat >= 0 && inFoot && !inGap && !e.throat) {
      e.throat = true;
      if (!e.hit || e.kind2 === 'deep') { e.hit = true; const phasing = api.phasing; api.game.crash(e, 22, false); if (!phasing) api.game.call('SWALLOWED!', 'c-red'); }
    }
    for (const r of u.ribs) setMorph(r, e.c);
    // the deep angler's green glow (its Shield Cell) breathes between its teeth
    if (e.kind2 === 'deep') u.glow.material.opacity = (0.35 + 0.15 * Math.sin(e.t * 4)) * e.appear;
    api.pose(e);
    if (e.z - (HEAD + 20) * KZ > 12) e.alive = false;
  },
  // the bots stay out of a side or deep angler's footprint (and never chase its lure: it is an extra). The false floor
  // has the whole lane inside it: there the rings show the way to its cheek.
  avoid(e) {
    if (e.kind2 === 'floor') return [];
    if (e.z - MOUTH / 2 * KZ > 4) return [];         // until its throat has gone by
    return [{ x: e.x, y: e.y, r: e.rF + 1.4 }];
  },
});

// where an angler lies for this box (portrait is narrower): scale, axis, footprint, the gap's side and width
function geom(ev, box) {
  const kind = ev.kind || 'side', side = ev.side || 1, lp = lurePoint(kind, side);
  // the false floor holds the whole lane; a side angler's footprint never reaches past the lane's middle tenth
  const k = kind === 'floor' ? Math.max(1, Math.hypot(box.x, box.y * 1.7) / RIB_R * 1.05) : Math.min(0.42, 0.7 * box.x / RIB_R);
  return { kind, side, k, gx: -side, x: lp.nx * box.x, y: lp.ny * box.y - LURE_UP * k, rF: RIB_R * k, gapHalf: kind === 'deep' ? 0 : GAP };
}
// the distance from a ship centre to the teeth (below 0 inside them), with the tips reaching `tip` metres from the axis
function teethDist(g, tip, x, y) {
  const dx = x - g.x, dy = y - g.y, d = Math.hypot(dx, dy), out = d - g.rF;
  if (out > 0) return out;                                                    // out in the open water
  const ang = Math.abs(Math.atan2(dy, dx * g.gx));
  const inGap = g.gapHalf > 0 && ang < g.gapHalf ? d * Math.sin(g.gapHalf - ang) : -1e9, inCore = tip - d;
  const free = Math.max(inGap, inCore);
  return free > 0 ? free : Math.max(out, free);                               // in the gap or the core; else how deep in
}
function bite(e, api, lure) {
  e.bit = 0.001;
  if (lure) { api.game.call('LURE!', 'c-gold'); api.game.score(200 * api.game.mult, e.lureEnt.x, e.lureEnt.y + 1.5, 0, 'big', 'LURE'); api.game.sfx('g2-lure'); }
  api.game.sfx('g2-jaws', { vol: 0.9 });
  api.game.shake(0.35);
}
// caught in the teeth: a small hit, once an angler. A DEEP angler has no gap and no mercy: its teeth bite again each
// time the last hit's grace runs out, so taking its Shield Cell without Phase costs about what the cell gives back.
function teeth(e, api) {
  if (e.hit && e.kind2 !== 'deep') return;
  e.hit = true;
  // a deep angler's bite is a hard one (it resets the combo): its Shield Cell is a real risk without Phase
  if (e.kind2 === 'deep') api.game.crash(e, 22, false); else api.game.crash(e, 14, true);
}
// her whole angler as one model (the level 8 landmark, the Great Lantern, is her angler at six times this size)
export function buildAngler(api) { if (!GLOW) GLOW = api.glowTex; return makeAngler(); }
export { SHIP_R };
