// LEVEL 9: THE MIRROR GATE. Yori's look sheet: "the mirror faces show a second Wake". A great hexagonal mirror
// stands across the lane, and in it a second Wake flies straight at you: your own reflection, exact (the ship's
// pose reflected through the mirror's plane, so it banks when you bank and rolls when you roll), except that it
// lies a little: its engine burns ghost-pink and it moves a tenth of a second behind you. Cracks run across the
// glass as it closes, and it shatters into glitter before it can reach you. Scenery, not a hazard: it never touches
// you. Two in the level: the Hall of Mirrors opens with one (the breakdown), and the Twins come out of the second.
import { THREE, defineDecor, buildModel, clamp } from '../../api.js?v=0.6.3';

// R_GATE: corner radius (its flat sides are 0.87 of it). It stands turned TILT about Y: straight on, your reflection
// would sit dead behind your own ship from the chase camera; turned, it flies in from one side, clear of the lane.
const R_GATE = 22, TILT = 0.2, LAG = 0.1, SHATTER_Z = -16, MAG = 2.6;
const tmpM = new THREE.Matrix4(), tmpR = new THREE.Matrix4(), tmpE = new THREE.Euler(), tmpQ = new THREE.Quaternion(), tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3();

let glassOnce = null;
export function glassTex() {
  if (glassOnce) return glassOnce;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  r.addColorStop(0, 'rgba(60,50,110,0.18)'); r.addColorStop(0.7, 'rgba(176,154,255,0.22)'); r.addColorStop(1, 'rgba(223,230,242,0.5)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  // three soft diagonal sheen bands: it reads as glass at a glance
  g.globalCompositeOperation = 'lighter';
  for (const [x, w, a] of [[70, 26, 0.16], [118, 8, 0.22], [176, 40, 0.08]]) { g.save(); g.translate(128, 128); g.rotate(-0.6); g.fillStyle = 'rgba(244,248,255,' + a + ')'; g.fillRect(x - 128 - w / 2, -200, w, 400); g.restore(); }
  glassOnce = new THREE.CanvasTexture(c); glassOnce.colorSpace = THREE.SRGBColorSpace; return glassOnce;
}
function crackTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 2.2; g.lineCap = 'round';
  let s = 77; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 9; i++) { let a = i / 9 * Math.PI * 2 + rnd() * 0.4, x = 128, y = 128; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { a += (rnd() - 0.5) * 0.7; const L = 12 + rnd() * 16; x += Math.cos(a) * L; y += Math.sin(a) * L; g.lineTo(x, y); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function make(api) {
  const g = new THREE.Group();
  const geo = new THREE.CircleGeometry(R_GATE, 6); geo.rotateZ(Math.PI / 6);
  const glass = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: glassTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const cracks = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: crackTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  cracks.position.z = 0.05;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R_GATE, 0.45, 4, 6), new THREE.MeshStandardMaterial({ color: 0x4a3a8a, metalness: 0.5, roughness: 0.3, flatShading: true }));
  rim.rotation.z = Math.PI / 6;
  const edge = new THREE.Mesh(new THREE.TorusGeometry(R_GATE - 0.55, 0.12, 3, 6), new THREE.MeshBasicMaterial({ color: 0xf4f8ff }));
  edge.rotation.z = Math.PI / 6;
  g.add(glass, cracks, rim, edge);
  // the second Wake: her ship in its own colours (a mirror does not lie about those), faintly pearl-tinted and
  // see-through, on private copies of its materials
  const ghost = buildModel('wake').group;
  const mats = new Map();
  ghost.traverse((o) => { if (!o.isMesh) return; const m0 = o.material; let m = mats.get(m0); if (!m) { m = m0.clone(); m.transparent = true; m.color.lerp(new THREE.Color(0xe0d0ff), 0.2); if (m.emissive) m.emissive.setHex(0x1a1430); mats.set(m0, m); } o.material = m; });
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: api.glowTex, color: 0xff9ad0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  flame.position.set(0, -0.02, 1.62); flame.scale.set(1.1, 1.1, 1); ghost.add(flame);
  const holder = new THREE.Group(); holder.matrixAutoUpdate = false; holder.add(ghost);
  g.userData = { glass, cracks, edge, holder, mats: [...mats.values()], flame };
  return g;
}
export const mirrorGate = defineDecor({
  name: 'l9-mirror',
  sample: { x: 0, y: 0 },
  init() {},
  spawn(e, ev, api) {
    e.obj = api.course.get('l9-mirror', () => make(api));
    const ud = e.obj.userData;
    if (!ud.holder.parent) api.scene.add(ud.holder);
    ud.holder.visible = true; ud.cracks.material.opacity = 0; ud.glass.material.opacity = 1;
    e.hist = []; e.broken = false; e.tilt = (ev.side || 1) * TILT; e.obj.rotation.y = e.tilt;
  },
  remove(e, api) { e.obj.userData.holder.visible = false; api.course.put('l9-mirror', e.obj); },
  update(e, dt, api) {
    const ud = e.obj.userData, a = e.appear;
    api.pose(e);
    if (e.broken) { e.obj.visible = false; ud.holder.visible = false; if (e.z > 30) e.alive = false; return; }
    // the cracks run as it closes; at SHATTER_Z it bursts into glitter that streams past you
    const crack = clamp((e.z + 70) / (70 + SHATTER_Z), 0, 1);
    ud.cracks.material.opacity = crack * crack;
    if (e.z > SHATTER_Z && !e.ev.warm) {
      e.broken = true;
      for (let i = 0; i < 3; i++) api.game.burst(e.x, e.y, e.z, 60, { speed: 14 + i * 6, life: 0.9, s0: 1.6 - i * 0.3, r: 0.85 + i * 0.07, g: 0.8 + i * 0.1, b: 1, carry: 1, drag: 0.6 });
      api.game.sfx('deflect', { rate: 0.55, vol: 0.9 }); api.game.sfx('boom', { rate: 1.7, vol: 0.35 }); api.game.shake(0.35);
      return;
    }
    // the reflection: the Wake's pose as main.js draws it, a tenth of a second ago, through the plane z = e.z
    const ship = api.ship, G = api.G;
    let spin = 0;
    if (G.rolling) { const k = clamp(G.rollT / 0.45, 0, 1); spin = -G.rollDir * Math.PI * 2 * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2); }
    e.hist.push([api.time, ship.x, ship.y, ship.vx, ship.vy, spin]);
    while (e.hist.length > 2 && e.hist[1][0] <= api.time - LAG) e.hist.shift();
    const [, x, y, vx, vy, sp] = e.hist[0];
    const bank = clamp(-vx * 0.075, -1.15, 1.15) + sp;
    tmpQ.setFromEuler(tmpE.set(vy * 0.03, -vx * 0.014, bank, 'XYZ'));
    // (and it is bigger than you are: the glass is very slightly concave. Reflections lie.)
    tmpM.compose(tmpP.set(x, y, 0), tmpQ, tmpS.setScalar(0.85 * MAG));
    // reflection through the plane n.X = n.P (n = the glass's normal, turned TILT about Y): X' = X - 2 (n.X - n.P) n
    const nx = Math.sin(e.tilt), nz = Math.cos(e.tilt), dP = nx * e.x + nz * e.z;
    tmpR.set(1 - 2 * nx * nx, 0, -2 * nx * nz, 2 * dP * nx, 0, 1, 0, 0, -2 * nz * nx, 0, 1 - 2 * nz * nz, 2 * dP * nz, 0, 0, 0, 1);
    ud.holder.matrix.multiplyMatrices(tmpR, tmpM); ud.holder.matrixWorldNeedsUpdate = true;
    // only where the glass is: the sight-line from the chase camera to the image must cross the glass inside its rim
    const ix = ud.holder.matrix.elements[12], iy = ud.holder.matrix.elements[13], iz = ud.holder.matrix.elements[14];
    const cx = x * 0.62, cy = y * 0.62 + 2.8, cz = 9.2, den = nx * (ix - cx) + nz * (iz - cz);
    const t = den ? (dP - nx * cx - nz * cz) / den : 0, qx = cx + (ix - cx) * t - e.x, qy = cy + (iy - cy) * t - e.y, qz = cz + (iz - cz) * t - e.z;
    const inside = clamp((R_GATE * 0.8 - Math.hypot(qx, qy, qz)) / 3, 0, 1);
    // it comes up out of the haze with the mirror (the image is twice as far away as the glass)
    const show = a * clamp((420 + e.z) / 200, 0, 1) * inside;
    ud.holder.visible = show > 0.01;
    for (const m of ud.mats) m.opacity = 0.9 * show;
    ud.flame.material.opacity = show;
    ud.edge.material.color.setRGB(0.9 + 0.1 * crack, 0.9 + 0.1 * crack, 1);
  },
});
