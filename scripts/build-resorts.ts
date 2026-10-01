/**
 * Build-time ETL: OpenSkiMap's worldwide ski-area dump -> the two small JSON
 * files the game actually ships.
 *
 *   src/data/resorts.json  ~500 US downhill areas, ranked and tiered
 *   src/data/states.json  US state outlines (drawn faintly, and used for
 *                            the "right state" scoring floor)
 *
 * Run with `npm run data`. The 20MB source is cached in .cache/ and never
 * reaches the browser.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { feature } from 'topojson-client';

import { haversineKm, stateAt, type StateCollection } from '../src/game/geo.ts';
import { regionForState } from '../src/game/regions.ts';
import type { Resort } from '../src/game/resorts.ts';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = resolve(ROOT, '.cache/ski_areas.geojson');
const SOURCE = 'https://tiles.openskimap.org/geojson/ski_areas.geojson';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Share of the ranked pool that falls in each tier. Round N draws from tier N. */
const TIER_CUTS = [0.1, 0.26, 0.48, 0.72, 1] as const;

/** Keeps out abandoned rope tows and mis-tagged nordic centres. */
const MIN_LIFTS = 1;
const MIN_VERTICAL_M = 30;

/** Same name within this radius means one mountain listed twice, not two areas. */
const DUPE_KM = 5;

// Coordinates are rounded to this many decimals. 3dp is ~110m: plenty for
// drawing a border and for deciding which state a click landed in.
const COORD_DP = 3;

const US_BBOX = { minLng: -180, maxLng: -66, minLat: 18, maxLat: 72 };

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

interface SkiAreaFeature {
  geometry: { type: string; coordinates: unknown };
  properties: {
    id: string;
    name?: string | null;
    status?: string | null;
    activities?: string[];
    wikidataID?: string | null;
    statistics?: SkiAreaStats;
    places?: { iso3166_1Alpha2?: string; localized?: { en?: { region?: string } } }[];
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

async function loadSource(): Promise<{ features: SkiAreaFeature[] }> {
  mkdirSync(dirname(CACHE), { recursive: true });
  let fresh = false;
  try {
    fresh = Date.now() - statSync(CACHE).mtimeMs < CACHE_MAX_AGE_MS;
  } catch {
    /* no cache yet */
  }
  if (!fresh) {
    process.stdout.write(`fetching ${SOURCE} ...`);
    const res = await fetch(SOURCE);
    if (!res.ok) throw new Error(`OpenSkiMap returned ${res.status} ${res.statusText}`);
    const body = Buffer.from(await res.arrayBuffer());
    writeFileSync(CACHE, body);
    console.log(` ${(body.length / 1e6).toFixed(1)}MB`);
  } else {
    console.log(`using cached ${CACHE}`);
  }
  return JSON.parse(readFileSync(CACHE, 'utf8')) as { features: SkiAreaFeature[] };
}

// --- state outlines ---------------------------------------------------------

function buildStates(): StateCollection {
  const topo = require('us-atlas/states-10m.json');
  const fc = feature(topo, topo.objects.states) as unknown as StateCollection;

  // us-atlas also ships `states-albers-10m.json`, whose coordinates are metres
  // in a projected CRS. Importing that one by mistake would silently break both
  // the map and every state lookup, so prove we got the lon/lat build.
  const [minLng, minLat, maxLng, maxLat] = topo.bbox as number[];
  const looksLikeLonLat =
    minLng! >= -180 && maxLng! <= 180 && minLat! >= -90 && maxLat! <= 90;
  if (!looksLikeLonLat) {
    throw new Error(
      `states-10m.json is not WGS84 lon/lat (bbox ${topo.bbox}). Did us-atlas ship the Albers build?`,
    );
  }

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

// --- main -------------------------------------------------------------------

function fail(msg: string): never {
  console.error(`\n  FAILED: ${msg}\n`);
  process.exit(1);
}

async function main() {
  const states = buildStates();
  console.log(`states: ${states.features.length} features`);

  const src = await loadSource();
  console.log(`source: ${src.features.length} ski areas worldwide`);

  const pool = src.features.filter((f) => {
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

  // Rank by fame, most famous first; tier boundaries then fall out of rank.
  const ranked = pool
    .map((f) => ({ f, fame: fameScore(f) }))
    .sort((a, b) => b.fame - a.fame || a.f.properties.id.localeCompare(b.f.properties.id));

  // Resolve every ranked feature to a usable record, dropping the ones we can't
  // place on a map and the handful of mountains OpenSkiMap lists twice.
  type Candidate = Omit<Resort, 'tier'>;
  const candidates: Candidate[] = [];
  const skipped: string[] = [];
  const duplicates: string[] = [];

  for (const { f } of ranked) {
    const p = f.properties;
    const name = p.name!.trim();
    const state = p.places?.find((pl) => pl.iso3166_1Alpha2 === 'US')?.localized?.en?.region;
    const region = regionForState(state ?? null);
    const coords = centroid(f.geometry);

    if (!state || !region || !coords) {
      skipped.push(`${name} (${state ?? 'no state'}${region ? '' : ', unmapped region'})`);
      continue;
    }

    const lat = round(coords[1], 5);
    const lng = round(coords[0], 5);

    // A few areas appear as two OSM objects a couple hundred metres apart.
    // They share a name and their statistics, so keep whichever ranked higher.
    if (candidates.some((c) => c.name === name && haversineKm(c, { lat, lng }) < DUPE_KM)) {
      duplicates.push(name);
      continue;
    }

    candidates.push({
      id: p.id,
      name,
      state,
      region,
      lat,
      lng,
      lifts: liftCount(p.statistics),
      verticalM: verticalM(p.statistics),
    });
  }

  // Two genuinely different mountains do share a name (Crystal Mountain in both
  // Washington and Michigan). A bare prompt would be unanswerable, so once the
  // duplicates are gone, qualify whatever still collides with its state.
  const nameCounts = new Map<string, number>();
  for (const c of candidates) nameCounts.set(c.name, (nameCounts.get(c.name) ?? 0) + 1);

  const resorts: Resort[] = candidates.map((c, i) => {
    const frac = (i + 1) / candidates.length;
    return {
      ...c,
      name: (nameCounts.get(c.name) ?? 0) > 1 ? `${c.name} (${c.state})` : c.name,
      tier: ((TIER_CUTS.findIndex((cut) => frac <= cut) + 1) || 5) as Resort['tier'],
    };
  });

  if (duplicates.length) {
    console.log(`deduplicated ${duplicates.length}: ${duplicates.join(', ')}`);
  }
  if (skipped.length) {
    console.log(`skipped ${skipped.length}: ${skipped.slice(0, 5).join(', ')}`);
  }

  // --- assertions ---------------------------------------------------------

  if (resorts.length < 450 || resorts.length > 550) {
    fail(`expected 450-550 resorts, got ${resorts.length} — has the source schema changed?`);
  }

  for (const r of resorts) {
    if (
      r.lng < US_BBOX.minLng ||
      r.lng > US_BBOX.maxLng ||
      r.lat < US_BBOX.minLat ||
      r.lat > US_BBOX.maxLat
    ) {
      fail(`${r.name} is outside the US bbox at ${r.lat},${r.lng} — lat/lng swapped?`);
    }
  }

  const unique = new Set(resorts.map((r) => r.name)).size;
  if (unique !== resorts.length) {
    const dupe = resorts.find((r, i) => resorts.findIndex((x) => x.name === r.name) !== i);
    fail(`resort names are not unique (e.g. "${dupe?.name}") — a prompt would be unanswerable`);
  }

  const tiers = [1, 2, 3, 4, 5].map((t) => resorts.filter((r) => r.tier === t).length);
  if (tiers.some((n) => n < 30)) {
    fail(`a tier is too small to avoid repeats: ${tiers.join('/')}`);
  }

  // Each resort's own coordinates should fall inside its own state. A lat/lng
  // swap, a bad boundary file, or a stale region map all show up here.
  const mismatched = resorts.filter((r) => stateAt(r, states) !== r.state);
  const agreement = 1 - mismatched.length / resorts.length;
  if (agreement < 0.95) {
    fail(
      `only ${(agreement * 100).toFixed(1)}% of resorts geocode back to their own state ` +
        `(e.g. ${mismatched.slice(0, 3).map((r) => `${r.name} -> ${stateAt(r, states)}`).join('; ')})`,
    );
  }

  const SPOT_CHECKS: [string, number, number][] = [
    ['Alta Ski Area', 40.5806, -111.6249],
    ['Jackson Hole Mountain Resort', 43.6032, -110.85],
    ['Vail', 39.6061, -106.3517],
    ['Killington Resort', 43.6417, -72.8],
    ['Alyeska Resort', 60.9619, -149.0867],
  ];
  for (const [name, lat, lng] of SPOT_CHECKS) {
    const r = resorts.find((x) => x.name === name);
    if (!r) fail(`spot check "${name}" is missing from the pool`);
    const off = Math.max(Math.abs(r.lat - lat), Math.abs(r.lng - lng));
    if (off > 0.05) {
      fail(`spot check "${name}" moved to ${r.lat},${r.lng} (expected ~${lat},${lng})`);
    }
  }

  // --- write --------------------------------------------------------------

  writeFileSync(resolve(ROOT, 'src/data/resorts.json'), JSON.stringify(resorts) + '\n');
  writeFileSync(resolve(ROOT, 'src/data/states.json'), JSON.stringify(states) + '\n');

  const size = (p: string) => `${(statSync(resolve(ROOT, p)).size / 1024).toFixed(0)}KB`;
  const hash = createHash('sha1').update(JSON.stringify(resorts)).digest('hex').slice(0, 8);

  console.log(`
  resorts        ${resorts.length} across ${new Set(resorts.map((r) => r.state)).size} states  (${size('src/data/resorts.json')}, ${hash})
  tiers          ${tiers.join(' / ')}
  state lookup   ${(agreement * 100).toFixed(1)}% agreement
  outlines       ${size('src/data/states.json')}

  tier 1 sample  ${resorts.filter((r) => r.tier === 1).slice(0, 6).map((r) => r.name).join(', ')}
  tier 5 sample  ${resorts.filter((r) => r.tier === 5).slice(0, 4).map((r) => r.name).join(', ')}
`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
