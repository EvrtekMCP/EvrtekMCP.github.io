// DRIFTLINE region 1, Harbour: closed industrial docks at sunset (EMBER BAY PASS lives in its own file).
// Each route is a turtle walk (see route.js): S straight, L/R bends (radius:degrees), w lane half width, o runoff,
// g grade %, k kind, C close. Difficulty rises with narrower lanes, less runoff, tighter and quicker corners.
import { course } from './route.js?v=0.1.0';

export const DRYDOCK = course({
  id: 'drydock-run', name: 'DRYDOCK RUN', region: 'harbour', difficulty: 10, scenery: 'harbour',
  blurb: 'Wide lanes between the container stacks and plenty of room to run wide. The place to learn linking.',
  route: 'w7.6 o6 S260* R50:90 S160* R70:50 L60:50 S90 R40:90 S140 R38:90 S60 L60:45 R50:45 S220 R60:?',
  zones: { zoneHalf: 3.4, sweetHalf: 1.4 },
  stars: [5000, 12500, 21000], degenerate: 30000, // day 3: tools/starlines.mjs (zone worth and chain worth); his play retunes them
});

export const SALT_PIER = course({
  id: 'salt-pier', name: 'SALT PIER CIRCUIT', region: 'harbour', difficulty: 21, scenery: 'harbour',
  blurb: 'Out along the pier and back round two hairpins. Tighter than it looks, and the water is right there.',
  route: 'w6.3 o2 S280* L40:90 S100 R30:90 L30:90 S60 L35:90 S90 R26:180 S40 L28:180 S40 R35:50 L35:100 R35:50 S40 L45:90 S200* L40:?',
  zones: { zoneHalf: 3.0, sweetHalf: 1.15 },
  stars: [6500, 15500, 30000], degenerate: 53000, // day 3: tools/starlines.mjs (zone worth and chain worth); his play retunes them
});
