// DRIFTLINE: the course list. A course is data: a route (control points, or a few lines of turtle moves built by
// route.js), zone settings, a scenery preset (js/scenery/<region>.js, all five loaded with the game since 11-16), a
// difficulty out of 100, star lines and the Degenerate line. Fifteen courses in five regions of three, difficulty
// rising 10 to 95 (MCP projects/driftline-design.md). Three carry a second grid slot for the duels (duel.grid).
import { EMBER_BAY } from './ember-bay.js?v=0.1.25';
import { DRYDOCK, SALT_PIER } from './harbour.js?v=0.1.25';
import { RED_MESA, DUST_DEVIL, SCORPION } from './canyon.js?v=0.1.25';
import { PINE_HOLLOW, CEDAR, WIDOWMAKER } from './mountain.js?v=0.1.25';
import { AFTERGLOW, CHROME, MIDNIGHT } from './neon.js?v=0.1.25';
import { FROSTLINE, SKYLINE, CLOUDBREAK } from './summit.js?v=0.1.25';

export const REGIONS = [
  { id: 'harbour', name: 'Harbour', blurb: 'Closed industrial loops by the water.' },
  { id: 'canyon', name: 'Canyon', blurb: 'Cutbacks carved into red rock.' },
  { id: 'mountain', name: 'Mountain pass', blurb: 'Switchbacks through the pines.' },
  { id: 'neon', name: 'Neon city', blurb: 'A closed street circuit after dark.' },
  { id: 'summit', name: 'Summit', blurb: 'The hard touge at the top of the world.' },
];
export const COURSES = [DRYDOCK, EMBER_BAY, SALT_PIER, RED_MESA, DUST_DEVIL, SCORPION, PINE_HOLLOW, CEDAR, WIDOWMAKER, AFTERGLOW, CHROME, MIDNIGHT, FROSTLINE, SKYLINE, CLOUDBREAK];
COURSES.forEach((c, i) => { c.number = i + 1; });
// EMBER BAY PASS stays the course a new player meets first (it was 0.1.0's only one)
export const courseById = (id) => COURSES.find((c) => c.id === id) || EMBER_BAY;
