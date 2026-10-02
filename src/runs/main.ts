import indexData from '../data/runs-index.json' with { type: 'json' };
import { dateFromQuery, formatPuzzleDate, puzzleNumberFor, shortPuzzleDate } from '../game/daily.js';
import type { LatLng } from '../game/geo.js';
import { SITE, bandFor, copy } from '../game/share.js';
import { load, save, streak } from '../game/storage.js';
import { confirmCard, promptCard, summaryCard } from '../ui/cards.js';
import { button, el } from '../ui/dom.js';
import { paintFor } from './colors.js';
import { ROUNDS, mountainFor, runsFor, visitFor } from './daily.js';
import { createRunsMap } from './map.js';
import { missLabel, scoreRun, type RunResult } from './scoring.js';
import type { MountainEntry, RunsFile } from './types.js';

const POOL = { id: 'runs' };

// Deliberately no tracking and no leaderboard here. This mode is a test on two
// mountains, and the all-time board averages across every pool — a tester's
// throwaway runs scores would drag down their real standing. Wire in
// buildEvent/track and the summary's leaderboard hooks when it graduates.
const INDEX = indexData as MountainEntry[];

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const pad3 = (n: number) => String(Math.min(n, 999)).padStart(3, '0');

const SNARK: [number, string[]][] = [
  [40, ['You have skied it.', 'Dead on.', 'Local knowledge.']],
  [150, ['One trail over.', 'Same lift, wrong line.', 'Close enough to hear it.']],
  [400, ['Right pod, wrong run.', 'A traverse away.', 'Next lift over.']],
  [1000, ['Other side of the ridge.', 'That is a long cat track.', 'Wrong face.']],
  [Infinity, ['Wrong end of the resort.', 'Did you take the bus?', 'Not even the right base area.']],
];
const snark = (m: number) => {
  const lines = SNARK.find(([max]) => m <= max)?.[1] ?? [''];
  return lines[Math.floor(Math.random() * lines.length)] ?? '';
};

function resultCard(r: RunResult, place: string, isLast: boolean, onNext: () => void): HTMLElement {
  return el(
    'section',
    { class: 'card panel' },
    el('div', { class: 'card-kicker', text: `${bandFor(r.baseScore)}  ${place.toUpperCase()}` }),
    el('h2', { class: 'card-title', text: r.run.n }),
    el('p', { class: 'result-line', text: missLabel(r.meters) }),
    el(
      'p',
      { class: 'result-line' },
      el('span', { class: 'result-score', text: String(r.baseScore) }),
      r.multiplier > 1
        ? el(
            'span',
            { class: 'result-mult' },
            el('span', { class: 'mult', text: `×${r.multiplier}` }),
            el('span', { text: ` = ${r.score}` }),
          )
        : null,
    ),
    el('p', { class: 'result-snark', text: snark(r.meters) }),
    el('div', { class: 'card-actions' }, button(isLast ? 'SEE RESULTS' : 'NEXT RUN', onNext)),
  );
}

/**
 * The runs mode: one mountain a day, five of its runs to find on a trail map
 * drawn from open data. Shares the cards and the save format with the mountain
 * game; the map and the scoring are its own.
 */
export async function startRuns(): Promise<void> {
  const stage = $('stage');
  const render = (node: HTMLElement) => stage.replaceChildren(node);
  const scoreValue = $('score-value');

  const params = new URLSearchParams(window.location.search);
  const date = dateFromQuery(window.location.search);
  const number = puzzleNumberFor(date);

  // `?mountain=alta` (or an id) picks a specific hill; otherwise it's the day's.
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const wanted = slug(params.get('mountain') ?? '');
  const entry =
    INDEX.find((m) => wanted && (m.id === wanted || slug(m.name) === wanted)) ??
    mountainFor(date, INDEX);
  const res = await fetch(new URL(`runs/${entry.id}.json`, document.baseURI));
  if (!res.ok) throw new Error(`trail map for ${entry.name} returned ${res.status}`);
  const mountain = (await res.json()) as RunsFile;
  // A hand-picked mountain walks its runs by day; the day's own mountain by
  // how many times it has come round.
  const targets = runsFor(
    mountain,
    params.get('mountain') ? number - 1 : visitFor(date, INDEX.length),
  );

  const map = await createRunsMap($('map'), mountain);

  $('title').innerHTML =
    `laptap #${number} <span class="dim">· Runs · ${mountain.name} · ${formatPuzzleDate(date)}</span>`;
  document.title = `laptap #${number} · ${mountain.name}`;

  const basemapToggle = $<HTMLButtonElement>('basemap-toggle');
  basemapToggle.textContent = 'TRAIL MAP';
  basemapToggle.addEventListener('click', () => {
    basemapToggle.textContent = map.toggleBasemap() === 'trailmap' ? 'TRAIL MAP' : 'SATELLITE';
  });
  // The map faces the mountain rather than north, so say where north went.
  const north = el('div', { class: 'north', title: 'North' }, el('span', { text: 'N' }));
  north.style.transform = `rotate(${-mountain.bearing}deg)`;
  document.body.append(north);

  const fit = $<HTMLButtonElement>('fit-wide');
  fit.textContent = 'FIT';
  fit.addEventListener('click', () => map.fitMountain());

  // --- state ----------------------------------------------------------------

  const results: RunResult[] = [];
  let pending: LatLng | null = null;
  const total = () => results.reduce((a, r) => a + r.score, 0);
  // The day's mountain shares one save slot; a hand-picked one gets its own.
  const saveKey = `runs:${number}${params.get('mountain') ? `:${entry.id}` : ''}`;

  const persist = (finished: boolean) =>
    save({
      key: saveKey,
      guesses: results.map((r) => r.guess),
      scores: results.map((r) => r.baseScore),
      total: total(),
      finished,
    });

  // --- the loop -------------------------------------------------------------

  function showPrompt(): void {
    const run = targets[results.length];
    if (!run) return;
    pending = null;
    map.clear();
    map.setLocked(false);
    map.fitMountain();
    const colour = paintFor(mountain.convention, run.d).label;
    const mult = ([1, 1, 2, 3, 3] as const)[results.length] ?? 1;
    render(
      promptCard(
        results.length + 1,
        ROUNDS,
        mult,
        run.n,
        `Tap this ${colour} run on the ${mountain.name} trail map`,
      ),
    );
  }

  function lockIn(): void {
    const run = targets[results.length];
    if (!run || !pending) return;
    const r = scoreRun(run, pending, results.length);
    results.push(r);
    map.setLocked(true);
    map.reveal(run, r.guess, r.nearest);
    scoreValue.textContent = pad3(total());
    const last = results.length === ROUNDS;
    persist(false);
    render(resultCard(r, mountain.name, last, () => (last ? showSummary() : showPrompt())));
  }

  function showSummary(): void {
    map.clear();
    map.setLocked(true);
    map.fitMountain();
    persist(true);
    scoreValue.textContent = pad3(total());

    const link = `${SITE}/?mode=runs`;
    const text = [
      `LapTap (Runs · ${mountain.name}) ${shortPuzzleDate(date)}`,
      results.map((r) => `${r.baseScore}${bandFor(r.baseScore)}`).join(' '),
      `Final score: ${total()}`,
      link,
    ].join('\n');

    const played = streak(POOL.id, number);
    const card = summaryCard(
      results.map((r) => ({
        band: bandFor(r.baseScore),
        name: r.run.n,
        dist: missLabel(r.meters).replace(' off', '').replace('On it.', '✓'),
        pts: String(r.score),
      })),
      total(),
      () => copy(text),
      null,
      played > 1
        ? `${played}-day streak. A new mountain at midnight.`
        : 'A new mountain at midnight.',
    );
    render(card);
  }

  map.onPick((point) => {
    const run = targets[results.length];
    if (!run) return;
    pending = point;
    map.setGuess(point);
    render(confirmCard(run.n, lockIn));
  });

  // --- start ----------------------------------------------------------------

  const saved = load(saveKey);
  if (saved?.guesses.length) {
    for (const [i, g] of saved.guesses.slice(0, ROUNDS).entries()) {
      results.push(scoreRun(targets[i]!, g, i));
    }
    scoreValue.textContent = pad3(total());
    if (results.length >= ROUNDS) showSummary();
    else showPrompt();
  } else {
    showPrompt();
  }

}
