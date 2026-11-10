import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors } from '../../domain/derive';
import { findIssues } from '../../domain/issues';
import { availabilityFact, comingText, fittingInquiries, floorComing, floorDeals, floorIssues, liveDeals, nextExpiry } from './floorData';

const floors = deriveFloors(property, TODAY, TODAY);
const floor = (id: string) => floors.find((f) => f.floor.id === id)!;
const issues = findIssues(property, floors, TODAY);
const plain = (s: string) => s.replace(/ /g, ' ');

describe('floor lists pass through the prospect-safe policy', () => {
  it('hands a prospect no deal, inquiry or issue on any floor', () => {
    for (const f of floors) {
      expect(floorDeals(f, true)).toEqual([]);
      expect(fittingInquiries(f, property.inquiries, TODAY, true)).toEqual([]);
      expect(floorIssues(issues, f.floor.id, true)).toEqual([]);
    }
  });

  it('hands the broker every live deal once, the inquiries that fit and the floor\'s issues', () => {
    const f6 = floor('F6');
    expect(floorDeals(f6, false)).toEqual(liveDeals(f6));
    expect(new Set(floorDeals(f6, false).map((d) => d.deal.id)).size).toBe(floorDeals(f6, false).length);
    expect(floorDeals(f6, false).every((d) => d.deal.stage !== 'Lease Out')).toBe(true);
    expect(fittingInquiries(f6, property.inquiries, TODAY, false).map((i) => i.inquiry.id)).toContain('I02');
    const all = floors.flatMap((f) => floorIssues(issues, f.floor.id, false));
    expect(all.length).toBe(issues.filter((i) => i.floorId).length);
    expect(floorIssues(issues, 'F7', false).every((i) => i.floorId === 'F7')).toBe(true);
  });
});

describe('what a floor offers', () => {
  it('Floor 6 is fully leased, with 21,400 SF marketed from Apr 2027', () => {
    const f6 = floor('F6');
    expect(f6.available).toBe(0);
    expect(floorComing(f6, TODAY, false)).toEqual({ sf: 21400, from: '2027-04-01' });
    expect(plain(comingText(floorComing(f6, TODAY, false)!))).toBe("21,400 SF marketed from Apr '27");
    expect(plain(availabilityFact(f6, TODAY, false))).toBe("21,400 SF marketed from Apr '27");
  });

  it('the listing is quiet, so a prospect is told nothing is available there', () => {
    expect(floorComing(floor('F6'), TODAY, true)).toBeNull();
    expect(availabilityFact(floor('F6'), TODAY, true)).toBe('Nothing available');
  });

  it('a floor with vacant space leads with it; one with neither says so', () => {
    expect(availabilityFact(floor('F12'), TODAY, false)).toBe('9,300 SF available');
    const full = floors.find((f) => f.available === 0 && !floorComing(f, TODAY, false))!;
    expect(availabilityFact(full, TODAY, false)).toBe('Nothing available');
  });

  it('nothing is "coming" once its date has arrived', () => {
    expect(floorComing(deriveFloors(property, '2027-04-01', TODAY).find((f) => f.floor.id === 'F6')!, '2027-04-01', false)).toBeNull();
  });
});

describe('nextExpiry', () => {
  it('is the dated lease ending soonest on the floor', () => {
    expect(nextExpiry(floor('F6'))?.lease?.tenant).toBe('Cirrus Energy');
    for (const f of floors) {
      const next = nextExpiry(f);
      if (next) expect(next.monthsToExpiry).toBeGreaterThanOrEqual(0);
    }
  });
});
