import test from 'node:test';
import assert from 'node:assert/strict';
import { SONGS } from '../../src/audio/songs.js';
import { parseMelody, parseChord, noteToMidi } from '../../src/audio/music.js';

test('note parsing', () => {
  assert.equal(noteToMidi('A4'), 69);
  assert.equal(noteToMidi('C4'), 60);
  assert.equal(noteToMidi('Bb3'), 58);
});

test('every song: chords parse, melodies fill their sections exactly', () => {
  for (const [id, song] of Object.entries(SONGS)) {
    for (const name of song.arrange) assert.ok(song.sections[name], `${id}: missing section ${name}`);
    for (const [name, sec] of Object.entries(song.sections)) {
      sec.chords.forEach((bar) => bar.split(/\s+/).forEach((c) => parseChord(c)));
      for (const p of sec.parts) if (p.notes) assert.equal(parseMelody(p.notes).total, sec.chords.length * 16, `${id}/${name}`);
    }
  }
});

test('each level has its own theme', async () => {
  const { LEVELS } = await import('../../src/levels/index.js');
  const themes = LEVELS.map((l) => l.theme);
  assert.equal(new Set(themes).size, 6);
  for (const t of themes) assert.ok(SONGS[t], t);
});
