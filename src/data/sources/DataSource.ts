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
  /**
   * The area at once from what is on hand, then again each time something fresher arrives (live mode: a copy of
   * the places first, then OpenStreetMap's own answer). Returns the way to stop listening. A source without it
   * answers once, through `getArea`.
   */
  watchArea?(p: Property, opts: AreaOptions | undefined, onArea: (area: Area) => void): () => void;
}
