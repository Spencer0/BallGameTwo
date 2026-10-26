// Madame Prudence Plume's memos. Each line: [mood, text]. Moods: stern | shocked | pleased.
export const INTRO = [
  ['stern', 'Lint. The Grand Tidiness Inspection is TODAY.'],
  ['shocked', 'Look at this breakfast table. Crumbs. Peas. A spoon, lying down like it pays rent.'],
  ['stern', 'Tidy it. How? Roll it all into a ball, obviously. That is what you are for.'],
];

// shown before level N (index = level number - 1); level 1 uses INTRO the first time
export const BEFORE = [
  [['stern', 'The breakfast table. Again. Someone keeps having breakfast on it.']],
  [
    ['pleased', 'The table is spotless.'],
    ['shocked', 'Unfortunately, it is standing in a bedroom that looks like a sock exploded.'],
  ],
  [
    ['pleased', 'The bedroom passes inspection.'],
    ['stern', 'The rest of the house has been informed, and it is not taking it well.'],
  ],
  [
    ['shocked', 'I looked out of the window. I wish I had not.'],
    ['stern', 'The whole cul-de-sac. Chop chop.'],
  ],
  [
    ['stern', 'The neighbours have complained that you tidied them.'],
    ['pleased', 'The rest of town is jealous. Fair is fair.'],
  ],
  [
    ['stern', 'One last thing on my clipboard.'],
    ['shocked', 'It says "the city". Who wrote that? Oh. Me.'],
  ],
];

export const ENDING = [
  ['pleased', 'Magnificent. Not a crumb in sight.'],
  ['shocked', 'Lint... where IS the city?'],
  ['stern', 'Ah. I see. Well. Put it somewhere tidy.'],
  ['pleased', 'Inspection passed. Tea is at four. Do not roll the teapot.'],
];

// results verdicts
export const VERDICT = {
  fail: [
    'Tut-tut. Almost tidy is still untidy. Again!',
    'I have seen tidier tornadoes. Once more, with feeling.',
    'Hmm. My clipboard is disappointed, and so am I.',
  ],
  ok: ['Acceptable. I shall write "acceptable" in very small letters.', 'Tidy enough. Do not let it go to your ears.'],
  good: ['Well rolled! My monocle nearly fell out.', 'Splendid. I may even smile. Later. In private.'],
  great: ['Magnificent! That is the tidiest thing I have ever seen.', 'Three stars. I am having to sit down.'],
  zen: ['A pleasant little roll. Very calming. For you.', 'Leisurely, yet thorough. I approve of thorough.'],
};

export function verdictFor(result) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  if (result.mode === 'zen') return result.completed ? pick(VERDICT.zen) : pick(VERDICT.fail);
  if (!result.completed) return pick(VERDICT.fail);
  if (result.stars >= 3) return pick(VERDICT.great);
  if (result.stars >= 2) return pick(VERDICT.good);
  return pick(VERDICT.ok);
}

export function moodFor(result) {
  if (!result.completed) return 'stern';
  if (result.mode === 'timed' && result.stars >= 3) return 'shocked';
  return 'pleased';
}
