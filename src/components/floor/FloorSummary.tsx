import type { FloorView as FloorViewModel } from '../../domain/derive';
import { DotJoin } from '../hero/DotJoin';
import { fmtDate, fmtMonths, fmtMonthYearShort } from '../../domain/dates';
import { num, pct, sf } from '../../domain/format';
import { canShowIssues, canShowLeaseTerm, canShowRecordActions, tenantLabel } from '../../domain/safe';
import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import { useRecordAction } from '../inspector/Actions';
import { Button, Chip } from '../ui';
import { FloorLists } from './FloorLists';
import { callTarget, comingText, floorComing, largestNow, nextExpiry } from './floorData';

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
  // The largest block today: direct, else sublet (Floor 7 has only sublease space), else none.
  const largest = largestNow(floor);
  return (
    <>
      <dl className="sp-fkpis">
        <div className="sp-fkpi sp-fkpi--wide">
          <dt>Leased</dt>
          <dd>
            <span className="sp-fkpi__value sp-nb">{pct(leasedShare)}</span>
            <span className="sp-fkpi__bar" aria-hidden="true">
              <span className="sp-fkpi__bar-fill" style={{ width: `${Math.min(100, leasedShare * 100)}%` }} />
            </span>
            <span className="sp-fkpi__context">
              <span className="sp-nb">{sf(floor.leased)}</span> <span className="sp-nb">of {sf(floor.leasable)}</span>
            </span>
          </dd>
        </div>
        <div className="sp-fkpi">
          <dt>Available</dt>
          <dd>
            <span className="sp-fkpi__value sp-nb">{sf(floor.available)}</span>
            {(floor.available > 0 || !coming) && (
              <span className="sp-fkpi__context">
                {/* Only the kinds the floor has ("4,000 direct", not "4,000 direct · 0 sublease"); a line never starts with "·". */}
                <DotJoin parts={sublease && !direct ? [`${num(sublease)}\u00a0sublease`] : sublease ? [`${num(direct)}\u00a0direct`, `${num(sublease)}\u00a0sublease`] : [`${num(direct)}\u00a0direct`]} />
              </span>
            )}
            {coming && <span className="sp-fkpi__context">{comingText(coming)}</span>}
          </dd>
        </div>
        <div className="sp-fkpi">
          <dt>Largest contiguous</dt>
          <dd>
            <span className="sp-fkpi__value sp-nb">{sf(largest.size)}</span>
            <span className="sp-fkpi__context">
              {largest.kind ? `${largest.kind}, available now` : coming?.from ? `no direct space until ${fmtMonthYearShort(coming.from)}` : 'no direct space now'}
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
                    <span className="sp-nb">{fmtDate(next.endDate)}</span> <span className="sp-nb">· {fmtMonths(next.monthsToExpiry).replace(/ /g, ' ')}</span>
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
          <Button size="sm" icon="plus" aria-label={`New deal on ${name}`} title={`New deal on ${name}`} onClick={() => run('new-deal', name)}>
            New deal
          </Button>
          <Button size="sm" icon="plus" onClick={() => run('new-availability', name)}>
            Create availability
          </Button>
          {call && (
            <Button
              size="sm"
              icon="phone"
              aria-label={`Log call with ${call.lease.tenant} (${call.reason})`}
              title={`${call.lease.tenant}: ${call.why} on ${name}`}
              onClick={() => run('log-call', `Lease ${call.lease.id} (${call.lease.tenant})`)}
            >
              Log call · {call.lease.tenant}
            </Button>
          )}
        </div>
      )}
      <FloorLists floor={floor} model={model} state={state} patch={patch} />
    </>
  );
}
