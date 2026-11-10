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
    // Rent and renewal columns are gone from the expirations table, so its empty row spans five columns.
    expect(html).toContain('Lease expirations · next 12 months');
    expect(html).not.toMatch(/<th>Rent<\/th>|<th>Renewal<\/th>/);
  });
});
