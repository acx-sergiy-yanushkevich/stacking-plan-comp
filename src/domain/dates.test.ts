import { describe, expect, it } from 'vitest';
import { addMonths, fmtDate, fmtMonthYearShort, fmtMonths, monthsBetween, yearOf } from './dates';

describe('dates', () => {
  it('counts whole months toward zero', () => {
    expect(monthsBetween('2026-11-09', '2027-03-31')).toBe(4);
    expect(monthsBetween('2026-11-09', '2026-08-31')).toBe(-2);
    expect(monthsBetween('2026-11-09', '2026-12-08')).toBe(0);
  });
  it('formats month counts', () => {
    expect(fmtMonths(0)).toBe('0 mo');
    expect(fmtMonths(4)).toBe('4 mo');
    expect(fmtMonths(14)).toBe('1 yr 2 mo');
    expect(fmtMonths(24)).toBe('2 yr');
    expect(fmtMonths(-3)).toBe('expired');
  });
  it('adds months clamping to month end', () => {
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2026-11-09', 14)).toBe('2028-01-09');
  });
  it('formats dates', () => {
    expect(fmtDate('2028-09-30')).toBe('Sep 30, 2028');
    expect(fmtMonthYearShort('2028-09-30')).toBe("Sep '28");
    expect(yearOf('2028-09-30')).toBe(2028);
  });
});
