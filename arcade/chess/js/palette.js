/* 8-BIT GAMBIT -- global color palette (classic script, no modules) */
(function () {
  'use strict';

  window.Palette = {
    // world
    bg:        '#0d0b1e',
    bgPanel:   '#171233',
    bgDeep:    '#080614',

    // board
    frame:     '#3a2417',
    frameEdge: '#1d1108',
    sqLight:   '#e8c9a0',
    sqDark:    '#a05e35',

    // pieces
    outline:   '#131020',
    wBase: '#f2e9d8', wHi: '#ffffff', wSh: '#bfae8f',
    bBase: '#4d4370', bHi: '#7d6dae', bSh: '#2e2749',

    // ui accents
    green:   '#3dff7a',
    yellow:  '#ffe93d',
    cyan:    '#3dd9ff',
    red:     '#ff4d5d',
    magenta: '#ff5dd9',
    orange:  '#ffa63d',
    purple:  '#8a4dd9',
    white:   '#f4f4f4',
    grey:    '#9a94b8',
    dark:    '#1a1a2e',

    // board overlays
    selOutline:  '#ffe93d',
    lastMove:    'rgba(61, 217, 255, 0.35)',
    legalDot:    'rgba(61, 255, 122, 0.85)',
    captureRing: 'rgba(255, 77, 93, 0.9)',
    checkGlow:   'rgba(255, 77, 93, 0.55)'
  };
})();
