import type { MenuItem } from '../ui/Menu';
import { PALETTES, palettePatch, type Palette, type PlanState } from '../../state/planState';

/**
 * The entries of the Colors menu: the two palettes, the current one checked, and a Custom entry that is
 * not yet offered. Pure, so the header's menu can be tested without opening it.
 */
export function paletteMenuItems(current: Palette, patch: (p: Partial<PlanState>) => void): MenuItem[] {
  return [
    { kind: 'heading', id: 'palette', label: 'Colors' },
    ...PALETTES.map(
      (p): MenuItem => ({
        id: `palette-${p.id}`,
        label: p.label,
        adornment: <span className={`sp-palette__dot sp-palette__dot--${p.id}`} aria-hidden="true" />,
        checked: p.id === current,
        onSelect: () => patch(palettePatch(p.id)),
      }),
    ),
    {
      id: 'palette-custom',
      label: 'Custom',
      hint: 'coming soon',
      disabled: true,
      adornment: <span className="sp-palette__dot sp-palette__dot--custom" aria-hidden="true" />,
      onSelect: () => {},
    },
  ];
}
