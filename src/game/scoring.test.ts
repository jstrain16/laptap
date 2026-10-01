import assert from 'node:assert/strict';
import { test } from 'node:test';

import { puzzleFor } from './daily.ts';
import { COUNTRIES, IKON, STATES, USA, byName } from './fixtures.test-util.ts';
import { POOLS } from './pools.ts';
import {
  COARSE_FLOOR,
  DECAY_KM,
  FINE_FLOOR,
  FLOOR_CAP,
  MAX_SCORE,
  MULTIPLIERS,
  distanceScore,
  floorNote,
  scoreRound,
  totalScore,
} from './scoring.ts';

const alta = byName(USA, 'Alta Ski Area');
const killington = byName(USA, 'Killington Resort');
const niseko = byName(IKON, 'Niseko United');

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
  for (const [km, want] of [
    [10, 92],
    [25, 81],
    [50, 66],
    [100, 43],
    [200, 19],
    [400, 4],
  ] as [number, number][]) {
    assert.equal(Math.round(distanceScore(km)), want, `${km}km`);
  }
  assert.equal(DECAY_KM, 120);
});

test('multipliers sum to 10 so a perfect game is exactly 1000', () => {
  assert.equal(MULTIPLIERS.reduce((a, b) => a + b, 0), 10);
  assert.equal(MAX_SCORE, 1000);
});

test('a bullseye on every round totals MAX_SCORE', () => {
  const rounds = puzzleFor(new Date(2026, 11, 25), 'ikon', IKON).resorts.map((r, i) =>
    scoreRound(r, { lat: r.lat, lng: r.lng }, i, COUNTRIES),
  );
  assert.equal(totalScore(rounds), MAX_SCORE);
});

// --- global pool: country / continent floors --------------------------------

test('the right country floors a bad guess at FINE_FLOOR', () => {
  // Okinawa — about 2,000km from Niseko, but unmistakably Japan.
  const r = scoreRound(niseko, { lat: 26.3, lng: 127.8 }, 0, COUNTRIES);
  assert.ok(r.distanceKm > 1500, `expected a long miss, got ${r.distanceKm}km`);
  assert.equal(r.guessFine, 'Japan');
  assert.equal(r.floor, 'fine');
  assert.equal(r.baseScore, FINE_FLOOR);
  assert.equal(floorNote(r, POOLS.ikon), `+${r.floorLift} — right country (Japan)`);
});

test('the right continent floors a bad guess at COARSE_FLOOR', () => {
  // Central Mongolia: wrong country, still Asia.
  const r = scoreRound(niseko, { lat: 46.9, lng: 103.8 }, 0, COUNTRIES);
  assert.equal(r.guessFine, 'Mongolia');
  assert.equal(r.guessCoarse, 'Asia');
  assert.equal(r.floor, 'coarse');
  assert.equal(r.baseScore, COARSE_FLOOR);
});

test('a guess on the wrong continent gets no floor at all', () => {
  // Central Australia.
  const r = scoreRound(niseko, { lat: -25.3, lng: 133.8 }, 0, COUNTRIES);
  assert.equal(r.guessCoarse, 'Oceania');
  assert.equal(r.floor, null);
  assert.equal(r.baseScore, 0);
});

test('a guess out at sea gets no floor and no crash', () => {
  const r = scoreRound(niseko, { lat: 0, lng: -150 }, 0, COUNTRIES);
  assert.equal(r.guessFine, null);
  assert.equal(r.guessCoarse, null);
  assert.equal(r.floor, null);
});

// --- US pool: state / region floors -----------------------------------------

test('the right state floors a bad guess at FINE_FLOOR', () => {
  // St. George, far southern Utah — ~400km from Alta, but still Utah.
  const r = scoreRound(alta, { lat: 37.1, lng: -113.58 }, 0, STATES);
  assert.ok(r.distanceKm > 350);
  assert.equal(r.guessFine, 'Utah');
  assert.equal(r.floor, 'fine');
  assert.equal(r.baseScore, FINE_FLOOR);
  assert.equal(floorNote(r, POOLS.usa), `+${r.floorLift} — right state (Utah)`);
});

test('the right ski region floors a bad guess at COARSE_FLOOR', () => {
  // Rural Wyoming: wrong state, but still the Rockies.
  const r = scoreRound(alta, { lat: 42.85, lng: -106.3 }, 0, STATES);
  assert.equal(r.guessFine, 'Wyoming');
  assert.equal(r.floor, 'coarse');
  assert.equal(r.baseScore, COARSE_FLOOR);
});

test('a floor never beats a genuinely close tap', () => {
  const r = scoreRound(killington, { lat: killington.lat + 0.09, lng: killington.lng }, 0, STATES);
  assert.ok(r.distanceKm < 15);
  assert.equal(r.floor, null, 'a close tap should not be reported as a floor');
  assert.ok(r.baseScore > FINE_FLOOR && r.baseScore <= 100);
});

test('floors are capped below a perfect score', () => {
  assert.ok(COARSE_FLOOR < FINE_FLOOR && FINE_FLOOR <= FLOOR_CAP && FLOOR_CAP < 100);
});

test('round multipliers are applied in order', () => {
  for (const [i, mult] of MULTIPLIERS.entries()) {
    const r = scoreRound(alta, { lat: alta.lat, lng: alta.lng }, i, STATES);
    assert.equal(r.multiplier, mult);
    assert.equal(r.score, 100 * mult);
  }
});
