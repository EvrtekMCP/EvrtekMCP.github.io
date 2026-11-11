// RING REAPER 0.6.0, the player pass: FIRST-TIME INTRODUCTIONS (Evrtek 11-10: "Everything introduced well ... a user
// experience pass that is absolutely needed. Every mechanic, hazard, enemy behaviour and power-up gets a clear first
// introduction at the right moment: short, readable, and non-blocking where possible. Re-use and fix the written tutorial
// cards; cut what's noise"). This supersedes 0.4.0's ruling (11-07: cards for the six power-ups only, each one stopping
// the game until SKIP) for the first-time experience.
//
// The first time a player meets a thing in CARDS, a card says what it is and what to do about it, in two short lines.
// NOTHING STOPS: there is no SKIP to press and no hold. There are two kinds of card:
//   a DIP   for a thing on the course you have to deal with (a hazard, an enemy, a boss, a pickup): it shows a beat before
//           the thing reaches you (on screen, about TIP.lead seconds out), the world eases into slow motion for a moment so
//           there is time to read it and still act, and a bracket on the screen marks the thing it is talking about. You
//           fly all through it: steering, rolling and GREED work, and whatever hits you still hits (slowly).
//   a NOTE  for a rule of the game that has just happened to you (your first multiplier step, your first graze, GREED
//           filling up): a smaller card, no slow motion at all.
// Each card shows once per player: the seen set is kept beside the records (levels.js Progress.seen), and NEW GAME's erase
// clears it. Cards never stack: they come one after another with a breath between; a thing that has flown past before its
// turn keeps its card for the next time it is met. Options' TIPS switch turns them all off; ?test and the autopilot never
// see them (the bots and the release check fly exactly as before); ?tips=1 or #tips-1 forces them on.
// The one thing that DOES stop the world is the first roll (main.js, the roll lesson, level 1): the move the whole game
// turns on gets a staged moment of its own. No card shows while it runs.
//
// This file owns the cards and the clock; main.js owns the game it slows (the same frame scale the roll lesson uses) and
// tells it what just happened (tips.event); hud.js draws the card and the bracket.
import { store } from './util.js?v=0.6.1';
import { param } from './params.js?v=0.6.1';
import { POWERUPS } from './powerups.js?v=0.6.1';

export const TIP = {
  ease: 0.25,    // seconds into a dip's slow motion
  out: 0.45,     // ...and back out of it
  slow: 0.3,     // the world's speed in a dip
  dip: 2.0,      // real seconds a hazard's or a boss's dip lasts (about 0.6 s of the world's time)
  dipItem: 1.3,  // ...a pickup's (less to do about it)
  show: 4.4,     // seconds a hazard's card stays up (it outlasts its slow motion)
  showItem: 3.6, // ...a pickup's
  note: 3.8,     // seconds a note stays up
  yield: 1.6,    // ...but once it has had this long it gives way to a card about something that is nearly on you
  first: 2.4,    // seconds STEERING (the first card of all) has to itself before anything else may show
  gap: 0.45,     // seconds between one card going and the next coming
  lead: 2.6,     // a thing gets its card when it is this many seconds out (the beat before you have to act)...
  far: 380,      // ...or this close in metres, whichever is nearer (at top speed 2.6 s is deep in the haze)
  queue: 4,      // at most this many wait their turn; anything more waits for the next time it is met
  noteWait: 9,   // seconds a note may wait in the queue before it is dropped for another day
};

// ---- the cards. Two short lines each: what it is, then what it does for you or what to do about it. Said the way a
// friend leaning over your shoulder would say it.
//   keyed by kind name for things on the course ('cache' is a ring with ev.cache), by 'boss-<name>' for a boss, and by
//   the event's name for a rule of the game (main.js tips.event: 'steer', 'mult', 'greed' ...)
//   icon  art/<icon>.png (+@2x), Kalakar's HUD icons for the power-ups. None yet for the rest: glyph draws a placeholder
//         (collect: an amber ring; hurt: a red warning; ally: a soft blue disc; rule: a white dot)
//   art   her lettered call-out (art/<art>-glow.png) used as the card's title, where she has lettered that name
//   born  show this many seconds after it appears, wherever it is (a thing that comes from behind you)
//   say   two lines, or a function of { input } that returns them (a line that names the player's own keys)
const pu = (id) => ({ power: true, icon: 'ui/pu/hud-' + POWERUPS[id].kind, art: POWERUPS[id].kind, color: POWERUPS[id].css });
const item = (o) => Object.assign({ item: true, kind: 'dip', glyph: 'collect' }, o);
const hurt = (name, a, b, o) => Object.assign({ name, say: [a, b], glyph: 'hurt', kind: 'dip' }, o);
const boss = (name, a, b) => ({ name, say: [a, b], glyph: 'hurt', kind: 'dip', boss: true });
const note = (name, a, b, o) => Object.assign({ name, say: typeof a === 'function' ? a : [a, b], glyph: 'rule', kind: 'note' }, o);
const touch = (input) => input && input.mode === 'touch';
export const CARDS = {
  // ---- the rules of the game, as they first happen to you (notes: no slow motion)
  'steer': note('STEERING', ({ input }) => (touch(input) ? ['Drag anywhere to steer. The ship follows your thumb.', 'Double-tap to barrel roll.']
    : ['Move the mouse to steer, or use WASD or the arrow keys.', input.say('roll') + ' is your barrel roll.'])),
  'mult': note('MULTIPLIER', 'Every five rings in a row step it up, as far as x8.', 'Miss a ring or take a hit and it steps back down.'),
  'stars': note('STARS', 'Your score earns the stars. The meter is under your score.', 'Build the multiplier, then hold it: that is where the points are.'),
  'shield': note('SHIELD', 'That came off your shield, top right.', 'Rings patch it a little. If it empties, you are down.'),
  'graze': note('GRAZE', 'A shot that only just misses you pays points.', 'The closer it was, the more it pays. It fills GREED too.'),
  'close': note('CLOSE CALL', 'Skimming past something solid pays points.', 'It fills your GREED meter as well.'),
  'roll-ring': note('ROLL-RING', 'A ring you take in the middle of a roll pays double.', 'It tops up GREED while it is at it.'),
  'multi': note('MULTI-DEFLECT', 'One roll can send a whole burst of shots back.', 'Each one pays more than the one before.'),
  'perfect': note('PERFECT', 'Every ring of that sector, caught.', 'Each perfect sector is a bonus on your score.'),
  'greed': note('GREED IS READY', ({ input }) => [(touch(input) ? 'Tap the GREED button' : 'Press ' + input.say('greed')) + ': everything scores double for 8 seconds.',
    'You fly faster and rings stop healing you. It pays most at a high multiplier.']),
  'net': note('SPRAY', 'That one is too wide to steer round.', 'Roll through it and the whole spray goes back.', { glyph: 'hurt' }),
  'white-hot': note('WHITE-HOT FIRE', 'A roll will not send this one back.', 'Get out of its way.', { glyph: 'hurt' }),
  'edge': note('SIDE WARNING', 'A red marker on the edge of the screen', 'means a shot is coming from where you cannot see it.', { glyph: 'hurt' }),
  'clang': note('CLANG', 'It was not open, so your shot bounced off.', 'Send them back while the weak point glows.', { glyph: 'hurt' }),
  'boss-cell': note('SHIELD CELL', 'A boss you have half beaten drops one, off to the side.', 'Go and get it, or hold your ground. Your call.', pu('shield')),

  // ---- the pickups
  'ring': item({ name: 'RINGS', say: ['Fly through the middle of each one.', 'They score, and each one tops up your shield.'] }),
  'boost-ring': item({ name: 'BOOST RINGS', say: ['These come in a chain.', 'Fly through every one and you get a speed burst.'] }),
  'gate': item({ name: 'LIGHTGATE', say: ['Fly through the opening for a bonus.', 'The frame hurts, so take it through the middle.'] }),
  'checkpoint': item({ name: 'CHECKPOINT', glyph: 'ally', say: ['Fly through it and your run is banked.', 'If your shield runs out later, you can start again from here.'] }),
  'cache': item({ name: 'CACHE', art: 'cache', say: ['A bonus ring, tucked off the main line.', 'Grab it for points. Missing it costs nothing.'] }),
  'g2-shoal': item({ name: 'SHOAL', art: 'shoal', say: ['These rings swim together, like fish.', "When the leader's tail flashes white, they're about to turn."] }),
  'g3-vault-ring': item({ name: 'VAULT RINGS', say: ["The vault's open. These rings are all yours.", 'Every one scores, so grab the lot.'] }),
  // what a struck boss spills: shield you fly through (the Lattice Heart, the Rootmind, the Weftwork)
  'l10-energy': item({ name: 'BEACON ENERGY', say: ['A spark knocked loose from the Heart.', 'Fly through it and it tops up your shield.'] }),
  'g2-rootmind-sap': item({ name: 'SAP-LIGHT', say: ['Light spilling from the knot you just hit.', 'Fly through it and it tops up your shield.'] }),
  'g3-weft-light': item({ name: 'THREAD-LIGHT', say: ['Light spilling from the reed you just hit.', 'Fly through it and it tops up your shield.'] }),
  // the six power-ups
  'shield-cell': item({ name: 'SHIELD CELL', ...pu('shield'), say: ['Half your shield back, parked off the ring line.', 'Leave the rings for it, or keep your multiplier. Your call.'] }),
  'overclock': item({ name: 'OVERCLOCK', ...pu('overclock'), say: ['Juice for your barrel roll.', 'Grab it and you can roll almost nonstop.'] }),
  'mirror-shell': item({ name: 'MIRROR SHELL', ...pu('mirror'), say: ['A mirror coat for your ship.', 'Your rolls catch shots from farther away.'] }),
  'phase': item({ name: 'PHASE', ...pu('phase'), say: ['Turns you into a ghost for a bit.', 'Fly right through rocks and walls. Shots still hurt.'] }),
  'ring-magnet': item({ name: 'RING MAGNET', ...pu('magnet'), say: ['A magnet, but for rings.', 'Grab it and nearby rings fly to you.'] }),
  'slipstream': item({ name: 'SLIPSTREAM', ...pu('slip'), say: ['This one slows down time.', 'Everything but you goes half speed for a while.'] }),

  // ---- galaxy 1's hazards (plain walls that only sit there get no card: they explain themselves)
  'rock': hurt('ROCKS', 'Hit one and you lose shield and your whole multiplier.', 'Skim past close, though, and it pays.'),
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
  'g3-forgery': hurt('FORGERY', 'A cheap copy of you, stealing your rings.', "Roll a turret's shot back: it bursts and its rings fly home."),
  'g3-forge-turret': hurt('FORGE TURRET', 'Its shots go after the forgery.', "Roll them back. The white line shows where they'll go."),
  'g3-riveter': hurt('RIVETER', 'It fires strings of shots on the beat.', 'Each red light is one more shot. Roll every one.'),
  'g3-fractal': hurt('FRACTAL', 'Send its shot back and it splits in two.', 'More pieces, more points. Or just let it drift off.'),
  'g3-l8-breeder': hurt('BREEDER', 'The big one makes more fractals.', 'She makes one for every fractal you let go.'),
  'g3-vault': hurt('VAULT', 'A vault full of rings.', 'It only opens while your GREED is lit.', { art: 'vault' }),
  'g3-warp-thread': hurt('WARP THREAD', 'A tight thread across the lane.', 'When it gets plucked it swings wide. Stay clear.'),
  'g3-heddle': hurt('HEDDLE', 'The gap between the threads moves.', "The white outline shows where it'll be."),

  // ---- the twelve bosses, as each fight begins: the one thing you need to know to hurt it (boss.js asks by its name)
  'boss-warden': boss('THE WARDEN', 'Only its own shots can hurt it.', 'When a core opens its petals, roll its shots back into it.'),
  'boss-leviathan': boss('THE LEVIATHAN', 'Only its own shots can hurt it.', 'Roll them back into the one red lens lit on its back.'),
  'boss-twins': boss('THE TWINS', 'Mirror plate up: wait, your shot would bounce back at you.', 'Plate down and the core glowing: send it back now.'),
  'boss-lattice-heart': boss('THE LATTICE HEART', 'A plate slides open just before its hinge fires.', 'Roll those shots back into the open hinge.'),
  'boss-g2-whirlmaw': boss('THE WHIRLMAW', 'It breathes in and pulls you toward its mouth. Steer against it.', 'When it breathes out its gills light green: roll its spit back.'),
  'boss-g2-snare': boss('THE SNARE', "It is after the mother whale, not you.", 'Get in front of its shots and roll them back into its lit flank.'),
  'boss-g2-murmur': boss('THE MURMUR', "You can't hurt the flock, only the Queen inside it.", 'When an eye opens round her, roll her shots back.'),
  'boss-g2-rootmind': boss('THE ROOTMIND', 'Its knots swing round to you one at a time.', 'When one goes white and fires, roll the fan back into it.'),
  'boss-g3-foreman': boss('THE FOREMAN', 'Roll its shots into the lit keystones to knock a panel out.', 'With a side open, the next shot you send back hits the core.'),
  'boss-g3-counterfeit': boss('THE COUNTERFEIT', 'It rolls your shots straight back at you.', 'When its ring burns out orange, one roll sends the turret pair home.'),
  'boss-g3-high-roller': boss('THE HIGH ROLLER', 'Its core only opens while your GREED is lit.', 'Graze its fire to fill the meter, cash in, then roll its shots back.'),
  'boss-g3-weftwork': boss('THE WEFTWORK', 'It shows its pattern in white, then fires it in the same rhythm.', 'Roll on the notes, and the shots fly to the lit roots.'),
};

// The kinds that get NO card, on purpose ("cut what's noise"): solid things that only sit there (the ROCKS card speaks for
// all of them: hit one and it costs you, skim one and it pays), the lesson's own pod, and the pieces a boss throws that its
// own card covers. check-levels fails any OTHER kind on a level's course that has no card, so nothing new ships unintroduced.
export const NO_CARD = ['l2-tutor-pod', 'crystal', 'girder', 'pylon', 'rib', 'l5-wall', 'l6-spur', 'l6-curtain', 'l6-fork', 'l8-spar', 'l9-shard', 'l10-debris',
  'g2-l1-coral', 'g2-l2-wall', 'g2-l6-wall', 'g2-l7-wall', 'g2-l10-root-wall', 'g3-l8-wall', 'g3-l10-thread-wall'];

// which card an entity on the course is, or null (scenery copies, warm-up samples and hidden things never are)
export function cardOf(e) {
  const k = e.kind, ev = e.ev || {};
  if (!k || e.decor || ev.decor || ev.warm || ev.gallery) return null;
  if (ev.cache && (k.name === 'ring' || ev.payout)) return 'cache'; // a cache ring, or a High Roller payout (a cache too)
  if (ev.bossCell) return null;                                      // the cell a boss drops has its own note (boss.js)
  return CARDS[k.name] && CARDS[k.name].kind === 'dip' ? k.name : null;
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
  // o: { hud, audio, input, Progress, G, onScreen(x, y, z) }
  constructor(o) {
    this.o = o; this.mode = tipsMode(); this.live = this.enabledNow();
    this.k = 1; this.card = null; this.queue = []; this.gapT = 0; this.hold = false;
    this.memo = new Map(); // the seen set, read once from the save (a scan asks every frame)
    this.log = [];         // what showed this page load: { id, kind } (the tests read it)
  }
  seen(id) { let s = this.memo.get(id); if (s === undefined) { s = this.o.Progress.seen(id); this.memo.set(id, s); } return s; }
  see(id) { this.memo.set(id, true); this.o.Progress.see(id); }
  // on for this run? (read at each run's start: the switch lives in Options, never in flight)
  enabledNow() { return this.mode === 'forced' || (this.mode === 'player' && tipsSetting()); }
  enabled() { return this.live; }
  get showing() { return !!this.card; }
  // 0.4.0's cards made the ship safe while one was up. Nothing stops now, so nothing is safe: kept for the callers that ask.
  get safe() { return false; }
  waiting(id) { return (this.card && this.card.id === id) || this.queue.some((q) => q.id === id); }

  // every frame of play, after the step: anything new and in view joins the queue, nearest first
  scan(list, v) {
    if (!this.enabled() || this.hold) return;
    // STEERING comes first of all: nothing on the course gets a card until it has had its moment
    if (!this.seen('steer') || (this.card && this.card.id === 'steer' && this.card.t < TIP.first)) return;
    const near = Math.min(TIP.far, TIP.lead * Math.max(30, v));
    for (const e of list) {
      if (!e.alive || e.dead) continue;
      const id = cardOf(e); if (!id || this.seen(id) || this.waiting(id)) continue;
      const c = CARDS[id];
      if (c.born !== undefined) { if (e.t >= c.born) this.push({ id, e, d: 0 }); continue; }
      if (!(e.z < -2) || -e.z > near || (e.obj && !e.obj.visible) || !this.o.onScreen(e.x, e.y, e.z)) continue;
      this.push({ id, e, d: -e.z });
    }
  }
  // a rule of the game has just happened (main.js), or a boss fight has begun (boss.js, 'boss-<name>'): its card, once.
  // at: the thing to put the bracket on, if there is one. -> true if it will show
  event(id, at = null) {
    if (!this.enabled() || !CARDS[id] || this.seen(id) || this.waiting(id)) return false;
    return this.push({ id, e: at, d: 0, t: this.o.G.time });
  }
  push(f) {
    if (this.queue.length >= TIP.queue) return false;
    this.queue.push(f);
    // things on the course first, nearest first (they will not wait); then the notes, in the order they happened
    this.queue.sort((a, b) => (CARDS[a.id].kind === 'dip' ? 0 : 1) - (CARDS[b.id].kind === 'dip' ? 0 : 1) || a.d - b.d);
    return true;
  }
  // the next card in the queue that still makes sense (its thing is still ahead; a note has not gone stale)
  next() {
    let f;
    while ((f = this.queue.shift())) {
      const c = CARDS[f.id];
      if (this.seen(f.id)) continue;
      if (c.kind === 'dip' && f.e && f.e.kind && !(f.e.alive && !f.e.dead && (f.d === 0 || f.e.z < -1))) continue; // it flew past: next time
      if (c.kind === 'note' && f.t !== undefined && this.o.G.time - f.t > TIP.noteWait) continue;               // too late to mean anything
      break;
    }
    if (!f) return;
    const c = CARDS[f.id], dip = c.kind === 'dip';
    this.see(f.id);
    this.card = { id: f.id, c, e: f.e || null, t: 0, slow: dip ? (c.item ? TIP.dipItem : TIP.dip) : 0, life: dip ? (c.item ? TIP.showItem : TIP.show) : TIP.note, ducked: dip };
    this.log.push({ id: f.id, kind: c.kind });
    const say = typeof c.say === 'function' ? c.say({ input: this.o.input }) : c.say;
    if (dip) this.o.audio.musicLevel(0.72, TIP.ease);
    this.o.hud.tip(Object.assign({}, c, { id: f.id, say, life: this.card.life }));
  }
  // the thing the card on screen is about, while it is still ahead (hud.js puts the bracket on it), or null
  mark() { const q = this.card; return q && q.e && q.e.alive !== false && !q.e.dead && q.e.z < -3 && q.t < q.life - 0.4 ? q.e : null; }
  // the roll lesson takes the stage: whatever card is up goes, and nothing shows until it is done (hold(false))
  stage(on) { this.hold = on; if (on) { if (this.card) this.away(); this.queue.length = 0; this.k = 1; } }
  away() {
    const q = this.card; if (!q) return;
    if (q.ducked && q.t < q.slow + TIP.out) this.o.audio.musicLevel(this.o.G.greedOn ? 1.12 : 1, 0.3);
    this.card = null; this.gapT = TIP.gap; this.o.hud.tip(null);
  }
  // real seconds in; the world's speed for this frame out (1 unless a dip is slowing it)
  tick(dt) {
    let want = 1;
    const q = this.card;
    if (q) {
      const was = q.t; q.t += dt;
      if (q.t < q.slow) want = TIP.slow;
      else if (q.ducked && was < q.slow) this.o.audio.musicLevel(this.o.G.greedOn ? 1.12 : 1, TIP.out); // the dip is over: the music comes back up
      this.o.hud.tipLeft(Math.max(0, 1 - q.t / q.life));
      // a note that has had its moment gives way to a card about something on the course (that one cannot wait)
      const pushy = q.c.kind === 'note' && q.t >= TIP.yield && this.queue.length && CARDS[this.queue[0].id].kind === 'dip';
      if (q.t >= q.life || pushy) this.away();
    } else if (!this.hold) {
      this.gapT = Math.max(0, this.gapT - dt);
      if (this.gapT <= 0 && this.queue.length) this.next();
    }
    // ease the world toward the speed wanted: quick in, a little slower out
    const rate = want < this.k ? 1 / TIP.ease : 1 / TIP.out;
    this.k += (want - this.k) * Math.min(1, dt * rate * 3);
    if (Math.abs(want - this.k) < 0.01) this.k = want;
    return this.k;
  }
  // a new run, the menus, the end of a run: no card, nothing queued, full speed, the music back up
  reset() {
    if (this.card) this.away();
    this.queue.length = 0; this.k = 1; this.gapT = 0; this.hold = false;
    this.o.hud.tip(null);
    this.mode = tipsMode(); this.live = this.enabledNow(); this.memo.clear(); // (NEW GAME may have erased the save since)
  }
}
