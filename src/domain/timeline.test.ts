import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { deriveFloors } from './derive';
import { dateToX, timelineModel, xToDate, yearTicks } from './timeline';

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
    const s = row('F7').bars.find((b) => b.segKey === 'L14-U2')!;
    expect(s.sublease).toBe(true);
    expect(s.label).toBe('Infinity Info Systems');
  });
  it('uses today − 12 months when every lease is newer', () => {
    const later = timelineModel(property, floors, '2030-01-15', '2030-01-15');
    expect(later.start <= '2016-09-01').toBe(true);
    expect(later.end).toBe('2040-01-15');
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
