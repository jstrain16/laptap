/**
 * Build-time ETL. Turns OpenSkiMap's worldwide ski-area dump and two boundary
 * sets into the small JSON files the game ships:
 *
 *   src/data/resorts-ikon.json   the 80 Ikon Pass destinations (default pool)
 *   src/data/resorts-usa.json    ~500 US downhill areas (the ?pool=usa set)
 *   src/data/countries.json      world countries, tagged with their continent
 *   src/data/states.json         US states, tagged with their ski region
 *
 * Run with `npm run data`. The 20MB source is cached in .cache/ and never
 * reaches the browser.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { feature } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, quantile, simplify } from 'topojson-simplify';

import {
  boundaryAt,
  haversineKm,
  type BoundaryCollection,
  type BoundaryFeature,
} from '../src/game/geo.ts';
import { regionForState } from '../src/game/regions.ts';
import type { Resort } from '../src/game/resorts.ts';
import { IKON_DESTINATIONS } from './ikon-destinations.ts';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'https://tiles.openskimap.org/geojson/ski_areas.geojson';
const COUNTRIES_SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';

/**
 * Share of boundary detail to keep, via topology-preserving simplification.
 * Measured against all 80 Ikon destinations: 0.3 puts every one in the right
 * country for 186KB gzipped, while 0.2 shrinks Andorra until Grandvalira falls
 * into France. The 110m Natural Earth build is smaller still but drops Andorra
 * altogether and pushes Chamonix across the Italian border.
 */
const BOUNDARY_DETAIL = 0.3;

/**
 * Natural Earth's formal names are a mouthful on a result card, and they have
 * to match what OpenSkiMap calls the same country for the floor to fire.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  'United States of America': 'United States',
  "People's Republic of China": 'China',
  'Republic of Korea': 'South Korea',
  'Republic of Serbia': 'Serbia',
  Czechia: 'Czech Republic',
};
const countryName = (raw: string) => COUNTRY_ALIASES[raw] ?? raw;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Keeps out abandoned rope tows and mis-tagged nordic centres. */
const MIN_LIFTS = 1;
const MIN_VERTICAL_M = 30;

/** Same name within this radius means one mountain listed twice, not two areas. */
const DUPE_KM = 5;

// Coordinates are rounded to this many decimals. 3dp is ~110m: plenty for
// drawing a border and for deciding which country or state a tap landed in.
const COORD_DP = 3;

// --- source types (only the fields we read) ---------------------------------

interface SkiAreaStats {
  maxElevation?: number;
  minElevation?: number;
  lifts?: { byType?: Record<string, { count?: number }> };
  runs?: {
    byActivity?: {
      downhill?: { byDifficulty?: Record<string, { lengthInKm?: number }> };
    };
  };
}

interface SkiAreaPlace {
  iso3166_1Alpha2?: string;
  localized?: { en?: { region?: string | null; country?: string | null; locality?: string | null } };
}

interface SkiAreaFeature {
  geometry: { type: string; coordinates: unknown };
  properties: {
    id: string;
    name?: string | null;
    status?: string | null;
    activities?: string[];
    wikidataID?: string | null;
    statistics?: SkiAreaStats;
    places?: SkiAreaPlace[];
  };
}

// --- helpers ----------------------------------------------------------------

const round = (n: number, dp = COORD_DP) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

function liftCount(s: SkiAreaStats | undefined): number {
  return Object.values(s?.lifts?.byType ?? {}).reduce((a, v) => a + (v.count ?? 0), 0);
}

function verticalM(s: SkiAreaStats | undefined): number {
  const { maxElevation: hi, minElevation: lo } = s ?? {};
  return hi != null && lo != null ? Math.round(hi - lo) : 0;
}

function runKm(s: SkiAreaStats | undefined): number {
  const byDiff = s?.runs?.byActivity?.downhill?.byDifficulty ?? {};
  return Object.values(byDiff).reduce((a, v) => a + (v.lengthInKm ?? 0), 0);
}

/**
 * How likely a skier is to have heard of the place. Lift count alone is no
 * good — it ranks a Michigan bump with twelve surface lifts above Alta — so
 * vertical drop carries the most weight and a Wikipedia entry breaks ties.
 */
function fameScore(f: SkiAreaFeature): number {
  const s = f.properties.statistics;
  return (
    1.0 * Math.log1p(liftCount(s)) +
    1.4 * Math.log1p(verticalM(s)) +
    0.9 * Math.log1p(runKm(s)) +
    0.8 * (f.properties.wikidataID ? 1 : 0)
  );
}

/** Point geometries pass through; polygons collapse to their outer-ring centroid. */
function centroid(geometry: SkiAreaFeature['geometry']): [number, number] | null {
  const c = geometry.coordinates as number[] | number[][][] | number[][][][];
  if (geometry.type === 'Point') {
    const [lng, lat] = c as number[];
    return lng != null && lat != null ? [lng, lat] : null;
  }
  const polys =
    geometry.type === 'Polygon'
      ? [c as number[][][]]
      : geometry.type === 'MultiPolygon'
        ? (c as number[][][][])
        : null;
  if (!polys) return null;
  const ring = polys[0]?.[0];
  if (!ring?.length) return null;
  let sx = 0;
  let sy = 0;
  for (const p of ring) {
    sx += p[0]!;
    sy += p[1]!;
  }
  return [sx / ring.length, sy / ring.length];
}

/**
 * OpenSkiMap concatenates a resort's names across languages, so a Japanese
 * entry reads "谷川岳天神平スキー場, Mt. T". Prefer the first segment that is
 * mostly Latin, which is the one an English-speaking player is asked to find.
 */
function displayName(raw: string): string {
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  const latin = parts.find((p) => {
    const letters = p.replace(/[^\p{L}]/gu, '');
    return letters.length > 0 && /^[\p{Script=Latin}\s'’.\-]+$/u.test(letters);
  });
  return latin ?? parts[0] ?? raw;
}

/** "Alta, Utah" / "Hokkaido, Japan" — shown with the answer. */
function placeLabel(p: SkiAreaPlace | undefined): string {
  const en = p?.localized?.en;
  return [en?.region, en?.country].filter(Boolean).join(', ') || (en?.country ?? 'Unknown');
}

async function cached(url: string, file: string, label: string): Promise<string> {
  const path = resolve(ROOT, '.cache', file);
  mkdirSync(dirname(path), { recursive: true });
  let fresh = false;
  try {
    fresh = Date.now() - statSync(path).mtimeMs < CACHE_MAX_AGE_MS;
  } catch {
    /* no cache yet */
  }
  if (!fresh) {
    process.stdout.write(`fetching ${label} ...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${label} returned ${res.status} ${res.statusText}`);
    const body = Buffer.from(await res.arrayBuffer());
    writeFileSync(path, body);
    console.log(` ${(body.length / 1e6).toFixed(1)}MB`);
  }
  return readFileSync(path, 'utf8');
}

// --- boundaries -------------------------------------------------------------

function roundCoords(fc: BoundaryCollection): BoundaryCollection {
  for (const f of fc.features) {
    const polys =
      f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const rings of polys) {
      for (const ring of rings) {
        for (const p of ring) {
          p[0] = round(p[0]!);
          p[1] = round(p[1]!);
        }
      }
    }
    delete f.bbox; // recomputed lazily at runtime from the rounded rings
  }
  return fc;
}

function buildStates(): BoundaryCollection {
  const topo = require('us-atlas/states-10m.json');

  // us-atlas also ships `states-albers-10m.json`, whose coordinates are metres
  // in a projected CRS. Importing that one by mistake would silently break both
  // the map and every boundary lookup, so prove we got the lon/lat build.
  const [minLng, minLat, maxLng, maxLat] = topo.bbox as number[];
  if (!(minLng! >= -180 && maxLng! <= 180 && minLat! >= -90 && maxLat! <= 90)) {
    throw new Error(
      `states-10m.json is not WGS84 lon/lat (bbox ${topo.bbox}). Did us-atlas ship the Albers build?`,
    );
  }

  const fc = feature(topo, topo.objects.states) as unknown as {
    type: 'FeatureCollection';
    features: { properties: { name: string }; geometry: unknown; bbox?: unknown }[];
  };
  for (const f of fc.features) {
    // Ski regions only exist for states that have ski areas; the rest still
    // need to be drawable and lookup-able, so they get an empty group.
    (f.properties as BoundaryFeature['properties']).group =
      regionForState(f.properties.name) ?? '';
  }
  return roundCoords(fc as unknown as BoundaryCollection);
}

async function buildCountries(): Promise<BoundaryCollection> {
  const raw = JSON.parse(
    await cached(COUNTRIES_SOURCE, 'ne_50m_countries.geojson', 'Natural Earth countries'),
  ) as {
    features: { properties: Record<string, string>; geometry: unknown }[];
  };
  const features = raw.features
    // Antarctica has no Ikon destinations and a vast, jagged coastline.
    .filter((f) => f.properties.CONTINENT !== 'Antarctica')
    .map((f) => ({
      type: 'Feature' as const,
      properties: {
        name: countryName(f.properties.NAME_EN || f.properties.ADMIN || f.properties.NAME || ''),
        group: f.properties.CONTINENT ?? '',
      },
      geometry: f.geometry,
    }));

  // Simplify through topology so shared borders stay shared — simplifying each
  // country on its own would tear gaps and overlaps along every frontier.
  const pre = presimplify(topology({ c: { type: 'FeatureCollection', features } }));
  const topo = simplify(pre, quantile(pre, BOUNDARY_DETAIL));
  const collection = feature(topo, topo.objects.c!);
  return roundCoords(collection as unknown as BoundaryCollection);
}

// --- resorts ----------------------------------------------------------------

type Candidate = Omit<Resort, 'tier' | 'fine' | 'coarse'> & {
  fame: number;
  /** OpenSkiMap's own country and admin region — the authority for the floors. */
  country: string;
  region: string;
};

function toCandidate(f: SkiAreaFeature): Candidate | null {
  const coords = centroid(f.geometry);
  const name = f.properties.name?.trim();
  if (!coords || !name) return null;
  const place = f.properties.places?.[0];
  return {
    id: f.properties.id,
    name: displayName(name),
    place: placeLabel(place),
    lat: round(coords[1], 5),
    lng: round(coords[0], 5),
    lifts: liftCount(f.properties.statistics),
    verticalM: verticalM(f.properties.statistics),
    fame: fameScore(f),
    country: countryName(place?.localized?.en?.country ?? ''),
    region: place?.localized?.en?.region ?? '',
  };
}

/**
 * Assigns tiers by rank. `cuts` are cumulative fractions of the ranked list;
 * round N draws from tier N, so the shape of the cuts sets how quickly the
 * questions get harder.
 */
function assignTiers(
  ordered: Candidate[],
  cuts: readonly number[],
  fine: (c: Candidate) => string,
  coarse: (c: Candidate) => string,
): Resort[] {
  return ordered.map((c, i) => {
    const frac = (i + 1) / ordered.length;
    const { fame: _fame, country: _country, region: _region, ...rest } = c;
    return {
      ...rest,
      fine: fine(c),
      coarse: coarse(c),
      tier: ((cuts.findIndex((cut) => frac <= cut) + 1) || cuts.length) as Resort['tier'],
    };
  });
}

function fail(msg: string): never {
  console.error(`\n  FAILED: ${msg}\n`);
  process.exit(1);
}

function checkPool(
  name: string,
  resorts: Resort[],
  boundaries: BoundaryCollection,
  minAgreement: number,
): void {
  for (const r of resorts) {
    if (!r.name || !r.fine || !r.coarse) {
      fail(`${name}: incomplete record ${JSON.stringify(r)}`);
    }
    if (Math.abs(r.lat) > 90 || Math.abs(r.lng) > 180) {
      fail(`${name}: ${r.name} is at ${r.lat},${r.lng} — lat/lng swapped?`);
    }
  }
  const names = new Set(resorts.map((r) => r.name));
  if (names.size !== resorts.length) {
    const dupe = resorts.find((r, i) => resorts.findIndex((x) => x.name === r.name) !== i);
    fail(`${name}: names are not unique (e.g. "${dupe?.name}") — a prompt would be unanswerable`);
  }

  const tiers = [1, 2, 3, 4, 5].map((t) => resorts.filter((r) => r.tier === t).length);
  if (tiers.some((n) => n < 5)) fail(`${name}: a tier is too small: ${tiers.join('/')}`);

  // Each resort's own coordinates should land inside its own fine boundary. A
  // lat/lng swap, a coarse boundary file, or a stale region map all show here.
  const wrong = resorts.filter((r) => boundaryAt(r, boundaries)?.name !== r.fine);
  const agreement = 1 - wrong.length / resorts.length;
  if (agreement < minAgreement) {
    fail(
      `${name}: only ${(agreement * 100).toFixed(1)}% of resorts geocode back to their own ` +
        `${'fine boundary'} (e.g. ${wrong
          .slice(0, 3)
          .map((r) => `${r.name} -> ${boundaryAt(r, boundaries)?.name ?? 'nowhere'} (want ${r.fine})`)
          .join('; ')})`,
    );
  }
  console.log(
    `  ${name.padEnd(5)} ${String(resorts.length).padStart(3)} resorts  ` +
      `tiers ${tiers.join('/')}  cycle ${Math.min(...tiers)}d  ` +
      `lookup ${(agreement * 100).toFixed(1)}%`,
  );
}

async function main() {
  const states = buildStates();
  const countries = await buildCountries();
  console.log(`boundaries: ${states.features.length} states, ${countries.features.length} countries`);

  const src = JSON.parse(await cached(SOURCE, 'ski_areas.geojson', 'OpenSkiMap')) as {
    features: SkiAreaFeature[];
  };
  console.log(`source: ${src.features.length} ski areas worldwide\n`);

  const byId = new Map(src.features.map((f) => [f.properties.id, f] as const));

  // --- Ikon pool ----------------------------------------------------------

  const ikonCandidates: Candidate[] = [];
  const seen = new Set<string>();
  for (const dest of IKON_DESTINATIONS) {
    const matches = [...byId.values()].filter((f) => f.properties.id.startsWith(dest.osm));
    if (matches.length !== 1) {
      fail(
        `Ikon: "${dest.name}" prefix ${dest.osm} matched ${matches.length} ski areas` +
          (matches.length ? ` (${matches.map((m) => m.properties.name).join(', ')})` : ''),
      );
    }
    const f = matches[0]!;
    if (seen.has(f.properties.id)) fail(`Ikon: "${dest.name}" reuses another destination's area`);
    seen.add(f.properties.id);

    const place = f.properties.places?.[0];
    if (place?.iso3166_1Alpha2 !== dest.cc) {
      fail(
        `Ikon: "${dest.name}" resolved to ${f.properties.name} in ` +
          `${place?.iso3166_1Alpha2 ?? 'nowhere'}, expected ${dest.cc}`,
      );
    }
    const c = toCandidate(f);
    if (!c) fail(`Ikon: "${dest.name}" has no usable geometry`);
    // Ikon's own branding wins over OpenSkiMap's naming — the player is being
    // asked to find a pass destination, not an OSM object.
    ikonCandidates.push({ ...c, name: dest.name });
  }

  // Even fifths: with 80 destinations a skewed split would leave tier 1 so
  // small that the same handful came round every week.
  const ikon = assignTiers(
    ikonCandidates.sort((a, b) => b.fame - a.fame || a.id.localeCompare(b.id)),
    [0.2, 0.4, 0.6, 0.8, 1],
    // Taken from OpenSkiMap rather than from the polygons, so that checking a
    // resort against the polygons below is a real test of the boundary file and
    // not a tautology. An Andorran resort landing in France has to fail here.
    (c) => c.country,
    (c) => boundaryAt(c, countries)?.group ?? '',
  );

  // --- USA pool -----------------------------------------------------------

  const usaPool = src.features.filter((f) => {
    const p = f.properties;
    return (
      p.places?.some((pl) => pl.iso3166_1Alpha2 === 'US') &&
      p.status === 'operating' &&
      p.activities?.includes('downhill') &&
      !!p.name?.trim() &&
      liftCount(p.statistics) >= MIN_LIFTS &&
      verticalM(p.statistics) >= MIN_VERTICAL_M
    );
  });

  const usaCandidates: Candidate[] = [];
  const duplicates: string[] = [];
  for (const f of usaPool.sort(
    (a, b) => fameScore(b) - fameScore(a) || a.properties.id.localeCompare(b.properties.id),
  )) {
    const c = toCandidate(f);
    if (!c || !c.region || !regionForState(c.region)) continue;
    // A few areas appear as two OSM objects a couple hundred metres apart.
    // They share a name and their statistics, so keep whichever ranked higher.
    if (usaCandidates.some((x) => x.name === c.name && haversineKm(x, c) < DUPE_KM)) {
      duplicates.push(c.name);
      continue;
    }
    usaCandidates.push(c);
  }
  // Two genuinely different mountains do share a name (Crystal Mountain in both
  // Washington and Michigan), so qualify whatever still collides with its state.
  const counts = new Map<string, number>();
  for (const c of usaCandidates) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
  for (const c of usaCandidates) {
    if ((counts.get(c.name) ?? 0) > 1) c.name = `${c.name} (${c.region})`;
  }

  const usa = assignTiers(
    usaCandidates,
    [0.1, 0.26, 0.48, 0.72, 1],
    (c) => c.region,
    (c) => regionForState(c.region) ?? '',
  );
  if (duplicates.length) console.log(`deduplicated ${duplicates.length}: ${duplicates.join(', ')}`);

  // --- verify and write ---------------------------------------------------

  if (ikon.length !== IKON_DESTINATIONS.length) {
    fail(`Ikon: built ${ikon.length} of ${IKON_DESTINATIONS.length} destinations`);
  }
  if (usa.length < 450 || usa.length > 550) {
    fail(`USA: expected 450-550 resorts, got ${usa.length} — has the source schema changed?`);
  }
  // The Ikon list is 80 hand-checked entries, so every one must land in the
  // country it claims; the 497-strong US set tolerates a few border cases.
  checkPool('ikon', ikon, countries, 1);
  checkPool('usa', usa, states, 0.95);

  const SPOT_CHECKS: [string, number, number][] = [
    ['Alta Ski Area', 40.5806, -111.6249],
    ['Jackson Hole Mountain Resort', 43.6032, -110.85],
    ['Niseko United', 42.863, 140.6773],
    ['Valle Nevado', -33.3383, -70.25],
    ['Zermatt Matterhorn', 45.9598, 7.7023],
  ];
  for (const [name, lat, lng] of SPOT_CHECKS) {
    const r = ikon.find((x) => x.name === name);
    if (!r) fail(`spot check "${name}" is missing from the Ikon pool`);
    if (Math.max(Math.abs(r.lat - lat), Math.abs(r.lng - lng)) > 0.05) {
      fail(`spot check "${name}" moved to ${r.lat},${r.lng} (expected ~${lat},${lng})`);
    }
  }

  const write = (file: string, data: unknown) =>
    writeFileSync(resolve(ROOT, 'src/data', file), JSON.stringify(data) + '\n');
  write('resorts-ikon.json', ikon);
  write('resorts-usa.json', usa);
  write('countries.json', countries);
  write('states.json', states);

  const size = (p: string) => `${(statSync(resolve(ROOT, 'src/data', p)).size / 1024).toFixed(0)}KB`;
  console.log(`
  files          resorts-ikon ${size('resorts-ikon.json')}  resorts-usa ${size('resorts-usa.json')}  countries ${size('countries.json')}  states ${size('states.json')}
  ikon spread    ${new Set(ikon.map((r) => r.fine)).size} countries, ${new Set(ikon.map((r) => r.coarse)).size} continents
  ikon tier 1    ${ikon.filter((r) => r.tier === 1).slice(0, 5).map((r) => r.name).join(', ')}
  ikon tier 5    ${ikon.filter((r) => r.tier === 5).slice(0, 5).map((r) => r.name).join(', ')}
`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
