import { describe, expect, it } from 'vitest';
import { readBy, readQuery } from './query';

const AS_OF = '2026-11-09';

describe('readQuery: a size in the search box is a requirement for Find space', () => {
  it('reads a size with a unit, a k or a comma, and leaves suite numbers and floors to the text search', () => {
    expect(readQuery('12000 sf', AS_OF)).toEqual({ kind: 'size', size: 12000, max: null, fit: 'any', by: null });
    expect(readQuery('12,000', AS_OF)).toMatchObject({ kind: 'size', size: 12000 });
    expect(readQuery('12k', AS_OF)).toMatchObject({ kind: 'size', size: 12000 });
    expect(readQuery('7.5k rsf', AS_OF)).toMatchObject({ kind: 'size', size: 7500 });
    expect(readQuery('12000', AS_OF)).toMatchObject({ kind: 'size', size: 12000 });
    for (const q of ['350', '1200', 'ste 1200', 'Floor 8', 'vantage', '2027']) expect(readQuery(q, AS_OF), q).toBeNull();
  });

  it('reads a range, the kind of space and the date it is needed by', () => {
    expect(readQuery('20k direct', AS_OF)).toEqual({ kind: 'size', size: 20000, max: null, fit: 'direct', by: null });
    expect(readQuery('12-15k sublease', AS_OF)).toEqual({ kind: 'size', size: 12000, max: 15000, fit: 'sublease', by: null });
    expect(readQuery('12,000 to 15,000 sf by Jun 2027', AS_OF)).toEqual({ kind: 'size', size: 12000, max: 15000, fit: 'any', by: '2027-06-30' });
    expect(readQuery('12k direct by q2 2027', AS_OF)).toMatchObject({ fit: 'direct', by: '2027-06-30' });
  });

  it('reads a state of space, and marks the words that are tenant risk', () => {
    expect(readQuery('sublease', AS_OF)).toMatchObject({ kind: 'state', label: 'Sublease', tenantRisk: false });
    expect(readQuery('Holdover', AS_OF)).toMatchObject({ kind: 'state', label: 'Holdover', tenantRisk: true });
    expect(readQuery('MTM', AS_OF)).toMatchObject({ kind: 'state', label: 'Month-to-month', tenantRisk: true });
    const available = readQuery('available', AS_OF);
    expect(available?.kind === 'state' && [...available.kinds]).toEqual(['available']);
  });
});

describe('readBy: the last day of the month or quarter named', () => {
  it('takes the next one on or after the as-of date when no year is given', () => {
    expect(readBy('june', AS_OF)).toBe('2027-06-30');
    expect(readBy('dec', AS_OF)).toBe('2026-12-31');
    expect(readBy('nov', AS_OF)).toBe('2026-11-30');
    expect(readBy('q1', AS_OF)).toBe('2027-03-31');
    expect(readBy('feb 2028', AS_OF)).toBe('2028-02-29');
    expect(readBy('6/2027', AS_OF)).toBe('2027-06-30');
    expect(readBy('2027-06-15', AS_OF)).toBe('2027-06-15');
    expect(readBy('soon', AS_OF)).toBeNull();
  });
});
