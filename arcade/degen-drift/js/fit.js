// DEGEN DRIFT: the space the game may use, and full screen where a browser allows it (11-16, after Evrtek's report from
// his iPhone held sideways, playing the test build as a claude.ai artifact: in Safari and in the Claude app the bottom
// of the menus was cut off, GARAGE and BACK clipped or gone).
// Why it was cut. Everything was sized to the frame's own viewport (position: fixed; inset: 0, panels at most 100% of
// it), and the frame is not what the player sees:
//  - in iPhone Safari the page that holds the frame gives it more height than it shows: the frame runs on below the
//    screen's bottom edge (by 50-75 px in his screenshot), so whatever sat at the bottom of the frame, the menus' buttons
//    and the panel's lower border, was off the screen, and nothing inside a frame can see that from its own viewport
//    (vh, dvh, innerHeight and visualViewport all describe the whole frame);
//  - in the Claude app the frame is all on the screen but short (about 310 px, 21 px of it the bottom safe area): the
//    course list's panel was taller than that, clipped its own content, and its buttons were the last thing in it,
//    below the panel's fold, in a panel no finger could scroll (main.js's touchmove guard knew only the garage list,
//    the sheets, the results and the card).
// The box. One rectangle, the part of the frame that is really on the screen: the frame's visual viewport, cut to what
// an IntersectionObserver sees of a full-frame probe from the top-level page (the standard way a frame learns how much
// of it is visible; it works across origins, which is how ads measure themselves). The canvas, the HUD, the touch
// controls, the loading screen and every menu are laid out in it (--app-x/y/w/h on <html>); its height picks the
// compact layouts (html.short at 430 px or less, html.tiny at 340 or less) in place of a media query, which only knows
// the frame. The menus themselves keep their buttons in a bar that never scrolls (css: .fp, .pfoot).
// Loaded as its own module script before main.js (index.html), so the boot screen is in the box before the game's
// modules have arrived; main.js imports the same module (one instance).

const doc = document.documentElement;
export const view = { x: 0, y: 0, w: Math.max(1, innerWidth), h: Math.max(1, innerHeight) };
export const embedded = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
const mq = (q) => { try { return matchMedia(q).matches; } catch (e) { return false; } };
export const standalone = navigator.standalone === true || mq('(display-mode: standalone)') || mq('(display-mode: fullscreen)');
const listeners = [];
let seen = null, timer = 0, io = null, probe = null;

// the box: the frame's viewport, cut to the part on the screen when a host shows only part of it. A frame mostly
// scrolled out of sight keeps its whole box (no menu is laid out into a sliver).
function measure() {
  const vv = window.visualViewport;
  let x0 = 0, y0 = 0, x1 = innerWidth, y1 = innerHeight;
  if (vv && vv.width > 0 && vv.height > 0) { x0 = vv.offsetLeft; y0 = vv.offsetTop; x1 = x0 + vv.width; y1 = y0 + vv.height; }
  if (seen) {
    const a = Math.max(x0, seen.left), b = Math.max(y0, seen.top), c = Math.min(x1, seen.right), d = Math.min(y1, seen.bottom);
    if (c - a >= Math.min(320, (x1 - x0) * 0.6) && d - b >= Math.min(200, (y1 - y0) * 0.5)) { x0 = a; y0 = b; x1 = c; y1 = d; }
  }
  return { x: Math.round(x0), y: Math.round(y0), w: Math.max(1, Math.round(x1 - x0)), h: Math.max(1, Math.round(y1 - y0)) };
}
function apply() {
  timer = 0;
  const v = measure(), changed = v.x !== view.x || v.y !== view.y || v.w !== view.w || v.h !== view.h;
  Object.assign(view, v);
  const s = doc.style;
  s.setProperty('--app-x', v.x + 'px'); s.setProperty('--app-y', v.y + 'px'); s.setProperty('--app-w', v.w + 'px'); s.setProperty('--app-h', v.h + 'px');
  s.setProperty('--vh1', (v.h / 100).toFixed(2) + 'px');
  doc.classList.toggle('short', v.h <= 430); doc.classList.toggle('tiny', v.h <= 340);
  if (changed) for (const f of listeners) f(view);
}
const later = (ms) => { clearTimeout(timer); timer = setTimeout(apply, ms); };
// f(view) whenever the box changes (main.js resizes the renderer and the camera)
export const onFit = (f) => { listeners.push(f); };

// The frame resized (a phone turned, a window dragged): the observer reports only when the visible share crosses one of
// its steps, and a frame that stays wholly on the screen crosses none (it is 100% before and after), so it is asked
// afresh (observe() always answers once); the box follows its answer, or the plain viewport if none comes.
let fresh = false;
const resized = (ms) => { if (io) { fresh = true; io.unobserve(probe); io.observe(probe); } later(io ? Math.max(ms, 150) : ms); };

doc.classList.toggle('standalone', standalone); doc.classList.toggle('embedded', embedded);
apply();
addEventListener('resize', () => resized(0));
addEventListener('orientationchange', () => resized(250));
if (window.visualViewport) { visualViewport.addEventListener('resize', () => resized(0)); visualViewport.addEventListener('scroll', () => later(60)); }
if ('IntersectionObserver' in window) {
  probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;visibility:hidden;pointer-events:none;z-index:-1';
  document.body.appendChild(probe);
  const steps = []; for (let i = 0; i <= 200; i++) steps.push(i / 200);
  io = new IntersectionObserver((es) => {
    const e = es[es.length - 1], r = e.intersectionRect;
    seen = e.isIntersecting && r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
    later(fresh ? 0 : 120); fresh = false; // the first answer and a resize's apply at once; a host page scrolling settles first
  }, { threshold: steps });
  fresh = true; io.observe(probe);
}

// ---------------------------------------------------------------------------------------------------- full screen
// Offered only where the browser allows it: computers, Android, iPad (document.fullscreenEnabled). iPhone has no full
// screen for a page, and a frame that was not allowed it (the claude.ai artifact frame) reports false, so the button
// is simply not drawn there. A refusal is silent.
export const fsOK = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
export const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
export function toggleFs() {
  try {
    const p = isFs() ? (document.exitFullscreen || document.webkitExitFullscreen).call(document)
      : (doc.requestFullscreen || doc.webkitRequestFullscreen).call(doc, { navigationUI: 'hide' });
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* refused: nothing to say */ }
}
// an iPhone outside the home screen, as the top page (in a host's frame, Add to Home Screen would save the host's page)
export const iphoneHint = () => /iPhone|iPod/.test(navigator.userAgent) && !standalone && !embedded && !fsOK();
