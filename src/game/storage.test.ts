import assert from 'node:assert/strict';
import { test } from 'node:test';

// storage.ts reads window.localStorage; give it an in-memory one.
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { finishedTotal, save, streak } = await import('./storage.ts');

const finish = (key: string, total: number) =>
  save({ key, guesses: [], scores: [], total, finished: true });

test('a streak counts days played in any mountain pool, since the passes alternate', () => {
  store.clear();
  // Ikon on odd days, Epic on even — the default schedule — plus one USA day.
  finish('ikon:15', 700);
  finish('epic:16', 650);
  finish('ikon:17', 720);
  finish('usa:18', 500);
  finish('epic:18', 610);
  const pools = ['ikon', 'epic', 'usa'];
  assert.equal(streak(pools, 18), 4);
  assert.equal(streak(['ikon'], 17), 1, 'one pool alone sees every other day');
  // A gap breaks it.
  finish('ikon:21', 800);
  assert.equal(streak(pools, 21), 1);
  // Tomorrow, unplayed, has no streak yet; the day before still does.
  assert.equal(streak(pools, 22), 0);
});

test('a finished total is readable by its key, and an unfinished game is not', () => {
  store.clear();
  finish('epic:30', 812);
  save({ key: 'ikon:31', guesses: [{ lat: 0, lng: 0 }], scores: [50], total: 50, finished: false });
  assert.equal(finishedTotal('epic:30'), 812);
  assert.equal(finishedTotal('ikon:31'), null);
  assert.equal(finishedTotal('epic:29'), null);
});
