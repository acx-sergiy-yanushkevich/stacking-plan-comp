// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors } from '../../domain/derive';
import { computeKpis } from '../../domain/kpis';
import { findIssues, issueCounts } from '../../domain/issues';
import { pct, usd, usd0 } from '../../domain/format';
import { parseState } from '../../state/planState';
import type { PlanModel } from '../../model/usePlanModel';
import { Header } from './Header';

function render(query: string) {
  const floors = deriveFloors(property, TODAY, TODAY);
  const kpis = computeKpis(property, floors, TODAY);
  const issues = findIssues(property, floors, TODAY);
  const model = { property, kpis, issues, counts: issueCounts(issues), today: TODAY } as unknown as PlanModel;
  const html = renderToString(<Header model={model} state={parseState(query, TODAY)} patch={() => {}} onExport={() => {}} />);
  // The sale fact alone: the span that carries it on the facts row.
  const sale = /<span class="sp-header__sale"[^>]*>(.*?)<\/span>(?=<span class="sp-header__verified)/.exec(html)?.[1] ?? '';
  return { html, sale, kpis };
}

const listing = property.saleListing!;

describe('Header sale listing', () => {
  it('keeps every figure on the facts row: price, $/RSF and cap rate', () => {
    const { html, sale, kpis } = render('');
    expect(sale).toContain('For sale');
    expect(sale).toContain(usd0(listing.price));
    expect(sale).toContain(`${usd(listing.price / kpis.leasable)}`);
    expect(sale).toContain('/RSF');
    if (listing.capRate !== null) expect(sale).toContain(`${pct(listing.capRate)} cap`);
    // It is one of the facts, not part of the title.
    const facts = html.slice(html.indexOf('class="sp-header__facts"'));
    expect(facts).toContain('class="sp-header__sale"');
    expect(html.slice(html.indexOf('class="sp-header__title"'), html.indexOf('class="sp-header__facts"'))).not.toContain(usd0(listing.price));
  });

  it('shows only "Listed for sale" in prospect-safe mode: no price, $/RSF, cap rate or broker', () => {
    const { html, sale, kpis } = render('?safe=1');
    expect(sale.replace(/<svg.*?<\/svg>/, '').replace(/<!--.*?-->/g, '').trim()).toBe('Listed for sale');
    expect(html).not.toContain(usd0(listing.price));
    expect(html).not.toContain(usd(listing.price / kpis.leasable));
    expect(html).not.toContain(' cap');
    expect(html).not.toContain(listing.broker);
    expect(html).not.toContain('Data issues');
  });
});

describe('Header palette control', () => {
  /** The palette radiogroup and its options, as [name, checked] pairs. */
  const palette = (query: string) => {
    const { html } = render(query);
    const group = /<div role="radiogroup" aria-label="Colour palette"[^>]*>(.*?)<\/div>/.exec(html)?.[1];
    if (group === undefined) return null;
    return [...group.matchAll(/<button[^>]*role="radio"[^>]*aria-checked="(true|false)"[^>]*tabindex="(-?\d)"[^>]*>(.*?)<\/button>/g)].map((m) => ({
      name: /<span class="sp-segmented__label">(.*?)<\/span>/.exec(m[3])?.[1],
      checked: m[1] === 'true',
      tabbable: m[2] === '0',
    }));
  };

  it('offers the two palettes by name, the company colours selected by default', () => {
    expect(palette('')).toEqual([
      { name: 'Ascendix', checked: true, tabbable: true },
      { name: 'Vice City', checked: false, tabbable: false },
    ]);
  });

  it('shows Vice City selected when the URL names it, in either theme', () => {
    for (const q of ['?palette=vice', '?palette=vice&theme=light'])
      expect(palette(q)).toEqual([
        { name: 'Ascendix', checked: false, tabbable: false },
        { name: 'Vice City', checked: true, tabbable: true },
      ]);
  });

  it('stands beside the theme switch, and is not offered by the skins that have no palette', () => {
    const { html } = render('');
    const look = /<div class="sp-header__look">(.*?)<\/div><\/header>/.exec(html)?.[1] ?? '';
    expect(look).toContain('aria-label="Colour palette"');
    expect(look).toContain('aria-label="Switch to light theme"');
    expect(look.indexOf('Colour palette')).toBeLessThan(look.indexOf('Switch to light theme'));
    // The original blue glass keeps the theme switch alone; the embedded skin has neither.
    expect(palette('?skin=aurora')).toBeNull();
    expect(render('?skin=aurora').html).toContain('sp-header__look');
    expect(palette('?skin=classic&palette=vice')).toBeNull();
    expect(render('?skin=classic').html).not.toContain('sp-header__look');
  });
});
