// DRIFTLINE: quality tiers and adaptive resolution.
// Tiers: 0 low (pixel ratio <= 1, fewer trees and puffs, no bloom), 1 medium (<= 1.5, no bloom), 2 high (<= 2, bloom).
// AUTO starts phones and tablets on medium and computers on high. Resolution then adapts inside the tier: every half
// second the smoothed frame time is checked; slow frames scale the render down (to 60% at the least), steady frames
// at the display's own rate probe back up a step at a time. If the scale has bottomed out and frames are still slow
// for three seconds, AUTO drops a tier. A manual tier never moves on its own (only its resolution does).
export class Quality {
  constructor(choice, touch) {
    this.touch = touch;
    const forced = new URLSearchParams(location.search).get('tier');
    this.choice = forced !== null ? ['low', 'med', 'high'][Math.max(0, Math.min(2, Number(forced)))] : choice || 'auto';
    this.tier = this.choice === 'auto' ? (touch ? 1 : 2) : { low: 0, med: 1, high: 2 }[this.choice];
    this.scale = 1; this.ema = 16.7; this.t = 0; this.slowT = 0; this.fastT = 0; this.ceiling = 1;
    this.onTier = null; this.onScale = null; this.log = []; this.wait = 4;
    this.fixedScale = new URLSearchParams(location.search).has('fixedres');
  }
  get bloom() { return this.tier >= 2; }
  get particles() { return [180, 360, 600][this.tier]; }
  get skids() { return [900, 1800, 3000][this.tier]; }
  maxRatio() { return [1, 1.5, 2][this.tier]; }
  pixelRatio() { return Math.min(window.devicePixelRatio || 1, this.maxRatio()) * this.scale; }
  set(choice) {
    this.choice = choice;
    const t = choice === 'auto' ? (this.touch ? 1 : 2) : { low: 0, med: 1, high: 2 }[choice];
    this.scale = 1; this.ceiling = 1;
    if (t !== this.tier) { this.tier = t; if (this.onTier) this.onTier(t); } else if (this.onScale) this.onScale();
  }
  // frame: ms since the last frame
  hold(s = 3) { this.wait = s; }
  sample(ms) {
    if (ms <= 0) return;
    // a hitch (a shader compiling, the tab waking) is not a trend, but a string of them is: a device that cannot reach
    // 11 fps at all must still step down (day 4; before, every such frame was ignored and AUTO never moved)
    if (ms > 90) { this.longN = (this.longN || 0) + 1; if (this.longN < 8) return; ms = 90; } else if (ms < 33) this.longN = 0; // only a quick frame says the long one was a hitch
    if (this.wait > 0) { this.wait -= ms / 1000; return; }
    this.ema += (ms - this.ema) * 0.08;
    this.t += ms / 1000;
    if (this.t < 0.5 || this.fixedScale) return;
    this.t = 0;
    const slow = this.ema > 19.5, steady = this.ema < 17.6;
    if (slow) { this.fastT = 0; this.slowT += 0.5; if (this.scale > 0.6) { this.ceiling = Math.min(this.ceiling, this.scale); this.scale = Math.max(0.6, this.scale * 0.88); this.changed(); } else if (this.choice === 'auto' && this.tier > 0 && this.slowT > 4) { this.tier--; this.scale = 1; this.ceiling = 1; this.slowT = 0; this.log.push({ tier: this.tier, at: performance.now() }); if (this.onTier) this.onTier(this.tier); } }
    else { this.slowT = 0; if (steady && this.scale < 1) { this.fastT += 0.5; if (this.fastT > (this.scale < this.ceiling ? 2 : 6)) { this.scale = Math.min(1, this.scale * 1.08); this.fastT = 0; this.changed(); } } }
  }
  changed() { if (this.onScale) this.onScale(); }
}
