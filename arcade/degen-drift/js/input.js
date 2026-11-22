// DRIFTLINE: controls. Keyboard (WASD or arrows, Space handbrake, Shift or R reset, N or E nitrous, Esc or P pause),
// a gamepad if one is connected (left stick, triggers, A handbrake, Y reset, B nitrous, Start pause), and on phones,
// held sideways, on-screen controls with three throttle schemes from Evrtek's note, switchable in Settings:
//   slider   - a throttle slider under the right thumb (release = off)
//   pressure - "more thumb": a pad that reads how hard (Touch.force, where the phone reports real force), else how
//              much thumb is on the glass (the contact radius growing as it flattens), else where on the pad the thumb
//              sits (higher = more). A gauge beside it shows the value it is reading and which of the three it uses.
//   buttons  - plain GAS and BRAKE.
// Steering on a phone: a floating stick under the left thumb, or tilt (the phone turned like a wheel).
import { view } from './fit.js?v=0.1.18';
import { TUNING } from './config.js?v=0.1.18';
import { shapeStick } from './stick.js?v=0.1.18';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// Day 4: every keyboard action can be moved (Settings > Keys); the arrows, E, P and Shift always work as well.
export const ACTIONS = [
  ['left', 'Steer left', 'KeyA'], ['right', 'Steer right', 'KeyD'], ['up', 'Throttle', 'KeyW'], ['down', 'Brake / reverse', 'KeyS'],
  ['hand', 'Handbrake', 'Space'], ['nos', 'Nitrous', 'KeyN'], ['reset', 'Reset', 'KeyR'], ['pause', 'Pause', 'Escape'],
];
const ALT = { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], hand: [], nos: ['KeyE'], reset: ['ShiftLeft', 'ShiftRight'], pause: ['KeyP'] };
export const keyName = (code) => ({ Space: 'Space', Escape: 'Esc', ShiftLeft: 'Shift', ShiftRight: 'Right Shift', ControlLeft: 'Ctrl', ControlRight: 'Right Ctrl', AltLeft: 'Alt', Enter: 'Enter', Backspace: 'Backspace', Tab: 'Tab' }[code] || code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '').replace(/^Numpad/, 'Num '));
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export class Input {
  constructor(settings) {
    this.settings = settings;
    this.keys = new Set(); this.edges = new Set();
    this.out = { steer: 0, throttle: 0, brake: 0, handbrake: 0, nos: false, analog: false };
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.pad = null; this.padPrev = [];
    this.t = { steer: 0, steerOn: false, throttle: 0, brake: 0, hand: 0, nos: false };
    this.press = { source: 'none', raw: 0, base: 0, value: 0, forceSeen: false, radiusSeen: false, rMin: Infinity, rMax: 0, fMin: 1, fMax: 0 };
    this.tilt = { on: false, angle: 0, neutral: null, ok: false };
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.code;
      if (this.capturing) { e.preventDefault(); const done = this.capturing; this.capturing = null; done(k === 'Escape' ? null : k); return; }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k) || this.mapped().has(k)) e.preventDefault();
      this.keys.add(k); this.edges.add(k);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }
  edge(...codes) { let hit = false; for (const c of codes) if (this.edges.has(c)) hit = true; return hit; }
  // the keys an action answers to: the player's own (settings.keys) or the default, plus the fixed alternates
  keysFor(a) { const def = ACTIONS.find((x) => x[0] === a)[2]; return [(this.settings.keys && this.settings.keys[a]) || def, ...ALT[a]]; }
  held(a) { for (const k of this.keysFor(a)) if (this.keys.has(k)) return true; return false; }
  pressed(a) { return this.edge(...this.keysFor(a)); }
  mapped() { const m = new Set(); for (const [a] of ACTIONS) for (const k of this.keysFor(a)) m.add(k); return m; }
  // the next key pressed is handed to done (Esc cancels)
  capture(done) { this.capturing = done; this.keys.clear(); }
  endFrame() { this.edges.clear(); }

  // ---------------------------------------------------------------- phone controls
  mountTouch(root) {
    this.root = root;
    root.innerHTML = `
      <div class="tc-steer" id="tc-steer"><div class="tc-rest" id="tc-rest"><i></i></div><div class="tc-ring" id="tc-ring"><div class="tc-knob" id="tc-knob"></div></div><div class="tc-tilt" id="tc-tilt"><span></span></div></div>
      <div class="tc-right">
        <button class="tc-btn tc-nos" id="tc-nos" hidden aria-label="Nitrous"><svg viewBox="0 0 40 40"><path d="M14 6h12v6l3 3v19a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V15l3-3z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M15 22h10M15 28h10" stroke="currentColor" stroke-width="3"/></svg></button>
        <button class="tc-btn tc-brake" id="tc-brake" aria-label="Brake"><svg viewBox="0 0 40 40"><rect x="6" y="11" width="28" height="19" rx="5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M11 17h18M11 21h18M11 25h18" stroke="currentColor" stroke-width="2"/></svg></button>
        <button class="tc-btn tc-hand" id="tc-hand" aria-label="Handbrake"><svg viewBox="0 0 40 40"><path d="M10 32 L28 10" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="29" cy="9" r="5" fill="currentColor"/><path d="M6 33h14" stroke="currentColor" stroke-width="3"/></svg></button>
        <div class="tc-gas" id="tc-gas"><div class="tc-fill" id="tc-gas-fill"></div><svg viewBox="0 0 40 64"><rect x="9" y="6" width="22" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M14 16h12M14 22h12M14 28h12M14 34h12M14 40h12M14 46h12" stroke="currentColor" stroke-width="2"/></svg></div>
        <div class="tc-slider" id="tc-slider"><div class="tc-fill" id="tc-slider-fill"></div><div class="tc-grip" id="tc-grip"></div></div>
        <div class="tc-gauge" id="tc-gauge"><div class="tc-gfill" id="tc-gfill"></div><div class="tc-glabel" id="tc-glabel">AREA</div></div>
      </div>`;
    const $ = (id) => root.querySelector('#' + id);
    this.el = { steer: $('tc-steer'), ring: $('tc-ring'), knob: $('tc-knob'), tiltEl: $('tc-tilt'), nos: $('tc-nos'), brake: $('tc-brake'), hand: $('tc-hand'), gas: $('tc-gas'), gasFill: $('tc-gas-fill'), slider: $('tc-slider'), sliderFill: $('tc-slider-fill'), grip: $('tc-grip'), gauge: $('tc-gauge'), gfill: $('tc-gfill'), glabel: $('tc-glabel') };
    this.owners = new Map(); // touch id -> control name
    this.stick = { id: null, x0: 0, y0: 0 };
    const opts = { passive: false };
    root.addEventListener('touchstart', (e) => this.onTouch(e, 'start'), opts);
    root.addEventListener('touchmove', (e) => this.onTouch(e, 'move'), opts);
    root.addEventListener('touchend', (e) => this.onTouch(e, 'end'), opts);
    root.addEventListener('touchcancel', (e) => this.onTouch(e, 'end'), opts);
    this.applyLayout();
  }
  applyLayout() {
    if (!this.el) return;
    const s = this.settings;
    this.root.dataset.throttle = s.throttle; this.root.dataset.steer = s.steer;
    this.el.slider.hidden = s.throttle !== 'slider';
    this.el.gas.hidden = s.throttle === 'slider';
    this.el.gauge.hidden = s.throttle !== 'pressure';
    this.el.tiltEl.hidden = s.steer !== 'tilt';
    this.tilt.on = s.steer === 'tilt';
    if (this.tilt.on) this.startTilt(false);
  }
  showNos(on) { if (this.el) this.el.nos.hidden = !on; }
  // 11-17 (2), with the brake beside the gas: a touch on a control is that control, and the 10 px margin round each
  // goes to the nearest one (it went to the first in a fixed order, so the brake's margin could take the gas's edge)
  hit(x, y) {
    const away = (el) => { if (!el || el.hidden) return Infinity; const r = el.getBoundingClientRect(); return Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom)); };
    const slider = this.settings.throttle === 'slider';
    let best = null, bd = 10.001;
    for (const [name, el] of [['nos', this.el.nos], ['hand', this.el.hand], ['brake', this.el.brake], slider ? ['slider', this.el.slider] : ['gas', this.el.gas]]) {
      const d = away(el); if (d < bd) { bd = d; best = name; }
    }
    if (best) return best;
    if (x < view.x + view.w * 0.5 && this.settings.steer === 'stick') return 'stick';
    return null;
  }
  onTouch(e, phase) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const id = t.identifier;
      if (phase === 'start') {
        const what = this.hit(t.clientX, t.clientY);
        // the HUD's pause button sits under this layer: pass its taps on
        if (!what) { const pb = document.getElementById('pause-btn').getBoundingClientRect(); if (t.clientX >= pb.left - 8 && t.clientX <= pb.right + 8 && t.clientY >= pb.top - 8 && t.clientY <= pb.bottom + 8 && this.onPause) this.onPause(); continue; }
        this.owners.set(id, what);
        if (what === 'stick') { this.stick = { id, x0: t.clientX, y0: t.clientY }; const r = this.el.steer.getBoundingClientRect(); this.el.ring.style.transform = `translate(${t.clientX - r.left - 60}px, ${t.clientY - r.top - 60}px)`; this.el.ring.classList.add('on'); this.el.steer.classList.add('held'); }
        if (what === 'gas') this.pressStart(t);
      }
      const what = this.owners.get(id);
      if (!what) continue;
      if (phase === 'end') { this.owners.delete(id); if (what === 'stick') { this.t.steer = 0; this.t.steerOn = false; this.el.ring.classList.remove('on'); this.el.steer.classList.remove('held'); this.el.knob.style.transform = ''; } continue; }
      // pads may be slid between (gas <-> handbrake <-> brake); the stick and the slider keep their thumb
      if (phase === 'move' && what !== 'stick' && what !== 'slider') { const now = this.hit(t.clientX, t.clientY); if (now && now !== 'stick' && now !== what) { this.owners.set(id, now); if (now === 'gas') this.pressStart(t); } }
      if (what === 'stick') {
        const dx = clamp((t.clientX - this.stick.x0) / 62, -1, 1);
        this.t.steer = -dx; this.t.steerOn = true;
        this.el.knob.style.transform = `translateX(${dx * 42}px)`;
      }
      if (what === 'slider') { const r = this.el.slider.getBoundingClientRect(); this.t.sliderV = clamp(1 - (t.clientY - r.top - 14) / (r.height - 28), 0, 1); }
      if (this.owners.get(id) === 'gas') this.pressRead(t);
    }
    // what each control is doing now
    let gas = false, brake = false, hand = false, nos = false, slider = false;
    for (const [, w] of this.owners) { if (w === 'gas') gas = true; if (w === 'brake') brake = true; if (w === 'hand') hand = true; if (w === 'nos') nos = true; if (w === 'slider') slider = true; }
    if (!slider) this.t.sliderV = 0;
    this.t.gas = gas; this.t.brake = brake ? 1 : 0; this.t.hand = hand ? 1 : 0; this.t.nos = nos;
    if (!gas) this.press.value = 0;
    for (const [k, on] of [['brake', brake], ['hand', hand], ['nos', nos], ['gas', gas]]) this.el[k].classList.toggle('down', on);
  }
  // ---- "more thumb": force where the phone reports real force, else contact size, else thumb position
  // Each press is read against how it started: the contact size (or force) of the first moments of this touch is the
  // floor, and more thumb from there opens the throttle, to full at about 45% more radius (or firm force). Touching the
  // pad always gives a little (PRESS_FLOOR), so the car never sits still under a thumb.
  pressStart(t) { this.press.touchBase = Infinity; this.press.t0 = performance.now(); this.pressRead(t); }
  pressRead(t) {
    const P = this.press, f = t.force || 0, r = Math.max(t.radiusX || 0, t.radiusY || 0), FLOOR = 0.25;
    // real force: a value strictly between 0 and 1 (and not the 0.5 some browsers report as "unknown"), or one that varies
    if (f > 0 && f < 1 && Math.abs(f - 0.5) > 1e-3) P.forceSeen = true;
    if (f > 0) { P.fMin = Math.min(P.fMin, f); P.fMax = Math.max(P.fMax, f); if (P.fMax - P.fMin > 0.02) P.forceSeen = true; }
    if (r > 0) { P.rMin = Math.min(P.rMin, r); P.rMax = Math.max(P.rMax, r); if (P.rMax - P.rMin >= 0.9) P.radiusSeen = true; if (performance.now() - P.t0 < 90) P.touchBase = Math.min(P.touchBase, r); }
    const want = this.settings.pressure; // auto | force | area | position
    let src = want === 'auto' ? (P.forceSeen ? 'force' : r > 0 ? 'area' : 'position') : want;
    if (src === 'force' && !(f > 0)) src = r > 0 && want === 'auto' ? 'area' : 'position';
    if (src === 'area' && !(r > 0)) src = 'position';
    let v;
    if (src === 'force') { P.raw = f; v = FLOOR + (1 - FLOOR) * clamp((f - 0.12) / 0.55, 0, 1); }
    else if (src === 'area') { const base = isFinite(P.touchBase) ? P.touchBase : r; P.raw = r; P.base = base; v = FLOOR + (1 - FLOOR) * clamp((r - base) / Math.max(1.5, base * 0.45), 0, 1); }
    else { const rc = this.el.gas.getBoundingClientRect(); P.raw = t.clientY; v = clamp(1 - (t.clientY - rc.top) / rc.height, FLOOR, 1); }
    P.source = src; P.target = v;
  }
  // ---- tilt (the phone turned like a wheel): the angle of gravity in the screen's plane, against a neutral taken
  // when tilt is switched on and at every start. Using the relative angle makes it immune to platforms that report
  // the gravity vector with the opposite sign.
  async startTilt(fromGesture) {
    if (this.tiltBound) return true;
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        if (!fromGesture) return false;
        const r = await DeviceMotionEvent.requestPermission(); if (r !== 'granted') return false;
      }
    } catch (e) { return false; }
    addEventListener('devicemotion', (e) => {
      const g = e.accelerationIncludingGravity; if (!g || g.x === null) return;
      const a = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * Math.PI / 180;
      const sx = g.x * Math.cos(a) - g.y * Math.sin(a), sy = g.x * Math.sin(a) + g.y * Math.cos(a);
      this.tilt.angle = Math.atan2(sy, sx); this.tilt.ok = true;
      if (this.tilt.neutral === null) this.tilt.neutral = this.tilt.angle;
    });
    this.tiltBound = true; return true;
  }
  centreTilt() { this.tilt.neutral = this.tilt.ok ? this.tilt.angle : null; }

  // ---------------------------------------------------------------- per frame
  read(dt) {
    const k = this.keys, o = this.out;
    let steer = 0, thr = 0, brk = 0, hand = 0, nos = false, analog = false;
    if (this.held('left')) steer += 1;
    if (this.held('right')) steer -= 1;
    if (this.held('up')) thr = 1;
    if (this.held('down')) brk = 1;
    if (this.held('hand')) hand = 1;
    if (this.held('nos')) nos = true;
    void k;
    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && [...pads].find((p) => p && p.connected);
    this.pad = gp || null;
    if (gp) {
      const ax = gp.axes[0] || 0, dz = 0.12;
      if (Math.abs(ax) > dz) { steer = -Math.sign(ax) * (Math.abs(ax) - dz) / (1 - dz); analog = true; }
      const b = (i) => (gp.buttons[i] ? gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0) : 0);
      thr = Math.max(thr, b(7)); brk = Math.max(brk, b(6)); hand = Math.max(hand, b(0), b(5)); if (b(1) > 0.5) nos = true;
      const prev = this.padPrev; const press = (i) => b(i) > 0.5 && !(prev[i] > 0.5);
      if (press(3)) this.edges.add('PadReset'); if (press(9)) this.edges.add('PadPause'); if (press(0)) this.edges.add('PadA'); // A: skips a race's tip screen
      if (press(1)) this.edges.add('PadB'); // 11-18 (2): B is back on a menu (in a run it is still the nitrous)
      this.padPrev = gp.buttons.map((x) => x.value || (x.pressed ? 1 : 0));
    }
    // phone
    if (this.el) {
      const t = this.t, s = this.settings;
      // 11-17 (2): the stick through its shaping (js/stick.js: a dead zone and a curve; straight with the old feel)
      if (s.steer === 'stick' && t.steerOn) { steer = shapeStick(t.steer, TUNING.steer, TUNING.assist); analog = true; }
      if (s.steer === 'tilt' && this.tilt.ok && this.tilt.neutral !== null) { steer = clamp(-wrap(this.tilt.angle - this.tilt.neutral) / (28 * Math.PI / 180), -1, 1); if (Math.abs(steer) < 0.04) steer = 0; analog = true; }
      if (s.throttle === 'slider') { thr = Math.max(thr, t.sliderV || 0); this.el.sliderFill.style.height = ((t.sliderV || 0) * 100) + '%'; this.el.grip.style.bottom = `calc(${(t.sliderV || 0) * 100}% - ${(t.sliderV || 0) * 28}px)`; }
      else if (s.throttle === 'buttons') { thr = Math.max(thr, t.gas ? 1 : 0); }
      else {
        const P = this.press; P.value += ((t.gas ? P.target || 0 : 0) - P.value) * Math.min(1, dt * 14);
        thr = Math.max(thr, P.value);
        this.el.gfill.style.height = (P.value * 100) + '%';
        this.el.gasFill.style.height = (P.value * 100) + '%';
        this.el.gauge.classList.toggle('full', P.value > 0.97);
        this.el.glabel.textContent = P.source === 'force' ? 'FORCE ' + P.raw.toFixed(2) : P.source === 'area' ? 'AREA ' + P.raw.toFixed(1) : t.gas ? 'POSITION' : (P.forceSeen ? 'FORCE' : P.radiusSeen ? 'AREA' : '---');
      }
      brk = Math.max(brk, t.brake); hand = Math.max(hand, t.hand); nos = nos || t.nos;
    }
    o.steer = steer; o.throttle = thr; o.brake = brk; o.handbrake = hand; o.nos = nos; o.analog = analog;
    return o;
  }
}
