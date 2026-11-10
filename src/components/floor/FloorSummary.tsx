import type { FloorView as FloorViewModel } from '../../domain/derive';
import { fmtDate, fmtMonths } from '../../domain/dates';
import { num, pct, sf } from '../../domain/format';
import { tenantLabel } from '../../domain/safe';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { Chip } from '../ui';
import { FloorLists } from './FloorLists';
import { nextExpiry } from './floorData';

export interface FloorSummaryProps {
  floor: FloorViewModel;
  model: PlanModel;
  state: PlanState;
  patch: (p: Partial<PlanState>) => void;
}

/** One floor in numbers and lists: leased, available, largest block, next expiry, then suites, deals, inquiries and issues. */
export function FloorSummary({ floor, model, state, patch }: FloorSummaryProps) {
  const { safe } = model;
  const leasedShare = floor.leasable > 0 ? floor.leased / floor.leasable : 0;
  const direct = floor.segments.filter((s) => s.kind === 'available' && !s.availableFrom).reduce((t, s) => t + s.size, 0);
  const sublease = floor.segments.filter((s) => s.kind === 'sublease').reduce((t, s) => t + s.size, 0);
  const next = nextExpiry(floor);
  return (
    <>
      <dl className="sp-fkpis">
        <div className="sp-fkpi sp-fkpi--wide">
          <dt>Leased</dt>
          <dd>
            <span className="sp-fkpi__value">{pct(leasedShare)}</span>
            <span className="sp-fkpi__bar" aria-hidden="true">
              <span className="sp-fkpi__bar-fill" style={{ width: `${Math.min(100, leasedShare * 100)}%` }} />
            </span>
            <span className="sp-fkpi__context">
              {sf(floor.leased)} of {sf(floor.leasable)}
            </span>
          </dd>
        </div>
        <div className="sp-fkpi">
          <dt>Available</dt>
          <dd>
            <span className="sp-fkpi__value">{sf(floor.available)}</span>
            <span className="sp-fkpi__context">
              {num(direct)}{'\u00a0'}direct · {num(sublease)}{'\u00a0'}sublease
            </span>
          </dd>
        </div>
        <div className="sp-fkpi">
          <dt>Largest contiguous</dt>
          <dd>
            <span className="sp-fkpi__value">{sf(floor.maxContiguous)}</span>
            <span className="sp-fkpi__context">{floor.maxContiguous > 0 ? 'direct, available now' : 'no direct space now'}</span>
          </dd>
        </div>
        <div className="sp-fkpi">
          <dt>Next expiry</dt>
          <dd>
            {next && next.lease && next.endDate && next.monthsToExpiry !== null ? (
              <>
                <span className="sp-fkpi__value">{tenantLabel(next.lease, safe)}</span>
                <span className="sp-fkpi__context">
                  {fmtDate(next.endDate)} · {fmtMonths(next.monthsToExpiry).replace(/ /g, '\u00a0')}
                </span>
        
    </>
          ) : (
            <span className="sp-fkpi__value sp-fkpi__value--muted">None dated</span>
          )}
        </dd>
      </div>
    </dl>
    {floor.overAllocatedBy > 0 && (
      <Chip tone="error" icon="warning" className="sp-floor__warn" title="Leases and availabilities add up to more than the leasable area; occupancy is capped at 100%.">
        Over-allocated by {sf(floor.overAllocatedBy)}
      </Chip>
    )}
    <FloorLists floor={floor} model={model} state={state} patch={patch} />
    </>
  );
}
