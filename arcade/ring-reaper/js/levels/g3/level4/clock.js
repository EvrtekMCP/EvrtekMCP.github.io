// Galaxy 3, levels 4-6 (CLU g3-b): one schedule per level (rule 30). The speed is a function of TIME, stepped on bar
// lines of the level's track, and integrated once into distance, so B(bar) is the course metre where music bar `bar`
// starts (bars are the music's own numbers, 1-based) and every speed step, act and set piece sits on a bar line.
// Until the level's own take lands, the grid is the plan's tempo (the sound branch's manifest: bpm and the bar map
// every level track shares) with a nominal first beat; check-levels reports bars from the real grid once it is in.
import { clamp, smooth } from '../../../api.js?v=0.6.2';

// bpm, firstBeat (s), steps [[bar, m/s], ...] (each reached ON its bar, eased over the half bar before), lastBar
export function musicClock(bpm, firstBeat, steps, lastBar) {
  const BAR = 240 / bpm, tOfBar = (b) => firstBeat + (b - 1) * BAR;
  const vAt = (t) => {
    let v = steps[0][1];
    for (let i = 1; i < steps.length; i++) { const t1 = tOfBar(steps[i][0]), t0 = t1 - BAR * 0.5; v += (steps[i][1] - steps[i - 1][1]) * smooth(clamp((t - t0) / (t1 - t0), 0, 1)); }
    return v;
  };
  const DT = 0.02, TAB = [0], N = Math.ceil((tOfBar(lastBar + 12)) / DT);
  for (let i = 0; i < N; i++) TAB.push(TAB[i] + vAt((i + 0.5) * DT) * DT);
  const dOfT = (t) => { const i = clamp(Math.floor(t / DT), 0, TAB.length - 2), f = t / DT - i; return TAB[i] + (TAB[i + 1] - TAB[i]) * f; };
  const tOfD = (d) => { let lo = 0, hi = TAB.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TAB[m] <= d) lo = m; else hi = m; } return (lo + (d - TAB[lo]) / Math.max(1e-6, TAB[lo + 1] - TAB[lo])) * DT; };
  const B = (bar) => dOfT(tOfBar(bar));
  const speed = (d) => vAt(tOfD(d));
  // seconds out a thing at course metre d is, seen from course metre d0 (at the course's own speed)
  const secs = (d0, d) => tOfD(d) - tOfD(d0);
  return { BAR, B, speed, tOfD, dOfT, tOfBar, secs };
}
