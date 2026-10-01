import { seededShuffle } from './rng.js';
import { TIER_COUNT, type Resort } from './resorts.js';
import resortData from '../data/resorts.json' with { type: 'json' };

export const ALL_RESORTS = resortData as Resort[];

/** Puzzle #1 was this day. Moving it renumbers every puzzle, so don't. */
const EPOCH = Date.UTC(2026, 9, 1); // 2026-10-01
const DAY_MS = 86_400_000;

/**
 * Days are local-midnight to local-midnight: the puzzle should roll over at
 * the player's midnight, not UTC's. Comparing UTC-normalised midnights keeps
 * the arithmetic free of DST gaps.
 */
function dayNumber(date: Date): number {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((local - EPOCH) / DAY_MS);
}

export interface Puzzle {
  number: number;
  /** Local calendar date the puzzle belongs to. */
  date: Date;
  resorts: Resort[];
}

const TIERS: Resort[][] = Array.from({ length: TIER_COUNT }, (_, i) =>
  // Shuffled once per tier with a fixed seed, so walking the list by puzzle
  // number gives a stable, non-repeating order for every player.
  seededShuffle(
    ALL_RESORTS.filter((r) => r.tier === i + 1),
    `laptap-tier-${i + 1}`,
  ),
);

/**
 * The five mountains for a given day, easiest first. Round N comes from tier N,
 * indexed by puzzle number — so a resort cannot come up again until its whole
 * tier has been used (49 days for the smallest tier).
 */
export function puzzleFor(date: Date): Puzzle {
  const number = dayNumber(date);
  const resorts = TIERS.map((tier, i) => {
    // Offsetting each tier by its index stops all five rounds from advancing in
    // lockstep, which would make consecutive days feel like the same puzzle.
    const idx = (((number + i * 7) % tier.length) + tier.length) % tier.length;
    return tier[idx]!;
  });
  return { number: number + 1, date, resorts };
}

/** `?date=YYYY-MM-DD` overrides today, so a day's puzzle can be checked early. */
export function dateFromQuery(search: string): Date {
  const raw = new URLSearchParams(search).get('date');
  const m = raw?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date();
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export const formatPuzzleDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export const shortPuzzleDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
