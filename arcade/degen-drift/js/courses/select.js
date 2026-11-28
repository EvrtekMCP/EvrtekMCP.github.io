// DEGEN DRIFT: the course list. Five regions as tabs, three courses each as cards: a small map of the road, the
// name, the difficulty, the length, your best (stars and the Degenerate badge), and (11-27 (4), the levels) its suggested
// level range coloured against yours. A region opens by stars; a locked tab and its cards show the padlock, the stars it
// needs and how close you are (pictures and numbers, no sentences), and a locked card still opens to look at. Picking opens its
// course card at once (11-18 (2): its world is built when a race on it launches, under the tip screen, main.js
// launch). Drawn as plain DOM inside js/ui.js's screen.
import { REGIONS, COURSES } from './index.js?v=0.1.26';
import { miniMap } from './route.js?v=0.1.26';
import * as G from '../garage.js?v=0.1.26';
import * as ART from '../art.js?v=0.1.26';
import { crest, rangeBadge, starLock, levelRow } from '../levelui.js?v=0.1.26';
import * as EM from '../emblems.js?v=0.1.26';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('en-US');
// each region's colour on the list (its sky, roughly)
export const REGION_TINT = { harbour: '#ff7a3c', canyon: '#ff9a3a', mountain: '#6aa8ff', neon: '#ff3fa4', summit: '#d8d0ff' };

// the road's length from its control points (closed), cached on the course
export function courseKm(c) {
  if (c._km) return c._km;
  let L = 0; const P = c.points; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  return (c._km = L / 1000);
}
export function mapSvg(c, w = 132, h = 84, cls = 'cmap') {
  const m = (c._map ||= miniMap(c, w, h)), tint = REGION_TINT[c.region] || '#36f2ff';
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${m.d}" fill="none" stroke="rgba(0,0,0,0.55)" stroke-width="5" stroke-linejoin="round"/><path d="${m.d}" fill="none" stroke="${tint}" stroke-width="2.2" stroke-linejoin="round"/><circle cx="${m.start[0]}" cy="${m.start[1]}" r="3.4" fill="#fff"/></svg>`;
}
const stars = (n, top) => `<span class="stars">${[0, 1, 2].map((i) => ART.star(i < n, 13)).join('')}</span>${top ? ' <b class="deg">DEGENERATE</b>' : ''}`;

export function courseList(ui) {
  const g = ui.g, p = g.progress, cur = g.cardCourse, starN = G.starsOf(p);
  const region = ui.region || cur.region;
  const tabs = REGIONS.map((r) => {
    const cs = COURSES.filter((c) => c.region === r.id), lo = Math.min(...cs.map((c) => c.difficulty)), hi = Math.max(...cs.map((c) => c.difficulty));
    const got = cs.reduce((a, c) => a + ((p.best[c.id] && p.best[c.id].stars) || 0), 0), lock = cs.every((c) => G.courseLock(p, c, starN)) ? G.courseLock(p, cs[0], starN) : null;
    return `<button class="rtab ${r.id === region ? 'on' : ''} ${lock ? 'locked' : ''}" data-act="region" data-region="${r.id}" style="--tint:${REGION_TINT[r.id]}">${crest(r.id, 30)}<span class="rtx"><b>${esc(r.name)}</b><small>${lock ? `${EM.lock(12)}${lock.have}/${lock.stars} &#9733;` : `${got}/9 &#9733;`}</small></span></button>`;
  }).join('');
  const reg = REGIONS.find((r) => r.id === region);
  const cards = COURSES.filter((c) => c.region === region).map((c) => {
    const best = p.best[c.id], on = c.id === cur.id, lock = G.courseLock(p, c, starN);
    return `<button class="ccard ${on ? 'cur' : ''} ${lock ? 'locked' : ''}" data-act="pick" data-id="${c.id}" style="--tint:${REGION_TINT[c.region]}">
      ${mapSvg(c)}
      <span class="cnum">COURSE ${c.number}</span>
      ${ART.title(c.name, 'cname')}
      <span class="cdiff"><i style="width:${c.difficulty}%"></i></span>
      <span class="cmeta"><span class="num">${c.difficulty}</span>/100 &middot; ${courseKm(c).toFixed(1)} km</span>${c.duel ? '<span class="dtag">DUEL</span>' : ''}
      <span class="cbest">${best ? `${stars(best.stars, best.top)} <span class="num">${fmt(best.score)}</span>` : '<span class="fresh">Not driven yet</span>'}</span>
      ${lock ? starLock(lock, 'verdict') : rangeBadge(p, c).replace('class="lvr ', 'class="verdict lvr ')}
    </button>`;
  }).join('');
  // 11-16 (fit): the head and the region tabs stay put, the cards scroll if they must, and Garage and Back sit in a bar
  // that never scrolls (on Evrtek's iPhone they were the last thing in a panel taller than the screen)
  return `<div class="clist panel fp">
    <div class="chead">${ART.title('CHOOSE A COURSE')}${levelRow(p, { share: false })}</div>
    <div class="rtabs">${tabs}</div>
    <div class="pbody"><div class="rblurb">${esc(reg ? reg.blurb : '')}</div>
    <div class="ccards">${cards}</div></div>
    <div class="pfoot"><button class="btn" data-act="garage">Garage</button><button class="btn" data-act="title" data-back>Back</button></div>
  </div>`;
}

// pick a course: its card, at once (11-18 (2): it was the loading screen and a build here; choosing is a few ms)
export function pick(ui, id) {
  ui.g.choose(id); ui.region = ui.g.cardCourse.region;
  ui.course();
}
