import type { Availability, Change, Deal, Floor, Inquiry, Lease, Property } from '../../domain/types';
import { area } from './area';
import { footprint, footprintCenter, footprintSource } from './footprint';

/**
 * Preston Park Financial Center: a hand-built 12-floor Class A office building.
 * Every xRE edge case the personas care about appears at least once:
 * holdover (F3), month-to-month (F2), committed future lease (F4),
 * occupied-but-marketed space (F6), sublease (F7), over-allocated floor (F7),
 * contiguous availabilities (F8), multi-floor tenant (F9–F11),
 * confidential lease (F11), lease without Unit__c records (F2 phantom),
 * lease and availability with no floor, a for-sale retail condo (F1),
 * a stale record (Bowline, verified Jun 2026) and a property sale listing.
 */

/** "Today" for the prototype: fixed so screenshots are reproducible. */
export const TODAY = '2026-11-09';

const floor = (n: number, size: number, nonLeasable = 0): Floor => ({
  id: `F${n}`,
  name: `Floor ${n}`,
  sequence: n,
  size,
  nonLeasable,
});

const floors: Floor[] = [
  floor(1, 22600, 8000), // podium: lobby, loading, retail arcade
  floor(2, 21400),
  floor(3, 21400),
  floor(4, 21400),
  floor(5, 21400),
  floor(6, 21400),
  floor(7, 21400),
  floor(8, 21400),
  floor(9, 20800),
  floor(10, 20800),
  floor(11, 20800),
  floor(12, 18600),
];

let dealSeq = 0;
const deal = (prospect: string, stage: Deal['stage'], size: number, broker: string, updated: string, kind: Deal['kind'] = 'New'): Deal => ({
  id: `D${++dealSeq}`,
  name: `${prospect} – ${kind === 'Renewal' ? 'Renewal' : 'New Lease'}`,
  prospect,
  stage,
  size,
  broker,
  kind,
  updated,
});

type LeaseInput = Omit<Lease, 'units' | 'deals' | 'termination' | 'confidential' | 'rateUnit' | 'verifiedAt'> &
  Partial<Pick<Lease, 'deals' | 'termination' | 'confidential' | 'rateUnit' | 'verifiedAt'>> & {
    units: Array<[floorId: string, suite: string, size: number, order: number]>;
  };

const lease = (l: LeaseInput): Lease => ({
  termination: null,
  confidential: false,
  rateUnit: 'yr',
  deals: [],
  verifiedAt: '2026-10-30',
  ...l,
  units: l.units.map(([floorId, suite, size, order], i) => ({ id: `${l.id}-U${i + 1}`, floorId, suite, size, order })),
});

const leases: Lease[] = [
  // Floor 1: lobby retail
  lease({ id: 'L01', owner: 'Dana Whitfield', lastTouch: { date: '2026-10-28', type: 'Call', by: 'Dana Whitfield' }, tenant: 'Preston Park Café', tenantContact: 'Maya Ortiz', industry: 'Food & beverage', floorId: 'F1',
    units: [['F1', '100', 2400, 1]], commencement: '2022-03-01', expiration: '2027-02-28', rate: 3.25, rateUnit: 'mo', leaseType: 'NNN', verifiedAt: '2026-11-03',
    deals: [deal('Preston Park Café', 'Proposal', 2400, 'Dana Whitfield', '2026-10-28', 'Renewal')] }),
  lease({ id: 'L02', tenant: 'First Plano Bank', tenantContact: 'Gregory Lin', industry: 'Banking', floorId: 'F1',
    units: [['F1', '110', 5600, 2]], commencement: '2019-06-01', expiration: '2029-05-31', rate: 42, leaseType: 'NNN', verifiedAt: '2026-10-14' }),

  // Floor 2: MTM tenant + phantom lease
  lease({ id: 'L03', tenant: 'Hanover & Associates', tenantContact: 'Cameron Hartsill', industry: 'Accounting', floorId: 'F2',
    units: [['F2', '200', 9800, 1]], commencement: '2021-01-01', expiration: '2031-12-31', rate: 31.5, leaseType: 'FSG', verifiedAt: '2026-10-21' }),
  lease({ id: 'L04', owner: 'Marcus Webb', lastTouch: { date: '2026-08-14', type: 'Email', by: 'Marcus Webb' }, tenant: 'Bowline Consulting', tenantContact: 'Dan Clark', industry: 'Consulting', floorId: 'F2',
    units: [['F2', '230', 6200, 2]], commencement: '2018-08-01', expiration: null, rate: 28, leaseType: 'FSG', verifiedAt: '2026-06-02' }),
  lease({ id: 'L05', tenant: 'Delta Dental Plan', tenantContact: 'Priya Raman', industry: 'Insurance', floorId: 'F2',
    units: [], commencement: '2024-04-01', expiration: '2029-03-31', rate: 30, leaseType: 'FSG', verifiedAt: '2026-10-02' }),

  // Floor 3: holdover
  lease({ id: 'L06', owner: 'Dana Whitfield', lastTouch: { date: '2026-11-02', type: 'Meeting', by: 'Dana Whitfield' }, tenant: 'Argosy Partners', tenantContact: 'Dan Conrad', industry: 'Investment management', floorId: 'F3',
    units: [['F3', '300', 11000, 1]], commencement: '2016-09-01', expiration: '2026-08-31', rate: 27, leaseType: 'FSG', verifiedAt: '2026-11-02',
    deals: [deal('Argosy Partners', 'LOI', 11000, 'Dana Whitfield', '2026-11-02', 'Renewal')] }),
  lease({ id: 'L07', tenant: 'S&P Enterprises', tenantContact: 'Conner Madsen', industry: 'Logistics', floorId: 'F3',
    units: [['F3', '325', 4900, 2]], commencement: '2019-06-08', expiration: '2029-06-30', rate: 29.75, leaseType: 'FSG' }),

  // Floor 4: committed future lease in suite 450
  lease({ id: 'L08', tenant: 'API Group, Inc.', tenantContact: 'Rhea Patel', industry: 'Engineering', floorId: 'F4',
    units: [['F4', '400', 13400, 1]], commencement: '2021-03-23', expiration: '2031-03-31', rate: 30.25, leaseType: 'FSG' }),
  lease({ id: 'L09', tenant: 'Lumen Analytics', tenantContact: 'Owen Feld', industry: 'Software', floorId: 'F4',
    units: [['F4', '450', 8000, 2]], commencement: '2027-02-01', expiration: '2034-01-31', rate: 33.5, leaseType: 'FSG', verifiedAt: '2026-11-04' }),

  // Floor 5: three near-term expirations
  lease({ id: 'L10', owner: 'Marcus Webb', tenant: 'North American Asset Holdings', tenantContact: 'Lena Brooks', industry: 'Real estate', floorId: 'F5',
    units: [['F5', '500', 6500, 1]], commencement: '2021-10-14', expiration: '2027-10-31', rate: 30, leaseType: 'FSG' }),
  lease({ id: 'L11', tenant: 'WBH Financial Services', tenantContact: 'William Hunt', industry: 'Financial services', floorId: 'F5',
    units: [['F5', '510', 9900, 2]], commencement: '2019-09-17', expiration: '2028-09-30', rate: 31, leaseType: 'FSG' }),
  lease({ id: 'L12', owner: 'Marcus Webb', lastTouch: { date: '2026-10-15', type: 'Tour', by: 'Marcus Webb' }, tenant: 'BeachBody Workouts', tenantContact: 'Tara Nguyen', industry: 'Fitness', floorId: 'F5',
    units: [['F5', '520', 5000, 3]], commencement: '2018-08-30', expiration: '2027-04-30', rate: 26.5, leaseType: 'MG',
    deals: [deal('BeachBody Workouts', 'Tour', 5000, 'Marcus Webb', '2026-10-15', 'Renewal')] }),

  // Floor 6: full-floor tenant leaving; space already marketed
  lease({ id: 'L13', owner: 'Dana Whitfield', lastTouch: { date: '2026-09-30', type: 'Call', by: 'Dana Whitfield' }, tenant: 'Cirrus Energy', tenantContact: 'Tom Conner', industry: 'Energy', floorId: 'F6',
    units: [['F6', '600', 21400, 1]], commencement: '2018-09-10', expiration: '2027-03-31', rate: 29, leaseType: 'FSG', verifiedAt: '2026-11-06' }),

  // Floor 7: sublease + over-allocation
  lease({ id: 'L14', tenant: 'Infinity Info Systems', tenantContact: 'Tony Berry', industry: 'IT services', floorId: 'F7',
    units: [['F7', '700', 12500, 1], ['F7', '720', 7000, 2]], commencement: '2018-09-15', expiration: '2030-09-30', rate: 30, leaseType: 'FSG' }),
  lease({ id: 'L15', tenant: 'Conner CPA Group', tenantContact: 'Tom Conner', industry: 'Accounting', floorId: 'F7',
    units: [['F7', '740', 2400, 3]], commencement: '2023-05-01', expiration: '2028-04-30', rate: 32, leaseType: 'FSG' }),

  // Floor 8
  lease({ id: 'L16', tenant: 'Meridian Health Partners', tenantContact: 'Ana Silva', industry: 'Healthcare', floorId: 'F8',
    units: [['F8', '800', 14000, 1]], commencement: '2023-01-01', expiration: '2033-12-31', rate: 34, leaseType: 'FSG' }),

  // Floors 9–11: multi-floor tenant
  lease({ id: 'L17', tenant: 'Anadarko Drilling', tenantContact: 'Phillip Paschal', industry: 'Energy', floorId: 'F9',
    units: [['F9', '900', 20800, 1], ['F10', '1000', 20800, 1], ['F11', '1100', 10400, 1]],
    commencement: '2020-05-04', expiration: '2030-05-31', rate: 31, leaseType: 'FSG' }),
  lease({ id: 'L18', tenant: 'Halcyon Capital', tenantContact: 'Iris Vance', industry: 'Private equity', floorId: 'F11',
    units: [['F11', '1150', 10400, 2]], commencement: '2024-02-01', expiration: '2032-01-31', rate: 41, leaseType: 'FSG', confidential: true }),

  // Floor 12
  lease({ id: 'L19', tenant: 'Kinetic Ventures', tenantContact: 'Sam Okafor', industry: 'Venture capital', floorId: 'F12',
    units: [['F12', '1200', 9300, 1]], commencement: '2022-07-01', expiration: '2028-06-30', rate: 36, leaseType: 'FSG' }),

  // No floor, no units: unassigned
  lease({ id: 'L20', tenant: 'Ridgeway Insurance', tenantContact: 'Hal Mercer', industry: 'Insurance', floorId: null,
    units: [], commencement: '2025-01-01', expiration: '2030-12-31', rate: 30.5, leaseType: 'FSG' }),
];

type AvailInput = Omit<Availability, 'kind' | 'deals' | 'status' | 'sublease' | 'subleaseExpiration' | 'divisible' | 'minDivisible' | 'inquiries' | 'rateUnit' | 'verifiedAt'> &
  Partial<Pick<Availability, 'kind' | 'deals' | 'status' | 'sublease' | 'subleaseExpiration' | 'divisible' | 'minDivisible' | 'inquiries' | 'rateUnit' | 'verifiedAt'>>;

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
  verifiedAt: '2026-11-01',
  ...a,
});

const availabilities: Availability[] = [
  avail({ id: 'A01', floorId: 'F1', suite: '120', size: 4000, order: 3, isVacant: true, availableFrom: null,
    rentLow: 34, rentHigh: 36, leaseType: 'NNN', inquiries: 3,
    deals: [deal('Orangetheory Fitness', 'Tour', 4000, 'Marcus Webb', '2026-10-30')] }),
  avail({ id: 'A02', floorId: 'F3', suite: '350', size: 5500, order: 3, isVacant: true, availableFrom: null,
    rentLow: 30, rentHigh: 32, leaseType: 'FSG', divisible: true, minDivisible: 2500, inquiries: 6, verifiedAt: '2026-11-05',
    deals: [
      deal('Northwind Health', 'Proposal', 5000, 'Dana Whitfield', '2026-11-04'),
      deal('Kestrel Labs', 'Tour', 3000, 'Marcus Webb', '2026-10-21'),
    ] }),
  avail({ id: 'A03', floorId: 'F4', suite: '450', size: 8000, order: 2, status: 'Closed', isVacant: true, availableFrom: null,
    rentLow: 32, rentHigh: 34, leaseType: 'FSG',
    deals: [deal('Lumen Analytics', 'Lease Out', 8000, 'Dana Whitfield', '2026-09-12')] }),
  avail({ id: 'A04', floorId: 'F6', suite: '600', size: 21400, order: 1, isVacant: false, availableFrom: '2027-04-01',
    rentLow: 32, rentHigh: 34, leaseType: 'FSG', divisible: true, minDivisible: 7000, inquiries: 9, verifiedAt: '2026-11-05',
    deals: [
      deal('Vantage Robotics', 'LOI', 21400, 'Dana Whitfield', '2026-11-05'),
      deal('Harbor Freight Regional HQ', 'Tour', 15000, 'Marcus Webb', '2026-10-09'),
    ] }),
  avail({ id: 'A05', floorId: 'F7', suite: '720', size: 7000, order: 2, isVacant: true, availableFrom: null,
    sublease: true, subleaseExpiration: '2030-09-30', rentLow: 24, rentHigh: 26, leaseType: 'FSG', inquiries: 2 }),
  avail({ id: 'A06', floorId: 'F8', suite: '850', size: 4200, order: 2, isVacant: true, availableFrom: null,
    rentLow: 31, rentHigh: 33, leaseType: 'FSG', inquiries: 1 }),
  avail({ id: 'A07', floorId: 'F8', suite: '860', size: 3200, order: 3, isVacant: true, availableFrom: null,
    rentLow: 31, rentHigh: 33, leaseType: 'FSG', inquiries: 1 }),
  avail({ id: 'A08', floorId: 'F12', suite: '1250', size: 9300, order: 2, isVacant: true, availableFrom: null,
    rentLow: 38, rentHigh: 40, leaseType: 'FSG', inquiries: 4,
    deals: [deal('Orchid Bio', 'Proposal', 9000, 'Marcus Webb', '2026-11-01')] }),
  // No floor: unassigned
  avail({ id: 'A09', floorId: null, suite: 'TBD', size: 2000, order: 0, isVacant: true, availableFrom: null,
    rentLow: 30, rentHigh: 32, leaseType: 'FSG' }),
  // Floor 1 retail condo offered for sale (Availability, Sale record type)
  avail({ id: 'A10', kind: 'Sale', floorId: 'F1', suite: '130', size: 2600, order: 4, isVacant: true, availableFrom: null,
    rentLow: 0, rentHigh: 0, leaseType: 'NNN', askingPrice: 1027000, inquiries: 1, verifiedAt: '2026-10-26' }),
];

const inquiries: Inquiry[] = [
  { id: 'I01', prospect: 'Northwind Health', minSize: 5000, maxSize: 6000, neededBy: '2027-03-01', source: 'Referral', broker: 'Dana Whitfield' },
  { id: 'I02', prospect: 'Harbor Freight Regional HQ', minSize: 15000, maxSize: 22000, neededBy: '2027-06-30', source: 'Crexi', broker: 'Marcus Webb' },
  { id: 'I03', prospect: 'Kestrel Labs', minSize: 3000, maxSize: 4500, neededBy: '2027-01-15', source: 'LoopNet', broker: 'Marcus Webb' },
  { id: 'I04', prospect: 'Pinecrest Legal', minSize: 7000, maxSize: 8000, neededBy: '2027-02-01', source: 'LoopNet', broker: 'Dana Whitfield' },
  { id: 'I05', prospect: 'Atlas Biotech', minSize: 12000, maxSize: 14000, neededBy: '2027-01-31', source: 'Call', broker: 'Dana Whitfield' },
];

/** Field History rows from the last 30 days, newest first. */
const history: Change[] = [
  { id: 'H1', at: '2026-11-06', by: 'Elena Ruiz', recordType: 'Lease', recordLabel: 'Cirrus Energy', field: 'Term Expiration Date', from: 'Jun 30, 2027', to: 'Mar 31, 2027', floorId: 'F6', segKey: 'L13-U1' },
  { id: 'H2', at: '2026-11-05', by: 'Dana Whitfield', recordType: 'Deal', recordLabel: 'Vantage Robotics – New Lease', field: 'Stage', from: 'Proposal', to: 'LOI', floorId: 'F6', segKey: 'L13-U1' },
  { id: 'H3', at: '2026-11-04', by: 'Dana Whitfield', recordType: 'Lease', recordLabel: 'Lumen Analytics', field: 'Term Commencement Date', from: 'Jan 1, 2027', to: 'Feb 1, 2027', floorId: 'F4', segKey: 'L09-U1' },
  { id: 'H4', at: '2026-11-01', by: 'Marcus Webb', recordType: 'Availability', recordLabel: 'Suite 1250', field: 'Rent High', from: '$39.00', to: '$40.00', floorId: 'F12', segKey: 'A08' },
  { id: 'H5', at: '2026-10-28', by: 'Elena Ruiz', recordType: 'Availability', recordLabel: 'Suite 450', field: 'Status', from: 'Open', to: 'Closed', floorId: 'F4', segKey: 'L09-U1' },
  { id: 'H6', at: '2026-10-26', by: 'Elena Ruiz', recordType: 'Availability', recordLabel: 'Suite 130', field: 'Record created', from: null, to: 'Sale · $1,027,000', floorId: 'F1', segKey: 'A10' },
  { id: 'H7', at: '2026-10-21', by: 'Elena Ruiz', recordType: 'Floor', recordLabel: 'Floor 7 · Suite 740', field: 'Size (RSF)', from: '1,900', to: '2,400', floorId: 'F7', segKey: 'L15-U1' },
  { id: 'H8', at: '2026-10-15', by: 'Marcus Webb', recordType: 'Deal', recordLabel: 'BeachBody Workouts – Renewal', field: 'Record created', from: null, to: 'Tour', floorId: 'F5', segKey: 'L12-U1' },
  { id: 'H9', at: '2026-10-12', by: 'Marcus Webb', recordType: 'Inquiry', recordLabel: 'Harbor Freight Regional HQ', field: 'Linked availability', from: null, to: 'Suite 600', floorId: 'F6', segKey: 'L13-U1' },
];

export const property: Property = {
  id: 'P001',
  name: 'Preston Park Financial Center',
  street: '4965 Preston Park Blvd',
  city: 'Plano',
  state: 'TX',
  propertyClass: 'Class A Office',
  owner: 'Lakeside Realty Partners',
  totalBuildingArea: floors.reduce((s, f) => s + f.size, 0),
  location: footprintCenter,
  footprint,
  footprintSource,
  floorHeightFt: 13.5,
  saleListing: { price: 68500000, capRate: 0.064, broker: 'Lakeside Realty Partners', status: 'Active' },
  floors,
  leases,
  availabilities,
  inquiries,
  history,
  area,
  dataUpdated: '2026-11-06',
};
