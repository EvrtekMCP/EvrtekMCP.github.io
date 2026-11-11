// GALAXY 2, LEVEL 3, THE DRUMREEF: its clock (level1/clock.js) on its own take, g2/level3/music (136.02 bpm, 1.764 s a
// bar), shared by the level and the reef that beats in time with it. The speed steps on bar lines, 74 to 150 m/s.
import { musicTime, GRID } from '../level1/clock.js?v=0.6.3';

export const CLK = musicTime(Object.assign({ speeds: [[1, 74], [9, 82], [25, 92], [33, 104], [49, 98], [57, 112], [65, 126], [69, 138], [73, 150], [81, 120]] }, GRID[3]));
// where the music is, in beats: the take's own clock while it plays, else the course's (a stand-in, or no sound)
export function beatNow(api) {
  const c = CLK.clock();
  if (c.ok) return c.beat;
  return (CLK.barOf((api && api.G && api.G.courseD) || 0) - 1) * 4;
}
