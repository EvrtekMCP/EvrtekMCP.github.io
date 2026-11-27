// DEGEN DRIFT: the roadside kit, modelled in code (11-26, graphics uplift part 2). Each piece is a small merged
// geometry in metres, standing on its base at the origin and facing +z, with its own colours (albedo) per vertex and
// an `emit` share for the parts that light themselves (a lamp, a screen, a beacon). The world bakes its light into a
// copy (detail.js place()); tools/kitglb.mjs exports each one to art/models/dd-kit-<id>.glb for the Asset Console
// (every 3D asset is a studio asset). Pure geometry: nothing here touches the page, so Node can build them too.
// Moving pieces return { base, moving, pivot }: the moving part turns about the pivot in the world's frame loop.
import * as THREE from '../../vendor/three/three.module.min.js?v=0.1.25';

const col = new THREE.Color();
// one coloured part: any three.js geometry, moved and turned into place, painted one colour (sRGB hex), emit 0..1
function part(g, hex, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, emit = 0 } = {}) {
  if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  const n = g.index ? g.toNonIndexed() : g, cnt = n.attributes.position.count;
  col.set(hex);
  const c = new Float32Array(cnt * 3), e = new Float32Array(cnt).fill(emit);
  for (let i = 0; i < cnt; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  n.setAttribute('color', new THREE.BufferAttribute(c, 3)); n.setAttribute('emit', new THREE.BufferAttribute(e, 1));
  if (n.attributes.uv) n.deleteAttribute('uv');
  return n;
}
const box = (w, h, d, hex, o = {}) => part(new THREE.BoxGeometry(w, h, d), hex, o);
const cyl = (rt, rb, h, seg, hex, o = {}) => part(new THREE.CylinderGeometry(rt, rb, h, seg), hex, o);
// paint vertices by a rule (y, normal) -> hex or null (keep)
function repaint(g, fn) { const p = g.attributes.position, nm = g.attributes.normal, c = g.attributes.color; for (let i = 0; i < p.count; i++) { const h = fn(p.getY(i), nm.getX(i), nm.getY(i), nm.getZ(i), p.getX(i), p.getZ(i)); if (h) { col.set(h); c.setXYZ(i, col.r, col.g, col.b); } } return g; }
export function merge(parts) {
  const out = new THREE.BufferGeometry();
  for (const [nm, size] of [['position', 3], ['normal', 3], ['color', 3], ['emit', 1]]) {
    const total = parts.reduce((a, g) => a + g.attributes[nm].count, 0), arr = new Float32Array(total * size);
    let o = 0; for (const g of parts) { arr.set(g.attributes[nm].array, o); o += g.attributes[nm].array.length; }
    out.setAttribute(nm, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}

// ---------------------------------------------------------------- the harbour
// a counterbalance forklift, forks forward (+z), a beacon on the guard
export function forklift() {
  const Y = '#e0a020', D = '#24242a', K = '#141416', G = '#4a4a52', P = [];
  P.push(box(1.15, 0.55, 2.2, Y, { y: 0.5 }), box(1.18, 0.72, 0.5, D, { y: 0.72, z: -0.95 }), box(1.0, 0.2, 1.0, Y, { y: 0.86, z: -0.1 }));
  for (const [x, z] of [[-0.55, 0.72], [0.55, 0.72], [-0.55, -0.72], [0.55, -0.72]]) P.push(cyl(0.3, 0.3, 0.24, 10, K, { rz: Math.PI / 2, x, y: 0.3, z }));
  for (const [x, z] of [[-0.5, -0.62], [0.5, -0.62], [-0.5, 0.42], [0.5, 0.42]]) P.push(box(0.06, 1.28, 0.06, D, { x, y: 1.42, z }));
  P.push(box(1.1, 0.06, 1.14, D, { y: 2.08, z: -0.1 }), box(0.5, 0.32, 0.45, K, { y: 1.12, z: -0.38 }), box(0.5, 0.5, 0.08, K, { y: 1.4, z: -0.62 }));
  P.push(box(0.1, 2.6, 0.12, G, { x: -0.36, y: 1.3, z: 1.18 }), box(0.1, 2.6, 0.12, G, { x: 0.36, y: 1.3, z: 1.18 }), box(0.82, 0.1, 0.1, G, { y: 2.55, z: 1.18 }), box(0.82, 0.32, 0.06, G, { y: 0.32, z: 1.28 }));
  P.push(box(0.1, 0.05, 1.1, '#8a8a92', { x: -0.26, y: 0.1, z: 1.86 }), box(0.1, 0.05, 1.1, '#8a8a92', { x: 0.26, y: 0.1, z: 1.86 }));
  P.push(box(0.13, 0.11, 0.13, '#ff9020', { y: 2.17, z: -0.5, emit: 1 }), box(0.22, 0.14, 0.06, '#fff2d0', { x: -0.42, y: 2.0, z: 0.5, emit: 0.8 }), box(0.22, 0.14, 0.06, '#fff2d0', { x: 0.42, y: 2.0, z: 0.5, emit: 0.8 }));
  return merge(P);
}
// a traffic cone: orange, one white band, a square black foot
export function cone() {
  const g = part(new THREE.CylinderGeometry(0.025, 0.16, 0.66, 10, 6), '#ff5a14', { y: 0.37 });
  repaint(g, (y) => (y > 0.42 && y < 0.6 ? '#ecece8' : null));
  return merge([g, box(0.4, 0.04, 0.4, '#141416', { y: 0.02 })]);
}
// pallets stacked with a wrapped load on top (variant 0: shrink-wrapped, 1: cardboard boxes, 2: bare pallets)
export function pallets(v = 0) {
  const W = '#9a7a50', P = [];
  const pallet = (y) => { P.push(box(1.2, 0.03, 1.0, W, { y: y + 0.13 }), box(1.2, 0.025, 1.0, W, { y: y + 0.012 })); for (const x of [-0.55, 0, 0.55]) P.push(box(0.12, 0.09, 1.0, '#7a5a38', { x, y: y + 0.07 })); };
  const n = v === 2 ? 5 : 1; for (let k = 0; k < n; k++) pallet(k * 0.145);
  if (v === 0) P.push(box(1.14, 0.95, 0.96, '#c8d2e2', { y: 0.145 + 0.475 }));
  if (v === 1) { P.push(box(0.56, 0.46, 0.96, '#b08a5a', { x: -0.29, y: 0.375 }), box(0.56, 0.46, 0.96, '#a8824e', { x: 0.29, y: 0.375 }), box(0.56, 0.4, 0.96, '#b48e60', { x: -0.29, y: 0.805 })); }
  return merge(P);
}
// a water-filled plastic barrier, 2 m long (the instance colour makes it red or white)
export function barrier() {
  const s = new THREE.Shape(); s.moveTo(-0.3, 0); s.lineTo(0.3, 0); s.lineTo(0.3, 0.12); s.lineTo(0.13, 0.32); s.lineTo(0.1, 0.8); s.lineTo(-0.1, 0.8); s.lineTo(-0.13, 0.32); s.lineTo(-0.3, 0.12); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.96, bevelEnabled: false }); g.translate(0, 0, -0.98);
  return merge([part(g, '#ecebe6'), box(0.14, 0.06, 0.2, '#3a3a40', { y: 0.82, z: 0.6 })]);
}
// tyres stacked (drift culture: the wall of old rubber by the start)
export function tyres(n = 5) {
  const P = []; for (let k = 0; k < n; k++) { const y = 0.105 + k * 0.215, dx = (k % 2 ? 0.03 : -0.02); P.push(cyl(0.34, 0.34, 0.21, 12, '#18181c', { x: dx, y }), cyl(0.2, 0.2, 0.215, 12, '#060608', { x: dx, y })); }
  return merge(P);
}
// a 200 litre drum (the instance colour paints it)
export function drum() {
  const g = part(new THREE.CylinderGeometry(0.29, 0.29, 0.88, 12, 4), '#d8d8dc', { y: 0.44 });
  repaint(g, (y, nx, ny) => (Math.abs(ny) > 0.9 ? '#9a9aa0' : (Math.abs(y - 0.22) < 0.03 || Math.abs(y - 0.66) < 0.03) ? '#a8a8ae' : null));
  return merge([g]);
}
// a cable spool on its side
export function spool() {
  return merge([cyl(0.62, 0.62, 0.07, 14, '#8a6a44', { rz: Math.PI / 2, x: -0.44, y: 0.62 }), cyl(0.62, 0.62, 0.07, 14, '#8a6a44', { rz: Math.PI / 2, x: 0.44, y: 0.62 }), cyl(0.48, 0.48, 0.82, 12, '#1c1c22', { rz: Math.PI / 2, y: 0.62 })]);
}
// a mooring bollard on the quay
export function bollard() {
  const g = part(new THREE.CylinderGeometry(0.2, 0.17, 0.62, 10, 3), '#26262c', { y: 0.31 });
  repaint(g, (y) => (y > 0.36 && y < 0.5 ? '#e0b020' : null));
  return merge([g, cyl(0.26, 0.26, 0.08, 10, '#26262c', { y: 0.64 })]);
}
// a ship-to-shore container crane: legs astride the quay (x along it), the boom reaching out over the water (+z), the
// machinery house and back-reach over the land (-z), the driver's cab under the boom with its window lit. 70 m tall.
// Moving: the trolley and a container on the spreader, running out and back along the boom.
// span: the legs' spread across the quay (16 m; 33 m where a road runs between them)
export function stsCrane(hex = '#2f62b0', span = 16) {
  const P = [], D = '#1c2230', W = '#e8e4dc', h = span / 2;
  for (const x of [-9, 9]) for (const z of [-h, h]) P.push(box(1.3, 40, 1.3, hex, { x, y: 20, z }));
  for (const x of [-9, 9]) P.push(box(1.4, 2.2, span + 1.3, hex, { x, y: 40.6, z: 0 }));
  if (span < 20) for (const x of [-9, 9]) P.push(box(1.1, 1.6, span + 1.3, hex, { x, y: 12, z: 0 }));
  for (const z of [-h, h]) P.push(box(19.3, 1.8, 1.4, hex, { y: 41, z }), box(19.3, 1.2, 1.1, hex, { y: span < 20 ? 2.2 : 9, z }));
  for (const x of [-9, 9]) { const L = Math.hypot(span, 28), a = Math.atan2(28, span); P.push(box(1.0, 1.0, L, hex, { x, y: 26, z: 0, rx: span < 20 ? 0.72 : -a })); }
  P.push(box(3.2, 2.6, 92, W, { y: 44, z: 12 }));                             // the boom and the girder behind
  for (const x of [-1.6, 1.6]) { P.push(box(0.8, 30, 0.8, hex, { x, y: 58, z: -6, rx: -0.12 }), box(0.8, 30, 0.8, hex, { x, y: 58, z: -2, rx: 0.12 })); }
  P.push(box(4.2, 1.2, 3.2, hex, { y: 72.5, z: -4 }));                         // the apex
  P.push(box(0.4, 0.4, 62, D, { x: -1.2, y: 58, z: 26, rx: 0.48 }), box(0.4, 0.4, 62, D, { x: 1.2, y: 58, z: 26, rx: 0.48 })); // forestays
  P.push(box(0.4, 0.4, 36, D, { y: 58, z: -20, rx: -0.78 }));                 // the backstay
  P.push(box(9, 6, 11, W, { y: 48.6, z: -22 }), box(9.2, 0.4, 11.2, '#9a9aa4', { y: 51.8, z: -22 }));
  P.push(box(2.6, 2.6, 3.2, W, { y: 41, z: 10 }), box(2.4, 1.2, 0.08, '#ffd89a', { y: 41.3, z: 11.62, emit: 1 }), box(0.08, 1.2, 2.6, '#ffd89a', { x: 1.32, y: 41.3, z: 10, emit: 1 }), box(0.08, 1.2, 2.6, '#ffd89a', { x: -1.32, y: 41.3, z: 10, emit: 1 }));
  for (const x of [-9, 9]) for (const z of [-h, h]) P.push(box(1.8, 1.4, 2.6, D, { x, y: 0.7, z }));
  const T = [box(4, 2.2, 5, '#d8d4cc', { y: -1.6 }), box(0.15, 14, 0.15, '#20202a', { x: -1.2, y: -9.6 }), box(0.15, 14, 0.15, '#20202a', { x: 1.2, y: -9.6 }), box(2.7, 0.6, 12.4, '#e8b020', { y: -16.6 }), box(2.6, 2.6, 12.2, '#b0402a', { y: -18.2 })];
  return { base: merge(P), moving: merge(T), pivot: [0, 43.2, 0], reach: [-10, 50] };
}

// ---------------------------------------------------------------- the canyon
// an oil pumpjack: the frame and the samson post stand still; the walking beam with its horsehead nods (moving, about
// the pivot on the post's top)
export function pumpjack() {
  const D = '#2e2e34', Y = '#d08a2a', P = [];
  P.push(box(1.6, 0.4, 7.2, D, { y: 0.2, z: -0.4 }), box(0.9, 0.5, 1.4, '#3a3a40', { y: 0.65, z: -3.2 }));
  for (const x of [-0.55, 0.55]) { P.push(box(0.22, 4.4, 0.22, D, { x, y: 2.3, z: -0.55, rx: 0.16 }), box(0.22, 4.4, 0.22, D, { x, y: 2.3, z: 0.55, rx: -0.16 })); }
  P.push(box(1.4, 0.3, 0.5, D, { y: 4.35, z: 0 }), box(1.1, 1.0, 1.2, '#4a3a30', { y: 0.9, z: -2.6 }));
  P.push(box(0.5, 0.9, 0.5, '#5a5a60', { y: 0.45, z: 3.3 }), box(0.12, 2.6, 0.12, '#8a8a92', { y: 1.9, z: 3.3 }));
  const B = [box(0.42, 0.55, 6.6, D, { y: 0, z: 0.4 }), box(0.5, 1.6, 0.9, Y, { y: -0.35, z: 3.75 }), box(0.5, 0.9, 0.5, Y, { y: -1.0, z: 3.4 }), box(1.4, 0.9, 1.1, '#3a3a40', { y: -0.2, z: -2.9 }), box(0.2, 2.2, 0.2, D, { x: 0.45, y: -1.2, z: -2.6 }), box(0.2, 2.2, 0.2, D, { x: -0.45, y: -1.2, z: -2.6 })];
  return { base: merge(P), moving: merge(B), pivot: [0, 4.6, 0] };
}
// a farm water-pumping windmill: a lattice tower, a tail vane; the wheel of blades turns (moving, about its hub)
export function windpump() {
  const G = '#9a9aa2', P = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const g = new THREE.BoxGeometry(0.1, 11.4, 0.1); const t = Math.atan(1.2 / 11.4); g.rotateZ(sx * t); g.rotateX(-sz * t); P.push(part(g, G, { x: sx * 0.95, y: 5.6, z: sz * 0.95 })); } // the legs lean in to the head
  for (const [y, w] of [[2.4, 1.6], [5.6, 1.15], [8.8, 0.72]]) for (const [rx, ry] of [[0, 0], [0, Math.PI / 2]]) { P.push(box(w * 2, 0.06, 0.06, G, { y, z: w, ry })); P.push(box(w * 2, 0.06, 0.06, G, { y, z: -w, ry })); void rx; }
  P.push(box(0.7, 0.12, 0.7, '#6a6a72', { y: 11.3 }), box(0.3, 0.3, 1.4, '#5a5a62', { y: 11.7, z: -0.2 }), box(0.05, 1.3, 2.0, '#a83228', { y: 11.8, z: -1.9 }), box(0.06, 0.06, 2.2, G, { y: 11.7, z: -1.0 }));
  const B = []; for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2, g = new THREE.BoxGeometry(0.34, 1.5, 0.03); g.rotateY(0.35); g.translate(0, 1.15, 0); g.rotateZ(a); B.push(part(g, '#c8c8cc')); }
  B.push(part(new THREE.TorusGeometry(1.75, 0.035, 4, 24), '#a8a8b0'), part(new THREE.TorusGeometry(0.75, 0.03, 4, 18), '#a8a8b0'), cyl(0.16, 0.16, 0.3, 8, '#5a5a62', { rx: Math.PI / 2 }));
  return { base: merge(P), moving: merge(B), pivot: [0, 11.7, 0.62] };
}

// ---------------------------------------------------------------- the mountain pass
// a pile of cut logs, ends out (along x)
export function logs() {
  const P = []; const rows = [[4, 0.23], [3, 0.23], [2, 0.22]];
  let y = 0.23; for (const [n, r] of rows) { for (let k = 0; k < n; k++) { const g = part(new THREE.CylinderGeometry(r, r * 1.05, 4.2, 8), '#4a3324', { rz: Math.PI / 2, x: (k - (n - 1) / 2) * 0.02, y, z: (k - (n - 1) / 2) * r * 2.05 }); repaint(g, (yy, nx) => (Math.abs(nx) > 0.9 ? '#c49a64' : null)); P.push(g); } y += r * 1.75; }
  return merge(P);
}

// ---------------------------------------------------------------- the neon city
// a drinks machine: a dark body, its lit front (the instance colour tints the glow)
export function vending() {
  return merge([box(1.0, 1.9, 0.78, '#1e1e26', { y: 0.95 }), box(0.78, 1.15, 0.03, '#e8f4ff', { y: 1.22, z: 0.4, emit: 1 }), box(0.3, 0.32, 0.03, '#ffffff', { x: 0.22, y: 0.42, z: 0.4, emit: 0.7 }), box(1.02, 0.08, 0.8, '#3a3a48', { y: 1.94 })]);
}

// ---------------------------------------------------------------- the summit
// a slatted snow fence, 6 m long
export function snowFence() {
  const W = '#6a5040', P = [];
  for (const x of [-2.9, 0, 2.9]) P.push(box(0.1, 1.7, 0.1, '#4a382c', { x, y: 0.85 }));
  for (let k = 0; k < 4; k++) P.push(box(6.0, 0.17, 0.035, W, { y: 0.35 + k * 0.33, z: 0.07 }));
  return merge(P);
}
// a weather mast: pole, arm, an anemometer's cups that spin (moving, about the pole's top) and a small solar panel
export function weatherMast() {
  const P = [cyl(0.05, 0.07, 6, 6, '#b8b8c0', { y: 3 }), box(1.4, 0.05, 0.05, '#b8b8c0', { y: 5.4 }), box(0.5, 0.6, 0.3, '#d8d8e0', { y: 1.3, z: 0.12 }), box(0.7, 0.04, 0.5, '#1a2a4a', { y: 2.4, z: 0.3, rx: -0.6 }), box(0.06, 0.25, 0.5, '#c02020', { x: 0.7, y: 5.6 })];
  const M = [cyl(0.03, 0.03, 0.2, 6, '#c8c8d0', { y: 0 })]; for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; M.push(box(0.4, 0.02, 0.02, '#c8c8d0', { x: Math.cos(a) * 0.2, y: 0.1, z: Math.sin(a) * 0.2, ry: -a }), box(0.1, 0.1, 0.1, '#e8e8f0', { x: Math.cos(a) * 0.42, y: 0.1, z: Math.sin(a) * 0.42 })); }
  return { base: merge(P), moving: merge(M), pivot: [-0.7, 5.5, 0] };
}

// a snow pole: red and white bands, an amber reflector at the top
export function snowPole() { const g = part(new THREE.CylinderGeometry(0.045, 0.05, 2.4, 6, 6), '#e8e8f0', { y: 1.2 }); repaint(g, (y) => (Math.floor(y / 0.4) % 2 === 0 ? '#b01010' : null)); return merge([g, box(0.07, 0.14, 0.02, '#ffb040', { y: 2.22, z: 0.05, emit: 0.7 })]); }

// ---------------------------------------------------------------- shared
// a road sign's post and the back of its board (the face is a picture drawn on the board in the world: detail.js)
export function signPost(h = 2.3) {
  return merge([box(0.08, h, 0.08, '#8a8a92', { y: h / 2 }), box(0.86, 0.86, 0.03, '#3a3a42', { y: h + 0.1, z: -0.03, rz: Math.PI / 4 })]);
}
// a flag pole, 8 m, a gilt ball on top (the cloth is drawn by the world: detail.js flags)
export function flagPole() { return merge([cyl(0.05, 0.08, 8, 8, '#c8c8d0', { y: 4 }), part(new THREE.SphereGeometry(0.1, 8, 6), '#d8b048', { y: 8.05 }), box(0.3, 0.2, 0.3, '#3a3a40', { y: 0.1 })]); }
// a portable work-light tower: a trailer, a mast, four lamps on a bar (lit)
export function lightTower() {
  const P = [box(1.1, 0.7, 2.2, '#e8c020', { y: 0.65 }), box(0.18, 0.18, 1.0, '#3a3a40', { y: 0.45, z: 1.5 }), cyl(0.28, 0.28, 0.2, 10, '#141416', { rz: Math.PI / 2, x: -0.62, y: 0.28 }), cyl(0.28, 0.28, 0.2, 10, '#141416', { rz: Math.PI / 2, x: 0.62, y: 0.28 })];
  for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) P.push(box(0.08, 0.5, 0.08, '#3a3a40', { x, y: 0.25, z }));
  P.push(box(0.14, 6.4, 0.14, '#5a5a62', { y: 4.1 }), box(1.8, 0.12, 0.12, '#3a3a40', { y: 7.25 }));
  for (const x of [-0.72, -0.24, 0.24, 0.72]) P.push(box(0.4, 0.32, 0.16, '#2a2a30', { x, y: 7.35, z: 0.12, rx: 0.5 }), box(0.34, 0.26, 0.03, '#fffaf0', { x, y: 7.3, z: 0.22, rx: 0.5, emit: 1 }));
  return merge(P);
}

// every piece by its Asset Console id (tools/kitglb.mjs exports these)
export const KIT = {
  'dd-kit-forklift': ['Forklift', forklift], 'dd-kit-cone': ['Traffic cone', cone], 'dd-kit-pallets': ['Pallets with a load', () => pallets(0)],
  'dd-kit-barrier': ['Water-filled barrier', barrier], 'dd-kit-tyres': ['Tyre stack', () => tyres(5)], 'dd-kit-drum': ['Oil drum', drum], 'dd-kit-spool': ['Cable spool', spool],
  'dd-kit-bollard': ['Mooring bollard', bollard], 'dd-kit-sts-crane': ['Ship-to-shore crane', () => stsCrane()], 'dd-kit-pumpjack': ['Oil pumpjack', pumpjack],
  'dd-kit-windpump': ['Windpump', windpump], 'dd-kit-logs': ['Log pile', logs], 'dd-kit-vending': ['Drinks machine', vending], 'dd-kit-snow-fence': ['Snow fence', snowFence],
  'dd-kit-weather-mast': ['Weather mast', weatherMast], 'dd-kit-sign-post': ['Road sign post', () => signPost()], 'dd-kit-light-tower': ['Work-light tower', lightTower], 'dd-kit-flag-pole': ['Flag pole', flagPole], 'dd-kit-snow-pole': ['Snow pole', snowPole],
};
