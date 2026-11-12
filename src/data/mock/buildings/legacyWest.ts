import type { Area, Change, Inquiry, Property } from '../../../domain/types';
import { footprintAround, kit } from './kit';

/**
 * Legacy West Tower II: a 22-floor Class A tower in Plano. A five-floor headquarters tenant, a three-floor
 * financial firm, three contiguous vacant floors (18–20) marketed as one large block, a full floor coming
 * back in January and already marketed, a future lease on floor 17, a month-to-month tenant, a partial
 * sublease, a confidential crown tenant and an availability with no floor. Sample data, fictional names.
 */

const { floor, deal, lease, avail } = kit('LW', '2026-10-31');

const floors = [
  floor(1, 28000, 14000), // lobby, retail, loading
  floor(2, 28000, 4000), // conference and fitness centre
  ...Array.from({ length: 18 }, (_, i) => floor(i + 3, 26000)),
  floor(21, 22000),
  floor(22, 22000),
];

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const leases = [
  lease({ id: 'L01', tenant: 'Legacy Coffee Roasters', tenantContact: 'Sofia Reyes', industry: 'Food & beverage', floorId: 'F1',
    units: [['F1', '100', 2200, 1]], commencement: '2023-03-01', expiration: '2028-02-29', rate: 3.6, rateUnit: 'mo', leaseType: 'NNN' }),
  lease({ id: 'L02', tenant: 'Prairie National Bank', tenantContact: 'Walter Simms', industry: 'Banking', floorId: 'F1',
    units: [['F1', '110', 5800, 2]], commencement: '2023-05-01', expiration: '2033-04-30', rate: 52, leaseType: 'NNN' }),

  lease({ id: 'L03', tenant: 'Lonestar Wellness Clinic', tenantContact: 'Dr. Kim Tran', industry: 'Healthcare', floorId: 'F2',
    units: [['F2', '200', 8000, 1]], commencement: '2022-09-01', expiration: '2029-08-31', rate: 39, leaseType: 'FSG' }),
  lease({ id: 'L04', tenant: 'Plano Coworking Collective', tenantContact: 'Drew Mason', industry: 'Flexible workspace', floorId: 'F2', owner: 'Owen Pierce',
    lastTouch: { date: '2026-10-22', type: 'Call', by: 'Owen Pierce' },
    units: [['F2', '240', 12000, 2]], commencement: '2022-08-01', expiration: '2027-07-31', rate: 34, leaseType: 'MG' }),

  // Floors 3–7: headquarters tenant
  lease({ id: 'L05', tenant: 'Meridian Automotive Group', tenantContact: 'Carla Jensen', industry: 'Automotive', floorId: 'F3',
    units: range(3, 7).map((n) => [`F${n}`, `${n}00`, 26000, 1] as [string, string, number, number]),
    commencement: '2021-01-01', expiration: '2035-12-31', rate: 38, leaseType: 'FSG' }),

  lease({ id: 'L06', tenant: 'Brazos Data Systems', tenantContact: 'Ken Ogawa', industry: 'IT services', floorId: 'F8', owner: 'Nadia Brooks',
    lastTouch: { date: '2026-10-28', type: 'Tour', by: 'Nadia Brooks' },
    units: [['F8', '800', 14000, 1]], commencement: '2020-05-01', expiration: '2027-04-30', rate: 37, leaseType: 'FSG',
    deals: [deal('Brazos Data Systems', 'Tour', 14000, 'Nadia Brooks', '2026-10-28', 'Renewal')] }),
  lease({ id: 'L07', tenant: 'Halverson Group', tenantContact: 'Erik Halverson', industry: 'Consulting', floorId: 'F8',
    units: [['F8', '850', 12000, 2]], commencement: '2023-07-01', expiration: '2030-06-30', rate: 39, leaseType: 'FSG' }),

  lease({ id: 'L08', tenant: 'Cardinal Insurance Services', tenantContact: 'Monica Hale', industry: 'Insurance', floorId: 'F9',
    units: [['F9', '900', 26000, 1]], commencement: '2019-12-01', expiration: '2029-11-30', rate: 36.5, leaseType: 'FSG' }),

  lease({ id: 'L09', tenant: 'Northgate Pharma', tenantContact: 'Dr. Ravi Menon', industry: 'Life sciences', floorId: 'F10',
    units: [['F10', '1000', 9000, 1]], commencement: '2024-02-01', expiration: '2031-01-31', rate: 41, leaseType: 'FSG' }),

  // Floor 11: whole floor back on Jan 1 and already marketed
  lease({ id: 'L10', tenant: 'Silverleaf Partners', tenantContact: 'Mark Ellison', industry: 'Financial services', floorId: 'F11', owner: 'Owen Pierce',
    lastTouch: { date: '2026-10-05', type: 'Email', by: 'Owen Pierce' },
    units: [['F11', '1100', 26000, 1]], commencement: '2016-01-01', expiration: '2026-12-31', rate: 35, leaseType: 'FSG', verifiedAt: '2026-11-01' }),

  // Floors 12–14: three-floor tenant
  lease({ id: 'L11', tenant: 'Summit Ridge Financial', tenantContact: 'Janet Cole', industry: 'Financial services', floorId: 'F12',
    units: range(12, 14).map((n) => [`F${n}`, `${n}00`, 26000, 1] as [string, string, number, number]),
    commencement: '2024-10-01', expiration: '2034-09-30', rate: 41, leaseType: 'FSG' }),

  lease({ id: 'L12', tenant: 'Bluewater Logistics', tenantContact: 'Hank Dorsey', industry: 'Logistics', floorId: 'F15', owner: 'Nadia Brooks',
    lastTouch: { date: '2026-06-11', type: 'Email', by: 'Nadia Brooks' },
    units: [['F15', '1500', 13000, 1]], commencement: '2018-03-01', expiration: null, rate: 33, leaseType: 'FSG', verifiedAt: '2026-06-11' }),
  lease({ id: 'L13', tenant: 'Ardent Legal LLP', tenantContact: 'Susan Ardent', industry: 'Legal', floorId: 'F15',
    units: [['F15', '1550', 13000, 2]], commencement: '2022-04-01', expiration: '2032-03-31', rate: 42, leaseType: 'FSG' }),

  lease({ id: 'L14', tenant: 'Orion Cloud', tenantContact: 'Tariq Aziz', industry: 'Software', floorId: 'F16',
    units: [['F16', '1600', 12000, 1], ['F16', '1640', 6000, 2]], commencement: '2020-06-01', expiration: '2030-05-31', rate: 39, leaseType: 'FSG' }),

  // Floor 17: committed future lease
  lease({ id: 'L15', tenant: 'Helix Biosciences', tenantContact: 'Dr. Laura Finch', industry: 'Life sciences', floorId: 'F17',
    units: [['F17', '1700', 26000, 1]], commencement: '2027-05-01', expiration: '2037-04-30', rate: 43, leaseType: 'FSG', verifiedAt: '2026-11-05' }),

  lease({ id: 'L16', tenant: 'Crowne Family Office', tenantContact: 'Victoria Crowne', industry: 'Investment management', floorId: 'F21',
    units: [['F21', '2100', 22000, 1]], commencement: '2024-01-01', expiration: '2033-12-31', rate: 58, leaseType: 'FSG', confidential: true }),

  lease({ id: 'L17', tenant: 'The Summit Club', tenantContact: 'Gavin Shore', industry: 'Hospitality', floorId: 'F22',
    units: [['F22', '2200', 14000, 1]], commencement: '2021-11-01', expiration: '2031-10-31', rate: 36, leaseType: 'MG' }),
];

const availabilities = [
  avail({ id: 'A01', floorId: 'F1', suite: '120', size: 3400, order: 3, isVacant: true, availableFrom: null,
    rentLow: 46, rentHigh: 50, leaseType: 'NNN', inquiries: 2 }),
  avail({ id: 'A02', floorId: 'F2', suite: '260', size: 4000, order: 3, isVacant: true, availableFrom: null,
    rentLow: 38, rentHigh: 40, leaseType: 'FSG', inquiries: 1 }),
  avail({ id: 'A03', floorId: 'F10', suite: '1030', size: 9500, order: 2, isVacant: true, availableFrom: null,
    rentLow: 41, rentHigh: 43, leaseType: 'FSG', divisible: true, minDivisible: 4500, inquiries: 3 }),
  avail({ id: 'A04', floorId: 'F10', suite: '1060', size: 7500, order: 3, isVacant: true, availableFrom: null,
    rentLow: 41, rentHigh: 43, leaseType: 'FSG', inquiries: 2 }),
  avail({ id: 'A05', floorId: 'F11', suite: '1100', size: 26000, order: 1, isVacant: false, availableFrom: '2027-01-01',
    rentLow: 40, rentHigh: 42, leaseType: 'FSG', divisible: true, minDivisible: 10000, inquiries: 6, verifiedAt: '2026-11-07',
    deals: [deal('Vector Aerospace', 'LOI', 26000, 'Owen Pierce', '2026-11-07')] }),
  avail({ id: 'A06', floorId: 'F16', suite: '1640', size: 6000, order: 2, isVacant: true, availableFrom: null,
    sublease: true, subleaseExpiration: '2030-05-31', rentLow: 30, rentHigh: 33, leaseType: 'FSG', inquiries: 1 }),
  avail({ id: 'A07', floorId: 'F16', suite: '1660', size: 8000, order: 3, isVacant: true, availableFrom: null,
    rentLow: 42, rentHigh: 44, leaseType: 'FSG', inquiries: 2 }),
  avail({ id: 'A08', floorId: 'F17', suite: '1700', size: 26000, order: 1, status: 'Closed', isVacant: true, availableFrom: null,
    rentLow: 43, rentHigh: 45, leaseType: 'FSG',
    deals: [deal('Helix Biosciences', 'Lease Out', 26000, 'Nadia Brooks', '2026-10-14')] }),
  // Floors 18–20: one large contiguous block
  avail({ id: 'A09', floorId: 'F18', suite: '1800', size: 26000, order: 1, isVacant: true, availableFrom: null,
    rentLow: 44, rentHigh: 47, leaseType: 'FSG', divisible: true, minDivisible: 10000, inquiries: 4, verifiedAt: '2026-11-08',
    deals: [deal('Granite Peak Energy', 'Proposal', 60000, 'Nadia Brooks', '2026-11-08')] }),
  avail({ id: 'A10', floorId: 'F19', suite: '1900', size: 26000, order: 1, isVacant: true, availableFrom: null,
    rentLow: 44, rentHigh: 47, leaseType: 'FSG', inquiries: 4 }),
  avail({ id: 'A11', floorId: 'F20', suite: '2000', size: 26000, order: 1, isVacant: true, availableFrom: null,
    rentLow: 45, rentHigh: 48, leaseType: 'FSG', inquiries: 3 }),
  // No floor: unassigned
  avail({ id: 'A12', floorId: null, suite: 'TBD', size: 3000, order: 0, isVacant: true, availableFrom: null,
    rentLow: 40, rentHigh: 42, leaseType: 'FSG' }),
];

const inquiries: Inquiry[] = [
  { id: 'LW-I01', prospect: 'Granite Peak Energy', minSize: 50000, maxSize: 78000, neededBy: '2027-09-01', source: 'Referral', broker: 'Nadia Brooks' },
  { id: 'LW-I02', prospect: 'Vector Aerospace', minSize: 20000, maxSize: 26000, neededBy: '2027-03-01', source: 'Crexi', broker: 'Owen Pierce' },
  { id: 'LW-I03', prospect: 'Tidewater Analytics', minSize: 8000, maxSize: 10000, neededBy: '2027-02-15', source: 'LoopNet', broker: 'Owen Pierce' },
  { id: 'LW-I04', prospect: 'Pecan Grove Pediatrics', minSize: 3000, maxSize: 4000, neededBy: '2027-01-31', source: 'Call', broker: 'Nadia Brooks' },
];

const history: Change[] = [
  { id: 'LW-H1', at: '2026-11-08', by: 'Nadia Brooks', recordType: 'Deal', recordLabel: 'Granite Peak Energy – New Lease', field: 'Stage', from: 'Tour', to: 'Proposal', floorId: 'F18', segKey: 'LW-A09' },
  { id: 'LW-H2', at: '2026-11-07', by: 'Owen Pierce', recordType: 'Deal', recordLabel: 'Vector Aerospace – New Lease', field: 'Stage', from: 'Proposal', to: 'LOI', floorId: 'F11', segKey: 'LW-L10-U1' },
  { id: 'LW-H3', at: '2026-11-05', by: 'Nadia Brooks', recordType: 'Lease', recordLabel: 'Helix Biosciences', field: 'Record created', from: null, to: 'Commences May 1, 2027', floorId: 'F17', segKey: 'LW-L15-U1' },
  { id: 'LW-H4', at: '2026-10-28', by: 'Nadia Brooks', recordType: 'Deal', recordLabel: 'Brazos Data Systems – Renewal', field: 'Record created', from: null, to: 'Tour', floorId: 'F8', segKey: 'LW-L06-U1' },
  { id: 'LW-H5', at: '2026-10-19', by: 'Owen Pierce', recordType: 'Availability', recordLabel: 'Suite 1100', field: 'Available From', from: 'Feb 1, 2027', to: 'Jan 1, 2027', floorId: 'F11', segKey: 'LW-L10-U1' },
  { id: 'LW-H6', at: '2026-10-12', by: 'Owen Pierce', recordType: 'Availability', recordLabel: 'Suite 1660', field: 'Size (RSF)', from: '7,200', to: '8,000', floorId: 'F16', segKey: 'LW-A07' },
];

const area: Area = {
  source: 'Sample figures for the demo. Live mode uses US Census Bureau ACS 5-year (api.census.gov, free key) and OpenStreetMap.',
  asOf: '2024',
  sample: true,
  rings: [
    { miles: 1, population: 9870, households: 4920, medianIncome: 131500, medianAge: 33.9, bachelorsPct: 0.63, meanCommuteMin: 22.4 },
    { miles: 3, population: 96400, households: 38700, medianIncome: 124800, medianAge: 36.7, bachelorsPct: 0.58, meanCommuteMin: 24.9 },
    { miles: 5, population: 301200, households: 112500, medianIncome: 118300, medianAge: 37.4, bachelorsPct: 0.55, meanCommuteMin: 26.0 },
  ],
  transit: [
    { name: 'Windhaven Pkwy @ Headquarters Dr', type: 'Bus', distanceMi: 0.3 },
    { name: 'Legacy Dr @ Communications Pkwy', type: 'Bus', distanceMi: 0.6 },
    { name: 'Parker Road Station (DART Red/Orange)', type: 'Rail', distanceMi: 8.2 },
  ],
  amenities: [
    { category: 'Restaurants', count: 64 },
    { category: 'Cafés', count: 14 },
    { category: 'Hotels', count: 7 },
    { category: 'Fitness', count: 9 },
    { category: 'Banks', count: 8 },
    { category: 'Parking', count: 15 },
  ],
};

const location = { lat: 33.07843, lng: -96.82634 };

export const legacyWest: Property = {
  id: 'P002',
  name: 'Legacy West Tower II',
  street: '7700 Windrose Ave',
  city: 'Plano',
  state: 'TX',
  propertyClass: 'Class A Office',
  owner: 'Legacy West Partners',
  totalBuildingArea: floors.reduce((s, f) => s + f.size, 0),
  location,
  // A 56 × 44 m tower plate with a notched north face.
  footprint: footprintAround(location, [[-28, -22], [28, -22], [28, 22], [8, 22], [8, 17], [-8, 17], [-8, 22], [-28, 22]]),
  footprintSource: 'demo',
  floorHeightFt: 14,
  saleListing: null,
  floors,
  leases,
  availabilities,
  inquiries,
  history,
  area,
  dataUpdated: '2026-11-08',
};
