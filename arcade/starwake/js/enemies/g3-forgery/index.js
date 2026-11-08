// THE FORGERY (galaxy 3, level 6, The Forgery): Yori's crude, dark copy of a courier, like yours but cheaper: graphite
// where yours is slate, red where yours is cyan, an empty cradle. It has no guns, just like you. It plays by your rules.
//   THE RACE   it flies in out of the haze to hold far ahead of you (about 200 m) and races down the ring line, eating
//              the rings before they reach you. Every ring it eats rides in its cradle (amber hoops: laden).
//   KEYED FIRE the level's turrets are keyed to forgeries (g3-forge-turret): roll a turret's bolt home and it homes on
//              the nearest laden forgery instead. The forgery bursts and drops everything it stole as a shower of rings
//              you can catch. Those are the level's own rings, so catching them back counts (the MCP's default 4: the
//              stolen rings are the skill that ★4 and ★5 ask for; ★1-★3 never need them).
//   IT ROLLS   a later forgery (rolls: 1) rolls your first send straight back at you: a white flash and a bolt. Its
//              roll is slow: the white ring above it empties and refills (2.6 s). Roll the bolt home again while the
//              ring is still filling and it lands. This is the Counterfeit's whole fight, taught small.
// Event: { nx, ny (where it comes in), hold: 200 (metres ahead it races), life: 12 (seconds racing, then it flies
//          off with what it took), lat: 7 (m/s it can slide across the lane), rolls: 0, enter: 2.4,
//          want: 'boost' (it goes for boost rings first: the Heist), cap: 3 (its cradle: full, it makes off with them,
//          slowly enough that a keyed bolt still catches it on its way) }
import { THREE, defineEnemy, buildModel, clamp, SPAWN_D } from '../../api.js?v=0.4.0';
import { MESH } from './mesh.js?v=0.4.0';
import { SightLines } from '../sniper/sight.js?v=0.4.0';

const SCALE = 3.3, COOL = 2.6, ROLL_T = 0.45, BACK_T = 1.25, EAT_R = 2.2;
let lines = null;

function make(api) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  body.add(buildModel(MESH.hull).group);
  const laden = buildModel(MESH.laden).group; body.add(laden);
  // ship-v3: the copy's engines are revision 4's pair on the blades; one red glow per nozzle, grouped so the code below
  // still shows, hides and flickers them as one
  const glow = new THREE.Group(); g.add(glow);
  for (const x of [0.95, -0.95]) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff5a4a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.8 })); s.position.set(x, 0, 1.5); s.scale.setScalar(2.6); glow.add(s); }
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  flash.scale.setScalar(5); g.add(flash);
  g.userData = { body, laden, glow, flash };
  return g;
}
// a ring of n segments that fills clockwise: k of 1 lit (white), the rest dim (Yori: draw it as an arc that fills)
export function rollRing(L, x, y, z, r, k, a) {
  const n = 18, lit = Math.round(k * n);
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI / 2 - i / n * Math.PI * 2, a1 = Math.PI / 2 - (i + 1) / n * Math.PI * 2, on = i < lit;
    L.line(x + Math.cos(a0) * r, y + Math.sin(a0) * r, z, x + Math.cos(a1) * r, y + Math.sin(a1) * r, z, on ? 0.09 : 0.05, on ? 1 : 0.35, on ? 1 : 0.35, on ? 1 : 0.42, (on ? 0.95 : 0.4) * a, x, y, z + 20);
  }
}
// counts for the builders' own tools (read-only to the game): rings taken, showers dropped
export const STATS = { stolen: 0, returned: 0, burst: 0, left: 0 };
const isRing = (q) => q.kind.countsAsRing && q.alive && !q.anim && !(q.ev && (q.ev.cache || q.ev.decor));

export default defineEnemy({
  name: 'g3-forgery',
  motion: 'own', spawnAt: 'now',
  // the only thing it ever fires is your own bolt, rolled back: the white flash is its tell
  hazard: { cls: 'shot', introduced: [3, 6], shotT: BACK_T, tel: 0 },
  killPts: 1800,
  sample: { nx: 0, ny: 0 },
  init(api) { lines = new SightLines(api.scene, 240); },
  begin(api) { lines.begin(api.focalPx); },
  end() { lines.end(); },
  targetable: (e) => e.state === 'race' || e.state === 'enter' || (e.state === 'leave' && e.z > -620),
  spawn(e, ev, api) {
    e.obj = api.course.get('g3-forgery', () => make(api));
    e.sx = e.sy = e.sz = SCALE;
    e.z = -SPAWN_D; e.hold = -(ev.hold || 200); e.life = ev.life ?? 12; e.lat = ev.lat ?? 7; e.enter = ev.enter ?? 2.4;
    e.cap = ev.cap ?? 3; e.rollsLeft = ev.rolls || 0; e.cool = 0; e.rollT = -1; e.state = 'enter'; e.st = 0;
    e.stolen = []; e.seen = new WeakSet(); e.r = 1.6; e.hitR = 2.6; e.want = ev.want || null; e.shower = null; e.callT = -9;
    const ud = e.obj.userData; ud.laden.visible = false; ud.body.rotation.z = 0; ud.flash.material.opacity = 0; ud.glow.visible = true; ud.body.visible = true;
    e.sinkY = 0;
  },
  update(e, dt, api) {
    const ud = e.obj.userData, box = api.box, v = Math.max(1, api.v);
    e.st += dt;
    if (e.state === 'enter') {
      const k = Math.min(1, e.st / e.enter), ease = k * k * k * (k * (k * 6 - 15) + 10);
      e.z = -SPAWN_D + (SPAWN_D + e.hold) * ease;
      if (k >= 1) { e.state = 'race'; e.st = 0; }
    } else if (e.state === 'race') {
      e.z = e.hold;
      if (e.st > e.life || (e.full && e.st > e.fullT + 1.2)) { e.state = 'leave'; e.st = 0; if (e.stolen.length) api.game.pop('IT GOT AWAY WITH ' + e.stolen.length, e.x, e.y + 3, e.z, 'red'); }
    } else if (e.state === 'leave') {
      e.z -= (20 + e.st * 40) * dt; // slow enough that a keyed bolt still catches it on its way out
      if (e.z < -SPAWN_D) { e.alive = false; STATS.left += e.stolen.length; }
    } else if (e.state === 'burst') {
      // the shower grows in where it was dropped (never a pop: ruling 5), then the forgery is gone
      const k = Math.min(1, e.st / 0.45);
      for (const r of e.shower) if (r.alive && !r.anim) r.grow = Math.max(0.02, k * k);
      if (k >= 1) { for (const r of e.shower) if (r.alive && !r.anim) r.grow = 1; e.alive = false; }
      return;
    }
    // ---- the race: slide toward the next ring coming down the line (a boost ring first, in the Heist)
    if ((e.state === 'race' || e.state === 'enter') && !e.full) {
      let goal = null, gz = -1e9;
      for (const q of api.course.list) {
        if (!isRing(q) || q.z >= e.z - 2 || q.z < e.z - 260 || (e.want === 'boost' && q.type !== 'boost-ring')) continue;
        const pri = 0;
        if (q.z + pri > gz) { gz = q.z + pri; goal = q; }
      }
      if (goal) {
        const tArr = Math.max(0.05, (e.z - goal.z) / v), step = e.lat * dt;
        const wx = clamp((goal.x - e.x) / tArr * dt, -step, step), wy = clamp((goal.y - e.y) / tArr * dt, -step, step);
        e.x += wx; e.y += wy;
      }
      e.x = clamp(e.x, -box.x * 1.05, box.x * 1.05); e.y = clamp(e.y, -box.y * 1.05, box.y * 1.05);
      // eat: a ring reaching its plane close to it is gone (no miss, no catch: it is in the cradle now)
      for (const q of api.course.list) {
        if (!isRing(q) || e.seen.has(q) || q.z < e.z - 1 || q.z > e.z + 40 || (e.want === 'boost' && q.type !== 'boost-ring')) continue;
        e.seen.add(q); // judged once, as it crosses its plane
        if (e.rollT >= 0 || e.full || e.state === 'leave') continue;
        if (Math.hypot(q.x - e.x, q.y - e.y) < EAT_R) {
          q.alive = false; e.stolen.push(q.type); STATS.stolen++;
          if (e.stolen.length >= e.cap) { e.full = true; e.fullT = e.st; } // its cradle holds three: then it makes off with them
          api.game.burst(q.x, q.y, q.z, 18, { speed: 7, life: 0.4, s0: 1.2, r: 1, g: 0.55, b: 0.3, carry: 0 });
          if (e.st - e.callT > 1.2) { e.callT = e.st; api.game.pop(q.type === 'boost-ring' ? 'CHAIN STOLEN' : 'STOLEN', q.x, q.y + 2, q.z, 'red'); }
        }
      }
    }
    // ---- its roll: a barrel roll, then the ring above refills slowly
    if (e.rollT >= 0) { e.rollT += dt; ud.body.rotation.z = Math.min(1, e.rollT / ROLL_T) * Math.PI * 2; if (e.rollT >= ROLL_T) { e.rollT = -1; ud.body.rotation.z = 0; } }
    if (e.cool > 0) e.cool = Math.max(0, e.cool - dt);
    ud.flash.material.opacity = Math.max(0, ud.flash.material.opacity - dt * 3);
    ud.laden.visible = e.stolen.length > 0;
    { const o = 0.6 + 0.3 * Math.sin(e.t * 20); for (const s of ud.glow.children) s.material.opacity = o; }
    api.pose(e);
    e.obj.rotation.set(0, 0, clamp(-(e.x - (e.px ?? e.x)) / Math.max(dt, 1e-3) * 0.05, -0.5, 0.5)); e.px = e.x;
    // the roll ring above it (only on a forgery that rolls): full white = it will send your shot back
    if (e.rollsLeft > 0 || e.cool > 0) rollRing(lines, e.x, e.y + 2.6 * SCALE * e.appear, e.z, 1.0 * SCALE * e.appear, e.cool > 0 ? 1 - e.cool / COOL : 1, e.appear);
    if (e.ev.warm) rollRing(lines, 0, 0, -40, 1, 0.5, 0.01);
  },
  // a sent-back bolt reaches it: it rolls it back (if it can), else it bursts and drops what it stole
  onShot(e, s, api) {
    if (e.state === 'burst' || !e.alive) return;
    if (e.rollsLeft > 0 && e.cool <= 0) {
      e.rollsLeft--; e.cool = COOL; e.rollT = 0;
      e.obj.userData.flash.material.opacity = 1;
      api.game.sfx('g3-forgery-roll', { vol: 0.7 });
      api.game.pop('ROLLED BACK', e.x, e.y + 3, e.z, 'red');
      e.back = api.fire({ x: e.x, y: e.y, z: e.z + 2 }, clamp(api.ship.x + api.ship.vx * 0.2, -api.box.x, api.box.x), clamp(api.ship.y, -api.box.y, api.box.y), { T: BACK_T, owner: e });
      return;
    }
    burst(e, api);
  },
  // the bots: the bolt it rolled back is the one to meet and roll again (it lands while its ring refills)
  rollAsk(e, api) {
    const s = e.back; if (!s || !s.alive || s.reflected) return [];
    const t = -s.z / Math.max(1, s.vz); if (!(t > -0.1)) return [];
    return [{ t, x: s.x + s.vx * Math.max(0, t), y: s.y + s.vy * Math.max(0, t), r: 2.3, key: 'back' }];
  },
});
function burst(e, api) {
  e.state = 'burst'; e.st = 0;
  const ud = e.obj.userData; ud.body.visible = false; ud.glow.visible = false;
  api.game.kill(e, true);
  api.game.sfx('g3-forgery-burst', { vol: 0.8 });
  // the shower: every ring it took, spread back down the line toward you, inside the box, born where it burst (at least
  // 150 m out, so nothing appears close: it grows in over 0.45 s)
  const n = e.stolen.length, box = api.box; e.shower = []; STATS.burst++; STATS.returned += n;
  for (let i = 0; i < n; i++) {
    const a = i * 2.4, rr = 0.9 + 0.25 * (i % 3);
    const x = clamp(e.x + Math.cos(a) * rr, -box.x * 0.85, box.x * 0.85), y = clamp(e.y + Math.sin(a) * rr * 0.7, -box.y * 0.8, box.y * 0.8);
    const r = api.spawn({ type: 'ring', x, y, shower: true }, Math.min(-160, e.z - i * 16));
    r.grow = 0.02; r.sx = r.sy = r.sz = 0.02; api.pose(r); e.shower.push(r);
  }
  if (n) api.game.pop(n > 1 ? n + ' RINGS BACK' : 'RING BACK', e.x, e.y + 3, e.z, 'cyan');
}
