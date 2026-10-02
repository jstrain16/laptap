import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type Marker } from 'maplibre-gl';

import type { LatLng } from '../game/geo.js';
import { paintFor } from './colors.js';
import type { Line, Run, RunsFile } from './types.js';

export type RunsBasemap = 'trailmap' | 'satellite';

/**
 * A trail map drawn from open data, styled after the painted ones: a mountain
 * that actually stands up, forest green at the base rising to snow at the
 * summit, runs as white corridors with their colour down the middle, lifts as
 * bold red lines, a pale sky behind. No labels anywhere — the names are the
 * game.
 *
 * The relief comes from open elevation tiles rather than a pre-shaded image,
 * which is what lets the mountain be coloured by height, lit in snowy tones
 * and rendered in real 3D.
 */
const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const SATELLITE =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ATTRIBUTION =
  'Elevation: Mapzen, USGS &middot; imagery &copy; Esri &middot; runs &amp; lifts &copy; OpenSkiMap, OpenStreetMap contributors';

/** How far the camera tips back from straight-down: a view at the face, not a plan. */
const PITCH = 63;
/** Vertical stretch. Painted trail maps exaggerate relief; a little goes a long way. */
const EXAGGERATION = 1.35;

const EMPTY = { type: 'FeatureCollection' as const, features: [] };

const lineFeature = (l: Line, props: Record<string, unknown> = {}) => ({
  type: 'Feature' as const,
  properties: props,
  geometry: { type: 'LineString' as const, coordinates: l },
});

const zoomWidth = (a: number, b: number, c: number, d: number) =>
  ['interpolate', ['exponential', 1.6], ['zoom'], 12, a, 13.5, b, 15, c, 16.5, d] as never;

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
  let basemap: RunsBasemap = 'trailmap';
  let pickHandler: ((p: LatLng) => void) | null = null;
  let guessPin: Marker | null = null;

  // Every run, named or not, as line features carrying their own colour.
  const runFeatures = [...mountain.runs, ...mountain.extra].flatMap((r) => {
    const paint = paintFor(mountain.convention, r.d);
    return r.l.map((l) => lineFeature(l, { c: paint.color }));
  });
  const liftEnds = mountain.lifts.flatMap((l) =>
    [l[0]!, l[l.length - 1]!].map((p) => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Point' as const, coordinates: p },
    })),
  );

  // Forest at the base, snow at the top, relative to this mountain's own
  // range — so a Vermont hill and a Utah peak both read as "trees below,
  // white above" whatever their absolute heights.
  const [lo, hi] = mountain.elev;
  const span = Math.max(200, hi - lo);
  const at = (f: number) => Math.round(lo + f * span);
  const relief = [
    'interpolate',
    ['linear'],
    ['elevation'],
    at(-0.8), '#86ad78',
    at(-0.1), '#3d7a4c',
    at(0.35), '#3f8052',
    at(0.65), '#6a9f77',
    at(0.85), '#c9dccf',
    at(1.0), '#f4f8fb',
    at(1.5), '#ffffff',
  ] as never;

  const [w, s, e, n] = mountain.bounds;

  const dem = { type: 'raster-dem' as const, tiles: [DEM], tileSize: 256, encoding: 'terrarium' as const, maxzoom: 14 };

  const map = new maplibregl.Map({
    container,
    style: {
      version: 8,
      sources: {
        // Two sources over the same tiles: MapLibre wants the terrain mesh and
        // the shading to read from separate ones.
        terrain: dem,
        relief: dem,
        satellite: { type: 'raster', tiles: [SATELLITE], tileSize: 256, maxzoom: 17 },
        runs: { type: 'geojson', data: { type: 'FeatureCollection', features: runFeatures } },
        lifts: {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: mountain.lifts.map((l) => lineFeature(l)) },
        },
        'lift-ends': { type: 'geojson', data: { type: 'FeatureCollection', features: liftEnds } },
        target: { type: 'geojson', data: EMPTY },
        miss: { type: 'geojson', data: EMPTY },
      },
      sky: {
        'sky-color': '#7fbdea',
        'horizon-color': '#dcecf8',
        'fog-color': '#eef4f9',
        'sky-horizon-blend': 0.7,
        'horizon-fog-blend': 0.8,
        'fog-ground-blend': 0.6,
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#dfeaf2' } },
        { id: 'relief', type: 'color-relief', source: 'relief', paint: { 'color-relief-color': relief } },
        {
          id: 'shade',
          type: 'hillshade',
          source: 'relief',
          paint: {
            // Cool shadows and white highlights: snow, not rock.
            'hillshade-shadow-color': '#27425a',
            'hillshade-highlight-color': '#ffffff',
            'hillshade-accent-color': '#4d6b84',
            'hillshade-exaggeration': 0.55,
            'hillshade-illumination-direction': 315,
          },
        },
        { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } },
        // A run is a snow corridor: soft edge, white ribbon, colour down the middle.
        {
          id: 'run-edge',
          type: 'line',
          source: 'runs',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#5d7f95', 'line-opacity': 0.55, 'line-width': zoomWidth(3.6, 7.4, 13.5, 20) },
        },
        {
          id: 'run-snow',
          type: 'line',
          source: 'runs',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': zoomWidth(2.6, 6, 12, 18) },
        },
        {
          id: 'run-line',
          type: 'line',
          source: 'runs',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ['get', 'c'], 'line-width': zoomWidth(1.4, 3, 5, 7.5) },
        },
        {
          id: 'lifts',
          type: 'line',
          source: 'lifts',
          paint: { 'line-color': '#c0281f', 'line-width': zoomWidth(1, 1.8, 2.8, 3.6) },
        },
        {
          id: 'lift-ends',
          type: 'circle',
          source: 'lift-ends',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 1.8, 15, 4.5] as never,
            'circle-color': '#1f2937',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1,
          },
        },
        {
          id: 'target-glow',
          type: 'line',
          source: 'target',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 14, 'line-opacity': 0.9 },
        },
        {
          id: 'target-line',
          type: 'line',
          source: 'target',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#e6007e', 'line-width': 6 },
        },
        {
          id: 'miss',
          type: 'line',
          source: 'miss',
          paint: { 'line-color': '#111827', 'line-width': 2.2, 'line-dasharray': [2, 2] },
        },
      ],
    },
    bounds: [
      [w, s],
      [e, n],
    ],
    bearing: mountain.bearing,
    pitch: PITCH,
    maxPitch: 70,
    minZoom: 10,
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
  map.setTerrain({ source: 'terrain', exaggeration: EXAGGERATION });

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

  // --- camera ---------------------------------------------------------------
  //
  // With 3D terrain the camera has to be aimed at the mountainside, not at sea
  // level beneath it. Aimed at zero, a surface a kilometre up is drawn
  // hundreds of pixels higher than it was framed — and at Alta, where the
  // ground is above where the camera would sit, the camera ends up inside the
  // mountain and the screen goes black.
  //
  // MapLibre's own ground-clamping does not do this here, and its animated
  // moves (easeTo) ignore an explicit elevation; only an instant jumpTo
  // honours one. So clamping is switched off, elevation is managed here, and
  // camera moves are animated by hand as a series of jumps.
  map.setCenterClampedToGround(false);

  /** Until the elevation tiles arrive, the mountain's own mid-height is a good guess. */
  const guessElevation = ((mountain.elev[0] + mountain.elev[1]) / 2) * EXAGGERATION;

  /** Height of the drawn terrain surface at a point (absolute, exaggeration included). */
  const groundElevation = (at: maplibregl.LngLatLike): number =>
    map.queryTerrainElevation(at) ?? guessElevation;

  interface View {
    center: maplibregl.LngLat;
    zoom: number;
  }
  let target: View | null = null;
  let anim = 0;
  /** Set when the player takes the camera; stops the map correcting itself under them. */
  let handsOn = false;

  function moveTo(view: View, duration: number): void {
    cancelAnimationFrame(anim);
    const to = { ...view, elevation: groundElevation(view.center) };
    const apply = (center: maplibregl.LngLatLike, zoom: number, elevation: number) =>
      map.jumpTo({ center, zoom, elevation, bearing: mountain.bearing, pitch: PITCH });
    if (duration <= 0) {
      apply(to.center, to.zoom, to.elevation);
      return;
    }
    const from = { center: map.getCenter(), zoom: map.getZoom(), elevation: map.getCenterElevation() };
    const started = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const k = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      apply(
        [
          from.center.lng + (to.center.lng - from.center.lng) * k,
          from.center.lat + (to.center.lat - from.center.lat) * k,
        ],
        from.zoom + (to.zoom - from.zoom) * k,
        from.elevation + (to.elevation - from.elevation) * k,
      );
      if (t < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  /**
   * Frame some bounds while facing the mountain. MapLibre works out the fit as
   * if looking straight down at flat ground; tipped back at PITCH the same
   * area fills far less of the screen, so take its answer and move in.
   */
  const ZOOM_IN = 0.4;
  function frame(bounds: maplibregl.LngLatBoundsLike, maxZoom: number, duration: number): void {
    const cam = map.cameraForBounds(bounds, {
      bearing: mountain.bearing,
      padding: padding(),
      maxZoom,
    });
    if (!cam?.center) return;
    handsOn = false;
    target = {
      center: maplibregl.LngLat.convert(cam.center),
      zoom: Math.min(maxZoom + ZOOM_IN, (cam.zoom ?? 13) + ZOOM_IN),
    };
    moveTo(target, duration);
  }

  // A frame taken before the elevation tiles load is aimed at the guess. Each
  // time the map settles, check the real height under the target and correct
  // the aim if it is off — unless the player has the camera.
  map.on('idle', () => {
    if (!target || handsOn) return;
    if (Math.abs(groundElevation(target.center) - map.getCenterElevation()) > 20) moveTo(target, 350);
  });
  for (const event of ['mousedown', 'touchstart', 'wheel'] as const) {
    map.on(event, () => {
      handsOn = true;
      cancelAnimationFrame(anim);
    });
  }

  const fitMountain = (animate = true) =>
    frame(
      [
        [w, s],
        [e, n],
      ],
      15,
      animate ? 600 : 0,
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
      el.className = 'pin pin-runs';
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
      frame(b, 15.5, 800);
    },
    clear() {
      guessPin?.remove();
      guessPin = null;
      source('target').setData(EMPTY);
      source('miss').setData(EMPTY);
    },
    fitMountain,
    toggleBasemap() {
      basemap = basemap === 'trailmap' ? 'satellite' : 'trailmap';
      const sat = basemap === 'satellite';
      map.setLayoutProperty('satellite', 'visibility', sat ? 'visible' : 'none');
      map.setLayoutProperty('relief', 'visibility', sat ? 'none' : 'visible');
      map.setLayoutProperty('shade', 'visibility', sat ? 'none' : 'visible');
      return basemap;
    },
  };
}
