// THE THRUMMER (galaxy 2, the Drumreef's headline: "Roll through a pulse just as it meets you."). Yori's barrel-coral
// drum with a grafted red membrane. It stands on the reef beside the lane. Its tell: the membrane swells and glows over
// one bar with a rising thrum. Then it beats, on the bar line, and sends a PULSE: a red ring-wall that rushes up the
// lane and fills the box, and meets the ship on a later bar line. Two answers:
//  - fly through its HOLE, a dark arc in the wall (early pulses; the rings sit in it), or
//  - ROLL as the front meets you: PARRY! The wall splits round you and a cyan echo runs back up it to the drum and cracks
//    its graft (api.game.counter: it counts as a deflect). The front goes white-hot in its last 0.2 s: that is the cue.
// It is fire, not a solid thing: Phase does not pass it, a current does not move it.
//   add(d, 'g2-thrummer', { nx, ny, s, pulses: [{ beat, meet, tell, hole: { a, w } | null }] })
//     beat, meet: course metres of the bar lines it beats on and the front meets the ship on (the level lays them in
//     bars); tell: metres of its one-bar swell; hole.a: the hole's angle (radians, 0 = right, PI/2 = up), hole.w: its
//     width, one of HOLES (Yori's three pulse rings). d is where the drum stands: past the meet, so it is seen ahead.
// The Whirlmaw's heartbeat uses the same pulse in time mode (api.spawn a 'g2-thrummer-pulse' with mode: 'time').
import { THREE, defineEnemy, buildModel, clamp, smoothstep } from '../../api.js?v=0.6.1';
import { MESH } from './mesh.js?v=0.6.1';

export const HOLES = { 1.2: 'hole12', 1.7: 'hole17', 2.3: 'hole23' };
const RED = new THREE.Color(0xff3355), HOT = new THREE.Color(0xffffff), tmpC = new THREE.Color();
const R_WALL = 12, R_IN = 1.5;           // the wall's rim (Yori's pulseRing radius) and its solid middle
const PULSE_DMG = 14;
const up = new THREE.Vector3(0, 1, 0), tmpV = new THREE.Vector3();

let skinGeoReady = false;
function makeDrum() {
  const g = new THREE.Group();
  const body = buildModel(MESH.body); g.add(body.group);
  const skin = buildModel(MESH.skin, { own: ['#ff3355*'] }); g.add(skin.group);
  let mesh = null; skin.group.traverse((o) => { if (o.isMesh) mesh = o; });
  if (!skinGeoReady) { mesh.geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(MESH.skinMorph[0], 3)]; skinGeoReady = true; }
  mesh.updateMorphTargets(); mesh.frustumCulled = false;
  const mat = skin.mats['#ff3355*']; mat.transparent = true;
  g.userData = { skin: mesh, mat };
  return g;
}

export default defineEnemy({
  name: 'g2-thrummer',
  // its warning is the pulse's flight, from the beat (the front is in view from then) to the meet, at the speed flown
  hazard: { cls: 'sweep', introduced: [2, 3], warn: (ev, v) => Math.min(...(ev.pulses || [{ beat: 0, meet: 9e9 }]).map((p) => (p.meet - p.beat) / v)) },
  sample: { pulses: [] },
  targetable: (e) => !e.freed,
  killPts: 1200,
  spawn(e, ev, api) {
    e.obj = api.course.get('g2-thrummer', makeDrum);
    const s = ev.s || 3; e.sx = e.sy = e.sz = s; e.r = 1.8 * s; e.hitR = 1.8 * s;
    e.freed = false; e.next = 0; e.swell = 0; e.flash = 0; e.thrumSaid = -1;
    const u = e.obj.userData; u.mat.opacity = 1; u.mat.color.copy(RED); u.skin.visible = true; u.skin.morphTargetInfluences[0] = 0;
    // its skin faces the lane (and a little toward the ship), so the swell reads from the cockpit
    tmpV.set(-e.x, -e.y, 30).normalize(); e.obj.quaternion.setFromUnitVectors(up, tmpV);
  },
  update(e, dt, api) {
    const ev = e.ev, u = e.obj.userData, cd = (ev.d || 0) + e.z;     // where the course is, from the drum's own place
    const P = ev.pulses || [];
    e.swell = Math.max(0, e.swell - dt * 4);
    if (!e.freed && !ev.warm) {
      while (e.next < P.length) {
        const p = P[e.next];
        // a beat already well behind (a run that starts past it: a dev jump) is let go, never fired without its warning
        if (cd > p.beat + (p.meet - p.beat) * 0.3) { e.next++; continue; }
        if (cd >= p.beat) {
          e.next++; e.swell = 1; e.flash = 1;
          api.spawn({ type: 'g2-thrummer-pulse', x: e.x, y: e.y, drum: e, drumD: ev.d, beat: p.beat, meet: p.meet, hole: p.hole || null, mode: 'course' }, e.z);
          api.game.sfx('g2-pulse', { pan: clamp(e.x / api.box.x, -1, 1) * 0.5 });
          continue;
        }
        const tell = p.tell || 160;
        if (cd >= p.beat - tell) { e.swell = Math.max(e.swell, smoothstep(p.beat - tell, p.beat, cd)); if (e.thrumSaid !== e.next) { e.thrumSaid = e.next; api.game.sfx('g2-thrum', { vol: 0.8, pan: clamp(e.x / api.box.x, -1, 1) * 0.5 }); } }
        break;
      }
    }
    e.flash = Math.max(0, e.flash - dt * 3);
    // the membrane domes up and goes white-hot as it swells (Yori: swell 0..1 whitens the skin toward 60 %)
    u.skin.morphTargetInfluences[0] = e.swell;
    if (!e.freed) u.mat.color.copy(RED).lerp(HOT, 0.6 * e.swell + 0.3 * e.flash);
    else { u.mat.opacity = Math.max(0, u.mat.opacity - dt * 3); u.skin.visible = u.mat.opacity > 0.01; }
    api.pose(e);
    if (e.z > 40) e.alive = false;
  },
  // a sent-back shot or a parry's echo cracks the graft: the skin falls away, the drum is coral again (Yori: freed)
  onShot(e, s, api) {
    if (e.freed) return;
    e.freed = true;
    api.game.kill(e, true);                // the engine frees it: pearl motes, the graft's crack, FREED!
    api.game.burst(e.x, e.y, e.z, 40, { speed: 14, life: 0.7, s0: 1.6, r: 1, g: 0.3, b: 0.35, carry: 1, drag: 1.4 });   // the skin's red shards
  },
  remove(e, api) { api.course.put('g2-thrummer', e.obj); },
});

// ---- THE PULSE: one ring-wall in flight. Born at its drum (or the Whirlmaw's mouth) as a point, it grows as it rushes
// up the lane and settles onto the box's middle, so it never appears at size (ruling 5).
const fillMats = [], fillGeo = {};
function fillGeometry(w) {
  const k = String(w);
  if (!fillGeo[k]) fillGeo[k] = w ? [new THREE.RingGeometry(R_IN, R_WALL, 56, 1, w / 2, Math.PI * 2 - w), new THREE.CircleGeometry(R_IN, 20)] : [new THREE.CircleGeometry(R_WALL, 56)];
  return fillGeo[k];
}
function makePulse(key, w) {
  const g = new THREE.Group();
  const rim = buildModel(MESH[key], { own: ['#ff3355*'] }); g.add(rim.group);
  const fm = new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  for (const geo of fillGeometry(w)) g.add(new THREE.Mesh(geo, fm));
  const rm = rim.mats['#ff3355*']; rm.transparent = true;
  g.userData = { rim: rm, fill: fm };
  fillMats.push(fm);
  return g;
}
const holeKey = (h) => (h ? HOLES[h.w] || 'hole17' : 'ring');
// is (x, y) in the hole (metres; the wall centred on the box's middle)? margin: how far inside its edges
function inHole(h, x, y, margin = 0) {
  if (!h) return false;
  const r = Math.hypot(x, y); if (r < R_IN + 0.72 + margin) return false;
  let da = Math.atan2(y, x) - h.a; da = Math.atan2(Math.sin(da), Math.cos(da));
  return Math.abs(da) < h.w / 2 - Math.asin(Math.min(1, (0.6 + margin) / r));
}
export const pulse = defineEnemy({
  name: 'g2-thrummer-pulse',
  motion: 'own', spawnAt: 'now',
  hazard: null,                       // spawned by its drum (whose hazard holds the warning) or by the Whirlmaw
  targetable: () => false,
  noWarm: false,
  sample: { hole: { a: 0, w: 1.7 }, mode: 'time', T: 1, warm: true },
  spawn(e, ev, api) {
    const key = holeKey(ev.hole);
    e.obj = api.course.get('g2-pulse-' + key, () => makePulse(key, ev.hole ? ev.hole.w : 0));
    e.key = key; e.z0 = e.z; e.x0 = e.x; e.y0 = e.y; e.k = 0; e.done = false; e.after = 0; e.ripple = 0; e.parried = false;
    e.sx = e.sy = e.sz = 1e-4;                           // born a point: the engine poses it once before its first update
    const u = e.obj.userData; u.rim.color.copy(RED); u.rim.opacity = 1; u.fill.opacity = 0.16; u.fill.color.setHex(0xff3355);
    e.obj.rotation.set(0, 0, ev.hole ? ev.hole.a : 0);
  },
  update(e, dt, api) {
    const ev = e.ev, u = e.obj.userData, ship = api.ship;
    if (!e.done) {
      // where the front is: course mode follows the course (the level's bar lines); time mode its own clock (a boss)
      if (ev.mode === 'course') {
        const cd = api.G.courseD;
        e.k = clamp((cd - ev.beat) / Math.max(1, ev.meet - ev.beat), 0, 1);
        const f = ev.drumD - (ev.drumD - ev.meet) * e.k;   // the front's course position, from the drum back to the meet
        e.z = -(f - cd);
        e.tLeft = (ev.meet - cd) / Math.max(1, api.v);
      } else {
        e.k = clamp(e.t / (ev.T || 1.4), 0, 1);
        e.z = e.z0 * (1 - e.k);
        e.tLeft = Math.max(0, (ev.T || 1.4) - e.t);
      }
      if (ev.warm) e.k = 1;
      if (e.k >= 1 && !ev.warm) resolve(e, api);
    } else {
      e.after += dt; e.z += api.v * dt;
    }
    // it grows out of a point and settles onto the box's middle in its first part of the flight
    const g = smoothstep(0, 0.35, e.k), size = ev.warm ? 1 : Math.min(1, e.t / 0.35) ** 2 * (0.15 + 0.85 * g);
    const c = smoothstep(0, 0.5, e.k);
    e.x = e.x0 * (1 - c); e.y = e.y0 * (1 - c);
    e.sx = e.sy = size; e.sz = 1;
    e.obj.position.set(e.x, e.y, e.z); e.obj.scale.set(size, size, 1);
    // the cue: white-hot in its last 0.2 s; after the meet it fades in a blink (red if it hit, cyan if parried)
    const hot = e.done ? 0 : clamp(1 - (e.tLeft || 0) / 0.2, 0, 1);
    if (!e.done) { u.rim.color.copy(RED).lerp(HOT, hot); u.fill.opacity = 0.12 + 0.12 * e.k + 0.1 * hot; }
    else { const f = Math.max(0, 1 - e.after / 0.14); u.rim.opacity = f; u.fill.opacity = 0.3 * f; }
    if (e.ripple > 0) { e.ripple -= dt; api.lens(ship.x, ship.y, -4, 9 * (1 - e.ripple / 0.4) + 2, 0.4 * Math.max(0, e.ripple / 0.4)); }
    if ((e.done && e.after > 0.4 && e.ripple <= 0) || e.z > 14) e.alive = false;
  },
  // the bots: a roll wanted when the front meets (through the hole, if it has one: go there)
  rollAsk(e, api) {
    if (e.done || e.ev.warm) return [];
    const h = e.ev.hole;
    if (!h) return [{ t: e.tLeft, key: 1 }];
    // the hole's spot where the level lays its rings (0.66 of the box out on its axis), and only in the last second, so
    // a pilot following the rings is never pulled off them early
    if (e.tLeft > 1.0) return [];
    return [{ t: e.tLeft, x: Math.cos(h.a) * 0.66 * api.box.x, y: Math.sin(h.a) * 0.68 * api.box.y, r: 2.4, go: true, key: 1 }];
  },
  // and for a pilot who will not roll: keep to the hole's side of the box once it is close
  avoid(e) {
    const h = e.ev.hole; if (!h || e.done || (e.tLeft || 9) > 1.5) return [];
    const B = 40, cut = R_IN + 1.2;
    return [{ x: -Math.cos(h.a) * B, y: -Math.sin(h.a) * B, r: B + cut }];
  },
});
function resolve(e, api) {
  e.done = true;
  const ev = e.ev, ship = api.ship;
  if (ship.rolling) {
    // PARRY! the wall splits round you, the echo runs home to whoever beat it, the screen ripples
    e.parried = true; e.ripple = 0.4;
    api.game.counter({ label: 'PARRY!', target: ev.drum && ev.drum.alive ? ev.drum : null, sfx: 'g2-parry', shake: 0.5, greed: 10, pts: 300 });
    api.game.burst(ship.x, ship.y, -1, 36, { speed: 18, life: 0.45, s0: 1.2, r: 0.35, g: 0.9, b: 1, carry: 0, flatZ: 0.1 });
    const u = e.obj.userData; u.rim.color.setHex(0x53e6ff); u.fill.color.setHex(0x53e6ff);
  } else if (inHole(ev.hole, ship.x, ship.y)) {
    // through the hole; close to its edge is a close call (style)
    if (!inHole(ev.hole, ship.x, ship.y, 0.8)) api.game.scrape(e, 0);
  } else if (!(ship.invuln > 0)) {
    api.game.damage(ev.dmg ?? PULSE_DMG, false);
    api.game.burst(ship.x, ship.y, 0, 22, { speed: 9, life: 0.4, s0: 1.1, r: 1, g: 0.25, b: 0.3, carry: 0.2 });
  }
}
export { inHole };
