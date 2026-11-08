// THE WHIRLMAW (galaxy 2, level 3's boss; the plan's 3.3): Yori's whale-sized filter-feeder, 44 long with a mouth 20
// across, hanging ahead with its mouth open, a grafted jaw-cage of red seams. What makes it a new kind of fight: THE
// ARENA PULLS YOU. Its inhale is a lane-wide current drawing you toward its mouth-line (api.push), where a red whirl
// spins: steer against the boss itself. Its distance is the health bar: every hit knocks it back, every inhale draws it
// in; win by pushing it out of the arena. No galaxy 1 boss moves the player.
// Weak points: four gill-lights along its jaw, lit (green, her colour) only while it exhales (rule 25). Deflect-only:
// its own spit, rolled home, and in phase 2 its own heartbeat, parried. It dives after 110 s if not beaten (rule 26).
//  1 THE INHALE: it breathes in (1.2 s tell: motes stream into its mouth), the pull and the whirl; on the exhale its
//    gills flare and it spits a fan of three. Roll them home.
//  2 THE HEARTBEAT: its heart thrums: pulses from its mouth between the spit volleys. Parry them: the echo hits a gill.
//  3 THE GULP (the shortest): it lunges close, its jaws frame the edges of the box in red; a last spit sequence, while
//    the shoal it was feeding on pours out of its mouth past you: catch them and your shield comes back (rule 7).
// Freed: the graft cracks and falls away (her freed(): silver, seams gone), it rolls over and swims off into the deep.
// Every phase loops on whole bars of its take (g2/bosses/whirlmaw, 136 bpm, 1.765 s a bar): rule 28.
import { THREE, defineBoss, defineDecor, buildModel, GlowPoints, clamp, damp, smoothstep, SHIP_R } from '../../api.js?v=0.5.0';
import { MESH } from './mesh.js?v=0.5.0';

const BAR = 1.76473;                                  // the take's bar (its .json): every loop is whole bars
const GILL_DARK = new THREE.Color(0x1e6a44), GILL_LIT = new THREE.Color(0xd6ffe3);
// Yori's freed(): hunter -> silver, hunterLit -> silverLit, hunterDark -> silverDeep; graft and truss dropped
const FREED = { '#24485a': 0xc8d0dc, '#3f7a8a': 0xeef2ff, '#132a36': 0x8a96a8 };
const HOLD = { far: 92, gain: 70, gulp: 52, draw: 18 };  // station (m): base, pushed back per health lost, the gulp, an inhale's draw
const PULL = 0.3;                                       // the inhale's pull, half-boxes a second toward the mouth-line
const WHIRL_R = 1.0;                                    // the red whirl at the mouth-line (its core, metres)
const FRAME = 0.8;                                      // the gulp: inside this share of the box is clear of the jaws

// the mouth-line hazard and the jaws' frame: one helper on the course just ahead of the ship, so the bots can see it
// (kind.avoid) and it draws the whirl and the frame
let whirlL = null, MOTES = null;
export const maw = defineDecor({
  name: 'g2-whirlmaw-maw',
  motion: 'own', spawnAt: 'now',
  sample: { warm: true },
  init(api) { whirlL = new GlowPoints(api.scene, 900, api.glowTex); },
  begin() { whirlL.begin(); if (MOTES) { MOTES.begin(); MOTES.end(); } },   // the boss refills the motes after this, or they stay empty
  end() { whirlL.end(); },
  spawn(e, ev) { e.b = ev.boss; e.z = -6; e.x = 0; e.y = 0; e.hitAt = -9; e.frameHitT = 0; },
  update(e, dt, api) {
    const b = e.b, B = api.box, ship = api.ship;
    e.z = -6; e.appear = 1;
    if (!b || !b.alive || e.ev.warm) { if (!e.ev.warm) e.alive = false; return; }
    const W = b.whirl || 0, F = b.frame || 0;
    // the whirl: red arms spiralling in to the mouth-line, brighter as the pull peaks
    if (W > 0.01) {
      for (let i = 0; i < 160; i++) {
        const arm = i % 4, u = (i >> 2) / 40, a = arm * Math.PI / 2 + u * 5.5 - (b.t || 0) * 4, r = WHIRL_R * 0.3 + u * Math.min(B.x, B.y) * 0.95;
        whirlL.push(Math.cos(a) * r + b.x * 0.05, Math.sin(a) * r + b.y * 0.05, -2 - u * 6, (0.5 + (1 - u) * 0.9) * W, 1, 0.2, 0.33, (0.25 + 0.6 * (1 - u)) * W);
      }
    }
    // the jaws' frame round the edges of the box
    if (F > 0.01) {
      const n = 40;
      for (let i = 0; i < n; i++) {
        const t = i / n, x = (t * 2 - 1) * B.x * 1.02, y = (t * 2 - 1) * B.y * 1.02, wob = Math.sin(t * 20 + (b.t || 0) * 6) * 0.15;
        whirlL.push(x, B.y * (FRAME + 0.12 + wob * 0.2), -1.5, 1.4 * F, 1, 0.2, 0.33, 0.7 * F); whirlL.push(x, -B.y * (FRAME + 0.12 + wob * 0.2), -1.5, 1.4 * F, 1, 0.2, 0.33, 0.7 * F);
        whirlL.push(B.x * (FRAME + 0.1 + wob * 0.2), y, -1.5, 1.4 * F, 1, 0.2, 0.33, 0.7 * F); whirlL.push(-B.x * (FRAME + 0.1 + wob * 0.2), y, -1.5, 1.4 * F, 1, 0.2, 0.33, 0.7 * F);
      }
    }
    // hurt: the whirl's core while it pulls (once an inhale); the jaws' frame while the gulp lasts (once a second)
    if (b.pulling && W > 0.6 && b.inhaleN !== e.hitAt && Math.hypot(ship.x, ship.y) < WHIRL_R + SHIP_R && !(ship.invuln > 0)) { e.hitAt = b.inhaleN; api.game.damage(9, false); api.game.call('PULLED IN', 'c-red'); }
    e.frameHitT = Math.max(0, e.frameHitT - dt);
    if (F > 0.9 && e.frameHitT <= 0 && (Math.abs(ship.x) > B.x * (FRAME + 0.04) || Math.abs(ship.y) > B.y * (FRAME + 0.04)) && !(ship.invuln > 0)) { e.frameHitT = 1.2; api.game.damage(9, false); }
  },
  // the bots: keep out of the whirl while it pulls, and inside the jaws while they frame the box
  avoid(e) {
    const b = e.b, out = [];
    if (!b || !b.alive) return out;
    if ((b.whirl || 0) > 0.2) out.push({ x: -0.06, y: -0.04, r: WHIRL_R + 1.9 });   // a hair off the middle, so a pilot dead centre is pushed somewhere
    if ((b.frame || 0) > 0.2) { const B = e.B || { x: 7.5, y: 4.3 }, R = 40; out.push({ x: B.x * FRAME + R, y: 0, r: R }, { x: -B.x * FRAME - R, y: 0, r: R }, { x: 0, y: B.y * FRAME + R, r: R }, { x: 0, y: -B.y * FRAME - R, r: R }); }
    return out;
  },
});

// a phase's steps: inhale (tell then pull), exhale (gills lit, the spit), the heartbeat's pulses; times in bars of the take
const spit = (b, api, o) => {                       // a fan of three at you, tight enough that one roll takes all three
  const m = mouth(b), tx = clamp(api.ship.x + api.ship.vx * 0.15, -api.box.x, api.box.x), ty = clamp(api.ship.y + api.ship.vy * 0.15, -api.box.y, api.box.y);
  for (let i = -1; i <= 1; i++) api.fire(m, clamp(tx + i * (o.spread || 1.7), -api.box.x, api.box.x), ty, { T: o.T || 1.3, owner: b });
};
const pair = (b, api, o) => { const m = mouth(b); for (let i = 0; i < 2; i++) b.later(i * 0.3, () => api.fire(m, api.ship.x, api.ship.y, { T: o.T || 1.2, owner: b })); };
const beat = (b, api, o) => {                       // its heart: a pulse out of its mouth, parried home to a lit gill
  const m = mouth(b);
  api.spawn({ type: 'g2-thrummer-pulse', mode: 'time', T: o.T || BAR, x: m.x * 0.3, y: m.y * 0.3, drum: b, hole: o.hole || null, dmg: 9 }, m.z);
  b.heartUntil = b.fightT + (o.T || BAR) + 1.0; api.game.sfx('g2-pulse', { vol: 0.9 });
};
const inhale = (b, api, o) => { b.inhaleT = 0; b.inhaleLen = o.len || 1.8; b.inhaleN = (b.inhaleN || 0) + 1; api.game.sfx('g2-whirlmaw-inhale'); };
const exhale = (b, api, o) => { b.exhaleUntil = b.fightT + (o.len || 2.4); };
function mouth(b) { const v = new THREE.Vector3(0, 0, 14); b.root.localToWorld(v); return { x: v.x, y: v.y, z: v.z }; }

export default defineBoss({
  name: 'g2-whirlmaw', title: 'THE WHIRLMAW',
  hold: HOLD.far, enterTime: 4.5, scale: 1, y: 0,
  escapeAfter: 110, escapeCall: 'IT DIVES INTO THE DEEP',
  bonus: 60000, hitPts: 2500, pointDown: 'GILL OUT!', defeatTime: 3.2,   // galaxy 2: the engine frees it (FREED!, g2-boss-freed, the tally line)
  build(api, b) {
    const root = new THREE.Group(), inner = new THREE.Group(); root.add(inner);
    inner.rotation.y = Math.PI;                         // her mouth faces -Z; turned to face you
    const m = buildModel(MESH.lit, { own: ['#d6ffe3*', '#ff3355*', '#2a2e44', ...Object.keys(FREED)] });
    inner.add(m.group);
    b.mats = m.mats; b.inner = inner;
    // her four gill-lights, turned with the body (x and z flip)
    const weak = [[-9.4, 2.2, -10], [9.4, 2.2, -10], [-9.0, 4.2, -6], [9.0, 4.2, -6]].map((p) => ({ at: [-p[0], p[1], -p[2]], r: 2.0, hp: 4, color: 0xbaffd0 }));
    return { root, weak, muzzles: [[0, 0, 14]] };
  },
  enter(b, api) { b.maw = api.spawn({ type: 'g2-whirlmaw-maw', boss: b }, -6); if (b.maw) b.maw.B = { x: api.box.x, y: api.box.y }; b.knock = 0; b.draw = 0; b.whirl = 0; b.frame = 0; b.exhaleUntil = -1; b.heartUntil = -1; },
  exposed(b, w) { return b.state === 'fight' && (b.fightT < b.exhaleUntil || b.fightT < b.heartUntil); },
  phases: [
    { name: 'THE INHALE', until: 0.66, loop: BAR * 3,
      pattern: [
        { at: 0.05, attack: inhale, len: 1.9, tel: 0 },
        { at: 2.1, attack: exhale, len: 2.9, tel: 0 },
        { at: 2.35, attack: spit, T: 1.3, tel: 0.8 },
      ] },
    { name: 'THE HEARTBEAT', until: 0.33, loop: BAR * 4,
      enter(b, api) { api.game.call('ITS HEART: PARRY THE PULSE', 'c-red'); },
      pattern: [
        { at: 0.05, attack: inhale, len: 1.5, tel: 0 },
        { at: 1.7, attack: exhale, len: 2.6, tel: 0 },
        { at: 1.9, attack: spit, T: 1.25, tel: 0.8 },
        { at: BAR * 2, attack: beat, T: BAR, tel: 0 },
        { at: BAR * 3, attack: beat, T: BAR * 0.75, hole: { a: Math.PI / 2, w: 1.7 }, tel: 0 },
      ] },
    { name: 'THE GULP', loop: BAR * 2,
      enter(b, api) { b.gulping = true; api.game.call('THE GULP: STAY INSIDE ITS JAWS', 'c-red'); },
      pattern: [
        { at: 0.1, attack: exhale, len: BAR * 2, tel: 0 },
        { at: 0.6, attack: spit, T: 1.2, spread: 1.6, tel: 0.7 },
        { at: 2.2, attack: pair, T: 1.2, tel: 0.7 },
      ] },
  ],
  update(b, dt, api) {
    const u = b.mats, fight = b.state === 'fight';
    b.knock = Math.max(0, (b.knock || 0) - dt * 14);
    // the inhale: 1.2 s of tell (motes streaming in), then the pull and the whirl, for the rest of it
    let pulling = false;
    if (fight && b.inhaleT !== undefined && b.inhaleT < b.inhaleLen + 1.2) {
      b.inhaleT += dt;
      pulling = b.inhaleT > 1.2 && b.inhaleT < 1.2 + b.inhaleLen;
    }
    b.pulling = pulling;
    b.whirl = damp(b.whirl || 0, pulling ? 1 : 0, pulling ? 5 : 3, dt);
    b.draw = damp(b.draw || 0, pulling ? HOLD.draw : 0, 2, dt);
    if (pulling) {
      const sx = api.ship.x / api.box.x, sy = api.ship.y / api.box.y, r = Math.hypot(sx, sy);
      if (r > 0.02) api.push(-sx / r * PULL * api.box.x * b.whirl, -sy / r * PULL * api.box.y * b.whirl);
    }
    // its distance is the health bar: pushed back as it loses health, drawn in by an inhale, knocked back by each hit
    const hp = b.hp ? b.hp() : 1;
    if (hp < (b.lastHp ?? 1) - 1e-6) b.knock = Math.max(b.knock, 9);  // every hit knocks it back
    b.lastHp = hp;
    const want = b.gulping ? HOLD.gulp : HOLD.far + HOLD.gain * (1 - hp) - b.draw;
    if (fight) { b.hold = damp(b.hold, want, 1.6, dt); b.z = -(b.hold + b.knock); }
    b.frame = damp(b.frame || 0, b.gulping && fight ? 1 : 0, 3, dt);
    // its gills: dark until it exhales (or its heart beats), then lit green: the weak points (rule 25)
    const lit = fight && (b.fightT < b.exhaleUntil || b.fightT < b.heartUntil);
    b.gill = damp(b.gill || 0, lit ? 1 : 0, 8, dt);
    if (u['#d6ffe3*']) u['#d6ffe3*'].color.copy(GILL_DARK).lerp(GILL_LIT, b.gill);
    // a slow swim: it breathes, rolls a little; freed, it rolls over and swims off
    b.inner.rotation.z = Math.sin(b.t * 0.6) * 0.05 + (b.state === 'dying' ? b.t * 1.6 : 0);
    b.inner.position.y = Math.sin(b.t * 0.9) * 0.6;
    if (b.state === 'dying') { b.z -= dt * (20 + b.t * 40); b.y -= dt * 3; }
    // the inhale's tell: motes stream from round the ship into its open mouth
    if (!MOTES) MOTES = new GlowPoints(api.scene, 500, api.glowTex);
    MOTES.begin();
    if (fight && b.inhaleT !== undefined && b.inhaleT < 1.2 + b.inhaleLen) {
      const k = clamp(b.inhaleT / 1.2, 0, 1), mz = b.z + 14;
      for (let i = 0; i < 120; i++) {
        const f = ((i * 0.618 + b.t * 0.55) % 1), a = i * 2.39996, r = (1 - f) * 22 + 2;
        MOTES.push(Math.cos(a) * r, Math.sin(a) * r * 0.7, mz * f - 4 * (1 - f), 0.7, 0.62, 1, 0.76, 0.6 * k * Math.sin(f * Math.PI));
      }
    }
    MOTES.end();
    // the gulp: the shoal it was feeding on pours out of its mouth, ten fish a bar, round the middle of the box
    if (b.gulping && fight) {
      b.fishT = (b.fishT || 0) + dt;
      if (b.fishT > BAR / 10) {
        b.fishT -= BAR / 10; b.fishN = (b.fishN || 0) + 1;
        const a = b.fishN * 0.7, m = mouth(b);
        api.spawn({ type: 'g2-shoal', free: true, idx: 0, of: 0, keys: [[0, Math.sin(a) * 0.35, Math.cos(a) * 0.3]], off: [0, 0] }, m.z + 2);
      }
    }
  },
  onWeakDown(b, w, api) { b.knock = 24; },
  defeat(b, api) {
    const u = b.mats;
    for (const [k, hex] of Object.entries(FREED)) if (u[k]) u[k].color.setHex(hex);
    if (u['#ff3355*']) u['#ff3355*'].visible = false; if (u['#2a2e44']) u['#2a2e44'].visible = false;
    b.whirl = 0; b.frame = 0; b.gulping = false;
  },
});
