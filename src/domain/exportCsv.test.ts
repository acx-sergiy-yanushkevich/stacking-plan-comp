import { describe, expect, it } from 'vitest';
import { property, TODAY } from '../data/mock/property';
import { deriveFloors } from './derive';
import { RENT_ROLL_HEADER, rentRollRows, toCsv, rentRollDisplay } from './exportCsv';

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
    expect(safe.length).toBe(open.length);
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

  it('withholds the term of holdover and MTM leases in safe mode: no past expiration, no "0 mo"', () => {
    const safeRows = rentRollRows(property, floors, TODAY, true);
    for (const r of safeRows.slice(1)) if (r[col('State')] === 'Leased' && r[col('Expiration')]) expect(r[col('Expiration')] >= TODAY).toBe(true);
    const display = rentRollDisplay(property, floors, TODAY, true);
    const ei = display[0].indexOf('Expiration');
    const ri = display[0].indexOf('Remaining');
    const si = display[0].indexOf('State');
    for (const r of display.slice(1)) {
      if (r[si] !== 'Leased') continue;
      expect(r[ri]).not.toBe('0 mo');
      if (r[ei] !== '—') expect(new Date(r[ei]).getTime()).toBeGreaterThanOrEqual(new Date(TODAY).getTime());
    }
  });
});
