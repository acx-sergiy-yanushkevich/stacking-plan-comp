import { useEffect } from 'react';
import { WINDOW_LABEL, type PlanModel, type WorklistRow } from '../../model/usePlanModel';
import type { PlanState, WindowKey } from '../../state/planState';
import { daysBetween, fmtMonths } from '../../domain/dates';
import { rentRollRows, toCsv } from '../../domain/exportCsv';
import { plural, rate, sf } from '../../domain/format';
import { rentVisible, tenantLabel } from '../../domain/safe';
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

function monthsLeft(row: WorklistRow, safe = false) {
  if (safe && (row.kind === 'holdover' || row.kind === 'mtm' || row.months === null)) return <span className="sp-ins__row-value">—</span>;
  if (row.kind === 'holdover') return <Chip tone="error">Holdover</Chip>;
  if (row.kind === 'mtm' || row.months === null) return <Chip tone="error">MTM</Chip>;
  return <span className="sp-ins__row-value">{fmtMonths(row.months)}</span>;
}

export function WorklistPanel({ model, state, patch }: WorklistPanelProps) {
  const { safe, today } = model;
  const window: WindowKey = state.window === 'risk' && safe ? '12' : (state.window ?? '12');
  const windows = safe ? WINDOWS.filter((w) => w !== 'risk') : WINDOWS;
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
            <p>Try a longer window or check At risk.</p>
          </div>
        ) : (
          <ul className="sp-ins__list" aria-label={`${WINDOW_LABEL[window]} worklist`}>
            {rows.map((row) => {
              const lease = row.seg.lease!;
              const rent = rentVisible(lease, safe) && lease.rate !== null ? rate(lease.rate, lease.rateUnit, lease.leaseType) : lease.confidential ? 'Confidential' : 'Rent hidden';
              const touch = row.lastTouch ? `${daysBetween(row.lastTouch.date, today)} d ago · ${row.lastTouch.type}` : 'No touch logged';
              const selected = state.select === row.segKey;
              return (
                <li key={`${row.segKey}`}>
                  <button type="button" className={`sp-ins__row ${selected ? 'is-selected' : ''}`} onClick={() => selectSegment(patch, row.segKey)} aria-pressed={selected}>
                    <div className="sp-ins__row-main">
                      <div className="sp-ins__row-title">
                        <span>{tenantLabel(lease, safe)}</span>
                        {row.renewal && !safe && <StageChip stage={row.renewal.stage} />}
                      </div>
                      <div className="sp-ins__row-meta">
                        <span>{[row.floorName, row.suite ? `Ste ${row.suite}` : null, rent].filter(Boolean).join(' · ')}</span>
                      </div>
                      {!safe && (
                        <div className="sp-ins__row-meta">
                          {row.broker && <span>{row.broker}</span>}
                          <span>{row.broker ? '· ' : ''}{touch}</span>
                        </div>
                      )}
                    </div>
                    <div className="sp-ins__row-end">
                      <span className="sp-ins__row-value">{sf(row.size)}</span>
                      {monthsLeft(row, safe)}
                    </div>
                  </button>
                  {!row.renewal && !safe && (
                    <div className="sp-ins__row-side">
                      <Button size="sm" variant="ghost" icon="plus" iconOnly aria-label={`Start renewal for ${tenantLabel(lease, safe)}`} title="Start renewal" onClick={() => run('start-renewal', `Lease ${lease.id}`)} />
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
