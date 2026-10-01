import { boundaryAt, haversineKm, type BoundaryCollection, type LatLng } from './geo.js';
import type { Pool } from './pools.js';
import type { Resort } from './resorts.js';

/**
 * MapTap scores a guess with `exp(-(d / 16250) * 3.5)`, where 16,250km is half
 * the Earth's circumference. laptap keeps that shape but retunes it: ski
 * resorts cluster, so on the original curve a 100km miss would still score 92.
 * This is the one knob worth turning if the game plays too hard or too soft.
 *
 *     0km -> 100    25km -> 81    100km -> 43    400km -> 4
 *    10km ->  92    50km -> 66    200km -> 19    800km -> 0
 */
export const DECAY_KM = 120;

/** Round 5 is worth three times round 1. Sums to 10, so a perfect game is 1000. */
export const MULTIPLIERS = [1, 1, 2, 3, 3] as const;
export const MAX_SCORE = MULTIPLIERS.reduce((a, b) => a + b, 0) * 100;

/**
 * Consolation floors, laptap's parody of MapTap's country/continent floors.
 * What counts as "close enough" depends on the pool: the global set floors on
 * country and continent, the US set on state and ski region.
 */
export const FINE_FLOOR = 25;
export const COARSE_FLOOR = 10;
export const FLOOR_CAP = 80;

export type FloorKind = 'fine' | 'coarse' | null;

export interface RoundResult {
  resort: Resort;
  guess: LatLng;
  distanceKm: number;
  /** 0-100, before the round multiplier. */
  baseScore: number;
  multiplier: number;
  /** baseScore * multiplier, rounded — what lands on the scoreboard. */
  score: number;
  /** Where the guess landed, e.g. "Austria" / "Europe" — null if out at sea. */
  guessFine: string | null;
  guessCoarse: string | null;
  /** Which floor lifted the score, if any. */
  floor: FloorKind;
  /** How many points the floor added, for the result card's bonus line. */
  floorLift: number;
}

/** Raw distance curve, 0-100. Exported so the tests can hit it directly. */
export function distanceScore(distanceKm: number): number {
  return 100 * Math.exp(-distanceKm / DECAY_KM);
}

export function scoreRound(
  resort: Resort,
  guess: LatLng,
  roundIndex: number,
  boundaries: BoundaryCollection,
): RoundResult {
  const distanceKm = haversineKm(guess, resort);
  const raw = distanceScore(distanceKm);

  const hit = boundaryAt(guess, boundaries);
  const guessFine = hit?.name ?? null;
  const guessCoarse = hit?.group || null;

  let floor: FloorKind = null;
  let floorValue = 0;
  if (guessFine && guessFine === resort.fine) {
    floor = 'fine';
    floorValue = FINE_FLOOR;
  } else if (guessCoarse && guessCoarse === resort.coarse) {
    floor = 'coarse';
    floorValue = COARSE_FLOOR;
  }

  // A floor only ever lifts a weak guess, and only up to FLOOR_CAP.
  const lifted = Math.max(raw, Math.min(floorValue, FLOOR_CAP));
  if (lifted <= raw) floor = null;

  const baseScore = Math.round(lifted);
  const multiplier = MULTIPLIERS[roundIndex] ?? 1;

  return {
    resort,
    guess,
    distanceKm,
    baseScore,
    multiplier,
    score: baseScore * multiplier,
    guessFine,
    guessCoarse,
    floor,
    floorLift: floor ? baseScore - Math.round(raw) : 0,
  };
}

/** "right country (Japan)" — the green line on the result card. */
export function floorNote(result: RoundResult, pool: Pool): string | null {
  if (result.floor === 'fine') {
    return `+${result.floorLift} — right ${pool.fineLabel} (${result.resort.fine})`;
  }
  if (result.floor === 'coarse') {
    return `+${result.floorLift} — right ${pool.coarseLabel} (${result.resort.coarse})`;
  }
  return null;
}

export const totalScore = (rounds: readonly RoundResult[]) =>
  rounds.reduce((a, r) => a + r.score, 0);
