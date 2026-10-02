import type { RunsFile } from './types.js';

/**
 * Trail-map colours in the resort's own convention: green/blue/black in North
 * America, blue/red/black in Europe. Each run is drawn as a white snow
 * corridor with this colour down its centre; `label` is what the prompt
 * calls it.
 */
export interface Paint {
  color: string;
  label: string;
}

const GREEN = '#1f9d4d';
const BLUE = '#1c6fe3';
const RED = '#d92b2b';
const BLACK = '#111111';

const NORTH_AMERICA: Record<string, Paint> = {
  novice: { color: GREEN, label: 'green' },
  easy: { color: GREEN, label: 'green' },
  intermediate: { color: BLUE, label: 'blue' },
  advanced: { color: BLACK, label: 'black' },
  expert: { color: BLACK, label: 'double-black' },
  extreme: { color: BLACK, label: 'double-black' },
};

const EUROPE: Record<string, Paint> = {
  novice: { color: GREEN, label: 'green' },
  easy: { color: BLUE, label: 'blue' },
  intermediate: { color: RED, label: 'red' },
  advanced: { color: BLACK, label: 'black' },
  expert: { color: BLACK, label: 'black' },
  extreme: { color: BLACK, label: 'black' },
};

const JAPAN: Record<string, Paint> = {
  novice: { color: GREEN, label: 'green' },
  easy: { color: GREEN, label: 'green' },
  intermediate: { color: RED, label: 'red' },
  advanced: { color: BLACK, label: 'black' },
  expert: { color: BLACK, label: 'black' },
  extreme: { color: BLACK, label: 'black' },
};

const OTHER: Paint = { color: '#e8851c', label: 'off-piste' };

export function paintFor(convention: RunsFile['convention'], difficulty: string): Paint {
  const table = convention === 'europe' ? EUROPE : convention === 'japan' ? JAPAN : NORTH_AMERICA;
  return table[difficulty] ?? OTHER;
}
