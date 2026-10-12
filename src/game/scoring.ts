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
 * A tap anywhere on the mountain scores 100. Each resort carries its own
 * reach — the span of its lift network plus the base village, measured from
 * the pin — and this is the floor for it, so even a one-lift hill gets a
 * three-mile bullseye. Park City's reach covers the whole ridge: the wrong
 * peak is still Park City.
 */
export const BULLSEYE_MILES = 3;
export const BULLSEYE_KM = BULLSEYE_MILES * KM_PER_MILE;

/** How far "on the mountain" extends from a resort's pin, in km. */
export const reachKm = (resort: Pick<Resort, 'reachKm'>) =>
  Math.max(BULLSEYE_KM, resort.reachKm ?? 0);

/**
 * A round's base score (0-100) is additive: points for each geographic rung
 * the guess gets right — continent, country, state, which stack — plus up to
 * PROXIMITY_POINTS for how close it landed. Nothing short of the wrong
 * continent on the far side of the planet scores zero.
 *
 * Closeness is measured from the edge of the mountain, not its pin, and is
 * gentle at first: the first five miles past the edge cost five points, the
 * next five cost three. Beyond that it falls on a log scale, because that is
 * how distance feels — 30 miles off versus 300 is one step, 300 versus 3,000
 * another — running out at PROXIMITY_FAR_KM.
 *
 *   Ikon pool, with the rungs in pools.ts:
 *     on the mountain                              = 100
 *     5 miles past the edge          20+20+35 + 20 =  95
 *     10 miles                       20+20+35 + 17 =  92
 *     right state, 100 miles off     20+20+35 + 12 =  87
 *     right country, 300 miles off      20+35 +  9 =  64
 *     right continent, 1500 miles off      35 +  5 =  40
 *     wrong continent, 5000 miles off       0 +  2 =   2
 */
export const PROXIMITY_POINTS = 25;
export const NEAR_MILES = 5;
export const NEAR_POINTS = 20;
export const CLOSE_MILES = 10;
export const CLOSE_POINTS = 17;
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
  /** From the pin — what the card shows. */
  distanceKm: number;
  /** From the edge of the mountain — what closeness is scored on. 0 on the mountain. */
  beyondKm: number;
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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Closeness points alone, 0-PROXIMITY_POINTS, from how far past the edge of
 * the mountain the tap landed. Exported so the tests can hit it directly.
 */
export function proximityPoints(beyondKm: number): number {
  const near = NEAR_MILES * KM_PER_MILE;
  const close = CLOSE_MILES * KM_PER_MILE;
  if (beyondKm <= 0) return PROXIMITY_POINTS;
  if (beyondKm <= near) return lerp(PROXIMITY_POINTS, NEAR_POINTS, beyondKm / near);
  if (beyondKm <= close) return lerp(NEAR_POINTS, CLOSE_POINTS, (beyondKm - near) / (close - near));
  const t = Math.log(beyondKm / close) / Math.log(PROXIMITY_FAR_KM / close);
  return CLOSE_POINTS * Math.min(1, Math.max(0, 1 - t));
}

export function scoreRound(
  resort: Resort,
  guess: LatLng,
  roundIndex: number,
  boundaries: BoundaryCollection,
  rungs: readonly Rung[],
): RoundResult {
  const distanceKm = haversineKm(guess, resort);
  const beyondKm = Math.max(0, distanceKm - reachKm(resort));
  const bullseye = beyondKm === 0;

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

  const proximity = proximityPoints(beyondKm);
  const geo = earned.reduce((a, e) => a + e.points, 0);
  const baseScore = bullseye ? 100 : Math.min(100, Math.round(geo + proximity));
  const multiplier = MULTIPLIERS[roundIndex] ?? 1;

  return {
    resort,
    guess,
    distanceKm,
    beyondKm,
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
  if (result.bullseye) return 'on the mountain';
  const parts = [...result.earned].reverse().map((e) => `+${e.points} ${e.label}`);
  parts.push(`+${result.proximity} closeness`);
  return parts.join(' · ');
}

export const totalScore = (rounds: readonly RoundResult[]) =>
  rounds.reduce((a, r) => a + r.score, 0);
