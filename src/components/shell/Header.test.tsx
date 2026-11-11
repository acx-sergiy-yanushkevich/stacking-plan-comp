// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NO_HOST, setHost } from '../../lib/host';
import { renderToString } from 'react-dom/server';
import { property, TODAY } from '../../data/mock/property';
import { deriveFloors } from '../../domain/derive';
import { computeKpis } from '../../domain/kpis';
import { findIssues, issueCounts } from '../../domain/issues';
import { pct, usd, usd0 } from '../../domain/format';
import { parseState } from '../../state/planState';
import type { PlanModel } from '../../model/usePlanModel';
import { Header } from './Header';
import { switcherItems } from './switcher';

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

describe('Header with Prospect-safe on and off: the same controls in the same places', () => {
  const actions = (query: string) => {
    const { html } = render(query);
    return html.slice(html.indexOf('class="sp-header__actions"'), html.indexOf('class="sp-header__look"'));
  };
  const text = (html: string) => html.replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]+>/g, '');

  it('the as-of button has one line and the same label, locked or not; why it is locked is its tooltip and description', () => {
    const open = /<div class="sp-header__asof[^"]*">(.*?)<\/button>/.exec(actions(''))![1];
    const locked = /<div class="sp-header__asof[^"]*">(.*?)<\/div>/.exec(actions('?safe=1'))![1];
    const label = (html: string) => text(html.slice(0, html.indexOf('</button>') === -1 ? undefined : html.indexOf('</button>')));
    expect(label(open)).toBe('As of Nov 9, 2026');
    expect(label(locked)).toBe('As of Nov 9, 2026');
    // No second line: the only other thing in the control is the description, which is not drawn.
    const note = /<span id="([^"]+)" class="sp-sr-only">(.*?)<\/span>/.exec(locked)!;
    expect(note[2]).toBe('Fixed to today in prospect-safe. Turn Prospect-safe off to move the date.');
    expect(locked).toContain(`aria-describedby="${note[1]}"`);
    expect(locked).toContain('aria-disabled="true"');
    expect(locked).toContain('title="Fixed to today in prospect-safe. Turn Prospect-safe off to move the date."');
    expect(locked).not.toContain('sp-header__asof-note');
    // A link that asks for another date is still drawn, and labelled, as of today.
    expect(text(/<div class="sp-header__asof[^"]*">(.*?)<\/button>/.exec(actions('?safe=1&asOf=2028-01-01'))![1])).toBe('As of Nov 9, 2026');
  });

  it('the slot is empty, or holds the chip that says prospect-safe is on; Data issues is not in the header', () => {
    const slot = (query: string) => /<div class="sp-header__slot">(.*?)<\/div>/.exec(actions(query))?.[1] ?? 'MISSING';
    expect(slot('')).toBe('');
    expect(text(slot('?safe=1'))).toBe('Prospect-safe on');
    for (const q of ['', '?safe=1', '?skin=classic', '?skin=aurora']) {
      expect(render(q).html, q).not.toContain('Data issues');
      expect(render(q).html, q).not.toContain('sp-header__stale');
    }
    // The chip is in the slot and nowhere else: the title row is the same with the mode on and off.
    const title = (query: string) => { const { html } = render(query); return text(html.slice(html.indexOf('class="sp-header__title"'), html.indexOf('class="sp-header__facts"'))); };
    expect(title('?safe=1')).toBe(title(''));
    expect(render('?safe=1').html.match(/Prospect-safe on/g)).toHaveLength(1);
  });

  it('the switch keeps the width of its bold label whether it is on or off', () => {
    for (const query of ['', '?safe=1']) {
      const sw = /<button type="button" role="switch"[^>]*>(.*?)<\/button>/.exec(actions(query))![1];
      expect(sw, query).toContain('<span class="sp-switch__label"><span>Prospect-safe</span><span class="sp-switch__label-hold" aria-hidden="true">Prospect-safe</span></span>');
    }
    expect(actions('?safe=1')).toMatch(/role="switch" aria-checked="true"/);
    expect(actions('')).toMatch(/role="switch" aria-checked="false"/);
  });
});

describe('Header palette control', () => {
  const look = (query: string) => /<div class="sp-header__look">(.*?)<\/div><\/header>/.exec(render(query).html)?.[1] ?? null;

  it('is an icon button that opens the Colors menu, before the theme switch', () => {
    const l = look('')!;
    expect(l).toMatch(/<button(?=[^>]*aria-label="Colors")(?=[^>]*aria-haspopup="menu")/);
    expect(l).not.toContain('role="radiogroup"');
    expect(l.indexOf('aria-label="Colors"')).toBeLessThan(l.indexOf('theme"'));
  });

  it('is not offered by the skins that have no palette; the embedded skin has no look controls at all', () => {
    expect(look('?skin=aurora')).not.toContain('aria-label="Colors"');
    expect(look('?skin=aurora')).toMatch(/theme"/);
    expect(look('?skin=classic')).toBeNull();
  });
});

describe('Header on a phone: the palette and the theme are a menu, not a row of their own', () => {
  /** Render with the media queries of a window `width` px wide. */
  const at = (width: number, query = '') => {
    const matches = (q: string) => (/max-width: (\d+)px/.test(q) ? width <= Number(/max-width: (\d+)px/.exec(q)![1]) : false);
    const before = setHost({ ...NO_HOST, media: (q) => ({ matches: () => matches(q), onChange: () => () => {} }) });
    try {
      return render(query).html;
    } finally {
      setHost(before);
    }
  };

  it('760 px and under: one menu button beside Export, and no look controls in the header', () => {
    for (const width of [320, 390, 760]) {
      const html = at(width);
      expect(html, `${width}`).not.toContain('class="sp-header__look"');
      expect(html, `${width}`).not.toContain('aria-label="Colors"');
      const menu = /<button[^>]*aria-label="Colors and theme"[^>]*>/.exec(html)?.[0] ?? '';
      expect(menu, `${width}`).toContain('aria-haspopup="menu"');
      // It follows Export: the same row of controls.
      expect(html.indexOf('olors and theme"')).toBeGreaterThan(html.indexOf('>Export<'));
    }
  });

  it('wider than 760 px: the palette and the theme button stand in the header as before, and there is no menu button', () => {
    for (const width of [761, 1024, 1440]) {
      const html = at(width);
      expect(html, `${width}`).toContain('class="sp-header__look"');
      expect(html, `${width}`).toContain('aria-label="Colors"');
      expect(html, `${width}`).toMatch(/aria-label="Switch to (light|dark) theme"/);
      expect(html, `${width}`).not.toContain('aria-label="Colors and theme"');
    }
  });

  it('the embedded skin has neither: its host page sets the theme', () => {
    expect(at(390, '?skin=classic')).not.toContain('olors and theme');
    expect(at(760, '?skin=classic')).not.toContain('aria-label="Colors and theme"');
    expect(at(1440, '?skin=classic')).not.toContain('class="sp-header__look"');
  });
});

describe('Header product bar and building card', () => {
  const bar = (query: string) => /<div class="sp-card sp-topbar sp-no-print">(.*?)<\/div><header/.exec(render(query).html)?.[1] ?? null;
  const strip = (html: string) => html.replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  it('standalone: the bar carries the lockup, the switcher, the controls and the look, in that order', () => {
    const b = bar('')!;
    for (const [a, c] of [['sp-lockup', 'sp-switcher__name'], ['sp-switcher__name', 'sp-header__actions'], ['sp-header__actions', 'sp-header__look']])
      expect(b.indexOf(a), `${a} before ${c}`).toBeLessThan(b.indexOf(c));
    expect(strip(b)).toMatch(/^Stax by Ascendix Preston Park Financial Center/);
    // The accessible name keeps the visible text (WCAG 2.5.3): a screen reader hears which building is open.
    expect(b).toMatch(/<button(?=[^>]*aria-label="Switch building: Preston Park Financial Center")(?=[^>]*aria-haspopup="menu")/);
    // The switcher is the building's name and a chevron: no photo, no icon before the name.
    expect(b).not.toContain('<img');
    const sw = /<button[^>]*aria-label="Switch building: [^"]*"[^>]*>(.*?)<\/button>/.exec(b)![1];
    expect(sw.indexOf('<svg')).toBeGreaterThan(sw.indexOf('sp-switcher__name'));
  });

  it('standalone: the card is the icon, the name and the facts; the controls are not in it', () => {
    const { html } = render('');
    const card = html.slice(html.indexOf('<header'));
    expect(card).toContain('class="sp-header__icon"');
    expect(card).not.toContain('<img');
    expect(card).not.toContain('sp-header__actions');
    expect(strip(card.slice(card.indexOf('<div class="sp-header__title"'), card.indexOf('<div class="sp-header__facts"')))).toBe('Preston Park Financial Center');
  });

  it('aurora gets the bar too; the embedded skin gets none of it', () => {
    expect(bar('?skin=aurora')).toContain('sp-lockup');
    expect(bar('?skin=classic')).toBeNull();
    const classic = render('?skin=classic').html;
    for (const s of ['sp-lockup', 'Stax', '<img', 'Switch building']) expect(classic, s).not.toContain(s);
    expect(classic).toContain('class="sp-header__icon"');
    expect(classic).toContain('sp-header__actions');
  });

  it('the switcher menu lists the live building checked and five disabled sample entries', () => {
    // Menu renders its items only when open: test the items through the helper the header builds them with.
    const items = switcherItems(property);
    const labels = items.filter((i) => !('kind' in i) || i.kind === 'item').map((i) => (i as { label: string }).label);
    expect(labels[0]).toBe('Preston Park Financial Center');
    expect(labels.slice(1, 6)).toEqual(['Legacy West Tower II', 'Galleria Commerce Plaza', 'Trinity Riverfront Offices', 'Cedar Springs Exchange', 'Las Colinas Gateway']);
    expect(items[1]).toMatchObject({ checked: true });
    for (const i of items.slice(2, 7)) expect(i).toMatchObject({ disabled: true });
  });
});

describe('Header at 420 px and under: the title and one row of controls (round 17)', () => {
  const at = (width: number, query = '') => {
    const matches = (q: string) => (/max-width: (\d+)px/.test(q) ? width <= Number(/max-width: (\d+)px/.exec(q)![1]) : false);
    const before = setHost({ ...NO_HOST, media: (q) => ({ matches: () => matches(q), onChange: () => () => {} }) });
    try {
      return render(query).html;
    } finally {
      setHost(before);
    }
  };
  const actions = (html: string) => html.slice(html.indexOf('class="sp-header__actions"'));
  const drawn = (html: string) => html.replace(/<span class="sp-sr-only">.*?<\/span>/g, '').replace(/<span[^>]*aria-hidden="true"[^>]*>[^<]*<\/span>/g, '').replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]+>/g, '');
  const read = (html: string) => html.replace(/<span[^>]*aria-hidden="true"[^>]*>.*?<\/span><\/span>/g, '').replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]+>/g, '');
  const asOf = (html: string) => /<div class="sp-header__asof[^"]*">.*?(<button.*?<\/button>)/.exec(actions(html))![1];
  const sw = (html: string) => /<button type="button" role="switch".*?<\/button>/.exec(actions(html))![0];

  it('the date is an icon and the date, its accessible name still "As of Nov 9, 2026", locked or not', () => {
    for (const width of [360, 390, 420])
      for (const query of ['', '?safe=1']) {
        const button = asOf(at(width, query));
        expect(drawn(button), `${width}${query}`).toBe('Nov 9, 2026');
        expect(read(button), `${width}${query}`).toBe('As of Nov 9, 2026');
        // One icon either way, so the button is the same width: the calendar, or the lock in its place.
        expect(button.match(/<svg/g), `${width}${query}`).toHaveLength(1);
      }
    expect(drawn(asOf(at(421)))).toBe('As of Nov 9, 2026');
  });

  it('the switch draws "Safe" and is read as "Prospect-safe", at the width of its bold word on and off', () => {
    for (const query of ['', '?safe=1']) {
      const html = sw(at(390, query));
      expect(html).toContain('<span class="sp-sr-only">Prospect-safe</span>');
      expect(html).toContain('<span class="sp-switch__label" aria-hidden="true"><span>Safe</span><span class="sp-switch__label-hold">Safe</span></span>');
    }
  });

  it('no slot and no Data issues; Export keeps its word without a chevron; the same controls with prospect-safe on and off', () => {
    const own = at(390);
    const safe = at(390, '?safe=1');
    for (const html of [own, safe]) {
      expect(html).not.toContain('class="sp-header__slot"');
      expect(html).not.toContain('Data issues');
      expect(html).toContain('aria-label="Colors and theme"');
      expect(html).toContain('<span class="sp-header__export-label">Export</span>');
    }
    // The same controls in the same order with the mode on and off: the date, the switch, Export, the menu.
    const order = (html: string) => [...actions(html).matchAll(/<button[^>]*>/g)].map(([tag]) => (tag.includes('role="switch"') ? 'switch' : tag.includes('aria-haspopup="menu"') && tag.includes('aria-label=') ? 'menu' : 'button'));
    expect(order(own)).toEqual(order(safe));
    expect(order(own)).toEqual(['button', 'switch', 'button', 'menu']);
  });

  it('from 421 px the slot is back, and the menu holds only the colors and the theme', () => {
    const html = at(421);
    expect(html).toContain('class="sp-header__slot"');
    expect(html).toContain('aria-label="Colors and theme"');
  });
});
