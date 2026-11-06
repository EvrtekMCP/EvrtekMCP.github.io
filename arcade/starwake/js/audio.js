// STARWAKE 0.2.0: sound. Every sound is a whole ElevenLabs take (see CREDITS.md); nothing is synthesised here.
// Graph: music -> fade -> duck -> musicGain \
//        sfx   -> gain -> (pan) -> sfxGain  -> master -> limiter -> out
// The limiter is a fast, hard-kneed compressor a few dB under full scale, so a stack of effects over the
// track can never clip (MCP 2026-11-05: "a proper master bus").
// 0.2.0: one track per level (and per boss), named by path stem under audio/ (e.g. 'music' for level 1,
// 'levels/level2/music', 'bosses/warden'), each with its .json of loop points and beat grid beside it. Only
// the playing level's tracks stay decoded (a decoded take is ~55 MB). A boss track cuts in on a bar line.
import { V, store } from './util.js?v=0.3.0';

const SFX_GAIN = { ring: 0.55, combo: 0.6, roll: 0.55, deflect: 0.7, hit: 0.8, fire: 0.35, boom: 0.75, over: 0.8 };
const MUSIC_LEVEL = 0.62;

export class Audio {
  constructor() {
    this.ctx = null; this.buffers = {}; this.tracks = {}; this.music = null;
    const s = store('starwake.audio') || {};
    this.musicOn = s.music !== false; this.sfxOn = s.sfx !== false;
    this.ext = this._pickExt();
    this.lastPlay = {}; this.gain = Object.assign({}, SFX_GAIN);
    this.levelTrack = 'music'; this._ready = null;
    this.pinned = new Set(); // tracks never freed on a level change (the menu track)
  }
  _pickExt() {
    if (new URLSearchParams(location.search).has('aac')) return 'mp4'; // test the Safari path in any browser
    const a = document.createElement('audio');
    // Ogg Vorbis where it plays, AAC (in an .mp4, which every host serves) for Safari, which has no Vorbis
    if (a.canPlayType && a.canPlayType('audio/ogg; codecs="vorbis"')) return 'ogg';
    return 'mp4';
  }
  // The context is made at boot (it starts suspended, which every browser allows) so the sounds can be fetched
  // and decoded behind the loading screen; the first press on the launcher (unlock) lets it play.
  _context() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC({ latencyHint: 'interactive' });
    const c = this.ctx;
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -3; this.limiter.knee.value = 0; this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002; this.limiter.release.value = 0.12;
    this.master = c.createGain(); this.master.gain.value = 0.9;
    this.musicGain = c.createGain(); this.sfxGain = c.createGain();
    this.musicGain.gain.value = this.musicOn ? MUSIC_LEVEL : 0;
    this.sfxGain.gain.value = this.sfxOn ? 1 : 0;
    this.duck = c.createGain(); this.duck.gain.value = 1;
    this.duck.connect(this.musicGain);
    this.musicGain.connect(this.master); this.sfxGain.connect(this.master);
    this.master.connect(this.limiter); this.limiter.connect(c.destination);
    return c;
  }
  // Must be called from inside a user gesture (the launcher's first press): browsers keep audio locked until then.
  unlock() {
    const c = this._context(); if (!c) return;
    if (c.state === 'suspended') c.resume();
    if (this._unlocked) return;
    this._unlocked = true;
    // iOS: a silent one-sample buffer played inside the gesture fully opens the output
    try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) { /* ignore */ }
  }
  async _get(path) {
    const c = this._context();
    const r = await fetch('audio/' + path + '.' + this.ext + V);
    if (!r.ok) throw new Error(path + ' ' + r.status);
    const ab = await r.arrayBuffer();
    return await new Promise((ok, no) => c.decodeAudioData(ab, ok, no));
  }
  // boot: the eight effects and level 1's track, with progress for the loading bar
  preload(progress, extra = []) {
    if (this._ready) return this._ready;
    if (!this._context()) { this._ready = Promise.resolve(); return this._ready; }
    const names = Object.keys(SFX_GAIN), tracks = ['music'].concat(extra);
    let done = 0; const tick = () => { done++; if (progress) progress(done / (names.length + tracks.length)); };
    this._ready = Promise.all([
      ...names.map(async (n) => { try { this.buffers[n] = await this._get(n); } catch (e) { console.warn('sfx', n, e.message); } tick(); }),
      ...tracks.map((t) => this.loadTrack(t).then(tick, tick)),
    ]);
    return this._ready;
  }
  ready(ms = 1500) { return Promise.race([this._ready || Promise.resolve(), new Promise((r) => setTimeout(r, ms))]); }
  get decoded() { const o = Object.keys(this.buffers); for (const k of Object.keys(this.tracks)) if (this.tracks[k] && this.tracks[k].buf) o.push('track:' + k); return o; }
  async loadTrack(name) {
    const have = this.tracks[name];
    if (have) return have.then ? await have : have;
    const p = (async () => {
      let meta = null;
      try { meta = await (await fetch('audio/' + name + '.json' + V)).json(); } catch (e) { meta = null; }
      const buf = await this._get(name);
      return { name, buf, meta };
    })();
    this.tracks[name] = p;
    try { this.tracks[name] = await p; } catch (e) { delete this.tracks[name]; console.warn('music', name, e.message); return null; }
    return this.tracks[name];
  }
  // A level's music (and its boss's, and any section tracks), plus any effects it adds (audio/sfx/<id>).
  // Other levels' tracks are freed.
  async useLevel(L, progress) {
    if (!this._context()) return;
    this.levelTrack = (L.music && L.music.track) || 'music';
    const stem = (m) => (m && typeof m === 'object' ? m.track : m);
    const keep = [this.levelTrack, stem(L.bossMusic)].concat((L.sections || []).map((s) => stem(s.music)), (L.events || []).filter((e) => e.type === 'music').map((e) => e.track)).filter(Boolean);
    for (const k of Object.keys(this.tracks)) if (!keep.includes(k) && !this.pinned.has(k) && (!this.music || this.music.name !== k)) delete this.tracks[k];
    let n = 0;
    const jobs = keep.map((t) => this.loadTrack(t).then(() => { n++; if (progress) progress(n / keep.length); }));
    for (const s of L.sfx || []) { this.gain[s.id] = s.gain ?? 0.6; if (!this.buffers[s.id]) jobs.push(this._get('sfx/' + s.id).then((b) => { this.buffers[s.id] = b; }, (e) => console.warn('sfx', s.id, e.message))); }
    await Promise.all(jobs);
  }
  play(name, opts = {}) {
    if (!this.ctx || !this.sfxOn) return;
    const b = this.buffers[name]; if (!b) return;
    const now = this.ctx.currentTime;
    // the same effect stacked inside 40 ms only adds level, not information
    if (this.lastPlay[name] && now - this.lastPlay[name] < (opts.gap ?? 0.04)) return;
    this.lastPlay[name] = now;
    const s = this.ctx.createBufferSource(); s.buffer = b;
    s.playbackRate.value = opts.rate || 1;
    const g = this.ctx.createGain(); g.gain.value = (this.gain[name] || 0.6) * (opts.vol ?? 1);
    let node = g;
    if (opts.pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, opts.pan)); g.connect(p); node = p; }
    s.connect(g); node.connect(this.sfxGain);
    s.start(now);
  }
  // o.from: seconds into the file to start at; o.loop: [startSec, endSec] to override the json's loop, or false
  // to play to the end once (level 10's collapse, escape and sunrise)
  _source(t, when, o = {}) {
    const c = this.ctx, b = t.buf, s = c.createBufferSource(); s.buffer = b; s.loop = o.loop !== false;
    // Loop on bar lines (memory: eleven-makes-the-sounds). An AAC decode can carry a few ms of encoder
    // priming ahead of the music; whatever the decoded length gains over the master is shifted out of the points.
    let ls = 0, le = b.duration, pad = 0;
    if (t.meta) {
      pad = Math.max(0, Math.min(0.1, b.duration - t.meta.duration));
      ls = t.meta.loopStart + pad; le = Math.min(b.duration, t.meta.loopEnd + pad);
    }
    if (Array.isArray(o.loop)) { ls = o.loop[0] + pad; le = Math.min(b.duration, o.loop[1] + pad); }
    s.loopStart = ls; s.loopEnd = le;
    const fade = c.createGain(); fade.gain.value = 1;
    const from = Math.max(0, Math.min(b.duration - 0.01, (o.from || 0) + (o.from ? pad : 0)));
    s.connect(fade); fade.connect(this.duck); s.start(when, from);
    // t0 is when the file's 0 would have played, so position() stays in file seconds after a jump
    return { name: t.name, src: s, fade, t0: when - from, ls, le, pad, meta: t.meta, once: o.loop === false };
  }
  // name: a track stem, or { track, from, loop } (a boss jump-in starts on the boss's own spec)
  startMusic(name) {
    let o = {};
    if (name && typeof name === 'object') { o = name; name = name.track; }
    name = name || this.levelTrack;
    this.wantMusic = name;
    if (!this.ctx || this.music) return;
    const t = this.tracks[name];
    if (!t || t.then) { this.loadTrack(name).then(() => { if (this.wantMusic === name && !this.music) this.startMusic(Object.assign({}, o, { track: name })); }); return; }
    this.music = this._source(t, this.ctx.currentTime + 0.05, o);
  }
  // seconds from now to the playing track's next bar line (0 if it has no beat grid)
  toNextBar() {
    const m = this.music; if (!m || !m.meta || !this.ctx) return 0;
    const bar = m.meta.barSec || (240 / (m.meta.bpm || 140)), first = (m.meta.firstBeat || 0) + m.pad;
    let pos = this.ctx.currentTime - m.t0;
    if (pos > m.le && !m.once) pos = m.ls + ((pos - m.ls) % (m.le - m.ls));
    const into = ((pos - first) % bar + bar) % bar;
    return bar - into;
  }
  // the playing track's position in seconds into the file (for beat-locked hazards, level 3), or -1
  position() {
    const m = this.music; if (!m || !this.ctx) return -1;
    let pos = this.ctx.currentTime - m.t0;
    if (pos > m.le && !m.once) pos = m.ls + ((pos - m.ls) % (m.le - m.ls));
    return pos - m.pad;
  }
  get beat() { const m = this.music; return m && m.meta ? m.meta : null; }
  // Cut to another track on the next bar line of what is playing, with a short crossfade (boss entrances, level
  // 10's acts). name: a stem or { track, from, loop }. opts.from: seconds into the file to start at; opts.loop:
  // [start, end] or false. With `from`, switching to the SAME track jumps within the take.
  async switchTrack(name, opts = {}) {
    if (name && typeof name === 'object') { opts = Object.assign({}, name, opts); name = name.track; }
    if (!this.ctx || !name || (this.music && this.music.name === name && opts.from === undefined)) return;
    const ticket = (this._ticket = (this._ticket || 0) + 1);
    this.wantMusic = name;
    const t = await this.loadTrack(name);
    if (!t || this._ticket !== ticket) return;
    const when = this.ctx.currentTime + Math.max(0.05, this.toNextBar());
    const old = this.music;
    if (old) { old.fade.gain.setValueAtTime(1, when); old.fade.gain.linearRampToValueAtTime(0, when + 0.25); old.src.stop(when + 0.3); }
    this.music = this._source(t, when, opts);
  }
  // read-only view for kinds and bosses (api.music): lock patterns to the bar grid
  get view() {
    const a = this;
    return this._view || (this._view = { position: () => a.position(), toNextBar: () => a.toNextBar(), get meta() { return a.music ? a.music.meta : null; }, get track() { return a.music ? a.music.name : null; } });
  }
  // fade whatever plays out over secs while `name` starts underneath it (the menu track into a level's, and back)
  async crossTo(name, secs = 1, opts = {}) {
    if (!this.ctx || !name) return;
    // a newer change cancels any still loading (the menu track must not land after a run has started)
    const ticket = (this._ticket = (this._ticket || 0) + 1);
    if (this.music && this.music.name === name && opts.from === undefined) return;
    this.wantMusic = name;
    const t = await this.loadTrack(name);
    if (!t || this._ticket !== ticket) return;
    const now = this.ctx.currentTime, old = this.music;
    if (old) { old.fade.gain.cancelScheduledValues(now); old.fade.gain.setValueAtTime(old.fade.gain.value, now); old.fade.gain.linearRampToValueAtTime(0, now + secs); old.src.stop(now + secs + 0.05); }
    this.music = this._source(t, now + 0.02, opts);
    this.music.fade.gain.setValueAtTime(0, now); this.music.fade.gain.linearRampToValueAtTime(1, now + Math.min(0.6, secs));
  }
  stopMusic(fade = 0.6) {
    this.wantMusic = null;
    if (!this.music) return;
    const m = this.music, now = this.ctx.currentTime;
    m.fade.gain.cancelScheduledValues(now);
    m.fade.gain.setValueAtTime(m.fade.gain.value, now);
    m.fade.gain.linearRampToValueAtTime(0, now + fade);
    m.src.stop(now + fade + 0.05);
    this.music = null;
    this.musicLevel(1, 0.05);
  }
  // the music lifts a touch in GREED; 1 is normal
  musicLevel(mult, time = 0.15) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.duck.gain.cancelScheduledValues(now);
    this.duck.gain.setTargetAtTime(mult, now, time);
  }
  toggle(which) {
    if (which === 'music') this.musicOn = !this.musicOn; else this.sfxOn = !this.sfxOn;
    if (this.ctx) {
      this.musicGain.gain.value = this.musicOn ? MUSIC_LEVEL : 0;
      this.sfxGain.gain.value = this.sfxOn ? 1 : 0;
    }
    store('starwake.audio', { music: this.musicOn, sfx: this.sfxOn });
    return which === 'music' ? this.musicOn : this.sfxOn;
  }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended' && this._unlocked) this.ctx.resume(); }
}
