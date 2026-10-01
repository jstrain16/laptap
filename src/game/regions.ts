// Ski regions, used for the "right region" scoring floor — laptap's parody of
// MapTap's continent floor. Grouped the way a skier thinks about them rather
// than the way the Census Bureau does.

export type Region =
  | 'rockies'
  | 'sierra-cascades'
  | 'northeast'
  | 'midwest'
  | 'mid-atlantic-south'
  | 'alaska';

export const REGION_LABELS: Record<Region, string> = {
  rockies: 'the Rockies',
  'sierra-cascades': 'the Sierra & Cascades',
  northeast: 'the Northeast',
  midwest: 'the Midwest',
  'mid-atlantic-south': 'the Mid-Atlantic & South',
  alaska: 'Alaska',
};

const STATE_REGION: Record<string, Region> = {
  // Rockies and the Interior West
  Colorado: 'rockies',
  Utah: 'rockies',
  Wyoming: 'rockies',
  Montana: 'rockies',
  Idaho: 'rockies',
  'New Mexico': 'rockies',
  Arizona: 'rockies',
  Nevada: 'rockies',

  // Sierra and Cascades
  California: 'sierra-cascades',
  Oregon: 'sierra-cascades',
  Washington: 'sierra-cascades',

  // Northeast
  Vermont: 'northeast',
  'New Hampshire': 'northeast',
  Maine: 'northeast',
  'New York': 'northeast',
  Massachusetts: 'northeast',
  Connecticut: 'northeast',
  'Rhode Island': 'northeast',
  'New Jersey': 'northeast',

  // Midwest
  Michigan: 'midwest',
  Wisconsin: 'midwest',
  Minnesota: 'midwest',
  Iowa: 'midwest',
  Illinois: 'midwest',
  Indiana: 'midwest',
  Ohio: 'midwest',
  Missouri: 'midwest',
  'North Dakota': 'midwest',
  'South Dakota': 'midwest',
  Nebraska: 'midwest',
  Kansas: 'midwest',

  // Mid-Atlantic and South
  Pennsylvania: 'mid-atlantic-south',
  Maryland: 'mid-atlantic-south',
  'West Virginia': 'mid-atlantic-south',
  Virginia: 'mid-atlantic-south',
  'North Carolina': 'mid-atlantic-south',
  'South Carolina': 'mid-atlantic-south',
  Tennessee: 'mid-atlantic-south',
  Georgia: 'mid-atlantic-south',
  Alabama: 'mid-atlantic-south',
  Kentucky: 'mid-atlantic-south',
  Delaware: 'mid-atlantic-south',

  Alaska: 'alaska',
};

/** null for a state with no ski areas (or a point that isn't in a state). */
export function regionForState(state: string | null): Region | null {
  return state ? (STATE_REGION[state] ?? null) : null;
}
