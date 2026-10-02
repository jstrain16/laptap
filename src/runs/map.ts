import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type Marker } from 'maplibre-gl';

import type { LatLng } from '../game/geo.js';
import { paintFor } from './colors.js';
import type { Line, Run, RunsFile } from './types.js';

export type RunsBasemap = 'terrain' | 'satellite';

/**
 * A trail map drawn from open data: dark hillshade for the shape of the
 * mountain, every run as a line in its trail-map colour, lifts in grey. No
 * labels anywhere — the names are the game.
 */
const TERRAIN =
  'https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade_Dark/MapServer/tile/{z}/{y}/{x}';
const SATELLITE =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ATTRIBUTION =
  'Terrain &copy; Esri, USGS &middot; runs &amp; lifts &copy; OpenSkiMap, OpenStreetMap contributors';

const EMPTY = { type: 'FeatureCollection' as const, features: [] };

const lineFeature = (l: Line, props: Record<string, unknown> = {}) => ({
  type: 'Feature' as const,
  properties: props,
  geometry: { type: 'LineString' as const, coordinates: l },
});

export interface RunsMap {
  readonly raw: MapLibreMap;
  onPick(handler: (point: LatLng) => void): void;
  setLocked(locked: boolean): void;
  setGuess(point: LatLng): void;
  /** Lights up the answer and draws the line from the guess to it. */
  reveal(run: Run, guess: LatLng, nearest: LatLng): void;
  clear(): void;
  fitMountain(animate?: boolean): void;
  toggleBasemap(): RunsBasemap;
}

export async function createRunsMap(container: HTMLElement, mountain: RunsFile): Promise<RunsMap> {
  let locked = false;
  let basemap: RunsBasemap = 'terrain';
  let pickHandler: ((p: LatLng) => void) | null = null;
  let guessPin: Marker | null = null;

  // Every run, named or not, as line features carrying their own colours.
  const runFeatures = [
    ...mountain.runs.map((r) => ({ d: r.d, l: r.l, area: !!r.area })),
    ...mountain.extra.map((r) => ({ d: r.d, l: r.l, area: false })),
  ].flatMap((r) => {
    const paint = paintFor(mountain.convention, r.d);
    return r.l.map((l) => lineFeature(l, { c: paint.color, k: paint.casing }));
  });

  const [w, s, e, n] = mountain.bounds;

  const map = new maplibregl.Map({
    container,
    style: {
      version: 8,
      sources: {
        terrain: { type: 'raster', tiles: [TERRAIN], tileSize: 256, maxzoom: 15 },
        satellite: { type: 'raster', tiles: [SATELLITE], tileSize: 256, maxzoom: 17 },
        runs: { type: 'geojson', data: { type: 'FeatureCollection', features: runFeatures } },
        lifts: {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: mountain.lifts.map((l) => lineFeature(l)) },
        },
        target: { type: 'geojson', data: EMPTY },
        miss: { type: 'geojson', data: EMPTY },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#060910' } },
        { id: 'terrain', type: 'raster', source: 'terrain', paint: { 'raster-brightness-max': 0.85 } },
        { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } },
        {
          id: 'lifts',
          type: 'line',
          source: 'lifts',
          paint: {
            'line-color': '#aeb8c4',
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 15, 1.6],
            'line-dasharray': [3, 2],
            'line-opacity': 0.75,
          },
        },
        {
          id: 'run-casing',
          type: 'line',
          source: 'runs',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['get', 'k'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.6, 13, 3.4, 15, 6.5],
          },
        },
        {
          id: 'run-line',
          type: 'line',
          source: 'runs',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['get', 'c'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 13, 2, 15, 4],
          },
        },
        {
          id: 'target-glow',
          type: 'line',
          source: 'target',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#fff35c', 'line-width': 12, 'line-opacity': 0.35, 'line-blur': 4 },
        },
        {
          id: 'target-line',
          type: 'line',
          source: 'target',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#fff35c', 'line-width': 4.5 },
        },
        {
          id: 'miss',
          type: 'line',
          source: 'miss',
          paint: { 'line-color': '#ff6b57', 'line-width': 2, 'line-dasharray': [2, 2] },
        },
      ],
    },
    bounds: [
      [w, s],
      [e, n],
    ],
    minZoom: 9,
    maxZoom: 16.5,
    attributionControl: { compact: true, customAttribution: ATTRIBUTION },
    dragRotate: false,
    pitchWithRotate: false,
    doubleClickZoom: false,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

  if (import.meta.env.DEV) {
    (window as unknown as { laptapMap: MapLibreMap }).laptapMap = map;
  }

  map.on('error', (ev) => console.error('[map]', ev.error ?? ev));
  map.on('click', (ev) => {
    if (locked || !pickHandler) return;
    pickHandler({ lat: ev.lngLat.lat, lng: ev.lngLat.lng });
  });

  const applyCursor = () => {
    map.getCanvas().style.cursor = locked ? 'default' : 'crosshair';
  };
  applyCursor();

  new ResizeObserver(() => map.resize()).observe(container);

  // See src/map/map.ts for why this watches `styledata` with `load` as a
  // backstop rather than waiting on a single event.
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      map.off('styledata', onData);
      map.off('load', finish);
      resolve();
    };
    const onData = () => {
      if (map.isStyleLoaded()) finish();
    };
    if (map.isStyleLoaded()) {
      finish();
      return;
    }
    map.on('styledata', onData);
    map.on('load', finish);
  });
  map.resize();

  /** Keep the mountain clear of the top bar and the card stack. */
  function padding(): Required<maplibregl.PaddingOptions> {
    const height = map.getContainer().clientHeight;
    const width = map.getContainer().clientWidth;
    const card = document.querySelector('.card')?.getBoundingClientRect().height ?? 150;
    const top = 92;
    const bottom = card + 28;
    const vScale = Math.min(1, Math.max(0, height - 140) / Math.max(1, top + bottom));
    const side = width < 520 ? 16 : 48;
    return { top: top * vScale, bottom: bottom * vScale, left: side, right: side };
  }

  const fitMountain = (animate = true) =>
    map.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      { padding: padding(), duration: animate ? 600 : 0, maxZoom: 15 },
    );
  fitMountain(false);

  const source = (id: string) => map.getSource(id) as GeoJSONSource;

  return {
    raw: map,
    onPick(handler) {
      pickHandler = handler;
    },
    setLocked(next) {
      locked = next;
      applyCursor();
    },
    setGuess(point) {
      if (guessPin) {
        guessPin.setLngLat([point.lng, point.lat]);
        return;
      }
      const el = document.createElement('div');
      el.className = 'pin pin-guess';
      guessPin = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([point.lng, point.lat])
        .addTo(map);
    },
    reveal(run, guess, nearest) {
      source('target').setData({
        type: 'FeatureCollection',
        features: run.l.map((l) => lineFeature(l)),
      });
      source('miss').setData({
        type: 'FeatureCollection',
        features: [
          lineFeature([
            [guess.lng, guess.lat],
            [nearest.lng, nearest.lat],
          ]),
        ],
      });
      const b = new maplibregl.LngLatBounds();
      b.extend([guess.lng, guess.lat]);
      for (const l of run.l) for (const p of l) b.extend(p);
      map.fitBounds(b, { padding: padding(), maxZoom: 15.5, duration: 800 });
    },
    clear() {
      guessPin?.remove();
      guessPin = null;
      source('target').setData(EMPTY);
      source('miss').setData(EMPTY);
    },
    fitMountain,
    toggleBasemap() {
      basemap = basemap === 'terrain' ? 'satellite' : 'terrain';
      map.setLayoutProperty('satellite', 'visibility', basemap === 'satellite' ? 'visible' : 'none');
      return basemap;
    },
  };
}
