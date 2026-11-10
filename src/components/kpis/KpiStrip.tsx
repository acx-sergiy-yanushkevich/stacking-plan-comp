import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { fmtMonthYearShort } from '../../domain/dates';
import { num, pct, plural, sfDelta } from '../../domain/format';

export type KpiAction = 'status' | 'find' | 'find-largest' | 'expiry-worklist' | 'timeline' | 'deals';

export interface KpiStripProps {
  model: PlanModel;
  state: PlanState;
  onAction: (a: KpiAction) => void;
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
  /** Informational card with no action (prospect-safe Pipeline). */
  static?: boolean;
}

export function KpiStrip({ model, state, onAction }: KpiStripProps) {
  const { kpis: k, deltas: d, safe } = model;
  // Leased is capped per floor while the parts are recorded SF: name the gap so the context reconciles.
  const overAlloc = k.committed + k.availableSublease - (k.leased - Math.round(k.physical * k.leasable));
  const cards: Card[] = [
    {
      id: 'status',
      label: 'Leased',
      value: pct(k.occupancy),
      context: `${pct(k.physical)} occupied${k.committed ? ` · ${num(k.committed)} SF signed, not in` : ''}${k.availableSublease ? ` · ${num(k.availableSublease)} sublet vacant` : ''}${overAlloc > 0 && !safe ? ` − ${num(overAlloc)} over-allocated (capped)` : ''}`,
      delta: d ? { text: `${d.occupancy >= 0 ? '+' : '−'}${Math.abs(d.occupancy * 100).toFixed(1)} pts`, good: d.occupancy >= 0 } : null,
      active: state.lens === 'status' && state.mode === 'building' && !state.q,
      title: 'Leased share of leasable RSF, including signed leases that have not commenced. Click for the status lens.',
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
    {
      id: 'expiry-worklist',
      label: 'Expiring 12 mo',
      value: num(k.expiring12),
      unit: 'SF',
      context: `${k.leased ? pct(k.expiring12 / k.leased) : '0%'} of leased · ${plural(k.expiring12Leases, 'lease')}`,
      delta: d ? { text: sfDelta(d.expiring12), good: d.expiring12 <= 0 } : null,
      active: state.window === '12' || (state.lens === 'expiry' && state.mode === 'building' && state.bucket === null),
      title: 'Lease SF ending within 12 months of the as-of date. Click for the expiration lens and the 12-month worklist.',
    },
    {
      id: 'timeline',
      label: 'WALT',
      value: k.walt.toFixed(1),
      unit: 'yr',
      context: 'In-place, SF-weighted',
      delta: d ? (() => { const dw = Number(k.walt.toFixed(1)) - Number(model.kpisToday.walt.toFixed(1)); return { text: `${dw >= 0 ? '+' : '−'}${Math.abs(dw).toFixed(1)} yr`, good: dw >= 0 }; })() : null,
      active: false,
      title: 'Weighted average lease term remaining. Click for the lease timeline.',
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
          context: `${k.pipeline.onVacancy} on vacancies · ${plural(k.pipeline.deals - k.pipeline.onVacancy, 'renewal')} · ${num(k.pipeline.sf)} SF`,
          delta: d ? { text: `${d.pipelineDeals >= 0 ? '+' : ''}${d.pipelineDeals} ${Math.abs(d.pipelineDeals) === 1 ? 'deal' : 'deals'}`, good: d.pipelineDeals >= 0 } : null,
          active: state.lens === 'deals',
          title: 'Live deals on this building. Click for the deals lens.',
        },
  ];
  return (
    <section className="sp-card sp-kpis sp-no-print" aria-label="Key figures">
      {cards.map((c) => c.static ? (
        <div key={c.id} className="sp-kpi sp-kpi--static" title={c.title}>
          <span className="sp-kpi__label sp-label">{c.label}</span>
          <span className="sp-kpi__value">
            <span>{c.value}</span>
          </span>
          <span className="sp-kpi__context">{c.context}</span>
        </div>
      ) : (
        <button key={c.id} type="button" className={`sp-kpi ${c.active ? 'is-active' : ''}`} onClick={() => onAction(c.id)} title={c.title} aria-pressed={c.active}>
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
