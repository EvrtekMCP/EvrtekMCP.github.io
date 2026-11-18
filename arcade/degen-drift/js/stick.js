// DEGEN DRIFT: the phone stick's shaping (11-17 (2), with the launch grip in car.js). The floating stick reads how far
// the thumb has moved from where it landed, full at 62 px. Before, that was the steering, straight: a thumb resting
// on the glass wanders 1-3 px, which steered, and the first few px of a correction gave as much as the last. Now a
// small dead zone (steer.stickDead of the travel) and a curve (steer.stickCurve: 1 = straight, more = gentler at
// first): full travel is still full lock. assist.launchGrip 0 (the tuning panel's switch) gives the stick back
// straight. Pure, so the Node tools (tools/launch.mjs) shape the stick exactly as the game does.
export function shapeStick(x, S, A) {
  const g = A.launchGrip || 0, a = Math.abs(x);
  if (!g || !(a > 0)) return x;
  const dz = S.stickDead || 0, n = a <= dz ? 0 : Math.min(1, (a - dz) / (1 - dz));
  const shaped = Math.sign(x) * Math.pow(n, S.stickCurve || 1);
  return x + (shaped - x) * Math.min(1, g);
}
