// GALAXY 3, levels 1-3 (THE SCAFFOLD, THE LOOM FLOOR, THE LOCKWORKS): one schedule for the music and the course
// (rule 30). Each level is written in BARS of its own track and turned into metres here, from the track's beat grid
// (the sound branch's audio/g3/levels/levelN/music.json, AUDIO-MANIFEST.md) and a speed that steps only on bar lines
// (rule 6). While the level's own take plays, the speed leans (at most 6 %) toward where the music says the ship
// should be, so hit-pauses, GREED and a Slipstream never leave a set piece off the beat for long.
//
// Until galaxy 3's music is switched on (levels.js GALAXIES has.music), a galaxy 1 take stands in: it plays under our
// track's NAME with ITS OWN beat grid, so the lean only runs when the playing grid's tempo is ours.
import { clamp, smooth } from '../../../api.js?v=0.6.3';
import { beatClock, boundApi } from '../../level3/beat.js?v=0.6.3';

const LAG = 0.05; // the music starts 50 ms into a run (audio.startMusic)

// track: { name, bpm, firstBeat, barSec }; speeds: [[bar, m/s], ...], each step easing in over the bar on its line
export function timeline(track, speeds) {
  const tOfBar = (bar) => LAG + track.firstBeat + (bar - 1) * track.barSec;
  const vAt = (t) => {
    let v = speeds[0][1];
    for (let i = 1; i < speeds.length; i++) {
      const tb = tOfBar(speeds[i][0]);
      if (t < tb) break;
      v += (speeds[i][1] - v) * smooth(clamp((t - tb) / track.barSec, 0, 1));
    }
    return v;
  };
  // distance flown by course time t, tabulated (long enough for 110 bars and a boss)
  const DT = 1 / 200, N = 320 * 200, D = new Float64Array(N + 1);
  for (let i = 1; i <= N; i++) D[i] = D[i - 1] + 0.5 * (vAt((i - 1) * DT) + vAt(i * DT)) * DT;
  const dOfT = (t) => { const f = clamp(t / DT, 0, N), i = Math.min(N - 1, Math.floor(f)); return D[i] + (D[i + 1] - D[i]) * (f - i); };
  const tOfD = (d) => {
    if (d <= 0) return 0; if (d >= D[N]) return N * DT;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (D[m] < d) lo = m; else hi = m; }
    return (lo + (d - D[lo]) / (D[hi] - D[lo])) * DT;
  };
  const barD = (bar) => dOfT(tOfBar(bar));        // the course distance of a bar line (5.5 = the third beat of bar 5)
  const baseSpeed = (d) => vAt(tOfD(d));
  const beatSec = track.barSec / 4;
  function speed(d) {
    const v = baseSpeed(d), c = beatClock(null), api = boundApi();
    if (!c.ok || c.track !== track.name || Math.abs(c.bpm - track.bpm) > 0.5 || !api || !api.G || api.G.greedOn || api.G.state !== 'play') return v;
    const err = dOfT(track.firstBeat + c.beat * beatSec + LAG) - d;   // metres the course is behind the music
    if (Math.abs(err) > v * 2.5) return v;                            // a jumped-in dev run: leave it alone
    return v * (1 + clamp(err / v * 0.3, -0.06, 0.06));
  }
  return { track, tOfBar, barD, baseSpeed, speed, dOfT, tOfD, beatSec };
}
