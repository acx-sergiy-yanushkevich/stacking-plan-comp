import { useEffect } from 'react';
import { WINDOW_LABEL, type PlanModel, type WorklistRow } from '../../model/usePlanModel';
import type { PlanState, WindowKey } from '../../state/planState';
import { daysBetween, fmtDate, fmtMonths, fmtMonthYearShort } from '../../domain/dates';
import { rentRollRows, toCsv } from '../../domain/exportCsv';
import { plural, rate, sf } from '../../domain/format';
import { brokerLabel, canShowActivity, canShowDeals, canShowInPlaceRent, canShowRecordActions, canShowTenantRisk, marketedFor, rentVisible, tenantLabel, termHidden } from '../../domain/safe';
import { download } from '../../lib/download';
import { Button, Chip, Icon } from '../ui';
import { selectSegment, type Patch } from '../plan/actions';
import { useRecordAction } from './Actions';
import { StageChip } from './parts';

export interface WorklistPanelProps {
  model: PlanModel;
  state: PlanState;
  patch: Patch;
}

const WINDOWS: WindowKey[] = ['risk', '90', '180', '12', '24'];

function endText(row: WorklistRow, safe: boolean): string | null {
  if (!row.seg.endDate) return null;
  if (termHidden(row.kind, safe)) return null;
  return `${row.kind === 'holdover' ? 'Expired' : 'Ends'} ${fmtDate(row.seg.endDate)}`;
}

function monthsLeft(row: WorklistRow, safe: boolean) {
  // A lease with no months left to state is month-to-month in all but name: withheld the same way.
  if (termHidden(row.kind, safe) || (row.months === null && !canShowTenantRisk(safe))) return <span className="sp-ins__row-value">—</span>;
  if (row.kind === 'holdover') return <Chip tone="error">Holdover</Chip>;
  if (row.kind === 'mtm' || row.months === null) return <Chip tone="error">MTM</Chip>;
  return <span className="sp-ins__row-value">{fmtMonths(row.months)}</span>;
}

export function WorklistPanel({ model, state, patch }: WorklistPanelProps) {
  const { safe, today } = model;
  // The at-risk window lists holdover and month-to-month tenants; a prospect gets the 12-month view instead.
  const showRisk = canShowTenantRisk(safe);
  const window: WindowKey = state.window === 'risk' && !showRisk ? '12' : (state.window ?? '12');
  const windows = showRisk ? WINDOWS : WINDOWS.filter((w) => w !== 'risk');
  const run = useRecordAction();

  useEffect(() => {
    if (state.mode === 'worklist' && state.window === null) patch({ window: '12' });
  }, [state.mode, state.window, patch]);

  const rows = model.worklist(window);
  const total = rows.reduce((t, r) => t + r.size, 0);

  const exportCsv = () => {
    const all = rentRollRows(model.property, model.floors, model.asOf, safe);
    // rentRollRows emits one row per non-gap segment in plan order; zip it back to segments to filter.
    const segs = model.floors.flatMap((f) => f.segments).filter((s) => s.kind !== 'unmarketed');
    const keep = new Set(rows.map((r) => r.segKey));
    const out = [all[0], ...all.slice(1).filter((_, i) => keep.has(segs[i]?.key))];
    download(new Blob([toCsv(out)], { type: 'text/csv;charset=utf-8' }), 'renewal-worklist.csv');
  };

  return (
    <>
      <div className="sp-ins__section">
        <div className="sp-ins__chips" role="group" aria-label="Window">
          {windows.map((w) => (
            <Chip key={w} selected={window === w} count={model.worklist(w).length} onClick={() => patch({ window: w })}>
              {WINDOW_LABEL[w]}
            </Chip>
          ))}
        </div>
        <p className="sp-ins__note">
          {window === 'risk' ? 'Holdover and month-to-month leases: no term protects this income.' : `Leases ending within ${WINDOW_LABEL[window]} of the as-of date, soonest first.${safe ? ' Prospect-safe: names, brokers and tenant risk withheld.' : ''}`}
        </p>
      </div>

      <div className="sp-ins__section">
        {rows.length === 0 ? (
          <div className="sp-empty">
            <Icon name="check" size={24} />
            <div className="sp-empty__title">Nothing ending in this window</div>
            <p>{showRisk ? 'Try a longer window or check At risk.' : 'Try a longer window.'}</p>
          </div>
        ) : (
          <ul className="sp-ins__list" aria-label={`${WINDOW_LABEL[window]} worklist`}>
            {rows.map((row) => {
              const lease = row.seg.lease!;
              const rent = rentVisible(lease, safe) && lease.rate !== null ? rate(lease.rate, lease.rateUnit, lease.leaseType) : canShowInPlaceRent(safe) && lease.confidential ? 'Confidential' : 'Rent hidden';
              const touch = row.lastTouch ? `${daysBetween(row.lastTouch.date, today)} d ago · ${row.lastTouch.type}` : 'No touch logged';
              const broker = brokerLabel(row.broker, safe);
              const marketed = marketedFor(row.seg, safe);
              const selected = state.select === row.segKey;
              return (
                <li key={`${row.segKey}`}>
                  <button type="button" className={`sp-ins__row ${selected ? 'is-selected' : ''}`} onClick={() => selectSegment(patch, row.segKey)} aria-pressed={selected}>
                    <div className="sp-ins__row-main">
                      <div className="sp-ins__row-title">
                        <span>{tenantLabel(lease, safe)}</span>
                        {row.renewal && canShowDeals(safe) && <StageChip stage={row.renewal.stage} />}
                      </div>
                      {marketed && !marketed.sublease && (
                        <div className="sp-ins__row-meta">
                          <Chip tone="warn" icon="warning" title="The suite is already on the market for a later date: the tenant is expected to leave">
                            {marketed.availableFrom ? `Marketed from ${fmtMonthYearShort(marketed.availableFrom)}` : 'Marketed'}
                          </Chip>
                        </div>
                      )}
                      <div className="sp-ins__row-meta">
                        {[row.floorName, row.suite ? `Ste ${row.suite}` : null, endText(row, safe), rent].filter(Boolean).map((part, i) => (
                          <span key={i}>{part}</span>
                        ))}
                      </div>
                      {(broker || canShowActivity(safe)) && (
                        <div className="sp-ins__row-meta">
                          {broker && <span>{broker}</span>}
                          {canShowActivity(safe) && <span>{touch}</span>}
                        </div>
                      )}
                    </div>
                    <div className="sp-ins__row-end">
                      <span className="sp-ins__row-value">{sf(row.size)}</span>
                      {monthsLeft(row, safe)}
                    </div>
                  </button>
                  {canShowRecordActions(safe) && (
                    <div className="sp-ins__row-actions">
                      <Button size="sm" variant="ghost" icon="phone" onClick={() => run('log-call', `Lease ${lease.id}`)}>
                        Log call
                      </Button>
                      {!row.renewal && (
                        <Button size="sm" variant="ghost" icon="plus" onClick={() => run('start-renewal', `Lease ${lease.id}`)}>
                          Start renewal
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="sp-ins__footer">
        <span>
          <strong>{sf(total)}</strong> · {plural(rows.length, 'lease')}
        </span>
        <Button size="sm" icon="download" onClick={exportCsv} disabled={rows.length === 0}>
          Export CSV
        </Button>
      </div>
    </>
  );
}
