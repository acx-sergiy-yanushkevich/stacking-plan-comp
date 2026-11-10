// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors } from '../../domain/derive';
import { computeKpis, kpiDeltas } from '../../domain/kpis';
import { parseState } from '../../state/planState';
import type { PlanModel } from '../../model/usePlanModel';
import { KpiStrip } from './KpiStrip';
import { KpiReveal } from './KpiReveal';
import { waltCard, waltTitle } from './walt';

function render(asOf: string, safe = false, variant?: 'strip' | 'column') {
  const floors = deriveFloors(property, asOf, TODAY);
  const kpis = computeKpis(property, floors, asOf);
  const kpisToday = computeKpis(property, deriveFloors(property, TODAY, TODAY), TODAY);
  const model = { kpis, kpisToday, deltas: asOf === TODAY ? null : kpiDeltas(kpis, kpisToday), safe } as unknown as PlanModel;
  const html = renderToString(<KpiStrip model={model} state={parseState(safe ? '?safe=1' : '', TODAY)} onAction={() => {}} variant={variant} />);
  return { html, kpis, kpisToday };
}

describe('WALT figure', () => {
  it('shows two decimals on the card', () => {
    expect(waltCard(2.98463)).toBe('2.98');
    expect(waltCard(3)).toBe('3.00');
    const { html, kpis } = render(TODAY);
    expect(html).toContain(`${kpis.walt.toFixed(2)}<span class="sp-kpi__unit"> <!-- -->yr</span>`);
  });

  it('states the figure to four decimals, the weighting and the rounding in the tooltip', () => {
    const title = waltTitle(2.98463);
    expect(title).toContain('2.9846 years');
    expect(title).toContain('35.82 months');
    expect(title).toContain('to four decimals; the card rounds to two');
    expect(title).toContain('weighted by its SF');
    expect(title).toContain('Holdover and month-to-month leases count as 0 years');
    const { html, kpis } = render(TODAY);
    expect(html).toContain(`${kpis.walt.toFixed(4)} years`);
  });

  it('shows the change against today as the difference of the two cards', () => {
    const { html, kpis, kpisToday } = render('2028-01-01');
    const dw = Number(waltCard(kpis.walt)) - Number(waltCard(kpisToday.walt));
    expect(html).toContain(`${dw >= 0 ? '+' : '−'}${Math.abs(dw).toFixed(2)} yr`);
  });
});

describe('KpiStrip', () => {
  it('renders six cards, each label a single phrase', () => {
    const { html } = render(TODAY);
    expect(html.match(/class="sp-kpi__label sp-label"/g)?.length).toBe(6);
    for (const label of ['Leased', 'Available', 'Largest block', 'Expiring 12 mo', 'WALT', 'Pipeline']) expect(html).toContain(`>${label}</span>`);
  });

  it('withholds the pipeline in prospect-safe mode', () => {
    const { html } = render(TODAY, true);
    expect(html).toContain('Withheld');
    expect(html).not.toContain('on vacancies');
  });
});

describe('KpiStrip, column variant', () => {
  /** The same card with only the wrapper's class differing: everything a card says is shared. */
  const cards = (html: string) => html.replace(/^<section class="[^"]*"/, '<section');

  it('is the same six cards as the strip: labels, figures, notes, tooltips and pressed state', () => {
    const strip = render(TODAY).html;
    const column = render(TODAY, false, 'column').html;
    expect(column).toContain('class="sp-kpis sp-kpis--col sp-no-print"');
    expect(column).not.toContain('sp-card');
    expect(cards(column)).toBe(cards(strip));
    expect(column.match(/<button type="button" class="sp-kpi/g)?.length).toBe(6);
    expect(column).toContain('title="Space a tenant could take on the as-of date. Click to find space by size."');
  });

  it('carries the time-travel change chips', () => {
    const { html } = render('2028-01-01', false, 'column');
    expect(html.match(/class="sp-kpi__delta/g)?.length).toBe(6);
    expect(cards(html)).toBe(cards(render('2028-01-01').html));
  });

  it('withholds the pipeline in prospect-safe mode, as the strip does', () => {
    const { html } = render(TODAY, true, 'column');
    expect(html).toContain('Withheld');
    expect(html).not.toContain('on vacancies');
    expect(html).toContain('sp-kpi--static');
    expect(cards(html)).toBe(cards(render(TODAY, true).html));
  });
});

describe('KpiReveal', () => {
  const slot = (open: boolean) => renderToString(<KpiReveal open={open}><p>figures</p></KpiReveal>);

  it('shows its content when open', () => {
    const html = slot(true);
    expect(html).toContain('figures');
    expect(html).not.toContain('hidden');
    expect(html).not.toContain('inert');
  });

  it('renders nothing reachable when closed: hidden, inert and empty', () => {
    const html = slot(false);
    expect(html).not.toContain('figures');
    expect(html).toMatch(/<div class="sp-kpis-slot sp-no-print" hidden=""/);
    expect(html).toContain('inert');
  });
});
