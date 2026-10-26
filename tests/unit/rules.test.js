import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../src/game/rules.js';

test('pickup threshold is half the ball diameter', () => {
  assert.equal(R.pickupThreshold(0.04), 0.02);
  assert.ok(R.canPickUp(0.02, 0.04));
  assert.ok(!R.canPickUp(0.0201, 0.04));
});

test('wobble band sits just above the threshold', () => {
  assert.ok(!R.isAlmost(0.019, 0.04)); // collectible, not "almost"
  assert.ok(R.isAlmost(0.025, 0.04));
  assert.ok(!R.isAlmost(0.03, 0.04)); // far too big
});

test('tiny cutoff relative to radius', () => {
  assert.ok(R.isTiny(0.01, 1));
  assert.ok(!R.isTiny(0.05, 1));
});

test('volume <-> radius round-trips', () => {
  for (const r of [0.01, 1, 123]) assert.ok(Math.abs(R.radiusFromVolume(R.sphereVolume(r)) - r) < 1e-9 * r);
});

test('growth is monotonic and bigger objects grow more', () => {
  const r = 0.02;
  const small = R.grow(r, 1e-7, 0.005);
  const big = R.grow(r, 2e-5, 0.02);
  assert.ok(small > r && big > small);
});

test('even a crumb visibly counts (size-linear term)', () => {
  const r = 0.02;
  const after = R.grow(r, 9.6e-8, 0.0064); // a crumb
  assert.ok((after - r) / r > 0.0008, `crumb growth ${(after - r) / r}`);
});

test('growth is scale invariant (same relative pickup = same relative growth)', () => {
  const rel = (r) => {
    const s = 0.4 * 2 * r;
    const v = s * s * s * 0.5;
    return R.grow(r, v, s) / r;
  };
  assert.ok(Math.abs(rel(0.02) - rel(40)) < 1e-9);
});

test('shrink undoes gainVolume exactly and respects the minimum', () => {
  const r = 0.05;
  const g = R.gainVolume(r, 1e-5, 0.03);
  const r2 = R.radiusFromVolume(R.sphereVolume(r) + g);
  assert.ok(Math.abs(R.shrink(r2, g, 0.01) - r) < 1e-12);
  assert.equal(R.shrink(r, 1, 0.04), 0.04);
});

test('stars at 1x, 1.4x, 1.9x target', () => {
  assert.equal(R.starsFor(0.21, 0.22), 0);
  assert.equal(R.starsFor(0.22, 0.22), 1);
  assert.equal(R.starsFor(0.22 * 1.4, 0.22), 2);
  assert.equal(R.starsFor(0.22 * 1.9, 0.22), 3);
  assert.equal(R.starsFor(5, 0.22), 3);
});

test('completion = reaching the target, either mode', () => {
  assert.ok(R.isCompleted(0.22, 0.22));
  assert.ok(!R.isCompleted(0.2199, 0.22));
});

test('milestones follow a 1-2-5 series', () => {
  assert.equal(R.milestoneAfter(0.04), 0.05);
  assert.equal(R.milestoneAfter(0.05), 0.1);
  assert.equal(R.milestoneAfter(0.15), 0.2);
  assert.equal(R.milestoneAfter(3), 5);
  assert.equal(R.milestoneAfter(250), 500);
});

test('formatting', () => {
  assert.equal(R.formatSize(0.004), '4.0 mm');
  assert.equal(R.formatSize(0.045), '4.5 cm');
  assert.equal(R.formatSize(0.22), '22 cm');
  assert.equal(R.formatSize(1.234), '1.23 m');
  assert.equal(R.formatSize(412.4), '412 m');
  assert.equal(R.formatTime(240), '4:00');
  assert.equal(R.formatTime(9.2), '0:10');
  assert.equal(R.formatTime(-3), '0:00');
});
