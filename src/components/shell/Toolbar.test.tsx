// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NO_HOST, setHost } from '../../lib/host';
import { renderToString } from 'react-dom/server';
import { TODAY } from '../../data/mock/property';
import { LENSES } from '../../domain/lenses';
import { canUseLens } from '../../domain/safe';
import { parseState } from '../../state/planState';
import { Toolbar } from './Toolbar';
import { SEARCH_HINTS, hintThatFits, prospectFirst } from './toolbarRules';

const render = (query: string) => renderToString(<Toolbar state={parseState(query, TODAY)} patch={() => {}} issueCount={8} />).replace(/<!-- -->/g, '');
const text = (html: string) => html.replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
/** The controls of a group in order: each button's label. */
const tools = (html: string) => {
  const group = html.slice(html.indexOf('class="sp-toolbar__find"'));
  return [...group.matchAll(/<(button|span) [^>]*class="sp-btn [^"]*"[^>]*>(.*?)<\/\1>/g)].map((m) => m[2].replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]+>/g, ''));
};
describe('prospectFirst', () => {
  it('puts the lenses a prospect is also offered first, each group in its usual order', () => {
    expect(prospectFirst(LENSES).map((l) => l.id)).toEqual(['status', 'rent', 'expiry', 'deals']);
  });

  it('so that what prospect-safe offers is a prefix of the full list: no lens that stays changes place', () => {
    const all = prospectFirst(LENSES).map((l) => l.id);
    const safe = all.filter((id) => canUseLens(id, true));
    expect(all.slice(0, safe.length)).toEqual(safe);
  });
});

describe('Toolbar with prospect-safe on and off: what stays keeps its place', () => {
  it('offers no lens picker: the KPI strip is the one Color by (team review, Nov 12)', () => {
    for (const view of ['building', 'stack', 'timeline', 'map']) {
      const html = render(`?view=${view}`);
      expect(html, view).not.toContain('Color lens');
      expect(html, view).not.toContain('Color by');
      expect(html, view).not.toContain('sp-toolbar__lens');
    }
  });

  for (const view of ['building', 'stack', 'timeline', 'map']) {

    it(`${view}: the tool buttons keep their order; prospect-safe takes Worklist and Data issues away, last, and keeps no place for them`, () => {
      const normal = tools(render(`?view=${view}`));
      const safe = tools(render(`?view=${view}&safe=1`));
      // Area is offered in every view, not the Map alone: the team review found it too hidden there.
      // Data issues is in the toolbar in every view (round 19: the header button had gone, and with it the
      // only way to the panel on a tablet or phone).
      expect(normal).toEqual(['Find space', 'Area', 'Worklist', 'Data issues8']);
      // The withheld buttons leave no empty place behind: Find space and Area close up to the right edge and the
      // search grows into the room (team review, Nov 13: the kept places read as a gap).
      expect(safe).toEqual(['Find space', 'Area']);
    });
  }

  it('the prospect-safe toolbar holds nothing of the withheld buttons: no placeholder, no word', () => {
    const html = render('?view=stack&safe=1');
    expect(html).not.toContain('sp-toolbar__slot');
    // Nothing in the prospect-safe toolbar reads "Worklist", "Expiration" or "Deals".
    expect(text(html)).not.toMatch(/Worklist|Renewal|Expiration|Deals|issues/i);
    expect(html).not.toMatch(/(title|aria-label)="[^"]*(Worklist|Renewal|Expiration|Deals|issues)/i);
  });
});

describe('Area button', () => {
  const pressed = (query: string) => /<button[^>]*aria-pressed="(true|false)"[^>]*>(?:(?!<\/button>).)*Area<\/button>/.exec(render(query))?.[1];
  it('is pressed while the Area panel is open, and while its location brief is open over it', () => {
    expect(pressed('?view=stack')).toBe('false');
    expect(pressed('?view=stack&mode=area')).toBe('true');
    expect(pressed('?view=stack&mode=brief')).toBe('true');
  });
});

describe('search field name', () => {
  const name = (html: string) => /<label for="[^"]*" class="sp-sr-only">([^<]*)<\/label>/.exec(html.slice(html.indexOf('sp-toolbar__search')))?.[1];
  it('names the search for what it finds: tenants and prospects for the owner, suites and floors for a prospect (round 17)', () => {
    expect(name(render('?view=stack'))).toBe(SEARCH_HINTS.owner[0]);
    expect(name(render('?view=stack&safe=1'))).toBe(SEARCH_HINTS.safe[0]);
  });
});

describe('hintThatFits', () => {
  // 6 px a character, as a stand-in for the field's font.
  const widthOf = (t: string) => t.length * 6;

  it('shows the fullest placeholder that fits the field (round 16: "Find tenant, suite or prospe" was cut on the Map at 1280)', () => {
    expect(hintThatFits(SEARCH_HINTS.owner, 400, widthOf)).toBe('Find tenant, suite, prospect or size (12k SF)');
    expect(hintThatFits(SEARCH_HINTS.owner, 200, widthOf)).toBe('Tenant, suite, prospect or size');
    expect(hintThatFits(SEARCH_HINTS.owner, 170, widthOf)).toBe('Tenant, suite or size');
    expect(hintThatFits(SEARCH_HINTS.owner, 120, widthOf)).toBe('Search the plan');
    expect(hintThatFits(SEARCH_HINTS.owner, 70, widthOf)).toBe('Search');
    expect(hintThatFits(SEARCH_HINTS.safe, 70, widthOf)).toBe('Search');
  });

  it('never returns one wider than the room when a shorter one exists, and the shortest when none fits', () => {
    for (const options of [SEARCH_HINTS.owner, SEARCH_HINTS.safe]) {
      for (let room = 0; room <= 400; room += 7) {
        const hint = hintThatFits(options, room, widthOf);
        const shortest = options[options.length - 1];
        expect(widthOf(hint) <= room || hint === shortest, `${room} px: "${hint}"`).toBe(true);
      }
    }
  });

  it('shows the full one before the field has been measured', () => {
    expect(hintThatFits(SEARCH_HINTS.owner, null, widthOf)).toBe(SEARCH_HINTS.owner[0]);
  });

  it('the fullest placeholders say the box takes a size (round 23)', () => {
    expect(SEARCH_HINTS.owner[0]).toMatch(/size \(12k SF\)/);
    expect(SEARCH_HINTS.safe[0]).toMatch(/size \(12k SF\)/);
  });

  it('prospect-safe placeholders name no tenant or prospect', () => {
    for (const hint of SEARCH_HINTS.safe) expect(hint).not.toMatch(/tenant|prospect/i);
  });
});

describe('Toolbar Data issues label by width', () => {
  /** Render with the media queries of a window `width` px wide. */
  const at = (width: number, query = '') => {
    const matches = (q: string) => (/max-width: (\d+)px/.test(q) ? width <= Number(/max-width: (\d+)px/.exec(q)![1]) : false);
    const before = setHost({ ...NO_HOST, media: (q) => ({ matches: () => matches(q), onChange: () => () => {} }) });
    try {
      return render(query);
    } finally {
      setHost(before);
    }
  };
  const issues = (html: string) => /<button[^>]*title="Data issues: records to fix or verify"[^>]*>(.*?)<\/button>/.exec(html)!;

  it('says "Data issues" wherever it fits, and "Issues" on a phone of 420 px or less, its name starting with the word shown', () => {
    for (const w of [1440, 761, 421]) expect(issues(at(w))[1].replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]+>/g, ''), `${w}`).toMatch(/^Data issues\d*$/);
    for (const w of [420, 320]) {
      const [tag, inner] = issues(at(w));
      expect(inner.replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]+>/g, ''), `${w}`).toMatch(/^Issues\d*$/);
      // WCAG 2.5.3: the name is the words on the button, and the title says what they are (round 22, axe).
      expect(tag, `${w}`).not.toContain('aria-label=');
      expect(tag, `${w}`).toContain('title="Data issues: records to fix or verify"');
    }
  });
});

