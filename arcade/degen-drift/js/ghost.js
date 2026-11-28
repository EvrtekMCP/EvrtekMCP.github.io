// DEGEN DRIFT: your best run's ghost. Every run records the car's place ten times a second; when a run sets a new best
// on a course, that recording is kept (in this browser, about 20 KB a course) and the next run there shows it as a
// translucent cyan car driving your best line beside you, at the same moment of the lap. Settings can turn it off.
// Two draws (a see-through body and its edges), no physics, nothing to collide with. Fed by the HUD every frame of a
// run and told the result by the results screen, so main.js knows nothing of it.
import * as THREE from '../vendor/three/three.module.min.js?v=0.1.26';
import { BODIES, outlineOf } from './carbodies.js?v=0.1.26';

const KEY = (id) => 'driftline.ghost.v1.' + id;
const DT = 0.1, TAU = Math.PI * 2;
function encode(arr) { const b = new Uint8Array(new Int16Array(arr).buffer); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
function decode(str) { const s = atob(str), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return new Int16Array(b.buffer); }
function load(id) { try { const j = JSON.parse(localStorage.getItem(KEY(id)) || 'null'); return j && j.v === 1 ? { score: j.score, d: decode(j.d), ox: j.ox, oz: j.oz, oy: j.oy, car: j.car || 'kestrel' } : null; } catch (e) { return null; } }

export class Ghost {
  constructor(game) {
    this.g = game; this.rec = null; this.best = null; this.course = null; this.lastT = -1;
    // a car in cyan glass with brighter edges, in the outline of the car that set the best (day 4, the cars builder:
    // each body's own side profile from carbodies.js, pushed out to its width; the KESTREL for ghosts saved before)
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.75, 1.0), transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending });
    const lmat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.45, 0.95, 1.0), transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
    this.mesh = new THREE.Group(); this.mesh.name = 'ghost';
    this.mats = [mat, lmat]; this.mesh.visible = false; this.mesh.renderOrder = 4;
    this.shape('kestrel');
    game.scene.add(this.mesh);
  }
  shape(id) {
    if (this.bodyId === id) return;
    for (const o of [...this.mesh.children]) { this.mesh.remove(o); o.geometry.dispose(); }
    // 11-16 (cars builder, Portero 002): the rebuilt body's own silhouette, arches and all, every 10 cm
    const B = BODIES[id] || BODIES.kestrel, sh = new THREE.Shape();
    const prof = outlineOf(B).body.filter((p, k) => k % 2 === 0);
    prof.forEach(([z, h], k) => (k ? sh.lineTo(z, h) : sh.moveTo(z, h)));
    const W = B.W * 0.96, body = new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: false });
    body.rotateY(-Math.PI / 2); body.translate(W / 2, 0, 0);
    const cab = new THREE.BoxGeometry(W * 0.98, 0.05, B.L * 0.9); cab.translate(0, 0.2, 0); // the floor line
    for (const g of [body, cab]) { this.mesh.add(new THREE.Mesh(g, this.mats[0])); this.mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), this.mats[1])); }
    this.bodyId = id;
  }
  on() { return this.g.settings.ghost !== false; }
  begin() {
    this.course = this.g.course.id; this.rec = []; this.lastT = -1;
    this.best = this.on() ? load(this.course) : null;
    if (this.best) this.shape(this.best.car);
    const t = this.g.track; this.ox = Math.round(t.x[0]); this.oz = Math.round(t.z[0]); this.oy = Math.round(t.y[0]);
  }
  // every frame of a run (the HUD calls it)
  frame(car, sc, run) {
    const g = this.g; if (g.state !== 'run' && g.state !== 'countdown') return;
    if (this.course !== g.course.id || !this.rec || run.time < this.lastT - 0.5) this.begin();
    this.lastT = run.time;
    // record, relative to the start line so the numbers stay small (0.1 m, and the heading in 1/5000 rad)
    if (g.state === 'run') while (this.rec.length / 4 * DT <= run.time && this.rec.length < 4 * 3600) {
      const psi = ((car.psi % TAU) + TAU) % TAU;
      this.rec.push(Math.round((car.x - this.ox) * 10), Math.round((car.z - this.oz) * 10), Math.round((car.y - this.oy) * 10), Math.round(psi * 5000));
    }
    // play the best run at the same moment
    const B = this.best, m = this.mesh;
    if (!B || !this.on()) { m.visible = false; return; }
    const n = B.d.length / 4, f = run.time / DT, i = Math.min(n - 2, Math.floor(f)), k = Math.min(1, f - i);
    if (i < 0 || f >= n - 1) { m.visible = false; return; }
    const a = i * 4, b = a + 4, lerp = (p, q) => p + (q - p) * k;
    const x = lerp(B.d[a], B.d[b]) / 10 + B.ox, z = lerp(B.d[a + 1], B.d[b + 1]) / 10 + B.oz, y = lerp(B.d[a + 2], B.d[b + 2]) / 10 + B.oy;
    let p0 = B.d[a + 3] / 5000, p1 = B.d[b + 3] / 5000; if (p1 - p0 > Math.PI) p1 -= TAU; if (p0 - p1 > Math.PI) p1 += TAU;
    m.position.set(x, y, z); m.rotation.y = lerp(p0, p1);
    // fade when it is on top of you (an overlap reads as a glitch), and when far ahead or behind
    const d = Math.hypot(x - car.x, z - car.z), fade = Math.min(1, Math.max(0, (d - 2.5) / 5)) * (1 - Math.min(1, Math.max(0, (d - 120) / 80)));
    this.mats[0].opacity = 0.22 * fade; this.mats[1].opacity = 0.75 * fade;
    m.visible = fade > 0.02;
  }
  // the results screen: a new best keeps this run's recording as the course's ghost
  end(result) {
    if (!result || !result.newBest || !this.rec || this.rec.length < 4 * 20 || this.course !== this.g.course.id) return false;
    try { localStorage.setItem(KEY(this.course), JSON.stringify({ v: 1, car: this.g.progress.car, score: result.score, ox: this.ox, oz: this.oz, oy: this.oy, d: encode(this.rec) })); } catch (e) { return false; }
    return true;
  }
  visible(on) { if (!on) this.mesh.visible = false; }
}
