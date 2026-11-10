import type { PlanModel } from '../../model/usePlanModel';
import type { ChosenOption } from '../../domain/finder';
import { optionSuites } from '../../domain/finder';
import { fmtDate } from '../../domain/dates';
import { num, plural, sf } from '../../domain/format';
import { selectSegment, type Patch } from '../plan/actions';
import { Section } from './parts';

export interface OptionSectionProps {
  option: ChosenOption;
  model: PlanModel;
  /** The suite the inspector is showing. */
  current: string;
  patch: Patch;
}

/**
 * The finder option the open suite belongs to, when it is made of several suites: its total, its
 * type and timing, and every suite in it. A row opens that suite; the option, and its highlight in
 * the plan, stay.
 */
export function OptionSection({ option, model, current, patch }: OptionSectionProps) {
  const suites = optionSuites(model.floors, option.keys, model.asOf);
  if (suites.length < 2) return null;
  const floors = new Set(suites.map((s) => s.floorId)).size;
  return (
    <Section title={`Option · ${option.title}`}>
      <p className="sp-ins__explain">
        <strong>{sf(option.size)}</strong> in {plural(suites.length, 'suite')}
        {floors > 1 ? ` on ${floors} floors` : ''} · {option.type} · {option.from ? `all of it from ${fmtDate(option.from)}` : 'available now'}
        {option.shortfall > 0 ? ` · ${num(option.shortfall)} SF short of the requirement` : ''}. Every suite is highlighted in the plan.
      </p>
      <ul className="sp-ins__list" aria-label={`Suites in the option ${option.title}`}>
        {suites.map((s) => (
          <li key={s.key}>
            <button type="button" className={`sp-ins__row ${s.key === current ? 'is-selected' : ''}`} aria-pressed={s.key === current} onClick={() => selectSegment(patch, s.key)}>
              <div className="sp-ins__row-main">
                <div className="sp-ins__row-title">
                  <span>
                    {s.floorName}
                    {s.suite ? ` · Ste ${s.suite}` : ''}
                  </span>
                </div>
                <div className="sp-ins__row-meta">
                  <span>{s.type}</span>
                  <span>{s.from ? `From ${fmtDate(s.from)}` : 'Now'}</span>
                </div>
              </div>
              <div className="sp-ins__row-end">
                <span className="sp-ins__row-value">{sf(s.size)}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
