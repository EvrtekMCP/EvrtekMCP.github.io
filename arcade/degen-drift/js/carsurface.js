// DEGEN DRIFT: what the tires are on, for the sound (kerb stripes, rumble, gravel crunch) and a touch of grip, and
// what is round the car (a tunnel's reverb, a bridge's slap). Pure JS.
// - In the lane: asphalt. The kerbs inside each corner (the rule the road's shader paints them by): kerb, full grip.
// - Past the lane's edge on a runoff apron (the painted stripes on 10 of the courses): it rumbles like a kerb, and the
//   paint is a little slicker (APRON grip): runoff saves you from the wall, it is not a faster line.
// - Past the lane's edge with no apron (the shoulder by the wall): gravel, and less grip (SHOULDER).
// - track.kind 2 is a tunnel, 3 a bridge.
const APRON = 0.95, SHOULDER = 0.88;
export class Surface {
  constructor(track) {
    this.track = track;
    this.kerb = new Float32Array(track.n);
    for (const zn of track.zones) {
      const a = zn.s0 + zn.len * Math.max(0.1, zn.apexT - 0.35), b = zn.s0 + zn.len * Math.min(0.95, zn.apexT + 0.3);
      for (let s = a; s < b; s += track.step) this.kerb[Math.floor(track.wrapS(s) / track.step) % track.n] = zn.side;
    }
    this.grip = 1;
  }
  // the surface under the car's rear wheels: 'kerb', 'gravel' or 'asphalt'; sets this.grip for the tires
  under(car) {
    const tr = this.track, i = car.trackI, half = tr.half[i], k = this.kerb[i];
    const lo = tr.laneOff ? tr.laneOff[i] : 0, lh = tr.laneHalf ? Math.min(half, tr.laneHalf[i]) : half, apron = half - lh > 0.3;
    let out = 'asphalt', grip = 1;
    for (const side of [1, -1]) {
      const lat = car.lat + side * 0.8, ax = Math.abs(lat - lo);
      if (ax > lh) { if (apron) { out = 'kerb'; grip = Math.min(grip, APRON); } else { out = 'gravel'; grip = Math.min(grip, SHOULDER); } }
      else if (out === 'asphalt' && k && k * (lat - lo) > 0 && ax > lh - 1.05) out = 'kerb';
    }
    this.grip = grip;
    return out;
  }
  space(car) { const k = this.track.kind[car.trackI]; return k === 2 ? 'tunnel' : k === 3 ? 'bridge' : 'open'; }
}
