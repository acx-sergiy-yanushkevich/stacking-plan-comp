import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { fmtMonthYearShort } from '../../domain/dates';
import { num, pct, plural, sfDelta } from '../../domain/format';
import { waltCard, waltTitle } from './walt';
import { canShowRollover, canShowWalt } from '../../domain/safe';

export type KpiAction = 'status' | 'find' | 'find-largest' | 'expiry-worklist' | 'timeline' | 'deals';

export interface KpiStripProps {
  model: PlanModel;
  state: PlanState;
  onAction: (a: KpiAction) => void;
  /**
   * `strip` (default) is the row of six tiles above the plan. `column` is the same six figures as a
   * compact list, one row each (label, figure, note): the Building view's column beside the model, which
   * stays where it is whether a floor is open or not.
   */
  variant?: 'strip' | 'column';
}

interface Card {
  id: KpiAction;
  label: string;
  value: string;
  unit?: string;
  context: string;
  delta?: { text: string; good: boolean | null } | null;
  active: boolean;
  title: string;
  /** Informational card with no action (prospect-safe: Expiring 12 mo and Pipeline). */
  static?: boolean;
}

export function KpiStrip({ model, state, onAction, variant = 'strip' }: KpiStripProps) {
  const { kpis: k, deltas: d, safe } = model;
  // Leased is capped per floor while the parts are recorded SF: name the gap so the context reconciles.
  const overAlloc = k.committed + k.availableSublease - (k.leased - Math.round(k.physical * k.leasable));
  const cards: Card[] = [
    {
      id: 'status',
      label: 'Leased',
      value: pct(k.occupancy),
      context: `${pct(k.physical)} occupied${k.committed ? ` · ${num(k.committed)} SF signed, not in` : ''}`,
      delta: d ? { text: `${d.occupancy >= 0 ? '+' : '−'}${Math.abs(d.occupancy * 100).toFixed(1)} pts`, good: d.occupancy >= 0 } : null,
      active: state.lens === 'status' && state.mode === 'building' && !state.q,
      title: `Leased share of leasable RSF, including signed leases that have not commenced.${safe ? '' : ` ${num(Math.round(k.physical * k.leasable))} SF occupied + ${num(k.committed)} signed, not in + ${num(k.availableSublease)} sublet vacant${overAlloc > 0 ? ` − ${num(overAlloc)} over-allocated (capped)` : ''} = ${num(k.leased)} SF leased.`} Click for the status lens.`,
    },
    {
      id: 'find',
      label: 'Available',
      value: num(k.availableDirect + k.availableSublease),
      unit: 'SF',
      context: `${num(k.availableDirect)} direct · ${num(k.availableSublease)} sublease${k.comingAvailable.sf ? ` · +${num(k.comingAvailable.sf)} ${k.comingAvailable.from ? fmtMonthYearShort(k.comingAvailable.from) : 'later'}` : ''}`,
      delta: d ? { text: sfDelta(d.availableDirect + d.availableSublease), good: d.availableDirect + d.availableSublease <= 0 } : null,
      active: state.mode === 'find',
      title: 'Space a tenant could take on the as-of date. Click to find space by size.',
    },
    {
      id: 'find-largest',
      label: 'Largest block',
      value: num(k.maxContiguous.size),
      unit: 'SF',
      context: k.maxContiguous.floorName ? `${k.maxContiguous.floorName} · direct · contiguous` : 'No direct space available',
      delta: d ? { text: sfDelta(d.maxContiguous), good: d.maxContiguous >= 0 } : null,
      active: false,
      title: 'Largest run of adjacent direct availabilities. Click to see every option at this size.',
    },
    canShowRollover(safe)
      ? {
          id: 'expiry-worklist',
          label: 'Expiring 12 mo',
          value: num(k.expiring12),
          unit: 'SF',
          context: `${k.leased ? pct(k.expiring12 / k.leased) : '0%'} of leased · ${plural(k.expiring12Leases, 'lease')}`,
          delta: d ? { text: sfDelta(d.expiring12), good: d.expiring12 <= 0 } : null,
          active: state.window === '12' || (state.lens === 'expiry' && state.mode === 'building' && state.bucket === null),
          title: 'Lease SF ending within 12 months of the as-of date. Click for the expiration lens and the 12-month worklist.',
        }
      : {
          // With every suite's RSF on the plan, the SF expiring (and the lease count) would name the suites: no figure at all.
          id: 'expiry-worklist',
          label: 'Expiring 12 mo',
          value: 'Withheld',
          context: 'Lease terms are not shown in prospect-safe mode',
          active: false,
          title: 'When leases end is withheld in prospect-safe mode',
          static: true,
        },
    // WALT is made of nothing but lease terms: it shows only where the terms themselves may be shown
    // (`canShowWalt` is `canShowLeaseTerm`, domain/safe.ts).
    canShowWalt(safe)
      ? {
          id: 'timeline',
          label: 'WALT',
          value: waltCard(k.walt),
          unit: 'yr',
          context: 'In-place, SF-weighted',
          // The chip is the difference of the two figures as shown, so the card reconciles with today's card.
          delta: d ? (() => { const dw = Number(waltCard(k.walt)) - Number(waltCard(model.kpisToday.walt)); return { text: `${dw >= 0 ? '+' : '−'}${Math.abs(dw).toFixed(2)} yr`, good: dw >= 0 }; })() : null,
          active: false,
          title: waltTitle(k.walt, model.safe),
        }
      : {
          // The weighted average of the lease terms is a lease-term figure: it is withheld with the terms it averages,
          // in the same words as "Expiring 12 mo" beside it.
          id: 'timeline',
          label: 'WALT',
          value: 'Withheld',
          context: 'Lease terms are not shown in prospect-safe mode',
          active: false,
          title: 'The weighted average lease term is withheld in prospect-safe mode',
          static: true,
        },
    safe
      ? {
          id: 'deals',
          label: 'Pipeline',
          value: 'Withheld',
          context: 'Deal activity is not shown in prospect-safe mode',
          active: false,
          title: 'Deal activity is withheld in prospect-safe mode',
          static: true,
        }
      : {
          id: 'deals',
          label: 'Pipeline',
          value: String(k.pipeline.deals),
          unit: k.pipeline.deals === 1 ? 'deal' : 'deals',
          context: `${k.pipeline.onVacancy} on vacancies · ${plural(k.pipeline.deals - k.pipeline.onVacancy, 'renewal')} · ${num(k.pipeline.sf)} SF requested`,
          delta: d ? { text: `${d.pipelineDeals >= 0 ? '+' : ''}${d.pipelineDeals} ${Math.abs(d.pipelineDeals) === 1 ? 'deal' : 'deals'}`, good: d.pipelineDeals >= 0 } : null,
          active: state.lens === 'deals',
          title: 'Live deals on this building. Click for the deals lens.',
        },
  ];
  return (
    <section className={variant === 'column' ? 'sp-kpis sp-kpis--col sp-no-print' : 'sp-card sp-kpis sp-no-print'} aria-label="Key figures">
      {cards.map((c) => c.static ? (
        <div key={c.id} className="sp-kpi sp-kpi--static" data-kpi={c.id} title={c.title}>
          <span className="sp-kpi__label sp-label">{c.label}</span>
          <span className="sp-kpi__value">
            <span>{c.value}</span>
          </span>
          <span className="sp-kpi__context">{c.context}</span>
        </div>
      ) : (
        <button key={c.id} type="button" className={`sp-kpi ${c.active ? 'is-active' : ''}`} data-kpi={c.id} onClick={() => onAction(c.id)} title={c.title} aria-pressed={c.active}>
          <span className="sp-kpi__label sp-label">{c.label}</span>
          <span className="sp-kpi__value">
            <span>
              {c.value}
              {c.unit && <span className="sp-kpi__unit"> {c.unit}</span>}
            </span>
            {c.delta && (
              <span className={`sp-kpi__delta ${c.delta.good === null ? '' : c.delta.good ? 'sp-kpi__delta--up' : 'sp-kpi__delta--down'}`} title="Change against today">
                {c.delta.text}
              </span>
            )}
          </span>
          <span className="sp-kpi__context">{c.context}</span>
        </button>
      ))}
    </section>
  );
}
