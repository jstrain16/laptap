import type { BoundaryCollection, LatLng } from './geo.js';
import type { Puzzle } from './daily.js';
import type { Floor } from './pools.js';
import type { Resort } from './resorts.js';
import { MULTIPLIERS, scoreRound, totalScore, type RoundResult } from './scoring.js';

/**
 * prompt    — the mountain is named, nothing tapped yet
 * aiming    — a pin is down, waiting on CONFIRM (so a stray tap can't burn a round)
 * revealing — the answer is on the map and the result card is up
 * summary   — all five rounds done
 */
export type Phase = 'prompt' | 'aiming' | 'revealing' | 'summary';

export interface GameState {
  phase: Phase;
  roundIndex: number;
  pending: LatLng | null;
  results: RoundResult[];
  total: number;
}

export interface Game {
  readonly state: GameState;
  readonly puzzle: Puzzle;
  /** The mountain being asked about, or null once the game is over. */
  currentResort(): Resort | null;
  currentMultiplier(): number;
  place(point: LatLng): void;
  confirm(): RoundResult | null;
  next(): void;
  /** Replays stored guesses to rebuild a game in progress after a reload. */
  restore(guesses: LatLng[]): void;
  subscribe(fn: (state: GameState) => void): void;
}

export function createGame(
  puzzle: Puzzle,
  boundaries: BoundaryCollection,
  floors: readonly Floor[],
): Game {
  const state: GameState = {
    phase: 'prompt',
    roundIndex: 0,
    pending: null,
    results: [],
    total: 0,
  };
  const listeners: ((s: GameState) => void)[] = [];
  const emit = () => listeners.forEach((fn) => fn(state));

  const currentResort = () => puzzle.resorts[state.roundIndex] ?? null;

  function commit(point: LatLng): RoundResult | null {
    const resort = currentResort();
    if (!resort) return null;
    const result = scoreRound(resort, point, state.roundIndex, boundaries, floors);
    state.results.push(result);
    state.total = totalScore(state.results);
    state.pending = null;
    state.phase = 'revealing';
    return result;
  }

  return {
    state,
    puzzle,
    currentResort,
    currentMultiplier: () => MULTIPLIERS[state.roundIndex] ?? 1,

    place(point) {
      if (state.phase !== 'prompt' && state.phase !== 'aiming') return;
      state.pending = point;
      state.phase = 'aiming';
      emit();
    },

    confirm() {
      if (state.phase !== 'aiming' || !state.pending) return null;
      const result = commit(state.pending);
      emit();
      return result;
    },

    next() {
      if (state.phase !== 'revealing') return;
      state.roundIndex += 1;
      state.phase = state.roundIndex >= puzzle.resorts.length ? 'summary' : 'prompt';
      emit();
    },

    restore(guesses) {
      for (const g of guesses.slice(0, puzzle.resorts.length)) {
        commit(g);
        state.roundIndex += 1;
      }
      // Land on the round the player was actually on. A finished game goes
      // straight to the summary; a partial one re-asks the next mountain
      // rather than replaying the last reveal.
      state.phase = state.roundIndex >= puzzle.resorts.length ? 'summary' : 'prompt';
      emit();
    },

    subscribe(fn) {
      listeners.push(fn);
    },
  };
}
