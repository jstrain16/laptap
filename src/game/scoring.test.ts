import assert from 'node:assert/strict';
import { test } from 'node:test';

import { puzzleFor } from './daily.ts';
import { COUNTRIES, IKON, STATES, USA, byName } from './fixtures.test-util.ts';
import { POOLS } from './pools.ts';
import {
  DECAY_KM,
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
const snowbird = byName(IKON, 'Snowbird');

const ikonFloor = (label: string) => POOLS.ikon.floors.find((f) => f.label === label)!.value;
const usaFloor = (label: string) => POOLS.usa.floors.find((f) => f.label === label)!.value;

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
    [25, 92],
    [50, 85],
    [100, 72],
    [200, 51],
    [400, 26],
    [600, 14],
    [1000, 4],
  ] as [number, number][]) {
    assert.equal(Math.round(distanceScore(km)), want, `${km}km`);
  }
  assert.equal(DECAY_KM, 300);
});

test('multipliers sum to 10 so a perfect game is exactly 1000', () => {
  assert.equal(MULTIPLIERS.reduce((a, b) => a + b, 0), 10);
  assert.equal(MAX_SCORE, 1000);
});

test('a bullseye on every round totals MAX_SCORE', () => {
  const rounds = puzzleFor(new Date(2026, 11, 25), 'ikon', IKON).resorts.map((r, i) =>
    scoreRound(r, { lat: r.lat, lng: r.lng }, i, COUNTRIES, POOLS.ikon.floors),
  );
  assert.equal(totalScore(rounds), MAX_SCORE);
});

test('a player who only ever finds the continent lands in the 400s', () => {
  // The forgiveness target: "super low" should still be a few hundred, not 50.
  // One interior point per continent, so every guess is on the right landmass
  // and never in the right country by accident — except Kansas, which is the
  // right country for every US resort and so may lift a round to the country
  // rung. Hence the ceiling.
  const INTERIOR: Record<string, { lat: number; lng: number }> = {
    'North America': { lat: 38.5, lng: -98.4 }, // Kansas
    Europe: { lat: 51.0, lng: 10.0 }, // central Germany
    Asia: { lat: 46.9, lng: 103.8 }, // Mongolia
    Oceania: { lat: -25.3, lng: 133.8 }, // central Australia
    'South America': { lat: -10.0, lng: -55.0 }, // Mato Grosso
  };
  const rounds = puzzleFor(new Date(2026, 9, 5), 'ikon', IKON).resorts.map((r, i) => {
    const far = INTERIOR[r.coarse];
    assert.ok(far, `no interior anchor for ${r.coarse}`);
    return scoreRound(r, far, i, COUNTRIES, POOLS.ikon.floors);
  });
  for (const r of rounds) {
    assert.equal(r.guessCoarse, r.resort.coarse, `${r.resort.name}: anchor is off-continent`);
    assert.ok(r.baseScore >= ikonFloor('continent'), `${r.resort.name} scored ${r.baseScore}`);
  }
  const total = totalScore(rounds);
  assert.ok(total >= 400 && total <= 650, `expected 400-650, got ${total}`);
});

// --- global pool: state / country / continent ladder ------------------------

test('the right state floors a bad guess at the state rung', () => {
  // St. George, far southern Utah — ~400km from Snowbird, but still Utah.
  const r = scoreRound(snowbird, { lat: 37.1, lng: -113.58 }, 0, COUNTRIES, POOLS.ikon.floors);
  assert.ok(r.distanceKm > 350, `expected a long miss, got ${r.distanceKm}km`);
  assert.equal(r.guessRegion, 'Utah');
  assert.equal(r.guessFine, 'United States');
  assert.equal(r.floor?.label, 'state');
  assert.equal(r.baseScore, ikonFloor('state'));
  assert.equal(floorNote(r), `+${r.floorLift} — right state (Utah)`);
});

test('the right country floors a bad guess at the country rung', () => {
  // Okinawa — about 2,000km from Niseko, but unmistakably Japan.
  const r = scoreRound(niseko, { lat: 26.3, lng: 127.8 }, 0, COUNTRIES, POOLS.ikon.floors);
  assert.ok(r.distanceKm > 1500);
  assert.equal(r.guessFine, 'Japan');
  assert.equal(r.floor?.label, 'country');
  assert.equal(r.baseScore, ikonFloor('country'));
  assert.equal(floorNote(r), `+${r.floorLift} — right country (Japan)`);
});

test('a US guess in the wrong state still gets the country rung', () => {
  // Kansas: wrong state for Snowbird, still the United States.
  const r = scoreRound(snowbird, { lat: 38.5, lng: -98.4 }, 0, COUNTRIES, POOLS.ikon.floors);
  assert.equal(r.guessRegion, 'Kansas');
  assert.equal(r.floor?.label, 'country');
  assert.equal(r.baseScore, ikonFloor('country'));
});

test('the right continent floors a bad guess at the continent rung', () => {
  // Central Mongolia: wrong country, still Asia.
  const r = scoreRound(niseko, { lat: 46.9, lng: 103.8 }, 0, COUNTRIES, POOLS.ikon.floors);
  assert.equal(r.guessFine, 'Mongolia');
  assert.equal(r.guessCoarse, 'Asia');
  assert.equal(r.floor?.label, 'continent');
  assert.equal(r.baseScore, ikonFloor('continent'));
});

test('a guess on the wrong continent gets no floor at all', () => {
  const r = scoreRound(niseko, { lat: -25.3, lng: 133.8 }, 0, COUNTRIES, POOLS.ikon.floors);
  assert.equal(r.guessCoarse, 'Oceania');
  assert.equal(r.floor, null);
  assert.ok(r.baseScore < 5);
});

test('a guess out at sea gets no floor and no crash', () => {
  const r = scoreRound(niseko, { lat: 0, lng: -150 }, 0, COUNTRIES, POOLS.ikon.floors);
  assert.equal(r.guessRegion, null);
  assert.equal(r.guessFine, null);
  assert.equal(r.guessCoarse, null);
  assert.equal(r.floor, null);
});

test('the ladder is ordered finest to coarsest with descending values', () => {
  for (const pool of Object.values(POOLS)) {
    const values = pool.floors.map((f) => f.value);
    assert.deepEqual(values, [...values].sort((a, b) => b - a), pool.id);
    assert.ok(values.every((v) => v > 0 && v <= FLOOR_CAP && FLOOR_CAP < 100), pool.id);
  }
});

// --- US pool: state / ski region --------------------------------------------

test('US pool: the right state floors a bad guess', () => {
  const r = scoreRound(alta, { lat: 37.1, lng: -113.58 }, 0, STATES, POOLS.usa.floors);
  assert.equal(r.guessFine, 'Utah');
  assert.equal(r.floor?.label, 'state');
  assert.equal(r.baseScore, usaFloor('state'));
  assert.equal(floorNote(r), `+${r.floorLift} — right state (Utah)`);
});

test('US pool: the right ski region floors a bad guess', () => {
  // Rural Wyoming: wrong state, but still the Rockies.
  const r = scoreRound(alta, { lat: 42.85, lng: -106.3 }, 0, STATES, POOLS.usa.floors);
  assert.equal(r.guessFine, 'Wyoming');
  assert.equal(r.floor?.label, 'region');
  assert.equal(r.baseScore, usaFloor('region'));
});

test('a floor never beats a genuinely close tap', () => {
  // 10km from Killington, still in Vermont: the raw score must win.
  const r = scoreRound(
    killington,
    { lat: killington.lat + 0.09, lng: killington.lng },
    0,
    STATES,
    POOLS.usa.floors,
  );
  assert.ok(r.distanceKm < 15);
  assert.equal(r.floor, null, 'a close tap should not be reported as a floor');
  assert.ok(r.baseScore > usaFloor('state') && r.baseScore <= 100);
});

test('round multipliers are applied in order', () => {
  for (const [i, mult] of MULTIPLIERS.entries()) {
    const r = scoreRound(alta, { lat: alta.lat, lng: alta.lng }, i, STATES, POOLS.usa.floors);
    assert.equal(r.multiplier, mult);
    assert.equal(r.score, 100 * mult);
  }
});
