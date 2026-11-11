// RING REAPER 0.6.0, the player pass: THE DEMO SWITCH (Evrtek 11-10: "Demo = levels 1-3 (one boss fight), and the paid
// version adds the other 27. Add a build or config switch for a demo build that stops after G1-3 with a tasteful 'full
// version' end card. No prices, no store links, no words like 'buy' yet. The web arcade stays the full game unless Evrtek
// says otherwise; default the switch OFF").
//
// OFF by default: the game on the web is the whole game. Two ways to turn it on:
//   a DEMO BUILD   node tools/stage.js --demo   stages a copy (stage/ring-reaper-demo/) with DEMO_BUILD below set to true.
//                  Nothing in the page can turn that off, and the hidden dev menu is shut in it.
//   a PREVIEW      ?demo (or #demo) on any build shows the same thing without a build, for looking at it.
// What the demo is: galaxy 1's first three levels (SHATTERED MOON, NEBULA RUN, THE GATEFIELD and its boss, the Warden).
// Everything else is locked: the sector map shows levels 4 to 10 shut, the chart shows the other two galaxies shut, and
// both say where they are (IN THE FULL VERSION). Beating level 3 ends on the demo card (index.html #demo): what you did,
// and what the full version holds. No price, no shop, no link.
// Saves are the full game's own (the same keys), so a demo player's stars are there if the full game ever loads them.
import { param } from './params.js?v=0.6.2';

export const DEMO_BUILD = false; // tools/stage.js --demo writes true here in the staged copy; in the source it stays false
export const DEMO = DEMO_BUILD || param('demo') !== null;
export const DEMO_LEVELS = 3;    // galaxy 1, levels 1 to 3 in play order
// is level n of galaxy g part of what this build lets you play?
export const inDemo = (g, n) => !DEMO || (g === 1 && n <= DEMO_LEVELS);
// the last level of the demo: clearing it ends on the demo card
export const demoEnds = (g, n) => DEMO && g === 1 && n === DEMO_LEVELS;
export const DEMO_TEXT = {
  locked: 'IN THE FULL VERSION',
  head: "THAT'S THE DEMO",
  lines: ['You flew the first three sectors and brought down the Warden.', 'The full version flies on: 27 more levels, three galaxies and eleven more bosses.'],
};
