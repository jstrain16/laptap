# laptap

A daily geography game about US ski mountains — a parody of [MapTap](https://maptap.gg/).

Five mountains a day, easiest first. You get a name, you tap the map, and you score 0–100 on how
close you were. Later rounds are worth double and triple, so a perfect run is 1000.

```bash
npm install
npm run dev          # http://localhost:5188
```

## Scoring

| off by | 0 | 10km | 25km | 50km | 100km | 200km | 400km | 800km |
|---|---|---|---|---|---|---|---|---|
| score | 100 | 92 | 81 | 66 | 43 | 19 | 4 | 0 |

`100 · e^(−distance / DECAY_KM)`, with `DECAY_KM = 120`. That is the one knob worth turning if the
game plays too hard or too soft — it lives at the top of [`src/game/scoring.ts`](src/game/scoring.ts).

Two consolation floors soften a bad guess, mirroring MapTap's country/continent floors:

- land in the **right state** → at least **25**
- land in the **right region** (Rockies, Sierra & Cascades, Northeast, Midwest, Mid-Atlantic & South,
  Alaska) → at least **10**

Floors only ever lift a weak guess, never beat a close one. Round multipliers are `1, 1, 2, 3, 3`.

## Daily puzzles

Puzzle #1 was 2026-10-01. The day's five mountains come from a fixed shuffle of each difficulty
tier indexed by the puzzle number, so everyone gets the same set with no server involved, and a
mountain cannot repeat until its whole tier is used (49 days for the smallest tier).

Add `?date=YYYY-MM-DD` to play any other day's puzzle — the only practical way to test without
waiting.

## The mountain data

`src/data/resorts.json` is generated, not hand-written. `npm run data` pulls
[OpenSkiMap](https://openskimap.org/)'s worldwide dump, keeps US downhill areas that are still
operating and have at least one lift and 30m of vertical, and ranks them by a "would a skier have
heard of this" score:

```
fame = 1.0·ln(1+lifts) + 1.4·ln(1+verticalM) + 0.9·ln(1+runKm) + 0.8·(hasWikipediaEntry)
```

Vertical drop carries the most weight — lift count alone ranks a Michigan bump with twelve surface
lifts above Alta. The ranked list splits into five tiers; round N draws from tier N, so round 1 is
Vail and round 5 is a rope tow in Iowa.

That gives **497 resorts across 37 states**. The script hard-fails if the count, the coordinates,
the tier sizes, or five known resorts' positions drift, so a bad upstream change can't quietly ship.

It also vendors US state outlines from `us-atlas` into `src/data/states.json`, used both to draw
the faint borders and to decide which state a tap landed in.

## Layout

```
scripts/build-resorts.ts   ETL → src/data/*.json
src/game/                  pure logic: scoring, daily selection, state machine, storage, share
src/map/                   MapLibre setup and the pins/line drawn on top
src/ui/                    the cards and the terminal skin
```

No backend, no accounts, no build-time secrets — `npm run build` emits a static `dist/`.

## Checks

```bash
npm test     # scoring curve, floors, multipliers, daily determinism, no-repeat guarantee
npm run build
```

## Tweaking it

- **Difficulty** — `DECAY_KM` in [`src/game/scoring.ts`](src/game/scoring.ts).
- **Snark** — the `SNARK` table in [`src/ui/cards.ts`](src/ui/cards.ts), banded by distance.
- **Colours** — every one is a custom property on `:root` in [`src/ui/styles.css`](src/ui/styles.css).
- **Going global** — the pool is US-only by one filter in the ETL. The scoring, tiering, and daily
  selection don't care about country; the state floor would need to become a country floor.
