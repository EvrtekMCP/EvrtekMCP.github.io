// DRIFTLINE region 5, Summit: the hard high touge above the clouds at dawn. Narrow, steep, no runoff anywhere.
import { course } from './route.js?v=0.1.0';

export const FROSTLINE = course({
  id: 'frostline-pass', name: 'FROSTLINE PASS', region: 'summit', difficulty: 82, scenery: 'summit',
  blurb: 'Four hairpins up through the snow line. Narrow, steep and nowhere to run.',
  route: 'w5.0 S180* g5 L60:40 R50:80 L45:40 S40 L40:90 S50* g8 L20:175 S60 R20:175 S60 L20:175 S50 R20:175 S40 L30:90 S60 g3 L70:50 R40:100 L40:50 g-7 S80 L30:90 S60 L35:60 R35:60 g-6 S60 C30:40',
  zones: { zoneHalf: 2.4, sweetHalf: 0.9 },
  stars: [8500, 21000, 50000], degenerate: 89000, // day 3: tools/starlines.mjs (zone worth and chain worth); his play retunes them
});

export const SKYLINE = course({
  id: 'skyline-ridge', name: 'SKYLINE RIDGE', region: 'summit', difficulty: 88, scenery: 'summit',
  blurb: 'A ridge road above the clouds: fast esses, two hairpins and a long drop either side.',
  route: 'w4.45 S200* g4 R70:50 L60:100 R60:50 S60 R40:90 S60* g-5 R25:170 S40 L25:170 S60 L40:60 R40:60 R35:90 g6 S100 R55:60 L55:120 R55:60 S60 L22:170 S40 R22:170 S50 R30:90 g-6 S80 L45:45 R45:90 L45:45 S60 C40:40',
  zones: { zoneHalf: 2.3, sweetHalf: 0.85 },
  stars: [11000, 27000, 59000], degenerate: 105000, // day 3: tools/starlines.mjs (zone worth and chain worth); his play retunes them
});

export const CLOUDBREAK = course({
  id: 'cloudbreak-crown', name: 'CLOUDBREAK CROWN', region: 'summit', difficulty: 95, scenery: 'summit',
  blurb: 'The top of the world. Nearly three kilometres of everything, and the walls never let up.',
  route: 'w4.3 S220* g6 L60:50 R50:100 L40:50 S40 L40:90 S60* g9 L18:178 S60 R18:178 S60 L18:178 S60 R18:178 S60 L30:90 g4 S60 R70:40 R40:50 R24:90 L24:90 L40:50 L70:40 S60 g-4 L35:80 R35:160 L35:80 S60 L35:90 g-8 S50 L40:45 R40:90 L40:45 S40 R45:30 R20:150 S50 L20:150 L45:30 S60 g-5 R60:50 L60:50 S60 C40:40',
  zones: { zoneHalf: 2.2, sweetHalf: 0.8 },
  stars: [13500, 33000, 82000], degenerate: 146000, // day 3: tools/starlines.mjs (zone worth and chain worth); his play retunes them
  // a second slot on the grid for the downhill duels (later): [s, lateral] for the player and the rival
  duel: { grid: [[-9, -1.6], [-17, 1.6]] },
});
