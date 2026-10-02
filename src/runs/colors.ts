import type { RunsFile } from './types.js';

/**
 * Trail-map colours in the resort's own convention: green/blue/black in North
 * America, blue/red/black in Europe. `label` is what the prompt calls it.
 * Black runs get a light casing, or they would vanish into a dark basemap.
 */
export interface Paint {
  color: string;
  casing: string;
  label: string;
}

const GREEN = '#35c46a';
const BLUE = '#3d8bff';
const RED = '#ef4444';
const BLACK = '#0a0a0a';
const DARK = '#060910';
const LIGHT = '#e5e7eb';

const NORTH_AMERICA: Record<string, Paint> = {
  novice: { color: GREEN, casing: DARK, label: 'green' },
  easy: { color: GREEN, casing: DARK, label: 'green' },
  intermediate: { color: BLUE, casing: DARK, label: 'blue' },
  advanced: { color: BLACK, casing: LIGHT, label: 'black' },
  expert: { color: BLACK, casing: '#f59e0b', label: 'double-black' },
  extreme: { color: BLACK, casing: '#f59e0b', label: 'double-black' },
};

const EUROPE: Record<string, Paint> = {
  novice: { color: GREEN, casing: DARK, label: 'green' },
  easy: { color: BLUE, casing: DARK, label: 'blue' },
  intermediate: { color: RED, casing: DARK, label: 'red' },
  advanced: { color: BLACK, casing: LIGHT, label: 'black' },
  expert: { color: BLACK, casing: LIGHT, label: 'black' },
  extreme: { color: BLACK, casing: LIGHT, label: 'black' },
};

const JAPAN: Record<string, Paint> = {
  novice: { color: GREEN, casing: DARK, label: 'green' },
  easy: { color: GREEN, casing: DARK, label: 'green' },
  intermediate: { color: RED, casing: DARK, label: 'red' },
  advanced: { color: BLACK, casing: LIGHT, label: 'black' },
  expert: { color: BLACK, casing: LIGHT, label: 'black' },
  extreme: { color: BLACK, casing: LIGHT, label: 'black' },
};

const OTHER: Paint = { color: '#fb923c', casing: DARK, label: 'off-piste' };

export function paintFor(convention: RunsFile['convention'], difficulty: string): Paint {
  const table = convention === 'europe' ? EUROPE : convention === 'japan' ? JAPAN : NORTH_AMERICA;
  return table[difficulty] ?? OTHER;
}
