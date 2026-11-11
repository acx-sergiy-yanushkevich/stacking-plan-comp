import { describe, expect, it } from 'vitest';
import { apportion, compactRate, pct, rate, rateRange, sf, sfDelta, usdCompact } from './format';

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

describe('apportion (legend shares, round 18)', () => {
  it('prints shares whose sum is their total rounded once, each within a tenth of a point', () => {
    const sf = [26200, 7000, 8000, 2800, 144200, 35300, 17300, 5100];
    const shares = sf.map((s) => s / 245400);
    const out = apportion(shares);
    const sum = Math.round(out.reduce((a, b) => a + b, 0) * 1000);
    expect(sum).toBe(Math.round((sf.reduce((a, b) => a + b, 0) / 245400) * 1000));
    out.forEach((o, i) => expect(Math.abs(o - shares[i])).toBeLessThanOrEqual(0.001 + 1e-12));
  });

  it('keeps exact shares as they are, and an empty list empty', () => {
    expect(apportion([0.25, 0.5, 0.25])).toEqual([0.25, 0.5, 0.25]);
    expect(apportion([])).toEqual([]);
  });
});
