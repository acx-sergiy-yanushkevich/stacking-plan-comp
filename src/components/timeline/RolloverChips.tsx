import type { ISODate } from '../../domain/types';
import type { RolloverBucket } from '../../domain/rollover';
import { fmtDate, fmtMonthYear } from '../../domain/dates';
import { num, plural, sf } from '../../domain/format';

export interface RolloverChipsProps {
  buckets: RolloverBucket[];
  /** SF in holdover or month-to-month, which sits in no bucket. 0 hides the line (always 0 in prospect-safe mode). */
  atRisk: number;
  asOf: ISODate;
  activeBucket: number | null;
  /** Omitted when periods cannot be opened (prospect-safe). */
  onBucket?: (key: number) => void;
}

/**
 * The rollover band for a narrow host. On the wide chart each 12-month bucket is a column over
 * its stretch of the axis; here a column would be about 25 px wide, too narrow for its figure, so
 * the same buckets are a grid of buttons with every SF figure written out in full.
 */
export function RolloverChips({ buckets, atRisk, asOf, activeBucket, onBucket }: RolloverChipsProps) {
  const periods = buckets.length - 1;
  return (
    <div className="sp-tl-roll" role="group" aria-label={`Rollover from ${fmtDate(asOf)}`}>
      <div className="sp-tl-roll__head">
        <span className="sp-tl-roll__cap sp-label">Rollover from {fmtMonthYear(asOf)}</span>
        {atRisk > 0 && (
          <span className="sp-tl-roll__risk" title={`${sf(atRisk)} in holdover or month-to-month: not in any bucket`}>
            At risk {sf(atRisk)}
          </span>
        )}
      </div>
      <div className="sp-tl-roll__grid">
        {buckets.map((b, i) => {
          const active = activeBucket === b.key;
          const when = b.label.startsWith('<') ? 'in the next 12 months' : i === periods ? `${periods}+ years out` : `${b.label} out`;
          return (
            // No handler (prospect-safe: which leases end when is withheld) makes the period a figure, not a button.
            onBucket ? (
              <button
                key={b.key}
                type="button"
                className={`sp-tl-roll__col ${active ? 'is-active' : ''} ${b.sf === 0 ? 'is-empty' : ''}`}
                aria-pressed={active}
                title={`${b.leases ? `${sf(b.sf)} in ${plural(b.leases, 'lease')}` : 'No leases'} ending ${when} from ${fmtDate(asOf)}. ${active ? 'Tap to clear the filter.' : 'Tap to highlight them.'}`}
                onClick={() => onBucket(b.key)}
              >
                <span className="sp-tl-roll__label">{b.label}</span>
                <span className="sp-tl-roll__value">{b.sf > 0 ? `${num(b.sf)} SF` : '—'}</span>
                <span className="sp-sr-only">, {plural(b.leases, 'lease')}</span>
              </button>
            ) : (
              <div key={b.key} className={`sp-tl-roll__col sp-tl-roll__col--static ${b.sf === 0 ? 'is-empty' : ''}`} title={`${b.leases ? `${sf(b.sf)} in ${plural(b.leases, 'lease')}` : 'No leases'} ending ${when} from ${fmtDate(asOf)}.`}>
                <span className="sp-tl-roll__label">{b.label}</span>
                <span className="sp-tl-roll__value">{b.sf > 0 ? `${num(b.sf)} SF` : '—'}</span>
                <span className="sp-sr-only">, {plural(b.leases, 'lease')}</span>
              </div>
            )
          );
        })}
      </div>
    </div>
  );
}
