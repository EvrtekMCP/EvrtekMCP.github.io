// STARWAKE: input. Everything resolves to one steering target in the flight box (tx, ty in -1..1) plus a few
// one-shot requests the game drains each frame (roll, greed, pause).
//
// PHONE (Evrtek 11-05, ruling 1 as amended): drag anywhere to steer, RELATIVE, so a finger landing never moves
// the ship; only its travel does. A DOUBLE TAP anywhere rolls: the second touch-down must come within 280 ms of
// the first tap lifting, within 40 px of it, and the first must have been a tap (short, barely moved). Taps on a
// button never count. GREED has its own button, so a double tap only ever means roll.
// PC: the mouse steers absolutely (the ship chases the pointer), WASD/arrows move the target, Q/E roll left and
// right, Shift rolls the way you are going, Space cashes in GREED, Esc or P pauses, M toggles the music.
import { clamp } from './util.js?v=0.2.0';

const DT_MS = 280, DT_PX = 40, TAP_MS = 250, TAP_PX = 14;

export class Input {
  constructor(el) {
    this.el = el;
    this.tx = 0; this.ty = 0;
    this.keys = new Set();
    this.mouseActive = false; this.mx = 0; this.my = 0;
    this.req = { roll: null, greed: false, pause: false, music: false, any: false };
    this.touch = { id: null, x: 0, y: 0, down: null, lastTap: null };
    this.lastKind = 'none';
    this.enabled = false;
    this.stats = { taps: 0, doubleTaps: 0, dragPx: 0 };
    this._bind();
  }
  _bind() {
    const on = (t, ev, fn, o) => t.addEventListener(ev, fn, o);
    on(window, 'keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift'].includes(k)) e.preventDefault();
      if (e.repeat) { this.keys.add(k); return; }
      this.keys.add(k); this.lastKind = 'key'; this.req.any = true;
      if (k === 'q') this.req.roll = { dir: -1 };
      else if (k === 'e') this.req.roll = { dir: 1 };
      else if (k === 'shift') this.req.roll = { dir: 0, hint: 0 };
      else if (k === ' ') this.req.greed = true;
      else if (k === 'escape' || k === 'p') this.req.pause = true;
      else if (k === 'm') this.req.music = true;
    });
    on(window, 'keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    on(window, 'blur', () => this.keys.clear());
    on(window, 'mousemove', (e) => {
      if (this.lastKind === 'touch' && performance.now() - (this._touchAt || 0) < 800) return; // emulated mouse after a touch
      this.mouseActive = true; this.lastKind = 'mouse';
      this.mx = e.clientX; this.my = e.clientY;
    });
    on(window, 'mousedown', () => { this.req.any = true; });
    const isButton = (t) => t && t.closest && t.closest('button, a');
    on(document, 'touchstart', (e) => {
      this._touchAt = performance.now(); this.lastKind = 'touch'; this.mouseActive = false; this.req.any = true;
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
        // steering follows the newest finger, from where it landed: no jump
        this.touch.id = t.identifier; this.touch.x = t.clientX; this.touch.y = t.clientY;
      }
    }, { passive: false });
    on(document, 'touchmove', (e) => {
      if (e.cancelable) e.preventDefault();
      for (const t of e.changedTouches) {
        const d = this.touch.down;
        if (d && d.id === t.identifier) d.moved = Math.max(d.moved, Math.hypot(t.clientX - d.x, t.clientY - d.y));
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
        if (t.identifier === this.touch.id) this.touch.id = null;
      }
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
  reset() { this.tx = 0; this.ty = 0; this.req.roll = null; this.req.greed = false; this.touch.lastTap = null; this.touch.down = null; }
}
