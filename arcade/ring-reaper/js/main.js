// STARWAKE 0.4.0: the game. Flight, the roll, the rules of scoring (ruling 4), the run of a level, the screens.
// 0.4.0: three galaxies (a level is (g, n)), the six power-ups, caches, Slipstream's world time, and the hooks galaxies
// 2 and 3 need (a push on the ship, a roll that answers things that are not shots, GREED lit by a boss).
// Levels, kinds, scenery and bosses are modules (js/levels, js/pickups, js/obstacles, js/enemies, js/bosses);
// this file runs whichever level is loaded and owns every rule that scores.
import * as THREE from '../vendor/three/three.module.min.js?v=0.6.3';
import { VERSION, clamp, damp, lerp, isTouch, fmt, store } from './util.js?v=0.6.3';
import { Input } from './input.js?v=0.6.3';
import { Audio, canonTrack, multRate } from './audio.js?v=0.6.3';
import { buildShip } from './ship.js?v=0.6.3';
import { Backdrop } from './backdrop.js?v=0.6.3';
import { Course } from './course.js?v=0.6.3';
import { Scenery } from './scenery.js?v=0.6.3';
import { Particles } from './fx.js?v=0.6.3';
import { Hud, artUrl } from './hud.js?v=0.6.3';
import { CATALOGUE, GALAXIES, galaxy, entryOf, catalogueOf, gn, levelLabel, loadLevel, isMarker, Progress, grade, easeOf, starProgress } from './levels.js?v=0.6.3';
import { POWERUPS, POWERUP_IDS } from './powerups.js?v=0.6.3';
import { appear, DEFLECT_R } from './space.js?v=0.6.3';
import { bossKind, weakPointKind } from './boss.js?v=0.6.3';
import { Quality } from './quality.js?v=0.6.3';
import { Post } from './post.js?v=0.6.3';
import { UI } from './ui.js?v=0.6.3';
import { Tips } from './tutorials.js?v=0.6.3';
import * as Mult from './mult.js?v=0.6.3'; // 0.6.3: the multiplier's rules (Evrtek 11-11)

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
// 0.4.0 boot-menu: #boot-old (or ?boot=old) is today's boot, kept for comparison; the page's head reads it (index.html)
const BOOT_OLD = document.documentElement.classList.contains('boot-old');
const TOUCH = isTouch();

// ---------------------------------------------------------------- tuning (first guesses, his to tune by playing)
const T = {
  // cooldown 0.85 -> 0.65 (Evrtek 11-05) -> 0.50 (Evrtek 11-06, the human pass: "Go to a .5 delay on a new barrel
  // roll"): a roll can start every 0.95 s. Level 9's bait still bites: its ghosts lead the real shots by 0.62 s.
  rollTime: 0.45, rollCool: 0.50, rollDash: 10,
  steerK: 60,                     // spring stiffness toward the steering target
  shotDmg: 16, ringShield: 4, gateShield: 2,
  greedTime: 8, greedSpeed: 1.28, greedAuto: 0,
  ringPts: 100, gatePts: 250, deflectPts: 150, killPts: 1000, scrapePts: 80,
  perfectBonus: 5000, noHitBonus: 25000, shieldBonus: 100,
  // 0.6.0, the player pass (Evrtek 11-10: checkpoints; "decide sensibly and say what you chose"). A run that goes down after
  // taking its checkpoint may start again from it: with the SCORE, the rings and every count it had at the checkpoint, a
  // FULL shield (restartShield), and its MULTIPLIER back at x1 (0.6.3: a fresh start, not a penalty; a crash costs three steps: js/mult.js).
  // It is safe for restartInvuln seconds while the course comes back. A restarted run cannot earn the NO-HIT bonus.
  // A checkpoint flown past does NOT count (checkpointMissCounts: false): it is a thing you grab, and it is 4.2 m wide.
  restartShield: 100, restartInvuln: 1.6, checkpointMissCounts: false,
};

// ---------------------------------------------------------------- renderer, scene, camera
const canvas = $('view');
const quality = new Quality(TOUCH);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !TOUCH, powerPreference: 'high-performance', alpha: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x05040f, 1);
const scene = new THREE.Scene();
scene.environmentIntensity = 0.85;
const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 1200);
const backdrop = new Backdrop(scene, quality.tier);
const fx = new Particles(scene, quality.tier === 0 ? 700 : 1600, backdrop.glowTex);
const post = new Post(renderer);
const audio = new Audio();
// 0.4.0: a galaxy 2 or 3 track plays only once it is in (GALAXIES has.music: true, or the list of the tracks that are);
// the rest play galaxy 1 stand-ins (audio.js standIn), so nothing missing is ever asked for and nothing plays silent
audio.hasTrack = (name) => { const m = /^g([23])\//.exec(name || ''), x = m && galaxy(+m[1]), h = x ? x.has.music : true; return h === true || (Array.isArray(h) && h.includes(canonTrack(name))); };
const input = new Input(canvas, TOUCH);
const hud = new Hud();

const ship = { x: 0, y: 0, vx: 0, vy: 0, rolling: false, invuln: 0 };
const S = buildShip(backdrop.glowTex);
scene.add(S.root);

const box = { x: 7.5, y: 4.3 };
let baseFov = 62;
function resize() {
  const w = window.innerWidth, h = window.innerHeight, a = w / h;
  renderer.setPixelRatio(quality.pixelRatio());
  renderer.setSize(w, h, false);
  camera.aspect = a;
  // portrait gets a narrower, taller box (MCP brief) and a wider lens so it still fits
  const t = clamp((a - 0.55) / (1.5 - 0.55), 0, 1);
  box.x = lerp(4.1, 7.5, t); box.y = lerp(5.6, 4.3, t);
  baseFov = lerp(80, 60, t);
  camera.updateProjectionMatrix();
  post.setSize(renderer);
  const px = renderer.getDrawingBufferSize(new THREE.Vector2()).y / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  fx.layer.setScale(px); course.shotLayer.setScale(px); api.focalPx = px;
}
quality.onChange = () => resize();

// ---------------------------------------------------------------- game state
const G = { state: 'boot', time: 0, dist: 0, courseD: 0, v: 0, vMul: 1, dev: false, devSpeed: 1 };
let level = null;
window.__sw = { G, ship, T, quality, input, audio, version: VERSION, CATALOGUE, GALAXIES, Progress, POWERUPS };

// ---------------------------------------------------------------- scoring: the rules every kind reports to
const tmpV = new THREE.Vector3();
function screenOf(x, y, z) {
  tmpV.set(x, y, z).project(camera);
  return [(tmpV.x * 0.5 + 0.5) * window.innerWidth, (-tmpV.y * 0.5 + 0.5) * window.innerHeight];
}
function gain(base, x, y, z, cls = '', label = '') {
  const pts = Math.round(base * (G.greedOn ? 2 : 1));
  G.score += pts;
  if (x !== undefined) { const [sx, sy] = screenOf(x, y, z); hud.pop((label ? label + ' ' : '') + '+' + fmt(pts), sx, sy, cls); }
  return pts;
}
// 0.6.3 (Evrtek 11-11): the pips and the multiplier are lost apart (js/mult.js). n rings in a row; each step up sounds.
function addRings(n) {
  for (let i = 0; i < n; i++) if (Mult.ring(G)) { audio.play('streak', { rate: multRate(G.mult) }); hud.callArt(['x' + G.mult]); } // rate 1 unless #multrise
}
function addGreed(n) {
  if (G.greedOn) return;
  const was = G.greed;
  G.greed = Math.min(100, G.greed + n);
  // 0.6.2: the first time, the explanation line says it (and what GREED does); after that the call-out as before
  if (was < 100 && G.greed >= 100) { G.greedReadyT = 0; if (!tips.event('greed')) hud.call(input.mode === 'touch' ? 'GREED READY: TAP IT' : 'GREED READY: ' + input.say('greed'), ''); }
}
function heal(n) { if (!G.greedOn) G.shield = Math.min(100, G.shield + n); }
// the one heal that works during GREED (the MCP's default 7): a Shield Cell, never past full
function healAlways(n) { G.shield = Math.min(100, G.shield + n); }
function onRing(e) {
  // 0.4.0: a CACHE ring (ev.cache) is an extra: score, combo and shield as any ring, its own count, never a star
  const cache = !!(e.ev && e.ev.cache);
  if (cache) { G.cachesGot++; if (G.time - (G.cacheCallT ?? -9) > 3) { G.cacheCallT = G.time; callArtOr('cache', 'CACHE!', 'c-cyan'); audio.play('pu-cache'); } }
  else { G.ringsGot++; G.secGot[G.section] = (G.secGot[G.section] || 0) + 1; }
  if (e.magnet) { G.magnetN = (G.magnetN || 0) + 1; audio.play('pu-magnet-clink', { rate: 1 + Math.random() * 0.1 }); }
  addRings(1);
  const roll = G.rolling;
  gain(T.ringPts * G.mult * (roll ? 2 : 1), e.x, e.y + 1.2, 0, roll ? 'cyan' : '', roll ? 'ROLL-RING' : '');
  if (roll) addGreed(5);
  heal(T.ringShield * level.ease.heal);
  audio.play('ring', { rate: 1 + Math.min(G.chain, 24) * 0.012, pan: e.x / box.x * 0.5 });
  fx.burst(e.x, e.y, 0, Math.round(26 * quality.particleScale), { speed: 9, life: 0.5, s0: 0.9, r: 1, g: 0.8, b: 0.25, carry: 1, flatZ: 0.3 });
}
function onMiss(e) {
  if (e.ev && (e.ev.cache || e.ev.shower)) return; // a missed extra costs nothing; nor does a ring a burst forgery gave back (0.6.0)
  G.ringsMissed++; G.secMiss[G.section] = (G.secMiss[G.section] || 0) + 1;
  // 0.6.3: a miss clears the pips and keeps the multiplier (Evrtek 11-11: "missing rings should not drop you down")
  if (Mult.miss(G)) { const [sx, sy] = screenOf(e.x, e.y, 0); hud.pop('MISS', sx, sy, 'red'); }
}
function onScrape() {
  G.scrapes++;
  gain(T.scrapePts * G.mult, ship.x, ship.y + 1, 0, 'cyan', 'CLOSE');
  addGreed(4);
}
// 0.6.0, the CHECKPOINT (js/pickups/checkpoint). Taking it keeps what the run has earned so far: the score and its bonuses,
// the rings caught and missed (by sector, so PERFECT still works), the hits and every other count on the end card. NOT the
// multiplier and NOT the shield: a restart begins at x1 with a full shield (T.restartShield). The music's place is kept too,
// so a restart comes back on the bar it left.
const KEPT = ['score', 'ringsGot', 'ringsMissed', 'hits', 'grazes', 'deflects', 'kills', 'multiMax', 'gates', 'scrapes', 'bestMult', 'bestChain', 'cachesGot', 'counters', 'phasedN', 'puTaken', 'rolls', 'time', 'dist', 'magnetN', 'drained'];
function onCheckpoint(e) {
  const d = e && e.ev && e.ev.d !== undefined ? e.ev.d : G.courseD;
  if (G.cp && G.cp.d >= d) return;
  const keep = {}; for (const k of KEPT) keep[k] = G[k] || 0;
  const m = audio.music && audio.music.name !== MENU.track ? { track: audio.music.name, from: Math.max(0, audio.position()), loop: audio.music.opts ? audio.music.opts.loop : undefined } : null;
  G.cp = { g: level.g || 1, n: level.n, d, keep, secGot: Object.assign({}, G.secGot), secMiss: Object.assign({}, G.secMiss), perfect: G.perfect.slice(), bonuses: G.bonuses.map((b) => b.slice()), puGot: Object.assign({}, G.puGot),
    greed: G.greedOn ? 0 : G.greed, jumped: G.jumped, restarts: G.restarts || 0, music: m };
  callText('CHECKPOINT', 'c-check'); audio.play('checkpoint'); // 0.6.1: its own sound (js/audio.js)
  if (e) fx.burst(e.x, e.y, 0, Math.round(46 * quality.particleScale), { speed: 13, life: 0.7, s0: 1.3, r: 0.75, g: 0.9, b: 1, carry: 1, flatZ: 0.3 });
}
function onCheckpointMiss(e) {
  if (T.checkpointMissCounts) { onCheckpoint(e); return; }
  const [sx, sy] = screenOf(e.x, e.y, 0); hud.pop('MISSED THE CHECKPOINT', sx, sy, 'red');
}
function onGate(e, pass) {
  if (!pass) return;
  G.gates++;
  gain(T.gatePts * G.mult, e.x, e.y + 2.6, 0, 'cyan', 'GATE');
  heal(T.gateShield * level.ease.heal);
  audio.play('ring', { rate: 0.75 });
  fx.burst(e.x, e.y, 0, Math.round(30 * quality.particleScale), { speed: 14, life: 0.5, s0: 1, r: 0.3, g: 0.9, b: 1, carry: 1, flatZ: 0.1 });
}
// 0.6.3: drop = the steps it costs the multiplier (Mult.DROP: a shot 1, a crash 3), never below x1; the pips clear
function damage(dmg, big, drop = Mult.DROP.shot) {
  dmg *= level.ease.dmg; // the human pass: early levels hit softer (EASE, levels.js)
  if (G.hold) dmg *= level.ease.boss; // 0.6.0: ...and a boss fight has a dial of its own (no rings heal you there: levels.js)
  if (G.god) dmg = 0;
  G.shield -= dmg; G.hits++;
  ship.invuln = big ? 0.8 : 0.6;
  hud.flash(); G.shake = Math.max(G.shake, big ? 0.9 : 0.5);
  audio.play('hit');
  Mult.drop(G, drop);
  if (G.shield <= 0) die();
}
function onShot(s) {
  if (s.tutor) return; // a teaching shot never hurts (the G2 hound's first bolt)
  if (ship.invuln > 0) return;
  damage(s.dmg ?? T.shotDmg, false, Mult.DROP.shot);
  fx.burst(ship.x, ship.y, 0, Math.round(18 * quality.particleScale), { speed: 8, life: 0.35, s0: 1, r: 1, g: 0.3, b: 0.2, carry: 0.2 });
}
function onCrash(e, dmg, small) {
  // 0.4.0, PHASE: solid things pass through you unharmed (rocks, walls, coral, wrecks, teeth); fire never does
  if (ship.phasing) { phased(e); return 'stay'; }
  if (ship.invuln > 0) return 'stay';
  damage(dmg, !small, Mult.DROP.crash); // 0.6.3: every crash, every size, three steps (Evrtek 11-11)
  const x = e.x ?? ship.x, y = e.y ?? ship.y;
  fx.burst(lerp(x, ship.x, 0.6), lerp(y, ship.y, 0.6), 0, Math.round(30 * quality.particleScale), { speed: 12, life: 0.5, s0: 1.2, r: 1, g: 0.55, b: 0.3, carry: 0.6 });
  if (e.type === 'rock' || e.type === 'crystal' || (e.kind && e.kind.breaks)) { audio.play('boom', { vol: 0.6, rate: 1.2 }); return 'gone'; }
  return 'stay';
}
function phased(e) {
  const k = e && (e.id ?? e);
  if (k !== undefined && G.phasedIds.has(k)) return;
  if (k !== undefined) G.phasedIds.add(k);
  G.phasedN++;
  const x = e && e.x !== undefined ? e.x : ship.x, y = e && e.y !== undefined ? e.y : ship.y;
  if (G.time - (G.phasedCallT ?? -9) > 1.2) { G.phasedCallT = G.time; callArtOr('phased', 'PHASED!', 'c-pu-phase'); } // Yori's PHASED!
  else { const [sx, sy] = screenOf(lerp(x, ship.x, 0.6), lerp(y, ship.y, 0.6) + 1, 0); hud.pop('PHASED', sx, sy, 'phase'); }
  audio.play('pu-phase-pass', { gap: 0.15 });
}
function onGraze(s, d, a, b) {
  if (s.tutor) return;
  const c = clamp(1 - (d - a) / (b - a), 0, 1);
  G.grazes++;
  gain((50 + 250 * c * c) * G.mult, ship.x + (s.x - ship.x) * 0.5, ship.y + 1, 0, c > 0.7 ? 'mag big' : 'mag', 'GRAZE');
  addGreed(6 + 14 * c);
  if (c > 0.75) { hud.callArt(['graze']); G.hitstop = Math.max(G.hitstop, 0.04); }
}
function onDeflect(s) {
  G.deflects++; G.rollDeflects++;
  if (!Progress.tip('roll')) Progress.setTip('roll'); // any shot sent back means the roll is learned: no roll line again
  tips.deflected();
  const n = G.rollDeflects;
  G.multiMax = Math.max(G.multiMax, n);
  gain(T.deflectPts * G.mult * n, ship.x, ship.y + 1.4, 0, 'cyan', n > 1 ? 'DEFLECT x' + n : 'DEFLECT');
  addGreed(8);
  audio.play('deflect', { rate: 1 + (n - 1) * 0.06, gap: 0.02 });
  if (G.pu.mirror) audio.play('pu-mirror-ping', { rate: 1 + Math.min(8, n) * 0.05, gap: 0.03 });
  if (s && s.label) callText(s.label, 'c-cyan');
  fx.burst(ship.x, ship.y, -0.5, Math.round(16 * quality.particleScale), { speed: 14, life: 0.3, s0: 0.8, r: 0.5, g: 0.95, b: 1, carry: 0 });
  if (n >= 2) { hud.callArt(['multi-deflect', 'x' + Math.min(8, n)]); G.hitstop = Math.max(G.hitstop, Math.min(0.15, 0.05 * n)); G.shake = Math.max(G.shake, 0.3); }
}
// 0.4.0 (g2-c): galaxy 2's creatures are FREED, not killed: the graft cracks, pearl motes, `g2-graft-crack` and FREED!. A
// kind says so with `freed: true` (every g2- enemy is freed unless it says `freed: false`); score and GREED are the same.
const isFreed = (e) => !!(e.kind && (e.kind.freed ?? (e.kind.role === 'enemy' && /^g2-/.test(e.kind.name))));
function onKill(e, byShot) {
  const z = e.z, freed = isFreed(e);
  if (freed) {
    fx.burst(e.x, e.y, z, Math.round(54 * quality.particleScale), { speed: 16, life: 0.9, s0: 1.6, r: 0.9, g: 1, b: 0.94, carry: 1, drag: 1.6 });
    fx.burst(e.x, e.y, z, Math.round(18 * quality.particleScale), { speed: 7, life: 0.7, s0: 2.8, r: 0.75, g: 0.95, b: 0.85, carry: 1, drag: 2.5 });
    audio.play('g2-graft-crack', { pan: e.x / box.x * 0.6 });
  } else {
  fx.burst(e.x, e.y, z, Math.round(60 * quality.particleScale), { speed: 22, life: 0.8, s0: 2, r: 1, g: 0.6, b: 0.25, carry: 1, drag: 1.5 });
  fx.burst(e.x, e.y, z, Math.round(24 * quality.particleScale), { speed: 10, life: 0.6, s0: 3.5, r: 1, g: 0.95, b: 0.8, carry: 1, drag: 3 });
  audio.play('boom', { pan: e.x / box.x * 0.6 });
  }
  if (!byShot) return;
  G.kills++;
  gain(((e.kind && e.kind.killPts) ?? T.killPts) * G.mult, e.x, e.y + 2, z, 'big', freed ? 'FREED' : 'KILL');
  addGreed(15);
  if (freed) callText('FREED!', 'c-cyan'); else hud.call(G.rollDeflects >= 2 ? 'RETURN TO SENDER!' : 'DEFLECT KILL!', 'c-cyan');
  G.hitstop = Math.max(G.hitstop, 0.08); G.shake = Math.max(G.shake, 0.45);
}
function onFired(s) {
  const far = clamp(1 - (-s.z) / 400, 0.25, 1);
  audio.play('fire', { vol: far, pan: s.x / box.x * 0.6, rate: 0.95 + Math.random() * 0.1 });
  // the human pass (Evrtek 11-06: "more of a visual warning when incoming weapons fire is coming"): every shot leaves
  // its shooter with a red flash at the muzzle, whoever fired it, on top of each shooter's own charge-up glow
  fx.burst(s.x, s.y, s.z, Math.round(9 * quality.particleScale), { speed: 3.5, life: 0.26, s0: 2.8, r: 1, g: 0.3, b: 0.38, carry: s.carry ? 1 : 0.5, drag: 2 });
}
// 0.4.0: lit by the game itself (a boss's call: `api.game.greedStart()`), whatever the meter holds. greedStart(secs) longer than GREED's own
// time holds it lit that long (g3-c: the High Roller's ALL IN): the bar stays full, then drains over the last stretch
function greedStart(secs) {
  if (G.greedOn || G.state !== 'play') return false;
  G.greed = 100; greedGo(); if (secs) G.greedT = secs; return true;
}
function greedGo() {
  if (G.greed < 100 || G.greedOn || G.state !== 'play') return;
  G.greedOn = true; G.greedT = T.greedTime;
  hud.callArt(['greed']); G.hitstop = 0.12; G.fovKick = 1; G.shake = 0.5;
  audio.play('reward', { rate: 0.8 }); audio.musicLevel(1.12);
  document.body.classList.add('hot');
}

// The game API every kind, scenery piece and boss calls (api.game). The named rules above are level 1's; the
// generic calls below let a new kind score its own way without touching this file.
const GAME = {
  ring: onRing, missRing: onMiss, crash: onCrash, scrape: onScrape, gate: onGate, gateFrame: (e) => onCrash(e, 14, true),
  checkpoint: onCheckpoint, checkpointMiss: onCheckpointMiss,
  shot: onShot, graze: onGraze, deflect: onDeflect, kill: onKill, fired: onFired,
  telegraph: () => {}, mineArm: () => {},
  // 0.6.0: a thing announces itself the first time (0.6.2: only a boss's dropped Shield Cell still does: js/tutorials.js)
  tip: (id) => tips.event(id),
  minePop: (m, z) => { audio.play('fire', { rate: 0.7, vol: 0.8, pan: m.x / box.x * 0.6 }); fx.burst(m.x, m.y, z, 14, { speed: 8, life: 0.4, s0: 1.4, r: 1, g: 0.3, b: 0.3, carry: 1 }); },
  warn: (side, t) => hud.warn(side, t),
  // generic
  score: (base, x, y, z, cls, label) => gain(base, x, y, z, cls, label),
  pop: (text, x, y, z, cls) => { const [sx, sy] = screenOf(x, y, z); hud.pop(text, sx, sy, cls); },
  // 0.6.3: damage that does not come through crash() (Phase cannot pass it: blasts, beams, pulses) costs a shot's step unless
  // the caller says otherwise (drop: Mult.DROP.crash for a solid thing)
  greed: addGreed, heal, damage: (dmg, big, drop) => damage(dmg, big, drop ?? Mult.DROP.shot),
  // 0.4.0: a slow DRAIN (a leech's tether): shield away by n x the level's dmg ease, and nothing else: no hit counted, no
  // combo step, no invulnerability, no flash. Only an empty shield ends the run (g2-b).
  drain: (n) => { if (G.state !== 'play' || G.god) return; G.shield -= n * level.ease.dmg; G.drained = (G.drained || 0) + n * level.ease.dmg; if (G.shield <= 0) die(); },
  // 0.6.3: chain(n) is n rings in a row toward the next step; stepDown() is a shot's step off, for damage dealt another way
  chain: (n) => addRings(n), stepDown: () => Mult.drop(G, Mult.DROP.shot),
  // a speed burst (boost rings): mul for secs, stacking by refreshing
  // 0.4.0: { quiet: true } is the same burst without the FOV kick and the shake (a current's ride, not a boost chain)
  boost: (secs, mul = 1.4, o = {}) => { G.boostT = Math.max(G.boostT, secs); G.boostMul = mul; if (!o.quiet) { G.fovKick = 1; G.shake = Math.max(G.shake, 0.4); } },
  // 0.4.0: a FLOW, the speed of the ride this frame (x1.15 inside Tideway's current): call it every frame it holds; it eases
  // in and out, never kicks, and stacks under a boost and GREED (the strongest flow of the frame wins)
  flow: (mul) => { G.flowWant = Math.max(G.flowWant || 1, mul || 1); },
  // 0.4.0: a call-out Yori has lettered (PARRY!, SHOAL!, KEYED!, CALF SAFE ...: art/<name>-glow.png) shows as her art
  call: (text, cls) => callText(text, cls), callArt: (names, sub) => hud.callArt(names, sub), banner: (a, b) => hud.showBanner(a, b),
  shake: (n) => { G.shake = Math.max(G.shake, n); }, hitstop: (t) => { G.hitstop = Math.max(G.hitstop, t); }, flash: () => hud.flash(),
  sfx: (name, o) => audio.play(name, o), burst: (x, y, z, n, o) => fx.burst(x, y, z, Math.round(n * quality.particleScale), o), emit: (x, y, z, o) => fx.emit(x, y, z, o),
  bonus: (label, pts) => G.bonuses.push([label, pts]),
  // ---- 0.4.0 (galaxies 2 and 3; LEVEL-API section 12)
  powerup: (id, e) => powerup(id, e),
  // a roll answered something that is not a shot (a pulse's PARRY!, a tether's SNAPPED!, an INTERCEPT!): it counts as a
  // deflect (style, MULTI-DEFLECT, GREED) and, given a target, sends a cyan echo home at it
  counter: (o = {}) => counter(o),
  greedStart: (secs) => greedStart(secs),
  bossFreed: (d) => bossFreed(d),
  phased: (e) => phased(e),
  get phasing() { return !!ship.phasing; }, get slow() { return G.timeScale; },
  boss: (o) => hud.boss(o),
  bossEnd: (beaten) => bossEnd(beaten),
  finish: () => finish(true),
  get mult() { return G.mult; }, get rolling() { return G.rolling; }, get greedOn() { return G.greedOn; }, get G() { return G; },
};
function counter(o) {
  const x = o.x ?? ship.x, y = o.y ?? ship.y, z = o.z ?? 0;
  G.deflects++; G.rollDeflects++; G.counters++;
  if (!Progress.tip('roll')) Progress.setTip('roll');
  tips.deflected();
  const n = G.rollDeflects; G.multiMax = Math.max(G.multiMax, n);
  gain((o.pts ?? T.deflectPts) * G.mult * n, x, y + 1.4, z, 'cyan', o.label ? o.label.replace(/!$/, '') : 'DEFLECT');
  addGreed(o.greed ?? 8);
  audio.play(o.sfx || 'deflect', { rate: 1 + (n - 1) * 0.06, gap: 0.02 });
  if (G.pu.mirror) audio.play('pu-mirror-ping', { gap: 0.03 });
  fx.burst(x, y, z - 0.5, Math.round(16 * quality.particleScale), { speed: 14, life: 0.3, s0: 0.8, r: 0.5, g: 0.95, b: 1, carry: 0 });
  if (o.label) callText(o.label, 'c-cyan');
  if (o.shake) G.shake = Math.max(G.shake, o.shake);
  if (n >= 2) { hud.callArt(['multi-deflect', 'x' + Math.min(8, n)]); G.hitstop = Math.max(G.hitstop, Math.min(0.15, 0.05 * n)); }
  return o.target ? course.echo(o.target, o.from) : null;
}

// ---------------------------------------------------------------- the api handed to kinds
const api = {
  THREE, scene, glowTex: backdrop.glowTex, box, ship, G, game: GAME, v: 0, dt: 0, time: 0, focalPx: 600, level: null,
  music: audio.view, // read-only: position() (seconds into the file), toNextBar(), meta (bpm, firstBeat, barSec, sections), track
  get tier() { return quality.tier; },
  // the level's ease (levels.js EASE): kinds read ring (catch radius) and course.fire reads shot
  get ease() { return level ? level.ease : easeOf(0); },
  // ...and its roll-or-hit fire (levels.js FIRE): course.fire turns some aimed volleys into nets
  get netFire() { return level ? level.fire : null; },
  appear,
  // place e.obj at (e.x, e.y, e.z), sized (e.sx, e.sy, e.sz) x e.appear: call it every frame in update()
  pose(e) { const o = e.obj, a = e.appear; o.position.set(e.x, e.y, e.z); o.scale.set(e.sx * a, e.sy * a, e.sz * a); },
  fire: (from, tx, ty, o) => course.fire(from, tx, ty, o),
  // read-only (lv-9): the ship's world matrix (its body, with bank and roll) and the camera
  get shipMatrix() { S.body.updateMatrixWorld(); return S.body.matrixWorld; }, get camera() { return camera; },
  kill: (e, byShot) => course.kill(e, byShot),
  spawn: (ev, z) => course.spawn(ev, z),
  // ---- 0.4.0 (LEVEL-API section 12)
  // a drift on the ship THIS frame, in m/s (a current, a well's pull, the Whirlmaw's inhale, a leech's drag): call it
  // every frame it acts. Pushes add up; the ship drifts with them and eases back to the player's own line after.
  push(vx, vy) { G.pushX += vx || 0; G.pushY += vy || 0; },
  // a function that bends every shot in flight this frame: fn(s, dt) changes s.vx/vy/vz, returns true if it bent it
  field: (fn) => course.field(fn),
  // a cyan shot from the ship (or `from`) that homes on target: what a roll answering a pulse or a tether sends home
  echo: (target, from) => course.echo(target, from),
  // a screen-space lens (a gravity well's warp): call every frame; the high tier draws up to four, lower tiers none
  lens: (x, y, z, r, k) => lensAt(x, y, z, r, k),
  get galaxy() { return level ? level.g : 1; },
  get shield() { return G.shield; }, // 0.6.1: the boss framework's Hail Mary cell (boss.js midCell)
  get magnetR() { return G.pu && G.pu.magnet ? POWERUPS.magnet.reach : 0; },
  get phasing() { return !!ship.phasing; },
  get timeScale() { return G.timeScale ?? 1; },
  // how many of a big instanced set (a flock) to draw on this device: n on the high tier, fewer below
  tierCount: (n) => Math.max(1, Math.round(n * [0.35, 0.65, 1][quality.tier])),
};
const LENS = [], tmpL = new THREE.Vector3();
function lensAt(x, y, z, r, k) {
  if (LENS.length >= 4 || !quality.bloom) return;
  tmpL.set(x, y, z).applyMatrix4(camera.matrixWorldInverse); const d = -tmpL.z; if (d < 1) return;
  tmpL.set(x, y, z).project(camera); if (Math.abs(tmpL.x) > 1.4 || Math.abs(tmpL.y) > 1.4) return;
  // centre in screen uv, radius as a share of the screen height, strength
  LENS.push([tmpL.x * 0.5 + 0.5, tmpL.y * 0.5 + 0.5, r * api.focalPx / d / Math.max(1, post.h || window.innerHeight), k ?? 0.25]);
}
const course = new Course(api);
const scenery = new Scenery(api);
course.use([bossKind, weakPointKind]);
// 0.4.0: the explanations (js/tutorials.js; 0.6.2: the roll, GREED and the power-ups). A thing counts as in view when it is in front of the camera and on the screen.
const tmpTip = new THREE.Vector3();
const onScreen = (x, y, z) => { tmpTip.set(x, y, z).project(camera); return tmpTip.z < 1 && Math.abs(tmpTip.x) < 1.1 && Math.abs(tmpTip.y) < 1.1; };
const tips = new Tips({ hud, input, Progress, G, ship, onScreen });
window.__sw.course = course; window.__sw.scenery = scenery; window.__sw.api = api; window.__sw.tips = tips;
resize();
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- loading a level
// Everything a level needs before its first frame: its module, its skies, its music, its shaders.
// prepare(n, progress, opts) is galaxy 1's level n (as 0.3); prepare(g, n, progress, opts) any galaxy's (0.4.0).
// opts: the run's start (a dev jump into a section or the boss opens on that part's music) (0.3.1)
async function prepare(a, b, c, d) {
  const two = typeof b === 'function' || b === undefined, g = two ? 1 : a, n = two ? a : b, progress = (two ? b : c) || (() => {}), opts = (two ? c : d) || {};
  const L = await loadLevel(g, n);
  progress(0.1, 'COURSE');
  const art = levelArt(L.n, L.g); if (art) { const im = new Image(); im.src = 'art/' + art + '.png?v=' + VERSION; im.decode?.().catch(() => {}); } // its opening banner's lettering, fetched now
  if (level !== L) {
    // 0.3.1: the music first, so its first stretch comes in while the skies and shaders are made. Only that stretch of
    // the track the run opens on is waited for; the rest streams in behind it (the boot waits for none of it: start()
    // does, if the player is quicker than the line).
    const music = audio.useLevel(L, null, openingOf(L, opts));
    await backdrop.prepare(L, renderer, (k) => progress(0.1 + 0.5 * k, 'SKIES'));
    course.use(L.kinds.concat([bossKind, weakPointKind]));
    level = L; api.level = L; window.__sw.level = L;
    const sec = L.sections[0];
    backdrop.setLook(sec.look || sec.id, true);
    scenery.setLevel(L, sec, true);
    progress(0.85, 'SHADERS');
    await compile();
    if (!opts.musicLater) { progress(0.92, 'MUSIC'); await music; }
  }
  progress(1, 'READY');
  return L;
}
function compile() {
  const packUp = course.warmup();
  return new Promise((done) => {
    const fin = () => { packUp(); done(); };
    if (renderer.compileAsync) renderer.compileAsync(scene, camera).then(fin, () => { renderer.compile(scene, camera); fin(); });
    else { renderer.compile(scene, camera); fin(); }
  });
}

// opts: { section: id, boss: true } jump in (dev menu); a dev run never writes progress
// 0.6.0: { checkpoint: true } starts again from the checkpoint this level's last run took (G.cp), with what it kept
function newRun(opts = {}, fromTitle = false) {
  const L = level;
  const cp = opts.checkpoint && G.cp && G.cp.n === L.n && G.cp.g === (L.g || 1) ? G.cp : null;
  let startD = 0;
  if (cp) startD = cp.d + 0.5;
  if (opts.section) { const s = L.sections.find((q) => q.id === opts.section); if (s) startD = s.d0; }
  if (opts.boss && L.boss) startD = Math.max(0, L.boss.at - 400);
  Object.assign(G, {
    state: 'play', time: 0, dist: 0, courseD: startD, v: L.speed(startD), vMul: 1, evL: 0, evN: 0, hold: false,
    score: 0, chain: 0, pips: 0, mult: 1, bestMult: 1, bestChain: 0, ringsGot: 0, ringsMissed: 0,
    shield: 100, greed: 0, greedOn: false, greedT: 0, greedReadyT: 0, boostT: 0, boostMul: 1, boostK: 0,
    rolling: false, rollT: 0, rollDir: 1, rollCool: 0, rollCoolMax: T.rollCool, rollDeflects: 0, rolls: 0,
    hits: 0, grazes: 0, deflects: 0, kills: 0, multiMax: 0, gates: 0, scrapes: 0, bonuses: [], bossBeaten: false,
    secGot: {}, secMiss: {}, perfect: [], section: L.sectionAt(startD).id, hitstop: 0, shake: 0, fovKick: 0, endT: 0, cleared: false,
    jumped: cp ? !!cp.jumped : startD > 0, devRun: G.dev, cp, restarts: 0,
    // 0.4.0: power-ups (timers on the player's time), caches, Slipstream's world time, the push on the ship
    pu: {}, puGot: {}, puTaken: 0, shieldGlow: 0, cachesGot: 0, counters: 0, phasedN: 0, phasedIds: new Set(), cacheCallT: -9, phasedCallT: -9,
    timeScale: 1, wtime: 0, slip: null, snapDebt: 0, snapK: 1, pushX: 0, pushY: 0, driftX: 0, driftY: 0, g: L.g || 1, flowK: 1, flowWant: 1,
  });
  if (cp) {
    // from the checkpoint: everything it kept, a full shield, the multiplier at x1 (chain and pips 0, set above), safe for a moment
    Object.assign(G, cp.keep, { secGot: Object.assign({}, cp.secGot), secMiss: Object.assign({}, cp.secMiss), perfect: cp.perfect.slice(), bonuses: cp.bonuses.map((b) => b.slice()), puGot: Object.assign({}, cp.puGot),
      greed: cp.greed, shield: T.restartShield, restarts: (cp.restarts = (cp.restarts || 0) + 1) });
  }
  G.noPowerups = !!G.noPowerupsForced; // the human bot's 'power-ups ignored' run (?test&nopu)
  ship.deflectR = undefined; ship.phasing = false;
  audio.slip(false, 0);
  G.god = G.godForced || (G.dev && G.devGod);
  // skip what lies behind the start; the section banner of a jumped-to section still shows
  G.evL = L.line.findIndex((e) => (cp ? e.d > startD : e.d - startD > -5)); if (G.evL < 0) G.evL = L.line.length; // (from a checkpoint: nothing behind it comes back)
  G.evN = L.now.findIndex((e) => (e.at ?? e.d) >= startD - (e.type === 'banner' ? 15 : 0)); if (G.evN < 0) G.evN = L.now.length;
  Object.assign(ship, { x: 0, y: -0.3, vx: 0, vy: 0, rolling: false, invuln: cp ? T.restartInvuln : 0 });
  S.root.visible = true;
  const sec = L.sectionAt(startD);
  // the title's scenery carries straight into a run from the start of the same level; anything else is a cut
  const seamless = fromTitle && !startD && scenery.level === L;
  G.cutStart = !seamless;
  // every start opens out of a short fade from black onto its opening already in place (the launcher is opaque, so
  // even a start from it is a cut; and nothing ever grows in as play begins)
  document.getElementById('cut').animate([{ opacity: 1 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: 450, easing: 'ease-out', fill: 'forwards' });
  course.reset(seamless); fx.clear(); hud.reset(); input.reset(); hud.boss({ show: false }); tips.reset();
  if (!seamless) scenery.setLevel(L, sec, true);
  backdrop.setLook(sec.look || sec.id, true);
  quality.resetWindow();
  document.body.classList.remove('hot');
  hud.setDev(G.dev);
}

// ---------------------------------------------------------------- the power-ups (0.4.0; the plan's section 6)
// Fly into one and it fires at once; never stored. Different ones run together; the same one again resets it to full
// time, except Slipstream (a second inside the first does nothing). Every timer here runs on the PLAYER's time.
const callArtOr = (art, text, cls) => (hud.hasArt(art) ? hud.callArt([art]) : hud.call(text, cls));
// her lettering for a call-out by its words: 'CALF SAFE' -> calf-safe, 'PARRY!' -> parry
const callText = (text, cls) => callArtOr(String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), text, cls);
function powerup(id, e) {
  const P = POWERUPS[id];
  if (!P || G.state !== 'play' || G.noPowerups) return false;
  if (id === 'slip') { if (G.slip) return false; slipStart(); }
  else if (id === 'shield') { healAlways(P.heal); G.shieldGlow = P.glow; hud.cell(P.glow); }
  else { G.pu[id] = { t: P.secs, max: P.secs, ticks: 0 }; if (id === 'overclock' && G.rollCool > P.rollCool) { G.rollCool = P.rollCool; G.rollCoolMax = P.rollCool; } }
  G.puTaken++; G.puGot[id] = (G.puGot[id] || 0) + 1;
  callArtOr(P.kind, P.name, 'c-pu c-pu-' + id); // Yori's call-out (art/<kind>-glow.png), else the name in its colour
  audio.play('pu-' + id);
  const c = new THREE.Color(P.color), x = e ? e.x : ship.x, y = e ? e.y : ship.y;
  fx.burst(x, y, 0, Math.round(34 * quality.particleScale), { speed: 11, life: 0.55, s0: 1.1, r: c.r, g: c.g, b: c.b, carry: 1, flatZ: 0.3 });
  return true;
}
// SLIPSTREAM: about four seconds of the world at half speed, rounded to end on a bar line of the music, with a 0.25 s
// ease at each end. The track never slows (a whole take); it takes a muffled dip instead, from the nearest beat to that
// bar line (the MCP's default 5; audio.slip). Then the SNAP-BACK: real speed, x1.4, until the course has won back the
// distance the slow-down cost it, so it is back on the music within about nine seconds.
function slipStart() {
  const P = POWERUPS.slip, meta = audio.music && audio.music.meta, bar = meta ? (meta.barSec || 240 / (meta.bpm || 140)) : 0;
  let dur = P.secs;
  if (bar) { const toBar = audio.toNextBar(); dur = toBar + Math.max(0, Math.round((P.secs - toBar) / bar)) * bar; if (dur < 2.4) dur += bar; }
  G.slip = { t: 0, dur };
  G.pu.slip = { t: dur, max: dur, ticks: 0 };
  audio.slip(true, dur);
  document.body.classList.add('slip');
}
function slipTick(dt) {
  const P = POWERUPS.slip, q = G.slip;
  if (!q) { G.timeScale = 1; return; }
  q.t += dt;
  const e = P.ease, k = q.t < e ? q.t / e : q.t > q.dur - e ? Math.max(0, q.dur - q.t) / e : 1, sm = k * k * (3 - 2 * k);
  G.timeScale = 1 - (1 - P.scale) * sm;
  if (q.t >= q.dur) { G.slip = null; G.timeScale = 1; document.body.classList.remove('slip'); audio.play('pu-slip-out'); }
}
function powerupTick(dt) {
  for (const id of Object.keys(G.pu)) {
    const q = G.pu[id]; q.t -= dt;
    // the last second: the icon flashes and three ticks play (one shared sound)
    const tk = q.t < 1 ? Math.min(3, Math.floor((1 - Math.max(0, q.t)) * 3) + 1) : 0;
    if (tk > q.ticks) { q.ticks = tk; audio.play('pu-tick', { gap: 0.1 }); }
    if (q.t <= 0) delete G.pu[id];
  }
  G.shieldGlow = Math.max(0, G.shieldGlow - dt);
  ship.deflectR = G.pu.mirror ? DEFLECT_R * POWERUPS.mirror.reach : undefined;
  ship.phasing = !!G.pu.phase;
  if (!ship.phasing && G.phasedIds.size) G.phasedIds.clear();
}

// ---------------------------------------------------------------- the boss
// 0.4.0 (g2-c): a galaxy 2 boss is FREED, not destroyed (defeatStyle: 'freed'; every galaxy 2 boss unless it says defeatStyle: 'down')
const bossFreed = (d) => (d.defeatStyle === 'freed' || d.defeatStyle === 'down' ? d.defeatStyle === 'freed' : (level && level.g === 2));
function bossStart() {
  G.hold = true;
  course.spawn({ type: 'boss-body', def: level.boss.def }, -800);
  if (level.bossMusic) audio.switchTrack(level.bossMusic);
}
function bossEnd(beaten) {
  hud.boss({ show: false });
  G.hold = false;
  if (beaten) { G.bossBeaten = true; const d = level.boss.def, b = d.bonus ?? 50000; G.bonuses.push([(d.title || 'BOSS') + (bossFreed(d) ? ' FREED' : ' DOWN'), b]); }
  if ((level.boss.then || 'finish') === 'finish') finish(true);
}

// ---------------------------------------------------------------- the roll
function tryRoll(req) {
  if (G.state !== 'play' || G.rolling || G.rollCool > 0) return;
  let dir = req.dir;
  if (!dir) dir = Math.abs(ship.vx) > 2 ? Math.sign(ship.vx) : (req.hint || (input.tx < -0.05 ? -1 : 1));
  G.rolling = true; ship.rolling = true; G.rollT = 0; G.rollDir = dir; G.rollDeflects = 0; G.rolls++;
  ship.vx += dir * T.rollDash;
  audio.play('roll', { pan: dir * 0.4 });
}

// ---------------------------------------------------------------- end of run
function die() {
  if (G.state !== 'play') return;
  G.state = 'dying'; G.endT = 0; tips.reset();
  fx.burst(ship.x, ship.y, 0, 120, { speed: 20, life: 1.2, s0: 2, r: 1, g: 0.5, b: 0.2, carry: 0.3, drag: 1.2 });
  fx.burst(ship.x, ship.y, 0, 50, { speed: 8, life: 1.4, s0: 4, r: 1, g: 0.9, b: 0.7, carry: 0.3, drag: 2 });
  S.root.visible = false;
  audio.play('boom'); audio.play('over'); audio.stopMusic(1.6);
  document.body.classList.remove('hot');
}
function finish(cleared) {
  if (G.state !== 'play') return;
  G.cleared = cleared; G.state = 'clear'; G.endT = 0; tips.reset();
  hud.callArt(['level-clear']);
  audio.play('over', { rate: 1.25, vol: 0.8 }); audio.stopMusic(2.5);
}
function tally() {
  const rows = [], bonus = [];
  let total = G.score;
  for (const s of level.sections) {
    const want = level.ringTotals[s.id] || 0;
    if (want && (G.secGot[s.id] || 0) >= want) { total += T.perfectBonus; bonus.push(['PERFECT ' + s.sub, T.perfectBonus]); }
  }
  for (const [a, b] of G.bonuses) { total += b; bonus.push([a, b]); }
  if (G.cleared && G.hits === 0 && !G.restarts) { total += T.noHitBonus; bonus.push(['NO-HIT RUN', T.noHitBonus]); } // (0.6.0: never on a run restarted from its checkpoint)
  if (G.cleared) { const b = Math.round(Math.max(0, G.shield) * T.shieldBonus); total += b; bonus.push(['SHIELD LEFT', b]); }
  // 0.6.0: stars and rank come from the TOTAL and nothing else (Evrtek 11-10; levels.js STAR_SCORES)
  const run = { score: G.score, total, rings: G.ringsGot, ringTotal: level.ringTotal, grazes: G.grazes, scrapes: G.scrapes, deflects: G.deflects, kills: G.kills,
    hits: G.hits, dist: Math.round(G.dist), time: Math.round(G.time * 10) / 10, cleared: G.cleared, bestMult: G.bestMult, multiMax: G.multiMax, level: level.n, dev: G.devRun || G.jumped,
    g: level.g, caches: G.cachesGot, cacheTotal: level.cacheTotal, powerups: G.puTaken, puGot: Object.assign({}, G.puGot), counters: G.counters, phased: G.phasedN,
    restarts: G.restarts || 0, checkpoint: !!G.cp };
  const st = grade(run, level.n, level.g), rank = st.rank;
  run.rank = rank;
  // a level 10 finished: GALAXY CLEAR, and the next galaxy opens (the plan's section 2). Worked out before saving.
  const last = level.n === catalogueOf(level.g).length, nextG = galaxy(level.g + 1);
  G.galaxyClear = G.cleared && last ? { g: level.g, next: nextG ? nextG.g : null, opened: !!nextG && !Progress.galaxyOpen(nextG.g) && !run.dev, final: !nextG && !run.dev } : null;
  // dev runs and jumped-in runs never write anything
  const best0 = Progress.get(level.g, level.n);
  const saved = run.dev ? { isNew: false, after: best0, newStars: false } : Progress.save(level.g, level.n, run, st.stars);
  rows.push(['SCORE', fmt(G.score)]);
  rows.push(['RINGS', G.ringsGot + ' / ' + level.ringTotal]);
  if (level.cacheTotal) rows.push(['CACHES', G.cachesGot + ' / ' + level.cacheTotal]); // extras: never part of a star
  rows.push(['GRAZES', G.grazes]);
  rows.push(['CLOSE CALLS', G.scrapes]);
  rows.push(['DEFLECTS', G.deflects + (G.multiMax > 1 ? '  (best x' + G.multiMax + ')' : '')]);
  rows.push(['KILLS', G.kills]);
  rows.push(['BEST COMBO', 'x' + G.bestMult + '  (' + G.bestChain + ' chain)']);
  rows.push(['DISTANCE', (G.dist / 1000).toFixed(2) + ' km']);
  if (G.restarts) rows.push(['RESTARTS', String(G.restarts)]);
  const tb = $('tally'); tb.innerHTML = '';
  const tr = (a, b, cls) => { const r = document.createElement('tr'); if (cls) r.className = cls; const x = document.createElement('td'), y = document.createElement('td'); x.textContent = a; y.textContent = b; r.append(x, y); tb.appendChild(r); };
  for (const [a, b] of rows) tr(a, b);
  for (const [a, b] of bonus) tr(a, '+' + fmt(b), 'bonus');
  tr('TOTAL', fmt(total), 'total');
  // rule 34: the next rank's need is the line under the stars (ui.showStars), in words: what this run lacked for it
  tr('BEST', fmt(Math.max(total, saved.after.score)) + (saved.after.rank && !saved.isNew ? '  ' + saved.after.rank : ''), '');
  $('end-head').textContent = G.galaxyClear ? 'GALAXY CLEAR' : G.cleared ? 'SECTOR CLEAR' : 'SHIELD DOWN';
  $('end-head').classList.toggle('clear', G.cleared);
  // Yori's rank letters; a clear with one star (or no clear) has no letter
  const rk = $('end-rank'); rk.className = 'rank r-' + (rank || 'none'); rk.hidden = !rank;
  const ri = $('end-rank-img'); if (rank) { ri.src = artUrl('rank-' + rank.toLowerCase()); ri.alt = 'RANK ' + rank; }
  $('end-nohit').hidden = !(G.cleared && G.hits === 0 && !G.restarts);
  $('end-new').hidden = !saved.isNew;
  ui.showStars(st, saved, run.dev);
  G.total = total; G.rank = rank;
  window.__sw.lastRun = Object.assign(run, { stars: st.stars, hint: st.next, saved: !run.dev });
}
function showEnd() {
  tally();
  G.state = 'end'; hud.show(false); input.enabled = false;
  // 0.6.0: a run that went down after its checkpoint may start again from there (the card says what that keeps)
  ui.endScreen(level, G.cleared, G.galaxyClear, !G.cleared && G.cp ? { score: G.cp.keep.score } : null);
  menuMusic();
  prefetchNext();
}

// ---------------------------------------------------------------- the roll
// 0.6.2 (Evrtek 11-11): the staged roll lesson of 0.3.0 and 0.6.0 is gone (its pod, the world slowing and then stopping on
// the moment, its plate over the top of the screen). The roll is taught by js/tutorials.js's INCOMING line on the first
// real shots, timed so a roll begun when it appears meets the shot. Nothing stops the world for it.

// the player changed how they play (a touch, or a key or the mouse): every control text follows (the next INCOMING line too)
input.onMode = (m) => {
  document.body.classList.toggle('touch', m === 'touch');
  if (ui) ui.controlsChanged();
};
input.onBinds = () => { if (ui) ui.controlsChanged(); };

// ---------------------------------------------------------------- incoming fire, off the screen
// 0.3.0 (Evrtek 11-06): a shot that will cross your plane close to you and that you cannot see (off the edge of the
// screen, or behind the camera) gets a red marker on the screen's edge, pointing at it, brighter as it gets close.
// Shots on screen speak for themselves (their shooter's charge, the muzzle flash, the bigger shot and its trail).
const tmpT = new THREE.Vector3();
function threats() {
  const out = [];
  for (const s of course.shots) {
    if (s.reflected) continue;
    const vz = s.vz + (s.carry ? G.v : 0); if (vz <= 0) continue;
    const t = -s.z / vz; if (!(t > 0 && t < 2.2)) continue;
    if (Math.hypot(s.x + s.vx * t - ship.x, s.y + s.vy * t - ship.y) > 3.2) continue;
    tmpT.set(s.x, s.y, s.z).project(camera);
    const behind = tmpT.z > 1;
    let nx = tmpT.x, ny = tmpT.y; if (behind) { nx = -nx; ny = -ny; }
    if (!behind && Math.abs(nx) < 0.97 && Math.abs(ny) < 0.97) continue;
    out.push({ nx, ny, t });
  }
  out.sort((a, b) => a.t - b.t);
  return out.slice(0, 6);
}
// Yori's lettering of a level's name (the level select's), for its opening banner
function levelArt(n, g = 1) {
  const c = entryOf(g, n); if (!c) return null;
  if (g === 1) return 'ui/name-' + (c.art || String(c.n).padStart(2, '0'));
  // galaxies 2 and 3: art/ui/g<G>/name-NN.png, once the galaxy's entry says her lettering is in (levels.js GALAXIES has.names)
  return galaxy(g).has.names ? 'ui/g' + g + '/name-' + String(n).padStart(2, '0') : null;
}

// ---------------------------------------------------------------- the frame
function sectionT() { const s = level.sectionAt(G.courseD); return clamp((G.courseD - s.d0) / (s.d1 - s.d0), 0, 1); }
function step(dt) {
  G.time += dt;
  // 0.4.0: two clocks. dt is the PLAYER's (steering, the roll and its recharge, GREED, power-up timers); wdt is the
  // WORLD's (the course, enemies, shots, hazards, a boss's clock), which SLIPSTREAM runs at half speed.
  slipTick(dt);
  const wdt = dt * G.timeScale;
  G.wtime += wdt;
  // speed: the level's curve, GREED's kick, a boost burst, the snap-back after a slipstream
  G.boostT = Math.max(0, G.boostT - wdt);
  G.boostK = damp(G.boostK, G.boostT > 0 ? 1 : 0, 6, dt);
  G.flowK = damp(G.flowK || 1, G.flowWant || 1, 4, dt); G.flowWant = 1; // 0.4.0: api.game.flow, asked again each frame
  G.vMul = damp(G.vMul, (G.greedOn ? T.greedSpeed : 1) * (G.boostT > 0 ? G.boostMul : 1) * G.flowK, 3, dt);
  G.snapK = damp(G.snapK, G.snapDebt > 0 && !G.slip ? POWERUPS.slip.snap : 1, 4, dt);
  const vBase = level.speed(G.courseD) * G.vMul;
  G.v = vBase * G.snapK;
  if (G.slip) G.snapDebt += G.v * (1 - G.timeScale) * dt; // how far behind the music the slow-down has put the course
  else if (G.snapDebt > 0) G.snapDebt = Math.max(0, G.snapDebt - vBase * (G.snapK - 1) * wdt);
  G.dist += G.v * wdt;
  if (!G.hold) G.courseD += G.v * wdt;
  G.score += G.v * wdt * 0.5 * (G.greedOn ? 2 : 1);

  const sec = level.sectionAt(G.courseD);
  if (sec.id !== G.section) {
    const prev = level.sections.find((s) => s.id === G.section);
    if (prev && (level.ringTotals[prev.id] || 0) && (G.secGot[prev.id] || 0) >= level.ringTotals[prev.id]) { hud.callArt(['perfect'], prev.sub); G.perfect.push(prev.id); }
    G.section = sec.id; backdrop.setLook(sec.look || sec.id);
    if (sec.music) audio.switchTrack(sec.music);
  }

  // spawn: everything at the spawn line (ruling 5), markers and own-motion kinds when the course reaches them
  const D = G.courseD, line = level.line, now = level.now;
  while (G.evL < line.length && line[G.evL].d - D <= level.spawnD) { const e = line[G.evL++]; course.spawn(e, -(e.d - D)); }
  while (G.evN < now.length && (now[G.evN].at ?? now[G.evN].d) <= D && G.state === 'play') {
    const e = now[G.evN++];
    if (e.type === 'banner') { const s = level.sections.find((q) => q.id === e.section); hud.showBanner(s.name, s.sub, s.d0 === 0 ? levelArt(level.n, level.g) : null); }
    else if (e.type === 'end') finish(true);
    else if (e.type === 'boss') bossStart();
    else if (e.type === 'music') audio.switchTrack(e.track, { from: e.from, loop: e.loop });
    else if (e.type === 'call') hud.call(e.text, e.cls || '');
    else if (!isMarker(e.type)) course.spawn(e, 0);
  }

  // input
  input.update(dt);
  const r = input.take('roll'); if (r) tryRoll(r);
  if (input.take('greed')) greedGo();
  // a full meter waits for the player (Evrtek 11-07: no auto-fire; the meter and the GREED! button pulse while it is ready).
  // greedAuto > 0 would bring the old timed auto-fire back.
  if (G.greed >= 100 && !G.greedOn) { G.greedReadyT += dt; if (T.greedAuto > 0 && G.greedReadyT > T.greedAuto) greedGo(); }
  if (G.greedOn) { G.greedT -= dt; G.greed = 100 * Math.min(1, Math.max(0, G.greedT) / T.greedTime); if (G.greedT <= 0) { G.greedOn = false; G.greed = 0; audio.musicLevel(1); document.body.classList.remove('hot'); } }
  powerupTick(dt);

  // flight: a critically damped spring toward the target; banking falls out of the sideways speed
  // 0.4.0: the PUSH (api.push: currents, wells, an inhale, a tether) carries the ship's line with it, on world time; once
  // nothing pushes, the line eases back to the player's own. It never takes more than three quarters of the box.
  const pushing = Math.abs(G.pushX) + Math.abs(G.pushY) > 0.01;
  G.driftX = clamp(G.driftX + G.pushX * wdt, -box.x * 0.75, box.x * 0.75); G.driftY = clamp(G.driftY + G.pushY * wdt, -box.y * 0.75, box.y * 0.75);
  if (!pushing) { const k = Math.exp(-1.2 * dt); G.driftX *= k; G.driftY *= k; }
  G.pushX = 0; G.pushY = 0;
  const tx = clamp(input.tx * box.x + G.driftX, -box.x, box.x), ty = clamp(input.ty * box.y + G.driftY, -box.y, box.y), K = T.steerK, C = 2 * Math.sqrt(K);
  ship.vx += ((tx - ship.x) * K - ship.vx * C) * dt;
  ship.vy += ((ty - ship.y) * K - ship.vy * C) * dt;
  ship.x = clamp(ship.x + ship.vx * dt, -box.x, box.x); ship.y = clamp(ship.y + ship.vy * dt, -box.y, box.y);
  if (Math.abs(ship.x) >= box.x) ship.vx *= 0.5;
  if (Math.abs(ship.y) >= box.y) ship.vy *= 0.5;

  // the roll: 0.45 s of spin; shots that meet it go home
  if (G.rolling) {
    G.rollT += dt;
    if (G.rollT >= T.rollTime) { G.rolling = false; ship.rolling = false; G.rollCool = G.pu.overclock ? POWERUPS.overclock.rollCool : T.rollCool; G.rollCoolMax = G.rollCool; if (G.rollDeflects >= 3) addGreed(10); }
  } else if (G.rollCool > 0) G.rollCool = Math.max(0, G.rollCool - dt);
  ship.invuln = Math.max(0, ship.invuln - dt);

  api.v = G.v; api.dt = wdt; api.time = G.wtime;
  course.update(wdt);
  scenery.update(wdt, G.v, sec, sectionT());
}

function shipVisual(dt, now) {
  const bank = clamp(-ship.vx * 0.075, -1.15, 1.15);
  let spin = 0;
  if (G.rolling) { const k = clamp(G.rollT / T.rollTime, 0, 1); spin = -G.rollDir * Math.PI * 2 * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2); }
  // a finished roll leaves the body a full turn (2 pi) off its bank; take the nearest equivalent angle before easing, so
  // the ship settles where it already is instead of visibly unwinding the turn backwards (Evrtek 11-07)
  const TAU = Math.PI * 2, off = S.body.rotation.z - bank;
  S.body.rotation.z = bank + (((off + Math.PI) % TAU) + TAU) % TAU - Math.PI;
  S.body.rotation.z = damp(S.body.rotation.z, bank, 10, dt);
  if (G.rolling) S.body.rotation.z = bank + spin;
  S.root.rotation.y = damp(S.root.rotation.y, -ship.vx * 0.014, 8, dt);
  S.root.rotation.x = damp(S.root.rotation.x, ship.vy * 0.03, 8, dt);
  S.root.position.set(ship.x, ship.y, 0);
  // the deflector's look lives in ship.js (ship-v2): v2 glint arcs, tip flares, a ripple and sparks; ?ship=v1 the old shell
  S.rollLook(G.rolling ? clamp(G.rollT / T.rollTime, 0, 1) : -1, dt, G.state === 'play' || G.state === 'title' ? fx : null, quality.tier);
  powerupLooks(dt, now);
  const th = clamp((G.v - 40) / 100, 0.3, 1) * (G.greedOn ? 1.4 : 1) * (1 + (G.boostK || 0) * 0.5);
  for (const e of S.engines) { const f = 0.8 + Math.random() * 0.25; e.flame.scale.set(0.8 * f + th * 0.4, 0.8 * f + th * 0.4, 1); e.flame.material.color.setHex(G.greedOn ? 0xffcc33 : 0x53e6ff); }
  S.root.visible = G.state === 'dying' || G.state === 'end' ? false : !(ship.invuln > 0 && Math.floor(now * 20) % 2 === 0);
  if (G.state === 'play' || G.state === 'title' || G.state === 'clear') {
    // ship-v3: the plume's spark budget (2 a frame on a phone tier, 3 above) is split across the engines, so the twin
    // nozzles cost what the single one did (1 and 2 each); each spark takes its engine's size
    const n = Math.max(1, Math.round((quality.tier === 0 ? 2 : 3) / S.engines.length));
    for (const e of S.engines) {
      tmpV.copy(e.local); S.body.localToWorld(tmpV);
      for (let i = 0; i < n; i++) fx.emit(tmpV.x + (Math.random() - 0.5) * 0.1, tmpV.y + (Math.random() - 0.5) * 0.1, tmpV.z + i * 0.4, {
        life: 0.3, s0: 0.3 * (e.size || 1), s1: 0.05, r: G.greedOn ? 1 : 0.35, g: G.greedOn ? 0.8 : 0.85, b: G.greedOn ? 0.2 : 1, a: 0.85, carry: 1 });
    }
  }
}

// 0.4.0: what each power-up does to the ship's look (placeholders until Yori's effects land): the Shield Cell's green
// afterglow, the Mirror Shell's chrome halo, Phase's translucent violet, the Ring Magnet's reach on the flight box
const AURA = new THREE.Color(), magnetRing = new THREE.Mesh(new THREE.RingGeometry(5.92, 6.0, 64), new THREE.MeshBasicMaterial({ color: POWERUPS.magnet.color, transparent: true, opacity: 0, depthWrite: false }));
scene.add(magnetRing);
for (const m of Object.values(S.mats)) { m.transparent = true; m.userData.op = m.opacity; }
function powerupLooks(dt, now) {
  const play = G.state === 'play', pu = (play && G.pu) || {}, glow = play ? Math.min(1, (G.shieldGlow || 0) / POWERUPS.shield.glow) : 0;
  let a = 0;
  if (glow > 0) { AURA.setHex(POWERUPS.shield.color); a = glow * 0.55; }
  else if (pu.phase) { AURA.setHex(POWERUPS.phase.color); a = 0.4 + 0.15 * Math.sin(now * 17); }
  else if (pu.mirror) { AURA.setHex(POWERUPS.mirror.color); a = 0.28 + 0.12 * Math.sin(now * 6); }
  S.aura.material.color.copy(AURA); S.aura.material.opacity = a; S.aura.rotation.y += dt * 1.3; S.aura.rotation.x += dt * 0.7;
  S.ringHalo.material.opacity = pu.mirror ? 0.55 + 0.25 * Math.sin(now * 9) : 0; S.ringHalo.rotation.z += dt * 2;
  const ph = pu.phase ? 0.42 : 1;
  for (const m of Object.values(S.mats)) { const o = m.userData.op ?? 1; m.opacity = o * ph; }
  magnetRing.position.set(ship.x, ship.y, 0); magnetRing.material.opacity = pu.magnet ? 0.22 + 0.08 * Math.sin(now * 5) : 0; magnetRing.visible = !!pu.magnet;
}
const camLook = new THREE.Vector3();
const CAM_UP = 2.8; // 9.2 back: atan(2.8 / 9.2) = 17 degrees
const tmp2 = new THREE.Vector2();
function cameraUpdate(dt) {
  const tx = ship.x * 0.62, ty = ship.y * 0.62 + CAM_UP;
  camera.position.x = damp(camera.position.x, tx, 5.5, dt);
  camera.position.y = damp(camera.position.y, ty, 5.5, dt);
  camera.position.z = 9.2;
  G.shake = Math.max(0, (G.shake || 0) - dt * 2.2);
  const sh = (G.shake || 0) * (G.shake || 0) * 0.6;
  camera.position.x += (Math.random() - 0.5) * sh; camera.position.y += (Math.random() - 0.5) * sh;
  camLook.set(ship.x * 0.85, ship.y * 0.85 - 0.6, -30);
  camera.lookAt(camLook);
  camera.rotation.z += clamp(-ship.vx * 0.006, -0.12, 0.12);
  G.fovKick = Math.max(0, (G.fovKick || 0) - dt * 1.5);
  const fov = baseFov + clamp((G.v - 62) * 0.1, 0, 9) + (G.greedOn ? 6 : 0) + (G.fovKick || 0) * 6 + (G.boostK || 0) * 5;
  if (Math.abs(camera.fov - fov) > 0.05) {
    camera.fov = damp(camera.fov, fov, 4, dt); camera.updateProjectionMatrix();
    const px = renderer.getDrawingBufferSize(tmp2).y / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    fx.layer.setScale(px); course.shotLayer.setScale(px); api.focalPx = px;
  }
}

// frame-part timings, for ?test only
const PROF = { on: params.has('test'), t: [0, 0, 0, 0], log: [] };
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (dt <= 0) return;
  const t = now / 1000;
  window.__sw.frames = (window.__sw.frames || 0) + 1;
  ui.tick(dt);
  if (!level) { post.render(scene, camera, quality.bloom, 0); return; }
  if (G.state === 'play') {
    quality.sample(dt);
    let sdt = dt;
    tips.tick(dt); // 0.6.2: the explanation line's clock (it never slows the game)
    const k = sdt / dt; // how fast the world runs this frame, for the parts that move by real time
    if (G.hitstop > 0) { G.hitstop -= dt; sdt = 0; }
    const p0 = performance.now();
    // dev speed: whole extra steps (stable), or a half step
    const reps = G.dev ? G.devSpeed : 1;
    if (sdt > 0) { if (reps < 1) step(sdt * reps); else for (let i = 0; i < reps && G.state === 'play'; i++) step(sdt); }
    if (G.state === 'play') tips.scan(course.list, course.shots, G.v); // the first shots at you, power-ups coming into view
    const p1 = performance.now();
    const ws = G.timeScale ?? 1; // Slipstream: the streaming stars slow with the world
    backdrop.update(dt, sdt > 0 ? G.v * k * ws : 0, G.dist, G.greedOn ? 1 : 0, camera, G.boostK);
    const p2 = performance.now();
    fx.update(sdt * ws, sdt > 0 ? G.v : 0);
    { const th = G.state === 'play' ? threats() : []; hud.threats(th, dt); }
    const p3 = performance.now();
    G.banked = G.score + G.perfect.length * T.perfectBonus + G.bonuses.reduce((a, b) => a + b[1], 0);
    G.star = starProgress(G.banked, level.n, level.g);
    hud.update(dt, G);
    PROF.t = [p1 - p0, p2 - p1, p3 - p2, performance.now() - p3];
  } else if (G.state === 'dying' || G.state === 'clear') {
    G.endT += dt;
    const slow = G.state === 'dying' ? 0.35 : 1;
    const v = G.state === 'dying' ? G.v * 0.3 : G.v;
    if (G.state === 'clear') { G.dist += v * dt; ship.vy += (2 - ship.y) * dt * 2; ship.y += ship.vy * dt * 0.2; if (level.outro && level.outro.update) level.outro.update(dt, api, G.endT); }
    api.v = v; api.dt = dt * slow;
    course.update(dt * slow);
    scenery.update(dt, v, level.sectionAt(G.courseD), sectionT());
    backdrop.update(dt, v, G.dist, 0, camera);
    fx.update(dt * slow, v);
    hud.threats([], dt);
    hud.update(dt, G);
    const hold = G.state === 'dying' ? 1.8 : (level.outro ? level.outro.time : 2.4);
    if (G.endT > hold) showEnd();
  } else if (G.state === 'title' || G.state === 'end' || G.state === 'loading') {
    // attract: drift down the level's opening with the ship weaving on its own
    G.v = 46; G.dist = (G.dist || 0) + G.v * dt;
    if (G.state !== 'end') { ship.x = Math.sin(t * 0.6) * 2.2; ship.y = Math.sin(t * 0.9) * 0.8 - 0.3; ship.vx = Math.cos(t * 0.6) * 1.3 * 2; ship.vy = 0; }
    api.v = G.v; api.dt = dt;
    if (G.state !== 'end') { course.update(dt); scenery.update(dt, G.v, level.sections[0], 0); }
    backdrop.update(dt, G.v, G.dist, 0, camera);
    fx.update(dt, G.v);
  }
  if (G.state !== 'paused') { shipVisual(dt, t); cameraUpdate(dt, t); audio.tick(dt); } // (11-07) the music clock runs on frames if the sound stops
  const r0 = performance.now();
  post.lens(LENS); LENS.length = 0;
  post.render(scene, camera, quality.bloom, G.greedOn ? 1 : 0);
  if (PROF.on && G.state === 'play') { const r = performance.now() - r0, tot = PROF.t.reduce((x, y) => x + y, 0) + r; if (tot > 25) PROF.log.push({ at: Math.round(G.courseD), step: +PROF.t[0].toFixed(1), back: +PROF.t[1].toFixed(1), fx: +PROF.t[2].toFixed(1), hud: +PROF.t[3].toFixed(1), render: +r.toFixed(1) }); }
}

// ---------------------------------------------------------------- the menu music (Evrtek 11-05: chill house on the menus)
// It plays on the launcher, the level select, options and the end card once the first press has unlocked audio, loops
// on its json points, and crossfades over ~1 s into a level's track as a run starts. ready: false until the sound
// CLU's audio/menu/music.{ogg,mp4,json} is on main, so the menus stay silent until then (and nothing 404s).
const MENU = { track: 'menu/music', ready: true }; // the sound CLU's take, on main at d8b2ce2
audio.pinned.add(MENU.track); // decoded once at boot and kept: every return to the menus has it ready
function menuMusic() {
  if (!MENU.ready || !audio._unlocked) return;
  if (audio.music && audio.music.name === MENU.track) return;
  audio.crossTo(MENU.track, 1.0);
}
window.__sw.menuMusic = menuMusic;

// the music in force at course distance d: the level's track, or the last section track or 'music' marker before d
function musicAt(L, d) {
  let best = L.music.track, at = -1;
  for (const s of L.sections) if (s.music && s.d0 <= d + 1 && s.d0 > at) { best = s.music; at = s.d0; }
  for (const e of L.now) if (e.type === 'music' && e.d <= d + 1 && e.d > at) { best = { track: e.track, from: e.from, loop: e.loop }; at = e.d; }
  return best;
}

// ---------------------------------------------------------------- starting and stopping
// start(n, opts): load level n (a loading screen if it is not ready), then fly it. 0.4.0: start(g, n, opts) for any
// galaxy (start(2, 5) is galaxy 2's level 5; start(5) is still galaxy 1's).
async function start(a = 1, b, c) {
  const [g, n] = typeof b === 'number' ? [a, b] : [1, a], opts = (typeof b === 'number' ? c : b) || {};
  audio.unlock();
  if (G.state === 'loading') return;
  if (window.__splash) window.__splash.end(); // 0.4.0: a run started while the splash is up (a test, a dev link) ends it at once
  if (G.state === 'boot') { ui.cancelPress(); ui.loading(false); G.state = 'title'; } // a test or a dev link starting before the press
  const was = G.state;
  G.state = 'loading';
  let fresh = false;
  ui.hideAll();
  try {
    if (!level || level.n !== n || (level.g || 1) !== g) { fresh = true; ui.loading(true, level ? (typeof n === 'number' ? levelLabel(g, n) : '') : ''); await prepare(g, n, (k, what) => ui.progress(k, what), opts); ui.loading(false); }
    // the level is ready; its opening music may not be yet (a jump into a part whose track is still coming)
    const open = openingOf(level, opts), ot = audio.tracks[open && open.track || open];
    if (open && (!ot || ot.then)) { ui.loading(true, typeof n === 'number' ? levelLabel(g, n) : ''); ui.progress(0.9, 'MUSIC'); await audio.loadTrack(open.track || open); ui.loading(false); }
  } catch (err) {
    console.warn('level ' + g + '-' + n + ' could not load', err);
    G.state = was === 'boot' ? 'title' : was; ui.loading(false); ui.toast((typeof n === 'number' ? levelLabel(g, n) : 'LEVEL ' + n) + ': COMING SOON'); ui.launcher();
    return;
  }
  // seamless only when the launcher was already showing this level's scenery; a level just loaded behind the
  // loading screen starts as a cut (a fade from black onto its opening, already in place)
  newRun(opts, was === 'title' && !fresh);
  hud.show(true); input.enabled = true;
  const track = G.cp && opts.checkpoint && G.cp.music ? G.cp.music : opts.boss && level.bossMusic ? level.bossMusic : musicAt(level, G.courseD);
  const spec = typeof track === 'object' ? track : { track };
  if (MENU.ready && audio.music && audio.music.name === MENU.track) audio.crossTo(spec.track, 1.0, spec);
  else { audio.stopMusic(0.01); audio.startMusic(spec); }
}
// the track a run of L opens on: its own, or (a dev jump) the section's or the boss's
function openingOf(L, opts = {}) {
  if (opts.boss && L.boss && L.bossMusic) return typeof L.bossMusic === 'object' ? L.bossMusic : { track: L.bossMusic };
  const s = opts.section && L.sections.find((q) => q.id === opts.section);
  const m = musicAt(L, s ? s.d0 : 0);
  return typeof m === 'object' ? m : { track: m };
}
// 0.3.1 (load times): on the result screen (never in flight: loading a level module runs its build, a hitch), the next
// level's module and the first stretch of the track it opens on, ahead of anything the finished level was still
// streaming, so NEXT LEVEL waits only for its skies and shaders.
// 0.4.0: galaxy-aware. It fetches exactly what the card's NEXT LEVEL / NEXT GALAXY button would start (ui.nextOf: the
// next in this galaxy's catalogue, or the next galaxy's first after a finale), and only when that button is showing (a
// clear, the level open), so it never asks for a level the player cannot start or one that is not in the build.
function prefetchNext() {
  if (!level || params.has('noprefetch') || ui.finalClear || ui.demoEnd || $('next-btn').hidden) return; // (0.6.0: a demo's last card has no next level to fetch)
  const nx = ui.nextOf(level); if (!nx) return;
  loadLevel(nx[0], nx[1]).then((N) => audio.loadTrack(openingOf(N).track)).catch(() => {});
}
// 0.3.1 (load times): the launcher's own backgrounds come in behind the loading screen, so the screen the press opens
// is whole at once and a quick NEW GAME does not share a slow line with them (the browser fetches a hidden screen's
// background only when it shows: 0.77 MB, measured on slow 4G). Capped, so a picture that never comes never holds the boot.
// 0.4.0 boot-menu: the menu shows the moment the studio logo goes, so its buttons come in too (the constellation, hidden,
// is #boot-old's: skipped); progress(k, step) for the logo's LOADING bar.
function preloadLauncher(ms = 30000, progress = null) {
  const urls = [], sel = BOOT_OLD ? '#title .ui-bg' : '#title .ui-bg, #title .img-btn';
  for (const el of document.querySelectorAll(sel)) {
    if (!BOOT_OLD && el.classList.contains('ui-bg') && getComputedStyle(el).display === 'none') continue;
    const m = /url\("?([^")]+)"?\)/.exec(getComputedStyle(el).backgroundImage); if (m) urls.push(m[1]);
  }
  let done = 0; const tick = () => { done++; if (progress) progress(done / urls.length, 1 / urls.length); };
  const one = (u) => new Promise((ok) => { const i = new Image(); i.onload = i.onerror = () => { tick(); ok(); }; i.src = u; });
  return Promise.race([Promise.all(urls.map(one)), new Promise((ok) => setTimeout(ok, ms))]);
}
// 0.4.0 boot-menu: the menu, opened behind the studio logo once the boot is done (the logo lifts when the menu is whole:
// index.html). No loading screen at boot, no press: the menu is silent until its first press, which unlocks the sound
// inside the gesture (iOS) and then does what it would anyway (ui.firstGesture: a tap on NEW GAME starts the run). The
// menu music starts once that press has done its work, if it left the player on the menus (not a music blip before a
// run's own track). The loading screen comes out of its parking (display: none, so its background was not fetched
// during the boot) for the level loads.
function openMenu() {
  G.state = 'title'; ui.loading(false); $('loading').classList.remove('parked'); ui.launcher();
  ui.firstGesture(() => {
    audio.unlock();
    setTimeout(() => { if (MENU.ready && G.state === 'title' && !(audio.music && audio.music.name === MENU.track)) audio.crossTo(MENU.track, 0.6); }, 0);
  });
  if (window.__splash) window.__splash.menuReady();
}
function toTitle() {
  G.state = 'title'; hud.show(false); input.enabled = false; hud.boss({ show: false }); tips.reset();
  course.reset(false); if (level) scenery.setLevel(level, level.sections[0], true); if (level) backdrop.setLook(level.sections[0].look || level.sections[0].id);
  S.root.visible = true;
  ui.launcher();
  if (MENU.ready) menuMusic(); else audio.stopMusic(0.4);
}
function pause() {
  if (G.state !== 'play') return;
  G.state = 'paused'; ui.pause(true); input.enabled = false; audio.suspend();
}
function resume() {
  if (G.state !== 'paused') return;
  ui.pause(false); G.state = 'play'; input.enabled = true; input.reset(); audio.resume(); last = performance.now(); quality.resetWindow();
  // keep the ship where it is: the steering target picks up from the ship, not from zero
  input.tx = ship.x / box.x; input.ty = ship.y / box.y;
}
// pause and music keys arrive through Input
setInterval(() => {
  if (input.take('pause')) { if (G.state === 'play') pause(); else if (G.state === 'paused') resume(); }
  if (input.take('music')) { audio.toggle('music'); ui.syncToggles(); }
}, 50);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause(); audio.suspend(); }
  else if (G.state !== 'paused') audio.resume();
});
window.addEventListener('blur', () => { if (TOUCH) pause(); });
// 0.4.0 (Tron, field fixes 11-07: "if I went away from the game and came back to it, I had no sound"): iOS Safari leaves
// its AudioContext 'suspended' or 'interrupted' after the page hides, the phone locks, or a call comes in, and starts it
// again only from a press. So the page coming back (pageshow: the back-forward cache) asks again, and so does every
// press anywhere (capture, before the game's own handlers), unless the game is paused; audio.wake is a no-op while running.
window.addEventListener('pagehide', () => { pause(); audio.suspend(); });
window.addEventListener('pageshow', () => { if (!document.hidden && G.state !== 'paused') audio.resume(); });
for (const ev of ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'keydown', 'click']) window.addEventListener(ev, () => audio.wake(true), { capture: true, passive: true });

const ui = new UI({ G, audio, hud, input, Progress, CATALOGUE, GALAXIES, start, toTitle, pause, resume, greedGo: () => greedGo(), menuMusic, touch: TOUCH, version: VERSION, params, level: () => level });
window.__sw.ui = ui;
window.__sw.backdrop = backdrop; window.__sw.prof = PROF; window.__sw.start = start; window.__sw.toTitle = toTitle; window.__sw.greedGo = greedGo; window.__sw.tryRoll = tryRoll; window.__sw.camera = camera; window.__sw.box = box;
window.__sw.prepare = prepare; window.__sw.finish = finish; window.__sw.newRun = newRun; window.__sw.THREE = THREE;
// 0.6.0: start again from the checkpoint (the end card's button; the bots)
window.__sw.retry = () => (level && G.cp ? start(level.g || 1, level.n, { checkpoint: true }) : null);

// ---------------------------------------------------------------- boot: the loading screen, then the launcher
// Evrtek (11-05): the loading screen waits for a press. When everything is ready (the sounds and the menu track
// decoded, the skies built, the shaders warm) it shows TAP TO START / PRESS ANY KEY; that press unlocks the audio
// inside the gesture itself (iOS), starts the menu track with a 0.6 s fade, and opens the launcher.
// 0.4.0: this file is started by the studio splash (index.html) once the loading screen's own pictures are in.
// 0.4.0 boot-menu: the boot's progress, for the studio logo's LOADING bar (index.html) and the loading screen's ring (the
// last resort). One sum that never goes back (the ring's old split ran the sounds and level 1 side by side, so it jumped
// about): the game's code 30% (the bar creeps through it before this runs: 6.5 s of a 13.5 s boot on slow 4G), then the
// sounds 21%, the launcher's pictures 7%, level 1 42%. Each report also says where the step in flight ends (cap), and the bar creeps inside that share while
// a big file is coming (the menu music, a sky). #boot-old: the ring exactly as before.
(async () => {
  const B = { sound: 0, soundCap: 0.12, step: 0, art: 0, artCap: 0.25, prep: 0, prepCap: 0.1 };
  const bp = (what) => {
    const k = 0.3 + 0.21 * B.sound + 0.07 * B.art + 0.42 * B.prep, cap = 0.3 + 0.21 * B.soundCap + 0.07 * B.artCap + 0.42 * B.prepCap;
    ui.progress(k, what); if (window.__splash) window.__splash.progress(k, cap);
  };
  if (BOOT_OLD) ui.loading(true, ''); else bp();
  audio.held = 2; // the boot's order on a slow line (audio.held): the menu's first stretch and the launcher's pictures
  const sound = audio.preload((k) => { if (BOOT_OLD) return ui.progress(k * 0.3, 'SOUND'); B.step = B.step || k; B.sound = k; B.soundCap = Math.min(1, k + B.step); bp('SOUND'); }, MENU.ready ? [MENU.track] : []);
  const launcherArt = preloadLauncher(30000, (k, step) => { if (BOOT_OLD) return; B.art = k; B.artCap = Math.min(1, k + step); bp(); });
  await prepare(1, (k, what) => { if (BOOT_OLD) return ui.progress(0.3 + k * 0.7, what); B.prep = k; B.prepCap = [0.1, 0.6, 0.85, 1].find((x) => x > k + 1e-6) || 1; bp(what); }, { musicLater: true });
  await sound; // the prompt never shows before the menu track is decoded, so the press always has music to start
  await launcherArt;
  // then the first stretch of the level the press starts, then the call-out sprites, then the rest (0.3.1: on a slow
  // line each took the one before's bandwidth)
  audio.held = 1;
  const art = () => hud.preloadArt().then(() => { audio.held = 0; });
  audio.loadTrack(openingOf(level).track).then(art, art);
  window.__sw.warm = true;
  if (params.has('test')) import('./testhooks.js?v=0.6.3').then((m) => m.install(window.__sw));
  if (G.state !== 'boot') return; // a test or a dev link already started a run
  if (!BOOT_OLD) { openMenu(); return; }
  ui.pressToStart(() => {
    audio.unlock();
    if (MENU.ready) audio.crossTo(MENU.track, 0.6);
    G.state = 'title';
    ui.loading(false);
    ui.launcher();
  });
})().catch((e) => { console.error(e); if (!BOOT_OLD && G.state === 'boot') openMenu(); }); // (a boot that broke: the menu anyway, never the logo for good)
requestAnimationFrame((t) => { last = t; frame(t); });
