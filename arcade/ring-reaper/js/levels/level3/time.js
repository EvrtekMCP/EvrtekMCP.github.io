// LEVEL 3, THE GATEFIELD: one schedule for the music and the course (rule 30). The course is written in BARS of
// the level's track and turned into metres here, from the track's own beat grid and a speed that steps up only on
// bar lines (rule 6). While the track plays, the speed leans (at most 6 %) toward wherever the music says the ship
// should be, so hit-pauses and the odd stall never leave the gates crossing off the beat.
import { clamp, smooth } from '../../api.js?v=0.6.3';
import { beatClock, boundApi } from './beat.js?v=0.6.3';

// audio/levels/level3/music.json (take l3-t2): the kick grid fitted to the take
export const TRACK = { name: 'levels/level3/music', firstBeat: 0.1473, beatSec: 0.42858, barSec: 1.71432 };
const LAG = 0.05;                         // the music starts 50 ms into a run (audio.startMusic)
// [bar, m/s]: each step eases in over the bar that starts on its line
export const SPEEDS = [[1, 72], [9, 80], [25, 88], [33, 98], [49, 90], [57, 98], [65, 108], [81, 114]];

export const tOfBar = (bar) => LAG + TRACK.firstBeat + (bar - 1) * TRACK.barSec;
function vAt(t) {
  let v = SPEEDS[0][1];
  for (let i = 1; i < SPEEDS.length; i++) {
    const tb = tOfBar(SPEEDS[i][0]);
    if (t < tb) break;
    v += (SPEEDS[i][1] - v) * smooth(clamp((t - tb) / TRACK.barSec, 0, 1));
  }
  return v;
}
// distance flown by course time t, tabulated
const DT = 1 / 200, N = 260 * 200;
const D = new Float64Array(N + 1);
for (let i = 1; i <= N; i++) D[i] = D[i - 1] + 0.5 * (vAt((i - 1) * DT) + vAt(i * DT)) * DT;
export function dOfT(t) { const f = clamp(t / DT, 0, N), i = Math.min(N - 1, Math.floor(f)); return D[i] + (D[i + 1] - D[i]) * (f - i); }
export function tOfD(d) {
  let lo = 0, hi = N;
  if (d <= 0) return 0; if (d >= D[N]) return N * DT;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (D[m] < d) lo = m; else hi = m; }
  return (lo + (d - D[lo]) / (D[hi] - D[lo])) * DT;
}
// the course distance of a bar line (fractional bars are fine: 5.5 is the third beat of bar 5)
export const barD = (bar) => dOfT(tOfBar(bar));
export const baseSpeed = (d) => vAt(tOfD(d));

// the speed the level hands the engine: the base curve, leaning toward the music's schedule while it plays
export function speed(d) {
  const v = baseSpeed(d), c = beatClock(null), api = boundApi();
  if (!c.ok || c.track !== TRACK.name || !api || !api.G || api.G.greedOn || api.G.state !== 'play') return v;
  const err = dOfT(TRACK.firstBeat + c.beat * TRACK.beatSec + LAG) - d;   // metres the course is behind the music
  if (Math.abs(err) > v * 2.5) return v;                                  // a jumped-in dev run: leave it alone
  return v * (1 + clamp(err / v * 0.3, -0.06, 0.06));
}
