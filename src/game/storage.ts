import type { LatLng } from './geo.js';

// Bump when a change makes old saves meaningless — v2: the Oct 1 puzzle's
// mountains changed when the tier sizes did, so v1 saves would replay
// against the wrong five.
const KEY = 'laptap.v2';

export interface StoredGame {
  /** "<pool>:<puzzle number>" — each pool keeps its own daily result. */
  key: string;
  /** One entry per completed round, in order. Enough to rebuild the game. */
  guesses: LatLng[];
  total: number;
  /** Per-round base scores, kept for the history/streak display. */
  scores: number[];
  finished: boolean;
}

interface Store {
  current?: StoredGame;
  history: Record<string, { total: number; scores: number[] }>;
}

const EMPTY: Store = { history: {} };

// Private windows and blocked site data both make localStorage throw rather
// than return null, so every access is wrapped: the game must still be playable
// with no persistence at all.
function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<Store>;
    return { current: parsed.current, history: parsed.history ?? {} };
  } catch {
    return { ...EMPTY };
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* unavailable — play on without it */
  }
}

export function load(key: string): StoredGame | null {
  const { current } = read();
  return current?.key === key ? current : null;
}

export function save(game: StoredGame): void {
  const store = read();
  store.current = game;
  if (game.finished) {
    store.history[game.key] = { total: game.total, scores: game.scores };
  }
  write(store);
}

/**
 * Consecutive days played, up to and including this puzzle. A day counts if
 * any of the given pools was finished that day: the pass pools alternate by
 * day, so a daily player's Ikon streak would otherwise break every other
 * morning. Each game mode passes the pools that make up its daily habit.
 */
export function streak(pools: readonly string[], puzzleNumber: number): number {
  const { history } = read();
  const played = (p: number) => pools.some((pool) => history[`${pool}:${p}`]);
  let n = 0;
  for (let p = puzzleNumber; p > 0 && played(p); p--) n++;
  return n;
}

/** The finished total for a day's game in a pool, or null if it wasn't finished. */
export function finishedTotal(key: string): number | null {
  return read().history[key]?.total ?? null;
}

export const playedCount = () => Object.keys(read().history).length;
