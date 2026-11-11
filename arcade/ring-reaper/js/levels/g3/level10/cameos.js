// THE WEFTWORK's roll call (rule 29: the finale revisits every level's idea, in order, as a test). Act 1, THE WARP, brings
// back one wave from each of galaxy 3's levels 1 to 9: blueprints, shuttles, locks, augurs, plotters, forgeries,
// riveters, fractals, vaults. Each wave uses the other builder's OWN kind from its own folder (LEVEL-API 12.1: the finale
// imports everyone's kinds, it never copies them), spawned from that kind's own `sample` event with only its place
// changed, so it is a valid event by construction.
//
// LANDED says which kinds are merged on `galaxies`. Only those are imported, so nothing missing is ever asked of the
// server (no 404 in the console). A wave whose kind is not in yet plays a placeholder of galaxy 1's kinds that asks the
// same skill, so the level always loads and plays. When a builder's kind lands: set its flag to true. That is the whole
// swap.
const LANDED = {
  'g3-blueprint-wall': true,  // g3-a, level 1 THE SCAFFOLD
  'g3-shuttler': true,        // g3-a, level 2 THE LOOM FLOOR
  'g3-lockgate': true,        // g3-a, level 3 THE LOCKWORKS
  'g3-augur': true,           // g3-b, level 4 THE AUGURY
  'g3-plotter': true,         // g3-b, level 5 THE DRAFTING HALL
  'g3-forgery': true,         // g3-b, level 6 THE FORGERY
  'g3-forge-turret': true,    // g3-b, level 6 (the forgeries' keyed turret)
  'g3-riveter': true,         // g3-c, level 7 THE RIVET LINE
  'g3-fractal': true,         // g3-c, level 8 THE FRACTAL YARD
  'g3-vault': true,           // g3-c, level 9 THE VAULT
  'g3-vault-ring': true,      // g3-c, level 9 (the rings inside a vault)
};
const SRC = {
  'g3-blueprint-wall': '../../../obstacles/g3-blueprint-wall/index.js', 'g3-shuttler': '../../../enemies/g3-shuttler/index.js',
  'g3-lockgate': '../../../obstacles/g3-lockgate/index.js', 'g3-augur': '../../../enemies/g3-augur/index.js',
  'g3-plotter': '../../../enemies/g3-plotter/index.js', 'g3-forgery': '../../../enemies/g3-forgery/index.js',
  'g3-forge-turret': '../../../enemies/g3-forge-turret/index.js', 'g3-riveter': '../../../enemies/g3-riveter/index.js',
  'g3-fractal': '../../../enemies/g3-fractal/index.js', 'g3-vault': '../../../obstacles/g3-vault/index.js',
  'g3-vault-ring': '../../../pickups/g3-vault-ring/index.js',
};
const GOT = {};
await Promise.all(Object.keys(SRC).filter((k) => LANDED[k]).map(async (k) => {
  try { const m = await import(SRC[k] + '?v=0.6.1'); if (m.default && m.default.name) GOT[k] = m.default; } catch (e) { /* listed as landed but not loadable: the placeholder plays */ }
}));
export const cameoKinds = () => Object.values(GOT);
export const cameosPresent = () => Object.keys(GOT);

// one of a borrowed kind at (nx, ny), from its sample event
function put(L, key, d, nx, ny, extra) {
  const k = GOT[key]; if (!k) return false;
  L.add(d, k.name, Object.assign({}, k.sample || {}, nx === undefined ? {} : { nx, ny }, extra || {}));
  return true;
}
// Each wave: d, the course distance it starts at; R, the level's seeded random; v, the course's speed there (m/s).
// Placeholders keep to galaxy 1's kinds and ask the same skill: a gap to find, a bolt to roll home, a line to read, a
// string to roll on. The real kinds' fields follow each builder's own header (read from their pushed branches, 11-07).
// g3-roll (11-07, Evrtek: roll demand rises through the game, each galaxy a little harder): the finale's waves ask more
// of the roll than their own levels did, never less: more bolts from the shuttles, the augurs and the turret, the
// plotter's escort (its shot, sent home, breaks the plotter), the riveters' strings cross-stitched, a second fractal.
export const CAMEOS = {
  // 1 THE SCAFFOLD: a blueprint shows where each wall will stand
  l1(L, d) {
    if (put(L, 'g3-blueprint-wall', d, undefined, undefined, { gap: [0.35, -0.2, 0.3, 0.32], lead: 1.4, crack: null })) { L.line(d - 90, 0.15, -0.1, 0.35, -0.2, 3, 26); L.ring(d + 12, 0.35, -0.2); return; }
    // placeholder: a rock pair with the way between them lit by rings
    L.add(d, 'rock', { nx: -0.55, ny: 0.2, r: 3.2 }); L.add(d, 'rock', { nx: 0.55, ny: -0.2, r: 3.2 }); L.line(d - 80, 0, 0.3, 0, 0, 4, 24);
  },
  // 2 THE LOOM FLOOR: shuttle-bolts weave as they fly; roll where the weave crosses you
  l2(L, d) {
    if (put(L, 'g3-shuttler', d, undefined, undefined, { rail: 'L', shots: 4 })) return;
    L.add(d, 'shrike', { side: -1, ny: 0.4, shots: 3 });
  },
  // the shuttle crossfire (after the Mirror Shell): shuttles on both rails firing together, so one roll takes both sides
  crossfire(L, d) {
    if (GOT['g3-shuttler']) { put(L, 'g3-shuttler', d, undefined, undefined, { rail: 'L', shots: 3 }); put(L, 'g3-shuttler', d, undefined, undefined, { rail: 'R', shots: 3 }); return; }
    L.add(d, 'pod', { nx: -0.62, ny: 0.55, bursts: 2, shots: 1 }); L.add(d, 'pod', { nx: 0.62, ny: 0.55, bursts: 2, shots: 1 });
  },
  // THE SHED's shuttles (g3-roll): the loom's own shuttles run its rails beside you and throw their weave as you dive.
  // o: the shuttler's event (rail, shots, gap); the placeholder is a shrike on that side
  shuttle(L, d, o) {
    if (put(L, 'g3-shuttler', d, undefined, undefined, o)) return;
    L.add(d, 'shrike', { side: o.rail === 'R' ? 1 : -1, ny: 0.4, shots: o.shots || 2 });
  },
  // 3 THE LOCKWORKS: send their fire into the locks to open the way
  l3(L, d) {
    if (put(L, 'g3-lockgate', d, undefined, undefined, { id: 'l10-lock', keys: 1, fire: [3.6], duct: 110 })) {
      L.line(d + 20, 0, 0, 0, 0, 4, 24, 'ring', { lockOf: 'l10-lock' }); L.line(d - 30, 0, 0, 0, 0, 3, 24, 'ring', { ductOf: 'l10-lock' }); return;
    }
    L.add(d, 'pod', { nx: 0, ny: 0.62, bursts: 2, shots: 1 }); L.line(d - 60, 0, -0.2, 0, -0.1, 4, 24);
  },
  // 4 THE AUGURY: augurs fire where you are going, so change your line
  l4(L, d) {
    if (put(L, 'g3-augur', d, 1.3, 0.5, { shots: 3 })) { put(L, 'g3-augur', d + 140, -1.3, -0.3, { shots: 3 }); return; }
    L.add(d, 'pod', { nx: 0.55, ny: 0.5, drift: -1.6, bursts: 1, shots: 2 }); L.add(d + 140, 'pod', { nx: -0.55, ny: -0.3, drift: 1.6, bursts: 1, shots: 2 });
  },
  // 5 THE DRAFTING HALL: plotters draw a line of mines wherever they fly
  l5(L, d, R, v) {
    if (put(L, 'g3-plotter', d, undefined, undefined, { path: [[-1.3, 0.35], [1.3, -0.25]], from: 2.6, to: 0.2, spd: v || 130, spacing: 1.5, pop: 0, escort: { at: 2.8, shots: 2, side: 1 } })) { L.line(d - 40, 0, -0.6, 0, -0.65, 3, 24); return; }
    L.add(d, 'mines', { nx: -0.35, ny: 0.3, n: 5 }); L.add(d + 70, 'mines', { nx: 0.4, ny: -0.35, n: 5 }); L.line(d - 40, 0.5, 0.45, 0.55, 0.5, 3, 24);
  },
  // 6 THE FORGERY: forged copies of the Wake race you for the rings
  l6(L, d) {
    if (put(L, 'g3-forgery', d, 0, 0.2)) { put(L, 'g3-forge-turret', d + 60, 1.3, 0.65, { shots: 2 }); return; } // its perch outside the box (its header: |nx| > 1.15)
    L.add(d, 'shrike', { side: 1, ny: 0.5, shots: 2 }); L.add(d + 40, 'shrike', { side: -1, ny: -0.3, shots: 2 });
  },
  // 7 THE RIVET LINE: riveters stitch strings of bolts at you, so roll on every stitch
  l7(L, d) {
    // two cross-stitches (the Rivet Line's twist), from three sides: every note lands from all three at once (one roll
    // takes them all; g3-roll: pairs and singles before). The bolts fly straight, as this wave's always did: bent after you
    // (seam), these eight notes put a decent pilot down here in one run of two, and left the other on a quarter shield.
    // The strings are as long as they were (a pair never lengthens one), so the breather after them stays clear.
    const N = [0, 3, 6, 9];
    if (put(L, 'g3-riveter', d, 1.25, 0.55, { notes: N, sync: 'l10-x1' })) {
      put(L, 'g3-riveter', d, -1.25, 0.45, { notes: N, sync: 'l10-x1' }); put(L, 'g3-riveter', d, 0, 1.36, { notes: N, sync: 'l10-x1' });
      put(L, 'g3-riveter', d + 160, -1.25, 0.4, { notes: N, sync: 'l10-x2' });
      put(L, 'g3-riveter', d + 160, 1.25, 0.3, { notes: N, sync: 'l10-x2' }); put(L, 'g3-riveter', d + 160, 0.4, 1.36, { notes: N, sync: 'l10-x2' });
      return;
    }
    L.add(d, 'pod', { nx: 0.6, ny: 0.6, bursts: 3, shots: 1 }); L.add(d + 160, 'pod', { nx: -0.6, ny: 0.45, bursts: 3, shots: 1 });
  },
  // 8 THE FRACTAL YARD: fractal drones split in two when their own fire comes home
  l8(L, d) {
    if (put(L, 'g3-fractal', d, 0.4, 0.5)) { put(L, 'g3-fractal', d + 120, -0.4, 0.45, { pair: true }); return; }
    L.add(d, 'pod', { nx: 0.4, ny: 0.5, bursts: 2, shots: 2 }); L.add(d + 30, 'pod', { nx: -0.4, ny: 0.55, bursts: 2, shots: 2 });
  },
  // 9 THE VAULT: vaults open only to a ship running hot on GREED
  l9(L, d) {
    // its jackpot, as g3-c's level 9 lays it: a line of vault rings through its drum, tied to it by id. Here they are EXTRAS
    // (cache): the finale's vault is a nod to level 9, its reward never part of a star
    if (put(L, 'g3-vault', d, 0, 0, { id: 'l10-vault' })) { if (GOT['g3-vault-ring']) for (let i = 0; i < 10; i++) L.add(d - 1 + i * 2.2, GOT['g3-vault-ring'].name, { vault: 'l10-vault', nx: 0, ny: 0, cache: true }); return; }
    L.add(d, 'crystal', { nx: 0.5, ny: -0.35, r: 1.6 }); L.add(d + 20, 'crystal', { nx: -0.5, ny: 0.35, r: 1.6 }); L.line(d - 40, 0, 0.1, 0, -0.1, 4, 24);
  },
};
