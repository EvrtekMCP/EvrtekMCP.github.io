// THE CHECKPOINT (0.6.0, the player pass; Evrtek 11-10: "Checkpoints on ALL levels ... a symbolic checkpoint you grab ...
// A visible object, not an invisible save. You restart from it if you fail the level"). One a level, laid by the engine
// on the ring line (levels.js layCheckpoint): about half way down a level, and just before the boss on a boss level.
// Fly through it and it is yours: the game keeps what the run had at that moment (main.js checkpoint), and a run that
// ends with its shield down may start again from here instead of from the start.
//
// What it looks like (0.6.1: Kalakar's THE LINE, Evrtek's pick 11-11; ./line.js): two faceted spires either side of the
// lane with a tape of light between them; flying through breaks the tape, which streams back from the ship as a wake.
// White and pale ally blue, the same in every galaxy, pulsing on the music's beat: it is on your side, and it is none of
// the three reserved hues (rule 9: red hurts, amber is collected, cyan is what you send back). It is bigger than a ring
// and far more forgiving: CHECKPOINT_R, more than twice a ring's reach.
// A checkpoint you fly past does not count (main.js T.checkpointMissCounts): it says so, stands dimmed, and the run carries on.
import { definePickup, lerp, smooth } from '../../api.js?v=0.6.4';
import { LINE } from './line.js?v=0.6.4';

export const CHECKPOINT_R = 4.2;
const MISSED = 0.3;             // how much of its light a checkpoint flown past keeps

export default definePickup({
  name: 'checkpoint',
  checkpoint: true,             // the bots never let one go, and the tips know it by this
  hazard: null,
  spawn(e, ev, api) {
    e.obj = api.course.get('checkpoint', () => LINE.make(api));
    e.anim = 0; e.grow = 1; e.missed = false;
    LINE.reset(e.obj);
  },
  // standing in the lane until it is crossed; once taken it rides with the ship for LINE.T seconds (the place itself goes
  // by at the course's speed: the drawing knows how far, e.z)
  update(e, dt, api) {
    const g = e.obj;
    if (e.anim > 0) {
      e.anim += dt; const k = Math.min(1, e.anim / LINE.T), c = smooth(Math.min(1, k * 5));
      g.position.set(lerp(e.x, api.ship.x, c), lerp(e.y, api.ship.y, c), 0); g.scale.setScalar(1);
      LINE.taken(g, e, k, dt, api);
      if (k >= 1) e.alive = false;
      return;
    }
    const fade = e.z > 0 ? Math.max(0, 1 - e.z / 4) : 1;
    LINE.idle(g, e, dt, api, fade * (e.missed ? MISSED : 1));
    if (e.crossed) {
      if (Math.hypot(api.ship.x - e.x, api.ship.y - e.y) < CHECKPOINT_R) { e.anim = 0.001; api.game.checkpoint(e); }
      else { e.missed = true; api.game.checkpointMiss(e); }
    }
    e.sx = e.sy = e.sz = 1;
    api.pose(e);
    if (e.z > 14) e.alive = false;
  },
});
