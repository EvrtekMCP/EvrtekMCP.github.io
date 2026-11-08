// THE HIGH ROLLER (galaxy 3, level 9's boss; the plan's 4.9). Yori's carnival wheel the size of a moon (g3-bosses.js
// rollerRim, rollerSpokes, rollerSegment, rollerHub): a steel rim lit like a marquee, twelve wedge segments, and a core
// of light behind a six-blade iris. It's arcade, all score, never money.
// WHAT MAKES IT A NEW KIND OF FIGHT: it only plays when you bet. Its core opens only while your GREED is lit (the
// iris swings open as you cash in), its volleys are graze-rich so the meter fills fast, and rings don't heal you while
// GREED runs, so every move in the fight is a risk. Deflect-only, as every boss: its own bolts, sent home to an open
// core, are the only damage. A shot sent home while the iris is shut glances off: CLANG.
//   PHASE 1, THE ANTE   one segment at a time turns to face you, its bar goes red, and it fires a CURTAIN (a line of
//                       bolts across the lane with a gap near you: thread it for grazes, roll through it to send the
//                       bolts either side home). Graze to fill the meter; cash in and the core opens.
//   PHASE 2, THE RAISE  the wheel spins up. Segments light amber (they pay out a shower of bonus rings: extras, never a
//                       star) or red (they fire a riveter string of three at you, one bolt every three beats).
//   PHASE 3, ALL IN     the shortest. The whole rim flashes white, and it lights YOUR GREED itself and keeps it lit:
//                       everything x2 and no healing, for both of you (its bolts hit twice as hard; every bolt you send
//                       home counts twice). Three volleys from every red segment at once, its core wide open.
//   JACKPOT             beaten: the wheel bursts into a shower of bonus rings.
//   CASHES OUT          not beaten in about 120 s: it spins down and leaves, with no bonus (rule 26).
// Everything fires on the beat of its own track (audio/g3/bosses/high-roller, 150 bpm), counted from its bar lines.
import { THREE, defineBoss, buildModel, material, clamp, damp } from '../../api.js?v=0.4.0';
import { MESH } from './mesh.js?v=0.4.0';
import { CURTAIN_T, lineOfBolts } from '../../enemies/g3-riveter/index.js?v=0.4.0';

const SCALE = 2.2, HOLD = 140, HP = 18, BEATS_IN = 16;   // it flies in over the four bars of its track's Impact
const SEGS = 12, MUZZLE_R = 12.8, TAU = Math.PI * 2;
const tmpV = new THREE.Vector3();

// the iris: her hub shut (rollerHub(0)) morphing to open (rollerHub(1)): same faces, same order
function hubModel() {
  const g = new THREE.Group();
  MESH.hub0.forEach((grp, i) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(grp.p, 3));
    geo.morphAttributes.position = [new THREE.Float32BufferAttribute(MESH.hub1[i].p, 3)];
    geo.computeVertexNormals(); geo.computeBoundingSphere();
    g.add(new THREE.Mesh(geo, material(grp.color, grp.glow)));
  });
  return { g, set(k) { for (const m of g.children) m.morphTargetInfluences[0] = k; } };
}

function build(api, b) {
  const root = new THREE.Group(), flip = new THREE.Group(); flip.rotation.y = Math.PI; root.add(flip);   // her face to you
  const rim = buildModel(MESH.rim, { own: ['#ffe0a0*', '#ffffff*'] });
  flip.add(rim.group, buildModel(MESH.spokes).group);
  const wheel = new THREE.Group(); flip.add(wheel);
  // twelve segment slots, each holding her three states (dark, amber payout, red fire); one shows at a time
  const slots = [];
  for (let i = 0; i < SEGS; i++) {
    const s = new THREE.Group(); s.rotation.z = i / SEGS * TAU;
    const st = [MESH.seg0, MESH.seg1, MESH.seg2].map((m, k) => { const o = buildModel(m).group; o.visible = k === 0; s.add(o); return o; });
    wheel.add(s); slots.push({ g: s, st, state: 0 });
  }
  const hub = hubModel(); flip.add(hub.g);
  b.parts = { rim, wheel, slots, hub, flip };
  b.spin = 0; b.spinV = 0.12; b.iris = 0; b.seg = new Array(SEGS).fill(0);
  return {
    root,
    // the core, behind the iris (her HIGHROLLER.weak, turned to face you)
    weak: [{ at: [0, 0, 2.3], r: 3.4, hp: HP }],
    muzzles: Array.from({ length: SEGS }, () => [0, 0, 0]),
  };
}

// segment i's muzzle in the boss's own (root) frame, where the wheel has turned it
function muzzleLocal(b, i, out) {
  const a = i / SEGS * TAU + b.spin; out[0] = -Math.cos(a) * MUZZLE_R; out[1] = Math.sin(a) * MUZZLE_R; out[2] = 0.9; return out;
}
function muzzleWorld(b, i) { const m = muzzleLocal(b, i, [0, 0, 0]); tmpV.set(m[0], m[1], m[2]); b.root.localToWorld(tmpV); return { x: tmpV.x, y: tmpV.y, z: tmpV.z }; }
function setSeg(b, i, s) { const sl = b.parts.slots[i]; if (sl.state === s) return; sl.st[sl.state].visible = false; sl.st[s].visible = true; sl.state = s; b.seg[i] = s; }
// the segment nearest an angle on the wheel's face (0 = the 3 o'clock side as you see it, counter-clockwise)
function segAt(b, ang) { let best = 0, bd = 9; for (let i = 0; i < SEGS; i++) { const p = muzzleLocal(b, i, [0, 0, 0]), a = Math.atan2(p[1], p[0]); let d = Math.abs(((a - ang) % TAU + TAU + Math.PI) % TAU - Math.PI); if (d < bd) { bd = d; best = i; } } return best; }

// the beat clock of the boss's track: whole beats since its first downbeat
function beatOf(api) {
  const m = api.music && api.music.meta, bpm = (m && m.bpm) || 150, fb = (m && m.firstBeat) || 0, beat = 60 / bpm;
  const pos = api.music && api.music.position ? api.music.position() : api.time;
  return { i: Math.floor((pos - fb) / beat + 1e-6), beat };
}
// run onBeat(k) once per beat, k counted from the next bar line after the phase began
function sched(b, api, onBeat) {
  const c = beatOf(api);
  if (b.sch.origin === null) b.sch.origin = (Math.floor(c.i / 4) + 1) * 4;
  if (c.i === b.sch.last) return;
  b.sch.last = c.i;
  const k = c.i - b.sch.origin; if (k >= 0) onBeat(k, c.beat);
}
const aim = (api, lead = 0.2) => [clamp(api.ship.x + api.ship.vx * lead, -api.box.x, api.box.x), clamp(api.ship.y + api.ship.vy * lead, -api.box.y, api.box.y)];

// THE CURTAIN (as the Vault's curtain rigs fire it: the level taught it, rule 27): a line of bolts across the lane at
// your height (from a bottom or top segment) or down it at your side (from a side segment), with one gap near you
function curtain(b, api, i, alongY) {
  const B = api.box, from = muzzleWorld(b, i), [ax, ay] = aim(api), gap = 2.6, step = 1.0, span = alongY ? B.y : B.x, at = alongY ? ay : ax;
  const off = (b.curtainN++ % 2 ? 1 : -1) * 0.5, g = clamp(at + off, -span + gap / 2, span - gap / 2);
  for (const p of lineOfBolts(span, g, gap, step)) api.fire(from, alongY ? ax : p, alongY ? p : ay, { T: CURTAIN_T, owner: b, dmg: b.dmg });
  api.game.sfx('g3-rivet', { vol: 0.9, rate: 0.8 });
}
function bolt(b, api, i, T, skim = 0) { let [tx, ty] = aim(api, 0.25); if (skim) tx = clamp(tx + (tx > 0 ? -skim : skim), -api.box.x, api.box.x); api.fire(muzzleWorld(b, i), tx, ty, { T, owner: b, dmg: b.dmg }); api.game.sfx('g3-rivet', { vol: 0.7, gap: 0.03 }); }
// a SKIM bolt passes 1.3 m beside you, toward the middle: graze it for the meter (or roll it home)
// a payout: a shower of bonus rings out of an amber segment, toward the lane (extras: a cache, never a star)
function payout(b, api, i, n) {
  const B = api.box, m = muzzleWorld(b, i);
  for (let k = 0; k < n; k++) api.spawn({ type: 'g3-vault-ring', payout: true, cache: true, x: m.x, y: m.y, tx: (Math.random() * 2 - 1) * B.x * 0.75, ty: (Math.random() * 2 - 1) * B.y * 0.7 }, m.z - k * 9);
  api.game.sfx('g3-jackpot', { vol: 0.45, rate: 1.2 });
}
// a segment's tell: its muzzle glow grows over `secs`
function tell(b, i, k) { const g = b.glows[i]; if (g) { g.material.opacity = Math.max(g.material.opacity, k); g.scale.setScalar(2 + 5 * k); } }

const PHASES = [
  { name: 'THE ANTE', until: 0.66, loop: 99,
    enter(b, api) { b.sch = { origin: null, last: null }; b.spinV = 0.1; b.ante = null; },
    // an 8-beat cycle: a segment turns to you and lights red (beat 0), fires its curtain (beat 3, landing near beat 6),
    // and the next segment round fires a bolt that skims you (beat 6, landing on beat 9): graze-rich, so the meter fills
    update(b, dt, api) {
      sched(b, api, (k) => {
        const c = k % 8, n = Math.floor(k / 8);
        if (c === 0) {
          const ang = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][n % 4];                 // bottom, right, top, left as you see it
          b.ante = { i: segAt(b, ang), axisY: n % 2 === 1, ang, t: 0 };
          for (let i = 0; i < SEGS; i++) setSeg(b, i, 0); setSeg(b, b.ante.i, 2);
          api.game.sfx('g3-wheel-spin', { vol: 0.5 });
        } else if (c === 3 && b.ante) curtain(b, api, b.ante.i, b.ante.axisY);
        else if (c === 6 && b.ante) { setSeg(b, b.ante.i, 0); const beat = beatOf(api).beat; bolt(b, api, (b.ante.i + 1) % SEGS, 3 * beat, 1.3); }
      });
      // the wheel turns the chosen segment to face you, then holds it there
      if (b.ante) { b.ante.t += dt; const p = muzzleLocal(b, b.ante.i, [0, 0, 0]), a = Math.atan2(p[1], p[0]); let d = ((b.ante.ang - a) % TAU + TAU + Math.PI) % TAU - Math.PI; b.spin -= clamp(d, -dt * 2.2, dt * 2.2) * Math.min(1, b.ante.t * 3); if (b.ante.t < 1.2) tell(b, b.ante.i, Math.min(1, b.ante.t / 1.2)); }
    } },
  { name: 'THE RAISE', until: 0.33, loop: 99,
    enter(b, api) { b.sch = { origin: null, last: null }; b.ante = null; for (let i = 0; i < SEGS; i++) setSeg(b, i, 0); api.game.sfx('g3-wheel-spin', { vol: 0.9 }); },
    // a 12-beat cycle: a red segment fires a string of four (beats 0, 3, 6, 9: each lands three beats later, so one note
    // every three beats without a break), an amber
    // one pays out a shower (beat 7)
    update(b, dt, api) {
      b.spinV = damp(b.spinV, 0.75, 1.2, dt);
      sched(b, api, (k, beat) => {
        const c = k % 12, n = Math.floor(k / 12);
        if (c === 0) { b.red = (n * 5) % SEGS; setSeg(b, b.red, 2); tell(b, b.red, 1); }
        if (c === 0 || c === 3 || c === 6 || c === 9) bolt(b, api, b.red, 3 * beat);
        if (c === 10) setSeg(b, b.red, 0);
        if (c === 4) { b.amber = (b.red + 6) % SEGS; setSeg(b, b.amber, 1); }
        if (c === 7) payout(b, api, b.amber, 5);
        if (c === 9) setSeg(b, b.amber, 0);
      });
      if (b.red !== undefined && b.seg[b.red] === 2) tell(b, b.red, 0.6 + 0.4 * Math.sin(api.time * 9));
    } },
  { name: 'ALL IN', loop: 99,
    enter(b, api) {
      b.sch = { origin: null, last: null }; b.allIn = true; b.dmg = 32; b.flashT = 1.2;
      for (let i = 0; i < SEGS; i++) setSeg(b, i, i % 3 === 0 ? 2 : 0);
      api.game.greedStart(); api.game.flash(); api.game.shake(1);
    },
    // a 16-beat cycle: every red segment glows (beats 0-3), then fires one bolt at once, three volleys a bar apart
    // (beats 3, 7, 11: each lands three beats later, all four together, so one roll takes the volley), then a breath
    update(b, dt, api) {
      if (!api.game.greedOn) api.game.greedStart();        // it keeps your GREED lit (lit again the moment it runs out): all in, for both of you
      b.spinV = damp(b.spinV, 1.3, 1.5, dt);
      sched(b, api, (k, beat) => {
        const c = k % 16;
        if (c === 3 || c === 7 || c === 11) for (let i = 0; i < SEGS; i += 3) bolt(b, api, i, 3 * beat);
      });
      const c = (b.sch.last ?? 0) - (b.sch.origin ?? 0), cc = ((c % 16) + 16) % 16;
      if (cc < 3 || cc === 6 || cc === 10) for (let i = 0; i < SEGS; i += 3) tell(b, i, 0.7 + 0.3 * Math.sin(api.time * 12));
    } },
];

const highRoller = defineBoss({
  name: 'g3-high-roller', title: 'THE HIGH ROLLER',
  hold: HOLD, enterTime: BEATS_IN * 60 / 150, scale: SCALE, y: 0.5,
  escapeAfter: 120, escapeCall: 'IT CASHED OUT', downCall: 'JACKPOT!',
  bonus: 90000, hitPts: 2500, defeatTime: 2.8,
  build,
  // the core shows only while your GREED is lit (or ALL IN holds it open): the iris is the tell
  exposed(b) { return b.iris > 0.65; },
  phases: PHASES,
  enter(b, api) {
    b.dmg = undefined; b.allIn = false; b.curtainN = 0; b.flashT = 0; b.sch = { origin: null, last: null };
    api.game.call('THE ANTE: CASH IN TO OPEN IT', 'c-mag');
    // ALL IN counts every bolt you send home twice ("for both of you"): a second hit through the framework's own rule
    const once = b.hitWeak;
    b.hitWeak = (e, s, a) => { const before = e.wp.hp; once(e, s, a); if (b.allIn && b.state === 'fight' && e.wp.hp < before && e.wp.hp > 0) once(e, s, a); };
  },
  update(b, dt, api) {
    const P = b.parts;
    b.spin += b.spinV * dt; P.wheel.rotation.z = b.spin;
    for (let i = 0; i < SEGS; i++) muzzleLocal(b, i, b.muzzles[i]);
    // the iris: open while your GREED is lit, wide open ALL IN
    const want = b.state === 'fight' && (api.game.greedOn || b.allIn) ? 1 : 0;
    b.iris = damp(b.iris, want, want ? 7 : 4, dt); P.hub.set(b.iris);
    // the marquee: warm and white bulbs trade places like a chase; ALL IN's tell flashes the whole rim white
    b.flashT = Math.max(0, (b.flashT || 0) - dt);
    const ch = 0.5 + 0.5 * Math.sin(api.time * (b.allIn ? 14 : b.spinV > 0.4 ? 9 : 3)), warm = P.rim.mats['#ffe0a0*'], white = P.rim.mats['#ffffff*'];
    if (b.flashT > 0) { warm.color.setRGB(1, 1, 1); white.color.setRGB(1, 1, 1); }
    else { warm.color.setRGB(1, 0.878, 0.627).multiplyScalar(0.55 + 0.45 * ch); white.color.setRGB(1, 1, 1).multiplyScalar(0.55 + 0.45 * (1 - ch)); }
    // CASHES OUT: it spins down as it leaves
    if (b.state === 'escape') b.spinV = damp(b.spinV, 0, 2, dt);
  },
  defeat(b, api) {
    api.game.sfx('g3-jackpot', { vol: 1 });
    for (let i = 0; i < SEGS; i++) setSeg(b, i, 1);
    // JACKPOT: the wheel bursts into a shower of bonus rings
    for (let i = 0; i < SEGS; i++) payout(b, api, i, 2);
    api.game.burst(b.x, b.y, b.z + 3, 140, { speed: 26, life: 1.1, s0: 2.6, r: 1, g: 0.85, b: 0.35, carry: 0, drag: 1.1 });
  },
});
export default highRoller;
