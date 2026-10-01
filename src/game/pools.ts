import type { BoundaryCollection } from './geo.js';
import type { Resort } from './resorts.js';

export type PoolId = 'ikon' | 'usa';

/**
 * One rung of a pool's consolation ladder. `key` names which resort/boundary
 * level it compares; `label` is how the result card describes it.
 */
export interface Floor {
  key: 'region' | 'fine' | 'coarse';
  label: string;
  value: number;
}

export type HomeView =
  | { kind: 'globe' }
  | { kind: 'bounds'; bounds: [[number, number], [number, number]] };

export interface Pool {
  id: PoolId;
  /** Shown in the header: "laptap #12 · Ikon". */
  label: string;
  /** What the prompt is asking for, e.g. "Ikon Pass destination". */
  noun: string;
  /**
   * Consolation floors, finest first. A guess that lands in the right place
   * at some level scores at least that rung's value, however far off it was.
   */
  floors: Floor[];
  /**
   * Where the camera sits between rounds. A worldwide pool frames the whole
   * globe, which is a viewport calculation rather than a bounding box; a
   * regional pool fits its corner of the map.
   */
  home: HomeView;
  /** Label for the button that returns to the home view. */
  wideLabel: string;
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
    floors: [
      { key: 'region', label: 'state', value: 75 },
      { key: 'fine', label: 'country', value: 60 },
      { key: 'coarse', label: 'continent', value: 40 },
    ],
    home: { kind: 'globe' },
    wideLabel: 'GLOBE',
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
    floors: [
      { key: 'fine', label: 'state', value: 75 },
      { key: 'coarse', label: 'region', value: 40 },
    ],
    home: {
      kind: 'bounds',
      bounds: [
        [-168, 23],
        [-66, 64],
      ],
    },
    wideLabel: 'FIT USA',
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
