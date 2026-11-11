import type { Property } from '../../domain/types';
import type { MenuItem } from '../ui/Menu';
import { PORTFOLIO } from '../../data/mock/portfolio';

/** How many sample entries the menu names; the rest are counted on its last line. */
export const SWITCHER_SHOWN = 3;

/**
 * The entries of the building switcher: the live building, checked, then the first sample entries,
 * disabled, and a last line that counts the rest and says they are samples. Pure, so the header's menu
 * can be tested without opening it.
 */
export function switcherItems(property: Property): MenuItem[] {
  return [
    { kind: 'heading', id: 'portfolio', label: `Portfolio · ${PORTFOLIO.length + 1} buildings` },
    { id: property.id, label: property.name, hint: `${property.city}, ${property.state}`, checked: true, onSelect: () => {} },
    ...PORTFOLIO.slice(0, SWITCHER_SHOWN).map((b): MenuItem => ({ id: b.id, label: b.name, hint: b.city, disabled: true, onSelect: () => {} })),
    { id: 'portfolio-note', label: `+ ${PORTFOLIO.length - SWITCHER_SHOWN} more · sample entries`, disabled: true, onSelect: () => {} },
  ];
}
