import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { deriveFloors, segmentIndex, type FloorView } from './derive';
import { LENSES, dealCount, isVacantKind, legendFor, rentType, rentValue, stageRank, toneFor, toneLabel, topDeal, type LensId, type Tone } from './lenses';
import { safeFloors } from './safe';

const at = (asOf: string) => deriveFloors(property, asOf, TODAY);
const seg = (floors: FloorView[], key: string) => {
  const s = segmentIndex(floors).get(key);
  if (!s) throw new Error(`no segment ${key}`);
  return s;
};

const today = at(TODAY);
const tone = (key: string, lens: LensId = 'status', safe = false) => toneFor(seg(today, key), lens, safe);

describe('status lens today', () => {
  it('holdover and month-to-month are at risk', () => {
    expect(tone('L06-U1')).toBe('risk');
    expect(tone('L04-U1')).toBe('risk');
  });
  it('signed, not commenced is committed', () => {
    expect(tone('L09-U1')).toBe('committed');
  });
  it('a lease with under 12 months left is expiring, even when its space is already marketed', () => {
    expect(seg(today, 'L13-U1').monthsToExpiry).toBe(4);
    expect(tone('L13-U1')).toBe('expiring');
  });
  it('a long lease stays leased', () => {
    expect(tone('L17-U1')).toBe('leased');
  });
  it('sublease, available, for sale and unaccounted area', () => {
    expect(tone('L14-U2')).toBe('sublease');
    expect(tone('A02')).toBe('available');
    expect(tone('A10')).toBe('forsale');
    expect(tone('F2-gap')).toBe('empty');
  });
  it('a projected vacancy is projected, not empty (time travel past Cirrus)', () => {
    const f = at('2027-04-01');
    // Floor 6: Cirrus ends Mar 31 2027 and the marketed suite becomes available Apr 1.
    expect(toneFor(seg(f, 'A04'), 'status', false)).toBe('available');
    // Floor 5: BeachBody ends Apr 30 2027 with nothing behind it.
    const later = at('2027-05-15');
    const beachBody = seg(later, 'L12-U1');
    expect(beachBody.kind).toBe('projected');
    expect(toneFor(beachBody, 'status', false)).toBe('projected');
    expect(toneFor(beachBody, 'expiry', false)).toBe('projected');
  });
  it('an available segment with a future available-from is available-later', () => {
    const f = at('2027-04-01');
    const a04 = seg(f, 'A04');
    expect(toneFor({ ...a04, availableFrom: '2027-06-01' }, 'status', false)).toBe('available-later');
  });
});

describe('expiry lens', () => {
  it('buckets months to expiry with exp-0 as the soonest', () => {
    expect(tone('L13-U1', 'expiry')).toBe('exp-0');
    expect(seg(today, 'L19-U1').monthsToExpiry).toBe(19);
    expect(tone('L19-U1', 'expiry')).toBe('exp-2');
    expect(seg(today, 'L17-U1').monthsToExpiry).toBe(42); // May 2030
    expect(tone('L17-U1', 'expiry')).toBe('exp-4'); // 3–5 yr bucket
    expect(tone('L11-U1', 'expiry')).toBe('exp-2'); // Sep 2028, 22 months
    expect(tone('L03-U1', 'expiry')).toBe('exp-5'); // Dec 2031
  });
  it('risk, committed, vacant and for sale keep their own tones', () => {
    expect(tone('L06-U1', 'expiry')).toBe('risk');
    expect(tone('L09-U1', 'expiry')).toBe('committed');
    expect(tone('A02', 'expiry')).toBe('empty');
    expect(tone('A10', 'expiry')).toBe('muted');
  });
});

describe('rent lens', () => {
  it('confidential wins over the in-place rate', () => {
    expect(tone('L18-U1', 'rent')).toBe('confidential');
  });
  it('NNN and MG leases sit off the gross scale', () => {
    expect(tone('L02-U1', 'rent')).toBe('rent-net');
    expect(tone('L12-U1', 'rent')).toBe('rent-net');
  });
  it('vacancies rank by asking midpoint; monthly rates are annualised', () => {
    expect(tone('A02', 'rent')).toMatch(/^rent-\d$/);
    expect(rentValue(seg(today, 'A02'))).toBe(31);
    expect(rentType(seg(today, 'A02'))).toBe('FSG');
    expect(tone('A02', 'rent')).toBe('rent-2');
    expect(rentValue(seg(today, 'L01-U1'))).toBe(39); // $3.25/mo
  });
  it('for sale and unaccounted area have no rent', () => {
    expect(tone('A10', 'rent')).toBe('forsale');
    expect(tone('F2-gap', 'rent')).toBe('muted');
    expect(rentValue(seg(today, 'F2-gap'))).toBeNull();
  });
});

describe('deals lens', () => {
  it('ranks stages Tour < Proposal < LOI < Lease Out', () => {
    expect(['Tour', 'Proposal', 'LOI', 'Lease Out'].map((s) => stageRank(s as never))).toEqual([0, 1, 2, 3]);
  });
  it('the LOI on marketed suite 600 is the top deal on the occupied Cirrus block', () => {
    const cirrus = seg(today, 'L13-U1');
    expect(cirrus.marketed?.id).toBe('A04');
    expect(topDeal(cirrus)?.stage).toBe('LOI');
    expect(dealCount(cirrus)).toBe(2);
    expect(tone('L13-U1', 'deals')).toBe('deal-2');
  });
  it('once suite 600 is on the market the availability itself carries the LOI', () => {
    const a04 = seg(at('2027-04-01'), 'A04');
    expect(toneFor(a04, 'deals', false)).toBe('deal-2');
  });
  it('a committed lease shows its Lease Out; a vacancy without deals is deal-none', () => {
    expect(tone('L09-U1', 'deals')).toBe('deal-3');
    expect(tone('A06', 'deals')).toBe('deal-none');
    expect(tone('A02', 'deals')).toBe('deal-1');
    expect(tone('L03-U1', 'deals')).toBe('muted');
    expect(tone('A10', 'deals')).toBe('forsale');
  });
  it('renewal deals count on the lease while it is in place', () => {
    expect(tone('L06-U1', 'deals')).toBe('deal-2');
    expect(isVacantKind(seg(today, 'L06-U1'))).toBe(false);
    expect(isVacantKind(seg(today, 'A02'))).toBe(true);
  });
});

describe('prospect-safe', () => {
  const all = today.flatMap((f) => f.segments);
  it('status lens never shows risk or expiring', () => {
    const tones = new Set(all.map((s) => toneFor(s, 'status', true)));
    expect(tones.has('risk')).toBe(false);
    expect(tones.has('expiring')).toBe(false);
    expect(tone('L18-U1', 'status', true)).toBe('leased');
    expect(tone('L06-U1', 'status', true)).toBe('leased');
    expect(tone('L13-U1', 'status', true)).toBe('leased');
    expect(tone('A10', 'status', true)).toBe('forsale');
  });
  it('rent lens hides in-place rents the same way for every lease (confidential included) and keeps asking rents', () => {
    expect(tone('L02-U1', 'rent', true)).toBe('muted');
    expect(tone('L18-U1', 'rent', true)).toBe('muted');
    expect(tone('A02', 'rent', true)).toBe('rent-2');
  });
  it('deals lens shows only vacant vs not', () => {
    expect(tone('L13-U1', 'deals', true)).toBe('muted');
    expect(tone('A02', 'deals', true)).toBe('empty');
  });
  it('the safe status legend carries no risk or expiring item', () => {
    const tones = legendFor('status', true, today).map((i) => i.tone);
    expect(tones).not.toContain('risk');
    expect(tones).not.toContain('expiring');
    expect(tones).toContain('available-later');
    expect(tones).toContain('muted');
  });
  it('the safe status legend calls space in use "Occupied", the word of the KPI it matches, never a second "Leased" (round 17)', () => {
    const items = legendFor('status', true, today);
    const occupied = items.find((i) => i.tone === 'leased')!;
    expect(occupied.label).toBe('Occupied');
    expect(occupied.sf).toBe(196700);
    expect(items.filter((i) => /^Leased/.test(i.label))).toEqual([]);
    expect(toneLabel('leased', 'status', true)).toBe('Occupied');
  });
});

describe('legendFor', () => {
  it('sums available SF across the building', () => {
    const items = legendFor('status', false, today);
    const available = items.find((i) => i.tone === 'available');
    expect(available?.sf).toBe(26200); // A01 4000 + A02 5500 + A06 4200 + A07 3200 + A08 9300
    expect(items.find((i) => i.tone === 'forsale')?.sf).toBe(2600);
    expect(items.find((i) => i.tone === 'risk')?.sf).toBe(11000 + 6200);
  });
  it('shares are fractions of total leasable that sum to at most 1', () => {
    const leasable = today.reduce((s, f) => s + f.leasable, 0);
    expect(leasable).toBe(245400);
    for (const lens of LENSES.map((l) => l.id)) {
      for (const safe of [false, true]) {
        const items = legendFor(lens, safe, today).filter((i) => i.pattern !== 'asking');
        const sum = items.reduce((s, i) => s + i.share, 0);
        expect(sum).toBeLessThanOrEqual(1.01);
        for (const i of items) expect(i.share).toBeCloseTo(i.sf / leasable, 10);
      }
    }
  });
  it('reports recorded SF, so an over-allocated floor shows its excess rather than pro-rated figures', () => {
    const f7 = today.find((f) => f.floor.id === 'F7')!;
    expect(f7.overAllocatedBy).toBe(500);
    const items = legendFor('status', false, today);
    const total = items.reduce((s, i) => s + i.sf, 0);
    expect(total).toBe(245400 + 500);
    expect(items.find((i) => i.tone === 'sublease')?.sf).toBe(7000);
    // Every other floor's segments sum exactly to its leasable area.
    expect(legendFor('status', false, today.filter((f) => f.floor.id !== 'F7')).reduce((s, i) => s + i.sf, 0)).toBe(245400 - 21400);
  });
  it('every segment tone appears in its lens legend (no orphan tones)', () => {
    const all = today.flatMap((f) => f.segments);
    for (const lens of LENSES.map((l) => l.id)) {
      for (const safe of [false, true]) {
        const legend = new Set<Tone>(legendFor(lens, safe, today).map((i) => i.tone));
        for (const s of all) expect(legend.has(toneFor(s, lens, safe)), `${lens}/${safe}: ${s.key}`).toBe(true);
      }
    }
  });
  it('status legend keeps every v1 item plus for sale and projected', () => {
    const tones = legendFor('status', false, today).map((i) => i.tone);
    for (const t of ['available', 'sublease', 'committed', 'leased', 'expiring', 'risk', 'empty', 'forsale', 'projected']) expect(tones).toContain(t);
    expect(legendFor('status', false, today).find((i) => i.tone === 'projected')?.pattern).toBe('dashed');
    expect(legendFor('status', true, today).map((i) => i.tone)).toContain('forsale');
  });
  it('the rent legend asking item measures vacancies carrying an asking rent', () => {
    const asking = legendFor('rent', false, today).find((i) => i.pattern === 'asking');
    // Direct vacancies + the suite 720 sublease, at their recorded SF.
    expect(asking?.sf).toBe(26200 + 7000);
  });
});

describe('prospect-safe: no lease can be told apart by its term', () => {
  const leases = today.flatMap((f) => f.segments).filter((s) => s.kind === 'leased' || s.kind === 'holdover' || s.kind === 'mtm');

  it('colours every lease in place the same in every lens, whether the floors were projected or not', () => {
    for (const floors of [today, safeFloors(today, true)]) {
      const index = segmentIndex(floors);
      for (const lens of ['status', 'expiry', 'rent'] as const) {
        const tones = new Set(leases.map((s) => toneFor(index.get(s.key)!, lens, true)));
        expect([...tones], lens).toHaveLength(1);
      }
    }
    expect(toneFor(seg(today, 'L06-U1'), 'expiry', true)).toBe('leased');
    expect(toneFor(seg(today, 'L13-U1'), 'expiry', true)).toBe('leased');
    // The broker still sees the ramp and the risk tone.
    expect(new Set(leases.map((s) => toneFor(s, 'expiry', false))).size).toBeGreaterThan(3);
  });

  it('the safe expiration legend has no ramp, no risk and no "term not disclosed" entry: one Leased tone', () => {
    const legend = legendFor('expiry', true, safeFloors(today, true));
    expect(legend.map((i) => i.tone)).toEqual(['leased', 'sublease', 'committed', 'projected', 'empty', 'muted']);
    expect(legend.map((i) => i.label).join(' ')).not.toMatch(/not disclosed|Holdover|MTM|mo\b|yr\b/);
    expect(toneLabel('leased', 'expiry', true)).toBe('Leased');
    // Its SF is every lease in place, the at-risk ones included.
    expect(legend[0].sf).toBe(leases.reduce((t, s) => t + s.size, 0));
  });
});
