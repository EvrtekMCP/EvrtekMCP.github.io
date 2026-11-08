// THE LEVIATHAN's body, shared by level 6's chase (the passes) and the boss fight. Yori's head, joints, segments and
// tail (art-incoming/yori/levels/bosses.js, exported to mesh.js by tools/art/export-model.js), chained along a SPINE
// the caller supplies: spine(s) -> [x, y, z] is the body's centre line at arc length s (in Yori's units, times the
// serpent's scale) back from the snout, in the coordinates of `root`'s parent. Every part sits on the spine and turns
// along it, so the body bends. Parts that animate on their own (the lower jaw, the throat, each lens, each joint's
// ring, the tail tips) are split out of her colour groups here by position.
import { THREE, material } from '../../api.js?v=0.4.1';
import { MESH } from './mesh.js?v=0.4.1';

// split each colour group's triangles into parts by a test on the triangle's three corners
function split(groups, partOf) {
  const out = {};
  for (const g of groups) {
    for (let i = 0; i < g.p.length; i += 9) {
      const pts = [[g.p[i], g.p[i + 1], g.p[i + 2]], [g.p[i + 3], g.p[i + 4], g.p[i + 5]], [g.p[i + 6], g.p[i + 7], g.p[i + 8]]];
      const part = partOf(pts, g.color, g.glow), key = part + '|' + g.color + '|' + g.glow;
      (out[key] ||= { part, color: g.color, glow: g.glow, p: [] }).p.push(...g.p.slice(i, i + 9));
    }
  }
  return Object.values(out);
}
const RED = '#ff3355', TRUSS = '#2a2e44';
const PARTS = {
  // the lower jaw (hinges about X at z -2.0) and the throat core between the jaws (it blooms before a volley)
  head: split(MESH.head, (p, c, glow) => (c === TRUSS && p.every((v) => v[2] <= -1.99 && v[1] <= -0.05 && Math.abs(v[0]) <= 1.45) ? 'jaw'
    : glow && p.every((v) => Math.abs(v[0]) < 0.8 && v[2] < -1.9 && v[2] > -3.2 && Math.abs(v[1]) < 0.6) ? 'throat' : 'body')),
  // the red lens standing in the ridge: the weak point
  seg: split(MESH.seg, (p, c, glow) => (glow && p.every((v) => v[1] > 1.7 && Math.abs(v[0]) < 0.7) ? 'lens' : 'body')),
  // the joint's red ring lights in turn
  joint: split(MESH.joint, (p, c, glow) => (glow ? 'ring' : 'body')),
  // the tail's three red tips flash ice-white before a shard drop
  tail: split(MESH.tail, (p, c, glow) => (glow ? 'tips' : 'body')),
};

const geoCache = new Map();
function geo(g) {
  if (!geoCache.has(g)) { const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); b.computeVertexNormals(); b.computeBoundingSphere(); geoCache.set(g, b); }
  return geoCache.get(g);
}
// one part (a head, a segment, ...) as a Group of meshes, one per colour; parts named in `own` get private glowing
// materials so they can change colour on their own
function build(groups, own = []) {
  const group = new THREE.Group(), parts = {}, mats = {};
  for (const g of groups) {
    const mine = g.glow && own.includes(g.part);
    const m = new THREE.Mesh(geo(g), mine ? material(g.color, true, true) : material(g.color, g.glow));
    m.frustumCulled = false;
    if (!parts[g.part]) { parts[g.part] = new THREE.Group(); group.add(parts[g.part]); }
    parts[g.part].add(m);
    if (mine) mats[g.part] = m.material;
  }
  return { group, parts, mats };
}

// arc offsets in Yori's units (leviathan(n) in bosses.js): joint i at 2.7 + 3.4 i, segment i at 5.0 + 3.4 i, the
// tail at 3.4 n + 3.4; the snout is at about -4.4
export const LEV = { joint: (i) => 2.7 + 3.4 * i, seg: (i) => 5.0 + 3.4 * i, tail: (n) => 3.4 * n + 3.4, lensY: 2.05, snout: -4.4 };
export const DEAD = 0x2a2730;

const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tM = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0);
export class Serpent {
  constructor(n = 8, scale = 1.8) {
    this.n = n; this.S = scale;
    this.root = new THREE.Group();
    this.head = build(PARTS.head, ['throat']);
    // the lower jaw turns about the hinge line (x, -0.3, -2.0)
    const jaw = this.head.parts.jaw; this.jawPivot = new THREE.Group(); this.jawPivot.position.set(0, -0.3, -2.0);
    if (jaw) { this.head.group.remove(jaw); jaw.position.set(0, 0.3, 2.0); this.jawPivot.add(jaw); }
    this.head.group.add(this.jawPivot);
    this.items = [{ obj: this.head.group, s: 0, r: 2.1, head: true }];
    this.joints = []; this.segs = [];
    for (let i = 0; i < n; i++) {
      const j = build(PARTS.joint, ['ring']); this.joints.push(j); this.items.push({ obj: j.group, s: LEV.joint(i), r: 1.9, joint: i });
      const sg = build(PARTS.seg, ['lens']); this.segs.push(sg); this.items.push({ obj: sg.group, s: LEV.seg(i), r: 1.8, seg: i });
    }
    this.tail = build(PARTS.tail, ['tips']);
    this.items.push({ obj: this.tail.group, s: LEV.tail(n), r: 1.4, tail: true });
    for (const it of this.items) { it.obj.scale.setScalar(scale); this.root.add(it.obj); it.pos = new THREE.Vector3(); }
    this.length = (LEV.tail(n) + 4) * scale;
    this.maxR = 2.1 * scale; this.bodyR = 1.9 * scale;
  }
  // place every part on the spine; each looks back down it, so Yori's nose (-Z) leads
  pose(spine) {
    const S = this.S;
    for (const it of this.items) {
      const s = it.s * S, p = spine(s), a = spine(s - 1.5), b = spine(s + 1.5);
      it.obj.position.set(p[0], p[1], p[2]); it.pos.set(p[0], p[1], p[2]);
      tA.set(b[0], b[1], b[2]); tB.set(a[0], a[1], a[2]);
      if (tA.distanceToSquared(tB) > 1e-6) { tM.lookAt(tA, tB, UP); it.obj.quaternion.setFromRotationMatrix(tM); }
    }
  }
  // the lens of segment i, in root's parent coordinates (before root's own transform)
  lensAt(i, out) { const g = this.segs[i].group; out.set(0, LEV.lensY, 0); g.updateMatrix(); return out.applyMatrix4(g.matrix); }
  setJaw(open) { this.jawPivot.rotation.x = -open * 0.6; } // negative: the jaw's tip (toward -Z) swings down
  setThroat(k) { const m = this.head.mats.throat; if (m) m.color.setRGB(1, 0.2 + 0.8 * k, 0.33 + 0.67 * k); }
  // a lens: 'lit' (k pulses), 'idle' (dim red), 'dead' (her dark #2a2730), 'hit' (white flash)
  setLens(i, state, k = 1) {
    const m = this.segs[i].mats.lens; if (!m) return;
    if (state === 'dead') m.color.setHex(DEAD);
    else if (state === 'hit') m.color.setHex(0xffffff);
    else if (state === 'lit') m.color.setRGB(1, 0.2 + 0.8 * k, 0.33 + 0.67 * k); // red to white-hot: the target
    else m.color.setRGB(0.6, 0.12, 0.2);
  }
  // a joint's ring: k 0 dark .. 1 red .. 2 white-hot
  setJoint(i, k) { const m = this.joints[i].mats.ring; if (!m) return; const a = Math.min(1, k), w = Math.max(0, k - 1); m.color.setRGB(0.3 + 0.7 * a, 0.06 + 0.14 * a + 0.75 * w, 0.1 + 0.23 * a + 0.62 * w); }
  setTips(k) { const m = this.tail.mats.tips; if (m) m.color.setRGB(1, 0.2 + 0.72 * k, 0.33 + 0.67 * k); }
  // the body's nearest approach to (x, y) on the ship's plane (only parts within dz of it): [gap, item], gap is the
  // distance from the part's surface (negative inside it)
  near(x, y, dz = 2) {
    let best = 1e9, bi = null;
    for (const it of this.items) {
      const r = it.r * this.S;
      if (Math.abs(it.pos.z) > r + dz) continue;
      const d = Math.hypot(it.pos.x - x, it.pos.y - y) - r;
      if (d < best) { best = d; bi = it; }
    }
    return [best, bi];
  }
}
