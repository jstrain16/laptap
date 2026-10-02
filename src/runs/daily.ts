import { puzzleNumberFor } from '../game/daily.js';
import { seededShuffle } from '../game/rng.js';
import type { MountainEntry, Run, RunsFile } from './types.js';

export const ROUNDS = 5;

/** Runs shorter than this are lift-line connectors — unfair to ask about. */
const MIN_RUN_M = 200;

/**
 * The mountain everyone plays on a given day. A fixed shuffle of the eligible
 * mountains indexed by puzzle number, so no mountain repeats until all of
 * them have had a day.
 */
export function mountainFor(date: Date, index: readonly MountainEntry[]): MountainEntry {
  const order = seededShuffle(index, 'laptap-runs-mountains');
  const n = puzzleNumberFor(date) - 1;
  return order[((n % order.length) + order.length) % order.length]!;
}

/** How many times this mountain has already had its day, counting from zero. */
export function visitFor(date: Date, indexLength: number): number {
  return Math.floor((puzzleNumberFor(date) - 1) / Math.max(1, indexLength));
}

/**
 * The day's five runs, most findable first. Nothing in the data says how
 * famous a run is, so length stands in: the long top-to-bottom arteries
 * everyone has skied come first, the short connectors nobody can place last.
 *
 * Runs are sorted longest to shortest and cut into five tiers. Each tier is a
 * fixed shuffle walked one step per visit to the mountain, so a run cannot
 * come up again until every run in its tier has — which matters when the game
 * is live on only a couple of mountains and each returns every few days.
 */
export function runsFor(mountain: RunsFile, visit: number): Run[] {
  const long = mountain.runs.filter((r) => r.len >= MIN_RUN_M);
  // A tiny hill may not have fifteen runs of any length; use what there is.
  const pool = (long.length >= ROUNDS * 3 ? long : mountain.runs)
    .slice()
    .sort((a, b) => b.len - a.len || a.n.localeCompare(b.n));
  const per = pool.length / ROUNDS;
  return Array.from({ length: ROUNDS }, (_, i) => {
    const tier = seededShuffle(
      pool.slice(Math.floor(i * per), Math.max(Math.floor(i * per) + 1, Math.floor((i + 1) * per))),
      `laptap-runs-${mountain.id}-tier-${i}`,
    );
    return tier[(((visit + i * 3) % tier.length) + tier.length) % tier.length]!;
  });
}
