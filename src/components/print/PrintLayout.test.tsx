// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { property, TODAY } from '../../data/mock/property';
import { parseState } from '../../state/planState';
import { buildModel } from '../inspector/testModel';
import { area } from '../../data/mock/area';
import type { Area } from '../../domain/types';
import { PrintLayout } from './PrintLayout';

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

const render = (search: string, withArea?: Area) => {
  const state = parseState(search, TODAY);
  const model = buildModel(state);
  const html = renderToString(<PrintLayout model={model} state={state} area={withArea ?? null} visible />);
  return { model, html: html.replace(/<!-- -->/g, '').replace(/&#x27;/g, "'") };
};
/** One table row of the report, by its first cell. */
const row = (html: string, first: string) => new RegExp(`<tr><td>${first}</td>(.*?)</tr>`).exec(html)?.[1] ?? '';

/** The report's sections, each as its markup, and the "Section n of N" of each running head. */
const sectionsOf = (html: string) => {
  const parts = html.split(/<section class="sp-print__page[^"]*">/).slice(1);
  const heads = parts.map((part) => /<span class="sp-print__pageno">Section (\d+) of (\d+)<\/span>/.exec(part)).map((m) => (m ? [Number(m[1]), Number(m[2])] : null));
  return { parts, heads };
};

describe('PrintLayout location section', () => {
  it('ends the owner report with the location brief: four sections, 1 to 4 of 4', () => {
    const { parts, heads } = sectionsOf(render('?print=1', area).html);
    expect(parts).toHaveLength(4);
    expect(heads).toEqual([[1, 4], [2, 4], [3, 4], [4, 4]]);
    expect(parts[3]).toContain('sp-brief--print');
    expect(parts[3]).toContain('<h2 class="sp-brief__title">Location</h2>');
    expect(parts[3]).toContain('What stands out');
    expect(parts[3]).toContain('Figures by distance');
  });

  it('ends the prospect-safe report with the same brief: it holds no tenant data', () => {
    const { parts, heads } = sectionsOf(render('?print=1&safe=1', area).html);
    expect(parts).toHaveLength(3);
    expect(heads).toEqual([[1, 3], [2, 3], [3, 3]]);
    const owner = sectionsOf(render('?print=1', area).html).parts[3];
    const strip = (part: string) => part.replace(/<div class="sp-print__running">.*?<\/div>/, '');
    expect(strip(parts[2])).toBe(strip(owner));
  });

  it('has no location section until the area has arrived', () => {
    expect(sectionsOf(render('?print=1').html).parts).toHaveLength(3);
    expect(render('?print=1').html).not.toContain('sp-brief');
  });
});

describe('PrintLayout sections', () => {
  it('owner report: three sections, numbered 1 to 3 of 3', () => {
    for (const query of ['?print=1', '?print=1&lens=expiry', '?print=1&asOf=2028-01-01']) {
      const { parts, heads } = sectionsOf(render(query).html);
      expect(parts, query).toHaveLength(3);
      expect(heads, query).toEqual([[1, 3], [2, 3], [3, 3]]);
      expect(parts[0]).toContain('sp-print__plan');
      expect(parts[1]).toContain('<h2>Rent roll</h2>');
      expect(parts[2]).toContain('<h2>Lease rollover</h2>');
      expect(parts[2]).toMatch(/<h2>Renewal worklist/);
    }
  });

  it('prospect-safe report: two sections, numbered 1 and 2 of 2, the rent roll beside the space on offer', () => {
    const { parts, heads } = sectionsOf(render('?print=1&safe=1').html);
    expect(parts).toHaveLength(2);
    expect(heads).toEqual([[1, 2], [2, 2]]);
    // What is left of the owner's third section is short: it shares the rent roll's page, in the next column.
    expect(parts[1]).toContain('sp-print__two--roll');
    for (const h of ['<h2>Rent roll</h2>', '<h2>Space on offer</h2>', '<h2>Coming supply</h2>']) expect(parts[1]).toContain(h);
    expect(parts[1].indexOf('<h2>Rent roll</h2>')).toBeLessThan(parts[1].indexOf('<h2>Space on offer</h2>'));
  });

  it('the head counts the sections that are printed: "of N" is the number of sections, in every report', () => {
    for (const query of ['?print=1', '?print=1&safe=1', '?print=1&lens=rent', '?print=1&safe=1&lens=rent']) {
      const { parts, heads } = sectionsOf(render(query).html);
      expect(heads.every((h) => h !== null), query).toBe(true);
      expect(heads.map((h) => h![0]), query).toEqual(parts.map((_, i) => i + 1));
      expect(new Set(heads.map((h) => h![1])), query).toEqual(new Set([parts.length]));
    }
  });

  it('the cover is one section: head, six figures, legend, plan and its footnote, in that order', () => {
    for (const query of ['?print=1', '?print=1&safe=1']) {
      const cover = sectionsOf(render(query).html).parts[0];
      const at = ['sp-print__running', 'sp-print__head', 'sp-print__kpis', 'sp-legend', 'sp-print__plan', 'sp-print__foot'].map((c) => cover.indexOf(`class="${c}`));
      expect(at.every((i) => i >= 0), query).toBe(true);
      expect([...at].sort((a, b) => a - b), query).toEqual(at);
      expect(cover).not.toContain('<section class="sp-print__page');
    }
  });

  it('the plan is drawn 1,400 px wide whatever the screen, so its printed height does not depend on the window', () => {
    for (const query of ['?print=1', '?print=1&safe=1']) {
      const svg = /<div class="sp-print__plan">.*?<svg[^>]*viewBox="0 0 (\d+) (\d+)"[^>]*>/.exec(render(query).html);
      expect(svg?.[1], query).toBe('1400');
      // Twelve rows of 48 px, 6 px between them and 2 px under the last.
      expect(svg?.[2], query).toBe('644');
    }
  });

  it('a note stands under its table, and the footnote under the plan, inside the same section', () => {
    const owner = sectionsOf(render('?print=1').html).parts;
    expect(owner[1]).toMatch(/<\/table><p class="sp-print__note">2 leases are not placed/);
    const safe = sectionsOf(render('?print=1&safe=1').html).parts;
    expect(safe[0]).toMatch(/<footer class="sp-print__foot">Floor width is proportional.*WALT and rollover are withheld\.<\/footer>/);
    expect(safe[1]).toMatch(/<\/table><p class="sp-print__note">Asking rents carry their unit and lease type/);
  });
});

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
    // The total line admits no data issue either (round 16: "rows sum to 211,700 SF; leased is capped…" told a
    // prospect that the records over-allocate). It states the leased figure, the share and the space, as on screen.
    expect(html).not.toMatch(/rows sum to|exceed|over-allocat|data issue/i);
    const total = /<tr class="sp-print__total">(.*?)<\/tr>/.exec(pages)?.[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? '';
    expect(total).toMatch(/^Total · [\d,]+ RSF leasable [\d,]+ leased [\d.]+% leased · [\d,]+ SF available · [\d,]+ SF signed, not in$/);
    expect(html).not.toMatch(/\b(Tour|Proposal|LOI|Lease Out)\b/);
    for (const l of property.leases) {
      expect(html, `names ${l.tenant}`).not.toContain(l.tenant);
      if (l.owner) expect(html, `names broker ${l.owner}`).not.toContain(l.owner);
    }
    // No lease shows its term, so the report has no expirations table at all (and so no rent or renewal column).
    expect(html).not.toMatch(/Lease expirations|Renewal worklist|No leases end in the next 12 months/);
    expect(html).not.toMatch(/<th>Rent<\/th>|<th>Renewal<\/th>|<th>Ends<\/th>/);
    expect(html).toContain('lease and sublease dates, WALT and rollover are withheld');
    // The rent roll: every lease in place is "Leased", and the table has no lease-date column at all.
    const roll = pages.slice(0, pages.indexOf('<h2>Space on offer</h2>'));
    expect(roll).not.toMatch(/<th>(Commencement|Expiration|Remaining)<\/th>/);
    expect(roll).toContain('<th>Available from</th>');
    const leased = [...roll.matchAll(/<tr>(.*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((c) => c[1])).filter((r) => r[4] === 'Leased');
    expect(leased.length).toBeGreaterThan(10);
    for (const r of leased) expect(r.slice(5), `Ste ${r[1]}`).toEqual(['—', 'Withheld']);
  });

  it('prospect-safe report: the rows and the leased total reconcile, in exact figures, without naming a data issue (round 17)', () => {
    const { html, model } = render('?print=1&safe=1');
    const over = model.roll.overAllocated.reduce((t, o) => t + o.sf, 0);
    expect(over).toBeGreaterThan(0);
    const pages = html.slice(html.indexOf('<h2>Rent roll</h2>'));
    const roll = pages.slice(0, pages.indexOf('<h2>Space on offer</h2>'));
    // The rows of space under lease (in place, sublet, signed and not yet in), as printed.
    const rows = [...roll.matchAll(/<tr>(.*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((c) => c[1])).filter((r) => ['Leased', 'Sublease', 'Committed'].includes(r[4]));
    const sum = rows.reduce((t, r) => t + Number(r[3].replace(/,/g, '')), 0);
    expect(sum).toBe(model.kpis.leased + over);
    const note = /<p class="sp-print__note sp-print__note--recorded">(.*?)<\/p>/.exec(roll)?.[1] ?? '';
    const n = (v: number) => v.toLocaleString('en-US');
    expect(note).toBe(`Suite areas are as recorded: the leased, sublease and committed rows add up to ${n(sum)} SF. Floor totals, and the ${n(model.kpis.leased)} SF leased, are capped at each floor’s leasable area.`);
    // The cover, where Floor 7 reads 100.0% over suites that add up to more, says the same in brief.
    const cover = sectionsOf(html).parts[0];
    expect(cover).toContain('Suite areas are as recorded; floor totals are capped at the floor’s leasable area.');
  });

  it('owner report keeps its own disclosure and prints no prospect footnote', () => {
    const { html } = render('?print=1');
    expect(html).not.toContain('Suite areas are as recorded');
  });

  it('owner report: the total line explains why the rows add up to more than the leased figure', () => {
    const { html, model } = render('?print=1');
    const over = model.roll.overAllocated.reduce((t, o) => t + o.sf, 0);
    expect(over).toBeGreaterThan(0);
    const total = /<tr class="sp-print__total">(.*?)<\/tr>/.exec(html)?.[1].replace(/<[^>]+>/g, ' ') ?? '';
    expect(total).toContain('rows sum to');
    expect(total).toMatch(/records exceed its leasable area by [\d,]+ SF, so leased is capped at [\d,]+ SF/);
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

  it('prospect-safe report prints no WALT figure: the card reads "Withheld", as on screen', () => {
    const open = render('?print=1');
    expect(open.model.kpis.walt).toBeGreaterThan(0);
    expect(open.html).toContain(`WALT</div><div class="sp-print__kpi-value">${open.model.kpis.walt.toFixed(2)} yr`);
    const { html, model } = render('?print=1&safe=1');
    expect(html).toMatch(/WALT<\/div><div class="sp-print__kpi-value">Withheld<\/div><div class="sp-print__kpi-note">Prospect-safe/);
    expect(html).not.toMatch(/\d(\.\d+)? yr\b|SF-weighted/);
    expect(html).not.toContain(open.model.kpis.walt.toFixed(2));
    // The model itself hands the report no figure to print.
    expect(model.kpis.walt).toBe(0);
  });

  it('prospect-safe report prints no date of any lease, signed leases included, at any as-of date asked for', () => {
    const leaseDates = new Set(property.leases.flatMap((l) => [l.commencement, l.expiration, l.termination]).filter((d): d is string => !!d));
    // A sublease's end is its sublandlord's lease end: withheld like the rest. An offer's available-from date is the offer's.
    for (const a of property.availabilities) if (a.subleaseExpiration) leaseDates.add(a.subleaseExpiration);
    for (const a of property.availabilities) if (a.availableFrom) leaseDates.delete(a.availableFrom);
    expect(leaseDates.has('2030-09-30')).toBe(true);
    const today = render('?print=1&safe=1').html;
    for (const d of leaseDates) {
      const [y, m, day] = d.split('-').map(Number);
      const long = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${day}, ${y}`;
      expect(today, long).not.toContain(long);
    }
    expect(today).not.toMatch(/Moves in|Vacated|Projected vacancy|thru |sublandlord/);
    // A link that asks for another date is drawn as of today: the report is the same, character for character.
    for (const asOf of ['2027-02-10', '2027-04-15', '2028-11-10', '2031-01-01']) expect(render(`?print=1&safe=1&asOf=${asOf}`).html, asOf).toBe(today);
  });

  it('prospect-safe report lists the space on offer with its dates and asking rents, and no quiet listing', () => {
    const { html } = render('?print=1&safe=1');
    const offer = html.slice(html.indexOf('<h2>Space on offer</h2>'), html.indexOf('<h2>Coming supply</h2>'));
    expect(offer.length).toBeGreaterThan(500);
    expect(offer).toContain('Fl 3 · 350');
    expect(offer).toMatch(/\$\d+–\$\d+\/SF\/yr (FSG|MG|NNN)/);
    // The sublease is on offer like any other space: from when and at what rent, with no end date.
    expect(offer).toContain('<td style="white-space:nowrap">Fl 7 · 720</td><td class="num">7,000</td><td>Sublease</td><td>Now</td><td>$24–$26/SF/yr FSG</td>');
    expect(offer).not.toMatch(/thru|2030/);
    // Suite 600 is occupied and listed quietly for April 2027: it is not on offer to a prospect.
    expect(offer).not.toMatch(/Fl 6 · 600|Apr 1, 2027/);
    expect(render('?print=1').html).not.toContain('<h2>Space on offer</h2>');
  });
});

describe('PrintLayout brand', () => {
  it('the cover head opens with the Stax lockup, before the building name, in every report', () => {
    for (const q of ['', '?safe=1', '?skin=classic']) {
      const { html } = render(q);
      const head = /<header class="sp-print__head">(.*?)<\/header>/.exec(html)![1];
      expect(head.startsWith('<div class="sp-print__brand">'), q).toBe(true);
      expect(head.indexOf('sp-lockup'), q).toBeLessThan(head.indexOf('<h1>'));
      expect(head, q).toContain('Stax');
      expect(head, q).toContain('by Ascendix');
    }
  });
});
