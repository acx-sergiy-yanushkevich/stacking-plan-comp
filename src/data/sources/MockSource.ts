import type { Area, Property } from '../../domain/types';
import type { DataSource, FootprintResult } from './DataSource';

/** The cached demo data shipped with the property: offline, deterministic, instant. */
export class MockSource implements DataSource {
  async getFootprint(p: Property): Promise<FootprintResult> {
    return { polygon: p.footprint, source: p.footprintSource };
  }

  async getArea(p: Property): Promise<Area> {
    return p.area;
  }
}
