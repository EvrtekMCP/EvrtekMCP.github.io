// STARWAKE 0.3.0: the game. Flight, the roll, the rules of scoring (ruling 4), the run of a level, the screens.
// Levels, kinds, scenery and bosses are modules (js/levels, js/pickups, js/obstacles, js/enemies, js/bosses);
// this file runs whichever level is loaded and owns every rule that scores.
import * as THREE from '../vendor/three/three.module.min.js?v=0.3.0';
import { VERSION, clamp, damp, lerp, isTouch, fmt, store } from './util.js?v=0.3.0';
import { Input } from './input.js?v=0.3.0';
import { Audio } from './audio.js?v=0.3.0';
import { buildShip } from './ship.js?v=0.3.0';
import { Backdrop } from './backdrop.js?v=0.3.0';
import { Course } from './course.js?v=0.3.0';
import { Scenery } from './scenery.js?v=0.3.0';
import { Particles } from './fx.js?v=0.3.0';
import { Hud, artUrl } from './hud.js?v=0.3.0';
import { CATALOGUE, loadLevel, isMarker, Progress, grade, easeOf } from './levels.js?v=0.3.0';
import { appear } from './space.js?v=0.3.0';
import { bossKind, weakPointKind } from './boss.js?v=0.3.0';
import { Quality } from './quality.js?v=0.3.0';
import { Post } from './post.js?v=0.3.0';
import { UI } from './ui.js?v=0.3.0';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const TOUCH = isTouch();

// ---------------------------------------------------------------- tuning (first guesses, his to tune by playing)
const T = {
  // cooldown 0.85 -> 0.65 (Evrtek 11-05) -> 0.50 (Evrtek 11-06, the human pass: "Go to a .5 delay on a new barrel
  // roll"): a roll can start every 0.95 s. Level 9's bait still bites: its ghosts lead the real shots by 0.62 s.
  rollTime: 0.45, rollCool: 0.50, rollDash: 10,
  steerK: 60,                     // spring stiffness toward the steering target
  shotDmg: 16, ringShield: 4, gateShield: 2,
  greedTime: 8, greedSpeed: 1.28, greedAuto: 4,
  ringPts: 100, gatePts: 250, deflectPts: 150, killPts: 1000, scrapePts: 80,
  perfectBonus: 5000, noHitBonus: 25000, shieldBonus: 100,
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
window.__sw = { G, ship, T, quality, input, audio, version: VERSION, CATALOGUE, Progress };

// ---------------------------------------------------------------- scoring: the rules every kind reports to
const tmpV = new THREE.Vector3();
function screenOf(x, y, z) {
  tmpV.set(x, y, z).project(camera);
  return [(tmpV.x * 0.5 + 0.5) * window.innerWidth, (-tmpV.y * 0.5 + 0.5) * window.innerHeight];
}
function multOf(chain) { return Math.min(8, 1 + Math.floor(chain / 5)); }
function gain(base, x, y, z, cls = '', label = '') {
  const pts = Math.round(base * (G.greedOn ? 2 : 1));
  G.score += pts;
  if (x !== undefined) { const [sx, sy] = screenOf(x, y, z); hud.pop((label ? label + ' ' : '') + '+' + fmt(pts), sx, sy, cls); }
  return pts;
}
function setChain(c) {
  const before = G.mult;
  G.chain = Math.max(0, c); G.mult = multOf(G.chain);
  G.bestChain = Math.max(G.bestChain, G.chain); G.bestMult = Math.max(G.bestMult, G.mult);
  if (G.mult > before) { audio.play('combo'); hud.callArt(['x' + G.mult]); }
}
function stepDown() { setChain(Math.max(0, (G.mult - 2) * 5)); }
function addGreed(n) {
  if (G.greedOn) return;
  const was = G.greed;
  G.greed = Math.min(100, G.greed + n);
  if (was < 100 && G.greed >= 100) { G.greedReadyT = 0; hud.call(input.mode === 'touch' ? 'GREED READY: TAP IT' : 'GREED READY: ' + input.say('greed'), ''); }
}
function heal(n) { if (!G.greedOn) G.shield = Math.min(100, G.shield + n); }
function onRing(e) {
  G.ringsGot++; G.secGot[G.section] = (G.secGot[G.section] || 0) + 1;
  setChain(G.chain + 1);
  const roll = G.rolling;
  gain(T.ringPts * G.mult * (roll ? 2 : 1), e.x, e.y + 1.2, 0, roll ? 'cyan' : '', roll ? 'ROLL-RING' : '');
  if (roll) addGreed(5);
  heal(T.ringShield * level.ease.heal);
  audio.play('ring', { rate: 1 + Math.min(G.chain, 24) * 0.012, pan: e.x / box.x * 0.5 });
  fx.burst(e.x, e.y, 0, Math.round(26 * quality.particleScale), { speed: 9, life: 0.5, s0: 0.9, r: 1, g: 0.8, b: 0.25, carry: 1, flatZ: 0.3 });
}
function onMiss(e) {
  G.ringsMissed++; G.secMiss[G.section] = (G.secMiss[G.section] || 0) + 1;
  if (G.chain > 0) { const [sx, sy] = screenOf(e.x, e.y, 0); hud.pop('MISS', sx, sy, 'red'); }
  stepDown();
}
function onScrape() {
  G.scrapes++;
  gain(T.scrapePts * G.mult, ship.x, ship.y + 1, 0, 'cyan', 'CLOSE');
  addGreed(4);
}
function onGate(e, pass) {
  if (!pass) return;
  G.gates++;
  gain(T.gatePts * G.mult, e.x, e.y + 2.6, 0, 'cyan', 'GATE');
  heal(T.gateShield * level.ease.heal);
  audio.play('ring', { rate: 0.75 });
  fx.burst(e.x, e.y, 0, Math.round(30 * quality.particleScale), { speed: 14, life: 0.5, s0: 1, r: 0.3, g: 0.9, b: 1, carry: 1, flatZ: 0.1 });
}
function damage(dmg, big) {
  dmg *= level.ease.dmg; // the human pass: early levels hit softer (EASE, levels.js)
  if (G.god) dmg = 0;
  G.shield -= dmg; G.hits++;
  ship.invuln = big ? 0.8 : 0.6;
  hud.flash(); G.shake = Math.max(G.shake, big ? 0.9 : 0.5);
  audio.play('hit');
  if (big) setChain(0); else stepDown();
  if (G.shield <= 0) die();
}
function onShot(s) {
  if (s.tutor) return; // the lesson's shot never hurts
  if (ship.invuln > 0) return;
  damage(s.dmg ?? T.shotDmg, false);
  fx.burst(ship.x, ship.y, 0, Math.round(18 * quality.particleScale), { speed: 8, life: 0.35, s0: 1, r: 1, g: 0.3, b: 0.2, carry: 0.2 });
}
function onCrash(e, dmg, small) {
  if (ship.invuln > 0) return 'stay';
  damage(dmg, !small);
  const x = e.x ?? ship.x, y = e.y ?? ship.y;
  fx.burst(lerp(x, ship.x, 0.6), lerp(y, ship.y, 0.6), 0, Math.round(30 * quality.particleScale), { speed: 12, life: 0.5, s0: 1.2, r: 1, g: 0.55, b: 0.3, carry: 0.6 });
  if (e.type === 'rock' || e.type === 'crystal' || (e.kind && e.kind.breaks)) { audio.play('boom', { vol: 0.6, rate: 1.2 }); return 'gone'; }
  return 'stay';
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
  if (!Progress.tip('roll')) Progress.setTip('roll'); // any shot sent back means the roll is learned: no lesson again
  const n = G.rollDeflects;
  G.multiMax = Math.max(G.multiMax, n);
  gain(T.deflectPts * G.mult * n, ship.x, ship.y + 1.4, 0, 'cyan', n > 1 ? 'DEFLECT x' + n : 'DEFLECT');
  addGreed(8);
  audio.play('deflect', { rate: 1 + (n - 1) * 0.06, gap: 0.02 });
  fx.burst(ship.x, ship.y, -0.5, Math.round(16 * quality.particleScale), { speed: 14, life: 0.3, s0: 0.8, r: 0.5, g: 0.95, b: 1, carry: 0 });
  if (n >= 2) { hud.callArt(['multi-deflect', 'x' + Math.min(8, n)]); G.hitstop = Math.max(G.hitstop, Math.min(0.15, 0.05 * n)); G.shake = Math.max(G.shake, 0.3); }
}
function onKill(e, byShot) {
  const z = e.z;
  fx.burst(e.x, e.y, z, Math.round(60 * quality.particleScale), { speed: 22, life: 0.8, s0: 2, r: 1, g: 0.6, b: 0.25, carry: 1, drag: 1.5 });
  fx.burst(e.x, e.y, z, Math.round(24 * quality.particleScale), { speed: 10, life: 0.6, s0: 3.5, r: 1, g: 0.95, b: 0.8, carry: 1, drag: 3 });
  audio.play('boom', { pan: e.x / box.x * 0.6 });
  if (!byShot) return;
  G.kills++;
  gain(((e.kind && e.kind.killPts) ?? T.killPts) * G.mult, e.x, e.y + 2, z, 'big', 'KILL');
  addGreed(15);
  hud.call(G.rollDeflects >= 2 ? 'RETURN TO SENDER!' : 'DEFLECT KILL!', 'c-cyan');
  G.hitstop = Math.max(G.hitstop, 0.08); G.shake = Math.max(G.shake, 0.45);
}
function onFired(s) {
  const far = clamp(1 - (-s.z) / 400, 0.25, 1);
  audio.play('fire', { vol: far, pan: s.x / box.x * 0.6, rate: 0.95 + Math.random() * 0.1 });
  // the human pass (Evrtek 11-06: "more of a visual warning when incoming weapons fire is coming"): every shot leaves
  // its shooter with a red flash at the muzzle, whoever fired it, on top of each shooter's own charge-up glow
  fx.burst(s.x, s.y, s.z, Math.round(9 * quality.particleScale), { speed: 3.5, life: 0.26, s0: 2.8, r: 1, g: 0.3, b: 0.38, carry: s.carry ? 1 : 0.5, drag: 2 });
}
function greedGo() {
  if (G.greed < 100 || G.greedOn || G.state !== 'play') return;
  G.greedOn = true; G.greedT = T.greedTime;
  hud.callArt(['greed']); G.hitstop = 0.12; G.fovKick = 1; G.shake = 0.5;
  audio.play('combo', { rate: 0.8 }); audio.musicLevel(1.12);
  document.body.classList.add('hot');
}

// The game API every kind, scenery piece and boss calls (api.game). The named rules above are level 1's; the
// generic calls below let a new kind score its own way without touching this file.
const GAME = {
  ring: onRing, missRing: onMiss, crash: onCrash, scrape: onScrape, gate: onGate, gateFrame: (e) => onCrash(e, 14, true),
  shot: onShot, graze: onGraze, deflect: onDeflect, kill: onKill, fired: onFired,
  telegraph: () => {}, mineArm: () => {},
  tutorWants: (name) => tutorWants(name), tutorReady: (e) => tutorReady(e),
  minePop: (m, z) => { audio.play('fire', { rate: 0.7, vol: 0.8, pan: m.x / box.x * 0.6 }); fx.burst(m.x, m.y, z, 14, { speed: 8, life: 0.4, s0: 1.4, r: 1, g: 0.3, b: 0.3, carry: 1 }); },
  warn: (side, t) => hud.warn(side, t),
  // generic
  score: (base, x, y, z, cls, label) => gain(base, x, y, z, cls, label),
  pop: (text, x, y, z, cls) => { const [sx, sy] = screenOf(x, y, z); hud.pop(text, sx, sy, cls); },
  greed: addGreed, heal, damage: (dmg, big) => damage(dmg, big),
  chain: (n) => setChain(G.chain + n), stepDown,
  // a speed burst (boost rings): mul for secs, stacking by refreshing
  boost: (secs, mul = 1.4) => { G.boostT = Math.max(G.boostT, secs); G.boostMul = mul; G.fovKick = 1; G.shake = Math.max(G.shake, 0.4); },
  call: (text, cls) => hud.call(text, cls), callArt: (names, sub) => hud.callArt(names, sub), banner: (a, b) => hud.showBanner(a, b),
  shake: (n) => { G.shake = Math.max(G.shake, n); }, hitstop: (t) => { G.hitstop = Math.max(G.hitstop, t); }, flash: () => hud.flash(),
  sfx: (name, o) => audio.play(name, o), burst: (x, y, z, n, o) => fx.burst(x, y, z, Math.round(n * quality.particleScale), o), emit: (x, y, z, o) => fx.emit(x, y, z, o),
  bonus: (label, pts) => G.bonuses.push([label, pts]),
  boss: (o) => hud.boss(o),
  bossEnd: (beaten) => bossEnd(beaten),
  finish: () => finish(true),
  get mult() { return G.mult; }, get rolling() { return G.rolling; }, get greedOn() { return G.greedOn; }, get G() { return G; },
};

// ---------------------------------------------------------------- the api handed to kinds
const api = {
  THREE, scene, glowTex: backdrop.glowTex, box, ship, G, game: GAME, v: 0, dt: 0, time: 0, focalPx: 600, level: null,
  music: audio.view, // read-only: position() (seconds into the file), toNextBar(), meta (bpm, firstBeat, barSec, sections), track
  get tier() { return quality.tier; },
  // the level's ease (levels.js EASE): kinds read ring (catch radius) and course.fire reads shot
  get ease() { return level ? level.ease : easeOf(0); },
  appear,
  // place e.obj at (e.x, e.y, e.z), sized (e.sx, e.sy, e.sz) x e.appear: call it every frame in update()
  pose(e) { const o = e.obj, a = e.appear; o.position.set(e.x, e.y, e.z); o.scale.set(e.sx * a, e.sy * a, e.sz * a); },
  fire: (from, tx, ty, o) => course.fire(from, tx, ty, o),
  // read-only (lv-9): the ship's world matrix (its body, with bank and roll) and the camera
  get shipMatrix() { S.body.updateMatrixWorld(); return S.body.matrixWorld; }, get camera() { return camera; },
  kill: (e, byShot) => course.kill(e, byShot),
  spawn: (ev, z) => course.spawn(ev, z),
};
const course = new Course(api);
const scenery = new Scenery(api);
course.use([bossKind, weakPointKind]);
window.__sw.course = course; window.__sw.scenery = scenery; window.__sw.api = api;
resize();
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- loading a level
// Everything a level needs before its first frame: its module, its skies, its music, its shaders.
async function prepare(n, progress = () => {}) {
  const L = await loadLevel(n);
  progress(0.1, 'COURSE');
  const art = levelArt(L.n); if (art) { const im = new Image(); im.src = 'art/' + art + '.png?v=' + VERSION; im.decode?.().catch(() => {}); } // its opening banner's lettering, fetched now
  if (level !== L) {
    await backdrop.prepare(L, renderer, (k) => progress(0.1 + 0.5 * k, 'SKIES'));
    course.use(L.kinds.concat([bossKind, weakPointKind]));
    await audio.useLevel(L, (k) => progress(0.6 + 0.25 * k, 'MUSIC'));
    level = L; api.level = L; window.__sw.level = L;
    const sec = L.sections[0];
    backdrop.setLook(sec.look || sec.id, true);
    scenery.setLevel(L, sec, true);
    progress(0.85, 'SHADERS');
    await compile();
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
function newRun(opts = {}, fromTitle = false) {
  const L = level;
  let startD = 0;
  if (opts.section) { const s = L.sections.find((q) => q.id === opts.section); if (s) startD = s.d0; }
  if (opts.boss && L.boss) startD = Math.max(0, L.boss.at - 400);
  Object.assign(G, {
    state: 'play', time: 0, dist: 0, courseD: startD, v: L.speed(startD), vMul: 1, evL: 0, evN: 0, hold: false,
    score: 0, chain: 0, mult: 1, bestMult: 1, bestChain: 0, ringsGot: 0, ringsMissed: 0,
    shield: 100, greed: 0, greedOn: false, greedT: 0, greedReadyT: 0, boostT: 0, boostMul: 1, boostK: 0,
    rolling: false, rollT: 0, rollDir: 1, rollCool: 0, rollCoolMax: T.rollCool, rollDeflects: 0, rolls: 0,
    hits: 0, grazes: 0, deflects: 0, kills: 0, multiMax: 0, gates: 0, scrapes: 0, bonuses: [], bossBeaten: false,
    secGot: {}, secMiss: {}, perfect: [], section: L.sectionAt(startD).id, hitstop: 0, shake: 0, fovKick: 0, endT: 0, cleared: false,
    jumped: startD > 0, devRun: G.dev,
  });
  G.god = G.godForced || (G.dev && G.devGod);
  // skip what lies behind the start; the section banner of a jumped-to section still shows
  G.evL = L.line.findIndex((e) => e.d - startD > -5); if (G.evL < 0) G.evL = L.line.length;
  G.evN = L.now.findIndex((e) => (e.at ?? e.d) >= startD - (e.type === 'banner' ? 15 : 0)); if (G.evN < 0) G.evN = L.now.length;
  Object.assign(ship, { x: 0, y: -0.3, vx: 0, vy: 0, rolling: false, invuln: 0 });
  S.root.visible = true;
  const sec = L.sectionAt(startD);
  // the title's scenery carries straight into a run from the start of the same level; anything else is a cut
  const seamless = fromTitle && !startD && scenery.level === L;
  G.cutStart = !seamless;
  // every start opens out of a short fade from black onto its opening already in place (the launcher is opaque, so
  // even a start from it is a cut; and nothing ever grows in as play begins)
  document.getElementById('cut').animate([{ opacity: 1 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: 450, easing: 'ease-out', fill: 'forwards' });
  course.reset(seamless); fx.clear(); hud.reset(); input.reset(); hud.boss({ show: false }); tutorOff();
  if (!seamless) scenery.setLevel(L, sec, true);
  backdrop.setLook(sec.look || sec.id, true);
  quality.resetWindow();
  document.body.classList.remove('hot');
  hud.setDev(G.dev);
}

// ---------------------------------------------------------------- the boss
function bossStart() {
  G.hold = true;
  course.spawn({ type: 'boss-body', def: level.boss.def }, -800);
  if (level.bossMusic) audio.switchTrack(level.bossMusic);
}
function bossEnd(beaten) {
  hud.boss({ show: false });
  G.hold = false;
  if (beaten) { G.bossBeaten = true; const b = level.boss.def.bonus ?? 50000; G.bonuses.push([(level.boss.def.title || 'BOSS') + ' DOWN', b]); }
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
  G.state = 'dying'; G.endT = 0;
  fx.burst(ship.x, ship.y, 0, 120, { speed: 20, life: 1.2, s0: 2, r: 1, g: 0.5, b: 0.2, carry: 0.3, drag: 1.2 });
  fx.burst(ship.x, ship.y, 0, 50, { speed: 8, life: 1.4, s0: 4, r: 1, g: 0.9, b: 0.7, carry: 0.3, drag: 2 });
  S.root.visible = false;
  audio.play('boom'); audio.play('over'); audio.stopMusic(1.6);
  document.body.classList.remove('hot');
}
function finish(cleared) {
  if (G.state !== 'play') return;
  G.cleared = cleared; G.state = 'clear'; G.endT = 0;
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
  if (G.cleared && G.hits === 0) { total += T.noHitBonus; bonus.push(['NO-HIT RUN', T.noHitBonus]); }
  if (G.cleared) { const b = Math.round(Math.max(0, G.shield) * T.shieldBonus); total += b; bonus.push(['SHIELD LEFT', b]); }
  // stars and rank come from the rings caught and the style shown, never from the score (Evrtek 11-06; levels.js)
  const run = { score: G.score, total, rings: G.ringsGot, ringTotal: level.ringTotal, grazes: G.grazes, scrapes: G.scrapes, deflects: G.deflects, kills: G.kills,
    hits: G.hits, dist: Math.round(G.dist), time: Math.round(G.time * 10) / 10, cleared: G.cleared, bestMult: G.bestMult, multiMax: G.multiMax, level: level.n, dev: G.devRun || G.jumped };
  const st = grade(run, level.n), rank = st.rank;
  run.rank = rank;
  // dev runs and jumped-in runs never write anything
  const best0 = Progress.get(level.n);
  const saved = run.dev ? { isNew: false, after: best0, newStars: false } : Progress.save(level.n, run, st.stars);
  rows.push(['SCORE', fmt(G.score)]);
  rows.push(['RINGS', G.ringsGot + ' / ' + level.ringTotal]);
  rows.push(['GRAZES', G.grazes]);
  rows.push(['CLOSE CALLS', G.scrapes]);
  rows.push(['DEFLECTS', G.deflects + (G.multiMax > 1 ? '  (best x' + G.multiMax + ')' : '')]);
  rows.push(['KILLS', G.kills]);
  rows.push(['BEST COMBO', 'x' + G.bestMult + '  (' + G.bestChain + ' chain)']);
  rows.push(['DISTANCE', (G.dist / 1000).toFixed(2) + ' km']);
  const tb = $('tally'); tb.innerHTML = '';
  const tr = (a, b, cls) => { const r = document.createElement('tr'); if (cls) r.className = cls; const x = document.createElement('td'), y = document.createElement('td'); x.textContent = a; y.textContent = b; r.append(x, y); tb.appendChild(r); };
  for (const [a, b] of rows) tr(a, b);
  for (const [a, b] of bonus) tr(a, '+' + fmt(b), 'bonus');
  tr('TOTAL', fmt(total), 'total');
  // rule 34: the next rank's need is the line under the stars (ui.showStars), in words: what this run lacked for it
  tr('BEST', fmt(Math.max(total, saved.after.score)) + (saved.after.rank && !saved.isNew ? '  ' + saved.after.rank : ''), '');
  $('end-head').textContent = G.cleared ? 'SECTOR CLEAR' : 'SHIELD DOWN';
  $('end-head').classList.toggle('clear', G.cleared);
  // Yori's rank letters; a clear with one star (or no clear) has no letter
  const rk = $('end-rank'); rk.className = 'rank r-' + (rank || 'none'); rk.hidden = !rank;
  const ri = $('end-rank-img'); if (rank) { ri.src = artUrl('rank-' + rank.toLowerCase()); ri.alt = 'RANK ' + rank; }
  $('end-nohit').hidden = !(G.cleared && G.hits === 0);
  $('end-new').hidden = !saved.isNew;
  ui.showStars(st, saved, run.dev);
  G.total = total; G.rank = rank;
  window.__sw.lastRun = Object.assign(run, { stars: st.stars, hint: st.next, saved: !run.dev });
}
function showEnd() {
  tally();
  G.state = 'end'; hud.show(false); input.enabled = false;
  ui.endScreen(level, G.cleared);
  menuMusic();
}

// ---------------------------------------------------------------- the roll lesson
// 0.3.0 (Evrtek 11-06: "The barrel roll needs a tutorial moment"). Once, early on level 1, until the player has sent a
// shot back with a roll: any deflect anywhere counts, and so does SKIP. Its pod (js/levels/level2/tutor.js) is born at
// the spawn line like anything else and asks for the lesson as it comes into range. Then the world stops and the
// lesson says how to roll; the pod charges and fires ONE slow shot in slow motion that cannot hurt and always arrives
// (it steers onto the ship); roll into it and it goes home, and the lesson says so. A miss gets one more go; a second
// miss lets you carry on (the lesson comes back next time). The music dips while it runs.
const LESSON = {
  intro: 'A slow shot is on its way. Roll right as it reaches you and it flies straight back.',
  again: 'Not quite. Roll just as it gets to you.',
  done: "That's the move. Roll into any red shot to send it back.",
  later: "No worries. You'll get another go next time.",
  freeze: 1.8, charge: 0.9, slow: 0.35, shotT: 1.1, tries: 2,
};
const TUTOR = { on: false, phase: '', t: 0, tries: 0, pod: null, shot: null, scale: 1, say: '' };
window.__sw.tutor = TUTOR;
// the key line follows how the player is playing right now (input.mode) and the keys they have bound: a double tap
// drawn on the screen, or PRESS [SPACE] OR (mouse) LEFT-CLICK TO ROLL
function lessonKey() { return input.mode === 'touch' ? { tap: true, text: 'DOUBLE-TAP TO ROLL' } : { keys: input.labels('roll'), mouse: input.binds.mouse }; }
function lessonSay(say, skip) { TUTOR.say = say; hud.tutor({ key: lessonKey(), say, skip }); }
function tutorWants(name) { return name === 'roll' && !Progress.tip('roll') && G.state === 'play'; }
function tutorReady(pod) {
  if (TUTOR.on || !tutorWants('roll')) return false;
  Object.assign(TUTOR, { on: true, phase: 'freeze', t: 0, tries: 0, pod, shot: null, scale: 0 });
  pod.hold = pod.z;
  lessonSay(LESSON.intro, true);
  audio.musicLevel(0.5, 0.3);
  return true;
}
function tutorFire() {
  const p = TUTOR.pod;
  TUTOR.shot = course.fire(p, ship.x, ship.y, { T: LESSON.shotT, owner: p, dmg: 0, noEase: true });
  TUTOR.shot.tutor = true; TUTOR.shot.home = true;
  TUTOR.phase = 'shot'; TUTOR.t = 0; p.chargeK = 0;
}
// the lesson is over: say the last thing for a moment while the world comes back up to speed
function tutorEnd(say, key) {
  if (TUTOR.pod) { TUTOR.pod.hold = undefined; TUTOR.pod.chargeK = 0; TUTOR.pod.leave = true; } // if its shot did not come home, it climbs away
  TUTOR.phase = 'out'; TUTOR.t = 0;
  hud.tutor({ key, say, skip: false });
  audio.musicLevel(G.greedOn ? 1.12 : 1, 0.6);
}
function tutorSkip() { if (!TUTOR.on || TUTOR.phase === 'out') return; Progress.setTip('roll'); tutorEnd('', ''); TUTOR.t = 1.6; }
function tutorOff() { if (TUTOR.on && TUTOR.phase !== 'out') audio.musicLevel(1, 0.3); if (TUTOR.pod) { TUTOR.pod.hold = undefined; TUTOR.pod.chargeK = 0; } Object.assign(TUTOR, { on: false, phase: '', pod: null, shot: null, scale: 1 }); hud.tutor(null); }
// real seconds in; the time scale for this frame out
function tutorTick(dt) {
  TUTOR.t += dt;
  const p = TUTOR.pod;
  if (TUTOR.phase === 'freeze') {
    input.take('roll'); // a roll pressed while it explains would only be wasted
    TUTOR.scale = 0;
    if (TUTOR.t >= LESSON.freeze) { TUTOR.phase = 'charge'; TUTOR.t = 0; }
  } else if (TUTOR.phase === 'charge') {
    TUTOR.scale = LESSON.slow;
    p.chargeK = Math.min(1, TUTOR.t / LESSON.charge);
    if (TUTOR.t >= LESSON.charge) tutorFire();
  } else if (TUTOR.phase === 'shot') {
    TUTOR.scale = LESSON.slow;
    const s = TUTOR.shot;
    if (s.reflected) { Progress.setTip('roll'); tutorEnd(LESSON.done, 'NICE ROLL!'); }
    else if (s.z >= 0 || !course.shots.includes(s)) {
      TUTOR.tries++;
      if (TUTOR.tries < LESSON.tries) { TUTOR.phase = 'charge'; TUTOR.t = 0; lessonSay(LESSON.again, true); }
      else tutorEnd(LESSON.later, '');
    }
  } else if (TUTOR.phase === 'out') {
    TUTOR.scale = Math.min(1, LESSON.slow + TUTOR.t / 0.6);
    if (TUTOR.t >= 2.4) tutorOff();
  }
  return TUTOR.scale;
}
window.addEventListener('keydown', (e) => { if (TUTOR.on && e.key === 'Enter') { e.preventDefault(); tutorSkip(); } });
// the player changed how they play (a touch, or a key or the mouse): every control text follows, the lesson too
input.onMode = (m) => {
  document.body.classList.toggle('touch', m === 'touch');
  if (TUTOR.on && TUTOR.phase !== 'out') lessonSay(TUTOR.say, true);
  if (ui) ui.controlsChanged();
};
input.onBinds = () => { if (TUTOR.on && TUTOR.phase !== 'out') lessonSay(TUTOR.say, true); if (ui) ui.controlsChanged(); };
$('tutor-skip').addEventListener('click', (e) => { e.preventDefault(); tutorSkip(); });

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
function levelArt(n) { const c = CATALOGUE.find((q) => q.n === n); return c ? 'ui/name-' + (c.art || String(c.n).padStart(2, '0')) : null; }

// ---------------------------------------------------------------- the frame
function sectionT() { const s = level.sectionAt(G.courseD); return clamp((G.courseD - s.d0) / (s.d1 - s.d0), 0, 1); }
function step(dt) {
  G.time += dt;
  // speed: the level's curve, GREED's kick, a boost burst
  G.boostT = Math.max(0, G.boostT - dt);
  G.boostK = damp(G.boostK, G.boostT > 0 ? 1 : 0, 6, dt);
  G.vMul = damp(G.vMul, (G.greedOn ? T.greedSpeed : 1) * (G.boostT > 0 ? G.boostMul : 1), 3, dt);
  G.v = level.speed(G.courseD) * G.vMul;
  G.dist += G.v * dt;
  if (!G.hold) G.courseD += G.v * dt;
  G.score += G.v * dt * 0.5 * (G.greedOn ? 2 : 1);

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
    if (e.type === 'banner') { const s = level.sections.find((q) => q.id === e.section); hud.showBanner(s.name, s.sub, s.d0 === 0 ? levelArt(level.n) : null); }
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
  if (G.greed >= 100 && !G.greedOn) { G.greedReadyT += dt; if (G.greedReadyT > T.greedAuto) greedGo(); }
  if (G.greedOn) { G.greedT -= dt; G.greed = 100 * Math.max(0, G.greedT) / T.greedTime; if (G.greedT <= 0) { G.greedOn = false; G.greed = 0; audio.musicLevel(1); document.body.classList.remove('hot'); } }

  // flight: a critically damped spring toward the target; banking falls out of the sideways speed
  const tx = input.tx * box.x, ty = input.ty * box.y, K = T.steerK, C = 2 * Math.sqrt(K);
  ship.vx += ((tx - ship.x) * K - ship.vx * C) * dt;
  ship.vy += ((ty - ship.y) * K - ship.vy * C) * dt;
  ship.x = clamp(ship.x + ship.vx * dt, -box.x, box.x); ship.y = clamp(ship.y + ship.vy * dt, -box.y, box.y);
  if (Math.abs(ship.x) >= box.x) ship.vx *= 0.5;
  if (Math.abs(ship.y) >= box.y) ship.vy *= 0.5;

  // the roll: 0.45 s of spin; shots that meet it go home
  if (G.rolling) {
    G.rollT += dt;
    if (G.rollT >= T.rollTime) { G.rolling = false; ship.rolling = false; G.rollCool = T.rollCool; if (G.rollDeflects >= 3) addGreed(10); }
  } else if (G.rollCool > 0) G.rollCool = Math.max(0, G.rollCool - dt);
  ship.invuln = Math.max(0, ship.invuln - dt);

  api.v = G.v; api.dt = dt; api.time = G.time;
  course.update(dt);
  scenery.update(dt, G.v, sec, sectionT());
}

function shipVisual(dt, now) {
  const bank = clamp(-ship.vx * 0.075, -1.15, 1.15);
  let spin = 0;
  if (G.rolling) { const k = clamp(G.rollT / T.rollTime, 0, 1); spin = -G.rollDir * Math.PI * 2 * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2); }
  S.body.rotation.z = damp(S.body.rotation.z, bank, 10, dt);
  if (G.rolling) S.body.rotation.z = bank + spin;
  S.root.rotation.y = damp(S.root.rotation.y, -ship.vx * 0.014, 8, dt);
  S.root.rotation.x = damp(S.root.rotation.x, ship.vy * 0.03, 8, dt);
  S.root.position.set(ship.x, ship.y, 0);
  const shell = G.rolling ? Math.sin(clamp(G.rollT / T.rollTime, 0, 1) * Math.PI) : 0;
  S.shell.material.opacity = shell * 0.45; S.halo.material.opacity = shell * 0.32;
  S.shell.rotation.x += dt * 9;
  const th = clamp((G.v - 40) / 100, 0.3, 1) * (G.greedOn ? 1.4 : 1) * (1 + (G.boostK || 0) * 0.5);
  for (const e of S.engines) { const f = 0.8 + Math.random() * 0.25; e.flame.scale.set(0.8 * f + th * 0.4, 0.8 * f + th * 0.4, 1); e.flame.material.color.setHex(G.greedOn ? 0xffcc33 : 0x53e6ff); }
  S.root.visible = G.state === 'dying' || G.state === 'end' ? false : !(ship.invuln > 0 && Math.floor(now * 20) % 2 === 0);
  if (G.state === 'play' || G.state === 'title' || G.state === 'clear') {
    const n = quality.tier === 0 ? 2 : 3;
    for (const e of S.engines) {
      tmpV.copy(e.local); S.body.localToWorld(tmpV);
      for (let i = 0; i < n; i++) fx.emit(tmpV.x + (Math.random() - 0.5) * 0.1, tmpV.y + (Math.random() - 0.5) * 0.1, tmpV.z + i * 0.4, {
        life: 0.3, s0: 0.3, s1: 0.05, r: G.greedOn ? 1 : 0.35, g: G.greedOn ? 0.8 : 0.85, b: G.greedOn ? 0.2 : 1, a: 0.85, carry: 1 });
    }
  }
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
    // the roll lesson stops the world, then runs it in slow motion (its own clock is real time)
    if (TUTOR.on) sdt *= tutorTick(dt);
    const k = sdt / dt; // how fast the world runs this frame, for the parts that move by real time
    if (G.hitstop > 0) { G.hitstop -= dt; sdt = 0; }
    const p0 = performance.now();
    // dev speed: whole extra steps (stable), or a half step
    const reps = G.dev ? G.devSpeed : 1;
    if (sdt > 0) { if (reps < 1) step(sdt * reps); else for (let i = 0; i < reps && G.state === 'play'; i++) step(sdt); }
    const p1 = performance.now();
    backdrop.update(dt, sdt > 0 ? G.v * k : 0, G.dist, G.greedOn ? 1 : 0, camera, G.boostK);
    const p2 = performance.now();
    fx.update(sdt, sdt > 0 ? G.v : 0);
    hud.threats(G.state === 'play' ? threats() : [], dt);
    const p3 = performance.now();
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
  if (G.state !== 'paused') { shipVisual(dt, t); cameraUpdate(dt, t); }
  const r0 = performance.now();
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
// start(n, opts): load level n (a loading screen if it is not ready), then fly it
async function start(n = 1, opts = {}) {
  audio.unlock();
  if (G.state === 'loading') return;
  if (G.state === 'boot') { ui.cancelPress(); ui.loading(false); G.state = 'title'; } // a test or a dev link starting before the press
  const was = G.state;
  G.state = 'loading';
  let fresh = false;
  ui.hideAll();
  try {
    if (!level || level.n !== n) { fresh = true; ui.loading(true, level ? 'LEVEL ' + n : ''); await prepare(n, (k, what) => ui.progress(k, what)); ui.loading(false); }
  } catch (err) {
    console.warn('level ' + n + ' could not load', err);
    G.state = was === 'boot' ? 'title' : was; ui.loading(false); ui.toast('LEVEL ' + n + ': COMING SOON'); ui.launcher();
    return;
  }
  // seamless only when the launcher was already showing this level's scenery; a level just loaded behind the
  // loading screen starts as a cut (a fade from black onto its opening, already in place)
  newRun(opts, was === 'title' && !fresh);
  hud.show(true); input.enabled = true;
  const track = opts.boss && level.bossMusic ? level.bossMusic : musicAt(level, G.courseD);
  const spec = typeof track === 'object' ? track : { track };
  if (MENU.ready && audio.music && audio.music.name === MENU.track) audio.crossTo(spec.track, 1.0, spec);
  else { audio.stopMusic(0.01); audio.startMusic(spec); }
}
function toTitle() {
  G.state = 'title'; hud.show(false); input.enabled = false; hud.boss({ show: false }); tutorOff();
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

const ui = new UI({ G, audio, hud, input, Progress, CATALOGUE, start, toTitle, pause, resume, greedGo, menuMusic, touch: TOUCH, version: VERSION, params, level: () => level });
window.__sw.ui = ui;
window.__sw.backdrop = backdrop; window.__sw.prof = PROF; window.__sw.start = start; window.__sw.toTitle = toTitle; window.__sw.greedGo = greedGo; window.__sw.tryRoll = tryRoll; window.__sw.camera = camera; window.__sw.box = box;
window.__sw.prepare = prepare; window.__sw.newRun = newRun; window.__sw.THREE = THREE;

// ---------------------------------------------------------------- boot: the loading screen, then the launcher
// Evrtek (11-05): the loading screen waits for a press. When everything is ready (the sounds and the menu track
// decoded, the skies built, the shaders warm) it shows TAP TO START / PRESS ANY KEY; that press unlocks the audio
// inside the gesture itself (iOS), starts the menu track with a 0.6 s fade, and opens the launcher.
(async () => {
  ui.loading(true, '');
  const sound = audio.preload((k) => ui.progress(k * 0.3, 'SOUND'), MENU.ready ? [MENU.track] : []);
  await prepare(1, (k, what) => ui.progress(0.3 + k * 0.7, what));
  await sound; // the prompt never shows before the menu track is decoded, so the press always has music to start
  window.__sw.warm = true;
  if (params.has('test')) import('./testhooks.js?v=0.3.0').then((m) => m.install(window.__sw));
  if (G.state !== 'boot') return; // a test or a dev link already started a run
  ui.pressToStart(() => {
    audio.unlock();
    if (MENU.ready) audio.crossTo(MENU.track, 0.6);
    G.state = 'title';
    ui.loading(false);
    ui.launcher();
  });
})().catch((e) => { console.error(e); });
requestAnimationFrame((t) => { last = t; frame(t); });
