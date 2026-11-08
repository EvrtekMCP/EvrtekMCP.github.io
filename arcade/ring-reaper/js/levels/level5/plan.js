// LEVEL 5: one schedule for the music and the course (rule 30). The speed is set in TIME, in steps that start on
// bar lines and ramp over one bar (rule 6), and integrated once into a table, so the course can be authored in
// bars: B(33) is where the ship is when bar 33 (Drop one) begins, at the nominal speed. GREED and boosts pull
// everything earlier, as in every level; the arcs keep the music's time whatever the speed.
import { TRACK, barStart } from './track.js?v=0.5.0';

// [bar, m/s]: Intro 72, Groove 80, Build one 92, Drop one 104, Build two 116, Drop two 126, the wall 136, Drive 144
export const STEPS = [[1, 72], [9, 80], [25, 92], [33, 104], [57, 116], [65, 126], [77, 136], [81, 144]];
export const END_BAR = 89; // the finish: the first beat after Drive (bars 81-88); the take's Outro never plays
const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export function vAtT(t) {
  let v = STEPS[0][1];
  for (let i = 1; i < STEPS.length; i++) v += (STEPS[i][1] - STEPS[i - 1][1]) * sm((t - barStart(STEPS[i][0])) / TRACK.bar);
  return v;
}
const DT = 1 / 120, T = [0], D = [0];
for (let t = 0, d = 0; t < barStart(END_BAR + 4); ) { const v0 = vAtT(t), v1 = vAtT(t + DT); d += (v0 + v1) / 2 * DT; t += DT; T.push(t); D.push(d); }
function interp(xs, ys, x) {
  let lo = 0, hi = xs.length - 1;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[hi]) return ys[hi] + (x - xs[hi]) * (ys[hi] - ys[hi - 1]) / (xs[hi] - xs[hi - 1]);
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
  return ys[lo] + (ys[hi] - ys[lo]) * (x - xs[lo]) / (xs[hi] - xs[lo]);
}
export const dAtT = (t) => interp(T, D, t);
export const tAtD = (d) => interp(D, T, d);
// metres at bar k (fractional: 33.5 is half way through bar 33)
export const B = (k) => dAtT(barStart(k));
export const LENGTH = Math.round(B(END_BAR));
// the speed curve the engine asks for, as a function of course distance
export const speed = (d) => vAtT(tAtD(d));
// bars (fractional) at distance d
export const barAtD = (d) => 1 + (tAtD(d) - TRACK.first) / TRACK.bar;
