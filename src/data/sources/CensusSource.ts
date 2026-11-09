import type { Area, AreaRing, Property } from '../../domain/types';
import type { AreaOptions } from './DataSource';

export const TIGERWEB_URL = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/0/query';
export const ACS_URL = 'https://api.census.gov/data/2023/acs/acs5';
export const ACS_VARS = ['B01003_001E', 'B19013_001E', 'B01002_001E', 'B11001_001E', 'B15003_022E', 'B15003_001E', 'B08013_001E', 'B08012_001E'] as const;
export const METRES_PER_MILE = 1609.34;
const RING_MILES: Array<AreaRing['miles']> = [1, 3, 5];
const TIMEOUT_MS = 12_000;

/** One census tract's ACS figures. Null means the Bureau published no estimate. */
export interface CensusRow {
  geoid: string;
  /** B01003_001E total population */
  population: number | null;
  /** B19013_001E median household income */
  medianIncome: number | null;
  /** B01002_001E median age */
  medianAge: number | null;
  /** B11001_001E households */
  households: number | null;
  /** B15003_022E population 25+ with a bachelor's degree (bachelor's only) */
  bachelors: number | null;
  /** B15003_001E population 25+ (education universe) */
  eduTotal: number | null;
  /** B08013_001E aggregate travel time to work (minutes) */
  commuteMinutes: number | null;
  /** B08012_001E workers who did not work from home */
  commuters: number | null;
}

/** ACS encodes suppressed estimates as large negative sentinels (e.g. -666666666); treat them as missing. */
const valid = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Aggregate tract rows into one ring. Totals are sums; the medians are approximated by the
 * household-weighted (income) and population-weighted (age) means of the tract medians, which
 * is why the source line says "medians approximated".
 */
export function aggregate(rows: CensusRow[]): Omit<AreaRing, 'miles'> {
  let population = 0;
  let households = 0;
  let incomeW = 0;
  let incomeWeight = 0;
  let ageW = 0;
  let ageWeight = 0;
  let bachelors = 0;
  let eduTotal = 0;
  let commuteMinutes = 0;
  let commuters = 0;
  for (const r of rows) {
    if (valid(r.population)) population += r.population;
    if (valid(r.households)) households += r.households;
    if (valid(r.medianIncome) && valid(r.households) && r.households > 0) {
      incomeW += r.medianIncome * r.households;
      incomeWeight += r.households;
    }
    if (valid(r.medianAge) && valid(r.population) && r.population > 0) {
      ageW += r.medianAge * r.population;
      ageWeight += r.population;
    }
    if (valid(r.bachelors) && valid(r.eduTotal)) {
      bachelors += r.bachelors;
      eduTotal += r.eduTotal;
    }
    if (valid(r.commuteMinutes) && valid(r.commuters)) {
      commuteMinutes += r.commuteMinutes;
      commuters += r.commuters;
    }
  }
  return {
    population,
    households,
    medianIncome: incomeWeight > 0 ? Math.round(incomeW / incomeWeight) : 0,
    medianAge: ageWeight > 0 ? round1(ageW / ageWeight) : 0,
    bachelorsPct: eduTotal > 0 ? bachelors / eduTotal : 0,
    meanCommuteMin: commuters > 0 ? round1(commuteMinutes / commuters) : 0,
  };
}

/** Parse the ACS table (header row + data rows) into rows keyed by 11-digit GEOID. */
export function parseAcs(table: string[][]): CensusRow[] {
  if (table.length < 2) return [];
  const header = table[0];
  const col = (name: string) => header.indexOf(name);
  const idx = {
    population: col('B01003_001E'),
    medianIncome: col('B19013_001E'),
    medianAge: col('B01002_001E'),
    households: col('B11001_001E'),
    bachelors: col('B15003_022E'),
    eduTotal: col('B15003_001E'),
    commuteMinutes: col('B08013_001E'),
    commuters: col('B08012_001E'),
    state: col('state'),
    county: col('county'),
    tract: col('tract'),
  };
  const num = (row: string[], i: number): number | null => {
    if (i < 0) return null;
    const v = row[i];
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return table.slice(1).map((row) => ({
    geoid: `${row[idx.state] ?? ''}${row[idx.county] ?? ''}${row[idx.tract] ?? ''}`,
    population: num(row, idx.population),
    medianIncome: num(row, idx.medianIncome),
    medianAge: num(row, idx.medianAge),
    households: num(row, idx.households),
    bachelors: num(row, idx.bachelors),
    eduTotal: num(row, idx.eduTotal),
    commuteMinutes: num(row, idx.commuteMinutes),
    commuters: num(row, idx.commuters),
  }));
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

interface TigerResponse {
  features?: Array<{ attributes?: { GEOID?: string; AREALAND?: number } }>;
  error?: { message?: string };
}

/** GEOIDs of the tracts intersecting a circle of `miles` around the point. */
export async function tractsWithin(center: { lat: number; lng: number }, miles: number): Promise<string[]> {
  const params = new URLSearchParams({
    geometry: `${center.lng},${center.lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    distance: String(Math.round(miles * METRES_PER_MILE)),
    units: 'esriSRUnit_Meter',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'GEOID,AREALAND',
    returnGeometry: 'false',
    f: 'json',
  });
  const data = await fetchJson<TigerResponse>(`${TIGERWEB_URL}?${params}`);
  if (data.error) throw new Error(data.error.message ?? 'TIGERweb error');
  return (data.features ?? []).map((f) => f.attributes?.GEOID).filter((g): g is string => typeof g === 'string' && g.length === 11);
}

/** All tract rows of one county (state FIPS 2 + county FIPS 3). */
export async function acsCounty(stateFips: string, countyFips: string, key: string): Promise<CensusRow[]> {
  const params = new URLSearchParams({ get: ACS_VARS.join(','), for: 'tract:*', in: `state:${stateFips} county:${countyFips}`, key });
  const table = await fetchJson<string[][]>(`${ACS_URL}?${params}`);
  return parseAcs(table);
}

export const CENSUS_SOURCE_LABEL = 'US Census Bureau, ACS 5-year 2023 (tract aggregate, medians approximated)';

/**
 * Demographics from the Census Bureau: TIGERweb lists the tracts inside each ring, the ACS API
 * supplies their figures (one call per county), and `aggregate` rolls them up. Without a key the
 * sample area is returned flagged `sample: true`; on any failure likewise.
 */
export class CensusSource {
  private readonly defaultKey: string | null;

  constructor(defaultKey: string | null = null) {
    this.defaultKey = defaultKey;
  }

  async getArea(p: Property, opts?: AreaOptions): Promise<Area> {
    const key = opts?.censusKey === undefined ? this.defaultKey : opts.censusKey;
    const sample: Area = { ...p.area, sample: true };
    if (!key) return sample;
    try {
      const ringIds = await Promise.all(RING_MILES.map((m) => tractsWithin(p.location, m)));
      const counties = new Set<string>();
      for (const ids of ringIds) for (const id of ids) counties.add(id.slice(0, 5));
      if (counties.size === 0) return sample;
      const rowsByGeoid = new Map<string, CensusRow>();
      const tables = await Promise.all([...counties].map((c) => acsCounty(c.slice(0, 2), c.slice(2, 5), key)));
      for (const rows of tables) for (const r of rows) rowsByGeoid.set(r.geoid, r);
      const rings: AreaRing[] = RING_MILES.map((miles, i) => {
        const rows = ringIds[i].map((id) => rowsByGeoid.get(id)).filter((r): r is CensusRow => !!r);
        return { miles, ...aggregate(rows) };
      });
      if (rings.every((r) => r.population === 0)) return sample;
      return {
        source: CENSUS_SOURCE_LABEL,
        asOf: '2023',
        sample: false,
        rings,
        transit: p.area.transit,
        amenities: p.area.amenities,
      };
    } catch {
      return sample;
    }
  }
}
