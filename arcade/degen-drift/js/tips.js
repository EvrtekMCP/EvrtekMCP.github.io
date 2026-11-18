// DEGEN DRIFT: the first-run tips. Three short cards with a moving picture each. 11-17 (Evrtek, having played the test
// on his phone: "You can't drop tutorials on top of the game while it's playing. If the tip is critical the game needs
// to pause while the player reads it."): nothing that teaches shows over live driving any more.
//   1 DRIFT IN THE ZONE, how a run scores (nobody can play without it): it holds the first run on the line, before its
//     count. The game stands still under the card (main.js hold(): the car, the run's clock, a rival, the ghost and the
//     score frozen, the sound quiet as in pause); play comes back only on Got it (a tap, Enter, Space, a pad's A or
//     Start, and not in the card's first 0.6 s, so a tap already on its way cannot dismiss it), and the start's 3-2-1
//     runs before the car is the player's.
//   2 HIT THE SWEET SPOT and 3 LINK THE CORNERS (they add to a score; you can play without them): off the road, on a
//     results screen, one per screen, in order, once the first has been read.
// Each shows once per profile (the ones seen are kept: 'done' once all three are); Settings can bring them back. Wired
// through the HUD (hud.attach) and the results screens, so main.js knows only hold() and unhold().
import * as ART from './art.js?v=0.1.0';

const KEY = 'driftline.tips.v1', ALL = [0, 1, 2];
const read = () => { try { const v = localStorage.getItem(KEY); if (v === 'done') return new Set(ALL); const a = JSON.parse(v || '[]'); return new Set(Array.isArray(a) ? a.filter((i) => ALL.includes(i)) : []); } catch (e) { return new Set(); } };
const write = (s) => { try { if (!s.size) localStorage.removeItem(KEY); else localStorage.setItem(KEY, s.size === ALL.length ? 'done' : JSON.stringify([...s])); } catch (e) { /* not kept */ } };
const still = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

// the road and a band through a bend, as in the game (a 120 x 74 picture)
const ROAD = 'M-6 64 C 30 64, 52 60, 70 44 S 104 12, 128 10';
const car = (path, dur, extra = '') => `<g class="dcar">${still() ? '' : `<animateMotion dur="${dur}s" repeatCount="indefinite" rotate="auto" path="${path}"/>`}<g transform="rotate(-28)"><rect x="-5.5" y="-3" width="11" height="6" rx="2" fill="#8a5cff" stroke="#fff" stroke-width="0.8"/><rect x="-1.5" y="-2.3" width="4" height="4.6" rx="1" fill="#140a26"/>${extra}</g></g>`;
const DEMOS = [
  // 1: the zone band glows through the bend; the car slides through it and points rise
  `<path d="${ROAD}" stroke="#2a2440" stroke-width="22" fill="none"/><path d="${ROAD}" stroke="#36f2ff" stroke-width="14" fill="none" opacity="0.22"/>
   <path d="${ROAD}" stroke="#36f2ff" stroke-width="1.4" fill="none" stroke-dasharray="6 10" class="dchev"/>${car(ROAD, 3.4, '<path d="M-6 -2 q-6 -2 -9 1 M-6 2 q-6 2 -9 -1" stroke="#e8e4ee" stroke-width="1.6" fill="none" opacity="0.7"/>')}
   <text x="8" y="16" font-size="11" font-weight="900" font-style="italic" fill="#fff">+260/s</text>`,
  // 2: the pink sweet spot inside the band pays double
  `<path d="${ROAD}" stroke="#2a2440" stroke-width="22" fill="none"/><path d="${ROAD}" stroke="#36f2ff" stroke-width="14" fill="none" opacity="0.2"/>
   <path d="${ROAD}" stroke="#ff3fa4" stroke-width="4" fill="none" opacity="0.9"/>${car(ROAD, 3.4)}
   <text x="8" y="16" font-size="12" font-weight="900" font-style="italic" fill="#ff3fa4">×2</text>`,
  // 3: leave one zone still sliding, reach the next before the ring runs out: the multiplier climbs
  `<path d="M-6 66 C 20 66 30 40 56 40 S 92 66 128 30" stroke="#2a2440" stroke-width="20" fill="none"/>
   <path d="M-6 66 C 14 66 24 52 34 46" stroke="#36f2ff" stroke-width="12" fill="none" opacity="0.25"/><path d="M80 52 C 96 58 110 48 128 30" stroke="#36f2ff" stroke-width="12" fill="none" opacity="0.25"/>
   ${car('M-6 66 C 20 66 30 40 56 40 S 92 66 128 30', 3.6)}
   <g transform="translate(94 18)"><circle r="11" fill="#140a26" stroke="rgba(255,255,255,0.15)" stroke-width="3"/><circle r="11" fill="none" stroke="#ffb347" stroke-width="3" stroke-dasharray="69 69" transform="rotate(-90)">${still() ? '' : '<animate attributeName="stroke-dashoffset" values="0;69;0" dur="3.6s" repeatCount="indefinite"/>'}</circle><text y="4" text-anchor="middle" font-size="10" font-weight="900" font-style="italic" fill="#8a5cff">×3</text></g>`,
];
const TEXT = [
  ['DRIFT IN THE ZONE', 'Every corner has a glowing band on the road. Slide through it to score: the faster you go, the more it pays.'],
  ['HIT THE SWEET SPOT', 'The pink line inside the band pays double. Hold your slide on it as long as you can.'],
  ['LINK THE CORNERS', 'Still sliding as a zone ends? Reach the next one before the ring runs out and the multiplier climbs. Touch a wall and the chain is gone.'],
];
const GUARD = 600; // ms: a held card ignores Got it this soon after it appears

export class Tips {
  constructor(game) {
    this.g = game; this.el = document.getElementById('h-tips'); this.seen = read(); this.holding = -1; this.shownAt = 0;
    this.el.addEventListener('click', (e) => { if (e.target.closest('[data-tip="ok"]')) this.confirm(); });
  }
  get done() { return this.seen.size === ALL.length; }
  again() { this.seen = new Set(); write(this.seen); }
  mark(i) { this.seen.add(i); write(this.seen); }
  // every frame of a run (the HUD calls it): the first card holds the first run on the line, as its count starts (a
  // count cut short, as the tests do, or the 2-1 back from a hold, is never held)
  frame() {
    if (this.holding >= 0 || this.seen.has(0) || this.g.state !== 'countdown' || this.g.rejoin || this.g.count < 3) return;
    if (this.g.hold(this)) this.show(0);
  }
  // a held card: in the middle of the screen over a dimmed, frozen game, with one way on
  show(i) {
    this.holding = i; this.shownAt = performance.now();
    const [title, text] = TEXT[i];
    this.el.classList.add('hold');
    this.el.innerHTML = `<div class="tip big" role="dialog" aria-modal="true" aria-label="${title}"><svg class="demo" viewBox="0 0 120 74" aria-hidden="true">${DEMOS[i]}</svg>
      <div><div class="tk">TIP ${i + 1} OF 3</div>${ART.title(title)}<p>${text}</p>
        <div class="tb"><button class="btn primary" data-tip="ok">Got it</button></div></div></div>`;
  }
  // Got it: the card goes, the game takes back the run (main.js unhold)
  confirm() {
    if (this.holding < 0 || performance.now() - this.shownAt < GUARD) return;
    const i = this.holding; this.holding = -1; this.mark(i);
    this.g.sound.ui('click');
    this.hide();
    this.g.unhold();
  }
  hide() {
    const t = this.el.firstElementChild; this.el.classList.remove('hold');
    if (!t) return; t.classList.add('out'); setTimeout(() => { if (t.parentNode === this.el && this.holding < 0) this.el.innerHTML = ''; }, 360);
  }
  // a results screen (ui.js results, duelResult): the next of the other two not yet seen, as a card in the screen
  forResults() {
    const i = [1, 2].find((k) => !this.seen.has(k));
    if (i === undefined || !this.seen.has(0)) return '';
    this.mark(i);
    const [title, text] = TEXT[i];
    return `<div class="rtip"><svg class="demo" viewBox="0 0 120 74" aria-hidden="true">${DEMOS[i]}</svg><div><div class="tk">TIP ${i + 1} OF 3</div>${ART.title(title)}<p>${text}</p></div></div>`;
  }
  // the HUD shows or hides: a card goes with it
  visible(on) { if (!on) { this.el.innerHTML = ''; this.el.classList.remove('hold'); this.holding = -1; } }
}
