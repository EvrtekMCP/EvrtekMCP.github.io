// STARWAKE (0.4.0: the power-up strip): the DOM layer over the canvas: numbers, bars, pop-ups and call-outs. Loud and generous (ruling 4).
import { fmt, V } from './util.js?v=0.4.0';
import { POWERUPS } from './powerups.js?v=0.4.0';

// Yori's call-out sprites (art/, glow baked in). Preloaded so the first GRAZE never waits on a decode.
export const ART = ['graze', 'multi-deflect', 'greed', 'perfect', 'no-hit', 'level-clear', 'rank-c', 'rank-b', 'rank-a', 'rank-s', 'rank-degenerate', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8'];
export const artUrl = (n) => 'art/' + n + '-glow.png' + V;
// 0.4.0: Yori's call-outs for the galaxies (art/<name>-glow.png), listed here as each lands on her art branch; until one
// is, its call-out is said in text (hasArt). Names: pu-shield pu-overclock pu-mirror pu-phase pu-magnet pu-slip phased cache
// parry snapped intercept calf-safe mother-safe shoal slingshot lure keyed stitched fractal-clear vault jackpot galaxy-clear
export const ART_G = ["cache","calf-safe","deep-slingshot","fractal-clear","freed","galaxy-clear","intercept","is-open","jackpot","keyed","lure","mirror-shell","mother-safe","overclock","parry","phase","phased","ring-magnet","shield-cell","shoal","slingshot","slipstream","snapped","sting","stitched","vault"]; // Yori's, from art-incoming/yori/galaxies/callouts (g2-art)
// the power-up strip's icons: Yori's (art/ui/pu/hud-<kind>.png, from g2-art); the drawn silhouettes below stay as the fallback
const HUD_ART = true;
function puIcon(id) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), col = POWERUPS[id].css;
  x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 5; x.lineJoin = 'round'; x.translate(32, 32);
  const poly = (n, r, a0 = 0) => { x.beginPath(); for (let i = 0; i < n; i++) { const a = a0 + i / n * Math.PI * 2; x[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); };
  if (HUD_ART) { const i = new Image(); i.src = 'art/ui/pu/hud-' + POWERUPS[id].kind + '.png' + V; i.srcset = 'art/ui/pu/hud-' + POWERUPS[id].kind + '@2x.png' + V + ' 2x'; i.alt = ''; i.decoding = 'async'; return i; } // Yori's icons
  if (id === 'overclock') { for (let i = 0; i < 8; i++) { x.save(); x.rotate(i / 8 * Math.PI * 2); x.fillRect(-4, -20, 8, 9); x.restore(); } x.beginPath(); x.arc(0, 0, 13, 0, 7); x.fill(); }
  else if (id === 'mirror') { poly(3, 18, -Math.PI / 2); x.fill(); }
  else if (id === 'phase') { poly(4, 19, -Math.PI / 2); x.stroke(); poly(4, 9, -Math.PI / 2); x.stroke(); }
  else if (id === 'magnet') { x.lineWidth = 9; x.beginPath(); x.arc(0, 2, 11, 0, Math.PI); x.moveTo(-11, 2); x.lineTo(-11, -14); x.moveTo(11, 2); x.lineTo(11, -14); x.stroke(); }
  else if (id === 'slip') { x.beginPath(); x.moveTo(-14, -18); x.lineTo(14, -18); x.lineTo(-14, 18); x.lineTo(14, 18); x.closePath(); x.fill(); }
  else { poly(6, 16, Math.PI / 6); x.fill(); }
  return c;
}

const $ = (id) => document.getElementById(id);
// Every effect here restarts with the Web Animations API. The old trick (drop a class, read offsetWidth, add it
// back) forces a full layout each time: 5 to 33 ms apiece on a 6x-throttled CPU, several per kill (measured 11-05).
const POP = [{ opacity: 0, transform: 'translate(-50%, -30%) scale(0.7)' }, { opacity: 1, transform: 'translate(-50%, -60%) scale(1.15)', offset: 0.15 },
  { opacity: 0, transform: 'translate(-50%, -260%) scale(1)' }];
const PUNCH = [{ opacity: 0, transform: 'scale(2.2)' }, { opacity: 1, transform: 'scale(0.92)', offset: 0.12 }, { transform: 'scale(1.06)', offset: 0.22 },
  { opacity: 1, transform: 'scale(1)', offset: 0.75 }, { opacity: 0, transform: 'scale(1.1)' }];
const SHAKE = [{ translate: '0 0' }, { translate: '-3px 1px' }, { translate: '3px -2px' }, { translate: '-2px 2px' }, { translate: '2px -1px' }, { translate: '0 0' }];
const run = (el, kf, ms, easing = 'ease-out') => el.animate(kf, { duration: ms, easing, fill: 'forwards' });
const BANNER_MS = 4000; // a section's name stays about four seconds (0.3.0; it was 2.6)

export class Hud {
  constructor() {
    this.el = $('hud');
    this.score = $('score'); this.combo = $('combo'); this.rings = $('rings');
    this.shield = $('shield-fill'); this.greed = $('greed-fill'); this.greedBtn = $('greed-btn');
    this.roll = $('roll'); this.rollFill = $('roll-fill');
    this.banner = $('banner'); this.callout = $('callout'); this.calloutArt = $('callout-art'); this.flashEl = $('flash');
    this.imgs = {}; // Yori's call-out sprites: preloadArt(), once the boot's own loads are in (0.3.1)
    this.comboKey = '';
    this.warnL = $('warn-l'); this.warnR = $('warn-r');
    // 0.3.0: markers on the screen's edge for shots coming at you from off the screen (main.js threats())
    this.thEl = $('threats'); this.th = [];
    for (let i = 0; i < 6; i++) { const d = document.createElement('div'); d.className = 'th'; this.thEl.appendChild(d); this.th.push(d); }
    this.thShown = 0; this.thT = 0;
    this.tutorEl = $('tutor'); this.tutorKey = $('tutor-key'); this.tutorSay = $('tutor-say'); this.tutorSkip = $('tutor-skip');
    this.popsEl = $('pops');
    this.pops = []; this.popI = 0;
    for (let i = 0; i < 18; i++) { const d = document.createElement('div'); d.className = 'p'; this.popsEl.appendChild(d); this.pops.push(d); }
    this.shown = 0; this.lastMult = 1; this.warnT = [0, 0];
    // 0.4.0: the power-up strip above the shield bar: one icon a running power-up, a ring round it draining; the Shield
    // Cell has none (it is instant: the shield bar's green sweep is its cue)
    this.puEl = $('pu-strip'); this.puSlots = {};
    if (this.puEl) for (const id of ['overclock', 'mirror', 'phase', 'magnet', 'slip']) {
      const d = document.createElement('div'); d.className = 'pu'; d.style.setProperty('--c', POWERUPS[id].css); d.hidden = true; d.setAttribute('aria-label', POWERUPS[id].name);
      d.appendChild(puIcon(id)); this.puEl.appendChild(d); this.puSlots[id] = d;
    }
    this.last = {};
  }
  // 0.3.1 (load times): the call-out sprites (~0.9 MB) are only needed in play, so they load after the boot screen's
  // own pictures and the first stretch of the menu music, not alongside them. 0.4.0: galaxies 2 and 3's call-outs (ART_G,
  // ~1.8 MB) load here too, not in the constructor
  preloadArt(ms = 30000) {
    const wait = [];
    for (const n of ART.concat(ART_G)) if (!this.imgs[n]) { const i = new Image(); wait.push(new Promise((ok) => { i.onload = i.onerror = ok; })); i.src = artUrl(n); i.alt = ''; i.decoding = 'async'; this.imgs[n] = i; }
    return Promise.race([Promise.all(wait), new Promise((ok) => setTimeout(ok, ms))]);
  }
  // hidden by visibility, not display, so its layout is done on the title screen and not in the run's first frame
  show(on) { this.el.classList.toggle('off', !on); }
  reset() { this.shown = 0; this.lastMult = 1; this.last = {}; this.banner.getAnimations().forEach((a) => a.cancel()); this.banner.style.opacity = 0; for (const p of this.pops) p.getAnimations().forEach((a) => a.cancel()); this.threats([], 0); this.tutor(null); this.tip(null); }
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
    const pu = (g.state === 'play' && g.pu) || {};
    for (const id in this.puSlots) {
      const d = this.puSlots[id], q = pu[id], on = !!q;
      if (d.hidden === on) d.hidden = !on;
      if (on) { const k = Math.max(0, q.t / q.max).toFixed(3); if (d._k !== k) { d._k = k; d.style.setProperty('--k', k); } d.classList.toggle('end', q.t < 1); }
    }
    this.roll.classList.toggle('oc', !!pu.overclock);
    const rk = g.rollCool > 0 ? 1 - g.rollCool / g.rollCoolMax : 1;
    this._style('rw', this.rollFill, 'width', Math.round(rk * 100) + '%');
    this.roll.classList.toggle('cool', g.rollCool > 0 || g.rolling);
    for (const s of [0, 1]) if (this.warnT[s] > 0) { this.warnT[s] -= dt; if (this.warnT[s] <= 0) (s ? this.warnR : this.warnL).classList.remove('on'); }
  }
  _set(k, v) { if (this.last[k] !== v) { this.last[k] = v; this[k].textContent = v; } }
  _style(k, el, prop, v) { if (this.last[k] !== v) { this.last[k] = v; el.style[prop] = v; } }
  // A section's name (0.3.0, Evrtek 11-06: "Zone names are hard to read and flash up only for a moment"): about four
  // seconds, faded in and out, big, on a solid plate high on the screen, clear of the flight path's middle. The
  // opening one carries the level's name in Yori's lettering (art/ui/name-NN.png) above it.
  showBanner(name, sub, art) {
    const B = this.banner; B.textContent = '';
    if (art) { const i = new Image(); i.src = 'art/' + art + '.png' + V; i.alt = ''; i.className = 'lvl'; B.appendChild(i); }
    const a = document.createElement('span'); a.className = 'zone'; a.textContent = name;
    const b = document.createElement('span'); b.className = 'sub'; b.textContent = sub;
    B.append(a, b);
    B.getAnimations().forEach((x) => x.cancel());
    B.animate([{ opacity: 0, scale: '0.94' }, { opacity: 1, scale: '1', offset: 0.09 }, { opacity: 1, scale: '1', offset: 0.85 }, { opacity: 0, scale: '1' }],
      { duration: BANNER_MS, easing: 'ease-out', fill: 'forwards' });
  }
  // the edge markers: { nx, ny } in normalised screen space (off the edge, or mirrored if behind), t = seconds to arrive
  threats(list, dt) {
    this.thT += dt;
    const W = window.innerWidth, H = window.innerHeight, m = 30;
    for (let i = 0; i < this.th.length; i++) {
      const d = this.th[i], q = list[i];
      if (!q) { if (i < this.thShown) d.style.opacity = '0'; continue; }
      const dx = q.nx * W / 2, dy = -q.ny * H / 2, a = Math.atan2(dy, dx);
      const c = Math.cos(a), s = Math.sin(a), k = Math.min((W / 2 - m) / Math.max(1e-6, Math.abs(c)), (H / 2 - m) / Math.max(1e-6, Math.abs(s)));
      const urgent = q.t < 0.8, pulse = urgent ? 0.75 + 0.25 * Math.sin(this.thT * 30) : 1;
      d.style.transform = 'translate(' + (W / 2 + c * k).toFixed(1) + 'px,' + (H / 2 + s * k).toFixed(1) + 'px) rotate(' + a.toFixed(3) + 'rad) scale(' + (urgent ? 1.25 : 1) + ')';
      d.style.opacity = ((0.55 + 0.45 * Math.max(0, 1 - q.t / 2.2)) * pulse).toFixed(2);
    }
    this.thShown = list.length;
  }
  // the roll lesson's panel: { key, say, skip } or null to hide it
  tutor(o) {
    if (!this.tutorEl) return;
    if (!o) { this.tutorEl.hidden = true; return; }
    this.tutorKey.textContent = ''; this.tutorKey.hidden = !o.key;
    const K = this.tutorKey, el = (tag, cls, text) => { const d = document.createElement(tag); if (cls) d.className = cls; if (text) d.textContent = text; K.appendChild(d); return d; };
    if (typeof o.key === 'string') el('span', 't-line', o.key);
    else if (o.key && o.key.tap) { el('span', 't-tap'); el('span', 't-line', o.key.text); }        // two rings pulsing, as a double tap
    else if (o.key) {                                                                                // PRESS [SPACE] OR (mouse) LEFT-CLICK TO ROLL
      el('span', 't-line', 'PRESS');
      o.key.keys.forEach((k, i) => { if (i) el('span', 't-line', 'OR'); el('kbd', 't-cap', k); });
      if (o.key.mouse) { el('span', 't-line', 'OR'); el('span', 't-mouse'); el('span', 't-line', 'LEFT-CLICK'); }
      el('span', 't-line', 'TO ROLL');
    }
    // the whole line in words, for screen readers and the tests: PRESS SPACE OR LEFT-CLICK TO ROLL
    K.setAttribute('aria-label', typeof o.key === 'string' ? o.key : !o.key ? '' : o.key.tap ? o.key.text : 'PRESS ' + o.key.keys.join(' OR ') + (o.key.mouse ? ' OR LEFT-CLICK' : '') + ' TO ROLL');
    this.tutorSay.textContent = o.say || ''; this.tutorSay.hidden = !o.say;
    this.tutorSkip.hidden = !o.skip;
    this.tutorEl.hidden = !(o.key || o.say);
  }
  // 0.4.0, the first-time tips (js/tutorials.js): a card { name, say: [what it is, what to do], icon, art, glyph, color },
  // or null to put it away. The title is Yori's lettering where she has lettered that name (art/<art>-glow.png), else
  // the name in the banner's chrome; the icon is her HUD icon (art/<icon>.png), else a placeholder glyph.
  tip(o) {
    const T = this.tipEl || (this.tipEl = $('tip'));
    if (!T) return;
    this.el.classList.toggle('tip-on', !!o);
    if (!o) { T.hidden = true; this.tipK = -1; return; }
    const icon = $('tip-icon'), name = $('tip-name'), say = $('tip-say');
    icon.textContent = ''; icon.className = 'tip-icon' + (o.icon ? '' : ' g-' + (o.glyph || 'hurt'));
    icon.style.setProperty('--c', o.color || '');
    if (o.icon) { const i = new Image(); i.src = 'art/' + o.icon + '.png' + V; i.srcset = 'art/' + o.icon + '@2x.png' + V + ' 2x'; i.alt = ''; icon.appendChild(i); }
    name.textContent = '';
    if (o.art && this.imgs[o.art]) { const i = this.imgs[o.art].cloneNode(); i.alt = o.name; name.appendChild(i); }
    else { const s = document.createElement('span'); s.textContent = o.name; name.appendChild(s); }
    say.textContent = '';
    for (const line of o.say || []) { const d = document.createElement('div'); d.textContent = line; say.appendChild(d); }
    T.setAttribute('aria-label', o.name + '. ' + (o.say || []).join(' '));
    T.hidden = false;
    T.animate([{ opacity: 0, transform: 'translateY(-10px) scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1.1)' });
    this.tipK = -1; this.tipLeft(1);
  }
  // the auto-resume's time left on the SKIP button, 1 to 0
  tipLeft(k) { const r = Math.round(k * 100) / 100; if (r === this.tipK) return; this.tipK = r; $('tip-skip').style.setProperty('--k', r); }
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
  // 0.4.0: the Shield Cell's cue: the shield bar fills with a green sweep, then settles back to its cyan
  cell(secs = 1.5) { this.shield.animate([{ filter: 'hue-rotate(-50deg) brightness(1.6)', boxShadow: '0 0 16px #4dff8a' }, { filter: 'hue-rotate(-50deg) brightness(1.25)', boxShadow: '0 0 12px #4dff8a', offset: 0.5 }, { filter: 'none' }], { duration: secs * 1000, easing: 'ease-out' }); }
  hasArt(name) { return !!this.imgs[name]; }
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
