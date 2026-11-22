// DRIFTLINE: the chase camera. It sits behind a blend of the nose and the direction of travel, so in a drift you see
// the car at its angle sliding across the frame (the shot every drift video wants), follows on springs, looks a little
// ahead, kicks its field of view with speed, shakes with the slide and the knocks, and never swings outside the walls.
import * as THREE from '../vendor/three/three.module.min.js?v=0.1.18';
import { TUNING } from './config.js?v=0.1.18';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export class ChaseCam {
  constructor(camera) { this.cam = camera; this.pos = new THREE.Vector3(); this.look = new THREE.Vector3(); this.yaw = 0; this.shakeT = 0; this.kick = 0; this.ready = false; this._p = [0, 0, 0]; }
  snap(car) { this.ready = false; this.update(car, 0.016); }
  hit(strength) { this.kick = Math.min(1, this.kick + strength); }
  update(car, dt, time = 0) {
    const C = TUNING.camera;
    const vYaw = car.speed > 3 ? Math.atan2(car.vx, car.vz) : car.psi;
    const target = car.psi + wrap(vYaw - car.psi) * C.velocityBlend * clamp(car.speed / 8, 0, 1);
    if (!this.ready) this.yaw = target; else this.yaw += wrap(target - this.yaw) * Math.min(1, dt * C.yawStiffness);
    const sx = Math.sin(this.yaw), sz = Math.cos(this.yaw);
    let px = car.x - sx * C.distance, pz = car.z - sz * C.distance;
    // keep the camera inside the walls (plus a little), so it never looks through a rock face
    const tr = car.track, q = tr.closest(px, pz, car.trackI, 30), lim = tr.halfAt(q.i, q.f) + 1.4;
    if (Math.abs(q.lat) > lim) { const lx = tr.tz[q.i], lz = -tr.tx[q.i], over = Math.abs(q.lat) - lim; px -= lx * Math.sign(q.lat) * over; pz -= lz * Math.sign(q.lat) * over; }
    const groundY = tr.heightAt(q.i, q.f);
    const py = Math.max(car.y, groundY) + C.height;
    const want = this._v || (this._v = new THREE.Vector3());
    want.set(px, py, pz);
    if (!this.ready) { this.pos.copy(want); this.ready = true; } else this.pos.lerp(want, Math.min(1, dt * C.stiffness));
    const ahead = C.lookAhead * clamp(car.speed / 20, 0, 1);
    this.look.set(car.x + Math.sin(vYaw) * ahead, car.y + C.lookHeight, car.z + Math.cos(vYaw) * ahead);
    // shake: the slide and speed hum, knocks jolt
    this.kick = Math.max(0, this.kick - dt * 2.2);
    const slide = clamp(Math.abs(car.beta) / 0.6, 0, 1) * clamp(car.speed / 30, 0, 1);
    const amp = C.shake * slide + C.hitShake * this.kick * this.kick;
    const n = (f, o) => Math.sin(time * f + o) * 0.6 + Math.sin(time * f * 2.3 + o * 1.7) * 0.4;
    this.cam.position.set(this.pos.x + n(21, 1) * amp, this.pos.y + n(27, 2) * amp * 0.7, this.pos.z + n(19, 3) * amp);
    this.cam.lookAt(this.look);
    const fov = C.fov + C.fovKick * clamp((car.speed * 3.6 - 40) / 170, 0, 1);
    if (Math.abs(this.cam.fov - fov) > 0.05) { this.cam.fov += (fov - this.cam.fov) * Math.min(1, dt * 3); this.cam.updateProjectionMatrix(); }
  }
}
