// Original music for Lint Roller. Chord charts, grooves and melodies written for this game.
// Melody tokens: NOTE+OCTAVE/length-in-16ths ("r" = rest, "!" = accent). Each bar = 16 steps.

// ---------------------------------------------------------------- shared grooves
const BOSSA = {
  kick: 'x.....x.x.....x.',
  rim: 'x..x..x...x..x..',
  shaker: 'xgogxgogxgogxgog',
  brush: '....o.......o...',
};
const FUNK = {
  kick: 'x.....x...x..x..',
  snare: '....x..g....x..g',
  hat: 'xgxgxgxgxgxgxgog',
  ohat: '..............o.',
};
const SWING = {
  ride: 'x...x.x.x...x.x.',
  hat: '....x.......x...',
  kick: 'g.......g.......',
  brush: '.......g.......g..g.........g...',
};
const DISCO = {
  kick: 'x...x...x...x...',
  clap: '....x.......x...',
  ohat: '..x...x...x...x.',
  hat: 'g.g.g.g.g.g.g.g.',
  shaker: '.g.g.g.g.g.g.g.g',
};
const MAMBO = {
  clave: '....x...x.......x.....x.....x...',
  cowbell: 'x.o.x.o.x.o.x.o.',
  conga: '......xx......xx',
  congaHi: '..x.......x.....',
  kick: '...x.......x....',
  timbale: '................................x..xx...........................',
};
const BIGFUNK = {
  kick: 'x..x..x...x..x..',
  snare: '....X..g.g..X..g',
  hat: 'xgxgxgxgxgxgxgxg',
  ohat: '......o.......o.',
};

const fill = (pat, n) => pat.repeat(Math.ceil(n / pat.length)).slice(0, n);

// ---------------------------------------------------------------- 1 Crumb Patrol (bossa-funk, F)
const crumbA = ['Fmaj9', 'Fmaj9', 'Gm9', 'C13', 'Am7', 'D7#9', 'Gm9', 'C7sus4'];
const crumbB = ['Bbmaj9', 'Bbmaj9', 'Am7', 'D7b9', 'Gm9', 'C13', 'Fmaj9', 'C7sus4'];
const crumbBass = { type: 'bass', style: 'finger', pat: [[0, 'R', 5], [6, '5', 2], [8, '5', 5], [14, 'nR', 2, 0.7]] };
const crumbComp = { type: 'comp', inst: 'epiano', rhythm: 'x-.x-.x-..x-.x..', vel: 0.75 };
const crumbMel =
  'A4/2 C5/2 E5/6 D5/2 C5/2 A4/2  G4/2 A4/2 C5/12  Bb4/2 D5/2 F5/6 E5/2 D5/2 Bb4/2  A4/4 G4/4 E4/8 ' +
  'C5/2 E5/2 G5/6 F5/2 E5/2 C5/2  F#5/4 E5/2 C5/2 A4/8  Bb4/2 C5/2 D5/2 F5/2 E5/4 D5/4  C5/8 r/8';
const crumbMelB =
  'D5/4 F5/4 A5/8  C6/2 A5/2 F5/4 D5/8  E5/4 G5/4 C6/8  Eb5/2 F#5/2 A5/4 C6/8 ' +
  'Bb5/6 A5/2 G5/4 F5/4  E5/4 D5/4 C5/4 Bb4/4  A4/16  r/8 G4/2 A4/2 C5/4';
export const crumb = {
  id: 'crumb',
  title: 'Crumb Patrol',
  bpm: 100,
  swing: 0.35,
  sections: {
    intro: { chords: crumbA, parts: [{ type: 'drums', pat: BOSSA }, crumbBass, crumbComp] },
    A: { chords: crumbA, parts: [{ type: 'drums', pat: BOSSA }, crumbBass, crumbComp, { type: 'mel', inst: 'whistle', notes: crumbMel }] },
    B: { chords: crumbB, parts: [{ type: 'drums', pat: { ...BOSSA, hat: 'g.x.g.x.g.x.g.x.' } }, crumbBass, crumbComp, { type: 'mel', inst: 'vibes', notes: crumbMelB }] },
    A2: {
      chords: crumbA,
      parts: [{ type: 'drums', pat: BOSSA }, crumbBass, crumbComp, { type: 'mel', inst: 'whistle', notes: crumbMel, double: 'glock', doubleOct: 1 }],
    },
  },
  arrange: ['intro', 'A', 'B', 'A2'],
  loopFrom: 1,
};

// ---------------------------------------------------------------- 2 Sock Drawer Stomp (toy funk, D dorian)
const sockA = ['Dm9', 'G13', 'Dm9', 'G13', 'Dm9', 'G13', 'Bbmaj7', 'A7#9'];
const sockB = ['Gm9', 'C13', 'Fmaj7', 'Bbmaj7', 'Em7b5', 'A7b9', 'Dm9', 'A7#9'];
const sockBass = { type: 'bass', style: 'slap', pat: [[0, 'R', 2], [3, '8', 1, 0.7], [6, 'R', 1], [8, 'b7', 1, 0.8], [10, '8', 2], [13, '5', 1, 0.7], [14, 'b7', 2, 0.8]] };
const sockClav = { type: 'comp', inst: 'clav', rhythm: 'x.xo..x.x.xo..x.', vel: 0.8, lo: 58, hi: 74 };
const sockMel =
  'D5/2 F5/2 A5/2 F5/2 G5/4 r/4  B4/2 D5/2 E5/2 F5/2 E5/4 r/4  D5/2 F5/2 A5/2 C6/2 A5/4 G5/4  F5/2 E5/2 D5/2 B4/2 D5/8 ' +
  'D5/2 F5/2 A5/2 F5/2 G5/4 r/4  B4/2 D5/2 E5/2 F5/2 E5/4 D5/4  F5/4 A5/4 D6/4 C6/4  C#6/4 C6/2 A5/2 G5/2 E5/2 C#5/4';
const sockMelB =
  'G4/4 Bb4/2 D5/2 F5/8  E5/2 F5/2 E5/2 D5/2 C5/8  A4/4 C5/4 E5/8  D5/2 F5/2 A5/4 G5/8 ' +
  'G5/4 Bb4/4 D5/8  C#5/2 E5/2 G5/2 Bb5/2 A5/8  F5/4 E5/2 D5/10  r/16';
export const bedroom = {
  id: 'bedroom',
  title: 'Sock Drawer Stomp',
  bpm: 108,
  swing: 0.2,
  sections: {
    intro: { chords: sockA.slice(0, 4), parts: [{ type: 'drums', pat: FUNK }, sockBass, sockClav] },
    A: { chords: sockA, parts: [{ type: 'drums', pat: FUNK }, sockBass, sockClav, { type: 'mel', inst: 'glock', notes: sockMel }] },
    B: { chords: sockB, parts: [{ type: 'drums', pat: { ...FUNK, ohat: '..o...o...o...o.' } }, sockBass, { ...sockClav, inst: 'epiano', rhythm: 'x-....x-..x-....' }, { type: 'mel', inst: 'kazoo', notes: sockMelB }] },
  },
  arrange: ['intro', 'A', 'B', 'A'],
  loopFrom: 1,
};

// ---------------------------------------------------------------- 3 Household Shuffle (swing, Bb)
const shufA = ['Bbmaj7 G7', 'Cm7 F7', 'Dm7 G7', 'Cm7 F7', 'Fm7 Bb7', 'Ebmaj7 Ab7', 'Dm7 G7', 'Cm7 F7'];
const shufB = ['D7', 'D7', 'G7', 'G7', 'C7', 'C7', 'F7', 'F7'];
const shufComp = { type: 'comp', inst: 'epiano', rhythm: 'x.....x.........', vel: 0.7 };
const shufMel =
  'D5/4 F5/2 D5/2 B4/4 D5/4  Eb5/2 D5/2 C5/2 Bb4/2 A4/4 C5/4  F5/4 A5/4 G5/2 F5/2 D5/4  Eb5/4 C5/2 A4/2 Bb4/8 ' +
  'Ab4/2 C5/2 Eb5/2 F5/2 D5/4 Bb4/4  G5/4 Eb5/4 Gb5/4 F5/4  F5/2 E5/2 D5/2 B4/2 G4/4 B4/4  C5/6 A4/2 Bb4/8';
const shufMelB =
  'F#5/4 A5/4 C6/4 A5/4  F#5/2 E5/2 D5/4 r/8  B5/4 D6/4 F5/4 D5/4  B4/2 C5/2 D5/4 r/8 ' +
  'E5/4 G5/4 Bb5/4 G5/4  E5/2 D5/2 C5/4 r/8  A5/4 C6/4 Eb5/4 C5/4  A4/4 C5/4 Eb5/4 F5/4';
export const house = {
  id: 'house',
  title: 'Household Shuffle',
  bpm: 138,
  swing8: 0.9,
  sections: {
    A: { chords: shufA, parts: [{ type: 'drums', pat: SWING }, { type: 'walk' }, shufComp, { type: 'mel', inst: 'brass', notes: shufMel, vel: 0.85 }] },
    B: { chords: shufB, parts: [{ type: 'drums', pat: SWING }, { type: 'walk' }, shufComp, { type: 'mel', inst: 'vibes', notes: shufMelB }] },
    A2: { chords: shufA, parts: [{ type: 'drums', pat: SWING }, { type: 'walk' }, shufComp, { type: 'mel', inst: 'brass', notes: shufMel, double: 'kazoo', doubleOct: -1 }] },
  },
  arrange: ['A', 'A2', 'B', 'A'],
  loopFrom: 0,
};

// ---------------------------------------------------------------- 4 Cul-de-Sac Strut (disco funk, E minor)
const strutA = ['Em9', 'A13', 'Em9', 'A13', 'Cmaj7', 'B7#9', 'Em9', 'B7#9'];
const strutB = ['Am9', 'D13', 'Gmaj7', 'Cmaj7', 'F#m7b5', 'B7b9', 'Em9', 'B7#9'];
const strutBass = { type: 'bass', style: 'synth', pat: [0, 2, 4, 6, 8, 10, 12, 14].map((s, k) => [s, k % 2 ? '8' : 'R', 1, k % 2 ? 0.75 : 0.95]) };
const strutComp = { type: 'comp', inst: 'epiano', rhythm: '....x-......x-x.', vel: 0.7 };
const strutMel =
  'B4/2 D5/2 E5/4 D5/2 B4/2 G4/4  A4/2 B4/2 C#5/4 E5/8  B4/2 D5/2 E5/4 G5/2 E5/2 D5/4  F#5/4 E5/4 C#5/8 ' +
  'E5/2 G5/2 B5/8 A5/4  A5/2 G5/2 F#5/4 D#5/8  E5/12 r/4  r/8 B4/2 D5/2 E5/4';
const strutMelB =
  'C5/4 E5/4 G5/8  F#5/4 E5/4 D5/8  B4/4 D5/4 F#5/8  E5/4 G5/4 B5/8 ' +
  'A5/4 C6/4 A5/8  G5/2 F#5/2 D#5/4 B4/8  E5/16  r/16';
export const culdesac = {
  id: 'culdesac',
  title: 'Cul-de-Sac Strut',
  bpm: 116,
  swing: 0.1,
  sections: {
    intro: { chords: strutA.slice(0, 4), parts: [{ type: 'drums', pat: DISCO }, strutBass] },
    A: {
      chords: strutA,
      parts: [{ type: 'drums', pat: DISCO }, strutBass, strutComp, { type: 'mel', inst: 'kazoo', notes: strutMel }, { type: 'hit', inst: 'brass', at: [[1, 14], [3, 14], [5, 0], [7, 6]] }],
    },
    B: { chords: strutB, parts: [{ type: 'drums', pat: DISCO }, strutBass, strutComp, { type: 'pad' }, { type: 'mel', inst: 'brass', notes: strutMelB }] },
    A2: {
      chords: strutA,
      parts: [{ type: 'drums', pat: DISCO }, strutBass, strutComp, { type: 'mel', inst: 'whistle', notes: strutMel, oct: 1, double: 'kazoo', doubleOct: -1 }],
    },
  },
  arrange: ['intro', 'A', 'B', 'A2'],
  loopFrom: 1,
};

// ---------------------------------------------------------------- 5 Main Street Mambo (latin, C minor)
const mamboA = ['Cm7', 'F7', 'Cm7', 'G7b9', 'Cm7', 'F7', 'Abmaj7', 'G7b9'];
const mamboB = ['Fm7', 'Bb7', 'Ebmaj7', 'Abmaj7', 'Dm7b5', 'G7b9', 'Cm7', 'G7b9'];
const mamboBass = { type: 'bass', style: 'finger', pat: [[6, '5', 6, 0.85], [12, 'nR', 4, 0.95]] };
const montuno = {
  type: 'arp',
  inst: 'epiano',
  vel: 0.6,
  patLen: 16,
  pat: [[0, 3, 1], [2, 1, 1], [3, 2, 1], [5, 3, 1], [6, 1, 1], [8, 2, 1], [10, 3, 1], [11, 1, 1], [13, 2, 1], [14, 4, 1]],
};
const mamboMel =
  'G5/3 G5/3 G5/2 Eb5/4 C5/4  A5/4 F5/2 Eb5/2 C5/8  G5/3 G5/3 G5/2 Bb5/4 G5/4  Ab5/4 F5/2 D5/2 B4/8 ' +
  'C6/4 Bb5/2 G5/2 Eb5/4 G5/4  F5/4 Eb5/2 C5/2 A4/8  C5/4 Eb5/4 G5/4 Ab5/4  B5/4 Ab5/2 F5/2 D5/8';
const mamboMelB =
  'Ab5/4 C6/4 Ab5/4 F5/4  D5/4 F5/4 Ab5/8  G5/4 Bb5/4 D6/8  C6/6 Bb5/2 Ab5/8 ' +
  'F5/4 Ab5/4 C6/8  B5/4 Ab5/4 F5/4 D5/4  Eb5/16  r/8 G4/2 B4/2 D5/4';
export const town = {
  id: 'town',
  title: 'Main Street Mambo',
  bpm: 124,
  swing: 0,
  sections: {
    intro: { chords: mamboA.slice(0, 4), parts: [{ type: 'drums', pat: MAMBO }, mamboBass, montuno] },
    A: { chords: mamboA, parts: [{ type: 'drums', pat: MAMBO }, mamboBass, montuno, { type: 'mel', inst: 'brass', notes: mamboMel }] },
    B: { chords: mamboB, parts: [{ type: 'drums', pat: MAMBO }, mamboBass, montuno, { type: 'mel', inst: 'organ', notes: mamboMelB, oct: 0 }] },
    A2: { chords: mamboA, parts: [{ type: 'drums', pat: MAMBO }, mamboBass, montuno, { type: 'mel', inst: 'brass', notes: mamboMel, double: 'whistle', doubleOct: 0 }] },
  },
  arrange: ['intro', 'A', 'B', 'A2'],
  loopFrom: 1,
};

// ---------------------------------------------------------------- 6 Skyline Shuffle (big-band funk finale, Eb -> F)
const skyA = ['Ebmaj9', 'Cm9', 'Fm9', 'Bb13', 'Ebmaj9', 'Cm9', 'Abmaj7', 'Bb7sus4'];
const skyB = ['Fmaj9', 'Dm9', 'Gm9', 'C13', 'Fmaj9', 'Dm9', 'Bbmaj7', 'C7sus4'];
const skyBass = { type: 'bass', style: 'slap', pat: [[0, 'R', 2], [3, '8', 1, 0.7], [6, '5', 1], [8, 'R', 1], [10, 'b7', 1, 0.8], [11, '8', 1, 0.7], [14, 'nR', 2]] };
const skyClav = { type: 'comp', inst: 'clav', rhythm: '..x.x..x..x.x..o', vel: 0.75, lo: 58, hi: 74 };
const skyMel =
  'Bb4/2 Eb5/2 G5/2 Bb5/6 G5/4  Eb5/2 G5/2 Bb5/4 D6/8  C6/2 Ab5/2 F5/4 Eb5/4 C5/4  D5/4 F5/2 G5/2 Ab5/8 ' +
  'G5/2 Bb5/2 Eb6/8 D6/4  C6/2 Bb5/2 G5/4 Eb5/8  C6/4 Bb5/4 Ab5/4 G5/4  F5/8 Eb5/8';
export const city = {
  id: 'city',
  title: 'Skyline Shuffle',
  bpm: 128,
  swing: 0.3,
  sections: {
    intro: { chords: skyA.slice(0, 4), parts: [{ type: 'drums', pat: BIGFUNK }, skyBass, skyClav, { type: 'hit', inst: 'brass', at: [[0, 0], [1, 0], [2, 0], [3, 10]] }] },
    A: { chords: skyA, parts: [{ type: 'drums', pat: BIGFUNK }, skyBass, skyClav, { type: 'pad' }, { type: 'mel', inst: 'brass', notes: skyMel }] },
    B: {
      chords: skyB,
      transpose: 0,
      parts: [{ type: 'drums', pat: { ...BIGFUNK, ride: 'x.x.x.x.x.x.x.x.' } }, skyBass, skyClav, { type: 'pad' }, { type: 'mel', inst: 'whistle', notes: skyMel, oct: 0, double: 'glock', doubleOct: 1, shift: 2 }],
    },
    A2: { chords: skyA, parts: [{ type: 'drums', pat: BIGFUNK }, skyBass, skyClav, { type: 'pad' }, { type: 'mel', inst: 'brass', notes: skyMel, double: 'kazoo', doubleOct: -1 }] },
  },
  arrange: ['intro', 'A', 'B', 'A2'],
  loopFrom: 1,
};

// ---------------------------------------------------------------- Title: Lint's Theme (lounge, G)
const themeA = ['Gmaj7', 'Em9', 'Am9', 'D13', 'Bm7', 'E7b9', 'Am9', 'D7sus4'];
const themeMel =
  'B4/4 D5/4 F#5/8  G5/4 F#5/2 E5/2 B4/8  C5/4 E5/4 G5/4 B5/4  A5/8 F#5/8 ' +
  'D5/4 F#5/4 A5/8  G#5/4 F5/4 D5/8  C5/6 B4/2 A4/8  r/16';
export const title = {
  id: 'title',
  title: "Lint's Theme",
  bpm: 92,
  swing8: 0.6,
  gain: 0.9,
  sections: {
    A: {
      chords: themeA,
      parts: [
        { type: 'drums', pat: { brush: 'o...x.g.o...x.g.', ride: 'x...x.x.x...x.x.', kick: 'g.......g.......' }, vel: 0.8 },
        { type: 'bass', style: 'finger', pat: [[0, 'R', 6], [6, '5', 2], [8, '5', 4], [12, 'ap', 4]] },
        { type: 'comp', inst: 'epiano', rhythm: 'x-------..x-....', vel: 0.6 },
        { type: 'mel', inst: 'vibes', notes: themeMel },
      ],
    },
    B: {
      chords: themeA,
      parts: [
        { type: 'drums', pat: { brush: 'o...x.g.o...x.g.', ride: 'x...x.x.x...x.x.', kick: 'g.......g.......' }, vel: 0.8 },
        { type: 'bass', style: 'finger', pat: [[0, 'R', 6], [6, '5', 2], [8, '5', 4], [12, 'ap', 4]] },
        { type: 'comp', inst: 'epiano', rhythm: 'x-------..x-....', vel: 0.6 },
        { type: 'mel', inst: 'whistle', notes: themeMel, double: 'vibes' },
      ],
    },
  },
  arrange: ['A', 'B'],
  loopFrom: 0,
};

export const SONGS = { crumb, bedroom, house, culdesac, town, city, title };
export { fill };
