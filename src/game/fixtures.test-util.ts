import { readFileSync } from 'node:fs';

import type { BoundaryCollection } from './geo.ts';
import type { Resort } from './resorts.ts';

const read = <T>(file: string): T =>
  JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8')) as T;

/**
 * The tests read the generated data straight off disk. The pools' own `load()`
 * uses dynamic `import(... with { type: 'json' })`, which the bundler handles
 * but the node test runner does not.
 */
export const IKON = read<Resort[]>('resorts-ikon.json');
export const EPIC = read<Resort[]>('resorts-epic.json');
export const USA = read<Resort[]>('resorts-usa.json');
export const COUNTRIES = read<BoundaryCollection>('countries.json');
export const STATES = read<BoundaryCollection>('states.json');

export function byName(pool: Resort[], name: string): Resort {
  const r = pool.find((x) => x.name === name);
  if (!r) throw new Error(`fixture resort "${name}" is missing from the pool`);
  return r;
}
