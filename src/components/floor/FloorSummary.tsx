import type { FloorView as FloorViewModel } from '../../domain/derive';
import { fmtDate, fmtMonths, fmtMonthYearShort } from '../../domain/dates';
import { num, pct, sf } from '../../domain/format';
import { canShowIssues, canShowLeaseTerm, canShowRecordActions, tenantLabel } from '../../domain/safe';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { useRecordAction } from '../inspector/Actions';
import { Button, Chip } from '../ui';
import { FloorLists } from './FloorLists';
import { callTarget, comingText, floorComing, nextExpiry } from './floorData';

export interface FloorSummaryProps {
  floor: FloorViewModel;
  model: PlanModel;
  state: PlanState;
  patch: (p: Partial<PlanState>) => void;
}

/** One floor in numbers and lists: leased, available, largest block, next expiry, record actions, then suites, deals, inquiries and issues. */
export function FloorSummary({ floor, model, state, patch }: FloorSummaryProps) {
  const { safe, asOf } = model;
  const run = useRecordAction();
  const name = floor.floor.name;
  const leasedShare = floor.leasable > 0 ? floor.leased / floor.leasable : 0;
  const direct = floor.segments.filter((s) => s.kind === 'available' && !s.availableFrom).reduce((t, s) => t + s.size, 0);
  const sublease = floor.segments.filter((s) => s.kind === 'sublease').reduce((t, s) => t + s.size, 0);
  // Occupied space already on the market for a later date: a floor with nothing vacant is not a floor with nothing to offer.
  const coming = floorComing(floor, asOf, safe);
  const next = nextExpiry(floor);
  // The call goes to the tenant who most needs it: a holdover or month-to-month tenant before the nearest expiry.
  const call = callTarget(floor);
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
            {(floor.available > 0 || !coming) && (
              <span className="sp-fkpi__context">
                {num(direct)}{' '}direct · {num(sublease)}{' '}sublease
              </span>
            )}
            {coming && <span className="sp-fkpi__context">{comingText(coming)}</span>}
          </dd>
        </div>
        <div className="sp-fkpi">
          <dt>Largest contiguous</dt>
          <dd>
            <span className="sp-fkpi__value">{sf(floor.maxContiguous)}</span>
            <span className="sp-fkpi__context">
              {floor.maxContiguous > 0 ? 'direct, available now' : coming?.from ? `no direct space until ${fmtMonthYearShort(coming.from)}` : 'no direct space now'}
            </span>
          </dd>
        </div>
        {/* Prospect-safe shows no lease term, so there is no "next expiry" to name. */}
        {canShowLeaseTerm(safe) && (
          <div className="sp-fkpi">
            <dt>Next expiry</dt>
            <dd>
              {next && next.lease && next.endDate && next.monthsToExpiry !== null ? (
                <>
                  <span className="sp-fkpi__value">{tenantLabel(next.lease, safe)}</span>
                  <span className="sp-fkpi__context">
                    {fmtDate(next.endDate)} · {fmtMonths(next.monthsToExpiry).replace(/ /g, ' ')}
                  </span>
                </>
              ) : (
                <span className="sp-fkpi__value sp-fkpi__value--muted">None dated</span>
              )}
            </dd>
          </div>
        )}
      </dl>
      {floor.overAllocatedBy > 0 && canShowIssues(safe) && (
        <Chip tone="error" icon="warning" className="sp-floor__warn" title="Leases and availabilities add up to more than the leasable area; occupancy is capped at 100%.">
          Over-allocated by {sf(floor.overAllocatedBy)}
        </Chip>
      )}
      {canShowRecordActions(safe) && (
        <div className="sp-factions" role="group" aria-label={`${name} record actions`}>
          <Button size="sm" icon="plus" onClick={() => run('new-deal', name)}>
            New deal on {name}
          </Button>
          <Button size="sm" icon="plus" onClick={() => run('new-availability', name)}>
            Create availability
          </Button>
          {call && (
            <Button size="sm" icon="phone" title={`${call.lease.tenant}: ${call.why} on ${name}`} onClick={() => run('log-call', `Lease ${call.lease.id} (${call.lease.tenant})`)}>
              Log call with {call.lease.tenant} ({call.reason})
            </Button>
          )}
        </div>
      )}
      <FloorLists floor={floor} model={model} state={state} patch={patch} />
    </>
  );
}
