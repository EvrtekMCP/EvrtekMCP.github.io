// DRIFTLINE: the course list. A course is data: a route (control points, or a few lines of turtle moves built by
// route.js), zone settings, a scenery preset (js/scenery/<region>.js, all five loaded with the game since 11-16), a
// difficulty out of 100, star lines and the Degenerate line. Fifteen courses in five regions of three, difficulty
// rising 10 to 95 (MCP projects/driftline-design.md). Three carry a second grid slot for the duels (duel.grid).
import { EMBER_BAY } from './ember-bay.js?v=0.1.26';
import { DRYDOCK, SALT_PIER } from './harbour.js?v=0.1.26';
import { RED_MESA, DUST_DEVIL, SCORPION } from './canyon.js?v=0.1.26';
import { PINE_HOLLOW, CEDAR, WIDOWMAKER } from './mountain.js?v=0.1.26';
import { AFTERGLOW, CHROME, MIDNIGHT } from './neon.js?v=0.1.26';
import { FROSTLINE, SKYLINE, CLOUDBREAK } from './summit.js?v=0.1.26';

export const REGIONS = [
  { id: 'harbour', name: 'Harbour', blurb: 'Dockside loops, after the forklifts go home.' },
  { id: 'canyon', name: 'Canyon', blurb: 'Cutbacks in red rock. Nobody can hear you out here.' },
  { id: 'mountain', name: 'Mountain pass', blurb: 'Pine switchbacks where the locals come to show off.' },
  { id: 'neon', name: 'Neon city', blurb: 'Downtown after dark, borrowed for the night.' },
  { id: 'summit', name: 'Summit', blurb: 'The nastiest touge there is, at the top of the world.' },
];
export const COURSES = [DRYDOCK, EMBER_BAY, SALT_PIER, RED_MESA, DUST_DEVIL, SCORPION, PINE_HOLLOW, CEDAR, WIDOWMAKER, AFTERGLOW, CHROME, MIDNIGHT, FROSTLINE, SKYLINE, CLOUDBREAK];
COURSES.forEach((c, i) => { c.number = i + 1; });
// EMBER BAY PASS stays the course a new player meets first (it was 0.1.0's only one)
export const courseById = (id) => COURSES.find((c) => c.id === id) || EMBER_BAY;
