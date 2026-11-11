import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { deriveFloors, floorTotals } from './derive';
import { computeKpis } from './kpis';
import { rollover } from './rollover';
import { addMonths } from './dates';
import {
  brokerLabel,
  canShowActivity,
  canShowBrokers,
  canShowDeals,
  canShowInPlaceRent,
  canShowInquiries,
  canShowIssues,
  canShowLeaseTerm,
  canShowRollover,
  canShowWalt,
  canUseLens,
  canTimeTravel,
  canKeepSearch,
  canShowListingStatus,
  canShowRecordActions,
  canShowTenant,
  canShowTenantRisk,
  contactLabel,
  leaseDatesHidden,
  listingVisible,
  marketedFor,
  planDate,
  prospectLabel,
  publishedFloors,
  rentVisible,
  safeFloors,
  safeKpis,
  safeRollover,
  SAFE_TITLE,
  tenantLabel,
  termHidden,
  TITLE,
  visibleDeals,
  visibleInquiries,
  visibleIssues,
} from './safe';

describe('prospect-safe helpers', () => {
  it('replaces the tenant name in safe mode', () => {
    expect(tenantLabel({ tenant: 'Cirrus Energy' }, false)).toBe('Cirrus Energy');
    expect(tenantLabel({ tenant: 'Cirrus Energy' }, true)).toBe('Tenant');
  });
  it('drops the contact in safe mode', () => {
    expect(contactLabel('Tom Conner', false)).toBe('Tom Conner');
    expect(contactLabel('Tom Conner', true)).toBeUndefined();
    expect(contactLabel(undefined, false)).toBeUndefined();
  });
  it('replaces the prospect name in safe mode', () => {
    expect(prospectLabel({ prospect: 'Vantage Robotics' }, false)).toBe('Vantage Robotics');
    expect(prospectLabel({ prospect: 'Vantage Robotics' }, true)).toBe('Prospect');
  });
  it('hides rent when safe or confidential', () => {
    expect(rentVisible({ confidential: false }, false)).toBe(true);
    expect(rentVisible({}, false)).toBe(true);
    expect(rentVisible({ confidential: true }, false)).toBe(false);
    expect(rentVisible({ confidential: false }, true)).toBe(false);
    expect(rentVisible({ confidential: true }, true)).toBe(false);
  });
  it('has distinct titles', () => {
    expect(TITLE).toBe('Stacking plan');
    expect(SAFE_TITLE).toBe('Stacking plan (prospect-safe)');
  });
});

describe('rentVisible for availabilities', () => {
  it('shows asking rents to prospects but never in-place or confidential rents', () => {
    const avail = property.availabilities[0];
    expect(rentVisible(avail, true)).toBe(true);
    expect(rentVisible({ confidential: false }, true)).toBe(false);
    expect(rentVisible({ confidential: true }, false)).toBe(false);
  });
});

describe('prospect-safe policy', () => {
  const questions = { canShowTenant, canShowTenantRisk, canShowLeaseTerm, canShowDeals, canShowInquiries, canShowIssues, canShowBrokers, canShowActivity, canShowListingStatus, canShowRecordActions, canShowInPlaceRent, canKeepSearch };

  it('answers every question yes for the broker and no for a prospect', () => {
    for (const [name, ask] of Object.entries(questions)) {
      expect(ask(false), `${name} outside prospect-safe`).toBe(true);
      expect(ask(true), `${name} in prospect-safe`).toBe(false);
    }
  });

  it('projects withheld lists to nothing, and hands the broker a copy of the whole list', () => {
    const items = [{ id: 'D1' }, { id: 'D2' }];
    for (const project of [visibleDeals, visibleInquiries, visibleIssues]) {
      expect(project(items, true)).toEqual([]);
      expect(project(items, false)).toEqual(items);
      expect(project(items, false)).not.toBe(items);
      expect(project(undefined, false)).toEqual([]);
    }
  });

  it('withholds a broker name', () => {
    expect(brokerLabel('Dana Whitfield', false)).toBe('Dana Whitfield');
    expect(brokerLabel('Dana Whitfield', true)).toBeUndefined();
  });

  it('withholds the term of every lease in place alike, so a holdover or month-to-month lease is not the odd one out', () => {
    for (const kind of ['leased', 'holdover', 'mtm', 'sublease']) {
      expect(termHidden(kind, true), kind).toBe(true);
      expect(termHidden(kind, false), kind).toBe(false);
    }
    // Space on offer and a signed lease that has not started keep their dates.
    for (const kind of ['available', 'committed', 'projected', 'forsale', 'unmarketed']) expect(termHidden(kind, true), kind).toBe(false);
  });
});

describe('quiet listings', () => {
  const floors = deriveFloors(property, TODAY, TODAY);
  const cirrus = floors.flatMap((f) => f.segments).find((s) => s.key === 'L13-U1')!;

  it('the mock has an occupied suite marketed quietly for later', () => {
    expect(cirrus.marketed?.published).toBe(false);
    expect(cirrus.marketed?.availableFrom).toBe('2027-04-01');
  });

  it('a prospect sees published listings only', () => {
    expect(listingVisible({ published: false }, false)).toBe(true);
    expect(listingVisible({ published: false }, true)).toBe(false);
    expect(listingVisible({ published: true }, true)).toBe(true);
    // No flag recorded: the listing is published.
    expect(listingVisible({}, true)).toBe(true);
  });

  it('marketedFor withholds the quiet listing from a prospect and keeps a published one', () => {
    expect(marketedFor(cirrus, false)).toBe(cirrus.marketed);
    expect(marketedFor(cirrus, true)).toBeUndefined();
    const published = { ...cirrus, marketed: { ...cirrus.marketed!, published: true } };
    expect(marketedFor(published, true)).toBe(published.marketed);
    expect(marketedFor({}, true)).toBeUndefined();
  });

  it('publishedFloors removes quiet listings from the plan a prospect sees, and nothing else', () => {
    expect(publishedFloors(floors, false)).toBe(floors);
    const safe = publishedFloors(floors, true);
    const segs = safe.flatMap((f) => f.segments);
    expect(segs.every((s) => !s.marketed || s.marketed.published !== false)).toBe(true);
    expect(segs.find((s) => s.key === 'L13-U1')!.marketed).toBeUndefined();
    // Same suites, sizes and states; floors without a quiet listing are passed through untouched.
    expect(segs.map((s) => [s.key, s.kind, s.size])).toEqual(floors.flatMap((f) => f.segments).map((s) => [s.key, s.kind, s.size]));
    expect(safe.filter((f, i) => f !== floors[i]).map((f) => f.floor.id)).toEqual(['F6']);
    // The input is not mutated.
    expect(cirrus.marketed).toBeDefined();
  });
});

describe('lease terms in prospect-safe mode', () => {
  const floors = deriveFloors(property, TODAY, TODAY);
  const raw = floors.flatMap((f) => f.segments);
  const safe = safeFloors(floors, true);
  const segs = safe.flatMap((f) => f.segments);
  const byKey = (key: string) => segs.find((s) => s.key === key)!;
  const atRisk = raw.filter((s) => s.kind === 'holdover' || s.kind === 'mtm');
  const ordinary = raw.filter((s) => s.kind === 'leased');

  it('the mock has both at-risk and ordinary leases to compare', () => {
    expect(atRisk.map((s) => s.kind).sort()).toEqual(['holdover', 'mtm']);
    expect(ordinary.length).toBeGreaterThan(10);
    expect(ordinary.every((s) => s.endDate !== null && s.monthsToExpiry !== null)).toBe(true);
  });

  it('safeFloors is the identity outside the mode', () => {
    expect(safeFloors(floors, false)).toBe(floors);
  });

  it('every lease in place becomes the same thing: leased, with no end date and no months left', () => {
    for (const s of [...atRisk, ...ordinary]) {
      const p = byKey(s.key);
      expect([p.kind, p.endDate, p.monthsToExpiry, p.termWithheld], s.key).toEqual(['leased', null, null, true]);
    }
    // No holdover or month-to-month segment is left for any view to find.
    expect(segs.some((s) => s.kind === 'holdover' || s.kind === 'mtm')).toBe(false);
  });

  it('a sublet suite stays space on offer and loses every date: the head lease term and the sublease end, which is the same date', () => {
    const sub = raw.find((s) => s.kind === 'sublease')!;
    // The mock shows why: the sublease runs to the last day of its sublandlord's lease.
    expect(sub.availability!.subleaseExpiration).toBe('2030-09-30');
    expect(sub.lease!.expiration).toBe('2030-09-30');
    const p = byKey(sub.key);
    expect([p.kind, p.endDate, p.monthsToExpiry, p.headMonths, p.termWithheld]).toEqual(['sublease', null, null, null, true]);
    // The listing the suite carries has no end date either; what makes it an offer is intact.
    const a = p.availability!;
    expect(a.subleaseExpiration).toBeNull();
    expect([a.size, a.availableFrom, a.rentLow, a.rentHigh, a.rateUnit, a.leaseType, a.sublease]).toEqual([7000, sub.availability!.availableFrom, 24, 26, 'yr', 'FSG', true]);
    // The record the plan was derived from is untouched.
    expect(sub.availability!.subleaseExpiration).toBe('2030-09-30');
    expect(property.availabilities.find((x) => x.id === a.id)!.subleaseExpiration).toBe('2030-09-30');
  });

  it('no sublease end date is left anywhere in the projection: not on a listing for later, not on a sublease with no suite', () => {
    const end = '2031-03-31';
    const withLater = floors.map((f, i) => {
      if (i !== 0) return f;
      const host = f.segments.find((s) => s.kind === 'leased')!;
      const listing = { ...raw.find((s) => s.kind === 'sublease')!.availability!, id: 'X1', availableFrom: '2027-06-01', subleaseExpiration: end };
      return { ...f, segments: f.segments.map((s) => (s === host ? { ...s, marketed: listing } : s)), orphanSubleases: [{ ...listing, id: 'X2' }] };
    });
    const out = safeFloors(withLater, true);
    const dates = JSON.stringify(out.map((f) => [f.segments.map((s) => [s.availability?.subleaseExpiration, s.marketed?.subleaseExpiration, s.endDate]), f.orphanSubleases.map((a) => a.subleaseExpiration)]));
    expect(dates).not.toMatch(/2030-09-30|2031-03-31/);
    // The listing for later is still there, with its available-from date.
    expect(out[0].segments.find((s) => s.marketed?.id === 'X1')!.marketed!.availableFrom).toBe('2027-06-01');
    expect(out[0].orphanSubleases.map((a) => [a.id, a.subleaseExpiration])).toEqual([['X2', null]]);
    // Outside the mode nothing is removed.
    expect(JSON.stringify(safeFloors(withLater, false))).toContain(end);
  });

  it('a signed lease keeps its state and loses its dates: no move-in, no end, no months', () => {
    const signed = raw.filter((s) => s.kind === 'committed');
    expect(signed.length).toBeGreaterThan(0);
    for (const s of signed) {
      expect([s.lease!.commencement > TODAY, s.endDate !== null], s.key).toEqual([true, true]);
      const p = byKey(s.key);
      expect([p.kind, p.endDate, p.monthsToExpiry, p.termWithheld], s.key).toEqual(['committed', null, null, true]);
    }
  });

  it('no segment carries a lease date: the lease record itself has none left', () => {
    const withLease = segs.filter((s) => s.lease);
    expect(withLease.length).toBeGreaterThan(15);
    for (const s of withLease) expect([s.lease!.commencement, s.lease!.expiration, s.lease!.termination], s.key).toEqual(['', null, null]);
    // The tenant behind a data gap and the lease signed to replace a tenant are not carried either.
    expect(segs.some((s) => s.suspect || s.next)).toBe(false);
    // The records the plan was derived from are untouched.
    expect(property.leases.every((l) => l.commencement !== '')).toBe(true);
  });

  it('leaseDatesHidden covers every lease, in place or signed, and nothing on offer', () => {
    for (const kind of ['leased', 'holdover', 'mtm', 'sublease', 'committed']) expect([leaseDatesHidden(kind, true), leaseDatesHidden(kind, false)], kind).toEqual([true, false]);
    for (const kind of ['available', 'forsale', 'unmarketed']) expect(leaseDatesHidden(kind, true), kind).toBe(false);
    // "Leased" is said of a lease in place only: a signed lease keeps its own state.
    expect(termHidden('committed', true)).toBe(false);
  });

  it('space on offer and gaps are passed through untouched, with sizes and order intact', () => {
    for (const s of raw.filter((x) => !['leased', 'holdover', 'mtm', 'sublease', 'committed'].includes(x.kind))) {
      const p = byKey(s.key);
      // A quiet listing is removed by the same projection, and so is the tenant a data gap is traced to;
      // everything else is the same object.
      if (s.marketed?.published === false) expect(p.marketed).toBeUndefined();
      else if (s.suspect || s.lease) expect([p.suspect, p.lease, p.kind, p.size], s.key).toEqual([undefined, undefined, s.kind, s.size]);
      else expect(p, s.key).toBe(s);
    }
    expect(segs.map((s) => [s.key, s.size, s.order])).toEqual(raw.map((s) => [s.key, s.size, s.order]));
    expect(safe.map((f) => [f.leased, f.available, f.maxContiguous])).toEqual(floors.map((f) => [f.leased, f.available, f.maxContiguous]));
  });

  it('does not mutate what it was given', () => {
    expect(atRisk.map((s) => s.kind).sort()).toEqual(['holdover', 'mtm']);
    expect(ordinary.every((s) => s.endDate !== null && s.termWithheld === undefined)).toBe(true);
  });
});

describe('prospect-safe is today only', () => {
  const later = [3, 6, 12, 24, 60].map((m) => addMonths(TODAY, m));

  it('planDate is the date asked for outside the mode and today inside it, whatever was asked for', () => {
    expect([canTimeTravel(false), canTimeTravel(true)]).toEqual([true, false]);
    for (const d of [...later, addMonths(TODAY, -12), TODAY]) {
      expect(planDate(d, TODAY, false)).toBe(d);
      expect(planDate(d, TODAY, true)).toBe(TODAY);
    }
  });

  it('the mock has what time travel used to give away: suites vacated by a later date, and a quiet listing that opens', () => {
    const at = deriveFloors(property, '2027-04-15', TODAY).flatMap((f) => f.segments);
    expect(at.some((s) => s.kind === 'projected' && s.endDate !== null)).toBe(true);
    expect(at.find((s) => s.key === 'A04')).toMatchObject({ kind: 'available', availability: { published: false } });
  });

  it('floors derived for a later date still come out with no vacated suite, no lease date and no quiet listing', () => {
    const quiet = new Set(property.availabilities.filter((a) => a.published === false).map((a) => a.id));
    expect(quiet.size).toBeGreaterThan(0);
    for (const asOf of [TODAY, ...later]) {
      const raw = deriveFloors(property, asOf, TODAY);
      const out = safeFloors(raw, true);
      for (const f of out) {
        for (const s of f.segments) {
          expect(s.kind, `${asOf} ${s.key}`).not.toBe('projected');
          expect([s.availability, s.marketed].some((a) => a && quiet.has(a.id)), `${asOf} ${s.key} quiet listing`).toBe(false);
          if (s.lease) expect([s.lease.commencement, s.lease.expiration, s.lease.termination, s.endDate], `${asOf} ${s.key}`).toEqual(['', null, null, null]);
          expect([s.availability?.subleaseExpiration ?? null, s.marketed?.subleaseExpiration ?? null], `${asOf} ${s.key}`).toEqual([null, null]);
          if (!['leased', 'sublease', 'committed'].includes(s.kind)) expect(s.lease, `${asOf} ${s.key}`).toBeUndefined();
        }
        expect(f.orphanSubleases.some((a) => quiet.has(a.id))).toBe(false);
        // The floor's figures describe the segments beside them.
        expect([f.leased, f.available, f.maxContiguous, f.bestRun], `${asOf} ${f.floor.name}`).toEqual(Object.values(floorTotals(f.segments, f.leasable)));
      }
      // Nothing is lost or resized: the same suites, the same SF.
      expect(out.flatMap((f) => f.segments).map((s) => [s.key, s.size])).toEqual(raw.flatMap((f) => f.segments).map((s) => [s.key, s.size]));
    }
  });

  it('a quiet listing on vacant space is space not on the market, and the floor no longer counts it as available', () => {
    const raw = deriveFloors(property, '2027-04-15', TODAY);
    const f6 = raw.find((f) => f.floor.id === 'F6')!;
    expect(f6.available).toBe(21400);
    const out = publishedFloors(raw, true).find((f) => f.floor.id === 'F6')!;
    expect(out.segments.find((s) => s.key === 'A04')).toMatchObject({ kind: 'unmarketed', availability: undefined, lease: undefined });
    expect([out.available, out.maxContiguous, out.bestRun]).toEqual([0, 0, []]);
    // The broker's plan is untouched.
    expect(publishedFloors(raw, false)).toBe(raw);
    expect(f6.segments.find((s) => s.key === 'A04')!.kind).toBe('available');
  });

  it('a quiet sublease listing puts the suite back to the lease it is', () => {
    const raw = deriveFloors(property, TODAY, TODAY);
    const hushed = raw.map((f) => ({ ...f, segments: f.segments.map((s) => (s.kind === 'sublease' && s.availability ? { ...s, availability: { ...s.availability, published: false } } : s)) }));
    const sub = hushed.flatMap((f) => f.segments).find((s) => s.kind === 'sublease')!;
    const back = publishedFloors(hushed, true).flatMap((f) => f.segments).find((s) => s.key === sub.key)!;
    expect([back.kind, back.availability, back.monthsToExpiry, back.headMonths]).toEqual(['leased', undefined, sub.headMonths, undefined]);
    const floor = publishedFloors(hushed, true).find((f) => f.floor.id === sub.floorId)!;
    expect(floor.available).toBe(hushed.find((f) => f.floor.id === sub.floorId)!.available - sub.size);
  });
});

describe('totals by period in prospect-safe mode', () => {
  const floors = deriveFloors(property, TODAY, TODAY);
  const roll = rollover(floors, TODAY, 'rolling', 8);
  const kpis = computeKpis(property, floors, TODAY);

  it('the mock shows why: a period whose SF is one suite, and an expiring total that is one set of suites', () => {
    const sizes = floors.flatMap((f) => f.segments).filter((s) => s.lease).map((s) => s.size);
    const single = roll.buckets.filter((b) => b.leases === 1 && sizes.filter((z) => z === b.sf).length === 1);
    expect(single.length).toBeGreaterThan(0);
    expect(kpis.expiring12).toBeGreaterThan(0);
  });

  it('safeRollover hands a prospect no period and no at-risk SF, and keeps the rest', () => {
    expect([canShowRollover(false), canShowRollover(true)]).toEqual([true, false]);
    expect(safeRollover(roll, false)).toBe(roll);
    const out = safeRollover(roll, true);
    expect([out.buckets, out.atRisk]).toEqual([[], 0]);
    expect(out.overAllocated).toBe(roll.overAllocated);
    expect(roll.buckets.length).toBe(9);
  });

  it('safeKpis hands a prospect no expiring figure, no lease count and no WALT, and changes nothing else', () => {
    expect(safeKpis(kpis, false)).toBe(kpis);
    expect(kpis.walt).toBeGreaterThan(0);
    const out = safeKpis(kpis, true);
    expect([out.expiring12, out.expiring12Leases, out.walt]).toEqual([0, 0, 0]);
    expect({ ...out, expiring12: kpis.expiring12, expiring12Leases: kpis.expiring12Leases, walt: kpis.walt }).toEqual(kpis);
  });

  it('WALT is withheld with the lease terms it is made of', () => {
    expect([canShowWalt(false), canShowWalt(true)]).toEqual([true, false]);
    expect(canShowWalt(true)).toBe(canShowLeaseTerm(true));
  });

  it('a lens that colours by something withheld is not offered: Deals and Expiration', () => {
    for (const lens of ['status', 'expiry', 'deals', 'rent']) expect(canUseLens(lens, false), lens).toBe(true);
    expect(['status', 'expiry', 'deals', 'rent'].filter((lens) => canUseLens(lens, true))).toEqual(['status', 'rent']);
  });
});
