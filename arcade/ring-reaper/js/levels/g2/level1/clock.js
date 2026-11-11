// GALAXY 2, LEVELS 1-3 (branch g2-a): one schedule for the music and the course (rule 30), shared by Tideway, the
// Shoals and the Drumreef. Each level is written in BARS of its own take (the sound branch's measured grid in
// audio/g2/level<N>/music.json: firstBeat and barSec), turned into metres here from a speed that steps only on bar
// lines (rule 6). While the level's OWN take plays, the speed leans (at most 6 %) toward where the music says the ship
// should be, so set pieces stay on the beat after a hit-pause. A galaxy 1 stand-in (another tempo, until the sound
// branch's flag is flipped) is left alone: the course then flies its own clock.
import { clamp, smooth } from '../../../api.js?v=0.6.0';

const LAG = 0.05;                         // the music starts 50 ms into a run (audio.startMusic)

// track: the stem; bpm, firstBeat, barSec: the take's grid; speeds: [[bar, m/s], ...], each step easing in over the
// bar that starts on its line; bars: how far to tabulate
export function musicTime({ track, bpm, firstBeat, barSec, speeds, bars = 140 }) {
  const beatSec = barSec / 4;
  const tOfBar = (bar) => LAG + firstBeat + (bar - 1) * barSec;
  function vAt(t) {
    let v = speeds[0][1];
    for (let i = 1; i < speeds.length; i++) {
      const tb = tOfBar(speeds[i][0]);
      if (t < tb) break;
      v += (speeds[i][1] - v) * smooth(clamp((t - tb) / barSec, 0, 1));
    }
    return v;
  }
  const DT = 1 / 200, N = Math.ceil(tOfBar(bars) / DT);
  const D = new Float64Array(N + 1);
  for (let i = 1; i <= N; i++) D[i] = D[i - 1] + 0.5 * (vAt((i - 1) * DT) + vAt(i * DT)) * DT;
  const dOfT = (t) => { const f = clamp(t / DT, 0, N), i = Math.min(N - 1, Math.floor(f)); return D[i] + (D[i + 1] - D[i]) * (f - i); };
  function tOfD(d) {
    if (d <= 0) return 0; if (d >= D[N]) return N * DT;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (D[m] < d) lo = m; else hi = m; }
    return (lo + (d - D[lo]) / (D[hi] - D[lo])) * DT;
  }
  const barD = (bar) => dOfT(tOfBar(bar));          // the course distance of a bar line (5.5 = the third beat of bar 5)
  const barOf = (d) => (tOfD(d) - LAG - firstBeat) / barSec + 1;
  const baseSpeed = (d) => vAt(tOfD(d));

  // the playing track, in beats since its first beat (unwrapped across its loop), read once a frame
  let API = null;
  const C = { ok: false, beat: 0, raw: -1e9, wrap: 0, name: '', stamp: -1 };
  function clock() {
    const api = API;
    if (!api) { C.ok = false; return C; }
    if (C.stamp === api.time && api.time !== 0) return C;
    C.stamp = api.time;
    const A = api.music, pos = A ? A.position() : -1, meta = A ? A.meta : null, name = A ? A.track : '';
    // only the level's own take: a stand-in (galaxy 1's, until the sound branch lands) has another grid
    if (pos < 0 || !meta || name !== track || Math.abs((meta.bpm || 0) - bpm) > 0.5) { C.ok = false; return C; }
    if (name !== C.name) { C.name = name; C.wrap = 0; C.raw = -1e9; }
    const bs = meta.beatSec || 60 / meta.bpm, loopBeats = meta.loopEnd && meta.loopStart ? Math.round((meta.loopEnd - meta.loopStart) / bs) : 0;
    const raw = (pos - (meta.firstBeat || 0)) / bs;
    if (raw < C.raw - 2 && loopBeats) C.wrap += loopBeats;
    C.raw = raw; C.beat = raw + C.wrap; C.ok = true;
    return C;
  }
  // the speed the level hands the engine: the base curve, leaning toward the music's schedule while it plays
  function speed(d) {
    const v = baseSpeed(d), api = API;
    if (!api || !api.G || api.G.greedOn || api.G.state !== 'play') return v;
    const c = clock(); if (!c.ok) return v;
    const err = dOfT(firstBeat + c.beat * beatSec + LAG) - d;   // metres the course is behind the music
    if (Math.abs(err) > v * 2.5) return v;                       // a jumped-in dev run: leave it alone
    return v * (1 + clamp(err / v * 0.3, -0.06, 0.06));
  }
  // the level's landmark set piece binds the api on its first frame (a speed function has no api of its own)
  const bind = (api) => { API = api; };
  return { track, bpm, barSec, beatSec, firstBeat, tOfBar, barD, barOf, dOfT, tOfD, baseSpeed, speed, bind, clock };
}

// the three takes' grids (audio/g2/level<N>/music.json on the sound branch, measured on the kick)
export const GRID = {
  1: { track: 'g2/level1/music', bpm: 131.979, firstBeat: 0.0679, barSec: 1.81847 },   // loops bars 9-80
  2: { track: 'g2/level2/music', bpm: 133.97, firstBeat: 0.1231, barSec: 1.79145 },    // loops bars 9-88
  3: { track: 'g2/level3/music', bpm: 136.017, firstBeat: 0.1457, barSec: 1.76449 },   // loops bars 9-88
  whirlmaw: { track: 'g2/bosses/whirlmaw', bpm: 135.998, firstBeat: 0.1574, barSec: 1.76473 },
};
