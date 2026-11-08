// THE PRIMER (the Vault's first act, the plan's 4.9: "a vault, with your meter already nearly full. Cash in and fly
// through."): at its moment it brings your GREED meter up to `to` (never down, and never while GREED is lit) and says
// why, so the first vault teaches the door and the cash-in before you have to fill the meter yourself.
//   Event: { to: 100, say: 'CASH IN AND THE DOOR OPENS' }
import { defineDecor } from '../../../api.js?v=0.5.0';

export const primer = defineDecor({
  name: 'g3-l9-primer', hazard: null,
  spawnAt: 'now', motion: 'own', noWarm: true,
  spawn(e, ev, api) {
    const G = api.G, want = ev.to ?? 100;
    if (G && !api.game.greedOn && (G.greed || 0) < want) api.game.greed(want - (G.greed || 0));
    if (ev.say) api.game.call(ev.say, ev.cls || 'c-mag');
    e.alive = false;
  },
  update(e) { e.alive = false; },
});
