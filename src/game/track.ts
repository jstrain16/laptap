import type { Pool } from './pools.js';
import type { RoundResult } from './scoring.js';

/**
 * Anonymous play tracking, so the stats page can answer "how many people are
 * playing and how are they doing". One append-only row per event in a
 * Supabase table whose row-level security lets this key insert and nothing
 * else — nobody can read results back out through the site.
 *
 * Everything here is fire-and-forget and swallows every error: analytics must
 * never be able to break the game, and with no configuration it is a no-op.
 */
// Vite fills import.meta.env at build time; under Node's test runner it is
// simply absent, so read it defensively rather than crash the module.
const env = ((import.meta as { env?: Record<string, string | undefined> }).env ?? {});
const URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;

export const enabled = () => !!URL && !!KEY;

const PLAYER_KEY = 'laptap.player';

/** A random id per browser — the only identity there is. No accounts, no PII. */
export function playerId(): string {
  try {
    let id = localStorage.getItem(PLAYER_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(PLAYER_KEY, id);
    }
    return id;
  } catch {
    return '00000000-0000-0000-0000-000000000000';
  }
}

export interface PlayEvent {
  player_id: string;
  event: 'start' | 'finish';
  pool: string;
  puzzle: number;
  /** Local calendar date, YYYY-MM-DD. */
  puzzle_date: string;
  total: number | null;
  rounds: { name: string; base: number; km: number; guess: [number, number] }[] | null;
  device: 'mobile' | 'desktop';
  /** The player's time zone — a coarse, consent-free proxy for where they are. */
  tz: string;
}

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function device(): PlayEvent['device'] {
  try {
    return window.matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop';
  } catch {
    return 'desktop';
  }
}

function tz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
}

/** Pure: builds the row for one event. Exported so the shape is testable. */
export function buildEvent(
  event: PlayEvent['event'],
  pool: Pool,
  puzzle: number,
  date: Date,
  results?: readonly RoundResult[],
  total?: number,
  ids: { player: string; device: PlayEvent['device']; tz: string } = {
    player: playerId(),
    device: device(),
    tz: tz(),
  },
): PlayEvent {
  return {
    player_id: ids.player,
    event,
    pool: pool.id,
    puzzle,
    puzzle_date: isoDate(date),
    total: event === 'finish' ? (total ?? 0) : null,
    rounds:
      event === 'finish' && results
        ? results.map((r) => ({
            name: r.resort.name,
            base: r.baseScore,
            km: Math.round(r.distanceKm),
            guess: [Number(r.guess.lat.toFixed(3)), Number(r.guess.lng.toFixed(3))],
          }))
        : null,
    device: ids.device,
    tz: ids.tz,
  };
}

export function track(row: PlayEvent): void {
  if (!URL || !KEY) return;
  try {
    void fetch(`${URL}/rest/v1/plays`, {
      method: 'POST',
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
      // Survives the tab closing right after the summary appears.
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never let analytics touch the game */
  }
}
