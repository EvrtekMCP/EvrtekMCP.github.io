// RING REAPER 0.6.2: THE EXPLANATIONS, CUT RIGHT BACK (Evrtek 11-11, after playing 0.6.1: "We overdid it on the Ring Reaper
// explanations. They interrupt the flow of the first level horribly because they're constantly in your face ... Not
// everything is going to need an explanation. You know you shouldn't run into boulders. You know you should collect the
// rings."). This replaces 0.6.0's first-time cards (a card for every hazard, enemy, boss and rule, a slow-motion dip and a
// bracket) and the staged roll lesson that stopped the world.
//
// Three things explain themselves now, and nothing else does:
//   INCOMING  the roll. The first shots coming at you get one line, "INCOMING: <your roll key> to roll", shown at the
//             moment to roll: TIP.lead before the shot reaches you, so a roll begun when the line appears is still
//             turning when the shot arrives (a roll lasts 0.45 s and sends back whatever meets it). It shows until your
//             first roll sends a shot back, and at most TIP.incoming times; then never again.
//   GREED     once, the first time the bar fills.
//   POWER-UPS each of the six, once, when you first see it coming.
// Nothing stops and nothing slows: it is one line low on the screen, under the ship's lane and above the ROLL meter
// (0.6.2's probe of level 1: rings, shots and enemies fly in the middle of the screen and the ship rides just below it).
// What has been seen is kept beside the records (levels.js Progress: 'ringreaper.seen', and the roll's own
// 'ringreaper.tips'), so a returning player is never taught again. NEW GAME's erase clears both; nothing else does.
// Options' TIPS switch turns them all off; ?test and the autopilot never see them; ?tips=1 or #tips-1 forces them on.
import { store } from './util.js?v=0.6.2';
import { param } from './params.js?v=0.6.2';
import { POWERUPS } from './powerups.js?v=0.6.2';

export const TIP = {
  lead: 0.42,     // the roll line shows when the shot is this many seconds (the ship's time) from the ship
  near: 3.2,      // ...and only for a shot headed within this many metres of the ship (DEFLECT_R is 2.3)
  incoming: 3,    // the roll line shows at most this many times, ever
  space: 2.5,     // seconds between two roll lines (a burst of shots is one lesson)
  rollLife: 1.1,  // seconds the roll line stays up
  life: 2.6,      // seconds a GREED or power-up line stays up
  gap: 0.3,       // seconds between one line going and the next coming
  far: 380,       // a power-up gets its line when it is this close in metres...
  ahead: 2.6,     // ...or this many seconds out, whichever is nearer
  wait: 8,        // seconds a GREED line may wait its turn before it is dropped for another day
};

// ---- the lines: one each. `say` is the text after the name, or a function of { input } (a line that names the player's
// own controls: the keys they have bound, the mouse if it is on, a double tap on a touch screen)
const touch = (input) => input && input.mode === 'touch';
// 'SPACE or left-click': the bound keys as keycaps say them, and the mouse button if the mouse plays
const keys = (input, action) => {
  const ks = input.labels(action), m = input.binds.mouse ? { roll: 'left-click', greed: 'right-click' }[action] : null;
  const all = ks.concat(m ? [m] : []);
  return all.length > 1 ? all.slice(0, -1).join(', ') + ' or ' + all[all.length - 1] : all[0] || '';
};
const pu = (id, say) => ({ name: POWERUPS[id].name, say, icon: 'ui/pu/hud-' + POWERUPS[id].kind, color: POWERUPS[id].css, power: true });
export const CARDS = {
  'incoming': { name: 'INCOMING', color: '#ff5470', roll: true, say: ({ input }) => (touch(input) ? 'double-tap' : keys(input, 'roll')) + ' to roll' },
  'greed': { name: 'GREED READY', color: '#ffcc33', say: ({ input }) => (touch(input) ? 'tap the GREED button' : keys(input, 'greed')) + ' for double score' },
  // the six power-ups, by their pickup's kind name
  'shield-cell': pu('shield', 'half your shield back'),
  'overclock': pu('overclock', 'roll almost nonstop for a while'),
  'mirror-shell': pu('mirror', 'your rolls catch shots from farther out'),
  'phase': pu('phase', 'fly through rocks and walls, but shots still hurt'),
  'ring-magnet': pu('magnet', 'nearby rings fly to you'),
  'slipstream': pu('slip', 'everything but you slows down'),
};
// a cell a boss drops is a Shield Cell (boss.js asks for 'boss-cell')
const ALIAS = { 'boss-cell': 'shield-cell' };

// which line a thing on the course is, or null: a power-up only (scenery copies, warm-up samples and hidden things never)
export function cardOf(e) {
  const k = e.kind, ev = e.ev || {};
  if (!k || !k.powerup || e.decor || ev.decor || ev.warm || ev.gallery) return null;
  return CARDS[k.name] && CARDS[k.name].power ? k.name : null;
}

// ---- the TIPS switch (Options): a setting, so it is not part of the records and NEW GAME leaves it alone
const ON_KEY = 'ringreaper.tipsOn';
export const tipsSetting = () => store(ON_KEY) !== false;
export const setTipsSetting = (on) => store(ON_KEY, !!on);
// the run's mode: forced on (?tips=1, #tips-1), off for the test hooks and the autopilot, else the player's switch
export function tipsMode() {
  if (param('tips') === '1') return 'forced';
  if (typeof location !== 'undefined') { const q = new URLSearchParams(location.search); if (q.has('test') || q.has('auto')) return 'off'; }
  return 'player';
}

export class Tips {
  // o: { hud, input, Progress, G, ship, onScreen(x, y, z) }
  constructor(o) {
    this.o = o; this.mode = tipsMode(); this.live = this.enabledNow();
    this.line = null; this.queue = []; this.gapT = 0; this.rollT = -99;
    this.memo = new Map(); // the seen set, read once from the save (a scan asks every frame)
    this.log = [];         // what showed this page load: { id, t, lead } (the tests read it)
    this.onShow = null;    // (tests) called with each line as it shows
  }
  seen(id) {
    let s = this.memo.get(id);
    if (s === undefined) { s = this.o.Progress.seen(id) || (id === 'shield-cell' && this.o.Progress.seen('boss-cell')); this.memo.set(id, s); }
    return s;
  }
  see(id) { this.memo.set(id, true); this.o.Progress.see(id); }
  // the roll line: wanted until a roll has sent a shot back (Progress 'roll', main.js onDeflect) or it has shown its times
  shownRoll() { let n = 0; while (n < TIP.incoming && this.seen('incoming-' + (n + 1))) n++; return n; }
  wantsRoll() { return !this.o.Progress.tip('roll') && this.shownRoll() < TIP.incoming; }
  // on for this run? (read at each run's start: the switch lives in Options, never in flight)
  enabledNow() { return this.mode === 'forced' || (this.mode === 'player' && tipsSetting()); }
  enabled() { return this.live; }
  get showing() { return !!this.line; }
  waiting(id) { return (this.line && this.line.id === id) || this.queue.some((q) => q.id === id); }

  // every frame of play, after the step: the first shots coming at you, and power-ups coming into view
  scan(list, shots, v) {
    if (!this.enabled()) return;
    if (this.wantsRoll() && !this.o.G.rolling && this.o.G.time - this.rollT > TIP.space) { // (already rolling: that roll meets it)
      const s = this.incoming(shots, v);
      if (s) this.roll(s);
    }
    const near = Math.min(TIP.far, TIP.ahead * Math.max(30, v));
    for (const e of list) {
      if (!e.alive || e.dead) continue;
      const id = cardOf(e); if (!id || this.seen(id) || this.waiting(id)) continue;
      if (!(e.z < -2) || -e.z > near || (e.obj && !e.obj.visible) || !this.o.onScreen(e.x, e.y, e.z)) continue;
      this.queue.push({ id, e });
    }
  }
  // the shot to roll for right now, or null: one that can be sent back, headed close to the ship, TIP.lead or less away
  // (in the ship's own time: Slipstream slows the shot, never the roll)
  incoming(shots, v) {
    const ship = this.o.ship, ws = this.o.G.timeScale ?? 1;
    let best = null, bt = 1e9;
    for (const s of shots) {
      if (s.reflected || s.noReflect || s.met || !s.alive) continue;
      let t;
      if (s.catch) t = (s.T - s.age) / ws;                       // a shot flying to a point arrives when its time is up
      else { const vz = s.vz + (s.carry ? v : 0); if (vz <= 0 || s.z >= 0) continue; t = -s.z / vz / ws; }
      if (t > TIP.lead || t < 0.05) continue;
      const cx = s.x + s.vx * t * ws, cy = s.y + s.vy * t * ws;
      if (Math.hypot(cx - ship.x, cy - ship.y) > TIP.near) continue;
      if (t < bt) { bt = t; best = s; }
    }
    if (best) best.tipLead = bt;
    return best;
  }
  // the roll line goes up at once, over anything else (it cannot wait: its moment is now)
  roll(s) {
    const n = this.shownRoll() + 1;
    this.see('incoming-' + n); this.rollT = this.o.G.time;
    if (this.line) this.away(0);
    this.show('incoming', { shot: s, lead: s.tipLead, n });
  }
  // GREED has filled (main.js), or a boss has dropped a cell (boss.js 'boss-cell'): its line, once. -> true if it will show
  event(id) {
    id = ALIAS[id] || id;
    if (!this.enabled() || !CARDS[id] || CARDS[id].roll || this.seen(id) || this.waiting(id)) return false;
    this.queue.push({ id, t: this.o.G.time });
    return true;
  }
  // a roll has just sent a shot back: the roll line has done its job, so it goes now
  deflected() { if (this.line && this.line.id === 'incoming') this.away(); }
  show(id, extra = {}) {
    const c = CARDS[id];
    if (id !== 'incoming') this.see(id);
    this.line = Object.assign({ id, c, t: 0, life: c.roll ? TIP.rollLife : TIP.life }, extra);
    this.log.push({ id, t: +this.o.G.time.toFixed(3), lead: extra.lead !== undefined ? +extra.lead.toFixed(3) : undefined, n: extra.n });
    const say = typeof c.say === 'function' ? c.say({ input: this.o.input }) : c.say;
    this.o.hud.tip({ id, name: c.name, say, icon: c.icon, color: c.color });
    if (this.onShow) this.onShow(this.line);
  }
  // the next line in the queue that still makes sense (its power-up is still ahead; GREED has not gone stale)
  next() {
    let f;
    while ((f = this.queue.shift())) {
      if (this.seen(f.id)) continue;
      if (f.e && !(f.e.alive && !f.e.dead && f.e.z < -1)) continue;                       // it flew past: next time
      if (f.t !== undefined && this.o.G.time - f.t > TIP.wait) continue;                   // too late to mean anything
      break;
    }
    if (f) this.show(f.id);
  }
  away(gap = TIP.gap) { if (!this.line) return; this.line = null; this.gapT = gap; this.o.hud.tip(null); }
  // real seconds in; it never changes the game's speed
  tick(dt) {
    const q = this.line;
    if (q) { q.t += dt; if (q.t >= q.life) this.away(); }
    else { this.gapT = Math.max(0, this.gapT - dt); if (this.gapT <= 0 && this.queue.length) this.next(); }
  }
  // a new run, the menus, the end of a run: no line, nothing queued
  reset() {
    this.line = null; this.queue.length = 0; this.gapT = 0; this.rollT = -99;
    this.o.hud.tip(null);
    this.mode = tipsMode(); this.live = this.enabledNow(); this.memo.clear(); // (NEW GAME may have erased the save since)
  }
}
