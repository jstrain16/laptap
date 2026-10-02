import { MULTIPLIERS } from '../game/scoring.js';
import type { LatLng } from '../game/geo.js';
import { nearestOnRun } from './geo.js';
import type { Run } from './types.js';

/**
 * A tap within this of the run is on it. Forty metres is about the width of a
 * groomed trail plus a thumb's worth of imprecision on a phone.
 */
export const BULLSEYE_M = 40;

/**
 * Beyond the bullseye the score decays by 1/e every this many metres:
 *
 *   on it -> 100   100m -> 84   250m -> 55   500m -> 27   1km -> 6
 *
 * A resort is small, so the curve is far steeper than the mountain game's —
 * the next lift pod over should hurt, the far side of the hill should be ~0.
 */
export const DECAY_M = 350;

export function runScore(meters: number): number {
  if (meters <= BULLSEYE_M) return 100;
  return Math.round(100 * Math.exp(-(meters - BULLSEYE_M) / DECAY_M));
}

export interface RunResult {
  run: Run;
  guess: LatLng;
  meters: number;
  /** Closest point on the run to the guess. */
  nearest: LatLng;
  baseScore: number;
  multiplier: number;
  score: number;
}

export function scoreRun(run: Run, guess: LatLng, roundIndex: number): RunResult {
  const { meters, point } = nearestOnRun(guess, run);
  const baseScore = runScore(meters);
  const multiplier = MULTIPLIERS[roundIndex] ?? 1;
  return { run, guess, meters, nearest: point, baseScore, multiplier, score: baseScore * multiplier };
}

/** "On it." / "240 ft off" / "0.6 mi off" — resort-scale distances read best in feet. */
export function missLabel(meters: number): string {
  if (meters <= BULLSEYE_M) return 'On it.';
  const feet = meters * 3.28084;
  if (feet < 1000) return `${Math.round(feet / 10) * 10} ft off`;
  return `${(feet / 5280).toFixed(1)} mi off`;
}
