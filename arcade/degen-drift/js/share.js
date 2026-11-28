// DEGEN DRIFT: the share button (11-27 (4), Evrtek: "a share button ... so you can tell your friends that you're such and
// such level, and that shared post would then have a link back to the game itself"). The phone's own share sheet where
// there is one (it reaches every app the player has), with a picture of the card attached where the browser takes files;
// elsewhere the line and the link go on the clipboard. The game itself sends nothing anywhere: no tracking, no outside
// script, nothing about the player but the level, the stars and the car, and the link is always GAME_URL.
// The card: Kalakar's share art (art/share, group G, the wordmark in it) with the player's rank badge, LEVEL N, the tier,
// the stars, the car's badge and the credit line drawn where her SLOTS put them.
import { GAME_URL, VERSION } from './config.js?v=0.1.26';
import * as G from './garage.js?v=0.1.26';
import { carById } from './data/cars.js?v=0.1.26';
import { rankSvg, tierOf, toneOf, PLATE } from './ranks.js?v=0.1.26';
import { letters } from './art.js?v=0.1.26';

// where things go on each card [x, y, w, h] (Kalakar's share.mjs SLOTS)
const SLOTS = {
  wide: { W: 1200, H: 630, art: 'art/share/share-1200x630.webp', badge: [60, 176, 280, 250], level: [350, 222, 330, 72], stars: [350, 314, 300, 64], car: [590, 350, 560, 196], credit: [64, 566, 600, 30] },
  tall: { W: 1080, H: 1920, art: 'art/share/share-1080x1920.webp', badge: [250, 420, 580, 400], level: [190, 832, 700, 104], stars: [300, 952, 480, 92], car: [100, 1262, 880, 310], credit: [140, 1622, 800, 44] },
};
const stamp = (p) => `${p}?v=${VERSION}`;
export const STARS_ALL = 45;
// the line that goes with it (the one place in the game a line of copy belongs)
export function line(p) {
  const L = G.levelOf(p), S = G.starsOf(p);
  return `I'm a level ${L} ${tierOf(L).name} in DEGEN DRIFT with ${S} of ${STARS_ALL} stars. Grip is for quitters. Your move:`;
}
const img = (src) => new Promise((ok, no) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = () => no(new Error('image')); i.src = src; });
const svgImg = (text) => { const u = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' })); return img(u).finally(() => setTimeout(() => URL.revokeObjectURL(u), 1000)); };
const TONES = { gold2: ['#fffbe0', '#ffd36a', '#ffa83a'], pink: ['#ffe6f4', '#ff8cc8', '#ff3fa4'], hot: ['#fff3b0', '#ff8a5c', '#ff3fa4'], cyan: ['#f2ffff', '#7df6ff', '#36f2ff'], chrome: ['#ffffff', '#bff6ff', '#ffd1ec'] };
// a line in the house letters on the canvas, fitted into a box (left-aligned, or centred on a tall card)
function lettered(ctx, text, [x, y, w, h], tone = 'chrome', centre = false) {
  const L = letters(text, 2.5), s = Math.min(h / 12, w / (L.w + 4)), tw = L.w * s, x0 = centre ? x + (w - tw) / 2 : x;
  ctx.save(); ctx.translate(x0 + s * 1.2, y + (h - 10 * s) / 2); ctx.scale(s, s); ctx.transform(1, 0, Math.tan(-12 * Math.PI / 180), 1, 0, 0);
  const path = new Path2D(L.d), c = TONES[tone] || TONES.chrome, g = ctx.createLinearGradient(0, 0, 0, 10);
  g.addColorStop(0, c[0]); g.addColorStop(0.5, c[1]); g.addColorStop(1, c[2]);
  ctx.lineJoin = 'miter'; ctx.lineCap = 'square';
  ctx.shadowColor = c[2]; ctx.shadowBlur = 14; ctx.strokeStyle = '#14072a'; ctx.lineWidth = 2.5; ctx.stroke(path);
  ctx.shadowBlur = 0; ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.stroke(path);
  ctx.restore();
}
function star(ctx, cx, cy, r) {
  ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r * 0.45 : r; ctx.lineTo(cx + q * Math.cos(a), cy + q * Math.sin(a)); } ctx.closePath();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r); g.addColorStop(0, '#fff3b0'); g.addColorStop(0.55, '#ffb347'); g.addColorStop(1, '#ff3fa4');
  ctx.save(); ctx.shadowColor = '#ffb347'; ctx.shadowBlur = r * 0.6; ctx.fillStyle = g; ctx.fill(); ctx.restore(); ctx.lineWidth = r * 0.08; ctx.strokeStyle = '#fff3b0'; ctx.stroke();
}
// the card as a PNG file (resolves null if this browser cannot make one)
export async function card(p, tall) {
  const S = tall ? SLOTS.tall : SLOTS.wide, L = G.levelOf(p), stars = G.starsOf(p), car = carById(p.car);
  const cv = document.createElement('canvas'); cv.width = S.W; cv.height = S.H;
  const ctx = cv.getContext('2d'); if (!ctx || typeof Path2D === 'undefined') return null;
  const [bg, badge, carArt] = await Promise.all([img(stamp(S.art)), svgImg(rankSvg(L)), img(stamp(`art/cars/car-${car.id}.svg`)).catch(() => null)]);
  ctx.drawImage(bg, 0, 0, S.W, S.H);
  // the badge sized by its hexagon into the slot's height, the frame free around it
  const [bx, by, bw, bh] = S.badge, k = Math.min(bh * 0.62 / PLATE.h, bw * 0.62 / PLATE.w), cx = bx + bw / 2, cy = by + bh / 2;
  ctx.drawImage(badge, cx - (PLATE.x + PLATE.w / 2) * k, cy - (PLATE.y + PLATE.h / 2) * k, 200 * k, 180 * k);
  const [lx, ly, lw, lh] = S.level;
  lettered(ctx, `LEVEL ${L}`, [lx, ly, lw, lh * 0.78], 'chrome', tall);
  lettered(ctx, tierOf(L).name, [lx, ly + lh * 0.78, lw, lh * 0.42], toneOf(tierOf(L).n), tall);
  const [sx, sy, sw, sh] = S.stars, r = sh * 0.36, sx0 = tall ? sx + sw / 2 - sh * 1.6 : sx;
  star(ctx, sx0 + r, sy + sh / 2 + sh * 0.12, r);
  lettered(ctx, `${stars}/${STARS_ALL}`, [sx0 + r * 2.4, sy + sh * 0.2, sw - r * 2.4, sh * 0.8], 'gold2');
  if (carArt) { const [cx0, cy0, cw, ch] = S.car, q = Math.min(cw / 240, ch / 132); ctx.drawImage(carArt, cx0 + (cw - 240 * q) / 2, cy0 + (ch - 132 * q) / 2, 240 * q, 132 * q); }
  lettered(ctx, 'REIMERTEK STUDIOS  ' + GAME_URL.replace(/^https:\/\//, '').replace(/\/$/, ''), S.credit, 'cyan', tall);
  const blob = await new Promise((ok) => { try { cv.toBlob(ok, 'image/png'); } catch (e) { ok(null); } });
  return blob ? new File([blob], `degen-drift-level-${L}.png`, { type: 'image/png' }) : null;
}

// One share at a time. prepare() makes the card ahead of the tap (a share sheet must open inside the tap itself, so the
// picture has to be ready); go() is the tap.
export class Share {
  constructor(ui) { this.ui = ui; this.key = ''; this.file = null; this.busy = null; }
  tall() { try { return !!(this.ui.g.input && this.ui.g.input.touch); } catch (e) { return false; } }
  prepare(p) {
    const key = [G.levelOf(p), G.starsOf(p), p.car, this.tall()].join(':');
    if (key === this.key) return this.busy;
    this.key = key; this.file = null;
    if (!navigator.share || !navigator.canShare) return (this.busy = Promise.resolve(null)); // no sheet to hand a picture to
    return (this.busy = card(p, this.tall()).then((f) => { if (this.key === key) this.file = f; return f; }).catch(() => null));
  }
  go(p) {
    const text = line(p), data = { title: 'DEGEN DRIFT', text, url: GAME_URL };
    if (navigator.share) {
      let withFile = false;
      try { withFile = !!(this.file && navigator.canShare && navigator.canShare({ files: [this.file] })); } catch (e) { withFile = false; }
      if (withFile) data.files = [this.file];
      let ask; try { ask = navigator.share(data); } catch (e) { ask = Promise.reject(e); }
      return Promise.resolve(ask).then(() => 'shared', (e) => (e && e.name === 'AbortError' ? 'cancelled' : this.copy(text)));
    }
    return this.copy(text);
  }
  // no share sheet: the line and the link on the clipboard, and a word on screen
  copy(text) {
    const all = text + ' ' + GAME_URL;
    const old = () => { try { const t = document.createElement('textarea'); t.value = all; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok; } catch (e) { return false; } };
    const done = (ok) => { this.ui.toast(ok ? 'Copied. Paste it anywhere.' : GAME_URL); return ok ? 'copied' : 'shown'; };
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(all).then(() => done(true), () => done(old())); } catch (e) { /* the old way */ }
    return Promise.resolve(done(old()));
  }
}
