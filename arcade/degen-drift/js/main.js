// DEGEN DRIFT (project DRIFTLINE): the game. Boots the world, runs the states (title, course card, garage,
// countdown, run, pause, results), steps the car at a fixed 120 Hz, feeds the scoring, the effects, the sound and the
// HUD, and renders. The car list is an array of drivers so a rival car (downhill duels) can join later: each driver is
// a car, its mesh and where its inputs come from; 0.1.0 has the player alone.
import * as THREE from '../vendor/three/three.module.min.js?v=0.1.19';
import { TUNING, VERSION } from './config.js?v=0.1.19';
import { installFog, PAL } from './look.js?v=0.1.19';
import { Track } from './track.js?v=0.1.19';
import { courseById } from './courses/index.js?v=0.1.19';
import { DUELS } from './duel/duel.js?v=0.1.19';
import { Car } from './car.js?v=0.1.19';
import { DriftScore } from './scoring.js?v=0.1.19';
import * as G from './garage.js?v=0.1.19';
import { buildWorld } from './world.js?v=0.1.19';
import { CarMesh } from './carmesh.js?v=0.1.19';
import { Surface } from './carsurface.js?v=0.1.19';
import { Smoke, Skids, Sparks, SpeedLines } from './fx.js?v=0.1.19';
import { ChaseCam } from './camera.js?v=0.1.19';
import { Post } from './post.js?v=0.1.19';
import { Quality } from './quality.js?v=0.1.19';
import { Input } from './input.js?v=0.1.19';
import { Sound } from './sound.js?v=0.1.19';
import { UI } from './ui.js?v=0.1.19';
import { Hud } from './hud.js?v=0.1.19';
import { Debug, loadTuning } from './debug.js?v=0.1.19';
import { appIcon } from './art.js?v=0.1.19';
import { Loader, painted } from './loader.js?v=0.1.19';
import { TipScreen } from './tips.js?v=0.1.19';
import { view, onFit } from './fit.js?v=0.1.19';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const params = new URLSearchParams(location.search);
const TEST = params.has('test');
const H = 1 / 120;
const SKEY = 'driftline.settings.v1';
// the boot's bar and the loading screen are one (js/loader.js); painted() lets a frame reach the screen between steps
const loader = new Loader();
const progressBar = (f) => loader.set(f);

function loadSettings() {
  const d = { throttle: 'buttons', steer: 'stick', pressure: 'auto', quality: 'auto', fps: false, sound: true };
  try { return Object.assign(d, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { return d; }
}

class Game {
  async boot() {
    progressBar(0.05);
    loadTuning();
    this.settings = loadSettings();
    if (params.has('fps')) this.settings.fps = true;
    this.course = courseById(this.settings.course);
    this.progress = G.loadProgress();
    this.input = new Input(this.settings);
    this.quality = new Quality(this.settings.quality, this.input.touch);
    this.sound = new Sound();
    // 11-18 (sound builder): New became the default; a choice saved before it (Recorded or Classic) starts on New once
    if (this.settings.engineSoundV !== 2) { this.settings.engineSound = 'new'; this.settings.engineSoundV = 2; this.saveSettings(); }
    this.sound.setEngineSound(this.settings.engineSound); // 11-17 (sound builder): Settings > Engine sound
    installFog(this.course.sun);
    const canvas = document.getElementById('view');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.input.touch, powerPreference: 'high-performance', alpha: false, stencil: false });
    this.renderer.setPixelRatio(this.quality.pixelRatio());
    this.renderer.setSize(view.w, view.h, false);
    this.renderer.info.autoReset = false;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(PAL.fog.clone(), 0.0024);
    this.camera = new THREE.PerspectiveCamera(TUNING.camera.fov, view.w / view.h, 0.15, 3600);
    this.loader = loader;
    await painted(); progressBar(0.2);
    await this.buildCourse(this.course, (f) => loader.step(0.2 + f * 0.6));
    progressBar(0.82);
    // the player's car (the drivers list leaves room for a rival later)
    this.carMesh = new CarMesh(G.looks(this.progress), this.progress.car);
    this.scene.add(this.carMesh.group);
    this.car = new Car(this.track, G.deriveTune(this.progress));
    this.drivers = [{ car: this.car, mesh: this.carMesh, source: 'player' }];
    this.score = new DriftScore(this.track);
    this.surface = new Surface(this.track);
    this.smoke = new Smoke(this.quality.particles); this.skids = new Skids(this.quality.skids); this.sparks = new Sparks(); this.lines = new SpeedLines();
    this.scene.add(this.smoke.mesh, this.skids.mesh, this.sparks.mesh, this.lines.mesh);
    this.smoke.setTint(G.looks(this.progress).smoke);
    this.cam = new ChaseCam(this.camera);
    this.post = new Post(this.renderer);
    this.hud = new Hud();
    this.ui = new UI(this);
    this.tipScreen = new TipScreen(this, this.ui.tips); // 11-18 (2): the loading screen a race launches behind
    this.debug = new Debug(this);
    this.fpsEl = document.getElementById('fps'); this.fpsEl.hidden = !this.settings.fps;
    this.frames = []; this.fpsT = 0;
    this.quality.onScale = () => this.resize();
    this.quality.onTier = () => this.resize();
    this.world.setPixelRatio(this.renderer.getPixelRatio());
    this.rnd = mulberry(42);
    this.light = [1, 1, 1];
    this.time = 0; this.state = 'boot'; this.run = { time: 0, progress: 0, lapS: 0 };
    if (this.input.touch) this.input.mountTouch(document.getElementById('touch'));
    this.input.onPause = () => this.pause();
    this.bindGlobal();
    this.resize();
    // warm every shader before the first real frame (no hitch at the first drift)
    this.car.reset(-8, 0); this.carMesh.update(this.car, [1, 1, 1], 0.016); this.cam.snap(this.car);
    this.renderer.compile(this.scene, this.camera);
    progressBar(1);
    this.toTitle();
    this.bootEl = document.getElementById('boot'); this.bootEl.classList.add('title');
    this.last = performance.now();
    if (TEST) await this.testHooks();
    if (!this.capture) requestAnimationFrame((t) => this.loop(t));
    this.ready = true;
  }

  // ---------------------------------------------------------------- courses (the courses builder's: world, track, fog)
  // step(fraction 0..1, what): awaited between the stages (the boot's bar, the loading screen)
  async buildCourse(course, step) {
    const track = this.chosenTrack && this.chosenTrack.course === course ? this.chosenTrack : new Track(course); // the card's road, if it has one
    if (step) await step(0.03, 'the road');
    const world = await buildWorld(track, course, this.quality.tier, step);
    // swapped in only once built (no frame sees a half-made course)
    this.course = course; this.track = track; this.world = world;
    this.scene.fog.color.copy(world.fog.color); this.scene.fog.density = world.fog.density;
    this.scene.add(world.root);
  }
  // change course: a new world and track for every system that reads them. Since 11-16 behind the loading screen
  // (js/loader.js): it comes up on the tap, its bar follows the build's stages, and nothing is drawn while it is up (the
  // frame loop rests), so no frame sees a half-made course. Only what outlives the course (the car, the smoke, the
  // skids, a ghost or a rival) is marked to recompile with the region's fog (look.js bumps the fog's epoch in every
  // program key); the new world's materials are new and compile once. The shaders compile and one frame is drawn under
  // the loading screen, so the card that follows answers at once. The old world goes after the new one is built.
  // 11-18 (2): since the tips moved to the race's loading screen, a player picks a course (choose) and its world is
  // built when a race on it launches (launch); loadCourse builds one at once, under the plain loading screen (the
  // tests' __dl.loadCourse).
  async loadCourse(id) {
    const course = courseById(id);
    this.chosen = null;
    if (course === this.course || this.loading) return false;
    return this.busy('Building ' + course.name, (step) => this.swapCourse(course, (f) => step(0.04 + f * 0.8)));
  }
  async swapCourse(course, step) {
    this.settings.course = course.id; this.saveSettings();
    const old = this.world;
    await this.buildCourse(course, step);
    this.scene.remove(old.root); old.dispose();
    this.car.track = this.track; this.score = new DriftScore(this.track); this.surface = new Surface(this.track);
    if (this.autopilot) this.autopilot.track = this.track;
    this.world.setPixelRatio(this.renderer.getPixelRatio());
    this.skids.clear();
    for (const o of this.scene.children) if (o !== this.world.root) o.traverse((x) => { for (const m of [].concat(x.material || [])) m.needsUpdate = true; });
    this.parkAtStart(); this.cam.snap(this.car); this.titleS = 30;
    if (this.state === 'title') this.titleCam(0);
    if (this.paletteWorld !== this.world) this.applyPalette();
  }
  // 11-18 (2): picking a course chooses it. Its card opens at once, read from its road alone (a Track: a few ms); the
  // world behind the card stays the one built until a race on the chosen course launches.
  choose(id) {
    const c = courseById(id);
    this.chosen = c === this.course ? null : c;
    if (this.chosen && (!this.chosenTrack || this.chosenTrack.course !== c)) this.chosenTrack = new Track(c);
  }
  get cardCourse() { return this.chosen || this.course; }
  cardTrack() { return this.chosen ? this.chosenTrack : this.track; }
  // 11-18 (2), Evrtek: "a brief, say, 2 to 3 second loading screen when you go to launch into a race. So this will give
  // the system a little bit of time to load the assets in the background while giving the player a visual". A run or
  // a duel launched from a menu (the card's Start run and Start duel, a results screen's Again and Rematch): the tip
  // screen (js/tips.js) comes up on the tap; under it the chosen course is built if it is not the one already built,
  // a duel's rival is brought out, the car is put on the line, the shaders compile and one frame is drawn; then it
  // stays to about 2.5 s from when it appeared (at once if the work took longer), or goes on a tap; Esc or a pad's B
  // goes back to the card instead. The frame loop rests under it as under the loading screen. Restart in pause and a
  // duel's next leg go straight in: they are the race's own flow.
  async launch(kind) {
    if (this.loading) return false;
    const course = this.cardCourse, T = this.tipScreen, build = course !== this.course, D = kind === 'duel' && course.duel ? DUELS[course.id] : null;
    let how = 'go';
    this.loading = true;
    try {
      await T.show(D ? 'Getting ' + D.who + ' to the line' : build ? 'Building ' + course.name : course.name);
      if (build) await this.swapCourse(course, (f) => T.step(0.04 + f * 0.76));
      this.chosen = null;
      if (kind === 'duel' && this.ui.duel.needsPrep()) { this.ui.duel.prepare(); await T.step(0.82); }
      this.parkAtStart(); this.cam.snap(this.car);
      await T.step(0.84);
      await this.renderer.compileAsync(this.scene, this.camera);
      await T.step(0.9);
      this.warmFrame();
      await T.step(1);
      how = await T.wait();
    } finally {
      this.loading = false; this.last = performance.now(); this.quality.wait = Math.max(this.quality.wait, 1);
      T.hide();
    }
    if (how === 'back') { this.ui.course(); return false; }
    if (!(kind === 'duel' && this.ui.duel.start())) this.startRun();
    return true;
  }
  // 11-16: something slow asked for by a tap (a course built, a car brought out, a duel set up): the loading screen
  // comes up on the tap, the work runs in steps under it (step(f) moves the bar and lets the page paint), the new
  // shaders compile and one frame is drawn underneath, and it fades onto the screen it led to. One at a time.
  async busy(label, work) {
    if (this.loading) return false;
    this.loading = true;
    try {
      await this.loader.show(label);
      await work((f) => this.loader.step(f));
      await this.loader.step(0.84);
      await this.renderer.compileAsync(this.scene, this.camera);
      await this.loader.step(0.9);
      this.warmFrame();
      await this.loader.step(1);
    } finally {
      this.loading = false; this.loader.hide(); this.last = performance.now(); this.quality.wait = Math.max(this.quality.wait, 1);
    }
    return true;
  }
  // one frame drawn under the loading screen: the new shaders link and the meshes and textures go up to the GPU here,
  // not on the first frame the player sees
  warmFrame() { this.world.update(this.time); this.post.render(this.scene, this.camera, this.quality.bloom, 0); }

  bindGlobal() {
    // 11-16: the box (js/fit.js) follows the window, the visual viewport and how much of a host's frame is on the screen
    addEventListener('resize', () => this.resize());
    addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    onFit(() => this.resize());
    // audio unlocks inside the first gesture (iPhone Safari). 11-19 (2): and every later tap, click or key wakes it if iOS
    // suspended or interrupted it (js/sound.js unlock). The same three events as before and on the way up, after the
    // screen's own handler: a button answers before the context is made (caught earlier, on the way down or on
    // pointerup, it held the first tip screen back by up to half a second); the saved mute and volumes go to the sound
    // once (they were written again on every touch)
    const unlock = () => { this.sound.unlock(); if (!this.soundSet) { this.soundSet = true; this.sound.setMuted(!this.settings.sound); this.sound.setVolumes(this.settings.vol); } };
    for (const ev of ['touchend', 'click', 'keydown']) addEventListener(ev, unlock, { passive: true });
    // no pinch zoom, no double-tap zoom, no page scroll on iOS
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => { if (!e.target.closest('.pbody, .glist, .debug')) e.preventDefault(); }, { passive: false });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'run') this.pause(); });
    document.getElementById('pause-btn').addEventListener('click', () => { if (this.state === 'run' || this.state === 'countdown') this.pause(); });
  }
  resize() {
    const w = view.w, h = view.h; // the box the canvas fills (js/fit.js)
    this.renderer.setPixelRatio(this.quality.pixelRatio());
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.post.rt) this.post.setSize();
    this.world.setPixelRatio(this.renderer.getPixelRatio()); this.sparks.uScale.value = this.renderer.getPixelRatio();
    const portrait = this.input.touch && h > w;
    document.getElementById('rotate').hidden = !portrait;
    if (portrait && this.state === 'run') this.pause();
  }
  saveSettings() { try { localStorage.setItem(SKEY, JSON.stringify(this.settings)); } catch (e) { /* not kept */ } }
  setSetting(k, v) {
    this.settings[k] = v; this.saveSettings();
    if (k === 'quality') this.quality.set(v);
    if (k === 'fps') this.fpsEl.hidden = !v;
    if (k === 'sound') this.sound.setMuted(!v);
    if (k === 'engineSound') this.sound.setEngineSound(v); // 11-17 (sound builder)
    if (k === 'palette') this.applyPalette();
    if (k === 'steer' && v === 'tilt') this.input.startTilt(true).then((ok) => { if (!ok) { this.settings.steer = 'stick'; this.saveSettings(); this.input.applyLayout(); if (this.ui.name === 'settings') this.ui.settings(this.ui.from); } });
    this.input.applyLayout();
  }
  // day 4: volumes per channel (master, music, sfx), kept in the settings
  setVolume(ch, v) { this.settings.vol = Object.assign({}, this.settings.vol, { [ch]: v }); this.saveSettings(); this.sound.setVolume(ch, v); }
  // day 4: the zone colours (cyan and pink, or blue and amber for colour-blind players), in the road and the HUD
  applyPalette() {
    const safe = this.settings.palette === 'safe';
    if (this.world && this.world.setZoneColors) this.world.setZoneColors(new THREE.Color(safe ? '#3d8bff' : '#36f2ff'), new THREE.Color(safe ? '#ffb000' : '#ff3fa4'));
    document.documentElement.classList.toggle('cb-safe', safe); this.paletteWorld = this.world;
  }
  resetProgress() { this.progress = G.resetProgress(); this.afterGarageChange(); }
  // the garage changed something: rebuild the car's tune and looks, save
  afterGarageChange() {
    G.saveProgress(this.progress);
    this.retune();
    const lk = G.looks(this.progress);
    if (this.carMesh.bodyId !== this.progress.car) this.carMesh.build(this.progress.car, lk); else this.carMesh.setLook(lk);
    this.smoke.setTint(lk.smoke);
    this.carMesh.setDamage(G.carState(this.progress).damage);
  }
  retune() { if (this.car) this.car.setTune(G.deriveTune(this.progress)); }

  // ---------------------------------------------------------------- states
  parkAtStart() {
    this.car.reset(-9, 0); this.skids.clear(); this.score.reset();
    this.carMesh.setDamage(G.carState(this.progress).damage);
  }
  toTitle() {
    this.state = 'title'; this.hud.show(false); this.showTouch(false); this.parkAtStart(); this.titleS = 30; this.ui.title(); this.sound.music('menu');
    this.sound.setPaused(false); // 11-19 (2): Quit to menu from a paused race left the car's sound off (frame() follows it too)
    this.backdrop(true);
  }
  // Portero's painting is the title's backdrop; every other screen shows the 3D world
  // (11-18 (2): and behind the card of a course not built yet, bare: without the wordmark)
  backdrop(on, bare = false) { if (this.bootEl) { this.bootEl.classList.toggle('away', !on); this.bootEl.classList.toggle('bare', on && bare); } }
  // 11-18 (2): the garage's Back returns to the screen it was opened from (a results screen's to that course's card)
  enterGarage() { const n = this.ui.name; this.garageFrom = n === 'courses' ? 'courses' : n === 'course' || n === 'results' || n === 'duel-result' ? 'course' : 'title'; this.state = 'garage'; this.hud.show(false); this.showTouch(false); this.parkAtStart(); this.orbit = 0.6; }
  showTouch(on) { const t = document.getElementById('touch'); if (this.input.touch) t.hidden = !on; }
  startRun() {
    this.ui.clear();
    this.parkAtStart();
    this.retune();
    this.state = 'countdown'; this.count = 3.2; this.lastCount = 4; this.quality.hold(2);
    this.run = { time: 0, progress: 0, lapS: this.car.s, hits: [], wrong: 0, started: performance.now() };
    this.car.nosCharge = 1;
    this.cam.snap(this.car);
    this.hud.show(true); this.showTouch(true); this.input.showNos(this.car.T.car.nos);
    this.hud.condition(G.carState(this.progress).damage, G.condition(this.progress));
    if (this.settings.steer === 'tilt') this.input.centreTilt();
    this.sound.setEngine(G.soundHints(this.progress), this.car.T.car.redline, this.car.T.car.gears); // 11-18 (sound builder): the ratios
    this.sound.setView('chase');
    this.sound.music('race');
    // 11-19 (2): every run starts with its sound on (Restart in pause used to keep the pause's silence) and the context
    // asked to run (iOS may have stopped it on the menu; the touch that launched the race asked first)
    this.sound.setPaused(false); this.sound.wake('race');
    this.acc = 0;
  }
  pause() { if (this.state !== 'run' && this.state !== 'countdown') return; this.pausedFrom = this.state; this.state = 'paused'; this.showTouch(false); this.ui.pause(); this.sound.setPaused(true); }
  // (11-17's hold(), which froze the start line under the first-run tip card, went with the card on 11-18 (2): the
  // tips are on the race's loading screen now, js/tips.js)
  resume() { this.ui.clear(); this.state = this.pausedFrom || 'run'; this.showTouch(true); this.last = performance.now(); this.sound.setPaused(false); }
  finish() {
    if (this.duel && this.duel.lapDone()) return; // a downhill duel takes the lap's end (js/duel/duelui.js, day 4)
    this.score.bank('finish');
    const total = this.score.total, r = DriftScore.rate(total, this.course), p = this.progress;
    const pay = G.payout(p, { score: total, stars: r.stars, top: r.top }, this.course);
    pay.apply(); p.credits += pay.total; p.earned += pay.total; p.runs++;
    const best = p.best[this.course.id];
    const newBest = !best || total > best.score;
    if (newBest) p.best[this.course.id] = { score: total, stars: r.stars, top: r.top };
    G.saveProgress(p);
    const t = this.run.time;
    this.state = 'results'; this.hud.show(false); this.showTouch(false);
    this.lastResult = { score: total, stars: r.stars, top: r.top, newBest, pay, stats: this.score.stats, hits: this.run.hits, time: Math.floor(t / 60) + ':' + (t % 60).toFixed(1).padStart(4, '0') };
    this.ui.results(this.lastResult);
    this.sound.music('results');
  }

  // ---------------------------------------------------------------- the frame
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const ms = now - this.last; this.last = now;
    this.frame(Math.min(ms, 100) / 1000, ms);
  }
  frame(dt, ms) {
    // the loading screen is up: nothing is drawn, the build has the time. Under a race's tip screen the keys and a pad
    // still answer it (11-18 (2): Enter, Space or A goes once the course is ready; Esc or B goes back to the card)
    if (this.loading) { if (this.tipScreen.up) { this.input.read(dt); this.tipScreen.keys(this.input); } this.input.endFrame(); return; }
    const c0 = performance.now();
    this.time += dt;
    // 11-16: on a phone the world behind a menu is drawn about 30 times a second (10 while paused) rather than every
    // frame, so the phone has time for the taps; a run is drawn every frame as before, and its frame rate alone steers
    // the resolution
    const calm = this.input.touch && this.state !== 'run' && this.state !== 'countdown' && !this.capture;
    if (!calm) this.quality.sample(ms);
    const inp = this.autopilot && this.state === 'run' ? this.autopilot.drive(this.car, dt) : this.input.read(dt);
    if (this.state === 'run' || this.state === 'countdown') {
      if (this.input.pressed('pause') || this.input.edge('PadPause')) this.pause();
      if ((this.input.pressed('reset') || this.input.edge('PadReset')) && this.state === 'run') this.resetCar();
    } else if (this.state === 'paused' && this.ui.name === 'pause' && (this.input.pressed('pause') || this.input.edge('PadPause', 'PadB'))) this.resume();
    // 11-18 (2): on every menu screen but the title, Esc and a pad's B do what its back button does (ui.js back())
    else if (this.input.edge('Escape', 'PadB')) this.ui.back();
    if (this.input.edge('Backquote')) this.setSetting('fps', !this.settings.fps);
    this.input.endFrame();

    if (this.state === 'countdown') this.countdown(dt, inp);
    else if (this.state === 'run') this.simulate(dt, inp);
    else if (this.state === 'results') this.simulate(dt, { steer: 0, throttle: 0, brake: 0.25, handbrake: 0 }, true);

    // cameras
    if (this.state === 'title' || (this.state === 'paused' && false)) this.titleCam(dt);
    else if (this.state === 'garage') this.garageCam(dt);
    else if (this.state !== 'paused' && this.state !== 'look') this.cam.update(this.car, dt, this.time);
    if (this.state !== 'garage' && this.camera.view && this.camera.view.enabled) this.camera.clearViewOffset();

    this.world.lightAt(this.car.trackI, this.light);
    this.carMesh.update(this.car, this.light, dt);
    this.effects(dt);
    // zone lights: the one you are in pulses, the next one ahead glows
    const zs = this.world.zoneState; zs.fill(0);
    const ahead = this.nextZone(); if (ahead) zs[ahead.id] = 1;
    if (this.score.inZone && this.score.drifting && this.score.zoneNear) zs[this.score.zoneNear.id] = 2;
    if (this.paletteWorld !== this.world) this.applyPalette(); // a new course was built
    this.world.update(this.time);
    // sound (11-19 (2): the pause is the game's state, so no way out of a paused race can leave the car's sound off)
    this.sound.setPaused(this.state === 'paused');
    this.sound.setRPM(this.car.rpm); this.sound.setThrottle(this.state === 'run' || this.state === 'countdown' ? this.car.throttle : 0, this.car.boost);
    this.sound.setSlip(Math.max(this.car.slipR, this.car.slipF)); this.sound.setSpeed(this.car.speed); this.sound.setSurface(this.surface.under(this.car)); this.car.surfGrip = this.surface.grip; this.sound.setSpace(this.surface.space(this.car)); this.sound.tick();
    if (this.state === 'run' || this.state === 'countdown') this.hud.update(this.car, this.score, this.run, this.car.T.car.nos, TUNING.scoring.linkWindow);
    this.renderer.info.reset();
    // on the title the painting covers the view: draw the world only now and then, so it is ready, and save the battery
    const covered = this.state === 'title' && this.bootEl && !this.bootEl.classList.contains('away') && (this.coverT = (this.coverT || 0) + dt) < 1e9 && Math.floor(this.time * 2) === Math.floor((this.time - dt) * 2);
    let draw = !covered;
    if (draw && calm) { this.calmT = (this.calmT || 0) + dt; if (this.calmT >= (this.state === 'paused' ? 0.1 : 1 / 30) - 0.004) this.calmT = 0; else draw = false; }
    if (draw) {
      // tests only: GPU time per frame (EXT_disjoint_timer_query_webgl2), the frame drawn reps times over so the card
      // runs at its working clocks (a light load idles it down and the timer reads several times too slow)
      const q = this.gpuQ && this.gpuQ.begin();
      for (let i = this.gpuQ ? this.gpuQ.reps : 1; i > 0; i--) this.post.render(this.scene, this.camera, this.quality.bloom, this.flashT > 0 ? this.flashT : 0);
      if (q) this.gpuQ.end(q);
    }
    this.flashT = Math.max(0, (this.flashT || 0) - dt * 3);
    this.debug.tick(dt);
    this.fpsTick(dt, ms);
    (this.cpu ||= []).push(performance.now() - c0); if (this.cpu.length > 600) this.cpu.shift();
  }
  countdown(dt, inp) {
    this.count -= dt;
    const n = Math.ceil(this.count);
    if (n !== this.lastCount && n > 0 && n <= 3) { this.hud.msg(String(n)); this.sound.ui('count'); }
    this.lastCount = n;
    // held on the line: the engine can rev. 11-19 (2): the car's own hold (js/car.js), in first with the clutch down, the
    // gas taking the revs to the car's launch rpm, so GO carries straight on into the launch clutch with no flare
    this.car.step(dt, { steer: 0, throttle: inp.throttle, hold: true });
    if (this.count <= 0) { this.hud.msg('GO'); this.sound.ui('go'); this.state = 'run'; this.run.lapS = this.car.s; }
  }
  simulate(dt, inp, coasting = false) {
    this.acc = (this.acc || 0) + dt;
    let steps = 0;
    while (this.acc >= H && steps < 12) {
      this.acc -= H; steps++;
      const prevS = this.car.s;
      this.car.step(H, inp);
      for (const e of this.car.events) this.carEvent(e, coasting);
      this.car.events.length = 0;
      if (coasting) continue;
      this.score.update(H, this.car);
      for (const e of this.score.events) this.scoreEvent(e);
      this.score.events.length = 0;
      // nitrous fills while drifting in a zone
      if (this.car.T.car.nos && this.score.inZone && this.score.drifting) this.car.nosCharge = Math.min(1, this.car.nosCharge + TUNING.nos.fillPerSec * H * (this.score.sweet ? TUNING.nos.sweetBonus : 1));
      const ds = this.track.ds(prevS, this.car.s);
      this.run.progress += ds / this.track.length;
      this.run.wrong = ds < -0.002 && this.car.speed > 3 ? this.run.wrong + H : 0;
      if (this.run.wrong > 2.5) { this.hud.pop('Wrong way', 'info'); this.run.wrong = -3; }
      if (this.run.progress >= 1) { this.finish(); return; }
    }
    if (this.acc > H) this.acc = 0;
    if (!coasting) this.run.time += dt;
    if (this.nosWas !== this.car.nosOn) { this.nosWas = this.car.nosOn; this.sound.nos(this.car.nosOn); }
  }
  carEvent(e, coasting) {
    if (e.type === 'shift') { this.sound.shift(e.up, e.cut, e.gear); return; } // 11-18 (sound builder): the gear
    if (e.type === 'impact') {
      if (e.graze) { this.grazeFx(e); return; } // 11-19: a knock in a contact that is still a graze does no damage
      const h = G.hit(this.progress, e.rel, e.speed);
      if (h.amt > 0 || e.speed > 2) { this.run.hits && this.run.hits.push(h); this.retune(); this.carMesh.setDamage(G.carState(this.progress).damage); this.hud.condition(G.carState(this.progress).damage, G.condition(this.progress)); }
      const lx = this.track.tz[this.car.trackI] * e.side, lz = -this.track.tx[this.car.trackI] * e.side;
      const p = [this.car.x + lx * 1.0, this.car.y + 0.5, this.car.z + lz * 1.0];
      this.sparks.burst(p, -lx, -lz, e.speed, this.time, this.rnd);
      this.cam.hit(clamp(e.speed / 10, 0.15, 1));
      this.sound.impact(e.speed > 6 ? 'hard' : 'scrape', clamp(e.speed / 12, 0, 1));
    }
    if (e.type === 'wall' && !coasting) {
      const lost = this.score.chainValue;
      this.score.wipe('wall');
      this.score.events.length = 0;
      this.hud.pop(lost > 0 ? `Wall! Chain lost (${lost.toLocaleString('en-US')})` : 'Wall!', 'wipe');
      if (lost > 0) this.sound.ui('wipe');
      this.hud.flash(); this.flashT = 1;
    }
    // 11-19 (Evrtek: "if you graze the wall gently, then I don't want that to be a punishment"): a graze keeps the chain
    // (car.js judges each contact). It says so in a small pop, not more than once in 1.2 s along a wall
    if (e.type === 'graze') {
      this.grazeFx(e);
      if (!coasting && !(this.time - this.grazeT < 1.2)) { this.hud.pop('Kissed the wall', 'graze'); this.grazeT = this.time; }
    }
  }
  // 11-19: a graze, felt: a few sparks where the corner met the wall and the light scrape (the sound module maps
  // 'graze' to its scrape takes), no camera kick, no damage
  grazeFx(e) {
    const lx = this.track.tz[this.car.trackI] * e.side, lz = -this.track.tx[this.car.trackI] * e.side;
    this.sparks.burst([e.x, this.car.y + 0.4, e.z], -lx, -lz, 0, this.time, this.rnd);
    this.sound.impact('graze', clamp(e.speed / 12, 0.04, 0.16));
  }
  scoreEvent(e) {
    if (e.type === 'link') { this.hud.pop(`Linked ×${e.mult}`, 'link'); this.sound.ui('link'); }
    if (e.type === 'bank' && e.value > 0) { this.hud.pop(`Banked +${e.value.toLocaleString('en-US')}`, 'bank'); this.sound.ui('bank'); }
    if (e.type === 'start') this.sound.ui('zone');
    // 11-18 (game builder): the new multiplier steps. A hold ticks the HUD's badge (its ring) and chimes; a switchback pops
    if (e.type === 'hold' && e.add > 0) this.sound.ui('sweet');
    if (e.type === 'switch') { this.hud.pop(`Switchback ×${e.mult}`, 'link switch'); this.sound.ui('link'); }
  }
  resetCar() {
    const s = this.car.s;
    if (this.score.acc > 0) this.hud.pop('Reset: chain lost', 'wipe');
    this.score.wipe('reset'); this.score.events.length = 0;
    this.car.reset(s, 0); this.skids.lift(); this.cam.snap(this.car);
  }
  nextZone() { let best = null, bd = Infinity; for (const z of this.track.zones) { const d = this.track.ds(this.car.s, z.s0); if (d > 0 && d < bd) { bd = d; best = z; } } return best; }

  effects(dt) {
    const car = this.car, F = TUNING.fx, p = [0, 0, 0];
    const lum = 0.25 + Math.min(1.6, (this.light[0] + this.light[1] + this.light[2]) / 3 * 1.2);
    const smokeLight = [Math.min(1.2, 0.35 + this.light[0] * 0.8), Math.min(1.2, 0.32 + this.light[1] * 0.75), Math.min(1.2, 0.4 + this.light[2] * 0.75)];
    const amount = { full: 1, less: 0.55, min: 0.3 }[this.settings.smoke || 'full'];
    this.smoke.maxDensity = { full: 1, less: 0.8, min: 0.6 }[this.settings.smoke || 'full'];
    const ease = this.smoke.crowd(this.camera.position, this.time) * amount; // less smoke when the camera is already in it, or by choice
    const lx = Math.cos(car.psi), lz = -Math.sin(car.psi);
    const active = this.state === 'run' || this.state === 'results' || this.state === 'countdown';
    for (let k = 0; k < 4; k++) {
      const rear = k >= 2, slip = rear ? car.slipR : car.slipF;
      car.wheelPos(k, p);
      // skids
      this.skids.mark(k, p, lx, lz, active && car.speed > 2 ? clamp((slip - F.skidSlip) * 1.8, 0, 1) : 0);
      // smoke from the rears
      if (rear && active && slip > F.smokeSlip && car.speed > 3) {
        this['sm' + k] = (this['sm' + k] || 0) + F.smokeRate * (car.T.car.smokeMul || 1) * ease * (slip - F.smokeSlip) * dt * (this.quality.tier === 0 ? 0.5 : 1);
        while (this['sm' + k] >= 1) {
          this['sm' + k] -= 1;
          const r = this.rnd;
          this.smoke.emit(p[0] + (r() - 0.5) * 0.3, p[1] + 0.25, p[2] + (r() - 0.5) * 0.3, car.vx * 0.22 + (r() - 0.5) * 2.5, 0.4 + r(), car.vz * 0.22 + (r() - 0.5) * 2.5, smokeLight, 1.6 + r() * 1.2, this.time);
        }
      }
    }
    // a hurt engine smokes from the bonnet
    const dmg = G.carState(this.progress).damage;
    if (active && dmg.engine > TUNING.damage.smokeAt && this.rnd() < dt * 8) { const fx = Math.sin(car.psi), fz = Math.cos(car.psi); this.smoke.emit(car.x + fx * 1.6, car.y + 0.9, car.z + fz * 1.6, car.vx * 0.5, 1.2, car.vz * 0.5, [0.25, 0.22, 0.25], 1.2, this.time); }
    this.smoke.flush(this.time); this.skids.flush(); this.sparks.flush(this.time);
    const sp = car.speed * 3.6;
    this.lines.update(this.time, active ? (sp - 95) / 90 + (car.nosOn ? 0.6 : 0) : 0);
    void lum;
  }
  titleCam(dt) {
    // a slow drive-by along the harbour and up the pass, at sunset
    this.titleS = (this.titleS + dt * 9) % this.track.length;
    const a = this.track.point(this.titleS, 9), b = this.track.point(this.titleS + 45, -2);
    this.camera.position.set(a[0], a[1] + 4.5, a[2]); this.camera.lookAt(b[0], b[1] + 1.5, b[2]);
    if (this.camera.fov !== 58) { this.camera.fov = 58; this.camera.updateProjectionMatrix(); }
  }
  // Day 4: the car framed in the space beside the garage panel, its face toward you (a front three-quarter view that
  // sways a little), on any screen. The panel's left edge says how much room there is; the projection's centre is
  // moved into that room (setViewOffset), so the car sits in the middle of it rather than behind the panel; the distance
  // is the one that makes the car about two thirds of that room's width.
  garageCam(dt) {
    this.orbit += dt;
    const c = this.car, cam = this.camera, W = view.w, H = view.h;
    const panel = document.querySelector('.gpanel'), left = panel ? Math.max(W * 0.3, panel.getBoundingClientRect().left - view.x) : W;
    const room = left / W, fov = 40, tanH = Math.tan(fov * Math.PI / 360) * (W / H);
    const r = Math.max(4.6, Math.min(11, 4.4 / (1.4 * room * tanH)));
    const ang = c.psi + 0.62 + Math.sin(this.orbit * 0.22) * 0.32;
    cam.position.set(c.x + Math.sin(ang) * r, c.y + 1.15 + r * 0.06, c.z + Math.cos(ang) * r);
    cam.lookAt(c.x, c.y + 0.55, c.z);
    if (cam.fov !== fov) cam.fov = fov;
    const dx = Math.round(W / 2 - left / 2); // the room's centre is this far left of the screen's
    if (!cam.view || cam.view.offsetX !== dx || cam.view.fullWidth !== W || cam.view.fullHeight !== H) cam.setViewOffset(W, H, dx, 0, W, H);
    cam.updateProjectionMatrix();
  }
  fpsTick(dt, ms) {
    this.frames.push(ms); if (this.frames.length > 240) this.frames.shift();
    this.fpsT += dt; if (this.fpsT < 0.25 || this.fpsEl.hidden) return; this.fpsT = 0;
    const f = this.frames.slice(-60), avg = f.reduce((a, b) => a + b, 0) / f.length, worst = Math.max(...f);
    const info = this.renderer.info.render;
    this.fpsEl.textContent = `${(1000 / avg).toFixed(0)} fps  ${avg.toFixed(1)} ms (worst ${worst.toFixed(0)})\n${['LOW', 'MEDIUM', 'HIGH'][this.quality.tier]}  res ${(this.quality.scale * 100).toFixed(0)}%  x${this.renderer.getPixelRatio().toFixed(2)}\ndraws ${info.calls}  tris ${(info.triangles / 1000).toFixed(0)}k`;
  }

  // ---------------------------------------------------------------- test hooks (?test): never loaded for players
  async testHooks() {
    const { Autopilot } = await import('./autopilot.js?v=0.1.19');
    this.capture = params.has('capture');
    const g = this;
    window.__dl = {
      game: g, version: VERSION,
      autopilot(on, opt) { g.autopilot = on ? new Autopilot(g.track, opt || {}) : null; },
      start() { g.startRun(); },
      // advance the game by n fixed frames of 1/60 s (capture mode renders each)
      step(n = 1) {
        for (let i = 0; i < n; i++) g.frame(1 / 60, 1000 / 60);
        // keep the page's CSS animations (pops, count-down, flashes) on game time, not wall time
        for (const an of document.getAnimations()) { if (an._t0 === undefined) an._t0 = g.time; an.pause(); an.currentTime = Math.max(0, (g.time - an._t0) * 1000); }
        return g.state;
      },
      state() { const c = g.car, s = g.score; return { state: g.state, ui: g.ui.name, speed: c.speed * 3.6, beta: c.beta * 57.3, s: c.s, lat: c.lat, total: s.total, acc: s.acc, mult: s.mult, progress: g.run.progress, credits: g.progress.credits, tier: g.quality.tier, scale: g.quality.scale, ratio: g.renderer.getPixelRatio(), fps: g.frames.length ? 1000 / (g.frames.slice(-120).reduce((a, b) => a + b, 0) / Math.min(120, g.frames.length)) : 0 }; },
      frames() { return g.frames.slice(); },
      // GPU time per frame, where the browser gives timer queries (tests only)
      gpuTimer(on, reps = 1) {
        const gl = g.renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        if (!on || !ext) { g.gpuQ = null; return !!ext; }
        const pending = [], done = [];
        g.gpuQ = { done, reps, begin() { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); return q; }, end(q) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(q); for (let i = pending.length - 1; i >= 0; i--) { const x = pending[i]; if (gl.getQueryParameter(x, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(ext.GPU_DISJOINT_EXT)) { done.push(gl.getQueryParameter(x, gl.QUERY_RESULT) / 1e6 / g.gpuQ.reps); gl.deleteQuery(x); pending.splice(i, 1); } } if (done.length > 600) done.shift(); } };
        return true;
      },
      gpu() { return g.gpuQ ? g.gpuQ.done.slice() : []; },
      cpu() { return (g.cpu || []).slice(); },
      progress() { return JSON.parse(JSON.stringify(g.progress)); },
      setCredits(n) { g.progress.credits = n; G.saveProgress(g.progress); },
      fast(on) { g.fastForward = on; },
      // courses: switch, the craft-rule audit, and a lap driven through the game's own simulate() without rendering
      loadCourse(id) { return g.loadCourse(id); },
      audit() { return g.world.audit(); },
      course() { const c = g.course; return { id: c.id, name: c.name, length: g.track.length, zones: g.track.zones.length }; },
    };
  }
}
function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const game = new Game();
game.boot().catch((e) => { console.error(e); const b = document.querySelector('.boot-mark'); if (b) b.textContent = 'This device could not start the game (' + (e && e.message ? e.message : e) + ').'; });
void appIcon;
