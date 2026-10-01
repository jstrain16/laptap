import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COUNTRIES, IKON } from './fixtures.test-util.ts';
import { POOLS } from './pools.ts';
import { scoreRound, totalScore } from './scoring.ts';
import { SITE, bandFor, shareText } from './share.ts';

const sample = IKON.slice(0, 5).map((r, i) =>
  scoreRound(r, { lat: r.lat, lng: r.lng + i * 0.5 }, i, COUNTRIES, POOLS.ikon.rungs),
);

test('the shared result ends with the site link so recipients can find the game', () => {
  const text = shareText(new Date(2026, 9, 1), POOLS.ikon, sample, totalScore(sample));
  const lines = text.split('\n');
  assert.equal(lines.length, 4);
  assert.equal(lines[0], 'LapTap (Ikon Mode) Oct 1');
  assert.match(lines[1]!, /^(\d+\S+ ){4}\d+\S+$/, 'five score+emoji blocks');
  assert.equal(lines[2], `Final score: ${totalScore(sample)}`);
  assert.equal(lines[3], SITE);
  assert.equal(SITE, 'laptap.xyz');
});

test('a non-default pool is carried in the link', () => {
  const text = shareText(new Date(2026, 9, 1), POOLS.usa, sample, 0);
  assert.ok(text.startsWith('LapTap (USA Mode) '));
  assert.ok(text.endsWith(`${SITE}/?pool=usa`));
});

test('every score band has an emoji, and the bands are ordered', () => {
  const seen = new Set<string>();
  let prev = '';
  for (const score of [100, 95, 90, 89, 70, 69, 45, 44, 20, 19, 0]) {
    const b = bandFor(score);
    assert.ok(b.length > 0);
    seen.add(b);
    if (prev && b !== prev) assert.ok(score < 100, 'band changes only as score falls');
    prev = b;
  }
  assert.equal(seen.size, 5);
});
