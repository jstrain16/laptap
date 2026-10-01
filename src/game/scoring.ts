import { boundaryAt, haversineKm, type BoundaryCollection, type LatLng } from './geo.js';
import type { Floor } from './pools.js';
import type { Resort } from './resorts.js';

/**
 * MapTap scores a guess with `exp(-(d / 16250) * 3.5)`, where 16,250km is half
 * the Earth's circumference. laptap keeps that shape but retunes it. This is
 * the one knob worth turning if the game plays too hard or too soft.
 *
 *     0km -> 100    50km -> 85    200km -> 51    600km -> 14
 *    25km ->  92   100km -> 72    400km -> 26   1000km ->  4
 */
export const DECAY_KM = 300;

/** Round 5 is worth three times round 1. Sums to 10, so a perfect game is 1000. */
export const MULTIPLIERS = [1, 1, 2, 3, 3] as const;
export const MAX_SCORE = MULTIPLIERS.reduce((a, b) => a + b, 0) * 100;

/**
 * No consolation floor can beat a genuinely close tap. The ladder values live
 * on each pool (see pools.ts); this caps all of them.
 */
export const FLOOR_CAP = 80;

export interface RoundResult {
  resort: Resort;
  guess: LatLng;
  distanceKm: number;
  /** 0-100, before the round multiplier. */
  baseScore: number;
  multiplier: number;
  /** baseScore * multiplier, rounded — what lands on the scoreboard. */
  score: number;
  /** Where the guess landed at each level, e.g. "Utah" / "United States" / "North America". */
  guessRegion: string | null;
  guessFine: string | null;
  guessCoarse: string | null;
  /** The rung that lifted the score, if any: its label and the place that matched. */
  floor: { label: string; name: string } | null;
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
  floors: readonly Floor[],
): RoundResult {
  const distanceKm = haversineKm(guess, resort);
  const raw = distanceScore(distanceKm);

  const hit = boundaryAt(guess, boundaries);
  const guessAt = {
    region: hit?.region ?? null,
    fine: hit?.name ?? null,
    coarse: hit?.group || null,
  };
  const resortAt = {
    region: resort.region ?? null,
    fine: resort.fine,
    coarse: resort.coarse,
  };

  // Walk the ladder finest-first; the first rung where both sides name the
  // same place is the one that applies.
  let matched: { label: string; name: string; value: number } | null = null;
  for (const rung of floors) {
    const want = resortAt[rung.key];
    if (want && want === guessAt[rung.key]) {
      matched = { label: rung.label, name: want, value: rung.value };
      break;
    }
  }

  // A floor only ever lifts a weak guess, and only up to FLOOR_CAP.
  const lifted = Math.max(raw, Math.min(matched?.value ?? 0, FLOOR_CAP));
  const floor = matched && lifted > raw ? { label: matched.label, name: matched.name } : null;

  const baseScore = Math.round(lifted);
  const multiplier = MULTIPLIERS[roundIndex] ?? 1;

  return {
    resort,
    guess,
    distanceKm,
    baseScore,
    multiplier,
    score: baseScore * multiplier,
    guessRegion: guessAt.region,
    guessFine: guessAt.fine,
    guessCoarse: guessAt.coarse,
    floor,
    floorLift: floor ? baseScore - Math.round(raw) : 0,
  };
}

/** "+35 — right country (Japan)" — the green line on the result card. */
export function floorNote(result: RoundResult): string | null {
  return result.floor
    ? `+${result.floorLift} — right ${result.floor.label} (${result.floor.name})`
    : null;
}

export const totalScore = (rounds: readonly RoundResult[]) =>
  rounds.reduce((a, r) => a + r.score, 0);
