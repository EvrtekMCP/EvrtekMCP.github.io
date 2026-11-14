// LEVEL 4, SOLAR SKIM: the level and its music on one schedule (rule 30). The track (CLU (S)'s plan for l4,
// tools/sound/tracks.js) is 144 bpm in the club arrangement: Intro 8 bars, Groove 8, Build one 8, Drop one 16,
// Breakdown 16, Build two 8, Drop two 16, Drive 8, then an outro the loop never plays. The music starts with the
// run, so bar k (1-based) is at FIRST + (k - 1) * BAR seconds. The speed is written per bar, integrated once, and
// every set piece, speed step and flare eruption is placed by bar: `at(65)` is the metre where Drop two lands.
// When the take is measured (audio/levels/level4/music.json), FIRST and BPM come from it.
import { clamp } from '../../api.js?v=0.6.4';

export const BPM = 144;
export const BEAT = 60 / BPM, BAR = 4 * BEAT;   // 0.4167 s, 1.6667 s
export const FIRST = 0.2;                        // the first kick, about 0.2 s into a take (measured on l2 and the Warden)
export const END_BAR = 89;                       // the finish line: the downbeat after Drive (bar 88's end)

// [bar, m/s]: steps of about a bar on the act lines (rule 6: never on the same beat as a density step)
const KEYS = [
  [1, 80], [16.5, 88],          // act 1, introduce: steady
  [17.5, 100], [40.5, 108],     // act 2, develop: step on Build one
  [56.5, 112],                  // act 3, the breakdown: hold
  [57.5, 122], [64.5, 126],     // act 4: step on Build two
  [65.25, 138], [80.5, 144],    // step on the downbeat of Drop two (the Great Flare)
  [81.25, 152], [END_BAR + 2, 156], // the escape: top speed
];
const barTime = (b) => FIRST + (b - 1) * BAR;
function speedAtBar(b) {
  if (b <= KEYS[0][0]) return KEYS[0][1];
  for (let i = 1; i < KEYS.length; i++) {
    const [b1, v1] = KEYS[i], [b0, v0] = KEYS[i - 1];
    if (b <= b1) { const t = (b - b0) / (b1 - b0), s = b1 - b0 <= 1.01 ? t * t * (3 - 2 * t) : t; return v0 + (v1 - v0) * s; }
  }
  return KEYS[KEYS.length - 1][1];
}
// integrate once: d at every 1/240 s
const DT = 1 / 240, T_END = barTime(END_BAR + 2);
const TD = [0];
{ let d = 0; for (let t = DT; t <= T_END + DT; t += DT) { const b = 1 + (t - DT / 2 - FIRST) / BAR; d += speedAtBar(b) * DT; TD.push(d); } }
const dAtTime = (t) => { const i = clamp(t / DT, 0, TD.length - 1.001), k = Math.floor(i); return TD[k] + (TD[k + 1] - TD[k]) * (i - k); };
function timeAtD(d) {
  let lo = 0, hi = TD.length - 1;
  if (d <= 0) return 0; if (d >= TD[hi]) return hi * DT;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TD[m] < d) lo = m; else hi = m; }
  return (lo + (d - TD[lo]) / (TD[hi] - TD[lo])) * DT;
}
// the metre where bar b (fractional: 65.5 is beat 3 of bar 65) falls, at the nominal speed
export const at = (b) => Math.round(dAtTime(barTime(b)) * 10) / 10;
// the bar at metre d (for the beat sheet and the checks)
export const barAt = (d) => 1 + (timeAtD(d) - FIRST) / BAR;
// the level's speed, m/s at course distance d
export const speed = (d) => speedAtBar(barAt(d));
export const LENGTH = Math.round(at(END_BAR));
// metres the course covers in `bars` bars from bar b
export const span = (b, bars) => at(b + bars) - at(b);
