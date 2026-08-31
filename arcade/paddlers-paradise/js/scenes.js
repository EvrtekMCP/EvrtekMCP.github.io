// PADDLER'S PARADISE — SCENES
// ---------------------------------------------------------------------------
// Full-screen, first-person pixel renderings: the moments a trip is actually
// remembered by. Look up at an aurora, watch a meteor shower burn across the
// dark, stand at the Tom Thomson cairn, read an ochre pictograph on wet
// granite. Each scene is one painter function drawing procedurally at the
// framebuffer's 2x resolution — portrait on a phone, landscape on a PC,
// because the painter just fills whatever sky it is given.
//
// Painters receive (g, W, H, t, rnd): a context already under the world
// transform, the viewport in world units, seconds since the scene opened, and
// a PRNG seeded per-instance so no two meteor showers are the same shower.
// ---------------------------------------------------------------------------

'use strict';

var fwMoonCanvas = null, fwMoonR = 0;

function buildFwMoon(r) {
  var c = document.createElement('canvas');
  c.width = r * 2 + 2; c.height = r * 2 + 2;
  var g = c.getContext('2d');
  var x, y;
  for (y = -r; y <= r; y++) {
    for (x = -r; x <= r; x++) {
      var d = Math.sqrt(x * x + y * y) / r;
      if (d > 1) continue;
      var mare = Math.sin(x * 0.9 / (r / 8) + 2) * Math.sin(y * 1.1 / (r / 8) - 1) > 0.55;
      g.fillStyle = mare ? '#c9c4ae' : d > 0.9 ? '#ded9c4' : '#f0ead2';
      g.fillRect(x + r + 1, y + r + 1, 1, 1);
    }
  }
  fwMoonCanvas = c;
  fwMoonR = r;
}

function sceneStars(g, W, H, rnd, n, maxY) {
  var i;
  for (i = 0; i < n; i++) {
    var x = rnd() * W, y = rnd() * (maxY || H);
    var b = rnd();
    g.fillStyle = b > 0.85 ? '#f2f2e8' : b > 0.5 ? '#b8c0d8' : '#6a7290';
    g.fillRect(x, y, 0.5, 0.5);
    if (b > 0.96) { g.fillRect(x - 0.5, y, 0.5, 0.5); g.fillRect(x + 0.5, y, 0.5, 0.5); }
  }
}

function sceneTreeline(g, W, H, rnd, yBase, col) {
  g.fillStyle = col || '#060d08';
  g.fillRect(0, yBase, W, H - yBase);
  var x = 0;
  while (x < W) {
    var tw = 4 + rnd() * 8, th = 6 + rnd() * 16;
    var cx = x + tw / 2, ty = yBase - th;
    var s;
    for (s = 0; s < th; s += 1.5) {
      var half = (tw / 2) * (s / th);
      g.fillRect(cx - half, ty + s, half * 2, 1.6);
    }
    x += tw * 0.7;
  }
}

var SCENE_PAINTERS = {

  // --- the northern lights -------------------------------------------------
  aurora: function (g, W, H, t, rnd) {
    var grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#04040f');
    grad.addColorStop(0.7, '#0a1024');
    grad.addColorStop(1, '#101830');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    sceneStars(g, W, H, rnd, 160, H * 0.8);

    // three curtains, breathing at their own speeds
    var c, x;
    for (c = 0; c < 3; c++) {
      var hue = c === 0 ? '105,230,140' : c === 1 ? '80,200,190' : '150,120,220';
      var speed = 0.35 + c * 0.2, drift = c * 2.1;
      for (x = 0; x < W; x += 1) {
        var ph = x * 0.05 + t * speed + drift;
        var top = H * (0.12 + 0.08 * c) + Math.sin(ph) * 6 + Math.sin(ph * 0.37) * 9;
        var len = H * 0.28 + Math.sin(ph * 0.7 + 1.3) * 10;
        var a = 0.10 + 0.08 * Math.abs(Math.sin(ph * 0.53));
        var gr2 = g.createLinearGradient(0, top, 0, top + len);
        gr2.addColorStop(0, 'rgba(' + hue + ',' + (a * 1.6).toFixed(3) + ')');
        gr2.addColorStop(1, 'rgba(' + hue + ',0)');
        g.fillStyle = gr2;
        g.fillRect(x, top, 1, len);
      }
    }
    sceneTreeline(g, W, H, rngFrom(7), H * 0.88);
  },

  // --- a meteor shower ------------------------------------------------------
  meteors: function (g, W, H, t, rnd) {
    g.fillStyle = '#04040f';
    g.fillRect(0, 0, W, H);
    // the Milky Way, as a tilted band of dust
    var i;
    for (i = 0; i < 500; i++) {
      var mx = rnd() * W * 1.4 - W * 0.2;
      var my = mx * 0.35 + H * 0.1 + (rnd() + rnd() - 1) * H * 0.16;
      g.fillStyle = 'rgba(180,190,220,' + (0.05 + rnd() * 0.12).toFixed(3) + ')';
      g.fillRect(mx, my, 0.5, 0.5);
    }
    sceneStars(g, W, H, rnd, 220, H * 0.85);
    // meteors on a fixed schedule from the seed, roughly one a second
    var m;
    for (m = 0; m < 40; m++) {
      var start = m * 0.9 + rnd() * 0.8;
      var age = t - start;
      var x0 = rnd() * W, y0 = rnd() * H * 0.5;
      var ang = 2.2 + rnd() * 0.5;
      var speed = 90 + rnd() * 60;
      if (age < 0 || age > 0.7) continue;
      var hx = x0 + Math.cos(ang) * speed * age;
      var hy = y0 + Math.sin(ang) * speed * age;
      var fade = 1 - age / 0.7;
      var s;
      for (s = 0; s < 12; s++) {
        g.fillStyle = 'rgba(242,242,232,' + (fade * (1 - s / 12)).toFixed(3) + ')';
        g.fillRect(hx - Math.cos(ang) * s * 1.4, hy - Math.sin(ang) * s * 1.4, s < 2 ? 1 : 0.5, s < 2 ? 1 : 0.5);
      }
    }
    sceneTreeline(g, W, H, rngFrom(11), H * 0.9);
  },

  // --- moonrise over the lake ----------------------------------------------
  moonrise: function (g, W, H, t, rnd) {
    var grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#070a1c');
    grad.addColorStop(0.62, '#141a3e');
    grad.addColorStop(0.63, '#0e1e33');
    grad.addColorStop(1, '#122a44');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    sceneStars(g, W, H, rnd, 120, H * 0.6);
    var horizon = H * 0.62;
    var mx = W * 0.6, my = horizon - H * 0.16 + Math.max(0, 4 - t) * 3;
    var r = Math.min(W, H) * 0.11;
    // a dithered moon
    var y, x;
    for (y = -r; y <= r; y += 0.5) {
      for (x = -r; x <= r; x += 0.5) {
        var d = Math.sqrt(x * x + y * y) / r;
        if (d > 1) continue;
        var mare = Math.sin(x * 0.8 + 2) * Math.sin(y * 0.9 - 1) > 0.55;
        g.fillStyle = mare ? '#c9c4ae' : d > 0.92 ? '#ded9c4' : '#f0ead2';
        g.fillRect(mx + x, my + y, 0.5, 0.5);
      }
    }
    // the shimmer path on the water
    for (y = horizon + 1; y < H; y += 1) {
      var wob = Math.sin(y * 0.9 + t * 2.2) * (y - horizon) * 0.12;
      var w2 = r * 0.5 + (y - horizon) * 0.18;
      g.fillStyle = 'rgba(240,234,210,' + Math.max(0.02, 0.16 - (y - horizon) / H * 0.14).toFixed(3) + ')';
      g.fillRect(mx - w2 / 2 + wob, y, w2, 0.5);
    }
    sceneTreeline(g, W, H, rngFrom(23), horizon, '#081018');
  },

  // --- the stars from the campsite -----------------------------------------
  starsCamp: function (g, W, H, t, rnd) {
    g.fillStyle = '#04040f';
    g.fillRect(0, 0, W, H);
    var i;
    for (i = 0; i < 400; i++) {
      var mx = rnd() * W * 1.3 - W * 0.15;
      var my = mx * -0.4 + H * 0.55 + (rnd() + rnd() - 1) * H * 0.14;
      g.fillStyle = 'rgba(190,196,224,' + (0.04 + rnd() * 0.1).toFixed(3) + ')';
      g.fillRect(mx, my, 0.5, 0.5);
    }
    sceneStars(g, W, H, rnd, 260, H * 0.86);
    // one slow satellite
    var sx2 = (t * 6) % (W + 20) - 10;
    g.fillStyle = '#b8c0d8';
    g.fillRect(sx2, H * 0.2 + sx2 * 0.05, 0.6, 0.6);
    sceneTreeline(g, W, H, rngFrom(31), H * 0.84);
    // firelight breathing at the bottom edge
    var glow = g.createLinearGradient(0, H, 0, H * 0.8);
    glow.addColorStop(0, 'rgba(232,132,42,' + (0.22 + 0.08 * Math.sin(t * 5)).toFixed(3) + ')');
    glow.addColorStop(1, 'rgba(232,132,42,0)');
    g.fillStyle = glow;
    g.fillRect(0, H * 0.8, W, H * 0.2);
  },

  // --- the Tom Thomson cairn -----------------------------------------------
  cairn: function (g, W, H, t, rnd) {
    var grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#8fb6d8');
    grad.addColorStop(0.54, '#c9d8e2');
    grad.addColorStop(0.55, '#1e567a');
    grad.addColorStop(1, '#17435f');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    var horizon = H * 0.5;
    sceneTreeline(g, W, H, rngFrom(41), horizon, '#274d33');
    g.fillStyle = '#1e567a';
    g.fillRect(0, horizon + 6, W, H - horizon - 6);
    var y;
    for (y = horizon + 8; y < H * 0.72; y += 2) {
      g.fillStyle = 'rgba(63,131,168,0.4)';
      g.fillRect((Math.sin(y * 0.7 + t) * 6 + W / 2), y, 10 + (y % 5), 0.5);
    }
    // the point of land, and the cairn upon it
    g.fillStyle = '#2a5c35';
    g.fillRect(0, H * 0.72, W, H - H * 0.72);
    g.fillStyle = '#20492a';
    g.fillRect(0, H * 0.72, W, 1.5);
    var cx = W * 0.5, base = H * 0.88, rows = 8, r2;
    for (r2 = 0; r2 < rows; r2++) {
      var rw = (rows - r2) * 4.6 + 4, ry = base - r2 * 4.2;
      var stones = Math.max(2, Math.round(rw / 6)), s2;
      for (s2 = 0; s2 < stones; s2++) {
        var stx = cx - rw / 2 + (rw / stones) * s2 + rnd() * 1.5;
        g.fillStyle = (s2 + r2) % 2 ? '#8d8d95' : '#6e6e78';
        g.fillRect(stx, ry, rw / stones - 0.8, 4);
        g.fillStyle = 'rgba(240,240,235,0.25)';
        g.fillRect(stx, ry, rw / stones - 0.8, 0.8);
      }
    }
    // the brass plaque
    g.fillStyle = '#a8905e';
    g.fillRect(cx - 5, base - rows * 4.2 + 9, 10, 6);
  },

  // --- the Joe Lake dam ------------------------------------------------------
  dam: function (g, W, H, t, rnd) {
    var grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#9fc2dc');
    grad.addColorStop(0.4, '#cfe0e8');
    grad.addColorStop(0.41, '#2b6b8f');
    grad.addColorStop(1, '#17435f');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    sceneTreeline(g, W, H, rngFrom(53), H * 0.4, '#274d33');
    // upper water
    g.fillStyle = '#2b6b8f';
    g.fillRect(0, H * 0.42, W, H * 0.12);
    // the dam: timber and stone across the frame
    var dy = H * 0.54, i;
    g.fillStyle = '#5d4632';
    g.fillRect(0, dy, W, 5);
    g.fillStyle = '#463526';
    for (i = 0; i < W; i += 7) g.fillRect(i, dy, 1, 5);
    g.fillStyle = '#6e6e78';
    g.fillRect(0, dy + 5, W, 3);
    // water sliding over, in animated white threads
    for (i = 0; i < W; i += 3) {
      var ph = (t * 40 + i * 7) % 20;
      g.fillStyle = 'rgba(240,246,250,0.8)';
      g.fillRect(i + Math.sin(i) * 0.5, dy + 5 + ph * 0.9, 1.2, 4);
      g.fillStyle = 'rgba(207,224,232,0.5)';
      g.fillRect(i, dy + 8, 1.6, H * 0.28);
    }
    // churn at the foot
    for (i = 0; i < W; i += 2) {
      g.fillStyle = 'rgba(240,246,250,' + (0.3 + 0.25 * Math.sin(t * 6 + i)).toFixed(3) + ')';
      g.fillRect(i, H * 0.78 + Math.sin(t * 4 + i * 2) * 1.5, 2, 1);
    }
    g.fillStyle = '#17435f';
    g.fillRect(0, H * 0.82, W, H - H * 0.82);
  },

  // --- ochre pictographs on granite -----------------------------------------
  pictograph: function (g, W, H, t, rnd) {
    g.fillStyle = '#8d8d95';
    g.fillRect(0, 0, W, H);
    var i;
    for (i = 0; i < 900; i++) {
      var x = rnd() * W, y = rnd() * H;
      var v = rnd();
      g.fillStyle = v > 0.66 ? '#7c7c86' : v > 0.33 ? '#9a9aa2' : '#6e6e78';
      g.fillRect(x, y, 1 + rnd() * 2, 0.5 + rnd() * 1.5);
    }
    // a wet sheen creeping down the face
    g.fillStyle = 'rgba(60,70,80,0.25)';
    g.fillRect(W * 0.15, 0, W * 0.08, H);
    g.fillRect(W * 0.7, 0, W * 0.05, H);
    // the ochre figures: a canoe with paddlers, a moose, a sun
    var o = '#a33e2f';
    g.fillStyle = o;
    var cx = W * 0.32, cy = H * 0.4;
    g.fillRect(cx - 12, cy, 24, 2);                       // hull
    g.fillRect(cx - 13, cy - 1.5, 2, 2); g.fillRect(cx + 11, cy - 1.5, 2, 2);
    g.fillRect(cx - 5, cy - 5, 1.5, 5); g.fillRect(cx + 3, cy - 5, 1.5, 5);
    var mx2 = W * 0.62, my2 = H * 0.55;                   // the moose
    g.fillRect(mx2, my2, 14, 6);
    g.fillRect(mx2 + 12, my2 - 4, 3, 5);
    g.fillRect(mx2 + 13, my2 - 8, 1, 4); g.fillRect(mx2 + 15.5, my2 - 8, 1, 4);
    g.fillRect(mx2 + 1, my2 + 6, 1.5, 5); g.fillRect(mx2 + 10, my2 + 6, 1.5, 5);
    var sx3 = W * 0.5, sy3 = H * 0.22;                    // the sun
    g.fillRect(sx3 - 3, sy3 - 3, 6, 6);
    for (i = 0; i < 8; i++) {
      var a2 = (i / 8) * Math.PI * 2;
      g.fillRect(sx3 + Math.cos(a2) * 6 - 0.5, sy3 + Math.sin(a2) * 6 - 0.5, 1.5, 1.5);
    }
    // waterline at the foot of the rock
    g.fillStyle = '#1e567a';
    g.fillRect(0, H * 0.88, W, H - H * 0.88);
    for (i = 0; i < W; i += 3) {
      g.fillStyle = 'rgba(63,131,168,0.6)';
      g.fillRect(i, H * 0.88 + Math.sin(t * 2 + i * 0.4) * 0.8, 2, 0.6);
    }
  },

  // --- looking up the big white pine ---------------------------------------
  bigpine: function (g, W, H, t, rnd) {
    g.fillStyle = '#8fb6d8';
    g.fillRect(0, 0, W, H);
    var i, i2;
    // the trunk, converging upward to the vanishing point
    var vx = W * 0.5;
    for (i2 = 0; i2 < H; i2 += 1) {
      var frac = i2 / H;                        // 0 top (far) -> 1 bottom (near)
      var tw = 4 + frac * frac * W * 0.42;
      g.fillStyle = frac > 0.5 ? '#5d4632' : '#463526';
      g.fillRect(vx - tw / 2, i2, tw, 1.2);
      if ((i2 % 6) < 2) {
        g.fillStyle = 'rgba(122,92,66,0.7)';    // bark ridges
        g.fillRect(vx - tw / 2 + 1, i2, tw - 2, 0.6);
      }
    }
    // branch whorls with needle clusters, swaying just barely
    for (i = 0; i < 9; i++) {
      var by = H * 0.06 + i * H * 0.09;
      var frac2 = by / H;
      var reach = W * (0.12 + frac2 * 0.5);
      var sway = Math.sin(t * 0.8 + i) * 1.5;
      var dir = i % 2 ? 1 : -1;
      var bx1 = vx + dir * reach + sway;
      g.fillStyle = '#463526';
      var st;
      for (st = 0; st < 1; st += 0.05) {
        g.fillRect(vx + (bx1 - vx) * st, by + Math.sin(st * 3) * 2 - st * 4, 2, 1);
      }
      var n;
      for (n = 0; n < 26; n++) {
        var nx = bx1 - dir * rnd() * reach * 0.6, ny = by - 4 - rnd() * 7;
        g.fillStyle = n % 3 ? '#2c6e3f' : '#3f8a52';
        g.fillRect(nx, ny + Math.sin(t + n) * 0.4, 2.5, 1.2);
      }
    }
  },

  // --- the ranger cabin ruin (Far Shore trip) --------------------------------
  ranger: function (g, W, H, t, rnd) {
    var grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#8fb6d8');
    grad.addColorStop(0.5, '#cfe0e8');
    grad.addColorStop(0.51, '#2a5c35');
    grad.addColorStop(1, '#20492a');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    sceneTreeline(g, W, H, rngFrom(71), H * 0.5, '#274d33');
    // the clearing
    g.fillStyle = '#2a5c35';
    g.fillRect(0, H * 0.52, W, H);
    var i;
    for (i = 0; i < 260; i++) {
      g.fillStyle = rnd() > 0.5 ? '#20492a' : '#3f8a52';
      g.fillRect(rnd() * W, H * 0.52 + rnd() * H * 0.48, 1.6, 0.8);
    }
    // the cabin: log courses, one wall standing, the roof long gone
    var cx0 = W * 0.24, cw = W * 0.42, cy0 = H * 0.34, chh = H * 0.34;
    var r2;
    for (r2 = 0; r2 < 8; r2++) {
      var ly = cy0 + chh - (r2 + 1) * (chh / 8);
      var sag = Math.sin(r2 * 1.7) * 1.2;
      g.fillStyle = r2 % 2 ? '#5d4632' : '#7a5c42';
      g.fillRect(cx0, ly + sag, cw * (1 - r2 * 0.03), chh / 8 - 0.6);
      // log ends
      g.fillStyle = '#463526';
      g.fillRect(cx0 - 1.6, ly + sag, 1.6, chh / 8 - 0.6);
    }
    // the doorway, dark as a held breath
    g.fillStyle = '#0c0f0a';
    g.fillRect(cx0 + cw * 0.16, cy0 + chh * 0.35, cw * 0.16, chh * 0.65);
    // moss creeping up the north side
    for (i = 0; i < 90; i++) {
      g.fillStyle = 'rgba(63,138,82,' + (0.25 + rnd() * 0.3).toFixed(2) + ')';
      g.fillRect(cx0 + rnd() * cw * 0.4, cy0 + chh * 0.4 + rnd() * chh * 0.6, 1.6, 1);
    }
    // the stone chimney, still standing guard
    var chx = cx0 + cw + W * 0.04;
    var st;
    for (st = 0; st < 12; st++) {
      var sy4 = H * 0.68 - st * (H * 0.038);
      g.fillStyle = st % 2 ? '#8d8d95' : '#6e6e78';
      g.fillRect(chx + Math.sin(st * 2.3) * 0.8, sy4, W * 0.05 - st * 0.12, H * 0.036);
    }
    // fireweed in the clearing, nodding just barely
    for (i = 0; i < 14; i++) {
      var fx3 = rnd() * W, fy3 = H * (0.62 + rnd() * 0.3);
      g.fillStyle = '#2c6e3f';
      g.fillRect(fx3, fy3 - 4, 0.7, 4);
      g.fillStyle = '#e8b4c8';
      g.fillRect(fx3 - 0.8 + Math.sin(t + i) * 0.3, fy3 - 5.5, 2.2, 2);
    }
  },

  // --- the lightning pine (Far Shore trip) -----------------------------------
  lightning: function (g, W, H, t, rnd) {
    var grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#9fc2dc');
    grad.addColorStop(0.8, '#dbe6e2');
    grad.addColorStop(1, '#2a5c35');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    var vx = W * 0.5, splitY = H * 0.5;
    var i2, i;
    // shared trunk below the split
    for (i2 = splitY; i2 < H; i2++) {
      var frac = (i2 - splitY) / (H - splitY);
      var tw = 8 + frac * frac * W * 0.3;
      g.fillStyle = frac > 0.4 ? '#5d4632' : '#463526';
      g.fillRect(vx - tw / 2, i2, tw, 1.2);
    }
    // the char scar, spiralling down the living side of the trunk
    for (i2 = splitY; i2 < H; i2 += 2) {
      var frac2 = (i2 - splitY) / (H - splitY);
      var sw = (8 + frac2 * frac2 * W * 0.3) * 0.22;
      g.fillStyle = '#16120e';
      g.fillRect(vx + Math.sin(frac2 * 5) * sw * 1.6 - sw / 2, i2, sw, 2);
    }
    // DEAD half: charred spar, leaning out left, bare
    var d;
    for (d = 0; d < 1; d += 0.02) {
      var dx2 = vx - d * W * 0.22, dy2 = splitY - d * H * 0.42;
      g.fillStyle = d % 0.08 < 0.04 ? '#16120e' : '#2b241c';
      g.fillRect(dx2 - 3 + d * 2, dy2, 6 - d * 4, 3);
    }
    // a few burnt branch stubs
    for (i = 0; i < 4; i++) {
      var bx2 = vx - (0.2 + i * 0.2) * W * 0.2, by2 = splitY - (0.2 + i * 0.2) * H * 0.4;
      g.fillStyle = '#16120e';
      g.fillRect(bx2 - 6, by2, 7, 1.2);
    }
    // LIVING half: leaning right, green boughs swaying just barely
    for (d = 0; d < 1; d += 0.02) {
      var lx2 = vx + d * W * 0.16, ly3 = splitY - d * H * 0.4;
      g.fillStyle = '#5d4632';
      g.fillRect(lx2 - 2 + d, ly3, 5 - d * 3, 3);
    }
    for (i = 0; i < 40; i++) {
      var bp = 0.15 + rnd() * 0.8;
      var nx2 = vx + bp * W * 0.16 + (rnd() - 0.5) * W * 0.14;
      var ny2 = splitY - bp * H * 0.4 + (rnd() - 0.5) * H * 0.08;
      g.fillStyle = i % 3 ? '#2c6e3f' : '#3f8a52';
      g.fillRect(nx2 + Math.sin(t * 0.8 + i) * 0.5, ny2, 3.2, 1.4);
    }
    // ground, and the shed black shards still lying where they fell
    g.fillStyle = '#2a5c35';
    g.fillRect(0, H * 0.94, W, H * 0.06);
    for (i = 0; i < 6; i++) {
      g.fillStyle = '#16120e';
      g.fillRect(W * (0.2 + rnd() * 0.6), H * (0.94 + rnd() * 0.04), 4 + rnd() * 5, 1.2);
    }
  },

  // --- sitting with the fire (#6, #7) ---------------------------------------
  // The one scene that runs on the game clock: sky, sun, moon and stars are
  // read from hourNow() every frame, so a sunset happens WHILE you watch.
  firewatch: function (g, W, H, t, rnd) {
    var h = hourNow();
    var horizon = H * 0.52;

    // the sky keyframes: [hour, top, low, lake, treeline, starAlpha]
    var K = [
      [5.0,  '#0a0f2e', '#25204a', '#0e1830', '#04140a', 0.8],
      [6.0,  '#233a66', '#c47a5a', '#1a2f4a', '#071a0d', 0.35],
      [8.0,  '#6fa8d4', '#cfe0e8', '#2b6b8f', '#12331c', 0],
      [12.0, '#7db6e0', '#dceaf2', '#2e719a', '#163c20', 0],
      [17.0, '#79a9d8', '#f2d8a0', '#2b6488', '#143a1e', 0],
      [18.8, '#5f7fb0', '#f2b076', '#28577c', '#0f2c16', 0],
      [19.7, '#3a4a8c', '#e2954a', '#22496e', '#0a2010', 0.08],
      [20.2, '#2a2f6e', '#d95f3b', '#1c3c5e', '#081808', 0.25],
      [20.7, '#171c48', '#7a3a58', '#132c48', '#061204', 0.55],
      [21.4, '#0a0f2e', '#252a5a', '#0c1c34', '#040d04', 0.85],
      [22.5, '#04061c', '#0a0f2e', '#081426', '#030a03', 1],
    ];
    var i2 = 0, u = 0;
    if (h <= K[0][0]) { i2 = 0; u = 0; }
    else if (h >= K[K.length - 1][0]) { i2 = K.length - 2; u = 1; }
    else {
      for (i2 = 0; i2 < K.length - 2; i2++) {
        if (h >= K[i2][0] && h <= K[i2 + 1][0]) break;
      }
      u = (h - K[i2][0]) / (K[i2 + 1][0] - K[i2][0]);
    }
    // distant wildlife schedule (#4) — consume rnd() a fixed number of
    // times BEFORE anything conditional touches the stream
    var wild = [];
    var we;
    for (we = 0; we < 12; we++) {
      wild.push({
        type: rnd(),
        start: 8 + we * 11 + rnd() * 7,
        lane: rnd(),
        dir: rnd() < 0.5 ? 1 : -1,
      });
    }
    var jumps = [];
    var jj;
    for (jj = 0; jj < 10; jj++) {
      jumps.push({ start: 5 + jj * 13 + rnd() * 9, x: rnd(), lane: rnd() });
    }

    var top = hexLerp(K[i2][1], K[i2 + 1][1], u);
    var low = hexLerp(K[i2][2], K[i2 + 1][2], u);
    var lake = hexLerp(K[i2][3], K[i2 + 1][3], u);
    var tree = hexLerp(K[i2][4], K[i2 + 1][4], u);
    var starA = K[i2][5] + (K[i2 + 1][5] - K[i2][5]) * u;

    var grad = g.createLinearGradient(0, 0, 0, horizon);
    grad.addColorStop(0, top);
    grad.addColorStop(1, low);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, horizon + 2);

    if (starA > 0.02) {
      g.globalAlpha = starA;
      sceneStars(g, W, H, rnd, 220, horizon * 0.96);
      g.globalAlpha = 1;
    }

    // the sun: crosses and sinks; at the right hour you catch it touching
    // the treeline across the lake
    var glowX = null, glowCol = null;
    if (h < 19.95) {
      var sunP = Math.max(0, Math.min(1, (h - 6) / 13.9));
      var sunX = W * (0.26 + sunP * 0.46);
      var sunY = horizon - Math.max(1.5, ((19.9 - h) / 13.9) * H * 0.42);
      var late = h > 18.2;
      var r0 = late ? Math.min(W, H) * 0.055 : Math.min(W, H) * 0.035;
      if (late) {
        var sg = g.createRadialGradient(sunX, sunY, r0 * 0.4, sunX, sunY, r0 * 4);
        sg.addColorStop(0, 'rgba(242,150,60,0.5)');
        sg.addColorStop(1, 'rgba(242,150,60,0)');
        g.fillStyle = sg;
        g.fillRect(sunX - r0 * 4, sunY - r0 * 4, r0 * 8, r0 * 8);
      }
      g.fillStyle = late ? '#f0a850' : '#f7ecd0';
      g.beginPath();
      g.arc(sunX, sunY, r0, 0, Math.PI * 2);
      g.fill();
      glowX = sunX; glowCol = late ? '240,180,110' : '240,236,210';
    }

    // the moon climbs and crosses the evening sky, slowly — a solid thing
    // at integer pixels, drawn once and blitted, so it neither flickers nor
    // lets the stars shine through it (#7)
    if (h >= 19.7 || h < 5) {
      var hm = h < 5 ? h + 24 : h;
      var mp = Math.max(0, Math.min(1, (hm - 19.7) / 4.2));
      var mx = Math.round(W * (0.14 + 0.66 * mp));
      var my = Math.round(horizon - H * (0.1 + 0.27 * Math.sin(mp * Math.PI)));
      var mr = Math.max(3, Math.round(Math.min(W, H) * 0.05));
      if (!fwMoonCanvas || fwMoonR !== mr) buildFwMoon(mr);
      g.globalAlpha = Math.min(1, starA * 2 + 0.35);   // dusk ghost, night rock
      g.drawImage(fwMoonCanvas, mx - mr - 1, my - mr - 1);
      g.globalAlpha = 1;
      if (starA > 0.1) { glowX = mx; glowCol = '240,234,210'; }
    }

    // the far shore, then the lake over its skirt
    sceneTreeline(g, W, H, rngFrom(67), horizon, tree);
    g.fillStyle = lake;
    g.fillRect(0, horizon + 3.5, W, H - horizon - 3.5);

    // shimmer path under whichever light owns the sky
    if (glowX !== null) {
      var yy2;
      for (yy2 = horizon + 4; yy2 < H * 0.82; yy2 += 1) {
        var wob = Math.sin(yy2 * 0.8 + t * 2) * (yy2 - horizon) * 0.1;
        var w2 = 3 + (yy2 - horizon) * 0.3;
        g.fillStyle = 'rgba(' + glowCol + ',' + Math.max(0.02, 0.14 - (yy2 - horizon) / H * 0.2).toFixed(3) + ')';
        g.fillRect(glowX - w2 / 2 + wob, yy2, w2, 0.5);
      }
    }
    // something alive, far off (#4): a loon working the bay, a heron over
    // the far shore, a moose at the waterline — small, dark, unbothered
    drawFwWildlife(g, W, H, horizon, t, wild);
    drawFwFish(g, W, H, horizon, t, jumps);
    drawFwVisitor(g, W, H, horizon, t);

    // lap lines, catching whatever light there is
    var li;
    for (li = 0; li < 24; li++) {
      var lh = (li * 2654435761) >>> 0;
      var lx = lh % W, ly2 = horizon + 5 + (lh >>> 8) % Math.max(4, (H * 0.28) | 0);
      if (Math.sin(t * 1.3 + li) > 0.25) {
        g.fillStyle = 'rgba(235,242,248,0.3)';
        g.fillRect(lx, ly2, 5, 0.6);
      }
    }

    // the caption keeps the scene's own time — sitting long enough to cross
    // an hour should not leave last hour's words on screen
    if (S.scene && performance.now() >= (S.scene.capHold || 0)) {
      var fireAlive = S.campSession && S.campSession.chores.fire;
      var newCap = h >= 20.3 ? (fireAlive ? 'Sparks climb. The stars hold still.'
                                          : 'The stars hold still over a dark shore.')
        : h >= 18.6 ? 'The sun leans on the far treeline. Stay for this.'
        : 'The lake breathes. You match it.';
      if (newCap !== S.scene.caption) {
        S.scene.caption = newCap;
        S.scene.capT = performance.now();
      }
    }

    // the near ground you sit on
    g.fillStyle = '#0c1410';
    g.fillRect(0, H * 0.82, W, H * 0.18);
    var gi;
    for (gi = 0; gi < 40; gi++) {
      var gh2 = (gi * 340573321) >>> 0;
      g.fillStyle = gh2 % 2 ? '#132018' : '#0a100c';
      g.fillRect(gh2 % W, H * 0.82 + (gh2 >>> 6) % ((H * 0.16) | 0), 2, 1);
    }

    // the fire — sized by its FUEL (the tending minigame), embers when it
    // is nearly out, or the cold ring waiting for six fresh logs
    var lit = S.campSession && S.campSession.chores.fire;
    var fuel = S.campSession ? (S.campSession.fireFuel || 0) : 5;
    var ff = 0.45 + Math.min(12, fuel) * 0.11;
    var embers = lit && fuel <= 0.15;
    var fx2 = W * 0.5, fy2 = H * 0.86;
    // the ring
    var si;
    for (si = 0; si < 9; si++) {
      var sa = (si / 9) * Math.PI * 2;
      g.fillStyle = si % 2 ? '#6e6e78' : '#4a4a52';
      g.fillRect(fx2 + Math.cos(sa) * W * 0.06 - 1.2, fy2 + Math.sin(sa) * H * 0.02 + 2 - 0.8, 2.6, 1.8);
    }
    if (embers) {
      // a bed of coals pulsing under ash — the warning made visible
      g.fillStyle = '#3a2c1e';
      g.fillRect(fx2 - 7, fy2 + 1, 14, 2.2);
      var eb;
      for (eb = 0; eb < 7; eb++) {
        var ebh = (eb * 340573321) >>> 0;
        var pulse = 0.25 + 0.2 * Math.sin(t * 2.4 + eb * 1.7);
        g.fillStyle = 'rgba(232,110,40,' + pulse.toFixed(2) + ')';
        g.fillRect(fx2 - 5 + (ebh % 10), fy2 + (ebh >>> 4) % 2, 1.4, 0.9);
      }
    } else if (lit) {
      // logs
      g.fillStyle = '#3a2c1e';
      g.fillRect(fx2 - 7, fy2 + 1, 14, 2.2);
      g.fillRect(fx2 - 5, fy2 - 0.5, 10, 2);
      // three tongues of flame, sized by the fuel, breathing at their own speeds
      var fl;
      for (fl = 0; fl < 3; fl++) {
        var fw = (3 - fl) * 2.6 * (0.7 + ff * 0.3);
        var fh = (H * 0.055) * ff * (1 + fl * 0.5) * (0.85 + 0.15 * Math.sin(t * (5 + fl * 2.3) + fl * 2));
        var lean = Math.sin(t * (2.2 + fl) + fl) * 1.6;
        g.fillStyle = fl === 0 ? '#f2f2e8' : fl === 1 ? '#f2c14b' : '#e8842a';
        g.beginPath();
        g.moveTo(fx2 - fw, fy2 + 1);
        g.quadraticCurveTo(fx2 + lean, fy2 - fh, fx2 + fw, fy2 + 1);
        g.fill();
      }
      // sparks — a bigger fire throws more of them, higher
      var sk, nsk = 4 + Math.round(ff * 7);
      for (sk = 0; sk < nsk; sk++) {
        var skh = (sk * 2654435761) >>> 0;
        var rise = (t * (14 + (skh % 7)) + sk * 11) % (H * 0.22 * (0.7 + ff * 0.3));
        var alpha = Math.max(0, 1 - rise / (H * 0.22));
        g.fillStyle = 'rgba(242,193,75,' + (alpha * 0.8).toFixed(2) + ')';
        g.fillRect(fx2 + Math.sin(rise * 0.3 + sk) * 4, fy2 - rise, 0.7, 0.7);
      }
      // the glow the fire throws on everything
      var fg2 = g.createRadialGradient(fx2, fy2, 2, fx2, fy2, H * 0.3 * (0.6 + 0.4 * ff));
      fg2.addColorStop(0, 'rgba(242,160,60,' + ((0.16 + 0.05 * Math.sin(t * 5)) * (0.6 + 0.4 * ff)).toFixed(3) + ')');
      fg2.addColorStop(1, 'rgba(242,160,60,0)');
      g.fillStyle = fg2;
      g.fillRect(fx2 - H * 0.4, fy2 - H * 0.4, H * 0.8, H * 0.8);
    }
  },
};

/** The far-off lives in the firewatch view (#4). Cycles every ~140s. */
function drawFwWildlife(g, W, H, horizon, t, wild) {
  var i;
  for (i = 0; i < wild.length; i++) {
    var ev = wild[i];
    var kind = ev.type < 0.45 ? 'loon' : ev.type < 0.8 ? 'heron' : 'moose';
    var dur = kind === 'moose' ? 14 : kind === 'heron' ? 9 : 16;
    // wrap per-event: a crossing cut by the cycle simply finishes next cycle
    var age = ((t - ev.start) % 140 + 140) % 140;
    if (age > dur) continue;
    var p = age / dur;
    if (kind === 'loon') {
      // swims across the bay, diving for a stretch in the middle
      if (p > 0.45 && p < 0.58) continue;
      var lx = W * (ev.dir > 0 ? p : 1 - p);
      var ly = horizon + 6 + ev.lane * (H * 0.1);
      g.fillStyle = 'rgba(10,14,18,0.8)';
      g.fillRect(lx - 1.5, ly - 0.8, 3, 1);
      g.fillRect(lx + ev.dir * 1.5, ly - 1.9, 0.8, 1.4);
      g.fillStyle = 'rgba(230,238,244,0.22)';
      g.fillRect(lx - ev.dir * 3.2, ly + 0.4, 2.5, 0.4);
      g.fillRect(lx - ev.dir * 5.6, ly + 0.7, 2, 0.3);
    } else if (kind === 'heron') {
      var hx = W * (ev.dir > 0 ? p : 1 - p);
      var hy = horizon - 6 - ev.lane * (H * 0.12) - Math.sin(p * Math.PI * 3) * 1.5;
      var flap = Math.sin(t * 6 + i) > 0 ? 1.2 : -0.5;
      g.fillStyle = 'rgba(8,12,14,0.75)';
      g.fillRect(hx - 2.4, hy - flap, 2.4, 0.7);
      g.fillRect(hx, hy - flap * 0.5, 2.4, 0.7);
      g.fillRect(hx - 0.4, hy, 1, 0.8);
    } else {
      // a moose at the far waterline, there and then not
      var sx2 = W * (0.1 + ev.lane * 0.8);
      var a2 = Math.min(1, age, dur - age) * 0.6;
      g.fillStyle = 'rgba(6,10,8,' + a2.toFixed(2) + ')';
      g.fillRect(sx2 - 2, horizon - 2.6, 4, 1.8);
      g.fillRect(sx2 + (ev.dir > 0 ? 1.7 : -2.5), horizon - 3.7, 0.9, 1.5);
      g.fillRect(sx2 - 1.6, horizon - 0.9, 0.6, 1.1);
      g.fillRect(sx2 + 1, horizon - 0.9, 0.6, 1.1);
    }
  }
}

/** The passing canoeist (#5): hull, paddler, wake — and a paddle raised
 *  high for three seconds if you waved. */
function drawFwVisitor(g, W, H, horizon, t) {
  var cs = S.campSession;
  if (!cs || !cs.visitor) return;
  var v = cs.visitor;
  var p = v.t / v.dur;
  var vx = W * (v.dir > 0 ? -0.05 + p * 1.1 : 1.05 - p * 1.1);
  var vy = horizon + 8 + v.lane * (H * 0.1);
  var bob = Math.sin(t * 1.8) * 0.4;
  // wake
  g.fillStyle = 'rgba(225,235,242,0.2)';
  g.fillRect(vx - v.dir * 6, vy + 1.6 + bob * 0.4, 4.5, 0.5);
  g.fillRect(vx - v.dir * 10, vy + 2.1, 3.5, 0.4);
  // hull, ends upswept
  g.fillStyle = 'rgba(96,32,26,0.95)';
  g.fillRect(vx - 4.5, vy + bob, 9, 1.4);
  g.fillRect(vx - 5.2, vy - 0.6 + bob, 1.2, 1.2);
  g.fillRect(vx + 4.0, vy - 0.6 + bob, 1.2, 1.2);
  // paddler
  g.fillStyle = 'rgba(20,26,30,0.95)';
  g.fillRect(vx - 0.9, vy - 2.6 + bob, 1.8, 2.8);
  g.fillRect(vx - 0.6, vy - 3.6 + bob, 1.2, 1.2);
  // the paddle: dipping strokes — or held HIGH in reply
  if (v.wavedBack > 0) {
    g.fillRect(vx + v.dir * 1.2, vy - 6.6 + bob, 0.7, 4.4);
    g.fillRect(vx + v.dir * 0.9, vy - 7.6 + bob, 1.4, 1.4);
  } else {
    var stroke = Math.sin(t * 2.6);
    var side = stroke > 0 ? 1 : -1;
    g.fillRect(vx + side * 1.6, vy - 1.6 + bob, 0.7, 3 + Math.abs(stroke) * 1.2);
  }
}

/** Fish jumping out on the lake while you watch the fire (Evrtek). */
function drawFwFish(g, W, H, horizon, t, jumps) {
  var i;
  for (i = 0; i < jumps.length; i++) {
    var ev = jumps[i];
    var age = ((t - ev.start) % 140 + 140) % 140;
    if (age > 2.4) continue;
    var jx = W * (0.08 + 0.84 * ev.x);
    var jy = horizon + 6 + ev.lane * (H * 0.16);
    if (age < 0.7) {
      // the arc: up, a silver flash at the top, and back in
      var p = age / 0.7;
      var hgt = Math.sin(p * Math.PI) * 4.5;
      g.fillStyle = p > 0.35 && p < 0.65 ? 'rgba(180,196,206,0.9)' : 'rgba(14,20,26,0.85)';
      g.fillRect(jx - 0.9 + p * 1.8, jy - hgt, 1.8, 0.9);
    } else {
      // rings widening where it went back in
      var rr = (age - 0.7) * 6;
      var al = Math.max(0, 0.32 - (age - 0.7) * 0.16);
      if (al <= 0) continue;
      g.fillStyle = 'rgba(220,232,240,' + al.toFixed(2) + ')';
      g.fillRect(jx - rr, jy + 0.6, rr * 2, 0.5);
      g.fillRect(jx - rr * 0.55, jy - 0.4, rr * 1.1, 0.5);
    }
    if (age >= 0.62 && age < 0.78) {
      g.fillStyle = 'rgba(235,242,248,0.7)';
      g.fillRect(jx - 1.6, jy - 1, 3.2, 1);
    }
  }
}

// --- plumbing ----------------------------------------------------------------

function openScene(name, caption, sub, live) {
  S.scene = {
    name: name,
    caption: caption,
    capT: performance.now(),      // captions fade; a new one fades back in
    btn: live ? 'STAND UP' : 'LOOK AWAY',
    t0: performance.now(),
    seed: Math.floor(S.rnd() * 0xffffffff) >>> 0,
    live: !!live,                 // a live scene lets the game clock run
  };
  S.mode = 'scene';
}

function closeScene() {
  S.scene = null;
  S.mode = 'play';
}
