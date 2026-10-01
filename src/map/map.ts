import maplibregl, { type LngLatBoundsLike, type Map as MapLibreMap } from 'maplibre-gl';

import type { LatLng } from '../game/geo.js';
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
const BASEMAPS: Record<Basemap, { url: string; maxzoom: number; label: string }> = {
  satellite: {
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxzoom: 17,
    label: 'SATELLITE',
  },
  atlas: {
    // Esri caps this one at zoom 8; MapLibre upscales beyond that rather than
    // going blank, which is the right trade for a stylised overview map.
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}',
    maxzoom: 8,
    label: 'ATLAS',
  },
};

export const BASEMAP_ORDER: Basemap[] = ['satellite', 'atlas'];
export const basemapLabel = (kind: Basemap) => BASEMAPS[kind].label;

const ATTRIBUTION =
  'Tiles &copy; Esri, Maxar, Earthstar Geographics, USGS &middot; ski areas &copy; OpenSkiMap';

/**
 * Esri's imagery is a generalised green-and-white mosaic up to zoom 11 and
 * switches to flat, hazy, dirt-coloured aerial photography at 12. Stopping
 * short of that keeps the whole game looking like one map — and at zoom 11 a
 * screen still spans a few kilometres, far finer than the 120km scoring curve
 * can tell apart.
 */
const MAX_ZOOM = 11;

/** A full turn every two minutes: present, but never in the way of a tap. */
const SECONDS_PER_REVOLUTION = 120;

/**
 * Width of the rendered globe in CSS pixels at zoom 0 — measured at two very
 * different viewport sizes, because MapLibre exposes no way to ask and the
 * value turns out to depend only on zoom. It doubles with each zoom level,
 * which is what `globeZoom` inverts to fit the planet on any screen.
 */
const GLOBE_DIAMETER_AT_Z0 = 156;

const layerId = (kind: Basemap) => `basemap-${kind}`;

export interface GameMap {
  readonly raw: MapLibreMap;
  setBasemap(kind: Basemap): void;
  getBasemap(): Basemap;
  /** Called with the tapped point; ignored while the map is locked. */
  onPick(handler: (point: LatLng) => void): void;
  setLocked(locked: boolean): void;
  fitHome(animate?: boolean): void;
  frame(points: LatLng[]): void;
  startSpin(): void;
  stopSpin(): void;
}

export async function createMap(container: HTMLElement, pool: Pool): Promise<GameMap> {
  let basemap: Basemap = 'satellite';
  let locked = false;
  let pickHandler: ((point: LatLng) => void) | null = null;
  let spinning = false;

  const map = new maplibregl.Map({
    container,
    style: {
      version: 8,
      // MapTap plays on a globe, and for a worldwide question set that is the
      // honest projection: Mercator would put Niseko and Valle Nevado on wildly
      // different scales. MapLibre eases into a flat view as you zoom in.
      projection: { type: 'globe' },
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
      },
      // No borders drawn anywhere. The boundary data still decides the scoring
      // floors, but showing the lines would hand you the country for free.
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
      ],
      sky: {
        'sky-color': '#0a1424',
        'horizon-color': '#1d4a63',
        'fog-color': '#060910',
        'sky-horizon-blend': 0.6,
        'horizon-fog-blend': 0.6,
      },
    },
    // Low enough that a whole globe fits inside a narrow phone screen: the
    // rendered globe radius is 128 * 2^zoom pixels, so a 375px viewport needs
    // to reach about 0.4 before the planet stops overflowing the sides.
    minZoom: 0,
    maxZoom: MAX_ZOOM,
    attributionControl: { compact: true, customAttribution: ATTRIBUTION },
    dragRotate: false,
    pitchWithRotate: false,
    touchZoomRotate: true,
    // A tap that lands a pin should not also double-tap-zoom the globe.
    doubleClickZoom: false,
  });
  map.touchZoomRotate.disableRotation();

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

  // --- idle rotation ------------------------------------------------------

  /**
   * Driven off `moveend` rather than a rAF loop, so a user gesture interrupts
   * the camera the way MapLibre already handles it instead of fighting a
   * second animation for control.
   */
  function step(): void {
    if (!spinning) return;
    const center = map.getCenter();
    center.lng -= 360 / SECONDS_PER_REVOLUTION;
    map.easeTo({ center, duration: 1000, easing: (n) => n });
  }
  map.on('moveend', step);

  // Any deliberate touch stops the rotation: nobody can aim at a moving target,
  // and mousedown/touchstart land before the click that places the pin.
  for (const event of ['mousedown', 'touchstart', 'wheel'] as const) {
    map.on(event, () => {
      spinning = false;
    });
  }

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
  function visiblePadding(): Required<maplibregl.PaddingOptions> {
    const height = map.getContainer().clientHeight;
    const width = map.getContainer().clientWidth;
    const card = document.querySelector('.card')?.getBoundingClientRect().height ?? 150;
    const top = 88;
    const bottom = card + 28;
    const vScale = Math.min(1, Math.max(0, height - 120) / Math.max(1, top + bottom));
    const side = width < 520 ? 20 : 56;
    const hScale = Math.min(1, Math.max(0, width - 120) / Math.max(1, side * 2));
    return {
      top: top * vScale,
      bottom: bottom * vScale,
      left: side * hScale,
      right: side * hScale,
    };
  }

  /**
   * The zoom at which the whole globe sits inside the part of the screen the
   * cards aren't covering. The rendered globe is GLOBE_DIAMETER_AT_Z0 pixels
   * across at zoom 0 and doubles per zoom level, so this inverts that against
   * the smaller usable dimension.
   *
   * fitBounds cannot do this job: fitting a world-sized bounding box on a tall
   * phone fits the *width* and lets the planet run off the top and bottom.
   */
  function globeZoom(): number {
    const pad = visiblePadding();
    const usableW = map.getContainer().clientWidth - pad.left - pad.right;
    const usableH = map.getContainer().clientHeight - pad.top - pad.bottom;
    const diameter = Math.max(120, Math.min(usableW, usableH));
    return Math.max(0, Math.min(4, Math.log2(diameter / GLOBE_DIAMETER_AT_Z0)));
  }

  function goHome(duration: number): void {
    if (pool.home.kind === 'globe') {
      map.easeTo({ center: map.getCenter(), zoom: globeZoom(), duration });
      return;
    }
    map.fitBounds(pool.home.bounds as LngLatBoundsLike, {
      padding: visiblePadding(),
      duration,
      maxZoom: MAX_ZOOM,
    });
  }

  goHome(0);

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
    startSpin() {
      if (spinning) return;
      spinning = true;
      // Starting a rotation step now would cancel an in-flight camera move —
      // which is exactly what happened to the home transition, freezing the
      // globe at whatever zoom the ease had reached. If something is already
      // moving, its own `moveend` will pick the rotation up.
      if (!map.isMoving()) step();
    },
    stopSpin() {
      spinning = false;
    },
    fitHome(animate = true) {
      goHome(animate ? 600 : 0);
    },
    frame(points) {
      if (points.length === 0) return;
      const bounds = new maplibregl.LngLatBounds();
      for (const p of points) bounds.extend([p.lng, p.lat]);
      map.fitBounds(bounds, { padding: visiblePadding(), maxZoom: 8, duration: 900 });
    },
  };
}
