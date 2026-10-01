import { shortPuzzleDate } from './daily.js';
import { DEFAULT_POOL, type Pool } from './pools.js';
import type { RoundResult } from './scoring.js';

/**
 * The canonical address, written into every shared result so the people it
 * gets pasted to can find the game. Hard-coded rather than read from
 * location.href so a result shared from the github.io mirror still points
 * home.
 */
export const SITE_URL = 'https://laptap.xyz';

/**
 * One emoji per score band, so a result block reads at a glance — a ski day
 * going progressively worse. Wordle's coloured squares were the first draft;
 * the black one for a miss was invisible on the dark result card.
 */
const BANDS: [number, string][] = [
  [90, '🎯'], // bullseye
  [70, '⛷️'], // skied it
  [45, '🎿'], // had skis on, at least
  [20, '❄️'], // cold
];
const MISS = '💀';

export const bandFor = (baseScore: number) =>
  BANDS.find(([min]) => baseScore >= min)?.[1] ?? MISS;

export function shareText(
  date: Date,
  pool: Pool,
  results: readonly RoundResult[],
  total: number,
): string {
  const blocks = results.map((r) => `${r.baseScore}${bandFor(r.baseScore)}`).join(' ');
  // A non-default pool goes into the link, so friends land on the same set.
  const link = pool.id === DEFAULT_POOL ? SITE_URL : `${SITE_URL}/?pool=${pool.id}`;
  return `laptap ${pool.label} · ${shortPuzzleDate(date)}\n${blocks}\nFinal score: ${total}\n${link}`;
}

/**
 * navigator.clipboard needs a secure context and can be refused outright, so
 * fall back to a hidden textarea + execCommand before giving up.
 */
export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* fall through */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:-9999px;opacity:0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
