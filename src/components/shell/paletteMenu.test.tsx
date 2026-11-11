import { describe, expect, it } from 'vitest';
import { paletteMenuItems } from './paletteMenu';

describe('paletteMenuItems', () => {
  it('lists Ascendix, Vice City and a disabled Custom, under a Colors heading', () => {
    const items = paletteMenuItems('ascendix', () => {});
    expect(items.map((i) => ('label' in i ? i.label : i.kind))).toEqual(['Colors', 'Ascendix', 'Vice City', 'Custom']);
    expect(items[0]).toMatchObject({ kind: 'heading' });
    expect(items[1]).toMatchObject({ checked: true });
    expect(items[2]).toMatchObject({ checked: false });
    expect(items[3]).toMatchObject({ disabled: true, hint: 'coming soon' });
  });

  it('marks Vice City when it is current, and selecting a palette writes the patch', () => {
    const patches: unknown[] = [];
    const items = paletteMenuItems('vice', (p) => patches.push(p));
    expect(items[2]).toMatchObject({ checked: true });
    (items[1] as { onSelect: () => void }).onSelect();
    (items[2] as { onSelect: () => void }).onSelect();
    expect(patches).toEqual([{ palette: undefined }, { palette: 'vice' }]);
  });
});
