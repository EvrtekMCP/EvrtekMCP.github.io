// DRIFTLINE region 4, Neon city: closed street circuits after dark. Square corners between walls, long boulevards.
import { course } from './route.js?v=0.1.25';

export const AFTERGLOW = course({
  id: 'afterglow-boulevard', name: 'AFTERGLOW BOULEVARD', region: 'neon', difficulty: 64, scenery: 'neon',
  blurb: 'Long boulevards, square corners and a quick chicane by the plaza. The walls are closer than they look.',
  route: 'w4.95 o1 S260* R28:90 S120* R30:90 S60 L25:90 S50 R22:90 S70 R30:60 L30:120 R30:60 S60 R26:90 S200 R35:? S60 L30:45 R30:45',
  zones: { zoneHalf: 2.7, sweetHalf: 1.0 },
  stars: [9500, 23000, 53000], degenerate: 95000, // day 3: tools/starlines.mjs (zone worth and chain worth); his play retunes them
});

export const CHROME = course({
  id: 'chrome-district', name: 'CHROME DISTRICT', region: 'neon', difficulty: 70, scenery: 'neon',
  blurb: 'Block after block of tight city corners. Every one links to the next if you are brave enough.',
  route: 'w4.75 o0.3 S220* R25:90 S60* L20:90 R20:90 S80 R60:90 S40 L28:50 R28:100 L28:50 S40 L30:60 R30:60 S40 R20:90 S40 L20:90 S60 R30:90 S90 L35:80 R35:80 S100 C30:50',
  zones: { zoneHalf: 2.6, sweetHalf: 0.95 },
  stars: [13000, 32000, 64000], degenerate: 115000, // day 3: tools/starlines.mjs (zone worth and chain worth); his play retunes them
});

export const MIDNIGHT = course({
  id: 'midnight-interchange', name: 'MIDNIGHT INTERCHANGE', region: 'neon', difficulty: 76, scenery: 'neon',
  blurb: 'Up the ramp, round the interchange and down into the hairpins. The fastest street in town.',
  route: 'w4.6 o0.3 S240 R22:90 S60 L22:90 S40 R22:90 o0 S140 g4 R80:30 S80 g-4 R45:90 S50 L25:160 S50 R25:160 S60 o0.3 R35:90 g0 S160 L30:70 R30:70 C40',
  zones: { zoneHalf: 2.5, sweetHalf: 0.95 },
  stars: [16000, 39000, 76000], degenerate: 136000, // day 3: tools/starlines.mjs (zone worth and chain worth); his play retunes them
});
