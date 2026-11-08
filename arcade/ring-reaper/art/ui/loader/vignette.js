// STARWAKE loading-screen VIGNETTE (Yori, 2026-11-07; Evrtek: "show the loading screen show a simplified taste of the game").
// A 6.4 s loop on one canvas over today's loading background, at today's camera: the Wake threads three rings (a sparkle
// each), a red blast comes in and the ship barrel-rolls it straight back (the roll's cyan glint), an asteroid comes at it
// and the ship banks aside. 2D: the ship is a 16-frame roll strip from scene3d's wake3 at the loading camera, the rest are
// sprites moved along the lane the same camera projected (window.VIGNETTE, from render-vignette.js), so everything passes
// through the ship's own spot with the right foreshortening. prefers-reduced-motion: one still pose.
//
// In the game (CLU-loader, 0.4.0). Evrtek approved it as he saw it (11-07: "loading screen looks fine to me"), so the
// drawing here is Yori's (art-incoming/yori/loader/, and her page in the MCP's drafts), line for line. Only its shell is new:
//   - a plain script (deferred: it runs as soon as the page is parsed), before any of the game's modules (no three.js):
//     it shows on the loading screen from the first moment, and the studio splash waits for window.__vignette.ready (its
//     five sprites in and its first frame drawn), so the screen is whole when the splash lifts;
//   - it plays while the loading screen shows (the boot, and every level's load: ui.loading calls __vignette.show);
//   - its exit is the old .ld-wake's drop out of warp, drawn: the ship surges to 2.6x and fades in 0.55 s, on the same
//     curves, while the screen lifts (0.5 s);
//   - then it stops (no frame callback, the canvas emptied), so it costs nothing during play;
//   - the revert switch #loader-old (or ?loader=old; js/params.js's rule, read by the splash's script before any module)
//     puts back the streak screen it replaced, from its template in the page, and removes the canvas: this script then
//     does nothing;
//   - the sprites carry this script's own cache stamp (?v=), so the page's stamp is the only one to change.
// The main menu (CLU-boot, 0.4.0; Evrtek 11-07: "Instead the loop we created should be playing behind the main menu"): a
// second player of the same loop on the launcher's own canvas, the same five sprites, asked for once. Only where the ship
// sits differs: in the open space beside the buttons, never under them (the room between the wordmark and the buttons on
// a portrait screen, the half beside the column of buttons on a landscape one). It plays only while the menu shows
// (ui.js), and stops at once when the menu goes (the screen goes at once, so there is no exit to draw).
(function () {
  'use strict';
  const V = window.VIGNETTE, L = 6.4;                        // the loop
  const box = document.getElementById('loading'), loaderCanvas = document.getElementById('loader-vignette'), menuCanvas = document.getElementById('menu-vignette');
  window.__vignette = null; window.__menuVignette = null;    // none with #loader-old / #boot-old (the splash's script removed its canvas)
  if (!V || (!loaderCanvas && !menuCanvas)) return;           // its data never came: no picture, and nothing for the splash to wait for
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STAMP = (/\?v=[^&#]+/.exec((document.currentScript && document.currentScript.src) || '') || [''])[0];
  // a picture is settled when it is decoded, or when it has failed for good (the splash's own rule)
  const settle = (im) => (im.decode ? im.decode() : Promise.reject()).catch(() => new Promise((ok) => { if (im.complete) ok(); else { im.addEventListener('load', ok); im.addEventListener('error', ok); } }));
  const art = {}; const NEED = ['wake-roll', 'ring', 'sparkle', 'bolt', 'asteroid-a'];
  const loads = NEED.map((k) => { const im = new Image(); im.fetchPriority = 'high'; im.src = 'art/ui/loader/' + k + '.png' + STAMP; art[k] = im; return settle(im); });
  const sprites = Promise.all(loads);

  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const mod = (a, n) => ((a % n) + n) % n;
  // ---- the dust: a gentle drift down the lane, far to near, so the speed reads without any line popping
  const DUST = []; { let s = 12345; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 110; i++) DUST.push({ ox: (rnd() - 0.5) * 16, oy: (rnd() - 0.5) * 11, ph: rnd(), v: 11 + rnd() * 5, r: 0.8 + rnd() * 1.2 }); }

  // ---- the beats (seconds into the loop)
  const RINGS = [{ tp: 1.0, ox: 0.1, oy: 0.05 }, { tp: 1.55, ox: -0.12, oy: -0.02 }, { tp: 2.1, ox: 0.08, oy: 0.08 }]; // pass times
  const RING_V = 11, FAR = 42;
  const BOLT = { t0: 2.35, d0: 22, vIn: 18, tBack: 3.5, vOut: 26, dEnd: 34 };       // in from 2.35, rolled back at 3.5
  const ROLL = { t0: 3.15, t1: 3.75 };                                              // the 16 frames, 0.6 s
  const ROCK = { tp: 5.3, v: 13, ox: -2.5, oy: -0.3 };                             // passes on the left at 5.3
  const BANK = { up0: 4.55, up1: 5.0, dn0: 5.55, dn1: 6.05, dx: 1.25 };               // the ship slides right a model unit

  // ---- the exit (the game's shell): the old .ld-wake's transition, transform 0.55 s cubic-bezier(.5, 0, .9, .4) to
  // scale(2.6) and opacity 0.55 s ease to 0; the loop stops once the screen's own 0.5 s fade is over too
  const SURGE = 0.55, OFF = 0.6;
  function bezier(x1, y1, x2, y2) { // a CSS cubic-bezier() at x
    const c = (a, b, t) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
    return (x) => { if (x <= 0) return 0; if (x >= 1) return 1; let lo = 0, hi = 1, t = x; for (let i = 0; i < 24; i++) { t = (lo + hi) / 2; if (c(x1, x2, t) < x) lo = t; else hi = t; } return c(y1, y2, t); };
  }
  const surgeCurve = bezier(0.5, 0, 0.9, 0.4), fadeCurve = bezier(0.25, 0.1, 0.25, 1);

  // ---- where the ship sits, in CSS px: x, y its centre, w its width
  // the loading screen: today's .ld-wake rules (left 50%, top 52%, width clamp(240px, 40vw, 760px))
  const loaderAnchor = (W, H) => ({ x: W * 0.5, y: H * 0.52, w: Math.max(240, Math.min(0.40 * W, 760)) });
  // the menu: in the open space beside the buttons. A portrait screen: the middle of the room between the wordmark and the
  // buttons (.launcher-mid), as wide as 60% of the screen, as tall as that room allows. A landscape one: the middle of what
  // the column of buttons and the wordmark leave on the right, 62% of it. (A smaller cap in portrait, so the far end of
  // the lane, up and to the right of the ship, still lands on the screen.)
  const menuAnchor = (W, H) => {
    const rect = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
    if (H > W) {
      const r = rect('#title .launcher-mid'), top = r && r.height ? r.top : H * 0.2, h = r && r.height ? r.height : H * 0.4;
      return { x: W * 0.5, y: top + h * 0.5, w: Math.max(120, Math.min(0.6 * W, 1.15 * h, 560)) };
    }
    let right = 0; for (const s of ['#title .menu', '#title .wordmark img']) { const r = rect(s); if (r && r.width) right = Math.max(right, r.right); }
    if (!right) right = W * 0.45;
    const open = W - right;
    return { x: right + open * 0.5, y: H * 0.5, w: Math.max(160, Math.min(0.62 * open, 0.62 * H, 680)) };
  };

  // ---- one player of the loop on one canvas. leave: 'surge' (the loading screen fades: the Wake surges out with it) or
  // 'stop' (the menu goes at once: so does the loop)
  function player(canvas, anchor, leave, showingAtFirst) {
    const ctx = canvas.getContext('2d');
    // ---- the lane: distance d ahead of the ship (model units; negative is behind, toward the camera) to frame coordinates
    const lane = V.lane;
    function laneAt(d) {
      if (d <= lane[0].d) return lane[0]; if (d >= lane[lane.length - 1].d) return lane[lane.length - 1];
      for (let i = 0; i + 1 < lane.length; i++) { const a = lane[i], b = lane[i + 1]; if (d >= a.d && d <= b.d) { const k = (d - a.d) / (b.d - a.d); return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, s: a.s + (b.s - a.s) * k }; } }
      return lane[0];
    }

    // ---- the layout (the game's shell: the ship's anchor and size come from the screen this player is on)
    let W = 0, H = 0, dpr = 1, shipW = 0, ax = 0, ay = 0, K = 1, sized = false;
    function layout() {
      dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      const a = anchor(W, H); shipW = a.w; ax = a.x; ay = a.y; K = shipW / V.sheet.frameW; // K: sprite px to screen px at d = 0
      sized = true;
    }

    function place(d, ox, oy) { const p = laneAt(d); return { x: ax + (p.x + (ox * V.unitX[0] + oy * V.unitY[0]) * p.s) * shipW, y: ay + (p.y + (ox * V.unitX[1] + oy * V.unitY[1]) * p.s) * shipW, s: p.s }; }
    function sprite(img, x, y, scale, alpha, rot, glow) {
      const w = img.naturalWidth * K * scale, h = img.naturalHeight * K * scale; if (w < 1) return;
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (rot) ctx.rotate(rot);
      if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 16 * K * dpr / dpr; }
      ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
    }
    // (the game's shell: sc and al are the exit's surge and fade, 1 and 1 until then)
    function shipFrame(i, x, y, sc = 1, al = 1) {
      if (!art['wake-roll'].naturalWidth || al <= 0) return;
      const S = V.sheet, f = ((i % S.frames) + S.frames) % S.frames, sx = (f % S.cols) * S.frameW, sy = Math.floor(f / S.cols) * S.frameH;
      const w = S.frameW * K * sc, h = S.frameH * K * sc;
      ctx.save(); ctx.globalAlpha = al; ctx.shadowColor = 'rgba(83, 230, 255, 0.85)'; ctx.shadowBlur = 22 * K * sc; ctx.drawImage(art['wake-roll'], sx, sy, S.frameW, S.frameH, x - w / 2, y - h / 2, w, h); ctx.restore();
    }
    // the ship's pose at t: the frame (roll or bank) and its sideways slide
    function shipPose(t) {
      let frame = 0, dx = 0;
      if (t >= ROLL.t0 && t < ROLL.t1) { const k = (t - ROLL.t0) / (ROLL.t1 - ROLL.t0); const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; frame = Math.floor(e * V.sheet.frames) % V.sheet.frames; }
      const b = smooth((t - BANK.up0) / (BANK.up1 - BANK.up0)) * (1 - smooth((t - BANK.dn0) / (BANK.dn1 - BANK.dn0)));
      if (b > 0.45) frame = 1; dx = BANK.dx * b;
      return { frame, dx, bank: b };
    }

    // ---- one frame of the loop (x: how far into the exit, 0 until it starts)
    function render(t, x = 0) {
      t = mod(t, L);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const bob = reduced ? 0 : Math.sin(t / 2.4 * Math.PI * 2) * 0.012 * H; // today's warpfloat
      const items = [];
      // dust
      for (const m of DUST) { const d = FAR - mod(t * m.v + m.ph * (FAR + 4), FAR + 4); const p = place(d, m.ox, m.oy); const a = Math.min(1, (FAR - d) / 8) * 0.55; items.push({ d, draw: () => { ctx.globalAlpha = a; ctx.fillStyle = '#d6e8ff'; ctx.beginPath(); ctx.arc(p.x, p.y + bob * 0.3, m.r * K * p.s * 1.6, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } }); }
      // rings, and their catch sparkle
      for (const r of RINGS) {
        const tt = mod(t - r.tp, L); let d = null;
        if (tt <= 4 / RING_V) d = -RING_V * tt; else { const ta = mod(r.tp - t, L); if (ta <= FAR / RING_V) d = RING_V * ta; }
        if (d === null) continue;
        const p = place(d, r.ox, r.oy); const a = d > 0 ? Math.min(1, (FAR - d) / 8) : Math.max(0, 1 - (-d) / 3.5);
        items.push({ d, draw: () => sprite(art.ring, p.x, p.y + bob, p.s, a) });
        if (tt < 0.4 && tt >= 0) { const k = tt / 0.4, q = place(0, r.ox, r.oy); items.push({ d: -0.01, draw: () => sprite(art.sparkle, q.x, q.y + bob, 0.9 + k * 1.1, 1 - k, k * 2) }); }
      }
      // the blast: in, then rolled straight back
      { let d = null, back = false;
        if (t >= BOLT.t0 && t < BOLT.tBack) d = BOLT.d0 - BOLT.vIn * (t - BOLT.t0);
        else if (t >= BOLT.tBack) { d = BOLT.vOut * (t - BOLT.tBack); back = true; if (d > BOLT.dEnd) d = null; }
        if (d !== null) { const p = place(d, 0.05, 0.1), q = place(d + (back ? 1 : -1), 0.05, 0.1), rot = Math.atan2(q.y - p.y, q.x - p.x); const a = back ? Math.max(0, 1 - d / BOLT.dEnd) : Math.min(1, (BOLT.d0 - d) / 4);
          items.push({ d, draw: () => sprite(art.bolt, p.x, p.y + bob, p.s * (back ? 1.6 : 1.8), a, rot, 'rgba(255, 51, 85, 0.9)') }); }
        // the glint of the roll: two cyan arcs sweeping with the ship, a ripple running out, as ship.js draws them
        if (t >= ROLL.t0 && t < ROLL.t1 + 0.15) { const k = Math.min(1, (t - ROLL.t0) / (ROLL.t1 - ROLL.t0)), s = Math.sin(Math.min(1, k) * Math.PI); const q = place(0, 0, 0);
          items.push({ d: -0.02, draw: () => { ctx.save(); ctx.translate(q.x, q.y + bob); ctx.rotate(-k * Math.PI * 2); ctx.strokeStyle = 'rgba(83, 230, 255, ' + (0.95 * s) + ')'; ctx.lineWidth = Math.max(2, 4 * K); ctx.shadowColor = '#53e6ff'; ctx.shadowBlur = 14 * K;
            const R = shipW * 0.36; for (const a0 of [0, Math.PI]) { ctx.beginPath(); ctx.arc(0, 0, R, a0 - 0.6, a0 + 0.6); ctx.stroke(); }
            ctx.rotate(k * Math.PI * 2); const e = 1 - (1 - k) * (1 - k); ctx.strokeStyle = 'rgba(83, 230, 255, ' + (0.6 * (1 - k) * (1 - k)) + ')'; ctx.lineWidth = Math.max(1.5, 2.5 * K); ctx.beginPath(); ctx.ellipse(0, 0, shipW * 0.62 * (0.5 + 0.5 * e), shipW * 0.5 * (0.5 + 0.5 * e), 0, 0, 7); ctx.stroke(); ctx.restore(); } });
          if (t >= BOLT.tBack - 0.06 && t < BOLT.tBack + 0.22) { const kk = (t - BOLT.tBack + 0.06) / 0.28, q2 = place(0.3, 0.05, 0.1); items.push({ d: -0.03, draw: () => sprite(art.sparkle, q2.x, q2.y + bob, 1.2 + kk * 1.4, 1 - kk, kk) }); } }
      }
      // the asteroid, passing on the left as the ship banks right
      { const ta = mod(ROCK.tp - t, L); let d = null; if (ta <= FAR / ROCK.v) d = ROCK.v * ta; else { const tt = mod(t - ROCK.tp, L); if (tt <= 4 / ROCK.v) d = -ROCK.v * tt; }
        if (d !== null) { const p = place(d, ROCK.ox, ROCK.oy); const a = d > 0 ? Math.min(1, (FAR - d) / 8) : Math.max(0, 1 - (-d) / 3.5); items.push({ d, draw: () => sprite(art['asteroid-a'], p.x, p.y + bob, p.s, a, t * 0.5) }); } }
      // the ship (and, leaving, its surge)
      { const pose = reduced ? { frame: 0, dx: 0 } : shipPose(t); const q = place(0, pose.dx, 0); const sc = 1 + 1.6 * surgeCurve(x), al = 1 - fadeCurve(x);
        items.push({ d: 0, draw: () => shipFrame(pose.frame, q.x, q.y + bob, sc, al) }); }
      items.sort((a, b) => b.d - a.d);
      for (const it of items) it.draw();
      frames++;
    }

    // ---- the clock (the game's shell): it plays while its screen shows, leaves with it, then stops
    let ok = false, failed = false, showing = showingAtFirst, running = false, raf = 0, t0 = 0, leaving = 0, stillT = 0.3, frames = 0, freeing = 0;
    const now = () => performance.now() / 1000;
    function loop(ms) {
      if (!running) return;
      const n = ms / 1000;
      if (leaving && n - leaving >= OFF) { stop(); return; }
      render(n - t0, leaving ? Math.max(0, n - leaving) / SURGE : 0);
      raf = requestAnimationFrame(loop);
    }
    function play() {
      showing = true; leaving = 0; clearTimeout(freeing);
      if (!ok) return;                                          // its sprites are still coming: it starts when they are in
      if (!sized) layout();
      if (reduced) { render(stillT); return; }                  // one still pose
      if (running) return;
      running = true; t0 = now(); render(0); raf = requestAnimationFrame(loop);
    }
    function exit() {
      showing = false;
      if (!ok || !sized) return;
      if (leave === 'stop') { clearTimeout(freeing); stop(); return; } // the menu: it goes at once, and so does the loop
      if (running) { if (!leaving) leaving = now(); return; }   // the surge, then stop()
      clearTimeout(freeing); freeing = setTimeout(stop, OFF * 1000); // a still pose: it goes with the screen's fade
    }
    function stop() { running = false; leaving = 0; cancelAnimationFrame(raf); raf = 0; canvas.width = 0; canvas.height = 0; sized = false; }
    addEventListener('resize', () => { if (!sized) return; layout(); if (!running) render(stillT); });

    const ready = sprites.then(() => {
      ok = art['wake-roll'].naturalWidth > 0; failed = !ok;     // no ship, no picture (a broken small sprite is skipped where it is drawn)
      try { if (ok && showing) play(); } catch (e) { console.error(e); }
    });
    return {
      ready,                                                    // the splash waits for this: the sprites in, the first frame drawn if it shows
      show(on) { if (on) play(); else exit(); },                // ui.js
      get state() { return failed ? 'none' : !ok ? 'wait' : !sized ? 'off' : running ? (leaving ? 'exit' : 'play') : 'still'; },
      get frames() { return frames; },
      get ship() { return sized ? { x: ax, y: ay, w: shipW, h: shipW * V.sheet.frameH / V.sheet.frameW } : null; }, // (the tests: where it sits)
      // tests and stills: the loop held at one moment (show(true) plays on from the start)
      seek(t) { if (!ok) return null; running = false; leaving = 0; cancelAnimationFrame(raf); stillT = t; if (!sized) layout(); render(t); return t; },
    };
  }

  if (loaderCanvas) window.__vignette = player(loaderCanvas, loaderAnchor, 'surge', !!box && !box.classList.contains('done'));
  if (menuCanvas) window.__menuVignette = player(menuCanvas, menuAnchor, 'stop', false);
})();
