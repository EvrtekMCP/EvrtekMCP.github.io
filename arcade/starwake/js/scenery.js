// STARWAKE 0.2.0: the scenery manager (ruling 5: the view never goes blank). A level lists the scenery it uses,
// and each of its sections says how much of each it wants: `scenery: { 'crystal-drift': 1, 'gas-giant': 0.6 }`,
// or a function of the section's progress t (0..1). The manager eases every weight toward what the current
// section wants, so nothing switches on or off in a frame, and then:
//  - a STREAM (def.stream) emits decor onto the course at the spawn line as the ship flies, thicker or thinner
//    with its weight. Decor is a course kind (defineDecor), so it condenses out of the haze like everything else.
//  - a SET PIECE (def.init + def.update) is one persistent thing (a planet, a floor, a skyline) that gets its
//    weight every frame and fades itself in and out by it.
// Scenery keeps its own odometer, so it streams on the title screen and carries straight into a run.
import { rng } from './util.js?v=0.3.0';
import { SPAWN_D } from './space.js?v=0.3.0';

export class Scenery {
  constructor(api) {
    this.api = api; this.level = null; this.defs = []; this.state = new Map(); this.w = new Map(); this.cursor = new Map(); this.R = new Map();
    this.odo = 0;
  }
  // cut: a new level (or a restart behind a screen) snaps every weight to the opening section's and fills the
  // whole stretch from the spawn line to the ship, so the first frame of a run is already full of scenery
  setLevel(level, section, cut = true) {
    const api = this.api;
    const old = this.defs;
    this.level = level; this.defs = level.scenery || [];
    for (const d of old) if (!this.defs.includes(d) && d.update && this.state.has(d)) { this.w.set(d, 0); d.update(this.state.get(d), 0, 0, api); }
    for (const d of this.defs) {
      if (d.init && !this.state.has(d)) this.state.set(d, d.init(api) || {});
      if (!this.R.has(d)) this.R.set(d, rng(hash(level.id + ':' + d.name)));
      // a cut: everything at the opening section's weight at once (it happens behind the fade from black)
      if (cut || !this.w.has(d)) this.w.set(d, this.want(d, section, 0));
      if (cut || !this.cursor.has(d)) this.cursor.set(d, this.odo - SPAWN_D - 10);
    }
    if (cut) this._fill(SPAWN_D + 10);
    this.update(0, 0, section, 0);
  }
  want(d, section, t) {
    const s = section && section.scenery; if (!s) return 0;
    const w = s[d.name]; if (w === undefined) return 0;
    return typeof w === 'function' ? w(t) : w;
  }
  // emit everything due up to odo, at the right distance along the track
  _fill() {
    for (const d of this.defs) if (d.stream) this._emit(d, this.w.get(d));
  }
  _emit(d, w) {
    const R = this.R.get(d), st = d.stream, every = st.every || [60, 100];
    let c = this.cursor.get(d);
    while (c <= this.odo) {
      const z = -(SPAWN_D - (this.odo - c));
      if (w > 0.02 && R() < w) {
        let evs = st.place(R, this.api, w);
        if (evs) { if (!Array.isArray(evs)) evs = [evs]; for (const ev of evs) { ev.decor = true; ev.stream = true; this.api.course.spawn(ev, Math.min(20, z + (ev.dz || 0))); } }
      }
      c += every[0] + (every[1] - every[0]) * R();
    }
    this.cursor.set(d, c);
  }
  update(dt, v, section, t) {
    const api = this.api;
    this.odo += v * dt;
    for (const d of this.defs) {
      const target = this.want(d, section, t), rate = d.ease ?? 0.6;
      let w = this.w.get(d) || 0;
      w += (target - w) * (1 - Math.exp(-dt * rate));
      if (Math.abs(target - w) < 0.002) w = target;
      this.w.set(d, w);
      if (d.stream) this._emit(d, w);
      if (d.update) d.update(this.state.get(d), w, dt, api);
    }
  }
  weights() { const o = {}; for (const d of this.defs) o[d.name] = +(this.w.get(d) || 0).toFixed(3); return o; }
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
