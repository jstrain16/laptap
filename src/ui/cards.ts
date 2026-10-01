import { kmToMiles } from '../game/geo.js';
import { MAX_SCORE, breakdown, type RoundResult } from '../game/scoring.js';
import {
  NAME_MAX,
  rankOf,
  validName,
  type ClaimResult,
  type LeaderboardRow,
} from '../game/track.js';
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
  [400, ['Not the right valley.', "That's a road trip.", 'Warm. Ish.']],
  [1200, ['Different mountain range entirely.', "That's a flight, not a drive.", 'Cold.']],
  [4000, ['That is a long-haul flight.', 'Nowhere near.', 'Way off.']],
  [Infinity, ['You put it on the other side of the planet.', 'Not even the right ocean.', 'No.']],
];

const pick = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)] ?? '';

/**
 * The distance bands alone used to contradict the bonus line above them — a
 * 950-mile miss inside the US printed "Wrong country." directly under
 * "+25 — right country". When a floor fires it decides the tone instead.
 */
function snarkFor(result: RoundResult): string {
  // Below ~50km the distance bands say it better; above, a rung that fired
  // sets the tone so the line never contradicts the breakdown beneath it.
  const finest = result.earned[0];
  if (finest && result.distanceKm > 50) {
    const { label } = finest;
    return pick([
      `Right ${label}, wrong mountain.`,
      `You found the ${label}, at least.`,
      `The correct ${label}. Nothing more.`,
    ]);
  }
  return pick(SNARK.find(([max]) => result.distanceKm < max)?.[1] ?? ['']);
}

/** "Round 3 of 5 — ×2" above the mountain being asked about. */
export function promptCard(
  round: number,
  total: number,
  multiplier: number,
  resortName: string,
  hint: string,
): HTMLElement {
  const title = el('h2', { class: 'card-title' });
  const card = el(
    'section',
    { class: 'card panel' },
    el(
      'div',
      { class: 'card-kicker kicker-row' },
      el('span', { text: `ROUND ${round} OF ${total}` }),
      // The multiplier is the whole reason the later rounds matter, so it gets
      // its own badge rather than being tacked onto the end of a grey line.
      multiplier > 1 ? el('span', { class: 'mult', text: `×${multiplier}` }) : null,
    ),
    title,
    el('p', { class: 'card-sub', text: hint }),
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

export function resultCard(result: RoundResult, isLast: boolean, onNext: () => void): HTMLElement {
  const how = breakdown(result);
  const next = button(isLast ? 'SEE RESULTS' : 'NEXT MOUNTAIN', onNext);

  return el(
    'section',
    { class: 'card panel' },
    el('div', {
      class: 'card-kicker',
      text: `${bandFor(result.baseScore)}  ${result.resort.place.toUpperCase()}`,
    }),
    el('h2', { class: 'card-title', text: result.resort.name }),
    el('p', { class: 'result-line', text: `${miles(result.distanceKm)} away` }),
    el(
      'p',
      { class: 'result-line' },
      el('span', { class: 'result-score', text: String(result.baseScore) }),
      result.multiplier > 1
        ? el('span', { class: 'result-mult' }, el('span', { class: 'mult', text: `×${result.multiplier}` }), el('span', { text: ` = ${result.score}` }))
        : null,
    ),
    el('p', { class: 'result-line result-floor', text: how }),
    el('p', { class: 'result-snark', text: snarkFor(result) }),
    el('div', { class: 'card-actions' }, next),
  );
}

/** What the summary needs to show today's board, or null when tracking is off. */
export interface LeaderboardHooks {
  player: string;
  name: string | null;
  load: () => Promise<LeaderboardRow[]>;
  claim: (name: string) => Promise<ClaimResult>;
}

const TOP = 10;

function boardList(rows: LeaderboardRow[], player: string): HTMLElement {
  if (rows.length === 0) {
    return el('p', { class: 'card-sub', text: 'Nobody else has finished yet. You could be first.' });
  }
  const mine = rankOf(rows, player);
  const shown = rows.slice(0, TOP);
  // Always show the player's own row, even if they're outside the top ten.
  if (mine && mine > TOP) shown.push(rows[mine - 1]!);
  return el(
    'ol',
    { class: 'board' },
    ...shown.map((r) =>
      el(
        'li',
        { class: `board-row${r.player_id === player ? ' me' : ''}` },
        el('span', { class: 'board-rank', text: `${rankOf(rows, r.player_id)}` }),
        el('span', { class: 'board-name', text: r.name }),
        el('span', { class: 'board-score', text: String(r.total) }),
      ),
    ),
  );
}

/**
 * The join prompt becomes the board in place once a name is claimed, so the
 * card never jumps. Any failure degrades to a quiet line, never an error.
 */
function leaderboardSection(hooks: LeaderboardHooks): HTMLElement {
  const section = el('div', { class: 'board-section' });
  const heading = el('div', { class: 'card-kicker', text: "TODAY'S LEADERBOARD" });
  const body = el('div');
  section.append(heading, body);

  const showBoard = async () => {
    body.replaceChildren(el('p', { class: 'card-sub', text: 'Loading…' }));
    const rows = await hooks.load();
    const mine = rankOf(rows, hooks.player);
    body.replaceChildren(
      boardList(rows, hooks.player),
      mine
        ? el('p', { class: 'card-sub', text: `You're #${mine} of ${rows.length} as ${hooks.name}.` })
        : el('p', { class: 'card-sub', text: `Playing as ${hooks.name}.` }),
    );
  };

  const showJoin = () => {
    const input = el('input', { class: 'board-input', type: 'text' }) as HTMLInputElement;
    input.placeholder = 'nickname';
    input.maxLength = NAME_MAX;
    input.autocomplete = 'off';
    input.spellcheck = false;
    const note = el('p', { class: 'card-sub', text: 'Pick a nickname — it shows on the board.' });
    const join = button('JOIN', async () => {
      const name = validName(input.value);
      if (!name) {
        note.textContent = '2–20 letters, numbers, spaces or - _ . \'';
        return;
      }
      join.disabled = true;
      const result = await hooks.claim(name);
      join.disabled = false;
      if (result === 'ok') {
        hooks.name = name;
        void showBoard();
      } else if (result === 'taken') {
        note.textContent = `"${name}" is taken — try another.`;
      } else if (result === 'invalid') {
        note.textContent = 'That name has characters the board can’t show.';
      } else {
        note.textContent = "Couldn't reach the leaderboard. Your score is saved; try again later.";
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') join.click();
    });
    body.replaceChildren(el('div', { class: 'board-join' }, input, join), note);
  };

  if (hooks.name) void showBoard();
  else showJoin();
  return section;
}

export function summaryCard(
  results: readonly RoundResult[],
  total: number,
  onShare: () => Promise<boolean>,
  leaderboard: LeaderboardHooks | null = null,
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
    leaderboard ? leaderboardSection(leaderboard) : null,
    el('p', { class: 'card-sub', text: 'A new set of five mountains at midnight.' }),
  );
}
