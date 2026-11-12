import { describe, expect, it } from 'vitest';
import { compactRate, inMiles, keepUnits, mi, pct, rate, rateRange, sf, sfDelta, usdCompact } from './format';

describe('format', () => {
  it('never rounds SF', () => {
    expect(sf(21400)).toBe('21,400 SF');
    expect(sf(1234567)).toBe('1,234,567 SF');
  });
  it('rates carry unit and lease type', () => {
    expect(rate(31.5, 'yr', 'FSG')).toBe('$31.50/SF/yr FSG');
    expect(rate(3.25, 'mo', 'NNN')).toBe('$3.25/SF/mo NNN');
    expect(rate(36, 'yr', 'FSG')).toBe('$36/SF/yr FSG');
    expect(rateRange(31, 33, 'yr', 'FSG')).toBe('$31–$33/SF/yr FSG');
    expect(compactRate(31, 33, 'yr', 'FSG')).toBe('$31–$33/SF/yr FSG');
  });
  it('compacts dollars', () => {
    expect(usdCompact(68500000)).toBe('$68.5M');
    expect(usdCompact(1027000)).toBe('$1.03M');
    expect(usdCompact(395)).toBe('$395');
    expect(usdCompact(12400)).toBe('$12.4K');
  });
  it('percent and deltas', () => {
    expect(pct(0.87)).toBe('87.0%');
    expect(sfDelta(-6500)).toBe('−6,500 SF');
    expect(sfDelta(1200)).toBe('+1,200 SF');
  });
  it('distances to a tenth of a mile, and never "0.0" for a place at the door (round 25: live map data)', () => {
    expect(mi(0.4)).toBe('0.4 mi');
    expect(mi(3.1)).toBe('3.1 mi');
    expect(mi(0)).toBe('< 0.1 mi');
    expect(mi(0.04)).toBe('< 0.1 mi');
    expect(mi(0.05)).toBe('0.1 mi');
    expect(inMiles(0.2)).toBe('0.2 miles');
    expect(inMiles(1)).toBe('1.0 mile');
    expect(inMiles(0)).toBe('under 0.1 miles');
  });
  it('keeps a figure on one line with its unit, and a "<" with its figure', () => {
    expect(keepUnits('A bus stop 0.2 miles away')).toBe('A bus stop 0.2\u00a0miles away');
    expect(keepUnits('< 0.1 mi')).toBe('<\u00a00.1\u00a0mi');
    expect(keepUnits('24.1 min, 2.1 years')).toBe('24.1\u00a0min, 2.1\u00a0years');
  });
});
