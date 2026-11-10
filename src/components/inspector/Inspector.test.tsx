// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { property, TODAY } from '../../data/mock/property';
import { deriveMode, parseState } from '../../state/planState';
import Inspector from './Inspector';
import { buildModel } from './testModel';

function render(search: string) {
  const state = parseState(search, TODAY);
  const model = buildModel(state);
  const html = renderToString(<Inspector model={model} state={state} patch={() => {}} mode={deriveMode(state)} />);
  return { html, model, state };
}

const TENANTS = ['Cirrus Energy', 'Anadarko', 'Argosy', 'Bowline', 'Hanover', 'Halcyon', 'Delta Dental', 'Lumen', 'Kinetic', 'Vantage Robotics', 'Orchid Bio', 'Northwind'];
const expectNoTenants = (html: string) => {
  for (const t of TENANTS) expect(html, `leaks "${t}"`).not.toContain(t);
};

describe('Inspector', () => {
  it('Building: rollover, at risk, supply, pipeline, issues, changes', () => {
    const { html } = render('');
    expect(html).toContain('Rollover');
    expect(html).toContain('At risk');
    expect(html).toContain('Coming supply');
    expect(html).toContain('Pipeline by stage');
    expect(html).toContain('Data issues');
    expect(html).toContain('Recent changes');
    expect(html).toContain('Cirrus Energy'); // most recent change
    expect(html).toContain('Term Expiration Date');
    expect(html).toContain('role="button"'); // chart bars
    expect(html).toContain('&lt; 12 mo');
  });

  it('Block (lease): tenant, term, rent, broker, deals, actions', () => {
    const { html } = render('?select=L13-U1');
    expect(html).toContain('Cirrus Energy');
    expect(html).toContain('Tom Conner');
    expect(html).toContain('$29/SF/yr FSG');
    expect(html).toContain('Dana Whitfield');
    expect(html).toContain('Marketed for later');
    expect(html).toContain('Vantage Robotics');
    expect(html).toContain('Open lease');
    expect(html).toContain('Start renewal');
    expect(html).toContain('21,400 SF');
  });

  it('Block (availability): asking range, divisible, inquiries, deals', () => {
    const { html } = render('?select=A02');
    expect(html).toContain('Direct');
    expect(html).toContain('$30–$32/SF/yr FSG');
    expect(html).toContain('min 2,500 SF');
    expect(html).toContain('Northwind Health');
    expect(html).toContain('Open availability');
  });

  it('Block (gap): suspect lease and Add unit', () => {
    const { html } = render('?select=F2-gap');
    expect(html).toContain('unaccounted');
    expect(html).toContain('Delta Dental Plan');
    expect(html).toContain('Add unit');
  });

  it('Block (for sale) and committed', () => {
    expect(render('?select=A10').html).toContain('Asking price');
    expect(render('?select=L09-U1').html).toContain('Signed lease');
  });

  it('Floor: KPIs, suites, floor plate', () => {
    const { html } = render('?floor=F3');
    expect(html).toContain('Floor 3');
    expect(html).toContain('Largest contiguous');
    expect(html).toContain('Open floor plate');
    expect(html).toContain('Argosy Partners');
  });

  it('Find: results and empty state', () => {
    const r = render('?req=12000');
    expect(r.html).toContain('Find space');
    expect(r.html).toContain('Largest block now');
    expect(r.html).toContain('Options ·');
    expect(r.model.fits!.options.length).toBeGreaterThan(0);
    const e = render('?req=90000');
    expect(e.html).toContain('No space fits 90,000 SF');
    expect(e.html).toContain('Try 12 months later');
    const i = render('?inquiry=I02');
    expect(i.html).toContain('Options');
  });

  it('Worklist: window chips, rows, export', () => {
    const { html } = render('?window=12');
    expect(html).toContain('12 months');
    expect(html).toContain('Renewal worklist');
    expect(html).toContain('Export CSV');
    expect(html).toContain('Cirrus Energy');
    const risk = render('?window=risk').html;
    expect(risk).toContain('Holdover');
    expect(risk).toContain('MTM');
  });

  it('Issues: grouped with fix and locate', () => {
    const { html } = render('?mode=issues');
    expect(html).toContain('Errors ·');
    expect(html).toContain('Locate');
    expect(html).toContain('Add unit');
    expect(html).toContain('over-allocated');
  });

  it('Prospect-safe hides tenants, contacts, rents and prospects everywhere', () => {
    for (const q of ['?safe=1', '?safe=1&select=L13-U1', '?safe=1&select=A02', '?safe=1&select=F2-gap', '?safe=1&floor=F6', '?safe=1&req=12000', '?safe=1&window=12', '?safe=1&mode=issues']) {
      const { html } = render(q);
      expectNoTenants(html);
      // In-place rents never appear; asking rents on vacancies may ("Asking $30–$32/SF/yr FSG").
      // Asking rents are ranges ("$32–$34/SF/yr FSG"); an in-place rent is a single figure. Only the latter may never appear.
      const stripped = html.replace(/(Asking )?\$[\d.,]+–\$[\d.,]+\/SF\/(yr|mo) (FSG|MG|NNN)/g, '');
      expect(stripped, `${q} leaks a rate`).not.toContain('/SF/yr');
      expect(html, `${q} leaks a contact`).not.toContain('Tom Conner');
    }
  });

  it('Prospect-safe says nothing about deals, brokers, activity, tenant risk, inquiries or data issues', () => {
    const deals = [...property.leases.flatMap((l) => l.deals), ...property.availabilities.flatMap((a) => a.deals)];
    const brokers = new Set(
      [...property.leases.flatMap((l) => [l.owner, l.lastTouch?.by]), ...deals.map((d) => d.broker), ...property.inquiries.map((i) => i.broker), ...property.history.map((c) => c.by)].filter(
        (b): b is string => !!b,
      ),
    );
    const sources = new Set(property.inquiries.map((i) => i.source));
    const selections = [...buildModel(parseState('', TODAY)).segIndex.keys()].map((k) => `?safe=1&select=${k}`);
    const floors = property.floors.map((f) => `?safe=1&floor=${f.id}`);
    for (const q of ['?safe=1', '?safe=1&req=12000', '?safe=1&inquiry=I02', '?safe=1&window=12', '?safe=1&window=risk', '?safe=1&mode=issues', ...selections, ...floors]) {
      const html = render(q).html.replace(/<!-- -->/g, '');
      for (const b of brokers) expect(html, `${q} names ${b}`).not.toContain(b);
      for (const w of ['Tour', 'Proposal', 'LOI', 'Lease Out', ...sources]) expect(html, `${q} says "${w}"`).not.toMatch(new RegExp(`\\b${w}\\b`));
      expect(html, `${q} mentions tenant risk`).not.toMatch(/holdover|month-to-month|\bMTM\b/i);
      expect(html, `${q} mentions a data issue`).not.toMatch(/over-allocated|unaccounted|no Unit records|\bstale\b|\d+ (errors?|warnings?)\b/i);
      expect(html, `${q} shows CRM activity`).not.toMatch(/Last touch|No touch logged|\bd ago\b/);
      expect(html, `${q} offers a record action`).not.toMatch(/Open lease|Open availability|New deal|Log a call|Start renewal|Create listing|Add unit/);
      expect(html, `${q} lists inquiries`).not.toMatch(/Inquiries that fit|Match an open inquiry/);
    }
  });

  it('Coming supply and the block panel leave a quiet listing out in prospect-safe mode', () => {
    const open = render('').html.replace(/<!-- -->/g, '');
    expect(open).toMatch(/Occupied, marketed for later.*From Apr 2027.*21,400 SF/);
    const safe = render('?safe=1').html.replace(/<!-- -->/g, '');
    expect(safe).toContain('Nothing marketed ahead');
    expect(safe).not.toContain('From Apr 2027');
    // Ste 600 is leased and marketed quietly from Apr 2027: the broker sees the listing, a prospect a leased suite.
    const block = render('?select=L13-U1').html;
    expect(block).toContain('Marketed for later');
    expect(block).toContain('Quiet · not published');
    const safeBlock = render('?safe=1&select=L13-U1').html;
    expect(safeBlock).not.toMatch(/Marketed for later|Available from|Quiet|not published|Published/);
    expect(render('?safe=1&window=12').html).not.toMatch(/Marketed from/);
    expect(render('?window=12').html).toMatch(/Marketed from Apr/);
  });

  it('Floor panel: a fully leased floor with space marketed for later says so', () => {
    const html = render('?floor=F6').html.replace(/<!-- -->/g, '').replace(/&#x27;/g, "'");
    expect(html).toMatch(/21,400 SF marketed from Apr\s'27/);
    expect(html).toMatch(/No direct space until Apr\s'27/);
    expect(html).not.toContain('Nothing on the market now');
    const safe = render('?safe=1&floor=F6').html;
    expect(safe).toContain('Nothing on the market now');
    expect(safe).toContain('No direct space now');
  });

  it('In-place rent is weighted by recorded SF and says so', () => {
    const { html, model } = render('');
    const fsg = model.kpis.rentByType.find((r) => r.type === 'FSG')!;
    expect(html.replace(/<!-- -->/g, '')).toContain(`${fsg.sf.toLocaleString('en-US')} SF on record`);
    expect(html).toContain('recorded SF');
    expect(html).toContain('the over-allocation cap on leased SF is not applied');
    expect(render('?safe=1').html).not.toContain('In-place rent');
  });

  it('Area mode renders the supplied panel or a placeholder', () => {
    const state = parseState('?mode=area', TODAY);
    const model = buildModel(state);
    expect(renderToString(<Inspector model={model} state={state} patch={() => {}} mode="area" />)).toContain('Area');
    expect(renderToString(<Inspector model={model} state={state} patch={() => {}} mode="area" areaPanel={<div>Demographics here</div>} />)).toContain('Demographics here');
  });
});
