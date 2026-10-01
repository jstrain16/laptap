// Geometry helpers shared by the runtime and the build-time ETL.

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const KM_PER_MILE = 1.609344;
export const kmToMiles = (km: number) => km / KM_PER_MILE;

// --- point-in-polygon -------------------------------------------------------

type Ring = number[][]; // [[lng, lat], ...]

/**
 * Ray casting against a single ring. Counts crossings of a horizontal ray cast
 * east from the point; odd means inside.
 */
function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = ring[i]!;
    const pj = ring[j]!;
    const [xi, yi] = [pi[0]!, pi[1]!];
    const [xj, yj] = [pj[0]!, pj[1]!];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** A polygon is its outer ring minus any holes. */
function pointInPolygon(lng: number, lat: number, rings: Ring[]): boolean {
  const outer = rings[0];
  if (!outer || !pointInRing(lng, lat, outer)) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i]!)) return false; // in a hole
  }
  return true;
}

/**
 * One administrative shape, tagged with up to three nested labels, finest
 * first: `region` (a state, where the pool has state-level data), `name` (a
 * country — or a state, in the US pool) and `group` (a continent, or a ski
 * region). Both pools use the same shape, so the scoring floors are written
 * once and each pool just declares which levels it has.
 */
export interface BoundaryFeature {
  type: 'Feature';
  properties: { region?: string; name: string; group: string };
  bbox?: [number, number, number, number];
  geometry:
    | { type: 'Polygon'; coordinates: Ring[] }
    | { type: 'MultiPolygon'; coordinates: Ring[][] };
}

export interface BoundaryCollection {
  type: 'FeatureCollection';
  features: BoundaryFeature[];
}

function bboxOf(f: BoundaryFeature): [number, number, number, number] {
  if (f.bbox) return f.bbox;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const polys =
    f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const rings of polys) {
    for (const p of rings[0] ?? []) {
      const x = p[0]!;
      const y = p[1]!;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  f.bbox = [minX, minY, maxX, maxY];
  return f.bbox;
}

/**
 * Which boundary contains this point, or null if it is out at sea. The bbox
 * pre-filter keeps this cheap enough to call on every click.
 */
export function boundaryAt(
  point: LatLng,
  boundaries: BoundaryCollection,
): BoundaryFeature['properties'] | null {
  for (const f of boundaries.features) {
    const [minX, minY, maxX, maxY] = bboxOf(f);
    if (point.lng < minX || point.lng > maxX || point.lat < minY || point.lat > maxY) {
      continue;
    }
    const polys =
      f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const rings of polys) {
      if (pointInPolygon(point.lng, point.lat, rings)) return f.properties;
    }
  }
  return null;
}
