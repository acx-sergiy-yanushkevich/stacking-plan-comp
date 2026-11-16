import type { Property } from '../../domain/types';
import type { MenuItem } from '../ui/Menu';
import { PORTFOLIO } from '../../data/mock/portfolio';
import { BUILDINGS } from '../../data/mock/buildings';
import { MiniStack } from './Brand';

/**
 * The entries of the building switcher, in two groups. First every building with data, the open one checked
 * and the others opening on select: each on two lines, its name and then where it is, what it is and how
 * tall, so two buildings in one city tell apart. Then, under a heading that says so before anyone tries
 * them, the sample entries: disabled, one quiet line each. Every entry has its own mini stack. Pure, so the
 * header's menu can be tested without opening it.
 */
export function switcherItems(property: Property, onOpen: (id: string) => void): MenuItem[] {
  return [
    { kind: 'heading', id: 'portfolio', label: `Portfolio · ${BUILDINGS.length + PORTFOLIO.length} buildings` },
    ...BUILDINGS.map(({ property: b, stack }): MenuItem => {
      const open = b.id === property.id;
      const detail = `${b.city}, ${b.state} · ${b.propertyClass} · ${b.floors.length} floors`;
      return { id: b.id, label: b.name, detail, adornment: <MiniStack drawing={stack} size={28} />, checked: open, onSelect: () => (open ? undefined : onOpen(b.id)) };
    }),
    { kind: 'separator', id: 'portfolio-sep' },
    { kind: 'heading', id: 'portfolio-note', label: 'Sample entries · these do not open' },
    ...PORTFOLIO.map((b): MenuItem => ({ id: b.id, label: b.name, hint: b.city, adornment: <MiniStack drawing={b} size={20} />, disabled: true, description: 'Sample entry: it does not open', onSelect: () => {} })),
  ];
}
