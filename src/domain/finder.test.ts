import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { deriveFloors } from './derive';
import { checkNeededBy, chosenOption, filterFits, findFits, matchingInquiries, nearMisses, neededByDate, noFit, optionSuites, searchSpace, suitesLabel, type FitOption, type Requirement } from './finder';
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

describe('one floor, one alternative', () => {
  const floors = deriveFloors(property, TODAY, TODAY);
  const want = (size: number, type: Requirement['type'] = 'any', max: number | null = null): Requirement => ({ size, max, by: null, type });

  it('12,000 SF Direct lists Floor 8 once, as both suites together, not again as Ste 850 alone', () => {
    const { options, alternatives } = searchSpace(floors, want(12000, 'direct'), property.inquiries, TODAY);
    expect(options.length).toBeLessThan(3);
    const floor8 = alternatives.filter((m) => m.floorName === 'Floor 8');
    expect(floor8).toEqual([expect.objectContaining({ kind: 'short', size: 7400, shortfall: 4600, keys: ['A06', 'A07'], suites: 'Ste 850 + Ste 860', type: 'Direct' })]);
    // It used to be listed a second time: 4,200 SF, 7,800 SF short, which is Ste 850 of the same block.
    expect(alternatives.some((m) => m.size === 4200 || m.size === 3200)).toBe(false);
    // The freed slot goes to another floor: every row is a different floor.
    expect(new Set(alternatives.map((m) => m.floorName)).size).toBe(alternatives.length);
  });

  it('no alternative is a part of another alternative on its floor, for any size and type', () => {
    for (const type of ['any', 'direct', 'sublease'] as const) {
      for (const size of [3000, 5000, 8000, 12000, 20000, 40000]) {
        const rows = nearMisses(floors, size, TODAY, type, 100);
        for (const m of rows.filter((x) => x.kind === 'short')) {
          const others = rows.filter((n) => n !== m && n.kind === 'short' && n.floorName === m.floorName);
          expect(others.some((n) => m.keys.every((k) => n.keys.includes(k))), `${type} ${size} ${m.floorName} ${m.keys}`).toBe(false);
        }
      }
    }
  });

  it('a suite that is part of an exact option is not offered again as a smaller alternative', () => {
    // 7,000 SF Direct: Floor 8 (7,400 SF, both suites) is an option. Ste 850 alone, 2,800 SF short, is not an alternative to it.
    const { options } = findFits(floors, 7000, null, null, property.inquiries, TODAY);
    const block = withKeys(options, ['A06', 'A07'])!;
    expect(block.size).toBe(7400);
    // On its own the function lists the two Floor 8 suites: nothing tells it the block is already offered.
    expect(nearMisses(floors, 7000, TODAY, 'direct', 100).filter((m) => m.floorName === 'Floor 8').map((m) => m.suites)).toEqual(['Ste 850', 'Ste 860']);
    // Told what the options are, it lists neither; the other floors are unaffected.
    const rows = nearMisses(floors, 7000, TODAY, 'direct', 100, options.map((o) => o.keys));
    expect(rows.some((m) => m.keys.includes('A06') || m.keys.includes('A07'))).toBe(false);
    expect(rows.map((m) => m.floorName)).toEqual(['Floor 3', 'Floor 1']);
    // searchSpace passes the options in: whenever alternatives are listed, none is a part of an option.
    for (const size of [3000, 5000, 7000, 8000, 9000, 12000, 20000]) {
      for (const type of ['any', 'direct', 'sublease'] as const) {
        const r = searchSpace(floors, want(size, type), property.inquiries, TODAY);
        for (const m of r.alternatives.filter((x) => x.kind === 'short')) for (const o of r.options) expect(m.keys.every((k) => o.keys.includes(k)), `${size} ${type} ${m.floorName}`).toBe(false);
      }
    }
  });

  it('a stack of two floors is a different proposal and is kept beside the single floors in it', () => {
    const rows = nearMisses(floors, 12000, TODAY);
    expect(rows.find((m) => m.kind === 'stack')).toMatchObject({ floorName: 'Floors 7–8', suites: 'Ste 850 + Ste 860 on Floor 8, Ste 720 on Floor 7' });
    expect(rows.some((m) => m.kind === 'short' && m.floorName === 'Floor 8')).toBe(true);
  });
});

describe('every finder row names its suites', () => {
  const floors = deriveFloors(property, TODAY, TODAY);

  it('suitesLabel: one suite, several on a floor, several floors, in plan order whatever order the keys come in', () => {
    expect(suitesLabel(floors, ['A06'])).toBe('Ste 850');
    expect(suitesLabel(floors, ['A07', 'A06'])).toBe('Ste 850 + Ste 860');
    expect(suitesLabel(floors, ['L14-U2', 'A06', 'A07'])).toBe('Ste 850 + Ste 860 on Floor 8, Ste 720 on Floor 7');
    expect(suitesLabel(floors, [])).toBe('');
    // Space with no suite number is named by its floor, never left blank.
    const bare = floors.map((f) => ({ ...f, segments: f.segments.map((s) => (s.key === 'A06' ? { ...s, suite: null } : s)) }));
    expect(suitesLabel(bare, ['A06', 'A07'])).toBe('Floor 8 + Ste 860');
  });

  it('every option and every alternative carries the suites its keys stand for', () => {
    for (const size of [3000, 4000, 7000, 12000, 20000]) {
      const { options, alternatives } = searchSpace(floors, { size, max: null, by: null, type: 'any' }, property.inquiries, TODAY);
      for (const row of [...options, ...alternatives]) {
        expect(row.suites, `${size} ${row.floorName}`).toBe(suitesLabel(floors, row.keys));
        expect(row.suites).toMatch(/^Ste \d+/);
        expect(row.suites.match(/Ste \d+/g)).toHaveLength(row.keys.length);
      }
    }
    const { options } = findFits(floors, 4000, null, null, property.inquiries, TODAY);
    expect(withKeys(options, ['A06', 'A07'])!.suites).toBe('Ste 850 + Ste 860');
    expect(withKeys(options, ['A06'])!.suites).toBe('Ste 850');
    // An occupied suite marketed for later is named too.
    expect(withKeys(findFits(floors, 12000, null, null, property.inquiries, TODAY).options, ['L13-U1'])!.suites).toBe('Ste 600');
  });
});

describe('when nothing fits, the advice is only what applies', () => {
  const floors = deriveFloors(property, TODAY, TODAY);
  const advise = (req: Requirement) => {
    const r = searchSpace(floors, req, property.inquiries, TODAY);
    expect(r.options).toHaveLength(0);
    return r.noFit!;
  };

  it('40,000 SF with nothing else set: no maximum, type or date to change, so it says how much space there is', () => {
    const a = advise({ size: 40000, max: null, by: null, type: 'any' });
    expect([a.withoutMax, a.anyType, a.withoutBoth]).toEqual([0, 0, 0]);
    expect(a.message).toMatch(/^The largest block available now is 9,300 SF on Floor 12\./);
    expect(a.message).not.toMatch(/maximum|type|date/i);
  });

  it('says the closest spaces are listed below only when some are', () => {
    const r = searchSpace(floors, { size: 40000, max: null, by: null, type: 'any' }, property.inquiries, TODAY);
    expect(r.alternatives.length > 0).toBe(r.noFit!.message.includes('listed below'));
    expect(noFit(floors, { size: 40000, max: null, by: null, type: 'any' }, property.inquiries, TODAY, false).message).toBe('The largest block available now is 9,300 SF on Floor 12.');
    expect(noFit(floors, { size: 40000, max: null, by: null, type: 'any' }, property.inquiries, TODAY, true).message).toBe('The largest block available now is 9,300 SF on Floor 12. The closest spaces and floor combinations are listed below.');
  });

  it('a maximum that is in the way is named, with the number of options without it; the type and the date are not', () => {
    // 1,000–1,200 SF: no suite is that small and none can be split that far down.
    const a = advise({ size: 1000, max: 1200, by: null, type: 'any' });
    expect(a.withoutMax).toBe(findFits(floors, 1000, null, null, property.inquiries, TODAY).options.length);
    expect(a.withoutMax).toBeGreaterThan(1);
    expect([a.anyType, a.withoutBoth]).toEqual([0, 0]);
    expect(a.message).toBe(`Without the 1,200 SF maximum, ${a.withoutMax} options fit.`);
    expect(a.message).not.toMatch(/type|date/i);
  });

  it('a type that is in the way is named; a maximum that is not set is not', () => {
    // 8,000 SF of sublease space: the only sublease is 7,000 SF, and direct space of that size exists.
    const a = advise({ size: 8000, max: null, by: null, type: 'sublease' });
    expect([a.withoutMax, a.anyType, a.withoutBoth]).toEqual([0, 2, 0]);
    expect(a.message).toBe('With the type set to Any instead of Sublease, 2 options fit.');
    expect(a.message).not.toMatch(/maximum|date/);
    // Both in the way, each on its own: a 1,000–3,000 SF sublease. Each is named, with its own count.
    const two = advise({ size: 1000, max: 3000, by: null, type: 'sublease' });
    expect([two.withoutMax, two.anyType, two.withoutBoth]).toEqual([1, 1, 0]);
    expect(two.message).toBe('Without the 3,000 SF maximum, 1 option fits. With the type set to Any instead of Sublease, 1 option fits.');
  });

  it('when only both changes together help, it says so once; when neither helps, it says neither', () => {
    // Without the divisible Floor 6 block: a sublease of 8,000–8,500 SF. Any type alone finds nothing (the 9,300 SF
    // suite is over the maximum), no maximum alone finds nothing (the only sublease is 7,000 SF); both together find Ste 1250.
    const noSix = floors.map((f) => ({ ...f, segments: f.segments.map((s) => (s.marketed ? { ...s, marketed: undefined } : s)) }));
    const both = searchSpace(noSix, { size: 8000, max: 8500, by: null, type: 'sublease' }, property.inquiries, TODAY).noFit!;
    expect([both.withoutMax, both.anyType, both.withoutBoth]).toEqual([0, 0, 1]);
    expect(both.message).toBe('Without the 8,500 SF maximum and with the type set to Any, 1 option fits.');
    // 40,000–45,000 SF Direct: nothing that large exists whatever is relaxed.
    const neither = advise({ size: 40000, max: 45000, by: '2027-06-01', type: 'direct' });
    expect([neither.withoutMax, neither.anyType, neither.withoutBoth]).toEqual([0, 0, 0]);
    expect(neither.message).toMatch(/^The largest block available now is 9,300 SF on Floor 12\./);
    expect(neither.message).not.toMatch(/maximum|type|date/i);
  });

  it('the needed-by date is never the suggestion: a later space is listed late, not left out', () => {
    for (const by of [null, TODAY, '2027-06-01', '2031-01-01']) {
      const count = filterFits(findFits(floors, 12000, by, null, property.inquiries, TODAY).options, 'any').length;
      expect(count, String(by)).toBe(filterFits(findFits(floors, 12000, null, null, property.inquiries, TODAY).options, 'any').length);
    }
    expect(searchSpace(floors, { size: 12000, max: null, by: TODAY, type: 'any' }, property.inquiries, TODAY).noFit).toBeNull();
  });

  it('an empty building says so', () => {
    const empty = floors.map((f) => ({ ...f, maxContiguous: 0, segments: f.segments.filter((s) => s.kind === 'leased') }));
    expect(noFit(empty, { size: 5000, max: null, by: null, type: 'any' }, [], TODAY).message).toBe('No direct space is available now.');
  });
});

describe('needed by: a date before the as-of date is refused, never moved', () => {
  const floors = deriveFloors(property, TODAY, TODAY);

  it('checkNeededBy: empty is no date, a whole date on or after the as-of date is used as entered', () => {
    expect(checkNeededBy('', TODAY)).toEqual({ date: null, problem: null });
    expect(checkNeededBy(null, TODAY)).toEqual({ date: null, problem: null });
    expect(checkNeededBy(TODAY, TODAY)).toEqual({ date: TODAY, problem: null });
    expect(checkNeededBy('2027-09-11', TODAY)).toEqual({ date: '2027-09-11', problem: null });
  });

  it('a date before the as-of date is refused: 11 September 2026 against 9 November 2026', () => {
    // An en-GB reader types 11/09/2026 meaning 11 September; a date control hands that over as 2026-09-11.
    expect(TODAY).toBe('2026-11-09');
    expect(checkNeededBy('2026-09-11', TODAY)).toEqual({ date: null, problem: 'before' });
    expect(checkNeededBy('2026-11-08', TODAY)).toEqual({ date: null, problem: 'before' });
    // It is never turned into another date: not the as-of date, not the day and month swapped.
    for (const v of ['2026-09-11', '2026-11-08', '2020-01-01']) expect(checkNeededBy(v, TODAY).date, v).toBeNull();
    // The as-of date decides, not today: the same date is fine for an earlier plan and refused for a later one.
    expect(checkNeededBy('2026-09-11', '2026-09-01')).toEqual({ date: '2026-09-11', problem: null });
    expect(checkNeededBy('2027-06-01', '2028-01-01')).toEqual({ date: null, problem: 'before' });
  });

  it('a value that is not a whole date yet is incomplete, not early: the year as a date control reports it while it is typed', () => {
    for (const v of ['0002-09-11', '0020-09-11', '0202-09-11', '2027-02-30', '2027-13-01', '11/09/2026', 'soon']) expect(checkNeededBy(v, TODAY), v).toEqual({ date: null, problem: 'incomplete' });
    expect(checkNeededBy('2027-09-11', TODAY).problem).toBeNull();
  });

  it('the search is run without a refused date: space free today is not marked late by a date already past', () => {
    // What used to happen with by=2026-09-11: every space with a date of its own was "late".
    const stale = findFits(floors, 5000, '2026-09-11', null, [], TODAY).options;
    expect(stale.some((o) => o.late)).toBe(true);
    const by = checkNeededBy('2026-09-11', TODAY).date;
    const { options } = searchSpace(floors, { size: 5000, max: null, by, type: 'any' }, [], TODAY);
    expect(options.length).toBe(stale.length);
    expect(options.some((o) => o.late)).toBe(false);
  });
});
