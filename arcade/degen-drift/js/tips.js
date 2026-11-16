// DEGEN DRIFT: the first-run tips. Three short cards with a moving picture each, shown during the player's first run:
// how zones score (at the start), the sweet spot (the first time they slide in a zone), linking (the first time a link
// window opens). Each stays about six seconds; a Skip ends them; once seen or skipped they never come back (Settings
// can bring them back). They sit under the chain, clear of the road, and never pause the game. Wired through the HUD
// (hud.attach), so main.js knows nothing of them.
import * as ART from './art.js?v=0.1.0';

const KEY = 'driftline.tips.v1';
const read = () => { try { return localStorage.getItem(KEY) === 'done'; } catch (e) { return false; } };
const write = (v) => { try { if (v) localStorage.setItem(KEY, 'done'); else localStorage.removeItem(KEY); } catch (e) { /* not kept */ } };
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

export class Tips {
  constructor(game) {
    this.g = game; this.el = document.getElementById('h-tips'); this.done = read();
    this.step = -1; this.since = 0; this.shownAt = 0; this.cur = -1; this.runT = -1;
    this.el.addEventListener('click', (e) => { if (e.target.closest('[data-tip="skip"]')) { this.g.sound.ui('click'); this.skip(); } });
  }
  again() { write(false); this.done = false; this.step = -1; }
  skip() { this.done = true; write(true); this.hide(); }
  // every frame of a run (the HUD calls it)
  frame(car, sc, run) {
    if (this.done) return;
    const g = this.g; if (g.state !== 'run' && g.state !== 'countdown') return;
    if (run.time < this.runT - 0.5) { this.step = -1; this.hide(); } // a new run (restart): start the tips over
    this.runT = run.time;
    const now = performance.now() / 1000, up = this.cur >= 0 ? now - this.shownAt : 0;
    if (this.cur >= 0 && up > (this.cur === 2 ? 7.5 : 6.2)) { if (this.cur === 2) { this.skip(); return; } this.hide(); }
    if (this.cur >= 0) return;
    const wait = now - this.since;
    if (this.step === -1) this.show(0);
    else if (this.step === 0 && ((sc.inZone && sc.drifting && wait > 1.5) || wait > 9)) this.show(1);
    else if (this.step === 1 && ((sc.linkOpen && wait > 1) || wait > 10)) this.show(2);
  }
  show(i, force = false) {
    if (this.done && !force) return;
    this.step = i; this.cur = i; this.shownAt = performance.now() / 1000;
    const [title, text] = TEXT[i];
    this.el.innerHTML = `<div class="tip" role="status"><svg class="demo" viewBox="0 0 120 74" aria-hidden="true">${DEMOS[i]}</svg>
      <div><div class="tk">TIP ${i + 1} OF 3</div>${ART.title(title)}<p>${text}</p>
        <div class="tb"><span class="dots">${[0, 1, 2].map((k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</span><button data-tip="skip">${i === 2 ? 'Got it' : 'Skip tips'}</button></div></div></div>`;
  }
  hide() {
    const t = this.el.firstElementChild; this.cur = -1; this.since = performance.now() / 1000;
    if (!t) return; t.classList.add('out'); setTimeout(() => { if (t.parentNode === this.el && this.cur < 0) this.el.innerHTML = ''; }, 360);
  }
  // the HUD shows or hides: tips go with it
  visible(on) { if (!on) { this.el.innerHTML = ''; this.cur = -1; } }
}
