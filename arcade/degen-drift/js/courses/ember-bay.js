// DRIFTLINE course 1: EMBER BAY PASS (fictional). An evening circuit: a lamp-lit harbour front, a climb through the
// pines on sweeping corners, a hairpin at the top, an S-bend on the way down and one long sweeper back to the water.
// Control points: [x, z, height, half width, kind]. kind 0 = harbour (concrete walls, LED lamps, containers),
// kind 1 = the pass (guard rails, sodium lamps, pines). The sea lies to the south (-z), the mountains to the north.
export const EMBER_BAY = {
  id: 'ember-bay',
  name: 'EMBER BAY PASS',
  blurb: 'A harbour front, a climb through the pines, one hairpin at the top. Link the S on the way down.',
  region: 'harbour',
  difficulty: 15,           // out of 100; the car's ability rating is weighed against it
  dressing: 'harbour-pass', // the scenery preset (world.js)
  stars: [9000, 22000, 42000], // day 3: tools/starlines.mjs (zone worth and chain worth); his play retunes them
  degenerate: 76000,
  startOffset: 62,
  points: [
    [230, 0, 0.6, 6.5, 0],
    [100, 0, 0.6, 6.5, 0],
    [-60, 3, 0.6, 6.5, 0],
    [-180, -2, 0.7, 6.5, 0],
    [-262, 12, 1.2, 6.6, 0],
    [-310, 52, 2.6, 6.6, 1],
    [-322, 110, 5.0, 6.5, 1],
    [-318, 170, 8.0, 6.5, 1],
    [-300, 215, 10.5, 6.5, 1],
    [-252, 248, 13.5, 6.5, 1],
    [-190, 258, 16.5, 6.5, 1],
    [-140, 280, 19.5, 6.5, 1],
    [-120, 330, 23, 6.5, 1],
    [-112, 385, 27, 6.6, 1],
    [-104, 425, 30.5, 7.2, 1],
    [-90, 455, 32.5, 7.6, 1],
    [-66, 467, 33.5, 7.8, 1],
    [-44, 453, 33.5, 7.6, 1],
    [-38, 421, 32.5, 7.2, 1],
    [-40, 380, 30, 6.6, 1],
    [-38, 345, 27, 6.4, 1],
    [-20, 310, 24, 6.3, 1],
    [20, 292, 21, 6.3, 1],
    [55, 270, 18.5, 6.3, 1],
    [72, 238, 16, 6.3, 1],
    [95, 215, 14, 6.4, 1],
    [150, 205, 11.5, 6.5, 1],
    [210, 200, 9, 6.5, 1],
    [262, 175, 6.5, 6.5, 1],
    [298, 120, 4, 6.6, 1],
    [305, 55, 2, 6.6, 0],
    [282, 14, 0.9, 6.5, 0],
  ],
  zones: { minCurv: 1 / 230, padIn: 12, padOut: 18, minLen: 34, zoneHalf: 3.0, sweetHalf: 1.15 },
  // the sun sits low over the sea, a little west: the harbour straight drives into it
  sun: [-0.62, 0.105, -0.78],
  seaLevel: -1.6,
};
