// DEGEN DRIFT (11-26 (4), Evrtek on test v23: "black boxes sometimes appearing randomly"): a guard for the new shaders, and
// the two diagnostic switches for his phone.
//   SAFE (GLSL): ddBad(v) is true for a NaN or an infinity, read from the number's bits (a compiler allowed to assume no
//   NaN, as Metal's fast maths is, cannot fold this test away the way it can isnan); ddSafe(c) gives 0 for a bad channel
//   and caps the rest at 64, so a bad value adds nothing to an additive layer and never reaches a half-float target (the
//   cars' reflection cubes, where one bad texel blurs into a black patch through the mipmaps).
//   The NaN view (Settings has no switch: the five-tap panel's 'NaN view', or ?debug=nan): every fragment shader the
//   game compiles paints magenta wherever its final colour is NaN or infinite, and the guards stand down (DD_NANVIEW) so
//   a raw fault shows where it is born rather than as black. Black that stays black in the NaN view is not a shader's
//   number: it is the GPU or the browser (then the 'MSAA' switch, below, is the next thing to try).
//   MSAA off (the five-tap panel's 'MSAA', or ?aa=0): the game starts without multisampling (as phones did before 0.1.22),
//   to tell a multisampling fault from anything else. Both are kept in this browser and take effect on the next start.
const KEY = 'driftline.diag.v1';
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
const saved = load();
export const DIAG = { nan: q.getAll('debug').includes('nan') || !!saved.nan, aa: q.get('aa') === '0' ? false : saved.aa !== false };
export function setDiag(k, v) { const s = load(); s[k] = v; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* not kept */ } }

export const SAFE = `
#ifndef DD_SAFE_GLSL
#define DD_SAFE_GLSL
bool ddBad(float v) { return (floatBitsToUint(v) & 0x7f800000u) == 0x7f800000u; }
float ddSafe(float v) {
#ifdef DD_NANVIEW
  return v;
#else
  return ddBad(v) ? 0.0 : min(v, 64.0);
#endif
}
vec3 ddSafe(vec3 c) { return vec3(ddSafe(c.r), ddSafe(c.g), ddSafe(c.b)); }
#endif
`;

// the NaN view: before the first shader compiles (main.js boot), every fragment shader gets the magenta check after its
// own main() and the guards' stand-down define; vertex shaders are left alone
export function installNanView() {
  if (!DIAG.nan || typeof WebGL2RenderingContext === 'undefined') return false;
  const P = WebGL2RenderingContext.prototype, src0 = P.shaderSource;
  P.shaderSource = function (sh, src) {
    if (!/gl_Position/.test(src) && /void\s+main\s*\(\s*\)/.test(src)) {
      const out = /\bpc_fragColor\b/.test(src) ? 'pc_fragColor' : 'gl_FragColor';
      src = src.replace(/(#version[^\n]*\n)/, '$1#define DD_NANVIEW 1\n').replace(/void\s+main\s*\(\s*\)/, 'void ddMainNanView()')
        + `\nbool ddBadNV(float v) { return (floatBitsToUint(v) & 0x7f800000u) == 0x7f800000u; }\nvoid main() { ddMainNanView(); vec4 c = ${out}; if (ddBadNV(c.r) || ddBadNV(c.g) || ddBadNV(c.b) || ddBadNV(c.a)) ${out} = vec4(1.0, 0.0, 1.0, 1.0); }\n`;
    }
    return src0.call(this, sh, src);
  };
  return true;
}
