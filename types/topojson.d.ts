// topojson-server and topojson-simplify ship no types. The ETL only needs the
// standard simplification pipeline, treated as an opaque topology it hands
// straight back to topojson-client.
declare module 'topojson-server' {
  import type { Topology } from 'topojson-specification';
  export function topology(objects: unknown, quantization?: number): Topology;
}

declare module 'topojson-simplify' {
  import type { Topology } from 'topojson-specification';
  export function presimplify(topology: Topology, weight?: unknown): Topology;
  export function simplify(topology: Topology, minWeight?: number): Topology;
  export function quantile(topology: Topology, p: number): number;
  export function filter(topology: Topology, filter?: unknown): Topology;
}
