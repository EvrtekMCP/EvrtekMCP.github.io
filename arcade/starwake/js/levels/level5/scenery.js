// LEVEL 5, ION STORM: the scenery. Every piece stays outside the flight box and off the reserved hues (rule 9):
// the storm is violet and white, its far lightning violet-white with no red in it, so only an arc that can hurt
// you ever shows the red fringe.
//   l5-field   a stream of ion pylons standing off the lane, some in pairs with a soft arc that fires on a beat,
//              some high pairs whose arc jumps clean over the lane (Yori's mood frame)
//   l5-sky     the storm's far lightning: big bolts deep in the haze on the bar lines, and the flash behind them
//   l5-crown   the landmark: the STORMCROWN, a turning column of storm cloud on the horizon, lit from inside;
//              it rises in the quiet cell and stands over the lightning wall at the end
import { THREE, TX, defineScenery, GlowPoints, clamp } from '../../api.js?v=0.4.0';
import { ArcLayer } from './arcs.js?v=0.4.0';
import { beatAt } from './track.js?v=0.4.0';

const side = (R, lo, hi) => R.sign() * R.range(lo, hi);
// ---- the pylon stream (l5-pylon and l5-pair are course decor, in storm.js)
export const field = defineScenery({
  name: 'l5-field',
  stream: {
    every: [20, 38],
    place: (R, api) => {
      const B = api.box, r = R();
      if (r < 0.22) { // a high pair: two pylons either side, an arc over the lane well above the box
        const y = R.range(B.y * 3.6, B.y * 6), w = R.range(B.x * 2.2, B.x * 4);
        return { type: 'l5-pair', x: -w, y, bx: w * R.range(0.8, 1.2), by: y + R.range(-4, 4), dz: R.range(-10, 10), every: 8, off: R.int(0, 7), s: R.range(0.9, 1.3) };
      }
      if (r < 0.5) { // a pair off to one side
        const sd = R.sign(), x = sd * R.range(B.x * 1.9, B.x * 3.4), y = R.range(-B.y * 1.6, B.y * 1.6);
        return { type: 'l5-pair', x, y, bx: x + sd * R.range(10, 24), by: y + R.range(-8, 8), dz: R.range(-20, 20), every: 4 * R.int(1, 2), off: R.int(0, 7), s: R.range(0.8, 1.2) };
      }
      return { type: 'l5-pylon', x: side(R, B.x * 1.8, B.x * 5.5), y: R.range(-B.y * 2.5, B.y * 2.5), s: R.range(0.7, 1.4), yaw: R.range(0, 6) };
    },
  },
});

// ---- the far lightning
export const sky = defineScenery({
  name: 'l5-sky',
  ease: 0.8,
  init(api) {
    const L = new ArcLayer(api.scene, 900);
    L.mat.uniforms.uFade.value.set(5000, 6000); L.mat.uniforms.uMinPx.value = 1.2; L.mesh.renderOrder = -4;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xb8a0ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    glow.renderOrder = -6; glow.scale.set(700, 500, 1); glow.position.set(0, 60, -950); api.scene.add(glow);
    return { L, glow, bolts: [], lastBeat: -1, flash: 0 };
  },
  update(s, w, dt, api) {
    const b = Math.floor(beatAt(api.time));
    // on some beats a bolt or two, deep in the haze; the ONE of a bar more often than not
    if (b !== s.lastBeat) {
      s.lastBeat = b;
      const h = (((b + 7) * 2654435761) >>> 0) / 4294967296, one = ((b % 4) + 4) % 4 === 0;
      if (w > 0.05 && h < (one ? 0.7 : 0.18)) {
        const n = h < 0.2 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const k = ((b * 31 + i * 17) * 2654435761 >>> 0) / 4294967296, x = (k - 0.5) * 900, top = 160 + k * 120;
          s.bolts.push({ ax: x, ay: top, bx: x + (k - 0.3) * 160, by: -40 - k * 80, z: -780 - k * 160, t: 0, seed: b * 13 + i });
        }
        s.flash = Math.max(s.flash, one ? 1 : 0.6);
      }
    }
    const L = s.L; L.begin(api.focalPx);
    for (let i = s.bolts.length - 1; i >= 0; i--) {
      const q = s.bolts[i]; q.t += dt;
      const a = (q.t < 0.08 ? 1 : Math.max(0, 1 - (q.t - 0.08) / 0.22)) * w * (0.75 + 0.25 * Math.sin(q.t * 90));
      if (a <= 0) { s.bolts.splice(i, 1); continue; }
      L.bolt(q.ax, q.ay, q.z, q.bx, q.by, q.z, q.seed + Math.floor(q.t * 25), { segs: 14, amp: 0.13, core: [0.92, 0.88, 1, a], coreW: 1.4, halo: [0.5, 0.35, 1, 0.4 * a], haloW: 9, fork: 0.9 });
    }
    L.end();
    s.flash = Math.max(0, s.flash - dt * 3.2);
    s.glow.material.opacity = (0.06 + 0.32 * s.flash) * w;
    s.glow.visible = w > 0.003 || s.glow.material.opacity > 0.003;
  },
});

// ---- the landmark: the Stormcrown
export const crown = defineScenery({
  name: 'l5-crown',
  ease: 0.35,
  init(api) {
    const tex = TX.cloud(55);
    const P = new GlowPoints(api.scene, 160, tex);
    P.points.renderOrder = -7;
    const L = new ArcLayer(api.scene, 400);
    L.mat.uniforms.uFade.value.set(5000, 6000); L.mesh.renderOrder = -5;
    return { P, L, spin: 0, flash: 0, lastBar: -1, bolt: null };
  },
  update(s, w, dt, api) {
    s.spin += dt * 0.12;
    const P = s.P, L = s.L;
    P.setScale(api.focalPx);
    const bar = Math.floor(beatAt(api.time) / 4);
    if (bar !== s.lastBar) { s.lastBar = bar; if (w > 0.05 && ((bar * 2654435761) >>> 0) % 3 === 0) { s.flash = 1; s.bolt = { t: 0, seed: bar, y: 80 + ((bar * 97) % 200) }; } }
    s.flash = Math.max(0, s.flash - dt * 2.4);
    // where it stands: off to the left of the horizon, nearer as the level goes on
    const cx = -230, cz = -930, base = -120;
    P.begin();
    if (w > 0.003) {
      for (let i = 0; i < 120; i++) {
        const t = i / 120, y = base + t * 520, r = 70 + 120 * t * t;
        const a = s.spin * (1 + t * 0.6) + i * 2.39;
        const lit = 0.55 + 0.45 * Math.sin(i * 1.7) + s.flash * (0.6 + 0.4 * Math.sin(i));
        P.push(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r * 0.5, 120 + 90 * t, 0.42 * lit, 0.3 * lit, 0.85 * lit, 0.22 * w);
      }
    }
    P.end();
    L.begin(api.focalPx);
    if (s.bolt && w > 0.003) {
      const q = s.bolt; q.t += dt;
      const a = Math.max(0, 1 - q.t / 0.35) * w;
      if (a > 0) L.bolt(cx - 40, base + q.y + 160, cz + 40, cx + 50, base + q.y, cz + 40, q.seed + Math.floor(q.t * 20), { segs: 12, amp: 0.2, core: [0.95, 0.9, 1, a], coreW: 1.6, halo: [0.55, 0.4, 1, 0.45 * a], haloW: 10, fork: 1 });
      else s.bolt = null;
    }
    L.end();
  },
});
