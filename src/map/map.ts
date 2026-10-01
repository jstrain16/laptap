import maplibregl, { type LngLatBoundsLike, type Map as MapLibreMap } from 'maplibre-gl';

import type { BoundaryCollection, LatLng } from '../game/geo.js';
import type { Pool } from '../game/pools.js';

export type Basemap = 'satellite' | 'atlas';

/**
 * MapTap's globe is a natural-earth texture: green land, tan desert, white ice,
 * deep blue ocean. These are the two keyless Esri services that come closest.
 * Neither carries place labels — a labelled basemap would show you the answer.
 *
 * Both are declared up front and toggled by layer visibility, so switching
 * never re-creates the style or drops the pins drawn on top of it.
 */
const BASEMAPS: Record<
  Basemap,
  { url: string; maxzoom: number; label: string; border: string }
> = {
  satellite: {
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxzoom: 17,
    label: 'SATELLITE',
    border: '#eaf9ff',
  },
  atlas: {
    // Esri caps this one at zoom 8; MapLibre upscales beyond that rather than
    // going blank, which is the right trade for a stylised overview map.
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}',
    maxzoom: 8,
    label: 'ATLAS',
    // A pale atlas needs dark borders; the light ones vanish into the land.
    border: '#1d3b52',
  },
};

export const BASEMAP_ORDER: Basemap[] = ['satellite', 'atlas'];
export const basemapLabel = (kind: Basemap) => BASEMAPS[kind].label;

const ATTRIBUTION =
  'Tiles &copy; Esri, Maxar, Earthstar Geographics, USGS &middot; ski areas &copy; OpenSkiMap';

const layerId = (kind: Basemap) => `basemap-${kind}`;
const BOUNDARY_SOURCE = 'boundaries';

export interface GameMap {
  readonly raw: MapLibreMap;
  setBasemap(kind: Basemap): void;
  getBasemap(): Basemap;
  /** Called with the tapped point; ignored while the map is locked. */
  onPick(handler: (point: LatLng) => void): void;
  setLocked(locked: boolean): void;
  fitHome(animate?: boolean): void;
  fitWide(): void;
  frame(points: LatLng[]): void;
}

export async function createMap(
  container: HTMLElement,
  pool: Pool,
  boundaries: BoundaryCollection,
): Promise<GameMap> {
  let basemap: Basemap = 'satellite';
  let locked = false;
  let pickHandler: ((point: LatLng) => void) | null = null;

  const map = new maplibregl.Map({
    container,
    style: {
      version: 8,
      sources: {
        'basemap-satellite': {
          type: 'raster',
          tiles: [BASEMAPS.satellite.url],
          tileSize: 256,
          maxzoom: BASEMAPS.satellite.maxzoom,
        },
        'basemap-atlas': {
          type: 'raster',
          tiles: [BASEMAPS.atlas.url],
          tileSize: 256,
          maxzoom: BASEMAPS.atlas.maxzoom,
        },
        [BOUNDARY_SOURCE]: { type: 'geojson', data: boundaries as never },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#060910' } },
        {
          id: layerId('satellite'),
          type: 'raster',
          source: 'basemap-satellite',
          layout: { visibility: 'visible' },
        },
        {
          id: layerId('atlas'),
          type: 'raster',
          source: 'basemap-atlas',
          layout: { visibility: 'none' },
        },
        {
          id: 'boundary-lines',
          type: 'line',
          source: BOUNDARY_SOURCE,
          paint: {
            // Light enough to read over both basemaps without competing with
            // the terrain, which is the thing you actually navigate by. Held up
            // at low zoom, where a hairline over satellite imagery disappears
            // exactly when you most need the borders to aim with.
            'line-color': BASEMAPS.satellite.border,
            'line-width': ['interpolate', ['linear'], ['zoom'], 1.5, 0.7, 4, 1, 9, 1.8],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 1.5, 0.65, 6, 0.45],
          },
        },
      ],
    },
    bounds: pool.home,
    minZoom: 1.2,
    maxZoom: 13,
    attributionControl: { compact: true, customAttribution: ATTRIBUTION },
    dragRotate: false,
    pitchWithRotate: false,
    touchZoomRotate: true,
    renderWorldCopies: false,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

  // Handy when a camera or tile problem needs poking at from the console.
  // Not `window.map` — the <div id="map"> already owns that name.
  if (import.meta.env.DEV) {
    (window as unknown as { laptapMap: MapLibreMap }).laptapMap = map;
  }

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
  // of tiles, which on a cold start left the player staring at an empty page
  // for several seconds. The style is inline, so this settles almost
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

  /**
   * The top bar and the card stack cover the map, so centring a fit in the
   * whole container buries the target behind the card on a tall phone. Padding
   * the camera by what is actually obscured keeps the action in the visible
   * band. Scaled back if it would leave no viewport at all, since fitBounds
   * throws in that case.
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

  map.fitBounds(pool.home as LngLatBoundsLike, { padding: visiblePadding(), duration: 0 });

  return {
    raw: map,
    getBasemap: () => basemap,
    setBasemap(kind) {
      if (kind === basemap) return;
      map.setLayoutProperty(layerId(basemap), 'visibility', 'none');
      map.setLayoutProperty(layerId(kind), 'visibility', 'visible');
      map.setPaintProperty('boundary-lines', 'line-color', BASEMAPS[kind].border);
      basemap = kind;
    },
    onPick(handler) {
      pickHandler = handler;
    },
    setLocked(next) {
      locked = next;
      applyCursor();
    },
    fitHome(animate = true) {
      map.fitBounds(pool.home as LngLatBoundsLike, {
        padding: visiblePadding(),
        duration: animate ? 600 : 0,
      });
    },
    fitWide() {
      map.fitBounds(pool.wide as LngLatBoundsLike, { padding: visiblePadding(), duration: 600 });
    },
    frame(points) {
      if (points.length === 0) return;
      const bounds = new maplibregl.LngLatBounds();
      for (const p of points) bounds.extend([p.lng, p.lat]);
      map.fitBounds(bounds, { padding: visiblePadding(), maxZoom: 8, duration: 900 });
    },
  };
}
