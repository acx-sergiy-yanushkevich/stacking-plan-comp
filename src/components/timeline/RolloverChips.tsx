import { useState } from 'react';
import type { ISODate } from '../../domain/types';
import type { RolloverBucket } from '../../domain/rollover';
import { fmtDate, fmtMonthYear } from '../../domain/dates';
import { num, plural, sf } from '../../domain/format';
import { Icon } from '../ui';

export interface RolloverChipsProps {
  buckets: RolloverBucket[];
  /** SF in holdover or month-to-month, which sits in no bucket. 0 hides the line. */
  atRisk: number;
  asOf: ISODate;
  activeBucket: number | null;
  onBucket: (key: number) => void;
}

/**
 * The rollover band for a narrow host. On the wide chart each 12-month bucket is a column over
 * its stretch of the axis; here a column would be about 25 px wide, too narrow for its figure, so
 * the same buckets are a grid of buttons with every SF figure written out in full. Not rendered in
 * prospect-safe mode, where the rollover by period is withheld.
 *
 * On a phone the grid is three rows of buttons, which pushed the first lease below the middle of the
 * screen. It is folded behind one row, as the legend above it is: the row states the two figures a
 * broker reads first (the SF ending in the next 12 months and the SF at risk), exactly, and opens the
 * nine periods. While a period is highlighting its leases the row names that period and its SF instead,
 * so the filter is never out of sight; choosing a period keeps the grid open.
 */
export function RolloverChips({ buckets, atRisk, asOf, activeBucket, onBucket }: RolloverChipsProps) {
  const periods = buckets.length - 1;
  const [open, setOpen] = useState(false);
  const active = buckets.find((b) => b.key === activeBucket) ?? null;
  const lead = active ?? buckets[0] ?? null;
  return (
    <details className="sp-tl-roll" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      {/* The row's name is the text on it, as written; what a listener needs beyond that follows, off screen. */}
      <summary className="sp-tl-roll__summary">
        <span className="sp-tl-roll__cap sp-label">Rollover</span>
        {lead && (
          <span className={`sp-tl-roll__lead ${active ? 'is-active' : ''}`}>
            {active ? 'Showing ' : ''}
            {lead.label} <strong>{sf(lead.sf)}</strong>
          </span>
        )}
        {atRisk > 0 && <span className="sp-tl-roll__risk">At risk {sf(atRisk)}</span>}
        <span className="sp-sr-only">{`. Rollover from ${fmtDate(asOf)}, ${periods + 1} periods`}</span>
        <Icon name="chevron-down" size={14} />
      </summary>
      <div className="sp-tl-roll__body" role="group" aria-label={`Rollover from ${fmtDate(asOf)}`}>
        <div className="sp-tl-roll__head">
          <span className="sp-tl-roll__cap sp-label">From {fmtMonthYear(asOf)}, by 12-month period</span>
          {atRisk > 0 && (
            <span className="sp-tl-roll__hint" title={`${sf(atRisk)} in holdover or month-to-month: not in any bucket`}>
              At risk is holdover and month-to-month, in no period
            </span>
          )}
        </div>
        <div className="sp-tl-roll__grid">
          {buckets.map((b, i) => {
            const on = activeBucket === b.key;
            const when = b.label.startsWith('<') ? 'in the next 12 months' : i === periods ? `${periods}+ years out` : `${b.label} out`;
            return (
              <button
                key={b.key}
                type="button"
                className={`sp-tl-roll__col ${on ? 'is-active' : ''} ${b.sf === 0 ? 'is-empty' : ''}`}
                aria-pressed={on}
                title={`${b.leases ? `${sf(b.sf)} in ${plural(b.leases, 'lease')}` : 'No leases'} ending ${when} from ${fmtDate(asOf)}. ${on ? 'Tap to clear the filter.' : 'Tap to highlight them.'}`}
                onClick={() => onBucket(b.key)}
              >
                <span className="sp-tl-roll__label">{b.label}</span>
                <span className="sp-tl-roll__value">{b.sf > 0 ? `${num(b.sf)} SF` : '—'}</span>
                <span className="sp-sr-only">, {plural(b.leases, 'lease')}</span>
              </button>
            );
          })}
        </div>
      </div>
    </details>
  );
}
