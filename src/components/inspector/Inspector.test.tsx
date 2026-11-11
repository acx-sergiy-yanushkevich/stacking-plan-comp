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
  // React separates adjacent text nodes with an empty comment; the text is what is asserted.
  const html = renderToString(<Inspector model={model} state={state} patch={() => {}} mode={deriveMode(state)} />).replace(/<!-- -->/g, '');
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

  it('Floor: the largest block of a floor whose only space is sublet is that sublease (Floor 7), not a dash', () => {
    for (const safe of ['', '&safe=1']) {
      const html = render(`?floor=F7${safe}`).html.replace(/ /g, ' ');
      const card = /<span class="sp-label">Largest contiguous<\/span>(.*?)<\/div>/.exec(html)?.[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      expect(card, safe).toBe('7,000 SF One sublease suite');
    }
  });

  it('Find: results and empty state', () => {
    const r = render('?req=12000');
    expect(r.html).toContain('Find space');
    expect(r.html).toContain('Largest block now');
    expect(r.html).toContain('Options ·');
    expect(r.model.fits!.options.length).toBeGreaterThan(0);
    const e = render('?req=90000');
    expect(e.html).toContain('No space fits 90,000 SF');
    // Nothing is set that could be relaxed, so the advice is how much space there is: no "raise the maximum", no "move the date".
    expect(e.html).toContain('The largest block available now is 9,300 SF on Floor 12.');
    expect(e.html).not.toMatch(/Raise the maximum|drop the type filter|move the date|Try 12 months later|Remove the maximum|Search any type/);
    const i = render('?inquiry=I02');
    expect(i.html).toContain('Options');
  });

  it('Find: every row names its suites, and a floor is not listed twice in the alternatives', () => {
    const { html, model } = render('?req=12000&fit=direct&mode=find');
    const rows = [...html.matchAll(/<div class="sp-ins__row-suites">(.*?)<\/div>/g)].map((m) => m[1]);
    expect(rows).toHaveLength(model.fits!.options.length + model.fits!.alternatives.length);
    for (const r of rows) expect(r).toMatch(/^Ste \d+/);
    expect(rows).toContain('Ste 850 + Ste 860');
    const near = html.slice(html.indexOf('aria-label="Near misses"'));
    expect(near.match(/<span>Floor 8<\/span>/g)).toHaveLength(1);
    expect(near).toContain('4,600 SF short');
    expect(near).not.toContain('7,800 SF short');
  });

  it('Find: the alternatives never repeat an option, never exceed the maximum, and the text names only what is listed', () => {
    // 12,000 SF: Floor 6 (Ste 600) is the option; Floors 6–7 is that suite with the sublease under it.
    const twelve = render('?req=12000&mode=find').html;
    const near = twelve.slice(twelve.indexOf('aria-label="Near misses"'));
    expect(near).toContain('<span>Floors 7–8</span>');
    expect(near).not.toContain('Floors 6–7');
    expect(near).not.toContain('Ste 600');
    expect(twelve).toContain('Smaller spaces with their shortfall, and stacked floors that combine direct and sublease space.');
    // 9,000–9,500 SF: every stack is over the maximum, so none is listed and the note names none.
    const capped = render('?req=9000&max=9500&mode=find').html;
    expect(capped).toContain('aria-label="Near misses"');
    expect(capped).not.toMatch(/over max|stacked floors|Floors \d+–\d+|14,400 SF|28,400 SF/);
    expect(capped).toContain('Smaller spaces with their shortfall.');
    expect(capped).toContain('1,600 SF short');
    // 40,000 SF: nothing fits and only single spaces are listed.
    const forty = render('?req=40000&mode=find').html;
    expect(forty).toContain('The closest spaces are listed below.');
    expect(forty).not.toMatch(/floor combinations|stacked floors/i);
  });

  it('Find: the empty state suggests only what would help, with a button that does it', () => {
    const max = render('?req=1000&max=1200&mode=find').html;
    expect(max).toContain('No space fits 1,000–1,200 SF');
    expect(max).toMatch(/Without the 1,200 SF maximum, \d+ options? fits?\./);
    expect(max).toContain('Remove the maximum');
    expect(max).not.toMatch(/Search any type|move the date|Try 12 months later/);
    const type = render('?req=8000&fit=sublease&mode=find').html;
    expect(type).toContain('No sublease space fits 8,000 SF');
    expect(type).toMatch(/With the type set to Any instead of Sublease, \d+ options? fits?\./);
    expect(type).toContain('Search any type');
    expect(type).not.toMatch(/Remove the maximum|maximum/);
  });

  it('Find: a needed-by date before the as-of date is refused with a message, shown as entered and not applied', () => {
    // An old link, or a date typed day-first in a month-first browser: 11 September 2026 against 9 November 2026.
    const { html, model, state } = render('?req=5000&by=2026-09-11&mode=find');
    expect(state.by).toBe('2026-09-11');
    expect(model.req!.by).toBeNull();
    expect(html).toContain('role="alert"');
    expect(html).toContain('Sep 11, 2026 is before the as-of date, Nov 9, 2026, so it is not applied. Enter today or a later date. The search has no needed-by date.');
    // The field is a date control and still holds what was entered; it is marked invalid.
    expect(html).toMatch(/<input[^>]*type="date"[^>]*value="2026-09-11"/);
    expect(html).toMatch(/<input[^>]*aria-invalid="true"/);
    // Nothing is marked late by a date that was refused.
    expect(html).not.toContain('>late<');
    // A date on or after the as-of date is applied and read back with the month in words.
    const ok = render('?req=5000&by=2027-09-11&mode=find');
    expect(ok.model.req!.by).toBe('2027-09-11');
    expect(ok.html).toContain('Needed by Sep 11, 2027.');
    expect(ok.html).not.toContain('role="alert"');
    expect(render(`?req=5000&by=${TODAY}&mode=find`).html).not.toContain('role="alert"');
  });

  it('Find: prospect-safe never shows an inquiry, matched before or by a link', () => {
    const open = render('?inquiry=I02&mode=find');
    expect(open.html).toContain('Based on');
    expect(open.model.req).toMatchObject({ size: 15000, max: 22000, by: '2027-06-30' });
    const safe = render('?safe=1&inquiry=I02&mode=find');
    expect(safe.state.inquiry).toBeNull();
    expect(safe.model.req).toBeNull();
    expect(safe.html).not.toMatch(/inquir|15,000|22,000|Jun 30, 2027/i);
    // Even a state built by hand, past the state layer, gives the panel nothing to say.
    const forced = { ...safe.state, inquiry: 'I02' };
    const model = buildModel(forced);
    expect(model.req).toBeNull();
    expect(renderToString(<Inspector model={model} state={forced} patch={() => {}} mode="find" />)).not.toMatch(/inquir|15,000|22,000|Jun 30, 2027/i);
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

  it('Area: a small toggle beside Close widens the panel to the brief and back', () => {
    const state = parseState('?mode=area', TODAY);
    const model = buildModel(state);
    const narrow = renderToString(<Inspector model={model} state={state} patch={() => {}} mode="area" areaPanel={<div>Area here</div>} />);
    expect(narrow).toMatch(/<button[^>]*aria-label="Location brief"[^>]*aria-pressed="false"|<button[^>]*aria-pressed="false"[^>]*aria-label="Location brief"/);
    expect(narrow).toContain('Area here');
    const wide = renderToString(<Inspector model={model} state={{ ...state, mode: 'brief' }} patch={() => {}} mode="brief" areaPanel={<div>Area here</div>} />);
    expect(wide).toMatch(/<button[^>]*aria-label="Location brief"[^>]*aria-pressed="true"|<button[^>]*aria-pressed="true"[^>]*aria-label="Location brief"/);
    expect(wide).toContain('Area here');
    // The same panel, wider: its title stays.
    expect(wide).toMatch(/<h2 class="sp-ins__title"[^>]*>Area<\/h2>/);
  });

  it('only the Area panel can be widened', () => {
    for (const query of ['', '?select=L13-U1', '?mode=find', '?mode=issues']) {
      const state = parseState(query, TODAY);
      const html = renderToString(<Inspector model={buildModel(state)} state={state} patch={() => {}} mode={deriveMode(state)} />);
      expect(html, query).not.toContain('aria-label="Location brief"');
    }
  });

  it('Building mode leads with the area preview, for a prospect too (team review: Area was too hidden)', () => {
    for (const query of ['?view=stack', '?view=map', '?view=stack&safe=1']) {
      const state = parseState(query, TODAY);
      const model = buildModel(state);
      const html = renderToString(<Inspector model={model} state={state} patch={() => {}} mode="building" areaPreview={<div>Around here</div>} />);
      expect(html, query).toContain('Around here');
      // First in the panel's content: above the rollover (or, for a prospect, the first section shown).
      expect(html.indexOf('Around here'), query).toBeLessThan(html.indexOf('sp-ins__section'));
    }
  });

  it('the area preview is the Building panel\'s alone: not on a suite, a floor or a tool panel', () => {
    for (const query of ['?select=L13-U1', '?floor=F6&view=stack', '?mode=find', '?mode=area']) {
      const state = parseState(query, TODAY);
      const model = buildModel(state);
      const html = renderToString(<Inspector model={model} state={state} patch={() => {}} mode={deriveMode(state)} areaPreview={<div>Around here</div>} />);
      expect(html, query).not.toContain('Around here');
    }
  });
});

describe('prospect-safe availability records (round 19)', () => {
  it('shows no verified stamp on an availability or the for-sale condo; the owner still sees it', () => {
    for (const sel of ['A02', 'A10']) {
      expect(render(`?safe=1&select=${sel}`).html, sel).not.toMatch(/Verified/);
      expect(render(`?select=${sel}`).html, sel).toMatch(/Verified/);
    }
  });
});
