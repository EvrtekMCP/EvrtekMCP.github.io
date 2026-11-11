// GALAXY 3, levels 7-9 (CLU, branch g3-c): one schedule for the music and the course (rule 30), shared by the Rivet Line,
// the Fractal Yard and the Vault. A level's speed steps up on bar lines (eased over half a bar); BAR(b) turns a bar of its
// track into course metres through that speed curve, so set pieces, speed steps and act starts land on the music. Bars
// count from 0 here; the track's own bar numbers (1-based) are one more.
//
// Tonight the three tracks are still to come (the sound branch stopped on the ElevenLabs credit quota): the grid is laid
// on each track's PLANNED tempo from AUDIO-MANIFEST.md (148, 150, 150 bpm) with a first downbeat of 0.16 s, the galaxy's
// measured norm (0.154, 0.161, 0.162 s). When a take lands, its .json's bpm and firstBeat go in here and every bar moves
// with them; check-levels reports the section starts against the real grid.
import { clamp } from '../../../api.js?v=0.6.3';

export function musicGrid({ bpm, firstBeat = 0.16, steps, bars = 110 }) {
  const BAR_S = 240 / bpm;
  // the speed at time t into the track: each step eased in over half a bar
  const vAtT = (t) => { const b = (t - firstBeat) / BAR_S; let v = steps[0][1]; for (let i = 1; i < steps.length; i++) { const k = clamp((b - steps[i][0]) / 0.5, 0, 1); v += (steps[i][1] - steps[i - 1][1]) * k * k * (3 - 2 * k); } return v; };
  // integrate once: course metres at each bar line
  let d = firstBeat * steps[0][1], t = firstBeat; const out = [d];
  for (let bar = 1; bar <= bars; bar++) { const t1 = firstBeat + bar * BAR_S; while (t < t1) { const h = Math.min(0.005, t1 - t); d += vAtT(t + h / 2) * h; t += h; } out.push(d); }
  const BAR = (b) => { const i = clamp(Math.floor(b), 0, out.length - 2), f = b - i; return out[i] + (out[i + 1] - out[i]) * f; };
  // the same curve as a function of distance (what defineLevel wants)
  const stepD = steps.map(([b, v]) => [BAR(b), BAR(b + 0.5), v]);
  const speed = (dd) => { let v = steps[0][1]; for (let i = 1; i < stepD.length; i++) { const k = clamp((dd - stepD[i][0]) / (stepD[i][1] - stepD[i][0]), 0, 1); v += (stepD[i][2] - stepD[i - 1][2]) * k * k * (3 - 2 * k); } return v; };
  return { BAR, speed, BAR_S, BEAT_S: BAR_S / 4, firstBeat };
}

// Ring patterns laid end to end between two bars, a breath between each, so a ring is never far after a hit (rule 7).
// style: 'mixed' (lines across, down, diagonals and corkscrews), 'corkscrew', 'centre' (short lines near the middle:
// under a string, where the eye is on the gun), 'low' (kept to the lower half: under guns hung above the lane).
// The spacing grows with speed (`speed`, the level's curve): a pattern asks the same sideways reach of your hands at
// 166 m/s as at 115, so the fast stretches are not a ring tax.
export function ringRun(L, R, BAR, b0, b1, style = 'mixed', { breath = [110, 170], speed = null } = {}) {
  const { line, sine } = L;
  let d = BAR(b0), k = 0; const end = BAR(b1);
  while (d < end - 60) {
    let next;
    const st = Math.max(1, (speed ? speed(d) : 115) / 115), s = (m) => m * st;
    const pick = style === 'corkscrew' ? 3 : (k + R.int(0, 3)) % 5; k++;
    if (style === 'centre') next = line(d, R.range(-0.35, 0.35), R.range(-0.3, 0.3), R.range(-0.35, 0.35), R.range(-0.3, 0.3), 5, s(24));
    else if (style === 'low') next = line(d, R.range(-0.6, 0.6), R.range(-0.7, -0.15), R.range(-0.6, 0.6), R.range(-0.7, -0.15), 5, s(24));
    else if (pick === 0) next = line(d, R.range(-0.6, 0.6), R.range(-0.5, 0.5), R.range(-0.6, 0.6), R.range(-0.5, 0.5), 5, s(24));
    else if (pick === 1) next = line(d, -0.6, R.range(-0.3, 0.4), 0.6, R.range(-0.3, 0.4), 6, s(24));
    else if (pick === 2) next = line(d, R.range(-0.3, 0.3), 0.55, R.range(-0.3, 0.3), -0.5, 5, s(25));
    else if (pick === 3) next = sine(d, 8, s(25), R.range(0.42, 0.58), R.range(0.36, 0.48), R() * 6);
    else next = line(d, R.sign() * 0.55, R.sign() * 0.45, 0, 0, 5, s(24));
    d = Math.min(end, next) + R.range(breath[0], breath[1]) * st;
  }
}
