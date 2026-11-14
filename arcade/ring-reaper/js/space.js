// STARWAKE 0.2.0: the space the course lives in, and the numbers every kind shares.
// SHIP-RELATIVE: the ship sits at z = 0 flying toward -Z; the course streams toward it at the current speed.
// x and y are metres inside the flight box (box.x, box.y); events are authored in the normalised box (nx, ny).
import * as THREE from '../vendor/three/three.module.min.js?v=0.6.4';
import { smoothstep } from './util.js?v=0.6.4';

// ---- ruling 5 (no pop-in). The fog is fully opaque at 760 m of depth. Everything on the course is born at
// SPAWN_D, past that, at zero size, and grows to full size by APPEAR_D, where it is still about 80 % fog. So no
// object's picture ever jumps from nothing to something; it condenses out of the haze.
export const FOG_NEAR = 160, FOG_FAR = 760;
export const SPAWN_D = 800;
export const APPEAR_D = 640;
// Rule 12 / 13 (Quorra's checklist): the warning clock starts where a thing is READABLE, about 70 % fog.
export const READ_D = 580;
// 0.1.0 spawned at 680 m. The level-1 behaviours that ran from their birth (a pod's sideways drift, which shooters
// a stray reflected shot may pick) still start at this line, so level 1 plays exactly as it did.
export const LEGACY_LINE = 680;
// 0 at the spawn line, 1 by APPEAR_D: multiply a thing's drawn size by this (api.pose does it for you)
export const appear = (z) => smoothstep(SPAWN_D, APPEAR_D, -z);

// ---- the ship and shots (0.1.0's numbers, unchanged)
export const SHIP_R = 0.72;      // the ship's hit radius: a touch inside its wings, so near-misses feel fair
export const RING_R = 1.75;      // a ring counts when the ship's centre passes inside this
export const HIT_R = 0.78, GRAZE_R = 2.5, DEFLECT_R = 2.3;
export const SHOT_T = 1.25;      // seconds an aimed shot takes to reach the ship's plane
// 0.3.1, roll-or-hit fire (levels.js FIRE): a NET's bolts sit NET_S apart (no hole a ship fits: 1.3 / sqrt(3) = 0.75 m,
// under HIT_R) and take NET_T to reach your plane (a kind may ask a little longer: opts.netT)
export const NET_S = 1.3, NET_T = 0.4;

// ---- rule 9: the colour vocabulary, the same in every level. Scenery never uses these as large flat colour.
export const HUES = { hurts: 0xff3355, collect: 0xffcc33, reflected: 0x53e6ff };

const tmpM = new THREE.Matrix4(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpC = new THREE.Color();
// One instanced mesh for many copies of one thing (rocks, mines, decor). begin(), put() each copy, end().
// While the course runs a kind's update, Instanced.cur is that entity, so the pop-in test can measure exactly
// what was drawn for it.
export class Instanced {
  constructor(scene, geo, mat, cap) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap); this.mesh.count = 0; this.cap = cap;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    this.geoR = geo.boundingSphere.radius;
    scene.add(this.mesh); this.n = 0;
  }
  begin() { this.n = 0; }
  put(x, y, z, q, sx, sy, sz, color) {
    if (this.n >= this.cap) return;
    tmpP.set(x, y, z); tmpS.set(sx, sy, sz); tmpM.compose(tmpP, q, tmpS);
    this.mesh.setMatrixAt(this.n, tmpM);
    if (color !== undefined) this.mesh.setColorAt(this.n, tmpC.setHex(color));
    this.n++;
    if (Instanced.probe && Instanced.cur) Instanced.probe(Instanced.cur, x, y, z, this.geoR * Math.max(sx, sy, sz));
  }
  end() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; }
}
Instanced.cur = null; Instanced.probe = null;
