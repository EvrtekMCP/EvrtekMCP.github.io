// THE LEVIATHAN (level 6 mini-boss): Yori's segmented serpent machine (boss-06 sheet). It has hunted you down the
// canyon; now it has turned. It swims ahead of you down the rift with its head turned back on you, keeping pace,
// its body weaving behind it. Only your own fire sent back hurts it, and only in the ONE lit lens on its back (a red
// lens on a segment, lit and pulsing, a cyan-free target: the shot that goes there is yours). Dead lenses go dark,
// so you can count what is left (Yori). Three phases (rule 24), each with a new thing and a tell:
//   1 THE MAW      the jaws open and the throat blooms red for 0.7 s, then a fan of five bolts. Roll them home.
//   2 THE SHARDS   adds the shard drop: its tail tips flash ice-white, it flings three ice mines down the canyon; they
//                  drift back into your lane and pop. Their shards, rolled back, go to its lens too.
//   3 THE WALL SLAM it slams its head into the canyon walls: ice falls into the lane on that side (dodge it), and the
//                  maw keeps firing. Shorter than phase 2.
// It always fires on a two- or three-bar loop at 135 bpm (rules 26 and 28). 0.6.0 (Evrtek 11-10: no level has a timer):
// it no longer dives away on a clock; the fight ends when it is beaten.
// 0.3.0, the human pass (Evrtek 11-06, "make them easier"): it was the steepest step on the curve, pressure with no let-up
// (one calm moment in a 66 s fight). Now every loop ends in a BREATHER, one whole bar (1.78 s) with nothing fired, so
// its rhythm stays on the bar lines; THE SHARDS throws one beat earlier so its ice has landed before the breather; the
// maw's fan, its harshest volley, flies 15% slower; and each lens takes LENS_HP hits (was 8), so the fight, with fewer
// volleys to send back, is no longer than it was.
import { THREE, defineBoss, clamp, damp, smoothstep, SPAWN_D } from '../../api.js?v=0.6.0';
import { Serpent, LEV } from './serpent.js?v=0.6.0';

const BAR = 4 * 60 / 135, BEAT = BAR / 4;
const BREATHER = 1; // bars of calm at the end of every loop (0.3.0)
const SEGS = 6, LENS_HP = 4;
const tmpV = new THREE.Vector3();

// ---- its attacks
// THE MAW: five bolts fanned across 4.4 m round where you are heading, so one roll in the middle sends all five home
function maw(b, api, o) {
  b.jawSnap = 1;
  const m = muzzle(b), tx = clamp(api.ship.x + api.ship.vx * 0.15, -api.box.x, api.box.x), ty = clamp(api.ship.y + api.ship.vy * 0.15, -api.box.y, api.box.y);
  const n = o.n || 5, w = o.spread || 4.4;
  for (let i = 0; i < n; i++) { const k = i / (n - 1) - 0.5; api.fire(m, clamp(tx + k * w, -api.box.x, api.box.x), ty + Math.abs(k) * 0.6, { T: o.T || 1.5, owner: b }); } // 0.3.0: 1.5 s (was 1.3)
  api.game.sfx('fire', { rate: 0.55, vol: 1 });
}
// THE SHARD DROP: three ice mines flung from the tail, down the canyon, onto your line one after another
function shardDrop(b, api) {
  const S = b.S, tail = S.items[S.items.length - 1].obj;
  tmpV.set(0, 0, 0); tail.updateMatrixWorld(true); tail.getWorldPosition(tmpV);
  const sx = api.ship.x, sy = api.ship.y, side = b.slamSide || 1;
  const spots = [[sx, sy], [clamp(sx + side * 4.8, -api.box.x * 0.9, api.box.x * 0.9), sy * 0.5], [clamp(sx - side * 3.2, -api.box.x * 0.9, api.box.x * 0.9), clamp(sy + 2.2, -api.box.y * 0.8, api.box.y * 0.8)]];
  spots.forEach(([x, y], i) => {
    api.spawn({ type: 'ice-mine', owner: b, fling: { x: tmpV.x, y: tmpV.y, z: tmpV.z, to: [x, y, -300 - i * 70], t: 0.8 + i * 0.12 } }, tmpV.z);
  });
  b.tipsT = 0.5; b.slamSide = -side;
  api.game.sfx('boom', { rate: 1.6, vol: 0.5 });
}
// THE WALL SLAM: the head swings into a wall; a slab of it falls into the lane on that side, ahead of you
function wallSlam(b, api) {
  const side = b.slamSide = -(b.slamSide || 1);
  b.slamT = 0; b.slamTo = side;
  api.spawn({ type: 'l6-icefall', side, to: side * 0.12, fall: 1.0 }, -300);
  api.spawn({ type: 'l6-icefall', side, to: side * 0.3, fall: 1.1 }, -380);
  api.game.shake(0.7); api.game.sfx('boom', { rate: 0.5, vol: 1 });
}
function muzzle(b) { return { x: b.mz.x, y: b.mz.y, z: b.mz.z }; }

// a spine by arc length: sample curve(u) from u = -3 to 46, measure it, and return spine(s) = the point s units along
// it from u = 0 (s < 0 runs back past the snout)
const SPN = 160, U0 = -3, U1 = 46;
function arcSpine(curve, A) {
  let acc = 0, zeroAt = 0, px = 0, py = 0, pz = 0;
  for (let i = 0; i < SPN; i++) {
    const u = U0 + (U1 - U0) * i / (SPN - 1), p = curve(u);
    if (i) acc += Math.hypot(p[0] - px, p[1] - py, p[2] - pz);
    A.u[i] = u; A.s[i] = acc; A.p[i * 3] = p[0]; A.p[i * 3 + 1] = p[1]; A.p[i * 3 + 2] = p[2];
    if (u <= 0) zeroAt = acc;
    px = p[0]; py = p[1]; pz = p[2];
  }
  return (s) => {
    const want = zeroAt + s;
    let lo = 0, hi = SPN - 1;
    if (want <= A.s[0]) hi = 1; else if (want >= A.s[SPN - 1]) lo = SPN - 2;
    else while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A.s[m] < want) lo = m; else hi = m; }
    const f = (want - A.s[lo]) / ((A.s[hi] - A.s[lo]) || 1);
    return [A.p[lo * 3] + (A.p[hi * 3] - A.p[lo * 3]) * f, A.p[lo * 3 + 1] + (A.p[hi * 3 + 1] - A.p[lo * 3 + 1]) * f, A.p[lo * 3 + 2] + (A.p[hi * 3 + 2] - A.p[lo * 3 + 2]) * f];
  };
}

export default defineBoss({
  name: 'leviathan', title: 'THE LEVIATHAN',
  hold: 52, enterTime: 4.5, scale: 2.8, y: -0.8,
  bonus: 60000, hitPts: 2500,
  pointDown: 'LENS DOWN!', downCall: 'THE LEVIATHAN FALLS!',
  build(api, b) {
    const S = new Serpent(SEGS, 1);
    const root = new THREE.Group(); root.add(S.root);
    b.S = S; b.mz = new THREE.Vector3(0, 0, -60);
    // her lenses are the weak points; their positions are refreshed every frame as the body bends
    const weak = [];
    for (let i = 0; i < SEGS; i++) weak.push({ at: [0, LEV.lensY, LEV.seg(i)], r: 2.6, hp: LENS_HP });
    b.lensAt = weak.map((w) => w.at);
    b.spine = (s) => [0, 0, -s];
    S.pose(b.spine);
    return { root, weak, muzzles: [[0, 0, 2.9]] };
  },
  // rule 25: only the first live lens, front to back, is lit and hittable
  exposed(b, w) { return w.i === b.litIndex; },
  phases: [
    { name: 'THE MAW', until: 0.67, loop: (2 + BREATHER) * BAR,
      pattern: [{ at: 1.0, attack: maw, tel: 0.7, n: 5 }, { at: 2.75, attack: 'aimed', n: 3, gap: 0.2, T: 1.3, tel: 0.8 }] },
    { name: 'THE SHARDS', until: 0.34, loop: (3 + BREATHER) * BAR,
      pattern: [{ at: 1.0, attack: maw, tel: 0.7, n: 5 }, { at: 2.4 - BEAT, attack: shardDrop, tel: 0.6 }, { at: 4.4 - BEAT, attack: 'aimed', n: 2, gap: 0.25, T: 1.3, tel: 0.8 }] },
    { name: 'THE WALL SLAM', loop: (2 + BREATHER) * BAR,
      pattern: [{ at: 0.5, attack: wallSlam, tel: 0.8 }, { at: 2.2, attack: maw, tel: 0.7, n: 5 }] },
  ],
  enter(b, api) { b.litIndex = 0; b.sway = 0; b.jawSnap = 0; b.tipsT = 0; b.slamT = 9; b.slamTo = 0; b.thrash = 0; b.headX = 0; },
  update(b, dt, api) {
    const S = b.S, t = b.t + (b.fightT || 0);
    // which lens is lit: the first one still alive
    b.litIndex = b.weak.findIndex((w) => w.hp > 0);
    // ---- where it is: ahead, keeping pace; the head drifts after you (slowly, so the fan stays readable)
    const slam = b.slamT < 1.2 ? Math.sin(clamp(b.slamT / 1.2, 0, 1) * Math.PI) : 0;
    b.slamT += dt;
    if (b.state === 'fight' || b.state === 'enter') {
      b.headX = damp(b.headX, clamp(api.ship.x * 0.55, -api.box.x * 0.6, api.box.x * 0.6) + b.slamTo * slam * (api.box.x + 2), 1.6, dt);
      b.x = b.headX; b.y = -0.8 + clamp(api.ship.y * 0.25, -1, 1);
    }
    // ---- the spine (in its own units; the framework scales them): the head faces you, the neck runs straight back,
    // then the body coils across the cavern in a wide travelling S, so you see it broadside and every lens is in view.
    // The curve is re-measured by arc length every frame, so the parts never pull apart however hard it bends.
    b.thrash = Math.max(0, b.thrash - dt * 1.5);
    const amp = 5.2 + b.thrash * 1.6, w = 0.9 + b.thrash * 2.5;
    const dying = b.state === 'dying' ? clamp(b.t / 2.8, 0, 1) : 0;
    const curve = (u) => {
      const env = smoothstep(1, 7, u);
      const x = amp * env * Math.sin(u * 0.2 - t * w + 0.4) - b.slamTo * slam * env * 2.5;
      const y = 1.2 * smoothstep(0, 6, u) + env * (2.4 * Math.sin(u * 0.15) + 0.5 * Math.sin(u * 0.3 - t * 1.6)) - dying * u * 0.35;
      return [x, y, -u * 0.55];
    };
    b.spine = arcSpine(curve, b.arc ||= { u: new Float32Array(SPN), s: new Float32Array(SPN), p: new Float32Array(SPN * 3) });
    S.pose(b.spine);
    // ---- the head's tell: the jaws open and the throat blooms over the maw's telegraph, then snap
    let bloom = 0;
    const ph = b.phase, loop = ph && ph.loop;
    if (b.state === 'fight' && ph) for (const st of ph.pattern) {
      if (st.attack !== maw) continue;
      const tel = st.tel ?? 0.9, into = ((b.loopT - (st.at - tel)) % loop + loop) % loop;
      if (into < tel) bloom = Math.max(bloom, into / tel);
    }
    b.jawSnap = Math.max(0, b.jawSnap - dt * 3);
    S.setJaw(Math.max(bloom, b.jawSnap * 0.8) + 0.08 * Math.sin(t * 3));
    S.setThroat(Math.max(bloom, b.jawSnap));
    // the tail tips flash ice-white before a shard drop (and while it flings)
    let tips = Math.max(0, b.tipsT); b.tipsT -= dt;
    if (b.state === 'fight' && ph) for (const st of ph.pattern) {
      if (st.attack !== shardDrop) continue;
      const tel = st.tel ?? 0.9, into = ((b.loopT - (st.at - tel)) % loop + loop) % loop;
      if (into < tel) tips = Math.max(tips, (Math.floor(into * 12) % 2) ? 1 : 0.4);
    }
    S.setTips(clamp(tips, 0, 1));
    // the joints run red head to tail
    for (let i = 0; i < SEGS; i++) S.setJoint(i, 0.32 + 0.2 * Math.sin(t * 6 - i * 0.9) + b.thrash); // dim, so the lit lens is the brightest thing on it
    // ---- the lenses: lit (pulsing), waiting (dim), dead (dark), hit (white)
    for (const wk of b.weak) {
      const lit = wk.i === b.litIndex && b.state === 'fight';
      S.setLens(wk.i, wk.hp <= 0 ? 'dead' : wk.flash > 0.3 ? 'hit' : lit ? 'lit' : 'idle', 0.5 + 0.5 * Math.sin(b.t * 9));
      S.lensAt(wk.i, tmpV); wk.at[0] = tmpV.x; wk.at[1] = tmpV.y; wk.at[2] = tmpV.z;
      if (wk.glow) wk.glow.scale.setScalar(lit ? 9 + 2 * Math.sin(b.t * 9) : 3.5);
    }
    // ---- the muzzle: its throat, wherever the head is turned
    const head = S.head.group; head.updateMatrix();
    tmpV.set(0, 0, -2.9).applyMatrix4(head.matrix);
    b.muzzles[0][0] = tmpV.x; b.muzzles[0][1] = tmpV.y; b.muzzles[0][2] = tmpV.z;
    if (b.glows && b.glows[0]) b.glows[0].position.copy(tmpV);
    b.root.updateMatrixWorld(true);
    b.mz.copy(tmpV); b.root.localToWorld(b.mz);
    // escaping: it dives into the floor of the rift
    if (b.state === 'escape') b.y -= dt * 10;
  },
  onWeakDown(b, w, api) {
    b.thrash = 1;
    api.game.shake(0.9); api.game.sfx('boom', { rate: 0.6, vol: 1 });
    tmpV.set(w.at[0], w.at[1], w.at[2]); b.root.localToWorld(tmpV);
    api.game.burst(tmpV.x, tmpV.y, tmpV.z, 50, { speed: 18, life: 0.8, s0: 2.2, r: 1, g: 0.5, b: 0.35, carry: 0, drag: 1.4 });
  },
  defeat(b, api) { b.thrash = 2; },
});
