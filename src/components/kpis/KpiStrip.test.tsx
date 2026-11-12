// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors } from '../../domain/derive';
import { computeKpis, kpiDeltas, type Kpis } from '../../domain/kpis';
import { safeKpis } from '../../domain/safe';
import { parseState } from '../../state/planState';
import type { PlanModel } from '../../model/usePlanModel';
import { KpiStrip } from './KpiStrip';
import { waltCard, waltTitle } from './walt';
import { dollars, num, usd } from '../../domain/format';

function render(asOf: string, safe = false, search = '', override: Partial<Kpis> = {}) {
  const floors = deriveFloors(property, asOf, TODAY);
  const kpis = { ...safeKpis(computeKpis(property, floors, asOf), safe), ...override };
  const kpisToday = computeKpis(property, deriveFloors(property, TODAY, TODAY), TODAY);
  const model = { kpis, kpisToday, deltas: asOf === TODAY ? null : kpiDeltas(kpis, kpisToday), safe } as unknown as PlanModel;
  const html = renderToString(<KpiStrip model={model} state={parseState(search || (safe ? '?safe=1' : ''), TODAY)} onAction={() => {}} />);
  return { html, kpis, kpisToday };
}

/** One KPI as rendered (a button, or a plain figure where there is nothing to open), found by its action. */
const kpiOf = (html: string, id: string) => new RegExp(`<(button|div)[^>]*data-kpi="${id}"[^>]*>.*?</\\1>`).exec(html)?.[0] ?? '';
/** An attribute of a KPI's own element, with the entities React escapes turned back. */
const attr = (el: string, name: string) => (new RegExp(`^<[^>]* ${name}="([^"]*)"`).exec(el)?.[1] ?? '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
/** What a screen reader is given for a KPI: its content, less what is hidden from it (spaces of every kind as one space). */
const spoken = (el: string) =>
  el
    .replace(/<span class="sp-kpi__context" aria-hidden="true">.*?<\/span><\/span>/, '')
    .replace(/<span class="sp-kpi__dot" aria-hidden="true"><\/span>/g, '')
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
/** The note under a figure, as it is on screen. */
const noteOf = (el: string) => /<span class="sp-kpi__note">(.*?)<\/span>/.exec(el)?.[1].replace(/&#x27;/g, "'") ?? '';

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
  it('is two surfaces: the switches that color the plan, and the details that only inform', () => {
    const { html } = render(TODAY);
    expect(html).toMatch(/^<section class="sp-kpis sp-no-print" aria-label="Key figures">/);
    // One card per group; no figure is a card of its own.
    expect(html.match(/sp-card/g)?.length).toBe(2);
    const group = (kind: string) => new RegExp(`<div role="group" class="sp-card sp-kpis__group sp-kpis__group--${kind}" aria-label="([^"]+)">(.*?)</div><span class="sp-kpis__caption" aria-hidden="true">([^<]+)</span></div>`).exec(html);
    const lens = group('lens');
    const open = group('open');
    expect([lens?.[1], lens?.[3]]).toEqual(['Color the plan by', 'Color by']);
    expect([open?.[1], open?.[3]]).toEqual(['Details', 'Details']);
    const ids = (part = '') => [...part.matchAll(/data-kpi="([^"]+)"/g)].map((m) => m[1]);
    // One switch per lens, the ones a prospect is also offered first (so the mode takes the last away and moves none).
    expect(ids(lens?.[2])).toEqual(['status', 'rent', 'expiry', 'deals']);
    expect(ids(open?.[2])).toEqual(['find', 'find-largest', 'timeline']);
    // A switch carries a dot that fills when it is on. A detail is a plain figure: nothing to click, no arrow,
    // no button, so it promises no behaviour it would have to explain (team review, Nov 12).
    expect(lens?.[2].match(/class="sp-kpi__dot"/g)?.length).toBe(4);
    expect(lens?.[2].match(/<button type="button" class="sp-kpi sp-kpi--lens/g)?.length).toBe(4);
    expect(open?.[2].match(/<div class="sp-kpi sp-kpi--detail"/g)?.length).toBe(3);
    expect(open?.[2]).not.toContain('<button');
    expect(open?.[2]).not.toContain('sp-kpi--open');
    expect(open?.[2]).not.toContain('sp-kpi__dot');
    expect(html.match(/class="sp-kpi__label sp-label"/g)?.length).toBe(7);
    // A switch is named for its lens, one name per thing (the toolbar's picker is gone: team review, Nov 12).
    for (const label of ['Leasing', 'Rent', 'Expiration', 'Pipeline', 'Available', 'Largest block', 'Avg term']) expect(html).toContain(`>${label}</span>`);
  });

  it('gives each figure one short note and keeps the whole note in the tooltip and the accessible name', () => {
    const { html, kpis } = render(TODAY);
    const notes = Object.fromEntries(['status', 'rent', 'expiry', 'deals', 'find', 'find-largest', 'timeline'].map((id) => [id, noteOf(kpiOf(html, id))]));
    expect(notes).toEqual({
      status: '80.2% occupied',
      rent: 'FSG · in place',
      expiry: '16.7% of leased · 4 leases',
      deals: '57,800 SF in play',
      find: '26,200 direct · 7,000 sublease',
      'find-largest': 'Floor 12 · direct',
      timeline: 'SF-weighted',
    });
    // What the short note leaves out is one hover (or one screen-reader stop) away, never lost.
    const whole: Record<string, string> = {
      status: '80.2% occupied · 8,000 SF signed, not yet in',
      // Every lease type, largest share first; the card shows the first.
      rent: kpis.rentByType.map((r) => `${r.type} ${usd(r.avg)}/SF/yr on ${num(r.sf)} SF`).join(' · '),
      expiry: '16.7% of leased · 4 leases',
      // The month and its year are kept together by a no-break space.
      find: "26,200 direct · 7,000 sublease · +21,400 Apr\u00a0'27",
      'find-largest': 'Floor 12 · direct · contiguous',
      timeline: 'In-place, SF-weighted',
      deals: '6 on vacancies · 3 renewals · 57,800 SF in play, each space once at its largest live deal (the deals request 75,800 SF in all)',
    };
    for (const [id, detail] of Object.entries(whole)) {
      const el = kpiOf(html, id);
      expect(attr(el, 'title').slice(0, detail.length + 2)).toBe(`${detail}. `);
      // The name is the content: the whole note is read, the short one on screen is not read twice.
      expect(el).toContain('<span class="sp-kpi__context" aria-hidden="true">');
      expect(spoken(el).endsWith(` ${detail.replace(/\s+/g, ' ')}`)).toBe(true);
      expect(el).not.toContain('aria-label');
    }
    // The tooltips say what the figure is; a detail promises no click.
    expect(attr(kpiOf(html, 'find'), 'title')).toContain('Space a tenant could take on the as-of date. Point at it to see it on the plan.');
    expect(attr(kpiOf(html, 'find-largest'), 'title')).toContain('Largest run of adjacent direct availabilities. Point at it to see it on the plan.');
    for (const id of ['find', 'find-largest', 'timeline']) expect(attr(kpiOf(html, id), 'title'), id).not.toMatch(/click/i);
    for (const id of ['status', 'rent', 'expiry', 'deals']) expect(attr(kpiOf(html, id), 'title'), id).toMatch(/Click to color the plan by/);
    expect(attr(kpiOf(html, 'timeline'), 'title')).toContain(`${kpis.walt.toFixed(4)} years`);
    // The name starts with the label and the exact figure with its unit.
    expect(spoken(kpiOf(html, 'find'))).toBe("Available 33,200 SF 26,200 direct · 7,000 sublease · +21,400 Apr '27");
    expect(spoken(kpiOf(html, 'status'))).toBe('Leasing 86.1% 80.2% occupied · 8,000 SF signed, not yet in');
  });

  it('never abbreviates a figure: each is printed whole, with its unit', () => {
    const { html, kpis } = render(TODAY);
    expect(html).toContain(`<span class="sp-kpi__figure">${(kpis.availableDirect + kpis.availableSublease).toLocaleString('en-US')}<span class="sp-kpi__unit"> <!-- -->SF</span></span>`);
    expect(html).toContain(`<span class="sp-kpi__figure">${kpis.maxContiguous.size.toLocaleString('en-US')}<span class="sp-kpi__unit"> <!-- -->SF</span></span>`);
    expect(html).not.toContain('…');
  });

  it('marks only the switches as pressed, one at a time; a figure that opens something is never pressed', () => {
    const pressed = (html: string) => [...html.matchAll(/data-kpi="([^"]+)"[^>]*aria-pressed="true"/g)].map((m) => m[1]);
    expect(pressed(render(TODAY).html)).toEqual(['status']);
    const deals = render(TODAY, false, '?lens=deals').html;
    expect(pressed(deals)).toEqual(['deals']);
    expect(kpiOf(deals, 'deals')).toContain('class="sp-kpi sp-kpi--lens is-active"');
    expect(kpiOf(deals, 'status')).not.toContain('is-active');
    expect(pressed(render(TODAY, false, '?lens=rent').html)).toEqual(['rent']);
    expect(pressed(render(TODAY, false, '?lens=expiry').html)).toEqual(['expiry']);
    // A prospect-safe link that names a withheld lens draws Leasing (App falls back to status): Leasing is pressed.
    expect(pressed(render(TODAY, true, '?safe=1&lens=deals').html)).toEqual(['status']);
    // A panel open over a status plan keeps Leased pressed: the plan is still coloured by status (round 18).
    for (const search of ['?mode=find', '?mode=area', '?mode=brief', '?q=cirrus']) expect(pressed(render(TODAY, false, search).html), search).toEqual(['status']);
    for (const search of ['?mode=find', '?lens=expiry&window=12&mode=worklist']) {
      const html = render(TODAY, false, search).html;
      expect(pressed(html)).toEqual(search === '?mode=find' ? ['status'] : ['expiry']);
      for (const id of ['find', 'find-largest', 'timeline']) {
        expect(kpiOf(html, id)).not.toContain('aria-pressed');
        expect(kpiOf(html, id)).not.toContain('is-active');
      }
    }
  });

  it('carries the time-travel change beside each figure, and in its name', () => {
    const { html } = render('2028-01-01');
    // Six chips: the Rent card carries none (a dollar change against today is not worth the row's height).
    expect(html.match(/class="sp-kpi__delta/g)?.length).toBe(6);
    expect(kpiOf(html, 'rent')).not.toContain('sp-kpi__delta');
    for (const id of ['status', 'expiry', 'deals', 'find', 'find-largest', 'timeline']) {
      const el = kpiOf(html, id);
      const chip = /<span class="sp-kpi__delta[^"]*" title="Change against today">(.*?)<span class="sp-sr-only">/.exec(el)?.[1] ?? '';
      expect(chip).toMatch(/^[+−±-]?\d/);
      // The chip follows its figure inside the same value.
      expect(el).toMatch(/<span class="sp-kpi__value"><span class="sp-kpi__figure">.*?<\/span><span class="sp-kpi__delta/);
      expect(spoken(el)).toContain(` ${chip} against today `);
    }
    expect(render(TODAY).html).not.toContain('sp-kpi__delta');
  });

  it('writes a fall in every change with a true minus, the Pipeline\'s too (round 17: "-2 deals")', () => {
    const { html } = render('2030-10-01');
    const chips = [...html.matchAll(/<span class="sp-kpi__delta[^"]*" title="Change against today">(.*?)<span/g)].map((m) => m[1]);
    expect(chips.some((c) => c.startsWith('−'))).toBe(true);
    for (const c of chips) expect(c).not.toMatch(/^-/);
    expect(chips.join(' ')).toMatch(/−\d+ deals?/);
  });

  it('prospect-safe: the strip is what a prospect can use (Leasing, Rent; Available, Largest block); the withheld figures are not shown at all', () => {
    const open = render(TODAY);
    const { html } = render(TODAY, true);
    expect([...html.matchAll(/data-kpi="([^"]+)"/g)].map((m) => m[1])).toEqual(['status', 'rent', 'find', 'find-largest']);
    // No "Withheld" placeholders: a prospect sees a clean strip, not a list of what is hidden from them.
    expect(html).not.toContain('Withheld');
    expect(html).not.toContain('sp-kpi--static');
    for (const gone of ['Pipeline', 'Expiration', 'Avg term', 'SF-weighted', 'of leased', 'in place']) expect(html, gone).not.toContain(gone);
    for (const r of open.kpis.rentByType) expect(html, r.type).not.toContain(usd(r.avg));
    // Nor do their figures leak through a tooltip or a name.
    expect(html).not.toContain(waltCard(open.kpis.walt));
    expect(html).not.toContain(open.kpis.walt.toFixed(4));
    expect(html).not.toMatch(/\d+ leases?\b|\d+ deals?\b/);
  });

  it('names each figure for the action it stands for, so focus and the checks can find it', () => {
    const { html } = render(TODAY);
    expect([...html.matchAll(/data-kpi="([^"]+)"/g)].map((m) => m[1])).toEqual(['status', 'rent', 'expiry', 'deals', 'find', 'find-largest', 'timeline']);
    expect([...render(TODAY, true).html.matchAll(/data-kpi="([^"]+)"/g)].length).toBe(4);
  });
});

describe('Rent card', () => {
  it("shows the largest lease type's in-place average, every other type in its detail, and switches to the Rent lens", () => {
    const { html, kpis } = render(TODAY);
    const top = kpis.rentByType[0];
    const el = kpiOf(html, 'rent');
    expect(el).toContain(`<span class="sp-kpi__figure">${usd(top.avg)}<span class="sp-kpi__unit"> <!-- -->/SF/yr</span></span>`);
    expect(noteOf(el)).toBe(`${top.type} · in place`);
    expect(attr(el, 'title')).toContain('never blended across types. Click to color the plan by rent.');
    expect(el).toMatch(/^<button type="button" class="sp-kpi sp-kpi--lens" data-kpi="rent"/);
  });

  it('prospect-safe: stays a switch and shows the asking range of the space on offer, no in-place figure', () => {
    const { html, kpis } = render(TODAY, true);
    const top = kpis.askingByType[0];
    const el = kpiOf(html, 'rent');
    expect(el).toMatch(/^<button type="button" class="sp-kpi sp-kpi--lens" data-kpi="rent"[^>]*aria-pressed="false"/);
    expect(el).toContain(`<span class="sp-kpi__figure">${dollars(top.low)}–${dollars(top.high)}<span class="sp-kpi__unit"> <!-- -->/SF/yr</span></span>`);
    // A rate always carries its lease type (format.ts), the asking one too.
    expect(noteOf(el)).toBe(`${top.type} · asking`);
    expect(attr(el, 'title')).toContain(`${top.type} ${dollars(top.low)}–${dollars(top.high)}/SF/yr on ${num(top.sf)} SF`);
    expect(attr(el, 'title')).toContain('Asking rent on the space on offer. Click to color the plan by rent.');
  });

  it('with no rent on record, and with nothing on offer, says so instead of a figure (no NaN)', () => {
    const bare = render(TODAY, false, '', { rentByType: [] });
    expect(kpiOf(bare.html, 'rent')).toContain('<span class="sp-kpi__figure">No rent on record</span>');
    expect(kpiOf(bare.html, 'rent')).toMatch(/^<button/);
    const empty = render(TODAY, true, '', { askingByType: [] });
    expect(kpiOf(empty.html, 'rent')).toContain('<span class="sp-kpi__figure">No asking rents</span>');
    expect(bare.html + empty.html).not.toContain('NaN');
  });
});

describe('KpiStrip on the Map (round 25)', () => {
  it('reads there: the Color-by switches are not buttons, and no detail promises to light the plan', () => {
    const { html } = render(TODAY, false, '?view=map');
    expect(html).not.toContain('<button');
    for (const id of ['status', 'rent', 'expiry', 'deals']) expect(html).toMatch(new RegExp(`<div class="sp-kpi sp-kpi--lens sp-kpi--still" data-kpi="${id}"`));
    expect(html).not.toMatch(/Point at it to see it on the plan/);
    // Off the map the switches are buttons again.
    expect(render(TODAY, false, '?view=stack').html).toMatch(/<button type="button" class="sp-kpi sp-kpi--lens/);
  });

  it('a detail that lights suites is a tab stop on the plan views, so the keyboard lights them too, and only reads on the Map', () => {
    const stops = (qs: string) => [...render(TODAY, false, qs).html.matchAll(/<div class="sp-kpi sp-kpi--detail" data-kpi="([^"]+)"[^>]*>/g)].filter((m) => m[0].includes('tabindex="0"')).map((m) => m[1]);
    expect(stops('?view=stack')).toEqual(['find', 'find-largest']);
    expect(stops('?view=map')).toEqual([]);
  });
});
