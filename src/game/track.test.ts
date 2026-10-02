import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COUNTRIES, IKON } from './fixtures.test-util.ts';
import { POOLS } from './pools.ts';
import { scoreRound, totalScore } from './scoring.ts';
import { buildEvent, rankOf, toRounds, validName } from './track.ts';

const ids = { player: 'p-1', device: 'desktop' as const, tz: 'America/Denver' };
const date = new Date(2026, 9, 7);

test('a start event carries identity and puzzle but no score', () => {
  const e = buildEvent('start', POOLS.ikon, 7, date, undefined, undefined, ids);
  assert.deepEqual(e, {
    player_id: 'p-1',
    event: 'start',
    pool: 'ikon',
    puzzle: 7,
    puzzle_date: '2026-10-07',
    total: null,
    rounds: null,
    device: 'desktop',
    tz: 'America/Denver',
  });
});

test('a finish event carries the total and every guess, rounded for storage', () => {
  const results = IKON.slice(0, 5).map((r, i) =>
    scoreRound(r, { lat: r.lat + 0.123456, lng: r.lng }, i, COUNTRIES, POOLS.ikon.rungs),
  );
  const e = buildEvent('finish', POOLS.ikon, 7, date, toRounds(results), totalScore(results), ids);
  assert.equal(e.event, 'finish');
  assert.equal(e.total, totalScore(results));
  assert.equal(e.rounds?.length, 5);
  const r0 = e.rounds![0]!;
  assert.equal(r0.name, IKON[0]!.name);
  assert.equal(r0.base, results[0]!.baseScore);
  assert.equal(r0.km, Math.round(results[0]!.distanceKm));
  assert.equal(String(r0.guess[0]).split('.')[1]!.length <= 3, true, 'lat rounded to 3dp');
});

test('the date is the local calendar day, not UTC', () => {
  // 23:30 local on the 7th must still be the 7th.
  const e = buildEvent('start', POOLS.epic, 8, new Date(2026, 9, 7, 23, 30), undefined, undefined, ids);
  assert.equal(e.puzzle_date, '2026-10-07');
  assert.equal(e.pool, 'epic');
});

test('nicknames are trimmed, length-bounded and free of markup', () => {
  assert.equal(validName('  Joe  '), 'Joe');
  assert.equal(validName('joe   strain'), 'joe strain');
  assert.equal(validName("O'Brien-Smith_2"), "O'Brien-Smith_2");
  assert.equal(validName('Zoë'), 'Zoë');
  assert.equal(validName('J'), null, 'too short');
  assert.equal(validName('a'.repeat(21)), null, 'too long');
  assert.equal(validName('<b>joe</b>'), null, 'markup');
  assert.equal(validName('joe@example.com'), null, 'no emails on a public board');
  assert.equal(validName('   '), null);
});

test('rank is 1-based position on a best-first board, or null', () => {
  const rows = [
    { player_id: 'a', name: 'A', total: 900 },
    { player_id: 'b', name: 'B', total: 700 },
    { player_id: 'c', name: 'C', total: 700 },
  ];
  assert.equal(rankOf(rows, 'a'), 1);
  assert.equal(rankOf(rows, 'c'), 3);
  assert.equal(rankOf(rows, 'zz'), null);
  assert.equal(rankOf([], 'a'), null);
});
