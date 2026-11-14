// The music clock of g2-b's three levels (THE MIGRATION, GRAVITY GARDEN, THE TANGLE): speed that steps up on bar
// lines (rule 6: each step eased over `ramp` metres in a calm stretch), and distance <-> time <-> bar, from the
// track's measured kick grid (audio/AUDIO-MANIFEST.md on the sound branch). Bars count from 0 at the first beat, as
// galaxy 1's level 6 counts them: B(n) is where the manifest's bar n + 1 starts.
//   const C = clock({ bpm: 138.01, firstBeat: 0.172, v0: 76, steps: [[24, 19], [48, 19]] });
//   C.speed(d)  C.B(32)  C.barAt(d)  C.at(bar, secondsLater)
import { smoothstep } from '../../../api.js?v=0.6.4';

export function clock({ bpm, firstBeat = 0, v0, steps = [], ramp = 150, max = 30000 }) {
  const BAR = 240 / bpm;
  const barT = (n) => firstBeat + n * BAR;
  const D = [];
  const speed = (d) => { let v = v0; for (const [d0, dv] of D) v += dv * smoothstep(d0, d0 + ramp, d); return v; };
  let TAB = null;
  const table = () => { const t = [0]; for (let d = 5; d <= max; d += 5) t.push(t[t.length - 1] + 5 / speed(d - 2.5)); TAB = t; };
  const timeAt = (d) => { const i = Math.max(0, Math.min(TAB.length - 2, Math.floor(d / 5))), f = d / 5 - i; return TAB[i] + (TAB[i + 1] - TAB[i]) * f; };
  const distAt = (t) => { let lo = 0, hi = TAB.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TAB[m] < t) lo = m; else hi = m; } return (lo + (t - TAB[lo]) / (TAB[hi] - TAB[lo])) * 5; };
  for (const [bar, dv] of steps) { table(); D.push([Math.round(distAt(barT(bar))), dv]); }
  table();
  const B = (n) => Math.round(distAt(barT(n)));
  // the course distance `sec` seconds after bar n's line (a hound arriving so that its bolt crosses on a bar)
  const at = (n, sec = 0) => Math.round(distAt(barT(n) + sec));
  const barAt = (d) => (timeAt(d) - firstBeat) / BAR;
  return { BAR, speed, B, at, barAt, timeAt, distAt, steps: D.map((s) => s[0]) };
}
