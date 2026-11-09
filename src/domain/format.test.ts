import { describe, expect, it } from 'vitest';
import { compactRate, pct, rate, rateRange, sf, sfDelta, usdCompact } from './format';

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
});
