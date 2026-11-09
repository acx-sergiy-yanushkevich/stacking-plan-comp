import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { fmtMonthYearShort } from '../../domain/dates';
import { num, pct, plural, sf, sfDelta } from '../../domain/format';

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
}

export function KpiStrip({ model, state, onAction }: KpiStripProps) {
  const { kpis: k, deltas: d, safe } = model;
  const rent = k.rentByType[0];
  const cards: Card[] = [
    {
      id: 'status',
      label: 'Leased',
      value: pct(k.occupancy),
      context: `${pct(k.physical)} physically occupied${k.committed ? ` · ${sf(k.committed)} signed, not in` : ''}`,
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
      active: state.mode === 'find' && !state.req,
      title: 'Space a tenant could take on the as-of date. Click to find space by size.',
    },
    {
      id: 'find-largest',
      label: 'Largest block',
      value: num(k.maxContiguous.size),
      unit: 'SF',
      context: k.maxContiguous.floorName ? `${k.maxContiguous.floorName} · direct · contiguous` : 'No direct space available',
      active: state.mode === 'find' && state.req === k.maxContiguous.size,
      title: 'Largest run of adjacent direct availabilities. Click to see every option at this size.',
    },
    {
      id: 'expiry-worklist',
      label: 'Expiring 12 mo',
      value: num(k.expiring12),
      unit: 'SF',
      context: `${k.leased ? pct(k.expiring12 / k.leased) : '0%'} of leased · ${plural(k.expiring12Leases, 'lease')}`,
      delta: d ? { text: sfDelta(d.expiring12), good: d.expiring12 <= 0 } : null,
      active: state.window === '12',
      title: 'Lease SF ending within 12 months of the as-of date. Click for the expiration lens and the 12-month worklist.',
    },
    {
      id: 'timeline',
      label: 'WALT',
      value: k.walt.toFixed(1),
      unit: 'yr',
      context: 'In-place, SF-weighted · MTM and holdover count as 0',
      delta: d ? { text: `${d.walt >= 0 ? '+' : '−'}${Math.abs(d.walt).toFixed(1)} yr`, good: d.walt >= 0 } : null,
      active: state.view === 'timeline',
      title: 'Weighted average lease term remaining. Click for the lease timeline.',
    },
    safe
      ? {
          id: 'deals',
          label: 'Pipeline',
          value: String(k.pipeline.deals),
          unit: k.pipeline.deals === 1 ? 'deal' : 'deals',
          context: `${k.pipeline.onVacancy} on vacancies · ${sf(k.pipeline.sf)} in play`,
          active: state.lens === 'deals',
          title: 'Live deals on this building. Click for the deals lens.',
        }
      : {
          id: 'deals',
          label: 'Pipeline',
          value: String(k.pipeline.deals),
          unit: k.pipeline.deals === 1 ? 'deal' : 'deals',
          context: `${k.pipeline.onVacancy} on vacancies · ${k.pipeline.deals - k.pipeline.onVacancy} renewals · ${sf(k.pipeline.sf)} in play`,
          delta: d ? { text: `${d.pipelineDeals >= 0 ? '+' : '−'}${Math.abs(d.pipelineDeals)}`, good: null } : null,
          active: state.lens === 'deals',
          title: 'Live deals on this building. Click for the deals lens.',
        },
  ];
  if (rent && !safe) {
    // Replace WALT context with the rent headline when a gross rent exists? No: keep six cards; rent lives in the lens.
  }
  return (
    <div className="sp-card sp-kpis sp-no-print" role="group" aria-label="Key figures">
      {cards.map((c) => (
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
    </div>
  );
}
