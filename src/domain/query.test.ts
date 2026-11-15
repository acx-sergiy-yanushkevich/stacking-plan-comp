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
    // "Available" is the space a tenant could take, direct or sublease: what the Available KPI counts (round 23).
    const available = readQuery('available', AS_OF);
    expect(available?.kind === 'state' && [...available.kinds]).toEqual(['available', 'sublease']);
    expect(readQuery('vacant', AS_OF)).toMatchObject({ kind: 'state', label: 'Available' });
  });

  it('reads a state word inside a longer query, and a floor it is held to (round 23: "available space" matched nothing)', () => {
    expect(readQuery('available space', AS_OF)).toMatchObject({ kind: 'state', label: 'Available', floor: null });
    expect(readQuery('subleases on floor 7', AS_OF)).toMatchObject({ kind: 'state', label: 'Sublease', floor: '7' });
    expect(readQuery('show me the holdover tenants', AS_OF)).toMatchObject({ kind: 'state', label: 'Holdover' });
    expect(readQuery('Signed, not yet in', AS_OF)).toMatchObject({ kind: 'state', label: 'Signed, not yet in' });
    expect(readQuery('condo for sale', AS_OF)).toMatchObject({ kind: 'state', label: 'For sale' });
    expect(readQuery('leases at risk', AS_OF)).toMatchObject({ kind: 'state', label: 'Holdover / month-to-month' });
    // Any other word makes it a name for the text search: "Delta sublease" is not every sublease.
    for (const q of ['delta sublease', 'vantage', 'resale partners']) expect(readQuery(q, AS_OF), q).toBeNull();
  });
});

describe('readQuery: the way brokers type a requirement (round 23)', () => {
  it('reads the needed-by date wherever it is, and cuts only the date words', () => {
    expect(readQuery('12k by Jun 2027 direct', AS_OF)).toEqual({ kind: 'size', size: 12000, max: null, fit: 'direct', by: '2027-06-30' });
    // Todd's own phrasing: a bare quarter is the next one on or after the as-of date.
    expect(readQuery('20k contiguous SF, Q2, direct', AS_OF)).toEqual({ kind: 'size', size: 20000, max: null, fit: 'direct', by: '2027-06-30' });
    expect(readQuery('15k sublease in Q2', AS_OF)).toEqual({ kind: 'size', size: 15000, max: null, fit: 'sublease', by: '2027-06-30' });
    expect(readQuery('need 12k sf in 2027', AS_OF)).toMatchObject({ size: 12000, by: '2027-12-31' });
    expect(readQuery('12k sf before 2028', AS_OF)).toMatchObject({ size: 12000, by: '2027-12-31' });
    expect(readQuery('Q3 2027 12k', AS_OF)).toMatchObject({ size: 12000, by: '2027-09-30' });
    expect(readQuery('12k for march', AS_OF)).toMatchObject({ size: 12000, by: '2027-03-31' });
    expect(readQuery('12k june 2027 sublease', AS_OF)).toMatchObject({ size: 12000, fit: 'sublease', by: '2027-06-30' });
    expect(readQuery('12k needed by 6/2027', AS_OF)).toMatchObject({ size: 12000, by: '2027-06-30' });
    expect(readQuery('12k direct by 2027-06-15', AS_OF)).toMatchObject({ size: 12000, fit: 'direct', by: '2027-06-15' });
    // Words that are not a date stay words: no date is guessed.
    expect(readQuery('12k by the stairs', AS_OF)).toMatchObject({ size: 12000, by: null });
    expect(readQuery('12k may work', AS_OF)).toMatchObject({ size: 12000, by: null });
    expect(readQuery('12k 2027', AS_OF)).toMatchObject({ size: 12000, by: null });
  });

  it('gives a "k" to the number that carries it; a trailing one covers a bare first number', () => {
    expect(readQuery('12k to 15000 sf', AS_OF)).toMatchObject({ size: 12000, max: 15000 });
    expect(readQuery('12,000-15k', AS_OF)).toMatchObject({ size: 12000, max: 15000 });
    expect(readQuery('12-15k', AS_OF)).toMatchObject({ size: 12000, max: 15000 });
    expect(readQuery('7.5-10k rsf', AS_OF)).toMatchObject({ size: 7500, max: 10000 });
    expect(readQuery('12k-15k', AS_OF)).toMatchObject({ size: 12000, max: 15000 });
  });

  it('reads a range given high to low as low to high', () => {
    expect(readQuery('15k-12k', AS_OF)).toMatchObject({ size: 12000, max: 15000 });
    expect(readQuery('15,000 to 12,000 sf', AS_OF)).toMatchObject({ size: 12000, max: 15000 });
  });

  it('a floor range or a year range is not a size', () => {
    for (const q of ['floors 7-8', '2026-2027', 'ste 850-860']) expect(readQuery(q, AS_OF), q).toBeNull();
    // A size after a floor range is still read.
    expect(readQuery('floors 7-8 12k', AS_OF)).toMatchObject({ size: 12000, max: null });
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
    expect(readBy('q2, 2027', AS_OF)).toBe('2027-06-30');
    expect(readBy('2027', AS_OF)).toBe('2027-12-31');
    expect(readBy('soon', AS_OF)).toBeNull();
  });
});

describe('a needed-by date the calendar has not (round 26)', () => {
  it('is cut and named, never dropped quietly; a real leap day is read', () => {
    const bad = readQuery('12k by 2027-02-30', '2026-11-09');
    expect(bad).toMatchObject({ kind: 'size', size: 12000, by: null, badBy: '2027-02-30' });
    expect(readQuery('12k by 2027-02-29', '2026-11-09')).toMatchObject({ by: null, badBy: '2027-02-29' });
    expect(readQuery('12k by 2028-02-29', '2026-11-09')).toMatchObject({ by: '2028-02-29' });
    expect(readQuery('12k by 2028-02-29', '2026-11-09')).not.toHaveProperty('badBy');
  });
});

describe('a month with a day in the search (round 29)', () => {
  it('reads the day and its year, never the end of the month of the wrong year', () => {
    expect(readQuery('12k by February 15, 2028', '2026-11-09')).toMatchObject({ by: '2028-02-15' });
    expect(readQuery('12k by Jun 3rd 2027', '2026-11-09')).toMatchObject({ by: '2027-06-03' });
    // Without a year it is the next such day on or after the as-of month, as a bare month is.
    expect(readQuery('12k by Mar 5', '2026-11-09')).toMatchObject({ by: '2027-03-05' });
  });
  it('names a day the calendar has not and runs nothing', () => {
    expect(readQuery('12k by February 30, 2027', '2026-11-09')).toMatchObject({ by: null, badBy: 'February 30, 2027' });
  });
  it('still reads a month and year, and leaves a size after a month alone', () => {
    expect(readQuery('12k by Jun 2027', '2026-11-09')).toMatchObject({ by: '2027-06-30' });
    expect(readQuery('may 20000 sf', '2026-11-09')).toMatchObject({ size: 20000 });
  });
});

describe('more ways to write a day (round 30)', () => {
  it('reads M/D/YYYY, day first, and a year-less day after the as-of date', () => {
    expect(readQuery('12k by 06/01/2027', '2026-11-09')).toMatchObject({ by: '2027-06-01' });
    expect(readQuery('5k by 3/15/2027', '2026-11-09')).toMatchObject({ by: '2027-03-15' });
    expect(readQuery('12k by 15 Jan 2027', '2026-11-09')).toMatchObject({ by: '2027-01-15' });
    expect(readQuery('12k by 3rd March 2027', '2026-11-09')).toMatchObject({ by: '2027-03-03' });
    // Nov 5 is behind an as-of date of Nov 9: the next one is next year's. Nov 9 itself is today.
    expect(readQuery('12k by Nov 5', '2026-11-09')).toMatchObject({ by: '2027-11-05' });
    expect(readQuery('12k by Nov 9', '2026-11-09')).toMatchObject({ by: '2026-11-09' });
    expect(readQuery('12k by Nov 20', '2026-11-09')).toMatchObject({ by: '2026-11-20' });
  });
  it('names a US or day-first date the calendar has not', () => {
    expect(readQuery('12k by 2/30/2027', '2026-11-09')).toMatchObject({ by: null, badBy: '2/30/2027' });
    expect(readQuery('12k by 31 Feb 2027', '2026-11-09')).toMatchObject({ by: null, badBy: '31 Feb 2027' });
  });
  it('does not take a size for a date', () => {
    expect(readQuery('12000 sf', '2026-11-09')).toMatchObject({ size: 12000 });
    expect(readQuery('5 may 20000 sf', '2026-11-09')?.kind).toBe('size');
  });

  it('reads a two-digit year and rejects a day the calendar lacks (round 31)', () => {
    expect(readQuery('12k by 1/6/27', '2026-11-09')).toMatchObject({ by: '2027-01-06' });
    expect(readQuery('12k by 2/30/27', '2026-11-09')).toMatchObject({ by: null, badBy: '2/30/27' });
  });
});
