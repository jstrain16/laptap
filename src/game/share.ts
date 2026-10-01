import { shortPuzzleDate } from './daily.js';
import type { RoundResult } from './scoring.js';

/** Wordle-shaped bands, so a result block reads at a glance. */
const BANDS: [number, string][] = [
  [90, '🟩'],
  [70, '🟨'],
  [45, '🟧'],
  [20, '🟥'],
];

export const bandFor = (baseScore: number) =>
  BANDS.find(([min]) => baseScore >= min)?.[1] ?? '⬛';

export function shareText(date: Date, results: readonly RoundResult[], total: number): string {
  const blocks = results.map((r) => `${r.baseScore}${bandFor(r.baseScore)}`).join(' ');
  return `laptap ${shortPuzzleDate(date)}\n${blocks}\nFinal score: ${total}`;
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
