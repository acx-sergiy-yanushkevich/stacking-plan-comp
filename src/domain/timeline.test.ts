import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { deriveFloors } from './derive';
import { safeFloors } from './safe';
import { barSegment, dateToX, selectionKey, timelineModel, xToDate, yearTicks } from './timeline';
import { segmentIndex } from './derive';

describe('timelineModel', () => {
  const floors = deriveFloors(property, TODAY, TODAY);
  const m = timelineModel(property, floors, TODAY, TODAY);
  const row = (id: string) => m.rows.find((r) => r.floor.id === id)!;

  it('starts at or before the earliest commencement, on the 1st of a month', () => {
    expect(m.start <= '2016-09-01').toBe(true);
    expect(m.start.endsWith('-01')).toBe(true);
  });
  it('ends ten years after as-of', () => {
    expect(m.end).toBe('2036-11-09');
  });
  it('lists the top floor first', () => {
    expect(m.rows[0].floor.id).toBe('F12');
    expect(m.rows).toHaveLength(12);
  });
  it('gives the MTM tenant on Floor 2 an open-ended bar', () => {
    const bowline = row('F2').bars.find((b) => b.label === 'Bowline Consulting')!;
    expect(bowline.end).toBeNull();
    expect(bowline.kind).toBe('mtm');
  });
  it('marks the signed future lease on Floor 4 as committed', () => {
    const lumen = row('F4').bars.find((b) => b.label === 'Lumen Analytics')!;
    expect(lumen.committed).toBe(true);
    expect(lumen.start).toBe('2027-02-01');
    expect(lumen.end).toBe('2034-01-31');
  });
  it('builds availability bars from as-of or available-from with no end', () => {
    const a = row('F3').bars.find((b) => b.segKey === 'A02')!;
    expect(a.label).toBe('Available · Ste 350');
    expect(a.start).toBe(TODAY);
    expect(a.end).toBeNull();
    const sale = row('F1').bars.find((b) => b.segKey === 'A10')!;
    expect(sale.label).toBe('For sale');
  });
  it('flags sublease bars', () => {
    // The sublease runs to the head lease's own end, so the suite is one dotted sublease bar, not two.
    const bars = row('F7').bars.filter((b) => b.segKey === 'L14-U2');
    expect(bars).toHaveLength(1);
    expect(bars[0].label).toBe('Infinity Info Systems');
    expect(bars[0].kind).toBe('sublease');
    expect(bars[0].sublease).toBe(true);
    expect(bars[0].end).toBe('2030-09-30');
    // Cirrus (occupied, marketed for Apr 2027) gets a coming-supply bar from its available-from date.
    const mkt = row('F6').bars.find((b) => b.key.endsWith('-mkt'))!;
    expect(mkt.start).toBe('2027-04-01');
    expect(mkt.kind).toBe('available');
  });
  it('uses today − 12 months when every lease is newer', () => {
    const later = timelineModel(property, floors, '2030-01-15', '2030-01-15');
    expect(later.start <= '2016-09-01').toBe(true);
    expect(later.end).toBe('2040-01-15');
  });
  // Round 17: an ended lease's history bar borrowed the segment of whatever occupies the suite now, so
  // from Jun 2027 Cirrus Energy's 2018–2027 term was coloured, described and selected as availability A04.
  it('gives an ended lease\'s history bar the lease itself: its id, its own (vacated) segment and no selection', () => {
    const at = '2027-06-01';
    const raw = deriveFloors(property, at, TODAY);
    const cirrus = timelineModel(property, raw, at, TODAY).rows.flatMap((r) => r.bars).find((b) => b.key === 'tl-hist-L13-U1')!;
    expect(cirrus).toMatchObject({ segKey: 'L13-U1', leaseId: 'L13', label: 'Cirrus Energy', kind: 'projected', end: '2027-03-31' });
    // The suite is availability A04 now; the bar is not drawn from it.
    const index = segmentIndex(raw);
    expect(index.get('A04')?.suite).toBe('600');
    const seg = barSegment(cirrus, index)!;
    expect(seg).toMatchObject({ key: 'L13-U1', kind: 'projected', suite: '600', size: 21_400, endDate: '2027-03-31' });
    expect(seg.lease?.tenant).toBe('Cirrus Energy');
    expect(seg.availability).toBeUndefined();
    // A click selects nothing: the plan has no block for a lease that has ended.
    expect(selectionKey(cirrus)).toBeNull();
    // Every other bar selects its own segment, as before.
    const live = timelineModel(property, raw, at, TODAY).rows.flatMap((r) => r.bars).filter((b) => !b.key.startsWith('tl-hist-'));
    for (const b of live) expect(selectionKey(b)).toBe(b.segKey);
    for (const b of live) expect(barSegment(b, index)).toBe(index.get(b.segKey));
  });
});

describe('axis maths', () => {
  const s = '2016-09-01';
  const e = '2036-11-09';

  it('round-trips a first-of-month date through dateToX / xToDate', () => {
    expect(xToDate(dateToX('2028-03-01', s, e, 1000), s, e, 1000)).toBe('2028-03-01');
    expect(xToDate(dateToX('2020-01-01', s, e, 640), s, e, 640)).toBe('2020-01-01');
  });
  it('maps the axis ends to 0 and width', () => {
    expect(dateToX(s, s, e, 1000)).toBe(0);
    expect(dateToX(e, s, e, 1000)).toBeCloseTo(1000, 6);
  });
  it('clamps and snaps', () => {
    expect(xToDate(-50, s, e, 1000)).toBe(s);
    expect(xToDate(5000, s, e, 1000) <= e).toBe(true);
    expect(xToDate(5000, s, e, 1000).endsWith('-01')).toBe(true);
    expect(xToDate(500, s, e, 1000).endsWith('-01')).toBe(true);
  });
  it('produces one tick per January inside the range', () => {
    const ticks = yearTicks(s, e);
    const startYear = Number(s.slice(0, 4));
    expect([startYear, startYear + 1]).toContain(Number(ticks[0].label));
    expect(ticks[0].label).toBe('2017');
    expect(ticks.at(-1)!.label).toBe('2036');
    expect(ticks).toHaveLength(20);
    for (const t of ticks) {
      expect(t.label).toMatch(/^\d{4}$/);
      expect(t.date).toBe(`${t.label}-01-01`);
    }
    expect(yearTicks('2020-01-01', '2020-12-31')[0].label).toBe('2020');
  });
});

describe('timelineModel in prospect-safe mode', () => {
  const floors = deriveFloors(property, TODAY, TODAY);
  const open = timelineModel(property, floors, TODAY, TODAY);
  const safe = timelineModel(property, safeFloors(floors, true), TODAY, TODAY, true);
  const bars = (m: typeof open) => m.rows.flatMap((r) => r.bars);
  const inPlace = floors.flatMap((f) => f.segments).filter((s) => s.kind === 'leased' || s.kind === 'holdover' || s.kind === 'mtm');

  it('draws every lease in place as the same bar: in from before the axis, with no end', () => {
    const starts = new Set<string>();
    for (const s of inPlace) {
      const bar = bars(safe).find((b) => b.key === `tl-${s.key}`)!;
      expect([bar.kind, bar.end, bar.datesWithheld], s.key).toEqual(['mtm', null, true]);
      starts.add(bar.start);
    }
    // One start for all of them, left of the axis, and it is no lease's commencement.
    expect(starts.size).toBe(1);
    const [start] = [...starts];
    expect(start < safe.start).toBe(true);
    expect(property.leases.some((l) => l.commencement === start)).toBe(false);
    // Outside the mode an ordinary lease keeps its dates and a holdover its own kind.
    expect(bars(open).find((b) => b.key === 'tl-L13-U1')).toMatchObject({ kind: 'leased', end: '2027-03-31' });
    expect(bars(open).some((b) => b.kind === 'holdover')).toBe(true);
    expect(bars(safe).some((b) => b.kind === 'holdover')).toBe(false);
  });

  it('places no bar by a lease date: a signed lease runs on from the as-of date, and the axis does not reach back to a commencement', () => {
    const signed = bars(safe).filter((b) => b.committed);
    expect(signed.length).toBeGreaterThan(0);
    for (const b of signed) expect([b.kind, b.start, b.end, b.datesWithheld], b.key).toEqual(['committed', TODAY, null, true]);
    const leaseDates = new Set(property.leases.flatMap((l) => [l.commencement, l.expiration, l.termination]).filter(Boolean));
    for (const b of bars(safe).filter((x) => x.datesWithheld)) expect([leaseDates.has(b.start), b.end], b.key).toEqual([false, null]);
    expect(safe.start).toBe('2025-11-01');
    expect(open.start < safe.start).toBe(true);
  });

  it('draws no lease that has already ended (its end is a lease date too)', () => {
    const at = '2028-01-01';
    const raw = deriveFloors(property, at, TODAY);
    expect(timelineModel(property, raw, at, TODAY).rows.flatMap((r) => r.bars).some((b) => b.key.startsWith('tl-hist-') || b.kind === 'projected')).toBe(true);
    const later = timelineModel(property, safeFloors(raw, true), at, TODAY, true).rows.flatMap((r) => r.bars);
    expect(later.some((b) => b.key.startsWith('tl-hist-') || b.kind === 'projected')).toBe(false);
  });

  it('keeps the bars for space on offer exactly as they were', () => {
    const keep = (m: typeof open) => bars(m).filter((b) => (b.kind === 'available' || b.kind === 'forsale') && !b.sublease);
    // The quiet listing on Floor 6 is removed by the same projection; everything else is unchanged.
    expect(keep(safe)).toEqual(keep(open).filter((b) => b.key !== 'tl-L13-U1-mkt'));
    expect(keep(safe).length).toBeGreaterThan(5);
  });

  it('a sublet suite is the head lease, dateless like any other, and the sublease as space on offer: from its date, with no end', () => {
    // To the broker the two are one bar when the sublease runs to the head lease's end, and it starts at the lease's commencement.
    expect(bars(open).filter((b) => b.segKey === 'L14-U2')).toEqual([expect.objectContaining({ key: 'tl-L14-U2', kind: 'sublease', start: '2018-09-15', end: '2030-09-30' })]);
    // A prospect never gets that merged bar: it would start on the head lease's commencement and say the two end together.
    const [head, sub] = bars(safe).filter((b) => b.segKey === 'L14-U2');
    expect(head).toMatchObject({ key: 'tl-L14-U2', kind: 'mtm', end: null, datesWithheld: true });
    const a = property.availabilities.find((x) => x.sublease && x.suite === '720')!;
    // The sublease's end is its sublandlord's lease end: the bar is drawn like any space on offer, dotted, with no end.
    expect(a.subleaseExpiration).toBe('2030-09-30');
    expect(sub).toEqual({ key: 'tl-L14-U2-offer', segKey: 'L14-U2', label: 'Sublease · Ste 720', start: a.availableFrom ?? TODAY, end: null, kind: 'available', sublease: true, committed: false });
    // No bar of the chart ends, or starts, on that date.
    expect(bars(safe).some((b) => b.end === '2030-09-30' || b.start === '2030-09-30')).toBe(false);
    expect(JSON.stringify(safe)).not.toContain('2030-09-30');
  });
});
