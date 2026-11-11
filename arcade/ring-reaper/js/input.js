// STARWAKE: input. Everything resolves to one steering target in the flight box (tx, ty in -1..1) plus a few
// one-shot requests the game drains each frame (roll, greed, pause).
//
// PHONE (Evrtek 11-05, ruling 1 as amended): drag anywhere to steer, RELATIVE, so a finger landing never moves
// the ship; only its travel does. A DOUBLE TAP anywhere rolls: the second touch-down must come within 280 ms of
// the first tap lifting, within 40 px of it, and the first must have been a tap (short, barely moved). Taps on a
// button never count. GREED has its own button, so a double tap only ever means roll.
// PC (0.3.0, Evrtek 11-06; Q/E are gone, those fingers steer): the mouse steers absolutely (the ship chases the
// pointer) and WASD/arrows move the target. ROLL is Space and the left mouse button (the way you are going); GREED is
// Shift and the right mouse button; PAUSE is Esc and P; M toggles the music. Roll, GREED and Pause are rebindable in
// Options (a primary and a secondary key each) and the mouse buttons can be switched off; kept in 'ringreaper.keys'.
// The mouse buttons act only while flying and only on the play field (the canvas): a click on the pause button, the
// HUD or any menu never rolls. No pointer lock: the steering is the pointer's own position, so a click moves nothing.
// THE MODE (0.3.0): what the player is using right now, not what the device is. Any touch means 'touch'; a key or a
// real mouse move means 'pc'. It switches live (a laptop with a touch screen), and every control text follows it.
import { clamp, store } from './util.js?v=0.6.3';

const DT_MS = 280, DT_PX = 40, TAP_MS = 250, TAP_PX = 14;
export const DEFAULT_KEYS = { roll: ['Space', ''], greed: ['Shift', ''], pause: ['Escape', 'KeyP'], mouse: true };
export const ACTIONS = ['roll', 'greed', 'pause'];
// keys that already have a job nothing can take from them: the steering, and M (the music)
export const RESERVED = { KeyW: 'STEERS', KeyA: 'STEERS', KeyS: 'STEERS', KeyD: 'STEERS', ArrowUp: 'STEERS', ArrowDown: 'STEERS', ArrowLeft: 'STEERS', ArrowRight: 'STEERS', KeyM: 'TOGGLES THE MUSIC' };
const MOD = { ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Control', ControlRight: 'Control', AltLeft: 'Alt', AltRight: 'Alt', MetaLeft: 'Meta', MetaRight: 'Meta' };
// a key press as a binding: the physical key (so a layout change does not move it), left and right modifiers as one
export function codeOf(e) {
  if (e.code && e.code !== e.key) return MOD[e.code] || e.code;
  const k = e.key || '';
  if (k === ' ') return 'Space';
  if (/^[a-z]$/i.test(k)) return 'Key' + k.toUpperCase();
  if (/^[0-9]$/.test(k)) return 'Digit' + k;
  return MOD[k] || k;
}
const NAMES = { Space: 'SPACE', Shift: 'SHIFT', Control: 'CTRL', Alt: 'ALT', Meta: 'CMD', Escape: 'ESC', Enter: 'ENTER', Tab: 'TAB', Backspace: 'BKSP', CapsLock: 'CAPS',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'",
  Backquote: '`', Comma: ',', Period: '.', Slash: '/', Delete: 'DEL', Insert: 'INS', Home: 'HOME', End: 'END', PageUp: 'PGUP', PageDown: 'PGDN' };
export function keyLabel(code) {
  if (!code) return '';
  if (NAMES[code]) return NAMES[code];
  let m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
  m = /^Digit(\d)$/.exec(code); if (m) return m[1];
  m = /^Numpad(.+)$/.exec(code); if (m) return 'NUM ' + m[1].toUpperCase();
  return code.toUpperCase();
}

export class Input {
  constructor(el, touchDevice = false) {
    this.el = el;
    this.tx = 0; this.ty = 0;
    this.keys = new Set();
    this.mouseActive = false; this.mx = 0; this.my = 0;
    this.req = { roll: null, greed: false, pause: false, music: false, any: false };
    // live: every finger down on the field (not on a button), id -> its last spot (11-07: steering hands over among them)
    this.touch = { id: null, x: 0, y: 0, down: null, lastTap: null, live: new Map() };
    this.lastKind = 'none';
    this.mode = touchDevice ? 'touch' : 'pc'; this.onMode = null; this.onBinds = null;
    this.capturing = false; // Options is waiting for a key to bind: the play keys stand down
    this.binds = this.loadBinds();
    this.enabled = false;
    this.stats = { taps: 0, doubleTaps: 0, dragPx: 0 };
    this._bind();
  }
  _bind() {
    const on = (t, ev, fn, o) => t.addEventListener(ev, fn, o);
    on(window, 'keydown', (e) => {
      const k = (e.key || '').toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift'].includes(k)) e.preventDefault();
      if (this.capturing) return;
      this.setMode('pc');
      if (e.repeat) { this.keys.add(k); return; }
      this.keys.add(k); this.lastKind = 'key'; this.req.any = true;
      const c = codeOf(e), B = this.binds;
      if (B.roll.includes(c)) this.req.roll = { dir: 0, hint: 0 };     // the way you are going
      else if (B.greed.includes(c)) this.req.greed = true;
      else if (B.pause.includes(c)) this.req.pause = true;
      else if (c === 'KeyM') this.req.music = true;
    });
    on(window, 'keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    on(window, 'blur', () => this.keys.clear());
    on(window, 'mousemove', (e) => {
      if (this.lastKind === 'touch' && performance.now() - (this._touchAt || 0) < 800) return; // emulated mouse after a touch
      this.mouseActive = true; this.lastKind = 'mouse'; this.setMode('pc');
      this.mx = e.clientX; this.my = e.clientY;
    });
    on(window, 'mousedown', () => { this.req.any = true; });
    // the mouse buttons, on the play field only (anything over it, a button or a menu, is its own target)
    on(this.el, 'mousedown', (e) => {
      if (performance.now() - (this._touchAt || 0) < 800) return; // the mouse a touch screen makes up after a tap
      this.setMode('pc');
      e.preventDefault(); // no text selection, no focus change: the pointer (and so the steering) stays put
      if (!this.enabled || !this.binds.mouse) return;
      if (e.button === 0) this.req.roll = { dir: 0, hint: 0 };
      else if (e.button === 2) this.req.greed = true;
    });
    const isButton = (t) => t && t.closest && t.closest('button, a');
    on(document, 'touchstart', (e) => {
      this._touchAt = performance.now(); this.lastKind = 'touch'; this.mouseActive = false; this.req.any = true; this.setMode('touch');
      if (isButton(e.target)) return;            // buttons do their own thing and never count as taps
      if (this.enabled && e.cancelable) e.preventDefault(); // no double-tap zoom, no ghost clicks, during play
      const now = performance.now();
      for (const t of e.changedTouches) {
        const lt = this.touch.lastTap;
        if (this.enabled && lt && now - lt.up <= DT_MS && Math.hypot(t.clientX - lt.x, t.clientY - lt.y) <= DT_PX) {
          // the hint is the side of the screen tapped; the game uses it only if the ship is not moving sideways
          this.req.roll = { dir: 0, hint: t.clientX < window.innerWidth / 2 ? -1 : 1 };
          this.touch.lastTap = null; this.stats.doubleTaps++;
          this.touch.down = null;                 // the second tap is spent; it cannot start another pair
        } else {
          this.touch.down = { id: t.identifier, x: t.clientX, y: t.clientY, t: now, moved: 0 };
        }
        // 0.4.0 (Tron, field fixes 11-07; a playtester "lost the ability to maneuver every time he did a barrel roll"):
        // steering STAYS with the finger already steering. It used to follow the newest finger, so a two-thumb player's
        // double tap took the steering, and when that thumb lifted nothing steered until the first thumb was put down
        // again. A new finger steers only when none is (or the one we think is has vanished without a touchend).
        this.touch.live.set(t.identifier, { x: t.clientX, y: t.clientY });
        const held = this.touch.id !== null && [...e.touches].some((q) => q.identifier === this.touch.id);
        if (!held) { this.touch.id = t.identifier; this.touch.x = t.clientX; this.touch.y = t.clientY; } // from where it landed: no jump
      }
    }, { passive: false });
    on(document, 'touchmove', (e) => {
      if (e.cancelable) e.preventDefault();
      for (const t of e.changedTouches) {
        const d = this.touch.down;
        if (d && d.id === t.identifier) d.moved = Math.max(d.moved, Math.hypot(t.clientX - d.x, t.clientY - d.y));
        const lv = this.touch.live.get(t.identifier); if (lv) { lv.x = t.clientX; lv.y = t.clientY; }
        if (t.identifier !== this.touch.id) continue;
        const dx = t.clientX - this.touch.x, dy = t.clientY - this.touch.y;
        this.touch.x = t.clientX; this.touch.y = t.clientY;
        if (!this.enabled) continue;
        // dragging 55% of the short side of the screen sweeps the whole box
        const k = 2 / (Math.min(window.innerWidth, window.innerHeight) * 0.55);
        this.tx = clamp(this.tx + dx * k, -1, 1);
        this.ty = clamp(this.ty - dy * k, -1, 1);
        this.stats.dragPx += Math.hypot(dx, dy);
      }
    }, { passive: false });
    const end = (e) => {
      const now = performance.now();
      for (const t of e.changedTouches) {
        const d = this.touch.down;
        if (d && d.id === t.identifier) {
          if (now - d.t <= TAP_MS && d.moved <= TAP_PX) { this.touch.lastTap = { x: d.x, y: d.y, up: now }; this.stats.taps++; }
          else this.touch.lastTap = null;
          this.touch.down = null;
        }
        this.touch.live.delete(t.identifier);
        if (t.identifier === this.touch.id) {
          // (11-07) the steering finger lifted: a finger still down on the field takes over, from where it is now (no jump)
          this.touch.id = null;
          for (const [id, p] of this.touch.live) if ([...e.touches].some((q) => q.identifier === id)) { this.touch.id = id; this.touch.x = p.x; this.touch.y = p.y; break; }
        }
      }
      for (const id of [...this.touch.live.keys()]) if (![...e.touches].some((q) => q.identifier === id)) this.touch.live.delete(id); // (none left behind)
    };
    on(document, 'touchend', end);
    on(document, 'touchcancel', end);
    on(document, 'gesturestart', (e) => e.preventDefault());
    on(document, 'contextmenu', (e) => e.preventDefault());
  }
  // keyboard and mouse fold into the target each frame; touch already moved it in its handler
  update(dt) {
    if (!this.enabled) return;
    const k = this.keys;
    const kx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const ky = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    if (kx || ky) {
      this.mouseActive = false;
      this.tx = clamp(this.tx + kx * 2.6 * dt, -1, 1);
      this.ty = clamp(this.ty + ky * 2.6 * dt, -1, 1);
    } else if (this.mouseActive) {
      this.tx = clamp((this.mx / window.innerWidth * 2 - 1) * 1.2, -1, 1);
      this.ty = clamp(-(this.my / window.innerHeight * 2 - 1) * 1.25, -1, 1);
    }
  }
  take(name) { const v = this.req[name]; this.req[name] = name === 'roll' ? null : false; return v; }
  setMode(m) { if (m === this.mode) return; this.mode = m; if (this.onMode) this.onMode(m); }

  // ---- the bindings (Options, PC). Every change is saved at once.
  loadBinds() {
    const s = store('ringreaper.keys') || {}, b = JSON.parse(JSON.stringify(DEFAULT_KEYS));
    for (const a of ACTIONS) if (Array.isArray(s[a]) && s[a].length === 2) b[a] = s[a].map((x) => (typeof x === 'string' ? x : ''));
    if (typeof s.mouse === 'boolean') b.mouse = s.mouse;
    return b;
  }
  saveBinds() { store('ringreaper.keys', this.binds); if (this.onBinds) this.onBinds(); }
  resetBinds() { this.binds = JSON.parse(JSON.stringify(DEFAULT_KEYS)); this.saveBinds(); }
  setMouse(on) { this.binds.mouse = !!on; this.saveBinds(); }
  // bind code to action's slot (0 primary, 1 secondary); '' clears the slot. A key another action has: the two swap.
  // A key that steers (or M) is refused. CTRL and CMD are allowed, with a warning: with W they close the browser tab.
  bind(action, slot, code) {
    const B = this.binds, old = B[action][slot];
    if (!code) {
      if (!B[action][1 - slot]) return { ok: false, why: keyLabel(old) + ' IS THE ONLY KEY FOR ' + action.toUpperCase() };
      B[action][slot] = ''; this.saveBinds(); return { ok: true };
    }
    if (RESERVED[code]) return { ok: false, why: keyLabel(code) + ' ' + RESERVED[code] };
    let other = null;
    for (const a of ACTIONS) for (const i of [0, 1]) if (B[a][i] === code && !(a === action && i === slot)) other = [a, i];
    let swapped = null;
    if (other) {
      const [a, i] = other;
      // a swap must not leave the other action with no key at all
      if (a !== action && !old && !B[a][1 - i]) return { ok: false, why: keyLabel(code) + ' IS THE ONLY KEY FOR ' + a.toUpperCase() };
      B[a][i] = old; swapped = a;
    }
    B[action][slot] = code;
    this.saveBinds();
    const warn = code === 'Control' || code === 'Meta' ? 'CAREFUL: ' + keyLabel(code) + ' + W CLOSES THE BROWSER TAB, AND THE GAME CANNOT STOP IT' : '';
    return { ok: true, swapped, warn };
  }
  // an action's keys as players read them: ['SPACE'] or ['ESC', 'P']
  labels(action) { return this.binds[action].filter(Boolean).map(keyLabel); }
  // an action said in words, for hints: 'SPACE OR LEFT-CLICK'
  say(action) {
    const ks = this.labels(action), m = this.binds.mouse ? { roll: 'LEFT-CLICK', greed: 'RIGHT-CLICK' }[action] : null;
    const all = ks.concat(m ? [m] : []);
    return all.length > 1 ? all.slice(0, -1).join(', ') + ' OR ' + all[all.length - 1] : all[0] || '';
  }
  reset() { this.tx = 0; this.ty = 0; this.req.roll = null; this.req.greed = false; this.touch.lastTap = null; this.touch.down = null; }
}
