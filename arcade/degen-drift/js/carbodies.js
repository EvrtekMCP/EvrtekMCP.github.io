// DEGEN DRIFT: the six bodies, as shapes (fictional cars; no real make, no badges). carmesh.js lofts each from these
// numbers: a side profile (nose, cowl, deck, tail kick), a plan (base width, front and rear arches), a glasshouse
// (screen base, roof, rear glass end), a section shape (superellipse power: higher is boxier), and the details that
// give each its face: lamps, tail lamps, wing, scoop, vents, exhaust. Lengths in metres; z runs rear (-L/2) to front.
export const BODIES = {
  // light compact front-engine coupe, matched to Portero's key art (job 001): a long low bonnet, wide arches, quad
  // round lamps in a dark housing, a raised rear wing, the cyan pinstripe along the shoulder, five-spoke rims
  kestrel: { L: 4.45, half: 0.85, fF: 0.07, fFw: 0.42, fR: 0.12, fRw: 0.55, n: 4.2, ride: 0.24,
    axleF: 1.24, axleR: -1.32, track: 1.6, wheelR: 0.33, tireW: 0.25,
    noseH: 0.5, cowlH: 0.8, deckH: 0.86, tailStart: -1.6, tailKick: 0.12,
    zScreen: 0.62, zRoofF: -0.02, zRoofR: -0.62, zGlassEnd: -1.42, roofH: 1.27, roofW: 0.6,
    lamps: 'quadround', tails: 'twin', wing: 'raised', exhaust: 'dual', pinstripe: '#36f2ff', headTint: [1.0, 0.82, 0.55] },
  // smooth, balanced straight-six GT: a long bonnet, the cabin set back, a flat boot with a lip, slim lamps
  vanta: { L: 4.66, half: 0.88, fF: 0.04, fFw: 0.45, fR: 0.06, fRw: 0.6, n: 3.6, ride: 0.24,
    axleF: 1.38, axleR: -1.32, track: 1.58, wheelR: 0.34, tireW: 0.24,
    noseH: 0.6, cowlH: 0.84, deckH: 0.9, tailStart: -1.75, tailKick: 0.05,
    zScreen: 0.62, zRoofF: -0.05, zRoofR: -0.72, zGlassEnd: -1.36, roofH: 1.31, roofW: 0.62,
    lamps: 'slim', tails: 'bar', wing: 'lip', exhaust: 'dual', pinstripe: null },
  // heavy V8 muscle: long, wide and boxy, a blunt high nose with quad lamps, a bonnet scoop, fastback, quad pipes
  halberd: { L: 4.86, half: 0.93, fF: 0.04, fFw: 0.45, fR: 0.07, fRw: 0.6, n: 6.0, ride: 0.27,
    axleF: 1.45, axleR: -1.35, track: 1.68, wheelR: 0.36, tireW: 0.27,
    noseH: 0.74, cowlH: 0.93, deckH: 0.95, tailStart: -1.85, tailKick: 0.18,
    zScreen: 0.52, zRoofF: -0.12, zRoofR: -0.62, zGlassEnd: -1.6, roofH: 1.37, roofW: 0.66,
    lamps: 'quad', tails: 'wide', wing: 'spoiler', scoop: true, exhaust: 'quad', pinstripe: null },
  // light rotary wedge: a knife-low nose with closed lamp pods, a bubble cabin, a single centre pipe
  orbit: { L: 4.3, half: 0.82, fF: 0.06, fFw: 0.38, fR: 0.08, fRw: 0.5, n: 3.2, ride: 0.22,
    axleF: 1.15, axleR: -1.28, track: 1.5, wheelR: 0.32, tireW: 0.23,
    noseH: 0.42, cowlH: 0.74, deckH: 0.8, tailStart: -1.62, tailKick: 0.12,
    zScreen: 0.78, zRoofF: 0.08, zRoofR: -0.42, zGlassEnd: -1.42, roofH: 1.17, roofW: 0.54,
    lamps: 'pods', tails: 'triple', wing: 'lip', exhaust: 'center', pinstripe: null },
  // wide twin-turbo GT: sharp, low and wide, slim quad lamps, side vents, a big wing on struts
  spectre: { L: 4.62, half: 0.9, fF: 0.08, fFw: 0.42, fR: 0.12, fRw: 0.55, n: 5.0, ride: 0.22,
    axleF: 1.4, axleR: -1.32, track: 1.72, wheelR: 0.35, tireW: 0.28,
    noseH: 0.5, cowlH: 0.82, deckH: 0.9, tailStart: -1.72, tailKick: 0.08,
    zScreen: 0.64, zRoofF: -0.06, zRoofR: -0.6, zGlassEnd: -1.5, roofH: 1.25, roofW: 0.6,
    lamps: 'slim', tails: 'slimbar', wing: 'gt', vents: true, exhaust: 'quad', pinstripe: null },
  // the endgame flat-six, engine behind: a sloping nose with big round lamps, wide hips, a long fastback to the tail
  zenith: { L: 4.5, half: 0.84, fF: 0.07, fFw: 0.4, fR: 0.15, fRw: 0.55, n: 3.4, ride: 0.22,
    axleF: 1.15, axleR: -1.3, track: 1.62, wheelR: 0.34, tireW: 0.27,
    noseH: 0.56, cowlH: 0.78, deckH: 0.96, tailStart: -1.5, tailKick: 0.02,
    zScreen: 0.74, zRoofF: 0.2, zRoofR: -0.3, zGlassEnd: -1.78, roofH: 1.25, roofW: 0.56,
    lamps: 'round', tails: 'bar', wing: 'duck', exhaust: 'center', pinstripe: '#ffb347' },
};
