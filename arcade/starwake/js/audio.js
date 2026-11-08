// STARWAKE 0.3.1: sound. Every sound is a whole ElevenLabs take (see CREDITS.md); nothing is synthesised here.
// Graph: music -> fade -> duck -> slipLP -> slipVol -> musicGain    (0.4.0: Slipstream's muffled dip, slip())
//        sfx   -> gain -> (pan) -> sfxGain  -> master -> limiter -> out
// The limiter is a fast, hard-kneed compressor a few dB under full scale, so a stack of effects over the
// track can never clip (MCP 2026-11-05: "a proper master bus").
// 0.2.0: one track per level (and per boss), named by path stem under audio/ (e.g. 'music' for level 1,
// 'levels/level2/music', 'bosses/warden'), each with its .json of loop points and beat grid beside it. Only
// the playing level's tracks stay decoded (a decoded take is ~55 MB). A boss track cuts in on a bar line.
import { V, store } from './util.js?v=0.4.0';
import { param } from './params.js?v=0.4.0';

// 0.3.1: bytes of a track at which its first stretches are decoded, before the whole (about 15 s, then a minute)
const STEPS = [512 * 1024, 2 * 1024 * 1024];
// a source that never started (a jump past what had arrived) cannot be stopped
const stopSrc = (s, at) => { if (s && s._on) { try { s.stop(at); } catch (e) { /* already stopped */ } } };

// 0.4.0: 'streak', the multiplier step's own sound (main.js setChain: x2 at five rings in a row, then x3 ... x8). Evrtek, 11-07:
// the old combo there is "harsh on the ears"; he asked for five reward-type sounds to choose from. Each candidate is one whole
// ElevenLabs take, with the gain that puts it at -13.8 LUFS max momentary in the mix, 1 dB under the reward cues (it repeats).
// ?mult=1 ... 15|old (or #mult-N, params.js) picks one; with none, mult-10 (Evrtek's pick). 'old' is the combo sweep at 0.6
// (AUDIO-MANIFEST: the multiplier step). 6-10 are round 2 (Evrtek: "more slot machine or something more techno"); 11-15 are
// round 3, the original made gentler (mult-15 is processed from the original file itself, not a new take: his ruling to make).
// The ?streak= switch and its three takes are retired: he turned streak-1 down.
const MULTS = { 1: ['sfx/mult-1', 0.72], 2: ['sfx/mult-2', 0.43], 3: ['sfx/mult-3', 0.58], 4: ['sfx/mult-4', 0.82], 5: ['sfx/mult-5', 0.91],
  6: ['sfx/mult-6', 0.97], 7: ['sfx/mult-7', 0.85], 8: ['sfx/mult-8', 1], 9: ['sfx/mult-9', 1], 10: ['sfx/mult-10', 0.72],
  11: ['sfx/mult-11', 0.66], 12: ['sfx/mult-12', 0.37], 13: ['sfx/mult-13', 0.52], 14: ['sfx/mult-14', 0.51], 15: ['sfx/mult-15', 0.78], old: ['combo', 0.6] };
const MULT_Q = param('mult');
const STREAK = /^([1-9]|1[0-5]|old)$/.test(MULT_Q || '') ? MULTS[MULT_Q] : MULTS[15]; // default: mult-15, the original combo trimmed before its shimmer and rolled off above 1.5 kHz (Evrtek's pick 11-07; picking it rules the processed take in)
// ?multrise (or #multrise), off by default: each step plays a semitone higher than the last (x2 as made, x8 six up), never
// on 'old'. Measured: candidate 1 stays out of the harsh band all the way (2.9% in 2-5 kHz at x8); candidate 2 does not (40%).
const MULT_RISE = param('multrise') !== null && STREAK !== MULTS.old;
export const multRate = (mult) => (MULT_RISE ? Math.pow(2, Math.min(6, Math.max(0, mult - 2)) / 12) : 1);
// 0.4.0: 'reward', the sound of GREED firing (main.js greedGo), a boost-ring chain completing (pickups/boost-ring), the
// Counterfeit's ring chain completing (bosses/g3-counterfeit/rings.js) and level 7's blast-out (levels/level7/scenery.js).
// Evrtek, 11-07: the tone "sent all the way up the hertz scale" is the combo sweep itself, which all four used to play. Its
// candidates are each one whole ElevenLabs take, with the gain that puts it 3 dB under the old combo in the mix
// (AUDIO-MANIFEST: the reward cue). ?reward=1|2|3|old (or #reward-N) picks one; with none, candidate 1. 'old' is the
// combo sweep at 0.6. Rates (sfx-reward-2, measured): GREED 0.8 and level 7's blast-out 0.7 keep theirs; the two chain
// completions (boost rings, the Counterfeit's) play it at 1, since 1.3 put the default 87% into 2-5 kHz, the piercing band.
// A reward and the multiplier's step in the same moment never stack (play()).
const REWARDS = { 1: ['sfx/reward-1', 0.56], 2: ['sfx/reward-2', 0.76], 3: ['sfx/reward-3', 1], old: ['combo', 0.6] };
const REWARD_Q = param('reward');
const REWARD = /^([123]|old)$/.test(REWARD_Q || '') ? REWARDS[REWARD_Q] : REWARDS[1];
const PICKED = { streak: STREAK[0], reward: REWARD[0] }; // the boot effects whose file is a pick, not their own name
const SFX_GAIN = { ring: 0.55, combo: 0.6, roll: 0.55, deflect: 0.7, hit: 0.8, fire: 0.35, boom: 0.75, over: 0.8, streak: STREAK[1], reward: REWARD[1] };
const MUSIC_LEVEL = 0.62;
// 0.4.0, SLIPSTREAM's music (the MCP's default 5): a muffled low-pass on the whole take plus a small duck, from the nearest
// beat to a bar line. The track itself never slows. SLIP_FILTER false is the fallback Evrtek may rule: a plain duck only.
export const SLIP_FILTER = true;
const SLIP = { hz: 650, vol: 0.8, sfxRate: 0.88 };
// 0.4.0: a galaxy 2 or 3 TRACK that is not in yet (levels.js GALAXIES has.music: true when all are, else the list of
// those that are; passed in as audio.hasTrack) plays a galaxy 1 take in its place, and so does a galaxy EFFECT (g2-*, g3-*,
// pu-*) the sound branch has not delivered (audio/sfx/manifest.json): the preview never plays silent and nothing missing
// is ever asked for. A stand-in track's bar grid is its own.
const G1_BOSS = ['bosses/warden', 'bosses/leviathan', 'bosses/twins'], G1_ACTS = ['levels/level10/approach', 'levels/level10/dive', 'levels/level10/core'];
const FINALE_ACT = { canopy: 0, warp: 0, taproot: 1, shed: 1, rootmind: 2, weftwork: 2 };
const hashOf = (t) => { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
// an effect's stand-in, by what its name says it is (a shot, a burst, a hit, a chime ...), else one of galaxy 1's own.
// SFX_FILE: where each stand-in lives (the eight boot effects are always loaded; the audio/sfx ones load with the level).
const SFX_FILE = { fire: 'fire', boom: 'boom', hit: 'hit', deflect: 'deflect', combo: 'combo', ring: 'ring', roll: 'roll', over: 'over',
  'crystal-chime': 'sfx/crystal-chime', 'boss-warning': 'sfx/boss-warning', 'boss-hit': 'sfx/boss-hit', 'boss-phase': 'sfx/boss-phase', 'boss-defeat': 'sfx/boss-defeat',
  'boost-whoosh': 'sfx/boost-whoosh', 'level-unlock': 'sfx/level-unlock', 'menu-select': 'sfx/menu-select', 'ice-crack': 'sfx/ice-crack', 'boss-defeat': 'sfx/boss-defeat' };
const SFX_RULES = [[/boss-freed|boss-defeat/, 'boss-defeat'], [/graft|crack/, 'ice-crack'], [/freed|tick|beep|ping|clink|chime|pip|song|sing|call|whale|moth/, 'crystal-chime'], [/cache|unlock|open|jackpot|vault|cell|shield/, 'level-unlock'], [/slip|whoosh|phase|dash|surge|rush/, 'boost-whoosh'],
  [/fire|shot|bolt|spit|seed|volley|rivet|shoot/, 'fire'], [/boom|burst|pop|die|death|crack|break|split|shatter/, 'boom'], [/hit|bite|snap|lash|whip/, 'hit'],
  [/parry|deflect|intercept|mirror/, 'deflect'], [/warn|alarm|tell|charge|inhale|roar|thrum|drum|pulse/, 'boss-warning'], [/overclock|magnet|combo/, 'combo'],
  // 0.4.0 (g3-b): a pen at work (a plotter's nib touching down, a blueprint drawing in) is a short tick, never the roll's own deflect
  [/plot|draw|print|sketch|nib/, 'menu-select']];
// the fallback never borrows deflect: the roll's own sound is a gameplay signal (the MCP, 11-07), only a real parry plays it
export function standInSfx(name) { for (const [re, to] of SFX_RULES) if (re.test(name)) return to; return ['fire', 'boom', 'combo'][hashOf(name) % 3]; }
// A galaxy track's name, as filed: g2/level4/music, g2/bosses/snare, g2/level10/canopy (LEVEL-API 12; the sound branch
// files them there). g2/levels/level4/music, galaxy 1's own pattern, means the same file.
export const canonTrack = (name) => (typeof name === 'string' ? name.replace(/^(g[23])\/levels\/level(\d+)\//, '$1/level$2/') : name);
export function standIn(name) {
  const m = /^g([23])\/(.+)$/.exec(canonTrack(name) || ''); if (!m) return name;
  const rest = m[2];
  if (/^bosses\//.test(rest)) return G1_BOSS[hashOf(rest) % 3];
  const lv = /^level(\d+)\/(.+)$/.exec(rest); if (!lv) return 'music';
  const n = +lv[1];
  // a finale's acts stand in by their place (g2-d: the acts copy galaxy 1's bar maps bar for bar): the first act on the
  // Heart's approach, the second on its dive, the third on its core
  if (FINALE_ACT[lv[2]] !== undefined) return G1_ACTS[FINALE_ACT[lv[2]]];
  if (n >= 10 || lv[2] !== 'music') return G1_ACTS[hashOf(rest) % 3];
  return n === 1 ? 'music' : 'levels/level' + n + '/music';
}

export class Audio {
  constructor() {
    this.ctx = null; this.buffers = {}; this.tracks = {}; this.music = null;
    const s = store('starwake.audio') || {};
    this.musicOn = s.music !== false; this.sfxOn = s.sfx !== false;
    this.ext = this._pickExt();
    this.lastPlay = {}; this.gain = Object.assign({}, SFX_GAIN);
    this.levelTrack = 'music'; this._ready = null;
    this.pinned = new Set(); // tracks never freed on a level change (the menu track)
    this.hasTrack = () => true; // 0.4.0: main.js says which galaxy tracks are in (the rest play stand-ins)
    this.alias = {}; // 0.4.0: an effect not delivered yet -> the galaxy 1 effect that stands in for it
    this.sfxKnown = new Set(); // 0.4.0: the galaxy effects the sound branch has delivered (audio/sfx/manifest.json)
    this._streams = new Set(); // tracks downloading now (one at a time reads: _stream)
    this.trace = []; // when each stretch of each track came in (for the load-time test)
    // the boot's order (main.js): the browser gives pictures less of a slow line than our streams, so while held the
    // streams wait for them. 2: only a pinned track's first stretch (the menu's: the prompt waits for it and the
    // launcher's pictures); 1: also the first stretch of the level being started, and the music playing (the call-out
    // sprites are coming); 0: everything.
    this.held = 0;
    // 0.4.0 (Tron, field fixes 11-07): the MUSIC CLOCK. iOS Safari stops an AudioContext ('suspended', 'interrupted')
    // when the phone locks, the page hides, or a call or other audio comes in, and does not start it again by itself;
    // its currentTime then stands still, and everything timed on the track (the Warden's beats, the High Roller's,
    // level 3's gates) waits for a beat that never comes. So the music's position runs on ctx.currentTime + _lag:
    // while the context is not running (or its clock has stalled) the game's own frames carry the clock on (tick),
    // and once it runs again the track is put back where the clock says (_resync). wake() starts it again.
    this._lag = 0; this._stallT = 0; this._lastCt = -1; this._held = false; this._dead = false; this._renewAt = 0;
    this.stats = { resync: 0, restart: 0, renew: 0, stall: 0 }; // (what the clock did: tools/test/audio-resume.js reads it)
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
    this.slipLP = c.createBiquadFilter(); this.slipLP.type = 'lowpass'; this.slipLP.frequency.value = 20000; this.slipLP.Q.value = 0.7;
    this.slipVol = c.createGain(); this.slipVol.gain.value = 1;
    this.duck.connect(this.slipLP); this.slipLP.connect(this.slipVol); this.slipVol.connect(this.musicGain);
    this.musicGain.connect(this.master); this.sfxGain.connect(this.master);
    this.master.connect(this.limiter); this.limiter.connect(c.destination);
    return c;
  }
  // Must be called from inside a user gesture (the launcher's first press): browsers keep audio locked until then.
  unlock() {
    const c = this._context(); if (!c) return;
    if (c.state !== 'running') { this._held = false; if (this._unlocked) this.wake(true); else c.resume(); } // (11-07: 'interrupted' too)
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
  // boot: the eight effects and the menu track, with progress for the loading bar. (0.3.1: no longer 'music' too:
  // that is Nebula Run's track, level 2 since the swap, and level 1's own comes with level 1.)
  preload(progress, extra = []) {
    if (this._ready) return this._ready;
    if (!this._context()) { this._ready = Promise.resolve(); return this._ready; }
    const names = Object.keys(SFX_GAIN), tracks = extra.slice();
    this._sfxExtra = this._sfxManifest().catch(() => {});
    let done = 0; const tick = () => { done++; if (progress) progress(done / (names.length + tracks.length)); };
    this._ready = Promise.all([
      ...names.map(async (n) => { try { this.buffers[n] = await this._get(PICKED[n] || n); } catch (e) { console.warn('sfx', n, e.message); } tick(); }),
      ...tracks.map((t) => this.loadTrack(t).then(tick, tick)),
    ]);
    return this._ready;
  }
  // 0.4.0: the shared effects the sound branch has delivered (the power-ups' cues), listed in audio/sfx/manifest.json so
  // nothing missing is ever asked for. Loaded beside the boot effects; a missing list or file is skipped quietly.
  async _sfxManifest() {
    let list = ['crystal-chime', 'level-unlock', 'boost-whoosh', 'ice-crack', 'boss-defeat'].map((n) => 'sfx-standin:' + n);
    try { const j = await (await fetch('audio/sfx/manifest.json' + V)).json(); list = list.concat(j.powerups || [], j.shared || []); this.gainExtra = j.gain || {}; for (const n of j.galaxies || []) this.sfxKnown.add(n); } catch (e) { return; }
    await Promise.all(list.map(async (n) => { if (n.startsWith('sfx-standin:')) { n = n.slice(12); try { this.buffers[n] = await this._get('sfx/' + n); } catch (e) { /* none */ } return; } try { this.buffers[n] = await this._get('sfx/' + n); if (!this.gain[n]) this.gain[n] = (this.gainExtra && this.gainExtra[n]) || 0.6; } catch (e) { console.warn('sfx', n, e.message); } }));
  }
  ready(ms = 1500) { return Promise.race([this._ready || Promise.resolve(), new Promise((r) => setTimeout(r, ms))]); }
  get decoded() { const o = Object.keys(this.buffers); for (const k of Object.keys(this.tracks)) if (this.tracks[k] && this.tracks[k].buf) o.push('track:' + k); return o; }
  // the file a track name plays: itself, or (0.4.0) its stand-in while its galaxy's music is not in yet
  fileOf(name) { const c = canonTrack(name); return /^g[23]\//.test(c || '') && !this.hasTrack(c) ? standIn(c) : c; }
  // the effect a name plays: its own once delivered, else (0.4.0) a galaxy 1 stand-in
  sfxOf(name) { return this.buffers[name] ? name : this.alias[name] || (/^(g[23]-|pu-)/.test(name) ? (this.alias[name] = standInSfx(name)) : name); }

  // ---- a track plays as soon as its first stretch has arrived (0.3.1, Evrtek 11-06: load times; the live folder is
  // 174 MB, two thirds of it music, and a level used to wait for every one of its tracks, whole, before it flew).
  // A track is fetched as a stream. Its first STEPS[0] bytes (about 15 s of music) are decoded and can start; a longer
  // stretch, then the whole file, replace it under the playing music. Every decode of a file's start gives the same
  // samples (checked: not one sample differs), so the hand-over is exact: the new buffer starts at the very sample the
  // old one has reached, the bar grid (t0) does not move, and the loop points apply once the whole file is in. A
  // decoder that cannot take part of a file (it throws) simply waits for the whole of it.
  // 0.4.0: a track is still known by its NAME (what levels, priorities and the playing music say), and streams its FILE
  // (fileOf: its own, or a galaxy 1 stand-in until the sound branch delivers it; the bar grid is the file's own json).
  async loadTrack(name) {
    const have = this.tracks[name];
    if (have && !have.then && have.failed && (!this.music || this.music.track !== have)) delete this.tracks[name];
    else if (have) return have.then ? await have : have;
    this._context();
    const file = this.fileOf(name);
    const t = { name, file, buf: null, meta: null, partial: true };
    let firstOk, firstNo; const first = new Promise((ok, no) => { firstOk = ok; firstNo = no; });
    t.fail = (e) => firstNo(e); // (a track freed before its first stretch: whoever waits for it gets null)
    t.done = (async () => {
      try { t.meta = await (await fetch('audio/' + file + '.json' + V)).json(); } catch (e) { t.meta = null; }
      // (11-07) a stream that dies after its first stretch (iOS drops a fetch while the page is hidden: "Load failed")
      // used to leave the track partial for good: a partial buffer does not loop, so the music ran out and stayed
      // silent. It is fetched again while the track is still wanted; a shorter stretch than the one held is skipped.
      for (let k = 0; ; k++) {
        try { await this._stream(name, t, (b, partial) => { if (partial && t.buf && b.duration <= t.buf.duration) return; this._setBuf(t, b, partial); firstOk(t); }, file); break; } catch (e) {
          const wanted = this.tracks[name] === t || this.tracks[name] === t.p;
          if (!t.buf || !t.partial || !wanted || k >= 5) { t.failed = true; throw e; } // (failed: the next ask fetches it anew)
          console.warn('music', name, 'stream lost (' + e.message + '), fetching it again');
          await new Promise((ok) => setTimeout(ok, 800 * (k + 1)));
        }
      }
    })().catch((e) => { firstNo(e); throw e; });
    t.done.catch(() => {});
    const p = first;
    this.tracks[name] = p; t.p = p;
    try { await p; } catch (e) { if (this.tracks[name] === p) delete this.tracks[name]; if (e.message !== 'freed') console.warn('music', name, e.message); return null; }
    if (this.tracks[name] === p) this.tracks[name] = t;
    return t;
  }
  async _stream(name, t, got, file = name) {
    const url = 'audio/' + file + '.' + this.ext + V; // 0.4.0: a stand-in streams its galaxy 1 file under its own name
    // (11-07) decoded by whichever context is live then: a stream outlives a context renewed under it (wake)
    const decode = (ab) => new Promise((ok, no) => this._context().decodeAudioData(ab, ok, no));
    if (typeof ReadableStream === 'undefined' || !window.AbortController) { const r = await fetch(url); if (!r.ok) throw new Error(name + ' ' + r.status); got(await decode(await r.arrayBuffer()), false); return; }
    // ONE stream at a time takes the line: any still short of its first stretch, then the music playing (or about to),
    // then the level's own, then the rest in the order asked. A stream that loses the line lets its request go (a merely
    // unread one keeps downloading into the browser's buffer, measured: about 2.5 MB, which starved the playing track's
    // next stretch) and later asks for the whole file again, skipping what it already has. Not a byte range of its own:
    // the browser keeps the part of an aborted download and fetches only the rest with a range of ITS own (checked in
    // Chrome: 4.83 of a 5.83 MB file after 1 MB had come), and the file ends up whole in its cache; our own range left
    // the cache holding pieces it would not join, and a warm launch fetched the track again (tools/test/loadtime.js).
    const me = { name, seq: this._seq = (this._seq || 0) + 1, first: false };
    this._streams.add(me);
    const pri = (x) => (x.first ? 10 : 0) + (x.name === this.wantMusic || (this.music && this.music.name === x.name) || (!x.first && this.pinned.has(x.name)) ? 0 : x.name === this.levelTrack ? 1 : 2);
    const top = () => {
      if (this.held) {
        const playing = name === this.wantMusic || (this.music && this.music.name === name);
        const ok = this.held >= 2 ? this.pinned.has(name) && !me.first : (!me.first && (this.pinned.has(name) || name === this.levelTrack || name === this.openTrack)) || playing;
        if (!ok) return false;
      }
      let best = null; for (const x of this._streams) if (!best || pri(x) < pri(best) || (pri(x) === pri(best) && x.seq < best.seq)) best = x; return best === me; };
    // a track a level change has freed (useLevel) streams no further: its line goes to the tracks still wanted
    const mine = () => this.tracks[name] === t || this.tracks[name] === t.p;
    const chunks = [];
    let size = 0, step = 0, prefixOk = true, reader = null, ctrl = null, skip = 0;
    const joined = () => { const u = new Uint8Array(size); let o = 0; for (const ch of chunks) { u.set(ch, o); o += ch.length; } return u.buffer; };
    const open = async () => {
      ctrl = new AbortController();
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error(name + ' ' + r.status);
      reader = r.body.getReader(); skip = size; // the file from its start again: what we hold already is skipped
    };
    const freed = () => { if (reader) ctrl.abort(); this._streams.delete(me); if (!me.first && t.fail) t.fail(new Error('freed')); };
    for (;;) {
      if (!mine()) { freed(); return; }
      if (!top()) { if (reader) { ctrl.abort(); reader = null; } while (!top() && mine()) await new Promise((ok) => setTimeout(ok, 60)); if (!mine()) { freed(); return; } }
      if (!reader) { try { await open(); } catch (e) { this._streams.delete(me); throw e; } }
      const { done, value } = await reader.read().catch((e) => { this._streams.delete(me); throw e; });
      if (done) break;
      let v = value;
      if (skip) { if (v.length <= skip) { skip -= v.length; continue; } v = v.subarray(skip); skip = 0; }
      chunks.push(v); size += v.length;
      if (prefixOk && step < STEPS.length && size >= STEPS[step]) {
        step++;
        try { const b = await decode(joined()); this.trace.push({ name, file, at: Math.round(performance.now()), bytes: size, dur: +b.duration.toFixed(1) }); got(b, true); me.first = true; } catch (e) { prefixOk = false; } // it cannot decode part of a file: wait
      }
    }
    this._streams.delete(me);
    const whole = await decode(joined()); this.trace.push({ name, file, at: Math.round(performance.now()), bytes: size, dur: +whole.duration.toFixed(1), whole: true });
    got(whole, false);
  }
  // a longer stretch (or the whole) of a track is in: if it is the one playing, it takes over at the next sample
  _setBuf(t, b, partial) {
    const old = t.buf; t.buf = b; t.partial = partial;
    const m = this.music;
    if (!old || !m || m.track !== t || !this.ctx) return;
    const c = this.ctx, at = c.currentTime + 0.06; // where in the buffer the music will be at `at` (as heard: lag0)
    let off = at + (m.lag0 || 0) - m.t0;
    if (off < 0) return; // it has not started yet: it will start on the new buffer's first samples anyway
    const s = c.createBufferSource(); s.buffer = b;
    const L = this._loopOf(t, b, m.opts); s.loop = L.loop; s.loopStart = L.ls; s.loopEnd = L.le;
    if (L.loop && off >= L.le && L.le > L.ls) off = L.ls + ((off - L.ls) % (L.le - L.ls)); // (11-07) a part that ran out long ago
    s.connect(m.fade);
    if (off < b.duration) { s.start(at, off); s._on = true; }
    stopSrc(m.src, at); m.src = s; m.ls = L.ls; m.le = L.le; m.pad = L.pad;
  }
  // where a buffer loops (bar lines, from the track's json), and any AAC priming a decoder added (the whole file only)
  _loopOf(t, b, o = {}) {
    let ls = 0, le = b.duration, pad = 0;
    if (t.meta && !t.partial) {
      pad = Math.max(0, Math.min(0.1, b.duration - t.meta.duration));
      ls = t.meta.loopStart + pad; le = Math.min(b.duration, t.meta.loopEnd + pad);
    }
    if (Array.isArray(o.loop) && !t.partial) { ls = o.loop[0] + pad; le = Math.min(b.duration, o.loop[1] + pad); }
    return { loop: o.loop !== false && !t.partial, ls, le, pad };
  }
  // A level's music, plus any effects it adds (audio/sfx/<id>). Other levels' tracks are freed. 0.3.1: only the
  // track it OPENS with is waited for (its first stretch); its boss's and its sections' tracks follow behind it, one
  // at a time, after the opening one is whole, so they never share the line with it (a boss arrives minutes in).
  async useLevel(L, progress, opening) {
    if (!this._context()) return;
    this.levelTrack = (L.music && L.music.track) || 'music';
    const stem = (m) => (m && typeof m === 'object' ? m.track : m);
    const open = stem(opening) || this.levelTrack;
    this.openTrack = open; // the track the run opens on (a dev jump: a section's or the boss's), let through a held boot
    const keep = [open, this.levelTrack, stem(L.bossMusic)].concat((L.sections || []).map((s) => stem(s.music)), (L.events || []).filter((e) => e.type === 'music').map((e) => e.track)).filter(Boolean);
    for (const k of Object.keys(this.tracks)) if (!keep.includes(k) && !this.pinned.has(k) && (!this.music || this.music.name !== k)) delete this.tracks[k];
    const jobs = [this.loadTrack(open).then(() => { if (progress) progress(1); })];
    for (const s of L.sfx || []) { this.gain[s.id] = s.gain ?? 0.6; if (/^g[23]-/.test(s.id) && !this.sfxKnown.has(s.id)) { const st = this.sfxOf(s.id); if (!this.buffers[st] && /^sfx\//.test(SFX_FILE[st] || '')) jobs.push(this._get(SFX_FILE[st]).then((b) => { this.buffers[st] = b; }, () => {})); continue; } if (!this.buffers[s.id]) jobs.push(this._get('sfx/' + s.id).then((b) => { this.buffers[s.id] = b; }, (e) => console.warn('sfx', s.id, e.message))); }
    await Promise.all(jobs);
    const rest = [...new Set(keep)].filter((k) => k !== open), lt = this.levelTrack;
    (async () => {
      const t = this.tracks[open]; if (t && t.done) await t.done.catch(() => {});
      for (const k of rest) { if (this.levelTrack !== lt) break; const x = await this.loadTrack(k); if (x && x.done) await x.done.catch(() => {}); }
    })();
  }
  play(name, opts = {}) {
    if (!this.ctx || !this.sfxOn) return;
    const play = this.sfxOf(name), b = this.buffers[play]; if (!b) return;
    const now = this.ctx.currentTime;
    // the same effect stacked inside 40 ms only adds level, not information
    if (this.lastPlay[name] && now - this.lastPlay[name] < (opts.gap ?? 0.04)) return;
    // 0.4.0 (Evrtek 11-07): a reward and the multiplier's step in one moment (a chain's last ring also steps the multiplier)
    // never stack. The reward plays and the step is swallowed, whichever asks first: a step just after a reward is skipped,
    // and one just before it fades out in 5 ms (the clock can move between the two asks, so no hard cut, no click).
    if (name === 'streak' && this.lastPlay.reward !== undefined && now - this.lastPlay.reward < 0.04) return;
    if (name === 'reward' && this._step && now - this._step.at < 0.04) {
      const { s: ss, g: sg } = this._step; this._step = null;
      try { sg.gain.cancelScheduledValues(now); sg.gain.setValueAtTime(sg.gain.value, now); sg.gain.linearRampToValueAtTime(0, now + 0.005); ss.stop(now + 0.006); } catch (e) { /* already done */ }
    }
    this.lastPlay[name] = now;
    const s = this.ctx.createBufferSource(); s.buffer = b;
    s.playbackRate.value = (opts.rate || 1) * (now < (this.slipUntil || 0) ? SLIP.sfxRate : 1); // effects drop a little in a slipstream
    const g = this.ctx.createGain(); g.gain.value = (this.gain[name] || this.gain[play] || 0.6) * (opts.vol ?? 1) * (play !== name ? 0.8 : 1);
    let node = g;
    if (opts.pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, opts.pan)); g.connect(p); node = p; }
    s.connect(g); node.connect(this.sfxGain);
    s.start(now);
    if (name === 'streak') this._step = { s, g, at: now };
  }
  // o.from: seconds into the file to start at; o.loop: [startSec, endSec] to override the json's loop, or false
  // to play to the end once (level 10's collapse, escape and sunrise)
  _source(t, when, o = {}) {
    // Loop on bar lines (memory: eleven-makes-the-sounds). An AAC decode can carry a few ms of encoder priming ahead
    // of the music; whatever the decoded length gains over the master is shifted out of the points (_loopOf).
    const c = this.ctx, b = t.buf, s = c.createBufferSource(); s.buffer = b;
    const L = this._loopOf(t, b, o); s.loop = L.loop; s.loopStart = L.ls; s.loopEnd = L.le;
    const fade = c.createGain(); fade.gain.value = 1;
    const want = Math.max(0, (o.from || 0) + (o.from ? L.pad : 0)), from = t.partial ? want : Math.min(b.duration - 0.01, want);
    s.connect(fade); fade.connect(this.duck);
    // (a jump past what has arrived starts silent and picks up when that stretch does: _setBuf)
    if (from < b.duration) { s.start(when, from); s._on = true; }
    // t0 is when the file's 0 would have played, so position() stays in file seconds after a jump
    // (11-07) t0 on the music clock (ctx time + _lag); lag0 is the lag it was made with (what is heard runs lag - lag0 behind)
    return { name: t.name, track: t, opts: o, src: s, fade, t0: when + this._lag - from, lag0: this._lag, ls: L.ls, le: L.le, pad: L.pad, meta: t.meta, once: o.loop === false };
  }
  // name: a track stem, or { track, from, loop } (a boss jump-in starts on the boss's own spec)
  startMusic(name) {
    let o = {};
    if (name && typeof name === 'object') { o = name; name = name.track; }
    name = name || this.levelTrack;
    this.wantMusic = name; this._ticket = (this._ticket || 0) + 1; // (0.3.1) a cross-fade still waiting is cancelled
    if (!this.ctx || this.music) return;
    const t = this.tracks[name];
    if (!t || t.then || t.failed) { this.loadTrack(name).then(() => { if (this.wantMusic === name && !this.music) this.startMusic(Object.assign({}, o, { track: name })); }); return; }
    this.music = this._source(t, this.ctx.currentTime + 0.05, o);
  }
  // seconds from now to the playing track's next bar line (0 if it has no beat grid)
  toNextBar() {
    const m = this.music; if (!m || !m.meta || !this.ctx) return 0;
    const bar = m.meta.barSec || (240 / (m.meta.bpm || 140)), first = (m.meta.firstBeat || 0) + m.pad;
    let pos = this._now() - m.t0;
    if (pos > m.le && !m.once && m.src.loop) pos = m.ls + ((pos - m.ls) % (m.le - m.ls)); // (a part still arriving plays straight on)
    const into = ((pos - first) % bar + bar) % bar;
    return bar - into;
  }
  // the playing track's position in seconds into the file (for beat-locked hazards, level 3), or -1
  position() {
    const m = this.music; if (!m || !this.ctx) return -1;
    let pos = this._now() - m.t0;
    if (pos > m.le && !m.once && m.src.loop) pos = m.ls + ((pos - m.ls) % (m.le - m.ls));
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
    if (old) { old.fade.gain.setValueAtTime(1, when); old.fade.gain.linearRampToValueAtTime(0, when + 0.25); stopSrc(old.src, when + 0.3); }
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
    if (old) { old.fade.gain.cancelScheduledValues(now); old.fade.gain.setValueAtTime(old.fade.gain.value, now); old.fade.gain.linearRampToValueAtTime(0, now + secs); stopSrc(old.src, now + secs + 0.05); }
    this.music = this._source(t, now + 0.02, opts);
    this.music.fade.gain.setValueAtTime(0, now); this.music.fade.gain.linearRampToValueAtTime(1, now + Math.min(0.6, secs));
  }
  stopMusic(fade = 0.6) {
    this.wantMusic = null; this._ticket = (this._ticket || 0) + 1; // (0.3.1) and any cross-fade still waiting
    if (!this.music) return;
    const m = this.music, now = this.ctx.currentTime;
    m.fade.gain.cancelScheduledValues(now);
    m.fade.gain.setValueAtTime(m.fade.gain.value, now);
    m.fade.gain.linearRampToValueAtTime(0, now + fade);
    stopSrc(m.src, now + fade + 0.05);
    this.music = null;
    this.musicLevel(1, 0.05);
  }
  // 0.4.0: SLIPSTREAM's dip. on: from the nearest beat (the one just gone, or the next if it is closer) to now + dur (main.js
  // ends a slipstream on a bar line); off: straight back (a new run).
  slip(on, dur = 0) {
    if (!this.ctx) return;
    const c = this.ctx, now = c.currentTime, f = this.slipLP.frequency, v = this.slipVol.gain;
    f.cancelScheduledValues(now); v.cancelScheduledValues(now);
    if (!on) { f.setValueAtTime(20000, now); v.setValueAtTime(1, now); this.slipUntil = 0; return; }
    const m = this.music && this.music.meta, beat = m ? (m.barSec || 240 / (m.bpm || 140)) / 4 : 0;
    let at = now; if (beat) { const toBeat = this.toNextBar() % beat; if (toBeat < beat / 2) at = now + toBeat; }
    f.setValueAtTime(f.value, now); v.setValueAtTime(v.value, now);
    if (SLIP_FILTER) f.setTargetAtTime(SLIP.hz, at, 0.05);
    v.setTargetAtTime(SLIP.vol, at, 0.06);
    f.setTargetAtTime(20000, now + dur, 0.04); v.setTargetAtTime(1, now + dur, 0.05);
    this.slipUntil = now + dur;
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
  // pause (and a hidden page) holds the sound on purpose; resume lets it go and starts it again whatever stopped it
  suspend() { this._held = true; if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { this._held = false; this.wake(false); }

  // ---- 0.4.0 (Tron, field fixes 11-07): the music clock, and a context that stopped started again
  _now() { return this.ctx ? this.ctx.currentTime + this._lag : 0; }
  // every frame the game runs (main.js; never while paused, and a hidden page has no frames): while the context is not
  // running, or runs with a clock that stands still, the frame carries the music clock on; once it runs, back in step
  tick(dt) {
    const c = this.ctx; if (!c || !(dt > 0)) return;
    const ct = c.currentTime, run = c.state === 'running';
    if (run && ct > this._lastCt) { this._stallT = 0; if (this._lag > 0) this._resync(); }
    else {
      this._stallT += dt;
      // (a running clock may go a quarter second between its updates before the frames take over)
      if (!run || this._stallT > 0.25) this._lag += !run || this._stallT - dt > 0.25 ? dt : this._stallT;
      if (run && this._stallT > 1.5 && !this._dead) { this._dead = true; this.stats.stall++; } // says running, clock dead: renewed at the next press
    }
    this._lastCt = ct;
  }
  // the context runs again after the music clock went on without it: fold the lag into the track's t0 and, when what is
  // heard is out of step with the clock (it stood still while the clock went on), start the track again at the clock's place
  _resync() {
    const lag = this._lag, m = this.music; this._lag = 0; this.stats.resync++;
    if (!m) return;
    const behind = lag - (m.lag0 || 0);
    m.t0 -= lag; m.lag0 = 0;
    if (behind > 0.03) this._restart(m, 0.04);
  }
  // the playing track again, on a fresh source, at the music clock's place `lead` s from now (a short fade in)
  _restart(m, lead) {
    const c = this.ctx, at = c.currentTime + lead, b = m.track && m.track.buf; if (!b) return;
    let raw = at + this._lag - m.t0; // buffer seconds at `at`, on the music clock
    if (raw > m.le && !m.once && m.src && m.src.loop && m.le > m.ls) raw = m.ls + ((raw - m.ls) % (m.le - m.ls));
    stopSrc(m.src, at);
    const s = c.createBufferSource(); s.buffer = b;
    const L = this._loopOf(m.track, b, m.opts); s.loop = L.loop; s.loopStart = L.ls; s.loopEnd = L.le;
    let fade = m.fade;
    if (!fade || fade.context !== c) { fade = c.createGain(); fade.gain.value = 1; fade.connect(this.duck); } // (a renewed context)
    const g = c.createGain(); s.connect(g); g.connect(fade);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(1, at + 0.08);
    if (raw < 0) { s.start(at - raw, 0); s._on = true; } else if (raw < b.duration) { s.start(at, raw); s._on = true; }
    Object.assign(m, { src: s, fade, t0: at + this._lag - raw, lag0: this._lag, ls: L.ls, le: L.le, pad: L.pad });
    this.stats.restart++;
  }
  // start the context again if it is not running ('suspended', or iOS's 'interrupted'), unless the game holds it
  // (paused). From a press, a context that would not start again, or whose clock has died, is made anew (_renew).
  wake(gesture) {
    const c = this.ctx; if (!c || !this._unlocked || this._held) return;
    const press = gesture || !!(navigator.userActivation && navigator.userActivation.isActive);
    if (press && (this._dead || c.state === 'closed') && performance.now() - this._renewAt > 2500) { this._renew(); return; }
    if (c.state === 'running') return;
    let p = null; try { p = c.resume(); } catch (e) { /* an old WebKit: no promise */ }
    if (press) this._kick(c);
    const fail = () => { if (this.ctx === c && c.state !== 'running' && !this._held) this._dead = true; };
    if (p && p.then) p.then(() => setTimeout(fail, 400), fail);
    setTimeout(fail, 2000); // a resume that never settles (iOS, after an interruption)
  }
  // iOS: a silent one-sample buffer played inside the press fully opens the output
  _kick(c) { try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) { /* ignore */ } }
  // the fallback: a new context and graph (a decoded take is not tied to its context), the track again at the clock's place
  _renew() {
    const old = this.ctx, m = this.music; if (!old) return;
    this._renewAt = performance.now(); this.stats.renew++;
    const clock = this._now();
    this.ctx = null; try { old.close(); } catch (e) { /* already closed */ }
    const c = this._context(); if (!c) { this.ctx = old; return; }
    this._lag = clock - c.currentTime; this._stallT = 0; this._lastCt = -1; this._dead = false; this.slipUntil = 0;
    try { c.resume(); } catch (e) { /* ignore */ }
    this._kick(c);
    console.warn('audio: a new context (the old one would not start again)');
    if (m && m.track && m.track.buf) this._restart(m, 0.05); else this.music = null;
  }
}
