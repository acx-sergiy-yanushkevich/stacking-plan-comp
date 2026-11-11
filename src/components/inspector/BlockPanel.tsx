import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import type { Availability } from '../../domain/types';
import { isLeaseKind, leaseFloors, type Segment } from '../../domain/derive';
import { daysBetween, fmtDate, fmtMonths } from '../../domain/dates';
import { matchingInquiries } from '../../domain/finder';
import { num, rate, rateRange, sf, usd, usd0 } from '../../domain/format';
import { STALE_DAYS } from '../../domain/issues';
import {
  brokerLabel,
  canShowActivity,
  canShowInPlaceRent,
  canShowDeals,
  canShowIssues,
  canShowListingStatus,
  canShowRecordActions,
  canShowTenant,
  contactLabel,
  marketedFor,
  rentVisible,
  tenantLabel,
  leaseDatesHidden,
  termHidden,
  visibleDeals,
  visibleInquiries,
} from '../../domain/safe';
import { Chip } from '../ui';
import { selectSegment, type Patch } from '../plan/actions';
import { kindLabel } from '../plan/segmentText';
import { Actions, type ActionItem } from './Actions';
import { DealList, Facts, Section, dedupeDeals, touchText } from './parts';
import { OptionSection } from './OptionSection';

export interface BlockPanelProps {
  seg: Segment;
  model: PlanModel;
  state: PlanState;
  patch: Patch;
}

function Verified({ at, today, safe }: { at: string; today: string; safe: boolean }) {
  // A stale record is a data issue, flagged for the people who maintain the plan.
  const stale = canShowIssues(safe) && daysBetween(at, today) > STALE_DAYS;
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
  // Field history for this suite's own records (lease, availability), newest first.
  const changesFor = property.history.filter((c) => c.segKey === seg.key || (lease && c.recordType === 'Lease' && c.recordLabel.includes(lease.tenant)) || (a && c.recordType === 'Availability' && c.recordLabel.includes(a.suite))).sort((x, y) => (x.at < y.at ? 1 : -1));

  // Lease facts
  const rentText = lease ? (rentVisible(lease, safe) && lease.rate !== null ? rate(lease.rate, lease.rateUnit, lease.leaseType) : !canShowInPlaceRent(safe) ? 'Hidden' : lease.confidential ? 'Confidential' : 'Not on record') : undefined;
  const remaining = (() => {
    if (!lease) return undefined;
    // Prospect-safe: no date of any lease, in place or signed.
    if (leaseDatesHidden(seg.kind, safe)) return undefined;
    if (seg.kind === 'mtm') return 'Month-to-month';
    if (seg.kind === 'holdover') return `Holdover · expired ${seg.endDate ? fmtDate(seg.endDate) : ''}`;
    if (seg.kind === 'committed') return `Moves in ${fmtDate(lease.commencement)}`;
    if (seg.kind === 'projected') return `Vacated ${seg.endDate ? fmtDate(seg.endDate) : ''}`;
    if (seg.monthsToExpiry !== null) return seg.kind === 'sublease' && seg.headMonths != null ? `${fmtMonths(seg.headMonths)} on the head lease · sublease ${fmtMonths(seg.monthsToExpiry)}` : fmtMonths(seg.monthsToExpiry);
    return undefined;
  })();
  const otherFloors = lease ? leaseFloors(property, lease).filter((f) => f.id !== seg.floorId) : [];

  // The listing on an occupied suite; a quiet one is not shown to a prospect.
  const marketed = marketedFor(seg, safe);

  // Deals on this block (lease renewals count only while the lease is in place or committed); none in prospect-safe mode.
  const deals = visibleDeals(
    dedupeDeals([
      carriesLease && seg.kind !== 'projected' ? lease?.deals : undefined,
      a?.deals,
      seg.marketed?.deals,
      seg.kind === 'committed' ? seg.origin?.deals : undefined,
    ]).filter((d) => d.stage !== 'Lease Out' || seg.kind === 'committed'),
    safe,
  );

  // Inquiries a vacancy could satisfy; none in prospect-safe mode.
  const inquiries = visibleInquiries(
    a && a.kind === 'Lease' ? matchingInquiries(property.inquiries, { size: a.size, divisible: a.divisible, minDivisible: a.minDivisible, from: seg.availableFrom ?? a.availableFrom }, asOf) : [],
    safe,
  );

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
    actions.push({ action: 'open-availability', record: rec, primary: true }, { action: 'create-listing', record: rec }, { action: 'new-deal', record: rec }, { action: 'log-call', record: rec });
  } else if (seg.kind === 'unmarketed') {
    if (seg.suspect) actions.push({ action: 'add-unit', record: `Lease ${seg.suspect.id}`, primary: true });
    actions.push({ action: 'new-availability', record: `${sf(seg.size)} on ${floorName}`, primary: !seg.suspect });
  }

  return (
    <>
      {model.option && <OptionSection option={model.option} model={model} current={seg.key} patch={patch} />}
      {carriesLease && lease && (
        <Section title={seg.kind === 'committed' ? 'Signed lease' : seg.kind === 'projected' ? 'Previous lease' : 'Lease'}>
          <Facts
            items={[
              canShowTenant(safe) && ['Tenant', <strong key="t">{lease.tenant}</strong>],
              ['Contact', contactLabel(lease.tenantContact, safe)],
              canShowTenant(safe) && ['Industry', lease.industry],
              // Prospect-safe: no lease shows a date. One in place says "Leased", one signed says "Signed, not in", and nothing more.
              leaseDatesHidden(seg.kind, safe) ? ['Status', termHidden(seg.kind, safe) ? 'Leased' : 'Signed, not in'] : ['Term', `${fmtDate(lease.commencement)} – ${seg.endDate ? fmtDate(seg.endDate) : 'open (MTM)'}`],
              ['Remaining', remaining],
              ['Rent', rentText],
              ['Broker', brokerLabel(lease.owner, safe)],
              canShowActivity(safe) && ['Last touch', touchText(lease.lastTouch)],
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
              canShowActivity(safe) && ['Verified', <Verified key="v" at={lease.verifiedAt} today={today} safe={safe} />],
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
              canShowListingStatus(safe) && ['Listing', a.published === false ? 'Quiet · not published' : 'Published'],
              ['Available', seg.availableFrom ? fmtDate(seg.availableFrom) : a.availableFrom && a.availableFrom > asOf ? fmtDate(a.availableFrom) : 'Now'],
              a.sublease && a.subleaseExpiration ? ['Sublease thru', fmtDate(a.subleaseExpiration)] : null,
              ['Asking', rentVisible(a, safe) && a.rentHigh > 0 ? rateRange(a.rentLow, a.rentHigh, a.rateUnit, a.leaseType) : 'Hidden'],
              ['Divisible', a.divisible ? (a.minDivisible ? `Yes · min ${sf(a.minDivisible)}` : 'Yes') : 'No'],
              canShowActivity(safe) && ['Verified', <Verified key="v" at={a.verifiedAt} today={today} safe={safe} />],
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
              ['Asking price', rentVisible(a, safe) && a.askingPrice ? usd0(a.askingPrice) : 'Hidden'],
              ['Per SF', rentVisible(a, safe) && a.askingPrice ? `${usd(a.askingPrice / seg.size)}/SF` : 'Hidden'],
              ['Size', sf(seg.size)],
              canShowActivity(safe) && ['Verified', <Verified key="v" at={a.verifiedAt} today={today} safe={safe} />],
            ]}
          />
        </Section>
      )}

      {canShowActivity(safe) && changesFor.length > 0 && (
        <Section title="Changes">
          <ul className="sp-ins__list">
            {changesFor.slice(0, 5).map((c) => (
              <li key={c.id} className="sp-ins__change">
                <div className="sp-ins__row-main">
                  <div className="sp-ins__row-title">
                    <span>{c.recordType === 'Lease' || c.recordType === 'Availability' ? c.field : `${c.recordLabel} · ${c.field}`}</span>
                    {c.recordType !== 'Lease' && <span className="sp-ins__tag">{c.recordType}</span>}
                  </div>
                  <div className="sp-ins__row-meta">
                    <span>{c.field === 'Record created' ? 'Record created' : c.from === null ? (c.field.startsWith('Linked') ? `Linked to ${c.to ?? '—'}` : `Set to ${c.to ?? '—'}`) : `${c.from} → ${c.to ?? '—'}`}</span>
                  </div>
                  <div className="sp-ins__row-meta">
                    <span>{fmtDate(c.at)}</span>
                    <span>{c.by}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {seg.kind === 'unmarketed' && !canShowIssues(safe) && (
        <Section title="Not available">
          <p className="sp-ins__p">
            <strong>{sf(seg.size)}</strong> on {floorName} is not on the market.
          </p>
        </Section>
      )}

      {seg.kind === 'unmarketed' && canShowIssues(safe) && (
        <Section title="Unaccounted area">
          <p className="sp-ins__p">
            <strong>{sf(seg.size)}</strong> of {floorName}’s leasable area has no lease or availability record.
          </p>
          {seg.suspect ? (
            <div className="sp-ins__card">
              <div className="sp-ins__card-title">Likely {seg.suspect.tenant}</div>
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

      {marketed && (
        <Section title={marketed.kind === 'Sale' ? 'Offered for sale' : 'Marketed for later'}>
          <div className="sp-ins__card">
            <Facts
              items={[
                ['Type', availabilityType(marketed)],
                marketed.kind === 'Lease' && ['Available from', marketed.availableFrom ? fmtDate(marketed.availableFrom) : 'Now'],
                canShowListingStatus(safe) && ['Listing', marketed.published === false ? 'Quiet · not published' : 'Published'],
                marketed.kind === 'Lease' && ['Asking', rentVisible(marketed, safe) && marketed.rentHigh > 0 ? rateRange(marketed.rentLow, marketed.rentHigh, marketed.rateUnit, marketed.leaseType) : 'Hidden'],
                marketed.kind === 'Sale' && ['Asking price', rentVisible(marketed, safe) && marketed.askingPrice ? usd0(marketed.askingPrice) : 'Hidden'],
                ['Size', sf(marketed.size)],
                marketed.kind === 'Lease' && ['Divisible', marketed.divisible ? (marketed.minDivisible ? `Yes · min ${sf(marketed.minDivisible)}` : 'Yes') : 'No'],
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
                      <span>{i.prospect}</span>
                    </div>
                    <div className="sp-ins__row-meta">
                      <span>
                        {num(i.minSize)}–{num(i.maxSize)} SF · by {fmtDate(i.neededBy)}
                      </span>
                      <span>{i.broker}</span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {canShowDeals(safe) && (deals.length > 0 || a || (carriesLease && seg.kind !== 'projected')) && (
        <Section title={`Deals${deals.length ? ` · ${deals.length}` : ''}`}>
          <DealList deals={deals} />
        </Section>
      )}

      {canShowRecordActions(safe) && (
        <Section title={`${kindLabel(seg.kind)} actions`} className="sp-ins__section--actions">
          <Actions items={actions} />
        </Section>
      )}
    </>
  );
}
