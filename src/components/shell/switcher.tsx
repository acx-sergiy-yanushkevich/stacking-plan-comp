import type { Property } from '../../domain/types';
import type { MenuItem } from '../ui/Menu';
import { PORTFOLIO } from '../../data/mock/portfolio';
import { BUILDINGS } from '../../data/mock/buildings';
import { MiniStack } from './Brand';

/**
 * The entries of the building switcher: every building with data, the open one checked and the others
 * opening on select, then every sample entry, disabled, each with its own mini stack, and a last line that
 * says they are samples. Pure, so the header's menu can be tested without opening it.
 */
export function switcherItems(property: Property, onOpen: (id: string) => void): MenuItem[] {
  return [
    { kind: 'heading', id: 'portfolio', label: `Portfolio · ${BUILDINGS.length + PORTFOLIO.length} buildings` },
    ...BUILDINGS.map(({ property: b, stack }): MenuItem => {
      const open = b.id === property.id;
      return { id: b.id, label: b.name, hint: `${b.city}, ${b.state}`, adornment: <MiniStack drawing={stack} size={20} />, checked: open, onSelect: () => (open ? undefined : onOpen(b.id)) };
    }),
    ...PORTFOLIO.map((b): MenuItem => ({ id: b.id, label: b.name, hint: b.city, adornment: <MiniStack drawing={b} size={20} />, disabled: true, description: 'Sample entry: it does not open', onSelect: () => {} })),
    { kind: 'separator', id: 'portfolio-sep' },
    { kind: 'heading', id: 'portfolio-note', label: `Sample entries · only the first ${BUILDINGS.length} open` },
  ];
}
