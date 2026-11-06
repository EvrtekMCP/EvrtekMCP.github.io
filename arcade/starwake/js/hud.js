// STARWAKE: the DOM layer over the canvas: numbers, bars, pop-ups and call-outs. Loud and generous (ruling 4).
import { fmt, V } from './util.js?v=0.2.0';

// Yori's call-out sprites (art/, glow baked in). Preloaded so the first GRAZE never waits on a decode.
export const ART = ['graze', 'multi-deflect', 'greed', 'perfect', 'no-hit', 'level-clear', 'rank-c', 'rank-b', 'rank-a', 'rank-s', 'rank-degenerate', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8'];
export const artUrl = (n) => 'art/' + n + '-glow.png' + V;

const $ = (id) => document.getElementById(id);
// Every effect here restarts with the Web Animations API. The old trick (drop a class, read offsetWidth, add it
// back) forces a full layout each time: 5 to 33 ms apiece on a 6x-throttled CPU, several per kill (measured 11-05).
const POP = [{ opacity: 0, transform: 'translate(-50%, -30%) scale(0.7)' }, { opacity: 1, transform: 'translate(-50%, -60%) scale(1.15)', offset: 0.15 },
  { opacity: 0, transform: 'translate(-50%, -260%) scale(1)' }];
const PUNCH = [{ opacity: 0, transform: 'scale(2.2)' }, { opacity: 1, transform: 'scale(0.92)', offset: 0.12 }, { transform: 'scale(1.06)', offset: 0.22 },
  { opacity: 1, transform: 'scale(1)', offset: 0.75 }, { opacity: 0, transform: 'scale(1.1)' }];
const SHAKE = [{ translate: '0 0' }, { translate: '-3px 1px' }, { translate: '3px -2px' }, { translate: '-2px 2px' }, { translate: '2px -1px' }, { translate: '0 0' }];
const run = (el, kf, ms, easing = 'ease-out') => el.animate(kf, { duration: ms, easing, fill: 'forwards' });

export class Hud {
  constructor() {
    this.el = $('hud');
    this.score = $('score'); this.combo = $('combo'); this.rings = $('rings');
    this.shield = $('shield-fill'); this.greed = $('greed-fill'); this.greedBtn = $('greed-btn');
    this.roll = $('roll'); this.rollFill = $('roll-fill');
    this.banner = $('banner'); this.callout = $('callout'); this.calloutArt = $('callout-art'); this.flashEl = $('flash');
    this.imgs = {};
    for (const n of ART) { const i = new Image(); i.src = artUrl(n); i.alt = ''; i.decoding = 'async'; this.imgs[n] = i; }
    this.comboKey = '';
    this.warnL = $('warn-l'); this.warnR = $('warn-r');
    this.popsEl = $('pops');
    this.pops = []; this.popI = 0;
    for (let i = 0; i < 18; i++) { const d = document.createElement('div'); d.className = 'p'; this.popsEl.appendChild(d); this.pops.push(d); }
    this.shown = 0; this.lastMult = 1; this.bannerT = 0; this.warnT = [0, 0];
    this.last = {};
  }
  // hidden by visibility, not display, so its layout is done on the title screen and not in the run's first frame
  show(on) { this.el.classList.toggle('off', !on); }
  reset() { this.shown = 0; this.lastMult = 1; this.last = {}; this.banner.classList.remove('on'); for (const p of this.pops) p.getAnimations().forEach((a) => a.cancel()); }
  // a number that rolls up to the real score instead of jumping
  update(dt, g) {
    const target = g.score;
    this.shown += (target - this.shown) * Math.min(1, dt * 12);
    if (Math.abs(target - this.shown) < 1) this.shown = target;
    this._set('score', fmt(this.shown));
    const m = g.mult;
    const key = m + '|' + g.greedOn;
    if (key !== this.comboKey) { // the multiplier is Yori's x-sprite from x2 up
      this.comboKey = key; this.combo.textContent = '';
      if (m >= 2 && this.imgs['x' + m]) { const i = this.imgs['x' + m].cloneNode(); i.alt = 'x' + m; this.combo.appendChild(i); } else this.combo.textContent = 'x' + m;
      if (g.greedOn) { const t = document.createElement('span'); t.className = 'gtag'; t.textContent = 'GREED x2'; this.combo.appendChild(t); }
    }
    if (m !== this.lastMult) {
      // the sprite swells inside the layout (nothing overlaps), up to 1.54x at x8 (Yori: holds to ~1.6x)
      this.combo.style.setProperty('--swell', (1 + Math.max(0, m - 2) * 0.09).toFixed(2));
      if (m > this.lastMult) run(this.combo, SHAKE, 280, 'linear');
      this.lastMult = m;
    }
    this._set('rings', 'RINGS ' + g.ringsGot + '  CHAIN ' + g.chain);
    const sh = Math.max(0, g.shield);
    this._style('sw', this.shield, 'width', sh + '%');
    this.shield.classList.toggle('low', sh < 30);
    this._style('gw', this.greed, 'width', g.greed + '%');
    this.greed.classList.toggle('full', g.greed >= 100 && !g.greedOn);
    this.greed.classList.toggle('burning', g.greedOn);
    this.greedBtn.hidden = !(g.greed >= 100 && !g.greedOn);
    const rk = g.rollCool > 0 ? 1 - g.rollCool / g.rollCoolMax : 1;
    this._style('rw', this.rollFill, 'width', Math.round(rk * 100) + '%');
    this.roll.classList.toggle('cool', g.rollCool > 0 || g.rolling);
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.banner.classList.remove('on'); }
    for (const s of [0, 1]) if (this.warnT[s] > 0) { this.warnT[s] -= dt; if (this.warnT[s] <= 0) (s ? this.warnR : this.warnL).classList.remove('on'); }
  }
  _set(k, v) { if (this.last[k] !== v) { this.last[k] = v; this[k].textContent = v; } }
  _style(k, el, prop, v) { if (this.last[k] !== v) { this.last[k] = v; el.style[prop] = v; } }
  showBanner(name, sub) {
    this.banner.innerHTML = '';
    const a = document.createElement('span'); a.textContent = name;
    const b = document.createElement('span'); b.className = 'sub'; b.textContent = sub;
    this.banner.append(a, b); this.banner.classList.add('on'); this.bannerT = 2.6;
  }
  pop(text, x, y, cls = '') {
    const d = this.pops[this.popI++ % this.pops.length];
    d.textContent = text; d.className = 'p ' + cls;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    run(d, POP, 900);
  }
  call(text, cls = '') {
    const c = this.callout;
    c.textContent = text; c.className = 'callout ' + cls;
    run(c, PUNCH, 900, 'cubic-bezier(.2,.9,.3,1.2)');
    this.calloutArt.getAnimations().forEach((a) => a.cancel());
  }
  // one or two sprites side by side (MULTI-DEFLECT + x3), an optional line of text under them
  callArt(names, sub) {
    const c = this.calloutArt; c.textContent = '';
    for (const n of names) { const src = this.imgs[n]; if (!src) continue; const i = src.cloneNode(); i.alt = n; if (n === 'multi-deflect' || n === 'level-clear') i.className = 'wide'; c.appendChild(i); }
    if (sub) { const s = document.createElement('span'); s.className = 'sub'; s.textContent = sub; c.appendChild(s); }
    run(c, PUNCH, 950, 'cubic-bezier(.2,.9,.3,1.2)');
    this.callout.getAnimations().forEach((a) => a.cancel());
  }
  flash() { run(this.flashEl, [{ opacity: 1 }, { opacity: 0 }], 350); }
  warn(side, t) { const el = side < 0 ? this.warnL : this.warnR; el.classList.add('on'); this.warnT[side < 0 ? 0 : 1] = t; }
  // the boss bar: { show, title, frac, phase, phases }; any field may come alone
  boss(o) {
    const el = $('boss');
    if (o.show === false) { el.hidden = true; return; }
    if (o.show) { el.hidden = false; $('boss-name').textContent = o.title || ''; this.bossPhases = o.phases || 1; }
    if (o.frac !== undefined) $('boss-fill').style.width = Math.max(0, o.frac * 100).toFixed(1) + '%';
    if (o.phase !== undefined || o.show) {
      const p = $('boss-pips'); p.textContent = '';
      for (let i = 0; i < (this.bossPhases || 1); i++) { const d = document.createElement('span'); if (i <= (o.phase || 0)) d.className = 'on'; p.appendChild(d); }
    }
  }
  setDev(on) { $('dev-badge').hidden = !on; }
}
