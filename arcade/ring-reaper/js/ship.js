// STARWAKE: the player's ship, THE WAKE, Yori's redesign 2 (approved by the MCP 2026-11-05): an unarmed courier
// with a slate hex hull, a ring-wing hoop around the tail on three struts, two swept-back nose canards with
// magenta edges, one central engine with a magenta ring nozzle and cyan fire, cyan chines and visor slit, and a
// beacon cradle of three amber hoops on the spine. Geometry: her wake() in scene3d.js, via js/meshes.js.
// Nothing on the Wake is red. The rest of the game only ever sees what buildShip() returns, so a new ship is a
// change to this one function.
// ship-v3 (Yori, 2026-11-07, Evrtek's pick C of the twin-engine mockups: "dual engines side by side, so that it's obvious
// looking at the back that there's a rotation happening"): revision 4 of the hull (models.js SHIP_V 3, the default), the
// one central engine replaced by two bell nozzles out on the outrigger blades, 1.90 apart, and the blades to 1.55. Each
// nozzle has its own flame (`engines` has two entries: main.js scales each flame with throttle and sheds plume sparks per
// entry). The v2 deflector stays as it is, its glint arcs and tip flares riding the new tips. ?ship=v2 keeps revision 3.
// ship-v2 (Yori, 2026-11-07, Evrtek's two notes after play and the first outside playtester's):
//  - revision 3 of the hull (models.js SHIP_V, the default): the ring-wing drawn in and two outrigger blades past it,
//    a cyan line and a cyan tip lamp on each, so the roll has wingtips to sweep. ?ship=v1 builds revision 2.
//  - the deflector no longer swallows the ship. v1 was a wireframe ball and a halo six times the ship's size, "it
//    basically replaces the visual of the ship". v2 keeps the ship the star: two glint arcs that ride the wingtips
//    round the roll, a tip lamp that flares, a thin ripple that runs out to the deflect reach (space.js DEFLECT_R,
//    2.3 m: the rim of what gets sent home) and fades, and cyan sparks the tips shed. Same 0.45 s, driven by rollLook().
import * as THREE from '../vendor/three/three.module.min.js?v=0.6.4';
import { buildModel, SHIP_V } from './models.js?v=0.6.4';
import { DEFLECT_R } from './space.js?v=0.6.4';

const SCALE = 0.85; // root scale: model units to metres
const tmpV = new THREE.Vector3();

export function buildShip(glowTex) {
  const root = new THREE.Group();       // position and yaw/pitch
  const body = new THREE.Group();       // bank and barrel roll spin about the nose axis
  root.add(body);
  const wake = buildModel('wake');
  body.add(wake.group);

  // the engines: a cyan flame per nozzle, stretched with throttle by main.js (her spec: core #8ff6ff, glow #53e6ff).
  // v1/v2: one, central. v3: two, out on the blades at x 0.95, nozzle at z 1.31; each flame sits in a holder scaled to
  // 0.8, so main.js's per-frame scale.set gives a pair of smaller flames rather than two full-size ones. `local` is where
  // the plume sparks start; `size` scales them (main.js).
  const flameMat = () => new THREE.SpriteMaterial({ map: glowTex, color: 0x53e6ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const NOZZLES = SHIP_V === 3 ? [{ x: 0.95, y: 0, z: 1.31, size: 0.8 }, { x: -0.95, y: 0, z: 1.31, size: 0.8 }] : [{ x: 0, y: -0.02, z: 1.36, size: 1 }];
  const engines = NOZZLES.map((n) => {
    const flame = new THREE.Sprite(flameMat()); flame.scale.set(1.1, 1.1, 1);
    const holder = new THREE.Group(); holder.position.set(n.x, n.y, n.z + 0.26); holder.scale.setScalar(n.size); holder.add(flame); body.add(holder);
    return { flame, local: new THREE.Vector3(n.x, n.y, n.z + 0.14), size: n.size };
  });
  // the beacons in the cradle carry a soft amber glow
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb020, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35 }));
  beacon.position.set(0, 0.55, -0.05); beacon.scale.set(0.9, 1.9, 1); body.add(beacon);

  // the deflector: light that exists only while the ship rolls
  const glowMat = (opacity = 0) => new THREE.SpriteMaterial({ map: glowTex, color: 0x53e6ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity });
  const lineMat = (opacity = 0, extra = {}) => new THREE.MeshBasicMaterial(Object.assign({ color: 0x53e6ff, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }, extra));
  let rollLook;
  if (SHIP_V === 1) {
    // v1, as 0.4.0 shipped it: a wireframe shell of light and a halo
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 1), lineMat(0, { wireframe: true }));
    body.add(shell);
    const halo = new THREE.Sprite(glowMat(0));
    halo.scale.set(6, 6, 1); body.add(halo);
    rollLook = (k, dt) => {
      const s = k >= 0 ? Math.sin(k * Math.PI) : 0;
      shell.material.opacity = s * 0.45; halo.material.opacity = s * 0.32;
      shell.rotation.x += dt * 9;
    };
  } else {
    // v2: the wingtips carry the roll. Two glint arcs just past the tips, on the body so they sweep with the blades;
    // a lamp flare at each tip; a ripple ring on the root (it does not spin) that runs out to the deflect reach; sparks.
    // v3: the same look, the tips now at 1.55 (the blades reach past the nozzles)
    const TIP = SHIP_V === 3 ? 1.55 : 1.38, ARC = 1.15, rimR = TIP + 0.16;
    const rimMat = lineMat(0);
    const rim = new THREE.Group(); body.add(rim);
    for (const a0 of [0, Math.PI]) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.045, 5, 18, ARC), rimMat);
      arc.position.z = 0.88; arc.rotation.z = a0 - ARC / 2; rim.add(arc);
    }
    const tips = [new THREE.Vector3(TIP, 0, 0.88), new THREE.Vector3(-TIP, 0, 0.88)];
    const lampMat = glowMat(0.12), lamps = [];
    for (const t of tips) { const l = new THREE.Sprite(lampMat); l.position.copy(t); l.scale.set(0.55, 0.55, 1); body.add(l); lamps.push(l); }
    const rippleMat = lineMat(0);
    const ripple = new THREE.Mesh(new THREE.TorusGeometry(DEFLECT_R / SCALE, 0.035, 5, 72), rippleMat);
    ripple.position.z = 0.4; ripple.visible = false; root.add(ripple);
    rollLook = (k, dt, fx, tier) => {
      const on = k >= 0, s = on ? Math.sin(k * Math.PI) : 0;
      rimMat.opacity = s * 0.95;
      lampMat.opacity = 0.12 + s * 0.8;
      const sz = 0.55 + s * 0.5; for (const l of lamps) l.scale.set(sz, sz, 1);
      ripple.visible = on;
      if (on) { const e = 1 - (1 - k) * (1 - k); ripple.scale.setScalar(0.5 + 0.5 * e); rippleMat.opacity = (1 - k) * (1 - k) * 0.75; }
      // the tips shed a thin thread of cyan sparks that stream back: a twist of light the roll leaves behind, well
      // under the engine's plume (one a frame, small; a phone tier sheds every other frame)
      if (on && fx && (tier > 0 || Math.random() < 0.5)) for (const t of tips) {
        tmpV.copy(t); body.localToWorld(tmpV);
        fx.emit(tmpV.x + (Math.random() - 0.5) * 0.06, tmpV.y + (Math.random() - 0.5) * 0.06, tmpV.z, { life: 0.22, s0: 0.16, s1: 0.03, r: 0.4, g: 0.92, b: 1, a: 0.7, carry: 1 });
      }
    };
  }

  // 0.4.0: the power-ups' looks on the ship (placeholders until Yori's): an aura shell (the Shield Cell's green afterglow,
  // Phase's violet, the Mirror Shell's chrome) and the Mirror Shell's halo ring, both unseen until one runs
  const aura = new THREE.Mesh(new THREE.IcosahedronGeometry(2.45, 1), new THREE.MeshBasicMaterial({ color: 0x4dff8a, wireframe: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  body.add(aura);
  const ringHalo = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.05, 6, 64), new THREE.MeshBasicMaterial({ color: 0xeef2ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  root.add(ringHalo);

  root.scale.setScalar(SCALE);
  // rollLook(k, dt, fx, tier): k is 0..1 through the 0.45 s roll, or -1 when the ship is not rolling
  return { root, body, engines, rollLook, aura, ringHalo, mats: wake.mats, version: SHIP_V };
}
