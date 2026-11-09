import type { Area, GeoPolygon, Property } from '../../domain/types';

export interface FootprintResult {
  polygon: GeoPolygon;
  /** `osm` when fetched (or cached) from OpenStreetMap, `demo` for the hand-drawn sample. */
  source: 'osm' | 'demo';
}

export interface AreaOptions {
  /** US Census API key; without one the area falls back to the sample figures. */
  censusKey?: string | null;
}

/**
 * Live data behind the plan (DESIGN.md §2.6, PLAN.md §4.3). Implementations never throw:
 * on any failure they resolve with the cached mock so the view always renders.
 */
export interface DataSource {
  getFootprint(p: Property): Promise<FootprintResult>;
  getArea(p: Property, opts?: AreaOptions): Promise<Area>;
}
