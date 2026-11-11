import type { Property } from '../../domain/types';
import type { MenuItem } from '../ui/Menu';
import { LIVE_STACK, PORTFOLIO } from '../../data/mock/portfolio';
import { MiniStack } from './Brand';

/**
 * The entries of the building switcher: the live building, checked, then every sample entry, disabled, each
 * with its own mini stack, and a last line that says they are samples. Pure, so the header's menu can be
 * tested without opening it.
 */
export function switcherItems(property: Property): MenuItem[] {
  return [
    { kind: 'heading', id: 'portfolio', label: `Portfolio · ${PORTFOLIO.length + 1} buildings` },
    { id: property.id, label: property.name, hint: `${property.city}, ${property.state}`, adornment: <MiniStack drawing={LIVE_STACK} size={20} />, checked: true, onSelect: () => {} },
    ...PORTFOLIO.map((b): MenuItem => ({ id: b.id, label: b.name, hint: b.city, adornment: <MiniStack drawing={b} size={20} />, disabled: true, onSelect: () => {} })),
    { kind: 'separator', id: 'portfolio-sep' },
    { kind: 'heading', id: 'portfolio-note', label: `Sample entries · only ${property.name} opens` },
  ];
}
