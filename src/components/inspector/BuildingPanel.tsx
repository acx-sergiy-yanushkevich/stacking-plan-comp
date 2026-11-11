import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import type { Deal, DealStage } from '../../domain/types';
import { activeDeals, isLeaseKind } from '../../domain/derive';
import { stageRank } from '../../domain/lenses';
import { fmtDate, fmtMonthYear } from '../../domain/dates';
import { num, plural, sf } from '../../domain/format';
import type { Change } from '../../domain/types';
import { comingSupply } from '../../domain/kpis';
import { canShowActivity, canShowDeals, canShowInPlaceRent, canShowIssues, canShowRollover, canShowTenantRisk, listingVisible } from '../../domain/safe';
import { Button, Chip, Icon } from '../ui';
import { selectSegment, toggleBucket, type Patch } from '../plan/actions';
import { RolloverChart } from './RolloverChart';
import { Section, StageChip, wholeDates } from './parts';

export interface BuildingPanelProps {
  model: PlanModel;
  state: PlanState;
  patch: Patch;
}

const STAGES: DealStage[] = ['Tour', 'Proposal', 'LOI', 'Lease Out'];

/** Prospect-safe wording for a changed field: what happened, never the values. */
function safeChangeText(field: string): string {
  switch (field) {
    case 'Record created':
      return 'New availability listed';
    case 'Rent High':
    case 'Rent Low':
      return 'Asking rent updated';
    case 'Status':
      return 'Listing status updated';
    case 'Available From':
      return 'Availability date updated';
    default:
      return `${field} updated`;
  }
}

export function BuildingPanel({ model, state, patch }: BuildingPanelProps) {
  const { floors, roll, kpis, counts, changes, safe, asOf } = model;
  const segments = floors.flatMap((f) => f.segments);
  // Quiet listings are left out of what a prospect is told is coming.
  const coming = comingSupply(segments, asOf, safe);

  // Field history is CRM activity. A prospect sees listing news only (new space, a rent or date change
  // on a published listing), worded without values, record names or authors.
  const fullHistory = canShowActivity(safe);
  const onQuietListing = (c: Change) => {
    const seg = c.segKey ? model.segIndex.get(c.segKey) : undefined;
    const listing = [seg?.availability, seg?.marketed].find((a) => a && c.recordLabel.includes(a.suite));
    return !!listing && !listingVisible(listing, safe);
  };
  const history = fullHistory ? changes : changes.filter((c) => c.recordType === 'Availability' && !onQuietListing(c));

  // At risk: holdover and month-to-month leases, counted once per lease.
  const risk = (kind: 'holdover' | 'mtm') => {
    const segs = segments.filter((s) => s.kind === kind && s.lease);
    return { sf: segs.reduce((t, s) => t + s.size, 0), leases: new Set(segs.map((s) => s.lease!.id)).size };
  };
  const holdover = risk('holdover');
  const mtm = risk('mtm');
  const openRisk = () => patch({ window: 'risk', mode: 'worklist' });

  // Pipeline by stage, with the same rule as the Pipeline KPI (computeKpis): live deals only (Lease Out
  // is a signed lease, not pipeline), each deal once, and SF in play counted once per suite and capped at
  // the suite, attributed to the most advanced stage on that suite. The stage rows therefore sum to the card.
  const seen = new Map<string, Deal>();
  const sfByStage = new Map<string, number>();
  let spaceSf = 0;
  for (const s of segments) {
    const lists = [s.availability?.deals, s.marketed?.deals, isLeaseKind(s.kind) || s.kind === 'committed' ? s.lease?.deals : undefined];
    const live: Deal[] = [];
    for (const list of lists) for (const d of activeDeals(list)) if (!seen.has(d.id)) { seen.set(d.id, d); live.push(d); }
    if (live.length) {
      spaceSf += s.size;
      const top = live.reduce((a, b) => (stageRank(b.stage) > stageRank(a.stage) ? b : a));
      sfByStage.set(top.stage, (sfByStage.get(top.stage) ?? 0) + Math.min(s.size, Math.max(...live.map((d) => d.size))));
    }
  }
  const byStage = STAGES.filter((stage) => stage !== 'Lease Out').map((stage) => {
    const deals = [...seen.values()].filter((d) => d.stage === stage);
    return { stage, count: deals.length, sf: sfByStage.get(stage) ?? 0 };
  });

  const activeBucket = state.bucket;
  const tail = roll.buckets.at(-1);
  const bucketNote = activeBucket !== null ? roll.buckets.find((b) => b.key === activeBucket) : null;

  return (
    <>
      {/* Rollover by period can be matched to suites by their RSF: a prospect sees none of it (domain/safe.ts, rule 2). */}
      {canShowRollover(safe) && tail ? (
        <Section
          title="Rollover"
          aside={
            bucketNote ? (
              <Chip tone="brand" selected onClick={() => toggleBucket(patch, state.bucket, activeBucket!)} aria-label={`Clear the ${bucketNote.label} filter`} icon="close">
                {bucketNote.label}
              </Chip>
            ) : undefined
          }
        >
          <RolloverChart
            buckets={roll.buckets}
            atRisk={roll.atRisk}
            atRiskLeases={holdover.leases + mtm.leases}
            activeBucket={activeBucket}
            onBucket={(key) => key !== null && toggleBucket(patch, state.bucket, key)}
            onAtRisk={openRisk}
            showRisk={canShowTenantRisk(safe)}
          />
          <p className="sp-ins__note">
            Lease SF ending in rolling 12-month periods from {wholeDates(fmtDate(asOf))}; “{tail.label}” collects everything later. Click a bar to highlight those leases in the plan.
          </p>
          {roll.overAllocated.length > 0 && canShowIssues(safe) && (
            <p className="sp-ins__note sp-ins__warn">
              {roll.overAllocated.map((o) => `${o.floor} is over-allocated by ${sf(o.sf)}`).join('; ')}: periods use recorded SF, so they can exceed the leasable area; leased is capped at {num(model.kpis.leased)} SF.
            </p>
          )}
        </Section>
      ) : null}

      {!canShowTenantRisk(safe) ? (
        <Section title="Lease terms">
          <p className="sp-ins__explain">Lease dates, rollover by period and tenant risk are withheld in prospect-safe mode.</p>
        </Section>
      ) : (
      <Section title="At risk">
        <ul className="sp-ins__list">
          {(
            [
              ['Holdover', holdover, 'Past expiration, no termination recorded'],
              ['Month-to-month', mtm, 'No expiration date on the lease'],
            ] as const
          ).map(([label, r, hint]) => (
            <li key={label}>
              <button type="button" className="sp-ins__row" onClick={openRisk} disabled={r.sf === 0} title={hint}>
                <div className="sp-ins__row-main">
                  <div className="sp-ins__row-title">
                    <span>{label}</span>
                  </div>
                  <div className="sp-ins__row-meta">
                    <span>{r.sf > 0 ? plural(r.leases, 'lease') : 'None'}</span>
                  </div>
                </div>
                <div className="sp-ins__row-end">
                  <span className="sp-ins__row-value">{r.sf > 0 ? sf(r.sf) : '—'}</span>
                </div>
                {r.sf > 0 && <Icon name="chevron-right" size={14} />}
              </button>
            </li>
          ))}
        </ul>
      </Section>
      )}

      <Section title="Coming supply">
        <ul className="sp-ins__list">
          <li>
            <div className="sp-ins__row">
              <div className="sp-ins__row-main">
                <div className="sp-ins__row-title">
                  <span>Occupied, marketed for later</span>
                </div>
                <div className="sp-ins__row-meta">
                  <span>{coming.sf > 0 && coming.from ? `From ${fmtMonthYear(coming.from)}` : 'Nothing marketed ahead'}</span>
                </div>
              </div>
              <div className="sp-ins__row-end">
                <span className="sp-ins__row-value">{coming.sf > 0 ? sf(coming.sf) : '—'}</span>
              </div>
            </div>
          </li>
          <li>
            <div className="sp-ins__row">
              <div className="sp-ins__row-main">
                <div className="sp-ins__row-title">
                  <span>Committed</span>
                </div>
                <div className="sp-ins__row-meta">
                  <span>Signed, not in</span>
                </div>
              </div>
              <div className="sp-ins__row-end">
                <span className="sp-ins__row-value">{kpis.committed > 0 ? sf(kpis.committed) : '—'}</span>
              </div>
            </div>
          </li>
        </ul>
      </Section>

      {canShowInPlaceRent(safe) && (
      <Section title="In-place rent">
        {kpis.rentByType.length === 0 ? (
          <p className="sp-ins__explain">No rents on record.</p>
        ) : (
          <ul className="sp-ins__list">
            {kpis.rentByType.map((r) => (
              <li key={r.type}>
                <div className="sp-ins__row" title="Average in-place rent, each lease weighted by its recorded SF; confidential leases excluded">
                  <div className="sp-ins__row-main">
                    <div className="sp-ins__row-title">
                      <span>{r.type}</span>
                    </div>
                    <div className="sp-ins__row-meta">
                      <span>{sf(r.sf)} on record</span>
                    </div>
                  </div>
                  <div className="sp-ins__row-end">
                    <span className="sp-ins__row-value">${r.avg.toFixed(2)}/SF/yr</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="sp-ins__note">
          Annualised and weighted by each lease’s recorded SF, so the SF beside a type is the sum of its rent-roll rows{roll.overAllocated.length > 0 ? ' (the over-allocation cap on leased SF is not applied)' : ''}. Confidential leases excluded; never blended across lease types.
        </p>
      </Section>
      )}

      <Section title="Pipeline by stage">
        {!canShowDeals(safe) ? (
          <p className="sp-ins__explain">Deal activity is withheld in prospect-safe mode.</p>
        ) : (
        <>
        <p className="sp-ins__explain">
          {plural(kpis.pipeline.deals, 'live deal')} · {num(kpis.pipeline.sf)} SF requested on {num(spaceSf)} SF of space · {kpis.pipeline.onVacancy} on vacancies. Requested SF counts each space once, at its most advanced stage, capped at the space.
        </p>
        <ul className="sp-ins__list">
          {byStage.map((row) => (
            <li key={row.stage}>
              <button type="button" className="sp-ins__row" onClick={() => patch({ lens: 'deals' })} aria-pressed={state.lens === 'deals'} title="Colour the plan by deal stage">
                <StageChip stage={row.stage} />
                <div className="sp-ins__row-main">
                  <div className="sp-ins__row-title">
                    <span>{plural(row.count, 'deal')}</span>
                  </div>
                </div>
                <div className="sp-ins__row-end">
                  <span className="sp-ins__row-value">{row.sf > 0 ? sf(row.sf) : '—'}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
        </>
        )}
      </Section>

      {canShowIssues(safe) && (
      <Section title="Data issues" aside={<Button size="sm" variant="ghost" iconRight="chevron-right" onClick={() => patch({ mode: 'issues' })}>Review issues</Button>}>
        <div className="sp-ins__counts">
          <Chip tone={counts.error ? 'error' : 'neutral'} icon="warning" count={counts.error}>
            Errors
          </Chip>
          <Chip tone={counts.warning ? 'warn' : 'neutral'} icon="warning" count={counts.warning}>
            Warnings
          </Chip>
          <Chip tone="neutral" icon="info" count={counts.info}>
            Info
          </Chip>
        </div>
      </Section>
      )}

      <Section title="Recent changes">
        {history.length === 0 ? (
          <p className="sp-ins__explain">{fullHistory ? 'No record changes in the last 30 days.' : 'No listing changes in the last 30 days.'}</p>
        ) : (
          <ul className="sp-ins__list">
            {history.slice(0, 5).map((c) => {
              const who = fullHistory ? c.recordLabel : c.recordType;
              const what = !fullHistory ? safeChangeText(c.field) : c.field === 'Record created' ? 'Record created' : `${c.field}: ${c.from ?? '—'} → ${c.to ?? '—'}`;
              const body = (
                <>
                  <div className="sp-ins__row-main">
                    <div className="sp-ins__row-title">
                      <span>{who}</span>
                      {fullHistory && c.recordType !== 'Lease' && <span className="sp-ins__tag">{c.recordType}</span>}
                    </div>
                    <div className="sp-ins__row-meta">
                      <span>
                        {fmtDate(c.at).replace(/, \d{4}$/, '')}{fullHistory && ` · ${c.by}`}
                      </span>
                    </div>
                    <div className="sp-ins__row-meta">
                      <span>{what}</span>
                    </div>
                  </div>
                  {c.segKey && <Icon name="chevron-right" size={14} />}
                </>
              );
              return (
                <li key={c.id}>
                  {c.segKey ? (
                    <button type="button" className="sp-ins__row" onClick={() => selectSegment(patch, c.segKey!)} title="Show this block">
                      {body}
                    </button>
                  ) : (
                    <div className="sp-ins__row">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {history.length > 5 && <p className="sp-ins__note">{num(history.length - 5)} more in the last 30 days.</p>}
      </Section>
    </>
  );
}
