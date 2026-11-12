/**
 * Shapes mirror the AscendixRE (xRE) Salesforce objects so the LWC port can map
 * Apex/SOQL results 1:1. API names are noted next to each field.
 */

export type ISODate = string; // 'YYYY-MM-DD'

/** LeaseType__c */
export type LeaseType = 'FSG' | 'MG' | 'NNN';
/** LeaseRateType__c: xRE stores rates either annual or monthly per SF. */
export type RateUnit = 'yr' | 'mo';

export type DealStage = 'Tour' | 'Proposal' | 'LOI' | 'Lease Out';

/** Deal__c (Landlord Representation / Renewal record types) */
export interface Deal {
  id: string;
  name: string;
  prospect: string; // Account name of the prospect
  stage: DealStage;
  size: number; // RSF
  broker: string; // Owner name
  kind: 'New' | 'Renewal';
  updated: ISODate; // LastModifiedDate
}

/** Unit__c: the leased block on a floor (child of Lease__c). */
export interface Unit {
  id: string;
  floorId: string; // Floor__c
  suite: string; // Name
  size: number; // Size__c (RSF)
  order: number; // left-to-right position on the floor
}

export interface Touch {
  date: ISODate;
  type: 'Call' | 'Email' | 'Meeting' | 'Tour';
  by: string;
}

/** Lease__c */
export interface Lease {
  id: string;
  tenant: string; // Tenant__c (Account name)
  tenantContact?: string; // TenantContact__c
  industry?: string;
  floorId: string | null; // Floor__c (primary floor)
  units: Unit[]; // Unit__c children; empty = lease never renders (known xRE gap)
  commencement: ISODate; // TermCommencementDate__c
  expiration: ISODate | null; // TermExpirationDate__c; null = month-to-month
  termination: ISODate | null; // TerminationDate__c
  rate: number | null; // LeaseRatePerUOM__c
  rateUnit: RateUnit;
  leaseType: LeaseType;
  confidential: boolean; // Confidential__c
  deals: Deal[]; // renewal / expansion deals
  owner?: string; // OwnerId: the broker accountable for the relationship
  lastTouch?: Touch; // most recent Task/Event on the tenant Account
  verifiedAt: ISODate; // LastModifiedDate: "last verified" stamp
}

/** Availability__c (Lease or Sale record type) */
export interface Availability {
  id: string;
  kind: 'Lease' | 'Sale'; // RecordType
  floorId: string | null;
  suite: string;
  size: number; // AvailableArea__c
  order: number;
  status: 'Open' | 'Closed'; // Status__c
  isVacant: boolean; // IsVacant__c
  availableFrom: ISODate | null; // AvailableFrom__c
  sublease: boolean; // Sublease__c
  subleaseExpiration: ISODate | null; // SubleaseExpirationDate__c
  rentLow: number; // RentLow__c
  rentHigh: number; // RentHigh__c
  rateUnit: RateUnit;
  leaseType: LeaseType;
  divisible: boolean; // Divisible__c
  minDivisible: number | null; // MinDivisibleArea__c
  askingPrice?: number; // SalePrice__c (Sale record type)
  inquiries: number; // count of Inquiry__c matched to this space
  deals: Deal[];
  verifiedAt: ISODate; // LastModifiedDate
  /** Published to marketing channels (listing feed / website); false = quiet listing. */
  published?: boolean;
}

/** Inquiry__c: an open tenant requirement (LoopNet/Crexi emails, referrals, calls). */
export interface Inquiry {
  id: string;
  prospect: string;
  minSize: number; // AreaMinimum__c
  maxSize: number; // AreaMaximum__c
  neededBy: ISODate; // DateNeeded__c
  source: string; // LeadSource
  broker: string;
}

/** Floor__c */
export interface Floor {
  id: string;
  name: string;
  sequence: number; // Sequence__c (rendered descending)
  size: number; // Size__c (RSF)
  nonLeasable: number; // NonLeasableArea__c
}

/** One row of Field History on a plan record (Lease__History, Availability__History, ...). */
export interface Change {
  id: string;
  at: ISODate;
  by: string;
  recordType: 'Lease' | 'Availability' | 'Deal' | 'Floor' | 'Inquiry';
  recordLabel: string;
  field: string;
  from: string | null;
  to: string | null;
  floorId?: string;
  segKey?: string;
}

export interface AreaRing {
  miles: 1 | 3 | 5;
  population: number;
  households: number;
  medianIncome: number;
  medianAge: number;
  bachelorsPct: number; // 0..1
  meanCommuteMin: number;
}

export interface Area {
  source: string;
  asOf: string;
  /** True when the figures are demo samples rather than a live Census query. */
  sample: boolean;
  rings: AreaRing[];
  /** A stop's position, when the source records one (the Map pins it there). */
  transit: Array<{ name: string; type: 'Rail' | 'Bus'; distanceMi: number; lat?: number; lng?: number }>;
  amenities: Array<{ category: string; count: number }>;
  /** Amenities with a position on record, when the source has them; the Map pins each one. */
  places?: Array<{ name: string; category: string; distanceMi: number; lat: number; lng: number }>;
}

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: number[][][]; // [[[lng, lat], ...]]
}

/** Listing__c (Sale record type) on the Property. */
export interface SaleListing {
  price: number;
  capRate: number | null;
  broker: string;
  status: 'Active' | 'Under Contract';
}

/** Property__c with its plan children. */
export interface Property {
  id: string;
  name: string;
  street: string;
  city: string;
  state: string;
  propertyClass: string;
  owner: string;
  totalBuildingArea: number; // TotalBuildingArea__c
  location: { lat: number; lng: number }; // Location__c
  footprint: GeoPolygon;
  footprintSource: 'osm' | 'demo';
  floorHeightFt: number;
  saleListing: SaleListing | null;
  floors: Floor[];
  leases: Lease[];
  availabilities: Availability[];
  inquiries: Inquiry[];
  history: Change[];
  area: Area;
  dataUpdated: ISODate; // last modified across plan records
}
