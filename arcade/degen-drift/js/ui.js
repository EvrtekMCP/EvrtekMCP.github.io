// DEGEN DRIFT: the screens. Title, course list and card, garage (repairs, upgrades, looks, cars), settings, pause and
// results. Plain DOM over the 3D view; every button has a data-act the game handles. Text is written as a person would
// say it. Day 3 art pass (Fundi, the interface): every title is lettered in the wordmark's strokes (art.js title()),
// never a system font; panels wear the key art's magenta-to-cyan edge; parts are illustrated; cars are drawn from their
// own bodies; the results screen has its star and DEGENERATE moments; motion stops for reduced-motion. The garage's
// actions call garage.js exactly as before (its logic is the cars builder's).
import { VERSION, TEST_BUILD } from './config.js?v=0.1.18';
import { CARS, carById } from './data/cars.js?v=0.1.18';
import { CATEGORIES, COSMETICS, SETUP } from './data/upgrades.js?v=0.1.18';
import { BODIES } from './carbodies.js?v=0.1.18';
import { REGIONS, COURSES } from './courses/index.js?v=0.1.18';
import { courseList, pick, mapSvg } from './courses/select.js?v=0.1.18';
import * as G from './garage.js?v=0.1.18';
import { ACTIONS, keyName } from './input.js?v=0.1.18';
import * as ART from './art.js?v=0.1.18';
import { Tips } from './tips.js?v=0.1.18';
import { Ghost } from './ghost.js?v=0.1.18';
import { Duel, record as duelRecord } from './duel/duelui.js?v=0.1.18';
import { DUELS, duelPay } from './duel/duel.js?v=0.1.18';
import { taps } from './loader.js?v=0.1.18';
import { fsOK, isFs, toggleFs, iphoneHint } from './fit.js?v=0.1.18';

// 11-16 (fit): full screen, where the browser allows it (js/fit.js); the icon shows what a tap will do
const FS_ICON = ['<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>'];
const fsLabel = () => (isFs() ? 'Leave full screen' : 'Full screen');
const fsButton = () => (fsOK() ? `<button class="icon-btn fsbtn" data-act="fs" aria-label="${fsLabel()}" title="${fsLabel()}">${FS_ICON[isFs() ? 1 : 0]}</button>` : '');
const HINT_KEY = 'driftline.fshint';
const hintGone = () => { try { return localStorage.getItem(HINT_KEY) === '1'; } catch (e) { return false; } };

const fmt =(n) => Math.round(n).toLocaleString('en-US');
// 11-21 (Evrtek on test v17: "i need to have an on screen notice of what test version we're looking at in browser just
// in case i'm still seeing a version back"): the test build and its version, from config.js, which every module imports
// under the same stamp as the page's own scripts, so the label is always the build that is running. A build from before
// v18 has no label at all (its title says "TEST BUILD 0.1.0" in small grey). Shown on the title and in the pause menu,
// never over the driving HUD; at go-live (TEST_BUILD null) it is gone and the title keeps its quiet version line.
export const testLabel = () => (TEST_BUILD == null ? '' : `TEST v${TEST_BUILD} &middot; ${VERSION}`);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const still = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

export class UI {
  constructor(game) {
    this.g = game;
    this.el = document.getElementById('screen');
    document.body.insertAdjacentHTML('afterbegin', ART.DEFS);
    // 11-16: a button looks pressed the moment the finger lands and acts as it lifts (js/loader.js taps())
    taps(this.el, (b) => this.tap(b));
    this.garageTab = 'perf'; this.verTaps = 0;
    // setup sliders apply as they move (no redraw, so the thumb keeps its grip)
    this.el.addEventListener('input', (e) => {
      const d = e.target.dataset || {};
      if (d.vol) { this.g.setVolume(d.vol, Number(e.target.value)); return; } // day 4: the volume sliders (cars builder)
      const k = d.setup; if (!k) return; G.carState(this.g.progress).setup[k] = Number(e.target.value); this.g.afterGarageChange();
    });
    // the tips (11-18 (2): on a race's loading screen only, js/tips.js; Settings starts them over) and the best run's
    // ghost, which rides on the HUD's frames (main.js knows nothing of it)
    this.tips = new Tips(game); this.ghost = new Ghost(game);
    this.duel = new Duel(game, this); // day 4: the downhill duels (js/duel/)
    game.hud.attach(this.ghost);
    // the full-screen button follows the state, however it changed (the button, Esc, the browser's own control)
    const fsSync = () => { for (const b of this.el.querySelectorAll('[data-act="fs"]')) { b.innerHTML = FS_ICON[isFs() ? 1 : 0]; b.title = fsLabel(); b.setAttribute('aria-label', fsLabel()); } };
    for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, fsSync);
  }
  // a tap while something slow is under way (a course building) is never lost: the latest one waits and runs when the
  // work is done; the same button again is the same request, and is not run twice
  tap(b) {
    const d = b.dataset, key = d.act + ':' + (d.id || d.car || '');
    if (this.busy) { if (key !== this.busy) this.queued = [d.act, d]; return; }
    this.g.sound.ui('click'); this.act(d.act, d);
  }
  async busyWith(key, work) {
    this.busy = key; this.queued = null;
    try { await work(); } finally { this.busy = null; }
    const q = this.queued; this.queued = null;
    if (q) { this.g.sound.ui('click'); this.act(q[0], q[1]); }
  }
  clear() {
    if (this.duel && !this.duel.active) this.duel.hideRival();
    if (this.name === 'courses') this.keepListPlace(); // 11-18 (2): the list comes back where it was left
    this.el.innerHTML = ''; this.el.className = 'screen'; this.name = null; this.shownAt = performance.now();
    if (this.g.backdrop) this.g.backdrop(false); for (const id of this.resTs || []) clearTimeout(id); this.resTs = [];
  }
  // 11-18 (2), Evrtek: "you get so far into a path that you can't return". Every screen but the title marks one button
  // as its way back (data-back); Esc and a pad's B press it (main.js frame). A screen that comes up as a race ends
  // ignores them for its first 0.9 s, so a key or a B (the nitrous) still held from the run cannot skip it.
  back() {
    if (!this.name || this.name === 'title' || this.busy || this.g.input.capturing) return; // (not while a key is being set)
    if (/^(results|duel-)/.test(this.name) && performance.now() - this.shownAt < 900) return;
    const b = this.el.querySelector('[data-back]');
    if (b && !b.disabled) this.tap(b);
  }
  // a race launched from a menu goes behind the tip screen (main.js launch); the same button again is the same launch
  launch(act, kind) { return this.busyWith(act + ':', () => this.g.launch(kind)); }
  act(a, d) {
    const g = this.g;
    switch (a) {
      case 'drive': this.courses(); break;
      case 'region': this.region = d.region; this.courses(); break;
      case 'pick': pick(this, d.id); break;
      case 'garage': g.enterGarage(); this.garage(); break;
      case 'settings': this.settings(d.from || 'title'); break;
      case 'title': g.toTitle(); break;
      case 'start': this.launch('start', 'run'); break;
      case 'retry': this.launch('retry', 'run'); break;
      case 'resume': g.resume(); break;
      case 'restart': if (this.duel.active) this.duel.restartLeg(); else g.startRun(); break;
      case 'quit': if (this.duel.active) this.duel.cancel(); g.toTitle(); break;
      case 'duel': this.launch('duel', 'duel'); break;
      case 'duel-next': this.duel.next(); break;
      case 'back': if (d.to === 'pause') this.pause(); else if (d.to === 'course') this.course(); else if (d.to === 'courses') this.courses(); else g.toTitle(); break;
      case 'tab': this.garageTab = d.tab; this.garage(); break;
      case 'buy': if (G.buyLevel(g.progress, d.cat)) { g.sound.ui('buy'); g.afterGarageChange(); } this.garage(); break;
      case 'cos': if (G.buyCosmetic(g.progress, d.cos, d.opt)) { g.sound.ui('buy'); g.afterGarageChange(); } this.garage(); break;
      case 'repair': if (G.repair(g.progress, d.patch === '1')) { g.sound.ui('buy'); g.afterGarageChange(); } this.garage(); break;
      case 'buycar': this.swapCar('buycar', d.car, () => { if (G.buyCar(g.progress, d.car)) { g.sound.ui('buy'); g.afterGarageChange(); } this.garage(); }); break;
      case 'drivecar': this.swapCar('drivecar', d.car, () => { if (G.switchCar(g.progress, d.car)) { g.afterGarageChange(); } this.garage(); }); break;
      case 'setup-reset': { const st = G.carState(g.progress); for (const k of Object.keys(st.setup)) st.setup[k] = 0; g.afterGarageChange(); this.garage(); break; }
      case 'set': g.setSetting(d.key, d.val === 'true' ? true : d.val === 'false' ? false : d.val); this.settings(this.from); break;
      // day 4 (cars builder): move a key; Esc keeps the old one
      case 'rebind': { const b = this.el.querySelector(`[data-act="rebind"][data-a="${d.a}"]`); if (b) b.textContent = 'Press a key'; g.input.capture((code) => { if (code) g.setSetting('keys', Object.assign({}, g.settings.keys, { [d.a]: code })); this.settings(this.from); }); break; }
      case 'keys-reset': g.setSetting('keys', {}); this.settings(this.from); break;
      case 'tips-again': this.tips.again(); d.done = '1'; this.settings(this.from); break;
      case 'tilt-centre': g.input.centreTilt(); break;
      case 'reset-progress': if (d.sure === '1') { g.resetProgress(); this.settings(this.from); } else { d.sure = '1'; this.el.querySelector('[data-act="reset-progress"]').dataset.sure = '1'; this.el.querySelector('[data-act="reset-progress"]').textContent = 'Tap again to erase'; } break;
      case 'ver': if (++this.verTaps >= 5) { this.verTaps = 0; g.debug.toggle(); } break;
      case 'fs': toggleFs(); break;
      case 'fshint-x': { try { localStorage.setItem(HINT_KEY, '1'); } catch (e) { /* not kept: it shows again next time */ } const h = this.el.querySelector('.fshint'); if (h) h.remove(); break; }
    }
  }

  // 11-16: the slow ones under the loading screen (main.js busy). A new car's body is built when you buy or switch to
  // it; the first duel on a course builds the rival's car.
  swapCar(act, id, change) {
    if (id === this.g.progress.car || this.g.carMesh.bodyId === id) { change(); return; }
    return this.busyWith(act + ':' + id, () => this.g.busy('Bringing out the ' + carById(id).name, async () => change()));
  }
  // (a duel's rival is brought out under the race's tip screen since 11-18 (2): main.js launch)
  // the course list's region and how far down it was scrolled, kept as it goes and put back as it returns
  keepListPlace() { const b = this.el.querySelector('.clist .pbody'); if (b) this.listPlace = { region: this.region || this.g.cardCourse.region, top: b.scrollTop }; }

  // ------------------------------------------------------------------ title
  title() {
    this.clear(); this.name = 'title'; this.g.backdrop(true);
    const p = this.g.progress, best = p.best[this.g.course.id];
    const touch = this.g.input.touch;
    // over Portero's painting: the boot screen's wordmark and tagline stay in the calm top third; the menu sits in the
    // dark band at the bottom, clear of the car. 11-16: full screen beside it where the browser allows it; on an iPhone
    // in Safari (which does not), one quiet line saying how to get it.
    const hint = iphoneHint() && !hintGone() ? '<div class="fshint">For full screen: Share &rarr; Add to Home Screen<button data-act="fshint-x" aria-label="Dismiss">&times;</button></div>' : '';
    this.el.innerHTML = `<div class="title-wrap on-art">
      <div class="menu">
        <button class="btn primary" data-act="drive">Drive</button>
        <button class="btn" data-act="garage">Garage</button>
        <button class="btn" data-act="settings" data-from="title">Settings</button>
        ${fsButton()}
      </div>
      <div class="foot">${best ? `Best on ${esc(this.g.course.name)}: <b class="num">${fmt(best.score)}</b> ${this.starRow(best.stars, best.top)}<br>` : ''}
        ${touch ? 'Hold the phone sideways. Left thumb steers; the right hand has the pedals and the handbrake.' : this.keyHint()}</div>
      ${hint}<div class="ver" data-act="ver">REIMERTEK STUDIOS &middot; ${testLabel() ? `<span class="testbuild">${testLabel()}</span>` : 'v' + VERSION}</div>
    </div>`;
  }
  // day 4 (cars builder): the title's key line names the keys the player has set (Settings > Keys), not the defaults
  keyHint() {
    const k = (a) => keyName(this.g.input.keysFor(a)[0]), four = ['up', 'left', 'down', 'right'].map(k);
    return `${four.join(four.every((x) => x.length === 1) ? '' : ' ')} or arrows to drive, ${k('hand')} for the handbrake, ${k('reset')} to reset, ${k('pause')} to pause.`;
  }
  starRow(n, top) { let s = '<span class="stars">'; for (let i = 0; i < 3; i++) s += ART.star(i < n, 14); return s + '</span>' + (top ? ' <b style="color:var(--gold)">DEGENERATE</b>' : ''); }

  // ------------------------------------------------------------------ the course list (js/courses/select.js draws it)
  courses() {
    this.clear(); this.name = 'courses'; this.el.classList.add('dim');
    this.el.innerHTML = courseList(this);
    // 11-18 (2): back from a card (or the garage, or a results screen), the list is where it was left
    const P = this.listPlace, b = this.el.querySelector('.clist .pbody');
    if (P && b && P.region === (this.region || this.g.cardCourse.region)) b.scrollTop = P.top;
  }

  // ------------------------------------------------------------------ the course card
  course() {
    this.clear(); this.name = 'course'; this.el.classList.add('dim');
    // 11-18 (2): the chosen course (its world is built when a race on it launches); until then Portero's painting
    // stands behind its card rather than another course's world
    const g = this.g, c = g.cardCourse, track = g.cardTrack(), p = g.progress, rate = G.rating(p), v = G.verdict(rate, c.difficulty), best = p.best[c.id], region = REGIONS.find((r) => r.id === c.region);
    if (g.chosen) g.backdrop(true, true);
    const tierRow = (label, pts, got, icon, cls = '') => `<div class="tier ${got ? 'got' : ''} ${cls}">${icon}<span>${label}</span><span class="pts num">${fmt(pts)}</span></div>`;
    const bs = best ? best.score : 0;
    // 11-16 (fit): the card's two columns scroll as one body; its actions sit in a bar under them that never scrolls
    // (Start duel moved here from inside the duel's box, so it is never under the fold either)
    const duel = !!(DUELS[c.id] && c.duel);
    this.el.innerHTML = `<div class="card panel fp"><div class="pbody">
      <div>
        <div class="kicker">${esc(region ? region.name.toUpperCase() : '')} &middot; COURSE ${c.number || 1} OF ${COURSES.length}</div>
        ${ART.title(c.name, 'ctitle')}
        <div class="cfacts">${mapSvg(c, 120, 72, 'cmap small')}
          <span class="fact"><b class="num">${(track.length / 1000).toFixed(2)}</b>KM</span>
          <span class="fact"><b class="num">${track.zones.length}</b>ZONES</span>
          <span class="fact"><b class="num">${c.difficulty}</b>DIFFICULTY</span></div>
        <p class="blurb">${esc(c.blurb)}</p>
        <div class="meter"><div class="row"><span>YOUR ${esc(carById(p.car).name)} &middot; RATING ${rate}</span><span class="num">COURSE ${c.difficulty}</span></div>
          <div class="bar"><i style="width:${c.difficulty}%;background:linear-gradient(90deg,#ffb347,#ff4f6a)"></i><b style="left:calc(${rate}% - 1px)"></b></div>
          <span class="verdict ${v.cls}">${v.word}</span></div>
        <p class="note">Every corner has a glowing zone with a pink sweet spot. Slide inside it to score, link one zone to the next to raise the multiplier; a wall takes the unbanked chain.</p>
      </div>
      <div>
        <div class="kicker">TARGETS${best ? ` &middot; BEST <span class="num">${fmt(bs)}</span>` : ''}</div>
        <div class="tiers">
          ${tierRow('One star', c.stars[0], bs >= c.stars[0], ART.star(bs >= c.stars[0]))}
          ${tierRow('Two stars', c.stars[1], bs >= c.stars[1], ART.star(bs >= c.stars[1]))}
          ${tierRow('Three stars', c.stars[2], bs >= c.stars[2], ART.star(bs >= c.stars[2]))}
          ${tierRow('DEGENERATE', c.degenerate, bs >= c.degenerate, ART.degenerateBadge('tierbadge').replace('<svg', '<svg width="20" height="20"'), 'deg')}
        </div>
        ${this.ghost.on() && best ? '<p class="note">Your best run drives beside you as a ghost.</p>' : ''}
        ${this.duelCard(c)}
      </div></div>
      <div class="pfoot"><button class="btn primary" data-act="start">Start run</button>${duel ? '<button class="btn cyan" data-act="duel">Start duel</button>' : ''}<button class="btn" data-act="garage">Garage</button><button class="btn" data-act="back" data-to="courses" data-back>Back</button></div></div>`;
  }

  // ------------------------------------------------------------------ the downhill duel (js/duel/duelui.js runs it)
  duelCard(c) {
    const D = DUELS[c.id]; if (!D || !c.duel) return '';
    const car = carById(D.rival), rec = duelRecord()[c.id] || { won: 0, lost: 0 }, win = duelPay(G.payout, this.g.progress, c, { won: true }, !rec.won).total;
    return `<div class="duelcard"><div class="kicker">DOWNHILL DUEL</div>
      <div class="drow">${ART.carSide(BODIES[D.rival] || BODIES.kestrel, D.paint, 'carside', 'duel-' + D.rival)}<div>${ART.title(D.who, 'dwho')}<div class="meta">${esc(car.name)} &middot; ${esc(car.engine.toUpperCase())}${rec.won + rec.lost ? ` &middot; YOU ${rec.won}-${rec.lost}` : ''}</div><p class="note">${esc(D.line)}</p></div></div>
      <p class="note">Two legs: lead, then chase, and one more if it is too close to call. Out-drift ${esc(D.who)} in the zones and beat them to the line; pull ${D.outright} s clear and it is yours outright. Touch them and it costs you. A win pays about <b class="num">${win.toLocaleString('en-US')}</b>.</p></div>`;
  }
  legRows(L, who) {
    const sg = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toLocaleString('en-US');
    return `<span>Your drift in the zones</span><span>${L.you.toLocaleString('en-US')}</span><span>${esc(who)}'s drift</span><span>${L.rival.toLocaleString('en-US')}</span>
      <span>Drift edge</span><span>${sg(L.edge)}</span><span>Gap at the line</span><span>${L.gap >= 0 ? '+' : '−'}${Math.abs(L.gap).toFixed(1)} s (${sg(L.gapPts)})</span>
      <span>Contact you caused</span><span>${L.contacts}${L.pen ? ' (−' + L.pen.toLocaleString('en-US') + ')' : ''}</span><span><b>Leg</b></span><span class="lscore ${L.score >= 0 ? 'up' : 'down'}">${sg(L.score)}</span>`;
  }
  duelLeg(L, duel) {
    this.clear(); this.name = 'duel-leg'; this.el.classList.add('dim');
    // after leg 1, or after leg 2 when the two are too close to call (day 5: sudden death, led by whoever is behind)
    const D = duel.cfg(), who = esc(D.who), sd = duel.legNo === 2, tot = duel.legs.reduce((a, l) => a + l.score, 0), lead = sd && tot < 0;
    const n = (v) => Math.abs(v).toLocaleString('en-US');
    const note = !sd
      ? `${L.score >= 0 ? `You take a lead of ${n(L.score)} into the second leg.` : `${who} takes ${n(L.score)} into the second leg.`} Now ${who} leads and you chase: stay close, out-drift them, and get by if you can.`
      : tot > 0 ? `Two legs, and you are only ${n(tot)} ahead: too close to call. One more leg settles it on its own. ${who} is behind on points, so ${who} leads it and you chase.`
      : tot < 0 ? `Two legs, and ${who} is only ${n(tot)} ahead: too close to call. One more leg settles it on its own. You are behind on points, so you lead it.`
      : `Two legs, dead level. One more leg settles it. ${who} leads it and you chase.`;
    this.el.innerHTML = `<div class="sheet panel duelleg fp"><div class="kicker">${esc(this.g.course.name)} &middot; DOWNHILL DUEL &middot; LEG ${duel.legNo}</div>${ART.title(sd ? 'SUDDEN DEATH' : 'LEG 1')}
      <div class="pbody"><div class="stats">${this.legRows(L, D.who)}</div>
      <p class="note">${note}</p></div>
      <div class="pfoot"><button class="btn primary" data-act="duel-next">${!sd ? 'Leg 2: chase' : lead ? 'Sudden death: lead' : 'Sudden death: chase'}</button><button class="btn" data-act="quit" data-back>Give up</button></div></div>`;
  }
  duelResult(r) {
    this.clear(); this.name = 'duel-result'; this.el.classList.add('dim');
    const v = r.verdict, won = v.won, D = r.cfg;
    const sdL = r.legs[2], how = v.outright ? (won ? `You pulled ${D.outright} s clear: won outright.` : `${esc(D.who)} got clear away.`) : sdL ? `Too close to call after two legs, so it went to sudden death, and that leg went ${sdL.score >= 0 ? 'your way' : `${esc(D.who)}'s way`} by ${Math.abs(sdL.score).toLocaleString('en-US')}.` : `Two legs, ${v.total >= 0 ? '+' : '−'}${Math.abs(v.total).toLocaleString('en-US')} overall.`;
    this.el.innerHTML = `<div class="degflash"></div><div class="results panel duelres fp ${won ? 'won' : 'lost'}"><div class="pbody"><div>
        <div class="kicker">${esc(this.g.course.name)} &middot; DOWNHILL DUEL &middot; V ${esc(D.who)}</div>
        ${ART.title(won ? 'DUEL WON' : 'DUEL LOST', 'rtitle', won ? 'gold' : 'chrome')}
        <p class="blurb">${how} Your record here: ${r.record.won}-${r.record.lost}.</p>
        ${won ? `<div class="degwrap">${ART.duelBadge('badge-deg')}<div>${ART.title('DUEL WON', '', 'gold')}<div class="tagline">GRIP IS FOR QUITTERS.</div></div></div>` : ''}
        ${r.legs.map((L, i) => `<div class="kicker" style="margin-top:0.6rem">${i === 2 ? 'SUDDEN DEATH' : 'LEG ' + (i + 1)} &middot; ${L.playerLeads ? 'YOU LED' : 'YOU CHASED'}${L.outright ? ' &middot; OUTRIGHT' : ''}</div><div class="stats">${this.legRows(L, D.who)}</div>`).join('')}
      </div><div>
        <div class="kicker">PAYOUT</div>
        <div class="stats pay">${r.pay.lines.map(([l, x]) => `<span>${esc(l)}</span><span>+${x.toLocaleString('en-US')}</span>`).join('')}<span><b>Total</b></span><span class="total num">+${r.pay.total.toLocaleString('en-US')}</span></div>
        <div class="stats" style="margin-top:0.6rem"><span>Credits</span><span class="num" style="color:var(--gold)">${this.g.progress.credits.toLocaleString('en-US')}</span><span>Condition</span><span>${G.condition(this.g.progress)}%</span></div>
      </div></div>
      <div class="pfoot"><button class="btn primary" data-act="duel">Rematch</button><button class="btn" data-act="garage">Garage</button><button class="btn" data-act="drive" data-back>Courses</button><button class="btn" data-act="title">Menu</button></div></div>`;
    const badge = this.el.querySelector('.badge-deg'), wrap = this.el.querySelector('.degwrap'), flash = this.el.querySelector('.degflash'), panel = this.el.querySelector('.results');
    const go = () => { if (this.name !== 'duel-result') return; if (won) { wrap.classList.add('lit'); badge.classList.add('lit'); flash.classList.add('go'); if (!still()) panel.classList.add('shake'); this.g.sound.ui('degenerate'); } else this.g.sound.ui('wipe'); };
    const id = setTimeout(go, still() ? 0 : 450); (this.resTs ||= []).push(id);
  }

  // ------------------------------------------------------------------ the garage
  garage() {
    this.clear(); this.name = 'garage';
    const g = this.g, p = g.progress, car = carById(p.car), st = G.carState(p), rate = G.rating(p), cond = G.condition(p);
    const tab = this.garageTab;
    let list = '';
    if (tab === 'perf') {
      const rc = G.repairCost(p), pc = G.patchCost(p);
      list += `<div class="repair">${ART.conditionCar(st.damage, 44, 80)}<div><b>Condition ${cond}%</b>
        <div class="note">${cond >= 100 ? 'Showroom fresh.' : 'Knocks cost a little grip, steering or power (never more than 15%).'}</div>
        ${cond < 100 ? `<div class="rb"><button class="btn small cyan" data-act="repair" data-patch="0" ${p.credits < rc ? 'disabled' : ''}>Full repair ${fmt(rc)}</button><button class="btn small" data-act="repair" data-patch="1" ${p.credits < pc ? 'disabled' : ''}>Patch up ${fmt(pc)}</button></div>` : ''}</div></div>`;
      for (const c of CATEGORIES) {
        const max = G.maxLevel(p.car, c.id); if (!max) continue;
        const lv = st.levels[c.id], nxt = G.nextLevel(p, c.id), price = nxt ? G.levelPrice(p.car, c.id, nxt) : 0;
        const named = (L) => (L && c.id === 'induction' ? Object.assign({}, L, { name: car.induction.name, blurb: car.induction.kind === 'super' ? '+25%, there the moment you press: no lag, and a whine on top.' : L.blurb }) : L);
        const lvl = named(nxt ? c.levels[nxt - 1] : null), have = named(c.levels[Math.min(lv, max) - 1]);
        const pips = Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
        list += `<div class="part ${c.band === 'big' ? 'big' : ''}">${ART.partArt(c.id === 'induction' && car.induction.kind === 'super' ? 'super' : c.art)}
          <div><h3>${esc(lvl ? lvl.name : have.name)}</h3><p>${esc(lvl ? lvl.blurb : 'Fitted. ' + c.name + ' is maxed on this car.')}</p><div class="pips">${pips}</div></div>
          <div class="price">${lvl ? `<span class="num">${fmt(price)}</span><br><button class="btn small ${p.credits >= price ? 'primary' : ''}" data-act="buy" data-cat="${c.id}" ${p.credits < price ? 'disabled' : ''}>${p.credits >= price ? 'Fit' : 'Need ' + fmt(price - p.credits)}</button>` : '<span class="maxed">MAXED</span>'}</div></div>`;
        // the setup sheet sits under the suspension, live once adjustable coilovers are fitted
        if (c.id === 'suspension') list += st.levels.suspension >= 2
          ? `<div class="part setup">${ART.partArt('setup')}<div><h3>Setup</h3>${SETUP.map((k) => `<label class="sl"><span>${esc(k.name)}</span><input type="range" min="-1" max="1" step="0.1" value="${st.setup[k.id] || 0}" data-setup="${k.id}"><small>${esc(k.lo)} &middot; ${esc(k.hi)}</small></label>`).join('')}<p>Changes apply at once. Try them on a run.</p></div><div class="price"><button class="btn small" data-act="setup-reset">Reset</button></div></div>`
          : `<div class="part locked">${ART.partArt('setup')}<div><h3>Setup sheet</h3><p>Fit adjustable coilovers to tune grip balance, slide help, steering lock, brake bias and gearing to your style.</p></div><div></div></div>`;
      }
    } else if (tab === 'looks') {
      for (const c of COSMETICS) {
        const opts = c.options.slice(0, carById(p.car).levels[c.id] || c.options.length);
        list += `<div class="part">${ART.partArt(c.art)}<div><h3>${esc(c.name)}</h3><div class="swatches">${opts.map((o) => {
          const own = st.owned[c.id].includes(o.id), on = st.pick[c.id] === o.id, price = G.cosmeticPrice(p.car, c.id, o.id);
          const bg = c.id === 'paint' ? (o.value || car.paint) : c.id === 'smoke' ? o.value : c.id === 'glow' ? (o.value || '#222') : '#1a1030';
          const label = c.id === 'rims' ? o.name.split(' ')[0] : '';
          return `<button class="sw ${on ? 'on' : ''}" style="background:${bg}" title="${esc(o.name)}" aria-label="${esc(o.name)}" data-act="cos" data-cos="${c.id}" data-opt="${o.id}" ${!own && p.credits < price ? 'disabled' : ''}>${label}${own ? '' : `<span class="tag">${fmt(price)}</span>`}</button>`;
        }).join('')}</div></div><div></div></div>`;
      }
    } else {
      const paintNow = G.looks(p).paint;
      for (const c of CARS) {
        const own = p.garage.includes(c.id), cur = p.car === c.id, r0 = c.rating[0], r1 = c.rating[1];
        const act = cur ? '<span class="maxed">DRIVING</span>' : own ? `<button class="btn small cyan" data-act="drivecar" data-car="${c.id}">Drive</button>` : `<span class="num">${fmt(c.price)}</span><br><button class="btn small ${p.credits >= c.price ? 'primary' : ''}" data-act="buycar" data-car="${c.id}" ${p.credits < c.price ? 'disabled' : ''}>${p.credits >= c.price ? 'Buy' : 'Need ' + fmt(c.price - p.credits)}</button>`;
        list += `<div class="carcard ${cur ? 'cur' : ''} ${own ? '' : 'locked'}">${ART.carSide(BODIES[c.id] || BODIES.kestrel, cur ? paintNow : c.paint, 'carside', c.id)}
          <div>${ART.title(c.name)}<div class="meta">${esc(c.cls.toUpperCase())} &middot; ${esc(c.engine.toUpperCase())} &middot; RATING ${own ? G.rating(p, c.id) + ' / ' : ''}${r0}&ndash;${r1}</div>
            <div class="rbar"><i style="left:${r0}%;width:${r1 - r0}%"></i></div><p class="note">${esc(c.blurb)} <i>${esc(c.feel)}</i></p></div>
          <div class="price">${act}</div></div>`;
      }
    }
    const from = this.g.garageFrom === 'course' || this.g.garageFrom === 'courses' ? this.g.garageFrom : 'title'; // 11-18 (2): back where it was opened
    this.el.innerHTML = `<div class="garage">
      <div class="gstage">
        <div>${ART.title(car.name, 'carname')}<div class="chips"><span class="chip">${esc(car.cls.toUpperCase())}</span><span class="chip">${esc(car.engine.toUpperCase())}</span><span class="chip">CONDITION ${cond}%</span></div>
          <div class="ratingbox">${ART.ratingRing(rate)}<div class="note"><b>Ability rating</b><br>stock ${car.rating[0]}, fully built ${car.rating[1]}</div></div></div>
        <button class="btn back" data-act="back" data-to="${from}" data-back>Back</button>
      </div>
      <div class="gpanel panel">
        <div class="ghead">${ART.title('GARAGE')}<div class="credits num">${fmt(p.credits)}<small>CREDITS</small></div></div>
        <div class="tabs"><button class="tab ${tab === 'perf' ? 'on' : ''}" data-act="tab" data-tab="perf">Performance</button><button class="tab ${tab === 'looks' ? 'on' : ''}" data-act="tab" data-tab="looks">Looks</button><button class="tab ${tab === 'cars' ? 'on' : ''}" data-act="tab" data-tab="cars">Cars</button></div>
        <div class="glist">${list}</div>
      </div></div>`;
  }

  // ------------------------------------------------------------------ settings
  settings(from) {
    this.clear(); this.name = 'settings'; this.from = from; this.el.classList.add('dim');
    const g = this.g, s = this.g.settings, touch = this.g.input.touch;
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${String(s[key] ?? (key === 'ghost' ? true : '')) === String(v) ? 'on' : ''}" data-act="set" data-key="${key}" data-val="${v}">${l}</button>`).join('')}</div>`;
    const P = this.g.input.press;
    this.el.innerHTML = `<div class="sheet panel fp">${ART.title('SETTINGS')}<div class="pbody">
      ${touch ? `<div class="opt"><label>Throttle</label><div>${seg('throttle', [['buttons', 'Gas &amp; brake'], ['slider', 'Slider'], ['pressure', 'More thumb']])}
        <div class="note">${s.throttle === 'pressure' ? 'Press harder (or flatten more of your thumb) for more throttle. The gauge beside the pad shows what your phone is reporting. ' + (P.forceSeen ? 'This phone reports real pressure.' : P.radiusSeen ? 'This phone reports contact size, not pressure: roll more thumb onto the pad.' : 'Nothing read yet: give the pad a press in a run.') : s.throttle === 'slider' ? 'Slide your thumb up the bar for more throttle; let go to lift.' : 'Hold GAS for full throttle.'}</div></div></div>
      <div class="opt"><label>Steering</label><div>${seg('steer', [['stick', 'Thumb stick'], ['tilt', 'Tilt']])}${s.steer === 'tilt' ? '<div class="row-btns"><button class="btn small" data-act="tilt-centre">Centre tilt here</button></div><div class="note">Turn the phone like a wheel. It centres itself at the start of every run.</div>' : ''}</div></div>
      ${s.throttle === 'pressure' ? `<div class="opt"><label>Pressure from</label>${seg('pressure', [['auto', 'Auto'], ['force', 'Force'], ['area', 'Contact size'], ['position', 'Thumb height']])}</div>` : ''}` : ''}
      <div class="opt"><label>Quality</label><div>${seg('quality', [['auto', 'Auto'], ['low', 'Low'], ['med', 'Medium'], ['high', 'High']])}<div class="note">Auto starts high on computers and medium on phones, then trims the resolution, and drops to Low if it has to, to hold 60 frames a second.</div></div></div>
      <div class="opt"><label>Sound</label><div>${seg('sound', [[true, 'On'], [false, 'Off']])}<div class="vols">${[['master', 'Everything'], ['music', 'Music'], ['sfx', 'Car and effects']].map(([ch, n]) => `<label class="sl"><span>${n}</span><input type="range" min="0" max="1" step="0.05" value="${(s.vol && s.vol[ch] != null) ? s.vol[ch] : 0.8}" data-vol="${ch}" aria-label="${n} volume"></label>`).join('')}</div></div></div>
      <div class="opt"><label>Tire smoke</label><div>${seg('smoke', [['full', 'Full'], ['less', 'Less'], ['min', 'Light']])}<div class="note">Less smoke is lighter work for an older phone.</div></div></div>
      ${(() => { const v = s.engineSound === 'classic' || s.engineSound === 'recorded' ? s.engineSound : 'new'; return `<div class="opt"><label>Engine sound</label><div><div class="seg">${[['new', 'New'], ['recorded', 'Recorded'], ['classic', 'Classic']].map(([k, l]) => `<button class="${v === k ? 'on' : ''}" data-act="set" data-key="engineSound" data-val="${k}">${l}</button>`).join('')}</div><div class="note">New: every engine built from its firing pulses and exhaust pipes. Recorded: engine and tire recordings (the KESTREL only). Classic: the original engine sound.</div></div></div>`; })()}<!-- 11-17, 11-18 (sound builder) -->
      <div class="opt"><label>Zone colours</label><div>${seg('palette', [['neon', 'Cyan and pink'], ['safe', 'Blue and amber']])}<div class="note">Blue and amber stay apart for the common kinds of colour blindness.</div></div></div>
      <div class="opt"><label>Ghost</label><div>${seg('ghost', [[true, 'On'], [false, 'Off']])}<div class="note">Your best run on each course drives beside you, see-through.</div></div></div>
      <div class="opt"><label>Tips</label><div><button class="btn small" data-act="tips-again" ${this.tips.fresh ? 'disabled' : ''}>${this.tips.fresh ? 'The basics come first next race' : 'Show the tips again'}</button><div class="note">A tip shows while each race loads. This starts them again from the basics.</div></div></div>
      <div class="opt"><label>FPS readout</label>${seg('fps', [[true, 'On'], [false, 'Off']])}</div>
      ${!touch ? `<div class="opt"><label>Keys</label><div class="keys"><div class="keymap">${ACTIONS.map(([a, n]) => `<span>${n}</span><button class="btn small" data-act="rebind" data-a="${a}">${keyName(g.input.keysFor(a)[0])}</button>`).join('')}</div><div class="note">The arrows, E (nitrous), P (pause) and Shift (reset) always work too. <button class="btn small" data-act="keys-reset">Reset keys</button></div>A gamepad works too: left stick, triggers, A handbrake, B nitrous, Y reset.</div></div>` : ''}
      <div class="opt"><label>Progress</label><div><button class="btn small" data-act="reset-progress">Erase my progress</button></div></div></div>
      <div class="pfoot"><button class="btn primary" data-act="back" data-to="${from}" data-back>Done</button></div></div>`;
  }

  // ------------------------------------------------------------------ pause
  pause() {
    this.clear(); this.name = 'pause'; this.el.classList.add('dim');
    // 11-16 (fit): two by two on a short screen; full screen beside the title where the browser allows it
    this.el.innerHTML = `<div class="pause panel"><div class="phead">${ART.title('PAUSED')}${fsButton()}</div>
      <div class="pbtns"><button class="btn primary" data-act="resume" data-back>Resume</button><button class="btn" data-act="restart">Restart</button>
      <button class="btn" data-act="settings" data-from="pause">Settings</button><button class="btn" data-act="quit">Quit to menu</button></div>
      ${testLabel() ? `<div class="pver"><span class="testbuild">${testLabel()}</span></div>` : ''}</div>`;
  }

  // ------------------------------------------------------------------ results
  results(r) {
    this.clear(); this.name = 'results'; this.el.classList.add('dim');
    const g = this.g, c = g.course, p = g.progress;
    const ghostSaved = this.ghost.end(r);
    const dmg = r.hits.length ? r.hits.map((h) => G.PART_NAMES[h.part]).filter((v, i, a) => a.indexOf(v) === i).join(', ') : 'none';
    this.el.innerHTML = `<div class="degflash"></div><div class="results panel fp"><div class="pbody">
      <div>
        <div class="kicker">${esc(c.name)}</div>
        ${ART.title(r.top ? 'DEGENERATE RUN' : r.stars >= 3 ? 'THREE STARS' : 'RUN COMPLETE', 'rtitle', r.top || r.stars >= 3 ? 'gold' : 'chrome')}
        <div class="score-big num" id="r-score">0</div>${r.newBest ? '<span class="newbest">NEW BEST</span>' : ''}
        <div class="bigstars">${[0, 1, 2].map((i) => `<span class="st" data-i="${i}">${ART.star(false, 46)}</span>`).join('')}</div>
        ${r.top ? `<div class="degwrap">${ART.degenerateBadge('badge-deg')}<div>${ART.title('DEGENERATE', '', 'gold')}<div class="tagline">GRIP IS FOR QUITTERS.</div></div></div>` : ''}
        <div class="stats">
          <span>Best chain</span><span>${fmt(r.stats.bestChain)}</span>
          <span>Highest multiplier</span><span>&times;${r.stats.maxMult}</span>
          <span>Links</span><span>${r.stats.links}</span>
          <span>Time in zones (sweet spot)</span><span>${r.stats.zoneTime.toFixed(1)} s (${r.stats.sweetTime.toFixed(1)} s)</span>
          <span>Wall hits</span><span>${r.stats.walls}${r.stats.wiped ? ' &middot; lost ' + fmt(r.stats.wiped) : ''}</span>
          <span>Lap time</span><span>${r.time}</span>
        </div>
        ${ghostSaved ? '<p class="note">This run is now your ghost on this course.</p>' : ''}
      </div>
      <div>
        <div class="kicker">PAYOUT</div>
        <div class="stats pay">${r.pay.lines.map(([l, v]) => `<span>${esc(l)}</span><span>+${fmt(v)}</span>`).join('')}<span><b>Total</b></span><span class="total num" id="r-pay">0</span></div>
        <div class="stats" style="margin-top:0.6rem"><span>Credits</span><span class="num" style="color:var(--gold)">${fmt(p.credits)}</span><span>Damage this run</span><span>${esc(dmg)}</span><span>Condition</span><span>${G.condition(p)}%</span></div>
      </div></div>
      <div class="pfoot"><button class="btn primary" data-act="retry">Again</button><button class="btn" data-act="garage">Garage</button><button class="btn" data-act="drive" data-back>Courses</button><button class="btn" data-act="title">Menu</button></div></div>`;
    // the score and the pay count up; then the stars pop one by one; then, for the top tier, the badge stamps down
    const sEl = this.el.querySelector('#r-score'), pEl = this.el.querySelector('#r-pay'), t0 = performance.now(), dur = still() ? 0 : 1100;
    const stars = [...this.el.querySelectorAll('.bigstars .st')], deg = this.el.querySelector('.degwrap'), panel = this.el.querySelector('.results'), flash = this.el.querySelector('.degflash');
    const after = (ms, f) => { const id = setTimeout(() => { if (this.name === 'results') f(); }, still() ? 0 : ms); (this.resTs ||= []).push(id); };
    const tick = (now) => {
      if (this.name !== 'results') return;
      const k = dur ? Math.min(1, (now - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3);
      sEl.textContent = fmt(r.score * e); pEl.textContent = '+' + fmt(r.pay.total * e);
      if (k < 1) { requestAnimationFrame(tick); return; }
      stars.forEach((s, i) => after(260 * i, () => { if (i < r.stars) { s.classList.add('lit'); s.querySelector('path').setAttribute('fill', 'url(#gGold)'); this.g.sound.ui('star'); } }));
      if (r.top && deg) after(260 * 3 + 200, () => { deg.classList.add('lit'); deg.querySelector('.badge-deg').classList.add('lit'); flash.classList.add('go'); if (!still()) panel.classList.add('shake'); this.g.sound.ui('degenerate'); });
    };
    requestAnimationFrame(tick);
  }
}
