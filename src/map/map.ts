import maplibregl, { type LngLatBoundsLike, type Map as MapLibreMap } from 'maplibre-gl';

import type { LatLng } from '../game/geo.js';
import states from '../data/states.json' with { type: 'json' };

export type Basemap = 'relief' | 'satellite';

// Esri's public tile services: no API key, no sign-up, and crucially no place
// labels — a labelled basemap would just show you the answer. Both are declared
// up front and toggled by layer visibility, so switching never re-creates the
// style or drops the markers drawn on top of it.
const BASEMAPS: Record<Basemap, { url: string; maxzoom: number }> = {
  relief: {
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
    maxzoom: 13,
  },
  satellite: {
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxzoom: 17,
  },
};

const ATTRIBUTION = 'Tiles &copy; Esri, USGS, NOAA, Maxar &middot; ski areas &copy; OpenSkiMap';

/** The lower 48 — where the camera sits by default, and 98% of the pool. */
export const CONUS: LngLatBoundsLike = [
  [-125.5, 24.0],
  [-66.5, 49.8],
];

/** Wide enough to include Alaska, for the FIT USA button. */
export const WHOLE_USA: LngLatBoundsLike = [
  [-168.0, 23.0],
  [-66.0, 64.0],
];

const layerId = (kind: Basemap) => `basemap-${kind}`;
const STATES_SOURCE = 'states';

export interface GameMap {
  readonly raw: MapLibreMap;
  setBasemap(kind: Basemap): void;
  getBasemap(): Basemap;
  /** Called with the tapped point; ignored while the map is locked. */
  onPick(handler: (point: LatLng) => void): void;
  setLocked(locked: boolean): void;
  fitCONUS(animate?: boolean): void;
  fitUSA(): void;
  frame(points: LatLng[]): void;
}

export async function createMap(container: HTMLElement): Promise<GameMap> {
  let basemap: Basemap = 'relief';
  let locked = false;
  let pickHandler: ((point: LatLng) => void) | null = null;

  const map = new maplibregl.Map({
    container,
    style: {
      version: 8,
      sources: {
        'basemap-relief': {
          type: 'raster',
          tiles: [BASEMAPS.relief.url],
          tileSize: 256,
          maxzoom: BASEMAPS.relief.maxzoom,
        },
        'basemap-satellite': {
          type: 'raster',
          tiles: [BASEMAPS.satellite.url],
          tileSize: 256,
          maxzoom: BASEMAPS.satellite.maxzoom,
        },
        [STATES_SOURCE]: { type: 'geojson', data: states as never },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#060910' } },
        {
          id: layerId('relief'),
          type: 'raster',
          source: 'basemap-relief',
          layout: { visibility: 'visible' },
          // Esri ships shaded relief as pale beige on white, which glares
          // against the terminal palette and washes the state lines out.
          // Darkening and desaturating it keeps the landforms — the only thing
          // you actually navigate by — while letting the overlay read.
          paint: {
            'raster-brightness-max': 0.46,
            'raster-contrast': 0.12,
            'raster-saturation': -0.45,
          },
        },
        {
          id: layerId('satellite'),
          type: 'raster',
          source: 'basemap-satellite',
          layout: { visibility: 'none' },
          paint: { 'raster-brightness-max': 0.88 },
        },
        {
          id: 'state-lines',
          type: 'line',
          source: STATES_SOURCE,
          paint: {
            'line-color': '#7fe7ff',
            'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.7, 8, 1.6],
            'line-opacity': 0.55,
          },
        },
      ],
    },
    bounds: CONUS,
    // No maxBounds. Showing the width of the lower 48 on a 375px phone needs
    // roughly zoom 1.9, and at that zoom the viewport is taller than any
    // sensible box around the country — MapLibre then stops honouring
    // fitBounds and pins the camera to the middle of the box instead, which
    // parked the country off the bottom of the screen. FIT USA and the
    // automatic refit between rounds are enough to keep players oriented.
    minZoom: 1.8,
    maxZoom: 12,
    attributionControl: { compact: true, customAttribution: ATTRIBUTION },
    dragRotate: false,
    pitchWithRotate: false,
    touchZoomRotate: true,
    renderWorldCopies: false,
  });
  // Handy when a camera or tile problem needs poking at from the console.
  // Not `window.map` — the <div id="map"> already owns that name. Assigned
  // before any awaiting so a stuck map is still inspectable.
  if (import.meta.env.DEV) {
    (window as unknown as { laptapMap: MapLibreMap }).laptapMap = map;
  }

  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

  // Without a handler MapLibre swallows style and tile errors silently, which
  // makes a bad paint property look like a map that simply never loads.
  map.on('error', (e) => console.error('[map]', e.error ?? e));

  map.on('click', (e) => {
    if (locked || !pickHandler) return;
    pickHandler({ lat: e.lngLat.lat, lng: e.lngLat.lng });
  });

  // The crosshair cursor is the whole affordance — it says "tap the map".
  const applyCursor = () => {
    map.getCanvas().style.cursor = locked ? 'default' : 'crosshair';
  };
  applyCursor();

  // MapLibre measures the container once at construction. The stylesheet is
  // injected by the bundler, so on a cold load that measurement can happen
  // before #map has been laid out, leaving a canvas that covers a fraction of
  // the screen and only requests tiles for that fraction. Observing the
  // container keeps the canvas correct through that first layout and through
  // every later resize or orientation change.
  new ResizeObserver(() => map.resize()).observe(container);

  // Wait for the style, not for `load` — `load` also waits on the first screen
  // of Esri tiles, which on a cold start left the player staring at an empty
  // page for several seconds. The style is inline, so this settles almost
  // immediately, and it is all the caller needs before adding its own layers.
  //
  // Listening for a single `style.load` is not enough: with an inline style
  // that event can fire inside the constructor, before this code runs, and a
  // `once` handler attached afterwards then waits forever. Watching the
  // repeating `styledata` event and keeping `load` as a backstop means there
  // is no ordering in which this can hang.
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
  map.fitBounds(CONUS, { padding: visiblePadding(), duration: 0 });

  /**
   * The top bar and the card stack cover the map, so centring a fit in the
   * whole container buries the lower 48 behind the card on a tall phone.
   * Padding the camera by what is actually obscured keeps the action in the
   * visible band. Scaled back if it would leave no viewport at all, since
   * fitBounds throws in that case.
   */
  function visiblePadding(): maplibregl.PaddingOptions {
    const height = map.getContainer().clientHeight;
    const width = map.getContainer().clientWidth;
    const card = document.querySelector('.card')?.getBoundingClientRect().height ?? 150;
    const top = 100;
    const bottom = card + 36;
    const vScale = Math.min(1, Math.max(0, height - 120) / Math.max(1, top + bottom));
    const side = width < 520 ? 24 : 60;
    const hScale = Math.min(1, Math.max(0, width - 120) / Math.max(1, side * 2));
    return {
      top: top * vScale,
      bottom: bottom * vScale,
      left: side * hScale,
      right: side * hScale,
    };
  }

  return {
    raw: map,
    getBasemap: () => basemap,
    setBasemap(kind) {
      if (kind === basemap) return;
      map.setLayoutProperty(layerId(basemap), 'visibility', 'none');
      map.setLayoutProperty(layerId(kind), 'visibility', 'visible');
      basemap = kind;
    },
    onPick(handler) {
      pickHandler = handler;
    },
    setLocked(next) {
      locked = next;
      applyCursor();
    },
    fitCONUS(animate = true) {
      map.fitBounds(CONUS, { padding: visiblePadding(), duration: animate ? 600 : 0 });
    },
    fitUSA() {
      map.fitBounds(WHOLE_USA, { padding: visiblePadding(), duration: 600 });
    },
    frame(points) {
      if (points.length === 0) return;
      const bounds = new maplibregl.LngLatBounds();
      for (const p of points) bounds.extend([p.lng, p.lat]);
      map.fitBounds(bounds, { padding: visiblePadding(), maxZoom: 8, duration: 900 });
    },
  };
}
