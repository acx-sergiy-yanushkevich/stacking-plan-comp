import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { deriveFloors } from './derive';
import {
  brokerLabel,
  canShowActivity,
  canShowBrokers,
  canShowDeals,
  canShowInPlaceRent,
  canShowInquiries,
  canShowIssues,
  canShowLeaseTerm,
  canKeepSearch,
  canShowListingStatus,
  canShowRecordActions,
  canShowTenant,
  canShowTenantRisk,
  contactLabel,
  listingVisible,
  marketedFor,
  prospectLabel,
  publishedFloors,
  rentVisible,
  safeFloors,
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

  it('a sublet suite keeps the sublease end (part of the offer) and loses the head lease term', () => {
    const sub = raw.find((s) => s.kind === 'sublease')!;
    const p = byKey(sub.key);
    expect(p.kind).toBe('sublease');
    expect(p.endDate).toBe(sub.availability!.subleaseExpiration);
    expect(p.headMonths).toBeNull();
    expect(p.termWithheld).toBe(true);
  });

  it('space on offer, signed leases and gaps are passed through untouched, with sizes and order intact', () => {
    for (const s of raw.filter((x) => !['leased', 'holdover', 'mtm', 'sublease'].includes(x.kind))) {
      const p = byKey(s.key);
      // A quiet listing is removed by the same projection; everything else is the same object.
      if (s.marketed?.published === false) expect(p.marketed).toBeUndefined();
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
