// LEVEL 4: the star's shape, shared by the surface (scenery.js) and everything that sits on it (flare.js).
// The surface bends away with distance: y drops by curv * z^2 (a horizon you can feel), and at the end of the
// level the limb falls away under you (curv grows, drop grows) as you escape into night.
export const star = { curv: 1 / 26000, drop: 0 };
