// THE ROOTMIND's roll call (rule 29: the finale revisits every level's idea, in order). Act 1 brings back one wave from
// each level of the Deep, 1 to 9, using each builder's own kind from its own folder (LEVEL-API 12.1: the finales import
// everyone's kinds, never copy them).
// The other galaxy 2 builders are building in parallel tonight. A kind is imported only once it is listed in LANDED
// (it has merged into `galaxies` and its folder name is checked), so nothing missing is ever asked of the server. Until
// a slot's kind lands, the slot flies a galaxy 1 stand-in that keeps the music's time and asks the same thing of you
// (roll this, slip that), so the level always loads and plays.
import pod from '../../../enemies/pod/index.js?v=0.6.2';
import shrike from '../../../enemies/shrike/index.js?v=0.6.2';
import seeker from '../../../enemies/seeker-drone/index.js?v=0.6.2';
import swarm from '../../../enemies/swarm-unit/index.js?v=0.6.2';
import mines from '../../../obstacles/mines/index.js?v=0.6.2';
import crystal from '../../../obstacles/crystal/index.js?v=0.6.2';

// where each galaxy 2 kind will live (LEVEL-API 12.1's names); checked against the real folder when it merges
const SRC = {
  'g2-current': '../../../obstacles/g2-current/index.js', 'g2-drifter': '../../../enemies/g2-drifter/index.js',     // level 1
  'g2-shoal': '../../../pickups/g2-shoal/index.js', 'g2-gulper': '../../../enemies/g2-gulper/index.js',             // level 2
  'g2-thrummer': '../../../enemies/g2-thrummer/index.js',                                                            // level 3
  'g2-hound': '../../../enemies/g2-hound/index.js', 'g2-calf': '../../../allies/g2-calf/index.js',                  // level 4
  'g2-well': '../../../obstacles/g2-gravity-well/index.js', 'g2-slinger': '../../../enemies/g2-slinger/index.js',           // level 5
  'g2-leech': '../../../enemies/g2-leech/index.js',                                                                  // level 6
  'g2-bloomer': '../../../enemies/g2-bloomer/index.js',                                                              // level 7
  'g2-angler': '../../../enemies/g2-angler/index.js',                                                                // level 8
  'g2-flock': '../../../enemies/g2-flock/index.js',                                                                  // level 9
};
// the kinds merged into `galaxies` so far (updated at each merge). Slots 1-3 follow g2-a's own levels (merged at cbbdfec);
// slots 7-9 already follow g2-c's event shapes (its
// branch, 036cfe7: gated until it lands); slots 4-6 spawn from each kind's sample until its builder's shapes can be read.
export const LANDED = ['g2-current', 'g2-drifter', 'g2-shoal', 'g2-gulper', 'g2-thrummer',   // g2-a, merged at cbbdfec
  'g2-hound', 'g2-calf', 'g2-well', 'g2-slinger', 'g2-leech',   // g2-b, merged at 6b3411e (slot 5's well is g2-b's g2-gravity-well)
  'g2-bloomer', 'g2-angler', 'g2-flock'];   // g2-c, merged at ab0da85 and 2b5e951 (the integrator turned them on at g2-d's merge)
const GOT = {}, MOD = {}, EXTRA = [];   // MOD: each landed module whole (its timing constants: the hound's crossAfter, LEECH)
await Promise.all(LANDED.filter((k) => SRC[k]).map(async (key) => {
  try {
    const m = await import(SRC[key] + '?v=0.6.2'); if (m.default && m.default.name) { GOT[key] = m.default; MOD[key] = m; }
    // a module's other kinds go in the level's list too (the thrummer's pulse): anything the registry gave a role
    for (const v of Object.values(m)) if (v && v !== m.default && typeof v === 'object' && typeof v.name === 'string' && v.role && typeof v.update === 'function') EXTRA.push(v);
  } catch (e) { /* listed but not loadable: the stand-in flies */ }
}));
export const rollKinds = () => [pod, shrike, seeker, swarm, mines, crystal].concat(Object.values(GOT), EXTRA);
export const rollPresent = () => Object.keys(GOT);
// one of a landed kind at (nx, ny), from its own sample event (valid by construction: it warms its shaders with it)
function put(L, key, d, nx, ny, extra) {
  const k = GOT[key]; if (!k) return false;
  L.add(d, k.name, Object.assign({}, k.sample || {}, { nx, ny }, extra || {}));
  return true;
}
// each slot: (L, d, v, B, S) lays its wave from distance d, where the course runs at v m/s; B(k) is the course
// distance of the canopy part's bar line k bars on from d, S(s) the distance s seconds on (S.bar: a bar's seconds); stand-ins are spaced in
// seconds: a roll moment never closer than about a second to the next, three at most in any 3 s); rings lead through
// every wave, so the way is always shown
export const ROLL = {
  // 1 TIDEWAY: a cross current carries you over three bars; the rings are laid along the path it bends (left to
  // right), and a drifter rides it, showing where it carries things
  l1(L, d, v, B) {
    if (GOT['g2-current']) {
      const len = B(3) - d; L.add(d, 'g2-current', { len, fx: 0.4, seed: Math.round(d) });
      L.line(d + 20, -0.5, 0.05, 0.5, -0.05, 7, (len - 40) / 6);
      if (GOT['g2-drifter']) L.add(d + len * 0.55, 'g2-drifter', { nx: -0.2, ny: 0.55, s: 1 });
      return;
    }
    L.line(d, -0.6, -0.1, 0.6, 0.15, 7, 26);            // stand-in: the bent path alone
  },
  // 2 THE SHOALS: the rings swim; chase them (one school of eight, an S-curve, the same every run); then a gulper
  // cuts across behind it, wheels round and spits a pair back
  l2(L, d, v, B) {
    if (GOT['g2-shoal']) {
      const n = 8, gap = 22, K = [[0, -0.45, 0.25], [420, 0.4, -0.1], [800, 0.05, 0.1]];
      for (let i = 0; i < n; i++) L.add(d + i * gap, 'g2-shoal', { shoal: 'l10-S1', idx: i, of: n, gap, keys: K, off: [0.05 * Math.sin(i * 1.7), 0.04 * Math.cos(i * 1.3)] });
      if (GOT['g2-gulper']) L.add(d + n * gap + 1.6 * v, 'g2-gulper', { from: -1, cross: 0.55, ny: -0.1, span: 220, shots: 2 });
      return;
    }
    L.sine(d, 8, 20, 0.5, 0.35, 0.6);                   // stand-in: a weaving line of rings
  },
  // 3 THE DRUMREEF: roll through a pulse as it meets you. Two drums on the reef: each swells over a bar, beats on the
  // next bar line, and its pulse meets you on the one after; fly its hole (the rings are in it) or roll for a PARRY
  l3(L, d, v, B) {
    if (GOT['g2-thrummer']) {
      const drum = (beat, nx, ny, a, w) => L.add(B(beat + 1) + 150, 'g2-thrummer', { nx, ny, s: 3, pulses: [{ beat: B(beat), meet: B(beat + 1), tell: B(beat) - B(beat - 1), hole: { a, w } }] });
      const into = (meet, a) => { const hx = Math.cos(a) * 0.66, hy = Math.sin(a) * 0.68; L.line(B(meet) - 75, hx * 0.4, hy * 0.4, hx, hy, 4, 25); };
      drum(0, -1.8, 0.2, Math.PI, 1.7); into(1, Math.PI);
      drum(2, 1.8, 0.4, Math.PI / 2, 1.7); into(3, Math.PI / 2);
      return;
    }
    L.add(d, 'pod', { nx: 0.35, ny: 0.55, drift: -1, bursts: 2, shots: 2 }); L.add(d + 2.4 * v, 'pod', { nx: -0.35, ny: 0.5, drift: 1, bursts: 2, shots: 2 });
    L.line(d - 40, 0, -0.4, 0, -0.2, 4, 24);
  },
  // 4 THE MIGRATION: hounds hunt the calf; fly into the shots aimed at it. As g2-b's level 4 lays them: the calf swims
  // just outside the box on the left (side -1), a hound runs at the right edge (side 1, its own distance out) and its
  // two bolts cross the lane's middle a bar and a half in, and 2.2 s after; rings run in to each crossing (INTERCEPT!).
  // The calf goes home once the wave is past (a bright calf pays CALF SAFE).
  l4(L, d, v, B, S) {
    if (GOT['g2-hound'] && GOT['g2-calf']) {
      const tc = S.bar * 1.5, gap = 2.2, ca = MOD['g2-hound'].crossAfter, OUT = [-1.5, -0.1], hny = 0.2;
      L.add(d, GOT['g2-calf'].name, { side: -1, path: [[d, ...OUT]], home: S(tc + gap + 3) });
      L.add(S(tc - ca(0)), GOT['g2-hound'].name, { side: 1, ny: hny, shots: ['calf', 'calf'], gap });
      const cy = (hny + OUT[1]) / 2;
      for (const [k, from] of [[0, 0.35], [1, -0.3]]) L.line(S(tc + k * gap) - 44, 0, cy + from, 0, cy, 3, 22);
      return;
    }
    L.add(d, 'shrike', { side: 1, ny: 0.5, shots: 2 }); L.add(d + 1.8 * v, 'shrike', { side: -1, ny: -0.3, shots: 2 }); L.line(d - 30, 0, 0.1, 0, -0.1, 5, 24);
  },
  // 5 GRAVITY GARDEN: wells bend every path, shots too. A well just outside the box on the right (rn its reach), the
  // rings bent round it, then a slinger whose bolts the well bends, as g2-b's level 5 lays them
  l5(L, d, v) {
    if (GOT['g2-well']) {
      L.add(d, GOT['g2-well'].name, { nx: 1.6, ny: 0.1, rn: 0.45 }); L.line(d - 70, -0.3, 0.1, 0.25, 0, 6, 24);
      if (GOT['g2-slinger']) L.add(d + 1.4 * v, GOT['g2-slinger'].name, { nx: -0.6, ny: 0.55, swing: 1, shots: 2 });
      return;
    }
    L.add(d, 'crystal', { nx: -0.75, ny: 0.55, r: 1.8 }); L.add(d + 60, 'crystal', { nx: 0.7, ny: -0.5, r: 1.8 }); L.sine(d - 30, 6, 24, 0.35, 0.3, 1.6);
    L.add(d + 2.6 * v, 'pod', { nx: 0.4, ny: 0.6, drift: -0.8, bursts: 1, shots: 2 });
  },
  // 6 THE TANGLE: leeches latch a tether on; roll to snap it. Two, each swimming at its own edge (side +1, then -1; the
  // kind keeps its own distance out), placed so its tether latches on bars 31 and 32.5 (g2-b's level 6 lays them so)
  l6(L, d, v, B, S) {
    if (GOT['g2-leech']) {
      const Q = MOD['g2-leech'].LEECH, latch = Q.wait + Q.tel + Q.reach;
      L.add(S(S.bar - latch), GOT['g2-leech'].name, { side: 1, ny: 0.3 });
      L.add(S(2.5 * S.bar - latch), GOT['g2-leech'].name, { side: -1, ny: -0.2 });   // (not on bar 33: the crown's speed step)
      L.line(d - 20, 0, -0.4, 0, -0.3, 4, 24);
      return;
    }
    L.add(d, 'seeker-drone', { nx: 0.5, ny: 0.5, shots: 2 }); L.add(d + 2.2 * v, 'seeker-drone', { nx: -0.5, ny: 0.3, shots: 2 }); L.line(d - 20, 0, -0.4, 0, -0.3, 4, 24);
  },
  // 7 BLOOMFALL: roll a seed before it blooms. The Overclock barrage: a roll every 1.2-1.6 s for 7 s.
  // (g2-c's bloomer fires at its fireAt, 290 m out, so its seeds land on the moment it is laid for: d + 290)
  l7(L, d, v) {
    if (GOT['g2-bloomer']) {
      for (const [k, nx, ny] of [[0, -0.45, 0.5], [1.6, 0.45, 0.45], [3.2, 0, 0.6], [4.8, -0.3, -0.5]]) L.add(d + k * v + 290, 'g2-bloomer', { nx, ny, s: 1.2 });
      L.line(d - 20, 0, -0.3, 0, -0.5, 6, 26); return;
    }
    L.add(d, 'pod', { nx: -0.5, ny: 0.55, drift: 1.2, bursts: 2, shots: 3 }); L.add(d + 2.4 * v, 'pod', { nx: 0.5, ny: 0.5, drift: -1.2, bursts: 2, shots: 3 });
    L.add(d + 4.8 * v, 'pod', { nx: 0, ny: 0.65, drift: 0, bursts: 2, shots: 2 }); L.line(d - 20, 0, -0.3, 0, -0.5, 6, 26); L.sine(d + 2.4 * v, 6, 26, 0.35, 0.3, 0.4, 0, -0.2);
  },
  // 8 ANGLER'S DEEP: take the lure if you dare (the lure is the angler's own; never needed for a star)
  l8(L, d, v) {
    if (GOT['g2-angler']) { L.add(d, 'g2-angler', { key: 'l10-angler', kind: 'side', side: 1 }); L.line(d - 60, -0.5, 0, -0.5, 0.2, 4, 24); return; }
    L.add(d, 'mines', { nx: 0.35, ny: 0.1, n: 5 }); L.ring(d + 4, 0.35, 0.1, 'ring', { cache: true }); L.line(d - 60, -0.55, 0, -0.55, 0.2, 4, 24);
    L.add(d + 2.0 * v, 'shrike', { side: -1, ny: 0.45, shots: 2 });
  },
  // 9 THE MURMURATION: a flock flies as one shape; read the shape (a wall with one hole, the rings threaded through it)
  l9(L, d, v) {
    if (GOT['g2-flock']) { L.add(d, 'g2-flock', { key: 'l10-flock', shape: 'wall', hole: { nx: 0.2, ny: 0.05, r: 0.85 } }); L.line(d - 90, 0, 0, 0.2, 0.05, 5, 22); return; }
    L.add(d, 'swarm-unit', { n: 6, volleys: 1, aim: 'ship', side: 1, tel: 0.9 }); L.line(d - 20, 0, -0.5, 0, -0.5, 4, 24);
    L.add(d + 2.6 * v, 'pod', { nx: 0.45, ny: 0.55, drift: -1, bursts: 1, shots: 3 });
  },
};
