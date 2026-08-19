/* BEAT MACHINE — fileio.js
   Save/load working files and export .wav renders. Zero dependencies.
   - Save: full project state as versioned JSON, browser-downloaded.
   - Load: native file picker -> validated & sanitized -> hot-swapped in
     (keeps playing if playing; all knobs re-sync).
   - WAV: OfflineAudioContext renders 2 loops + reverb tail through a
     mirror of the live graph, encoded as 16-bit PCM 44.1kHz stereo. */
(function () {
  'use strict';
  window.BM = window.BM || {};

  var FORMAT = 'beat-machine-project';
  var VERSION = 1;

  function stamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
           '_' + p(d.getHours()) + p(d.getMinutes());
  }

  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  // ---- project save / load ---------------------------------------------
  function serialize() {
    var s = BM.state;
    return JSON.stringify({
      format: FORMAT,
      version: VERSION,
      saved: new Date().toISOString(),
      bpm: s.bpm, swing: s.swing, masterVol: s.masterVol,
      skin: document.body.getAttribute('data-skin') || 'grid',
      choirs: s.choirs.map(function (ch) {
        return {
          muted: !!ch.muted,
          rows: ch.rows.map(function (r) {
            return { voice: r.voice, vol: r.vol, harmony: r.harmony,
                     steps: r.steps.map(function (st) {
                       return st ? { rungs: st.rungs.slice() } : null;
                     }) };
          })
        };
      })
    }, null, 1);
  }

  var HARMONY_IDS = { sweet: 1, power: 1, double: 1 };

  function clampNum(v, lo, hi, fb) {
    v = Number(v);
    return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb;
  }

  // Strict sanitize: unknown voices fall back, rungs clamped & deduped,
  // anything malformed becomes an empty step rather than an error.
  function sanitize(raw) {
    if (!raw || raw.format !== FORMAT) return null;
    if (typeof raw.version !== 'number' || raw.version > VERSION) return null;
    if (!Array.isArray(raw.choirs) || raw.choirs.length !== 2) return null;
    var out = {
      bpm: Math.round(clampNum(raw.bpm, 40, 208, 120)),
      swing: clampNum(raw.swing, 0, 1, 0),
      masterVol: clampNum(raw.masterVol, 0, 1, 0.85),
      skin: BM.SKINS.indexOf(raw.skin) !== -1 ? raw.skin : null,
      choirs: []
    };
    for (var c = 0; c < 2; c++) {
      var rc = raw.choirs[c] || {};
      var rows = Array.isArray(rc.rows) ? rc.rows : [];
      var choir = { muted: !!rc.muted, rows: [] };
      for (var r = 0; r < BM.ROWS; r++) {
        var rr = rows[r] || {};
        var voice = BM.VOICE_ORDER.indexOf(rr.voice) !== -1 ? rr.voice
                    : BM.VOICE_ORDER[0];
        var row = { voice: voice, vol: clampNum(rr.vol, 0, 1, 0.8),
                    harmony: HARMONY_IDS[rr.harmony] ? rr.harmony : null,
                    steps: [] };
        var steps = Array.isArray(rr.steps) ? rr.steps : [];
        for (var s = 0; s < BM.STEPS; s++) {
          var st = steps[s];
          if (st && Array.isArray(st.rungs)) {
            var rungs = [], seen = {};
            for (var i = 0; i < st.rungs.length && rungs.length < BM.MAX_TONES; i++) {
              var g = Math.round(clampNum(st.rungs[i], BM.RUNG_MIN, BM.RUNG_MAX, 0));
              if (!seen[g]) { seen[g] = 1; rungs.push(g); }
            }
            row.steps.push(rungs.length ? { rungs: rungs } : null);
          } else row.steps.push(null);
        }
        choir.rows.push(row);
      }
      out.choirs.push(choir);
    }
    return out;
  }

  function apply(proj) {
    var s = BM.state;
    s.bpm = proj.bpm; s.swing = proj.swing; s.masterVol = proj.masterVol;
    for (var c = 0; c < 2; c++) {
      s.choirs[c].muted = proj.choirs[c].muted;
      for (var r = 0; r < BM.ROWS; r++) {
        var src = proj.choirs[c].rows[r];
        var dst = s.choirs[c].rows[r];
        dst.voice = src.voice; dst.vol = src.vol;
        dst.harmony = src.harmony; dst.steps = src.steps;
        if (BM.state.powered) BM.audio.setRowVol(c, r, src.vol);
      }
      if (BM.state.powered) BM.audio.setChoirMute(c, s.choirs[c].muted);
      else BM.emit('mute', { c: c, muted: s.choirs[c].muted });
    }
    if (BM.state.powered) BM.audio.setMasterVol(proj.masterVol);
    if (proj.skin && BM.applySkin) BM.applySkin(proj.skin);
    BM.emit('pattern', {});
    BM.emit('choir', s.activeChoir);
    BM.emit('project-loaded', proj);
  }

  // ---- wav encode -------------------------------------------------------
  function encodeWav(buf) {
    var ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
    var bytes = 44 + len * ch * 2;
    var ab = new ArrayBuffer(bytes);
    var v = new DataView(ab);
    function str(off, s) { for (var i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); v.setUint32(4, bytes - 8, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);            // PCM
    v.setUint16(22, ch, true);
    v.setUint32(24, sr, true);
    v.setUint32(28, sr * ch * 2, true);  // byte rate
    v.setUint16(32, ch * 2, true);       // block align
    v.setUint16(34, 16, true);           // bits
    str(36, 'data'); v.setUint32(40, len * ch * 2, true);
    var off = 44;
    var chans = [];
    for (var c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
    for (var i = 0; i < len; i++) {
      for (var c2 = 0; c2 < ch; c2++) {
        var x = Math.max(-1, Math.min(1, chans[c2][i]));
        v.setInt16(off, x < 0 ? x * 0x8000 : x * 0x7FFF, true);
        off += 2;
      }
    }
    return new Blob([ab], { type: 'audio/wav' });
  }

  // ---- offline render (mirror of the live graph) ------------------------
  function renderWav() {
    var s = BM.state;
    var sr = 44100, loops = 2, tail = 1.6;
    var stepD = 60 / s.bpm / 4;
    var total = loops * BM.STEPS * stepD + tail;
    var off = new OfflineAudioContext(2, Math.ceil(total * sr), sr);

    var master = off.createGain(); master.gain.value = 0.9;
    var comp = off.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 20;
    comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    comp.connect(master); master.connect(off.destination);
    var verbIn = off.createGain();
    var conv = off.createConvolver(); conv.buffer = BM.audio.makeImpulse(off);
    var verbOut = off.createGain(); verbOut.gain.value = 0.9;
    verbIn.connect(conv); conv.connect(verbOut); verbOut.connect(comp);

    var base = 0.03;
    for (var c = 0; c < 2; c++) {
      var choir = s.choirs[c];
      if (choir.muted) continue;                    // export what you hear
      for (var r = 0; r < BM.ROWS; r++) {
        var row = choir.rows[r];
        var g = off.createGain(); g.gain.value = row.vol; g.connect(comp);
        for (var L = 0; L < loops; L++) {
          for (var st = 0; st < BM.STEPS; st++) {
            var beat = row.steps[st];
            if (!beat) continue;
            var when = base + (L * BM.STEPS + st) * stepD +
                       (st % 2 === 1 ? s.swing * stepD * 0.5 : 0);
            var i;
            for (i = 0; i < beat.rungs.length; i++) {
              BM.kit.trigger(off, row.voice, g, verbIn, when,
                             BM.rungToSemi(beat.rungs[i]), 1);
            }
            var harm = BM.harmonyForRungs(beat.rungs, row.harmony);
            for (i = 0; i < harm.length; i++) {
              BM.kit.trigger(off, row.voice, g, verbIn, when,
                             BM.rungToSemi(harm[i]), 0.6);
            }
          }
        }
      }
    }
    return off.startRendering().then(encodeWav);
  }

  BM.fileio = {
    saveProject: function () {
      download(new Blob([serialize()], { type: 'application/json' }),
               'beat-machine_' + stamp() + '.beat.json');
    },
    exportWav: function () {
      return renderWav().then(function (blob) {
        download(blob, 'beat-machine_' + stamp() + '.wav');
        return blob.size;
      });
    },
    loadFromText: function (text) {          // returns true if applied
      var raw;
      try { raw = JSON.parse(text); } catch (e) { return false; }
      var proj = sanitize(raw);
      if (!proj) return false;
      apply(proj);
      return true;
    },
    // exposed for verification
    _serialize: serialize
  };
})();
