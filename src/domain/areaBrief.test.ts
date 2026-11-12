import { describe, expect, it } from 'vitest';
import { area } from '../data/mock/area';
import type { Area, AreaRing } from './types';
import { areaCredit, compareRing, locationBrief, relativeToUs, standsOut, US_BENCHMARK } from './areaBrief';

const ring1 = area.rings[0];
const withRing = (patch: Partial<AreaRing>): Area => ({ ...area, rings: area.rings.map((r) => (r.miles === 1 ? { ...r, ...patch } : r)) });

describe('US_BENCHMARK', () => {
  it('is the nation in the same measures the rings use, with its source', () => {
    expect(US_BENCHMARK.medianIncome).toBe(80734);
    expect(US_BENCHMARK.medianAge).toBe(38.9);
    expect(US_BENCHMARK.bachelorsPct).toBeCloseTo(0.216, 3);
    expect(US_BENCHMARK.meanCommuteMin).toBe(26.4);
    expect(US_BENCHMARK.source).toMatch(/ACS 5-year 2020.2024/);
  });
});

describe('standsOut', () => {
  it('is 10% or more away from the US figure, either way', () => {
    expect(standsOut(110, 100)).toBe(true);
    expect(standsOut(90, 100)).toBe(true);
    expect(standsOut(109.9, 100)).toBe(false);
    expect(standsOut(90.1, 100)).toBe(false);
  });
});

describe('relativeToUs', () => {
  it('reads a ratio of 1.5 or more as a multiple, anything else as a percentage above or below', () => {
    expect(relativeToUs(0.61, 0.216)).toBe('2.8× the US');
    expect(relativeToUs(98400, 80734)).toBe('22% above the US');
    expect(relativeToUs(70000, 80734)).toBe('13% below the US');
    expect(relativeToUs(80734, 80734)).toBe('the same as the US');
  });
});

describe('compareRing', () => {
  it('compares income, degree share, age and commute with the US, each with its own wording', () => {
    const rows = compareRing(ring1);
    expect(rows.map((r) => r.measure)).toEqual(['income', 'bachelors', 'age', 'commute']);
    const by = Object.fromEntries(rows.map((r) => [r.measure, r]));
    expect(by.income).toMatchObject({ value: '$98,400', us: '$80,734', delta: '22% above the US', stands: true });
    expect(by.bachelors).toMatchObject({ value: '37.0%', us: '21.6%', delta: '1.7× the US', stands: true });
    // Age and commute read as years and minutes: "5.4 minutes shorter" says more than "9% below".
    expect(by.age).toMatchObject({ value: '36.8', us: '38.9', delta: '2.1 years younger than the US', stands: false });
    expect(by.commute).toMatchObject({ value: '24.1 min', us: '26.4 min', delta: '2.3 min shorter than the US', stands: false });
  });
});

describe('locationBrief', () => {
  it('leads with population in the widest ring, and income, degree share and transit in the closest', () => {
    const b = locationBrief(area);
    expect(b.headline.map((h) => [h.label, h.value, h.note])).toEqual([
      ['Population', '329,400', 'within 5 miles'],
      ['Median household income', '$98,400', '22% above the US · 1 mile'],
      ["Bachelor's as highest degree", '37.0%', '1.7× the US · 1 mile'],
      ['Nearest transit', '0.2 mi', 'bus stop · rail 3.1 mi'],
    ]);
  });

  it('says what stands out from the US, then the amenities and the transit', () => {
    expect(locationBrief(area).points).toEqual([
      'Median household income of $98,400 within 1 mile, 22% above the US.',
      "37.0% of people 25 and over within 1 mile have a bachelor's as their highest degree, 1.7× the US.",
      '42 restaurants, 11 parking facilities and 9 cafés within half a mile.',
      'A bus stop 0.2 miles away; the nearest rail station is 3.1 miles away.',
    ]);
  });

  it('names a figure below the US as plainly as one above it', () => {
    const points = locationBrief(withRing({ medianIncome: 60000, medianAge: 31.2, meanCommuteMin: 34.0 })).points;
    expect(points).toContain('Median household income of $60,000 within 1 mile, 26% below the US.');
    expect(points).toContain('A median age of 31.2 within 1 mile, 7.7 years younger than the US.');
    expect(points).toContain('A mean commute of 34.0 minutes within 1 mile, 7.6 min longer than the US.');
  });

  it('with nothing that stands out, keeps the amenities and the transit', () => {
    const points = locationBrief(withRing({ medianIncome: 82000, bachelorsPct: 0.22 })).points;
    expect(points).toHaveLength(2);
    expect(points[0]).toMatch(/within half a mile/);
  });

  it('without transit or amenities on record, says nothing about them', () => {
    const b = locationBrief({ ...area, transit: [], amenities: [] });
    expect(b.points.join(' ')).not.toMatch(/half a mile|bus|rail/);
    expect(b.headline[3]).toMatchObject({ label: 'Nearest transit', value: '—', note: 'no stops on record' });
  });

  it('a rail station nearest of all is named as such, with no second stop', () => {
    const b = locationBrief({ ...area, transit: [{ name: 'Central', type: 'Rail', distanceMi: 0.4 }] });
    expect(b.headline[3]).toMatchObject({ value: '0.4 mi', note: 'rail station' });
    expect(b.points.at(-1)).toBe('A rail station 0.4 miles away.');
  });
});

describe('areaCredit (round 26)', () => {
  it('credits the sample, the Census and OpenStreetMap, with the day of a recorded copy', () => {
    expect(areaCredit(area)).toBe(area.source);
    const places = [{ name: 'CAVA', category: 'Restaurants', distanceMi: 0.17, lat: 0, lng: 0 }];
    expect(areaCredit({ ...area, places, placesRecordedAt: '2026-11-12' })).toBe(`${area.source} Amenities and transit: OpenStreetMap, recorded Nov 12, 2026.`);
    expect(areaCredit({ ...area, sample: false, source: 'US Census Bureau ACS 5-year', places })).toBe('Area figures: US Census Bureau ACS 5-year. Amenities and transit: OpenStreetMap.');
  });
});

