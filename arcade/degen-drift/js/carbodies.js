// DEGEN DRIFT: the six bodies, rebuilt from Portero's turnaround sheets (Exchange job 002, 2026-11-16; fictional
// cars, no real make, no badges). Each body is a set of numbers that carmesh.js builds in code:
//   top, plan   scanned from the sheet (tools/test/bodytables.mjs), centimetres every 5 cm from the nose (+L/2) to the
//               tail (-L/2): the side view's highest point (bonnet, roof, deck) and the top view's half width. The
//               side is the authority for lengths and heights, the top view for widths, scaled to the written width.
//   fix         where the scan sees a wing, a scoop or a splitter instead of the body: the body's own line there.
//   bot         the underside, read off the side view (the sheets' shadows hide it from the scan).
//   wheels      axle positions (side view), tyre and rim radius, tyre width, wheel-arch radius.
//   cabin       windscreen base, roof front and back, where the glass ends, the deck, the belt line, roof width.
//   sec         the cross-section: tuck under the sills, how high the widest point sits, tumblehome, bonnet crown,
//               a crisp shoulder crease or a smooth one.
//   front/rear  lamps, housings, grilles and intakes on the nose and tail (x across, y up, mirrored left/right).
//   the rest    wing, scoop, vents, louvres, splitter, diffuser, mirrors, exhausts, rims and the livery.
// The handling is not here: the physics reads data/cars.js only (its wheelbase included), so these are looks.
// Lengths in metres; z runs rear (-L/2) to front; x is left (+) and right; y is up from the road.
export const BODIES = {
  // light compact front-engine coupe (Portero's key art and sheet): a wedge nose with quad round lamps in black
  // housings, box flares, a fastback hatch, a raised ducktail wing, the cyan pinstripe, five-spoke silver rims
  kestrel: {
    L: 4.4, W: 1.85,
    top: [50,54,58,63,69,70,72,74,76,78,80,81,83,84,86,87,88,89,90,91,92,93,94,94,95,95,96,96,97,98,100,101,105,107,110,113,116,119,122,125,127,130,133,135,138,139,140,140,140,140,140,140,140,140,140,140,140,140,140,139,139,138,138,137,135,132,131,129,126,124,122,120,117,115,113,111,108,110,113,114,115,116,116,117,117,117,117,67,64],
    plan: [32,64,69,72,74,76,78,80,81,83,84,86,88,90,92,92,93,93,94,94,94,94,94,94,93,93,92,91,89,88,88,88,88,87,88,91,97,97,97,87,87,88,88,88,88,87,87,88,87,87,87,87,88,88,88,87,87,88,88,88,87,87,88,90,91,92,93,93,94,93,93,93,92,92,91,91,89,87,86,84,83,82,80,79,77,76,74,69,13],
    fix: [[[-1.6, 1.08], [-2.06, 1.0], [-2.14, 0.9]]],
    mirror: 0.35,
    bot: [[2.2, 0.14], [2.12, 0.12], [1.5, 0.125], [-1.72, 0.13], [-1.78, 0.2], [-2.05, 0.27], [-2.12, 0.38], [-2.2, 0.5]],
    wheels: { f: 1.19, r: -1.42, R: 0.355, rim: 0.29, tw: 0.25, arch: 0.405 },
    cabin: { screen: 0.78, roofF: 0.0, roofR: -0.95, glassEnd: -1.55, deck: -1.62, belt: [[0.4, 0.965], [-1.0, 0.98]], roofW: 0.5, inset: 0.1, bpillar: -0.62, quarter: -1.3 },
    sec: { tuck: 0.06, wpos: 0.5, tumble: 0.035, crown: 0.03, round: 0.05, crease: true },
    doors: [0.55, -0.74],
    front: [
      { t: 'pod', x0: 0.34, x1: 0.77, y0: 0.565, y1: 0.725, tilt: 0.3, lamps: [[0.455, 0.645, 0.066], [0.64, 0.645, 0.066]] },
      { t: 'box', x0: -0.78, x1: 0.78, y0: 0.27, y1: 0.39 },
    ],
    rear: [
      { t: 'tbox', x0: 0.23, x1: 0.65, y0: 0.72, y1: 0.86 }, { t: 'box', x0: 0.22, x1: 0.66, y0: 0.785, y1: 0.795 },
      { t: 'box', x0: -0.2, x1: 0.2, y0: 0.47, y1: 0.56 },
    ],
    exhaust: { y: 0.29, r: 0.055, x: [0.45] },
    wing: { t: 'duck', z0: -1.66, z1: -2.1, y0: 1.11, y1: 1.165, span: 0.68, th: 0.035, stands: [0.48], plates: true, paint: true },
    livery: [
      { t: 'line', col: '#36f2ff', w: 0.016, glow: true, pts: [[2.02, 0.6], [1.56, 0.695]] },
      { t: 'line', col: '#36f2ff', w: 0.016, glow: true, pts: [[0.8, 0.715], [-0.2, 0.745], [-1.02, 0.775]] },
      { t: 'line', col: '#36f2ff', w: 0.016, glow: true, pts: [[-1.84, 0.78], [-2.12, 0.78]] },
    ],
    rims: { style: 'five', col: '#c9ccd4', cap: '#d0202e' },
    headTint: [1.0, 0.86, 0.62], lampHalo: [[0.55, 0.645]], tailHalo: [[0.44, 0.79]],
  },
  // smooth, balanced straight-six GT: a very long bonnet, slim lamps with an amber edge, the cabin set back on a long
  // fastback, a lip on the tail, the gold pinstripe, fifteen-spoke silver rims
  vanta: {
    L: 4.65, W: 1.9,
    top: [64,68,72,75,78,80,83,85,87,89,91,92,94,95,96,97,98,99,100,100,101,101,102,102,102,103,103,103,104,105,105,105,105,106,106,108,111,114,117,120,123,126,129,131,134,137,139,141,143,144,145,146,146,147,147,147,147,147,147,147,147,147,146,146,145,144,144,143,141,140,138,137,135,133,132,130,127,125,124,122,120,117,115,113,113,114,115,115,116,116,116,100,85,66],
    plan: [7,42,60,69,75,79,81,83,85,86,88,90,91,92,94,95,95,96,96,97,97,96,97,96,96,96,96,96,95,94,94,93,93,93,93,93,92,92,93,93,94,100,102,102,93,93,93,93,93,93,93,93,93,93,93,93,93,93,93,93,93,93,93,93,93,93,94,94,95,96,96,96,96,96,95,94,94,93,93,92,91,89,88,87,86,84,83,81,79,76,74,66,51,12],
    fix: [[[-1.76, 1.14], [-1.98, 1.03], [-2.2, 0.98], [-2.27, 0.85]]],
    mirror: 0.2,
    bot: [[2.32, 0.5], [2.27, 0.2], [2.15, 0.17], [1.6, 0.15], [-1.95, 0.17], [-2.1, 0.22], [-2.25, 0.3], [-2.32, 0.5]],
    wheels: { f: 1.19, r: -1.54, R: 0.365, rim: 0.31, tw: 0.245, arch: 0.412 },
    cabin: { screen: 0.64, roofF: -0.12, roofR: -0.75, glassEnd: -1.72, deck: -1.8, belt: [[0.3, 1.0], [-1.3, 0.99]], roofW: 0.5, inset: 0.12, bpillar: -0.75, quarter: -1.32 },
    sec: { tuck: 0.08, wpos: 0.45, tumble: 0.05, crown: 0.045, round: 0.09, crease: false },
    doors: [0.5, -0.82],
    front: [
      { t: 'line', w: 0.045, pts: [[0.4, 0.585], [0.6, 0.59], [0.73, 0.62]] },
      { t: 'aline', w: 0.012, pts: [[0.4, 0.565], [0.62, 0.57], [0.74, 0.6]] },
      { t: 'box', x0: -0.56, x1: 0.56, y0: 0.27, y1: 0.42 },
    ],
    rear: [
      { t: 'tline', w: 0.034, pts: [[0.24, 0.83], [0.63, 0.84]] },
      { t: 'box', x0: -0.22, x1: 0.22, y0: 0.46, y1: 0.55 },
    ],
    exhaust: { y: 0.27, r: 0.05, x: [0.45] },
    wing: { t: 'lip', z0: -1.9, z1: -2.24, y0: 1.06, y1: 1.12, span: 0.66, th: 0.035, paint: true },
    livery: [
      { t: 'line', col: '#e8c46a', w: 0.012, glow: true, pts: [[1.0, 0.78], [-0.5, 0.82], [-1.25, 0.84]] },
      { t: 'line', col: '#e8c46a', w: 0.012, glow: true, pts: [[-1.95, 0.86], [-2.2, 0.865]] },
    ],
    rims: { style: 'multi', col: '#cdd0d7', cap: '#b89a52' },
    headTint: [1.0, 0.9, 0.72], lampHalo: [[0.58, 0.59]], tailHalo: [[0.44, 0.835]],
  },
  // heavy V8 muscle: long, wide and boxy, a blunt high nose, quad round lamps in square housings beside a black grille,
  // a raised scoop, twin black stripes over the bonnet and nose, a louvred quarter, a spoiler on posts, quad pipes
  halberd: {
    L: 4.6, W: 1.98,
    top: [54,77,82,86,88,89,90,92,93,94,96,97,98,99,99,100,101,113,114,114,115,115,115,115,115,115,115,115,115,115,114,113,108,107,107,109,112,115,118,121,125,127,131,134,137,140,143,147,148,149,149,149,149,149,149,149,149,149,149,149,149,149,149,149,149,149,149,148,148,147,147,145,142,139,136,132,128,125,122,118,114,113,120,120,120,120,121,121,121,121,121,88,65],
    plan: [55,71,76,79,80,83,84,85,87,88,89,92,96,97,98,99,99,99,99,100,100,100,100,100,100,99,99,98,96,94,94,93,93,93,93,93,93,100,104,104,93,92,92,92,93,92,92,92,92,92,92,92,92,92,92,92,92,92,92,92,93,93,93,94,96,98,99,99,100,100,100,100,100,99,99,99,99,98,98,97,94,90,89,87,87,85,84,82,81,79,77,73,27],
    fix: [[[2.3, 0.8], [2.25, 0.81]], [[1.52, 1.012], [0.72, 1.075]], [[-1.74, 1.12], [-1.84, 1.035], [-2.24, 0.975], [-2.28, 0.9]]],
    mirror: 0.42,
    bot: [[2.3, 0.15], [2.24, 0.13], [1.6, 0.14], [-1.88, 0.14], [-1.98, 0.24], [-2.2, 0.28], [-2.3, 0.32]],
    wheels: { f: 1.22, r: -1.48, R: 0.37, rim: 0.3, tw: 0.27, arch: 0.425 },
    cabin: { screen: 0.6, roofF: -0.02, roofR: -1.08, glassEnd: -1.68, deck: -1.74, belt: [[0.3, 1.02], [-1.1, 1.035]], roofW: 0.56, inset: 0.1, bpillar: -0.78, quarter: -1.0 },
    sec: { tuck: 0.04, wpos: 0.62, tumble: 0.02, crown: 0.02, round: 0.03, crease: true },
    doors: [0.5, -0.82],
    front: [
      { t: 'pod', x0: 0.53, x1: 0.88, y0: 0.56, y1: 0.745, tilt: 0.05, lamps: [[0.625, 0.652, 0.064], [0.785, 0.652, 0.064]] },
      { t: 'box', x0: -0.48, x1: 0.48, y0: 0.575, y1: 0.74 },
      { t: 'box', x0: -0.9, x1: 0.9, y0: 0.26, y1: 0.41 },
    ],
    rear: [
      { t: 'tbox', x0: 0.27, x1: 0.8, y0: 0.73, y1: 0.885 }, { t: 'box', x0: 0.26, x1: 0.81, y0: 0.8, y1: 0.812 },
      { t: 'box', x0: -0.22, x1: 0.22, y0: 0.47, y1: 0.57 },
    ],
    exhaust: { y: 0.32, r: 0.05, x: [0.43, 0.61] },
    wing: { t: 'post', z0: -1.86, z1: -2.24, y0: 1.13, y1: 1.18, span: 0.84, th: 0.04, stands: [0.6], plates: true, paint: true },
    scoop: { z0: 1.52, z1: 0.74, w: 0.17, h: 0.11 },
    louvres: [{ t: 'side', z0: -1.02, z1: -1.52, y0: 1.1, y1: 1.36, n: 6 }],
    livery: [
      { t: 'top', col: '#0d0a0e', x0: 0.075, x1: 0.3, z0: 2.3, z1: 0.62 },
      { t: 'front', col: '#0d0a0e', x0: 0.075, x1: 0.3, y0: 0.745, y1: 0.86 },
    ],
    rims: { style: 'five', col: '#8b8f97', cap: '#2a2b30', lip: '#e2e5ea', dish: true },
    headTint: [1.0, 0.86, 0.6], lampHalo: [[0.7, 0.652]], tailHalo: [[0.54, 0.81]],
  },
  // light rotary coupe: a soft wedge with twin round lamps in teardrop housings, a bubble cabin on a short fastback,
  // an integrated ducktail, side intakes, twin centre pipes, six-spoke silver rims
  orbit: {
    L: 4.25, W: 1.8,
    top: [48,54,59,63,67,70,73,76,79,80,82,84,86,87,89,90,91,93,94,95,96,96,97,98,99,99,99,101,101,103,105,106,109,112,114,117,120,122,124,126,128,131,133,135,137,138,139,139,139,139,139,139,139,139,139,139,139,139,139,138,137,136,134,132,131,129,127,126,125,123,121,119,117,115,113,111,109,108,106,105,105,104,104,105,106,72],
    plan: [22,40,47,54,61,66,69,71,73,76,77,79,81,82,84,85,85,86,86,86,86,86,87,87,86,86,86,86,85,86,85,86,86,86,86,89,96,98,98,86,86,86,86,86,85,85,85,85,85,85,85,85,85,85,85,85,85,85,86,86,85,85,85,86,86,86,86,86,86,86,85,85,84,83,81,79,78,76,75,73,71,70,68,64,52,20],
    fix: [],
    mirror: 0.27,
    bot: [[2.125, 0.44], [2.07, 0.18], [1.9, 0.17], [1.5, 0.16], [-1.84, 0.2], [-1.92, 0.24], [-2.02, 0.28], [-2.09, 0.36], [-2.125, 0.6]],
    wheels: { f: 1.065, r: -1.458, R: 0.37, rim: 0.3, tw: 0.24, arch: 0.418 },
    cabin: { screen: 0.64, roofF: -0.12, roofR: -0.8, glassEnd: -1.72, deck: -1.8, belt: [[0.3, 0.975], [-1.3, 0.98]], roofW: 0.48, inset: 0.12, bpillar: -0.72, quarter: -1.32 },
    sec: { tuck: 0.08, wpos: 0.45, tumble: 0.055, crown: 0.045, round: 0.09, crease: false },
    doors: [0.5, -0.82],
    front: [
      { t: 'ell', x: 0.6, y: 0.632, rx: 0.17, ry: 0.082, a: 0.22 },
      { t: 'disc', x: 0.53, y: 0.622, r: 0.05 }, { t: 'disc', x: 0.665, y: 0.648, r: 0.05 },
      { t: 'ell', x: 0, y: 0.3, rx: 0.37, ry: 0.075, a: 0 },
      { t: 'ell', x: 0.64, y: 0.33, rx: 0.1, ry: 0.05, a: -0.2 },
    ],
    rear: [
      { t: 'tbox', x0: 0.28, x1: 0.66, y0: 0.77, y1: 0.87 }, { t: 'box', x0: 0.27, x1: 0.67, y0: 0.818, y1: 0.828 },
      { t: 'ell', x: 0.66, y: 0.48, rx: 0.1, ry: 0.035, a: 0 },
    ],
    exhaust: { y: 0.27, r: 0.045, x: [0.065] },
    vents: [{ z0: -0.8, z1: -1.0, y0: 0.29, y1: 0.42, fins: 0 }],
    livery: [],
    rims: { style: 'six', col: '#d2d5dc', cap: '#9a9da5' },
    headTint: [1.0, 0.88, 0.66], lampHalo: [[0.6, 0.635]], tailHalo: [[0.47, 0.82]],
  },
  // wide twin-turbo GT: a sharp low nose with slim angular lamps and big intakes, a splitter, bonnet vents, a side
  // intake before each rear wheel, a louvred deck, a GT wing on swan necks with magenta end plates, the white,
  // magenta and cyan livery, dark five-spoke rims with magenta centres
  spectre: {
    L: 4.5, W: 2.0,
    top: [12,14,58,62,66,69,73,76,78,81,84,86,88,90,91,93,94,95,97,97,98,98,99,99,100,100,100,101,101,102,102,103,105,105,108,111,114,117,119,122,124,127,130,133,135,137,137,138,138,139,139,139,139,139,139,138,138,138,137,137,136,136,135,134,132,129,127,125,123,122,119,117,115,113,111,109,143,146,147,147,148,148,148,149,150,150,150,150,150,150,150],
    plan: [28,55,68,72,76,79,83,87,91,91,91,92,93,92,92,93,94,94,94,94,94,94,95,95,95,95,94,94,93,91,90,89,88,88,88,88,93,96,98,88,88,88,88,87,87,87,87,88,88,87,87,88,88,88,87,88,88,89,89,89,90,90,91,91,92,93,94,95,95,94,94,94,95,95,95,95,94,94,92,92,90,88,86,85,83,82,80,79,79,79,65],
    fix: [[[2.25, 0.52], [2.15, 0.58]], [[-1.5, 1.09], [-1.6, 1.045], [-2.18, 0.93], [-2.25, 0.86]]],
    mirror: 0.4,
    bot: [[2.25, 0.24], [2.18, 0.13], [1.6, 0.11], [-1.86, 0.11], [-2.0, 0.17], [-2.18, 0.2], [-2.25, 0.3]],
    wheels: { f: 1.077, r: -1.41, R: 0.375, rim: 0.3, tw: 0.29, arch: 0.422 },
    cabin: { screen: 0.6, roofF: -0.1, roofR: -0.85, glassEnd: -1.15, deck: -1.5, belt: [[0.3, 1.0], [-1.2, 1.02]], roofW: 0.5, inset: 0.12, bpillar: -0.57, quarter: -1.18 },
    sec: { tuck: 0.1, wpos: 0.5, tumble: 0.06, crown: 0.04, round: 0.06, crease: true },
    doors: [0.5, -0.6],
    front: [
      { t: 'line', w: 0.07, pts: [[0.46, 0.645], [0.66, 0.625], [0.84, 0.69]] },
      { t: 'box', x0: 0.36, x1: 0.86, y0: 0.15, y1: 0.47 },
      { t: 'box', x0: -0.3, x1: 0.3, y0: 0.17, y1: 0.37 },
    ],
    rear: [
      { t: 'tline', w: 0.06, pts: [[0.2, 0.865], [0.5, 0.86], [0.72, 0.84]] },
      { t: 'tbox', x0: -0.09, x1: 0.09, y0: 0.43, y1: 0.47 },
    ],
    exhaust: { y: 0.27, r: 0.062, x: [0.45] },
    splitter: { z0: 2.28, z1: 1.55, y: 0.06, w: 0.93 },
    diffuser: { y0: 0.1, y1: 0.42, x: 0.62, fins: 5 },
    wing: { t: 'swan', z0: -1.58, z1: -2.2, y0: 1.4, y1: 1.5, span: 0.95, th: 0.04, stands: [0.31], plates: true, plateCol: '#e0219a', paint: false },
    vents: [{ z0: -0.6, z1: -1.0, y0: 0.25, y1: 0.62, fins: 4 }, { z0: 0.56, z1: 0.4, y0: 0.4, y1: 0.62, fins: 2 }],
    tvents: [{ z0: 1.82, z1: 1.25, x0: 0.28, x1: 0.55, n: 4 }],
    louvres: [{ t: 'top', z0: -1.16, z1: -1.72, x: 0.38, n: 8 }],
    livery: [
      { t: 'flank', col: '#e0219a', lo: [[1.72, 0.6], [1.45, 0.74], [1.05, 0.78], [0.45, 0.76], [-0.5, 0.8], [-1.0, 0.8], [-1.6, 0.79], [-2.22, 0.78]],
        hi: [[1.72, 0.7], [1.45, 0.83], [1.05, 0.86], [0.45, 0.85], [-0.5, 0.88], [-1.0, 0.9], [-1.6, 0.88], [-2.22, 0.86]] },
      { t: 'flank', col: '#22c4dc', lo: [[1.68, 0.5], [1.45, 0.68], [1.05, 0.71], [0.45, 0.665], [-0.5, 0.69], [-1.0, 0.71], [-1.6, 0.715], [-2.22, 0.715]],
        hi: [[1.68, 0.585], [1.45, 0.735], [1.05, 0.772], [0.45, 0.752], [-0.5, 0.795], [-1.0, 0.795], [-1.6, 0.785], [-2.22, 0.775]] },
      { t: 'top', col: '#e0219a', x0: -0.1, x1: 0.1, z0: 2.22, z1: 0.62 }, { t: 'top', col: '#22c4dc', x0: 0.105, x1: 0.15, z0: 2.22, z1: 0.62 },
      { t: 'top', col: '#e0219a', x0: -0.1, x1: 0.1, z0: -0.1, z1: -1.14 }, { t: 'top', col: '#22c4dc', x0: 0.105, x1: 0.15, z0: -0.1, z1: -1.14 },
      { t: 'rear', col: '#e0219a', x0: -0.2, x1: 0.2, y0: 0.84, y1: 0.885 },
    ],
    rims: { style: 'fived', col: '#7a7e87', cap: '#e0219a', lip: '#c4c8d0' },
    headTint: [0.92, 0.95, 1.0], lampHalo: [[0.64, 0.645]], tailHalo: [[0.46, 0.855]],
  },
  // the endgame flat-six, engine behind: a low sloping nose with slim angular lamps, nose vents, a louvred fastback
  // over the engine, a swan-neck wing, side blades, quad pipes in a diffuser, the orange stripe, turbine rims
  zenith: {
    L: 4.4, W: 1.95,
    top: [16,51,55,60,64,67,70,73,75,77,79,81,82,84,85,86,87,88,89,90,91,92,92,93,93,94,94,94,96,97,99,101,104,107,110,112,115,118,120,123,125,126,129,131,132,133,133,134,134,134,134,134,134,134,134,134,133,133,132,132,131,130,130,129,127,126,125,124,122,121,119,118,116,114,112,119,122,123,125,125,126,127,128,128,129,128,128,89,67],
    plan: [19,47,60,66,70,74,75,77,79,81,82,84,85,88,90,91,91,91,92,92,91,91,91,91,90,90,89,87,86,86,85,85,85,85,86,94,97,97,97,85,85,85,85,85,85,85,85,85,85,85,85,85,85,85,85,85,85,85,85,86,87,88,89,90,91,91,91,91,91,91,92,91,91,91,90,90,89,88,87,85,83,82,81,79,77,75,72,64,13],
    fix: [[[2.2, 0.47], [2.15, 0.51]], [[-1.5, 1.12], [-1.62, 1.0], [-2.12, 0.93], [-2.2, 0.82]]],
    mirror: 0.42,
    bot: [[2.2, 0.15], [2.12, 0.12], [1.5, 0.12], [-1.8, 0.13], [-1.95, 0.16], [-2.1, 0.2], [-2.2, 0.3]],
    wheels: { f: 1.09, r: -1.48, R: 0.372, rim: 0.31, tw: 0.28, arch: 0.42 },
    cabin: { screen: 0.72, roofF: -0.1, roofR: -0.6, glassEnd: -0.98, deck: -1.5, belt: [[0.3, 0.95], [-1.0, 0.96]], roofW: 0.48, inset: 0.12, bpillar: -0.57, quarter: -1.0 },
    sec: { tuck: 0.09, wpos: 0.5, tumble: 0.05, crown: 0.035, round: 0.07, crease: true },
    doors: [0.5, -0.6],
    front: [
      { t: 'line', w: 0.045, pts: [[0.47, 0.62], [0.7, 0.6], [0.85, 0.665]] },
      { t: 'line', w: 0.014, pts: [[0.5, 0.585], [0.72, 0.575]] },
      { t: 'box', x0: -0.82, x1: 0.82, y0: 0.2, y1: 0.45 },
    ],
    rear: [
      { t: 'tline', w: 0.034, pts: [[0.25, 0.8], [0.62, 0.795], [0.76, 0.775]] },
      { t: 'box', x0: -0.24, x1: 0.24, y0: 0.5, y1: 0.58 },
    ],
    exhaust: { y: 0.31, r: 0.05, x: [0.42, 0.56] },
    splitter: { z0: 2.24, z1: 1.7, y: 0.1, w: 0.86 },
    diffuser: { y0: 0.12, y1: 0.4, x: 0.66, fins: 5 },
    wing: { t: 'swan', z0: -1.58, z1: -2.08, y0: 1.18, y1: 1.27, span: 0.86, th: 0.04, stands: [0.36], plates: true, paint: true },
    vents: [{ z0: -0.66, z1: -1.06, y0: 0.2, y1: 0.45, fins: 3 }],
    tvents: [{ z0: 2.02, z1: 1.8, x0: 0.42, x1: 0.66, n: 3 }],
    louvres: [{ t: 'top', z0: -0.8, z1: -1.5, x: 0.46, n: 10 }],
    livery: [
      { t: 'line', col: '#ff8a1e', w: 0.026, glow: true, pts: [[1.64, 0.615], [1.42, 0.635]] },
      { t: 'line', col: '#ff8a1e', w: 0.03, glow: true, pts: [[0.96, 0.712], [0.0, 0.725], [-1.02, 0.735]] },
      { t: 'line', col: '#ff8a1e', w: 0.022, glow: true, pts: [[-1.76, 0.74], [-1.98, 0.745]] },
    ],
    rims: { style: 'turbine', col: '#c2ad8c', cap: '#8d8f96' },
    headTint: [0.92, 0.95, 1.0], lampHalo: [[0.66, 0.615]], tailHalo: [[0.5, 0.795]],
  },
};

// ---------------------------------------------------------------- the shape of one body (pure numbers, no three.js)
const lerp = (a, b, t) => a + (b - a) * t;
// piecewise-linear through [[z, v], ...] (any order), held flat past the ends
function pl(pts) {
  const p = pts.slice().sort((a, b) => b[0] - a[0]);
  return (z) => {
    if (z >= p[0][0]) return p[0][1];
    for (let i = 0; i < p.length - 1; i++) if (z >= p[i + 1][0]) return lerp(p[i][1], p[i + 1][1], (p[i][0] - z) / (p[i][0] - p[i + 1][0]));
    return p[p.length - 1][1];
  };
}
// a scanned table (centimetres every 5 cm from +L/2 to -L/2) as a function of z, in metres
function tab(arr, L) {
  const n = arr.length, step = L / (n - 1);
  return (z) => { const t = (L / 2 - z) / step, i = Math.max(0, Math.min(n - 2, Math.floor(t))), f = Math.max(0, Math.min(1, t - i)); return lerp(arr[i], arr[i + 1], f) / 100; };
}

export function shapeOf(B) {
  const L = B.L, zF = L / 2, zR = -L / 2, C = B.cabin, Wh = B.wheels, sec = B.sec;
  // the scans, cleaned (the wing, scoop and splitter replaced by the body's line, the mirror cut out of the plan) and
  // lightly smoothed (a painting's edge wobbles by a pixel or two; on a mirror-finish paint that reads as ripples)
  const fixes = (B.fix || []).map((f) => ({ a: Math.min(...f.map((p) => p[0])), b: Math.max(...f.map((p) => p[0])), fn: pl(f) }));
  const zAt = (i, n) => L / 2 - i * L / (n - 1);
  const smooth = (arr, r) => arr.map((v, i) => { if (i < 3 || i > arr.length - 4) return v; let s = 0, w = 0; for (let k = -r; k <= r; k++) { const j = i + k, q = r + 1 - Math.abs(k); s += arr[j] * q; w += q; } return s / w; });
  const topArr = B.top.map((v, i) => { const z = zAt(i, B.top.length); for (const f of fixes) if (z >= f.a && z <= f.b) return f.fn(z) * 100; return v; });
  const m0 = B.mirror + 0.13, m1 = B.mirror - 0.13, np = B.plan.length, i0 = Math.ceil((L / 2 - m0) / L * (np - 1)) - 1, i1 = Math.floor((L / 2 - m1) / L * (np - 1)) + 1;
  const planArr = B.plan.map((v, i) => (i > i0 && i < i1 ? lerp(B.plan[i0], B.plan[i1], (i - i0) / (i1 - i0)) : v));
  const rawTop = tab(smooth(topArr, 1), L), cutPlan = tab(smooth(planArr, 3), L);
  const top = (z) => { for (const f of fixes) if (z >= f.a && z <= f.b) return f.fn(z); return rawTop(z); };
  // the plan, scaled to the written width
  let pmax = 0; for (let z = zR; z <= zF; z += 0.01) pmax = Math.max(pmax, cutPlan(z));
  const sx = (B.W / 2) / pmax;
  const plan = (z) => Math.max(0.04, cutPlan(z) * sx);
  // the belt (side glass bottom) and the shoulder: in the cabin's span the belt line, elsewhere just under the crown
  const crown = sec.crown;
  const belt = pl([[C.screen, top(C.screen) - crown], ...C.belt, [C.deck, top(C.deck) - crown]]);
  const inCab = (z) => z < C.screen && z > C.deck;
  const shoulder = (z) => (inCab(z) ? belt(z) : top(z) - crown);
  const crownY = (z) => shoulder(z) + crown;
  // wheels and their arches
  const axles = [Wh.f, Wh.r];
  const archY = (z) => { let y = -1; for (const a of axles) { const d = z - a; if (Math.abs(d) < Wh.arch) y = Math.max(y, Wh.R + Math.sqrt(Wh.arch * Wh.arch - d * d)); } return y; };
  const botRaw = pl(B.bot);
  const bot = (z) => Math.min(Math.max(botRaw(z), archY(z)), shoulder(z) - 0.07);
  const track = (z) => 2 * (plan(z) - Wh.tw / 2 - 0.012);
  // the lower body's half section at z, left side (x >= 0), bottom centre round to the crown (kept per z: the nose
  // and tail searches below ask for the same stations again and again)
  const memo = (fn) => { const m = new Map(); return (z) => { const k = Math.round(z * 1e4); let v = m.get(k); if (!v) { v = fn(k / 1e4); m.set(k, v); } return v; }; };
  const ring = memo((z) => {
    const w = plan(z), yb = Math.min(botRaw(z), shoulder(z) - 0.07), ys = shoulder(z), yt = crownY(z), h = Math.max(0.02, ys - yb);
    const ws = w * (1 - sec.tumble), wr = w * (1 - sec.tuck), rnd = Math.min(sec.round, ws * 0.3), ya = bot(z);
    const lift = (p) => (p[1] < ya ? [p[0], ya] : p);
    return [
      [0, yb], [wr * 0.9, yb], [wr, yb + Math.min(0.035, h * 0.12)], [w * (1 - sec.tuck * 0.35), yb + h * sec.wpos * 0.5],
      [w, yb + h * sec.wpos], [w * (1 - sec.tumble * 0.45), ys - h * 0.14], [ws, ys],
      [ws - rnd, ys + crown * 0.45], [ws * 0.55, yt - crown * 0.1], [0, yt],
    ].map(lift);
  });
  // the cabin's half section (z inside the cabin's span): from the belt, in by the tumblehome, to the roof
  const roofTop = (z) => Math.max(top(z), shoulder(z) + 0.004);
  const cabRing = memo((z) => {
    const yb = shoulder(z), yr = roofTop(z), wB = plan(z) * (1 - sec.tumble) - C.inset, hh = yr - yb;
    const wR = Math.min(wB, C.roofW + Math.max(0, 0.32 - hh) * 0.6);
    return [[wB, yb - 0.004], [lerp(wB, wR, 0.55) + 0.02, yb + hh * 0.55], [wR, yr - Math.min(0.06, hh * 0.5)], [wR * 0.62, yr - Math.min(0.014, hh * 0.1)], [0, yr]];
  });
  // the outer x of the skin at height y (the lower body, and the cabin above the belt), or -1 off the car there
  const halfOf = (pts, y) => { let x = -1; for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; if ((y - y0) * (y - y1) <= 0 && y0 !== y1) x = Math.max(x, lerp(x0, x1, (y - y0) / (y1 - y0))); else if (y0 === y1 && Math.abs(y - y0) < 1e-4) x = Math.max(x, x0, x1); } return x; };
  const halfAt = (z, y) => { let x = halfOf(ring(z), y); if (inCab(z) && y >= shoulder(z)) x = Math.max(x, halfOf(cabRing(z), y)); return x; };
  // the height of the top surface at lateral x
  const yOf = (pts, x) => { let y = -1; for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; if ((x - x0) * (x - x1) <= 0 && x0 !== x1) y = Math.max(y, lerp(y0, y1, (x - x0) / (x1 - x0))); } return y; };
  const topAt = (z, x) => { const ax = Math.abs(x); let y = yOf(ring(z).slice(5), ax); if (inCab(z)) y = Math.max(y, yOf(cabRing(z), ax)); return y; };
  // the frontmost (tail: rearmost) z where the skin reaches (x, y): for lamps, grilles and stripes on the nose and tail
  const contains = (z, x, y) => halfAt(z, y) >= Math.abs(x);
  const frontAt = (x, y) => { for (let z = zF; z > zF - 1.2; z -= 0.004) if (contains(z, x, y)) return z; return zF - 1.2; };
  const rearAt = (x, y) => { for (let z = zR; z < zR + 1.2; z += 0.004) if (contains(z, x, y)) return z; return zR + 1.2; };
  return { B, L, zF, zR, top, plan, belt, shoulder, crownY, bot, archY, track, ring, cabRing, roofTop, inCab, halfAt, topAt, frontAt, rearAt };
}

// the side outline for the drawings (the Cars tab's profiles, the ghost): the body's silhouette nose to tail and back
// along the underside with its arches, the side glass, the wheels, the wing; z forward, h up, metres
export function outlineOf(B) {
  const S = shapeOf(B), C = B.cabin, out = [], glass = [];
  for (let z = S.zF; z >= S.zR - 1e-6; z -= 0.05) out.push([z, Math.max(S.top(z), S.crownY(z))]);
  for (let z = S.zR; z <= S.zF + 1e-6; z += 0.05) out.push([z, S.bot(z)]);
  const a = C.screen - 0.06, q = C.quarter;
  for (let z = a; z >= q; z -= 0.05) glass.push([z, S.belt(z) + 0.03]);
  for (let z = q; z <= a; z += 0.05) glass.push([z, Math.max(S.belt(z) + 0.035, S.roofTop(z) - 0.055)]);
  const W = B.wing ? [[B.wing.z0, B.wing.y0], [B.wing.z1, B.wing.y1]] : null;
  return { body: out, glass, wheels: [[B.wheels.f, B.wheels.R], [B.wheels.r, B.wheels.R]], wing: W, wingKind: B.wing ? B.wing.t : null };
}
