import type { FloorView } from '../../domain/derive';
import type { PlanModel } from '../../model/usePlanModel';

export interface OpenFloor {
  /** The floor the Building view shows beside the model; null while the building stands alone. */
  floor: FloorView | null;
  /** True when the user opened it (a pinned floor or a selected suite), false when a filter did. */
  pinned: boolean;
}

/**
 * Which floor is open in the Building view, and why. A floor the user pinned (`?floor=`) or whose
 * suite is selected wins; otherwise, while a search, the finder, the worklist or a rollover bucket is
 * lighting suites, the first floor (from the top) that has one opens. Pointing at a floor never opens it.
 *
 * This is the one rule for "is a floor open": the view docks its model by it. Where the building's KPIs
 * stand does not depend on it (`kpiPlacement.ts`): they stay put when a floor opens or closes.
 */
export function openFloorOf(model: Pick<PlanModel, 'floors' | 'highlight' | 'selectedFloor'>): OpenFloor {
  if (model.selectedFloor) return { floor: model.selectedFloor, pinned: true };
  const lit = model.highlight;
  const first = lit ? (model.floors.find((f) => f.segments.some((s) => lit.has(s.key))) ?? null) : null;
  return { floor: first, pinned: false };
}

export const isFloorOpen = (model: Pick<PlanModel, 'floors' | 'highlight' | 'selectedFloor'>): boolean => openFloorOf(model).floor !== null;
