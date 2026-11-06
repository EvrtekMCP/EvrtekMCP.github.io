// STARWAKE: the player's ship, THE WAKE, Yori's redesign 2 (approved by the MCP 2026-11-05): an unarmed courier
// with a slate hex hull, a ring-wing hoop around the tail on three struts, two swept-back nose canards with
// magenta edges, one central engine with a magenta ring nozzle and cyan fire, cyan chines and visor slit, and a
// beacon cradle of three amber hoops on the spine. Geometry: her wake() in scene3d.js, via js/meshes.js.
// Nothing on the Wake is red. The rest of the game only ever sees what buildShip() returns, so a new ship is a
// change to this one function.
import * as THREE from '../vendor/three/three.module.min.js?v=0.3.0';
import { buildModel } from './models.js?v=0.3.0';

export function buildShip(glowTex) {
  const root = new THREE.Group();       // position and yaw/pitch
  const body = new THREE.Group();       // bank and barrel roll spin about the nose axis
  root.add(body);
  const wake = buildModel('wake');
  body.add(wake.group);

  // one engine: the cyan flame stretches with throttle (her spec: core #8ff6ff, glow #53e6ff)
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x53e6ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flame.position.set(0, -0.02, 1.62); flame.scale.set(1.1, 1.1, 1); body.add(flame);
  const engines = [{ flame, local: new THREE.Vector3(0, -0.02, 1.5) }];
  // the beacons in the cradle carry a soft amber glow
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb020, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35 }));
  beacon.position.set(0, 0.55, -0.05); beacon.scale.set(0.9, 1.9, 1); body.add(beacon);

  // the deflector: a shell of light that exists only while the ship rolls
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 1), new THREE.MeshBasicMaterial({
    color: 0x53e6ff, wireframe: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  body.add(shell);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x53e6ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  halo.scale.set(6, 6, 1); body.add(halo);

  root.scale.setScalar(0.85);
  return { root, body, engines, shell, halo, mats: wake.mats };
}
