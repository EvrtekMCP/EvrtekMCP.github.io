// THE WEFTWORK (galaxy 3, level 10, act 3; the plan's 4.10): the heart of the loom, and the last fight of the game. Yori's
// loom (art-incoming/yori/g3/g3-bosses.js weftwork, 40 x 28, drawn here at 2.4x): two graphite posts and steel beams,
// the warp running toward you above and below the lane, a giant SHUTTLE on a rail that runs the weft, the BEATER (a
// comb of ten red reeds on a steel bar) and THE SHEAR (two white-hot blades at its sides).
//
// CALL AND RESPONSE, the fight's one new idea. Every loop is four bars of its track (the Call and Beat sections loop):
//   bar 1  THE CALL      the loom draws its pattern in white: the shuttle's path along its rail, a mark at every note,
//                        each mark flashing (and chiming) on its beat, and the reed it will key lit white
//   bar 2  THE RESPONSE  the shuttle runs that path for real and fires a red bolt on every note, at you
//   bar 3               each bolt takes exactly one bar, so they reach you in the SAME rhythm the call showed: roll on
//                        the notes. Each note keys its reed: that reed's ROOTS light (rule 25), and a bolt you roll home
//                        flies to a lit root
//   bar 4               the beater beats up; a struck reed spills thread-light (shield)
// Each phase's pattern is fixed, so by the third time round you know it by heart (rule 28).
//   PHASE 1 THE CALL   two notes: learn it (to 70%)
//   PHASE 2 THE BEAT   the beater SLAMS: a comb of reeds driven at you, one gap in it, its plan shown a bar first;
//                      three notes between the slams (a pair one roll takes, then one)
//   PHASE 3 THE SHEAR  the shortest: one slam, three notes, and between the last volleys the SHEAR closes across the
//                      lane, its gap planned 1.5 s first; it is the one thing in the galaxy you cannot roll back
// The clock is the music's: every loop starts on the track's Call bar line when the music is playing (and on its own
// clock, from the same grid, when it is not), so the notes land on the beat.
// Rule 26: it tears itself apart after 150 s unbeaten (no bonus); every hit buys 3 s, so only a ship that has stopped
// hurting it is timed out. Ten reeds, two hits each (20). (g3-roll tried three: the fight ran 133 s, too long.)
// CHORDS (g3-roll, 11-07: roll demand rises to the end of the game, and this is the end). One note in each loop is a
// CHORD: its bolt flies its bar like any note, and ONE BEAT before it lands it opens into a weft round you, a hex of
// bolts NET_S apart (one ring, seven bolts: the MCP's limit for a finale boss's own net, 11-07), all landing together.
// No gap in it fits a ship and it is too wide to steer out of in a beat; a roll on the note sends every bolt home. The
// call draws a chord's mark with its ring of points, so you see its size two bars before it lands, and the bolt is in
// view for the whole bar between. The note's own bolt keys its reed as ever (one hit); the weft's other bolts fly home
// into that same reed and spark on it without cutting, so a chord is one hit on the loom, never seven. They are the
// loom's own bolts (the boss owns them: born inside 150 m, they come from a shooter on screen, the popin rule); sent
// home, the boss's update turns each one from the lit weak point to the reed's spark point before it can get there.
import { THREE, defineBoss, buildModel, clamp, smoothstep, NET_S } from '../../api.js?v=0.5.0';
import { MESH } from './mesh.js?v=0.5.0';
import { MESH as SHUTTLE } from './shuttle-mesh.js?v=0.5.0';
import { pick, REED_X, comb, shear, light } from './kinds.js?v=0.5.0';
import { GRID, barT, beatOf } from '../../levels/g3/level10/grid.js?v=0.5.0';

export const kinds = [comb, shear, light];
const S = 2.4, NR = REED_X.length;                       // her units x 2.4; ten reeds
const DEAD = 0x2a2730, WHITE = 0xe8eeff;
const tmpV = new THREE.Vector3();
// her parts (her coordinates: front at -Z; the boss turns them to face you)
const BEATER = pick(MESH.beater, (c, g) => !g.glow);                                       // the steel bars of the beater
const RAIL = pick(MESH.rail, (c, g) => g.color === '#4a505e' && Math.abs(c[1]) < 0.5 && Math.abs(c[2] - 11) < 0.6);
const reedPart = (j, root) => pick(MESH.beater, (c, g) => g.glow && g.color === '#ff3355' && Math.abs(c[0] - REED_X[j]) < 0.9 && (root ? Math.abs(c[1]) >= 8.3 : Math.abs(c[1]) < 8.3));
const SHEAR_L = pick(MESH.shear, (c) => c[0] < 0), SHEAR_R = pick(MESH.shear, (c) => c[0] > 0);
// the reeds in the order you see them, left to right: her x is mirrored when she turns to face you, so world reed i is
// her reed NR - 1 - i, and it stands at REED_X[i] across (her comb is symmetric)
const herOf = (i) => NR - 1 - i;

// ---- THE PATTERNS. Beats in a 16-beat loop (4 bars). A note: { b: its beat in the response bar (0-3.5), r: the reed
// it keys, 0..9 left to right }. A slam: the comb leaves the loom on beat `at` and reaches you a bar later; its gap at
// gnx. A shear: it closes on beat `at`, its plan 1.5 s first; gaps in turn.
// Notes are three beats apart or a pair half a beat apart (one roll takes a pair), never closer: the roll's recharge.
// chord: 1 or 2 (g3-roll): the note opens into a weft of that many rings a beat before it lands (CHORDS, above).
// (g3-roll, 11-07, the MCP's approval) A THIRD NOTE each loop, the phrase's tail: called in the response bar (its mark
// flashes there; the call's drawing stays up), fired in the landing bar, it lands in the loop's fourth bar, 2.5 to 3.5
// beats after the chord: three roll moments a loop (about 29 a minute, the plan's cap), never three in under 2.3 s. In
// the Shear it lands after the blades have parted, never as they close. It flies straight (straight: no steer at the end):
// a note to roll on that a late step can still slip, so missing the tail of a phrase costs less than missing its head.
const PAT = [
  { notes: [{ b: 0, r: 2 }, { b: 3, r: 7, chord: 1 }, { b: 6, r: 4, straight: true }], beatUp: 13, spill: 14 },
  { notes: [{ b: 0.5, r: 6 }, { b: 1, r: 5 }, { b: 3, r: 2, chord: 1 }, { b: 6, r: 8, straight: true }], slams: [{ at: 3, gnx: -0.5 }, { at: 13.5, gnx: 0.45 }], spill: 15 },
  { notes: [{ b: 0, r: 1 }, { b: 0.5, r: 3 }, { b: 3, r: 8, chord: 1 }, { b: 6.5, r: 5, straight: true }], slams: [{ at: 3, gnx: 0.35 }], shear: { at: 13, gaps: [-0.45, 0.5, 0] }, spill: 15 },
];
// a weft's bolts round its centre: the hex lattice of a net (space.js NET_S apart), turned a little each chord
function weftPoints(rings, k) {
  const a0 = k * 0.7, out = [];
  for (let i = 0; i < 6; i++) { const a = a0 + i * Math.PI / 3; out.push([Math.cos(a) * NET_S, Math.sin(a) * NET_S]); }
  if (rings > 1) for (let i = 0; i < 6; i++) {
    const a = a0 + i * Math.PI / 3, a2 = a + Math.PI / 6;
    out.push([Math.cos(a) * NET_S * 2, Math.sin(a) * NET_S * 2], [Math.cos(a2) * NET_S * Math.sqrt(3), Math.sin(a2) * NET_S * Math.sqrt(3)]);
  }
  return out;
}
// one loop's events, by beat
function eventsOf(p) {
  const ev = [{ at: 0, what: 'call' }];
  p.notes.forEach((n, k) => { ev.push({ at: n.b, what: 'mark', k }); ev.push({ at: 4 + n.b - 0.25, what: 'tell', k }); ev.push({ at: 4 + n.b, what: 'fire', k }); });
  for (const s of p.slams || []) { ev.push({ at: Math.max(0, s.at - 4), what: 'plan', s }); ev.push({ at: s.at, what: 'slam', s }); }
  if (p.shear) ev.push({ at: p.shear.at - 3.75, what: 'shear' });
  if (p.beatUp) ev.push({ at: p.beatUp, what: 'beatUp' });
  ev.push({ at: p.spill, what: 'spill' });
  ev.push({ at: 8 + 3.5 + 2.4, what: 'callOff' });
  return ev.sort((a, b) => a.at - b.at);
}
const EVENTS = PAT.map(eventsOf);

export default defineBoss({
  name: 'g3-weftwork', title: 'THE WEFTWORK',
  hold: 135, y: 0, scale: S,
  // the boss marker comes 0.8 s before the shed's bar line, where its track cuts in; it flies in through the Impact and
  // starts on the Call's bar line
  enterTime: 0.8 + barT('weftwork', 5),
  escapeAfter: 150, defeatTime: 4.2,
  escapeCall: "IT'S TEARING ITSELF APART!",
  bonus: 120000, hitPts: 3000, pointDown: 'REED CUT!', downCall: 'THE LOOM IS COMING APART!',
  build(api, b) {
    const root = new THREE.Group(), inner = new THREE.Group();
    inner.rotation.y = Math.PI; root.add(inner);          // her front is -Z; you come from +Z of the boss
    inner.add(buildModel(MESH.frame).group);
    // the beater: her steel bars, and her ten reeds, each its own so it can key, flash and die
    const beater = new THREE.Group(); inner.add(beater);
    beater.add(buildModel(BEATER).group);
    const reeds = [];
    for (let i = 0; i < NR; i++) {
      const j = herOf(i), g = new THREE.Group();
      const bar = buildModel(reedPart(j, false), { own: ['#ff3355*'] }), rt = buildModel(reedPart(j, true), { own: ['#ff3355*'] });
      g.add(bar.group, rt.group); beater.add(g);
      // the plan of a keyed reed: a white bar laid over it while the call names it
      const plan = new THREE.Mesh(new THREE.BoxGeometry(0.7, 17.5, 0.2), new THREE.MeshBasicMaterial({ color: WHITE, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      plan.position.set(REED_X[j], 0, 6 - 1.0); g.add(plan);
      reeds.push({ g, bar: bar.mats['#ff3355*'], root: rt.mats['#ff3355*'], plan, x: REED_X[j] });
    }
    // the shuttle and its rail (her shuttler, 2.6x, long side across)
    inner.add(buildModel(RAIL).group);
    const shuttle = buildModel(SHUTTLE.shuttle, { own: ['#ff3355*'] }); shuttle.group.scale.setScalar(2.6); shuttle.group.rotation.y = Math.PI / 2;
    shuttle.group.position.set(0, 0.9, 11); inner.add(shuttle.group);
    // the shear: her two blades, waiting at the sides
    const shL = buildModel(SHEAR_L).group, shR = buildModel(SHEAR_R).group; inner.add(shL, shR);
    // THE CALL's drawing: the shuttle's path along the rail, and a mark per note (white: the plan never lies)
    const wm = () => new THREE.MeshBasicMaterial({ color: WHITE, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    // (along the comb's lower roots, in front of it, so it reads straight over the weak points the notes will key)
    const path = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.5), wm()); path.position.set(0, -10.6, 3); inner.add(path);
    const marks = [0, 1, 2, 3].map(() => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: WHITE, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); m.position.set(0, -8.7, 3); m.scale.setScalar(4); inner.add(m); return m; });
    // a chord's ring of points round its mark (one chord a loop: one set, up to two rings, 18 points)
    const sats = Array.from({ length: 18 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: WHITE, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); s.position.set(0, -8.7, 3); s.scale.setScalar(1.5); inner.add(s); return s; });
    // the comb's gap, planned on the beater (two white uprights)
    const gapL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 17, 0.3), wm()), gapR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 17, 0.3), wm());
    beater.add(gapL, gapR);
    Object.assign(b, { inner, beater, reeds, shuttle: shuttle.group, slit: shuttle.mats['#ff3355*'], shL, shR, path, marks, sats, gapL, gapR,
      chordN: 0, toldChord: false, sinks: [],
      clock: 0, sb: -1e-6, done: -1e-6, synced: false, drift: 0, beatS: beatOf('weftwork'), loop: -1, pat: null, pi0: 0,
      beatPos: 0, slamT: 9, shearK: 0, shearT: 9, sx: 0, litTo: new Array(NR).fill(-1), homeTo: new Array(NR).fill(-1), flash: new Array(NR).fill(0),
      planFor: new Array(NR).fill(0), shears: 0, apart: 0, muzzleAt: [0, 0, 0] });
    const weak = [];
    for (let i = 0; i < NR; i++) weak.push({ at: rootAt(b, i, [0, 0, 0]), r: 2.2, hp: 2 });
    return { root, weak, muzzles: [b.muzzleAt] };
  },
  // rule 25: a reed's roots glow, and can be cut, only while a note has keyed it: one of its bolts is about to reach you
  // (and the beater is drawn back), or you have rolled one home and it is on its way (a bolt you send home always lands)
  exposed(b, w) { return b.clock <= b.homeTo[w.i] || (b.beatPos < 0.5 && b.clock <= b.litTo[w.i]); },
  phases: [
    { name: 'THE CALL', until: 0.7, loop: 6.4, pattern: [], enter(b, api) { api.game.call('IT SHOWS YOU THE TUNE. PLAY IT BACK!', 'c-cyan'); } },
    { name: 'THE BEAT', until: 0.25, loop: 6.4, pattern: [], enter(b, api) { api.game.sfx('boss-phase', { vol: 0.8 }); } },
    { name: 'THE SHEAR', loop: 6.4, pattern: [], enter(b, api) { api.game.sfx('boss-phase', { vol: 0.8 }); } },
  ],
  update(b, dt, api) {
    b.clock += dt;
    if (b.state === 'fight') { clockTick(b, dt, api); runLoop(b, api); }
    animate(b, dt, api);
  },
  onWeakDown(b, w, api) {
    spill(b, api, 2, w.i);
    api.game.shake(0.7);
    api.game.burst(w.ent.x, w.ent.y, w.ent.z, 50, { speed: 18, life: 0.8, s0: 2, r: 0.75, g: 0.55, b: 1, carry: 0, drag: 1.4 }); // thread-light, violet
  },
  enter(b, api) { api.game.sfx('boss-warning', { vol: 0.9 }); },
  defeat(b, api) { api.game.flash(); api.game.sfx('boss-defeat', { vol: 1 }); api.game.sfx('g3-unravel', { vol: 1 }); api.game.sfx('boom', { rate: 0.4, vol: 1 }); },
});

// ---- the music's clock. sb = beats since the Call's first bar line. It runs on the frame clock, and while the boss's
// track is playing it is drawn onto the track's own beat (snapped once at the start of the fight, nudged after), so a
// loop always starts on the Call bar line and the notes land on the beat. Without music (muted tests, a slow decode) it
// keeps the same grid on its own.
function clockTick(b, dt, api) {
  b.sb += dt / b.beatS;
  // the dev menu's SPEED runs the game faster or slower than the music: then the fight keeps its own clock
  if ((api.G.devSpeed || 1) !== 1) return;
  const m = api.music, meta = m && m.meta;
  if (!meta || !meta.barSec || !/weftwork$/.test(m.track || '')) return;
  const pos = m.position(); if (!(pos > 0)) return;
  b.beatS = meta.barSec / 4;
  const want = (pos - (meta.firstBeat || 0)) / b.beatS - 16;   // the Call is bar 5 of the take: beat 16
  let err = ((want - b.sb) % 16 + 16) % 16; if (err > 8) err -= 16;
  if (!b.synced && b.fightT < 0.6) { b.sb += err; b.done = b.sb - 1e-6; b.synced = true; } // the first moments: snap (nothing has played yet)
  else if (Math.abs(err) < 1) { b.sb += err * Math.min(1, dt * 2); b.drift = 0; }         // after: a gentle pull, never a jump
  else if ((b.drift += dt) > 1.5 && ((b.sb % 16) + 16) % 16 < 0.4) { b.sb += err; b.drift = 0; } // knocked off the beat (a pause): back on it at a loop's start
}
// fire every event of the current loop whose beat the clock has passed (each one once, even if the clock is pulled back)
function runLoop(b, api) {
  const L = Math.floor(b.sb / 16);
  if (L !== b.loop && b.sb >= 0) { b.loop = L; b.pi0 = b.pi; b.pat = PAT[b.pi]; b.evs = EVENTS[b.pi]; b.loopAt = L * 16; }
  if (!b.pat) { b.done = Math.max(b.done, b.sb); return; }
  for (const e of b.evs) {
    const t = b.loopAt + e.at;
    if (t > b.done && t <= b.sb) doEvent(b, api, e, b.sb - t);
  }
  b.done = Math.max(b.done, b.sb);
}
// the reed a note keys: its own, or the nearest still standing
function reedFor(b, r) {
  if (b.weak[r] && b.weak[r].hp > 0) return r;
  let best = -1, bd = 99;
  for (const w of b.weak) if (w.hp > 0 && Math.abs(w.i - r) < bd) { bd = Math.abs(w.i - r); best = w.i; }
  return best;
}
function doEvent(b, api, e, late) {
  const p = b.pat, beat = b.beatS, L0 = b.loopAt;
  if (e.what === 'call') {
    // the path: from the first note's reed to the last's, drawn in across the first beat
    const xs = p.notes.map((n) => b.reeds[reedFor(b, n.r)] ? b.reeds[reedFor(b, n.r)].x : 0);
    b.callPath = { x0: Math.min(...xs), x1: Math.max(...xs), from: xs[0], t: 0 };
    b.callOn = true; b.callAt = L0;
    b.marks.forEach((m) => { m.userData = {}; });
    // the route the shuttle will run in the response bar: each note's reed on its beat
    b.route = [];
    p.notes.forEach((n, k) => { const r = reedFor(b, n.r); if (r >= 0) { b.planFor[r] = 1; b.marks[k].userData = { x: b.reeds[r].x, r, beat: L0 + n.b, chord: n.chord || 0, ck: b.chordN }; b.route.push({ at: L0 + 4 + n.b, x: b.reeds[r].x }); } });
  } else if (e.what === 'mark') {
    // the call, heard: a chime on each note, pitched by its reed (a chord's with a low pluck under it)
    const n = p.notes[e.k], r = reedFor(b, n.r); if (r < 0) return;
    b.flash[r] = 1; api.game.sfx('crystal-chime', { rate: 0.8 + r * 0.06, vol: 0.55 });
    if (n.chord) {
      api.game.sfx('g3-pluck', { rate: 0.7, vol: 0.5 });
      if (!b.toldChord) { b.toldChord = true; api.game.call("THE BIG NOTES OPEN UP. YOU CAN'T DODGE THEM: ROLL!", 'c-cyan'); }
    }
  } else if (e.what === 'tell') {
    b.slitT = 0.25;                                     // her shuttler's flank slits flare white just before it fires
  } else if (e.what === 'fire') {
    const n = p.notes[e.k], r = reedFor(b, n.r); if (r < 0) return;
    b.sx = b.reeds[r].x; b.shuttle.position.x = b.sx;   // on its route, the shuttle is at the note's reed on the note
    if (e.k === 0) api.game.sfx('g3-shuttle', { vol: 0.5 });
    b.root.updateMatrixWorld();
    tmpV.set(0, 0, 0); b.shuttle.localToWorld(tmpV);
    const from = { x: tmpV.x, y: tmpV.y, z: tmpV.z };
    const T = Math.max(0.6, 4 * beat - late * beat);    // exactly a bar: it lands on the beat the call showed
    const lead = 0.25, tx = clamp(api.ship.x + api.ship.vx * lead, -api.box.x, api.box.x), ty = clamp(api.ship.y + api.ship.vy * lead, -api.box.y, api.box.y);
    api.fire(from, tx, ty, { T, owner: b, noEase: true, steer: n.straight ? undefined : steerIn, tag: { reed: r, chord: n.chord || 0 } });
    b.muzzleFlash = 1; api.game.sfx('fire', { rate: 0.7 + r * 0.04, vol: 0.6 });
    // this note keys its reed: its roots light as the bolt reaches you (animate reads the bolt itself)
    b.planFor[r] = 0;
  } else if (e.what === 'plan') {
    b.gapPlan = { gnx: e.s.gnx, until: L0 + e.s.at + 0.6 };
  } else if (e.what === 'slam') {
    // the beater slams, and a comb leaves it: a bar to reach you
    b.slamT = 0; api.game.sfx('g3-beater', { vol: 0.9 }); api.game.shake(0.35);
    b.root.updateMatrixWorld(); tmpV.set(0, 0, 0); b.beater.localToWorld(tmpV);
    api.spawn({ type: 'g3-weft-comb', gnx: e.s.gnx, gw: 3.6, T: Math.max(0.8, 4 * beat - late * beat), z0: tmpV.z + 6 }, tmpV.z + 6);
  } else if (e.what === 'shear') {
    const g = p.shear.gaps[b.shears++ % p.shear.gaps.length];
    b.shearT = 0; b.shearTel = 3.75 * beat;
    if (b.shears === 1) api.game.call("YOU CAN'T ROLL THE SHEAR. FLY THROUGH THE GAP!", 'c-red');
    api.spawn({ type: 'g3-weft-shear', gnx: g, gw: 3.4, tel: 3.75 * beat - late * beat, on: 0.5 }, -2);
  } else if (e.what === 'beatUp') {
    b.slamT = 0; api.game.sfx('g3-beater', { vol: 0.5, rate: 1.2 });
  } else if (e.what === 'spill') {
    spill(b, api, 1, -1);
  } else if (e.what === 'callOff') {
    b.callOn = false;
  }
}
// a bolt from the shuttle eases onto you in the last part of its flight: stepping aside late rarely saves you; a roll does
function steerIn(s, dt, api) {
  const vz = s.vz + (s.carry ? api.v : 0), tr = vz > 0 ? -s.z / vz : 0;
  if (tr > 0.12 && tr < 0.75) {
    const k = Math.min(1, dt * 2.6);
    s.vx += ((api.ship.x - s.x) / tr - s.vx) * k; s.vy += ((api.ship.y - s.y) / tr - s.vy) * k;
  }
}
// ---- CHORDS. A chord's bolt, one beat out: it opens. The note's own bolt flies on straight to where you are (it keys its
// reed, as every note does) and the weft's bolts leave it for the lattice round that point, landing with it.
function openChord(b, api, s, tr) {
  s.tag.open = true; s.steer = null;
  const B = api.box, ship = api.ship, lead = 0.2;
  const ax = clamp(ship.x + ship.vx * lead, -B.x, B.x), ay = clamp(ship.y + ship.vy * lead, -B.y, B.y);
  s.vx = (ax - s.x) / tr; s.vy = (ay - s.y) / tr;
  const from = { x: s.x, y: s.y, z: s.z };
  for (const [dx, dy] of weftPoints(s.tag.chord, b.chordN++)) api.fire(from, ax + dx, ay + dy, { T: tr, owner: b, noEase: true, tag: { reed: s.tag.reed, weft: true } });
  api.game.sfx('g3-pluck', { rate: 1.25, vol: 0.7 });
  api.game.burst(s.x, s.y, s.z, 22, { speed: 10, life: 0.3, s0: 1, r: 1, g: 0.3, b: 0.4, carry: 0 });
}
// where a weft bolt you rolled home lands: on its reed's root, where it sparks (cyan: yours) and cuts nothing
function sinkFor(b, r) {
  const i = reedFor(b, r < 0 ? 4 : r); if (i < 0 || !b.weak[i] || !b.weak[i].ent) return null;
  if (!b.sinks[i]) {
    const w = b.weak[i];
    b.sinks[i] = { get x() { return w.ent.x; }, get y() { return w.ent.y; }, get z() { return w.ent.z; }, get alive() { return b.alive && b.state === 'fight'; }, dead: false, hitR: 1.4,
      kind: { name: 'g3-weft-sink', onShot: (t, sh, api) => { b.flash[i] = Math.max(b.flash[i], 0.5); api.game.burst(t.x, t.y, t.z, 8, { speed: 9, life: 0.3, s0: 0.8, r: 0.5, g: 0.95, b: 1, carry: 0 }); } } };
  }
  return b.sinks[i];
}
// thread-light from a struck reed (or the loom), streaming at you out of the loom's depths, beyond 150 m
function spill(b, api, n, i) {
  for (let k = 0; k < n; k++) {
    const sx = i >= 0 ? Math.sign(-b.reeds[i].x) * 0.4 : 0;
    const nx = clamp(sx + (Math.random() - 0.5) * 0.8, -0.75, 0.75), ny = clamp((Math.random() - 0.5) * 0.9, -0.7, 0.7);
    api.spawn({ type: 'g3-weft-light', nx, ny }, b.z - 40 - k * 18);
  }
}
// a reed's root in the boss's own frame (her lower root, where her sheet marks it), written into `out`
function rootAt(b, i, out) {
  const j = herOf(i), z = 6 - b.beatPos * 9 - 0.8;
  out[0] = -REED_X[j]; out[1] = -8.7; out[2] = -z;       // turned to face you: her x and z mirrored
  return out;
}

function animate(b, dt, api) {
  const fight = b.state === 'fight', beat = b.beatS;
  // the beater: drawn back, slamming forward when it beats (0.12 s out, 0.35 s back)
  b.slamT += dt;
  b.beatPos = b.slamT < 0.12 ? smoothstep(0, 1, b.slamT / 0.12) : b.slamT < 0.47 ? 1 - smoothstep(0, 1, (b.slamT - 0.12) / 0.35) : 0;
  b.beater.position.z = -9 * b.beatPos;
  for (const w of b.weak) rootAt(b, w.i, w.at);
  // the shuttle runs its rail: along the route the call drew, reaching each note's reed on its beat; home after
  const rt = b.route, sb = b.sb;
  let want = 0;
  if (rt && rt.length && fight && sb >= rt[0].at - 1.5 && sb <= rt[rt.length - 1].at + 2) {
    want = rt[0].x;
    for (let k = 0; k < rt.length; k++) { if (sb >= rt[k].at) want = rt[k].x; if (k + 1 < rt.length && sb >= rt[k].at && sb < rt[k + 1].at) want = rt[k].x + (rt[k + 1].x - rt[k].x) * smoothstep(rt[k].at, rt[k + 1].at, sb); }
  }
  if (Math.abs(want - b.sx) > 0.02) b.shuttle.rotation.y = want > b.sx ? -Math.PI / 2 : Math.PI / 2; // her nose (-Z) leads the way it runs
  b.sx += (want - b.sx) * Math.min(1, dt * (Math.abs(want - b.sx) > 0.01 && rt && sb < (rt[0] ? rt[0].at : 0) ? 3.5 : 14));
  b.shuttle.position.x = b.sx;
  // the keyed reeds, from their bolts: lit while one is under 0.2 s from you (so a pair's first bolt goes to its own
  // reed), and while one you rolled is on its way home
  for (const s of api.course.shots) {
    if (s.owner !== b || !s.alive || !s.tag || s.tag.reed === undefined) continue;
    // a weft bolt sent home: the engine aims it at the lit weak point (a boss's shot); it goes to the reed's spark point
    // instead, the same place, so it sparks there and cuts nothing (entities update before shots: it never gets there)
    if (s.tag.weft) { if (s.reflected) { const t = sinkFor(b, s.tag.reed); if (s.target !== t) s.target = t; } continue; }
    if (s.reflected) b.homeTo[s.tag.reed] = b.clock + 0.3;
    else {
      const vz = s.vz + (s.carry ? api.v : 0), tr = vz > 0 ? -s.z / vz : 9;
      if (tr < 0.2) b.litTo[s.tag.reed] = b.clock + 0.3;
      // a chord opens one beat out (in the fight only; a chord still flying when the loom falls lands as a single note)
      if (s.tag.chord && !s.tag.open && fight && tr <= beat) openChord(b, api, s, tr);
    }
  }
  // every hit on a reed spills thread-light (a cut one spills more, in onWeakDown)
  // and every hit buys 3 s on the clock (galaxy 1's finale rule): only a ship that has stopped hurting it is timed out
  for (const w of b.weak) { if (w.lastHp !== undefined && w.hp < w.lastHp && fight) { if (w.hp > 0) { spill(b, api, 1, w.i); b.flash[w.i] = 1; } b.fightT = Math.max(0, b.fightT - 3); api.game.sfx('boss-hit', { vol: 0.9 }); } w.lastHp = w.hp; }
  b.slitT = Math.max(0, (b.slitT || 0) - dt);
  b.slit.color.setHex(b.slitT > 0 ? 0xffffff : 0xff3355);
  b.root.updateMatrixWorld(); tmpV.set(0, 0, 0); b.shuttle.localToWorld(tmpV); b.root.worldToLocal(tmpV);
  b.muzzleAt[0] = tmpV.x; b.muzzleAt[1] = tmpV.y; b.muzzleAt[2] = tmpV.z;
  if (b.muzzleFlash) { const g = b.glows[0]; g.material.opacity = 1; g.scale.setScalar(6); b.muzzleFlash = 0; }
  // the reeds: red; keyed, its roots bloom; struck, a white flash; cut, dark and hanging
  for (let i = 0; i < NR; i++) {
    const R = b.reeds[i], w = b.weak[i];
    b.flash[i] = Math.max(0, b.flash[i] - dt * 3);
    if (w.hp <= 0) { R.bar.color.setHex(DEAD); R.root.color.setHex(DEAD); R.droop = Math.min(0.25, (R.droop || 0) + dt * 0.4); if (b.state === 'fight') R.g.rotation.z = R.droop * (i < NR / 2 ? -1 : 1); R.plan.material.opacity = 0; continue; }
    const lit = fight && b.exposed(w), k = b.flash[i];
    R.bar.color.setRGB(1, 0.2 + 0.6 * k, 0.33 + 0.55 * k);
    R.root.color.setRGB(1, lit ? 0.75 : 0.2 + 0.6 * k, lit ? 0.85 : 0.33 + 0.55 * k);
    R.plan.material.opacity = fight && b.callOn && b.planFor[i] ? 0.25 + 0.55 * k : 0;
  }
  // the call's drawing: the path draws in over the first beat, the marks flash on their beats, the one being played
  // turns red as the shuttle fires it
  const P = b.callPath;
  if (P && b.callOn && fight) {
    P.t += dt;
    const draw = smoothstep(0, beat, P.t), len = Math.max(0.5, (P.x1 - P.x0) * draw);
    b.path.scale.set(len, 1, 1); b.path.position.x = P.from <= (P.x0 + P.x1) / 2 ? P.x0 + len / 2 : P.x1 - len / 2;
    b.path.material.opacity = 0.75;
    b.marks.forEach((m) => {
      const u = m.userData; if (!u || u.x === undefined) { m.material.opacity = 0; return; }
      m.position.x = u.x;
      const since = (b.sb - u.beat) * beat, played = (b.sb - (u.beat + 4)) * beat;
      const pop = since >= 0 && since < 0.3 ? 1 - since / 0.3 : 0, fire = played >= 0 && played < 0.4 ? 1 - played / 0.4 : 0;
      m.material.opacity = since < 0 ? 0.25 : 0.55 + 0.45 * Math.max(pop, fire);
      m.material.color.setHex(fire > 0 ? 0xff3355 : WHITE);
      m.scale.setScalar((5 + 5 * pop + 4 * fire) * (u.chord ? 1.3 : 1));
    });
    // a chord's mark carries the weft it will open into, drawn as it will open (its own turn; her x is mirrored)
    const cm = b.marks.find((m) => m.userData && m.userData.chord), pts = cm ? weftPoints(cm.userData.chord, cm.userData.ck) : [];
    b.sats.forEach((s, i) => {
      if (!cm || i >= pts.length) { s.material.opacity = 0; return; }
      s.position.set(cm.position.x - pts[i][0] * 0.6, cm.position.y + pts[i][1] * 0.6, cm.position.z);
      s.material.opacity = cm.material.opacity * 0.85; s.material.color.copy(cm.material.color);
    });
  } else {
    b.path.material.opacity = Math.max(0, b.path.material.opacity - dt * 3);
    for (const m of b.marks) m.material.opacity = Math.max(0, m.material.opacity - dt * 3);
    for (const s of b.sats) s.material.opacity = Math.max(0, s.material.opacity - dt * 3);
  }
  // the comb's gap, planned on the beater a bar before it slams (mapped from the lane onto the comb's width)
  const G = b.gapPlan;
  if (G && fight && b.sb <= G.until) {
    const hx = -(G.gnx * 16.5 / 1.0) * 0.8; // her x (mirrored)
    b.gapL.position.set(hx - 2.6, 0, 6 - 1.2); b.gapR.position.set(hx + 2.6, 0, 6 - 1.2);
    b.gapL.material.opacity = b.gapR.material.opacity = 0.6 + 0.3 * Math.sin(b.clock * 18);
  } else b.gapL.material.opacity = b.gapR.material.opacity = Math.max(0, b.gapL.material.opacity - dt * 3);
  // the shear: the blades close on the loom as they close on you
  b.shearT += dt;
  const st = b.shearT, tel = b.shearTel || 1.5;
  b.shearK = st < tel ? 0.05 * st / tel : st < tel + 0.16 ? smoothstep(0, 1, (st - tel) / 0.16) : st < tel + 0.66 ? 1 : Math.max(0, 1 - (st - tel - 0.66) / 0.4);
  b.shL.position.x = 15 * b.shearK; b.shR.position.x = -15 * b.shearK;
  // coming apart: beaten, or giving up (rule 26). Reeds fly, the posts lean out, the whole loom tears
  if (b.state === 'dying' || b.state === 'escape') {
    b.apart = Math.min(1, b.apart + dt / 3);
    b.reeds.forEach((R, i) => { R.g.position.y += dt * (i % 2 ? 9 : -9) * b.apart; R.g.rotation.z += dt * (i - 4.5) * 0.3; R.bar.color.lerp(new THREE.Color(0xffffff), dt * 2); });
    b.inner.rotation.z = Math.sin(b.clock * 7) * 0.02 * b.apart;
    if (Math.random() < dt * 10) api.game.burst(b.x + (Math.random() - 0.5) * 80, b.y + (Math.random() - 0.5) * 50, b.z + (Math.random() - 0.5) * 10, 30, { speed: 22, life: 0.9, s0: 2, r: 0.8, g: 0.6, b: 1, carry: 0, drag: 1.2 });
  }
}
