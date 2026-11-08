// THE WEFTWORK's music grid: the one place the finale's three takes are measured. The course is laid out in BARS of
// each act's track, and this table turns a bar into seconds (rule 30: set pieces, speed steps and the boss's entrance
// on bar lines). The level (level10.js) and the boss (js/bosses/g3-weftwork) both read it.
//
// Galaxy 3's acts (warp 145, shed 152, weftwork 156 bpm, D minor) wait on ElevenLabs credits. Until they land the engine
// plays galaxy 1's finale takes in their place, by position (audio.js standIn: warp -> approach, shed -> dive, weftwork
// -> core), and their bar maps are galaxy 1's bar for bar (AUDIO-MANIFEST). So these are the STAND-INS' measured
// grids. When the real takes land, replace the three lines below with each take's own bpm and firstBeat from its
// .json (audio/g3/level10/<act>.json): nothing else in the level or the boss changes.
export const GRID = {
  warp: { bpm: 139.985, firstBeat: 0.1474 },     // stand-in: audio/levels/level10/approach.json (the real take: 145 bpm)
  shed: { bpm: 145.004, firstBeat: 0.2037 },     // stand-in: audio/levels/level10/dive.json     (the real take: 152 bpm)
  weftwork: { bpm: 149.996, firstBeat: 0.2652 }, // stand-in: audio/levels/level10/core.json     (the real take: 156 bpm)
};
export const TRACK = { warp: 'g3/level10/warp', shed: 'g3/level10/shed', weftwork: 'g3/level10/weftwork' };
// a bar's length in seconds, and where bar b (1 = the first) starts in its take
export const barOf = (act) => 240 / GRID[act].bpm;
export const beatOf = (act) => 60 / GRID[act].bpm;
export const barT = (act, b) => GRID[act].firstBeat + (b - 1) * barOf(act);
// The bar maps (planned in the AUDIO-MANIFEST, the same as galaxy 1's): the first bar of each section.
//   warp      Intro 1 | Groove 9 | Build one 25 | Drop one 33 | Breakdown 49 | (Build two 57: the shed cuts in here)
//   shed      Intro 1 | Groove 5 | Build one 21 | Drop one 29 | Pause 45 | (Build two 49: the boss's track cuts in here)
//   weftwork  Impact 1 | Call 5 | Beat 21 | Snap 37 | Build 45 | Unravel 53 | Peak 69 | Outro 85 (to 90)
export const BARS = {
  warp: { intro: 1, groove: 9, build: 25, drop: 33, breakdown: 49, next: 57 },
  shed: { intro: 1, groove: 5, build: 21, drop: 29, pause: 45, next: 49 },
  weftwork: { impact: 1, call: 5, beat: 21, snap: 37, build: 45, unravel: 53, peak: 69, outro: 85, end: 91 },
};
