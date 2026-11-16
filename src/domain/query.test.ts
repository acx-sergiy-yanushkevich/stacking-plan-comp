import { describe, expect, it } from 'vitest';
import { readBy, readPlace, readQuery, sizeText } from './query';

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

describe('words a requirement does not use (round 31)', () => {
  it('names what it left out, and nothing for plain forms', () => {
    expect(readQuery('15k nnn under $35', '2026-11-09')).toMatchObject({ kind: 'size', size: 15000, unread: ['nnn', 'under', '$35'] });
    for (const q of ['12k', '12,000 sf direct', 'need 12k SF of contiguous space by Jun 2027', '12-15k sublease']) expect(readQuery(q, '2026-11-09'), q).not.toHaveProperty('unread');
  });
});

describe('"before" leaves its date out, and more forms (round 31)', () => {
  const by = (q: string) => (readQuery(q, '2026-11-09') as { by: string | null }).by;
  it('moves the deadline back past the named day, month, quarter or year', () => {
    expect(by('12k before April 1, 2027')).toBe('2027-03-31');
    expect(by('12k before Q2 2027')).toBe('2027-03-31');
    expect(by('12k before June 2027')).toBe('2027-05-31');
    expect(by('12k before 2027')).toBe('2026-12-31');
    expect(by('12k by April 1, 2027')).toBe('2027-04-01');
  });
  it('reads "end of 2027" and a day-first 31/12/27, and lists a stray number', () => {
    expect(by('12k by end of 2027')).toBe('2027-12-31');
    expect(by('12k by 31/12/27')).toBe('2027-12-31');
    expect(readQuery('12k-15k', '2026-11-09')).not.toHaveProperty('unread');
    expect(readQuery('12k sf for 5 years', '2026-11-09')).toMatchObject({ unread: ['5', 'years'] });
    expect(readQuery('1200 sf', '2026-11-09')).not.toHaveProperty('unread');
  });
});

describe('"end of" with "before", and glued units (round 32)', () => {
  const by = (q: string) => (readQuery(q, '2026-11-09') as { by: string | null }).by;
  it('"before the end of" is the day before that end', () => {
    expect(by('12k before the end of 2027')).toBe('2027-12-30');
    expect(by('12k before end of June 2027')).toBe('2027-06-29');
    expect(by('12k before the end of Q2 2027')).toBe('2027-06-29');
    expect(by('12k by end of 2027')).toBe('2027-12-31');
  });
  it('lists nothing for "12,500sf" or "12 k"', () => {
    for (const q of ['12,500sf', '12 k']) expect(readQuery(q, '2026-11-09'), q).not.toHaveProperty('unread');
  });
});

describe('a needed-by date in the past (round 33)', () => {
  it('is named and left out, not offered', () => {
    expect(readQuery('12k before Nov 9', '2026-11-09')).toMatchObject({ by: null, pastBy: '2026-11-08' });
    expect(readQuery('12k by Jun 2027', '2026-11-09')).not.toHaveProperty('pastBy');
  });
});

describe('a month and day with no year (round 33)', () => {
  it('"by 6/1" is the next June 1', () => {
    expect((readQuery('12k by 6/1', '2026-11-09') as { by: string }).by).toBe('2027-06-01');
    expect((readQuery('12k by 12/31', '2026-11-09') as { by: string }).by).toBe('2026-12-31');
    expect(readQuery('12k 6/1', '2026-11-09')).toMatchObject({ by: null });
  });
});

describe('"before" with a month and day (round 33)', () => {
  it('is the day before, as "before June 15, 2027" is', () => {
    const by = (q: string) => (readQuery(q, '2026-11-09') as { by: string }).by;
    expect(by('12k before 6/15')).toBe('2027-06-14');
    expect(by('12k before 12/15')).toBe('2026-12-14');
    expect(by('12k before June 15, 2027')).toBe('2027-06-14');
  });
});

describe('ceilings, ranges from zero, both kinds, ordinals (round 33)', () => {
  const q = (s: string) => readQuery(s, '2026-11-09');
  it('"under 15k" and "0-15k" are up to 15k, not a minimum', () => {
    for (const s of ['under 15k', 'max 15k', 'up to 15k', '15k or less', '0-15k']) expect(q(s), s).toMatchObject({ kind: 'size', size: 100, max: 15000 });
    expect(q('15k nnn under $35')).toMatchObject({ size: 15000, unread: ['nnn', 'under', '$35'] });
    expect(q('at least 12k')).toMatchObject({ size: 12000 });
    expect(q('at least 12k')).not.toHaveProperty('unread');
  });
  it('"direct" with "sublease" asks for either', () => {
    expect(q('12k sublease direct')).toMatchObject({ fit: 'any' });
  });
  it('reads "4th floor" and a leap day', () => {
    expect(q('vacant 4th floor')).toMatchObject({ kind: 'state', floor: '4' });
    expect((q('12k by feb 29') as { by: string }).by).toBe('2028-02-29');
    expect(q('12k by 2/30')).toMatchObject({ by: null, badBy: '2/30' });
  });
});

describe('comparators beside their own size, negation and "between" (round 35)', () => {
  const q = (s: string) => readQuery(s, '2026-11-09');
  it('a ceiling applies to the size it stands beside, in any word order', () => {
    for (const s of ['12k no more than 15k', '12k but under 15k', '12k under 15k by q3 direct', 'under 15k 12k', 'between 12k and 15k', 'from 12k to 15k', '12 to 15 thousand sf'])
      expect(q(s), s).toMatchObject({ kind: 'size', size: 12000, max: 15000 });
    for (const s of ['12k no more than 15k', '12k but under 15k', 'between 12k and 15k']) expect(q(s), s).not.toHaveProperty('unread');
  });
  it('reads "not more than", "smaller than" and the symbols as ceilings', () => {
    for (const s of ['not more than 15k', 'smaller than 15k', 'less than 15k', '<15k', '≤15k', '<= 15k', 'no bigger than 15k', '15k max'])
      expect(q(s), s).toMatchObject({ kind: 'size', size: 100, max: 15000 });
  });
  it('reads floors in words and symbols without listing them', () => {
    for (const s of ['over 12k', 'more than 12k', 'at least 12k', '>12k', '≥ 12k', '12k+', '12k or more']) {
      expect(q(s), s).toMatchObject({ kind: 'size', size: 12000, max: null });
      expect(q(s), s).not.toHaveProperty('unread');
    }
  });
  it('rules a kind of space out as well as in', () => {
    expect(q('12k no sublease')).toMatchObject({ fit: 'direct' });
    expect(q('12k without sublease')).toMatchObject({ fit: 'direct' });
    expect(q('12k direct only')).toMatchObject({ fit: 'direct' });
    expect(q('12k no direct')).toMatchObject({ fit: 'sublease' });
    for (const s of ['12k no sublease', '12k direct only']) expect(q(s), s).not.toHaveProperty('unread');
  });
  it('a price after "under" is still unused, never a size', () => {
    expect(q('15k nnn under $35')).toMatchObject({ size: 15000, max: null, unread: ['nnn', 'under', '$35'] });
  });
});

describe('a ceiling at or under the floor (round 36)', () => {
  const q = (s: string) => readQuery(s, '2026-11-09');
  it('keeps a contradiction as typed, for the bar to name', () => {
    expect(q('20k under 15k')).toMatchObject({ kind: 'size', size: 20000, max: 15000 });
  });
  it('keeps equal bounds as that exact size', () => {
    expect(q('15k no more than 15k')).toMatchObject({ kind: 'size', size: 15000, max: 15000 });
  });
});

describe('negated comparators, one word per size, more kinds (round 36)', () => {
  const q = (s: string) => readQuery(s, '2026-11-09');
  it('a negated ceiling is a floor', () => {
    for (const s of ['no less than 12k', 'not less than 12k', 'not under 12k', 'no fewer than 12k']) {
      expect(q(s), s).toMatchObject({ kind: 'size', size: 12000, max: null });
      expect(q(s), s).not.toHaveProperty('unread');
    }
  });
  it('binds each comparator to one size', () => {
    expect(q('15k max 12k min')).toMatchObject({ size: 12000, max: 15000 });
    expect(q('15k max 12k min')).not.toHaveProperty('unread');
    expect(q('12k at most')).toMatchObject({ size: 100, max: 12000 });
  });
  it('reads "12 to 15 thousand sf" without listing the 12', () => {
    expect(q('12 to 15 thousand sf')).toMatchObject({ size: 12000, max: 15000 });
    expect(q('12 to 15 thousand sf')).not.toHaveProperty('unread');
  });
  it('rules sublease out with "exclude", and in with "sublease ok"', () => {
    expect(q('12k exclude sublease')).toMatchObject({ fit: 'direct' });
    expect(q('12k excluding sublease')).toMatchObject({ fit: 'direct' });
    expect(q('12k sublease ok')).toMatchObject({ fit: 'any' });
  });
});

describe('a word between two sizes, articles, dashes (round 36, part 2)', () => {
  const q = (s: string) => readQuery(s, '2026-11-09');
  it('a word between two sizes belongs to the later one unless the later has its own', () => {
    for (const s of ['min 12k max 15k', 'at least 12k max 15k', 'minimum 12k maximum 15k', '12k sf max 15k sf', '12k max 15k', '15k max 12k min']) {
      expect(q(s), s).toMatchObject({ kind: 'size', size: 12000, max: 15000 });
      expect(q(s), s).not.toHaveProperty('unread');
    }
  });
  it('reads a kind of space with an article after the negation', () => {
    expect(q('12k without a sublease')).toMatchObject({ fit: 'direct' });
    expect(q('12k not a sublease')).toMatchObject({ fit: 'direct' });
  });
  it('reads an em dash and a bare 4-digit range; two close suite numbers stay suites', () => {
    expect(q('12k—15k')).toMatchObject({ size: 12000, max: 15000 });
    expect(q('5000-8000')).toMatchObject({ size: 5000, max: 8000 });
    expect(q('1200-1250')).toBeNull();
  });
});

describe('round 37: two of a bound, more words', () => {
  const q = (s: string) => readQuery(s, '2026-11-09');
  it('two ceilings keep the tighter, two floors the higher, and neither is listed', () => {
    expect(q('under 20k max 15k')).toMatchObject({ size: 100, max: 15000 });
    expect(q('at least 12k min 15k')).toMatchObject({ size: 15000, max: null });
    for (const s of ['under 20k max 15k', 'at least 12k min 15k']) expect(q(s), s).not.toHaveProperty('unread');
  });
  it('rules direct out with the words that rule sublease out', () => {
    for (const s of ['12k excluding direct', '12k except direct', 'sublease-only 12k', '12k only sublease']) {
      expect(q(s), s).toMatchObject({ fit: 'sublease' });
      expect(q(s), s).not.toHaveProperty('unread');
    }
  });
  it('reads "bigger than" as a floor and a minus sign as a range', () => {
    expect(q('bigger than 12k')).toMatchObject({ size: 12000, max: null });
    expect(q('bigger than 12k')).not.toHaveProperty('unread');
    expect(q('12k−15k')).toMatchObject({ size: 12000, max: 15000 });
  });
});

describe('round 38: negated greater/above, a bad date alone', () => {
  const q = (s: string) => readQuery(s, '2026-11-09');
  it('"not greater than 15k" and "not above 15k" are ceilings', () => {
    for (const s of ['not greater than 15k', 'no greater than 15k', 'not above 15k']) {
      expect(q(s), s).toMatchObject({ kind: 'size', size: 100, max: 15000 });
      expect(q(s), s).not.toHaveProperty('unread');
    }
    expect(q('greater than 15k')).toMatchObject({ size: 15000, max: null });
  });
  it('a bad date with no size is named', () => {
    expect(q('by 2/30')).toEqual({ kind: 'badDate', badBy: '2/30' });
    expect(q('available by 31 feb 2027')).toEqual({ kind: 'badDate', badBy: '31 Feb 2027' });
  });
});

describe('round 37 (Opus): bounds after a range, trailing words, "or", "about", sqft, "not direct only"', () => {
  const q = (s: string) => readQuery(s, '2026-11-09');
  it('a trailing word between sizes goes to the size that owns it', () => {
    expect(q('12k max 15k max 14k')).toMatchObject({ size: 12000, max: 14000 });
    expect(q('15k max 12k min')).toMatchObject({ size: 12000, max: 15000 });
    expect(q('12k max 15k')).toMatchObject({ size: 12000, max: 15000 });
  });
  it('a bound after a range still counts', () => {
    expect(q('12k-15k max 14k')).toMatchObject({ size: 12000, max: 14000 });
    expect(q('12k-15k max 14k')).not.toHaveProperty('unread');
    expect(q('12k to 15k min 13k')).toMatchObject({ size: 13000, max: 15000 });
    expect(q('12k to 15k min 13k')).not.toHaveProperty('unread');
    expect(q('12-15k')).toMatchObject({ size: 12000, max: 15000 });
  });
  it('"12k or 15k" is the range between', () => {
    expect(q('12k or 15k')).toMatchObject({ size: 12000, max: 15000 });
    expect(q('12k or 15k')).not.toHaveProperty('unread');
    expect(q('12k or less')).toMatchObject({ size: 100, max: 12000 });
  });
  it('"about", "around", "~" and "-ish" read as a tenth either way', () => {
    for (const s of ['about 12k', 'around 12k', '~12k', '12k-ish', 'approx 12,000 sf', 'roughly 12k']) {
      expect(q(s), s).toMatchObject({ size: 10800, max: 13200 });
      expect(q(s), s).not.toHaveProperty('unread');
    }
  });
  it('"12000sqft" is read whole', () => {
    expect(q('12000sqft')).toMatchObject({ size: 12000, max: null });
    expect(q('12000sqft')).not.toHaveProperty('unread');
  });
  it('"or equal to" is part of the comparator', () => {
    expect(q('greater than or equal to 12k')).toMatchObject({ size: 12000, max: null });
    expect(q('greater than or equal to 12k')).not.toHaveProperty('unread');
    expect(q('less than or equal to 15k')).toMatchObject({ size: 100, max: 15000 });
    expect(q('less than or equal to 15k')).not.toHaveProperty('unread');
  });
  it('"not direct only" lifts the limit', () => {
    for (const s of ['12k not direct only', '12k not only direct', '12k not sublease only']) {
      expect(q(s), s).toMatchObject({ fit: 'any' });
      expect(q(s), s).not.toHaveProperty('unread');
    }
    expect(q('12k direct only')).toMatchObject({ fit: 'direct' });
    expect(q('12k no direct')).toMatchObject({ fit: 'sublease' });
  });
});

describe('sizeText and readPlace (round 37)', () => {
  it('a bare ceiling is "up to"', () => {
    expect(sizeText(100, 14000)).toBe('up to 14,000');
    expect(sizeText(12000, 15000)).toBe('12,000–15,000');
    expect(sizeText(12000, null)).toBe('12,000');
  });
  it('reads floors, runs of floors and suites', () => {
    expect(readPlace('floor 8')).toEqual({ kind: 'floors', floors: [8] });
    expect(readPlace('12th floor')).toEqual({ kind: 'floors', floors: [12] });
    expect(readPlace('floors 3-5')).toEqual({ kind: 'floors', floors: [3, 4, 5] });
    expect(readPlace('floors 5 to 3')).toEqual({ kind: 'floors', floors: [3, 4, 5] });
    expect(readPlace('unit 860')).toEqual({ kind: 'suites', suites: ['860'], floor: null });
    expect(readPlace('Suite 860.')).toEqual({ kind: 'suites', suites: ['860'], floor: null });
    expect(readPlace('860, 870')).toEqual({ kind: 'suites', suites: ['860', '870'], floor: null });
    expect(readPlace('Floor 8 Ste 860')).toEqual({ kind: 'suites', suites: ['860'], floor: 8 });
    expect(readPlace('1200-1250')).toEqual({ kind: 'suites', suites: ['1200', '1250'], floor: null });
  });
  it('a bare number or a name is not a place', () => {
    expect(readPlace('860')).toBeNull();
    expect(readPlace('Kinetic')).toBeNull();
    expect(readPlace('floor 8 delta')).toBeNull();
  });
});

describe('round 38: ceilings in more words, tolerances, chains, trailing about, floors in a state search', () => {
  const q = (s: string) => readQuery(s, '2026-11-09');
  it('"maximum of", "max.", "not to exceed" and their kin are ceilings; "minimum of" is a floor', () => {
    for (const s of ['maximum of 14k', 'max of 14k', 'with a maximum of 14,000 SF', 'max. 14k', 'not to exceed 14k', 'shall not exceed 14k', 'do not exceed 14,000 sf', 'cannot exceed 14k']) {
      expect(q(s), s).toMatchObject({ kind: 'size', size: 100, max: 14000 });
      expect(q(s), s).not.toHaveProperty('unread');
    }
    expect(q('minimum of 12k')).toMatchObject({ size: 12000, max: null });
  });
  it('"not greater than or equal to" is under, "not less than or equal to" over', () => {
    expect(q('not greater than or equal to 15,000 SF')).toMatchObject({ size: 100, max: 15000 });
    expect(q('not less than or equal to 12,000 sf')).toMatchObject({ size: 12000, max: null });
    for (const s of ['not greater than or equal to 15,000 SF', 'not less than or equal to 12,000 sf']) expect(q(s), s).not.toHaveProperty('unread');
  });
  it('a tolerance is the range it spans', () => {
    expect(q('12k +/- 2k')).toMatchObject({ size: 10000, max: 14000 });
    expect(q('12k ± 1k')).toMatchObject({ size: 11000, max: 13000 });
    expect(q('12,000 plus or minus 2,000')).toMatchObject({ size: 10000, max: 14000 });
  });
  it('sizes joined by "or" or "/" span from the least to the most; a bare number after "or" is not a size', () => {
    expect(q('12k or 15k or 18k')).toMatchObject({ size: 12000, max: 18000 });
    expect(q('10k or 12k or 15k')).toMatchObject({ size: 10000, max: 15000 });
    expect(q('12k to 15k or 20k')).toMatchObject({ size: 12000, max: 20000 });
    expect(q('12k/15k')).toMatchObject({ size: 12000, max: 15000 });
    expect(q('12k/15k')).not.toHaveProperty('unread');
    expect(q('12k or 15')).toMatchObject({ size: 12000, max: null, unread: ['15'] });
  });
  it('"about" after a size, and inside "between"', () => {
    for (const s of ['12k approx', '12,000 sf or so', '12k approximately']) expect(q(s), s).toMatchObject({ size: 10800, max: 13200 });
    expect(q('between about 12,000 and 15,000 sf')).toMatchObject({ size: 12000, max: 15000 });
  });
  it('a bare four-digit bound after a comparator counts', () => {
    expect(q('5000-8000 max 6000')).toMatchObject({ size: 5000, max: 6000 });
    expect(q('5000-8000 max 6000')).not.toHaveProperty('unread');
  });
  it('"sub-lease" and "sublease not ok"', () => {
    expect(q('12k sub-lease')).toMatchObject({ fit: 'sublease' });
    expect(q('12k sub-lease')).not.toHaveProperty('unread');
    expect(q('12k sublease not ok')).toMatchObject({ fit: 'direct' });
  });
  it('a bad date with a kind word, and a good date alone', () => {
    expect(q('by 2/30 direct')).toEqual({ kind: 'badDate', badBy: '2/30' });
    expect(q('by 31/12/27')).toEqual({ kind: 'dateOnly', by: '2027-12-31' });
  });
  it('a state search reads a run or a list of floors', () => {
    expect(q('sublease floors 7-8')).toMatchObject({ kind: 'state', label: 'Sublease', floors: [7, 8], floor: null });
    expect(q('available on floors 3-5')).toMatchObject({ kind: 'state', floors: [3, 4, 5] });
    expect(q('available on floor 4')).toMatchObject({ kind: 'state', floors: [4], floor: '4' });
  });
});

describe('round 38: readPlace reads more floor phrases and no dates', () => {
  it('"the 8th floor", lists, "fl."', () => {
    expect(readPlace('the 8th floor')).toEqual({ kind: 'floors', floors: [8] });
    expect(readPlace('floors 8 and 9')).toEqual({ kind: 'floors', floors: [8, 9] });
    expect(readPlace('floors 3, 4 and 5')).toEqual({ kind: 'floors', floors: [3, 4, 5] });
    expect(readPlace('8th and 9th floors')).toEqual({ kind: 'floors', floors: [8, 9] });
    expect(readPlace('fl. 8')).toEqual({ kind: 'floors', floors: [8] });
    expect(readPlace('ste 860 on the 8th floor')).toEqual({ kind: 'suites', suites: ['860'], floor: 8 });
    expect(readPlace('fl 8 860')).toEqual({ kind: 'suites', suites: ['860'], floor: 8 });
  });
  it('a date is not a list of suites', () => {
    expect(readPlace('31/12/27')).toBeNull();
    expect(readPlace('6/1')).toBeNull();
  });
});

describe('round 39: percentages, thru, "and", about inside a chain, a spaced thousand, floor runs in lists', () => {
  const q = (s: string) => readQuery(s, '2026-11-09');
  it('a percentage tolerance is a share of the size', () => {
    expect(q('12k ± 10%')).toMatchObject({ size: 10800, max: 13200 });
    expect(q('12k +/- 10%')).toMatchObject({ size: 10800, max: 13200 });
    expect(q('12k plus or minus 20 percent')).toMatchObject({ size: 9600, max: 14400 });
    for (const s of ['12k ± 10%', '12k +/- 10%']) expect(q(s), s).not.toHaveProperty('unread');
  });
  it('"thru", "through" and ".." are ranges', () => {
    for (const s of ['10k thru 12k', '10k through 12k', '10k..12k']) {
      expect(q(s), s).toMatchObject({ size: 10000, max: 12000 });
      expect(q(s), s).not.toHaveProperty('unread');
    }
  });
  it('a second bare size is listed, not taken as a higher minimum', () => {
    expect(q('12k and 15k')).toMatchObject({ size: 12000, max: null, unread: ['15k'] });
    expect(q('between 12k and 15k')).toMatchObject({ size: 12000, max: 15000 });
    expect(q('at least 12k min 15k')).toMatchObject({ size: 15000, max: null });
  });
  it('"about" widens only its own size in a chain', () => {
    expect(q('12k or about 15k')).toMatchObject({ size: 12000, max: 16500 });
    expect(q('about 12k or 15k')).toMatchObject({ size: 10800, max: 15000 });
  });
  it('"12 000 sf" is 12,000', () => {
    expect(q('12 000 sf')).toMatchObject({ size: 12000, max: null });
  });
  it('a run inside a list of floors', () => {
    expect(readPlace('floors 8-9 and 11')).toEqual({ kind: 'floors', floors: [8, 9, 11] });
  });
});
