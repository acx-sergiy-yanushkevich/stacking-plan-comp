// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { area } from '../../data/mock/area';
import { property } from '../../data/mock/property';
import type { Area } from '../../domain/types';
import type { PlanModel } from '../../model/usePlanModel';
import { AreaPanel } from './AreaPanel';

const model = { property } as unknown as PlanModel;
const render = (a: Area | null) =>
  renderToString(<AreaPanel model={model} area={a} />)
    .replace(/<!-- -->/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/ /g, ' ');

describe('AreaPanel (charts in the side panel)', () => {
  it('shows skeleton bars until the area arrives', () => {
    const html = render(null);
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('Population');
  });

  it('widened, is the location brief instead of the charts', () => {
    const html = renderToString(<AreaPanel model={model} area={area} expanded />).replace(/<!-- -->/g, '');
    expect(html).toContain('What stands out');
    expect(html).toContain('Figures by distance');
    expect(html).not.toContain('Population by distance');
    expect(html).not.toContain('role="radiogroup"');
  });

  it("narrow, has no button of its own for the brief: the panel's Expand toggle is the way in", () => {
    expect(render(area)).not.toContain('Location brief');
  });

  it('switches between the rings, the closest first', () => {
    const html = render(area);
    const radios = [...html.matchAll(/role="radio" aria-checked="(true|false)"[^>]*>([^<]+)</g)].map((m) => [m[2], m[1]]);
    expect(radios).toEqual([
      ['1 mi', 'true'],
      ['3 mi', 'false'],
      ['5 mi', 'false'],
    ]);
  });

  it('charts the population of every ring, with its households', () => {
    const html = render(area);
    expect(html).toContain('Population by distance');
    for (const figure of ['14,820', '118,600', '329,400', '6,410 households', '47,900 households', '128,700 households']) expect(html, figure).toContain(figure);
  });

  it('compares the chosen ring with the US: a bar for the area, a tick for the US, the figures in text', () => {
    const html = render(area);
    expect(html).toContain('Compared with the US');
    expect(html).toContain('within 1 mile');
    for (const text of ['Median household income', '$98,400', 'US $80,734', '22% above the US', "Bachelor's as highest degree", '37.0%', 'US 21.6%', 'Median age', '36.8', 'US 38.9', 'Mean commute', '24.1 min', 'US 26.4 min']) expect(html, text).toContain(text);
    expect(html).toMatch(/class="sp-area-meter__track" aria-hidden="true"/);
  });

  it('charts the amenities largest first, and lists the transit', () => {
    const html = render(area);
    const amenities = html.slice(html.indexOf('Amenities within'));
    const names = [...amenities.matchAll(/class="sp-brief__bar-name">([^<]+)</g)].map((m) => m[1]);
    expect(names).toEqual(['Restaurants', 'Parking', 'Cafés', 'Banks', 'Fitness', 'Hotels']);
    expect(html).toContain('Preston Rd @ Park Blvd');
  });

  it('flags sample figures and names the sources', () => {
    const html = render(area);
    // Said plainly, in a neutral chip: sample figures are expected in a demo, not a warning.
    expect(html).toMatch(/<span class="sp-chip sp-chip--neutral[^"]*"[^>]*>(?:<svg.*?<\/svg>)?Sample figures<\/span>/);
    expect(html).not.toContain('Sample data');
    expect(html).toContain('US Census Bureau ACS 5-year');
    expect(html).toContain('US figures: US Census Bureau, ACS 5-year 2020–2024');
  });

  it('round 18: names the kind of each stop in words, says the place once, credits sample figures as samples, and shows no developer hint', () => {
    const html = render(area);
    // Bus and rail differ by a word, not only by the drawing; bus no longer borrows the people icon.
    expect(html.match(/<span class="sp-transit-kind">Bus<\/span>/g)?.length).toBeGreaterThan(0);
    expect(html).toContain('<span class="sp-transit-kind">Rail</span>');
    expect(html).not.toContain('aria-label="Bus"');
    expect(html).not.toContain('Plano, TX · rings');
    expect(html).not.toContain('Data: US Census Bureau');
    expect(html).not.toContain('live=1');
    expect(html).not.toContain('within half a mile.</p>');
  });
});

describe('AreaPanel beside the Map (round 25)', () => {
  it('follows the ring chosen on the map instead of offering its own switch, and leads with the map key rows', () => {
    const html = renderToString(<AreaPanel model={model} area={area} onMap />).replace(/<!-- -->/g, '').replace(/\u00a0/g, ' ');
    expect(html).not.toContain('aria-label="Distance compared with the US"');
    expect(html).toContain('within 1 mile, the ring on the map');
    expect(html.indexOf('Nearby transit')).toBeLessThan(html.indexOf('Population by distance'));
    // Beside the plan views, where there is no map, the panel keeps its switch.
    expect(render(area)).toContain('aria-label="Distance compared with the US"');
  });
});

describe('AreaPanel: the ring from the address, and live places by name (round 25)', () => {
  const clean = (html: string) => html.replace(/<!-- -->/g, '').replace(/\u00a0/g, ' ');

  it('compares the ring it is given, and its switch says which', () => {
    const html = clean(renderToString(<AreaPanel model={model} area={area} ring={5} />));
    expect(html).toContain('within 5 miles');
    const radios = [...html.matchAll(/role="radio" aria-checked="(true|false)"[^>]*>([^<]+)</g)].map((m) => [m[2], m[1]]);
    expect(radios).toEqual([
      ['1 mi', 'false'],
      ['3 mi', 'false'],
      ['5 mi', 'true'],
    ]);
  });

  it('names a live category\'s nearest places under its bar and in its name, never a sample one\'s', () => {
    const places = [
      { name: 'Corner Kitchen', category: 'Restaurants', distanceMi: 0.07, lat: 0, lng: 0 },
      { name: 'Noodle House', category: 'Restaurants', distanceMi: 0.3, lat: 0, lng: 0 },
      { name: 'Taqueria Sol', category: 'Restaurants', distanceMi: 0.32, lat: 0, lng: 0 },
      { name: 'Late Grill', category: 'Restaurants', distanceMi: 0.45, lat: 0, lng: 0 },
    ];
    const live: Area = { ...area, sample: false, amenities: [{ category: 'Restaurants', count: 4 }], places };
    const html = clean(renderToString(<AreaPanel model={model} area={live} onMap />));
    expect(html).toContain('<span class="sp-area__names">Corner Kitchen &lt; 0.1 mi · Noodle House 0.3 mi · Taqueria Sol 0.3 mi · 1 more</span>');
    expect(html).toContain('aria-label="Restaurants: 4 within half a mile; the nearest Corner Kitchen, under 0.1 miles; Noodle House, 0.3 miles; Taqueria Sol, 0.3 miles; and 1 more, pinned on the map"');
    expect(clean(renderToString(<AreaPanel model={model} area={area} onMap />))).not.toContain('sp-area__names');
  });
});

