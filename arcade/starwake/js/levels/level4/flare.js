// LEVEL 4: THE SOLAR FLARE, the level's headline. A stretch of the track where the star is about to erupt.
//  - THE GLOW (the warning, rule 11/12): a white-hot band lies on the surface along the stretch with red edges,
//    and small licks of fire flicker on it. It is in the track, so it is readable from about 450 m out; its
//    pulse quickens as it nears. Yori: "a white-hot band on the surface runs ahead of the flare".
//  - THE ERUPTION: `lead` seconds before the stretch reaches the ship (1.2 s+ the first time, 1.0 s+ after), the
//    whole stretch erupts in one breath, on a bar line, into a wall of fire the height of the flight box.
//  - THE SWEEP: the band may run diagonally along the stretch, so the fire at the ship moves across the lanes as
//    it streams past (x0..x1 at the near end, x0b..x1b at the far end).
//  - THE SHADE: a shield-plate raft (raft.js) inside the stretch stops the fire at its plates; the column on its
//    far side stays clear and violet. Act 3 turns it over: `from: 'above'`, a prominence rains fire DOWN, and
//    the shade is under a high raft.
// Touching the fire costs a small hit (and another each time the shield's grace ends, if you stay in it).
// Flying close to it pays SKIM (rule 31: the risk line); riding a corridor through a burn pays SHADE.
import { THREE, defineObstacle, Instanced, clamp, smoothstep, appear, SPAWN_D } from '../../api.js?v=0.4.1';
import { rafts, sheltered, insideBy, blockAt, surfaceY, ceilingY } from './shade.js?v=0.4.1';
import { star } from './star.js?v=0.4.1';
import { fogFade } from './raft.js?v=0.4.1';
import { BEAT } from './timeline.js?v=0.4.1';

const CAP = 1500, SEG = 48, ROW = 4.5;
const qA = new THREE.Quaternion(), eul = new THREE.Euler();
let tongues = null, API = null;

// a tongue of fire: white-hot at its root, red body (the hurts hue, rule 9), soft edges, a ragged tip
function flameTexture() {
  const W = 64, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = 1 - y / (H - 1);                       // 0 at the root (bottom row), 1 at the tip
    const nx = (x + 0.5) / W * 2 - 1;
    const wob = 0.12 * Math.sin(v * 13 + x * 0.05) + 0.06 * Math.sin(v * 31);
    const half = 0.92 * Math.pow(1 - v, 0.55) * (1 - 0.15 * v) + 0.04;
    const across = clamp(1 - Math.abs(nx + wob * v) / half, 0, 1);
    let a = Math.pow(across, 1.4) * Math.pow(1 - v, 0.7) * smoothstep(0, 0.05, v + 0.02);
    const hot = Math.pow(across, 2.2) * Math.pow(1 - v, 2.5);  // the white core, low and central
    const i = (y * W + x) * 4;
    d[i] = 255; d[i + 1] = Math.round(255 * clamp(0.2 + 0.8 * hot, 0, 1)); d[i + 2] = Math.round(255 * clamp(0.3 + 0.7 * hot, 0, 1)); d[i + 3] = Math.round(255 * clamp(a, 0, 1));
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  return t;
}
function bandMesh() {
  const g = new THREE.BufferGeometry(), n = (SEG + 1) * 6;
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const idx = [];
  for (let k = 0; k < SEG; k++) for (let p = 0; p < 3; p++) { const a = k * 6 + p * 2, b = a + 6; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  g.setIndex(idx); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.frustumCulled = false; m.renderOrder = 1;
  return m;
}
const hex = (r, g, b) => ((clamp(r, 0, 1) * 255) << 16) | ((clamp(g, 0, 1) * 255) << 8) | (clamp(b, 0, 1) * 255);

export default defineObstacle({
  name: 'l4-flare',
  motion: 'own',
  // rule 12: the band is in the track and reads from about 450 m; the check also gets the eruption lead
  hazard: { cls: 'sweep', introduced: 4, warn: (ev, v) => Math.min(450 / v, 8), lead: (ev) => ev.lead || 1.05 },
  sample: { len: 40, x0: -0.4, x1: 0.4 },
  init(api) {
    API = api;
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ map: flameTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    tongues = new Instanced(api.scene, geo, mat, CAP);
    tongues.mesh.renderOrder = 3;
    tongues.mesh.setColorAt(0, new THREE.Color(0));
  },
  begin() { tongues.begin(); },
  end() { tongues.end(); },
  spawn(e, ev, api) {
    const B = api.box;
    e.from = ev.from || 'below';
    e.len = ev.len || 120; e.near = e.z; e.lead = ev.lead || 1.05;
    const x0 = (ev.x0 ?? -1.2) * B.x, x1 = (ev.x1 ?? 1.2) * B.x, x0b = (ev.x0b ?? ev.x0 ?? -1.2) * B.x, x1b = (ev.x1b ?? ev.x1 ?? 1.2) * B.x;
    e.band = (u) => { const k = clamp(u / e.len, 0, 1); return [x0 + (x0b - x0) * k, x1 + (x1b - x1) * k]; };
    e.h = 0; e.state = 0; e.toldT = -1; e.skim = 0; e.shadeT = 0; e.paidShade = false; e.burnHit = false;
    e.seed = (ev.d || 0) * 0.137;
    // the strip is drawn in ship space from the origin; it is NOT e.obj (the course would pose it as one object)
    e.strip = api.course.get('l4-band', bandMesh); e.strip.position.set(0, 0, 0); e.strip.scale.set(1, 1, 1);
  },
  remove(e, api) { if (e.strip) api.course.put('l4-band', e.strip); e.strip = null; },
  // where the fire is at the ship and just ahead, for the test autopilot (it never hurts anyone else)
  avoid(e) {
    if (!API || e.h < 0.2) return null;
    const v = API.v;
    if (e.near > e.len) return null;
    const u = Math.min(e.len, Math.max(0, e.near) + 0.22 * v);
    const [L, R] = e.band(u), out = [];
    // split the band where a corridor shades it
    let cut = null;
    for (const r of rafts) if (r.from === e.from) { const ru = r.near - (e.near - u); if (ru >= 0 && ru <= r.len) { const cx = r.cx(ru); cut = [cx - r.hw, cx + r.hw]; } }
    const parts = cut ? [[L, Math.min(R, cut[0])], [Math.max(L, cut[1]), R]] : [[L, R]];
    for (const [a, b] of parts) if (b - a > 0.3) out.push({ x: (a + b) / 2, y: API.ship.y, r: (b - a) / 2 + 1.1 });
    return out;
  },
  update(e, dt, api) {
    const B = api.box, ship = api.ship, v = api.v, G = api.game;
    e.near += v * dt;
    // the autopilot (testhooks) only looks at what is ahead: while the stretch covers the ship, report it there
    e.z = e.near < -1.5 ? e.near : (e.near - e.len < -1.5 ? -1.5 : e.near - e.len);
    const tArr = -e.near / Math.max(1, v);
    const fi = e.fadeIn !== undefined ? e.fadeIn / 0.5 : 1;
    // ---- the tell and the eruption
    if (e.state === 0 && tArr <= e.lead + 1.0 && !e.ev.warm) { e.state = 1; G.sfx('roll', { rate: 0.5, vol: 0.45, pan: clamp(((e.band(0)[0] + e.band(0)[1]) / 2) / B.x * 0.5, -0.6, 0.6) }); }
    // The eruption is laid on a beat (timeline.js) at base speed. GREED and boosts put the course ahead of the
    // music, so in the beat before its deadline a flare waits for the music's next kick and erupts on it; the lead
    // only ever grows, never under its floor (rule 12). Without music it erupts on its deadline.
    let go = tArr <= e.lead;
    if (!go && e.state <= 1 && tArr > e.lead + 0.05 && tArr < e.lead + BEAT - 0.05 && api.music) {
      const meta = api.music.meta, pos = api.music.position();
      if (meta && pos >= 0) { const bs = meta.beatSec || 60 / (meta.bpm || 144), ph = ((pos - (meta.firstBeat || 0)) % bs + bs) % bs; if (ph < dt) go = true; }
    }
    if (e.state <= 1 && go && !e.ev.warm) {
      e.state = 2;
      const big = (e.band(0)[1] - e.band(0)[0]) / (2 * B.x);
      G.sfx('flare-roar', { vol: 0.55 + 0.45 * big, pan: clamp(((e.band(0)[0] + e.band(0)[1]) / 2) / B.x * 0.5, -0.6, 0.6) });
      G.shake(0.12 + 0.25 * big);
      // the eruption throws a spray of sparks off the near edge
      const z = clamp(e.near, -320, -6), [L, R] = e.band(Math.max(0, -z + e.near)), yb0 = e.from === 'below' ? surfaceY(B.y) - star.curv * z * z : ceilingY(B.y);
      const n = api.tier === 0 ? 3 : 6, sgn = e.from === 'below' ? 1 : -1;
      for (let k = 0; k < n; k++) for (let j = 0; j < 6; j++) {
        G.emit(L + (R - L) * (k + Math.random()) / n, yb0, z + (Math.random() - 0.5) * 6, { vx: (Math.random() - 0.5) * 4, vy: sgn * (10 + 14 * Math.random()), vz: (Math.random() - 0.5) * 6, life: 0.9, s0: 1.5, s1: 0.2, r: 1, g: 0.45, b: 0.5, carry: 1, drag: 0.7 });
      }
    }
    // embers lifting off the fire just ahead of the ship (none in the shade)
    if (e.state === 2 && e.h > 0.5 && e.near > -60 && e.near - e.len < 0) {
      e.emb = (e.emb || 0) + dt * (api.tier === 0 ? 18 : 40);
      while (e.emb >= 1) {
        e.emb -= 1;
        const u = Math.max(0, e.near) + 5 + Math.random() * 55;
        if (u > e.len) continue;
        const z = e.near - u, [L, R] = e.band(u), x = L + (R - L) * Math.random();
        if (blockAt(x, z, e.from) !== null) continue;
        const sgn = e.from === 'below' ? 1 : -1, y0 = e.from === 'below' ? surfaceY(B.y) - star.curv * z * z : ceilingY(B.y);
        G.emit(x, y0 + sgn * Math.random() * (B.y * 2 + 4), z, { vx: (Math.random() - 0.5) * 2, vy: sgn * (4 + 5 * Math.random()), life: 0.7, s0: 0.7, s1: 0.1, r: 1, g: 0.6, b: 0.55, carry: 1 });
      }
    }
    if (e.state === 2) e.h = Math.min(1, e.h + dt / 0.28);
    const pre = e.state === 2 ? 1 : clamp(1 - (tArr - e.lead) / 1.6, 0, 1); // 0 far .. 1 at the eruption
    const base = e.from === 'below' ? surfaceY(B.y) : ceilingY(B.y), dir = e.from === 'below' ? 1 : -1;
    const top = e.from === 'below' ? B.y + 4 : -B.y - 4;
    const curv = star.curv;
    const yb = (z) => (e.from === 'below' ? base - curv * z * z : base);
    // ---- the band on the surface (or the ceiling)
    const pos = e.strip.geometry.attributes.position, col = e.strip.geometry.attributes.color;
    const ua = Math.max(0, e.near - 8), ub = Math.min(e.len, e.near + SPAWN_D), live = ub > ua;
    const pulse = 0.5 + 0.5 * Math.sin(e.t * (6 + 22 * pre) + e.seed);
    // the band is the WARNING: bright while it warns, a warm glow under the fire once it burns (a white sheet
    // under the fire washed out the bottom of the screen, where a shot's pale core must still read: rule 10)
    const core = e.state === 2 ? 0.2 : 0.16 + 0.24 * pre + 0.1 * pulse * (1 - pre * 0.5);
    const ew = 0.32;
    const eg = e.state === 2 ? 0.75 : 0.45 + 0.4 * pre + 0.15 * pulse, ewh = e.state === 2 ? 0.45 : pre * 0.7; // red edges, white-hot at the end
    for (let k = 0; k <= SEG; k++) {
      const u = live ? ua + (ub - ua) * k / SEG : ua, z = e.near - u, [L, R] = e.band(u), y = yb(z) + dir * 0.06;
      const f = (live ? 1 : 0) * appear(z) * fogFade(z) * (1 - smoothstep(-8, 2, z)) * fi;
      const i = k * 6;
      pos.setXYZ(i, L, y, z); pos.setXYZ(i + 1, R, y, z);
      pos.setXYZ(i + 2, L - ew, y + dir * 0.02, z); pos.setXYZ(i + 3, L + ew, y + dir * 0.02, z);
      pos.setXYZ(i + 4, R - ew, y + dir * 0.02, z); pos.setXYZ(i + 5, R + ew, y + dir * 0.02, z);
      const c = core * f, cg = e.state === 2 ? 0.55 : 0.78, cb = e.state === 2 ? 0.45 : 0.62;
      col.setXYZ(i, c, c * cg, c * cb); col.setXYZ(i + 1, c, c * cg, c * cb);
      const er = eg * f, eg2 = er * (0.2 + 0.75 * ewh), eb = er * (0.33 + 0.6 * ewh);
      for (const j of [2, 3, 4, 5]) col.setXYZ(i + j, er, eg2, eb);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
    // ---- the fire: tongues on fixed rows down the stretch, thinner far away (rows fade, never pop)
    const cs = api.tier === 0 ? 2.9 : api.tier === 1 ? 2.2 : 1.7;
    const lick = e.state === 2 ? 0 : 0.07 + 0.05 * pre;  // before the eruption: small licks on the band
    const hh = Math.max(lick, e.h);
    const camX = ship.x * 0.8, camZ = 9.2;
    const t = e.t;
    if (hh > 0.001) {
      const r0 = Math.max(0, Math.floor(ua / ROW)), r1 = Math.floor(ub / ROW);
      for (let r = r0; r <= r1; r++) {
        const u = r * ROW + 1.3, z = e.near - u;
        if (z > 9 || z < -SPAWN_D || u > e.len) continue;
        let lod = 1;
        if (r % 2) lod *= 1 - smoothstep(-70, -100, z);
        if (r % 4 === 2) lod *= 1 - smoothstep(-190, -240, z);
        if (r % 8 === 4) lod *= 1 - smoothstep(-380, -460, z);
        const ap = appear(z) * fi, f = lod * ap * fogFade(z) * (1 - smoothstep(-2, 7, z));
        if (f < 0.01) continue;
        const [L, R] = e.band(u), w = R - L, n = Math.max(1, Math.round(w / cs)), step = w / n;
        const y0 = yb(z);
        for (let c = 0; c < n; c++) {
          const id = r * 31 + c * 7, x = L + step * (c + 0.5) + Math.sin(id * 1.7) * step * 0.25;
          let H = Math.abs(top - y0) * hh * (0.78 + 0.16 * Math.sin(t * 9 + id * 1.3) + 0.07 * Math.sin(t * 23 + id * 4.1));
          const blk = e.h > 0 ? blockAt(x, z, e.from) : null;
          if (blk !== null) H = Math.min(H, Math.max(0.2, Math.abs(blk - y0) - 0.35));
          const W = step * 1.55 * (0.85 + 0.15 * Math.sin(id));
          const b = f * (0.5 + 0.5 * hh) * (blk !== null ? 1.15 : 1);
          qA.setFromEuler(eul.set(0, Math.atan2(camX - x, camZ - z), 0));
          tongues.put(x, y0, z, qA, W * ap, H * dir * ap, 1, hex(b, b, b));
        }
      }
    }
    // ---- the rules at the ship's plane
    const u0 = e.near;
    if (u0 >= 0 && u0 <= e.len && e.h > 0.55) {
      const [L, R] = e.band(u0);
      const inBand = ship.x > L + 0.25 && ship.x < R - 0.25;
      const shade = inBand && sheltered(ship.x, ship.y, 0, e.from);
      for (const r of rafts) if (r.from === e.from && r.near - r.len < 0 && r.near > -e.len) r.heat = Math.max(r.heat, e.h);
      if (inBand && !shade) {
        G.crash({ kind: e.kind, type: 'l4-flare', x: ship.x, y: ship.y, z: 0 }, 16, true);
        e.burnHit = true;
      } else {
        // the risk line: close to the fire, not in it
        const d = shade ? insideBy(ship.x, ship.y, 0, e.from) : Math.min(Math.abs(ship.x - L), Math.abs(ship.x - R));
        if (d >= 0 && d < 1.4) {
          e.skim += dt;
          if (e.skim >= 0.25) { e.skim -= 0.25; G.score(40 * G.mult * (1 + (1.4 - d)), ship.x, ship.y + 1, 0, 'mag', 'SKIM'); G.greed(2.5); }
        }
        if (shade) { e.shadeT += dt; if (e.shadeT > 0.25 && !e.paidShade) { e.paidShade = true; G.score(200 * G.mult, ship.x, ship.y + 1.6, 0, 'cyan', 'SHADE'); G.greed(4); } }
      }
    }
    if (e.near - e.len > 12) e.alive = false;
  },
});
