// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { FilterBar } from './FilterBar';

describe('FilterBar: a requirement with a date the calendar has not (round 26)', () => {
  it('names the date and offers nothing to run until it is corrected', () => {
    const html = renderToString(<FilterBar label="Find 12,000 SF" find={{ kind: 'size', size: 12000, max: null, fit: 'any', by: null, badBy: '2027-02-30' }} patch={() => {}} />).replace(/<!-- -->/g, '');
    expect(html).toContain('2027-02-30 is not a date on the calendar');
    expect(html).not.toContain('SF of space</button>');
    expect(html).toContain('Clear');
  });
});

describe('FilterBar: a contradictory requirement (round 36)', () => {
  it('names it and offers nothing to run', async () => {
    const { renderToString } = await import('react-dom/server');
    const { FilterBar } = await import('./FilterBar');
    const html = renderToString(<FilterBar label="Find 20,000–15,000 SF" find={{ kind: 'size', size: 20000, max: 15000, fit: 'any', by: null }} patch={() => undefined} />);
    const text = html.replace(/<!-- -->/g, '');
    expect(text).toContain('at least 20,000 SF and at most 15,000 SF, which no space can be');
    expect(html).not.toContain('SF of space</button>');
    expect(html).not.toContain('sp-filterbar__find');
  });
});

describe('FilterBar: nothing matched (round 36)', () => {
  it('shows the sentence as it is, with no "Showing" and no way to the plan, whatever its first word', () => {
    for (const label of ['There is no Floor 99 here (Floors 1–12).', 'Nothing for sale on Floor 5.', 'No available space on Floor 4 now.']) {
      for (const planElsewhere of [false, true]) {
        const html = renderToString(<FilterBar label={label} empty planElsewhere={planElsewhere} patch={() => undefined} />).replace(/<!-- -->/g, '');
        expect(html, label).toContain(label);
        expect(html, label).not.toContain('Showing');
        expect(html, label).not.toContain('Show on the plan');
        expect(html, label).not.toContain('..');
      }
    }
  });
});
