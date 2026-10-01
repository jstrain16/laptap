import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import type { StateCollection } from './geo.ts';
import { ALL_RESORTS, puzzleFor } from './daily.ts';
import {
  DECAY_KM,
  FLOOR_CAP,
  MAX_SCORE,
  MULTIPLIERS,
  REGION_FLOOR,
  STATE_FLOOR,
  distanceScore,
  scoreRound,
  totalScore,
} from './scoring.ts';

const states = JSON.parse(
  readFileSync(new URL('../data/states.json', import.meta.url), 'utf8'),
) as StateCollection;

const byName = (n: string) => {
  const r = ALL_RESORTS.find((x) => x.name === n);
  assert.ok(r, `fixture resort "${n}" is missing from the pool`);
  return r;
};

const alta = byName('Alta Ski Area');
const killington = byName('Killington Resort');

test('a perfect tap scores 100', () => {
  assert.equal(distanceScore(0), 100);
});

test('score decreases monotonically with distance and tends to zero', () => {
  let prev = Infinity;
  for (const km of [0, 1, 10, 25, 50, 100, 200, 400, 800, 2000, 5000]) {
    const s = distanceScore(km);
    assert.ok(s < prev, `${km}km should score below ${prev}`);
    prev = s;
  }
  assert.ok(distanceScore(20000) < 0.001);
});

test('the decay curve matches the documented table', () => {
  const expected: [number, number][] = [
    [10, 92],
    [25, 81],
    [50, 66],
    [100, 43],
    [200, 19],
    [400, 4],
  ];
  for (const [km, want] of expected) {
    assert.equal(Math.round(distanceScore(km)), want, `${km}km`);
  }
  assert.equal(DECAY_KM, 120);
});

test('multipliers sum to 10 so a perfect game is exactly 1000', () => {
  assert.equal(MULTIPLIERS.reduce((a, b) => a + b, 0), 10);
  assert.equal(MAX_SCORE, 1000);
});

test('a bullseye on every round totals MAX_SCORE', () => {
  const rounds = puzzleFor(new Date(2026, 11, 25)).resorts.map((r, i) =>
    scoreRound(r, { lat: r.lat, lng: r.lng }, i, states),
  );
  assert.equal(totalScore(rounds), MAX_SCORE);
});

test('the right state floors a bad guess at STATE_FLOOR', () => {
  // St. George, far southern Utah — ~400km from Alta, but still Utah.
  const r = scoreRound(alta, { lat: 37.1, lng: -113.58 }, 0, states);
  assert.ok(r.distanceKm > 350, `expected a long miss, got ${r.distanceKm}km`);
  assert.equal(r.guessState, 'Utah');
  assert.equal(r.floor, 'state');
  assert.equal(r.baseScore, STATE_FLOOR);
  assert.ok(r.floorLift > 0);
});

test('the right region floors a bad guess at REGION_FLOOR', () => {
  // Rural Wyoming: wrong state, but still the Rockies.
  const r = scoreRound(alta, { lat: 42.85, lng: -106.3 }, 0, states);
  assert.equal(r.guessState, 'Wyoming');
  assert.equal(r.guessRegion, 'rockies');
  assert.equal(r.floor, 'region');
  assert.equal(r.baseScore, REGION_FLOOR);
});

test('a guess in the wrong region gets no floor at all', () => {
  // Central Kansas: wrong state, wrong region, nothing to rescue it.
  const r = scoreRound(alta, { lat: 38.5, lng: -98.4 }, 0, states);
  assert.equal(r.floor, null);
  assert.equal(r.floorLift, 0);
  assert.equal(r.baseScore, 0);
});

test('a floor never beats a genuinely close tap', () => {
  // 10km from Killington, still in Vermont: the raw score must win.
  const r = scoreRound(killington, { lat: killington.lat + 0.09, lng: killington.lng }, 0, states);
  assert.ok(r.distanceKm < 15);
  assert.equal(r.floor, null, 'a close tap should not be reported as a floor');
  assert.ok(r.baseScore > STATE_FLOOR);
  assert.ok(r.baseScore <= 100);
});

test('floors are capped below a perfect score', () => {
  assert.ok(STATE_FLOOR <= FLOOR_CAP && FLOOR_CAP < 100);
});

test('round multipliers are applied in order', () => {
  for (const [i, mult] of MULTIPLIERS.entries()) {
    const r = scoreRound(alta, { lat: alta.lat, lng: alta.lng }, i, states);
    assert.equal(r.multiplier, mult);
    assert.equal(r.score, 100 * mult);
  }
});
