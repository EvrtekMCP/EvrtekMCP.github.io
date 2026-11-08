// The NOTE LEDGER shared by the Unmade's guns (the riveter's strings and curtains, the fractal's bolts): every bolt
// they fire is booked as the moment it will land (world time, so a Slipstream slows the whole score), and no two land
// less than MIN_GAP apart, a hair over one roll and its recharge (0.95 s), unless they share a pair key: then they land
// together and one roll takes both (the Cross-Stitch's pairs, a fractal's twin children). So however the course is
// flown (GREED and boosts bring guns in sooner), a player who rolls on every note can always make the next one.
export const MIN_GAP = 1.0;
let BOOK = [], lastRun = -1;

// the beat grid of whatever track is playing (a stand-in's own until the level's take lands): seconds to the next beat
export function beatNow(api) {
  const m = api.music && api.music.meta, bpm = (m && m.bpm) || 148, fb = (m && m.firstBeat) || 0, beat = 60 / bpm;
  const pos = api.music && api.music.position ? api.music.position() : api.time;
  return { beat, toBeat: (beat - (((pos - fb) % beat) + beat) % beat) % beat };
}

// book a note that wants to land at world time `want` (or later): returns when it will land. `key` pairs it with an
// earlier booking carrying the same key that lands within 0.35 s (then it lands exactly with that one). `snap` keeps a
// pushed note on the beat grid.
export function bookNote(api, want, key = null, snap = null) {
  const now = api.time;
  if (now < lastRun) BOOK = [];
  lastRun = now;
  if (BOOK.length > 64) BOOK = BOOK.filter((x) => x.a > now - 2);
  if (key) { const mate = BOOK.find((x) => x.key === key && Math.abs(x.a - want) < 0.35); if (mate) return mate.a; }
  let a = want;
  for (let moved = true, guard = 0; moved && guard < 40; guard++) {
    moved = false;
    for (const x of BOOK) if (Math.abs(x.a - a) < MIN_GAP - 1e-6) { a = x.a + MIN_GAP; if (snap) a = snap(a); moved = true; }
  }
  BOOK.push({ a, key });
  return a;
}
