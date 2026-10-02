/**
 * Build-time ETL for the runs mode: for every mountain in the two pass lists,
 * pull its ski runs and lifts out of OpenSkiMap and write one compact file per
 * mountain, plus an index of the mountains with enough named runs to quiz on.
 *
 *   public/runs/<id8>.json     one mountain's trail map: runs, lifts, bounds
 *   src/data/runs-index.json   the mountains the game is built for
 *
 * Run with `npm run runs`. The runs dump is ~800MB — too large for V8 to hold
 * as one string — so it is streamed a line at a time; conveniently OpenSkiMap
 * writes one feature per line.
 */
import { createReadStream, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { haversineKm } from '../src/game/geo.ts';
import { EPIC_DESTINATIONS } from './epic-destinations.ts';
import { IKON_DESTINATIONS } from './ikon-destinations.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = resolve(ROOT, '.cache');
const OUT = resolve(ROOT, 'public/runs');

/** A mountain needs this many distinct, askable run names to be a puzzle. */
const MIN_NAMED_RUNS = 20;

/**
 * The only mountains the runs game is built for. It is a test of the mode on
 * two hills, not a rollout: nothing is generated for any other mountain.
 * Names are as written in the pass lists.
 */
const LIVE: string[] = ['Alta', 'Mount Snow'];

/** Douglas–Peucker tolerance. Four metres is invisible at trail-map zoom. */
const SIMPLIFY_M = 4;

type Line = [number, number][];

export interface RunsFile {
  id: string;
  name: string;
  /** Which colour scheme the resort's own trail map uses. */
  convention: 'north_america' | 'europe' | 'japan';
  /** [west, south, east, north] */
  bounds: [number, number, number, number];
  /**
   * Compass bearing of "uphill", in degrees. A trail map is drawn facing the
   * mountain — base at the bottom, summit at the top — so this is the bearing
   * the map is rotated to.
   */
  bearing: number;
  /** Lowest and highest run elevation in metres — sets the forest-to-snow colour ramp. */
  elev: [number, number];
  /** Named runs — the questions. Segments sharing a name are one run. */
  runs: { n: string; d: string; len: number; l: Line[]; area?: true }[];
  /** Unnamed runs, drawn for context but never asked about. */
  extra: { d: string; l: Line[] }[];
  lifts: Line[];
}

const r5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Perpendicular distance in metres from p to segment a–b (flat-earth, fine at this scale). */
function segDistM(p: number[], a: number[], b: number[]): number {
  const k = Math.cos((p[1]! * Math.PI) / 180);
  const ax = (a[0]! - p[0]!) * k, ay = a[1]! - p[1]!;
  const bx = (b[0]! - p[0]!) * k, by = b[1]! - p[1]!;
  const dx = bx - ax, dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy) * 111_320;
}

function simplify(pts: number[][]): Line {
  if (pts.length <= 2) return pts.map((p) => [r5(p[0]!), r5(p[1]!)]);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    let worst = 0, at = -1;
    for (let k = i + 1; k < j; k++) {
      const d = segDistM(pts[k]!, pts[i]!, pts[j]!);
      if (d > worst) { worst = d; at = k; }
    }
    if (worst > SIMPLIFY_M) { keep[at] = 1; stack.push([i, at], [at, j]); }
  }
  return pts.filter((_, k) => keep[k]).map((p) => [r5(p[0]!), r5(p[1]!)]);
}

const lengthM = (l: Line) =>
  l.reduce((m, p, i) => (i ? m + haversineKm({ lng: l[i - 1]![0], lat: l[i - 1]![1] }, { lng: p[0], lat: p[1] }) * 1000 : 0), 0);

/**
 * A run name an English-speaking player can be asked about: the first
 * comma-separated segment written in Latin script, if there is one.
 */
function askable(raw: string | null | undefined): string | null {
  // Mappers sometimes append notes to a name — Alta's "Summer Road (Uphill
  // Acces)" — which are about the OSM way, not what the trail is called.
  const cleaned = (raw ?? '').replace(/\s*\([^)]*(uphill|access?)[^)]*\)/gi, '');
  // Service roads get tagged as runs too. "Condo & Bypas Road Parking Access"
  // is on Alta's map, but it is not a run anyone should be asked to find; it
  // stays on the map as unnamed context.
  if (/\b(parking|access)\b/i.test(cleaned)) return null;
  for (const part of cleaned.split(',').map((s) => s.trim())) {
    const letters = part.replace(/[^\p{L}]/gu, '');
    if (letters.length >= 2 && /^[\p{Script=Latin}]+$/u.test(letters)) return part;
  }
  return null;
}

async function main() {
  const areas = JSON.parse(readFileSync(resolve(CACHE, 'ski_areas.geojson'), 'utf8')).features as {
    properties: { id: string };
  }[];

  // Every mountain in either pass list, once. Zermatt and Cervinia share an
  // area, as does Hakuba across the two lists; the first name listed wins.
  const targets = new Map<string, string>();
  for (const d of [...IKON_DESTINATIONS, ...EPIC_DESTINATIONS]) {
    if (!LIVE.includes(d.name)) continue;
    const f = areas.find((a) => a.properties.id.startsWith(d.osm));
    if (f && !targets.has(f.properties.id)) targets.set(f.properties.id, d.name);
  }
  if (targets.size !== LIVE.length) {
    throw new Error(`resolved ${targets.size} of ${LIVE.length} live mountains (${LIVE.join(', ')})`);
  }

  type Acc = {
    named: Map<string, { diffs: Map<string, number>; lines: Line[]; area: boolean }>;
    extra: Map<string, Line[]>;
    conv: Map<string, number>;
    lifts: Line[];
    /** Sum of every run's bottom-to-top vector, in metres east and north. */
    up: [number, number];
    elev: [number, number];
  };
  const acc = new Map<string, Acc>();
  for (const id of targets.keys()) {
    acc.set(id, { named: new Map(), extra: new Map(), conv: new Map(), lifts: [], up: [0, 0], elev: [Infinity, -Infinity] });
  }

  // --- runs (streamed) ------------------------------------------------------
  const ids = [...targets.keys()];
  const rl = createInterface({ input: createReadStream(resolve(CACHE, 'runs.geojson')), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.startsWith('{"type":"Feature"') || !line.includes('"downhill"')) continue;
    // A substring test is far cheaper than parsing 230,000 features.
    if (!ids.some((id) => line.includes(id))) continue;
    const f = JSON.parse(line) as {
      geometry: { type: string; coordinates: unknown };
      properties: {
        name?: string | null; status?: string; uses?: string[]; difficulty?: string | null;
        difficultyConvention?: string; skiAreas?: { properties?: { id?: string } }[];
      };
    };
    const p = f.properties;
    if (p.status !== 'operating' || !p.uses?.includes('downhill')) continue;

    const isArea = f.geometry.type === 'Polygon';
    const raw = isArea
      ? ((f.geometry.coordinates as number[][][])[0] ?? [])
      : f.geometry.type === 'LineString'
        ? (f.geometry.coordinates as number[][])
        : [];
    if (raw.length < 2) continue;

    // Which way is up for this run: the vector from its lowest point to its
    // highest. Summed over a whole mountain these give the direction the
    // slopes climb, with long runs counting for more than short ones.
    let hi = raw[0]!;
    let lo = raw[0]!;
    for (const c of raw) {
      if ((c[2] ?? 0) > (hi[2] ?? 0)) hi = c;
      if ((c[2] ?? 0) < (lo[2] ?? 0)) lo = c;
    }
    const east = (hi[0]! - lo[0]!) * Math.cos((lo[1]! * Math.PI) / 180) * 111_320;
    const north = (hi[1]! - lo[1]!) * 110_540;

    const geom = simplify(raw);
    const diff = p.difficulty ?? 'unknown';
    const name = askable(p.name);

    for (const a of p.skiAreas ?? []) {
      const t = acc.get(a.properties?.id ?? '');
      if (!t) continue;
      t.up[0] += east;
      t.up[1] += north;
      if (lo[2] != null && lo[2] < t.elev[0]) t.elev[0] = lo[2];
      if (hi[2] != null && hi[2] > t.elev[1]) t.elev[1] = hi[2];
      if (p.difficultyConvention) t.conv.set(p.difficultyConvention, (t.conv.get(p.difficultyConvention) ?? 0) + 1);
      if (name) {
        const e = t.named.get(name) ?? {
          diffs: new Map<string, number>(),
          lines: [] as Line[],
          area: false,
        };
        e.lines.push(geom);
        e.diffs.set(diff, (e.diffs.get(diff) ?? 0) + 1);
        e.area ||= isArea;
        t.named.set(name, e);
      } else {
        t.extra.set(diff, [...(t.extra.get(diff) ?? []), geom]);
      }
    }
  }

  // --- lifts ------------------------------------------------------------------
  const lifts = JSON.parse(readFileSync(resolve(CACHE, 'lifts.geojson'), 'utf8')).features as {
    geometry: { type: string; coordinates: number[][] };
    properties: { status?: string; skiAreas?: { properties?: { id?: string } }[] };
  }[];
  for (const lift of lifts) {
    if (lift.geometry.type !== 'LineString' || lift.properties.status !== 'operating') continue;
    for (const a of lift.properties.skiAreas ?? []) {
      acc.get(a.properties?.id ?? '')?.lifts.push(simplify(lift.geometry.coordinates));
    }
  }

  // --- write ------------------------------------------------------------------
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const top = <K>(m: Map<K, number>) => [...m].sort((a, b) => b[1] - a[1])[0]?.[0];

  const index: { id: string; name: string; runs: number }[] = [];
  const facing: string[] = [];
  const skipped: string[] = [];
  let bytes = 0;

  for (const [id, name] of targets) {
    const t = acc.get(id)!;
    if (t.named.size < MIN_NAMED_RUNS) {
      skipped.push(`${name} (${t.named.size})`);
      continue;
    }
    const runs = [...t.named].map(([n, e]) => ({
      n,
      d: top(e.diffs) ?? 'unknown',
      // A polygon's ring runs round the slope, so half of it is the way down.
      len: Math.round(e.lines.reduce((m, l) => m + lengthM(l), 0) / (e.area ? 2 : 1)),
      l: e.lines,
      ...(e.area ? { area: true as const } : {}),
    }));

    let w = 180, s = 90, e = -180, n = -90;
    const grow = (l: Line) => { for (const [x, y] of l) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; } };
    runs.forEach((r) => r.l.forEach(grow));
    t.lifts.forEach(grow);

    const conv = top(t.conv);
    const file: RunsFile = {
      id: id.slice(0, 8),
      name,
      convention: conv === 'europe' || conv === 'japan' ? conv : 'north_america',
      bounds: [r5(w), r5(s), r5(e), r5(n)],
      bearing: Math.round(((Math.atan2(t.up[0], t.up[1]) * 180) / Math.PI + 360) % 360),
      elev: [Math.round(t.elev[0]), Math.round(t.elev[1])],
      runs,
      extra: [...t.extra].map(([d, l]) => ({ d, l })),
      lifts: t.lifts,
    };
    const body = JSON.stringify(file);
    writeFileSync(resolve(OUT, `${file.id}.json`), body);
    bytes += body.length;
    index.push({ id: file.id, name, runs: runs.length });
    facing.push(`${name} climbs towards ${file.bearing}°, ${file.elev[0]}–${file.elev[1]}m`);
  }

  if (skipped.length) {
    throw new Error(`a live mountain has too few named runs: ${skipped.join(', ')}`);
  }

  writeFileSync(resolve(ROOT, 'src/data/runs-index.json'), JSON.stringify(index) + '\n');

  console.log(`
  mountains      ${index.map((m) => `${m.name} (${m.runs} named runs)`).join(', ')}
  facing         ${facing.join(', ')}
  files          ${(bytes / 1e3).toFixed(0)}KB in public/runs/
`);
}

main().catch((e) => {
  console.error(`\n  FAILED: ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
