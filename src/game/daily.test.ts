import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ALL_RESORTS, dateFromQuery, puzzleFor } from './daily.ts';
import { TIER_COUNT } from './resorts.ts';
import { seededShuffle } from './rng.ts';

test('the pool is well formed', () => {
  assert.ok(ALL_RESORTS.length >= 450, `only ${ALL_RESORTS.length} resorts`);
  for (const r of ALL_RESORTS) {
    assert.ok(r.name && r.state && r.region, `incomplete record: ${JSON.stringify(r)}`);
    assert.ok(r.tier >= 1 && r.tier <= TIER_COUNT, `${r.name} has tier ${r.tier}`);
    assert.ok(Number.isFinite(r.lat) && Number.isFinite(r.lng));
  }
  assert.equal(new Set(ALL_RESORTS.map((r) => r.name)).size, ALL_RESORTS.length, 'names collide');
});

test('a puzzle is five distinct resorts, one per tier, easiest first', () => {
  const { resorts } = puzzleFor(new Date(2026, 9, 1));
  assert.equal(resorts.length, TIER_COUNT);
  assert.deepEqual(
    resorts.map((r) => r.tier),
    [1, 2, 3, 4, 5],
  );
  assert.equal(new Set(resorts.map((r) => r.id)).size, TIER_COUNT);
});

test('the same calendar day always yields the same puzzle', () => {
  const morning = puzzleFor(new Date(2026, 9, 1, 6, 30));
  const night = puzzleFor(new Date(2026, 9, 1, 23, 59));
  assert.equal(morning.number, night.number);
  assert.deepEqual(
    morning.resorts.map((r) => r.id),
    night.resorts.map((r) => r.id),
  );
});

test('consecutive days differ, and puzzle numbers advance by one', () => {
  const a = puzzleFor(new Date(2026, 9, 1));
  const b = puzzleFor(new Date(2026, 9, 2));
  assert.equal(b.number, a.number + 1);
  assert.notDeepEqual(
    a.resorts.map((r) => r.id),
    b.resorts.map((r) => r.id),
  );
});

test('the epoch day is puzzle #1', () => {
  assert.equal(puzzleFor(new Date(2026, 9, 1)).number, 1);
});

test('no resort repeats until its tier is exhausted', () => {
  const smallestTier = Math.min(
    ...Array.from({ length: TIER_COUNT }, (_, i) =>
      ALL_RESORTS.filter((r) => r.tier === i + 1).length,
    ),
  );
  const seen = Array.from({ length: TIER_COUNT }, () => new Set<string>());
  for (let d = 0; d < smallestTier; d++) {
    const { resorts } = puzzleFor(new Date(2026, 9, 1 + d));
    resorts.forEach((r, i) => {
      assert.ok(!seen[i]!.has(r.id), `${r.name} repeated on day ${d}`);
      seen[i]!.add(r.id);
    });
  }
});

test('puzzles stay stable going backwards past the epoch', () => {
  const before = puzzleFor(new Date(2026, 8, 20));
  assert.equal(before.resorts.length, TIER_COUNT);
  assert.deepEqual(
    before.resorts.map((r) => r.id),
    puzzleFor(new Date(2026, 8, 20)).resorts.map((r) => r.id),
  );
});

test('seededShuffle is deterministic and order-changing', () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  assert.deepEqual(seededShuffle(items, 'a'), seededShuffle(items, 'a'));
  assert.notDeepEqual(seededShuffle(items, 'a'), seededShuffle(items, 'b'));
  assert.deepEqual([...seededShuffle(items, 'a')].sort((x, y) => x - y), items);
});

test('?date overrides today, and junk falls back to today', () => {
  assert.equal(puzzleFor(dateFromQuery('?date=2026-12-25')).number, puzzleFor(new Date(2026, 11, 25)).number);
  const today = new Date().toDateString();
  assert.equal(dateFromQuery('?date=nonsense').toDateString(), today);
  assert.equal(dateFromQuery('').toDateString(), today);
});
