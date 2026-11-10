// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { property, TODAY } from '../../data/mock/property';
import { parseState } from '../../state/planState';
import { buildModel } from '../inspector/testModel';
import { PrintLayout } from './PrintLayout';

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

const render = (search: string) => {
  const state = parseState(search, TODAY);
  const model = buildModel(state);
  const html = renderToString(<PrintLayout model={model} state={state} visible />);
  return { model, html: html.replace(/<!-- -->/g, '').replace(/&#x27;/g, "'") };
};
/** One table row of the report, by its first cell. */
const row = (html: string, first: string) => new RegExp(`<tr><td>${first}</td>(.*?)</tr>`).exec(html)?.[1] ?? '';

describe('PrintLayout', () => {
  it('owner report: coming supply names the space marketed for later', () => {
    const { html } = render('?print=1');
    expect(row(html, 'Occupied, marketed for later')).toContain('21,400 SF from Apr 1, 2027');
    expect(html).toMatch(/Avail Apr\s'27/);
  });

  it('prospect-safe report: a quiet listing is neither badged on the plan nor counted as coming supply', () => {
    const { html } = render('?print=1&safe=1');
    expect(row(html, 'Occupied, marketed for later')).toBe('<td class="num">—</td>');
    expect(html).not.toMatch(/Avail Apr|marketed from|quiet/i);
    // Signed, not-yet-in space is still reported: it is not a listing.
    expect(row(html, 'Signed, not yet in')).toContain('8,000 SF');
  });

  it('in-place rent by type shows recorded SF, labelled, matching the rent-roll rows', () => {
    const { html, model } = render('?print=1');
    expect(html).toContain('Recorded SF');
    expect(html).toContain('Average, weighted by recorded SF');
    expect(html).toContain('the over-allocation cap on leased SF is not applied');
    for (const r of model.kpis.rentByType) expect(row(html, r.type)).toContain(`<td class="num">${r.sf.toLocaleString('en-US')}</td>`);
  });

  it('prospect-safe report withholds rents by type, the pipeline, tenant risk, brokers and data issues', () => {
    const { html } = render('?print=1&safe=1');
    expect(html).not.toContain('In-place rent by lease type');
    expect(html).toContain('Withheld');
    expect(html).not.toMatch(/holdover|month-to-month|\bMTM\b/i);
    // The report's own pages (rent roll, rollover, supply, expirations); the cover's plan is the stack view's.
    const pages = html.slice(html.indexOf('<h2>Rent roll</h2>'));
    expect(pages.length).toBeGreaterThan(1000);
    expect(pages).not.toMatch(/Not placed|over-allocated|records exceed/i);
    expect(pages).toContain('leased is capped at the leasable area');
    expect(html).not.toMatch(/\b(Tour|Proposal|LOI|Lease Out)\b/);
    for (const l of property.leases) {
      expect(html, `names ${l.tenant}`).not.toContain(l.tenant);
      if (l.owner) expect(html, `names broker ${l.owner}`).not.toContain(l.owner);
    }
    // No lease shows its term, so the report has no expirations table at all (and so no rent or renewal column).
    expect(html).not.toMatch(/Lease expirations|Renewal worklist|No leases end in the next 12 months/);
    expect(html).not.toMatch(/<th>Rent<\/th>|<th>Renewal<\/th>|<th>Ends<\/th>/);
    expect(html).toContain('lease dates and rollover are withheld');
    // The rent roll: every lease in place is "Leased", and the table has no lease-date column at all.
    const roll = pages.slice(0, pages.indexOf('<h2>Space on offer</h2>'));
    expect(roll).not.toMatch(/<th>(Commencement|Expiration|Remaining)<\/th>/);
    expect(roll).toContain('<th>Available from</th>');
    const leased = [...roll.matchAll(/<tr>(.*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((c) => c[1])).filter((r) => r[4] === 'Leased');
    expect(leased.length).toBeGreaterThan(10);
    for (const r of leased) expect(r.slice(5), `Ste ${r[1]}`).toEqual(['—', 'Withheld']);
  });

  it('prospect-safe report has no rollover by period, no expiring figure and no lease count', () => {
    const open = render('?print=1');
    expect(open.html).toContain('<h2>Lease rollover</h2>');
    expect(open.html).toContain('<th class="num">Leases</th>');
    const expiring = `${open.model.kpis.expiring12.toLocaleString('en-US')} SF`;
    expect(open.html).toContain(expiring);
    const { html, model } = render('?print=1&safe=1');
    expect(html).not.toMatch(/Lease rollover|<th[^>]*>Leases<\/th>|<th>Period<\/th>|Share of (leased|listed)/);
    expect(html).not.toMatch(/\d+ leases?\b/);
    expect(html).not.toContain(expiring);
    // Every period's SF is gone, whether or not another figure happens to equal it.
    expect(model.roll.buckets).toEqual([]);
    for (const b of open.model.roll.buckets.filter((x) => x.sf > 0)) expect(html, b.label).not.toContain(`<td>${b.label}</td>`);
    expect(html).toMatch(/Expiring 12 mo<\/div><div class="sp-print__kpi-value">Withheld/);
  });

  it('prospect-safe report prints no date of any lease, signed leases included, at any as-of date asked for', () => {
    const leaseDates = new Set(property.leases.flatMap((l) => [l.commencement, l.expiration, l.termination]).filter((d): d is string => !!d));
    for (const a of property.availabilities) for (const d of [a.availableFrom, a.subleaseExpiration]) if (d) leaseDates.delete(d);
    const today = render('?print=1&safe=1').html;
    for (const d of leaseDates) {
      const [y, m, day] = d.split('-').map(Number);
      const long = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${day}, ${y}`;
      expect(today, long).not.toContain(long);
    }
    expect(today).not.toMatch(/Moves in|Vacated|Projected vacancy/);
    // A link that asks for another date is drawn as of today: the report is the same, character for character.
    for (const asOf of ['2027-02-10', '2027-04-15', '2028-11-10', '2031-01-01']) expect(render(`?print=1&safe=1&asOf=${asOf}`).html, asOf).toBe(today);
  });

  it('prospect-safe report lists the space on offer with its dates and asking rents, and no quiet listing', () => {
    const { html } = render('?print=1&safe=1');
    const offer = html.slice(html.indexOf('<h2>Space on offer</h2>'), html.indexOf('<h2>Coming supply</h2>'));
    expect(offer.length).toBeGreaterThan(500);
    expect(offer).toContain('Fl 3 · 350');
    expect(offer).toMatch(/\$\d+–\$\d+\/SF\/yr (FSG|MG|NNN)/);
    expect(offer).toContain('thru Sep 30, 2030');
    // Suite 600 is occupied and listed quietly for April 2027: it is not on offer to a prospect.
    expect(offer).not.toMatch(/Fl 6 · 600|Apr 1, 2027/);
    expect(render('?print=1').html).not.toContain('<h2>Space on offer</h2>');
  });
});
