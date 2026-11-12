import type { PlanModel } from '../../model/usePlanModel';
import type { LensId } from '../../domain/lenses';
import { canShowIssues } from '../../domain/safe';
import { rampNote } from '../stack/rampNote';
import { sharesNote } from './Legend';

/**
 * The legend's info note in the Building, Timeline and Map views: which end of the colour ramp is which,
 * then what the shares add up to and why (the floor that is over its area, to the owner only). The Stack
 * view says the same, with its own notes about drawing small suites (round 20: these three views said
 * only the first, or an older sentence).
 */
export function planLegendNote(model: PlanModel, lens: LensId): string | null {
  const over = canShowIssues(model.safe) ? model.floors.filter((f) => f.overAllocatedBy > 0).map((f) => ({ name: f.floor.name, by: f.overAllocatedBy })) : [];
  return [rampNote(lens, model.safe), sharesNote(model.legend, model.kpis.leasable, over)].filter(Boolean).join(' ') || null;
}
