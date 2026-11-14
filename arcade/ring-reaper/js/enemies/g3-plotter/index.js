// THE PLOTTER (galaxy 3, level 5, The Drafting Hall, on): Yori's pen machine. It flies across the lane ahead of you
// on one plane (a sheet the course carries toward you) and prints a dotted line of mines behind its nib, so walls are
// drawn live in front of you and the order matters.
//   THE GUIDE  its path is ruled first, a faint white guide-line 1.25 s ahead of the nib (the galaxy's promise: white
//              is the plan, and the plan never lies).
//   THE LINE   each mine is a white-hot dot when it lands, hardening red in 0.35 s, and stays on the sheet. A mine
//              still white when the sheet reaches you never hurts: only red hurts.
//   ANSWERS    cross where the line is not drawn yet (ahead of the nib), or go round its end. Roll an escort's shot
//              into the plotter and it breaks mid-line: the line ends early and the gap grows.
//   CLOSE      a red mine you pass close to may arm (a white strobe) and pop into four bolts, as galaxy 1's mines do:
//              roll them home (MULTI-DEFLECT), the level's `pop` says how many of a line may.
// Event: { path: [[nx, ny], ...] (the polyline the nib draws, normalised box; ends may sit outside the box),
//          from: 2.6, to: 0.2 (seconds out, at the course's own speed `spd`, when the nib starts and stops),
//          spd (the level's speed at d: authoring helpers set it), spacing: 1.5 (metres between mines),
//          escort: { at: 2.8, shots: 1, side: 1 } (a pod beside it whose shot, sent home, breaks the plotter),
//          pop: 0 (mines of this line that may pop), guide: 1.25 }
// Warning (rule 12): from the guide reaching a spot to that spot's mine hardening is guide + 0.35 s = 1.6 s at the
// course's own speed (1.25 s at GREED); the sheet itself, and the plotter on it, are in view from 640 m.
import { THREE, defineEnemy, buildModel, Instanced, GlowPoints, clamp, SHIP_R } from '../../api.js?v=0.6.4';
import { MESH } from './mesh.js?v=0.6.4';
import { SightLines } from '../sniper/sight.js?v=0.6.4';
import { geometryOf } from '../crystal-emitter/parts.js?v=0.6.4';

export const GUIDE = 1.25, HARD = 0.35, MINE_R = 0.6, MINE_S = 1.4;
const SCALE = 2.4, NIB = [0, -0.72, -1.4];
let lines = null, mineL = null, glow = null;
const tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4(), tmpC = new THREE.Color(), axX = new THREE.Vector3(), axY = new THREE.Vector3(0, 0, 1), axZ = new THREE.Vector3();
const spin = new THREE.Quaternion(), spinAx = new THREE.Vector3(0.3, 1, 0.2).normalize();

function make(api) {
  const g = new THREE.Group();
  const m = buildModel(MESH.plotter, { own: ['#ff3355*'] }); g.add(m.group);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 }));
  halo.position.set(0, 0, 1.4); halo.scale.setScalar(2.6); g.add(halo);
  const pod = buildModel('pod', { own: ['#ff3355*'] }); const esc = new THREE.Group(); const inner = new THREE.Group(); inner.rotation.y = Math.PI; inner.add(pod.group); esc.add(inner);
  const charge = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff3355, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  charge.position.z = 1.2; esc.add(charge);
  g.userData = { body: m.group, halo, esc, escCore: pod.mats['#ff3355*'], charge };
  return g;
}
// the polyline in metres, with its running length, and a point at arc length s
function pathOf(ev, box) {
  const P = (ev.path || [[-1.2, 0], [1.2, 0]]).map(([x, y]) => [x * box.x, y * box.y]), acc = [0];
  for (let i = 1; i < P.length; i++) acc.push(acc[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  return { P, acc, len: acc[acc.length - 1] || 1 };
}
export function pointAt(p, s, out = [0, 0, 1, 0]) {
  s = clamp(s, 0, p.len);
  let i = 1; while (i < p.P.length - 1 && p.acc[i] < s) i++;
  const a = p.P[i - 1], b = p.P[i], L = (p.acc[i] - p.acc[i - 1]) || 1, f = (s - p.acc[i - 1]) / L;
  out[0] = a[0] + (b[0] - a[0]) * f; out[1] = a[1] + (b[1] - a[1]) * f; out[2] = (b[0] - a[0]) / L; out[3] = (b[1] - a[1]) / L;
  return out;
}
// the nib's progress (0..1) when the sheet is z metres out: by distance, so it is the same on every run
export const progressAt = (z, from, to, spd) => clamp((-z - from * spd) / ((to - from) * spd), 0, 1);
// every mine the line will hold when the sheet reaches the ship, and which of them are red by then (the course check
// and the bots read this: it is the plan, and the plan never lies)
export function plannedMines(ev, box) {
  const p = pathOf(ev, box), spd = ev.spd || 120, sp = ev.spacing || 1.5, from = ev.from ?? 2.6, to = ev.to ?? 0.2, out = [];
  const end = progressAt(0, from, to, spd) * p.len;
  for (let s = sp * 0.5; s <= end + 1e-6; s += sp) {
    // the distance out at which the nib reaches s
    const zDrop = -(from + (to - from) * (s / p.len)) * spd, q = pointAt(p, s);
    out.push({ x: q[0], y: q[1], hard: zDrop <= -HARD * spd });
  }
  return out;
}

export default defineEnemy({
  name: 'g3-plotter',
  hazard: { cls: 'mover', introduced: [3, 5], warn: (ev, v) => (GUIDE + HARD) * (ev.spd || 120) / v },
  killPts: 1400,
  sample: { path: [[-0.5, 0], [0.5, 0]], from: 9, to: 8, spd: 100 },
  init(api) {
    lines = new SightLines(api.scene, 900);
    glow = new GlowPoints(api.scene, 1600, api.glowTex);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    mineL = MESH.mine.map((g) => new Instanced(api.scene, geometryOf(g), mat, 700));
    for (const L of mineL) L.mesh.setColorAt(0, tmpC.setHex(0xff3355));
  },
  begin(api) { lines.begin(api.focalPx); glow.begin(); for (const L of mineL) L.begin(); },
  end(api) { lines.end(); glow.setScale(api.focalPx * 1.2); glow.end(); for (const L of mineL) L.end(); },
  targetable: (e) => !e.broken,
  // a sent-back shot from a broken plotter's escort has nowhere to go
  redirect: (e) => (e.broken ? null : undefined),
  spawn(e, ev, api) {
    e.obj = api.course.get('g3-plotter', () => make(api));
    e.sx = e.sy = e.sz = 1; // the body is placed by hand (posed at the nib), so pose() is not used
    e.path = pathOf(ev, api.box); e.spd = ev.spd || (api.level ? api.level.speed(ev.d || 0) : 120);
    e.from = ev.from ?? 2.6; e.to = ev.to ?? 0.2; e.sp = ev.spacing || 1.5; e.guide = ev.guide ?? GUIDE;
    e.mines = []; e.next = e.sp * 0.5; e.popLeft = ev.pop || 0; e.broken = false; e.hitDone = false; e.scraped = false;
    e.r = 1.6; e.hitR = 2.4; e.hp = 1; e.offT = 0;
    e.nib = pointAt(e.path, 0, [0, 0, 1, 0]); e.x = e.nib[0]; e.y = e.nib[1];
    const ud = e.obj.userData; ud.body.visible = true; ud.halo.visible = true;
    e.esc = ev.escort ? Object.assign({ at: 2.8, shots: 1, side: 1 }, ev.escort === true ? {} : ev.escort) : null;
    if (e.esc) { e.esc.tel = -1; e.esc.fired = 0; e.esc.queue = []; e.esc.alive = true; }
    ud.esc.visible = !!e.esc; ud.charge.material.opacity = 0;
  },
  update(e, dt, api) {
    const ship = api.ship, v = Math.max(1, api.v), ud = e.obj.userData, a = e.appear, spd = e.spd;
    // ---- the nib: where it is on the path, and the mines it has printed
    const prog = progressAt(e.z, e.from, e.to, spd), sNib = prog * e.path.len;
    if (!e.broken) {
      while (e.next <= sNib + 1e-6 && e.next <= e.path.len) {
        const q = pointAt(e.path, e.next);
        e.mines.push({ x: q[0], y: q[1], zDrop: e.z, alive: true, arm: -1, ph: Math.random() * 6 });
        if (e.mines.length === 1) api.game.sfx('g3-plot', { vol: 0.3, pan: clamp(q[0] / api.box.x * 0.5, -1, 1), gap: 0.1 }); // once, as the nib touches down
        e.next += e.sp;
      }
    }
    pointAt(e.path, sNib, e.nib);
    let dx = e.nib[2], dy = e.nib[3], px = e.nib[0], py = e.nib[1];
    if (prog >= 1 && !e.broken) { e.offT += dt; const go = e.offT * e.offT * 9 + e.offT * 6; px += dx * go; py += dy * go; } // done: it flies off its line's end
    // ---- the body, posed so its nib tip sits on the line, -Z along its travel, its top toward you
    const S = SCALE * a;
    axZ.set(-dx, -dy, 0); axX.set(dy, -dx, 0);
    tmpM.makeBasis(axX, axY, axZ); e.obj.quaternion.setFromRotationMatrix(tmpM);
    e.x = px; e.y = py;
    e.obj.position.set(px + dx * -NIB[2] * S, py + dy * -NIB[2] * S, e.z - NIB[1] * S);
    e.obj.scale.setScalar(S);
    ud.body.visible = !e.broken; ud.halo.visible = !e.broken;
    // ---- the escort: a pod beside it, firing at you; its shot is the plotter's, so sent home it breaks the plotter
    const arrive = -e.z / v;
    if (e.esc) {
      const E = e.esc; ud.esc.visible = E.alive;
      // in the body's frame: beside it (its local X) and a little behind (toward you)
      ud.esc.position.set(E.side * 1.6, 0.4, 0.9); ud.esc.scale.setScalar(1.1 / SCALE);
      if (E.alive && !e.broken) {
        const ex = e.obj.position.x + axX.x * E.side * 1.6 * S, ey = e.obj.position.y + axX.y * E.side * 1.6 * S, ez = e.obj.position.z + 0.9 * S;
        e.obj.updateMatrixWorld(); ud.esc.lookAt(ship.x, ship.y, 8);
        const at = [E.at, E.at - 1.2].slice(0, E.shots), next = at[E.fired];
        if (next !== undefined && arrive < next + 0.75 && E.tel < 0 && arrive > 0.9) { E.tel = 0; api.game.telegraph(e); }
        if (E.tel >= 0) {
          E.tel += dt; const k = Math.min(1, E.tel / 0.75);
          ud.escCore.color.setRGB(1, 0.2 + 0.7 * k, 0.33 + 0.6 * k); ud.charge.material.opacity = k * (0.6 + 0.4 * Math.sin(E.tel * 40)); ud.charge.scale.setScalar(1 + k * 4);
          if (E.tel >= 0.75) { E.tel = -1; E.fired++; ud.charge.material.opacity = 0; api.fire({ x: ex, y: ey, z: ez }, clamp(ship.x + ship.vx * 0.3, -api.box.x, api.box.x), clamp(ship.y + ship.vy * 0.3, -api.box.y, api.box.y), { T: 1.3, owner: e }); }
        } else ud.escCore.color.setHex(0xff3355);
      }
    }
    // ---- the guide (white, dashed, 1.25 s ahead of the nib) and the rule under the printed line
    if (!e.broken && prog < 1 && a > 0.01) {
      const sG = progressAt(e.z - e.guide * spd, e.from, e.to, spd) * e.path.len, dash = 0.9;
      const k = clamp((sG - sNib) / 2, 0, 1) * a;
      for (let s = sNib, i = 0; s < sG && i < 120; s += dash * 2, i++) {
        const q0 = pointAt(e.path, s), x0 = q0[0], y0 = q0[1], q1 = pointAt(e.path, Math.min(sG, s + dash));
        lines.line(x0, y0, e.z, q1[0], q1[1], e.z, 0.05, 0.91, 0.93, 1, 0.75 * k, x0, y0, e.z + 30);
      }
    }
    if (e.mines.length > 1 && a > 0.01) {
      const m0 = e.mines[0], mN = e.mines[e.mines.length - 1];
      for (let i = 1; i < e.mines.length; i++) { const p = e.mines[i - 1], q = e.mines[i]; lines.line(p.x, p.y, e.z, q.x, q.y, e.z, 0.035, 0.91, 0.93, 1, 0.3 * a, p.x, p.y, e.z + 30); }
      if (e.ev.warm) lines.line(m0.x, m0.y, -40, mN.x, mN.y, -40, 0.03, 1, 1, 1, 0.01);
    }
    if (e.ev.warm) lines.line(0, 0, -40, 1, 0, -40, 0.03, 1, 1, 1, 0.01);
    // ---- the mines: white-hot when printed, red within 0.35 s; armed: a white strobe; then four bolts
    for (const m of e.mines) {
      if (!m.alive) continue;
      const age = (e.z - m.zDrop) / (HARD * spd), hard = age >= 1;
      m.ph += dt * 6;
      let r = 1, g = 1, b = 1;
      if (m.arm >= 0) {
        m.arm += dt; const on = Math.floor(m.arm * 16) % 2; r = 1; g = on ? 0.88 : 0.2; b = on ? 0.9 : 0.33;
        if (m.arm > 0.42) {
          m.alive = false;
          const a0 = Math.atan2(e.nib[3], e.nib[2]) + Math.PI / 4;
          for (let k = 0; k < 4; k++) { const an = a0 + k * Math.PI / 2; api.fire({ x: m.x, y: m.y, z: e.z, mine: true }, 0, 0, { vel: [Math.cos(an) * 5.5, Math.sin(an) * 5.5, 6], carry: 1 }); }
          api.game.minePop(m, e.z);
          continue;
        }
      } else if (!hard) { const k = clamp(age, 0, 1); g = 1 - 0.8 * k; b = 1 - 0.67 * k; }
      else { const pk = 0.75 + 0.25 * Math.sin(m.ph); r = pk; g = 0.2 * pk; b = 0.33 * pk; }
      // pass close to a red one and it may arm (the line's `pop` budget), as galaxy 1's mines do
      if (hard && m.arm < 0 && e.popLeft > 0 && arrive < 1.35 && arrive > 0.6 && Math.hypot(ship.x - m.x, ship.y - m.y) < 3.2) { m.arm = 0; e.popLeft--; api.game.mineArm(m); }
      tmpQ.setFromAxisAngle(spinAx, m.ph * 0.25);
      tmpC.setRGB(r, g, b);
      const s = MINE_S * a;
      for (const L of mineL) L.put(m.x, m.y, e.z, tmpQ, s, s, s, tmpC.getHex());
      glow.push(m.x, m.y, e.z, 2.6 * a, r, g, b, 0.55 * a);
    }
    // ---- the sheet reaches you: a red mine is a hit (Phase passes through it), a close one pays CLOSE
    if (e.crossed && !e.hitDone) {
      e.hitDone = true;
      let near = 1e9, hit = null;
      for (const m of e.mines) {
        if (!m.alive || m.arm >= 0) continue;
        if ((e.z - m.zDrop) < HARD * spd) continue; // still white: never hurts
        const d = Math.hypot(ship.x - m.x, ship.y - m.y);
        if (d < near) { near = d; hit = m; }
      }
      // the pen itself is solid, too (it is on the sheet, at its nib or flying off the line's end)
      const body = !e.broken && Math.hypot(ship.x - e.x, ship.y - e.y) < 1.5 + SHIP_R * 0.8;
      if (body) api.game.crash({ id: e.id, kind: e.kind, type: 'g3-plotter', x: e.x, y: e.y, z: 0 }, 18, false);
      else if (hit && near < MINE_R + SHIP_R * 0.8) { api.game.crash({ id: e.id, kind: e.kind, type: 'g3-plotter', x: hit.x, y: hit.y, z: 0 }, 16, true); }
      else if (hit && near < 2.4) api.game.scrape(e, near);
    }
    if (e.z > 14) e.alive = false;
  },
  // sent home (an escort's shot): the plotter breaks; its printed line stays on the sheet, ended early
  onShot(e, s, api) {
    if (e.broken) return;
    e.broken = true; if (e.esc) e.esc.alive = false;
    api.game.kill(e, true);
  },
  // the bots read the plan: every mine that will be red when the sheet reaches them
  avoid(e) {
    const out = [], sMax = e.broken ? (e.next - e.sp) : 1e9;
    for (const m of e.mines) if (m.alive && m.arm < 0) out.push({ x: m.x, y: m.y, r: 1.6 });
    // the rest of the line, still to come (unless the plotter is broken)
    if (!e.broken) { const q = pointAt(e.path, progressAt(0, e.from, e.to, e.spd) * e.path.len); out.push({ x: q[0], y: q[1], r: 2.6 }); }
    if (!e.broken) { const end = progressAt(-HARD * e.spd, e.from, e.to, e.spd) * e.path.len; for (let s = e.next; s <= Math.min(end, sMax); s += e.sp) { const q = pointAt(e.path, s); out.push({ x: q[0], y: q[1], r: 1.6 }); } }
    return out;
  },
});
