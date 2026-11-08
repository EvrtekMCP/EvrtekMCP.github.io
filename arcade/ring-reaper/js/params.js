// STARWAKE 0.4.0: Evrtek's preview switches (?ship=, ?streak=, ?reward=, ?dev). The claude.ai artifact never hands the
// page its query string, only a #anchor of [A-Za-z0-9._~-] (the MCP, 11-07), so a switch is also read from the hash:
// tokens split on '.', each name-value (#ship-v1, #reward-2, #streak-old, #ship-v1.reward-3), or a bare name for a flag
// (#dev). The query string wins when it names the switch. -> the value, '' for a bare flag, null when neither names it.
// Test-only switches (test, auto, splash=0, noprefetch, aac, tier) stay on the query string.
export function param(name) {
  if (typeof location === 'undefined') return null;
  const q = new URLSearchParams(location.search);
  if (q.has(name)) return q.get(name);
  for (const t of (location.hash || '').replace(/^#/, '').split('.')) {
    if (t === name) return '';
    if (t.startsWith(name + '-')) return t.slice(name.length + 1);
  }
  return null;
}
