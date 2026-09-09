'use strict';
// CROSSWIRE — the callout ledger.
//
// This WAS the announcer. Speech synthesis was ruled in on 2026-09-07 so the
// Arcade's no-audio-files rule could stand, and then ruled straight back out
// the same evening once it was heard: "let's scrap the voice saying
// crosswire. It's really bad." He was right. A browser voice reading
// "crosswire" at pitch 0.35 is not an announcer, it is a satnav in a well.
//
// What remains is the LADDER: the list of callout cues and the order they
// happen in. The game still says CW_VOICE.say('MEGA') when three land at
// once, the harness still proves every cue is real, and the screen still
// blinks the words. Nothing speaks. The sound of a callout is the synth stab
// in audio.js, which is the part that was actually good.
var CW_VOICE = (function () {

  var LINES = {
    CROSSWIRE: 'crosswire',
    DOUBLE: 'double crosswire',
    MEGA: 'mega crosswire',
    KEYSTONE: 'keystone',
    DOUBLE_SOURCE: 'double source',
    MEGA_SOURCE: 'mega source'
  };

  var last = null;

  function say(cue) {
    last = cue;
    return false;
  }

  function isEnabled() { return false; }
  function setEnabled() { return false; }
  function toggle() { return false; }
  function lastCue() { return last; }
  function cues() { return Object.keys(LINES); }
  function voiceName() { return null; }

  return { say: say, setEnabled: setEnabled, toggle: toggle, isEnabled: isEnabled,
           lastCue: lastCue, cues: cues, LINES: LINES, voiceName: voiceName };
})();
