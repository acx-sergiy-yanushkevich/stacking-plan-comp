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
