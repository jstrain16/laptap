import type { Region } from './regions.js';

export interface Resort {
  /** OpenSkiMap id, stable across their weekly rebuilds. */
  id: string;
  name: string;
  state: string;
  region: Region;
  lat: number;
  lng: number;
  lifts: number;
  verticalM: number;
  /** 1 = household name, 5 = a rope tow you have never heard of. */
  tier: 1 | 2 | 3 | 4 | 5;
}

export const TIER_COUNT = 5;
