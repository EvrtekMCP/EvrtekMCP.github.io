// THE COUNTERFEIT (galaxy 3, level 6's boss): the Unmade's full copy of the Wake, Yori's boss-g3-06. Graphite and red
// where yours is slate and cyan, an empty cradle, four crack seams, a white roll ring above it. No guns, just like you.
// THE FIGHT IS A DUEL WITH YOUR OWN RULES (the plan, 4.6):
//   - it races you for the rings: it flies ahead of you, takes the ring line on its side, and every six rings it
//     takes mend a crack. It takes none while it is busy (rolling, its ring refilling, or knocked off its line by a
//     hit), so baiting it as its line comes denies it the mend;
//   - it ROLLS BACK anything you send it: a white flash and the bolt comes back at you. Its roll ring (white, above it)
//     shows its cooldown: full is guarded, filling is open;
//   - its weak point is its hull CRACKS, lit orange-white only while the roll ring refills (rule 25);
//   - so you bait it: send a shot, it rolls it back, and roll that one home again while its ring refills;
//   - the fire comes from two NEUTRAL TURRETS beside the lane, keyed to it (the level's lesson): their bolts are its own
//     to the framework, so sent home they go to the Counterfeit;
//   - the Twins guarded on a fixed schedule; the Counterfeit's guard is a roll that YOU trigger.
// Phases (rule 24; each loop is whole bars of its track, g3/bosses/counterfeit, 146.09 bpm, so rule 28 holds):
//   1 THE RACE          a turret bolt every two bars; ring lines with it taking the far side; cooldown 1.6 s: one
//                       rally wins (its return takes 1.0 s, yours 0.2 s)
//   2 THE MIRROR        it flies your mirror image (you go left, it goes right), splitting the ring lines so you can't
//                       take both; cooldown 1.3 s: the rally still wins, just
//   3 THE PHOTO FINISH  the shortest: a boost-chain race down a straight; cooldown 1.1 s, so one bolt never lands: a
//                       turret PAIR fires two at once, and a MULTI-DEFLECT beats it (the first it rolls back, the second
//                       lands while its ring refills)
// Defeat: its paint burns off, leaving a hollow white frame (the plan it was copied from) that peels away and breaks up.
// (0.6.0, Evrtek 11-10: no level has a timer. It no longer leaves on a clock; the fight ends when it is beaten.)
// 0.6.1 (Evrtek 11-11: make its finishing move easier; no timer, no auto-win). The newcomer bot survived 0.6.0's fight
// but never won it: it landed a double roll every minute or so, and the mends took each one back within the next two ring
// lines (four minutes: 4 and 5 hits landed, 3 and 5 mended). Two changes, both on what you can see:
//   - THE OPENING: once every eight bars in the Race and the Mirror, as both turrets charge, its roll ring BURNS OUT: the ring
//     empties and refills orange over two bars, its cracks light, OPEN! flashes over it. The turrets fire a pair, and ONE
//     roll sends both home (the multi-deflect the Photo Finish teaches): two hits, a crack split. The double roll still
//     works the rest of the time, as before;
//   - A SPLIT CRACK STAYS SPLIT: its ring rush mends a cracked seam, never one you have split open.
// The Photo Finish is unchanged: its pair was already a one-roll finish.
import { THREE, defineBoss, buildModel, clamp, SPAWN_D } from '../../api.js?v=0.6.3';
import { buildParts } from '../../enemies/crystal-emitter/parts.js?v=0.6.3';
import { MESH } from './mesh.js?v=0.6.3';
import { raceRing, take } from './rings.js?v=0.6.3';

export { raceRing };
export const BPM = 146.092, BAR = 240 / BPM;
const SCALE = 3.0, HOLD = 42, BACK_T = 1.0, ROLL_T = 0.42, TURRET_T = 1.35, TEL = 0.95;
const WEAK = [[0, 0.3, -0.7], [0.4, -0.05, 0.5], [-0.3, 0.05, 0.65]]; // Yori's COUNTERFEIT.weak: the cracks
const COOL = [1.6, 1.3, 1.1];
const OPEN_T = 2 * BAR; // 0.6.1: the opening, from the pair's charge to well after one roll sends it home
const tmpV = new THREE.Vector3();

// the shared pod model (galaxy 1's lantern pod, Yori's), as the neutral turrets' body
function buildPodModel() { const m = buildModel('pod', { own: ['#ff3355*'] }); return { group: m.group, core: m.mats['#ff3355*'] }; }
// the two neutral turrets, in the WORLD frame beside the lane (children of the boss root, counter-moved every frame so
// they hold their place while the Counterfeit slides about; they grow in and out with it)
function turretSpot(api, i) { return [(i ? 1 : -1) * api.box.x * 1.45, api.box.y * 0.35, -32]; }

// the Race's and the Mirror's eight bars (0.6.1; 0.6.0's loop was the second half alone, twice): the OPENING (its ring burns
// out as both turrets charge, then their pair), a bait bolt, a bait bolt, a bait bolt; a pair of ring lines each four bars
const duel = (mode) => [
  { at: BAR - TEL, tel: 0, attack: (b, api) => burnOut(b, api) },
  { at: BAR, attack: (b, api) => pair(b, api), tel: TEL, turret: 'both' },
  ...[3, 5, 7].map((n) => ({ at: n * BAR, attack: (b, api) => bolt(b, api, b.cf.side ^= 1), tel: TEL, turret: 'alt' })),
  ...[0, 4].map((n) => ({ at: n * BAR + 0.25, tel: 0, attack: (b, api) => lines2(b, api, mode) })),
];

export default defineBoss({
  name: 'g3-counterfeit', title: 'THE COUNTERFEIT',
  hold: HOLD, scale: SCALE, y: 0.4, enterTime: 2 * BAR,
  bonus: 70000, hitPts: 3000, defeatTime: 2.8, downCall: 'COUNTERFEIT DOWN!',
  build(api, b) {
    const root = new THREE.Group();
    const hull = new THREE.Group(); root.add(hull);
    const m = buildParts(MESH.hull.concat(MESH.cracks), { own: ['cracks:#ff7a5a*'] }); hull.add(m.group);
    const cracks = m.mats['cracks:#ff7a5a*'];
    // ship-v3: its engines are the Wake's revision 4 pair, out on the blades; one red glow per nozzle, in a group so
    // the code below can still hide them together and flicker them together
    const engine = new THREE.Group(); root.add(engine);
    for (const x of [0.95, -0.95]) { const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff5a4a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.8 })); e.position.set(x, 0, 1.45); e.scale.setScalar(1.25); engine.add(e); }
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    flash.scale.setScalar(4); root.add(flash);
    // the neutral turrets: Yori's lantern pod each, a blueprint-white key ring round it (keyed to the Counterfeit)
    const turrets = [0, 1].map(() => {
      const g = new THREE.Group(), inner = new THREE.Group(); inner.rotation.y = Math.PI; g.add(inner);
      const pm = buildPodModel(); inner.add(pm.group);
      const key = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.07, 6, 40), new THREE.MeshBasicMaterial({ color: 0xe8eeff }));
      g.add(key);
      const charge = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
      charge.position.z = 1.2; g.add(charge);
      root.add(g);
      return { g, core: pm.core, key, charge };
    });
    // its roll ring, above it: 18 bars that fill white as the roll recharges (part of its body, so it leaves with it).
    // Yori: draw it as an arc that fills; full white = guarded, filling = open.
    const ringG = new THREE.Group(); ringG.position.set(0, 1.1, 0); root.add(ringG);
    const segs = [];
    for (let i = 0; i < 18; i++) {
      const a0 = Math.PI / 2 - (i + 0.5) / 18 * Math.PI * 2, seg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
      seg.position.set(Math.cos(a0) * 0.62, Math.sin(a0) * 0.62, 0); seg.rotation.z = a0 + Math.PI / 2; ringG.add(seg); segs.push(seg);
    }
    // its hollow frame, shown when its paint burns off
    const frame = new THREE.Group(); frame.visible = false; root.add(frame);
    const wire = new THREE.MeshBasicMaterial({ color: 0xe8eeff, wireframe: true, transparent: true, opacity: 1, depthWrite: false });
    m.group.traverse((o) => { if (o.isMesh) { const w = new THREE.Mesh(o.geometry, wire); frame.add(w); } });
    b.cf = { hull, cracks, engine, flash, turrets, ringG, segs, frame, wire, paint: m.group, cool: 0, coolMax: COOL[0], coolBase: COOL[0], burn: 0, rollT: -1, eaten: 0, side: 0, stagger: 0, lastHp: 1, tx: 0, ty: 0, lineX: 0, chainN: 0 };
    return { root, weak: WEAK.map((at) => ({ at, r: 0.7, hp: 2, color: 0xff7a5a, call: 'HULL SPLIT!' })), muzzles: [[0, 0, 0]] };
  },
  // the cracks are lit (hittable) only while its roll ring refills
  exposed: (b) => b.cf && b.cf.cool > 0,
  phases: [
    { name: 'THE RACE', until: 0.67, loop: 8 * BAR, enter: (b, api) => phaseIn(b, api, 0),
      pattern: duel('far') },
    { name: 'THE MIRROR', until: 0.34, loop: 8 * BAR, enter: (b, api) => phaseIn(b, api, 1),
      pattern: duel('mirror') },
    { name: 'THE PHOTO FINISH', loop: 2 * BAR, enter: (b, api) => phaseIn(b, api, 2),
      pattern: [{ at: BAR, attack: (b, api) => pair(b, api), tel: TEL, turret: 'both' }, { at: 0.25, tel: 0, attack: (b, api) => chain(b, api) }] },
  ],
  update(b, dt, api) {
    const c = b.cf; if (!c) return;
    for (const g of b.glows) g.visible = false; // it has no guns: the framework's muzzle glow is not drawn
    const box = api.box, ship = api.ship;
    // ---- where it flies: its ring line (the race), your mirror image (the mirror), the straight (the photo finish)
    if (b.state === 'fight' || b.state === 'enter') {
      let tx = c.lineX, ty = 0.15 * box.y;
      if (b.pi === 1) { tx = -ship.x; ty = ship.y * 0.6; }
      if (c.stagger > 0) { c.stagger -= dt; tx += Math.sin(c.stagger * 18) * 2.5; }
      const k = 1 - Math.exp(-dt * (b.pi === 1 ? 5 : 2.6));
      c.tx += (clamp(tx, -box.x * 0.9, box.x * 0.9) - c.tx) * k; c.ty += (clamp(ty, -box.y * 0.7, box.y * 0.7) - c.ty) * k;
      b.x = c.tx; b.y = c.ty + 0.4;
    }
    // ---- its roll: a barrel roll; then the ring refills
    if (c.rollT >= 0) { c.rollT += dt; c.hull.rotation.z = Math.min(1, c.rollT / ROLL_T) * Math.PI * 2 * (c.rollDir || 1); if (c.rollT >= ROLL_T) { c.rollT = -1; c.hull.rotation.z = 0; } }
    if (c.cool > 0) c.cool = Math.max(0, c.cool - dt);
    if (c.burn > 0) c.burn = Math.max(0, c.burn - dt);
    c.flash.material.opacity = Math.max(0, c.flash.material.opacity - dt * 3);
    // a bank as it slides (when not rolling)
    if (c.rollT < 0) c.hull.rotation.z = clamp(-(b.x - (c.px ?? b.x)) / Math.max(dt, 1e-3) * 0.04, -0.5, 0.5); c.px = b.x;
    // the cracks: lit orange-white while the ring refills (the window), dark while it is guarded
    const lit = c.cool > 0 && b.state === 'fight';
    c.cracks.color.setHex(lit ? (Math.floor(b.t * 10) % 2 ? 0xff7a5a : 0xffb090) : 0x3a2a2c);
    { const o = 0.6 + 0.3 * Math.sin(b.t * 24) + (c.boostT > 0 ? 0.4 : 0); for (const e of c.engine.children) e.material.opacity = o; } c.boostT = Math.max(0, (c.boostT || 0) - dt);
    // a hit landed (its health fell): it is knocked off its line for a moment
    const hp = b.hp(); if (hp < c.lastHp - 1e-6) c.stagger = 0.8; c.lastHp = hp;
    // ---- it takes the race rings that reach its plane near it (never while rolling or knocked off its line)
    if (b.state === 'fight') for (const q of api.course.list) {
      if (q.type !== 'g3-cf-ring' || !q.alive || q.anim || q.cfSeen) continue;
      if (q.z < b.z - 1) continue;
      q.cfSeen = true;
      if (c.rollT >= 0 || c.cool > 0 || c.stagger > 0) continue; // busy: rolling, its ring refilling, or knocked off its line
      if (Math.hypot(q.x - b.x, q.y - b.y) < 2.8) {
        take(q);
        if (q.ev.boost) { c.boostT = 0.6; continue; }
        if (++c.eaten % 6 === 0) mend(b, api);
      }
    }
    // ---- the turrets: held in place beside the lane, charging red before they fire
    const s = Math.max(1e-3, SCALE * (b.appear || 0));
    c.turrets.forEach((t, i) => {
      const [wx, wy, wz] = turretSpot(api, i), z = Math.max(wz, b.z + 14);
      t.g.position.set((wx - b.x) / s, (wy - b.y) / s, (z - b.z) / s); t.g.scale.setScalar(1.3 / SCALE);
      tmpV.set(ship.x, ship.y, 8); t.g.lookAt(tmpV);
      t.key.rotation.z += dt * 0.8;
      const k = b.state === 'fight' ? turretCharge(b, i) : 0;
      t.core.color.setRGB(1, 0.2 + 0.7 * k, 0.33 + 0.6 * k); t.charge.material.opacity = k * (0.6 + 0.4 * Math.sin(b.t * 40)); t.charge.scale.setScalar(1 + k * 4);
    });
    // ---- the roll ring above it: full white = guarded; filling = open (send it now)
    { const k = c.cool > 0 ? 1 - c.cool / c.coolMax : 1, lit = Math.round(k * 18), show = b.state === 'fight' || b.state === 'enter';
      c.ringG.visible = show; c.segs.forEach((g, i) => { const on = i < lit; g.material.color.setHex(on ? (c.burn > 0 ? 0xff9a70 : 0xffffff) : (c.burn > 0 ? 0x6a3a30 : 0x55555e)); g.material.opacity = on ? 1 : 0.5; }); }
    // ---- beaten: the paint burns off, the white frame peels away and breaks up
    if (b.state === 'dying') {
      const T = 2.8, k = Math.min(1, b.t / T);
      c.paint.visible = b.t < 0.5; c.frame.visible = true;
      c.wire.opacity = clamp(1.2 - k * 1.2, 0, 1);
      c.frame.children.forEach((w, i) => { w.position.set(Math.sin(i * 2.1) * k * 1.5, Math.cos(i * 1.7) * k * 1.2, Math.sin(i * 0.9) * k * 2); w.rotation.set(k * i * 0.4, k * i * 0.3, 0); });
      c.engine.visible = false; c.turrets.forEach((t) => { t.g.visible = false; });
    }
  },
  // an unlit hit (its roll is ready): it rolls your bolt straight back at you
  onClang(b, w, shot, api) { rollBack(b, api); return true; },
  defeat(b, api) { b.cf.cool = 0; api.game.sfx('boss-defeat', { vol: 0.9 }); },
});
function phaseIn(b, api, i) {
  const c = b.cf; c.coolMax = c.coolBase = COOL[i]; c.cool = 0; c.burn = 0;
  // every loop starts on a bar line of its track (rule 28): the pattern waits for the next bar
  const toBar = api.music && api.music.meta ? api.music.toNextBar() : 0;
  b.loopT = -clamp(toBar || 0, 0, BAR);
  if (i === 0) c.lineX = api.box.x * 0.5;
  if (i === 2) { c.lineX = -api.box.x * 0.45; api.game.call('BEAT IT TO THE LINE', 'c-cyan'); }
  if (i === 1) api.game.call('IT COPIES YOUR LINE', 'c-cyan');
}
// how charged turret i is (0..1): read from the phase's own pattern, as the framework telegraphs its steps
function turretCharge(b, i) {
  const ph = b.phase, loop = ph.loop; let k = 0;
  ph.pattern.forEach((st) => {
    if (!st.turret) return;
    const who = st.turret === 'both' ? -1 : (b.cf.side ^ 1);
    if (who !== -1 && who !== i) return;
    const t0 = ((st.at - st.tel) % loop + loop) % loop, into = ((b.loopT - t0) % loop + loop) % loop;
    if (into < st.tel) k = Math.max(k, into / st.tel);
  });
  return k;
}
const turretPos = (b, api, i) => { const [x, y, z] = turretSpot(api, i); return { x, y, z: Math.max(z, b.z + 14) }; };
const aimAt = (api, lead = 0) => [clamp(api.ship.x + api.ship.vx * lead, -api.box.x, api.box.x), clamp(api.ship.y + api.ship.vy * lead, -api.box.y, api.box.y)];
// one bolt from a turret at you; it is the Counterfeit's (owner), so a roll sends it there
// the bolts of this fight are bait, meant to be rolled: all the way in they turn gently onto your line (as the roll
// lesson's shot does), so a roll meets them and drifting does not slip them; a hard step aside still does. Being bait,
// they hit softer than a shot meant to hurt (7 and 8 against 16)
const TURN = 7; // m/s^2 of turn: it follows a ship that holds its line or rolls; a hard step aside still slips it
const homeIn = (s, dt, api) => { if (s.vz <= 0) return; const tr = -s.z / s.vz; if (tr < 0.04) return;
  // its own return is your bolt coming straight back: it keeps exactly to you (only a roll answers it)
  if (s.tag === 'back') { s.vx = (api.ship.x - s.x) / tr; s.vy = (api.ship.y - s.y) / tr; return; }
  const a = TURN * dt; s.vx += clamp((api.ship.x - s.x) / tr - s.vx, -a, a); s.vy += clamp((api.ship.y - s.y) / tr - s.vy, -a, a); };
function bolt(b, api, i) { const [tx, ty] = aimAt(api, 0); api.fire(turretPos(b, api, i), tx, ty, { T: TURRET_T, owner: b, steer: homeIn, dmg: 7 }); }
// 0.6.1 THE OPENING: its roll ring burns out (it empties and refills orange over OPEN_T) as both turrets charge; its cracks
// are lit all through it, so the pair they fire, sent home with one roll, lands. Shown by the ring, the flash, OPEN! over
// it, and the first time a call that says what to do.
function burnOut(b, api) {
  const c = b.cf; if (b.state !== 'fight') return;
  c.cool = c.coolMax = c.burn = OPEN_T; c.opens = (c.opens || 0) + 1;
  c.flash.material.color.setHex(0xff7a5a); c.flash.material.opacity = 1;
  api.game.pop('OPEN!', b.x, b.y + 3, b.z, 'cyan');
  api.game.sfx('g3-forgery-roll', { vol: 0.6, rate: 0.7 });
  if (c.opens === 1) api.game.call('ITS RING BURNT OUT: ROLL THE PAIR HOME', 'c-cyan');
}
// both turrets at once, onto the same point: one roll takes both (MULTI-DEFLECT)
function pair(b, api) { const [tx, ty] = aimAt(api, 0); for (const i of [0, 1]) api.fire(turretPos(b, api, i), tx, ty, { T: TURRET_T, owner: b, steer: homeIn, dmg: 7 }); }
// it rolls your bolt back: a white flash at its hull, then a red bolt at you; its ring empties and refills
function rollBack(b, api) {
  const c = b.cf; if (b.state !== 'fight') return;
  c.cool = c.coolMax = c.coolBase; c.burn = 0; c.rollT = 0; c.rollDir = Math.random() < 0.5 ? -1 : 1; c.flash.material.color.setHex(0xffffff); c.flash.material.opacity = 1; c.rolls = (c.rolls || 0) + 1;
  api.game.sfx('g3-forgery-roll', { vol: 0.8 });
  api.game.pop('ROLLED BACK', b.x, b.y + 3, b.z, 'red');
  const [tx, ty] = aimAt(api, 0);
  api.fire({ x: b.x, y: b.y, z: b.z + 3 }, tx, ty, { T: BACK_T, owner: b, steer: homeIn, dmg: 8, tag: 'back' });
}
// six rings it took mend one crack (the most broken one). 0.6.1: a crack you have split stays split; only a cracked seam mends
function mend(b, api) {
  let w = null; for (const q of b.weak) if (q.hp > 0 && q.hp < q.max && (!w || q.hp < w.hp)) w = q;
  if (!w) return;
  b.restore(w, w.hp + 1); b.cf.mends = (b.cf.mends || 0) + 1;
  api.game.pop('MENDED', b.x, b.y + 3.4, b.z, 'red');
  api.game.sfx('g3-ratchet', { vol: 0.5 });
}
// two ring lines (its side and yours), laid at the spawn line so they come out of the haze (ruling 5)
function lines2(b, api, mode) {
  const box = api.box, c = b.cf;
  const side = mode === 'mirror' ? (Math.random() < 0.5 ? 1 : -1) : (api.ship.x >= 0 ? -1 : 1); // the far side from you
  const xs = [side * box.x * 0.55, -side * box.x * 0.55];
  if (mode !== 'mirror') c.lineX = xs[0];
  xs.forEach((x, j) => { for (let i = 0; i < 3; i++) api.spawn({ type: 'g3-cf-ring', x, y: box.y * (0.1 - 0.15 * j + 0.1 * i * (j ? 1 : -1)) }, -SPAWN_D - i * 22); });
}
// the photo finish: a boost chain down the straight for each of you
function chain(b, api) {
  const box = api.box, c = b.cf; c.chainN++;
  for (const [x, who] of [[box.x * 0.35, 'you'], [-box.x * 0.45, 'it']]) {
    const id = 'cf' + c.chainN + who;
    for (let i = 0; i < 4; i++) api.spawn({ type: 'g3-cf-ring', x, y: box.y * 0.05, boost: true, chain: id, idx: i, of: 4 }, -SPAWN_D - i * 26);
  }
}
