// DEGEN DRIFT: where the rival is heard (day 5). Its car is a second voice of the sound module (audio/driftaudio.js
// voice(): its own synthesised engine and tyres, voiced from its car and its parts the way yours is), placed from the
// camera, which is where you hear the world from:
//   - quieter with distance, and duller (the air takes the top off a far car first);
//   - panned to the side it is on, and a little duller still when it is behind you;
//   - carried through a delay that follows the distance, which is what Doppler is: the pitch rises while it closes on
//     you and drops as it pulls away. Sound is made slower here than in the air (C) so the shift is heard between two
//     cars that run together, where the real one would be a few cents.
// It plays through the car bus, so pausing, muting and the tunnel's echo apply to it as to your car.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const C = 343 / 2.4;        // m/s: the speed of the sound for the Doppler (2.4 times the real shift)
const REF = 7, ROLL = 0.85, BASE = 0.9, MAXD = 0.9; // full level inside 7 m (the camera to your own car); max delay s

export class RivalVoice {
  // sound: the game's adapter (js/sound.js); its loaded module has voice() once audio is unlocked. Returns null when
  // there is no module (the placeholder synth) or no Web Audio: the duel then runs as before, the rival silent.
  static make(sound, seed) {
    const mod = sound && sound.mod, v = mod && mod.voice ? mod.voice({ seed }) : null;
    return v && v.out ? new RivalVoice(sound.ctx || v.out.context, v) : null;
  }
  constructor(ctx, v) {
    this.ctx = ctx; this.v = v;
    this.delay = ctx.createDelay(1.0); this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 0.5;
    this.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null; this.gain = ctx.createGain(); this.gain.gain.value = 0;
    v.out.connect(this.delay).connect(this.lp);
    (this.pan ? this.lp.connect(this.pan) : this.lp).connect(this.gain).connect(v.bus);
    this.d = null; this.on = false; this.hintsKey = '';
  }
  setCar(preset, hints, redline) {
    const k = JSON.stringify([preset, hints, redline]); if (k === this.hintsKey) return; this.hintsKey = k;
    this.v.setHints(preset, hints, redline);
  }
  setOn(on) {
    if (on === this.on) return; this.on = on; this.v.setActive(on);
    const t = this.ctx.currentTime; this.gain.gain.cancelScheduledValues(t); this.gain.gain.setTargetAtTime(on ? this.level || 0 : 0, t, on ? 0.05 : 0.08);
    if (!on) this.d = null;
  }
  shift(cut) { this.v.shift(cut); }
  // every frame: the rival's car, the camera, and the surface under its wheels
  frame(car, camera, surface) {
    if (!this.on) return;
    this.v.update({ rpm: car.rpm, throttle: car.throttle, boost: car.boost, share: Math.max(car.slipR, car.slipF), speed: car.speed, surface: surface || 'asphalt' });
    const m = camera.matrixWorld.elements, cp = camera.position;
    const dx = car.x - cp.x, dy = car.y + 0.5 - cp.y, dz = car.z - cp.z, d = Math.max(0.5, Math.hypot(dx, dy, dz));
    const right = (dx * m[0] + dy * m[1] + dz * m[2]) / d, front = -(dx * m[8] + dy * m[9] + dz * m[10]) / d;
    const t = this.ctx.currentTime, delay = Math.min(MAXD, d / C);
    this.level = BASE / (1 + Math.max(0, d - REF) / REF * ROLL);
    const cut = clamp(20000 / (1 + d / 20), 1500, 18000) * (front < -0.2 ? 0.7 : 1);
    if (this.d === null || Math.abs(delay - this.d) > 0.06) {
      // a jump (a new leg, a reset onto the road): no swoop, the delay is set outright under a dip in the level
      this.delay.delayTime.cancelScheduledValues(t); this.delay.delayTime.setValueAtTime(delay, t);
      this.gain.gain.cancelScheduledValues(t); this.gain.gain.setValueAtTime(0, t); this.gain.gain.setTargetAtTime(this.level, t + 0.03, 0.06);
    } else {
      this.delay.delayTime.setTargetAtTime(delay, t, 0.06); // the distance changing smoothly: Doppler
      this.gain.gain.setTargetAtTime(this.level, t, 0.06);
    }
    this.d = delay;
    this.lp.frequency.setTargetAtTime(cut, t, 0.08);
    if (this.pan) this.pan.pan.setTargetAtTime(clamp(right * 0.85, -0.85, 0.85), t, 0.06);
  }
  dispose() { this.setOn(false); this.v.dispose(); try { this.gain.disconnect(); } catch (e) { /* gone */ } }
}
