// LEVEL 4: where the shade is. A raft of shield-plates (raft.js) blocks the star's fire on one side of it: fire
// from BELOW (the surface) leaves the column ABOVE a low raft clear; fire from ABOVE (a prominence raining down,
// act 3) leaves the column BELOW a high raft clear. That clear column is the violet corridor the player flies in.
// Rafts register here while they are on the course; the flares ask. Ship-relative metres throughout.

export const rafts = new Set();

// The corridor of raft r at ship-relative z: { cx, hw, y } or null where the raft is not.
export function corridorAt(r, z) {
  const u = r.near - z;                 // metres from the raft's near end, along it
  if (u < 0 || u > r.len) return null;
  return { cx: r.cx(u), hw: r.hw, y: r.y };
}
// Is the point (x, y) at depth z sheltered from fire coming `from` ('below' | 'above')? `margin` widens the
// corridor a little: rule 14, the hitbox favours the player.
export function sheltered(x, y, z, from, margin = 0.3) {
  for (const r of rafts) {
    if (r.from !== from) continue;
    const c = corridorAt(r, z);
    if (!c) continue;
    if (Math.abs(x - c.cx) > c.hw + margin) continue;
    if (from === 'below' ? y >= c.y - 0.2 : y <= c.y + 0.2) return r;
  }
  return null;
}
// How far (x, y) at depth z sits inside a corridor, from its nearer wall (for the SKIM score), or -1
export function insideBy(x, y, z, from) {
  let best = -1;
  for (const r of rafts) {
    if (r.from !== from) continue;
    const c = corridorAt(r, z);
    if (!c) continue;
    if (from === 'below' ? y < c.y - 0.2 : y > c.y + 0.2) continue;
    const d = c.hw - Math.abs(x - c.cx);
    if (d > best) best = d;
  }
  return best;
}
// The fire is clipped where a raft blocks it: the plate height a tongue at (x, z) stops at, or null if no raft
export function blockAt(x, z, from) {
  for (const r of rafts) {
    if (r.from !== from) continue;
    const c = corridorAt(r, z);
    if (c && Math.abs(x - c.cx) < c.hw) return c.y;
  }
  return null;
}
// The star's surface and the prominence ceiling, in metres, for a flight box half-height by
export const surfaceY = (by) => -(by + 4.5);
export const ceilingY = (by) => by + 5.5;
