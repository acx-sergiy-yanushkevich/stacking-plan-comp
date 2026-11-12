import { describe, expect, it } from 'vitest';
import { BUILDINGS, buildingById, DEFAULT_BUILDING_ID } from '.';
import { PORTFOLIO } from '../portfolio';
import { TODAY } from '../property';

const others = BUILDINGS.slice(1).map((b) => b.property);

describe('buildings that open', () => {
  it('Preston Park is the default, and an unknown id falls back to it', () => {
    expect(DEFAULT_BUILDING_ID).toBe('P001');
    expect(buildingById(null).property.id).toBe('P001');
    expect(buildingById('nope').property.id).toBe('P001');
    expect(buildingById('P005').property.name).toBe('Cedar Springs Exchange');
  });

  it('have unique property ids and names, none shared with a sample entry', () => {
    const ids = BUILDINGS.map((b) => b.property.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(BUILDINGS.map((b) => b.property.name)).size).toBe(BUILDINGS.length);
    for (const p of PORTFOLIO) {
      expect(ids).not.toContain(p.id);
      expect(BUILDINGS.map((b) => b.property.name)).not.toContain(p.name);
    }
  });

  it('never reuse a record id, within a building or across buildings', () => {
    const all = BUILDINGS.flatMap(({ property: p }) => [
      ...p.leases.map((l) => l.id),
      ...p.leases.flatMap((l) => l.units.map((u) => u.id)),
      ...p.availabilities.map((a) => a.id),
      ...p.leases.flatMap((l) => l.deals.map((d) => d.id)),
      ...p.availabilities.flatMap((a) => a.deals.map((d) => d.id)),
      ...p.inquiries.map((i) => i.id),
      ...p.history.map((h) => h.id),
    ]);
    expect(new Set(all).size).toBe(all.length);
  });

  it.each(others.map((p) => [p.name, p] as const))('%s fits every floor: units and open vacancies never exceed the leasable area', (_name, p) => {
    for (const f of p.floors) {
      const leasable = f.size - f.nonLeasable;
      const units = p.leases.flatMap((l) => l.units).filter((u) => u.floorId === f.id);
      const suites = new Set(units.map((u) => u.suite));
      const avails = p.availabilities.filter((a) => a.floorId === f.id && a.status === 'Open' && !suites.has(a.suite));
      expect(units.concat(avails as never).reduce((s, x) => s + x.size, 0), f.id).toBeLessThanOrEqual(leasable);
    }
  });

  it.each(others.map((p) => [p.name, p] as const))('%s refers only to its own floors, dates its history up to today, newest first', (_name, p) => {
    const floorIds = new Set(p.floors.map((f) => f.id));
    for (const l of p.leases) for (const u of l.units) expect(floorIds.has(u.floorId), u.id).toBe(true);
    for (const a of p.availabilities) if (a.floorId) expect(floorIds.has(a.floorId), a.id).toBe(true);
    const dates = p.history.map((h) => h.at);
    for (const d of dates) expect(d <= TODAY).toBe(true);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(p.totalBuildingArea).toBe(p.floors.reduce((s, f) => s + f.size, 0));
    expect(p.footprint.coordinates[0].length).toBeGreaterThan(4);
  });
});
