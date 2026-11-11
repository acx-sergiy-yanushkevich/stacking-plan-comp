// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TODAY } from '../../data/mock/property';
import { LENSES } from '../../domain/lenses';
import { canUseLens } from '../../domain/safe';
import { parseState } from '../../state/planState';
import { Toolbar } from './Toolbar';
import { SEARCH_HINTS, hintThatFits, prospectFirst } from './toolbarRules';

const render = (query: string) => renderToString(<Toolbar state={parseState(query, TODAY)} patch={() => {}} issueCount={8} />).replace(/<!-- -->/g, '');
const text = (html: string) => html.replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
/** The controls of a group in order: each button's label, and "(slot)" for a kept, empty place. */
const tools = (html: string) => {
  const group = html.slice(html.indexOf('class="sp-toolbar__find"'));
  return [...group.matchAll(/<(button|span) [^>]*class="sp-btn [^"]*"[^>]*>(.*?)<\/\1>/g)].map((m) => (m[0].includes('sp-toolbar__slot') ? '(slot)' : m[2].replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]+>/g, '')));
};
const lensTabs = (html: string) => {
  const group = html.slice(html.indexOf('aria-label="Color lens"'), html.indexOf('class="sp-toolbar__lens-select"'));
  return [...group.matchAll(/role="radio"[^>]*>([^<]*)</g)].map((m) => m[1]);
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
  for (const view of ['building', 'stack', 'timeline', 'map']) {
    it(`${view}: the lens tabs of prospect-safe are the first tabs of the full control`, () => {
      const normal = lensTabs(render(`?view=${view}`));
      const safe = lensTabs(render(`?view=${view}&safe=1`));
      expect(normal).toEqual(['Occupancy', 'Rent', 'Expiration', 'Pipeline']);
      expect(safe).toEqual(['Occupancy', 'Rent']);
    });

    it(`${view}: the tool buttons keep their order, and Worklist and Data issues leave empty places behind, last`, () => {
      const normal = tools(render(`?view=${view}`));
      const safe = tools(render(`?view=${view}&safe=1`));
      // Area is offered in every view, not the Map alone: the team review found it too hidden there.
      // Data issues is in the toolbar in every view (round 19: the header button had gone, and with it the
      // only way to the panel on a tablet or phone).
      expect(normal).toEqual(['Find space', 'Area', 'Worklist', 'Data issues8']);
      expect(safe).toEqual(normal.map((label) => (label === 'Worklist' || label.startsWith('Data issues') ? '(slot)' : label)));
    });
  }

  it('the kept place says nothing and can be neither read, focused nor pressed', () => {
    const html = render('?view=stack&safe=1');
    const slot = /<span [^>]*class="sp-btn[^"]*sp-toolbar__slot"[^>]*>.*?<\/span><\/span>/.exec(html)?.[0] ?? '';
    expect(slot).toContain('aria-hidden="true"');
    expect(slot).not.toMatch(/<button|tabindex|title=|aria-label=|role=/);
    // No text of its own: the word that sizes it comes from CSS, so it is not in the page's text.
    expect(text(slot).replace(/\|/g, '')).toBe('');
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
    expect(hintThatFits(SEARCH_HINTS.owner, 400, widthOf)).toBe('Find tenant, suite or prospect');
    expect(hintThatFits(SEARCH_HINTS.owner, 170, widthOf)).toBe('Tenant, suite or prospect');
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

  it('prospect-safe placeholders name no tenant or prospect', () => {
    for (const hint of SEARCH_HINTS.safe) expect(hint).not.toMatch(/tenant|prospect/i);
  });
});
