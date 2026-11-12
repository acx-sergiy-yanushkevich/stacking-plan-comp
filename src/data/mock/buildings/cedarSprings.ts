import type { Area, Change, Inquiry, Property } from '../../../domain/types';
import { footprintAround, kit } from './kit';

/**
 * Cedar Springs Exchange: an eight-floor Class A building in Uptown Dallas, under contract for sale.
 * A two-floor law firm, a holdover, a full-floor sublease, a committed future lease on floor 6,
 * a confidential tenant, a quiet listing and unrecorded space on floor 7. Sample data, fictional names.
 */

const { floor, deal, lease, avail } = kit('CS', '2026-10-29');

const floors = [
  floor(1, 24000, 9000), // lobby, garage entry, retail
  floor(2, 24000),
  floor(3, 24000),
  floor(4, 24000),
  floor(5, 24000),
  floor(6, 24000),
  floor(7, 24000),
  floor(8, 23200),
];

const leases = [
  lease({ id: 'L01', tenant: 'Uptown Bistro', tenantContact: 'Marco Bellini', industry: 'Food & beverage', floorId: 'F1',
    units: [['F1', '100', 3600, 1]], commencement: '2020-06-01', expiration: '2030-05-31', rate: 4.1, rateUnit: 'mo', leaseType: 'NNN' }),
  lease({ id: 'L02', tenant: 'Frontier Private Bank', tenantContact: 'Helen Ward', industry: 'Banking', floorId: 'F1',
    units: [['F1', '110', 6400, 2]], commencement: '2022-01-01', expiration: '2032-12-31', rate: 48, leaseType: 'NNN' }),

  // Floors 2–3: two-floor law firm
  lease({ id: 'L03', tenant: 'Whitmore Legal LLP', tenantContact: 'Charles Whitmore', industry: 'Legal', floorId: 'F2',
    units: [['F2', '200', 24000, 1], ['F3', '300', 12000, 1]], commencement: '2023-07-01', expiration: '2033-06-30', rate: 44, leaseType: 'FSG' }),
  lease({ id: 'L04', tenant: 'Maple Avenue Advisors', tenantContact: 'Nina Park', industry: 'Wealth management', floorId: 'F3', owner: 'Camila Torres',
    lastTouch: { date: '2026-11-05', type: 'Meeting', by: 'Camila Torres' },
    units: [['F3', '330', 7000, 2]], commencement: '2020-06-01', expiration: '2027-05-31', rate: 42, leaseType: 'FSG',
    deals: [deal('Maple Avenue Advisors', 'LOI', 7000, 'Camila Torres', '2026-11-05', 'Renewal')] }),

  // Floor 4: holdover + sublease
  lease({ id: 'L05', tenant: 'Citrine Health', tenantContact: 'Dr. Omar Siddiqui', industry: 'Healthcare', floorId: 'F4', owner: 'Ben Hartley',
    lastTouch: { date: '2026-09-22', type: 'Call', by: 'Ben Hartley' },
    units: [['F4', '400', 13000, 1]], commencement: '2016-08-01', expiration: '2026-07-31', rate: 40, leaseType: 'FSG', verifiedAt: '2026-09-22' }),
  lease({ id: 'L06', tenant: 'Redline Media', tenantContact: 'Jess Albright', industry: 'Media', floorId: 'F4',
    units: [['F4', '450', 11000, 2]], commencement: '2019-11-01', expiration: '2029-10-31', rate: 41, leaseType: 'FSG' }),

  // Floor 5: confidential full-floor tenant
  lease({ id: 'L07', tenant: 'Quarry Ridge Capital', tenantContact: 'Dmitri Volkov', industry: 'Private equity', floorId: 'F5',
    units: [['F5', '500', 24000, 1]], commencement: '2024-04-01', expiration: '2034-03-31', rate: 52, leaseType: 'FSG', confidential: true }),

  // Floor 6: committed future lease
  lease({ id: 'L08', tenant: 'Solstice Analytics', tenantContact: 'Rina Kapoor', industry: 'Software', floorId: 'F6',
    units: [['F6', '600', 15000, 1]], commencement: '2027-03-01', expiration: '2037-02-28', rate: 47, leaseType: 'FSG', verifiedAt: '2026-11-02' }),

  // Floor 7: two tenants and unrecorded space
  lease({ id: 'L09', tenant: 'Trinity Oak Family Office', tenantContact: 'Grace Lowell', industry: 'Investment management', floorId: 'F7',
    units: [['F7', '700', 8500, 1]], commencement: '2021-09-01', expiration: '2028-08-31', rate: 45, leaseType: 'FSG' }),
  lease({ id: 'L10', tenant: 'Kessler & Pratt CPA', tenantContact: 'Adam Kessler', industry: 'Accounting', floorId: 'F7', owner: 'Ben Hartley',
    units: [['F7', '720', 6200, 2]], commencement: '2022-10-01', expiration: '2027-09-30', rate: 43, leaseType: 'FSG' }),

  lease({ id: 'L11', tenant: 'Uptown Ventures', tenantContact: 'Leo Grant', industry: 'Venture capital', floorId: 'F8',
    units: [['F8', '800', 12000, 1]], commencement: '2021-01-01', expiration: '2030-12-31', rate: 49, leaseType: 'FSG' }),
];

const availabilities = [
  avail({ id: 'A01', floorId: 'F1', suite: '130', size: 4200, order: 3, isVacant: true, availableFrom: null,
    rentLow: 42, rentHigh: 46, leaseType: 'NNN', inquiries: 3,
    deals: [deal('Greenleaf Kitchen', 'Tour', 4000, 'Camila Torres', '2026-10-31')] }),
  avail({ id: 'A02', floorId: 'F3', suite: '360', size: 4800, order: 3, isVacant: true, availableFrom: null,
    rentLow: 44, rentHigh: 46, leaseType: 'FSG', inquiries: 2 }),
  avail({ id: 'A03', floorId: 'F4', suite: '450', size: 11000, order: 2, isVacant: true, availableFrom: null,
    sublease: true, subleaseExpiration: '2029-10-31', rentLow: 34, rentHigh: 36, leaseType: 'FSG', inquiries: 2 }),
  avail({ id: 'A04', floorId: 'F6', suite: '600', size: 15000, order: 1, status: 'Closed', isVacant: true, availableFrom: null,
    rentLow: 46, rentHigh: 48, leaseType: 'FSG',
    deals: [deal('Solstice Analytics', 'Lease Out', 15000, 'Ben Hartley', '2026-09-18')] }),
  avail({ id: 'A05', floorId: 'F6', suite: '650', size: 9000, order: 2, isVacant: true, availableFrom: null,
    rentLow: 46, rentHigh: 48, leaseType: 'FSG', divisible: true, minDivisible: 4500, inquiries: 4, verifiedAt: '2026-11-06',
    deals: [deal('Brightpath AI', 'Proposal', 8500, 'Ben Hartley', '2026-11-06')] }),
  avail({ id: 'A06', floorId: 'F8', suite: '850', size: 11200, order: 2, isVacant: true, availableFrom: null, published: false,
    rentLow: 50, rentHigh: 54, leaseType: 'FSG', divisible: true, minDivisible: 5000, inquiries: 1 }),
];

const inquiries: Inquiry[] = [
  { id: 'CS-I01', prospect: 'Brightpath AI', minSize: 8000, maxSize: 10000, neededBy: '2027-04-01', source: 'Crexi', broker: 'Ben Hartley' },
  { id: 'CS-I02', prospect: 'Greenleaf Kitchen', minSize: 3500, maxSize: 4500, neededBy: '2027-01-15', source: 'Call', broker: 'Camila Torres' },
  { id: 'CS-I03', prospect: 'Harlow Architects', minSize: 10000, maxSize: 12000, neededBy: '2027-06-01', source: 'Referral', broker: 'Camila Torres' },
];

const history: Change[] = [
  { id: 'CS-H1', at: '2026-11-06', by: 'Ben Hartley', recordType: 'Deal', recordLabel: 'Brightpath AI – New Lease', field: 'Stage', from: 'Tour', to: 'Proposal', floorId: 'F6', segKey: 'CS-A05' },
  { id: 'CS-H2', at: '2026-11-05', by: 'Camila Torres', recordType: 'Deal', recordLabel: 'Maple Avenue Advisors – Renewal', field: 'Stage', from: 'Proposal', to: 'LOI', floorId: 'F3', segKey: 'CS-L04-U1' },
  { id: 'CS-H3', at: '2026-11-02', by: 'Ben Hartley', recordType: 'Lease', recordLabel: 'Solstice Analytics', field: 'Term Commencement Date', from: 'Feb 1, 2027', to: 'Mar 1, 2027', floorId: 'F6', segKey: 'CS-L08-U1' },
  { id: 'CS-H4', at: '2026-10-31', by: 'Camila Torres', recordType: 'Deal', recordLabel: 'Greenleaf Kitchen – New Lease', field: 'Record created', from: null, to: 'Tour', floorId: 'F1', segKey: 'CS-A01' },
  { id: 'CS-H5', at: '2026-10-18', by: 'Ben Hartley', recordType: 'Availability', recordLabel: 'Suite 850', field: 'Rent High', from: '$52.00', to: '$54.00', floorId: 'F8', segKey: 'CS-A06' },
];

const area: Area = {
  source: 'Sample figures for the demo. Live mode uses US Census Bureau ACS 5-year (api.census.gov, free key) and OpenStreetMap.',
  asOf: '2024',
  sample: true,
  rings: [
    { miles: 1, population: 31850, households: 21400, medianIncome: 112300, medianAge: 32.1, bachelorsPct: 0.68, meanCommuteMin: 19.4 },
    { miles: 3, population: 198700, households: 104200, medianIncome: 89400, medianAge: 33.5, bachelorsPct: 0.52, meanCommuteMin: 22.8 },
    { miles: 5, population: 512600, households: 228300, medianIncome: 76100, medianAge: 34.2, bachelorsPct: 0.43, meanCommuteMin: 25.1 },
  ],
  transit: [
    { name: 'Cityplace/Uptown Station (DART Red/Orange/Blue)', type: 'Rail', distanceMi: 0.6 },
    { name: 'McKinney Ave Trolley @ Cedar Springs', type: 'Rail', distanceMi: 0.2 },
    { name: 'Cedar Springs Rd @ Maple Ave', type: 'Bus', distanceMi: 0.1 },
  ],
  amenities: [
    { category: 'Restaurants', count: 118 },
    { category: 'Cafés', count: 24 },
    { category: 'Hotels', count: 11 },
    { category: 'Fitness', count: 14 },
    { category: 'Banks', count: 9 },
    { category: 'Parking', count: 19 },
  ],
};

const location = { lat: 32.80152, lng: -96.80447 };

export const cedarSprings: Property = {
  id: 'P005',
  name: 'Cedar Springs Exchange',
  street: '2500 Cedar Springs Rd',
  city: 'Dallas',
  state: 'TX',
  propertyClass: 'Class A Office',
  owner: 'Cedar Springs Holdings',
  totalBuildingArea: floors.reduce((s, f) => s + f.size, 0),
  location,
  // A 60 × 37 m plate with chamfered corners.
  footprint: footprintAround(location, [[-25, -18.5], [25, -18.5], [30, -13.5], [30, 13.5], [25, 18.5], [-25, 18.5], [-30, 13.5], [-30, -13.5]]),
  footprintSource: 'demo',
  floorHeightFt: 13,
  saleListing: { price: 92000000, capRate: 0.058, broker: 'Hartley Torres Capital Markets', status: 'Under Contract' },
  floors,
  leases,
  availabilities,
  inquiries,
  history,
  area,
  dataUpdated: '2026-11-06',
};
