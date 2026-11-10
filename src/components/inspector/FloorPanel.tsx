import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { isLeaseKind, type FloorView } from '../../domain/derive';
import { fmtMonthYear } from '../../domain/dates';
import { pct, plural, sf } from '../../domain/format';
import { tenantLabel } from '../../domain/safe';
import { Button, Icon } from '../ui';
import { openFloorPlate, selectSegment, type Patch } from '../plan/actions';
import { segmentText } from '../plan/segmentText';
import { Section } from './parts';

export interface FloorPanelProps {
  floor: FloorView;
  model: PlanModel;
  state: PlanState;
  patch: Patch;
}

export function FloorPanel({ floor, model, state, patch }: FloorPanelProps) {
  const { safe, asOf } = model;
  const leasedPct = floor.leasable ? floor.leased / floor.leasable : 0;
  const next = floor.segments
    .filter((s) => s.lease && isLeaseKind(s.kind) && s.endDate && s.monthsToExpiry !== null && s.monthsToExpiry >= 0)
    .sort((a, b) => (a.endDate! < b.endDate! ? -1 : a.endDate! > b.endDate! ? 1 : 0))[0];

  return (
    <>
      <Section title="Floor">
        <div className="sp-ins__kpis">
          <div className="sp-ins__kpi">
            <span className="sp-label">Leased</span>
            <span className="sp-ins__kpi-value">{pct(leasedPct)}</span>
            <span className="sp-ins__kpi-sub">
              {sf(floor.leased)} of {sf(floor.leasable)}
            </span>
          </div>
          <div className="sp-ins__kpi">
            <span className="sp-label">Available</span>
            <span className="sp-ins__kpi-value">
              {floor.available > 0 ? sf(floor.available) : '—'}
            </span>
            <span className="sp-ins__kpi-sub">{(() => { const d = floor.segments.some((s) => s.kind === 'available' && !s.availableFrom); const su = floor.segments.some((s) => s.kind === 'sublease'); return d && su ? 'Direct and sublease, now' : su ? 'Sublease, now' : d ? 'Direct, now' : 'Nothing on the market now'; })()}</span>
          </div>
          <div className="sp-ins__kpi">
            <span className="sp-label">Largest contiguous</span>
            <span className="sp-ins__kpi-value">{floor.maxContiguous > 0 ? sf(floor.maxContiguous) : '—'}</span>
            <span className="sp-ins__kpi-sub">{floor.bestRun.length > 1 ? `${floor.bestRun.length} adjacent direct suites` : floor.bestRun.length === 1 ? 'One direct suite' : 'No direct space now'}</span>
          </div>
          <div className="sp-ins__kpi">
            <span className="sp-label">Next expiry</span>
            <span className="sp-ins__kpi-value">{next?.endDate ? fmtMonthYear(next.endDate) : '—'}</span>
            <span className="sp-ins__kpi-sub">{next?.lease ? tenantLabel(next.lease, safe) : 'No lease ending'}</span>
          </div>
        </div>
        {floor.overAllocatedBy > 0 && (
          <p className="sp-ins__note sp-ins__warn">Over-allocated by {sf(floor.overAllocatedBy)}: leases and availabilities exceed the leasable area.</p>
        )}
      </Section>

      <Section title={`Suites · ${plural(floor.segments.length, 'block')}`}>
        <ul className="sp-ins__list">
          {floor.segments.map((s) => {
            const t = segmentText(s, { safe, asOf, lens: state.lens, floorName: floor.floor.name });
            const selected = state.select === s.key;
            return (
              <li key={s.key}>
                <button type="button" className={`sp-ins__row ${selected ? 'is-selected' : ''}`} onClick={() => selectSegment(patch, s.key)} title={t.tooltip}>
                  <span className="sp-ins__swatch" aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, flex: 'none', background: `var(--tone-${t.tone}-fill)`, border: `1px solid var(--tone-${t.tone}-edge)` }} />
                  <div className="sp-ins__row-main">
                    <div className="sp-ins__row-title">
                      <span>{t.name}</span>
                    </div>
                    <div className="sp-ins__row-meta">
                      <span>{s.suite ? `Ste ${s.suite}` : 'No suite'}</span>
                      {t.meta && <span>{t.meta}</span>}
                    </div>
                  </div>
                  <div className="sp-ins__row-end">
                    <span className="sp-ins__row-value">{sf(s.size)}</span>
                  </div>
                  <Icon name="chevron-right" size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      {state.view !== 'floor' && (
        <div className="sp-ins__actions">
          <Button variant="brand" icon="floor" onClick={() => openFloorPlate(patch, floor.floor.id)}>
            Open floor plate
          </Button>
        </div>
      )}
    </>
  );
}
