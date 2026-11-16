// DEGEN DRIFT: the loading screen, and how a tap is taken (11-16, after Evrtek's report from his iPhone on a weak cell:
// taps on RACE and BACK lagged and often did nothing until pressed again; "people like to see progress bars or some
// feedback that confirms the game isn't locked").
// Loader: the boot screen again (Portero's painting, the wordmark, the bar) over everything, the moment a tap asks for
// something slow. It appears on the frame of the tap, names what it is building, and its bar moves by the real steps
// of the work, with the page painted between steps; a light runs along the bar on the compositor, so even a long step
// never looks frozen. While it is up it takes every tap, so none falls through to the menu behind it. It fades out
// onto the screen it led to.
// taps(): a button answers when the finger lands (a pressed look at once, before any work), and acts when it lifts on
// that same button, without waiting for the browser's own click (which a busy phone can deliver late or, after the
// screen has changed under the finger, onto the wrong button). The click that follows a touch is swallowed; mouse,
// keyboard and the tests' element.click() still arrive as clicks.

// wait until the page has painted what was just changed (a frame, then a task after it)
export const painted = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

export class Loader {
  constructor() {
    this.el = document.getElementById('boot'); this.fill = document.getElementById('boot-fill'); this.what = document.getElementById('boot-what');
    this.on = false; this.f = 0; this.shown = 0;
  }
  // the bar (the boot uses it too): never moves backwards within one load
  set(f) { this.f = Math.max(this.f, Math.min(1, f)); this.fill.classList.add('live'); this.fill.style.transform = `scaleX(${this.f.toFixed(3)})`; }
  // call inside the tap: up at once, then resolves when that frame is on the screen, so the slow work starts after it
  async show(text) {
    this.on = true; this.f = 0;
    this.what.textContent = text || '';
    this.fill.style.transition = 'none'; this.set(0.03); void this.fill.offsetWidth; this.fill.style.transition = '';
    this.el.classList.add('loading');
    await painted(); this.shown = performance.now();
  }
  // a step of the work done: move the bar, and let the page paint before the next step unless it painted a moment ago
  // (a fast computer would spend more time waiting for frames than building)
  async step(f) { this.set(f); if (performance.now() - this.shown > 30) { await painted(); this.shown = performance.now(); } }
  hide() { this.set(1); this.on = false; this.el.classList.remove('loading'); }
}

// root: where the buttons live; fire(button): what a tap on one does
export function taps(root, fire, selector = '[data-act]') {
  let down = null, quietUntil = 0;
  const hit = (el) => { const b = el && el.closest ? el.closest(selector) : null; return b && root.contains(b) && !b.disabled ? b : null; };
  const release = () => { if (down) { down.el.classList.remove('pressed'); down = null; } };
  root.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const b = hit(e.target); if (!b) return;
    release();
    down = { el: b, id: e.pointerId, type: e.pointerType };
    b.classList.add('pressed');
  });
  root.addEventListener('pointerup', (e) => {
    if (!down || e.pointerId !== down.id) return;
    const d = down; release();
    if (d.type === 'mouse') return; // a mouse's own click follows straight away
    // the finger lifted on the button it pressed (slid off: no tap), and the button is still on the screen
    if (!d.el.isConnected || hit(document.elementFromPoint(e.clientX, e.clientY)) !== d.el) return;
    quietUntil = performance.now() + 800;
    fire(d.el);
  });
  root.addEventListener('pointercancel', release); // the list scrolled, or the browser took the touch
  // a mouse let go somewhere else (pressed on a button, dragged off it): the button lets go too
  const away = (e) => { if (down && e.pointerId === down.id) release(); };
  addEventListener('pointerup', away); addEventListener('pointercancel', away);
  root.addEventListener('click', (e) => {
    if (performance.now() < quietUntil) { e.preventDefault(); e.stopPropagation(); return; } // a touch's late click: already done
    const b = hit(e.target); if (b) fire(b);
  });
}
