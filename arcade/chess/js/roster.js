/* 8-BIT GAMBIT -- the rival ladder. Punch-Out!! rules: beat your rival
 * twice in a row and a NEW CHALLENGER appears. Each rival has a strength
 * band, an eval persona (see eval.js), and far too many opinions.
 */
(function () {
  'use strict';

  var ROSTER = [
    {
      id: 'boop',
      name: 'BOOP',
      title: 'FACTORY SECOND',
      bio: 'A vending machine that achieved sentience. Mostly dispenses blunders.',
      band: { min: 0, max: 650 }, base: 450,
      persona: { aggression: 0.2, centerLove: 0.3 },
      thinkMs: [350, 900],
      taunts: {
        intro: ['BEEP. IS THIS CHESS OR CHECKERS. BOTH SAME.', 'INSERT COIN. NO WAIT. PLAY FREE. BOOP GENEROUS.'],
        winning: ['BOOP WINNING? RECALCULATING... CONFIRMED. WOW.', 'DID NOT EXPECT THIS. NEITHER DID YOU.'],
        losing: ['ERROR 404: ADVANTAGE NOT FOUND.', 'BOOP FEELS... FEELINGS? BAD ONES.'],
        check: ['BEEP BEEP. THAT IS THE CHECK ALARM.'],
        win: ['VICTORY.EXE COMPLETE. BOOP WILL BRAG FOREVER.', 'GG. BOOP DISPENSES ONE (1) HANDSHAKE.'],
        lose: ['YOU WIN. BOOP RETURNS TO VENDING SNACKS.', 'DEFEAT ACCEPTED. RESPECT DISPENSED.'],
        draw: ['A TIE. LIKE KISSING A TOASTER. CONFUSING.']
      }
    },
    {
      id: 'lunchalot',
      name: 'SIR LUNCHALOT',
      title: 'KNIGHT ERRAND',
      bio: 'Sworn to defend the realm, right after this sandwich.',
      band: { min: 500, max: 850 }, base: 650,
      persona: { aggression: 0.5, pawnValue: 90 },
      thinkMs: [500, 1200],
      taunts: {
        intro: ['HARK! PREPARE THYSELF FOR BATTLE! ...AFTER ONE BITE.', 'MY BLADE IS SHARP. MY MUSTARD, SHARPER.'],
        winning: ['HUZZAH! VICTORY SMELLS LIKE SALAMI!', 'THY POSITION CRUMBLES LIKE STALE BREAD!'],
        losing: ['A SETBACK! FETCH ME MY EMERGENCY BAGUETTE!', 'I HUNGER... FOR A BETTER POSITION.'],
        check: ['A CHECK?! MOST DISCOURTEOUS DURING LUNCH!'],
        win: ['THE REALM IS SAFE. TIME FOR SECONDS!', 'THOU FOUGHT WELL. SPLIT A HOAGIE?'],
        lose: ['I YIELD! MY CONCENTRATION WAS ON MY CROISSANT.', 'WELL STRUCK! A KNIGHT KNOWS WHEN TO FOLD.'],
        draw: ['A DRAW! LIKE A SANDWICH CUT PERFECTLY IN HALF.']
      }
    },
    {
      id: 'granny',
      name: 'GRANNY GIGAHERTZ',
      title: 'ARCADE LEGEND, RETIRED',
      bio: 'Held the high score on every cabinet in town since 1982.',
      band: { min: 700, max: 1050 }, base: 850,
      persona: { aggression: 0.6, materialWeight: 0.9, positionalWeight: 1.1 },
      thinkMs: [600, 1400],
      taunts: {
        intro: ['BACK IN MY DAY WE PLAYED CHESS UPHILL. BOTH WAYS.', 'GRAB A JUICE BOX, DEARIE. THIS WON\'T TAKE LONG.'],
        winning: ['THAT\'S A GRANDMA SPECIAL, SWEETIE.', 'I\'VE SEEN SCARIER POSITIONS IN MY KNITTING.'],
        losing: ['OH MY. SOMEONE ATE THEIR VEGETABLES.', 'CHEEKY! VERY CHEEKY, DEAR.'],
        check: ['CHECK? HOW ADORABLE.'],
        win: ['GG, SWEETPEA. COOKIES ARE ON THE COUNTER.', 'ANOTHER HIGH SCORE FOR GRANNY.'],
        lose: ['YOU\'VE GOT THE GIFT, DEARIE. GRANNY IS PROUD.', 'WELL PLAYED! NOW HELP ME FIND MY GLASSES.'],
        draw: ['A DRAW. SPLIT A COOKIE, THEN?']
      }
    },
    {
      id: 'discorex',
      name: 'DISCO REX',
      title: 'CRETACEOUS FUNK MACHINE',
      bio: '65 million years of rhythm. Tiny arms, huge attacking ideas.',
      band: { min: 900, max: 1250 }, base: 1050,
      persona: { aggression: 0.9, centerLove: 0.5, pawnValue: 92 },
      thinkMs: [500, 1300],
      taunts: {
        intro: ['THE DANCE FLOOR IS 64 SQUARES, BABY. LET\'S BOOGIE.', 'RAWR MEANS "GOOD LUCK" IN DINOSAUR.'],
        winning: ['CAN\'T STOP THE STOMP! UNTS UNTS UNTS!', 'YOUR DEFENSE IS GOING EXTINCT, BABY.'],
        losing: ['WHOA. WHO TURNED OFF THE MUSIC?', 'ASTEROID VIBES. BAD ONES.'],
        check: ['CHECK?! NOT VERY FUNKY OF YOU.'],
        win: ['BOOGIE COMPLETE! REX REMAINS UNDEFEATED-ISH!', 'THAT\'S HOW WE DID IT IN THE CRETACEOUS!'],
        lose: ['YOU OUT-DANCED A DINOSAUR. RESPECT.', 'REX IS SHOOK. GOOD GAME, MAMMAL.'],
        draw: ['A TIE?! THE CROWD DEMANDS AN ENCORE.']
      }
    },
    {
      id: 'zapp',
      name: 'MADAME ZAPP',
      title: 'SEER OF E4',
      bio: 'Knew you would read this. The crystal ball is just for ambience.',
      band: { min: 1100, max: 1450 }, base: 1250,
      persona: { positionalWeight: 1.15, queenTradeShy: 0.5, centerLove: 0.4 },
      thinkMs: [800, 1600],
      taunts: {
        intro: ['I FORESAW THIS GAME. AND YOUR THIRD MOVE. IT\'S A MISTAKE.', 'THE SPIRITS WHISPER... THEY SAY "DEVELOP YOUR KNIGHTS."'],
        winning: ['ALL PROCEEDING AS THE ORB FORETOLD.', 'I SAW THIS POSITION IN A DREAM. YOU LOSE IN IT.'],
        losing: ['THE ORB... THE ORB DID NOT MENTION THIS.', 'A DISTURBANCE IN MY THIRD EYE.'],
        check: ['PREDICTED. STILL RUDE.'],
        win: ['DESTINY DELIVERS. THE ORB ACCEPTS TIPS.', 'AS FORETOLD. DO NOT FEEL BAD, IT WAS WRITTEN.'],
        lose: ['IMPOSSIBLE! THE ORB REQUIRES A SOFTWARE UPDATE.', 'YOU HAVE ALTERED FATE ITSELF. IMPRESSIVE.'],
        draw: ['A DRAW. THE ONE OUTCOME I REFUSED TO BELIEVE.']
      }
    },
    {
      id: 'count',
      name: 'COUNT ALGORITHM',
      title: 'NOSFERATU OF NUMBERS',
      bio: 'Counts pawns instead of sheep. Allergic to sunlight and gambits.',
      band: { min: 1300, max: 1650 }, base: 1450,
      persona: { materialWeight: 1.15, positionalWeight: 0.9, pawnValue: 115, queenTradeShy: 0.3 },
      thinkMs: [900, 1800],
      taunts: {
        intro: ['I HAVE COUNTED EVERY PAWN SINCE 1462. YOURS LOOK... DELICIOUS.', 'VELCOME. LEAVE YOUR MATERIAL AT THE DOOR.'],
        winning: ['ONE PAWN... AH AH AH. TWO PAWNS... AH AH AH!', 'YOUR POSITION HAS NO PULSE.'],
        losing: ['ZIS ARITHMETIC IS CURSED!', 'IMPOSSIBLE. ZE NUMBERS NEVER LIE. EXCEPT NOW.'],
        check: ['A CHECK! HOW GAUCHE.'],
        win: ['ZE COUNT REMAINS UNDEFEATED IN ZIS CASTLE.', 'DELICIOUS. I VILL COUNT ZIS VICTORY TWICE.'],
        lose: ['DRIVEN FROM MY OWN CASTLE! ZE SHAME!', 'YOU PLAY LIKE A CREATURE OF ZE NIGHT. BRAVO.'],
        draw: ['A DRAW. HALF A POINT... AH AH AH. ONLY HALF.']
      }
    },
    {
      id: 'turbo',
      name: 'TURBO',
      title: 'PEDAL TO THE METAL',
      bio: 'Thinks at 200mph. Occasionally misses the exit.',
      band: { min: 1500, max: 1850 }, base: 1650,
      persona: { aggression: 0.8, centerLove: 0.3, positionalWeight: 1.05 },
      thinkMs: [400, 1000],
      taunts: {
        intro: ['GREEN LIGHT. TRY TO KEEP UP.', 'I\'VE ALREADY CALCULATED THIS GAME. TWICE.'],
        winning: ['LAPPING YOU. AGAIN.', 'CHECKERED FLAG INCOMING.'],
        losing: ['PIT STOP! SOMETHING\'S RATTLING!', 'YOU DRIVE THAT BOARD LIKE A PRO. ANNOYING.'],
        check: ['CAUTION FLAG. NICE ONE.'],
        win: ['RACE OVER. HIT THE SHOWERS.', 'TOO FAST, TOO CASTLED.'],
        lose: ['ENGINE FAILURE... GG. YOU EARNED THE PODIUM.', 'OUTDRIVEN. REMATCH AT DAWN?'],
        draw: ['PHOTO FINISH. STEWARDS SAY: DRAW.']
      }
    },
    {
      id: 'checkmatron',
      name: 'THE CHECKMATRON',
      title: 'FINAL BOSS',
      bio: 'Built in a basement in 1979 to end chess forever. Still trying.',
      band: { min: 1700, max: 9999 }, base: 1950,
      persona: { positionalWeight: 1.1 },
      thinkMs: [1000, 2200],
      taunts: {
        intro: ['HUMAN DETECTED. PREPARING HUMILITY PROTOCOL.', 'I HAVE SOLVED CHESS. THE ANSWER IS: YOU LOSE.'],
        winning: ['RESISTANCE IS STATISTICALLY AMUSING.', 'YOUR DEFEAT IS SCHEDULED. PLEASE HOLD.'],
        losing: ['ANOMALY DETECTED. ANOMALY DETECTED.', 'THIS OUTCOME EXISTS IN 0.02% OF SIMULATIONS.'],
        check: ['CHECK ACKNOWLEDGED. FLATTERY WILL NOT SAVE YOU.'],
        win: ['CHECKMATE PROTOCOL COMPLETE. POWERING DOWN SMUGLY.', 'AS COMPUTED. BETTER LUCK NEXT BOOT.'],
        lose: ['SYSTEM FAILURE. YOU... ARE THE SUPERIOR MACHINE.', 'IMPOSSIBLE. SAVING REPLAY FOR ETERNAL ANALYSIS.'],
        draw: ['STALEMATE ACCORD. HUMANITY SURVIVES ANOTHER DAY.']
      }
    }
  ];

  var byId = {};
  ROSTER.forEach(function (c, i) { c.index = i; byId[c.id] = c; });

  function taunt(charDef, key) {
    var list = (charDef.taunts && charDef.taunts[key]) || [];
    if (!list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  window.Roster = {
    ROSTER: ROSTER,
    byId: byId,
    taunt: taunt
  };
})();
