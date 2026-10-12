import assert from 'node:assert/strict';
import { test } from 'node:test';

import { puzzleFor } from './daily.ts';
import { COUNTRIES, EPIC, IKON, STATES, USA, byName } from './fixtures.test-util.ts';
import { POOLS } from './pools.ts';
import { KM_PER_MILE } from './geo.ts';
import {
  BULLSEYE_KM,
  BULLSEYE_MILES,
  CLOSE_MILES,
  CLOSE_POINTS,
  MAX_SCORE,
  MULTIPLIERS,
  NEAR_MILES,
  NEAR_POINTS,
  PROXIMITY_FAR_KM,
  PROXIMITY_POINTS,
  breakdown,
  proximityPoints,
  reachKm,
  scoreRound,
  totalScore,
} from './scoring.ts';

const alta = byName(USA, 'Alta Ski Area');
const niseko = byName(IKON, 'Niseko United');
const snowbird = byName(IKON, 'Snowbird');
const palisades = byName(IKON, 'Palisades Tahoe');
const parkCity = byName(EPIC, 'Park City');

/** A point `km` due east of a resort's pin. */
const east = (r: { lat: number; lng: number }, km: number) => ({
  lat: r.lat,
  lng: r.lng + km / (111.32 * Math.cos((r.lat * Math.PI) / 180)),
});

const ikonRung = (label: string) => POOLS.ikon.rungs.find((r) => r.label === label)!.points;
const ikonGeoMax = POOLS.ikon.rungs.reduce((a, r) => a + r.points, 0);
const earnedLabels = (r: ReturnType<typeof scoreRound>) => r.earned.map((e) => e.label);

// --- closeness ---------------------------------------------------------------

test('anywhere on the mountain scores a full 100', () => {
  // Park City's lift network runs the whole ridge to the Canyons side; tapping
  // the wrong peak is still Park City.
  assert.ok(reachKm(parkCity) > 9, `Park City reach ${reachKm(parkCity)}km`);
  for (const km of [0, reachKm(parkCity) * 0.5, reachKm(parkCity) - 0.05]) {
    const r = scoreRound(parkCity, east(parkCity, km), 0, COUNTRIES, POOLS.epic.rungs);
    assert.equal(r.baseScore, 100, `${km}km from the pin`);
    assert.ok(r.bullseye);
    assert.equal(r.beyondKm, 0);
    assert.equal(breakdown(r), 'on the mountain');
  }
  // And a tap a kilometre past the edge is no longer one — though it barely costs.
  const r = scoreRound(parkCity, east(parkCity, reachKm(parkCity) + 1), 0, COUNTRIES, POOLS.epic.rungs);
  assert.ok(!r.bullseye);
  assert.ok(r.beyondKm > 0.9 && r.beyondKm < 1.1, `beyond ${r.beyondKm}km`);
  assert.equal(r.baseScore, 99);
});

test('every resort gets at least the three-mile bullseye, and a reach that fits one mountain', () => {
  assert.equal(BULLSEYE_MILES, 3);
  for (const r of [...IKON, ...EPIC, ...USA]) {
    assert.ok(reachKm(r) >= BULLSEYE_KM, `${r.name} reach ${reachKm(r)}`);
    assert.ok(reachKm(r) <= 14, `${r.name} reach ${reachKm(r)}km is not one mountain`);
  }
  // A one-lift hill still gets the floor.
  const smallest = USA.reduce((a, b) => (a.reachKm < b.reachKm ? a : b));
  assert.ok(smallest.reachKm < BULLSEYE_KM);
  const r = scoreRound(smallest, east(smallest, BULLSEYE_KM - 0.05), 0, STATES, POOLS.usa.rungs);
  assert.equal(r.baseScore, 100);
});

test('the first ten miles past the edge are gentle, then closeness falls on a log scale', () => {
  const near = NEAR_MILES * KM_PER_MILE;
  const close = CLOSE_MILES * KM_PER_MILE;
  assert.equal(proximityPoints(0), PROXIMITY_POINTS);
  assert.equal(proximityPoints(near), NEAR_POINTS);
  assert.equal(proximityPoints(close), CLOSE_POINTS);
  // With every rung earned: 95 at five miles, 92 at ten.
  const geo = ikonGeoMax;
  assert.equal(geo + NEAR_POINTS, 95);
  assert.equal(geo + CLOSE_POINTS, 92);
  let prev = Infinity;
  for (const km of [0, 1, near, 10, close, 50, 100, 500, 1000, 5000, 10000]) {
    const p = proximityPoints(km);
    assert.ok(p <= prev, `${km}km should not score above ${prev}`);
    assert.ok(p > 0, `${km}km should still be worth something`);
    prev = p;
  }
  assert.equal(proximityPoints(PROXIMITY_FAR_KM), 0);
  // One order of magnitude of distance costs about the same at every scale.
  const step = (a: number, b: number) => proximityPoints(a) - proximityPoints(b);
  assert.ok(Math.abs(step(30, 300) - step(300, 3000)) < 0.5);
});

test('scoring reads the gentle curve from the edge of the mountain, not the pin', () => {
  const edge = reachKm(snowbird);
  const at = (miles: number) =>
    scoreRound(snowbird, east(snowbird, edge + miles * KM_PER_MILE), 0, COUNTRIES, POOLS.ikon.rungs);
  assert.equal(at(5).baseScore, 95);
  assert.equal(at(10).baseScore, 92);
  assert.ok(at(30).baseScore >= 88, `30 miles out: ${at(30).baseScore}`);
  assert.ok(at(100).baseScore >= 85, `100 miles out: ${at(100).baseScore}`);
});

test('multipliers sum to 10 so a perfect game is exactly 1000', () => {
  assert.equal(MULTIPLIERS.reduce((a, b) => a + b, 0), 10);
  assert.equal(MAX_SCORE, 1000);
});

test('a bullseye on every round totals MAX_SCORE', () => {
  const rounds = puzzleFor(new Date(2026, 11, 25), 'ikon', IKON).resorts.map((r, i) =>
    scoreRound(r, { lat: r.lat, lng: r.lng }, i, COUNTRIES, POOLS.ikon.rungs),
  );
  assert.equal(totalScore(rounds), MAX_SCORE);
});

test('the geographic rungs cannot reach 100 without closeness', () => {
  assert.ok(ikonGeoMax < 100 && ikonGeoMax + PROXIMITY_POINTS <= 100);
  const usaGeo = POOLS.usa.rungs.reduce((a, r) => a + r.points, 0);
  assert.ok(usaGeo < 100 && usaGeo + PROXIMITY_POINTS <= 100);
});

// --- the rungs stack --------------------------------------------------------

test('right state earns state, country and continent together', () => {
  // St. George, far southern Utah — ~400km from Snowbird, but still Utah.
  const r = scoreRound(snowbird, { lat: 37.1, lng: -113.58 }, 0, COUNTRIES, POOLS.ikon.rungs);
  assert.ok(r.distanceKm > 350);
  assert.deepEqual(earnedLabels(r), ['state', 'country', 'continent']);
  assert.equal(r.earned[0]?.name, 'Utah');
  assert.equal(r.baseScore, ikonGeoMax + r.proximity);
  assert.match(breakdown(r), /^\+35 continent · \+20 country · \+20 state · \+\d+ closeness$/);
});

test('right country, wrong state, earns country and continent', () => {
  // Kansas: wrong state for Snowbird, still the United States.
  const r = scoreRound(snowbird, { lat: 38.5, lng: -98.4 }, 0, COUNTRIES, POOLS.ikon.rungs);
  assert.equal(r.guessRegion, 'Kansas');
  assert.deepEqual(earnedLabels(r), ['country', 'continent']);
  assert.equal(r.baseScore, ikonRung('country') + ikonRung('continent') + r.proximity);
});

test('right continent alone earns the continent rung plus closeness', () => {
  // Central Mongolia: wrong country for Niseko, still Asia.
  const r = scoreRound(niseko, { lat: 46.9, lng: 103.8 }, 0, COUNTRIES, POOLS.ikon.rungs);
  assert.equal(r.guessFine, 'Mongolia');
  assert.deepEqual(earnedLabels(r), ['continent']);
  assert.equal(r.baseScore, ikonRung('continent') + r.proximity);
  assert.ok(r.baseScore >= 38, `continent-only should be worth 40ish, got ${r.baseScore}`);
});

test('wrong continent earns only closeness, and that is nearly nothing', () => {
  const r = scoreRound(niseko, { lat: -25.3, lng: 133.8 }, 0, COUNTRIES, POOLS.ikon.rungs);
  assert.equal(r.guessCoarse, 'Oceania');
  assert.deepEqual(earnedLabels(r), []);
  assert.ok(r.baseScore > 0 && r.baseScore < 10, `got ${r.baseScore}`);
});

test('a tap just across a border still earns the rung by closeness', () => {
  // Palisades Tahoe is in California; this is 25km east, in Nevada.
  const r = scoreRound(palisades, { lat: palisades.lat, lng: palisades.lng + 0.29 }, 0, COUNTRIES, POOLS.ikon.rungs);
  assert.equal(r.guessRegion, 'Nevada');
  assert.ok(r.distanceKm > 15 && r.distanceKm < 40, `got ${r.distanceKm}km`);
  assert.deepEqual(earnedLabels(r), ['state', 'country', 'continent']);
  assert.equal(r.earned[0]?.name, null, 'state earned by closeness, not by place');
  assert.ok(r.baseScore >= 90, `a 25km miss should still be in the 90s, got ${r.baseScore}`);
});

test('a tap in the sea snaps to the nearest land', () => {
  // The Ligurian Sea, 60km off the Italian coast — nowhere near Cervinia,
  // but unmistakably Europe. Polygon containment alone scored this zero.
  const cervinia = byName(IKON, 'Cervinia');
  const r = scoreRound(cervinia, { lat: 43.6, lng: 8.5 }, 0, COUNTRIES, POOLS.ikon.rungs);
  assert.equal(r.guessCoarse, 'Europe');
  assert.ok(earnedLabels(r).includes('continent'));
});

test('a tap in the open ocean earns nothing geographic and does not crash', () => {
  const r = scoreRound(niseko, { lat: 0, lng: -150 }, 0, COUNTRIES, POOLS.ikon.rungs);
  assert.equal(r.guessFine, null);
  assert.deepEqual(earnedLabels(r), []);
  assert.ok(r.baseScore >= 0);
});

test('a player who only ever finds the continent lands in the 400s', () => {
  // The forgiveness target: "super low" should still be a few hundred, not 50.
  // One interior point per continent, so every guess is on the right landmass.
  // Kansas is also the right country for every US resort, hence the ceiling.
  const INTERIOR: Record<string, { lat: number; lng: number }> = {
    'North America': { lat: 38.5, lng: -98.4 },
    Europe: { lat: 51.0, lng: 10.0 },
    Asia: { lat: 46.9, lng: 103.8 },
    Oceania: { lat: -25.3, lng: 133.8 },
    'South America': { lat: -10.0, lng: -55.0 },
  };
  const rounds = puzzleFor(new Date(2026, 9, 5), 'ikon', IKON).resorts.map((r, i) => {
    const far = INTERIOR[r.coarse];
    assert.ok(far, `no interior anchor for ${r.coarse}`);
    return scoreRound(r, far, i, COUNTRIES, POOLS.ikon.rungs);
  });
  for (const r of rounds) {
    assert.ok(earnedLabels(r).includes('continent'), `${r.resort.name}: anchor is off-continent`);
    assert.ok(r.baseScore >= ikonRung('continent'), `${r.resort.name} scored ${r.baseScore}`);
  }
  const total = totalScore(rounds);
  assert.ok(total >= 400 && total <= 700, `expected 400-700, got ${total}`);
});

// --- US pool ----------------------------------------------------------------

test('US pool: right state earns state and region', () => {
  const r = scoreRound(alta, { lat: 37.1, lng: -113.58 }, 0, STATES, POOLS.usa.rungs);
  assert.equal(r.guessFine, 'Utah');
  assert.deepEqual(earnedLabels(r), ['state', 'region']);
});

test('US pool: right ski region alone', () => {
  // Rural Wyoming: wrong state, but still the Rockies.
  const r = scoreRound(alta, { lat: 42.85, lng: -106.3 }, 0, STATES, POOLS.usa.rungs);
  assert.equal(r.guessFine, 'Wyoming');
  assert.deepEqual(earnedLabels(r), ['region']);
});

test('round multipliers are applied in order', () => {
  for (const [i, mult] of MULTIPLIERS.entries()) {
    const r = scoreRound(alta, { lat: alta.lat, lng: alta.lng }, i, STATES, POOLS.usa.rungs);
    assert.equal(r.multiplier, mult);
    assert.equal(r.score, 100 * mult);
  }
});
