import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveStore, memoryStorage, SAVE_KEY, sanitize, defaultSave } from '../../src/core/save.js';

const result = (o) => ({ mode: 'timed', diameter: 0.25, stars: 1, completed: true, time: 200, collected: new Map([['coin', 3], ['pea', 5]]), ...o });

test('fresh save has level 1 unlocked and defaults', () => {
  const s = new SaveStore(memoryStorage());
  assert.equal(s.data.unlocked, 1);
  assert.equal(s.data.skins.equipped, 'lavender');
});

test('completing a level unlocks the next, in either mode', () => {
  const s = new SaveStore(memoryStorage());
  let r = s.recordResult(0, 'crumb', result({ mode: 'zen', stars: 0 }));
  assert.ok(r.unlockedNext);
  assert.equal(s.data.unlocked, 2);
  r = s.recordResult(1, 'bedroom', result({ mode: 'timed', completed: false, diameter: 0.5, stars: 0 }));
  assert.ok(!r.unlockedNext);
  assert.equal(s.data.unlocked, 2);
  s.recordResult(1, 'bedroom', result({ mode: 'timed', completed: true, diameter: 1.2, stars: 1 }));
  assert.equal(s.data.unlocked, 3);
});

test('replaying an earlier level never relocks or lowers progress', () => {
  const s = new SaveStore(memoryStorage());
  s.recordResult(0, 'crumb', result({ stars: 3, diameter: 0.5 }));
  s.recordResult(1, 'bedroom', result({ stars: 2 }));
  s.recordResult(0, 'crumb', result({ stars: 1, diameter: 0.23 }));
  assert.equal(s.data.unlocked, 3);
  assert.equal(s.data.levels.crumb.timed.stars, 3);
  assert.equal(s.data.levels.crumb.timed.best, 0.5);
});

test('collection log accumulates and reports new types', () => {
  const s = new SaveStore(memoryStorage());
  let r = s.recordResult(0, 'crumb', result());
  assert.deepEqual(r.newTypes.sort(), ['coin', 'pea']);
  r = s.recordResult(0, 'crumb', result({ collected: new Map([['coin', 2], ['die', 1]]) }));
  assert.deepEqual(r.newTypes, ['die']);
  assert.equal(s.data.seen.coin, 5);
  assert.equal(s.discovered(), 3);
});

test('progress survives a reload (round-trip through storage)', () => {
  const store = memoryStorage();
  const a = new SaveStore(store);
  a.recordResult(0, 'crumb', result({ stars: 2 }));
  a.data.settings.music = 0.25;
  a.save();
  const b = new SaveStore(store);
  assert.equal(b.data.unlocked, 2);
  assert.equal(b.data.levels.crumb.timed.stars, 2);
  assert.equal(b.data.settings.music, 0.25);
  assert.equal(b.data.seen.pea, 5);
});

test('corrupt or hostile storage falls back safely', () => {
  const store = memoryStorage();
  store.setItem(SAVE_KEY, '{not json');
  assert.deepEqual(new SaveStore(store).data, defaultSave());
  store.setItem(SAVE_KEY, JSON.stringify({ unlocked: 99, levels: { crumb: { timed: { stars: 7, best: 'x' } } }, settings: { music: 4, quality: 'ultra' }, seen: { coin: -3, pea: 2 } }));
  const s = new SaveStore(store).data;
  assert.equal(s.unlocked, 6);
  assert.equal(s.levels.crumb.timed.stars, 3);
  assert.equal(s.levels.crumb.timed.best, 0);
  assert.equal(s.settings.music, 1);
  assert.equal(s.settings.quality, 'auto');
  assert.deepEqual(s.seen, { pea: 2 });
});

test('storage that throws on write does not crash', () => {
  const store = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
  const s = new SaveStore(store);
  assert.equal(s.save(), false);
  s.recordResult(0, 'crumb', result());
  assert.equal(s.data.unlocked, 2);
});

test('reset keeps settings but clears progress', () => {
  const s = new SaveStore(memoryStorage());
  s.recordResult(0, 'crumb', result());
  s.data.settings.sfx = 0.1;
  s.reset();
  assert.equal(s.data.unlocked, 1);
  assert.equal(s.data.settings.sfx, 0.1);
  assert.equal(sanitize(null).v, 1);
});
