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
    const html = renderToString(<Legend items={items} extras={[buildingUse([{ floor: { nonLeasable: 2600 } }])!]} note="A note." />);
    expect(html.indexOf('Leased')).toBeLessThan(html.indexOf('Lobby · building use'));
    expect(html.indexOf('Lobby · building use')).toBeLessThan(html.indexOf('A note.'));
    expect(html).toContain('<span class="sp-legend__num">2,600</span>');
    expect(html).toMatch(/sp-legend__swatch--hatch" style="background-color:var\(--tone-muted-solid, var\(--tone-muted-fill\)\);border-color:var\(--tone-muted-edge\);color:var\(--tone-muted-edge\)" aria-hidden="true"/);
  });

  it('is unchanged without extras', () => {
    expect(renderToString(<Legend items={items} />)).not.toContain('sp-legend__item--extra');
  });
});
