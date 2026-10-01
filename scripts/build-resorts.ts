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
import { EPIC_DESTINATIONS } from './epic-destinations.ts';
import { IKON_DESTINATIONS, type IkonDestination } from './ikon-destinations.ts';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'https://tiles.openskimap.org/geojson/ski_areas.geojson';
const LIFTS_SOURCE = 'https://tiles.openskimap.org/geojson/lifts.geojson';

/**
 * A pin is the ski area's summit — the top station of its highest lift —
 * rather than wherever OpenSkiMap happens to put the area itself, which is
 * often the base village. The summit must still be on the same mountain:
 * further than this from the area's own geometry means a mis-linked lift.
 */
const PEAK_MAX_KM = 12;
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

// --- peaks --------------------------------------------------------------------

interface LiftFeature {
  geometry: { type: string; coordinates: number[][] };
  properties: { status?: string | null; skiAreas?: { properties?: { id?: string } }[] };
}

export interface Peak {
  lat: number;
  lng: number;
  ele: number;
}

/**
 * The highest point reachable by lift in each ski area, from OpenSkiMap's
 * lifts dump: every lift is a 3D line, so its top station is simply its
 * highest coordinate, and the area's peak is the highest of those.
 */
async function loadPeaks(): Promise<Map<string, Peak>> {
  const raw = JSON.parse(await cached(LIFTS_SOURCE, 'lifts.geojson', 'OpenSkiMap lifts')) as {
    features: LiftFeature[];
  };
  const peaks = new Map<string, Peak>();
  for (const lift of raw.features) {
    if (lift.geometry.type !== 'LineString' || lift.properties.status === 'abandoned') continue;
    let top: number[] | null = null;
    for (const c of lift.geometry.coordinates) {
      if (c.length >= 3 && (top === null || c[2]! > top[2]!)) top = c;
    }
    if (!top) continue;
    for (const area of lift.properties.skiAreas ?? []) {
      const id = area.properties?.id;
      if (!id) continue;
      const cur = peaks.get(id);
      if (!cur || top[2]! > cur.ele) peaks.set(id, { lng: top[0]!, lat: top[1]!, ele: top[2]! });
    }
  }
  return peaks;
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

/**
 * The world boundary file, with the United States replaced by its states so
 * the global pool can award a "right state" floor. Each state feature carries
 * all three levels — state, country, continent — and every other country
 * carries two. Other countries' provinces would slot in the same way given
 * admin-1 geometry for them.
 */
async function buildWorld(states: BoundaryCollection): Promise<BoundaryCollection> {
  const raw = JSON.parse(
    await cached(COUNTRIES_SOURCE, 'ne_50m_countries.geojson', 'Natural Earth countries'),
  ) as {
    features: { properties: Record<string, string>; geometry: unknown }[];
  };
  const countries = raw.features
    // Antarctica has no Ikon destinations and a vast, jagged coastline.
    .filter((f) => f.properties.CONTINENT !== 'Antarctica')
    .map((f) => ({
      type: 'Feature' as const,
      properties: {
        name: countryName(f.properties.NAME_EN || f.properties.ADMIN || f.properties.NAME || ''),
        group: f.properties.CONTINENT ?? '',
      },
      geometry: f.geometry,
    }))
    .filter((f) => f.properties.name !== 'United States');

  // Simplify through topology so shared borders stay shared — simplifying each
  // country on its own would tear gaps and overlaps along every frontier.
  const pre = presimplify(topology({ c: { type: 'FeatureCollection', features: countries } }));
  const topo = simplify(pre, quantile(pre, BOUNDARY_DETAIL));
  const world = roundCoords(feature(topo, topo.objects.c!) as unknown as BoundaryCollection);

  // us-atlas states are already lon/lat and already simplified; retag them for
  // the world file's three-level scheme and append.
  for (const st of states.features) {
    world.features.push({
      ...st,
      properties: { region: st.properties.name, name: 'United States', group: 'North America' },
    });
  }
  return world;
}

// --- resorts ----------------------------------------------------------------

type Candidate = Omit<Resort, 'tier' | 'fine' | 'coarse' | 'region'> & {
  fame: number;
  /** OpenSkiMap's own country and admin region — the authority for the floors. */
  country: string;
  region: string;
  /** Whether the pin is the lift-served summit rather than the area geometry. */
  atPeak: boolean;
};

function toCandidate(
  f: SkiAreaFeature,
  peaks: Map<string, Peak>,
  world: BoundaryCollection,
): Candidate | null {
  const coords = centroid(f.geometry);
  const name = f.properties.name?.trim();
  if (!coords || !name) return null;
  const place = f.properties.places?.[0];
  const country = countryName(place?.localized?.en?.country ?? '');

  // Prefer the summit, with two guards. A peak more than PEAK_MAX_KM from the
  // area's own geometry is a lift mis-linked to the wrong area. And a peak the
  // boundary file puts in a different country from the area is a border
  // resort whose top lift ends on the frontier — Grandvalira's highest station
  // sits on the Andorra–France ridge — so keep the base rather than relabel
  // the whole destination.
  const peak = peaks.get(f.properties.id);
  const base = { lat: coords[1]!, lng: coords[0]! };
  const usePeak =
    !!peak &&
    haversineKm(base, peak) <= PEAK_MAX_KM &&
    (boundaryAt(peak, world)?.name ?? country) === country;
  const pin = usePeak ? peak : base;

  return {
    id: f.properties.id,
    name: displayName(name),
    place: placeLabel(place),
    lat: round(pin.lat, 5),
    lng: round(pin.lng, 5),
    atPeak: usePeak,
    lifts: liftCount(f.properties.statistics),
    verticalM: verticalM(f.properties.statistics),
    fame: fameScore(f),
    country,
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
  region: (c: Candidate) => string | undefined = () => undefined,
): Resort[] {
  return ordered.map((c, i) => {
    const frac = (i + 1) / ordered.length;
    const { fame: _fame, country: _country, region: _region, atPeak: _atPeak, ...rest } = c;
    const sub = region(c);
    return {
      ...rest,
      ...(sub ? { region: sub } : {}),
      fine: fine(c),
      coarse: coarse(c),
      tier: ((cuts.findIndex((cut) => frac <= cut) + 1) || cuts.length) as Resort['tier'],
    };
  });
}

/** The longest a player should go without seeing the same two mountains together. */
const MIN_PAIR_DAYS = 60;

/**
 * Cumulative fractions for explicit tier sizes. Fails loudly if the sizes do
 * not add up to the pool, or if any two tiers would realign within
 * MIN_PAIR_DAYS — that is the property the daily schedule rests on, and it
 * must not regress silently when the list changes length.
 */
function cutsFor(total: number, sizes: readonly number[]): number[] {
  const sum = sizes.reduce((a, b) => a + b, 0);
  if (sum !== total) fail(`tier sizes ${sizes.join('+')} = ${sum}, but the pool has ${total}`);
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  for (let i = 0; i < sizes.length; i++) {
    for (let j = i + 1; j < sizes.length; j++) {
      const a = sizes[i]!;
      const b = sizes[j]!;
      const period = (a * b) / gcd(a, b);
      if (period < MIN_PAIR_DAYS) {
        fail(`tiers of ${a} and ${b} realign every ${period} days (< ${MIN_PAIR_DAYS})`);
      }
    }
  }
  let acc = 0;
  return sizes.map((n) => (acc += n) / total);
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
  const countries = await buildWorld(states);
  console.log(
    `boundaries: ${states.features.length} states, ${countries.features.length} world features`,
  );

  const src = JSON.parse(await cached(SOURCE, 'ski_areas.geojson', 'OpenSkiMap')) as {
    features: SkiAreaFeature[];
  };
  console.log(`source: ${src.features.length} ski areas worldwide\n`);

  const byId = new Map(src.features.map((f) => [f.properties.id, f] as const));
  const peaks = await loadPeaks();
  console.log(`peaks: lift-served summits for ${peaks.size} ski areas\n`);

  // --- pass pools ----------------------------------------------------------

  /**
   * Resolve a curated, ranked destination list against OpenSkiMap. The list's
   * order is the difficulty ranking and nothing here reorders it.
   */
  function buildPassPool(
    label: string,
    list: readonly IkonDestination[],
    sizes: readonly number[],
  ): Resort[] {
    const cands: Candidate[] = [];
    const seen = new Set<string>();
    for (const dest of list) {
      const matches = [...byId.values()].filter((f) => f.properties.id.startsWith(dest.osm));
      if (matches.length !== 1) {
        fail(
          `${label}: "${dest.name}" prefix ${dest.osm} matched ${matches.length} ski areas` +
            (matches.length ? ` (${matches.map((m) => m.properties.name).join(', ')})` : ''),
        );
      }
      const f = matches[0]!;
      // Two destinations may share an OpenSkiMap area only when at least one of
      // them pins its own coordinates; otherwise they would be the same question.
      if (seen.has(f.properties.id) && !dest.at) {
        fail(`${label}: "${dest.name}" reuses another destination's area without an \`at\` override`);
      }
      seen.add(f.properties.id);

      const c = toCandidate(f, peaks, countries);
      if (!c) fail(`${label}: "${dest.name}" has no usable geometry`);

      if (dest.at) {
        // A pinned destination takes its country from where the pin lands, not
        // from the shared area it borrowed its id from — Cervinia's area is
        // registered in Switzerland. The pin is hand-placed, so the polygon
        // lookup is the ground truth here rather than something to check.
        const hit = boundaryAt({ lat: dest.at[0], lng: dest.at[1] }, countries);
        if (!hit) fail(`${label}: "${dest.name}" is pinned at sea (${dest.at})`);
        cands.push({
          ...c,
          // The id is a resort's identity everywhere downstream — distinct
          // questions, the no-repeat cycle, saved games — so a pin that borrows
          // another destination's area cannot borrow its id as well.
          id: `${c.id}#${dest.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          name: dest.name,
          lat: dest.at[0],
          lng: dest.at[1],
          atPeak: true,
          country: hit.name,
          place: hit.name,
        });
        peakCount.n++;
        continue;
      }

      const place = f.properties.places?.[0];
      if (place?.iso3166_1Alpha2 !== dest.cc) {
        fail(
          `${label}: "${dest.name}" resolved to ${f.properties.name} in ` +
            `${place?.iso3166_1Alpha2 ?? 'nowhere'}, expected ${dest.cc}`,
        );
      }
      // The list's own name wins over OpenSkiMap's — the player is being asked
      // to find "Jackson Hole", not an OSM object.
      if (c.atPeak) peakCount.n++;
      cands.push({ ...c, name: dest.name });
    }

    // Tier sizes are chosen so no two tiers realign within MIN_PAIR_DAYS; see
    // cutsFor. Each tier is a fixed cycle indexed by day, so two tiers of the
    // same size would bring the same pairs of mountains round together forever.
    return assignTiers(
      cands,
      cutsFor(cands.length, sizes),
      (c) => c.country,
      (c) => boundaryAt(c, countries)?.group ?? '',
      // The state rung only exists where the world file has state polygons, so
      // read it from the polygon rather than from OpenSkiMap's region string —
      // the two must agree for the floor to ever fire.
      (c) => boundaryAt(c, countries)?.region,
    );
  }

  const peakCount = { n: 0 };
  const ikon = buildPassPool('Ikon', IKON_DESTINATIONS, [11, 13, 15, 16, 18]);
  const ikonPeaks = peakCount.n;
  peakCount.n = 0;
  const epic = buildPassPool('Epic', EPIC_DESTINATIONS, [9, 10, 13, 14, 16]);
  const epicPeaks = peakCount.n;

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
  let usaPeaks = 0;
  for (const f of usaPool.sort(
    (a, b) => fameScore(b) - fameScore(a) || a.properties.id.localeCompare(b.properties.id),
  )) {
    const c = toCandidate(f, peaks, countries);
    if (!c || !c.region || !regionForState(c.region)) continue;
    // A few areas appear as two OSM objects a couple hundred metres apart.
    // They share a name and their statistics, so keep whichever ranked higher.
    if (usaCandidates.some((x) => x.name === c.name && haversineKm(x, c) < DUPE_KM)) {
      duplicates.push(c.name);
      continue;
    }
    if (c.atPeak) usaPeaks++;
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
  if (epic.length !== EPIC_DESTINATIONS.length) {
    fail(`Epic: built ${epic.length} of ${EPIC_DESTINATIONS.length} destinations`);
  }
  if (usa.length < 450 || usa.length > 550) {
    fail(`USA: expected 450-550 resorts, got ${usa.length} — has the source schema changed?`);
  }
  // The Ikon list is 80 hand-checked entries, so every one must land in the
  // country it claims; the 497-strong US set tolerates a few border cases.
  checkPool('ikon', ikon, countries, 1);
  checkPool('epic', epic, countries, 1);
  checkPool('usa', usa, states, 0.95);

  // Pins are summits now. Each must sit near the mountain's known top: the
  // pairs here are the real summit coordinates, and a pin drifting more than
  // ~3km from one means the lift linkage changed underneath us.
  const SPOT_CHECKS: [Resort[], string, number, number][] = [
    [ikon, 'Alta', 40.5665, -111.6285], // Mount Baldy / Sugarloaf ridge
    [ikon, 'Jackson Hole', 43.5929, -110.8737], // Rendezvous Mountain
    [ikon, 'Zermatt', 45.9836, 7.7853], // Gornergrat
    [ikon, 'Cervinia', 45.9345, 7.7076], // Testa Grigia / Plateau Rosa
    [epic, 'Vail', 39.573, -106.3079], // Blue Sky Basin, top of Pete's Express
    [epic, 'Whistler Blackcomb', 50.0947, -122.8767], // Blackcomb Glacier, top of the Showcase T-bar
  ];
  for (const [pool, name, lat, lng] of SPOT_CHECKS) {
    const r = pool.find((x) => x.name === name);
    if (!r) fail(`spot check "${name}" is missing`);
    const km = haversineKm(r, { lat, lng });
    if (km > 3) fail(`spot check "${name}" sits ${km.toFixed(1)}km from its summit (${r.lat},${r.lng})`);
  }

  const write = (file: string, data: unknown) =>
    writeFileSync(resolve(ROOT, 'src/data', file), JSON.stringify(data) + '\n');
  write('resorts-ikon.json', ikon);
  write('resorts-epic.json', epic);
  write('resorts-usa.json', usa);
  write('countries.json', countries);
  write('states.json', states);

  const size = (p: string) => `${(statSync(resolve(ROOT, 'src/data', p)).size / 1024).toFixed(0)}KB`;
  console.log(`
  files          ikon ${size('resorts-ikon.json')}  epic ${size('resorts-epic.json')}  usa ${size('resorts-usa.json')}  countries ${size('countries.json')}  states ${size('states.json')}
  summits        ikon ${ikonPeaks}/${ikon.length}  epic ${epicPeaks}/${epic.length}  usa ${usaPeaks}/${usa.length}
  ikon spread    ${new Set(ikon.map((r) => r.fine)).size} countries, ${new Set(ikon.map((r) => r.coarse)).size} continents, ${ikon.filter((r) => r.region).length} with a state rung
  epic spread    ${new Set(epic.map((r) => r.fine)).size} countries, ${new Set(epic.map((r) => r.coarse)).size} continents, ${epic.filter((r) => r.region).length} with a state rung
  epic tier 1    ${epic.filter((r) => r.tier === 1).slice(0, 5).map((r) => r.name).join(', ')}
  epic tier 5    ${epic.filter((r) => r.tier === 5).slice(-5).map((r) => r.name).join(', ')}
`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
