import './ui/styles.css';

import statesData from './data/states.json' with { type: 'json' };
import { dateFromQuery, formatPuzzleDate, puzzleFor } from './game/daily.js';
import type { LatLng, StateCollection } from './game/geo.js';
import { copy, shareText } from './game/share.js';
import { createGame } from './game/state.js';
import { load, save, streak } from './game/storage.js';
import { createMap, type Basemap, type GameMap } from './map/map.js';
import { MarkerLayer } from './map/markers.js';
import { confirmCard, promptCard, resultCard, summaryCard } from './ui/cards.js';

const states = statesData as unknown as StateCollection;

const $ = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id} in index.html`);
  return node as T;
};

const stage = $('stage');
const scoreValue = $('score-value');
const title = $('title');
const basemapToggle = $<HTMLButtonElement>('basemap-toggle');
const fitUsaButton = $<HTMLButtonElement>('fit-usa');

function render(node: HTMLElement | null): void {
  stage.replaceChildren(...(node ? [node] : []));
}

const pad3 = (n: number) => String(Math.min(n, 999)).padStart(3, '0');

function main(map: GameMap): void {
  const date = dateFromQuery(window.location.search);
  const puzzle = puzzleFor(date);
  const game = createGame(puzzle, states);
  const markers = new MarkerLayer(map);

  title.innerHTML = `laptap #${puzzle.number} <span class="dim">· ${formatPuzzleDate(date)}</span>`;
  document.title = `laptap #${puzzle.number}`;

  // --- chrome -------------------------------------------------------------

  const setBasemap = (kind: Basemap) => {
    map.setBasemap(kind);
    basemapToggle.textContent = kind === 'relief' ? 'RELIEF' : 'SATELLITE';
  };
  basemapToggle.addEventListener('click', () =>
    setBasemap(map.getBasemap() === 'relief' ? 'satellite' : 'relief'),
  );
  fitUsaButton.addEventListener('click', () => map.fitUSA());

  // --- persistence --------------------------------------------------------

  const persist = () => {
    const { results, total } = game.state;
    save({
      puzzleNumber: puzzle.number,
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
    map.fitCONUS();
    render(
      promptCard(
        game.state.roundIndex + 1,
        puzzle.resorts.length,
        game.currentMultiplier(),
        resort.name,
      ),
    );
  }

  function showConfirm(): void {
    const resort = game.currentResort();
    if (!resort) return;
    render(confirmCard(resort.name, lockIn));
  }

  function lockIn(): void {
    const result = game.confirm();
    if (!result) return;
    map.setLocked(true);
    markers.reveal(result.resort, result.resort.name, result.guess);
    map.frame([result.guess, result.resort]);
    scoreValue.textContent = pad3(game.state.total);
    persist();
    render(resultCard(result, game.state.roundIndex === puzzle.resorts.length - 1, () => game.next()));
  }

  function showSummary(): void {
    markers.clear();
    map.setLocked(true);
    // Pull back to show every mountain from the run at once.
    map.frame(game.state.results.flatMap((r) => [r.guess, r.resort as LatLng]));
    persist();
    const played = streak(puzzle.number);
    const card = summaryCard(game.state.results, game.state.total, () =>
      copy(shareText(date, game.state.results, game.state.total)),
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

  const saved = load(puzzle.number);
  if (saved?.guesses.length) {
    game.restore(saved.guesses);
  } else {
    showPrompt();
  }
}

createMap($('map')).then(main).catch((err: unknown) => {
  console.error(err);
  render(
    Object.assign(document.createElement('section'), {
      className: 'card panel',
      textContent: "The map didn't load. Check your connection and refresh.",
    }),
  );
});
