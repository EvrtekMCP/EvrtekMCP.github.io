// DEGEN DRIFT: the driving HUD, read at a glance (day 3 art pass). Top centre: the banked total, small. Under it the live
// chain, the thing to watch: the points so far, big, beside the multiplier in a badge whose colour climbs x1 to x10 and
// whose ring is the link window draining (amber), the zone you are in (cyan, full) or, in the sweet spot, the hold
// filling toward its next step (pink, once round a second; 11-18); the badge kicks at every step, harder for a
// switchback (two steps at once). Under that one word for where you are (IN THE ZONE, SWEET SPOT, LINK IT, SLIDING).
// Bottom centre: speed, gear, revs and the slide angle. Top left: lap progress and the car's condition. Top right:
// pause and the nitrous gauge.
// The markup is made here (index.html keeps an empty #hud); the methods and their arguments are unchanged, so main.js
// feeds it exactly as before. Extras hang off it without main.js: the best run's ghost and a duel (ui.js attaches
// them) get every frame of a run through update(). (11-18 (2): the first-run tip card that hung here is gone; the tips
// are on a race's loading screen, js/tips.js.)
import * as ART from './art.js?v=0.1.25';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const RING = 2 * Math.PI * 27;
// x1 to x10 (11-18: the cap was x6): violet-grey, cyan, violet, pink, orange, then golds to white-gold at the top
const MULT_COL = ['#a99cc8', '#a99cc8', '#36f2ff', '#8a5cff', '#ff3fa4', '#ff7a3c', '#ffb347', '#ffc85a', '#ffd36a', '#ffe08a', '#fff2c4'];

const MARKUP = `
  <div class="hud-tl">
    <div class="lapbar"><i id="h-lapfill"></i></div>
    <div class="lap"><span id="h-lap">0%</span><span id="h-time">0:00.0</span></div>
    <div class="cond" id="h-cond"></div>
  </div>
  <div class="hud-top"><div class="total-label">BANKED</div><div class="total num" id="h-total">0</div></div>
  <div class="chain" id="h-chain">
    <div class="chain-row">
      <span class="acc num" id="h-acc">0</span>
      <div class="multb" id="h-multb">
        <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" class="mtrack"/><circle cx="32" cy="32" r="27" class="mfill" id="h-ring" transform="rotate(-90 32 32)"/></svg>
        <span class="mult num" id="h-mult">×1</span>
      </div>
    </div>
    <div class="state" id="h-state"></div>
  </div>
  <div class="pops" id="h-pops"></div>
  <div class="hud-bottom">
    <svg class="angle" id="h-angle" viewBox="0 0 200 110" aria-hidden="true">
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="8"/>
      <path d="M38 64 L30 58 M100 20 V10 M162 64 L170 58" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
      <path id="h-angle-arc" d="M20 100" fill="none" stroke="url(#gAngle)" stroke-width="8" stroke-linecap="round"/>
      <defs><linearGradient id="gAngle" x1="0" x2="1"><stop offset="0" stop-color="#36f2ff"/><stop offset="1" stop-color="#ff3fa4"/></linearGradient></defs>
    </svg>
    <div class="speed"><span class="num" id="h-speed">0</span><small>KM/H</small></div>
    <div class="gear"><span class="gbox num" id="h-gear">1</span><div class="rpm"><div id="h-rpm"></div></div></div>
  </div>
  <div class="hud-tr">
    <button id="pause-btn" class="icon-btn" aria-label="Pause"><svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg></button>
    <div class="nosbar" id="h-nos" hidden><div id="h-nos-fill"></div><span>N2O</span></div>
  </div>
  <div class="center-msg" id="h-msg"></div>
  <div class="flash" id="h-flash"></div>`;

export class Hud {
  constructor() {
    this.root = $('hud');
    this.root.innerHTML = MARKUP;
    this.e = { total: $('h-total'), chain: $('h-chain'), acc: $('h-acc'), mult: $('h-mult'), multb: $('h-multb'), ring: $('h-ring'), state: $('h-state'), pops: $('h-pops'), speed: $('h-speed'), gear: $('h-gear'), rpm: $('h-rpm'), arc: $('h-angle-arc'), lap: $('h-lap'), lapfill: $('h-lapfill'), time: $('h-time'), cond: $('h-cond'), nos: $('h-nos'), nosFill: $('h-nos-fill'), msg: $('h-msg'), flash: $('h-flash'), tips: $('h-tips') };
    this.e.ring.style.strokeDasharray = `${RING} ${RING}`;
    this.last = {}; this.condKey = '';
    this.extras = []; // things that want every frame of a run: { frame(car, score, run), visible(on) }
  }
  attach(x) { this.extras.push(x); }
  show(on) { this.root.classList.toggle('off', !on); for (const x of this.extras) if (x.visible) x.visible(on); }
  set(key, el, text) { if (this.last[key] !== text) { this.last[key] = text; el.textContent = text; } }
  update(car, sc, run, nosOwned, linkWindow) {
    const e = this.e;
    this.set('total', e.total, fmt(sc.total));
    const live = sc.acc > 0;
    e.chain.classList.toggle('live', live || sc.drifting);
    this.set('acc', e.acc, '+' + fmt(sc.acc));
    const m = Math.max(1, Math.round(sc.mult * 4) / 4);
    if (this.last.m !== m) {
      const up = m - (this.last.m || 1);
      this.last.m = m; e.mult.textContent = '×' + (Number.isInteger(m) ? m : m.toFixed(1)); e.multb.style.setProperty('--mc', MULT_COL[Math.min(MULT_COL.length - 1, Math.floor(m))]);
      e.multb.classList.remove('bump', 'bump2'); void e.multb.offsetWidth; if (m > 1 && up > 0) e.multb.classList.add(up >= 2 ? 'bump2' : 'bump');
    }
    // the ring: the link window draining, the zone you are in (full), the sweet spot's hold filling (11-18), or nothing
    const st = sc.inZone && sc.drifting ? (sc.sweet ? 'sweet' : 'zone') : sc.linkOpen ? 'linkwin' : sc.drifting ? 'drift' : '';
    const f = sc.linkOpen ? Math.max(0, sc.linkT / linkWindow) : st === 'sweet' ? (sc.holdFrac ?? 1) : st === 'zone' ? 1 : 0;
    const off = (RING * (1 - f)).toFixed(1);
    if (this.last.off !== off) { this.last.off = off; e.ring.style.strokeDashoffset = off; }
    if (this.last.st !== st) {
      this.last.st = st; e.state.className = 'state ' + st; e.multb.dataset.st = st; e.chain.dataset.st = st;
      e.state.textContent = { sweet: 'SWEET SPOT', zone: 'IN THE ZONE', linkwin: 'LINK IT', drift: 'SLIDING', '': '' }[st];
    }
    this.set('speed', e.speed, String(Math.round(car.speed * 3.6)));
    this.set('gear', e.gear, car.gear < 0 ? 'R' : String(car.gear));
    const rp = Math.min(1, car.rpm / car.T.car.redline);
    e.rpm.style.transform = `scaleX(${rp.toFixed(3)})`; e.rpm.classList.toggle('red', rp > 0.92);
    // the slide angle as an arc (0 to 70 degrees)
    const a = Math.min(70, Math.abs(car.beta) * 57.3), th = a / 70 * Math.PI, x = 100 - 80 * Math.cos(th), y = 100 - 80 * Math.sin(th);
    const d = a < 0.5 ? 'M20 100' : `M20 100 A80 80 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`;
    if (this.last.arc !== d) { this.last.arc = d; e.arc.setAttribute('d', d); }
    const pr = Math.max(0, Math.min(1, run.progress));
    this.set('lap', e.lap, Math.floor(pr * 100) + '%');
    if (this.last.pr !== Math.floor(pr * 200)) { this.last.pr = Math.floor(pr * 200); e.lapfill.style.transform = `scaleX(${pr.toFixed(3)})`; }
    const t = run.time; this.set('time', e.time, Math.floor(t / 60) + ':' + (t % 60).toFixed(1).padStart(4, '0'));
    e.nos.hidden = !nosOwned;
    if (nosOwned) { e.nosFill.style.transform = `scaleX(${car.nosCharge.toFixed(3)})`; e.nos.classList.toggle('on', car.nosOn); }
    for (const xx of this.extras) if (xx.frame) xx.frame(car, sc, run);
  }
  condition(dmg, pct) {
    const key = JSON.stringify(dmg) + pct; if (key === this.condKey) return; this.condKey = key;
    this.e.cond.innerHTML = ART.conditionCar(dmg) + `<span class="num">${pct}%</span>`;
  }
  pop(text, cls) {
    const d = document.createElement('div'); d.className = 'pop ' + cls; d.textContent = text;
    this.e.pops.appendChild(d); d.addEventListener('animationend', () => d.remove()); setTimeout(() => d.remove(), 8000);
    while (this.e.pops.children.length > 3) this.e.pops.firstChild.remove();
  }
  msg(text) { const m = this.e.msg; m.textContent = text; m.classList.remove('show'); void m.offsetWidth; m.classList.add('show'); }
  flash() { const f = this.e.flash; f.classList.add('hit'); setTimeout(() => f.classList.remove('hit'), 60); }
}
