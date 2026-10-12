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
  /**
   * How far "on the mountain" extends from the pin, in km: the span of the
   * lift network plus the base village. A tap inside it is a bullseye.
   */
  reachKm: number;
  /** One line about the place, shown once the answer is revealed. */
  fact?: string;
  /** 1 = everyone knows it, 5 = you have never heard of it. */
  tier: 1 | 2 | 3 | 4 | 5;
  /** Finest boundary where the pool has one: a US state in the global pool. */
  region?: string;
  /** Fine boundary: a country in the global pool, a state in the US pool. */
  fine: string;
  /** Coarse boundary: a continent, or a US ski region. */
  coarse: string;
}

export const TIER_COUNT = 5;
