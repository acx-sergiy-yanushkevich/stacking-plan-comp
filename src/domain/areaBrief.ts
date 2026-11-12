import { inMiles, mi, num, usd0 } from './format';
import type { Area, AreaRing } from './types';

type TransitStop = Area['transit'][number];

/**
 * The nation in the measures each ring is given in (`CensusSource.aggregate`): median household income
 * (B19013), median age (B01002), the share of people 25 and over whose highest degree is a bachelor's
 * (B15003_022 / B15003_001) and the mean commute of those who do not work from home (B08013 / B08012).
 * Fixed figures, so the comparison needs no call and no key.
 */
export const US_BENCHMARK = {
  medianIncome: 80734,
  medianAge: 38.9,
  // 49,868,172 bachelor's of 230,807,300 people 25 and over.
  bachelorsPct: 0.2161,
  meanCommuteMin: 26.4,
  source: 'US figures: US Census Bureau, ACS 5-year 2020–2024',
} as const;

export type Benchmark = Omit<typeof US_BENCHMARK, 'source'>;

/** A figure is worth a sentence when it is at least this far from the US figure, either way. */
const STANDS_OUT = 0.1;

export const standsOut = (value: number, us: number): boolean => us > 0 && Math.abs(value / us - 1) >= STANDS_OUT - 1e-9;

/** "2.8× the US" from 1.5 times up; otherwise "22% above the US" or "13% below the US". */
export function relativeToUs(value: number, us: number): string {
  const ratio = value / us;
  if (ratio >= 1.5) return `${ratio.toFixed(1)}× the US`;
  const off = Math.round(Math.abs(ratio - 1) * 100);
  if (off === 0) return 'the same as the US';
  return `${off}% ${ratio > 1 ? 'above' : 'below'} the US`;
}

/** A share to one decimal ("21.6%"): the education measure, whose US figure would lose too much rounded whole. */
export const pct1 = (ratio: number) => `${(Math.round(ratio * 1000) / 10).toFixed(1)}%`;

/** The education measure's name, said the way the table defines it (B15003_022 / B15003_001). */
export const BACHELORS_LABEL = "Bachelor's as highest degree";

export type Measure = 'income' | 'bachelors' | 'age' | 'commute';

export interface Comparison {
  measure: Measure;
  label: string;
  /** The ring's figure and the US figure, formatted. */
  value: string;
  us: string;
  /** How the ring compares, in words: "22% above the US", "2.3 min shorter than the US". */
  delta: string;
  /** At least 10% from the US figure: worth a sentence in the brief. */
  stands: boolean;
  /** Raw figures, for a bar and its US tick. */
  raw: number;
  usRaw: number;
}

/** "2.1 years younger than the US", "7.6 min longer than the US": a difference in the measure's own unit. */
function difference(value: number, us: number, unit: string, less: string, more: string): string {
  const d = Math.round((value - us) * 10) / 10;
  if (d === 0) return 'the same as the US';
  return `${Math.abs(d).toFixed(1)} ${unit} ${d < 0 ? less : more} than the US`;
}

/** The four measures of a ring that have a US figure, compared with it. */
export function compareRing(ring: AreaRing, us: Benchmark = US_BENCHMARK): Comparison[] {
  return [
    { measure: 'income', label: 'Median household income', value: usd0(ring.medianIncome), us: usd0(us.medianIncome), delta: relativeToUs(ring.medianIncome, us.medianIncome), stands: standsOut(ring.medianIncome, us.medianIncome), raw: ring.medianIncome, usRaw: us.medianIncome },
    { measure: 'bachelors', label: BACHELORS_LABEL, value: pct1(ring.bachelorsPct), us: pct1(us.bachelorsPct), delta: relativeToUs(ring.bachelorsPct, us.bachelorsPct), stands: standsOut(ring.bachelorsPct, us.bachelorsPct), raw: ring.bachelorsPct, usRaw: us.bachelorsPct },
    { measure: 'age', label: 'Median age', value: ring.medianAge.toFixed(1), us: us.medianAge.toFixed(1), delta: difference(ring.medianAge, us.medianAge, 'years', 'younger', 'older'), stands: standsOut(ring.medianAge, us.medianAge), raw: ring.medianAge, usRaw: us.medianAge },
    { measure: 'commute', label: 'Mean commute', value: `${ring.meanCommuteMin.toFixed(1)} min`, us: `${us.meanCommuteMin.toFixed(1)} min`, delta: difference(ring.meanCommuteMin, us.meanCommuteMin, 'min', 'shorter', 'longer'), stands: standsOut(ring.meanCommuteMin, us.meanCommuteMin), raw: ring.meanCommuteMin, usRaw: us.meanCommuteMin },
  ];
}

/** Amenity categories as a sentence says them: [one, many]. Unknown categories are lower-cased. */
const NOUNS: Record<string, [string, string]> = {
  Restaurants: ['restaurant', 'restaurants'],
  'Cafés': ['café', 'cafés'],
  Hotels: ['hotel', 'hotels'],
  Fitness: ['fitness center', 'fitness centers'],
  Banks: ['bank', 'banks'],
  Parking: ['parking facility', 'parking facilities'],
};
const noun = (category: string, count: number) => {
  const [one, many] = NOUNS[category] ?? [category.toLowerCase(), category.toLowerCase()];
  return `${num(count)} ${count === 1 ? one : many}`;
};
const listed = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const nearest = (stops: TransitStop[]) => stops.reduce<TransitStop | null>((a, b) => (!a || b.distanceMi < a.distanceMi ? b : a), null);

export interface Headline {
  label: string;
  value: string;
  note: string;
}

export interface LocationBriefData {
  /** The closest ring (the comparisons) and the widest (the population). */
  near: AreaRing;
  wide: AreaRing;
  headline: Headline[];
  /** "What stands out": the figures 10% or more from the US, then the amenities and the transit. */
  points: string[];
  comparisons: Comparison[];
  rings: AreaRing[];
}

/**
 * The location brief: what a broker shows a client or a decision maker about the area. Figures that
 * stand out from the US are said as plain facts, above or below alike; amenities and transit always.
 */
export function locationBrief(area: Area, us: Benchmark = US_BENCHMARK): LocationBriefData {
  const rings = [...area.rings].sort((a, b) => a.miles - b.miles);
  const near = rings[0];
  const wide = rings[rings.length - 1];
  const comparisons = compareRing(near, us);
  const by = Object.fromEntries(comparisons.map((c) => [c.measure, c])) as Record<Measure, Comparison>;
  const within = `within ${near.miles} ${near.miles === 1 ? 'mile' : 'miles'}`;

  const stop = nearest(area.transit);
  const rail = nearest(area.transit.filter((t) => t.type === 'Rail'));
  const kind = (t: TransitStop) => (t.type === 'Rail' ? 'rail station' : 'bus stop');
  const transitNote = !stop ? 'no stops on record' : stop.type === 'Rail' || !rail ? kind(stop) : `bus stop · rail ${mi(rail.distanceMi)}`;

  const headline: Headline[] = [
    { label: 'Population', value: num(wide.population), note: `within ${wide.miles} miles` },
    { label: 'Median household income', value: by.income.value, note: `${by.income.delta} · ${near.miles} mile${near.miles === 1 ? '' : 's'}` },
    { label: BACHELORS_LABEL, value: by.bachelors.value, note: `${by.bachelors.delta} · ${near.miles} mile${near.miles === 1 ? '' : 's'}` },
    { label: 'Nearest transit', value: stop ? mi(stop.distanceMi) : '—', note: transitNote },
  ];

  const points: string[] = [];
  if (by.income.stands) points.push(`Median household income of ${by.income.value} ${within}, ${by.income.delta}.`);
  if (by.bachelors.stands) points.push(`${by.bachelors.value} of people 25 and over ${within} have a bachelor's as their highest degree, ${by.bachelors.delta}.`);
  if (by.age.stands) points.push(`A median age of ${by.age.value} ${within}, ${by.age.delta}.`);
  if (by.commute.stands) points.push(`A mean commute of ${near.meanCommuteMin.toFixed(1)} minutes ${within}, ${by.commute.delta}.`);
  const top = [...area.amenities].filter((a) => a.count > 0).sort((a, b) => b.count - a.count).slice(0, 3);
  if (top.length) points.push(`${listed(top.map((a) => noun(a.category, a.count)))} within half a mile.`);
  if (stop) {
    const first = `A ${kind(stop)} ${inMiles(stop.distanceMi)} away`;
    points.push(stop.type !== 'Rail' && rail ? `${first}; the nearest rail station is ${inMiles(rail.distanceMi)} away.` : `${first}.`);
  }

  return { near, wide, headline, points, comparisons, rings };
}
