// LEVEL 3, THE GATEFIELD: the beat clock. Everything in this level that moves on the music asks this module
// where the music is, in beats: the gates' shutters, the keystones, the gate turrets' trigger, the Warden.
//
// The source of truth is the playing track's own position (audio.position(), seconds into the file, wrapping
// at its loop points) and its beat grid (audio.beat: bpm, firstBeat, beatSec from the take's .json). Loops are
// whole bars, so the beat phase carries through a wrap; the beat COUNT is unwrapped here so it only ever rises.
// With no audio at all (blocked context, a headless run without sound), it falls back to the run's own clock
// at the level track's tempo, so the gates still step and the level still plays.
//
// It reads api.music (the engine's read-only view: position(), meta, track). The level's speed function has no
// api, so the first kind to ask binds it here for the rest of the run.
let API = null;
const DEF = { bpm: 140, firstBeat: 0, beatSec: 60 / 140, barSec: 240 / 140 };

const C = {
  ok: false,        // true while a real track position drives it
  beat: 0,          // beats since the track's first beat, fractional, monotonic within a track
  beatSec: DEF.beatSec, barSec: DEF.barSec, bpm: DEF.bpm,
  track: '',        // the playing track's name (the level's or the boss's)
  stamp: -1,        // api.time of the last update, so it runs once a frame however many ask
  _raw: 0, _wrap: 0, _loopBeats: 0, _virt0: 0,
};

function audioOf(api) { return api && api.music ? api.music : null; }

// update once per frame (cheap; safe to call from every kind)
export function beatClock(api) {
  if (api) API = api; else api = API;
  if (api && C.stamp === api.time && api.time !== 0) return C;
  C.stamp = api ? api.time : 0;
  const A = audioOf(api);
  const pos = A && A.position ? A.position() : -1;
  const meta = A ? (A.meta !== undefined ? A.meta : A.music ? A.music.meta : null) : null;
  const name = A ? (A.track !== undefined ? A.track : A.music ? A.music.name : '') : '';
  if (pos !== -1 && meta && name) {
    const bs = meta.beatSec || 60 / (meta.bpm || DEF.bpm);
    if (name !== C.track) { C.track = name; C._wrap = 0; C._raw = -1e9; }
    C.beatSec = bs; C.barSec = meta.barSec || bs * 4; C.bpm = meta.bpm || 60 / bs;
    C._loopBeats = meta.loopEnd && meta.loopStart ? Math.round((meta.loopEnd - meta.loopStart) / bs) : 0;
    const raw = (pos - (meta.firstBeat || 0)) / bs;
    if (raw < C._raw - 2 && C._loopBeats) C._wrap += C._loopBeats; // the track wrapped at its loop
    C._raw = raw;
    C.beat = raw + C._wrap;
    C.ok = true;
  } else {
    // no track: run time at the level's tempo
    const t = api && api.G ? api.G.time : 0;
    C.ok = false; C.track = '';
    C.beat = t / C.beatSec;
  }
  return C;
}
// the integer beat we are in, and how far into it (0..1)
export const beatIndex = (c) => Math.floor(c.beat + 1e-6);
export const beatFrac = (c) => c.beat - Math.floor(c.beat);
// a 0..1 flash on every beat: 1 on the beat, falling over `len` of a beat
export function pulse(c, len = 0.35, every = 1) {
  const b = c.beat / every, f = b - Math.floor(b);
  return f < len ? 1 - f / len : 0;
}
export { C as clock };
export const boundApi = () => API;
