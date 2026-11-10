import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { deriveFloors } from './derive';
import { safeFloors } from './safe';
import { RENT_ROLL_HEADER, rentRollRows, toCsv, rentRollDisplay, unplacedLeases } from './exportCsv';

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

  it('safe mode gives no lease in place an expiration or months remaining: at-risk and ordinary rows are the same shape', () => {
    const atRisk = new Set(floors.flatMap((f) => f.segments).filter((s) => s.kind === 'holdover' || s.kind === 'mtm').map((s) => s.suite));
    expect(atRisk.size).toBe(2);
    // Whether the caller projected the floors first (the app does) or not, the rows are the same.
    for (const input of [floors, safeFloors(floors, true)]) {
      const rows = rentRollRows(property, input, TODAY, true).slice(1);
      const leased = rows.filter((r) => r[col('State')] === 'Leased');
      expect(leased.length).toBeGreaterThan(10);
      expect([...atRisk].every((suite) => leased.some((r) => r[col('Suite')] === suite))).toBe(true);
      for (const r of leased) expect([r[col('Expiration')], r[col('Months remaining')], r[col('Rate')]], `Ste ${r[col('Suite')]}`).toEqual(['', '', '']);
      expect(rows.some((r) => /Holdover|Month-to-month|MTM/.test(r.join(' ')))).toBe(false);

      const display = rentRollDisplay(property, input, TODAY, true);
      const [si, ei, ri] = ['State', 'Expiration', 'Remaining'].map((h) => display[0].indexOf(h as (typeof display)[0][number]));
      for (const r of display.slice(1).filter((x) => x[si] === 'Leased')) expect([r[ei], r[ri]], `Ste ${r[1]}`).toEqual(['—', '—']);
      expect(display.slice(1).some((r) => /Holdover|Month-to-month|MTM/.test(r.join(' ')))).toBe(false);
    }
    // The broker's export still has every term.
    const open = rentRollRows(property, floors, TODAY, false);
    expect(open.find((r) => r[col('Suite')] === '600')![col('Expiration')]).toBe('2027-03-31');
    expect(open.some((r) => r[col('Months remaining')] === 'Holdover')).toBe(true);
  });

  it('the prospect-safe CSV carries the sublease asking rent the prospect-safe PDF prints (Ste 720)', () => {
    for (const input of [floors, safeFloors(floors, true)]) {
      const row = rentRollRows(property, input, TODAY, true).find((r) => r[col('Suite')] === '720')!;
      expect(row[col('State')]).toBe('Sublease');
      expect([row[col('Rate')], row[col('Unit')], row[col('Lease type')]]).toEqual(['24–26', 'yr', 'FSG']);
      // The sublease's own end, never the head lease's; no tenant, no in-place rent.
      expect(row[col('Expiration')]).toBe('2030-09-30');
      expect(row[col('Months remaining')]).toBe('');
      expect(row[col('Tenant')]).toBe('Tenant');
      const pdf = rentRollDisplay(property, input, TODAY, true).find((r) => r[1] === '720')!;
      expect(pdf[4]).toBe('Sublease · asking $24–$26/SF/yr FSG thru Sep 30, 2030');
      expect(pdf[8]).toBe('Withheld');
      expect([pdf[6], pdf[7]]).toEqual(['—', '—']);
    }
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
