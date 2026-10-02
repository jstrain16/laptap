import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ROUNDS, mountainFor, runsFor, visitFor } from './daily.ts';
import { nearestOnRun } from './geo.ts';
import { BULLSEYE_M, missLabel, runScore, scoreRun } from './scoring.ts';
import type { MountainEntry, Run, RunsFile } from './types.ts';

const read = <T>(rel: string): T =>
  JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8')) as T;

const INDEX = read<MountainEntry[]>('../data/runs-index.json');
const file = (name: string) =>
  read<RunsFile>(`../../public/runs/${INDEX.find((m) => m.name === name)!.id}.json`);
const alta = file('Alta');
const mountSnow = file('Mount Snow');

// A synthetic east–west run 1km long at 45°N, so distances are easy to reason about.
const flat: Run = { n: 'Test', d: 'easy', len: 1000, l: [[[-110.0, 45.0], [-109.9873, 45.0]]] };
const M_PER_DEG_LAT = 110_540;

test('the game is built for exactly the two test mountains', () => {
  assert.deepEqual(INDEX.map((m) => m.name).sort(), ['Alta', 'Mount Snow']);
  for (const m of [alta, mountSnow]) {
    assert.equal(m.runs.length, INDEX.find((e) => e.name === m.name)!.runs);
    assert.ok(m.runs.length >= 20);
    assert.equal(new Set(m.runs.map((r) => r.n)).size, m.runs.length, 'run names collide');
    const [w, s, e, n] = m.bounds;
    assert.ok(w < e && s < n, `${m.name} has inverted bounds`);
    assert.ok(e - w < 0.2 && n - s < 0.2, `${m.name} is implausibly large`);
    assert.ok(m.lifts.length > 0);
  }
});

test('both mountains have their real runs, with editor notes stripped', () => {
  const has = (m: RunsFile, ...names: string[]) => {
    const all = new Set(m.runs.map((r) => r.n));
    for (const n of names) assert.ok(all.has(n), `${m.name} is missing ${n}`);
  };
  has(alta, 'Big Dipper', "Devil's Elbow", 'Westward Ho', 'Crooked Mile', 'Summer Road');
  has(mountSnow, 'Long John', 'Canyon', 'South Bowl', 'Ridge');
  for (const m of [alta, mountSnow]) {
    assert.ok(!m.runs.some((r) => /uphill|acces/i.test(r.n)), `${m.name} has an editor note in a name`);
  }
});

test('distance to a run: on it, beside it, and past its end', () => {
  assert.ok(nearestOnRun({ lat: 45.0, lng: -109.995 }, flat).meters < 0.5);
  const north = nearestOnRun({ lat: 45.0 + 100 / M_PER_DEG_LAT, lng: -109.995 }, flat);
  assert.ok(Math.abs(north.meters - 100) < 1, `expected ~100m, got ${north.meters}`);
  // The nearest point is straight below the tap, on the line.
  assert.ok(Math.abs(north.point.lat - 45.0) < 1e-6 && Math.abs(north.point.lng + 109.995) < 1e-6);
  // Past the western end, the nearest point is the endpoint itself.
  const west = nearestOnRun({ lat: 45.0, lng: -110.002 }, flat);
  assert.ok(Math.abs(west.point.lng + 110.0) < 1e-9);
  assert.ok(west.meters > 150 && west.meters < 165, `got ${west.meters}`);
});

test('a run mapped as an area is hit anywhere inside it', () => {
  const bowl: Run = {
    n: 'Bowl', d: 'advanced', len: 400, area: true,
    l: [[[-110.0, 45.0], [-109.99, 45.0], [-109.99, 45.005], [-110.0, 45.005], [-110.0, 45.0]]],
  };
  assert.equal(nearestOnRun({ lat: 45.0025, lng: -109.995 }, bowl).meters, 0);
  assert.ok(nearestOnRun({ lat: 45.01, lng: -109.995 }, bowl).meters > 400);
});

test('the scoring curve: bullseye, then steep', () => {
  assert.equal(runScore(0), 100);
  assert.equal(runScore(BULLSEYE_M), 100);
  for (const [m, want] of [[100, 84], [250, 55], [500, 27], [1000, 6]] as const) {
    assert.equal(runScore(m), want, `${m}m`);
  }
  let prev = 101;
  for (const m of [41, 80, 200, 600, 1500, 4000]) {
    assert.ok(runScore(m) <= prev);
    prev = runScore(m);
  }
  assert.equal(runScore(5000), 0);
});

test('tapping each run itself is a perfect 1000', () => {
  for (const m of [alta, mountSnow]) {
    const total = runsFor(m, 0)
      .map((run, i) => scoreRun(run, { lng: run.l[0]![0]![0], lat: run.l[0]![0]![1] }, i))
      .reduce((a, r) => a + r.score, 0);
    assert.equal(total, 1000, m.name);
  }
});

test('miss labels read in feet, then miles', () => {
  assert.equal(missLabel(10), 'On it.');
  assert.equal(missLabel(100), '330 ft off');
  assert.equal(missLabel(1000), '0.6 mi off');
});

test('a visit picks five distinct runs, longest tier first, deterministically', () => {
  for (const m of [alta, mountSnow]) {
    const picks = runsFor(m, 0);
    assert.equal(picks.length, ROUNDS);
    assert.equal(new Set(picks.map((r) => r.n)).size, ROUNDS);
    for (let i = 1; i < picks.length; i++) {
      assert.ok(picks[i - 1]!.len >= picks[i]!.len, `${m.name}: rounds should run long to short`);
    }
    assert.ok(picks.every((r) => r.len >= 200), `${m.name}: no lift-line connectors`);
    assert.deepEqual(picks.map((r) => r.n), runsFor(m, 0).map((r) => r.n));
    assert.notDeepEqual(picks.map((r) => r.n), runsFor(m, 1).map((r) => r.n));
  }
});

test('no run repeats on a mountain for at least fifteen visits', () => {
  for (const m of [alta, mountSnow]) {
    const seen = new Set<string>();
    for (let visit = 0; visit < 15; visit++) {
      for (const run of runsFor(m, visit)) {
        assert.ok(!seen.has(run.n), `${m.name}: ${run.n} repeated on visit ${visit}`);
        seen.add(run.n);
      }
    }
  }
});

test('the two mountains alternate by day, and a visit advances every cycle', () => {
  const day = (d: number) => new Date(2026, 9, d);
  const a = mountainFor(day(1), INDEX);
  const b = mountainFor(day(2), INDEX);
  assert.notEqual(a.id, b.id);
  assert.equal(mountainFor(day(3), INDEX).id, a.id);
  assert.equal(mountainFor(new Date(2026, 9, 1, 6), INDEX).id, mountainFor(new Date(2026, 9, 1, 23), INDEX).id);
  assert.deepEqual([1, 2, 3, 4, 5].map((d) => visitFor(day(d), INDEX.length)), [0, 0, 1, 1, 2]);
});
