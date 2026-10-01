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

const headers = () => ({
  apikey: KEY!,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
});

/**
 * Resolves once the row is sent (or immediately if tracking is off), so the
 * summary can wait for a finish to land before asking for the leaderboard.
 * Never rejects.
 */
export async function track(row: PlayEvent): Promise<void> {
  if (!URL || !KEY) return;
  try {
    await fetch(`${URL}/rest/v1/plays`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'return=minimal' },
      body: JSON.stringify(row),
      // Survives the tab closing right after the summary appears.
      keepalive: true,
    });
  } catch {
    /* never let analytics touch the game */
  }
}

// --- nicknames and the leaderboard ------------------------------------------

const NAME_KEY = 'laptap.name';
export const NAME_MIN = 2;
export const NAME_MAX = 20;

/** The nickname this browser has claimed, if any. */
export function savedName(): string | null {
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

/**
 * Pure: what a nickname may look like. Mirrors the database CHECK so a bad
 * name is caught before a round trip. Letters, digits, spaces and a little
 * punctuation; nothing that could pretend to be markup on the board.
 */
export function validName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < NAME_MIN || name.length > NAME_MAX) return null;
  if (!/^[\p{L}\p{N} _.'-]+$/u.test(name)) return null;
  return name;
}

export type ClaimResult = 'ok' | 'taken' | 'invalid' | 'offline';

/** Claims a nickname for this browser's id. First come, first served. */
export async function claimName(raw: string): Promise<ClaimResult> {
  const name = validName(raw);
  if (!name) return 'invalid';
  if (!URL || !KEY) return 'offline';
  try {
    const res = await fetch(`${URL}/rest/v1/players`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'return=minimal' },
      body: JSON.stringify({ id: playerId(), name }),
    });
    if (res.ok) {
      localStorage.setItem(NAME_KEY, name);
      return 'ok';
    }
    // 409: the unique index on lower(name) — someone else has it (or this
    // browser already has a different one, which the same index also stops).
    return res.status === 409 ? 'taken' : 'offline';
  } catch {
    return 'offline';
  }
}

export interface LeaderboardRow {
  player_id: string;
  name: string;
  total: number;
}

/** Today's board for one pool, best score first. Empty if tracking is off. */
export async function fetchLeaderboard(pool: Pool, date: Date): Promise<LeaderboardRow[]> {
  if (!URL || !KEY) return [];
  try {
    const q = new URLSearchParams({
      select: 'player_id,name,total',
      pool: `eq.${pool.id}`,
      puzzle_date: `eq.${isoDate(date)}`,
      order: 'total.desc,name.asc',
      limit: '100',
    });
    const res = await fetch(`${URL}/rest/v1/leaderboard?${q}`, { headers: headers() });
    if (!res.ok) return [];
    return (await res.json()) as LeaderboardRow[];
  } catch {
    return [];
  }
}

export interface AllTimeRow {
  player_id: string;
  name: string;
  games: number;
  avg_score: number;
  best: number;
  points: number;
}

/**
 * Everyone who has ever named themselves, best average first. Ties go to
 * whoever has played more, so a single lucky game doesn't outrank a regular.
 */
export async function fetchAllTime(): Promise<AllTimeRow[]> {
  if (!URL || !KEY) return [];
  try {
    const q = new URLSearchParams({
      select: 'player_id,name,games,avg_score,best,points',
      order: 'avg_score.desc,games.desc,name.asc',
      limit: '100',
    });
    const res = await fetch(`${URL}/rest/v1/leaderboard_alltime?${q}`, { headers: headers() });
    if (!res.ok) return [];
    return (await res.json()) as AllTimeRow[];
  } catch {
    return [];
  }
}

/** Pure: 1-based rank of a player on a board sorted best-first, or null. */
export function rankOf(rows: readonly { player_id: string }[], player: string): number | null {
  const i = rows.findIndex((r) => r.player_id === player);
  return i === -1 ? null : i + 1;
}
