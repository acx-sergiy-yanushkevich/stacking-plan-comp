// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { area } from '../../data/mock/area';
import type { Area } from '../../domain/types';
import { openArea } from '../plan/actions';
import { AreaGlance } from './AreaPreview';

// A figure and its unit are kept on one line with a no-break space; the assertions read it as a space.
const render = (a: Area | null) => renderToString(<AreaGlance area={a} onOpen={() => {}} />).replace(/<!-- -->/g, '').replace(/\u00a0/g, ' ');

describe('AreaGlance: the area around the building, previewed in the Building panel (team review: Area was too hidden)', () => {
  it('shows the closest ring\'s population and median household income, and the nearest transit stop', () => {
    const html = render(area);
    expect(html).toContain('Around the building');
    expect(html).toContain('14,820');
    expect(html).toContain('$98,400');
    // Nearest of the four stops is the bus stop at 0.2 mi, not the first listed (a rail station at 3.1 mi).
    expect(html).toContain('>0.2 mi</span>');
    expect(html).toContain('Nearest bus stop');
    expect(html).toContain('within 1 mi');
    expect(html).toContain('median, 1 mi');
  });

  it('uses the smallest ring whatever order the rings arrive in', () => {
    const html = render({ ...area, rings: [...area.rings].reverse() });
    expect(html).toContain('14,820');
    expect(html).not.toContain('329,400');
  });

  it('offers the full panel', () => {
    expect(render(area)).toContain('See area details');
  });

  it('says when the figures are a sample, and names the live sources when they are not', () => {
    expect(render(area)).toContain('Sample figures');
    const live = render({ ...area, sample: false });
    expect(live).not.toContain('Sample figures');
    expect(live).toContain('US Census Bureau ACS 5-year');
  });

  it('with no stop on record, says so instead of a distance', () => {
    const html = render({ ...area, transit: [] });
    expect(html).toContain('No stops nearby');
    expect(html).not.toMatch(/>\d+\.\d mi</);
  });

  it('before the data arrives, keeps the section and the way in, without figures', () => {
    const html = render(null);
    expect(html).toContain('Around the building');
    expect(html).toContain('See area details');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('14,820');
  });
});

describe('openArea', () => {
  it('opens the Area panel and closes what the other tool panels and a selection had open', () => {
    let next = {};
    openArea((p) => (next = p));
    expect(next).toEqual({ mode: 'area', select: null, floor: null, req: null, max: null, by: null, inquiry: null, window: null });
  });
});
