import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { deriveFloors } from './derive';
import { chosenOption, filterFits, findFits, matchingInquiries, nearMisses, neededByDate, optionSuites, type FitOption } from './finder';
import type { Availability, Floor, Lease, Property } from './types';

const at = (asOf: string) => deriveFloors(property, asOf, TODAY);
const withKeys = (options: FitOption[], keys: string[]) =>
  options.find((o) => o.keys.length === keys.length && keys.every((k) => o.keys.includes(k)));

describe('findFits on the mock building today', () => {
  const floors = at(TODAY);

  it('reports the largest contiguous block available now', () => {
    const { largestNow } = findFits(floors, 12000, null, null, property.inquiries, TODAY);
    expect(largestNow).toEqual({ size: 9300, floorName: 'Floor 12' });
  });

  describe('12,000 SF requirement', () => {
    const { options, keys } = findFits(floors, 12000, null, null, property.inquiries, TODAY);

    it('only offers space at or above the requirement', () => {
      expect(options.length).toBeGreaterThan(0);
      for (const o of options) expect(o.size).toBeGreaterThanOrEqual(12000);
    });
    it('offers Floor 6 marketed for later as a direct option from its available-from date', () => {
      expect(keys.has('L13-U1')).toBe(true);
      const f6 = withKeys(options, ['L13-U1'])!;
      expect(f6.from).toBe('2027-04-01');
      expect(f6.type).toBe('Direct');
      expect(f6.inquiries).toBe(1); // Harbor Freight only
      expect(f6.dealList?.map((d) => d.prospect)).toEqual(['Vantage Robotics', 'Harbor Freight Regional HQ']);
    });
    it('ranks an on-time option first', () => {
      expect(options[0].late).toBeFalsy();
    });
    it('has no multi-floor option: no two vertically adjacent floors are both vacant now', () => {
      // F12, F8, F3 and F1 each have direct availability, but every floor adjacent to them is fully leased
      // and the F6 block is only marketed for Apr 2027, so there is nothing to pair.
      expect(options.some((o) => o.multiFloor)).toBe(false);
    });
  });

  describe('4,000 SF requirement', () => {
    const { options, keys } = findFits(floors, 4000, null, null, property.inquiries, TODAY);

    it('offers suite 120 on Floor 1 and counts the one inquiry that fits it', () => {
      const s120 = withKeys(options, ['A01'])!;
      expect(s120).toBeDefined();
      expect(s120.floorName).toBe('Floor 1');
      expect(s120.size).toBe(4000);
      expect(s120.inquiries).toBe(1); // Kestrel Labs 3,000–4,500 by Jan 15, 2027
      expect(s120.deals).toBe(1);
    });
    it('offers the Floor 8 run both combined and as its single suite that fits', () => {
      const run = withKeys(options, ['A06', 'A07'])!;
      expect(run.contiguous).toBe(true);
      expect(run.size).toBe(7400);
      expect(run.inquiries).toBe(2); // Pinecrest takes both suites (7,400); Kestrel takes suite 860 alone (3,200)
      expect(withKeys(options, ['A06'])?.size).toBe(4200);
      expect(withKeys(options, ['A07'])).toBeUndefined(); // 3,200 is too small
    });
    it('offers the Floor 7 sublease', () => {
      const sub = withKeys(options, ['L14-U2'])!;
      expect(sub.type).toBe('Sublease');
      expect(sub.size).toBe(7000);
    });
    it('counts the divisible Floor 3 suite for both inquiries it can serve', () => {
      expect(withKeys(options, ['A02'])?.inquiries).toBe(2); // Northwind (whole) + Kestrel (split)
    });
    it('never offers the retail condo for sale', () => {
      expect(keys.has('A10')).toBe(false);
    });
  });

  it('never offers the for-sale condo even when it is big enough', () => {
    const { keys, options } = findFits(floors, 2000, null, null, property.inquiries, TODAY);
    expect(keys.has('A10')).toBe(false);
    expect(options.every((o) => o.type === 'Direct' || o.type === 'Sublease')).toBe(true);
  });

  describe('7,000–8,000 SF needed by Jan 15, 2027', () => {
    const { options } = findFits(floors, 7000, '2027-01-15', 8000, property.inquiries, TODAY);

    it('keeps the Floor 8 contiguous run on time', () => {
      const run = withKeys(options, ['A06', 'A07'])!;
      expect(run).toBeDefined();
      expect(run.size).toBe(7400);
      expect(run.late).toBe(false);
    });
    it('keeps the divisible Floor 6 block as a split, flagged late', () => {
      const f6 = withKeys(options, ['L13-U1'])!;
      expect(f6).toBeDefined();
      expect(f6.splitTo).toBe(8000);
      expect(f6.late).toBe(true);
    });
    it('drops suite 1250: too big and not divisible', () => {
      expect(withKeys(options, ['A08'])).toBeUndefined();
    });
    it('ranks late options last', () => {
      const firstLate = options.findIndex((o) => o.late);
      expect(firstLate === -1 || options.slice(firstLate).every((o) => o.late)).toBe(true);
    });
  });

  it('filters by fit type', () => {
    const { options } = findFits(floors, 4000, null, null, property.inquiries, TODAY);
    expect(filterFits(options, 'any')).toBe(options);
    expect(filterFits(options, 'direct').every((o) => o.type === 'Direct')).toBe(true);
    expect(filterFits(options, 'sublease').map((o) => o.keys)).toEqual([['L14-U2']]);
  });
});

describe('matchingInquiries', () => {
  it('matches the Floor 6 block to Harbor Freight only', () => {
    const hits = matchingInquiries(
      property.inquiries,
      { size: 21400, divisible: true, minDivisible: 7000, from: '2027-04-01' },
      TODAY,
    );
    // Pinecrest (7,000–8,000) could take a split but needs it by Feb 1, 2027, before the space frees up.
    expect(hits.map((i) => i.id)).toEqual(['I02']);
  });
  it('uses whole-suite sizes when a run has no divisible suite', () => {
    const hits = matchingInquiries(
      property.inquiries,
      { size: 7400, divisible: false, minDivisible: null, from: null, sizes: [4200, 7400, 3200] },
      TODAY,
    );
    expect(hits.map((i) => i.id)).toEqual(['I03', 'I04']); // Kestrel takes 3,200; Pinecrest takes both suites
  });
});

describe('findFits with time travel', () => {
  it('offers Floor 6 as available now once Cirrus has left', () => {
    const floors = at('2027-05-01');
    const { options } = findFits(floors, 20000, null, null, property.inquiries, '2027-05-01');
    const f6 = options.find((o) => o.floorId === 'F6')!;
    expect(f6).toBeDefined();
    expect(f6.from).toBeNull();
    expect(f6.size).toBe(21400);
    expect(f6.type).toBe('Direct');
  });
});

// ── Synthetic buildings for rules the mock cannot show ──────────────────────

const floorOf = (n: number, size: number): Floor => ({ id: `F${n}`, name: `Floor ${n}`, sequence: n, size, nonLeasable: 0 });
const vacant = (id: string, floorId: string, suite: string, size: number, order: number, extra: Partial<Availability> = {}): Availability => ({
  id,
  kind: 'Lease',
  floorId,
  suite,
  size,
  order,
  status: 'Open',
  isVacant: true,
  availableFrom: null,
  sublease: false,
  subleaseExpiration: null,
  rentLow: 30,
  rentHigh: 32,
  rateUnit: 'yr',
  leaseType: 'FSG',
  divisible: false,
  minDivisible: null,
  inquiries: 0,
  deals: [],
  verifiedAt: TODAY,
  ...extra,
});
const tenant = (id: string, floorId: string, suite: string, size: number, order: number): Lease => ({
  id,
  tenant: `Tenant ${id}`,
  floorId,
  units: [{ id: `${id}-U1`, floorId, suite, size, order }],
  commencement: '2024-01-01',
  expiration: '2030-12-31',
  termination: null,
  rate: 30,
  rateUnit: 'yr',
  leaseType: 'FSG',
  confidential: false,
  deals: [],
  verifiedAt: TODAY,
});
const building = (floors: Floor[], leases: Lease[], availabilities: Availability[]): Property => ({
  ...property,
  floors,
  leases,
  availabilities,
  inquiries: [],
  history: [],
});

describe('multi-floor pairing', () => {
  it('combines the largest runs of two vertically adjacent vacant floors', () => {
    const p = building(
      [floorOf(1, 10000), floorOf(2, 10000), floorOf(3, 10000)],
      [tenant('L1', 'F3', '300', 10000, 1)],
      [vacant('A1', 'F1', '100', 10000, 1), vacant('A2', 'F2', '200', 10000, 1)],
    );
    const { options } = findFits(deriveFloors(p, TODAY, TODAY), 15000, null, null, [], TODAY);
    const pair = options.find((o) => o.multiFloor)!;
    expect(pair).toBeDefined();
    expect(pair.size).toBe(20000);
    expect(pair.floorName).toBe('Floors 1–2');
    expect(pair.keys.sort()).toEqual(['A1', 'A2']);
    expect(pair.from).toBeNull();
    expect(options.filter((o) => o.multiFloor)).toHaveLength(1); // F3 is leased, so F2–F3 is not offered
  });
});

describe('for-sale units', () => {
  it('break a contiguous run like a leased neighbour and are never offered', () => {
    const p = building(
      [floorOf(1, 10000)],
      [tenant('L1', 'F1', '140', 2000, 4)],
      [
        vacant('A1', 'F1', '110', 3000, 1),
        vacant('S1', 'F1', '120', 2000, 2, { kind: 'Sale', askingPrice: 900000, rentLow: 0, rentHigh: 0 }),
        vacant('A2', 'F1', '130', 3000, 3),
      ],
    );
    const floors = deriveFloors(p, TODAY, TODAY);
    expect(floors[0].segments.map((s) => s.kind)).toEqual(['available', 'forsale', 'available', 'leased']);

    const wide = findFits(floors, 5000, null, null, [], TODAY);
    expect(wide.options).toEqual([]); // 3,000 + 3,000 would fit, but the condo between them splits the run

    const narrow = findFits(floors, 1000, null, null, [], TODAY);
    expect(narrow.keys.has('S1')).toBe(false);
    expect(narrow.options.map((o) => o.keys).sort()).toEqual([['A1'], ['A2']]);
  });

  it('are not offered as later space when a leased suite is marketed for sale', () => {
    const p = building(
      [floorOf(1, 10000)],
      [tenant('L1', 'F1', '100', 10000, 1)],
      [vacant('S1', 'F1', '100', 10000, 1, { kind: 'Sale', isVacant: false, askingPrice: 4000000, rentLow: 0, rentHigh: 0 })],
    );
    const floors = deriveFloors(p, TODAY, TODAY);
    expect(floors[0].segments[0].marketed?.kind).toBe('Sale');
    const { options } = findFits(floors, 1000, null, null, [], TODAY);
    expect(options).toEqual([]);
  });
});

describe('nearMisses', () => {
  const floors = deriveFloors(property, TODAY, TODAY);

  it('lists the closest smaller spaces and adjacent-floor stacks for a requirement nothing fits now', () => {
    const misses = nearMisses(floors, 12000, TODAY);
    expect(misses.length).toBeGreaterThan(0);
    expect(misses.every((m) => m.keys.every((k) => k !== 'A10'))).toBe(true);
    const first = misses[0];
    expect(first.shortfall).toBeLessThanOrEqual(misses[misses.length - 1].shortfall);
    // Floors 7 and 8 together (7,000 sublease + 7,400 direct) make a 14,400 SF stack.
    expect(misses.find((m) => m.kind === 'stack' && m.size === 14400)).toMatchObject({ floorName: 'Floors 7–8', type: 'Direct + sublease', shortfall: 0 });
  });

  it('holds every alternative to the space type asked for, before the list is cut to its limit', () => {
    const any = nearMisses(floors, 12000, TODAY, 'any');
    expect(any).toEqual(nearMisses(floors, 12000, TODAY));
    expect(new Set(any.map((m) => m.type)).has('Direct + sublease')).toBe(true);

    const sublease = nearMisses(floors, 12000, TODAY, 'sublease');
    expect(sublease.length).toBeGreaterThan(0);
    expect(sublease.every((m) => m.type === 'Sublease')).toBe(true);
    // The 7,000 SF sublease on Floor 7 is the near miss a sublease-only search is for: it used to be
    // pushed off the four-row list by direct and mixed stacks.
    expect(sublease).toContainEqual(expect.objectContaining({ kind: 'short', floorName: 'Floor 7', size: 7000, shortfall: 5000, keys: ['L14-U2'] }));

    const direct = nearMisses(floors, 12000, TODAY, 'direct');
    expect(direct.length).toBeGreaterThan(0);
    expect(direct.every((m) => m.type === 'Direct')).toBe(true);
    // The mixed Floors 7–8 stack is not direct space; no key of a sublet suite is in any direct row.
    expect(direct.some((m) => m.size === 14400)).toBe(false);
    expect(direct.flatMap((m) => m.keys)).not.toContain('L14-U2');
    for (const m of direct) for (const s of optionSuites(floors, m.keys, TODAY)) expect(s.type, `${m.floorName} ${s.key}`).toBe('Direct');
  });

  it('the limit is spent on rows of the asked type: a sublease search is not left with fewer rows than exist', () => {
    const all = nearMisses(floors, 12000, TODAY, 'sublease', 100);
    expect(nearMisses(floors, 12000, TODAY, 'sublease', 4)).toEqual(all.slice(0, 4));
    expect(nearMisses(floors, 12000, TODAY, 'direct', 2)).toHaveLength(2);
  });
});

describe('a finder row as the option that is kept', () => {
  const floors = deriveFloors(property, TODAY, TODAY);
  const stack = nearMisses(floors, 12000, TODAY).find((m) => m.kind === 'stack' && m.size === 14400)!;

  it('chosenOption keeps every suite of a multi-floor alternative, its total, type and timing', () => {
    const option = chosenOption(stack);
    expect(option).toEqual({ title: 'Floors 7–8', keys: stack.keys, size: 14400, type: 'Direct + sublease', from: stack.from, shortfall: 0 });
    expect(option.keys.length).toBeGreaterThan(1);
    // A copy: the option does not change if the finder's own row does.
    expect(option.keys).not.toBe(stack.keys);
  });

  it('optionSuites lists each suite of the option, top floor first, and they add up to the option', () => {
    const suites = optionSuites(floors, stack.keys, TODAY);
    expect(suites.map((s) => s.key)).toEqual(stack.keys);
    expect(suites.reduce((t, s) => t + s.size, 0)).toBe(stack.size);
    expect(new Set(suites.map((s) => s.floorName))).toEqual(new Set(['Floor 8', 'Floor 7']));
    expect(suites[0].floorName).toBe('Floor 8');
    expect(suites.find((s) => s.key === 'L14-U2')).toMatchObject({ floorId: 'F7', suite: '720', size: 7000, type: 'Sublease' });
    expect(suites.filter((s) => s.type === 'Direct').reduce((t, s) => t + s.size, 0)).toBe(7400);
  });

  it('keeps an exact multi-floor option whole too, and its shortfall is zero', () => {
    const { options } = findFits(floors, 12000, null, null, [], TODAY);
    const multi = options.find((o) => o.multiFloor);
    if (multi) {
      const option = chosenOption(multi);
      expect([option.keys, option.size, option.shortfall]).toEqual([multi.keys, multi.size, 0]);
      expect(optionSuites(floors, option.keys, TODAY).reduce((t, s) => t + s.size, 0)).toBe(multi.size);
    }
    const short = nearMisses(floors, 12000, TODAY).find((m) => m.shortfall > 0)!;
    expect(chosenOption(short).shortfall).toBe(short.shortfall);
  });

  it('optionSuites leaves out a key that is not lease space, and counts an occupied suite by what is marketed', () => {
    expect(optionSuites(floors, ['A10', 'nope', 'F2-gap'], TODAY)).toEqual([]);
    // Suite 600 is occupied and marketed from April 2027: the space is the listing's, dated.
    expect(optionSuites(floors, ['L13-U1'], TODAY)).toEqual([expect.objectContaining({ key: 'L13-U1', floorName: 'Floor 6', suite: '600', size: 21400, type: 'Direct', from: '2027-04-01' })]);
    // Once that date has passed it reads as now.
    expect(optionSuites(floors, ['L13-U1'], '2027-04-01')[0].from).toBeNull();
  });
});

describe('needed by: an exact date, today included', () => {
  const floors = deriveFloors(property, TODAY, TODAY);

  it('neededByDate accepts a whole calendar date and nothing else', () => {
    expect(neededByDate(TODAY)).toBe(TODAY);
    expect(neededByDate('2026-11-23')).toBe('2026-11-23');
    expect(neededByDate('2028-02-29')).toBe('2028-02-29');
    for (const bad of ['', '2026-11', '2026-13-01', '2027-02-30', '11/23/2026', '2026-1-5', 'today']) expect(neededByDate(bad), bad).toBeNull();
  });

  it('needed today: space available now is on time and space marketed for later is late', () => {
    const { options } = findFits(floors, 5000, TODAY, null, [], TODAY);
    expect(options.some((o) => o.from === null && !o.late)).toBe(true);
    const later = options.filter((o) => o.from !== null && o.from > TODAY);
    expect(later.length).toBeGreaterThan(0);
    expect(later.every((o) => o.late)).toBe(true);
    // On-time options are ranked first.
    expect(options.findIndex((o) => o.late)).toBeGreaterThanOrEqual(options.filter((o) => !o.late).length);
  });

  it('an exact date inside a month is not the first of that month: a listing dated the 1st is on time for the 15th and late for the day before', () => {
    const when = (by: string) => findFits(floors, 20000, by, null, [], TODAY).options.find((o) => o.keys.includes('L13-U1'))!;
    expect(when('2027-04-15')).toMatchObject({ from: '2027-04-01', late: false });
    expect(when('2027-04-01').late).toBe(false);
    expect(when('2027-03-31').late).toBe(true);
  });
});
