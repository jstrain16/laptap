import { el } from './dom.js';

/** Milliseconds from `now` to the next local midnight, when the puzzle changes. */
export function untilMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** "6h 40m", "12m", or "under a minute". */
export function formatWait(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 1) return 'under a minute';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/**
 * The summary's last line: an optional lead ("4-day streak.") and a live
 * countdown to the next puzzle. Keeps ticking while the card is on screen and
 * stops itself once the card is gone, so a day-old tab doesn't tick forever.
 */
export function countdownLine(lead: string, noun: string): HTMLElement {
  const node = el('p', { class: 'card-sub' });
  let timer = 0;
  const tick = () => {
    const left = untilMidnight(new Date());
    node.textContent =
      left <= 0
        ? `${lead}${noun} ready — refresh.`
        : `${lead}${noun} in ${formatWait(left)}.`;
    // The first tick runs before the card is in the DOM; only a later one
    // finding it gone means the card was replaced.
    if (timer && !node.isConnected) window.clearInterval(timer);
  };
  tick();
  timer = window.setInterval(tick, 30_000);
  return node;
}
