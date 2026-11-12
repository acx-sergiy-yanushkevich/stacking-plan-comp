import type { Availability, Deal, Floor, GeoPolygon, Lease } from '../../../domain/types';

/**
 * Builders for the sample buildings' records. Each building gets its own kit, so its deal ids run from 1 and
 * carry the building's prefix: two buildings never share a record id.
 */

export type LeaseInput = Omit<Lease, 'units' | 'deals' | 'termination' | 'confidential' | 'rateUnit' | 'verifiedAt'> &
  Partial<Pick<Lease, 'deals' | 'termination' | 'confidential' | 'rateUnit' | 'verifiedAt'>> & {
    units: Array<[floorId: string, suite: string, size: number, order: number]>;
  };

export type AvailInput = Omit<Availability, 'kind' | 'deals' | 'status' | 'sublease' | 'subleaseExpiration' | 'divisible' | 'minDivisible' | 'inquiries' | 'rateUnit' | 'verifiedAt'> &
  Partial<Pick<Availability, 'kind' | 'deals' | 'status' | 'sublease' | 'subleaseExpiration' | 'divisible' | 'minDivisible' | 'inquiries' | 'rateUnit' | 'verifiedAt'>>;

export function kit(prefix: string, verifiedAt: string) {
  let dealSeq = 0;

  const floor = (n: number, size: number, nonLeasable = 0): Floor => ({ id: `F${n}`, name: `Floor ${n}`, sequence: n, size, nonLeasable });

  const deal = (prospect: string, stage: Deal['stage'], size: number, broker: string, updated: string, kind: Deal['kind'] = 'New'): Deal => ({
    id: `${prefix}-D${++dealSeq}`,
    name: `${prospect} – ${kind === 'Renewal' ? 'Renewal' : 'New Lease'}`,
    prospect,
    stage,
    size,
    broker,
    kind,
    updated,
  });

  const lease = (l: LeaseInput): Lease => ({
    termination: null,
    confidential: false,
    rateUnit: 'yr',
    deals: [],
    verifiedAt,
    ...l,
    id: `${prefix}-${l.id}`,
    units: l.units.map(([floorId, suite, size, order], i) => ({ id: `${prefix}-${l.id}-U${i + 1}`, floorId, suite, size, order })),
  });

  const avail = (a: AvailInput): Availability => ({
    kind: 'Lease',
    status: 'Open',
    sublease: false,
    subleaseExpiration: null,
    divisible: false,
    minDivisible: null,
    inquiries: 0,
    rateUnit: 'yr',
    deals: [],
    verifiedAt,
    ...a,
    id: `${prefix}-${a.id}`,
  });

  return { floor, deal, lease, avail };
}

/**
 * A footprint drawn in metres around a centre point: `[east, north]` offsets, closed automatically.
 * Good enough for a sample building on the map and for the Building view's extrusion.
 */
export function footprintAround(center: { lat: number; lng: number }, metres: Array<[east: number, north: number]>): GeoPolygon {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((center.lat * Math.PI) / 180);
  const ring = metres.map(([e, n]) => [+(center.lng + e / mPerDegLng).toFixed(7), +(center.lat + n / mPerDegLat).toFixed(7)]);
  return { type: 'Polygon', coordinates: [[...ring, ring[0]]] };
}
