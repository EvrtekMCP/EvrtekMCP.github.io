// DEGEN DRIFT: the duel in the game (day 4). Puts the rival on the road (a second Car with its own tune, a second
// CarMesh in its colours, its tyre smoke), steps it at the game's 120 Hz beside you, keeps the leg (duel.js Leg), draws
// the duel's HUD panel and a tag over the rival, and runs the legs: leg 1 you lead, a leg screen, leg 2 you chase,
// a sudden-death third if the two end close, then the duel's result and its pay. Rides on the HUD's frames
// (hud.attach) like the tips and the ghost; main.js only hands it the lap's end (finish() asks lapDone() first).
// Nothing here changes how either car drives.
// Day 5: the rival is heard (voice.js: its own engine and tyres, placed by distance, pan and Doppler), leaves skid
// marks like yours (the same ring, wheels 4-7), and grips as the surface under it says, as your car does.
import * as THREE from '../../vendor/three/three.module.min.js?v=0.1.22';
import { TUNING } from '../config.js?v=0.1.22';
import { Car } from '../car.js?v=0.1.22';
import { CarMesh } from '../carmesh.js?v=0.1.22';
import { Surface } from '../carsurface.js?v=0.1.22';
import { carById } from '../data/cars.js?v=0.1.22';
import * as G from '../garage.js?v=0.1.22';
import { DUELS, Leg, verdict, suddenDeath, playerLeads, duelPay, carTune, carProgress } from './duel.js?v=0.1.22';
import { Rival } from './rival.js?v=0.1.22';
import { RivalVoice } from './voice.js?v=0.1.22';
import { view } from '../fit.js?v=0.1.22';

const H = 1 / 120;
const KEY = 'driftline.duels.v1';
export const record = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
const keep = (r) => { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (e) { /* not kept */ } };
const fmtS = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + ' s';
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Duel {
  constructor(game, ui) {
    this.g = game; this.ui = ui; this.active = false; this.leg = null; this.legs = []; this.mesh = null; this.light = [1, 1, 1];
    this.p = [0, 0, 0]; this.v = new THREE.Vector3(); this.sm = [0, 0]; this.voice = null; this.surf = null; this.rSurf = 'asphalt'; this.lastXZ = null;
    // the duel's HUD panel and the tag over the rival, inside the HUD (hidden unless a duel is on)
    const hud = document.getElementById('hud');
    hud.insertAdjacentHTML('beforeend', `<div class="duelhud" id="h-duel"><div class="dleg" id="d-leg"></div>
      <div class="dgap"><span class="dpos" id="d-pos"></span><span class="num" id="d-gap"></span></div>
      <div class="dedge"><span class="dl">DRIFT</span><div class="dbar"><i id="d-you"></i><i id="d-riv"></i><b></b></div><span class="num" id="d-edge"></span></div>
      <div class="dout" id="d-out"><i id="d-outfill"></i></div></div><div class="rtag" id="d-tag"><b id="d-tagname"></b><i></i></div>`);
    this.e = Object.fromEntries(['h-duel', 'd-leg', 'd-pos', 'd-gap', 'd-you', 'd-riv', 'd-edge', 'd-out', 'd-outfill', 'd-tag', 'd-tagname'].map((id) => [id, document.getElementById(id)]));
    game.hud.attach(this);
  }
  cfg() { return DUELS[this.g.course.id]; }
  // ---------------------------------------------------------------- the flow
  start() {
    const c = this.g.course; if (!c.duel || !DUELS[c.id]) return false;
    this.active = true; this.legs = []; this.legNo = 1; this.seed = (Math.random() * 1e9) | 0;
    this.g.duel = this;
    this.startLeg();
    return true;
  }
  startLeg() {
    const g = this.g, c = g.course, cfg = this.cfg(), lead = playerLeads(this.legNo, this.legs);
    this.coasting = false;
    g.startRun();
    this.prepare();
    if (!this.surf || this.surf.track !== g.track) this.surf = new Surface(g.track);
    this.mesh.group.visible = true;
    this.leg = new Leg(g.track, c, g.car, this.rival, new Rival(g.track, cfg, this.seed + this.legNo * 7919), lead);
    const sl = this.leg.slots(c);
    g.car.reset(sl.player[0], sl.player[1]); this.rival.reset(sl.rival[0], sl.rival[1]);
    g.cam.snap(g.car);
    // main.js ends the run one lap from where the car started: line that up with the duel's finish
    g.run.lapS = g.car.s; g.run.progress = -(c.duel.grid[0][0] - sl.player[0]) / g.track.length;
    this.acc = 0; this.lastT = 0; this.lastXZ = null;
    this.hearRival();
    g.hud.root.classList.add('duel');
    this.e['h-duel'].hidden = false;
    this.e['d-leg'].textContent = this.legNo === 3 ? `SUDDEN DEATH · ${lead ? 'YOU LEAD' : 'YOU CHASE'}` : `LEG ${this.legNo} OF 2 · ${lead ? 'YOU LEAD' : 'YOU CHASE'}`;
    this.e['d-tagname'].textContent = cfg.who;
    g.hud.msg(this.legNo === 3 ? 'SUDDEN DEATH' : lead ? `LEG ${this.legNo}: LEAD` : `LEG ${this.legNo}: CHASE`);
  }
  // the rival: its car (one of the six, with its own share of parts) and its mesh in its colours, made once per course
  // and rival. Building a car's body takes a moment on a phone, so the first duel on a course does it under the
  // loading screen (11-16; since 11-18 (2) the race's tip screen, main.js launch); later legs and rematches find it ready.
  needsPrep() { const g = this.g, cfg = this.cfg(); return !!cfg && (!this.rival || this.rival.track !== g.track || this.rivalId !== cfg.rival); }
  prepare() {
    if (!this.needsPrep()) return;
    const g = this.g, cfg = this.cfg();
    this.rival = new Car(g.track, carTune(cfg.rival, cfg.parts)); this.rivalId = cfg.rival;
    if (this.mesh) { g.scene.remove(this.mesh.group); }
    this.mesh = new CarMesh({ paint: cfg.paint, rim: null, smoke: null, glow: null, decal: null, brakes: 1, ride: 1, carbon: false, exhaust: 1 }, cfg.rival);
    g.scene.add(this.mesh.group);
    if (g.applyReflect) g.applyReflect(); // 11-26: the rival's paint under the course's reflection, as yours (main.js)
  }
  // the rival's voice: made the first time the sound module is there (it loads after the first tap), voiced from its
  // car and parts the way yours is, switched on for the leg
  hearRival() {
    const cfg = this.cfg();
    if (!this.voice) this.voice = RivalVoice.make(this.g.sound, (this.seed % 9973) + 101);
    if (!this.voice || !this.rival) return;
    const hints = G.soundHints(carProgress(cfg.rival, cfg.parts));
    this.voice.setCar(hints.preset, hints, this.rival.T.car.redline);
    this.voice.setOn(true);
  }
  silence() { if (this.voice) this.voice.setOn(false); }
  // main.js finish(): the lap is done. In a duel the duel takes it from here.
  lapDone() {
    if (!this.active || !this.leg) return false;
    this.leg.playerFinished();
    this.endLeg();
    return true;
  }
  endLeg() {
    const g = this.g, L = this.leg.result();
    this.legs.push(L);
    g.score.bank('finish');
    g.state = 'results'; g.hud.show(false); g.showTouch(false); g.hud.root.classList.remove('duel');
    this.e['d-tag'].style.opacity = 0;
    this.coast();
    if (L.outright || this.legNo === 3 || (this.legNo === 2 && !suddenDeath(this.legs))) this.finish();
    else { g.sound.music('results'); this.ui.duelLeg(L, this); }
  }
  next() { this.legNo++; this.startLeg(); }
  restartLeg() { if (this.active) this.startLeg(); }
  cancel() { this.active = false; this.leg = null; this.g.duel = null; this.g.hud.root.classList.remove('duel'); this.hideRival(); }
  hideRival() { if (this.mesh) this.mesh.group.visible = false; this.coasting = false; this.silence(); }
  finish() {
    const g = this.g, c = g.course, cfg = this.cfg(), p = g.progress;
    const v = verdict(this.legs), rec = record(), mine = (rec[c.id] ||= { won: 0, lost: 0 });
    const firstWin = v.won && !mine.won;
    const pay = duelPay(G.payout, p, c, v, firstWin);
    if (v.won) mine.won++; else mine.lost++; keep(rec);
    p.credits += pay.total; p.earned += pay.total; p.runs++;
    G.saveProgress(p);
    this.active = false; this.leg = null; g.duel = null;
    g.sound.music('results');
    this.ui.duelResult({ verdict: v, legs: this.legs, pay, cfg, car: carById(cfg.rival), record: mine, firstWin });
  }
  // after a leg the rival rolls to a stop rather than freezing (the game only steps it during a run); its engine winds
  // down with it, and goes quiet when you leave the screen
  coast() {
    this.coasting = true; let last = performance.now();
    const tick = (now) => {
      if (!this.coasting) return; // a new leg took over
      if (this.g.state !== 'results') { this.coasting = false; this.silence(); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      for (let k = 0; k < Math.round(dt / H); k++) { this.rival.step(H, { steer: 0, throttle: 0, brake: 0.35, handbrake: 0 }); this.rival.events.length = 0; }
      this.g.world.lightAt(this.rival.trackI, this.light); this.mesh.update(this.rival, this.light, dt);
      if (this.voice) this.voice.frame(this.rival, this.g.camera, 'asphalt');
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  // ---------------------------------------------------------------- every frame of a run (the HUD calls it)
  frame(car, sc, run) {
    if (!this.active || !this.leg) return;
    const g = this.g, leg = this.leg, r = this.rival;
    const dt = Math.max(0, run.time - this.lastT); this.lastT = run.time;
    if (this.voice && g.sound && g.sound.ctx && this.voice.ctx !== g.sound.ctx) this.voice = null; // 11-19 (2): the sound was rebuilt on a new context (js/sound.js): a new voice on it
    if (!this.voice && g.sound && g.sound.mod) this.hearRival(); // the sound module arrived mid-leg
    // the surface under the rival's wheels: its grip (aprons and shoulders) and what its tyres sound like
    this.rSurf = this.surf.under(r); r.surfGrip = this.surf.grip;
    if (g.state === 'run') {
      this.acc += dt;
      let n = 0;
      while (this.acc >= H && n < 12) { this.acc -= H; n++; leg.step(H); this.smoke(H); }
      for (const ev of leg.events.splice(0)) this.event(ev);
      if (leg.done && g.state === 'run') { this.endLeg(); return; }
    } else leg.step(0, false);
    this.skids(g.state === 'run');
    g.world.lightAt(r.trackI, this.light);
    this.mesh.update(r, this.light, Math.max(dt, 1 / 120));
    if (this.voice) this.voice.frame(r, g.camera, this.rSurf);
    this.panel();
  }
  event(ev) {
    const g = this.g;
    if (ev.type === 'rshift') { if (this.voice) this.voice.shift(ev.cut); return; }
    if (ev.type === 'rub') { g.sound.impact('scrape', clamp(ev.speed / 10, 0.1, 0.45)); return; }
    if (ev.type === 'contact' && ev.fault === 'player') { g.hud.pop('Contact: −' + fmt(900), 'wipe'); g.hud.flash(); g.sound.impact('hard', Math.min(1, ev.speed / 8)); }
    else if (ev.type === 'contact') g.sound.impact('scrape', Math.min(1, ev.speed / 10));
    else if (ev.type === 'pass') { g.hud.pop('Passed!', 'link'); g.sound.ui('link'); }
    else if (ev.type === 'passed') g.hud.pop('Passed by ' + this.cfg().who, 'info');
    else if (ev.type === 'rivalFinished') g.hud.pop(this.cfg().who + ' is home', 'info');
  }
  // the rival's tyre smoke, the same rule as yours (main.js effects), through the same smoke
  smoke(dt) {
    const g = this.g, r = this.rival, F = TUNING.fx; if (!g.smoke || r.speed < 3 || r.slipR <= F.smokeSlip) return;
    const L = [Math.min(1.2, 0.35 + this.light[0] * 0.8), Math.min(1.2, 0.32 + this.light[1] * 0.75), Math.min(1.2, 0.4 + this.light[2] * 0.75)];
    for (const k of [2, 3]) {
      const i = k - 2; this.sm[i] += F.smokeRate * (r.T.car.smokeMul || 1) * (r.slipR - F.smokeSlip) * dt * (g.quality.tier === 0 ? 0.4 : 0.8);
      while (this.sm[i] >= 1) { this.sm[i] -= 1; r.wheelPos(k, this.p); const q = g.rnd; g.smoke.emit(this.p[0] + (q() - 0.5) * 0.3, this.p[1] + 0.25, this.p[2] + (q() - 0.5) * 0.3, r.vx * 0.22 + (q() - 0.5) * 2.5, 0.4 + q(), r.vz * 0.22 + (q() - 0.5) * 2.5, L, 1.6 + q() * 1.2, g.time); }
    }
  }
  // the rival's skid marks: your rule (main.js effects), into the same ring as wheels 4-7. A jump (a reset onto the
  // road, a new leg) lifts them first, so no mark is drawn across the jump.
  skids(on) {
    const g = this.g, r = this.rival, F = TUNING.fx; if (!g.skids) return;
    const jump = this.lastXZ && (r.x - this.lastXZ[0]) ** 2 + (r.z - this.lastXZ[1]) ** 2 > 36; this.lastXZ = [r.x, r.z];
    const lx = Math.cos(r.psi), lz = -Math.sin(r.psi);
    for (let k = 0; k < 4; k++) {
      const slip = k >= 2 ? r.slipR : r.slipF; r.wheelPos(k, this.p);
      g.skids.mark(4 + k, this.p, lx, lz, on && !jump && r.speed > 2 ? clamp((slip - F.skidSlip) * 1.8, 0, 1) : 0);
    }
  }
  // the duel's panel: who leads and by how much, the drift edge this leg, how near an outright result is
  panel() {
    const e = this.e, leg = this.leg, cfg = this.cfg(), gap = leg.gapSec(), ahead = leg.lead() >= 0;
    e['d-pos'].textContent = ahead ? 'AHEAD' : 'BEHIND';
    e['d-gap'].textContent = fmtS(gap);
    e['h-duel'].dataset.ahead = ahead ? '1' : '0';
    const you = leg.pMeter.pts, riv = leg.rMeter.pts, tot = Math.max(1, you + riv);
    e['d-you'].style.width = (you / tot * 100).toFixed(1) + '%'; e['d-riv'].style.width = (riv / tot * 100).toFixed(1) + '%';
    const edge = Math.round(you - riv); e['d-edge'].textContent = (edge >= 0 ? '+' : '−') + fmt(Math.abs(edge));
    const f = Math.max(-1, Math.min(1, ahead ? gap / cfg.outright : gap / (cfg.outright * 1.25)));
    e['d-outfill'].style.transform = `scaleX(${Math.abs(f).toFixed(3)})`; e['d-out'].dataset.side = f >= 0 ? 'you' : 'riv';
    // the tag over the rival's roof, when it is in front of the camera
    const r = this.rival, cam = this.g.camera;
    this.v.set(r.x, r.y + 2.2, r.z).project(cam);
    const on = this.v.z < 1 && Math.abs(this.v.x) < 1.1 && Math.abs(this.v.y) < 1.1 && Math.hypot(r.x - this.g.car.x, r.z - this.g.car.z) > 6;
    e['d-tag'].style.opacity = on ? 1 : 0;
    if (on) e['d-tag'].style.transform = `translate(${((this.v.x + 1) / 2 * view.w).toFixed(0)}px, ${((1 - this.v.y) / 2 * view.h).toFixed(0)}px)`;
  }
  // the HUD shows or hides: outside a duel the rival is put away
  visible(on) { if (on && !this.active) this.hideRival(); if (!this.active) { this.e['h-duel'].hidden = true; this.e['d-tag'].style.opacity = 0; } }
}
