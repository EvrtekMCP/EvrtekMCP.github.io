// THE WARDEN (level 3 mini-boss): Yori's rotating gate-fortress (art-incoming/yori/levels/bosses.js, sheet
// boss-03). An octagonal gate with four spokes to a hub and a core pod at each spoke's foot. It holds station ahead
// and fights on the beat of its own track (bosses/warden, 140 bpm, same key as the level): every attack starts on a
// bar line and fires on a beat, so its rhythm is learnable in two or three goes (rule 28).
//
// The only damage is your own deflect (rule 26). A core can be hit only while its petals are open (rule 25): it
// blooms for two beats (the tell), fires a fan of three bolts, and stays open while they come back.
//   PHASE 1  THE VOLLEY  one core at a time, every two bars, until two are dead
//   PHASE 2  THE SWEEP   red light runs up the spokes and it hurls a WARD down the lane: one of the level's turning
//                        gates (ride the gap); then a volley. Until three are dead
//   PHASE 3  THE LOCK    the hub lock fires a ring of eight bolts round you and one straight at you: hold still and
//                        roll, and all nine go home into the last core (MULTI-DEFLECT x9). The shortest phase.
//   THE CRACK            the lock goes white, the spokes go dark, and you fly through the gate
import { THREE, defineBoss, buildModel, material, clamp, SPAWN_D } from '../../api.js?v=0.6.3';
import { MESH } from './mesh.js?v=0.6.3';
import { beatClock } from '../../levels/level3/beat.js?v=0.6.3';

const TAU = Math.PI * 2;
const CORE_R = 11, HP = 5, SCALE = 2.0;
// her cores sit at angle i * 90 deg in her frame; the model is turned to face us (rotation.y = PI), so x flips
const CORE_AT = [0, 1, 2, 3].map((i) => { const a = i / 4 * TAU; return [-Math.cos(a) * CORE_R, Math.sin(a) * CORE_R]; });
const ORDER = [1, 2, 3, 0];                    // the top core fires first, then round anticlockwise
const HOLD = 110, ENTER_T = 4 * 240 / 140;      // it flies in over the four bars of its track's Impact

function coreModel(own) {
  // one pod whose petals open by morphing her closed pod into her open one (same faces, same order)
  const g = new THREE.Group(), mats = {};
  MESH.core.forEach((grp, i) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(grp.p, 3));
    geo.morphAttributes.position = [new THREE.Float32BufferAttribute(MESH.coreOpen[i].p, 3)];
    geo.computeVertexNormals(); geo.computeBoundingSphere();
    const key = grp.color + (grp.glow ? '*' : '');
    const m = new THREE.Mesh(geo, material(grp.color, grp.glow, own && grp.glow));
    mats[key] = m.material; g.add(m);
  });
  return { g, mats, set(open) { for (const m of g.children) m.morphTargetInfluences[0] = open; } };
}

let lockGeo, runnerTex;
function build(api, b) {
  const root = new THREE.Group(), flip = new THREE.Group(); flip.rotation.y = Math.PI; root.add(flip);
  const ring = buildModel(MESH.ring), spokes = buildModel(MESH.spokes, { own: ['#ff3355*'] }), hub = buildModel(MESH.hub, { own: ['#ff3355*'] });
  flip.add(ring.group, spokes.group, hub.group);
  b.spokeMat = spokes.mats['#ff3355*']; b.lockMat = hub.mats['#ff3355*']; b.hubGroup = hub.group; b.spokeGroup = spokes.group;
  b.cores = [];
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU, c = coreModel(true);
    c.g.position.set(Math.cos(a) * CORE_R, Math.sin(a) * CORE_R, -0.3);
    flip.add(c.g);
    const charge = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    charge.position.set(CORE_AT[i][0], CORE_AT[i][1], 1.6); root.add(charge);
    b.cores.push({ m: c, open: 0, openT: 0, charge, tel: -1, dead: false });
  }
  // the hub lock's tell: a red-white ring that grows out of the hub
  if (!lockGeo) lockGeo = new THREE.RingGeometry(0.85, 1, 48);
  b.lockRing = new THREE.Mesh(lockGeo, new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  b.lockRing.position.z = 2.2; root.add(b.lockRing);
  // the spoke runners: a light that runs hub to rim along each spoke (the sweep's tell)
  b.runners = [0, 1, 2, 3].map((i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff5a2a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); s.scale.setScalar(3.5); s.userData.a = Math.atan2(CORE_AT[i][1], CORE_AT[i][0]); root.add(s); return s; });
  b.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  b.flash.position.z = 2.5; b.flash.scale.setScalar(4); root.add(b.flash);
  return {
    root,
    weak: CORE_AT.map(([x, y]) => ({ at: [x, y, 1.2], r: 2.3, hp: HP })),
    muzzles: CORE_AT.map(([x, y]) => [x, y, 2.0]).concat([[0, 0, 2.6]]),
  };
}

// ---- the beat scheduler: each phase is a cycle of beats, started on a bar line of the Warden's track
function sched(b, api, onBeat, cycle) {
  const c = beatClock(api), bi = Math.floor(c.beat + 1e-6);
  if (b.sch.origin === null) b.sch.origin = (Math.floor(bi / 4) + 1) * 4;   // the next bar line
  if (bi === b.sch.last) return;
  b.sch.last = bi;
  const k = bi - b.sch.origin; if (k < 0) return;
  onBeat(b, api, k % cycle, Math.floor(k / cycle));
}
const live = (b) => ORDER.filter((i) => !b.cores[i].dead);
const target = (b) => live(b)[0];                  // the same core until it dies (rule 25: one lit point at a time)
const beat = (api) => beatClock(api).beatSec;
const tmpV = new THREE.Vector3();
function world(b, local) { const v = tmpV.set(local[0], local[1], local[2]); b.root.localToWorld(v); return { x: v.x, y: v.y, z: v.z }; }
function aim(api, lead = 0.15) { const s = api.ship; return [clamp(s.x + s.vx * lead, -api.box.x, api.box.x), clamp(s.y + s.vy * lead, -api.box.y, api.box.y)]; }

function bloom(b, api, i) { if (i === undefined) return; const c = b.cores[i]; c.openT = 1; c.tel = 0; b.firing = i; api.game.sfx('fire', { rate: 0.6, vol: 0.5 }); }
function fan(b, api, i) {
  if (i === undefined || b.cores[i].dead) return;
  const from = world(b, [CORE_AT[i][0], CORE_AT[i][1], 2.0]), [tx, ty] = aim(api), T = 3 * beat(api);
  for (const dx of [-1.5, 0, 1.5]) api.fire(from, clamp(tx + dx, -api.box.x, api.box.x), ty, { T, owner: b });
  b.cores[i].tel = -1; b.cores[i].charge.material.opacity = 0;
}
function closeAll(b) { for (const c of b.cores) { c.openT = 0; c.tel = -1; } }
function ward(b, api, n) {
  // a turning gate thrown from the hub: four beats to reach you, one field pair turning a quarter a beat
  const shapes = [{ closed: [0, 1] }, { closed: [1, 3] }, { closed: [2, 3] }, { closed: [0, 2] }];
  const s = shapes[n % shapes.length];
  api.spawn({ type: 'l3-gate', n: 4, rot: 0.5, closed: s.closed, mode: 'turn', step: 0.25, dir: n % 2 ? -1 : 1, ward: 4 * beat(api), dmg: 18 }, b.z + 3);
}
function pulseRing(b, api) {
  const from = world(b, [0, 0, 2.6]), [tx, ty] = aim(api, 0), T = 3 * beat(api);
  api.fire(from, tx, ty, { T, owner: b });
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; api.fire(from, tx + Math.cos(a) * 1.9, ty + Math.sin(a) * 1.9, { T, owner: b }); }
}

const P1 = (b, api, s) => { if (s === 0) bloom(b, api, target(b)); else if (s === 2) fan(b, api, b.firing); else if (s === 7) closeAll(b); };
const P2 = (b, api, s, n) => {
  if (s === 0) { b.runT = 0; b.spinUp = 1; api.game.sfx('fire', { rate: 0.45, vol: 0.6 }); }
  else if (s === 3) { ward(b, api, n); b.spinUp = 0; }
  else if (s === 8) bloom(b, api, target(b));
  else if (s === 10) fan(b, api, b.firing);
  else if (s === 15) closeAll(b);
};
const P3 = (b, api, s) => {
  if (s === 0) { b.lockT = 0; bloom(b, api, target(b)); }
  else if (s === 2) { pulseRing(b, api); b.cores[b.firing].tel = -1; }
  else if (s === 7) closeAll(b);
  else if (s === 8) bloom(b, api, target(b));
  else if (s === 10) fan(b, api, b.firing);
  else if (s === 15) closeAll(b);
};
const enterPhase = (b) => { b.sch = { origin: null, last: null }; closeAll(b); b.lockT = -1; b.runT = -1; };

export default defineBoss({
  name: 'warden', title: 'THE WARDEN',
  hold: HOLD, enterTime: ENTER_T, scale: SCALE, y: 0.6,
  bonus: 60000, hitPts: 2500, pointDown: 'CORE DOWN!', downCall: 'THE WARDEN FALLS!', defeatTime: 2.8,
  build,
  exposed(b, w) { return b.cores[w.i].open > 0.6; },
  enter(b, api) {
    b.spin = 0; b.spinT = 0; b.spinV = 0; b.spinUp = 0; b.sch = { origin: null, last: null }; b.firing = undefined; b.lockT = -1; b.runT = -1; b.crack = -1;
    api.game.sfx('boss-warning', { vol: 0.9 });
  },
  phases: [
    { name: 'THE VOLLEY', until: 0.5, loop: 4, pattern: [], enter(b) { enterPhase(b); }, update(b, dt, api) { sched(b, api, P1, 8); } },
    { name: 'THE SWEEP', until: 0.25, loop: 4, pattern: [], enter(b, api) { enterPhase(b); api.game.sfx('boss-phase', { vol: 0.8 }); }, update(b, dt, api) { sched(b, api, P2, 16); } },
    { name: 'THE LOCK', loop: 4, pattern: [], enter(b, api) { enterPhase(b); api.game.sfx('boss-phase', { vol: 0.8 }); }, update(b, dt, api) { sched(b, api, P3, 16); } },
  ],
  update(b, dt, api) {
    // the fly-in eases in as well as out, so its first frames out of the haze are as slow as its last
    if (b.state === 'enter') { const k = Math.min(1, b.t / ENTER_T); b.z = -SPAWN_D + (SPAWN_D - HOLD) * k * k * (3 - 2 * k); }
    const c = beatClock(api), f = c.beat - Math.floor(c.beat), onBar = Math.floor(c.beat) % 4 === 0;
    // the turn: a ratchet of a sixteenth on each downbeat; the sweep's tell spins it up
    if (b.state === 'fight' || b.state === 'enter') {
      const bar = Math.floor(c.beat / 4);
      if (bar !== b.lastBar) { b.lastBar = bar; b.spinT += TAU / 16; }
      if (b.spinUp) b.spinT += dt * 2.6;
    }
    if (b.state === 'dying') b.spinT += dt * 0.4;
    b.spin += (b.spinT - b.spin) * (1 - Math.exp(-dt * 9));
    b.root.rotation.z = b.spin;
    // cores: petals, the bloom, the dead
    for (let i = 0; i < 4; i++) {
      const k = b.cores[i];
      k.open += ((k.dead ? 0 : k.openT) - k.open) * (1 - Math.exp(-dt * 10));
      k.m.set(k.open);
      if (k.tel >= 0 && !k.dead) {
        k.tel += dt; const q = Math.min(1, k.tel / (2 * c.beatSec));
        k.charge.material.opacity = q * (0.7 + 0.3 * Math.sin(k.tel * 40)); k.charge.scale.setScalar(2 + q * 5);
        k.charge.material.color.setRGB(1, 0.2 + 0.7 * q, 0.33 + 0.6 * q);
      } else k.charge.material.opacity = Math.max(0, k.charge.material.opacity - dt * 4);
    }
    // the spoke runners (phase 2's tell): hub to rim in three beats
    const rimR = 13;
    if (b.runT >= 0) {
      b.runT += dt; const q = (b.runT / (3 * c.beatSec)) % 1;
      for (const r of b.runners) { r.position.set(Math.cos(r.userData.a) * q * rimR, Math.sin(r.userData.a) * q * rimR, 1.8); r.material.opacity = b.runT < 3 * c.beatSec ? 0.9 : 0; }
      b.spokeMat.color.setRGB(1, 0.2 + 0.5 * (1 - q), 0.33);
      if (b.runT > 3 * c.beatSec) b.runT = -1;
    } else { for (const r of b.runners) r.material.opacity = 0; if (b.crack < 0) b.spokeMat.color.setHex(0xff3355); }
    // the lock's tell (phase 3): a ring growing out of the hub over two beats, red going white-hot
    if (b.lockT >= 0 && b.crack < 0) {
      b.lockT += dt; const q = Math.min(1, b.lockT / (2 * c.beatSec));
      b.lockRing.scale.setScalar(1.5 + 9 * q); b.lockRing.material.opacity = b.lockT < 2.4 * c.beatSec ? 0.9 * (1 - 0.3 * q) : 0;
      b.lockRing.material.color.setRGB(1, 0.2 + 0.75 * q, 0.33 + 0.6 * q);
      b.lockMat.color.setRGB(1, 0.2 + 0.8 * q, 0.33 + 0.67 * q);
      if (b.lockT > 2.4 * c.beatSec) b.lockT = -1;
    } else if (b.crack < 0) { b.lockRing.material.opacity = 0; b.lockMat.color.setHex(0xff3355); }
    // every downbeat the seam breathes (it keeps time with you)
    if (b.crack < 0) b.flash.material.opacity = onBar ? Math.max(0, 0.5 - f) * 0.6 : 0;
    // THE CRACK: it stops holding station and comes at you; you go through the gate
    if (b.state === 'dying') {
      b.crack += dt;
      b.z += api.v * 0.9 * dt;
      b.flash.material.opacity = Math.max(0, 1 - b.crack * 0.8); b.flash.scale.setScalar(4 + b.crack * 30);
      if (b.z > -2 && !b.through) { b.through = true; api.game.flash(); api.game.call('THROUGH THE GATE!', 'c-cyan'); }
    }
  },
  onWeakDown(b, w, api) {
    const k = b.cores[w.i]; k.dead = true; k.openT = 0; k.tel = -1;
    k.m.mats['#ff3355*'].color.setHex(0x2a2730);           // a dead core goes dark (her sheet)
    api.game.sfx('boss-hit', { vol: 1 });
  },
  defeat(b, api) {
    b.crack = 0; closeAll(b);
    b.lockMat.color.setHex(0xffffff); b.spokeMat.color.setHex(0x202028);
    b.spokeGroup.visible = false; b.hubGroup.visible = false; b.lockRing.material.opacity = 0;
    api.game.burst(b.x, b.y, b.z + 2, 120, { speed: 26, life: 0.9, s0: 2.6, r: 1, g: 1, b: 1, carry: 0, drag: 1.2 });
    api.game.sfx('boss-defeat', { vol: 1 });
  },
});
