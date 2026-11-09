import type { LegendItem } from '../../domain/lenses';
import { num, pct } from '../../domain/format';

export interface LegendProps {
  items: LegendItem[];
  /** Footnote shown under the items (e.g. "Suites under 56 px are enlarged"). */
  note?: string | null;
  id?: string;
  compact?: boolean;
}

/** Legend whose items carry the SF and share they currently cover. */
export function Legend({ items, note, id, compact }: LegendProps) {
  return (
    <div className="sp-legend" id={id} aria-label="Legend">
      {items
        .filter((i) => i.sf > 0 || !compact)
        .map((i) => (
          <span key={i.tone + i.label} className="sp-legend__item" title={`${i.label}: ${num(i.sf)} SF, ${pct(i.share)} of leasable`}>
            <span
              className={`sp-legend__swatch ${i.pattern ? `sp-legend__swatch--${i.pattern}` : ''}`}
              style={{ background: i.pattern === 'dashed' ? 'transparent' : `var(--tone-${i.tone}-fill)`, borderColor: `var(--tone-${i.tone}-edge)`, color: `var(--tone-${i.tone}-edge)` }}
              aria-hidden="true"
            />
            <span className="sp-legend__label">{i.label}</span>
            {i.sf > 0 && (
              <span className="sp-legend__num">
                {num(i.sf)} · {pct(i.share)}
              </span>
            )}
          </span>
        ))}
      {note && <span className="sp-legend__note">{note}</span>}
    </div>
  );
}
