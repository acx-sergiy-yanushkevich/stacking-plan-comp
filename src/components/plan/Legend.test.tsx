// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { buildingUse, Legend } from './Legend';

describe('buildingUse: the legend entry for non-leasable area', () => {
  it('adds up the lobby and building use across floors, in exact SF', () => {
    const entry = buildingUse([{ floor: { nonLeasable: 2600 } }, { floor: { nonLeasable: 0 } }, { floor: { nonLeasable: 150 } }]);
    expect(entry).toMatchObject({ label: 'Lobby · building use', sf: 2750, tone: 'muted', pattern: 'hatch' });
    expect(entry!.title).toBe('Lobby and building use: 2,750 SF non-leasable (lobby, loading, building use). Not counted in occupancy.');
  });

  it('is absent for a building with none', () => {
    expect(buildingUse([{ floor: { nonLeasable: 0 } }])).toBeNull();
    expect(buildingUse([])).toBeNull();
  });
});

describe('Legend', () => {
  const items = [{ tone: 'leased', label: 'Leased', sf: 1000, share: 0.5, pattern: null }] as unknown as Parameters<typeof Legend>[0]['items'];

  it('prints an extra entry after the lens\'s states, with its SF and no share', () => {
    const html = renderToString(<Legend items={items} extras={[buildingUse([{ floor: { nonLeasable: 2600 } }])!]} note="A note." full />);
    expect(html.indexOf('Leased')).toBeLessThan(html.indexOf('Lobby · building use'));
    expect(html.indexOf('Lobby · building use')).toBeLessThan(html.indexOf('A note.'));
    expect(html).toContain('<span class="sp-legend__num">2,600</span>');
    expect(html).toMatch(/sp-legend__swatch--hatch" style="background-color:var\(--tone-muted-solid, var\(--tone-muted-fill\)\);border-color:var\(--tone-muted-edge\);color:var\(--tone-muted-edge\)" aria-hidden="true"/);
  });

  it('is unchanged without extras', () => {
    expect(renderToString(<Legend items={items} />)).not.toContain('sp-legend__item--extra');
  });

  it('prints an overlay (the rent lens\'s asking rent) with its SF and no share, so the shares shown add up to 100% (round 17: 113.6%)', () => {
    const rent = [
      { tone: 'rent-2', label: '$31–33.99', sf: 600, share: 0.6, pattern: null },
      { tone: 'rent-4', label: '$38+', sf: 400, share: 0.4, pattern: null },
      { tone: 'empty', label: 'Asking rent (vacancy)', sf: 300, share: 0.3, pattern: 'asking', overlay: true },
    ] as unknown as Parameters<typeof Legend>[0]['items'];
    const html = renderToString(<Legend items={rent} full />).replace(/<!-- -->/g, '');
    const shares = [...html.matchAll(/sp-legend__num">[^<]*· ([\d.]+)%/g)].map((m) => Number(m[1]));
    expect(shares).toEqual([60, 40]);
    expect(html).toContain('<span class="sp-legend__num">300 SF · also in its band</span>');
    // On screen its figures are read with its name, not a mouse-only title.
    const screen = renderToString(<Legend items={rent} />).replace(/<!-- -->/g, '');
    expect(screen).toContain('<span class="sp-sr-only">: 300 SF, also counted in its rent band</span>');
  });

  it('on screen: names only, each entry a tab stop whose figures are read with it; the note behind a real info button', () => {
    const html = renderToString(<Legend items={items} extras={[buildingUse([{ floor: { nonLeasable: 2600 } }])!]} note="A note." />).replace(/<!-- -->/g, '');
    expect(html).not.toContain('sp-legend__num');
    expect(html).toMatch(/<span class="sp-legend__item" tabindex="0"/);
    expect(html).toContain('<span class="sp-sr-only">: 1,000 SF, 50.0% of leasable</span>');
    expect(html).toContain('<span class="sp-sr-only">: 2,600 SF non-leasable (lobby, loading, building use). Not counted in occupancy.</span>');
    expect(html).not.toContain('<span class="sp-legend__note">');
    expect(html).toMatch(/<button type="button"(?=[^>]*aria-expanded="false")(?=[^>]*class="sp-legend__info")(?=[^>]*aria-label="About this legend")(?=[^>]*title="A note\.")[^>]*>/);
    // No note, no mark; a view that puts the mark on its title line gets none in the legend.
    expect(renderToString(<Legend items={items} />)).not.toContain('sp-legend__info');
    expect(renderToString(<Legend items={items} note="A note." infoElsewhere />)).not.toContain('sp-legend__info');
  });

  it('a phone\'s unfolded list prints the figures after each name; a Map or Timeline legend names its lens', () => {
    const html = renderToString(<Legend items={items} figures title="Leasing" />).replace(/<!-- -->/g, '');
    expect(html).toContain('<span class="sp-legend__num">1,000 · 50.0%</span>');
    expect(html).toContain('aria-label="Leasing legend"');
    expect(html).toContain('<span class="sp-legend__title">Leasing</span>');
  });
});
