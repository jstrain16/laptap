import type { BoundaryCollection } from './geo.js';
import type { Resort } from './resorts.js';

export type PoolId = 'ikon' | 'usa';

export interface Pool {
  id: PoolId;
  /** Shown in the header: "laptap #12 · Ikon". */
  label: string;
  /** What the prompt is asking for, e.g. "Ikon Pass destination". */
  noun: string;
  /** How the two scoring floors are described on the result card. */
  fineLabel: string;
  coarseLabel: string;
  /** Where the camera sits between rounds, [[w, s], [e, n]]. */
  home: [[number, number], [number, number]];
  /** Label and target for the zoom-out button. */
  wideLabel: string;
  wide: [[number, number], [number, number]];
  load(): Promise<{ resorts: Resort[]; boundaries: BoundaryCollection }>;
}

/**
 * Each pool ships its own boundary file — US states for the domestic pool,
 * world countries for the global one — so the dynamic imports keep a player
 * from downloading the set they aren't using.
 */
export const POOLS: Record<PoolId, Pool> = {
  ikon: {
    id: 'ikon',
    label: 'Ikon Pass',
    noun: 'Ikon Pass destination',
    fineLabel: 'country',
    coarseLabel: 'continent',
    home: [
      [-170, -50],
      [180, 70],
    ],
    wideLabel: 'WORLD',
    wide: [
      [-179, -58],
      [179, 78],
    ],
    async load() {
      const [resorts, boundaries] = await Promise.all([
        import('../data/resorts-ikon.json').then((m) => m.default as Resort[]),
        import('../data/countries.json').then((m) => m.default as unknown as BoundaryCollection),
      ]);
      return { resorts, boundaries };
    },
  },
  usa: {
    id: 'usa',
    label: 'All USA',
    noun: 'US ski area',
    fineLabel: 'state',
    coarseLabel: 'region',
    home: [
      [-125.5, 24],
      [-66.5, 49.8],
    ],
    wideLabel: 'FIT USA',
    wide: [
      [-168, 23],
      [-66, 64],
    ],
    async load() {
      const [resorts, boundaries] = await Promise.all([
        import('../data/resorts-usa.json').then((m) => m.default as Resort[]),
        import('../data/states.json').then((m) => m.default as unknown as BoundaryCollection),
      ]);
      return { resorts, boundaries };
    },
  },
};

export const DEFAULT_POOL: PoolId = 'ikon';

/** `?pool=usa` swaps the question set; anything else falls back to the default. */
export function poolFromQuery(search: string): Pool {
  const raw = new URLSearchParams(search).get('pool');
  return POOLS[raw as PoolId] ?? POOLS[DEFAULT_POOL];
}
