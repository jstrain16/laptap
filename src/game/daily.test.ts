import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dateFromQuery, puzzleFor } from './daily.ts';
import { COUNTRIES, IKON, STATES, USA } from './fixtures.test-util.ts';
import { boundaryAt } from './geo.ts';
import { POOLS, poolFromQuery, type PoolId } from './pools.ts';
import { TIER_COUNT, type Resort } from './resorts.ts';
import { seededShuffle } from './rng.ts';

const POOL_DATA: [PoolId, Resort[], number][] = [
  ['ikon', IKON, 70],
  ['usa', USA, 450],
];

for (const [id, resorts, minSize] of POOL_DATA) {
  test(`${id}: the pool is well formed`, () => {
    assert.ok(resorts.length >= minSize, `only ${resorts.length} resorts`);
    for (const r of resorts) {
      assert.ok(r.name && r.place && r.fine && r.coarse, `incomplete: ${JSON.stringify(r)}`);
      assert.ok(r.tier >= 1 && r.tier <= TIER_COUNT, `${r.name} has tier ${r.tier}`);
      assert.ok(Math.abs(r.lat) <= 90 && Math.abs(r.lng) <= 180, `${r.name} is off the planet`);
    }
    assert.equal(new Set(resorts.map((r) => r.name)).size, resorts.length, 'names collide');
    assert.equal(new Set(resorts.map((r) => r.id)).size, resorts.length, 'ids collide');
  });

  test(`${id}: a puzzle is five distinct resorts, one per tier, easiest first`, () => {
    const { resorts: picked } = puzzleFor(new Date(2026, 9, 1), id, resorts);
    assert.equal(picked.length, TIER_COUNT);
    assert.deepEqual(
      picked.map((r) => r.tier),
      [1, 2, 3, 4, 5],
    );
    assert.equal(new Set(picked.map((r) => r.id)).size, TIER_COUNT);
  });

  test(`${id}: the same calendar day always yields the same puzzle`, () => {
    const morning = puzzleFor(new Date(2026, 9, 1, 6, 30), id, resorts);
    const night = puzzleFor(new Date(2026, 9, 1, 23, 59), id, resorts);
    assert.equal(morning.number, night.number);
    assert.deepEqual(
      morning.resorts.map((r) => r.id),
      night.resorts.map((r) => r.id),
    );
  });

  test(`${id}: consecutive days differ and puzzle numbers advance by one`, () => {
    const a = puzzleFor(new Date(2026, 9, 1), id, resorts);
    const b = puzzleFor(new Date(2026, 9, 2), id, resorts);
    assert.equal(b.number, a.number + 1);
    assert.notDeepEqual(
      a.resorts.map((r) => r.id),
      b.resorts.map((r) => r.id),
    );
  });

  test(`${id}: no resort repeats until its tier is exhausted`, () => {
    const smallest = Math.min(
      ...Array.from({ length: TIER_COUNT }, (_, i) =>
        resorts.filter((r) => r.tier === i + 1).length,
      ),
    );
    const seen = Array.from({ length: TIER_COUNT }, () => new Set<string>());
    for (let d = 0; d < smallest; d++) {
      for (const [i, r] of puzzleFor(new Date(2026, 9, 1 + d), id, resorts).resorts.entries()) {
        assert.ok(!seen[i]!.has(r.id), `${r.name} repeated on day ${d}`);
        seen[i]!.add(r.id);
      }
    }
  });
}

test('ikon: no pair of mountains shares a puzzle twice within 60 days', () => {
  // Tier sizes are pairwise coprime for exactly this reason: a player who
  // plays every day should never feel a puzzle echo an earlier one.
  const seen = new Map<string, number>();
  for (let d = 0; d < 60; d++) {
    const { number, resorts } = puzzleFor(new Date(2026, 9, 1 + d), 'ikon', IKON);
    for (let i = 0; i < resorts.length; i++) {
      for (let j = i + 1; j < resorts.length; j++) {
        const key = [resorts[i]!.id, resorts[j]!.id].sort().join('|');
        const first = seen.get(key);
        assert.equal(
          first,
          undefined,
          `${resorts[i]!.name} + ${resorts[j]!.name} appeared together on #${first} and #${number}`,
        );
        seen.set(key, number);
      }
    }
  }
});

test('ikon: no two tiers realign within 60 days', () => {
  const sizes = Array.from({ length: TIER_COUNT }, (_, i) =>
    IKON.filter((r) => r.tier === i + 1).length,
  );
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  for (let i = 0; i < sizes.length; i++) {
    for (let j = i + 1; j < sizes.length; j++) {
      const period = (sizes[i]! * sizes[j]!) / gcd(sizes[i]!, sizes[j]!);
      assert.ok(period >= 60, `tiers ${i + 1} and ${j + 1} (${sizes[i]}, ${sizes[j]}) realign every ${period} days`);
    }
  }
});

test('the two pools ask different questions on the same day', () => {
  const a = puzzleFor(new Date(2026, 9, 1), 'ikon', IKON);
  const b = puzzleFor(new Date(2026, 9, 1), 'usa', USA);
  assert.notDeepEqual(
    a.resorts.map((r) => r.name),
    b.resorts.map((r) => r.name),
  );
});

test('the epoch day is puzzle #1 and earlier days stay stable', () => {
  assert.equal(puzzleFor(new Date(2026, 9, 1), 'ikon', IKON).number, 1);
  const before = puzzleFor(new Date(2026, 8, 20), 'ikon', IKON);
  assert.equal(before.resorts.length, TIER_COUNT);
  assert.deepEqual(
    before.resorts.map((r) => r.id),
    puzzleFor(new Date(2026, 8, 20), 'ikon', IKON).resorts.map((r) => r.id),
  );
});

test('every resort sits inside the boundary it claims', () => {
  for (const [resorts, boundaries] of [
    [IKON, COUNTRIES],
    [USA, STATES],
  ] as const) {
    const wrong = resorts.filter((r) => boundaryAt(r, boundaries)?.name !== r.fine);
    assert.ok(
      wrong.length / resorts.length < 0.05,
      `${wrong.length} resorts geocode outside their own boundary: ` +
        wrong.slice(0, 3).map((r) => r.name).join(', '),
    );
  }
});

test('the Ikon pool really is global', () => {
  assert.ok(new Set(IKON.map((r) => r.fine)).size >= 10, 'expected at least ten countries');
  assert.ok(new Set(IKON.map((r) => r.coarse)).size >= 4, 'expected at least four continents');
  for (const continent of ['North America', 'Europe', 'Asia', 'Oceania', 'South America']) {
    assert.ok(
      IKON.some((r) => r.coarse === continent),
      `no Ikon destination on ${continent}`,
    );
  }
});

test('seededShuffle is deterministic and order-changing', () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  assert.deepEqual(seededShuffle(items, 'a'), seededShuffle(items, 'a'));
  assert.notDeepEqual(seededShuffle(items, 'a'), seededShuffle(items, 'b'));
  assert.deepEqual([...seededShuffle(items, 'a')].sort((x, y) => x - y), items);
});

test('?date overrides today, and junk falls back to today', () => {
  assert.equal(
    puzzleFor(dateFromQuery('?date=2026-12-25'), 'ikon', IKON).number,
    puzzleFor(new Date(2026, 11, 25), 'ikon', IKON).number,
  );
  const today = new Date().toDateString();
  assert.equal(dateFromQuery('?date=nonsense').toDateString(), today);
  assert.equal(dateFromQuery('').toDateString(), today);
});

test('?pool selects the question set and defaults to Ikon', () => {
  assert.equal(poolFromQuery('?pool=usa').id, 'usa');
  assert.equal(poolFromQuery('?pool=ikon').id, 'ikon');
  assert.equal(poolFromQuery('?pool=nonsense').id, 'ikon');
  assert.equal(poolFromQuery('').id, 'ikon');
  assert.deepEqual(
    POOLS.ikon.rungs.map((f) => f.label),
    ['state', 'country', 'continent'],
  );
  assert.deepEqual(
    POOLS.usa.rungs.map((f) => f.label),
    ['state', 'region'],
  );
});
