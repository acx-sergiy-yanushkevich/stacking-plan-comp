import type { Area, Change, Inquiry, Property } from '../../../domain/types';
import { footprintAround, kit } from './kit';

/**
 * Bluebonnet Office Park: a small four-floor Class B suburban building. Many small tenants on MG leases,
 * a mostly vacant third floor, a month-to-month tenant with a stale record and a partial-floor sublease.
 * Sample data, fictional names.
 */

const { floor, deal, lease, avail } = kit('BB', '2026-10-24');

const floors = [floor(1, 16800, 2400), floor(2, 16800), floor(3, 16800), floor(4, 16800)];

const leases = [
  lease({ id: 'L01', tenant: 'Lone Star Physical Therapy', tenantContact: 'Erin Castillo', industry: 'Healthcare', floorId: 'F1', owner: 'Rachel Kim',
    lastTouch: { date: '2026-10-30', type: 'Call', by: 'Rachel Kim' },
    units: [['F1', '101', 3200, 1]], commencement: '2020-07-01', expiration: '2027-06-30', rate: 24, leaseType: 'MG',
    deals: [deal('Lone Star Physical Therapy', 'Tour', 3200, 'Rachel Kim', '2026-10-30', 'Renewal')] }),
  lease({ id: 'L02', tenant: 'Richardson Title Co.', tenantContact: 'Gary Holt', industry: 'Real estate services', floorId: 'F1',
    units: [['F1', '110', 2800, 2]], commencement: '2022-02-01', expiration: '2029-01-31', rate: 23, leaseType: 'MG' }),
  lease({ id: 'L03', tenant: 'Bright Smiles Dental', tenantContact: 'Dr. Ana Pruitt', industry: 'Healthcare', floorId: 'F1',
    units: [['F1', '130', 3000, 4]], commencement: '2023-05-01', expiration: '2030-04-30', rate: 26, leaseType: 'NNN' }),

  lease({ id: 'L04', tenant: 'Telecom Corridor Engineering', tenantContact: 'Victor Huang', industry: 'Engineering', floorId: 'F2',
    units: [['F2', '200', 9600, 1]], commencement: '2018-01-01', expiration: '2028-12-31', rate: 23.5, leaseType: 'MG' }),
  lease({ id: 'L05', tenant: 'Pinnacle Staffing', tenantContact: 'Joy Beckett', industry: 'Staffing', floorId: 'F2', owner: 'Jordan Ellis',
    lastTouch: { date: '2026-05-18', type: 'Email', by: 'Jordan Ellis' },
    units: [['F2', '230', 4200, 2]], commencement: '2017-04-01', expiration: null, rate: 21, leaseType: 'MG', verifiedAt: '2026-05-18' }),

  lease({ id: 'L06', tenant: 'Crescent Insurance Agency', tenantContact: 'Paul Nakamura', industry: 'Insurance', floorId: 'F3', owner: 'Jordan Ellis',
    lastTouch: { date: '2026-11-03', type: 'Meeting', by: 'Jordan Ellis' },
    units: [['F3', '350', 5000, 2]], commencement: '2021-03-01', expiration: '2027-02-28', rate: 22.5, leaseType: 'MG',
    deals: [deal('Crescent Insurance Agency', 'Proposal', 5000, 'Jordan Ellis', '2026-11-03', 'Renewal')] }),

  lease({ id: 'L07', tenant: 'Northstar Software', tenantContact: 'Lila Freeman', industry: 'Software', floorId: 'F4',
    units: [['F4', '400', 10800, 1], ['F4', '440', 6000, 2]], commencement: '2021-09-01', expiration: '2031-08-31', rate: 25, leaseType: 'MG' }),
];

const availabilities = [
  avail({ id: 'A01', floorId: 'F1', suite: '120', size: 4100, order: 3, isVacant: true, availableFrom: null,
    rentLow: 22, rentHigh: 24, leaseType: 'MG', divisible: true, minDivisible: 2000, inquiries: 2 }),
  avail({ id: 'A02', floorId: 'F2', suite: '250', size: 2900, order: 3, isVacant: true, availableFrom: null,
    rentLow: 21, rentHigh: 23, leaseType: 'MG', inquiries: 1 }),
  avail({ id: 'A03', floorId: 'F3', suite: '300', size: 11500, order: 1, isVacant: true, availableFrom: null,
    rentLow: 22, rentHigh: 24, leaseType: 'MG', divisible: true, minDivisible: 4000, inquiries: 5, verifiedAt: '2026-11-04',
    deals: [
      deal('Prairie Home Health', 'Tour', 6000, 'Rachel Kim', '2026-11-04'),
      deal('Cobalt Robotics', 'Proposal', 11000, 'Jordan Ellis', '2026-10-27'),
    ] }),
  avail({ id: 'A04', floorId: 'F4', suite: '440', size: 6000, order: 2, isVacant: true, availableFrom: null,
    sublease: true, subleaseExpiration: '2031-08-31', rentLow: 18, rentHigh: 20, leaseType: 'MG', inquiries: 1 }),
];

const inquiries: Inquiry[] = [
  { id: 'BB-I01', prospect: 'Prairie Home Health', minSize: 5000, maxSize: 7000, neededBy: '2027-02-01', source: 'Referral', broker: 'Rachel Kim' },
  { id: 'BB-I02', prospect: 'Cobalt Robotics', minSize: 10000, maxSize: 12000, neededBy: '2027-04-01', source: 'LoopNet', broker: 'Jordan Ellis' },
];

const history: Change[] = [
  { id: 'BB-H1', at: '2026-11-04', by: 'Rachel Kim', recordType: 'Deal', recordLabel: 'Prairie Home Health – New Lease', field: 'Record created', from: null, to: 'Tour', floorId: 'F3', segKey: 'BB-A03' },
  { id: 'BB-H2', at: '2026-11-03', by: 'Jordan Ellis', recordType: 'Deal', recordLabel: 'Crescent Insurance Agency – Renewal', field: 'Stage', from: 'Tour', to: 'Proposal', floorId: 'F3', segKey: 'BB-L06-U1' },
  { id: 'BB-H3', at: '2026-10-27', by: 'Jordan Ellis', recordType: 'Availability', recordLabel: 'Suite 300', field: 'Rent Low', from: '$23.00', to: '$22.00', floorId: 'F3', segKey: 'BB-A03' },
  { id: 'BB-H4', at: '2026-10-20', by: 'Rachel Kim', recordType: 'Availability', recordLabel: 'Suite 440', field: 'Record created', from: null, to: 'Sublease · 6,000 SF', floorId: 'F4', segKey: 'BB-A04' },
];

const area: Area = {
  source: 'Sample figures for the demo. Live mode uses US Census Bureau ACS 5-year (api.census.gov, free key) and OpenStreetMap.',
  asOf: '2024',
  sample: true,
  rings: [
    { miles: 1, population: 12240, households: 5180, medianIncome: 88600, medianAge: 35.4, bachelorsPct: 0.41, meanCommuteMin: 23.2 },
    { miles: 3, population: 104300, households: 40800, medianIncome: 95200, medianAge: 36.1, bachelorsPct: 0.44, meanCommuteMin: 24.7 },
    { miles: 5, population: 287900, households: 109600, medianIncome: 97800, medianAge: 36.6, bachelorsPct: 0.42, meanCommuteMin: 25.9 },
  ],
  transit: [
    { name: 'CityLine/Bush Station (DART Red/Orange)', type: 'Rail', distanceMi: 1.4 },
    { name: 'Campbell Rd @ Central Expy', type: 'Bus', distanceMi: 0.3 },
    { name: 'Galatyn Park Station (DART Red/Orange)', type: 'Rail', distanceMi: 1.9 },
  ],
  amenities: [
    { category: 'Restaurants', count: 27 },
    { category: 'Cafés', count: 6 },
    { category: 'Hotels', count: 3 },
    { category: 'Fitness', count: 4 },
    { category: 'Banks', count: 5 },
    { category: 'Parking', count: 8 },
  ],
};

const location = { lat: 32.99652, lng: -96.74951 };

export const bluebonnet: Property = {
  id: 'P007',
  name: 'Bluebonnet Office Park',
  street: '1201 E Campbell Rd',
  city: 'Richardson',
  state: 'TX',
  propertyClass: 'Class B Office',
  owner: 'Brookhollow Capital',
  totalBuildingArea: floors.reduce((s, f) => s + f.size, 0),
  location,
  // An L-shaped low-rise: a 55 m bar with a 20 m wing to the north.
  footprint: footprintAround(location, [[-27, -20], [28, -20], [28, 0], [-7, 0], [-7, 23], [-27, 23]]),
  footprintSource: 'demo',
  floorHeightFt: 12.5,
  saleListing: null,
  floors,
  leases,
  availabilities,
  inquiries,
  history,
  area,
  dataUpdated: '2026-11-04',
};
