// THE HEDDLE (galaxy 3, level 10, THE WEFTWORK, act 2, THE SHED; the plan's 4.10). Yori's heddle (art-incoming/yori/g3/
// g3-enemies.js heddle): a steel frame across the lane holding two LAYERS of ultraviolet warp thread, one hanging from
// above and one standing from below, with a steel bar along each layer's edge. The gap between the layers is the SHED,
// the only way through. The layers rise and fall: the shed you see far out is not where it will be.
//   THE PLAN   `tel` seconds (1.3; the first 1.6) before the layers move, the plan of the shed draws in white where it
//              will be when you reach it (galaxy 3's promise: the white plan never lies).
//   THE MOVE   then the layers slide there together over `move` s (0.55), and hold, `lead` s (0.45) before you arrive.
// ev: gy (the shed's middle when you reach it, normalised along its normal: -1..1 of the box), from (where it starts,
//     default the middle), gh (its height, metres; default 3.4), a (the frame's angle: 0 = layers above and below, PI/2 =
//     layers left and right), tel, move, lead.
// Timed by time to arrival (-z / speed), never the clock, so it reaches you as the course laid it at any speed.
import { THREE, defineObstacle, buildModel, clamp, smoothstep, SHIP_R } from '../../api.js?v=0.6.2';
import { MESH } from './mesh.js?v=0.6.2';

const W = 26, TOP = 14, PITCH = 1.3;                    // her layer: 26 wide, pitch 1.3; her frame's beams at +-14
const arriveOf = (e, api) => -e.z / Math.max(1, api.v);
let FRAME = null, threadGeo = null, threadMat = null, barGeo = null, barMat = null, planMat = null, bandMat = null;
// her frame alone (graphite posts and beams): the layers and the plan are drawn live from her numbers
function frameGroups() {
  if (FRAME) return FRAME;
  return (FRAME = MESH.heddle.filter((g) => g.color === '#1e1f27'));
}
// one layer's threads as one geometry: every thread one unit long, standing on y = 0, so scale.y is its length
function threads() {
  const pos = [], t = 0.09;
  for (let x = -W / 2 + PITCH / 2; x < W / 2; x += PITCH) {
    const x0 = x - t, x1 = x + t, z0 = -t, z1 = t;
    const q = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    q([x0, 0, z1], [x1, 0, z1], [x1, 1, z1], [x0, 1, z1]); q([x1, 0, z0], [x0, 0, z0], [x0, 1, z0], [x1, 1, z0]);
    q([x0, 0, z0], [x0, 0, z1], [x0, 1, z1], [x0, 1, z0]); q([x1, 0, z1], [x1, 0, z0], [x1, 1, z0], [x1, 1, z1]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeBoundingSphere();
  return g;
}
function makeHeddle() {
  const g = new THREE.Group();
  g.add(buildModel(frameGroups()).group);
  const layer = (sgn) => {
    const l = new THREE.Group();
    const th = new THREE.Mesh(threadGeo, threadMat); th.scale.y = 10; th.rotation.z = sgn > 0 ? 0 : Math.PI; l.add(th);  // up from the edge, or down
    const bar = new THREE.Mesh(barGeo, barMat); l.add(bar);  // the steel bar along the layer's edge: the edge of the shed
    l.userData = { th };
    g.add(l); return l;
  };
  const up = layer(1), down = layer(-1);
  // the plan: two white lines (the shed's edges where it will be) and a faint band between them
  const planT = new THREE.Mesh(barGeo, planMat), planB = new THREE.Mesh(barGeo, planMat), band = new THREE.Mesh(barGeo, bandMat);
  g.add(planT, planB, band);
  g.userData = { up, down, planT, planB, band };
  return g;
}

export default defineObstacle({
  name: 'g3-heddle',
  hazard: { cls: 'sweep', introduced: [3, 10], warn: (ev) => (ev.lead ?? 0.45) + (ev.move ?? 0.55) + (ev.tel ?? 1.3) },
  sample: { gy: 0, from: 0.4, gh: 3.4 },
  // 0.3.1's no-blocked check: where it is solid as it reaches your plane (the same shape its hit tests): both layers,
  // everything outside the shed where the plan put it. The distance from a ship centre to the nearer layer's edge.
  solid(ev, B) {
    const a = ev.a || 0, nx = -Math.sin(a), ny = Math.cos(a), half = Math.abs(nx) * B.x + Math.abs(ny) * B.y, c1 = clamp(ev.gy || 0, -1, 1) * half, h = (ev.gh || 3.4) / 2;
    return [{ dist: (x, y) => h - Math.abs(x * nx + y * ny - c1) }];
  },
  init() {
    threadGeo = threads();
    threadMat = new THREE.MeshBasicMaterial({ color: 0x9a6aff });   // her loom thread, lit
    barGeo = new THREE.BoxGeometry(1, 1, 1);
    barMat = new THREE.MeshStandardMaterial({ color: 0x8a94a8, metalness: 0.5, roughness: 0.45, flatShading: true });
    planMat = new THREE.MeshBasicMaterial({ color: 0xe8eeff, transparent: true, opacity: 0, depthWrite: false });
    bandMat = new THREE.MeshBasicMaterial({ color: 0xe8eeff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  },
  spawn(e, ev, api) {
    e.obj = api.course.get('g3-heddle', makeHeddle);
    // its own plan materials, so two heddles in sight draw their plans apart
    const ud = e.obj.userData;
    if (!ud.own) { ud.own = true; ud.planT.material = ud.planB.material = planMat.clone(); ud.band.material = bandMat.clone(); }
    e.x = 0; e.y = 0; e.sx = e.sy = e.sz = 1; e.hit = false;
    e.a = ev.a || 0; e.obj.rotation.set(0, 0, e.a);
    // the half-height of the box along the shed's normal (for gy and from)
    const B = api.box, nx = -Math.sin(e.a), ny = Math.cos(e.a);
    e.half = Math.abs(nx) * B.x + Math.abs(ny) * B.y;
    e.c1 = clamp(ev.gy || 0, -1, 1) * e.half; e.c0 = clamp(ev.from ?? 0, -1.6, 1.6) * e.half;
    e.gh = ev.gh || 3.4; e.tel = ev.tel ?? 1.3; e.move = ev.move ?? 0.55; e.lead = ev.lead ?? 0.45;
    e.c = e.c0; e.sounded = false;
  },
  update(e, dt, api) {
    const ud = e.obj.userData, arrive = arriveOf(e, api), t1 = e.lead, t0 = t1 + e.move, tt = t0 + e.tel;
    let plan = 0, k = 0;
    if (arrive <= tt && arrive > t0) plan = 1 - (arrive - t0) / e.tel;
    else if (arrive <= t0) { plan = 1; k = arrive > t1 ? smoothstep(0, 1, 1 - (arrive - t1) / e.move) : 1; }
    if (k > 0 && !e.sounded) { e.sounded = true; if (e.z > -400) api.game.sfx('g3-heddle', { vol: 0.5 }); }
    e.c = e.c0 + (e.c1 - e.c0) * k;
    // the layers: one hangs from the top beam to the shed's upper edge, one stands from the bottom beam to its lower edge
    const top = e.c + e.gh / 2, bot = e.c - e.gh / 2;
    ud.up.position.y = top; ud.up.userData.th.scale.y = Math.max(0.01, TOP - top);
    ud.down.position.y = bot; ud.down.userData.th.scale.y = Math.max(0.01, bot + TOP);
    for (const l of [ud.up, ud.down]) { const bar = l.children[1]; bar.scale.set(W + 1, 0.5, 0.6); bar.position.set(0, 0, 0); }
    // the plan: the white edges of the shed where it will be, drawing in from the middle out
    const draw = smoothstep(0, 0.25, plan * e.tel), shown = plan > 0 && arrive > -0.2;
    const pm = ud.planT.material, op = shown ? (k < 1 ? 0.85 : 0.45) * (0.85 + 0.15 * Math.sin(e.t * 20)) : 0;
    pm.opacity = op; ud.band.material.opacity = shown ? 0.07 : 0;
    const th = 0.14 + Math.max(0, -e.z) * 0.005;        // at range the plan's lines widen, so they stay a few pixels
    ud.planT.scale.set(W * draw, th, 0.2); ud.planT.position.set(0, e.c1 + e.gh / 2, -0.5);
    ud.planB.scale.set(W * draw, th, 0.2); ud.planB.position.set(0, e.c1 - e.gh / 2, -0.5);
    ud.band.scale.set(W * draw, e.gh, 0.1); ud.band.position.set(0, e.c1, -0.6);
    api.pose(e);
    // the hit, as it reaches you: anywhere outside the shed is a crash; its edge close is a CLOSE call
    if (e.crossed && !e.hit) {
      const sx = api.ship.x, sy = api.ship.y, ln = -sx * Math.sin(e.a) + sy * Math.cos(e.a), off = Math.abs(ln - e.c), m = SHIP_R * 0.6;
      if (off > e.gh / 2 - m) { e.hit = true; api.game.crash({ x: sx, y: sy, type: e.type, kind: e.kind }, 18); }
      else if (off > e.gh / 2 - m - 0.7) api.game.scrape(e, e.gh / 2 - off);
    }
    if (e.z > 30) e.alive = false;
  },
  // the test pilots: two huge circles, one beyond each layer's edge, where the shed will be
  avoid(e) {
    const R = 60, nx = -Math.sin(e.a), ny = Math.cos(e.a), c = e.c1, h = e.gh / 2;
    return [{ x: nx * (c + h + R), y: ny * (c + h + R), r: R + 1.0 }, { x: nx * (c - h - R), y: ny * (c - h - R), r: R + 1.0 }];
  },
});
