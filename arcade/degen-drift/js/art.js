// DEGEN DRIFT: the interface art, drawn in house as SVG (REIMERTEK STUDIOS synthwave: chrome lettering, cyan and
// hot-pink neon on deep violet). The wordmark is built from its own stroke letterforms (never a system font), and the
// same letters spell the DEGENERATE badge. Part illustrations are neon line drawings. One hidden <svg> holds the shared
// gradients and the glow filter, so every icon stays a few hundred bytes.
import { outlineOf } from './carbodies.js?v=0.1.25'; // 11-16 (cars builder, Portero 002): the profiles follow the rebuilt bodies

// stroke letterforms on a 5 x 10 grid (I is 0 wide, T is 6)
const GLYPH = {
  A: [5, 'M0 10V2.2L2.2 0H2.8L5 2.2V10M0 6H5'],
  D: [5, 'M0 0H3.2L5 1.8V8.2L3.2 10H0Z'],
  E: [5, 'M5 0H0V10H5M0 5H3.6'],
  F: [5, 'M5 0H0V10M0 5H3.6'],
  G: [5, 'M5 2.2V0H0V10H5V5.4H2.2'],
  I: [0, 'M0 0V10'],
  N: [5, 'M0 10V0L5 10V0'],
  R: [5, 'M0 10V0H4L5 1V4L4 5H0M2.4 5L5 10'],
  T: [6, 'M0 0H6M3 0V10'],
  ' ': [2.2, ''],
  // day 3: the rest of the alphabet, the digits and some punctuation, drawn to the same rules (straight strokes, 45-degree
  // chamfers, a 5 x 10 grid), so every title in the game is lettered, never set in a system font
  B: [5, 'M0 10V0H4L5 1V4L4 5H0M4 5L5 6V9L4 10H0'],
  C: [5, 'M5 0H1.4L0 1.4V8.6L1.4 10H5'],
  H: [5, 'M0 0V10M5 0V10M0 5H5'],
  J: [5, 'M5 0V8.6L3.6 10H0V7.4'],
  K: [5, 'M0 0V10M0 5H1.2L5 0M1.2 5L5 10'],
  L: [5, 'M0 0V10H5'],
  M: [6, 'M0 10V0L3 4.2L6 0V10'],
  O: [5, 'M1.4 0H3.6L5 1.4V8.6L3.6 10H1.4L0 8.6V1.4Z'],
  P: [5, 'M0 10V0H4L5 1V4L4 5H0'],
  Q: [5, 'M1.4 0H3.6L5 1.4V8.6L3.6 10H1.4L0 8.6V1.4ZM2.8 7.4L5.4 10.4'],
  S: [5, 'M5 0H1L0 1V4L1 5H4L5 6V9L4 10H0'],
  U: [5, 'M0 0V8.6L1.4 10H3.6L5 8.6V0'],
  V: [5, 'M0 0L2.5 10L5 0'],
  W: [7, 'M0 0L1.6 10L3.5 3.4L5.4 10L7 0'],
  X: [5, 'M0 0L5 10M5 0L0 10'],
  Y: [5, 'M0 0L2.5 5L5 0M2.5 5V10'],
  Z: [5, 'M0 0H5L0 10H5'],
  0: [5, 'M1.4 0H3.6L5 1.4V8.6L3.6 10H1.4L0 8.6V1.4ZM3.6 2.6L1.4 7.4'],
  1: [2.4, 'M0 2L2.4 0V10'],
  2: [5, 'M0 1L1 0H4L5 1V4L4 5H1L0 6V10H5'],
  3: [5, 'M0 0H4L5 1V4L4 5H1.6M4 5L5 6V9L4 10H0'],
  4: [5, 'M3.6 10V0L0 6.6H5'],
  5: [5, 'M5 0H0V4.6H4L5 5.6V9L4 10H0'],
  6: [5, 'M4.6 0H1.4L0 1.4V10H4L5 9V6L4 5H0'],
  7: [5, 'M0 0H5L1.6 10'],
  8: [5, 'M1 0H4L5 1V4L4 5H1L0 6V9L1 10H4L5 9V6L4 5H1L0 4V1Z'],
  9: [5, 'M5 5H1L0 4V1L1 0H5V8.6L3.6 10H0.4'],
  '-': [3.4, 'M0 5.4H3.4'],
  '.': [0, 'M0 9V10'],
  ',': [0.8, 'M0.8 9L0 11'],
  ':': [0, 'M0 3V4M0 8V9'],
  '!': [0, 'M0 0V6.6M0 9V10'],
  '?': [5, 'M0 1L1 0H4L5 1V4L2.5 5.4V7M2.5 9V10'],
  "'": [0, 'M0 0V3'],
  '/': [4, 'M0 10L4 0'],
  '+': [4, 'M0 5H4M2 3V7'],
  '×': [4, 'M0 3L4 9M4 3L0 9'],
  '&': [5, 'M5 10L1 4V1L2 0H3.2L4.2 1V3L0 6.4V9L1 10H3.2L5 7.6'],
  '%': [5, 'M0 10L5 0M0 0V2M5 8V10'],
  '·': [0, 'M0 4.6V5.4'],
};
// a word as a path: returns { d, w } in grid units (height 10)
export function letters(str, gap = 1.75) {
  let x = 0; const parts = [];
  for (const ch of String(str).toUpperCase()) {
    const g = GLYPH[ch] || GLYPH[ch === '×' ? '×' : ' ']; if (!g) continue;
    if (g[1]) parts.push(g[1].replace(/([MLHVZ])([^MLHVZ]*)/g, (m, c, args) => {
      const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
      if (c === 'H') return 'H' + (n[0] + x).toFixed(2);
      if (c === 'V' || c === 'Z') return c + (n.length ? n[0] : '');
      const out = []; for (let i = 0; i < n.length; i += 2) out.push((n[i] + x).toFixed(2), n[i + 1]); return c + out.join(' ');
    }));
    x += g[0] + gap;
  }
  return { d: parts.join(''), w: x - gap };
}

export const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="gNeon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#36f2ff"/><stop offset="1" stop-color="#ff3fa4"/></linearGradient>
  <linearGradient id="gHot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#ff3fa4"/></linearGradient>
  <linearGradient id="gChrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.3" stop-color="#bff6ff"/><stop offset="0.37" stop-color="#2b3d8f"/><stop offset="0.4" stop-color="#ff7ad1"/><stop offset="1" stop-color="#ffd1ec"/></linearGradient>
  <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset="0.55" stop-color="#ffb347"/><stop offset="1" stop-color="#ff3fa4"/></linearGradient>
  <linearGradient id="gPanel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1250"/><stop offset="1" stop-color="#0d0620"/></linearGradient>
  <linearGradient id="gMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f2ff"/><stop offset="0.42" stop-color="#9aa6cc"/><stop offset="0.5" stop-color="#3a2a66"/><stop offset="0.62" stop-color="#ff7ad1"/><stop offset="1" stop-color="#5a3a8a"/></linearGradient>
  <linearGradient id="gPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26114a"/><stop offset="0.62" stop-color="#140828"/><stop offset="1" stop-color="#3a0f3c"/></linearGradient>
  <linearGradient id="gSun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="0.5" stop-color="#ff7a3c"/><stop offset="1" stop-color="#ff3fa4"/></linearGradient>
  <radialGradient id="gRubber" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#3a3048"/><stop offset="1" stop-color="#0e0916"/></radialGradient>
  <filter id="fGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="fBloom" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="3"/></filter>
</defs></svg>`;

// the title: DEGEN DRIFT in chrome over a pink glow, slanted, with a drift line swept under it
export function wordmark() {
  const L = letters('DEGEN DRIFT'), w = L.w, pad = 4, W = w + pad * 2 + 6, H = 22;
  return `<svg class="wordmark" viewBox="0 0 ${W} ${H}" role="img" aria-label="DEGEN DRIFT">
    <g transform="translate(${pad + 3} 3) skewX(-14)">
      <path d="${L.d}" fill="none" stroke="#ff3fa4" stroke-width="3.4" stroke-linejoin="miter" stroke-linecap="square" filter="url(#fBloom)" opacity="0.85"/>
      <path d="${L.d}" fill="none" stroke="#1a0b33" stroke-width="2.6" stroke-linejoin="miter" stroke-linecap="square"/>
      <path d="${L.d}" fill="none" stroke="url(#gChrome)" stroke-width="1.9" stroke-linejoin="miter" stroke-linecap="square"/>
      <path d="${L.d}" fill="none" stroke="#ffffff" stroke-width="0.25" stroke-linejoin="miter" opacity="0.7" transform="translate(-0.25 -0.25)"/>
    </g>
    <path d="M${W * 0.08} ${H - 3.2} C ${W * 0.35} ${H - 1.2}, ${W * 0.62} ${H - 1.4}, ${W * 0.97} ${H - 5.6}" fill="none" stroke="url(#gNeon)" stroke-width="0.9" stroke-linecap="round" filter="url(#fGlow)"/>
  </svg>`;
}

// any title in the lettering (day 3): chrome over a dark keyline and a pink bloom, slanted like the wordmark. Sized by
// CSS (height; the width follows the text): <svg class="lt"> scales with the line it sits in.
export function title(text, cls = '', tone = 'chrome') {
  const L = letters(text, 2.5), pad = 1.6, W = L.w + pad * 2 + 2.4, H = 13.4;
  const fill = tone === 'gold' ? 'url(#gGold)' : tone === 'neon' ? 'url(#gNeon)' : 'url(#gChrome)';
  return `<svg class="lt ${cls}" viewBox="0 0 ${W.toFixed(1)} ${H}" style="aspect-ratio:${W.toFixed(1)}/${H}" role="img" aria-label="${String(text).replace(/"/g, '')}"><g transform="translate(${pad + 2} 1.7) skewX(-12)">
    <path d="${L.d}" fill="none" stroke="#14072a" stroke-width="2.35" stroke-linejoin="miter" stroke-linecap="square"/>
    <path d="${L.d}" fill="none" stroke="${fill}" stroke-width="1.5" stroke-linejoin="miter" stroke-linecap="square"/></g></svg>`;
}

// the top tier's badge: a neon shield, a smoking tire, and DEGENERATE in the wordmark's letters
export function degenerateBadge(cls = 'badge-deg') {
  const L = letters('DEGENERATE', 1.3), s = 52 / L.w;
  return `<svg class="${cls}" viewBox="0 0 120 120" role="img" aria-label="Degenerate">
    <path d="M60 4 L110 22 V62 C110 92 84 108 60 116 C36 108 10 92 10 62 V22 Z" fill="url(#gPanel)" stroke="url(#gGold)" stroke-width="3.2" filter="url(#fGlow)"/>
    <path d="M60 12 L102 27 V61 C102 86 81 100 60 107 C39 100 18 86 18 61 V27 Z" fill="none" stroke="#ff3fa4" stroke-width="0.8" opacity="0.6"/>
    <g transform="translate(60 52)">
      <path d="M-30 6 C-36 -6 -22 -14 -14 -8 C-12 -20 6 -20 8 -10 C16 -18 32 -10 26 2 C34 4 32 14 22 14" fill="none" stroke="#e8e4ee" stroke-width="2.2" stroke-linecap="round" opacity="0.75"/>
      <circle r="17" fill="#120a24" stroke="url(#gNeon)" stroke-width="4"/>
      <circle r="8" fill="none" stroke="#ffb347" stroke-width="2.5"/>
      ${[0, 1, 2, 3, 4].map((k) => `<path d="M0 -8 L0 -14" stroke="#ffb347" stroke-width="2" transform="rotate(${k * 72})"/>`).join('')}
    </g>
    <g transform="translate(${60 - L.w * s / 2 - 1} 82) scale(${s}) skewX(-10)"><path d="${L.d}" fill="none" stroke="url(#gGold)" stroke-width="1.8" stroke-linejoin="miter" stroke-linecap="square"/></g>
  </svg>`;
}

export function star(lit = true, size = 18) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" class="${lit ? 'lit' : ''}"><path d="M12 1.8l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.6 5.7 21.2l1.5-7.1L1.8 9.2 9 8.4z" fill="${lit ? 'url(#gGold)' : 'rgba(255,255,255,0.12)'}" stroke="${lit ? '#fff3b0' : 'rgba(255,255,255,0.25)'}" stroke-width="0.8" ${lit ? 'filter="url(#fGlow)"' : ''}/></svg>`;
}

// the car from above, its six parts coloured by damage (0 green .. 1 red)
export function conditionCar(d, w = 22, h = 40) {
  const c = (v) => { v = Math.max(0, Math.min(1, v || 0)); const r = Math.round(93 + v * 162), g = Math.round(255 - v * 176), b = Math.round(176 - v * 70); return `rgb(${r},${g},${b})`; };
  return `<svg viewBox="0 0 22 40" width="${w}" height="${h}" aria-hidden="true">
    <rect x="3" y="2" width="16" height="36" rx="6" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
    <path d="M6 4 h10 l2 6 h-14z" fill="${c(d.engine)}" opacity="0.9"/>
    <rect x="1" y="7" width="4" height="7" rx="1.5" fill="${c(d.fl)}"/><rect x="17" y="7" width="4" height="7" rx="1.5" fill="${c(d.fr)}"/>
    <rect x="1" y="26" width="4" height="7" rx="1.5" fill="${c(d.rl)}"/><rect x="17" y="26" width="4" height="7" rx="1.5" fill="${c(d.rr)}"/>
    <rect x="6" y="13" width="10" height="16" rx="2" fill="${c(d.body)}" opacity="0.55"/>
  </svg>`;
}

export function ratingRing(v, cls = 'ring') {
  const r = 26, C = 2 * Math.PI * r, f = Math.max(0, Math.min(1, v / 100));
  return `<svg class="${cls}" viewBox="0 0 64 64"><circle cx="32" cy="32" r="${r}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="6"/>
    <circle cx="32" cy="32" r="${r}" fill="none" stroke="url(#gNeon)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C * f} ${C}" transform="rotate(-90 32 32)" filter="url(#fGlow)"/>
    <text x="32" y="37" text-anchor="middle" font-size="17" font-weight="900" fill="#fff" font-family="inherit">${Math.round(v)}</text></svg>`;
}

// the parts, illustrated (64 x 64, day 3): filled metal and rubber with a dark keyline and a neon edge, on a plate with
// a horizon glow, so each reads at 48 px on a phone. Same ids as before (data/upgrades.js names them).
const K = 'stroke="#12081f" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"';
const MET = `fill="url(#gMetal)" ${K}`, DARK = `fill="#1d1230" ${K}`, RUB = `fill="url(#gRubber)" ${K}`;
const NE = 'fill="none" stroke="url(#gNeon)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const HOTF = `fill="#ff3fa4" ${K}`, AMBF = `fill="#ffb347" ${K}`;
const ring = (n, f) => Array.from({ length: n }, (_, k) => f(k, k * 360 / n)).join('');
const PLATE = '<rect x="1.5" y="1.5" width="61" height="61" rx="13" fill="url(#gPlate)" stroke="rgba(160,120,255,0.35)" stroke-width="1"/><path d="M6 47 H58 M10 52 H54 M15 57 H49" stroke="rgba(255,63,164,0.28)" stroke-width="0.8"/><ellipse cx="32" cy="46" rx="22" ry="5" fill="#ff7a3c" opacity="0.18"/>';
export const PART_ART = {
  tire: `<circle cx="32" cy="31" r="23" ${RUB}/>${ring(18, (k, a) => `<rect x="30" y="8.6" width="4" height="5" rx="1" fill="#2c2238" transform="rotate(${a} 32 31)"/>`)}<circle cx="32" cy="31" r="15" fill="#140c1e" stroke="#3a2c4c" stroke-width="2"/><circle cx="32" cy="31" r="10.5" ${MET}/><circle cx="32" cy="31" r="3" ${DARK}/><path d="M14 22 A20 20 0 0 1 30 10" ${NE}/>`,
  brake: `<circle cx="30" cy="34" r="21" ${MET}/><circle cx="30" cy="34" r="16" fill="none" stroke="#5a4a80" stroke-width="0.8"/>${ring(12, (k, a) => `<circle cx="30" cy="${k % 2 ? 22 : 19}" r="1.4" fill="#241536" transform="rotate(${a} 30 34)"/>`)}<circle cx="30" cy="34" r="7" ${DARK}/><path d="M37 12 A23 23 0 0 1 53 30 L45 33 A15 15 0 0 0 34 20Z" ${HOTF}/><path d="M41 18 l5 -3" stroke="#fff" stroke-width="1.2" opacity="0.7"/><path d="M10 26 A21 21 0 0 1 18 16" ${NE}/>`,
  coilover: `<rect x="27" y="6" width="10" height="5" rx="1.5" ${DARK}/><rect x="28.5" y="11" width="7" height="34" rx="2" ${MET}/><path d="M20 15 L44 19 M20 22 L44 26 M20 29 L44 33 M20 36 L44 40" stroke="#ff3fa4" stroke-width="3.4" stroke-linecap="round"/><path d="M20 15 L44 19 M20 22 L44 26 M20 29 L44 33 M20 36 L44 40" stroke="#ffd1ec" stroke-width="1" stroke-linecap="round" opacity="0.8"/><rect x="24" y="43" width="16" height="5" rx="1.5" ${AMBF}/><rect x="29" y="48" width="6" height="9" rx="2" ${DARK}/>`,
  diff: `<circle cx="32" cy="32" r="20" ${MET}/>${ring(20, (k, a) => `<rect x="30.4" y="9.5" width="3.2" height="4" fill="#9aa6cc" stroke="#12081f" stroke-width="0.8" transform="rotate(${a} 32 32)"/>`)}<circle cx="32" cy="32" r="11" ${DARK}/><rect x="6" y="29" width="14" height="6" rx="2" ${MET}/><rect x="44" y="29" width="14" height="6" rx="2" ${MET}/><circle cx="32" cy="32" r="5" ${AMBF}/><path d="M16 20 A18 18 0 0 1 28 13" ${NE}/>`,
  knuckle: `<circle cx="32" cy="34" r="20" fill="none" stroke="#1d1230" stroke-width="7"/><circle cx="32" cy="34" r="20" fill="none" stroke="url(#gMetal)" stroke-width="4.4"/><path d="M14 38 H26 L32 46 L38 38 H50" fill="none" stroke="#1d1230" stroke-width="6" stroke-linejoin="round"/><path d="M14 38 H26 L32 46 L38 38 H50" fill="none" stroke="url(#gMetal)" stroke-width="3.4" stroke-linejoin="round"/><circle cx="32" cy="36" r="5" ${HOTF}/><path d="M32 14 V8" stroke="#ff3fa4" stroke-width="3" stroke-linecap="round"/><path d="M8 22 A28 28 0 0 1 24 7" ${NE}/><path d="M24 7 l-6 0 M24 7 l-2 5" ${NE}/>`,
  seat: `<path d="M22 6 H40 Q46 6 45 13 L42 34 L50 46 Q52 52 46 53 H20 Q14 53 15 47 L20 34 L18 13 Q17 6 22 6Z" ${MET}/><path d="M24 11 H38 L36 32 H26Z" ${DARK}/><path d="M27 12 V31 M35 12 V31" stroke="#ff3fa4" stroke-width="2.6"/><path d="M20 40 H44" stroke="#12081f" stroke-width="1.4"/><circle cx="31" cy="21" r="2" fill="#36f2ff"/><path d="M47 14 Q50 22 46 30" ${NE}/>`,
  exhaust: `<rect x="5" y="30" width="26" height="12" rx="6" ${MET}/><path d="M31 33 H38 L44 26 H50 V40 H44 L38 39 H31Z" ${MET}/><ellipse cx="50" cy="33" rx="3" ry="7" ${DARK}/><path d="M53 27 Q61 33 53 39 Q58 33 53 27Z" fill="#36f2ff" opacity="0.9"/><path d="M55 24 Q66 33 55 42" stroke="#ff7a3c" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M8 32 H26" stroke="#fff" stroke-width="1" opacity="0.6"/>`,
  shifter: `<rect x="14" y="44" width="36" height="10" rx="3" ${DARK}/><path d="M22 47 V51 M32 47 V51 M42 47 V51 M22 49 H42" stroke="#36f2ff" stroke-width="1.4" stroke-linecap="round"/><rect x="30" y="20" width="4" height="26" rx="2" ${MET}/><circle cx="32" cy="15" r="9" ${MET}/><circle cx="32" cy="15" r="4" ${HOTF}/><path d="M25 9 A9 9 0 0 1 36 7" ${NE}/>`,
  engine: `<path d="M8 30 H14 V22 H50 V30 H56 V46 H50 V54 H14 V46 H8Z" ${MET}/><rect x="18" y="12" width="12" height="10" rx="2" ${HOTF}/><rect x="34" y="12" width="12" height="10" rx="2" ${HOTF}/><path d="M20 15 H28 M36 15 H44 M20 18 H28 M36 18 H44" stroke="#12081f" stroke-width="1"/><rect x="18" y="30" width="28" height="16" rx="3" ${DARK}/><path d="M22 35 H42 M22 41 H42" stroke="#36f2ff" stroke-width="1.6" stroke-linecap="round"/><path d="M14 24 H48" ${NE}/>`,
  turbo: `<path d="M34 50 A18 18 0 1 1 52 32 H46 A12 12 0 1 0 34 44Z" ${MET}/><circle cx="34" cy="32" r="12" ${DARK}/>${ring(8, (k, a) => `<path d="M34 32 L34 22 Q38 24 36 30Z" fill="#9aa6cc" stroke="#12081f" stroke-width="0.6" transform="rotate(${a} 34 32)"/>`)}<circle cx="34" cy="32" r="2.6" ${AMBF}/><rect x="44" y="8" width="12" height="16" rx="2" ${MET}/><path d="M10 22 A26 26 0 0 1 22 12" ${NE}/>`,
  nos: `<rect x="11" y="15" width="18" height="41" rx="8" fill="#2a6cff" ${K}/><rect x="35" y="15" width="18" height="41" rx="8" fill="#2a6cff" ${K}/><rect x="14" y="30" width="12" height="8" rx="1.5" fill="#36f2ff"/><rect x="38" y="30" width="12" height="8" rx="1.5" fill="#36f2ff"/><rect x="16" y="8" width="8" height="8" rx="1.5" ${MET}/><rect x="40" y="8" width="8" height="8" rx="1.5" ${MET}/><path d="M20 8 V5 H44 V8" stroke="#ff3fa4" stroke-width="2.2" fill="none"/><path d="M15 22 Q14 34 15 48 M39 22 Q38 34 39 48" stroke="#fff" stroke-width="1.6" opacity="0.6" fill="none"/>`,
  paint: `<rect x="16" y="22" width="22" height="34" rx="5" fill="#ff3fa4" ${K}/><rect x="16" y="32" width="22" height="12" fill="#8a5cff" opacity="0.9"/><rect x="21" y="14" width="12" height="9" rx="2" ${MET}/><rect x="24" y="9" width="6" height="6" rx="1" ${DARK}/><path d="M19 26 V52" stroke="#fff" stroke-width="1.6" opacity="0.6"/>${[[44, 10, 2.4, '#ff3fa4'], [50, 15, 2, '#36f2ff'], [46, 19, 1.6, '#ffb347'], [54, 9, 1.4, '#8a5cff'], [56, 20, 1.2, '#ff3fa4']].map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('')}`,
  rim: `<circle cx="32" cy="32" r="24" ${RUB}/><circle cx="32" cy="32" r="18" ${MET}/>${ring(5, (k, a) => `<path d="M30 30 L28 15 H36 L34 30Z" fill="#1d1230" transform="rotate(${a + 36} 32 32)"/>`)}<circle cx="32" cy="32" r="6" ${DARK}/><circle cx="32" cy="32" r="2.4" ${HOTF}/><path d="M14 24 A19 19 0 0 1 26 14" ${NE}/>`,
  smoke: `<path d="M8 42 Q4 32 14 30 Q14 18 27 20 Q32 10 43 16 Q56 14 55 27 Q62 32 56 42Z" fill="#e8e4ee" opacity="0.9" ${K}/><path d="M18 34 Q24 28 32 31 Q40 26 46 32" fill="none" stroke="#ff3fa4" stroke-width="1.6" opacity="0.6"/><circle cx="22" cy="48" r="9" ${RUB}/><circle cx="22" cy="48" r="4" ${MET}/><path d="M34 52 H58 M40 46 H56" stroke="#36f2ff" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>`,
  glow: `<path d="M6 38 L14 28 L24 24 H40 L50 28 L58 34 V42 H6Z" fill="#4a1f8f" ${K}/><path d="M24 24 L28 18 H40 L45 24Z" ${DARK}/><circle cx="17" cy="42" r="6" ${RUB}/><circle cx="47" cy="42" r="6" ${RUB}/><path d="M6 52 Q32 58 58 52" stroke="#36f2ff" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.45" filter="url(#fGlow)"/><path d="M8 50 H56" stroke="#36f2ff" stroke-width="2.2" stroke-linecap="round"/>`,
  super: `<rect x="12" y="20" width="40" height="20" rx="5" ${MET}/><path d="M16 26 H48 M16 30 H48 M16 34 H48" stroke="#12081f" stroke-width="1.2"/><rect x="20" y="10" width="24" height="10" rx="2" ${HOTF}/><path d="M26 10 V6 M32 10 V6 M38 10 V6" stroke="#ff3fa4" stroke-width="2.2"/><circle cx="48" cy="48" r="8" ${MET}/><circle cx="20" cy="48" r="5" ${MET}/><path d="M20 43 L48 40 M20 53 L48 56" stroke="#1d1230" stroke-width="2.4"/><circle cx="48" cy="48" r="2.6" ${AMBF}/>`,
  decal: `<path d="M6 38 L14 28 L24 24 H40 L50 28 L58 34 V44 H6Z" fill="#2c3446" ${K}/><path d="M26 24 L20 44 M33 24 L27 44" stroke="#ff3fa4" stroke-width="3.4"/><path d="M40 24 L34 44" stroke="#36f2ff" stroke-width="3.4"/><circle cx="17" cy="44" r="6" ${RUB}/><circle cx="47" cy="44" r="6" ${RUB}/><path d="M24 24 L28 18 H40 L45 24" fill="none" ${K}/>`,
  setup: `${[[16, 22], [32, 40], [48, 28]].map(([y, x]) => `<path d="M10 ${y} H54" stroke="#1d1230" stroke-width="5" stroke-linecap="round"/><path d="M10 ${y} H${x}" stroke="url(#gNeon)" stroke-width="3" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="5.5" ${MET}/>`).join('')}`,
  repair: `<path d="M42 8 A12 12 0 0 0 30 24 L9 45 A5 5 0 0 0 16 52 L37 31 A12 12 0 0 0 53 19 L46 24 L40 22 L38 16Z" ${MET}/><circle cx="12.5" cy="48.5" r="2" ${DARK}/><path d="M18 14 L46 42" stroke="#ff3fa4" stroke-width="6" stroke-linecap="round"/><path d="M18 14 L46 42" stroke="#ffd1ec" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/><circle cx="16" cy="12" r="5" fill="none" stroke="#ff3fa4" stroke-width="3"/>`,
};

// a car from the side, drawn from its body (carbodies.js outlineOf, read only; 11-16, the cars builder: the bodies
// rebuilt from Portero's 002 sheets): the paint as a two-tone gradient, the side glass with a sunset reflection, wheels
// with rims in their arches, the wing, the livery's bands and pinstripes, a neon line underneath. 240 x 84.
export function carSide(B, paint = '#4a1f8f', cls = 'carside', key = 'c') {
  const O = outlineOf(B), W = 240, Hh = 84, g = 76, s = 220 / B.L, X = (z) => (W / 2 + z * s).toFixed(1), Y = (h) => (g - h * s).toFixed(1);
  const path = (pts, close = true) => 'M' + pts.map(([z, h]) => X(z) + ' ' + Y(h)).join('L') + (close ? 'Z' : '');
  const d = path(O.body), gd = path(O.glass);
  const wheel = ([z, R]) => { const cx = X(z), cy = Y(R), r = (R * s).toFixed(1), r2 = (B.wheels.rim * s).toFixed(1); return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#gRubber)" stroke="#0a0612" stroke-width="1.4"/><circle cx="${cx}" cy="${cy}" r="${r2}" fill="url(#gMetal)" stroke="#12081f" stroke-width="1"/><circle cx="${cx}" cy="${cy}" r="${(R * s * 0.16).toFixed(1)}" fill="#1d1230"/>`; };
  const Wg = B.wing, deck = (z) => O.body.reduce((best, p) => (Math.abs(p[0] - z) < Math.abs(best[0] - z) ? p : best), O.body[0])[1];
  const wing = !Wg ? '' : Wg.t === 'lip' ? `<path d="M${X(Wg.z0)} ${Y(deck(Wg.z0))} L${X(Wg.z1)} ${Y(Wg.y1)}" stroke="#12081f" stroke-width="3" stroke-linecap="round"/>`
    : `<path d="M${X(Wg.z0)} ${Y(Wg.y0)} L${X(Wg.z1)} ${Y(Wg.y1)} M${X((Wg.z0 + Wg.z1) / 2)} ${Y((Wg.y0 + Wg.y1) / 2)} V${Y(deck((Wg.z0 + Wg.z1) / 2))}" stroke="${Wg.plateCol || '#12081f'}" stroke-width="3.2" stroke-linecap="round"/>`;
  const liv = (B.livery || []).map((l) => {
    if (l.t === 'line') return `<path d="${path(l.pts, false)}" stroke="${l.col}" stroke-width="1.4" fill="none" opacity="0.9"/>`;
    if (l.t === 'flank') return `<path d="${path([...l.lo, ...l.hi.slice().reverse()])}" fill="${l.col}" opacity="0.95"/>`;
    return '';
  }).join('');
  const nose = O.body[0], tail = O.body.find((p) => Math.abs(p[0] + B.L / 2) < 0.03) || O.body[O.body.length / 2 - 1];
  const id = 'cp' + key;
  return `<svg class="${cls}" viewBox="0 0 ${W} ${Hh}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="0.18" stop-color="${paint}"/><stop offset="0.7" stop-color="${paint}"/><stop offset="1" stop-color="#05020c"/></linearGradient></defs>
    <ellipse cx="${W / 2}" cy="${g + 2}" rx="${(B.L * s * 0.52).toFixed(1)}" ry="4" fill="#36f2ff" opacity="0.28"/>
    <path d="${d}" fill="${paint}" stroke="#0a0612" stroke-width="2" stroke-linejoin="round"/><path d="${d}" fill="url(#${id})" opacity="0.85"/>
    <path d="${gd}" fill="#140a26" stroke="#0a0612" stroke-width="1.2"/><path d="${gd}" fill="url(#gSun)" opacity="0.28"/>${liv}${wing}
    <path d="M${X(nose[0] - 0.06)} ${Y(nose[1] - 0.1)} h-6" stroke="#ffe7a8" stroke-width="2.6" stroke-linecap="round"/><path d="M${X(-B.L / 2 + 0.04)} ${Y(tail[1] - 0.14)} h5" stroke="#ff2a5a" stroke-width="2.6" stroke-linecap="round"/>
    ${O.wheels.map(wheel).join('')}</svg>`;
}

export function partArt(id) { return `<svg class="art" viewBox="0 0 64 64" aria-hidden="true">${PLATE}${PART_ART[id] || PART_ART.engine}</svg>`; }
// the page icon (icon.svg and the home-screen PNG are rendered from this)
export function appIcon() {
  const L = letters('DD', 1.6);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1250"/><stop offset="1" stop-color="#0b0618"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="0.45" stop-color="#bff6ff"/><stop offset="0.52" stop-color="#ff7ad1"/><stop offset="1" stop-color="#ffd1ec"/></linearGradient><linearGradient id="c" x1="0" x2="1"><stop offset="0" stop-color="#36f2ff"/><stop offset="1" stop-color="#ff3fa4"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#a)"/><circle cx="32" cy="40" r="15" fill="#ff7a3c" opacity="0.35"/><g transform="translate(${32 - L.w * 2.3 / 2 + 2} 14) scale(2.3) skewX(-14)"><path d="${L.d}" fill="none" stroke="url(#b)" stroke-width="1.9" stroke-linejoin="miter"/></g><path d="M8 52 C24 56 40 56 58 46" fill="none" stroke="url(#c)" stroke-width="3" stroke-linecap="round"/></svg>`;
}

// the duel's badge (day 4): a shield, two cars sliding nose to tail (yours cyan, ahead; the rival pink), a chequered
// flag over them, and DUEL in the wordmark's letters
export function duelBadge(cls = 'badge-deg') {
  const L = letters('DUEL', 1.6), s = 30 / L.w;
  const car = (x, y, rot, col) => `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M-13 4 L-11 -3 L-4 -6 H6 L12 -2 L14 4 Z" fill="${col}" stroke="#0a0612" stroke-width="1.6" stroke-linejoin="round"/><path d="M-3 -5.5 L0 -10 H6 L9 -4" fill="#140a26" stroke="#0a0612" stroke-width="1.2"/><circle cx="-7" cy="5" r="3.2" fill="#0a0612"/><circle cx="8" cy="5" r="3.2" fill="#0a0612"/></g>`;
  const flag = [0, 1, 2, 3].map((i) => [0, 1, 2].map((j) => `<rect x="${44 + i * 8}" y="${14 + j * 6}" width="8" height="6" fill="${(i + j) % 2 ? '#0a0612' : '#f4f1f8'}"/>`).join('')).join('');
  return `<svg class="${cls}" viewBox="0 0 120 120" role="img" aria-label="Duel won">
    <path d="M60 4 L110 22 V62 C110 92 84 108 60 116 C36 108 10 92 10 62 V22 Z" fill="url(#gPanel)" stroke="url(#gGold)" stroke-width="3.2" filter="url(#fGlow)"/>
    <path d="M60 12 L102 27 V61 C102 86 81 100 60 107 C39 100 18 86 18 61 V27 Z" fill="none" stroke="#36f2ff" stroke-width="0.8" opacity="0.6"/>
    <path d="M42 12 V40" stroke="#ffb347" stroke-width="2"/>${flag}
    <path d="M24 66 Q60 50 98 62" stroke="url(#gNeon)" stroke-width="1.4" fill="none" stroke-dasharray="3 3"/>
    ${car(40, 70, -10, '#ff3fa4')}${car(76, 60, -16, '#36f2ff')}
    <g transform="translate(${60 - L.w * s / 2 - 1} 84) scale(${s}) skewX(-10)"><path d="${L.d}" fill="none" stroke="url(#gGold)" stroke-width="1.8" stroke-linejoin="miter" stroke-linecap="square"/></g>
  </svg>`;
}
