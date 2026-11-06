// STARWAKE: the quality tier. 2 = high (bloom pass, full pixel ratio up to 2), 1 = mid (no post pass, ratio up to
// 1.5), 0 = low (ratio 1, fewer particles and clouds). Phones start on mid, desktops on high. Every two seconds
// of play the measured frame rate is checked; under 52 fps the tier steps down, and it never steps back up
// inside a run, so the picture does not flicker between looks.
export class Quality {
  constructor(touch) {
    this.touch = touch;
    const forced = new URLSearchParams(location.search).get('tier');
    this.tier = forced !== null ? Math.max(0, Math.min(2, Number(forced))) : (touch ? 1 : 2);
    this.forced = forced !== null;
    this.t = 0; this.frames = 0; this.history = []; this.drops = [];
    this.onChange = null;
  }
  pixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    return Math.min(dpr, [1, 1.5, 2][this.tier]);
  }
  get bloom() { return this.tier >= 2; }
  get particleScale() { return [0.45, 0.75, 1][this.tier]; }
  sample(dt) {
    this.t += dt; this.frames++;
    if (this.t >= 2) {
      const fps = this.frames / this.t;
      this.history.push(Math.round(fps * 10) / 10);
      if (this.history.length > 120) this.history.shift();
      if (fps < 52 && this.tier > 0 && !this.forced) {
        this.tier--; this.drops.push({ fps: Math.round(fps), to: this.tier, at: performance.now() });
        if (this.onChange) this.onChange(this.tier);
      }
      this.t = 0; this.frames = 0;
    }
  }
  resetWindow() { this.t = 0; this.frames = 0; }
}
