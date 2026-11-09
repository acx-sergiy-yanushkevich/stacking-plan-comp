import type { GeoPolygon } from '../../domain/types';

/**
 * Building footprint from OpenStreetMap (way 399060251, "office", building:levels=8),
 * fetched 2026-11-09 via the Overpass API and cached so the prototype works offline.
 * © OpenStreetMap contributors (ODbL). Live mode (?live=1) refreshes it.
 */
export const footprint: GeoPolygon = { type: 'Polygon', coordinates: [[[-96.7938903, 33.0232392], [-96.7939158, 33.0232639], [-96.7939158, 33.023373], [-96.7934357, 33.023753], [-96.7932989, 33.023753], [-96.7932761, 33.0237328], [-96.7932814, 33.0235068], [-96.7936234, 33.0232358], [-96.7938903, 33.0232392]]] };
export const footprintSource = 'osm' as const;
/** Centroid of the footprint: the Property__c.Location__c used by the map. */
export const footprintCenter = { lat: 33.023482, lng: -96.793580 };
