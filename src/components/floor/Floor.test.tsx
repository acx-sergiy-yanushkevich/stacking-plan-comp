// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { property, TODAY } from '../../data/mock/property';
import { parseState } from '../../state/planState';
import { buildModel } from '../inspector/testModel';
import { DealRows, InquiryRows } from './FloorLists';
import FloorView from './FloorView';
import { fittingInquiries, floorDeals } from './floorData';

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

const render = (search: string) => {
  const state = parseState(search, TODAY);
  const model = buildModel(state);
  return renderToString(<FloorView model={model} state={state} patch={() => {}} />);
};
/** Visible text and attribute values, as a reader or a screen reader would meet them. */
const text = (html: string) => html.replace(/<!-- -->/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');

describe('FloorView', () => {
  it('renders Floor 6 with its tenant and a sliced plate', () => {
    const html = render('?view=floor&floor=F6');
    expect(html).toContain('Floor 6');
    expect(html).toContain('Cirrus Energy');
    expect(html).toContain('<path');
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('Floor 6 plate, schematic');
    expect(html).toContain('OpenStreetMap');
  });

  it('hides every tenant and prospect name in prospect-safe mode', () => {
    const html = render('?view=floor&floor=F6&safe=1');
    expect(html).toContain('Floor 6');
    const names = [
      ...property.leases.map((l) => l.tenant),
      ...property.leases.flatMap((l) => l.deals.map((d) => d.prospect)),
      ...property.availabilities.flatMap((a) => a.deals.map((d) => d.prospect)),
      ...property.inquiries.map((i) => i.prospect),
    ];
    for (const n of names) expect(html, `leaked "${n}"`).not.toContain(n);
  });

  it('offers no deal, inquiry or issue tab in prospect-safe mode, on any floor', () => {
    // Tab content renders only once its tab is chosen, so an absent tab is an unreachable list.
    for (const f of property.floors) {
      const html = render(`?view=floor&floor=${f.id}&safe=1`);
      for (const tab of ['Deals (', 'Inquiries (', 'Issues (']) expect(html, `${f.name} offers ${tab}`).not.toContain(tab);
    }
    expect(render('?view=floor&floor=F6')).toContain('Deals (');
  });

  it('says nothing about deals, brokers, tenant risk, inquiries or data issues in prospect-safe mode, on any floor', () => {
    const deals = [...property.leases.flatMap((l) => l.deals), ...property.availabilities.flatMap((a) => a.deals)];
    const brokers = new Set(
      [...property.leases.flatMap((l) => [l.owner, l.lastTouch?.by]), ...deals.map((d) => d.broker), ...property.inquiries.map((i) => i.broker)].filter((b): b is string => !!b),
    );
    const words = ['Tour', 'Proposal', 'LOI', 'Lease Out', ...new Set(property.inquiries.map((i) => i.source))];
    const issueTitles = buildModel(parseState('', TODAY)).issues.map((i) => i.title);
    expect(brokers.size).toBeGreaterThan(1);
    expect(issueTitles.length).toBeGreaterThan(0);
    for (const f of property.floors) {
      const html = text(render(`?view=floor&floor=${f.id}&safe=1`));
      const where = `${f.name} in prospect-safe mode`;
      for (const b of brokers) expect(html, `${where} names broker ${b}`).not.toContain(b);
      for (const w of words) expect(html, `${where} says "${w}"`).not.toMatch(new RegExp(`\\b${w}\\b`));
      for (const t of issueTitles) expect(html, `${where} shows the issue "${t}"`).not.toContain(t);
      expect(html, `${where} mentions tenant risk`).not.toMatch(/holdover|month-to-month|\bMTM\b/i);
      expect(html, `${where} mentions a data issue`).not.toMatch(/over-allocated|unaccounted|data gap|\bstale\b/i);
      expect(html, `${where} offers a record action`).not.toMatch(/New deal|Create availability|Log call|Open record/);
    }
    // The same sweep finds all of it outside prospect-safe mode, so it is looking in the right place.
    const open = text(property.floors.map((f) => render(`?view=floor&floor=${f.id}`)).join(''));
    expect(open).toMatch(/Holdover/);
    expect(open).toMatch(/Month-to-month/);
    expect(open).toContain('Over-allocated by');
    expect(open).toContain('Data gap');
  });

  it('a floor with nothing vacant but space marketed for later says so, instead of "0 SF available"', () => {
    const html = text(render('?view=floor&floor=F6'));
    expect(html).toMatch(/100\.0% leased · 21,400 SF marketed from Apr\s'27/);
    expect(html).toMatch(/no direct space until Apr\s'27/);
    // The figure "0 SF available" itself, not the tail of another floor's "9,300 SF available" in the floor picker.
    expect(html).not.toMatch(/(?<![\d,])0 SF available/);
    expect(html).not.toContain('no direct space now');
  });

  it('keeps a quiet listing from a prospect: Floor 6 is simply fully leased', () => {
    const html = text(render('?view=floor&floor=F6&safe=1'));
    expect(html).toContain('100.0% leased · Nothing available');
    expect(html).toContain('no direct space now');
    expect(html).not.toMatch(/marketed|Avail\sApr|until Apr|quiet/i);
  });

  it('offers record actions for the floor under its KPIs: a deal, an availability, a call to the tenant who most needs it', () => {
    const html = text(render('?view=floor&floor=F6'));
    expect(html).toContain('aria-label="Floor 6 record actions"');
    expect(html).toContain('New deal on Floor 6');
    expect(html).toContain('Create availability');
    // The tenant is named on the button itself, with the reason.
    expect(html).toMatch(/Log call with Cirrus Energy \(expires Mar\s'27\)/);
    expect(text(render('?view=floor&floor=F12'))).toContain('New deal on Floor 12');
  });

  it('the floor-level call goes to the holdover tenant on Floor 3, not to the lease expiring in 2029', () => {
    const html = text(render('?view=floor&floor=F3'));
    expect(html).toContain('Log call with Argosy Partners (holdover)');
    expect(html).not.toContain('Log call with S&amp;P Enterprises');
  });

  it('prospect-safe: no floor names a next expiry, and no lease on any plate shows its term', () => {
    for (const f of property.floors) {
      const html = text(render(`?view=floor&floor=${f.id}&safe=1`));
      expect(html, f.name).not.toMatch(/Next expiry|None dated|Term not disclosed|\bExp(ired)? [A-Z][a-z]{2}/);
    }
    expect(text(render('?view=floor&floor=F3'))).toContain('Next expiry');
  });

  it('renders every floor without throwing, including the over-allocated one', () => {
    for (const f of property.floors) {
      const html = render(`?view=floor&floor=${f.id}`);
      expect(html).toContain(f.name);
    }
    expect(render('?view=floor&floor=F7')).toContain('Over-allocated by');
  });
});

describe('floor plate key', () => {
  // The test render has no canvas: text is measured by the average-glyph estimate at the 640 px fallback width.
  it('every tenant on every floor is named on the plate or in the key directly under it, never dropped', () => {
    for (const f of property.floors) {
      const html = text(render(`?view=floor&floor=${f.id}`));
      const plate = html.slice(html.indexOf('class="sp-plate"'), html.indexOf('class="sp-plate__caption"'));
      const drawn = [...plate.matchAll(/<text class="sp-seg__(?:name|tiny)"[^>]*>([^<]*)</g)].map((m) => m[1].trim()).join(' ');
      const key = [...plate.matchAll(/<li>(.*?)<\/li>/g)].map((m) => m[1].replace(/<[^>]+>/g, '')).join(' ');
      const model = buildModel(parseState(`?floor=${f.id}`, TODAY));
      for (const s of model.selectedFloor!.segments) {
        if (!s.lease || s.kind === 'available' || s.kind === 'projected' || s.kind === 'unmarketed' || s.kind === 'forsale') continue;
        const name = s.lease.tenant;
        expect(drawn.includes(name) || name.split(' ').every((w) => drawn.includes(w)) || key.includes(name), `${f.name}: ${name}`).toBe(true);
      }
    }
  });

  it('a key entry pairs the marker on the slice with the name, suite and SF', () => {
    const all = property.floors.map((f) => text(render(`?view=floor&floor=${f.id}`))).join('');
    const entries = [...all.matchAll(/<ol class="sp-plate__key"[^>]*>(.*?)<\/ol>/g)].flatMap((m) => [...m[1].matchAll(/<li>(.*?)<\/li>/g)].map((li) => li[1].replace(/<[^>]+>/g, '')));
    for (const e of entries) expect(e).toMatch(/^\d+Marker \d+: .+ · (Ste \d+ · )?[\d,]+ SF$/);
    // As many markers drawn on the plates as entries listed under them.
    expect((all.match(/<g class="sp-seg__key"/g) ?? []).length).toBe(entries.length);
  });
});

describe('floor lists', () => {
  const model = buildModel(parseState('', TODAY));
  const f6 = model.floors.find((f) => f.floor.id === 'F6')!;

  it('each deal row selects its suite and offers its record', () => {
    const deals = floorDeals(f6, false);
    expect(deals.length).toBeGreaterThan(0);
    const html = text(renderToString(<DealRows deals={deals} floorName="Floor 6" patch={() => {}} />));
    expect(html).toContain('Vantage Robotics');
    expect(html.match(/Open record</g)?.length).toBe(deals.length);
    expect(html).toContain('aria-label="Open record: Vantage Robotics deal, LOI"');
    expect(renderToString(<DealRows deals={[]} floorName="Floor 6" patch={() => {}} />)).toContain('No live deals on this floor.');
  });

  it('each inquiry row highlights its space and offers its record', () => {
    const inquiries = fittingInquiries(f6, property.inquiries, TODAY, false);
    expect(inquiries.length).toBeGreaterThan(0);
    const html = text(renderToString(<InquiryRows inquiries={inquiries} floorName="Floor 6" activeId={null} patch={() => {}} />));
    expect(html).toContain('Harbor Freight Regional HQ');
    expect(html.match(/Open record</g)?.length).toBe(inquiries.length);
    expect(html).toContain('aria-label="Open record: Harbor Freight Regional HQ inquiry"');
  });
});
