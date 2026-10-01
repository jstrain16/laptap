import { kmToMiles } from '../game/geo.js';
import { REGION_LABELS } from '../game/regions.js';
import { MAX_SCORE, type RoundResult } from '../game/scoring.js';
import { bandFor } from '../game/share.js';
import { button, el, typewriter } from './dom.js';

const miles = (km: number) => `${Math.round(kmToMiles(km)).toLocaleString()} mi`;

/**
 * MapTap needles you after every guess. These stay generic — swap them for
 * in-jokes and the game instantly becomes a gift.
 */
const SNARK: [number, string[]][] = [
  [8, ['You have skied there.', 'Bullseye. Suspiciously good.', 'First chair energy.']],
  [40, ['Same parking lot, near enough.', 'Close. Same valley.', 'You could ski to it.']],
  [120, ['Right range, wrong mountain.', 'Next drainage over.', 'A long cat track away.']],
  [400, ['Wrong end of the state.', "That's a road trip.", 'Warm. Ish.']],
  [1200, ['Different mountain range entirely.', "That's a flight, not a drive.", 'Cold.']],
  [Infinity, ['Not even close.', 'You put it in the wrong half of the country.', 'No.']],
];

function snarkFor(distanceKm: number): string {
  const band = SNARK.find(([max]) => distanceKm < max)?.[1] ?? [''];
  return band[Math.floor(Math.random() * band.length)] ?? '';
}

/** "Round 3 of 5 — ×2" above the mountain being asked about. */
export function promptCard(
  round: number,
  total: number,
  multiplier: number,
  resortName: string,
): HTMLElement {
  const title = el('h2', { class: 'card-title' });
  const card = el(
    'section',
    { class: 'card panel' },
    el('div', {
      class: 'card-kicker',
      text: `ROUND ${round} OF ${total}${multiplier > 1 ? `  ·  ×${multiplier}` : ''}`,
    }),
    title,
    el('p', { class: 'card-sub', text: 'Tap the map where you think it is' }),
  );
  void typewriter(title, resortName, 22);
  return card;
}

/** The aiming state: a pin is down but nothing is locked in yet. */
export function confirmCard(resortName: string, onConfirm: () => void): HTMLElement {
  return el(
    'section',
    { class: 'card panel' },
    el('div', { class: 'card-kicker', text: 'YOUR GUESS' }),
    el('h2', { class: 'card-title', text: resortName }),
    el('p', { class: 'card-sub', text: 'Drag the map to adjust, or lock it in' }),
    el('div', { class: 'card-actions' }, button('LOCK IT IN', onConfirm)),
  );
}

export function resultCard(
  result: RoundResult,
  isLast: boolean,
  onNext: () => void,
): HTMLElement {
  const floorNote =
    result.floor === 'state'
      ? `+${result.floorLift} — right state (${result.resort.state})`
      : result.floor === 'region'
        ? `+${result.floorLift} — right region (${REGION_LABELS[result.resort.region]})`
        : null;

  const next = button(isLast ? 'SEE RESULTS' : 'NEXT MOUNTAIN', onNext);

  return el(
    'section',
    { class: 'card panel' },
    el('div', { class: 'card-kicker', text: `${bandFor(result.baseScore)}  ${result.resort.state.toUpperCase()}` }),
    el('h2', { class: 'card-title', text: result.resort.name }),
    el('p', { class: 'result-line', text: `${miles(result.distanceKm)} away` }),
    el(
      'p',
      { class: 'result-line' },
      el('span', { class: 'result-score', text: String(result.baseScore) }),
      result.multiplier > 1
        ? el('span', { class: 'result-mult', text: ` ×${result.multiplier} = ${result.score}` })
        : null,
    ),
    floorNote ? el('p', { class: 'result-line result-floor', text: floorNote }) : null,
    el('p', { class: 'result-snark', text: snarkFor(result.distanceKm) }),
    el('div', { class: 'card-actions' }, next),
  );
}

export function summaryCard(
  results: readonly RoundResult[],
  total: number,
  onShare: () => Promise<boolean>,
): HTMLElement {
  const rows = el(
    'div',
    { class: 'summary-rows' },
    ...results.map((r) =>
      el(
        'div',
        { class: 'summary-row' },
        el('span', { class: 'band', text: bandFor(r.baseScore) }),
        el('span', { class: 'name', text: r.resort.name }),
        el('span', { class: 'dist', text: miles(r.distanceKm) }),
        el('span', { class: 'pts', text: String(r.score) }),
      ),
    ),
  );

  const share = button('COPY RESULT', async () => {
    const original = share.textContent;
    share.disabled = true;
    share.textContent = (await onShare()) ? 'COPIED!' : 'COPY FAILED';
    window.setTimeout(() => {
      share.textContent = original;
      share.disabled = false;
    }, 1600);
  });

  return el(
    'section',
    { class: 'card panel' },
    el('div', { class: 'card-kicker', text: 'RUN COMPLETE' }),
    rows,
    el(
      'p',
      { class: 'summary-total', text: String(total) },
      el('span', { text: ` / ${MAX_SCORE}` }),
    ),
    el('div', { class: 'card-actions' }, share),
    el('p', { class: 'card-sub', text: 'A new set of five mountains at midnight.' }),
  );
}
