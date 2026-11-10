import type { PlanModel } from '../../model/usePlanModel';
import type { PlanState } from '../../state/planState';
import type { Deal, DealStage } from '../../domain/types';
import { activeDeals, isLeaseKind } from '../../domain/derive';
import { stageRank } from '../../domain/lenses';
import { fmtDate, fmtMonthYear } from '../../domain/dates';
import { num, plural, sf } from '../../domain/format';
import { Button, Chip, Icon } from '../ui';
import { selectSegment, toggleBucket, type Patch } from '../plan/actions';
import { RolloverChart } from './RolloverChart';
import { Section, StageChip } from './parts';

export interface BuildingPanelProps {
  model: PlanModel;
  state: PlanState;
  patch: Patch;
}

const STAGES: DealStage[] = ['Tour', 'Proposal', 'LOI', 'Lease Out'];

export function BuildingPanel({ model, state, patch }: BuildingPanelProps) {
  const { floors, roll, kpis, counts, changes, safe, asOf } = model;
  const segments = floors.flatMap((f) => f.segments);

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
  for (const s of segments) {
    const lists = [s.availability?.deals, s.marketed?.deals, isLeaseKind(s.kind) || s.kind === 'committed' ? s.lease?.deals : undefined];
    const live: Deal[] = [];
    for (const list of lists) for (const d of activeDeals(list)) if (!seen.has(d.id)) { seen.set(d.id, d); live.push(d); }
    if (live.length) {
      const top = live.reduce((a, b) => (stageRank(b.stage) > stageRank(a.stage) ? b : a));
      sfByStage.set(top.stage, (sfByStage.get(top.stage) ?? 0) + Math.min(s.size, Math.max(...live.map((d) => d.size))));
    }
  }
  const byStage = STAGES.filter((stage) => stage !== 'Lease Out').map((stage) => {
    const deals = [...seen.values()].filter((d) => d.stage === stage);
    return { stage, count: deals.length, sf: sfByStage.get(stage) ?? 0 };
  });

  const activeBucket = state.bucket;
  const tail = roll.buckets[roll.buckets.length - 1];
  const bucketNote = activeBucket !== null ? roll.buckets.find((b) => b.key === activeBucket) : null;

  return (
    <>
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
          safe={safe}
        />
        <p className="sp-ins__note">
          Lease SF ending in rolling 12-month periods from {fmtDate(asOf)}; “{tail.label}” collects everything later. Click a bar to highlight those leases in the plan.
        </p>
        {roll.overAllocated.length > 0 && !safe && (
          <p className="sp-ins__note sp-ins__warn">
            {roll.overAllocated.map((o) => `${o.floor} is over-allocated by ${sf(o.sf)}`).join('; ')}: lease SF is shown as recorded, so the periods can exceed the leasable area.
          </p>
        )}
      </Section>

      <Section title="At risk">
        {safe ? (
          <p className="sp-ins__explain">Tenant risk is withheld in prospect-safe mode.</p>
        ) : (
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
        )}
      </Section>

      <Section title="Coming supply">
        <ul className="sp-ins__list">
          <li>
            <div className="sp-ins__row">
              <div className="sp-ins__row-main">
                <div className="sp-ins__row-title">
                  <span>Occupied, marketed for later</span>
                </div>
                <div className="sp-ins__row-meta">
                  <span>{kpis.comingAvailable.sf > 0 && kpis.comingAvailable.from ? `From ${fmtMonthYear(kpis.comingAvailable.from)}` : 'Nothing marketed ahead'}</span>
                </div>
              </div>
              <div className="sp-ins__row-end">
                <span className="sp-ins__row-value">{kpis.comingAvailable.sf > 0 ? sf(kpis.comingAvailable.sf) : '—'}</span>
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

      {!safe && (
      <Section title="In-place rent">
        {model.kpis.rentByType.length === 0 ? (
          <p className="sp-ins__explain">No rents on record.</p>
        ) : (
          <ul className="sp-ins__list">
            {model.kpis.rentByType.map((r) => (
              <li key={r.type}>
                <div className="sp-ins__row" title="SF-weighted average of in-place rents, excluding confidential leases">
                  <div className="sp-ins__row-main">
                    <div className="sp-ins__row-title">
                      <span>{r.type}</span>
                    </div>
                    <div className="sp-ins__row-meta">
                      <span>{sf(Math.round(r.sf))} leased</span>
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
        <p className="sp-ins__note">SF-weighted, annualised; confidential leases excluded. Never blended across lease types.</p>
      </Section>
      )}

      <Section title="Pipeline by stage">
        {safe ? (
          <p className="sp-ins__explain">Deal activity is withheld in prospect-safe mode.</p>
        ) : (
        <>
        <p className="sp-ins__explain">
          {plural(model.kpis.pipeline.deals, 'live deal')} · {num(model.kpis.pipeline.sf)} SF in play · {model.kpis.pipeline.onVacancy} on vacancies
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
                {!safe && (
                  <div className="sp-ins__row-end">
                    <span className="sp-ins__row-value">{row.sf > 0 ? sf(row.sf) : '—'}</span>
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
        </>
        )}
      </Section>

      {!safe && (
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
        {changes.length === 0 ? (
          <p className="sp-ins__explain">No record changes in the last 30 days.</p>
        ) : (
          <ul className="sp-ins__list">
            {changes.filter((c) => !safe || c.recordType === 'Availability').slice(0, 5).map((c) => {
              const who = safe ? c.recordType : c.recordLabel;
              const what = safe ? `${c.field} changed` : `${c.field}: ${c.from ?? '—'} → ${c.to ?? '—'}`;
              const body = (
                <>
                  <div className="sp-ins__row-main">
                    <div className="sp-ins__row-title">
                      <span>{who}</span>
                      {!safe && c.recordType !== 'Lease' && <span className="sp-ins__tag">{c.recordType}</span>}
                    </div>
                    <div className="sp-ins__row-meta">
                      <span>
                        {fmtDate(c.at).replace(/, \d{4}$/, '')}{!safe && ` · ${c.by}`}
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
        {changes.length > 5 && <p className="sp-ins__note">{num(changes.length - 5)} more in the last 30 days.</p>}
      </Section>
    </>
  );
}
