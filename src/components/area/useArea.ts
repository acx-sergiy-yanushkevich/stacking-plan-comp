import { useEffect, useState } from 'react';
import type { DataSource } from '../../data/sources/DataSource';
import type { Area, Property } from '../../domain/types';

/**
 * The area around the property from the data source: null until it answers. A source that answers at once and
 * then again when something fresher arrives (live mode: a copy of the places, then OpenStreetMap's own) is listened
 * to; the rest answer once. A failed fetch falls back to the cached figures, so the Area panel and the Building
 * panel's preview always end up with data.
 */
export function useArea(dataSource: DataSource, property: Property, censusKey: string | null): Area | null {
  const [area, setArea] = useState<Area | null>(null);
  useEffect(() => {
    let alive = true;
    setArea(null);
    if (dataSource.watchArea) {
      const stop = dataSource.watchArea(property, { censusKey }, (a) => {
        if (alive) setArea(a);
      });
      return () => {
        alive = false;
        stop();
      };
    }
    dataSource
      .getArea(property, { censusKey })
      .then((a) => {
        if (alive) setArea(a);
      })
      .catch(() => {
        if (alive) setArea(property.area);
      });
    return () => {
      alive = false;
    };
  }, [dataSource, property, censusKey]);
  return area;
}
