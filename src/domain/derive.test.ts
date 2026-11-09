import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { deriveFloors, leaseFloors, segmentIndex, type FloorView } from './derive';

const at = (asOf: string) => deriveFloors(property, asOf, TODAY);
const seg = (floors: FloorView[], key: string) => segmentIndex(floors).get(key)!;
const floor = (floors: FloorView[], id: string) => floors.find((f) => f.floor.id === id)!;

describe('segment states today', () => {
  const f = at(TODAY);

  it('orders floors top first', () => {
    expect(f[0].floor.id).toBe('F12');
    expect(f.at(-1)!.floor.id).toBe('F1');
  });
  it('flags an expired lease with no termination as holdover (F3)', () => {
    expect(seg(f, 'L06-U1').kind).toBe('holdover');
  });
  it('treats a lease with no expiration as month-to-month (F2)', () => {
    expect(seg(f, 'L04-U1').kind).toBe('mtm');
  });
  it('shows a signed, not-yet-commenced lease as committed (F4)', () => {
    expect(seg(f, 'L09-U1').kind).toBe('committed');
    expect(seg(f, 'L09-U1').origin?.id).toBe('A03');
  });
  it('keeps an occupied suite leased but marks it marketed for later (F6)', () => {
    const s = seg(f, 'L13-U1');
    expect(s.kind).toBe('leased');
    expect(s.marketed?.availableFrom).toBe('2027-04-01');
    expect(s.monthsToExpiry).toBe(4);
  });
  it('turns a vacant sublease availability into a sublease segment (F7)', () => {
    const s = seg(f, 'L14-U2');
    expect(s.kind).toBe('sublease');
    expect(s.headMonths).toBe(46);
  });
  it('links unaccounted area to the lease with no unit records (F2)', () => {
    expect(seg(f, 'F2-gap').suspect?.tenant).toBe('Delta Dental Plan');
    expect(seg(f, 'F2-gap').size).toBe(5400);
  });
  it('draws the for-sale condo as its own state and never as available for lease (F1)', () => {
    expect(seg(f, 'A10').kind).toBe('forsale');
    const f1 = floor(f, 'F1');
    expect(f1.available).toBe(4000);
    expect(f1.maxContiguous).toBe(4000);
  });
  it('never counts over-allocated SF as leased (F7)', () => {
    const f7 = floor(f, 'F7');
    expect(f7.overAllocatedBy).toBe(500);
    expect(f7.leased).toBe(f7.leasable);
  });
  it('finds the contiguous run of two availabilities on F8', () => {
    const f8 = floor(f, 'F8');
    expect(f8.maxContiguous).toBe(7400);
    expect(f8.bestRun).toEqual(['A06', 'A07']);
  });
  it('lists the floors of a multi-floor tenant', () => {
    const anadarko = property.leases.find((l) => l.id === 'L17')!;
    expect(leaseFloors(property, anadarko).map((x) => x.name)).toEqual(['Floor 9', 'Floor 10', 'Floor 11']);
  });
});

describe('time travel', () => {
  it('moves the committed tenant in on its commencement date', () => {
    expect(seg(at('2027-02-01'), 'L09-U1').kind).toBe('leased');
  });
  it('replaces a departed tenant with the space marketed for it', () => {
    expect(seg(at('2027-05-01'), 'A04').kind).toBe('available');
    expect(seg(at('2027-05-01'), 'A04').lease?.tenant).toBe('Cirrus Energy');
  });
  it('shows a lease ending before the as-of date as a projected vacancy', () => {
    expect(seg(at('2027-06-01'), 'L12-U1').kind).toBe('projected');
  });
  it('keeps the sublease on the head-lease term when the sublease has not started yet', () => {
    expect(seg(at('2026-01-01'), 'L14-U2').kind).toBe('sublease');
  });
});
