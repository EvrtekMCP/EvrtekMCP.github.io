// THE VAULT (galaxy 3, level 9 on: the Vault's headline). Yori's sealed drum of rings behind a red-ringed door
// (g3-enemies.js vault(open)). The plan (4.9): "Vaults open only to a ship running hot on GREED."
//   THE DOOR READS YOUR METER  its eight warm-white lights fill as your GREED meter does, and it swings open while your
//                              GREED is lit. Fly through it hot and its rings are yours (VAULT!).
//   SEALED                     it is a solid drum: fly round it. Its rings stay behind the door and missing them costs
//                              nothing (no combo step, no MISS).
//   FAIR                       in its last 0.75 s it commits: an open door stays open, a shut one stays shut, so it
//                              never slams on you or swings open into your face. The rim is a close call, not a hit.
// Its jackpot is a line of g3-vault-ring events laid through it (`id` ties them to it); they are plain rings that count
// in the ring total (the MCP's default 4: the vault rings are what ★4 and ★5 ask for on the Vault).
//
// Event: { id     a key its rings name
//          nx, ny where its door is, normalised (keep the drum's far edge inside the box's reach: |n| <= 0.65)
//          ask    seconds out the bots should cash in (default 3.4; the Double Down's first vault asks later) }
import { THREE, defineObstacle, buildModel, material, clamp, SHIP_R } from '../../api.js?v=0.5.0';
import { MESH } from './mesh.js?v=0.5.0';

export const SC = 0.62;                       // her drum is 10 across: 6.2 m here
export const RD = 5.0 * SC + 0.15;             // the drum's radius: solid
export const PASS = 1.95;                      // through the door (its ring is 2.4 m; the ship 0.72 m: rule 14 favours you)
const CLIP = 2.45, COMMIT = 0.75, OPEN_T = 0.35;
export const VAULTS = new Map();               // id -> the live vault (its rings ask it whether they count)
let lightMat = null;

// the open door: her vault half-swung (0.9375) morphing to fully open (1): same faces, same order
function openModel() {
  const g = new THREE.Group();
  MESH.ajar.forEach((grp, i) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(grp.p, 3));
    geo.morphAttributes.position = [new THREE.Float32BufferAttribute(MESH.open[i].p, 3)];
    geo.computeVertexNormals(); geo.computeBoundingSphere();
    g.add(new THREE.Mesh(geo, material(grp.color, grp.glow)));
  });
  return g;
}
function make() {
  const root = new THREE.Group(), inner = new THREE.Group(); inner.rotation.y = Math.PI; root.add(inner); // her door faces -Z: turn it to you
  const sealed = buildModel(MESH.sealed).group, open = openModel(); open.visible = false;
  inner.add(sealed, open);
  const lights = [];
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8, s = new THREE.Sprite(lightMat.clone()); s.position.set(Math.cos(a) * 4.5, Math.sin(a) * 4.5, -3.75); s.scale.setScalar(1.7); inner.add(s); lights.push(s); }
  root.userData = { sealed, open, lights };
  return root;
}
function setDoor(e, k) {
  const u = e.obj.userData, ajar = k > 0.001;
  u.sealed.visible = !ajar; u.open.visible = ajar;
  if (ajar) for (const m of u.open.children) m.morphTargetInfluences[0] = clamp(k, 0, 1);
}
const timeTo = (e, api) => -e.z / Math.max(1, api.v);

export default defineObstacle({
  name: 'g3-vault',
  hazard: { cls: 'static', introduced: [3, 9] },
  sample: { id: '_warm', nx: 0, ny: 0 },
  init(api) { lightMat = new THREE.SpriteMaterial({ map: api.glowTex, color: 0xffe0a0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }); },
  // both doors' shaders on the loading screen
  warm(api) { const o = make(); o.position.set(0, 0, -60); setDoor({ obj: o }, 0.5); o.userData.sealed.visible = true; api.scene.add(o); return () => api.scene.remove(o); },
  spawn(e, ev, api) {
    e.obj = api.course.get('g3-vault', make);
    e.sx = e.sy = e.sz = SC;
    e.open = false; e.k = 0; e.locked = false; e.won = false; e.ask = ev.ask ?? 3.4; e.r = RD;
    setDoor(e, 0);
    for (const l of e.obj.userData.lights) l.material.opacity = 0;
    if (ev.id !== undefined) VAULTS.set(ev.id, e);
  },
  update(e, dt, api) {
    const ship = api.ship, G = api.G, u = e.obj.userData;
    // the door: open while GREED is lit, until it commits
    const tt = timeTo(e, api);
    if (!e.locked) {
      const want = !!api.game.greedOn;
      if (want !== e.open) { e.open = want; if (want) { api.game.sfx('g3-vault-open', { vol: 0.8, pan: clamp(e.x / api.box.x * 0.5, -0.8, 0.8) }); api.game.burst(e.x, e.y, e.z + 2, 30, { speed: 10, life: 0.5, s0: 1.2, r: 1, g: 0.88, b: 0.6, carry: 1 }); } }
      if (e.z < 0 && tt < COMMIT) e.locked = true;
    }
    e.k = clamp(e.k + (e.open ? 1 : -1) * dt / OPEN_T, 0, 1);
    setDoor(e, e.open ? 0.05 + 0.95 * e.k : e.k);
    // the meter lights: as many of eight as your GREED meter is full; all of them while it is lit
    const lit = e.open ? 8 : Math.floor(clamp(G.greed || 0, 0, 100) / 100 * 8 + 1e-6);
    u.lights.forEach((l, i) => { l.material.opacity = i < lit ? (e.open ? 0.95 : 0.8) : 0.06; });
    api.pose(e);
    if (e.crossed) {
      const d = Math.hypot(ship.x - e.x, ship.y - e.y);
      if (e.open && d < PASS) { e.won = true; api.game.call('VAULT!', 'c-cyan'); api.game.sfx('g3-vault', { vol: 0.9 }); api.game.shake(0.25); }
      else if (e.open && d < CLIP) api.game.scrape(e);
      else if (d < RD + SHIP_R * 0.6) api.game.crash(e, 22, false);
    }
    if (e.z > 30) e.alive = false;
  },
  remove(e, api) { if (VAULTS.get(e.ev.id) === e) VAULTS.delete(e.ev.id); if (e.obj) api.course.put('g3-vault', e.obj); },
  // the bots: steer round a shut drum; into an open one (its rings say so); cash in when one is near (the plan's 12.5)
  avoid(e) { return e.open ? null : [{ x: e.x, y: e.y, r: RD + 1.5 }]; },
  greedAsk(e, api) { const t = timeTo(e, api); return !e.open && !e.locked && e.z < 0 && t > 0.9 && t < e.ask; },
  greedHold(e, api) { const t = timeTo(e, api); return !e.open && e.z < 0 && t >= e.ask && t < e.ask + 9; },
  // the blocked-moment check (0.3.1's): where it is solid as it crosses, shut (the worst case)
  solid(ev, B) { const cx = (ev.nx || 0) * B.x, cy = (ev.ny || 0) * B.y; return [{ at: 0, dist: (x, y) => Math.hypot(x - cx, y - cy) - RD }]; },
});
