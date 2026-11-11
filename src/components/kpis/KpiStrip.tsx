import type { PointerEvent } from 'react';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { fmtMonthYearShort } from '../../domain/dates';
import { num, pct, plural, sfDelta } from '../../domain/format';
import { waltCard, waltTitle } from './walt';
import { canShowRollover, canShowWalt } from '../../domain/safe';
import { setHoverKeys } from '../../state/hoverStore';

export type KpiAction = 'status' | 'find' | 'find-largest' | 'expiry-worklist' | 'timeline' | 'deals';

export interface KpiStripProps {
  model: PlanModel;
  state: PlanState;
  onAction: (a: KpiAction) => void;
}

interface Kpi {
  id: KpiAction;
  label: string;
  value: string;
  unit?: string;
  /** The one short fact under the figure. It is shown whole or not at all (kpis.css), never cut. */
  note: string;
  /** Everything the KPI has to say about its figure: in the tooltip and the accessible name at every width. */
  detail: string;
  delta?: { text: string; good: boolean | null } | null;
  active: boolean;
  /** What the figure is and what a click does. */
  title: string;
  /** A figure with nothing to open (prospect-safe: Expiring 12 mo, WALT and Pipeline). */
  static?: boolean;
  /**
   * The suites the figure is made of, where that is plain: pointing at the KPI (or focusing it) lights
   * them on the plan, and moving away restores it. Left out where the meaning would be unclear.
   */
  lights?: string[];
}

/** How long the pointer rests on a KPI before the plan answers: crossing the bar on the way to the header lights nothing. */
const HOVER_MS = 90;
let hoverTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Lights a KPI's suites on the plan while it is pointed at or has the keyboard. Focus lights at once; the
 * pointer after a short rest. Leaving or blurring restores the plan at once. A touch only presses the KPI.
 */
function lightOn(keys: string[]) {
  const on = () => setHoverKeys(new Set(keys));
  const off = () => {
    clearTimeout(hoverTimer);
    setHoverKeys(null);
  };
  return {
    onPointerEnter: (e: PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === 'touch') return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(on, HOVER_MS);
    },
    onPointerLeave: off,
    onFocus: on,
    onBlur: off,
  };
}

/**
 * The building's six key figures: one quiet bar above the toolbar, the same element in the same place in
 * every view and every state, so nothing under it moves when the view changes, a floor opens or the
 * inspector comes in. The figures do one of two things, and they stand in two groups so the difference
 * shows before a click:
 * - "Color by" (Leased, Pipeline): switches. Each colors the plan by its lens (status, deals); the one in
 *   use has a filled dot and an underline (and `aria-pressed`), as the toolbar's lens marks its own.
 * - "Details" (Available, Largest block, Expiring 12 mo, WALT): each opens something (the space finder, the
 *   worklist, the timeline) and carries an arrow. They are never pressed: what they open shows itself.
 *
 * Two figures are made of suites anyone can point to: "Available" and "Largest block". Pointing at one,
 * or focusing it, lights those suites on the plan (the model, the stack, the open floor's plate) through
 * the hover store, as pointing at a finder option does; nothing is written to the URL and nothing opens.
 */
export function KpiStrip({ model, state, onAction }: KpiStripProps) {
  const { kpis: k, deltas: d, safe } = model;
  // Leased is capped per floor while the parts are recorded SF: name the gap so the context reconciles.
  const overAlloc = k.committed + k.availableSublease - (k.leased - Math.round(k.physical * k.leasable));
  const available = `${num(k.availableDirect)} direct · ${num(k.availableSublease)} sublease`;
  const leased: Kpi = {
    id: 'status',
    label: 'Leased',
    value: pct(k.occupancy),
    note: `${pct(k.physical)} occupied`,
    detail: `${pct(k.physical)} occupied${k.committed ? ` · ${num(k.committed)} SF signed, not in` : ''}`,
    delta: d ? { text: `${d.occupancy >= 0 ? '+' : '−'}${Math.abs(d.occupancy * 100).toFixed(1)} pts`, good: d.occupancy >= 0 } : null,
    // Pressed whenever the plan is coloured by status, as Pipeline is whenever it is coloured by deals.
    active: state.lens === 'status',
    title: `Leased share of leasable RSF, including signed leases that have not commenced.${safe ? '' : ` ${num(Math.round(k.physical * k.leasable))} SF occupied + ${num(k.committed)} signed, not in + ${num(k.availableSublease)} sublet vacant${overAlloc > 0 ? ` − ${num(overAlloc)} over-allocated (capped)` : ''} = ${num(k.leased)} SF leased.`} Click to color the plan by occupancy.`,
  };
  const opens: Kpi[] = [
    {
      id: 'find',
      label: 'Available',
      value: num(k.availableDirect + k.availableSublease),
      unit: 'SF',
      note: available,
      detail: `${available}${k.comingAvailable.sf ? ` · +${num(k.comingAvailable.sf)} ${k.comingAvailable.from ? fmtMonthYearShort(k.comingAvailable.from) : 'later'}` : ''}`,
      delta: d ? { text: sfDelta(d.availableDirect + d.availableSublease), good: d.availableDirect + d.availableSublease <= 0 } : null,
      active: false,
      title: 'Space a tenant could take on the as-of date. Point at it to see it on the plan; click to find space by size.',
      lights: k.availableKeys,
    },
    {
      id: 'find-largest',
      label: 'Largest block',
      value: num(k.maxContiguous.size),
      unit: 'SF',
      note: k.maxContiguous.floorName ? `${k.maxContiguous.floorName} · direct` : 'No direct space',
      detail: k.maxContiguous.floorName ? `${k.maxContiguous.floorName} · direct · contiguous` : 'No direct space available',
      delta: d ? { text: sfDelta(d.maxContiguous), good: d.maxContiguous >= 0 } : null,
      active: false,
      title: 'Largest run of adjacent direct availabilities. Point at it to see it on the plan; click to see every option at this size.',
      lights: k.maxContiguous.keys,
    },
    canShowRollover(safe)
      ? {
          id: 'expiry-worklist',
          label: 'Expiring 12 mo',
          value: num(k.expiring12),
          unit: 'SF',
          note: `${k.leased ? pct(k.expiring12 / k.leased) : '0%'} of leased · ${plural(k.expiring12Leases, 'lease')}`,
          detail: `${k.leased ? pct(k.expiring12 / k.leased) : '0%'} of leased · ${plural(k.expiring12Leases, 'lease')}`,
          delta: d ? { text: sfDelta(d.expiring12), good: d.expiring12 <= 0 } : null,
          active: false,
          title: 'Lease SF ending within 12 months of the as-of date. Click for the expiration lens and the 12-month worklist.',
        }
      : {
          // With every suite's RSF on the plan, the SF expiring (and the lease count) would name the suites: no figure at all.
          id: 'expiry-worklist',
          label: 'Expiring 12 mo',
          value: 'Withheld',
          note: 'Lease terms not shown',
          detail: 'Lease terms are not shown in prospect-safe mode',
          active: false,
          title: 'When leases end is withheld in prospect-safe mode',
          static: true,
        },
    // WALT is made of nothing but lease terms: it shows only where the terms themselves may be shown
    // (`canShowWalt` is `canShowLeaseTerm`, domain/safe.ts).
    canShowWalt(safe)
      ? {
          id: 'timeline',
          label: 'Avg lease term',
          value: waltCard(k.walt),
          unit: 'yr',
          note: 'SF-weighted',
          detail: 'In-place, SF-weighted',
          // The chip is the difference of the two figures as shown, so the figure reconciles with today's.
          delta: d ? (() => { const dw = Number(waltCard(k.walt)) - Number(waltCard(model.kpisToday.walt)); return { text: `${dw >= 0 ? '+' : '−'}${Math.abs(dw).toFixed(2)} yr`, good: dw >= 0 }; })() : null,
          active: false,
          title: waltTitle(k.walt, model.safe),
        }
      : {
          // The weighted average of the lease terms is a lease-term figure: it is withheld with the terms it averages,
          // in the same words as "Expiring 12 mo" beside it.
          id: 'timeline',
          label: 'Avg lease term',
          value: 'Withheld',
          note: 'Lease terms not shown',
          detail: 'Lease terms are not shown in prospect-safe mode',
          active: false,
          title: 'The weighted average lease term is withheld in prospect-safe mode',
          static: true,
        },
  ];
  const pipeline: Kpi = safe
    ? {
        id: 'deals',
        label: 'Pipeline',
        value: 'Withheld',
        note: 'Deal activity not shown',
        detail: 'Deal activity is not shown in prospect-safe mode',
        active: false,
        title: 'Deal activity is withheld in prospect-safe mode',
        static: true,
      }
    : {
        id: 'deals',
        label: 'Pipeline',
        value: String(k.pipeline.deals),
        unit: k.pipeline.deals === 1 ? 'deal' : 'deals',
        note: `${num(k.pipeline.sf)} SF requested`,
        detail: `${k.pipeline.onVacancy} on vacancies · ${plural(k.pipeline.deals - k.pipeline.onVacancy, 'renewal')} · ${num(k.pipeline.sf)} SF requested`,
        delta: d ? { text: `${d.pipelineDeals >= 0 ? '+' : '−'}${Math.abs(d.pipelineDeals)} ${Math.abs(d.pipelineDeals) === 1 ? 'deal' : 'deals'}`, good: d.pipelineDeals >= 0 } : null,
        active: state.lens === 'deals',
        title: 'Live deals on this building. Click to color the plan by pipeline.',
      };
  const lenses = [leased, pipeline];
  const kpi = (c: Kpi, kind: 'lens' | 'open') => {
    // The accessible name is the content itself: the label, the figure, the change, then the whole note
    // (read in place of the short one on screen, which may have been dropped for want of room).
    const body = (
      <span className="sp-kpi__body">
        <span className="sp-kpi__label sp-label">
          {kind === 'lens' && !c.static && <span className="sp-kpi__dot" aria-hidden="true" />}
          {c.label}
        </span>
        <span className="sp-kpi__value">
          <span className="sp-kpi__figure">
            {c.value}
            {c.unit && <span className="sp-kpi__unit"> {c.unit}</span>}
          </span>
          {c.delta && (
            <span className={`sp-kpi__delta ${c.delta.good === null ? '' : c.delta.good ? 'sp-kpi__delta--up' : 'sp-kpi__delta--down'}`} title="Change against today">
              {c.delta.text}
              <span className="sp-sr-only"> against today</span>
            </span>
          )}
        </span>
        <span className="sp-kpi__context" aria-hidden="true">
          <span className="sp-kpi__note">{c.note}</span>
        </span>
        <span className="sp-sr-only">{c.detail}</span>
      </span>
    );
    return c.static ? (
      <div key={c.id} className="sp-kpi sp-kpi--static" data-kpi={c.id} title={`${c.detail}. ${c.title}.`}>
        {body}
      </div>
    ) : (
      <button
        key={c.id}
        type="button"
        className={`sp-kpi sp-kpi--${kind}${c.active ? ' is-active' : ''}`}
        data-kpi={c.id}
        onClick={() => onAction(c.id)}
        title={`${c.detail}. ${c.title}`}
        aria-pressed={kind === 'lens' ? c.active : undefined}
        {...(c.lights?.length ? lightOn(c.lights) : null)}
      >
        {body}
      </button>
    );
  };
  // The caption sits on the card's top edge, outside it, so the card can clip its corners.
  const group = (kind: 'lens' | 'open', name: string, caption: string, items: Kpi[]) => (
    <div className={`sp-kpis__wrap sp-kpis__wrap--${kind}`}>
      <div role="group" className={`sp-card sp-kpis__group sp-kpis__group--${kind}`} aria-label={name}>
        {items.map((c) => kpi(c, kind))}
      </div>
      <span className="sp-kpis__caption" aria-hidden="true">{caption}</span>
    </div>
  );
  return (
    <section className="sp-kpis sp-no-print" aria-label="Key figures">
      {group('lens', 'Color the plan by', 'Color by', lenses)}
      {group('open', 'Open a detail', 'Details', opens)}
    </section>
  );
}
