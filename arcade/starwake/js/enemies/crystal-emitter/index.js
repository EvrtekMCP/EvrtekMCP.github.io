// THE CRYSTAL EMITTER (level 9, the Mirror Field): Yori's truss cage holding a lilac crystal with a red core. It
// stands still in the field and fires one bolt that SPLITS: one real red bolt (the engine's shot: it glows, it
// trails, it hurts, and a roll sends it home and shatters the emitter) and two ghosts (flat pink rings that pass
// through you: ghosts.js). Its tell (her sheet): the crystal spins up and its twelve facets go white one by one
// over 0.8 s while the core brightens.
//
// What a volley does is the level's lesson, so each one is authored (ev.vols, one entry per volley):
//   at    seconds before the emitter reaches you that the bolt leaves (default 2.3)
//   mode  'lie'   ghosts at you, the real bolt wide of you        (teach: ghosts are harmless)
//         'truth' the real bolt at you, the ghosts wide           (teach: the glowing one is real)
//         'mix'   all three at you, arriving together             (read it, roll once)
//         'bait'  ghosts at you first, the real one `gap` s later (don't roll at the lie)
//         'late'  the real one first, the ghosts after
//         'bank'  the real bolt goes to a mirror pane across the lane and comes at you off it; the ghosts come
//                 straight from the emitter (the obvious path is the lie). A white thread joins emitter and
//                 pane for the last 0.5 s of the charge (Yori's cross-volley tell, taught here before the Twins).
//   gap   bait gap in s (default 0.62: inside one roll's cooldown, outside its 0.45 s window)
//   wide  how far wide the miss goes, metres (lie / truth)
//   T     the real bolt's time to your plane (default 1.3; 'bait' 1.45)
//   aim   'true' (default) or 'graze': aimed 1.6 m off you, so a first try costs a graze at worst
// 0.3.1: on a level with roll-or-hit fire (levels.js FIRE), a truth, late or mix volley's real bolt may come as a NET.
import { THREE, defineEnemy, clamp, SHIP_R, NET_T } from '../../api.js?v=0.4.0';
import { EMITTER } from './mesh.js?v=0.4.0';
import { buildParts, geometryOf } from './parts.js?v=0.4.0';
import { Ghosts } from './ghosts.js?v=0.4.0';

const CHARGE = 0.8, THREAD = 0.5, CARRY = 0.22, SPLIT = 0.16;
const WHITE = new THREE.Color(0xffffff), BLACK = new THREE.Color(0x000000);

function make(api) {
  const g = new THREE.Group(), inner = new THREE.Group(); inner.rotation.y = Math.PI; g.add(inner); // her front (-Z) to the ship
  const m = buildParts(EMITTER, { own: ['#ff3355*'] });
  inner.add(m.group);
  // the crystal spins inside the cage; its facets light white one by one (an additive overlay, black = unlit)
  const crystal = m.parts.crystal; m.group.remove(crystal);
  const pivot = new THREE.Group(); pivot.add(crystal); m.group.add(pivot);
  const src = geometryOf(EMITTER.find((x) => x.part === 'crystal'));
  const og = new THREE.BufferGeometry(); og.setAttribute('position', src.getAttribute('position'));
  const col = new THREE.BufferAttribute(new Float32Array(src.getAttribute('position').count * 3), 3).setUsage(THREE.DynamicDrawUsage);
  og.setAttribute('color', col);
  const facets = new THREE.Mesh(og, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  facets.scale.setScalar(1.02); pivot.add(facets);
  // the charge glow at the core, and the white thread a bank shot draws to its pane
  const charge = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  charge.position.z = 0.7; g.add(charge);
  g.userData = { core: m.mats['#ff3355*'], charge, pivot, col, facets };
  return g;
}
// the mirror pane a bank shot comes off: a tall pearl slab with a glint edge, standing across the lane
function makePane(api) {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.3, 6, 1), new THREE.MeshStandardMaterial({ color: 0xdfe6f2, metalness: 0.85, roughness: 0.12, flatShading: true, transparent: true, opacity: 0.82 }));
  slab.rotation.x = Math.PI / 2; slab.scale.set(1, 1, 1.7); g.add(slab);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.12, 4, 6), new THREE.MeshBasicMaterial({ color: 0xf4f8ff }));
  edge.scale.set(1, 1.7, 1); edge.rotation.z = Math.PI / 6; g.add(edge);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  flash.scale.setScalar(6); g.add(flash);
  // the thread: a thin white beam from the emitter to the bounce point, stretched along +Z of its own group
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 5, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  thread.geometry.rotateX(Math.PI / 2); thread.geometry.translate(0, 0, 0.5);
  const carrier = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  carrier.scale.setScalar(3);
  g.userData = { slab, flash, thread, carrier, edge };
  return g;
}

const lerpPick = (R, a, b) => a + (b - a) * R;
export default defineEnemy({
  name: 'crystal-emitter',
  // for the warning-time check: every real bolt is a reflectable shot, at least 1.15 s to your plane, after a
  // 0.8 s charge; brand-new in level 9
  hazard: { cls: 'shot', introduced: 9, shotT: 1.15, tel: CHARGE, net: { T: NET_T, tel: CHARGE } }, // net: levels.js FIRE
  sample: { vols: [{ at: 2.6, mode: 'mix' }] },
  spawn(e, ev, api) {
    e.obj = api.course.get('crystal-emitter', () => make(api));
    e.sx = e.sy = e.sz = 2.0;
    // r: what a sent-back bolt must reach; ram: the body (her cage is 1.9 m to a side at this size)
    e.r = 2.0; e.ram = 1.6; e.hp = 1; e.spin = Math.random() * 6; e.vi = 0; e.tel = -1; e.events = [];
    e.vols = (ev.vols || [{ at: 2.6, mode: 'mix' }]).map((v) => Object.assign({ at: 2.3, mode: 'mix', gap: 0.62, wide: 4.6 }, v));
    const ud = e.obj.userData; ud.col.array.fill(0); ud.col.needsUpdate = true; ud.charge.material.opacity = 0; ud.core.color.setHex(0xff3355);
    // a bank emitter stands outside the box on one side; its pane stands on the other
    e.bank = e.vols.some((v) => v.mode === 'bank');
    if (e.bank) {
      const side = ev.side || 1, box = api.box;
      e.x = -side * box.x * (ev.out || 1.45);
      e.pane = api.course.get('crystal-emitter-pane', () => makePane(api));
      e.px = side * box.x * (ev.paneOut || 1.6); e.py = e.y;
      const pu = e.pane.userData; pu.flash.material.opacity = 0; pu.thread.material.opacity = 0; pu.carrier.material.opacity = 0;
      if (!pu.thread.parent) api.scene.add(pu.thread); if (!pu.carrier.parent) api.scene.add(pu.carrier);
      pu.thread.visible = pu.carrier.visible = false;
      e.pane.rotation.y = -side * 0.5; // turned to face the emitter and the lane
    }
  },
  remove(e, api) {
    if (e.obj) api.course.put('crystal-emitter', e.obj);
    if (e.pane) { const pu = e.pane.userData; pu.thread.visible = pu.carrier.visible = false; api.course.put('crystal-emitter-pane', e.pane); e.pane = null; }
  },
  update(e, dt, api) {
    const ud = e.obj.userData, v = api.v, ship = api.ship, box = api.box;
    api.pose(e);
    e.spin += dt * (0.8 + (e.tel >= 0 ? 9 * Math.min(1, e.tel / CHARGE) : 0));
    ud.pivot.rotation.y = e.spin;
    const arrive = -e.z / Math.max(1, v);
    const vol = e.vols[e.vi];
    // ---- the charge: facets go white one by one over 0.8 s, the core brightens, the glow swells
    if (vol && e.tel < 0 && arrive < vol.at + CHARGE && arrive > 0.3) { e.tel = 0; api.game.telegraph(e); }
    if (e.tel >= 0 && vol) {
      e.tel += dt;
      const k = Math.min(1, e.tel / CHARGE), lit = Math.floor(k * 12.999);
      const c = ud.col.array;
      for (let f = 0; f < 12; f++) { const on = f < lit ? 1 : f === lit ? (k * 12.999) % 1 : 0; for (let j = 0; j < 9; j++) c[f * 9 + j] = on * 0.95; }
      ud.col.needsUpdate = true;
      ud.core.color.setRGB(1, 0.2 + 0.75 * k, 0.33 + 0.62 * k);
      ud.charge.material.opacity = k * (0.55 + 0.45 * Math.sin(e.tel * 38));
      ud.charge.scale.setScalar(1 + k * 3);
      if (vol.mode === 'bank' && e.pane) { const into = e.tel - (CHARGE - THREAD); e.thread = into > 0 ? Math.min(1, into / THREAD) : 0; }
      if (e.tel >= CHARGE) { e.tel = -1; e.vi++; this.fire(e, vol, api); ud.charge.material.opacity = 0; ud.col.array.fill(0); ud.col.needsUpdate = true; ud.core.color.setHex(0xff3355); }
    }
    // ---- queued events (a bank shot's carrier reaching its pane)
    for (let i = e.events.length - 1; i >= 0; i--) { const q = e.events[i]; q.t -= dt; if (q.t <= 0) { e.events.splice(i, 1); q.fn(); } }
    if (e.pane) this.paneFrame(e, dt, api);
    // ---- the ram: an emitter in the lane hurts like any body
    if (Math.abs(e.z) < 1.6 && Math.hypot(ship.x - e.x, ship.y - e.y) < e.ram + SHIP_R * 0.8 && !e.rammed) { e.rammed = true; api.game.crash(e, 20); api.kill(e, false); }
    // nothing unlit is drawn: a glow at zero is still a draw call
    ud.charge.visible = ud.charge.material.opacity > 0.004; ud.facets.visible = e.tel >= 0;
    if (e.z > 12) e.alive = false;
    void box;
  },
  // ---- one volley: the real bolt (the engine's shot) and two ghosts
  fire(e, vol, api) {
    const ship = api.ship, box = api.box;
    const lx = clamp(ship.x + ship.vx * 0.35, -box.x, box.x), ly = clamp(ship.y + ship.vy * 0.35, -box.y, box.y);
    // a miss goes to the side with more room, so it stays in view
    const wideX = (dist) => clamp(ship.x + (ship.x > 0 ? -dist : dist), -box.x * 1.3, box.x * 1.3);
    let rx = lx, ry = ly;
    if (vol.aim === 'graze') rx = clamp(lx + (lx > 0 ? -1.6 : 1.6), -box.x, box.x);
    const T = vol.T || (vol.mode === 'bait' ? 1.45 : 1.3);
    const ghosts = (tx1, ty1, tx2, ty2, Tg, from) => {
      const o = from || e;
      Ghosts.fire(api, o.x, o.y, o.z, tx1, ty1, Tg, from ? 0 : SPLIT);
      Ghosts.fire(api, o.x, o.y, o.z, tx2, ty2, Tg, from ? 0 : SPLIT);
      api.game.burst(o.x, o.y, o.z - 2, 8, { speed: 6, life: 0.3, s0: 1.2, r: 1, g: 0.95, b: 1, carry: 1 });
    };
    const near = (dx, dy) => [clamp(ship.x + dx, -box.x, box.x), clamp(ship.y + dy, -box.y, box.y)];
    switch (vol.mode) {
      case 'lie': {
        api.fire(e, wideX(vol.wide), ly, { T });
        const [a, b] = near(-0.45, 0.2), [c, d] = near(0.45, -0.2);
        ghosts(a, b, c, d, T); break;
      }
      case 'truth': {
        api.fire(e, rx, ry, { T, net: vol.aim !== 'graze' }); // 0.3.1: the true bolt may come as a net (levels.js FIRE)
        ghosts(wideX(vol.wide), ly + 1.5, wideX(vol.wide + 1.5), ly - 1.5, T); break;
      }
      case 'bait': {
        api.fire(e, rx, ry, { T });
        const [a, b] = near(-0.6, 0.3), [c, d] = near(0.6, -0.3);
        ghosts(a, b, c, d, Math.max(0.6, T - vol.gap)); break;
      }
      case 'late': {
        api.fire(e, rx, ry, { T, net: vol.aim !== 'graze' });
        const [a, b] = near(-0.7, 0.4), [c, d] = near(0.7, -0.4);
        ghosts(a, b, c, d, T + 0.5); break;
      }
      case 'bank': {
        // the bolt crosses to the pane (CARRY s), flashes it, and comes off it at you in bankT s
        const bankT = vol.T || 1.15;
        e.carrying = { t: 0 };
        e.events.push({ t: CARRY, fn: () => {
          if (!e.alive || !e.pane) return;
          const p = { x: e.px, y: e.py, z: e.z };
          const [bx, by] = [clamp(ship.x + ship.vx * 0.3, -box.x, box.x), clamp(ship.y + ship.vy * 0.3, -box.y, box.y)];
          api.fire(p, vol.aim === 'graze' ? clamp(bx + (bx > 0 ? -1.6 : 1.6), -box.x, box.x) : bx, by, { T: bankT, owner: e });
          e.flash = 1; e.carrying = null;
          api.game.sfx('fire', { rate: 1.4, vol: 0.6, pan: e.px / box.x * 0.6 });
        } });
        // the lie comes straight from the emitter, and lands just before the truth does
        const [a, b] = near(-0.5, 0.25), [c, d] = near(0.5, -0.25);
        ghosts(a, b, c, d, Math.max(0.6, CARRY + bankT - (vol.gap ?? 0.35))); break;
      }
      default: { // 'mix'
        // 0.3.1: the real bolt may come as a net (levels.js FIRE); its ghosts then fly as fast, so all of it still lands together
        const s = api.fire(e, rx, ry, { T, net: vol.aim !== 'graze' });
        const [a, b] = near(-0.7, 0.35), [c, d] = near(0.7, -0.35);
        ghosts(a, b, c, d, s && s.net ? NET_T : T);
      }
    }
  },
  // the pane follows its emitter down the track; the thread and the carrier are drawn in world space
  paneFrame(e, dt, api) {
    const pu = e.pane.userData, a = e.appear;
    e.pane.position.set(e.px, e.py, e.z); e.pane.scale.setScalar(a * 1.25);
    e.flash = Math.max(0, (e.flash || 0) - dt * 3);
    pu.flash.material.opacity = e.flash; pu.edge.material.color.setRGB(0.95 + 0.05 * e.flash, 0.97, 1);
    const th = e.thread || 0;
    pu.thread.material.opacity = th > 0 ? (0.35 + 0.65 * th) * (0.7 + 0.3 * Math.sin(api.time * 50)) : 0;
    if (th > 0) {
      const dx = e.px - e.x, dy = e.py - e.y, len = Math.hypot(dx, dy) || 1;
      pu.thread.position.set(e.x, e.y, e.z); pu.thread.scale.set(1 + th, 1 + th, len);
      pu.thread.lookAt(e.px, e.py, e.z);
    }
    if (e.carrying) {
      e.carrying.t += dt; const k = Math.min(1, e.carrying.t / CARRY);
      pu.carrier.material.opacity = 1; pu.carrier.position.set(e.x + (e.px - e.x) * k, e.y + (e.py - e.y) * k, e.z);
      e.thread = 1 - k;
    } else { pu.carrier.material.opacity = 0; if (e.tel < 0) e.thread = Math.max(0, (e.thread || 0) - dt * 4); }
    pu.flash.visible = pu.flash.material.opacity > 0.004; pu.thread.visible = pu.thread.material.opacity > 0.004; pu.carrier.visible = pu.carrier.material.opacity > 0.004;
  },
  onKill(e, byShot, api) {
    // it shatters: lilac shards and a white flash
    api.game.burst(e.x, e.y, e.z, 34, { speed: 16, life: 0.7, s0: 1.6, r: 0.75, g: 0.65, b: 1, carry: 1, drag: 1.5 });
    api.game.burst(e.x, e.y, e.z, 12, { speed: 6, life: 0.3, s0: 2.6, r: 1, g: 1, b: 1, carry: 1 });
    void byShot;
  },
  // the test autopilot keeps clear of an emitter standing in the lane
  avoid(e) { return e.bank ? [] : [{ x: e.x, y: e.y, r: 3.2 }]; },
  // the ghosts are drawn and moved here, once a frame, whenever level 9's course runs
  end(api) { Ghosts.update(api); },
});
