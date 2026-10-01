import {
  boundaryNear,
  haversineKm,
  KM_PER_MILE,
  type BoundaryCollection,
  type LatLng,
} from './geo.js';
import type { Rung } from './pools.js';
import type { Resort } from './resorts.js';

/**
 * Anything within this of the mountain is a bullseye and scores 100. Ski
 * areas are not points — a tap on the far end of Snowmass is not a miss.
 */
export const BULLSEYE_MILES = 3;
export const BULLSEYE_KM = BULLSEYE_MILES * KM_PER_MILE;

/**
 * A round's base score (0-100) is additive: points for each geographic rung
 * the guess gets right — continent, country, state, which stack — plus up to
 * PROXIMITY_POINTS for how close it landed. Nothing short of the wrong
 * continent on the far side of the planet scores zero.
 *
 * Closeness is scored on a log scale, because that is how distance feels:
 * 30 miles off versus 300 is one step, 300 versus 3,000 another. It runs from
 * the bullseye edge (all 25) to PROXIMITY_FAR_KM (none).
 *
 *   Ikon pool, with the rungs in pools.ts:
 *     right state, 20mi off     20+20+35 + 19  =  94
 *     right country, 300mi off     20+35 + 11  =  66
 *     right continent, 1000mi off     35 +  8  =  43
 *     wrong continent, 5000mi off       0 +  3  =   3
 */
export const PROXIMITY_POINTS = 25;
export const PROXIMITY_FAR_KM = 20_000;

/** Round 5 is worth three times round 1. Sums to 10, so a perfect game is 1000. */
export const MULTIPLIERS = [1, 1, 2, 3, 3] as const;
export const MAX_SCORE = MULTIPLIERS.reduce((a, b) => a + b, 0) * 100;

export interface Earned {
  label: string;
  /** The place that matched, e.g. "Utah" — or null if earned by proximity alone. */
  name: string | null;
  points: number;
}

export interface RoundResult {
  resort: Resort;
  guess: LatLng;
  distanceKm: number;
  bullseye: boolean;
  /** 0-100, before the round multiplier. */
  baseScore: number;
  multiplier: number;
  /** baseScore * multiplier — what lands on the scoreboard. */
  score: number;
  /** Where the guess landed at each level, after snapping a sea tap to land. */
  guessRegion: string | null;
  guessFine: string | null;
  guessCoarse: string | null;
  /** The geographic rungs the guess got right, finest first. */
  earned: Earned[];
  /** Points for closeness, 0-PROXIMITY_POINTS. */
  proximity: number;
}

/** Closeness points alone, 0-PROXIMITY_POINTS. Exported so the tests can hit it directly. */
export function proximityPoints(distanceKm: number): number {
  if (distanceKm <= BULLSEYE_KM) return PROXIMITY_POINTS;
  const t = Math.log(distanceKm / BULLSEYE_KM) / Math.log(PROXIMITY_FAR_KM / BULLSEYE_KM);
  return PROXIMITY_POINTS * Math.min(1, Math.max(0, 1 - t));
}

export function scoreRound(
  resort: Resort,
  guess: LatLng,
  roundIndex: number,
  boundaries: BoundaryCollection,
  rungs: readonly Rung[],
): RoundResult {
  const distanceKm = haversineKm(guess, resort);
  const bullseye = distanceKm <= BULLSEYE_KM;

  const hit = boundaryNear(guess, boundaries);
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

  const earned: Earned[] = [];
  for (const rung of rungs) {
    const want = resortAt[rung.key];
    const byPlace = !!want && want === guessAt[rung.key];
    // A rung the pool can't resolve by polygon (no state data for this
    // country) is still earnable by closeness, so every destination can
    // reach the same maximum.
    if (byPlace || distanceKm <= rung.nearKm) {
      earned.push({ label: rung.label, name: byPlace ? want : null, points: rung.points });
    }
  }

  const proximity = proximityPoints(distanceKm);
  const geo = earned.reduce((a, e) => a + e.points, 0);
  const baseScore = bullseye ? 100 : Math.min(100, Math.round(geo + proximity));
  const multiplier = MULTIPLIERS[roundIndex] ?? 1;

  return {
    resort,
    guess,
    distanceKm,
    bullseye,
    baseScore,
    multiplier,
    score: baseScore * multiplier,
    guessRegion: guessAt.region,
    guessFine: guessAt.fine,
    guessCoarse: guessAt.coarse,
    earned,
    proximity: Math.round(proximity),
  };
}

/**
 * "+35 continent · +20 country · +11 closeness" — how the base score was
 * built, for the result card. Reads coarse to fine so it tells the story in
 * the order a player narrows a guess.
 */
export function breakdown(result: RoundResult): string {
  if (result.bullseye) return 'bullseye';
  const parts = [...result.earned].reverse().map((e) => `+${e.points} ${e.label}`);
  parts.push(`+${result.proximity} closeness`);
  return parts.join(' · ');
}

export const totalScore = (rounds: readonly RoundResult[]) =>
  rounds.reduce((a, r) => a + r.score, 0);
