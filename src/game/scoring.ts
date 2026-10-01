import { haversineKm, stateAt, type LatLng, type StateCollection } from './geo.js';
import { regionForState, type Region } from './regions.js';
import type { Resort } from './resorts.js';

/**
 * MapTap scores a guess with `exp(-(d / 16250) * 3.5)`, where 16,250km is half
 * the Earth's circumference. laptap keeps that shape but retunes it: US resorts
 * sit 20-50km apart in Colorado and Vermont, so on the original curve a 100km
 * miss would still score 92. This is the one knob worth turning if the game
 * plays too hard or too soft.
 *
 *     0km -> 100    25km -> 81    100km -> 43    400km -> 4
 *    10km ->  92    50km -> 66    200km -> 19    800km -> 0
 */
export const DECAY_KM = 120;

/** Round 5 is worth three times round 1. Sums to 10, so a perfect game is 1000. */
export const MULTIPLIERS = [1, 1, 2, 3, 3] as const;
export const MAX_SCORE = MULTIPLIERS.reduce((a, b) => a + b, 0) * 100;

/**
 * Consolation floors, laptap's parody of MapTap's country/continent floors:
 * land in the right state and you cannot score below 25, right region and you
 * cannot score below 10. Capped so a floor never beats a genuinely close tap.
 */
export const STATE_FLOOR = 25;
export const REGION_FLOOR = 10;
export const FLOOR_CAP = 80;

export type FloorKind = 'state' | 'region' | null;

export interface RoundResult {
  resort: Resort;
  guess: LatLng;
  distanceKm: number;
  /** 0-100, before the round multiplier. */
  baseScore: number;
  multiplier: number;
  /** baseScore * multiplier, rounded — what actually lands on the scoreboard. */
  score: number;
  guessState: string | null;
  guessRegion: Region | null;
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
  states: StateCollection,
): RoundResult {
  const distanceKm = haversineKm(guess, resort);
  const raw = distanceScore(distanceKm);

  const guessState = stateAt(guess, states);
  const guessRegion = regionForState(guessState);

  let floor: FloorKind = null;
  let floorValue = 0;
  if (guessState && guessState === resort.state) {
    floor = 'state';
    floorValue = STATE_FLOOR;
  } else if (guessRegion && guessRegion === resort.region) {
    floor = 'region';
    floorValue = REGION_FLOOR;
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
    guessState,
    guessRegion,
    floor,
    floorLift: floor ? baseScore - Math.round(raw) : 0,
  };
}

export const totalScore = (rounds: readonly RoundResult[]) =>
  rounds.reduce((a, r) => a + r.score, 0);
