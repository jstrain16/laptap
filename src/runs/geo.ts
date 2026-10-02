import type { LatLng } from '../game/geo.js';
import type { Line, Run } from './types.js';

const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LNG = 111_320;

/** Even-odd test of a point against one closed ring. */
function inRing(p: LatLng, ring: Line): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export interface Nearest {
  meters: number;
  /** The closest point on the run, for drawing the line of shame. */
  point: LatLng;
}

/**
 * How far a tap is from a run, and where on the run is closest. A resort is a
 * few kilometres across, so a flat local projection centred on the tap is
 * accurate to well under a metre — no great-circle maths needed.
 *
 * A run mapped as an area (a bowl, a wide slope) counts as hit anywhere
 * inside it.
 */
export function nearestOnRun(p: LatLng, run: Run): Nearest {
  if (run.area && run.l.some((ring) => inRing(p, ring))) return { meters: 0, point: p };

  const k = Math.cos((p.lat * Math.PI) / 180) * M_PER_DEG_LNG;
  let best = Infinity;
  let bx = 0;
  let by = 0;
  for (const line of run.l) {
    for (let i = 0; i < line.length - 1; i++) {
      const ax = (line[i]![0] - p.lng) * k;
      const ay = (line[i]![1] - p.lat) * M_PER_DEG_LAT;
      const dx = (line[i + 1]![0] - p.lng) * k - ax;
      const dy = (line[i + 1]![1] - p.lat) * M_PER_DEG_LAT - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
      const x = ax + t * dx;
      const y = ay + t * dy;
      const d = Math.hypot(x, y);
      if (d < best) {
        best = d;
        bx = x;
        by = y;
      }
    }
  }
  return {
    meters: best,
    point: { lat: p.lat + by / M_PER_DEG_LAT, lng: p.lng + bx / k },
  };
}
