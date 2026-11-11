import type { ReactNode } from 'react';
import type { Deal } from '../../domain/types';
import { fmtDate } from '../../domain/dates';
import { sf } from '../../domain/format';
import { stageRank, stageLabel } from '../../domain/lenses';

/**
 * Running text with its dates kept whole: "Nov 9, 2026" does not break after the comma, so a line of a
 * note never ends on a date's comma with the year alone on the next line.
 */
export const wholeDates = (text: string): string => text.replace(/\b([A-Z][a-z]{2}) (\d{1,2}), (\d{4})\b/g, '$1\u00a0$2,\u00a0$3');

/** Section with an 11 px uppercase label and an optional right-hand control. */
export function Section({ title, aside, children, className = '' }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`sp-ins__section ${className}`}>
      <div className="sp-ins__section-head">
        <h3 className="sp-label">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export type Fact = [label: string, value: ReactNode] | null | false | undefined;

/** Label/value pairs; falsy entries are skipped so callers can write conditions inline. */
export function Facts({ items }: { items: Fact[] }) {
  const rows = items.filter((f): f is [string, ReactNode] => Array.isArray(f) && f[1] !== undefined && f[1] !== null && f[1] !== '');
  if (rows.length === 0) return null;
  return (
    <dl className="sp-ins__facts">
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'contents' }}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Deal stage chip coloured by the deals-lens tone for that stage. */
export function StageChip({ stage }: { stage: Deal['stage'] }) {
  const n = stageRank(stage);
  return (
    <span className="sp-ins__stage" style={{ background: `var(--tone-deal-${n}-fill)`, color: `var(--tone-deal-${n}-text)`, borderColor: `var(--tone-deal-${n}-edge)` }}>
      {stageLabel(stage)}
    </span>
  );
}

/** Distinct deals by id, most advanced stage first, then most recently updated. */
export function dedupeDeals(lists: Array<Deal[] | undefined>): Deal[] {
  const seen = new Map<string, Deal>();
  for (const list of lists) for (const d of list ?? []) if (!seen.has(d.id)) seen.set(d.id, d);
  return [...seen.values()].sort((a, b) => stageRank(b.stage) - stageRank(a.stage) || (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0));
}

/** Live deals on a block. The caller passes them through `visibleDeals`, so prospect-safe mode never reaches this list. */
export function DealList({ deals }: { deals: Deal[] }) {
  if (deals.length === 0) return <p className="sp-ins__explain">No live deals.</p>;
  return (
    <ul className="sp-ins__list" aria-label="Deals">
      {deals.map((d) => (
        <li key={d.id}>
          <div className="sp-ins__row">
            <StageChip stage={d.stage} />
            <div className="sp-ins__row-main">
              <div className="sp-ins__row-title">
                <span>{d.prospect}</span>
                {d.kind === 'Renewal' && <span className="sp-ins__tag">renewal</span>}
              </div>
              <div className="sp-ins__row-meta">
                {d.broker && <span>{d.broker}</span>}
                <span>Updated {fmtDate(d.updated)}</span>
              </div>
            </div>
            <div className="sp-ins__row-end">
              <span className="sp-ins__row-value">{sf(d.size)}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** "Call · Oct 28 by Dana Whitfield" */
export function touchText(t: { type: string; date: string; by: string } | undefined): string | undefined {
  return t ? `${t.type} · ${fmtDate(t.date)} by ${t.by}` : undefined;
}
