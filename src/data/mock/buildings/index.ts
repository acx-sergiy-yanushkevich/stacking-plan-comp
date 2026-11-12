import type { Property } from '../../../domain/types';
import { property as prestonPark } from '../property';
import { LIVE_STACK, type MiniStackDrawing } from '../portfolio';
import { bluebonnet } from './bluebonnet';
import { cedarSprings } from './cedarSprings';
import { legacyWest } from './legacyWest';

/** A building that opens: its records and the icon the switcher draws for it. */
export interface OpenBuilding {
  property: Property;
  stack: MiniStackDrawing;
}

/**
 * Every building with data behind it, in the switcher's order. The first is the default: a plan with no
 * `building` in its address opens it. The icons are the ones these buildings wore as sample entries.
 */
export const BUILDINGS: ReadonlyArray<OpenBuilding> = [
  { property: prestonPark, stack: LIVE_STACK },
  { property: legacyWest, stack: { floors: [[0.5, 0.5], [1], [0.7, 0.3], [1]], open: [0, 1], tone: '#6366f1' } },
  { property: cedarSprings, stack: { floors: [[1], [0.45, 0.55], [1], [0.65, 0.35]], open: [3, 1], tone: '#0ea5e9' } },
  { property: bluebonnet, stack: { floors: [[1], [0.5, 0.5], [0.5, 0.5], [1]], open: [1, 0], tone: '#3b82f6' } },
];

export const DEFAULT_BUILDING_ID = BUILDINGS[0].property.id;

/** The building an address names; an unknown or absent id opens the default building. */
export function buildingById(id: string | null | undefined): OpenBuilding {
  return BUILDINGS.find((b) => b.property.id === id) ?? BUILDINGS[0];
}
