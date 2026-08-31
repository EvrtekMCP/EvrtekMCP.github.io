// PADDLER'S PARADISE — THE OUTFITTER (tunables + live tuning panel)
// ---------------------------------------------------------------------------
// The Boot Room pattern from Digi-Boot, fitted for a canoe trip: every value
// the game runs on lives HERE, in a schema with the metadata the panel needs
// (label, range, step, unit, description). Add a variable to the schema and a
// labelled, tooltipped slider appears in the panel automatically — nothing in
// the panel knows what any individual tunable means.
//
// TUNE stays a flat object (the whole codebase reads TUNE.walk etc.); the
// schema builds it. Changes autosave to browser storage as OVERRIDES only,
// so new defaults in later versions are not pinned by old saves.
// ---------------------------------------------------------------------------

'use strict';

var TUNE_SCHEMA = {
  clock: {
    label: 'The day',
    vars: {
      daySeconds: { label: 'Day length', value: 210, min: 120, max: 1200, step: 10, unit: 's',
        desc: 'Real seconds from 06:00 to 21:00. 210 keeps a trip brisk; raise it to meander.' },
      sceneTime: { label: 'First-person time x', value: 0.35, min: 0.05, max: 1, step: 0.05, unit: 'x',
        desc: 'How fast the clock runs while you sit in a first-person view. Below 1 slows a sunset down to be savoured.' },
      duskMin: { label: 'Dusk', value: 1170, min: 960, max: 1230, step: 5, unit: 'min',
        desc: 'Clock minute the light starts to go and the camp warning fires. 1170 = 19:30.' },
      roughMin: { label: 'Dark catches you', value: 1290, min: 1230, max: 1400, step: 5, unit: 'min',
        desc: 'Clock minute the dark ends the day wherever you stand. 1290 = 21:30.' },
    },
  },
  travel: {
    label: 'Travel',
    vars: {
      walk: { label: 'Walking speed', value: 46, min: 20, max: 90, step: 1, unit: 'u/s',
        desc: 'Pace on trail and sand.' },
      bushwhack: { label: 'Bushwhack speed', value: 24, min: 8, max: 60, step: 1, unit: 'u/s',
        desc: 'Pace off-trail through the bush. Slow is honest.' },
      carry: { label: 'Portage speed', value: 27, min: 10, max: 60, step: 1, unit: 'u/s',
        desc: 'Pace with the canoe overhead on a trail.' },
      paddle: { label: 'Paddling speed', value: 58, min: 25, max: 110, step: 1, unit: 'u/s',
        desc: 'Open-water cruising speed.' },
      paddleShallow: { label: 'Shallows speed', value: 46, min: 15, max: 90, step: 1, unit: 'u/s',
        desc: 'Paddling speed in the shallows near shore.' },
      windMaxSlow: { label: 'Headwind penalty', value: 22, min: 0, max: 60, step: 1, unit: 'u/s',
        desc: 'Speed lost paddling dead into a full blow on big open water.' },
    },
  },
  energy: {
    label: 'Energy',
    vars: {
      drainWalk: { label: 'Walk drain', value: 0.22, min: 0, max: 2, step: 0.01, unit: '/s',
        desc: 'Energy per second walking a trail.' },
      drainBush: { label: 'Bushwhack drain', value: 0.5, min: 0, max: 3, step: 0.01, unit: '/s',
        desc: 'Energy per second off-trail.' },
      drainCarry: { label: 'Portage drain', value: 0.8, min: 0, max: 3, step: 0.01, unit: '/s',
        desc: 'Energy per second under the canoe.' },
      drainPaddle: { label: 'Paddle drain', value: 0.24, min: 0, max: 2, step: 0.01, unit: '/s',
        desc: 'Energy per second paddling.' },
      headwindDrain: { label: 'Headwind drain x', value: 2.0, min: 1, max: 5, step: 0.1, unit: 'x',
        desc: 'Drain multiplier paddling straight into the wind.' },
      mosquitoDrain: { label: 'Mosquito drain', value: 0.5, min: 0, max: 3, step: 0.05, unit: '/s',
        desc: 'Energy per second at dusk on land, away from a fire.' },
      exhaustedAt: { label: 'Exhaustion line', value: 18, min: 0, max: 50, step: 1, unit: '',
        desc: 'Energy level below which the tripper slows to a trudge.' },
      exhaustedMult: { label: 'Exhausted pace x', value: 0.55, min: 0.2, max: 1, step: 0.05, unit: 'x',
        desc: 'Speed multiplier while exhausted.' },
      snackEnergy: { label: 'Snack energy', value: 35, min: 5, max: 100, step: 1, unit: '',
        desc: 'Energy one snack restores.' },
    },
  },
  provisions: {
    label: 'Provisions',
    vars: {
      meals: { label: 'Meals in the barrel', value: 6, min: 1, max: 12, step: 1, unit: '',
        desc: 'Dinners-and-breakfasts the trip starts with. Applies from the next trip.' },
      snacks: { label: 'Snacks packed', value: 3, min: 0, max: 9, step: 1, unit: '',
        desc: 'Trail snacks the trip starts with. Applies from the next trip.' },
    },
  },
  wildlife: {
    label: 'Wildlife',
    vars: {
      sightRadius: { label: 'Sighting radius', value: 38, min: 10, max: 90, step: 1, unit: 'u',
        desc: 'How close a quiet approach must get before the sighting ring starts to fill.' },
      calmSpeed: { label: 'Quiet speed', value: 24, min: 5, max: 60, step: 1, unit: 'u/s',
        desc: 'Move slower than this to count as approaching gently.' },
      sightSeconds: { label: 'Sighting time', value: 1.1, min: 0.2, max: 5, step: 0.1, unit: 's',
        desc: 'Seconds of quiet watching before the journal takes the entry.' },
      fleeRadius: { label: 'Flush radius', value: 22, min: 5, max: 60, step: 1, unit: 'u',
        desc: 'Come this close moving fast and the animal bolts.' },
      animalChance: { label: 'Daily turnout', value: 0.78, min: 0.2, max: 1, step: 0.02, unit: '',
        desc: 'Chance each known haunt is actually occupied on a given day.' },
      animalJitter: { label: 'Haunt wander', value: 55, min: 0, max: 160, step: 5, unit: 'u',
        desc: 'How far from its usual spot an animal may have settled today.' },
      roamers: { label: 'Wandering extras', value: 2, min: 0, max: 6, step: 1, unit: '',
        desc: 'Extra animals per day at places nobody predicted.' },
    },
  },
  fishing: {
    label: 'Fishing',
    vars: {
      fishBiteBase: { label: 'Wait, base', value: 3, min: 0.5, max: 15, step: 0.5, unit: 's',
        desc: 'Shortest ordinary wait before a bite.' },
      fishBiteSpread: { label: 'Wait, spread', value: 6, min: 0, max: 20, step: 0.5, unit: 's',
        desc: 'Extra random wait on top of the base.' },
      fishHotMult: { label: 'Hot water x', value: 0.4, min: 0.1, max: 1, step: 0.05, unit: 'x',
        desc: 'Wait multiplier right after a fish jumps nearby.' },
      fishPrimeMult: { label: 'Prime hours x', value: 0.55, min: 0.1, max: 1, step: 0.05, unit: 'x',
        desc: 'Wait multiplier at dawn (till 8:30) and evening (5:00-8:30 PM) — feeding time.' },
      fishSlowMult: { label: 'Midday x', value: 1.6, min: 1, max: 4, step: 0.1, unit: 'x',
        desc: 'Wait multiplier through the middle of the day, when the fish sulk deep.' },
      fishWindow: { label: 'Strike window', value: 0.9, min: 0.2, max: 3, step: 0.05, unit: 's',
        desc: 'How long the STRIKE moment lasts before dinner swims off.' },
    },
  },
  camp: {
    label: 'Camp & events',
    vars: {
      critterEvery: { label: 'Critter interval', value: 16, min: 4, max: 60, step: 1, unit: 's',
        desc: 'Average seconds between chipmunk and squirrel visits at camp.' },
      chopSwings: { label: 'Swings per tree', value: 3, min: 1, max: 8, step: 1, unit: '',
        desc: 'Axe swings it takes to buck one dead tree into split logs.' },
      chopEnergy: { label: 'Chop effort', value: 1, min: 0, max: 5, step: 0.5, unit: '',
        desc: 'Energy each axe swing costs.' },
      logsPerTree: { label: 'Logs per tree', value: 4, min: 2, max: 8, step: 1, unit: '',
        desc: 'Split logs one bucked tree yields. Lighting the ring costs 6.' },
      fireBurn: { label: 'Fire appetite', value: 1, min: 0.2, max: 3, step: 0.1, unit: 'x',
        desc: 'How fast the evening fire eats its logs while you sit with it. Bigger fires always burn faster.' },
      stoneEnergy: { label: 'Rock scrape cost', value: 1, min: 0, max: 10, step: 0.5, unit: '',
        desc: 'Energy a hull scrape on a shore stone costs.' },
      bearRaidChance: { label: 'Bear audit odds', value: 0.45, min: 0, max: 1, step: 0.05, unit: '',
        desc: 'Chance an unhung barrel with food in it draws a bear overnight.' },
    },
  },
  interface: {
    label: 'Interface',
    vars: {
      interact: { label: 'Reach', value: 20, min: 8, max: 50, step: 1, unit: 'u',
        desc: 'How close a thing must be before the action button names it.' },
      waypointAt: { label: 'Waypoint radius', value: 26, min: 8, max: 60, step: 1, unit: 'u',
        desc: 'How close to a route waypoint counts as reaching it.' },
    },
  },
};

// fixed clock anchors (not worth dials): the day runs 06:00 to 21:00
var TUNE = { dayStartMin: 360, dayEndMin: 1260, energyMax: 100 };

(function buildTune() {
  var gk, vk;
  for (gk in TUNE_SCHEMA) {
    for (vk in TUNE_SCHEMA[gk].vars) TUNE[vk] = TUNE_SCHEMA[gk].vars[vk].value;
  }
})();

// --- the panel + persistence (overrides only) --------------------------------

var OUTFIT = (function () {
  var KEY = 'paddlers.tune.v1';
  var open = false, panel = null, rows = {};

  function factory(k) {
    var gk;
    for (gk in TUNE_SCHEMA) {
      if (k in TUNE_SCHEMA[gk].vars) return TUNE_SCHEMA[gk].vars[k];
    }
    return null;
  }

  function overrides() {
    var out = {}, gk, vk;
    for (gk in TUNE_SCHEMA) {
      for (vk in TUNE_SCHEMA[gk].vars) {
        if (TUNE[vk] !== TUNE_SCHEMA[gk].vars[vk].value) out[vk] = TUNE[vk];
      }
    }
    return out;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(overrides())); } catch (e) {}
  }

  /** Clamp-and-apply an overrides object; returns how many dials took. */
  function applyObj(o) {
    var n = 0, k;
    for (k in o) {
      var m = factory(k);
      if (!m) continue;                       // a dial that no longer exists
      var v = Number(o[k]);
      if (!isFinite(v)) continue;
      TUNE[k] = Math.max(m.min, Math.min(m.max, v));
      n++;
    }
    return n;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return 0;
      return applyObj(JSON.parse(raw));
    } catch (e) {}
    return 0;
  }

  // --- files, three tiers like Digi-Boot's Boot Room: browser autosave is
  // always on; Save to file writes IN PLACE where the browser allows
  // (Chrome/Edge, after you pick the file once) and downloads elsewhere;
  // Copy settings is the phone's way out — paste the line to CLU and the
  // numbers become the game's new factory defaults by commit.
  var fileHandle = null;
  var IN_ARTIFACT = !!window.__ARTIFACT_BUILD;   // stamped by the bundler

  async function saveToFile() {
    var text = JSON.stringify(overrides(), null, 2);
    if (window.showSaveFilePicker) {
      try {
        if (!fileHandle) {
          fileHandle = await window.showSaveFilePicker({
            suggestedName: 'paddlers-tuning.json',
            types: [{ description: 'Paddler tuning', accept: { 'application/json': ['.json'] } }],
          });
        }
        var w = await fileHandle.createWritable();
        await w.write(text);
        await w.close();
        setStatus('saved to ' + fileHandle.name + ' — written in place');
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') { setStatus('save cancelled'); return; }
        setStatus('in-place save unavailable — downloading instead');
      }
    }
    var blob = new Blob([text], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'paddlers-tuning.json';
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus('downloaded paddlers-tuning.json');
  }

  async function loadFromFile() {
    async function take(text, name) {
      var n = applyObj(JSON.parse(text));
      refresh(); save(); setStatus('loaded ' + n + ' dial' + (n === 1 ? '' : 's') + (name ? ' from ' + name : ''));
    }
    if (window.showOpenFilePicker) {
      try {
        var picked = await window.showOpenFilePicker({
          types: [{ description: 'Paddler tuning', accept: { 'application/json': ['.json'] } }],
        });
        fileHandle = picked[0];
        await take(await (await fileHandle.getFile()).text(), fileHandle.name);
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') { setStatus('load cancelled'); return; }
      }
    }
    var input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async function () {
      try { await take(await input.files[0].text(), input.files[0].name); }
      catch (e2) { setStatus('that file did not read as tuning'); }
    };
    input.click();
  }

  function ioBox(show, text) {
    var box = panel.querySelector('#of-iobox');
    box.style.display = show ? 'block' : 'none';
    if (show) {
      var ta = panel.querySelector('#of-io');
      ta.value = text || '';
      if (!text) ta.focus();
    }
  }

  function copySettings() {
    var o = overrides();
    if (!Object.keys(o).length) { setStatus('nothing changed — nothing to copy'); return; }
    var text = JSON.stringify(o);
    var done = function () { ioBox(false); setStatus('copied — paste it to CLU to make these the new defaults'); };
    var fail = function () { ioBox(true, text); setStatus('copy the line from the box below'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fail);
    } else fail();
  }

  function pasteSettings() {
    ioBox(true, '');
    setStatus('paste a settings line below, then Apply');
  }

  function applyPasted() {
    var ta = panel.querySelector('#of-io');
    try {
      var n = applyObj(JSON.parse(ta.value));
      refresh(); save(); ioBox(false);
      setStatus('applied ' + n + ' dial' + (n === 1 ? '' : 's'));
    } catch (e) {
      setStatus('that did not read as a settings line');
    }
  }

  function decimalsFor(step) {
    var s = String(step);
    return s.indexOf('.') >= 0 ? s.length - s.indexOf('.') - 1 : 0;
  }

  function css() {
    var st = document.createElement('style');
    st.textContent =
      '#outfitter{position:fixed;top:0;right:0;height:100%;width:min(330px,94vw);' +
      'background:rgba(10,16,12,0.96);color:#f2f2e8;z-index:40;overflow-y:auto;' +
      'font:13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;' +
      'border-left:1px solid #f2c14b;padding:10px 12px 40px;box-sizing:border-box;' +
      '-webkit-overflow-scrolling:touch;touch-action:pan-y}' +
      '#outfitter h2{font-size:15px;color:#f2c14b;margin:2px 0 0;letter-spacing:1px}' +
      '#outfitter .of-sub{color:#9ab09a;font-size:11px;margin:0 0 8px}' +
      '#outfitter details{border-top:1px solid #24402c;padding:6px 0}' +
      '#outfitter summary{cursor:pointer;color:#f2c14b;font-weight:600;padding:3px 0}' +
      '#outfitter .of-row{margin:7px 0 2px}' +
      '#outfitter .of-lab{display:flex;justify-content:space-between;align-items:baseline}' +
      '#outfitter .of-val{color:#f2c14b;font-variant-numeric:tabular-nums}' +
      '#outfitter input[type=range]{width:100%;accent-color:#f2c14b;height:22px;touch-action:none}' +
      '#outfitter .of-desc{color:#8a9a8a;font-size:11px;margin-top:-2px}' +
      '#outfitter .of-actions{display:flex;gap:6px;margin:8px 0;flex-wrap:wrap}' +
      '#outfitter button{background:#1c2f22;color:#f2f2e8;border:1px solid #f2c14b;' +
      'border-radius:3px;padding:5px 10px;font:600 12px system-ui;cursor:pointer}' +
      '#outfitter .of-status{color:#9ab09a;font-size:11px;min-height:14px}' +
      '#of-close{position:absolute;top:8px;right:10px;font-size:14px;padding:3px 9px}' +
      '#of-iobox{margin:6px 0}' +
      '#of-iobox textarea{width:100%;box-sizing:border-box;background:#0c1810;' +
      'color:#f2f2e8;border:1px solid #24402c;border-radius:3px;font:12px monospace;' +
      'padding:4px;margin-bottom:4px}';
    document.head.appendChild(st);
  }

  function build() {
    css();
    panel = document.createElement('div');
    panel.id = 'outfitter';
    var head = document.createElement('div');
    head.innerHTML = '<h2>THE OUTFITTER</h2>' +
      '<div class="of-sub">live tuning — most dials apply immediately</div>' +
      '<div class="of-actions">' +
      (IN_ARTIFACT ? '' :
        '<button id="of-save">Save to file</button>' +
        '<button id="of-load">Load file</button>') +
      '<button id="of-copy">Copy settings</button>' +
      '<button id="of-paste">Paste settings</button>' +
      '<button id="of-reset">Reset all</button></div>' +
      '<div id="of-iobox" style="display:none"><textarea id="of-io" rows="3" ' +
      'spellcheck="false"></textarea><button id="of-apply">Apply</button></div>' +
      '<div class="of-status" id="of-status"></div>' +
      '<button id="of-close">✕</button>';
    panel.appendChild(head);
    var gk;
    for (gk in TUNE_SCHEMA) {
      var group = TUNE_SCHEMA[gk];
      var det = document.createElement('details');
      if (gk === 'clock' || gk === 'travel') det.open = true;
      var sum = document.createElement('summary');
      sum.textContent = group.label;
      det.appendChild(sum);
      var vk;
      for (vk in group.vars) det.appendChild(row(vk, group.vars[vk]));
      panel.appendChild(det);
    }
    document.body.appendChild(panel);
    panel.querySelector('#of-reset').onclick = resetAll;
    if (!IN_ARTIFACT) {
      panel.querySelector('#of-save').onclick = saveToFile;
      panel.querySelector('#of-load').onclick = loadFromFile;
    }
    panel.querySelector('#of-copy').onclick = copySettings;
    panel.querySelector('#of-paste').onclick = pasteSettings;
    panel.querySelector('#of-apply').onclick = applyPasted;
    panel.querySelector('#of-close').onclick = toggle;
    // the panel is UI, not game surface: keep its pointer events to itself
    ['pointerdown', 'pointermove', 'pointerup', 'keydown'].forEach(function (ev) {
      panel.addEventListener(ev, function (e) { e.stopPropagation(); });
    });
    setStatus();
  }

  function row(k, m) {
    var el = document.createElement('div');
    el.className = 'of-row';
    el.title = m.desc;
    var dec = decimalsFor(m.step);
    var lab = document.createElement('div');
    lab.className = 'of-lab';
    var name = document.createElement('span');
    name.textContent = m.label;
    var val = document.createElement('span');
    val.className = 'of-val';
    lab.appendChild(name); lab.appendChild(val);
    var input = document.createElement('input');
    input.type = 'range';
    input.min = m.min; input.max = m.max; input.step = m.step;
    input.value = TUNE[k];
    var show = function () {
      val.textContent = Number(TUNE[k]).toFixed(dec) + (m.unit ? ' ' + m.unit : '') +
        (TUNE[k] !== m.value ? ' •' : '');
    };
    input.addEventListener('input', function () {
      TUNE[k] = Number(input.value);
      show(); save(); setStatus();
    });
    var desc = document.createElement('div');
    desc.className = 'of-desc';
    desc.textContent = m.desc;
    el.appendChild(lab); el.appendChild(input); el.appendChild(desc);
    show();
    rows[k] = { input: input, show: show };
    return el;
  }

  function refresh() {
    var k;
    for (k in rows) { rows[k].input.value = TUNE[k]; rows[k].show(); }
  }

  function resetAll() {
    var gk, vk;
    for (gk in TUNE_SCHEMA) {
      for (vk in TUNE_SCHEMA[gk].vars) TUNE[vk] = TUNE_SCHEMA[gk].vars[vk].value;
    }
    save(); refresh(); setStatus();
  }

  function setStatus(msg) {
    var st = panel && panel.querySelector('#of-status');
    if (!st) return;
    if (msg !== undefined) { st.textContent = msg; return; }
    var n = Object.keys(overrides()).length;
    st.textContent = n ? n + ' dial' + (n === 1 ? '' : 's') + ' off factory (marked •)'
                       : 'everything at factory settings';
  }

  function toggle() {
    if (!panel) build();
    open = !open;
    panel.style.display = open ? 'block' : 'none';
    if (open) {
      var sub = panel.querySelector('.of-sub');
      if (sub && window.AUDIO && AUDIO.state) {
        sub.textContent = 'live tuning — most dials apply immediately · sound: ' + AUDIO.state();
      }
    }
    return open;
  }

  var restored = load();

  return {
    enabled: false,        // hidden for now, per Evrtek — flip to bring it back
    toggle: toggle,
    isOpen: function () { return open; },
    restored: restored,
  };
})();
