// DEGEN DRIFT: the levels on screen (11-27 (4), Evrtek: "The level up system needs to be something really cool"; then "it
// needs to either be more visual and less wordy"). Every signal is a picture or a number, never a sentence:
//   the rank badge and XP bar (title, garage, course list), the range badge on a course (LV 12-20, coloured against your
//   level, an arrow for bonus or little), the lock (the padlock, the number it needs, a bar of how close), the XP count on
//   a results screen with a chip for each thing that moved it, and the moments: the level-up (the burst, the badge, what
//   opened), a region's splash, the boss's title card. The art is Kalakar's (js/emblems.js, js/ranks.js, art/...).
import { VERSION } from './config.js?v=0.1.26';
import * as G from './garage.js?v=0.1.26';
import * as EM from './emblems.js?v=0.1.26';
import * as ART from './art.js?v=0.1.26';
import { rank, tierOf, toneOf } from './ranks.js?v=0.1.26';
import { REGIONS } from './courses/index.js?v=0.1.26';

const still = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
export const stamped = (p) => `${p}?v=${VERSION}`;
const pct = (f) => (Math.max(0, Math.min(1, f)) * 100).toFixed(1) + '%';
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// ---- small pieces
export const crest = (region, px = 28, cls = '') => `<img class="crest ${cls}" src="${stamped(`art/regions/crest-${region}.svg`)}" width="${px}" height="${px}" alt="" draggable="false">`;
export const carBadge = (id, locked = false, cls = '') => `<img class="carbadge ${cls}" src="${stamped(`art/cars/car-${id}${locked ? '-locked' : ''}.svg`)}" width="240" height="132" alt="" draggable="false">`;
export const rivalTag = (who, px = 28, cls = '') => `<img class="rtag-art ${cls}" src="${stamped(`art/rivals/tag-${who.toLowerCase()}.svg`)}" width="${px}" height="${px}" alt="" draggable="false">`;
export const stampImg = (name, cls = '') => `<img class="stamp ${cls}" src="${stamped(`art/stamps/stamp-${name}.svg`)}" alt="" draggable="false">`;
// the badge, the bar, and the share button (title, garage, course list)
export function levelRow(p, { hex = 30, share = true } = {}) {
  const I = G.levelInfo(p.xp);
  return `<div class="lvrow">${rank(I.level, hex)}<div class="lvbar" aria-label="Level ${I.level}"><i style="width:${pct(I.frac)}"></i></div>${share ? `<button class="icon-btn lvshare" data-act="share" aria-label="Brag">${EM.share(22)}</button>` : ''}</div>`;
}
// a course's suggested level range, coloured against your level: green in it, gold (up arrows) under it, grey over it
export function rangeBadge(p, c) {
  const r = G.range(c), f = G.fit(G.levelOf(p), c);
  const em = f.kind === 'under' ? EM.under(16) : f.kind === 'over' ? EM.over(16) : EM.inRange(16);
  return `<span class="lvr ${f.kind}">${em}${ART.title(`LV ${r.lo}-${r.hi}`, 'lvrt', f.kind === 'under' ? 'gold2' : f.kind === 'over' ? 'grey' : 'green')}</span>`;
}
// a lock on stars: the padlock, the stars it needs, a bar of how close
export function starLock(lock, cls = '') {
  return `<span class="lockb ${cls}">${EM.lock(16)}${ART.title(String(lock.stars), 'lkt', 'lilac')}${EM.star(14)}<span class="lkbar"><i style="width:${pct(lock.have / lock.stars)}"></i></span><small class="num">${lock.have}/${lock.stars}</small></span>`;
}
// a lock on level: the padlock and LV n
export const levelLock = (n, cls = '') => `<span class="lockl ${cls}">${EM.lock(14)}${ART.title('LV ' + n, 'lkt', 'lilac')}</span>`;

// ---- the XP on a results screen: the badge, the bar, the count and its chips
const CHIP = {
  stars: (s) => [EM.star(22), `×${s.mult.toFixed(1)}`, s.mult >= 1 ? 'gold2' : 'grey', s.stars + ' ★'],
  deg: (s) => [EM.degenerate(22), `×${s.mult.toFixed(1)}`, 'hot', 'DEGENERATE'],
  under: (s) => [EM.under(22), `+${Math.round((s.mult - 1) * 100)}% XP`, 'gold2', 'UNDER-LEVEL'],
  over: (s) => [EM.over(22), `-${Math.round((1 - s.mult) * 100)}% XP`, 'grey', 'OVER-LEVEL'],
  first: (s) => [EM.firstClear(22), `+${fmt(s.add)}`, 'cyan', 'FIRST CLEAR'],
  newstar: (s) => [EM.star(22), `+${fmt(s.add)}`, 'gold2', s.n > 1 ? s.n + ' NEW ★' : 'NEW ★'],
  firstdeg: (s) => [EM.degenerate(22), `+${fmt(s.add)}`, 'hot', 'FIRST DEGENERATE'],
  duelwon: (s) => [EM.xp(22), `×${s.mult.toFixed(1)}`, 'pink', 'DUEL WON'],
  duellost: (s) => [EM.xp(22), `×${s.mult.toFixed(2).replace(/0$/, '')}`, 'grey', 'DUEL'],
  firstwin: (s) => [EM.firstClear(22), `+${fmt(s.add)}`, 'cyan', 'FIRST WIN'],
};
const chipHtml = (s) => { const c = (CHIP[s.k] || (() => [EM.xp(22), '+' + fmt(s.add || 0), 'cyan', '']))(s); return `<span class="chip ${c[2]}">${c[0]}${ART.title(c[1], 'ct', c[2])}${c[3] ? `<small>${c[3]}</small>` : ''}</span>`; };
export function xpBlock(X) {
  const I = G.levelInfo(X.from);
  return `<div class="xpbox"><div class="xprow"><span class="xprank">${rank(I.level, 34)}</span>
    <div class="xpmid"><div class="xpbar"><i style="width:${pct(I.frac)}"></i></div><div class="xpchips"></div></div>
    <span class="xpgain">${EM.xp(26)}<span class="xpn">${ART.title('+0', 'xpnum', 'cyan')}</span></span>
    <button class="icon-btn lvshare" data-act="share" aria-label="Brag">${EM.share(22)}</button></div></div>`;
}
// count it in: the base, then each step (a chip pops, the count jumps or drops), the bar filling and rolling over levels.
// X: { from, total, base, steps, L0, L1, opened }. Calls ui.levelUp(level, X) the moment the bar first crosses a level.
export function reveal(ui, root, X, delay = 0) {
  const box = root.querySelector('.xpbox'); if (!box) return;
  const bar = box.querySelector('.xpbar i'), num = box.querySelector('.xpn'), chips = box.querySelector('.xpchips'), badge = box.querySelector('.xprank');
  let L = G.levelInfo(X.from).level, upFired = false;
  const show = (gain) => {
    const I = G.levelInfo(X.from + gain);
    bar.style.width = pct(I.frac); num.innerHTML = ART.title('+' + fmt(gain), 'xpnum', 'cyan');
    if (I.level !== L) {
      L = I.level; badge.innerHTML = rank(L, 34); box.classList.remove('roll'); void box.offsetWidth; box.classList.add('roll');
      if (!upFired) { upFired = true; ui.levelUp(X, L); } else ui.levelUpMore(L);
    }
  };
  const segs = [{ to: X.base, ms: 650 }].concat(X.steps.map((s) => ({ to: s.total, ms: 450, step: s })));
  if (still()) { for (const s of X.steps) chips.insertAdjacentHTML('beforeend', chipHtml(s)); show(X.total); return; }
  let i = 0, from = 0, t0 = 0;
  const run = (now) => {
    if (!box.isConnected) return; // the screen moved on: the count stops with it
    const sg = segs[i]; if (!t0) { t0 = now; if (sg.step) { chips.insertAdjacentHTML('beforeend', chipHtml(sg.step)); const c = chips.lastElementChild; c.classList.add('pop'); ui.g.sound.ui(sg.step.mult != null && sg.step.mult < 1 ? 'click' : 'link', i); } }
    const k = Math.min(1, (now - t0) / sg.ms), e = 1 - Math.pow(1 - k, 3);
    show(Math.round(from + (sg.to - from) * e));
    if (k < 1) { requestAnimationFrame(run); return; }
    from = sg.to; i++; t0 = 0;
    if (i < segs.length) { const id = setTimeout(() => requestAnimationFrame(run), 120); (ui.resTs ||= []).push(id); }
  };
  const id = setTimeout(() => requestAnimationFrame(run), delay); (ui.resTs ||= []).push(id);
}

// ---- the moments: one at a time over the screen they came on. None takes a button away: the screen's buttons work under
// them (they are pictures the finger passes through), a tap anywhere sends one off, and each goes by itself.
export class Moments {
  constructor(ui) {
    this.ui = ui; this.q = []; this.cur = null;
    document.addEventListener('pointerdown', (e) => { if (this.cur && !(e.target.closest && e.target.closest('.moment [data-act]'))) this.next(); }, true);
  }
  clear() { this.q = []; if (this.cur) { clearTimeout(this.cur.t); this.cur.el.remove(); this.cur = null; } }
  add(m) { this.q.push(m); if (!this.cur) this.next(); }
  up() { return !!this.cur; }
  next() {
    if (this.cur) { clearTimeout(this.cur.t); const el = this.cur.el; el.classList.add('out'); setTimeout(() => el.remove(), 260); this.cur = null; }
    const m = this.q.shift(); if (!m) return;
    const host = this.ui.el; if (!host || !host.isConnected) return;
    host.insertAdjacentHTML('beforeend', `<div class="moment ${m.cls}" role="status">${m.html}</div>`);
    const el = host.lastElementChild; this.cur = { el, m, t: setTimeout(() => this.next(), m.ms) };
    if (m.sound) this.ui.g.sound.ui(m.sound);
    if (m.on) m.on(el);
  }
}
// the level-up: the burst behind the new badge, LEVEL N slamming in, the tier's name when it is a new tier, and what the
// level opened (the car's badge, the part's picture), or the next thing a level opens
// the level-up badge's hexagon: 92 px, 58 on a short (phone) screen
export const lvHex = () => (document.documentElement.classList.contains('short') ? 58 : 92);
export function levelUpHtml(p, X) {
  const L1 = X.L1, newTier = tierOf(L1).n !== tierOf(X.L0).n;
  const items = X.opened.filter((o) => o.kind === 'car' || o.kind === 'part').slice(0, 4).map((o) => o.kind === 'car'
    ? `<span class="lvitem car">${carBadge(o.id)}<span class="lvtag">${EM.newCar(20)}${ART.title(o.name, 'lvin', 'pink')}</span></span>`
    : `<span class="lvitem part">${ART.partArt(o.art)}<span class="lvtag">${EM.newPart(20)}${ART.title(o.name, 'lvin', 'gold2')}</span></span>`).join('');
  const nx = items ? null : G.nextUnlock(p, L1);
  const next = nx ? `<span class="lvitem next">${nx.kind === 'car' ? carBadge(nx.id, true) : ART.partArt(nx.art)}<span class="lvtag">${levelLock(nx.level)}${ART.title(nx.name, 'lvin', 'lilac')}</span></span>` : '';
  return `<div class="lvcore"><div class="lvburst">${EM.burst(220)}</div><div class="lvbadge">${rank(L1, lvHex())}</div></div>
    <div class="lvtitle">${ART.title('LEVEL ' + L1, 'lvt', 'gold2')}</div>${newTier ? `<div class="lvtier">${ART.title(tierOf(L1).name, 'lvtn', toneOf(tierOf(L1).n))}</div>` : ''}
    <div class="lvopen">${items || next}</div>
    <button class="btn cyan lvbrag" data-act="share">${EM.share(18)}<span>Brag</span></button>`;
}
export const regionName = (id) => (REGIONS.find((r) => r.id === id) || { name: id }).name;
// the stamps around a run's score: NEW BEST, FIRST CLEAR, DEGENERATE, BOSS DOWN (they slam in one after another)
export function stampsHtml(list) { return `<div class="stamps">${list.map((n, i) => stampImg(n, 's' + i + ' ' + n)).join('')}</div>`; }
export function slamStamps(ui, root, at) {
  const els = [...root.querySelectorAll('.stamps .stamp')];
  els.forEach((el, i) => { const id = setTimeout(() => { if (!root.isConnected) return; el.classList.add('slam'); if (!still()) { const p = root.querySelector('.results'); if (p) { p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake'); } } ui.g.sound.ui(i ? 'bank' : 'bank'); }, still() ? 0 : at + i * 380); (ui.resTs ||= []).push(id); });
}
export { rank, tierOf };
