import { describe, expect, it } from 'vitest';
import { property, TODAY } from './property';

describe('mock building invariants', () => {
  it('has unique ids across all records', () => {
    const ids = [
      ...property.floors.map((f) => f.id),
      ...property.leases.map((l) => l.id),
      ...property.leases.flatMap((l) => l.units.map((u) => u.id)),
      ...property.availabilities.map((a) => a.id),
      ...property.leases.flatMap((l) => l.deals.map((d) => d.id)),
      ...property.availabilities.flatMap((a) => a.deals.map((d) => d.id)),
      ...property.inquiries.map((i) => i.id),
      ...property.history.map((h) => h.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('fits every floor except F7, which is over-allocated by exactly 500 SF', () => {
    for (const f of property.floors) {
      const leasable = f.size - f.nonLeasable;
      const units = property.leases.flatMap((l) => l.units).filter((u) => u.floorId === f.id);
      const suites = new Set(units.map((u) => u.suite));
      const avails = property.availabilities.filter((a) => a.floorId === f.id && a.status === 'Open' && !suites.has(a.suite));
      const used = [...units, ...avails].reduce((s, x) => s + x.size, 0);
      if (f.id === 'F7') expect(used - leasable).toBe(500);
      else expect(used).toBeLessThanOrEqual(leasable);
    }
  });

  it('has exactly one for-sale availability and a sale listing', () => {
    expect(property.availabilities.filter((a) => a.kind === 'Sale')).toHaveLength(1);
    expect(property.saleListing?.price).toBe(68500000);
  });

  it('has nine history rows, all dated on or before today, newest first', () => {
    expect(property.history).toHaveLength(9);
    for (const h of property.history) expect(h.at <= TODAY).toBe(true);
    const dates = property.history.map((h) => h.at);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('uses the OSM footprint and places the property at its centroid', () => {
    expect(property.footprintSource).toBe('osm');
    expect(property.footprint.coordinates[0].length).toBeGreaterThan(4);
    expect(Math.abs(property.location.lat - 33.0235)).toBeLessThan(0.001);
  });
});
