// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { area } from '../../data/mock/area';
import { property } from '../../data/mock/property';
import { LocationBrief } from './LocationBrief';

const render = (props: Partial<Parameters<typeof LocationBrief>[0]> = {}) =>
  renderToString(<LocationBrief property={property} area={area} {...props} />)
    .replace(/<!-- -->/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/ /g, ' ');

describe('LocationBrief', () => {
  it('names the building and where it is', () => {
    const html = render();
    expect(html).toContain('Location');
    expect(html).toContain(property.name);
    expect(html).toContain(`${property.street}, ${property.city}, ${property.state}`);
  });

  it('leads with the four headline figures', () => {
    const html = render();
    for (const text of ['329,400', 'within 5 miles', '$98,400', '22% above the US', '61.0%', '2.8× the US', '1 mile', '0.2 mi', 'bus stop', 'rail 3.1 mi']) expect(html, text).toContain(text);
  });

  it('keeps every figure with its unit, and never starts or ends a line with a separator', () => {
    const raw = renderToString(<LocationBrief property={property} area={area} />);
    expect(raw).not.toMatch(/\d (miles?|mi|min|minutes|years)\b/);
    expect(raw).toContain('1\u00a0mile');
    // Facts are joined by a space drawn as a dot (DotJoin), never by a "·" character a line could end on.
    expect(raw).not.toContain(' · ');
    expect(raw).toContain('sp-dotjoin__sep');
  });

  it('says what stands out, as sentences', () => {
    const html = render();
    expect(html).toContain('What stands out');
    expect(html).toContain('Median household income of $98,400 within 1 mile, 22% above the US.');
    expect(html).toContain('42 restaurants, 11 parking facilities and 9 cafés within half a mile.');
  });

  it('charts the amenities largest first, each with its count in text', () => {
    const html = render();
    const names = [...html.matchAll(/class="sp-brief__bar-name">([^<]+)</g)].map((m) => m[1]);
    expect(names).toEqual(['Restaurants', 'Parking', 'Cafés', 'Banks', 'Fitness', 'Hotels']);
    // The bar is drawn for the eye only: the figure beside it is the text.
    expect(html).toMatch(/class="sp-brief__bar-track" aria-hidden="true"/);
  });

  it('tables every ring beside the US', () => {
    const html = render();
    expect(html).toContain('Figures by distance');
    expect(html).toMatch(/<th scope="col">1 mi<\/th><th scope="col">3 mi<\/th><th scope="col">5 mi<\/th><th scope="col">US<\/th>/);
    expect(html).toMatch(/<th scope="row">Median household income<\/th><td[^>]*>\$98,400<\/td><td[^>]*>\$104,900<\/td><td[^>]*>\$101,200<\/td><td[^>]*>\$80,734<\/td>/);
    // A count has no US figure to sit beside.
    expect(html).toMatch(/<th scope="row">Population<\/th>(<td[^>]*>[^<]*<\/td>){3}<td[^>]*>—<\/td>/);
  });

  it('lists the transit stops nearest first', () => {
    const html = render();
    const stops = [...html.matchAll(/class="sp-brief__stop-name">([^<]+)</g)].map((m) => m[1]);
    expect(stops[0]).toBe('Preston Rd @ Park Blvd');
    expect(stops.at(-1)).toBe('Downtown Plano Station (DART)');
  });

  it('names its sources, and says when the area figures are a sample', () => {
    const html = render();
    expect(html).toContain('US figures: US Census Bureau, ACS 5-year 2020–2024');
    expect(html).toContain(area.source);
    expect(render({ area: { ...area, sample: false, source: 'US Census Bureau, ACS 5-year 2023' } })).not.toContain('Sample');
  });

  it('in the PDF, is a section of the report under a plain heading', () => {
    const html = render({ print: true });
    expect(html).toContain('<h2 class="sp-brief__title">Location</h2>');
    expect(html).toContain('sp-brief--print');
  });
});
