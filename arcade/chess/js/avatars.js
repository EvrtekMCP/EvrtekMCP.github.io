/* 8-BIT GAMBIT -- character avatar pixel art (16x16).
 *
 * Same grid format as sprites.js: '.' = transparent, '#' = outline (or hair/
 * shades where noted), letters = per-avatar palette entries in `map`.
 */
(function () {
  'use strict';

  var P = window.Palette;
  var S = window.Sprites;

  var art = {

    /* ---- rivals -------------------------------------------------- */

    boop: { /* round-headed tin robot, cyan eyes, antenna */
      map: { '#': P.outline, 'a': '#c8ccd8', 'b': '#8f95a8', 'c': P.cyan, 'd': P.yellow, 'e': '#3a3f52' },
      rows: [
        '.......#........',
        '......#d#.......',
        '.......#........',
        '....#######.....',
        '...#aaaaaaa#....',
        '..#aaaaaaaaa#...',
        '..#a#c#a#c#a#...',
        '..#a#c#a#c#a#...',
        '..#aaaaaaaaa#...',
        '..#a#e#e#e#a#...',
        '..#aaaaaaaaa#...',
        '...#abbbbba#....',
        '..#aa#aaa#aa#...',
        '..#ab#bbb#ba#...',
        '...##.###.##....',
        '................'
      ]
    },

    lunchalot: { /* knight helm, red plume, emergency sandwich */
      map: { '#': P.outline, 'a': '#b8c4d8', 'b': '#7c8aa4', 'c': P.red, 'd': P.yellow, 'e': '#e8b05c', 'f': P.green },
      rows: [
        '.....cc.........',
        '....cccc........',
        '....cc..........',
        '...#####........',
        '..#aaaaa##......',
        '.#aaaaaaaa#.....',
        '.#aabbbbba#.....',
        '.#aa#####a#.....',
        '.#aabbbbba#.....',
        '.#aaaaaaaa#.....',
        '..#aaaaaa#......',
        '...#dddd#..###..',
        '....####..#eee#.',
        '..........#fff#.',
        '..........#eee#.',
        '...........###..'
      ]
    },

    granny: { /* silver bun, glasses, pink cardigan, pearls */
      map: { '#': P.outline, 'a': '#d8d8e0', 'b': '#f0c8a0', 'c': P.cyan, 'd': '#ff9dd9', 'e': P.white },
      rows: [
        '.......###......',
        '.....#####......',
        '....#aaaaa#.....',
        '...#aaaaaaa#....',
        '...#a#####a#....',
        '...#bbbbbbb#....',
        '..##cc#b#cc##...',
        '...#bbbbbbb#....',
        '...#bbbbbbb#....',
        '....#b###b#.....',
        '.....#####......',
        '....#dddddd#....',
        '...#dd#ee#dd#...',
        '...#dddddddd#...',
        '...#d######d#...',
        '................'
      ]
    },

    discorex: { /* dinosaur in sunglasses, disco collar */
      map: { '#': P.outline, 'a': '#4fd35a', 'b': '#2e8f3c', 'c': '#1a1a2e', 'd': P.white, 'e': P.magenta, 'w': P.white },
      rows: [
        '................',
        '....######......',
        '...#aaaaaa##....',
        '..#aaaaaaaaa#...',
        '..#a#########...',
        '..#a#cwc#cwc#...',
        '..#aaaaaaaaaa#..',
        '..#aaaaaaaaaaa#.',
        '..#baaaaaaaaaa#.',
        '..#aa#d#d#d#aa#.',
        '..#aaaaaaaaaa#..',
        '...#bbaaaabb#...',
        '..#eeeeeeeee#...',
        '.#e#e#e#e#e#e#..',
        '................',
        '................'
      ]
    },

    zapp: { /* fortune teller: purple scarf, glowing eyes, crystal ball */
      map: { '#': P.outline, 'a': P.purple, 'b': '#5c2e9a', 'c': '#f0c8a0', 'd': P.yellow, 'f': P.cyan },
      rows: [
        '................',
        '.....######.....',
        '....#aaaaaa#....',
        '...#aaaaaaaa#...',
        '...#ab####ba#...',
        '...#a#cccc#a#...',
        '...#a#dcdc#a#...',
        '...#a#cccc#a#...',
        '....#accca#.....',
        '.....#####......',
        '....#bbbbbb#....',
        '...#bbbbbbbb#...',
        '..#bb#ffff#bb#..',
        '..#bb#ffff#bb#..',
        '...#b#ffff#b#...',
        '......####......'
      ]
    },

    count: { /* pale vampire mathematician, red cape collar, fangs */
      map: { '#': P.outline, 'a': '#e0e0ec', 'b': '#2e2749', 'c': '#c01f3c', 'w': P.white },
      rows: [
        '................',
        '...#######......',
        '..#########.....',
        '..#aaa#aaa#.....',
        '..#aaaaaaa#.....',
        '..#a#aaa#a#.....',
        '..#aaaaaaa#.....',
        '..#aa###aa#.....',
        '..#a#w#w#a#.....',
        '...#aaaaa#......',
        '.##c#####c##....',
        '.#cc#bbb#cc#....',
        '.#c#bbbbb#c#....',
        '.#c#b#w#b#c#....',
        '.#c#bbbbb#c#....',
        '..###bbb###.....'
      ]
    },

    turbo: { /* racing helmet, lightning bolt, mirrored visor */
      map: { '#': P.outline, 'a': P.red, 'b': '#7c8aa4', 'c': P.cyan, 'd': P.yellow, 'w': P.white },
      rows: [
        '................',
        '.....######.....',
        '...##aaddaa##...',
        '..#aaaadaaaaa#..',
        '..#aaaddaaaaa#..',
        '..#aaadaaaaaa#..',
        '..#a########a#..',
        '..#a#cccccc#a#..',
        '..#a#wccccc#a#..',
        '..#a########a#..',
        '..#aaaaaaaaaa#..',
        '...#aaaaaaaa#...',
        '....########....',
        '.....#bbbb#.....',
        '................',
        '................'
      ]
    },

    checkmatron: { /* the final boss: CRT monitor with one red eye */
      map: { '#': P.outline, 'a': '#c8ccd8', 'b': '#3a3f52', 'c': P.red, 'd': P.green, 'e': '#101426' },
      rows: [
        '................',
        '..############..',
        '.#aaaaaaaaaaaa#.',
        '.#a##########a#.',
        '.#a#eeeeeeee#a#.',
        '.#a#ee#cc#ee#a#.',
        '.#a#ee#cc#ee#a#.',
        '.#a#eeeeeeee#a#.',
        '.#a#ddedeedd#a#.',
        '.#a#eeeeeeee#a#.',
        '.#a##########a#.',
        '.#aaaaaaaaaaaa#.',
        '..############..',
        '...#b##b###b#...',
        '..#bbbbbbbbbb#..',
        '..############..'
      ]
    },

    /* ---- player avatar choices ----------------------------------- */

    kid: { /* ballcap kid */
      map: { '#': P.outline, 'a': P.red, 'b': '#f0c8a0', 'c': P.cyan },
      rows: [
        '................',
        '....#######.....',
        '...#aaaaaaa#....',
        '..#aaaaaaaaa##..',
        '..#aaaaaaaaaaa#.',
        '...#bbbbbbb#....',
        '...#b#bbb#b#....',
        '...#bbbbbbb#....',
        '...#bb###bb#....',
        '....#bbbbb#.....',
        '.....#####......',
        '....#cccccc#....',
        '...#cccccccc#...',
        '...#cc#cc#cc#...',
        '...#cccccccc#...',
        '................'
      ]
    },

    mohawk: { /* punk with tall magenta mohawk and shades */
      map: { '#': P.outline, 'a': P.magenta, 'b': '#b57c4a', 'd': '#2e2749' },
      rows: [
        '.......##.......',
        '......#aa#......',
        '......#aa#......',
        '......#aa#......',
        '....###aa###....',
        '...#bb#aa#bb#...',
        '...#bbbbbbbb#...',
        '...##########...',
        '...#bbbbbbbb#...',
        '...#bbb##bbb#...',
        '....#bbbbbb#....',
        '.....######.....',
        '....#d#dd#d#....',
        '...#dddddddd#...',
        '...#d#dddd#d#...',
        '................'
      ]
    },

    hoodie: { /* mysterious hooded gamer, glowing eyes, drawstrings */
      map: { '#': P.outline, 'a': '#2e8f3c', 'c': P.green, 'd': P.yellow, 'e': '#101426' },
      rows: [
        '................',
        '......####......',
        '....##aaaa##....',
        '...#aaaaaaaa#...',
        '...#a######a#...',
        '..#a#eeeeee#a#..',
        '..#a#eceece#a#..',
        '..#a#eeeeee#a#..',
        '...#a######a#...',
        '...#aa#dd#aa#...',
        '....########....',
        '...#aaaaaaaa#...',
        '..#aaa####aaa#..',
        '..#aaaaaaaaaa#..',
        '..#aa#aaaa#aa#..',
        '................'
      ]
    },

    cat: { /* orange tabby, plays for treats */
      map: { '#': P.outline, 'a': '#e8963c', 'b': '#b56a20', 'w': P.white },
      rows: [
        '................',
        '..##......##....',
        '..#a#....#a#....',
        '..#aa####aa#....',
        '..#aaaaaaaa#....',
        '..#a#aaa#aa#....',
        '..#aawwwwaa#....',
        '..#aw#ww#wa#....',
        '..#aawwwwaa#....',
        '...#aaaaaa#.....',
        '....######......',
        '...#aaaaaa#.b...',
        '..#aaaaaaaa#b...',
        '..#a#aaaa#a#b...',
        '..#aaaaaaaa#b...',
        '................'
      ]
    }
  };

  Object.keys(art).forEach(function (id) {
    S.validateGrid('avatar:' + id, art[id].rows, 16, 16);
  });

  function draw(ctx, id, x, y, scale) {
    var a = art[id];
    if (!a) { console.error('[avatars] unknown avatar: ' + id); return; }
    S.drawSprite(ctx, a.rows, x || 0, y || 0, a.map, scale || 1);
  }

  window.Avatars = {
    art: art,
    draw: draw,
    playerIds: ['kid', 'mohawk', 'hoodie', 'cat']
  };
})();
