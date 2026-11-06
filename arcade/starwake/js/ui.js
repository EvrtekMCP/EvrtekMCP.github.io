// STARWAKE 0.3.0: the screens around the flying: the loading screen, the launcher (NEW GAME, CONTINUE, LEVEL
// SELECT, OPTIONS), the level select with stars, the end card's stars, pause, and the hidden dev menu.
// Every level shares them; nothing here knows any one level.
import { fmt, store, V } from './util.js?v=0.3.0';
import { loadLevel, RANK_ORDER, MAX_STARS } from './levels.js?v=0.3.0';
import { keyLabel, codeOf } from './input.js?v=0.3.0';

const $ = (id) => document.getElementById(id);
const SCREENS = ['title', 'select', 'options', 'confirm', 'dev', 'paused', 'end'];
const STAR = '★', NOSTAR = '☆';

export class UI {
  constructor(o) {
    this.o = o; this.G = o.G; this.audio = o.audio; this.Progress = o.Progress; this.CATALOGUE = o.CATALOGUE; this.level = o.level; this.input = o.input;
    this.fpsOn = false; this.fpsT = 0; this.fpsN = 0; this.back = 'title';
    this.devOn = o.params.has('dev') || !!store('starwake.dev');
    this.nodes = null; fetch('art/ui/map-nodes.json' + V).then((r) => r.json()).then((j) => { this.nodes = j; if (!$('select').hidden) this.select(); }, () => {});
    window.addEventListener('resize', () => { if (!$('select').hidden) this.layoutMap(); });
    this.G.dev = this.devOn;
    $('ver').textContent = 'v' + o.version;
    // the control texts follow how the player is playing right now (input.mode), not the device; main.js keeps it live
    document.body.classList.toggle('touch', this.input.mode === 'touch');
    this.keysUI();
    this.controlsChanged();
    const on = (id, fn) => $(id).addEventListener('click', (e) => { this.audio.unlock(); fn(e); });
    on('start-btn', () => (this.Progress.any() ? this.show('confirm') : this.start(1)));
    on('confirm-yes', () => { this.Progress.wipe(); this.start(1); });
    on('continue-btn', () => this.start(this.Progress.furthest()));
    on('select-btn', () => this.select());
    on('options-btn', () => { this.syncToggles(); this.show('options'); });
    on('dev-btn', () => this.devMenu());
    on('again-btn', () => this.start(this.level().n, this.lastOpts || {}));
    on('next-btn', () => this.start(this.level().n + 1));
    on('levels-btn', () => this.select());
    on('title-btn', () => this.o.toTitle());
    on('resume-btn', () => this.o.resume());
    on('quit-btn', () => this.o.toTitle());
    $('pause-btn').addEventListener('click', () => this.o.pause());
    $('greed-btn').addEventListener('click', (e) => { e.preventDefault(); this.o.greedGo(); });
    for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', () => this.launcher());
    for (const b of document.querySelectorAll('[data-tog]')) b.addEventListener('click', () => { this.audio.unlock(); this.audio.toggle(b.dataset.tog); this.syncToggles(); });
    // the dev gestures: type "dev" on the launcher, or tap the studio name five times inside two seconds
    let typed = '';
    window.addEventListener('keydown', (e) => {
      const st = this.G.state;
      if (st === 'title' && /^[a-z]$/i.test(e.key)) { typed = (typed + e.key.toLowerCase()).slice(-3); if (typed === 'dev') { typed = ''; this.toggleDev(); } }
      if ((e.key === 'Enter' || (e.key === ' ' && !e.repeat)) && st === 'title' && !$('title').hidden) { e.preventDefault(); this.audio.unlock(); if (this.Progress.any()) this.start(this.Progress.furthest()); else this.start(1); }
      if ((e.key === 'Enter' || (e.key === ' ' && !e.repeat)) && st === 'end') { e.preventDefault(); this.start(this.level().n, this.lastOpts || {}); }
    });
    let taps = [];
    $('studio').addEventListener('click', () => { const t = performance.now(); taps = taps.filter((x) => t - x < 2000); taps.push(t); if (taps.length >= 5) { taps = []; this.toggleDev(); } });
    $('dev-god').addEventListener('click', () => { this.G.devGod = !this.G.devGod; this.syncDev(); });
    $('dev-speed').addEventListener('click', () => { const s = [0.5, 1, 2, 4]; this.G.devSpeed = s[(s.indexOf(this.G.devSpeed) + 1) % s.length]; this.syncDev(); });
    $('dev-fps-btn').addEventListener('click', () => { this.fpsOn = !this.fpsOn; this.syncDev(); });
    // the roll lesson (0.3.0) shows until the first shot sent back; this brings it back for the next level 1
    $('dev-tip').addEventListener('click', () => { this.Progress.setTip('roll', !this.Progress.tip('roll')); this.syncDev(); });
    $('dev-off').addEventListener('click', () => { this.toggleDev(); this.launcher(); });
    this.syncDev();
  }
  start(n, opts = {}) { this.lastOpts = opts; return this.o.start(n, opts); }
  hideAll() { this.endCapture(); for (const s of SCREENS) $(s).hidden = true; }

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
  show(id) { this.hideAll(); $(id).hidden = false; }
  toast(text) { const t = $('toast'); t.textContent = text; t.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1800, fill: 'forwards' }); }

  // ---- the loading screen: real progress from the loaders
  loading(on, label) {
    const el = $('loading');
    el.classList.toggle('done', !on);
    if (on) { $('loader-label').textContent = label || ''; this.progress(0, 'LOADING'); }
  }
  // the press on the loading screen: one gesture (touchend, click or any key), handled inside the event itself
  pressToStart(go) {
    const el = $('loading'), p = $('loader-prompt');
    p.textContent = this.o.touch ? 'TAP TO START' : 'PRESS ANY KEY';
    el.classList.add('ready'); $('loader-what').textContent = 'READY';
    let done = false;
    const fire = (e) => { if (done) return; if (e && e.type === 'keydown' && (e.repeat || e.metaKey || e.ctrlKey || e.altKey)) return; done = true; this.cancelPress(); if (e && e.cancelable) e.preventDefault(); go(); };
    this._press = fire;
    el.addEventListener('click', fire); el.addEventListener('touchend', fire, { passive: false }); window.addEventListener('keydown', fire);
  }
  cancelPress() {
    const el = $('loading'), fire = this._press; if (!fire) return;
    el.removeEventListener('click', fire); el.removeEventListener('touchend', fire); window.removeEventListener('keydown', fire);
    el.classList.remove('ready'); this._press = null;
  }
  progress(k, what) { $('loader-ring').style.setProperty('--p', Math.max(0, Math.min(1, k)).toFixed(3)); if (what) $('loader-what').textContent = what; }

  // ---- the launcher
  launcher() {
    this.show('title');
    const any = this.Progress.any();
    $('continue-btn').hidden = !any;
    if (any) $('continue-cap').textContent = 'LEVEL ' + this.Progress.furthest();
    $('dev-btn').hidden = !this.devOn;
    const stars = this.Progress.totalStars();
    $('best-line').textContent = any ? STAR + ' ' + stars + ' / ' + this.CATALOGUE.length * MAX_STARS + '   TOTAL ' + fmt(this.Progress.totalScore()) : '';
  }
  // ---- the level select (Yori's sector map): cleared levels to replay, the next one open, the rest locked
  select() {
    const box = $('tiles'); box.textContent = '';
    const img = (src, cls) => { const i = new Image(); i.src = 'art/' + src + V; i.alt = ''; if (cls) i.className = cls; i.decoding = 'async'; return i; };
    for (const c of this.CATALOGUE) {
      const p = this.Progress.get(c.n), open = this.Progress.unlocked(c.n), nn = String(c.n).padStart(2, '0');
      const t = document.createElement('button'); t.className = 'mtile ' + (p.cleared ? 'cleared' : open ? 'open' : 'locked'); t.dataset.n = c.n;
      t.disabled = !open; t.setAttribute('aria-label', 'Level ' + c.n + ' ' + c.name + (open ? '' : ', locked') + ', ' + p.stars + ' of ' + MAX_STARS + ' stars');
      t.append(img('ui/num-' + nn + '.png', 'n'), img('ui/name-' + (c.art || nn) + '.png', 'nm'));
      if (open) {
        const st = document.createElement('div'); st.className = 'st';
        // five stars (Evrtek 11-06): Yori's star, smaller, five across where three were (css .mtile .st)
        for (let i = 0; i < MAX_STARS; i++) st.appendChild(img(i < p.stars ? 'ui/star-on.png' : 'ui/star-off.png'));
        t.appendChild(st);
        const bs = document.createElement('div'); bs.className = 'bs';
        if (p.rank) bs.appendChild(img('rank-' + p.rank.toLowerCase() + '-glow.png'));
        bs.appendChild(document.createTextNode(p.score ? fmt(p.score) : ''));
        t.appendChild(bs);
        t.addEventListener('click', () => { this.audio.unlock(); this.start(c.n); });
      }
      box.appendChild(t);
    }
    $('totals').textContent = STAR + ' ' + this.Progress.totalStars() + ' / ' + this.CATALOGUE.length * MAX_STARS + '   TOTAL ' + fmt(this.Progress.totalScore());
    this.show('select');
    this.layoutMap();
  }
  // contain the map at the art's aspect and put each tile centred under its node, scaled to the map
  layoutMap() {
    const W = window.innerWidth, H = window.innerHeight, portrait = H > W;
    const ar = portrait ? 9 / 16 : 16 / 9;
    let w = W, h = W / ar; if (h > H) { h = H; w = H * ar; }
    const m = $('map'); m.style.width = w + 'px'; m.style.height = h + 'px'; m.classList.toggle('portrait', portrait);
    const nodes = this.nodes && this.nodes[portrait ? 'portrait' : 'landscape'];
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
  endScreen(L, cleared) {
    this.show('end');
    const next = this.CATALOGUE.find((c) => c.n === L.n + 1);
    $('next-btn').hidden = !(cleared && next && (this.Progress.unlocked(next.n) || this.G.dev));
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
  }

  // ---- dev mode: ships hidden; a DEV badge shows while it is on
  toggleDev() {
    this.devOn = !this.devOn; this.G.dev = this.devOn;
    store('starwake.dev', this.devOn ? 1 : 0);
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
    $('dev-tip').textContent = 'ROLL LESSON: ' + (this.Progress.tip('roll') ? 'DONE' : 'WILL SHOW');
    $('dev-badge').hidden = !this.devOn;
    $('dev-fps').textContent = '';
  }
  // every level, every section, every boss; a level's sections load with its module, on first open
  devMenu() {
    const box = $('dev-levels'); box.textContent = '';
    for (const c of this.CATALOGUE) {
      const row = document.createElement('div'); row.className = 'dev-row';
      const head = document.createElement('button'); head.className = 'tog dev-head'; head.textContent = String(c.n).padStart(2, '0') + ' ' + c.name + '   ' + STAR + ' ' + this.Progress.get(c.n).stars + '/' + MAX_STARS;
      const body = document.createElement('div'); body.className = 'dev-secs';
      head.addEventListener('click', async () => {
        this.audio.unlock();
        if (body.childElementCount) { this.start(c.n); return; }
        let L;
        try { L = await loadLevel(c.n); } catch (e) { body.textContent = 'NOT BUILT YET'; return; }
        const mk = (label, opts) => { const b = document.createElement('button'); b.className = 'tog'; b.textContent = label; b.addEventListener('click', () => { this.audio.unlock(); this.start(c.n, opts); }); body.appendChild(b); };
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
