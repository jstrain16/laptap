import maplibregl, { type Marker } from 'maplibre-gl';

import type { LatLng } from '../game/geo.js';
import type { GameMap } from './map.js';

const LINE_SOURCE = 'guess-line';

function pin(className: string, label?: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `pin ${className}`;
  if (label) {
    const tag = document.createElement('span');
    tag.className = 'pin-label';
    tag.textContent = label;
    el.append(tag);
  }
  return el;
}

/**
 * Owns everything drawn on top of the basemap: the guess pin, the answer pin,
 * and the line between them. One instance for the whole game; `clear()` between
 * rounds.
 */
export class MarkerLayer {
  private guess: Marker | null = null;
  private answer: Marker | null = null;

  constructor(private readonly map: GameMap) {
    const raw = map.raw;
    raw.addSource(LINE_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    raw.addLayer({
      id: LINE_SOURCE,
      type: 'line',
      source: LINE_SOURCE,
      paint: {
        'line-color': '#ff6b57',
        'line-width': 2,
        'line-dasharray': [2, 2],
      },
    });
  }

  setGuess(point: LatLng): void {
    if (this.guess) {
      this.guess.setLngLat([point.lng, point.lat]);
      return;
    }
    this.guess = new maplibregl.Marker({ element: pin('pin-guess'), anchor: 'bottom' })
      .setLngLat([point.lng, point.lat])
      .addTo(this.map.raw);
  }

  /** Reveals the answer and draws the line of shame back to the guess. */
  reveal(target: LatLng, label: string, from: LatLng): void {
    this.answer = new maplibregl.Marker({ element: pin('pin-answer', label), anchor: 'bottom' })
      .setLngLat([target.lng, target.lat])
      .addTo(this.map.raw);

    const src = this.map.raw.getSource(LINE_SOURCE) as maplibregl.GeoJSONSource;
    src.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [from.lng, from.lat],
              [target.lng, target.lat],
            ],
          },
        },
      ],
    });
  }

  clear(): void {
    this.guess?.remove();
    this.answer?.remove();
    this.guess = null;
    this.answer = null;
    const src = this.map.raw.getSource(LINE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: 'FeatureCollection', features: [] });
  }
}
