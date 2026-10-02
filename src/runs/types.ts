/** Mirrors what scripts/build-runs.ts writes to public/runs/<id>.json. */
export type Line = [number, number][];

export interface Run {
  /** Name. */
  n: string;
  /** OpenSkiMap difficulty: novice, easy, intermediate, advanced, expert, freeride, extreme. */
  d: string;
  /** Length in metres. */
  len: number;
  /** One polyline per segment; for an `area` run, one closed ring per polygon. */
  l: Line[];
  area?: true;
}

export interface RunsFile {
  id: string;
  name: string;
  convention: 'north_america' | 'europe' | 'japan';
  /** [west, south, east, north] */
  bounds: [number, number, number, number];
  runs: Run[];
  extra: { d: string; l: Line[] }[];
  lifts: Line[];
}

export interface MountainEntry {
  id: string;
  name: string;
  runs: number;
}
