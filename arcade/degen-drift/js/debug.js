// DEGEN DRIFT: the hidden tuning panel (five taps on the version line on the title; nothing else opens it). Every number in
// config.js TUNING gets a slider; changes apply live, are kept in this browser, and "Copy" puts the changed numbers on
// the clipboard as JSON, ready to paste back into config.js. Telemetry runs along the top.
import { TUNING, RANGES, DEFAULTS, getPath, setPath, diffFromDefaults, applyOverrides } from './config.js?v=0.1.19';

const KEY = 'driftline.tuning.v1';
const GROUPS = ['car', 'tires', 'steer', 'assist', 'wall', 'scoring', 'damage', 'nos', 'turbo', 'gearbox', 'camera', 'fx', 'economy'];

export function loadTuning() { try { applyOverrides(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* none */ } }

export class Debug {
  constructor(game) {
    this.g = game; this.el = document.getElementById('debug'); this.open = false; this.t = 0; this.shut = new Set(GROUPS.slice(4));
    // release (day 4): only the hidden gesture opens it (five taps on the title's version line); no key, no URL
    this.el.addEventListener('input', (e) => {
      const i = e.target; if (!i.dataset.path) return;
      const v = Number(i.value); if (!isFinite(v)) return;
      setPath(TUNING, i.dataset.path, v);
      const twin = this.el.querySelector(`[data-path="${i.dataset.path}"][type="${i.type === 'range' ? 'number' : 'range'}"]`); if (twin) twin.value = v;
      i.closest('.dr').classList.toggle('changed', v !== getPath(DEFAULTS, i.dataset.path));
      this.save(); this.g.retune();
    });
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-dbg]'); if (!b) return;
      const a = b.dataset.dbg;
      if (a === 'close') this.toggle(false);
      if (a === 'copy') { const s = JSON.stringify(diffFromDefaults(), null, 1); try { navigator.clipboard.writeText(s); } catch (err) { /* shown below */ } this.el.querySelector('#dbg-out').textContent = s; }
      if (a === 'reset') { this.resetAll(); }
      // 11-17 (2): the launch grip's switch (car.js step): off is the handling before it, for a side-by-side
      if (a === 'feel') { TUNING.assist.launchGrip = TUNING.assist.launchGrip ? 0 : 1; this.save(); this.g.retune(); this.render(); }
      if (a === 'grp') { const g = b.dataset.g; if (this.shut.has(g)) this.shut.delete(g); else this.shut.add(g); this.render(); }
    });

  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(diffFromDefaults())); } catch (e) { /* not kept */ } }
  resetAll() { for (const g of GROUPS) Object.assign(TUNING[g], JSON.parse(JSON.stringify(DEFAULTS[g]))); this.save(); this.g.retune(); this.render(); }
  toggle(on = !this.open) { this.open = on; this.el.hidden = !on; if (on) this.render(); }
  render() {
    const lg = TUNING.assist.launchGrip;
    let h = `<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn small" data-dbg="copy">Copy changes</button><button class="btn small" data-dbg="reset">Reset all</button><button class="btn small" data-dbg="close">Close</button><button class="btn small" data-dbg="feel" id="dbg-feel" aria-pressed="${lg ? 'true' : 'false'}">Launch grip: ${lg ? 'ON' : 'OFF (the old feel)'}</button></div><pre id="dbg-tel"></pre><pre id="dbg-out"></pre>`;
    for (const g of GROUPS) {
      h += `<h4 data-dbg="grp" data-g="${g}">${this.shut.has(g) ? '+' : '-'} ${g}</h4>`;
      if (this.shut.has(g)) continue;
      for (const [k, v] of Object.entries(TUNING[g])) {
        if (typeof v !== 'number') continue;
        const path = g + '.' + k, r = RANGES[path] || [Math.min(0, v * 2), Math.max(1, v * 2), Math.abs(v) >= 100 ? 1 : Math.abs(v) >= 10 ? 0.1 : 0.01];
        h += `<div class="dr ${v !== getPath(DEFAULTS, path) ? 'changed' : ''}"><span>${k}</span><input type="range" min="${r[0]}" max="${r[1]}" step="${r[2]}" value="${v}" data-path="${path}"><input type="number" step="${r[2]}" value="${v}" data-path="${path}"></div>`;
      }
    }
    this.el.innerHTML = h;
  }
  tick(dt) {
    if (!this.open) return;
    this.t += dt; if (this.t < 0.2) return; this.t = 0;
    const c = this.g.car, s = this.g.score, el = this.el.querySelector('#dbg-tel'); if (!el || !c) return;
    el.textContent = `speed ${(c.speed * 3.6).toFixed(0)} km/h  slide ${(c.beta * 57.3).toFixed(1)} deg  yaw ${c.r.toFixed(2)}\n` +
      `steer ${c.steerIn.toFixed(2)}  wheels ${(c.delta * 57.3).toFixed(1)} deg  thr ${c.throttle.toFixed(2)} brk ${c.brake.toFixed(2)} hb ${c.handbrake.toFixed(1)}\n` +
      `front load ${(c.loadF * 100).toFixed(0)}%  slip F ${(c.alphaF * 57.3).toFixed(1)} R ${(c.alphaR * 57.3).toFixed(1)} deg  spin ${c.spin.toFixed(2)}  grip help ${(c.grip || 0).toFixed(2)} ask ${(c.intent || 0).toFixed(2)}\n` +
      `gear ${c.gear} rpm ${c.rpm.toFixed(0)} boost ${c.boost.toFixed(2)} nos ${c.nosCharge.toFixed(2)}\n` +
      `zone ${s.zoneNear ? s.zoneNear.id : '-'} ${s.inZone ? (s.sweet ? 'SWEET' : 'in') : 'out'} off-line ${s.offLine.toFixed(1)} m  rate ${s.rate.toFixed(0)}/s  acc ${s.acc.toFixed(0)} x${s.mult}\n` +
      // 11-19: the last wall touch as car.js judged it, for setting wall.grazeSpeed and wall.noseDeg by feel
      `last wall touch ${c.touch.closing.toFixed(2)} m/s at the ${c.touch.part} (${c.touch.angle.toFixed(0)} deg)${TUNING.wall.grazes ? (c.touch.hit ? ': HIT' : ': graze') : ': the rule before 11-19'}, this contact's hardest ${c.wallPeak.toFixed(2)} m/s`;
  }
}
