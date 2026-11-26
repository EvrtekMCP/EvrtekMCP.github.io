// DEGEN DRIFT: the tips, and the loading screen they live on. 11-18 (2), Evrtek: "a series of tip screens that act as a
// brief, say, 2 to 3 second loading screen when you go to launch into a race ... giving the player a visual with some
// simple text and a visual prompt of what they're supposed to do"; "I don't want to have again anything interrupt the
// flow of a particular race, but we could certainly have a random tip appear every time a level is loading."
// So nothing teaches during or around a race any more: no card holds the start line (11-17's hold is gone from
// main.js), no tip sits on a results screen. A race or a duel launched from a menu (main.js launch) shows one tip on
// the loading screen while its course is built:
//   up about 2.5 s (MIN_MS), longer only while the work truly needs it (the bar shows it), and never held past the
//   longer of the two once the work is done; a tap (or Enter, Space, a pad's A) skips it once the course is ready;
//   Esc or a pad's B goes back to the course card instead.
// Order: a new player gets the basics first, in order (BASICS: how to start a drift, the zone, the sweet spot, the
// hold, the switchback); after them a random one, never one of the last RECENT shown. Settings > Show the tips again
// starts the basics over. The phone's three show only on a phone.
// Each tip is one short line, as a person would say it, and a small looping picture of the move in the interface's
// colours (the colour-safe palette recolours the zones, as on the road, css .ldemo .zb/.zs); still for reduced motion.
import * as ART from './art.js?v=0.1.20';
import { keyName } from './input.js?v=0.1.20';

export const MIN_MS = 2500;  // the shortest the tip screen stays up: his "2 to 3 second"
const GUARD_MS = 350;        // a tap this soon after it appears is the launch's own tap arriving late, not a skip
const KEY = 'driftline.tips.v2', OLD = 'driftline.tips.v1', RECENT = 4;
export const BASICS = ['start', 'zone', 'sweet', 'hold', 'switch'];
const still = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && typeof v.seq === 'number' && Array.isArray(v.recent)) return v; } catch (e) { /* none kept */ } return { seq: 0, recent: [] }; };
const write = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* not kept */ } };

// ---------------------------------------------------------------- the pictures (160 x 100)
const LOOP = 'repeatCount="indefinite"';
// measured 11-18: Chrome draws no new frames for a picture whose only animations are animateMotion (the ghost's two
// cars stood at their start), so every picture carries a small animation of its own: a 1 px square nobody can see,
// fading between 1% and 2% (an animation on an empty shape was not enough: the cars waited a second before moving)
const KEEP = `<rect width="1" height="1" fill="#000" opacity="0.01"><animate attributeName="opacity" values="0.01;0.02;0.01" dur="1s" ${LOOP}/></rect>`;
// shown from a to b of a dur-second loop (fractions); with motion off only a `keep` one is drawn
function show(dur, a, b) {
  const v = [], k = [];
  if (a > 0) { v.push(0); k.push(0); }
  v.push(1); k.push(a);
  if (b < 1) { v.push(0); k.push(b); }
  return `<animate attributeName="opacity" calcMode="discrete" values="${v.join(';')}" keyTimes="${k.map((x) => +x.toFixed(3)).join(';')}" dur="${dur}s" ${LOOP}/>`;
}
const seen = (dur, a, b, inner, keep = false) => (still() ? (keep ? inner : '') : `<g opacity="${a > 0 ? 0 : 1}">${show(dur, a, b)}${inner}</g>`);
// a kick in size at a (the badge's bump on a step)
const kick = (dur, a, k = 1.3) => (still() ? '' : `<animateTransform attributeName="transform" type="scale" additive="sum" values="1;1;${k};1;1" keyTimes="0;${a.toFixed(3)};${(a + 0.03).toFixed(3)};${(a + 0.12).toFixed(3)};1" dur="${dur}s" ${LOOP}/>`);
const txt = (x, y, s, size, fill, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" font-weight="900" font-style="italic" fill="${fill}" ${extra}>${s}</text>`;
// the road, and a corner's zone band and sweet spot on it
const road = (d, w = 32) => `<path d="${d}" stroke="#3b3160" stroke-width="${w + 3}" fill="none"/><path d="${d}" stroke="#251f3d" stroke-width="${w}" fill="none"/>`;
const band = (d, w = 20) => `<path class="zb" d="${d}" stroke="#36f2ff" stroke-width="${w}" fill="none" opacity="0.28"/>`;
const sweet = (d) => `<path class="zs" d="${d}" stroke="#ff3fa4" stroke-width="4" fill="none"/>`;
// a car from above, its nose along +x, and the smoke off its rear tyres
// (drawn 1.3x: at a phone's 195 px picture a car is then about 27 px long)
const SMOKE = '<g fill="#ece8f2"><circle cx="-12" cy="-4.6" r="2.8" opacity="0.6"/><circle cx="-12" cy="4.6" r="2.8" opacity="0.6"/><circle cx="-18" cy="-4" r="4.2" opacity="0.4"/><circle cx="-18" cy="4" r="4.2" opacity="0.4"/><circle cx="-26" cy="0" r="6.4" opacity="0.24"/></g>';
const body = (fill = '#8a5cff', stroke = '#fff', dash = '') => `<g transform="scale(1.3)"><rect x="-8" y="-4.2" width="16" height="8.4" rx="2.8" fill="${fill}" stroke="${stroke}" stroke-width="1" ${dash}/><rect x="0.6" y="-3.3" width="4.3" height="6.6" rx="1.3" fill="#140a26" opacity="${dash ? 0.5 : 1}"/></g>`;
// it rides `path` once every dur s, `slip` degrees off the way it goes (negative: nose inside a left-hand bend), or
// swings through `spin` [values, keyTimes]; with motion off it stands at `at` [x, y, heading]
function car(path, dur, { slip = -28, spin = null, at = [80, 50, 0], smoke = SMOKE, look = body() } = {}) {
  if (still()) return `<g transform="translate(${at[0]} ${at[1]}) rotate(${at[2]})"><g transform="rotate(${slip})">${smoke}${look}</g></g>`;
  const sp = spin ? `<animateTransform attributeName="transform" type="rotate" values="${spin[0]}" keyTimes="${spin[1]}" dur="${dur}s" ${LOOP}/>` : '';
  return `<g><animateMotion dur="${dur}s" ${LOOP} rotate="auto" path="${path}"/><g transform="rotate(${slip})">${sp}${smoke}${look}</g></g>`;
}
// the HUD's multiplier badge (its ring, its number), at x, y, scaled; `extra` rides inside it (a kick, a glow)
const badge = (x, y, ringEl, num, s = 1, extra = '') => `<g transform="translate(${x} ${y}) scale(${s})"><g>${extra}<circle r="13" fill="rgba(10,4,24,0.88)" stroke="rgba(255,255,255,0.14)" stroke-width="3.4"/>${ringEl}${num}</g></g>`;
const RC = (2 * Math.PI * 13).toFixed(1);
const ring = (stroke, inner = '', off = 0) => `<circle class="${stroke === '#ff3fa4' ? 'zs' : ''}" r="13" fill="none" stroke="${stroke}" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="${RC} ${RC}" stroke-dashoffset="${off}" transform="rotate(-90)">${inner}</circle>`;
const mult = (s, fill = '#8a5cff', size = 11, cls = '') => `<text y="${(size * 0.36).toFixed(1)}" text-anchor="middle" font-size="${size}" font-weight="900" font-style="italic" fill="${fill}" ${cls ? `class="${cls}"` : ''}>${s}</text>`;
// numbers shown one after another, [text, from, to] each (the last one when motion is off)
const series = (dur, items, at) => items.map(([s, a, b], i) => seen(dur, a, b, at(s), i === items.length - 1)).join('');
// a phone held sideways, its screen, and a thumb on it
const PHONE = '<rect x="5" y="9" width="150" height="82" rx="13" fill="#0d0720" stroke="rgba(255,255,255,0.5)" stroke-width="1.6"/><rect x="13" y="15" width="134" height="70" rx="6" fill="#1b1138"/><rect x="8.5" y="38" width="2.6" height="24" rx="1.3" fill="rgba(255,255,255,0.3)"/>';
const THUMB = '<circle r="10" fill="rgba(255,236,214,0.35)" stroke="rgba(255,255,255,0.7)" stroke-width="1.2"/>';
// a part of the car from above that a knock turns red at a, and the repair turns green again at b
const hurt = (dur, a, b, el) => (still() ? el.replace('FILL', '#ff4f6a') : el.replace('FILL', '#5dffb0').replace('/>', `><animate attributeName="fill" values="#5dffb0;#5dffb0;#ff4f6a;#ff4f6a;#5dffb0;#5dffb0" keyTimes="0;${a};${a + 0.04};${b};${b + 0.06};1" dur="${dur}s" ${LOOP}/></rect>`));
// a circle's arc about (cx, cy) from a0 to a1 degrees (either way round) as cubic curves, without its M (the cars'
// roads use one path language; arc commands would do as well, now that every picture keeps its frames coming, KEEP)
function arc(cx, cy, r, a0, a1, n = 2) {
  const rad = Math.PI / 180, s = (a1 - a0) / n * rad, k = 4 / 3 * Math.tan(s / 4) * r, f = (v) => v.toFixed(2);
  let d = '';
  for (let i = 0; i < n; i++) {
    const t0 = a0 * rad + s * i, t1 = t0 + s, x0 = cx + r * Math.cos(t0), y0 = cy + r * Math.sin(t0), x1 = cx + r * Math.cos(t1), y1 = cy + r * Math.sin(t1);
    d += ` C ${f(x0 - k * Math.sin(t0))} ${f(y0 + k * Math.cos(t0))} ${f(x1 + k * Math.sin(t1))} ${f(y1 - k * Math.cos(t1))} ${f(x1)} ${f(y1)}`;
  }
  return d;
}
const pt = (cx, cy, r, a) => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)].map((v) => v.toFixed(2)).join(' ');

const DEMO = {
  // in on the straight; the handbrake (or the stab of the gas) at the turn-in, and the tail steps out
  start(c) {
    const R = 'M-12 80 C 40 80 80 80 104 60 S 136 18 138 -12', D = 3.6, k = 0.34;
    const lit = (w, h) => seen(D, k - 0.02, k + 0.2, `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="6" fill="#ff3fa4"/>`);
    const icon = c.touch
      ? `<g transform="translate(26 26)"><rect x="-15" y="-15" width="30" height="30" rx="8" fill="rgba(20,10,40,0.92)" stroke="#ffb347" stroke-width="1.4"/>${lit(30, 30)}<path d="M-7 9 L6 -6" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="6.5" cy="-6.5" r="3.6" fill="#fff"/><path d="M-10 9.5 h10" stroke="#fff" stroke-width="2.4"/></g>`
      : `<g transform="translate(30 24)"><rect x="-24" y="-11" width="48" height="22" rx="5" fill="rgba(20,10,40,0.92)" stroke="rgba(255,255,255,0.55)" stroke-width="1.4"/>${lit(48, 22)}<text y="4" text-anchor="middle" font-size="10" font-weight="900" fill="#fff" letter-spacing="1">${c.handKey}</text></g>`;
    return road(R) + car(R, D, { slip: 0, spin: ['0;0;-42;-32;-32', `0;${k};${k + 0.1};${k + 0.25};1`], smoke: seen(D, k + 0.05, 1, SMOKE, true), at: [110, 50, -58] }) + icon;
  },
  // the band glows through the bend; the car slides through it and the points climb
  zone() {
    const Z = 'M24 79 C 52 77 72 68 88 56 S 116 26 140 17', R = `M-12 80 L24 79 ${Z.slice(Z.indexOf('C'))} L172 12`, D = 3.4;
    return road(R) + band(Z) + car(R, D, { at: [88, 56, -40] })
      + series(D, [['+260', 0.3, 0.48], ['+910', 0.48, 0.66], ['+1,840', 0.66, 1]], (s) => txt(10, 26, s, 15, '#fff'));
  },
  // the pink line in the band pays double
  sweet() {
    const Z = 'M24 79 C 52 77 72 68 88 56 S 116 26 140 17', R = `M-12 80 L24 79 ${Z.slice(Z.indexOf('C'))} L172 12`, D = 3.4;
    const x2 = still() ? '' : '<animate attributeName="opacity" values="0.55;1;0.55" dur="0.7s" repeatCount="indefinite"/>';
    return road(R) + band(Z) + sweet(Z) + car(R, D, { at: [88, 56, -40] }) + `<g>${x2}${txt(10, 28, '×2', 20, '#ff3fa4', 'class="zsf"')}</g>`;
  },
  // on the pink line, still sliding: the ring fills once a second and the multiplier steps
  hold() {
    const Z = 'M-4 74 C 40 74 70 64 92 48 S 124 20 150 14', R = `M-12 74 L-4 74 ${Z.slice(Z.indexOf('C'))} L172 10`, D = 4;
    const fill = still() ? '' : `<animate attributeName="stroke-dashoffset" values="${RC};0" dur="1s" ${LOOP}/>`;
    const nums = series(D, [['×1', 0, 0.25], ['×2', 0.25, 0.5], ['×3', 0.5, 0.75], ['×4', 0.75, 1]], (s) => mult(s, '#ff3fa4', 11, 'zsf'));
    const plus = [0.25, 0.5, 0.75].map((a) => seen(D, a, a + 0.12, txt(110, 62, '+1', 12, '#ff3fa4', 'class="zsf"'))).join('');
    return road(R) + band(Z) + sweet(Z) + car(R, D, { at: [92, 48, -38] }) + badge(136, 80, ring('#ff3fa4', fill, still() ? 20 : 0), nums, 1.15, [0.25, 0.5, 0.75].map((a) => kick(D, a)).join('')) + plus;
  },
  // a slide one way, then the other way: the switchback adds one
  switch() {
    const R = 'M-12 22 C 40 22 40 80 80 80 S 120 22 172 22', D = 4;
    const nums = series(D, [['×1', 0, 0.3], ['×2', 0.3, 0.8], ['×3', 0.8, 1]], (s) => mult(s, '#ff3fa4', 11, 'zsf'));
    const plus = [0.3, 0.8].map((a) => seen(D, a, a + 0.16, txt(80, 18, '+1', 15, '#ff3fa4', 'text-anchor="middle" class="zsf"'))).join('');
    return road(R) + band('M-12 22 C 40 22 40 80 80 80', 18) + band('M80 80 C 120 80 120 22 172 22', 18)
      + car(R, D, { slip: 28, spin: ['28;28;-28;-28;28;28', '0;0.22;0.3;0.72;0.8;1'], at: [80, 80, 0] })
      + badge(80, 46, ring('#ff3fa4'), nums, 1.1, [0.3, 0.8].map((a) => kick(D, a, 1.45)).join('')) + plus;
  },
  // still sliding as one zone ends, into the next before the ring runs out: the multiplier climbs
  link() {
    const R = 'M-12 84 C 26 84 38 48 70 48 S 116 84 172 36', D = 3.8, amber = '#ffb347', a = 0.36, b = 0.6;
    const col = still() ? '' : `<animate attributeName="stroke" calcMode="discrete" values="#36f2ff;${amber};#36f2ff" keyTimes="0;${a};${b}" dur="${D}s" ${LOOP}/><animate attributeName="stroke-dashoffset" values="0;0;56;0;0" keyTimes="0;${a};${b};${b + 0.001};1" dur="${D}s" ${LOOP}/>`;
    const nums = series(D, [['×1', 0, b], ['×2', b, 1]], (s) => mult(s, amber, 11));
    return road(R, 30) + band('M-12 84 C 10 84 24 70 36 60', 18) + band('M104 70 C 126 74 146 60 172 36', 18) + car(R, D, { at: [70, 48, 0] })
      + badge(132, 22, ring('#36f2ff', col), nums, 1.1, kick(D, b, 1.4)) + seen(D, b, b + 0.25, txt(132, 50, 'LINKED', 10, amber, 'text-anchor="middle"'));
  },
  // the pink line a car's width in from the outside wall: ride it, then run wide, touch, and the chain is gone
  outside() {
    // a left-hander about (50, 10): the road's middle 60 out, the line 70, the wall 80
    const bend = (r) => `M-12 ${10 + r} H50${arc(50, 10, r, 90, 0)} V-12`, C = bend(60), L = bend(70), W = bend(80), D = 4.2, hit = 0.62;
    const wall = `<path d="${bend(83)}" stroke="#8a7fb0" stroke-width="2.4" fill="none"/><path d="${W}" stroke="#fff" stroke-width="4" fill="none"/><path d="${W}" stroke="#ff4f6a" stroke-width="4" fill="none" stroke-dasharray="5 5"/>`;
    const wide = `<animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 6;0 6" keyTimes="0;0.48;${hit};1" dur="${D}s" ${LOOP}/>`;
    const sparks = seen(D, hit, hit + 0.16, '<path d="M-2 10 l-5 6 M2 10 l2 8 M5 9 l7 4 M-5 9 l-8 1" stroke="#ffd36a" stroke-width="1.8" stroke-linecap="round"/><circle cx="0" cy="9.5" r="2.6" fill="#fff"/>');
    const drive = still() ? `<g transform="translate(99.5 59.5) rotate(-45)"><g transform="rotate(-30)">${SMOKE}${body()}</g></g>`
      : `<g><animateMotion dur="${D}s" ${LOOP} rotate="auto" path="${L}"/><g>${wide}<g transform="rotate(-30)">${SMOKE}${body()}</g>${sparks}</g></g>`;
    const score = still() ? txt(8, 26, '+4,600', 15, '#fff')
      : series(D, [['+1,200', 0.12, 0.3], ['+2,900', 0.3, 0.48], ['+4,600', 0.48, hit]], (s) => txt(8, 26, s, 15, '#fff')) + seen(D, hit, 1, txt(8, 26, 'WALL!', 16, '#ff4f6a') + txt(8, 40, 'CHAIN LOST', 9, '#ff4f6a'));
    return road(C, 36) + band(L, 16) + sweet(L) + wall + drive + score;
  },
  // the multiplier climbs to its top, ×10 in gold; the slide ends and the chain banks
  cap() {
    const D = 4.2, gold = '#ffd36a';
    const nums = seen(D, 0, 0.22, mult('×8', '#ffb347', 11)) + seen(D, 0.22, 0.44, mult('×9', '#ffb347', 11)) + seen(D, 0.44, 1, mult('×10', gold, 10), true);
    const glow = seen(D, 0.44, 1, `<circle r="17" fill="none" stroke="${gold}" stroke-width="1.2" opacity="0.7"/>`, true);
    return badge(46, 50, `<circle r="13" fill="none" stroke="${gold}" stroke-width="3.4"/>`, nums, 2.3, kick(D, 0.22, 1.12) + kick(D, 0.44, 1.25) + glow)
      + seen(D, 0.6, 1, txt(96, 44, 'BANKED', 11, '#5dffb0', 'letter-spacing="1.5"') + txt(92, 66, '+48,200', 17, '#5dffb0'), true);
  },
  // a knock on the wall turns a corner of the car red; a repair in the garage puts it right
  damage() {
    const D = 4.4, a = 0.16, b = 0.7, h = (el) => hurt(D, a, b, el);
    const car = `<g transform="translate(56 50)"><rect x="-32" y="-17" width="64" height="34" rx="11" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.4"/>
      <rect x="-14" y="-11" width="30" height="22" rx="4" fill="#5dffb0" opacity="0.4"/>${h('<rect x="18" y="-11" width="11" height="22" rx="3" fill="FILL"/>')}
      <rect x="-24" y="-22" width="13" height="7" rx="2.5" fill="#5dffb0"/><rect x="-24" y="15" width="13" height="7" rx="2.5" fill="#5dffb0"/>
      ${h('<rect x="12" y="-22" width="13" height="7" rx="2.5" fill="FILL"/>')}<rect x="12" y="15" width="13" height="7" rx="2.5" fill="#5dffb0"/></g>`;
    const wall = '<path d="M100 4 V96" stroke="#fff" stroke-width="3"/><path d="M100 4 V96" stroke="#ff4f6a" stroke-width="3" stroke-dasharray="5 5"/>';
    const spark = seen(D, a, a + 0.14, '<path d="M92 26 l6 -6 M93 32 l8 0 M92 38 l6 6" stroke="#ffd36a" stroke-width="2" stroke-linecap="round"/><circle cx="92" cy="32" r="3" fill="#fff"/>');
    const wrench = seen(D, 0.5, b + 0.1, `<g transform="translate(40 4) scale(0.5)">${ART.PART_ART.repair}</g>`);
    const cond = still() ? txt(130, 56, '86%', 14, '#ffb347', 'text-anchor="middle"')
      : series(D, [['100%', 0, a + 0.04], ['86%', a + 0.04, b + 0.06], ['100%', b + 0.06, 1]], (s) => txt(130, 56, s, 14, s === '86%' ? '#ffb347' : '#5dffb0', 'text-anchor="middle"'));
    return wall + car + spark + wrench + cond;
  },
  // your best run beside you, see-through; this run catches it and goes by. One right-hander (an arc about 80, 125):
  // you ride its outer lane the whole way, the ghost its inner lane from 0.2 to 0.8 of the way in the same time, so
  // you draw level half way through and pass it
  ghost() {
    const D = 4.4, lane = (r, a, b) => `M${pt(80, 125, r, a)}${arc(80, 125, r, a, b)}`;
    const look = body('rgba(54,242,255,0.18)', '#36f2ff', 'stroke-dasharray="2 1.6"');
    const g = still() ? `<g transform="translate(${pt(80, 125, 80, 285)}) rotate(15)"><g transform="rotate(16)" opacity="0.75">${look}</g></g>`
      : `<g opacity="0.75"><animateMotion dur="${D}s" ${LOOP} rotate="auto" path="${lane(80, 228, 312)}"/><g transform="rotate(16)">${look}</g></g>`;
    return road(lane(88, 192, 348), 36) + g + car(lane(97, 198, 342), D, { slip: 16, at: [...pt(80, 125, 97, 262).split(' ').map(Number), -8] })
      + txt(8, 22, 'BEST', 9, '#36f2ff', 'letter-spacing="1.5"');
  },
  // three star lines, and DEGENERATE above them
  stars() {
    const D = 4.2, P = 'M12 1.8l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.6 5.7 21.2l1.5-7.1L1.8 9.2 9 8.4z';
    const st = [24, 54, 84].map((x, i) => { const a = 0.08 + i * 0.14; return `<g transform="translate(${x} 50)"><g>${kick(D, a, 1.35)}<g transform="translate(-14 -14) scale(1.17)"><path d="${P}" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>${seen(D, a, 1, `<path d="${P}" fill="url(#gGold)" stroke="#fff" stroke-width="0.8"/>`, true)}</g></g></g>`; }).join('');
    const deg = ART.degenerateBadge('').replace('<svg class=""', '<svg x="-22" y="-22" width="44" height="44"');
    return st + `<g transform="translate(130 50)">${seen(D, 0.56, 1, `<g>${kick(D, 0.56, 1.5)}${deg}</g>`, true)}</g>`;
  },
  // every run pays credits; they buy parts, paint and cars
  garage() {
    const D = 4, part = ART.partArt('turbo').replace('<svg class="art"', '<svg x="8" y="18" width="64" height="64"');
    const cr = still() ? txt(84, 50, '14,556', 17, '#ffd36a') : series(D, [['12,400', 0, 0.36], ['14,556', 0.36, 1]], (s) => txt(84, 50, s, 17, '#ffd36a'));
    return part + txt(84, 30, 'CREDITS', 8, '#a99cc8', 'letter-spacing="2"') + cr + seen(D, 0.3, 0.62, txt(84, 70, '+2,156', 13, '#5dffb0'))
      + seen(D, 0.62, 1, '<g transform="translate(106 72)"><rect x="-20" y="-9" width="40" height="18" rx="4" transform="skewX(-12)" fill="#ff3fa4"/><text y="4" text-anchor="middle" font-size="9" font-weight="900" font-style="italic" fill="#fff" letter-spacing="1.5">FIT</text></g>', true);
  },
  // phone: a thumb down anywhere on the left half, and the stick is under it
  pstick() {
    const D = 4, spots = [[40, 60], [58, 40]];
    const knob = still() ? '' : `<animateTransform attributeName="transform" type="translate" values="0 0;-9 0;9 0;0 0" keyTimes="0;0.3;0.7;1" dur="${D / 2}s" ${LOOP}/>`;
    const one = ([x, y], i) => seen(D, i * 0.5, i * 0.5 + 0.46, `<g transform="translate(${x} ${y})"><circle r="16" fill="rgba(54,242,255,0.1)" stroke="#36f2ff" stroke-width="1.6"/><g>${knob}<circle r="6.5" fill="#36f2ff" opacity="0.85"/>${THUMB}</g></g>`, i === 0);
    return PHONE + '<rect x="13" y="15" width="67" height="70" rx="6" fill="rgba(54,242,255,0.07)"/><path d="M80 18 V82" stroke="rgba(54,242,255,0.35)" stroke-dasharray="3 3"/>'
      + spots.map(one).join('') + '<rect x="122" y="49" width="17" height="31" rx="4.5" fill="none" stroke="#5dffb0" stroke-width="1.4" opacity="0.6"/>';
  },
  // phone: gas, brake and handbrake under the right thumb; slide between them
  ppedals() {
    const D = 3.6, gas = [130, 64], hand = [104, 52], brake = [111, 75];
    const GAS = '<rect x="122" y="49" width="17" height="31" rx="4.5"';
    const pads = `${GAS} fill="rgba(20,10,40,0.9)" stroke="#5dffb0" stroke-width="1.6"/>${seen(D, 0, 0.3, `${GAS} fill="#5dffb0" opacity="0.45"/>`, true)}${seen(D, 0.7, 1, `${GAS} fill="#5dffb0" opacity="0.45"/>`)}
      <circle cx="${brake[0]}" cy="${brake[1]}" r="7.5" fill="rgba(20,10,40,0.9)" stroke="rgba(255,255,255,0.5)" stroke-width="1.4"/><path d="M${brake[0] - 4} ${brake[1] - 1.5} h8 M${brake[0] - 4} ${brake[1] + 1.5} h8" stroke="rgba(255,255,255,0.7)" stroke-width="1.2"/>
      <circle cx="${hand[0]}" cy="${hand[1]}" r="8.5" fill="rgba(20,10,40,0.9)" stroke="#ffb347" stroke-width="1.6"/>${seen(D, 0.38, 0.62, `<circle cx="${hand[0]}" cy="${hand[1]}" r="8.5" fill="#ffb347" opacity="0.55"/>`)}
      <path d="M${hand[0] - 3.5} ${hand[1] + 4} L${hand[0] + 3} ${hand[1] - 3.5}" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="${hand[0] + 3.3}" cy="${hand[1] - 3.8}" r="1.8" fill="#fff"/>`;
    const t = still() ? `<g transform="translate(${gas[0]} ${gas[1]})">${THUMB}</g>`
      : `<g><animateTransform attributeName="transform" type="translate" values="${[gas, gas, hand, hand, gas, gas].map((q) => q.join(' ')).join(';')}" keyTimes="0;0.28;0.38;0.62;0.72;1" dur="${D}s" ${LOOP}/>${THUMB}</g>`;
    // close in on the right-hand end of the phone, where the thumb is
    return `<g transform="translate(-130 -64) scale(1.85)">${PHONE}<rect x="80" y="15" width="67" height="70" rx="6" fill="rgba(255,63,164,0.06)"/>${pads}${t}</g>`;
  },
  // phone: Settings has a slider for the gas, a press-harder gas, and tilt to steer
  pways() {
    const D = 4;
    const sw = still() ? '' : `<animateTransform attributeName="transform" type="rotate" values="-12 80 50;12 80 50;-12 80 50" dur="${D}s" ${LOOP}/>`;
    const fill = still() ? '' : `<animate attributeName="height" values="6;44;6" dur="${D / 2}s" ${LOOP}/><animate attributeName="y" values="74;36;74" dur="${D / 2}s" ${LOOP}/>`;
    return `<g ${still() ? 'transform="rotate(-10 80 50)"' : ''}>${sw}${PHONE}<rect x="126" y="30" width="10" height="50" rx="5" fill="rgba(20,10,40,0.9)" stroke="#5dffb0" stroke-width="1.4"/><rect x="127.5" y="60" width="7" height="20" rx="3.5" fill="#5dffb0" opacity="0.8">${fill}</rect>
      <path d="M28 52 a16 16 0 0 1 32 0" fill="none" stroke="#36f2ff" stroke-width="2.4" stroke-linecap="round"/><path d="M60 52 l-4 -4 M60 52 l4 -4 M28 52 l-4 -4 M28 52 l4 -4" stroke="#36f2ff" stroke-width="2.4" stroke-linecap="round"/></g>`;
  },
};

// the tips: one short line each, as a person would say it (c.pink: the sweet spot's colour word for the palette)
export const TIPS = [
  { id: 'start', title: 'START A DRIFT', text: () => 'Turn in, then pull the handbrake, or lift off and stab the gas with the wheel turned. The back end steps out.' },
  { id: 'zone', title: 'DRIFT IN THE ZONE', text: () => "Every corner has a glowing band. You only score while you're sliding inside it, and the faster you go, the more it pays." },
  { id: 'sweet', title: 'HIT THE SWEET SPOT', text: (c) => `The ${c.pink} line in the middle of the band pays double. Keep your slide right on it.` },
  { id: 'hold', title: 'HOLD IT', text: (c) => `Every full second you stay on the ${c.pink} line, still sliding, adds one to your multiplier.` },
  { id: 'switch', title: 'SWITCHBACKS', text: () => 'Hold a slide one way, then throw it the other way and hold that. Each switchback adds one to the multiplier.' },
  { id: 'link', title: 'LINK THE CORNERS', text: () => 'Still sliding when a zone ends? Reach the next one before the ring runs out and your multiplier goes up.' },
  { id: 'outside', title: 'RIDE THE OUTSIDE', text: (c) => `The ${c.pink} line runs close to the outside wall. You can brush it, but hit it and every point you haven't banked is gone.` },
  { id: 'cap', title: '×10 IS THE TOP', text: () => 'The multiplier tops out at ×10. Your chain banks when the slide ends, so end it before a wall does.' },
  { id: 'damage', title: 'DENTS AND REPAIRS', text: () => 'Every knock costs a little grip, steering or power. Fix the car up in the garage between runs.' },
  { id: 'ghost', title: 'RACE YOUR GHOST', text: () => 'Your best run on each course drives beside you, see-through. Beat it, and that run becomes the ghost.' },
  { id: 'stars', title: 'CHASE THE STARS', text: () => 'Every course has three star scores, and one above them: DEGENERATE. Harder courses pay more.' },
  { id: 'garage', title: 'THE GARAGE', text: () => 'Every run pays credits. Spend them in the garage on parts, paint and faster cars.' },
  { id: 'pstick', phone: true, title: 'THE STICK', text: () => 'Put your left thumb down anywhere on the left half of the screen. The stick appears right under it.' },
  { id: 'ppedals', phone: true, title: 'THE PEDALS', text: () => 'Gas, brake and handbrake sit under your right thumb. Slide between them without lifting.' },
  { id: 'pways', phone: true, title: 'TILT OR SLIDE', text: () => 'Settings has other ways to drive: a slider or a press-harder gas, and steering by tilting the phone.' },
];
const byId = (id) => TIPS.find((t) => t.id === id);

// which tip comes next, kept per player
export class Tips {
  constructor(game) {
    this.g = game; this.s = read(); this.rand = Math.random;
    try { localStorage.removeItem(OLD); } catch (e) { /* nothing kept */ } // 11-17's three cards are gone
  }
  pool() { const touch = this.g.input.touch; return TIPS.filter((t) => !t.phone || touch); }
  // the basics in order, then any but the last RECENT shown
  next() {
    const s = this.s; let tip, n = -1;
    if (s.seq < BASICS.length) { n = s.seq; tip = byId(BASICS[n]); s.seq++; }
    else {
      const pool = this.pool(), fresh = pool.filter((t) => !s.recent.includes(t.id)), from = fresh.length ? fresh : pool;
      tip = from[Math.floor(this.rand() * from.length) % from.length];
    }
    s.recent = [tip.id, ...s.recent.filter((id) => id !== tip.id)].slice(0, RECENT);
    write(s);
    return { tip, n };
  }
  // Settings > Show the tips again: the basics from the start
  again() { this.s = { seq: 0, recent: [] }; write(this.s); }
  get fresh() { return this.s.seq === 0; }
  ctx() { const g = this.g, safe = g.settings && g.settings.palette === 'safe'; return { touch: g.input.touch, pink: safe ? 'amber' : 'pink', handKey: keyName(g.input.keysFor('hand')[0]).toUpperCase() }; }
  html({ tip, n }) {
    const c = this.ctx(), k = n >= 0 ? `THE BASICS &middot; ${n + 1} OF ${BASICS.length}` : 'TIP';
    return `<div class="ltip" data-tip="${tip.id}" role="group" aria-label="Tip"><svg class="ldemo" viewBox="0 0 160 100" aria-hidden="true">${DEMO[tip.id](c)}${still() ? '' : KEEP}</svg>
      <div class="ltext"><div class="kicker">${k}</div>${ART.title(tip.title, 'ltitle')}<p>${tip.text(c)}</p></div></div>`;
  }
}

// the loading screen a race launches behind (main.js launch drives it; js/loader.js's bar and words are its own)
export class TipScreen {
  constructor(game, tips) {
    this.g = game; this.tips = tips; this.L = game.loader;
    this.boot = document.getElementById('boot'); this.el = document.getElementById('boot-tip');
    this.up = false; this.ready = false; this.shown = null;
    // a tap skips it once the course is ready; it answers as the finger lands, and the rest of that tap (its lift and
    // the click after it) lands on this screen while it fades (css .boot.tipout), never on the countdown's HUD
    this.boot.addEventListener('pointerdown', (e) => { if (this.up && e.button <= 0) this.skip(); });
  }
  // up on the frame of the tap that launched it; resolves once that frame is on the screen
  // (upAt: the tap's frame; at: the first frame it is on the screen; doneAt: the course ready; goneAt: it went)
  async show(label) {
    this.upAt = performance.now(); this.doneAt = this.goneAt = 0;
    this.shown = this.tips.next(); this.up = true; this.ready = false; this.want = null; this.how = null;
    this.el.innerHTML = this.tips.html(this.shown);
    clearTimeout(this.outT); this.boot.classList.remove('tipout', 'ready'); this.boot.classList.add('tipping');
    await this.L.show(label);
    this.at = performance.now();
    return this.shown;
  }
  step(f) { return this.L.step(f); }
  // the work is done: resolves 'go' at MIN_MS (at once if the work took longer), on a tap or Enter, or 'back' (Esc, B)
  wait() {
    this.ready = true; this.doneAt = performance.now();
    this.L.what.textContent = this.g.input.touch ? 'Tap to drive' : 'Click or press Enter to drive';
    this.boot.classList.add('ready');
    return new Promise((ok) => {
      this.resolve = ok;
      if (this.want) { this.end(this.want); return; }
      this.timer = setTimeout(() => this.end('go'), Math.max(0, this.at + MIN_MS - this.doneAt));
    });
  }
  skip() { if (this.up && this.ready && performance.now() - this.at >= GUARD_MS) this.end('go'); }
  back() { if (!this.up) return; if (this.ready) this.end('back'); else this.want = 'back'; }
  // the keys and a pad, from the game's frame while the screen is up
  keys(input) { if (input.edge('Escape', 'PadB')) this.back(); else if (input.edge('Enter', 'NumpadEnter', 'Space', 'PadA', 'PadPause')) this.skip(); }
  end(how) { clearTimeout(this.timer); const ok = this.resolve; this.resolve = null; this.how = how; if (ok) ok(how); }
  hide() {
    this.up = false; this.ready = false; clearTimeout(this.timer); this.resolve = null; this.goneAt = performance.now();
    this.L.hide(); this.boot.classList.add('tipout');
    // it fades over 0.6 s (css .boot); the rest of a skipping tap is its for the first 0.4 s of that
    this.outT = setTimeout(() => { this.boot.classList.remove('tipout'); this.outT = setTimeout(() => { this.boot.classList.remove('tipping', 'ready'); this.el.innerHTML = ''; }, 250); }, 400);
  }
}
