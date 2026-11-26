// DRIFTLINE region 2, Canyon: desert-red cutbacks at dusk. Wider and kinder than the mountains, harder than the docks.
import { course } from './route.js?v=0.1.21';

export const RED_MESA = course({
  id: 'red-mesa', name: 'RED MESA RUN', region: 'canyon', difficulty: 26, scenery: 'canyon',
  blurb: 'Fast, open sweepers under the mesas. Hold one long slide and let the speed pay.',
  route: 'w5.85 o2 S200 g3 L50:40 R50:40 S40 R60:90 S100 L45:60 R45:60 g-2 S120 R50:90 S80 g4 L40:70 R40:70 S60 g5 R26:170 S50 L30:80 g-3 R70:60 g0 S80 C45',
  zones: { zoneHalf: 3.1, sweetHalf: 1.2 },
  stars: [19000, 47000, 85000], degenerate: 151000, // day 3: tools/starlines.mjs (zone worth and chain worth); his play retunes them
});

export const DUST_DEVIL = course({
  id: 'dust-devil', name: 'DUST DEVIL CUTBACKS', region: 'canyon', difficulty: 32, scenery: 'canyon',
  blurb: 'Two cutbacks up the canyon wall, then the long drop back down. Link the switchback for the big chain.',
  route: 'w5.7 o1.5 S220* g2 R55:90 S80* g7 R24:180 S90 L24:180 S60 g2 R45:90 S120 g-4 L50:60 R40:110 S70 g-6 L35:50 R35:90 S60 R50:? g0 S100',
  zones: { zoneHalf: 3.0, sweetHalf: 1.15 },
  stars: [13500, 33000, 59000], degenerate: 104000, // day 3: tools/starlines.mjs (zone worth and chain worth); his play retunes them
  // a second slot on the grid for the downhill duels (later): [s, lateral] for the player and the rival
  duel: { grid: [[-9, -2.0], [-17, 2.0]] },
});

export const SCORPION = course({
  id: 'scorpion-gulch', name: 'SCORPION GULCH', region: 'canyon', difficulty: 39, scenery: 'canyon',
  blurb: 'A corner that keeps on tightening, quick esses and a long climb. Less room for mistakes.',
  route: 'w5.8 o1.5 S240 g4 L50:60 R40:90 L40:90 o0 S60 g6 R60:40 R35:50 R22:90 S80 g-4 L30:120 S60 R45:90 L45:50 o1.5 R30:100 g-5 S140 L65:30 R28:160 g0 S100 C40',
  zones: { zoneHalf: 2.9, sweetHalf: 1.1 },
  stars: [17500, 43000, 77000], degenerate: 136000, // day 3: tools/starlines.mjs (zone worth and chain worth); his play retunes them
});
