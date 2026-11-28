// DEGEN DRIFT: the rank badges (11-27 (4), the levels). Kalakar's group A, approved by Dirigent for Evrtek, ported from her
// art/incoming/kalakar-art-1127/ranks.mjs and lib.mjs (the drawing is hers, line for line; only the plumbing is the
// game's: the house letters from art.js, and ids made unique per badge so several can sit on one screen).
// The heart is the LEVEL emblem's hexagon and number, unchanged; the frame grows by tier, eleven of them, ten levels each:
//   class 1, the plate (1-39): the bare hexagon, then 1, 2, 3 chevrons under it; class 2, the wings (40-69); class 3, the
//   crown (70-99), the 90s with a fan of rays; class 4, the halo (100): platinum in front of the striped sun.
// rank(level, hexPx) sizes the badge by its hexagon (the number the same size on every tier) and lets the frame overflow.
import { letters } from './art.js?v=0.1.26';

export const TIERS = [
  { n: 1, lo: 1, hi: 9, name: 'STILL STOCK' }, { n: 2, lo: 10, hi: 19, name: 'LOT RAT' }, { n: 3, lo: 20, hi: 29, name: 'CONE KILLER' },
  { n: 4, lo: 30, hi: 39, name: 'FULL SEND' }, { n: 5, lo: 40, hi: 49, name: 'SMOKE SHOW' }, { n: 6, lo: 50, hi: 59, name: 'WALL TAPPER' },
  { n: 7, lo: 60, hi: 69, name: 'STREET MENACE' }, { n: 8, lo: 70, hi: 79, name: 'APEX PREDATOR' }, { n: 9, lo: 80, hi: 89, name: 'SLIDE LORD' },
  { n: 10, lo: 90, hi: 99, name: 'CERTIFIED DEGEN' }, { n: 11, lo: 100, hi: 100, name: 'PEAK DEGEN' },
];
export const tierOf = (level) => TIERS[Math.min(10, Math.floor(Math.max(1, level) / 10))];

const C = { ink: '#14072a', key: '#12081f' };
const f = (n) => (Math.round(n * 100) / 100).toString();
const W = 200, H = 180, CX = 100, CY = 92, K = 1.5;
const PINK = '#ff3fa4', CYAN = '#36f2ff';
const ST = {
  1: { stroke: PINK, glow: PINK, chev: 0 },
  2: { stroke: PINK, glow: PINK, chev: 1, chevCol: CYAN },
  3: { stroke: PINK, glow: PINK, chev: 2, chevCol: CYAN },
  4: { stroke: PINK, glow: PINK, chev: 3, chevCol: CYAN },
  5: { stroke: PINK, glow: PINK, chev: 1, chevCol: CYAN, wings: 2, span: 31, wingA: '#ff3fa4', wingB: '#c9a2ff' },
  6: { stroke: PINK, glow: PINK, chev: 2, chevCol: CYAN, wings: 3, span: 38, wingA: '#ff3fa4', wingB: '#ffb347' },
  7: { stroke: 'hot', glow: '#ff7a3c', chev: 3, chevCol: '#ffb347', wings: 4, span: 45, wingA: '#ff7a3c', wingB: '#ffe08a' },
  8: { stroke: 'gold', glow: '#ffb347', chev: 1, chevCol: '#ffd76a', wings: 4, span: 46, wingA: '#ffb347', wingB: '#fff3b0', crown: 3 },
  9: { stroke: 'gold', glow: '#ffb347', chev: 2, chevCol: '#ffd76a', wings: 4, span: 49, wingA: '#ffb347', wingB: '#fff3b0', crown: 5 },
  10: { stroke: 'gold', glow: '#ffb347', chev: 3, chevCol: '#ffd76a', wings: 4, span: 52, wingA: '#ffb347', wingB: '#fff3b0', crown: 5, halo: 1 },
  11: { stroke: 'plat', glow: '#ff3fa4', chev: 0, wings: 4, span: 54, wingA: '#36f2ff', wingB: '#ffffff', crown: 5, halo: 2 },
};
// the tier's name colour (Kalakar: the emblem's pink, then hot, gold, platinum)
export const toneOf = (n) => (n <= 6 ? 'pink' : n === 7 ? 'hot' : n === 11 ? 'cyan' : 'gold2');

// ---- her kit (lib.mjs): a document that collects its own gradients, clips and masks; ids prefixed per badge
const GAME_DEFS = (p) => `<linearGradient id="${p}gNeon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#36f2ff"/><stop offset="1" stop-color="#ff3fa4"/></linearGradient><linearGradient id="${p}gHot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#ff3fa4"/></linearGradient><linearGradient id="${p}gGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset="0.55" stop-color="#ffb347"/><stop offset="1" stop-color="#ff3fa4"/></linearGradient><linearGradient id="${p}gPanel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1250"/><stop offset="1" stop-color="#0d0620"/></linearGradient><linearGradient id="${p}gSun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="0.5" stop-color="#ff7a3c"/><stop offset="1" stop-color="#ff3fa4"/></linearGradient>`;
const filt = (p, w, h) => {
  const R = `filterUnits="userSpaceOnUse" x="${-w}" y="${-h}" width="${w * 3}" height="${h * 3}"`;
  const g = (n) => `<filter id="${p}fG${String(n).replace('.', '_')}" ${R}><feGaussianBlur stdDeviation="${n}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  const b = (n) => `<filter id="${p}fB${String(n).replace('.', '_')}" ${R}><feGaussianBlur stdDeviation="${n}"/></filter>`;
  return [1.6, 3].map(g).join('') + [6, 12].map(b).join('');
};
class Doc {
  constructor(w, h, p) { this.w = w; this.h = h; this.defs = []; this.body = []; this.n = 0; this.p = p; }
  id() { return this.p + 'k' + (this.n++); }
  lin(stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1, user = false) {
    const id = this.id();
    this.defs.push(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${user ? ' gradientUnits="userSpaceOnUse"' : ''}>${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a == null ? '' : ` stop-opacity="${a}"`}/>`).join('')}</linearGradient>`);
    return `url(#${id})`;
  }
  clip(inner) { const id = this.id(); this.defs.push(`<clipPath id="${id}">${inner}</clipPath>`); return `url(#${id})`; }
  mask(inner) { const id = this.id(); this.defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" x="${-this.w}" y="${-this.h}" width="${this.w * 3}" height="${this.h * 3}">${inner}</mask>`); return `url(#${id})`; }
  add(...s) { this.body.push(...s); return this; }
  // the kit's shared ids (gNeon, fG3...) written as #name in the drawing, prefixed here
  svg(vb, attrs) { const p = this.p; return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ${attrs}><defs>${GAME_DEFS(p)}${filt(p, this.w, this.h)}${this.defs.join('')}</defs>${this.body.join('').replace(/url\(#(g[A-Z]\w*|f[GB][\d_]+)\)/g, `url(#${p}$1)`)}</svg>`; }
}
function lt(text, { x = 0, y = 0, h = 10, tone, skew = -12, gap = 2.5, sw = 1.5, keyW = 2.35, maxW = 0 } = {}) {
  const L = letters(text, gap), s = h / 10; let sx = s;
  if (maxW && L.w * s > maxW) sx = maxW / L.w;
  const w = L.w * sx, x0 = x - w / 2, off = Math.tan(-skew * Math.PI / 180) * 5 * s;
  const P = (extra) => `<path d="${L.d}" fill="none" stroke-linejoin="miter" stroke-linecap="square" ${extra}/>`;
  return `<g transform="translate(${f(x0 + off)} ${f(y)}) scale(${f(sx)} ${f(s)}) skewX(${skew})">${P(`stroke="${C.ink}" stroke-width="${keyW}"`)}${P(`stroke="${tone}" stroke-width="${sw}"`)}</g>`;
}
function sun(doc, cx, cy, r, { bars = 6, from = 0.05 } = {}) {
  let cuts = ''; const y0 = cy + r * from, span = r - r * from;
  for (let k = 0; k < bars; k++) { const t = k / bars, y = y0 + span * (t + 0.02), th = span / bars * (0.18 + 0.5 * t); cuts += `<rect x="${f(cx - r - 2)}" y="${f(y)}" width="${f(r * 2 + 4)}" height="${f(th)}" fill="#000"/>`; }
  const m = doc.mask(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/>${cuts}`);
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#gSun)" mask="${m}"/>`;
}

// ---- her badge (ranks.mjs)
const R = 25 * K, SQ = Math.sqrt(3) / 2, SL = 1 / Math.sqrt(3);
const hex = (r) => `M${CX} ${f(CY - r)}L${f(CX + r * SQ)} ${f(CY - r / 2)}V${f(CY + r / 2)}L${CX} ${f(CY + r)}L${f(CX - r * SQ)} ${f(CY + r / 2)}V${f(CY - r / 2)}Z`;
const halfW = (y) => { const d = Math.abs(y - CY); return d <= R / 2 ? R * SQ : Math.max(0, (R - d) / SL); };
const topY = (x) => CY - R + Math.abs(x - CX) * SL;
const CHEV0 = 10.5, CHEVD = 9.5, WING_GAP = 7;
function chevrons(n, col) {
  let s = ''; const hw = 25;
  for (let i = 0; i < n; i++) { const y = CY + R + CHEV0 + i * CHEVD; s += `M${CX - hw} ${f(y - hw * SL)}L${CX} ${f(y)}L${CX + hw} ${f(y - hw * SL)}`; }
  return `<g filter="url(#fG1_6)"><path d="${s}" fill="none" stroke="${C.ink}" stroke-width="7.4" stroke-linejoin="miter" stroke-linecap="butt"/><path d="${s}" fill="none" stroke="${col}" stroke-width="4.6" stroke-linejoin="miter" stroke-linecap="butt"/></g>`;
}
function wings(doc, n, top, a, b) {
  const g = doc.lin([[0, a], [1, b]], 0, 1, 1, 0); let s = '';
  for (const side of [1, -1]) for (let k = 0; k < n; k++) {
    const y = CY - 17 + k * 9.6, th = 6.6, x0 = CX + halfW(y + th * 0.6) + WING_GAP, len = top - k * Math.min(7.5, top / (n + 1.2)), rise = len * 0.52;
    const P = [[x0, y], [x0 + len, y - rise], [x0 + len - 8.5, y - rise + th + 4.4], [x0, y + th]].map(([px, py]) => `${f(CX + (px - CX) * side)} ${f(py)}`).join('L');
    s += `<path d="M${P}Z" fill="${g}" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="miter"/>`;
  }
  return `<g filter="url(#fG1_6)">${s}</g>`;
}
const crownH = (pts, big) => (pts === 3 ? 15 : big ? 18 : 16);
function crown(pts, big, paint) {
  const lift = 6.5, hw = pts === 3 ? 21 : 26, hc = crownH(pts, big), base = (x) => topY(x) - lift, J = [];
  const tips = pts === 3 ? [[-hw, hc * 0.72], [0, hc], [hw, hc * 0.72]] : [[-hw, hc * 0.62], [-hw / 2, hc * 0.8], [0, hc], [hw / 2, hc * 0.8], [hw, hc * 0.62]];
  let up = '';
  tips.forEach(([dx, hh], i) => {
    const x = CX + dx; up += `L${f(x)} ${f(base(x) - 4 - hh)}`; J.push([x, base(x) - 4 - hh, dx === 0]);
    if (i < tips.length - 1) { const xm = CX + (dx + tips[i + 1][0]) / 2; up += `L${f(xm)} ${f(base(xm) - 4 - hc * 0.2)}`; }
  });
  const d = `M${f(CX - hw + 2)} ${f(base(CX - hw + 2))}${up}L${f(CX + hw - 2)} ${f(base(CX + hw - 2))}L${CX} ${f(base(CX))}Z`;
  return `<g filter="url(#fG1_6)"><path d="${d}" fill="${paint}" stroke="${C.ink}" stroke-width="1.7" stroke-linejoin="miter"/>`
    + `<path d="M${f(CX - hw + 4)} ${f(base(CX - hw + 4) - 4)}L${CX} ${f(base(CX) - 4)}L${f(CX + hw - 4)} ${f(base(CX + hw - 4) - 4)}" fill="none" stroke="${C.ink}" stroke-width="1.2" opacity="0.65"/>`
    + J.map(([x, y, mid]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${mid ? 2.8 : 2.1}" fill="${mid ? PINK : CYAN}" stroke="${C.ink}" stroke-width="0.9"/>`).join('') + '</g>';
}
function rays(a0, a1, step, r1, r2, col, wid = 2.4) {
  let s = ''; let k = 0;
  for (let a = a0; a <= a1 + 0.01; a += step, k++) { const t = a * Math.PI / 180, rr = k % 2 === 0 ? r2 : r1 + (r2 - r1) * 0.45; s += `M${f(CX + Math.cos(t) * r1)} ${f(CY + Math.sin(t) * r1)}L${f(CX + Math.cos(t) * rr)} ${f(CY + Math.sin(t) * rr)}`; }
  return `<path d="${s}" fill="none" stroke="${col}" stroke-width="${wid}" stroke-linecap="butt" filter="url(#fG1_6)"/>`;
}
export const PLATE = { x: CX - R * SQ, y: CY - R, w: R * SQ * 2, h: R * 2 };

let uid = 0;
// the badge as SVG text: its full 200 x 180 box (or, named, 24 more under it for the tier's name)
export function rankSvg(level, { named = false } = {}) {
  const tier = tierOf(level).n, T = TIERS[tier - 1], S = ST[tier], h = named ? H + 24 : H, doc = new Doc(W, h, 'rk' + (++uid).toString(36) + '-');
  const paint = { hot: 'url(#gHot)', gold: 'url(#gGold)', plat: doc.lin([[0, '#ffffff'], [0.45, '#bff6ff'], [1, '#36f2ff']]) }[S.stroke] || S.stroke;
  const tube = doc.lin([[0, '#ffffff', S.stroke === PINK ? 1 : 0.75], [0.42, '#ffffff', 0]], 0, CY - R - 4, 0, CY + R + 4, true);
  const num = doc.lin([[0, '#ffffff'], [0.55, '#d7fbff'], [1, '#ffc4e6']]);
  if (S.halo === 1) { const a = Math.PI / 7, r = 67; doc.add(`<path d="M${f(CX - r * Math.cos(a))} ${f(CY - r * Math.sin(a))}A${r} ${r} 0 0 1 ${f(CX + r * Math.cos(a))} ${f(CY - r * Math.sin(a))}" fill="none" stroke="#ffd76a" stroke-width="2.4" filter="url(#fG1_6)"/>`, rays(-154, -26, 8, 71, 82, '#ffd76a')); }
  if (S.halo === 2) {
    doc.add(`<circle cx="${CX}" cy="${CY}" r="68" fill="${PINK}" opacity="0.4" filter="url(#fB12)"/>`, `<circle cx="${CX}" cy="${CY}" r="62" fill="#1a0b33"/>`, sun(doc, CX, CY, 60, { bars: 5, from: 0.36 }),
      `<circle cx="${CX}" cy="${CY}" r="66" fill="none" stroke="${C.ink}" stroke-width="5.8"/>`, `<circle cx="${CX}" cy="${CY}" r="66" fill="none" stroke="url(#gNeon)" stroke-width="3.4" filter="url(#fG3)"/>`,
      rays(-180, 172, 7.5, 72, 83, '#ffe08a', 2.2));
  }
  if (S.wings) doc.add(wings(doc, S.wings, S.span, S.wingA, S.wingB));
  if (S.chev) doc.add(chevrons(S.chev, S.chevCol));
  const P = hex(R), cl = doc.clip(`<path d="${P}"/>`);
  doc.add(`<g filter="url(#fG3)"><path d="${P}" fill="url(#gPanel)" stroke="${paint}" stroke-width="${f(5 * K)}" stroke-linejoin="miter"/><path d="${P}" fill="none" stroke="${tube}" stroke-width="${f(5 * K)}" stroke-linejoin="miter"/></g>`,
    tier >= 7 ? `<g clip-path="${cl}"><ellipse cx="${CX}" cy="${f(CY + R)}" rx="34" ry="17" fill="${S.glow}" opacity="0.3" filter="url(#fB6)"/></g>` : '',
    `<path d="${hex(R - 4.4 * K)}" fill="none" stroke="${tier >= 8 && tier < 11 ? PINK : CYAN}" stroke-width="${f(K)}" opacity="0.55" stroke-linejoin="miter"/>`);
  if (S.crown) doc.add(crown(S.crown, tier >= 10, tier === 11 ? paint : 'url(#gGold)'));
  const str = String(level), nh = (str.length >= 3 ? 18 : 23) * K;
  doc.add(lt(str, { x: CX, y: CY - nh / 2, h: nh, gap: 1.6, sw: 1.9, keyW: 3.1, skew: -8, tone: num }));
  const label = `Level ${level}, ${T.name}`;
  return doc.svg(`0 0 ${W} ${h}`, `role="img" aria-label="${label}" overflow="visible"`);
}
// the badge for a layout: a box the size of its hexagon (hexPx tall), the frame drawn past it, never taking room
export function rank(level, hexPx = 36, cls = '') {
  const s = hexPx / PLATE.h, w = PLATE.w * s;
  return `<span class="rank ${cls}" style="width:${f(w)}px;height:${f(hexPx)}px">${rankSvg(level).replace('<svg ', `<svg style="left:${f(-PLATE.x * s)}px;top:${f(-PLATE.y * s)}px;width:${f(W * s)}px;height:${f(H * s)}px" `)}</span>`;
}
