// THE FOREMAN (galaxy 3, level 3's boss; the plan's 4.3). Yori's master builder (art-incoming/yori/g3/g3-bosses.js:
// foremanCore, foremanPanel, foremanCage, foremanCrane, foremanRails; sheet boss-g3-03-the-foreman): a lilac-white
// core in a cage of eight panels it keeps rebuilding, a crane gantry over it with two arms, a shuttle rail either side.
// What makes it a new kind of fight: you take it apart while it builds, two steps at a time.
//  - Sent-back fire goes to the cage's lit KEYSTONES, not the core. A keystone knocked out drops its panel.
//  - With a side open the core is lit, and what you send back next hits it (rule 25: lit only while it can be hit).
//  - Meanwhile it rebuilds: the panel it will put back shows as its blueprint (level 1's read) two seconds before it is
//    back. You break, it builds: a race.
// It fights on the beat of its own track (g3/bosses/foreman, 143.69 bpm against the level's 144: the beat clock reads
// the playing take's own grid, so every attack sits on that track's beats, AUDIO-MANIFEST's bar map):
//   PHASE 1  THE FRAME     rivet triples from its arms, left then right, two bars apart
//   PHASE 2  THE CRANE     its arms swing girders across the lane (blueprint first, 1.2 s) while its shuttles weave
//                          bolts at you (level 2's), and the arms keep riveting; it rebuilds faster
//   PHASE 3  THE RUSH JOB  it gives the cage up (every panel falls; the core stays lit), backs off and builds walls in
//                          your lane at speed from blueprints, firing everything from its open core. The shortest phase
//   DEFEAT                 its cage collapses in on it and the crane arms fold, in a shower of sparks
// (0.6.0, Evrtek 11-10: no level has a timer. It no longer leaves on a clock; the fight ends when it is beaten.)
import { THREE, defineBoss, buildModel, clamp, damp, smoothstep, SPAWN_D } from '../../api.js?v=0.6.4';
import { MESH } from './mesh.js?v=0.6.4';
import { MESH as P } from './parts.js?v=0.6.4';
import { beatClock } from '../../levels/level3/beat.js?v=0.6.4';
import { follow } from '../../enemies/g3-shuttler/index.js?v=0.6.4';

const TAU = Math.PI * 2;
const SCALE = 1.9, HOLD = 110, HOLD_RUSH = 190;   // the Warden's size: enormous and exact, you feel small
const BAR = 240 / 143.688, ENTER_T = 4 * BAR;   // it flies in over the four bars of its track's Impact
const CORE_HP = 15;                             // 5 hits a phase (a decent player's fight ends well inside 110 s)
const REBUILD = [7.5, 6.0];                     // seconds a dropped panel stays down, phases 1 and 2 (its plan shows the last 2)
const PLAN_T = 2.0;
// what its bolts take off your shield (the engine's default is 16): a rivet 8, a weave (it follows you) 10. Sized from the
// decent human bot at real speed (tools/test/human.js 3-3 decent N 1 boss), as galaxy 1's Leviathan was softened
const RIVET_DMG = 8, WEAVE_DMG = 10;
// her eight keystones and the core (FOREMAN.weak, FOREMAN.core), turned to face us (the flip: x and z change sign)
const KEYS = [[9.604, 3.978, 0.025], [3.978, 9.604, 0.025], [-3.978, 9.604, 0.025], [-9.604, 3.978, 0.025], [-9.604, -3.978, 0.025], [-3.978, -9.604, 0.025], [3.978, -9.604, 0.025], [9.604, -3.978, 0.025]].map(([x, y, z]) => [-x, y, -z]);
const CORE = [0, 0, 2.2];
const RED = new THREE.Color(0xff3355), HOT = new THREE.Color(0xfff0f0), tmpV = new THREE.Vector3();
const glowSprite = (api, c, s) => { const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: c, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); g.scale.setScalar(s); return g; };

function build(api, b) {
  const root = new THREE.Group(), flip = new THREE.Group(); flip.rotation.y = Math.PI; root.add(flip);
  // the gantry: two legs and the top girder with its plan line
  for (const k of ['legL', 'legR', 'girder', 'girderPlan']) flip.add(buildModel(P[k]).group);
  // two crane arms, each hung from its hinge on the girder so it can swing (her foremanCrane, swing 0)
  b.arms = [1, -1].map((s) => {
    const pivot = new THREE.Group(); pivot.position.set(s * 6, 15, 2); pivot.rotation.z = s * 0.35;
    for (const k of ['armBeam', 'armHead', 'armJib', 'armPlan']) pivot.add(buildModel(P[k]).group);
    const core = buildModel(P.armCore, { own: ['#ff3355*'] }); pivot.add(core.group);
    const tip = new THREE.Object3D(); tip.position.set(0, -9.3, -5.2); pivot.add(tip);
    const charge = glowSprite(api, 0xff3355, 2.2); charge.position.copy(tip.position); pivot.add(charge);
    flip.add(pivot);
    return { s, pivot, mat: core.mats['#ff3355*'], tip, charge, tel: -1, swing: 0, swingT: -1, fold: 0 };
  });
  // the rails, a shuttle on each (her foremanRails); their noses are where the weaves leave from
  flip.add(buildModel(MESH.rails).group);
  b.noses = [1, -1].map((s) => { const n = new THREE.Object3D(); n.position.set(s * 13.5, -3.3, -1.9); flip.add(n); const c = glowSprite(api, 0xff3355, 1.8); c.position.copy(n.position); flip.add(c); return { n, charge: c, tel: -1 }; });
  // the cage: its two frame rings and eight panels (solid, or its blueprint while it is being rebuilt)
  b.cage = new THREE.Group(); flip.add(b.cage);
  b.cage.add(buildModel(P.cageBack).group, buildModel(P.cageFront).group);
  b.panels = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU + Math.PI / 8, g = new THREE.Group();
    g.position.set(Math.cos(a) * 7.5, Math.sin(a) * 7.5, -0.5); g.rotation.set(0.35, 0, a - Math.PI / 2, 'ZYX');
    const solid = buildModel(MESH.panelSolid, { own: ['#ff3355*'] }), plan = buildModel(MESH.panelPlan);
    g.add(solid.group, plan.group); plan.group.visible = false; b.cage.add(g);
    b.panels.push({ g, solid: solid.group, plan: plan.group, home: g.position.clone(), a, down: false, downT: 0, fall: 0 });
  }
  // the core: dark while the cage is shut, lit (her lilac-white) while a side is open
  const lit = buildModel(MESH.coreLit), dark = buildModel(MESH.coreDark);
  flip.add(lit.group, dark.group); lit.group.visible = false; b.coreLit = lit.group; b.coreDark = dark.group;
  b.coreMuzzle = new THREE.Object3D(); b.coreMuzzle.position.set(0, 0, -2.8); flip.add(b.coreMuzzle);
  b.coreCharge = glowSprite(api, 0xff3355, 3); b.coreCharge.position.set(0, 0, -2.9); flip.add(b.coreCharge);
  return {
    root,
    weak: KEYS.map((at, i) => ({ at, r: 2.0, hp: 1, counts: false, call: 'KEYSTONE DOWN!', tag: i })).concat([{ at: CORE, r: 3.0, hp: CORE_HP, counts: true, call: 'CORE DOWN!', tag: 'core' }]),
    muzzles: [[0, 0, 2.8]],
  };
}

// ---- the beat scheduler (as the Warden's): each phase is a cycle of beats on the boss track, started on a bar line
// Where the fight is, in beats. At real speed, its track's own position (every attack on the music). With the dev menu's
// SPEED (Evrtek's review, and the test bots at 3x) the world runs faster than the music, so it counts beats of world
// time instead: the fight keeps its rhythm in game time at any speed, and is the same fight, only quicker.
function beatNow(b, api) {
  const G = api.G || {};
  return G.dev && G.devSpeed && G.devSpeed !== 1 ? b.gameBeat || 0 : beatClock(api).beat;
}
function sched(b, api, onBeat, cycle) {
  const bi = Math.floor(beatNow(b, api) + 1e-6);
  if (b.sch.origin === null) b.sch.origin = (Math.floor(bi / 4) + 1) * 4;
  if (bi === b.sch.last) return;
  b.sch.last = bi;
  const k = bi - b.sch.origin; if (k < 0) return;
  onBeat(b, api, k % cycle, Math.floor(k / cycle));
}
const beatSec = (api) => beatClock(api).beatSec;
const world = (o) => { o.updateWorldMatrix(true, false); o.getWorldPosition(tmpV); return { x: tmpV.x, y: tmpV.y, z: tmpV.z }; };
const aim = (api, lead = 0.3) => { const s = api.ship, B = api.box; return [clamp(s.x + s.vx * lead, -B.x, B.x), clamp(s.y + s.vy * lead, -B.y, B.y)]; };
const anyDown = (b) => b.panels.some((p) => p.down);

// the tells: an arm's core and a rail shuttle's nose glow red to white-hot for two beats
function tellArm(b, api, i) { const A = b.arms[i]; A.tel = 0; api.game.sfx('fire', { rate: 0.6, vol: 0.45 }); }
function tellNose(b, api, i) { b.noses[i].tel = 0; api.game.sfx('g3-shuttle', { vol: 0.5 }); }
function triple(b, api, i) {
  const A = b.arms[i], T = 3 * beatSec(api); A.tel = -1;
  for (let k = 0; k < 3; k++) b.later(k * 0.12, () => { const [tx, ty] = aim(api); api.fire(world(A.tip), tx, ty, { T, owner: b, dmg: RIVET_DMG }); });
}
function weave(b, api, i) {
  const N = b.noses[i], T = 3.4 * beatSec(api), Ts = T * api.ease.shot, B = api.box; N.tel = -1;
  const [tx, ty] = aim(api, 0.2);
  api.fire(world(N.n), tx, ty, { T, owner: b, weave: { amp: B.x * 0.45, hz: 1.5 / Ts, axis: 'x', phase: 0 }, steer: follow(7), dmg: WEAVE_DMG });
  api.game.sfx('g3-weave', { vol: 0.7 });
}
function girder(b, api, n) {
  const A = b.arms[n % 2]; A.swingT = 0;
  api.spawn({ type: 'g3-foreman-girder', ny: n % 2 ? 0.45 : -0.45, side: A.s > 0 ? -1 : 1, boss: b }, b.z + 8);
}
function coreFan(b, api) {
  const T = 3 * beatSec(api), [tx, ty] = aim(api, 0.15), B = api.box, from = world(b.coreMuzzle);
  for (let k = 0; k < 5; k++) api.fire(from, clamp(tx + (k / 4 - 0.5) * 7, -B.x, B.x), ty, { T, owner: b, dmg: RIVET_DMG });
  b.coreTel = -1;
}
function coreTriple(b, api) {
  const T = 3 * beatSec(api); b.coreTel = -1;
  for (let k = 0; k < 3; k++) b.later(k * 0.13, () => { const [tx, ty] = aim(api); api.fire(world(b.coreMuzzle), tx, ty, { T, owner: b, dmg: RIVET_DMG }); });
}
function rushWall(b, api, n) {
  // a wall built in your lane from its blueprint, its gap a little off your line: read the plan, move
  const B = api.box, s = api.ship, off = [[0.35, 0.2], [-0.35, -0.25], [0.3, -0.3], [-0.3, 0.3]][n % 4];
  const gx = clamp(s.x / B.x + off[0], -0.6, 0.6), gy = clamp(s.y / B.y + off[1], -0.55, 0.55);
  api.spawn({ type: 'g3-blueprint-wall', gap: [gx, gy, 0.3, 0.33], lead: 1.0, grow: true }, b.z + 18);
}

// the patterns, in beats of its track, sized to the plan's ~20 roll moments a minute in this fight (4.3: 60% roll demand)
// THE FRAME, 4 bars: a triple from the left arm, a weave from a rail, a triple from the right (a roll moment every four
// beats, then a bar's breath; never more than three in any 3 s)
const P1 = (b, api, s, n) => {
  if (s === 0) tellArm(b, api, 0); else if (s === 2) triple(b, api, 0);
  else if (s === 4) tellNose(b, api, n % 2); else if (s === 6) weave(b, api, n % 2);
  else if (s === 8) tellArm(b, api, 1); else if (s === 10) triple(b, api, 1);
};
// THE CRANE, 6 bars: a girder, a weave, a triple from each arm; a girder at the other height, a weave from the other
// rail, a triple from each arm
const P2 = (b, api, s, n) => {
  if (s === 0) girder(b, api, n * 2);
  else if (s === 2) tellNose(b, api, 0);
  else if (s === 4) weave(b, api, 0);
  else if (s === 5) tellArm(b, api, 0);
  else if (s === 7) triple(b, api, 0);
  else if (s === 8) tellArm(b, api, 1);
  else if (s === 10) triple(b, api, 1);
  else if (s === 12) girder(b, api, n * 2 + 1);
  else if (s === 14) tellNose(b, api, 1);
  else if (s === 16) weave(b, api, 1);
  else if (s === 17) tellArm(b, api, 1);
  else if (s === 19) triple(b, api, 1);
  else if (s === 20) tellArm(b, api, 0);
  else if (s === 22) triple(b, api, 0);
};
// THE RUSH JOB, 3 bars: a wall from its blueprint, a fan from the open core, a triple from it
const P3 = (b, api, s, n) => {
  if (s === 0) rushWall(b, api, n);
  else if (s === 1) { b.coreTel = 0; api.game.sfx('fire', { rate: 0.5, vol: 0.5 }); }
  else if (s === 3) coreFan(b, api);
  else if (s === 6) { b.coreTel = 0; }
  else if (s === 8) coreTriple(b, api);
};
const enterPhase = (b) => { b.sch = { origin: null, last: null }; for (const A of b.arms) A.tel = -1; for (const N of b.noses) N.tel = -1; b.coreTel = -1; };

// a keystone knocked out drops its panel: the core is open on that side until the panel is rebuilt
function dropPanel(b, api, i) {
  const p = b.panels[i]; if (p.down) return;
  p.down = true; p.downT = 0; p.fall = 0.0001;
  api.game.sfx('boom', { vol: 0.6, rate: 1.4 });
  const w = b.weak[8]; api.game.burst(w.ent.x, w.ent.y, w.ent.z, 30, { speed: 14, life: 0.5, s0: 1.4, r: 0.85, g: 0.78, b: 1, carry: 0, drag: 2 });
}
function rebuild(b, api, i) {
  const p = b.panels[i]; p.down = false; p.fall = 0; p.solid.visible = true; p.plan.visible = false; p.g.position.copy(p.home); p.g.scale.setScalar(1);
  b.restore(b.weak[i], 1);
  api.game.sfx('g3-ratchet', { vol: 0.8 });
}

export default defineBoss({
  name: 'g3-foreman', title: 'THE FOREMAN',
  hold: HOLD, enterTime: ENTER_T, scale: SCALE, y: -1,
  bonus: 70000, hitPts: 1800, pointDown: 'KEYSTONE DOWN!', downCall: 'THE FOREMAN FALLS!', defeatTime: 3.0,
  build,
  // rule 25: keystones are lit while the cage is shut; the core while a side is open (and always in the rush job)
  exposed(b, w) {
    if (w.tag === 'core') return b.rush || anyDown(b);
    return !b.rush && !anyDown(b) && !b.panels[w.tag].down;
  },
  enter(b, api) {
    b.sch = { origin: null, last: null }; b.rush = false; b.coreTel = -1; b.sparkT = 0;
    api.game.sfx('boss-warning', { vol: 0.9 });
  },
  phases: [
    { name: 'THE FRAME', until: 0.66, loop: 4, pattern: [], enter(b) { enterPhase(b); }, update(b, dt, api) { sched(b, api, P1, 16); } },
    { name: 'THE CRANE', until: 0.33, loop: 4, pattern: [], enter(b, api) { enterPhase(b); api.game.sfx('boss-phase', { vol: 0.8 }); }, update(b, dt, api) { sched(b, api, P2, 24); } },
    { name: 'THE RUSH JOB', loop: 4, pattern: [],
      enter(b, api) {
        enterPhase(b); api.game.sfx('boss-phase', { vol: 0.8 }); b.rush = true;
        // it gives up the cage: every panel falls, every keystone goes dark, the core stays open
        b.panels.forEach((p, i) => { if (!p.down) { p.down = true; p.downT = 0; p.fall = 0.0001; } b.weak[i].hp = 0; });
      },
      update(b, dt, api) { sched(b, api, P3, 12); } },
  ],
  // a keystone down: its panel drops, and the rest of the volley that broke it carries on into the core it just opened
  // (two steps at a time: one good roll on a triple is a keystone and two hits)
  onWeakDown(b, w, api) {
    if (w.tag === 'core') return;
    dropPanel(b, api, w.tag);
    const core = b.weak[8].ent;
    for (const s of api.course.shots) if (s.reflected && s.alive && s.target === w.ent) s.target = core;
  },
  update(b, dt, api) {
    b.gameBeat = (b.gameBeat || 0) + dt / beatSec(api); // world time in beats (beatNow, under the dev SPEED)
    const fight = b.state === 'fight', phase = b.pi || 0;
    // the rush job: it backs off down the lane so the walls it builds have room to come at you
    if (fight && b.rush) b.z = damp(b.z, -HOLD_RUSH, 1.2, dt);
    // the race: a dropped panel's blueprint shows two seconds before it is rebuilt
    b.panels.forEach((p, i) => {
      if (p.fall > 0 && p.fall < 1) { p.fall = Math.min(1, p.fall + dt / 0.6); const k = smoothstep(0, 1, p.fall);
        tmpV.copy(p.home).multiplyScalar(1 + 0.6 * k); p.g.position.set(tmpV.x, tmpV.y - 6 * k * k, tmpV.z - 2 * k); p.g.scale.setScalar(1 - 0.5 * k); if (p.fall >= 1) { p.solid.visible = false; p.g.position.copy(p.home); p.g.scale.setScalar(1); } }
      if (p.down && fight && !b.rush) {
        p.downT += dt; const R = REBUILD[Math.min(1, phase)];
        p.plan.visible = p.downT > R - PLAN_T && Math.floor(p.downT * 12) % 6 !== 0; // the plan draws, flickering like a pen
        if (p.downT >= R) rebuild(b, api, i);
      } else if (!p.down) p.plan.visible = false;
    });
    // the core: lit while it can be hit
    const open = b.rush || anyDown(b);
    b.coreLit.visible = open; b.coreDark.visible = !open;
    // tells, swings and folds
    const bs = beatSec(api);
    for (const A of b.arms) {
      if (A.tel >= 0) { A.tel += dt; const q = Math.min(1, A.tel / (2 * bs)); A.mat.color.copy(RED).lerp(HOT, smoothstep(0.3, 1, q)); A.charge.material.opacity = q * (0.7 + 0.3 * Math.sin(A.tel * 40)); A.charge.scale.setScalar(2.2 + 3 * q); }
      else { A.mat.color.copy(RED); A.charge.material.opacity = Math.max(0, A.charge.material.opacity - dt * 4); }
      if (A.swingT >= 0) { A.swingT += dt; A.swing = Math.sin(clamp(A.swingT / 1.6, 0, 1) * Math.PI); if (A.swingT > 1.6) A.swingT = -1; }
      A.pivot.rotation.z = A.s * (0.35 + A.swing * 0.9 + A.fold * 1.3);
    }
    for (const N of b.noses) {
      if (N.tel >= 0) { N.tel += dt; const q = Math.min(1, N.tel / (2 * bs)); N.charge.material.opacity = q * (0.7 + 0.3 * Math.sin(N.tel * 40)); N.charge.scale.setScalar(1.8 + 2.6 * q); }
      else N.charge.material.opacity = Math.max(0, N.charge.material.opacity - dt * 4);
    }
    if (b.coreTel >= 0) { b.coreTel += dt; const q = Math.min(1, b.coreTel / (2 * bs)); b.coreCharge.material.opacity = q; b.coreCharge.scale.setScalar(3 + 4 * q); }
    else b.coreCharge.material.opacity = Math.max(0, b.coreCharge.material.opacity - dt * 4);
    // defeat: the cage collapses in on the core, the arms fold, sparks everywhere
    if (b.state === 'dying') {
      const k = smoothstep(0, 1, b.t / 2.4);
      b.cage.scale.setScalar(1 - 0.75 * k); b.cage.rotation.z += dt * 2.5 * k;
      for (const A of b.arms) A.fold = k;
      b.sparkT += dt;
      while (b.sparkT > 0.02) { b.sparkT -= 0.02; const a = Math.random() * TAU, r = 9 * SCALE * (1 - 0.6 * k);
        api.game.emit(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, b.z + 2, { life: 0.6, s0: 0.9, s1: 0.1, r: 1, g: 0.29, b: 0.85, a: 1, vx: (Math.random() - 0.5) * 24, vy: Math.random() * 18 - 4, vz: 10, carry: 0 }); }
    }
  },
});
