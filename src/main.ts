import './ui/styles.css';

import { dateFromQuery, formatPuzzleDate, puzzleFor } from './game/daily.js';
import type { LatLng } from './game/geo.js';
import { poolFromQuery } from './game/pools.js';
import { copy, shareText } from './game/share.js';
import { createGame } from './game/state.js';
import { load, save, streak } from './game/storage.js';
import { basemapLabel, createMap, BASEMAP_ORDER, type GameMap } from './map/map.js';
import { MarkerLayer } from './map/markers.js';
import { confirmCard, promptCard, resultCard, summaryCard } from './ui/cards.js';

const $ = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id} in index.html`);
  return node as T;
};

const stage = $('stage');
const scoreValue = $('score-value');
const title = $('title');
const basemapToggle = $<HTMLButtonElement>('basemap-toggle');
const wideButton = $<HTMLButtonElement>('fit-wide');

function render(node: HTMLElement | null): void {
  stage.replaceChildren(...(node ? [node] : []));
}

const pad3 = (n: number) => String(Math.min(n, 999)).padStart(3, '0');

async function main(): Promise<void> {
  const pool = poolFromQuery(window.location.search);
  const date = dateFromQuery(window.location.search);

  const { resorts, boundaries } = await pool.load();
  const puzzle = puzzleFor(date, pool.id, resorts);
  const map: GameMap = await createMap($('map'), pool);

  const game = createGame(puzzle, boundaries, pool.rungs);
  const markers = new MarkerLayer(map);

  title.innerHTML =
    `laptap #${puzzle.number} <span class="dim">· ${pool.label} · ${formatPuzzleDate(date)}</span>`;
  document.title = `laptap #${puzzle.number}`;

  // --- chrome -------------------------------------------------------------

  basemapToggle.textContent = basemapLabel(map.getBasemap());
  basemapToggle.addEventListener('click', () => {
    const next =
      BASEMAP_ORDER[(BASEMAP_ORDER.indexOf(map.getBasemap()) + 1) % BASEMAP_ORDER.length]!;
    map.setBasemap(next);
    basemapToggle.textContent = basemapLabel(next);
  });

  wideButton.textContent = pool.wideLabel;
  wideButton.addEventListener('click', () => map.fitHome());

  // --- persistence --------------------------------------------------------

  // Keyed by pool as well as day, so playing the US set doesn't lock you out
  // of the Ikon one.
  const saveKey = `${pool.id}:${puzzle.number}`;
  const persist = () => {
    const { results, total } = game.state;
    save({
      key: saveKey,
      guesses: results.map((r) => r.guess),
      scores: results.map((r) => r.baseScore),
      total,
      finished: game.state.phase === 'summary',
    });
  };

  // --- the loop -----------------------------------------------------------

  function showPrompt(): void {
    const resort = game.currentResort();
    if (!resort) return;
    markers.clear();
    map.setLocked(false);
    map.fitHome();
    map.startSpin();
    render(
      promptCard(
        game.state.roundIndex + 1,
        puzzle.resorts.length,
        game.currentMultiplier(),
        resort.name,
        `Tap the map where you think this ${pool.noun} is`,
      ),
    );
  }

  function showConfirm(): void {
    const resort = game.currentResort();
    if (!resort) return;
    map.stopSpin();
    render(confirmCard(resort.name, lockIn));
  }

  function lockIn(): void {
    const result = game.confirm();
    if (!result) return;
    map.stopSpin();
    map.setLocked(true);
    markers.reveal(result.resort, result.resort.name, result.guess);
    map.frame([result.guess, result.resort]);
    scoreValue.textContent = pad3(game.state.total);
    persist();
    render(
      resultCard(result, game.state.roundIndex === puzzle.resorts.length - 1, () => game.next()),
    );
  }

  function showSummary(): void {
    markers.clear();
    map.stopSpin();
    map.setLocked(true);
    // Pull back to show every mountain from the run at once.
    map.frame(game.state.results.flatMap((r) => [r.guess, r.resort as LatLng]));
    persist();
    const played = streak(pool.id, puzzle.number);
    const card = summaryCard(game.state.results, game.state.total, () =>
      copy(shareText(date, pool.label, game.state.results, game.state.total)),
    );
    if (played > 1) {
      const note = card.querySelector('.card-sub');
      if (note) note.textContent = `${played}-day streak. New mountains at midnight.`;
    }
    render(card);
  }

  game.subscribe((state) => {
    scoreValue.textContent = pad3(state.total);
    switch (state.phase) {
      case 'prompt':
        showPrompt();
        break;
      case 'aiming':
        showConfirm();
        break;
      case 'summary':
        showSummary();
        break;
      case 'revealing':
        break; // lockIn() already rendered the result card
    }
  });

  map.onPick((point) => {
    markers.setGuess(point);
    game.place(point);
  });

  // --- start --------------------------------------------------------------

  const saved = load(saveKey);
  if (saved?.guesses.length) {
    game.restore(saved.guesses);
  } else {
    showPrompt();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  render(
    Object.assign(document.createElement('section'), {
      className: 'card panel',
      textContent: "Something didn't load. Check your connection and refresh.",
    }),
  );
});
