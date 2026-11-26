// DEGEN DRIFT: what the cars reflect (11-26; Evrtek 11-25: "can we incorporate realtime reflections off the cars?...
// I want this game to feel like full on cinema quality Tokyo Drift style gameplay"). Two cube maps, drawn from the
// real world (no painted stand-in), read by the cars' finishes (carpaint.js):
//   the course map (every tier): made once per course behind the loading screen, 256 px a face, from 1.6 m over the
//     road about 40 m before the start line (main.js bakeReflections: clear of the start gantry and of tunnels): the
//     sky and the sun, the horizon, the lamps and the neon and their glows, the scenery's silhouettes. Mipmapped, so a
//     rougher finish reads a blurrier level of it.
//   the live map (medium and up, Settings > Car reflections > Live): 128 px a face, riding with the car at roof height
//     and re-drawn one face a frame (two on high), so the lamps, walls, containers and neon slide over the paint as it
//     drives. A new place (a reset, a new run, the garage) draws all six at once so it never shows an empty face.
// Neither shows the car itself, its glows and pools, the smoke, the sparks, the skid marks, the speed lines, the ghost
// or the stars (they are hidden while a face draws), and the world's glow points are drawn at the size they have on the
// screen, scaled to the face (world.js glowMaterial's scale), so a lamp's glow reflects as a glow, not a smear.
// Budget (the brief): about 1.5 ms a frame on medium at the phone viewport. When Car reflections is left on its
// default, the live map gives way to the course map for the rest of the session if its own work averages over 1.5 ms
// for a second, or if frames run slow (over 19.5 ms on average for two seconds of a race) with it on; a chosen Live
// stays on, as a chosen quality tier does. The reason is kept (fallback) and shown on the FPS readout.
import * as THREE from '../vendor/three/three.module.min.js?v=0.1.21';

export const COURSE_SIZE = 256, LIVE_SIZE = 128, BUDGET_MS = 1.5;

export class Reflections {
  constructor(renderer) {
    this.r = renderer;
    const ext = renderer.extensions;
    const type = ext.has('EXT_color_buffer_half_float') || ext.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const target = (n) => new THREE.WebGLCubeRenderTarget(n, { type, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    this.course = target(COURSE_SIZE); this.live = target(LIVE_SIZE);
    this.camC = new THREE.CubeCamera(0.2, 3600, this.course);
    this.camL = new THREE.CubeCamera(0.2, 3600, this.live);
    this.face = 0; this.primed = false; this.at = new THREE.Vector3(1e9, 0, 0);
    this.mode = 'off'; this.facesPerFrame = 0; this.fallback = null; this.cpu = []; this.ema = 0; this.overT = 0; this.slowT = 0;
    this.bakedFor = null; this.bakeMs = 0; this.twins = new Map(); this.sw = [];
  }
  // A face holds linear light; below the high tier the screen takes sRGB, a different program for the same material.
  // Drawing one material both ways each frame flips three.js between its two programs, and every flip costs a full
  // program look-up for that material (measured: the live face's own CPU 0.6 ms a frame on this PC, 3 ms with the CPU
  // slowed 4x as a phone stand-in, against 0.1 ms with no flips). So every material a face draws has a twin that only
  // the faces use: the same shader, the same uniforms (the very objects, so time, fog and colours follow), its own
  // program. Twins are made as needed and let go with the world they belong to (forWorld).
  twin(m) {
    let t = this.twins.get(m);
    if (!t) {
      // a shader's uniforms are shared, not cloned (cloning one that holds a render target's texture, a car's map, warns)
      const u = m.uniforms; if (u) m.uniforms = {};
      t = m.clone();
      if (u) { m.uniforms = u; t.uniforms = u; }
      t.onBeforeCompile = m.onBeforeCompile; this.twins.set(m, t);
    }
    return t;
  }
  swapIn(scene) {
    scene.traverseVisible((x) => { const m = x.material; if (!m || Array.isArray(m)) return; const t = this.twin(m); if (m.color && t.color) t.color.copy(m.color); if (m.opacity !== t.opacity) t.opacity = m.opacity; x.material = t; this.sw.push(x, m); });
  }
  swapOut() { for (let i = 0; i < this.sw.length; i += 2) this.sw[i].material = this.sw[i + 1]; this.sw.length = 0; }
  // a new world lets the last one's twins go (before its shaders are warmed, so the warmed twins are the ones used)
  forWorld(w) { if (this.twinsFor === w) return; for (const t of this.twins.values()) t.dispose(); this.twins.clear(); this.twinsFor = w; }
  // o: { world, hide (objects kept out), fov (the main camera's, degrees), viewH (the box's height, css px) }
  begin(scene, o, size) {
    this.forWorld(o.world);
    this.vis = o.hide.filter(Boolean).map((x) => [x, x.visible]);
    for (const [x] of this.vis) x.visible = false;
    this.swapIn(scene);
    const gm = o.world.root.userData.glowMat;
    // a glow is aSize * 260 * scale / distance pixels; the same angle on a face of this size
    if (gm) { this.gs = gm.uniforms.scale.value; gm.uniforms.scale.value = size * Math.tan(o.fov * Math.PI / 360) / Math.max(200, o.viewH); }
    // no stars: a star is a pixel on the screen but a whole texel of a face, which a mirror-sharp bonnet shows as a dot
    const sm = o.world.root.userData.skyMat; if (sm) sm.uniforms.stars.value = 0;
  }
  end(o) {
    this.swapOut();
    for (const [x, v] of this.vis) x.visible = v;
    const gm = o.world.root.userData.glowMat; if (gm) gm.uniforms.scale.value = this.gs;
    const sm = o.world.root.userData.skyMat; if (sm) sm.uniforms.stars.value = 1;
  }
  // the world's shaders for the cube's target, compiled beside the screen's under the loading screen (a cube face holds
  // linear light; below the high tier the screen takes sRGB, which is another program for every material), so the bake
  // and the first live frame wait on nothing. Resolves when they are linked.
  warm(scene, o) {
    const r = this.r, prev = r.getRenderTarget(), pf = r.getActiveCubeFace(), pm = r.getActiveMipmapLevel();
    this.begin(scene, o, COURSE_SIZE);
    r.setRenderTarget(this.course, 0);
    const done = r.compileAsync(scene, this.camC.children[0] || this.camC);
    r.setRenderTarget(prev, pf, pm);
    this.end(o);
    return done;
  }
  coords(cam) { if (cam.coordinateSystem !== this.r.coordinateSystem) { cam.coordinateSystem = this.r.coordinateSystem; cam.updateCoordinateSystem(); } }
  // the course map, from at (world position), once per course
  bake(scene, at, o) {
    const t0 = performance.now();
    this.coords(this.camC);
    this.camC.position.copy(at); this.camC.updateMatrixWorld(true);
    this.begin(scene, o, COURSE_SIZE);
    this.camC.update(this.r, scene);
    this.end(o);
    this.bakedFor = o.world; this.primed = false; this.bakeMs = performance.now() - t0;
  }
  // the live map: n faces from at (all six the first time, or when the car has jumped). Returns its CPU ms.
  update(scene, at, o, n) {
    const t0 = performance.now(), r = this.r, rt = this.live, cams = this.camL.children;
    const prime = !this.primed || at.distanceToSquared(this.at) > 15 * 15;
    if (prime) { n = 6; this.face = 0; this.primed = true; }
    this.at.copy(at);
    this.coords(this.camL);
    this.camL.position.copy(at); this.camL.updateMatrixWorld(true);
    const pt = r.getRenderTarget(), pf = r.getActiveCubeFace(), pm = r.getActiveMipmapLevel();
    this.begin(scene, o, LIVE_SIZE);
    for (let k = 0; k < n; k++) {
      rt.texture.generateMipmaps = k === n - 1; // the blurred levels once, after the last face of the frame
      r.setRenderTarget(rt, this.face); r.render(scene, cams[this.face]);
      this.face = (this.face + 1) % 6;
    }
    rt.texture.generateMipmaps = true;
    r.setRenderTarget(pt, pf, pm);
    this.end(o);
    const ms = performance.now() - t0;
    if (!prime) { this.cpu.push(ms); if (this.cpu.length > 600) this.cpu.shift(); this.ema += (ms - this.ema) * 0.1; }
    return prime ? -1 : ms;
  }
  // auto only: should the live map give way? (dt: seconds; frameEma: quality.js's smoothed frame ms; racing: a run)
  watch(dt, frameEma, racing) {
    this.overT = this.ema > BUDGET_MS ? this.overT + dt : 0;
    this.slowT = racing && frameEma > 19.5 ? this.slowT + dt : Math.max(0, this.slowT - dt);
    if (this.overT > 1) return `its own work ${this.ema.toFixed(1)} ms`;
    if (this.slowT > 2) return `slow frames (${frameEma.toFixed(1)} ms)`;
    return null;
  }
  dispose() { this.course.dispose(); this.live.dispose(); }
}
