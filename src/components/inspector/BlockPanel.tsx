import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import type { Availability } from '../../domain/types';
import { isLeaseKind, leaseFloors, type Segment } from '../../domain/derive';
import { daysBetween, fmtDate, fmtMonths } from '../../domain/dates';
import { matchingInquiries } from '../../domain/finder';
import { num, rate, rateRange, sf, usd0, usdCompact } from '../../domain/format';
import { STALE_DAYS } from '../../domain/issues';
import { contactLabel, prospectLabel, rentVisible, tenantLabel } from '../../domain/safe';
import { Chip } from '../ui';
import { selectSegment, type Patch } from '../plan/actions';
import { kindLabel } from '../plan/segmentText';
import { Actions, type ActionItem } from './Actions';
import { DealList, Facts, Section, dedupeDeals, touchText } from './parts';

export interface BlockPanelProps {
  seg: Segment;
  model: PlanModel;
  state: PlanState;
  patch: Patch;
}

function Verified({ at, today }: { at: string; today: string }) {
  const stale = daysBetween(at, today) > STALE_DAYS;
  return (
    <span>
      {fmtDate(at)}
      {stale && (
        <>
          {' '}
          <Chip tone="warn" icon="clock">
            Stale
          </Chip>
        </>
      )}
    </span>
  );
}

function availabilityType(a: Availability): string {
  return a.kind === 'Sale' ? 'For sale' : a.sublease ? 'Sublease' : 'Direct';
}

export function BlockPanel({ seg, model, patch }: BlockPanelProps) {
  const { safe, asOf, today, property } = model;
  const lease = seg.lease;
  const a = seg.availability;
  const floorName = model.floors.find((f) => f.floor.id === seg.floorId)?.floor.name ?? seg.floorId;
  const carriesLease = lease && (isLeaseKind(seg.kind) || seg.kind === 'committed' || seg.kind === 'projected');
  const leaseRecord = lease ? `Lease ${lease.id}` : '';

  // Lease facts
  const rentText = lease ? (rentVisible(lease, safe) && lease.rate !== null ? rate(lease.rate, lease.rateUnit, lease.leaseType) : safe ? 'Hidden' : lease.confidential ? 'Confidential' : 'Not on record') : undefined;
  const remaining = (() => {
    if (!lease) return undefined;
    if (seg.kind === 'mtm') return 'Month-to-month';
    if (seg.kind === 'holdover') return `Holdover · expired ${seg.endDate ? fmtDate(seg.endDate) : ''}`;
    if (seg.kind === 'committed') return `Moves in ${fmtDate(lease.commencement)}`;
    if (seg.kind === 'projected') return `Vacated ${seg.endDate ? fmtDate(seg.endDate) : ''}`;
    if (seg.monthsToExpiry !== null) return seg.kind === 'sublease' && seg.headMonths != null ? `${fmtMonths(seg.headMonths)} on the head lease · sublease ${fmtMonths(seg.monthsToExpiry)}` : fmtMonths(seg.monthsToExpiry);
    return undefined;
  })();
  const otherFloors = lease ? leaseFloors(property, lease).filter((f) => f.id !== seg.floorId) : [];

  // Deals on this block (lease renewals count only while the lease is in place or committed).
  const deals = dedupeDeals([
    carriesLease && seg.kind !== 'projected' ? lease?.deals : undefined,
    a?.deals,
    seg.marketed?.deals,
    seg.kind === 'committed' ? seg.origin?.deals : undefined,
  ]).filter((d) => d.stage !== 'Lease Out' || seg.kind === 'committed');

  // Inquiries a vacancy could satisfy.
  const inquiries = a && a.kind === 'Lease' ? matchingInquiries(property.inquiries, { size: a.size, divisible: a.divisible, minDivisible: a.minDivisible, from: seg.availableFrom ?? a.availableFrom }, asOf) : [];

  // Footer actions
  const actions: ActionItem[] = [];
  if (carriesLease && lease) {
    actions.push({ action: 'open-lease', record: leaseRecord, primary: true });
    if (seg.kind !== 'projected') {
      actions.push({ action: 'new-deal', record: leaseRecord }, { action: 'log-call', record: leaseRecord });
      const nearEnd = seg.kind === 'holdover' || seg.kind === 'mtm' || (seg.monthsToExpiry !== null && seg.monthsToExpiry <= 24);
      if (nearEnd) actions.push({ action: 'start-renewal', record: leaseRecord });
    } else actions.push({ action: 'new-availability', record: `Suite ${seg.suite ?? ''} on ${floorName}` });
  } else if (a) {
    const rec = `Availability ${a.id}`;
    actions.push({ action: 'open-availability', record: rec, primary: true }, { action: 'new-deal', record: rec }, { action: 'log-call', record: rec });
  } else if (seg.kind === 'unmarketed') {
    if (seg.suspect) actions.push({ action: 'add-unit', record: `Lease ${seg.suspect.id}`, primary: true });
    actions.push({ action: 'new-availability', record: `${sf(seg.size)} on ${floorName}`, primary: !seg.suspect });
  }

  return (
    <>
      {carriesLease && lease && (
        <Section title={seg.kind === 'committed' ? 'Signed lease' : seg.kind === 'projected' ? 'Previous lease' : 'Lease'}>
          <Facts
            items={[
              ['Tenant', <strong key="t">{tenantLabel(lease, safe)}</strong>],
              ['Contact', contactLabel(lease.tenantContact, safe)],
              !safe && ['Industry', lease.industry],
              ['Term', `${fmtDate(lease.commencement)} – ${seg.endDate ? fmtDate(seg.endDate) : 'open (MTM)'}`],
              ['Remaining', remaining],
              ['Rent', rentText],
              !safe && ['Broker', lease.owner],
              !safe && ['Last touch', touchText(lease.lastTouch)],
              otherFloors.length > 0 && ['Total', `${sf(lease.units.reduce((s, u) => s + u.size, 0))} across ${otherFloors.length + 1} floors`],
              otherFloors.length > 0 && [
                'Also on',
                <span key="f" className="sp-ins__chips">
                  {otherFloors.map((f) => {
                    const unit = lease.units.find((u) => u.floorId === f.id);
                    return (
                      <Chip key={f.id} onClick={unit ? () => selectSegment(patch, unit.id) : undefined} icon="floor">
                        {f.name}
                      </Chip>
                    );
                  })}
                </span>,
              ],
              ['Verified', <Verified key="v" at={lease.verifiedAt} today={today} />],
            ]}
          />
        </Section>
      )}

      {seg.kind === 'available' && lease && (
        <Section title="Previously">
          <p className="sp-ins__p">
            {tenantLabel(lease, safe)} · lease ended {seg.endDate ? fmtDate(seg.endDate) : ''}
          </p>
        </Section>
      )}

      {a && a.kind === 'Lease' && (
        <Section title={seg.kind === 'sublease' ? 'Sublease availability' : 'Availability'}>
          <Facts
            items={[
              ['Type', availabilityType(a)],
              ['Status', a.status],
              ['Available', seg.availableFrom ? fmtDate(seg.availableFrom) : a.availableFrom && a.availableFrom > asOf ? fmtDate(a.availableFrom) : 'Now'],
              a.sublease && a.subleaseExpiration ? ['Sublease thru', fmtDate(a.subleaseExpiration)] : null,
              ['Asking', rentVisible(a, safe) && a.rentHigh > 0 ? rateRange(a.rentLow, a.rentHigh, a.rateUnit, a.leaseType) : 'Hidden'],
              ['Divisible', a.divisible ? (a.minDivisible ? `Yes · min ${sf(a.minDivisible)}` : 'Yes') : 'No'],
              ['Verified', <Verified key="v" at={a.verifiedAt} today={today} />],
            ]}
          />
        </Section>
      )}

      {seg.kind === 'forsale' && a && (
        <Section title="For sale">
          <Facts
            items={[
              ['Type', 'Condo unit'],
              ['Status', a.status],
              ['Asking price', rentVisible(a, safe) && a.askingPrice ? usdCompact(a.askingPrice) : 'Hidden'],
              ['Per SF', rentVisible(a, safe) && a.askingPrice ? `${usd0(Math.round(a.askingPrice / seg.size))}/SF` : 'Hidden'],
              ['Size', sf(seg.size)],
              ['Verified', <Verified key="v" at={a.verifiedAt} today={today} />],
            ]}
          />
        </Section>
      )}

      {seg.kind === 'unmarketed' && (
        <Section title="Unaccounted area">
          <p className="sp-ins__p">
            <strong>{sf(seg.size)}</strong> of {floorName}’s leasable area has no lease or availability record.
          </p>
          {seg.suspect ? (
            <div className="sp-ins__card">
              <div className="sp-ins__card-title">Likely {tenantLabel(seg.suspect, safe)}</div>
              <p className="sp-ins__explain">
                This lease is on {floorName} but has no Unit records, so it cannot be drawn. Add its unit to place it.
              </p>
            </div>
          ) : (
            <p className="sp-ins__explain">Create an availability if this space is on the market, or check the floor’s leasable area.</p>
          )}
        </Section>
      )}

      {seg.kind === 'projected' && (
        <Section title="Projected vacancy">
          <p className="sp-ins__p">
            {lease ? `${tenantLabel(lease, safe)} leaves` : 'The tenant leaves'} {seg.endDate ? fmtDate(seg.endDate) : ''} and nothing replaces this space on {fmtDate(asOf)}.
          </p>
          <p className="sp-ins__explain">No availability record yet.</p>
        </Section>
      )}

      {seg.marketed && (
        <Section title={seg.marketed.kind === 'Sale' ? 'Offered for sale' : 'Marketed for later'}>
          <div className="sp-ins__card">
            <Facts
              items={[
                ['Type', availabilityType(seg.marketed)],
                seg.marketed.kind === 'Lease' && ['Available from', seg.marketed.availableFrom ? fmtDate(seg.marketed.availableFrom) : 'Now'],
                seg.marketed.kind === 'Lease' && ['Asking', rentVisible(seg.marketed, safe) && seg.marketed.rentHigh > 0 ? rateRange(seg.marketed.rentLow, seg.marketed.rentHigh, seg.marketed.rateUnit, seg.marketed.leaseType) : 'Hidden'],
                seg.marketed.kind === 'Sale' && ['Asking price', rentVisible(seg.marketed, safe) && seg.marketed.askingPrice ? usdCompact(seg.marketed.askingPrice) : 'Hidden'],
                ['Size', sf(seg.marketed.size)],
                seg.marketed.kind === 'Lease' && ['Divisible', seg.marketed.divisible ? (seg.marketed.minDivisible ? `Yes · min ${sf(seg.marketed.minDivisible)}` : 'Yes') : 'No'],
              ]}
            />
          </div>
        </Section>
      )}

      {seg.next && (
        <Section title="Coming next">
          <div className="sp-ins__card">
            <Facts
              items={[
                ['Tenant', <strong key="t">{tenantLabel(seg.next.lease, safe)}</strong>],
                ['Commences', fmtDate(seg.next.lease.commencement)],
                ['Expires', seg.next.lease.expiration ? fmtDate(seg.next.lease.expiration) : 'Open (MTM)'],
                ['Size', sf(seg.next.unit.size)],
              ]}
            />
          </div>
        </Section>
      )}

      {inquiries.length > 0 && (
        <Section title={`Inquiries that fit · ${inquiries.length}`}>
          <ul className="sp-ins__list">
            {inquiries.map((i) => (
              <li key={i.id}>
                <div className="sp-ins__row">
                  <div className="sp-ins__row-main">
                    <div className="sp-ins__row-title">
                      <span>{prospectLabel(i, safe)}</span>
                    </div>
                    <div className="sp-ins__row-meta">
                      <span>
                        {num(i.minSize)}–{num(i.maxSize)} SF · by {fmtDate(i.neededBy)}
                      </span>
                      {!safe && <span>· {i.broker}</span>}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(deals.length > 0 || a || (carriesLease && seg.kind !== 'projected')) && (
        <Section title={`Deals${deals.length ? ` · ${deals.length}` : ''}`}>
          <DealList deals={deals} safe={safe} />
        </Section>
      )}

      <Section title={`${kindLabel(seg.kind)} actions`} className="sp-ins__section--actions">
        {!safe && <Actions items={actions} />}
      </Section>
    </>
  );
}
