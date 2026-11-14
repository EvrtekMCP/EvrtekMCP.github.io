// STARWAKE 0.4.0: the screens around the flying: the loading screen, the launcher (NEW GAME, CONTINUE, LEVEL
// SELECT, OPTIONS), the galaxy chart (0.4.0), each galaxy's sector map with stars, the end card's stars, pause, and the
// hidden dev menu (a tab a galaxy). Every level shares them; nothing here knows any one level.
import { fmt, store, V } from './util.js?v=0.6.4';
import { loadLevel, RANK_ORDER, MAX_STARS, GALAXIES, galaxy, catalogueOf, entryOf, levelLabel } from './levels.js?v=0.6.4';
import { keyLabel, codeOf } from './input.js?v=0.6.4';
import { param } from './params.js?v=0.6.4';
import { tipsSetting, setTipsSetting } from './tutorials.js?v=0.6.4';
import { DEMO, DEMO_BUILD, DEMO_TEXT, DEMO_LEVELS, demoEnds } from './demo.js?v=0.6.4';

const $ = (id) => document.getElementById(id);
const SCREENS = ['title', 'galaxies', 'select', 'options', 'confirm', 'dev', 'paused', 'end', 'credits', 'demo'];
const STAR = '★', NOSTAR = '☆';

export class UI {
  constructor(o) {
    this.o = o; this.G = o.G; this.audio = o.audio; this.Progress = o.Progress; this.CATALOGUE = o.CATALOGUE; this.level = o.level; this.input = o.input;
    this.fpsOn = false; this.fpsT = 0; this.fpsN = 0; this.back = 'title';
    this.devOn = !DEMO_BUILD && (param('dev') !== null || !!store('ringreaper.dev')); // ?dev or #dev (params.js); never in a demo build
    this.gal = 1; this.devGal = 1; // the galaxy the sector map (and the dev menu) shows
    this.nodes = null; fetch('art/ui/map-nodes.json' + V).then((r) => r.json()).then((j) => { this.nodes = j; if (!$('select').hidden) this.select(this.gal); }, () => {});
    window.addEventListener('resize', () => { if (!$('select').hidden) this.layoutMap(); if (!$('galaxies').hidden) this.layoutChart(); });
    this.G.dev = this.devOn;
    $('ver').textContent = 'v' + o.version;
    // the control texts follow how the player is playing right now (input.mode), not the device; main.js keeps it live
    document.body.classList.toggle('touch', this.input.mode === 'touch');
    this.keysUI();
    this.controlsChanged();
    const on = (id, fn) => $(id).addEventListener('click', (e) => { this.audio.unlock(); fn(e); });
    on('start-btn', () => (this.Progress.any() ? this.show('confirm') : this.start(1)));
    on('confirm-yes', () => { this.Progress.wipe(); this.start(1); });
    on('continue-btn', () => this.start(...this.Progress.furthestAt()));
    on('select-btn', () => this.chart());
    on('options-btn', () => { this.syncToggles(); this.show('options'); });
    on('dev-btn', () => this.devMenu());
    on('again-btn', () => this.start(this.level().g || 1, this.level().n, this.lastOpts || {}));
    // 0.6.0: start again from the checkpoint the run took (main.js newRun, opts.checkpoint)
    on('cp-btn', () => this.o.start(this.level().g || 1, this.level().n, { checkpoint: true }));
    // 0.6.0, the demo: beating its last level goes on to the demo card (js/demo.js), and from there back to the levels or the menu
    on('demo-levels', () => this.select(1));
    on('demo-menu', () => this.o.toTitle());
    on('next-btn', () => { if (this.demoEnd) { this.demoCard(); return; } if (this.finalClear) { this.rollThen(() => this.o.toTitle()); return; } const nx = this.nextOf(this.level()); if (nx) this.start(nx[0], nx[1]); });
    on('levels-btn', () => this.rollThen(() => this.select(this.level().g || 1)));
    // 0.4.0: the sector map's arrows (and a swipe, and the arrow keys) move to the neighbouring galaxy; BACK is the chart
    on('gal-prev', () => this.select(this.gal - 1));
    on('gal-next', () => this.select(this.gal + 1));
    on('select-back', () => this.chart());
    on('credits-btn', () => this.credits(() => { this.syncToggles(); this.show('options'); }));
    // the credits: any tap or key skips them
    $('credits').addEventListener('click', () => this.creditsEnd());
    window.addEventListener('keydown', (e) => { if (!$('credits').hidden) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) this.creditsEnd(); } }, true);
    for (const b of document.querySelectorAll('[data-dev-g]')) b.addEventListener('click', () => this.devMenu(Number(b.dataset.devG)));
    let sw0 = null;
    $('select').addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; sw0 = { x: t.clientX, y: t.clientY, t: performance.now() }; }, { passive: true });
    $('select').addEventListener('touchend', (e) => { if (!sw0) return; const t = e.changedTouches[0], dx = t.clientX - sw0.x, dy = t.clientY - sw0.y; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5 && performance.now() - sw0.t < 700) this.select(this.gal + (dx < 0 ? 1 : -1)); sw0 = null; }, { passive: true });
    on('title-btn', () => this.rollThen(() => this.o.toTitle()));
    on('resume-btn', () => this.o.resume());
    on('quit-btn', () => this.o.toTitle());
    $('pause-btn').addEventListener('click', () => this.o.pause());
    $('greed-btn').addEventListener('click', (e) => { e.preventDefault(); this.o.greedGo(); });
    for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', () => this.launcher());
    for (const b of document.querySelectorAll('[data-tog]')) b.addEventListener('click', () => { this.audio.unlock(); this.audio.toggle(b.dataset.tog); this.syncToggles(); });
    // 0.4.0: the first-time tips (js/tutorials.js; 0.6.2: the roll, GREED, the power-ups), on by default; a setting, so NEW GAME leaves it as it is
    $('tips-tog').addEventListener('click', () => { setTipsSetting(!tipsSetting()); this.syncToggles(); });
    // the dev gestures: type "dev" on the launcher, or tap the studio name five times inside two seconds
    let typed = '';
    window.addEventListener('keydown', (e) => {
      const st = this.G.state;
      if (st === 'title' && /^[a-z]$/i.test(e.key)) { typed = (typed + e.key.toLowerCase()).slice(-3); if (typed === 'dev') { typed = ''; this.toggleDev(); } }
      if ((e.key === 'Enter' || (e.key === ' ' && !e.repeat)) && st === 'title' && !$('title').hidden) { e.preventDefault(); this.audio.unlock(); if (this.Progress.any()) this.start(...this.Progress.furthestAt()); else this.start(1); }
      if ((e.key === 'Enter' || (e.key === ' ' && !e.repeat)) && st === 'end') { e.preventDefault(); if (this.cpReady) this.o.start(this.level().g || 1, this.level().n, { checkpoint: true }); else this.start(this.level().g || 1, this.level().n, this.lastOpts || {}); }
      if (!$('select').hidden && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); this.select(this.gal + (e.key === 'ArrowRight' ? 1 : -1)); }
      if (!$('select').hidden && e.key === 'Escape') { e.preventDefault(); this.chart(); }
    });
    let taps = [];
    $('studio').addEventListener('click', () => { const t = performance.now(); taps = taps.filter((x) => t - x < 2000); taps.push(t); if (taps.length >= 5) { taps = []; this.toggleDev(); } });
    $('dev-god').addEventListener('click', () => { this.G.devGod = !this.G.devGod; this.syncDev(); });
    $('dev-speed').addEventListener('click', () => { const s = [0.5, 1, 2, 4]; this.G.devSpeed = s[(s.indexOf(this.G.devSpeed) + 1) % s.length]; this.syncDev(); });
    $('dev-fps-btn').addEventListener('click', () => { this.fpsOn = !this.fpsOn; this.syncDev(); });
    // the roll lesson (0.3.0) shows until the first shot sent back; this brings it back for the next level 1
    // 0.6.2: the INCOMING line (js/tutorials.js): DONE marks the roll learned; WILL SHOW also clears its three showings
    $('dev-tip').addEventListener('click', () => { const learn = !this.Progress.tip('roll'); this.Progress.setTip('roll', learn); if (!learn) { const s = store('ringreaper.seen') || {}; for (const k of ['incoming-1', 'incoming-2', 'incoming-3']) delete s[k]; store('ringreaper.seen', s); } this.syncDev(); });
    $('dev-off').addEventListener('click', () => { this.toggleDev(); this.launcher(); });
    this.syncDev();
  }
  // start(n, opts) is galaxy 1's level n (as 0.3); start(g, n, opts) any galaxy's
  start(a, b, c) { const opts = (typeof b === 'number' ? c : b) || {}; this.lastOpts = opts; return typeof b === 'number' ? this.o.start(a, b, opts) : this.o.start(a, opts); }
  // the level after L: the next in its galaxy, or the next galaxy's first once its last is done (if that galaxy is open)
  nextOf(L) {
    const g = L.g || 1, c = entryOf(g, L.n + 1);
    if (c) return [g, c.n];
    const nx = galaxy(g + 1); return nx ? [nx.g, nx.levels[0].n] : null;
  }
  hideAll() { this.endCapture(); for (const s of SCREENS) $(s).hidden = true; this.syncMenuLoop(); }
  // 0.4.0 boot-menu: Yori's vignette loop behind the menu (art/ui/loader/vignette.js) runs only while the menu shows. Read
  // once the screens have settled (show() is hideAll then one screen back), so a menu shown again keeps its loop going
  syncMenuLoop() {
    if (this._loopSync) return; this._loopSync = true;
    queueMicrotask(() => { this._loopSync = false; const v = window.__menuVignette; if (v) v.show(!$('title').hidden); });
  }

  // ---- the PC keys (0.3.0, Evrtek 11-06): Options rebinds Roll, GREED and Pause (a primary and a secondary key
  // each), switches the mouse buttons, and resets to the defaults. Click a key, then press the new one: Esc cancels,
  // Backspace clears the slot. A key another action has swaps over; a key that steers (or M) is refused; CTRL and CMD
  // are allowed with a warning. Hidden while playing by touch (css, body.touch).
  keysUI() {
    for (const row of document.querySelectorAll('#opt-keys .k-row')) for (const b of row.querySelectorAll('.k-cap')) {
      b.addEventListener('click', () => this.capture(row.dataset.act, Number(b.dataset.slot), b));
    }
    $('k-mouse').addEventListener('click', () => { this.endCapture(); this.input.setMouse(!this.input.binds.mouse); this.keyNote(this.input.binds.mouse ? 'Left-click rolls and right-click fires GREED, on the play field only.' : 'The mouse only steers now.'); });
    $('k-reset').addEventListener('click', () => { this.endCapture(); this.input.resetBinds(); this.keyNote('Back to the defaults.'); });
    this._cap = null;
    this._capKey = (e) => {
      if (!this._cap) return;
      e.preventDefault(); e.stopPropagation();
      if (e.repeat) return;
      const { act, slot } = this._cap;
      if (e.key === 'Escape') { this.endCapture(); this.keyNote('Left as it was.'); return; }
      const r = this.input.bind(act, slot, e.key === 'Backspace' || e.key === 'Delete' ? '' : codeOf(e));
      this.endCapture();
      if (!r.ok) this.keyNote(r.why + '. Pick another key.');
      else if (r.warn) this.keyNote(r.warn + '.');
      else if (r.swapped && r.swapped !== act) this.keyNote('Swapped: ' + r.swapped.toUpperCase() + ' took the old key.');
      else this.keyNote('');
    };
    window.addEventListener('keydown', this._capKey, true);
    this.renderKeys();
  }
  capture(act, slot, btn) {
    this.endCapture();
    this._cap = { act, slot, btn }; this.input.capturing = true;
    btn.classList.add('wait'); btn.textContent = 'PRESS A KEY';
    this.keyNote('Press the key for ' + act.toUpperCase() + '. Esc cancels, Backspace clears it.');
  }
  endCapture() { if (!this._cap) return; this._cap.btn.classList.remove('wait'); this._cap = null; if (this.input) this.input.capturing = false; this.renderKeys(); }
  keyNote(t) { $('k-note').textContent = t || 'Click a key to change it. Steer with the mouse, WASD or the arrows.'; $('k-note').classList.toggle('warn', /^CAREFUL/.test(t || '')); }
  renderKeys() {
    const B = this.input.binds;
    for (const row of document.querySelectorAll('#opt-keys .k-row')) for (const b of row.querySelectorAll('.k-cap')) {
      if (this._cap && this._cap.btn === b) continue;
      const code = B[row.dataset.act][Number(b.dataset.slot)];
      b.textContent = code ? keyLabel(code) : '—'; b.classList.toggle('empty', !code);
      b.setAttribute('aria-label', row.dataset.act + (b.dataset.slot === '0' ? ' key: ' : ' second key: ') + (code ? keyLabel(code) : 'none'));
    }
    $('k-mouse').textContent = 'MOUSE BUTTONS: ' + (B.mouse ? 'ON' : 'OFF'); $('k-mouse').classList.toggle('off', !B.mouse);
  }
  // the bindings or the mode changed: the launcher's PC line says what the keys are now
  controlsChanged() {
    const low = (a) => this.input.say(a).replace(/ OR /g, ' or ').replace('LEFT-CLICK', 'left-click').replace('RIGHT-CLICK', 'right-click');
    $('hint-pc').textContent = 'Mouse or WASD to steer · ' + low('roll') + ' to roll · ' + low('greed') + ' for GREED · ' + this.input.labels('pause').join(' or ') + ' to pause';
    this.renderKeys();
  }
  show(id) { this.hideAll(); $(id).hidden = false; this.syncMenuLoop(); }
  toast(text) { const t = $('toast'); t.textContent = text; t.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1800, fill: 'forwards' }); }

  // ---- the loading screen: real progress from the loaders
  loading(on, label) {
    const el = $('loading');
    el.classList.toggle('done', !on);
    if (on) el.classList.remove('parked'); // (0.4.0 boot-menu: parked out of the page during the boot)
    // 0.4.0: the loader vignette (art/ui/loader/vignette.js) plays while the screen shows; leaving, the Wake surges out
    // and its loop stops (none with #loader-old: the streak screen's CSS does its own)
    if (window.__vignette) window.__vignette.show(on);
    if (on) { $('loader-label').textContent = label || ''; this.progress(0, 'LOADING'); }
  }
  // the press on the loading screen: one gesture (touchend, click or any key), handled inside the event itself. 0.4.0: not
  // while the studio splash is up (index.html): a press then is never the one that starts the game
  pressToStart(go) {
    const el = $('loading'), p = $('loader-prompt');
    p.textContent = this.o.touch ? 'TAP TO START' : 'PRESS ANY KEY';
    el.classList.add('ready'); $('loader-what').textContent = 'READY';
    let done = false;
    const fire = (e) => { if (done || $('splash')) return; if (e && e.type === 'keydown' && (e.repeat || e.metaKey || e.ctrlKey || e.altKey)) return; done = true; this.cancelPress(); if (e && e.cancelable) e.preventDefault(); go(); };
    this._press = fire;
    el.addEventListener('click', fire); el.addEventListener('touchend', fire, { passive: false }); window.addEventListener('keydown', fire);
  }
  cancelPress() {
    const el = $('loading'), fire = this._press; if (!fire) return;
    el.removeEventListener('click', fire); el.removeEventListener('touchend', fire); window.removeEventListener('keydown', fire);
    el.classList.remove('ready'); this._press = null;
  }
  // 0.4.0 boot-menu (Evrtek 11-07; #boot-old keeps the press above): the menu opens by itself, silent. Its first press
  // anywhere (a tap, a click or a key) unlocks the sound inside the event (iOS) and starts the menu music. On the menu it
  // then goes on to do what it would anyway (the MCP, 11-07: "A tap on NEW GAME that does nothing reads as broken"): a tap
  // on a button fires that button, a tap on empty space only brings the music, Enter is the launcher's Enter. It listens
  // on window in the capture phase, so it sees the press before any button or the launcher's keys. While the studio logo
  // is still up, every press is eaten and reaches nothing behind it (the launcher's Enter would start a run behind the
  // logo); once the menu is whole, the press that skips the logo's hold is the first press: the music starts as the menu
  // fades in. A press while the menu is not showing (a run a test or a dev link started) passes through untouched and
  // stands it down. Esc, Tab and lone modifier keys do not count (no browser unlocks sound on them).
  firstGesture(go) {
    this.cancelFirst();
    const eat = (e) => { if (e.cancelable) e.preventDefault(); e.stopImmediatePropagation(); };
    let first = false;
    const fire = (e) => {
      const sp = window.__splash, up = !!sp && sp.phase !== 'gone';
      if (!up && $('title').hidden) { this.cancelFirst(); return; }
      if (up) eat(e);                                                  // the logo still up: nothing reaches the menu
      if (up && !sp.whole) return;                                     // (over a menu not whole yet: not the first press either)
      if (e.type === 'keydown' && (e.repeat || e.metaKey || e.ctrlKey || e.altKey || /^(Escape|Tab|Shift|Control|Alt|Meta|CapsLock)$/.test(e.key))) return;
      if (!first) { first = true; this.firstAt = Math.round(performance.now()); go(); }
      if (!up) this.cancelFirst();                                     // on the menu: the press goes on, untouched
    };
    this._first = fire;
    window.addEventListener('touchend', fire, { capture: true, passive: false }); window.addEventListener('click', fire, true); window.addEventListener('keydown', fire, true);
  }
  cancelFirst() {
    const f = this._first; if (!f) return;
    window.removeEventListener('touchend', f, true); window.removeEventListener('click', f, true); window.removeEventListener('keydown', f, true);
    this._first = null;
  }
  progress(k, what) { $('loader-ring').style.setProperty('--p', Math.max(0, Math.min(1, k)).toFixed(3)); if (what) $('loader-what').textContent = what; }

  // ---- the launcher. CONTINUE names the galaxy and the level ("THE VERDANT DEEP · 04"); the best line is the whole
  // game's stars, out of 150
  launcher() {
    this.show('title');
    const any = this.Progress.any();
    $('continue-btn').hidden = !any;
    if (any) { const [g, n] = this.Progress.furthestAt(); $('continue-cap').textContent = levelLabel(g, n); }
    $('dev-btn').hidden = !this.devOn;
    $('best-line').textContent = any ? STAR + ' ' + this.Progress.totalStars() + ' / ' + this.Progress.maxStars() + '   TOTAL ' + fmt(this.Progress.totalScore()) : '';
  }
  // ---- 0.4.0: THE GALAXY CHART. LEVEL SELECT opens it: every galaxy that exists, joined by the route line, each with
  // its stars out of 50 and ten pips that light as its levels are cleared. A locked one is a dim silhouette with one line
  // under it (FINISH THE LATTICE HEART). Tap one to open its sector map. Placeholder emblems and lettering until Yori's.
  chart() {
    const box = $('chart'); box.textContent = '';
    const img = (src, cls) => { const i = new Image(); i.src = 'art/' + src + V; i.alt = ''; if (cls) i.className = cls; i.decoding = 'async'; return i; };
    box.appendChild(Object.assign(document.createElement('div'), { className: 'chart-route' }));
    GALAXIES.forEach((x, i) => {
      const open = this.Progress.galaxyOpen(x.g) || this.devOn, stars = this.Progress.totalStars(x.g);
      const b = document.createElement('button'); b.className = 'gal ' + (open ? 'open' : 'locked') + (this.justOpened === x.g ? ' new' : ''); b.dataset.g = x.g;
      b.style.setProperty('--tint', x.tint); b.disabled = !open;
      b.setAttribute('aria-label', x.name + (open ? ', ' + stars + ' of ' + this.Progress.maxStars(x.g) + ' stars' : ', locked: finish ' + GALAXIES[i - 1].finale));
      // her emblem (a spiral of motes; locked, a dim silhouette with a padlock), else the placeholder spiral
      const em = document.createElement('div'); em.className = 'emblem';
      if (x.has.emblem) em.appendChild(img('ui/chart/emblem-g' + x.g + '-' + (open ? 'open' : 'locked') + '.png')); else em.classList.add('ph');
      b.appendChild(em);
      const info = document.createElement('div'); info.className = 'ginfo'; b.appendChild(info);
      const nm = document.createElement('div'); nm.className = 'gname';
      if (x.has.label) nm.appendChild(img('ui/chart/name-g' + x.g + '.png')); else nm.textContent = x.name;
      info.appendChild(nm);
      if (open) {
        const st = document.createElement('div'); st.className = 'gstars'; st.textContent = STAR + ' ' + stars + ' / ' + this.Progress.maxStars(x.g); info.appendChild(st);
        const pips = document.createElement('div'); pips.className = 'pips';
        for (const c of x.levels) { if (x.has.emblem) pips.appendChild(img('ui/chart/pip-' + (this.Progress.cleared(x.g, c.n) ? 'on' : 'off') + '.png')); else { const d = document.createElement('span'); if (this.Progress.cleared(x.g, c.n)) d.className = 'on'; pips.appendChild(d); } }
        info.appendChild(pips);
        b.addEventListener('click', () => { this.audio.unlock(); this.select(x.g); });
      } else if (x.has.label) info.appendChild(img('ui/chart/lock-g' + x.g + '.png', 'glock'));
      else { const lk = document.createElement('div'); lk.className = 'glock'; lk.textContent = 'FINISH ' + GALAXIES[i - 1].finale; info.appendChild(lk); }
      // 0.6.0, the demo: a shut galaxy is not waiting on a level you can finish; it says where it is
      if (!open && DEMO) { const gl = info.querySelector('.glock'); if (gl) gl.remove(); const lk = document.createElement('div'); lk.className = 'glock demo-lock'; lk.textContent = DEMO_TEXT.locked; info.appendChild(lk); b.setAttribute('aria-label', x.name + ', ' + DEMO_TEXT.locked.toLowerCase()); }
      box.appendChild(b);
    });
    this.justOpened = null;
    $('chart-totals').textContent = STAR + ' ' + this.Progress.totalStars() + ' / ' + this.Progress.maxStars() + '   TOTAL ' + fmt(this.Progress.totalScore());
    this.show('galaxies');
    this.layoutChart();
    if (!this.chartNodes) fetch('art/ui/chart/galaxy-nodes.json' + V).then((r) => r.json()).then((j) => { this.chartNodes = j; if (!$('galaxies').hidden) this.layoutChart(); }, () => {});
  }
  // the chart is contained at her art's aspect (16:9, or 9:16 in portrait) and each galaxy sits on her node: its text
  // under the emblem in landscape, to its right (at x 0.70) in portrait, so the route never crosses it
  layoutChart() {
    const W = window.innerWidth, H = window.innerHeight, portrait = H > W, ar = portrait ? 9 / 16 : 16 / 9;
    let w = W, h = W / ar; if (h > H) { h = H; w = H * ar; }
    const c = $('chart'); c.classList.toggle('portrait', portrait); c.style.width = w + 'px'; c.style.height = h + 'px';
    c.style.setProperty('--h', h + 'px'); c.style.setProperty('--w', w + 'px');
    const L = this.chartNodes && this.chartNodes[portrait ? 'portrait' : 'landscape'];
    for (const b of c.querySelectorAll('.gal')) {
      const g = Number(b.dataset.g), n = L && L.galaxies.find((q) => q.galaxy === g);
      const x = n ? n.x : portrait ? 0.3 : (g - 0.5) / 3, y = n ? n.y : portrait ? 1 - (g - 0.5) / 3 : 0.5;
      b.style.setProperty('--x', x); b.style.setProperty('--y', y); b.style.setProperty('--tx', portrait ? (L && L.textX) || 0.7 : x);
    }
  }
  // ---- a galaxy's SECTOR MAP (Yori's level select): cleared levels to replay, the next one open, the rest locked.
  // Galaxy 1's is exactly as approved; galaxies 2 and 3 use the same system with their own layers once hers land.
  select(g = this.gal) {
    if (!galaxy(g)) return; // past either end: stay
    if (!this.Progress.galaxyOpen(g) && !this.devOn) return; // a locked galaxy has no map to open
    this.gal = g;
    const G = galaxy(g), box = $('tiles'); box.textContent = '';
    const img = (src, cls) => { const i = new Image(); i.src = 'art/' + src + V; i.alt = ''; if (cls) i.className = cls; i.decoding = 'async'; return i; };
    $('select').dataset.g = g; $('select').classList.toggle('ph', !G.has.map); $('select').style.setProperty('--tint', G.tint);
    for (const c of G.levels) {
      const p = this.Progress.get(g, c.n), open = this.Progress.unlocked(g, c.n) || this.devOn, nn = String(c.n).padStart(2, '0');
      const t = document.createElement('button'); t.className = 'mtile ' + (!open ? 'locked' : p.cleared ? 'cleared' : 'open'); t.dataset.n = c.n; // (0.6.0: locked first, so a level shut by the demo reads as locked whatever the save holds)
      t.disabled = !open; t.setAttribute('aria-label', 'Level ' + c.n + ' ' + c.name + (open ? '' : ', locked') + ', ' + p.stars + ' of ' + MAX_STARS + ' stars');
      t.append(img('ui/num-' + nn + '.png', 'n'));
      if (g === 1) t.append(img('ui/name-' + (c.art || nn) + '.png', 'nm'));
      else if (G.has.names) t.append(img('ui/g' + g + '/name-' + nn + '.png', 'nm'));
      else { const nm = document.createElement('span'); nm.className = 'nm ph'; nm.textContent = c.name; t.append(nm); } // placeholder until her lettering
      if (open) {
        const st = document.createElement('div'); st.className = 'st';
        // five stars (Evrtek 11-06): Yori's star, smaller, five across where three were (css .mtile .st)
        for (let i = 0; i < MAX_STARS; i++) st.appendChild(img(i < p.stars ? 'ui/star-on.png' : 'ui/star-off.png'));
        t.appendChild(st);
        const bs = document.createElement('div'); bs.className = 'bs';
        if (p.rank) bs.appendChild(img('rank-' + p.rank.toLowerCase() + '-glow.png'));
        bs.appendChild(document.createTextNode(p.score ? fmt(p.score) : ''));
        t.appendChild(bs);
        t.addEventListener('click', () => { this.audio.unlock(); this.start(g, c.n); });
      }
      box.appendChild(t);
    }
    // the galaxy's name over the map (her lettering once it lands), and the arrows to its neighbours
    const gn = $('select-galaxy'); gn.textContent = '';
    if (G.has.label) gn.appendChild(img('ui/chart/title-' + G.name.toLowerCase().replace(/[^a-z]+/g, '-') + '.png')); else gn.textContent = G.name;
    $('gal-prev').hidden = !galaxy(g - 1); $('gal-next').hidden = !galaxy(g + 1);
    $('gal-next').disabled = !!galaxy(g + 1) && !this.Progress.galaxyOpen(g + 1) && !this.devOn;
    $('totals').textContent = STAR + ' ' + this.Progress.totalStars(g) + ' / ' + this.Progress.maxStars(g) + '   ·   ' + STAR + ' ' + this.Progress.totalStars() + ' / ' + this.Progress.maxStars();
    // 0.6.0, the demo: the map says where the shut levels are (never a price, never a link)
    if (DEMO) $('totals').textContent = STAR + ' ' + this.Progress.totalStars(g) + ' / ' + DEMO_LEVELS * MAX_STARS + '   ·   LEVELS ' + (DEMO_LEVELS + 1) + ' TO ' + G.levels.length + ' ARE ' + DEMO_TEXT.locked;
    this.show('select');
    this.layoutMap();
  }
  // contain the map at the art's aspect and put each tile centred under its node, scaled to the map
  layoutMap() {
    const W = window.innerWidth, H = window.innerHeight, portrait = H > W;
    const ar = portrait ? 9 / 16 : 16 / 9;
    let w = W, h = W / ar; if (h > H) { h = H; w = H * ar; }
    const m = $('map'); m.style.width = w + 'px'; m.style.height = h + 'px'; m.classList.toggle('portrait', portrait);
    // 0.4.0: galaxies 2 and 3 keep their nodes under 'g2' and 'g3' in map-nodes.json; until hers land, galaxy 1's places
    const set = this.nodes && (this.gal > 1 && this.nodes['g' + this.gal] ? this.nodes['g' + this.gal] : this.nodes);
    const nodes = set && set[portrait ? 'portrait' : 'landscape'];
    // tile width in the previews: 160 of 1920 (landscape), 198 of 1080 (portrait)
    const k = (portrait ? 198 / 1080 : 160 / 1920) * w / 350;
    for (const t of $('tiles').children) {
      const n = Number(t.dataset.n), node = nodes && nodes.find((q) => q.level === n);
      const x = node ? node.x : (n - 0.5) / 10, y = node ? node.y : 0.5;
      t.style.left = (x * w - 175) + 'px'; t.style.top = (y * h + (portrait ? 34 : 38) / (portrait ? 1920 : 1080) * h) + 'px';
      t.style.transform = 'scale(' + k.toFixed(4) + ')';
    }
  }
  // ---- the end card's stars: what this run earned, and what the next one needs
  showStars(st, saved, dev) {
    const el = $('end-stars'); el.textContent = '';
    const row = document.createElement('div'); row.className = 'row';
    // Yori's stars, as on the sector map
    for (let i = 0; i < MAX_STARS; i++) { const im = new Image(); im.src = 'art/ui/star-' + (st.have[i] ? 'on' : 'off') + '.png' + V; im.alt = st.have[i] ? STAR : NOSTAR; if (st.have[i]) im.className = 'got'; row.appendChild(im); }
    el.appendChild(row);
    // the next star, in plain words: what this run was missing for it (levels.js grade())
    const n = document.createElement('div'); n.className = 'need';
    n.textContent = dev ? 'DEV RUN: NOTHING SAVED. ' + st.next : st.next;
    el.appendChild(n);
  }
  // cp (0.6.0): { score } when the run went down after taking its checkpoint: the card offers a start from there, and says
  // what that keeps
  endScreen(L, cleared, gc, cp = null) {
    this.show('end');
    this.cpReady = !!cp; $('cp-btn').hidden = !cp; $('again-btn').textContent = cp ? 'FROM THE START' : 'FLY AGAIN'; $('again-btn').className = cp ? 'ghost-btn' : 'go'; // (the checkpoint is the card's first offer)
    if (cp) { const n = document.createElement('div'); n.className = 'need cp'; n.textContent = 'YOUR CHECKPOINT KEPT ' + fmt(cp.score) + ' POINTS. FROM THERE YOU START AT x1 WITH A FULL SHIELD.'; $('end-stars').appendChild(n); }
    const nx = this.nextOf(L), open = nx && (this.Progress.unlocked(nx[0], nx[1]) || this.G.dev);
    $('next-btn').hidden = !(cleared && open);
    // 0.4.0: a level 10 finished. The chart's route lights up to the next galaxy, which says it is open.
    const el = $('end-galaxy'); el.hidden = !gc;
    if (gc) {
      const N = gc.next && galaxy(gc.next);
      el.textContent = '';
      if (N && (gc.opened || this.G.dev)) { const i = new Image(); i.src = 'art/ui/chart/card-g' + N.g + '-is-open.png' + V; i.alt = N.name + ' IS OPEN'; el.appendChild(i); }
      const head = $('end-head'); head.textContent = ''; const st = new Image(); st.src = 'art/galaxy-clear-glow.png' + V; st.alt = 'GALAXY CLEAR'; st.className = 'stamp'; head.appendChild(st);
      if (N && gc.opened) this.justOpened = N.g;
      $('next-btn').textContent = N ? 'NEXT GALAXY' : 'NEXT LEVEL';
    } else $('next-btn').textContent = 'NEXT LEVEL';
    // the whole game's last clear, on a real run: the credits roll on the way out (once), and the card offers them
    this.finalClear = !!(gc && gc.final);
    if (this.finalClear) { $('next-btn').hidden = false; $('next-btn').textContent = 'CREDITS'; }
    // 0.6.0, the demo: its last level beaten: the card's next step is the demo card (js/demo.js)
    this.demoEnd = !!(cleared && demoEnds(L.g || 1, L.n));
    if (this.demoEnd) { $('next-btn').hidden = false; $('next-btn').textContent = 'CONTINUE'; }
  }
  // ---- the DEMO CARD (0.6.0; Evrtek 11-10: a tasteful 'full version' end card; no prices, no store links, no 'buy')
  demoCard() {
    $('demo-head').textContent = DEMO_TEXT.head;
    const box = $('demo-lines'); box.textContent = '';
    for (const t of DEMO_TEXT.lines) { const d = document.createElement('p'); d.textContent = t; box.appendChild(d); }
    this.demoEnd = false; this.show('demo'); this.o.menuMusic();
  }
  // ---- the CREDITS (0.4.0, g3-d): from CREDITS.md, in a person's voice. Headings in Kalakar's lettering where she has drawn
  // them (the wordmark, the three galaxy names), plain styled text otherwise. The menu's track keeps playing under it.
  rollThen(then) { if (this.finalClear) { this.finalClear = false; this.credits(then); } else then(); }
  credits(then) {
    const roll = $('credits-roll');
    if (!roll.childElementCount) {
      const add = (tag, cls, text) => { const d = document.createElement(tag); d.className = cls; if (text) d.textContent = text; roll.appendChild(d); return d; };
      const pic = (src, cls, alt) => { const i = new Image(); i.src = 'art/' + src + V; i.alt = alt || ''; i.className = cls; i.decoding = 'async'; roll.appendChild(i); return i; };
      add('div', 'cr-studio', 'REIMERTEK STUDIOS');
      add('div', 'cr-small', 'presents');
      pic('ring-reaper-wordmark.png', 'cr-mark', 'RING REAPER');
      add('div', 'cr-gap');
      add('div', 'cr-head', 'DESIGN');
      add('div', 'cr-name', 'Evrtek');
      add('p', 'cr-say', 'The idea, the rulings, and the one who played every level and said "make it easier" when it needed it.');
      add('div', 'cr-head', 'THE PROGRAMS');
      add('div', 'cr-name', 'Dirigent');
      add('p', 'cr-say', 'Planned the first galaxy, kept the night on schedule and checked everything before you saw it.');
      add('div', 'cr-name', 'Fundi');
      add('p', 'cr-say', 'Wrote the game: the engine, the power-ups and every level, one builder to a few levels, and the sound.');
      add('div', 'cr-name', 'Kalakar');
      add('p', 'cr-say', 'Drew everything you see: the Wake, every creature and machine, the twelve bosses, the three galaxies and all the lettering.');
      add('div', 'cr-name', 'Indaga');
      add('p', 'cr-say', 'Read up on how great levels are made and wrote the checklist every one of these was built to.');
      add('div', 'cr-head', 'THE GALAXIES');
      for (const x of GALAXIES) { if (x.has.label) pic('ui/chart/name-g' + x.g + '.png', 'cr-galaxy', x.name); else add('div', 'cr-name', x.name); }
      add('div', 'cr-head', 'MUSIC AND SOUND');
      add('p', 'cr-say', 'Made with ElevenLabs from our own words. Every track is one whole take, cut only on its bar lines.');
      add('div', 'cr-head', 'BUILT WITH');
      add('p', 'cr-say', 'three.js, by the three.js authors (MIT licence).');
      add('p', 'cr-say', 'Mulberry32 random numbers, by Tommy Ettinger (public domain).');
      add('div', 'cr-gap');
      add('div', 'cr-end', 'THANKS FOR FLYING.');
      add('div', 'cr-small', '© Evrtek · REIMERTEK STUDIOS');
    }
    this.creditsThen = then || (() => this.launcher());
    $('credits-skip').textContent = this.o.touch ? 'TAP TO SKIP' : 'PRESS ANY KEY TO SKIP';
    this.show('credits');
    if (this.o.menuMusic) this.o.menuMusic();
    // the roll: from below the screen to past the top, about 50 px a second
    const H = window.innerHeight, h = roll.offsetHeight || 2400, ms = Math.max(30000, (H + h) / 50 * 1000);
    roll.getAnimations().forEach((a) => a.cancel());
    this.creditsAnim = roll.animate([{ transform: 'translateY(' + H + 'px)' }, { transform: 'translateY(' + (-h) + 'px)' }], { duration: ms, easing: 'linear', fill: 'forwards' });
    this.creditsAnim.onfinish = () => this.creditsEnd();
  }
  creditsEnd() {
    if ($('credits').hidden) return;
    const then = this.creditsThen; this.creditsThen = null;
    if (this.creditsAnim) { this.creditsAnim.onfinish = null; this.creditsAnim.cancel(); }
    $('credits').hidden = true;
    (then || (() => this.launcher()))();
  }
  pause(on) { if (on) this.show('paused'); else $('paused').hidden = true; }
  syncToggles() {
    for (const b of document.querySelectorAll('[data-tog]')) {
      const on = b.dataset.tog === 'music' ? this.audio.musicOn : this.audio.sfxOn;
      const what = b.dataset.tog === 'music' ? 'MUSIC' : 'SOUND';
      if (b.classList.contains('img-tog')) { b.querySelector('.sw').src = 'art/ui/toggle-' + (on ? 'on' : 'off') + '.png' + V; b.setAttribute('aria-label', what + (on ? ' on' : ' off')); }
      else b.textContent = what + ': ' + (on ? 'ON' : 'OFF');
      b.classList.toggle('off', !on);
    }
    const t = $('tips-tog'), on = tipsSetting();
    t.querySelector('.sw').src = 'art/ui/toggle-' + (on ? 'on' : 'off') + '.png' + V; t.setAttribute('aria-label', 'TIPS' + (on ? ' on' : ' off')); t.classList.toggle('off', !on);
  }

  // ---- dev mode: ships hidden; a DEV badge shows while it is on
  toggleDev() {
    if (DEMO_BUILD) return; // a demo build has no dev menu (it opens every level)
    this.devOn = !this.devOn; this.G.dev = this.devOn;
    store('ringreaper.dev', this.devOn ? 1 : 0);
    this.toast(this.devOn ? 'DEV MODE ON' : 'DEV MODE OFF');
    this.syncDev();
    if (this.G.state === 'title') this.launcher();
  }
  syncDev() {
    const G = this.G;
    G.devSpeed = G.devSpeed || 1;
    $('dev-god').textContent = 'GOD: ' + (G.devGod ? 'ON' : 'OFF');
    $('dev-speed').textContent = 'SPEED: ' + G.devSpeed + 'x';
    $('dev-fps-btn').textContent = 'FPS: ' + (this.fpsOn ? 'ON' : 'OFF');
    $('dev-tip').textContent = 'ROLL LINE: ' + (this.Progress.tip('roll') ? 'DONE' : 'WILL SHOW');
    $('dev-badge').hidden = !this.devOn;
    $('dev-fps').textContent = '';
  }
  // every level, every section, every boss; a level's sections load with its module, on first open. 0.4.0: a tab a
  // galaxy, and every galaxy is open from here (dev runs never save)
  devMenu(g = this.devGal) {
    this.devGal = g;
    for (const b of document.querySelectorAll('[data-dev-g]')) b.classList.toggle('on', Number(b.dataset.devG) === g);
    const box = $('dev-levels'); box.textContent = '';
    for (const c of catalogueOf(g)) {
      const row = document.createElement('div'); row.className = 'dev-row';
      const head = document.createElement('button'); head.className = 'tog dev-head'; head.textContent = (g > 1 ? 'G' + g + ' ' : '') + String(c.n).padStart(2, '0') + ' ' + c.name + '   ' + STAR + ' ' + this.Progress.get(g, c.n).stars + '/' + MAX_STARS;
      const body = document.createElement('div'); body.className = 'dev-secs';
      head.addEventListener('click', async () => {
        this.audio.unlock();
        if (body.childElementCount) { this.start(g, c.n); return; }
        let L;
        try { L = await loadLevel(g, c.n); } catch (e) { body.textContent = 'NOT BUILT YET'; return; }
        const mk = (label, opts) => { const b = document.createElement('button'); b.className = 'tog'; b.textContent = label; b.addEventListener('click', () => { this.audio.unlock(); this.start(g, c.n, opts); }); body.appendChild(b); };
        mk('START', {});
        for (const s of L.sections) mk(s.sub || s.id, { section: s.id });
        if (L.boss) mk('BOSS', { boss: true });
      });
      row.append(head, body); box.appendChild(row);
    }
    this.syncDev();
    this.show('dev');
  }
  tick(dt) {
    if (!this.fpsOn || !this.devOn) return;
    this.fpsT += dt; this.fpsN++;
    if (this.fpsT >= 0.5) { $('dev-fps').textContent = Math.round(this.fpsN / this.fpsT) + ' FPS'; this.fpsT = 0; this.fpsN = 0; }
  }
}
export { RANK_ORDER };
