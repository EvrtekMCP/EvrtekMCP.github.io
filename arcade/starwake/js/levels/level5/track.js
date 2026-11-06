// LEVEL 5: the music's beat grid, the one clock the whole level runs on (rule 30). From the take's .json
// (audio/levels/level5/music.json, l5-t1: 146.013 bpm, C# minor, first kick at 0.3589 s). Bar k (1-based) starts
// at FIRST + (k - 1) * BAR seconds into the run; the arcs switch on these beats, the set pieces sit on these bars.
export const TRACK = { bpm: 146.013, first: 0.3589, beat: 0.41092, bar: 1.64369 };
// beats since the first kick, at run time t (seconds). The music starts with the run, so the run's clock is
// the music's clock (a hit-pause slows the run by a few hundredths of a second over a whole level).
export const beatAt = (t) => (t - TRACK.first) / TRACK.beat;
export const barStart = (k) => TRACK.first + (k - 1) * TRACK.bar;
