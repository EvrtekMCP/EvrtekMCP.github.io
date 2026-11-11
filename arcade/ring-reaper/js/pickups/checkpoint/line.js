// RING REAPER 0.6.1: THE CHECKPOINT'S DRAWING, THE LINE (Kalakar's design, branch checkpoint-art; Evrtek's pick of three,
// 11-11). He asked for "its own distinct design since it's going to be a showpiece basically for every single level. It'll
// be one of the points of familiarity that connects everything". Nothing here changes what a checkpoint IS (index.js: one
// a level, CHECKPOINT_R of reach); this is only its picture.
//
//   THE LINE   two faceted spires either side of the lane, a tape of light strung between them, twin beams.
//              You cross it: the tape breaks on the ship's nose and streams back from it in a chevron, a wake of light.
//              Flown past: it stands dimmed to a third (index.js) and goes by.
//
// The same in every galaxy (it is the thing that connects them). White and the pale ally blue the first build used: it is
// on your side, and none of red, amber or cyan (rule 9), nor any power-up's colour. It pulses on the music's beat
// (api.music), so it belongs to whatever level it stands in. It is { T, make, reset, idle, taken }:
//   make(api) -> a Group (built once, pooled)      reset(g)  as new      idle(g, e, dt, api, a)  standing in the lane, a: 0..1
//   taken(g, e, k, dt, api)  k: 0..1 over T seconds; g rides with the ship; the place itself has gone by e.z metres
// (The other two drawings, the Reaped Ring and the Snapshot, are in git history: branch checkpoint-art, 3cc216f.)
import { THREE, clamp, lerp, smooth } from '../../api.js?v=0.6.1';

const WHITE = 0xffffff, PALE = 0xeaf6ff, BLUE = 0x9fd8ff, DEEP = 0x3f7fe0;

// ---- the small shared kit: every material keeps its own base opacity (op) and a part's own dial (k); show() applies both
function solid(geo, color, M, op = 1) { const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide }); m.userData = { op, k: 1 }; M.push(m); return new THREE.Mesh(geo, m); }
function light(geo, color, M, op, map = null) { const m = new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); m.userData = { op, k: 1 }; M.push(m); return new THREE.Mesh(geo, m); }
function spr(tex, color, M, op, w, h = w) { const m = new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: op }); m.userData = { op, k: 1 }; M.push(m); const s = new THREE.Sprite(m); s.scale.set(w, h, 1); return s; }
const dial = (o, k) => { o.material.userData.k = k; };
function show(M, a) { for (const m of M) m.opacity = Math.min(1, m.userData.op * m.userData.k * a); }
function fresh(M) { for (const m of M) m.userData.k = 1; }
// a four-point sparkle, drawn once on a canvas (thin: its spikes are `thin` of its width)
const STARS = {};
function starTex(thin = 0.07) {
  if (STARS[thin]) return STARS[thin];
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.translate(64, 64);
  for (const [sx, sy, peak] of [[1, thin, 1], [thin, 1, 1], [0.22, 0.22, 0.9]]) {
    g.save(); g.scale(sx, sy);
    const r = g.createRadialGradient(0, 0, 0, 0, 0, 64);
    r.addColorStop(0, 'rgba(255,255,255,' + peak + ')'); r.addColorStop(0.3, 'rgba(255,255,255,' + peak * 0.5 + ')'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.beginPath(); g.arc(0, 0, 64, 0, Math.PI * 2); g.fill(); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (STARS[thin] = t);
}
// a streak of light: full at one end, gone at the other, soft along both edges
let TAPER = null;
function taperTex() {
  if (TAPER) return TAPER;
  const c = document.createElement('canvas'); c.width = 128; c.height = 16; const g = c.getContext('2d'), img = g.createImageData(128, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 128; x++) { const a = Math.pow(1 - x / 127, 1.4) * Math.sin(Math.PI * (y + 0.5) / 16), i = (y * 128 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(255 * a); }
  g.putImageData(img, 0, 0);
  TAPER = new THREE.CanvasTexture(c); TAPER.colorSpace = THREE.SRGBColorSpace; return TAPER;
}
// flat shading baked into vertex colours (a light from the upper left): the house look in 3D, no lights in the scene
function facet(geo, hi = WHITE, lo = DEEP) {
  const g = geo.toNonIndexed(); g.computeVertexNormals();
  const n = g.attributes.normal, col = new Float32Array(n.count * 3), A = new THREE.Color(hi), B = new THREE.Color(lo), t = new THREE.Color();
  const L = new THREE.Vector3(-0.72, 0.3, 0.62).normalize();
  for (let i = 0; i < n.count; i += 3) {
    const d = clamp(0.5 + 0.75 * (n.getX(i) * L.x + n.getY(i) * L.y + n.getZ(i) * L.z), 0, 1);
    t.copy(B).lerp(A, d);
    for (let j = 0; j < 3; j++) { col[(i + j) * 3] = t.r; col[(i + j) * 3 + 1] = t.g; col[(i + j) * 3 + 2] = t.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
// where the music is in its beat, 0..1 (the track's own grid; with no grid, a steady 132 a minute)
function beatOf(api, e) {
  const m = api.music, meta = m && m.meta;
  if (meta && meta.bpm) { const p = (m.position() - (meta.firstBeat || 0)) * meta.bpm / 60; if (p > 0) return p - Math.floor(p); }
  return (e.t * 2.2) % 1;
}
const hit = (ph) => Math.exp(-ph * 3.5);        // 1 on the beat, falling away
const out3 = (x) => 1 - Math.pow(1 - x, 3);

// ============================================================================================================ THE LINE
const X = 4.7, TOP = 8.5, BOT = 3.8;
export const LINE = {
  T: 0.55,
  make(api) {
    const g = new THREE.Group(), M = [], u = { M, posts: [] };
    const upGeo = facet(new THREE.CylinderGeometry(0, 0.5, TOP, 4).translate(0, TOP / 2, 0));     // a spire: a long point up ...
    const dnGeo = facet(new THREE.CylinderGeometry(0.5, 0, BOT, 4).translate(0, -BOT / 2, 0));    // ... and a short one down
    const beamGeo = new THREE.PlaneGeometry(0.6, 60).translate(0, 30, 0);
    const gate = new THREE.Group(); g.add(gate); u.gate = gate;                                    // the part that stands in the course
    const vm = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true }); vm.userData = { op: 1, k: 1 }; M.push(vm);
    for (const s of [-1, 1]) {
      const p = new THREE.Group(); p.position.x = s * X;
      p.add(new THREE.Mesh(upGeo, vm), new THREE.Mesh(dnGeo, vm));
      const lamp = spr(api.glowTex, BLUE, M, 0.8, 6); p.add(lamp);
      const beam = light(beamGeo, BLUE, M, 0.42); beam.position.y = TOP - 0.6; p.add(beam);
      const runs = [0, 1, 2].map(() => { const r = spr(api.glowTex, WHITE, M, 0.95, 1.2); p.add(r); return r; });   // lights climbing it
      const flare = spr(starTex(), WHITE, M, 1, 9); p.add(flare);
      gate.add(p); u.posts.push({ lamp, beam, runs, flare });
    }
    const half = X - 0.45, tapeGeo = new THREE.PlaneGeometry(half, 0.2).translate(half / 2, 0, 0); // each half runs in from its spire
    u.tapeL = solid(tapeGeo, WHITE, M); u.tapeL.position.x = -half; gate.add(u.tapeL);
    u.tapeR = solid(tapeGeo, WHITE, M); u.tapeR.position.x = half; u.tapeR.rotation.z = Math.PI; gate.add(u.tapeR);
    u.tapeGlow = spr(api.glowTex, BLUE, M, 0.5, X * 2.3, 2.6); gate.add(u.tapeGlow);
    u.knot = new THREE.Group(); g.add(u.knot);                                                     // the diamond at the tape's middle: yours to take
    u.knot.add(solid(new THREE.RingGeometry(0.44, 0.66, 4), WHITE, M), solid(new THREE.CircleGeometry(0.2, 4), PALE, M));
    // the broken tape, carried: two streamers back from the ship's nose (white), and a wider, longer pair behind them (blue)
    const wakeGeo = new THREE.PlaneGeometry(1, 0.2).translate(0.5, 0, 0);
    u.wake = [[WHITE, 0.9, 1], [BLUE, 0.6, 0.62]].map(([c, op, sweep]) => ({ sweep, l: light(wakeGeo, c, M, op, taperTex()), r: light(wakeGeo, c, M, op, taperTex()) }));
    for (const w of u.wake) g.add(w.l, w.r);
    u.line = spr(starTex(0.035), WHITE, M, 1, 40, 4); g.add(u.line);                                // the flash as it breaks
    g.userData = u; return g;
  },
  reset(g) { const u = g.userData; fresh(u.M); u.gate.position.set(0, 0, 0); u.tapeL.scale.x = u.tapeR.scale.x = 1; u.knot.scale.setScalar(1); u.knot.rotation.z = 0; dial(u.line, 0); for (const w of u.wake) { dial(w.l, 0); dial(w.r, 0); } for (const P of u.posts) { dial(P.flare, 0); P.lamp.scale.set(6, 6, 1); } },
  idle(g, e, dt, api, a) {
    const u = g.userData, h = hit(beatOf(api, e));
    for (const P of u.posts) {
      dial(P.lamp, 0.7 + 0.3 * h); dial(P.beam, 0.7 + 0.3 * h);
      P.runs.forEach((r, i) => { const t = (e.t * 0.85 + i / 3) % 1; r.position.y = -BOT + t * (TOP + BOT); dial(r, Math.sin(t * Math.PI)); });
    }
    dial(u.tapeGlow, 0.7 + 0.3 * h); u.knot.scale.setScalar(1 + 0.3 * h);
    show(u.M, a);
  },
  taken(g, e, k, dt, api) {
    const u = g.userData, snap = clamp(k / 0.14, 0, 1);
    u.gate.position.set(e.x - g.position.x, e.y - g.position.y, e.z);                              // the spires stay where they stood and go by
    u.tapeL.scale.x = u.tapeR.scale.x = Math.max(0.001, 1 - smooth(snap)); dial(u.tapeGlow, 1 - snap); // the tape snaps back to each spire
    for (const P of u.posts) { dial(P.lamp, 1.4); const s = 6 * (1 + 1.6 * (1 - k)); P.lamp.scale.set(s, s, 1); dial(P.beam, 2.6); dial(P.flare, 1 - k); for (const r of P.runs) dial(r, 0); }
    const fl = clamp(1 - k / 0.3, 0, 1); dial(u.line, fl * fl);
    // the chevron: each streamer swings back from the tape's own line and runs out behind the ship, then thins and is gone
    const sw = out3(clamp(k / 0.3, 0, 1)), go = clamp((k - 0.35) / 0.65, 0, 1);
    for (const w of u.wake) {
      const th = 1.02 * sw * w.sweep, len = lerp(X - 0.45, 13 / w.sweep, sw), wide = (1 + 0.9 * sw) * (1 - 0.7 * go);
      w.r.rotation.y = -th; w.l.rotation.y = Math.PI + th; w.r.scale.set(len, wide, 1); w.l.scale.set(len, wide, 1);
      dial(w.r, 1 - go * go); dial(w.l, 1 - go * go);
    }
    u.knot.rotation.z = k * 7; u.knot.scale.setScalar(1.7 * Math.pow(1 - k, 1.5) + 0.001);
    show(u.M, 1);
  },
};
