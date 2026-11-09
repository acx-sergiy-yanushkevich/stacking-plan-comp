import type { DataSource } from './DataSource';
import { CensusSource } from './CensusSource';
import { MockSource } from './MockSource';
import { OverpassSource } from './OverpassSource';

export type { AreaOptions, DataSource, FootprintResult } from './DataSource';
export { MockSource } from './MockSource';
export { OverpassSource } from './OverpassSource';
export { CensusSource } from './CensusSource';

/**
 * `?live=1` → OpenStreetMap (Overpass) and the Census Bureau, each falling back to the
 * cached mock; otherwise the mock alone. `censusKey` is the default for `getArea`.
 */
export function createDataSource(live: boolean, censusKey: string | null): DataSource {
  if (!live) return new MockSource();
  return new OverpassSource(new CensusSource(censusKey), new MockSource());
}
