// RING REAPER 0.6.3: the multiplier's rules, on their own so a test can hold them (tools/test/mult.js).
// Evrtek, 11-11: "I don't think that you should have to collect consecutive rings. So missing rings should not drop you
// down." ... "the only way to lose multiplier is to take damage."
// Two things, lost apart: the PIPS (rings in a row toward the next step, 0-4) and the MULTIPLIER (x1-x8).
//   a ring        one pip; the fifth steps the multiplier up one, to x8 (at x8 the pips stay empty: nothing to build)
//   a missed ring the pips clear; the multiplier stays
//   a shot        one step off (any damage that is not a crash: blasts, beams, pulses), the pips clear
//   a crash       three steps off (anything solid, every size: onCrash), the pips clear
// Never below x1. A level start and a checkpoint restart begin at x1 (main.js start): those are not penalties.
// G.chain is the run of rings in a row (the end card's BEST COMBO chain): it clears with the pips.
export const MULT_MAX = 8, PIPS = 5, DROP = { shot: 1, crash: 3 };

// a ring caught: true when it stepped the multiplier up
export function ring(G) {
  G.chain++; G.bestChain = Math.max(G.bestChain || 0, G.chain);
  if (G.mult >= MULT_MAX) { G.pips = 0; return false; }
  if (++G.pips < PIPS) return false;
  G.pips = 0; G.mult++; G.bestMult = Math.max(G.bestMult || 1, G.mult);
  return true;
}
// a ring let go: true when there were pips to lose
export function miss(G) {
  const had = G.pips > 0;
  G.pips = 0; G.chain = 0;
  return had;
}
// damage: steps off the multiplier (DROP.shot or DROP.crash), never below x1; the pips clear
export function drop(G, steps) {
  G.pips = 0; G.chain = 0;
  G.mult = Math.max(1, G.mult - Math.max(0, steps | 0));
}
