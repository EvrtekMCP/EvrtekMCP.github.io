// STARWAKE 0.4.0: FIRST-TIME TIPS (Evrtek 11-07: "Whenever a new item is introduced for the first time, we should have a
// slowdown moment that creates a tutorial event that tells you what the item is and what it does, and has a clickable
// skip button that will resume the game").
//
// The first time a player meets one of the things in CARDS, a beat before they have to deal with it (it is on screen and
// about TIP.lead seconds out), the game eases into slow motion over TIP.ease, holds nearly still, and a card says what
// the thing is and what to do about it. SKIP (a tap, a click, Space or Enter) eases it back to full speed; so does
// TIP.auto seconds of nobody pressing anything. Several new things at once come one card after another, never stacked.
// Each card shows once per player: the seen set is kept beside the records (levels.js Progress.seen), and NEW GAME's
// erase clears it. Options' TIPS switch turns them off; ?test and the autopilot never see them (the bots and the release
// check fly exactly as before); ?tips=1 or #tips-1 forces them on.
//
// This file owns the cards and the clock; main.js owns the game it slows (the same frame scale the roll lesson uses, so
// the player's timers, GREED and every power-up hold still too) and hud.js draws the card.
// The roll lesson (main.js, level 1) is never stacked with a card: no card starts while it runs, and a lesson that asks
// while a card is up waits for the card (its pod holds station) and starts the moment the card is skipped.
import { store } from './util.js?v=0.4.0';
import { param } from './params.js?v=0.4.0';
import { POWERUPS } from './powerups.js?v=0.4.0';

export const TIP = {
  ease: 0.3,   // seconds into the slow motion, and back out of it
  hold: 0.03,  // the world's speed while a card is up: nearly still, so it reads as frozen without looking broken
  auto: 6,     // seconds before a card nobody answers resumes the game on its own
  lead: 2.2,   // a thing gets its card when it is this many seconds out (the beat before you have to act)...
  far: 380,    // ...or this close in metres, whichever is nearer (at top speed 2.2 s is deep in the haze)
  more: 1.2,   // things this much further out when a card starts are queued behind it, so they come in the same hold
};
// Evrtek 11-07: "I meant only new items (powerups) not every enemy". So only the six power-up cards show. The pickup and
// hazard cards stay written below, switched off: PICKUPS adds boost rings, caches, shoals and vault rings; HAZARDS adds
// the obstacles, enemies and allies.
export const PICKUPS = false;
export const HAZARDS = false;

// ---- the cards, keyed by kind name ('cache' is a ring with ev.cache). Two short lines each: what it is, then what it
// does for you or what to do about it. Said the way a friend leaning over your shoulder would say it.
//   icon  art/<icon>.png (+@2x), Yori's HUD icons for the power-ups. None yet for the rest: glyph draws a placeholder
//         (collect: an amber ring; hurt: a red warning; ally: a soft blue disc)
//   art   her lettered call-out (art/<art>-glow.png) used as the card's title, where she has lettered that name
//   born  fire this many seconds after it appears, wherever it is (a thing that comes from behind you)
const pu = (id) => ({ power: true, icon: 'ui/pu/hud-' + POWERUPS[id].kind, art: POWERUPS[id].kind, color: POWERUPS[id].css });
const item = (o) => Object.assign({ item: true }, o);
const hurt = (name, a, b, o) => Object.assign({ name, say: [a, b], glyph: 'hurt' }, o);
export const CARDS = {
  // ---- the items: the six power-ups
  'shield-cell': item({ name: 'SHIELD CELL', ...pu('shield'), say: ['Spare shield, just floating there.', 'Fly through it and half your shield comes back.'] }),
  'overclock': item({ name: 'OVERCLOCK', ...pu('overclock'), say: ['Juice for your barrel roll.', 'Grab it and you can roll almost nonstop.'] }),
  'mirror-shell': item({ name: 'MIRROR SHELL', ...pu('mirror'), say: ['A mirror coat for your ship.', 'Your rolls catch shots from farther away.'] }),
  'phase': item({ name: 'PHASE', ...pu('phase'), say: ['Turns you into a ghost for a bit.', 'Fly right through rocks and walls. Shots still hurt.'] }),
  'ring-magnet': item({ name: 'RING MAGNET', ...pu('magnet'), say: ['A magnet, but for rings.', 'Grab it and nearby rings fly to you.'] }),
  'slipstream': item({ name: 'SLIPSTREAM', ...pu('slip'), say: ['This one slows down time.', 'Everything but you goes half speed for a while.'] }),
  // ---- the special pickups
  'boost-ring': item({ name: 'BOOST RINGS', glyph: 'collect', say: ['These come in a chain.', 'Fly through every one and you get a speed burst.'] }),
  'cache': item({ name: 'CACHE', art: 'cache', glyph: 'collect', say: ['A bonus ring, tucked off the main line.', 'Grab it for points. Missing it costs nothing.'] }),
  'g2-shoal': item({ name: 'SHOAL', art: 'shoal', glyph: 'collect', say: ['These rings swim together, like fish.', "When the leader's tail flashes white, they're about to turn."] }),
  'g3-vault-ring': item({ name: 'VAULT RINGS', glyph: 'collect', say: ["The vault's open. These rings are all yours.", 'They count toward your stars, so grab the lot.'] }),

  // ---- galaxy 1's hazards (plain walls and rocks that only sit there get no card: they explain themselves)
  'boulder': hurt('BOULDER', 'A chunk of moon, rolling across the lane.', "Watch where it's headed and be somewhere else."),
  'pod': hurt('LANTERN POD', 'It sits still and shoots at you.', 'Roll as a shot reaches you and it goes back.'),
  'shrike': hurt('SHRIKE', 'A fighter that swoops across, shooting.', 'Watch for the side arrow, then roll its shots back.'),
  'mines': hurt('MINES', 'They blink faster as you get close.', 'Then each one pops into four bolts. Give them room.'),
  'l3-gate': hurt('BEAT GATE', 'Its walls move on the beat.', 'Red slices hurt. Fly through an open one.'),
  'gate-turret': hurt('GATE TURRET', 'It fires on the beat.', 'Roll on the beat and its shots go back.'),
  'l4-flare': hurt('SOLAR FLARE', 'That glowing strip is about to erupt.', 'Get off it before it goes up.'),
  'l4-raft': hurt('SHIELD RAFT', 'A raft of shield plates.', 'Its shadow side is safe when the flares go off.'),
  'seeker-drone': hurt('SEEKER DRONE', 'Its shots curve after you.', "You can't dodge them, so roll them back."),
  'l5-arc': hurt('LIGHTNING ARC', 'Lightning between two lamps, on the beat.', "Lamps going white means it's about to fire."),
  'l5-sheet': hurt('ARC CURTAIN', 'Lightning that splits the lane in two.', 'Cross over when it goes dark.'),
  'sniper': hurt('SNIPER', "That red line is where it's aiming.", 'When the line turns white, get off it.'),
  'ice-mine': hurt('ICE MINE', 'Get close and it arms.', 'It bursts in a ring. Hold steady through the middle.'),
  'l6-pass': hurt('LEVIATHAN', 'Something huge is coming up behind you.', "Get out of the red lane. Now's good.", { born: 0.15 }),
  'l7-freighter': hurt('FREIGHTER', 'Slow traffic, going your way.', "Flashing red means it's about to change lanes."),
  'swarm-unit': hurt('SWARM', 'A chain of kites that copies how you flew.', 'They fire in a line. One roll sends them back.'),
  'searchlight-sentry': hurt('SEARCHLIGHT', 'If the beam catches you, it calls for backup.', 'So stay out of the light.'),
  'crystal-emitter': hurt('CRYSTAL EMITTER', 'It fires one real shot and two fakes.', 'The pink rings pass through you. Roll the red one.'),
  'l10-defence-ring': hurt('DEFENCE RING', 'A ring of turning blades.', 'Pick a gap and fly through it.'),
  'l10-ram': hurt('PISTON RAM', 'A ram, hiding in the wall.', "When its caps glow, it slams across. Don't be there."),
  'l10-iris': hurt('IRIS DOOR', 'Its blades close down to a small hole.', 'Be in the hole when it shuts.'),
  // ---- galaxy 2
  'g2-current': hurt('CURRENT', 'A current that carries your ship along.', 'Ride it, or steer hard to stay on your line.'),
  'g2-drifter': hurt('DRIFTER', 'A big jelly, riding the current.', 'Its tendrils sting. Skim close for bonus points.'),
  'g2-gulper': hurt('GULPER', 'It cuts right across the lane.', 'Dodge it, then roll the two shots it spits back.'),
  'g2-thrummer': hurt('THRUMMER', 'A reef drum that sends pulses up the lane.', 'Fly through the dark gap, or roll as it hits.'),
  'g2-calf': hurt('WHALE CALF', "A baby whale. It's on your side.", 'Keep it safe. Get in front of shots and roll.', { glyph: 'ally' }),
  'g2-hound': hurt('HOUND', "It's hunting the calf, not you.", 'Jump in front of its shot and roll.'),
  'g2-gravity-well': hurt('GRAVITY WELL', 'It pulls you in and bends shots.', 'Follow the dotted lines. Stay off the dark core.'),
  'g2-slinger': hurt('SLINGER', 'It shoots around the gravity well.', 'Follow the dots. The shot comes in from the side.'),
  'g2-leech': hurt('LEECH', 'Its tether grabs you and drains your shield.', 'Roll to snap it off.'),
  'g2-whale': hurt('HERD WHALE', 'A big friendly whale, swimming beside you.', 'If leeches grab her, fly through the line and roll.', { glyph: 'ally' }),
  'g2-bloomer': hurt('BLOOMER', 'Its seed bursts into five shots.', 'Roll the seed as it cracks, before it splits.'),
  'g2-angler': hurt('ANGLER', 'That ring on a stalk is bait.', 'Take it, then steer out the green gap. Fast.'),
  'g2-flock': hurt('FLOCK', 'Moths, flying together as one shape.', 'The thick parts hurt. Read the shape first.'),
  'g2-conductor': hurt('CONDUCTOR', 'The red moth runs the flock.', 'Roll its shots back and the flock falls apart.'),
  'g2-root-whip': hurt('ROOT WHIP', 'It glows red, then lashes across.', "Don't be where it lands."),
  'g2-sap-knot': hurt('SAP KNOT', 'It swells up, then sprays.', 'One roll sends the whole spray back.'),
  // ---- galaxy 3
  'g3-blueprint-wall': hurt('BLUEPRINT WALL', "The white outline is the wall that's coming.", 'Head for the gap. The plan never lies.'),
  'g3-shuttler': hurt('SHUTTLER', 'Its shots weave side to side.', 'Roll where the weave crosses you.'),
  'g3-lockgate': hurt('LOCKGATE', 'Locked. The turret on top is your key.', 'Roll its shots back into the red keystone.'),
  'g3-augur': hurt('AUGUR', "It shoots where you're going to be.", 'See the red ring? Change course before it fires.'),
  'g3-plotter': hurt('PLOTTER', 'It draws a line of mines as it goes.', "The white guide shows where they'll land."),
  'g3-forgery': hurt('FORGERY', 'A cheap copy of you, stealing your rings.', "Pop it with a turret's shot to get them back."),
  'g3-forge-turret': hurt('FORGE TURRET', 'Its shots go after the forgery.', "Roll them back. The white line shows where they'll go."),
  'g3-riveter': hurt('RIVETER', 'It fires strings of shots on the beat.', 'Each red light is one more shot. Roll every one.'),
  'g3-fractal': hurt('FRACTAL', 'Send its shot back and it splits in two.', 'More pieces, more points. Or just let it drift off.'),
  'g3-l8-breeder': hurt('BREEDER', 'The big one makes more fractals.', 'She makes one for every fractal you let go.'),
  'g3-vault': hurt('VAULT', 'A vault full of rings.', 'It only opens while your GREED is lit.', { art: 'vault' }),
  'g3-warp-thread': hurt('WARP THREAD', 'A tight thread across the lane.', 'When it gets plucked it swings wide. Stay clear.'),
  'g3-heddle': hurt('HEDDLE', 'The gap between the threads moves.', "The white outline shows where it'll be."),
};

// which card an entity on the course is, or null (scenery copies, warm-up samples and hidden things never are)
export function cardOf(e) {
  const k = e.kind, ev = e.ev || {};
  if (!k || e.decor || ev.decor || ev.warm || ev.gallery) return null;
  if (ev.cache && (k.name === 'ring' || ev.payout)) return PICKUPS ? 'cache' : null; // a cache ring, or a High Roller payout (a cache too)
  const c = CARDS[k.name];
  if (!c) return null;
  if (c.item ? !(c.power || PICKUPS) : !HAZARDS) return null;
  return k.name;
}

// ---- the TIPS switch (Options): a setting, so it is not part of the records and NEW GAME leaves it alone
const ON_KEY = 'starwake.tipsOn';
export const tipsSetting = () => store(ON_KEY) !== false;
export const setTipsSetting = (on) => store(ON_KEY, !!on);
// the run's mode: forced on (?tips=1, #tips-1), off for the test hooks and the autopilot, else the player's switch
export function tipsMode() {
  if (param('tips') === '1') return 'forced';
  if (typeof location !== 'undefined') { const q = new URLSearchParams(location.search); if (q.has('test') || q.has('auto')) return 'off'; }
  return 'player';
}

const smooth = (t) => t * t * (3 - 2 * t);

export class Tips {
  // o: { hud, audio, input, Progress, G, ship, box, onScreen(x, y, z), lesson(pod) }
  constructor(o) {
    this.o = o; this.mode = tipsMode(); this.live = this.enabledNow();
    this.phase = ''; this.t = 0; this.k = 1; this.autoT = 0;
    this.card = null; this.queue = []; this.lesson = null;
    this.memo = new Map(); // the seen set, read once from the save (a scan asks every frame)
    this.log = []; // what showed this page load: { id, how } (how: 'skip', 'key', 'auto', 'off')
  }
  seen(id) { let s = this.memo.get(id); if (s === undefined) { s = this.o.Progress.seen(id); this.memo.set(id, s); } return s; }
  see(id) { this.memo.set(id, true); this.o.Progress.see(id); }
  // on for this run? (read at each run's start: the switch lives in Options, never in flight)
  enabledNow() { return this.mode === 'forced' || (this.mode === 'player' && tipsSetting()); }
  enabled() { return this.live; }
  get on() { return this.phase !== ''; }
  // a card is up (or coming up): the ship is safe and the player's presses are spoken for
  get safe() { return this.phase === 'in' || this.phase === 'hold'; }
  get showing() { return this.safe && !!this.card; }

  // every frame of play, after the step: anything new and in view gets its card (or joins the queue)
  scan(list, v) {
    if (!this.enabled()) return;
    const near = Math.min(TIP.far, TIP.lead * Math.max(30, v)), soon = near + TIP.more * Math.max(30, v);
    let found = null;
    for (const e of list) {
      if (!e.alive || e.dead) continue;
      const id = cardOf(e); if (!id || this.seen(id) || (this.card && this.card.id === id) || this.queue.some((q) => q.id === id)) continue;
      const c = CARDS[id];
      if (c.born !== undefined) { if (e.t >= c.born) (found ||= []).push({ id, e, d: 0 }); continue; }
      if (!(e.z < -2) || -e.z > soon || (e.obj && !e.obj.visible) || !this.o.onScreen(e.x, e.y, e.z)) continue;
      (found ||= []).push({ id, e, d: -e.z, now: -e.z <= near });
    }
    if (!found) return;
    // nothing up yet: only something within reach starts a card, and whatever is close behind it queues up with it
    if (!this.card && !found.some((f) => f.now || f.d === 0)) return;
    found.sort((a, b) => a.d - b.d);
    for (const f of found) if (!this.queue.some((q) => q.id === f.id)) this.queue.push(f);
    if (!this.card) this.next('');
  }
  // the next card in the queue, or out of the hold. how: why the last one closed ('' when none was up)
  next(how) {
    if (this.card) { this.log.push({ id: this.card.id, how }); this.card = null; }
    // a roll lesson that asked while the card was up goes first: the world is already still, it carries straight on
    if (this.lesson) { const pod = this.lesson; this.lesson = null; this.close(false); this.o.lesson(pod); return; }
    let f;
    while ((f = this.queue.shift())) if (f.e.alive && !f.e.dead && (f.d === 0 || f.e.z < -1) && !this.seen(f.id)) break;
    if (!f) { if (this.safe) this.close(true); return; }
    this.see(f.id);
    this.card = { id: f.id, c: CARDS[f.id] };
    this.autoT = 0;
    // into the slow motion: from full speed, or from part way back out of the last card's (no jump in speed)
    if (!this.safe) { this.t = this.phase === 'out' ? TIP.ease * (1 - this.k) / (1 - TIP.hold) : 0; this.phase = 'in'; this.o.audio.musicLevel(0.5, TIP.ease); }
    this.o.hud.tip(Object.assign({ id: f.id }, this.card.c));
  }
  // SKIP (the button, Space or Enter): -> true if there was a card to skip
  skip(how = 'skip') { if (!this.showing) return false; this.o.input.take('roll'); this.o.input.take('greed'); this.next(how); return true; }
  // the card goes; ease back to speed (or not: the lesson takes the frozen world as it is). The ship picks up from
  // where it is, so neither the press that skipped nor a pointer parked on the SKIP button steers it.
  close(ease) {
    const { hud, input, ship, box, G, audio } = this.o;
    hud.tip(null);
    this.queue.length = 0;
    input.tx = ship.x / box.x; input.ty = ship.y / box.y; input.mouseActive = false;
    if (ease) { this.phase = 'out'; this.t = 0; audio.musicLevel(G.greedOn ? 1.12 : 1, TIP.ease); }
    else { this.phase = ''; this.k = 1; }
  }
  // real seconds in; the world's speed for this frame out
  tick(dt) {
    this.t += dt;
    if (this.phase === 'in' || this.phase === 'hold') {
      this.o.input.take('roll'); this.o.input.take('greed'); // a press while it reads would only be wasted
      if (this.phase === 'in') { this.k = 1 - (1 - TIP.hold) * smooth(Math.min(1, this.t / TIP.ease)); if (this.t >= TIP.ease) this.phase = 'hold'; }
      else this.k = TIP.hold;
      this.autoT += dt;
      this.o.hud.tipLeft(Math.max(0, 1 - this.autoT / TIP.auto));
      if (this.autoT >= TIP.auto) this.next('auto');
    } else if (this.phase === 'out') {
      this.k = TIP.hold + (1 - TIP.hold) * smooth(Math.min(1, this.t / TIP.ease));
      if (this.t >= TIP.ease) { this.phase = ''; this.k = 1; }
    } else this.k = 1;
    return this.k;
  }
  // a new run, the menus, the end of a run: no card, nothing queued, full speed, the music back up
  reset() {
    if (this.card) this.log.push({ id: this.card.id, how: 'off' });
    if (this.safe) this.o.audio.musicLevel(1, 0.3);
    if (this.lesson) { this.lesson.hold = undefined; this.lesson = null; }
    this.card = null; this.queue.length = 0; this.phase = ''; this.k = 1; this.t = 0; this.autoT = 0;
    this.o.hud.tip(null);
    this.mode = tipsMode(); this.live = this.enabledNow(); this.memo.clear(); // (NEW GAME may have erased the save since)
  }
}
