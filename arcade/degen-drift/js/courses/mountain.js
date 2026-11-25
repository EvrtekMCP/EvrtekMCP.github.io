// DRIFTLINE region 3, Mountain pass: forested switchbacks at blue hour, with tunnels (k2) and gorge bridges (k3).
import { course } from './route.js?v=0.1.19';

export const PINE_HOLLOW = course({
  id: 'pine-hollow', name: 'PINE HOLLOW', region: 'mountain', difficulty: 45, scenery: 'mountain',
  blurb: 'Through the pines and the tunnel, then a pair of hairpins down into the hollow.',
  route: 'w5.7 o1.2 S160* g3 L50:40 R50:40 S60 L40:90 S50* k2 S160 k0 g-3 L30:90 S60 R35:60 L35:60 S50 g5 L26:180 S50 R26:180 S60 L40:90 S60 g-2 R45:50 L45:50 S80 C45:40',
  zones: { zoneHalf: 2.8, sweetHalf: 1.05 },
  stars: [13500, 33000, 70000], degenerate: 126000, // day 3: tools/starlines.mjs (zone worth and chain worth); his play retunes them
});

export const CEDAR = course({
  id: 'cedar-switchbacks', name: 'CEDAR SWITCHBACKS', region: 'mountain', difficulty: 51, scenery: 'mountain',
  blurb: 'Four hairpins stacked up the hillside, a bridge over the gorge, then flat out for home.',
  route: 'w5.25 o0.5 S150* g2 R60:90 S80* g8 R22:180 S70 L22:180 S70 R22:180 S70 L22:180 S60 g1 R40:90 k3 S120 k0 g-6 S40 R50:90 S60 g-4 L45:50 R45:50 S60 C35:40',
  zones: { zoneHalf: 2.7, sweetHalf: 1.0 },
  stars: [16000, 39000, 70000], degenerate: 123000, // day 3: tools/starlines.mjs (zone worth and chain worth); his play retunes them
  // a second slot on the grid for the downhill duels (later): [s, lateral] for the player and the rival
  duel: { grid: [[-9, -1.8], [-17, 1.8]] },
});

export const WIDOWMAKER = course({
  id: 'widowmaker-gorge', name: 'WIDOWMAKER GORGE', region: 'mountain', difficulty: 58, scenery: 'mountain',
  blurb: 'A tunnel, a bridge over the gorge and the switchbacks in between. Narrow, quick, and no runoff at all.',
  route: 'w5.3 o0 S170* g4 L70:40 R60:40 S40 L45:90 S40* k2 S140 k0 g-5 R30:70 L30:70 S40 L35:90 S50 L40:60 R40:120 L40:60 S40 g6 L22:175 S60 R22:175 S50 L40:90 k3 S110 k0 g-6 R50:60 L30:60 S80 C35:40',
  zones: { zoneHalf: 2.6, sweetHalf: 1.0 },
  stars: [15500, 38000, 82000], degenerate: 147000, // day 3: tools/starlines.mjs (zone worth and chain worth); his play retunes them
});
