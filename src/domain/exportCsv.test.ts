import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { deriveFloors } from './derive';
import { safeFloors } from './safe';
import { RENT_ROLL_DISPLAY_HEADER, RENT_ROLL_HEADER, rentRollRows, toCsv, rentRollDisplay, unplacedLeases } from './exportCsv';
import { fmtDate } from './dates';

const floors = deriveFloors(property, TODAY, TODAY);
const col = (name: string) => RENT_ROLL_HEADER.indexOf(name as (typeof RENT_ROLL_HEADER)[number]);

describe('rentRollRows', () => {
  const open = rentRollRows(property, floors, TODAY, false);
  const safe = rentRollRows(property, floors, TODAY, true);

  it('starts with the header and lists the top floor first', () => {
    expect(open[0]).toEqual([...RENT_ROLL_HEADER]);
    expect(open[1][col('Floor')]).toBe('Floor 12');
    const placed = open.filter((r) => r[col('State')] !== 'Not placed (data issue)');
    expect(placed.at(-1)![col('Floor')]).toBe('Floor 1');
    // Leases without a floor or unit are still listed, flagged, at the end.
    const unplaced = open.filter((r) => r[col('State')] === 'Not placed (data issue)');
    expect(unplaced.map((r) => r[col('Tenant')]).sort()).toEqual(['Delta Dental Plan', 'Ridgeway Insurance']);
  });
  it('skips unmarketed gaps', () => {
    expect(open.some((r) => r[col('State')] === 'Unmarketed')).toBe(false);
    expect(open.every((r, i) => i === 0 || r[col('Suite')] !== '' || r[col('State')] === 'Not placed (data issue)')).toBe(true);
  });
  it('has a Cirrus Energy row with exact RSF and months remaining', () => {
    const row = open.find((r) => r[col('Tenant')] === 'Cirrus Energy')!;
    expect(row).toBeDefined();
    expect(row[col('Floor')]).toBe('Floor 6');
    expect(row[col('Suite')]).toBe('600');
    expect(row[col('RSF')]).toBe('21400');
    expect(row[col('State')]).toBe('Leased');
    expect(row[col('Commencement')]).toBe('2018-09-10');
    expect(row[col('Expiration')]).toBe('2027-03-31');
    expect(row[col('Months remaining')]).toBe('4');
    expect(row[col('Rate')]).toBe('29');
    expect(row[col('Unit')]).toBe('yr');
    expect(row[col('Lease type')]).toBe('FSG');
    expect(row[col('Live deals')]).toBe('2'); // two prospects on the marketed space
  });
  it('uses words for states and a low–high range for availabilities', () => {
    const states = new Set(open.slice(1).map((r) => r[col('State')]));
    expect(states).toContain('Holdover');
    expect(states).toContain('Month-to-month');
    expect(states).toContain('Committed');
    expect(states).toContain('Sublease');
    expect(states).toContain('For sale');
    const a02 = open.find((r) => r[col('Suite')] === '350')!;
    expect(a02[col('State')]).toBe('Available');
    expect(a02[col('Tenant')]).toBe('');
    expect(a02[col('Rate')]).toBe('30–32');
    expect(a02[col('Live deals')]).toBe('2');
  });
  it('leaves rate blank for a confidential lease even when not safe', () => {
    const row = open.find((r) => r[col('Tenant')] === 'Halcyon Capital')!;
    expect(row[col('Rate')]).toBe('');
  });
  it('uses the monthly unit where the lease is priced per month', () => {
    const row = open.find((r) => r[col('Tenant')] === 'Preston Park Café')!;
    expect(row[col('Rate')]).toBe('3.25');
    expect(row[col('Unit')]).toBe('mo');
  });
  it('shows no tenant, prospect, rent or price in safe mode', () => {
    const text = toCsv(safe);
    for (const t of property.leases.map((l) => l.tenant)) expect(text).not.toContain(t);
    const prospects = [
      ...property.leases.flatMap((l) => l.deals.map((d) => d.prospect)),
      ...property.availabilities.flatMap((a) => a.deals.map((d) => d.prospect)),
      ...property.inquiries.map((i) => i.prospect),
    ];
    for (const pr of prospects) expect(text).not.toContain(pr);
    expect(text).not.toContain('$');
    // In-place rents are withheld; asking rents on availabilities are marketing data and stay.
    expect(safe.slice(1).filter((r) => r[col('State')] === 'Leased' || r[col('State')] === 'Leased (term withheld)' || r[col('State')] === 'Committed').every((r) => r[col('Rate')] === '')).toBe(true);
    expect(safe.find((r) => r[col('Suite')] === '350')![col('Rate')]).toBe('30–32');
    expect(safe.find((r) => r[col('Suite')] === '600')![col('Tenant')]).toBe('Tenant');
    expect(safe.length).toBe(open.length - unplacedLeases(property, TODAY).length);
    expect(safe.length).toBe(rentRollDisplay(property, floors, TODAY, true).length);
  });
  it('never puts a dollar sign in the open export either', () => {
    expect(toCsv(open)).not.toContain('$');
  });
});

describe('toCsv', () => {
  it('quotes commas and doubles quotes', () => {
    expect(toCsv([['a,b', 'c"d']])).toBe('"a,b","c""d"');
  });
  it('joins rows with CRLF and quotes embedded newlines', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d');
    expect(toCsv([['x\ny', 'z']])).toBe('"x\ny",z');
    expect(toCsv([['x\r\ny']])).toBe('"x\r\ny"');
  });
  it('leaves plain cells unquoted', () => {
    expect(toCsv([['Floor 6', '600', '21400']])).toBe('Floor 6,600,21400');
  });

  it('safe mode gives no lease a commencement, an expiration or months remaining: at-risk and ordinary rows are the same shape', () => {
    const atRisk = new Set(floors.flatMap((f) => f.segments).filter((s) => s.kind === 'holdover' || s.kind === 'mtm').map((s) => s.suite));
    expect(atRisk.size).toBe(2);
    // Whether the caller projected the floors first (the app does) or not, the rows are the same.
    for (const input of [floors, safeFloors(floors, true)]) {
      const rows = rentRollRows(property, input, TODAY, true).slice(1);
      const leased = rows.filter((r) => r[col('State')] === 'Leased');
      expect(leased.length).toBeGreaterThan(10);
      expect([...atRisk].every((suite) => leased.some((r) => r[col('Suite')] === suite))).toBe(true);
      for (const r of leased) expect([r[col('Commencement')], r[col('Expiration')], r[col('Months remaining')], r[col('Rate')]], `Ste ${r[col('Suite')]}`).toEqual(['', '', '', '']);
      expect(rows.some((r) => /Holdover|Month-to-month|MTM/.test(r.join(' ')))).toBe(false);
      // No row at all carries a commencement: not a lease in place, not a sublet suite, not a signed lease.
      expect(rows.map((r) => r[col('Commencement')]).filter(Boolean)).toEqual([]);

      // The printed rent roll has no lease-date column left: one "Available from" column, a dash on every lease.
      const display = rentRollDisplay(property, input, TODAY, true);
      expect(display[0]).toEqual(['Floor', 'Suite', 'Tenant', 'RSF', 'State', 'Available from', 'Rate / price']);
      for (const r of display.slice(1)) expect(r).toHaveLength(display[0].length);
      for (const r of display.slice(1).filter((x) => x[4] === 'Leased')) expect(r[5], `Ste ${r[1]}`).toBe('—');
      expect(display.slice(1).some((r) => /Holdover|Month-to-month|MTM/.test(r.join(' ')))).toBe(false);
    }
    // The broker's export still has every term.
    const open = rentRollRows(property, floors, TODAY, false);
    expect(open.find((r) => r[col('Suite')] === '600')![col('Expiration')]).toBe('2027-03-31');
    expect(open.find((r) => r[col('Suite')] === '600')![col('Commencement')]).not.toBe('');
    expect(open.some((r) => r[col('Months remaining')] === 'Holdover')).toBe(true);
    expect(rentRollDisplay(property, floors, TODAY, false)[0]).toEqual([...RENT_ROLL_DISPLAY_HEADER]);
  });

  it('safe mode gives a signed lease no move-in and no end date (Ste 450), in the CSV and in the printed roll', () => {
    const open = rentRollRows(property, floors, TODAY, false).find((r) => r[col('Suite')] === '450')!;
    expect([open[col('State')], open[col('Commencement')], open[col('Expiration')]]).toEqual(['Committed', '2027-02-01', '2034-01-31']);
    for (const input of [floors, safeFloors(floors, true)]) {
      const row = rentRollRows(property, input, TODAY, true).find((r) => r[col('Suite')] === '450')!;
      expect([row[col('State')], row[col('Commencement')], row[col('Expiration')], row[col('Months remaining')]]).toEqual(['Committed', '', '', '']);
      const pdf = rentRollDisplay(property, input, TODAY, true).find((r) => r[1] === '450')!;
      expect([pdf[4], pdf[5]]).toEqual(['Committed', '—']);
    }
  });

  it('no lease date of the mock appears anywhere in the prospect-safe CSV or printed roll', () => {
    const dates = new Set(property.leases.flatMap((l) => [l.commencement, l.expiration, l.termination]).filter((d): d is string => !!d));
    // A sublease's end is a lease date too: it is its sublandlord's lease end (safe.ts, rule 2).
    for (const a of property.availabilities) if (a.subleaseExpiration) dates.add(a.subleaseExpiration);
    // A date that is also the available-from date of an offer is the offer's to show.
    for (const a of property.availabilities) if (a.availableFrom) dates.delete(a.availableFrom);
    expect(dates.has('2030-09-30')).toBe(true);
    expect(dates.size).toBeGreaterThan(20);
    for (const input of [floors, safeFloors(floors, true)]) {
      const csv = toCsv(rentRollRows(property, input, TODAY, true));
      const printed = rentRollDisplay(property, input, TODAY, true).flat().join(' | ');
      for (const d of dates) {
        expect(csv, d).not.toContain(d);
        expect(printed, d).not.toContain(fmtDate(d));
      }
    }
  });

  it('the prospect-safe CSV and PDF write a sublet suite as space on offer: asking rent, available now, and no end date (Ste 720)', () => {
    for (const input of [floors, safeFloors(floors, true)]) {
      const row = rentRollRows(property, input, TODAY, true).find((r) => r[col('Suite')] === '720')!;
      expect(row[col('State')]).toBe('Sublease');
      expect([row[col('Rate')], row[col('Unit')], row[col('Lease type')]]).toEqual(['24–26', 'yr', 'FSG']);
      // No end date: the sublease's is its sublandlord's lease end. No tenant, no in-place rent, no commencement.
      expect(row[col('Expiration')]).toBe('');
      expect(row[col('Months remaining')]).toBe('');
      expect(row[col('Commencement')]).toBe('');
      expect(row[col('Tenant')]).toBe('Tenant');
      expect(row.join(',')).not.toMatch(/2030|2018/);
      // The printed roll: "Sublease", available now, asking rent with unit and type in the rate column, and nothing about a sublandlord.
      const pdf = rentRollDisplay(property, input, TODAY, true).find((r) => r[1] === '720')!;
      expect(pdf).toEqual(['Floor 7', '720', 'Tenant', '7,000', 'Sublease', 'Now', 'Asking $24–$26/SF/yr FSG']);
    }
    // The broker's roll keeps the head lease's term and the sublease's own end.
    const open = rentRollDisplay(property, floors, TODAY, false).find((r) => r[1] === '720')!;
    expect(open[2]).toMatch(/\(sublandlord\)$/);
    expect(open[4]).toBe('Sublease · asking $24–$26/SF/yr FSG thru Sep 30, 2030');
    expect(rentRollRows(property, floors, TODAY, false).find((r) => r[col('Suite')] === '720')![col('Expiration')]).toBe('2030-09-30');
  });

  it('the CSV is a rent roll: no WALT and no building-wide figure in either mode', () => {
    for (const safe of [false, true]) expect(toCsv(rentRollRows(property, safeFloors(floors, safe), TODAY, safe))).not.toMatch(/WALT|weighted/i);
  });

  it('keeps the head lease as the record of a subleased suite (its own commencement and in-place rent)', () => {
    const rows = rentRollRows(property, floors, TODAY, false);
    const row = rows.find((r) => r[col('Suite')] === '720')!;
    expect(row[col('Commencement')]).toBe('2018-09-15');
    expect(row[col('Rate')]).toBe('30');
    const display = rentRollDisplay(property, floors, TODAY, false);
    const d = display.find((r) => r[1] === '720')!;
    expect(d[4]).toMatch(/^Sublease · asking \$24–\$26/);
    expect(d[8]).toBe('$30/SF/yr FSG');
  });
});
