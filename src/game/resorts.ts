export interface Resort {
  /** OpenSkiMap id, stable across their weekly rebuilds. */
  id: string;
  name: string;
  /** Where it is, shown once the answer is revealed: "Alta, Utah". */
  place: string;
  lat: number;
  lng: number;
  lifts: number;
  verticalM: number;
  /** 1 = everyone knows it, 5 = you have never heard of it. */
  tier: 1 | 2 | 3 | 4 | 5;
  /** Fine boundary: a US state, or a country in the global pool. */
  fine: string;
  /** Coarse boundary: a US ski region, or a continent. */
  coarse: string;
}

export const TIER_COUNT = 5;
