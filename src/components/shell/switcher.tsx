import type { Property } from '../../domain/types';
import type { MenuItem } from '../ui/Menu';
import { PORTFOLIO } from '../../data/mock/portfolio';

/**
 * The entries of the building switcher: the live building, checked, then the portfolio's sample entries,
 * disabled. Pure, so the header's menu can be tested without opening it.
 */
export function switcherItems(property: Property): MenuItem[] {
  return [
    { kind: 'heading', id: 'portfolio', label: `Portfolio · ${PORTFOLIO.length + 1} buildings` },
    { id: property.id, label: property.name, hint: `${property.city}, ${property.state}`, checked: true, onSelect: () => {} },
    ...PORTFOLIO.map((b): MenuItem => ({ id: b.id, label: b.name, hint: b.city, disabled: true, onSelect: () => {} })),
    { kind: 'separator', id: 'portfolio-sep' },
    { id: 'portfolio-note', label: 'Sample entries: only the first building opens', disabled: true, onSelect: () => {} },
  ];
}
