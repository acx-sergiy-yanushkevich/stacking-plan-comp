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
import type { Property } from '../../domain/types';
import { cedarSprings } from '../../data/mock/buildings/cedarSprings';
import { legacyWest } from '../../data/mock/buildings/legacyWest';
import { Header } from './Header';
import { switcherItems } from './switcher';

function render(query: string, building: Property = property) {
  const floors = deriveFloors(building, TODAY, TODAY);
  const kpis = computeKpis(building, floors, TODAY);
  const issues = findIssues(building, floors, TODAY);
  const model = { property: building, kpis, issues, counts: issueCounts(issues), today: TODAY } as unknown as PlanModel;
  const html = renderToString(<Header model={model} state={parseState(query, TODAY)} patch={() => {}} onExport={() => {}} />);
  // The sale fact alone: the span that carries it on the facts row.
  // The facts row ends with it in the product skins; "Latest change" follows it in the embedded one.
  const sale = /<span class="sp-header__sale"[^>]*>(.*?)<\/span>(?=<span class="sp-header__verified|<\/div>)/.exec(html)?.[1] ?? '';
  return { html, sale, kpis };
}

const listing = property.saleListing!;
/** The words of an HTML fragment, as read. */
const words = (html: string) => html.replace(/<svg.*?<\/svg>/g, '').replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

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
    // Plain words like its neighbours: no $ icon in front of it (Clara, Nov 12).
    expect(/<span class="sp-header__sale"[^>]*>(.*?)<span class="sp-header__verified/.exec(html)?.[1] ?? '').not.toContain('<svg');
    expect(html.slice(html.indexOf('class="sp-header__title"'), html.indexOf('class="sp-header__facts"'))).not.toContain(usd0(listing.price));
  });

  it('leads the facts with the address, then the class (team review, Nov 13)', () => {
    const { html } = render('');
    // renderToString marks text boundaries with "<!-- -->": strip them so the address reads whole.
    const facts = html.slice(html.indexOf('class="sp-header__facts"')).replace(/<!-- -->/g, '');
    const address = facts.indexOf(`${property.street}, ${property.city}, ${property.state}`);
    const klass = facts.indexOf(property.propertyClass);
    expect(address).toBeGreaterThan(-1);
    expect(klass).toBeGreaterThan(-1);
    expect(address).toBeLessThan(klass);
  });

  it('shows only "Listed for sale" in prospect-safe mode: no price, $/RSF, cap rate or broker', () => {
    const { html, sale, kpis } = render('?safe=1');
    expect(words(sale)).toBe('Listed for sale');
    expect(html).not.toContain(usd0(listing.price));
    expect(html).not.toContain(usd(listing.price / kpis.leasable));
    expect(html).not.toContain(' cap');
    expect(html).not.toContain(listing.broker);
    expect(html).not.toContain('Data issues');
  });
});

describe('Header sale listing under contract (round 23: Cedar Springs read "For sale")', () => {
  const contract = cedarSprings.saleListing!;

  it('the owner reads the status first, then what it was listed at, $/RSF and cap rate', () => {
    expect(contract.status).toBe('Under Contract');
    const { sale } = render('?building=P005', cedarSprings);
    expect(words(sale)).toBe('Under contract · listed at $92,000,000 · $504.94/RSF · 5.8% cap');
    expect(words(sale)).not.toMatch(/for sale/i);
  });

  it('a prospect reads "Under contract" alone: no price, $/RSF, cap rate or broker', () => {
    const { html, sale } = render('?building=P005&safe=1', cedarSprings);
    expect(words(sale)).toBe('Under contract');
    expect(html).not.toContain(usd0(contract.price));
    expect(html).not.toContain('/RSF');
    expect(html).not.toContain(' cap');
    expect(html).not.toContain(contract.broker);
    expect(html).not.toMatch(/Listed for sale/);
  });
});

describe('Header facts row: "Latest change" always wraps with the fact before it (round 23)', () => {
  const tail = (html: string) => /<span class="sp-header__tail">(.*?)<\/span><\/div>/.exec(html)?.[1] ?? '';

  it('with no sale listing, the floor count and Latest change are one group', () => {
    const { html } = render('?building=P002', legacyWest);
    expect(legacyWest.saleListing).toBeNull();
    expect(words(tail(html))).toMatch(/^22 floors ✓? ?Latest change /);
    expect(tail(html)).toContain('sp-header__verified');
  });

  it('with a listing, the listing and Latest change are the group and the floor count stays outside it', () => {
    const { html } = render('');
    expect(words(tail(html))).toMatch(/^For sale .* Latest change /);
    expect(words(tail(html))).not.toContain('floors');
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

  it('embedded: the slot is empty, or holds the chip that says prospect-safe is on; Data issues is not in the header', () => {
    const slot = (query: string) => /<div class="sp-header__slot">(.*?)<\/div>/.exec(actions(query))?.[1] ?? 'MISSING';
    expect(slot('?skin=classic')).toBe('');
    expect(text(slot('?skin=classic&safe=1'))).toBe('Prospect-safe on');
    // The product bar has no slot: the pressed Prospect-safe button is what says the mode is on.
    expect(slot('')).toBe('MISSING');
    expect(slot('?safe=1')).toBe('MISSING');
    for (const q of ['', '?safe=1', '?skin=classic', '?skin=aurora']) {
      expect(render(q).html, q).not.toContain('Data issues');
      expect(render(q).html, q).not.toContain('sp-header__stale');
    }
    // The chip is in the slot and nowhere else: the title row is the same with the mode on and off.
    // The title's line, without the freshness chip beside it (which tells the owner more than a prospect).
    const title = (query: string) => { const { html } = render(query); return text(html.slice(html.indexOf('class="sp-header__title"'), html.indexOf('class="sp-header__facts"')).replace(/<div class="sp-header__aside">.*?<\/div>/, '')); };
    expect(title('?safe=1')).toBe(title(''));
    expect(render('?skin=classic&safe=1').html.match(/Prospect-safe on/g)).toHaveLength(1);
  });

  it('embedded: the switch keeps the width of its bold label whether it is on or off', () => {
    for (const query of ['?skin=classic', '?skin=classic&safe=1']) {
      const sw = /<button type="button" role="switch"[^>]*>(.*?)<\/button>/.exec(actions(query))![1];
      expect(sw, query).toContain('<span class="sp-switch__label"><span>Prospect-safe</span><span class="sp-switch__label-hold" aria-hidden="true">Prospect-safe</span></span>');
    }
  });

  it('product bar: Prospect-safe is a text button with the half-filled circle, still a switch, the same label on and off', () => {
    for (const [query, on] of [['', 'false'], ['?safe=1', 'true']]) {
      const tag = /<button type="button" role="switch"[^>]*>/.exec(actions(query))![0];
      expect(tag, query).toContain(`aria-checked="${on}"`);
      expect(tag, query).toContain('class="sp-btn sp-btn--neutral sp-safe"');
      const sw = /<button type="button" role="switch"[^>]*>(.*?)<\/button>/.exec(actions(query))![1];
      expect(text(sw), query).toBe('Prospect-safe');
      expect(sw.match(/<svg/g), query).toHaveLength(1);
    }
  });

  it('product bar: the as-of and Export buttons are words and a caret, no calendar or download icon', () => {
    for (const query of ['', '?safe=1']) {
      const asOf = /<div class="sp-header__asof[^"]*">.*?(<button.*?<\/button>)/.exec(actions(query))![1];
      expect(asOf.match(/<svg/g), query).toHaveLength(1);
      expect(asOf.indexOf('<svg'), query).toBeGreaterThan(asOf.indexOf('Nov 9, 2026'));
    }
    const exp = /<button[^>]*>(?:(?!<\/button>).)*?sp-header__export-label.*?<\/button>/.exec(actions(''))![0];
    expect(exp.match(/<svg/g)).toHaveLength(1);
    expect(exp.indexOf('<svg')).toBeGreaterThan(exp.indexOf('>Export<'));
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

  it('421 to 760 px: one menu button beside Export, and no look controls in the header', () => {
    for (const width of [421, 600, 760]) {
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
  const bar = (query: string) => /<section class="sp-card sp-topbar sp-no-print"[^>]*>(.*?)<\/section><header/.exec(render(query).html)?.[1] ?? null;
  const strip = (html: string) => html.replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  it('standalone: the bar carries the lockup, then the controls and the look; the building is named once, in the card', () => {
    const b = bar('')!;
    for (const [a, c] of [['sp-lockup', 'sp-header__actions'], ['sp-header__actions', 'sp-header__look']])
      expect(b.indexOf(a), `${a} before ${c}`).toBeLessThan(b.indexOf(c));
    expect(strip(b)).toMatch(/^Stax by Ascendix /);
    // No switcher, no divider, no building name in the bar (Clara, Nov 12: the name twice and three icons in a corner).
    for (const s of ['Preston Park', 'Switch building', 'sp-switcher', 'sp-topbar__divider', 'sp-ministack']) expect(b, s).not.toContain(s);
    // The controls and the look are one group, so they wrap together.
    expect(b.indexOf('sp-topbar__controls')).toBeLessThan(b.indexOf('sp-header__actions'));
  });

  it('standalone: the card is the building\'s mini stack, its name as the switcher, and the facts; the controls are not in it', () => {
    const { html } = render('');
    const card = html.slice(html.indexOf('<header'));
    // The logo is a little bigger than the building's icon: 32 px against 28 (Clara, Nov 12: both were too big at 40).
    expect(html).toMatch(/<span class="sp-mark" style="width:32px;height:32px"[^>]*><svg width="32" height="32"/);
    expect(card).toMatch(/<svg class="sp-ministack" width="28" height="28"/);
    // The building's own mini stack stands where the blue icon box was.
    expect(card).not.toContain('class="sp-header__icon"');
    expect(card.indexOf('class="sp-ministack"')).toBeGreaterThan(-1);
    expect(card.indexOf('class="sp-ministack"')).toBeLessThan(card.indexOf('sp-header__title'));
    expect(card).not.toContain('<img');
    expect(card).not.toContain('sp-header__actions');
    // The title is the page's one heading, and the name in it is the switcher: a button that opens the building menu.
    expect(card).toMatch(/<div class="sp-header__title" role="heading" aria-level="1">/);
    expect(card).toMatch(/<button(?=[^>]*aria-label="Switch building: Preston Park Financial Center")(?=[^>]*aria-haspopup="menu")(?=[^>]*class="[^"]*sp-switcher)/);
    const sw = /<button[^>]*aria-label="Switch building: [^"]*"[^>]*>(.*?)<\/button>/.exec(card)![1];
    expect(strip(sw)).toBe('Preston Park Financial Center');
    // A caret after the name says it opens.
    expect(sw.lastIndexOf('<svg')).toBeGreaterThan(sw.indexOf('sp-switcher__name'));
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

  it('the switcher menu lists the buildings with data, the open one checked, then every sample entry disabled, each with its own mini stack', () => {
    // Menu renders its items only when open: test the items through the helper the header builds them with.
    const opened: string[] = [];
    const items = switcherItems(property, (id) => opened.push(id));
    const rows = items.filter((i) => !('kind' in i) || i.kind === 'item') as Array<{ id: string; label: string; adornment?: unknown; disabled?: boolean; checked?: boolean; onSelect: () => void }>;
    expect(items[0]).toMatchObject({ kind: 'heading', label: 'Portfolio · 10 buildings' });
    expect(rows).toHaveLength(10);
    expect(rows[0]).toMatchObject({ label: 'Preston Park Financial Center', checked: true });
    expect(rows.slice(1, 4).map((r) => r.label)).toEqual(['Legacy West Tower II', 'Cedar Springs Exchange', 'Bluebonnet Office Park']);
    for (const r of rows.slice(1, 4)) expect(r).toMatchObject({ checked: false });
    for (const r of rows.slice(4)) expect(r).toMatchObject({ disabled: true });
    for (const r of rows) expect(r.adornment, r.label).toBeTruthy();
    expect(items.at(-1)).toMatchObject({ kind: 'heading', label: 'Sample entries · only the first 4 open' });
    // Selecting another building with data opens it; the open one opens nothing.
    rows[0].onSelect();
    rows[2].onSelect();
    expect(opened).toEqual(['P005']);
    // Each mini stack is drawn: four floors, one suite open in orange, in the building's own tone.
    const html = renderToString(<>{rows.map((r, i) => <span key={i}>{r.adornment as never}</span>)}</>);
    expect(html.match(/class="sp-ministack"/g)).toHaveLength(10);
    expect(html.match(/fill="#ff9c00"/g)).toHaveLength(10);
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
  // The controls, up to the end of the bar: the building switcher in the card under it is not one of them.
  const actions = (html: string) => {
    const from = html.indexOf('class="sp-header__actions"');
    const end = html.indexOf('</section>', from);
    return html.slice(from, end < 0 ? undefined : end);
  };
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

  it('the switch draws "Safe" and is read as "Prospect-safe", on and off', () => {
    for (const query of ['', '?safe=1']) {
      const html = sw(at(390, query));
      expect(html).toContain('<span class="sp-sr-only">Prospect-safe</span>');
      expect(html).toContain('<span class="sp-safe__word" aria-hidden="true">Safe</span>');
    }
    // Embedded: the switch keeps the width of its bold word.
    expect(sw(at(390, '?skin=classic'))).toContain('<span class="sp-switch__label" aria-hidden="true"><span>Safe</span><span class="sp-switch__label-hold">Safe</span></span>');
  });

  it('no slot and no Data issues; Export is in the menu; the same controls with prospect-safe on and off', () => {
    const own = at(390);
    const safe = at(390, '?safe=1');
    for (const html of [own, safe]) {
      expect(html).not.toContain('class="sp-header__slot"');
      expect(html).not.toContain('Data issues');
      // Export is in the "…" menu, with the colors and the theme (round 19: the bar is one row).
      expect(html).toContain('aria-label="Export, colors and theme"');
      expect(html).not.toContain('<span class="sp-header__export-label">Export</span>');
    }
    // The same controls in the same order with the mode on and off: the date, the switch, the menu.
    const order = (html: string) => [...actions(html).matchAll(/<button[^>]*>/g)].map(([tag]) => (tag.includes('role="switch"') ? 'switch' : tag.includes('aria-haspopup="menu"') && tag.includes('aria-label=') ? 'menu' : 'button'));
    expect(order(own)).toEqual(order(safe));
    expect(order(own)).toEqual(['button', 'switch', 'menu']);
  });

  it('from 421 px the embedded slot is back, and the menu holds only the colors and the theme', () => {
    expect(at(421, '?skin=classic')).toContain('class="sp-header__slot"');
    const html = at(421);
    expect(html).toContain('aria-label="Colors and theme"');
  });
});

describe('Header building card: the facts, then when the plan last changed at the right (round 19)', () => {
  it('"Latest change" is the last fact on the facts line, after the same separator as the others, in every skin', () => {
    for (const q of ['', '?skin=classic', '?safe=1']) {
      const html = render(q).html.replace(/<!-- -->/g, '');
      const facts = /<div class="sp-header__facts">(.*?)<\/div>/.exec(html.slice(html.indexOf('<header')))![1];
      // The facts are spans side by side; the last one is when the plan last changed.
      const spans = [...facts.matchAll(/<span class="(sp-header__[a-z-]+[^"]*)?"?[^>]*>/g)];
      // Round 23: the listing and the latest change sit in one tail that wraps whole.
      expect(facts, q).toMatch(/<span class="sp-header__verified"[^>]*>.*Latest change Nov 6, 2026<\/span><\/span>$/);
      expect(html, q).not.toContain('sp-header__aside');
      expect(spans.length, q).toBeGreaterThan(3);
    }
  });

});

describe('Header freshness: one quiet line, no warning on the card', () => {
  it('says when the plan last changed, in the same quiet tone for owner and prospect; unverified records are listed under Data issues', () => {
    for (const q of ['', '?safe=1']) {
      const html = render(q).html.replace(/<!-- -->/g, '');
      expect(html, q).toContain('Latest change Nov 6, 2026');
      expect(html, q).not.toContain('sp-header__verified--stale');
      expect(html, q).not.toContain('unverified');
    }
  });
});
